// Asetukset: yksiköt, ohjelmat, liikkeet, Oura, varmuuskopio
import { db, kvSet, STORE_NAMES } from './db.js';
import { h, uid, fmtDate, downloadBlob, dayKey, mmss, parseMMSS } from './util.js';
import { DEFAULT_SETTINGS, LB_DEFAULTS, KG_DEFAULTS } from './data.js';
import {
  S, render, loadAll, saveSettings, saveOura, U, exName, exercisesSorted, modal, confirmBox, toast, pickExercise, newExerciseDialog,
} from './state.js';
import * as oura from './oura.js';

// ---------- Treenipohja ----------
async function editTemplate(tpl) {
  const t = tpl ? JSON.parse(JSON.stringify(tpl)) : { id: uid(), name: '', order: Math.max(-1, ...S.templates.map((x) => x.order)) + 1, items: [] };
  return modal((close) => {
    const name = h('input', { value: t.name, placeholder: 'esim. Treeni A', oninput: (e) => (t.name = e.target.value) });
    const list = h('div');
    const draw = () => {
      list.replaceChildren();
      t.items.forEach((it, i) => {
        const restVal = (it.rests && it.rests[0]) || it.rest || S.settings.rest;
        list.append(h('div', { class: 'tpl-item' },
          h('div', { class: 'row between' },
            h('b', {}, exName(it.exId)),
            h('span', { class: 'row', style: 'gap:2px' },
              h('button', { class: 'small ghost', disabled: i === 0, onclick: () => { [t.items[i - 1], t.items[i]] = [t.items[i], t.items[i - 1]]; draw(); } }, '↑'),
              h('button', { class: 'small ghost', disabled: i === t.items.length - 1, onclick: () => { [t.items[i + 1], t.items[i]] = [t.items[i], t.items[i + 1]]; draw(); } }, '↓'),
              h('button', { class: 'small ghost', onclick: () => { t.items.splice(i, 1); draw(); } }, '✕'))),
          h('div', { class: 'grid3' },
            h('div', {}, h('label', {}, 'Sarjat'), h('input', { type: 'number', inputmode: 'numeric', value: it.sets, oninput: (e) => (it.sets = parseInt(e.target.value, 10) || 0) })),
            h('div', {}, h('label', {}, 'Toistot'), h('input', { value: it.reps, oninput: (e) => (it.reps = e.target.value) })),
            h('div', {}, h('label', {}, 'Lepo (m:ss)'), h('input', { value: mmss(restVal), inputmode: 'numeric', onchange: (e) => {
              const sec = parseMMSS(e.target.value);
              if (sec) { it.rest = sec; delete it.rests; }
              e.target.value = mmss(sec || restVal);
            } })))));
      });
      if (!t.items.length) list.append(h('p', { class: 'muted small' }, 'Ei liikkeitä vielä.'));
    };
    draw();
    return h('div', {},
      h('h2', {}, tpl ? 'Muokkaa treeniä' : 'Uusi treeni'),
      h('div', { class: 'field' }, h('label', {}, 'Nimi'), name),
      list,
      h('button', { class: 'big', style: 'margin-top:10px', onclick: async () => {
        const id = await pickExercise();
        if (id) { t.items.push({ exId: id, sets: 3, reps: '8', rest: S.settings.rest }); draw(); }
      } }, '+ Lisää liike'),
      h('div', { class: 'actions' },
        h('button', { onclick: () => close(false) }, 'Peruuta'),
        h('button', { class: 'primary', onclick: async () => {
          if (!t.name.trim()) return toast('Anna treenille nimi');
          t.name = t.name.trim();
          await db.put('templates', t);
          const i = S.templates.findIndex((x) => x.id === t.id);
          if (i >= 0) S.templates[i] = t; else S.templates.push(t);
          close(true);
          render();
        } }, 'Tallenna')),
      tpl ? h('button', { class: 'danger ghost big', style: 'margin-top:8px', onclick: async () => {
        if (!(await confirmBox(`Poistetaanko treeni "${tpl.name}"? Aiemmat kirjaukset säilyvät.`, 'Poista', true))) return;
        await db.del('templates', tpl.id);
        S.templates = S.templates.filter((x) => x.id !== tpl.id);
        close(true);
        render();
      } }, 'Poista treeni') : null);
  });
}

async function moveTemplate(t, dir) {
  const sorted = [...S.templates].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((x) => x.id === t.id);
  const j = i + dir;
  if (j < 0 || j >= sorted.length) return;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  for (let k = 0; k < sorted.length; k++) {
    sorted[k].order = k;
    await db.put('templates', sorted[k]);
  }
  render();
}

