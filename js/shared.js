// ══════════════════════════════════════════════════════════════════════
// shared.js — Global constants, timezone helpers, shared state
// ══════════════════════════════════════════════════════════════════════

window.NASA_API_KEY = 'NkWaGNE5rQyjA2k7cwhJhPzzSblE9MILSMEBP6yD';
window.LAUNCH_UTC = new Date('2026-04-01T22:35:12Z');
/* Splashdown per NASA final timeline T+9/01:46 = MET 783,960 s ≈ 2026-04-11T00:21Z */
window.SPLASHDOWN_MET_SEC = 783960;
window.SPLASHDOWN_UTC = new Date(window.LAUNCH_UTC.getTime() + window.SPLASHDOWN_MET_SEC * 1000);
window.PERILUNE_MET_SEC = 434079;
window.PERILUNE_UTC = new Date(window.LAUNCH_UTC.getTime() + window.PERILUNE_MET_SEC * 1000);

// ── Scrub state shim ──
// Archive page (artemis-ii.html) sets window.ARCHIVE_MODE = true and controls
// window._scrubMetSec via the scrub bar. Hub (index.html) leaves ARCHIVE_MODE
// undefined and this falls through to live wall-clock MET.
window.getScrubMetSec = function() {
  if (window.ARCHIVE_MODE === true && typeof window._scrubMetSec === 'number') {
    return window._scrubMetSec;
  }
  return (Date.now() - LAUNCH_UTC) / 1000;
};

window.getScrubMetMs = function() {
  return window.getScrubMetSec() * 1000;
};

window.userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

window.tzAbbr = function(date) {
  var part = new Intl.DateTimeFormat('en', { timeZoneName: 'short', timeZone: window.userTZ })
    .formatToParts(date || new Date()).find(function(p) { return p.type === 'timeZoneName'; });
  return part ? part.value : window.userTZ;
};

window.fmtLocal = function(date, includeDate) {
  var opts = { timeZone: window.userTZ, hour: '2-digit', minute: '2-digit', hour12: true };
  if (includeDate) Object.assign(opts, { month: 'short', day: 'numeric' });
  return new Intl.DateTimeFormat('en', opts).format(date);
};

window.fmtUTC = function(date) {
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(date) + ' UTC';
};

// ── Cumulative distance odometer (total path length, km) ─────────────────
window.computeOdometer = function(metSec) {
  var pts = MissionEphemeris.points;
  if (!pts || pts.length < 2) return 0;
  var total = 0;
  var lastPt = pts[0];
  var i;
  for (i = 1; i < pts.length; i++) {
    if (pts[i].metSec > metSec) break;
    var dx = pts[i].orion.x - pts[i-1].orion.x;
    var dy = pts[i].orion.y - pts[i-1].orion.y;
    var dz = pts[i].orion.z - pts[i-1].orion.z;
    total += Math.sqrt(dx*dx + dy*dy + dz*dz);
    lastPt = pts[i];
  }
  
  // Linearly interpolate the final leg if we broke out before hitting the exact waypoint
  if (i < pts.length && lastPt.metSec < metSec) {
    var p0 = pts[i-1];
    var p1 = pts[i];
    var f = (metSec - p0.metSec) / (p1.metSec - p0.metSec);
    var ix = p0.orion.x + (p1.orion.x - p0.orion.x) * f;
    var iy = p0.orion.y + (p1.orion.y - p0.orion.y) * f;
    var iz = p0.orion.z + (p1.orion.z - p0.orion.z) * f;
    
    var fdx = ix - p0.orion.x;
    var fdy = iy - p0.orion.y;
    var fdz = iz - p0.orion.z;
    total += Math.sqrt(fdx*fdx + fdy*fdy + fdz*fdz);
  }
  return total; // km
};

// ── G-force from velocity delta between ephemeris points ──────────────────
window.computeGforce = function(metSec) {
  var pts = MissionEphemeris.points;
  if (!pts || pts.length < 2) return 0;
  var lo = 0, hi = pts.length - 1;
  for (var i = 0; i < pts.length - 1; i++) {
    if (pts[i].metSec <= metSec && pts[i+1].metSec > metSec) {
      lo = i; hi = i + 1; break;
    }
  }
  var dt = pts[hi].metSec - pts[lo].metSec;
  if (dt <= 0) return 0;
  var dvx = pts[hi].orion.vx - pts[lo].orion.vx;
  var dvy = pts[hi].orion.vy - pts[lo].orion.vy;
  var dvz = pts[hi].orion.vz - pts[lo].orion.vz;
  var accel = Math.sqrt(dvx*dvx + dvy*dvy + dvz*dvz) / dt; // km/s²
  return accel / 0.00981; // convert to G
};

// Shared state object for cross-module communication
window.dashboardState = {
  useImperial: true,
  KM_TO_MI: 0.621371,
  KM_TO_LD: 1 / 384400.0,
  usingLive: false,
  currentPhase: null,
  elapsed: 0,
  // Cross-module HUD data (set by respective modules)
  dsnStation: null,
  kpIndex: null,
  xrayFlux: null,
  solarWind: null,
  nextEvent: null,
  nextEventEta: null
};

// Single 1 Hz clock for dashboard modules (clock.js, stats.js, ui.js overlay)
(function() {
  function emitDashboardTick() {
    window.dispatchEvent(new Event('dashboard-tick'));
  }
  setTimeout(function() {
    emitDashboardTick();
    setInterval(emitDashboardTick, 1000);
  }, 0);
})();
