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
    terrainSeg: MOBILE ? [104, 80] : [140, 108],
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
  const carCfg = CARS[0];
  let char = CHARACTERS[0];
  try { char = CHARACTERS.find(c => c.id === localStorage.getItem('rennspiel-char')) || char; } catch (e) {}
  let carModel = buildCarModel(carCfg, char);
  const headlight = new THREE.SpotLight('#fff3cf', 1.8, 80, 0.55, 0.5, 1);
  headlight.position.set(1.8, 1, 0);
  headlight.target.position.set(20, -1, 0);
  carModel.group.add(headlight, headlight.target);

  // Fahrwerte = Auto × Fahrer
  let perf = {};
  function computePerf() {
    const st = char.stats;
    perf = { maxSpeed: carCfg.maxSpeed * st.top, accel: carCfg.accel * st.accel, brake: carCfg.brake,
             handling: carCfg.handling * st.handling, grip: st.grip, offroad: st.offroad };
  }
  computePerf();

  // Fahrer wechseln: Auto mit neuer Figur und Farbe bauen
  function setCharacter(c) {
    char = c;
    try { localStorage.setItem('rennspiel-char', c.id); } catch (e) {}
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
    if (key === 'r' && phase !== 'menu') startRace();
    if (key === 'c') switchCam();
    if (key === 'p' || key === 'escape') togglePause();
    if (key === 'h') honk();
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
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 50;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 700;
      const gain = ctx.createGain(); gain.gain.value = 0;
      osc.connect(filt).connect(gain).connect(ctx.destination); osc.start();
      audio = { ctx, osc, gain };
    } catch (e) { audio = null; }
  }
  function beep(freq, dur) {
    if (!audio || muted) return;
    const { ctx } = audio, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  }
  function updateEngine() {
    if (!audio) return;
    const t = audio.ctx.currentTime;
    const active = !muted && (phase === 'race' || phase === 'countdown' || phase === 'finished');
    audio.gain.gain.setTargetAtTime(active ? 0.045 : 0, t, 0.08);
    audio.osc.frequency.setTargetAtTime(48 + Math.abs(car.speed) * 2.3, t, 0.05);
  }
  let lastHonk = 0;
  function honk() {
    ensureAudio();
    if (!audio || muted || performance.now() - lastHonk < 500) return;
    lastHonk = performance.now();
    Drivers.honk(char, audio.ctx, audio.ctx.destination);
  }
  function updateSoundBtn() { $('soundBtn').textContent = muted ? '🔇' : '🔊'; }
  $('soundBtn').addEventListener('click', () => {
    muted = !muted; updateSoundBtn(); ensureAudio();
    try { localStorage.setItem('rennspiel-muted', muted ? '1' : '0'); } catch (e) {}
  });
  updateSoundBtn();

  // ---------- Kamera ----------
  const camModes = [
    { name: 'Verfolger', back: 8, up: 3.3, look: 4, lookUp: 1.4 },
    { name: 'Weit', back: 17, up: 7.5, look: 6, lookUp: 0.5 },
    { name: 'Motorhaube', fixed: true }
  ];
  let camMode = 0, camYaw = 0, camHeight = 0;
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
      camera.position.copy(carModel.group.localToWorld(v1.set(0.85, 1.55, 0)));
      camera.lookAt(carModel.group.localToWorld(v2.set(20, 1.1, 0)));
      return;
    }
    // Die Kamera bleibt immer gleich weit hinter dem Auto und dreht sich nur sanft mit
    let diff = car.angle - camYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    camYaw += diff * blend;
    const dx = Math.cos(camYaw), dz = Math.sin(camYaw);
    camTarget.set(car.x - dx * m.back, 0, car.z - dz * m.back);
    const wantY = Math.max(car.y + m.up, world.surfaceHeight(camTarget.x, camTarget.z) + 1.2);
    camHeight = blend >= 1 ? wantY : camHeight + (wantY - camHeight) * Math.min(1, blend * 1.5);
    camTarget.y = camHeight;
    camera.position.copy(camTarget);
    camera.lookAt(v2.set(car.x + dx * m.look, car.y + m.lookUp, car.z + dz * m.look));
  }

  // ---------- Spielzustand ----------
  let phase = 'menu'; // menu, countdown, race, finished, paused
  let pausedFrom = null;
  let countdown = 3, gameTime = 0, raceStart = 0, lapStart = 0, lap = 1, lapTimes = [];
  let lastIndex = 0, halfway = false, finishTimer = 0, distSinceFx = 0;
  let menuAngle = 0;

  function placeCarAtStart() {
    const i = world.N - 3, p = world.path[i], t = world.tang[i];
    car.x = p.x; car.z = p.z; car.angle = Math.atan2(t.z, t.x);
    car.speed = 0; car.vx = 0; car.vz = 0; car.slip = 0; car.steerVis = 0; car.pitch = 0; car.roll = 0;
    car.y = world.surfaceHeight(car.x, car.z);
    lastIndex = i;
    applyCarToModel();
  }

  function startRace() {
    resetKeys();
    placeCarAtStart();
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
    if (phase === 'race' || phase === 'countdown') {
      pausedFrom = phase; phase = 'paused'; resetKeys();
      $('pauseMenu').style.display = 'flex';
    } else if (phase === 'paused') {
      phase = pausedFrom; $('pauseMenu').style.display = 'none';
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && (phase === 'race' || phase === 'countdown')) togglePause(); });

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
    const inWater = !onRoad && theme.shoreZ != null && world.terrainHeight(car.x, car.z) < -0.75;
    const sf = surface = surfaceAt(r, onRoad, inWater);

    const fx = Math.cos(car.angle), fz = Math.sin(car.angle); // nach vorne
    const sx = -fz, sz = fx;                                    // zur Seite
    let vF = car.vx * fx + car.vz * fz; // Tempo nach vorne
    let vS = car.vx * sx + car.vz * sz; // Rutschen zur Seite

    // Steigung: bergauf langsamer, bergab schneller
    const slope = Math.sin(car.pitch);
    const off = sf.topAbs ? perf.offroad : 1; // Gelände-Talent des Fahrers
    const top = (sf.topAbs ? sf.topAbs * off : perf.maxSpeed * sf.top) * clamp(1 - 2 * slope, 0.6, 1.3);
    const grip = Math.min(1.2, sf.grip * perf.grip);

    if (input.up) { if (vF < top) vF += perf.accel * Math.min(1, sf.accel * off) * dt; }
    else if (input.down) vF -= (vF > 0 ? perf.brake * (0.35 + 0.65 * grip) : 20 * sf.accel) * dt;
    else { const fr = 14 * dt; vF = Math.abs(vF) < fr ? 0 : vF - Math.sign(vF) * fr; }
    vF -= 9.81 * slope * 0.8 * dt;                       // Schwerkraft
    if (vF > top) vF = Math.max(top, vF - sf.drag / off * dt); // zu schnell für den Untergrund
    if (vF < -15) vF = -15;

    // Seitliches Rutschen wird je nach Grip abgebaut
    vS *= Math.exp(-grip * 20 * dt);

    car.vx = fx * vF + sx * vS;
    car.vz = fz * vF + sz * vS;

    // Lenken (bei wenig Grip reagiert das Auto träger)
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    car.steerVis += (steer * 0.45 - car.steerVis) * Math.min(1, dt * 10);
    const steerAmt = Math.min(1, Math.abs(vF) / 12) * (0.55 + 0.45 * Math.min(1, grip));
    car.angle += steer * perf.handling * steerAmt * Math.sign(vF) * dt;

    car.x += car.vx * dt; car.z += car.vz * dt;
    car.speed = vF; car.slip = vS;
    const LX = 200, LZ = 150; // unsichtbare Wand
    if (Math.abs(car.x) > LX || Math.abs(car.z) > LZ) {
      car.x = clamp(car.x, -LX, LX); car.z = clamp(car.z, -LZ, LZ); car.vx *= -0.3; car.vz *= -0.3;
    }

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
    for (const w of carModel.wheels) w.rotation.z -= step / 0.45;

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
    if (drv && drv.userData.float) drv.position.y = 1.15 + Math.sin(performance.now() / 300) * 0.06;
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
        if (lapTimes.length >= track.laps) finishRace();
        else {
          lap++;
          flash(lap === track.laps ? 'Letzte Runde!' : 'Runde ' + lap, 1.2);
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
    flash('ZIEL!', 1.6); setTimeout(honk, 500);
    beep(880, 0.15); setTimeout(() => beep(1320, 0.3), 160);
  }
  function showResults() {
    const r = lastResult;
    $('resTrack').textContent = track.name;
    $('resTotal').innerHTML = fmt(r.total) + (r.newTotal ? ' <span class="badge">Rekord!</span>' : '');
    $('resLaps').innerHTML = lapTimes.map((t, i) =>
      `<div class="${t === r.best ? 'bestlap' : ''}">Runde ${i + 1}: ${fmt(t)}${t === r.best && r.newLap ? ' <span class="badge">Rekord!</span>' : ''}</div>`).join('');
    $('results').style.display = 'flex';
  }

  // ---------- Anzeige ----------
  function updateHud() {
    $('lap').textContent = Math.min(lap, track.laps) + ' / ' + track.laps;
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
      portrait(c) { return cache[c.id] || (cache[c.id] = shot(Drivers.build(c), 150, 150, [1.7, 0.95, 0.75], [0, 0.66, 0])); },
      car(c) { return shot(buildCarModel(carCfg, c).group, 460, 280, [5.2, 2.6, 4.6], [0, 0.95, 0]); }
    };
  })();

  function statBars(v) {
    const n = clamp(Math.round(3 + (v - 1) * 14), 1, 5);
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
    $('charImg').src = preview.car(char);
    $('charName').textContent = char.name;
    $('charTitle').textContent = char.title;
    $('charInfo').textContent = char.info;
    const st = char.stats;
    $('charStats').innerHTML = [['Tempo', st.top], ['Beschleunigung', st.accel], ['Lenkung', st.handling], ['Grip', st.grip], ['Gelände', st.offroad]]
      .map(([l, v]) => `<div class="st"><span>${l}</span><b>${statBars(v)}</b></div>`).join('');
  }
  $('hornTest').addEventListener('click', honk);

  // ---------- Menü ----------
  function renderMenu() {
    renderChars();
    const grid = $('trackGrid');
    grid.innerHTML = '';
    for (const t of TRACKS) {
      const th = THEMES[t.theme], rec = getRecord(t.id);
      const card = document.createElement('button');
      card.className = 'card';
      card.style.background = `linear-gradient(165deg, ${th.skyTop} 0%, ${th.skyBottom} 52%, ${th.ground} 53%, ${th.groundVar} 100%)`;
      card.innerHTML = `<div class="emoji">${th.emoji}</div><div class="cinfo"><div class="cname">${t.name}</div>
        <div class="ctheme">${th.name} · ${t.laps} Runden</div><div class="cdesc">${t.info}</div>
        <div class="crec">🏆 ${rec.total != null ? fmt(rec.total) : 'noch keine Zeit'}</div></div>`;
      card.addEventListener('click', () => { ensureAudio(); chooseTrack(t); });
      grid.appendChild(card);
    }
  }
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
  $('resumeBtn').addEventListener('click', togglePause);
  $('restartBtn').addEventListener('click', startRace);
  $('menuBtn').addEventListener('click', goToMenu);
  $('againBtn').addEventListener('click', startRace);
  $('resMenuBtn').addEventListener('click', goToMenu);

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
      camera.position.set(Math.cos(menuAngle) * 230, 95, Math.sin(menuAngle) * 170);
      camera.lookAt(0, 0, 0);
    } else if (phase !== 'paused') {
      placeCamera(camModes[camMode].fixed ? 1 : 1 - Math.pow(0.004, dt));
    }
    world.update(dt, camera, carModel.group.position);
    renderer.render(world.scene, camera);
    if (phase !== 'menu') { updateHud(); drawMinimap(); }
    updateEngine();
    requestAnimationFrame(loop);
  }

  // Start: erste Strecke als Menü-Hintergrund laden
  loadTrack(TRACKS[0]);
  placeCarAtStart();
  goToMenu();
  $('loading').style.display = 'none';
  requestAnimationFrame(loop);

  // Für Tests und zum Ausprobieren in der Konsole
  window.__game = {
    chooseTrack: id => chooseTrack(TRACKS.find(t => t.id === id)), get world() { return world; }, camera, renderer, car, keys,
    // Simuliert Sekunden ohne Bild (zum Testen)
    sim(sec, input) { Object.assign(keys, input || {}); for (let t = 0; t < sec; t += 1 / 60) update(1 / 60); },
    get phase() { return phase; }, togglePause, lapTimes: () => lapTimes
  };
})();
