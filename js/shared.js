// ══════════════════════════════════════════════════════════════════════
// shared.js — Global constants, timezone helpers, shared state
// ══════════════════════════════════════════════════════════════════════

window.NASA_API_KEY = 'NkWaGNE5rQyjA2k7cwhJhPzzSblE9MILSMEBP6yD';
window.LAUNCH_UTC = new Date('2026-04-01T22:35:00Z');

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

// Shared state object for cross-module communication
window.dashboardState = {
  useImperial: true,
  KM_TO_MI: 0.621371,
  usingLive: false,
  currentPhase: null,
  elapsed: 0
};
