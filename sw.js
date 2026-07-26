/* Service worker: deja usar la app sin conexión.
   Estrategia «red primero»: si hay internet siempre se sirve la última versión,
   y si no, lo que haya en caché. Las llamadas a /api nunca se cachean. */

const CACHE = 'scrabble-contador-v2';

const ARCHIVOS = [
  '.',
  'index.html',
  'assets/estilos.css',
  'assets/motor.js',
  'assets/alinear.js',
  'assets/app.js',
  'icono.svg',
  'manifest.webmanifest',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  ev.respondWith(
    fetch(ev.request)
      .then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE).then((c) => c.put(ev.request, copia)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(ev.request).then((r) => r || caches.match('index.html')))
  );
});
