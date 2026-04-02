const CACHE_NAME = 'artemis-dashboard-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/shared.js',
  '/js/clock.js',
  '/js/stats.js',
  '/js/timeline.js',
  '/js/news.js',
  '/js/crew.js',
  '/js/weather.js',
  '/js/trajectory.js',
  '/js/dsn.js',
  '/js/ui.js',
  '/js/reference.js',
  '/manifest.json',
  '/content/mission.html',
  '/content/science.html',
  '/content/sls.html',
  '/content/orion.html',
  '/content/ground-ops.html',
  '/content/comms.html',
];

const API_DOMAINS = [
  'api.nasa.gov',
  'services.swpc.noaa.gov',
  'eyes.nasa.gov',
  'ssd.jpl.nasa.gov',
];

// Install: cache all static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(STATIC_ASSETS); })
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

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response.ok && url.protocol === 'https:') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
        }
        return response;
      });
    })
  );
});