// ---------- Liikkeet ----------
function manageExercises() {
  return modal((close) => {
    const list = h('div');
    const draw = () => {
      list.replaceChildren();
      let g = null;
      exercisesSorted().forEach((e) => {
        if (e.group !== g) { g = e.group; list.append(h('div', { class: 'grouphd' }, g)); }
        const used = S.sessions.some((s) => s.entries.some((x) => x.exId === e.id)) || S.templates.some((t) => t.items.some((x) => x.exId === e.id));
        list.append(h('div', { class: 'row between', style: 'padding:4px 0' }, h('span', {}, e.name),
          e.custom ? h('button', { class: 'small ghost danger', onclick: async () => {
            if (used) return toast('Liike on käytössä treeneissä tai pohjissa, joten sitä ei voi poistaa');
            await db.del('exercises', e.id);
            S.exercises = S.exercises.filter((x) => x.id !== e.id);
            draw();
          } }, 'Poista') : h('span', { class: 'muted small' }, 'valmis')));
      });
    };
    draw();
    return h('div', {}, h('h2', {}, 'Liikkeet'),
      h('button', { class: 'primary big', onclick: async () => { if (await newExerciseDialog('')) draw(); } }, '+ Uusi liike'),
      list, h('div', { class: 'actions' }, h('button', { onclick: () => close(true) }, 'Sulje')));
  });
}

// ---------- Varmuuskopio ----------
async function buildBackup() {
  const out = { app: 'salitreeni', version: 1, exported: new Date().toISOString() };
  for (const s of ['exercises', 'templates', 'sessions', 'activities', 'body']) out[s] = await db.all(s);
  out.settings = { ...S.settings };
  out.ouraDays = S.oura.days;
  return out;
}
const backupName = () => `salitreeni-varmuuskopio-${dayKey(Date.now())}.json`;

async function markBackup() {
  S.lastBackup = Date.now();
  await kvSet('lastBackup', S.lastBackup);
}

async function exportBackup() {
  const blob = new Blob([JSON.stringify(await buildBackup(), null, 2)], { type: 'application/json' });
  downloadBlob(blob, backupName());
  await markBackup();
  toast('Varmuuskopio ladattu');
  render();
}

async function shareBackup() {
  const file = new File([JSON.stringify(await buildBackup(), null, 2)], backupName(), { type: 'application/json' });
  try {
    await navigator.share({ files: [file], title: 'Salitreeni-varmuuskopio' });
    await markBackup();
    render();
  } catch (e) {
    if (e.name !== 'AbortError') toast('Jakaminen ei onnistunut, käytä latausta');
  }
}

async function importBackup(file) {
  let j;
  try {
    j = JSON.parse(await file.text());
  } catch {
    return toast('Tiedosto ei ole kelvollinen varmuuskopio');
  }
  if (j.app !== 'salitreeni') return toast('Tämä ei ole Salitreeni-varmuuskopio');
  if (!(await confirmBox(`Korvataanko nykyiset tiedot varmuuskopiolla? (${(j.sessions || []).length} treeniä, ${(j.activities || []).length} muuta liikuntaa)`, 'Korvaa', true))) return;
  for (const s of ['exercises', 'templates', 'sessions', 'activities', 'body']) {
    await db.clear(s);
    await db.putMany(s, j[s] || []);
  }
  if (j.settings) await kvSet('settings', { ...DEFAULT_SETTINGS, ...j.settings });
  await kvSet('seeded', true);
  await loadAll();
  if (j.ouraDays) { S.oura.days = j.ouraDays; await saveOura(); }
  render();
  toast('Tiedot tuotu');
}

