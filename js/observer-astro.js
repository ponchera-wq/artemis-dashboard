/**
 * observer-astro.js
 * Core astrodynamics and mathematical logic for Artemis II Observer Mode.
 * Constraints implemented: No manual spherical trig (except WGS84), astronomy-engine pipeline used,
 * interpolated angular speed, and Lambertian magnitude estimation.
 */

window.ObserverAstro = (function() {
    // Standard WGS84 / Ephemeris constants
    const WGS84_A = 6378.137; // km
    const WGS84_F = 1.0 / 298.257223563;
    const WGS84_b = WGS84_A * (1.0 - WGS84_F);
    const WGS84_e2 = 1.0 - (WGS84_b * WGS84_b) / (WGS84_A * WGS84_A);
    const AU_KM = 149597870.7;
    const RE_KM = 6378.137;
    const RS_KM = 695700;

    // Default Hardware Config (Shawn Gano Professional Standard)
    let hardwareConfig = {
        telescopeFocalLength: 1422, // mm (default SCT 8" with reducer or similar)
        cameraPixelSize: 3.76,     // um (default IMX571/IMX183 standard)
        apertureMm: 203.2,         // mm (8" aperture)
        hyperstarMode: false       // f/1.9 toggle
    };

    // Load from persistence
    try {
        const saved = localStorage.getItem('artemis_observer_hw');
        if (saved) Object.assign(hardwareConfig, JSON.parse(saved));
    } catch (e) { console.error("HW Load failed", e); }

    /**
     * Calculates Topocentric vector, RA/Dec and Alt/Az using astronomy-engine.
     */
    function getTopocentricPosition(metSec, date, lat, lon, altMeters) {
        if (!window.MissionEphemeris || !window.Astronomy) return null;
        
        // 1. Retrieve Orion's EME2000 (ECI) position
        const state = window.MissionEphemeris.getState(metSec);
        if (!state || !state.orion) return null;
        const orionX = state.orion.x;
        const orionY = state.orion.y;
        const orionZ = state.orion.z;

        // 2. Compute observer's ECEF position using WGS84
        const latRad = lat * Math.PI / 180;
        const lonRad = lon * Math.PI / 180;
        const sinLat = Math.sin(latRad);
        const cosLat = Math.cos(latRad);
        const sinLon = Math.sin(lonRad);
        const cosLon = Math.cos(lonRad);

        const N = WGS84_A / Math.sqrt(1.0 - WGS84_e2 * sinLat * sinLat);
        const h_km = altMeters / 1000.0;

        const X_ecef = (N + h_km) * cosLat * cosLon;
        const Y_ecef = (N + h_km) * cosLat * sinLon;
        const Z_ecef = (N * (1.0 - WGS84_e2) + h_km) * sinLat;

        // 3. Rotate Observer ECEF to EME2000 using GMST
        const gmstHours = window.Astronomy.SiderealTime(date);
        const gmstRad = (gmstHours * 15.0) * Math.PI / 180.0;
        const sinGmst = Math.sin(gmstRad);
        const cosGmst = Math.cos(gmstRad);

        const obsEciX = X_ecef * cosGmst - Y_ecef * sinGmst;
        const obsEciY = X_ecef * sinGmst + Y_ecef * cosGmst;
        const obsEciZ = Z_ecef;

        // 4. Topocentric ECI Vector
        const topoX = orionX - obsEciX;
        const topoY = orionY - obsEciY;
        const topoZ = orionZ - obsEciZ;
        const distanceKm = Math.sqrt(topoX * topoX + topoY * topoY + topoZ * topoZ);

        // 5. Convert to local Alt/Az and RA/Dec
        // Astronomy-engine expects vectors in AU
        const vecTopo = new window.Astronomy.Vector(topoX / AU_KM, topoY / AU_KM, topoZ / AU_KM, date);
        const eq = window.Astronomy.EquatorFromVector(vecTopo);
        const observer = new window.Astronomy.Observer(lat, lon, altMeters);
        const hor = window.Astronomy.Horizon(date, observer, eq.ra, eq.dec, 'normal');

        return {
            topoVecAu: vecTopo,
            distanceKm: distanceKm,
            ra: eq.ra,       // hours
            dec: eq.dec,     // degrees
            alt: hor.altitude, // degrees
            az: hor.azimuth,   // degrees
            observerObj: observer,
            orionEci: { x: orionX, y: orionY, z: orionZ } // Captured ECI for shadow check
        };
    }

    /**
     * Refined Conical Shadow calculation (Umbra vs Penumbra).
     */
    function getShadowState(date, orionEci) {
        if (!window.Astronomy) return { state: 'sunlit', factor: 1.0 };
        const sunVecAu = window.Astronomy.GeoVector('Sun', date, true);
        if (!sunVecAu) return { state: 'sunlit', factor: 1.0 };

        const sunX = sunVecAu.x * AU_KM;
        const sunY = sunVecAu.y * AU_KM;
        const sunZ = sunVecAu.z * AU_KM;
        const rSun = Math.sqrt(sunX*sunX + sunY*sunY + sunZ*sunZ);
        const sunUnit = { x: sunX / rSun, y: sunY / rSun, z: sunZ / rSun };

        // Projection onto Earth-Sun line
        const dot = orionEci.x * sunUnit.x + orionEci.y * sunUnit.y + orionEci.z * sunUnit.z;
        if (dot > 0) return { state: 'sunlit', factor: 1.0 }; 

        const rOrionSq = orionEci.x**2 + orionEci.y**2 + orionEci.z**2;
        const distSq = rOrionSq - dot**2;
        const r = Math.sqrt(Math.max(0, distSq));

        const RE = 6371; // Earth radius (km)
        const RS = 695700; // Sun radius (km)
        const x = Math.abs(dot);
        
        // Umbra radius at distance x behind Earth
        const rUmbra = RE - (RS - RE) * x / rSun;
        // Penumbra radius at distance x behind Earth
        const rPenumbra = RE + (RS + RE) * x / rSun;

        if (r < rUmbra) return { state: 'umbra', factor: 0.0 };
        if (r < rPenumbra) return { state: 'penumbra', factor: 0.5 };
        return { state: 'sunlit', factor: 1.0 };
    }

    /**
     * Binary sunlit check (legacy/simple)
     */
    function is_sunlit(date, orionEci) {
        return getShadowState(date, orionEci).factor > 0;
    }

    return {
        /**
         * Main function computing all metrics for Observer view
         */
        calculateMetrics: function(metSec, referenceDateMs, lat, lon, altMeters) {
            const date = new Date(referenceDateMs);
            const pos = getTopocentricPosition(metSec, date, lat, lon, altMeters);
            if (!pos) return null;

            // 1. Magnitude Estimation
            // H = 2.0 (Conservative baseline size for spacecraft)
            // Formula: m = H + 5*log10(dist_km / 1000) + phasePenalty
            // Reference distance is 1,000 km. At 210,000 km this yields ~+13 to +14.
            const H = 2.0;
            const distKmForMag = pos.distanceKm;

            // Sun Vector computation — phase angle only
            let numMagnitude = null;
            let phaseAngleRads = 0;
            const sunEq = window.Astronomy.Equator('Sun', date, pos.observerObj, true, true);
            
            if (sunEq && sunEq.vec) {
                // Observer->Target vector (AU)
                const v_ob = pos.topoVecAu;
                
                // Target->Sun vector (AU)
                const v_so_x = sunEq.vec.x - v_ob.x;
                const v_so_y = sunEq.vec.y - v_ob.y;
                const v_so_z = sunEq.vec.z - v_ob.z;

                const r_sun_au = Math.sqrt(v_so_x*v_so_x + v_so_y*v_so_y + v_so_z*v_so_z);
                const r_ob_au  = Math.sqrt(v_ob.x*v_ob.x + v_ob.y*v_ob.y + v_ob.z*v_ob.z);

                const dot = v_so_x * (-v_ob.x) + v_so_y * (-v_ob.y) + v_so_z * (-v_ob.z);
                phaseAngleRads = Math.acos(Math.max(-1, Math.min(1, dot / (r_sun_au * r_ob_au))));

                // Lambertian phase angle penalty
                const p = (Math.sin(phaseAngleRads) + (Math.PI - phaseAngleRads) * Math.cos(phaseAngleRads)) / Math.PI;

                if (p > 0 && distKmForMag > 0) {
                    // Distance term uses km, reference 1000 km — physically correct for spacecraft
                    numMagnitude = H + 5.0 * Math.log10(distKmForMag / 1000.0) - 2.5 * Math.log10(p);
                }
            }

            // 2. Angular Speed Estimation
            // Sample t and t+60. Note: Due to 20-minute gap ephemeris, this is an interpolated average.
            let angularSpeedDegSec = 0;
            const tNextDate = new Date(referenceDateMs + 60000);
            const posNext = getTopocentricPosition(metSec + 60, tNextDate, lat, lon, altMeters);
            if (posNext) {
                const vec1 = pos.topoVecAu;
                const vec2 = posNext.topoVecAu;
                const d1 = Math.sqrt(vec1.x*vec1.x + vec1.y*vec1.y + vec1.z*vec1.z);
                const d2 = Math.sqrt(vec2.x*vec2.x + vec2.y*vec2.y + vec2.z*vec2.z);
                
                const dot12 = vec1.x*vec2.x + vec1.y*vec2.y + vec1.z*vec2.z;
                const angleRads = Math.acos(Math.max(-1, Math.min(1, dot12 / (d1 * d2))));
                const angleDeg = angleRads * 180.0 / Math.PI;
                angularSpeedDegSec = angleDeg / 60.0;
            }

            // 3. Sun & Moon local positions using astronomy-engine exclusively
            const sunHor = window.Astronomy.Horizon(date, pos.observerObj, sunEq.ra, sunEq.dec, 'normal');
            
            const moonEq = window.Astronomy.Equator('Moon', date, pos.observerObj, true, true);
            const moonHor = window.Astronomy.Horizon(date, pos.observerObj, moonEq.ra, moonEq.dec, 'normal');
            const moonIllum = window.Astronomy.Illumination('Moon', date);

            // 4. Hardware Dependent Metrics
            let focalLength = hardwareConfig.telescopeFocalLength;
            if (hardwareConfig.hyperstarMode) {
                focalLength = hardwareConfig.apertureMm * 1.9;
            }

            const arcsecPerPixel = (hardwareConfig.cameraPixelSize / focalLength) * 206.265;
            // Orion wingspan ~19m
            const pixelSpanRaw = (pos.distanceKm > 0) 
                ? (19.0 * focalLength) / (pos.distanceKm * hardwareConfig.cameraPixelSize)
                : 0;
            
            // Apply 0.1px detection floor for empirical professional standard
            const pixelSpan = pixelSpanRaw < 0.1 ? 0 : pixelSpanRaw;

            const shadow = getShadowState(date, pos.orionEci);
            
            // Specular Glint Flag Strategy: Backlit (<15) or Forward Scatter (>165)
            const phaseDeg = phaseAngleRads * 180.0 / Math.PI;
            const glintPotential = (phaseDeg < 15 || phaseDeg > 165);

            return {
                orion: {
                    altitude: pos.alt,
                    azimuth: pos.az,
                    raHours: pos.ra,
                    decDeg: pos.dec,
                    distanceKm: pos.distanceKm,
                    magnitude: numMagnitude,
                    angularSpeedDegMin: angularSpeedDegSec * 60.0, // deg/min
                    angularSpeedDegSec: angularSpeedDegSec,
                    phaseAngleDeg: phaseDeg,
                    isSunlit: shadow.factor > 0,
                    shadowState: shadow.state,
                    shadowFactor: shadow.factor,
                    glintPotential: glintPotential,
                    arcsecPerPixel: arcsecPerPixel,
                    pixelSpan: pixelSpan
                },
                sun: {
                    altitude: sunHor.altitude,
                    azimuth: sunHor.azimuth
                },
                moon: {
                    altitude: moonHor.altitude,
                    azimuth: moonHor.azimuth,
                    phaseFraction: moonIllum ? moonIllum.phase_fraction : null,
                    phaseAngleDeg: moonIllum ? moonIllum.phase_angle : null
                }
            };
        },

        /**
         * Scan the next 24 hours in 20-minute increments and return the next
         * 3 contiguous windows where Orion is observable.
         *
         * Visibility criteria per step:
         *   - Orion altitude  > 10°          (clear of horizon + atmospheric refraction)
         *   - Sun altitude    < -6°           (civil twilight or darker)
         *   - Orion is sunlit (phase angle < 90° from Sun — spacecraft in sunlight, not Earth shadow)
         *
         * @param {number} lat          Observer geodetic latitude (deg)
         * @param {number} lon          Observer geodetic longitude (deg)
         * @param {number} nowMs        Current wall-clock time (ms since epoch)
         * @param {number} nowMetSec    Current mission elapsed time (seconds)
         * @param {number} [altM=0]     Observer altitude above WGS84 ellipsoid (metres)
         * @returns {Array} Up to 3 window objects
         */
        calculateViewingWindows: function(lat, lon, nowMs, nowMetSec, altM = 0) {
            if (!window.MissionEphemeris || !window.Astronomy) return [];

            const STEP_SEC   = 20 * 60;        // 20-minute steps
            const STEPS      = 72;             // 24 hours
            const MIN_ALT    = 10;             // degrees
            const MAX_SUN    = -12;            // Gano Standard: Astronomical Twilight 
            const MAX_WINDOWS = 3;

            const windows = [];
            let currentWindow = null;

            for (let i = 0; i <= STEPS; i++) {
                const offsetSec  = i * STEP_SEC;
                const stepMs     = nowMs + offsetSec * 1000;
                const stepMetSec = nowMetSec + offsetSec;
                const stepDate   = new Date(stepMs);

                // Get topocentric position (cheap path — no angular speed sampling)
                const pos = getTopocentricPosition(stepMetSec, stepDate, lat, lon, altM);
                if (!pos) continue;

                // Sun altitude at this step
                const observer  = pos.observerObj;
                const sunEq     = window.Astronomy.Equator('Sun', stepDate, observer, true, true);
                if (!sunEq) continue;
                const sunHor    = window.Astronomy.Horizon(stepDate, observer, sunEq.ra, sunEq.dec, 'normal');
                const sunAlt    = sunHor.altitude;

                // Conical Shadow Check — Use factor-based lithness
                const shadow = getShadowState(stepDate, pos.orionEci);
                const isSunlit = shadow.factor > 0;
                let mag = null;
                if (sunEq.vec) {
                    const v_ob     = pos.topoVecAu;
                    const v_so_x   = sunEq.vec.x - v_ob.x;
                    const v_so_y   = sunEq.vec.y - v_ob.y;
                    const v_so_z   = sunEq.vec.z - v_ob.z;
                    const r_sun    = Math.sqrt(v_so_x**2 + v_so_y**2 + v_so_z**2);
                    const r_ob     = Math.sqrt(v_ob.x**2 + v_ob.y**2 + v_ob.z**2);
                    const dot      = v_so_x * (-v_ob.x) + v_so_y * (-v_ob.y) + v_so_z * (-v_ob.z);
                    const phaseRad = Math.acos(Math.max(-1, Math.min(1, dot / (r_sun * r_ob))));

                    // Magnitude at this step
                    const p = (Math.sin(phaseRad) + (Math.PI - phaseRad) * Math.cos(phaseRad)) / Math.PI;
                    if (p > 0 && pos.distanceKm > 0) {
                        mag = 2.0 + 5.0 * Math.log10(pos.distanceKm / 1000.0) - 2.5 * Math.log10(p);
                    }
                }

                const isVisible = pos.alt > MIN_ALT && sunAlt < MAX_SUN && isSunlit;

                if (isVisible) {
                    if (!currentWindow) {
                        // Start of a new window
                        currentWindow = {
                            startMs:   stepMs,
                            endMs:     stepMs,
                            peakAlt:   pos.alt,
                            peakMag:   mag,
                            peakMs:    stepMs
                        };
                    } else {
                        // Extend existing window
                        currentWindow.endMs = stepMs;
                        if (pos.alt > currentWindow.peakAlt) {
                            currentWindow.peakAlt = pos.alt;
                            currentWindow.peakMag = mag;
                            currentWindow.peakMs  = stepMs;
                        }
                    }
                } else {
                    if (currentWindow) {
                        // Close window
                        windows.push(currentWindow);
                        currentWindow = null;
                        if (windows.length >= MAX_WINDOWS) break;
                    }
                }
            }

            // Close a window that runs to the end of the scan period
            if (currentWindow && windows.length < MAX_WINDOWS) {
                windows.push(currentWindow);
            }

            return windows;
        },

        /**
         * Imaging assistance parameters derived from angular motion and magnitude.
         *
         * MaxExp = 2.0 arcsec / trackRate(arcsec/sec)
         *   trackRate = angularSpeedDegMin * 3600 / 60  (deg/min → arcsec/sec)
         *
         * @param {number} angularSpeedDegMin  Angular speed in degrees per minute
         * @param {number|null} magnitude      Apparent magnitude (null if unavailable)
         * @returns {object} { trackRateArcsecSec, maxExpSec, difficultyLabel }
         */
        calculateImagingAssistance: function(angularSpeedDegMin, magnitude) {
            // Track rate: deg/min → arcsec/sec  (×3600 for deg→arcsec, ÷60 for min→sec)
            const trackRateArcsecSec = angularSpeedDegMin * 3600.0 / 60.0;

            // Max untracked exposure before target smears > 2 arcsec
            const maxExpSec = trackRateArcsecSec > 0
                ? 2.0 / trackRateArcsecSec
                : null;

            // Signal-to-Noise category based on magnitude
            let difficultyLabel;
            if (magnitude == null) {
                difficultyLabel = '—';
            } else if (magnitude < 12) {
                difficultyLabel = 'Easy';
            } else if (magnitude <= 14) {
                difficultyLabel = 'Moderate';
            } else {
                difficultyLabel = 'Challenging / Large Aperture';
            }

            return { trackRateArcsecSec, maxExpSec, difficultyLabel };
        },

        getDarkState: function(sunAlt) {
            if (sunAlt > -0.83) return { label: "Daylight", optimal: false };
            if (sunAlt > -6) return { label: "Civil Twilight", optimal: false };
            if (sunAlt > -12) return { label: "Nautical Twilight", subLabel: "Sub-optimal: Skyglow Present", optimal: false };
            return { label: "Astronomical Night", subLabel: "Optimal Dark Sky", optimal: true };
        },

        getSunPos: function(date) {
            if (!window.Astronomy) return null;
            const sunVecAu = window.Astronomy.GeoVector('Sun', date, true);
            if (!sunVecAu) return null;
            return { x: sunVecAu.x * AU_KM, y: sunVecAu.y * AU_KM, z: sunVecAu.z * AU_KM };
        },

        getHardwareConfig: () => hardwareConfig,
        setHardwareConfig: (cfg) => {
            Object.assign(hardwareConfig, cfg);
            localStorage.setItem('artemis_observer_hw', JSON.stringify(hardwareConfig));
        },

        calculateDetectionConfidence: function(pixelSpan) {
            if (pixelSpan <= 0) return 'Undetectable';
            if (pixelSpan >= 0.3) return 'High';
            if (pixelSpan >= 0.1) return 'Moderate';
            return 'Low';
        }
    };
})();
