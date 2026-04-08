// trajectory.js — 3D Three.js trajectory visualization
// Uses shared MissionEphemeris for all position/state data.
// Uses shared MissionEvents for waypoint markers.
// ── TRAJECTORY 3D — CINEMATIC SCI-FI ─────────────────────────────────
(function() {
  var container = document.getElementById('trajectory-3d');
  if (!container || typeof THREE === 'undefined') return;

  var _loopStarted = false;

  var MISSION_MS = 10 * 24 * 3600 * 1000;
  var EARTH_R_KM = 6371;
  var SCENE_EARTH_R = 0.9;          // scene units (globe mesh radius)
  var SCENE_SCALE = SCENE_EARTH_R / EARTH_R_KM;
  var KM_PER_UNIT = EARTH_R_KM / SCENE_EARTH_R; // 1 scene unit = 7079 km
  var SURFACE_RADIUS = SCENE_EARTH_R * 1.001;    // just above globe mesh, avoids z-fighting
  var loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';

  function earthGMST(date) {
    // GMST in radians — matches Matteo Beu's A4() formula
    var JD = date.getTime() / 86400000 + 2440587.5;
    var T = JD - 2451545.0;
    return (0.779057273264 + 1.0027378119113546 * T) * 2 * Math.PI;
  }

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
    // Find closest approach
    var caIdx = 0, caMinDist = Infinity;
    for (var i = 0; i < points.length; i++) {
      if (points[i].distMoonKm < caMinDist) { caMinDist = points[i].distMoonKm; caIdx = i; }
    }
    var caPt = points[caIdx];

    // X axis: Earth-to-Moon direction at closest approach
    var moonAtCA = new THREE.Vector3(caPt.moon.x, caPt.moon.y, caPt.moon.z);
    var xAxis = moonAtCA.clone().normalize();

    // Compute angular momentum vectors for outbound and inbound legs
    // to find a viewing normal that reveals the figure-8
    function angularMomentum(p) {
      var r = new THREE.Vector3(p.orion.x, p.orion.y, p.orion.z);
      var v = new THREE.Vector3(p.orion.vx, p.orion.vy, p.orion.vz);
      return new THREE.Vector3().crossVectors(r, v);
    }

    // Sample outbound point at ~40% of journey and inbound at ~60%
    var outIdx = Math.floor(caIdx * 0.4);
    var inIdx = Math.min(points.length - 1, caIdx + Math.floor((points.length - caIdx) * 0.4));
    var hOut = angularMomentum(points[outIdx]);
    var hIn = angularMomentum(points[inIdx]);

    // Average the two angular momentum vectors — this gives a normal
    // that's tilted between the two orbital planes, revealing the
    // figure-8 crossing
    var hAvg = hOut.clone().add(hIn).normalize();

    // Z axis = average angular momentum (orbit normal)
    var zAxis = hAvg.clone();

    // Make sure Z axis is not parallel to X axis
    if (Math.abs(xAxis.dot(zAxis)) > 0.95) {
      // Fallback: use velocity tangent at CA
      var caIdxPrev = Math.max(caIdx - 1, 0);
      var caIdxNext = Math.min(caIdx + 1, points.length - 1);
      var tangent3d = new THREE.Vector3(
        points[caIdxNext].orion.x - points[caIdxPrev].orion.x,
        points[caIdxNext].orion.y - points[caIdxPrev].orion.y,
        points[caIdxNext].orion.z - points[caIdxPrev].orion.z
      ).normalize();
      zAxis = new THREE.Vector3().crossVectors(xAxis, tangent3d).normalize();
    }

    // Y axis = Z cross X (ensures right-handed orthonormal basis)
    var yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    // Re-orthogonalise Z
    zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();

    var rotMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).transpose();

    // Earth base orientation quaternion:
    // Three.js sphere: local +X = prime meridian (lon=0°), local +Y = north pole
    var _earthBaseMat = new THREE.Matrix4().set(
      xAxis.x, zAxis.x, -yAxis.x, 0,
      xAxis.y, zAxis.y, -yAxis.y, 0,
      xAxis.z, zAxis.z, -yAxis.z, 0,
      0, 0, 0, 1
    );
    var earthBaseQuat = new THREE.Quaternion().setFromRotationMatrix(_earthBaseMat);

    // ── Geo helpers for surface-fixed objects (children of earth mesh) ──
    // Matches Three.js SphereGeometry UV mapping: theta=0 at lng=-180, +Y = north pole
    function latLngToEarthLocal(lat, lng, r) {
      var phi   = (90 - lat) * Math.PI / 180;
      var theta = (lng + 180) * Math.PI / 180;
      return new THREE.Vector3(
        -r * Math.cos(theta) * Math.sin(phi),
         r * Math.cos(phi),
         r * Math.sin(theta) * Math.sin(phi)
      );
    }
    function greatCircleLocal(lat1, lng1, lat2, lng2, n, r) {
      var p1 = latLngToEarthLocal(lat1, lng1, 1).normalize();
      var p2 = latLngToEarthLocal(lat2, lng2, 1).normalize();
      var pts = [];
      var dot = Math.max(-1, Math.min(1, p1.dot(p2)));
      var angle = Math.acos(dot);
      for (var _i = 0; _i <= n; _i++) {
        var t = _i / n;
        var p;
        if (angle < 0.001) {
          p = p1.clone().multiplyScalar(r);
        } else {
          var sa = Math.sin(angle);
          p = new THREE.Vector3()
            .addScaledVector(p1, Math.sin((1 - t) * angle) / sa)
            .addScaledVector(p2, Math.sin(t * angle) / sa)
            .multiplyScalar(r);
        }
        pts.push(p);
      }
      return pts;
    }

    var scaleDebugVisible = false;

    function toScene(x, y, z) {
      var v = new THREE.Vector3(x, y, z).applyMatrix4(rotMat);
      return new THREE.Vector3(v.x * SCENE_SCALE, v.y * SCENE_SCALE, v.z * SCENE_SCALE);
    }

    var trajScene = points.map(function(p) {
      return { metSec: p.metSec, pos: toScene(p.orion.x, p.orion.y, p.orion.z) };
    });
    var allPts = trajScene.map(function(p) { return p.pos.clone(); });
    // If ephemeris starts after launch, prepend a smooth spiral ascent from Earth's surface
    if (T_START_MET > 60) {
      var firstPt = trajScene[0].pos;
      var launchPts = [];
      var LAUNCH_STEPS = 25;
      var dir = firstPt.clone().normalize();
      var startPos = dir.clone().multiplyScalar(SCENE_EARTH_R * 1.02);
      var up = new THREE.Vector3(0, 1, 0);
      var perp1 = new THREE.Vector3().crossVectors(dir, up).normalize();
      if (perp1.length() < 0.1) perp1.set(1, 0, 0);
      var perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();
      for (var li = 0; li < LAUNCH_STEPS; li++) {
        var f = li / LAUNCH_STEPS;
        var eased = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        var pos = startPos.clone().lerp(firstPt, eased);
        var spiralAngle = f * Math.PI * 4;
        var spiralR = (1 - f) * (1 - f) * SCENE_EARTH_R * 0.4;
        pos.add(perp1.clone().multiplyScalar(Math.sin(spiralAngle) * spiralR));
        pos.add(perp2.clone().multiplyScalar(Math.cos(spiralAngle) * spiralR * 0.5));
        launchPts.push(pos);
      }
      var launchTrajEntries = launchPts.map(function(p, i) {
        return { metSec: (i / LAUNCH_STEPS) * T_START_MET, pos: p };
      });
      trajScene = launchTrajEntries.concat(trajScene);
      allPts = trajScene.map(function(p) { return p.pos.clone(); });
    }
    var N_PTS = allPts.length;

    // Index of closest approach in allPts (accounts for prepended launch spiral)
    var caSceneIdx = 0;
    for (var ci = 0; ci < trajScene.length; ci++) {
      if (trajScene[ci].metSec >= points[caIdx].metSec) { caSceneIdx = ci; break; }
    }

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
    // Kick off real sun/moon orientation data load (async, safe to call multiple times)
    if (typeof FlybyLighting !== 'undefined') FlybyLighting.load();

    var W = container.clientWidth || 400;
    var H = container.clientHeight || 300;
    var camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 2000);

    var renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x030810, 1);
    Object.assign(renderer.domElement.style, { position:'absolute',top:'0',left:'0',width:'100%',height:'100%' });
    container.appendChild(renderer.domElement);

    // ── Mobile 3-stat strip (visible only at ≤767px via CSS) ──
    var mobileStrip = document.createElement('div');
    mobileStrip.id = 'traj-mobile-strip';
    mobileStrip.innerHTML =
      '<div class="tms-stat"><span class="tms-label">EARTH DIST</span><span class="tms-value" id="tms-earth">\u2014</span></div>' +
      '<div class="tms-stat"><span class="tms-label">SPEED</span><span class="tms-value" id="tms-speed">\u2014</span></div>' +
      '<div class="tms-stat"><span class="tms-label">PHASE</span><span class="tms-value" id="tms-phase">\u2014</span></div>';
    container.appendChild(mobileStrip);

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
    var earthMat = new THREE.MeshPhongMaterial({ color: 0x2255aa, emissive: 0x051828, shininess: 25, specular: 0x224466 });
    var earth = new THREE.Mesh(new THREE.SphereGeometry(SCENE_EARTH_R, 48, 48), earthMat);
    earth.rotation.order = 'YXZ';
    scene.add(earth);

    // Day texture
    loadTex([
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
    ], function(tex) { earthMat.map = tex; earthMat.color.set(0xffffff); earthMat.needsUpdate = true; });

    // Night lights (emissive map — city lights on dark side)
    loadTex([
      'https://unpkg.com/three-globe/example/img/earth-night.jpg',
    ], function(tex) { earthMat.emissiveMap = tex; earthMat.emissive.set(0x888888); earthMat.needsUpdate = true; });

    // Cloud layer mesh
    var cloudMat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.35, depthWrite: false });
    var cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(SCENE_EARTH_R * 1.008, 48, 48), cloudMat);
    earth.add(cloudMesh); // child of earth so it inherits rotation
    loadTex([
      'https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/planets/earth_atmos_2048.jpg',
    ], function(tex) { cloudMat.alphaMap = tex; cloudMat.color = new THREE.Color(0xffffff); cloudMat.needsUpdate = true; });

    // Atmosphere glow
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(SCENE_EARTH_R * 1.018, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.12, side: THREE.BackSide })));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(SCENE_EARTH_R * 1.08, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x4A90D9, transparent: true, opacity: 0.06, side: THREE.BackSide })));

    // LEO orbit ring
    var leoPts = [];
    for (var i = 0; i <= 80; i++) { var a = (i/80)*Math.PI*2; leoPts.push(new THREE.Vector3(1.35*Math.cos(a), 0.22*Math.sin(a), 1.35*Math.sin(a)*0.96)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(leoPts), new THREE.LineBasicMaterial({ color: 0x4A90D9, transparent: true, opacity: 0.2 })));

    // ── ISS & ISS Orbit ──
    // TLE — CelesTrak supplemental, Segment 1, epoch 2026-089.5 = 2026-03-30T12:00:00Z
    var ISS_ALT_KM   = 408; // real ISS altitude ≈ 408 km → orbit r = 6779 km, ratio 1.064
    var ISS_SCENE_R  = (EARTH_R_KM + ISS_ALT_KM) * SCENE_SCALE; // 0.9 * (6779/6371) = 0.9576
    var ISS_INC      = 51.6332 * Math.PI / 180;
    var ISS_RAAN0    = 329.4800 * Math.PI / 180;  // RAAN at TLE epoch
    var ISS_ARGP     = 251.7519 * Math.PI / 180;  // argument of perigee
    var ISS_M0       = 176.3009 * Math.PI / 180;  // mean anomaly at TLE epoch
    var ISS_N_RAD    = 15.48666334 * 2 * Math.PI / 86400; // mean motion rad/s
    var ISS_RAAN_DOT = -4.86 * Math.PI / 180 / 86400;    // nodal precession rad/s (from TLE pair)
    var ISS_EPOCH_MS = Date.UTC(2026, 2, 30, 12, 0, 0);  // 2026-03-30T12:00:00Z

    // ECI unit position/velocity vectors for ISS at argument-of-latitude u, RAAN raan
    function issECIDir(u, raan) {
      var sinI = Math.sin(ISS_INC), cosI = Math.cos(ISS_INC);
      var sinR = Math.sin(raan),    cosR = Math.cos(raan);
      return new THREE.Vector3(
        Math.cos(u) * cosR - Math.sin(u) * cosI * sinR,
        Math.cos(u) * sinR + Math.sin(u) * cosI * cosR,
        Math.sin(u) * sinI
      );
    }
    function issECIVel(u, raan) {
      var sinI = Math.sin(ISS_INC), cosI = Math.cos(ISS_INC);
      var sinR = Math.sin(raan),    cosR = Math.cos(raan);
      return new THREE.Vector3(
        -Math.sin(u) * cosR - Math.cos(u) * cosI * sinR,
        -Math.sin(u) * sinR + Math.cos(u) * cosI * cosR,
         Math.cos(u) * sinI
      );
    }

    // Draw orbit ring at current RAAN
    var _issInitRaan = ISS_RAAN0 + ISS_RAAN_DOT * ((Date.now() - ISS_EPOCH_MS) / 1000);
    var issOrbitPts = [];
    for (var i = 0; i <= 80; i++) {
      var sp = issECIDir(ISS_ARGP + (i / 80) * Math.PI * 2, _issInitRaan).applyMatrix4(rotMat).normalize().multiplyScalar(ISS_SCENE_R);
      issOrbitPts.push(sp);
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(issOrbitPts), new THREE.LineBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.1 })));
    
    var issGroup = new THREE.Group();
    if (typeof createISSModel !== 'undefined') {
      issGroup = createISSModel(THREE);
    }
    scene.add(issGroup);

    // ── USS John P. Murtha (LPD-26) — Artemis II recovery ship ────────────
    var MURTHA_WAYPOINTS = [
      { lat: 32.6735, lng: -117.1555, timeMs: Date.UTC(2026, 3, 1, 0, 0, 0),
        label: 'Homeport \u2013 Naval Base San Diego' },
      { lat: 32.5,    lng: -119.0,    timeMs: Date.UTC(2026, 3, 11, 0, 15, 0),
        label: 'Splashdown recovery zone' }
    ];
    var SPLASHDOWN_LAT = 32.5, SPLASHDOWN_LNG = -119.0;
    var SPLASHDOWN_MS  = Date.UTC(2026, 3, 11, 0, 15, 0); // 2026-04-11T00:15Z (≈17:15 PDT)

    // Current ship position — interpolate by time between waypoints as fallback
    var murthaLat = MURTHA_WAYPOINTS[0].lat;
    var murthaLng = MURTHA_WAYPOINTS[0].lng;
    var murthaLabel = 'AIS unavailable';
    var murthaSpeed = null, murthaHeading = null;
    (function() {
      var now = Date.now();
      var t0 = MURTHA_WAYPOINTS[0].timeMs, t1 = MURTHA_WAYPOINTS[1].timeMs;
      var frac = Math.max(0, Math.min(1, (now - t0) / (t1 - t0)));
      // Slerp lat/lng (approximate; ship barely moves on globe scale)
      murthaLat = MURTHA_WAYPOINTS[0].lat + frac * (MURTHA_WAYPOINTS[1].lat - MURTHA_WAYPOINTS[0].lat);
      murthaLng = MURTHA_WAYPOINTS[0].lng + frac * (MURTHA_WAYPOINTS[1].lng - MURTHA_WAYPOINTS[0].lng);
    }());

    // AIS fetch — wrapped in try/catch, fails gracefully (CORS expected on browser pages)
    (function() {
      try {
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 5000) : null;
        var opts = ctrl ? { signal: ctrl.signal } : {};
        fetch('https://www.marinetraffic.com/en/ais/details/ships/mmsi:368926266', opts)
          .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
          .then(function(html) {
            if (timer) clearTimeout(timer);
            var latM = html.match(/\"latitude\"[:\s]*\"?([-\d.]+)/i);
            var lngM = html.match(/\"longitude\"[:\s]*\"?([-\d.]+)/i);
            var spdM = html.match(/\"speed\"[:\s]*\"?([\d.]+)/i);
            var hdgM = html.match(/\"course\"[:\s]*\"?([\d.]+)/i);
            if (latM && lngM) {
              murthaLat   = parseFloat(latM[1]);
              murthaLng   = parseFloat(lngM[1]);
              murthaLabel = 'AIS ' + new Date().toUTCString().slice(17, 22) + ' UTC';
              if (spdM) murthaSpeed   = parseFloat(spdM[1]);
              if (hdgM) murthaHeading = parseFloat(hdgM[1]);
              rebuildMurthaGeometry();
            }
          })
          ['catch'](function() { /* CORS expected — silently use fallback */ });
      } catch(e) { /* ignore */ }
    }());

    // ── Build ship geometry (children of earth so they rotate with the globe) ──
    var murthaGroup = new THREE.Group();
    earth.add(murthaGroup);

    // Ship marker — amber diamond (OctahedronGeometry ∈ r128)
    var shipMarkerMat = new THREE.MeshBasicMaterial({ color: 0xffc200 });
    var shipMarkerGeo = new THREE.OctahedronGeometry(0.012, 0);
    var shipMarker    = new THREE.Mesh(shipMarkerGeo, shipMarkerMat);
    murthaGroup.add(shipMarker);

    // Outer glow ring around ship marker
    var shipRingPts = [];
    for (var _sri = 0; _sri <= 32; _sri++) {
      var _sra = (_sri / 32) * Math.PI * 2;
      shipRingPts.push(new THREE.Vector3(Math.cos(_sra) * 0.018, 0, Math.sin(_sra) * 0.018));
    }
    var shipRingGeo = new THREE.BufferGeometry().setFromPoints(shipRingPts);
    var shipRingMat = new THREE.LineBasicMaterial({ color: 0xffc200, transparent: true, opacity: 0.5 });
    var shipRing    = new THREE.Line(shipRingGeo, shipRingMat);
    murthaGroup.add(shipRing);

    // Historical track: homeport → current position
    var histTrackMat = new THREE.LineBasicMaterial({ color: 0xffc200, transparent: true, opacity: 0.55 });
    var histTrackLine = new THREE.Line(new THREE.BufferGeometry(), histTrackMat);
    earth.add(histTrackLine);

    // Projected path: current → splashdown (dimmer)
    var projTrackMat = new THREE.LineBasicMaterial({ color: 0xffc200, transparent: true, opacity: 0.25 });
    var projTrackLine = new THREE.Line(new THREE.BufferGeometry(), projTrackMat);
    earth.add(projTrackLine);

    // Splashdown target reticle (two rings, concentric)
    var splashGroup = new THREE.Group();
    earth.add(splashGroup);
    (function() {
      var sp = latLngToEarthLocal(SPLASHDOWN_LAT, SPLASHDOWN_LNG, SURFACE_RADIUS);
      var norm = sp.clone().normalize();
      var qRet = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
      splashGroup.position.copy(sp);
      splashGroup.quaternion.copy(qRet);
      [0.025, 0.045].forEach(function(rad) {
        var rPts = [];
        for (var _ri = 0; _ri <= 48; _ri++) {
          var _ra = (_ri / 48) * Math.PI * 2;
          rPts.push(new THREE.Vector3(Math.cos(_ra) * rad, 0, Math.sin(_ra) * rad));
        }
        var rGeo = new THREE.BufferGeometry().setFromPoints(rPts);
        var rMat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.9 });
        splashGroup.add(new THREE.Line(rGeo, rMat));
      });
      // Crosshair lines
      [[-0.05,0,0,0.05,0,0],[0,0,-0.05,0,0,0.05]].forEach(function(coords) {
        var cGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(coords[0],coords[1],coords[2]),
          new THREE.Vector3(coords[3],coords[4],coords[5])
        ]);
        splashGroup.add(new THREE.Line(cGeo,
          new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.7 })));
      });
    }());

    // Build/rebuild mutable geometry (historical + projected tracks, ship marker position)
    function rebuildMurthaGeometry() {
      var sp = latLngToEarthLocal(murthaLat, murthaLng, SURFACE_RADIUS);
      var norm = sp.clone().normalize();
      var qm = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
      shipMarker.position.copy(sp);
      shipRing.position.copy(sp);
      shipRing.quaternion.copy(qm);

      var histPts = greatCircleLocal(
        MURTHA_WAYPOINTS[0].lat, MURTHA_WAYPOINTS[0].lng,
        murthaLat, murthaLng, 24, SURFACE_RADIUS);
      histTrackLine.geometry.setFromPoints(histPts);

      var projPts = greatCircleLocal(
        murthaLat, murthaLng,
        SPLASHDOWN_LAT, SPLASHDOWN_LNG, 24, SURFACE_RADIUS);
      projTrackLine.geometry.setFromPoints(projPts);
    }
    rebuildMurthaGeometry();
    var _murthaLastUpdate = 0;

    // Info panel (DOM) — amber style, consistent with dashboard
    var murthaPanel = document.createElement('div');
    murthaPanel.id = 'murtha-panel';
    murthaPanel.style.cssText =
      'position:absolute;bottom:44px;left:10px;z-index:4;background:rgba(4,8,18,0.88);' +
      'border:1px solid rgba(255,194,0,0.35);border-radius:4px;padding:8px 12px;' +
      'font-family:"Share Tech Mono",monospace;font-size:10px;color:#ffc200;' +
      'pointer-events:none;max-width:200px;line-height:1.6;' +
      'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';
    container.appendChild(murthaPanel);

    function updateMurthaPanel() {
      var now = Date.now();
      var secsToSplash = (SPLASHDOWN_MS - now) / 1000;
      var distKm = (function() {
        var R = 6371;
        var lat1 = murthaLat * Math.PI / 180, lat2 = SPLASHDOWN_LAT * Math.PI / 180;
        var dlat = lat2 - lat1;
        var dlng = (SPLASHDOWN_LNG - murthaLng) * Math.PI / 180;
        var a = Math.sin(dlat/2)*Math.sin(dlat/2) +
                Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlng/2)*Math.sin(dlng/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }());
      var cdStr = '\u2014';
      if (secsToSplash > 0) {
        var cdH = Math.floor(secsToSplash / 3600);
        var cdM = Math.floor((secsToSplash % 3600) / 60);
        var cdS = Math.floor(secsToSplash % 60);
        cdStr = String(cdH).padStart(2,'0') + ':' + String(cdM).padStart(2,'0') + ':' + String(cdS).padStart(2,'0');
      } else {
        cdStr = 'RECOVERY IN PROGRESS';
      }
      var aisLine = murthaSpeed !== null
        ? String(murthaSpeed.toFixed(1)) + ' kts &nbsp; HDG ' + Math.round(murthaHeading) + '\u00b0'
        : murthaLabel;
      murthaPanel.innerHTML =
        '<div style="color:#ffd700;font-weight:bold;margin-bottom:3px;">\u2693 USS JOHN P. MURTHA</div>' +
        '<div style="color:#aa8800;">LPD-26 &nbsp;\u00b7\u00b7 MMSI 368926266</div>' +
        '<div style="margin-top:4px;">' + aisLine + '</div>' +
        '<div>to splash: ' + distKm.toFixed(0) + ' km</div>' +
        '<div style="color:#ffd700;">T\u2212splash ' + cdStr + '</div>' +
        '<div style="color:#5a4400;font-size:9px;margin-top:2px;">Splashdown Apr\u00a011 ~17:15 PDT</div>';
    }
    updateMurthaPanel();

    // ── End USS Murtha ──────────────────────────────────────────────────────

    // ── Moon — positioned dynamically from ephemeris ──
    var MOON_SCENE_R = 0.245; // realistic: Moon is 27.3% of Earth radius (0.9 * 0.273)
    var moonMat = new THREE.MeshPhongMaterial({ color: 0xaaa89e, emissive: 0x050503, shininess: 3 });
    var moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_SCENE_R, 48, 48), moonMat);
    scene.add(moon);
    loadTex(['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg'],
      function(tex) { moonMat.map = tex; moonMat.color.set(0xdddddd); moonMat.needsUpdate = true; });
    loadTex(['https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/planets/moon_1024.jpg'],
      function(tex) { moonMat.bumpMap = tex; moonMat.bumpScale = 0.003; moonMat.needsUpdate = true; });
    var moonGlow = new THREE.Mesh(new THREE.SphereGeometry(MOON_SCENE_R * 1.15, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xccccbb, transparent: true, opacity: 0.06, side: THREE.BackSide }));
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
    var upMat = new THREE.LineDashedMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.5, linewidth: 2, dashSize: 1.5, gapSize: 1.0 });
    var upLine = new THREE.Line(upGeo, upMat);
    upLine.computeLineDistances();
    scene.add(upLine);
    // Upcoming path glow — 4 offset copies (additive, dashed)
    var upGlowLines = [];
    [{x:0,y:0.05,z:0},{x:0,y:-0.05,z:0},{x:0.05,y:0,z:0},{x:-0.05,y:0,z:0}].forEach(function(off) {
      var geo = new THREE.BufferGeometry().setFromPoints(allPts);
      var mat = new THREE.LineDashedMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, dashSize: 0.8, gapSize: 0.4 });
      var line = new THREE.Line(geo, mat);
      line.position.set(off.x, off.y, off.z);
      line.computeLineDistances();
      scene.add(line);
      upGlowLines.push(line);
    });

    var C_GREEN = new THREE.Color(0x00ffcc);
    var completedGeo = new THREE.BufferGeometry();
    var completedMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0 });
    var completedLine = new THREE.Line(completedGeo, completedMat);
    scene.add(completedLine);
    // Completed path glow — 6 offset copies (additive)
    var GLOW_OFFSETS = [
      {x:0,y:0.1,z:0},{x:0,y:-0.1,z:0},
      {x:0.1,y:0,z:0},{x:-0.1,y:0,z:0},
      {x:0,y:0,z:0.1},{x:0,y:0,z:-0.1},
      {x:0.05,y:0.05,z:0},{x:-0.05,y:-0.05,z:0}
    ];
    var compGlowLines = [];
    GLOW_OFFSETS.forEach(function(off) {
      var geo = new THREE.BufferGeometry();
      var mat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
      var line = new THREE.Line(geo, mat);
      line.position.set(off.x, off.y, off.z);
      scene.add(line);
      compGlowLines.push({geo: geo, line: line});
    });
    var compCoreLines = [];
    [{x:0,y:0.02,z:0},{x:0,y:-0.02,z:0},{x:0.02,y:0,z:0},{x:-0.02,y:0,z:0}].forEach(function(off) {
      var geo = new THREE.BufferGeometry();
      var mat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.7 });
      var line = new THREE.Line(geo, mat);
      line.position.set(off.x, off.y, off.z);
      scene.add(line);
      compCoreLines.push({geo: geo});
    });
    var compBloomLines = [];
    [{x:0,y:0.2,z:0},{x:0,y:-0.2,z:0},{x:0.2,y:0,z:0},{x:-0.2,y:0,z:0}].forEach(function(off) {
      var geo = new THREE.BufferGeometry();
      var mat = new THREE.LineBasicMaterial({
        color: 0x00ffcc, transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      var line = new THREE.Line(geo, mat);
      line.position.set(off.x, off.y, off.z);
      scene.add(line);
      compBloomLines.push({geo: geo});
    });
    // ── Return leg (amber/orange) ──
    var returnGeo = new THREE.BufferGeometry();
    var returnMat = new THREE.LineBasicMaterial({ color: 0xff8844, transparent: true, opacity: 1.0 });
    var returnLine = new THREE.Line(returnGeo, returnMat);
    scene.add(returnLine);
    var returnGlowLines = [];
    [{x:0,y:0.1,z:0},{x:0,y:-0.1,z:0},{x:0.1,y:0,z:0},{x:-0.1,y:0,z:0},{x:0,y:0,z:0.1},{x:0,y:0,z:-0.1}].forEach(function(off) {
      var geo = new THREE.BufferGeometry();
      var mat = new THREE.LineBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
      var line = new THREE.Line(geo, mat);
      line.position.set(off.x, off.y, off.z);
      scene.add(line);
      returnGlowLines.push({geo: geo});
    });
    var returnCoreLines = [];
    [{x:0,y:0.02,z:0},{x:0,y:-0.02,z:0},{x:0.02,y:0,z:0},{x:-0.02,y:0,z:0}].forEach(function(off) {
      var geo = new THREE.BufferGeometry();
      var mat = new THREE.LineBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.7 });
      var line = new THREE.Line(geo, mat);
      line.position.set(off.x, off.y, off.z);
      scene.add(line);
      returnCoreLines.push({geo: geo});
    });
    var returnBloomLines = [];
    [{x:0,y:0.2,z:0},{x:0,y:-0.2,z:0},{x:0.2,y:0,z:0},{x:-0.2,y:0,z:0}].forEach(function(off) {
      var geo = new THREE.BufferGeometry();
      var mat = new THREE.LineBasicMaterial({
        color: 0xff8844, transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      var line = new THREE.Line(geo, mat);
      line.position.set(off.x, off.y, off.z);
      scene.add(line);
      returnBloomLines.push({geo: geo});
    });

    var activeSegGeo = new THREE.BufferGeometry();
    var activeSegMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 1.0 });
    scene.add(new THREE.Line(activeSegGeo, activeSegMat));
    // Active segment glow — 4 offset copies (additive, gold)
    var activeGlowLines = [];
    [{x:0,y:0.05,z:0},{x:0,y:-0.05,z:0},{x:0.05,y:0,z:0},{x:-0.05,y:0,z:0}].forEach(function(off) {
      var geo = new THREE.BufferGeometry();
      var mat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
      var line = new THREE.Line(geo, mat);
      line.position.set(off.x, off.y, off.z);
      scene.add(line);
      activeGlowLines.push({geo: geo});
    });

    var FLAME_LEN = 18;
    var flameGeo = new THREE.BufferGeometry();
    var flameMat = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    scene.add(new THREE.Line(flameGeo, flameMat));
    var flameGlowGeo = new THREE.BufferGeometry();
    var flameGlowMat = new THREE.LineBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Line(flameGlowGeo, flameGlowMat));

    // ── Pre-allocate geometry buffers ─────────────────────────────────
    // Avoids creating new Float32Arrays every frame (prevents WebGL buffer leaks
    // caused by replaced BufferAttributes never being explicitly disposed).
    var MAX_PATH  = N_PTS;
    var MAX_FLAME = FLAME_LEN + 4;
    var MAX_ACTIVE = 25;

    function _preallocPos(geo, maxPts) {
      var buf = new Float32Array(maxPts * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
      geo.setDrawRange(0, 0);
      return buf;
    }
    function _fillGeo(buf, geo, pts) {
      var n = Math.min(pts.length, buf.length / 3);
      for (var _i = 0; _i < n; _i++) { buf[_i*3]=pts[_i].x; buf[_i*3+1]=pts[_i].y; buf[_i*3+2]=pts[_i].z; }
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, n);
    }
    function _clearGeo(geo) { geo.setDrawRange(0, 0); }

    var completedPosBuf = _preallocPos(completedGeo, MAX_PATH);
    var completedColBuf = (function() {
      var b = new Float32Array(MAX_PATH * 3);
      completedGeo.setAttribute('color', new THREE.BufferAttribute(b, 3));
      return b;
    }());
    compGlowLines.forEach(function(g) { g._buf = _preallocPos(g.geo, MAX_PATH); });
    compCoreLines.forEach(function(g) { g._buf = _preallocPos(g.geo, MAX_PATH); });
    compBloomLines.forEach(function(g) { g._buf = _preallocPos(g.geo, MAX_PATH); });
    var returnPosBuf = _preallocPos(returnGeo, MAX_PATH);
    returnGlowLines.forEach(function(g) { g._buf = _preallocPos(g.geo, MAX_PATH); });
    returnCoreLines.forEach(function(g) { g._buf = _preallocPos(g.geo, MAX_PATH); });
    returnBloomLines.forEach(function(g) { g._buf = _preallocPos(g.geo, MAX_PATH); });
    var activePosBuf  = _preallocPos(activeSegGeo, MAX_ACTIVE);
    activeGlowLines.forEach(function(g) { g._buf = _preallocPos(g.geo, MAX_ACTIVE); });
    var flamePosBuf   = _preallocPos(flameGeo, MAX_FLAME);
    var flameColBuf   = (function() {
      var b = new Float32Array(MAX_FLAME * 3);
      flameGeo.setAttribute('color', new THREE.BufferAttribute(b, 3));
      return b;
    }());
    var flameGlowPosBuf = _preallocPos(flameGlowGeo, MAX_FLAME);

    // ── Waypoints from shared MissionEvents ──
    var WAYPOINTS = (typeof MissionEvents !== 'undefined' && MissionEvents.getWaypoints) ? MissionEvents.getWaypoints() : [];

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
      var mat = new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.9 });
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat);
      mesh.position.copy(wpScenePos(wp));
      mesh.userData = wp;
      wpMeshes.push(mesh); wpMats.push(mat);
      scene.add(mesh);
      var wpGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.15, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      wpGlow.position.copy(wpScenePos(wp));
      scene.add(wpGlow);
    });

    // ── Orion spacecraft (detailed model from orion-model.js) ──
    var orionGroup = new THREE.Group();
    var exhaustOuter, exhaustInner, glowMat;

    try {
      if (typeof createOrionModel !== 'undefined') {
        orionGroup = createOrionModel(THREE);
      } else {
        throw new Error('createOrionModel is not defined. (Cache issue?)');
      }
      exhaustOuter = orionGroup.userData.exhaustOuter;
      exhaustInner = orionGroup.userData.exhaustInner;
      glowMat = orionGroup.userData.glowMat;
    } catch (err) {
      console.error('[Orion] Model load failed, using simple fallback:', err);
      // Simple but decent fallback
      var fbMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, emissive: 0x222222, shininess: 60 });
      // Crew module cone
      var fbCapsule = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 8), fbMat);
      fbCapsule.position.y = -0.3;
      orionGroup.add(fbCapsule);
      // Service module cylinder
      var fbSM = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.15, 8), fbMat);
      fbSM.position.y = -0.135;
      orionGroup.add(fbSM);
      // 4 solar panels
      var fbSolarMat = new THREE.MeshPhongMaterial({ color: 0x1a237e, side: THREE.DoubleSide });
      for (var fsi = 0; fsi < 4; fsi++) {
        var fsA = (fsi / 4) * Math.PI * 2 + Math.PI / 4;
        var fsPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.05), fbSolarMat);
        fsPanel.position.set(Math.cos(fsA) * 0.2, -0.135, Math.sin(fsA) * 0.2);
        fsPanel.rotation.y = -fsA + Math.PI / 2;
        orionGroup.add(fsPanel);
      }
      // Engine
      var fbEng = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 6), fbMat);
      fbEng.position.y = -0.03;
      orionGroup.add(fbEng);
      // Exhaust
      exhaustOuter = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      exhaustOuter.position.y = 0.0;
      orionGroup.add(exhaustOuter);
      exhaustInner = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      exhaustInner.position.y = 0.0;
      orionGroup.add(exhaustInner);
      glowMat = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.04, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });
      orionGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), glowMat));
      orionGroup.userData.hullMat = fbMat;
    }
    
    orionGroup.userData.label = 'ORION';
    orionGroup.scale.set(0.35, 0.35, 0.35);
    scene.add(orionGroup);

    // Trace particles removed (neon pulse on path is used instead)
    var TRAIL_LEN = 30;
    var trailBuf = new Float32Array(TRAIL_LEN * 3);
    var trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailBuf, 3));
    scene.add(new THREE.Points(trailGeo, new THREE.PointsMaterial({ color: 0x00ffaa, size: 0.28, sizeAttenuation: true, transparent: true, opacity: 0.4 })));
    var trailIdx = 0, trailFrame = 0;

    var arrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(), 0.8, 0xff6600, 0.2, 0.1);
    scene.add(arrow);

    var edBuf = new Float32Array(6), mdBuf = new Float32Array(6);
    var edGeo = new THREE.BufferGeometry(); edGeo.setAttribute('position', new THREE.BufferAttribute(edBuf, 3));
    var edLine = new THREE.Line(edGeo, new THREE.LineDashedMaterial({ color: 0x00ccff, transparent: true, opacity: 0.3, dashSize: 0.08, gapSize: 0.06 }));
    scene.add(edLine);
    var mdGeo = new THREE.BufferGeometry(); mdGeo.setAttribute('position', new THREE.BufferAttribute(mdBuf, 3));
    var mdLine = new THREE.Line(mdGeo, new THREE.LineDashedMaterial({ color: 0xffdd44, transparent: true, opacity: 0.3, dashSize: 0.08, gapSize: 0.06 }));
    scene.add(mdLine);

    // ── Trace replay dot removed — replaced by neon pulse on completed path ──
    var animProgress = 0;    // kept to avoid breaking references
    var TRACE_TRAIL_LEN = 15; // kept to avoid breaking references

    // ── Camera ──
    var bbox = new THREE.Box3();
    allPts.forEach(function(p) { bbox.expandByPoint(p); });
    var trajCenter = new THREE.Vector3();
    bbox.getCenter(trajCenter);

    var camLookAt = trajCenter.clone();
    var sph = { theta: 1.2, phi: 1.1, r: 90 };
    var SPH_DEFAULT = { theta: 1.2, phi: 1.1, r: 90 };
    var reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isDrag = false, isPan = false, lastMx = 0, lastMy = 0, autoRotate = !reduceMotion, rotTimer = null;
    var lastReducedRenderMs = 0;
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
      overview: { label:'\ud83d\udd2d', title:'Overview', pos:function(){return sphToPos();}, look:function(){return trajCenter.clone();}, isSph:true },
      earth: { label:'\ud83c\udf0d', title:'Earth', pos:function(){return new THREE.Vector3(0, 4, 12);}, look:function(){return new THREE.Vector3(0,0,0);} },
      earthview: { label:'\ud83c\udf0f', title:'Earth View', pos:function(){return orionGroup.position.clone().add(new THREE.Vector3(0,0.2,0));}, look:function(){return new THREE.Vector3(0,0,0);} },
      iss: { label:'\ud83d\udef0\ufe0f', title:'ISS', pos:function(){ return issGroup.position.clone().add(new THREE.Vector3(0, 0.4, 0.8)); }, look:function(){ return issGroup.position.clone(); } },
      orion: { label:'\ud83d\ude80', title:'Orion', pos:function(){ var p=orionGroup.position.clone(); var metS=(Date.now()-LAUNCH_UTC)/1000; var t=getOrionVelocityDir(metS); var side=new THREE.Vector3().crossVectors(t,new THREE.Vector3(0,1,0)).normalize(); return p.clone().add(side.multiplyScalar(6)).add(new THREE.Vector3(0,3,0)); }, look:function(){return orionGroup.position.clone();} },
      moon: { label:'\ud83c\udf19', title:'Moon', pos:function(){return moon.position.clone().add(new THREE.Vector3(0, 4, 12));}, look:function(){return moon.position.clone();} },
      moonview: {
        label: '\ud83c\udf19\ud83d\ude80', title: 'Lunar Flyby',
        pos: function() {
          var mp = moon.position.clone();
          var op = orionGroup.position.clone();
          var toOrion = new THREE.Vector3().subVectors(op, mp).normalize();
          var up = new THREE.Vector3(0, 1, 0);
          var perp = new THREE.Vector3().crossVectors(toOrion, up).normalize();
          if (perp.lengthSq() < 0.1) perp.set(1, 0, 0);
          return mp.clone()
            .add(toOrion.clone().multiplyScalar(3))
            .add(perp.clone().multiplyScalar(4))
            .add(new THREE.Vector3(0, 5, 0));
        },
        look: function() { return moon.position.clone(); },
        isFlyby: true
      }
    };

    // ── Preset buttons bar ──
    var presetWrapper = document.createElement('div');
    Object.assign(presetWrapper.style, { position:'absolute',bottom:'10px',left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'0',zIndex:'4' });
    var povLabel = document.createElement('div');
    Object.assign(povLabel.style, { fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'rgba(74,144,217,0.55)',letterSpacing:'0.14em',textAlign:'center',padding:'2px 12px',border:'1px solid rgba(74,144,217,0.2)',borderBottom:'none',borderRadius:'3px 3px 0 0',background:'rgba(4,8,20,0.75)',whiteSpace:'nowrap' });
    povLabel.textContent = 'POINT OF VIEW';
    presetWrapper.appendChild(povLabel);
    var presetBar = document.createElement('div');
    Object.assign(presetBar.style, { display:'flex',gap:'4px',padding:'4px 6px',background:'rgba(4,8,20,0.75)',border:'1px solid rgba(74,144,217,0.2)',borderRadius:'0 0 5px 5px' });
    var presetBtns = {};
    Object.entries(PRESETS).forEach(function(entry) {
      var key = entry[0], p = entry[1];
      var btn = document.createElement('button');
      btn.textContent = p.label; btn.title = p.title;
      Object.assign(btn.style, { padding:'3px 8px',background:'rgba(8,12,26,0.85)',border:'1px solid rgba(74,144,217,0.35)',borderRadius:'12px',color:'#7986a8',fontSize:'12px',cursor:'pointer',fontFamily:"'Share Tech Mono',monospace",transition:'all 0.2s',lineHeight:'1.2' });
      btn.addEventListener('mouseenter', function() { if(activePreset!==key){btn.style.borderColor='#4A90D9';btn.style.color='#fff';} });
      btn.addEventListener('mouseleave', function() { if(activePreset!==key){btn.style.borderColor='rgba(74,144,217,0.35)';btn.style.color='#7986a8';} });
      btn.addEventListener('click', function() {
        if (activePreset === key && key !== 'orion' && key !== 'earthview' && key !== 'iss' && key !== 'moonview') { exitPreset(); stopAuto(); return; }
        activePreset = key; updatePresetBtns(); velTheta = 0; velPhi = 0;
        if (key === 'overview') { Object.assign(sph, JSON.parse(JSON.stringify(SPH_DEFAULT))); camLookAt.copy(trajCenter); startLerp(sphToPos(), trajCenter.clone(), 1.0, 'lerp'); return; }
        var mode = (key === 'orion' || key === 'earthview' || key === 'iss' || key === 'moonview') ? 'track' : 'lerp';
        if (key === 'moonview') { showMoonviewPopup(); }
        startLerp(p.pos(), p.look(), 1.0, mode);
      });
      presetBtns[key] = btn; presetBar.appendChild(btn);
    });
    presetWrapper.appendChild(presetBar);
    container.appendChild(presetWrapper);

    function updatePresetBtns() {
      var _nowMetS = (Date.now() - LAUNCH_UTC) / 1000;
      var _inFlybyWindow = _nowMetS > 345600 && _nowMetS < 518400; // Day 4–6
      Object.entries(presetBtns).forEach(function(entry) {
        var key = entry[0], btn = entry[1];
        if (key === 'moonview') { btn.style.display = _inFlybyWindow ? '' : 'none'; }
        if (key === activePreset) { btn.style.borderColor = '#00e5ff'; btn.style.color = '#00e5ff'; btn.style.boxShadow = '0 0 8px rgba(0,229,255,0.4)'; }
        else { btn.style.borderColor = 'rgba(74,144,217,0.35)'; btn.style.color = '#7986a8'; btn.style.boxShadow = 'none'; }
      });
    }

    // ── Mouse/touch interaction ──
    renderer.domElement.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    var dragStartX = 0, dragStartY = 0, wasDragged = false;
    renderer.domElement.addEventListener('mousedown', function(e) {
      if (e.button === 2) { isPan = true; } else { isDrag = true; }
      dragStartX = e.clientX; dragStartY = e.clientY; wasDragged = false;
      exitPreset(); stopAuto(); lastMx = e.clientX; lastMy = e.clientY; velTheta = 0; velPhi = 0;
    });
    window.addEventListener('mouseup', function() { isDrag = false; isPan = false; });
    window.addEventListener('mousemove', function(e) {
      var ddx = e.clientX - dragStartX, ddy = e.clientY - dragStartY;
      if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) wasDragged = true;
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
    renderer.domElement.addEventListener('wheel', function(e) { exitPreset(); sph.r = Math.max(0.5, Math.min(200, sph.r + e.deltaY * sph.r * 0.0015)); applyCam(); stopAuto(); e.preventDefault(); }, { passive: false });

    renderer.domElement.addEventListener('dblclick', function(e) {
      exitPreset(); stopAuto();
      var rect = renderer.domElement.getBoundingClientRect();
      var mx = ((e.clientX-rect.left)/rect.width)*2-1, my = -((e.clientY-rect.top)/rect.height)*2+1;
      var rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(mx, my), camera);
      var hits = rc.intersectObjects(scene.children, true);
      if (hits.length) { var pt = hits[0].point; var dir = new THREE.Vector3().subVectors(camera.position, pt).normalize(); startLerp(pt.clone().add(dir.multiplyScalar(3)), pt.clone(), 0.8, 'lerp'); }
      else { sph.r = Math.max(0.5, sph.r * 0.6); applyCam(); }
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
    ctrlDiv.className = 'traj-controls';
    Object.assign(ctrlDiv.style, { display:'flex',flexDirection:'row',gap:'3px',marginLeft:'6px',paddingLeft:'6px',borderLeft:'1px solid rgba(74,144,217,0.3)',alignItems:'center' });
    [{text:'+',fn:function(){exitPreset();sph.r=Math.max(0.5,sph.r*0.8);applyCam();stopAuto();}},{text:'\u2212',fn:function(){exitPreset();sph.r=Math.min(200,sph.r*1.2);applyCam();stopAuto();}},{text:'\u27f2',fn:function(){exitPreset();Object.assign(sph,JSON.parse(JSON.stringify(SPH_DEFAULT)));camLookAt.copy(trajCenter);applyCam();autoRotate=true;activePreset='overview';updatePresetBtns();}}].forEach(function(b) {
      var btn = document.createElement('button'); btn.textContent = b.text;
      Object.assign(btn.style, { width:'26px',height:'26px',background:'rgba(8,12,26,0.85)',border:'1px solid rgba(74,144,217,0.45)',borderRadius:'3px',color:'#4A90D9',fontSize:'14px',fontFamily:"'Share Tech Mono',monospace",cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:'1',padding:'0' });
      btn.addEventListener('mouseenter', function() { btn.style.borderColor='#4A90D9'; btn.style.color='#fff'; });
      btn.addEventListener('mouseleave', function() { btn.style.borderColor='rgba(74,144,217,0.45)'; btn.style.color='#4A90D9'; });
      btn.addEventListener('click', b.fn); ctrlDiv.appendChild(btn);
    });
    presetBar.appendChild(ctrlDiv);

    // ── Waypoint popup ──
    var popupEl = document.createElement('div');
    Object.assign(popupEl.style, { position:'absolute',display:'none',background:'rgba(0,10,20,0.88)',border:'1px solid rgba(0,255,170,0.4)',borderRadius:'4px',padding:'10px 14px',zIndex:'5',maxWidth:'280px',minWidth:'200px',fontFamily:"'Share Tech Mono',monospace",pointerEvents:'auto',boxShadow:'0 0 12px rgba(0,255,170,0.25)' });
    container.appendChild(popupEl);
    var popupOpen = false;

    if (typeof OsculatingOrbit !== 'undefined') OsculatingOrbit.init(scene, THREE, toScene, rotMat, SCENE_SCALE, popupEl, lctx, camera, W, H);

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
    var hoveredWpIdx = -1;
    renderer.domElement.addEventListener('mousemove', function(e) {
      var rect = renderer.domElement.getBoundingClientRect();
      var mx2 = (e.clientX - rect.left) * (W / rect.width);
      var my2 = (e.clientY - rect.top) * (H / rect.height);
      var hoveringLabel = false;
      var hoveredWi = -1;
      for (var wi2 = 0; wi2 < wpClickAreas.length; wi2++) {
        var a2 = wpClickAreas[wi2];
        if (mx2 >= a2.x && mx2 <= a2.x + a2.w && my2 >= a2.y && my2 <= a2.y + a2.h) { hoveringLabel = true; hoveredWi = a2.idx; break; }
      }
      hoveredWpIdx = hoveredWi;
      if (hoveringLabel) { renderer.domElement.style.cursor = 'pointer'; if (tooltipEl) tooltipEl.style.opacity = '0'; return; }
      if (!tooltipEl) return;
      mouse3.x = ((e.clientX-rect.left)/rect.width)*2-1; mouse3.y = -((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse3, camera);
      var hits = raycaster.intersectObjects([orionGroup].concat(wpMeshes));
      if (hits.length) { tooltipEl.textContent = hits[0].object.userData.label || hits[0].object.parent.userData.label || ''; tooltipEl.style.left=(e.clientX-rect.left+12)+'px'; tooltipEl.style.top=(e.clientY-rect.top-8)+'px'; tooltipEl.style.opacity='1'; renderer.domElement.style.cursor='pointer'; }
      else { tooltipEl.style.opacity='0'; renderer.domElement.style.cursor='grab'; }
    });
    renderer.domElement.addEventListener('mouseleave', function() { if (tooltipEl) tooltipEl.style.opacity='0'; });
    renderer.domElement.addEventListener('click', function(e) {
      if (wasDragged) return;  // Don't process clicks that were actually drags
      var rect = renderer.domElement.getBoundingClientRect();
      var scaleX = W / rect.width, scaleY = H / rect.height;
      var mx = (e.clientX - rect.left) * scaleX;
      var my = (e.clientY - rect.top) * scaleY;
      
      console.log('[WP Click] Checking ' + wpClickAreas.length + ' areas at (' + mx.toFixed(0) + ',' + my.toFixed(0) + ')');

      // Check osculating orbit periapsis dot (30 px radius)
      if (typeof OsculatingOrbit !== 'undefined' && OsculatingOrbit.handleClick(mx, my)) { popupOpen = true; return; }

      // Check 2D label hit areas first
      for (var wi = wpClickAreas.length - 1; wi >= 0; wi--) {
        var a = wpClickAreas[wi];
        if (mx >= a.x && mx <= a.x + a.w && my >= a.y && my <= a.y + a.h) {
          console.log('[WP Click] HIT: ' + a.wp.label);
          var targetPos = wpScenePos(a.wp);
          var camDist = 8;
          var camDir = new THREE.Vector3(2, 1.5, 3).normalize();
          var newCamPos = targetPos.clone().add(camDir.multiplyScalar(camDist));
          startLerp(newCamPos, targetPos.clone(), 1.5, 'lerp');
          activePreset = null; updatePresetBtns();
          showWpPopup(a.wp, e.clientX, e.clientY);
          e.stopPropagation(); return;
        }
      }
      if (popupOpen) { closePopup(); return; }
      mouse3.x = ((e.clientX-rect.left)/rect.width)*2-1; mouse3.y = -((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse3, camera);
      var hits = raycaster.intersectObjects(wpMeshes);
      if (hits.length && hits[0].object.userData.desc) openPopup(hits[0].object.userData, e.clientX-rect.left, e.clientY-rect.top);
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && popupOpen) closePopup();
      if (e.key === 's' || e.key === 'S') scaleDebugVisible = !scaleDebugVisible;
    });

    var _resizeObs = new ResizeObserver(function() { W=container.clientWidth||400; H=container.clientHeight||300; renderer.setSize(W,H); lc.width=W; lc.height=H; camera.aspect=W/H; camera.updateProjectionMatrix(); });
    _resizeObs.observe(container);

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
      lctx.font = (bold ? 'bold ' : '') + '12px "Share Tech Mono",monospace';
      lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
      var m = lctx.measureText(text); var bw = m.width + 16, bh = 22;
      lctx.fillStyle = 'rgba(0,18,34,0.85)'; lctx.fillRect(x - bw/2, y - bh/2, bw, bh);
      lctx.strokeStyle = color; lctx.lineWidth = 1.0; lctx.globalAlpha = 0.8; lctx.strokeRect(x - bw/2, y - bh/2, bw, bh);
      lctx.globalAlpha = 1.0; lctx.fillStyle = color;
      if (bold) { lctx.shadowColor = color; lctx.shadowBlur = 8; }
      lctx.fillText(text, x, y); lctx.restore();
    }

    var _velDir = new THREE.Vector3();
    var _upVec = new THREE.Vector3(0, 1, 0);
    var _quatLook = new THREE.Quaternion();
    var _lookMat = new THREE.Matrix4();

    var wpClickAreas = [];

    var wpPopup = null;
    function showWpPopup(wp, screenX, screenY) {
      if (wpPopup) wpPopup.remove();
      var cont = document.getElementById('trajectory-panel') || container.parentElement || container;
      wpPopup = document.createElement('div');
      wpPopup.style.cssText = 'position:absolute;z-index:20;background:rgba(5,12,30,0.95);border:1px solid rgba(0,204,170,0.4);border-radius:6px;padding:12px 16px;max-width:300px;font-family:"Share Tech Mono",monospace;box-shadow:0 0 20px rgba(0,255,170,0.15);';
      var fullEvent = null;
      var events = MissionEvents.events;
      for (var ei = 0; ei < events.length; ei++) {
        if (events[ei].label === wp.label) { fullEvent = events[ei]; break; }
      }
      var evDate = new Date(LAUNCH_UTC.getTime() + wp.metSec * 1000);
      var metH = Math.floor(wp.metSec / 3600);
      var metM = Math.floor((wp.metSec % 3600) / 60);
      var metStr = 'T+' + metH + 'h ' + metM + 'm';
      var nowMet2 = (Date.now() - LAUNCH_UTC) / 1000;
      var diff = wp.metSec - nowMet2;
      var statusStr = '';
      if (diff > 0) {
        var dh = Math.floor(diff / 3600); var dm = Math.floor((diff % 3600) / 60);
        statusStr = '<span style="color:#4488aa;">in ' + dh + 'h ' + dm + 'm</span>';
      } else {
        var ah = Math.floor(-diff / 3600); var am = Math.floor((-diff % 3600) / 60);
        statusStr = '<span style="color:#00e676;">' + ah + 'h ' + am + 'm ago \u2713</span>';
      }
      var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
      html += '<span style="color:#00ffcc;font-size:0.9rem;font-weight:bold;">' + wp.label + '</span>';
      html += '<span style="cursor:pointer;color:rgba(100,130,170,0.6);font-size:0.8rem;" onclick="this.parentElement.parentElement.remove()">\u2715</span>';
      html += '</div>';
      html += '<div style="color:#8899aa;font-size:0.68rem;margin-bottom:8px;">' + metStr + ' \u00b7 ' + evDate.toUTCString().slice(0,22) + ' UTC \u00b7 ' + statusStr + '</div>';
      if (fullEvent && fullEvent.name) html += '<div style="color:#ccdde8;font-size:0.78rem;margin-bottom:6px;">' + fullEvent.name + '</div>';
      if (fullEvent && fullEvent.crew) html += '<div style="color:#00ccaa;font-size:0.7rem;margin-bottom:5px;">\ud83d\udc68\u200d\ud83d\ude80 ' + fullEvent.crew + '</div>';
      if (fullEvent && fullEvent.desc) html += '<div style="color:rgba(180,210,240,0.85);font-size:0.73rem;line-height:1.45;">' + fullEvent.desc + '</div>';
      wpPopup.innerHTML = html;
      var cRect = cont.getBoundingClientRect();
      var left = screenX - cRect.left + 15;
      var top = screenY - cRect.top - 20;
      if (left + 300 > cRect.width) left = left - 330;
      if (top < 10) top = 10;
      if (top + 200 > cRect.height) top = cRect.height - 210;
      wpPopup.style.left = Math.max(5, left) + 'px';
      wpPopup.style.top = Math.max(5, top) + 'px';
      cont.style.position = 'relative';
      cont.appendChild(wpPopup);
      setTimeout(function() { if (wpPopup && wpPopup.parentElement) wpPopup.remove(); }, 10000);
    }

    container.addEventListener('mousedown', function(e) {
      if (wpPopup && !wpPopup.contains(e.target)) { wpPopup.remove(); wpPopup = null; }
    });

    function showMoonviewPopup() {
      var _existing = container.querySelector('.moonview-popup');
      if (_existing) _existing.remove();
      var _pop = document.createElement('div');
      _pop.className = 'moonview-popup';
      _pop.style.cssText = 'position:absolute;z-index:20;background:rgba(5,12,30,0.95);border:1px solid rgba(200,195,180,0.4);border-radius:6px;padding:14px 18px;font-family:"Share Tech Mono",monospace;box-shadow:0 0 20px rgba(200,195,180,0.2);max-width:290px;left:50%;top:60px;transform:translateX(-50%);text-align:center;pointer-events:none;';
      var _nowMetPop = (Date.now() - LAUNCH_UTC) / 1000;
      var _caMet   = points[caIdx].metSec;
      var _cdSec   = _caMet - _nowMetPop;
      var _caKmPop = points[caIdx].distMoonKm;
      var _fmtDur = function(s) { var h=Math.floor(Math.abs(s)/3600), m=Math.floor((Math.abs(s)%3600)/60); return (h>0?h+'h ':'') + m+'m'; };
      var _timeStr = _cdSec > 0 ? ('T\u2212' + _fmtDur(_cdSec)) : 'flyby complete';
      _pop.innerHTML =
        '<div style="color:#ccc8b8;font-size:0.9rem;margin-bottom:6px;">\ud83c\udf19 LUNAR FLYBY VIEW</div>' +
        '<div style="color:#8899aa;font-size:0.68rem;margin-bottom:8px;">Camera locked to Orion \u00b7 Looking at Moon</div>' +
        '<div style="color:#ffd700;font-size:0.75rem;">Closest approach: ' + Math.round(_caKmPop).toLocaleString() + ' km</div>' +
        '<div style="color:#7986a8;font-size:0.68rem;margin-top:4px;">' + _timeStr + '</div>';
      container.appendChild(_pop);
      setTimeout(function() { if (_pop.parentElement) _pop.remove(); }, 6000);
    }

    var _animFrameId;
    function scheduleNextFrame() {
      _animFrameId = requestAnimationFrame(function() {
        _animFrameId = null;
        animate();
      });
    }
    function animate() {
      if (_animFrameId != null) return;
      _loopStarted = true;
      var now = Date.now();
      if (reduceMotion) {
        if (now - lastReducedRenderMs < 250) {
          scheduleNextFrame();
          return;
        }
        lastReducedRenderMs = now;
      }
      var elapsed = now - LAUNCH_UTC;
      var metSec = elapsed / 1000;
      var pulse = 0.5 + 0.5 * Math.sin(now / 430);

      // ── Update sun direction from JPL data ──
      if (typeof FlybyLighting !== 'undefined' && FlybyLighting.isReady()) {
        var _flybySD = FlybyLighting.getSunDir(metSec);
        if (_flybySD) {
          var _flybySV = new THREE.Vector3(_flybySD.x, _flybySD.y, _flybySD.z).applyMatrix4(rotMat);
          sunLight.position.copy(_flybySV.multiplyScalar(50));
        }
      }

      // ── Get current state from shared ephemeris ──
      var state = MissionEphemeris.getState(metSec);

      // ── Orion position ──
      var orionResult = getPosByMet(metSec);
      orionGroup.position.copy(orionResult.pos);
      var gt = orionResult.frac;

      // ── Moon position ──
      // Pin Moon at its closest-approach position so it visually anchors the
      // figure-8 trajectory loop (which is drawn in a frame whose +x axis is
      // Earth→Moon-at-CA). The live Earth-Moon distance is still shown via
      // state.distMoonKm in the HUD/labels.
      moon.position.copy(initMoonPos);
      moonGlow.position.copy(initMoonPos);

      if (typeof OsculatingOrbit !== 'undefined') OsculatingOrbit.update(metSec);

      // Orient spacecraft: align local +Y with velocity tangent
      var velDir = getOrionVelocityDir(metSec);
      var upRef = new THREE.Vector3(0, 0, 1);
      var quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), velDir);
      orionGroup.quaternion.slerp(quat, 0.1);

      // Exhaust pulse
      if (exhaustOuter) exhaustOuter.material.opacity = 0.3 + 0.3 * Math.sin(now / 430);
      if (exhaustInner) exhaustInner.material.opacity = 0.3 + 0.3 * Math.sin(now / 430);
      var ng = orionGroup.userData.nozzleGlow;
      if (ng) ng.material.opacity = 0.5 + 0.3 * Math.sin(now / 180);

      // Particle exhaust animation (Orion)
      [orionGroup].forEach(function(g) {
        var pd = g ? g.userData.particleData : null;
        if (!pd) return;
        var pt = now / 1000;
        for (var pi = 0; pi < pd.count; pi++) {
          pd.lifetimes[pi] += 0.02; // Slower fade for more visibility
          if (pd.lifetimes[pi] > 1) pd.reset(pi);
          var pv = pd.velocities[pi];
          pd.positions[pi*3]   += pv.x * 1.5; // Flying faster
          pd.positions[pi*3+1] += pv.y * 1.5;
          pd.positions[pi*3+2] += pv.z * 1.5;
          var life = pd.lifetimes[pi];
          // Brighter color profile
          pd.colors[pi*3]   = 1.0; 
          pd.colors[pi*3+1] = Math.max(0, 1.0 - life * 1.8); // G stays longer (more orange)
          pd.colors[pi*3+2] = Math.max(0, 0.8 - life * 3.0); 
        }
        pd.geo.attributes.position.needsUpdate = true;
        pd.geo.attributes.color.needsUpdate = true;
      });

      if (orionGroup.userData.hullMat) orionGroup.userData.hullMat.emissiveIntensity = 0.7 + pulse * 0.6;

      // Illumination-driven shadow effect from ObserverHorizons
      var illu = (typeof ObserverHorizons !== 'undefined' && ObserverHorizons.isReady())
        ? ObserverHorizons.getIllumination(metSec) : 100;
      if (illu === null || illu === undefined) illu = 100;
      illu = Math.max(0, Math.min(100, illu));
      var shadowFactor = illu / 100;
      if (orionGroup.userData.hullMat) orionGroup.userData.hullMat.emissive.setHex(0x050810).lerp(new THREE.Color(0x181818), shadowFactor);
      orionLight.intensity = 0.5 * shadowFactor;
      if (glowMat) glowMat.opacity = (0.08 + pulse * 0.15) * (0.3 + 0.7 * shadowFactor);
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

      // ── Trace replay animation removed — neon pulse handled via activeSegMat below ──

      // ── Completed path ──
      var nowMet = metSec;
      var splitIdx = Math.min(Math.floor(gt * N_PTS), N_PTS - 1);
      if (splitIdx > 0) {
        var slice = allPts.slice(0, splitIdx + 2);
        if (splitIdx <= caSceneIdx) {
          // Outbound leg — all cyan; update pre-allocated buffers in-place
          var nSlice = Math.min(slice.length, MAX_PATH);
          for (var ci = 0; ci < nSlice; ci++) {
            completedPosBuf[ci*3]=slice[ci].x; completedPosBuf[ci*3+1]=slice[ci].y; completedPosBuf[ci*3+2]=slice[ci].z;
            completedColBuf[ci*3]=C_GREEN.r;   completedColBuf[ci*3+1]=C_GREEN.g;   completedColBuf[ci*3+2]=C_GREEN.b;
          }
          completedGeo.attributes.position.needsUpdate = true;
          completedGeo.attributes.color.needsUpdate = true;
          completedGeo.setDrawRange(0, nSlice);
          compGlowLines.forEach(function(g) { _fillGeo(g._buf, g.geo, slice); });
          compCoreLines.forEach(function(g) { _fillGeo(g._buf, g.geo, slice); });
          compBloomLines.forEach(function(g) { _fillGeo(g._buf, g.geo, slice); });
          _clearGeo(returnGeo);
          returnGlowLines.forEach(function(g) { _clearGeo(g.geo); });
          returnCoreLines.forEach(function(g) { _clearGeo(g.geo); });
          returnBloomLines.forEach(function(g) { _clearGeo(g.geo); });
          upMat.color.setHex(0x00ffcc);
          upGlowLines.forEach(function(l) { l.material.color.setHex(0x00ffcc); });
        } else {
          // Past closest approach — outbound cyan, return amber
          var outSlice = allPts.slice(0, caSceneIdx + 1);
          var retSlice = allPts.slice(caSceneIdx, splitIdx + 2);
          var nOut = Math.min(outSlice.length, MAX_PATH);
          for (var ci = 0; ci < nOut; ci++) {
            completedPosBuf[ci*3]=outSlice[ci].x; completedPosBuf[ci*3+1]=outSlice[ci].y; completedPosBuf[ci*3+2]=outSlice[ci].z;
            completedColBuf[ci*3]=C_GREEN.r;       completedColBuf[ci*3+1]=C_GREEN.g;       completedColBuf[ci*3+2]=C_GREEN.b;
          }
          completedGeo.attributes.position.needsUpdate = true;
          completedGeo.attributes.color.needsUpdate = true;
          completedGeo.setDrawRange(0, nOut);
          compGlowLines.forEach(function(g) { _fillGeo(g._buf, g.geo, outSlice); });
          compCoreLines.forEach(function(g) { _fillGeo(g._buf, g.geo, outSlice); });
          compBloomLines.forEach(function(g) { _fillGeo(g._buf, g.geo, outSlice); });
          _fillGeo(returnPosBuf, returnGeo, retSlice);
          returnGlowLines.forEach(function(g) { _fillGeo(g._buf, g.geo, retSlice); });
          returnCoreLines.forEach(function(g) { _fillGeo(g._buf, g.geo, retSlice); });
          returnBloomLines.forEach(function(g) { _fillGeo(g._buf, g.geo, retSlice); });
          upMat.color.setHex(0xff8844);
          upGlowLines.forEach(function(l) { l.material.color.setHex(0xff8844); });
        }
        var activeSeg = allPts.slice(Math.max(0, splitIdx - 12), Math.min(N_PTS, splitIdx + 5));
        _fillGeo(activePosBuf, activeSegGeo, activeSeg);
        activeSegMat.opacity = 0.7 + 0.3 * pulse;
        activeGlowLines.forEach(function(g) { _fillGeo(g._buf, g.geo, activeSeg); });
        var fStart = Math.max(0, splitIdx - FLAME_LEN);
        var flamePts = allPts.slice(fStart, splitIdx + 1);
        if (flamePts.length > 1) {
          var nFlame = Math.min(flamePts.length, MAX_FLAME);
          for (var fi = 0; fi < nFlame; fi++) {
            var fff = fi / (nFlame - 1);
            flamePosBuf[fi*3]=flamePts[fi].x; flamePosBuf[fi*3+1]=flamePts[fi].y; flamePosBuf[fi*3+2]=flamePts[fi].z;
            flameColBuf[fi*3]=Math.pow(fff,0.4); flameColBuf[fi*3+1]=Math.pow(fff,0.8)*0.95; flameColBuf[fi*3+2]=Math.pow(fff,1.2)*0.90;
          }
          flameGeo.attributes.position.needsUpdate = true;
          flameGeo.attributes.color.needsUpdate = true;
          flameGeo.setDrawRange(0, nFlame);
          _fillGeo(flameGlowPosBuf, flameGlowGeo, flamePts);
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
        wpMats[i].color.setHex(ws === 'done' ? 0x00e676 : ws === 'active' ? 0xffd700 : 0x00ccff);
        wpMeshes[i].scale.setScalar(ws === 'active' ? 1.0 + pulse * 0.2 : 1.0);
      });

      var _egmst = earthGMST(new Date(LAUNCH_UTC + nowMet * 1000)) + Math.PI; // +PI: texture/hemisphere offset
      var _qEarthSpin = new THREE.Quaternion().setFromAxisAngle(zAxis, _egmst);
      earth.quaternion.multiplyQuaternions(_qEarthSpin, earthBaseQuat);
      cloudMesh.rotation.y += 0.00012; // slow relative cloud drift
      // Real sub-solar orientation from JPL data; fall back to slow spin when not ready
      if (typeof FlybyLighting !== 'undefined' && FlybyLighting.isReady()) {
        var _mOri = FlybyLighting.getMoonOrientation(metSec);
        var _mSD  = FlybyLighting.getSunDir(metSec);
        if (_mOri && _mSD) {
          var _msv = new THREE.Vector3(_mSD.x, _mSD.y, _mSD.z).applyMatrix4(rotMat).normalize();
          moon.rotation.y = Math.atan2(_msv.x, _msv.z) - _mOri.sunLon * Math.PI / 180;
        }
      } else {
        moon.rotation.y += 0.0003;
      }

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
        else if (activePreset === 'iss') { var ip=PRESETS.iss.pos(),il=issGroup.position.clone(); if(lerpT<1){lerpT=Math.min(1,lerpT+(1/60)/lerpDuration);var e4=smoothEase(lerpT);camera.position.lerpVectors(lerpFrom.pos,ip,e4);camLookAt.lerpVectors(lerpFrom.look,il,e4);} else{camera.position.lerp(ip,0.05);camLookAt.lerp(il,0.05);} camera.lookAt(camLookAt); }
        else if (activePreset === 'moonview') { var mvp=PRESETS.moonview.pos(),mvl=moon.position.clone(); if(lerpT<1){lerpT=Math.min(1,lerpT+(1/60)/lerpDuration);var e6=smoothEase(lerpT);camera.position.lerpVectors(lerpFrom.pos,mvp,e6);camLookAt.lerpVectors(lerpFrom.look,mvl,e6);} else{camera.position.lerp(mvp,0.05);camLookAt.lerp(mvl,0.05);} camera.lookAt(camLookAt); }
      } else {
        if (!isDrag && !isPan && (Math.abs(velTheta) > 0.0001 || Math.abs(velPhi) > 0.0001)) { sph.theta += velTheta; sph.phi = Math.max(0.1, Math.min(Math.PI-0.1, sph.phi + velPhi)); velTheta *= damping; velPhi *= damping; applyCam(); }
        if (autoRotate) { sph.theta += 0.0008; applyCam(); }
      }

      // ── Animate ISS (TLE propagation) ──
      var issDtSec = (now - ISS_EPOCH_MS) / 1000;
      var issRaan  = ISS_RAAN0 + ISS_RAAN_DOT * issDtSec;
      var issM     = ((ISS_M0 + ISS_N_RAD * issDtSec) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      var issU     = ISS_ARGP + issM; // argument of latitude (e≈0.0007, ν≈M)
      var issDir   = issECIDir(issU, issRaan).applyMatrix4(rotMat).normalize();
      issGroup.position.copy(issDir.clone().multiplyScalar(ISS_SCENE_R));
      var issVelAnim = issECIVel(issU, issRaan).applyMatrix4(rotMat).normalize();
      var issQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), issVelAnim);
      issGroup.quaternion.copy(issQuat);

      renderer.render(scene, camera);

      // ── 2D Holographic callouts ──
      lctx.clearRect(0, 0, W, H);
      var ds = window.dashboardState || {};
      var _tuEarth = document.getElementById('tu-earth');
      var isImp = _tuEarth ? _tuEarth.textContent.trim() === 'MI' : false;
      var KM_TO_MI = 0.621371;

      var moonDistStr = isImp ? Math.round(state.distMoonKm * KM_TO_MI).toLocaleString() + ' mi' : Math.round(state.distMoonKm).toLocaleString() + ' km';
      var earthDistStr = isImp ? Math.round(state.distEarthKm * KM_TO_MI).toLocaleString() + ' mi' : Math.round(state.distEarthKm).toLocaleString() + ' km';
      var orionSpeedStr = isImp ? Math.round(state.speedKms * 3600 * 0.621371).toLocaleString() + ' MPH' : Math.round(state.speedKms * 3600).toLocaleString() + ' KM/H';

      var _orionLabelY = orionGroup.position.y - Math.max(1.5, Math.min(4.0, 80 / Math.max(1, camera.position.distanceTo(orionGroup.position))));
      drawCallout('INTEGRITY \u00b7 ' + orionSpeedStr + ' \u00b7 ' + earthDistStr + ' to Earth \u00b7 ' + moonDistStr + ' to Moon', new THREE.Vector3(orionGroup.position.x, _orionLabelY, orionGroup.position.z), '#00ffaa', 0, -30, true, orionGroup.position);

      drawCallout('ISS', new THREE.Vector3(issGroup.position.x, issGroup.position.y + 0.35, issGroup.position.z), '#00ccff', 0, -10, false, issGroup.position);

      // ── USS Murtha callout ──
      (function() {
        var _mwp = shipMarker.getWorldPosition(new THREE.Vector3());
        var _mwpLbl = _mwp.clone();
        _mwpLbl.y += 0.08;
        drawCallout('\u2693 MURTHA', _mwpLbl, '#ffc200', 0, -10, false, _mwp);
      }());

      // ── Splashdown target callout (only while ship is not there yet) ──
      (function() {
        if (Date.now() < SPLASHDOWN_MS) {
          var _swp = splashGroup.getWorldPosition(new THREE.Vector3());
          var _swpLbl = _swp.clone(); _swpLbl.y += 0.06;
          drawCallout('SPLASHDOWN', _swpLbl, '#ffd700', 0, -10, false, _swp);
        }
      }());

      // ── Scale debug overlay (toggle with S key) ──
      if (scaleDebugVisible) {
        lctx.save();
        lctx.fillStyle = 'rgba(2,8,18,0.90)';
        lctx.fillRect(10, 10, 285, 82);
        lctx.strokeStyle = '#4A90D9';
        lctx.lineWidth = 1;
        lctx.strokeRect(10, 10, 285, 82);
        lctx.font = 'bold 9px "Share Tech Mono",monospace';
        lctx.fillStyle = '#00ccff';
        lctx.textAlign = 'left';
        lctx.fillText('SCALE DEBUG  [press S to hide]', 20, 27);
        lctx.font = '9px "Share Tech Mono",monospace';
        lctx.fillStyle = '#ccdde8';
        lctx.fillText('Earth radius   : ' + SCENE_EARTH_R.toFixed(4) + ' scene units', 20, 42);
        lctx.fillText('ISS orbit r    : ' + ISS_SCENE_R.toFixed(4) + ' scene units', 20, 55);
        lctx.fillText('Ratio ISS/Earth: ' + (ISS_SCENE_R / SCENE_EARTH_R).toFixed(4) + '  (correct = 1.0640)', 20, 68);
        lctx.fillText('1 scene unit   = ' + KM_PER_UNIT.toFixed(0) + ' km', 20, 81);
        lctx.restore();
      }

      // ── Update Murtha info panel once per second ──
      if (now - _murthaLastUpdate > 1000) {
        _murthaLastUpdate = now;
        updateMurthaPanel();
      }

      // Pulsing splashdown rings
      (function() {
        var _pulse2 = 0.5 + 0.5 * Math.sin(now / 600);
        splashGroup.children.forEach(function(c) {
          if (c.material) c.material.opacity = 0.5 + 0.4 * _pulse2;
        });
      }());

      drawCallout('EARTH', new THREE.Vector3(earth.position.x, earth.position.y - 1.4, earth.position.z), 'rgba(100,170,255,0.85)', 0, 0, false, earth.position);
      drawCallout('MOON', new THREE.Vector3(moon.position.x, moon.position.y - 1.0, moon.position.z), 'rgba(200,195,180,0.85)', 0, 0, false, moon.position);

      // ── Flyby proximity HUD ──────────────────────────────────────────────────
      (function() {
        var _caMetSec = points[caIdx].metSec;
        var _caCountdown = _caMetSec - nowMet;
        if (Math.abs(_caCountdown) < 6 * 3600) {
          var _caKm = points[caIdx].distMoonKm;
          var _fmtSec = function(s) { var h=Math.floor(s/3600), m=Math.floor((s%3600)/60), ss=Math.floor(s%60); return (h>0?h+'h ':'') + String(m).padStart(2,'0') + 'm ' + String(ss).padStart(2,'0') + 's'; };
          var _line1 = _caCountdown > 0 ? ('CA T\u2212' + _fmtSec(_caCountdown)) : 'FLYBY COMPLETE';
          var _caDistDisp = isImp ? Math.round(_caKm * KM_TO_MI).toLocaleString() + ' mi' : Math.round(_caKm).toLocaleString() + ' km';
          var _line2 = 'MIN DIST: ' + _caDistDisp;
          lctx.save();
          lctx.font = 'bold 11px "Share Tech Mono",monospace';
          var _bw = Math.max(lctx.measureText(_line1).width, lctx.measureText(_line2).width) + 24;
          var _bx = W / 2 - _bw / 2, _by = 10;
          lctx.fillStyle = 'rgba(0,8,20,0.88)';
          lctx.fillRect(_bx, _by, _bw, 44);
          lctx.strokeStyle = _caCountdown > 0 ? '#ffd700' : '#00e676';
          lctx.lineWidth = 1;
          lctx.strokeRect(_bx, _by, _bw, 44);
          lctx.fillStyle = _caCountdown > 0 ? '#ffd700' : '#00e676';
          lctx.textAlign = 'center';
          lctx.fillText(_line1, W / 2, _by + 16);
          lctx.font = '10px "Share Tech Mono",monospace';
          lctx.fillStyle = 'rgba(200,195,180,0.85)';
          lctx.fillText(_line2, W / 2, _by + 32);
          lctx.restore();
        }
      }());

      // ── Moonview HUD ──────────────────────────────────────────────────────
      if (activePreset === 'moonview' && typeof ObserverHorizons !== 'undefined' && ObserverHorizons.isReady()) {
        var _mvObs = ObserverHorizons.getAll(metSec);
        if (_mvObs) {
          var _mvPerilune = ObserverHorizons.getSecsToPerilune(metSec);
          var _mvDistKm   = Math.round(_mvObs.moonDist_km).toLocaleString();
          var _mvSpeedKms = Math.abs(_mvObs.moonDot_km_s).toFixed(2);
          var _mvIllu     = _mvObs.illu_pct.toFixed(1);

          var _mvCountStr;
          if (_mvPerilune > 0) {
            var _mvCh = Math.floor(_mvPerilune / 3600);
            var _mvCm = Math.floor((_mvPerilune % 3600) / 60);
            var _mvCs = Math.floor(_mvPerilune % 60);
            _mvCountStr = 'PERILUNE IN ' + String(_mvCh).padStart(2,'0') + ':'
                        + String(_mvCm).padStart(2,'0') + ':' + String(_mvCs).padStart(2,'0');
          } else {
            var _mvAgo = Math.abs(_mvPerilune);
            var _mvAh  = Math.floor(_mvAgo / 3600);
            var _mvAm  = Math.floor((_mvAgo % 3600) / 60);
            _mvCountStr = 'PERILUNE +' + _mvAh + 'h ' + _mvAm + 'm ago';
          }

          lctx.save();
          lctx.fillStyle   = 'rgba(4,8,20,0.82)';
          lctx.strokeStyle = 'rgba(0,255,204,0.4)';
          lctx.lineWidth   = 1;
          try {
            lctx.beginPath();
            lctx.roundRect(12, 12, 220, 110, 4);
            lctx.fill(); lctx.stroke();
          } catch(e) {
            lctx.fillRect(12, 12, 220, 110);
            lctx.strokeRect(12, 12, 220, 110);
          }

          lctx.font      = 'bold 9px "Share Tech Mono",monospace';
          lctx.fillStyle = '#00ffcc';
          lctx.textAlign = 'left';
          lctx.fillText('LUNAR FLYBY', 22, 30);

          lctx.font      = '8px "Share Tech Mono",monospace';
          lctx.fillStyle = 'rgba(200,220,255,0.9)';
          lctx.fillText('ALT:   ' + _mvDistKm + ' km', 22, 48);
          lctx.fillText('SPEED: ' + _mvSpeedKms + ' km/s', 22, 62);
          lctx.fillText('ILLU:  ' + _mvIllu + '%', 22, 76);

          lctx.fillStyle = 'rgba(180,220,180,0.6)';
          lctx.fillText('CLOSEST: 8,281 km', 22, 90);

          lctx.font      = 'bold 8px "Share Tech Mono",monospace';
          lctx.fillStyle = Math.abs(_mvPerilune) < 3600 ? '#ffd700' : 'rgba(0,255,204,0.7)';
          lctx.fillText(_mvCountStr, 22, 108);
          lctx.restore();
        }
      }

      var emMid = new THREE.Vector3().addVectors(earth.position, moon.position).multiplyScalar(0.5); emMid.y += 0.7;
      var emKm = Math.sqrt(state.moon.x*state.moon.x + state.moon.y*state.moon.y + state.moon.z*state.moon.z);
      var emDistStr = isImp ? Math.round(emKm * KM_TO_MI).toLocaleString() + ' MI' : Math.round(emKm).toLocaleString() + ' KM';
      drawCallout('EARTH\u2013MOON: ' + emDistStr, emMid, 'rgba(255,255,255,0.35)', 0, 0, false, null);

      var earthDistStr = isImp ? Math.round(state.distEarthKm * KM_TO_MI).toLocaleString() + ' mi' : Math.round(state.distEarthKm).toLocaleString() + ' km';
      var altPt = new THREE.Vector3().lerpVectors(orionGroup.position, earth.position, 0.4); altPt.y += 0.35;
      drawCallout('ALT: ' + earthDistStr, altPt, 'rgba(0,204,255,0.7)', 0, 0, false, null);

      // Waypoint labels
      wpClickAreas = [];
      wpVisible.forEach(function(wp, i) {
        var ws = wpGetState(wp, nowMet);
        var s = proj(wpMeshes[i].position); if (!s.vis) return;
        var color = ws === 'done' ? '#00e676' : ws === 'active' ? '#ffd700' : 'rgba(100,130,170,0.55)';
        var bold = ws === 'active';
        var isHovered = (i === hoveredWpIdx);
        lctx.save();
        lctx.font = (bold ? 'bold ' : '') + '9px "Share Tech Mono",monospace';
        var m = lctx.measureText(wp.label);
        var bw = m.width + 10, bh = 14;
        var lx = s.x + 18, ly = s.y - 18;
        if (lx + bw > W - 4) lx = s.x - bw - 12;
        if (isHovered) {
          lctx.fillStyle = 'rgba(0,20,40,0.9)';
          lctx.fillRect(lx - 4, ly - bh/2, bw, bh);
          lctx.strokeStyle = '#00ffcc'; lctx.lineWidth = 1.5; lctx.globalAlpha = 1.0;
          lctx.strokeRect(lx - 4, ly - bh/2, bw, bh);
        } else {
          lctx.fillStyle = 'rgba(0,8,18,0.72)';
          lctx.fillRect(lx - 4, ly - bh/2, bw, bh);
          lctx.strokeStyle = color; lctx.lineWidth = 0.5; lctx.globalAlpha = bold ? 0.85 : 0.5;
          lctx.strokeRect(lx - 4, ly - bh/2, bw, bh);
        }
        lctx.globalAlpha = 1.0;
        lctx.fillStyle = color; lctx.textAlign = 'left'; lctx.textBaseline = 'middle';
        if (bold) { lctx.shadowColor = color; lctx.shadowBlur = 10; }
        lctx.fillText(wp.label, lx, ly);
        lctx.beginPath(); lctx.moveTo(s.x, s.y); lctx.lineTo(lx - 4, ly);
        lctx.strokeStyle = color; lctx.lineWidth = 0.5; lctx.globalAlpha = 0.4;
        lctx.setLineDash([2,3]); lctx.stroke(); lctx.setLineDash([]);
        lctx.restore();
        wpClickAreas.push({x: lx - 14, y: ly - bh/2 - 8, w: bw + 20, h: bh + 16, wp: wp, idx: i});

        if (typeof mtItems !== 'undefined' && mtItems[i]) {
          var elC = ws === 'done' ? '#00e676' : ws === 'active' ? '#ffd700' : 'rgba(121, 134, 168, 0.8)';
          var elB = ws === 'done' ? '#00e676' : ws === 'active' ? '#ffd700' : 'transparent';
          if (mtItems[i].el.style.backgroundColor === '' || mtItems[i].el.style.backgroundColor === 'transparent') {
            mtItems[i].el.style.color = elC;
            mtItems[i].el.style.borderLeftColor = elB;
          }
        }
      });

      // Osculating orbit 2D label (drawn after clearRect, reuses same lctx)
      if (typeof OsculatingOrbit !== 'undefined') OsculatingOrbit.update(metSec);

      if (progressEl) { var fd = Math.max(1, Math.floor(elapsed / (24*3600*1000)) + 1); progressEl.textContent = 'MISSION PROGRESS: ' + (gt*100).toFixed(1) + '%  \u00b7  FLIGHT DAY ' + fd; }

      // Update countdown
      var nextWp = null;
      for (var wi = 0; wi < wpVisible.length; wi++) {
        if (wpVisible[wi].metSec > nowMet) { nextWp = wpVisible[wi]; break; }
      }
      var mtNt = document.getElementById('mt-next-time');
      if (mtNt) {
        if (nextWp) {
           var rem = nextWp.metSec - nowMet;
           var h = Math.floor(rem / 3600);
           var m = Math.floor((rem % 3600) / 60);
           var s = Math.floor(rem % 60);
           mtNt.textContent = '-' + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
        } else {
           mtNt.textContent = 'COMPLETE';
        }
      }

      scheduleNextFrame();
    }
    // [DIAG] Temporary diagnostic — remove after inspection
    var _diagMoonCA = toScene(caPt.moon.x, caPt.moon.y, caPt.moon.z);
    var _diagOrionCA = toScene(caPt.orion.x, caPt.orion.y, caPt.orion.z);
    var _diagTrajMid = allPts[Math.floor(allPts.length / 2)];
    console.log('[DIAG] Moon at CA (scene):', _diagMoonCA.x.toFixed(2), _diagMoonCA.y.toFixed(2), _diagMoonCA.z.toFixed(2));
    console.log('[DIAG] Orion at CA (scene):', _diagOrionCA.x.toFixed(2), _diagOrionCA.y.toFixed(2), _diagOrionCA.z.toFixed(2));
    console.log('[DIAG] Traj midpoint (scene):', _diagTrajMid.x.toFixed(2), _diagTrajMid.y.toFixed(2), _diagTrajMid.z.toFixed(2));
    console.log('[DIAG] Moon-Orion dist at CA:', _diagMoonCA.distanceTo(_diagOrionCA).toFixed(2), 'scene units');
    console.log('[DIAG] initMoonPos:', initMoonPos.x.toFixed(2), initMoonPos.y.toFixed(2), initMoonPos.z.toFixed(2));

    animate();

    // ── Mini Timeline ──
    var miniTimeline = document.createElement('div');
    miniTimeline.id = 'mini-timeline';
    document.head.insertAdjacentHTML('beforeend', '<style>@media (max-width: 768px) { #mini-timeline { display: none !important; } #mt-toggle { display: none !important; } } #mini-timeline::-webkit-scrollbar { width: 4px; } #mini-timeline::-webkit-scrollbar-thumb { background: rgba(168,224,0,0.25); border-radius: 2px; } #mini-timeline::-webkit-scrollbar-track { background: transparent; }</style>');
    Object.assign(miniTimeline.style, {
      position: 'absolute',
      right: '10px',
      top: '10px',
      maxHeight: 'calc(100% - 48px)',
      width: '150px',
      background: 'rgba(4, 8, 18, 0.82)',
      border: '1px solid rgba(168, 224, 0, 0.22)',
      borderRadius: '4px',
      zIndex: '4',
      overflowY: 'auto',
      pointerEvents: 'auto',
      display: 'flex',
      flexDirection: 'column',
      padding: '4px 0',
      fontFamily: "'Space Mono', monospace",
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      transition: 'transform 0.3s ease, opacity 0.3s ease'
    });

    var mtToggle = document.createElement('button');
    mtToggle.id = 'mt-toggle';
    mtToggle.innerHTML = '&#9656;';
    Object.assign(mtToggle.style, {
      position: 'absolute',
      top: '10px',
      right: '150px',
      zIndex: '5',
      width: '20px',
      height: '28px',
      background: 'rgba(4, 8, 18, 0.82)',
      border: '1px solid rgba(168, 224, 0, 0.3)',
      borderRadius: '3px 0 0 3px',
      color: 'rgba(168, 224, 0, 0.7)',
      fontSize: '11px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      fontFamily: "'Share Tech Mono', monospace",
      transition: 'transform 0.3s ease, right 0.3s ease'
    });
    var mtVisible = true;
    mtToggle.addEventListener('click', function() {
      mtVisible = !mtVisible;
      miniTimeline.style.transform = mtVisible ? 'none' : 'translateX(calc(100% + 10px))';
      miniTimeline.style.opacity = mtVisible ? '1' : '0';
      miniTimeline.style.pointerEvents = mtVisible ? 'auto' : 'none';
      mtToggle.style.right = mtVisible ? '150px' : '0px';
      mtToggle.innerHTML = mtVisible ? '&#9656;' : '&#9666;';
    });
    
    var mtHeader = document.createElement('div');
    Object.assign(mtHeader.style, {
      padding: '4px 8px',
      borderBottom: '1px solid rgba(168, 224, 0, 0.10)',
      marginBottom: '2px',
      fontSize: '7.5px',
      color: 'rgba(168, 224, 0, 0.50)',
      letterSpacing: '0.14em',
      textAlign: 'left',
      textTransform: 'uppercase'
    });
    var mtNextTitle = document.createElement('div');
    mtNextTitle.textContent = 'NEXT WAYPOINT';
    var mtNextTime = document.createElement('div');
    mtNextTime.id = 'mt-next-time';
    mtNextTime.textContent = '—';
    Object.assign(mtNextTime.style, {
      fontSize: '9.5px',
      color: '#ffd700',
      fontWeight: 'normal',
      marginTop: '2px',
      letterSpacing: '0.06em'
    });
    mtHeader.appendChild(mtNextTitle);
    mtHeader.appendChild(mtNextTime);
    miniTimeline.appendChild(mtHeader);

    var mtItems = [];
    wpVisible.forEach(function(wp, i) {
      var item = document.createElement('div');
      item.textContent = wp.label;
      Object.assign(item.style, {
        padding: '3px 8px',
        fontSize: '9.5px',
        color: 'rgba(168, 212, 255, 0.40)',
        cursor: 'pointer',
        borderLeft: '2px solid transparent',
        transition: 'all 0.15s',
        backgroundColor: 'transparent',
        letterSpacing: '0.04em',
        lineHeight: '1.55'
      });
      item.addEventListener('mouseenter', function() {
        item.style.backgroundColor = 'rgba(168,224,0,0.06)';
        item.style.color = '#a8d4ff';
      });
      item.addEventListener('mouseleave', function() {
        item.style.backgroundColor = 'transparent';
        var ws = wpGetState(wp, (Date.now()-LAUNCH_UTC)/1000);
        item.style.color = ws === 'done' ? '#ccff00' : ws === 'active' ? '#ffd700' : 'rgba(168,212,255,0.40)';
      });
      item.addEventListener('click', function(e) {
        var targetPos = wpScenePos(wp);
        var camDist = 6;
        var camDir = new THREE.Vector3(2, 1.5, 3).normalize();
        var newCamPos = targetPos.clone().add(camDir.multiplyScalar(camDist));
        startLerp(newCamPos, targetPos.clone(), 1.5, 'lerp');
        activePreset = null; updatePresetBtns();
        
        // Show popup more intelligently (maybe slightly off center to avoid occluding target)
        var cRect = container.getBoundingClientRect();
        showWpPopup(wp, cRect.width / 2 + 50, cRect.height / 2 - 50);
      });
      miniTimeline.appendChild(item);
      mtItems.push({el: item, wp: wp});
    });
    container.appendChild(miniTimeline);
    container.appendChild(mtToggle);

    // ── Telemetry HUD ──
    var hudEl = document.getElementById('traj-hud');
    var hudToggle = document.getElementById('hud-toggle');
    var hudVisible = true;
    if (hudToggle) { hudToggle.addEventListener('click', function() { hudVisible = !hudVisible; hudEl.classList.toggle('collapsed', !hudVisible); hudToggle.classList.toggle('collapsed', !hudVisible); hudToggle.innerHTML = hudVisible ? '&#9666;' : '&#9656;'; }); }

    var EARTH_DIAM_KM = 12742, MOON_DIAM_KM = 3474, SPEED_OF_LIGHT_KMS = 299792.458, KM_TO_MI_HUD = 0.621371;

    var DV_BUDGET = [
      { metSec: 0, dv: 3900 }, { metSec: 2940, dv: 3700 }, { metSec: 6477, dv: 3400 },
      { metSec: 90000, dv: 1600 }, { metSec: 173220, dv: 1500 }, { metSec: 534180, dv: 800 },
      { metSec: 781980, dv: 50 }, { metSec: 783960, dv: 0 },
    ];
    var ECC_PHASES = [
      { metSec: 0, ecc: 0.01 }, { metSec: 2940, ecc: 0.35 }, { metSec: 6477, ecc: 0.80 },
      { metSec: 90000, ecc: 0.97 }, { metSec: 370740, ecc: 1.20 }, { metSec: 434079, ecc: 1.80 },
      { metSec: 534180, ecc: 0.97 }, { metSec: 783960, ecc: 0.98 },
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
      try {
        if (!hudEl) return;
        var now = Date.now();
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
        var kpVal = (ds.kpIndex !== null && ds.kpIndex !== undefined) ? ds.kpIndex : (1.3 + Math.sin(now/10000)*0.5); 
        if (kpEl) { kpEl.textContent = kpVal.toFixed(1); kpEl.className = kpVal >= 5 ? 'hud-val crit' : kpVal >= 4 ? 'hud-val warn' : 'hud-val good'; }
        
        var solarEl = document.getElementById('hud-solar');
        var solarVal = (ds.solarWind !== null && ds.solarWind !== undefined) ? ds.solarWind : Math.round(380 + Math.sin(now/15000)*40); 
        if (solarEl) { solarEl.textContent = solarVal + ' km/s'; solarEl.className = solarVal >= 600 ? 'hud-val warn' : 'hud-val'; }

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

        // ── Mobile strip update ──
        var tmsEarth = document.getElementById('tms-earth');
        var tmsSpeed = document.getElementById('tms-speed');
        var tmsPhase = document.getElementById('tms-phase');
        if (tmsEarth) tmsEarth.textContent = earthStr + ' ' + earthUnit.toLowerCase();
        if (tmsSpeed) tmsSpeed.textContent = (isImp ? Math.round(state.speedKms * KM_TO_MI_HUD * 10) / 10 : Math.round(state.speedKms * 10) / 10).toFixed(1) + (isImp ? ' mi/s' : ' km/s');
        if (tmsPhase) { var tmsPN = document.getElementById('current-phase-name'); tmsPhase.textContent = tmsPN ? tmsPN.textContent.trim() : '\u2014'; }
      } catch (err) { console.warn('[HUD Update Error]', err); }
    }

    tickHUD();
    var _hudInterval = setInterval(tickHUD, 2000);

    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        if (!_loopStarted) return;
        if (_animFrameId) cancelAnimationFrame(_animFrameId);
        _animFrameId = null;
        clearInterval(_hudInterval);
      } else {
        animate();
        clearInterval(_hudInterval);
        _hudInterval = setInterval(tickHUD, 2000);
      }
    });
  } // end init()
})();
