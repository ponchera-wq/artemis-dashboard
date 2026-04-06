/**
 * FlybyLighting — Sun direction and Moon orientation interpolation
 * Loads data/flyby-lighting.json and provides methods to query:
 * - getSunDir(metSec): unit vector in EME2000 frame
 * - getMoonOrientation(metSec): sub-Earth and sub-Solar points, rotation angle
 * 
 * Binary search with linear interpolation on metSec.
 * Graceful no-op if data fails to load.
 */
window.FlybyLighting = (() => {
  const module = {
    ready: false,
    data: null,
    error: null,
  };

  /**
   * Binary search for the two entries bracketing metSec
   * Returns { lower, upper } or null if outside range
   */
  function binarySearch(arr, metSec) {
    if (!arr || arr.length === 0) return null;

    let left = 0;
    let right = arr.length - 1;

    if (metSec < arr[0][0]) return null;
    if (metSec > arr[right][0]) return null;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (arr[mid][0] <= metSec) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    const upperIdx = left;
    const lowerIdx = left - 1;

    if (lowerIdx < 0 || upperIdx >= arr.length) return null;

    return {
      lower: { idx: lowerIdx, entry: arr[lowerIdx] },
      upper: { idx: upperIdx, entry: arr[upperIdx] },
    };
  }

  /**
   * Linear interpolation between two values
   */
  function lerp(t, v0, v1) {
    return v0 + t * (v1 - v0);
  }

  /**
   * Load and parse the JSON data file
   */
  async function load() {
    try {
      const response = await fetch('data/flyby-lighting.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      
      if (!json.meta || !json.sun || !json.moon) {
        throw new Error('Invalid data structure: missing meta, sun, or moon');
      }

      module.data = json;
      module.ready = true;
      module.error = null;
      return true;
    } catch (err) {
      module.error = err.message || String(err);
      module.ready = false;
      module.data = null;
      console.warn('[FlybyLighting] Failed to load data:', module.error);
      return false;
    }
  }

  /**
   * Check if data is loaded and ready
   */
  function isReady() {
    return module.ready && module.data !== null;
  }

  /**
   * Get interpolated Sun direction at metSec
   * Returns { x, y, z } unit vector in EME2000 frame, or null if unavailable
   */
  function getSunDir(metSec) {
    if (!isReady()) return null;

    const bracket = binarySearch(module.data.sun, metSec);
    if (!bracket) return null;

    const { lower, upper } = bracket;
    const t0 = lower.entry[0];
    const t1 = upper.entry[0];
    const t = (metSec - t0) / (t1 - t0);

    const x = lerp(t, lower.entry[1], upper.entry[1]);
    const y = lerp(t, lower.entry[2], upper.entry[2]);
    const z = lerp(t, lower.entry[3], upper.entry[3]);

    return { x, y, z };
  }

  /**
   * Get interpolated Moon orientation at metSec
   * Returns {
   *   obsLon: observer longitude (sub-Earth point) in degrees,
   *   obsLat: observer latitude (sub-Earth point) in degrees,
   *   sunLon: Sun longitude (sub-Solar point) in degrees,
   *   sunLat: Sun latitude (sub-Solar point) in degrees,
   *   npAng: North pole angle in degrees
   * }
   * Or null if unavailable
   */
  function getMoonOrientation(metSec) {
    if (!isReady()) return null;

    const bracket = binarySearch(module.data.moon, metSec);
    if (!bracket) return null;

    const { lower, upper } = bracket;
    const t0 = lower.entry[0];
    const t1 = upper.entry[0];
    const t = (metSec - t0) / (t1 - t0);

    const obsLon = lerp(t, lower.entry[1], upper.entry[1]);
    const obsLat = lerp(t, lower.entry[2], upper.entry[2]);
    const sunLon = lerp(t, lower.entry[3], upper.entry[3]);
    const sunLat = lerp(t, lower.entry[4], upper.entry[4]);
    const npAng = lerp(t, lower.entry[5], upper.entry[5]);

    return { obsLon, obsLat, sunLon, sunLat, npAng };
  }

  return {
    load,
    isReady,
    getSunDir,
    getMoonOrientation,
  };
})();
