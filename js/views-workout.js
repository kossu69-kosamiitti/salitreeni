// Treeni-välilehti: seuraava treeni vuorossa, sarjarivit (jokainen sarja kuitataan erikseen), lepoajastin
import { db } from './db.js';
import { h, uid, fmtDate, mmss, parseMMSS } from './util.js';
import {
  S, render, saveActive, U, toDisp, toKg, round2, fmtW, est1rm, exById, exName,
  sortedSessions, lastEntryFor, bestFor, sessionStats, modal, confirmBox, toast, pickExercise,
} from './state.js';

// ---------- Lepoajastin ----------
let timer = null;
let restInt = null;
let actx = null;

function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch {}
}
function beep() {
  try {
    if (!actx) return;
    [0, 0.3].forEach((t) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.connect(g);
      g.connect(actx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.18;
      o.start(actx.currentTime + t);
      o.stop(actx.currentTime + t + 0.2);
    });
  } catch {}
}

export function startRest(sec = S.settings.rest) {
  timer = { end: Date.now() + sec * 1000, fired: false };
  clearInterval(restInt);
  restInt = setInterval(tickRest, 250);
  tickRest();
}
export function stopRest() {
  timer = null;
  tickRest();
}
function tickRest() {
  const el = document.getElementById('rest');
  if (!timer) {
    clearInterval(restInt);
    el.classList.add('hidden');
    return;
  }
  const left = Math.ceil((timer.end - Date.now()) / 1000);
  el.classList.remove('hidden');
  if (left <= 0) {
    if (!timer.fired) {
      timer.fired = true;
      navigator.vibrate?.([250, 120, 250, 120, 400]);
      beep();
    }
    el.replaceChildren(h('span', { class: 'rest-t done' }, 'Lepo ohi'), h('button', { class: 'small', onclick: stopRest }, 'OK'));
    if (left < -10) stopRest();
    return;
  }
  el.replaceChildren(
    h('span', { class: 'rest-t' }, 'Lepo ' + mmss(left)),
    h('button', { class: 'small', onclick: () => (timer.end += 15000) }, '+15 s'),
    h('button', { class: 'small', onclick: stopRest }, 'Ohita')
  );
}

// ---------- Näytön pito päällä treenin aikana ----------
let wake = null;
async function keepAwake() {
  try {
    if (navigator.wakeLock && !wake) {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => (wake = null));
    }
  } catch {}
}
function releaseAwake() {
  try {
    wake?.release();
  } catch {}
  wake = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.active) keepAwake();
});
export const resumeActive = () => S.active && keepAwake();

// ---------- Apurit ----------
function nextTemplate() {
  const tpls = [...S.templates].sort((a, b) => a.order - b.order);
  if (!tpls.length) return null;
  const last = sortedSessions().filter((s) => tpls.some((t) => t.id === s.templateId)).pop();
  if (!last) return tpls[0];
  const i = tpls.findIndex((t) => t.id === last.templateId);
  return tpls[(i + 1) % tpls.length];
}

const restFrom = (item, i) => {
  if (item && item.rests && item.rests.length) return item.rests[Math.min(i, item.rests.length - 1)];
  return (item && item.rest) || S.settings.rest;
};

// Luo valmiit sarjarivit, esitäytetty edellisen kerran saman sarjan arvoilla
function buildSets(exId, count, targetReps, item) {
  const prev = lastEntryFor(exId);
  const n = count || (prev ? prev.sets.length : 3);
  return Array.from({ length: n }, (_, i) => {
    const p = prev ? prev.sets[i] || prev.sets[prev.sets.length - 1] : null;
    return {
      w: p ? p.w : 0,
      r: p ? p.r : parseInt(targetReps, 10) || 8,
      rest: restFrom(item, i),
      done: false,
    };
  });
}

async function startSession(tpl) {
  S.active = {
    id: uid(),
    templateId: tpl ? tpl.id : null,
    name: tpl ? tpl.name : 'Vapaa treeni',
    start: Date.now(),
    note: '',
    entries: tpl
      ? tpl.items.map((it) => ({ exId: it.exId, note: '', sets: buildSets(it.exId, it.sets, it.reps, it) }))
      : [],
  };
  await saveActive();
  keepAwake();
  render();
  window.scrollTo(0, 0);
}

