// Käynnistys, alavalikko ja näkymän piirto
import { h } from './util.js';
import { S, setRender, loadAll, saveOura, toast } from './state.js';
import { renderWorkout, resumeActive } from './views-workout.js';
import { renderHistory } from './views-history.js';
import { renderProgress } from './views-progress.js';
import { renderOther, syncOura } from './views-other.js';
import { renderSettings } from './views-settings.js';
import * as oura from './oura.js';

const ICONS = {
  workout: '<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>',
  history: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  progress: '<path d="M5 20V11M11 20V4M17 20v-6M2 20h20"/>',
  other: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
};
const TABS = [
  ['workout', 'Treeni', renderWorkout],
  ['history', 'Historia', renderHistory],
  ['progress', 'Edistyminen', renderProgress],
  ['other', 'Muu', renderOther],
  ['settings', 'Asetukset', renderSettings],
];

let lastTab = null;

function render() {
  const nav = document.getElementById('nav');
  nav.replaceChildren(
    ...TABS.map(([id, label]) =>
      h('button', {
        class: S.ui.tab === id ? 'on' : '',
        'aria-label': label,
        onclick: () => {
          S.ui.tab = id;
          render();
        },
      }, h('span', { html: `<svg viewBox="0 0 24 24">${ICONS[id]}</svg>` }), label)
    )
  );
  const view = document.getElementById('view');
  const y = window.scrollY;
  const t = TABS.find(([id]) => id === S.ui.tab);
  view.replaceChildren(t[2]());
  window.scrollTo(0, lastTab === S.ui.tab ? y : 0);
  lastTab = S.ui.tab;
}

async function boot() {
  try {
    await navigator.storage?.persist?.();
  } catch {}
  await loadAll();
  const red = oura.readRedirect();
  if (red) {
    S.oura.auth = red;
    await saveOura();
    S.ui.tab = 'other';
    toast('Oura yhdistetty');
  }
  setRender(render);
  render();
  resumeActive();
  if (oura.isConnected(S.oura.auth) && (red || Date.now() - (S.oura.last || 0) > 6 * 3600 * 1000)) syncOura({ silent: !red });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot().catch((e) => {
  document.getElementById('view').textContent = 'Käynnistysvirhe: ' + e.message;
  console.error(e);
});
