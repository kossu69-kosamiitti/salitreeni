// Jaettu tila, yksikkömuunnokset, historiahaut sekä modaalit
import { db, kvGet, kvSet } from './db.js';
import { h, uid } from './util.js';
import { SEED_EXERCISES, SEED_TEMPLATES, DEFAULT_SETTINGS, GROUPS } from './data.js';

export const S = {
  exercises: [],
  templates: [],
  sessions: [],
  activities: [],
  body: [],
  settings: { ...DEFAULT_SETTINGS },
  active: null, // käynnissä oleva treeni (säilyy sovelluksen sulkemisen yli)
  lastBackup: 0,
  ui: { tab: 'workout', calMonth: new Date(), selDay: null, progEx: null, progMode: '1rm' },
};

let renderFn = () => {};
export const setRender = (f) => (renderFn = f);
export const render = () => renderFn();

export async function loadAll() {
  if (!(await kvGet('seeded', false))) {
    await db.putMany('exercises', SEED_EXERCISES);
    await db.putMany('templates', SEED_TEMPLATES);
    await kvSet('seeded', true);
  }
  for (const s of ['exercises', 'templates', 'sessions', 'activities', 'body']) S[s] = await db.all(s);
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

export function lastEntryFor(exId) {
  const list = sortedSessions().filter((s) => s.entries.some((e) => e.exId === exId && e.sets.length));
  const s = list[list.length - 1];
  return s ? { date: s.start, ...s.entries.find((e) => e.exId === exId) } : null;
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
  let tonnage = 0;
  s.entries.forEach((e) =>
    e.sets.forEach((x) => {
      sets++;
      tonnage += x.w * x.r;
    })
  );
  return { sets, tonnage };
};

export function exercisesSorted(list = S.exercises) {
  return [...list].sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.name.localeCompare(b.name, 'fi'));
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

export function newExerciseDialog(name = '') {
  return modal((close) => {
    const n = h('input', { value: name, placeholder: 'Liikkeen nimi' });
    const g = h('select', {}, GROUPS.map((x) => h('option', { value: x }, x)));
    return h('div', {},
      h('h2', {}, 'Uusi liike'),
      h('div', { class: 'field' }, h('label', {}, 'Nimi'), n),
      h('div', { class: 'field' }, h('label', {}, 'Lihasryhmä'), g),
      h('div', { class: 'actions' },
        h('button', { onclick: () => close(null) }, 'Peruuta'),
        h('button', {
          class: 'primary',
          onclick: async () => {
            const nm = n.value.trim();
            if (!nm) return toast('Anna liikkeelle nimi');
            const ex = { id: uid(), name: nm, group: g.value, custom: true };
            await db.put('exercises', ex);
            S.exercises.push(ex);
            close(ex.id);
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
        if (e.group !== g) {
          g = e.group;
          list.append(h('div', { class: 'grouphd' }, g));
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
