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

  // Seitenprofil (x vorne, y oben) als Körper mit Tiefe 'depth' (z), mittig
  function profile(pts, depth, mat, bevel) {
    const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p.length === 4) sh.absarc(p[0], p[1], p[2], Math.PI, 0, true); // Radkasten: [x, y, Radius, 'arc']
      else sh.lineTo(p[0], p[1]);
    }
    const b = bevel == null ? 0.07 : bevel;
    const g = new THREE.ExtrudeGeometry(sh, { depth: depth - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 3, curveSegments: 14 });
    g.translate(0, 0, -(depth - 2 * b) / 2);
    return add(g, mat);
  }
  // Felgen mit Speichen: 'modern' (5 Doppelspeichen), 'mesh' (viele dünne), 'turbine' (3 breite)
  const darkRim = new THREE.MeshPhongMaterial({ color: 0x3a3f47, shininess: 70, specular: 0x888888 });
  function rims(style, mat) {
    const r0 = wheels.length - 4;
    for (let k = r0; k < wheels.length; k++) {
      const wg = wheels[k], tire = wg.children[0], r = tire.geometry.parameters.radiusTop, w = tire.geometry.parameters.height;
      wg.remove(wg.children[1]);                                  // alte, glatte Felge weg
      const rr = r * 0.66;
      const disc = new THREE.CylinderGeometry(rr, rr, w * 0.7, 20); disc.rotateX(Math.PI / 2);
      wg.add(new THREE.Mesh(disc, black));                        // dunkler Felgengrund
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr * 0.97, 0.035, 6, 24), mat);
      const n = style === 'mesh' ? 10 : style === 'turbine' ? 3 : 5;
      for (const side of [-1, 1]) {
        const zz = side * (w / 2 - 0.01);
        const rg = ring.clone(); rg.position.z = zz; wg.add(rg);
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2;
          const make = (len, thick, off) => {
            const sp = new THREE.Mesh(new THREE.BoxGeometry(len, thick, 0.04), mat);
            sp.position.set(Math.cos(a + off) * len / 2, Math.sin(a + off) * len / 2, zz); sp.rotation.z = a + off; wg.add(sp);
          };
          if (style === 'modern') { make(rr * 0.95, 0.05, 0.12); make(rr * 0.95, 0.05, -0.12); }
          else if (style === 'mesh') make(rr * 0.95, 0.035, 0);
          else make(rr * 0.9, 0.2, 0);
        }
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), mat); cap.rotation.x = Math.PI / 2; cap.position.z = zz; wg.add(cap);
      }
    }
  }
  function mirrors(x, y, z) {
    for (const s of [-1, 1]) { box(0.2, 0.12, 0.16, paint, x, y, s * z); box(0.06, 0.04, 0.1, black, x + 0.05, y - 0.08, s * (z - 0.08)); }
  }
  function label(text, x, y, z, w, h, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const cx = c.getContext('2d'); cx.fillStyle = color || '#fff';
    cx.font = 'italic bold 46px system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, 128, 34);
    const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
    for (const sgn of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      d.position.set(x, y, sgn * z); if (sgn < 0) d.rotation.y = Math.PI; group.add(d);
    }
  }
  const glass = new THREE.MeshPhongMaterial({ color: 0x8fb6d6, shininess: 150, specular: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false });
  const tint = new THREE.MeshPhongMaterial({ color: 0x223040, shininess: 120, specular: 0xffffff }); // getönte Heckscheibe/Kanten
  const amber = new THREE.MeshBasicMaterial({ color: 0xffa726 });
  const chrome = metal;

  const builders = {
    // ---------- Modernes Kompakt-Coupé ----------
    coupe() {
      profile([[-2.22, 0.36], [-1.88, 0.36], [-1.35, 0.44, 0.53, 'arc'], [0.82, 0.36], [1.35, 0.44, 0.53, 'arc'], [2.12, 0.36],
        [2.3, 0.48], [2.33, 0.68], [2.18, 0.84], [1.35, 0.94], [0.72, 1.0], [-1.55, 1.02], [-2.05, 1.0], [-2.24, 0.9], [-2.27, 0.56]], 1.82, paint, 0.09);
      profile([[0.8, 0.98], [0.02, 1.4], [-0.75, 1.43], [-1.3, 1.3], [-1.9, 1.02]], 1.5, glass, 0.06).castShadow = false; // Glasdach
      profile([[0.1, 1.36], [0.0, 1.45], [-0.75, 1.48], [-1.32, 1.34], [-1.25, 1.28], [-0.72, 1.4], [0.02, 1.36]], 1.46, paint, 0.03);     // Dach
      for (const z of [-0.7, 0.7]) {
        tube([0.78, 1.0, z * 1.02], [0.04, 1.39, z * 0.98], 0.045, paint);                     // A-Säule
        profile([[-1.0, 1.04], [-1.2, 1.32], [-1.42, 1.25], [-1.85, 1.04]], 0.12, paint, 0.02).position.z = z * 1.03; // C-Säule
      }
      box(0.07, 0.07, 1.6, black, 0.05, 1.37, 0, 0.5);
      // Front: breiter Lufteinlass, schmale Lichter
      box(0.08, 0.2, 1.2, black, 2.31, 0.5, 0); box(0.3, 0.04, 1.7, black, 2.22, 0.37, 0);      // Einlass + Lippe
      for (const z of [-0.62, 0.62]) {
        box(0.32, 0.06, 0.42, headMat, 2.18, 0.82, z, -0.32);                                    // LED-Leiste
        box(0.06, 0.14, 0.2, black, 2.3, 0.52, z * 1.2);                                         // seitliche Einlässe
        box(0.06, 0.07, 0.5, tailMat, -2.25, 0.86, z * 1.05); box(0.06, 0.18, 0.08, tailMat, -2.25, 0.78, z * 1.3); // Rücklicht in L-Form
        add(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 10), chrome, -2.28, 0.42, z * 0.85, 0, 0, Math.PI / 2); // Auspuff
      }
      box(0.18, 0.12, 1.3, black, -2.22, 0.42, 0);                                              // Diffusor
      box(0.3, 0.04, 1.4, paint, -2.08, 1.04, 0, 0.12);                                         // Abrisskante
      for (const z of [-0.93, 0.93]) box(2.4, 0.08, 0.06, black, 0, 0.4, z);                    // Seitenschweller
      mirrors(0.62, 1.08, 0.98);
      numberDecal(-0.25, 0.7, 0.925, 0.5);
      for (const [x, z, f] of [[1.35, 0.84, 1], [1.35, -0.84, 1], [-1.35, 0.84, 0], [-1.35, -0.84, 0]]) wheel(x, z, 0.44, 0.32, f);
      rims('modern', darkRim);
      return { seat: [-0.42, 0.62, 0.7], wheelR: 0.44, hoodCam: [0.95, 1.38], collide: { r: 1.05, off: 1.3 } };
    },

    // ---------- 90er Sportlimousine ----------
    sedan() {
      profile([[-2.25, 0.4], [-1.86, 0.4], [-1.35, 0.46, 0.5, 'arc'], [0.85, 0.4], [1.35, 0.46, 0.5, 'arc'], [2.2, 0.4],
        [2.3, 0.5], [2.3, 0.86], [2.2, 0.92], [1.0, 1.0], [-1.45, 1.03], [-2.2, 1.02], [-2.28, 0.92], [-2.28, 0.48]], 1.76, paint, 0.05);
      profile([[0.98, 0.99], [0.25, 1.47], [-0.95, 1.49], [-1.45, 1.02]], 1.5, glass, 0.04).castShadow = false;
      profile([[0.3, 1.43], [0.22, 1.51], [-0.97, 1.53], [-1.02, 1.44]], 1.48, paint, 0.03);
      for (const z of [-0.7, 0.7]) {
        tube([0.96, 1.0, z * 1.02], [0.26, 1.46, z * 0.99], 0.04, paint);
        box(0.12, 0.46, 0.05, black, -0.28, 1.24, z * 1.03);                                     // B-Säule schwarz
        tube([-1.43, 1.03, z * 1.02], [-0.92, 1.47, z * 0.99], 0.06, paint);
      }
      // Front: breite, rechteckige Lichter und Querstreben-Grill
      box(0.06, 0.18, 1.7, black, 2.31, 0.76, 0);                                                // dunkles Band
      for (const z of [-0.6, 0.6]) {
        box(0.07, 0.14, 0.42, headMat, 2.33, 0.76, z);
        box(0.07, 0.08, 0.14, amber, 2.33, 0.62, z * 1.38);                                       // Blinker
        box(0.07, 0.1, 0.22, headMat, 2.33, 0.5, z * 1.15);                                       // Nebellicht
        box(0.06, 0.16, 0.48, tailMat, -2.3, 0.82, z * 1.25); box(0.06, 0.16, 0.24, amber, -2.3, 0.82, z * 0.62);
      }
      for (let i = 0; i < 3; i++) box(0.08, 0.025, 0.5, chrome, 2.34, 0.71 + i * 0.05, 0);       // Grillstreben
      box(0.1, 0.12, 1.84, black, 2.3, 0.6, 0); box(0.1, 0.12, 1.84, black, -2.3, 0.6, 0);       // Stossstangen-Leisten
      for (const z of [-0.89, 0.89]) box(3.1, 0.08, 0.05, black, 0.1, 0.62, z);                   // Seiten-Schutzleiste
      add(new THREE.CylinderGeometry(0.055, 0.055, 0.18, 10), chrome, -2.3, 0.44, 0.55, 0, 0, Math.PI / 2);
      box(0.22, 0.03, 1.1, black, -2.12, 1.05, 0);                                                // kleine Kofferraumlippe
      mirrors(0.82, 1.06, 0.96);
      numberDecal(-0.3, 0.8, 0.895, 0.45);
      for (const [x, z, f] of [[1.35, 0.82, 1], [1.35, -0.82, 1], [-1.35, 0.82, 0], [-1.35, -0.82, 0]]) wheel(x, z, 0.42, 0.3, f);
      rims('mesh', rimMat);
      return { seat: [-0.42, 0.6, 0.74], wheelR: 0.42, hoodCam: [1.1, 1.42], collide: { r: 1.0, off: 1.3 } };
    },

    // ---------- 80er Turbo-Schrägheck ----------
    hatch() {
      profile([[-2.15, 0.44], [-1.82, 0.44], [-1.32, 0.48, 0.5, 'arc'], [0.85, 0.44], [1.35, 0.48, 0.5, 'arc'], [2.1, 0.44],
        [2.24, 0.56], [2.22, 0.78], [1.6, 0.9], [0.9, 1.02], [-1.7, 1.05], [-2.1, 0.98], [-2.18, 0.86], [-2.18, 0.52]], 1.72, paint, 0.1);
      profile([[0.92, 1.0], [0.42, 1.56], [-0.95, 1.6], [-1.85, 1.03]], 1.5, glass, 0.07).castShadow = false;
      profile([[0.47, 1.52], [0.39, 1.6], [-0.97, 1.64], [-1.05, 1.55]], 1.48, paint, 0.03);
      for (const z of [-0.7, 0.7]) {
        tube([0.9, 1.02, z * 1.02], [0.43, 1.55, z * 0.99], 0.05, paint);
        box(0.12, 0.5, 0.05, black, -0.25, 1.29, z * 1.03);
        tube([-1.8, 1.05, z * 1.02], [-0.98, 1.58, z * 0.99], 0.09, paint);                       // breite C-Säule
      }
      // dicke schwarze 80er-Stossstangen
      box(0.22, 0.24, 1.86, black, 2.18, 0.5, 0); box(0.22, 0.24, 1.86, black, -2.15, 0.52, 0);
      for (const z of [-0.6, 0.6]) {
        box(0.08, 0.16, 0.4, black, 2.21, 0.74, z); box(0.07, 0.12, 0.34, headMat, 2.24, 0.74, z);   // Lichter mit Rahmen
        box(0.06, 0.1, 0.12, amber, 2.24, 0.74, z * 1.45);
        box(0.06, 0.2, 0.44, tailMat, -2.2, 0.82, z * 1.18); box(0.06, 0.2, 0.18, amber, -2.2, 0.82, z * 0.62);
      }
      for (let i = 0; i < 4; i++) box(0.06, 0.03, 0.5, black, 2.24, 0.68 + i * 0.045, 0);          // Grill
      box(0.4, 0.05, 1.5, black, -1.98, 1.06, 0, -0.1);                                             // Heckspoiler
      for (const z of [-0.87, 0.87]) box(3.2, 0.12, 0.04, black, 0, 0.5, z);                         // Schutzleiste unten
      label('TURBO', -0.45, 0.62, 0.875, 0.8, 0.2, '#ffffff');
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 10), chrome, -2.2, 0.42, -0.5, 0, 0, Math.PI / 2);
      mirrors(0.86, 1.08, 0.94);
      numberDecal(0.45, 0.76, 0.875, 0.4);
      for (const [x, z, f] of [[1.35, 0.8, 1], [1.35, -0.8, 1], [-1.32, 0.8, 0], [-1.32, -0.8, 0]]) wheel(x, z, 0.42, 0.28, f);
      rims('turbine', rimMat);
      return { seat: [-0.4, 0.66, 0.78], wheelR: 0.42, hoodCam: [1.0, 1.5], collide: { r: 1.0, off: 1.25 } };
    }
  };

  const info = (builders[cfg.model] || builders.coupe)();
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
