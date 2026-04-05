// mission-ephemeris.js — Single source of truth for spacecraft and Moon state
// Loads precomputed ephemeris JSON (OEM + Moon) and provides interpolated state at any MET.
// All position/velocity in EME2000 (km, km/s).
// ══════════════════════════════════════════════════════════════════════
(function() {
  const EPHEMERIS_FILE = 'data/mission-ephemeris.json';
  var points = null;
  var tStart = 0;
  var tEnd = 0;
  var meta = { creationDate: null };
  var _resolve;
  var readyPromise = new Promise(function(resolve) { _resolve = resolve; });

  function lerpScalar(a, b, f) { return a + (b - a) * f; }
  function lerpVec(a, b, f) { return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f }; }
  function lerpVec6(a, b, f) {
    return {
      x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f,
      vx: a.vx + (b.vx - a.vx) * f, vy: a.vy + (b.vy - a.vy) * f, vz: a.vz + (b.vz - a.vz) * f
    };
  }

  /** Map mission-ephemeris.json { meta, points } to internal point array for getState(). */
  function parseEphemerisJson(data) {
    if (data && data.meta) {
      meta.creationDate = data.meta.generated || data.meta.oemSource || null;
      meta.launchUtc = data.meta.launchUtc;
      meta.frame = data.meta.frame;
      meta.oemSource = data.meta.oemSource;
      meta.moonSource = data.meta.moonSource;
      meta.pointCount = data.meta.pointCount;
      meta.periluneMetSec = data.meta.periluneMetSec;
    }
    if (!data || !data.points || !Array.isArray(data.points)) return [];
    return data.points.map(function(p) {
      var o = p.orion;
      var m = p.moon;
      return {
        metSec: p.metSec,
        orion: { x: o.x, y: o.y, z: o.z, vx: o.vx, vy: o.vy, vz: o.vz },
        moon: { x: m.x, y: m.y, z: m.z },
        distEarthKm: p.distEarthKm,
        distMoonKm: p.distMoonKm,
        speedKms: p.speedKms
      };
    });
  }

  function getState(metSec) {
    if (!points || points.length === 0) {
      return { orion:{x:0,y:0,z:0,vx:0,vy:0,vz:0}, moon:{x:0,y:0,z:0}, distEarthKm:0, distMoonKm:0, speedKms:0, metSec:metSec, inDataRange:false };
    }
    if (metSec <= tStart) {
      const p = points[0];
      return Object.assign({}, p, { metSec: metSec, inDataRange: false });
    }
    if (metSec >= tEnd) {
      const p = points[points.length - 1];
      return Object.assign({}, p, { metSec: metSec, inDataRange: false });
    }

    var lo = 0, hi = points.length - 1;
    while (lo < hi - 1) {
      var mid = (lo + hi) >> 1;
      if (points[mid].metSec <= metSec) lo = mid; else hi = mid;
    }

    var pLo = points[lo], pHi = points[hi];
    var f = (metSec - pLo.metSec) / (pHi.metSec - pLo.metSec);

    return {
      orion: lerpVec6(pLo.orion, pHi.orion, f),
      moon: lerpVec(pLo.moon, pHi.moon, f),
      distEarthKm: lerpScalar(pLo.distEarthKm, pHi.distEarthKm, f),
      distMoonKm: lerpScalar(pLo.distMoonKm, pHi.distMoonKm, f),
      speedKms: lerpScalar(pLo.speedKms, pHi.speedKms, f),
      metSec: metSec,
      inDataRange: true,
      earthSign: (pHi.distEarthKm >= pLo.distEarthKm) ? '+' : '-',
      moonSign: (pHi.distMoonKm >= pLo.distMoonKm) ? '+' : '-'
    };
  }

  const cbv = window._cbv || Date.now();
  fetch(EPHEMERIS_FILE + '?v=' + cbv)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      points = parseEphemerisJson(data);
      if (points.length > 0) {
        tStart = points[0].metSec;
        tEnd = points[points.length - 1].metSec;
        if (window.DEBUG) console.log('[Ephemeris] JSON loaded: ' + points.length + ' points, Meta: ' + meta.creationDate);
      }
      _resolve();
    })
    .catch(err => {
      console.error('[Ephemeris] Failed to load ephemeris JSON:', err);
      meta.loadError = true;
      _resolve();
    });

  window.MissionEphemeris = {
    ready: readyPromise,
    getState: getState,
    get tStart() { return tStart; },
    get tEnd() { return tEnd; },
    get points() { return points; },
    get meta() { return meta; },
  };
})();
