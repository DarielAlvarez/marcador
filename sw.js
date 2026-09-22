/* Service Worker del Marcador — cachea la app para uso 100% offline */
const CACHE_NAME = 'marcador-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

/* Instalación: guarda los archivos base */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
      PRECACHE.map(url => cache.add(url).catch(() => { /* ignora fallos sueltos */ }))
    );
    await self.skipWaiting();
  })());
});

/* Activación: borra cachés antiguas */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Fetch */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // no tocar recursos externos

  /* Navegación (abrir la página): red primero, caché como respaldo */
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        await cache.put(req, res.clone());
        return res;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        const shell = (await caches.match('./index.html')) || (await caches.match('./'));
        if (shell) return shell;
        return new Response('<h1>Sin conexión</h1>', {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    })());
    return;
  }

  /* Resto de recursos: caché primero, red como respaldo */
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      return Response.error();
    }
  })());
});