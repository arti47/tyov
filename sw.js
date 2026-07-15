// sw.js — Service worker for the Vampire Chronicle PWA.
// Bump CACHE_NAME whenever you ship changes to any cached asset.
const CACHE_NAME = 'vampire-chronicle-v15';
const ASSETS = [
    './index.html',
    './styles.css',
    './logic.js',
    './app.js',
    './data.js',
    './manifest.json',
    './assets/dice.wav',
    './assets/page.wav',
    './assets/icon-192.png',
    './assets/icon-512.png',
    './assets/icon-180.png'
];

// Precache core assets. We DON'T skipWaiting() here: a freshly-installed worker
// waits so the page can show a "new version — tap to update" toast, and only
// takes over when the user opts in (see the SKIP_WAITING message below).
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

// The page posts this when the user taps "Update now".
self.addEventListener('message', (e) => {
    if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) {
        self.skipWaiting();
    }
});

// Remove stale caches from previous versions, then take control.
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const sameOrigin = url.origin === self.location.origin;
    // Core code/markup must load as one consistent version. Serving app.js from
    // cache while index.html came from the network causes version skew (e.g. new
    // markup referencing functions the stale script doesn't have). So treat
    // navigations AND same-origin .html/.js/.css/.json as NETWORK-FIRST.
    const isCore = req.mode === 'navigate' ||
        (sameOrigin && /\.(?:html|js|css|json)$/i.test(url.pathname));

    if (isCore) {
        e.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, copy));
                    return res;
                })
                .catch(() => caches.match(req).then((r) =>
                    r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
        );
        return;
    }

    // Static assets (audio, icons) are version-independent: stale-while-revalidate.
    e.respondWith(
        caches.match(req).then((cached) => {
            const network = fetch(req).then((res) => {
                if (res && res.status === 200) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, copy));
                }
                return res;
            }).catch(() => cached);
            return cached || network;
        })
    );
});
