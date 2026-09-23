/* Service Worker del Marcador — cachea la app completa para uso 100% offline */
const CACHE_NAME = 'marcador-v2'; // subimos versión por el cambio de IA

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './best.onnx',                    // modelo de IA
  './ort.min.js',                   // runtime ONNX
  './ort-wasm-simd-threaded.wasm',  // WASM runtime
  './ort-wasm-simd-threaded.jsep.wasm'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
      PRECACHE.map(url => cache.add(url).catch(err => {
        console.warn('No se pudo precachear:', url, err);
      }))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

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
