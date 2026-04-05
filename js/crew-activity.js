/* ============================================================
 *  js/crew-activity.js — Crew Activity Timeline Data
 *  Source: NASA Artemis II Overview Timeline (STRIVES #20260002249)
 *  PDF date: 3/18/2026, approved for public release
 *
 *  Each entry: { startMet, endMet, category, emoji, label, detail, fd }
 *  MET in seconds from LAUNCH_UTC (2026-04-01T22:35:12Z)
 *
 *  Categories: sleep, meal, exercise, pao, science, nav, burn,
 *              camera, medical, config, lunar, comms, offduty, entry
 * ============================================================ */

const CREW_ACTIVITY_CATEGORIES = {
  sleep:    { emoji: '😴', color: '#4a5568', name: 'Sleep' },
  meal:     { emoji: '🍽️', color: '#d69e2e', name: 'Meal' },
  exercise: { emoji: '🏋️', color: '#38a169', name: 'Exercise' },
  pao:      { emoji: '🎥', color: '#e53e3e', name: 'PAO / Broadcast' },
  science:  { emoji: '🔬', color: '#805ad5', name: 'Science / DFTO' },
  nav:      { emoji: '🧭', color: '#3182ce', name: 'Navigation' },
  burn:     { emoji: '🔥', color: '#dd6b20', name: 'Burn / Manoeuvre' },
  camera:   { emoji: '📷', color: '#718096', name: 'Camera Ops' },
  medical:  { emoji: '🩺', color: '#e53e3e', name: 'Medical' },
  config:   { emoji: '🛠️', color: '#a0aec0', name: 'Config / Stow' },
  lunar:    { emoji: '🌙', color: '#ecc94b', name: 'Lunar Observation' },
  comms:    { emoji: '📡', color: '#00b5d8', name: 'Comms' },
  offduty:  { emoji: '☕', color: '#68d391', name: 'Off Duty' },
  entry:    { emoji: '🔥', color: '#f56565', name: 'Entry / Landing' },
};

// Helper: convert "DD/HH:MM:SS" or "DD/HH:MM" to MET seconds
// e.g. met("0/01:47") => 6420, met("01/01:08:42") => 90522
function _met(s) {
  const parts = s.split('/');
  const day = parseInt(parts[0], 10);
  const time = parts[1].split(':');
  const h = parseInt(time[0], 10);
  const m = parseInt(time[1], 10);
  const sec = time[2] ? parseInt(time[2], 10) : 0;
  return day * 86400 + h * 3600 + m * 60 + sec;
}

// Duration helpers
const hrs = (n) => n * 3600;
const mins = (n) => n * 60;

