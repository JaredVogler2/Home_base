/*
 * HOMEBASE's service worker: the app's own files, kept on the device so the house still draws with no signal.
 *
 * What it keeps: the page, its scripts, styles, fonts and icons — nothing else. What it never touches: anything
 * under /api (the family's data, sign-in, photos). Those go to the network or fail; the app keeps its own
 * careful copy of the household in IndexedDB, with its own rules for when to forget it. A new version of the
 * app replaces this cache whole; what a screen has queued to send lives elsewhere and is not affected.
 *
 * The two placeholders below are filled in when the app is built (see vite.config.ts).
 */
const VERSION = '__VERSION__';
const SHELL = __SHELL__;
const CACHE = `homebase-shell-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('homebase-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The family's data is never kept here: the network answers, or nobody does.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // A page: the newest from the network when there is one, the kept shell when there is not.
    event.respondWith(
      fetch(request).catch(() => caches.open(CACHE).then((cache) => cache.match('/index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((kept) => {
        if (kept) return kept;
        return fetch(request).then((response) => {
          // Built files have their contents in their names, so a copy can be kept for good.
          if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/data/'))) {
            cache.put(request, response.clone());
          }
          return response;
        });
      }),
    ),
  );
});
