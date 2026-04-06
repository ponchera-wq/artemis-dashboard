# Feature: Lunar Flyby Moonview — Accurate Lighting, Moon Orientation & Camera Preset

## Goal
Add a `moonview` camera preset to the existing Three.js trajectory scene that:
1. Positions the camera close to the Moon during the flyby window (Day 4.5–5.5)
2. Updates `sunLight` direction every frame from real JPL Sun vector data
3. Replaces the fake `moon.rotation.y += 0.0003` with accurate sub-solar orientation
4. Draws a flyby HUD overlay on the existing `lctx` canvas when `moonview` is active
5. Shows a flyby info panel popup when the preset activates

## Data files
- `data/flyby-lighting.json` — 1,284 rows at 10-min steps
  - `sun[]`: `[metSec, sx, sy, sz]` — unit Sun direction in EME2000 (already converted from ecliptic)
  - `moon[]`: `[metSec, obs_lon, obs_lat, sun_lon, sun_lat, np_ang, np_dist]`
    - `obs_lon/lat`: sub-Earth point on Moon surface (deg, Moon body-fixed)
    - `sun_lon/lat`: sub-solar point on Moon surface (deg)
    - `np_ang`: Moon north pole position angle (deg)

## Files to modify
- `js/trajectory.js` — all changes go here
- `index.html` — add one script tag for the data loader module

## NEW FILE: `js/flyby-lighting.js`
Standalone loader/interpolator. Same pattern as `observer-horizons.js`.

```javascript
const FlybyLighting = (() => {
  let _sun = null, _moon = null, _ready = false, _loadPromise = null;

  function _bisect(arr, metSec) {
    let lo = 0, hi = arr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (arr[mid][0] <= metSec) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  function _interp(arr, metSec) {
    if (!arr || !arr.length) return null;
    if (metSec <= arr[0][0]) return arr[0];
    if (metSec >= arr[arr.length-1][0]) return arr[arr.length-1];
    const i = _bisect(arr, metSec);
    const r0 = arr[i], r1 = arr[i+1];
    if (!r1) return r0;
    const t = (metSec - r0[0]) / (r1[0] - r0[0]);
    return r0.map((v, j) => j === 0 ? metSec : v + t * (r1[j] - v));
  }

  function load() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch('data/flyby-lighting.json')
      .then(r => r.json())
      .then(d => { _sun = d.sun; _moon = d.moon; _ready = true; })
      .catch(e => { console.warn('[FlybyLighting] load failed:', e); });
    return _loadPromise;
  }

  // Returns {x,y,z} unit vector in EME2000, or null
  function getSunDir(metSec) {
    const r = _interp(_sun, metSec);
    return r ? {x: r[1], y: r[2], z: r[3]} : null;
  }

  // Returns {obsLon, obsLat, sunLon, sunLat, npAng} or null
  function getMoonOrientation(metSec) {
    const r = _interp(_moon, metSec);
    return r ? {obsLon: r[1], obsLat: r[2], sunLon: r[3], sunLat: r[4], npAng: r[5]} : null;
  }

  function isReady() { return _ready; }
  return { load, isReady, getSunDir, getMoonOrientation };
})();
```

## Changes to `trajectory.js`

### 1. Load FlybyLighting after scene init (~line 24, after MissionEphemeris.ready.then)
```javascript
FlybyLighting.load();
ObserverHorizons.load(); // if not already there
```

### 2. Replace fake moon rotation (line 1114)
REMOVE:
```javascript
earth.rotation.y += 0.00175; moon.rotation.y += 0.0003;
```
REPLACE WITH:
```javascript
earth.rotation.y += 0.00175;
// Moon orientation from real sub-solar data
if (FlybyLighting.isReady()) {
  var mo = FlybyLighting.getMoonOrientation(metSec);
  if (mo) {
    // Moon is tidally locked — near side (lon=0) always faces Earth.
    // obs_lon tells us which Moon longitude faces Earth right now.
    // Rotate moon mesh so that longitude faces toward Earth (scene origin).
    // Moon texture lon=0 is near side. We rotate by -obsLon in radians.
    var moonFaceAngle = -mo.obsLon * Math.PI / 180;
    // Also account for the scene's rotMat rotation of the Moon's position.
    // The Moon position in scene is already rotated, so we need the
    // angle of moon.position in the XZ plane to align the face correctly.
    var moonSceneAngle = Math.atan2(moon.position.x, moon.position.z);
    moon.rotation.y = moonSceneAngle + moonFaceAngle;
  }
} else {
  moon.rotation.y += 0.0003; // fallback if data not loaded
}
```

