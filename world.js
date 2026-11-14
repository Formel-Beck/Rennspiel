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
  for (const rv of track.rivers || []) for (const p of rv.points) { maxX = Math.max(maxX, Math.abs(p[0]) - 40); maxZ = Math.max(maxZ, Math.abs(p[1]) - 40); }
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

  // ---------- Raster der Strassenpunkte (macht grosse Welten schnell) ----------
  const PG = 40, pathGrid = new Map();
  path.forEach((p, i) => {
    const k = Math.floor(p.x / PG) * 100000 + Math.floor(p.z / PG);
    if (!pathGrid.has(k)) pathGrid.set(k, []);
    pathGrid.get(k).push(i);
  });
  const meanY = path.reduce((a, p) => a + p.y, 0) / N;

  // ---------- Tunnel (Abschnitte der Strecke, from/to = Anteil der Runde) ----------
  const inTunnel = new Uint8Array(N);
  for (const t of track.tunnels || []) {
    for (let i = Math.floor(t.from * N); i <= Math.ceil(t.to * N); i++) inTunnel[((i % N) + N) % N] = 1;
  }
  const nearTunnel = new Uint8Array(N); // Tunnel + etwas Rand (dort bleibt der Berg über der Strasse)
  for (let i = 0; i < N; i++) if (inTunnel[i]) for (let k = -1; k <= 1; k++) nearTunnel[(i + k + N) % N] = 1;

  // ---------- Flüsse ----------
  const rivers = (track.rivers || []).map(rv => ({ pts: rv.points.map(p => ({ x: p[0], z: p[1], y: p[2] })), w: rv.width || 22 }));
  // Abstand zum nächsten Fluss und Wasserhöhe dort
  function riverInfo(x, z) {
    let best = null;
    for (const rv of rivers) for (let i = 0; i < rv.pts.length - 1; i++) {
      const A = rv.pts[i], B = rv.pts[i + 1], ex = B.x - A.x, ez = B.z - A.z, L2 = ex * ex + ez * ez;
      const t = clamp(((x - A.x) * ex + (z - A.z) * ez) / L2, 0, 1);
      const d = Math.hypot(x - (A.x + ex * t), z - (A.z + ez * t));
      if (!best || d < best.d) best = { d, y: A.y + (B.y - A.y) * t, w: rv.w };
    }
    return best;
  }

  // ---------- Gelände-Höhe ----------
  // Folgt der Strasse; weiter weg Hügel und Berge; Flüsse graben ein Bett.
  function terrainInfo(x, z) {
    let sw = 0, sy = 0, dmin2 = Infinity, best = -1;
    const gx = Math.floor(x / PG), gz = Math.floor(z / PG);
    for (let ix = gx - 4; ix <= gx + 4; ix++) for (let iz = gz - 4; iz <= gz + 4; iz++) {
      const list = pathGrid.get(ix * 100000 + iz); if (!list) continue;
      for (const i of list) {
        const p = path[i], dx = p.x - x, dz = p.z - z, d2 = dx * dx + dz * dz;
        if (d2 < dmin2) { dmin2 = d2; best = i; }
        const w = 1 / ((d2 + 40) * (d2 + 40));
        sw += w; sy += w * p.y;
      }
    }
    const dmin = best < 0 ? 999 : Math.sqrt(dmin2);
    let h = best < 0 ? meanY : sy / sw;
    h += (meanY - h) * smooth(90, 160, dmin);              // ganz weit weg: mittlere Höhe
    let away = clamp((dmin - edge - 12) / 70, 0, 1);
    let rv = null;
    if (rivers.length) { rv = riverInfo(x, z); if (rv) away *= smooth(rv.w / 2, rv.w / 2 + 60, rv.d); }
    h += noise(x, z) * (theme.hills || 0) * away;
    // Berge
    const tun = best >= 0 && nearTunnel[best];
    for (const m of track.mountains || []) {
      const d = Math.hypot(x - m[0], z - m[1]), r = m[2];
      if (d >= r) continue;
      const f = Math.pow(1 - d / r, 1.3); // spitz zulaufend
      h += m[3] * f * (tun ? 1 : clamp((dmin - edge - 4) / 24, 0, 1)) * (0.85 + 0.15 * noise(x * 3, z * 3));
    }
    // Flussbett
    if (rv) {
      if (rv.d < rv.w / 2 + 16) h += (Math.min(h, rv.y - 2.2) - h) * (1 - smooth(rv.w / 2 - 2, rv.w / 2 + 16, rv.d));
    }
    // Direkt neben der Strasse liegt das Gelände immer etwas tiefer als die Fahrbahn.
    // Beim Tunnel nur ein schmaler Einschnitt – darin liegt die Tunnelröhre.
    if (best >= 0) {
      const roadY = Math.min(path[best].y, path[(best + 1) % N].y, path[(best - 1 + N) % N].y) - 0.3;
      h = h + (Math.min(h, roadY) - h) * (1 - (tun ? smooth(edge + 12, edge + 20, dmin) : smooth(edge + CURB + 1, edge + 10, dmin)));
    }
    if (theme.shoreZ != null) h -= clamp((z - theme.shoreZ) * 0.18, 0, 7);
    const e = Math.max(clamp((Math.abs(x) - (HX - 40)) / 50, 0, 1), clamp((Math.abs(z) - (HZ - 40)) / 50, 0, 1));
    const edgeH = (theme.shoreZ != null && z > 0) ? -7 : meanY * 0.5;
    return { h: h * (1 - e) + edgeH * e, dmin, best };
  }
  // Wasserhöhe an dieser Stelle (oder null, wenn kein Wasser)
  function waterAt(x, z) {
    if (theme.shoreZ != null && terrainInfo(x, z).h < -0.6) return -0.6;
    if (!rivers.length) return null;
    const rv = riverInfo(x, z);
    return rv && rv.d < rv.w / 2 + 2 ? rv.y : null;
  }
  const terrainHeight = (x, z) => terrainInfo(x, z).h;

  // Höhe an jeder Stelle (Strasse oder Gelände)
  function surfaceHeight(x, z) {
    const r = roadInfo(x, z);
    if (r.dist < edge + CURB) return r.y + 0.05;
    const h = terrainHeight(x, z);
    if (rivers.length) { const w = waterAt(x, z); if (w != null && h < w - 0.35) return w - 0.35; } // im Fluss: Auto schwimmt halb
    return h;
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
  const SOLID = { pine: 0.6, snowpine: 0.6, tree: 0.6, rock: 1.25, cactus: 0.7, palm: 0.45, umbrella: 0.15, snowman: 1.0, lamp: 0.3, lolli: 0.3 };

  // ---------- 4. Gelände-Mesh ----------
  {
    const TW = 2 * HX + 40, TD = 2 * HZ + 40;
    const res = Math.max(Q.terrainRes, Math.sqrt(TW * TD / Q.terrainMaxVerts)); // grosse Welten: gröbere Kästchen
    const g = new THREE.PlaneGeometry(TW, TD, Math.round(TW / res), Math.round(TD / res));
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, colors = [];
    const c1 = new THREE.Color(theme.ground), c2 = new THREE.Color(theme.groundVar), tmp = new THREE.Color();
    const sand = theme.sand && new THREE.Color(theme.sand), wet = new THREE.Color('#c2a873');
    const snowC = new THREE.Color('#f4f8fc'), bankC = new THREE.Color('#b9a98a');
    const rockC = theme.rock && new THREE.Color(theme.rock), side = theme.sidewalk && new THREE.Color(theme.sidewalk);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), t = terrainInfo(x, z);
      pos.setY(i, t.h);
      tmp.copy(c1).lerp(c2, rnd());
      if (sand) { tmp.lerp(sand, smooth(theme.shoreZ - 32, theme.shoreZ - 16, z)); if (t.h < -0.7) tmp.lerp(wet, 0.6); }
      if (rockC) tmp.lerp(rockC, smooth(theme.rockAbove, theme.rockAbove + 10, t.h));
      if (theme.snowAbove != null) tmp.lerp(snowC, smooth(theme.snowAbove, theme.snowAbove + 8, t.h + noise(x * 2, z * 2) * 6));
      if (rivers.length) { const rv = riverInfo(x, z); if (rv && rv.d < rv.w / 2 + 7) tmp.lerp(bankC, 0.7); } // Ufer: Kies
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

  let roadMat = null;
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
    roadMat = new THREE.MeshPhongMaterial({ map: roadTexture(), side: THREE.DoubleSide, shininess: 4, specular: '#111111' });
    const road = new THREE.Mesh(g, roadMat);
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
    let arrowTex = null;
    if (sf.patch.arrows) { // Turbo-Feld: leuchtende Pfeile
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const x = c.getContext('2d'); x.fillStyle = '#ff9800'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#fff59d'; x.beginPath(); x.moveTo(8, 44); x.lineTo(32, 16); x.lineTo(56, 44); x.lineTo(44, 44); x.lineTo(32, 30); x.lineTo(20, 44); x.fill();
      arrowTex = new THREE.CanvasTexture(c); arrowTex.wrapS = arrowTex.wrapT = THREE.RepeatWrapping;
      const uv = [];
      for (let ii = a, k = 0; ii <= b; ii++, k++) { const v = (ii - a) * 5 / 6; uv.push(0, v, 3, v); } // Pfeile zeigen in Fahrtrichtung
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }
    const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({
      map: arrowTex, emissive: arrowTex ? '#ff6d00' : '#000000', emissiveMap: arrowTex,
      color: arrowTex ? '#ffffff' : sf.patch.color, transparent: true, opacity: sf.patch.opacity, shininess: sf.patch.shininess, specular: '#ffffff',
      depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true;
    scene.add(m);
  }

  const dummy = new THREE.Object3D();
  // ---------- Flüsse: Wasseroberfläche ----------
  if (rivers.length) {
    const wmat = new THREE.MeshPhongMaterial({ color: '#2a8fd6', shininess: 100, specular: '#cccccc', transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    for (const rv of rivers) {
      // Fluss in kleine Stücke teilen, damit er weich aussieht
      const pts = [];
      for (let i = 0; i < rv.pts.length - 1; i++) {
        const A = rv.pts[i], B = rv.pts[i + 1], n = Math.max(1, Math.round(Math.hypot(B.x - A.x, B.z - A.z) / 8));
        for (let k = 0; k < n; k++) { const t = k / n; pts.push({ x: A.x + (B.x - A.x) * t, z: A.z + (B.z - A.z) * t, y: A.y + (B.y - A.y) * t }); }
      }
      pts.push(rv.pts[rv.pts.length - 1]);
      const pos = [], idx = [], hw = rv.w / 2 + 3;
      pts.forEach((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
        pos.push(p.x - nx * hw, p.y, p.z - nz * hw, p.x + nx * hw, p.y, p.z + nz * hw);
        if (i < pts.length - 1) { const q = 2 * i; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, wmat); m.receiveShadow = true;
      scene.add(m);
    }
  }

  // ---------- Tunnel: Röhre mit Lampen und Portalen ----------
  for (const t of track.tunnels || []) {
    const a = Math.floor(t.from * N), b = Math.ceil(t.to * N), SEG = 10, rx = edge + 2.5, ry = 8.5;
    const pos = [], idx = [], lamps = [];
    let k = 0;
    for (let ii = a; ii <= b; ii++, k++) {
      const i = ((ii % N) + N) % N, p = path[i], n = norm[i];
      for (let s2 = 0; s2 <= SEG; s2++) {
        const ang = Math.PI * s2 / SEG, c = Math.cos(ang), sn = Math.sin(ang);
        pos.push(p.x + n.x * c * rx, p.y - 0.4 + sn * ry, p.z + n.z * c * rx);
      }
      if (ii < b) for (let s2 = 0; s2 < SEG; s2++) { const q = k * (SEG + 1) + s2; idx.push(q, q + SEG + 1, q + 1, q + 1, q + SEG + 1, q + SEG + 2); }
      if ((ii - a) % 3 === 0) lamps.push({ x: p.x, y: p.y - 0.6 + ry, z: p.z, ry: -Math.atan2(tang[i].z, tang[i].x) });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const tube = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: '#3d3935', emissive: '#24201c', side: THREE.DoubleSide }));
    tube.castShadow = true; tube.receiveShadow = true;
    scene.add(tube);
    // Felsdach über der Röhre: schliesst den Einschnitt im Berg von oben
    {
      const rp = [], rc = [], ri = [], RW = edge + 24, cols = [new THREE.Color(theme.groundVar), new THREE.Color(theme.rock || '#8f8478')];
      let kk = 0;
      for (let ii = a; ii <= b; ii++, kk++) {
        const i = ((ii % N) + N) % N, p = path[i], n = norm[i];
        const hl = terrainHeight(p.x - n.x * RW, p.z - n.z * RW), hr = terrainHeight(p.x + n.x * RW, p.z + n.z * RW);
        const top = Math.max(p.y + ry + 0.6, (hl + hr) / 2);
        for (const [o, hh] of [[-RW, hl], [-rx * 1.1, Math.max(top, hl * 0.5 + top * 0.5)], [0, top], [rx * 1.1, Math.max(top, hr * 0.5 + top * 0.5)], [RW, hr]]) {
          rp.push(p.x + n.x * o, hh, p.z + n.z * o);
          const c = cols[0].clone().lerp(cols[1], clamp((hh - (theme.rockAbove || 60)) / 10, 0, 1));
          rc.push(c.r, c.g, c.b);
        }
        if (ii < b) for (let s2 = 0; s2 < 4; s2++) { const q = kk * 5 + s2; ri.push(q, q + 1, q + 5, q + 1, q + 6, q + 5); }
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
      rg.setIndex(ri); rg.computeVertexNormals();
      const roof = new THREE.Mesh(rg, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, side: THREE.DoubleSide }));
      roof.receiveShadow = true; roof.castShadow = true;
      scene.add(roof);
    }
    // Lampen an der Decke
    const lg = new THREE.BoxGeometry(2.4, 0.15, 0.5), lm = new THREE.MeshBasicMaterial({ color: '#ffe8a8' });
    const lampMesh = new THREE.InstancedMesh(lg, lm, lamps.length);
    lamps.forEach((l, j) => { dummy.position.set(l.x, l.y, l.z); dummy.rotation.set(0, l.ry, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); lampMesh.setMatrixAt(j, dummy.matrix); });
    lampMesh.frustumCulled = false;
    scene.add(lampMesh);
    // Portale aus Stein an beiden Enden
    const stone = new THREE.MeshPhongMaterial({ color: '#8d8478', flatShading: true });
    for (const ii of [a, b]) {
      const i = ((ii % N) + N) % N, p = path[i], n = norm[i], yaw = -Math.atan2(n.z, n.x);
      const arch = new THREE.Mesh(new THREE.TorusGeometry((rx + ry) / 2 + 0.6, 1.4, 6, 14, Math.PI), stone);
      arch.scale.set(rx / ((rx + ry) / 2), ry / ((rx + ry) / 2), 1);
      arch.position.set(p.x, p.y - 0.4, p.z); arch.rotation.y = yaw;
      arch.castShadow = true; scene.add(arch);
    }
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

  // ---------- Zuschauer und Tribünen ----------
  const crowd = []; // { x, y, z, ry, s, ph }
  {
    const concrete = Props.M('#9ea3a8'), seat = Props.M('#d0d4d8');
    // Tribünen links und rechts, kurz nach der Start-/Ziellinie
    const c = Math.min(Math.round(28 / (totalLen / N)), Math.floor(N * 0.05)), p = path[c], t = tang[c], n = norm[c]; // etwa 28 m hinter der Ziellinie
    for (const sgn of [1, -1]) {
      const L = Math.min(34, world_W_len()), base = edge + CURB + 5;
      for (let r = 0; r < 4; r++) {
        const off = base + r * 2.2, h = 0.7 * (r + 1);
        const step = new THREE.Mesh(new THREE.BoxGeometry(L, h, 2.2), r % 2 ? seat : concrete);
        const cx = p.x + n.x * sgn * off, cz = p.z + n.z * sgn * off;
        step.position.set(cx, p.y - 0.3 + h / 2, cz);
        step.rotation.y = -Math.atan2(t.z, t.x);
        step.castShadow = true; step.receiveShadow = true;
        scene.add(step);
        for (let k = -L / 2 + 1.5; k <= L / 2 - 1.5; k += 3) addCollider({ x: cx + t.x * k, z: cz + t.z * k, r: 1.4 });
        // Leute auf der Stufe
        for (let k = -L / 2 + 0.9; k <= L / 2 - 0.9; k += 1.15) {
          if (rnd() < 0.15) continue;
          crowd.push({ x: cx + t.x * (k + (rnd() - 0.5) * 0.3), y: p.y - 0.3 + h, z: cz + t.z * (k + (rnd() - 0.5) * 0.3),
            ry: Math.atan2(-n.z * sgn, -n.x * sgn), s: 0.85 + rnd() * 0.3, ph: rnd() * 6.28 });
        }
      }
    }
    // Gruppen von Zuschauern an der Strecke
    const groups = track.spectators || [0.12, 0.27, 0.42, 0.58, 0.73, 0.88];
    for (const f of groups) {
      const i = Math.floor(f * N) % N;
      if (inTunnel[i] || inTunnel[(i + 5) % N] || inTunnel[(i - 5 + N) % N]) continue;
      const sgn = rnd() < 0.5 ? 1 : -1, q = path[i], qn = norm[i], qt = tang[i];
      for (let k = 0; k < 14; k++) {
        const along = (rnd() - 0.5) * 14, off = edge + CURB + 4 + rnd() * 5;
        const x = q.x + qn.x * sgn * off + qt.x * along, z = q.z + qn.z * sgn * off + qt.z * along;
        if (rivers.length) { const rv = riverInfo(x, z); if (rv && rv.d < rv.w / 2 + 3) continue; }
        const y = terrainHeight(x, z);
        if (Math.abs(y - q.y) > 4) continue; // zu steil (Schlucht/Hang)
        crowd.push({ x, y: y - 0.05, z, ry: Math.atan2(-qn.z * sgn, -qn.x * sgn) + (rnd() - 0.5) * 0.6, s: 0.85 + rnd() * 0.3, ph: rnd() * 6.28 });
        addCollider({ x, z, r: 0.45 });
      }
    }
  }
  function world_W_len() { return 34; }

  // ---------- 7. Deko verteilen ----------
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
    const big = totalLen > 2500; // lange Strecke: Deko vor allem entlang der Strasse
    const count = Math.round(def.count * Q.propScale * (big ? clamp(totalLen / 1400, 1, 4.5) : areaScale));
    const minD = edge + (def.minDist != null ? def.minDist : 6);
    const maxD = def.maxDist != null ? edge + def.maxDist : Infinity;
    const items = [];
    for (let tries = 0; items.length < count && tries < count * 50; tries++) {
      let x, z;
      if (big && rnd() < 0.8) { // in der Nähe einer zufälligen Stelle der Strecke
        const p = path[Math.floor(rnd() * N)], a = rnd() * Math.PI * 2, d = edge + 6 + Math.pow(rnd(), 1.5) * 150;
        x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d;
        if (Math.abs(x) > HX - 15 || Math.abs(z) > HZ - 15) continue;
      } else { x = (rnd() * 2 - 1) * (HX - 15); z = (rnd() * 2 - 1) * (HZ - 15); }
      if (rivers.length) { const rv = riverInfo(x, z); if (rv && rv.d < rv.w / 2 + 4) continue; }
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

  // Zuschauer zeichnen: Körper, Kopf, Arme (hüpfen und jubeln)
  let crowdMeshes = null;
  if (crowd.length) {
    const body = new THREE.CylinderGeometry(0.26, 0.3, 1.0, 7); body.translate(0, 0.5, 0);
    const head = new THREE.SphereGeometry(0.2, 8, 6); head.translate(0, 1.22, 0);
    const arms = new THREE.BoxGeometry(0.12, 0.62, 0.9); arms.translate(0, 1.3, 0);
    const shirts = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00', '#ffffff', '#00acc1', '#ff4fa3'];
    const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
    const mk = (geo, cols) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), crowd.length);
      crowd.forEach((c, k) => m.setColorAt(k, new THREE.Color(cols[Math.floor(rnd() * cols.length)])));
      m.instanceColor.needsUpdate = true; m.frustumCulled = false; m.castShadow = Q.shadows;
      scene.add(m); return m;
    };
    crowdMeshes = [mk(body, shirts), mk(head, skins), mk(arms, skins)];
  }
  let cheer = 0;
  function animateCrowd(t) {
    if (!crowdMeshes) return;
    const [mb, mh, ma] = crowdMeshes;
    crowd.forEach((c, k) => {
      const jump = Math.max(0, Math.sin(t * (4 + cheer * 4) + c.ph)) * (0.06 + cheer * 0.35);
      dummy.position.set(c.x, c.y + jump, c.z); dummy.rotation.set(0, c.ry, 0); dummy.scale.setScalar(c.s); dummy.updateMatrix();
      mb.setMatrixAt(k, dummy.matrix); mh.setMatrixAt(k, dummy.matrix);
      // Arme: bei Jubel hoch, sonst unten
      const up = cheer > 0.1 && Math.sin(c.ph * 3) > -0.3;
      dummy.position.y = c.y + jump + (up ? 0.35 : -0.55) * c.s; dummy.updateMatrix();
      ma.setMatrixAt(k, dummy.matrix);
    });
    for (const m of crowdMeshes) m.instanceMatrix.needsUpdate = true;
  }

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
  {
    const sp = [];
    for (let i = 0; i < 700; i++) {
      const a = rnd() * Math.PI * 2, e = 0.08 + rnd() * 1.4;
      sp.push(Math.cos(a) * Math.cos(e) * 900, Math.sin(e) * 900, Math.sin(a) * Math.cos(e) * 900);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false }));
    stars.visible = !!theme.night;
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

  // ---------- 10. Schnee und Regen ----------
  function makeSnow() {
    const cnt = Q.snowCount, sp = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) { sp[i * 3] = (rnd() - 0.5) * 120; sp[i * 3 + 1] = rnd() * 40; sp[i * 3 + 2] = (rnd() - 0.5) * 120; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.35, transparent: true, opacity: 0.9, depthWrite: false }));
    p.frustumCulled = false; scene.add(p); return p;
  }
  function makeRain() { // Regentropfen als kurze Striche
    const cnt = Q.snowCount, sp = new Float32Array(cnt * 6);
    for (let i = 0; i < cnt; i++) {
      const x = (rnd() - 0.5) * 100, y = rnd() * 40, z = (rnd() - 0.5) * 100;
      sp.set([x, y, z, x + 0.15, y + 1.1, z], i * 6);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#c8d6ea', transparent: true, opacity: 0.55, depthWrite: false }));
    l.frustumCulled = false; scene.add(l); return l;
  }
  let snow = theme.snowfall ? makeSnow() : null, rain = null;

  // ---------- Wetter und Tageszeit ----------
  // time: day, evening, night   weather: clear, rain, fog, snow
  const baseSunDir = sunDir.clone();
  const atm = { amb: theme.ambient, sunI: theme.sunIntensity, grip: 1 };
  function setAtmosphere(o) {
    o = o || {};
    const tm = theme.night ? 'night' : (o.time || 'day'), wx = o.weather || 'clear';
    const top = new THREE.Color(theme.skyTop), bot = new THREE.Color(theme.skyBottom), sunC = new THREE.Color(theme.sun);
    let sunI = theme.sunIntensity, amb = theme.ambient, fogN = theme.fog[0] * fogScale, fogF = theme.fog[1] * fogScale;
    sunDir.copy(baseSunDir);
    if (tm === 'evening') { top.lerp(new THREE.Color('#3b3f8f'), 0.7); bot.lerp(new THREE.Color('#ff9a5c'), 0.75); sunC.set('#ffb36b'); sunI *= 0.8; amb *= 0.72; sunDir.y = 0.2; sunDir.normalize(); }
    if (tm === 'night' && !theme.night) { top.set('#050a1f'); bot.set('#1c2448'); sunC.set('#9db4ff'); sunI = 0.3; amb *= 0.45; }
    if (wx === 'rain') { top.lerp(new THREE.Color('#5f6670'), 0.75); bot.lerp(new THREE.Color('#878e98'), 0.75); sunI *= 0.4; amb *= 0.9; fogN *= 0.4; fogF *= 0.5; }
    if (wx === 'fog') { top.lerp(new THREE.Color('#b8bec6'), 0.75); bot.lerp(new THREE.Color('#c9ced4'), 0.9); sunI *= 0.55; fogN = 10; fogF = 140; }
    if (wx === 'snow') { top.lerp(new THREE.Color('#c9d3de'), 0.65); bot.lerp(new THREE.Color('#e6ecf2'), 0.65); sunI *= 0.6; fogN *= 0.5; fogF *= 0.6; }
    if (tm === 'night' && wx !== 'clear') { top.multiplyScalar(0.3); bot.multiplyScalar(0.3); }
    if (tm === 'evening' && wx !== 'clear') { top.multiplyScalar(0.7); bot.multiplyScalar(0.7); }
    sky.material.uniforms.top.value.copy(top); sky.material.uniforms.bottom.value.copy(bot);
    scene.background = bot.clone();
    scene.fog.color.copy(bot); scene.fog.near = fogN; scene.fog.far = fogF;
    hemi.color.copy(top).lerp(new THREE.Color('#ffffff'), 0.5);
    sun.color.copy(sunC);
    atm.amb = amb; atm.sunI = sunI;
    hemi.intensity = amb; sun.intensity = sunI;
    stars.visible = tm === 'night' && wx === 'clear';
    sunSprite.visible = wx === 'clear' || wx === 'snow' && tm !== 'night';
    sunSprite.material.color.set(tm === 'night' ? '#cfd8ff' : tm === 'evening' ? '#ffb070' : '#ffffff');
    sunSprite.scale.setScalar(tm === 'night' ? 45 : tm === 'evening' ? 190 : 150);
    // Niederschlag
    const wantSnow = wx === 'snow' || (!!theme.snowfall && wx !== 'rain'); // !! = immer true/false (undefined würde den Schnee nicht ausblenden)
    if (wantSnow && !snow) snow = makeSnow();
    if (snow) snow.visible = wantSnow;
    if (wx === 'rain' && !rain) rain = makeRain();
    if (rain) rain.visible = wx === 'rain';
    // Nasse Strasse glänzt
    const wet = wx === 'rain';
    if (roadMat) { roadMat.shininess = wet ? 70 : 4; roadMat.specular.set(wet ? '#777777' : '#111111'); roadMat.color.set(wet ? '#b8bcc4' : '#ffffff'); }
    // Weniger Grip bei Regen und Schnee
    atm.grip = wx === 'rain' ? 0.82 : wx === 'snow' ? (theme.snowfall ? 0.92 : 0.78) : 1;
    return { grip: atm.grip, night: tm === 'night', headlights: tm !== 'day' || wx === 'rain' || wx === 'fog', time: tm, weather: wx };
  }

  // Wird jedes Bild aufgerufen
  let time = 0;
  let dark = 0;
  function update(dt, cam, carPos, inTun) {
    time += dt;
    dark += ((inTun ? 1 : 0) - dark) * Math.min(1, dt * 3); // im Tunnel sanft dunkler werden
    hemi.intensity = atm.amb * (1 - 0.6 * dark);
    sun.intensity = atm.sunI * (1 - 0.85 * dark);
    cheer = Math.max(0, cheer - dt * 0.35);
    animateCrowd(time);
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
    if (rain && rain.visible) {
      const a = rain.geometry.attributes.position.array, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
      for (let i = 0; i < a.length; i += 6) {
        const fall = 32 * dt;
        a[i + 1] -= fall; a[i + 4] -= fall;
        if (a[i + 1] < cy - 10) { const x = cx + (Math.random() - 0.5) * 100, z = cz + (Math.random() - 0.5) * 100, y = cy + 20 + Math.random() * 15; a.set([x, y, z, x + 0.15, y + 1.1, z], i); }
      }
      rain.geometry.attributes.position.needsUpdate = true;
    }
  }

  // Grenzen für die Minikarte
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const p of path) { bounds.minX = Math.min(bounds.minX, p.x); bounds.maxX = Math.max(bounds.maxX, p.x); bounds.minZ = Math.min(bounds.minZ, p.z); bounds.maxZ = Math.max(bounds.maxZ, p.z); }

  return { scene, path, N, W, edge, CURB, tang, norm, roadInfo, terrainHeight, surfaceHeight, waterAt, inTunnel, collide, setAtmosphere, cheer: v => { cheer = Math.min(1, Math.max(cheer, v)); }, update, bounds, limits: { x: HX - 12, z: HZ - 12 }, size: Math.max(HX, HZ), theme, track };
};
