// Jaettu tila, yksikkömuunnokset, historiahaut sekä modaalit
import { db, kvGet, kvSet } from './db.js';
import { h, uid } from './util.js';
import { SEED_EXERCISES, SEED_TEMPLATES, DEFAULT_SETTINGS, MUSCLES, muscleName } from './data.js';

export const S = {
  exercises: [],
  templates: [],
  sessions: [],
  body: [],
  settings: { ...DEFAULT_SETTINGS },
  active: null, // käynnissä oleva treeni (säilyy sovelluksen sulkemisen yli)
  lastBackup: 0,
  ui: { tab: 'workout', calMonth: new Date(), selDay: null, progEx: null, progMode: '1rm' },
};

let renderFn = () => {};
export const setRender = (f) => (renderFn = f);
export const render = () => renderFn();

// Vanhoissa liikkeissä/varmuuskopioissa secondary saattaa olla vielä pelkkiä id-merkkijonoja
// (['pakarat']) ilman painotusta - normalisoi aina {id, weight}-muotoon (oletus 0.5x).
export const normalizeSecondary = (secondary) =>
  (secondary || []).map((s) => (typeof s === 'string' ? { id: s, weight: 0.5 } : { id: s.id, weight: s.weight ?? 0.5 }));

const normalizeExercise = (e) => ({ ...e, secondary: normalizeSecondary(e.secondary) });

export async function loadAll() {
  if (!(await kvGet('seeded', false))) {
    await db.putMany('exercises', SEED_EXERCISES);
    await db.putMany('templates', SEED_TEMPLATES);
    await kvSet('seeded', true);
  }
  for (const s of ['exercises', 'templates', 'sessions', 'body']) S[s] = await db.all(s);
  S.exercises = S.exercises.map(normalizeExercise);
  S.settings = { ...DEFAULT_SETTINGS, ...(await kvGet('settings', {})) };
  S.active = await kvGet('active', null);
  S.lastBackup = await kvGet('lastBackup', 0);
}

export const saveSettings = () => kvSet('settings', S.settings);
export const saveActive = () => (S.active ? kvSet('active', S.active) : db.del('kv', 'active'));

// ---- Yksiköt: data tallennetaan aina kilogrammoina ----
export const U = () => S.settings.unit;
export const toDisp = (kg) => (U() === 'lb' ? kg * 2.20462 : kg);
export const toKg = (v) => (U() === 'lb' ? v / 2.20462 : v);
export const round2 = (v) => Math.round(v * 100) / 100;
export const fmtW = (kg) => String(round2(toDisp(kg)));
export const est1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30)); // Epley

// ---- Liikkeet ja historia ----
export const exById = (id) => S.exercises.find((e) => e.id === id);
export const exName = (id) => (exById(id) ? exById(id).name : '(poistettu liike)');
export const sortedSessions = () => [...S.sessions].sort((a, b) => a.start - b.start);

// Kaikki merkinnät tälle liikkeelle, vanhin ensin
export function entriesFor(exId) {
  return sortedSessions()
    .filter((s) => s.entries.some((e) => e.exId === exId && e.sets.length))
    .map((s) => ({ date: s.start, ...s.entries.find((e) => e.exId === exId) }));
}

export function lastEntryFor(exId) {
  const list = entriesFor(exId);
  return list.length ? list[list.length - 1] : null;
}

// n viimeisintä merkintää, uusin ensin
export function lastNEntriesFor(exId, n) {
  return entriesFor(exId).slice(-n).reverse();
}

// Liikkeen historiatilastot: viimeisin, ennätykset, kokonaismäärät
export function exerciseDetailStats(exId) {
  const entries = entriesFor(exId);
  let totalSets = 0;
  let totalReps = 0;
  let bestEver = null;
  let bestThisYear = null;
  let bestSet = null;
  const thisYear = new Date().getFullYear();
  entries.forEach((e) => {
    const y = new Date(e.date).getFullYear();
    e.sets.forEach((x) => {
      totalSets++;
      totalReps += x.r;
      if (!bestEver || x.w > bestEver.w) bestEver = { w: x.w, r: x.r, date: e.date };
      if (y === thisYear && (!bestThisYear || x.w > bestThisYear.w)) bestThisYear = { w: x.w, r: x.r, date: e.date };
      if (!bestSet || est1rm(x.w, x.r) > est1rm(bestSet.w, bestSet.r)) bestSet = { w: x.w, r: x.r, date: e.date };
    });
  });
  return {
    entries,
    last: entries.length ? entries[entries.length - 1] : null,
    bestEver, bestThisYear, bestSet, totalSets, totalReps,
    estimated1rm: bestSet ? est1rm(bestSet.w, bestSet.r) : 0,
  };
}

