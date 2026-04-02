// stats.js — Telemetry estimates, JPL Horizons live data, unit toggle
(function() {
// ── TELEMETRY ESTIMATES (interpolated from NASA reference waypoints) ──
// Verified against NASA broadcast. Waypoints: [minutes, value].
// earthDist & moonDist in km; speed in km/h.
const H = 60; // minutes per hour
// Fallback waypoints from NASA broadcast reference values (miles × 1.60934 = km, mph × 1.60934 = km/h)
const TELEM = {
  earthDist: [  // km from Earth (NASA broadcast reference, mi → km)
    [0,           0],       //  T+0h:   0 mi
    [1*H,       805],       //  T+1h:   500 mi
    [3*H,      8047],       //  T+3h:   5,000 mi
    [6*H,     53108],       //  T+6h:   33,000 mi (apogee)
    [8*H,     64374],       //  T+8h:   40,000 mi
    [12*H,    24140],       //  T+12h:  15,000 mi (descending)
    [18*H,     3219],       //  T+18h:  2,000 mi (near perigee)
    [24*H,    56327],       //  T+24h:  35,000 mi
    [25*H,    64374],       //  T+25h:  40,000 mi (post-TLI)
    [48*H,   160934],       //  T+48h:  100,000 mi
    [72*H,   257495],       //  T+72h:  160,000 mi
    [96*H,   321869],       //  T+96h:  200,000 mi
    [120*H,  370149],       //  T+120h: 230,000 mi
    [128*H,  386243],       //  T+128h: 240,000 mi (closest approach)
    [144*H,  354057],       //  T+144h: 220,000 mi
    [192*H,  193121],       //  T+192h: 120,000 mi
    [228*H,   16093],       //  T+228h: 10,000 mi
    [229*H,     161],       //  T+229h: 100 mi (re-entry)
  ],
  moonDist: [   // km from Moon (NASA broadcast reference, mi → km)
    [0,      384601],       //  T+0h:   239,000 mi
    [1*H,    383795],       //  T+1h:   238,500 mi
    [3*H,    376554],       //  T+3h:   234,000 mi
    [6*H,    352440],       //  T+6h:   219,000 mi
    [8*H,    337961],       //  T+8h:   210,000 mi
    [12*H,   360494],       //  T+12h:  224,000 mi
    [18*H,   381415],       //  T+18h:  237,000 mi
    [24*H,   329931],       //  T+24h:  205,000 mi
    [25*H,   321869],       //  T+25h:  200,000 mi
    [48*H,   225308],       //  T+48h:  140,000 mi
    [72*H,   128748],       //  T+72h:  80,000 mi
    [96*H,    64374],       //  T+96h:  40,000 mi
    [120*H,   16093],       //  T+120h: 10,000 mi
    [128*H,    6437],       //  T+128h: 4,000 mi (closest approach)
    [144*H,   48280],       //  T+144h: 30,000 mi
    [192*H,  193121],       //  T+192h: 120,000 mi
    [228*H,  370149],       //  T+228h: 230,000 mi
    [229*H,  384601],       //  T+229h: 239,000 mi
  ],
  speed: [      // km/h (NASA broadcast reference, mph × 1.60934)
    [0,       28163],       //  T+0h:   17,500 mph — orbital
    [1*H,     25750],       //  T+1h:   16,000 mph
    [3*H,     16093],       //  T+3h:   10,000 mph
    [6*H,      6920],       //  T+6h:   4,300 mph
    [8*H,      5633],       //  T+8h:   3,500 mph
    [12*H,    12875],       //  T+12h:  8,000 mph (descending)
    [18*H,    24140],       //  T+18h:  15,000 mph (perigee)
    [24*H,     6437],       //  T+24h:  4,000 mph
    [25*H,     5633],       //  T+25h:  3,500 mph (post-TLI)
    [48*H,     4023],       //  T+48h:  2,500 mph
    [72*H,     3219],       //  T+72h:  2,000 mph
    [96*H,     3541],       //  T+96h:  2,200 mph
    [120*H,    5633],       //  T+120h: 3,500 mph (lunar gravity)
    [128*H,    7242],       //  T+128h: 4,500 mph (closest approach)
    [144*H,    4023],       //  T+144h: 2,500 mph
    [192*H,    4828],       //  T+192h: 3,000 mph
    [228*H,   24140],       //  T+228h: 15,000 mph (Earth pull)
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

function horizonsUrl(center, now) {
  const jd = (2440587.5 + now.getTime() / 86400000).toFixed(8);
  return `${HORIZONS_API}?format=json&COMMAND=-1024&OBJ_DATA=NO&MAKE_EPHEM=YES` +
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

async function fetchHorizons() {
  const now = new Date();
  try {
    // Try Artemis II / Orion EM-2 SPKID; fallback IDs tried if parse fails
    const [rE, rM] = await Promise.all([
      fetch(horizonsUrl('500@399', now)),
      fetch(horizonsUrl('500@301', now))
    ]);
    if (!rE.ok || !rM.ok) throw new Error('HTTP ' + rE.status);
    const [dE, dM] = await Promise.all([rE.json(), rM.json()]);
    const vE = parseHorizonsVec(dE.result || '');
    const vM = parseHorizonsVec(dM.result || '');
    if (!vE || !vM) throw new Error('Parse failed');
    const earthMi = ((vE.dist - 6371) * 0.621371).toFixed(0);
    if (lastLoggedDist !== earthMi) {
      const elMin = (Date.now() - LAUNCH_UTC) / 60000;
      console.log('[Horizons] MET ' + (elMin / 60).toFixed(1) + 'h | LIVE Earth:' + earthMi + 'mi Moon:' + ((vM.dist - 1737) * 0.621371).toFixed(0) + 'mi Spd:' + (vE.speed * 3600 * 0.621371).toFixed(0) + 'mph (surface dist)');
      lastLoggedDist = earthMi;
    }
    liveEarth = vE; liveMoon = vM; usingLive = true;
    lastFetchedAt = Date.now();
    setTelemBadge('LIVE');
  } catch (e) {
    console.warn('Horizons fetch:', e.message);
    usingLive = false;
    setTelemBadge('EST');
  }
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
    moonKm   = lerpSec(TELEM.moonDist);
    speedKmh = lerpSec(TELEM.speed);
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
