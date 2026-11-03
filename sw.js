// Network first, falling back to the cache, so the app shell opens even without a connection
// (MQTT and the Cloudinary image still need internet).
const CACHE_NAME = "esp32-view-v10";
const MQTT_LIB = "https://unpkg.com/mqtt@5/dist/mqtt.min.js";
const SHELL = [
    "./",
    "index.html",
    "config.html",
    "style.css",
    "app.js",
    "config.js",
    "settings.js",
    "pwa.js",
    "reload.png",
    "manifest.json",
    "icon-192.png",
    "icon-512.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await cache.addAll(SHELL);
            // Cross-origin: must be requested with CORS or addAll rejects the opaque response
            await cache.add(new Request(MQTT_LIB, { mode: "cors" })).catch(() => {});
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    const isShell = url.origin === location.origin || url.hostname === "unpkg.com";
    if (event.request.method !== "GET" || !isShell) {
        return; // the Cloudinary image is always fetched live
    }

    event.respondWith(
        fetch(event.request, { cache: "no-cache" })
            .then((response) => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
