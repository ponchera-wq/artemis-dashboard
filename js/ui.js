// ui.js — YouTube tabs, expand overlays, telemetry overlay, drag/reorder, footer

// ── TELEMETRY CINEMATIC OVERLAY
// ── TELEMETRY CINEMATIC OVERLAY ──────────────────────────────────────
(function() {
  const overlay   = document.getElementById('telem-overlay');
  const closeBtn  = document.getElementById('telem-overlay-close');
  const expandBtn = document.getElementById('telem-expand-btn');
  const pipsEl    = document.getElementById('to-phase-pips');
  if (!overlay || !expandBtn) return;

  let updateInterval = null;
  let prevEarth = null, prevMoon = null, prevSpeed = null;
  let pipsBuilt = false;

  function open() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    overlay.setAttribute('aria-hidden','false');
    syncData();
    updateInterval = setInterval(syncData, 1000);
  }
  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    overlay.setAttribute('aria-hidden','true');
    clearInterval(updateInterval);
  }

  function set(id, text) { const el = document.getElementById(id); if (el) el.textContent = text || ''; }
  function mirror(id, srcId) { set(id, document.getElementById(srcId)?.textContent || ''); }

  function trend(elId, cur, prev) {
    const el = document.getElementById(elId);
    if (!el || prev === null || cur === null) return;
    const diff = cur - prev;
    if (Math.abs(diff) < 0.5) { el.textContent = ''; el.className = 'to-gauge-trend'; return; }
    const dir = diff > 0;
    el.textContent = (dir ? '↑' : '↓') + ' ' + (dir ? 'increasing' : 'decreasing');
    el.className   = 'to-gauge-trend ' + (dir ? 'up' : 'down');
  }

  function buildPips() {
    if (pipsBuilt) return;
    const srcNodes = document.querySelectorAll('#phase-bar .phase-node');
    if (!srcNodes.length) return;
    srcNodes.forEach(node => {
      const pip = document.createElement('span');
      pip.className = 'to-phase-pip';
      pip.dataset.nodeId = node.id;
      const lbl = node.querySelector('.phase-node-label');
      if (lbl) {
        const ltxt = document.createElement('span');
        ltxt.className = 'to-phase-pip-label';
        ltxt.textContent = lbl.textContent.slice(0,4);
        pip.appendChild(ltxt);
      }
      pipsEl.appendChild(pip);
    });
    pipsBuilt = true;
  }

  function updatePips() {
    buildPips();
    const srcNodes = document.querySelectorAll('#phase-bar .phase-node');
    const pips = pipsEl.children;
    srcNodes.forEach((node, i) => {
      if (!pips[i]) return;
      pips[i].className = 'to-phase-pip' +
        (node.classList.contains('active') ? ' active' :
         node.classList.contains('done')   ? ' done'   : '');
    });
  }

  function syncData() {
    // MET / time
    mirror('to-met',   'met-display');
    mirror('to-utc',   'utc-display');
    mirror('to-local', 'local-time-display');

    // Signal
    const sp = document.getElementById('signal-pill');
    const sg = document.getElementById('to-signal');
    if (sp && sg) { sg.textContent = sp.textContent; sg.className = sp.className; }

    // Phase
    mirror('to-phase', 'current-phase-name');
    mirror('to-current-event', 'current-event-name');
    updatePips();

    // Next event — extract text from timeline element
    const nextEl = document.getElementById('tl-next-event');
    if (nextEl) {
      const namePart = nextEl.querySelector('div:first-child')?.textContent?.replace(/^NEXT:\s*/,'') || '';
      const whenPart = nextEl.querySelector('.tl-next-when')?.textContent || '';
      set('to-next-event', namePart ? namePart + (whenPart ? ' — ' + whenPart : '') : '');
    }

    // Gauges — read from live source elements
    const eStr = document.getElementById('tv-earth')?.textContent || '—';
    const mStr = document.getElementById('tv-moon')?.textContent  || '—';
    const sStr = document.getElementById('tv-speed')?.textContent || '—';
    set('to-v-earth', eStr);
    set('to-v-moon',  mStr);
    set('to-v-speed', sStr);
    mirror('to-u-earth', 'tu-earth');
    mirror('to-u-moon',  'tu-moon');
    mirror('to-u-speed', 'tu-speed');
    mirror('to-a-earth', 'earth-annotation');
    mirror('to-a-moon',  'moon-annotation');

    // Trend arrows
    const eNum = parseFloat(eStr.replace(/,/g,'')) || null;
    const mNum = parseFloat(mStr.replace(/,/g,'')) || null;
    const sNum = parseFloat(sStr.replace(/,/g,'')) || null;
    trend('to-t-earth', eNum, prevEarth);
    trend('to-t-moon',  mNum, prevMoon);
    trend('to-t-speed', sNum, prevSpeed);
    prevEarth = eNum; prevMoon = mNum; prevSpeed = sNum;

    // Speed in km/s
    const unit = document.getElementById('tu-speed')?.textContent || '';
    const speedKmh = unit === 'KM/H' ? (sNum || 0) : (sNum || 0) / 0.621371;
    set('to-speed-kms', (speedKmh / 3600).toFixed(2) + ' km/s');

    // Data source
    const badge = document.getElementById('telem-badge');
    const srcEl = document.getElementById('to-source');
    if (badge && srcEl) {
      srcEl.textContent = badge.textContent;
      srcEl.className = 'to-extra-val ' + (badge.classList.contains('telem-badge-live') ? 'live' : 'est');
    }

    // Phase detail
    const phase = document.getElementById('current-phase-name')?.textContent || '';
    const DETAILS = {
      'LAUNCH':       '~185 km × ~70,400 km INITIAL ORBIT',
      'EARTH ORBIT':  'HIGHLY ELLIPTICAL · ~185 km × ~70,400 km',
      'TLI BURN':     'TRANS-LUNAR INJECTION · BURNING FOR THE MOON',
      'OUTBOUND COAST':'OUTBOUND FREE-RETURN TRAJECTORY',
      'LUNAR FLYBY':  'LUNAR FLYBY · DISTANT RETROGRADE APPROACH',
      'RETURN COAST': 'RETURN COAST · INBOUND FREE RETURN',
      'ENTRY':        'ATMOSPHERIC ENTRY · SKIP REENTRY CORRIDOR',
      'SPLASHDOWN':   'RECOVERY OPERATIONS',
    };
    set('to-phase-detail', DETAILS[phase] || phase || '—');

    // Unit toggle button label
    const utBtn = document.getElementById('to-unit-toggle');
    const srcBtn = document.getElementById('unit-toggle');
    if (utBtn && srcBtn) utBtn.textContent = srcBtn.textContent;
  }

  // Open / close handlers
  expandBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

  // Unit toggle in overlay mirrors main toggle
  document.getElementById('to-unit-toggle')?.addEventListener('click', () => {
    document.getElementById('unit-toggle')?.click();
    syncData();
  });
})();

