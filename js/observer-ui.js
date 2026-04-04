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

    // SVG Sky Plot Drawer
    function drawPlot(alt, az) {
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

        // Az in SVG: North=top, rotate clockwise. Map az to SVG angle: 0°N → up → subtract 90°.
        const rad = (az - 90) * Math.PI / 180;

        if (alt >= 0) {
            // Above horizon: map 90°→center, 0°→edge
            const r = ((90 - alt) / 90) * R;
            const px = 50 + r * Math.cos(rad);
            const py = 50 + r * Math.sin(rad);
            svg += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="2.5" fill="#00ffaa" opacity="1" filter="drop-shadow(0 0 3px #00ffaa)"/>`;
        } else {
            // Below horizon: pin to the outer edge at the correct azimuth, dimmed
            const px = 50 + R * Math.cos(rad);
            const py = 50 + R * Math.sin(rad);
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

        // SVG plotting
        drawPlot(o.altitude, o.azimuth);
    }

    // Call interval and initial kickoff
    setInterval(tick, 1000);
});
