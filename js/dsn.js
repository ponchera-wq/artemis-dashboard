// dsn.js — Deep Space Network panel
// ── DSN ARTEMIS II PANEL ─────────────────────────────────────────────
(function() {
  const DSN_URL = 'https://eyes.nasa.gov/dsn/data/dsn.xml';
  const ART_IDS = new Set(['EM2','ORION','ART2','ARTEMIS','ARTII','ORXII']);
  const STATIONS = {
    gdscc: { name: 'Goldstone', flag: '🇺🇸', tz: -25200000, mx: 52.6,  my: 24.3 },
    mdscc: { name: 'Madrid',    flag: '🇪🇸', tz:  7200000,  mx: 146.5, my: 22.0 },
    cdscc: { name: 'Canberra',  flag: '🇦🇺', tz:  39600000, mx: 274.2, my: 55.7 },
  };
  const BIG_DISHES = new Set([14, 43, 63]);
  const BAND_INFO = {
    S:  { name: 'S-band',  freq: '~2 GHz',  color: '#4A90D9' },
    X:  { name: 'X-band',  freq: '~8 GHz',  color: '#ab47bc' },
    K:  { name: 'Ka-band', freq: '~32 GHz', color: '#ff7043' },
    KA: { name: 'Ka-band', freq: '~32 GHz', color: '#ff7043' },
    L:  { name: 'L-band',  freq: '~1.5 GHz',color: '#26c6da' },
  };
  const DSN_TIPS = {
    rtlt: {
      title: 'ROUND-TRIP LIGHT TIME',
      body:  'How long a signal takes to travel from Earth to Orion and back at the speed of light (300,000 km/s). Right now it\'s under a second — almost like a phone call. Near the Moon it grows to ~2.5s. At Mars it\'d be 20+ minutes each way, which is why deep space crews must act independently.',
    },
    dirlink: {
      title: 'DOWNLINK vs UPLINK',
      body:  '<b>Downlink ↓</b> is data FROM Orion TO Earth — telemetry, crew voice, video.<br><b>Uplink ↑</b> is data FROM Earth TO Orion — commands, flight plans, software updates.<br><b>Both ↕</b> means the dish simultaneously transmits and receives — full-duplex communication.',
    },
    rate: {
      title: 'DATA RATE',
      body:  'How fast data flows between Orion and Earth. At 2 Mbps it\'s roughly a slow home internet connection — enough for voice and basic video. NASA\'s O2O laser comm system on this mission can reach 260 Mbps, enabling near-4K video feeds from the Moon.',
    },
    dish: {
      title: 'DSS ANTENNA',
      body:  'DSS = Deep Space Station. Three complexes are spaced 120° around the globe — Goldstone (California), Madrid (Spain), and Canberra (Australia) — so at least one always has line-of-sight to Orion as Earth rotates. The 70m dishes (DSS-14, 43, 63) are reserved for the most distant or critical signals.',
    },
    band: {
      title: 'FREQUENCY BAND',
      body:  'Like different FM stations, each band is a different frequency range.<br><b>S-band (~2 GHz)</b> — reliable workhorse: voice and commands.<br><b>X-band (~8 GHz)</b> — higher data throughput: telemetry streams.<br><b>Ka-band (~32 GHz)</b> — fastest but sensitive to rain fade.<br>The O2O laser system bypasses radio entirely, using infrared light.',
    },
  };

  const rtltHistory = [];
  const MAX_HIST = 30;

  function fmtRate(bps) {
    bps = parseInt(bps) || 0;
    if (bps <= 0) return '—';
    if (bps >= 1e6) return (bps/1e6).toFixed(2) + ' Mbps';
    if (bps >= 1e3) return (bps/1e3).toFixed(1) + ' kbps';
    return bps + ' bps';
  }
  function fmtRTLT(s) {
    s = parseFloat(s);
    if (!s || s <= 0) return null;
    if (s < 60) return s.toFixed(2) + 's';
    return Math.floor(s/60) + 'm ' + (s%60).toFixed(0) + 's';
  }
  function estimatedRTLT() {
    const raw  = parseFloat((document.getElementById('tv-earth')?.textContent||'').replace(/,/g,''));
    const unit = document.getElementById('tu-earth')?.textContent || 'KM';
    const km   = unit === 'MI' ? raw / 0.621371 : raw;
    if (km > 0) { const sec = (km * 2) / 299792.458; return { str: fmtRTLT(sec) + ' ~', sec }; }
    return null;
  }
  function stationTime(tz) {
    const d = new Date(Date.now() + tz);
    return d.getUTCHours().toString().padStart(2,'0') + ':' + d.getUTCMinutes().toString().padStart(2,'0');
  }
  function dishSize(num) { return BIG_DISHES.has(parseInt(num)) ? '70m' : '34m'; }
  function bandInfo(b)   { return BAND_INFO[(b||'').toUpperCase()] || { name: b ? b+'-band' : '', freq: '', color: '#4A90D9' }; }

  function parseDSN(xmlDoc) {
    const links = [];
    let curStation = null;
    const dsn = xmlDoc.querySelector('dsn');
    if (!dsn) return links;
    for (const node of dsn.children) {
      if (node.tagName === 'station') {
        curStation = node.getAttribute('name');
      } else if (node.tagName === 'dish' && curStation) {
        for (const tgt of node.querySelectorAll('target')) {
          const tName = (tgt.getAttribute('name') || '').toUpperCase();
          if (!ART_IDS.has(tName)) continue;
          const sigs = [...node.querySelectorAll('upSignal,downSignal')];
          const up   = sigs.find(s => s.tagName==='upSignal'   && s.getAttribute('active')==='true');
          const dn   = sigs.find(s => s.tagName==='downSignal' && s.getAttribute('active')==='true');
          const dNum = node.getAttribute('name').replace(/\D/g,'');
          links.push({
            station: curStation,
            dish:    'DSS-' + dNum,
            dishNum: dNum,
            target:  tName,
            up:  up ? { rate: up.getAttribute('dataRate'), band: up.getAttribute('band'), freq: up.getAttribute('frequency') } : null,
            dn:  dn ? { rate: dn.getAttribute('dataRate'), band: dn.getAttribute('band'), freq: dn.getAttribute('frequency') } : null,
            rtlt:  tgt.getAttribute('rtlt'),
            range: tgt.getAttribute('uplegRange'),
            az: parseFloat(node.getAttribute('azimuthAngle'))   || null,
            el: parseFloat(node.getAttribute('elevationAngle')) || null,
          });
        }
      }
    }
    return links;
  }

  function sparklineSVG() {
    if (rtltHistory.length < 3) return '';
    const vals = rtltHistory.slice(-MAX_HIST);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const range = mx - mn || 0.01;
    const W = 80, H = 16;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * W;
      const y = H - ((v - mn) / range) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const last = pts.trim().split(' ').pop().split(',');
    return `<svg class="dsn-rtlt-sparkline" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <polyline points="${pts}" fill="none" stroke="rgba(0,230,118,0.45)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="2" fill="var(--green)"/>
    </svg>`;
  }

  function networkMapSVG(active) {
    let dots = '', arcs = '';
    Object.entries(STATIONS).forEach(([code, si]) => {
      const on  = active.has(code);
      const col = on ? '#00e676' : 'rgba(74,144,217,0.22)';
      const op  = on ? '1' : '0.3';
      if (on) {
        dots += `<circle cx="${si.mx}" cy="${si.my}" r="8" fill="#00e676" opacity="0.12"><animate attributeName="r" values="5;11;5" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.2;0;0.2" dur="2.2s" repeatCount="indefinite"/></circle>`;
        arcs += `<line x1="${si.mx}" y1="${si.my}" x2="150" y2="-10" stroke="rgba(0,230,118,0.28)" stroke-width="0.8" stroke-dasharray="3,3"><animate attributeName="stroke-dashoffset" values="0;-6" dur="0.8s" repeatCount="indefinite"/></line>`;
      }
      dots += `<circle cx="${si.mx}" cy="${si.my}" r="4" fill="${col}" opacity="${op}"/>
        <text x="${si.mx}" y="${si.my-8}" text-anchor="middle" font-family="Share Tech Mono,monospace" font-size="7" fill="${col}" opacity="${on?'0.9':'0.3'}">${si.name.slice(0,4).toUpperCase()}</text>`;
    });
    return `<div class="dsn-network-map">
      <div class="dsn-network-map-title">GROUND STATION NETWORK · 120° COVERAGE</div>
      <svg class="dsn-world-svg" viewBox="-5 -18 310 90" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="dsnBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(4,8,22,0.9)"/><stop offset="1" stop-color="rgba(0,3,12,0.9)"/></linearGradient></defs>
        <rect x="-5" y="-18" width="310" height="90" rx="2" fill="url(#dsnBg)" stroke="rgba(74,144,217,0.1)" stroke-width="0.5"/>
        <line x1="0" y1="35" x2="300" y2="35" stroke="rgba(74,144,217,0.07)" stroke-width="0.5"/>
        <line x1="75"  y1="0" x2="75"  y2="70" stroke="rgba(74,144,217,0.04)" stroke-width="0.5"/>
        <line x1="150" y1="0" x2="150" y2="70" stroke="rgba(74,144,217,0.07)" stroke-width="0.5"/>
        <line x1="225" y1="0" x2="225" y2="70" stroke="rgba(74,144,217,0.04)" stroke-width="0.5"/>
        <text x="148" y="38" font-family="Share Tech Mono,monospace" font-size="5" fill="rgba(74,144,217,0.18)" text-anchor="middle">EQUATOR</text>
        ${arcs}${dots}
        <text x="150" y="-10" text-anchor="middle" font-family="Share Tech Mono,monospace" font-size="6.5" fill="rgba(0,230,118,0.5)">🚀 ORION</text>
      </svg>
    </div>`;
  }

  function funStatHTML() {
    const elapsedSec = Math.max(0, Date.now() - LAUNCH_UTC) / 1000;
    const frames = Math.floor((2_000_000 * elapsedSec) / 512);
    return `<div class="dsn-funstat">📊 EST. TELEMETRY FRAMES SINCE LAUNCH: ~${frames.toLocaleString()}</div>`;
  }

  function signalTrackHTML(hasUp, hasDn) {
    if (!hasUp && !hasDn) return '<div class="dsn-signal-track idle"></div>';
    if (hasUp && hasDn)   return '<div class="dsn-signal-track flow-both"></div>';
    if (hasDn)            return '<div class="dsn-signal-track flow-down"></div>';
    return '<div class="dsn-signal-track flow-up"></div>';
  }

  function linkCardHTML(link, estimated) {
    const si    = STATIONS[link.station] || { name: link.station, flag: '📡' };
    const hasUp = !!link.up, hasDn = !!link.dn;
    const dir   = hasUp && hasDn ? '↕ BOTH' : hasUp ? '↑ UPLINK' : '↓ DOWNLINK';
    const dirCls= hasUp && hasDn ? 'both' : hasUp ? 'up' : 'down';
    const size  = dishSize(link.dishNum || '');

    // RTLT
    let rtltSec = null, rtltStr = '—';
    if (!estimated && link.rtlt) {
      rtltSec = parseFloat(link.rtlt);
      rtltStr = fmtRTLT(link.rtlt) || '—';
    } else {
      const est = estimatedRTLT();
      if (est) { rtltSec = est.sec; rtltStr = est.str; }
    }
    if (rtltSec !== null && rtltSec > 0) {
      rtltHistory.push(rtltSec);
      if (rtltHistory.length > MAX_HIST) rtltHistory.shift();
    }
    const bounceDur = rtltSec ? Math.max(0.3, Math.min(5, rtltSec)).toFixed(2) + 's' : '1s';

    // Bands
    const dnBand = hasDn ? bandInfo(link.dn.band) : null;
    const upBand = hasUp ? bandInfo(link.up.band) : null;

    // Rates
    const downStr = hasDn ? fmtRate(link.dn.rate) : '—';
    const upStr   = hasUp ? fmtRate(link.up.rate) : '—';

    // Az/El
    const azEl = (link.az !== null && link.el !== null)
      ? `DISH POINTING · AZ: ${link.az.toFixed(1)}° · EL: ${link.el.toFixed(1)}°` : '';

    return `
      <div class="dsn-link-card">
        <div class="dsn-link-header">
          <span style="font-size:1rem">${si.flag}</span>
          <span class="dsn-station-name">${si.name.toUpperCase()} · ${link.dish}</span>
          <span class="dsn-size-badge" title="Dish diameter">${size} dish</span>
          <button class="dsn-info-btn" data-dsn="dish">ⓘ</button>
          <span class="dsn-dir dsn-dir-${dirCls}">${dir}</span>
          <button class="dsn-info-btn" data-dsn="dirlink">ⓘ</button>
        </div>
        <div class="dsn-status-bar${estimated?' dsn-amber':''}">
          <span class="dsn-dot-pulse${estimated?' amber':''}"></span>
          ARTEMIS II ${estimated?'ESTIMATED':'LINKED'}
          ${signalTrackHTML(hasUp, hasDn)}
        </div>
        <div class="dsn-metrics">
          <div class="dsn-metric dsn-rtlt">
            <div class="dsn-rtlt-viz">
              <span title="Earth">🌍</span>
              <div class="dsn-rtlt-track"><div class="dsn-rtlt-dot" style="animation-duration:${bounceDur}"></div></div>
              <span title="Orion">🚀</span>
            </div>
            <div class="dsn-metric-val">${rtltStr} <button class="dsn-info-btn" data-dsn="rtlt">ⓘ</button></div>
            <div class="dsn-metric-label">Round-Trip Light Time</div>
            <div class="dsn-rtlt-compare">At Moon: ~2.5s · At Mars: ~20 min</div>
            ${sparklineSVG()}
          </div>
          <div class="dsn-metric">
            <div class="dsn-metric-val">${downStr} <button class="dsn-info-btn" data-dsn="rate">ⓘ</button></div>
            ${dnBand && dnBand.name ? `<div class="dsn-band-badge" style="border-color:${dnBand.color}44;color:${dnBand.color};">${dnBand.name} <span style="opacity:0.55;font-size:0.9em">${dnBand.freq}</span> <button class="dsn-info-btn" data-dsn="band" style="font-size:0.45rem">ⓘ</button></div>` : ''}
            <div class="dsn-metric-label">↓ Downlink</div>
          </div>
          <div class="dsn-metric">
            <div class="dsn-metric-val">${upStr}</div>
            ${upBand && upBand.name ? `<div class="dsn-band-badge" style="border-color:${upBand.color}44;color:${upBand.color};">${upBand.name} <span style="opacity:0.55;font-size:0.9em">${upBand.freq}</span></div>` : ''}
            <div class="dsn-metric-label">↑ Uplink</div>
          </div>
        </div>
        ${azEl ? `<div class="dsn-pointing">${azEl}</div>` : ''}
      </div>`;
  }

  function networkHTML(links) {
    const active = new Set(links.map(l => l.station));
    return networkMapSVG(active) +
      '<div class="dsn-network">' +
        Object.entries(STATIONS).map(([code, si]) => {
          const on  = active.has(code);
          const cnt = links.filter(l => l.station === code).length;
          return `<div class="dsn-complex ${on?'dsn-complex-active':''}">
            <span class="dsn-complex-dot ${on?'active':''}"></span>
            <span class="dsn-complex-flag">${si.flag}</span>
            <div>
              <div class="dsn-complex-name">${si.name.toUpperCase()}</div>
              <div class="dsn-complex-detail">${on ? cnt+' DISH TRACKING ART-II' : 'NO ART-II LINK'} · ${stationTime(si.tz)} LT</div>
            </div>
          </div>`;
        }).join('') +
      '</div>' +
      funStatHTML();
  }

  function renderLinks(links, isLive) {
    const el    = document.getElementById('dsn-content');
    const badge = document.getElementById('dsn-badge');
    if (!el) return;
    // Expose active DSN station to HUD
    if (links.length > 0 && window.dashboardState) {
      const si = STATIONS[links[0].station] || { name: links[0].station };
      window.dashboardState.dsnStation = si.name + ' ' + links[0].dish;
    } else if (window.dashboardState) {
      window.dashboardState.dsnStation = null;
    }
    if (badge) {
      badge.textContent = isLive ? '● LIVE' : '● EST';
      badge.className   = isLive ? 'news-live-badge' : 'news-live-badge dsn-badge-est';
      badge.style.marginLeft = 'auto';
    }
    const dsnLt = document.getElementById('dsn-local-time');
    if (dsnLt) dsnLt.textContent = '';

    if (links.length === 0) {
      const hour = new Date().getUTCHours();
      const code = hour < 8 ? 'cdscc' : hour < 16 ? 'mdscc' : 'gdscc';
      const si   = STATIONS[code];
      const est  = estimatedRTLT();
      el.innerHTML = `
        <div class="dsn-links">
          <div class="dsn-nolink">📡 NO ACTIVE ARTEMIS II LINK<br>AWAITING NEXT PASS
            <div class="dsn-nolink-subs">
              <span>EST. ACTIVE COMPLEX: ${si.flag} ${si.name.toUpperCase()}</span>
              <span>EST. ROUND-TRIP LIGHT TIME: ${est ? est.str : '—'}</span>
            </div>
          </div>
        </div>
        ${networkHTML([])}`;
      return;
    }

    el.innerHTML =
      '<div class="dsn-links">' +
        links.slice(0, 1).map(l => linkCardHTML(l, !isLive)).join('') +
      '</div>' +
      networkHTML(links);
  }

  // ── ELI5 tooltip (event delegation — works for dynamically rendered buttons) ──
  const tipEl = document.createElement('div');
  tipEl.id = 'dsn-tooltip';
  document.body.appendChild(tipEl);
  let tipOpen = false;
  document.addEventListener('click', e => {
    const btn = e.target.closest('.dsn-info-btn[data-dsn]');
    if (btn) {
      const tip = DSN_TIPS[btn.dataset.dsn];
      if (!tip) return;
      e.stopPropagation();
      tipEl.innerHTML = `<div class="dsn-tip-title">${tip.title}</div>${tip.body}`;
      const r = btn.getBoundingClientRect();
      let left = r.right + 8;
      if (left + 340 > window.innerWidth) left = r.left - 340;
      if (left < 8) left = 8;
      let top = r.top - 10;
      if (top + 220 > window.innerHeight) top = window.innerHeight - 225;
      if (top < 8) top = 8;
      tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
      tipEl.classList.add('visible'); tipOpen = true;
    } else if (tipOpen && !tipEl.contains(e.target)) {
      tipEl.classList.remove('visible'); tipOpen = false;
    }
  });
  document.addEventListener('keydown', e => { if (e.key==='Escape' && tipOpen) { tipEl.classList.remove('visible'); tipOpen = false; } });

  async function update() {
    try {
      const res  = await fetch(DSN_URL + '?_=' + Date.now());
      const text = await res.text();
      const doc  = new DOMParser().parseFromString(text, 'text/xml');
      renderLinks(parseDSN(doc), true);
    } catch {
      const hour = new Date().getUTCHours();
      const code = hour < 8 ? 'cdscc' : hour < 16 ? 'mdscc' : 'gdscc';
      renderLinks([{ station: code, dish: 'DSS-EST', dishNum: '24', target: 'EM2', up: null, dn: { rate: 0, band: 'S' }, rtlt: null, az: null, el: null }], false);
    }
  }

  update();
  setInterval(update, 10000);
})();
