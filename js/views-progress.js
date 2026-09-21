// Edistyminen: viikkovolyymi, liikkeiden kehitys, ennätykset, keho
import { db } from './db.js';
import { h, uid, dayKey, keyToTs, weekStart, fmtDate, fmtDateShort } from './util.js';
import { S, render, U, toDisp, toKg, round2, fmtW, est1rm, exName, exercisesSorted, sortedSessions, confirmBox, toast } from './state.js';
import { barChart, lineChart } from './charts.js';

const kfmt = (v) => (v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : String(Math.round(v)));

function weekly() {
  const now = weekStart(Date.now());
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7 * i);
    weeks.push({ ts: d.getTime(), sets: 0, tonnage: 0, other: 0 });
  }
  const idx = new Map(weeks.map((w) => [w.ts, w]));
  S.sessions.forEach((s) => {
    const w = idx.get(weekStart(s.start));
    if (!w) return;
    s.entries.forEach((e) => e.sets.forEach((x) => { w.sets++; w.tonnage += x.w * x.r; }));
  });
  S.activities.forEach((a) => {
    const w = idx.get(weekStart(a.ts));
    if (w) w.other += a.minutes;
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

export function renderProgress() {
  const weeks = weekly();
  const cur = weeks[weeks.length - 1];
  const v = h('div', {}, h('h1', {}, 'Edistyminen'));

  // Viikkokuorma
  v.append(h('h2', { style: 'margin-top:0' }, 'Viikkokuorma'),
    h('div', { class: 'card' },
      h('div', { class: 'statrow', style: 'grid-template-columns:repeat(3,1fr);margin-bottom:8px' },
        h('div', { class: 'stat' }, h('b', {}, cur.sets), h('span', {}, 'sarjaa tällä viikolla')),
        h('div', { class: 'stat' }, h('b', {}, kfmt(toDisp(cur.tonnage))), h('span', {}, U() + ' volyymi')),
        h('div', { class: 'stat' }, h('b', {}, cur.other), h('span', {}, 'min muuta'))),
      h('div', { class: 'small muted' }, `Salivolyymi (${U()}) viikoittain`),
      barChart(weeks.map((w, i) => ({ label: fmtDateShort(w.ts), value: Math.round(toDisp(w.tonnage)), current: i === weeks.length - 1 })), { fmt: kfmt }),
      h('div', { class: 'small muted', style: 'margin-top:10px' }, 'Muu liikunta (min) viikoittain'),
      barChart(weeks.map((w, i) => ({ label: fmtDateShort(w.ts), value: w.other, current: i === weeks.length - 1 })), { color: 'var(--accent2)' })));

  // Liikkeen kehitys
  const used = exercisesSorted(S.exercises.filter((e) => S.sessions.some((s) => s.entries.some((x) => x.exId === e.id && x.sets.length))));
  v.append(h('h2', {}, 'Liikkeen kehitys'));
  if (!used.length) {
    v.append(h('div', { class: 'card muted' }, 'Kaaviot ilmestyvät, kun olet tallentanut treenejä.'));
  } else {
    if (!used.some((e) => e.id === S.ui.progEx)) S.ui.progEx = used[0].id;
    const pts = exerciseSeries(S.ui.progEx, S.ui.progMode);
    v.append(h('div', { class: 'card' },
      h('select', { onchange: (e) => { S.ui.progEx = e.target.value; render(); } },
        used.map((e) => h('option', { value: e.id, selected: e.id === S.ui.progEx }, e.name))),
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
          h('td', {}, e.name, h('div', { class: 'muted small' }, fmtDate(r.bwDate))),
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