// Poistaa liikkeen KAIKEN sarjahistorian kaikista treeneistä pysyvästi (liike itse säilyy,
// samoin sen käyttö pohjissa). Jos treenistä ei jää tämän jälkeen yhtään liikettä jäljelle,
// koko tyhjäksi jäänyt treeni poistetaan myös. Palauttaa poistettujen sarjojen määrän.
export async function deleteExerciseHistory(exId) {
  let removedSets = 0;
  const kept = [];
  for (const s of S.sessions) {
    if (!s.entries.some((e) => e.exId === exId)) {
      kept.push(s);
      continue;
    }
    removedSets += s.entries.filter((e) => e.exId === exId).reduce((n, e) => n + e.sets.length, 0);
    const entries = s.entries.filter((e) => e.exId !== exId);
    if (entries.length) {
      const updated = { ...s, entries };
      await db.put('sessions', updated);
      kept.push(updated);
    } else {
      await db.del('sessions', s.id);
    }
  }
  S.sessions = kept;
  return removedSets;
}

// Parhaat aiemmat tulokset (historia + mahdolliset käynnissä olevan treenin sarjat)
export function bestFor(exId, extraSets = []) {
  let bw = 0;
  let b1 = 0;
  const eat = (set) => {
    bw = Math.max(bw, set.w);
    b1 = Math.max(b1, est1rm(set.w, set.r));
  };
  S.sessions.forEach((s) => s.entries.forEach((e) => e.exId === exId && e.sets.forEach(eat)));
  extraSets.forEach(eat);
  return { bw, b1 };
}

export const sessionStats = (s) => {
  let sets = 0;
  let reps = 0;
  s.entries.forEach((e) =>
    e.sets.forEach((x) => {
      sets++;
      reps += x.r;
    })
  );
  return { sets, reps };
};

const muscleOrder = MUSCLES.map((m) => m.id);
export function exercisesSorted(list = S.exercises) {
  return [...list].sort((a, b) => muscleOrder.indexOf(a.muscle) - muscleOrder.indexOf(b.muscle) || a.name.localeCompare(b.name, 'fi'));
}

// ---- Modaalit ----
export function modal(build) {
  const root = document.getElementById('modal-root');
  let done;
  const promise = new Promise((r) => (done = r));
  const ov = h('div', { class: 'overlay', onclick: (e) => e.target === ov && close(null) });
  const close = (v) => {
    ov.remove();
    done(v);
  };
  ov.append(h('div', { class: 'sheet' }, build(close)));
  root.append(ov);
  return promise;
}

export function confirmBox(msg, okLabel = 'Kyllä', danger = false) {
  return modal((close) =>
    h('div', {}, h('p', { style: 'font-size:17px;margin:4px 0 0' }, msg),
      h('div', { class: 'actions' },
        h('button', { onclick: () => close(false) }, 'Peruuta'),
        h('button', { class: danger ? 'danger' : 'primary', onclick: () => close(true) }, okLabel))
    )
  ).then((v) => !!v);
}

let toastT;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.add('hidden'), 2400);
}

// Avustavan lihaksen volyymipainotus-vaihtoehdot: kuinka suurella osalla sarjasta se hyvitetään.
const WEIGHT_OPTIONS = [0.25, 0.5, 0.75, 1];

