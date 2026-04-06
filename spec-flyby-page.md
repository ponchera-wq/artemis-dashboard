# Feature: flyby.html — Artemis II Lunar Flyby Cinematic Replay

## Goal
A standalone cinematic HTML page (`flyby.html`) that plays a time-lapse animation
of Orion's 8-hour lunar flyby (±4h around perilune). Accessible via a link in the
main dashboard nav next to "Observer". Fully self-contained — no external JS libs
except Three.js r128 (CDN). All data embedded from `data/flyby-animation-data.json`.

## Aesthetic Direction
**Deep space cinema.** Dark as the void. The Moon is the protagonist.
- Background: pure `#000` with a subtle star field (static canvas, ~400 stars, slight blue tint)
- Accent: `#00ffcc` (cyan, matches dashboard trajectory colour)
- Secondary: `#ff8844` (amber, return path colour)  
- Warning/critical: `#ffd700` (gold)
- Font: `'Orbitron', sans-serif` for headings/labels (load from Google Fonts),
  `'Share Tech Mono', monospace` for telemetry values (already used in dashboard)
- The page should feel like a NASA mission control replay screen from the future

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  ← ARTEMIS II LIVE          LUNAR FLYBY REPLAY    [NASA] │  header bar
├─────────────────────────────────────────────────────────┤
│                                                          │
│              THREE.JS 3D SCENE (full width)              │  ~60vh
│                    Moon + Orion arc                      │
│                                                          │
├──────────────┬──────────────────────────┬───────────────┤
│  TELEMETRY   │   TIMELINE SCRUBBER      │  EVENT PANEL  │
│  left col    │   (progress bar + time)  │  right col    │
├──────────────┴──────────────────────────┴───────────────┤
│         [▶ PLAY]  [⏸ PAUSE]  [↺ REPLAY]  [1×] [2×] [4×] │  controls
└─────────────────────────────────────────────────────────┘
```

## Three.js Scene

### Camera
- Fixed position looking at Moon center from slightly above-left
- `PerspectiveCamera(45, aspect, 0.1, 100000)`
- Camera position: `(0, 15000, 35000)` (km units, Moon at origin)
- `camera.lookAt(0, 0, 0)`
- No orbit controls — this is a replay, not interactive 3D
- Subtle camera drift: slow sinusoidal y-oscillation ±800km over the full animation
  gives a cinematic feel without being distracting

### Scale
- Work in actual km. Moon radius = 1737.4 km.
- Scene units = km directly (no SCENE_SCALE needed — distances are manageable)

### Moon
- `SphereGeometry(1737.4, 64, 64)`
- Texture: `https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg`
- `MeshPhongMaterial` with shininess 4 (matte)
- Moon rotation updated each frame from `moon_orient` data:
  - `moon.rotation.y = -sunLon * Math.PI / 180` (align sub-solar point)
  - This puts the terminator in the correct position
- Moon at scene origin `(0, 0, 0)`

### Sun lighting
- `DirectionalLight(0xfff5e0, 1.4)` — warm sunlight
- Position updated each frame from `sun[]` data, converted via simple rotation:
  - Sun data is in EME2000. For this Moon-centered scene, approximate:
    `sunLight.position.set(sd.x * 50000, sd.y * 50000, sd.z * 50000)`
  - The Sun is ~150M km away so direction only matters, not distance
- `AmbientLight(0x111133, 0.15)` — deep space fill, slight blue
- `PointLight(0x4488ff, 0.08, 80000)` at `(0, 20000, 0)` — earthshine effect

### Orion spacecraft
- Simple representation for this view (at Moon scale, Orion is microscopic):
  - A glowing `SphereGeometry(120, 8, 8)` point — `MeshBasicMaterial` cyan `#00ffcc`
  - A `PointLight(0x00ffcc, 0.4, 8000)` co-located with Orion (gives local glow)
  - A small `SphereGeometry(60, 8, 8)` white core inside
