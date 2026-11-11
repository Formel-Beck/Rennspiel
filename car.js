// =====================================================
//  FAHRZEUG-MODELLE
//  Vorne ist +X, oben ist +Y. Jedes Modell sagt ausserdem:
//   seat     = wo der Fahrer sitzt (x, y) und wie gross er ist
//   wheelR   = Radius der Räder (für das Drehen)
//   hoodCam  = Position der Motorhauben-Kamera
//   collide  = Grösse für Zusammenstösse (Radius r, Abstand off vorne/hinten)
// =====================================================
window.buildCarModel = function (cfg, char) {
  const group = new THREE.Group();
  const color = (char && char.color) || '#e53935';
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 90, specular: 0x777777 });
  const black = new THREE.MeshPhongMaterial({ color: 0x151515, shininess: 10 });
  const metal = new THREE.MeshPhongMaterial({ color: 0x8a9099, shininess: 90, specular: 0xaaaaaa });
  const rimMat = new THREE.MeshPhongMaterial({ color: 0xd0d4da, shininess: 80, specular: 0xaaaaaa });
  const glassClear = new THREE.MeshPhongMaterial({ color: 0xbfe6ff, shininess: 150, specular: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const yellow = new THREE.MeshPhongMaterial({ color: 0xffc107, shininess: 40 });

  const add = (geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true; group.add(m); return m;
  };
  const box = (sx, sy, sz, mat, x, y, z, rz) => add(new THREE.BoxGeometry(sx, sy, sz), mat, x, y, z, 0, 0, rz);
  // Rohr von a nach b (für Überrollbügel, Rahmen …)
  function tube(a, b, r, mat) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    m.castShadow = true; group.add(m); return m;
  }
  const wheels = [], frontPivots = [];
  function wheel(x, z, r, w, front, rimScale) {
    const pivot = new THREE.Group(); pivot.position.set(x, r, z);
    const wg = new THREE.Group();
    const tg = new THREE.CylinderGeometry(r, r, w, 22); tg.rotateX(Math.PI / 2);
    const rg = new THREE.CylinderGeometry(r * (rimScale || 0.6), r * (rimScale || 0.6), w + 0.02, 8); rg.rotateX(Math.PI / 2);
    const tire = new THREE.Mesh(tg, black); tire.castShadow = true;
    wg.add(tire, new THREE.Mesh(rg, rimMat));
    pivot.add(wg); group.add(pivot);
    wheels.push(wg); if (front) frontPivots.push(pivot);
  }
  function steeringWheel(x, y, r) {
    const sw = new THREE.Mesh(new THREE.TorusGeometry(r || 0.17, 0.025, 8, 20), black);
    sw.position.set(x, y, 0); sw.rotation.y = Math.PI / 2; group.add(sw);
  }
  function numberDecal(x, y, z, size) {
    const nc = document.createElement('canvas'); nc.width = nc.height = 128;
    const nx = nc.getContext('2d');
    nx.fillStyle = '#ffffff'; nx.beginPath(); nx.arc(64, 64, 58, 0, Math.PI * 2); nx.fill();
    nx.fillStyle = '#111'; nx.font = 'bold 84px system-ui, sans-serif'; nx.textAlign = 'center'; nx.textBaseline = 'middle';
    nx.fillText((char && char.number) || '1', 64, 70);
    const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc), transparent: true });
    for (const sgn of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      d.position.set(x, y, sgn * z); if (sgn < 0) d.rotation.y = Math.PI;
      group.add(d);
    }
  }

  const builders = {
    // ---------- Sport-Cabrio ----------
    sport() {
      const body = new THREE.Shape();
      body.moveTo(-2.25, 0.4); body.lineTo(-1.98, 0.4);
      body.absarc(-1.4, 0.4, 0.58, Math.PI, 0, true); body.lineTo(0.82, 0.4);
      body.absarc(1.4, 0.4, 0.58, Math.PI, 0, true); body.lineTo(2.2, 0.4);
      body.lineTo(2.36, 0.62); body.lineTo(2.28, 0.86); body.lineTo(0.9, 1.06); body.lineTo(-1.85, 1.12); body.lineTo(-2.3, 1.02); body.lineTo(-2.25, 0.4);
      const g = new THREE.ExtrudeGeometry(body, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2, curveSegments: 10 });
      g.translate(0, 0, -0.9); add(g, paint);
      const ws = box(0.04, 0.5, 1.5, glassClear, 0.55, 1.32, 0, 0.55); ws.castShadow = false;
      box(0.06, 0.06, 1.55, black, 0.68, 1.53, 0, 0.55);
      box(0.75, 0.12, 1.1, black, -0.55, 1.08, 0); box(0.12, 0.42, 1.1, black, -0.98, 1.3, 0);
      steeringWheel(0.02, 1.45);
      for (const z of [-0.62, 0.62]) tube([-1.2, 1.08, z], [-1.2, 1.82, z], 0.045, black);
      tube([-1.2, 1.82, -0.62], [-1.2, 1.82, 0.62], 0.045, black);
      numberDecal(-0.1, 0.74, 0.975, 0.62);
      box(0.55, 0.07, 1.9, black, -2.05, 1.42, 0);
      box(0.08, 0.32, 0.08, black, -2.0, 1.24, 0.6); box(0.08, 0.32, 0.08, black, -2.0, 1.24, -0.6);
      for (const z of [0.6, -0.6]) { box(0.06, 0.16, 0.42, headMat, 2.33, 0.74, z); box(0.06, 0.14, 0.45, tailMat, -2.33, 0.86, z * 1.03); }
      box(0.05, 0.14, 0.8, black, 2.38, 0.52, 0);
      for (const [x, z, f] of [[1.4, 0.88, 1], [1.4, -0.88, 1], [-1.4, 0.88, 0], [-1.4, -0.88, 0]]) wheel(x, z, 0.45, 0.34, f);
      return { seat: [-0.55, 1.1, 1.25], wheelR: 0.45, hoodCam: [0.85, 1.55], collide: { r: 1.05, off: 1.25 } };
    },

    // ---------- Formel-Renner ----------
    formula() {
      box(2.3, 0.4, 0.78, paint, -0.25, 0.55, 0);                       // Monocoque
      add(new THREE.CylinderGeometry(0.1, 0.32, 1.9, 10), paint, 1.85, 0.5, 0, 0, 0, -Math.PI / 2); // Nase
      for (const z of [-0.6, 0.6]) box(1.4, 0.34, 0.42, paint, -0.45, 0.5, z); // Seitenkästen
      add(new THREE.CylinderGeometry(0.12, 0.36, 1.5, 10), paint, -1.35, 0.72, 0, 0, 0, Math.PI / 2); // Motorabdeckung
      box(0.45, 0.4, 0.32, paint, -0.95, 1.05, 0);                       // Lufteinlass
      box(0.08, 0.3, 0.34, black, -0.75, 1.05, 0);
      box(0.4, 0.05, 2.05, black, 2.6, 0.22, 0);                         // Frontflügel
      for (const z of [-1.02, 1.02]) box(0.5, 0.22, 0.04, paint, 2.6, 0.3, z);
      box(0.5, 0.06, 1.7, black, -2.2, 1.3, 0); box(0.5, 0.06, 1.7, black, -2.15, 1.12, 0); // Heckflügel
      for (const z of [-0.86, 0.86]) box(0.62, 0.55, 0.04, paint, -2.18, 1.1, z);
      box(0.12, 0.6, 0.12, black, -1.95, 0.85, 0);
      tube([0.3, 0.78, -0.35], [0.3, 1.18, 0], 0.035, black); tube([0.3, 0.78, 0.35], [0.3, 1.18, 0], 0.035, black); // Halo
      tube([0.3, 1.18, 0], [-0.55, 1.12, 0], 0.035, black);
      steeringWheel(0.12, 0.88, 0.13);
      box(0.04, 0.1, 0.3, tailMat, -2.3, 0.62, 0);
      numberDecal(0.6, 0.62, 0.395, 0.34);
      for (const [x, z, r, w, f] of [[1.6, 0.98, 0.38, 0.32, 1], [1.6, -0.98, 0.38, 0.32, 1], [-1.45, 0.98, 0.46, 0.44, 0], [-1.45, -0.98, 0.46, 0.44, 0]]) {
        wheel(x, z, r, w, f, 0.65);
        tube([x, r, z * 0.42], [x, r, z * 0.82], 0.03, black); // Querlenker
      }
      return { seat: [-0.35, 0.52, 1.12], wheelR: 0.42, hoodCam: [0.35, 1.25], collide: { r: 0.95, off: 1.4 } };
    },

    // ---------- Go-Kart ----------
    kart() {
      box(2.0, 0.07, 1.05, metal, 0, 0.22, 0);                           // Rahmen
      box(0.55, 0.28, 1.0, paint, 0.98, 0.32, 0, 0.25);                  // Frontverkleidung
      for (const z of [-0.6, 0.6]) box(1.0, 0.22, 0.16, paint, 0, 0.32, z); // Seitenkästen
      box(0.12, 0.18, 1.3, paint, -1.05, 0.3, 0);                         // Heckstossstange
      box(0.55, 0.12, 0.6, black, -0.3, 0.33, 0);                         // Sitz
      box(0.12, 0.55, 0.6, black, -0.58, 0.58, 0, 0.25);
      tube([0.65, 0.25, 0], [0.32, 0.72, 0], 0.03, metal);                // Lenksäule
      steeringWheel(0.3, 0.74, 0.15);
      box(0.32, 0.3, 0.3, metal, -0.72, 0.42, 0.35);                      // Motor
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), black, -0.95, 0.5, 0.35, 0, 0, Math.PI / 2);
      numberDecal(1.0, 0.36, 0.51, 0.26);
      for (const [x, z, r, w, f] of [[0.75, 0.62, 0.25, 0.2, 1], [0.75, -0.62, 0.25, 0.2, 1], [-0.72, 0.66, 0.28, 0.3, 0], [-0.72, -0.66, 0.28, 0.3, 0]]) wheel(x, z, r, w, f, 0.55);
      return { seat: [-0.28, 0.38, 1.12], wheelR: 0.27, hoodCam: [0.55, 1.05], collide: { r: 0.75, off: 0.7 } };
    },

    // ---------- Monstertruck ----------
    monster() {
      box(3.0, 0.25, 0.9, black, 0, 1.05, 0);                            // Rahmen
      box(3.7, 0.55, 2.0, paint, 0, 1.55, 0);                            // Karosserie
      box(1.25, 0.25, 1.9, paint, 1.15, 1.92, 0, -0.08);                 // Motorhaube
      box(0.2, 0.3, 1.6, black, 1.88, 1.55, 0);                          // Kühlergrill
      for (const z of [0.7, -0.7]) { box(0.06, 0.16, 0.3, headMat, 1.86, 1.75, z); box(0.06, 0.14, 0.35, tailMat, -1.86, 1.65, z); }
      box(1.2, 0.08, 1.7, black, -1.1, 1.86, 0);                          // Ladefläche
      for (const z of [-0.95, 0.95]) box(1.3, 0.3, 0.06, paint, -1.1, 2.0, z);
      box(0.6, 0.12, 0.9, black, -0.15, 1.88, 0); box(0.12, 0.55, 0.9, black, -0.45, 2.15, 0); // Sitz
      steeringWheel(0.38, 2.25, 0.19);
      const cage = [[0.55, -0.85], [0.55, 0.85], [-0.75, -0.85], [-0.75, 0.85]];
      for (const [x, z] of cage) tube([x, 1.82, z], [x * 0.85, 2.95, z * 0.9], 0.05, black);
      tube([0.47, 2.95, -0.77], [0.47, 2.95, 0.77], 0.05, black); tube([-0.64, 2.95, -0.77], [-0.64, 2.95, 0.77], 0.05, black);
      for (const z of [-0.77, 0.77]) tube([0.47, 2.95, z], [-0.64, 2.95, z], 0.05, black);
      for (let k = 0; k < 4; k++) box(0.12, 0.12, 0.12, headMat, 0.47, 3.05, -0.45 + k * 0.3); // Lichtleiste
      for (const [x, z] of [[1.35, 1.05], [1.35, -1.05], [-1.35, 1.05], [-1.35, -1.05]]) {
        tube([x, 0.85, z * 0.95], [x * 0.9, 1.4, z * 0.45], 0.08, yellow); // Federbein
      }
      for (const [x, z, f] of [[1.35, 1.12, 1], [1.35, -1.12, 1], [-1.35, 1.12, 0], [-1.35, -1.12, 0]]) wheel(x, z, 0.85, 0.62, f, 0.5);
      numberDecal(0.3, 1.55, 1.01, 0.6);
      return { seat: [-0.15, 1.94, 1.25], wheelR: 0.85, hoodCam: [1.25, 2.5], collide: { r: 1.3, off: 1.3 } };
    },

    // ---------- Buggy ----------
    buggy() {
      box(2.6, 0.08, 1.2, metal, 0, 0.62, 0);                            // Unterboden
      box(0.7, 0.25, 1.1, paint, 1.25, 0.82, 0, 0.3);                    // Front
      box(0.9, 0.06, 1.0, paint, 0.75, 1.0, 0, 0.12);
      for (const z of [-0.6, 0.6]) {
        tube([1.5, 0.7, z * 0.8], [0.5, 1.15, z], 0.045, paint);           // Seitenrohre
        tube([0.5, 1.15, z], [-0.6, 1.95, z * 0.85], 0.045, paint);        // Bügel vorne
        tube([-0.6, 1.95, z * 0.85], [-1.0, 0.7, z], 0.045, paint);        // Bügel hinten
        tube([0.5, 0.66, z], [0.5, 1.15, z], 0.045, paint);
        tube([-1.0, 0.66, z], [-1.45, 0.9, z * 0.8], 0.045, paint);
      }
      tube([-0.6, 1.95, -0.51], [-0.6, 1.95, 0.51], 0.045, paint);
      for (let k = 0; k < 4; k++) box(0.1, 0.1, 0.12, headMat, -0.55, 2.04, -0.36 + k * 0.24); // Lichtleiste
      box(0.55, 0.12, 0.7, black, -0.3, 0.72, 0); box(0.12, 0.6, 0.7, black, -0.6, 1.0, 0, 0.15); // Sitz
      steeringWheel(0.3, 1.18, 0.15);
      box(0.6, 0.45, 0.7, metal, -1.2, 0.95, 0);                          // Motor
      const spare = new THREE.CylinderGeometry(0.42, 0.42, 0.25, 18); spare.rotateZ(Math.PI / 2);
      add(spare, black, -1.6, 1.2, 0);                                     // Reserverad
      for (const z of [0.5, -0.5]) box(0.05, 0.12, 0.2, tailMat, -1.52, 0.85, z);
      for (const [x, z, f] of [[1.3, 0.98, 1], [1.3, -0.98, 1], [-1.25, 1.0, 0], [-1.25, -1.0, 0]]) {
        wheel(x, z, 0.55, 0.42, f, 0.55);
        tube([x, 0.55, z * 0.45], [x * 0.9, 0.8, z * 0.6], 0.04, yellow);
      }
      numberDecal(1.3, 0.88, 0.56, 0.3);
      return { seat: [-0.3, 0.78, 1.18], wheelR: 0.55, hoodCam: [0.75, 1.7], collide: { r: 1.0, off: 1.15 } };
    }
  };

  const info = (builders[cfg.model] || builders.sport)();
  let driver = null;
  if (char && window.Drivers) {
    driver = Drivers.build(char);
    driver.position.set(info.seat[0], info.seat[1], 0);
    driver.scale.setScalar(info.seat[2]);
    driver.userData.baseY = info.seat[1];
    group.add(driver);
  }
  return Object.assign({ group, wheels, frontPivots, driver }, info);
};
