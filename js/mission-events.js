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
    { metSec:  14400,                       name:'ICPS disposal burn',                             day:1, crit:'MEDIUM',   phase:'orbit',      desc:'Spent ICPS performs a disposal burn to move into a safe heliocentric orbit away from Orion.' },
    { metSec:  18000,                       name:'CubeSat deployments (Argentina, S.Korea, Germany, Saudi Arabia)', day:1, crit:'MEDIUM', phase:'orbit', desc:'Small CubeSat satellites from Argentina, South Korea, Germany, and Saudi Arabia deploy from the ICPS.' },
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
    { metSec: 187200, label:'TCB-1',        name:'Outbound trajectory correction burn 1',          day:3, crit:'HIGH',     phase:'translunar', desc:'Outbound trajectory correction burn 1 \u2014 fine-tunes course toward the Moon.', crew:'Hansen', activeWin:900 },
    { metSec: 198000,                       name:'CPR procedures demo in microgravity',            day:3, crit:'ROUTINE',  phase:'translunar', desc:'Glover, Koch, and Hansen demonstrate CPR procedures in microgravity — validating emergency medical capability for deep space.', crew:'Glover, Koch, Hansen' },
    { metSec: 208800,                       name:'Medical kit checkout (thermometer, BP, stethoscope)', day:3, crit:'ROUTINE', phase:'translunar', desc:'Wiseman and Glover check out Orion medical kit: thermometer, blood pressure monitor, stethoscope, and otoscope.', crew:'Wiseman, Glover' },
    { metSec: 216000,                       name:'Deep Space Network emergency comms test',        day:3, crit:'HIGH',     phase:'translunar', desc:'Koch tests Orion emergency comms on the Deep Space Network, verifying backup comms capability from 200,000+ km.', crew:'Koch' },

    // ── DAY 4: OUTBOUND COAST ──
    { metSec: 259200,                       name:'Flight Day 4 begins',                            day:4, crit:'ROUTINE',  phase:'translunar', desc:'Flight Day 4 begins. Orion is over 200,000 km from Earth, approaching the halfway point to the Moon.' },
    { metSec: 280800,                       name:'Celestial body photography session',             day:4, crit:'ROUTINE',  phase:'translunar', desc:'Crew photographs celestial bodies from Orion windows — documenting Earth, Moon, and stars from deep space.' },
    { metSec: 288000, label:'O2O LASER',    name:'O2O laser comms test (4K video at 260 Mbps)',    day:4, crit:'HIGH',     phase:'translunar', desc:'Optical to Orion laser comms test \u2014 4K video downlink via laser from deep space.', crew:'Koch', activeWin:7200 },
    { metSec: 302400,                       name:'Life support validation continues',              day:4, crit:'MEDIUM',   phase:'translunar', desc:'Continued life support validation — monitoring CO2 scrubbing, water recycling, and cabin atmosphere over multiple days.' },

    // ── DAY 5: LUNAR APPROACH ──
    { metSec: 345600,                       name:'Flight Day 5 begins',                            day:5, crit:'ROUTINE',  phase:'lunar',      desc:'Flight Day 5 begins. Orion approaches the lunar sphere of influence where Moon gravity begins to dominate.' },
    { metSec: 360000, label:'LUNAR SOI',    name:'Enter lunar sphere of influence',                day:5, crit:'HIGH',     phase:'lunar',      desc:'Orion enters the Moon\u2019s gravitational sphere of influence.', activeWin:7200 },
    { metSec: 374400,                       name:'Spacesuit pressure test & emergency drill',      day:5, crit:'HIGH',     phase:'lunar',      desc:'First in-space test of Orion Crew Survival System suits: pressurization, mobility, eating through helmet ports, emergency seat ingress.', crew:'All crew' },
    { metSec: 388800,                       name:'Trajectory correction burn 2',                   day:5, crit:'HIGH',     phase:'lunar',      desc:'Final outbound trajectory correction burn fine-tunes the approach angle for lunar flyby on Day 6.' },

    // ── DAY 6: LUNAR FLYBY ──
    { metSec: 432000,                       name:'Flight Day 6 begins',                            day:6, crit:'ROUTINE',  phase:'lunar',      desc:'Flight Day 6 — lunar flyby day. The crew prepares for closest approach to the Moon.' },
    { metSec: 433200, label:'FAR SIDE LOS', name:'Loss of Signal \u2014 far side pass (~40 min)',  day:6, crit:'CRITICAL', phase:'lunar',      desc:'Orion passes behind the Moon. ~40 minutes of planned communications blackout.', activeWin:3600 },
    { metSec: 433500, label:'CLOSEST APPROACH', name:'Closest approach: ~6,500 km from lunar surface', day:6, crit:'CRITICAL', phase:'lunar', desc:'Orion passes ~6,500 km above the lunar far side.', activeWin:3600 },
    { metSec: 434000,                       name:'Lunar eclipse observation (Moon occults Sun)',   day:6, crit:'MEDIUM',   phase:'lunar',      desc:'The crew observes a solar eclipse from behind the Moon — a unique vantage point allowing study of the Sun\'s corona. First time humans witness this from lunar vicinity since Apollo.' },
    { metSec: 435900, label:'SIGNAL ACQ',   name:'Acquisition of Signal \u2014 comms restored',    day:6, crit:'CRITICAL', phase:'lunar',      desc:'Signal reacquired after far-side pass. Crew reports status.', activeWin:1800 },
    { metSec: 438000,                       name:'Earthrise photography session',                  day:6, crit:'MEDIUM',   phase:'lunar',      desc:'Crew photographs Earthrise over the lunar limb — Earth appears as a blue marble ~400,000 km away.', crew:'All crew' },
    { metSec: 445200, label:'DISTANCE RECORD', name:'Apollo 13 distance record broken (400,171 km)', day:6, crit:'HIGH',  phase:'lunar',      desc:'Orion surpasses 400,171 km from Earth — exceeding the record set by Apollo 13 in April 1970. The Artemis II crew become the farthest humans from home in history.', activeWin:3600 },
    { metSec: 453600,                       name:'Lunar far side observations begin',              day:6, crit:'HIGH',     phase:'lunar',      desc:'Crew begins observations of the lunar far side. At closest approach the Moon fills the windows like a basketball at arm\'s length.', crew:'All crew' },

    // ── DAYS 7-9: RETURN COAST ──
    { metSec: 518400,                       name:'Flight Day 7',                                   day:7, crit:'ROUTINE',  phase:'return',     desc:'Flight Day 7. Return coast begins. Orion is heading home on its free-return trajectory, pulled by Earth gravity.' },
    { metSec: 540000, label:'RETURN TCB',   name:'Return trajectory correction burn 1',            day:7, crit:'HIGH',     phase:'return',     desc:'First return trajectory correction burn — targets Pacific Ocean splashdown zone.', crew:'Hansen', activeWin:900 },
    { metSec: 561600,                       name:'Return trajectory correction burn 2',            day:7, crit:'HIGH',     phase:'return',     desc:'Second of three return trajectory correction burns. Fine-tunes the approach to Earth for precise splashdown targeting.' },
    { metSec: 604800,                       name:'Flight Day 8 \u2014 crew downlink / live broadcast', day:7, crit:'ROUTINE', phase:'return', desc:'Flight Day 8. Crew conducts live video broadcast from deep space, sharing the experience with audiences on Earth.' },
    { metSec: 648000,                       name:'Return trajectory correction burn 3',            day:8, crit:'HIGH',     phase:'return',     desc:'Final return trajectory correction burn. Last chance to adjust the entry corridor before committing to re-entry.' },
    { metSec: 691200,                       name:'Flight Day 9 \u2014 re-entry procedures review', day:7, crit:'HIGH',     phase:'return',     desc:'Flight Day 9. Crew reviews re-entry procedures, practises checklist callouts, and configures Orion for atmospheric entry.' },
    { metSec: 734400,                       name:'Stow loose items & cabin reconfig for entry',   day:9, crit:'HIGH',     phase:'return',     desc:'Crew secures all loose equipment and reconfigures Orion cabin from habitation mode to entry mode. Seats repositioned.' },
    { metSec: 756000,                       name:'Suit up for re-entry',                           day:7, crit:'HIGH',     phase:'return',     desc:'Crew dons Orion Crew Survival System suits for re-entry. Final cabin stowage and seat configuration.' },

    // ── DAY 10: ENTRY & SPLASHDOWN ──
    { metSec: 777600,                       name:'Flight Day 10 begins',                           day:10, crit:'HIGH',    phase:'return',     desc:'Flight Day 10 — final day. Service module separation and atmospheric re-entry are hours away.' },
    { metSec: 820800, label:'SM SEP',       name:'European Service Module separation',             day:10, crit:'CRITICAL', phase:'return',    desc:'Service module separates. Only crew module continues to re-entry.', crew:'All crew', activeWin:600 },
    { metSec: 822000,                       name:'Skip re-entry \u2014 first atmospheric skip',    day:10, crit:'CRITICAL', phase:'return',    desc:'Orion performs a guided skip re-entry — dipping into the atmosphere, bouncing back up, then re-entering. Extends landing range and reduces G-forces. First crewed skip re-entry in history.' },
    { metSec: 822600, label:'ENTRY',        name:'Entry interface \u2014 40,000 km/h',            day:10, crit:'CRITICAL', phase:'return',    desc:'Atmospheric entry at 40,000 km/h. Heat shield reaches 2,800\u00b0C during skip re-entry.', activeWin:1800 },
    { metSec: 823200, label:'PEAK HEATING', name:'Peak heating \u2014 2,800\u00b0C on heat shield', day:10, crit:'CRITICAL', phase:'return',  desc:'Peak heating \u2014 heat shield surface reaches 2,800\u00b0C.', activeWin:600 },
    { metSec: 823800,                       name:'Communications blackout during re-entry',        day:10, crit:'CRITICAL', phase:'return',    desc:'Orion enters communications blackout as ionised plasma surrounds the capsule during peak re-entry heating.' },
    { metSec: 824100,                       name:'Blackout ends \u2014 signal reacquired',         day:10, crit:'HIGH',     phase:'return',    desc:'Ionised plasma dissipates enough for radio signals to penetrate. Mission control reacquires telemetry from Orion.' },
    { metSec: 824400,                       name:'Drogue chutes deploy',                           day:10, crit:'CRITICAL', phase:'return',    desc:'Two drogue chutes deploy at ~7,600m altitude to stabilise the capsule and slow it from supersonic speed.' },
    { metSec: 824580, label:'CHUTES',       name:'Main chutes deploy',                             day:10, crit:'CRITICAL', phase:'return',    desc:'Main parachutes deploy at ~7,600m altitude, slowing Orion to ~30 km/h.', activeWin:600 },
    { metSec: 824760, label:'SPLASHDOWN',   name:'Splashdown \u2014 Pacific Ocean',               day:10, crit:'CRITICAL', phase:'return',    desc:'Orion splashes down in the Pacific Ocean. Recovery by USS Portland.', crew:'All crew', activeWin:600 },
    { metSec: 826200,                       name:'Recovery team reaches Orion',                    day:10, crit:'MEDIUM',   phase:'return',    desc:'USS Portland recovery team reaches Orion. Divers attach flotation collar; crew remains inside until secured on ship.' },
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