// ---------- Näkymä ----------
export function renderSettings() {
  const st = S.settings;
  const num = (key, label) => h('div', { class: 'field' }, h('label', {}, label),
    h('input', { type: 'number', inputmode: 'decimal', step: 'any', value: st[key], onchange: async (e) => { st[key] = parseFloat(e.target.value) || 0; await saveSettings(); toast('Tallennettu'); } }));
  const connected = oura.isConnected(S.oura.auth);
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden', onchange: (e) => e.target.files[0] && importBackup(e.target.files[0]) });
  const tpls = [...S.templates].sort((a, b) => a.order - b.order);

  return h('div', {},
    h('h1', {}, 'Asetukset'),

    h('h2', { style: 'margin-top:0' }, 'Treenipohjat'),
    h('div', { class: 'muted small', style: 'margin-bottom:8px' }, 'Treenit kiertävät tässä järjestyksessä: sovellus ehdottaa aina seuraavaa.'),
    h('div', { class: 'card' },
      tpls.map((t, i) => h('div', { class: 'row', style: 'padding:6px 0;border-top:' + (i ? '1px solid var(--line)' : '0') },
        h('div', { class: 'grow' }, h('b', {}, t.name), h('div', { class: 'muted small' }, t.items.map((x) => exName(x.exId)).join(', '))),
        h('button', { class: 'small ghost', disabled: i === 0, onclick: () => moveTemplate(t, -1) }, '↑'),
        h('button', { class: 'small ghost', disabled: i === tpls.length - 1, onclick: () => moveTemplate(t, 1) }, '↓'),
        h('button', { class: 'small', onclick: () => editTemplate(t) }, 'Muokkaa'))),
      h('button', { class: 'primary big', style: 'margin-top:10px', onclick: () => editTemplate(null) }, '+ Uusi treeni'),
      h('button', { class: 'big', style: 'margin-top:8px', onclick: manageExercises }, 'Hallitse liikkeitä')),

    h('h2', {}, 'Yksiköt ja ajastin'),
    h('div', { class: 'card' },
      h('div', { class: 'field' }, h('label', {}, 'Painoyksikkö'),
        h('select', { onchange: async (e) => {
          st.unit = e.target.value;
          Object.assign(st, st.unit === 'lb' ? LB_DEFAULTS : KG_DEFAULTS);
          await saveSettings();
          render();
        } }, h('option', { value: 'kg', selected: st.unit === 'kg' }, 'Kilogrammat (kg)'), h('option', { value: 'lb', selected: st.unit === 'lb' }, 'Paunat (lb)'))),
      num('step', `Painon askel + / − napeissa (${U()})`),
      num('rest', 'Lepoajastin (sekuntia)'),
      num('bar', `Tangon paino (${U()})`),
      h('div', { class: 'field' }, h('label', {}, `Käytettävissä olevat levyt per puoli (${U()}, pilkulla erotettuna)`),
        h('input', { value: st.plates.join(', '), onchange: async (e) => {
          const p = e.target.value.split(/[,\s]+/).map((x) => parseFloat(x.replace(',', '.'))).filter((x) => x > 0);
          if (p.length) { st.plates = p; await saveSettings(); toast('Tallennettu'); }
        } }))),

    h('h2', {}, 'Oura'),
    h('div', { class: 'card' },
      connected
        ? [h('div', { class: 'ok' }, 'Yhdistetty'), h('div', { class: 'muted small' }, 'Kirjautuminen voimassa ' + fmtDate(S.oura.auth.expires) + ' asti.'),
          h('button', { class: 'big', style: 'margin-top:10px', onclick: async () => { S.oura.auth = null; await saveOura(); render(); } }, 'Katkaise yhteys')]
        : [h('div', { class: 'muted small', style: 'margin-bottom:10px' },
            '1. Luo ilmainen sovellus osoitteessa cloud.ouraring.com/oauth/applications',
            h('br'), '2. Lisää sinne Redirect URI:ksi:', h('br'), h('code', {}, oura.redirectUri()),
            h('br'), '3. Liitä alle sovelluksen Client ID ja paina Yhdistä.'),
          h('div', { class: 'field' }, h('label', {}, 'Client ID'),
            h('input', { value: st.ouraClientId || '', autocapitalize: 'off', onchange: async (e) => { st.ouraClientId = e.target.value.trim(); await saveSettings(); } })),
          h('button', { class: 'primary big', onclick: () => {
            if (!st.ouraClientId) return toast('Syötä ensin Client ID');
            oura.connect(st.ouraClientId);
          } }, 'Yhdistä Oura')]),

    h('h2', {}, 'Varmuuskopio'),
    h('div', { class: 'card' },
      h('div', { class: 'muted small', style: 'margin-bottom:10px' }, 'Tiedot ovat vain tässä puhelimessa. Viimeisin varmuuskopio: ' + (S.lastBackup ? fmtDate(S.lastBackup) : 'ei koskaan') + '.'),
      h('button', { class: 'primary big', onclick: exportBackup }, 'Vie varmuuskopio (JSON)'),
      navigator.canShare ? h('button', { class: 'big', style: 'margin-top:8px', onclick: shareBackup }, 'Jaa / tallenna Driveen') : null,
      h('button', { class: 'big', style: 'margin-top:8px', onclick: () => fileIn.click() }, 'Tuo varmuuskopio'),
      fileIn),

    h('h2', {}, 'Vaaravyöhyke'),
    h('button', { class: 'danger big', onclick: async () => {
      if (!(await confirmBox('Poistetaanko KAIKKI tiedot tästä laitteesta? Tätä ei voi perua.', 'Poista kaikki', true))) return;
      for (const s of STORE_NAMES) await db.clear(s);
      location.reload();
    } }, 'Poista kaikki tiedot'),
    h('p', { class: 'muted small', style: 'margin-top:16px' }, 'Salitreeni 1.0 · tiedot tallennetaan paikallisesti IndexedDB-tietokantaan.'));
}
