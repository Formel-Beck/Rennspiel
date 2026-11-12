// =====================================================
//  DEKO-MODELLE (Low-Poly-Stil)
//  Jedes Modell besteht aus "Teilen": je Teil eine Form
//  (Geometrie) und ein Material. Die Welt stellt davon viele
//  Kopien auf einmal hin (Instancing) – das ist schnell, auch am Handy.
// =====================================================
window.Props = (() => {
  let cache = {};
  function reset() { cache = {}; }

  // Material mit Farbe (wird zwischengespeichert)
  function M(color, extra) {
    const key = color + (extra ? JSON.stringify(extra) : '');
    if (!cache[key]) cache[key] = new THREE.MeshPhongMaterial(Object.assign({ color, flatShading: true, shininess: 4 }, extra || {}));
    return cache[key];
  }
  const Basic = color => cache['b' + color] || (cache['b' + color] = new THREE.MeshBasicMaterial({ color }));

  // Kurzformen für Grundformen
  const C = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg || 7);
  const K = (r, h, seg) => new THREE.ConeGeometry(r, h, seg || 7);
  const I = (r, d) => new THREE.IcosahedronGeometry(r, d || 0);
  const D = r => new THREE.DodecahedronGeometry(r, 0);
  const S = (r, w, h) => new THREE.SphereGeometry(r, w || 8, h || 6);
  const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);

  // Mehrere Formen zu einer einzigen verschmelzen
  function merge(items) {
    const pos = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    for (const it of items) {
      const g = it.geo.index ? it.geo.toNonIndexed() : it.geo.clone();
      e.set(it.rx || 0, it.ry || 0, it.rz || 0);
      q.setFromEuler(e);
      v.set(it.x || 0, it.y || 0, it.z || 0);
      s.set(it.sx || 1, it.sy || 1, it.sz || 1);
      m.compose(v, q, s);
      g.applyMatrix4(m);
      const a = g.attributes.position.array;
      for (let i = 0; i < a.length; i++) pos.push(a[i]);
      g.dispose(); it.geo.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.computeVertexNormals();
    return out;
  }

  // ---------- Fenster-Textur für Häuser ----------
  function windowTextures(night) {
    const key = '__win' + (night ? 'N' : 'D');
    if (cache[key]) return cache[key];
    const size = 256, cells = 8, cs = size / cells;
    const base = document.createElement('canvas'), lit = document.createElement('canvas');
    base.width = base.height = lit.width = lit.height = size;
    const b = base.getContext('2d'), l = lit.getContext('2d');
    b.fillStyle = '#ffffff'; b.fillRect(0, 0, size, size);
    l.fillStyle = '#000000'; l.fillRect(0, 0, size, size);
    for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
      const x = i * cs + cs * 0.22, y = j * cs + cs * 0.2, w = cs * 0.56, h = cs * 0.55;
      const on = night && Math.random() < 0.45;
      b.fillStyle = night ? (on ? '#ffe7a8' : '#2a3140') : '#7fa2bf';
      b.fillRect(x, y, w, h);
      if (on) { l.fillStyle = '#ffd27a'; l.fillRect(x, y, w, h); }
    }
    const mk = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
    return (cache[key] = { base: mk(base), lit: mk(lit) });
  }

  function buildingGeo(H) {
    const g = new THREE.BoxGeometry(10, H, 10);
    g.translate(0, H / 2, 0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4);
      if (face === 2 || face === 3) uv.setXY(i, 0.01, 0.99);
      else uv.setXY(i, uv.getX(i) * 10 / 24, uv.getY(i) * H / 28);
    }
    return g;
  }

  function building(H, night) {
    const tex = windowTextures(night);
    const key = '__wall' + night;
    const wall = cache[key] || (cache[key] = new THREE.MeshPhongMaterial({
      color: '#ffffff', map: tex.base, shininess: 10,
      emissive: night ? '#ffcc77' : '#000000', emissiveMap: night ? tex.lit : null
    }));
    const roof = M(night ? '#2a2d33' : '#6b7078');
    const parts = [{ geo: buildingGeo(H), mat: [wall, wall, roof, roof, wall, wall], tint: 'wall', receive: true }];
    if (night) {
      const neon = B(10.5, 0.5, 10.5); neon.translate(0, H - 2, 0);
      parts.push({ geo: neon, mat: Basic('#ffffff'), tint: 'neon', cast: false });
    }
    return parts;
  }

  // ---------- Alle Deko-Modelle ----------
  const builders = {
    pine: () => [
      { geo: merge([{ geo: C(0.35, 0.55, 2.4), y: 1.2 }]), mat: M('#7a5230') },
      { geo: merge([{ geo: K(2.8, 4.2), y: 3.6 }, { geo: K(2.2, 3.6), y: 5.6 }, { geo: K(1.5, 3), y: 7.4 }]), mat: M('#2e7d32') }
    ],
    snowpine: () => {
      const tiers = [[2.8, 4.2, 3.6], [2.2, 3.6, 5.6], [1.5, 3, 7.4]];
      const f = 0.45;
      return [
        { geo: merge([{ geo: C(0.35, 0.55, 2.4), y: 1.2 }]), mat: M('#6d4a2c') },
        { geo: merge(tiers.map(([r, h, y]) => ({ geo: K(r, h), y }))), mat: M('#2f5d3a') },
        { geo: merge(tiers.map(([r, h, y]) => ({ geo: K(r * f * 1.07, h * f), y: y + h / 2 - h * f / 2 + 0.03 }))), mat: M('#ffffff') }
      ];
    },
    tree: () => [
      { geo: merge([{ geo: C(0.35, 0.5, 3), y: 1.5 }]), mat: M('#7a5230') },
      { geo: merge([{ geo: I(2.4), y: 4.8 }, { geo: I(1.8), x: 1.3, y: 4.2 }, { geo: I(1.6), x: -1, y: 5.3, z: 0.7 }]), mat: M('#43a047') }
    ],
    bush: () => [{ geo: merge([{ geo: I(1.1), y: 0.7, sy: 0.8 }, { geo: I(0.8), x: 0.8, y: 0.5 }]), mat: M('#2f6f2a') }],
    rock: def => [{ geo: merge([{ geo: D(1.4), y: 0.4, sy: 0.7 }]), mat: M(def.color || '#8d8d8d') }],
    drybush: () => [{ geo: merge([{ geo: I(0.8), y: 0.5 }, { geo: I(0.6), x: 0.6, y: 0.4 }]), mat: M('#a08050') }],
    cactus: () => [{
      geo: merge([
        { geo: C(0.5, 0.55, 5, 8), y: 2.5 },
        { geo: C(0.3, 0.3, 1.1, 6), rz: Math.PI / 2, x: 0.6, y: 2.4 }, { geo: C(0.32, 0.32, 2.2, 6), x: 1.1, y: 3.4 },
        { geo: C(0.3, 0.3, 1, 6), rz: Math.PI / 2, x: -0.5, y: 2.1 }, { geo: C(0.3, 0.3, 1.6, 6), x: -1, y: 2.8 }
      ]), mat: M('#5c8f3c')
    }],
    palm: () => {
      const trunk = [];
      for (let k = 0; k < 5; k++) trunk.push({ geo: C(0.28 - k * 0.02, 0.32 - k * 0.02, 1.7, 6), x: 0.1 * k * k, y: 0.85 + 1.55 * k, rz: -0.08 * k });
      const tx = 1.6, ty = 7.8, leaves = [], nuts = [];
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2;
        leaves.push({ geo: B(4, 0.12, 0.9), x: tx + Math.cos(a) * 1.9, y: ty - 0.35, z: Math.sin(a) * 1.9, ry: -a, rz: -0.35 });
      }
      for (let k = 0; k < 3; k++) { const a = k * 2.1; nuts.push({ geo: S(0.25, 6, 4), x: tx + Math.cos(a) * 0.4, y: ty - 0.4, z: Math.sin(a) * 0.4 }); }
      return [
        { geo: merge(trunk), mat: M('#8d6b45') },
        { geo: merge(leaves), mat: M('#2e8b3a') },
        { geo: merge(nuts), mat: M('#5a3d22') }
      ];
    },
    umbrella: () => [
      { geo: merge([{ geo: C(0.06, 0.06, 3, 5), y: 1.5 }]), mat: M('#dddddd') },
      { geo: merge([{ geo: K(2.2, 0.9, 8), y: 3.1 }]), mat: M('#ffffff'), tint: 'canopy' }
    ],
    snowman: () => [
      { geo: merge([{ geo: S(1, 10, 8), y: 1 }, { geo: S(0.7, 10, 8), y: 2.3 }, { geo: S(0.48, 10, 8), y: 3.25 }]), mat: M('#ffffff') },
      { geo: merge([{ geo: K(0.1, 0.5, 6), rz: -Math.PI / 2, x: 0.6, y: 3.25 }]), mat: M('#ff8f00') },
      { geo: merge([{ geo: C(0.35, 0.35, 0.5, 10), y: 3.85 }, { geo: C(0.55, 0.55, 0.06, 10), y: 3.6 }]), mat: M('#222222') }
    ],
    lolli: () => {
      const cols = ['#ff4fa3', '#ffe14d', '#4fc3f7', '#ffffff'];
      const rings = cols.map((c, i) => ({ geo: merge([{ geo: new THREE.TorusGeometry(1.6 - i * 0.42, 0.22, 6, 18), x: 0, y: 6.2, rx: 0 }]), mat: M(c) }));
      return [
        { geo: merge([{ geo: C(0.15, 0.15, 6, 6), y: 3 }]), mat: M('#ffffff') },
        { geo: merge([{ geo: new THREE.CylinderGeometry(1.9, 1.9, 0.3, 20), y: 6.2, rx: Math.PI / 2 }]), mat: M('#ff80c0') }
      ].concat(rings.map(r => (r.geo.translate(0, 0, 0.17), r)));
    },
    lamp: () => [
      { geo: merge([{ geo: C(0.12, 0.18, 7, 6), y: 3.5 }, { geo: B(2.2, 0.12, 0.12), x: 1.1, y: 7 }]), mat: M('#556070') },
      { geo: merge([{ geo: B(0.6, 0.2, 0.4), x: 2.1, y: 6.9 }]), mat: Basic('#ffe9a8'), cast: false }
    ]
  };

  // ---------- Kulisse am Horizont ----------
  function ring(rnd, count, rMin, rMax, filter, scale) {
    scale = scale || 1; rMin *= scale; rMax *= scale; count = Math.round(count * Math.min(scale, 1.6));
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.2, r = rMin + rnd() * (rMax - rMin);
      const x = Math.cos(a) * r * 1.2, z = Math.sin(a) * r * 0.95;
      if (!filter || filter(x, z)) out.push({ x, z });
    }
    return out;
  }

  function backdrop(type, theme, rnd, scale) {
    scale = scale || 1;
    const meshes = [];
    if (type === 'hills' || type === 'sea') {
      const pts = ring(rnd, 34, 330, 430, type === 'sea' ? (x, z) => z < 20 : null, scale);
      const items = pts.map(p => { const s = 50 + rnd() * 50; return { geo: I(1, 1), x: p.x, y: -6, z: p.z, sx: s * 1.4, sy: 22 + rnd() * 30, sz: s }; });
      meshes.push(new THREE.Mesh(merge(items), M(theme.groundVar)));
    }
    if (type === 'peaks') {
      const rock = [], snow = [], f = 0.32;
      for (const p of ring(rnd, 26, 340, 440, null, scale)) {
        const R = 55 + rnd() * 45, H = 90 + rnd() * 90, ry = rnd() * 3;
        rock.push({ geo: K(1, 1, 6), x: p.x, y: H / 2 - 12, z: p.z, sx: R, sy: H, sz: R, ry });
        snow.push({ geo: K(1, 1, 6), x: p.x, y: H - 12 - H * f / 2 + 0.5, z: p.z, sx: R * f * 1.04, sy: H * f, sz: R * f * 1.04, ry });
      }
      meshes.push(new THREE.Mesh(merge(rock), M('#7d8590')), new THREE.Mesh(merge(snow), M('#ffffff')));
    }
    if (type === 'mesas') {
      const items = ring(rnd, 20, 330, 430, null, scale).map(p => {
        const R = 30 + rnd() * 30, H = 25 + rnd() * 30;
        return { geo: C(1, 1.15, 1, 7), x: p.x, y: H / 2 - 4, z: p.z, sx: R, sy: H, sz: R, ry: rnd() * 3 };
      });
      meshes.push(new THREE.Mesh(merge(items), M('#c4703f')));
    }
    if (type === 'skyline') {
      const tex = windowTextures(true);
      const base = tex.base.clone(), lit = tex.lit.clone();
      base.needsUpdate = lit.needsUpdate = true;
      base.repeat.set(2, 6); lit.repeat.set(2, 6);
      const mat = new THREE.MeshPhongMaterial({ color: '#4a5070', map: base, emissive: '#ffcc77', emissiveMap: lit, emissiveIntensity: 0.8 });
      const pts = ring(rnd, 80, 290, 420, null, scale);
      const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
      const mesh = new THREE.InstancedMesh(geo, mat, pts.length);
      const d = new THREE.Object3D();
      pts.forEach((p, i) => {
        const w = 14 + rnd() * 18;
        d.position.set(p.x, -2, p.z); d.rotation.set(0, rnd() * 3, 0); d.scale.set(w, 40 + rnd() * 100, w);
        d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      });
      mesh.frustumCulled = false;
      meshes.push(mesh);
    }
    return meshes;
  }

  function build(def, night) {
    const f = builders[def.type];
    return f ? f(def, night) : null;
  }

  return { reset, build, building, backdrop, merge, M, Basic };
})();
