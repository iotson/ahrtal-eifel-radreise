const CACHE_NAME = 'ahrtal-eifel-tour-v2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './assets/icon.svg'
];

self.addEventListener('install', (event) => {
  // Ohne skipWaiting bliebe eine neue Version hängen, solange noch ein Tab offen ist.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

/**
 * Netz zuerst, Cache als Rückfall. Für eine Radtour ist das die richtige Reihenfolge:
 * unterwegs in der Eifel ohne Empfang zählt der Cache, zu Hause mit Empfang zählt der
 * aktuelle Stand. Cache-first hätte alte Tourdaten und alte App-Versionen eingefroren.
 */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? Response.error()))
  );
});