// Ensisijainen lihas -select + avustavat lihakset -valinta (0-2, kullekin oma painotus),
// käytetään uuden liikkeen luonnissa ja olemassa olevan liikkeen muokkauksessa.
// initSecondary: [{id, weight}] (normalizeSecondary huolehtii vanhasta pelkkä-id-muodosta).
function muscleFields(initPrimary, initSecondary) {
  let primary = initPrimary || MUSCLES[0].id;
  const secondary = new Map(normalizeSecondary(initSecondary).map((s) => [s.id, s.weight]));
  const secWrap = h('div');
  const drawSec = () => {
    secWrap.replaceChildren(
      ...MUSCLES.filter((m) => m.id !== primary).map((m) => {
        const checked = secondary.has(m.id);
        return h('div', { style: 'margin-bottom:6px' },
          h('label', { class: 'row', style: 'font-size:13px;color:var(--text)' },
            h('input', {
              type: 'checkbox', style: 'width:auto;min-height:0', checked,
              onchange: (e) => {
                if (e.target.checked) {
                  if (secondary.size >= 2) { e.target.checked = false; return toast('Enintään 2 avustavaa lihasta'); }
                  secondary.set(m.id, 0.5);
                } else secondary.delete(m.id);
                drawSec();
              },
            }), `${m.name} (${m.parent})`),
          checked ? h('select', {
            style: 'margin-left:24px;margin-top:2px;width:auto;min-height:0;padding:4px 8px',
            onchange: (e) => secondary.set(m.id, parseFloat(e.target.value)),
          }, WEIGHT_OPTIONS.map((w) => h('option', { value: w, selected: secondary.get(m.id) === w },
            `${w}× volyymia${w === 0.5 ? ' (oletus)' : ''}`))) : null);
      })
    );
  };
  drawSec();
  const select = h('select', { onchange: (e) => { primary = e.target.value; secondary.delete(primary); drawSec(); } },
    MUSCLES.map((m) => h('option', { value: m.id, selected: m.id === primary }, `${m.name} (${m.parent})`)));
  return {
    field: h('div', {},
      h('div', { class: 'field' }, h('label', {}, 'Ensisijainen lihas'), select),
      h('div', { class: 'field' }, h('label', {}, 'Avustavat lihakset (0-2, valinnainen)'), secWrap)),
    get: () => ({ primary, secondary: [...secondary].map(([id, weight]) => ({ id, weight })) }),
  };
}

export function newExerciseDialog(name = '') {
  return modal((close) => {
    const n = h('input', { value: name, placeholder: 'Liikkeen nimi' });
    const mf = muscleFields();
    return h('div', {},
      h('h2', {}, 'Uusi liike'),
      h('div', { class: 'field' }, h('label', {}, 'Nimi'), n),
      mf.field,
      h('div', { class: 'actions' },
        h('button', { onclick: () => close(null) }, 'Peruuta'),
        h('button', {
          class: 'primary',
          onclick: async () => {
            const nm = n.value.trim();
            if (!nm) return toast('Anna liikkeelle nimi');
            const { primary, secondary } = mf.get();
            const ex = { id: uid(), name: nm, muscle: primary, secondary, custom: true };
            await db.put('exercises', ex);
            S.exercises.push(ex);
            close(ex.id);
          },
        }, 'Tallenna'))
    );
  });
}

// Muokkaa olemassa olevan liikkeen nimeä ja lihaksia (myös valmiit 38 liikettä).
export function editExerciseDialog(ex) {
  if (!ex) return Promise.resolve(null);
  return modal((close) => {
    const n = h('input', { value: ex.name, placeholder: 'Liikkeen nimi' });
    const mf = muscleFields(ex.muscle, ex.secondary);
    return h('div', {},
      h('h2', {}, 'Muokkaa liikettä'),
      h('div', { class: 'field' }, h('label', {}, 'Nimi'), n),
      mf.field,
      h('div', { class: 'actions' },
        h('button', { onclick: () => close(null) }, 'Peruuta'),
        h('button', {
          class: 'primary',
          onclick: async () => {
            const nm = n.value.trim();
            if (!nm) return toast('Anna liikkeelle nimi');
            const { primary, secondary } = mf.get();
            ex.name = nm;
            ex.muscle = primary;
            ex.secondary = secondary;
            await db.put('exercises', ex);
            toast('Tallennettu');
            close(true);
          },
        }, 'Tallenna'))
    );
  });
}

export function pickExercise() {
  return modal((close) => {
    let q = '';
    const list = h('div');
    const draw = () => {
      list.replaceChildren();
      const items = exercisesSorted(S.exercises.filter((e) => e.name.toLowerCase().includes(q)));
      let g = null;
      for (const e of items) {
        if (e.muscle !== g) {
          g = e.muscle;
          list.append(h('div', { class: 'grouphd' }, muscleName(g)));
        }
        list.append(h('button', { class: 'pick', onclick: () => close(e.id) }, e.name));
      }
      if (!items.length) list.append(h('p', { class: 'muted' }, 'Ei osumia.'));
    };
    draw();
    return h('div', {},
      h('h2', {}, 'Valitse liike'),
      h('input', { placeholder: 'Hae liikettä…', oninput: (e) => { q = e.target.value.toLowerCase(); draw(); } }),
      h('div', { class: 'row', style: 'margin:10px 0' },
        h('button', { class: 'primary grow', onclick: async () => { const id = await newExerciseDialog(''); if (id) close(id); } }, '+ Uusi liike'),
        h('button', { onclick: () => close(null) }, 'Sulje')),
      list
    );
  });
}
