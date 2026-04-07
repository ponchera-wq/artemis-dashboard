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
    6:  'DAY 6 \u2014 LUNAR FLYBY & SOI EXIT',
    7:  'DAY 7 \u2014 RETURN COAST',
    10: 'DAY 10 \u2014 RE-ENTRY & SPLASHDOWN',
  };

  var EVENTS = MissionEvents.events;
  var activePhaseFilter = 'all';
  /** @type {{ el: HTMLElement, idx: number, isActivity: boolean, metSec: number }[]|null} */
  var rowRefs = null;

  function fmtMet(sec) {
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return 'T+' + String(h).padStart(h >= 100 ? 3 : 2, '0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }

  function fmtDur(sec) {
    if (sec <= 0) return '';
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
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

  function computeActivityEtaStr(metSec, nowMet) {
    var diff = metSec - nowMet;
    if (Math.abs(diff) < 120) return 'NOW';
    var abs = Math.abs(diff);
    var hh = Math.floor(abs / 3600);
    var mm = Math.floor((abs % 3600) / 60);
    var str = hh > 0 ? hh + 'h ' + mm + 'm' : mm + 'm';
    return diff > 0 ? 'in ' + str : str + ' ago';
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

      // Crew activity rows — update completion based on MET, not event index
      if (ref.isActivity) {
        var actComplete = ref.metSec < nowMet;
        var actOngoing = ref.metSec <= nowMet && ref.endMet > nowMet;
        var actCls = actOngoing ? 'tl-active' : actComplete ? 'tl-complete' : 'tl-upcoming';
        el.className = 'tl-event tl-activity ' + actCls;
        var nameDiv = el.querySelector('.tl-name');
        if (nameDiv) {
          var etaA = (Math.abs(ref.metSec - nowMet) < 7200 || ref.metSec > nowMet)
            ? computeActivityEtaStr(ref.metSec, nowMet) : '';
          nameDiv.innerHTML =
            ref.name + (actComplete && !actOngoing ? '<span class="tl-check"> \u2713</span>' : '') +
            '<span class="tl-cat" style="color:' + ref.catColor + ';border-color:' + ref.catColor + '40">' +
            ref.catEmoji + ' ' + ref.catName + '</span>' +
            (etaA ? '<div class="tl-eta">' + etaA + '</div>' : '');
        }
        continue;
      }

      // Mission event rows
      var evIdx = ref.idx;
      var isComplete = evIdx < activeIdx;
      var isActive = evIdx === activeIdx;
      var cls = isComplete ? 'tl-complete' : isActive ? 'tl-active' : 'tl-upcoming';
      el.className = 'tl-event ' + cls;
      var crit = EVENTS[evIdx].crit;
      var etaStr = computeEtaStr(evIdx, activeIdx, nowMet);
      var nameDiv2 = el.querySelector('.tl-name');
      if (nameDiv2) {
        nameDiv2.innerHTML =
          EVENTS[evIdx].name + (isComplete ? '<span class="tl-check"> \u2713</span>' : '') +
          '<span class="tl-crit tl-crit-' + crit + '">' + crit + '</span>' +
          (etaStr ? '<div class="tl-eta">' + etaStr + '</div>' : '');
      }
    }
  }

  function buildCrewFilter(nowMet) {
    var acts = window.CREW_ACTIVITIES || [];
    var cats = window.CREW_ACTIVITY_CATEGORIES || {};
    var filtered = [];

    // All mission events
    for (var i = 0; i < EVENTS.length; i++) {
      var ev = EVENTS[i];
      filtered.push({
        metSec: ev.metSec, name: ev.name, day: ev.day, crit: ev.crit,
        phase: ev.phase, _i: i, desc: ev.desc || null, crew: ev.crew || null,
        _isActivity: false,
      });
    }

    // All crew activities (skip pre-launch)
    for (var j = 0; j < acts.length; j++) {
      var act = acts[j];
      if (act.startMet < 0) continue;
      var catDef = cats[act.category] || {};
      filtered.push({
        metSec: act.startMet,
        name: act.label,
        day: act.fd,
        crit: null,
        phase: 'crew',
        _i: -(j + 1),
        _isActivity: true,
        _category: act.category,
        _catEmoji: catDef.emoji || '\u2022',
        _catColor: catDef.color || '#888888',
        _catName: catDef.name || act.category,
        _endMet: act.endMet,
        desc: act.detail || null,
        crew: null,
      });
    }

    // Sort chronologically
    filtered.sort(function(a, b) { return a.metSec - b.metSec; });
    return filtered;
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
    if (activePhaseFilter === 'crew') {
      filtered = buildCrewFilter(nowMet);
    } else {
      for (var i = 0; i < EVENTS.length; i++) {
        var ev = EVENTS[i];
        if (activePhaseFilter === 'all' || ev.phase === activePhaseFilter) {
          filtered.push({ metSec: ev.metSec, name: ev.name, day: ev.day, crit: ev.crit, phase: ev.phase, _i: i, desc: ev.desc || null, crew: ev.crew || null, _isActivity: false });
        }
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
        dh.textContent = DAY_LABELS[ev.day] || ('FLIGHT DAY ' + ev.day);
        scroll.appendChild(dh);
      }

      var isActivity = !!ev._isActivity;
      var isComplete, isActive, isOngoing, cls;
      isOngoing = false;

      if (isActivity) {
        isComplete = ev.metSec < nowMet;
        isOngoing = ev.metSec <= nowMet && ev._endMet > nowMet;
        cls = isOngoing ? 'tl-active' : isComplete ? 'tl-complete' : 'tl-upcoming';
      } else {
        isComplete = ev._i < activeIdx;
        isActive = ev._i === activeIdx;
        cls = isComplete ? 'tl-complete' : isActive ? 'tl-active' : 'tl-upcoming';
      }

      var evDate = new Date(LAUNCH_UTC.getTime() + ev.metSec * 1000);
      var localStr = fmtLocal(evDate, true) + ' ' + tzAbbr(evDate);
      var utcStr = fmtUTC(evDate);

      var badgeHtml, dotHtml, etaStr;

      if (isActivity) {
        var dur = ev._endMet > ev.metSec ? fmtDur(ev._endMet - ev.metSec) : '';
        etaStr = (Math.abs(ev.metSec - nowMet) < 7200 || ev.metSec > nowMet)
          ? computeActivityEtaStr(ev.metSec, nowMet) : '';
        dotHtml = '<div class="tl-dot" style="background:' + ev._catColor + '"></div>';
        badgeHtml = '<span class="tl-cat" style="color:' + ev._catColor + ';border-color:' + ev._catColor + '40">' +
          ev._catEmoji + '\u00a0' + ev._catName + '</span>' +
          (dur ? '<span class="tl-dur">' + dur + '</span>' : '');
      } else {
        etaStr = computeEtaStr(ev._i, activeIdx, nowMet);
        dotHtml = '<div class="tl-dot"></div>';
        badgeHtml = '<span class="tl-crit tl-crit-' + ev.crit + '">' + ev.crit + '</span>';
      }

      var detailHtml = '';
      if (ev.desc || ev.crew) {
        detailHtml = '<div class="tl-detail">';
        if (ev.crew) detailHtml += '<div class="tl-crew">\ud83d\udc68\u200d\ud83d\ude80 ' + ev.crew + '</div>';
        if (ev.desc) detailHtml += '<div class="tl-desc-text">' + ev.desc + '</div>';
        detailHtml += '</div>';
      }

      var el = document.createElement('div');
      el.className = 'tl-event ' + cls + (isActivity ? ' tl-activity' : '');
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.innerHTML =
        dotHtml +
        '<div class="tl-met">' + fmtMet(ev.metSec) +
          '<div class="tl-localtime">' + localStr + '<br>' + utcStr + '</div>' +
        '</div>' +
        '<div class="tl-name">' +
          ev.name + (isComplete && !isOngoing ? '<span class="tl-check"> \u2713</span>' : '') +
          badgeHtml +
          (etaStr ? '<div class="tl-eta">' + etaStr + '</div>' : '') +
        '</div>' +
        detailHtml;

      scroll.appendChild(el);
      rowRefs.push({
        el: el, idx: ev._i, isActivity: isActivity,
        metSec: ev.metSec, endMet: ev._endMet || ev.metSec,
        name: ev.name,
        catColor: ev._catColor || '', catEmoji: ev._catEmoji || '', catName: ev._catName || '',
      });

      if (ev.desc || ev.crew) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (function(target) {
          return function(e) {
            e.stopPropagation();
            var wasExpanded = target.classList.contains('tl-expanded');
            var allExpanded = scroll.querySelectorAll('.tl-expanded');
            for (var j = 0; j < allExpanded.length; j++) allExpanded[j].classList.remove('tl-expanded');
            if (!wasExpanded) target.classList.add('tl-expanded');
          };
        })(el));
      }
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); }
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
