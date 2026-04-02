#!/usr/bin/env python3
"""Parse Artemis II OEM ephemeris file into a downsampled JSON trajectory."""
import json, re, sys
from datetime import datetime, timezone

lines = open('artemis2_oem.asc').readlines()
data = []
for line in lines:
    line = line.strip()
    if not line or not line[0].isdigit():
        continue
    parts = line.split()
    if len(parts) < 7:
        continue
    ts = parts[0]
    x, y, z = float(parts[1]), float(parts[2]), float(parts[3])
    # Parse timestamp to epoch ms
    dt = datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)
    epoch_ms = int(dt.timestamp() * 1000)
    data.append({'t': epoch_ms, 'x': x, 'y': y, 'z': z})

print(f"Parsed {len(data)} points, time range: {data[0]['t']} - {data[-1]['t']}")

# Downsample to ~500 points, always keeping first and last
target = 500
step = max(1, len(data) // target)
sampled = data[::step]
if sampled[-1]['t'] != data[-1]['t']:
    sampled.append(data[-1])

print(f"Downsampled to {len(sampled)} points")

with open('trajectory.json', 'w') as f:
    json.dump(sampled, f, separators=(',', ':'))

print(f"Wrote trajectory.json ({len(sampled)} points)")
