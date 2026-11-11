// =====================================================
//  AUTO-MODELL
//  Die Karosserie ist ein Seitenprofil (wie eine Zeichnung von
//  der Seite), das in die Breite "gezogen" wird (Extrude).
//  Vorne ist +X, oben ist +Y.
// =====================================================
window.buildCarModel = function (cfg, char) {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color: (char && char.color) || cfg.color, shininess: 90, specular: 0x777777 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x1a2232, shininess: 120, specular: 0x999999 });
  const black = new THREE.MeshPhongMaterial({ color: 0x151515, shininess: 10 });
  const rimMat = new THREE.MeshPhongMaterial({ color: 0xd0d4da, shininess: 80, specular: 0xaaaaaa });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; group.add(m); return m; };

  // Karosserie mit Radkästen
  const body = new THREE.Shape();
  body.moveTo(-2.25, 0.4);
  body.lineTo(-1.98, 0.4);
  body.absarc(-1.4, 0.4, 0.58, Math.PI, 0, true);
  body.lineTo(0.82, 0.4);
  body.absarc(1.4, 0.4, 0.58, Math.PI, 0, true);
  body.lineTo(2.2, 0.4);
  body.lineTo(2.36, 0.62);
  body.lineTo(2.28, 0.86);
  body.lineTo(0.9, 1.06);
  body.lineTo(-1.85, 1.12);
  body.lineTo(-2.3, 1.02);
  body.lineTo(-2.25, 0.4);
  const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2, curveSegments: 10 });
  bodyGeo.translate(0, 0, -0.9);
  add(bodyGeo, paint);

  // Cabrio: Windschutzscheibe, Sitz, Lenkrad, Überrollbügel – und der Fahrer
  const glassClear = new THREE.MeshPhongMaterial({ color: 0xbfe6ff, shininess: 150, specular: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  const ws = add(new THREE.BoxGeometry(0.04, 0.5, 1.5), glassClear, 0.55, 1.32, 0);
  ws.rotation.z = 0.55; ws.castShadow = false;
  add(new THREE.BoxGeometry(0.06, 0.06, 1.55), black, 0.68, 1.53, 0).rotation.z = 0.55;
  add(new THREE.BoxGeometry(0.75, 0.12, 1.1), black, -0.55, 1.08, 0);    // Sitzfläche
  add(new THREE.BoxGeometry(0.12, 0.42, 1.1), black, -0.98, 1.3, 0);    // Lehne
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 20), black);
  wheel.position.set(0.02, 1.45, 0); wheel.rotation.y = Math.PI / 2; wheel.rotation.x = 0; wheel.rotation.z = 0;
  wheel.rotateX(0); group.add(wheel);
  const barMat = new THREE.MeshPhongMaterial({ color: 0x2b2b2b, shininess: 80 });
  for (const z of [-0.62, 0.62]) add(new THREE.CylinderGeometry(0.045, 0.045, 0.75, 8), barMat, -1.2, 1.45, z);
  const top = add(new THREE.CylinderGeometry(0.045, 0.045, 1.24, 8), barMat, -1.2, 1.82, 0);
  top.rotation.x = Math.PI / 2;
  let driver = null;
  if (char && window.Drivers) {
    driver = Drivers.build(char);
    driver.position.set(-0.55, 1.1, 0);
    driver.scale.setScalar(1.25);
    group.add(driver);
  }

  // Startnummer an den Türen
  const nc = document.createElement('canvas'); nc.width = nc.height = 128;
  const nx = nc.getContext('2d');
  nx.fillStyle = '#ffffff'; nx.beginPath(); nx.arc(64, 64, 58, 0, Math.PI * 2); nx.fill();
  nx.fillStyle = '#111'; nx.font = 'bold 84px system-ui, sans-serif'; nx.textAlign = 'center'; nx.textBaseline = 'middle';
  nx.fillText((char && char.number) || cfg.number || '1', 64, 70);
  const numMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc), transparent: true });
  for (const sgn of [-1, 1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), numMat);
    decal.position.set(-0.1, 0.74, sgn * 0.975);
    if (sgn < 0) decal.rotation.y = Math.PI;
    group.add(decal);
  }

  // Spoiler, Lichter, Kühlergrill
  add(new THREE.BoxGeometry(0.55, 0.07, 1.9), black, -2.05, 1.42, 0);
  add(new THREE.BoxGeometry(0.08, 0.32, 0.08), black, -2.0, 1.24, 0.6);
  add(new THREE.BoxGeometry(0.08, 0.32, 0.08), black, -2.0, 1.24, -0.6);
  add(new THREE.BoxGeometry(0.06, 0.16, 0.42), headMat, 2.33, 0.74, 0.6);
  add(new THREE.BoxGeometry(0.06, 0.16, 0.42), headMat, 2.33, 0.74, -0.6);
  add(new THREE.BoxGeometry(0.06, 0.14, 0.45), tailMat, -2.33, 0.86, 0.62);
  add(new THREE.BoxGeometry(0.06, 0.14, 0.45), tailMat, -2.33, 0.86, -0.62);
  add(new THREE.BoxGeometry(0.05, 0.14, 0.8), black, 2.38, 0.52, 0);

  // Räder (vordere können lenken)
  const tireGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.34, 20); tireGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.36, 8); rimGeo.rotateX(Math.PI / 2);
  const wheels = [], frontPivots = [];
  for (const [x, z, front] of [[1.4, 0.88, true], [1.4, -0.88, true], [-1.4, 0.88, false], [-1.4, -0.88, false]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.45, z);
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, black); tire.castShadow = true;
    wheel.add(tire, new THREE.Mesh(rimGeo, rimMat));
    pivot.add(wheel); group.add(pivot);
    wheels.push(wheel);
    if (front) frontPivots.push(pivot);
  }
  return { group, wheels, frontPivots, driver };
};
