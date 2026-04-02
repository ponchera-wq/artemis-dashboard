// trajectory.js — 3D Three.js trajectory visualization
// ── TRAJECTORY 3D — CINEMATIC SCI-FI ─────────────────────────────────
(function() {
  const container = document.getElementById('trajectory-3d');
  if (!container || typeof THREE === 'undefined') return;

  const MISSION_MS = 10 * 24 * 3600 * 1000;
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';

  const scene = new THREE.Scene();
  let W = container.clientWidth || 400;
  let H = container.clientHeight || 300;
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 500);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);
  Object.assign(renderer.domElement.style, { position:'absolute',top:'0',left:'0',width:'100%',height:'100%' });
  container.appendChild(renderer.domElement);

  // 2D overlay canvas for holographic callouts
  const lc = document.createElement('canvas');
  lc.width = W; lc.height = H;
  Object.assign(lc.style, { position:'absolute',top:'0',left:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'1' });
  container.appendChild(lc);
  const lctx = lc.getContext('2d');

  // ── Lighting (6) ──
  scene.add(new THREE.AmbientLight(0x1a2a6a, 0.2));
  const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
  sunLight.position.set(20, 8, 14);
  scene.add(sunLight);
  const fillLight = new THREE.PointLight(0x2244aa, 0.3, 80);
  fillLight.position.set(-10, -5, -8);
  scene.add(fillLight);
  // Green point light on Orion (will move with it)
  const orionLight = new THREE.PointLight(0x00ffaa, 0.5, 2);
  scene.add(orionLight);

  // ── Texture loader helper ──
  function loadTex(urls, cb) {
    let i = 0;
    (function tryNext() { if (i >= urls.length) return; loader.load(urls[i], cb, undefined, () => { i++; tryNext(); }); })();
  }

  // ── Earth (4: atmosphere enhancement) ──
  const earthMat = new THREE.MeshPhongMaterial({ color: 0x1a5fa8, emissive: 0x051828, shininess: 35, specular: 0x3377bb });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 32), earthMat);
  scene.add(earth);
  loadTex([
    'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
  ], tex => { earthMat.map = tex; earthMat.color.set(0xffffff); earthMat.needsUpdate = true; });
  // Atmosphere halo (4)
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.15, side: THREE.BackSide })));
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x4A90D9, transparent: true, opacity: 0.08, side: THREE.BackSide })));

  // LEO orbit ring
  const leoPts = [];
  for (let i = 0; i <= 80; i++) { const a = (i/80)*Math.PI*2; leoPts.push(new THREE.Vector3(1.35*Math.cos(a), 0.22*Math.sin(a), 1.35*Math.sin(a)*0.96)); }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(leoPts), new THREE.LineBasicMaterial({ color: 0x4A90D9, transparent: true, opacity: 0.2 })));

  // ── Moon ──
  const moonMat = new THREE.MeshPhongMaterial({ color: 0xaaa89e, emissive: 0x0a0a09, shininess: 4 });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 32), moonMat);
  moon.position.set(8.2, 0, 0);
  scene.add(moon);
  loadTex(['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg'],
    tex => { moonMat.map = tex; moonMat.color.set(0xdddddd); moonMat.needsUpdate = true; });
  const moonGlow = new THREE.Mesh(new THREE.SphereGeometry(0.56, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xccccbb, transparent: true, opacity: 0.08, side: THREE.BackSide }));
  moonGlow.position.copy(moon.position); scene.add(moonGlow);

  // ── Starfield (2) — 600 stars with varying sizes ──
  const STAR_COUNT = 600;
  const starPos = new Float32Array(STAR_COUNT * 3);
  const starSizes = new Float32Array(STAR_COUNT);
  const starAlphas = new Float32Array(STAR_COUNT); // for twinkle
  for (let i = 0; i < STAR_COUNT; i++) {
    const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1), r = 50 + Math.random()*30;
    starPos[i*3] = r*Math.sin(ph)*Math.cos(th); starPos[i*3+1] = r*Math.sin(ph)*Math.sin(th); starPos[i*3+2] = r*Math.cos(ph);
    starSizes[i] = 0.05 + Math.random() * 0.15;
    starAlphas[i] = Math.random() * Math.PI * 2; // phase offset for twinkle
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xccddee, size: 0.10, sizeAttenuation: true, transparent: true, opacity: 0.6 })));
  // Nebula tint sphere (2)
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(48, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x1a0a3a, transparent: true, opacity: 0.12, side: THREE.BackSide })));

  // ── Earth–Moon reference line (7) ──
  const emBuf = new Float32Array(6);
  const emGeo = new THREE.BufferGeometry();
  emGeo.setAttribute('position', new THREE.BufferAttribute(emBuf, 3));
  const emLine = new THREE.Line(emGeo, new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, dashSize: 0.25, gapSize: 0.18 }));
  scene.add(emLine);

  // ── Trajectory curve (NASA-matched) ──
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0.0,   0.0,   0.0  ),
    new THREE.Vector3(-0.6,   1.0,   0.5  ),
    new THREE.Vector3(-1.1,   0.0,  -0.4  ),
    new THREE.Vector3(-0.5,  -0.9,   0.3  ),
    new THREE.Vector3( 0.1,   0.0,   0.0  ),
    new THREE.Vector3(-0.4,   1.2,   0.6  ),
    new THREE.Vector3(-1.3,   0.1,  -0.5  ),
    new THREE.Vector3(-0.4,  -1.0,   0.4  ),
    new THREE.Vector3( 0.15,  0.0,   0.0  ),
    new THREE.Vector3( 1.5,   0.7,   0.3  ),
    new THREE.Vector3( 3.5,   1.1,   0.3  ),
    new THREE.Vector3( 5.5,   1.0,   0.15 ),
    new THREE.Vector3( 7.2,   0.8,   0.0  ),
    new THREE.Vector3( 8.85,  0.45, -0.25 ),
    new THREE.Vector3( 9.0,  -0.4,  -0.4  ),
    new THREE.Vector3( 8.35, -1.0,  -0.15 ),
    new THREE.Vector3( 6.8,  -1.2,   0.0  ),
    new THREE.Vector3( 5.0,  -1.3,   0.1  ),
    new THREE.Vector3( 3.0,  -1.2,   0.15 ),
    new THREE.Vector3( 1.2,  -0.8,   0.1  ),
    new THREE.Vector3( 0.1,  -0.3,   0.0  ),
    new THREE.Vector3( 0.0,   0.0,   0.0  ),
  ], false, 'catmullrom', 0.4);
  const N_PTS = 500;
  const allPts = curve.getPoints(N_PTS);

  // ── Trajectory line: grey upcoming, green completed, yellow active leading edge ──
  const C_GREY    = new THREE.Color(0x2a3a4a);  // dim grey for upcoming
  const C_GREEN   = new THREE.Color(0x00e676);  // bright green for completed
  const C_YELLOW  = new THREE.Color(0xffd700);  // yellow for active leading edge
  const trajColors = new Float32Array(allPts.length * 3);
  allPts.forEach((_, i) => {
    // All upcoming points start as grey; gets overwritten for completed slice
    trajColors[i*3] = C_GREY.r; trajColors[i*3+1] = C_GREY.g; trajColors[i*3+2] = C_GREY.b;
  });
  // Upcoming path — dim grey
  const upGeo = new THREE.BufferGeometry().setFromPoints(allPts);
  upGeo.setAttribute('color', new THREE.BufferAttribute(trajColors.slice(), 3));
  const upMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22 });
  scene.add(new THREE.Line(upGeo, upMat));

  // Completed path — bright green
  const completedGeo = new THREE.BufferGeometry();
  const completedMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
  const completedLine = new THREE.Line(completedGeo, completedMat);
  scene.add(completedLine);
  // Completed glow
  const compGlowGeo = new THREE.BufferGeometry();
  const compGlowMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Line(compGlowGeo, compGlowMat));
  // Active leading-edge segment — short yellow section at current position
  const activeSegGeo = new THREE.BufferGeometry();
  const activeSegMat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.85 });
  scene.add(new THREE.Line(activeSegGeo, activeSegMat));

  // ── Waypoints ──
  // Waypoints: key HIGH and CRITICAL events from mission schedule
  // t values mapped to 22-point curve (0-8=orbits, 8-12=outbound, 13-15=flyby, 16-21=return)
  // status: 'nominal' | 'anomaly' — set manually to flag known issues
  // activeWin: seconds the event stays "active" after metSec (default 900 = 15 min)
  const WAYPOINTS = [
    // ── DAY 1: LAUNCH & ASCENT (CRITICAL) ──
    { t:0.000, label:'LAUNCH',            met:'T+00:00:00', metSec:0,      desc:'SLS rocket lifts off from Pad 39B at Kennedy Space Center with 8.8 million pounds of thrust.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    { t:0.015, label:'SRB SEP',           met:'T+00:02:12', metSec:132,    desc:'Solid Rocket Boosters separate after burning 5.5 million pounds of propellant.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    { t:0.030, label:'CORE MECO',         met:'T+00:08:06', metSec:486,    desc:'Core stage main engine cutoff. Core stage separates from ICPS upper stage.', crit:'HIGH', status:'nominal', activeWin:600 },
    { t:0.060, label:'SOLAR ARRAYS',      met:'T+00:18:00', metSec:1080,   desc:'Orion solar arrays deploy, providing electrical power to the spacecraft.', crit:'HIGH', status:'nominal', activeWin:900 },
    { t:0.095, label:'PERIGEE RAISE',     met:'T+00:49:00', metSec:2940,   desc:'ICPS fires to raise perigee altitude, setting up for apogee raise.', crit:'HIGH', status:'nominal', activeWin:900 },
    { t:0.140, label:'APOGEE RAISE',      met:'T+01:30:00', metSec:5400,   desc:'ICPS second burn raises apogee to high elliptical orbit.', crit:'HIGH', status:'nominal', activeWin:900 },
    { t:0.190, label:'ICPS SEP',          met:'T+02:00:00', metSec:7200,   desc:'ICPS upper stage separates. Orion is now free-flying.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    // ── DAY 1-2: EARTH ORBIT ──
    { t:0.280, label:'PROX OPS',          met:'T+02:30:00', metSec:9000,   desc:'Proximity operations demo \u2014 Orion maneuvers near separated ICPS.', crit:'HIGH', status:'nominal', activeWin:7200 },
    // ── DAY 2: TLI ──
    { t:0.381, label:'TLI BURN',          met:'T+25:00:00', metSec:90000,  desc:'European Service Module main engine fires to send Orion on a free-return trajectory to the Moon.', crit:'CRITICAL', status:'nominal', activeWin:3600 },
    // ── DAY 3-4: OUTBOUND COAST ──
    { t:0.440, label:'TCB-1',             met:'T+52:00:00', metSec:187200, desc:'Outbound trajectory correction burn 1 \u2014 fine-tunes course toward the Moon.', crit:'HIGH', status:'nominal', activeWin:900 },
    { t:0.476, label:'O2O LASER',         met:'T+80:00:00', metSec:288000, desc:'Optical to Orion laser comms test \u2014 4K video downlink via laser from deep space.', crit:'HIGH', status:'nominal', activeWin:7200 },
    // ── DAY 5-6: LUNAR FLYBY ──
    { t:0.548, label:'LUNAR SOI',         met:'T+100:00:00',metSec:360000, desc:'Orion enters the Moon\u2019s gravitational sphere of influence.', crit:'HIGH', status:'nominal', activeWin:7200 },
    { t:0.619, label:'CLOSEST APPROACH',  met:'T+128:00:00',metSec:460800, desc:'Orion passes ~6,500 km above the lunar far side. Breaks Apollo 13\u2019s distance record of 400,171 km.', crit:'CRITICAL', status:'nominal', activeWin:3600 },
    { t:0.667, label:'FAR SIDE LOS',      met:'T+128:30:00',metSec:462600, desc:'Orion passes behind the Moon. ~41 minutes of planned communications blackout.', crit:'CRITICAL', status:'nominal', activeWin:3600 },
    { t:0.690, label:'SIGNAL ACQ',        met:'T+129:11:00',metSec:465060, desc:'Signal reacquired after far-side pass. Crew reports status.', crit:'HIGH', status:'nominal', activeWin:1800 },
    // ── DAY 7-9: RETURN ──
    { t:0.762, label:'RETURN TCB',        met:'T+150:00:00',metSec:540000, desc:'Return trajectory correction burn \u2014 targets Pacific Ocean splashdown zone.', crit:'HIGH', status:'nominal', activeWin:900 },
    // ── DAY 10: ENTRY & SPLASHDOWN ──
    { t:0.905, label:'SM SEP',            met:'T+228:00:00',metSec:820800, desc:'Service module separates. Only crew module continues to re-entry.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    { t:0.930, label:'ENTRY',             met:'T+228:30:00',metSec:822600, desc:'Atmospheric entry at 40,000 km/h. Heat shield reaches 2,800\u00b0C during skip re-entry.', crit:'CRITICAL', status:'nominal', activeWin:1800 },
    { t:0.960, label:'PEAK HEATING',      met:'T+228:45:00',metSec:823500, desc:'Peak heating \u2014 heat shield surface reaches 2,800\u00b0C.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    { t:0.980, label:'CHUTES',            met:'T+229:05:00',metSec:824700, desc:'Main parachutes deploy at ~7,600m altitude, slowing Orion to ~30 km/h.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    { t:0.999, label:'SPLASHDOWN',        met:'T+229:10:00',metSec:825000, desc:'Orion splashes down in the Pacific Ocean. Recovery by USS Portland.', crit:'CRITICAL', status:'nominal', activeWin:600 },
  ];

  // Returns: 'upcoming' | 'active' | 'done' | 'anomaly' | 'anomaly-done'
  function wpGetState(wp, nowMet) {
    const win = wp.activeWin || 900;
    const isAnomaly = wp.status === 'anomaly';
    if (nowMet > wp.metSec + win)           return isAnomaly ? 'anomaly-done' : 'done';
    if (nowMet >= wp.metSec - 600)          return isAnomaly ? 'anomaly'      : 'active';
    return 'upcoming';
  }
  const wpMeshes = [], wpMats = [];
  WAYPOINTS.forEach(wp => {
    const mat = new THREE.MeshBasicMaterial({ color: 0x334455 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat);
    mesh.position.copy(curve.getPoint(wp.t));
    mesh.userData = wp;
    wpMeshes.push(mesh); wpMats.push(mat);
    scene.add(mesh);
  });

  // ── Orion (enhanced with green point light) ──
  const orionMat = new THREE.MeshPhongMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.0, shininess: 60 });
  const orion = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 16), orionMat);
  orion.userData = { label: 'ORION' };
  scene.add(orion);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.2, side: THREE.BackSide });
  orion.add(new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 16), glowMat));

  // ── Trail particles (5) — 30 fading dots behind Orion ──
  const TRAIL_LEN = 30;
  const trailBuf = new Float32Array(TRAIL_LEN * 3);
  const trailSizeBuf = new Float32Array(TRAIL_LEN);
  for (let i = 0; i < TRAIL_LEN; i++) trailSizeBuf[i] = 0.04 + (1 - i/TRAIL_LEN) * 0.06;
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailBuf, 3));
  scene.add(new THREE.Points(trailGeo, new THREE.PointsMaterial({ color: 0x00ffaa, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.4 })));
  let trailIdx = 0, trailFrame = 0;

  // Speed arrow
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), orion.position, 0.8, 0xff8800, 0.2, 0.1);
  scene.add(arrow);

  // Distance lines
  const edBuf = new Float32Array(6), mdBuf = new Float32Array(6);
  const edGeo = new THREE.BufferGeometry(); edGeo.setAttribute('position', new THREE.BufferAttribute(edBuf, 3));
  const edLine = new THREE.Line(edGeo, new THREE.LineDashedMaterial({ color: 0x00ccff, transparent: true, opacity: 0.3, dashSize: 0.08, gapSize: 0.06 }));
  scene.add(edLine);
  const mdGeo = new THREE.BufferGeometry(); mdGeo.setAttribute('position', new THREE.BufferAttribute(mdBuf, 3));
  const mdLine = new THREE.Line(mdGeo, new THREE.LineDashedMaterial({ color: 0xffdd44, transparent: true, opacity: 0.3, dashSize: 0.08, gapSize: 0.06 }));
  scene.add(mdLine);

  // ── Camera ──
  const camPos = new THREE.Vector3();
  const camLookAt = new THREE.Vector3(4.1, 0, 0);
  const CAM_CENTER = camLookAt;
  const sph = { theta: 0.4, phi: 1.05, r: 18 };
  const SPH_DEFAULT = { theta: 0.4, phi: 1.05, r: 18 };
  let isDrag = false, isPan = false, lastMx = 0, lastMy = 0, autoRotate = true, rotTimer = null;
  let velTheta = 0, velPhi = 0, damping = 0.92;
  let camMode = 'orbit'; // 'orbit' | 'lerp' | 'track'
  let lerpFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let lerpTo = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let lerpT = 1, lerpDuration = 1.0;
  let activePreset = null;

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

  function stopAuto() { autoRotate = false; clearTimeout(rotTimer); rotTimer = setTimeout(() => { autoRotate = true; }, 5000); }
  function exitPreset() {
    if (camMode !== 'orbit') {
      camMode = 'orbit';
      // Recalculate sph from current camera position
      const dx = camera.position.x - camLookAt.x;
      const dy = camera.position.y - camLookAt.y;
      const dz = camera.position.z - camLookAt.z;
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

  // Preset definitions
  const PRESETS = {
    earth: { label:'\ud83c\udf0d', title:'Earth', pos:()=>new THREE.Vector3(0, 1.5, 4), look:()=>new THREE.Vector3(0,0,0) },
    moon: { label:'\ud83c\udf19', title:'Moon', pos:()=>new THREE.Vector3(8.2, 1.2, 3.5), look:()=>new THREE.Vector3(8.2,0,0) },
    orion: { label:'\ud83d\ude80', title:'Orion', pos:()=>{ const p=orion.position.clone(); const t=curve.getTangent(Math.max(0,Math.min(1,(Date.now()-LAUNCH_UTC)/MISSION_MS))).normalize(); const side=new THREE.Vector3().crossVectors(t,new THREE.Vector3(0,1,0)).normalize(); return p.clone().add(side.multiplyScalar(2)).add(new THREE.Vector3(0,1,0)); }, look:()=>orion.position.clone() },
    overview: { label:'\ud83d\udd2d', title:'Overview', pos:()=>sphToPos.call(null), look:()=>new THREE.Vector3(4.1,0,0), isSph:true },
    earthview: { label:'\ud83c\udf0f', title:'Earth View', pos:()=>orion.position.clone().add(new THREE.Vector3(0,0.2,0)), look:()=>new THREE.Vector3(0,0,0) }
  };

  // ── Preset buttons bar ──
  const presetBar = document.createElement('div');
  Object.assign(presetBar.style, { position:'absolute',top:'8px',left:'50%',transform:'translateX(-50%)',display:'flex',gap:'4px',zIndex:'4' });
  const presetBtns = {};
  Object.entries(PRESETS).forEach(([key, p]) => {
    const btn = document.createElement('button');
    btn.textContent = p.label;
    btn.title = p.title;
    Object.assign(btn.style, {
      padding:'3px 8px',background:'rgba(8,12,26,0.85)',border:'1px solid rgba(74,144,217,0.35)',
      borderRadius:'12px',color:'#7986a8',fontSize:'12px',cursor:'pointer',
      fontFamily:"'Share Tech Mono',monospace",transition:'all 0.2s',lineHeight:'1.2'
    });
    btn.addEventListener('mouseenter', () => { if(activePreset!==key){btn.style.borderColor='#4A90D9';btn.style.color='#fff';} });
    btn.addEventListener('mouseleave', () => { if(activePreset!==key){btn.style.borderColor='rgba(74,144,217,0.35)';btn.style.color='#7986a8';} });
    btn.addEventListener('click', () => {
      if (activePreset === key && key !== 'orion' && key !== 'earthview') {
        exitPreset();
        stopAuto();
        return;
      }
      activePreset = key;
      updatePresetBtns();
      velTheta = 0; velPhi = 0;
      if (key === 'overview') {
        Object.assign(sph, {...SPH_DEFAULT});
        camLookAt.set(4.1, 0, 0);
        startLerp(sphToPos(), new THREE.Vector3(4.1,0,0), 1.0, 'lerp');
        return;
      }
      const mode = (key === 'orion' || key === 'earthview') ? 'track' : 'lerp';
      startLerp(p.pos(), p.look(), 1.0, mode);
    });
    presetBtns[key] = btn;
    presetBar.appendChild(btn);
  });
  container.appendChild(presetBar);

  function updatePresetBtns() {
    Object.entries(presetBtns).forEach(([key, btn]) => {
      if (key === activePreset) {
        btn.style.borderColor = '#00e5ff';
        btn.style.color = '#00e5ff';
        btn.style.boxShadow = '0 0 8px rgba(0,229,255,0.4)';
      } else {
        btn.style.borderColor = 'rgba(74,144,217,0.35)';
        btn.style.color = '#7986a8';
        btn.style.boxShadow = 'none';
      }
    });
  }

  // ── Mouse/touch drag with momentum ──
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
  renderer.domElement.addEventListener('mousedown', e => {
    if (e.button === 2) { isPan = true; } else { isDrag = true; }
    exitPreset(); stopAuto(); lastMx = e.clientX; lastMy = e.clientY; velTheta = 0; velPhi = 0;
  });
  window.addEventListener('mouseup', () => { isDrag = false; isPan = false; });
  window.addEventListener('mousemove', e => {
    const dx = e.clientX - lastMx, dy = e.clientY - lastMy;
    if (isPan) {
      const panScale = sph.r * 0.003;
      const right = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
      const up = camera.up.clone();
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
  renderer.domElement.addEventListener('wheel', e => { exitPreset(); sph.r = Math.max(3, Math.min(40, sph.r + e.deltaY * 0.025)); applyCam(); stopAuto(); e.preventDefault(); }, { passive: false });

  // Double-click zoom
  renderer.domElement.addEventListener('dblclick', e => {
    exitPreset(); stopAuto();
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = ((e.clientX-rect.left)/rect.width)*2-1;
    const my = -((e.clientY-rect.top)/rect.height)*2+1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(mx, my), camera);
    const hits = rc.intersectObjects(scene.children, true);
    if (hits.length) {
      const pt = hits[0].point;
      const dir = new THREE.Vector3().subVectors(camera.position, pt).normalize();
      startLerp(pt.clone().add(dir.multiplyScalar(3)), pt.clone(), 0.8, 'lerp');
    } else {
      sph.r = Math.max(3, sph.r * 0.6); applyCam();
    }
  });

  // Touch: one finger rotate, two finger pan
  let lastTx = 0, lastTy = 0, touchCount = 0;
  renderer.domElement.addEventListener('touchstart', e => {
    exitPreset(); stopAuto(); touchCount = e.touches.length;
    lastTx = e.touches[0].clientX; lastTy = e.touches[0].clientY;
    velTheta = 0; velPhi = 0;
  });
  renderer.domElement.addEventListener('touchend', () => { touchCount = 0; rotTimer = setTimeout(() => { autoRotate = true; }, 5000); });
  renderer.domElement.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - lastTx, dy = e.touches[0].clientY - lastTy;
    if (e.touches.length >= 2) {
      const panScale = sph.r * 0.003;
      const right = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
      const up = camera.up.clone();
      camLookAt.add(right.multiplyScalar(-dx * panScale)).add(up.multiplyScalar(dy * panScale));
      applyCam();
    } else {
      velTheta = -(dx) * 0.005;
      velPhi = -(dy) * 0.005;
      sph.theta += velTheta;
      sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi + velPhi));
      applyCam();
    }
    lastTx = e.touches[0].clientX; lastTy = e.touches[0].clientY; e.preventDefault();
  }, { passive: false });

  // ── Zoom controls ──
  const ctrlDiv = document.createElement('div');
  Object.assign(ctrlDiv.style, { position:'absolute',bottom:'8px',right:'8px',display:'flex',flexDirection:'column',gap:'3px',zIndex:'3' });
  [{text:'+',fn:()=>{exitPreset();sph.r=Math.max(3,sph.r*0.8);applyCam();stopAuto();}},{text:'\u2212',fn:()=>{exitPreset();sph.r=Math.min(40,sph.r*1.2);applyCam();stopAuto();}},{text:'\u27f2',fn:()=>{exitPreset();Object.assign(sph,{...SPH_DEFAULT});camLookAt.set(4.1,0,0);applyCam();autoRotate=true;activePreset='overview';updatePresetBtns();}}].forEach(b => {
    const btn = document.createElement('button'); btn.textContent = b.text;
    Object.assign(btn.style, { width:'26px',height:'26px',background:'rgba(8,12,26,0.85)',border:'1px solid rgba(74,144,217,0.45)',borderRadius:'3px',color:'#4A90D9',fontSize:'14px',fontFamily:"'Share Tech Mono',monospace",cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:'1',padding:'0' });
    btn.addEventListener('mouseenter', () => { btn.style.borderColor='#4A90D9'; btn.style.color='#fff'; });
    btn.addEventListener('mouseleave', () => { btn.style.borderColor='rgba(74,144,217,0.45)'; btn.style.color='#4A90D9'; });
    btn.addEventListener('click', b.fn); ctrlDiv.appendChild(btn);
  });
  container.appendChild(ctrlDiv);

  // ── Waypoint popup ──
  const popupEl = document.createElement('div');
  Object.assign(popupEl.style, { position:'absolute',display:'none',background:'rgba(0,10,20,0.88)',border:'1px solid rgba(0,255,170,0.4)',borderRadius:'4px',padding:'10px 14px',zIndex:'5',maxWidth:'280px',minWidth:'200px',fontFamily:"'Share Tech Mono',monospace",pointerEvents:'auto',boxShadow:'0 0 12px rgba(0,255,170,0.25)' });
  container.appendChild(popupEl);
  let popupOpen = false;
  function closePopup() { popupEl.style.display = 'none'; popupOpen = false; }
  function openPopup(wp, sx, sy) {
    const nowMet = (Date.now()-LAUNCH_UTC)/1000;
    const evDate = new Date(LAUNCH_UTC.getTime()+wp.metSec*1000);
    const localStr = fmtLocal(evDate,true)+' '+tzAbbr(evDate);
    let status, sColor;
    if (nowMet > wp.metSec+900) { status='\u2713 COMPLETED'; sColor='#00e676'; }
    else if (nowMet >= wp.metSec-600) { status='\u25b6 IN PROGRESS'; sColor='#ffd740'; }
    else { status='\u25cb UPCOMING'; sColor='#7986a8'; }
    const critColors = { CRITICAL:'#ef5350', HIGH:'#ffa726', MEDIUM:'#ffd740' };
    const critC = critColors[wp.crit] || '#7986a8';
    popupEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-size:0.6rem;font-weight:bold;color:#00ffaa;letter-spacing:0.12em;text-shadow:0 0 8px rgba(0,255,170,0.5)">${wp.label}</span>${wp.crit ? `<span style="font-size:0.36rem;color:${critC};border:1px solid ${critC}44;padding:1px 5px;border-radius:2px;letter-spacing:0.08em;">${wp.crit}</span>` : ''}</div><div style="font-size:0.48rem;color:#7986a8;margin-bottom:3px;">${wp.met}</div><div style="font-size:0.44rem;color:rgba(74,144,217,0.6);margin-bottom:6px;">${localStr}</div><div style="font-size:0.48rem;color:${sColor};margin-bottom:8px;letter-spacing:0.08em;">${status}</div><div style="font-size:0.48rem;color:#c8d0e0;line-height:1.5;">${wp.desc}</div>`;
    let left = sx+14; if (left+280 > W) left = sx-290;
    let top = sy-20; if (top+180 > H) top = H-190; if (top < 4) top = 4;
    popupEl.style.left = left+'px'; popupEl.style.top = top+'px'; popupEl.style.display = 'block'; popupOpen = true;
  }

  // Raycaster
  const raycaster = new THREE.Raycaster();
  const mouse3 = new THREE.Vector2();
  const tooltipEl = document.getElementById('traj-tooltip');
  renderer.domElement.addEventListener('mousemove', e => {
    if (!tooltipEl) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse3.x = ((e.clientX-rect.left)/rect.width)*2-1; mouse3.y = -((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse3, camera);
    const hits = raycaster.intersectObjects([orion,...wpMeshes]);
    if (hits.length) { tooltipEl.textContent = hits[0].object.userData.label||''; tooltipEl.style.left=(e.clientX-rect.left+12)+'px'; tooltipEl.style.top=(e.clientY-rect.top-8)+'px'; tooltipEl.style.opacity='1'; renderer.domElement.style.cursor='pointer'; }
    else { tooltipEl.style.opacity='0'; renderer.domElement.style.cursor='grab'; }
  });
  renderer.domElement.addEventListener('mouseleave', () => { if (tooltipEl) tooltipEl.style.opacity='0'; });
  renderer.domElement.addEventListener('click', e => {
    if (popupOpen) { closePopup(); return; }
    const rect = renderer.domElement.getBoundingClientRect();
    mouse3.x = ((e.clientX-rect.left)/rect.width)*2-1; mouse3.y = -((e.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse3, camera);
    const hits = raycaster.intersectObjects([...wpMeshes]);
    if (hits.length && hits[0].object.userData.desc) openPopup(hits[0].object.userData, e.clientX-rect.left, e.clientY-rect.top);
  });
  document.addEventListener('keydown', e => { if (e.key==='Escape' && popupOpen) closePopup(); });

  new ResizeObserver(() => { W=container.clientWidth||400; H=container.clientHeight||300; renderer.setSize(W,H); lc.width=W; lc.height=H; camera.aspect=W/H; camera.updateProjectionMatrix(); }).observe(container);

  const progressEl = document.getElementById('traj-progress');
  const _pv = new THREE.Vector3();
  function proj(v3) { _pv.copy(v3).project(camera); return { x:(_pv.x*0.5+0.5)*W, y:(_pv.y*-0.5+0.5)*H, vis: _pv.z < 1.0 }; }

  // ── Holographic callout drawing (3) ──
  function drawCallout(text, v3, color, ox, oy, bold, lineToV3) {
    const s = proj(v3); if (!s.vis) return;
    const x = s.x + (ox||0), y = s.y + (oy||0);
    lctx.save();
    // Connecting line from callout to object
    if (lineToV3) {
      const s2 = proj(lineToV3);
      if (s2.vis) {
        lctx.beginPath(); lctx.moveTo(s2.x, s2.y); lctx.lineTo(x, y);
        lctx.strokeStyle = color.replace(')', ',0.3)').replace('rgb','rgba').replace('rgba(','rgba(') || 'rgba(0,255,170,0.3)';
        lctx.setLineDash([3, 3]); lctx.lineWidth = 0.5; lctx.stroke(); lctx.setLineDash([]);
      }
    }
    lctx.font = (bold ? 'bold ' : '') + '10px "Share Tech Mono",monospace';
    lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
    // Background box
    const m = lctx.measureText(text);
    const bw = m.width + 12, bh = 16;
    lctx.fillStyle = 'rgba(0,10,20,0.7)';
    lctx.fillRect(x - bw/2, y - bh/2, bw, bh);
    lctx.strokeStyle = color; lctx.lineWidth = 0.5; lctx.globalAlpha = 0.6;
    lctx.strokeRect(x - bw/2, y - bh/2, bw, bh);
    lctx.globalAlpha = 1.0;
    // Text with glow
    lctx.fillStyle = color;
    if (bold) { lctx.shadowColor = color; lctx.shadowBlur = 8; }
    lctx.fillText(text, x, y);
    lctx.restore();
  }

  function animate() {
    requestAnimationFrame(animate);
    const now = Date.now();
    const elapsed = now - LAUNCH_UTC;
    const gt = Math.max(0, Math.min(1, elapsed / MISSION_MS));
    const pulse = 0.5 + 0.5 * Math.sin(now / 430);

    // ── Orion ──
    orion.position.copy(curve.getPoint(gt));
    orionMat.emissiveIntensity = 0.7 + pulse * 0.6;
    glowMat.opacity = 0.12 + pulse * 0.22;
    orionLight.position.copy(orion.position);

    // Trail (5)
    trailFrame++;
    if (trailFrame % 3 === 0) {
      const ti = (trailIdx % TRAIL_LEN) * 3;
      trailBuf[ti] = orion.position.x; trailBuf[ti+1] = orion.position.y; trailBuf[ti+2] = orion.position.z;
      trailGeo.attributes.position.needsUpdate = true;
      trailIdx++;
    }

    // Speed arrow
    const tgt = curve.getTangent(Math.min(gt+0.0002, 0.9999)).normalize();
    arrow.position.copy(orion.position); arrow.setDirection(tgt);
    const rawSpd = parseFloat((document.getElementById('tv-speed')?.textContent||'').replace(/,/g,''))||7800;
    arrow.setLength(0.35+Math.max(0.2,Math.min(1.0,rawSpd/40000))*0.85, 0.18, 0.09);

    // ── Completed path with gradient colors (1) ──
    const nowMet = elapsed / 1000; // mission elapsed seconds
    const splitIdx = Math.min(Math.floor(gt * N_PTS), N_PTS - 1);
    if (splitIdx > 0) {
      // Completed path: all solid green
      const slice = allPts.slice(0, splitIdx + 2);
      const sliceColors = new Float32Array((splitIdx + 2) * 3);
      for (let i = 0; i < splitIdx + 2; i++) {
        const frac = i / (splitIdx + 1); // fade green brighter toward current pos
        sliceColors[i*3]   = C_GREEN.r;
        sliceColors[i*3+1] = C_GREEN.g;
        sliceColors[i*3+2] = C_GREEN.b;
      }
      completedGeo.setFromPoints(slice);
      completedGeo.setAttribute('color', new THREE.BufferAttribute(sliceColors, 3));
      compGlowGeo.setFromPoints(slice);
      compGlowGeo.setAttribute('color', new THREE.BufferAttribute(sliceColors.slice(), 3));
      // Active leading edge: short yellow segment right at current position
      const aStart = Math.max(0, splitIdx - 12);
      const aEnd   = Math.min(N_PTS, splitIdx + 4);
      activeSegGeo.setFromPoints(allPts.slice(aStart, aEnd + 1));
    }

    // ── Reference lines ──
    emBuf[0]=earth.position.x; emBuf[1]=earth.position.y; emBuf[2]=earth.position.z;
    emBuf[3]=moon.position.x; emBuf[4]=moon.position.y; emBuf[5]=moon.position.z;
    emGeo.attributes.position.needsUpdate=true; emLine.computeLineDistances();
    edBuf[0]=orion.position.x; edBuf[1]=orion.position.y; edBuf[2]=orion.position.z;
    edBuf[3]=earth.position.x; edBuf[4]=earth.position.y; edBuf[5]=earth.position.z;
    edGeo.attributes.position.needsUpdate=true; edLine.computeLineDistances();
    mdBuf[0]=orion.position.x; mdBuf[1]=orion.position.y; mdBuf[2]=orion.position.z;
    mdBuf[3]=moon.position.x; mdBuf[4]=moon.position.y; mdBuf[5]=moon.position.z;
    mdGeo.attributes.position.needsUpdate=true; mdLine.computeLineDistances();

    // Waypoint states — color-coded by status
    WAYPOINTS.forEach((wp, i) => {
      const state = wpGetState(wp, nowMet);
      const hexCol = state === 'done'         ? 0x00e676
                   : state === 'active'       ? 0xffd700
                   : state === 'anomaly'      ? 0xff6600
                   : state === 'anomaly-done' ? 0xff8c00
                   :                           0x2a3a4a;  // upcoming: dim grey
      wpMats[i].color.setHex(hexCol);
      const pulse2 = state === 'active' || state === 'anomaly';
      wpMeshes[i].scale.setScalar(pulse2 ? 1.0 + pulse * 0.55 : 1.0);
    });

    earth.rotation.y += 0.00175; moon.rotation.y += 0.0003;

    // ── Camera lerp / tracking / momentum ──
    if (camMode === 'lerp' && lerpT < 1) {
      lerpT = Math.min(1, lerpT + (1/60) / lerpDuration);
      const e = smoothEase(lerpT);
      camera.position.lerpVectors(lerpFrom.pos, lerpTo.pos, e);
      camLookAt.lerpVectors(lerpFrom.look, lerpTo.look, e);
      camera.lookAt(camLookAt);
      if (lerpT >= 1 && activePreset === 'overview') {
        camMode = 'orbit';
        const dx2 = camera.position.x-camLookAt.x, dy2 = camera.position.y-camLookAt.y, dz2 = camera.position.z-camLookAt.z;
        sph.r = Math.sqrt(dx2*dx2+dy2*dy2+dz2*dz2);
        sph.phi = Math.acos(Math.max(-1,Math.min(1,dy2/sph.r)));
        sph.theta = Math.atan2(dx2, dz2);
      }
    } else if (camMode === 'track') {
      if (activePreset === 'orion') {
        const p = PRESETS.orion.pos();
        const l = orion.position.clone();
        if (lerpT < 1) { lerpT = Math.min(1, lerpT + (1/60)/lerpDuration); const e2 = smoothEase(lerpT); camera.position.lerpVectors(lerpFrom.pos, p, e2); camLookAt.lerpVectors(lerpFrom.look, l, e2); }
        else { camera.position.lerp(p, 0.05); camLookAt.lerp(l, 0.05); }
        camera.lookAt(camLookAt);
      } else if (activePreset === 'earthview') {
        const p = orion.position.clone().add(new THREE.Vector3(0,0.2,0));
        const l = new THREE.Vector3(0,0,0);
        if (lerpT < 1) { lerpT = Math.min(1, lerpT + (1/60)/lerpDuration); const e3 = smoothEase(lerpT); camera.position.lerpVectors(lerpFrom.pos, p, e3); camLookAt.lerpVectors(lerpFrom.look, l, e3); }
        else { camera.position.lerp(p, 0.05); camLookAt.lerp(l, 0.05); }
        camera.lookAt(camLookAt);
      }
    } else {
      // Orbit mode: apply momentum
      if (!isDrag && !isPan && (Math.abs(velTheta) > 0.0001 || Math.abs(velPhi) > 0.0001)) {
        sph.theta += velTheta;
        sph.phi = Math.max(0.1, Math.min(Math.PI-0.1, sph.phi + velPhi));
        velTheta *= damping; velPhi *= damping;
        applyCam();
      }
      if (autoRotate) { sph.theta += 0.0008; applyCam(); }
    }

    renderer.render(scene, camera);

    // ── 2D Holographic callouts (3) ──
    lctx.clearRect(0, 0, W, H);

    // Orion callout (3) — most prominent, shows Moon distance
    const orionEarthDist = orion.position.distanceTo(earth.position);
    const moonDistTxt = document.getElementById('tv-moon')?.textContent?.trim() || '';
    const moonDistUnit = (document.getElementById('tu-moon')?.textContent || 'MI').toLowerCase();
    const orionLabel = moonDistTxt && moonDistTxt !== '\u2014' ? 'ORION \u00b7 ' + moonDistTxt + ' ' + moonDistUnit + ' to Moon' : 'ORION CREW CAPSULE';
    const oLabelY = orionEarthDist < 1.8 ? -1.5 : -0.6;
    drawCallout(orionLabel, new THREE.Vector3(orion.position.x, orion.position.y + oLabelY, orion.position.z), '#00ffaa', 0, -16, true, orion.position);

    // Earth + Moon callouts
    drawCallout('EARTH', new THREE.Vector3(earth.position.x, earth.position.y - 1.4, earth.position.z), 'rgba(100,170,255,0.85)', 0, 0, false, earth.position);
    drawCallout('MOON', new THREE.Vector3(moon.position.x, moon.position.y - 0.8, moon.position.z), 'rgba(200,195,180,0.85)', 0, 0, false, moon.position);

    // Earth-Moon distance (7)
    { const mid = new THREE.Vector3().addVectors(earth.position, moon.position).multiplyScalar(0.5); mid.y += 0.7;
      const emDistStr = (document.getElementById('tu-earth')?.textContent || 'MI') === 'MI' ? '238,855 MI' : '384,400 KM';
      drawCallout('EARTH\u2013MOON: ' + emDistStr, mid, 'rgba(255,255,255,0.35)', 0, 0, false, null); }

    // Altitude callout (7) — from Earth surface toward Orion
    const earthTxt = document.getElementById('tv-earth')?.textContent?.trim();
    const earthUnit = (document.getElementById('tu-earth')?.textContent || 'MI').toLowerCase();
    if (earthTxt && earthTxt !== '\u2014') {
      const pt = new THREE.Vector3().lerpVectors(orion.position, earth.position, 0.4); pt.y += 0.35;
      drawCallout('ALT: ' + earthTxt + ' ' + earthUnit, pt, 'rgba(0,204,255,0.7)', 0, 0, false, null);
    }

    // Waypoint labels
    WAYPOINTS.forEach((wp, i) => {
      const state = wpGetState(wp, nowMet);
      const s = proj(wpMeshes[i].position); if (!s.vis) return;
      const color = state==='done'         ? 'rgba(0,230,118,0.55)'
                  : state==='active'       ? '#ffd700'
                  : state==='anomaly'      ? '#ff6600'
                  : state==='anomaly-done' ? 'rgba(255,140,0,0.45)'
                  :                         'rgba(100,130,160,0.28)';
      const bold = state === 'active' || state === 'anomaly';
      lctx.save();
      lctx.font = (bold ? 'bold ' : '') + '9px "Share Tech Mono",monospace';
      lctx.fillStyle = color;
      lctx.textAlign = 'left'; lctx.textBaseline = 'middle';
      lctx.shadowColor = color; lctx.shadowBlur = bold ? 8 : 4;
      lctx.fillText(wp.label, s.x + 10, s.y - 8);
      lctx.restore();
    });

    if (progressEl) {
      const fd = Math.max(1, Math.floor(elapsed / (24*3600*1000)) + 1);
      progressEl.textContent = 'MISSION PROGRESS: ' + (gt*100).toFixed(1) + '%  \u00b7  FLIGHT DAY ' + fd;
    }
  }
  animate();
})();