// ── YOUTUBE TAB SWITCHER + VIDEO OVERLAY + PANEL EXPAND + LAYOUT
// ── YOUTUBE TAB SWITCHER ─────────────────────────────────────────────
document.querySelectorAll('#feed-youtube .yt-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#feed-youtube .yt-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.yt-frame').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    const frame = document.getElementById(tab.dataset.target);
    frame.classList.add('active');
    // Lazy-load: only set src on first click (data-src iframes have no src initially)
    if (frame.tagName === 'IFRAME' && !frame.src && frame.dataset.src) {
      frame.src = frame.dataset.src;
    }
  });
});

// ── VIDEO FULLSCREEN OVERLAY ──────────────────────────────────────────
(function() {
  const overlay = document.getElementById('yt-overlay');
  const frame   = document.getElementById('yt-overlay-frame');
  const closeBtn = document.getElementById('yt-overlay-close');
  const expandBtn = document.getElementById('yt-expand');

  function openOverlay() {
    // Default to mission coverage
    const activeTab = overlay.querySelector('.yt-tab.active');
    frame.src = activeTab?.dataset.ytSrc || '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeOverlay() {
    overlay.classList.remove('open');
    frame.src = '';
    document.body.style.overflow = '';
  }

  expandBtn.addEventListener('click', openOverlay);
  closeBtn.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) closeOverlay(); });

  // Overlay tab switcher
  overlay.querySelectorAll('.yt-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.yt-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      frame.src = tab.dataset.ytSrc || '';
    });
  });
})();

