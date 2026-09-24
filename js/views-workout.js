// Treeni-välilehti: seuraava treeni vuorossa, sarjarivit (jokainen sarja kuitataan erikseen), lepoajastin
import { db } from './db.js';
import { h, uid, fmtDate, mmss, parseMMSS } from './util.js';
import {
  S, render, saveActive, U, toDisp, toKg, round2, fmtW, est1rm, exById, exName,
  sortedSessions, lastEntryFor, lastNEntriesFor, bestFor, sessionStats, modal, confirmBox, toast, pickExercise, editExerciseDialog,
} from './state.js';
import { exerciseDetailModal } from './views-exercise.js';

// Liikkeen nimi tekstinä, klikattava -> avaa liikkeen tiedot/historia-näkymä.
function exLink(id) {
  const ex = exById(id);
  return ex ? h('button', { class: 'lnk', onclick: () => exerciseDetailModal(ex) }, ex.name) : h('span', {}, exName(id));
}

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

// Tavoitetoistot treenipohjassa voi olla kiinteä luku ("5") tai toistoväli ("8-12").
// Kiinteä luku = väli jossa min===max.
function parseRepRange(targetReps) {
  const s = (targetReps || '').trim();
  const range = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) return { min: parseInt(range[1], 10), max: parseInt(range[2], 10) };
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? { min: n, max: n } : null;
}

// Luo valmiit sarjarivit, esitäytetty PROGRESSIOEHDOTUKSELLA (per sarjaindeksi erikseen, jolloin
// esim. kärkisarja ja kevyemmät jatkosarjat etenevät toisistaan riippumatta - kumpikin katsoo
// vain omaa historiaansa samassa sarjaindeksissä):
// - kiinteä toistotavoite (esim. "5"): kuten ennenkin - tavoite pysyy samana, paino nousee yhden
//   korotusaskelen kun tavoite on saavutettu tai ylitetty, muuten paino pysyy.
// - toistoväli (esim. "8-12"): jos edellinen kerta oli välin YLÄRAJALLA tai yli, nosta paino yhdellä
//   korotusaskelella ja palaa välin ALARAJAAN; muuten pidä paino samana ja ehdota +1 toisto
//   edelliseen nähden (ei ylitä ylärajaa).
// - vapaassa treenissä / ei tavoitetta: jos viimeksi toistoja oli saman verran tai enemmän kuin
//   sitä edeltävällä kerralla, ehdota +askel painoa; muuten samaa painoa/toistoja.
function buildSets(exId, count, targetReps, item) {
  const [prev, prev2] = lastNEntriesFor(exId, 2);
  const n = count || (prev ? prev.sets.length : 3);
  const range = parseRepRange(targetReps);
  const step = toKg(S.settings.step);
  return Array.from({ length: n }, (_, i) => {
    const p = prev ? prev.sets[i] || prev.sets[prev.sets.length - 1] : null;
    const p2 = prev2 ? prev2.sets[i] || prev2.sets[prev2.sets.length - 1] : null;
    let w = p ? p.w : 0;
    let r = p ? p.r : (range ? range.min : 8);
    if (p) {
      if (range) {
        if (range.min === range.max) {
          r = range.max;
          w = p.r >= range.max ? round2(p.w + step) : p.w;
        } else if (p.r >= range.max) {
          w = round2(p.w + step);
          r = range.min;
        } else {
          w = p.w;
          r = Math.min(p.r + 1, range.max);
        }
      } else if (p2) {
        r = p.r;
        w = p.r >= p2.r ? round2(p.w + step) : p.w;
      }
    }
    return { w, r, rest: restFrom(item, i), done: false };
  });
}

