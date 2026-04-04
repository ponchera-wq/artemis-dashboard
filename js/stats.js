// stats.js — Telemetry display from shared ephemeris, unit toggle
(function() {

const fmt     = new Intl.NumberFormat('en-US');
const tvEarth = document.getElementById('tv-earth');
const tvMoon  = document.getElementById('tv-moon');
const tvSpeed = document.getElementById('tv-speed');
const tuEarth = document.getElementById('tu-earth');
const tuMoon  = document.getElementById('tu-moon');
const tuSpeed = document.getElementById('tu-speed');

const elAnalogy    = document.getElementById('stat-earth-analogy');
const elSplashdown = document.getElementById('splashdown-countdown');
const elPerilune   = document.getElementById('perilune-countdown');

let odoTickCount = 0;

let useImperial = false;
const KM_TO_MI = 0.621371;

function pad(n) { return ('0' + n).slice(-2); }

function setTelemBadge(mode) {
  const b = document.getElementById('telem-badge');
  if (b) { b.textContent = mode; b.className = (mode === 'LIVE' || mode === 'OEM') ? 'telem-badge-live' : 'telem-badge-est'; }
}

function flashEl(el) {
  el.classList.remove('tick');
  void el.offsetWidth;
  el.classList.add('tick');
}

function distAnalogy(km) {
  if (!km || km < 0 || isNaN(km)) return '';
  var EARTH_CIRC = 40075;
  var EARTH_MOON = 384400;
  var EARTH_DIAM = 12742;
  if (km < 50000) {
    return (km / EARTH_DIAM).toFixed(1) + '\u00d7 Earth diameter';
  } else if (km < 300000) {
    return (km / EARTH_MOON * 100).toFixed(0) + '% of Earth\u2013Moon dist';
  } else if (km < 800000) {
    return (km / EARTH_CIRC).toFixed(1) + '\u00d7 Earth circumference';
  } else {
    return (km / EARTH_MOON).toFixed(2) + '\u00d7 Earth\u2013Moon dist';
  }
}

function tickSplashdown() {
  if (!elSplashdown || typeof SPLASHDOWN_UTC === 'undefined') return;
  var diff = SPLASHDOWN_UTC - Date.now();
  var str, cls = 'stat-value';
  if (diff > 0) {
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    str = d > 0 ? d + 'd ' + pad(h) + ':' + pad(m) + ':' + pad(s)
                : pad(h) + ':' + pad(m) + ':' + pad(s);
    if (diff < 3600000) cls += ' warn';
  } else {
    str = 'SPLASHED DOWN';
    cls += ' complete';
  }
  elSplashdown.textContent = str;
  elSplashdown.className = cls;
}

function tickPerilune() {
  if (!elPerilune || typeof PERILUNE_UTC === 'undefined') return;
  var diff = PERILUNE_UTC - Date.now();
  var absDiff = Math.abs(diff);
  var str, cls = 'stat-value';
  if (absDiff < 30 * 60 * 1000) {
    str = 'IN PROGRESS';
    cls += ' warn';
  } else if (diff < 0) {
    var agoMin = Math.floor(-diff / 60000);
    str = agoMin < 60
      ? 'COMPLETED \u2713  ' + agoMin + 'm ago'
      : 'COMPLETED \u2713  ' + Math.floor(agoMin / 60) + 'h ago';
    cls += ' complete';
  } else {
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    str = d > 0 ? d + 'd ' + pad(h) + ':' + pad(m) + ':' + pad(s)
                : pad(h) + ':' + pad(m) + ':' + pad(s);
    if (diff < 6 * 3600000) cls += ' imminent';
  }
  elPerilune.textContent = str;
  elPerilune.className = cls;
}

function tickTelem() {
  if (!tvEarth || !tvMoon || !tvSpeed || !tuEarth || !tuMoon || !tuSpeed) return;
  var metSec = (Date.now() - LAUNCH_UTC) / 1000;
  var state = MissionEphemeris.getState(metSec);

  var earthKm = state.distEarthKm;
  var moonKm  = state.distMoonKm;
  var speedKmh = state.speedKms * 3600; // km/s -> km/h

  // Badge: OEM data vs out-of-range estimate
  setTelemBadge(state.inDataRange ? 'OEM' : 'EST');

  // Update shared dashboard state
  if (window.dashboardState) {
    window.dashboardState.usingLive = state.inDataRange;
  }

  var earthVal = Math.round(Math.max(0, earthKm));
  var moonVal  = Math.round(Math.max(0, moonKm));
  var speedVal = Math.round(Math.max(0, speedKmh));

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

  var eStr = (state.earthSign || '') + (state.earthSign ? ' ' : '') + fmt.format(earthVal);
  var mStr = (state.moonSign || '') + (state.moonSign ? ' ' : '') + fmt.format(moonVal);
  var sStr = fmt.format(speedVal);

  if (tvEarth.textContent !== eStr) { tvEarth.textContent = eStr; flashEl(tvEarth); }
  if (tvMoon.textContent  !== mStr) { tvMoon.textContent  = mStr; flashEl(tvMoon);  }
  if (tvSpeed.textContent !== sStr) { tvSpeed.textContent = sStr; flashEl(tvSpeed); }

  // Distance analogy (always km, regardless of unit toggle)
  if (elAnalogy) elAnalogy.textContent = distAnalogy(state.distEarthKm);

  // ── Odometer (update every 5 ticks to avoid O(n) every second) ──
  odoTickCount++;
  if (odoTickCount === 1 || odoTickCount % 5 === 0) {
    var odoKm = window.computeOdometer(metSec);
    var odoEl = document.getElementById('stat-odometer');
    var odoSubEl = document.getElementById('stat-odometer-sub');
    if (odoEl) odoEl.textContent = Math.round(odoKm).toLocaleString();
    if (odoSubEl) odoSubEl.textContent = (odoKm / 40075).toFixed(1) + '\u00d7 Earth circumference';
  }

  // ── Apollo 13 comparison ─────────────────────────────────────────
  var a13km = window.getApollo13DistAtMet(metSec);
  var currentKm = state.distEarthKm;
  var a13El = document.getElementById('stat-apollo13');
  var a13SubEl = document.getElementById('stat-apollo13-sub');
  if (a13El) a13El.textContent = Math.round(a13km).toLocaleString();
  if (a13SubEl) {
    var diff = currentKm - a13km;
    var sign = diff >= 0 ? '+' : '';
    if (metSec < 692700) {
      a13SubEl.textContent = 'Artemis II is ' + sign +
        Math.round(Math.abs(diff)).toLocaleString() +
        ' km ' + (diff >= 0 ? 'further' : 'closer');
    } else {
      a13SubEl.textContent = 'A13 had splashed down by now';
    }
  }

  // ── G-force readout ──────────────────────────────────────────────
  var gf = window.computeGforce(metSec);
  var gfEl = document.getElementById('stat-gforce');
  if (gfEl) {
    gfEl.textContent = gf.toFixed(3) + ' G';
    gfEl.className = 'stat-value' + (gf > 0.05 ? ' warn' : ' good');
  }
  var gfSubEl = document.getElementById('stat-gforce-sub');
  if (gfSubEl) {
    if (gf < 0.005) gfSubEl.textContent = 'FREEFALL COAST';
    else if (gf < 0.05) gfSubEl.textContent = 'MINOR MANOEUVRE';
    else if (gf < 0.5) gfSubEl.textContent = 'THRUSTER BURN';
    else gfSubEl.textContent = 'MAJOR BURN';
  }

  // Countdown clocks
  tickSplashdown();
  tickPerilune();
}

var _unitToggle = document.getElementById('unit-toggle');
if (_unitToggle) _unitToggle.addEventListener('click', function() {
  useImperial = !useImperial;
  var btn = document.getElementById('unit-toggle');
  if (btn) {
    btn.textContent  = useImperial ? 'MI - KM' : 'KM - MILES';
    btn.style.color  = useImperial ? 'var(--amber)' : '';
    btn.style.borderColor = useImperial ? 'rgba(255,167,38,0.5)' : '';
  }
  // Notify other components (like DSN) of the unit change
  window.dispatchEvent(new CustomEvent('unitschanged', { detail: { units: useImperial ? 'MI' : 'KM' } }));
  tickTelem();
});

// Wait for ephemeris data before starting ticks
MissionEphemeris.ready.then(function() {
  tickTelem();
  setInterval(tickTelem, 1000);
});

})();

