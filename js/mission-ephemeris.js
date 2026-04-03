// mission-ephemeris.js — Single source of truth for spacecraft and Moon state
// Loads data/mission-ephemeris.json and provides interpolated state at any MET.
// All position/velocity in EME2000 (km, km/s). Distances in km. Speed in km/s.
// ══════════════════════════════════════════════════════════════════════
(function() {
  var points = null;
  var tStart = 0;
  var tEnd = 0;
  var meta = null;
  var _resolve;
  var readyPromise = new Promise(function(resolve) { _resolve = resolve; });

  function lerpScalar(a, b, f) { return a + (b - a) * f; }

  function lerpVec(a, b, f) {
    return {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      z: a.z + (b.z - a.z) * f,
    };
  }

  function lerpVec6(a, b, f) {
    return {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      z: a.z + (b.z - a.z) * f,
      vx: a.vx + (b.vx - a.vx) * f,
      vy: a.vy + (b.vy - a.vy) * f,
      vz: a.vz + (b.vz - a.vz) * f,
    };
  }

  // Binary search + linear interpolation at a given MET (seconds from LAUNCH_UTC)
  function getState(metSec) {
    if (!points || points.length === 0) {
      return { orion:{x:0,y:0,z:0,vx:0,vy:0,vz:0}, moon:{x:0,y:0,z:0}, distEarthKm:0, distMoonKm:0, speedKms:0, metSec:metSec, inDataRange:false };
    }

    // Clamp to data range
    if (metSec <= tStart) {
      var p = points[0];
      return {
        orion: { x:p.orion.x, y:p.orion.y, z:p.orion.z, vx:p.orion.vx, vy:p.orion.vy, vz:p.orion.vz },
        moon: { x:p.moon.x, y:p.moon.y, z:p.moon.z },
        distEarthKm: p.distEarthKm,
        distMoonKm: p.distMoonKm,
        speedKms: p.speedKms,
        metSec: p.metSec,
        inDataRange: false,
      };
    }
    if (metSec >= tEnd) {
      var p = points[points.length - 1];
      return {
        orion: { x:p.orion.x, y:p.orion.y, z:p.orion.z, vx:p.orion.vx, vy:p.orion.vy, vz:p.orion.vz },
        moon: { x:p.moon.x, y:p.moon.y, z:p.moon.z },
        distEarthKm: p.distEarthKm,
        distMoonKm: p.distMoonKm,
        speedKms: p.speedKms,
        metSec: p.metSec,
        inDataRange: false,
      };
    }

    // Binary search for bracketing points
    var lo = 0, hi = points.length - 1;
    while (lo < hi - 1) {
      var mid = (lo + hi) >> 1;
      if (points[mid].metSec <= metSec) lo = mid; else hi = mid;
    }

    var pLo = points[lo];
    var pHi = points[hi];
    var f = (metSec - pLo.metSec) / (pHi.metSec - pLo.metSec);

    return {
      orion: lerpVec6(pLo.orion, pHi.orion, f),
      moon: lerpVec(pLo.moon, pHi.moon, f),
      distEarthKm: lerpScalar(pLo.distEarthKm, pHi.distEarthKm, f),
      distMoonKm: lerpScalar(pLo.distMoonKm, pHi.distMoonKm, f),
      speedKms: lerpScalar(pLo.speedKms, pHi.speedKms, f),
      metSec: metSec,
      inDataRange: true,
    };
  }

  // Load the ephemeris data
  var cbv = window._cbv || Date.now();
  fetch('data/mission-ephemeris.json?v=' + cbv)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      meta = data.meta;
      points = data.points;
      tStart = points[0].metSec;
      tEnd = points[points.length - 1].metSec;
      console.log('[Ephemeris] Loaded ' + points.length + ' points, MET ' +
        tStart.toFixed(0) + 's to ' + tEnd.toFixed(0) + 's (' +
        (tStart / 3600).toFixed(1) + 'h to ' + (tEnd / 3600).toFixed(1) + 'h)');
      _resolve();
    })
    .catch(function(err) {
      console.error('[Ephemeris] Failed to load mission-ephemeris.json:', err);
      _resolve(); // resolve anyway so consumers don't hang
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
