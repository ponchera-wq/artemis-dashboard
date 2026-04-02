// weather.js — Space weather gauges + tooltips
(function() {
// ── SPACE WEATHER — NOAA JSON FETCHES (5m) ─────────────────────────

// Kp → G-storm level
function kpToG(kp) {
  if (kp >= 9) return 5;
  if (kp >= 8) return 4;
  if (kp >= 7) return 3;
  if (kp >= 6) return 2;
  if (kp >= 5) return 1;
  return 0;
}

const G_COLORS = ['#00e676','#00e676','#ffd740','#ffa726','#ef5350','#ef5350'];
const G_NAMES  = ['QUIET','MINOR STORM','MODERATE STORM','STRONG STORM','SEVERE STORM','EXTREME STORM'];
const G_RAD    = ['NOMINAL','NOMINAL','ELEVATED','ELEVATED','HIGH','HIGH'];
const KP_ARC   = 366.5; // arc length for 300° sweep, r=70

function updateKpGauge(kp) {
  const g       = kpToG(kp);
  const color   = G_COLORS[g];
  const filled  = Math.min(kp / 9, 1) * KP_ARC;

  const fillEl  = document.getElementById('kp-fill');
  const valEl   = document.getElementById('kp-val');
  const gEl     = document.getElementById('kp-g');
  const radEl   = document.getElementById('rad-label');

  fillEl.setAttribute('stroke', color);
  fillEl.setAttribute('stroke-dasharray', `${filled} ${KP_ARC}`);
  fillEl.style.filter = g >= 2 ? `drop-shadow(0 0 5px ${color})` : 'none';

  valEl.textContent = kp.toFixed(1);
  valEl.setAttribute('fill', color);

  gEl.textContent = `G${g} · ${G_NAMES[g]}`;
  gEl.setAttribute('fill', color);

  radEl.textContent = G_RAD[g];
  radEl.style.color = color;
  radEl.style.textShadow = `0 0 10px ${color}66`;
}

// X-ray flare class → color & label
function xrayColor(cls) {
  if (!cls) return '#7986a8';
  const c = cls[0].toUpperCase();
  if (c === 'X') return '#ef5350';
  if (c === 'M') return '#ffa726';
  if (c === 'C') return '#ffd740';
  return '#00e676';
}

function xrayDesc(cls) {
  if (!cls) return 'NO ACTIVE FLARES';
  const c = cls[0].toUpperCase();
  if (c === 'X') return 'X-CLASS · SEVERE';
  if (c === 'M') return 'M-CLASS · MODERATE';
  if (c === 'C') return 'C-CLASS · MINOR';
  if (c === 'B') return 'B-CLASS · BACKGROUND';
  return 'A-CLASS · QUIET';
}

async function fetchSpaceWeather() {
  // 1. Kp index
  try {
    const r    = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
    const data = await r.json();
    const last = data[data.length - 1];
    const kp   = typeof last === 'object' && last.Kp !== undefined
      ? last.Kp
      : parseFloat(last[1]);
    updateKpGauge(kp);
    if (window.dashboardState) window.dashboardState.kpIndex = kp;
  } catch (e) { console.warn('Kp fetch:', e); }

  // 2. X-ray flares
  try {
    const r    = await fetch('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json');
    const data = await r.json();
    const badgeEl = document.getElementById('xray-badge');
    const labelEl = document.getElementById('xray-label');
    if (data && data.length > 0) {
      const cls   = data[0].current_class || '';
      const color = xrayColor(cls);
      badgeEl.textContent  = cls || 'QUIET';
      badgeEl.style.color  = color;
      badgeEl.style.textShadow = `0 0 14px ${color}88`;
      labelEl.textContent  = xrayDesc(cls);
      labelEl.style.color  = color;
      if (window.dashboardState) window.dashboardState.xrayFlux = cls || 'QUIET';
    } else {
      badgeEl.textContent  = 'QUIET';
      badgeEl.style.color  = '#00e676';
      labelEl.textContent  = 'NO ACTIVE FLARES';
      labelEl.style.color  = '#00e676';
    }
  } catch (e) { console.warn('X-ray fetch:', e); }

  // 3. Solar wind speed (plasma-1-day: [time, density, speed, temp])
  try {
    const r    = await fetch('https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json');
    const rows = await r.json();
    const data = rows.slice(1).filter(r => r[2] && parseFloat(r[2]) > 0);
    if (data.length > 0) {
      const latest  = parseFloat(data[data.length - 1][2]);
      const hourAgo = parseFloat(data[Math.max(0, data.length - 61)][2]);
      const delta   = latest - hourAgo;
      const trend   = delta > 10 ? '↑' : delta < -10 ? '↓' : '→';
      const tColor  = delta > 10 ? '#ffa726' : delta < -10 ? '#4A90D9' : '#7986a8';
      const speedEl = document.getElementById('wind-speed');
      const trendEl = document.getElementById('wind-trend');
      speedEl.textContent = Math.round(latest);
      trendEl.textContent = trend;
      trendEl.style.color = tColor;
      if (window.dashboardState) window.dashboardState.solarWind = Math.round(latest);
    }
  } catch (e) { console.warn('Wind fetch:', e); }

  // 4. Refresh thumbnail (cache-bust)
  const thumb = document.getElementById('img-swx-overview');
  if (thumb) thumb.src = 'https://services.swpc.noaa.gov/images/swx-overview-large.gif?t=' + Date.now();
}

fetchSpaceWeather();
setInterval(fetchSpaceWeather, 5 * 60 * 1000);
})();

