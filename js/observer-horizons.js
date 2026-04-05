/**
 * observer-horizons.js
 * Loads JPL Horizons observer table data (Earth + Moon distances, speed, illumination)
 * and provides interpolated lookups by Mission Elapsed Time (MET) in seconds.
 *
 * Data columns: [metSec, illu_pct, earthDist_km, earthDot_km_s, moonDist_km, moonDot_km_s, vSun_km_s, vEarth_km_s]
 * earthDot/moonDot: positive = receding, negative = approaching
 */

const ObserverHorizons = (() => {
  let _data = null;   // raw array of rows
  let _meta = null;   // metadata object
  let _ready = false;
  let _loadPromise = null;

  // Binary search: find index of largest row where row[0] <= metSec
  function _bisect(metSec) {
    let lo = 0, hi = _data.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (_data[mid][0] <= metSec) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  // Linear interpolation between two rows
  function _interp(metSec) {
    if (!_ready || !_data.length) return null;
    const n = _data.length;
    if (metSec <= _data[0][0]) return _data[0];
    if (metSec >= _data[n - 1][0]) return _data[n - 1];

    const i = _bisect(metSec);
    const r0 = _data[i];
    const r1 = _data[i + 1];
    if (!r1) return r0;

    const t = (metSec - r0[0]) / (r1[0] - r0[0]);
    return r0.map((v, j) => j === 0 ? metSec : v + t * (r1[j] - v));
  }

  function load() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch('data/observer-horizons.json')
      .then(r => {
        if (!r.ok) throw new Error('observer-horizons.json fetch failed: ' + r.status);
        return r.json();
      })
      .then(json => {
        _meta = json.meta;
        _data = json.data;
        _ready = true;
        console.log(`[ObserverHorizons] Loaded ${_data.length} rows. Perilune: ${_meta.perilune_moonDist_km} km at MET ${_meta.perilune_metSec}s`);
      })
      .catch(err => {
        console.warn('[ObserverHorizons] Failed to load:', err);
        _ready = false;
      });
    return _loadPromise;
  }

  function isReady() { return _ready; }
  function getMeta() { return _meta; }

  /** Returns interpolated Earth distance in km at given metSec */
  function getEarthDist(metSec) {
    const r = _interp(metSec);
    return r ? r[2] : null;
  }

  /** Returns Earth range-rate in km/s (+receding, -approaching) */
  function getEarthDot(metSec) {
    const r = _interp(metSec);
    return r ? r[3] : null;
  }

  /** Returns interpolated Moon distance in km at given metSec */
  function getMoonDist(metSec) {
    const r = _interp(metSec);
    return r ? r[4] : null;
  }

  /** Returns Moon range-rate in km/s (+receding, -approaching) */
  function getMoonDot(metSec) {
    const r = _interp(metSec);
    return r ? r[5] : null;
  }

  /** Returns speed vs Sun in km/s */
  function getSpeedVsSun(metSec) {
    const r = _interp(metSec);
    return r ? r[6] : null;
  }

  /** Returns speed vs Earth in km/s */
  function getSpeedVsEarth(metSec) {
    const r = _interp(metSec);
    return r ? r[7] : null;
  }

  /** Returns illuminated fraction 0-100 */
  function getIllumination(metSec) {
    const r = _interp(metSec);
    return r ? r[1] : null;
  }

  /**
   * Returns all values at once as a named object.
   * Returns null if data not loaded.
   */
  function getAll(metSec) {
    const r = _interp(metSec);
    if (!r) return null;
    return {
      metSec:       r[0],
      illu_pct:     r[1],
      earthDist_km: r[2],
      earthDot_km_s: r[3],
      moonDist_km:  r[4],
      moonDot_km_s: r[5],
      vSun_km_s:    r[6],
      vEarth_km_s:  r[7],
    };
  }

  /**
   * Seconds until perilune from given metSec.
   * Negative if perilune has already passed.
   */
  function getSecsToPerilune(metSec) {
    if (!_meta) return null;
    return _meta.perilune_metSec - metSec;
  }

  return { load, isReady, getMeta, getAll,
           getEarthDist, getEarthDot,
           getMoonDist, getMoonDot,
           getSpeedVsSun, getSpeedVsEarth,
           getIllumination, getSecsToPerilune };
})();
