// scrub-bar.js — Archive scrub bar (artemis-ii.html only)
// Injects a fixed bottom bar with play/pause, speed toggle, slider, and MET readout.
// Does nothing on index.html (ARCHIVE_MODE not set).
(function() {
  'use strict';

  if (window.ARCHIVE_MODE !== true) return;

  // ── Constants ────────────────────────────────────────────────────────────
  var MET_MIN = 0;
  var MET_MAX = 783960; // splashdown

  // Phase boundaries (minutes from launch) — mirrors clock.js PHASES
  var PHASE_BOUNDARIES = [
    { label: 'LAUNCH',         startSec: 0 },
    { label: 'EARTH ORBIT',    startSec: 12 * 60 },
    { label: 'TLI BURN',       startSec: 25 * 60 * 60 },
    { label: 'OUTBOUND COAST', startSec: (25 * 60 + 30) * 60 },
    { label: 'LUNAR FLYBY',    startSec: 4 * 24 * 3600 },
    { label: 'RETURN COAST',   startSec: 5 * 24 * 3600 },
    { label: 'ENTRY',          startSec: 13050 * 60 },
    { label: 'SPLASHDOWN',     startSec: 13066 * 60 },
  ];

  var SPEEDS = [1, 100, 1000];
  var speedIdx = 1; // start at 100×
  var playing = false;
  var rafId = null;
  var lastRafTime = null;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function getPhaseLabel(metSec) {
    for (var i = PHASE_BOUNDARIES.length - 1; i >= 0; i--) {
      if (metSec >= PHASE_BOUNDARIES[i].startSec) return PHASE_BOUNDARIES[i].label;
    }
    return 'PRE-LAUNCH';
  }

  function formatMET(metSec) {
    var s = Math.floor(metSec) % 60;
    var m = Math.floor(metSec / 60) % 60;
    var h = Math.floor(metSec / 3600) % 24;
    var d = Math.floor(metSec / 86400);
    return 'MET D+' + String(d).padStart(3, '0') + ' ' +
      String(h).padStart(2, '0') + ':' +
      String(m).padStart(2, '0') + ':' +
      String(s).padStart(2, '0');
  }

  function dispatchScrub(metSec) {
    window._scrubMetSec = metSec;
    window.dispatchEvent(new CustomEvent('scrub', { detail: { metSec: metSec } }));
    window.dispatchEvent(new CustomEvent('dashboard-tick'));
  }

  // ── DOM injection ────────────────────────────────────────────────────────
  function inject() {
    document.body.classList.add('archive-mode');

    var bar = document.createElement('div');
    bar.id = 'scrub-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Mission scrub controls');

    bar.innerHTML =
      '<button id="scrub-play" aria-label="Play/pause">&#9654; PLAY</button>' +
      '<button id="scrub-speed" aria-label="Playback speed">' + SPEEDS[speedIdx] + '&times;</button>' +
      '<input id="scrub-slider" type="range" min="' + MET_MIN + '" max="' + MET_MAX + '" step="1" ' +
        'value="' + (window._scrubMetSec || 0) + '" aria-label="Mission time scrubber">' +
      '<div class="scrub-readout">' +
        '<span id="scrub-met">' + formatMET(window._scrubMetSec || 0) + '</span>' +
        '<span class="scrub-phase" id="scrub-phase">' + getPhaseLabel(window._scrubMetSec || 0) + '</span>' +
      '</div>';

    document.body.appendChild(bar);

    var playBtn   = document.getElementById('scrub-play');
    var speedBtn  = document.getElementById('scrub-speed');
    var slider    = document.getElementById('scrub-slider');
    var metEl     = document.getElementById('scrub-met');
    var phaseEl   = document.getElementById('scrub-phase');

    function updateReadout(metSec) {
      metEl.textContent  = formatMET(metSec);
      phaseEl.textContent = getPhaseLabel(metSec);
      slider.value = String(metSec);
    }

    function setPlaying(state) {
      playing = state;
      playBtn.innerHTML = playing ? '&#10074;&#10074; PAUSE' : '&#9654; PLAY';
      if (playing) {
        lastRafTime = null;
        rafId = requestAnimationFrame(tick);
      } else {
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      }
    }

    function tick(now) {
      if (!playing) return;
      if (lastRafTime === null) { lastRafTime = now; }
      var delta = (now - lastRafTime) / 1000; // seconds of real time elapsed
      lastRafTime = now;

      var speed = SPEEDS[speedIdx];
      var next = (window._scrubMetSec || 0) + delta * speed;
      if (next >= MET_MAX) {
        next = MET_MAX;
        setPlaying(false);
      }
      dispatchScrub(next);
      updateReadout(next);

      if (playing) rafId = requestAnimationFrame(tick);
    }

    // Play/pause button
    playBtn.addEventListener('click', function() { setPlaying(!playing); });

    // Speed toggle
    speedBtn.addEventListener('click', function() {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      speedBtn.innerHTML = SPEEDS[speedIdx] + '&times;';
    });

    // Slider input/change
    function onSlider() {
      var val = parseFloat(slider.value);
      dispatchScrub(val);
      updateReadout(val);
    }
    slider.addEventListener('input', onSlider);
    slider.addEventListener('change', onSlider);

    // Keyboard support
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
      if (e.code === 'ArrowRight') { e.preventDefault(); var n = Math.min(MET_MAX, (window._scrubMetSec || 0) + 60); dispatchScrub(n); updateReadout(n); }
      if (e.code === 'ArrowLeft')  { e.preventDefault(); var n = Math.max(MET_MIN, (window._scrubMetSec || 0) - 60); dispatchScrub(n); updateReadout(n); }
    });

    // Fire an initial scrub event so all panels render at the default time
    dispatchScrub(window._scrubMetSec || 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