// Space weather tooltip popup system
/* ═══════════════════════════════════════════════════
   SPACE WEATHER TOOLTIPS
   Must run after the popup HTML elements above exist
═══════════════════════════════════════════════════ */
(function initSwTooltips() {
  const DATA = {
    kp: {
      title: 'Geomagnetic Kp Index',
      eli5: 'Think of this as a "space weather storm scale" from 0\u20139. The Sun constantly blasts charged particles at Earth. When a big burst hits Earth\'s magnetic field, it causes a geomagnetic storm \u2014 the same thing that makes the Northern Lights. The higher the number, the stronger the storm.',
      scale: [
        ['\uD83D\uDFE2', '0\u20131', 'Quiet \u2014 no issues'],
        ['\uD83D\uDFE2', '2\u20133', 'Unsettled \u2014 minor activity, no crew risk'],
        ['\uD83D\uDFE1', '4',   'Active \u2014 aurora visible at high latitudes'],
        ['\uD83D\uDFE1', '5 (G1)', 'Minor storm \u2014 weak effects on satellites'],
        ['\uD83D\uDFE0', '6 (G2)', 'Moderate storm \u2014 possible navigation issues'],
        ['\uD83D\uDD34', '7 (G3)', 'Strong storm \u2014 increased radiation at flight altitudes'],
        ['\uD83D\uDD34', '8 (G4)', 'Severe storm \u2014 significant radiation risk for crew'],
        ['\uD83D\uDD34', '9 (G5)', 'Extreme storm \u2014 crew would shelter inside Orion'],
      ],
      why: 'The Artemis II crew is OUTSIDE Earth\'s magnetic field, so they don\'t get the protection we do on the ground. A high Kp means the Sun is active and more radiation is reaching the Moon\'s vicinity.',
    },
    xray: {
      title: 'Solar X-Ray Flux (Flare Class)',
      eli5: 'This measures how much X-ray energy the Sun is blasting out right now. Solar flares are basically explosions on the Sun\'s surface. They\'re classified by letters like a report card \u2014 but backwards. A-class is tiny, X-class is massive.',
      scale: [
        ['\uD83D\uDFE2', 'A-class', 'Quiet \u2014 background level, no flares'],
        ['\uD83D\uDFE2', 'B-class', 'Minimal \u2014 tiny flares, no effect on crew'],
        ['\uD83D\uDFE1', 'C-class', 'Small flare \u2014 no danger to crew'],
        ['\uD83D\uDFE0', 'M-class', 'Medium flare \u2014 increased radiation, crew monitors exposure'],
        ['\uD83D\uDD34', 'X-class', 'Major flare \u2014 crew may need to shelter, mission control evaluates'],
      ],
      why: 'If a big solar flare happens while the crew is near the Moon, radiation levels spike. NASA has 24/7 space weather forecasters watching for exactly this. The crew can shelter in the most shielded part of Orion if needed.',
    },
    wind: {
      title: 'Solar Wind Speed',
      eli5: 'The Sun constantly blows a "wind" of charged particles in all directions at about 400 km/s (almost 1 million mph). That\'s normal. When it speeds up, it usually means a burst of solar energy is arriving \u2014 like a gust in a storm.',
      scale: [
        ['\uD83D\uDFE2', '< 400 km/s', 'Normal \u2014 typical background solar wind'],
        ['\uD83D\uDFE1', '400\u2013500 km/s', 'Elevated \u2014 slightly faster than usual'],
        ['\uD83D\uDFE0', '500\u2013700 km/s', 'High \u2014 a solar wind stream or CME may be arriving'],
        ['\uD83D\uDD34', '> 700 km/s', 'Very high \u2014 significant space weather event in progress'],
      ],
      why: 'Fast solar wind carries more radiation. Combined with a high Kp and active flares, fast wind means the space environment around the Moon is getting rougher for the crew.',
    },
    rad: {
      title: 'Crew Radiation Risk Assessment',
      eli5: 'This is a simplified overall assessment combining all the space weather indicators above. Think of it like a traffic light for how dangerous the radiation environment is for the four astronauts right now.',
      scale: [
        ['\uD83D\uDFE2', 'NOMINAL', 'Space weather is calm. Normal background radiation. No concerns.'],
        ['\uD83D\uDFE1', 'ELEVATED', 'Some solar activity detected. Crew is safe but mission control is watching closely.'],
        ['\uD83D\uDD34', 'HIGH', 'Significant solar event in progress. Crew may shelter in the most shielded part of Orion.'],
      ],
      why: 'On Earth, our atmosphere and magnetic field block most space radiation. The ISS is still partially protected. But the Artemis II crew is way beyond all of that \u2014 as exposed as it gets. This mission also doubles as a radiation research mission, with dosimeters on each crew member and six radiation sensors throughout the cabin.',
    },
  };

  const tooltip  = document.getElementById('sw-tooltip');
  const ttTitle  = document.getElementById('sw-tt-title');
  const ttEli5   = document.getElementById('sw-tt-eli5');
  const ttScale  = document.getElementById('sw-tt-scale');
  const ttWhy    = document.getElementById('sw-tt-why');
  const ttClose  = document.getElementById('sw-tt-close');
  let activeBtn  = null;

  function buildScale(rows) {
    return rows.map(([dot, label, desc]) =>
      '<div class="sw-tt-scale-row">' + dot + ' <strong style="color:var(--text)">' + label + '</strong> \u2014 ' + desc + '</div>'
    ).join('');
  }

  function showTooltip(btn, key) {
    var d = DATA[key];
    if (!d) return;
    ttTitle.textContent = d.title;
    ttEli5.textContent  = d.eli5;
    ttScale.innerHTML   = buildScale(d.scale);
    ttWhy.textContent   = d.why;
    var rect = btn.getBoundingClientRect();
    var isMob = window.innerWidth < 768;
    if (!isMob) {
      var ttW = 365;
      var left = rect.right + 10;
      if (left + ttW > window.innerWidth - 10) left = rect.left - ttW - 10;
      var top = rect.top - 10;
      if (top + 420 > window.innerHeight - 10) top = window.innerHeight - 430;
      top = Math.max(10, top);
      tooltip.style.left   = left + 'px';
      tooltip.style.top    = top  + 'px';
      tooltip.style.bottom = '';
      tooltip.style.right  = '';
    }
    tooltip.classList.add('visible');
    activeBtn = btn;
  }

  function hideTooltip() {
    tooltip.classList.remove('visible');
    activeBtn = null;
  }

  document.querySelectorAll('.sw-info-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (activeBtn === btn) { hideTooltip(); return; }
      showTooltip(btn, btn.dataset.sw);
    });
  });

  ttClose.addEventListener('click', hideTooltip);
  document.addEventListener('click', function(e) {
    if (tooltip.classList.contains('visible') &&
        !tooltip.contains(e.target) &&
        !e.target.classList.contains('sw-info-btn')) {
      hideTooltip();
    }
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { hideTooltip(); }
  });

  /* ── Full explainer popup ── */
  var fullPopup   = document.getElementById('sw-full-popup');
  var fullClose   = document.getElementById('sw-full-close');
  var fullContent = document.getElementById('sw-full-content');

  function buildFullContent() {
    return Object.keys(DATA).map(function(key) {
      var d = DATA[key];
      return '<div class="sw-full-section">' +
        '<div class="sw-tt-title" style="margin-bottom:6px;">' + d.title + '</div>' +
        '<div class="sw-tt-eli5">' + d.eli5 + '</div>' +
        '<div class="sw-tt-scale">' + buildScale(d.scale) + '</div>' +
        '<div class="sw-tt-why">' + d.why + '</div>' +
        '</div>';
    }).join('');
  }

  function openFullPopup() {
    hideTooltip();
    fullContent.innerHTML = buildFullContent();
    fullPopup.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeFullPopup() {
    fullPopup.classList.remove('open');
    document.body.style.overflow = '';
  }

  var explainLink = document.getElementById('sw-explain-link');
  if (explainLink) explainLink.addEventListener('click', openFullPopup);
  fullClose.addEventListener('click', closeFullPopup);
  fullPopup.addEventListener('click', function(e) { if (e.target === fullPopup) closeFullPopup(); });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && fullPopup.classList.contains('open')) closeFullPopup();
  });
})();
