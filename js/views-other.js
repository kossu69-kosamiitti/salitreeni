// Muu kuorma: juoksut, sähly yms.
import { db } from './db.js';
import { h, uid, dayKey, keyToTs, fmtDate } from './util.js';
import { S, render, toast } from './state.js';
import { SPORTS } from './data.js';
import { activityRow } from './views-history.js';

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
    h('h2', { style: 'margin-top:0' }, 'Lisää liikuntaa'),
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
