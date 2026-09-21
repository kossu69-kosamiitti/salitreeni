// Service worker: sovellus toimii offline-tilassa (stale-while-revalidate)
const VERSION = 'salitreeni-v3';
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/db.js', 'js/util.js', 'js/data.js', 'js/charts.js', 'js/oura.js', 'js/state.js',
  'js/views-workout.js', 'js/views-history.js', 'js/views-progress.js', 'js/views-other.js', 'js/views-settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Oura-kutsut suoraan verkkoon
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) return cached;
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return cache.match('index.html');
      return new Response('Offline', { status: 503 });
    })
  );
});
