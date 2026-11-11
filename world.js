// =====================================================
//  WELT-BAUER
//  Macht aus einer Strecke (tracks.js) und ihrem Thema (themes.js)
//  eine komplette 3D-Welt: Strasse, Gelände, Deko, Himmel, Licht.
// =====================================================
window.buildWorld = function (track, theme, Q) {
  Props.reset();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // Zufallszahlen, die bei jeder Strecke gleich bleiben (gleiche Bäume an gleicher Stelle)
  let seed = 7;
  for (const ch of track.id) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483646;
  seed = seed || 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const scene = new THREE.Scene();
  const W = track.width, edge = W / 2, CURB = 1.6;

  // ---------- 1. Mittellinie der Strasse (weiche Kurve durch die Eckpunkte) ----------
  const path = [];
  const P = track.points, n = P.length;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const steps = Math.max(4, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 5)); // etwa alle 5 m ein Punkt
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      path.push({ x: f(0), z: f(1), y: f(2) || 0 });
    }
  }
  const N = path.length;

  // Zu enge Kurven automatisch glätten (sonst falten sich Strasse und Randsteine)
  {
    const minR = edge + 5;
    const radius = i => {
      const a = path[(i - 2 + N) % N], b = path[i], c = path[(i + 2) % N];
      const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z), ca = Math.hypot(a.x - c.x, a.z - c.z);
      const area = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
      return area < 1e-6 ? 1e9 : ab * bc * ca / (4 * area);
    };
    for (let it = 0; it < 300; it++) {
      const tight = [];
      for (let i = 0; i < N; i++) if (radius(i) < minR) tight.push(i);
      if (!tight.length) break;
      const nx = path.map(p => ({ ...p }));
      for (const i of tight) for (let k = -3; k <= 3; k++) {
        const j = (i + k + N) % N, a = path[(j - 1 + N) % N], b = path[(j + 1) % N];
        nx[j].x = path[j].x * 0.5 + (a.x + b.x) / 4;
        nx[j].z = path[j].z * 0.5 + (a.z + b.z) / 4;
      }
      for (let i = 0; i < N; i++) path[i] = nx[i];
    }
  }

  // Wie gross muss die Welt sein? (wächst mit der Strecke)
  let maxX = 0, maxZ = 0;
  for (const p of path) { maxX = Math.max(maxX, Math.abs(p.x)); maxZ = Math.max(maxZ, Math.abs(p.z)); }
  const HX = Math.max(220, maxX + 90), HZ = Math.max(165, maxZ + 80);
  const areaScale = clamp((HX * HZ) / (220 * 165), 1, 2.2); // mehr Platz = mehr Deko

  const tang = [], norm = [], dist = [0];
  for (let i = 0; i < N; i++) {
    const a = path[(i - 1 + N) % N], b = path[(i + 1) % N];
    let tx = b.x - a.x, tz = b.z - a.z; const len = Math.hypot(tx, tz);
    tang.push({ x: tx / len, z: tz / len });
    norm.push({ x: -tz / len, z: tx / len });
    if (i > 0) dist.push(dist[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
  }
  const totalLen = dist[N - 1] + Math.hypot(path[0].x - path[N - 1].x, path[0].z - path[N - 1].z);

  // ---------- 2. Wo bin ich auf der Strasse? ----------
  function roadInfo(x, z) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < N; i++) {
      const dx = path[i].x - x, dz = path[i].z - z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    let res = null;
    for (const [a, b] of [[best, (best + 1) % N], [(best - 1 + N) % N, best]]) {
      const A = path[a], Bp = path[b];
      const ex = Bp.x - A.x, ez = Bp.z - A.z, len2 = ex * ex + ez * ez;
      const t = ((x - A.x) * ex + (z - A.z) * ez) / len2;
      if (t < 0 || t > 1) continue;
      const d = Math.hypot(x - (A.x + ex * t), z - (A.z + ez * t));
      if (!res || d < res.dist) res = { index: best, dist: d, y: A.y + (Bp.y - A.y) * t };
    }
    return res || { index: best, dist: Math.sqrt(bd), y: path[best].y };
  }

  // ---------- 3. Gelände-Höhe: folgt der Strasse, weiter weg Hügel ----------
  const noise = (x, z) => Math.sin(x * 0.021 + 1.7) * Math.cos(z * 0.027) * 0.6 +
    Math.sin(x * 0.053 - z * 0.041 + 0.4) * 0.3 + Math.sin(z * 0.09 + x * 0.013) * 0.15 + 0.25;

  function terrainInfo(x, z) {
    let sw = 0, sy = 0, dmin2 = Infinity, best = 0;
    for (let i = 0; i < N; i++) {
      const p = path[i], dx = p.x - x, dz = p.z - z, d2 = dx * dx + dz * dz;
      if (d2 < dmin2) { dmin2 = d2; best = i; }
      const w = 1 / ((d2 + 40) * (d2 + 40));
      sw += w; sy += w * p.y;
    }
    let h = sy / sw;
    const dmin = Math.sqrt(dmin2);
    h += noise(x, z) * (theme.hills || 0) * clamp((dmin - edge - 12) / 70, 0, 1);
    // Direkt neben der Strasse liegt das Gelände immer etwas tiefer als die Fahrbahn
    const roadY = Math.min(path[best].y, path[(best + 1) % N].y, path[(best - 1 + N) % N].y) - 0.3;
    h = h + (Math.min(h, roadY) - h) * (1 - smooth(edge + CURB + 1, edge + 10, dmin));
    if (theme.shoreZ != null) h -= clamp((z - theme.shoreZ) * 0.18, 0, 7);
    const e = Math.max(clamp((Math.abs(x) - (HX - 40)) / 50, 0, 1), clamp((Math.abs(z) - (HZ - 40)) / 50, 0, 1));
    const edgeH = (theme.shoreZ != null && z > 0) ? -7 : 0;
    return { h: h * (1 - e) + edgeH * e, dmin };
  }
  const terrainHeight = (x, z) => terrainInfo(x, z).h;

  // Höhe an jeder Stelle (Strasse oder Gelände)
  function surfaceHeight(x, z) {
    const r = roadInfo(x, z);
    return r.dist < edge + CURB ? r.y + 0.05 : terrainHeight(x, z);
  }

  // ---------- Kollisionen: feste Objekte in einem Raster speichern ----------
  const CELL = 12, grid = new Map();
  const cellKey = (ix, iz) => ix * 100000 + iz;
  function addCollider(c) {
    const ex = c.r || Math.max(c.hx, c.hz);
    for (let ix = Math.floor((c.x - ex) / CELL); ix <= Math.floor((c.x + ex) / CELL); ix++)
      for (let iz = Math.floor((c.z - ex) / CELL); iz <= Math.floor((c.z + ex) / CELL); iz++) {
        const k = cellKey(ix, iz);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(c);
      }
  }
  // Prüft einen Kreis (x, z, Radius r). Gibt zurück, wie weit er hinausgeschoben werden muss.
  function collide(x, z, r) {
    let px = 0, pz = 0, hit = false;
    const seen = new Set();
    for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++)
      for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++) {
        const list = grid.get(cellKey(ix, iz));
        if (!list) continue;
        for (const c of list) {
          if (seen.has(c)) continue; seen.add(c);
          let dx, dz, d, min;
          if (c.r) { dx = x - c.x; dz = z - c.z; min = r + c.r; d = Math.hypot(dx, dz); }
          else { // Rechteck (Haus)
            const qx = clamp(x, c.x - c.hx, c.x + c.hx), qz = clamp(z, c.z - c.hz, c.z + c.hz);
            dx = x - qx; dz = z - qz; d = Math.hypot(dx, dz); min = r;
            if (d < 1e-6) { // Mittelpunkt im Haus: zur nächsten Wand hinaus
              const ox = c.hx - Math.abs(x - c.x), oz = c.hz - Math.abs(z - c.z);
              if (ox < oz) { dx = Math.sign(x - c.x) || 1; dz = 0; d = -ox; } else { dz = Math.sign(z - c.z) || 1; dx = 0; d = -oz; }
              px += dx * (r - d); pz += dz * (r - d); hit = true; continue;
            }
          }
          if (d < min) { const k = (min - d) / (d || 1); px += dx * k; pz += dz * k; hit = true; }
        }
      }
    return hit ? { x: px, z: pz } : null;
  }
  // Wie dick sind die festen Teile der Deko? (Radius bei Grösse 1)
  const SOLID = { pine: 0.6, snowpine: 0.6, tree: 0.6, rock: 1.25, cactus: 0.7, palm: 0.45, umbrella: 0.15, snowman: 1.0, lamp: 0.3 };

  // ---------- 4. Gelände-Mesh ----------
  {
    const TW = 2 * HX + 40, TD = 2 * HZ + 40;
    const g = new THREE.PlaneGeometry(TW, TD, Math.round(TW / Q.terrainRes), Math.round(TD / Q.terrainRes));
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, colors = [];
    const c1 = new THREE.Color(theme.ground), c2 = new THREE.Color(theme.groundVar), tmp = new THREE.Color();
    const sand = theme.sand && new THREE.Color(theme.sand), wet = new THREE.Color('#c2a873');
    const rockC = theme.rock && new THREE.Color(theme.rock), side = theme.sidewalk && new THREE.Color(theme.sidewalk);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), t = terrainInfo(x, z);
      pos.setY(i, t.h);
      tmp.copy(c1).lerp(c2, rnd());
      if (sand) { tmp.lerp(sand, smooth(theme.shoreZ - 32, theme.shoreZ - 16, z)); if (t.h < -0.7) tmp.lerp(wet, 0.6); }
      if (rockC) tmp.lerp(rockC, smooth(theme.rockAbove, theme.rockAbove + 10, t.h));
      if (side) tmp.lerp(side, 1 - smooth(edge + 3, edge + 6, t.dmin));
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0 }));
    mesh.receiveShadow = true;
    scene.add(mesh);

    if (theme.shoreZ != null) {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshPhongMaterial({
        color: '#1e88c8', shininess: 90, specular: '#bbbbbb', transparent: true, opacity: 0.88 }));
      water.rotation.x = -Math.PI / 2; water.position.y = -0.6;
      scene.add(water);
    } else {
      const outer = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: theme.groundVar }));
      outer.rotation.x = -Math.PI / 2; outer.position.y = -0.35;
      scene.add(outer);
    }
  }

  // ---------- 5. Strasse ----------
  function roadTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = theme.road; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.13)' : 'rgba(255,255,255,.07)';
      g.fillRect(rnd() * 128, rnd() * 256, 1.5, 1.5);
    }
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(5, 0, 3, 256); g.fillRect(120, 0, 3, 256);
    g.fillStyle = theme.roadLine; g.fillRect(62, 0, 4, 128);
    const t = new THREE.CanvasTexture(c);
    t.wrapT = THREE.RepeatWrapping; t.anisotropy = Q.aniso;
    return t;
  }
  {
    const vScale = Math.max(1, Math.round(totalLen / 16)) / totalLen;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const k = i % N, p = path[k], nn = norm[k], v = (i === N ? totalLen : dist[k]) * vScale;
      pos.push(p.x - nn.x * edge, p.y + 0.05, p.z - nn.z * edge, p.x + nn.x * edge, p.y + 0.05, p.z + nn.z * edge);
      uv.push(0, v, 1, v);
      if (i < N) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const road = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: roadTexture(), side: THREE.DoubleSide }));
    road.receiveShadow = true;
    scene.add(road);
  }
  // Randsteine
  {
    const pos = [], col = [];
    const cA = new THREE.Color(theme.curb[0]), cB = new THREE.Color(theme.curb[1]);
    const off = (i, d) => [path[i].x + norm[i].x * d, path[i].y + 0.09, path[i].z + norm[i].z * d];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, c = Math.floor(i / 2) % 2 ? cA : cB;
      for (const sgn of [-1, 1]) {
        const a = off(i, sgn * edge), b = off(i, sgn * (edge + CURB)), cc = off(j, sgn * edge), d = off(j, sgn * (edge + CURB));
        for (const p of [a, cc, b, b, cc, d]) { pos.push(...p); col.push(c.r, c.g, c.b); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    scene.add(m);
  }

  // Flecken auf der Strasse (Eis, Pfützen, Sand, Schlamm)
  for (const pt of track.patches || []) {
    const sf = SURFACES[pt.surface];
    if (!sf || !sf.patch) continue;
    const a = Math.floor(pt.from * N), b = Math.ceil(pt.to * N);
    const pos = [], idx = [];
    for (let ii = a, k = 0; ii <= b; ii++, k++) {
      const i = ((ii % N) + N) % N, p = path[i], nn = norm[i];
      const fade = 0.55 + 0.4 * Math.sin(Math.PI * (ii - a) / (b - a)); // Enden laufen spitz zu
      const wl = edge * fade * (0.85 + 0.15 * Math.sin(ii * 1.7)), wr = edge * fade * (0.85 + 0.15 * Math.cos(ii * 2.3));
      pos.push(p.x - nn.x * wl, p.y + 0.07, p.z - nn.z * wl, p.x + nn.x * wr, p.y + 0.07, p.z + nn.z * wr);
      if (ii < b) { const q = 2 * k; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({
      color: sf.patch.color, transparent: true, opacity: sf.patch.opacity, shininess: sf.patch.shininess, specular: '#ffffff',
      depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true;
    scene.add(m);
  }

  // ---------- 6. Start/Ziel ----------
  {
    const cv = document.createElement('canvas'); cv.width = 20; cv.height = 4;
    const c = cv.getContext('2d');
    for (let x = 0; x < 10; x++) for (let y = 0; y < 2; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 2, y * 2, 2, 2); }
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter;
    const p = path[0], t = tang[0], nn = norm[0], L = 3, y = p.y + 0.11;
    const A = [p.x - nn.x * edge, y, p.z - nn.z * edge], Bq = [p.x + nn.x * edge, y, p.z + nn.z * edge];
    const Cq = [A[0] + t.x * L, y, A[2] + t.z * L], Dq = [Bq[0] + t.x * L, y, Bq[2] + t.z * L];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...Cq, ...Bq, ...Bq, ...Cq, ...Dq], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1], 2));
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })));

    const postMat = Props.M('#eeeeee');
    for (const sgn of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 10, 10), postMat);
      post.position.set(p.x + nn.x * sgn * (edge + 3), p.y + 4.5, p.z + nn.z * sgn * (edge + 3));
      post.castShadow = true;
      scene.add(post);
      addCollider({ x: post.position.x, z: post.position.z, r: 0.6 });
    }
    const bc = document.createElement('canvas'); bc.width = 512; bc.height = 64;
    const bx = bc.getContext('2d');
    bx.fillStyle = theme.banner; bx.fillRect(0, 0, 512, 64);
    bx.fillStyle = '#fff'; bx.font = 'bold 44px system-ui, sans-serif'; bx.textAlign = 'center'; bx.textBaseline = 'middle';
    bx.fillText('START  ·  ZIEL', 256, 34);
    const bannerMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(W + 6, 2, 0.4), [postMat, postMat, postMat, postMat, bannerMat, bannerMat]);
    banner.position.set(p.x, p.y + 9, p.z);
    banner.rotation.y = -Math.atan2(nn.z, nn.x);
    banner.castShadow = true;
    scene.add(banner);
  }

  // ---------- 7. Deko verteilen ----------
  const dummy = new THREE.Object3D();
  function addInstances(parts, items) {
    if (!items.length) return;
    for (const part of parts) {
      const mesh = new THREE.InstancedMesh(part.geo, part.mat, items.length);
      items.forEach((it, k) => {
        dummy.position.set(it.x, it.y, it.z);
        dummy.rotation.set(0, it.ry || 0, 0);
        dummy.scale.set(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);
        if (part.tint) mesh.setColorAt(k, new THREE.Color(it.colors[part.tint]));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false; // wichtig bei Instancing, sonst verschwinden Objekte
      mesh.castShadow = Q.shadows && part.cast !== false;
      mesh.receiveShadow = !!part.receive;
      scene.add(mesh);
    }
  }
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const PAL = {
    wallDay: ['#d9d4c7', '#b8c4cf', '#c9a98a', '#9aa7b5', '#e0c9a6'],
    wallNight: ['#707888', '#5f6a80', '#7a6a86', '#55657c'],
    neon: ['#ff2bd6', '#00e5ff', '#b388ff', '#76ff03', '#ffea00'],
    canopy: ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#ffffff', '#ff7043']
  };

  for (const def of theme.props) {
    if (def.along) { // Strassenlaternen entlang der Strecke
      const lamps = [], glows = [];
      for (let i = 0, k = 0; i < N; i += def.along, k++) {
        const sgn = k % 2 ? 1 : -1, p = path[i], nn = norm[i];
        const dir = { x: -nn.x * sgn, z: -nn.z * sgn };
        lamps.push({ x: p.x + nn.x * sgn * (edge + 2.5), y: p.y, z: p.z + nn.z * sgn * (edge + 2.5), ry: -Math.atan2(dir.z, dir.x) });
        glows.push({ x: p.x + nn.x * sgn * (edge - 3), y: p.y + 0.12, z: p.z + nn.z * sgn * (edge - 3), s: 1 });
      }
      addInstances(Props.build({ type: 'lamp' }), lamps);
      for (const l of lamps) addCollider({ x: l.x, z: l.z, r: SOLID.lamp });
      const gc = document.createElement('canvas'); gc.width = gc.height = 64;
      const gx = gc.getContext('2d'), grad = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,220,140,0.55)'); grad.addColorStop(1, 'rgba(255,220,140,0)');
      gx.fillStyle = grad; gx.fillRect(0, 0, 64, 64);
      const gg = new THREE.PlaneGeometry(14, 14); gg.rotateX(-Math.PI / 2);
      addInstances([{ geo: gg, mat: new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), cast: false }], glows);
      continue;
    }
    const count = Math.round(def.count * Q.propScale * areaScale);
    const minD = edge + (def.minDist != null ? def.minDist : 6);
    const maxD = def.maxDist != null ? edge + def.maxDist : Infinity;
    const items = [];
    for (let tries = 0; items.length < count && tries < count * 50; tries++) {
      const x = (rnd() * 2 - 1) * (HX - 15), z = (rnd() * 2 - 1) * (HZ - 15);
      if (theme.shoreZ != null) {
        if (def.nearShore) { if (z < theme.shoreZ - 24 || z > theme.shoreZ - 6) continue; }
        else if (z > theme.shoreZ - 8) continue;
      }
      if (def.type === 'building' && items.some(o => Math.abs(o.x - x) < 15 && Math.abs(o.z - z) < 15)) continue;
      const t = terrainInfo(x, z);
      if (t.dmin < minD || t.dmin > maxD) continue;
      if (def.type === 'building') {
        const s = 0.9 + rnd() * 0.4;
        items.push({ x, y: t.h - 1, z, ry: rnd() < 0.5 ? 0 : Math.PI / 2, sx: s, sy: 1, sz: 0.9 + rnd() * 0.4,
          colors: { wall: pick(theme.night ? PAL.wallNight : PAL.wallDay), neon: pick(PAL.neon) } });
      } else {
        items.push({ x, y: t.h - 0.1, z, ry: rnd() * Math.PI * 2, s: 0.75 + rnd() * 0.6, colors: { canopy: pick(PAL.canopy) } });
      }
    }
    for (const it of items) {
      if (def.type === 'building') {
        const turned = Math.abs(it.ry) > 0.1; // 0 oder 90 Grad gedreht
        addCollider({ x: it.x, z: it.z, hx: 5 * (turned ? it.sz : it.sx), hz: 5 * (turned ? it.sx : it.sz) });
      } else if (SOLID[def.type]) addCollider({ x: it.x, z: it.z, r: SOLID[def.type] * it.s });
    }
    if (def.type === 'building') {
      // 4 verschiedene Haushöhen, damit die Fenster nicht verzerrt sind
      const heights = [14, 24, 38, 56];
      heights.forEach((H, hi) => addInstances(Props.building(H, !!theme.night), items.filter((_, k) => k % heights.length === hi)));
    } else {
      addInstances(Props.build(def, !!theme.night), items);
    }
  }
  for (const m of Props.backdrop(theme.backdrop, theme, rnd, Math.max(HX / 220, HZ / 165))) scene.add(m);

  // ---------- 8. Himmel, Nebel, Sonne, Sterne ----------
  scene.background = new THREE.Color(theme.skyBottom);
  const fogScale = clamp(Math.max(HX / 220, HZ / 165), 1, 1.5);
  scene.fog = new THREE.Fog(theme.skyBottom, theme.fog[0] * fogScale, theme.fog[1] * fogScale);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(theme.skyTop) }, bottom: { value: new THREE.Color(theme.skyBottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.55)), 1.0); }'
  }));
  sky.renderOrder = -1;
  scene.add(sky);

  const sunDir = new THREE.Vector3(...theme.sunDir).normalize();
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sx = sc.getContext('2d'), sg = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
  sg.addColorStop(0, 'rgba(255,255,240,1)'); sg.addColorStop(0.25, 'rgba(255,250,220,0.9)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
  sx.fillStyle = sg; sx.fillRect(0, 0, 128, 128);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), fog: false, depthWrite: false, transparent: true }));
  sunSprite.scale.setScalar(theme.night ? 50 : 150);
  scene.add(sunSprite);

  let stars = null;
  if (theme.night) {
    const sp = [];
    for (let i = 0; i < 700; i++) {
      const a = rnd() * Math.PI * 2, e = 0.08 + rnd() * 1.4;
      sp.push(Math.cos(a) * Math.cos(e) * 900, Math.sin(e) * 900, Math.sin(a) * Math.cos(e) * 900);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false }));
    scene.add(stars);
  }

  // ---------- 9. Licht ----------
  const hemi = new THREE.HemisphereLight(new THREE.Color(theme.skyTop).lerp(new THREE.Color('#ffffff'), 0.5), theme.hemiGround, theme.ambient);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(theme.sun, theme.sunIntensity);
  sun.castShadow = Q.shadows;
  sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 320 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---------- 10. Schneefall ----------
  let snow = null;
  if (theme.snowfall) {
    const cnt = Q.snowCount, sp = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) { sp[i * 3] = (rnd() - 0.5) * 120; sp[i * 3 + 1] = rnd() * 40; sp[i * 3 + 2] = (rnd() - 0.5) * 120; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    snow = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.35, transparent: true, opacity: 0.9, depthWrite: false }));
    snow.frustumCulled = false;
    scene.add(snow);
  }

  // Wird jedes Bild aufgerufen
  let time = 0;
  function update(dt, cam, carPos) {
    time += dt;
    sky.position.copy(cam.position);
    if (stars) stars.position.copy(cam.position);
    sunSprite.position.copy(cam.position).addScaledVector(sunDir, 900);
    sun.position.copy(carPos).addScaledVector(sunDir, 150);
    sun.target.position.copy(carPos);
    if (snow) {
      const a = snow.geometry.attributes.position.array, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
      for (let i = 0; i < a.length; i += 3) {
        a[i + 1] -= (3 + (i % 7) * 0.4) * dt;
        a[i] += Math.sin(time + i) * 0.6 * dt;
        if (a[i + 1] < cy - 12) a[i + 1] += 40;
        if (a[i] < cx - 60) a[i] += 120; else if (a[i] > cx + 60) a[i] -= 120;
        if (a[i + 2] < cz - 60) a[i + 2] += 120; else if (a[i + 2] > cz + 60) a[i + 2] -= 120;
      }
      snow.geometry.attributes.position.needsUpdate = true;
    }
  }

  // Grenzen für die Minikarte
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const p of path) { bounds.minX = Math.min(bounds.minX, p.x); bounds.maxX = Math.max(bounds.maxX, p.x); bounds.minZ = Math.min(bounds.minZ, p.z); bounds.maxZ = Math.max(bounds.maxZ, p.z); }

  return { scene, path, N, W, edge, CURB, tang, norm, roadInfo, terrainHeight, surfaceHeight, collide, update, bounds, limits: { x: HX - 12, z: HZ - 12 }, size: Math.max(HX, HZ), theme, track };
};
