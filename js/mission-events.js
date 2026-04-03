// mission-events.js — Single source of truth for all mission events
// Merges trajectory.js WAYPOINTS + timeline.js EVENTS into one canonical list.
// All timing uses metSec (seconds from LAUNCH_UTC).
// ══════════════════════════════════════════════════════════════════════
(function() {

  // Canonical event list — NASA press kit timings (pre-mission planning estimates).
  // Lunar flyby events (CA, LOS, AOS) updated to match the OEM trajectory revision
  // from NASA/JSC/FOD/FDO. The OEM places closest approach at ~T+120.4h rather than
  // the press kit's T+128h, reflecting a different trajectory planning iteration.
  // Events marked [SPECULATIVE] have editorial or demo-quality timing.
  // Events marked [EDITORIAL] are milestones added for public interest, not flight events.
  var events = [
    // ── ASCENT (confirmed press kit) ──
    { metSec:      0, label:'LAUNCH',       name:'Liftoff',                                       day:1, crit:'CRITICAL', phase:'ascent',     desc:'SLS rocket lifts off from Pad 39B at Kennedy Space Center with 8.8 million pounds of thrust.', activeWin:600 },
    { metSec:      7,                       name:'SLS clears tower, roll/pitch maneuver',         day:1, crit:'ROUTINE',  phase:'ascent' },
    { metSec:     56,                       name:'SLS reaches supersonic speed',                  day:1, crit:'ROUTINE',  phase:'ascent' },
    { metSec:     70,                       name:'Maximum dynamic pressure (Max Q)',              day:1, crit:'HIGH',     phase:'ascent' },
    { metSec:    128, label:'SRB SEP',      name:'Solid Rocket Booster separation',               day:1, crit:'CRITICAL', phase:'ascent',     desc:'Solid Rocket Boosters separate after burning 5.5 million pounds of propellant.', activeWin:600 },
    { metSec:    198,                       name:'Launch Abort System (LAS) jettison',            day:1, crit:'CRITICAL', phase:'ascent' },
    { metSec:    486, label:'CORE MECO',    name:'Core stage main engine cutoff (MECO)',          day:1, crit:'HIGH',     phase:'ascent',     desc:'Core stage main engine cutoff. Core stage separates from ICPS upper stage.', activeWin:600 },
    { metSec:    498,                       name:'Core stage separates from ICPS',                day:1, crit:'CRITICAL', phase:'ascent' },
    { metSec:    508,                       name:'ICPS RL10 nozzle extension',                    day:1, crit:'MEDIUM',   phase:'ascent' },
    { metSec:   1200, label:'SOLAR ARRAYS', name:'Orion solar arrays deploy',                     day:1, crit:'MEDIUM',   phase:'ascent',     desc:'Orion solar arrays deploy, providing electrical power to the spacecraft.', activeWin:900 },

    // ── EARTH ORBIT ──
    { metSec:   2940, label:'PERIGEE RAISE',name:'Perigee raise maneuver (ICPS burn 1)',          day:1, crit:'HIGH',     phase:'orbit',      desc:'ICPS fires to raise perigee altitude, setting up for apogee raise.', activeWin:900 },
    { metSec:   6477, label:'APOGEE RAISE', name:'Apogee raise burn (ICPS burn 2, ~18 min)',      day:1, crit:'HIGH',     phase:'orbit',      desc:'ICPS second burn raises apogee to high elliptical orbit.', activeWin:900 },
    { metSec:   7560, label:'ICPS SEP',     name:'ICPS separation',                               day:1, crit:'CRITICAL', phase:'orbit',      desc:'ICPS upper stage separates. Orion is now free-flying.', activeWin:600 },
    { metSec:   8100,                       name:'Orion main engine first firing (~15 sec)',       day:1, crit:'HIGH',     phase:'orbit' },
    { metSec:   9000, label:'PROX OPS',     name:'Proximity operations demo begins',              day:1, crit:'HIGH',     phase:'orbit',      desc:'Proximity operations demo \u2014 Orion maneuvers near separated ICPS.', activeWin:7200 },
    { metSec:  13200,                       name:'Prox ops complete, Orion free-flying',           day:1, crit:'MEDIUM',   phase:'orbit' },
    { metSec:  14400,                       name:'ICPS disposal burn',                             day:1, crit:'MEDIUM',   phase:'orbit' },
    { metSec:  18000,                       name:'CubeSat deployments (Argentina, S.Korea, Germany, Saudi Arabia)', day:1, crit:'MEDIUM', phase:'orbit' },
    { metSec:  28800,                       name:'Crew sleep period begins',                       day:1, crit:'ROUTINE',  phase:'orbit' },

    // ── DAY 2: ORBIT CHECKOUT & TLI ──
    { metSec:  45000,                       name:'Crew wake, systems checkout',                    day:2, crit:'ROUTINE',  phase:'orbit' },
    { metSec:  57600,                       name:'Exercise device setup & first workouts',         day:2, crit:'ROUTINE',  phase:'orbit' },
    { metSec:  72000,                       name:'Koch preps TLI burn procedures',                 day:2, crit:'HIGH',     phase:'orbit' },
    { metSec:  90000, label:'TLI BURN',     name:'Trans-Lunar Injection burn (ESM main engine)',   day:2, crit:'CRITICAL', phase:'translunar', desc:'European Service Module main engine fires to send Orion on a free-return trajectory to the Moon.', activeWin:3600 },
    { metSec:  91200,                       name:'TLI burn complete, on course for Moon',          day:2, crit:'CRITICAL', phase:'translunar' },
    { metSec:  93600,                       name:'Post-TLI systems checkout',                      day:2, crit:'HIGH',     phase:'translunar' },

    // ── DAY 3: OUTBOUND COAST ──
    { metSec: 172800,                       name:'Flight Day 3 begins',                            day:3, crit:'ROUTINE',  phase:'translunar' },  // [EDITORIAL] structural day boundary
    { metSec: 187200, label:'TCB-1',        name:'Outbound trajectory correction burn 1',          day:3, crit:'HIGH',     phase:'translunar', desc:'Outbound trajectory correction burn 1 \u2014 fine-tunes course toward the Moon.', activeWin:900 },
    { metSec: 198000,                       name:'CPR procedures demo in microgravity',            day:3, crit:'ROUTINE',  phase:'translunar' },  // [SPECULATIVE] crew activity placeholder
    { metSec: 208800,                       name:'Medical kit checkout (thermometer, BP, stethoscope)', day:3, crit:'ROUTINE', phase:'translunar' },  // [SPECULATIVE] crew activity placeholder
    { metSec: 216000,                       name:'Deep Space Network emergency comms test',        day:3, crit:'HIGH',     phase:'translunar' },

    // ── DAY 4: OUTBOUND COAST ──
    { metSec: 259200,                       name:'Flight Day 4 begins',                            day:4, crit:'ROUTINE',  phase:'translunar' },  // [EDITORIAL] structural day boundary
    { metSec: 280800,                       name:'Celestial body photography session',             day:4, crit:'ROUTINE',  phase:'translunar' },  // [EDITORIAL] crew activity
    { metSec: 288000, label:'O2O LASER',    name:'O2O laser comms test (4K video at 260 Mbps)',    day:4, crit:'HIGH',     phase:'translunar', desc:'Optical to Orion laser comms test \u2014 4K video downlink via laser from deep space.', activeWin:7200 },  // [SPECULATIVE] timing approximate
    { metSec: 302400,                       name:'Life support validation continues',              day:4, crit:'MEDIUM',   phase:'translunar' },  // [SPECULATIVE] generic placeholder

    // ── DAY 5: LUNAR APPROACH ──
    { metSec: 345600,                       name:'Flight Day 5 begins',                            day:5, crit:'ROUTINE',  phase:'lunar' },  // [EDITORIAL] structural day boundary
    { metSec: 360000, label:'LUNAR SOI',    name:'Enter lunar sphere of influence',                day:5, crit:'HIGH',     phase:'lunar',      desc:'Orion enters the Moon\u2019s gravitational sphere of influence.', activeWin:7200 },
    { metSec: 374400,                       name:'Spacesuit pressure test & emergency drill',      day:5, crit:'HIGH',     phase:'lunar' },
    { metSec: 388800,                       name:'Trajectory correction burn 2',                   day:5, crit:'HIGH',     phase:'lunar' },

    // ── DAY 6: LUNAR FLYBY ──
    { metSec: 432000,                       name:'Flight Day 6 begins',                            day:6, crit:'ROUTINE',  phase:'lunar' },  // [EDITORIAL] structural day boundary
    { metSec: 453600,                       name:'Lunar far side observations begin',              day:6, crit:'HIGH',     phase:'lunar' },
    { metSec: 433200, label:'FAR SIDE LOS', name:'Loss of Signal \u2014 far side pass (~40 min)',  day:6, crit:'CRITICAL', phase:'lunar',      desc:'Orion passes behind the Moon. ~40 minutes of planned communications blackout.', activeWin:3600 },
    { metSec: 433500, label:'CLOSEST APPROACH', name:'Closest approach: ~6,500 km from lunar surface', day:6, crit:'CRITICAL', phase:'lunar', desc:'Orion passes ~6,500 km above the lunar far side.', activeWin:3600 },
    { metSec: 435900, label:'SIGNAL ACQ',   name:'Acquisition of Signal \u2014 comms restored',    day:6, crit:'CRITICAL', phase:'lunar',      desc:'Signal reacquired after far-side pass. Crew reports status.', activeWin:1800 },
    { metSec: 438000,                       name:'Earthrise photography session',                  day:6, crit:'MEDIUM',   phase:'lunar' },  // [EDITORIAL] crew activity
    { metSec: 445200,                       name:'Break Apollo 13 distance record (400,171 km)',   day:6, crit:'HIGH',     phase:'lunar' },  // [EDITORIAL] milestone, not a flight event

    // ── DAYS 7-9: RETURN COAST ──
    { metSec: 518400,                       name:'Flight Day 7',                                   day:7, crit:'ROUTINE',  phase:'return' },  // [EDITORIAL] structural day boundary
    { metSec: 540000, label:'RETURN TCB',   name:'Return trajectory correction burn',              day:7, crit:'HIGH',     phase:'return',     desc:'Return trajectory correction burn \u2014 targets Pacific Ocean splashdown zone.', activeWin:900 },
    { metSec: 604800,                       name:'Flight Day 8 \u2014 crew downlink / live broadcast', day:7, crit:'ROUTINE', phase:'return' },  // [EDITORIAL] structural day boundary
    { metSec: 691200,                       name:'Flight Day 9 \u2014 re-entry procedures review', day:7, crit:'HIGH',     phase:'return' },
    { metSec: 756000,                       name:'Suit up for re-entry',                           day:7, crit:'HIGH',     phase:'return' },

    // ── DAY 10: ENTRY & SPLASHDOWN ──
    { metSec: 777600,                       name:'Flight Day 10 begins',                           day:10, crit:'HIGH',    phase:'return' },  // [EDITORIAL] structural day boundary
    { metSec: 820800, label:'SM SEP',       name:'European Service Module separation',             day:10, crit:'CRITICAL', phase:'return',    desc:'Service module separates. Only crew module continues to re-entry.', activeWin:600 },
    { metSec: 822600, label:'ENTRY',        name:'Entry interface \u2014 40,000 km/h',            day:10, crit:'CRITICAL', phase:'return',    desc:'Atmospheric entry at 40,000 km/h. Heat shield reaches 2,800\u00b0C during skip re-entry.', activeWin:1800 },
    { metSec: 823200, label:'PEAK HEATING', name:'Peak heating \u2014 2,800\u00b0C on heat shield', day:10, crit:'CRITICAL', phase:'return',  desc:'Peak heating \u2014 heat shield surface reaches 2,800\u00b0C.', activeWin:600 },
    { metSec: 823800,                       name:'Communications blackout during re-entry',        day:10, crit:'CRITICAL', phase:'return' },
    { metSec: 824400,                       name:'Drogue chutes deploy',                           day:10, crit:'CRITICAL', phase:'return' },
    { metSec: 824580, label:'CHUTES',       name:'Main chutes deploy',                             day:10, crit:'CRITICAL', phase:'return',    desc:'Main parachutes deploy at ~7,600m altitude, slowing Orion to ~30 km/h.', activeWin:600 },
    { metSec: 824760, label:'SPLASHDOWN',   name:'Splashdown \u2014 Pacific Ocean',               day:10, crit:'CRITICAL', phase:'return',    desc:'Orion splashes down in the Pacific Ocean. Recovery by USS Portland.', activeWin:600 },
    { metSec: 826200,                       name:'Recovery team reaches Orion',                    day:10, crit:'MEDIUM',   phase:'return' },
  ];

  // Helper: find the most recent event at or before a given MET
  function getActiveEvent(metSec) {
    var idx = 0;
    for (var i = 0; i < events.length; i++) {
      if (events[i].metSec <= metSec) idx = i;
      else break;
    }
    return events[idx];
  }

  // Helper: find the next upcoming event after a given MET
  function getNextEvent(metSec) {
    for (var i = 0; i < events.length; i++) {
      if (events[i].metSec > metSec) return events[i];
    }
    return null;
  }

  // Helper: filter events with a 3D waypoint label (for trajectory.js)
  function getWaypoints() {
    return events.filter(function(ev) { return !!ev.label; });
  }

  // Helper: filter by phase
  function getEventsByPhase(phase) {
    if (phase === 'all') return events;
    return events.filter(function(ev) { return ev.phase === phase; });
  }

  window.MissionEvents = {
    events: events,
    getActiveEvent: getActiveEvent,
    getNextEvent: getNextEvent,
    getWaypoints: getWaypoints,
    getEventsByPhase: getEventsByPhase,
  };

})();
