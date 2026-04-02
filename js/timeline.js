// timeline.js — Mission timeline + APOD
// ══════════════════════════════════════════════════════════════════════
// ── MISSION TIMELINE — FULL NASA PRESS KIT SCHEDULE ──────────────────
(function() {
  const DAY_LABELS = {
    1:  'DAY 1 — LAUNCH & EARTH ORBIT',
    2:  'DAY 2 — EARTH ORBIT CHECKOUT & TLI',
    3:  'DAY 3 — OUTBOUND COAST',
    4:  'DAY 4 — OUTBOUND COAST',
    5:  'DAY 5 — LUNAR APPROACH',
    6:  'DAY 6 — LUNAR FLYBY',
    7:  'DAYS 7\u20139 — RETURN COAST',
    10: 'DAY 10 — RE-ENTRY & SPLASHDOWN',
  };

  // met = seconds, crit = CRITICAL|HIGH|MEDIUM|ROUTINE, phase = filter category
  const EVENTS = [
    // ── ASCENT (all confirmed) ──
    { met:      0, name: 'Liftoff',                                       day: 1, crit:'CRITICAL', phase:'ascent' },
    { met:      7, name: 'SLS clears tower, roll/pitch maneuver',         day: 1, crit:'ROUTINE',  phase:'ascent' },
    { met:     56, name: 'SLS reaches supersonic speed',                  day: 1, crit:'ROUTINE',  phase:'ascent' },
    { met:     70, name: 'Maximum dynamic pressure (Max Q)',              day: 1, crit:'HIGH',     phase:'ascent' },
    { met:    128, name: 'Solid Rocket Booster separation',               day: 1, crit:'CRITICAL', phase:'ascent' },
    { met:    198, name: 'Launch Abort System (LAS) jettison',            day: 1, crit:'CRITICAL', phase:'ascent' },
    { met:    486, name: 'Core stage main engine cutoff (MECO)',          day: 1, crit:'HIGH',     phase:'ascent' },
    { met:    498, name: 'Core stage separates from ICPS',                day: 1, crit:'CRITICAL', phase:'ascent' },
    { met:    508, name: 'ICPS RL10 nozzle extension',                    day: 1, crit:'MEDIUM',   phase:'ascent' },
    { met:   1200, name: 'Orion solar arrays deploy',                     day: 1, crit:'MEDIUM',   phase:'ascent' },
    // ── EARTH ORBIT ──
    { met:   2940, name: 'Perigee raise maneuver (ICPS burn 1)',          day: 1, crit:'HIGH',     phase:'orbit' },
    { met:   6477, name: 'Apogee raise burn (ICPS burn 2, ~18 min)',      day: 1, crit:'HIGH',     phase:'orbit' },
    { met:   7560, name: 'ICPS separation',                               day: 1, crit:'CRITICAL', phase:'orbit' },
    { met:   8100, name: 'Orion main engine first firing (~15 sec)',       day: 1, crit:'HIGH',     phase:'orbit' },
    { met:   9000, name: 'Proximity operations demo begins',              day: 1, crit:'HIGH',     phase:'orbit' },
    { met:  13200, name: 'Prox ops complete, Orion free-flying',           day: 1, crit:'MEDIUM',   phase:'orbit' },
    { met:  14400, name: 'ICPS disposal burn',                             day: 1, crit:'MEDIUM',   phase:'orbit' },
    { met:  18000, name: 'CubeSat deployments (Argentina, S.Korea, Germany, Saudi Arabia)', day: 1, crit:'MEDIUM', phase:'orbit' },
    { met:  28800, name: 'Crew sleep period begins',                       day: 1, crit:'ROUTINE',  phase:'orbit' },
    // ── DAY 2: ORBIT CHECKOUT & TLI ──
    { met:  45000, name: 'Crew wake, systems checkout',                    day: 2, crit:'ROUTINE',  phase:'orbit' },
    { met:  57600, name: 'Exercise device setup & first workouts',         day: 2, crit:'ROUTINE',  phase:'orbit' },
    { met:  72000, name: 'Koch preps TLI burn procedures',                 day: 2, crit:'HIGH',     phase:'orbit' },
    { met:  90000, name: 'Trans-Lunar Injection burn (ESM main engine)',   day: 2, crit:'CRITICAL', phase:'translunar' },
    { met:  91200, name: 'TLI burn complete, on course for Moon',          day: 2, crit:'CRITICAL', phase:'translunar' },
    { met:  93600, name: 'Post-TLI systems checkout',                      day: 2, crit:'HIGH',     phase:'translunar' },
    // ── DAY 3: OUTBOUND COAST ──
    { met: 172800, name: 'Flight Day 3 begins',                            day: 3, crit:'ROUTINE',  phase:'translunar' },
    { met: 187200, name: 'Outbound trajectory correction burn 1',          day: 3, crit:'HIGH',     phase:'translunar' },
    { met: 198000, name: 'CPR procedures demo in microgravity',            day: 3, crit:'ROUTINE',  phase:'translunar' },
    { met: 208800, name: 'Medical kit checkout (thermometer, BP, stethoscope)', day: 3, crit:'ROUTINE', phase:'translunar' },
    { met: 216000, name: 'Deep Space Network emergency comms test',        day: 3, crit:'HIGH',     phase:'translunar' },
    // ── DAY 4: OUTBOUND COAST ──
    { met: 259200, name: 'Flight Day 4 begins',                            day: 4, crit:'ROUTINE',  phase:'translunar' },
    { met: 280800, name: 'Celestial body photography session',             day: 4, crit:'ROUTINE',  phase:'translunar' },
    { met: 288000, name: 'O2O laser comms test (4K video at 260 Mbps)',    day: 4, crit:'HIGH',     phase:'translunar' },
    { met: 302400, name: 'Life support validation continues',              day: 4, crit:'MEDIUM',   phase:'translunar' },
    // ── DAY 5: LUNAR APPROACH ──
    { met: 345600, name: 'Flight Day 5 begins',                            day: 5, crit:'ROUTINE',  phase:'lunar' },
    { met: 360000, name: 'Enter lunar sphere of influence',                day: 5, crit:'HIGH',     phase:'lunar' },
    { met: 374400, name: 'Spacesuit pressure test & emergency drill',      day: 5, crit:'HIGH',     phase:'lunar' },
    { met: 388800, name: 'Trajectory correction burn 2',                   day: 5, crit:'HIGH',     phase:'lunar' },
    // ── DAY 6: LUNAR FLYBY ──
    { met: 432000, name: 'Flight Day 6 begins',                            day: 6, crit:'ROUTINE',  phase:'lunar' },
    { met: 453600, name: 'Lunar far side observations begin',              day: 6, crit:'HIGH',     phase:'lunar' },
    { met: 460800, name: 'Closest approach: ~6,500 km from lunar surface', day: 6, crit:'CRITICAL', phase:'lunar' },
    { met: 462000, name: 'Loss of Signal \u2014 far side pass (~41 min)',  day: 6, crit:'CRITICAL', phase:'lunar' },
    { met: 464460, name: 'Acquisition of Signal \u2014 comms restored',    day: 6, crit:'CRITICAL', phase:'lunar' },
    { met: 468000, name: 'Earthrise photography session',                  day: 6, crit:'MEDIUM',   phase:'lunar' },
    { met: 475200, name: 'Break Apollo 13 distance record (400,171 km)',   day: 6, crit:'HIGH',     phase:'lunar' },
    // ── DAYS 7-9: RETURN COAST ──
    { met: 518400, name: 'Flight Day 7',                                   day: 7, crit:'ROUTINE',  phase:'return' },
    { met: 540000, name: 'Return trajectory correction burn',              day: 7, crit:'HIGH',     phase:'return' },
    { met: 604800, name: 'Flight Day 8 \u2014 crew downlink / live broadcast', day: 7, crit:'ROUTINE', phase:'return' },
    { met: 691200, name: 'Flight Day 9 \u2014 re-entry procedures review', day: 7, crit:'HIGH',     phase:'return' },
    { met: 756000, name: 'Suit up for re-entry',                           day: 7, crit:'HIGH',     phase:'return' },
    // ── DAY 10: ENTRY & SPLASHDOWN ──
    { met: 777600, name: 'Flight Day 10 begins',                           day: 10, crit:'HIGH',    phase:'return' },
    { met: 820800, name: 'European Service Module separation',             day: 10, crit:'CRITICAL', phase:'return' },
    { met: 822600, name: 'Entry interface \u2014 40,000 km/h',            day: 10, crit:'CRITICAL', phase:'return' },
    { met: 823200, name: 'Peak heating \u2014 2,800\u00b0C on heat shield', day: 10, crit:'CRITICAL', phase:'return' },
    { met: 823800, name: 'Communications blackout during re-entry',        day: 10, crit:'CRITICAL', phase:'return' },
    { met: 824400, name: 'Drogue chutes deploy',                           day: 10, crit:'CRITICAL', phase:'return' },
    { met: 824580, name: 'Main chutes deploy',                             day: 10, crit:'CRITICAL', phase:'return' },
    { met: 824760, name: 'Splashdown \u2014 Pacific Ocean',               day: 10, crit:'CRITICAL', phase:'return' },
    { met: 826200, name: 'Recovery team reaches Orion',                    day: 10, crit:'MEDIUM',   phase:'return' },
  ];

  let activePhaseFilter = 'all';

  function fmtMet(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `T+${String(h).padStart(h >= 100 ? 3 : 2, '0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function renderTimeline() {
    const nowMet = (Date.now() - LAUNCH_UTC) / 1000;
    const scroll = document.getElementById('timeline-scroll');
    if (!scroll) return;

    // Find active event (unfiltered)
    let activeIdx = 0;
    for (let i = 0; i < EVENTS.length; i++) {
      if (EVENTS[i].met <= nowMet) activeIdx = i;
      else break;
    }

    // Flight day badge
    const launchMidnight = Date.UTC(2026, 3, 1);
    const nowMidnight = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    const flightDay = Math.floor((nowMidnight - launchMidnight) / 86400000) + 1;
    const badge = document.getElementById('flight-day-badge');
    if (badge) badge.textContent = `FLIGHT DAY ${Math.max(1, flightDay)}`;

    // Show active event in Mission Phase box
    const curEvEl = document.getElementById('current-event-name');
    if (curEvEl) curEvEl.textContent = '\u25b6 ' + EVENTS[activeIdx].name;

    // Next-event countdown
    const nextEv = EVENTS[activeIdx + 1];
    const tln = document.getElementById('tl-next-event');
    if (tln) {
      if (nextEv) {
        const remaining = nextEv.met - nowMet;
        const eventDate = new Date(LAUNCH_UTC.getTime() + nextEv.met * 1000);
        const hh = Math.floor(remaining / 3600);
        const mm = Math.floor((remaining % 3600) / 60);
        const countStr = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
        const localWhen = fmtLocal(eventDate, true) + ' ' + tzAbbr(eventDate);
        tln.innerHTML =
          `<div><span class="tl-next-label">NEXT: </span>${nextEv.name}</div>` +
          `<div class="tl-next-when">in ${countStr} \u00b7 ${localWhen}</div>`;
      } else { tln.textContent = ''; }
    }

    // Filter events by phase
    const filtered = activePhaseFilter === 'all'
      ? EVENTS.map((ev, i) => ({ ...ev, _i: i }))
      : EVENTS.map((ev, i) => ({ ...ev, _i: i })).filter(ev => ev.phase === activePhaseFilter);

    scroll.innerHTML = '';
    let lastDay = null;
    let activeEl = null;

    filtered.forEach(ev => {
      if (ev.day !== lastDay) {
        lastDay = ev.day;
        const dh = document.createElement('div');
        dh.className = 'tl-day-header';
        dh.textContent = DAY_LABELS[ev.day] || `DAY ${ev.day}`;
        scroll.appendChild(dh);
      }

      const isComplete = ev._i < activeIdx;
      const isActive = ev._i === activeIdx;
      const cls = isComplete ? 'tl-complete' : isActive ? 'tl-active' : 'tl-upcoming';

      const evDate = new Date(LAUNCH_UTC.getTime() + ev.met * 1000);
      const localStr = fmtLocal(evDate, true) + ' ' + tzAbbr(evDate);
      const utcStr = fmtUTC(evDate);

      // ETA countdown/ago for each event
      let etaStr = '';
      if (ev._i > activeIdx) {
        const remaining = ev.met - nowMet;
        const hh = Math.floor(remaining / 3600);
        const mm = Math.floor((remaining % 3600) / 60);
        etaStr = hh > 0 ? `in ${hh}h ${mm}m` : `in ${mm}m`;
      } else if (isActive) {
        const ago = nowMet - ev.met;
        if (ago < 120) etaStr = 'NOW';
        else { const hh = Math.floor(ago / 3600); const mm = Math.floor((ago % 3600) / 60); etaStr = hh > 0 ? `${hh}h ${mm}m ago` : `${mm}m ago`; }
      } else if (ev._i >= activeIdx - 3) {
        const ago = nowMet - ev.met;
        const hh = Math.floor(ago / 3600); const mm = Math.floor((ago % 3600) / 60);
        etaStr = hh > 0 ? `${hh}h ${mm}m ago` : `${mm}m ago`;
      }

      const el = document.createElement('div');
      el.className = `tl-event ${cls}`;
      el.innerHTML = `
        <div class="tl-dot"></div>
        <div class="tl-met">${fmtMet(ev.met)}
          <div class="tl-localtime">${localStr}<br>${utcStr}</div>
        </div>
        <div class="tl-name">${ev.name}${isComplete ? '<span class="tl-check"> \u2713</span>' : ''}<span class="tl-crit tl-crit-${ev.crit}">${ev.crit}</span>${etaStr ? `<div class="tl-eta">${etaStr}</div>` : ''}</div>
      `;
      scroll.appendChild(el);
      if (isActive) activeEl = el;
    });

    if (activeEl) setTimeout(() => {
      const container = document.getElementById('timeline-scroll');
      if (container) {
        const elTop = activeEl.offsetTop;
        const center = elTop - container.clientHeight / 2 + activeEl.offsetHeight / 2;
        container.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
      }
    }, 80);
  }

  renderTimeline();
  setInterval(renderTimeline, 30000);

  // Phase filter tabs
  document.querySelectorAll('.tl-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tl-filter').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      activePhaseFilter = btn.dataset.phase;
      renderTimeline();
    });
  });

})();