// ---------- Näkymä ----------
export function renderWorkout() {
  return S.active && S.active.entries && S.active.entries.every((e) => e.sets.every((s) => 'done' in s)) ? activeView() : homeView();
}

function ouraCard() {
  const days = S.oura.days || {};
  const key = Object.keys(days).sort().pop();
  if (!key) return null;
  const d = days[key];
  const bits = [];
  if (d.readiness != null) bits.push(['Palautuminen', d.readiness]);
  if (d.sleep != null) bits.push(['Uni', d.sleep]);
  if (d.hrv != null) bits.push(['HRV', d.hrv]);
  if (d.rhr != null) bits.push(['Leposyke', d.rhr]);
  if (!bits.length) return null;
  return h('div', { class: 'card' },
    h('div', { class: 'small muted', style: 'margin-bottom:8px' }, 'Oura · ' + key),
    h('div', { class: 'statrow' }, bits.map(([l, v]) => h('div', { class: 'stat' }, h('b', {}, v), h('span', {}, l)))));
}

function homeView() {
  if (S.active) {
    // vanhan muotoinen keskeneräinen treeni (ennen päivitystä) siivotaan pois
    S.active = null;
    saveActive();
  }
  const next = nextTemplate();
  const last = sortedSessions().pop();
  const v = h('div', {}, h('h1', {}, 'Treeni'), ouraCard());

  if (next) {
    v.append(h('div', { class: 'card' },
      h('div', { class: 'small muted' }, 'Seuraavaksi vuorossa'),
      h('h1', { style: 'margin:2px 0 8px' }, next.name),
      h('div', { class: 'muted small', style: 'margin-bottom:12px' },
        next.items.map((it) => `${exName(it.exId)} ${it.sets}×${it.reps}`).join(' · ')),
      h('button', { class: 'primary big', onclick: () => startSession(next) }, 'Aloita treeni')));
    const others = [...S.templates].sort((a, b) => a.order - b.order).filter((t) => t.id !== next.id);
    if (others.length) {
      v.append(h('div', { class: 'small muted', style: 'margin:0 0 6px' }, 'Tai valitse toinen treeni'),
        h('div', { class: 'row wrap', style: 'margin-bottom:12px' },
          others.map((t) => h('button', { onclick: () => startSession(t) }, t.name))));
    }
  } else {
    v.append(h('div', { class: 'card muted' }, 'Ei treeniohjelmaa. Luo treenipohjia Asetukset-välilehdellä tai aloita vapaa treeni.'));
  }
  v.append(h('button', { class: 'big', onclick: () => startSession(null) }, 'Vapaa treeni'));

  if (last) {
    const st = sessionStats(last);
    v.append(h('h2', {}, 'Viimeisin treeni'),
      h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('b', {}, last.name), h('span', { class: 'muted small' }, fmtDate(last.start))),
        h('div', { class: 'muted small', style: 'margin-top:4px' },
          `${st.sets} sarjaa · ${Math.round(toDisp(st.tonnage)).toLocaleString('fi')} ${U()} kokonaisvolyymi`)));
  }
  const stale = S.sessions.length && Date.now() - S.lastBackup > 30 * 86400000;
  if (stale) {
    v.append(h('div', { class: 'card small' },
      'Varmuuskopiota ei ole otettu 30 päivään. Tiedot ovat vain tässä puhelimessa – vie varmuuskopio Asetukset-välilehdeltä.'));
  }
  return v;
}

// ---------- Lepoajan muokkaus ----------
async function persistRestToTemplate(en) {
  const tpl = S.templates.find((t) => t.id === S.active.templateId);
  const item = tpl && tpl.items.find((x) => x.exId === en.exId);
  if (!item) return;
  item.rests = en.sets.map((s) => s.rest);
  await db.put('templates', tpl);
}

