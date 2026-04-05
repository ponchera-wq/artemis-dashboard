// timeline.js — Mission timeline display
// Reads events from shared MissionEvents module.
// ══════════════════════════════════════════════════════════════════════
(function() {
  var DAY_LABELS = {
    1:  'DAY 1 \u2014 LAUNCH & EARTH ORBIT',
    2:  'DAY 2 \u2014 EARTH ORBIT CHECKOUT & TLI',
    3:  'DAY 3 \u2014 OUTBOUND COAST',
    4:  'DAY 4 \u2014 OUTBOUND COAST',
    5:  'DAY 5 \u2014 LUNAR APPROACH',
    6:  'DAY 6 \u2014 LUNAR FLYBY',
    7:  'DAYS 7\u20139 \u2014 RETURN COAST',
    10: 'DAY 10 \u2014 RE-ENTRY & SPLASHDOWN',
  };

  var EVENTS = MissionEvents.events;
  var activePhaseFilter = 'all';
  /** @type {{ el: HTMLElement, idx: number }[]|null} */
  var rowRefs = null;

  function fmtMet(sec) {
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return 'T+' + String(h).padStart(h >= 100 ? 3 : 2, '0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }

  function getActiveIdx(nowMet) {
    var activeIdx = 0;
    for (var i = 0; i < EVENTS.length; i++) {
      if (EVENTS[i].metSec <= nowMet) activeIdx = i;
      else break;
    }
    return activeIdx;
  }

  function computeEtaStr(evIdx, activeIdx, nowMet) {
    var isActive = evIdx === activeIdx;
    var etaStr = '';
    if (evIdx > activeIdx) {
      var rem = EVENTS[evIdx].metSec - nowMet;
      var hh2 = Math.floor(rem / 3600);
      var mm2 = Math.floor((rem % 3600) / 60);
      etaStr = hh2 > 0 ? 'in ' + hh2 + 'h ' + mm2 + 'm' : 'in ' + mm2 + 'm';
    } else if (isActive) {
      var ago = nowMet - EVENTS[evIdx].metSec;
      if (ago < 120) etaStr = 'NOW';
      else { var hh3 = Math.floor(ago / 3600); var mm3 = Math.floor((ago % 3600) / 60); etaStr = hh3 > 0 ? hh3 + 'h ' + mm3 + 'm ago' : mm3 + 'm ago'; }
    } else if (evIdx >= activeIdx - 3) {
      var ago2 = nowMet - EVENTS[evIdx].metSec;
      var hh4 = Math.floor(ago2 / 3600); var mm4 = Math.floor((ago2 % 3600) / 60);
      etaStr = hh4 > 0 ? hh4 + 'h ' + mm4 + 'm ago' : mm4 + 'm ago';
    }
    return etaStr;
  }

  function updateTimelineChrome(nowMet, activeIdx) {
    var launchMidnight = Date.UTC(2026, 3, 1);
    var nowMidnight = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    var flightDay = Math.floor((nowMidnight - launchMidnight) / 86400000) + 1;
    var badge = document.getElementById('flight-day-badge');
    if (badge) badge.textContent = 'FLIGHT DAY ' + Math.max(1, flightDay);

    var curEvEl = document.getElementById('current-event-name');
    if (curEvEl) curEvEl.textContent = '\u25b6 ' + EVENTS[activeIdx].name;

    var nextEv = EVENTS[activeIdx + 1];
    var tln = document.getElementById('tl-next-event');
    if (tln) {
      if (nextEv) {
        var remaining = nextEv.metSec - nowMet;
        var eventDate = new Date(LAUNCH_UTC.getTime() + nextEv.metSec * 1000);
        var hh = Math.floor(remaining / 3600);
        var mm = Math.floor((remaining % 3600) / 60);
        var countStr = hh > 0 ? hh + 'h ' + mm + 'm' : mm + 'm';
        var localWhen = fmtLocal(eventDate, true) + ' ' + tzAbbr(eventDate);
        tln.innerHTML =
          '<div><span class="tl-next-label">NEXT: </span>' + nextEv.name + '</div>' +
          '<div class="tl-next-when">in ' + countStr + ' \u00b7 ' + localWhen + '</div>';
        if (window.dashboardState) {
          window.dashboardState.nextEvent = nextEv.name;
          window.dashboardState.nextEventEta = countStr;
        }
      } else { tln.textContent = ''; }
    }
  }

  function updateTimelineRows(nowMet, activeIdx) {
    if (!rowRefs || !rowRefs.length) return;
    for (var r = 0; r < rowRefs.length; r++) {
      var ref = rowRefs[r];
      var el = ref.el;
      var evIdx = ref.idx;
      var isComplete = evIdx < activeIdx;
      var isActive = evIdx === activeIdx;
      var cls = isComplete ? 'tl-complete' : isActive ? 'tl-active' : 'tl-upcoming';
      el.className = 'tl-event ' + cls;
      var crit = EVENTS[evIdx].crit;
      var etaStr = computeEtaStr(evIdx, activeIdx, nowMet);
      var nameDiv = el.querySelector('.tl-name');
      if (nameDiv) {
        nameDiv.innerHTML =
          EVENTS[evIdx].name + (isComplete ? '<span class="tl-check"> \u2713</span>' : '') +
          '<span class="tl-crit tl-crit-' + crit + '">' + crit + '</span>' +
          (etaStr ? '<div class="tl-eta">' + etaStr + '</div>' : '');
      }
    }
  }

  function tickTimeline() {
    var nowMet = (Date.now() - LAUNCH_UTC) / 1000;
    var activeIdx = getActiveIdx(nowMet);
    updateTimelineChrome(nowMet, activeIdx);
    updateTimelineRows(nowMet, activeIdx);
  }

  function renderTimeline() {
    var nowMet = (Date.now() - LAUNCH_UTC) / 1000;
    var activeIdx = getActiveIdx(nowMet);
    var scroll = document.getElementById('timeline-scroll');
    if (!scroll) return;

    updateTimelineChrome(nowMet, activeIdx);

    var filtered = [];
    for (var i = 0; i < EVENTS.length; i++) {
      var ev = EVENTS[i];
      if (activePhaseFilter === 'all' || ev.phase === activePhaseFilter) {
        filtered.push({ metSec: ev.metSec, name: ev.name, day: ev.day, crit: ev.crit, phase: ev.phase, _i: i, desc: ev.desc || null, crew: ev.crew || null });
      }
    }

    scroll.innerHTML = '';
    rowRefs = [];
    var lastDay = null;
    var activeEl = null;

    for (var fi = 0; fi < filtered.length; fi++) {
      var ev = filtered[fi];
      if (ev.day !== lastDay) {
        lastDay = ev.day;
        var dh = document.createElement('div');
        dh.className = 'tl-day-header';
        dh.textContent = DAY_LABELS[ev.day] || ('DAY ' + ev.day);
        scroll.appendChild(dh);
      }

      var isComplete = ev._i < activeIdx;
      var isActive = ev._i === activeIdx;
      var cls = isComplete ? 'tl-complete' : isActive ? 'tl-active' : 'tl-upcoming';

      var evDate = new Date(LAUNCH_UTC.getTime() + ev.metSec * 1000);
      var localStr = fmtLocal(evDate, true) + ' ' + tzAbbr(evDate);
      var utcStr = fmtUTC(evDate);

      var etaStr = computeEtaStr(ev._i, activeIdx, nowMet);

      var detailHtml = '';
      if (ev.desc || ev.crew) {
        detailHtml = '<div class="tl-detail">';
        if (ev.crew) detailHtml += '<div class="tl-crew">\ud83d\udc68\u200d\ud83d\ude80 ' + ev.crew + '</div>';
        if (ev.desc) detailHtml += '<div class="tl-desc-text">' + ev.desc + '</div>';
        detailHtml += '</div>';
      }

      var el = document.createElement('div');
      el.className = 'tl-event ' + cls;
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.innerHTML =
        '<div class="tl-dot"></div>' +
        '<div class="tl-met">' + fmtMet(ev.metSec) +
          '<div class="tl-localtime">' + localStr + '<br>' + utcStr + '</div>' +
        '</div>' +
        '<div class="tl-name">' + ev.name + (isComplete ? '<span class="tl-check"> \u2713</span>' : '') + '<span class="tl-crit tl-crit-' + ev.crit + '">' + ev.crit + '</span>' + (etaStr ? '<div class="tl-eta">' + etaStr + '</div>' : '') + '</div>' +
        detailHtml;
      scroll.appendChild(el);
      rowRefs.push({ el: el, idx: ev._i });

      if (ev.desc || ev.crew) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', function(e) {
          e.stopPropagation();
          var target = this;
          var wasExpanded = target.classList.contains('tl-expanded');
          var allExpanded = scroll.querySelectorAll('.tl-expanded');
          for (var j = 0; j < allExpanded.length; j++) allExpanded[j].classList.remove('tl-expanded');
          if (!wasExpanded) target.classList.add('tl-expanded');
        });
      }
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.click();
        }
      });
      if (isActive) activeEl = el;
    }

    if (activeEl) setTimeout(function() {
      var container = document.getElementById('timeline-scroll');
      if (container) {
        var elTop = activeEl.offsetTop;
        var center = elTop - container.clientHeight / 2 + activeEl.offsetHeight / 2;
        container.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
      }
    }, 80);
  }

  renderTimeline();
  window.addEventListener('dashboard-tick', tickTimeline);

  var filterBtns = document.querySelectorAll('.tl-filter');
  for (var i = 0; i < filterBtns.length; i++) {
    filterBtns[i].addEventListener('click', function() {
      var allBtns = document.querySelectorAll('.tl-filter');
      for (var j = 0; j < allBtns.length; j++) allBtns[j].classList.remove('active');
      this.classList.add('active');
      activePhaseFilter = this.dataset.phase;
      renderTimeline();
    });
  }

})();
