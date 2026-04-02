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
  const orionLight = new THREE.PointLight(0xfff5e0, 0.5, 2);
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

  // ── Trajectory curve (physically-accurate Artemis II flight path) ──
  function generateTrajectory() {
    const pts = [];
    const V3 = (x,y,z) => new THREE.Vector3(x,y,z);
    const MOON_X = 8.2;
    const EARTH_R = 0.9; // Earth sphere radius in scene

    // Phase A: 1.5 highly elliptical Earth orbits (1,500 × 46,000 mi)
    // Keplerian ellipse: r = a(1-e²)/(1+e·cos(θ))
    // Orbit tilted ~28° (KSC inclination) for visual depth
    // Apogee oriented toward +X (Moon direction)
    // Start at θ₀=π (apogee) so after 1.5 orbits we arrive at perigee for TLI
    const TILT = 0.49; // ~28° inclination
    const ORBITS = 1.5;
    const ORB_STEPS = 80;
    for (let i = 0; i <= ORB_STEPS; i++) {
      const f = i / ORB_STEPS;
      const theta = Math.PI + f * ORBITS * Math.PI * 2; // start at apogee

      // Orbit-raising: eccentricity and semi-major axis grow over time
      // First orbit: smaller (perigee raise), second orbit: full HEO
      const ecc = 0.55 + f * 0.25;     // 0.55 → 0.80 (highly elliptical)
      const sma = 1.15 + f * 0.45;     // semi-major axis grows with burns

      const r = sma * (1 - ecc * ecc) / (1 + ecc * Math.cos(theta));

      // Apogee at θ=π → cos(π)=-1 → r=a(1+e) → points toward +X
      // Perigee at θ=0 → cos(0)=1 → r=a(1-e) → points toward -X (near Earth)
      const localX = -r * Math.cos(theta); // flip so apogee → +X
      const localY = r * Math.sin(theta);

      // Apply orbital tilt
      const x = localX;
      const y = localY * Math.sin(TILT);
      const z = localY * Math.cos(TILT) * 0.55;
      pts.push(V3(x, y, z));
    }

    // Phase B: TLI departure — tangent from perigee, smooth acceleration moonward
    const lastOrb = pts[pts.length - 1].clone();
    const prevOrb = pts[pts.length - 2].clone();
    const tangent = lastOrb.clone().sub(prevOrb).normalize();
    const moonTarget = V3(MOON_X, 1.6, 0); // aim above Moon for outbound arc
    const moonDir = moonTarget.clone().sub(lastOrb).normalize();
    const TLI_STEPS = 15;
    let tliPos = lastOrb.clone();
    for (let i = 1; i <= TLI_STEPS; i++) {
      const f = i / TLI_STEPS;
      // Smooth cubic ease-in blend from orbital tangent to Moon direction
      const eased = f * f * f;
      const dir = tangent.clone().lerp(moonDir, eased).normalize();
      const step = 0.18 + f * 0.55; // accelerating steps (TLI boost)
      tliPos = tliPos.clone().add(dir.multiplyScalar(step));
      pts.push(tliPos.clone());
    }

    // Phase C: Outbound coast arc — curves ABOVE Earth-Moon line
    // Cubic Bezier for smooth, realistic transfer orbit
    const outStart = pts[pts.length - 1].clone();
    const outP1 = V3(3.2, 2.2, 0.3);   // high above E-M line early
    const outP2 = V3(5.8, 2.0, -0.1);  // still high, curving toward Moon
    const outEnd = V3(7.7, 0.9, -0.1);  // approach Moon from above (figure-8 entry)
    const OUT_STEPS = 30;
    for (let i = 1; i <= OUT_STEPS; i++) {
      const t = i / OUT_STEPS;
      const mt = 1 - t;
      // Cubic Bezier: P = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
      const x = mt*mt*mt*outStart.x + 3*mt*mt*t*outP1.x + 3*mt*t*t*outP2.x + t*t*t*outEnd.x;
      const y = mt*mt*mt*outStart.y + 3*mt*mt*t*outP1.y + 3*mt*t*t*outP2.y + t*t*t*outEnd.y;
      const z = mt*mt*mt*outStart.z + 3*mt*mt*t*outP1.z + 3*mt*t*t*outP2.z + t*t*t*outEnd.z;
      pts.push(V3(x, y, z));
    }

    // Phase D: Lunar flyby — figure-8 free-return trajectory
    // Approach from ABOVE (+Y), swing around far side (X > MOON_X), exit BELOW (-Y)
    // Two cubic Bezier arcs sharing the periapsis:
    //   Inbound:  entry (above Moon) → periapsis (far/dark side, MOON_X+0.6)
    //   Outbound: periapsis → exit (below Moon toward Earth)
    // Periapsis 0.6 scene units behind Moon centre ≈ 4,500 mi above lunar surface
    const FLYBY_STEPS = 20;
    const flyEntry = pts[pts.length - 1].clone();
    const flyPeri  = V3(MOON_X + 0.6,  0,    0);   // closest approach, far/dark side
    const flyExit  = V3(7.5,          -0.9,  0.1); // depart below Moon toward Earth
    // Inbound control points: arc UP and sweep around behind Moon
    const flyIn1 = V3(MOON_X + 0.6,  1.5,  0);
    const flyIn2 = V3(MOON_X + 1.0,  0.5,  0);
    // Outbound control points: mirror — sweep from behind Moon, pull DOWN
    const flyOut1 = V3(MOON_X + 1.0, -0.5,  0);
    const flyOut2 = V3(MOON_X + 0.6, -1.5,  0);
    // Inbound arc: flyEntry → flyPeri
    for (let i = 1; i <= FLYBY_STEPS; i++) {
      const t = i / FLYBY_STEPS, mt = 1 - t;
      pts.push(V3(
        mt*mt*mt*flyEntry.x + 3*mt*mt*t*flyIn1.x + 3*mt*t*t*flyIn2.x + t*t*t*flyPeri.x,
        mt*mt*mt*flyEntry.y + 3*mt*mt*t*flyIn1.y + 3*mt*t*t*flyIn2.y + t*t*t*flyPeri.y,
        mt*mt*mt*flyEntry.z + 3*mt*mt*t*flyIn1.z + 3*mt*t*t*flyIn2.z + t*t*t*flyPeri.z
      ));
    }
    // Outbound arc: flyPeri → flyExit
    for (let i = 1; i <= FLYBY_STEPS; i++) {
      const t = i / FLYBY_STEPS, mt = 1 - t;
      pts.push(V3(
        mt*mt*mt*flyPeri.x + 3*mt*mt*t*flyOut1.x + 3*mt*t*t*flyOut2.x + t*t*t*flyExit.x,
        mt*mt*mt*flyPeri.y + 3*mt*mt*t*flyOut1.y + 3*mt*t*t*flyOut2.y + t*t*t*flyExit.y,
        mt*mt*mt*flyPeri.z + 3*mt*mt*t*flyOut1.z + 3*mt*t*t*flyOut2.z + t*t*t*flyExit.z
      ));
    }

    // Phase E: Return arc — curves BELOW Earth-Moon line (visibly separated from outbound)
    // Cubic Bezier for smooth return trajectory
    const retStart = pts[pts.length - 1].clone();
    const retP1 = V3(5.5, -2.1, 0.15);  // deep below E-M line
    const retP2 = V3(2.8, -1.9, 0.2);   // still below, curving toward Earth
    const retEnd = V3(0.7, -0.45, 0.08); // approach Earth from below
    const RET_STEPS = 30;
    for (let i = 1; i <= RET_STEPS; i++) {
      const t = i / RET_STEPS;
      const mt = 1 - t;
      const x = mt*mt*mt*retStart.x + 3*mt*mt*t*retP1.x + 3*mt*t*t*retP2.x + t*t*t*retEnd.x;
      const y = mt*mt*mt*retStart.y + 3*mt*mt*t*retP1.y + 3*mt*t*t*retP2.y + t*t*t*retEnd.y;
      const z = mt*mt*mt*retStart.z + 3*mt*mt*t*retP1.z + 3*mt*t*t*retP2.z + t*t*t*retEnd.z;
      pts.push(V3(x, y, z));
    }

    // Phase F: Re-entry — skip re-entry trajectory to Earth surface
    const reStart = pts[pts.length - 1].clone();
    const RE_STEPS = 10;
    for (let i = 1; i <= RE_STEPS; i++) {
      const f = i / RE_STEPS;
      const eased = f * f;
      // Curve toward Earth with slight skip bounce at ~60%
      const skip = (f > 0.5 && f < 0.75) ? 0.08 * Math.sin((f - 0.5) / 0.25 * Math.PI) : 0;
      const x = reStart.x * (1 - eased) * 0.95;
      const y = reStart.y * (1 - eased) - f * 0.12 + skip;
      const z = reStart.z * (1 - eased);
      pts.push(V3(x, y, z));
    }

    return pts;
  }

  const controlPts = generateTrajectory();
  const curve = new THREE.CatmullRomCurve3(controlPts, false, 'catmullrom', 0.3);
  const N_PTS = 500;
  const allPts = curve.getPoints(N_PTS);

  // ── Trajectory line: dashed cyan upcoming, white completed, yellow active leading edge ──
  const C_GREEN   = new THREE.Color(0xffffff);  // white for completed
  const C_YELLOW  = new THREE.Color(0xffd700);  // yellow for active leading edge
  // Upcoming path — dashed cyan (main line)
  const upGeo = new THREE.BufferGeometry().setFromPoints(allPts);
  const upMat = new THREE.LineDashedMaterial({ color: 0x00ffcc, transparent: true, opacity: 1.0, linewidth: 2, dashSize: 3, gapSize: 2 });
  const upLine = new THREE.Line(upGeo, upMat);
  upLine.computeLineDistances();
  scene.add(upLine);
  // Upcoming path — glow layer behind main line
  const upGlowGeo = new THREE.BufferGeometry().setFromPoints(allPts);
  const upGlowMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.3, linewidth: 3, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Line(upGlowGeo, upGlowMat));

  // Completed path — solid white
  const completedGeo = new THREE.BufferGeometry();
  const completedMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0 });
  const completedLine = new THREE.Line(completedGeo, completedMat);
  scene.add(completedLine);
  // Completed glow — cyan
  const compGlowGeo = new THREE.BufferGeometry();
  const compGlowMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.3, linewidth: 3, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Line(compGlowGeo, compGlowMat));
  // Active leading-edge segment — short yellow section at current position
  const activeSegGeo = new THREE.BufferGeometry();
  const activeSegMat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.85 });
  scene.add(new THREE.Line(activeSegGeo, activeSegMat));

  // Flame/gradient trail — white-hot at Orion, fades to black (transparent via additive blend)
  const FLAME_LEN = 18;
  const flameGeo = new THREE.BufferGeometry();
  const flameMat = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  scene.add(new THREE.Line(flameGeo, flameMat));
  const flameGlowGeo = new THREE.BufferGeometry();
  const flameGlowMat = new THREE.LineBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Line(flameGlowGeo, flameGlowMat));

  // ── Waypoints ──
  // t values mapped to parametric curve phases (192 control points total):
  //   0.000-0.417 = Earth orbits (81 pts), 0.417-0.495 = TLI departure (15 pts),
  //   0.495-0.651 = outbound coast (30 pts), 0.651-0.786 = lunar flyby (26 pts),
  //   0.786-0.943 = return arc (30 pts), 0.943-1.0 = re-entry (10 pts)
  const WAYPOINTS = [
    // ── DAY 1: LAUNCH & ASCENT ──
    { t:0.000, label:'LAUNCH',            met:'T+00:00:00', metSec:0,      desc:'SLS rocket lifts off from Pad 39B at Kennedy Space Center with 8.8 million pounds of thrust.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    { t:0.010, label:'SRB SEP',           met:'T+00:02:12', metSec:132,    desc:'Solid Rocket Boosters separate after burning 5.5 million pounds of propellant.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    { t:0.020, label:'CORE MECO',         met:'T+00:08:06', metSec:486,    desc:'Core stage main engine cutoff. Core stage separates from ICPS upper stage.', crit:'HIGH', status:'nominal', activeWin:600 },
    { t:0.040, label:'SOLAR ARRAYS',      met:'T+00:18:00', metSec:1080,   desc:'Orion solar arrays deploy, providing electrical power to the spacecraft.', crit:'HIGH', status:'nominal', activeWin:900 },
    { t:0.070, label:'PERIGEE RAISE',     met:'T+00:49:00', metSec:2940,   desc:'ICPS fires to raise perigee altitude, setting up for apogee raise.', crit:'HIGH', status:'nominal', activeWin:900 },
    { t:0.120, label:'APOGEE RAISE',      met:'T+01:30:00', metSec:5400,   desc:'ICPS second burn raises apogee to high elliptical orbit.', crit:'HIGH', status:'nominal', activeWin:900 },
    { t:0.180, label:'ICPS SEP',          met:'T+02:00:00', metSec:7200,   desc:'ICPS upper stage separates. Orion is now free-flying.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    // ── DAY 1-2: EARTH ORBIT ──
    { t:0.220, label:'PROX OPS',          met:'T+02:30:00', metSec:9000,   desc:'Proximity operations demo \u2014 Orion maneuvers near separated ICPS.', crit:'HIGH', status:'nominal', activeWin:7200 },
    // ── DAY 2: TLI ──
    { t:0.430, label:'TLI BURN',          met:'T+25:00:00', metSec:90000,  desc:'European Service Module main engine fires to send Orion on a free-return trajectory to the Moon.', crit:'CRITICAL', status:'nominal', activeWin:3600 },
    // ── DAY 3-4: OUTBOUND COAST ──
    { t:0.540, label:'TCB-1',             met:'T+52:00:00', metSec:187200, desc:'Outbound trajectory correction burn 1 \u2014 fine-tunes course toward the Moon.', crit:'HIGH', status:'nominal', activeWin:900 },
    { t:0.590, label:'O2O LASER',         met:'T+80:00:00', metSec:288000, desc:'Optical to Orion laser comms test \u2014 4K video downlink via laser from deep space.', crit:'HIGH', status:'nominal', activeWin:7200 },
    // ── DAY 5-6: LUNAR FLYBY ──
    { t:0.640, label:'LUNAR SOI',         met:'T+100:00:00',metSec:360000, desc:'Orion enters the Moon\u2019s gravitational sphere of influence.', crit:'HIGH', status:'nominal', activeWin:7200 },
    { t:0.715, label:'CLOSEST APPROACH',  met:'T+128:00:00',metSec:460800, desc:'Orion passes ~6,500 km above the lunar far side. Breaks Apollo 13\u2019s distance record of 400,171 km.', crit:'CRITICAL', status:'nominal', activeWin:3600 },
    { t:0.730, label:'FAR SIDE LOS',      met:'T+128:30:00',metSec:462600, desc:'Orion passes behind the Moon. ~41 minutes of planned communications blackout.', crit:'CRITICAL', status:'nominal', activeWin:3600 },
    { t:0.750, label:'SIGNAL ACQ',        met:'T+129:11:00',metSec:465060, desc:'Signal reacquired after far-side pass. Crew reports status.', crit:'HIGH', status:'nominal', activeWin:1800 },
    // ── DAY 7-9: RETURN ──
    { t:0.850, label:'RETURN TCB',        met:'T+150:00:00',metSec:540000, desc:'Return trajectory correction burn \u2014 targets Pacific Ocean splashdown zone.', crit:'HIGH', status:'nominal', activeWin:900 },
    // ── DAY 10: ENTRY & SPLASHDOWN ──
    { t:0.950, label:'SM SEP',            met:'T+228:00:00',metSec:820800, desc:'Service module separates. Only crew module continues to re-entry.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    { t:0.965, label:'ENTRY',             met:'T+228:30:00',metSec:822600, desc:'Atmospheric entry at 40,000 km/h. Heat shield reaches 2,800\u00b0C during skip re-entry.', crit:'CRITICAL', status:'nominal', activeWin:1800 },
    { t:0.975, label:'PEAK HEATING',      met:'T+228:45:00',metSec:823500, desc:'Peak heating \u2014 heat shield surface reaches 2,800\u00b0C.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    { t:0.988, label:'CHUTES',            met:'T+229:05:00',metSec:824700, desc:'Main parachutes deploy at ~7,600m altitude, slowing Orion to ~30 km/h.', crit:'CRITICAL', status:'nominal', activeWin:600 },
    { t:0.997, label:'SPLASHDOWN',        met:'T+229:10:00',metSec:825000, desc:'Orion splashes down in the Pacific Ocean. Recovery by USS Portland.', crit:'CRITICAL', status:'nominal', activeWin:600 },
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
  const orionMat = new THREE.MeshPhongMaterial({ color: 0xfff8f0, emissive: 0xfff0e0, emissiveIntensity: 1.0, shininess: 60 });
  const orion = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 16), orionMat);
  orion.userData = { label: 'ORION' };
  scene.add(orion);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff5e0, transparent: true, opacity: 0.2, side: THREE.BackSide });
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
    // ETA countdown/ago
    let etaStr = '';
    if (nowMet < wp.metSec - 600) {
      const rem = wp.metSec - nowMet; const hh = Math.floor(rem/3600); const mm = Math.floor((rem%3600)/60);
      etaStr = hh > 0 ? `in ${hh}h ${mm}m` : `in ${mm}m`;
    } else if (nowMet <= wp.metSec + 900) {
      etaStr = 'NOW';
    } else {
      const ago = nowMet - wp.metSec; const hh = Math.floor(ago/3600); const mm = Math.floor((ago%3600)/60);
      etaStr = hh > 0 ? `${hh}h ${mm}m ago` : `${mm}m ago`;
    }
    const critColors = { CRITICAL:'#ef5350', HIGH:'#ffa726', MEDIUM:'#ffd740' };
    const critC = critColors[wp.crit] || '#7986a8';
    popupEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="font-size:0.6rem;font-weight:bold;color:#00ffaa;letter-spacing:0.12em;text-shadow:0 0 8px rgba(0,255,170,0.5)">${wp.label}</span>${wp.crit ? `<span style="font-size:0.36rem;color:${critC};border:1px solid ${critC}44;padding:1px 5px;border-radius:2px;letter-spacing:0.08em;">${wp.crit}</span>` : ''}</div><div style="font-size:0.48rem;color:#7986a8;margin-bottom:3px;">${wp.met}</div><div style="font-size:0.44rem;color:rgba(74,144,217,0.6);margin-bottom:3px;">${localStr}</div><div style="font-size:0.44rem;color:rgba(74,144,217,0.7);margin-bottom:6px;letter-spacing:0.06em;">ETA: ${etaStr}</div><div style="font-size:0.48rem;color:${sColor};margin-bottom:8px;letter-spacing:0.08em;">${status}</div><div style="font-size:0.48rem;color:#c8d0e0;line-height:1.5;">${wp.desc}</div>`;
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
      // Flame gradient trail: white-hot at Orion, fades to black → transparent (additive blend)
      const fStart = Math.max(0, splitIdx - FLAME_LEN);
      const flamePts = allPts.slice(fStart, splitIdx + 1);
      const fLen = flamePts.length;
      if (fLen > 1) {
        const fColors = new Float32Array(fLen * 3);
        for (let i = 0; i < fLen; i++) {
          const f = i / (fLen - 1); // 0 = tail (black), 1 = Orion (white-hot)
          fColors[i*3]   = Math.pow(f, 0.6);          // R — slowest fade (warm)
          fColors[i*3+1] = Math.pow(f, 1.5) * 0.95;   // G — mid fade
          fColors[i*3+2] = Math.pow(f, 3.0) * 0.90;   // B — fastest fade
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
      let emDistStr;
      if (typeof Astronomy !== 'undefined') {
        const mv = Astronomy.GeoVector('Moon', new Date(), true);
        const emKm = Math.sqrt(mv.x*mv.x + mv.y*mv.y + mv.z*mv.z) * 149597870.7;
        const isImp = (document.getElementById('tu-earth')?.textContent || 'MI') === 'MI';
        emDistStr = isImp
          ? Math.round(emKm * 0.621371).toLocaleString() + ' MI'
          : Math.round(emKm).toLocaleString() + ' KM';
      } else {
        emDistStr = (document.getElementById('tu-earth')?.textContent || 'MI') === 'MI' ? '238,855 MI' : '384,400 KM';
      }
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

  // ── Telemetry HUD update logic ──────────────────────────────────────
  const hudEl = document.getElementById('traj-hud');
  const hudToggle = document.getElementById('hud-toggle');
  let hudVisible = true;
  if (hudToggle) {
    hudToggle.addEventListener('click', () => {
      hudVisible = !hudVisible;
      hudEl.classList.toggle('collapsed', !hudVisible);
      hudToggle.classList.toggle('collapsed', !hudVisible);
      hudToggle.innerHTML = hudVisible ? '&#9666;' : '&#9656;';
    });
  }

  // Physical constants
  const EARTH_DIAM_KM = 12742;
  const MOON_DIAM_KM = 3474;
  const SPEED_OF_LIGHT_KMS = 299792.458;
  const KM_TO_MI = 0.621371;

  // Delta-V budget per phase (m/s remaining, from NASA press kit estimates)
  const DV_BUDGET = [
    { metSec: 0,      dv: 3900 },  // total mission budget
    { metSec: 2940,   dv: 3700 },  // after perigee raise
    { metSec: 5400,   dv: 3400 },  // after apogee raise
    { metSec: 90000,  dv: 1600 },  // after TLI
    { metSec: 187200, dv: 1500 },  // after TCB-1
    { metSec: 540000, dv: 800 },   // after return TCB
    { metSec: 820800, dv: 50 },    // after SM sep (RCS only)
    { metSec: 825000, dv: 0 },     // splashdown
  ];

  // Eccentricity lookup by mission phase
  const ECC_PHASES = [
    { metSec: 0,      ecc: 0.01 },   // LEO circular
    { metSec: 2940,   ecc: 0.35 },   // perigee raise
    { metSec: 5400,   ecc: 0.80 },   // HEO
    { metSec: 90000,  ecc: 0.97 },   // TLI hyperbolic departure
    { metSec: 360000, ecc: 1.20 },   // lunar approach (hyperbolic)
    { metSec: 460800, ecc: 1.80 },   // closest approach (hyperbolic flyby)
    { metSec: 540000, ecc: 0.97 },   // return coast
    { metSec: 820800, ecc: 0.98 },   // re-entry
  ];

  function lerpTable(table, key, val) {
    if (val <= table[0][key]) return table[0];
    if (val >= table[table.length-1][key]) return table[table.length-1];
    for (let i = 1; i < table.length; i++) {
      if (val <= table[i][key]) {
        const f = (val - table[i-1][key]) / (table[i][key] - table[i-1][key]);
        const result = {};
        for (const k in table[i]) {
          if (k === key) { result[k] = val; continue; }
          result[k] = table[i-1][k] + (table[i][k] - table[i-1][k]) * f;
        }
        return result;
      }
    }
    return table[table.length-1];
  }

  const _hudFmt = new Intl.NumberFormat('en-US');

  function tickHUD() {
    if (!hudEl) return;
    const ds = window.dashboardState || {};
    const isImp = ds.useImperial !== false;
    const elapsed = Date.now() - LAUNCH_UTC;
    const metSec = elapsed / 1000;
    const metMin = metSec / 60;

    // Read telemetry from DOM (already computed by stats.js)
    const earthStr = document.getElementById('tv-earth')?.textContent?.trim() || '';
    const moonStr = document.getElementById('tv-moon')?.textContent?.trim() || '';
    const speedStr = document.getElementById('tv-speed')?.textContent?.trim() || '';
    const earthUnit = document.getElementById('tu-earth')?.textContent || 'MI';
    const speedUnit = document.getElementById('tu-speed')?.textContent || 'MPH';

    // Parse numeric values (remove commas)
    const earthVal = parseFloat(earthStr.replace(/,/g, '')) || 0;
    const moonVal = parseFloat(moonStr.replace(/,/g, '')) || 0;
    const speedVal = parseFloat(speedStr.replace(/,/g, '')) || 0;

    // Convert to km for calculations
    const earthKm = earthUnit === 'MI' ? earthVal / KM_TO_MI : earthVal;
    const moonKm = earthUnit === 'MI' ? moonVal / KM_TO_MI : moonVal;

    // Altitude & Velocity
    const altEl = document.getElementById('hud-alt');
    const velEl = document.getElementById('hud-vel');
    if (altEl) altEl.textContent = earthStr ? earthStr + ' ' + earthUnit.toLowerCase() : '\u2014';
    if (velEl) velEl.textContent = speedStr ? speedStr + ' ' + speedUnit.toLowerCase() : '\u2014';

    // Eccentricity
    const eccEl = document.getElementById('hud-ecc');
    if (eccEl) {
      const eccData = lerpTable(ECC_PHASES, 'metSec', metSec);
      eccEl.textContent = eccData.ecc.toFixed(3);
    }

    // Position
    const hudEarth = document.getElementById('hud-earth');
    const hudMoon = document.getElementById('hud-moon');
    if (hudEarth) hudEarth.textContent = earthStr ? earthStr + ' ' + earthUnit.toLowerCase() : '\u2014';
    if (hudMoon) hudMoon.textContent = moonStr ? moonStr + ' ' + earthUnit.toLowerCase() : '\u2014';

    // Round-trip light time
    const rtlEl = document.getElementById('hud-rtl');
    if (rtlEl && earthKm > 0) {
      const rtlSec = (earthKm * 2) / SPEED_OF_LIGHT_KMS;
      rtlEl.textContent = rtlSec < 1 ? (rtlSec * 1000).toFixed(0) + ' ms' : rtlSec.toFixed(2) + ' s';
    }

    // Angular sizes from Orion's viewpoint
    const esizeEl = document.getElementById('hud-esize');
    const msizeEl = document.getElementById('hud-msize');
    if (esizeEl && earthKm > 100) {
      const angEarth = 2 * Math.atan2(EARTH_DIAM_KM / 2, earthKm) * (180 / Math.PI);
      esizeEl.textContent = angEarth >= 1 ? angEarth.toFixed(1) + '\u00b0' : (angEarth * 60).toFixed(1) + "'";
    }
    if (msizeEl && moonKm > 100) {
      const angMoon = 2 * Math.atan2(MOON_DIAM_KM / 2, moonKm) * (180 / Math.PI);
      msizeEl.textContent = angMoon >= 1 ? angMoon.toFixed(1) + '\u00b0' : (angMoon * 60).toFixed(1) + "'";
    }

    // DSN station
    const dsnEl = document.getElementById('hud-dsn');
    if (dsnEl) dsnEl.textContent = ds.dsnStation || 'ACQUIRING';

    // LOS countdown (far-side LOS at T+128:30:00 = 462600s, duration ~41 min)
    const losEl = document.getElementById('hud-los');
    if (losEl) {
      const losStart = 462600, losDur = 2460;
      if (metSec < losStart) {
        const rem = losStart - metSec;
        const hh = Math.floor(rem / 3600); const mm = Math.floor((rem % 3600) / 60);
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

    // Environment
    const kpEl = document.getElementById('hud-kp');
    if (kpEl) {
      const kp = ds.kpIndex;
      if (kp !== null && kp !== undefined) {
        kpEl.textContent = kp;
        kpEl.className = kp >= 5 ? 'hud-val crit' : kp >= 4 ? 'hud-val warn' : 'hud-val good';
      }
    }
    const solarEl = document.getElementById('hud-solar');
    if (solarEl) {
      const sw = ds.solarWind;
      if (sw !== null && sw !== undefined) {
        solarEl.textContent = sw + ' km/s';
        solarEl.className = sw >= 600 ? 'hud-val warn' : 'hud-val';
      }
    }

    // Mission
    const phaseEl = document.getElementById('hud-phase');
    if (phaseEl) {
      const phaseName = document.getElementById('current-phase-name')?.textContent?.trim() || '\u2014';
      phaseEl.textContent = phaseName;
    }
    const dayEl = document.getElementById('hud-day');
    if (dayEl) {
      const fd = Math.max(1, Math.floor(elapsed / (24*3600*1000)) + 1);
      dayEl.textContent = fd + ' of 10';
    }
    const nextEl = document.getElementById('hud-next');
    if (nextEl) {
      if (ds.nextEvent) {
        const short = ds.nextEvent.length > 10 ? ds.nextEvent.slice(0, 10) : ds.nextEvent;
        nextEl.textContent = short + (ds.nextEventEta ? ' ' + ds.nextEventEta : '');
        nextEl.title = ds.nextEvent + (ds.nextEventEta ? ' in ' + ds.nextEventEta : '');
      }
    }

    // Delta-V remaining
    const dvEl = document.getElementById('hud-dv');
    if (dvEl) {
      const dvData = lerpTable(DV_BUDGET, 'metSec', metSec);
      dvEl.textContent = Math.round(dvData.dv) + ' m/s';
      dvEl.className = dvData.dv < 100 ? 'hud-val warn' : 'hud-val';
    }
  }

  tickHUD();
  setInterval(tickHUD, 2000);
})();
