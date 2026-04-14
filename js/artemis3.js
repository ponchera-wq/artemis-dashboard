// artemis3.js — Artemis III Hub entry point
// Handles countdown logic, top-bar status strip, and crew TBA cards.
// Loaded by index.html; wraps everything in an IIFE except explicit globals.

(function () {
  'use strict';

  // ── STUBS FOR REMOVED MODULES ────────────────────────────────────────
// ui.js (mobile branch, line 541) accesses window.MissionEphemeris.ready
// without a guard. Stub it so the hub doesn't throw on mobile viewports.
window.MissionEphemeris = window.MissionEphemeris || {
  ready: Promise.resolve(),
  meta: {}
};

// ── LAUNCH TARGET ────────────────────────────────────────────────────
  // NET July 1 2027 00:00:00 UTC (tentative; NASA has not published a firm date)
  // IMPORTANT: Date.UTC month is 0-indexed — January = 0, July = 6.
  window.ARTEMIS3_LAUNCH_UTC = Date.UTC(2027, 6, 1, 0, 0, 0);

  var LAUNCH_MS = window.ARTEMIS3_LAUNCH_UTC;

  // ── COUNTDOWN MATH ──────────────────────────────────────────────────
  // Given the current time in ms, returns a decomposed countdown object.
  //
  //   diff = LAUNCH_MS - nowMs
  //   diff > 0  →  future  →  T- (counting down to launch)
  //   diff < 0  →  past    →  T+ (mission elapsed since launch)
  //
  // The absolute value is split into d / h / m / s components.
  function parseCountdown(nowMs) {
    var diff     = LAUNCH_MS - nowMs;
    var isFuture = diff >= 0;
    var abs      = Math.abs(diff);

    // Break absolute ms into components
    var totalSec = Math.floor(abs / 1000);
    var s        = totalSec % 60;
    var totalMin = Math.floor(totalSec / 60);
    var m        = totalMin % 60;
    var totalHr  = Math.floor(totalMin / 60);
    var h        = totalHr % 24;
    var d        = Math.floor(totalHr / 24);

    return {
      sign:      isFuture ? 'T\u2212' : 'T+',  // T− or T+
      d:         d,
      hh:        String(h).padStart(2, '0'),
      mm:        String(m).padStart(2, '0'),
      ss:        String(s).padStart(2, '0'),
      totalDays: d,
      isFuture:  isFuture,
    };
  }

  function el(id) { return document.getElementById(id); }

  // ── TICK ─────────────────────────────────────────────────────────────
  // Runs every second via the shared dashboard-tick event (dispatched by
  // shared.js's 1 Hz setInterval). Also called once on load so the page
  // doesn't show blank digits before the first tick fires.
  function tickHub() {
    var cd = parseCountdown(Date.now());

    // Hero countdown — individual digit spans
    var heroD    = el('hero-cd-days');
    var heroH    = el('hero-cd-hours');
    var heroM    = el('hero-cd-minutes');
    var heroS    = el('hero-cd-seconds');
    var heroSign = el('hero-cd-sign');

    if (heroD)    heroD.textContent    = cd.d;
    if (heroH)    heroH.textContent    = cd.hh;
    if (heroM)    heroM.textContent    = cd.mm;
    if (heroS)    heroS.textContent    = cd.ss;
    if (heroSign) heroSign.textContent = cd.sign;

    // Top-bar pill — "DAYS TO LAUNCH" big number
    var tbDays = el('tb-days-to-launch');
    if (tbDays) {
      // Before launch: plain number.  After launch: T+<n>.
      tbDays.textContent = cd.isFuture
        ? String(cd.totalDays)
        : 'T+' + String(cd.totalDays);
    }
  }

  // ── CREW TBA CARDS ───────────────────────────────────────────────────
  // Four seat slots; crew assignment is TBA. renderCrewTBA() populates
  // #crew-tba-grid with placeholder cards.
  var CREW_SLOTS = [
    { n: 1, role: 'COMMANDER' },
    { n: 2, role: 'PILOT' },
    { n: 3, role: 'MISSION SPECIALIST 1' },
    { n: 4, role: 'MISSION SPECIALIST 2' },
  ];

  function renderCrewTBA() {
    var grid = el('crew-tba-grid');
    if (!grid) return;
    grid.innerHTML = CREW_SLOTS.map(function (slot) {
      return (
        '<div class="crew-tba-card">' +
        '<div class="crew-tba-avatar">?</div>' +
        '<div class="crew-tba-slot">SEAT ' + slot.n + '</div>' +
        '<div class="crew-tba-role">' + slot.role + '</div>' +
        '<div class="crew-tba-status">TO BE ANNOUNCED</div>' +
        '</div>'
      );
    }).join('');
  }

  // ── STATUS PILLS ─────────────────────────────────────────────────────
  // Fetch data/program-status.json and populate the three pill spans.
  function initStatusPills() {
    fetch('data/program-status.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        ['sls', 'orion', 'crew'].forEach(function (key) {
          var d = data[key];
          if (!d) return;
          var labelEl = document.getElementById('pill-' + key + '-label');
          var pillEl  = document.getElementById('pill-' + key);
          if (labelEl) labelEl.textContent = d.label;
          if (pillEl)  { pillEl.textContent = d.status; pillEl.className = 'status-pill ' + d.color; }
        });
      });
  }

  // ── INIT ─────────────────────────────────────────────────────────────
  // Hook tickHub to the shared 1 Hz event bus.
  window.addEventListener('dashboard-tick', tickHub);

  // Render immediately — don't wait for the first tick.
  tickHub();
  renderCrewTBA();
  initStatusPills();

}());
