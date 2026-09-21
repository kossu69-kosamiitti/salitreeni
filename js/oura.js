// Oura Cloud API v2 – selainpuolen kirjautuminen (implicit flow, ei palvelinta).
// Token on voimassa noin 30 päivää, minkä jälkeen kirjaudutaan uudelleen.
const DIRECT_API = 'https://api.ouraring.com';
const AUTH = 'https://cloud.ouraring.com/oauth/authorize';
const SCOPES = 'daily heartrate workout personal';

// Normalisoidaan pois index.html, jotta osoite vastaa Ouraan rekisteröityä (esim. .../salitreeni/)
export const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');

export function connect(clientId) {
  const state = Math.random().toString(36).slice(2);
  try {
    localStorage.setItem('oura_state', state);
  } catch {}
  const q = new URLSearchParams({
    response_type: 'token',
    client_id: clientId,
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
  });
  location.href = `${AUTH}?${q}`;
}

// Kutsutaan sovelluksen käynnistyessä: poimii tokenin osoitteen #-osasta.
export function readRedirect() {
  if (!location.hash.includes('access_token')) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  const token = p.get('access_token');
  const expected = (() => {
    try {
      return localStorage.getItem('oura_state');
    } catch {
      return null;
    }
  })();
  history.replaceState(null, '', location.pathname + location.search);
  if (!token) return null;
  if (expected && p.get('state') && p.get('state') !== expected) return null;
  const exp = parseInt(p.get('expires_in') || '2592000', 10);
  return { token, expires: Date.now() + exp * 1000 };
}

export const isConnected = (auth) => !!(auth && auth.token && auth.expires > Date.now());

async function get(base, path, token, params) {
  const u = new URL(base + '/v2/usercollection/' + path);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  let r;
  try {
    r = await fetch(u, { headers: { Authorization: 'Bearer ' + token } });
  } catch {
    throw new Error('NET'); // selain esti pyynnön (CORS, mainosesto tai verkkovirhe)
  }
  if (r.status === 401) throw new Error('AUTH');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return j.data || [];
}

const SPORT_NAMES = {
  running: 'Juoksu',
  walking: 'Kävely',
  cycling: 'Pyöräily',
  swimming: 'Uinti',
  soccer: 'Jalkapallo',
  football: 'Jalkapallo',
  hockey: 'Jääkiekko',
  floorball: 'Sähly',
  hiking: 'Vaellus',
  skiing: 'Hiihto',
  cross_country_skiing: 'Hiihto',
  yoga: 'Jooga',
  rowing: 'Soutu',
  basketball: 'Koripallo',
  tennis: 'Tennis',
  badminton: 'Sulkapallo',
};
const SKIP = /strength|weight|lifting|resistance/i; // kirjataan itse sovelluksessa

const dayStr = (t) => new Date(t).toISOString().slice(0, 10);

// Palauttaa {workouts:[…], days:{YYYY-MM-DD:{readiness, sleep, hrv, rhr, sleepH}}}
export async function sync(token, days = 30, proxy = '') {
  const base = (proxy || DIRECT_API).replace(/\/+$/, '');
  const end = Date.now() + 86400000;
  const params = { start_date: dayStr(end - (days + 1) * 86400000), end_date: dayStr(end) };
  const names = ['workout', 'daily_readiness', 'daily_sleep', 'sleep'];
  const results = await Promise.allSettled(names.map((n) => get(base, n, token, params)));
  const errors = [];
  const [workouts, readiness, sleepScores, sleeps] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    errors.push({ endpoint: names[i], message: r.reason.message });
    return [];
  });
  if (errors.some((e) => e.message === 'AUTH')) throw new Error('AUTH');
  if (errors.length === names.length) {
    throw new Error(errors.every((e) => e.message === 'NET') ? 'CORS' : 'FAIL:' + errors.map((e) => `${e.endpoint} ${e.message}`).join(', '));
  }
  const out = { workouts: [], days: {} };
  const day = (k) => (out.days[k] ||= {});
  readiness.forEach((r) => (day(r.day).readiness = r.score));
  sleepScores.forEach((r) => (day(r.day).sleep = r.score));
  sleeps
    .filter((s) => !s.type || s.type === 'long_sleep')
    .forEach((s) => {
      const d = day(s.day);
      if (s.average_hrv != null) d.hrv = Math.round(s.average_hrv);
      if (s.lowest_heart_rate != null) d.rhr = s.lowest_heart_rate;
      if (s.total_sleep_duration != null) d.sleepH = Math.round((s.total_sleep_duration / 3600) * 10) / 10;
    });
  workouts.forEach((w) => {
    if (SKIP.test(w.activity || '')) return;
    const start = new Date(w.start_datetime).getTime();
    const minutes = Math.round((new Date(w.end_datetime).getTime() - start) / 60000);
    if (!(minutes > 0)) return;
    out.workouts.push({
      ouraId: w.id,
      ts: start,
      sport: SPORT_NAMES[w.activity] || w.label || (w.activity || 'Muu').replace(/_/g, ' '),
      minutes,
      calories: w.calories != null ? Math.round(w.calories) : null,
      distance: w.distance != null ? Math.round(w.distance) : null,
    });
  });
  out.errors = errors;
  return out;
}
