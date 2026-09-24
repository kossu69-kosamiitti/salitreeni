// Volyymilaskenta per eristetty lihas ja per karkea ryhmä (sarjat + toistot).
// Ensisijainen lihas hyvitetään aina täydellä sarjamäärällä (paino 1.0). Avustavien (0-2)
// painotus on liikekohtainen (0.25x/0.5x/0.75x/1x, muokattavissa liikkeen tiedoista) - esim.
// penkkipunnerruksen ojentajat tai pystypunnerruksen sivuolkapää saavat todellista ärsykettä
// mutta usein eivät samaa suoraa kuormaa kuin varsinainen eristävä liike, kun taas esim.
// maastavedon pakarat/takareidet ovat yhtä lailla päälihaksia kuin nimetty ensisijainen lihas.
//
// Karkea ryhmä EI ole lastensa suora summa: yhden tehdyn sarjan paino karkeaan ryhmään on korkein
// sen ryhmän sisällä osuneen tagin paino (esim. takakyykky: etureidet 1.0 + pakarat 1.0, molemmat
// "Jalat" -> yksi sarja laskee "Jalat"-ryhmään painolla 1.0, ei 2.0, jotta yksi tehty sarja ei
// laske kahdesti). Jos ensisijainen ja avustava osuvat eri karkeisiin ryhmiin (esim. penkin
// ojentajat -> "Kädet"), "Kädet" saa oman, sille kuuluvan painonsa riippumatta "Rinta"-ryhmästä.
import { MUSCLES, BROAD, DEFAULT_MUSCLE_TARGETS, muscleParent } from './data.js';
import { S, exById, normalizeSecondary } from './state.js';

export const targetFor = (muscleId) => (S.settings.muscleTargets && S.settings.muscleTargets[muscleId]) || DEFAULT_MUSCLE_TARGETS[muscleId] || { min: 0, max: 0 };

export function sessionsInWindow(days) {
  const since = Date.now() - days * 86400000;
  return S.sessions.filter((s) => s.start >= since);
}

export function volumeFor(sessions) {
  const muscles = {};
  MUSCLES.forEach((m) => (muscles[m.id] = { sets: 0, reps: 0, entries: [] }));
  const broad = {};
  BROAD.forEach((b) => (broad[b] = { sets: 0, reps: 0 }));
  sessions.forEach((s) =>
    s.entries.forEach((e) => {
      const ex = exById(e.exId);
      if (!ex || !e.sets.length) return;
      // tags: [{id, weight, isPrimary}] - ensisijainen aina 1.0, avustavat liikekohtaisella painolla.
      const tags = [
        { id: ex.muscle, weight: 1, isPrimary: true },
        ...normalizeSecondary(ex.secondary).map((sec) => ({ id: sec.id, weight: sec.weight, isPrimary: false })),
      ].filter((t) => muscles[t.id]);
      if (!tags.length) return;
      let sSets = 0;
      let sReps = 0;
      e.sets.forEach((set) => {
        sSets++;
        sReps += set.r || 0;
      });
      tags.forEach(({ id, weight, isPrimary }) => {
        muscles[id].sets += sSets * weight;
        muscles[id].reps += sReps * weight;
        // Mistä liikkeestä/päivästä tämä lihaksen kertymä tuli - näytetään "avaa tarkemmin" -näkymässä.
        muscles[id].entries.push({ date: s.start, exId: ex.id, sets: e.sets, primary: isPrimary, weight });
      });
      // Karkean ryhmän paino tälle sarjalle = korkein sen ryhmän sisällä osuneen tagin paino.
      const broadWeight = {};
      tags.forEach(({ id, weight }) => {
        const b = muscleParent(id);
        if (b) broadWeight[b] = Math.max(broadWeight[b] || 0, weight);
      });
      Object.entries(broadWeight).forEach(([b, weight]) => {
        broad[b].sets += sSets * weight;
        broad[b].reps += sReps * weight;
      });
    })
  );
  MUSCLES.forEach((m) => muscles[m.id].entries.sort((a, b) => b.date - a.date));
  return { muscles, broad };
}

// Skaalaa viikkotavoitteen (sarjaa/vko) annetulle jaksolle (esim. 30 pv -> ×30/7)
export const scaleTarget = (target, days) => ({
  min: Math.round(target.min * (days / 7)),
  max: Math.round(target.max * (days / 7)),
});