// ── PANEL EXPAND OVERLAY ────────────────────────────────────────────
(function() {
  const panelOverlay = document.getElementById('panel-overlay');
  const panelContent = document.getElementById('panel-overlay-content');
  const panelTitle   = document.getElementById('panel-overlay-title');
  const panelClose   = document.getElementById('panel-overlay-close');
  let sourcePanel = null;

  function openPanel(panelId) {
    const src = document.getElementById(panelId);
    if (!src) return;
    sourcePanel = src;
    const header = src.querySelector('.panel-header');
    const titleMap = { 'top-bar': 'MISSION TELEMETRY — LIVE DATA' };
    panelTitle.textContent = titleMap[panelId] || (header ? header.textContent.replace(/[⛶⠿].*/g, '').replace(/[A-Z]$/,'').trim() : panelId);
    // Move the panel's inner content into overlay
    panelContent.innerHTML = '';
    const children = [...src.children].filter(c => !c.classList.contains('panel-header') && !c.classList.contains('corner-tl') && !c.classList.contains('corner-br'));
    children.forEach(c => panelContent.appendChild(c));
    // For trajectory: overlay content must be a flex column so #trajectory-3d can fill it
    if (panelId === 'feed-arow') {
      panelContent.style.display = 'flex';
      panelContent.style.flexDirection = 'column';
      panelContent.style.padding = '0';
      const traj = panelContent.querySelector('#trajectory-3d');
      if (traj) { traj.style.flex = '1'; traj.style.height = '100%'; }
    } else {
      panelContent.style.display = '';
      panelContent.style.flexDirection = '';
      panelContent.style.padding = '';
    }
    panelOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Trigger resize for trajectory canvas — delay lets overlay finish layout
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
  }

  function closePanel() {
    if (sourcePanel) {
      // Move content back
      const children = [...panelContent.children];
      children.forEach(c => sourcePanel.appendChild(c));
      sourcePanel = null;
    }
    panelOverlay.classList.remove('open');
    document.body.style.overflow = '';
    window.dispatchEvent(new Event('resize'));
  }

  document.querySelectorAll('.panel-expand').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openPanel(btn.dataset.panel); });
  });
  panelClose.addEventListener('click', closePanel);
  panelOverlay.addEventListener('click', e => { if (e.target === panelOverlay) closePanel(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelOverlay.classList.contains('open')) closePanel(); });
})();

/* SPACE WEATHER TOOLTIPS — initialized in separate script tag after popup HTML (below) */