- Position: reconstructed from `arc[]` data:
  - `arc[i] = [metSec, x_km, y_km]` — Moon-relative 2D position
  - Place in 3D: `orion.position.set(x_km, 0, y_km)` (flyby in XZ plane)
  - The arc data already has the correct hyperbolic shape

### Flyby trajectory arc
- Draw the full arc as a static line (drawn once on init):
  - **Approach segment** (metSec < perilune): amber `0xff8844`, dashed, opacity 0.5
  - **Departure segment** (metSec > perilune): cyan `0x00ffcc`, dashed, opacity 0.5
- Draw the "already travelled" portion as a brighter solid line each frame
- Periapsis marker: small gold sphere `SphereGeometry(80)` at `(8281, 0, 0)` wait
  actually at `arc` point where moonDist is minimum

### Moon glow atmosphere
- `SphereGeometry(1737.4 * 1.05, 32, 32)` with `MeshBasicMaterial`:
  `{color: 0x334455, transparent: true, opacity: 0.12, side: THREE.BackSide}`

### Stars
- `BufferGeometry` with 2000 random points at radius 200,000 km
- `PointsMaterial({color: 0xaabbcc, size: 30, transparent: true, opacity: 0.6})`

### Earth (distant reference)
- Tiny `SphereGeometry(500, 16, 16)` at distance matching earthDist from data
- Direction: opposite of Sun (Earth is always roughly behind Orion from Moon's perspective)
- Blue `0x1a5fa8`, emissive `0x051828`
- Label "EARTH · {earthDist} km" drawn on canvas overlay

## Animation System

### Time control
```javascript
const WINDOW_DURATION = 28800; // 8h in seconds of mission time
const PERILUNE_OFFSET = 14400; // perilune is 4h into the window (MET 433520)

let animTime = 0;        // 0 to WINDOW_DURATION (mission seconds within window)
let playbackSpeed = 60;  // mission seconds per real second (1x = 60s/s = 8min playback)
let isPlaying = false;
let lastRealTime = null;
```

Playback speeds:
- **1×**: 60 mission-sec / real-sec → 480 real-seconds (8 min) total playback
- **2×**: 120 mission-sec / real-sec → 240 real-seconds (4 min)
- **4×**: 240 mission-sec / real-sec → 120 real-seconds (2 min)
- **8×**: 480 mission-sec / real-sec → 60 real-seconds (1 min)

Default: start at **2×** speed.

### Scrubber
- Range input `<input type="range" min="0" max="28800">`
- Updates `animTime` on drag (pauses playback while dragging)
- Shows current time relative to perilune: `T-4:00:00` → `T+0:00:00` → `T+4:00:00`

### Interpolation
Binary search + linear interpolation on all data arrays by `metSec`:
```javascript
function getMETSec(animTime) {
  return WINDOW_START + animTime; // 419120 + animTime
}
function interp(arr, metSec) {
  // binary search, linear interpolate
}
```

## Waypoint Event System

### Events (3 in window)
1. **MET 419060** — "Lunar Sphere of Influence" (animTime ≈ 0s, right at start)
2. **MET 433520** — "PERILUNE — Closest Approach" (animTime = 14400s)  
3. **MET 433760** — "Maximum Earth Distance" (animTime = 14640s)

### Auto-popup behaviour
When `animTime` reaches within 30 seconds of an event `metSec - WINDOW_START`:
- Pause playback (`isPlaying = false`)
- Show event card (see design below)
- After **5 seconds**, dismiss card and resume playback
- Don't re-trigger the same event if user scrubs back

### Event card design
Centered overlay card, appears with fade-in:
```
┌──────────────────────────────────────┐
│  ⚡ CRITICAL EVENT                    │
│                                      │
│  PERILUNE                            │  ← Orbitron, large
│  Closest Approach to Moon            │  ← subtitle
│                                      │
│  8,281 km altitude                   │  ← gold highlight
│                                      │
│  Orion reaches its closest point...  │  ← description text
│                                      │
│  [▶ Continue]          5s ██████░░  │  ← countdown bar
└──────────────────────────────────────┘
```
- Background: `rgba(4,8,20,0.94)` with `border: 1px solid rgba(0,255,204,0.5)`
- Glow: `box-shadow: 0 0 40px rgba(0,255,204,0.15)`
- Countdown bar auto-fills over 5s, clicking "Continue" dismisses immediately

## Telemetry Panel (left column)

Live-updating values during playback:

```
LUNAR FLYBY REPLAY
──────────────────
TIME FROM PERILUNE
T-03:42:18

MOON ALTITUDE
12,847 km

SPEED vs MOON  
1,247 km/s

APPROACH RATE
↓ 0.847 km/s   ← arrow flips to ↑ after perilune

ILLUMINATION
34.7%
▓▓▓░░░░░░░░░░░░  ← bar

EARTH DISTANCE
398,442 km

ECCENTRICITY
0.9847  [ELLIPTIC]  ← badge colour: cyan elliptic, amber hyperbolic

──────────────────
CLOSEST APPROACH
8,281 km  (record)
```

## Event Panel (right column)

Shows the 3 events as a vertical list. Current/upcoming events highlighted:
```
MISSION EVENTS
──────────────
✓ Lunar SOI Entry        ← green when passed
▶ PERILUNE ←NOW          ← gold pulse animation when active
  Max Earth Distance      ← dim when upcoming
```

Clicking an event scrubs the animation to that time.

## Controls bar

```
[▶ PLAY / ⏸ PAUSE]    [↺ REPLAY]    SPEED: [1×] [2×] [4×✓] [8×]
```

- Play/Pause: spacebar also works
- Replay: resets `animTime = 0`, starts playing
- Speed: highlight active speed button
- After animation completes (animTime = WINDOW_DURATION):
  - Pause
  - Show "REPLAY" button prominently in center of scene
  - Dim the 3D scene slightly

## Header bar
```
← ARTEMIS II LIVE    |    🌙 LUNAR FLYBY REPLAY    |    NASA JPL DATA
```
- Left link: `href="index.html"` — back to main dashboard
- Right: small NASA meatball logo or just text "NASA JPL DATA"
- Thin `1px solid rgba(0,255,204,0.2)` bottom border

## index.html nav link
Add next to the existing "OBSERVER" nav link:
```html
<a href="flyby.html" class="nav-link">FLYBY</a>
```
Or as an icon button matching the existing nav style.

## Files

### New files
- `flyby.html` — the entire page (self-contained HTML/CSS/JS + Three.js CDN)
- `data/flyby-animation-data.json` — already generated (37KB)

### Modified files  
- `index.html` — add FLYBY nav link

## Constraints
- Three.js r128 from CDN: `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
- Google Fonts: Orbitron + Share Tech Mono (already in dashboard CSS)
- No other external dependencies
- No build step — single HTML file with inline CSS and JS
- Must work on mobile (responsive layout: stack telemetry below scene on small screens)
- Vanilla JS only — no frameworks

## Acceptance criteria
- [ ] Page loads and auto-plays at 2× speed
- [ ] Moon texture loads and terminator is in correct position
- [ ] Sun direction updates each frame (terminator moves very slowly over 8h)
- [ ] Orion traces correct hyperbolic arc around Moon
- [ ] Approach arc amber, departure arc cyan
- [ ] Telemetry values update smoothly during playback
- [ ] Events auto-pause for 5s with card overlay
- [ ] Scrubber works — drag to any point
- [ ] Speed buttons work (1×/2×/4×/8×)
- [ ] Spacebar toggles play/pause
- [ ] After end: replay prompt appears
- [ ] Back link returns to index.html
- [ ] Mobile: scene stacks above telemetry, controls still usable

## Edge cases
- Moon texture load failure: fallback to grey `MeshPhongMaterial`
- `flyby-animation-data.json` load failure: show error state with message
- Very slow devices: cap to 30fps, use `requestAnimationFrame` with delta time
- Event auto-dismiss if user has already seen it (track with Set of triggered events)
- Scrubbing resets triggered-events tracking
