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

    function haltAndRequireLocation() {
        locStatus.textContent = "LOCATION REQUIRED";
        locStatus.style.color = "#ff5050";
        manForm.style.display = "flex";
    }

    // Geolocation Init
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            obsLat = pos.coords.latitude;
            obsLon = pos.coords.longitude;
            if (pos.coords.altitude != null) {
                obsAlt = pos.coords.altitude;
            }
            locStatus.textContent = `LAT: ${obsLat.toFixed(4)}° / LON: ${obsLon.toFixed(4)}°`;
            isReady = true;
        }, (err) => {
            console.warn("Geolocation denied or unavailable.", err);
            haltAndRequireLocation();
        });
    } else {
        haltAndRequireLocation();
    }

    // Manual Entry bind
    document.getElementById('btn-apply-loc').addEventListener('click', () => {
        const latVal = parseFloat(document.getElementById('in-lat').value);
        const lonVal = parseFloat(document.getElementById('in-lon').value);
        if (!isNaN(latVal) && !isNaN(lonVal)) {
            obsLat = latVal;
            obsLon = lonVal;
            locStatus.textContent = `LAT: ${obsLat.toFixed(4)}° / LON: ${obsLon.toFixed(4)}°`;
            locStatus.style.color = "#a8d4ff";
            manForm.style.display = "none";
            isReady = true;
        }
    });

    document.getElementById('btn-clear-loc').addEventListener('click', () => {
        document.getElementById('in-lat').value = '';
        document.getElementById('in-lon').value = '';
        obsLat = null;
        obsLon = null;
        isReady = false;
        locStatus.textContent = "LOCATION REQUIRED";
        locStatus.style.color = "#ff5050";
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
    function fmtLocalTime(ms) {
        return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    function fmtDuration(ms) {
        const mins = Math.round((ms) / 60000);
        if (mins < 60) return `${mins} min`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }

    // Summary panel DOM refs
    const summaryPanel   = document.getElementById('panel-summary');
    const summaryCard    = document.getElementById('summary-next-pass');
    const uiNextTime     = document.getElementById('ui-next-time');
    const uiNextPeak     = document.getElementById('ui-next-peak');
    const uiNextMag      = document.getElementById('ui-next-mag');
    const uiNextDur      = document.getElementById('ui-next-dur');

    function renderWindows(wins) {
        // Update the summary panel's Next Pass card
        if (summaryCard) {
            if (!wins || wins.length === 0) {
                summaryCard.className = 'next-pass-card no-pass';
                if (uiNextTime) uiNextTime.textContent = 'None in 24h';
                if (uiNextPeak) uiNextPeak.textContent = '—';
                if (uiNextMag)  uiNextMag.textContent  = 'Mag —';
                if (uiNextDur)  uiNextDur.textContent  = '—';
            } else {
                const w = wins[0];
                const durMs  = w.endMs - w.startMs;
                const magStr = w.peakMag != null ? `Mag ${w.peakMag.toFixed(1)}` : 'Mag —';
                summaryCard.className = 'next-pass-card';
                if (uiNextTime) uiNextTime.textContent = fmtLocalTime(w.startMs);
                if (uiNextPeak) uiNextPeak.textContent = `⬆ peak ${w.peakAlt.toFixed(1)}°`;
                if (uiNextMag)  uiNextMag.textContent  = `✦ ${magStr}`;
                if (uiNextDur)  uiNextDur.textContent  = fmtDuration(durMs);
            }
        }
    }

    // SVG Sky Plot Drawer — with 60-minute projected path, Moon, and labels
    function drawPlot(alt, az, metSec, nowMs, moonAlt, moonAz) {
        const R = 45; // horizon ring radius in SVG units
        let svg = `<svg viewBox="0 0 100 100" style="width:100%;height:100%;font-family:'Share Tech Mono', monospace;">
            <circle cx="50" cy="50" r="${R}" fill="none" stroke="rgba(74,144,217,0.35)" stroke-width="0.7"/>
            <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(74,144,217,0.2)" stroke-width="0.5"/>
            <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(74,144,217,0.2)" stroke-width="0.5"/>
            <line x1="50" y1="3" x2="50" y2="97" stroke="rgba(74,144,217,0.2)" stroke-width="0.5"/>
            <line x1="3" y1="50" x2="97" y2="50" stroke="rgba(74,144,217,0.2)" stroke-width="0.5"/>
            <text x="50" y="2.5" font-size="5" fill="#a8d4ff" font-weight="bold" text-anchor="middle" dominant-baseline="hanging">N</text>
            <text x="98" y="52" font-size="5" fill="#a8d4ff" font-weight="bold" text-anchor="end" dominant-baseline="middle">E</text>
            <text x="50" y="98" font-size="5" fill="#a8d4ff" font-weight="bold" text-anchor="middle" dominant-baseline="auto">S</text>
            <text x="2" y="52" font-size="5" fill="#a8d4ff" font-weight="bold" text-anchor="start" dominant-baseline="middle">W</text>
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
            darkState.textContent = "DAYLIGHT (NOT VISIBLE)";
            darkState.style.color = "#7986a8";
        } else if (m.sun.altitude > -18) {
            darkState.textContent = "TWILIGHT";
            darkState.style.color = "#ffb74d";
        } else {
            darkState.textContent = "TRUE NIGHT";
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
        magDisp.className = o.magnitude == null || !isVis ? "m-primary dim" : "m-primary";

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

        // SVG plotting — pass moon alt/az from the metrics object
        drawPlot(o.altitude, o.azimuth, metSec, nowMs, m.moon.altitude, m.moon.azimuth);

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
});
