/**
 * observer-ui.js
 * Phase 1 User Interface integration for the Artemis II Observer Mode.
 * Geolocation binding, DOM update loop, and SVG plot.
 */

// ── Site Defaults ─────────────────────────────────────────────────────────
const DEFAULT_LAT       = -35.4014;  // Canberra DSN / Tidbinbilla
const DEFAULT_LON       =  148.9817;
const DEFAULT_ELEV      =  549;      // Metres AMSL
const DEFAULT_SITE_NAME = 'Canberra DSN (Tidbinbilla)';

// ── Hardware Defaults ─────────────────────────────────────────────────────
const DEFAULT_FOCAL_LENGTH = 1420;   // mm  (SCT 8" + 0.7x reducer)
const DEFAULT_APERTURE     = 203.2;  // mm
const DEFAULT_PIXEL_SIZE   = 3.76;   // µm

let isDrag = false;
let o = {};
let renderer, scene, camera, orionGroup, stars, earthMesh, trajectoryLine, shadowCone;
let t_scene, t_camera, t_renderer, t_earth, t_traj, t_orion, t_shadow, t_sun, t_obsMarker;
let t_sunArrow, t_sunLabel, t_shadowLabel, t_orionLabel;
let t_isDrag = false, t_dragStart = null, t_azimuth = 0, t_elevation = 0, t_radius = 8;
// Mission Map (dedicated full-width 3D panel)
let mm_renderer, mm_scene, mm_camera, mm_earth, mm_traj, mm_orion, mm_shadow, mm_sun;
let mm_isDrag = false, mm_dragStart = null, mm_azimuth = 0.4, mm_elevation = 0.5, mm_radius = 8;
const EARTH_R_KM = 6371;
const S_SCALE = 1/EARTH_R_KM;

