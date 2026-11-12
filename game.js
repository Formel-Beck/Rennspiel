// =====================================================
//  SPIEL-LOGIK
//  Menü, Rennen, Physik, Kamera, Anzeige, Sound.
// =====================================================
(() => {
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  if (typeof THREE === 'undefined') { $('loading').textContent = '3D-Grafik konnte nicht geladen werden.'; return; }

  const MOBILE = window.matchMedia('(pointer: coarse)').matches;

  // ---------- Renderer & Qualität ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.id = 'game';
  document.body.prepend(renderer.domElement);

  const Q = {
    shadows: true,
    shadowMap: MOBILE ? 1024 : 2048,
    terrainRes: MOBILE ? 4.8 : 3.8, // Meter pro Gelände-Kästchen
    terrainMaxVerts: MOBILE ? 45000 : 75000, // höchstens so viele Gelände-Punkte
    propScale: MOBILE ? 0.7 : 1,
    snowCount: MOBILE ? 900 : 1800,
    aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy())
  };

  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1600);
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    $('rotateHint').style.display = (MOBILE && innerHeight > innerWidth && phase !== 'menu') ? 'block' : 'none';
  }
  addEventListener('resize', resize);

  // ---------- Auto ----------
  // Gewähltes Fahrzeug und gewählter Fahrer (werden gespeichert)
  let carCfg = CARS[0], char = CHARACTERS[0];
  try {
    carCfg = CARS.find(c => c.id === localStorage.getItem('rennspiel-car')) || carCfg;
    char = CHARACTERS.find(c => c.id === localStorage.getItem('rennspiel-char')) || char;
  } catch (e) {}
  let carModel = buildCarModel(carCfg, char);
  const headlight = new THREE.SpotLight('#fff3cf', 1.8, 80, 0.55, 0.5, 1);
  headlight.position.set(1.8, 1, 0);
  headlight.target.position.set(20, -1, 0);
  carModel.group.add(headlight, headlight.target);

  // Einstellbare Werte (der Entwicklermodus ändert sie)
  const PHYS = { gripAll: 1, slide: 20, gravity: 0.8, offroadSpeed: 1, collisions: true, bounce: 1.3, ignoreStats: false };
  const TUNE = { maxSpeed: 1, accel: 1, brake: 1, handling: 1 }; // Multiplikatoren fürs Fahrzeug
  const RACE = { laps: 0, itemsAll: false }, SOUND = { engineVol: 1 }, DEBUG = { fps: false, info: false };
  const lapsNeeded = () => (MP.racing && MP.laps) || RACE.laps || track.laps;

  // Fahrwerte = Fahrzeug × Fahrer-Bonus × Entwicklermodus
  let perf = {};
  function computePerf() {
    const st = PHYS.ignoreStats ? { top: 1, accel: 1, handling: 1, grip: 1, offroad: 1 } : char.stats;
    const v = carCfg;
    perf = {
      maxSpeed: v.maxSpeed * st.top * TUNE.maxSpeed, accel: v.accel * st.accel * TUNE.accel,
      brake: v.brake * TUNE.brake, handling: v.handling * st.handling * TUNE.handling,
      grip: v.grip * st.grip, loose: v.loose * st.grip, offroad: v.offroad * st.offroad
    };
  }
  computePerf();

  // Fahrer oder Fahrzeug wechseln: Modell neu bauen
  function setCharacter(c) {
    char = c;
    try { localStorage.setItem('rennspiel-char', c.id); } catch (e) {}
    rebuildCar();
    MP.updateInfo();
  }
  function setVehicle(v) {
    carCfg = v;
    try { localStorage.setItem('rennspiel-car', v.id); } catch (e) {}
    rebuildCar();
    MP.updateInfo();
    if (audio) { audio.engine.stop(); audio.engine = EngineSound(audio.ctx, audio.ctx.destination, carCfg.sound); }
  }
  function rebuildCar() {
    const parent = carModel.group.parent;
    if (parent) parent.remove(carModel.group);
    carModel.group.remove(headlight, headlight.target);
    carModel.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    carModel = buildCarModel(carCfg, char);
    carModel.group.add(headlight, headlight.target);
    if (parent) parent.add(carModel.group);
    computePerf();
    applyCarToModel();
  }
  const car = { x: 0, y: 0, z: 0, vx: 0, vz: 0, angle: 0, speed: 0, slip: 0, steerVis: 0, pitch: 0, roll: 0 };

  // ---------- Partikel (Staub, Rauch, Spritzer) ----------
  const particleGroup = new THREE.Group();
  const particles = [];
  {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    for (let i = 0; i < (MOBILE ? 60 : 110); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      particleGroup.add(s);
      particles.push({ s, life: 0, max: 1, size: 1, vx: 0, vy: 0, vz: 0 });
    }
  }
  let pNext = 0;
  function spawnParticle(x, y, z, color, size, vy) {
    const p = particles[pNext]; pNext = (pNext + 1) % particles.length;
    p.s.visible = true; p.s.position.set(x, y, z); p.s.material.color.set(color);
    p.life = p.max = 0.7 + Math.random() * 0.5; p.size = size;
    p.vx = (Math.random() - 0.5) * 1.5; p.vy = vy; p.vz = (Math.random() - 0.5) * 1.5;
    p.s.scale.setScalar(size);
  }
  function updateParticles(dt) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      const t = 1 - p.life / p.max;
      p.s.scale.setScalar(p.size * (1 + t * 2.5));
      p.s.material.opacity = (1 - t) * 0.55;
    }
  }
  function clearParticles() { for (const p of particles) { p.life = 0; p.s.visible = false; } }

  // ---------- Strecke laden ----------
  let world = null, track = null, theme = null;
  function disposeScene(scene) {
    scene.remove(carModel.group); scene.remove(particleGroup);
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        for (const k of ['map', 'emissiveMap']) if (m[k]) m[k].dispose();
        m.dispose();
      });
    });
  }
  function loadTrack(def) {
    clearRemotes();
    if (world) disposeScene(world.scene);
    track = def; theme = THEMES[def.theme];
    world = buildWorld(def, theme, Q);
    world.scene.add(carModel.group, particleGroup);
    headlight.visible = !!theme.night;
    prepMinimap();
  }

  // ---------- Bestzeiten ----------
  function getRecord(id) { try { return JSON.parse(localStorage.getItem('rennspiel-' + id)) || {}; } catch (e) { return {}; } }
  function setRecord(id, rec) { try { localStorage.setItem('rennspiel-' + id, JSON.stringify(rec)); } catch (e) {} }
  function fmt(t) {
    if (t == null) return '–';
    const m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  // ---------- Eingabe ----------
  const keys = { up: false, down: false, left: false, right: false };
  const keyMap = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
  addEventListener('keydown', e => {
    const key = e.key.toLowerCase(), k = keyMap[key];
    if (k) { keys[k] = true; e.preventDefault(); }
    if (e.repeat) return;
    if (key === 'r' && phase !== 'menu' && !MP.racing) startRace();
    if (key === 'c') switchCam();
    if (key === 'p' || key === 'escape') togglePause();
    if (key === 'h') honk();
    if ((key === ' ' || key === 'e') && phase === 'race') { e.preventDefault(); Items.useItem(car); }
    if (key === 'q' && phase === 'race') Items.useSpecial(car);
  });
  addEventListener('keyup', e => { const k = keyMap[e.key.toLowerCase()]; if (k) keys[k] = false; });
  document.querySelectorAll('.btn').forEach(btn => {
    const k = btn.dataset.key;
    const on = e => { e.preventDefault(); keys[k] = true; btn.classList.add('on'); };
    const off = () => { keys[k] = false; btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, off));
  });
  const resetKeys = () => { for (const k in keys) keys[k] = false; document.querySelectorAll('.btn').forEach(b => b.classList.remove('on')); };

  // ---------- Sound (Motor + Pieptöne) ----------
  let audio = null, muted = false;
  try { muted = localStorage.getItem('rennspiel-muted') === '1'; } catch (e) {}
  function ensureAudio() {
    try {
      if (audio) { audio.ctx.resume(); return; }
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audio = { ctx, engine: EngineSound(ctx, ctx.destination, carCfg.sound) };
    } catch (e) { audio = null; }
  }
  function beep(freq, dur) {
    if (!audio || muted) return;
    const { ctx } = audio, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  }
  function updateEngine(dt) {
    if (!audio) return;
    // Motor nur während Countdown und Rennen – im Ziel geht er aus
    const active = !muted && !document.hidden && (phase === 'race' || phase === 'countdown');
    audio.engine.update(dt, car.speed, perf.maxSpeed, active && keys.up ? 1 : 0, active && SOUND.engineVol > 0, car.slip, Math.sin(car.pitch), SOUND.engineVol);
  }
  // App verlassen oder Bildschirm aus: alle Töne sofort anhalten
  function suspendAudio() { if (audio) try { audio.ctx.suspend(); } catch (e) {} }
  document.addEventListener('visibilitychange', () => {
    if (!audio) return;
    if (document.hidden) suspendAudio(); else try { audio.ctx.resume(); } catch (e) {}
  });
  window.addEventListener('pagehide', suspendAudio);

  // Crash-Geräusch
  let lastCrash = 0;
  function crashSound(strength) {
    if (!audio || muted || performance.now() - lastCrash < 250) return;
    lastCrash = performance.now();
    const ctx = audio.ctx, t = ctx.currentTime, dur = 0.35;
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = b; f.type = 'lowpass'; f.frequency.value = 500 + strength * 40; g.gain.value = Math.min(0.5, 0.12 + strength * 0.02);
    src.connect(f).connect(g).connect(ctx.destination); src.start(t);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    og.gain.setValueAtTime(Math.min(0.5, strength * 0.03), t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + 0.3);
  }
  let lastHonk = 0;
  function honk() {
    ensureAudio();
    if (!audio || muted || performance.now() - lastHonk < 500) return;
    lastHonk = performance.now();
    Drivers.honk(char, audio.ctx, audio.ctx.destination);
    MP.sendHonk();
  }
  function updateSoundBtn() { $('soundBtn').textContent = muted ? '🔇' : '🔊'; }
  $('soundBtn').addEventListener('click', () => {
    muted = !muted; updateSoundBtn(); ensureAudio();
    try { localStorage.setItem('rennspiel-muted', muted ? '1' : '0'); } catch (e) {}
  });
  updateSoundBtn();

  // ---------- Kamera ----------
  const camModes = [
    { name: 'Verfolger', back: 8, up: 3.3, look: 4, lookUp: 1.4, fov: 65 },
    { name: 'Weit', back: 17, up: 7.5, look: 6, lookUp: 0.5 },
    { name: 'Motorhaube', fixed: true }
  ];
  let camMode = 0, camYaw = 0, camHeight = 0, shake = 0;
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), camTarget = new THREE.Vector3();
  function switchCam() {
    if (phase === 'menu') return;
    camMode = (camMode + 1) % camModes.length;
    flash(camModes[camMode].name, 0.8);
    placeCamera(1);
  }
  function placeCamera(blend) {
    const m = camModes[camMode];
    if (m.fixed) { // fest auf der Motorhaube
      carModel.group.updateMatrixWorld();
      camera.position.copy(carModel.group.localToWorld(v1.set(carModel.hoodCam[0], carModel.hoodCam[1], 0)));
      camera.lookAt(carModel.group.localToWorld(v2.set(20, carModel.hoodCam[1] - 0.45, 0)));
      return;
    }
    // Die Kamera bleibt immer gleich weit hinter dem Auto und dreht sich nur sanft mit
    let diff = car.angle - camYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    camYaw += diff * blend;
    const dx = Math.cos(camYaw), dz = Math.sin(camYaw);
    const big = carModel.seat[1] - 1.1; // grosse Fahrzeuge: Kamera höher und weiter weg, kleine: näher
    let back = m.back + big * 1.6; // steht ein Haus oder Baum im Weg? Dann näher ran
    for (let k = 0; k < 6 && world.collide(car.x - dx * back, car.z - dz * back, 0.8); k++) back *= 0.7;
    camTarget.set(car.x - dx * back, 0, car.z - dz * back);
    const wantY = Math.max(car.y + m.up + big * 0.9, world.surfaceHeight(camTarget.x, camTarget.z) + 1.2);
    camHeight = blend >= 1 ? wantY : camHeight + (wantY - camHeight) * Math.min(1, blend * 1.5);
    camTarget.y = camHeight;
    camera.position.copy(camTarget);
    if (shake > 0.01) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.88; }
    camera.lookAt(v2.set(car.x + dx * m.look, car.y + m.lookUp + big * 0.6, car.z + dz * m.look));
  }

  // ---------- Spielzustand ----------
  let phase = 'menu'; // menu, countdown, race, finished, paused
  let pausedFrom = null;
  let countdown = 3, gameTime = 0, raceStart = 0, lapStart = 0, lap = 1, lapTimes = [];
  let lastIndex = 0, halfway = false, finishTimer = 0, distSinceFx = 0;
  let menuAngle = 0, myFinish = null, padBoost = 0;
  const NO_MODS = { boost: 0, spin: 0, gripMin: 0, rocket: false, ghost: false, noTrees: false, offroadFree: false, star: false, ram: false };
  const itemMods = () => Items.enabled && (phase === 'race') ? Items.mods() : NO_MODS;

  // slot = Startplatz (0 = vorne links, 1 = vorne rechts, 2 = zweite Reihe links …)
  function placeCarAtStart(slot) {
    slot = slot || 0;
    const N = world.N, i = (N - 3 - Math.floor(slot / 2) * 2 + N) % N, p = world.path[i], t = world.tang[i], n = world.norm[i];
    const side = MP.racing ? (slot % 2 ? 1 : -1) * Math.min(4, world.edge - 3) : 0;
    car.x = p.x + n.x * side; car.z = p.z + n.z * side; car.angle = Math.atan2(t.z, t.x);
    car.speed = 0; car.vx = 0; car.vz = 0; car.slip = 0; car.steerVis = 0; car.pitch = 0; car.roll = 0;
    car.y = world.surfaceHeight(car.x, car.z);
    lastIndex = i;
    applyCarToModel();
  }

  function startRace(slot) {
    resetKeys();
    placeCarAtStart(typeof slot === 'number' ? slot : 0);
    myFinish = null; padBoost = 0;
    Items.setup({
      world, track, char, enabled: !!track.items || RACE.itemsAll,
      getAudio: () => (audio && !muted ? audio : null),
      sendEvent: e => MP.sendEvent(e),
      getPlace: () => { if (!MP.racing) return null; const s = standings(); return { place: s.findIndex(e => e.me) + 1, total: s.length }; },
      spawnFx
    });
    phase = 'countdown'; countdown = 3;
    lap = 1; lapTimes = []; halfway = false; finishTimer = 0;
    clearParticles();
    placeCamera(1);
    setUI('race');
    $('results').style.display = 'none';
    $('pauseMenu').style.display = 'none';
    flash('3', 1); beep(440, 0.15);
  }

  function goToMenu() {
    phase = 'menu';
    resetKeys();
    setUI('menu');
    renderMenu();
  }

  function togglePause() {
    if (MP.racing && phase !== 'menu') { // im Mehrspieler kann man nicht anhalten – die anderen fahren weiter
      const pm = $('pauseMenu'); pm.style.display = pm.style.display === 'flex' ? 'none' : 'flex'; resetKeys(); return;
    }
    if (phase === 'race' || phase === 'countdown') {
      pausedFrom = phase; phase = 'paused'; resetKeys();
      $('pauseMenu').style.display = 'flex';
    } else if (phase === 'paused') {
      phase = pausedFrom; $('pauseMenu').style.display = 'none';
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && !MP.racing && (phase === 'race' || phase === 'countdown')) togglePause(); });

  // ---------- Nachrichten ----------
  const msgEl = $('msg');
  let msgTimer = 0;
  function flash(text, seconds) { msgEl.textContent = text; msgTimer = seconds; }

  // ---------- Physik ----------
  // Welcher Untergrund ist hier?
  function surfaceAt(r, onRoad, inWater) {
    if (inWater) return SURFACES.water;
    if (onRoad) {
      const f = r.index / world.N;
      for (const p of track.patches || []) {
        const inside = p.from <= p.to ? (f >= p.from && f < p.to) : (f >= p.from || f < p.to);
        if (inside) return SURFACES[p.surface];
      }
      return SURFACES[theme.roadSurface];
    }
    if (theme.beachSand && car.z > theme.shoreZ - 22) return SURFACES.sand;
    return SURFACES[theme.offroadSurface];
  }

  // Das Auto hat eine Fahrtrichtung (angle) UND eine Bewegung (vx, vz).
  // Bei viel Grip zeigt die Bewegung schnell wieder in Fahrtrichtung,
  // bei wenig Grip rutscht das Auto seitlich weiter – es driftet!
  let surface = SURFACES.asphalt;
  function stepCar(dt, input) {
    const r = world.roadInfo(car.x, car.z);
    const onRoad = r.dist < world.edge + world.CURB;
    const wl = onRoad ? null : world.waterAt(car.x, car.z);
    const inWater = wl != null && world.terrainHeight(car.x, car.z) < wl - 0.15;
    const sf = surface = surfaceAt(r, onRoad, inWater);
    const M = itemMods(); // Effekte von Items und Spezial-Boosts
    if (sf.boost) padBoost = 1.1; // über ein Turbo-Feld gefahren

    // Rakete: fährt von selbst der Strecke entlang
    if (M.rocket) {
      const tgt = world.path[(r.index + 10) % world.N];
      let a = Math.atan2(tgt.z - car.z, tgt.x - car.x) - car.angle; a = Math.atan2(Math.sin(a), Math.cos(a));
      input = { up: true, down: false, left: a < -0.03, right: a > 0.03 };
    }
    // Schleudern: Lenken und Gas gehen nicht, das Auto dreht sich
    if (M.spin) { input = { up: false, down: false, left: false, right: false }; car.angle += M.spin * 8.5 * dt; }

    const fx = Math.cos(car.angle), fz = Math.sin(car.angle); // nach vorne
    const sx = -fz, sz = fx;                                    // zur Seite
    let vF = car.vx * fx + car.vz * fz; // Tempo nach vorne
    let vS = car.vx * sx + car.vz * sz; // Rutschen zur Seite

    // Steigung: bergauf langsamer, bergab schneller
    const slope = Math.sin(car.pitch);
    const offFree = M.offroadFree && sf.topAbs;                // Turbo/Stern/Spuk: Wiese bremst nicht
    const off = sf.topAbs && !offFree ? perf.offroad : 1;      // Gelände-Talent von Fahrzeug und Fahrer
    const boostAmt = Math.max(M.boost, padBoost > 0 ? 0.45 : 0, M.rocket ? 0.55 : 0);
    let top = (sf.topAbs && !offFree ? sf.topAbs * off * PHYS.offroadSpeed : perf.maxSpeed * (sf.top || 1)) * clamp(1 - 2 * slope, 0.6, 1.3);
    top *= 1 + boostAmt;
    let grip = Math.min(1.3, sf.grip * (sf.grip < 0.7 ? perf.loose : perf.grip)) * PHYS.gripAll; // rutschiger Boden: Fahrzeug-Wert 'loose'
    if (M.gripMin) grip = Math.max(grip, M.gripMin);
    if (boostAmt > 0 && vF < top) vF += perf.accel * 1.6 * dt; // Turbo schiebt kräftig an
    if (M.spin) vF *= Math.exp(-1.6 * dt);

    const traction = clamp(grip * 1.6, 0.3, 1); // wenig Grip = Räder drehen durch, man kommt schlechter vom Fleck
    if (input.up) { if (vF < top) vF += perf.accel * Math.min(1, sf.accel * off) * traction * dt; }
    else if (input.down) vF -= (vF > 0 ? perf.brake * (0.35 + 0.65 * grip) : 20 * sf.accel) * dt;
    else { const fr = 14 * dt; vF = Math.abs(vF) < fr ? 0 : vF - Math.sign(vF) * fr; }
    vF -= 9.81 * slope * PHYS.gravity * dt;                 // Schwerkraft
    if (vF > top) vF = Math.max(top, vF - sf.drag / off * dt); // zu schnell für den Untergrund
    if (vF < -15) vF = -15;

    // Seitliches Rutschen wird je nach Grip abgebaut
    vS *= Math.exp(-grip * PHYS.slide * dt);

    car.vx = fx * vF + sx * vS;
    car.vz = fz * vF + sz * vS;

    // Lenken (bei wenig Grip reagiert das Auto träger)
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    car.steerVis += (steer * 0.45 - car.steerVis) * Math.min(1, dt * 10);
    const steerAmt = Math.min(1, Math.abs(vF) / 12) * (0.55 + 0.45 * Math.min(1, grip));
    car.angle += steer * perf.handling * steerAmt * Math.sign(vF) * dt;

    car.x += car.vx * dt; car.z += car.vz * dt;
    car.speed = vF; car.slip = vS;
    // Tunnel: Wände links und rechts
    if (world.inTunnel[r.index]) {
      const p = world.path[r.index], n = world.norm[r.index];
      const side = (car.x - p.x) * n.x + (car.z - p.z) * n.z, lim = world.edge + 0.6;
      if (Math.abs(side) > lim) {
        const sg = Math.sign(side), over = Math.abs(side) - lim;
        car.x -= n.x * sg * over; car.z -= n.z * sg * over;
        const vn = car.vx * n.x * sg + car.vz * n.z * sg;
        if (vn > 0) { car.vx -= 1.4 * vn * n.x * sg; car.vz -= 1.4 * vn * n.z * sg; if (vn > 6) { crashSound(vn); shake = Math.min(0.5, vn / 30); } }
      }
    }
    const LX = world.limits.x, LZ = world.limits.z; // unsichtbare Wand am Weltrand
    if (Math.abs(car.x) > LX || Math.abs(car.z) > LZ) {
      car.x = clamp(car.x, -LX, LX); car.z = clamp(car.z, -LZ, LZ); car.vx *= -0.3; car.vz *= -0.3;
    }

    // Zusammenstösse mit Bäumen, Häusern, Felsen … (zwei Kreise: vorne und hinten am Auto)
    let bump = 0, bx = 0, bz = 0;
    const cr = carModel.collide;
    for (const o of PHYS.collisions && !M.noTrees ? [cr.off, -cr.off] : []) {
      const push = world.collide(car.x + fx * o, car.z + fz * o, cr.r);
      if (!push) continue;
      car.x += push.x; car.z += push.z;
      const L = Math.hypot(push.x, push.z) || 1, nx = push.x / L, nz = push.z / L;
      const vn = car.vx * nx + car.vz * nz;
      if (vn < 0) { car.vx -= PHYS.bounce * vn * nx; car.vz -= PHYS.bounce * vn * nz; if (-vn > bump) { bump = -vn; bx = car.x + fx * o - nx; bz = car.z + fz * o - nz; } }
      car.vx *= 0.97; car.vz *= 0.97;
    }
    // Rempeln mit den Autos der anderen Spieler
    if (MP.racing && !M.ghost) for (const rc of remoteCars.values()) {
      if (!rc.visible || (rc.f & 2)) continue; // Geist/Schatten/Rakete: durchfahren
      const rr = rc.model.collide, rfx = Math.cos(rc.a), rfz = Math.sin(rc.a);
      for (const o of [cr.off, -cr.off]) for (const q of [rr.off, -rr.off]) {
        const dx = car.x + fx * o - (rc.x + rfx * q), dz = car.z + fz * o - (rc.z + rfz * q);
        const d = Math.hypot(dx, dz), min = cr.r + rr.r;
        if (d >= min || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d, push = (min - d) * 0.5; // jeder schiebt sich selbst die Hälfte weg
        const heavy = M.star || M.ram;                    // mit Stern/Rammbock wird man selbst kaum geschoben
        car.x += nx * push * (heavy ? 0.2 : 1); car.z += nz * push * (heavy ? 0.2 : 1);
        if ((rc.f & 1 || rc.f & 4) && !heavy && Items.spinOut(1.0)) { car.vx += nx * 14; car.vz += nz * 14; } // vom Stern/Rammbock weggeschleudert
        const vn = (car.vx - rc.vx) * nx + (car.vz - rc.vz) * nz;
        if (vn < 0) { const k = heavy ? 0.15 : 0.75; car.vx -= k * vn * nx; car.vz -= k * vn * nz; if (-vn > bump) { bump = -vn; bx = car.x - nx * cr.r; bz = car.z - nz * cr.r; } }
      }
    }
    if (bump > 3) {
      crashSound(bump);
      shake = Math.min(0.7, bump / 25);
      for (let k = 0; k < Math.min(8, 2 + bump / 4); k++) spawnParticle(bx, car.y + 0.8, bz, k % 2 ? '#ffd27a' : '#bbbbbb', 0.7, 1.5 + Math.random() * 2);
    }
    car.speed = car.vx * fx + car.vz * fz;

    // Höhe und Neigung: Boden vorne/hinten/links/rechts messen
    const dx = Math.cos(car.angle), dz = Math.sin(car.angle), ox = -dz, oz = dx;
    const hf = world.surfaceHeight(car.x + dx * 1.4, car.z + dz * 1.4);
    const hb = world.surfaceHeight(car.x - dx * 1.4, car.z - dz * 1.4);
    const hl = world.surfaceHeight(car.x + ox * 0.9, car.z + oz * 0.9);
    const hr = world.surfaceHeight(car.x - ox * 0.9, car.z - oz * 0.9);
    const targetY = Math.max(-0.9, (hf + hb) / 2);
    car.y += (targetY - car.y) * Math.min(1, dt * 14);
    const lean = clamp(-vS * 0.012, -0.08, 0.08) - steer * 0.04 * clamp(vF / perf.maxSpeed, 0, 1);
    car.pitch += (Math.atan2(hf - hb, 2.8) - car.pitch) * Math.min(1, dt * 10);
    car.roll += (-Math.atan2(hl - hr, 1.8) + lean - car.roll) * Math.min(1, dt * 10);

    const step = vF * dt;
    for (const w of carModel.wheels) w.rotation.z -= step / carModel.wheelR;

    // Turbo: Flammen aus dem Auspuff
    if (boostAmt > 0 && Math.random() < 0.6) spawnParticle(car.x - dx * (cr.off + 1.2), car.y + 0.6, car.z - dz * (cr.off + 1.2), Math.random() < 0.5 ? '#ff9800' : '#ffd54a', 0.7, 0.5);

    // Effekte: Rauch beim Rutschen, Staub im Gelände, Spritzer im Wasser
    distSinceFx += Math.hypot(car.vx, car.vz) * dt;
    const sliding = Math.abs(vS) > 2.5;
    const dusty = sf.dusty && Math.abs(vF) > 5;
    const splash = sf.splash && Math.abs(vF) > 5;
    if ((sliding || dusty || splash) && distSinceFx > 0.7) {
      distSinceFx = 0;
      for (const sgn of [-1, 1]) {
        spawnParticle(car.x - dx * 1.6 + ox * sgn * 0.9, car.y + 0.4, car.z - dz * 1.6 + oz * sgn * 0.9,
          sf.fx, splash ? 1.2 : 0.9, splash ? 3 : 0.8);
      }
    }
    return r;
  }

  function applyCarToModel() {
    carModel.group.position.set(car.x, car.y, car.z);
    carModel.group.rotation.set(car.roll, -car.angle, car.pitch, 'YZX');
    for (const p of carModel.frontPivots) p.rotation.y = -car.steerVis;
    const drv = carModel.driver;
    if (drv && drv.userData.float) drv.position.y = drv.userData.baseY + 0.05 + Math.sin(performance.now() / 300) * 0.06;
  }

  // ---------- Spiel-Update ----------
  const NO_INPUT = { up: false, down: false, left: false, right: false };
  function update(dt) {
    if (phase === 'menu' || phase === 'paused') return;
    gameTime += dt;

    if (phase === 'countdown') {
      const before = Math.ceil(countdown);
      countdown -= dt;
      if (countdown <= 0) {
        phase = 'race'; raceStart = lapStart = gameTime;
        flash('LOS!', 0.8); beep(880, 0.35);
      } else if (Math.ceil(countdown) !== before) {
        flash(String(Math.ceil(countdown)), 1); beep(440, 0.15);
      }
      stepCar(dt, NO_INPUT);
      return;
    }

    let input = keys;
    if (phase === 'finished') input = { up: false, down: car.speed > 3, left: false, right: false };
    if (padBoost > 0) padBoost -= dt;
    if (phase === 'race') Items.update(dt, car);
    const r = stepCar(dt, input);

    if (phase === 'race') {
      const i = r.index, N = world.N;
      if (i > N * 0.4 && i < N * 0.6) halfway = true;
      const fwd = lastIndex > N * 0.85 && i < N * 0.15;
      const back = lastIndex < N * 0.15 && i > N * 0.85;
      if (back) halfway = false;
      if (fwd && halfway) {
        const t = gameTime - lapStart;
        lapTimes.push(t); lapStart = gameTime; halfway = false;
        if (lapTimes.length >= lapsNeeded()) finishRace();
        else {
          lap++;
          flash(lap === lapsNeeded() ? 'Letzte Runde!' : 'Runde ' + lap, 1.2);
          beep(660, 0.2);
        }
      }
      lastIndex = i;
    }

    if (phase === 'finished') {
      finishTimer += dt;
      if (finishTimer > 1.6 && $('results').style.display !== 'flex') showResults();
    }
  }

  let lastResult = null;
  function finishRace() {
    phase = 'finished';
    const total = gameTime - raceStart, best = Math.min(...lapTimes);
    const rec = getRecord(track.id);
    const newTotal = rec.total == null || total < rec.total, newLap = rec.lap == null || best < rec.lap;
    if (newTotal) rec.total = total;
    if (newLap) rec.lap = best;
    setRecord(track.id, rec);
    lastResult = { total, best, newTotal, newLap };
    myFinish = total;
    if (MP.racing) MP.sendFinish(total);
    flash('ZIEL!', 1.6); setTimeout(honk, 500);
    beep(880, 0.15); setTimeout(() => beep(1320, 0.3), 160);
  }
  function showResults() {
    const r = lastResult;
    $('againBtn').style.display = MP.racing ? 'none' : '';
    $('resMenuBtn').textContent = MP.active ? 'Zur Lobby' : 'Strecke wählen';
    $('resMP').style.display = MP.racing ? '' : 'none';
    if (MP.racing) renderStandings();
    $('resTrack').textContent = track.name;
    $('resTotal').innerHTML = fmt(r.total) + (r.newTotal ? ' <span class="badge">Rekord!</span>' : '');
    $('resLaps').innerHTML = lapTimes.map((t, i) =>
      `<div class="${t === r.best ? 'bestlap' : ''}">Runde ${i + 1}: ${fmt(t)}${t === r.best && r.newLap ? ' <span class="badge">Rekord!</span>' : ''}</div>`).join('');
    $('results').style.display = 'flex';
  }

  // ---------- Mehrspieler: Platzierung ----------
  // Fortschritt: gefahrene Runden + Anteil der aktuellen Runde
  function myProgress() {
    if (myFinish != null) return 1000;
    let f = lastIndex / world.N;
    if (lapTimes.length === 0 && !halfway && f > 0.5) f -= 1; // vor der Startlinie
    return lapTimes.length + f;
  }
  function standings() {
    const list = [];
    for (const p of MP.players.values()) {
      const me = p.id === MP.myId, buf = MP.remote.get(p.id);
      const pr = me ? myProgress() : (buf && buf.length ? buf[buf.length - 1].s.pr : -1);
      list.push({ id: p.id, name: p.name, me, pr, fin: me ? myFinish : MP.finishes.get(p.id), color: (CHARACTERS.find(c => c.id === p.char) || CHARACTERS[0]).color });
    }
    list.sort((a, b) => (a.fin != null) !== (b.fin != null) ? (a.fin != null ? -1 : 1) : a.fin != null ? a.fin - b.fin : b.pr - a.pr);
    return list;
  }
  function renderStandings() {
    const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    $('resMP').innerHTML = '<b>Rangliste</b>' + standings().map((e, k) =>
      `<div class="mpRes${e.me ? ' me' : ''}" style="--c:${e.color}"><span>${k + 1}.</span><span class="nm">${esc(e.name)}</span><span>${e.fin != null ? fmt(e.fin) : 'fährt noch …'}</span></div>`).join('');
  }
  setInterval(() => { if (MP.racing && $('results').style.display === 'flex') renderStandings(); }, 500);

  // ---------- Anzeige ----------
  function updateHud() {
    $('placeRow').style.display = MP.racing ? '' : 'none';
    if (MP.racing) { const st = standings(); $('place').textContent = (st.findIndex(e => e.me) + 1) + ' / ' + st.length; }
    $('lap').textContent = Math.min(lap, lapsNeeded()) + ' / ' + lapsNeeded();
    const racing = phase === 'race' || (phase === 'paused' && pausedFrom === 'race');
    $('time').textContent = fmt(racing ? gameTime - raceStart : phase === 'finished' ? lastResult.total : 0);
    $('laptime').textContent = fmt(racing ? gameTime - lapStart : 0);
    $('best').textContent = fmt(getRecordCached().lap);
    $('speed').textContent = Math.round(Math.abs(car.speed) * 3);
    const se = $('surface');
    if (se.textContent !== surface.name) { se.textContent = surface.name; se.classList.toggle('warn', !!surface.warn); }
  }
  let recCache = null, recCacheId = null;
  function getRecordCached() {
    if (recCacheId !== track.id + phase) { recCache = getRecord(track.id); recCacheId = track.id + phase; }
    return recCache;
  }

  // ---------- Minikarte ----------
  const mini = $('mini'), mctx = mini.getContext('2d');
  let mapImg = null, mapScale = 1, mapOX = 0, mapOZ = 0;
  function prepMinimap() {
    const b = world.bounds, M = 12;
    mapScale = Math.min((mini.width - 2 * M) / (b.maxX - b.minX + world.W), (mini.height - 2 * M) / (b.maxZ - b.minZ + world.W));
    mapOX = mini.width / 2 - (b.minX + b.maxX) / 2 * mapScale;
    mapOZ = mini.height / 2 - (b.minZ + b.maxZ) / 2 * mapScale;
    mapImg = document.createElement('canvas'); mapImg.width = mini.width; mapImg.height = mini.height;
    const g = mapImg.getContext('2d');
    g.beginPath();
    world.path.forEach((p, i) => { const x = mapOX + p.x * mapScale, y = mapOZ + p.z * mapScale; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath();
    g.lineJoin = 'round'; g.lineWidth = world.W * mapScale + 3; g.strokeStyle = 'rgba(255,255,255,.85)'; g.stroke();
    g.lineWidth = world.W * mapScale; g.strokeStyle = '#555'; g.stroke();
    const s = world.path[0];
    g.fillStyle = '#fff'; g.fillRect(mapOX + s.x * mapScale - 3, mapOZ + s.z * mapScale - 3, 6, 6);
  }
  function drawMinimap() {
    mctx.clearRect(0, 0, mini.width, mini.height);
    mctx.drawImage(mapImg, 0, 0);
    for (const rc of remoteCars.values()) {
      if (!rc.visible) continue;
      mctx.beginPath(); mctx.arc(mapOX + rc.x * mapScale, mapOZ + rc.z * mapScale, 4, 0, Math.PI * 2);
      mctx.fillStyle = rc.ch.color; mctx.fill();
    }
    const x = mapOX + car.x * mapScale, y = mapOZ + car.z * mapScale;
    mctx.beginPath(); mctx.arc(x, y, 5, 0, Math.PI * 2);
    mctx.fillStyle = char.color; mctx.fill(); mctx.lineWidth = 2; mctx.strokeStyle = '#fff'; mctx.stroke();
  }

  // ---------- Vorschaubilder der Fahrer ----------
  const preview = (() => {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setClearColor(0x000000, 0);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight('#ffffff', '#4a4a5a', 0.85));
    const dl = new THREE.DirectionalLight('#ffffff', 0.85); dl.position.set(4, 6, 3); sc.add(dl);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    function shot(obj, w, h, pos, look) {
      r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      sc.add(obj); cam.position.set(...pos); cam.lookAt(...look);
      r.render(sc, cam);
      const url = r.domElement.toDataURL('image/png');
      sc.remove(obj);
      obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      return url;
    }
    const cache = {};
    return {
      portrait(c) {
        if (cache[c.id]) return cache[c.id];
        // Kamera auf den Kopf richten (funktioniert für eingebaute und eigene Modelle)
        const d = Drivers.build(c), top = new THREE.Box3().setFromObject(d).max.y, y = top - 0.32;
        return (cache[c.id] = shot(d, 150, 150, [1.7, y + 0.3, 0.75], [0, y, 0]));
      },
      car(v, c) { return shot(buildCarModel(v, c).group, 460, 280, [5.2, 2.6, 4.6], [0, 0.95, 0]); },
      vehicle(v, c) { const k = v.id + '|' + c.id; return cache[k] || (cache[k] = shot(buildCarModel(v, c).group, 180, 120, [5.6, 2.8, 5.0], [0, 0.9, 0])); },
      forget(id) { for (const k in cache) if (k === id || k.endsWith('|' + id)) delete cache[k]; }
    };
  })();

  // Kleine Fahrer-Boni als Text, z.B. "+4 % Tempo"
  function bonusChips(st) {
    const names = { top: 'Tempo', accel: 'Beschleunigung', handling: 'Lenkung', grip: 'Grip', offroad: 'Gelände' };
    const chips = Object.keys(names).filter(k => Math.abs(st[k] - 1) > 0.001).map(k => {
      const p = Math.round((st[k] - 1) * 100);
      return `<span class="chip ${p > 0 ? 'up' : 'down'}">${p > 0 ? '+' : '−'}${Math.abs(p)} % ${names[k]}</span>`;
    });
    return chips.length ? chips.join('') : '<span class="chip">keine Boni</span>';
  }
  // Fahrzeug-Werte als Balken (1–5), im Vergleich zu den anderen Fahrzeugen
  function carBars(key, v) {
    const vals = CARS.map(c => c[key]), mn = Math.min(...vals), mx = Math.max(...vals);
    const n = mx === mn ? 3 : 1 + Math.round(4 * (v - mn) / (mx - mn));
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<i class="${i <= n ? 'on' : ''}"></i>`;
    return h;
  }

  function renderChars() {
    const grid = $('charGrid');
    grid.innerHTML = '';
    for (const c of CHARACTERS) {
      const b = document.createElement('button');
      b.className = 'char' + (c.id === char.id ? ' sel' : '');
      b.style.setProperty('--c', c.color);
      b.innerHTML = `<img src="${preview.portrait(c)}" alt=""><span>${c.name}</span>`;
      b.addEventListener('click', () => { if (c.id !== char.id) { setCharacter(c); renderChars(); } honk(); });
      grid.appendChild(b);
    }
    $('charImg').src = preview.portrait(char);
    $('charName').textContent = char.name;
    $('charTitle').textContent = char.title;
    $('charInfo').textContent = char.info;
    $('charStats').innerHTML = bonusChips(char.stats);
    const sp = Items.specialInfo(char);
    $('charSpecial').innerHTML = `<b>${sp.icon} Spezial: ${sp.name}</b> – ${sp.info} <small>(auf Item-Strecken)</small>`;
    $('sumChar').textContent = char.name;
  }

  function renderCars() {
    const grid = $('carGrid');
    grid.innerHTML = '';
    for (const v of CARS) {
      const b = document.createElement('button');
      b.className = 'char vehicle' + (v.id === carCfg.id ? ' sel' : '');
      b.style.setProperty('--c', char.color);
      b.innerHTML = `<img src="${preview.vehicle(v, char)}" alt=""><span>${v.name}<small>${v.type}</small></span>`;
      b.addEventListener('click', () => { if (v.id !== carCfg.id) { setVehicle(v); renderCars(); } });
      grid.appendChild(b);
    }
    $('carImg').src = preview.car(carCfg, char);
    $('carName').textContent = carCfg.name;
    $('carType').textContent = carCfg.type;
    $('carInfo').textContent = carCfg.info;
    $('carStats').innerHTML = [['Tempo', 'maxSpeed'], ['Beschleunigung', 'accel'], ['Lenkung', 'handling'], ['Grip Asphalt', 'grip'], ['Grip Schnee/Eis/Sand', 'loose'], ['Gelände', 'offroad']]
      .map(([l, k]) => `<div class="st"><span>${l}</span><b>${carBars(k, carCfg[k])}</b></div>`).join('');
    $('sumCar').textContent = carCfg.name;
  }
  $('hornTest').addEventListener('click', honk);

  // Menü-Schritte: 0 = Fahrer, 1 = Fahrzeug, 2 = Strecke
  let menuStep = 0;
  function showStep(i) {
    menuStep = i;
    document.querySelectorAll('#steps .tab').forEach((t, k) => t.classList.toggle('active', k === i));
    document.querySelectorAll('.page').forEach((p, k) => { p.style.display = k === i ? '' : 'none'; });
    if (i === 1) renderCars();
    $('menu').scrollTop = 0;
  }
  document.querySelectorAll('#steps .tab').forEach((t, k) => t.addEventListener('click', () => showStep(k)));
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showStep(+b.dataset.go)));

  // ---------- Menü ----------
  const DIFF = { 1: ['Leicht', 'easy'], 2: ['Mittel', 'mid'], 3: ['Schwer', 'hard'] };
  function renderMenu() {
    renderChars();
    renderCars();
    const grid = $('trackGrid');
    grid.innerHTML = '';
    const sorted = TRACKS.slice().sort((a, b) => (a.difficulty || 2) - (b.difficulty || 2));
    for (const t of sorted) {
      const th = THEMES[t.theme], rec = getRecord(t.id), d = DIFF[t.difficulty || 2];
      const card = document.createElement('button');
      card.className = 'card';
      card.style.background = `linear-gradient(165deg, ${th.skyTop} 0%, ${th.skyBottom} 52%, ${th.ground} 53%, ${th.groundVar} 100%)`;
      card.innerHTML = `<div class="emoji">${th.emoji}<span class="diff ${d[1]}">${d[0]}</span>${t.items ? '<span class="diff itm">🎁 Items</span>' : ''}</div><div class="cinfo"><div class="cname">${t.name}</div>
        <div class="ctheme">${th.name} · ${t.laps} Runden</div><div class="cdesc">${t.info}</div>
        <div class="crec">🏆 ${rec.total != null ? fmt(rec.total) : 'noch keine Zeit'}</div></div>`;
      card.addEventListener('click', () => { ensureAudio(); chooseTrack(t); });
      grid.appendChild(card);
    }
    showStep(menuStep);
  }

  // Eigene 3D-Modelle laden (falls in characters.js eingetragen)
  Drivers.loadModels(CHARACTERS, c => {
    preview.forget(c.id);
    if (c.id === char.id) rebuildCar();
    if (phase === 'menu') renderMenu();
  });

  // Am Handy: Vollbild und Querformat beim Start eines Rennens
  function goFullscreen() {
    if (!MOBILE || document.fullscreenElement || isInstalled()) return;
    const el = document.documentElement;
    try {
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
      if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
    } catch (e) {}
  }
  function isInstalled() {
    return window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  // "Als App installieren": Android/Chrome zeigt einen Knopf, iPhone eine Anleitung
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); installEvent = e;
    $('installBox').style.display = 'block'; $('installBtn').style.display = ''; $('iosHint').style.display = 'none';
  });
  $('installBtn').addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt();
    try { await installEvent.userChoice; } catch (e) {}
    installEvent = null; $('installBox').style.display = 'none';
  });
  window.addEventListener('appinstalled', () => { $('installBox').style.display = 'none'; });
  const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (IOS && !isInstalled() && location.protocol === 'https:' && window.top === window) {
    $('installBox').style.display = 'block'; $('installBtn').style.display = 'none'; $('iosHint').style.display = 'block';
  }

  function chooseTrack(t) {
    goFullscreen();
    $('loading').style.display = 'flex';
    $('loading').textContent = 'Lade ' + t.name + ' …';
    setTimeout(() => {
      if (!track || track.id !== t.id) loadTrack(t);
      $('loading').style.display = 'none';
      startRace();
    }, 40);
  }

  function setUI(mode) {
    const inRace = mode === 'race';
    $('menu').style.display = inRace ? 'none' : 'flex';
    for (const id of ['hud', 'topBtns', 'mini']) $(id).style.display = inRace ? '' : 'none';
    $('touch').classList.toggle('show', inRace && MOBILE);
    $('help').style.display = inRace && !MOBILE ? '' : 'none';
    if (!inRace) { $('results').style.display = 'none'; $('pauseMenu').style.display = 'none'; msgEl.textContent = ''; }
    resize();
  }

  // Knöpfe
  $('pauseBtn').addEventListener('click', togglePause);
  $('camBtn').addEventListener('click', switchCam);
  $('hornBtn').addEventListener('click', honk);
  for (const [id, fn] of [['btnItem', () => Items.useItem(car)], ['btnSpecial', () => Items.useSpecial(car)], ['itemSlot', () => Items.useItem(car)], ['specBar', () => Items.useSpecial(car)]])
    $(id).addEventListener('pointerdown', e => { e.preventDefault(); if (phase === 'race') fn(); });
  $('resumeBtn').addEventListener('click', togglePause);
  $('restartBtn').addEventListener('click', startRace);
  $('menuBtn').addEventListener('click', () => { goToMenu(); if (MP.active) showStep(2); });
  $('againBtn').addEventListener('click', startRace);
  $('resMenuBtn').addEventListener('click', () => { if (MP.active) { if (MP.isHost) MP.endRace(); goToMenu(); showStep(2); } else goToMenu(); });

  // ---------- Game Loop ----------
  let prev = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    update(dt);
    applyCarToModel();
    updateParticles(dt);
    if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) msgEl.textContent = ''; }

    if (phase === 'menu') { // Kamera kreist langsam über die Strecke
      menuAngle += dt * 0.07;
      camera.position.set(Math.cos(menuAngle) * world.size * 1.05, world.size * 0.45, Math.sin(menuAngle) * world.size * 0.8);
      camera.lookAt(0, 0, 0);
    } else if (phase !== 'paused') {
      placeCamera(camModes[camMode].fixed ? 1 : 1 - Math.pow(0.004, dt));
    }
    updateRemotes(dt);
    updateFx(dt);
    if (phase !== 'menu') {
      const f = (Items.enabled && phase === 'race' ? Items.flags() : 0) | (padBoost > 0 ? 8 : 0);
      applyLook(carModel, f & 7, dt, null);
      const wantFov = (camModes[0].fov || 65) + (f & 8 ? 10 : 0); // Turbo: Sichtfeld weiter
      if (Math.abs(camera.fov - wantFov) > 0.1) { camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); }
    }
    const ri = phase !== 'menu' ? world.roadInfo(car.x, car.z) : null;
    world.update(dt, camera, carModel.group.position, ri && world.inTunnel[ri.index] && ri.dist < world.edge + 3);
    renderer.render(world.scene, camera);
    if (phase !== 'menu') { updateHud(); drawMinimap(); }
    updateEngine(dt);
    updateDebug(dt);
    requestAnimationFrame(loop);
  }

  // ---------- Entwicklermodus ----------
  DevMode.init({
    targets: { tune: TUNE, phys: PHYS, cam: camModes[0], surf: SURFACES, race: RACE, sound: SOUND, debug: DEBUG },
    onChange(path) {
      if (path.startsWith('tune.') || path === 'phys.ignoreStats') computePerf();
      if (path === 'cam.fov') { camera.fov = camModes[0].fov; camera.updateProjectionMatrix(); }
      if (path.startsWith('debug.')) $('debug').style.display = DEBUG.fps || DEBUG.info ? 'block' : 'none';
    }
  });
  $('devBtn').addEventListener('click', () => DevMode.open());
  $('devBtn2').addEventListener('click', () => DevMode.open());
  $('devClose').addEventListener('click', () => DevMode.close());
  $('devReset').addEventListener('click', () => DevMode.reset());
  $('devCopy').addEventListener('click', () => DevMode.copy());

  // Technik-Anzeige (FPS, Gang, Drehzahl …)
  let fpsFrames = 0, fpsTime = 0, fpsValue = 0, dbgTimer = 0;
  function updateDebug(dt) {
    fpsFrames++; fpsTime += dt;
    if (fpsTime >= 0.5) { fpsValue = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }
    if (!(DEBUG.fps || DEBUG.info) || (dbgTimer += dt) < 0.2) return;
    dbgTimer = 0;
    let h = DEBUG.fps ? `<b>${fpsValue} FPS</b>` : '';
    if (DEBUG.info && world) {
      const es = audio && audio.engine.state ? audio.engine.state() : null;
      const r = world.roadInfo(car.x, car.z);
      h += `<br>Tempo ${car.speed.toFixed(1)} m/s · Rutschen ${car.slip.toFixed(1)} m/s` +
        `<br>Belag ${surface.name.replace('!', '')} (Grip ${(surface.grip * perf.grip * PHYS.gripAll).toFixed(2)})` +
        (es ? `<br>Gang ${es.gear} · Drehzahl ${Math.round(es.rpm * 7000)}` : '') +
        `<br>Steigung ${(Math.sin(car.pitch) * 100).toFixed(0)} % · Runde ${(r.index / world.N * 100).toFixed(0)} %` +
        `<br>Position ${car.x.toFixed(0)} / ${car.z.toFixed(0)}`;
    }
    $('debug').innerHTML = h;
  }

  // ---------- Aussehen bei Items: Stern-Glanz, durchsichtig, rote Aura, Flammen ----------
  let auraTex = null;
  function getAuraTex() {
    if (auraTex) return auraTex;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return (auraTex = new THREE.CanvasTexture(c));
  }
  function applyLook(model, f, dt, s) {
    const ud = model.group.userData;
    if (!ud.aura) {
      ud.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: getAuraTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      ud.aura.scale.setScalar(6.5); ud.aura.position.y = 1.2; ud.aura.visible = false;
      model.group.add(ud.aura);
    }
    const t = performance.now() / 1000;
    ud.aura.visible = !!(f & 1 || f & 4);
    if (f & 1) ud.aura.material.color.setHSL((t * 1.5) % 1, 1, 0.6);   // Stern: Regenbogen
    else if (f & 4) ud.aura.material.color.set('#ff3d00');           // Rammbock: rot
    const ghost = !!(f & 2);
    if (ghost !== !!ud.ghost) {
      ud.ghost = ghost;
      model.group.traverse(o => {
        if (!o.isMesh || !o.material || o === ud.aura) return;
        for (const m of [].concat(o.material)) {
          if (ghost) { if (m.userData.op == null) m.userData.op = [m.transparent, m.opacity]; m.transparent = true; m.opacity = 0.3; }
          else if (m.userData.op) { [m.transparent, m.opacity] = m.userData.op; m.userData.op = null; }
          m.needsUpdate = true;
        }
      });
    }
    if (s && f & 8 && Math.random() < 0.5) { // Turbo-Flammen der anderen
      const back = model.collide.off + 1.2;
      spawnParticle(s.x - Math.cos(s.a) * back, (s.y || 0) + 0.6, s.z - Math.sin(s.a) * back, Math.random() < 0.5 ? '#ff9800' : '#ffd54a', 0.7, 0.5);
    }
  }
  // Effekte für Items: Konfetti bei ?-Box, Ring bei der Schrei-Welle
  const rings = [];
  function spawnFx(kind, at) {
    const y = (at.y != null ? at.y : car.y) + 0.8;
    if (kind === 'box') { for (let k = 0; k < 8; k++) spawnParticle(at.x, y, at.z, ['#ff4fa3', '#ffe14d', '#4fc3f7', '#69f0ae'][k % 4], 0.6, 2 + Math.random() * 2); }
    if (kind === 'shock') {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.6, 32), new THREE.MeshBasicMaterial({ color: '#e1bee7', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(at.x, y - 0.5, at.z);
      world.scene.add(m); rings.push({ m, t: 0 });
    }
  }
  function updateFx(dt) {
    for (let k = rings.length - 1; k >= 0; k--) {
      const r = rings[k]; r.t += dt;
      r.m.scale.setScalar(1 + r.t * 25); r.m.material.opacity = Math.max(0, 0.8 - r.t * 1.4);
      if (r.t > 0.6) { if (r.m.parent) r.m.parent.remove(r.m); r.m.geometry.dispose(); rings.splice(k, 1); }
    }
  }

  // ---------- Mehrspieler: andere Autos ----------
  const remoteCars = new Map(); // id -> { model, ch, x, z, y, a, vx, vz, visible }
  function nameLabel(name, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = color; g.globalAlpha = 0.85;
    g.beginPath(); g.roundRect ? g.roundRect(8, 8, 240, 48, 16) : g.rect(8, 8, 240, 48); g.fill();
    g.globalAlpha = 1; g.fillStyle = '#fff'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name.slice(0, 14), 128, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true }));
    sp.scale.set(3.4, 0.85, 1); sp.renderOrder = 10;
    return sp;
  }
  function getRemote(id) {
    const p = MP.players.get(id);
    if (!p || !world) return null;
    let rc = remoteCars.get(id);
    if (rc && (rc.char !== p.char || rc.car !== p.car || rc.name !== p.name)) { removeRemote(id); rc = null; }
    if (!rc) {
      const ch = CHARACTERS.find(c => c.id === p.char) || CHARACTERS[0], cv = CARS.find(c => c.id === p.car) || CARS[0];
      const model = buildCarModel(cv, ch);
      const label = nameLabel(p.name || ch.name, ch.color);
      label.position.set(0, model.seat[1] + 2.3, 0);
      model.group.add(label);
      world.scene.add(model.group);
      rc = { model, ch, char: p.char, car: p.car, name: p.name, x: 0, z: 0, y: 0, a: 0, vx: 0, vz: 0, visible: false };
      remoteCars.set(id, rc);
    }
    return rc;
  }
  function removeRemote(id) {
    const rc = remoteCars.get(id); if (!rc) return;
    if (rc.model.group.parent) rc.model.group.parent.remove(rc.model.group);
    rc.model.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    remoteCars.delete(id);
  }
  function clearRemotes() { for (const id of [...remoteCars.keys()]) removeRemote(id); }
  const lerpAngle = (a, b, f) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * f;
  // Position zwischen zwei empfangenen Zeitpunkten berechnen (etwas in der Vergangenheit, damit es weich aussieht)
  function interpolate(buf, t) {
    if (!buf.length) return null;
    const last = buf[buf.length - 1];
    if (t >= last.time) {
      const e = Math.min(0.25, (t - last.time) / 1000), s = last.s;
      return Object.assign({}, s, { x: s.x + s.vx * e, z: s.z + s.vz * e, age: t - last.time });
    }
    let k = buf.length - 1;
    while (k > 0 && buf[k - 1].time > t) k--;
    if (k === 0) return Object.assign({ age: 0 }, buf[0].s);
    const A = buf[k - 1], B = buf[k], f = (t - A.time) / (B.time - A.time), a = A.s, b = B.s;
    const mix = key => a[key] + (b[key] - a[key]) * f;
    return { x: mix('x'), z: mix('z'), y: mix('y'), vx: mix('vx'), vz: mix('vz'), sp: mix('sp'), st: mix('st'), p: mix('p'), r: mix('r'), a: lerpAngle(a.a, b.a, f), pr: b.pr, f: b.f || 0, age: 0 };
  }
  function updateRemotes(dt) {
    if (!MP.racing || phase === 'menu') { if (remoteCars.size) clearRemotes(); return; }
    const t = performance.now() - 120;
    for (const id of [...remoteCars.keys()]) if (!MP.players.has(id)) removeRemote(id);
    for (const [id, buf] of MP.remote) {
      if (id === MP.myId) continue;
      const rc = getRemote(id); if (!rc) continue;
      const s = interpolate(buf, t);
      rc.visible = !!s && s.age < 3000;
      rc.model.group.visible = rc.visible;
      if (!rc.visible) continue;
      Object.assign(rc, { x: s.x, z: s.z, y: s.y, a: s.a, vx: s.vx, vz: s.vz, f: s.f || 0 });
      applyLook(rc.model, rc.f, dt, s);
      rc.model.group.position.set(s.x, s.y, s.z);
      rc.model.group.rotation.set(s.r || 0, -s.a, s.p || 0, 'YZX');
      for (const fp of rc.model.frontPivots) fp.rotation.y = -(s.st || 0);
      for (const w of rc.model.wheels) w.rotation.z -= (s.sp || 0) * dt / rc.model.wheelR;
    }
  }
  const r2 = v => Math.round(v * 100) / 100;

  MP.getInfo = () => ({ name: MP.myName() || char.name, char: char.id, car: carCfg.id });
  MP.getState = () => (phase === 'race' || phase === 'countdown' || phase === 'finished' || phase === 'paused') ? {
    x: r2(car.x), z: r2(car.z), y: r2(car.y), a: r2(car.angle), p: r2(car.pitch), r: r2(car.roll),
    vx: r2(car.vx), vz: r2(car.vz), sp: r2(car.speed), st: r2(car.steerVis), pr: r2(myProgress()),
    f: (Items.enabled ? Items.flags() : 0) | (padBoost > 0 ? 8 : 0)
  } : null;
  MP.onStart = (trackId, slot, laps) => {
    const t = TRACKS.find(x => x.id === trackId) || TRACKS[0];
    $('loading').style.display = 'flex'; $('loading').textContent = 'Lade ' + t.name + ' …';
    setTimeout(() => {
      if (!track || track.id !== t.id) loadTrack(t);
      $('loading').style.display = 'none';
      ensureAudio();
      startRace(slot);
    }, 30);
  };
  MP.onHonk = id => {
    const p = MP.players.get(id);
    if (!p || !audio || muted) return;
    const g = audio.ctx.createGain(); g.gain.value = 0.5; g.connect(audio.ctx.destination);
    Drivers.honk(CHARACTERS.find(c => c.id === p.char) || CHARACTERS[0], audio.ctx, g);
  };
  MP.onLeave = (id, wasRacing) => {
    if (id) { removeRemote(id); return; }
    clearRemotes();
    if (phase !== 'menu') { goToMenu(); setMode(true); showStep(2); }
  };
  MP.onEvent = (id, e) => { if (phase === 'race' || phase === 'countdown') Items.remoteEvent(id, e, car); };
  MP.onLobby = () => { if (phase === 'menu') updateModeUI(); };
  MP.onRaceEnd = () => { if (phase !== 'menu') { goToMenu(); setMode(true); showStep(2); } }; // Gastgeber ist zurück in der Lobby

  // Allein oder mit Freunden?
  let mpMode = false;
  function setMode(multi) {
    mpMode = multi;
    updateModeUI();
  }
  function updateModeUI() {
    $('modeSolo').classList.toggle('active', !mpMode);
    $('modeMP').classList.toggle('active', mpMode);
    $('tab3label').textContent = mpMode ? 'Lobby' : 'Strecke';
    $('tab3sub').textContent = mpMode ? (MP.active ? 'Raum ' + (document.getElementById('mpCode').textContent) : 'mit Freunden') : "los geht's";
    $('trackGrid').style.display = mpMode ? 'none' : '';
    $('lobby').style.display = mpMode ? '' : 'none';
    $('nextToTrack').textContent = mpMode ? 'Weiter: Lobby →' : 'Weiter: Strecke wählen →';
  }
  $('modeSolo').addEventListener('click', () => { setMode(false); });
  $('modeMP').addEventListener('click', () => { setMode(true); showStep(2); });
  $('mpName').addEventListener('change', () => MP.updateInfo());
  const invited = MP.init(); // Raum-Code aus dem Einladungslink (oder null)
  setMode(!!invited);

  // Start: erste Strecke als Menü-Hintergrund laden
  loadTrack(TRACKS[0]);
  placeCarAtStart();
  goToMenu();
  if (invited) { // Mit Einladungslink geöffnet: direkt dem Raum beitreten
    showStep(2);
    setTimeout(() => MP.join(invited), 300);
  }
  $('loading').style.display = 'none';
  requestAnimationFrame(loop);

  // Für Tests und zum Ausprobieren in der Konsole
  window.__game = { get audio() { return audio; }, ensureAudio,
    chooseTrack: id => chooseTrack(TRACKS.find(t => t.id === id)), get world() { return world; }, camera, renderer, car, keys,
    // Simuliert Sekunden ohne Bild (zum Testen)
    sim(sec, input) { Object.assign(keys, input || {}); for (let t = 0; t < sec; t += 1 / 60) update(1 / 60); },
    get phase() { return phase; }, togglePause, lapTimes: () => lapTimes
  };
})();
