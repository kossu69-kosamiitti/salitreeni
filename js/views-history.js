// Historia: kalenteri (sali / muu kuorma / keho) ja päivän tiedot
import { db } from './db.js';
import { h, dayKey, fmtDate, fmtTime, WEEKDAYS, MONTHS } from './util.js';
import { S, render, U, fmtW, exName, exById, sessionStats, modal, confirmBox } from './state.js';
import { exerciseDetailModal } from './views-exercise.js';

function exLink(id) {
  const ex = exById(id);
  return ex ? h('button', { class: 'lnk', onclick: () => exerciseDetailModal(ex) }, ex.name) : h('span', {}, exName(id));
}

export function sessionModal(s) {
  const st = sessionStats(s);
  return modal((close) => h('div', {},
    h('h2', {}, s.name),
    h('div', { class: 'muted small', style: 'margin-bottom:10px' },
      `${fmtDate(s.start)} klo ${fmtTime(s.start)} · ${Math.max(1, Math.round((s.end - s.start) / 60000))} min · ${st.sets} sarjaa · ${st.reps} toistoa`),
    s.entries.map((e) => h('div', { style: 'margin-bottom:12px' },
      h('b', {}, exLink(e.exId)),
      h('div', {}, e.sets.map((x, i) => h('span', { style: 'margin-right:10px;white-space:nowrap' },
        `${fmtW(x.w)}×${x.r}`, x.pr ? h('span', { class: 'pr', style: 'margin-left:4px' }, 'PR') : null))),
      e.note ? h('div', { class: 'muted small' }, e.note) : null)),
    s.note ? h('div', { class: 'card small' }, s.note) : null,
    h('div', { class: 'actions' },
      h('button', {
        class: 'danger',
        onclick: async () => {
          if (!(await confirmBox('Poistetaanko tämä treeni pysyvästi?', 'Poista', true))) return;
          await db.del('sessions', s.id);
          S.sessions = S.sessions.filter((x) => x.id !== s.id);
          close(true);
          render();
        },
      }, 'Poista'),
      h('button', { class: 'primary', onclick: () => close(true) }, 'Sulje'))));
}

export function renderHistory() {
  const m = S.ui.calMonth;
  const y = m.getFullYear();
  const mo = m.getMonth();
  const offset = (new Date(y, mo, 1).getDay() + 6) % 7;
  const days = new Date(y, mo + 1, 0).getDate();
  const gym = new Set(S.sessions.map((s) => dayKey(s.start)));
  const body = new Set(S.body.map((b) => b.date));
  const today = dayKey(Date.now());
  const shift = (n) => {
    S.ui.calMonth = new Date(y, mo + n, 1);
    S.ui.selDay = null;
    render();
  };

  const cal = h('div', { class: 'cal' }, WEEKDAYS.map((w) => h('div', { class: 'wd' }, w)));
  for (let i = 0; i < offset; i++) cal.append(h('div', { class: 'blank' }));
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cal.append(h('button', {
      class: [key === today ? 'today' : '', key === S.ui.selDay ? 'sel' : ''].join(' '),
      onclick: () => { S.ui.selDay = S.ui.selDay === key ? null : key; render(); },
    }, h('span', {}, d),
      h('span', { class: 'dots' },
        gym.has(key) ? h('i', { class: 'dot gym' }) : null,
        body.has(key) ? h('i', { class: 'dot body' }) : null)));
  }

  // Kuukauden yhteenveto
  const prefix = `${y}-${String(mo + 1).padStart(2, '0')}`;
  const gymCount = S.sessions.filter((s) => dayKey(s.start).startsWith(prefix)).length;

  const v = h('div', {},
    h('h1', {}, 'Historia'),
    h('div', { class: 'row between', style: 'margin-bottom:10px' },
      h('button', { onclick: () => shift(-1), 'aria-label': 'Edellinen kuukausi' }, '‹'),
      h('b', { style: 'font-size:18px' }, `${MONTHS[mo]} ${y}`),
      h('button', { onclick: () => shift(1), 'aria-label': 'Seuraava kuukausi' }, '›')),
    cal,
    h('div', { class: 'legend' },
      h('span', {}, h('i', { style: 'background:var(--accent)' }), 'Salitreeni'),
      h('span', {}, h('i', { style: 'background:var(--gold)' }), 'Keho')),
    h('div', { class: 'muted small', style: 'margin-top:8px' }, `Tässä kuussa: ${gymCount} salitreeniä`));

  const key = S.ui.selDay;
  if (key) {
    const [ky, km, kd] = key.split('-').map(Number);
    const ss = S.sessions.filter((s) => dayKey(s.start) === key);
    const bb = S.body.filter((b) => b.date === key);
    v.append(h('h2', {}, `${kd}.${km}.${ky}`));
    if (!ss.length && !bb.length) v.append(h('div', { class: 'muted' }, 'Ei merkintöjä tälle päivälle.'));
    ss.forEach((s) => {
      const st = sessionStats(s);
      v.append(h('button', { class: 'pick card', style: 'min-height:0', onclick: () => sessionModal(s) },
        h('b', {}, s.name), h('div', { class: 'muted small' }, `klo ${fmtTime(s.start)} · ${st.sets} sarjaa · ${st.reps} toistoa`)));
    });
    bb.forEach((b) => v.append(h('div', { class: 'card small' },
      h('b', {}, 'Keho: '),
      [b.weight != null ? `${fmtW(b.weight)} ${U()}` : null, b.waist ? `vyötärö ${b.waist} cm` : null, b.chest ? `rinta ${b.chest} cm` : null,
        b.arm ? `käsivarsi ${b.arm} cm` : null, b.thigh ? `reisi ${b.thigh} cm` : null].filter(Boolean).join(' · '))));
  } else {
    const recent = [...S.sessions].sort((a, b) => b.start - a.start).slice(0, 8);
    if (recent.length) {
      v.append(h('h2', {}, 'Viimeisimmät treenit'));
      recent.forEach((s) => {
        const st = sessionStats(s);
        v.append(h('button', { class: 'pick card', style: 'min-height:0', onclick: () => sessionModal(s) },
          h('div', { class: 'row between' }, h('b', {}, s.name), h('span', { class: 'muted small' }, fmtDate(s.start))),
          h('div', { class: 'muted small' }, `${st.sets} sarjaa · ${st.reps} toistoa`)));
      });
    } else {
      v.append(h('p', { class: 'muted' }, 'Ei vielä treenejä. Ensimmäinen treeni ilmestyy tänne kun tallennat sen.'));
    }
  }
  return v;
}
