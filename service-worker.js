const CACHE_NAME = 'artemis-dashboard-v13';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/observer.html',
  '/data/mission-ephemeris.json',
  '/css/styles.css',
  '/js/shared.js',
  '/js/mission-ephemeris.js',
  '/js/mission-events.js',
  '/js/clock.js',
  '/js/stats.js',
  '/js/timeline.js',
  '/js/news.js',
  '/js/crew.js',
  '/js/weather.js',
  '/js/orion-model.js',
  '/js/apollo-model.js',
  '/js/iss-model.js',
  '/js/trajectory.js',
  '/js/dsn.js',
  '/js/ui.js',
  '/js/reference.js',
  '/js/observer-astro.js',
  '/js/observer-ui.js',
  '/manifest.json',
  '/css/icon-192.png',
  '/css/icon-512.png',
  '/css/icon-192-maskable.png',
  '/css/icon-512-maskable.png',
  '/og-preview.webp',
  '/css/artemis-logo.webp',
  '/content/mission.html',
  '/content/science.html',
  '/content/sls.html',
  '/content/orion.html',
  '/content/ground-ops.html',
  '/content/comms.html',
  '/content/canada.html',
  '/content/esm.html',
  'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap',
];

const API_DOMAINS = [
  'api.nasa.gov',
  'services.swpc.noaa.gov',
  'eyes.nasa.gov',
  'ssd.jpl.nasa.gov',
];

// Install: cache all static assets, tolerating individual misses
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        // Cache files individually so a single missing file doesn't abort the install
        return Promise.all(
          STATIC_ASSETS.map(function(url) {
            return cache.add(url).catch(function(err) {
              console.warn('[SW] Failed to cache ' + url + ':', err);
            });
          })
        );
      })
      .then(function() { return self.skipWaiting(); })
  );
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch: network-first for APIs, cache-first for everything else
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // API calls: network-first with cache fallback
  if (API_DOMAINS.some(function(d) { return url.hostname.indexOf(d) !== -1; })) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
        return response;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // JS/CSS: network-first so updates are always picked up; fall back to cache offline
  var isCode = url.pathname.match(/\.(js|css)(\?|$)/);
  if (isCode) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Everything else (HTML, JSON, images): cache-first, update in background
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
