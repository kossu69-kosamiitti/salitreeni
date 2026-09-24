// Ohut IndexedDB-kääre. Kaikki data pysyy puhelimessa.
const STORES = {
  exercises: 'id',
  templates: 'id',
  sessions: 'id',
  body: 'id',
  kv: 'key',
};
export const STORE_NAMES = Object.keys(STORES);

let dbp;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open('salitreeni', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const [s, k] of Object.entries(STORES)) {
        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: k });
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

async function run(store, mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const rq = fn(t.objectStore(store));
    t.oncomplete = () => res(rq ? rq.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export const db = {
  all: (s) => run(s, 'readonly', (o) => o.getAll()),
  get: (s, k) => run(s, 'readonly', (o) => o.get(k)),
  put: (s, v) => run(s, 'readwrite', (o) => o.put(v)),
  del: (s, k) => run(s, 'readwrite', (o) => o.delete(k)),
  clear: (s) => run(s, 'readwrite', (o) => o.clear()),
  async putMany(s, arr) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(s, 'readwrite');
      const o = t.objectStore(s);
      arr.forEach((v) => o.put(v));
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    });
  },
};

export async function kvGet(key, fallback) {
  const r = await db.get('kv', key);
  return r ? r.value : fallback;
}
export const kvSet = (key, value) => db.put('kv', { key, value });
