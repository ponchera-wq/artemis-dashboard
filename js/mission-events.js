// mission-events.js — Single source of truth for all mission events
// Merges trajectory.js WAYPOINTS + timeline.js EVENTS into one canonical list.
// All timing uses metSec (seconds from LAUNCH_UTC).
// ══════════════════════════════════════════════════════════════════════
(function() {

  // Canonical event list — timings updated to NASA Artemis II Overview Timeline FINAL
  // (STRIVES #20260002249, approved 1/8/2026 for public release, D/HH:MM format from T-0).
  // OTC-1/2/3, RTC-1/2/3, Lunar SOI Entry/Exit, CM/SM Sep, EI, and Splashdown all
  // corrected from old press kit to final official timeline. Perilune (T+6/23:09 UTC,
  // ~6,567 km surface) confirmed by NASA/JSC/FOD/FDO OEM update 2026-04-06T12:18Z.
  // Max Earth distance and Apollo 13 distance milestone added from official timeline.
  // Events marked [EDITORIAL] are milestones added for public interest, not flight events.
  var events = [
    // ── ASCENT (confirmed press kit) ──
    { metSec:      0, label:'LAUNCH',       name:'Liftoff',                                       day:1, crit:'CRITICAL', phase:'ascent',     desc:'SLS rocket lifts off from Pad 39B at Kennedy Space Center with 8.8 million pounds of thrust.', activeWin:600 },
    { metSec:      4,                       name:'RS-25 engines at 109% thrust',                  day:1, crit:'ROUTINE',  phase:'ascent',     desc:'All four RS-25 engines throttle to 109% power. SLS producing 8.8 million pounds of thrust.' },
    { metSec:      7,                       name:'SLS clears tower, roll/pitch maneuver',         day:1, crit:'ROUTINE',  phase:'ascent',     desc:'SLS clears the 322-foot launch tower and begins roll/pitch maneuver to align with planned trajectory.' },
    { metSec:     56,                       name:'SLS reaches supersonic speed',                  day:1, crit:'ROUTINE',  phase:'ascent',     desc:'SLS passes Mach 1. Vehicle is supersonic 56 seconds after liftoff.' },
    { metSec:     70,                       name:'Maximum dynamic pressure (Max Q)',              day:1, crit:'HIGH',     phase:'ascent',     desc:'Maximum aerodynamic stress on the vehicle. Engines throttle down to reduce structural loads through thickest atmosphere.' },
    { metSec:    128, label:'SRB SEP',      name:'Solid Rocket Booster separation',               day:1, crit:'CRITICAL', phase:'ascent',     desc:'Solid Rocket Boosters separate after burning 5.5 million pounds of propellant.', activeWin:600 },
    { metSec:    170,                       name:'Spacecraft adapter fairing jettison',           day:1, crit:'HIGH',     phase:'ascent',     desc:'Protective panels enclosing the European Service Module separate. Orion no longer needs atmospheric shielding.' },
    { metSec:    198,                       name:'Launch Abort System (LAS) jettison',            day:1, crit:'CRITICAL', phase:'ascent',     desc:'Launch Abort System jettisoned — no longer needed above the atmosphere. Reduces vehicle weight by 7,000 kg.' },
    { metSec:    486, label:'CORE MECO',    name:'Core stage main engine cutoff (MECO)',          day:1, crit:'HIGH',     phase:'ascent',     desc:'Core stage main engine cutoff. Core stage separates from ICPS upper stage.', activeWin:600 },
    { metSec:    498,                       name:'Core stage separates from ICPS',                day:1, crit:'CRITICAL', phase:'ascent',     desc:'Core stage separates from the Interim Cryogenic Propulsion Stage (ICPS), which will perform remaining orbital burns.' },
    { metSec:    508,                       name:'ICPS RL10 nozzle extension',                    day:1, crit:'MEDIUM',   phase:'ascent',     desc:'ICPS RL10 engine nozzle extends to full length for orbital insertion burns.' },
    { metSec:    780,                       name:'Koch & Hansen begin cabin setup',               day:1, crit:'ROUTINE',  phase:'ascent',     desc:'Koch and Hansen unstrap from seats and begin configuring Orion for living: toilet, water dispenser, CO2 scrubber activation.', crew:'Koch, Hansen' },
    { metSec:   1080,                       name:'Solar array deployment begins',                 day:1, crit:'HIGH',     phase:'ascent',     desc:'Orion begins deploying four solar array wings from the European Service Module. Full 19-metre wingspan provides 11.1 kW of power.' },
    { metSec:   1200, label:'SOLAR ARRAYS', name:'Orion solar arrays fully deployed',            day:1, crit:'MEDIUM',   phase:'ascent',     desc:'Orion solar arrays fully deployed, providing electrical power to the spacecraft.', activeWin:900 },

    // ── EARTH ORBIT ──
    { metSec:   2940, label:'PERIGEE RAISE',name:'Perigee raise maneuver (ICPS burn 1)',          day:1, crit:'HIGH',     phase:'orbit',      desc:'ICPS fires to raise perigee altitude, setting up for apogee raise.', activeWin:900 },
    { metSec:   6477, label:'APOGEE RAISE', name:'Apogee raise burn (ICPS burn 2, ~18 min)',      day:1, crit:'HIGH',     phase:'orbit',      desc:'ICPS second burn raises apogee to high elliptical orbit.', activeWin:900 },
    { metSec:   7200,                       name:'Switch from TDRS to Deep Space Network',        day:1, crit:'HIGH',     phase:'orbit',      desc:'Orion switches communications from near-Earth TDRS satellites to NASA Deep Space Network. First crewed spacecraft to use DSN in 50 years.' },
    { metSec:   7560, label:'ICPS SEP',     name:'ICPS separation',                               day:1, crit:'CRITICAL', phase:'orbit',      desc:'ICPS upper stage separates. Orion is now free-flying.', activeWin:600 },
    { metSec:   8100,                       name:'Orion main engine first firing (~15 sec)',       day:1, crit:'HIGH',     phase:'orbit',      desc:'Orion fires its European Service Module main engine for the first time — a 15-second test validating deep space propulsion.', crew:'Wiseman' },
    { metSec:   9000, label:'PROX OPS',     name:'Proximity operations demo begins',              day:1, crit:'HIGH',     phase:'orbit',      desc:'Proximity operations demo \u2014 Orion maneuvers near separated ICPS.', crew:'Wiseman, Glover', activeWin:7200 },
    { metSec:  10800,                       name:'Orion handling qualities test',                 day:1, crit:'HIGH',     phase:'orbit',      desc:'Crew tests how Orion handles in space — manual attitude control and translation maneuvers to characterise the spacecraft.', crew:'Wiseman' },
    { metSec:  13200,                       name:'Prox ops complete, Orion free-flying',           day:1, crit:'MEDIUM',   phase:'orbit',      desc:'Proximity operations demo concludes. Orion has verified its ability to maneuver safely near another object in orbit.', crew:'Wiseman' },
    { metSec:  18120,                       name:'ICPS disposal burn',                             day:1, crit:'MEDIUM',   phase:'orbit',      desc:'Spent ICPS performs a disposal burn (T+5h02m) to move into a safe heliocentric orbit away from Orion.' },
    { metSec:  18300,                       name:'CubeSat deployments (Argentina, S.Korea, Germany, Saudi Arabia)', day:1, crit:'MEDIUM', phase:'orbit', desc:'Small CubeSat satellites from Argentina, South Korea, Germany, and Saudi Arabia deploy from the ICPS.' },
    { metSec:  28800,                       name:'Crew sleep period begins',                       day:1, crit:'ROUTINE',  phase:'orbit',      desc:'Crew begins first sleep period in space. Sleep shifts staggered so one crew member always monitors spacecraft systems.' },
    { metSec:  36000,                       name:'Crew removes launch suits, dons flight clothes', day:1, crit:'ROUTINE',  phase:'orbit',      desc:'Crew removes Orion Crew Survival System suits and changes into comfortable flight clothing for the remainder of the outbound journey.' },

    // ── DAY 2: ORBIT CHECKOUT & TLI ──
    { metSec:  45000,                       name:'Crew wake, systems checkout',                    day:2, crit:'ROUTINE',  phase:'orbit',      desc:'Crew wakes for Day 2. Systems checkout of life support, navigation, and communications before TLI preparations.' },
    { metSec:  50400,                       name:'Potable water system & food prep test',         day:2, crit:'ROUTINE',  phase:'orbit',      desc:'Crew tests the potable water dispenser and rehydrates food packets for the first time. Validates food preparation for the 10-day mission.', crew:'Hansen' },
    { metSec:  57600,                       name:'Exercise device setup & first workouts',         day:2, crit:'ROUTINE',  phase:'orbit',      desc:'Crew assembles exercise device and conducts first workouts. Exercise is critical to counter microgravity bone/muscle loss.', crew:'All crew' },
    { metSec:  72000,                       name:'Koch preps TLI burn procedures',                 day:2, crit:'HIGH',     phase:'orbit',      desc:'Koch configures Orion systems for the critical Trans-Lunar Injection burn — the last major engine firing of the mission.', crew:'Koch' },
    { metSec:  90000, label:'TLI BURN',     name:'Trans-Lunar Injection burn (ESM main engine)',   day:2, crit:'CRITICAL', phase:'translunar', desc:'European Service Module main engine fires to send Orion on a free-return trajectory to the Moon.', crew:'Koch', activeWin:3600 },
    { metSec:  91200,                       name:'TLI burn complete, on course for Moon',          day:2, crit:'CRITICAL', phase:'translunar', desc:'TLI burn complete. Orion is on a free-return trajectory — Earth gravity will bring it home after the lunar flyby.' },
    { metSec:  93600,                       name:'Post-TLI systems checkout',                      day:2, crit:'HIGH',     phase:'translunar', desc:'Post-TLI systems checkout confirms spacecraft health after the 5-minute-49-second engine burn.' },
    { metSec:  97200,                       name:'First crew video downlink from deep space',      day:2, crit:'MEDIUM',   phase:'translunar', desc:'Crew conducts first live video communication with Earth from beyond low Earth orbit — the first such broadcast in over 50 years.' },

    // ── DAY 3: OUTBOUND COAST ──
    { metSec: 172800,                       name:'Flight Day 3 begins',                            day:3, crit:'ROUTINE',  phase:'translunar', desc:'Flight Day 3 begins. Crew enters outbound coast phase, heading toward the Moon at ~3,500 km/h.' },
    { metSec: 173220, label:'OTC-1',        name:'OTC-1 — Outbound Trajectory Correction burn 1', day:3, crit:'HIGH',     phase:'translunar', desc:'Outbound Trajectory Correction burn 1 (T+2/00:07) \u2014 first of three burns to fine-tune the free-return trajectory to the Moon.', crew:'Hansen', activeWin:900 },
    { metSec: 198000,                       name:'CPR procedures demo in microgravity',            day:3, crit:'ROUTINE',  phase:'translunar', desc:'Glover, Koch, and Hansen demonstrate CPR procedures in microgravity — validating emergency medical capability for deep space.', crew:'Glover, Koch, Hansen' },
    { metSec: 208800,                       name:'Medical kit checkout (thermometer, BP, stethoscope)', day:3, crit:'ROUTINE', phase:'translunar', desc:'Wiseman and Glover check out Orion medical kit: thermometer, blood pressure monitor, stethoscope, and otoscope.', crew:'Wiseman, Glover' },
    { metSec: 216000,                       name:'Deep Space Network emergency comms test',        day:3, crit:'HIGH',     phase:'translunar', desc:'Koch tests Orion emergency comms on the Deep Space Network, verifying backup comms capability from 200,000+ km.', crew:'Koch' },

    // ── DAY 4: OUTBOUND COAST ──
    { metSec: 259200,                       name:'Flight Day 4 begins',                            day:4, crit:'ROUTINE',  phase:'translunar', desc:'Flight Day 4 begins. Orion is over 200,000 km from Earth, approaching the halfway point to the Moon.' },
    { metSec: 259920, label:'OTC-2',        name:'OTC-2 — Outbound Trajectory Correction burn 2', day:4, crit:'HIGH',     phase:'translunar', desc:'Outbound Trajectory Correction burn 2 (T+3/00:12) \u2014 second course correction toward the Moon.', crew:'Hansen', activeWin:900 },
    { metSec: 280800,                       name:'Celestial body photography session',             day:4, crit:'ROUTINE',  phase:'translunar', desc:'Crew photographs celestial bodies from Orion windows — documenting Earth, Moon, and stars from deep space.' },
    { metSec: 288000, label:'O2O LASER',    name:'O2O laser comms test (4K video at 260 Mbps)',    day:4, crit:'HIGH',     phase:'translunar', desc:'Optical to Orion laser comms test \u2014 4K video downlink via laser from deep space.', crew:'Koch', activeWin:7200 },
    { metSec: 302400,                       name:'Life support validation continues',              day:4, crit:'MEDIUM',   phase:'translunar', desc:'Continued life support validation — monitoring CO2 scrubbing, water recycling, and cabin atmosphere over multiple days.' },

    // ── DAY 5: LUNAR APPROACH ──
    { metSec: 345600,                       name:'Flight Day 5 begins',                            day:5, crit:'ROUTINE',  phase:'lunar',      desc:'Flight Day 5 begins. Orion approaches the lunar sphere of influence where Moon gravity begins to dominate.' },
    { metSec: 364980, label:'OTC-3',        name:'OTC-3 — Outbound Trajectory Correction burn 3', day:5, crit:'HIGH',     phase:'lunar',      desc:'Outbound Trajectory Correction burn 3 (T+4/05:23) \u2014 final precision burn before lunar sphere of influence entry. Pre-OTC3 trajectory was released by NASA/JSC/FOD/FDO.', crew:'Hansen', activeWin:900 },
    { metSec: 370740, label:'LUNAR SOI',    name:'Enter lunar sphere of influence',                day:5, crit:'HIGH',     phase:'lunar',      desc:'Orion enters the Moon\u2019s gravitational sphere of influence (T+4/06:59). Moon gravity now dominates over Earth gravity. Closest approach to the lunar surface is approximately 21 hours away.', activeWin:7200 },
    { metSec: 374400,                       name:'Spacesuit pressure test & emergency drill',      day:5, crit:'HIGH',     phase:'lunar',      desc:'First in-space test of Orion Crew Survival System suits: pressurization, mobility, eating through helmet ports, emergency seat ingress.', crew:'All crew' },
    { metSec: 421320, label:'APOLLO13 DIST',name:'Surpasses Apollo 13 distance record',           day:5, crit:'MEDIUM',   phase:'lunar',      desc:'Artemis II surpasses the Apollo 13 maximum distance record from Earth (T+4/21:02) — the farthest any humans have ever travelled from Earth at this point in the mission.', activeWin:3600 },

    // ── DAY 6: LUNAR FLYBY ──
    { metSec: 432000,                       name:'Flight Day 6 begins',                            day:6, crit:'ROUTINE',  phase:'lunar',      desc:'Flight Day 6 — lunar flyby day. The crew prepares for closest approach to the Moon.' },
    { metSec: 432600, label:'FAR SIDE LOS', name:'Loss of Signal \u2014 far side pass (~40 min)',  day:6, crit:'CRITICAL', phase:'lunar',      desc:'Orion passes behind the Moon. ~40 minutes of planned communications blackout as the spacecraft enters the lunar far side.', activeWin:3600 },
    { metSec: 434079, label:'CLOSEST APPROACH', name:'Closest approach: ~6,567 km from lunar surface', day:6, crit:'CRITICAL', phase:'lunar', desc:'Orion reaches perilune — closest point to the Moon at approximately 6,567 km above the lunar surface (8,304 km from lunar centre). Confirmed by OEM trajectory data from NASA/JSC/FOD/FDO. The Moon fills the windows.', activeWin:3600 },
    { metSec: 434600,                       name:'Lunar eclipse observation (Moon occults Sun)',   day:6, crit:'MEDIUM',   phase:'lunar',      desc:'The crew observes a solar eclipse from behind the Moon — a unique vantage point allowing study of the Sun\'s corona. First time humans witness this from lunar vicinity since Apollo.' },
    { metSec: 437160, label:'MAX DISTANCE', name:'Maximum distance from Earth \u2014 far point of mission', day:6, crit:'HIGH', phase:'lunar', desc:'Artemis II reaches its maximum distance from Earth (T+5/01:26). At this point Orion is deeper into space than any crewed spacecraft in history, beyond even the Apollo lunar orbit missions.', activeWin:3600 },
    { metSec: 437700, label:'SIGNAL ACQ',   name:'Acquisition of Signal \u2014 comms restored',    day:6, crit:'CRITICAL', phase:'lunar',      desc:'Signal reacquired after far-side pass. Crew reports status to Mission Control.', activeWin:1800 },
    { metSec: 439200,                       name:'Earthrise photography session',                  day:6, crit:'MEDIUM',   phase:'lunar',      desc:'Crew photographs Earthrise over the lunar limb — Earth appears as a blue marble ~400,000 km away.', crew:'All crew' },
    { metSec: 453600,                       name:'Lunar far side observations',                    day:6, crit:'HIGH',     phase:'lunar',      desc:'Crew conducts observations of the lunar far side — craters, geology, and terrain never visible from Earth. National Geographic documentation.', crew:'All crew' },
    { metSec: 503220, label:'LUNAR SOI EXIT',name:'Exit lunar sphere of influence',               day:6, crit:'HIGH',     phase:'return',     desc:'Orion exits the Moon\u2019s gravitational sphere of influence (T+5/19:47). Earth gravity once again dominates. The free-return trajectory carries the crew home.', activeWin:3600 },

    // ── DAYS 7-9: RETURN COAST ──
    { metSec: 518400,                       name:'Flight Day 7',                                   day:7, crit:'ROUTINE',  phase:'return',     desc:'Flight Day 7. Return coast begins. Orion is heading home on its free-return trajectory, pulled by Earth gravity.' },
    { metSec: 534180, label:'RTC-1',        name:'RTC-1 — Return Trajectory Correction burn 1',   day:7, crit:'HIGH',     phase:'return',     desc:'Return Trajectory Correction burn 1 (T+6/04:23) \u2014 first of three burns targeting the Pacific Ocean splashdown zone off the coast of San Diego.', crew:'Hansen', activeWin:900 },
    { metSec: 604800,                       name:'Flight Day 8 \u2014 crew downlink / live broadcast', day:7, crit:'ROUTINE', phase:'return', desc:'Flight Day 8. Crew conducts live video broadcast from deep space, sharing the experience with audiences on Earth.' },
    { metSec: 667800, label:'FCS CHECKOUT', name:'Flight Control System checkouts',               day:7, crit:'HIGH',     phase:'return',     desc:'Flight Control System checkouts (T+7/17:30) \u2014 verifying Orion\u2019s attitude control and flight systems ahead of atmospheric entry. Critical pre-entry validation.', activeWin:3600 },
    { metSec: 691200,                       name:'Flight Day 9 \u2014 re-entry procedures review', day:7, crit:'HIGH',     phase:'return',     desc:'Flight Day 9. Crew reviews re-entry procedures, practises checklist callouts, and configures Orion for atmospheric entry.' },
    { metSec: 707580, label:'RTC-2',        name:'RTC-2 — Return Trajectory Correction burn 2',   day:7, crit:'HIGH',     phase:'return',     desc:'Return Trajectory Correction burn 2 (T+8/04:33) \u2014 second of three burns fine-tuning the entry corridor angle for precise splashdown targeting.', crew:'Hansen', activeWin:900 },
    { metSec: 762000,                       name:'Stow loose items & cabin reconfig for entry',   day:7, crit:'HIGH',     phase:'return',     desc:'Crew secures all loose equipment and reconfigures Orion cabin from habitation mode to entry mode. Seats repositioned for re-entry loads.' },
    { metSec: 765180, label:'RTC-3',        name:'RTC-3 — Return Trajectory Correction burn 3',   day:7, crit:'HIGH',     phase:'return',     desc:'Return Trajectory Correction burn 3 (T+8/20:33) \u2014 final trajectory correction. Last chance to adjust the entry corridor before committing to atmospheric re-entry.', crew:'Hansen', activeWin:900 },
    { metSec: 778800,                       name:'Suit up for re-entry',                           day:7, crit:'HIGH',     phase:'return',     desc:'Crew dons Orion Crew Survival System suits for re-entry. Final cabin stowage and seat configuration check.' },

    // ── DAY 10: ENTRY & SPLASHDOWN (per NASA final timeline: CM/SM Sep T+9/01:13, EI T+9/01:33, Splashdown T+9/01:46+descent) ──
    { metSec: 779400,                       name:'Flight Day 10 begins',                           day:10, crit:'HIGH',    phase:'return',     desc:'Flight Day 10 — final day. Service module separation and atmospheric re-entry are hours away.' },
    { metSec: 781980, label:'SM SEP',       name:'European Service Module separation',             day:10, crit:'CRITICAL', phase:'return',    desc:'Service module separates (T+9/01:13). Only the crew module continues to re-entry. The European Service Module will burn up in the atmosphere.', crew:'All crew', activeWin:600 },
    { metSec: 783180, label:'ENTRY',        name:'Entry interface \u2014 ~40,000 km/h',           day:10, crit:'CRITICAL', phase:'return',    desc:'Atmospheric entry interface at approximately 122 km altitude (T+9/01:33). Orion is travelling at ~40,000 km/h. The heat shield begins absorbing 2,800\u00b0C of re-entry heating. First crewed skip re-entry in history.', activeWin:1800 },
    { metSec: 783480, label:'PEAK HEATING', name:'Peak heating \u2014 2,800\u00b0C on heat shield', day:10, crit:'CRITICAL', phase:'return',  desc:'Peak aerothermal heating \u2014 heat shield surface reaches 2,800\u00b0C. The crew experiences up to 4G deceleration. Skip re-entry trajectory reduces peak G-loads compared to direct entry.', activeWin:600 },
    { metSec: 783600,                       name:'Communications blackout during re-entry',        day:10, crit:'CRITICAL', phase:'return',    desc:'Orion enters communications blackout as ionised plasma surrounds the capsule during peak re-entry heating. Mission Control waits in silence.' },
    { metSec: 783720,                       name:'Blackout ends \u2014 signal reacquired',         day:10, crit:'HIGH',     phase:'return',    desc:'Ionised plasma dissipates. Mission control reacquires telemetry from Orion. Crew confirms status.' },
    { metSec: 783780,                       name:'Drogue chutes deploy',                           day:10, crit:'CRITICAL', phase:'return',    desc:'Two drogue chutes deploy to stabilise the capsule and slow it from supersonic speed.' },
    { metSec: 783840, label:'CHUTES',       name:'Main chutes deploy',                             day:10, crit:'CRITICAL', phase:'return',    desc:'Three main parachutes deploy, slowing Orion from ~350 km/h to ~30 km/h for water impact.', activeWin:600 },
    { metSec: 783960, label:'SPLASHDOWN',   name:'Splashdown \u2014 Pacific Ocean',               day:10, crit:'CRITICAL', phase:'return',    desc:'Orion splashes down in the Pacific Ocean (T+9/01:46). Recovery by USS San Diego. End of the Artemis II mission — humanity\u2019s first crewed return to the Moon vicinity in over 50 years.', crew:'All crew', activeWin:600 },
    { metSec: 785400,                       name:'Recovery team reaches Orion',                    day:10, crit:'MEDIUM',   phase:'return',    desc:'USS San Diego recovery team reaches Orion. Divers attach flotation collar; crew remains inside until secured on ship.' },
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
