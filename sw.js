/* Cache pubblica del sito: solo richieste GET della stessa origine e dello stesso percorso. */
'use strict';
const APP_BASE = new URL('./', self.location.href);
const CACHE_PREFIX = 'java-passo-passo-static-' + encodeURIComponent(APP_BASE.pathname) + '-';
const CACHE_NAME = CACHE_PREFIX + '2026-10-26-pwa1';
const INDEX_URL = new URL('./index.html', APP_BASE).href;
const FILES = [
  './', './index.html', './style.css', './app.js', './core.js', './pwa.js',
  './manifest.webmanifest', './favicon.svg', './apple-touch-icon.png',
  './icons/icon-192.png', './icons/icon-512.png',
  './data/fondamenti-input.js', './data/tipi-math.js', './data/condizioni-cicli.js',
  './data/array-metodi.js', './data/eccezioni-stream.js',
  './materiali/JAVA-P1.pdf', './materiali/Java-P1-Riassunto.pdf'
];
const PRECACHE_URLS = FILES.map(file => new URL(file, APP_BASE).href);
const STATIC_PATHS = new Set(PRECACHE_URLS.map(file => new URL(file).pathname));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

function offlineResponse() {
  return new Response('La risorsa non è ancora disponibile offline. Ricollegati a Internet e ricarica la pagina.', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Discord, altri domini, POST e percorsi esterni al repository passano direttamente al browser.
  if (request.method !== 'GET' || url.origin !== APP_BASE.origin || !url.pathname.startsWith(APP_BASE.pathname)) return;
  const appNavigation = request.mode === 'navigate' && (url.pathname === APP_BASE.pathname || url.pathname === new URL(INDEX_URL).pathname);
  if (appNavigation) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, {cache:'no-cache'});
        if (response.ok) { await cache.put(INDEX_URL, response.clone()); return response; }
        return (await cache.match(INDEX_URL)) || response;
      } catch { return (await cache.match(INDEX_URL)) || offlineResponse(); }
    })());
    return;
  }
  // Nessuna cache di API o dati privati: soltanto i file pubblici dichiarati sopra.
  if (!STATIC_PATHS.has(url.pathname)) return;
  const key = new URL(url.pathname, APP_BASE.origin).href;
  const update = caches.open(CACHE_NAME).then(async cache => {
    const response = await fetch(request, {cache:'no-cache'});
    if (response.ok && response.type !== 'opaque') await cache.put(key, response.clone());
    return response;
  });
  event.waitUntil(update.catch(() => {}));
  event.respondWith(caches.open(CACHE_NAME).then(async cache => (await cache.match(key)) || update.catch(() => offlineResponse())));
});
