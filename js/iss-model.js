window.createISSModel = function(THREE) {
  var group = new THREE.Group();

  var trussMat = new THREE.MeshPhongMaterial({ color: 0x999999, specular: 0x222222, shininess: 10 });
  var moduleMat = new THREE.MeshPhongMaterial({ color: 0xdddddf, specular: 0x555555, shininess: 40 });
  var solarMat = new THREE.MeshPhongMaterial({ color: 0x112255, emissive: 0x051025, side: THREE.DoubleSide });
  
  // Create a grid pattern for solar panels to give it texture
  // A simple way in r128 without external images is to use wireframe overlay
  var solarGridMat = new THREE.MeshBasicMaterial({ color: 0x3355aa, wireframe: true, transparent: true, opacity: 0.3 });

  // Main Truss (Long axis along X)
  var truss = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.02), trussMat);
  group.add(truss);

  // Pressurized Modules (Intersecting cylinders along Z)
  var coreModule = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.15, 16), moduleMat);
  coreModule.rotation.x = Math.PI / 2;
  group.add(coreModule);

  var frontModule = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 16), moduleMat);
  frontModule.rotation.x = Math.PI / 2;
  frontModule.position.z = 0.12;
  group.add(frontModule);

  var aftModule = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 16), moduleMat);
  aftModule.rotation.x = Math.PI / 2;
  aftModule.position.z = -0.11;
  group.add(aftModule);

  var crossModule = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 16), moduleMat);
  crossModule.rotation.z = Math.PI / 2;
  crossModule.position.z = 0.05;
  group.add(crossModule);

  // Solar Array Wings (8 primary wings)
  var panelWidth = 0.04;
  var panelLength = 0.15;
  var panelGeo = new THREE.PlaneGeometry(panelWidth, panelLength, 2, 8); // Segments for wireframe grid

  var positionsX = [0.12, 0.17, -0.12, -0.17];
  for (var i = 0; i < positionsX.length; i++) {
    var px = positionsX[i];
    
    // Front facing pair
    var pFront = new THREE.Mesh(panelGeo, solarMat);
    var pFrontGrid = new THREE.Mesh(panelGeo, solarGridMat);
    pFront.add(pFrontGrid);
    pFront.position.set(px, 0, 0.12);
    pFront.rotation.x = Math.PI / 2;
    group.add(pFront);

    // Back facing pair
    var pBack = new THREE.Mesh(panelGeo, solarMat);
    var pBackGrid = new THREE.Mesh(panelGeo, solarGridMat);
    pBack.add(pBackGrid);
    pBack.position.set(px, 0, -0.12);
    pBack.rotation.x = Math.PI / 2;
    group.add(pBack);
  }

  // Radiators (white panels extending down)
  var radMat = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, side: THREE.DoubleSide });
  var radGeo = new THREE.PlaneGeometry(0.03, 0.12, 1, 4);
  var radGridMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true, transparent: true, opacity: 0.5 });

  var rad1 = new THREE.Mesh(radGeo, radMat);
  rad1.add(new THREE.Mesh(radGeo, radGridMat));
  rad1.position.set(0.05, -0.07, 0);
  group.add(rad1);

  var rad2 = new THREE.Mesh(radGeo, radMat);
  rad2.add(new THREE.Mesh(radGeo, radGridMat));
  rad2.position.set(-0.05, -0.07, 0);
  group.add(rad2);

  return group;
};
