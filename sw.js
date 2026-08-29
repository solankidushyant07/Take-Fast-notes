/* Take Fast Notes service worker.
 * Network-first with an offline cache fallback.
 */

const CACHE = 'take-fast-notes-v7';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/core.js',
  './js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignore requests belonging to other domains.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        // Try the network first.
        const response = await fetch(request);

        // Update the cache when the network succeeds.
        if (response && response.ok) {
          try {
            const cache = await caches.open(CACHE);
            await cache.put(request, response.clone());
          } catch {
            // A cache failure should never prevent a valid response.
          }
        }

        return response;
      } catch {
        // Network failed — try the cached version.
        const cached = await caches.match(request);

        if (cached) {
          return cached;
        }

        // If this was a page navigation, fall back to index.html.
        if (request.mode === 'navigate') {
          const index = await caches.match('./index.html');

          if (index) {
            return index;
          }
        }

        return new Response('Offline', {
          status: 503,
          headers: {
            'Content-Type': 'text/plain'
          }
        });
      }
    })()
  );
});