### 3. Update sunLight direction every frame (in animation loop, after metSec is set)
Add after line 959 (after `var pulse = ...`):
```javascript
// Update sun direction from JPL data
if (FlybyLighting.isReady()) {
  var sd = FlybyLighting.getSunDir(metSec);
  if (sd) {
    // Convert EME2000 direction to scene space using rotMat
    var sunVec = new THREE.Vector3(sd.x, sd.y, sd.z).applyMatrix4(rotMat);
    sunLight.position.copy(sunVec.multiplyScalar(200));
  }
}
```

### 4. Add `moonview` preset to PRESETS object (after existing `moon` preset, ~line 662)
```javascript
moonview: {
  label: '🌙🚀',
  title: 'Lunar Flyby',
  // Only show button during flyby window (Day 4–6)
  // Position camera ~15,000 km "above" Moon in scene units,
  // offset perpendicular to Orion's approach vector so both
  // Moon and Orion are in frame
  pos: function() {
    var mp = moon.position.clone();
    var op = orionGroup.position.clone();
    // Vector from Moon toward Orion, then offset perpendicular
    var toOrion = new THREE.Vector3().subVectors(op, mp).normalize();
    var up = new THREE.Vector3(0, 1, 0);
    var perp = new THREE.Vector3().crossVectors(toOrion, up).normalize();
    // Camera: 8 scene units from Moon, offset sideways so we see the approach arc
    return mp.clone()
      .add(toOrion.clone().multiplyScalar(3))
      .add(perp.clone().multiplyScalar(4))
      .add(new THREE.Vector3(0, 5, 0));
  },
  look: function() { return moon.position.clone(); },
  isFlyby: true  // flag for conditional button visibility
}
```

### 5. Make moonview button conditionally visible
In `updatePresetBtns()`, add logic to show/hide the moonview button:
```javascript
// Show moonview button only during Day 4–6 window
var nowMetForBtn = (Date.now() - LAUNCH_UTC) / 1000;
var inFlybyWindow = nowMetForBtn > 345600 && nowMetForBtn < 518400; // Day 4–6
if (presetBtns['moonview']) {
  presetBtns['moonview'].style.display = inFlybyWindow ? '' : 'none';
}
```

### 6. Add moonview tracking to camMode handler (~line 1127, inside `camMode === 'track'` block)
```javascript
else if (activePreset === 'moonview') {
  var mvp = PRESETS.moonview.pos();
  var mvl = moon.position.clone();
  if (lerpT < 1) {
    lerpT = Math.min(1, lerpT + (1/60) / lerpDuration);
    var e6 = smoothEase(lerpT);
    camera.position.lerpVectors(lerpFrom.pos, mvp, e6);
    camLookAt.lerpVectors(lerpFrom.look, mvl, e6);
  } else {
    camera.position.lerp(mvp, 0.04);
    camLookAt.lerp(mvl, 0.04);
  }
  camera.lookAt(camLookAt);
}
```

Also add `'moonview'` to the track mode condition on ~line 686:
```javascript
var mode = (key === 'orion' || key === 'earthview' || key === 'iss' 
         || key === 'apollo' || key === 'moonview') ? 'track' : 'lerp';
```

### 7. Flyby HUD overlay on lctx canvas
Add to the 2D canvas drawing section (after the existing callouts, ~line 1185).
Only draw when `activePreset === 'moonview'`:

```javascript
// ── Moonview HUD ──
if (activePreset === 'moonview' && ObserverHorizons.isReady()) {
  var obs = ObserverHorizons.getAll(metSec);
  if (obs) {
    var secsToPerilune = ObserverHorizons.getSecsToPerilune(metSec);
    var moonDistKm = Math.round(obs.moonDist_km).toLocaleString();
    var moonSpeedKms = Math.abs(obs.moonDot_km_s).toFixed(2);
    var illu = obs.illu_pct.toFixed(1);

    // Countdown / elapsed
    var countStr;
    if (secsToPerilune > 0) {
      var ch = Math.floor(secsToPerilune / 3600);
      var cm = Math.floor((secsToPerilune % 3600) / 60);
      var cs = Math.floor(secsToPerilune % 60);
      countStr = 'PERILUNE IN ' + String(ch).padStart(2,'0') + ':' 
               + String(cm).padStart(2,'0') + ':' + String(cs).padStart(2,'0');
    } else {
      var ago = Math.abs(secsToPerilune);
      var ah = Math.floor(ago / 3600);
      var am = Math.floor((ago % 3600) / 60);
      countStr = 'PERILUNE +' + ah + 'h ' + am + 'm ago';
    }

    // HUD panel — top-left of canvas
    lctx.save();
    lctx.fillStyle = 'rgba(4,8,20,0.82)';
    lctx.strokeStyle = 'rgba(0,255,204,0.4)';
    lctx.lineWidth = 1;
    lctx.beginPath();
    lctx.roundRect(12, 12, 220, 110, 4);
    lctx.fill(); lctx.stroke();

    lctx.font = 'bold 9px "Share Tech Mono",monospace';
    lctx.fillStyle = '#00ffcc';
    lctx.fillText('LUNAR FLYBY', 22, 30);

    lctx.font = '8px "Share Tech Mono",monospace';
    lctx.fillStyle = 'rgba(200,220,255,0.9)';
    lctx.fillText('ALT:   ' + moonDistKm + ' km', 22, 48);
    lctx.fillText('SPEED: ' + moonSpeedKms + ' km/s', 22, 62);
    lctx.fillText('ILLU:  ' + illu + '%', 22, 76);

    // Closest approach callout
    lctx.fillStyle = 'rgba(180,220,180,0.6)';
    lctx.fillText('CLOSEST: 8,281 km', 22, 90);

    // Countdown — highlight if near perilune
    lctx.font = 'bold 8px "Share Tech Mono",monospace';
    lctx.fillStyle = Math.abs(secsToPerilune) < 3600 ? '#ffd700' : 'rgba(0,255,204,0.7)';
    lctx.fillText(countStr, 22, 108);

    lctx.restore();
  }
}
```

