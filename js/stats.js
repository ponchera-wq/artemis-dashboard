// stats.js — Telemetry display from shared ephemeris, unit toggle
(function() {

const fmt     = new Intl.NumberFormat('en-US');
const tvEarth = document.getElementById('tv-earth');
const tvMoon  = document.getElementById('tv-moon');
const tvSpeed = document.getElementById('tv-speed');
const tuEarth = document.getElementById('tu-earth');
const tuMoon  = document.getElementById('tu-moon');
const tuSpeed = document.getElementById('tu-speed');

let useImperial = true;
const KM_TO_MI = 0.621371;

function setTelemBadge(mode) {
  const b = document.getElementById('telem-badge');
  if (b) { b.textContent = mode; b.className = (mode === 'LIVE' || mode === 'OEM') ? 'telem-badge-live' : 'telem-badge-est'; }
}

function flashEl(el) {
  el.classList.remove('tick');
  void el.offsetWidth;
  el.classList.add('tick');
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

  var eStr = fmt.format(earthVal);
  var mStr = fmt.format(moonVal);
  var sStr = fmt.format(speedVal);

  if (tvEarth.textContent !== eStr) { tvEarth.textContent = eStr; flashEl(tvEarth); }
  if (tvMoon.textContent  !== mStr) { tvMoon.textContent  = mStr; flashEl(tvMoon);  }
  if (tvSpeed.textContent !== sStr) { tvSpeed.textContent = sStr; flashEl(tvSpeed); }
}

document.getElementById('unit-toggle').addEventListener('click', function() {
  useImperial = !useImperial;
  var btn = document.getElementById('unit-toggle');
  btn.textContent  = useImperial ? 'MILES - KILOMETERS' : 'KM - MILES';
  btn.style.color  = useImperial ? 'var(--amber)' : '';
  btn.style.borderColor = useImperial ? 'rgba(255,167,38,0.5)' : '';
  tickTelem();
});

// Wait for ephemeris data before starting ticks
MissionEphemeris.ready.then(function() {
  tickTelem();
  setInterval(tickTelem, 1000);
});

})();
