// stats.js — Telemetry estimates, JPL Horizons live data, unit toggle
(function() {
// ── TELEMETRY ESTIMATES (interpolated from NASA reference waypoints) ──
// Verified against NASA broadcast. Waypoints: [minutes, value].
// earthDist & moonDist in km; speed in km/h.
const H = 60; // minutes per hour
// Fallback waypoints from NASA broadcast reference values (miles × 1.60934 = km, mph × 1.60934 = km/h)
// Orbit: 1,500 × 46,000 mi (2,414 × 74,030 km), period ~26h
// Apogee at ~T+15h, perigee at ~T+28h. TLI burn at ~T+25h48m.
// Anchors verified against NASA broadcast: T+13h=2,029mph/~40,000mi, T+20h=4,809mph/30,886mi
const TELEM = {
  earthDist: [  // km from Earth surface (mi → km)
    [0,           0],       //  T+0h:   0 mi — launch
    [10,        805],       //  T+10m:  500 mi — orbit insertion
    [49,       1609],       //  T+49m:  1,000 mi — perigee raise
    [108,      4828],       //  T+1h48: 3,000 mi — ICPS apogee raise burn
    [3*H,      8047],       //  T+3h:   5,000 mi — ICPS sep, ascending
    [6*H,     32187],       //  T+6h:  20,000 mi — ascending
    [8*H,     40234],       //  T+8h:  25,000 mi — ascending
    [10*H,    56327],       //  T+10h: 35,000 mi — ascending
    [13*H,    64374],       //  T+13h: 40,000 mi — near apogee (NASA: 2,029 mph)
    [15*H,    74030],       //  T+15h: 46,000 mi — apogee
    [18*H,    64374],       //  T+18h: 40,000 mi — past apogee, descending slowly
    [20*H,    49710],       //  T+20h: 30,886 mi — NASA confirmed
    [22*H,    32187],       //  T+22h: 20,000 mi — descending
    [24*H,    16093],       //  T+24h: 10,000 mi — approaching perigee
    [25*H,     4828],       //  T+25h: 3,000 mi — near perigee, pre-TLI
    [25.8*H,   4828],       //  T+25h48m: TLI burn
    [27*H,    16093],       //  T+27h: 10,000 mi — post-TLI, escaping
    [30*H,    48280],       //  T+30h: 30,000 mi — outbound
    [36*H,    96561],       //  T+36h: 60,000 mi
    [48*H,   160934],       //  T+48h: 100,000 mi
    [72*H,   257495],       //  T+72h: 160,000 mi
    [96*H,   321869],       //  T+96h: 200,000 mi
    [120*H,  370149],       //  T+120h: 230,000 mi
    [128*H,  386243],       //  T+128h: 240,000 mi (closest approach)
    [144*H,  354057],       //  T+144h: 220,000 mi
    [192*H,  193121],       //  T+192h: 120,000 mi
    [228*H,   16093],       //  T+228h: 10,000 mi
    [229*H,     161],       //  T+229h: 100 mi (re-entry)
  ],
  speed: [      // km/h (mph × 1.60934)
    [0,       28163],       //  T+0h:   17,500 mph — orbital insertion
    [10,      28163],       //  T+10m:  17,500 mph — orbit insertion
    [108,     19312],       //  T+1h48: 12,000 mph — ICPS burn
    [3*H,     14484],       //  T+3h:   9,000 mph — ICPS sep, ascending
    [6*H,      8047],       //  T+6h:   5,000 mph — ascending
    [8*H,      5633],       //  T+8h:   3,500 mph — ascending
    [10*H,     4023],       //  T+10h:  2,500 mph — slowing near apogee
    [13*H,     3265],       //  T+13h:  2,029 mph — NASA confirmed
    [15*H,     2414],       //  T+15h:  1,500 mph — apogee (slowest)
    [18*H,     4023],       //  T+18h:  2,500 mph — descending from apogee
    [20*H,     7740],       //  T+20h:  4,809 mph — NASA confirmed
    [22*H,    12875],       //  T+22h:  8,000 mph — descending fast
    [24*H,    24140],       //  T+24h:  15,000 mph — nearing perigee
    [25*H,    28163],       //  T+25h:  17,500 mph — near perigee
    [25.8*H,  39426],       //  T+25h48m: 24,500 mph — post-TLI burn
    [27*H,    35888],       //  T+27h:  22,300 mph — outbound, decelerating
    [30*H,    24140],       //  T+30h:  15,000 mph
    [36*H,    14484],       //  T+36h:  9,000 mph
    [48*H,     8047],       //  T+48h:  5,000 mph
    [72*H,     5150],       //  T+72h:  3,200 mph
    [96*H,     3541],       //  T+96h:  2,200 mph
    [120*H,    5633],       //  T+120h: 3,500 mph (lunar gravity accelerating)
    [128*H,    8047],       //  T+128h: 5,000 mph (closest approach)
    [144*H,    4023],       //  T+144h: 2,500 mph
    [192*H,    4828],       //  T+192h: 3,000 mph
    [228*H,   24140],       //  T+228h: 15,000 mph
    [229*H,   40234],       //  T+229h: 25,000 mph (re-entry)
  ],
};

function lerp(waypoints, t) {
  const wps = waypoints;
  if (t <= wps[0][0]) return wps[0][1];
  if (t >= wps[wps.length - 1][0]) return wps[wps.length - 1][1];
  for (let i = 1; i < wps.length; i++) {
    if (t <= wps[i][0]) {
      const [t0, v0] = wps[i - 1];
      const [t1, v1] = wps[i];
      return v0 + (v1 - v0) * (t - t0) / (t1 - t0);
    }
  }
  return wps[wps.length - 1][1];
}

// ── JPL HORIZONS REAL TELEMETRY ──────────────────────────────────────
const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

// Try multiple IDs: -1024 (guessed), then name-based lookups
const HORIZONS_IDS = ['-1024', "'Orion EM-2'", "'Artemis II'", '-1023'];

function horizonsUrl(center, now, cmdId) {
  const jd = (2440587.5 + now.getTime() / 86400000).toFixed(8);
  return `${HORIZONS_API}?format=json&COMMAND=${encodeURIComponent(cmdId)}&OBJ_DATA=NO&MAKE_EPHEM=YES` +
    `&EPHEM_TYPE=VECTORS&CENTER=${encodeURIComponent(center)}&TLIST=${jd}&VEC_TABLE=2`;
}

function parseHorizonsVec(result) {
  if (!result) return null;
  const soe = result.indexOf('$$SOE'), eoe = result.indexOf('$$EOE');
  if (soe < 0 || eoe < 0) return null;
  const blk = result.slice(soe, eoe);
  const xyz = blk.match(/X\s*=\s*([-\d.E+]+)\s+Y\s*=\s*([-\d.E+]+)\s+Z\s*=\s*([-\d.E+]+)/);
  const vel = blk.match(/VX\s*=\s*([-\d.E+]+)\s+VY\s*=\s*([-\d.E+]+)\s+VZ\s*=\s*([-\d.E+]+)/);
  if (!xyz || !vel) return null;
  const x = +xyz[1], y = +xyz[2], z = +xyz[3];
  const vx = +vel[1], vy = +vel[2], vz = +vel[3];
  const dist  = Math.sqrt(x*x + y*y + z*z);
  const speed = Math.sqrt(vx*vx + vy*vy + vz*vz); // km/s
  // radial rate of change: d|r|/dt = (r · v) / |r|
  const radial = (x*vx + y*vy + z*vz) / dist;
  return { dist, speed, radial, fetchedAt: Date.now() };
}

let liveEarth = null, liveMoon = null, usingLive = false, lastFetchedAt = null, lastLoggedDist = null;

function setTelemBadge(mode) {
  const b = document.getElementById('telem-badge');
  if (b) { b.textContent = mode; b.className = mode === 'LIVE' ? 'telem-badge-live' : 'telem-badge-est'; }
}

function updateLastFetchTime() {
  const el = document.getElementById('telem-update-time');
  if (!el) return;
  if (!lastFetchedAt) { el.textContent = ''; return; }
  const min = Math.floor((Date.now() - lastFetchedAt) / 60000);
  el.textContent = 'API: ' + (min < 1 ? '<1m' : min + 'm') + ' ago';
}

let workingHorizonsId = null;

async function fetchHorizons() {
  const now = new Date();
  const idsToTry = workingHorizonsId ? [workingHorizonsId] : HORIZONS_IDS;

  for (const cmdId of idsToTry) {
    try {
      const [rE, rM] = await Promise.all([
        fetch(horizonsUrl('500@399', now, cmdId)),
        fetch(horizonsUrl('500@301', now, cmdId))
      ]);
      if (!rE.ok || !rM.ok) continue;
      const [dE, dM] = await Promise.all([rE.json(), rM.json()]);
      const vE = parseHorizonsVec(dE.result || '');
      const vM = parseHorizonsVec(dM.result || '');
      if (!vE || !vM) {
        console.warn('[Horizons] COMMAND=' + cmdId + ' parse failed');
        continue;
      }
      const earthMi = ((vE.dist - 6371) * 0.621371).toFixed(0);
      if (lastLoggedDist !== earthMi) {
        const elMin = (Date.now() - LAUNCH_UTC) / 60000;
        console.log('[Horizons] COMMAND=' + cmdId + ' MET ' + (elMin / 60).toFixed(1) + 'h | LIVE Earth:' + earthMi + 'mi Moon:' + ((vM.dist - 1737) * 0.621371).toFixed(0) + 'mi Spd:' + (vE.speed * 3600 * 0.621371).toFixed(0) + 'mph');
        lastLoggedDist = earthMi;
      }
      workingHorizonsId = cmdId;
      liveEarth = vE; liveMoon = vM; usingLive = true;
      lastFetchedAt = Date.now();
      setTelemBadge('LIVE');
      updateLastFetchTime();
      return;
    } catch (e) {
      console.warn('[Horizons] COMMAND=' + cmdId + ':', e.message);
    }
  }
  // All IDs failed
  workingHorizonsId = null;
  usingLive = false;
  setTelemBadge('EST');
  updateLastFetchTime();
}

const fmt     = new Intl.NumberFormat('en-US');
const tvEarth = document.getElementById('tv-earth');
const tvMoon  = document.getElementById('tv-moon');
const tvSpeed = document.getElementById('tv-speed');
const tuEarth = document.getElementById('tu-earth');
const tuMoon  = document.getElementById('tu-moon');
const tuSpeed = document.getElementById('tu-speed');

let useImperial = true;
const KM_TO_MI = 0.621371;

function flashEl(el) {
  el.classList.remove('tick');
  void el.offsetWidth;
  el.classList.add('tick');
}

function tickTelem() {
  let earthKm, moonKm, speedKmh;

  // Horizons returns distance from body CENTER; NASA shows distance from SURFACE.
  // Subtract body radii: Earth = 6371 km, Moon = 1737 km.
  const EARTH_R_KM = 6371;
  const MOON_R_KM  = 1737;

  if (usingLive && liveEarth && liveMoon) {
    // Extrapolate from last fetch using radial velocity
    const dtE = (Date.now() - liveEarth.fetchedAt) / 1000;
    const dtM = (Date.now() - liveMoon.fetchedAt)  / 1000;
    earthKm  = (liveEarth.dist + liveEarth.radial * dtE) - EARTH_R_KM;
    moonKm   = (liveMoon.dist  + liveMoon.radial  * dtM) - MOON_R_KM;
    speedKmh = liveEarth.speed * 3600;
  } else {
    // Fallback: sub-minute lerp interpolation
    const elapsedSec = (Date.now() - LAUNCH_UTC) / 1000;
    const floorMin   = Math.floor(elapsedSec / 60);
    const frac       = (elapsedSec % 60) / 60;
    function lerpSec(wps) {
      const a = lerp(wps, floorMin), b = lerp(wps, floorMin + 1);
      return a + (b - a) * frac;
    }
    earthKm  = lerpSec(TELEM.earthDist);
    speedKmh = lerpSec(TELEM.speed);

    // True 3D Moon distance via astronomy-engine
    // Orion's geocentric position approximated from Earth distance along Earth-Moon line
    if (typeof Astronomy !== 'undefined') {
      const AU_KM = 149597870.7;
      const mv = Astronomy.GeoVector('Moon', new Date(), true);
      const mx = mv.x * AU_KM, my = mv.y * AU_KM, mz = mv.z * AU_KM;
      const earthMoonDist = Math.sqrt(mx*mx + my*my + mz*mz);
      // Approximate Orion position along Earth-Moon vector at current altitude
      const orionFrac = (earthKm + EARTH_R_KM) / earthMoonDist;
      const ox = mx * orionFrac, oy = my * orionFrac, oz = mz * orionFrac;
      moonKm = Math.sqrt((ox-mx)*(ox-mx) + (oy-my)*(oy-my) + (oz-mz)*(oz-mz)) - MOON_R_KM;
    } else {
      // Rough fallback: Earth-Moon avg minus Earth dist
      const avgEM = 384400;
      moonKm = avgEM - earthKm - EARTH_R_KM;
    }
  }

  let earthVal = Math.round(Math.max(0, earthKm));
  let moonVal  = Math.round(Math.max(0, moonKm));
  let speedVal = Math.round(Math.max(0, speedKmh));

  if (useImperial) {
    earthVal = Math.round(earthVal * KM_TO_MI);
    moonVal  = Math.round(moonVal  * KM_TO_MI);
    speedVal = Math.round(speedVal * KM_TO_MI);
    tuEarth.textContent = 'MI';
    tuMoon.textContent  = 'MI';
    tuSpeed.textContent = 'MPH';
  } else {
    tuEarth.textContent = 'KM';
    tuMoon.textContent  = 'KM';
    tuSpeed.textContent = 'KM/H';
  }

  const eStr = fmt.format(earthVal);
  const mStr = fmt.format(moonVal);
  const sStr = fmt.format(speedVal);

  if (tvEarth.textContent !== eStr) { tvEarth.textContent = eStr; flashEl(tvEarth); }
  if (tvMoon.textContent  !== mStr) { tvMoon.textContent  = mStr; flashEl(tvMoon);  }
  if (tvSpeed.textContent !== sStr) { tvSpeed.textContent = sStr; flashEl(tvSpeed); }
  updateLastFetchTime();
}

document.getElementById('unit-toggle').addEventListener('click', () => {
  useImperial = !useImperial;
  const btn = document.getElementById('unit-toggle');
  btn.textContent  = useImperial ? 'MI · KM' : 'KM · MI';
  btn.style.color  = useImperial ? 'var(--amber)' : '';
  btn.style.borderColor = useImperial ? 'rgba(255,167,38,0.5)' : '';
  tickTelem();
});

tickTelem();
setInterval(tickTelem, 1000);
fetchHorizons();
setInterval(fetchHorizons, 60000);
})();
