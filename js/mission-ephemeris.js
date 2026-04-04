// mission-ephemeris.js — Single source of truth for spacecraft and Moon state
// Parses raw NASA OEM (ASCII) data and provides interpolated state at any MET.
// All position/velocity in EME2000 (km, km/s).
// ══════════════════════════════════════════════════════════════════════
(function() {
  const EPHEMERIS_FILE = 'data/Artemis_II_OEM_latest.asc';
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

  function parseOEM(text) {
    // 1. Extract Creation Date
    const creationRegex = /CREATION_DATE\s*=\s*([\d-T:]+)/;
    const creationMatch = text.match(creationRegex);
    if (creationMatch) meta.creationDate = creationMatch[1];

    // 2. Extract State Vectors
    // Matches: 2026-04-02T01:57:37.084 -24468.231698271986 -12677.926410379976 -6901.348388602915 -1.83796863689585 -3.41722647280823 -1.84782351579474
    const lines = text.split('\n');
    const launchTime = window.LAUNCH_UTC ? window.LAUNCH_UTC.getTime() : 0;
    const rawPoints = [];

    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length === 7 && parts[0].includes('T')) {
        const date = new Date(parts[0] + 'Z');
        const metSec = (date.getTime() - launchTime) / 1000;
        
        // Convert to state object
        const x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
        const vx = parseFloat(parts[4]), vy = parseFloat(parts[5]), vz = parseFloat(parts[6]);
        
        rawPoints.push({
          utc: date,
          metSec: metSec,
          orion: { x, y, z, vx, vy, vz },
          distEarthKm: Math.sqrt(x*x + y*y + z*z),
          speedKms: Math.sqrt(vx*vx + vy*vy + vz*vz)
        });
      }
    });

    // 3. Sample and enrich with Moon data
    // OEM often has high density (every 1-5 mins), sample for performance
    const step = rawPoints.length > 1500 ? 10 : 2; 
    const sampled = [];
    for (let i = 0; i < rawPoints.length; i += step) {
      const p = rawPoints[i];
      
      // Calculate Moon position in EME2000 using Astronomy Engine
      if (window.Astronomy) {
        const astroTime = Astronomy.MakeTime(p.utc);
        const mPos = Astronomy.GeoVector('Moon', astroTime, false);
        p.moon = { x: mPos.x, y: mPos.y, z: mPos.z };
        const dx = p.orion.x - p.moon.x;
        const dy = p.orion.y - p.moon.y;
        const dz = p.orion.z - p.moon.z;
        p.distMoonKm = Math.sqrt(dx*dx + dy*dy + dz*dz);
      } else {
        p.moon = { x: 384400, y: 0, z: 0 }; // fallback
        p.distMoonKm = 384400;
      }
      sampled.push(p);
    }
    
    // Ensure final point is included (compare by value, not object reference)
    if (rawPoints.length > 0 && sampled[sampled.length-1].metSec !== rawPoints[rawPoints.length-1].metSec) {
       const p = rawPoints[rawPoints.length-1];
       if (window.Astronomy) {
         const astroTime = Astronomy.MakeTime(p.utc);
         const mPos = Astronomy.GeoVector('Moon', astroTime, false);
         p.moon = { x: mPos.x, y: mPos.y, z: mPos.z };
         const dx = p.orion.x - p.moon.x, dy = p.orion.y - p.moon.y, dz = p.orion.z - p.moon.z;
         p.distMoonKm = Math.sqrt(dx*dx + dy*dy + dz*dz);
       }
       sampled.push(p);
    }

    return sampled;
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
    .then(r => r.text())
    .then(text => {
      points = parseOEM(text);
      if (points.length > 0) {
        tStart = points[0].metSec;
        tEnd = points[points.length - 1].metSec;
        if (window.DEBUG) console.log('[Ephemeris] OEM Loaded: ' + points.length + ' points, Meta: ' + meta.creationDate);
      }
      _resolve();
    })
    .catch(err => {
      console.error('[Ephemeris] Failed to load OEM:', err);
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
