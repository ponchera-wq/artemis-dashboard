// ══════════════════════════════════════════════════════════════════════
// crew-activity-ui.js — Live "What's the crew doing now?" strip
// Reads from window.CREW_ACTIVITIES / window.CREW_ACTIVITY_CATEGORIES
// Inserts #crew-activity-strip after #top-bar; updates every 30 s
// ══════════════════════════════════════════════════════════════════════
(function () {
  if (!window.CREW_ACTIVITIES || !window.CREW_ACTIVITY_CATEGORIES) return;

  var acts = window.CREW_ACTIVITIES;
  var cats = window.CREW_ACTIVITY_CATEGORIES;

  // ── Helpers ────────────────────────────────────────────────────────
  function metNow() {
    return (Date.now() - window.LAUNCH_UTC.getTime()) / 1000;
  }

  function fmtCountdown(diffSec) {
    var abs = Math.abs(diffSec);
    var h   = Math.floor(abs / 3600);
    var m   = Math.floor((abs % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm';
    return Math.floor(abs) + 's';
  }

  function cat(key) {
    return cats[key] || { emoji: '🚀', color: '#4a90d9', name: key };
  }

  // Returns first `n` activities starting at index `fromIdx`
  function upcoming(fromIdx, n) {
    var out = [];
    for (var i = fromIdx; i < acts.length && out.length < n; i++) {
      out.push(acts[i]);
    }
    return out;
  }

  // Returns { type, actIdx? } describing where we are in the timeline
  function locate(met) {
    if (met < acts[0].startMet) return { type: 'pre' };
    for (var i = 0; i < acts.length; i++) {
      if (met >= acts[i].startMet && met < acts[i].endMet) return { type: 'active', actIdx: i };
      if (i < acts.length - 1 && met >= acts[i].endMet && met < acts[i + 1].startMet) {
        return { type: 'gap', nextIdx: i + 1 };
      }
    }
    return { type: 'post' };
  }

  // ── Build DOM ──────────────────────────────────────────────────────
  var strip = document.createElement('div');
  strip.id  = 'crew-activity-strip';

  var topBar = document.getElementById('top-bar');
  if (topBar && topBar.parentNode) {
    topBar.parentNode.insertBefore(strip, topBar.nextSibling);
  } else {
    document.body.insertBefore(strip, document.body.firstChild);
  }

  // ── Layout patching ────────────────────────────────────────────────
  // ui.js dynamically sets #main-content inline gridTemplateRows and sets
  // inline gridRow on each panel. We intercept via MutationObserver and
  // insert an extra auto row (row 3) for the crew-activity-strip.
  var PANEL_IDS = ['feed-youtube','feed-arow','feed-weather','feed-dsn','feed-blog','mission-updates'];
  var _patching = false;

  function patchLayout() {
    if (_patching) return;
    var mc = document.getElementById('main-content');
    if (!mc) return;
    var rows = mc.style.gridTemplateRows;
    // Only patch when ui.js has set an inline value (it always starts "32px 112px")
    // and we haven't already patched it (patched version contains "auto" between them)
    if (!rows || !/^32px 112px (?!auto)/.test(rows)) return;

    _patching = true;

    // Insert auto row for the strip between row 2 (112px) and the panel rows
    mc.style.gridTemplateRows = rows.replace(/^(32px 112px )/, '$1auto ');

    // Shift all panel inline gridRow values up by 1
    PANEL_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.style.gridRow) {
        var r = parseInt(el.style.gridRow, 10);
        if (!isNaN(r)) el.style.gridRow = String(r + 1);
      }
    });

    // Shift site-footer up by 1 (ui.js sets these too)
    ['site-footer'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.style.gridRow) {
        var r = parseInt(el.style.gridRow, 10);
        if (!isNaN(r)) el.style.gridRow = String(r + 1);
      }
    });

    _patching = false;
  }

  // Watch for applyLayout() writing to #main-content's inline style
  var mc = document.getElementById('main-content');
  if (mc && window.MutationObserver) {
    var obs = new MutationObserver(function () { patchLayout(); });
    obs.observe(mc, { attributes: true, attributeFilter: ['style'] });
  }
  // Also run once now (in case applyLayout already fired before this script)
  patchLayout();

  // ── Render ─────────────────────────────────────────────────────────
  var prevLabel   = null;
  var firstRender = true;

  function render() {
    var met = metNow();
    var loc = locate(met);
    var emoji, label, detail, borderColor, nextActs;

    if (loc.type === 'post') {
      strip.style.borderLeftColor = '#4a90d9';
      setHTML('<div class="cas-current">' +
        '<span class="cas-emoji">🌊</span>' +
        '<span class="cas-label">MISSION COMPLETE</span>' +
        '<span class="cas-detail"> · Splashdown successful</span>' +
        '</div>');
      return;
    }

    if (loc.type === 'pre') {
      var next = acts[0];
      var diff = next.startMet - met;
      strip.style.borderLeftColor = '#4a5568';
      setHTML('<div class="cas-current">' +
        '<span class="cas-emoji">⏳</span>' +
        '<span class="cas-label">PRE-LAUNCH</span>' +
        '<span class="cas-detail"> · ' + next.label + ' in ' + fmtCountdown(diff) + '</span>' +
        '</div>');
      return;
    }

    if (loc.type === 'gap') {
      emoji      = '🚀';
      label      = 'TRANSITION';
      detail     = '';
      borderColor = '#4a5568';
      nextActs   = upcoming(loc.nextIdx, 2);
    } else {
      var act    = acts[loc.actIdx];
      var c      = cat(act.category);
      emoji      = c.emoji;
      label      = act.label.toUpperCase();
      detail     = act.detail || '';
      borderColor = c.color;
      nextActs   = upcoming(loc.actIdx + 1, 2);
    }

    strip.style.borderLeftColor = borderColor;

    // Pulse on activity change (skip on very first render)
    if (label !== prevLabel) {
      prevLabel = label;
      if (!firstRender) {
        strip.classList.remove('cas-new');
        void strip.offsetWidth; // force reflow to restart animation
        strip.classList.add('cas-new');
      }
    }
    firstRender = false;

    var html = '<div class="cas-current">' +
      '<span class="cas-emoji">' + emoji + '</span>' +
      '<span class="cas-label">' + esc(label) + '</span>' +
      (detail ? '<span class="cas-detail"> · ' + esc(detail) + '</span>' : '') +
      '</div>';

    if (nextActs.length > 0) {
      html += '<div class="cas-sep" aria-hidden="true"></div>';
      html += '<div class="cas-upcoming">';
      nextActs.forEach(function (a, i) {
        var uc   = cat(a.category);
        var diff = a.startMet - met;
        var pfx  = i === 0 ? 'Next' : 'After';
        html += '<span class="cas-next-item">' + pfx + ': ' + uc.emoji +
          ' ' + esc(a.label) + ' <em>in ' + fmtCountdown(diff) + '</em></span>';
      });
      html += '</div>';
    }

    setHTML(html);
  }

  function setHTML(html) {
    strip.innerHTML = html;
  }

  // Minimal HTML escaping for activity text (data is controlled, but be safe)
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  render();
  setInterval(render, 30000);
})();
