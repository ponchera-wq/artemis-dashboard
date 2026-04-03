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
    { metSec:      7,                       name:'SLS clears tower, roll/pitch maneuver',         day:1, crit:'ROUTINE',  phase:'ascent',     desc:'SLS clears the 322-foot launch tower and begins its roll and pitch maneuver to align with the planned trajectory.' },
    { metSec:     56,                       name:'SLS reaches supersonic speed',                  day:1, crit:'ROUTINE',  phase:'ascent',     desc:'SLS passes through Mach 1, transitioning to supersonic flight approximately 56 seconds after liftoff.' },
    { metSec:     70,                       name:'Maximum dynamic pressure (Max Q)',              day:1, crit:'HIGH',     phase:'ascent',     desc:'Maximum aerodynamic stress on the vehicle. SLS throttles engines to reduce structural loads during passage through thickest atmosphere.' },
    { metSec:    128, label:'SRB SEP',      name:'Solid Rocket Booster separation',               day:1, crit:'CRITICAL', phase:'ascent',     desc:'Solid Rocket Boosters separate after burning 5.5 million pounds of propellant.', activeWin:600 },
    { metSec:    198,                       name:'Launch Abort System (LAS) jettison',            day:1, crit:'CRITICAL', phase:'ascent',     desc:'The Launch Abort System is no longer needed above the atmosphere and is jettisoned to reduce weight.' },
    { metSec:    486, label:'CORE MECO',    name:'Core stage main engine cutoff (MECO)',          day:1, crit:'HIGH',     phase:'ascent',     desc:'Core stage main engine cutoff. Core stage separates from ICPS upper stage.', activeWin:600 },
    { metSec:    498,                       name:'Core stage separates from ICPS',                day:1, crit:'CRITICAL', phase:'ascent',     desc:'The core stage separates from the Interim Cryogenic Propulsion Stage (ICPS), which will perform remaining orbital burns.' },
    { metSec:    508,                       name:'ICPS RL10 nozzle extension',                    day:1, crit:'MEDIUM',   phase:'ascent',     desc:'The ICPS RL10 engine nozzle extends to its full length in preparation for orbital burns.' },
    { metSec:   1200, label:'SOLAR ARRAYS', name:'Orion solar arrays deploy',                     day:1, crit:'MEDIUM',   phase:'ascent',     desc:'Orion solar arrays deploy, providing electrical power to the spacecraft.', activeWin:900 },

    // ── EARTH ORBIT ──
    { metSec:   2940, label:'PERIGEE RAISE',name:'Perigee raise maneuver (ICPS burn 1)',          day:1, crit:'HIGH',     phase:'orbit',      desc:'ICPS fires to raise perigee altitude, setting up for apogee raise.', activeWin:900 },
    { metSec:   6477, label:'APOGEE RAISE', name:'Apogee raise burn (ICPS burn 2, ~18 min)',      day:1, crit:'HIGH',     phase:'orbit',      desc:'ICPS second burn raises apogee to high elliptical orbit.', activeWin:900 },
    { metSec:   7560, label:'ICPS SEP',     name:'ICPS separation',                               day:1, crit:'CRITICAL', phase:'orbit',      desc:'ICPS upper stage separates. Orion is now free-flying.', activeWin:600 },
    { metSec:   8100,                       name:'Orion main engine first firing (~15 sec)',       day:1, crit:'HIGH',     phase:'orbit',      desc:'Orion fires its main engine for the first time — a 15-second test validating the European Service Module propulsion.' },
    { metSec:   9000, label:'PROX OPS',     name:'Proximity operations demo begins',              day:1, crit:'HIGH',     phase:'orbit',      desc:'Proximity operations demo \u2014 Orion maneuvers near separated ICPS.', activeWin:7200 },
    { metSec:  13200,                       name:'Prox ops complete, Orion free-flying',           day:1, crit:'MEDIUM',   phase:'orbit',      desc:'Proximity operations demonstration concludes. Orion has verified its ability to maneuver safely near another object in space.' },
    { metSec:  14400,                       name:'ICPS disposal burn',                             day:1, crit:'MEDIUM',   phase:'orbit',      desc:'The spent ICPS performs a disposal burn to move into a safe orbit away from Orion.' },
    { metSec:  18000,                       name:'CubeSat deployments (Argentina, S.Korea, Germany, Saudi Arabia)', day:1, crit:'MEDIUM', phase:'orbit', desc:'Small CubeSat satellites from Argentina, South Korea, Germany, and Saudi Arabia are deployed from the ICPS.' },
    { metSec:  28800,                       name:'Crew sleep period begins',                       day:1, crit:'ROUTINE',  phase:'orbit',      desc:'Crew begins first sleep period in space aboard Orion. Sleep shifts are staggered for continuous spacecraft monitoring.' },

    // ── DAY 2: ORBIT CHECKOUT & TLI ──
    { metSec:  45000,                       name:'Crew wake, systems checkout',                    day:2, crit:'ROUTINE',  phase:'orbit',      desc:'Crew wakes and begins Day 2 systems checkout, verifying life support, navigation, and communications.' },
    { metSec:  57600,                       name:'Exercise device setup & first workouts',         day:2, crit:'ROUTINE',  phase:'orbit',      desc:'Crew sets up the exercise device and conducts first workouts. Exercise is essential to counter microgravity effects.' },
    { metSec:  72000,                       name:'Koch preps TLI burn procedures',                 day:2, crit:'HIGH',     phase:'orbit',      desc:'Koch prepares TLI burn procedures, configuring Orion systems for the critical trans-lunar injection engine firing.' },
    { metSec:  90000, label:'TLI BURN',     name:'Trans-Lunar Injection burn (ESM main engine)',   day:2, crit:'CRITICAL', phase:'translunar', desc:'European Service Module main engine fires to send Orion on a free-return trajectory to the Moon.', activeWin:3600 },
    { metSec:  91200,                       name:'TLI burn complete, on course for Moon',          day:2, crit:'CRITICAL', phase:'translunar', desc:'TLI burn complete. Orion is now on a free-return trajectory — Earth gravity will bring it home after the lunar flyby.' },
    { metSec:  93600,                       name:'Post-TLI systems checkout',                      day:2, crit:'HIGH',     phase:'translunar', desc:'Post-TLI systems checkout confirms spacecraft health after the major engine burn. All systems verified nominal.' },

    // ── DAY 3: OUTBOUND COAST ──
    { metSec: 172800,                       name:'Flight Day 3 begins',                            day:3, crit:'ROUTINE',  phase:'translunar', desc:'Flight Day 3 begins. Crew enters the outbound coast phase heading toward the Moon at ~3,500 km/h.' },  // [EDITORIAL] structural day boundary
    { metSec: 187200, label:'TCB-1',        name:'Outbound trajectory correction burn 1',          day:3, crit:'HIGH',     phase:'translunar', desc:'Outbound trajectory correction burn 1 \u2014 fine-tunes course toward the Moon.', activeWin:900 },
    { metSec: 198000,                       name:'CPR procedures demo in microgravity',            day:3, crit:'ROUTINE',  phase:'translunar', desc:'Glover, Koch, and Hansen demonstrate CPR procedures in microgravity — validating emergency medical capability for deep space.' },  // [SPECULATIVE] crew activity placeholder
    { metSec: 208800,                       name:'Medical kit checkout (thermometer, BP, stethoscope)', day:3, crit:'ROUTINE', phase:'translunar', desc:'Wiseman and Glover check out Orion medical kit: thermometer, blood pressure monitor, stethoscope, and otoscope.' },  // [SPECULATIVE] crew activity placeholder
    { metSec: 216000,                       name:'Deep Space Network emergency comms test',        day:3, crit:'HIGH',     phase:'translunar', desc:'Koch tests Orion emergency communications on the Deep Space Network, verifying backup comms capability.' },

    // ── DAY 4: OUTBOUND COAST ──
    { metSec: 259200,                       name:'Flight Day 4 begins',                            day:4, crit:'ROUTINE',  phase:'translunar', desc:'Flight Day 4 begins. Orion is now over 200,000 km from Earth, approaching the halfway point to the Moon.' },  // [EDITORIAL] structural day boundary
    { metSec: 280800,                       name:'Celestial body photography session',             day:4, crit:'ROUTINE',  phase:'translunar', desc:'Crew photographs celestial bodies from Orion windows, documenting views of Earth, Moon, and stars from deep space.' },  // [EDITORIAL] crew activity
    { metSec: 288000, label:'O2O LASER',    name:'O2O laser comms test (4K video at 260 Mbps)',    day:4, crit:'HIGH',     phase:'translunar', desc:'Optical to Orion laser comms test \u2014 4K video downlink via laser from deep space.', activeWin:7200 },  // [SPECULATIVE] timing approximate
    { metSec: 302400,                       name:'Life support validation continues',              day:4, crit:'MEDIUM',   phase:'translunar', desc:'Continued life support validation — monitoring CO2 scrubbing, water recycling, and cabin atmosphere performance.' },  // [SPECULATIVE] generic placeholder

    // ── DAY 5: LUNAR APPROACH ──
    { metSec: 345600,                       name:'Flight Day 5 begins',                            day:5, crit:'ROUTINE',  phase:'lunar',      desc:'Flight Day 5 begins. Orion approaches the lunar sphere of influence where the Moon gravity begins to dominate.' },  // [EDITORIAL] structural day boundary
    { metSec: 360000, label:'LUNAR SOI',    name:'Enter lunar sphere of influence',                day:5, crit:'HIGH',     phase:'lunar',      desc:'Orion enters the Moon\u2019s gravitational sphere of influence.', activeWin:7200 },
    { metSec: 374400,                       name:'Spacesuit pressure test & emergency drill',      day:5, crit:'HIGH',     phase:'lunar',      desc:'First in-space test of the Orion Crew Survival System suits: pressurization, mobility, eating/drinking through helmet ports, and emergency seat ingress.' },
    { metSec: 388800,                       name:'Trajectory correction burn 2',                   day:5, crit:'HIGH',     phase:'lunar',      desc:'Final outbound trajectory correction burn fine-tunes the approach angle for the lunar flyby on Day 6.' },

    // ── DAY 6: LUNAR FLYBY ──
    { metSec: 432000,                       name:'Flight Day 6 begins',                            day:6, crit:'ROUTINE',  phase:'lunar',      desc:'Flight Day 6 begins — lunar flyby day. The crew prepares for the closest approach to the Moon.' },  // [EDITORIAL] structural day boundary
    { metSec: 453600,                       name:'Lunar far side observations begin',              day:6, crit:'HIGH',     phase:'lunar',      desc:'Crew begins observations of the lunar far side from ~6,500 km altitude. The Moon fills the windows.' },
    { metSec: 433200, label:'FAR SIDE LOS', name:'Loss of Signal \u2014 far side pass (~40 min)',  day:6, crit:'CRITICAL', phase:'lunar',      desc:'Orion passes behind the Moon. ~40 minutes of planned communications blackout.', activeWin:3600 },
    { metSec: 433500, label:'CLOSEST APPROACH', name:'Closest approach: ~6,500 km from lunar surface', day:6, crit:'CRITICAL', phase:'lunar', desc:'Orion passes ~6,500 km above the lunar far side.', activeWin:3600 },
    { metSec: 435900, label:'SIGNAL ACQ',   name:'Acquisition of Signal \u2014 comms restored',    day:6, crit:'CRITICAL', phase:'lunar',      desc:'Signal reacquired after far-side pass. Crew reports status.', activeWin:1800 },
    { metSec: 438000,                       name:'Earthrise photography session',                  day:6, crit:'MEDIUM',   phase:'lunar',      desc:'Crew photographs Earthrise over the lunar limb — one of the iconic views of the mission. Earth appears as a blue marble ~400,000 km away.' },  // [EDITORIAL] crew activity
    { metSec: 445200,                       name:'Break Apollo 13 distance record (400,171 km)',   day:6, crit:'HIGH',     phase:'lunar',      desc:'Orion passes 400,171 km from Earth, exceeding the distance record set by Apollo 13 crew in 1970.' },  // [EDITORIAL] milestone, not a flight event

    // ── DAYS 7-9: RETURN COAST ──
    { metSec: 518400,                       name:'Flight Day 7',                                   day:7, crit:'ROUTINE',  phase:'return',     desc:'Flight Day 7. Return coast begins. Orion is heading home, pulled by Earth gravity on its free-return path.' },  // [EDITORIAL] structural day boundary
    { metSec: 540000, label:'RETURN TCB',   name:'Return trajectory correction burn',              day:7, crit:'HIGH',     phase:'return',     desc:'Return trajectory correction burn \u2014 targets Pacific Ocean splashdown zone.', activeWin:900 },
    { metSec: 604800,                       name:'Flight Day 8 \u2014 crew downlink / live broadcast', day:7, crit:'ROUTINE', phase:'return',   desc:'Flight Day 8. Crew conducts live broadcast and video downlink from deep space, sharing the experience with Earth.' },  // [EDITORIAL] structural day boundary
    { metSec: 691200,                       name:'Flight Day 9 \u2014 re-entry procedures review', day:7, crit:'HIGH',     phase:'return',     desc:'Flight Day 9. Crew reviews re-entry procedures, practices checklist callouts, and configures Orion for atmospheric entry.' },
    { metSec: 756000,                       name:'Suit up for re-entry',                           day:7, crit:'HIGH',     phase:'return',     desc:'Crew dons Orion Crew Survival System suits for re-entry. Final cabin stowage and seat configuration.' },

    // ── DAY 10: ENTRY & SPLASHDOWN ──
    { metSec: 777600,                       name:'Flight Day 10 begins',                           day:10, crit:'HIGH',    phase:'return',     desc:'Flight Day 10. Final day. Service module separation and atmospheric re-entry are hours away.' },  // [EDITORIAL] structural day boundary
    { metSec: 820800, label:'SM SEP',       name:'European Service Module separation',             day:10, crit:'CRITICAL', phase:'return',    desc:'Service module separates. Only crew module continues to re-entry.', activeWin:600 },
    { metSec: 822600, label:'ENTRY',        name:'Entry interface \u2014 40,000 km/h',            day:10, crit:'CRITICAL', phase:'return',    desc:'Atmospheric entry at 40,000 km/h. Heat shield reaches 2,800\u00b0C during skip re-entry.', activeWin:1800 },
    { metSec: 823200, label:'PEAK HEATING', name:'Peak heating \u2014 2,800\u00b0C on heat shield', day:10, crit:'CRITICAL', phase:'return',  desc:'Peak heating \u2014 heat shield surface reaches 2,800\u00b0C.', activeWin:600 },
    { metSec: 823800,                       name:'Communications blackout during re-entry',        day:10, crit:'CRITICAL', phase:'return',     desc:'Orion enters communications blackout as ionized plasma surrounds the capsule during peak re-entry heating.' },
    { metSec: 824400,                       name:'Drogue chutes deploy',                           day:10, crit:'CRITICAL', phase:'return',     desc:'Two drogue chutes deploy at ~7,600m altitude to stabilise the capsule and slow it from supersonic speed.' },
    { metSec: 824580, label:'CHUTES',       name:'Main chutes deploy',                             day:10, crit:'CRITICAL', phase:'return',    desc:'Main parachutes deploy at ~7,600m altitude, slowing Orion to ~30 km/h.', activeWin:600 },
    { metSec: 824760, label:'SPLASHDOWN',   name:'Splashdown \u2014 Pacific Ocean',               day:10, crit:'CRITICAL', phase:'return',    desc:'Orion splashes down in the Pacific Ocean. Recovery by USS Portland.', activeWin:600 },
    { metSec: 826200,                       name:'Recovery team reaches Orion',                    day:10, crit:'MEDIUM',   phase:'return',     desc:'USS Portland recovery team reaches Orion. Divers attach stabilization collar, crew remains inside until secured on ship.' },
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
