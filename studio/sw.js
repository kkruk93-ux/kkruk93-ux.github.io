/* Service worker PWA — cache powłoki. Nigdy nie cache'uje Apps Script ani URL z tokenem. */
var CACHE = "rss-v2-8";
var PRECACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./views.js",
  "./api.js",
  "./manifest.webmanifest",
  "./lib/cytoscape.min.js",
  "./lib/cytoscape.LICENSE.txt",
  "./lib/three/three.module.min.js",
  "./lib/three/addons/controls/OrbitControls.js",
  "./lib/three/LICENSE.txt",
  "./brain3d.js",
  "./lib/three/addons/loaders/GLTFLoader.js",
  "./lib/three/addons/utils/BufferGeometryUtils.js",
  "./lib/three/addons/lines/Line2.js",
  "./lib/three/addons/lines/LineMaterial.js",
  "./lib/three/addons/lines/LineGeometry.js",
  "./lib/three/addons/lines/LineSegments2.js",
  "./lib/three/addons/lines/LineSegmentsGeometry.js",
  "./assets/brain/brain-cortex.glb",
  "./assets/brain/tracts.bin",
  "./assets/brain/brain-meta.json",
  "./assets/brain/ATTRIBUTION.txt",
  "./data/zespol.js",
  "./data/statusy.js",
  "./data/statusy.json",
  "./data/firma.js",
  "./data/firma.json",
  "./data/biblioteka.js",
  "./data/biblioteka.json",
  "./data/videos.json",
  "./data/videos.js",
  "./data/articles.json",
  "./data/articles.js",
  "./assets/rovi-shadow.jpg",
  "./assets/rovi-shadow.webp",
  "./assets/rovi-shadow-192.png",
  "./assets/rovi-shadow-192.webp",
  "./assets/rovi-shadow-512.png",
  "./assets/rovi-shadow-banner.jpg",
  "./assets/rovi-shadow-banner.webp",
  "./assets/szum.png"
];

function isForbidden(url) {
  try {
    var u = new URL(url, self.location.href);
    if (/script\.google\.com$/i.test(u.hostname) || /script\.google\.com$/i.test(u.hostname.replace(/^www\./, ""))) return true;
    if (u.hostname.indexOf("script.google.com") !== -1) return true;
    if (u.searchParams.has("token")) return true;
    if (/(?:^|[?&])token=/.test(u.search)) return true;
    return false;
  } catch (e) {
    return /token=|script\.google\.com/.test(String(url));
  }
}

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  if (isForbidden(req.url)) return; /* sieć, bez cache */
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var isData = /\/data\/.+\.(json|js)$/.test(url.pathname);
  if (isData) {
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () { return caches.match(req); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res && res.ok && res.type === "basic") {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  }));
});