async function startSession(tpl) {
  S.active = {
    id: uid(),
    templateId: tpl ? tpl.id : null,
    name: tpl ? tpl.name : 'Vapaa treeni',
    start: Date.now(),
    note: '',
    // Muistiinpano esitäytetään automaattisesti liikkeen edellisestä kirjauksesta (esim. "raskas päivä",
    // vinkki tekniikasta) - muokattavissa/tyhjennettävissä normaalisti, jos ei relevantti tällä kertaa.
    entries: tpl
      ? tpl.items.map((it) => ({ exId: it.exId, note: (lastEntryFor(it.exId) || {}).note || '', sets: buildSets(it.exId, it.sets, it.reps, it) }))
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

function homeView() {
  if (S.active) {
    // vanhan muotoinen keskeneräinen treeni (ennen päivitystä) siivotaan pois
    S.active = null;
    saveActive();
  }
  const next = nextTemplate();
  const last = sortedSessions().pop();
  const v = h('div', {}, h('h1', {}, 'Treeni'));

  if (next) {
    v.append(h('div', { class: 'card' },
      h('div', { class: 'small muted' }, 'Seuraavaksi vuorossa'),
      h('h1', { style: 'margin:2px 0 8px' }, next.name),
      h('div', { class: 'muted small', style: 'margin-bottom:12px' },
        next.items.flatMap((it, i) => [i ? ' · ' : null, exLink(it.exId), ` ${it.sets}×${it.reps}`])),
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
          `${st.sets} sarjaa · ${st.reps} toistoa`)));
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
      h('h2', {}, h('button', { class: 'lnk', onclick: act(async () => { const ex = exById(en.exId); if (ex) exerciseDetailModal(ex); }) }, exName(en.exId))),
      h('button', { class: 'pick', onclick: act(() => noteDialog(en)) }, 'Muistiinpano'),
      h('button', { class: 'pick', onclick: act(() => editRest(en, 0)) }, 'Lepoaika (kaikille sarjoille)'),
      h('button', { class: 'pick', onclick: act(async () => {
        const ex = exById(en.exId);
        if (!ex) return;
        if (await editExerciseDialog(ex)) render();
      }) }, 'Muokkaa liikkeen tietoja'),
      h('button', { class: 'pick', onclick: act(async () => {
        if (en.sets.some((s) => s.done)) return toast('Peru ensin kuitatut sarjat');
        const id = await pickExercise();
        if (!id) return;
        en.exId = id;
        en.note = (lastEntryFor(id) || {}).note || '';
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

// Siirtää liikkeen käynnissä olevan treenin sisällä - uusi järjestys tallentuu myös treenipohjaan
// kun treeni lopetetaan, jos treenipohjan poikkeama-kysely (finish()) niin päättää.
function moveEntry(en, dir) {
  const arr = S.active.entries;
  const i = arr.indexOf(en);
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  saveActive();
  render();
}

function entryBlock(en) {
  const prev = lastEntryFor(en.exId);
  const ex = exById(en.exId);
  const i = S.active.entries.indexOf(en);
  const block = h('section', { class: 'ex' },
    h('div', { class: 'exh' },
      ex
        ? h('button', { class: 'exn exn-link', onclick: () => exerciseDetailModal(ex) }, ex.name)
        : h('span', { class: 'exn' }, '(poistettu liike)'),
      h('span', { class: 'row', style: 'gap:2px' },
        h('button', { class: 'small ghost', 'aria-label': 'Siirrä ylös', disabled: i === 0, onclick: () => moveEntry(en, -1) }, '↑'),
        h('button', { class: 'small ghost', 'aria-label': 'Siirrä alas', disabled: i === S.active.entries.length - 1, onclick: () => moveEntry(en, 1) }, '↓'),
        h('button', { class: 'more', 'aria-label': 'Liikkeen valikko', onclick: () => exMenu(en) }, '⋯'))),
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
        a.entries.push({ exId: id, note: (lastEntryFor(id) || {}).note || '', sets: buildSets(id, 0, '8', null) });
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

// Poikkesiko tehty treeni pohjastaan (eri liikkeet, eri järjestys tai eri sarjamäärä)?
// Sarjamäärä verrataan kaikkiin lisättyihin sarjoihin (myös kuittaamattomiin), jotta yksittäinen
// unohtunut kuittaus ei näytä väärin poikkeamana.
function templateDeviates(tpl, entries) {
  if (tpl.items.length !== entries.length) return true;
  return tpl.items.some((it, i) => it.exId !== entries[i].exId || it.sets !== entries[i].sets.length);
}

// Päivittää treenipohjan liikkeet/järjestyksen/sarjamäärän vastaamaan tehtyä treeniä.
// Toistotavoite, lepoajat jne. säilytetään ennallaan liikkeille jotka olivat pohjassa jo valmiiksi.
async function syncTemplateFromSession(tpl, entries) {
  tpl.items = entries.map((e) => {
    const existing = tpl.items.find((it) => it.exId === e.exId);
    return existing ? { ...existing, sets: e.sets.length } : { exId: e.exId, sets: e.sets.length, reps: '8', rest: S.settings.rest };
  });
  await db.put('templates', tpl);
  const i = S.templates.findIndex((t) => t.id === tpl.id);
  if (i >= 0) S.templates[i] = tpl;
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

  const tpl = a.templateId ? S.templates.find((t) => t.id === a.templateId) : null;
  if (tpl && templateDeviates(tpl, done)) {
    const sync = await confirmBox(
      'Treeni poikkesi pohjasta (liikkeet, järjestys tai sarjamäärä eri kuin pohjassa). Päivitetäänkö treenipohja vastaamaan tätä kertaa, jotta ehdotukset ovat oikein seuraavalla kerralla?',
      'Päivitä pohja'
    );
    if (sync) await syncTemplateFromSession(tpl, done);
  }

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
  s.entries.forEach((e) => e.sets.forEach((x) => x.pr && prs.push({ exId: e.exId, w: x.w, r: x.r })));
  modal((close) => h('div', {},
    h('h2', {}, 'Treeni tallennettu'),
    h('div', { class: 'statrow', style: 'grid-template-columns:repeat(3,1fr)' },
      h('div', { class: 'stat' }, h('b', {}, Math.max(1, Math.round((s.end - s.start) / 60000))), h('span', {}, 'min')),
      h('div', { class: 'stat' }, h('b', {}, st.sets), h('span', {}, 'sarjaa')),
      h('div', { class: 'stat' }, h('b', {}, st.reps), h('span', {}, 'toistoa'))),
    prs.length ? h('div', { style: 'margin-top:14px' }, h('b', {}, 'Ennätykset'),
      prs.map((p) => h('div', {}, h('span', { class: 'pr' }, 'PR'), ' ', exLink(p.exId), ` ${fmtW(p.w)} ${U()} × ${p.r}`))) : null,
    h('div', { class: 'actions' }, h('button', { class: 'primary', onclick: () => close(true) }, 'Valmis'))));
}
