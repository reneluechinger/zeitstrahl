// Service Worker: macht die App offline-fähig.
const VERSION = "zs-v2";
const SHELL = [
  "./", "./index.html", "./style.css", "./app.js", "./stations.js", "./manifest.webmanifest",
  "./icon-180.png", "./icon-192.png", "./icon-512.png",
  "./vendor/leaflet/leaflet.js", "./vendor/leaflet/leaflet.css",
  "./vendor/leaflet/images/marker-icon.png", "./vendor/leaflet/images/marker-shadow.png",
  "./vendor/jsQR.js", "./vendor/qrcode.js",
  "./vendor/fonts/fraunces-latin-700-normal.woff2", "./vendor/fonts/inter-latin-400-normal.woff2",
  "./vendor/fonts/inter-latin-600-normal.woff2", "./vendor/fonts/inter-latin-800-normal.woff2",
];
const RUNTIME_HOSTS = ["tile.openstreetmap.org",
  "commons.wikimedia.org", "upload.wikimedia.org"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith("zs-v") && k !== VERSION).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !RUNTIME_HOSTS.includes(url.hostname)) return;

  // Eigene Dateien: Netz max. 2,5 s abwarten (für Updates), sonst sofort aus dem Cache
  if (sameOrigin) {
    const fromCache = () => caches.match(req, { ignoreSearch: req.mode === "navigate" })
      .then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined));
    const net = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    });
    const timeout = new Promise(r => setTimeout(r, 2500)).then(fromCache);
    e.respondWith(
      Promise.race([net, timeout]).then(r => r || net)
        .catch(() => fromCache().then(r => r || net))
    );
    return;
  }
  // Bilder, Karte, Schriften: zuerst Cache, sonst Netz und speichern
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open("zs-data").then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
