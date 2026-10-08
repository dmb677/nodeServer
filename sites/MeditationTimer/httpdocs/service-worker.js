const CACHE_PREFIX = "still-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v20`;
const APP_SHELL = [
    "/",
    "/manifest.webmanifest",
    "/dist/css/meditation.css",
    "/dist/js/meditation.js",
    "/icons/still-192.png",
    "/icons/still-512.png"
];
const VERSIONED_APP_SHELL = APP_SHELL.map(path => `${path}?cache=${CACHE_NAME}`);

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(VERSIONED_APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== "GET" || url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === "navigate") {
        if (url.pathname !== "/") {
            return;
        }

        const responsePromise = fetch(request);
        event.waitUntil(
            responsePromise.then(response => {
                if (response.ok) {
                    return caches.open(CACHE_NAME)
                        .then(cache => cache.put("/", response.clone()))
                        .catch(error => console.error("Could not cache the app home page:", error));
                }
            }, () => {})
        );
        event.respondWith(
            responsePromise.catch(async () => {
                const cache = await caches.open(CACHE_NAME);
                const cachedHome = await cache.match("/");
                if (cachedHome) {
                    return cachedHome;
                }
                return new Response("Still is unavailable offline. Reconnect and try again.", {
                    status: 503,
                    headers: { "Content-Type": "text/plain; charset=utf-8" }
                });
            })
        );
        return;
    }

    if (APP_SHELL.includes(url.pathname)) {
        event.respondWith(
            caches.match(request, { ignoreSearch: true }).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request);
            })
        );
    }
});