function editRest(en, idx) {
  return modal((close) => {
    const cur = en.sets[idx].rest;
    const inp = h('input', { value: mmss(cur), inputmode: 'numeric', placeholder: 'm:ss' });
    const apply = async (all) => {
      const sec = parseMMSS(inp.value);
      if (!sec) return toast('Anna aika muodossa m:ss tai sekunteina');
      if (all) en.sets.forEach((s) => (s.rest = sec));
      else en.sets[idx].rest = sec;
      await saveActive();
      await persistRestToTemplate(en);
      close(true);
      render();
    };
    return h('div', {},
      h('h2', {}, `Lepoaika · sarja ${idx + 1}`),
      h('div', { class: 'row wrap', style: 'margin-bottom:10px' },
        [60, 90, 120, 180, 240, 300].map((s) => h('button', { class: 'small', onclick: () => (inp.value = mmss(s)) }, mmss(s)))),
      h('div', { class: 'field' }, h('label', {}, 'Aika (m:ss)'), inp),
      h('div', { class: 'actions' },
        h('button', { onclick: () => apply(true) }, 'Kaikille sarjoille'),
        h('button', { class: 'primary', onclick: () => apply(false) }, 'Vain tälle')),
      h('div', { class: 'muted small', style: 'margin-top:8px' }, 'Muutos tallentuu myös treenipohjaan.'));
  });
}

// ---------- Sarjarivi ----------
async function toggleSet(en, s, kgIn, repIn) {
  if (s.done) {
    s.done = false;
    delete s.pr;
    await saveActive();
    stopRest();
    render();
    return;
  }
  unlockAudio();
  s.w = toKg(parseFloat(kgIn.value) || 0);
  s.r = parseInt(repIn.value, 10) || 0;
  if (!(s.r > 0)) return toast('Syötä toistot');
  const best = bestFor(en.exId, en.sets.filter((x) => x !== s && x.done));
  const isPR = best.bw > 0 && s.w > 0 && (s.w > best.bw + 1e-6 || est1rm(s.w, s.r) > best.b1 + 1e-6);
  s.done = true;
  if (isPR) s.pr = true;
  await saveActive();
  render();
  startRest(s.rest);
  if (isPR) toast('Uusi ennätys!');
}

function setRow(en, s, i, prev) {
  const p = prev && prev.sets[i];
  const kg = h('input', {
    class: 'cell', type: 'number', inputmode: 'decimal', step: 'any', min: '0', placeholder: '0',
    'aria-label': `Paino, sarja ${i + 1}`, value: s.w ? round2(toDisp(s.w)) : '',
    oninput: (e) => (s.w = toKg(parseFloat(e.target.value) || 0)),
    onchange: () => saveActive(),
  });
  const reps = h('input', {
    class: 'cell', type: 'number', inputmode: 'numeric', step: '1', min: '0', placeholder: '0',
    'aria-label': `Toistot, sarja ${i + 1}`, value: s.r || '',
    oninput: (e) => (s.r = parseInt(e.target.value, 10) || 0),
    onchange: () => saveActive(),
  });
  return h('div', {},
    h('div', { class: 'srow' + (s.done ? ' done' : '') },
      h('button', { class: 'sno' + (s.pr ? ' pr' : ''), 'aria-label': `Sarja ${i + 1} valikko`, onclick: () => setMenu(en, i) }, s.pr ? 'PR' : i + 1),
      h('span', { class: 'prev' }, p ? `${fmtW(p.w)} × ${p.r}` : '–'),
      kg, reps,
      h('button', { class: 'chk' + (s.done ? ' on' : ''), 'aria-label': s.done ? 'Peru kuittaus' : 'Kuittaa sarja', onclick: () => toggleSet(en, s, kg, reps) }, '✓')),
    h('button', { class: 'restline', 'aria-label': 'Muuta lepoaikaa', onclick: () => editRest(en, i) }, h('span', {}, mmss(s.rest))));
}

function setMenu(en, i) {
  return modal((close) => h('div', {},
    h('h2', {}, `Sarja ${i + 1}`),
    h('button', { class: 'pick danger', onclick: async () => {
      en.sets.splice(i, 1);
      await saveActive();
      close(true);
      render();
    } }, 'Poista sarja'),
    h('div', { class: 'actions' }, h('button', { onclick: () => close(null) }, 'Sulje'))));
}

function noteDialog(en) {
  return modal((close) => {
    const t = h('textarea', { placeholder: 'Muistiinpano liikkeestä…', value: en.note || '' });
    return h('div', {}, h('h2', {}, 'Muistiinpano'), t,
      h('div', { class: 'actions' },
        h('button', { onclick: () => close(null) }, 'Peruuta'),
        h('button', { class: 'primary', onclick: async () => { en.note = t.value.trim(); await saveActive(); close(true); render(); } }, 'Tallenna')));
  });
}