/* ═══════════════════════════════════════════════════
   DRAG-TO-REORDER + PANEL RESIZE
   Panels: drag ⠿ handle to swap · click [S/M/L] to resize
   Sizes: S=1col, M=2col, L=full-row (3col)
   State persisted in localStorage
═══════════════════════════════════════════════════ */
(function initLayout() {
  const PANEL_IDS = ['feed-youtube','feed-arow','feed-dsn','feed-weather','feed-blog','mission-updates'];
  const SIZE_CYCLE = ['s','m','l'];
  const COLS = 3;
  const isMobile = () => window.innerWidth < 768;
  const isDesktop = () => window.innerWidth >= 1200;

  const DEFAULT_STATE = () => ({
    order: [...PANEL_IDS],
    sizes: Object.fromEntries(PANEL_IDS.map(id => [id,'s']))
  });

  let state;
  try {
    const saved = localStorage.getItem('artemis-layout-v3');
    state = saved ? JSON.parse(saved) : DEFAULT_STATE();
    // Validate
    if (!state.order || state.order.length !== PANEL_IDS.length ||
        !PANEL_IDS.every(id => state.order.includes(id))) {
      state = DEFAULT_STATE();
    }
  } catch(e) { state = DEFAULT_STATE(); }

  let dragSource = null;
  let dragFromHandle = false;

  // Single mouseup listener to reset handle flag
  document.addEventListener('mouseup', () => { dragFromHandle = false; });

  PANEL_IDS.forEach(id => {
    const panel = document.getElementById(id);
    if (!panel) return;

    // Make panel draggable; only allow when grab from handle
    panel.setAttribute('draggable', 'true');

    const handle = panel.querySelector('.drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', () => { dragFromHandle = true; });
    }

    panel.addEventListener('dragstart', e => {
      if (isMobile() || !dragFromHandle) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      dragSource = id;
      setTimeout(() => panel.classList.add('dragging'), 0);
    });

    panel.addEventListener('dragend', () => {
      panel.classList.remove('dragging');
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('drag-over'));
      dragSource = null;
      dragFromHandle = false;
    });

    panel.addEventListener('dragover', e => {
      if (!dragSource || dragSource === id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      panel.classList.add('drag-over');
    });

    panel.addEventListener('dragleave', e => {
      if (panel.contains(e.relatedTarget)) return;
      panel.classList.remove('drag-over');
    });

    panel.addEventListener('drop', e => {
      e.preventDefault();
      panel.classList.remove('drag-over');
      if (dragSource && dragSource !== id) {
        const ai = state.order.indexOf(dragSource);
        const bi = state.order.indexOf(id);
        if (ai !== -1 && bi !== -1) {
          [state.order[ai], state.order[bi]] = [state.order[bi], state.order[ai]];
          applyLayout();
        }
      }
      dragSource = null;
    });

    // Size toggle button
    const sizeBtn = panel.querySelector('.size-btn');
    if (sizeBtn) {
      sizeBtn.addEventListener('click', e => {
        e.stopPropagation();
        const cur = state.sizes[id] || 's';
        state.sizes[id] = SIZE_CYCLE[(SIZE_CYCLE.indexOf(cur) + 1) % SIZE_CYCLE.length];
        applyLayout();
      });
    }
  });

  // Reset layout button
  const resetBtn = document.getElementById('reset-layout-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => { state = DEFAULT_STATE(); applyLayout(); });
  }

  function calcMaxRow() {
    let row = 2, col = 1, maxRow = 2;
    state.order.forEach(id => {
      const sz = state.sizes[id] || 's';
      const span = sz === 'l' ? 3 : sz === 'm' ? 2 : 1;
      if (col + span - 1 > COLS) { row++; col = 1; }
      maxRow = Math.max(maxRow, row);
      col += span;
      if (col > COLS) { row++; col = 1; }
    });
    return maxRow;
  }

  function applyLayout() {
    // Update size button labels always (visible on all breakpoints)
    PANEL_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const btn = el.querySelector('.size-btn');
      if (btn) btn.textContent = (state.sizes[id] || 's').toUpperCase();
    });

    // Custom grid positions only on desktop (≥1200px)
    // Tablet/mobile: clear inline overrides and let CSS media queries handle layout
    if (!isDesktop()) {
      PANEL_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.gridRow = ''; el.style.gridColumn = ''; }
      });
      const dashboard = document.getElementById('dashboard');
      dashboard.style.gridTemplateRows = '';
      const crewStrip = document.getElementById('crew-strip');
      if (crewStrip) crewStrip.style.gridRow = '';
      return;
    }

    let row = 3, col = 1, maxRow = 3;

    state.order.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const sz = state.sizes[id] || 's';
      const span = sz === 'l' ? 3 : sz === 'm' ? 2 : 1;

      // Wrap to next row if panel doesn't fit
      if (col + span - 1 > COLS) { row++; col = 1; }

      el.style.gridRow    = String(row);
      el.style.gridColumn = span > 1 ? `${col} / span ${span}` : String(col);
      maxRow = Math.max(maxRow, row);

      col += span;
      if (col > COLS) { row++; col = 1; }
    });

    // Expand dashboard grid rows to fit all panel rows
    const dashboard = document.getElementById('dashboard');
    const panelRowCount = maxRow - 2; // rows 3..maxRow (row 1 = ref-nav, row 2 = top-bar)
    dashboard.style.gridTemplateRows =
      `32px 112px ${Array(panelRowCount).fill('1fr').join(' ')} 36px 38px`;

    // Move crew-strip and footer to correct last rows
    const crewStrip = document.getElementById('crew-strip');
    if (crewStrip) crewStrip.style.gridRow = String(maxRow + 1);
    const siteFooter = document.getElementById('site-footer');
    if (siteFooter) siteFooter.style.gridRow = String(maxRow + 2);

    // Persist
    try { localStorage.setItem('artemis-layout-v3', JSON.stringify(state)); } catch(e) {}

    // Notify Three.js canvas of size change (guard prevents re-entry)
    _layoutFiring = true;
    window.dispatchEvent(new Event('resize'));
    _layoutFiring = false;
  }

  let _layoutFiring = false;

  applyLayout();

  // Re-apply on viewport resize (handles desktop ↔ tablet transitions)
  // Skip if we fired the event ourselves
  window.addEventListener('resize', () => { if (!_layoutFiring) applyLayout(); });
})();


