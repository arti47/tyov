// sw.js — Service worker for the Vampire Chronicle PWA.
// Bump CACHE_NAME whenever you ship changes to any cached asset.
const CACHE_NAME = 'vampire-chronicle-v3';
const ASSETS = [
    './index.html',
    './styles.css',
    './logic.js',
    './app.js',
    './data.js',
    './manifest.json',
    './assets/dice.wav',
    './assets/page.wav'
];

// Precache core assets and activate immediately.
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
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

    // Navigations: network-first so code/markup updates land immediately,
    // falling back to cache (then index.html) when offline.
    if (req.mode === 'navigate') {
        e.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, copy));
                    return res;
                })
                .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
        );
        return;
    }

    // Other GETs: stale-while-revalidate — serve cache fast, refresh in background.
    e.respondWith(
        caches.match(req).then((cached) => {
            const network = fetch(req).then((res) => {
                if (res && res.status === 200 && req.method === 'GET') {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, copy));
                }
                return res;
            }).catch(() => cached);
            return cached || network;
        })
    );
});
