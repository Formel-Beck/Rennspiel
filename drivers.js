// =====================================================
//  FAHRER-MODELLE UND HUPEN
//  Jeder Fahrer sitzt im Cabrio: Ursprung = Sitzfläche,
//  vorne ist +X, oben ist +Y. Der Kopf ist bei etwa y = 0.75.
// =====================================================
window.Drivers = (() => {
  const mat = (color, extra) => new THREE.MeshPhongMaterial(Object.assign({ color, shininess: 20 }, extra || {}));
  const S = (r, w, h) => new THREE.SphereGeometry(r, w || 16, h || 12);
  const C = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg || 10);
  const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  const Top = (r, f) => new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI * (f || 0.32)); // Kappe oben auf dem Kopf
  const Back = r => new THREE.SphereGeometry(r, 16, 12, -Math.PI / 2, Math.PI); // hintere Kopfhälfte (Haare, Kapuze)

  function add(g, geo, m, x, y, z, opts) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x || 0, y || 0, z || 0);
    if (opts) {
      if (opts.rx) mesh.rotation.x = opts.rx;
      if (opts.ry) mesh.rotation.y = opts.ry;
      if (opts.rz) mesh.rotation.z = opts.rz;
      if (opts.s) mesh.scale.set(...opts.s);
    }
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  }
  // Zylinder von Punkt a nach Punkt b (für Arme, Haare …)
  function limb(g, a, b, r, m) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const mesh = new THREE.Mesh(C(r, r, len, 8), m);
    mesh.position.copy(va).add(vb).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  }

  // Grundkörper: Oberkörper, Kopf, Augen, Arme zum Lenkrad
  function base(o) {
    const g = new THREE.Group();
    const body = mat(o.body), skin = mat(o.skin);
    const w = o.width || 0.5, hr = o.head || 0.22;
    add(g, B(0.36 * (o.depth || 1), 0.55, w), body, 0, 0.28, 0);
    add(g, C(0.09, 0.1, 0.12), skin, 0, 0.6, 0);
    const head = add(g, S(hr), skin, 0, 0.75, 0);
    if (!o.noEyes) {
      const white = mat('#ffffff'), black = mat('#111111');
      for (const z of [-0.08, 0.08]) {
        add(g, S(0.045, 10, 8), white, hr * 0.82, 0.79, z);
        add(g, S(0.025, 8, 6), black, hr * 0.82 + 0.035, 0.79, z);
      }
    }
    for (const z of [-1, 1]) {
      limb(g, [0.02, 0.48, z * (w / 2 + 0.03)], [0.42, 0.3, z * 0.17], 0.055, body);
      add(g, S(0.06, 8, 6), skin, 0.44, 0.3, z * 0.17);
    }
    return { g, head, body, skin, hr, w };
  }

  const builders = {
    beck() { // dick, Anzug mit Krawatte, braune Dreadlocks, breites Grinsen
      const d = base({ body: '#3a3f4a', skin: '#d9a37a', width: 0.78, depth: 1.5, head: 0.25 });
      add(d.g, B(0.02, 0.32, 0.16), mat('#ffffff'), 0.28, 0.4, 0);
      add(d.g, B(0.03, 0.28, 0.07), mat('#c62828'), 0.29, 0.38, 0);
      add(d.g, S(0.38, 16, 12), mat('#3a3f4a'), 0.05, 0.22, 0, { s: [1, 0.75, 1.15] }); // Bauch
      add(d.g, B(0.03, 0.05, 0.2), mat('#ffffff'), 0.235, 0.68, 0);                    // Grinsen
      add(d.g, B(0.02, 0.02, 0.22), mat('#5a2a1a'), 0.24, 0.655, 0);
      const hair = mat('#5a3a1e');
      add(d.g, Back(0.265), hair, 0, 0.78, 0);
      add(d.g, Top(0.268), hair, 0, 0.75, 0);
      for (let i = 0; i < 14; i++) {
        const a = Math.PI * 0.35 + (i / 13) * Math.PI * 1.3; // von links über hinten nach rechts
        const x = Math.cos(a) * 0.22, z = Math.sin(a) * 0.22;
        limb(d.g, [x, 0.86, z], [x * 1.25 - 0.04, 0.45, z * 1.25], 0.035, hair);
      }
      return d.g;
    },
    orla() { // Funkerin: oranger Overall, Headset, roter Dutt
      const d = base({ body: '#e86a2a', skin: '#f0c8a8' });
      const hair = mat('#8e2b1c');
      add(d.g, Back(0.235), hair, 0, 0.77, 0);
      add(d.g, Top(0.238), hair, 0, 0.75, 0);
      add(d.g, S(0.11, 12, 10), hair, -0.2, 0.9, 0);
      const dark = mat('#222222');
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 8, 24, Math.PI), dark);
      band.position.set(0, 0.76, 0); band.rotation.y = Math.PI / 2;
      d.g.add(band);
      for (const z of [-0.25, 0.25]) add(d.g, C(0.07, 0.07, 0.05), dark, 0, 0.76, z, { rx: Math.PI / 2 });
      limb(d.g, [0, 0.72, 0.25], [0.2, 0.66, 0.1], 0.012, dark);
      add(d.g, S(0.03, 8, 6), dark, 0.21, 0.66, 0.09);
      add(d.g, B(0.02, 0.06, 0.14), mat('#ffffff'), 0.19, 0.37, 0.1); // Namensschild
      return d.g;
    },
    waechter() { // gross und breit, Uniform, Mütze, Sonnenbrille, Abzeichen
      const d = base({ body: '#3e4a32', skin: '#c99a76', width: 0.72, depth: 1.3, head: 0.24 });
      const capM = mat('#2a2f22');
      add(d.g, C(0.25, 0.25, 0.14, 16), capM, 0, 0.94, 0);
      add(d.g, B(0.18, 0.03, 0.34), capM, 0.22, 0.88, 0);
      add(d.g, B(0.04, 0.06, 0.3), mat('#111111', { shininess: 120 }), 0.215, 0.79, 0);
      add(d.g, B(0.03, 0.08, 0.08), mat('#ffd54a', { shininess: 80 }), 0.24, 0.45, 0.16);
      add(d.g, S(0.2, 12, 8), mat('#a37c5c'), 0.04, 0.66, 0, { s: [1, 0.5, 1] }); // Stoppelkinn
      return d.g;
    },
    locken() { // Hoodie, viele Locken, Mund weit offen zum Schreien
      const d = base({ body: '#7b3fa0', skin: '#e8b894' });
      const curl = mat('#3b2414');
      for (let i = 0; i < 46; i++) {
        const u = i / 46, a = i * 2.4, y = 0.98 - u * 0.36, r = Math.sqrt(1 - Math.pow((y - 0.75) / 0.26, 2)) * 0.25;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (x > 0.12 && y < 0.88) continue; // Gesicht frei lassen
        add(d.g, S(0.075, 8, 6), curl, x, y, z);
      }
      add(d.g, S(0.06, 10, 8), mat('#3a0d0d'), 0.2, 0.67, 0, { s: [0.5, 1.2, 1] });
      add(d.g, C(0.2, 0.26, 0.12, 12), mat('#6a3590'), -0.05, 0.56, 0); // Kapuze im Nacken
      return d.g;
    },
    maske() { // schwarze Maske mit Augenlöchern, Kapuze
      const d = base({ body: '#1b1b1f', skin: '#151517', noEyes: true });
      const white = mat('#f5f5f5', { emissive: '#666666' }), black = mat('#000000');
      for (const z of [-0.08, 0.08]) {
        add(d.g, S(0.05, 10, 8), white, 0.19, 0.79, z, { s: [0.6, 0.7, 1] });
        add(d.g, S(0.02, 8, 6), black, 0.215, 0.79, z);
      }
      add(d.g, Back(0.29), mat('#3a3a46'), -0.02, 0.78, 0, { s: [1, 1.1, 1] });
      add(d.g, Top(0.292, 0.38), mat('#3a3a46'), -0.02, 0.78, 0);
      add(d.g, B(0.02, 0.02, 0.12), mat('#444'), 0.215, 0.68, 0); // Mundschlitz
      return d.g;
    },
    katze() { // grüne Katze: Ohren, gelbe Augen, Schnurrhaare, Schwanz
      const d = base({ body: '#43a047', skin: '#4caf50', noEyes: true, head: 0.23 });
      const pink = mat('#f48fb1'), green = mat('#4caf50');
      for (const z of [-0.12, 0.12]) {
        add(d.g, new THREE.ConeGeometry(0.08, 0.16, 8), green, 0, 0.98, z, { rz: 0, rx: z > 0 ? 0.3 : -0.3 });
        add(d.g, new THREE.ConeGeometry(0.045, 0.1, 8), pink, 0.025, 0.97, z, { rx: z > 0 ? 0.3 : -0.3 });
        add(d.g, S(0.055, 10, 8), mat('#ffeb3b', { emissive: '#554400' }), 0.19, 0.79, z * 0.7);
        add(d.g, B(0.02, 0.07, 0.015), mat('#111111'), 0.235, 0.79, z * 0.7);
      }
      add(d.g, S(0.03, 8, 6), pink, 0.23, 0.72, 0);
      const wh = mat('#ffffff');
      for (const z of [-1, 1]) for (const dy of [-0.02, 0.02]) limb(d.g, [0.22, 0.7, z * 0.04], [0.2, 0.7 + dy * 2, z * 0.22], 0.005, wh);
      let prev = [-0.2, 0.15, 0];
      for (let k = 1; k <= 5; k++) { const p = [-0.25 - k * 0.04, 0.15 + k * 0.13, Math.sin(k) * 0.05]; limb(d.g, prev, p, 0.04, green); prev = p; }
      return d.g;
    },
    geist() { // durchsichtig, leuchtet, schwebt
      const g = new THREE.Group();
      const m = new THREE.MeshPhongMaterial({ color: '#dcefff', emissive: '#4a6a8a', transparent: true, opacity: 0.72, shininess: 60, depthWrite: false });
      add(g, new THREE.ConeGeometry(0.34, 0.85, 16, 1, true), m, 0, 0.32, 0);
      add(g, S(0.24), m, 0, 0.76, 0);
      const black = mat('#0a0f18');
      for (const z of [-0.08, 0.08]) add(g, S(0.05, 10, 8), black, 0.2, 0.8, z, { s: [0.5, 1.4, 1] });
      add(g, S(0.05, 10, 8), black, 0.21, 0.66, 0, { s: [0.5, 1.2, 1] });
      for (const z of [-1, 1]) limb(g, [0.02, 0.5, z * 0.24], [0.42, 0.3, z * 0.17], 0.05, m);
      g.userData.float = true;
      return g;
    }
  };

  // ---------- Eigene 3D-Modelle (.glb) ----------
  const glbCache = {};
  // Lädt alle .glb-Dateien, die in characters.js eingetragen sind.
  // onLoaded(char) wird aufgerufen, sobald ein Modell fertig ist.
  function loadModels(chars, onLoaded) {
    if (!THREE.GLTFLoader) return;
    const loader = new THREE.GLTFLoader();
    for (const c of chars) {
      if (!c.glb || glbCache[c.id]) continue;
      loader.load(c.glb, gltf => {
        const root = gltf.scene;
        // Grösse anpassen: ganzes Modell auf glbHeight, Füsse auf glbY
        const bb = new THREE.Box3().setFromObject(root), size = bb.getSize(new THREE.Vector3());
        const s = (c.glbHeight || 2.0) / (size.y || 1);
        root.scale.setScalar(s);
        const center = bb.getCenter(new THREE.Vector3());
        root.position.set(-center.x * s, -bb.min.y * s + (c.glbY != null ? c.glbY : -1.04), -center.z * s);
        const wrap = new THREE.Group();
        wrap.rotation.y = c.glbRotY != null ? c.glbRotY : Math.PI / 2; // glTF schaut nach +Z, unser Fahrer nach +X
        wrap.add(root);
        wrap.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
        glbCache[c.id] = wrap;
        onLoaded && onLoaded(c);
      }, undefined, err => console.warn('Modell konnte nicht geladen werden:', c.glb, err));
    }
  }

  function build(char) {
    if (glbCache[char.id]) {
      const g = new THREE.Group();
      g.add(glbCache[char.id].clone(true));
      g.userData.float = char.model === 'geist';
      return g;
    }
    const g = (builders[char.model] || builders.orla)();
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // ---------- Hupen (Töne werden im Browser erzeugt) ----------
  function tone(ctx, out, type, t0, dur, f0, f1, vol, filter) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = filter[0]; f.frequency.value = filter[1]; if (filter[2]) f.Q.value = filter[2]; o.connect(f); node = f; }
    node.connect(g).connect(out);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  function vibrato(ctx, osc, t0, dur, rate, depth) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = rate; lg.gain.value = depth;
    l.connect(lg).connect(osc.frequency); l.start(t0); l.stop(t0 + dur + 0.05);
  }
  function noise(ctx, out, t0, dur, vol, freq) {
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    src.connect(f).connect(g).connect(out); src.start(t0);
  }

  const horns = {
    tuba(ctx, out, t) { // schwere Schritte wie eine Tuba
      for (const [dt, f] of [[0, 73], [0.32, 65]]) {
        const o = tone(ctx, out, 'sawtooth', t + dt, 0.45, f, f * 0.97, 0.22, ['lowpass', 380]);
        vibrato(ctx, o, t + dt, 0.45, 5, 2);
      }
    },
    funk(ctx, out, t) { for (let i = 0; i < 4; i++) tone(ctx, out, 'square', t + i * 0.12, 0.06, 1250, 0, 0.09); },
    grunz(ctx, out, t) {
      for (const dt of [0, 0.3]) {
        tone(ctx, out, 'sawtooth', t + dt, 0.25, 110, 70, 0.25, ['lowpass', 500]);
        noise(ctx, out, t + dt, 0.22, 0.25, 400);
      }
    },
    schrei(ctx, out, t) {
      const o = tone(ctx, out, 'sawtooth', t, 0.8, 650, 950, 0.16, ['bandpass', 1400, 1.5]);
      vibrato(ctx, o, t, 0.8, 9, 40);
      noise(ctx, out, t, 0.6, 0.08, 3000);
    },
    maske(ctx, out, t) {
      const o = tone(ctx, out, 'triangle', t, 0.9, 220, 95, 0.25);
      vibrato(ctx, o, t, 0.9, 7, 12);
    },
    miau(ctx, out, t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2;
      o.frequency.setValueAtTime(480, t); o.frequency.linearRampToValueAtTime(820, t + 0.18); o.frequency.linearRampToValueAtTime(420, t + 0.55);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 0.65);
    },
    geist(ctx, out, t) {
      const o = tone(ctx, out, 'sine', t, 1.3, 330, 260, 0.2);
      vibrato(ctx, o, t, 1.3, 6, 25);
    }
  };
  function honk(char, ctx, out) {
    try { (horns[char.horn] || horns.funk)(ctx, out, ctx.currentTime + 0.01); } catch (e) {}
  }

  return { build, honk, loadModels, hasGlb: id => !!glbCache[id] };
})();
