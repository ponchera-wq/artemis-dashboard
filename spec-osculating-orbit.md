# Feature: Osculating Orbit Visualisation + Popups

## Goal
Draw Orion's instantaneous osculating orbit as a live ellipse/hyperbola in the 3D
trajectory view, updating every frame. Click or hover the orbit to show a popup
explaining the current orbital elements in plain English.

## Data
- `data/osculating-elements.json` — 2,567 rows at 5-min steps, columns:
  `[metSec, ec, qr_km, inc_deg, om_deg, w_deg, tp_jd, a_km]`
- `a_km` is negative when hyperbolic (ec >= 1)
- Key moments baked into meta:
  - `tli_metSec`: 91520 (Day 1.06) — ec jumps 0.84→0.97
  - `perilune_metSec`: 433520 (Day 5.02) — ec = 0.82, orbit reshaped by Moon
  - `day475_metSec`: ~410400 — ec = 0.9999, QR = 34 km (Earth skim moment)

## Files to create/modify

### NEW: `js/osculating-orbit.js`
Standalone module. No dependencies except THREE (passed in) and the JSON file.
Exposes a single init function called from trajectory.js.

### MODIFY: `js/trajectory.js`
- Load osculating-elements.json after scene is built
- Call `OsculatingOrbit.init(scene, THREE, toScene, rotMat, SCENE_SCALE, popupEl, lctx, camera, W, H)`
- In animation loop, call `OsculatingOrbit.update(metSec)` every frame
- In click handler, call `OsculatingOrbit.handleClick(mx, my)` before waypoint checks

### MODIFY: `index.html`
- Add `<script src="js/osculating-orbit.js"></script>` after orion-model.js

### ADD: `data/osculating-elements.json`
Already generated. Drop in data/ directory.

## How the orbit is drawn (the maths)

Given elements [ec, qr_km, inc_deg, om_deg, w_deg]:

1. Semi-latus rectum: `p = qr_km * (1 + ec)` (works for both elliptic and hyperbolic)
2. For **elliptic** (ec < 1): trace true anomaly ν from -π to +π
3. For **hyperbolic** (ec >= 1): trace ν from -νmax to +νmax where `νmax = acos(-1/ec) - 0.01`
4. For each ν: `r = p / (1 + ec*cos(ν))` → point in orbital plane (x=r*cos(ν), y=r*sin(ν), z=0)
5. Rotate by argument of periapsis W (around Z), then inclination inc (around X), then RAAN OM (around Z)
6. Apply scene's `rotMat` and `SCENE_SCALE` (same as `toScene()`)
7. Cap r at 80 scene units to avoid insane lines when ec→1 and orbit "opens to infinity"

Use 180 points for elliptic orbits, 120 for hyperbolic.

## Visual design
- **Colour**: cyan `0x00ffcc` when ec < 1 (elliptic), amber `0xff8844` when ec >= 1 (hyperbolic)
  — matches existing trajectory line colours exactly
- **Style**: `LineDashedMaterial`, opacity 0.35, dashSize 0.4, gapSize 0.3
- **No glow copies** — keep it subtle, it shouldn't compete with main trajectory
- **Periapsis dot**: small `SphereGeometry(0.06)` marker at ν=0 point, same colour, opacity 0.8
- **Update**: rebuild geometry every 10 animation frames (not every frame — perf)
- **Fade near Moon**: when `moonDist < 5 scene units`, reduce opacity to 0.15 (Moon is
  distorting elements rapidly, less useful to show)

## 2D canvas label
Draw on `lctx` (the existing holographic canvas overlay) once per frame:
- Text: `OSCULATING ORBIT  EC {value}` at the periapsis dot's projected 2D position
- Colour: same cyan/amber as the line
- Font: `9px "Share Tech Mono",monospace` (matches existing callout style)
- Store as a click area (same pattern as waypoint labels) so clicks are detected

## Popup content (reuse existing `popupEl`)

The popup already exists and is styled. Reuse it exactly — same HTML structure as
waypoint popups. Content varies by mission phase:

