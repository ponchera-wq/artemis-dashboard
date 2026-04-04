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
            observerObj: observer
        };
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
                    phaseAngleDeg: phaseAngleRads * 180.0 / Math.PI
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

            const STEP_SEC   = 20 * 60;        // 20-minute steps (matches ephemeris resolution)
            const STEPS      = 72;             // 72 × 20 min = 24 hours
            const MIN_ALT    = 10;             // degrees
            const MAX_SUN    = -6;             // civil twilight threshold
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

                // Phase angle: angle at spacecraft between Sun and Observer
                // If phase angle < 90° the spacecraft is sunlit (not in Earth's shadow)
                let isSunlit = false;
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
                    isSunlit = phaseRad < Math.PI / 2;

                    // Magnitude at this step (same formula as calculateMetrics)
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
        }
    };
})();
