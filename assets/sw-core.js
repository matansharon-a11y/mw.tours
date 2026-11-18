/* MW Photo Tours · offline. Each tour folder has a tiny sw.js that loads this file; the tour page registers it.
 *
 *  • The tour page: from the network when there is signal (so updates arrive), from the phone when there isn't.
 *  • Pictures, map layers, fonts and scripts: from the phone first, fetched once and kept.
 *  • Once a traveler has opened the expedition, members.js sends the list of everything the page uses (map layers,
 *    photos of every room, fonts) and it is all saved, so the whole expedition opens in the field without signal.
 *  • Group shots (Supabase storage): kept once seen. Everything else from Supabase always goes to the network.
 *  Bump V to drop everything saved before (for example after renaming many files).
 */
const V = 'mw-offline-1';
const PAGE = new URL('./', self.registration.scope).href;          // e.g. https://tours.mw.photography/kerkini/

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.add(new Request(PAGE, { cache: 'reload' })).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('mw-offline-') && k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// the page asks to keep a list of files (only this site's own files)
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type !== 'mw-keep' || !Array.isArray(d.urls)) return;
  e.waitUntil(keep(d.urls));
});
async function keep(urls) {
  const c = await caches.open(V);
  const list = [...new Set(urls)].filter(u => { try { return new URL(u).origin === location.origin; } catch (x) { return false; } });
  for (let i = 0; i < list.length; i += 4) {            // a few at a time, gentle on a weak connection
    await Promise.all(list.slice(i, i + 4).map(async u => {
      if (await c.match(u)) return;
      try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch (x) {}
    }));
  }
}

const isShot = u => /\.supabase\.co$/.test(u.hostname) && /\/storage\/v1\/object\/(sign|public)\//.test(u.pathname);
const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  // group shots: the same picture under a new signed link is still the same picture
  if (isShot(u)) { e.respondWith(firstSaved(req, u.origin + u.pathname)); return; }
  if (u.origin !== location.origin) return;              // Supabase data, other sites: always the network
  // the page itself and the list of tours: fresh when possible, the saved copy without signal
  if (req.mode === 'navigate' || u.pathname.endsWith('/tours.json')) { e.respondWith(freshFirst(req)); return; }
  // a file without a version (?v=) can be replaced under the same name: answer from the phone, then refresh it quietly
  const plain = !u.searchParams.has('v');
  e.respondWith(firstSaved(req, req, plain ? e : null));
});

async function freshFirst(req) {
  const c = await caches.open(V);
  try {
    const r = await timeout(fetch(req), 6000);
    if (r.ok) {
      const key = new URL(req.url); key.search = ''; key.hash = '';
      c.put(key.href, r.clone());
    }
    return r;
  } catch (x) {
    return (await c.match(req, { ignoreSearch: true })) || (await c.match(PAGE)) || Response.error();
  }
}
async function firstSaved(req, key, ev) {
  const c = await caches.open(V);
  const hit = await c.match(key);
  if (hit) {
    if (ev) ev.waitUntil(fetch(req).then(r => { if (r.ok) return c.put(key, r); }).catch(() => {}));
    return hit;
  }
  try {
    const r = await fetch(req);
    if (r.ok || r.type === 'opaque') c.put(key, r.clone());
    return r;
  } catch (x) {
    return (await c.match(key, { ignoreSearch: true })) || Response.error();
  }
}
