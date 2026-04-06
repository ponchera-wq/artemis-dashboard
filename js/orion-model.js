/**
 * orion-model.js
 *
 * Procedural Orion spacecraft model reconstructed from orion.glb geometry.
 * All profile points, radii and panel positions are derived from the actual
 * GLB vertex data — not estimated.
 *
 * GLB coordinate system (Y-up):
 *   CM tip:           y= 5.25, r=0.40
 *   CM nose taper:    y= 4.95, r=0.40
 *   CM body:          y= 0.35, r=2.50
 *   CM base:          y=-0.05, r=2.50
 *   Heatshield skirt: y=-2.19, r=3.50  ← widest point
 *   ESM cylinder:     y=-4.15 to -0.15, r=2.30
 *   Nozzle top:       y=-4.25, r=0.40
 *   Nozzle bottom:    y=-5.25, r=0.80
 *   Solar panels:     y=-2.15 (flat, 4 arms at 45°/135°/225°/315°)
 *     arm inner root: r≈5.35 from centre along diagonal
 *     arm outer tip:  r≈8.85, arm width: 1.10 units
 *
 * Materials (PBR values from GLB):
 *   Body_White   #d9d9d1  metallic=0.10  roughness=0.40  (crew module outer)
 *   Service_Module #999999 metallic=0.50 roughness=0.35  (CM lower / ESM)
 *   Body_Dark    #262626  metallic=0.20  roughness=0.60  (CM dark band)
 *   Thermal_Gold #b88727  metallic=0.80  roughness=0.30  (ESM gold foil)
 *   Nozzle       #4d4d4d  metallic=0.70  roughness=0.40
 *   Solar_Panel  #0d1440  metallic=0.30  roughness=0.20
 *
 * Usage:
 *   const model = createOrionModel(THREE);
 *   scene.add(model);
 *
 * The returned Group is centred at the ESM/CM junction (y=0 in GLB space).
 * Scale it to taste — the model spans ~10.5 units tip-to-nozzle in raw GLB units.
 */

'use strict';

