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

    function renderWindows(wins) {
        if (!winPanel) return;
        if (!wins || wins.length === 0) {
            winPanel.innerHTML = `<div style="color:#7986a8;font-size:0.8rem;text-align:center;padding:20px 0;">No visible passes in the next 24h.</div>`;
            return;
        }
        winPanel.innerHTML = wins.map((w, i) => {
            const magStr = w.peakMag != null ? `Mag ${w.peakMag.toFixed(1)}` : 'Mag —';
            const durMs  = w.endMs - w.startMs;
            const label  = i === 0 ? 'NEXT PASS' : `PASS ${i + 1}`;
            return `
            <div style="
                border:1px solid rgba(0,255,170,0.2); border-radius:4px; padding:10px 12px;
                margin-bottom:8px; background:rgba(0,255,170,0.04);
            ">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span style="font-size:0.6rem;color:#00ffaa;letter-spacing:0.12em;">${label}</span>
                    <span style="font-size:0.6rem;color:#7986a8;">${fmtDuration(durMs)}</span>
                </div>
                <div style="font-family:'Orbitron',sans-serif;font-size:1.1rem;color:#fff;margin-bottom:4px;">
                    ${fmtLocalTime(w.startMs)}
                    <span style="font-size:0.55rem;color:#7986a8;"> LOCAL</span>
                </div>
                <div style="display:flex;gap:12px;margin-top:4px;">
                    <span style="font-size:0.7rem;color:#a8d4ff;">⬆ Peak ${w.peakAlt.toFixed(1)}°</span>
                    <span style="font-size:0.7rem;color:#ffb74d;">✦ ${magStr}</span>
                </div>
            </div>`;
        }).join('');
    }

    // SVG Sky Plot Drawer — with 60-minute projected path
    function drawPlot(alt, az, metSec, nowMs) {
        const R = 45; // horizon ring radius in SVG units
        let svg = `<svg viewBox="0 0 100 100" style="width:100%;height:100%;font-family:'Share Tech Mono', monospace;">
            <circle cx="50" cy="50" r="${R}" fill="none" stroke="rgba(74,144,217,0.2)"/>
            <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(74,144,217,0.1)"/>
            <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(74,144,217,0.1)"/>
            <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(74,144,217,0.1)"/>
            <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(74,144,217,0.1)"/>
            <text x="50" y="4" font-size="3" fill="#7986a8" text-anchor="middle">N</text>
            <text x="96" y="51" font-size="3" fill="#7986a8" text-anchor="start">E</text>
            <text x="50" y="99" font-size="3" fill="#7986a8" text-anchor="middle">S</text>
            <text x="4" y="51" font-size="3" fill="#7986a8" text-anchor="end">W</text>
        `;

        // Build projected path: sample t+10m, t+20m, ... t+60m
        // Uses the global obsLat/obsLon/obsAlt captured in closure
        const PATH_STEPS = 6;
        const STEP_SEC = 10 * 60;
        const pathPoints = [];

        if (window.ObserverAstro && window.MissionEphemeris && metSec != null) {
            for (let i = 1; i <= PATH_STEPS; i++) {
                const fMs  = nowMs + i * STEP_SEC * 1000;
                const fMet = metSec + i * STEP_SEC;
                const m = window.ObserverAstro.calculateMetrics(fMet, fMs, obsLat, obsLon, obsAlt);
                if (!m) continue;
                const fAlt = m.orion.altitude;
                const fAz  = m.orion.azimuth;
                const rad  = (fAz - 90) * Math.PI / 180;
                let r, cx, cy;
                if (fAlt >= 0) {
                    r  = ((90 - fAlt) / 90) * R;
                } else {
                    r  = R; // clamp to edge if below horizon
                }
                cx = 50 + r * Math.cos(rad);
                cy = 50 + r * Math.sin(rad);
                pathPoints.push(`${cx.toFixed(2)},${cy.toFixed(2)}`);
            }
        }

        if (pathPoints.length >= 2) {
            svg += `<polyline points="${pathPoints.join(' ')}" fill="none" stroke="rgba(0,255,170,0.35)" stroke-width="0.8" stroke-dasharray="2,1.5"/>`;
        }

        // Current position dot
        const radNow = (az - 90) * Math.PI / 180;
        if (alt >= 0) {
            const r  = ((90 - alt) / 90) * R;
            const px = 50 + r * Math.cos(radNow);
            const py = 50 + r * Math.sin(radNow);
            svg += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="2.5" fill="#00ffaa" opacity="1" filter="drop-shadow(0 0 3px #00ffaa)"/>`;
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

        // Target altitude chip
        if (o.altitude > 0) {
            isVis = true;
            visChip.textContent = "ABOVE HORIZON";
            visChip.className = "vis-chip";
        } else {
            visChip.textContent = "BELOW HORIZON";
            visChip.className = "vis-chip below";
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

        // SVG plotting (pass metSec + nowMs for path projection)
        drawPlot(o.altitude, o.azimuth, metSec, nowMs);

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
