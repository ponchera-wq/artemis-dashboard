// clock.js — MET clock, phase indicator, signal pill
(function() {
// ── CONFIG ──────────────────────────────────────────────────────────
const PHASES = [
  { name: 'LAUNCH',         label: 'LAUNCH',    startMin:  0,              endMin:  12 },
  { name: 'EARTH ORBIT',    label: 'ORBIT',     startMin:  12,             endMin:  25 * 60 },
  { name: 'TLI BURN',       label: 'TLI',       startMin:  25 * 60,        endMin:  25 * 60 + 30 },
  { name: 'OUTBOUND COAST', label: 'OUTBOUND',  startMin:  25 * 60 + 30,   endMin:  4 * 24 * 60 },
  { name: 'LUNAR FLYBY',    label: 'LUNAR FLY', startMin:  4 * 24 * 60,    endMin:  5 * 24 * 60 },
  /* Phase boundaries in minutes from launch; splash MET 783960 s ≈ 13066 min (2026-04-11T00:21Z) */
  { name: 'RETURN COAST',   label: 'RETURN',    startMin:  5 * 24 * 60,    endMin:  13050 },
  { name: 'ENTRY',          label: 'ENTRY',     startMin:  13050,           endMin:  13066 },
  { name: 'SPLASHDOWN',     label: 'SPLASHDOWN',startMin:  13066,           endMin:  Infinity },
];

// ── MET CLOCK ───────────────────────────────────────────────────────
function formatMET(ms) {
  if (ms < 0) {
    const abs = Math.abs(ms);
    const s = Math.floor(abs / 1000) % 60;
    const m = Math.floor(abs / 60000) % 60;
    const h = Math.floor(abs / 3600000) % 24;
    const d = Math.floor(abs / 86400000);
    return `T-${String(d).padStart(3,'0')} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const d = Math.floor(ms / 86400000);
  return `D+${String(d).padStart(3,'0')} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function getCurrentPhaseIndex(elapsedMin) {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (elapsedMin >= PHASES[i].startMin) return i;
  }
  return 0;
}

const metDisplay      = document.getElementById('met-display');
const utcDisplay      = document.getElementById('utc-display');
const flightDayDisplay = document.getElementById('flight-day-display');
const currentPhaseEl  = document.getElementById('current-phase-name');

// Build phase bar once
const phaseBar = document.getElementById('phase-bar');
if (phaseBar) {
  PHASES.forEach((p, i) => {
    const node = document.createElement('div');
    node.className = 'phase-node';
    node.id = `phase-node-${i}`;
    node.innerHTML = `<div class="phase-pip"></div><div class="phase-node-label">${p.label}</div>`;
    phaseBar.appendChild(node);
  });
}

let lastPhaseIdx = -1;

function tick() {
  const elapsed    = window.getScrubMetMs();
  const now        = new Date(LAUNCH_UTC.getTime() + elapsed);
  const elapsedMin = elapsed / 60000;

  // MET
  if (metDisplay) metDisplay.textContent = formatMET(elapsed);

  // Flight Day label (D+002 = Flight Day 3; FD = elapsed days + 1)
  if (flightDayDisplay) {
    if (elapsed >= 0) {
      var fd = Math.floor(elapsed / 86400000) + 1;
      flightDayDisplay.textContent = 'FLIGHT DAY ' + fd;
    } else {
      flightDayDisplay.textContent = 'PRE-LAUNCH';
    }
  }

  // UTC
  if (utcDisplay) utcDisplay.textContent = 'UTC ' + now.toUTCString().slice(17, 25);

  // Local clock
  const ltDisp = document.getElementById('local-time-display');
  if (ltDisp) ltDisp.textContent = fmtLocal(now, false) + ' ' + tzAbbr(now);

  // Phase
  const phaseIdx = getCurrentPhaseIndex(elapsedMin);
  if (phaseIdx !== lastPhaseIdx) {
    lastPhaseIdx = phaseIdx;
    if (currentPhaseEl) currentPhaseEl.textContent = PHASES[phaseIdx].name;
    PHASES.forEach((_, i) => {
      const node = document.getElementById(`phase-node-${i}`);
      if (!node) return;
      node.classList.remove('active', 'done');
      if (i === phaseIdx) node.classList.add('active');
      else if (i < phaseIdx) node.classList.add('done');
    });

    // Context-aware distance annotations
    const eAnn = document.getElementById('earth-annotation');
    const mAnn = document.getElementById('moon-annotation');
    const pName = PHASES[phaseIdx].name;
    if (eAnn) {
      if (pName === 'LAUNCH' || pName === 'EARTH ORBIT') { eAnn.textContent = '(elliptical orbit \u2014 altitude varies)'; eAnn.style.color = 'var(--text-dim)'; }
      else if (pName === 'TLI BURN' || pName === 'OUTBOUND COAST') { eAnn.textContent = '(departing Earth)'; eAnn.style.color = 'var(--text-dim)'; }
      else if (pName === 'RETURN COAST') { eAnn.textContent = '(approaching Earth \u2014 closing)'; eAnn.style.color = 'var(--green)'; }
      else if (pName === 'ENTRY') { eAnn.textContent = '(re-entry imminent)'; eAnn.style.color = 'var(--red)'; }
      else { eAnn.textContent = ''; }
    }
    if (mAnn) {
      if (pName === 'LAUNCH' || pName === 'EARTH ORBIT') { mAnn.textContent = '(orbiting Earth \u2014 distance varies)'; mAnn.style.color = 'var(--text-dim)'; }
      else if (pName === 'TLI BURN' || pName === 'OUTBOUND COAST') { mAnn.textContent = '(en route to Moon \u2014 closing)'; mAnn.style.color = 'var(--green)'; }
      else if (pName === 'LUNAR FLYBY') { mAnn.textContent = '(closest approach)'; mAnn.style.color = 'var(--amber)'; }
      else if (pName === 'RETURN COAST') { mAnn.textContent = '(returning to Earth \u2014 increasing)'; mAnn.style.color = 'var(--text-dim)'; }
      else if (pName === 'ENTRY' || pName === 'SPLASHDOWN') { mAnn.textContent = ''; }
      else { mAnn.textContent = ''; }
    }
  }
}

window.addEventListener('dashboard-tick', tick);

// ── SIGNAL PILL ──────────────────────────────────────────────────────
let signalAcquired = true;
const signalPill = document.getElementById('signal-pill');
if (signalPill) {
  function applySignalState() {
    if (signalAcquired) {
      signalPill.className = 'acquired';
      signalPill.textContent = '▶ SIGNAL ACQUIRED';
    } else {
      signalPill.className = 'los';
      signalPill.textContent = '⊘ LOS · FAR SIDE';
    }
  }
  applySignalState();
  signalPill.addEventListener('click', () => {
    signalAcquired = !signalAcquired;
    applySignalState();
  });
  signalPill.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      signalAcquired = !signalAcquired;
      applySignalState();
    }
  });
}

})();
