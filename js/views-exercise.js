// Liikkeen tiedot: historia ja ennätykset yhdelle liikkeelle
import { h, fmtDate } from './util.js';
import { modal, render, fmtW, U, exerciseDetailStats, editExerciseDialog, confirmBox, deleteExerciseHistory, toast } from './state.js';

function statCard(label, value, sub) {
  return h('div', { class: 'stat' }, h('b', {}, value), h('span', {}, label), sub ? h('div', { class: 'muted', style: 'font-size:11px' }, sub) : null);
}

export function exerciseDetailModal(ex) {
  const st = exerciseDetailStats(ex.id);
  return modal((close) => {
    const body = h('div', {}, h('h2', {}, ex.name));
    if (!st.entries.length) {
      body.append(h('div', { class: 'card muted' }, 'Ei vielä kirjattuja sarjoja tälle liikkeelle.'));
    } else {
      const lastBest = st.last ? st.last.sets.reduce((b, x) => (!b || x.w > b.w ? x : b), null) : null;
      body.append(h('div', { class: 'statrow', style: 'grid-template-columns:repeat(2,1fr);margin-bottom:8px' },
        statCard('Viimeisin', lastBest ? `${fmtW(lastBest.w)} ${U()} × ${lastBest.r}` : '–', st.last ? fmtDate(st.last.date) : ''),
        statCard('Arvioitu 1RM', st.estimated1rm ? `${fmtW(st.estimated1rm)} ${U()}` : '–')));
      body.append(h('div', { class: 'statrow', style: 'grid-template-columns:repeat(2,1fr);margin-bottom:8px' },
        statCard('Paras ikinä', st.bestEver ? `${fmtW(st.bestEver.w)} ${U()} × ${st.bestEver.r}` : '–', st.bestEver ? fmtDate(st.bestEver.date) : ''),
        statCard('Paras tänä vuonna', st.bestThisYear ? `${fmtW(st.bestThisYear.w)} ${U()} × ${st.bestThisYear.r}` : '–', st.bestThisYear ? fmtDate(st.bestThisYear.date) : '')));
      body.append(h('div', { class: 'statrow', style: 'grid-template-columns:repeat(2,1fr);margin-bottom:12px' },
        statCard('Paras sarja (1RM)', st.bestSet ? `${fmtW(st.bestSet.w)} ${U()} × ${st.bestSet.r}` : '–', st.bestSet ? fmtDate(st.bestSet.date) : ''),
        statCard('Yhteensä', `${st.totalSets} sarjaa`, `${st.totalReps} toistoa`)));

      body.append(h('h3', { style: 'margin:14px 0 6px' }, 'Historia'));
      body.append(h('div', { class: 'card' },
        [...st.entries].reverse().slice(0, 30).map((e) => h('div', { style: 'padding:6px 0;border-top:1px solid var(--line)' },
          h('div', { class: 'muted small' }, fmtDate(e.date)),
          h('div', {}, e.sets.map((x) => h('span', { style: 'margin-right:10px;white-space:nowrap' },
            `${fmtW(x.w)}×${x.r}`, x.pr ? h('span', { class: 'pr', style: 'margin-left:4px' }, 'PR') : null)))))));
      body.append(h('div', { style: 'text-align:right;margin-top:8px' },
        h('button', { class: 'small ghost danger', onclick: async () => {
          if (!(await confirmBox(
            `Poistetaanko liikkeen "${ex.name}" koko sarjahistoria pysyvästi? (${st.totalSets} sarjaa katoaa.) Liike itse ei poistu, ja se on edelleen käytössä pohjissa ja uusissa treeneissä.`,
            'Poista historia', true
          ))) return;
          const removed = await deleteExerciseHistory(ex.id);
          close(true);
          render();
          toast(`Poistettu ${removed} sarjaa liikkeen "${ex.name}" historiasta`);
        } }, 'Poista historia')));
    }
    body.append(h('div', { class: 'actions' },
      h('button', { onclick: async () => {
        if (await editExerciseDialog(ex)) {
          render();
          close(true);
          exerciseDetailModal(ex);
        }
      } }, 'Muokkaa liikkeen tietoja'),
      h('button', { class: 'primary', onclick: () => close(true) }, 'Sulje')));
    return body;
  });
}
