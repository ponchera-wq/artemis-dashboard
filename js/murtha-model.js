// murtha-model.js — USS John P. Murtha (LPD-26) 3D model for trajectory view
// Loads the SketchUp-exported Collada DAE and wraps it in a THREE.Group.
// The group is returned immediately (empty); the mesh is added asynchronously
// once ColladaLoader finishes. trajectory.js stores this ref and animates it.
//
// Call: createMurthaModel(THREE)
//
// userData fields match orion-model.js contract expected by trajectory.js.
console.log('[MurthaModel] murtha-model.js loaded');

function createMurthaModel(THREE) {
  var ship = new THREE.Group();

  // Single haze-grey material applied to every mesh in the DAE.
  // Ignores all original SketchUp textures/colours.
  // DoubleSide: SketchUp DAE exports often have inverted normals,
  // so FrontSide (default) renders nothing. DoubleSide fixes that.
  var hazeMat = new THREE.MeshPhongMaterial({
    color:     0x8a9aa8,
    emissive:  0x0a0d12,
    shininess: 35,
    side:      THREE.DoubleSide
  });

  // ── userData — Required by trajectory.js animate loop ──────────────────
  // Exhaust / particle fields set to null (ship, not spacecraft).
  ship.userData.exhaustOuter     = null;
  ship.userData.exhaustInner     = null;
  ship.userData.hullMat          = hazeMat;
  ship.userData.glowMat          = null;
  ship.userData.exhaustParticles = null;
  ship.userData.nozzleGlow       = null;
  ship.userData.particleData     = null;
  // Ship identity
  ship.userData.MMSI             = 368926266;
  ship.userData.shipName         = 'USS John P. Murtha (LPD-26)';
  ship.userData.type             = 'San Antonio-class Amphibious Transport Dock';

  // ── Load DAE (async) ───────────────────────────────────────────────────
  if (typeof THREE.ColladaLoader === 'undefined') {
    console.warn('[MurthaModel] THREE.ColladaLoader not found — DAE will not load.');
    return ship;
  }

  var loader = new THREE.ColladaLoader();
  loader.load(
    'models/murtha/model.dae',
    function onLoad(collada) {
      var dae = collada.scene;

      // Fix SketchUp Z-up axis convention
      dae.rotation.x = -Math.PI / 2;

      // Scale FIRST (DAE units are inches → scene units).
      // Must happen before Box3 so the centre offset is in scene units,
      // not raw inches (which would be thousands of units and break centering).
      // Measured hull length at 0.0005 = 4.09 scene units (Earth radius = 0.9).
      // 0.00008 → ~0.033 scene units (~36km equivalent) — same deliberate
      // exaggeration as the Orion model so it reads clearly as a ship marker
      // without being continent-sized.
      dae.scale.setScalar(0.00001);
      dae.updateMatrixWorld(true);

      // Override ALL materials — ignore original textures/colours
      dae.traverse(function(child) {
        if (child.isMesh) {
          child.material = hazeMat;
        }
      });

      // Auto-centre: box is now in scene units thanks to scale being applied first
      var box = new THREE.Box3().setFromObject(dae);
      var centre = new THREE.Vector3();
      box.getCenter(centre);
      dae.position.sub(centre);

      ship.add(dae);
      console.log('[MurthaModel] DAE loaded and centred. Box size:', box.getSize(new THREE.Vector3()));
    },
    undefined,
    function onError(err) {
      console.error('[MurthaModel] ColladaLoader error:', err);
    }
  );

  return ship;
}

console.log('[MurthaModel] createMurthaModel defined:', typeof createMurthaModel);