### 8. Moonview activation popup
When the moonview preset button is clicked, show a brief informational popup.
Add inside the preset button click handler, after `activePreset = key`:

```javascript
if (key === 'moonview') {
  // Show flyby info popup
  var flybyInfo = document.createElement('div');
  flybyInfo.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
    'background:rgba(4,8,20,0.92);border:1px solid rgba(0,255,204,0.4);border-radius:6px;' +
    'padding:16px 20px;max-width:320px;z-index:10;font-family:"Share Tech Mono",monospace;' +
    'color:#c8d0e0;font-size:0.75rem;line-height:1.6;';
  flybyInfo.innerHTML = 
    '<div style="color:#00ffcc;font-weight:bold;font-size:0.85rem;margin-bottom:8px">🌙 LUNAR FLYBY VIEW</div>' +
    '<div>Closest approach: <span style="color:#ffd700">8,281 km</span> above the lunar surface.</div>' +
    '<div style="margin-top:6px">Sun direction, Moon orientation and terminator position are all real JPL ephemeris data.</div>' +
    '<div style="margin-top:6px;color:rgba(150,180,210,0.7)">The Moon appears nearly full from Orion — Earth and Sun are in almost the same direction during flyby.</div>' +
    '<div style="margin-top:10px;font-size:0.65rem;color:rgba(100,130,170,0.6)">Click anywhere to dismiss</div>';
  container.appendChild(flybyInfo);
  flybyInfo.addEventListener('click', function() { flybyInfo.remove(); });
  setTimeout(function() { if (flybyInfo.parentElement) flybyInfo.remove(); }, 8000);
}
```

## Constraints
- Three.js r128 only
- No new npm dependencies
- `FlybyLighting` must gracefully no-op if JSON fails (all updates behind `isReady()` guard)
- Moon rotation fallback to `+= 0.0003` if data not loaded
- sunLight position update only when `FlybyLighting.isReady()` — existing static position
  `(20, 8, 14)` is the fallback
- `moonview` button hidden outside Day 4–6 window (don't add/remove DOM — use display:none)
- `lctx.roundRect` may not exist in all browsers — wrap in try/catch or use `lctx.rect` as fallback
- Do NOT break existing moon preset or any other preset

## Acceptance criteria
- [ ] `moonview` button appears in the POV bar during Day 4–6 window, hidden otherwise
- [ ] Clicking moonview flies camera to Moon with Orion visible in frame
- [ ] Moon's lit side matches real Sun direction (terminator visible on sphere)
- [ ] `sunLight` position updates each frame from real data
- [ ] Moon face no longer drifts with fake rotation — near side faces Earth
- [ ] Flyby HUD shows live altitude, speed, illumination, countdown
- [ ] Info popup appears on moonview activation, dismisses on click or after 8s
- [ ] All existing presets work unchanged
- [ ] No console errors, graceful fallback if flyby-lighting.json fails to load

## Edge cases
- Before flyby window: moonview button hidden, sun/moon updates still apply (improves
  whole-scene lighting accuracy throughout mission)
- After splashdown: button hidden, data still interpolates correctly to last known values
- `lctx.roundRect` not available in Safari <15.4 — use rect() fallback
- Camera lerp: moonview uses 'track' mode so it follows Moon as it moves in scene
- If ObserverHorizons not loaded, HUD falls back gracefully (guard with isReady())
