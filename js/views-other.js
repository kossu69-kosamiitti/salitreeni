// Muu kuorma: juoksut, sähly yms. sekä Oura-yhteenveto
import { db } from './db.js';
import { h, uid, dayKey, keyToTs, fmtDate } from './util.js';
import { S, render, saveOura, toast } from './state.js';
import { SPORTS } from './data.js';
import { activityRow } from './views-history.js';
import * as oura from './oura.js';

let syncing = false;
let syncMsg = '';

export async function syncOura({ silent = false } = {}) {
  if (syncing || !oura.isConnected(S.oura.auth)) return;
  syncing = true;
  syncMsg = 'Haetaan tietoja Ourasta…';
  if (!silent) render();
  try {
    const res = await oura.sync(S.oura.auth.token, 30);
    const known = new Set(S.activities.filter((a) => a.ouraId).map((a) => a.ouraId));
    const dismissed = new Set(S.oura.dismissed || []);
    let added = 0;
    for (const w of res.workouts) {
      if (known.has(w.ouraId) || dismissed.has(w.ouraId)) continue;
      const a = { id: uid(), ts: w.ts, sport: w.sport, minutes: w.minutes, note: '', source: 'oura', ouraId: w.ouraId, calories: w.calories, distance: w.distance };
      await db.put('activities', a);
      S.activities.push(a);
      added++;
    }
    S.oura.days = { ...S.oura.days, ...res.days };
    S.oura.last = Date.now();
    await saveOura();
    syncMsg = `Päivitetty. Uusia treenejä: ${added}.`;
  } catch (e) {
    if (e.message === 'AUTH') {
      S.oura.auth = null;
      await saveOura();
      syncMsg = 'Oura-kirjautuminen on vanhentunut. Yhdistä uudelleen Asetuksissa.';
    } else if (e.message === 'CORS') {
      syncMsg = 'Selain esti pyynnön Ouran palvelimelle (CORS) tai verkkoyhteys puuttuu. Katso README: tarvittaessa käytetään pientä välipalvelinta.';
    } else {
      syncMsg = 'Oura-haku epäonnistui: ' + e.message;
    }
    if (silent) syncMsg = '';
  } finally {
    syncing = false;
    if (!silent || syncMsg) render();
  }
}

function ouraSection() {
  const connected = oura.isConnected(S.oura.auth);
  if (!connected) {
    return h('div', { class: 'card' },
      h('b', {}, 'Oura'),
      h('p', { class: 'muted small' }, 'Yhdistä Oura-rengas, niin palautuminen, uni, HRV ja Ouran kirjaamat treenit tulevat tänne automaattisesti. Yhteys tehdään Asetukset-välilehdellä.'),
      syncMsg ? h('p', { class: 'err small' }, syncMsg) : null);
  }
  const keys = Object.keys(S.oura.days || {}).sort().slice(-7).reverse();
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('b', {}, 'Oura'),
      h('button', { class: 'small', disabled: syncing, onclick: () => syncOura() }, syncing ? 'Päivitetään…' : 'Päivitä')),
    syncMsg ? h('div', { class: 'small ' + (syncMsg.startsWith('Päivitetty') ? 'ok' : 'muted'), style: 'margin-top:6px' }, syncMsg) : null,
    keys.length ? h('table', { style: 'margin-top:8px' },
      h('tr', {}, h('th', {}, 'Päivä'), h('th', { class: 'r' }, 'Palaut.'), h('th', { class: 'r' }, 'Uni'), h('th', { class: 'r' }, 'HRV'), h('th', { class: 'r' }, 'Leposyke')),
      keys.map((k) => {
        const d = S.oura.days[k];
        return h('tr', {}, h('td', {}, k.slice(8) + '.' + k.slice(5, 7) + '.'),
          h('td', { class: 'r' }, d.readiness ?? '–'), h('td', { class: 'r' }, d.sleep ?? '–'), h('td', { class: 'r' }, d.hrv ?? '–'), h('td', { class: 'r' }, d.rhr ?? '–'));
      })) : h('p', { class: 'muted small' }, 'Ei vielä tietoja – paina Päivitä.'),
    h('div', { class: 'muted small', style: 'margin-top:8px' }, 'Palaut. = Readiness-pisteet. Voimaharjoittelu jätetään tuomatta, koska kirjaat sen itse.'));
}

export function renderOther() {
  const sport = h('select', {}, SPORTS.map((s) => h('option', { value: s }, s)));
  const custom = h('input', { placeholder: 'Lajin nimi', class: 'hidden', style: 'margin-top:8px' });
  sport.addEventListener('change', () => custom.classList.toggle('hidden', sport.value !== 'Muu'));
  const date = h('input', { type: 'date', value: dayKey(Date.now()) });
  const mins = h('input', { type: 'number', inputmode: 'numeric', min: '1', placeholder: 'esim. 60' });
  const note = h('input', { placeholder: 'Valinnainen muistiinpano' });

  const list = [...S.activities].sort((a, b) => b.ts - a.ts).slice(0, 25);
  return h('div', {},
    h('h1', {}, 'Muu kuorma'),
    ouraSection(),
    h('h2', {}, 'Lisää liikuntaa'),
    h('div', { class: 'card' },
      h('div', { class: 'field' }, h('label', {}, 'Laji'), sport, custom),
      h('div', { class: 'grid2' },
        h('div', { class: 'field' }, h('label', {}, 'Päivä'), date),
        h('div', { class: 'field' }, h('label', {}, 'Kesto (min)'), mins)),
      h('div', { class: 'field' }, h('label', {}, 'Muistiinpano'), note),
      h('button', {
        class: 'primary big',
        onclick: async () => {
          const m = parseInt(mins.value, 10);
          const name = sport.value === 'Muu' ? custom.value.trim() || 'Muu' : sport.value;
          if (!(m > 0)) return toast('Syötä kesto minuutteina');
          const a = { id: uid(), ts: keyToTs(date.value || dayKey(Date.now())), sport: name, minutes: m, note: note.value.trim(), source: 'manual' };
          await db.put('activities', a);
          S.activities.push(a);
          toast('Tallennettu');
          render();
        },
      }, 'Tallenna')),
    h('h2', {}, 'Viimeisimmät'),
    list.length ? h('div', { class: 'card' }, list.map((a) => h('div', {}, h('div', { class: 'muted small' }, fmtDate(a.ts)), activityRow(a))))
      : h('p', { class: 'muted' }, 'Ei vielä merkintöjä.'));
}