document.addEventListener("DOMContentLoaded", () => {
    let obsLat = DEFAULT_LAT;
    let obsLon = DEFAULT_LON;
    let obsAlt = DEFAULT_ELEV;
    let isReady = true; 
    let useEyepiece = false;
    let cloudCoverPct = null;   // cached from Open-Meteo
    let coverageBluemarble = null; // preloaded texture for 2D map
    // Preload Blue Marble
    (() => {
        const img = new Image();
        img.onload = () => { if (img.complete) coverageBluemarble = img; };
        img.crossOrigin = 'anonymous';
        img.src = 'https://unpkg.com/three-globe@2.45.1/example/img/earth-blue-marble.jpg';
    })();

    // ── Collapsible section panels ────────────────────────────────────
    function togglePanel(hdr, forceCollapse = null) {
        const bodyId = hdr.getAttribute('data-target');
        const body   = document.getElementById(bodyId);
        if (!body) return;

        const isCurrentlyCollapsed = body.classList.contains('collapsed');
        const shouldCollapse = (forceCollapse !== null) ? forceCollapse : !isCurrentlyCollapsed;

        if (shouldCollapse) {
            body.classList.add('collapsed');
            hdr.classList.add('is-collapsed');
        } else {
            body.classList.remove('collapsed');
            hdr.classList.remove('is-collapsed');
        }
    }

    document.querySelectorAll('.section-header[data-target]').forEach(hdr => {
        hdr.addEventListener('click', (e) => {
            // Don't collapse if the user clicks a button or input inside the header
            if (e.target.closest('button, a, input')) return;
            togglePanel(hdr);
        });
    });

    // Initial state: Step 1 (Gear), Step 2 (Sky), and Step 3 (Verdicts) are expanded
    document.querySelectorAll('.section-header[data-target]').forEach(hdr => {
        const target = hdr.getAttribute('data-target');
        if (target !== 'sky-body' && target !== 'verdicts-body' && target !== 'gear-body') {
            togglePanel(hdr, true); // Force collapse others
        }
    });

    // DOM Elements
    const locStatus = document.getElementById('ui-loc-header-name');
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
    const pixelSpanDisp  = document.getElementById('ui-pixel-span');
    const plateScaleDisp = document.getElementById('ui-plate-scale');
    const confidenceDisp = document.getElementById('ui-confidence');
    const expStartDisp   = document.getElementById('ui-exp-start');
    
    // Timeline & Heatmap
    const timelineProgress = document.getElementById('ui-timeline-progress');
    const proxOpsAlert     = document.getElementById('prox-ops-alert');
    const heatmapCtr       = document.getElementById('heatmap-container');
    // Mission Map overlay stats
    const mapDist   = document.getElementById('map-dist');
    const mapVel    = document.getElementById('map-vel');
    const mapShadow = document.getElementById('map-shadow');

    // Hardware Profile Inputs
    const inAperture     = document.getElementById('in-aperture');
    const inFocalLength  = document.getElementById('in-focal-length');
    const inPixelSize    = document.getElementById('in-pixel-size');
    const inHyperstar    = document.getElementById('in-hyperstar');
    const inPlannedExp   = document.getElementById('in-planned-exp');
    const btnStellarium  = document.getElementById('btn-export-stellarium');

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
    const btnView2D = document.getElementById('btn-view-2d');
    const btnView3D = document.getElementById('btn-view-3d');
    const btnViewEp = document.getElementById('btn-view-eyepiece');
    const skyInfoBtn   = document.getElementById('sky-info-btn');
    const skyTooltip   = document.getElementById('sky-tooltip');

    if (btnView2D) {
        btnView2D.addEventListener('click', () => {
            use3D = false; useEyepiece = false;
            updateSkyModeUI();
        });
    }
    if (btnView3D) {
        btnView3D.addEventListener('click', () => {
            use3D = true; useEyepiece = false;
            updateSkyModeUI();
        });
    }
    if (btnViewEp) {
        btnViewEp.addEventListener('click', () => {
            use3D = false; useEyepiece = true;
            updateSkyModeUI();
        });
    }

    function updateSkyModeUI() {
        const eyepieceCanvas = document.getElementById('eyepiece-canvas');
        const threeCanvas = document.getElementById('three-canvas');
        const skySvgWrap = document.getElementById('sky-svg-wrap');
        const legend3d = document.getElementById('sky-3d-legend');
        const step2Title = document.getElementById('step2-title');

        // Reset all buttons to base style
        [btnView2D, btnView3D, btnViewEp].forEach(btn => {
            if (!btn) return;
            btn.classList.remove('active');
            btn.style.borderColor = 'rgba(255,167,38,0.5)';
            btn.style.color = '#ffa726';
            btn.style.background = 'transparent';
        });

        const setActiveBtn = (btn) => {
            if (!btn) return;
            btn.classList.add('active');
            btn.style.borderColor = '#ffcc00';
            btn.style.color = '#ffcc00';
            btn.style.background = 'rgba(255,204,0,0.1)';
        };

        if (useEyepiece) {
            setActiveBtn(btnViewEp);
            if (step2Title) step2Title.textContent = "VIRTUAL EYEPIECE — TELESCOPE VIEW";
            if (eyepieceCanvas) eyepieceCanvas.style.display = 'block';
            if (threeCanvas) threeCanvas.style.display = 'none';
            if (skySvgWrap) skySvgWrap.style.display = 'none';
            if (legend3d) legend3d.style.display = 'none';
            initEyepiece();
        } else if (use3D) {
            setActiveBtn(btnView3D);
            if (step2Title) step2Title.textContent = "MISSION MAP — 3D ORBITAL VIEW";
            if (eyepieceCanvas) eyepieceCanvas.style.display = 'none';
            if (threeCanvas) threeCanvas.style.display = 'block';
            if (skySvgWrap) skySvgWrap.style.display = 'none';
            if (legend3d) legend3d.style.display = 'block';
            initThreeJS();
        } else {
            setActiveBtn(btnView2D);
            if (step2Title) step2Title.textContent = "LOCAL SKY — 2D PLANISPHERE";
            if (eyepieceCanvas) eyepieceCanvas.style.display = 'none';
            if (threeCanvas) threeCanvas.style.display = 'none';
            if (skySvgWrap) skySvgWrap.style.display = 'block';
            if (legend3d) legend3d.style.display = 'none';
        }
    }

    if (skyInfoBtn && skyTooltip) {
        skyInfoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = skyTooltip.classList.toggle('open');
            skyInfoBtn.classList.toggle('open', isOpen);
        });
    }

    const riskInfoBtn = document.getElementById('risk-info-btn');
    const riskTooltip = document.getElementById('risk-tooltip');
    if (riskInfoBtn && riskTooltip) {
        riskInfoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            riskTooltip.classList.toggle('open');
            riskInfoBtn.classList.toggle('open');
        });
    }

    document.addEventListener('click', () => {
        if (skyTooltip) skyTooltip.classList.remove('open');
        if (skyInfoBtn) skyInfoBtn.classList.remove('open');
        if (riskTooltip) riskTooltip.classList.remove('open');
        if (riskInfoBtn) riskInfoBtn.classList.remove('open');
    });

    // ── Hardware Config Binding ──────────────────────────────────────────
    function updateHardware() {
        if (!inFocalLength || !inPixelSize || !inAperture || !inHyperstar) return;
        const ap = parseFloat(inAperture.value) || 203.2;
        const hs = inHyperstar.checked;
        const ps = parseFloat(inPixelSize.value) || 3.76;
        
        let fl = parseFloat(inFocalLength.value) || 1420;
        if (hs) {
            fl = ap * 1.9;
            inFocalLength.value = fl.toFixed(0);
            inFocalLength.disabled = true;
            inFocalLength.style.opacity = '0.5';
        } else {
            inFocalLength.disabled = false;
            inFocalLength.style.opacity = '1';
        }

        window.ObserverAstro.setHardwareConfig({ 
            apertureMm: ap,
            hyperstarMode: hs,
            telescopeFocalLength: fl, 
            cameraPixelSize: ps 
        });
        
        const scale = (ps / fl) * 206.265;
        if (plateScaleDisp) plateScaleDisp.textContent = scale.toFixed(3);
    }

    if (inFocalLength && inPixelSize && inAperture && inHyperstar) {
        const cfg = window.ObserverAstro.getHardwareConfig();
        // Force SCT Standard if first run
        if (!localStorage.getItem('artemis_observer_hw')) {
            cfg.telescopeFocalLength = DEFAULT_FOCAL_LENGTH;
            cfg.cameraPixelSize      = DEFAULT_PIXEL_SIZE;
            cfg.apertureMm           = DEFAULT_APERTURE;
            window.ObserverAstro.setHardwareConfig(cfg);
        }

        inAperture.value = cfg.apertureMm;
        inHyperstar.checked = cfg.hyperstarMode;
        inFocalLength.value = cfg.telescopeFocalLength;
        inPixelSize.value = cfg.cameraPixelSize;
        updateHardware();

        inAperture.addEventListener('input', updateHardware);
        inHyperstar.addEventListener('change', updateHardware);
        inFocalLength.addEventListener('input', updateHardware);
        inPixelSize.addEventListener('input', updateHardware);
        if (inPlannedExp) inPlannedExp.addEventListener('input', updateHardware);
    }

    /**
     * PRO: Apply Hardware Preset
     */
    window.applyPreset = function(fl, ap) {
        if (inFocalLength) inFocalLength.value = fl;
        if (inAperture) inAperture.value = ap;
        // Hyperstar mode if fl is very short (e.g. 390mm)
        if (inHyperstar) inHyperstar.checked = (fl < 500);
        updateHardware();
    };

    // ── Stellarium Export ───────────────────────────────────────────────
    if (btnStellarium) {
        btnStellarium.addEventListener('click', () => {
            if (!isReady || !obsLat) {
                alert("Please enable location first.");
                return;
            }
            const nowMs = Date.now();
            const L_UTC = window.LAUNCH_UTC.getTime();
            const data = [];
            const STEP_MS = 20 * 60 * 1000;
            
            for (let i = 0; i < 72; i++) {
                const tMs = nowMs + i * STEP_MS;
                const met = (tMs - L_UTC) / 1000;
                const m = window.ObserverAstro.calculateMetrics(met, tMs, obsLat, obsLon, obsAlt);
                if (m) {
                    const jd = window.Astronomy.JulianDate(new Date(tMs));
                    data.push([
                        jd.toFixed(6),
                        m.orion.raHours.toFixed(6),
                        m.orion.decDeg.toFixed(6),
                        m.orion.shadowFactor
                    ]);
                }
            }

            const header = "// Orion — Artemis II Stellarium Observation Script\n" +
                           "// Generated: " + new Date().toISOString() + "\n" +
                           "// Format: [JulianDay, RA_decimal_hours, Dec_decimal_deg, is_sunlit_flag]\n" +
                           "// Lit Flag: 1.0=Sunlit, 0.5=Penumbra, 0.0=Umbra\n" +
                           "var artemis_telemetry = ";
            
            const content = header + JSON.stringify(data, null, 2) + ";\n\n" +
                            "function draw_path(data) {\n" + 
                            "  // Placeholder for Gano's Orion_Artemis_II_Library.inc draw_path logic\n" +
                            "  // Iterates through data array and creates visibility markers in Stellarium\n" +
                            "}\n";
            const blob = new Blob([content], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `artemisII_gano_v1_${new Date().toISOString().split('T')[0]}.inc`;
            a.click();
            URL.revokeObjectURL(url);
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
        if (locStatus)   { locStatus.textContent = `[${label}]`; }
    }

    function setLocationCleared() {
        if (locPrime)    locPrime.classList.remove('hidden');
        if (heroAwaiting) heroAwaiting.style.display = 'block';
        if (locStatus)   { locStatus.textContent = '[LOCATION REQUIRED]'; }
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

    // Set default label immediately — geolocation may override it
    setLocationResolved(`${DEFAULT_SITE_NAME} (${DEFAULT_LAT}°, ${DEFAULT_LON}°)`);

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
            // Geolocation denied — keep Canberra defaults, hide the priming strip
            console.warn('Geolocation denied — using Canberra DSN defaults.', err);
            if (locPrime) locPrime.classList.add('hidden');
            if (heroAwaiting) heroAwaiting.style.display = 'none';
        });
    } else {
        // No geolocation API — keep Canberra defaults silently
        if (locPrime) locPrime.classList.add('hidden');
        if (heroAwaiting) heroAwaiting.style.display = 'none';
    }

    // ── Cloud cover fetch (Open-Meteo, free, no API key) ────────────────
    async function fetchCloudCover(lat, lon) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=cloud_cover&forecast_days=1`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            return data.current?.cloud_cover ?? null;
        } catch {
            return null;
        }
    }

    // ── Elevation API fetch (open-elevation.com) ───────────────────────
    async function fetchElevation(lat, lon) {
        try {
            const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat.toFixed(6)},${lon.toFixed(6)}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data.results?.[0]?.elevation ?? null;
        } catch {
            return null;
        }
    }

    // ── Apply location with elevation ────────────────────────────────────
    async function applyLocation(lat, lon, elevOverride) {
        obsLat = lat;
        obsLon = lon;
        isReady = true;
        // Update input fields to reflect the applied values
        const inLatEl  = document.getElementById('in-lat');
        const inLonEl  = document.getElementById('in-lon');
        const inElevEl = document.getElementById('in-elev');
        if (inLatEl)  inLatEl.value  = lat.toFixed(6);
        if (inLonEl)  inLonEl.value  = lon.toFixed(6);
        // Show syncing if we need to fetch elevation
        const statusEl = document.getElementById('ui-loc-status');
        if (elevOverride != null) {
            obsAlt = elevOverride;
            if (inElevEl) inElevEl.value = Math.round(elevOverride);
        } else {
            if (statusEl) { statusEl.textContent = 'SYNCING ELEVATION...'; statusEl.style.color = '#ffa726'; }
            const elev = await fetchElevation(lat, lon);
            if (elev != null) {
                obsAlt = elev;
                if (inElevEl) inElevEl.value = Math.round(elev);
            }
        }
        // Update thin-atmosphere badge
        updateElevBadge(obsAlt);
        // Fetch cloud cover in background (non-blocking)
        fetchCloudCover(lat, lon).then(cc => {
            if (cc != null) {
                cloudCoverPct = cc;
                updateCloudVerdict(cc);
            }
        });
        // Trigger immediate redraw
        coverageCountdown = 1;
        windowScanCountdown = 0;
        // Update location label
        setLocationResolved(`LAT: ${lat.toFixed(4)}° / LON: ${lon.toFixed(4)}° / ${Math.round(obsAlt)}m`);
        const place = await getPlaceName(lat, lon);
        if (place) {
            setLocationResolved(`${place}  (${lat.toFixed(2)}°, ${lon.toFixed(2)}°) ${Math.round(obsAlt)}m`);
        }
    }

    function updateElevBadge(alt) {
        const badge = document.getElementById('elev-badge');
        if (badge) badge.style.display = (alt > 1000) ? 'block' : 'none';
    }
    // set initial badge state
    updateElevBadge(obsAlt);

    function updateCloudVerdict(cc) {
        const el    = document.getElementById('vc-weather-main');
        const det   = document.getElementById('vc-weather-detail');
        const card  = document.getElementById('vc-weather');
        const icon  = document.getElementById('vc-weather-icon');
        if (!el) return;
        let main, detail, cls, cardCls, ico;
        if (cc < 20)  { main='SKY CLEAR'; detail=`Cloud cover: ${cc}% — excellent transparency for imaging.`; cls='green'; cardCls='green-card'; ico='✅'; }
        else if(cc < 60){ main='PARTLY CLOUDY'; detail=`Cloud cover: ${cc}% — patchy cloud may interrupt imaging.`; cls='amber'; cardCls='amber-card'; ico='🌤'; }
        else           { main='OBSCURED — NO-GO'; detail=`Cloud cover: ${cc}% — heavy cloud, imaging not possible tonight.`; cls='red'; cardCls='red-card'; ico='⛅'; }
        el.textContent  = main; el.className = 'verdict-main ' + cls;
        if (det)  det.textContent  = detail;
        if (card) card.className   = 'verdict-card ' + cardCls;
        if (icon) icon.textContent = ico;
    }
    // Try to fetch on load with default location
    fetchCloudCover(DEFAULT_LAT, DEFAULT_LON).then(cc => {
        if (cc != null) { cloudCoverPct = cc; updateCloudVerdict(cc); }
    });

    // ── Wire in-elev input to obsAlt live ───────────────────────────────
    const inElevEl = document.getElementById('in-elev');
    if (inElevEl) {
        inElevEl.addEventListener('change', () => {
            const v = parseFloat(inElevEl.value);
            if (!isNaN(v)) { obsAlt = v; updateElevBadge(v); }
        });
    }

    // Manual Entry bind
    document.getElementById('btn-apply-loc').addEventListener('click', async () => {
        const latVal  = parseFloat(document.getElementById('in-lat').value);
        const lonVal  = parseFloat(document.getElementById('in-lon').value);
        const elevVal = parseFloat(document.getElementById('in-elev')?.value);
        if (!isNaN(latVal) && !isNaN(lonVal)) {
            const elevOverride = !isNaN(elevVal) ? elevVal : null;
            await applyLocation(latVal, lonVal, elevOverride);
        }
    });

    document.getElementById('btn-clear-loc').addEventListener('click', () => {
        document.getElementById('in-lat').value  = '';
        document.getElementById('in-lon').value  = '';
        const inElevClear = document.getElementById('in-elev');
        if (inElevClear) inElevClear.value = '';
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
            if (winPanel) winPanel.innerHTML = '<div style="opacity:0.5; font-size:0.65rem; text-align:center;">NO VISIBLE PASSES IN NEXT 7 DAYS</div>';
            return;
        }
        const w = wins[0];
        const nowMs = Date.now();
        const diffMs = w.startMs - nowMs;
        const inHours = Math.floor(diffMs / 3600000);
        const inMins  = Math.floor((diffMs % 3600000) / 60000);
        const countStr = diffMs > 0 ? ` (in ${inHours > 0 ? inHours + 'h ' : ''}${inMins}m)` : ' (NOW)';
        locNextPass.textContent = `NEXT PASS: ${fmtLocalTime(w.startMs)}${countStr} • Peak ${w.peakAlt.toFixed(0)}°`;

        // Weather badge helper
        const cc = cloudCoverPct;
        function wxBadge() {
            if (cc == null) return '';
            if (cc < 20)  return '<span style="color:#00e676;font-size:0.5rem;padding:2px 6px;background:rgba(0,230,118,0.1);border:1px solid rgba(0,230,118,0.3);border-radius:3px;">SKY CLEAR</span>';
            if (cc < 60)  return '<span style="color:#ffa726;font-size:0.5rem;padding:2px 6px;background:rgba(255,167,38,0.1);border:1px solid rgba(255,167,38,0.3);border-radius:3px;">PARTLY CLOUDY</span>';
            return '<span style="color:#ef5350;font-size:0.5rem;padding:2px 6px;background:rgba(239,83,80,0.1);border:1px solid rgba(239,83,80,0.3);border-radius:3px;">OBSCURED</span>';
        }

        if (winPanel) {
            winPanel.innerHTML = wins.map((win, idx) => {
                const daysAhead = Math.floor((win.startMs - nowMs) / 86400000);
                const dayLabel = daysAhead === 0 ? 'TODAY' : daysAhead === 1 ? 'TOMORROW' : `IN ${daysAhead}D`;
                return `
                <div class="win-card">
                    <div class="wc-badge">
                        <div class="wc-rank">#${idx + 1}</div>
                        <div class="wc-num">${win.peakAlt.toFixed(0)}&deg;</div>
                        <div style="font-size:0.38rem;color:#4A90D9;">PEAK ALT</div>
                    </div>
                    <div class="wc-body">
                        <div class="wc-time">${dayLabel} • ${fmtLocalTime(win.startMs)}</div>
                        <div class="wc-detail">
                            ${new Date(win.startMs).toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})}
                            &nbsp;•&nbsp; Duration: ${fmtDuration(win.endMs - win.startMs)}
                        </div>
                        <div style="margin-top:4px;display:flex;align-items:center;gap:6px;">
                            ${win.peakMag != null ? `<span style="font-size:0.52rem;color:#aaa;">Mag ${win.peakMag.toFixed(1)}</span>` : ''}
                            ${wxBadge()}
                        </div>
                    </div>
                    <div class="wc-peak">
                        <div class="wc-peak-label">MAG</div>
                        <div class="wc-peak-val">${win.peakMag != null ? win.peakMag.toFixed(1) : '—'}</div>
                    </div>
                </div>
                `;
            }).join('');
        }

        // PRO: Exposure Start Logic (NextPass - 45s)
        if (expStartDisp) {
            const expStartMs = w.startMs - 45000;
            if (expStartMs > nowMs) {
                const diffExp = expStartMs - nowMs;
                const mExp = Math.floor(diffExp / 60000);
                const sExp = Math.floor((diffExp % 60000) / 1000);
                expStartDisp.textContent = `IN ${mExp}m ${sExp}s`;
            } else if (nowMs < w.endMs) {
                expStartDisp.textContent = "OPEN SHUTTER NOW";
                expStartDisp.style.color = "#00e676";
            } else {
                expStartDisp.textContent = "PASS ENDED";
                expStartDisp.style.color = "#ef5350";
            }
        }
    }

    // SVG Sky Plot — Planisphere with dashed rings, degree labels, zenith marker
    function drawPlot(o, alt, az, metSec, nowMs, moonAlt, moonAz) {
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
        const shadow = o && o.shadowFactor < 1.0; // Umbra or Penumbra
        
        let dotColor = "#00ffaa"; // Default Visible/Sunlit
        let dotOp = "1";
        
        if (shadow) {
            dotColor = "#ef5350"; // Dark Red for shadow
            dotOp = alt >= 0 ? "1" : "0.4";
        } else if (alt < 0) {
            dotColor = "#7986a8"; // Faded Grey for below horizon
            dotOp = "0.4";
        }

        if (alt >= 0 || shadow) {
            const r  = alt >= 0 ? ((90 - alt) / 90) * R : R;
            const px = 50 + r * Math.cos(radNow);
            const py = 50 + r * Math.sin(radNow);
            svg += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="2.5" fill="${dotColor}" opacity="${dotOp}" filter="drop-shadow(0 0 3px ${dotColor})"/>`;
            const lX = Math.min(96, Math.max(3, px + 3.5));
            const lY = Math.min(97, Math.max(3, py - 3));
            svg += `<text x="${lX.toFixed(1)}" y="${lY.toFixed(1)}" font-size="3.5" fill="${dotColor}" opacity="${dotOp}" text-anchor="start">Orion</text>`;
        }

        svg += `</svg>`;
        const skySvgWrap = document.getElementById('sky-svg-wrap');
        if (skySvgWrap) skySvgWrap.innerHTML = svg;
    }

    // UI Ticker
    function tick() {
        if (!isReady || !window.MissionEphemeris || !window.MissionEphemeris.points) {
            return;
        }

        const nowMs = Date.now();
        // Fallback robust metSec calculation
        const L_UTC = (window.LAUNCH_UTC && window.LAUNCH_UTC.getTime) ? window.LAUNCH_UTC.getTime() : 0;
        const metSec = (nowMs - L_UTC) / 1000;

        let m;
        try {
            m = window.ObserverAstro.calculateMetrics(metSec, nowMs, obsLat, obsLon, obsAlt);
        } catch(err) {
            console.error('[tick] calculateMetrics crashed:', err);
            return;
        }

        if (!m) {
            handleNoData();
            return;
        }

        o = m.orion;
        window.o = o; // expose for console debugging
        let isVis = false;
        
        // Sun elevation & Shadow state
        const ds = window.ObserverAstro.getDarkState(m.sun.altitude);
        darkState.textContent = ds.label + (ds.subLabel ? ` — ${ds.subLabel}` : "");
        darkState.style.color = ds.optimal ? "#00e676" : (m.sun.altitude > -0.83 ? "#ff5050" : "#4A90D9");

        // Force Shadow state if applicable
        let shadowForced = false;
        if (o.shadowState === 'umbra') {
            darkState.textContent = "SPACECRAFT IN TOTAL SHADOW";
            darkState.style.color = "#ef5350";
            shadowForced = true;
        } else if (o.shadowState === 'penumbra') {
            darkState.textContent = "SPACECRAFT IN PARTIAL SHADOW";
            darkState.style.color = "#ffa726";
        }

        // Target altitude chip + summary panel state
        if (o.altitude > 0 && !shadowForced) {
            isVis = true;
            visChip.textContent = "ABOVE HORIZON";
            visChip.className = "vis-chip";
            if (summaryPanel) summaryPanel.classList.add('obs-visible');
        } else {
            visChip.textContent = shadowForced ? "NOT VISIBLE" : "BELOW HORIZON";
            visChip.className = "vis-chip below";
            if (summaryPanel) summaryPanel.classList.remove('obs-visible');
        }

        // Paint Pointing & Mag
        if (magDisp) {
            let magVal = o.magnitude != null ? o.magnitude.toFixed(1) : "—";
            if (o.glintPotential) {
                magVal += ' <span style="font-size:0.55rem; color:#ffa726; vertical-align:middle;">[GLINT POTENTIAL]</span>';
            }
            magDisp.innerHTML = magVal;
        }

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
        if (distDisp) {
            const ld = o.distanceKm / 384400.0;
            distDisp.textContent = Math.round(o.distanceKm).toLocaleString() + " KM / " + ld.toFixed(2) + " LD";
        }
        rateDisp.textContent = o.angularSpeedDegMin != null ? o.angularSpeedDegMin.toFixed(4) + " °/min" : "—";

        // SVG plotting — dispatch to 2D, 3D, or Eyepiece
        if (useEyepiece) {
            updateEyepiece(o.raHours, o.decDeg, o.altitude);
        } else if (use3D) {
            updateThreeJS(metSec, o);
            // Fallback SVG dome if needed or just skip it
            // draw3DDome(o, o.altitude, o.azimuth, m.moon.altitude, m.moon.azimuth);
        } else {
            drawPlot(o, o.altitude, o.azimuth, metSec, nowMs, m.moon.altitude, m.moon.azimuth);
        }

        // Imaging Assist
        if (o.angularSpeedDegMin != null) {
            const img = window.ObserverAstro.calculateImagingAssistance(o.angularSpeedDegMin, o.magnitude);
            if (trackRateDisp)  trackRateDisp.textContent  = img.trackRateArcsecSec.toFixed(3);
            if (maxExpDisp)     maxExpDisp.textContent      = img.maxExpSec != null ? img.maxExpSec.toFixed(1) + ' s' : '—';
            if (difficultyDisp) difficultyDisp.textContent  = img.difficultyLabel;
            if (pixelSpanDisp)  pixelSpanDisp.textContent   = o.pixelSpan != null && o.pixelSpan > 0 ? o.pixelSpan.toFixed(2) : (o.pixelSpan === 0 ? "Below Floor" : "—");
            
            // Warn if planned exposure > max calculated exposure
            if (inPlannedExp && img.maxExpSec != null) {
                const plan = parseFloat(inPlannedExp.value) || 0;
                if (plan > img.maxExpSec) {
                    maxExpDisp.style.color = "#ef5350";
                    maxExpDisp.title = "EXPOSURE TOO LONG — WILL CAUSE SMEARING";
                } else {
                    maxExpDisp.style.color = "#ffa726";
                    maxExpDisp.title = "";
                }
            }

            // PRO: Confidence Label
            if (confidenceDisp) {
                const conf = window.ObserverAstro.calculateDetectionConfidence(o.pixelSpan);
                confidenceDisp.textContent = conf.toUpperCase();
                confidenceDisp.style.color = (conf === 'High') ? '#00e676' : (conf === 'Moderate' ? '#ffa726' : '#ef5350');
            }
        }

        // Viewing Windows — scan once per minute (throttled)
        windowScanCountdown--;
        if (windowScanCountdown <= 0) {
            windowScanCountdown = 60;
            const wins = window.ObserverAstro.calculateViewingWindows(obsLat, obsLon, nowMs, metSec, obsAlt);
            renderWindows(wins);
            updateGlobalHeatmap(metSec, nowMs);
        }
        
        updateMissionTimeline(metSec);

        // ── Mission Map overlay stat updates ──────────────────────────
        if (mapDist && o.distanceKm) {
            mapDist.textContent = Math.round(o.distanceKm).toLocaleString() + ' km';
        }
        if (mapVel && window.MissionEphemeris) {
            const st = window.MissionEphemeris.getState(metSec);
            if (st && st.orion) {
                const spd = Math.sqrt(st.orion.vx**2 + st.orion.vy**2 + st.orion.vz**2);
                mapVel.textContent = spd.toFixed(2) + ' km/s';
            }
        }
        if (mapShadow && o.shadowState) {
            const shadowLabels = { sunlit: 'SUNLIT', penumbra: 'PENUMBRA', umbra: 'UMBRA' };
            mapShadow.textContent = shadowLabels[o.shadowState] || o.shadowState.toUpperCase();
            mapShadow.style.color = o.shadowState === 'umbra' ? '#ef5350' : (o.shadowState === 'penumbra' ? '#ffa726' : '#00e676');
        }

        // Update mission map 3D if running
        updateMissionMap(metSec, o);

        // ── GUIDED HUD & VERDICTS ──────────────────────────────────────
        updateGuidedHUD(m, o);

        // ── GLOBAL COVERAGE MAP (throttled every 15s) ─────────────────
        coverageCountdown--;
        if (coverageCountdown <= 0) {
            coverageCountdown = 15;
            drawCoverageMap(m, o, metSec, nowMs);
        }
    }

    let coverageCountdown = 1; // fire on first tick

    // ── Global Coverage Map ────────────────────────────────────────────
    // Simplified continent polygons [lon, lat] — recognisable equirectangular outline
    const COV_LANDS = [
        // North America
        [[-168,71],[-141,60],[-128,50],[-118,34],[-97,26],[-88,16],[-83,10],[-77,8],
         [-62,11],[-67,47],[-83,43],[-76,44],[-63,46],[-55,46],[-57,51],[-65,62],[-86,68],[-142,70]],
        // South America
        [[-76,12],[-60,11],[-50,4],[-35,-5],[-35,-12],[-38,-15],[-40,-22],[-44,-24],
         [-50,-30],[-52,-34],[-57,-34],[-63,-38],[-66,-44],[-66,-55],[-70,-51],[-70,-18],[-75,-10],[-78,0]],
        // Greenland
        [[-44,60],[-22,70],[-18,74],[-42,84],[-66,82],[-66,72],[-46,66]],
        // Europe (simplified)
        [[-10,36],[3,52],[8,58],[14,57],[26,65],[18,70],[14,57],[28,57],[38,42],
         [36,42],[32,36],[27,37],[20,38],[14,38],[3,44],[0,44],[-2,36],[-10,36]],
        // Africa + attached middle-east
        [[-5,36],[10,36],[32,30],[37,12],[44,10],[51,12],[44,0],[40,-12],
         [36,-22],[32,-30],[25,-34],[18,-34],[14,-28],[8,-5],[0,5],[-16,5],[-18,10],[-10,36]],
        // Asia (merged Eurasia east)
        [[28,42],[44,43],[50,42],[58,37],[62,24],[62,22],[78,8],[80,14],[80,28],
         [88,22],[96,6],[104,1],[104,5],[110,12],[110,18],[121,24],[122,38],
         [130,35],[131,34],[130,32],[120,24],[110,20],[100,5],[96,6],[88,22],
         [80,28],[72,22],[62,22],[56,26],[50,28],[44,36],[40,28],[36,36],[28,42]],
        // Japan
        [[130,31],[131,34],[136,38],[141,43],[145,44],[140,38],[135,34],[130,31]],
        // Australia
        [[116,-22],[120,-34],[128,-34],[135,-34],[140,-38],[148,-38],
         [152,-24],[148,-18],[136,-12],[130,-8],[122,-18],[116,-22]],
        // New Zealand
        [[166,-46],[170,-46],[172,-36],[166,-36],[166,-46]],
    ];

    function drawCoverageMap(m, or, metSec, nowMs) {
        const canvas = document.getElementById('coverage-canvas');
        if (!canvas || !window.Astronomy) return;
        const W = canvas.clientWidth || 600;
        const H = canvas.clientHeight || 280;
        if (canvas.width !== W) canvas.width = W;
        if (canvas.height !== H) canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Coordinate helpers
        function tx(lon) { return (lon + 180) / 360 * W; }
        function ty(lat) { return (90 - lat) / 180 * H; }

        // Draw a [lon,lat][] polygon, skipping anti-meridian jumps
        function drawPath(pts, close) {
            if (!pts || pts.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(tx(pts[0][0]), ty(pts[0][1]));
            for (let i = 1; i < pts.length; i++) {
                if (Math.abs(pts[i][0] - pts[i-1][0]) > 180) {
                    ctx.moveTo(tx(pts[i][0]), ty(pts[i][1]));
                } else {
                    ctx.lineTo(tx(pts[i][0]), ty(pts[i][1]));
                }
            }
            if (close) ctx.closePath();
        }

        // ── 1. Background: Blue Marble or fallback ocean ─────────────
        ctx.fillStyle = '#020c1e';
        ctx.fillRect(0, 0, W, H);
        const hasBM = coverageBluemarble && coverageBluemarble.complete && coverageBluemarble.naturalWidth > 0;
        if (hasBM) {
            // Draw with slight darkening overlay for better contrast
            ctx.globalAlpha = 0.85;
            ctx.drawImage(coverageBluemarble, 0, 0, W, H);
            ctx.globalAlpha = 1;
        }

        // Grid lines (subtle — visible over the texture)
        ctx.strokeStyle = hasBM ? 'rgba(255,255,255,0.08)' : 'rgba(0,229,255,0.06)';
        ctx.lineWidth = 0.5;
        for (let lon = -180; lon <= 180; lon += 30) {
            ctx.beginPath(); ctx.moveTo(tx(lon), 0); ctx.lineTo(tx(lon), H); ctx.stroke();
        }
        for (let lat = -90; lat <= 90; lat += 30) {
            ctx.beginPath(); ctx.moveTo(0, ty(lat)); ctx.lineTo(W, ty(lat)); ctx.stroke();
        }
        // Equator & Prime Meridian
        ctx.strokeStyle = hasBM ? 'rgba(255,255,255,0.18)' : 'rgba(0,229,255,0.15)';
        ctx.beginPath(); ctx.moveTo(0, ty(0)); ctx.lineTo(W, ty(0)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx(0), 0); ctx.lineTo(tx(0), H); ctx.stroke();

        // ── 2. Continent fills (only if no Blue Marble) ──────────────
        if (!hasBM) {
            ctx.fillStyle = 'rgba(30,60,100,0.45)';
            ctx.strokeStyle = 'rgba(80,140,200,0.35)';
            ctx.lineWidth = 0.7;
            for (const land of COV_LANDS) {
                drawPath(land, true);
                ctx.fill();
                ctx.stroke();
            }
        }

        // ── 3. Day/Night terminator & night shading ──────────────────
        const date = new Date(nowMs);
        const gmstDeg = ((window.Astronomy.SiderealTime(date) * 15) % 360 + 360) % 360;
        // Sun SSP
        const sunVec = window.Astronomy.GeoVector('Sun', date, true);
        const sunEq  = window.Astronomy.EquatorFromVector(sunVec);
        const sunRaDeg  = sunEq.ra * 15;
        const sunDecDeg = sunEq.dec;
        let sunLon = ((sunRaDeg - gmstDeg) % 360 + 360) % 360;
        if (sunLon > 180) sunLon -= 360;
        const sunLat = sunDecDeg;

        // ── 4. Orion current SSP (Position) ──────────────────────────
        const st = window.MissionEphemeris.getState(metSec);
        let sspLat = 0, sspLon = 0;
        if (st && st.orion) {
            const { x, y, z } = st.orion;
            const r = Math.sqrt(x*x + y*y + z*z);
            sspLat = Math.asin(Math.max(-1, Math.min(1, z / r))) * 180 / Math.PI;
            const ra = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
            sspLon = ((ra - gmstDeg) % 360 + 360) % 360;
            if (sspLon > 180) sspLon -= 360; // NORMALIZE SSP LON to fix "2 Orions" ghosting
        }

        // Terminator: for each lon, lat = atan(-cos(lon-sunLon)/tan(sunLat))
        function termLat(lon) {
            const sl = Math.abs(sunLat) < 0.5 ? (sunLat >= 0 ? 0.5 : -0.5) : sunLat;
            const dLon = (lon - sunLon) * Math.PI / 180;
            return Math.atan(-Math.cos(dLon) / Math.tan(sl * Math.PI / 180)) * 180 / Math.PI;
        }

        // Build terminator polyline (left to right)
        const termPts = [];
        for (let lon = -180; lon <= 181; lon++) {
            const lat = Math.max(-90, Math.min(90, termLat(lon)));
            termPts.push([Math.min(lon, 180), lat]);
        }

        // Night polygon: below terminator wave + the pole opposite to sun
        ctx.beginPath();
        ctx.moveTo(tx(termPts[0][0]), ty(termPts[0][1]));
        for (const [ln, lt] of termPts) ctx.lineTo(tx(ln), ty(lt));
        if (sunLat >= 0) {
            ctx.lineTo(tx(180), ty(-90)); ctx.lineTo(tx(-180), ty(-90));
        } else {
            ctx.lineTo(tx(180), ty(90)); ctx.lineTo(tx(-180), ty(90));
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,3,18,0.62)';
        ctx.fill();

        // Terminator line
        drawPath(termPts, false);
        ctx.strokeStyle = 'rgba(255,200,80,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // ── 4. Orion SSP & visibility footprint ─────────────────────
        // (sspLon/sspLat already calculated above with normalization)

        // Great-circle footprint: radius = 90° (visible when < 90° from SSP)
        const phi0 = sspLat * Math.PI / 180;
        const lam0 = sspLon * Math.PI / 180;
        const footPts = [];
        const STEPS = 180;
        for (let i = 0; i <= STEPS; i++) {
            const bear = (2 * Math.PI * i) / STEPS;
            // With r = π/2: sin(lat) = cos(phi0)*cos(bear)
            const phi = Math.asin(Math.max(-1, Math.min(1, Math.cos(phi0) * Math.cos(bear))));
            const lam = lam0 + Math.atan2(Math.sin(bear) * Math.cos(phi0),
                                          -Math.sin(phi0) * Math.sin(phi));
            let fLon = lam * 180 / Math.PI;
            fLon = ((fLon + 180) % 360 + 360) % 360 - 180;
            footPts.push([fLon, phi * 180 / Math.PI]);
        }

        // Fill footprint (semi-transparent)
        ctx.fillStyle = 'rgba(0,229,255,0.07)';
        drawPath(footPts, true);
        ctx.fill();
        // Footprint border
        ctx.strokeStyle = 'rgba(0,229,255,0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        drawPath(footPts, false);
        ctx.stroke();
        ctx.setLineDash([]);

        // ── 5. Ground track (4 hours ahead, 15-min steps) ────────────
        if (window.MissionEphemeris) {
            const trackPts = [];
            for (let step = 0; step <= 16; step++) {
                const dt   = step * 15 * 60;          // seconds
                const fMs  = nowMs + dt * 1000;
                const fMet = metSec + dt;
                const fDate = new Date(fMs);
                const st = window.MissionEphemeris.getState(fMet);
                if (!st || !st.orion) continue;
                const { x, y, z } = st.orion;
                const r   = Math.sqrt(x*x + y*y + z*z);
                const dec = Math.asin(Math.max(-1, Math.min(1, z / r))) * 180 / Math.PI;
                const ra  = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
                const fGmst = ((window.Astronomy.SiderealTime(fDate) * 15) % 360 + 360) % 360;
                let tLon = ((ra - fGmst) % 360 + 360) % 360;
                if (tLon > 180) tLon -= 360;
                trackPts.push([tLon, dec, step]);
            }
            // Draw track as dashed line (handle anti-meridian)
            ctx.strokeStyle = '#ffcc00'; // Orange = Path
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 5]);
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < trackPts.length; i++) {
                const [ln, lt] = trackPts[i];
                const cx = tx(ln), cy = ty(lt);
                if (!started) { ctx.moveTo(cx, cy); started = true; }
                else if (i > 0 && Math.abs(ln - trackPts[i-1][0]) > 180) {
                    ctx.moveTo(cx, cy); // anti-meridian jump
                } else { ctx.lineTo(cx, cy); }
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Fade dots along track (future positions)
            for (let i = 1; i < trackPts.length; i++) {
                const alpha = 0.15 + (1 - i / trackPts.length) * 0.35;
                ctx.beginPath();
                ctx.arc(tx(trackPts[i][0]), ty(trackPts[i][1]), 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,204,0,${alpha})`; // Orange dots for path
                ctx.fill();
            }
        }

        // ── 6. Orion SSP marker (Orange Dot) ───────────────────────
        const sx = tx(sspLon), sy = ty(sspLat);
        // Outer glow
        ctx.beginPath();
        const pulse = 6 + Math.sin(Date.now() * 0.004) * 2;
        ctx.arc(sx, sy, pulse + 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,204,0,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Solid Cyan dot
        ctx.beginPath();
        ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#00e5ff'; // Cyan = Position
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Label
        ctx.fillStyle = '#00e5ff';
        ctx.font = `bold ${Math.round(W * 0.018)}px "Orbitron", sans-serif`;
        ctx.fillText('ORION (SSP)', sx + 8, sy - 5);

        // ── 7. Your Location (Blue Dot) ───────────────────────────
        const ux = tx(obsLon), uy = ty(obsLat);
        ctx.beginPath();
        ctx.arc(ux, uy, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#4A90D9'; // Blue = You (Site)
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // Label
        ctx.fillStyle = '#4A90D9';
        ctx.font = `bold ${Math.round(W * 0.016)}px "Orbitron", sans-serif`;
        ctx.fillText('YOU', ux + 8, uy + 12);

        // HUD update: Line of Sight and SSP labels
        const phi1 = obsLat * Math.PI / 180, phi2 = sspLat * Math.PI / 180;
        const dLam = (obsLon - sspLon) * Math.PI / 180;
        const cosAngle = Math.sin(phi1)*Math.sin(phi2) + Math.cos(phi1)*Math.cos(phi2)*Math.cos(dLam);
        const hasLOS = cosAngle > 0;

        const losEl = document.getElementById('cov-los');
        if (losEl) {
            losEl.textContent = hasLOS ? '✓ YES' : '✗ NO';
            losEl.style.color   = hasLOS ? '#00e676' : '#ef5350';
        }
        const sspEl = document.getElementById('cov-ssp');
        if (sspEl) {
            const latDir = sspLat >= 0 ? 'N' : 'S';
            const lonDir = sspLon >= 0 ? 'E' : 'W';
            sspEl.textContent = `${Math.abs(sspLat).toFixed(1)}°${latDir}  ${Math.abs(sspLon).toFixed(1)}°${lonDir}`;
        }

        // ── 8. Border ────────────────────────────────────────────────
        ctx.strokeStyle = 'rgba(0,229,255,0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, W, H);
    }

    // ── Guided HUD updater ─────────────────────────────────────────────
    function azToDirection(az) {
        const dirs = ['North','NNE','NE','ENE','East','ESE','SE','SSE',
                      'South','SSW','SW','WSW','West','WNW','NW','NNW'];
        return dirs[Math.round(az / 22.5) % 16];
    }

    function updateGuidedHUD(m, or) {
        const isAbove  = or.altitude > 0;
        const isSunlit = or.shadowState === 'sunlit' || or.shadowState === 'penumbra';
        const isVis    = isAbove && isSunlit;

        // ── HUD status chip ──────────────────────────────────────────
        const hudStatusVal = document.getElementById('hud-status-val');
        const hudStatusSub = document.getElementById('hud-status-sub');
        if (hudStatusVal) {
            if (!isAbove) {
                hudStatusVal.textContent = 'BELOW HORIZON';
                hudStatusVal.className = 'hud-val red';
                if (hudStatusSub) { hudStatusSub.textContent = `${Math.abs(or.altitude).toFixed(1)}° below`; }
            } else if (!isSunlit) {
                hudStatusVal.textContent = 'IN SHADOW';
                hudStatusVal.className = 'hud-val amber';
                if (hudStatusSub) { hudStatusSub.textContent = or.shadowState.toUpperCase(); }
            } else {
                hudStatusVal.textContent = 'VISIBLE NOW';
                hudStatusVal.className = 'hud-val green';
                if (hudStatusSub) { hudStatusSub.textContent = `${or.altitude.toFixed(1)}° altitude`; }
            }
        }

        // ── HUD pointing ──────────────────────────────────────────────
        const hudAlt = document.getElementById('hud-alt');
        const hudDir = document.getElementById('hud-dir');
        if (hudAlt) hudAlt.textContent = or.altitude.toFixed(1) + '°';
        if (hudDir && or.azimuth != null) {
            const dir = azToDirection(or.azimuth);
            hudDir.textContent = `${dir} (${or.azimuth.toFixed(0)}°)`;
        }

        // ── HUD RA/Dec ────────────────────────────────────────────────
        const hudRa  = document.getElementById('hud-ra');
        const hudDec = document.getElementById('hud-dec');
        if (hudRa)  hudRa.textContent  = hoursToHms(or.raHours);
        if (hudDec) hudDec.textContent = degToDms(or.decDeg);

        // ── HUD Distance ──────────────────────────────────────────────
        const hudDist    = document.getElementById('hud-dist');
        const hudDistSub = document.getElementById('hud-dist-sub');
        if (hudDist && or.distanceKm) {
            const ld = or.distanceKm / 384400;
            hudDist.textContent = Math.round(or.distanceKm).toLocaleString() + ' km';
            if (hudDistSub) hudDistSub.textContent = ld.toFixed(3) + ' lunar distances';
        }

        // ── Resolution summary ────────────────────────────────────────
        const resEl    = document.getElementById('ui-res-arcsec');
        const badgeEl  = document.getElementById('ui-res-badge');
        const confEl   = document.getElementById('ui-confidence');
        if (or.angularSpeedDegMin != null && confidenceDisp) {
            const conf = window.ObserverAstro.calculateDetectionConfidence(or.pixelSpan);
            if (confEl)   { confEl.textContent = conf; confEl.style.color = conf === 'High' ? '#00e676' : (conf === 'Moderate' ? '#ffa726' : '#ef5350'); }
        }
        if (plateScaleDisp && resEl) resEl.textContent = plateScaleDisp.textContent || '—';
        if (badgeEl && confidenceDisp) {
            const confText = confidenceDisp.textContent || '';
            badgeEl.textContent = confText.toUpperCase();
            badgeEl.className = 'res-badge ' + (confText === 'High' ? 'optimal' : confText === 'Moderate' ? 'good' : 'poor');
        }

        // ── Verdict: VISIBILITY ───────────────────────────────────────
        const vcVisMain   = document.getElementById('vc-vis-main');
        const vcVisDet    = document.getElementById('vc-vis-detail');
        const vcVisIcon   = document.getElementById('vc-vis-icon');
        const vcVisCard   = document.getElementById('vc-visibility');
        if (vcVisMain) {
            if (!isAbove) {
                vcVisMain.textContent = 'BELOW THE HORIZON';
                vcVisMain.className   = 'verdict-main status-red';
                if (vcVisDet)  vcVisDet.textContent  = `Set by ${Math.abs(or.altitude).toFixed(1)}°. Spacecraft is currently obstructed by the Earth.`;
                if (vcVisIcon) vcVisIcon.textContent  = '🌑';
                if (vcVisCard) vcVisCard.className     = 'verdict-card red-card';
            } else if (or.shadowState === 'umbra') {
                vcVisMain.textContent = 'IN SHADOW — NO SUNLIGHT';
                vcVisMain.className   = 'verdict-main status-red';
                if (vcVisDet)  vcVisDet.textContent  = 'Orion is in the Earth\'s shadow. It reflects no sunlight and is effectively invisible to optical telescopes.';
                if (vcVisIcon) vcVisIcon.textContent  = '🌑';
                if (vcVisCard) vcVisCard.className     = 'verdict-card red-card';
            } else {
                vcVisMain.textContent = 'SUNLIT — OPTIMAL VIEW';
                vcVisMain.className   = 'verdict-main status-green';
                if (vcVisDet)  vcVisDet.textContent  = `Spacecraft is sunlit and ${or.altitude.toFixed(1)}° high. Direct optical observation is possible.`;
                if (vcVisIcon) vcVisIcon.textContent  = '☀️';
                if (vcVisCard) vcVisCard.className     = 'verdict-card green-card';
            }
        }

        // ── Verdict: MAGNITUDE ────────────────────────────────────────
        const magBig    = document.getElementById('mag-big');
        const vcMagMain = document.getElementById('vc-mag-main');
        const vcMagDet  = document.getElementById('vc-mag-detail');
        const vcBright  = document.getElementById('vc-brightness');
        if (magBig && or.magnitude != null) {
            const mag = or.magnitude;
            magBig.textContent = mag.toFixed(1);
            let magMain, magDet, magClass, cardClass;
            if (mag < 7) {
                magMain = 'NAKED EYE VISIBLE'; magClass = 'green'; cardClass = 'green-card';
                magDet  = `Bright enough to see without any optics on a dark night. Binoculars will show it easily.`;
            } else if (mag < 11) {
                magMain = 'BINOCULARS NEEDED'; magClass = 'amber'; cardClass = 'amber-card';
                magDet  = `Too faint for naked eye but visible with 7×50 binoculars on a dark night.`;
            } else if (mag < 13) {
                magMain = 'SMALL TELESCOPE NEEDED'; magClass = 'amber'; cardClass = 'amber-card';
                magDet  = `Requires a 100–200mm telescope in dark skies. Use short exposures.`;
            } else {
                magMain = 'OBJECT IS FAINT (Requires Telescope)'; magClass = 'red'; cardClass = 'amber-card';
                magDet  = `Magnitude ${mag.toFixed(1)} — requires a 200mm+ telescope with camera. Camera stacking recommended.`;
            }
            if (vcMagMain) { vcMagMain.textContent = magMain; vcMagMain.className = 'verdict-main ' + magClass; }
            if (vcMagDet)  vcMagDet.textContent  = magDet;
            if (vcBright)  vcBright.className    = 'verdict-card ' + cardClass;
            magBig.style.color = magClass === 'green' ? '#00e676' : magClass === 'amber' ? '#ffcc00' : '#ef5350';
        }

        // ── Verdict: SKY CONDITIONS ───────────────────────────────────
        const vcSkyMain = document.getElementById('vc-sky-main');
        const vcSkyDet  = document.getElementById('vc-sky-detail');
        const vcSkyIcon = document.getElementById('vc-sky-icon');
        const vcSkyCard = document.getElementById('vc-sky');
        if (vcSkyMain && m.sun) {
            const sunAlt = m.sun.altitude;
            let skyMain, skyDet, skyClass, skyIcon, skyCard;
            // logic: Red if Sun Alt > -12° (Too Bright); Green if Sun Alt < -18°.
            if (sunAlt > -12) {
                skyMain = 'SKY TOO BRIGHT'; skyClass = 'status-red'; skyCard = 'red-card';
                skyIcon = '☀️'; skyDet = `Sun is ${sunAlt.toFixed(1)}° above horizon. Night imaging requires sun to be below -12°.`;
            } else if (sunAlt > -18) {
                skyMain = 'TWILIGHT — SUBOPTIMAL'; skyClass = 'status-yellow'; skyCard = 'amber-card';
                skyIcon = '🌅'; skyDet = `Astronomical twilight. Sky is still partially illuminated. Full dark is below -18°.`;
            } else {
                skyMain = 'OPTIMAL DARKNESS'; skyClass = 'status-green'; skyCard = 'green-card';
                skyIcon = '🌌'; skyDet = `Sun is ${Math.abs(sunAlt).toFixed(1)}° below horizon. Perfect dark-sky conditions.`;
            }
            if (vcSkyMain) { vcSkyMain.textContent = skyMain; vcSkyMain.className = 'verdict-main ' + skyClass; }
            if (vcSkyDet)  vcSkyDet.textContent  = skyDet;
            if (vcSkyIcon) vcSkyIcon.textContent  = skyIcon;
            if (vcSkyCard) vcSkyCard.className    = 'verdict-card ' + skyCard;
        }

        // ── Verdict: DETECTION POTENTIAL ─────────────────────────────
        const barFill   = document.getElementById('detection-bar-fill');
        const detPct    = document.getElementById('detection-pct');
        const vcDetDet  = document.getElementById('vc-det-detail');
        const vcDetCard = document.getElementById('vc-detection');
        if (barFill && or.pixelSpan != null) {
            const px = or.pixelSpan;
            // logic: Red if < 0.15px; Yellow if 0.15–0.3px; Green if > 0.3px
            const raw = Math.min(100, Math.max(0, (px / 0.5) * 100)); // 0.5px = 100% for bar scale
            const pct = px < 0.05 ? 0 : raw;
            barFill.style.width = pct + '%';
            if (detPct) detPct.textContent = pct.toFixed(0) + '%';
            
            let detClass, detLabel;
            if (px < 0.15) {
                detClass = 'status-red'; detLabel = 'EXTREMELY FAINT';
            } else if (px < 0.3) {
                detClass = 'status-yellow'; detLabel = 'CHALLENGING';
            } else {
                detClass = 'status-green'; detLabel = 'OPTIMAL';
            }
            
            if (barFill) {
                barFill.style.background = px < 0.15 ? '#ef5350' : px < 0.3 ? '#ffa726' : '#00e676';
            }
            if (vcDetDet) {
                vcDetDet.innerHTML = `<span class="${detClass}">${detLabel}</span> — ${px.toFixed(3)}px projected sensor span.`;
            }
            if (vcDetCard) {
                vcDetCard.className = 'verdict-card ' + (px < 0.15 ? 'red-card' : px < 0.3 ? 'amber-card' : 'green-card');
            }
        }

        // ── Verdict: TRACKING ─────────────────────────────────────────
        const vcTrackMain = document.getElementById('vc-track-main');
        const vcTrackDet  = document.getElementById('vc-track-detail');
        if (vcTrackMain && or.angularSpeedDegMin != null) {
            const img = window.ObserverAstro.calculateImagingAssistance(or.angularSpeedDegMin, or.magnitude);
            const maxExp = img.maxExpSec;
            const plan   = parseFloat(document.getElementById('in-planned-exp')?.value) || 30;
            if (maxExp != null) {
                const tooLong = plan > maxExp;
                vcTrackMain.textContent  = tooLong ? `EXPOSURE TOO LONG — Reduce to ${maxExp.toFixed(0)}s` : `${maxExp.toFixed(0)}s MAX UNTRACKED EXPOSURE`;
                vcTrackMain.className    = 'verdict-main ' + (tooLong ? 'red' : 'green');
                if (vcTrackDet) vcTrackDet.textContent = `Angular speed: ${img.trackRateArcsecSec.toFixed(2)} arcsec/sec. Your planned ${plan}s exposure ${tooLong ? 'will blur — reduce it.' : 'is within the smear limit.'}`;
            } else {
                vcTrackMain.textContent = 'TRACKING DATA UNAVAILABLE';
                vcTrackMain.className   = 'verdict-main amber';
            }
        }

        // ── Verdict: MOON ─────────────────────────────────────────────
        const vcMoonMain = document.getElementById('vc-moon-main');
        const vcMoonDet  = document.getElementById('vc-moon-detail');
        const vcMoonIcon = document.getElementById('vc-moon-icon');
        const vcMoonCard = document.getElementById('vc-moon');
        if (vcMoonMain && m.moon) {
            const moonPct  = m.moon.phaseFraction * 100;
            const moonAlt  = m.moon.altitude;
            const moonSep  = or.moonSeparationDeg ?? 90;
            
            let moonMain, moonDet, moonIcon, moonClass;
            
            // New logic: Red if Moon > 85% AND Sep < 30°. Green if < 40% or Sep > 60°.
            if (moonPct > 85 && moonSep < 30 && moonAlt > 0) {
                moonMain = `CRITICAL MOON INTERFERENCE`; moonIcon = '🌕'; moonClass = 'status-red';
                moonDet  = `Moon is ${moonPct.toFixed(0)}% illuminated and only ${moonSep.toFixed(1)}° from Orion. Optical imaging effectively impossible.`;
            } else if (moonPct > 85 && moonAlt > 0) {
                moonMain = `FULL MOON IMPACT`; moonIcon = '🌕'; moonClass = 'status-yellow';
            } else if (moonPct < 40 || moonSep > 60 || moonAlt <= 0) {
                moonMain = `MOON CLEAR — OPTIMAL`; moonIcon = moonAlt <= 0 ? '🌑' : '🌙'; moonClass = 'status-green';
                moonDet  = moonAlt <= 0 ? `Moon is below the horizon. Dark sky conditions are ideal.` : `Minimal interference from Moon (${moonPct.toFixed(0)}% / ${moonSep.toFixed(0)}° away).`;
            } else {
                moonMain = `PARTIAL MOON IMPACT`; moonIcon = '🌔'; moonClass = 'status-yellow';
                moonDet  = `Moon is ${moonPct.toFixed(0)}% illuminated at ${moonSep.toFixed(0)}° separation. Faint detail will be degraded.`;
            }
            
            vcMoonMain.textContent = moonMain; 
            vcMoonMain.className = 'verdict-main ' + moonClass;
            if (vcMoonDet)  vcMoonDet.textContent  = moonDet;
            if (vcMoonIcon) vcMoonIcon.textContent = moonIcon;
            if (vcMoonCard) vcMoonCard.className = 'verdict-card ' + (moonClass === 'status-red' ? 'red-card' : moonClass === 'status-green' ? 'green-card' : 'amber-card');
        }

        // ── Darkness state sub-header ─────────────────────────────────
        const darkEl = document.getElementById('ui-darkness-state');
        // already updated by existing tick code; just styled sub-header reads it
    }

    // Call interval and initial kickoff
    setInterval(tick, 1000);
    tick(); // fire immediately

    // ── Mission Map — Dedicated Full-Width 3D Panel ───────────────────
    function initMissionMap() {
        if (mm_renderer) return;
        const canvas = document.getElementById('mission-map-canvas');
        if (!canvas || !window.THREE) return;

        mm_scene = new THREE.Scene();

        const wrap = canvas.parentElement;
        const W = wrap.clientWidth  || 800;
        const H = wrap.clientHeight || 420;

        mm_renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        mm_renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mm_renderer.setSize(W, H);

        mm_camera = new THREE.PerspectiveCamera(40, W / H, 0.01, 2000);
        mm_camera.position.set(8, 4, 8);
        mm_camera.lookAt(0, 0, 0);

        // Starfield
        const starGeo = new THREE.BufferGeometry();
        const starPts = [];
        for (let i = 0; i < 6000; i++) {
            starPts.push((Math.random()-0.5)*1200,(Math.random()-0.5)*1200,(Math.random()-0.5)*1200);
        }
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
        mm_scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: false })));

        // Earth
        const eGeo = new THREE.SphereGeometry(1, 64, 64);
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        const eMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: loader.load('https://unpkg.com/three-globe@2.45.1/example/img/earth-blue-marble.jpg'),
            bumpMap: loader.load('https://unpkg.com/three-globe@2.45.1/example/img/earth-topology.png'),
            bumpScale: 0.04,
            specularMap: loader.load('https://unpkg.com/three-globe@2.45.1/example/img/earth-water.png'),
            specular: new THREE.Color(0x111118)
        });
        mm_earth = new THREE.Mesh(eGeo, eMat);
        mm_scene.add(mm_earth);

        // Atmosphere glow ring
        const atmGeo = new THREE.SphereGeometry(1.02, 48, 48);
        const atmMat = new THREE.MeshBasicMaterial({ color: 0x1a4a9a, transparent: true, opacity: 0.12, side: THREE.BackSide });
        mm_scene.add(new THREE.Mesh(atmGeo, atmMat));

        // Trajectory line
        if (window.MissionEphemeris && window.MissionEphemeris.points) {
            const pts = window.MissionEphemeris.points.map(p =>
                new THREE.Vector3(p.orion.x * S_SCALE, p.orion.y * S_SCALE, p.orion.z * S_SCALE)
            );
            const tGeo = new THREE.BufferGeometry().setFromPoints(pts);
            const tMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.55 });
            mm_traj = new THREE.Line(tGeo, tMat);
            mm_scene.add(mm_traj);
        }

        // Orion marker
        const mGeo = new THREE.SphereGeometry(0.04, 12, 12);
        const mMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
        mm_orion = new THREE.Mesh(mGeo, mMat);
        mm_scene.add(mm_orion);

        // Glow ring around Orion
        const gGeo = new THREE.SphereGeometry(0.07, 12, 12);
        const gMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.2, side: THREE.BackSide });
        mm_orion.add(new THREE.Mesh(gGeo, gMat));

        // Sun direction arrow (visual indicator of sunlight direction)
        const sunArrowDir = new THREE.Vector3(1, 0.3, 0.5).normalize();
        const sunArrow = new THREE.ArrowHelper(sunArrowDir, new THREE.Vector3(0,0,0), 3.5, 0xffcc00, 0.5, 0.25);
        sunArrow.name = 'sunArrow';
        mm_scene.add(sunArrow);

        // Shadow cone (Earth umbra approximation)
        const sGeo = new THREE.CylinderGeometry(0.98, 0.5, 30, 32, 1, true);
        const sMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        mm_shadow = new THREE.Mesh(sGeo, sMat);
        mm_shadow.rotation.z = Math.PI / 2; // align along X axis initially
        mm_scene.add(mm_shadow);

        // Lighting
        mm_sun = new THREE.DirectionalLight(0xfff5e0, 1.5);
        mm_scene.add(mm_sun);
        mm_scene.add(new THREE.AmbientLight(0x1a1a2e, 0.6));

        // Drag-to-orbit controls
        canvas.style.cursor = 'grab';
        canvas.addEventListener('mousedown', e => {
            mm_isDrag = true;
            mm_dragStart = { x: e.clientX, y: e.clientY, az: mm_azimuth, el: mm_elevation };
            canvas.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', e => {
            if (!mm_isDrag || !mm_dragStart) return;
            const dx = (e.clientX - mm_dragStart.x) * 0.008;
            const dy = (e.clientY - mm_dragStart.y) * 0.005;
            mm_azimuth   = mm_dragStart.az + dx;
            mm_elevation = Math.max(-1.4, Math.min(1.4, mm_dragStart.el - dy));
        });
        window.addEventListener('mouseup', () => { mm_isDrag = false; canvas.style.cursor = 'grab'; });
        canvas.addEventListener('wheel', e => {
            mm_radius = Math.max(2, Math.min(25, mm_radius + e.deltaY * 0.01));
            e.preventDefault();
        }, { passive: false });

        // Touch controls
        let mm_lastTouch = null;
        canvas.addEventListener('touchstart', e => {
            mm_lastTouch = e.touches[0]; mm_dragStart = { az: mm_azimuth, el: mm_elevation };
        }, { passive: true });
        canvas.addEventListener('touchmove', e => {
            if (!mm_lastTouch || !mm_dragStart) return;
            const dx = (e.touches[0].clientX - mm_lastTouch.clientX) * 0.006;
            const dy = (e.touches[0].clientY - mm_lastTouch.clientY) * 0.004;
            mm_azimuth   = mm_dragStart.az + dx;
            mm_elevation = Math.max(-1.4, Math.min(1.4, mm_dragStart.el - dy));
            mm_lastTouch = e.touches[0];
            mm_dragStart = { az: mm_azimuth, el: mm_elevation };
        }, { passive: true });

        // Resize handler
        function onResize() {
            const nW = wrap.clientWidth  || 800;
            const nH = wrap.clientHeight || 420;
            mm_renderer.setSize(nW, nH);
            mm_camera.aspect = nW / nH;
            mm_camera.updateProjectionMatrix();
        }
        window.addEventListener('resize', onResize);

        // Animation loop
        function mmAnimate() {
            requestAnimationFrame(mmAnimate);
            // Slow auto-rotate when not dragging
            if (!mm_isDrag) mm_azimuth += 0.0004;
            // Orbit camera
            const x = mm_radius * Math.cos(mm_elevation) * Math.sin(mm_azimuth);
            const y = mm_radius * Math.sin(mm_elevation);
            const z = mm_radius * Math.cos(mm_elevation) * Math.cos(mm_azimuth);
            mm_camera.position.set(x, y, z);
            mm_camera.lookAt(0, 0, 0);
            // Slow Earth rotation
            if (mm_earth) mm_earth.rotation.y += 0.0002;
            mm_renderer.render(mm_scene, mm_camera);
        }
        mmAnimate();
    }

    function updateMissionMap(metSec, orionData) {
        if (!mm_renderer || !mm_scene) return;
        // Position Orion marker
        if (mm_orion && window.MissionEphemeris) {
            const st = window.MissionEphemeris.getState(metSec);
            if (st && st.orion) {
                mm_orion.position.set(st.orion.x * S_SCALE, st.orion.y * S_SCALE, st.orion.z * S_SCALE);
            }
        }
        // Update sun direction, shadow cone & sun arrow
        const sunPos = window.ObserverAstro ? window.ObserverAstro.getSunPos(new Date()) : null;
        if (sunPos && mm_sun) {
            const sv = new THREE.Vector3(sunPos.x, sunPos.y, sunPos.z).normalize();
            mm_sun.position.copy(sv.clone().multiplyScalar(200));
            // Update sun arrow helper direction
            const arrow = mm_scene.getObjectByName('sunArrow');
            if (arrow) arrow.setDirection(sv);
            // Shadow cone points away from sun
            if (mm_shadow) {
                const sd = sv.clone().negate();
                mm_shadow.position.copy(sd.multiplyScalar(15));
                mm_shadow.lookAt(0, 0, 0);
                mm_shadow.rotateX(Math.PI / 2);
            }
        }
        // Mission progress label
        const mpEl = document.getElementById('map-mission-progress');
        if (mpEl && orionData && orionData.distanceKm) {
            const ld = orionData.distanceKm / 384400;
            mpEl.textContent = `DIST: ${Math.round(orionData.distanceKm).toLocaleString()} km | ${ld.toFixed(3)} LD`;
        }
    }

    // Kick off mission map after short delay (textures need DOM to be ready)
    setTimeout(initMissionMap, 300);

    // ── Coverage Map Click-to-Teleport ────────────────────────────────
    (function wireCoverageClick() {
        const cvs = document.getElementById('coverage-canvas');
        if (!cvs) return;
        cvs.style.cursor = 'crosshair';
        cvs.addEventListener('click', async (e) => {
            const rect = cvs.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;
            const W  = rect.width;
            const H  = rect.height;
            if (W === 0 || H === 0) return;
            // Equirectangular inverse: pixel → decimal lat/lon
            const lon = (px / W) * 360 - 180;
            const lat = 90 - (py / H) * 180;
            const clampedLat = Math.max(-90, Math.min(90, Math.round(lat * 10000) / 10000));
            const clampedLon = Math.max(-180, Math.min(180, Math.round(lon * 10000) / 10000));
            // Show syncing state immediately
            if (locStatus)   { locStatus.textContent = '[SYNCING...]'; }
            // Fetch elevation + apply
            await applyLocation(clampedLat, clampedLon, null);
        });
    })();

    // ── 3D Isometric Sky Dome ─────────────────────────────────────────
    function draw3DDome(o, alt, az, moonAlt, moonAz) {
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
            const dotColor = (o && o.shadowFactor < 1.0) ? "#ef5350" : "#00e676";
            svg += `<circle cx="${op.x.toFixed(1)}" cy="${op.y.toFixed(1)}" r="2.5" fill="${dotColor}" filter="drop-shadow(0 0 3px ${dotColor})"/>`;
            const lx = Math.min(143, op.x + 4), ly = Math.max(5, op.y - 2);
            svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="3.2" fill="${dotColor}" dominant-baseline="middle">Orion ${alt.toFixed(0)}°</text>`;
        } else {
            // Below horizon banner at bottom of dome
            const shadow = o && o.shadowFactor < 1.0;
            const label = shadow ? `ORION IN SHADOW` : `ORION BELOW HORIZON`;
            const color = shadow ? "#ef5350" : "#7986a8";
            svg += `<text x="${CX}" y="122" font-size="3" fill="${color}" text-anchor="middle" opacity="0.75">${label} (${Math.abs(alt).toFixed(0)}°)</text>`;
        }

        svg += `</svg>`;
        skyPlotCtr.innerHTML = svg;
    }

    // ── PRO: Global Visibility Heatmap ────────────────────────────────
    function updateGlobalHeatmap(met, tMs) {
        if (!heatmapCtr) return;
        const resX = 24, resY = 12; // lower resolution for performance
        let paths = "";
        
        // Simple simplified world map background polygons (very rough)
        const landColor = "rgba(74,144,217,0.1)";
        const seaColor = "rgba(0,0,0,0.2)";
        
        // Footprint calculation
        const footColor = "rgba(0,229,255,0.25)";
        
        let svg = `<svg viewBox="-180 -90 360 180" style="width:100%; height:100%; background:${seaColor};">`;
        
        // Very rough continents for reference
        // Americas
        svg += `<path d="M-120 70 L-60 70 L-40 10 L-80 -50 L-100 -50 L-110 10 Z" fill="${landColor}"/>`;
        // Eurasia + Africa
        svg += `<path d="M0 70 L140 70 L150 10 L40 -30 L20 10 L-10 10 L-20 40 Z" fill="${landColor}"/>`;
        svg += `<path d="M-20 30 L40 30 L50 -20 L0 -30 Z" fill="${landColor}"/>`;
        // Australia
        svg += `<path d="M110 -10 L150 -10 L150 -40 L110 -40 Z" fill="${landColor}"/>`;

        // Scan grid
        for (let y = 0; y < resY; y++) {
            for (let x = 0; x < resX; x++) {
                const lon = -180 + (x / resX) * 360;
                const lat = 90 - (y / resY) * 180;
                
                const m = window.ObserverAstro.calculateMetrics(met, tMs, lat, lon, 0);
                if (m && m.orion.altitude > 15 && m.sun.altitude < -12 && m.orion.isSunlit) {
                    svg += `<rect x="${lon}" y="${lat - (180/resY)}" width="${360/resX}" height="${180/resY}" fill="${footColor}" stroke="none"/>`;
                }
            }
        }
        
        // Current User Location Marker
        if (obsLat !== null && obsLon !== null) {
            svg += `<circle cx="${obsLon}" cy="${-obsLat}" r="3" fill="#ffcc00" filter="drop-shadow(0 0 5px #ffcc00)"/>`;
        }
        
        svg += `</svg>`;
        heatmapCtr.innerHTML = svg;
    }

    // ── PRO: Mission Phase Timeline ──────────────────────────────────
    function updateMissionTimeline(met) {
        if (!timelineProgress) return;
        const totalDuration = 824760; // Launch to Splashdown
        const pct = Math.min(100, Math.max(0, (met / totalDuration) * 100));
        timelineProgress.style.width = pct + "%";
        
        // Prox Ops Alert (Day 1, MET 9000s to 13200s)
        // Alert 30 mins before (met < 9000 - 1800 = 7200)
        if (met > 7200 && met < 13200) {
            if (proxOpsAlert) proxOpsAlert.style.display = 'block';
        } else {
            if (proxOpsAlert) proxOpsAlert.style.display = 'none';
        }
    }

    // ── PRO: Virtual Eyepiece (Three.js) ─────────────────────────────
    window.initEyepiece = function() {
        if (renderer) return; // already init
        const canvas = document.getElementById('eyepiece-canvas');
        if (!canvas || !window.THREE) return;

        // Canvas is display:none at init — read size from parent element
        const parent = canvas.parentElement;
        const epW = (parent && parent.clientWidth  > 10 ? parent.clientWidth  : 400);
        const epH = (parent && parent.clientHeight > 10 ? parent.clientHeight : 400);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(2.0, epW / epH, 1, 5000); // narrowing FOV
        camera.position.set(0, 0, 500); 
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(epW, epH);

        // Starfield — sphere of points around origin
        const starCount = 5000;
        const starGeo = new THREE.BufferGeometry();
        const starPos = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            const r = 1500;
            starPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
            starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
            starPos[i*3+2] = r * Math.cos(phi);
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false }));
        scene.add(stars);

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const epSun = new THREE.DirectionalLight(0xffffff, 1.2);
        epSun.position.set(50, 30, 50);
        scene.add(epSun);

        // Orion model (tiny representation at origin)
        if (window.createOrionModel) {
            orionGroup = window.createOrionModel(THREE);
            orionGroup.scale.set(0.08, 0.08, 0.08);
            orionGroup.position.set(0, 0, 0);
            scene.add(orionGroup);
        }

        // Cyan target crosshair overlay drawn on a 2D canvas on top
        function drawCrosshair() {
            const ov = document.getElementById('eyepiece-crosshair');
            if (!ov) return;
            const ctx2 = ov.getContext('2d');
            const w = ov.width = ov.clientWidth || epW;
            const h = ov.height = ov.clientHeight || epH;
            ctx2.clearRect(0, 0, w, h);
            const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.06;
            ctx2.strokeStyle = 'rgba(0,229,255,0.85)';
            ctx2.lineWidth = 1;
            ctx2.beginPath(); ctx2.moveTo(cx - r * 2.5, cy); ctx2.lineTo(cx - r * 0.5, cy); ctx2.stroke();
            ctx2.beginPath(); ctx2.moveTo(cx + r * 0.5, cy); ctx2.lineTo(cx + r * 2.5, cy); ctx2.stroke();
            ctx2.beginPath(); ctx2.moveTo(cx, cy - r * 2.5); ctx2.lineTo(cx, cy - r * 0.5); ctx2.stroke();
            ctx2.beginPath(); ctx2.moveTo(cx, cy + r * 0.5); ctx2.lineTo(cx, cy + r * 2.5); ctx2.stroke();
            ctx2.beginPath(); ctx2.arc(cx, cy, r, 0, Math.PI * 2);
            ctx2.strokeStyle = 'rgba(0,229,255,0.5)'; ctx2.stroke();
        }
        drawCrosshair();

        function animate() {
            requestAnimationFrame(animate); // always keep loop alive
            if (!useEyepiece) return;       // skip render when not active
            renderer.render(scene, camera);
            if (orionGroup) orionGroup.rotation.y += 0.004;
        }
        animate();
    };

    // Helper: Create Text Sprite for 3D Labels
    function createTextSprite(text, color = '#00e5ff', fontSize = 64) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512; canvas.height = 128;
        context.font = `bold ${fontSize}px "Orbitron", sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = color;
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1.5, 0.375, 1);
        return sprite;
    }

    function updateEyepiece(raHours, decDeg, altitude) {
        if (!camera) return;
        // Position camera to look at RA/Dec
        const raRad = (raHours * 15) * Math.PI / 180;
        const decRad = decDeg * Math.PI / 180;
        
        const dist = 50; 
        camera.position.set(
            dist * Math.cos(decRad) * Math.cos(raRad),
            dist * Math.sin(decRad),
            dist * Math.cos(decRad) * Math.sin(raRad)
        );
        camera.lookAt(0, 0, 0);
        
        // Scale Orion based on distance? No, keep it as a "pre-visualization" reference
        if (orionGroup) {
            orionGroup.visible = (altitude > 0);
        }
    }

    window.initThreeJS = function() {
        if (t_renderer) return;
        const canvas = document.getElementById('three-canvas');
        if (!canvas || !window.THREE) return;

        t_scene = new THREE.Scene();

        t_renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        t_renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // Canvas is display:none at init — read from parent
        const parent = canvas.parentElement;
        const cW = (parent && parent.clientWidth  > 10 ? parent.clientWidth  : 400);
        const cH = (parent && parent.clientHeight > 10 ? parent.clientHeight : 400);
        t_renderer.setSize(cW, cH);

        t_camera = new THREE.PerspectiveCamera(45, cW / cH, 1.0, 5000);
        t_camera.position.set(0, 0, 500); 
        t_camera.lookAt(0, 0, 0);

        // Earth
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        const eGeo = new THREE.SphereGeometry(1, 64, 64);
        const eMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map:         loader.load('https://unpkg.com/three-globe@2.45.1/example/img/earth-blue-marble.jpg'),
            bumpMap:     loader.load('https://unpkg.com/three-globe@2.45.1/example/img/earth-topology.png'),
            bumpScale: 0.05,
            specularMap: loader.load('https://unpkg.com/three-globe@2.45.1/example/img/earth-water.png'),
            specular: new THREE.Color('grey')
        });
        t_earth = new THREE.Mesh(eGeo, eMat);
        t_scene.add(t_earth);

        // Observer Marker (Syncs with user coordinates)
        t_obsMarker = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffcc00 })
        );
        t_earth.add(t_obsMarker);

        // Starfield
        const starGeo = new THREE.BufferGeometry();
        const starPts = [];
        for (let i = 0; i < 5000; i++) {
            starPts.push((Math.random()-0.5)*1500,(Math.random()-0.5)*1500,(Math.random()-0.5)*1500);
        }
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
        t_scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, sizeAttenuation: false })));

        // Trajectory
        if (window.MissionEphemeris && window.MissionEphemeris.points) {
            const pts = window.MissionEphemeris.points.map(p => new THREE.Vector3(p.orion.x * S_SCALE, p.orion.y * S_SCALE, p.orion.z * S_SCALE));
            t_traj = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(pts),
                new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6 })
            );
            t_scene.add(t_traj);
        }

        // Orion Model
        if (window.createOrionModel) {
            t_orion = window.createOrionModel(THREE);
            t_orion.scale.set(0.15, 0.15, 0.15);
            t_scene.add(t_orion);
        }

        // Shadow Cone
        t_shadow = new THREE.Mesh(
            new THREE.CylinderGeometry(1.0, 0.6, 25, 32),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 })
        );
        t_scene.add(t_shadow);

        // Lighting — strong enough to see the Earth
        t_scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        t_sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
        t_sun.position.set(100, 50, 100);
        t_scene.add(t_sun);

        // Sun Vector Indicator — Fixed dimensions to eliminate polygon glitch
        t_sunArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 4, 0xffcc00, 1.0, 0.5);
        t_scene.add(t_sunArrow);
        t_sunLabel = createTextSprite("SUN DIRECTION", "#ffcc00", 40);
        t_sunLabel.scale.set(2, 2, 2);
        t_scene.add(t_sunLabel);

        // Geometric Labels
        t_shadowLabel = createTextSprite("EARTH SHADOW (UMBRA)", "rgba(255,255,255,0.4)", 36);
        t_scene.add(t_shadowLabel);
        t_orionLabel = createTextSprite("ARTEMIS II (ORION)", "#00e5ff", 42);
        t_scene.add(t_orionLabel);

        // Interaction (Drag & Zoom)
        canvas.addEventListener('mousedown', e => {
            t_isDrag = true;
            t_dragStart = { x: e.clientX, y: e.clientY, az: t_azimuth, el: t_elevation };
            canvas.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', e => {
            if (!t_isDrag || !t_dragStart) return;
            const dx = (e.clientX - t_dragStart.x) * 0.008;
            const dy = (e.clientY - t_dragStart.y) * 0.005;
            t_azimuth   = t_dragStart.az + dx;
            t_elevation = Math.max(-1.4, Math.min(1.4, t_dragStart.el - dy));
        });
        window.addEventListener('mouseup', () => { 
            t_isDrag = false; 
            canvas.style.cursor = 'auto'; 
        });
        canvas.addEventListener('wheel', e => {
            // Zoom limit: radius >= 1.3 (Earth is 1.0)
            t_radius = Math.max(1.3, Math.min(20, t_radius + e.deltaY * 0.005));
            e.preventDefault();
        }, { passive: false });

        // Resize handler
        function onResize3D() {
            const p = canvas.parentElement;
            const nW = (p && p.clientWidth  > 10 ? p.clientWidth  : 400);
            const nH = (p && p.clientHeight > 10 ? p.clientHeight : 400);
            t_renderer.setSize(nW, nH);
            t_camera.aspect = nW / nH;
            t_camera.updateProjectionMatrix();
        }
        window.addEventListener('resize', onResize3D);

        let t_loopAlive = false;
        function t_animate() {
            requestAnimationFrame(t_animate); // keep loop alive always
            if (!use3D) return;              // skip render when toggled off
            t_loopAlive = true;
            t_renderer.render(t_scene, t_camera);
            if (t_earth) t_earth.rotation.y += 0.0003;
            if (t_orion) t_orion.rotation.y += 0.005;
            
            // Camera Positioning
            if (!t_isDrag) t_azimuth += 0.0004; // slow drift
            const tx = t_radius * Math.cos(t_elevation) * Math.sin(t_azimuth);
            const ty = t_radius * Math.sin(t_elevation);
            const tz = t_radius * Math.cos(t_elevation) * Math.cos(t_azimuth);
            t_camera.position.set(tx, ty, tz);
            t_camera.lookAt(0, 0, 0);
        }
        t_animate();
    };


    function updateThreeJS(met, orionData) {
        if (!t_orion || !use3D) return;
        
        // Update Orion pos
        t_orion.position.set(orionData.x * S_SCALE, orionData.y * S_SCALE, orionData.z * S_SCALE);
        
        // Update Sun & Shadow based on current time
        const sunPos = window.ObserverAstro.getSunPos(new Date(Date.now())); // basic approx
        if (sunPos) {
            const sunVec = new THREE.Vector3(sunPos.x, sunPos.y, sunPos.z).normalize();
            t_sun.position.copy(sunVec.clone().multiplyScalar(20));
            
            // Align shadow cone away from sun
            const shadowDir = sunVec.clone().negate();
            t_shadow.position.copy(shadowDir.multiplyScalar(12.5));
            t_shadow.lookAt(0, 0, 0);
            t_shadow.rotateX(Math.PI/2);

            // Update Sun Arrow & Label
            if (t_sunArrow) t_sunArrow.setDirection(sunVec);
            if (t_sunLabel) t_sunLabel.position.copy(sunVec.clone().multiplyScalar(5));
            
            // Update Observer Marker position
            if (t_obsMarker && obsLat != null) {
                const phi = (90 - obsLat) * (Math.PI / 180);
                const theta = (obsLon + 180) * (Math.PI / 180);
                t_obsMarker.position.x = -(Math.sin(phi) * Math.cos(theta)) * 1.02;
                t_obsMarker.position.z = (Math.sin(phi) * Math.sin(theta)) * 1.02;
                t_obsMarker.position.y = Math.cos(phi) * 1.02;
            }

            // Update Shadow Label
            if (t_shadowLabel) {
                t_shadowLabel.position.copy(shadowDir.clone().multiplyScalar(10));
            }
        }

        // Update Orion Label
        if (t_orionLabel && orionData) {
            const pos = new THREE.Vector3(orionData.x * S_SCALE, orionData.y * S_SCALE, orionData.z * S_SCALE);
            t_orionLabel.position.copy(pos.clone().add(new THREE.Vector3(0, 0.4, 0)));
            
            const isUmbra = (o && o.shadowState === 'umbra');
            const distKm = Math.round(orionData.distanceKm).toLocaleString();
            let labelText = `ARTEMIS II (ORION)\nDist: ${distKm} km`;
            if (isUmbra) labelText += "\n(IN SHADOW)";

            // Update texture only if content changed to save performance
            if (t_orionLabel.userData.lastText !== labelText) {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = 512; canvas.height = 128;
                context.font = `bold 42px "Orbitron", sans-serif`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillStyle = '#ffffff'; // Base color white, tinted by material
                // Handle newlines
                const lines = labelText.split('\n');
                lines.forEach((line, i) => {
                    context.fillText(line, canvas.width / 2, (canvas.height / 2) + (i - (lines.length-1)/2)*45);
                });
                
                const tex = new THREE.CanvasTexture(canvas);
                t_orionLabel.material.map.dispose();
                t_orionLabel.material.map = tex;
                t_orionLabel.material.needsUpdate = true;
                t_orionLabel.userData.lastText = labelText;
            }
            
            t_orionLabel.material.color.set(isUmbra ? '#ef5350' : '#00e5ff');
        }

        // Camera auto-orbit removed, handled by t_animate now
    }

    // Sync Footer Metadata from Ephemeris
    window.MissionEphemeris.ready.then(function() {
        const footer = document.getElementById('data-timestamp-footer');
        if (!footer || !window.MissionEphemeris.meta.creationDate) return;
        try {
            const rawDate = window.MissionEphemeris.meta.creationDate;
            const d = new Date(rawDate.includes('Z') ? rawDate : rawDate + 'Z');
            const fmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
            footer.innerHTML = `DATA LAST UPDATED: ${fmt.format(d)} | NASA OEM`;
        } catch(e) {
            console.warn('[ObserverUI] Failed to format metadata date:', e);
        }
    });
});
