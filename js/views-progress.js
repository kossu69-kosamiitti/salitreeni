// Edistyminen: volyymi per lihas, viikkovolyymi, liikkeiden kehitys, ennätykset, keho
import { db } from './db.js';
import { h, uid, dayKey, keyToTs, weekStart, fmtDate, fmtDateShort } from './util.js';
import { S, render, U, toDisp, toKg, round2, fmtW, est1rm, exercisesSorted, sortedSessions, confirmBox, toast, exById, exName } from './state.js';
import { barChart, lineChart } from './charts.js';
import { MUSCLES, BROAD } from './data.js';
import { sessionsInWindow, volumeFor, targetFor, scaleTarget } from './volume.js';
import { exerciseDetailModal } from './views-exercise.js';

// Liikkeen nimi tekstinä, klikattava -> avaa liikkeen tiedot/historia-näkymä.
function exLink(id) {
  const ex = exById(id);
  return ex ? h('button', { class: 'lnk', onclick: () => exerciseDetailModal(ex) }, ex.name) : h('span', {}, exName(id));
}

const kfmt = (v) => (v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : String(Math.round(v)));

function weekly() {
  const now = weekStart(Date.now());
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7 * i);
    weeks.push({ ts: d.getTime(), sets: 0 });
  }
  const idx = new Map(weeks.map((w) => [w.ts, w]));
  S.sessions.forEach((s) => {
    const w = idx.get(weekStart(s.start));
    if (!w) return;
    s.entries.forEach((e) => e.sets.forEach(() => w.sets++));
  });
  return weeks;
}

function exerciseSeries(exId, mode) {
  const pts = [];
  sortedSessions().forEach((s) => {
    const e = s.entries.find((x) => x.exId === exId && x.sets.length);
    if (!e) return;
    const y = Math.max(...e.sets.map((x) => (mode === '1rm' ? est1rm(x.w, x.r) : x.w)));
    pts.push({ x: s.start, y: round2(toDisp(y)) });
  });
  return pts;
}

function records() {
  const map = new Map();
  sortedSessions().forEach((s) => s.entries.forEach((e) => e.sets.forEach((x) => {
    const cur = map.get(e.exId) || { bw: 0, br: 0, bwDate: 0, b1: 0 };
    if (x.w > cur.bw || (x.w === cur.bw && x.r > cur.br)) { cur.bw = x.w; cur.br = x.r; cur.bwDate = s.start; }
    cur.b1 = Math.max(cur.b1, est1rm(x.w, x.r));
    map.set(e.exId, cur);
  })));
  return map;
}

// ---------- Volyymi per lihas ----------
let volDays = 7;
let volOpen = null; // avoinna oleva karkea ryhmä

function bar(value, target) {
  const max = Math.max(target.max, value, 1);
  const pct = Math.min(100, Math.round((value / max) * 100));
  const minPct = Math.min(100, Math.round((target.min / max) * 100));
  const maxPct = Math.min(100, Math.round((target.max / max) * 100));
  const color = target.max > 0 && value < target.min ? 'var(--accent2)' : target.max > 0 && value > target.max ? 'var(--gold)' : 'var(--accent)';
  return h('div', { style: 'position:relative;height:8px;background:var(--card2);border-radius:4px;margin:5px 0 2px;overflow:hidden' },
    h('div', { style: `position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${color};border-radius:4px` }),
    target.max > 0 ? h('div', { style: `position:absolute;left:${minPct}%;top:0;bottom:0;width:2px;background:var(--line)` }) : null,
    target.max > 0 ? h('div', { style: `position:absolute;left:${maxPct}%;top:0;bottom:0;width:2px;background:var(--line)` }) : null);
}

// Sarjamäärät voivat olla murtolukuja (avustavan lihaksen painotus), näytetään siististi.
const fmtSets = (n) => (Math.round(n * 100) / 100).toString().replace(/\.?0+$/, '');
const fmtReps = (n) => Math.round(n);

// Avustavan lihaksen painotus tiiviisti: 0.25→¼×, 0.5→½×, 0.75→¾×, 1→1×, muu (vanha data)→esim. 0.6×.
const FRAC = { 0.25: '¼×', 0.5: '½×', 0.75: '¾×', 1: '1×' };
const fmtWeight = (w) => FRAC[w] || `${w}×`;

// Tiivis esitys sarjoista: "3×5 · 100 kg" kun kaikki sarjat samat, muuten sarja kerrallaan.
function fmtSetsShort(sets) {
  if (!sets.length) return '';
  const allSame = sets.every((x) => x.w === sets[0].w && x.r === sets[0].r);
  if (allSame) return `${sets.length}×${sets[0].r} · ${fmtW(sets[0].w)} ${U()}`;
  return sets.map((x) => `${fmtW(x.w)}×${x.r}`).join(', ') + ` ${U()}`;
}

