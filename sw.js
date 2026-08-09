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
 * Bei schwachem Empfang darf „Netz zuerst“ nicht heißen „warte, bis irgendwann etwas kommt“.
 * Nach diesem Zeitlimit gilt die Leitung als tot und der Cache übernimmt.
 */
const NETZ_ZEITLIMIT_MS = 2500;

function netzMitZeitlimit(request) {
  let uhr;
  const zeitlimit = new Promise((_, reject) => {
    uhr = setTimeout(() => reject(new Error('Netz-Zeitlimit überschritten')), NETZ_ZEITLIMIT_MS);
  });

  return Promise.race([fetch(request), zeitlimit]).finally(() => clearTimeout(uhr));
}

/**
 * Netz zuerst, Cache als Rückfall. Für eine Radtour ist das die richtige Reihenfolge:
 * unterwegs in der Eifel ohne Empfang zählt der Cache, zu Hause mit Empfang zählt der
 * aktuelle Stand. Cache-first hätte alte Tourdaten und alte App-Versionen eingefroren.
 *
 * `data/tour.json` und `data/pois.json` stehen nicht in ASSETS — sie landen ausschließlich
 * über diesen Zweig im Cache. Deshalb hängt der Schreibvorgang an `event.waitUntil`: sonst
 * darf der Browser den Service Worker beenden, sobald die Antwort ausgeliefert ist, und die
 * Tourdaten fehlen offline. `response.ok` hält 404-Antworten während eines Deployments
 * draußen, das `catch` fängt `cache.put` bei Nicht-HTTP-Schemata ab.
 */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    netzMitZeitlimit(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => {})
          );
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? Response.error()))
  );
});
