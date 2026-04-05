const fs = require('fs');
const path = require('path');
const Astronomy = require('./astronomy.js');
const { PostHog } = require('posthog-node');

const posthog = new PostHog(process.env.POSTHOG_API_KEY, {
    host: process.env.POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
});

const LAUNCH_UTC = new Date('2026-04-01T22:35:12Z');
const EARTH_R_KM = 6371.0;
const MOON_R_KM = 1737.0;

function parseOEM(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const points = [];

    for (let line of lines) {
        line = line.trim();
        if (!line || !/^\d{4}/.test(line)) continue;

        const parts = line.split(/\s+/);
        if (parts.length < 7) continue;

        const dtStr = parts[0];
        const dt = new Date(dtStr + 'Z'); // Assume UTC
        const metSec = (dt.getTime() - LAUNCH_UTC.getTime()) / 1000;

        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        const vx = parseFloat(parts[4]);
        const vy = parseFloat(parts[5]);
        const vz = parseFloat(parts[6]);

        points.push({
            dt,
            metSec,
            x, y, z,
            vx, vy, vz
        });
    }
    return points;
}

function processPoints(points) {
    let minMoonDist = Infinity;
    let periluneMetSec = 0;

    const processed = points.map(p => {
        const time = Astronomy.MakeTime(p.dt);
        const moonVec = Astronomy.GeoVector("Moon", time, true);
        
        const moonX = moonVec.x * Astronomy.KM_PER_AU;
        const moonY = moonVec.y * Astronomy.KM_PER_AU;
        const moonZ = moonVec.z * Astronomy.KM_PER_AU;

        // Orion distance from Earth
        const rEarth = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z);
        const distEarthKm = parseFloat((rEarth - EARTH_R_KM).toFixed(2));

        // Orion distance from Moon
        const dx = p.x - moonX;
        const dy = p.y - moonY;
        const dz = p.z - moonZ;
        const rMoon = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const distMoonKm = parseFloat((rMoon - MOON_R_KM).toFixed(2));

        if (distMoonKm < minMoonDist) {
            minMoonDist = distMoonKm;
            periluneMetSec = p.metSec;
        }

        const speedKms = parseFloat(Math.sqrt(p.vx*p.vx + p.vy*p.vy + p.vz*p.vz).toFixed(6));

        return {
            epochUtc: p.dt.toISOString().replace('.000Z', 'Z'),
            metSec: parseFloat(p.metSec.toFixed(3)),
            orion: {
                x: parseFloat(p.x.toFixed(2)),
                y: parseFloat(p.y.toFixed(2)),
                z: parseFloat(p.z.toFixed(2)),
                vx: p.vx,
                vy: p.vy,
                vz: p.vz
            },
            moon: {
                x: parseFloat(moonX.toFixed(2)),
                y: parseFloat(moonY.toFixed(2)),
                z: parseFloat(moonZ.toFixed(2))
            },
            distEarthKm,
            distMoonKm,
            speedKms
        };
    });

    return { processed, periluneMetSec, minMoonDist };
}

function downsample(points, targetCount = 640) {
    if (points.length <= targetCount) return points;
    const step = (points.length - 1) / (targetCount - 1);
    const sampled = [];
    for (let i = 0; i < targetCount; i++) {
        const idx = Math.min(Math.round(i * step), points.length - 1);
        sampled.push(points[idx]);
    }
    return sampled;
}

const oemPath = path.join(__dirname, 'Artemis_II_OEM_2026_04_03_to_EI-1.asc');
const outPath = path.join(__dirname, 'mission-ephemeris.json');

async function main() {
    try {
        console.log('Parsing OEM file...');
        const points = parseOEM(oemPath);
        console.log(`Parsed ${points.length} points.`);

        console.log('Calculating Moon positions and derived metrics...');
        const { processed, periluneMetSec, minMoonDist } = processPoints(points);
        console.log(`New Perilune identified at MET ${periluneMetSec.toFixed(3)}s with distance ${minMoonDist} km`);

        console.log('Downsampling...');
        const sampled = downsample(processed, 640);

        const finalJson = {
            meta: {
                launchUtc: LAUNCH_UTC.toISOString().replace('.000Z', 'Z'),
                frame: 'EME2000',
                oemSource: 'Artemis_II_OEM_2026_04_03_to_EI-1.asc',
                moonSource: 'astronomy-engine@2.1.19',
                generated: new Date().toISOString().replace('.000Z', 'Z'),
                pointCount: sampled.length,
                periluneMetSec: periluneMetSec
            },
            points: sampled
        };

        fs.writeFileSync(outPath, JSON.stringify(finalJson));
        console.log(`Successfully wrote ${outPath}`);

        posthog.capture({
            distinctId: 'artemis-pipeline',
            event: 'ephemeris generation completed',
            properties: {
                raw_point_count: points.length,
                sampled_point_count: sampled.length,
                perilune_met_sec: periluneMetSec,
                min_moon_dist_km: minMoonDist,
                oem_source: 'Artemis_II_OEM_2026_04_03_to_EI-1.asc',
            },
        });
    } catch (err) {
        posthog.captureException(err, 'artemis-pipeline');
        posthog.capture({
            distinctId: 'artemis-pipeline',
            event: 'ephemeris generation failed',
            properties: {
                error_message: err.message,
            },
        });
        throw err;
    } finally {
        await posthog.shutdown();
    }
}

main();