function muscleEntries(entries) {
  if (!entries.length) return h('div', { class: 'muted small', style: 'margin:4px 0 2px' }, 'Ei sarjoja tällä jaksolla.');
  return h('div', { style: 'margin:4px 0 2px' }, entries.map((en) =>
    h('div', { class: 'row between small', style: 'padding:3px 0;gap:8px' },
      h('span', {}, `${fmtDateShort(en.date)} `, exLink(en.exId), !en.primary ? h('span', { class: 'muted', style: 'font-size:11px' }, ` · avustava ${fmtWeight(en.weight)}`) : null),
      h('span', { class: 'muted', style: 'text-align:right' }, fmtSetsShort(en.sets)))));
}

let volMuscleOpen = null;

function muscleRow(m, data, days) {
  const t = scaleTarget(targetFor(m.id), days);
  const d = data.muscles[m.id];
  const open = volMuscleOpen === m.id;
  return h('div', { style: 'padding:6px 0;border-top:1px solid var(--line)' },
    h('button', {
      class: 'pick', style: 'min-height:0;padding:0;background:none;width:100%',
      onclick: () => { volMuscleOpen = open ? null : m.id; render(); },
    }, h('div', { class: 'row between small' },
      h('span', {}, (open ? '▾ ' : '▸ ') + m.name),
      h('span', { class: 'muted' }, `${fmtSets(d.sets)} sarjaa · ${fmtReps(d.reps)} toistoa`))),
    bar(d.sets, t),
    t.max > 0 ? h('div', { class: 'muted', style: 'font-size:11px' }, `Tavoite ${t.min}-${t.max} sarjaa`) : null,
    open ? muscleEntries(d.entries) : null);
}

function volumeSection() {
  const sessions = sessionsInWindow(volDays);
  const data = volumeFor(sessions);
  return h('div', {},
    h('div', { class: 'row', style: 'margin-bottom:8px;gap:8px' },
      h('button', { class: volDays === 7 ? 'primary grow' : 'grow', onclick: () => { volDays = 7; render(); } }, 'Viikko (7 pv)'),
      h('button', { class: volDays === 30 ? 'primary grow' : 'grow', onclick: () => { volDays = 30; render(); } }, 'Kuukausi (30 pv)')),
    h('div', { class: 'card' },
      BROAD.map((b, i) => {
        const d = data.broad[b];
        const open = volOpen === b;
        const children = MUSCLES.filter((m) => m.parent === b);
        return h('div', { style: i ? 'border-top:1px solid var(--line);padding-top:8px;margin-top:8px' : '' },
          h('button', {
            class: 'pick', style: 'min-height:0;padding:0;background:none',
            onclick: () => { volOpen = open ? null : b; render(); },
          }, h('div', { class: 'row between' },
            h('b', {}, (open ? '▾ ' : '▸ ') + b),
            h('span', { class: 'muted small' }, `${fmtSets(d.sets)} sarjaa · ${fmtReps(d.reps)} toistoa`))),
          open ? h('div', { style: 'margin-top:2px' }, children.map((m) => muscleRow(m, data, volDays))) : null);
      })),
    h('div', { class: 'muted small', style: 'margin-top:6px' },
      'Ensisijainen lihas saa täyden sarjan. Avustavan lihaksen painotus (¼×-1×) on liikekohtainen ja muokattavissa liikkeen tiedoista. Tavoitevälit muokattavissa Asetuksissa.'));
}

