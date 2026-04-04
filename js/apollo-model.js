window.createApolloModel = function(THREE) {
  var group = new THREE.Group();

  // Materials
  var smMat = new THREE.MeshPhongMaterial({ color: 0xefefef, specular: 0x111111, shininess: 10 });
  var cmMat = new THREE.MeshPhongMaterial({ color: 0xd0d4d8, specular: 0xffffff, shininess: 90 });
  var foilMat = new THREE.MeshStandardMaterial({ color: 0xffa500, roughness: 0.3, metalness: 0.8 });
  var darkMat = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 10 });
  var ascentMat = new THREE.MeshPhongMaterial({ color: 0xb0b4b8, specular: 0x555555, shininess: 30 });

  // 1. Service Module (SM)
  var sm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 16), smMat);
  sm.position.y = -0.075;
  group.add(sm);

  // SM Engine Bell
  var smEngine = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 16), darkMat);
  smEngine.position.y = -0.18;
  group.add(smEngine);

  // High-Gain Antenna (rough representation)
  var hgaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06), cmMat);
  hgaBase.position.set(0.05, -0.15, 0);
  hgaBase.rotation.z = Math.PI / 4;
  group.add(hgaBase);

  // 2. Command Module (CM)
  var cm = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 16), cmMat);
  cm.position.y = 0.04;
  group.add(cm);

  // 3. Lunar Module (LM) - Docked nose-to-nose with CM
  var lmGroup = new THREE.Group();
  lmGroup.position.y = 0.08; // Base of LM docked to CM nose

  // LM Ascent Stage (faceted)
  var ascentGeo = new THREE.DodecahedronGeometry(0.035, 0);
  var ascentStage = new THREE.Mesh(ascentGeo, ascentMat);
  ascentStage.position.y = 0.04;
  lmGroup.add(ascentStage);

  // LM Descent Stage (gold foil octagonal box)
  var descentGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8);
  var descentStage = new THREE.Mesh(descentGeo, foilMat);
  descentStage.position.y = 0.085;
  lmGroup.add(descentStage);

  // LM Engine
  var lmEngine = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.03, 8), darkMat);
  lmEngine.position.y = 0.12;
  lmEngine.rotation.x = Math.PI; // point away from CM
  lmGroup.add(lmEngine);

  // LM Landing Struts (folded)
  var strutMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (var i = 0; i < 4; i++) {
    var angle = (i * Math.PI) / 2;
    var strut = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.08), strutMat);
    // Struts attach to descent stage and extend out/up slightly
    var sx = Math.cos(angle) * 0.06;
    var sz = Math.sin(angle) * 0.06;
    strut.position.set(sx, 0.12, sz);
    
    // Rotate to angle out
    var strutAxis = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    strut.rotateOnAxis(strutAxis, Math.PI / 6);
    
    lmGroup.add(strut);
    
    // Footpads
    var footpad = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.002, 8), foilMat);
    footpad.position.set(sx * 1.6, 0.15, sz * 1.6);
    lmGroup.add(footpad);
  }

  group.add(lmGroup);

  group.name = 'Apollo-13-Stack';
  // Align to same orientation as Orion (Z forward, Y up)
  // Initially, the stack is oriented along Y axis. We'll handle this in the animate loop.

  // ── Thruster Effects (Glow + Particles) ──
  var exOuter = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  exOuter.position.y = -0.21; group.add(exOuter);

  var exInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  exInner.position.y = -0.21; group.add(exInner);

  // Particle exhaust system
  var PARTICLE_COUNT = 35;
  var pPos = new Float32Array(PARTICLE_COUNT * 3);
  var pCol = new Float32Array(PARTICLE_COUNT * 3);
  var pLife = new Float32Array(PARTICLE_COUNT);
  var pVel = [];

  function resetP(i) {
    pPos[i*3] = (Math.random()-0.5)*0.02; pPos[i*3+1] = -0.22; pPos[i*3+2] = (Math.random()-0.5)*0.02;
    pCol[i*3] = 1; pCol[i*3+1] = 0.9; pCol[i*3+2] = 0.6;
    pLife[i] = 0;
    pVel[i] = { x:(Math.random()-0.5)*0.005, y:-(0.008+Math.random()*0.01), z:(Math.random()-0.5)*0.005 };
  }
  for (var pi=0; pi<PARTICLE_COUNT; pi++) { resetP(pi); pLife[pi] = Math.random(); }

  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));

  var pMat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  var particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  group.add(particles);

  group.userData.exhaustOuter = exOuter;
  group.userData.exhaustInner = exInner;
  group.userData.particleData = {
    positions: pPos, colors: pCol, lifetimes: pLife, velocities: pVel, geo: pGeo, count: PARTICLE_COUNT, reset: resetP
  };

  // Add subtle glow
  var glowMat = new THREE.MeshBasicMaterial({ color: 0xffeeaa, transparent: true, opacity: 0.03, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), glowMat));

  return group;
};
