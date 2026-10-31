// Offline support: the game core is cached on install; art, sound and music are cached the first time they are used.
const V = 'wk-v2.3', CORE = ['./', 'index.html', 'host.js', 'game.wasm', 'assets.json', 'app.webmanifest', 'icons/icon192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('wk-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || r.headers.has('range')) return;
  const core = CORE.some(p => new URL(p, self.registration.scope).href === r.url);
  e.respondWith(caches.open(V).then(async c => {
    if (core) { try { const n = await fetch(r); if (n.ok) c.put(r, n.clone()); return n; } catch (x) { return (await c.match(r)) || Response.error(); } }
    const hit = await c.match(r); if (hit) return hit;
    const n = await fetch(r); if (n.ok && n.status === 200) c.put(r, n.clone()); return n;
  }));
});
