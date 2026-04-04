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

document.getElementById('unit-toggle').addEventListener('click', function() {
  useImperial = !useImperial;
  var btn = document.getElementById('unit-toggle');
  if (btn) {
    btn.textContent  = useImperial ? 'MI - KM' : 'KM - MILES';
    btn.style.color  = useImperial ? 'var(--amber)' : '';
    btn.style.borderColor = useImperial ? 'rgba(255,167,38,0.5)' : '';
  }
  tickTelem();
});

// ── MINI OBSERVER WIDGET ──────────────────────────────────────────────
function updateMiniObserver() {
  var latR = localStorage.getItem('observer_lat');
  var lonR = localStorage.getItem('observer_lon');
  var nextPassEl = document.getElementById('mini-obs-next-pass');
  var statusEl = document.getElementById('mini-obs-status');
  
  if (!nextPassEl || !statusEl) return;

  if (!latR || !lonR) {
    nextPassEl.innerHTML = '<a href="observer.html" style="color:var(--amber);text-decoration:none;">LOCATION NOT SET. Click to calibrate.</a>';
    statusEl.style.display = 'none';
    return;
  }
  statusEl.style.display = 'inline-block';

  var lat = parseFloat(latR);
  var lon = parseFloat(lonR);

  // Time formatting
  var tzAbbr = (function() {
      try {
          var parts = new Intl.DateTimeFormat([], { timeZoneName: 'short' }).formatToParts(new Date());
          var match = parts.find(function(p) { return p.type === 'timeZoneName'; });
          return match ? match.value : '';
      } catch(e) { return ''; }
  })();
  function fmtTime(ms) {
      var t = new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      return tzAbbr ? t + ' ' + tzAbbr : t;
  }

  // Get metrics
  if (window.ObserverAstro && window.MissionEphemeris) {
    var nowMs = Date.now();
    var metSec = window.MissionEphemeris.getMetSec(nowMs);
    var m = window.ObserverAstro.calculateMetrics(metSec, nowMs, lat, lon, 0);
    
    // Status
    if (m && m.orion.altitude > 0) {
      if (m.sun.altitude < -18) {
         statusEl.textContent = 'VISIBLE IN TRUE NIGHT';
         statusEl.style.background = 'rgba(0, 230, 118, 0.1)';
         statusEl.style.color = '#00e676';
         statusEl.style.borderColor = 'rgba(0, 230, 118, 0.5)';
      } else {
         statusEl.textContent = 'ABOVE HORIZON (DAY/TWILIGHT)';
         statusEl.style.background = 'rgba(255, 167, 38, 0.1)';
         statusEl.style.color = '#ffa726';
         statusEl.style.borderColor = 'rgba(255, 167, 38, 0.5)';
      }
    } else {
      statusEl.textContent = 'BELOW HORIZON';
      statusEl.style.background = 'rgba(255, 80, 80, 0.1)';
      statusEl.style.color = '#ff5050';
      statusEl.style.borderColor = 'rgba(255, 80, 80, 0.5)';
    }

    // Windows
    var wins = window.ObserverAstro.calculateViewingWindows(lat, lon, nowMs, metSec, 0);
    if (!wins || wins.length === 0) {
      nextPassEl.textContent = 'NEXT PASS: NONE IN 24H';
    } else {
      var w = wins[0];
      var diffMs = w.startMs - nowMs;
      var inHours = Math.floor(diffMs / 3600000);
      var inMins  = Math.floor((diffMs % 3600000) / 60000);
      var countStr = diffMs > 0 ? '(in ' + (inHours > 0 ? inHours + 'h ' : '') + inMins + 'm)' : '(NOW)';
      nextPassEl.textContent = 'NEXT PASS: ' + fmtTime(w.startMs) + ' ' + countStr + ' • Peak ' + w.peakAlt.toFixed(0) + '°';
    }
  }
}

// Mini observer info tooltip
document.addEventListener('click', function(e) {
  var obsBtn = e.target.closest('#mini-obs-info');
  var swTooltip = document.getElementById('sw-tooltip'); // Use existing tooltip container
  
  if (obsBtn && swTooltip) {
    var titleEl = document.getElementById('sw-tt-title');
    var eli5El = document.getElementById('sw-tt-eli5');
    var scaleEl = document.getElementById('sw-tt-scale');
    var whyEl = document.getElementById('sw-tt-why');
    
    if (titleEl) titleEl.textContent = 'LOCAL OBSERVER MODE';
    if (eli5El) eli5El.textContent = 'Observer Mode calculates exactly where to point your telescope from your backyard. Click to see the full celestial map and imaging guide.';
    if (scaleEl) scaleEl.textContent = '';
    if (whyEl) whyEl.textContent = '';
    
    var r = obsBtn.getBoundingClientRect();
    swTooltip.style.top = (r.bottom + window.scrollY + 8) + 'px';
    swTooltip.style.left = (r.left + window.scrollX - 200) + 'px'; // adjust so it stays on screen
    swTooltip.classList.add('visible');
    e.stopPropagation();
  }
});

// Wait for ephemeris data before starting ticks
MissionEphemeris.ready.then(function() {
  tickTelem();
  setInterval(tickTelem, 1000);

  updateMiniObserver();
  setInterval(updateMiniObserver, 60000); // 1 minute
});

})();