function exMenu(en) {
  return modal((close) => {
    const act = (fn) => async () => { close(null); await fn(); };
    return h('div', {},
      h('h2', {}, exName(en.exId)),
      h('button', { class: 'pick', onclick: act(() => noteDialog(en)) }, 'Muistiinpano'),
      h('button', { class: 'pick', onclick: act(() => editRest(en, 0)) }, 'Lepoaika (kaikille sarjoille)'),
      h('button', { class: 'pick', onclick: act(() => plateCalc(0)) }, 'Levytyslaskuri'),
      h('button', { class: 'pick', onclick: act(async () => {
        if (en.sets.some((s) => s.done)) return toast('Peru ensin kuitatut sarjat');
        const id = await pickExercise();
        if (!id) return;
        en.exId = id;
        en.sets = buildSets(id, en.sets.length, '8', null);
        await saveActive();
        render();
      }) }, 'Vaihda liike'),
      h('button', { class: 'pick danger', onclick: act(async () => {
        if (en.sets.some((s) => s.done) && !(await confirmBox('Poistetaanko liike ja sen kuitatut sarjat?', 'Poista', true))) return;
        S.active.entries = S.active.entries.filter((x) => x !== en);
        await saveActive();
        render();
      }) }, 'Poista liike'),
      h('div', { class: 'actions' }, h('button', { onclick: () => close(null) }, 'Sulje')));
  });
}

function entryBlock(en) {
  const prev = lastEntryFor(en.exId);
  const ex = exById(en.exId);
  const block = h('section', { class: 'ex' },
    h('div', { class: 'exh' },
      h('span', { class: 'exn' }, ex ? ex.name : '(poistettu liike)'),
      h('button', { class: 'more', 'aria-label': 'Liikkeen valikko', onclick: () => exMenu(en) }, '⋯')),
    en.note ? h('div', { class: 'note' }, en.note) : null,
    h('div', { class: 'shead' }, h('span', {}, 'Sarja'), h('span', {}, 'Edellinen'), h('span', {}, U()), h('span', {}, 'Toistot'), h('span', {}, '')),
    en.sets.map((s, i) => setRow(en, s, i, prev)),
    h('button', {
      class: 'addset',
      onclick: async () => {
        const last = en.sets[en.sets.length - 1];
        en.sets.push({ w: last ? last.w : 0, r: last ? last.r : 8, rest: last ? last.rest : S.settings.rest, done: false });
        await saveActive();
        render();
      },
    }, `+ Lisää sarja (${mmss(en.sets.length ? en.sets[en.sets.length - 1].rest : S.settings.rest)})`));
  return block;
}

let elapsedInt = null;
function activeView() {
  const a = S.active;
  const clock = h('span', { class: 'muted' }, '');
  const upd = () => {
    if (!clock.isConnected) return clearInterval(elapsedInt);
    const s = Math.floor((Date.now() - a.start) / 1000);
    clock.textContent = s >= 3600 ? `${Math.floor(s / 3600)}:${mmss(s % 3600)}` : mmss(s);
  };
  clearInterval(elapsedInt);
  elapsedInt = setInterval(upd, 1000);
  setTimeout(upd, 0);

  const v = h('div', {},
    h('div', { class: 'topbar' },
      h('div', {}, h('b', {}, a.name), h('span', { class: 'muted', style: 'margin:0 6px' }, '·'), clock),
      h('button', { class: 'finish', onclick: finish }, 'LOPETA')));
  a.entries.forEach((en) => v.append(entryBlock(en)));
  v.append(
    h('button', {
      class: 'addex',
      onclick: async () => {
        const id = await pickExercise();
        if (!id) return;
        a.entries.push({ exId: id, note: '', sets: buildSets(id, 0, '8', null) });
        await saveActive();
        render();
      },
    }, '+ Lisää liike'),
    h('div', { class: 'field', style: 'margin-top:16px' },
      h('label', {}, 'Treenin muistiinpano'),
      h('textarea', { value: a.note || '', placeholder: 'Fiilis, uni, kipu…', onchange: async (e) => { a.note = e.target.value; await saveActive(); } })),
    h('button', { class: 'primary big', onclick: finish }, 'Lopeta treeni'),
    h('div', { style: 'height:8px' }),
    h('button', { class: 'danger ghost big', onclick: discard }, 'Hylkää treeni'));
  return v;
}