export function renderProgress() {
  const weeks = weekly();
  const cur = weeks[weeks.length - 1];
  const v = h('div', {}, h('h1', {}, 'Edistyminen'));

  v.append(h('h2', { style: 'margin-top:0' }, 'Volyymi per lihas'), volumeSection());

  // Viikkokuorma
  v.append(h('h2', {}, 'Sarjat viikoittain'));
  v.append(h('div', { class: 'card' },
    h('div', { class: 'stat' }, h('b', {}, cur.sets), h('span', {}, 'sarjaa tällä viikolla')),
    barChart(weeks.map((w, i) => ({ label: fmtDateShort(w.ts), value: w.sets, current: i === weeks.length - 1 })))));

  // Liikkeen kehitys
  const used = exercisesSorted(S.exercises.filter((e) => S.sessions.some((s) => s.entries.some((x) => x.exId === e.id && x.sets.length))));
  v.append(h('h2', {}, 'Liikkeen kehitys'));
  if (!used.length) {
    v.append(h('div', { class: 'card muted' }, 'Kaaviot ilmestyvät, kun olet tallentanut treenejä.'));
  } else {
    if (!used.some((e) => e.id === S.ui.progEx)) S.ui.progEx = used[0].id;
    const pts = exerciseSeries(S.ui.progEx, S.ui.progMode);
    v.append(h('div', { class: 'card' },
      h('div', { class: 'row', style: 'gap:8px' },
        h('select', { class: 'grow', onchange: (e) => { S.ui.progEx = e.target.value; render(); } },
          used.map((e) => h('option', { value: e.id, selected: e.id === S.ui.progEx }, e.name))),
        h('button', { class: 'small ghost', onclick: () => exerciseDetailModal(exById(S.ui.progEx)) }, 'Tiedot')),
      h('div', { class: 'row', style: 'margin:10px 0' },
        h('button', { class: S.ui.progMode === '1rm' ? 'primary grow' : 'grow', onclick: () => { S.ui.progMode = '1rm'; render(); } }, 'Arvioitu 1RM'),
        h('button', { class: S.ui.progMode === 'w' ? 'primary grow' : 'grow', onclick: () => { S.ui.progMode = 'w'; render(); } }, 'Raskain paino')),
      lineChart(pts, { fmtY: (y) => Math.round(y * 10) / 10, fmtX: fmtDateShort }),
      h('div', { class: 'small muted' }, `${pts.length} treeniä · yksikkö ${U()}`)));
  }

  // Ennätykset
  const recs = records();
  v.append(h('h2', {}, 'Ennätykset'));
  if (!recs.size) v.append(h('div', { class: 'card muted' }, 'Ei vielä ennätyksiä.'));
  else {
    const rows = exercisesSorted(S.exercises.filter((e) => recs.has(e.id)));
    v.append(h('div', { class: 'card' }, h('table', {},
      h('tr', {}, h('th', {}, 'Liike'), h('th', { class: 'r' }, 'Paras sarja'), h('th', { class: 'r' }, '1RM (arvio)')),
      rows.map((e) => {
        const r = recs.get(e.id);
        return h('tr', {},
          h('td', {}, exLink(e.id), h('div', { class: 'muted small' }, fmtDate(r.bwDate))),
          h('td', { class: 'r' }, `${fmtW(r.bw)} × ${r.br}`),
          h('td', { class: 'r' }, round2(toDisp(r.b1))));
      }))));
  }

  // Keho
  v.append(h('h2', {}, 'Kehonpaino ja mitat'));
  v.append(bodyCard());
  return v;
}

function bodyCard() {
  const f = {};
  const mk = (key, label, ph) => h('div', { class: 'field' }, h('label', {}, label),
    h('input', { type: 'number', inputmode: 'decimal', step: 'any', placeholder: ph || '', oninput: (e) => (f[key] = e.target.value) }));
  const date = h('input', { type: 'date', value: dayKey(Date.now()) });
  const sorted = [...S.body].sort((a, b) => a.date.localeCompare(b.date));
  const wpts = sorted.filter((b) => b.weight != null).map((b) => ({ x: keyToTs(b.date), y: round2(toDisp(b.weight)) }));
  return h('div', { class: 'card' },
    wpts.length ? [h('div', { class: 'small muted' }, `Kehonpaino (${U()})`), lineChart(wpts, { color: 'var(--gold)', fmtY: (y) => Math.round(y * 10) / 10, fmtX: fmtDateShort })] : null,
    h('div', { class: 'field' }, h('label', {}, 'Päivä'), date),
    h('div', { class: 'grid2' }, mk('weight', `Paino (${U()})`), mk('waist', 'Vyötärö (cm)')),
    h('div', { class: 'grid2' }, mk('chest', 'Rinta (cm)'), mk('arm', 'Käsivarsi (cm)')),
    h('div', { class: 'grid2' }, mk('thigh', 'Reisi (cm)'), h('div')),
    h('button', {
      class: 'primary big',
      onclick: async () => {
        const num = (k) => (f[k] !== undefined && f[k] !== '' && !isNaN(parseFloat(f[k])) ? parseFloat(f[k]) : null);
        const entry = { id: uid(), date: date.value || dayKey(Date.now()), weight: num('weight') != null ? toKg(num('weight')) : null,
          waist: num('waist'), chest: num('chest'), arm: num('arm'), thigh: num('thigh') };
        if ([entry.weight, entry.waist, entry.chest, entry.arm, entry.thigh].every((x) => x == null)) return toast('Syötä ainakin yksi arvo');
        await db.put('body', entry);
        S.body.push(entry);
        toast('Tallennettu');
        render();
      },
    }, 'Tallenna mittaus'),
    sorted.length ? h('div', { style: 'margin-top:12px' }, [...sorted].reverse().slice(0, 5).map((b) =>
      h('div', { class: 'row between small', style: 'padding:6px 0;border-top:1px solid var(--line)' },
        h('span', {}, `${b.date.split('-').reverse().join('.')}: ` + [b.weight != null ? `${fmtW(b.weight)} ${U()}` : null, b.waist ? `vyötärö ${b.waist}` : null,
          b.chest ? `rinta ${b.chest}` : null, b.arm ? `käsivarsi ${b.arm}` : null, b.thigh ? `reisi ${b.thigh}` : null].filter(Boolean).join(' · ')),
        h('button', { class: 'small ghost', onclick: async () => {
          if (!(await confirmBox('Poistetaanko mittaus?', 'Poista', true))) return;
          await db.del('body', b.id);
          S.body = S.body.filter((x) => x.id !== b.id);
          render();
        } }, '✕')))) : null);
}
