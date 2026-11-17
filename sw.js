const CACHE_NAME = 'familia-cunez-v1';
const ARCHIVOS_BASE = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/styles.css',
  '/js/dashboard.js',
  '/imagenes/logo.png',
  '/manifest.json'
];

// Instalación: guardar archivos estáticos base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_BASE))
  );
  self.skipWaiting();
});

// Activación: limpiar versiones antiguas de caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estrategia Network-First: siempre prioriza datos frescos de internet
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No interceptar peticiones POST/PUT/DELETE, rutas /api/ ni imágenes de GitHub
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('githubusercontent.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copia = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});