### Pre-TLI (ec < 0.9, Day 1):
```
OSCULATING ORBIT
Highly Elliptical Earth Orbit
EC: 0.847  |  Periapsis: 6,379 km  |  Inclination: 28.3°
Orion is in a high elliptical parking orbit. Apogee ~76,000 km.
The TLI burn will stretch this orbit all the way to the Moon.
```

### Post-TLI coast (0.9 ≤ ec < 1.0, Days 1–5):
```
OSCULATING ORBIT
Trans-Lunar Trajectory
EC: 0.971  |  Periapsis: 6,574 km  |  Inclination: 28.3°
Orion is on a free-return trajectory. If all engines failed right now,
this orbit would loop around the Moon and bring the crew home automatically.
Apollo 13 used exactly this technique in 1970.
```

### Near Moon (Day 4.5–5.5, QR < 10,000 km):
```
OSCULATING ORBIT
Moon Gravity Assist — Elements Changing Rapidly
EC: 0.999  |  Periapsis: 34 km (Earth skim!)  |  Inclination: 28.3°
The Moon's gravity is actively reshaping this orbit in real time.
Watch the ellipse rotate as Orion swings around the Moon.
```

### Hyperbolic spike (ec >= 1.0):
```
OSCULATING ORBIT  ⚠ HYPERBOLIC
Escape Trajectory (Transient)
EC: 1.041  |  Semi-major axis: −6,441,710 km
At this instant, Orion's osculating orbit is hyperbolic —
moving faster than Earth escape velocity relative to its current position.
This is caused by the Moon's gravitational perturbation and lasts only minutes.
```

### Return coast (Days 6–10, ec > 0.9, W < 60°):
```
OSCULATING ORBIT
Return Trajectory
EC: 0.974  |  Periapsis: 6,043 km  |  Inclination: 28.3°
The Moon's flyby has permanently rotated the orbit plane (arg. of periapsis
changed from 79° to 43°). Orion is now aimed at the Pacific Ocean entry point.
```

## Phase detection logic
```javascript
function getPhase(ec, qr_km, w_deg, metSec) {
  if (ec >= 1.0) return 'hyperbolic';
  if (ec < 0.9)  return 'parking';
  var moonProximity = metSec > 380000 && metSec < 490000; // Days 4.4–5.7
  if (moonProximity && qr_km < 10000) return 'moon-flyby';
  if (metSec > 433520) return 'return'; // past perilune
  return 'tli-coast';
}
```

## Click handling
- Store the periapsis dot's projected 2D position + radius (30px hit area)
- In trajectory.js click handler, check this BEFORE the waypoint loop
- On hit: populate and show `popupEl` using same style as waypoint popups
- Set `popupOpen = true` (existing flag used by the close logic)

## Constraints
- Three.js r128 only — no newer APIs
- No build step, vanilla JS
- `OsculatingOrbit` must be a plain IIFE global (like other modules)
- Must gracefully no-op if JSON fails to load (try/catch + isReady flag)
- Must not break existing click/drag/waypoint behaviour
- Geometry rebuild capped at every 10 frames for performance
- Do NOT use `THREE.Line2` (not in r128) — use standard `THREE.Line` with `LineDashedMaterial`

## Acceptance criteria
- [ ] Orbit ellipse/hyperbola visible in 3D view, correct colour per ec value
- [ ] Orbit visually rotates during Day 5 lunar flyby
- [ ] Periapsis dot visible
- [ ] Click on orbit line or dot opens popup with correct phase text
- [ ] EC value in canvas label updates live
- [ ] No console errors, no perf regression (stays 60fps)
- [ ] Graceful fallback if JSON missing

## Edge cases
- ec very close to 1.0: cap νmax conservatively, don't draw degenerate hyperbola
- ec > 1.04 (Day 3.68 spike): hyperbolic branch will be very open — cap at scene boundary
- Orbit partially behind Earth: LineDashedMaterial with depthTest=true handles occlusion naturally
- Mobile: popup positioning same logic as waypoints (flip left if near right edge)
