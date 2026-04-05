// flyby-lighting.js — Sun direction and Moon orientation data for the lunar flyby
// Loads data/flyby-lighting.json, binary-searches + linearly interpolates on metSec.
// Exposes: load(), isReady(), getSunDir(metSec), getMoonOrientation(metSec)
(function () {
  const DATA_FILE = 'data/flyby-lighting.json';

  var sunRows  = null;  // Array of [metSec, sx, sy, sz]
  var moonRows = null;  // Array of [metSec, obs_lon_deg, obs_lat_deg, sun_lon_deg, sun_lat_deg, np_ang_deg, np_dist_deg]
  var meta     = null;
  var ready    = false;
  var _resolve;
  var readyPromise = new Promise(function (resolve) { _resolve = resolve; });

  // ── helpers ──────────────────────────────────────────────────────────────

  function lerp(a, b, f) { return a + (b - a) * f; }

  /**
   * Binary-search rows (sorted by rows[i][0]) for the pair bracketing t.
   * Returns { lo, hi, f } where f is the fractional distance between them.
   * Clamps to the first/last row when t is out of range.
   */
  function findBracket(rows, t) {
    var n = rows.length;
    if (n === 0) return null;
    if (t <= rows[0][0])     return { lo: 0, hi: 0, f: 0 };
    if (t >= rows[n - 1][0]) return { lo: n - 1, hi: n - 1, f: 0 };

    var lo = 0, hi = n - 1;
    while (lo < hi - 1) {
      var mid = (lo + hi) >> 1;
      if (rows[mid][0] <= t) lo = mid; else hi = mid;
    }

    var f = (t - rows[lo][0]) / (rows[hi][0] - rows[lo][0]);
    return { lo: lo, hi: hi, f: f };
  }

  // ── public API ────────────────────────────────────────────────────────────

  /**
   * Fetch and parse the data file.  Returns the readyPromise so callers can await it.
   * Safe to call multiple times; subsequent calls return the same promise.
   */
  function load() {
    if (!ready && sunRows === null) {
      var cbv = window._cbv || Date.now();
      fetch(DATA_FILE + '?v=' + cbv)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          meta     = data.meta  || {};
          sunRows  = data.sun   || [];
          moonRows = data.moon  || [];
          ready    = true;
          if (window.DEBUG) {
            console.log('[FlybyLighting] loaded: ' + sunRows.length + ' sun rows, ' + moonRows.length + ' moon rows');
          }
          _resolve();
        })
        .catch(function (err) {
          console.error('[FlybyLighting] failed to load ' + DATA_FILE, err);
          sunRows  = [];
          moonRows = [];
          meta     = { loadError: true };
          ready    = true;
          _resolve();
        });
    }
    return readyPromise;
  }

  /** Returns true once the JSON has been fetched and parsed (or failed). */
  function isReady() { return ready; }

  /**
   * Returns the unit sun-direction vector in EME2000 at the given mission-elapsed seconds.
   * @param  {number} metSec
   * @returns {{ x: number, y: number, z: number } | null}
   */
  function getSunDir(metSec) {
    if (!ready || !sunRows || sunRows.length === 0) return null;
    var b = findBracket(sunRows, metSec);
    if (!b) return null;
    if (b.lo === b.hi) {
      var r = sunRows[b.lo];
      return { x: r[1], y: r[2], z: r[3] };
    }
    var lo = sunRows[b.lo], hi = sunRows[b.hi], f = b.f;
    return {
      x: lerp(lo[1], hi[1], f),
      y: lerp(lo[2], hi[2], f),
      z: lerp(lo[3], hi[3], f)
    };
  }

  /**
   * Returns Moon orientation data interpolated at the given mission-elapsed seconds.
   * All angular values are in degrees.
   * @param  {number} metSec
   * @returns {{
   *   obsLonDeg:  number,   // sub-Earth longitude on Moon (MOON_ME, east-positive)
   *   obsLatDeg:  number,   // sub-Earth latitude  on Moon
   *   sunLonDeg:  number,   // sub-solar longitude on Moon
   *   sunLatDeg:  number,   // sub-solar latitude  on Moon
   *   npAngDeg:   number,   // north-pole position angle (deg, from north toward east)
   *   npDistDeg:  number    // angular distance to north pole (deg)
   * } | null}
   */
  function getMoonOrientation(metSec) {
    if (!ready || !moonRows || moonRows.length === 0) return null;
    var b = findBracket(moonRows, metSec);
    if (!b) return null;
    if (b.lo === b.hi) {
      var r = moonRows[b.lo];
      return { obsLonDeg: r[1], obsLatDeg: r[2], sunLonDeg: r[3], sunLatDeg: r[4], npAngDeg: r[5], npDistDeg: r[6] };
    }
    var lo = moonRows[b.lo], hi = moonRows[b.hi], f = b.f;
    return {
      obsLonDeg: lerp(lo[1], hi[1], f),
      obsLatDeg: lerp(lo[2], hi[2], f),
      sunLonDeg: lerp(lo[3], hi[3], f),
      sunLatDeg: lerp(lo[4], hi[4], f),
      npAngDeg:  lerp(lo[5], hi[5], f),
      npDistDeg: lerp(lo[6], hi[6], f)
    };
  }

  // ── bootstrap ─────────────────────────────────────────────────────────────

  window.FlybyLighting = {
    ready:              readyPromise,
    load:               load,
    isReady:            isReady,
    getSunDir:          getSunDir,
    getMoonOrientation: getMoonOrientation,
    get meta() { return meta; }
  };
})();
