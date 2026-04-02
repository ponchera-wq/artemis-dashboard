// trajectory.js — 3D Three.js trajectory visualization
// ── TRAJECTORY 3D — CINEMATIC SCI-FI ─────────────────────────────────
(function() {
  const container = document.getElementById('trajectory-3d');
  if (!container || typeof THREE === 'undefined') return;

  const MISSION_MS = 10 * 24 * 3600 * 1000;
  const EARTH_R_KM = 6371;
  const SCENE_EARTH_R = 0.9;
  const SCENE_SCALE = SCENE_EARTH_R / EARTH_R_KM;
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';

  // Fetch real trajectory data, then initialize
  fetch('data/trajectory.json')
    .then(function(r) { return r.json(); })
    .then(function(trajData) { init(trajData); })
    .catch(function(err) { console.error('Failed to load trajectory data:', err); });

  function init(trajData) {
    // Mission time range from real data
    var T_START = trajData[0].t;
    var T_END = trajData[trajData.length - 1].t;

    // Compute Moon position at lunar flyby (T+128h) to define the viewing frame
    // We rotate all data so Earth-Moon line is along +X axis, making the trajectory
    // look like the canonical NASA figure-8 diagram
    var flybyEpoch = T_START + 460800 * 1000; // T+128h closest approach
    var moonAtFlyby;
    if (typeof Astronomy !== 'undefined') {
      var mv = Astronomy.GeoMoon(new Date(flybyEpoch));
      var AU_KM2 = 149597870.7;
      moonAtFlyby = new THREE.Vector3(mv.x * AU_KM2, mv.y * AU_KM2, mv.z * AU_KM2);
    } else {
      // Fallback: use trajectory point near flyby as rough Moon direction
      var fbIdx = 0, fbDt = Infinity;
      trajData.forEach(function(p, i) { var dt = Math.abs(p.t - flybyEpoch); if (dt < fbDt) { fbDt = dt; fbIdx = i; } });
      var fbp = trajData[fbIdx];
      moonAtFlyby = new THREE.Vector3(fbp.x, fbp.y, fbp.z);
    }

    // Build rotation matrix: X axis = Earth→Moon, Y = up (perpendicular), Z = cross
    var xAxis = moonAtFlyby.clone().normalize();
    // Use trajectory out-of-plane to find Y: cross of xAxis with a trajectory tangent near flyby
    var fbIdx2 = 0, fbDt2 = Infinity;
    trajData.forEach(function(p, i) { var dt = Math.abs(p.t - flybyEpoch); if (dt < fbDt2) { fbDt2 = dt; fbIdx2 = i; } });
    var tangent3d = new THREE.Vector3(
      trajData[Math.min(fbIdx2+1, trajData.length-1)].x - trajData[Math.max(fbIdx2-1, 0)].x,
      trajData[Math.min(fbIdx2+1, trajData.length-1)].y - trajData[Math.max(fbIdx2-1, 0)].y,
      trajData[Math.min(fbIdx2+1, trajData.length-1)].z - trajData[Math.max(fbIdx2-1, 0)].z
    ).normalize();
    var zAxis = new THREE.Vector3().crossVectors(xAxis, tangent3d).normalize();
    var yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

    // Rotation matrix (rows are new basis vectors)
    var rotMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).transpose();

    // Convert real km coords to rotated scene coords
    var trajScene = trajData.map(function(p) {
      var v = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(rotMat);
      return { t: p.t, pos: new THREE.Vector3(v.x * SCENE_SCALE, v.y * SCENE_SCALE, v.z * SCENE_SCALE) };
    });

    // Build the allPts array for rendering
    var allPts = trajScene.map(function(p) { return p.pos.clone(); });
    var N_PTS = allPts.length;
    var T_SPAN = T_END - T_START;

    // Helper: find Orion position by timestamp (binary search + lerp)
    function getPosByTime(epochMs) {
      if (epochMs <= T_START) return { pos: allPts[0].clone(), idx: 0, frac: 0 };
      if (epochMs >= T_END) return { pos: allPts[N_PTS - 1].clone(), idx: N_PTS - 1, frac: 1 };
      // Binary search
      var lo = 0, hi = trajScene.length - 1;
      while (lo < hi - 1) {
        var mid = (lo + hi) >> 1;
        if (trajScene[mid].t <= epochMs) lo = mid; else hi = mid;
      }
      var f = (epochMs - trajScene[lo].t) / (trajScene[hi].t - trajScene[lo].t);
      var pos = trajScene[lo].pos.clone().lerp(trajScene[hi].pos, f);
      return { pos: pos, idx: lo, frac: (epochMs - T_START) / T_SPAN };
    }

    var scene = new THREE.Scene();
    var W = container.clientWidth || 400;
    var H = container.clientHeight || 300;
    var camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 1000);

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    Object.assign(renderer.domElement.style, { position:'absolute',top:'0',left:'0',width:'100%',height:'100%' });
    container.appendChild(renderer.domElement);

    // 2D overlay canvas for holographic callouts
    var lc = document.createElement('canvas');
    lc.width = W; lc.height = H;
    Object.assign(lc.style, { position:'absolute',top:'0',left:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'1' });
    container.appendChild(lc);
    var lctx = lc.getContext('2d');

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0x1a2a6a, 0.2));
    var sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
    sunLight.position.set(20, 8, 14);
    scene.add(sunLight);
    var fillLight = new THREE.PointLight(0x2244aa, 0.3, 80);
    fillLight.position.set(-10, -5, -8);
    scene.add(fillLight);
    var orionLight = new THREE.PointLight(0xfff5e0, 0.5, 2);
    scene.add(orionLight);

    // ── Texture loader helper ──
    function loadTex(urls, cb) {
      var i = 0;
      (function tryNext() { if (i >= urls.length) return; loader.load(urls[i], cb, undefined, function() { i++; tryNext(); }); })();
    }

    // ── Earth ──
    var earthMat = new THREE.MeshPhongMaterial({ color: 0x1a5fa8, emissive: 0x051828, shininess: 35, specular: 0x3377bb });
    var earth = new THREE.Mesh(new THREE.SphereGeometry(SCENE_EARTH_R, 32, 32), earthMat);
    scene.add(earth);
    loadTex([
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
    ], function(tex) { earthMat.map = tex; earthMat.color.set(0xffffff); earthMat.needsUpdate = true; });
    // Atmosphere halos
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.15, side: THREE.BackSide })));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x4A90D9, transparent: true, opacity: 0.08, side: THREE.BackSide })));

    // LEO orbit ring
    var leoPts = [];
    for (var i = 0; i <= 80; i++) { var a = (i/80)*Math.PI*2; leoPts.push(new THREE.Vector3(1.35*Math.cos(a), 0.22*Math.sin(a), 1.35*Math.sin(a)*0.96)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(leoPts), new THREE.LineBasicMaterial({ color: 0x4A90D9, transparent: true, opacity: 0.2 })));

    // ── Moon — positioned dynamically via astronomy-engine ──
    // Real Moon radius at scene scale would be 3474/2 * SCENE_SCALE = 0.245
    // But that's too small to see — use exaggerated size for visibility
    var MOON_SCENE_R = 1.5;
    var moonMat = new THREE.MeshPhongMaterial({ color: 0xaaa89e, emissive: 0x0a0a09, shininess: 4 });
    var moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_SCENE_R, 32, 32), moonMat);
    scene.add(moon);
    loadTex(['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg'],
      function(tex) { moonMat.map = tex; moonMat.color.set(0xdddddd); moonMat.needsUpdate = true; });
    var moonGlow = new THREE.Mesh(new THREE.SphereGeometry(MOON_SCENE_R * 1.2, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xccccbb, transparent: true, opacity: 0.08, side: THREE.BackSide }));
    scene.add(moonGlow);

    // Compute Moon position using astronomy-engine, rotated into scene frame
    var AU_KM = 149597870.7;
    function getMoonScenePos(date) {
      if (typeof Astronomy === 'undefined') {
        return new THREE.Vector3(8.2, 0, 0);
      }
      var mv = Astronomy.GeoMoon(date);
      var v = new THREE.Vector3(mv.x * AU_KM, mv.y * AU_KM, mv.z * AU_KM);
      v.applyMatrix4(rotMat);
      return new THREE.Vector3(v.x * SCENE_SCALE, v.y * SCENE_SCALE, v.z * SCENE_SCALE);
    }

    // Set initial Moon position
    var moonPos = getMoonScenePos(new Date());
    moon.position.copy(moonPos);
    moonGlow.position.copy(moonPos);

    // ── Starfield ──
    var STAR_COUNT = 600;
    var starPos = new Float32Array(STAR_COUNT * 3);
    var starSizes = new Float32Array(STAR_COUNT);
    for (var i = 0; i < STAR_COUNT; i++) {
      var th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1), r = 200 + Math.random()*100;
      starPos[i*3] = r*Math.sin(ph)*Math.cos(th); starPos[i*3+1] = r*Math.sin(ph)*Math.sin(th); starPos[i*3+2] = r*Math.cos(ph);
      starSizes[i] = 0.05 + Math.random() * 0.15;
    }
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xccddee, size: 0.10, sizeAttenuation: true, transparent: true, opacity: 0.6 })));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(280, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x1a0a3a, transparent: true, opacity: 0.12, side: THREE.BackSide })));

    // ── Earth–Moon reference line ──
    var emBuf = new Float32Array(6);
    var emGeo = new THREE.BufferGeometry();
    emGeo.setAttribute('position', new THREE.BufferAttribute(emBuf, 3));
    var emLine = new THREE.Line(emGeo, new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, dashSize: 0.25, gapSize: 0.18 }));
    scene.add(emLine);

    // ── Trajectory lines ──
    // Upcoming path — dashed cyan
    var upGeo = new THREE.BufferGeometry().setFromPoints(allPts);
    var upMat = new THREE.LineDashedMaterial({ color: 0x00ffcc, transparent: true, opacity: 1.0, linewidth: 2, dashSize: 1.5, gapSize: 1.0 });
    var upLine = new THREE.Line(upGeo, upMat);
    upLine.computeLineDistances();
    scene.add(upLine);
    // Glow layer
    var upGlowGeo = new THREE.BufferGeometry().setFromPoints(allPts);
    var upGlowMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.3, linewidth: 3, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Line(upGlowGeo, upGlowMat));

    // Completed path — solid white
    var C_GREEN = new THREE.Color(0xffffff);
    var completedGeo = new THREE.BufferGeometry();
    var completedMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0 });
    var completedLine = new THREE.Line(completedGeo, completedMat);
    scene.add(completedLine);
    var compGlowGeo = new THREE.BufferGeometry();
    var compGlowMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.3, linewidth: 3, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Line(compGlowGeo, compGlowMat));
    // Active leading-edge segment
    var activeSegGeo = new THREE.BufferGeometry();
    var activeSegMat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.85 });
    scene.add(new THREE.Line(activeSegGeo, activeSegMat));

    // Flame/gradient trail
    var FLAME_LEN = 18;
    var flameGeo = new THREE.BufferGeometry();
    var flameMat = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    scene.add(new THREE.Line(flameGeo, flameMat));
    var flameGlowGeo = new THREE.BufferGeometry();
    var flameGlowMat = new THREE.LineBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Line(flameGlowGeo, flameGlowMat));

    // ── Waypoints ──
    var WAYPOINTS = [
      { label:'LAUNCH',            met:'T+00:00:00', metSec:0,      desc:'SLS rocket lifts off from Pad 39B at Kennedy Space Center with 8.8 million pounds of thrust.', crit:'CRITICAL', status:'nominal', activeWin:600 },
      { label:'SRB SEP',           met:'T+00:02:12', metSec:132,    desc:'Solid Rocket Boosters separate after burning 5.5 million pounds of propellant.', crit:'CRITICAL', status:'nominal', activeWin:600 },
      { label:'CORE MECO',         met:'T+00:08:06', metSec:486,    desc:'Core stage main engine cutoff. Core stage separates from ICPS upper stage.', crit:'HIGH', status:'nominal', activeWin:600 },
      { label:'SOLAR ARRAYS',      met:'T+00:18:00', metSec:1080,   desc:'Orion solar arrays deploy, providing electrical power to the spacecraft.', crit:'HIGH', status:'nominal', activeWin:900 },
      { label:'PERIGEE RAISE',     met:'T+00:49:00', metSec:2940,   desc:'ICPS fires to raise perigee altitude, setting up for apogee raise.', crit:'HIGH', status:'nominal', activeWin:900 },
      { label:'APOGEE RAISE',      met:'T+01:30:00', metSec:5400,   desc:'ICPS second burn raises apogee to high elliptical orbit.', crit:'HIGH', status:'nominal', activeWin:900 },
      { label:'ICPS SEP',          met:'T+02:00:00', metSec:7200,   desc:'ICPS upper stage separates. Orion is now free-flying.', crit:'CRITICAL', status:'nominal', activeWin:600 },
      { label:'PROX OPS',          met:'T+02:30:00', metSec:9000,   desc:'Proximity operations demo \u2014 Orion maneuvers near separated ICPS.', crit:'HIGH', status:'nominal', activeWin:7200 },
      { label:'TLI BURN',          met:'T+25:00:00', metSec:90000,  desc:'European Service Module main engine fires to send Orion on a free-return trajectory to the Moon.', crit:'CRITICAL', status:'nominal', activeWin:3600 },
      { label:'TCB-1',             met:'T+52:00:00', metSec:187200, desc:'Outbound trajectory correction burn 1 \u2014 fine-tunes course toward the Moon.', crit:'HIGH', status:'nominal', activeWin:900 },
      { label:'O2O LASER',         met:'T+80:00:00', metSec:288000, desc:'Optical to Orion laser comms test \u2014 4K video downlink via laser from deep space.', crit:'HIGH', status:'nominal', activeWin:7200 },
      { label:'LUNAR SOI',         met:'T+100:00:00',metSec:360000, desc:'Orion enters the Moon\u2019s gravitational sphere of influence.', crit:'HIGH', status:'nominal', activeWin:7200 },
      { label:'CLOSEST APPROACH',  met:'T+128:00:00',metSec:460800, desc:'Orion passes ~6,500 km above the lunar far side. Breaks Apollo 13\u2019s distance record of 400,171 km.', crit:'CRITICAL', status:'nominal', activeWin:3600 },
      { label:'FAR SIDE LOS',      met:'T+128:30:00',metSec:462600, desc:'Orion passes behind the Moon. ~41 minutes of planned communications blackout.', crit:'CRITICAL', status:'nominal', activeWin:3600 },
      { label:'SIGNAL ACQ',        met:'T+129:11:00',metSec:465060, desc:'Signal reacquired after far-side pass. Crew reports status.', crit:'HIGH', status:'nominal', activeWin:1800 },
      { label:'RETURN TCB',        met:'T+150:00:00',metSec:540000, desc:'Return trajectory correction burn \u2014 targets Pacific Ocean splashdown zone.', crit:'HIGH', status:'nominal', activeWin:900 },
      { label:'SM SEP',            met:'T+228:00:00',metSec:820800, desc:'Service module separates. Only crew module continues to re-entry.', crit:'CRITICAL', status:'nominal', activeWin:600 },
      { label:'ENTRY',             met:'T+228:30:00',metSec:822600, desc:'Atmospheric entry at 40,000 km/h. Heat shield reaches 2,800\u00b0C during skip re-entry.', crit:'CRITICAL', status:'nominal', activeWin:1800 },
      { label:'PEAK HEATING',      met:'T+228:45:00',metSec:823500, desc:'Peak heating \u2014 heat shield surface reaches 2,800\u00b0C.', crit:'CRITICAL', status:'nominal', activeWin:600 },
      { label:'CHUTES',            met:'T+229:05:00',metSec:824700, desc:'Main parachutes deploy at ~7,600m altitude, slowing Orion to ~30 km/h.', crit:'CRITICAL', status:'nominal', activeWin:600 },
      { label:'SPLASHDOWN',        met:'T+229:10:00',metSec:825000, desc:'Orion splashes down in the Pacific Ocean. Recovery by USS Portland.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    ];

    // Place waypoints at real trajectory positions using metSec
    function wpScenePos(wp) {
      var wpEpoch = T_START + wp.metSec * 1000;
      return getPosByTime(wpEpoch).pos;
    }

    function wpGetState(wp, nowMet) {
      var win = wp.activeWin || 900;
      var isAnomaly = wp.status === 'anomaly';
      if (nowMet > wp.metSec + win)  return isAnomaly ? 'anomaly-done' : 'done';
      if (nowMet >= wp.metSec - 600) return isAnomaly ? 'anomaly'      : 'active';
      return 'upcoming';
    }

    var wpMeshes = [], wpMats = [];
    WAYPOINTS.forEach(function(wp) {
      var mat = new THREE.MeshBasicMaterial({ color: 0x334455 });
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat);
      mesh.position.copy(wpScenePos(wp));
      mesh.userData = wp;
      wpMeshes.push(mesh); wpMats.push(mat);
      scene.add(mesh);
    });

    // ── Orion spacecraft — cone capsule with green glow ──
    var orionGroup = new THREE.Group();
    // Capsule cone
    var capsuleGeo = new THREE.ConeGeometry(0.12, 0.3, 12);
    var orionMat = new THREE.MeshPhongMaterial({ color: 0xfff8f0, emissive: 0xfff0e0, emissiveIntensity: 1.0, shininess: 60 });
    var capsule = new THREE.Mesh(capsuleGeo, orionMat);
    capsule.rotation.x = Math.PI / 2; // point along +Z by default, will be overridden
    orionGroup.add(capsule);
    // Green glow sphere around it
    var glowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.15, side: THREE.BackSide });
    var glowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), glowMat);
    orionGroup.add(glowMesh);
    // Outer glow
    var outerGlowMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.06, side: THREE.BackSide });
    orionGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), outerGlowMat));
    orionGroup.userData = { label: 'ORION' };
    scene.add(orionGroup);

    // ── Trail particles — 30 fading dots behind Orion ──
    var TRAIL_LEN = 30;
    var trailBuf = new Float32Array(TRAIL_LEN * 3);
    var trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailBuf, 3));
    scene.add(new THREE.Points(trailGeo, new THREE.PointsMaterial({ color: 0x00ffaa, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.4 })));
    var trailIdx = 0, trailFrame = 0;

    // Speed arrow
    var arrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), 0.8, 0xff8800, 0.2, 0.1);
    scene.add(arrow);

    // Distance lines
    var edBuf = new Float32Array(6), mdBuf = new Float32Array(6);
    var edGeo = new THREE.BufferGeometry(); edGeo.setAttribute('position', new THREE.BufferAttribute(edBuf, 3));
    var edLine = new THREE.Line(edGeo, new THREE.LineDashedMaterial({ color: 0x00ccff, transparent: true, opacity: 0.3, dashSize: 0.08, gapSize: 0.06 }));
    scene.add(edLine);
    var mdGeo = new THREE.BufferGeometry(); mdGeo.setAttribute('position', new THREE.BufferAttribute(mdBuf, 3));
    var mdLine = new THREE.Line(mdGeo, new THREE.LineDashedMaterial({ color: 0xffdd44, transparent: true, opacity: 0.3, dashSize: 0.08, gapSize: 0.06 }));
    scene.add(mdLine);

    // ── Camera ──
    // Compute trajectory bounding box center for camera target
    var bbox = new THREE.Box3();
    allPts.forEach(function(p) { bbox.expandByPoint(p); });
    var trajCenter = new THREE.Vector3();
    bbox.getCenter(trajCenter);

    var camLookAt = trajCenter.clone();
    var CAM_CENTER = camLookAt;
    // Camera distance needs to encompass the full trajectory (~50-60 scene units span)
    // View from slightly above +Z to see full Earth-to-Moon trajectory
    var sph = { theta: 0.15, phi: 1.35, r: 95 };
    var SPH_DEFAULT = { theta: 0.15, phi: 1.35, r: 95 };
    var isDrag = false, isPan = false, lastMx = 0, lastMy = 0, autoRotate = true, rotTimer = null;
    var velTheta = 0, velPhi = 0, damping = 0.92;
    var camMode = 'orbit';
    var lerpFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    var lerpTo = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    var lerpT = 1, lerpDuration = 1.0;
    var activePreset = null;

    function sphToPos() {
      return new THREE.Vector3(
        camLookAt.x + sph.r*Math.sin(sph.phi)*Math.sin(sph.theta),
        camLookAt.y + sph.r*Math.cos(sph.phi),
        camLookAt.z + sph.r*Math.sin(sph.phi)*Math.cos(sph.theta)
      );
    }
    function applyCam() {
      camera.position.copy(sphToPos());
      camera.lookAt(camLookAt);
    }
    applyCam();

    function stopAuto() { autoRotate = false; clearTimeout(rotTimer); rotTimer = setTimeout(function() { autoRotate = true; }, 5000); }
    function exitPreset() {
      if (camMode !== 'orbit') {
        camMode = 'orbit';
        var dx = camera.position.x - camLookAt.x;
        var dy = camera.position.y - camLookAt.y;
        var dz = camera.position.z - camLookAt.z;
        sph.r = Math.sqrt(dx*dx+dy*dy+dz*dz);
        sph.phi = Math.acos(Math.max(-1,Math.min(1,dy/sph.r)));
        sph.theta = Math.atan2(dx, dz);
      }
      activePreset = null;
      updatePresetBtns();
    }

    function smoothEase(t) { return t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

    function startLerp(toPos, toLook, duration, mode) {
      lerpFrom.pos.copy(camera.position);
      lerpFrom.look.copy(camLookAt);
      lerpTo.pos.copy(toPos);
      lerpTo.look.copy(toLook);
      lerpT = 0;
      lerpDuration = duration || 1.0;
      camMode = mode || 'lerp';
      autoRotate = false;
      clearTimeout(rotTimer);
    }

    // Helper: get velocity direction at current Orion position
    function getOrionVelocityDir(epochMs) {
      var r = getPosByTime(epochMs);
      var nextIdx = Math.min(r.idx + 1, N_PTS - 1);
      if (nextIdx === r.idx) nextIdx = Math.max(r.idx - 1, 0);
      var dir = trajScene[nextIdx].pos.clone().sub(trajScene[r.idx].pos).normalize();
      if (dir.lengthSq() < 0.001) dir.set(1, 0, 0);
      return dir;
    }

    // Preset definitions
    var PRESETS = {
      earth: { label:'\ud83c\udf0d', title:'Earth', pos:function(){return new THREE.Vector3(0, 4, 12);}, look:function(){return new THREE.Vector3(0,0,0);} },
      moon: { label:'\ud83c\udf19', title:'Moon', pos:function(){return moon.position.clone().add(new THREE.Vector3(0, 4, 12));}, look:function(){return moon.position.clone();} },
      orion: { label:'\ud83d\ude80', title:'Orion', pos:function(){ var p=orionGroup.position.clone(); var t=getOrionVelocityDir(Date.now()); var side=new THREE.Vector3().crossVectors(t,new THREE.Vector3(0,1,0)).normalize(); return p.clone().add(side.multiplyScalar(6)).add(new THREE.Vector3(0,3,0)); }, look:function(){return orionGroup.position.clone();} },
      overview: { label:'\ud83d\udd2d', title:'Overview', pos:function(){return sphToPos();}, look:function(){return trajCenter.clone();}, isSph:true },
      earthview: { label:'\ud83c\udf0f', title:'Earth View', pos:function(){return orionGroup.position.clone().add(new THREE.Vector3(0,0.2,0));}, look:function(){return new THREE.Vector3(0,0,0);} }
    };

    // ── Preset buttons bar ──
    var presetBar = document.createElement('div');
    Object.assign(presetBar.style, { position:'absolute',top:'8px',left:'50%',transform:'translateX(-50%)',display:'flex',gap:'4px',zIndex:'4' });
    var presetBtns = {};
    Object.entries(PRESETS).forEach(function(entry) {
      var key = entry[0], p = entry[1];
      var btn = document.createElement('button');
      btn.textContent = p.label;
      btn.title = p.title;
      Object.assign(btn.style, {
        padding:'3px 8px',background:'rgba(8,12,26,0.85)',border:'1px solid rgba(74,144,217,0.35)',
        borderRadius:'12px',color:'#7986a8',fontSize:'12px',cursor:'pointer',
        fontFamily:"'Share Tech Mono',monospace",transition:'all 0.2s',lineHeight:'1.2'
      });
      btn.addEventListener('mouseenter', function() { if(activePreset!==key){btn.style.borderColor='#4A90D9';btn.style.color='#fff';} });
      btn.addEventListener('mouseleave', function() { if(activePreset!==key){btn.style.borderColor='rgba(74,144,217,0.35)';btn.style.color='#7986a8';} });
      btn.addEventListener('click', function() {
        if (activePreset === key && key !== 'orion' && key !== 'earthview') {
          exitPreset(); stopAuto(); return;
        }
        activePreset = key;
        updatePresetBtns();
        velTheta = 0; velPhi = 0;
        if (key === 'overview') {
          Object.assign(sph, JSON.parse(JSON.stringify(SPH_DEFAULT)));
          camLookAt.copy(trajCenter);
          startLerp(sphToPos(), trajCenter.clone(), 1.0, 'lerp');
          return;
        }
        var mode = (key === 'orion' || key === 'earthview') ? 'track' : 'lerp';
        startLerp(p.pos(), p.look(), 1.0, mode);
      });
      presetBtns[key] = btn;
      presetBar.appendChild(btn);
    });
    container.appendChild(presetBar);

    function updatePresetBtns() {
      Object.entries(presetBtns).forEach(function(entry) {
        var key = entry[0], btn = entry[1];
        if (key === activePreset) {
          btn.style.borderColor = '#00e5ff'; btn.style.color = '#00e5ff';
          btn.style.boxShadow = '0 0 8px rgba(0,229,255,0.4)';
        } else {
          btn.style.borderColor = 'rgba(74,144,217,0.35)'; btn.style.color = '#7986a8';
          btn.style.boxShadow = 'none';
        }
      });
    }

    // ── Mouse/touch drag with momentum ──
    renderer.domElement.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    renderer.domElement.addEventListener('mousedown', function(e) {
      if (e.button === 2) { isPan = true; } else { isDrag = true; }
      exitPreset(); stopAuto(); lastMx = e.clientX; lastMy = e.clientY; velTheta = 0; velPhi = 0;
    });
    window.addEventListener('mouseup', function() { isDrag = false; isPan = false; });
    window.addEventListener('mousemove', function(e) {
      var dx = e.clientX - lastMx, dy = e.clientY - lastMy;
      if (isPan) {
        var panScale = sph.r * 0.003;
        var right = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
        var up = camera.up.clone();
        camLookAt.add(right.multiplyScalar(-dx * panScale)).add(up.multiplyScalar(dy * panScale));
        applyCam();
      } else if (isDrag) {
        velTheta = -(dx) * 0.005;
        velPhi = -(dy) * 0.005;
        sph.theta += velTheta;
        sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + velPhi));
        applyCam();
      }
      lastMx = e.clientX; lastMy = e.clientY;
    });
    renderer.domElement.addEventListener('wheel', function(e) { exitPreset(); sph.r = Math.max(5, Math.min(200, sph.r + e.deltaY * 0.08)); applyCam(); stopAuto(); e.preventDefault(); }, { passive: false });

    // Double-click zoom
    renderer.domElement.addEventListener('dblclick', function(e) {
      exitPreset(); stopAuto();
      var rect = renderer.domElement.getBoundingClientRect();
      var mx = ((e.clientX-rect.left)/rect.width)*2-1;
      var my = -((e.clientY-rect.top)/rect.height)*2+1;
      var rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(mx, my), camera);
      var hits = rc.intersectObjects(scene.children, true);
      if (hits.length) {
        var pt = hits[0].point;
        var dir = new THREE.Vector3().subVectors(camera.position, pt).normalize();
        startLerp(pt.clone().add(dir.multiplyScalar(3)), pt.clone(), 0.8, 'lerp');
      } else {
        sph.r = Math.max(3, sph.r * 0.6); applyCam();
      }
    });

    // Touch events
    var lastTx = 0, lastTy = 0, touchCount = 0;
    renderer.domElement.addEventListener('touchstart', function(e) {
      exitPreset(); stopAuto(); touchCount = e.touches.length;
      lastTx = e.touches[0].clientX; lastTy = e.touches[0].clientY;
      velTheta = 0; velPhi = 0;
    });
    renderer.domElement.addEventListener('touchend', function() { touchCount = 0; rotTimer = setTimeout(function() { autoRotate = true; }, 5000); });
    renderer.domElement.addEventListener('touchmove', function(e) {
      var dx = e.touches[0].clientX - lastTx, dy = e.touches[0].clientY - lastTy;
      if (e.touches.length >= 2) {
        var panScale = sph.r * 0.003;
        var right = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
        var up = camera.up.clone();
        camLookAt.add(right.multiplyScalar(-dx * panScale)).add(up.multiplyScalar(dy * panScale));
        applyCam();
      } else {
        velTheta = -(dx) * 0.005; velPhi = -(dy) * 0.005;
        sph.theta += velTheta;
        sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + velPhi));
        applyCam();
      }
      lastTx = e.touches[0].clientX; lastTy = e.touches[0].clientY; e.preventDefault();
    }, { passive: false });

    // ── Zoom controls ──
    var ctrlDiv = document.createElement('div');
    Object.assign(ctrlDiv.style, { position:'absolute',bottom:'8px',right:'8px',display:'flex',flexDirection:'column',gap:'3px',zIndex:'3' });
    [{text:'+',fn:function(){exitPreset();sph.r=Math.max(5,sph.r*0.8);applyCam();stopAuto();}},{text:'\u2212',fn:function(){exitPreset();sph.r=Math.min(200,sph.r*1.2);applyCam();stopAuto();}},{text:'\u27f2',fn:function(){exitPreset();Object.assign(sph,JSON.parse(JSON.stringify(SPH_DEFAULT)));camLookAt.copy(trajCenter);applyCam();autoRotate=true;activePreset='overview';updatePresetBtns();}}].forEach(function(b) {
      var btn = document.createElement('button'); btn.textContent = b.text;
      Object.assign(btn.style, { width:'26px',height:'26px',background:'rgba(8,12,26,0.85)',border:'1px solid rgba(74,144,217,0.45)',borderRadius:'3px',color:'#4A90D9',fontSize:'14px',fontFamily:"'Share Tech Mono',monospace",cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:'1',padding:'0' });
      btn.addEventListener('mouseenter', function() { btn.style.borderColor='#4A90D9'; btn.style.color='#fff'; });
      btn.addEventListener('mouseleave', function() { btn.style.borderColor='rgba(74,144,217,0.45)'; btn.style.color='#4A90D9'; });
      btn.addEventListener('click', b.fn); ctrlDiv.appendChild(btn);
    });
    container.appendChild(ctrlDiv);

    // ── Waypoint popup ──
    var popupEl = document.createElement('div');
    Object.assign(popupEl.style, { position:'absolute',display:'none',background:'rgba(0,10,20,0.88)',border:'1px solid rgba(0,255,170,0.4)',borderRadius:'4px',padding:'10px 14px',zIndex:'5',maxWidth:'280px',minWidth:'200px',fontFamily:"'Share Tech Mono',monospace",pointerEvents:'auto',boxShadow:'0 0 12px rgba(0,255,170,0.25)' });
    container.appendChild(popupEl);
    var popupOpen = false;
    function closePopup() { popupEl.style.display = 'none'; popupOpen = false; }
    function openPopup(wp, sx, sy) {
      var nowMet = (Date.now()-LAUNCH_UTC)/1000;
      var evDate = new Date(LAUNCH_UTC.getTime()+wp.metSec*1000);
      var localStr = fmtLocal(evDate,true)+' '+tzAbbr(evDate);
      var status, sColor;
      if (nowMet > wp.metSec+900) { status='\u2713 COMPLETED'; sColor='#00e676'; }
      else if (nowMet >= wp.metSec-600) { status='\u25b6 IN PROGRESS'; sColor='#ffd740'; }
      else { status='\u25cb UPCOMING'; sColor='#7986a8'; }
      var etaStr = '';
      if (nowMet < wp.metSec - 600) {
        var rem = wp.metSec - nowMet; var hh = Math.floor(rem/3600); var mm = Math.floor((rem%3600)/60);
        etaStr = hh > 0 ? 'in ' + hh + 'h ' + mm + 'm' : 'in ' + mm + 'm';
      } else if (nowMet <= wp.metSec + 900) {
        etaStr = 'NOW';
      } else {
        var ago = nowMet - wp.metSec; var hh2 = Math.floor(ago/3600); var mm2 = Math.floor((ago%3600)/60);
        etaStr = hh2 > 0 ? hh2 + 'h ' + mm2 + 'm ago' : mm2 + 'm ago';
      }
      var critColors = { CRITICAL:'#ef5350', HIGH:'#ffa726', MEDIUM:'#ffd740' };
      var critC = critColors[wp.crit] || '#7986a8';
      popupEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-size:0.6rem;font-weight:bold;color:#00ffaa;letter-spacing:0.12em;text-shadow:0 0 8px rgba(0,255,170,0.5)">' + wp.label + '</span>' + (wp.crit ? '<span style="font-size:0.36rem;color:' + critC + ';border:1px solid ' + critC + '44;padding:1px 5px;border-radius:2px;letter-spacing:0.08em;">' + wp.crit + '</span>' : '') + '</div><div style="font-size:0.48rem;color:#7986a8;margin-bottom:3px;">' + wp.met + '</div><div style="font-size:0.44rem;color:rgba(74,144,217,0.6);margin-bottom:3px;">' + localStr + '</div><div style="font-size:0.44rem;color:rgba(74,144,217,0.7);margin-bottom:6px;letter-spacing:0.06em;">ETA: ' + etaStr + '</div><div style="font-size:0.48rem;color:' + sColor + ';margin-bottom:8px;letter-spacing:0.08em;">' + status + '</div><div style="font-size:0.48rem;color:#c8d0e0;line-height:1.5;">' + wp.desc + '</div>';
      var left = sx+14; if (left+280 > W) left = sx-290;
      var top = sy-20; if (top+180 > H) top = H-190; if (top < 4) top = 4;
      popupEl.style.left = left+'px'; popupEl.style.top = top+'px'; popupEl.style.display = 'block'; popupOpen = true;
    }

    // Raycaster
    var raycaster = new THREE.Raycaster();
    var mouse3 = new THREE.Vector2();
    var tooltipEl = document.getElementById('traj-tooltip');
    renderer.domElement.addEventListener('mousemove', function(e) {
      if (!tooltipEl) return;
      var rect = renderer.domElement.getBoundingClientRect();
      mouse3.x = ((e.clientX-rect.left)/rect.width)*2-1; mouse3.y = -((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse3, camera);
      var hits = raycaster.intersectObjects([capsule, glowMesh].concat(wpMeshes));
      if (hits.length) { tooltipEl.textContent = hits[0].object.userData.label || hits[0].object.parent.userData.label || ''; tooltipEl.style.left=(e.clientX-rect.left+12)+'px'; tooltipEl.style.top=(e.clientY-rect.top-8)+'px'; tooltipEl.style.opacity='1'; renderer.domElement.style.cursor='pointer'; }
      else { tooltipEl.style.opacity='0'; renderer.domElement.style.cursor='grab'; }
    });
    renderer.domElement.addEventListener('mouseleave', function() { if (tooltipEl) tooltipEl.style.opacity='0'; });
    renderer.domElement.addEventListener('click', function(e) {
      if (popupOpen) { closePopup(); return; }
      var rect = renderer.domElement.getBoundingClientRect();
      mouse3.x = ((e.clientX-rect.left)/rect.width)*2-1; mouse3.y = -((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse3, camera);
      var hits = raycaster.intersectObjects(wpMeshes);
      if (hits.length && hits[0].object.userData.desc) openPopup(hits[0].object.userData, e.clientX-rect.left, e.clientY-rect.top);
    });
    document.addEventListener('keydown', function(e) { if (e.key==='Escape' && popupOpen) closePopup(); });

    new ResizeObserver(function() { W=container.clientWidth||400; H=container.clientHeight||300; renderer.setSize(W,H); lc.width=W; lc.height=H; camera.aspect=W/H; camera.updateProjectionMatrix(); }).observe(container);

    var progressEl = document.getElementById('traj-progress');
    var _pv = new THREE.Vector3();
    function proj(v3) { _pv.copy(v3).project(camera); return { x:(_pv.x*0.5+0.5)*W, y:(_pv.y*-0.5+0.5)*H, vis: _pv.z < 1.0 }; }

    // ── Holographic callout drawing ──
    function drawCallout(text, v3, color, ox, oy, bold, lineToV3) {
      var s = proj(v3); if (!s.vis) return;
      var x = s.x + (ox||0), y = s.y + (oy||0);
      lctx.save();
      if (lineToV3) {
        var s2 = proj(lineToV3);
        if (s2.vis) {
          lctx.beginPath(); lctx.moveTo(s2.x, s2.y); lctx.lineTo(x, y);
          lctx.strokeStyle = color.replace(')', ',0.3)').replace('rgb','rgba').replace('rgba(','rgba(') || 'rgba(0,255,170,0.3)';
          lctx.setLineDash([3, 3]); lctx.lineWidth = 0.5; lctx.stroke(); lctx.setLineDash([]);
        }
      }
      lctx.font = (bold ? 'bold ' : '') + '10px "Share Tech Mono",monospace';
      lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
      var m = lctx.measureText(text);
      var bw = m.width + 12, bh = 16;
      lctx.fillStyle = 'rgba(0,10,20,0.7)';
      lctx.fillRect(x - bw/2, y - bh/2, bw, bh);
      lctx.strokeStyle = color; lctx.lineWidth = 0.5; lctx.globalAlpha = 0.6;
      lctx.strokeRect(x - bw/2, y - bh/2, bw, bh);
      lctx.globalAlpha = 1.0;
      lctx.fillStyle = color;
      if (bold) { lctx.shadowColor = color; lctx.shadowBlur = 8; }
      lctx.fillText(text, x, y);
      lctx.restore();
    }

    // Temp vectors for orienting the capsule
    var _velDir = new THREE.Vector3();
    var _upVec = new THREE.Vector3(0, 1, 0);
    var _quatLook = new THREE.Quaternion();
    var _lookMat = new THREE.Matrix4();

    function animate() {
      requestAnimationFrame(animate);
      var now = Date.now();
      var elapsed = now - LAUNCH_UTC;
      var pulse = 0.5 + 0.5 * Math.sin(now / 430);

      // Update Moon position every few seconds
      if (now % 5000 < 17) {
        moonPos = getMoonScenePos(new Date(now));
        moon.position.copy(moonPos);
        moonGlow.position.copy(moonPos);
      }

      // ── Orion position from real trajectory ──
      var orionResult = getPosByTime(now);
      orionGroup.position.copy(orionResult.pos);
      var gt = orionResult.frac; // 0-1 progress for line splitting

      // Orient capsule in direction of travel
      _velDir.copy(getOrionVelocityDir(now));
      _lookMat.lookAt(orionGroup.position, orionGroup.position.clone().add(_velDir), _upVec);
      _quatLook.setFromRotationMatrix(_lookMat);
      orionGroup.quaternion.slerp(_quatLook, 0.1);

      orionMat.emissiveIntensity = 0.7 + pulse * 0.6;
      glowMat.opacity = 0.08 + pulse * 0.15;
      orionLight.position.copy(orionGroup.position);

      // Trail
      trailFrame++;
      if (trailFrame % 3 === 0) {
        var ti = (trailIdx % TRAIL_LEN) * 3;
        trailBuf[ti] = orionGroup.position.x; trailBuf[ti+1] = orionGroup.position.y; trailBuf[ti+2] = orionGroup.position.z;
        trailGeo.attributes.position.needsUpdate = true;
        trailIdx++;
      }

      // Speed arrow
      arrow.position.copy(orionGroup.position); arrow.setDirection(_velDir);
      var rawSpd = parseFloat((document.getElementById('tv-speed')?.textContent||'').replace(/,/g,''))||7800;
      arrow.setLength(0.35+Math.max(0.2,Math.min(1.0,rawSpd/40000))*0.85, 0.18, 0.09);

      // ── Completed path with gradient colors ──
      var nowMet = elapsed / 1000;
      var splitIdx = Math.min(Math.floor(gt * N_PTS), N_PTS - 1);
      if (splitIdx > 0) {
        var slice = allPts.slice(0, splitIdx + 2);
        var sliceColors = new Float32Array((splitIdx + 2) * 3);
        for (var ci = 0; ci < splitIdx + 2; ci++) {
          sliceColors[ci*3]   = C_GREEN.r;
          sliceColors[ci*3+1] = C_GREEN.g;
          sliceColors[ci*3+2] = C_GREEN.b;
        }
        completedGeo.setFromPoints(slice);
        completedGeo.setAttribute('color', new THREE.BufferAttribute(sliceColors, 3));
        compGlowGeo.setFromPoints(slice);
        compGlowGeo.setAttribute('color', new THREE.BufferAttribute(sliceColors.slice(), 3));
        var aStart = Math.max(0, splitIdx - 12);
        var aEnd = Math.min(N_PTS, splitIdx + 4);
        activeSegGeo.setFromPoints(allPts.slice(aStart, aEnd + 1));
        // Flame gradient trail
        var fStart = Math.max(0, splitIdx - FLAME_LEN);
        var flamePts = allPts.slice(fStart, splitIdx + 1);
        var fLen = flamePts.length;
        if (fLen > 1) {
          var fColors = new Float32Array(fLen * 3);
          for (var fi = 0; fi < fLen; fi++) {
            var ff = fi / (fLen - 1);
            fColors[fi*3]   = Math.pow(ff, 0.6);
            fColors[fi*3+1] = Math.pow(ff, 1.5) * 0.95;
            fColors[fi*3+2] = Math.pow(ff, 3.0) * 0.90;
          }
          flameGeo.setFromPoints(flamePts);
          flameGeo.setAttribute('color', new THREE.BufferAttribute(fColors, 3));
          flameGlowGeo.setFromPoints(flamePts);
        }
      }

      // ── Reference lines ──
      emBuf[0]=earth.position.x; emBuf[1]=earth.position.y; emBuf[2]=earth.position.z;
      emBuf[3]=moon.position.x; emBuf[4]=moon.position.y; emBuf[5]=moon.position.z;
      emGeo.attributes.position.needsUpdate=true; emLine.computeLineDistances();
      edBuf[0]=orionGroup.position.x; edBuf[1]=orionGroup.position.y; edBuf[2]=orionGroup.position.z;
      edBuf[3]=earth.position.x; edBuf[4]=earth.position.y; edBuf[5]=earth.position.z;
      edGeo.attributes.position.needsUpdate=true; edLine.computeLineDistances();
      mdBuf[0]=orionGroup.position.x; mdBuf[1]=orionGroup.position.y; mdBuf[2]=orionGroup.position.z;
      mdBuf[3]=moon.position.x; mdBuf[4]=moon.position.y; mdBuf[5]=moon.position.z;
      mdGeo.attributes.position.needsUpdate=true; mdLine.computeLineDistances();

      // Waypoint states
      WAYPOINTS.forEach(function(wp, i) {
        var state = wpGetState(wp, nowMet);
        var hexCol = state === 'done'         ? 0x00e676
                   : state === 'active'       ? 0xffd700
                   : state === 'anomaly'      ? 0xff6600
                   : state === 'anomaly-done' ? 0xff8c00
                   :                           0x2a3a4a;
        wpMats[i].color.setHex(hexCol);
        var pulse2 = state === 'active' || state === 'anomaly';
        wpMeshes[i].scale.setScalar(pulse2 ? 1.0 + pulse * 0.55 : 1.0);
      });

      earth.rotation.y += 0.00175; moon.rotation.y += 0.0003;

      // ── Camera lerp / tracking / momentum ──
      if (camMode === 'lerp' && lerpT < 1) {
        lerpT = Math.min(1, lerpT + (1/60) / lerpDuration);
        var eased = smoothEase(lerpT);
        camera.position.lerpVectors(lerpFrom.pos, lerpTo.pos, eased);
        camLookAt.lerpVectors(lerpFrom.look, lerpTo.look, eased);
        camera.lookAt(camLookAt);
        if (lerpT >= 1 && activePreset === 'overview') {
          camMode = 'orbit';
          var dx2 = camera.position.x-camLookAt.x, dy2 = camera.position.y-camLookAt.y, dz2 = camera.position.z-camLookAt.z;
          sph.r = Math.sqrt(dx2*dx2+dy2*dy2+dz2*dz2);
          sph.phi = Math.acos(Math.max(-1,Math.min(1,dy2/sph.r)));
          sph.theta = Math.atan2(dx2, dz2);
        }
      } else if (camMode === 'track') {
        if (activePreset === 'orion') {
          var tp = PRESETS.orion.pos();
          var tl = orionGroup.position.clone();
          if (lerpT < 1) { lerpT = Math.min(1, lerpT + (1/60)/lerpDuration); var e2 = smoothEase(lerpT); camera.position.lerpVectors(lerpFrom.pos, tp, e2); camLookAt.lerpVectors(lerpFrom.look, tl, e2); }
          else { camera.position.lerp(tp, 0.05); camLookAt.lerp(tl, 0.05); }
          camera.lookAt(camLookAt);
        } else if (activePreset === 'earthview') {
          var ep = orionGroup.position.clone().add(new THREE.Vector3(0,0.2,0));
          var el = new THREE.Vector3(0,0,0);
          if (lerpT < 1) { lerpT = Math.min(1, lerpT + (1/60)/lerpDuration); var e3 = smoothEase(lerpT); camera.position.lerpVectors(lerpFrom.pos, ep, e3); camLookAt.lerpVectors(lerpFrom.look, el, e3); }
          else { camera.position.lerp(ep, 0.05); camLookAt.lerp(el, 0.05); }
          camera.lookAt(camLookAt);
        }
      } else {
        if (!isDrag && !isPan && (Math.abs(velTheta) > 0.0001 || Math.abs(velPhi) > 0.0001)) {
          sph.theta += velTheta;
          sph.phi = Math.max(0.1, Math.min(Math.PI-0.1, sph.phi + velPhi));
          velTheta *= damping; velPhi *= damping;
          applyCam();
        }
        if (autoRotate) { sph.theta += 0.0008; applyCam(); }
      }

      renderer.render(scene, camera);

      // ── 2D Holographic callouts ──
      lctx.clearRect(0, 0, W, H);

      var orionEarthDist = orionGroup.position.distanceTo(earth.position);
      var moonDistTxt = document.getElementById('tv-moon')?.textContent?.trim() || '';
      var moonDistUnit = (document.getElementById('tu-moon')?.textContent || 'MI').toLowerCase();
      var orionLabel = moonDistTxt && moonDistTxt !== '\u2014' ? 'ORION \u00b7 ' + moonDistTxt + ' ' + moonDistUnit + ' to Moon' : 'ORION CREW CAPSULE';
      var oLabelY = orionEarthDist < 1.8 ? -1.5 : -0.6;
      drawCallout(orionLabel, new THREE.Vector3(orionGroup.position.x, orionGroup.position.y + oLabelY, orionGroup.position.z), '#00ffaa', 0, -16, true, orionGroup.position);

      drawCallout('EARTH', new THREE.Vector3(earth.position.x, earth.position.y - 1.4, earth.position.z), 'rgba(100,170,255,0.85)', 0, 0, false, earth.position);
      drawCallout('MOON', new THREE.Vector3(moon.position.x, moon.position.y - 0.8, moon.position.z), 'rgba(200,195,180,0.85)', 0, 0, false, moon.position);

      // Earth-Moon distance
      var emMid = new THREE.Vector3().addVectors(earth.position, moon.position).multiplyScalar(0.5); emMid.y += 0.7;
      var emDistStr;
      if (typeof Astronomy !== 'undefined') {
        var mv = Astronomy.GeoVector('Moon', new Date(), true);
        var emKm = Math.sqrt(mv.x*mv.x + mv.y*mv.y + mv.z*mv.z) * 149597870.7;
        var isImp = (document.getElementById('tu-earth')?.textContent || 'MI') === 'MI';
        emDistStr = isImp
          ? Math.round(emKm * 0.621371).toLocaleString() + ' MI'
          : Math.round(emKm).toLocaleString() + ' KM';
      } else {
        emDistStr = (document.getElementById('tu-earth')?.textContent || 'MI') === 'MI' ? '238,855 MI' : '384,400 KM';
      }
      drawCallout('EARTH\u2013MOON: ' + emDistStr, emMid, 'rgba(255,255,255,0.35)', 0, 0, false, null);

      var earthTxt = document.getElementById('tv-earth')?.textContent?.trim();
      var earthUnit = (document.getElementById('tu-earth')?.textContent || 'MI').toLowerCase();
      if (earthTxt && earthTxt !== '\u2014') {
        var altPt = new THREE.Vector3().lerpVectors(orionGroup.position, earth.position, 0.4); altPt.y += 0.35;
        drawCallout('ALT: ' + earthTxt + ' ' + earthUnit, altPt, 'rgba(0,204,255,0.7)', 0, 0, false, null);
      }

      // Waypoint labels
      WAYPOINTS.forEach(function(wp, i) {
        var state = wpGetState(wp, nowMet);
        var s = proj(wpMeshes[i].position); if (!s.vis) return;
        var color = state==='done'         ? 'rgba(0,230,118,0.55)'
                  : state==='active'       ? '#ffd700'
                  : state==='anomaly'      ? '#ff6600'
                  : state==='anomaly-done' ? 'rgba(255,140,0,0.45)'
                  :                         'rgba(100,130,160,0.28)';
        var bold = state === 'active' || state === 'anomaly';
        lctx.save();
        lctx.font = (bold ? 'bold ' : '') + '9px "Share Tech Mono",monospace';
        lctx.fillStyle = color;
        lctx.textAlign = 'left'; lctx.textBaseline = 'middle';
        lctx.shadowColor = color; lctx.shadowBlur = bold ? 8 : 4;
        lctx.fillText(wp.label, s.x + 10, s.y - 8);
        lctx.restore();
      });

      if (progressEl) {
        var fd = Math.max(1, Math.floor(elapsed / (24*3600*1000)) + 1);
        progressEl.textContent = 'MISSION PROGRESS: ' + (gt*100).toFixed(1) + '%  \u00b7  FLIGHT DAY ' + fd;
      }
    }
    animate();

    // ── Telemetry HUD update logic ──────────────────────────────────────
    var hudEl = document.getElementById('traj-hud');
    var hudToggle = document.getElementById('hud-toggle');
    var hudVisible = true;
    if (hudToggle) {
      hudToggle.addEventListener('click', function() {
        hudVisible = !hudVisible;
        hudEl.classList.toggle('collapsed', !hudVisible);
        hudToggle.classList.toggle('collapsed', !hudVisible);
        hudToggle.innerHTML = hudVisible ? '&#9666;' : '&#9656;';
      });
    }

    var EARTH_DIAM_KM = 12742;
    var MOON_DIAM_KM = 3474;
    var SPEED_OF_LIGHT_KMS = 299792.458;
    var KM_TO_MI = 0.621371;

    var DV_BUDGET = [
      { metSec: 0,      dv: 3900 },
      { metSec: 2940,   dv: 3700 },
      { metSec: 5400,   dv: 3400 },
      { metSec: 90000,  dv: 1600 },
      { metSec: 187200, dv: 1500 },
      { metSec: 540000, dv: 800 },
      { metSec: 820800, dv: 50 },
      { metSec: 825000, dv: 0 },
    ];

    var ECC_PHASES = [
      { metSec: 0,      ecc: 0.01 },
      { metSec: 2940,   ecc: 0.35 },
      { metSec: 5400,   ecc: 0.80 },
      { metSec: 90000,  ecc: 0.97 },
      { metSec: 360000, ecc: 1.20 },
      { metSec: 460800, ecc: 1.80 },
      { metSec: 540000, ecc: 0.97 },
      { metSec: 820800, ecc: 0.98 },
    ];

    function lerpTable(table, key, val) {
      if (val <= table[0][key]) return table[0];
      if (val >= table[table.length-1][key]) return table[table.length-1];
      for (var i = 1; i < table.length; i++) {
        if (val <= table[i][key]) {
          var f = (val - table[i-1][key]) / (table[i][key] - table[i-1][key]);
          var result = {};
          for (var k in table[i]) {
            if (k === key) { result[k] = val; continue; }
            result[k] = table[i-1][k] + (table[i][k] - table[i-1][k]) * f;
          }
          return result;
        }
      }
      return table[table.length-1];
    }

    function tickHUD() {
      if (!hudEl) return;
      var ds = window.dashboardState || {};
      var isImp = ds.useImperial !== false;
      var elapsed = Date.now() - LAUNCH_UTC;
      var metSec = elapsed / 1000;

      var earthStr = document.getElementById('tv-earth')?.textContent?.trim() || '';
      var moonStr = document.getElementById('tv-moon')?.textContent?.trim() || '';
      var speedStr = document.getElementById('tv-speed')?.textContent?.trim() || '';
      var earthUnit = document.getElementById('tu-earth')?.textContent || 'MI';
      var speedUnit = document.getElementById('tu-speed')?.textContent || 'MPH';

      var earthVal = parseFloat(earthStr.replace(/,/g, '')) || 0;
      var moonVal = parseFloat(moonStr.replace(/,/g, '')) || 0;

      var earthKm = earthUnit === 'MI' ? earthVal / KM_TO_MI : earthVal;
      var moonKm = earthUnit === 'MI' ? moonVal / KM_TO_MI : moonVal;

      var altEl = document.getElementById('hud-alt');
      var velEl = document.getElementById('hud-vel');
      if (altEl) altEl.textContent = earthStr ? earthStr + ' ' + earthUnit.toLowerCase() : '\u2014';
      if (velEl) velEl.textContent = speedStr ? speedStr + ' ' + speedUnit.toLowerCase() : '\u2014';

      var eccEl = document.getElementById('hud-ecc');
      if (eccEl) {
        var eccData = lerpTable(ECC_PHASES, 'metSec', metSec);
        eccEl.textContent = eccData.ecc.toFixed(3);
      }

      var hudEarth = document.getElementById('hud-earth');
      var hudMoon = document.getElementById('hud-moon');
      if (hudEarth) hudEarth.textContent = earthStr ? earthStr + ' ' + earthUnit.toLowerCase() : '\u2014';
      if (hudMoon) hudMoon.textContent = moonStr ? moonStr + ' ' + earthUnit.toLowerCase() : '\u2014';

      var rtlEl = document.getElementById('hud-rtl');
      if (rtlEl && earthKm > 0) {
        var rtlSec = (earthKm * 2) / SPEED_OF_LIGHT_KMS;
        rtlEl.textContent = rtlSec < 1 ? (rtlSec * 1000).toFixed(0) + ' ms' : rtlSec.toFixed(2) + ' s';
      }

      var esizeEl = document.getElementById('hud-esize');
      var msizeEl = document.getElementById('hud-msize');
      if (esizeEl && earthKm > 100) {
        var angEarth = 2 * Math.atan2(EARTH_DIAM_KM / 2, earthKm) * (180 / Math.PI);
        esizeEl.textContent = angEarth >= 1 ? angEarth.toFixed(1) + '\u00b0' : (angEarth * 60).toFixed(1) + "'";
      }
      if (msizeEl && moonKm > 100) {
        var angMoon = 2 * Math.atan2(MOON_DIAM_KM / 2, moonKm) * (180 / Math.PI);
        msizeEl.textContent = angMoon >= 1 ? angMoon.toFixed(1) + '\u00b0' : (angMoon * 60).toFixed(1) + "'";
      }

      var dsnEl = document.getElementById('hud-dsn');
      if (dsnEl) dsnEl.textContent = ds.dsnStation || 'ACQUIRING';

      var losEl = document.getElementById('hud-los');
      if (losEl) {
        var losStart = 462600, losDur = 2460;
        if (metSec < losStart) {
          var rem = losStart - metSec;
          var hh = Math.floor(rem / 3600); var mm = Math.floor((rem % 3600) / 60);
          losEl.textContent = hh > 0 ? hh + 'h ' + mm + 'm' : mm + 'm';
          if (rem < 7200) losEl.className = 'hud-val warn';
          else losEl.className = 'hud-val';
        } else if (metSec < losStart + losDur) {
          losEl.textContent = 'BLACKOUT';
          losEl.className = 'hud-val crit';
        } else {
          losEl.textContent = 'CLEAR';
          losEl.className = 'hud-val good';
        }
      }

      var kpEl = document.getElementById('hud-kp');
      if (kpEl) {
        var kp = ds.kpIndex;
        if (kp !== null && kp !== undefined) {
          kpEl.textContent = kp;
          kpEl.className = kp >= 5 ? 'hud-val crit' : kp >= 4 ? 'hud-val warn' : 'hud-val good';
        }
      }
      var solarEl = document.getElementById('hud-solar');
      if (solarEl) {
        var sw = ds.solarWind;
        if (sw !== null && sw !== undefined) {
          solarEl.textContent = sw + ' km/s';
          solarEl.className = sw >= 600 ? 'hud-val warn' : 'hud-val';
        }
      }

      var phaseEl = document.getElementById('hud-phase');
      if (phaseEl) {
        var phaseName = document.getElementById('current-phase-name')?.textContent?.trim() || '\u2014';
        phaseEl.textContent = phaseName;
      }
      var dayEl = document.getElementById('hud-day');
      if (dayEl) {
        var fd = Math.max(1, Math.floor(elapsed / (24*3600*1000)) + 1);
        dayEl.textContent = fd + ' of 10';
      }
      var nextEl = document.getElementById('hud-next');
      if (nextEl) {
        if (ds.nextEvent) {
          var short = ds.nextEvent.length > 10 ? ds.nextEvent.slice(0, 10) : ds.nextEvent;
          nextEl.textContent = short + (ds.nextEventEta ? ' ' + ds.nextEventEta : '');
          nextEl.title = ds.nextEvent + (ds.nextEventEta ? ' in ' + ds.nextEventEta : '');
        }
      }

      var dvEl = document.getElementById('hud-dv');
      if (dvEl) {
        var dvData = lerpTable(DV_BUDGET, 'metSec', metSec);
        dvEl.textContent = Math.round(dvData.dv) + ' m/s';
        dvEl.className = dvData.dv < 100 ? 'hud-val warn' : 'hud-val';
      }
    }

    tickHUD();
    setInterval(tickHUD, 2000);
  } // end init()
})();
