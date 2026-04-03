// trajectory.js — 3D Three.js trajectory visualization
// Uses shared MissionEphemeris for all position/state data.
// Uses shared MissionEvents for waypoint markers.
// ── TRAJECTORY 3D — CINEMATIC SCI-FI ─────────────────────────────────
(function() {
  var container = document.getElementById('trajectory-3d');
  if (!container || typeof THREE === 'undefined') return;

  var MISSION_MS = 10 * 24 * 3600 * 1000;
  var EARTH_R_KM = 6371;
  var SCENE_EARTH_R = 0.9;
  var SCENE_SCALE = SCENE_EARTH_R / EARTH_R_KM;
  var loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';

  // Wait for shared ephemeris to load, then initialize
  MissionEphemeris.ready.then(function() {
    if (!MissionEphemeris.points || MissionEphemeris.points.length === 0) {
      console.error('[Trajectory] No ephemeris data available');
      return;
    }
    init();
  });

  function init() {
    var points = MissionEphemeris.points;
    var T_START_MET = MissionEphemeris.tStart;
    var T_END_MET = MissionEphemeris.tEnd;
    var T_SPAN_MET = T_END_MET - T_START_MET;

    // ── Build display transform (rotMat) ──────────────────────────────
    var caIdx = 0, caMinDist = Infinity;
    for (var i = 0; i < points.length; i++) {
      if (points[i].distMoonKm < caMinDist) { caMinDist = points[i].distMoonKm; caIdx = i; }
    }
    var caPt = points[caIdx];

    var moonAtCA = new THREE.Vector3(caPt.moon.x, caPt.moon.y, caPt.moon.z);
    var xAxis = moonAtCA.clone().normalize();

    var caIdxPrev = Math.max(caIdx - 1, 0);
    var caIdxNext = Math.min(caIdx + 1, points.length - 1);
    var tangent3d = new THREE.Vector3(
      points[caIdxNext].orion.x - points[caIdxPrev].orion.x,
      points[caIdxNext].orion.y - points[caIdxPrev].orion.y,
      points[caIdxNext].orion.z - points[caIdxPrev].orion.z
    ).normalize();

    var zAxis = new THREE.Vector3().crossVectors(xAxis, tangent3d).normalize();
    var yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    var rotMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).transpose();

    function toScene(x, y, z) {
      var v = new THREE.Vector3(x, y, z).applyMatrix4(rotMat);
      return new THREE.Vector3(v.x * SCENE_SCALE, v.y * SCENE_SCALE, v.z * SCENE_SCALE);
    }

    var trajScene = points.map(function(p) {
      return { metSec: p.metSec, pos: toScene(p.orion.x, p.orion.y, p.orion.z) };
    });
    var allPts = trajScene.map(function(p) { return p.pos.clone(); });
    // If ephemeris starts after launch (T_START_MET > 0), prepend Earth centre
    // so the trajectory line visually originates from Earth
    if (T_START_MET > 60) {
      allPts.unshift(new THREE.Vector3(0, 0, 0));
    }
    var N_PTS = allPts.length;

    function getPosByMet(metSec) {
      if (metSec <= T_START_MET) return { pos: allPts[0].clone(), idx: 0, frac: 0 };
      if (metSec >= T_END_MET) return { pos: allPts[N_PTS - 1].clone(), idx: N_PTS - 1, frac: 1 };
      var lo = 0, hi = trajScene.length - 1;
      while (lo < hi - 1) {
        var mid = (lo + hi) >> 1;
        if (trajScene[mid].metSec <= metSec) lo = mid; else hi = mid;
      }
      var f = (metSec - trajScene[lo].metSec) / (trajScene[hi].metSec - trajScene[lo].metSec);
      var pos = trajScene[lo].pos.clone().lerp(trajScene[hi].pos, f);
      return { pos: pos, idx: lo, frac: (metSec - T_START_MET) / T_SPAN_MET };
    }

    var scene = new THREE.Scene();
    var W = container.clientWidth || 400;
    var H = container.clientHeight || 300;
    var camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 1000);

    var renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x030810, 1);
    Object.assign(renderer.domElement.style, { position:'absolute',top:'0',left:'0',width:'100%',height:'100%' });
    container.appendChild(renderer.domElement);

    // ── Skybox — equirectangular star map ──
    var skyGeo = new THREE.SphereGeometry(300, 32, 32);
    var skyMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0.25 });
    var skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);
    var skyPaths = ['bg-3dtraj.jpg', 'css/bg-3dtraj.jpg', './css/bg-3dtraj.jpg',
                    '/css/bg-3dtraj.jpg', 'img/bg-3dtraj.jpg'];
    var skyLoaded = false;
    function trySkyPath(idx) {
      if (idx >= skyPaths.length || skyLoaded) { if (!skyLoaded) console.warn('[SKY] All paths failed — black fallback'); return; }
      console.log('[SKY] Trying: ' + skyPaths[idx]);
      loader.load(skyPaths[idx],
        function(tex) { console.log('[SKY] SUCCESS: ' + skyPaths[idx]); skyLoaded = true; skyMat.map = tex; skyMat.color.set(0xffffff); skyMat.needsUpdate = true; },
        undefined,
        function() { console.warn('[SKY] Failed: ' + skyPaths[idx]); trySkyPath(idx + 1); }
      );
    }
    trySkyPath(0);

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
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.15, side: THREE.BackSide })));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x4A90D9, transparent: true, opacity: 0.08, side: THREE.BackSide })));

    // LEO orbit ring
    var leoPts = [];
    for (var i = 0; i <= 80; i++) { var a = (i/80)*Math.PI*2; leoPts.push(new THREE.Vector3(1.35*Math.cos(a), 0.22*Math.sin(a), 1.35*Math.sin(a)*0.96)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(leoPts), new THREE.LineBasicMaterial({ color: 0x4A90D9, transparent: true, opacity: 0.2 })));

    // ── Moon — positioned dynamically from ephemeris ──
    var MOON_SCENE_R = 0.45;
    var moonMat = new THREE.MeshPhongMaterial({ color: 0xaaa89e, emissive: 0x0a0a09, shininess: 4 });
    var moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_SCENE_R, 32, 32), moonMat);
    scene.add(moon);
    loadTex(['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg'],
      function(tex) { moonMat.map = tex; moonMat.color.set(0xdddddd); moonMat.needsUpdate = true; });
    var moonGlow = new THREE.Mesh(new THREE.SphereGeometry(MOON_SCENE_R * 1.2, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xccccbb, transparent: true, opacity: 0.08, side: THREE.BackSide }));
    scene.add(moonGlow);

    var initMoonPos = toScene(caPt.moon.x, caPt.moon.y, caPt.moon.z);
    moon.position.copy(initMoonPos);
    moonGlow.position.copy(initMoonPos);

    // Starfield removed — skybox texture (bg-3dtraj.jpg) provides stars


    // ── Earth-Moon reference line ──
    var emBuf = new Float32Array(6);
    var emGeo = new THREE.BufferGeometry();
    emGeo.setAttribute('position', new THREE.BufferAttribute(emBuf, 3));
    var emLine = new THREE.Line(emGeo, new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, dashSize: 0.25, gapSize: 0.18 }));
    scene.add(emLine);

    // ── Trajectory lines ──
    var upGeo = new THREE.BufferGeometry().setFromPoints(allPts);
    var upMat = new THREE.LineDashedMaterial({ color: 0x00ffcc, transparent: true, opacity: 1.0, linewidth: 2, dashSize: 1.5, gapSize: 1.0 });
    var upLine = new THREE.Line(upGeo, upMat);
    upLine.computeLineDistances();
    scene.add(upLine);
    var upGlowGeo = new THREE.BufferGeometry().setFromPoints(allPts);
    var upGlowMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.3, linewidth: 3, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Line(upGlowGeo, upGlowMat));

    var C_GREEN = new THREE.Color(0xffffff);
    var completedGeo = new THREE.BufferGeometry();
    var completedMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0 });
    var completedLine = new THREE.Line(completedGeo, completedMat);
    scene.add(completedLine);
    var compGlowGeo = new THREE.BufferGeometry();
    var compGlowMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.3, linewidth: 3, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Line(compGlowGeo, compGlowMat));
    var activeSegGeo = new THREE.BufferGeometry();
    var activeSegMat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.85 });
    scene.add(new THREE.Line(activeSegGeo, activeSegMat));

    var FLAME_LEN = 18;
    var flameGeo = new THREE.BufferGeometry();
    var flameMat = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    scene.add(new THREE.Line(flameGeo, flameMat));
    var flameGlowGeo = new THREE.BufferGeometry();
    var flameGlowMat = new THREE.LineBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Line(flameGlowGeo, flameGlowMat));

    // ── Waypoints from shared MissionEvents ──
    var WAYPOINTS = MissionEvents.getWaypoints();

    function wpScenePos(wp) {
      var state = MissionEphemeris.getState(wp.metSec);
      return toScene(state.orion.x, state.orion.y, state.orion.z);
    }

    function wpGetState(wp, nowMet) {
      var win = wp.activeWin || 900;
      if (nowMet > wp.metSec + win)  return 'done';
      if (nowMet >= wp.metSec - 600) return 'active';
      return 'upcoming';
    }

    var wpMeshes = [], wpMats = [];
    var wpVisible = WAYPOINTS.filter(function(wp) { return wp.metSec >= T_START_MET; });
    wpVisible.forEach(function(wp) {
      var mat = new THREE.MeshBasicMaterial({ color: 0x2a3a4a });
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), mat);
      mesh.position.copy(wpScenePos(wp));
      mesh.userData = wp;
      wpMeshes.push(mesh); wpMats.push(mat);
      scene.add(mesh);
    });

    // ── Orion spacecraft (detailed model) ──
    var orionGroup = new THREE.Group();

    // Capsule (crew module — forward end)
    var orionMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, emissive: 0x222222, shininess: 60 });
    var capsule = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 8), orionMat);
    capsule.position.y = -0.3;
    orionGroup.add(capsule);

    // Docking adapter
    var dockingAdapter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8),
      new THREE.MeshPhongMaterial({ color: 0xaaaaaa })
    );
    dockingAdapter.position.y = -0.415;
    orionGroup.add(dockingAdapter);

    // Heat shield
    var heatShield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8),
      new THREE.MeshPhongMaterial({ color: 0x4a3a2a })
    );
    heatShield.position.y = -0.21;
    orionGroup.add(heatShield);

    // Crew module adapter
    var cma = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.04, 8),
      new THREE.MeshPhongMaterial({ color: 0x6a6a6a })
    );
    cma.position.y = -0.18;
    orionGroup.add(cma);

    // Service module (main body)
    var serviceModule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8),
      new THREE.MeshPhongMaterial({ color: 0x777777, emissive: 0x111111 })
    );
    serviceModule.position.y = 0.0;
    orionGroup.add(serviceModule);

    // Engine bell
    var engineBell = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.1, 8, 1, true),
      new THREE.MeshPhongMaterial({ color: 0x3a3a3a })
    );
    engineBell.position.y = 0.2;
    orionGroup.add(engineBell);

    // Solar arrays (4 panels in X-wing pattern)
    var solarMat = new THREE.MeshPhongMaterial({ color: 0x0d2847, emissive: 0x0a1a3a, side: THREE.DoubleSide });
    var armMat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });

    var panelConfigs = [
      { px: -0.25, rz: 0.1 },   // left upper
      { px: -0.25, rz: -0.1 },  // left lower
      { px: 0.25, rz: -0.1 },   // right upper
      { px: 0.25, rz: 0.1 }     // right lower
    ];
    panelConfigs.forEach(function(cfg) {
      var panel = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.07), solarMat);
      panel.position.set(cfg.px, 0, 0);
      panel.rotation.z = cfg.rz;
      orionGroup.add(panel);
      var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 4), armMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(cfg.px > 0 ? 0.05 : -0.05, 0, 0);
      orionGroup.add(arm);
    });

    // Engine exhaust
    var exhaustOuter = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.2, 6),
      new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
    );
    exhaustOuter.position.y = 0.3;
    orionGroup.add(exhaustOuter);

    var exhaustInner = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.12, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending })
    );
    exhaustInner.position.y = 0.26;
    orionGroup.add(exhaustInner);

    // Mission glow
    var glowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.12, side: THREE.BackSide });
    var glowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), glowMat);
    orionGroup.add(glowMesh);

    orionGroup.userData = { label: 'ORION' };
    scene.add(orionGroup);

    // ── Trail particles ──
    var TRAIL_LEN = 30;
    var trailBuf = new Float32Array(TRAIL_LEN * 3);
    var trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailBuf, 3));
    scene.add(new THREE.Points(trailGeo, new THREE.PointsMaterial({ color: 0x00ffaa, size: 0.28, sizeAttenuation: true, transparent: true, opacity: 0.4 })));
    var trailIdx = 0, trailFrame = 0;

    var arrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), 0.8, 0xff8800, 0.2, 0.1);
    scene.add(arrow);

    var edBuf = new Float32Array(6), mdBuf = new Float32Array(6);
    var edGeo = new THREE.BufferGeometry(); edGeo.setAttribute('position', new THREE.BufferAttribute(edBuf, 3));
    var edLine = new THREE.Line(edGeo, new THREE.LineDashedMaterial({ color: 0x00ccff, transparent: true, opacity: 0.3, dashSize: 0.08, gapSize: 0.06 }));
    scene.add(edLine);
    var mdGeo = new THREE.BufferGeometry(); mdGeo.setAttribute('position', new THREE.BufferAttribute(mdBuf, 3));
    var mdLine = new THREE.Line(mdGeo, new THREE.LineDashedMaterial({ color: 0xffdd44, transparent: true, opacity: 0.3, dashSize: 0.08, gapSize: 0.06 }));
    scene.add(mdLine);

    // ── Trace replay dot ──
    var traceDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
    );
    scene.add(traceDot);
    var traceDotGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.BackSide })
    );
    scene.add(traceDotGlow);
    var animProgress = 0;
    var TRACE_TRAIL_LEN = 15;
    // Pre-fill trail buffer so it starts rendering immediately (not degenerate zeros)
    var traceTrailBuf = [];
    for (var _ti = 0; _ti < TRACE_TRAIL_LEN; _ti++) { traceTrailBuf.push(allPts[0].clone()); }
    var traceTrailFrame = 0;
    var traceLineBuf = new Float32Array(TRACE_TRAIL_LEN * 3);
    var traceColorBuf = new Float32Array(TRACE_TRAIL_LEN * 3);
    var traceLineGeo = new THREE.BufferGeometry();
    traceLineGeo.setAttribute('position', new THREE.BufferAttribute(traceLineBuf, 3));
    traceLineGeo.setAttribute('color', new THREE.BufferAttribute(traceColorBuf, 3));
    var traceLineMat = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, linewidth: 2 });
    var traceLineObj = new THREE.Line(traceLineGeo, traceLineMat);
    scene.add(traceLineObj);
    var traceGlowBuf = new Float32Array(TRACE_TRAIL_LEN * 3);
    var traceGlowGeo = new THREE.BufferGeometry();
    traceGlowGeo.setAttribute('position', new THREE.BufferAttribute(traceGlowBuf, 3));
    var traceGlowMat = new THREE.LineBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    var traceGlowObj = new THREE.Line(traceGlowGeo, traceGlowMat);
    scene.add(traceGlowObj);

    // ── Camera ──
    var bbox = new THREE.Box3();
    allPts.forEach(function(p) { bbox.expandByPoint(p); });
    var trajCenter = new THREE.Vector3();
    bbox.getCenter(trajCenter);

    var camLookAt = trajCenter.clone();
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
    function applyCam() { camera.position.copy(sphToPos()); camera.lookAt(camLookAt); }
    applyCam();

    function stopAuto() { autoRotate = false; clearTimeout(rotTimer); rotTimer = setTimeout(function() { autoRotate = true; }, 5000); }
    function exitPreset() {
      if (camMode !== 'orbit') {
        camMode = 'orbit';
        var dx = camera.position.x - camLookAt.x, dy = camera.position.y - camLookAt.y, dz = camera.position.z - camLookAt.z;
        sph.r = Math.sqrt(dx*dx+dy*dy+dz*dz);
        sph.phi = Math.acos(Math.max(-1,Math.min(1,dy/sph.r)));
        sph.theta = Math.atan2(dx, dz);
      }
      activePreset = null;
      updatePresetBtns();
    }
    function smoothEase(t) { return t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
    function startLerp(toPos, toLook, duration, mode) {
      lerpFrom.pos.copy(camera.position); lerpFrom.look.copy(camLookAt);
      lerpTo.pos.copy(toPos); lerpTo.look.copy(toLook);
      lerpT = 0; lerpDuration = duration || 1.0; camMode = mode || 'lerp';
      autoRotate = false; clearTimeout(rotTimer);
    }

    // Helper: get velocity direction from ephemeris, rotated into scene frame
    function getOrionVelocityDir(metSec) {
      var state = MissionEphemeris.getState(metSec);
      var v = new THREE.Vector3(state.orion.vx, state.orion.vy, state.orion.vz).applyMatrix4(rotMat).normalize();
      if (v.lengthSq() < 0.001) v.set(1, 0, 0);
      return v;
    }

    // Preset definitions
    var PRESETS = {
      earth: { label:'\ud83c\udf0d', title:'Earth', pos:function(){return new THREE.Vector3(0, 4, 12);}, look:function(){return new THREE.Vector3(0,0,0);} },
      moon: { label:'\ud83c\udf19', title:'Moon', pos:function(){return moon.position.clone().add(new THREE.Vector3(0, 4, 12));}, look:function(){return moon.position.clone();} },
      orion: { label:'\ud83d\ude80', title:'Orion', pos:function(){ var p=orionGroup.position.clone(); var metS=(Date.now()-LAUNCH_UTC)/1000; var t=getOrionVelocityDir(metS); var side=new THREE.Vector3().crossVectors(t,new THREE.Vector3(0,1,0)).normalize(); return p.clone().add(side.multiplyScalar(6)).add(new THREE.Vector3(0,3,0)); }, look:function(){return orionGroup.position.clone();} },
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
      btn.textContent = p.label; btn.title = p.title;
      Object.assign(btn.style, { padding:'3px 8px',background:'rgba(8,12,26,0.85)',border:'1px solid rgba(74,144,217,0.35)',borderRadius:'12px',color:'#7986a8',fontSize:'12px',cursor:'pointer',fontFamily:"'Share Tech Mono',monospace",transition:'all 0.2s',lineHeight:'1.2' });
      btn.addEventListener('mouseenter', function() { if(activePreset!==key){btn.style.borderColor='#4A90D9';btn.style.color='#fff';} });
      btn.addEventListener('mouseleave', function() { if(activePreset!==key){btn.style.borderColor='rgba(74,144,217,0.35)';btn.style.color='#7986a8';} });
      btn.addEventListener('click', function() {
        if (activePreset === key && key !== 'orion' && key !== 'earthview') { exitPreset(); stopAuto(); return; }
        activePreset = key; updatePresetBtns(); velTheta = 0; velPhi = 0;
        if (key === 'overview') { Object.assign(sph, JSON.parse(JSON.stringify(SPH_DEFAULT))); camLookAt.copy(trajCenter); startLerp(sphToPos(), trajCenter.clone(), 1.0, 'lerp'); return; }
        var mode = (key === 'orion' || key === 'earthview') ? 'track' : 'lerp';
        startLerp(p.pos(), p.look(), 1.0, mode);
      });
      presetBtns[key] = btn; presetBar.appendChild(btn);
    });
    container.appendChild(presetBar);

    function updatePresetBtns() {
      Object.entries(presetBtns).forEach(function(entry) {
        var key = entry[0], btn = entry[1];
        if (key === activePreset) { btn.style.borderColor = '#00e5ff'; btn.style.color = '#00e5ff'; btn.style.boxShadow = '0 0 8px rgba(0,229,255,0.4)'; }
        else { btn.style.borderColor = 'rgba(74,144,217,0.35)'; btn.style.color = '#7986a8'; btn.style.boxShadow = 'none'; }
      });
    }

    // ── Mouse/touch interaction ──
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
        velTheta = -(dx) * 0.005; velPhi = -(dy) * 0.005;
        sph.theta += velTheta; sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + velPhi));
        applyCam();
      }
      lastMx = e.clientX; lastMy = e.clientY;
    });
    renderer.domElement.addEventListener('wheel', function(e) { exitPreset(); sph.r = Math.max(5, Math.min(200, sph.r + e.deltaY * 0.08)); applyCam(); stopAuto(); e.preventDefault(); }, { passive: false });

    renderer.domElement.addEventListener('dblclick', function(e) {
      exitPreset(); stopAuto();
      var rect = renderer.domElement.getBoundingClientRect();
      var mx = ((e.clientX-rect.left)/rect.width)*2-1, my = -((e.clientY-rect.top)/rect.height)*2+1;
      var rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(mx, my), camera);
      var hits = rc.intersectObjects(scene.children, true);
      if (hits.length) { var pt = hits[0].point; var dir = new THREE.Vector3().subVectors(camera.position, pt).normalize(); startLerp(pt.clone().add(dir.multiplyScalar(3)), pt.clone(), 0.8, 'lerp'); }
      else { sph.r = Math.max(3, sph.r * 0.6); applyCam(); }
    });

    var lastTx = 0, lastTy = 0;
    renderer.domElement.addEventListener('touchstart', function(e) { exitPreset(); stopAuto(); lastTx = e.touches[0].clientX; lastTy = e.touches[0].clientY; velTheta = 0; velPhi = 0; });
    renderer.domElement.addEventListener('touchend', function() { rotTimer = setTimeout(function() { autoRotate = true; }, 5000); });
    renderer.domElement.addEventListener('touchmove', function(e) {
      var dx = e.touches[0].clientX - lastTx, dy = e.touches[0].clientY - lastTy;
      if (e.touches.length >= 2) {
        var panScale = sph.r * 0.003;
        var right = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
        camLookAt.add(right.multiplyScalar(-dx * panScale)).add(camera.up.clone().multiplyScalar(dy * panScale));
        applyCam();
      } else {
        velTheta = -(dx) * 0.005; velPhi = -(dy) * 0.005;
        sph.theta += velTheta; sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + velPhi));
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
      var metH = Math.floor(wp.metSec / 3600), metM = Math.floor((wp.metSec % 3600) / 60);
      var metStr = 'T+' + String(metH).padStart(metH >= 100 ? 3 : 2, '0') + ':' + String(metM).padStart(2, '0') + ':00';
      var status, sColor;
      if (nowMet > wp.metSec+900) { status='\u2713 COMPLETED'; sColor='#00e676'; }
      else if (nowMet >= wp.metSec-600) { status='\u25b6 IN PROGRESS'; sColor='#ffd740'; }
      else { status='\u25cb UPCOMING'; sColor='#7986a8'; }
      var etaStr = '';
      if (nowMet < wp.metSec - 600) { var rem = wp.metSec - nowMet; var hh = Math.floor(rem/3600); var mm = Math.floor((rem%3600)/60); etaStr = hh > 0 ? 'in ' + hh + 'h ' + mm + 'm' : 'in ' + mm + 'm'; }
      else if (nowMet <= wp.metSec + 900) { etaStr = 'NOW'; }
      else { var ago = nowMet - wp.metSec; var hh2 = Math.floor(ago/3600); var mm2 = Math.floor((ago%3600)/60); etaStr = hh2 > 0 ? hh2 + 'h ' + mm2 + 'm ago' : mm2 + 'm ago'; }
      var critColors = { CRITICAL:'#ef5350', HIGH:'#ffa726', MEDIUM:'#ffd740' };
      var critC = critColors[wp.crit] || '#7986a8';
      popupEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-size:0.6rem;font-weight:bold;color:#00ffaa;letter-spacing:0.12em;text-shadow:0 0 8px rgba(0,255,170,0.5)">' + wp.label + '</span>' + (wp.crit ? '<span style="font-size:0.36rem;color:' + critC + ';border:1px solid ' + critC + '44;padding:1px 5px;border-radius:2px;letter-spacing:0.08em;">' + wp.crit + '</span>' : '') + '</div><div style="font-size:0.48rem;color:#7986a8;margin-bottom:3px;">' + metStr + '</div><div style="font-size:0.44rem;color:rgba(74,144,217,0.6);margin-bottom:3px;">' + localStr + '</div><div style="font-size:0.44rem;color:rgba(74,144,217,0.7);margin-bottom:6px;letter-spacing:0.06em;">ETA: ' + etaStr + '</div><div style="font-size:0.48rem;color:' + sColor + ';margin-bottom:8px;letter-spacing:0.08em;">' + status + '</div>' + (wp.desc ? '<div style="font-size:0.48rem;color:#c8d0e0;line-height:1.5;">' + wp.desc + '</div>' : '');
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

    function drawCallout(text, v3, color, ox, oy, bold, lineToV3) {
      var s = proj(v3); if (!s.vis) return;
      var x = s.x + (ox||0), y = s.y + (oy||0);
      lctx.save();
      if (lineToV3) {
        var s2 = proj(lineToV3);
        if (s2.vis) { lctx.beginPath(); lctx.moveTo(s2.x, s2.y); lctx.lineTo(x, y); lctx.strokeStyle = color.replace(')', ',0.3)').replace('rgb','rgba').replace('rgba(','rgba(') || 'rgba(0,255,170,0.3)'; lctx.setLineDash([3, 3]); lctx.lineWidth = 0.5; lctx.stroke(); lctx.setLineDash([]); }
      }
      lctx.font = (bold ? 'bold ' : '') + '10px "Share Tech Mono",monospace';
      lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
      var m = lctx.measureText(text); var bw = m.width + 12, bh = 16;
      lctx.fillStyle = 'rgba(0,10,20,0.7)'; lctx.fillRect(x - bw/2, y - bh/2, bw, bh);
      lctx.strokeStyle = color; lctx.lineWidth = 0.5; lctx.globalAlpha = 0.6; lctx.strokeRect(x - bw/2, y - bh/2, bw, bh);
      lctx.globalAlpha = 1.0; lctx.fillStyle = color;
      if (bold) { lctx.shadowColor = color; lctx.shadowBlur = 8; }
      lctx.fillText(text, x, y); lctx.restore();
    }

    var _velDir = new THREE.Vector3();
    var _upVec = new THREE.Vector3(0, 1, 0);
    var _quatLook = new THREE.Quaternion();
    var _lookMat = new THREE.Matrix4();

    function animate() {
      requestAnimationFrame(animate);
      var now = Date.now();
      var elapsed = now - LAUNCH_UTC;
      var metSec = elapsed / 1000;
      var pulse = 0.5 + 0.5 * Math.sin(now / 430);

      // ── Get current state from shared ephemeris ──
      var state = MissionEphemeris.getState(metSec);

      // ── Orion position ──
      var orionResult = getPosByMet(metSec);
      orionGroup.position.copy(orionResult.pos);
      var gt = orionResult.frac;

      // Orient spacecraft: align local +Y with velocity tangent
      var velDir = getOrionVelocityDir(metSec);
      var upRef = new THREE.Vector3(0, 0, 1);
      var quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), velDir);
      orionGroup.quaternion.slerp(quat, 0.1);

      // Exhaust pulse
      exhaustOuter.material.opacity = 0.3 + 0.3 * Math.sin(now / 430);
      exhaustInner.material.opacity = 0.2 + 0.2 * Math.sin(now / 430);

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

      // Speed arrow from ephemeris
      arrow.position.copy(orionGroup.position); arrow.setDirection(velDir);
      var speedKmh = state.speedKms * 3600;
      arrow.setLength(0.35+Math.max(0.2,Math.min(1.0,speedKmh/40000))*0.85, 0.18, 0.09);

      // ── Trace replay animation ──
      animProgress += (gt > 0 ? gt / (15 * 60) : 0.0001);
      if (animProgress >= gt && gt > 0) animProgress = 0;
      var traceFrac = Math.max(0, Math.min(animProgress, 0.999));
      var traceResult = getPosByMet(T_START_MET + traceFrac * T_SPAN_MET);
      traceDot.position.copy(traceResult.pos);
      traceDotGlow.position.copy(traceResult.pos);

      traceTrailFrame++;
      if (traceTrailFrame % 2 === 0) {
        traceTrailBuf.unshift(traceResult.pos.clone());
        if (traceTrailBuf.length > TRACE_TRAIL_LEN) traceTrailBuf.pop();
      }
      for (var tti = 0; tti < TRACE_TRAIL_LEN; tti++) {
        if (tti < traceTrailBuf.length) {
          traceLineBuf[tti*3] = traceTrailBuf[tti].x;
          traceLineBuf[tti*3+1] = traceTrailBuf[tti].y;
          traceLineBuf[tti*3+2] = traceTrailBuf[tti].z;
          traceGlowBuf[tti*3] = traceTrailBuf[tti].x;
          traceGlowBuf[tti*3+1] = traceTrailBuf[tti].y;
          traceGlowBuf[tti*3+2] = traceTrailBuf[tti].z;
        }
        var ff = tti / TRACE_TRAIL_LEN;
        traceColorBuf[tti*3]   = 1.0;
        traceColorBuf[tti*3+1] = 0.7 - ff * 0.5;
        traceColorBuf[tti*3+2] = 0.2 - ff * 0.2;
      }
      traceLineGeo.attributes.position.needsUpdate = true;
      traceLineGeo.attributes.color.needsUpdate = true;
      traceGlowGeo.attributes.position.needsUpdate = true;

      // ── Completed path ──
      var nowMet = metSec;
      var splitIdx = Math.min(Math.floor(gt * N_PTS), N_PTS - 1);
      if (splitIdx > 0) {
        var slice = allPts.slice(0, splitIdx + 2);
        var sliceColors = new Float32Array((splitIdx + 2) * 3);
        for (var ci = 0; ci < splitIdx + 2; ci++) { sliceColors[ci*3]=C_GREEN.r; sliceColors[ci*3+1]=C_GREEN.g; sliceColors[ci*3+2]=C_GREEN.b; }
        completedGeo.setFromPoints(slice);
        completedGeo.setAttribute('color', new THREE.BufferAttribute(sliceColors, 3));
        compGlowGeo.setFromPoints(slice);
        compGlowGeo.setAttribute('color', new THREE.BufferAttribute(sliceColors.slice(), 3));
        activeSegGeo.setFromPoints(allPts.slice(Math.max(0, splitIdx - 12), Math.min(N_PTS, splitIdx + 5)));
        var fStart = Math.max(0, splitIdx - FLAME_LEN);
        var flamePts = allPts.slice(fStart, splitIdx + 1);
        if (flamePts.length > 1) {
          var fColors = new Float32Array(flamePts.length * 3);
          for (var fi = 0; fi < flamePts.length; fi++) { var fff = fi / (flamePts.length - 1); fColors[fi*3]=Math.pow(fff, 0.6); fColors[fi*3+1]=Math.pow(fff, 1.5)*0.95; fColors[fi*3+2]=Math.pow(fff, 3.0)*0.90; }
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
      wpVisible.forEach(function(wp, i) {
        var ws = wpGetState(wp, nowMet);
        wpMats[i].color.setHex(ws === 'done' ? 0x00e676 : ws === 'active' ? 0xffd700 : 0x2a3a4a);
        wpMeshes[i].scale.setScalar(ws === 'active' ? 1.0 + pulse * 0.55 : 1.0);
      });

      earth.rotation.y += 0.00175; moon.rotation.y += 0.0003;

      // ── Camera ──
      if (camMode === 'lerp' && lerpT < 1) {
        lerpT = Math.min(1, lerpT + (1/60) / lerpDuration); var eased = smoothEase(lerpT);
        camera.position.lerpVectors(lerpFrom.pos, lerpTo.pos, eased);
        camLookAt.lerpVectors(lerpFrom.look, lerpTo.look, eased);
        camera.lookAt(camLookAt);
        if (lerpT >= 1 && activePreset === 'overview') { camMode = 'orbit'; var dx2=camera.position.x-camLookAt.x,dy2=camera.position.y-camLookAt.y,dz2=camera.position.z-camLookAt.z; sph.r=Math.sqrt(dx2*dx2+dy2*dy2+dz2*dz2); sph.phi=Math.acos(Math.max(-1,Math.min(1,dy2/sph.r))); sph.theta=Math.atan2(dx2, dz2); }
      } else if (camMode === 'track') {
        if (activePreset === 'orion') { var tp=PRESETS.orion.pos(),tl=orionGroup.position.clone(); if(lerpT<1){lerpT=Math.min(1,lerpT+(1/60)/lerpDuration);var e2=smoothEase(lerpT);camera.position.lerpVectors(lerpFrom.pos,tp,e2);camLookAt.lerpVectors(lerpFrom.look,tl,e2);} else{camera.position.lerp(tp,0.05);camLookAt.lerp(tl,0.05);} camera.lookAt(camLookAt); }
        else if (activePreset === 'earthview') { var ep=orionGroup.position.clone().add(new THREE.Vector3(0,0.2,0)),el2=new THREE.Vector3(0,0,0); if(lerpT<1){lerpT=Math.min(1,lerpT+(1/60)/lerpDuration);var e3=smoothEase(lerpT);camera.position.lerpVectors(lerpFrom.pos,ep,e3);camLookAt.lerpVectors(lerpFrom.look,el2,e3);} else{camera.position.lerp(ep,0.05);camLookAt.lerp(el2,0.05);} camera.lookAt(camLookAt); }
      } else {
        if (!isDrag && !isPan && (Math.abs(velTheta) > 0.0001 || Math.abs(velPhi) > 0.0001)) { sph.theta += velTheta; sph.phi = Math.max(0.1, Math.min(Math.PI-0.1, sph.phi + velPhi)); velTheta *= damping; velPhi *= damping; applyCam(); }
        if (autoRotate) { sph.theta += 0.0008; applyCam(); }
      }

      renderer.render(scene, camera);

      // ── 2D Holographic callouts ──
      lctx.clearRect(0, 0, W, H);
      var ds = window.dashboardState || {};
      var _tuEarth = document.getElementById('tu-earth');
      var isImp = _tuEarth ? _tuEarth.textContent.trim() === 'MI' : false;
      var KM_TO_MI = 0.621371;

      var moonDistStr = isImp ? Math.round(state.distMoonKm * KM_TO_MI).toLocaleString() + ' mi' : Math.round(state.distMoonKm).toLocaleString() + ' km';
      var orionEarthDist = orionGroup.position.distanceTo(earth.position);
      drawCallout('ORION \u00b7 ' + moonDistStr + ' to Moon', new THREE.Vector3(orionGroup.position.x, orionGroup.position.y + (orionEarthDist < 1.8 ? -3.0 : -2.2), orionGroup.position.z), '#00ffaa', 0, -24, true, orionGroup.position);

      drawCallout('EARTH', new THREE.Vector3(earth.position.x, earth.position.y - 1.4, earth.position.z), 'rgba(100,170,255,0.85)', 0, 0, false, earth.position);
      drawCallout('MOON', new THREE.Vector3(moon.position.x, moon.position.y - 0.8, moon.position.z), 'rgba(200,195,180,0.85)', 0, 0, false, moon.position);

      var emMid = new THREE.Vector3().addVectors(earth.position, moon.position).multiplyScalar(0.5); emMid.y += 0.7;
      var emKm = Math.sqrt(state.moon.x*state.moon.x + state.moon.y*state.moon.y + state.moon.z*state.moon.z);
      var emDistStr = isImp ? Math.round(emKm * KM_TO_MI).toLocaleString() + ' MI' : Math.round(emKm).toLocaleString() + ' KM';
      drawCallout('EARTH\u2013MOON: ' + emDistStr, emMid, 'rgba(255,255,255,0.35)', 0, 0, false, null);

      var earthDistStr = isImp ? Math.round(state.distEarthKm * KM_TO_MI).toLocaleString() + ' mi' : Math.round(state.distEarthKm).toLocaleString() + ' km';
      var altPt = new THREE.Vector3().lerpVectors(orionGroup.position, earth.position, 0.4); altPt.y += 0.35;
      drawCallout('ALT: ' + earthDistStr, altPt, 'rgba(0,204,255,0.7)', 0, 0, false, null);

      // Waypoint labels
      wpVisible.forEach(function(wp, i) {
        var ws = wpGetState(wp, nowMet);
        var s = proj(wpMeshes[i].position); if (!s.vis) return;
        var color = ws === 'done' ? '#00e676' : ws === 'active' ? '#ffd700' : 'rgba(100,130,170,0.55)';
        var bold = ws === 'active';
        lctx.save();
        lctx.font = (bold ? 'bold ' : '') + '9px "Share Tech Mono",monospace';
        var m = lctx.measureText(wp.label);
        var bw = m.width + 10, bh = 14;
        var lx = s.x + 18, ly = s.y - 18;
        if (lx + bw > W - 4) lx = s.x - bw - 12;
        lctx.fillStyle = 'rgba(0,8,18,0.72)';
        lctx.fillRect(lx - 4, ly - bh/2, bw, bh);
        lctx.strokeStyle = color; lctx.lineWidth = 0.5; lctx.globalAlpha = bold ? 0.85 : 0.5;
        lctx.strokeRect(lx - 4, ly - bh/2, bw, bh);
        lctx.globalAlpha = 1.0;
        lctx.fillStyle = color; lctx.textAlign = 'left'; lctx.textBaseline = 'middle';
        if (bold) { lctx.shadowColor = color; lctx.shadowBlur = 10; }
        lctx.fillText(wp.label, lx, ly);
        lctx.beginPath(); lctx.moveTo(s.x, s.y); lctx.lineTo(lx - 4, ly);
        lctx.strokeStyle = color; lctx.lineWidth = 0.5; lctx.globalAlpha = 0.4;
        lctx.setLineDash([2,3]); lctx.stroke(); lctx.setLineDash([]);
        lctx.restore();
      });

      if (progressEl) { var fd = Math.max(1, Math.floor(elapsed / (24*3600*1000)) + 1); progressEl.textContent = 'MISSION PROGRESS: ' + (gt*100).toFixed(1) + '%  \u00b7  FLIGHT DAY ' + fd; }
    }
    animate();

    // ── Telemetry HUD ──
    var hudEl = document.getElementById('traj-hud');
    var hudToggle = document.getElementById('hud-toggle');
    var hudVisible = true;
    if (hudToggle) { hudToggle.addEventListener('click', function() { hudVisible = !hudVisible; hudEl.classList.toggle('collapsed', !hudVisible); hudToggle.classList.toggle('collapsed', !hudVisible); hudToggle.innerHTML = hudVisible ? '&#9666;' : '&#9656;'; }); }

    var EARTH_DIAM_KM = 12742, MOON_DIAM_KM = 3474, SPEED_OF_LIGHT_KMS = 299792.458, KM_TO_MI_HUD = 0.621371;

    var DV_BUDGET = [
      { metSec: 0, dv: 3900 }, { metSec: 2940, dv: 3700 }, { metSec: 6477, dv: 3400 },
      { metSec: 90000, dv: 1600 }, { metSec: 187200, dv: 1500 }, { metSec: 540000, dv: 800 },
      { metSec: 820800, dv: 50 }, { metSec: 824760, dv: 0 },
    ];
    var ECC_PHASES = [
      { metSec: 0, ecc: 0.01 }, { metSec: 2940, ecc: 0.35 }, { metSec: 6477, ecc: 0.80 },
      { metSec: 90000, ecc: 0.97 }, { metSec: 360000, ecc: 1.20 }, { metSec: 433500, ecc: 1.80 },
      { metSec: 540000, ecc: 0.97 }, { metSec: 820800, ecc: 0.98 },
    ];

    function lerpTable(table, key, val) {
      if (val <= table[0][key]) return table[0];
      if (val >= table[table.length-1][key]) return table[table.length-1];
      for (var i = 1; i < table.length; i++) {
        if (val <= table[i][key]) { var f = (val - table[i-1][key]) / (table[i][key] - table[i-1][key]); var result = {}; for (var k in table[i]) { result[k] = k === key ? val : table[i-1][k] + (table[i][k] - table[i-1][k]) * f; } return result; }
      }
      return table[table.length-1];
    }

    function tickHUD() {
      if (!hudEl) return;
      var ds = window.dashboardState || {};
      var _tuEarthHud = document.getElementById('tu-earth');
      var isImp = _tuEarthHud ? _tuEarthHud.textContent.trim() === 'MI' : false;
      var elapsed = Date.now() - LAUNCH_UTC;
      var metSec = elapsed / 1000;
      var state = MissionEphemeris.getState(metSec);
      var earthKm = state.distEarthKm, moonKm = state.distMoonKm, speedKmh = state.speedKms * 3600;

      var earthStr, moonStr, speedStr, earthUnit, speedUnit;
      if (isImp) { earthStr=Math.round(earthKm*KM_TO_MI_HUD).toLocaleString(); moonStr=Math.round(moonKm*KM_TO_MI_HUD).toLocaleString(); speedStr=Math.round(speedKmh*KM_TO_MI_HUD).toLocaleString(); earthUnit='MI'; speedUnit='MPH'; }
      else { earthStr=Math.round(earthKm).toLocaleString(); moonStr=Math.round(moonKm).toLocaleString(); speedStr=Math.round(speedKmh).toLocaleString(); earthUnit='KM'; speedUnit='KM/H'; }

      var altEl = document.getElementById('hud-alt');
      var velEl = document.getElementById('hud-vel');
      if (altEl) altEl.textContent = earthStr + ' ' + earthUnit.toLowerCase();
      if (velEl) velEl.textContent = speedStr + ' ' + speedUnit.toLowerCase();

      var eccEl = document.getElementById('hud-ecc');
      if (eccEl) { eccEl.textContent = lerpTable(ECC_PHASES, 'metSec', metSec).ecc.toFixed(3); }

      var hudEarth = document.getElementById('hud-earth');
      var hudMoon = document.getElementById('hud-moon');
      if (hudEarth) hudEarth.textContent = earthStr + ' ' + earthUnit.toLowerCase();
      if (hudMoon) hudMoon.textContent = moonStr + ' ' + earthUnit.toLowerCase();

      var rtlEl = document.getElementById('hud-rtl');
      if (rtlEl && earthKm > 0) { var rtlSec = (earthKm * 2) / SPEED_OF_LIGHT_KMS; rtlEl.textContent = rtlSec < 1 ? (rtlSec * 1000).toFixed(0) + ' ms' : rtlSec.toFixed(2) + ' s'; }

      var esizeEl = document.getElementById('hud-esize');
      var msizeEl = document.getElementById('hud-msize');
      if (esizeEl && earthKm > 100) { var angE = 2*Math.atan2(EARTH_DIAM_KM/2, earthKm)*(180/Math.PI); esizeEl.textContent = angE >= 1 ? angE.toFixed(1)+'\u00b0' : (angE*60).toFixed(1)+"'"; }
      if (msizeEl && moonKm > 100) { var angM = 2*Math.atan2(MOON_DIAM_KM/2, moonKm)*(180/Math.PI); msizeEl.textContent = angM >= 1 ? angM.toFixed(1)+'\u00b0' : (angM*60).toFixed(1)+"'"; }

      var dsnEl = document.getElementById('hud-dsn');
      if (dsnEl) dsnEl.textContent = ds.dsnStation || 'ACQUIRING';

      var losEv = null, aosEv = null;
      var wps = MissionEvents.getWaypoints();
      for (var i = 0; i < wps.length; i++) { if (wps[i].label === 'FAR SIDE LOS') losEv = wps[i]; if (wps[i].label === 'SIGNAL ACQ') aosEv = wps[i]; }
      var losEl = document.getElementById('hud-los');
      if (losEl && losEv && aosEv) {
        if (metSec < losEv.metSec) { var rem = losEv.metSec - metSec; var hh = Math.floor(rem/3600); var mm = Math.floor((rem%3600)/60); losEl.textContent = hh > 0 ? hh+'h '+mm+'m' : mm+'m'; losEl.className = rem < 7200 ? 'hud-val warn' : 'hud-val'; }
        else if (metSec < aosEv.metSec) { losEl.textContent = 'BLACKOUT'; losEl.className = 'hud-val crit'; }
        else { losEl.textContent = 'CLEAR'; losEl.className = 'hud-val good'; }
      }

      var kpEl = document.getElementById('hud-kp');
      if (kpEl && ds.kpIndex !== null && ds.kpIndex !== undefined) { kpEl.textContent = ds.kpIndex; kpEl.className = ds.kpIndex >= 5 ? 'hud-val crit' : ds.kpIndex >= 4 ? 'hud-val warn' : 'hud-val good'; }
      var solarEl = document.getElementById('hud-solar');
      if (solarEl && ds.solarWind !== null && ds.solarWind !== undefined) { solarEl.textContent = ds.solarWind + ' km/s'; solarEl.className = ds.solarWind >= 600 ? 'hud-val warn' : 'hud-val'; }

      var phaseEl = document.getElementById('hud-phase');
      if (phaseEl) { var pn = document.getElementById('current-phase-name'); phaseEl.textContent = pn ? pn.textContent.trim() : '\u2014'; }
      var dayEl = document.getElementById('hud-day');
      if (dayEl) { dayEl.textContent = Math.max(1, Math.floor(elapsed / (24*3600*1000)) + 1) + ' of 10'; }
      var nextEl = document.getElementById('hud-next');
      if (nextEl && ds.nextEvent) { var short = ds.nextEvent.length > 10 ? ds.nextEvent.slice(0, 10) : ds.nextEvent; nextEl.textContent = short + (ds.nextEventEta ? ' ' + ds.nextEventEta : ''); nextEl.title = ds.nextEvent + (ds.nextEventEta ? ' in ' + ds.nextEventEta : ''); }

      var dvEl = document.getElementById('hud-dv');
      if (dvEl) { var dvData = lerpTable(DV_BUDGET, 'metSec', metSec); dvEl.textContent = Math.round(dvData.dv) + ' m/s'; dvEl.className = dvData.dv < 100 ? 'hud-val warn' : 'hud-val'; }

      var incEl = document.getElementById('hud-inc');
      if (incEl) {
        var ox=state.orion.x,oy=state.orion.y,oz=state.orion.z,ovx=state.orion.vx,ovy=state.orion.vy,ovz=state.orion.vz;
        var hx=oy*ovz-oz*ovy, hy=oz*ovx-ox*ovz, hz=ox*ovy-oy*ovx;
        var hMag=Math.sqrt(hx*hx+hy*hy+hz*hz);
        if (hMag > 0) { incEl.textContent = (Math.acos(Math.max(-1,Math.min(1,hz/hMag)))*(180/Math.PI)).toFixed(1)+'\u00b0'; }
      }
    }

    tickHUD();
    setInterval(tickHUD, 2000);
  } // end init()
})();