function createOrionModel(THREE) {

  // ── Materials ────────────────────────────────────────────────────────────────
  const MAT = {
    bodyWhite: new THREE.MeshPhongMaterial({
      color: 0xd9d9d1, specular: 0x444444, shininess: 35,
    }),
    serviceModule: new THREE.MeshPhongMaterial({
      color: 0x999999, specular: 0x555555, shininess: 28,
    }),
    bodyDark: new THREE.MeshPhongMaterial({
      color: 0x262626, specular: 0x222222, shininess: 15,
    }),
    thermalGold: new THREE.MeshPhongMaterial({
      color: 0xb88727, specular: 0xaa7700, shininess: 55,
    }),
    nozzle: new THREE.MeshPhongMaterial({
      color: 0x4d4d4d, specular: 0x333333, shininess: 45,
    }),
    solarPanel: new THREE.MeshPhongMaterial({
      color: 0x0d1440, specular: 0x1a2a6e, shininess: 80,
      side: THREE.DoubleSide,
    }),
  };

  const group = new THREE.Group();

  // ── Scale factor ─────────────────────────────────────────────────────────────
  // GLB total height = 10.5 units. Keep raw GLB units; caller scales the group.
  // (trajectory.js currently does: orionGroup.scale.setScalar(someValue))

  // ── 1. Crew Module — LatheGeometry from actual GLB profile ──────────────────
  // Profile extracted from Primitive 2 (Body_White / Service_Module material)
  // Points: (radius, y) in GLB space
  const cmProfile = [
    new THREE.Vector2(0.40,  5.25),   // tip
    new THREE.Vector2(0.40,  4.95),   // upper nose
    new THREE.Vector2(2.50,  0.35),   // upper body
    new THREE.Vector2(2.50, -0.05),   // base of CM
    new THREE.Vector2(3.50, -2.19),   // heatshield skirt (widest)
  ];

  // Outer shell — Body_White colour
  const cmGeom = new THREE.LatheGeometry(cmProfile, 32);
  group.add(new THREE.Mesh(cmGeom, MAT.bodyWhite));

  // ── 2. Dark band on CM body (Body_Dark material, Primitive 3) ───────────────
  // Spans y=0.45 to y=4.85 at r=2.50 — fits inside CM profile
  const darkBandProfile = [
    new THREE.Vector2(2.48,  0.50),
    new THREE.Vector2(2.48,  4.80),
  ];
  const darkBandGeom = new THREE.LatheGeometry(darkBandProfile, 32);
  group.add(new THREE.Mesh(darkBandGeom, MAT.bodyDark));

  // ── 3. ESM / Service Module — cylinder (Thermal_Gold, Primitive 1) ──────────
  // y=-4.15 to y=-0.15, radius=2.30
  const esmHeight = 4.0;   // -4.15 to -0.15
  const esmGeom = new THREE.CylinderGeometry(2.30, 2.30, esmHeight, 24);
  const esm = new THREE.Mesh(esmGeom, MAT.thermalGold);
  esm.position.y = -0.15 - esmHeight / 2;   // centre of cylinder at y=-2.15
  group.add(esm);

  // ESM end caps (flat discs so it's not open)
  const capGeom = new THREE.CircleGeometry(2.30, 24);

  const capTop = new THREE.Mesh(capGeom, MAT.serviceModule);
  capTop.rotation.x = -Math.PI / 2;
  capTop.position.y = -0.15;
  group.add(capTop);

  const capBot = new THREE.Mesh(capGeom, MAT.nozzle);
  capBot.rotation.x = Math.PI / 2;
  capBot.position.y = -4.15;
  group.add(capBot);

  // ── 4. Nozzle — truncated cone (Primitive 0) ─────────────────────────────────
  // y=-5.25 (r=0.80) to y=-4.25 (r=0.40)
  // CylinderGeometry(radiusTop, radiusBottom, height, segments)
  const nozzleGeom = new THREE.CylinderGeometry(0.40, 0.80, 1.0, 16);
  const nozzle = new THREE.Mesh(nozzleGeom, MAT.nozzle);
  nozzle.position.y = -4.75;   // centre of 1.0-unit-tall cone
  group.add(nozzle);

  // Nozzle bell interior (dark inside)
  const bellGeom = new THREE.CylinderGeometry(0.38, 0.76, 0.98, 16);
  const bellInner = new THREE.Mesh(bellGeom, MAT.bodyDark);
  bellInner.position.y = -4.75;
  group.add(bellInner);

  // ── 5. Solar Arrays — 4 arms at 45°/135°/225°/315° (Primitive 5) ─────────────
  //
  // From GLB XZ analysis:
  //   Each arm is a rectangle 1.10 units wide, 3.51 units long.
  //   Arms run diagonally (at 45°) from r≈5.35 to r≈8.85 from spacecraft centre.
  //   All panels sit flat at y=-2.15 (mid-ESM).
  //
  // In THREE.js PlaneGeometry the geometry lies in the XY plane by default.
  // We rotate it flat (around X), then rotate around Y to place diagonally.

  const PANEL_Y    = -2.15;
  const ARM_W      = 1.10;
  const ARM_L      = 3.51;
  const ARM_INNER  = 5.35;   // distance from centre to inner edge midpoint
  const ARM_OFFSET = ARM_INNER + ARM_L / 2;   // centre of panel along arm axis

  const panelGeom = new THREE.PlaneGeometry(ARM_W, ARM_L);

  // 4 wings, each at 45° offset, placed along diagonal
  [45, 135, 225, 315].forEach(deg => {
    const rad = deg * Math.PI / 180;
    const wing = new THREE.Mesh(panelGeom, MAT.solarPanel);

    // Position along diagonal direction
    wing.position.set(
      Math.cos(rad) * ARM_OFFSET,
      PANEL_Y,
      Math.sin(rad) * ARM_OFFSET
    );

    // Lay flat in XZ plane
    wing.rotation.x = -Math.PI / 2;

    // Rotate to point along the diagonal
    wing.rotation.z = -rad;

    group.add(wing);
  });

  // ── 6. Panel root stubs — thin boxes connecting ESM wall to panel inner edge ─
  // Small connectors from ESM (r=2.30) to arm root (r=5.35) along each diagonal
  const STUB_L = ARM_INNER - 2.30;   // ≈3.05 units
  const stubGeom = new THREE.BoxGeometry(0.20, 0.12, STUB_L);

  [45, 135, 225, 315].forEach(deg => {
    const rad = deg * Math.PI / 180;
    const stub = new THREE.Mesh(stubGeom, MAT.serviceModule);
    const stubMid = 2.30 + STUB_L / 2;
    stub.position.set(
      Math.cos(rad) * stubMid,
      PANEL_Y,
      Math.sin(rad) * stubMid
    );
    stub.rotation.y = -rad;
    group.add(stub);
  });

  // ── 7. RCS thrusters — small bumps on CM (4 clusters, cosmetic) ─────────────
  const rcsGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.35, 6);
  const rcsMat  = MAT.serviceModule;

  // 4 clusters evenly spaced around CM at y≈1.5
  [0, 90, 180, 270].forEach(deg => {
    const rad = deg * Math.PI / 180;
    // Each cluster has 2 nozzles (forward/aft facing)
    [-0.25, 0.25].forEach(zOff => {
      const rcs = new THREE.Mesh(rcsGeom, rcsMat);
      rcs.rotation.z = Math.PI / 2;   // point radially outward
      rcs.position.set(
        Math.cos(rad) * 2.55,
        1.5,
        Math.sin(rad) * 2.55 + zOff
      );
      rcs.rotation.y = rad;
      group.add(rcs);
    });
  });

  // ── 8. Exhaust glow (outer) ───────────────────────────────────────────────────
  var exOuter = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  exOuter.position.y = -5.25;
  group.add(exOuter);

  // ── 9. Exhaust glow (inner) ───────────────────────────────────────────────────
  var exInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  exInner.position.y = -5.25;
  group.add(exInner);

  // ── 10. Glow halo ─────────────────────────────────────────────────────────────
  var haloMesh = new THREE.Mesh(
    new THREE.SphereGeometry(5.0, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.04, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(haloMesh);

  // ── 11. Nozzle glow ───────────────────────────────────────────────────────────
  var nozzleGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffeeaa, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  nozzleGlow.position.y = -5.25;
  group.add(nozzleGlow);

  // ── 12. Particle exhaust system ───────────────────────────────────────────────
  var PARTICLE_COUNT = 60;
  var pPositions = new Float32Array(PARTICLE_COUNT * 3);
  var pColors = new Float32Array(PARTICLE_COUNT * 3);
  var pLifetimes = new Float32Array(PARTICLE_COUNT);
  var pVelocities = [];
  function resetParticle(i) {
    pPositions[i*3]   = (Math.random()-0.5)*0.24;
    pPositions[i*3+1] = -5.25;
    pPositions[i*3+2] = (Math.random()-0.5)*0.24;
    pColors[i*3]=1.0; pColors[i*3+1]=1.0; pColors[i*3+2]=0.9;
    pLifetimes[i]=0;
    pVelocities[i]={x:(Math.random()-0.5)*0.06, y:-(0.12+Math.random()*0.1), z:(Math.random()-0.5)*0.06};
  }
  for (var ppi=0; ppi<PARTICLE_COUNT; ppi++) { resetParticle(ppi); pLifetimes[ppi]=Math.random(); }
  var pCanvas=document.createElement('canvas'); pCanvas.width=32; pCanvas.height=32;
  var pCtx=pCanvas.getContext('2d');
  var pGrad=pCtx.createRadialGradient(16,16,0,16,16,16);
  pGrad.addColorStop(0,'rgba(255,255,255,1)'); pGrad.addColorStop(0.25,'rgba(255,220,180,0.9)');
  pGrad.addColorStop(0.55,'rgba(255,100,20,0.5)'); pGrad.addColorStop(1,'rgba(255,30,0,0)');
  pCtx.fillStyle=pGrad; pCtx.fillRect(0,0,32,32);
  var pGeo=new THREE.BufferGeometry();
  pGeo.setAttribute('position',new THREE.BufferAttribute(pPositions,3));
  pGeo.setAttribute('color',new THREE.BufferAttribute(pColors,3));
  var pMat=new THREE.PointsMaterial({size:0.8,map:new THREE.CanvasTexture(pCanvas),vertexColors:true,transparent:true,opacity:1.0,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true});
  var exhaustParticles=new THREE.Points(pGeo,pMat);
  exhaustParticles.frustumCulled=false;
  group.add(exhaustParticles);

  // ── 13. userData exports (consumed by trajectory.js) ─────────────────────────
  group.userData.exhaustOuter     = exOuter;
  group.userData.exhaustInner     = exInner;
  group.userData.hullMat          = MAT.bodyWhite;
  group.userData.glowMat          = haloMesh.material;
  group.userData.nozzleGlow       = nozzleGlow;
  group.userData.exhaustParticles = exhaustParticles;
  group.userData.particleData     = {
    positions:  pPositions,
    colors:     pColors,
    lifetimes:  pLifetimes,
    velocities: pVelocities,
    geo:        pGeo,
    count:      PARTICLE_COUNT,
    reset:      resetParticle,
  };

  return group;
}

// Export for both module and classic-script environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createOrionModel };
} else {
  window.createOrionModel = createOrionModel;
}
