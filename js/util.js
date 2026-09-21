// Pieniä apufunktioita

export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'value') e.value = v;
    else if (k === 'checked') e.checked = !!v;
    else if (k === 'selected') e.selected = !!v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const pad = (n) => String(n).padStart(2, '0');

// Paikallinen päiväavain YYYY-MM-DD
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Päiväavaimesta keskipäivän aikaleima (välttää DST-ongelmat)
export function keyToTs(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

// Viikon alku (maanantai 00:00) aikaleimana
export function weekStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}
export function fmtDateShort(ts) {
  const d = new Date(ts);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}
export function fmtTime(ts) {
  const d = new Date(ts);
  return `${d.getHours()}:${pad(d.getMinutes())}`;
}
export const WEEKDAYS = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'];
export const MONTHS = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'];

export function mmss(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

// "3:00" tai "90" -> sekunnit (null jos virheellinen)
export function parseMMSS(str) {
  const t = String(str).trim().replace(',', '.');
  if (!t) return null;
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    const v = (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
    return v > 0 ? v : null;
  }
  const v = Math.round(parseFloat(t));
  return v > 0 ? v : null;
}
