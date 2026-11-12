// =====================================================
//  ITEMS UND SPEZIAL-BOOSTS
//
//  ?-Boxen: Darüberfahren gibt ein zufälliges Item.
//           Wer weiter hinten liegt, bekommt bessere Items.
//  Spezial: Jeder Fahrer hat einen eigenen Boost. Der Balken
//           lädt sich mit der Zeit und mit jeder ?-Box auf.
//
//  Neues Item?  In ITEMS eintragen und bei useItem() einbauen.
//  Neuer Spezial-Boost?  In SPECIALS eintragen (Schlüssel = Fahrer-id).
// =====================================================
window.Items = (() => {
  const ITEMS = {
    turbo:  { name: 'Turbo',          icon: '⚡' },
    triple: { name: 'Dreifach-Turbo', icon: '⚡⚡⚡', uses: 3 },
    oil:    { name: 'Ölfleck',        icon: '🛢️' },
    star:   { name: 'Superstern',     icon: '⭐' },
    rocket: { name: 'Rakete',         icon: '🚀' },
    charge: { name: 'Spezial laden',  icon: '🔋' }
  };
  // Welche Items wie oft – je nach Platz (vorne / Mitte / hinten)
  const ODDS = {
    front: { turbo: 40, oil: 35, charge: 25 },
    mid:   { turbo: 30, triple: 20, oil: 20, star: 10, charge: 20 },
    back:  { triple: 30, star: 25, rocket: 25, turbo: 10, charge: 10 }
  };
  const SPECIALS = {
    beck:     { name: 'Schiss-Boost', icon: '💩', info: 'Riesen-Turbo – und hinter dir bleibt eine rutschige Überraschung liegen.' },
    orla:     { name: 'Funk-Turbo',   icon: '📡', info: 'Vier schnelle Turbo-Stösse hintereinander.' },
    waechter: { name: 'Rammbock',     icon: '🛡️', info: 'Wer dich berührt, fliegt weg. Dazu ein kurzer Turbo.' },
    locken:   { name: 'Urschrei',     icon: '😱', info: 'Eine Schrei-Welle schleudert alle in der Nähe herum.' },
    maske:    { name: 'Schattenlauf', icon: '👤', info: 'Unsichtbar und unberührbar – fahr durch alles hindurch.' },
    katze:    { name: 'Krallen',      icon: '🐾', info: 'Perfekter Grip überall, nichts bringt dich ins Rutschen.' },
    geist:    { name: 'Spuk',         icon: '👻', info: 'Schwebe über Wiese und durch Bäume, als wären sie nicht da.' }
  };
  const CHARGE_TIME = 35;      // Sekunden bis der Spezial-Balken voll ist
  const CHARGE_PER_BOX = 0.15; // so viel gibt jede ?-Box dazu
  const $ = id => document.getElementById(id);

  let world = null, enabled = false, char = null, boxes = [], hazards = [], boxGroup = null, hazardGroup = null;
  let getAudio = () => null, sendEvent = () => {}, getPlace = () => null, spawnFx = () => {};
  const st = {}; // Zustand des eigenen Autos
  function resetState() {
    Object.assign(st, { item: null, uses: 0, rolling: 0, special: 0, boost: 0, boostPow: 1, pulses: 0, pulseT: 0, spin: 0, spinDir: 1,
      star: 0, ghost: 0, ram: 0, grip: 0, immune: 0, rocket: 0, spook: 0, hitCool: 0 });
  }
  resetState();

  // ---------- Aufbau pro Rennen ----------
  function setup(opts) {
    world = opts.world; char = opts.char; enabled = !!opts.enabled;
    getAudio = opts.getAudio; sendEvent = opts.sendEvent; getPlace = opts.getPlace; spawnFx = opts.spawnFx;
    resetState();
    boxes = []; hazards = [];
    if (boxGroup && boxGroup.parent) boxGroup.parent.remove(boxGroup);
    if (hazardGroup && hazardGroup.parent) hazardGroup.parent.remove(hazardGroup);
    boxGroup = new THREE.Group(); hazardGroup = new THREE.Group();
    world.scene.add(boxGroup, hazardGroup);
    $('itemHud').style.display = enabled ? '' : 'none';
    document.querySelectorAll('.itembtn').forEach(b => b.style.display = enabled ? '' : 'none');
    if (!enabled) return;
    const rows = opts.track.itemRows || [0.25, 0.5, 0.75];
    const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6), mat = boxMaterial();
    for (const f of rows) {
      const i = Math.floor(f * world.N) % world.N, p = world.path[i], n = world.norm[i];
      const count = world.W >= 26 ? 5 : 4, gap = (world.W - 6) / (count - 1);
      for (let k = 0; k < count; k++) {
        const off = -world.W / 2 + 3 + gap * k;
        const m = new THREE.Mesh(geo, mat);
        m.position.set(p.x + n.x * off, p.y + 1.4, p.z + n.z * off);
        m.castShadow = true;
        boxGroup.add(m);
        boxes.push({ mesh: m, x: m.position.x, z: m.position.z, wait: 0, phase: Math.random() * 6 });
      }
    }
    updateHud();
  }
  let boxMat = null;
  function boxMaterial() {
    if (boxMat) return boxMat;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 128, 128);
    ['#ff4fa3', '#ffb74d', '#ffe14d', '#69f0ae', '#4fc3f7', '#b388ff'].forEach((col, k, a) => gr.addColorStop(k / (a.length - 1), col));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
    g.fillStyle = '#fff'; g.font = 'bold 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.fillText('?', 64, 70);
    boxMat = new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.88, emissive: '#553366', shininess: 80 });
    return boxMat;
  }

  // ---------- Gefahren (Pfützen) ----------
  function makeHazard(type, x, z, y) {
    const g = new THREE.Group();
    if (type === 'schiss') {
      const brown = new THREE.MeshPhongMaterial({ color: '#6b4220', shininess: 60 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.12, 16), brown); disc.position.y = 0.06; g.add(disc);
      [[0, 0.35, 0, 0.75], [0, 0.85, 0, 0.55], [0, 1.25, 0, 0.35]].forEach(([px, py, pz, r]) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), brown); s.scale.y = 0.7; s.position.set(px, py, pz); s.castShadow = true; g.add(s);
      });
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 8), brown); tip.position.y = 1.55; g.add(tip);
    } else {
      const oil = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.06, 18), new THREE.MeshPhongMaterial({ color: '#0d0d12', shininess: 160, specular: '#8888ff' }));
      oil.position.y = 0.05; oil.scale.z = 0.8; g.add(oil);
    }
    g.position.set(x, (y || world.surfaceHeight(x, z)) + 0.02, z);
    g.rotation.y = Math.random() * 6;
    hazardGroup.add(g);
    hazards.push({ type, x, z, r: 2.4, life: 30, mesh: g });
  }
  function dropHazard(type, car) {
    const back = 4.5, x = car.x - Math.cos(car.angle) * back, z = car.z - Math.sin(car.angle) * back;
    makeHazard(type, x, z);
    sendEvent({ k: 'hz', type, x: +x.toFixed(2), z: +z.toFixed(2) });
  }

  // ---------- Items benutzen ----------
  function rollItem() {
    const pl = getPlace(), total = pl ? pl.total : 1, place = pl ? pl.place : 1;
    let band = 'mid';
    if (total > 1) band = place === 1 ? 'front' : place === total ? 'back' : 'mid';
    const table = ODDS[band], sum = Object.values(table).reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (const [k, w] of Object.entries(table)) { r -= w; if (r <= 0) return k; }
    return 'turbo';
  }
  function boost(sec, pow) {
    pow = pow || 1;
    st.boostPow = st.boost > 0 ? Math.max(st.boostPow, pow) : pow;
    st.boost = Math.max(st.boost, sec);
    sfx('boost');
  }

  function useItem(car) {
    if (!enabled || !st.item || st.rolling > 0 || st.spin > 0) return;
    const it = st.item;
    if (it === 'turbo' || it === 'triple') boost(1.6, 1);
    else if (it === 'oil') { dropHazard('oil', car); sfx('drop'); }
    else if (it === 'star') { st.star = 7; st.immune = 7; boost(7, 0.6); sfx('star'); }
    else if (it === 'rocket') { st.rocket = 3.5; st.immune = 3.5; sfx('boost'); }
    else if (it === 'charge') { st.special = 1; sfx('charge'); }
    st.uses--;
    if (st.uses <= 0) st.item = null;
    updateHud();
  }
  function useSpecial(car) {
    if (!enabled || st.special < 1 || st.spin > 0) return;
    st.special = 0;
    const id = char && char.id;
    if (id === 'beck') { boost(2.8, 1.35); setTimeout(() => dropHazard('schiss', car), 150); sfx('fart'); }
    else if (id === 'orla') { st.pulses = 4; st.pulseT = 0; sfx('funk'); }
    else if (id === 'waechter') { st.ram = 5; st.grip = 5; boost(1.6, 1); sfx('grunz'); }
    else if (id === 'locken') {
      boost(1.6, 1); sfx('schrei');
      sendEvent({ k: 'shock', x: +car.x.toFixed(1), z: +car.z.toFixed(1) });
      spawnFx('shock', car);
    }
    else if (id === 'maske') { st.ghost = 4.5; st.immune = 4.5; boost(2.2, 1); sfx('ghost'); }
    else if (id === 'katze') { st.grip = 5; st.immune = 5; boost(1.6, 1); sfx('miau'); }
    else if (id === 'geist') { st.spook = 5; st.ghost = 5; st.immune = 5; boost(1.6, 1); sfx('ghost'); }
    else boost(2, 1);
    updateHud();
  }

  // Ins Schleudern geraten (Pfütze, Schrei, Zusammenstoss mit Stern/Rammbock)
  function spinOut(sec) {
    if (st.immune > 0 || st.grip > 0 && sec < 1 || st.hitCool > 0) return false;
    st.spin = sec || 1.1; st.spinDir = Math.random() < 0.5 ? -1 : 1; st.hitCool = st.spin + 1.2;
    st.boost = 0; st.rocket = 0; st.pulses = 0;
    sfx('spin');
    return true;
  }

  // Ereignisse von anderen Spielern
  function remoteEvent(id, e, car) {
    if (!enabled || !world) return;
    if (e.k === 'hz') makeHazard(e.type, e.x, e.z);
    else if (e.k === 'shock') {
      spawnFx('shock', { x: e.x, z: e.z, y: world.surfaceHeight(e.x, e.z) });
      const dx = car.x - e.x, dz = car.z - e.z, d = Math.hypot(dx, dz);
      if (d < 20 && spinOut(1.0)) { car.vx += dx / (d || 1) * 12; car.vz += dz / (d || 1) * 12; }
    }
  }

  // ---------- Jedes Bild ----------
  function update(dt, car) {
    if (!enabled) return;
    for (const k of ['boost', 'spin', 'star', 'ghost', 'ram', 'grip', 'immune', 'rocket', 'spook', 'hitCool']) if (st[k] > 0) st[k] = Math.max(0, st[k] - dt);
    if (st.boost <= 0) st.boostPow = 1;
    if (st.pulses > 0) { st.pulseT -= dt; if (st.pulseT <= 0) { boost(0.45, 1.15); st.pulses--; st.pulseT = 0.75; } }
    // Spezial laden
    const before = st.special;
    st.special = Math.min(1, st.special + dt / CHARGE_TIME);
    if (before < 1 && st.special >= 1) sfx('ready');
    // Item-Roulette
    if (st.rolling > 0) {
      st.rolling -= dt;
      if (st.rolling <= 0) { st.item = st.nextItem; st.uses = ITEMS[st.item].uses || 1; sfx('got'); }
    }
    // ?-Boxen
    const t = performance.now() / 1000;
    for (const b of boxes) {
      if (b.wait > 0) { b.wait -= dt; b.mesh.visible = b.wait <= 0; if (b.wait > 0) continue; }
      b.mesh.rotation.y = t * 1.6 + b.phase; b.mesh.rotation.x = Math.sin(t + b.phase) * 0.3;
      if (Math.hypot(car.x - b.x, car.z - b.z) < 2.6) {
        b.wait = 3; b.mesh.visible = false;
        spawnFx('box', { x: b.x, z: b.z, y: b.mesh.position.y });
        st.special = Math.min(1, st.special + CHARGE_PER_BOX);
        if (!st.item && st.rolling <= 0) { st.rolling = 1.1; st.nextItem = rollItem(); sfx('box'); }
      }
    }
    // Pfützen
    for (let k = hazards.length - 1; k >= 0; k--) {
      const h = hazards[k];
      h.life -= dt;
      if (h.life <= 0) { hazardGroup.remove(h.mesh); hazards.splice(k, 1); continue; }
      if (h.life < 2) h.mesh.scale.setScalar(Math.max(0.01, h.life / 2));
      if (Math.hypot(car.x - h.x, car.z - h.z) < h.r + 0.8 && spinOut(1.2)) { /* rutscht */ }
    }
    updateHud();
  }

  // Für die Physik: wie stark wirken die Effekte gerade?
  function mods() {
    return {
      boost: st.boost > 0 ? 0.4 * st.boostPow : 0,   // +40 % Höchsttempo beim Turbo
      spin: st.spin > 0 ? st.spinDir : 0,
      gripMin: st.grip > 0 || st.star > 0 || st.rocket > 0 ? 1.2 : 0,
      rocket: st.rocket > 0,
      ghost: st.ghost > 0 || st.rocket > 0,
      noTrees: st.spook > 0 || st.rocket > 0,
      offroadFree: st.spook > 0 || st.star > 0 || st.rocket > 0 || st.boost > 0,
      star: st.star > 0, ram: st.ram > 0
    };
  }
  // Kurzform für das Netzwerk: Bits für Stern, Geist, Rammbock, Turbo
  function flags() { return (st.star > 0 ? 1 : 0) | (st.ghost > 0 || st.rocket > 0 ? 2 : 0) | (st.ram > 0 ? 4 : 0) | (st.boost > 0 || st.rocket > 0 ? 8 : 0); }

  // ---------- Anzeige ----------
  let lastHud = '';
  function updateHud() {
    if (!enabled) return;
    let icon = '', label = '';
    if (st.rolling > 0) { const keys = Object.keys(ITEMS); icon = ITEMS[keys[Math.floor(performance.now() / 70) % keys.length]].icon; label = '…'; }
    else if (st.item) { icon = ITEMS[st.item].icon; label = ITEMS[st.item].name + (st.uses > 1 ? ' ×' + st.uses : ''); }
    const sp = SPECIALS[char && char.id] || { name: 'Turbo', icon: '⚡' }, ready = st.special >= 1;
    const key = icon + label + Math.round(st.special * 50) + ready;
    if (key === lastHud) return;
    lastHud = key;
    $('itemIcon').textContent = icon || '';
    $('itemSlot').classList.toggle('empty', !icon);
    $('itemName').textContent = label || '?-Box einsammeln';
    $('specFill').style.width = Math.round(st.special * 100) + '%';
    $('specName').textContent = sp.icon + ' ' + sp.name + (ready ? ' – bereit!' : '');
    $('itemHud').classList.toggle('ready', ready);
    $('btnItem').classList.toggle('dim', !st.item || st.rolling > 0);
    $('btnSpecial').classList.toggle('dim', !ready);
    $('btnSpecial').textContent = sp.icon;
  }

  // ---------- Geräusche ----------
  function sfx(name) {
    const a = getAudio(); if (!a) return;
    const ctx = a.ctx, t = ctx.currentTime, out = ctx.destination;
    const tone = (type, f0, f1, dur, vol, delay) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, t + (delay || 0)); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + (delay || 0) + dur);
      g.gain.setValueAtTime(0.0001, t + (delay || 0)); g.gain.exponentialRampToValueAtTime(vol, t + (delay || 0) + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + (delay || 0) + dur);
      o.connect(g).connect(out); o.start(t + (delay || 0)); o.stop(t + (delay || 0) + dur + 0.05);
    };
    const noise = (dur, vol, freq, type) => {
      const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = b; f.type = type || 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
      s.connect(f).connect(g).connect(out); s.start(t); return f;
    };
    switch (name) {
      case 'box': for (let k = 0; k < 6; k++) tone('square', 600 + k * 120, 0, 0.06, 0.05, k * 0.11); break;
      case 'got': tone('triangle', 880, 0, 0.1, 0.12); tone('triangle', 1320, 0, 0.18, 0.12, 0.09); break;
      case 'boost': { const f = noise(0.8, 0.35, 900, 'bandpass'); f.frequency.exponentialRampToValueAtTime(3000, t + 0.6); tone('sawtooth', 200, 600, 0.5, 0.08); break; }
      case 'star': for (let k = 0; k < 8; k++) tone('square', [523, 659, 784, 1047][k % 4], 0, 0.1, 0.06, k * 0.09); break;
      case 'drop': tone('sine', 300, 80, 0.25, 0.2); break;
      case 'charge': tone('sine', 400, 1600, 0.5, 0.12); break;
      case 'ready': tone('triangle', 660, 0, 0.12, 0.1); tone('triangle', 990, 0, 0.2, 0.1, 0.12); break;
      case 'spin': tone('sawtooth', 700, 150, 0.7, 0.07); noise(0.5, 0.15, 2500); break;
      case 'fart': { // Schiss-Boost
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), l = ctx.createOscillator(), lg = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(60, t + 0.9);
        l.frequency.value = 23; lg.gain.value = 30; l.connect(lg).connect(o.frequency);
        f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 6;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.04); g.gain.setValueAtTime(0.35, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
        o.connect(f).connect(g).connect(out); o.start(t); l.start(t); o.stop(t + 1.05); l.stop(t + 1.05);
        noise(0.9, 0.12, 300);
        break;
      }
      default: { // Fahrer-Hupen wiederverwenden
        const hornFor = { funk: 'funk', grunz: 'grunz', schrei: 'schrei', miau: 'miau', ghost: 'geist' }[name];
        if (hornFor && window.Drivers) Drivers.honk({ horn: hornFor === 'geist' ? 'geist' : hornFor }, ctx, out);
      }
    }
  }

  function specialInfo(c) { return SPECIALS[c.id] || { name: 'Turbo', icon: '⚡', info: 'Ein kurzer Turbo.' }; }

  // ---------- Für die Bots ----------
  // Prüft, ob an (x, z) eine ?-Box liegt; wenn ja, wird sie eingesammelt
  function grabBox(x, z) {
    if (!enabled) return false;
    for (const b of boxes) if (b.wait <= 0 && Math.hypot(x - b.x, z - b.z) < 2.6) {
      b.wait = 3; b.mesh.visible = false; spawnFx('box', { x: b.x, z: b.z, y: b.mesh.position.y }); return true;
    }
    return false;
  }
  // Liegt an (x, z) eine Pfütze?
  function hazardAt(x, z) { for (const h of hazards) if (Math.hypot(x - h.x, z - h.z) < h.r + 0.8) return h; return null; }
  function addHazard(type, x, z, broadcast) { makeHazard(type, x, z); if (broadcast) sendEvent({ k: 'hz', type, x: +x.toFixed(2), z: +z.toFixed(2) }); }
  function rollFor(band) { // zufälliges Item für einen Bot
    const table = ODDS[band] || ODDS.mid, sum = Object.values(table).reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (const [k, w] of Object.entries(table)) { r -= w; if (r <= 0) return k; }
    return 'turbo';
  }

  return { setup, update, useItem, useSpecial, mods, flags, remoteEvent, spinOut, specialInfo, grabBox, hazardAt, addHazard, rollFor, sfx,
    ITEMS, get enabled() { return enabled; }, state: st };
})();
