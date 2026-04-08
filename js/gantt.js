// gantt.js — Swim-lane Gantt timeline for Artemis II dashboard
// Depends on: shared.js (LAUNCH_UTC, fmtLocal, fmtUTC, tzAbbr),
//             mission-events.js (MissionEvents), mission-ephemeris.js (MissionEphemeris),
//             crew-activity.js (CREW_ACTIVITIES, CREW_ACTIVITY_CATEGORIES)
// ══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Layout constants ────────────────────────────────────────────────────
  var LW = 52;                  // label column width px
  var HH = 56;                  // header height px
  var LH = 36;                  // lane height px
  var TH = HH + LH * 2;        // total chart height = 128px

  // Mission duration — fallback until MissionEphemeris.tEnd resolves
  var MISSION_END = Math.max(
    window.SPLASHDOWN_MET_SEC ? window.SPLASHDOWN_MET_SEC + 3600 : 0,
    MissionEvents.events[MissionEvents.events.length - 1].metSec + 3600,
    787200
  );

  var PHASE_BG = {
    ascent:     'rgba(204,255,0,0.08)',
    orbit:      'rgba(56,161,105,0.09)',
    translunar: 'rgba(128,90,213,0.11)',
    lunar:      'rgba(236,201,75,0.11)',
    return:     'rgba(0,181,216,0.09)',
  };
  var PHASE_BORDER = {
    ascent:     'rgba(204,255,0,0.24)',
    orbit:      'rgba(56,161,105,0.25)',
    translunar: 'rgba(128,90,213,0.28)',
    lunar:      'rgba(236,201,75,0.28)',
    return:     'rgba(0,181,216,0.25)',
  };
  var PHASE_LABELS = {
    ascent: 'ASCENT', orbit: 'ORBIT', translunar: 'TLI', lunar: 'LUNAR', return: 'RETURN',
  };
  var TICK_IVLS = [900, 1800, 3600, 7200, 14400, 21600, 43200, 86400];

  // ── State ───────────────────────────────────────────────────────────────
  var state = {
    zoom: (function () {
      try { return localStorage.getItem('gantt.zoom') || null; } catch (e) { return null; }
    })() || 'day',
    pxPerSec: 1,
    collapsed: false,
  };
  var tooltip = null;
  var mobileTT = null;
  var isMobile = function () { return window.innerWidth < 600; };

  // ── Core helpers ────────────────────────────────────────────────────────
  function metToDate(s) { return new Date(LAUNCH_UTC.getTime() + s * 1000); }
  function metToPx(s)   { return Math.round(s * state.pxPerSec); }

  function fmtMET(sec) {
    var d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
    return 'T+' + String(d).padStart(2, '0') + ':' + String(h).padStart(2, '0');
  }
  function fmtDur(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  }

  function trackW() {
    var s = document.getElementById('gantt-scroll');
    return s ? Math.max(s.clientWidth - LW, 200) : 600;
  }
  function recomputePPS(zoom) {
    var tw = trackW();
    if (zoom === 'day') return tw / 86400;
    if (zoom === '6h')  return tw / 21600;
    return tw / MISSION_END;  // 'full'
  }
  function innerW() { return Math.round(MISSION_END * state.pxPerSec) + LW; }

  function pickTI() {
    for (var i = 0; i < TICK_IVLS.length; i++) {
      if (TICK_IVLS[i] * state.pxPerSec >= 60) return TICK_IVLS[i];
    }
    return TICK_IVLS[TICK_IVLS.length - 1];
  }

  function buildPhaseSpans() {
    var evs = MissionEvents.events, spans = [], last = null;
    for (var i = 0; i < evs.length; i++) {
      if (evs[i].phase !== last) {
        if (spans.length) spans[spans.length - 1].endMet = evs[i].metSec;
        spans.push({ phase: evs[i].phase, startMet: evs[i].metSec, endMet: MISSION_END });
        last = evs[i].phase;
      }
    }
    return spans;
  }

  function el(tag, cls, sty) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (sty) Object.assign(d.style, sty);
    return d;
  }

  // ── Tooltip ─────────────────────────────────────────────────────────────
  function initTT() {
    tooltip = document.createElement('div');
    tooltip.className = 'gantt-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
  }
  function showTT(html, x, y) {
    if (!tooltip) return;
    tooltip.innerHTML = html;
    tooltip.style.cssText = 'display:block;position:fixed;left:' + (x + 12) + 'px;top:' + (y - 8) + 'px';
    var r = tooltip.getBoundingClientRect();
    if (r.right  > window.innerWidth  - 8) tooltip.style.left = (x - r.width - 12) + 'px';
    if (r.bottom > window.innerHeight - 8) tooltip.style.top  = (y - r.height) + 'px';
  }
  function hideTT() { if (tooltip) tooltip.style.display = 'none'; }

  function ttCrew(act, cat) {
    var s = metToDate(act.startMet), e = metToDate(act.endMet);
    return '<b>' + (cat.emoji || '') + ' ' + act.label + '</b>' +
      '<br>' + (cat.emoji ? cat.emoji + ' ' : '') + cat.name + ' \u00b7 ' + fmtDur(act.endMet - act.startMet) +
      '<br>' + fmtMET(act.startMet) + ' \u2192 ' + fmtMET(act.endMet) +
      '<br>' + fmtLocal(s, true) + ' ' + tzAbbr(s) + ' \u2192 ' + fmtLocal(e, true) + ' ' + tzAbbr(e);
  }
  function ttPhase(span) {
    var s = metToDate(span.startMet), e = metToDate(span.endMet);
    return '<b>' + (PHASE_LABELS[span.phase] || span.phase.toUpperCase()) + ' PHASE</b>' +
      '<br>' + fmtMET(span.startMet) + ' \u2192 ' + fmtMET(span.endMet) +
      '<br>' + fmtLocal(s, true) + ' ' + tzAbbr(s) + ' \u2192 ' + fmtLocal(e, true) + ' ' + tzAbbr(e) +
      '<br>Duration: ' + fmtDur(span.endMet - span.startMet) +
      '<br><span style="color:#666;font-size:0.88em">Click to filter timeline</span>';
  }
  function ttMilestone(ev) {
    var d = metToDate(ev.metSec);
    return '<b>' + ev.name + '</b>' +
      '<br>' + fmtMET(ev.metSec) + ' \u00b7 ' + fmtLocal(d, true) + ' ' + tzAbbr(d) +
      '<br><span class="gantt-crit gantt-crit-' + ev.crit + '">' + ev.crit + '</span>' +
      '<br><span style="color:#666;font-size:0.88em">Click to scroll timeline</span>';
  }

  // ── Interactions ────────────────────────────────────────────────────────
  function addHover(node, ttFn, clickFn) {
    node.addEventListener('mouseenter', function (e) {
      if (!isMobile()) showTT(ttFn(), e.clientX, e.clientY);
    });
    node.addEventListener('mousemove', function (e) {
      if (!isMobile()) showTT(ttFn(), e.clientX, e.clientY);
    });
    node.addEventListener('mouseleave', hideTT);
    node.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isMobile() && mobileTT) {
        mobileTT.innerHTML = ttFn();
        mobileTT.style.display = 'block';
      }
      if (clickFn) clickFn();
    });
  }

  function addDayLines(track) {
    for (var d = 1; d * 86400 <= MISSION_END; d++) {
      var dx = metToPx(d * 86400);
      track.appendChild(el('div', 'gantt-gline', { left: dx + 'px' }));
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  function renderGantt() {
    var inner = document.getElementById('gantt-inner');
    if (!inner) return;
    state.pxPerSec = recomputePPS(state.zoom);
    var iw = innerW();
    inner.style.width = iw + 'px';
    var tw = iw - LW;

    // Ticks + day labels
    var ta = document.getElementById('gantt-ticks-area');
    ta.innerHTML = '';
    var ti = pickTI();
    for (var day = 1; day * 86400 <= MISSION_END; day++) {
      var dx = metToPx(day * 86400);
      if (dx > tw) break;
      var dlb = el('div', 'gantt-dlabel', { left: dx + 'px' });
      dlb.textContent = 'DAY ' + (day + 1);
      ta.appendChild(dlb);
    }
    for (var t = 0; t <= MISSION_END; t += ti) {
      var tx = metToPx(t);
      if (tx > tw) break;
      var tk = el('div', 'gantt-tick', { left: tx + 'px' });
      var top = el('div', 'gantt-tick-top');  top.textContent = fmtMET(t);
      var bot = el('div', 'gantt-tick-bot');
      var td = metToDate(t);  bot.textContent = fmtLocal(td, true) + ' ' + tzAbbr(td);
      tk.appendChild(top);  tk.appendChild(bot);
      ta.appendChild(tk);
    }

    // Phase lane
    var pt = document.getElementById('gantt-track-phase');
    pt.innerHTML = '';
    addDayLines(pt);
    var spans = buildPhaseSpans();
    for (var pi = 0; pi < spans.length; pi++) {
      var sp = spans[pi];
      var bx = metToPx(sp.startMet), bw = Math.max(metToPx(sp.endMet) - bx, 2);
      var pb = el('div', 'gantt-block', {
        left: bx + 'px', width: bw + 'px',
        background: PHASE_BG[sp.phase]  || 'rgba(255,255,255,0.04)',
        borderColor: PHASE_BORDER[sp.phase] || 'rgba(255,255,255,0.12)',
      });
      var lbl = el('span', 'gantt-blabel');
      lbl.textContent = PHASE_LABELS[sp.phase] || sp.phase.toUpperCase();
      pb.appendChild(lbl);
      (function (sp2) {
        addHover(pb, function () { return ttPhase(sp2); }, function () {
          if (window.MissionTimeline) window.MissionTimeline.setPhaseFilter(sp2.phase);
        });
      })(sp);
      pt.appendChild(pb);
    }

    // Crew lane
    var ct = document.getElementById('gantt-track-crew');
    ct.innerHTML = '';
    addDayLines(ct);
    var acts = window.CREW_ACTIVITIES || [];
    var cats = window.CREW_ACTIVITY_CATEGORIES || {};
    for (var ai = 0; ai < acts.length; ai++) {
      var act = acts[ai];
      if (act.startMet < 0) continue;
      var cat = cats[act.category] || { emoji: '\u2022', color: '#888', name: act.category };
      var ax = metToPx(act.startMet), aw = Math.max(metToPx(act.endMet) - ax, 3);
      var cb = el('div', 'gantt-block', {
        left: ax + 'px', width: aw + 'px',
        background: cat.color + '2a',  borderColor: cat.color + '66',
      });
      if (aw >= 60) {
        var cl = el('span', 'gantt-blabel');
        cl.textContent = (cat.emoji || '') + ' ' + act.label;
        cb.appendChild(cl);
      } else if (aw >= 20) {
        var ce = el('span', null, {
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', fontSize: '10px', lineHeight: '1', pointerEvents: 'none',
        });
        ce.textContent = cat.emoji || '';
        cb.appendChild(ce);
      }
      (function (a, c) {
        addHover(cb, function () { return ttCrew(a, c); }, function () {
          if (window.MissionTimeline) window.MissionTimeline.setPhaseFilter('crew');
        });
      })(act, cat);
      ct.appendChild(cb);
    }

    // Milestone ticks (overlay spanning both lanes)
    var ml = document.getElementById('gantt-milestones');
    ml.innerHTML = '';
    var evs = MissionEvents.events;
    for (var ei = 0; ei < evs.length; ei++) {
      var ev = evs[ei];
      var mx = metToPx(ev.metSec);
      var mc = ev.crit === 'CRITICAL' ? '#ef5350' : ev.crit === 'HIGH' ? '#ff2800' : 'rgba(168,224,0,0.38)';
      var mk = el('div', 'gantt-mstone', { left: mx + 'px', borderLeftColor: mc });
      (function (ev2) {
        addHover(mk, function () { return ttMilestone(ev2); }, function () {
          if (window.MissionTimeline) window.MissionTimeline.scrollToEvent(ev2.metSec);
          // TODO: if window.Trajectory gains a seekToMET API, call it here
        });
      })(ev);
      ml.appendChild(mk);
    }

    tickGantt();
  }

  // ── Now line ─────────────────────────────────────────────────────────────
  function tickGantt() {
    var nl = document.getElementById('gantt-now-line');
    var nb = document.getElementById('gantt-now-label');
    if (!nl) return;
    var nowMet = (Date.now() - LAUNCH_UTC) / 1000;
    if (nowMet < 0) {
      nl.style.display = 'none';
      if (nb) { nb.style.left = (LW + 2) + 'px'; nb.textContent = 'T\u2212'; nb.style.display = 'block'; }
    } else if (nowMet > MISSION_END) {
      nl.style.display = 'none';
      if (nb) {
        nb.style.left = (metToPx(MISSION_END) + LW - 72) + 'px';
        nb.textContent = 'COMPLETE';
        nb.style.display = 'block';
      }
    } else {
      var x = metToPx(nowMet) + LW;
      nl.style.display = 'block'; nl.style.left = x + 'px';
      if (nb) { nb.style.left = (x - 13) + 'px'; nb.textContent = 'NOW'; nb.style.display = 'block'; }
    }
  }

  function scrollToNow() {
    var s = document.getElementById('gantt-scroll');
    if (!s) return;
    var nowMet = (Date.now() - LAUNCH_UTC) / 1000;
    var x = metToPx(Math.max(0, Math.min(nowMet, MISSION_END))) + LW;
    s.scrollTo({ left: Math.max(0, x - s.clientWidth / 2), behavior: 'smooth' });
  }

  function setZoom(z) {
    state.zoom = z;
    try { localStorage.setItem('gantt.zoom', z); } catch (e) {}
    document.querySelectorAll('.gantt-zoom-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.zoom === z);
    });
    renderGantt();
    setTimeout(scrollToNow, 50);
  }

  // ── Build panel DOM ──────────────────────────────────────────────────────
  function buildPanel() {
    var panel = document.getElementById('gantt-panel');
    if (!panel) return;

    panel.innerHTML =
      '<div class="panel-header">' +
        '<span class="drag-handle" title="Drag to reorder">\u2837</span>' +
        '<span class="dot"></span>' +
        '<h2 class="panel-heading panel-heading--compact">MISSION GANTT</h2>' +
        '<div style="margin-left:auto;display:flex;gap:4px;align-items:center;flex-shrink:0;">' +
          '<button class="gantt-zoom-btn' + (state.zoom === 'full' ? ' active' : '') + '" data-zoom="full">FULL</button>' +
          '<button class="gantt-zoom-btn' + (state.zoom === 'day'  ? ' active' : '') + '" data-zoom="day">DAY</button>' +
          '<button class="gantt-zoom-btn' + (state.zoom === '6h'   ? ' active' : '') + '" data-zoom="6h">6H</button>' +
          '<button id="gantt-now-btn" class="gantt-now-btn">NOW</button>' +
          '<button id="gantt-collapse-btn" class="gantt-collapse-btn" title="Collapse/expand">\u25be</button>' +
        '</div>' +
        '<button class="yt-expand-btn panel-expand" data-panel="gantt-panel" title="Expand">\u26f6 EXPAND</button>' +
      '</div>' +
      '<div id="gantt-body">' +
        '<div class="gantt-scroll" id="gantt-scroll">' +
          '<div class="gantt-inner" id="gantt-inner">' +
            '<div class="gantt-hdr-row">' +
              '<div class="gantt-corner"></div>' +
              '<div id="gantt-ticks-area" class="gantt-ticks-area"></div>' +
            '</div>' +
            '<div class="gantt-lane-row">' +
              '<div class="gantt-lane-lbl">PHASE</div>' +
              '<div id="gantt-track-phase" class="gantt-track"></div>' +
            '</div>' +
            '<div class="gantt-lane-row">' +
              '<div class="gantt-lane-lbl">CREW</div>' +
              '<div id="gantt-track-crew" class="gantt-track"></div>' +
            '</div>' +
            '<div id="gantt-milestones" class="gantt-mstones"></div>' +
            '<div id="gantt-now-line" class="gantt-now-line"></div>' +
            '<div id="gantt-now-label" class="gantt-now-label"></div>' +
          '</div>' +
        '</div>' +
        '<div id="gantt-mob-tt" class="gantt-mob-tt" style="display:none;"></div>' +
      '</div>' +
      '<div class="corner-tl"></div><div class="corner-br"></div>';

    panel.querySelectorAll('.gantt-zoom-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setZoom(this.dataset.zoom); });
    });
    panel.querySelector('#gantt-now-btn').addEventListener('click', scrollToNow);
    var cbtn = panel.querySelector('#gantt-collapse-btn');
    cbtn.addEventListener('click', function () {
      state.collapsed = !state.collapsed;
      var body = document.getElementById('gantt-body');
      if (body) body.style.display = state.collapsed ? 'none' : '';
      this.textContent = state.collapsed ? '\u25b8' : '\u25be';
    });
    mobileTT = panel.querySelector('#gantt-mob-tt');
    initTT();
    renderGantt();
    setTimeout(scrollToNow, 50);
  }

  // ── CSS injection ────────────────────────────────────────────────────────
  function injectCSS() {
    var s = document.createElement('style');
    s.textContent = [
      '#gantt-panel{position:relative;}',
      '.gantt-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;}',
      '.gantt-inner{position:relative;display:flex;flex-direction:column;}',
      '.gantt-hdr-row{display:flex;height:' + HH + 'px;background:#0a0e1a;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;}',
      '.gantt-corner{width:' + LW + 'px;min-width:' + LW + 'px;flex-shrink:0;position:sticky;left:0;z-index:21;background:#0a0e1a;border-right:1px solid rgba(255,255,255,0.07);}',
      '.gantt-ticks-area{position:relative;flex:1;overflow:visible;}',
      '.gantt-tick{position:absolute;top:5px;display:flex;flex-direction:column;gap:2px;pointer-events:none;}',
      '.gantt-tick-top{font-family:var(--font-mono);font-size:0.5rem;color:rgba(168,224,0,0.62);white-space:nowrap;letter-spacing:0.04em;}',
      '.gantt-tick-bot{font-family:var(--font-mono);font-size:0.39rem;color:rgba(168,224,0,0.32);white-space:nowrap;}',
      '.gantt-dlabel{position:absolute;top:' + (HH - 14) + 'px;font-family:var(--font-mono);font-size:0.39rem;color:rgba(255,255,255,0.2);letter-spacing:0.08em;pointer-events:none;padding-left:3px;white-space:nowrap;}',
      '.gantt-lane-row{display:flex;height:' + LH + 'px;border-bottom:1px solid rgba(255,255,255,0.05);flex-shrink:0;}',
      '.gantt-lane-lbl{width:' + LW + 'px;min-width:' + LW + 'px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:0.45rem;color:rgba(168,224,0,0.4);letter-spacing:0.1em;position:sticky;left:0;z-index:10;background:#0a0e1a;border-right:1px solid rgba(255,255,255,0.07);}',
      '.gantt-track{position:relative;flex:1;}',
      '.gantt-gline{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.08);pointer-events:none;z-index:0;}',
      '.gantt-block{position:absolute;top:3px;height:' + (LH - 6) + 'px;border-radius:2px;border:1px solid;overflow:hidden;cursor:pointer;min-width:3px;box-sizing:border-box;z-index:2;}',
      '.gantt-block:hover{opacity:.8;z-index:5;}',
      '.gantt-blabel{font-family:var(--font-mono);font-size:0.4rem;color:rgba(255,255,255,0.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px;line-height:' + (LH - 6) + 'px;display:block;pointer-events:none;}',
      '.gantt-mstones{position:absolute;left:' + LW + 'px;top:' + HH + 'px;height:' + (LH * 2) + 'px;pointer-events:none;overflow:visible;z-index:6;}',
      '.gantt-mstone{position:absolute;top:0;height:' + (LH * 2) + 'px;width:3px;border-left:2px solid;cursor:pointer;pointer-events:all;}',
      '.gantt-mstone:hover{width:5px;opacity:.9;}',
      '.gantt-now-line{position:absolute;top:0;height:' + TH + 'px;width:2px;background:rgba(255,40,0,0.8);box-shadow:0 0 5px rgba(255,40,0,0.45);pointer-events:none;z-index:14;}',
      '.gantt-now-label{position:absolute;top:2px;font-family:var(--font-mono);font-size:0.41rem;color:#ff2800;pointer-events:none;z-index:15;text-shadow:0 0 5px rgba(255,40,0,0.6);white-space:nowrap;}',
      '.gantt-zoom-btn{font-family:var(--font-mono);font-size:0.45rem;color:rgba(168,224,0,0.48);background:transparent;border:1px solid rgba(168,224,0,0.16);padding:2px 7px;cursor:pointer;letter-spacing:0.08em;}',
      '.gantt-zoom-btn:hover,.gantt-zoom-btn.active{color:#ccff00;border-color:rgba(204,255,0,0.48);background:rgba(204,255,0,0.05);}',
      '.gantt-now-btn{font-family:var(--font-mono);font-size:0.45rem;color:#ff2800;background:transparent;border:1px solid rgba(255,40,0,0.32);padding:2px 7px;cursor:pointer;letter-spacing:0.08em;}',
      '.gantt-collapse-btn{font-family:var(--font-mono);font-size:0.7rem;color:rgba(168,224,0,0.3);background:transparent;border:none;padding:1px 5px;cursor:pointer;}',
      '.gantt-tooltip{position:fixed;z-index:9999;background:#0c1020;border:1px solid rgba(168,224,0,0.2);padding:8px 10px;font-family:var(--font-mono);font-size:0.58rem;color:rgba(255,255,255,0.78);pointer-events:none;max-width:270px;line-height:1.55;box-shadow:0 4px 18px rgba(0,0,0,0.7);}',
      '.gantt-tooltip b{color:#ccff00;display:block;margin-bottom:4px;}',
      '.gantt-crit{font-size:0.47rem;padding:1px 4px;border:1px solid;border-radius:2px;}',
      '.gantt-crit-CRITICAL{color:#ef5350;border-color:rgba(239,83,80,0.38);}',
      '.gantt-crit-HIGH{color:#ff2800;border-color:rgba(255,40,0,0.38);}',
      '.gantt-crit-MEDIUM{color:#e8ff00;border-color:rgba(232,255,0,0.35);}',
      '.gantt-crit-ROUTINE{color:#ccff00;border-color:rgba(204,255,0,0.28);}',
      '.gantt-mob-tt{padding:7px 10px;background:#0c1020;border:1px solid rgba(168,224,0,0.16);font-family:var(--font-mono);font-size:0.57rem;color:rgba(255,255,255,0.72);line-height:1.5;margin-top:3px;}',
      '.gantt-mob-tt b{color:#ccff00;}',
      '@media(max-width:600px){.gantt-tick-bot{display:none;}.gantt-blabel{font-size:0.36rem;}}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Drag-to-pan ───────────────────────────────────────────────────────────
  function initDragPan() {
    var scroll = document.getElementById('gantt-scroll');
    if (!scroll) return;
    var dragging = false, startX = 0, startLeft = 0;

    scroll.addEventListener('mousedown', function (e) {
      // Ignore clicks on interactive children
      if (e.target.closest && e.target.closest('.gantt-block, .gantt-mstone, button')) return;
      dragging = true;
      startX = e.pageX;
      startLeft = scroll.scrollLeft;
      scroll.style.cursor = 'grabbing';
      scroll.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      if (scroll) { scroll.style.cursor = ''; scroll.style.userSelect = ''; }
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      scroll.scrollLeft = startLeft - (e.pageX - startX);
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    injectCSS();
    buildPanel();
    initDragPan();

    // Keyboard zoom: +/= to zoom in, - to zoom out
    var zoomLevels = ['full', 'day', '6h'];
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!document.getElementById('gantt-panel')) return;
      var ci = zoomLevels.indexOf(state.zoom);
      if ((e.key === '+' || e.key === '=') && ci < zoomLevels.length - 1) setZoom(zoomLevels[ci + 1]);
      else if (e.key === '-' && ci > 0) setZoom(zoomLevels[ci - 1]);
    });

    window.addEventListener('dashboard-tick', tickGantt);

    // Update MISSION_END from ephemeris once loaded
    if (window.MissionEphemeris && MissionEphemeris.ready) {
      MissionEphemeris.ready.then(function () {
        if (MissionEphemeris.tEnd && MissionEphemeris.tEnd > MISSION_END) {
          MISSION_END = MissionEphemeris.tEnd;
          renderGantt();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
