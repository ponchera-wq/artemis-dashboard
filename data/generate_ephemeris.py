#!/usr/bin/env python3
"""Generate mission-ephemeris.json from Artemis II OEM + DE440s Moon positions.

Reads the CCSDS OEM file (position + velocity in EME2000/km,km/s),
computes Moon geocentric position via skyfield + DE440s at each timestamp,
derives distance and speed scalars, and outputs a unified JSON dataset.

Requirements: pip install skyfield
"""
import json, math, sys
from datetime import datetime, timezone, timedelta

from skyfield.api import load as sf_load
from skyfield.api import Loader

LAUNCH_UTC = datetime(2026, 4, 1, 22, 35, 0, tzinfo=timezone.utc)
EARTH_R_KM = 6371.0
MOON_R_KM = 1737.0

def parse_oem(path):
    """Parse CCSDS OEM v2 file, returning list of dicts with full state vectors."""
    points = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or not line[0].isdigit():
                continue
            parts = line.split()
            if len(parts) < 7:
                continue
            ts = parts[0]
            x, y, z = float(parts[1]), float(parts[2]), float(parts[3])
            vx, vy, vz = float(parts[4]), float(parts[5]), float(parts[6])
            dt = datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)
            met_sec = (dt - LAUNCH_UTC).total_seconds()
            points.append({
                'dt': dt,
                'met_sec': met_sec,
                'x': x, 'y': y, 'z': z,
                'vx': vx, 'vy': vy, 'vz': vz,
            })
    return points

def compute_moon_positions(points):
    """Add Moon geocentric position (ICRF ~ EME2000) at each OEM timestamp."""
    loader = Loader('skyfield-data', verbose=True)
    ts = sf_load.timescale()
    eph = loader('de440s.bsp')
    earth = eph['earth']
    moon_body = eph['moon']

    for p in points:
        t = ts.from_datetime(p['dt'])
        # Geocentric Moon position in ICRF/J2000 (≈ EME2000), no light-time correction
        moon_pos = (moon_body - earth).at(t).position.km
        p['moon_x'] = float(moon_pos[0])
        p['moon_y'] = float(moon_pos[1])
        p['moon_z'] = float(moon_pos[2])

def compute_derived(points):
    """Compute distances and speed from state vectors."""
    for p in points:
        # Orion distance from Earth center, then surface
        r_earth = math.sqrt(p['x']**2 + p['y']**2 + p['z']**2)
        p['dist_earth_km'] = round(r_earth - EARTH_R_KM, 2)

        # Orion distance from Moon center, then surface
        dx = p['x'] - p['moon_x']
        dy = p['y'] - p['moon_y']
        dz = p['z'] - p['moon_z']
        r_moon = math.sqrt(dx**2 + dy**2 + dz**2)
        p['dist_moon_km'] = round(r_moon - MOON_R_KM, 2)

        # Speed (magnitude of velocity vector)
        p['speed_kms'] = round(math.sqrt(p['vx']**2 + p['vy']**2 + p['vz']**2), 6)

def downsample(points, target=640):
    """Uniform stride downsample, always keeping first and last."""
    if len(points) <= target:
        return points
    step = max(1, len(points) // target)
    sampled = points[::step]
    if sampled[-1] is not points[-1]:
        sampled.append(points[-1])
    return sampled

def to_json(points):
    """Convert to output schema."""
    rows = []
    for p in points:
        rows.append({
            'epochUtc': p['dt'].strftime('%Y-%m-%dT%H:%M:%S.') + f"{p['dt'].microsecond // 1000:03d}Z",
            'metSec': round(p['met_sec'], 3),
            'orion': {
                'x': round(p['x'], 2),
                'y': round(p['y'], 2),
                'z': round(p['z'], 2),
                'vx': round(p['vx'], 6),
                'vy': round(p['vy'], 6),
                'vz': round(p['vz'], 6),
            },
            'moon': {
                'x': round(p['moon_x'], 2),
                'y': round(p['moon_y'], 2),
                'z': round(p['moon_z'], 2),
            },
            'distEarthKm': p['dist_earth_km'],
            'distMoonKm': p['dist_moon_km'],
            'speedKms': p['speed_kms'],
        })
    return {
        'meta': {
            'launchUtc': '2026-04-01T22:35:12Z',
            'frame': 'EME2000',
            'oemSource': 'artemis2_oem.asc',
            'moonSource': 'skyfield/de440s.bsp',
            'generated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'pointCount': len(rows),
        },
        'points': rows,
    }

def main():
    oem_path = 'artemis2_oem.asc'
    out_path = 'mission-ephemeris.json'

    print(f'Parsing OEM: {oem_path}')
    points = parse_oem(oem_path)
    print(f'  Parsed {len(points)} state vectors')
    print(f'  Time range: MET {points[0]["met_sec"]:.1f}s to {points[-1]["met_sec"]:.1f}s')

    print('Computing Moon positions via DE440s...')
    compute_moon_positions(points)

    print('Computing derived quantities...')
    compute_derived(points)

    # Validation
    ca_point = min(points, key=lambda p: abs(p['met_sec'] - 460800))
    print(f'  Closest approach (MET ~{ca_point["met_sec"]:.0f}s):')
    print(f'    Moon distance: {ca_point["dist_moon_km"]:.1f} km')
    print(f'    Earth distance: {ca_point["dist_earth_km"]:.1f} km')
    print(f'    Speed: {ca_point["speed_kms"]:.3f} km/s ({ca_point["speed_kms"]*3600:.0f} km/h)')

    first = points[0]
    print(f'  First point (MET {first["met_sec"]:.1f}s):')
    print(f'    Moon distance: {first["dist_moon_km"]:.1f} km')
    print(f'    Earth distance: {first["dist_earth_km"]:.1f} km')

    print(f'Downsampling from {len(points)} to ~640 points...')
    sampled = downsample(points, 640)
    print(f'  Result: {len(sampled)} points')

    data = to_json(sampled)

    with open(out_path, 'w') as f:
        json.dump(data, f, separators=(',', ':'))

    import os
    size_kb = os.path.getsize(out_path) / 1024
    print(f'Wrote {out_path} ({size_kb:.1f} KB, {len(sampled)} points)')

if __name__ == '__main__':
    main()
