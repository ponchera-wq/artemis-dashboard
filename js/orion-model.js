/**
 * orion-model.js — Procedural Orion spacecraft for trajectory view
 *
 * Geometry reconstructed from orion.glb vertex data (Y-up):
 *   CM tip:           y= 5.25, r=0.40
 *   CM nose taper:    y= 4.95, r=0.40
 *   CM body:          y= 0.35, r=2.50
 *   CM base:          y=-0.05, r=2.50
 *   Heatshield skirt: y=-2.19, r=3.50 (widest point)
 *   ESM cylinder:     y=-4.15 to -0.15, r=2.30
 *   Nozzle:           y=-5.25 (r=0.80) to y=-4.25 (r=0.40)
 *   Solar panels:     y=-2.15, 4 arms at 45/135/225/315°
 *     inner edge r≈5.35, outer edge r≈8.85, width=1.10
 *
 * Returns THREE.Group with userData for trajectory.js animation hooks.
 * Usage: var model = createOrionModel(THREE); scene.add(model);
 */
console.log('[OrionModel] orion-model.js loaded');

function createOrionModel(THREE) {
  var group = new THREE.Group();

  // ── Materials (matched to GLB PBR values) ─────────────────────────────────
  // Body_White: crew module upper shell
  var bodyWhiteMat = new THREE.MeshPhongMaterial({
    color: 0xd9d9d1, specular: 0x444444, shininess: 35,
    emissive: 0x111111
  });

  // Service_Module: CM outer shell (lower) + structural elements
  var serviceModuleMat = new THREE.MeshPhongMaterial({
    color: 0x999999, specular: 0x555555, shininess: 28,
    emissive: 0x080808
  });

  // Body_Dark: dark band on CM
  var bodyDarkMat = new THREE.MeshPhongMaterial({
    color: 0x262626, specular: 0x222222, shininess: 15,
    emissive: 0x050505
  });

  // Thermal_Gold: ESM foil
  var thermalGoldMat = new THREE.MeshPhongMaterial({
    color: 0xb88727, specular: 0xaa7700, shininess: 55,
    emissive: 0x221800
  });

  // Nozzle
  var nozzleMat = new THREE.MeshPhongMaterial({
    color: 0x4d4d4d, specular: 0x333333, shininess: 45,
    emissive: 0x080808
  });

  // Solar panels
  var solarMat = new THREE.MeshPhongMaterial({
    color: 0x0d1440, specular: 0x1a2a6e, shininess: 80,
    emissive: 0x040810, side: THREE.DoubleSide
  });

  // Window material
  var windowMat = new THREE.MeshPhongMaterial({
    color: 0x0a1a33, emissive: 0x050d1a, shininess: 120
  });

  var frameMat = new THREE.MeshPhongMaterial({
    color: 0x777777, shininess: 50
  });

  // ── 1. Crew Module — LatheGeometry from GLB profile ──────────────────────
  var cmProfile = [
    new THREE.Vector2(0.40, 5.25),   // tip (nose cap)
    new THREE.Vector2(0.40, 4.95),   // upper nose
    new THREE.Vector2(1.20, 3.95),   // Body_White upper edge
    new THREE.Vector2(2.50, 0.35),   // body flare
    new THREE.Vector2(2.50, -0.05),  // CM base
    new THREE.Vector2(3.50, -2.19),  // heatshield skirt (widest)
  ];
  var cmGeom = new THREE.LatheGeometry(cmProfile, 32);
  group.add(new THREE.Mesh(cmGeom, serviceModuleMat));

  // ── 2. Body_White overlay (y=0.65 to y=3.95, r=2.50 to 1.20) ───────────
  var bwProfile = [
    new THREE.Vector2(2.50, 0.65),
    new THREE.Vector2(1.20, 3.95),
  ];
  var bwGeom = new THREE.LatheGeometry(bwProfile, 32);
  group.add(new THREE.Mesh(bwGeom, bodyWhiteMat));

  // ── 3. Body_Dark band (y=0.45 to 4.85) ─────────────────────────────────
  // This is a thin shell over the CM body with dark markings
  var bdProfile = [
    new THREE.Vector2(2.48, 0.50),
    new THREE.Vector2(2.17, 2.43),
    new THREE.Vector2(2.17, 2.68),
    new THREE.Vector2(1.20, 4.05),
    new THREE.Vector2(0.30, 4.85),
  ];
  var bdGeom = new THREE.LatheGeometry(bdProfile, 32);
  group.add(new THREE.Mesh(bdGeom, bodyDarkMat));

  // ── 4. Windows (4 around CM at y≈2.5) ──────────────────────────────────
  for (var wi = 0; wi < 4; wi++) {
    var wAngle = (wi / 4) * Math.PI * 2 + Math.PI / 6;
    var wR = 2.0;
    var win = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), windowMat);
    win.position.set(Math.cos(wAngle) * wR, 2.5, Math.sin(wAngle) * wR);
    win.lookAt(Math.cos(wAngle) * 10, 2.5, Math.sin(wAngle) * 10);
    group.add(win);
  }

  // ── 5. ESM (Thermal_Gold cylinder, y=-4.15 to -0.15, r=2.30) ──────────
  var esmHeight = 4.0;
  var esmGeom = new THREE.CylinderGeometry(2.30, 2.30, esmHeight, 24);
  var esm = new THREE.Mesh(esmGeom, thermalGoldMat);
  esm.position.y = -0.15 - esmHeight / 2; // centre at y=-2.15
  group.add(esm);

  // ESM end caps
  var capGeom = new THREE.CircleGeometry(2.30, 24);
  var capTop = new THREE.Mesh(capGeom, serviceModuleMat);
  capTop.rotation.x = -Math.PI / 2;
  capTop.position.y = -0.15;
  group.add(capTop);

  var capBot = new THREE.Mesh(capGeom, nozzleMat);
  capBot.rotation.x = Math.PI / 2;
  capBot.position.y = -4.15;
  group.add(capBot);

  // ESM horizontal bands (detail)
  for (var hi = 0; hi < 3; hi++) {
    var hr = new THREE.Mesh(
      new THREE.TorusGeometry(2.31, 0.04, 6, 24),
      frameMat
    );
    hr.position.y = -0.15 - esmHeight / 2 + (hi - 1) * 1.2;
    hr.rotation.x = Math.PI / 2;
    group.add(hr);
  }

  // ── 6. Nozzle (y=-5.25 r=0.80 to y=-4.25 r=0.40) ─────────────────────
  var nozzleGeom = new THREE.CylinderGeometry(0.40, 0.80, 1.0, 16);
  var nozzle = new THREE.Mesh(nozzleGeom, nozzleMat);
  nozzle.position.y = -4.75;
  group.add(nozzle);

  // Dark interior
  var bellGeom = new THREE.CylinderGeometry(0.38, 0.76, 0.98, 16);
  var bellInner = new THREE.Mesh(bellGeom, bodyDarkMat);
  bellInner.position.y = -4.75;
  group.add(bellInner);

  // Nozzle rim
  var nozRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.80, 0.03, 6, 16),
    frameMat
  );
  nozRim.position.y = -5.25;
  nozRim.rotation.x = Math.PI / 2;
  group.add(nozRim);

  // ── 7. Solar Arrays — 4 arms at 45°/135°/225°/315° ────────────────────
  // From GLB: each arm 1.10 wide, 3.50 long, inner r=5.35, at y=-2.15
  var PANEL_Y = -2.15;
  var ARM_W = 1.10;
  var ARM_L = 3.50;
  var ARM_INNER = 5.35;
  var ARM_OFFSET = ARM_INNER + ARM_L / 2;

  var panelGeom = new THREE.PlaneGeometry(ARM_W, ARM_L);

  var solarAngles = [45, 135, 225, 315];
  for (var si = 0; si < 4; si++) {
    var rad = solarAngles[si] * Math.PI / 180;
    var wing = new THREE.Mesh(panelGeom, solarMat);
    wing.position.set(
      Math.cos(rad) * ARM_OFFSET,
      PANEL_Y,
      Math.sin(rad) * ARM_OFFSET
    );
    wing.rotation.x = -Math.PI / 2;
    wing.rotation.z = -rad;
    group.add(wing);

    // Panel detail lines (3 per arm)
    for (var dl = 0; dl < 3; dl++) {
      var detLine = new THREE.Mesh(
        new THREE.PlaneGeometry(ARM_W * 0.95, 0.04),
        bodyDarkMat
      );
      var perpOff = (dl - 1) * ARM_L * 0.25;
      detLine.position.set(
        Math.cos(rad) * (ARM_OFFSET + perpOff * 0.15),
        PANEL_Y + 0.01,
        Math.sin(rad) * (ARM_OFFSET + perpOff * 0.15)
      );
      detLine.rotation.x = -Math.PI / 2;
      detLine.rotation.z = -rad;
      group.add(detLine);
    }

    // Stub connector from ESM wall (r=2.30) to panel inner edge (r=5.35)
    var STUB_L = ARM_INNER - 2.30;
    var stubGeom = new THREE.BoxGeometry(0.20, 0.12, STUB_L);
    var stubMid = 2.30 + STUB_L / 2;
    var stub = new THREE.Mesh(stubGeom, serviceModuleMat);
    stub.position.set(
      Math.cos(rad) * stubMid,
      PANEL_Y,
      Math.sin(rad) * stubMid
    );
    stub.rotation.y = -rad;
    group.add(stub);
  }

  // ── 8. RCS thrusters (cosmetic, 4 clusters around CM at y≈1.5) ────────
  for (var ti = 0; ti < 8; ti++) {
    var tA = (ti / 8) * Math.PI * 2;
    var thr = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.25, 6),
      nozzleMat
    );
    thr.position.set(Math.cos(tA) * 2.55, 1.5, Math.sin(tA) * 2.55);
    thr.rotation.x = Math.PI;
    group.add(thr);
  }

  // ── 9. Exhaust & Glow FX (required by trajectory.js animation) ────────

  // Exhaust outer glow
  var exOuter = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  exOuter.position.y = -5.25;
  group.add(exOuter);

  // Exhaust inner glow
  var exInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffcc44, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  exInner.position.y = -5.25;
  group.add(exInner);

  // Glow halo around entire craft
  var haloMesh = new THREE.Mesh(
    new THREE.SphereGeometry(5.0, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0x44aaff, transparent: true, opacity: 0.04,
      side: THREE.BackSide, blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  group.add(haloMesh);

  // Nozzle hot glow
  var nozzleGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffeeaa, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  nozzleGlow.position.y = -5.25;
  group.add(nozzleGlow);

  // ── 10. Particle exhaust system ───────────────────────────────────────
  var PARTICLE_COUNT = 60;
  var pPositions = new Float32Array(PARTICLE_COUNT * 3);
  var pColors = new Float32Array(PARTICLE_COUNT * 3);
  var pLifetimes = new Float32Array(PARTICLE_COUNT);
  var pVelocities = [];

  function resetParticle(i) {
    pPositions[i * 3]     = (Math.random() - 0.5) * 0.24;
    pPositions[i * 3 + 1] = -5.25;
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.24;
    pColors[i * 3]     = 1.0;
    pColors[i * 3 + 1] = 1.0;
    pColors[i * 3 + 2] = 0.9;
    pLifetimes[i] = 0;
    pVelocities[i] = {
      x: (Math.random() - 0.5) * 0.06,
      y: -(0.12 + Math.random() * 0.1),
      z: (Math.random() - 0.5) * 0.06
    };
  }
  for (var ppi = 0; ppi < PARTICLE_COUNT; ppi++) {
    resetParticle(ppi);
    pLifetimes[ppi] = Math.random();
  }

  // Soft circular particle texture
  var pCanvas = document.createElement('canvas');
  pCanvas.width = 32; pCanvas.height = 32;
  var pCtx = pCanvas.getContext('2d');
  var pGrad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  pGrad.addColorStop(0,    'rgba(255,255,255,1)');
  pGrad.addColorStop(0.25, 'rgba(255,220,180,0.9)');
  pGrad.addColorStop(0.55, 'rgba(255,100,20,0.5)');
  pGrad.addColorStop(1,    'rgba(255,30,0,0)');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 32, 32);

  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  pGeo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));

  var pMat = new THREE.PointsMaterial({
    size: 0.8,
    map: new THREE.CanvasTexture(pCanvas),
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });
  var exhaustParticles = new THREE.Points(pGeo, pMat);
  exhaustParticles.frustumCulled = false;
  group.add(exhaustParticles);

  // ── 11. userData — Animation hooks for trajectory.js ───────────────────
  group.userData.exhaustOuter     = exOuter;
  group.userData.exhaustInner     = exInner;
  group.userData.hullMat          = bodyWhiteMat;
  group.userData.glowMat          = haloMesh.material;
  group.userData.nozzleGlow       = nozzleGlow;
  group.userData.exhaustParticles = exhaustParticles;
  group.userData.particleData = {
    positions:  pPositions,
    colors:     pColors,
    lifetimes:  pLifetimes,
    velocities: pVelocities,
    geo:        pGeo,
    count:      PARTICLE_COUNT,
    reset:      resetParticle
  };

  return group;
}

// Export for both module and classic-script environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createOrionModel: createOrionModel };
} else {
  window.createOrionModel = createOrionModel;
}
console.log('[OrionModel] createOrionModel defined:', typeof createOrionModel);
