// orion-model.js — Detailed Orion spacecraft for trajectory view
// Returns a THREE.Group. Call: createOrionModel(THREE)
console.log('[OrionModel] orion-model.js loaded, createOrionModel available:', typeof createOrionModel !== 'undefined' || 'will be after parse');
function createOrionModel(THREE) {
  var ship = new THREE.Group();

  var whiteMat = new THREE.MeshPhongMaterial({ color: 0xe8e8e8, emissive: 0x181818, shininess: 50 });
  var darkMat = new THREE.MeshPhongMaterial({ color: 0x3a3a3a, emissive: 0x080808, shininess: 30 });
  var goldMLI = new THREE.MeshPhongMaterial({ color: 0xd4aa50, emissive: 0x221800, shininess: 80 });
  var heatShieldMat = new THREE.MeshPhongMaterial({ color: 0x6B3410, emissive: 0x1a0800, shininess: 15 });
  var windowMat = new THREE.MeshPhongMaterial({ color: 0x0a1a33, emissive: 0x050d1a, shininess: 120 });
  var solarMat = new THREE.MeshPhongMaterial({ color: 0x1a1a3a, emissive: 0x080820, shininess: 60, side: THREE.DoubleSide });
  var solarDetailMat = new THREE.MeshPhongMaterial({ color: 0x332200, emissive: 0x110800, shininess: 40, side: THREE.DoubleSide });
  var frameMat = new THREE.MeshPhongMaterial({ color: 0x777777, shininess: 50 });
  var thrusterMat = new THREE.MeshPhongMaterial({ color: 0x888888, emissive: 0x111111, shininess: 60 });

  // Forward bay cover (nose cap — protects parachutes)
  var noseCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI*2, 0, Math.PI/2),
    whiteMat
  );
  noseCap.rotation.x = Math.PI;
  noseCap.position.y = 0.36;
  ship.add(noseCap);

  // Docking ring
  var dockRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.035, 0.006, 8, 16),
    frameMat
  );
  dockRing.position.y = 0.36;
  dockRing.rotation.x = Math.PI / 2;
  ship.add(dockRing);

  // Forward hatch cylinder
  ship.add(Object.assign(new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.042, 0.03, 16), whiteMat
  ), { position: new THREE.Vector3(0, 0.34, 0) }));

  // Crew Module (bell/gumdrop shape using LatheGeometry)
  var cmProfile = [];
  for (var i = 0; i <= 20; i++) {
    var t = i / 20;
    var r = 0.042 + (0.11 - 0.042) * Math.pow(t, 0.65);
    cmProfile.push(new THREE.Vector2(r, 0.32 - t * 0.22));
  }
  ship.add(new THREE.Mesh(new THREE.LatheGeometry(cmProfile, 24), whiteMat));

  // Windows (4 around crew module)
  for (var wi = 0; wi < 4; wi++) {
    var wAngle = (wi / 4) * Math.PI * 2 + Math.PI / 6;
    var wR = 0.072;
    var win = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.014), windowMat);
    win.position.set(Math.cos(wAngle) * wR, 0.2, Math.sin(wAngle) * wR);
    win.lookAt(Math.cos(wAngle) * 2, 0.2, Math.sin(wAngle) * 2);
    ship.add(win);
    var wf = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.018), darkMat);
    wf.position.copy(win.position); wf.position.x *= 0.997; wf.position.z *= 0.997;
    wf.lookAt(Math.cos(wAngle) * 2, 0.2, Math.sin(wAngle) * 2);
    ship.add(wf);
  }

  // Backshell panel seams
  for (var bi = 0; bi < 8; bi++) {
    var bA = (bi / 8) * Math.PI * 2;
    var seam = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.2, 0.001), darkMat);
    seam.position.set(Math.cos(bA) * 0.078, 0.22, Math.sin(bA) * 0.078);
    ship.add(seam);
  }

  // Heat shield (AVCOAT)
  var hs = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.015, 24), heatShieldMat);
  hs.position.y = 0.098; ship.add(hs);
  var hsR = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.004, 8, 24), darkMat);
  hsR.position.y = 0.098; hsR.rotation.x = Math.PI / 2; ship.add(hsR);

  // Crew Module Adapter
  var cma = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.108, 0.04, 24), whiteMat);
  cma.position.y = 0.075; ship.add(cma);

  // Umbilical cover
  var umb = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.015), darkMat);
  umb.position.set(0.105, 0.075, 0); ship.add(umb);

  // Adapter ring
  var aR = new THREE.Mesh(new THREE.TorusGeometry(0.109, 0.003, 8, 24), frameMat);
  aR.position.y = 0.055; aR.rotation.x = Math.PI / 2; ship.add(aR);

  // European Service Module (same width as CM base)
  var esm = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.22, 24), whiteMat);
  esm.position.y = -0.055; ship.add(esm);

  // ESM vertical seams
  for (var ri = 0; ri < 10; ri++) {
    var rA = (ri / 10) * Math.PI * 2;
    var rl = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.21, 0.001), darkMat);
    rl.position.set(Math.cos(rA) * 0.109, -0.055, Math.sin(rA) * 0.109);
    ship.add(rl);
  }

  // ESM horizontal bands
  for (var hi = 0; hi < 3; hi++) {
    var hr = new THREE.Mesh(new THREE.TorusGeometry(0.109, 0.002, 6, 24), frameMat);
    hr.position.y = -0.055 + (hi - 1) * 0.07;
    hr.rotation.x = Math.PI / 2; ship.add(hr);
  }

  // ESM equipment boxes
  for (var eqi = 0; eqi < 6; eqi++) {
    var eqA = (eqi / 6) * Math.PI * 2 + Math.PI / 5;
    var eq = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.015), frameMat);
    eq.position.set(Math.cos(eqA) * 0.115, -0.04 + (eqi % 3) * 0.03, Math.sin(eqA) * 0.115);
    ship.add(eq);
  }

  // ESM bottom ring
  var ebr = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.004, 8, 24), frameMat);
  ebr.position.y = -0.165; ebr.rotation.x = Math.PI / 2; ship.add(ebr);

  // 8 auxiliary thrusters around ESM base
  for (var ti = 0; ti < 8; ti++) {
    var tA = (ti / 8) * Math.PI * 2;
    var thr = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.025, 6), thrusterMat);
    thr.position.set(Math.cos(tA) * 0.1, -0.18, Math.sin(tA) * 0.1);
    thr.rotation.x = Math.PI;
    ship.add(thr);
  }

  // Main engine bell
  var eng = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.04, 0.08, 12), thrusterMat);
  eng.position.y = -0.205; ship.add(eng);
  var noz = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.003, 6, 12), frameMat);
  noz.position.y = -0.245; noz.rotation.x = Math.PI / 2; ship.add(noz);

  // 4 Solar Array Wings (X-pattern from ESM base)
  for (var si = 0; si < 4; si++) {
    var sA = (si / 4) * Math.PI * 2 + Math.PI / 4;

    // Wing strut
    var stLen = 0.06;
    var st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, stLen, 4), frameMat);
    var stD = 0.108 + stLen / 2;
    st.position.set(Math.cos(sA) * stD, -0.14, Math.sin(sA) * stD);
    st.rotation.z = -Math.PI / 2;
    st.rotation.order = 'YXZ';
    st.rotation.y = -sA;
    ship.add(st);

    // 3 flat panels per wing
    for (var pi = 0; pi < 3; pi++) {
      var pD = 0.16 + pi * 0.14;

      // Solar panel (flat plane) — lies horizontal in XZ plane
      var pan = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.06), solarMat);
      pan.position.set(Math.cos(sA) * pD, -0.14, Math.sin(sA) * pD);
      pan.rotation.set(0, 0, 0);
      pan.lookAt(pan.position.x, pan.position.y + 1, pan.position.z);
      ship.add(pan);

      // Panel detail lines (copper traces)
      for (var dl = 0; dl < 3; dl++) {
        var det = new THREE.Mesh(new THREE.PlaneGeometry(0.125, 0.003), solarDetailMat);
        det.position.copy(pan.position);
        det.position.y += (dl - 1) * 0.015 + 0.001;
        det.rotation.set(0, 0, 0);
        det.lookAt(det.position.x, det.position.y + 1, det.position.z);
        ship.add(det);
      }

      // Panel frame (BoxGeometry thin in Y — already horizontal)
      var pf = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.002, 0.065), frameMat);
      pf.position.copy(pan.position);
      pf.rotation.copy(pan.rotation);
      ship.add(pf);

      // Hinge between panels
      if (pi < 2) {
        var hin = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 4), frameMat);
        var hD = pD + 0.07;
        hin.position.set(Math.cos(sA) * hD, -0.14, Math.sin(sA) * hD);
        hin.rotation.z = Math.PI / 2;
        hin.rotation.order = 'YXZ';
        hin.rotation.y = -sA + Math.PI / 2;
        ship.add(hin);
      }
    }
  }

  // Exhaust glow
  var exOuter = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  exOuter.position.y = -0.25; ship.add(exOuter);

  var exInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  exInner.position.y = -0.25; ship.add(exInner);

  // Glow halo
  var haloMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.04, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ship.add(haloMesh);

  // Particle exhaust system
  var PARTICLE_COUNT = 30;
  var pPositions = new Float32Array(PARTICLE_COUNT * 3);
  var pColors = new Float32Array(PARTICLE_COUNT * 3);
  var pLifetimes = new Float32Array(PARTICLE_COUNT);
  var pVelocities = [];

  function resetParticle(i) {
    pPositions[i*3]   = (Math.random() - 0.5) * 0.012;
    pPositions[i*3+1] = -0.25;
    pPositions[i*3+2] = (Math.random() - 0.5) * 0.012;
    pLifetimes[i] = 0;
    pVelocities[i] = {
      x: (Math.random() - 0.5) * 0.002,
      y: -(0.006 + Math.random() * 0.004),
      z: (Math.random() - 0.5) * 0.002
    };
  }
  for (var ppi = 0; ppi < PARTICLE_COUNT; ppi++) {
    resetParticle(ppi);
    pLifetimes[ppi] = Math.random();
  }

  // Circular particle texture
  var pCanvas = document.createElement('canvas');
  pCanvas.width = 32; pCanvas.height = 32;
  var pCtx = pCanvas.getContext('2d');
  var pGrad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  pGrad.addColorStop(0,   'rgba(255,255,255,1)');
  pGrad.addColorStop(0.3, 'rgba(255,200,100,0.8)');
  pGrad.addColorStop(0.7, 'rgba(255,100,20,0.3)');
  pGrad.addColorStop(1,   'rgba(255,50,0,0)');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 32, 32);

  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  pGeo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));

  var pMat = new THREE.PointsMaterial({
    size: 0.012,
    map: new THREE.CanvasTexture(pCanvas),
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  var exhaustParticles = new THREE.Points(pGeo, pMat);
  ship.add(exhaustParticles);

  // Expose references for animation
  ship.userData.exhaustOuter = exOuter;
  ship.userData.exhaustInner = exInner;
  ship.userData.hullMat = whiteMat;
  ship.userData.glowMat = haloMesh.material;
  ship.userData.exhaustParticles = exhaustParticles;
  ship.userData.particleData = {
    positions: pPositions,
    colors: pColors,
    lifetimes: pLifetimes,
    velocities: pVelocities,
    geo: pGeo,
    count: PARTICLE_COUNT,
    reset: resetParticle
  };

  return ship;
}
console.log('[OrionModel] createOrionModel defined:', typeof createOrionModel);