const CREW_ACTIVITIES = [

  // ========== FD01 — Launch Day ==========
  // Pre-launch sleep ends ~T-30min, crew is suited & strapped in
  { startMet: -hrs(8.5), endMet: -hrs(0.5), category: 'sleep',    label: 'Pre-launch Sleep',          detail: '8.5 hrs crew rest before launch', fd: 1 },
  { startMet: 0,         endMet: mins(2),    category: 'burn',     label: 'Liftoff & Ascent',          detail: 'SLS launch from KSC Pad 39B', fd: 1 },
  { startMet: mins(2),   endMet: mins(8.5),  category: 'burn',     label: 'Powered Flight / MECO',     detail: 'Core stage burn, SRB sep, MECO', fd: 1 },
  { startMet: mins(30),  endMet: mins(45),   category: 'science',  label: 'Start Cabin Depress DFTO',  detail: 'DFTO 3,2 — cabin depressurization test', fd: 1 },
  { startMet: mins(50),  endMet: mins(55),   category: 'config',   label: 'ICPS PRM',                  detail: 'Perigee Raise Manoeuvre', fd: 1 },
  { startMet: _met("0/01:47"), endMet: _met("0/01:47") + mins(10), category: 'burn', label: 'ARB TIG', detail: 'Abort Region Burn — targeted ignition', fd: 1 },
  { startMet: _met("0/03:23"), endMet: _met("0/03:23") + mins(5),  category: 'config', label: 'Orion/ICPS Separation', detail: 'Orion separates from Interim Cryogenic Propulsion Stage', fd: 1 },
  { startMet: _met("0/04:51"), endMet: _met("0/04:51") + mins(15), category: 'config', label: 'Orion USS', detail: 'Orion Umbilical Separation System', fd: 1 },
  { startMet: _met("0/05:02"), endMet: _met("0/05:02") + mins(5),  category: 'burn', label: 'ICPS Disposal Burn', detail: 'ICPS disposal manoeuvre after separation', fd: 1 },
  { startMet: _met("0/05:27"), endMet: _met("0/05:27") + mins(10), category: 'config', label: 'Solar Array Deploy', detail: 'SPL (Solar Panel) deployment', fd: 1 },
  { startMet: hrs(6),    endMet: hrs(7),     category: 'meal',     label: 'Meal',                      detail: 'First meal in orbit', fd: 1 },
  { startMet: hrs(7),    endMet: hrs(8),     category: 'config',   label: 'Doff OCSS / Cabin Config',  detail: 'Remove launch suits, configure cabin for orbit ops', fd: 1 },
  { startMet: hrs(8),    endMet: hrs(8.5),   category: 'pao',      label: 'PAO Event',                 detail: 'Public Affairs broadcast — prox ops demo', fd: 1 },
  { startMet: _met("0/10:06"), endMet: _met("0/10:06") + mins(30), category: 'comms', label: 'OpComm Initial Activation', detail: 'Operational communications initial activation', fd: 1 },
  { startMet: hrs(11),   endMet: hrs(12),    category: 'nav',      label: 'Bias-XSI / Nav',            detail: 'Star tracker bias calibration', fd: 1 },
  { startMet: _met("0/13:30"), endMet: _met("0/13:30") + mins(30), category: 'burn', label: 'Orion PRB', detail: 'Perigee Raise Burn', fd: 1 },
  { startMet: _met("0/14:15"), endMet: _met("0/14:15") + mins(30), category: 'nav', label: 'OpNav Checkout', detail: 'Optical navigation camera checkout', fd: 1 },
  { startMet: hrs(16),   endMet: hrs(20),    category: 'sleep',    label: 'Sleep',                     detail: '4 hours post-launch sleep', fd: 1 },

  // ========== FD02 — TLI Day ==========
  { startMet: hrs(20),   endMet: hrs(21),    category: 'meal',     label: 'Meal / Post-Sleep',         detail: 'Post-sleep meal and hygiene', fd: 2 },
  { startMet: hrs(21),   endMet: hrs(22),    category: 'medical',  label: 'Pulse Ox',                  detail: 'Pulse oximetry health check', fd: 2 },
  { startMet: hrs(22),   endMet: hrs(23),    category: 'nav',      label: 'Attitude / Nav',            detail: 'Attitude determination, nav updates', fd: 2 },
  { startMet: hrs(23),   endMet: hrs(24),    category: 'pao',      label: 'NatGeo Setup',              detail: 'National Geographic documentary setup', fd: 2 },
  { startMet: hrs(24),   endMet: _met("01/01:08:42"), category: 'config', label: 'TLI Prep',           detail: 'Trans-Lunar Injection burn prep & conference', fd: 2 },
  { startMet: _met("01/01:08:42"), endMet: _met("01/01:08:42") + mins(20), category: 'burn', label: '🚀 TLI Burn', detail: 'Trans-Lunar Injection — Orion leaves Earth orbit for the Moon', fd: 2 },
  { startMet: _met("01/01:08:42") + mins(20), endMet: _met("01/01:08:42") + hrs(1), category: 'nav', label: 'Post-TLI Nav',  detail: 'Post-TLI navigation and attitude checks', fd: 2 },
  { startMet: hrs(27),   endMet: hrs(28),    category: 'pao',      label: 'PAO Event',                 detail: 'Public Affairs broadcast — post-TLI', fd: 2 },
  { startMet: hrs(28),   endMet: hrs(29),    category: 'comms',    label: 'OpCom ANU',                 detail: 'Operational comms antenna update', fd: 2 },
  { startMet: hrs(29),   endMet: hrs(30),    category: 'exercise', label: 'Exercise Test',             detail: 'M-42 EXT exercise protocol', fd: 2 },
  { startMet: hrs(30),   endMet: hrs(31),    category: 'science',  label: 'Window Inspect',            detail: 'Window inspection procedure', fd: 2 },
  { startMet: hrs(31),   endMet: hrs(32),    category: 'pao',      label: 'PAO / PMC',                 detail: 'Private medical conference & PAO', fd: 2 },
  { startMet: hrs(32),   endMet: hrs(40.5),  category: 'sleep',    label: 'Sleep',                     detail: '8.5 hrs crew rest — trans-lunar coast', fd: 2 },

  // ========== FD03 — Trans-Lunar Coast ==========
  { startMet: hrs(40.5), endMet: hrs(41.5),  category: 'meal',     label: 'Post-Sleep / Meal',         detail: 'Morning routine and meal', fd: 3 },
  { startMet: hrs(41.5), endMet: hrs(42),    category: 'medical',  label: 'Pulse Ox',                  detail: 'Pulse oximetry check', fd: 3 },
  { startMet: hrs(42),   endMet: hrs(43),    category: 'nav',      label: 'OpNav / Attitude',          detail: 'Optical navigation and attitude ops', fd: 3 },
  { startMet: hrs(43),   endMet: hrs(44),    category: 'comms',    label: 'OpCom ANU Demo',            detail: 'Operational comms demonstration', fd: 3 },
  { startMet: hrs(44),   endMet: hrs(45),    category: 'camera',   label: 'Dock Cam Bracket Install',  detail: 'Docking camera bracket installation', fd: 3 },
  { startMet: hrs(45),   endMet: hrs(46),    category: 'science',  label: 'DFTO — HERA Command',       detail: 'DFTO-EM2-09 — HERA command demo', fd: 3 },
  { startMet: hrs(46),   endMet: hrs(47),    category: 'science',  label: 'DFTO — EMER Comm',          detail: 'DFTO-EM2-22 — Emergency comms test', fd: 3 },
  { startMet: hrs(47),   endMet: hrs(48),    category: 'science',  label: 'SAT Mode Test',             detail: 'DFTO-EM2-23 — Satellite mode test', fd: 3 },
  { startMet: _met("02/01:08:42"), endMet: _met("02/01:08:42") + mins(10), category: 'burn', label: 'OTC-1 Burn', detail: 'Outbound Trajectory Correction burn #1', fd: 3 },
  { startMet: hrs(49),   endMet: hrs(50),    category: 'camera',   label: 'Dock Cam Misalign DFTO',    detail: 'DFTO-EM2-03 — Dock cam misalignment test', fd: 3 },
  { startMet: hrs(50),   endMet: hrs(51),    category: 'pao',      label: 'PAO / PMC',                 detail: 'Public affairs & private medical conf', fd: 3 },
  { startMet: hrs(51),   endMet: hrs(52),    category: 'comms',    label: 'DSN / Emer Comm',           detail: 'Deep Space Network / emergency comms', fd: 3 },
  { startMet: hrs(52),   endMet: hrs(53),    category: 'science',  label: 'CPR Demo',                  detail: 'CPR demonstration in microgravity', fd: 3 },
  { startMet: hrs(53),   endMet: hrs(54),    category: 'meal',     label: 'Meal',                      detail: 'Crew meal', fd: 3 },
  { startMet: hrs(54),   endMet: hrs(55),    category: 'pao',      label: 'CSA PAO',                   detail: 'Canadian Space Agency public affairs', fd: 3 },
  { startMet: hrs(55),   endMet: hrs(56.5),  category: 'offduty',  label: 'Off Duty / PMC',            detail: 'Off-duty time and planning', fd: 3 },
  { startMet: hrs(56.5), endMet: hrs(65),    category: 'sleep',    label: 'Sleep',                     detail: '8.5 hrs crew rest', fd: 3 },

  // ========== FD04 — Trans-Lunar Coast ==========
  { startMet: hrs(65),   endMet: hrs(66),    category: 'meal',     label: 'Post-Sleep / Meal',         detail: 'Morning routine', fd: 4 },
  { startMet: hrs(66),   endMet: hrs(66.5),  category: 'medical',  label: 'Pulse Ox',                  detail: 'Pulse oximetry', fd: 4 },
  { startMet: hrs(66.5), endMet: hrs(67.5),  category: 'nav',      label: 'OpNav / Attitude',          detail: 'Optical navigation', fd: 4 },
  { startMet: hrs(67.5), endMet: hrs(68.5),  category: 'comms',    label: 'OpCom ANU',                 detail: 'Comms antenna update', fd: 4 },
  { startMet: hrs(68.5), endMet: hrs(69),    category: 'science',  label: 'Acoustic DFTO Start',       detail: 'DFTO-EM2-7 — 24hr acoustic measurement begins', fd: 4 },
  { startMet: hrs(69),   endMet: hrs(70),    category: 'pao',      label: 'NatGeo / PWD',              detail: 'NatGeo filming, potable water dispenser ops', fd: 4 },
  { startMet: hrs(70),   endMet: hrs(71),    category: 'science',  label: 'Cognitive DFTO',            detail: 'COGN — Cognitive performance assessment', fd: 4 },
  { startMet: _met("03/01:08:42"), endMet: _met("03/01:08:42") + mins(10), category: 'burn', label: 'OTC-2 Burn', detail: 'Outbound Trajectory Correction burn #2', fd: 4 },
  { startMet: hrs(73),   endMet: hrs(74),    category: 'science',  label: 'Min ECLSS DFTO',            detail: 'DFTO-EM2-16 — Minimum ECLSS operations', fd: 4 },
  { startMet: hrs(74),   endMet: hrs(75),    category: 'comms',    label: 'OpCom Class 1 CFDP',        detail: 'Class 1 CFDP communications demo', fd: 4 },
  { startMet: hrs(75),   endMet: hrs(76),    category: 'camera',   label: 'Dock Cam Stray Light',      detail: 'DFTO-EM2-04 — Stray light characterization', fd: 4 },
  { startMet: hrs(76),   endMet: hrs(77),    category: 'exercise', label: 'Exercise',                  detail: 'Crew exercise period', fd: 4 },
  { startMet: hrs(77),   endMet: hrs(78),    category: 'meal',     label: 'Meal',                      detail: 'Crew meal', fd: 4 },
  { startMet: hrs(78),   endMet: hrs(79),    category: 'pao',      label: 'PAO / PMC',                 detail: 'Public affairs, private medical conf', fd: 4 },
  { startMet: _met("03/07:00"), endMet: _met("03/07:00") + mins(30), category: 'nav', label: 'NAV FTO EM2-223', detail: 'Navigation flight test objective', fd: 4 },
  { startMet: hrs(80),   endMet: hrs(88.5),  category: 'sleep',    label: 'Sleep',                     detail: '8.5 hrs crew rest', fd: 4 },

  // ========== FD05 — Trans-Lunar / Approaching Lunar SOI ==========
  { startMet: hrs(88.5), endMet: hrs(89.5),  category: 'meal',     label: 'Post-Sleep / Meal',         detail: 'Morning routine', fd: 5 },
  { startMet: hrs(89.5), endMet: hrs(90),    category: 'medical',  label: 'Pulse Ox',                  detail: 'Pulse oximetry', fd: 5 },
  { startMet: hrs(90),   endMet: hrs(91),    category: 'nav',      label: 'OpNav / Attitude',          detail: 'Navigation and attitude ops', fd: 5 },
  { startMet: hrs(91),   endMet: hrs(92),    category: 'config',   label: 'Vent to 10.2 psi',          detail: 'Cabin pressure adjustment to 10.2 psi', fd: 5 },
  { startMet: hrs(92),   endMet: hrs(92.5),  category: 'science',  label: 'Acoustic DFTO End',         detail: 'End 24hr acoustic measurement DFTO-7', fd: 5 },
  { startMet: hrs(93),   endMet: hrs(94),    category: 'camera',   label: 'Dock Cam Uninstall',        detail: 'Dock cam and bracket removal', fd: 5 },
  { startMet: hrs(94),   endMet: hrs(95),    category: 'camera',   label: 'Dock Cam Stray Light',      detail: 'DFTO-EM2-04 (M Prime) — Stray light test', fd: 5 },
  { startMet: _met("4/04:29:52"), endMet: _met("4/04:29:52") + mins(10), category: 'burn', label: 'OTC-3 Burn', detail: 'Outbound Trajectory Correction burn #3', fd: 5 },
  { startMet: hrs(97),   endMet: hrs(98),    category: 'comms',    label: 'OpCom ANU Demo',            detail: 'Comms demonstration', fd: 5 },
  { startMet: _met("4/06:38"), endMet: _met("4/06:38") + mins(1), category: 'nav', label: '🌙 Lunar SOI Entry', detail: 'Orion enters the Moon\'s sphere of influence', fd: 5 },
  { startMet: hrs(99),   endMet: hrs(100),   category: 'pao',      label: 'ESA PAO',                   detail: 'European Space Agency public affairs', fd: 5 },
  { startMet: hrs(100),  endMet: hrs(101),   category: 'pao',      label: 'PAO / PMC',                 detail: 'Public affairs, planning', fd: 5 },
  { startMet: hrs(101),  endMet: hrs(102),   category: 'meal',     label: 'Flywheel / Meal',           detail: 'Flywheel day-in-the-life activity, meal', fd: 5 },
  { startMet: hrs(102),  endMet: hrs(103),   category: 'lunar',    label: 'Lunar Imaging Review',      detail: 'Review of lunar observation imagery', fd: 5 },
  { startMet: hrs(103),  endMet: hrs(104),   category: 'offduty',  label: 'Off Duty',                  detail: 'Crew off-duty time', fd: 5 },
  { startMet: hrs(104),  endMet: hrs(113.5), category: 'sleep',    label: 'Sleep',                     detail: '9.5 hrs — shifted 1hr later for lunar flyby prep', fd: 5 },

  // ========== FD06 — LUNAR FLYBY DAY ==========
  { startMet: hrs(113.5),endMet: hrs(114.5), category: 'meal',     label: 'Post-Sleep / Meal',         detail: 'Morning routine — Lunar Flyby Day', fd: 6 },
  { startMet: hrs(114.5),endMet: hrs(115),   category: 'medical',  label: 'Pulse Ox',                  detail: 'Pulse oximetry', fd: 6 },
  { startMet: hrs(115),  endMet: hrs(116),   category: 'config',   label: 'Lunar Config',              detail: 'Configure cabin for close lunar approach', fd: 6 },
  { startMet: hrs(116),  endMet: hrs(117),   category: 'nav',      label: 'Attitude / Nav',            detail: 'Attitude manoeuvre for lunar flyby', fd: 6 },
  { startMet: hrs(117),  endMet: hrs(118),   category: 'lunar',    label: 'Lunar Observation',         detail: 'Crew observing lunar surface — approach', fd: 6 },
  { startMet: hrs(118),  endMet: hrs(119),   category: 'pao',      label: 'NatGeo / PAO',              detail: 'NatGeo filming and PAO for close approach', fd: 6 },
  // Apollo distance record at ~MET 5/00:29:59 ≈ 432,599s ≈ hrs(120.2)
  { startMet: _met("5/00:29:59"), endMet: _met("5/00:29:59") + mins(1), category: 'lunar', label: '🌙 Closest Lunar Approach', detail: 'Perilune — ~6,583 km from Moon surface, closest humans have ever been since Apollo', fd: 6 },
  { startMet: _met("5/00:35"), endMet: _met("5/00:35") + mins(1), category: 'nav', label: '📏 Max Earth Distance', detail: 'Maximum distance from Earth during mission', fd: 6 },
  { startMet: hrs(121),  endMet: hrs(123),   category: 'lunar',    label: 'Lunar Observation',         detail: 'Extended lunar surface observation — far side view', fd: 6 },
  { startMet: hrs(123),  endMet: hrs(124),   category: 'pao',      label: 'SCI Imaging',               detail: 'Science imaging of lunar surface', fd: 6 },
  { startMet: hrs(124),  endMet: hrs(125),   category: 'pao',      label: 'CSA VIP PAO',               detail: 'Canadian Space Agency VIP public affairs event', fd: 6 },
  { startMet: hrs(125),  endMet: hrs(126),   category: 'meal',     label: 'Meal',                      detail: 'Crew meal', fd: 6 },
  { startMet: hrs(126),  endMet: hrs(127),   category: 'lunar',    label: 'Post Lunar Debrief',        detail: 'Post-perilune crew debrief', fd: 6 },
  { startMet: hrs(127),  endMet: hrs(128),   category: 'pao',      label: 'PAO / PMC',                 detail: 'Public affairs event', fd: 6 },
  { startMet: _met("5/18:53"), endMet: _met("5/18:53") + mins(1), category: 'nav', label: 'Lunar SOI Exit', detail: 'Orion exits Moon\'s sphere of influence — trans-Earth coast begins', fd: 6 },
  { startMet: hrs(129),  endMet: hrs(137.5), category: 'sleep',    label: 'Sleep',                     detail: '8.5 hrs — shifting 1hr earlier', fd: 6 },

  // ========== FD07 — Trans-Earth Coast ==========
  { startMet: hrs(137.5),endMet: hrs(138.5), category: 'meal',     label: 'Post-Sleep / Meal',         detail: 'Morning routine', fd: 7 },
  { startMet: hrs(138.5),endMet: hrs(139),   category: 'medical',  label: 'Pulse Ox',                  detail: 'Pulse oximetry', fd: 7 },
  { startMet: hrs(139),  endMet: hrs(140),   category: 'nav',      label: 'OpNav / Attitude',          detail: 'Navigation updates', fd: 7 },
  { startMet: hrs(140),  endMet: hrs(141),   category: 'comms',    label: 'OpCom ANU',                 detail: 'Operational comms update', fd: 7 },
  { startMet: _met("6/01:29:52"), endMet: _met("6/01:29:52") + mins(10), category: 'burn', label: 'RTC-1 Burn', detail: 'Return Trajectory Correction burn #1', fd: 7 },
  { startMet: hrs(142),  endMet: hrs(143),   category: 'camera',   label: 'Dock Cam Bracket Install',  detail: 'Docking camera reinstallation', fd: 7 },
  { startMet: hrs(143),  endMet: hrs(144),   category: 'camera',   label: 'Dock Cam WW Dump',          detail: 'Dock cam data dump FTO', fd: 7 },
  { startMet: hrs(144),  endMet: hrs(145),   category: 'pao',      label: 'SAW PAO',                   detail: 'Solar Array Wing public affairs', fd: 7 },
  { startMet: hrs(145),  endMet: hrs(146),   category: 'exercise', label: 'Exercise',                  detail: 'Crew exercise — P/TV protocol', fd: 7 },
  { startMet: hrs(146),  endMet: hrs(147),   category: 'meal',     label: 'Meal',                      detail: 'Crew meal', fd: 7 },
  { startMet: hrs(147),  endMet: hrs(148),   category: 'pao',      label: 'C2C Call',                   detail: 'Crew-to-crew call', fd: 7 },
  { startMet: hrs(148),  endMet: hrs(149),   category: 'science',  label: 'SCI Imaging',               detail: 'Science imaging', fd: 7 },
  { startMet: hrs(149),  endMet: hrs(150),   category: 'pao',      label: 'PMC / FD Conf',             detail: 'Private medical conf, flight director conf', fd: 7 },
  { startMet: hrs(150),  endMet: hrs(151),   category: 'offduty',  label: 'Off Duty',                  detail: 'Crew off-duty', fd: 7 },
  { startMet: hrs(151),  endMet: hrs(159.5), category: 'sleep',    label: 'Sleep',                     detail: '8.5 hrs — shifting 45 min earlier', fd: 7 },

  // ========== FD08 — Trans-Earth Coast ==========
  { startMet: hrs(159.5),endMet: hrs(160.5), category: 'meal',     label: 'Post-Sleep / Meal',         detail: 'Morning routine', fd: 8 },
  { startMet: hrs(160.5),endMet: hrs(161),   category: 'medical',  label: 'Pulse Ox',                  detail: 'Pulse oximetry', fd: 8 },
  { startMet: hrs(161),  endMet: hrs(162),   category: 'nav',      label: 'Attitude / OpNav',          detail: 'Navigation and attitude updates', fd: 8 },
  { startMet: hrs(162),  endMet: hrs(163),   category: 'comms',    label: 'OpCom ANU',                 detail: 'Comms update', fd: 8 },
  { startMet: hrs(163),  endMet: hrs(164),   category: 'science',  label: 'Rad Shelter Demo',          detail: 'Radiation shelter demonstration', fd: 8 },
  { startMet: hrs(164),  endMet: hrs(165),   category: 'science',  label: 'No PCD DFTO',               detail: 'DFTO-EM2-21 — No PCD test', fd: 8 },
  { startMet: hrs(165),  endMet: hrs(166),   category: 'science',  label: 'Urine Venting DFTO',        detail: 'DFTO-EM2-26 — Urine venting test', fd: 8 },
  { startMet: hrs(166),  endMet: hrs(167),   category: 'science',  label: 'Exercise Acoustic DFTO',    detail: 'DFTO-EM2-06 — Exercise acoustic measurement', fd: 8 },
  { startMet: hrs(167),  endMet: hrs(168),   category: 'science',  label: 'Modal Survey DFTO',         detail: 'DFTO-EM2-27 — Structural modal survey', fd: 8 },
  { startMet: hrs(168),  endMet: hrs(169),   category: 'config',   label: 'Repress to 14.7 psi',       detail: 'Repressurize cabin to nominal 14.7 psi', fd: 8 },
  { startMet: _met("7/17:30"), endMet: _met("7/17:30") + mins(60), category: 'nav', label: 'FCS Checkouts', detail: 'Flight Control System checkouts', fd: 8 },
  { startMet: hrs(170),  endMet: hrs(171),   category: 'exercise', label: 'Exercise',                  detail: 'Crew exercise, CCU P/TV', fd: 8 },
  { startMet: hrs(171),  endMet: hrs(172),   category: 'pao',      label: 'NatGeo / PAO',              detail: 'NatGeo filming, PAO event', fd: 8 },
  { startMet: hrs(172),  endMet: hrs(173),   category: 'meal',     label: 'Meal',                      detail: 'Crew meal', fd: 8 },
  { startMet: hrs(173),  endMet: hrs(174),   category: 'pao',      label: 'PAO / PMC / FD Conf',       detail: 'Public affairs, medical conf, flight dir conf', fd: 8 },
  { startMet: hrs(174),  endMet: hrs(182.5), category: 'sleep',    label: 'Sleep',                     detail: '8.5 hrs crew rest', fd: 8 },

  // ========== FD09 — Pre-Entry ==========
  { startMet: hrs(182.5),endMet: hrs(183.5), category: 'meal',     label: 'Post-Sleep / Meal',         detail: 'Morning routine', fd: 9 },
  { startMet: hrs(183.5),endMet: hrs(184),   category: 'medical',  label: 'Pulse Ox',                  detail: 'Pulse oximetry', fd: 9 },
  { startMet: hrs(184),  endMet: hrs(185),   category: 'nav',      label: 'Attitude / OpNav',          detail: 'Final navigation updates', fd: 9 },
  { startMet: hrs(185),  endMet: hrs(186),   category: 'comms',    label: 'OpCom ANU',                 detail: 'Comms update', fd: 9 },
  { startMet: _met("8/04:29:10"), endMet: _met("8/04:29:10") + mins(10), category: 'burn', label: 'RTC-2 Burn', detail: 'Return Trajectory Correction burn #2', fd: 9 },
  { startMet: hrs(188),  endMet: hrs(189),   category: 'config',   label: 'Entry Study',               detail: 'Entry procedures review', fd: 9 },
  { startMet: hrs(189),  endMet: hrs(190),   category: 'science',  label: 'RHC Questionnaire',         detail: 'Rotational Hand Controller questionnaire', fd: 9 },
  { startMet: hrs(190),  endMet: hrs(191),   category: 'config',   label: 'Entry Stow',                detail: 'Begin stowing cabin for re-entry', fd: 9 },
  { startMet: hrs(191),  endMet: hrs(192),   category: 'nav',      label: 'ONWM S C/O',                detail: 'Onboard Nav & Waste Mgmt checkout', fd: 9 },
  { startMet: hrs(192),  endMet: hrs(193),   category: 'science',  label: 'Man PLT DFTO',              detail: 'Manual piloting DFTO', fd: 9 },
  { startMet: hrs(193),  endMet: hrs(194),   category: 'pao',      label: 'PAO / PMC / FD Conf',       detail: 'Public affairs, conferences', fd: 9 },
  { startMet: hrs(194),  endMet: hrs(202.5), category: 'sleep',    label: 'Sleep',                     detail: '8.5 hrs crew rest — final sleep before entry', fd: 9 },

  // ========== FD10 — Entry & Splashdown ==========
  { startMet: hrs(202.5),endMet: hrs(203.5), category: 'meal',     label: 'Post-Sleep / Meal',         detail: 'Final morning routine', fd: 10 },
  { startMet: hrs(203.5),endMet: hrs(204),   category: 'config',   label: 'OIG Don DFTO',              detail: 'OIG donning DFTO', fd: 10 },
  { startMet: hrs(204),  endMet: hrs(205),   category: 'nav',      label: 'OpNav / Attitude',          detail: 'Final navigation & attitude', fd: 10 },
  { startMet: hrs(205),  endMet: hrs(206),   category: 'comms',    label: 'OpCom ANU',                 detail: 'Final comms update', fd: 10 },
  { startMet: _met("8/20:29:10"), endMet: _met("8/20:29:10") + mins(10), category: 'burn', label: 'RTC-3 Burn', detail: 'Return Trajectory Correction burn #3 — final correction', fd: 10 },
  { startMet: hrs(208),  endMet: hrs(209),   category: 'config',   label: 'Entry Conference',          detail: 'Entry procedures conference with MCC', fd: 10 },
  { startMet: hrs(209),  endMet: hrs(210),   category: 'config',   label: 'Cabin Config for Entry',    detail: 'Final cabin configuration & checklist', fd: 10 },
  { startMet: hrs(210),  endMet: hrs(211),   category: 'config',   label: 'Entry Stow & Suit Up',      detail: 'Final stow, don OCSS flight suits', fd: 10 },
  { startMet: hrs(211),  endMet: hrs(212),   category: 'config',   label: 'Entry Checklist',           detail: 'Entry checklist execution', fd: 10 },
  { startMet: _met("09/01:09"), endMet: _met("09/01:09") + mins(1), category: 'entry', label: '🛸 CM/SM Separation', detail: 'Crew Module separates from Service Module', fd: 10 },
  { startMet: _met("09/01:29"), endMet: _met("09/01:29") + mins(1), category: 'entry', label: '🔥 Entry Interface', detail: 'Atmospheric entry interface — 400,000 ft', fd: 10 },
  { startMet: _met("09/01:29") + mins(1), endMet: _met("09/01:42:48"), category: 'entry', label: 'Re-entry & Descent', detail: 'Hypersonic entry, parachute deploy, descent', fd: 10 },
  { startMet: _met("09/01:42:48"), endMet: _met("09/01:42:48") + mins(1), category: 'entry', label: '🌊 SPLASHDOWN', detail: 'Splashdown in Pacific Ocean — mission complete!', fd: 10 },
];

// Export for use in dashboard
if (typeof window !== 'undefined') {
  window.CREW_ACTIVITIES = CREW_ACTIVITIES;
  window.CREW_ACTIVITY_CATEGORIES = CREW_ACTIVITY_CATEGORIES;
}