// ── FOOTER LAST MODIFIED
  (function() {
    var el = document.getElementById('footer-modified');
    if (!el) return;
    try {
      var d = new Date(document.lastModified);
      if (isNaN(d)) throw 0;
      el.textContent = 'Page last modified: ' + d.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
    } catch(e) { el.textContent = ''; }
  })();

// ── MOBILE PANEL COLLAPSE ────────────────────────────────────────────
// Adds ▸/▾ toggle to each panel header on mobile (≤767px).
// feed-arow + feed-blog start expanded; others collapsed by default.
// Expand state persists in sessionStorage for the duration of the session.
(function() {
  if (window.innerWidth >= 768) return;

  const COLLAPSIBLE     = ['feed-arow', 'feed-blog', 'feed-youtube', 'feed-dsn', 'feed-weather', 'mission-updates'];
  const DEFAULT_CLOSED  = new Set(['feed-youtube', 'feed-dsn', 'feed-weather', 'mission-updates']);
  const STORAGE_KEY     = 'artemis-mobile-collapse-v1';

  let colState;
  try { colState = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch(e) { colState = null; }
  if (!colState) {
    colState = {};
    COLLAPSIBLE.forEach(id => { colState[id] = DEFAULT_CLOSED.has(id); });
  }

  COLLAPSIBLE.forEach(function(id) {
    const panel  = document.getElementById(id);
    if (!panel) return;
    const header = panel.querySelector('.panel-header');
    if (!header) return;

    const btn = document.createElement('button');
    btn.className = 'mobile-toggle';

    function apply(collapsed) {
      panel.classList.toggle('mobile-collapsed', collapsed);
      btn.textContent = collapsed ? '▸' : '▾';
      btn.setAttribute('aria-expanded', String(!collapsed));
    }

    apply(!!colState[id]);
    header.appendChild(btn);

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      colState[id] = !colState[id];
      apply(colState[id]);
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(colState)); } catch(ex) {}
    });
  });
})();
