/**
 * observer-ui.js
 * Phase 1 User Interface integration for the Artemis II Observer Mode.
 * Geolocation binding, DOM update loop, and SVG plot.
 */

document.addEventListener("DOMContentLoaded", () => {
    let obsLat = null;
    let obsLon = null;
    let obsAlt = 0; // default to roughly sea level if unavailable
    let isReady = false;

    // DOM Elements
    const locStatus = document.getElementById('ui-loc-status');
    const darkState = document.getElementById('ui-darkness-state');
    const manForm = document.getElementById('manual-loc-form');
    
    // Visibility
    const visChip = document.getElementById('ui-vis-chip');
    const magDisp = document.getElementById('ui-mag');
    
    // Pointing
    const altDisp = document.getElementById('ui-alt');
    const azDisp = document.getElementById('ui-az');
    const raDisp = document.getElementById('ui-ra');
    const decDisp = document.getElementById('ui-dec');
    
    // Plot
    const skyPlotCtr = document.getElementById('sky-plot-container');
    
    // Cond
    const sunAltDisp = document.getElementById('ui-sun-alt');
    const moonAltDisp = document.getElementById('ui-moon-alt');
    const moonPhaseDisp = document.getElementById('ui-moon-phase');
    const orionPhaseDisp = document.getElementById('ui-orion-phase');
    
    // Range
    const distDisp = document.getElementById('ui-dist');
    const rateDisp = document.getElementById('ui-rate');

    // Viewing Windows panel
    const winPanel = document.getElementById('win-cards');

    // Imaging Assist
    const trackRateDisp  = document.getElementById('ui-track-rate');
    const maxExpDisp     = document.getElementById('ui-max-exp');
    const difficultyDisp = document.getElementById('ui-difficulty');

    // Window scan runs every 60 ticks (1 per minute) — it's a 73-step loop so we throttle
    let windowScanCountdown = 0;

    // ── Panel collapse state (persists across ticks) ──────────────────
    // Only active on mobile (<=767px); on desktop class has no effect.
    window.togglePanel = function(panelId) {
        // Only operate on mobile width
        if (window.innerWidth > 767) return;
        const panel = document.getElementById(panelId);
        if (!panel) return;
        const isCollapsed = panel.classList.toggle('collapsed');
        const btn = panel.querySelector('.panel-collapse-btn');
        if (btn) btn.classList.toggle('collapsed', isCollapsed);
    };

    // ── Sky plot: tap-to-fullscreen (mobile) ──────────────────────────
    const skyPlotCtrEl  = document.getElementById('sky-plot-container');
    const skyOverlay    = document.getElementById('sky-fullscreen-overlay');
    const skyFsInner    = document.getElementById('sky-fullscreen-inner');

    if (skyPlotCtrEl && skyOverlay && skyFsInner) {
        skyPlotCtrEl.addEventListener('click', () => {
            if (window.innerWidth > 767) return; // desktop: ignore
            // Clone current SVG into the overlay
            const liveSvg = skyPlotCtrEl.querySelector('svg');
            // Remove previous cloned svg if any
            const prev = skyFsInner.querySelector('svg');
            if (prev) prev.remove();
            if (liveSvg) skyFsInner.insertBefore(liveSvg.cloneNode(true), skyFsInner.firstChild);
            skyOverlay.classList.add('open');
        });
        // Close on overlay background click
        skyOverlay.addEventListener('click', (e) => {
            if (e.target === skyOverlay) skyOverlay.classList.remove('open');
        });
    }

    // ── Sky plot mode state ───────────────────────────────────────
    let use3D = false;
    const skyToggleBtn = document.getElementById('sky-toggle-btn');
    const skyInfoBtn   = document.getElementById('sky-info-btn');
    const skyTooltip   = document.getElementById('sky-tooltip');

    if (skyToggleBtn) {
        skyToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // don't fire togglePanel
            use3D = !use3D;
            skyToggleBtn.textContent = use3D ? '2D MAP' : '3D VIEW';
            skyToggleBtn.classList.toggle('active', use3D);
        });
    }

    if (skyInfoBtn && skyTooltip) {
        skyInfoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = skyTooltip.classList.toggle('open');
            skyInfoBtn.classList.toggle('open', isOpen);
        });
        document.addEventListener('click', () => {
            skyTooltip.classList.remove('open');
            skyInfoBtn.classList.remove('open');
        });
    }

    // Priming / hero elements
    const locPrime    = document.getElementById('loc-prime');
    const heroAwaiting = document.getElementById('hero-awaiting');

    // Show awaiting pulse until location is resolved
    if (heroAwaiting) heroAwaiting.style.display = 'block';

    function setLocationResolved(label) {
        if (locPrime)    locPrime.classList.add('hidden');
        if (heroAwaiting) heroAwaiting.style.display = 'none';
        if (locStatus)   { locStatus.textContent = label; locStatus.style.color = '#a8d4ff'; }
    }

    function setLocationCleared() {
        if (locPrime)    locPrime.classList.remove('hidden');
        if (heroAwaiting) heroAwaiting.style.display = 'block';
        if (locStatus)   { locStatus.textContent = 'LOCATION REQUIRED'; locStatus.style.color = '#ff5050'; }
    }

    // ── Reverse Geocoding (Nominatim) ────────────────────────────────────────
    async function getPlaceName(lat, lon) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'ArtemisII-Observer-Dashboard/1.0 (contact: artemisii-observer@users.noreply)' }
            });
            if (!res.ok) return null;
            const data = await res.json();
            const addr = data.address || {};
            const city = addr.city || addr.town || addr.suburb || addr.village || addr.county || '';
            const country = addr.country || '';
            return city ? `${city}, ${country}` : (country || null);
        } catch {
            return null;
        }
    }

    function haltAndRequireLocation() {
        setLocationCleared();
        manForm.style.display = "flex";
    }

    // Geolocation Init
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            obsLat = pos.coords.latitude;
            obsLon = pos.coords.longitude;
            if (pos.coords.altitude != null) obsAlt = pos.coords.altitude;
            // Show coords immediately, then upgrade to place name
            setLocationResolved(`LAT: ${obsLat.toFixed(4)}° / LON: ${obsLon.toFixed(4)}°`);
            isReady = true;
            const place = await getPlaceName(obsLat, obsLon);
            if (place) {
                setLocationResolved(`${place}  (${obsLat.toFixed(2)}°, ${obsLon.toFixed(2)}°)`);
            }
        }, (err) => {
            console.warn('Geolocation denied or unavailable.', err);
            haltAndRequireLocation();
        });
    } else {
        haltAndRequireLocation();
    }

    // Manual Entry bind
    document.getElementById('btn-apply-loc').addEventListener('click', async () => {
        const latVal = parseFloat(document.getElementById('in-lat').value);
        const lonVal = parseFloat(document.getElementById('in-lon').value);
        if (!isNaN(latVal) && !isNaN(lonVal)) {
            obsLat = latVal;
            obsLon = lonVal;
            manForm.style.display = "none";
            isReady = true;
            setLocationResolved(`LAT: ${obsLat.toFixed(4)}° / LON: ${obsLon.toFixed(4)}°`);
            const place = await getPlaceName(obsLat, obsLon);
            if (place) {
                setLocationResolved(`${place}  (${obsLat.toFixed(2)}°, ${obsLon.toFixed(2)}°)`);
            }
        }
    });

    document.getElementById('btn-clear-loc').addEventListener('click', () => {
        document.getElementById('in-lat').value = '';
        document.getElementById('in-lon').value = '';
        obsLat = null;
        obsLon = null;
        isReady = false;
        setLocationCleared();
    });

    // Fallbacks
    function handleNoData() {
        visChip.textContent = "AWAITING DATA";
        visChip.className = "vis-chip";
        magDisp.textContent = "—";
        altDisp.textContent = "—";
        azDisp.textContent = "—";
        raDisp.textContent = "—";
        decDisp.textContent = "—";
        distDisp.textContent = "—";
        rateDisp.textContent = "—";
        skyPlotCtr.innerHTML = "";
    }

    // Converters
    function degToDms(val) {
        const sign = val < 0 ? '-' : '';
        val = Math.abs(val);
        const d = Math.floor(val);
        const m = Math.floor((val - d) * 60);
        const s = ((val - d - m/60) * 3600).toFixed(1);
        return `${sign}${d}° ${m}' ${s}"`;
    }

    function hoursToHms(val) {
        const h = Math.floor(val);
        const m = Math.floor((val - h) * 60);
        const s = ((val - h - m/60) * 3600).toFixed(1);
        return `${h}h ${m}m ${s}s`;
    }

    // ── Viewing Windows Renderer ─────────────────────────────────────────
    // Cache the timezone abbreviation (e.g. "AEDT", "EST", "UTC+11")
    const _tzAbbr = (() => {
        try {
            const parts = new Intl.DateTimeFormat([], { timeZoneName: 'short' }).formatToParts(new Date());
            return parts.find(p => p.type === 'timeZoneName')?.value || '';
        } catch { return ''; }
    })();

    function fmtLocalTime(ms) {
        const t = new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        return _tzAbbr ? `${t} ${_tzAbbr}` : t;
    }

    function fmtDuration(ms) {
        const mins = Math.round((ms) / 60000);
        if (mins < 60) return `${mins} min`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }

    // Location bar Next Pass slot
    const locNextPass    = document.getElementById('loc-next-pass');
    const summaryPanel   = document.getElementById('panel-summary');

    function renderWindows(wins) {
        if (!locNextPass) return;
        if (!wins || wins.length === 0) {
            locNextPass.textContent = '';
            return;
        }
        const w = wins[0];
        const nowMs = Date.now();
        const diffMs = w.startMs - nowMs;
        const inHours = Math.floor(diffMs / 3600000);
        const inMins  = Math.floor((diffMs % 3600000) / 60000);
        const countStr = diffMs > 0 ? ` (in ${inHours > 0 ? inHours + 'h ' : ''}${inMins}m)` : ' (NOW)';
        locNextPass.textContent = `NEXT PASS: ${fmtLocalTime(w.startMs)}${countStr} • Peak ${w.peakAlt.toFixed(0)}°`;
    }

    // SVG Sky Plot — Planisphere with dashed rings, degree labels, zenith marker
    function drawPlot(alt, az, metSec, nowMs, moonAlt, moonAz) {
        const R = 45;
        // Ring radii represent:  R=45 → 0° horizon, R=30 → 30° alt, R=15 → 60° alt, centre = 90° zenith
        let svg = `<svg viewBox="0 0 100 100" style="width:100%;height:100%;font-family:'Share Tech Mono',monospace;">
            <!-- Horizon ring (solid) -->
            <circle cx="50" cy="50" r="${R}" fill="none" stroke="rgba(0,229,255,0.35)" stroke-width="0.8"/>
            <!-- 30° altitude ring (dashed) -->
            <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(0,229,255,0.2)" stroke-width="0.5" stroke-dasharray="2 4"/>
            <!-- 60° altitude ring (dashed) -->
            <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(0,229,255,0.2)" stroke-width="0.5" stroke-dasharray="2 4"/>
            <!-- Crosshairs -->
            <line x1="50" y1="3" x2="50" y2="97" stroke="rgba(0,229,255,0.15)" stroke-width="0.4"/>
            <line x1="3" y1="50" x2="97" y2="50" stroke="rgba(0,229,255,0.15)" stroke-width="0.4"/>
            <!-- Cardinal labels -->
            <text x="50" y="2" font-size="5" fill="#00e5ff" font-weight="bold" text-anchor="middle" dominant-baseline="hanging">N</text>
            <text x="98" y="52" font-size="5" fill="#00e5ff" font-weight="bold" text-anchor="end" dominant-baseline="middle">E</text>
            <text x="50" y="99" font-size="5" fill="#00e5ff" font-weight="bold" text-anchor="middle" dominant-baseline="auto">S</text>
            <text x="2" y="52" font-size="5" fill="#00e5ff" font-weight="bold" text-anchor="start" dominant-baseline="middle">W</text>
            <!-- Degree labels at 30° and 60° rings (NE diagonal) -->
            <text x="71.2" y="28.8" font-size="2.8" fill="rgba(0,229,255,0.45)" text-anchor="start">30°</text>
            <text x="60.6" y="39.4" font-size="2.8" fill="rgba(0,229,255,0.45)" text-anchor="start">60°</text>
            <!-- Zenith crosshair + label -->
            <line x1="48" y1="50" x2="52" y2="50" stroke="rgba(0,229,255,0.5)" stroke-width="0.6"/>
            <line x1="50" y1="48" x2="50" y2="52" stroke="rgba(0,229,255,0.5)" stroke-width="0.6"/>
            <text x="52" y="49" font-size="2.2" fill="rgba(0,229,255,0.4)" text-anchor="start">ZENITH</text>
        `;

        // ── Legend (top-right corner of plot) ───────────────────────────────────
        svg += `
            <circle cx="71" cy="6" r="2.5" fill="#ddd" opacity="0.8"/>
            <text x="75" y="7.5" font-size="3" fill="#ddd" opacity="0.8" dominant-baseline="middle">Moon</text>
            <circle cx="71" cy="13" r="2" fill="#00ffaa" opacity="0.9"/>
            <text x="75" y="14.5" font-size="3" fill="#00ffaa" opacity="0.9" dominant-baseline="middle">Orion</text>
            <line x1="68" y1="20" x2="74" y2="20" stroke="rgba(0,255,170,0.5)" stroke-width="0.8" stroke-dasharray="2,1.5"/>
            <text x="75" y="21.5" font-size="3" fill="rgba(0,255,170,0.5)" dominant-baseline="middle">Path</text>
        `;

        // ── Moon dot ──────────────────────────────────────────────────────────
        if (moonAlt != null && moonAz != null) {
            const moonRad = (moonAz - 90) * Math.PI / 180;
            let mR, mX, mY;
            if (moonAlt >= 0) {
                mR = ((90 - moonAlt) / 90) * R;
            } else {
                mR = R; // pin to edge
            }
            mX = 50 + mR * Math.cos(moonRad);
            mY = 50 + mR * Math.sin(moonRad);
            const moonOp = moonAlt >= 0 ? '0.85' : '0.25';
            svg += `<circle cx="${mX.toFixed(2)}" cy="${mY.toFixed(2)}" r="4" fill="#ddd" opacity="${moonOp}" filter="drop-shadow(0 0 3px #fff)"/>`;
            // 'M' label — offset above-right
            const lX = Math.min(97, Math.max(3, mX + 5));
            const lY = Math.min(97, Math.max(3, mY - 4));
            svg += `<text x="${lX.toFixed(1)}" y="${lY.toFixed(1)}" font-size="4" fill="#ddd" opacity="${moonOp}" text-anchor="start">Moon</text>`;
        }

        // ── Projected path (dashed, next 60 min) ─────────────────────────────
        const PATH_STEPS = 6;
        const STEP_SEC = 10 * 60;
        const pathPoints = [];

        if (window.ObserverAstro && window.MissionEphemeris && metSec != null) {
            for (let i = 1; i <= PATH_STEPS; i++) {
                const fMs  = nowMs + i * STEP_SEC * 1000;
                const fMet = metSec + i * STEP_SEC;
                const fm = window.ObserverAstro.calculateMetrics(fMet, fMs, obsLat, obsLon, obsAlt);
                if (!fm) continue;
                const fAlt = fm.orion.altitude;
                const fAz  = fm.orion.azimuth;
                const fRad = (fAz - 90) * Math.PI / 180;
                const fR   = fAlt >= 0 ? ((90 - fAlt) / 90) * R : R;
                pathPoints.push(`${(50 + fR * Math.cos(fRad)).toFixed(2)},${(50 + fR * Math.sin(fRad)).toFixed(2)}`);
            }
        }

        if (pathPoints.length >= 2) {
            svg += `<polyline points="${pathPoints.join(' ')}" fill="none" stroke="rgba(0,255,170,0.35)" stroke-width="0.8" stroke-dasharray="2,1.5"/>`;
        }

        // ── Orion / spacecraft dot + label ────────────────────────────────────
        const radNow = (az - 90) * Math.PI / 180;
        if (alt >= 0) {
            const r  = ((90 - alt) / 90) * R;
            const px = 50 + r * Math.cos(radNow);
            const py = 50 + r * Math.sin(radNow);
            svg += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="2.5" fill="#00ffaa" opacity="1" filter="drop-shadow(0 0 3px #00ffaa)"/>`;
            const lX = Math.min(96, Math.max(3, px + 3.5));
            const lY = Math.min(97, Math.max(3, py - 3));
            svg += `<text x="${lX.toFixed(1)}" y="${lY.toFixed(1)}" font-size="3.5" fill="#00ffaa" text-anchor="start">Orion</text>`;
        } else {
            const px = 50 + R * Math.cos(radNow);
            const py = 50 + R * Math.sin(radNow);
            svg += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="2.5" fill="#ff5050" opacity="0.3" filter="drop-shadow(0 0 2px #ff5050)"/>`;
        }

        svg += `</svg>`;
        skyPlotCtr.innerHTML = svg;
    }

    // UI Ticker
    function tick() {
        if (!isReady || !window.MissionEphemeris || !window.MissionEphemeris.ready) {
            return;
        }

        const nowMs = Date.now();
        // Fallback robust metSec calculation
        const L_UTC = (window.LAUNCH_UTC && window.LAUNCH_UTC.getTime) ? window.LAUNCH_UTC.getTime() : 0;
        const metSec = (nowMs - L_UTC) / 1000;

        const m = window.ObserverAstro.calculateMetrics(metSec, nowMs, obsLat, obsLon, obsAlt);

        if (!m) {
            handleNoData();
            return;
        }

        const o = m.orion;
        let isVis = false;
        
        // Sun elevation state
        if (m.sun.altitude > 0) {
            darkState.textContent = "DAYLIGHT — NOT VISIBLE";
            darkState.style.color = "#ff5050";
        } else if (m.sun.altitude > -18) {
            darkState.textContent = "TWILIGHT — NOT DARK";
            darkState.style.color = "#ff5050";
        } else {
            darkState.textContent = "TRUE NIGHT ✓";
            darkState.style.color = "#00e676";
        }

        // Target altitude chip + summary panel state
        if (o.altitude > 0) {
            isVis = true;
            visChip.textContent = "ABOVE HORIZON";
            visChip.className = "vis-chip";
            if (summaryPanel) summaryPanel.classList.add('obs-visible');
        } else {
            visChip.textContent = "BELOW HORIZON";
            visChip.className = "vis-chip below";
            if (summaryPanel) summaryPanel.classList.remove('obs-visible');
        }

        // Paint Pointing & Mag
        magDisp.textContent = o.magnitude != null ? o.magnitude.toFixed(1) : "—";

        altDisp.textContent = o.altitude.toFixed(2) + "°";
        azDisp.textContent = o.azimuth.toFixed(2) + "°";

        raDisp.textContent = hoursToHms(o.raHours);
        decDisp.textContent = degToDms(o.decDeg);

        // Env Conditions
        sunAltDisp.textContent = m.sun.altitude.toFixed(1) + "°";
        moonAltDisp.textContent = m.moon.altitude.toFixed(1) + "°";
        moonPhaseDisp.textContent = m.moon.phaseFraction != null ? (m.moon.phaseFraction * 100).toFixed(0) + "%" : "—";
        orionPhaseDisp.textContent = o.phaseAngleDeg.toFixed(1) + "°";

        // Motion and Range
        distDisp.textContent = Math.round(o.distanceKm).toLocaleString() + " KM";
        rateDisp.textContent = o.angularSpeedDegMin != null ? o.angularSpeedDegMin.toFixed(4) + " °/min" : "—";

        // SVG plotting — dispatch to 2D or 3D
        if (use3D) {
            draw3DDome(o.altitude, o.azimuth, m.moon.altitude, m.moon.azimuth);
        } else {
            drawPlot(o.altitude, o.azimuth, metSec, nowMs, m.moon.altitude, m.moon.azimuth);
        }

        // Imaging Assist
        if (o.angularSpeedDegMin != null) {
            const img = window.ObserverAstro.calculateImagingAssistance(o.angularSpeedDegMin, o.magnitude);
            if (trackRateDisp)  trackRateDisp.textContent  = img.trackRateArcsecSec.toFixed(3);
            if (maxExpDisp)     maxExpDisp.textContent      = img.maxExpSec != null ? img.maxExpSec.toFixed(1) + ' s' : '—';
            if (difficultyDisp) difficultyDisp.textContent  = img.difficultyLabel;
        }

        // Viewing Windows — scan once per minute (throttled)
        windowScanCountdown--;
        if (windowScanCountdown <= 0) {
            windowScanCountdown = 60;
            const wins = window.ObserverAstro.calculateViewingWindows(obsLat, obsLon, nowMs, metSec, obsAlt);
            renderWindows(wins);
        }
    }

    // Call interval and initial kickoff
    setInterval(tick, 1000);

    // ── 3D Isometric Sky Dome ─────────────────────────────────────────
    function draw3DDome(alt, az, moonAlt, moonAz) {
        const CX = 75, CY = 88, SC = 52; // isometric origin and scale

        // Isometric projection: Alt(deg), Az(deg) -> SVG {x, y}
        // Standard isometric: X-right = East, Y-into = North, Z-up = Up
        function iso(altDeg, azDeg) {
            const a  = altDeg * Math.PI / 180;
            const th = azDeg  * Math.PI / 180;
            // Unit sphere
            const x3 = Math.cos(a) * Math.sin(th);  // East
            const y3 = Math.cos(a) * Math.cos(th);  // North
            const z3 = Math.sin(a);                  // Up
            // Isometric 2D
            const px = (x3 - y3) * 0.866;
            const py = -(x3 + y3) * 0.5 - z3;
            return { x: CX + px * SC, y: CY + py * SC };
        }

        // Sample a ring at fixed altitude, 0-360° azimuth
        function ringPts(altDeg, steps) {
            return Array.from({ length: steps + 1 }, (_, i) => {
                const p = iso(altDeg, (i / steps) * 360);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            }).join(' ');
        }

        // Sample a meridian from alt=0 to alt=90
        function meridianPts(azDeg) {
            return Array.from({ length: 19 }, (_, i) => {
                const p = iso(i * 5, azDeg);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            }).join(' ');
        }

        let svg = `<svg viewBox="0 0 150 130" style="width:100%;height:100%;font-family:'Share Tech Mono',monospace;">`;

        // Ground fill
        svg += `<polyline points="${ringPts(0, 72)}" fill="rgba(0,229,255,0.04)" stroke="none"/>` ;

        // Meridian wires (every 45°)
        for (let maz = 0; maz < 360; maz += 45) {
            svg += `<polyline points="${meridianPts(maz)}" fill="none" stroke="rgba(0,229,255,0.1)" stroke-width="0.4"/>`;
        }

        // Latitude rings at 30° and 60° (dashed)
        svg += `<polyline points="${ringPts(30, 72)}" fill="none" stroke="rgba(0,229,255,0.18)" stroke-width="0.45" stroke-dasharray="1.5 3"/>`;
        svg += `<polyline points="${ringPts(60, 72)}" fill="none" stroke="rgba(0,229,255,0.18)" stroke-width="0.45" stroke-dasharray="1.5 3"/>`;

        // Horizon ring (solid, brighter)
        svg += `<polyline points="${ringPts(0, 72)}" fill="none" stroke="rgba(0,229,255,0.4)" stroke-width="0.8"/>`;

        // Cardinal labels at horizon
        for (const [caz, lbl] of [[0,'N'],[90,'E'],[180,'S'],[270,'W']]) {
            const p = iso(0, caz);
            const dx = p.x - CX, dy = p.y - CY;
            const norm = Math.sqrt(dx*dx + dy*dy) || 1;
            const lx = p.x + dx/norm * 5.5, ly = p.y + dy/norm * 5.5;
            svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="5" fill="#00e5ff" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${lbl}</text>`;
        }

        // Altitude labels
        const p30 = iso(30, 45);
        svg += `<text x="${(p30.x+2).toFixed(1)}" y="${p30.y.toFixed(1)}" font-size="3" fill="rgba(0,229,255,0.45)" dominant-baseline="middle">30°</text>`;
        const p60 = iso(60, 45);
        svg += `<text x="${(p60.x+2).toFixed(1)}" y="${p60.y.toFixed(1)}" font-size="3" fill="rgba(0,229,255,0.45)" dominant-baseline="middle">60°</text>`;

        // Zenith dot
        const zen = iso(90, 0);
        svg += `<circle cx="${zen.x.toFixed(1)}" cy="${zen.y.toFixed(1)}" r="1.5" fill="rgba(0,229,255,0.45)"/>`;
        svg += `<text x="${(zen.x+3).toFixed(1)}" y="${zen.y.toFixed(1)}" font-size="2.5" fill="rgba(0,229,255,0.4)" dominant-baseline="middle">90° ZENITH</text>`;

        // Observer marker at ground centre
        svg += `<circle cx="${CX}" cy="${CY}" r="2.5" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.6"/>`;
        svg += `<text x="${CX}" y="${CY + 5}" font-size="2.8" fill="rgba(255,255,255,0.35)" text-anchor="middle">YOU</text>`;

        // ── Moon (if above horizon) ────────────────────────────────────
        if (moonAlt != null && moonAz != null && moonAlt >= 0) {
            const mp   = iso(moonAlt, moonAz);
            const mpGnd = iso(0, moonAz);
            // Drop line
            svg += `<line x1="${mp.x.toFixed(1)}" y1="${mp.y.toFixed(1)}" x2="${mpGnd.x.toFixed(1)}" y2="${mpGnd.y.toFixed(1)}" stroke="rgba(221,221,221,0.18)" stroke-width="0.5" stroke-dasharray="1.5 2"/>`;
            // Moon dot
            svg += `<circle cx="${mp.x.toFixed(1)}" cy="${mp.y.toFixed(1)}" r="4" fill="#ddd" opacity="0.85" filter="drop-shadow(0 0 3px #fff)"/>`;
            // Label — offset up-right
            const lx = Math.min(143, mp.x + 6), ly = Math.max(5, mp.y - 3);
            svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="3.2" fill="#ddd" opacity="0.9" dominant-baseline="middle">Moon ${moonAlt.toFixed(0)}°</text>`;
        }

        // ── Orion ──────────────────────────────────────────────────
        if (alt >= 0) {
            const op   = iso(alt, az);
            const opGnd = iso(0, az);
            // Drop line to horizon
            svg += `<line x1="${op.x.toFixed(1)}" y1="${op.y.toFixed(1)}" x2="${opGnd.x.toFixed(1)}" y2="${opGnd.y.toFixed(1)}" stroke="rgba(0,200,100,0.22)" stroke-width="0.5" stroke-dasharray="1.5 2"/>`;
            // Orion dot
            svg += `<circle cx="${op.x.toFixed(1)}" cy="${op.y.toFixed(1)}" r="2.5" fill="#00e676" filter="drop-shadow(0 0 3px #00e676)"/>`;
            const lx = Math.min(143, op.x + 4), ly = Math.max(5, op.y - 2);
            svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="3.2" fill="#00e676" dominant-baseline="middle">Orion ${alt.toFixed(0)}°</text>`;
        } else {
            // Below horizon banner at bottom of dome
            svg += `<text x="${CX}" y="122" font-size="3" fill="#ef5350" text-anchor="middle" opacity="0.75">ORION BELOW HORIZON (${Math.abs(alt).toFixed(0)}°)</text>`;
        }

        svg += `</svg>`;
        skyPlotCtr.innerHTML = svg;
    }
});