async function clearActive() {
  clearInterval(elapsedInt);
  S.active = null;
  await saveActive();
  stopRest();
  releaseAwake();
  render();
  window.scrollTo(0, 0);
}

async function discard() {
  if (!(await confirmBox('Hylätäänkö koko treeni? Kirjatut sarjat poistetaan.', 'Hylkää', true))) return;
  await clearActive();
}

async function finish() {
  const a = S.active;
  const done = a.entries.filter((e) => e.sets.some((s) => s.done));
  if (!done.length) {
    if (await confirmBox('Yhtään sarjaa ei ole kuitattu. Hylätäänkö treeni?', 'Hylkää', true)) await clearActive();
    return;
  }
  const undone = a.entries.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
  const msg = undone
    ? `Lopetetaanko treeni? ${undone} kuittaamatonta sarjaa jätetään pois.`
    : 'Lopetetaanko treeni ja tallennetaan se?';
  if (!(await confirmBox(msg, 'Tallenna'))) return;
  const s = {
    id: a.id, templateId: a.templateId, name: a.name, start: a.start, end: Date.now(), note: a.note || '',
    entries: done.map((e) => ({
      exId: e.exId,
      note: e.note || '',
      sets: e.sets.filter((x) => x.done).map((x) => ({ w: x.w, r: x.r, ...(x.pr ? { pr: true } : {}) })),
    })),
  };
  await db.put('sessions', s);
  S.sessions.push(s);
  await clearActive();
  summary(s);
}

function summary(s) {
  const st = sessionStats(s);
  const prs = [];
  s.entries.forEach((e) => e.sets.forEach((x) => x.pr && prs.push(`${exName(e.exId)} ${fmtW(x.w)} ${U()} × ${x.r}`)));
  modal((close) => h('div', {},
    h('h2', {}, 'Treeni tallennettu'),
    h('div', { class: 'statrow', style: 'grid-template-columns:repeat(3,1fr)' },
      h('div', { class: 'stat' }, h('b', {}, Math.max(1, Math.round((s.end - s.start) / 60000))), h('span', {}, 'min')),
      h('div', { class: 'stat' }, h('b', {}, st.sets), h('span', {}, 'sarjaa')),
      h('div', { class: 'stat' }, h('b', {}, Math.round(toDisp(st.tonnage)).toLocaleString('fi')), h('span', {}, U() + ' volyymi'))),
    prs.length ? h('div', { style: 'margin-top:14px' }, h('b', {}, 'Ennätykset'), prs.map((p) => h('div', {}, h('span', { class: 'pr' }, 'PR'), ' ' + p))) : null,
    h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => close(true) }, 'Valmis'))));
}

// ---------- Levytyslaskuri ----------
export function plateCalc(current) {
  return modal((close) => {
    const st = S.settings;
    const inp = h('input', { type: 'number', inputmode: 'decimal', step: 'any', value: current || '' });
    const out = h('div', { class: 'card', style: 'margin-top:12px' });
    const calc = () => {
      const t = parseFloat(inp.value) || 0;
      const per = (t - st.bar) / 2;
      if (per < 0) {
        out.replaceChildren(h('div', { class: 'muted' }, `Pelkkä tanko painaa ${st.bar} ${U()}.`));
        return;
      }
      let rem = per;
      const used = [];
      for (const p of [...st.plates].sort((x, y) => y - x)) {
        while (rem + 1e-9 >= p) {
          used.push(p);
          rem -= p;
        }
      }
      out.replaceChildren(
        h('div', { class: 'muted small' }, `Tanko ${st.bar} ${U()}, levyt per puoli:`),
        h('div', { style: 'font-size:20px;font-weight:700;margin-top:4px' }, used.length ? used.join(' + ') : 'Ei levyjä'),
        rem > 0.01 ? h('div', { class: 'err small', style: 'margin-top:6px' }, `Jää ${round2(rem)} ${U()} per puoli – ei saatavilla olevilla levyillä.`) : null);
    };
    inp.addEventListener('input', calc);
    calc();
    return h('div', {},
      h('h2', {}, 'Levytyslaskuri'),
      h('label', {}, `Tavoitepaino (${U()})`), inp, out,
      h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => close(null) }, 'Sulje')));
  });
}
