// =====================================================
//  BOT-GEGNER (vom Computer gesteuert)
//
//  Jeder Bot fährt entlang der Strecke auf seiner eigenen "Spur"
//  (etwas links oder rechts der Mitte), bremst vor Kurven,
//  sammelt ?-Boxen und benutzt Items und seinen Spezial-Boost.
//
//  STÄRKE: wie schnell die Bots fahren (Anteil vom Höchsttempo)
//  und wie gut sie Kurven fahren und Items einsetzen.
// =====================================================
window.Bots = (() => {
  const LEVELS = {
    1: { name: 'Leicht', speed: 0.8,  corner: 0.85, itemSkill: 0.4, mistakes: 0.5 },
    2: { name: 'Mittel', speed: 0.9,  corner: 1.0,  itemSkill: 0.7, mistakes: 0.2 },
    3: { name: 'Schwer', speed: 0.99, corner: 1.12, itemSkill: 1.0, mistakes: 0.05 }
  };
  let list = [], world = null, track = null, theme = null, level = LEVELS[2], laps = 3, itemsOn = false;
  let hooks = {}; // vom Spiel: spawnParticle, applyLook, onFinish, sendEvent, raceTime, hitPlayer
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

  // ---------- Bots fürs Rennen erstellen ----------
  // entries: [{ id, name, char, car, slot }]
  function setup(opts) {
    clear();
    world = opts.world; track = opts.track; theme = opts.theme; laps = opts.laps; hooks = opts.hooks;
    level = LEVELS[opts.level] || LEVELS[2]; itemsOn = !!opts.items;
    for (const e of opts.entries) {
      const ch = CHARACTERS.find(c => c.id === e.char) || CHARACTERS[0], cv = CARS.find(c => c.id === e.car) || CARS[0];
      const model = buildCarModel(cv, ch);
      world.scene.add(model.group);
      const N = world.N, i = (N - 3 - Math.floor(e.slot / 2) * 2 + N) % N, p = world.path[i], t = world.tang[i], n = world.norm[i];
      const side = (e.slot % 2 ? 1 : -1) * Math.min(4, world.edge - 3);
      const st = ch.stats || {};
      list.push({
        id: e.id, name: e.name, ch, cv, model, isBot: true, visible: true,
        x: p.x + n.x * side, z: p.z + n.z * side, y: p.y, a: Math.atan2(t.z, t.x), vx: 0, vz: 0, speed: 0, steer: 0, pitch: 0, roll: 0,
        maxSpeed: cv.maxSpeed * (st.top || 1), accel: cv.accel * (st.accel || 1), handling: cv.handling * (st.handling || 1),
        grip: cv.grip, loose: cv.loose, offroad: cv.offroad * (st.offroad || 1),
        lane: (Math.random() * 2 - 1) * 0.45, laneTarget: 0, laneTimer: 0,
        idx: i, lastIdx: i, halfway: false, lap: 0, lapStart: 0, finish: null, progress: 0,
        item: null, itemTimer: 0, special: Math.random() * 0.4, boost: 0, boostPow: 1, spin: 0, spinDir: 1, star: 0, ram: 0, ghost: 0, immune: 0, rocket: 0, hitCool: 0,
        mistake: 0, f: 0, fxDist: 0
      });
    }
  }
  function clear() {
    for (const b of list) { if (b.model.group.parent) b.model.group.parent.remove(b.model.group); b.model.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    list = [];
  }

  // Wie stark ist die Kurve vor dem Bot? (0 = gerade, 1+ = sehr eng)
  function curveAhead(i, dist) {
    const N = world.N, steps = Math.max(2, Math.round(dist / 5));
    const t0 = world.tang[i], t1 = world.tang[(i + steps) % N];
    return Math.abs(wrapAngle(Math.atan2(t1.z, t1.x) - Math.atan2(t0.z, t0.x)));
  }
  function surfaceFor(b, onRoad) {
    if (onRoad) {
      const f = b.idx / world.N;
      for (const p of track.patches || []) if (f >= p.from && f < p.to) return SURFACES[p.surface];
      return SURFACES[theme.roadSurface];
    }
    return SURFACES[theme.offroadSurface];
  }

  // ---------- Jedes Bild ----------
  // ctx: { racing, time, player: {x,z,vx,vz,a,f,r,off}, others: [{x,z,vx,vz,a,f,model}], leaderProgress }
  function update(dt, ctx) {
    if (!list.length) return;
    const N = world.N;
    for (const b of list) {
      for (const k of ['boost', 'spin', 'star', 'ram', 'ghost', 'immune', 'rocket', 'hitCool', 'mistake']) if (b[k] > 0) b[k] = Math.max(0, b[k] - dt);
      const r = world.roadInfo(b.x, b.z);
      b.idx = r.index;
      const onRoad = r.dist < world.edge + world.CURB;
      const sf = surfaceFor(b, onRoad);
      if (sf.boost) b.boost = Math.max(b.boost, 1.0);

      // Spur wechseln ab und zu (überholen, Boxen einsammeln)
      b.laneTimer -= dt;
      if (b.laneTimer <= 0) { b.laneTarget = (Math.random() * 2 - 1) * 0.55; b.laneTimer = 2 + Math.random() * 4; }
      b.lane += (b.laneTarget - b.lane) * Math.min(1, dt * 0.8);
      // Fehler: kurz von der Ideallinie abkommen (nur bei leichten Bots öfter)
      if (b.mistake <= 0 && Math.random() < level.mistakes * dt * 0.08) b.mistake = 1 + Math.random();

      // Ziel: ein Punkt etwas voraus auf der eigenen Spur
      const look = clamp(Math.round(3 + b.speed * 0.09), 3, 9), ti = (b.idx + look) % N; // 15–45 m voraus
      const tp = world.path[ti], tn = world.norm[ti];
      const laneOff = (onRoad ? b.lane + (b.mistake > 0 ? 0.7 * Math.sign(b.lane || 1) : 0) : 0) * (world.edge - 3);
      const tx = tp.x + tn.x * laneOff, tz = tp.z + tn.z * laneOff;
      let want = wrapAngle(Math.atan2(tz - b.z, tx - b.x) - b.a);

      // Wunschtempo: Wie schnell geht die Kurve? Das Auto kann sich höchstens so schnell drehen,
      // wie seine Lenkung erlaubt -> Höchsttempo = Lenkung × Kurvenradius. Davor rechtzeitig bremsen.
      let target = b.maxSpeed * level.speed;
      const gripNow = Math.min(1, sf.grip * (sf.grip < 0.7 ? b.loose : b.grip));
      for (const ahead of [0, 15, 35, 60]) {
        const j = (b.idx + Math.round(ahead / 5)) % N, ang = curveAhead(j, 20);
        if (ang < 0.02) continue;
        const R = 20 / ang, vCurve = b.handling * (0.55 + 0.45 * gripNow) * R * level.corner * 0.92;
        target = Math.min(target, Math.sqrt(vCurve * vCurve + 2 * 30 * ahead)); // 30 m/s² Bremsweg
      }
      target = Math.max(target, 14);
      // Gummiband: wer weit hinten ist, wird etwas schneller (nicht zu viel)
      if (ctx.leaderProgress != null) {
        const gap = ctx.leaderProgress - b.progress;
        target *= clamp(1 + gap * 0.25, 0.9, 1.08);
      }
      const slope = Math.sin(b.pitch);
      if (sf.topAbs && !(b.boost > 0 || b.star > 0 || b.rocket > 0)) target = Math.min(target, sf.topAbs * b.offroad);
      else target *= sf.top || 1;
      target *= clamp(1 - 2 * slope, 0.6, 1.3);
      const boostAmt = Math.max(b.boost > 0 ? 0.4 * b.boostPow : 0, b.rocket > 0 ? 0.55 : 0);
      target *= 1 + boostAmt;

      // Grip (rutschige Stellen)
      let grip = sf.grip * (sf.grip < 0.7 ? b.loose : b.grip);
      if (b.star > 0 || b.rocket > 0) grip = Math.max(grip, 1.2);

      if (b.spin > 0) { // schleudert
        b.a += b.spinDir * 8.5 * dt; b.speed *= Math.exp(-1.6 * dt); want = 0;
      } else {
        const acc = b.accel * Math.min(1, (sf.accel || 1) * (sf.topAbs ? b.offroad : 1)) * clamp(grip * 1.6, 0.3, 1) * (boostAmt > 0 ? 2.6 : 1);
        if (b.speed < target) b.speed = Math.min(target, b.speed + acc * dt);
        else b.speed = Math.max(target, b.speed - (sf.drag && b.speed > target + 5 ? Math.max(sf.drag, 40) : 40) * dt);
        b.speed -= 9.81 * slope * 0.8 * dt;
        const turn = b.handling * Math.min(1, b.speed / 12) * (0.55 + 0.45 * Math.min(1, grip)) * (b.rocket > 0 ? 1.4 : 1);
        b.steer = clamp(want * 3, -1, 1);
        b.a += b.steer * turn * dt;
      }
      // Bewegung (bei wenig Grip rutscht der Bot etwas nach)
      const fx = Math.cos(b.a), fz = Math.sin(b.a), sx = -fz, sz = fx;
      let vS = b.vx * sx + b.vz * sz;
      vS *= Math.exp(-Math.max(0.1, grip) * 20 * dt);
      b.vx = fx * b.speed + sx * vS; b.vz = fz * b.speed + sz * vS;
      b.x += b.vx * dt; b.z += b.vz * dt;

      // Zusammenstösse: Bäume/Häuser, Tunnelwände, Spieler, andere Bots, Mitspieler
      const cr = b.model.collide;
      for (const o of [cr.off, -cr.off]) {
        const push = world.collide(b.x + fx * o, b.z + fz * o, cr.r);
        if (push) { b.x += push.x; b.z += push.z; b.speed *= 0.6; }
      }
      if (world.inTunnel[b.idx]) {
        const p = world.path[b.idx], n = world.norm[b.idx], side = (b.x - p.x) * n.x + (b.z - p.z) * n.z, lim = world.edge + 0.6;
        if (Math.abs(side) > lim) { const over = Math.abs(side) - lim; b.x -= n.x * Math.sign(side) * over; b.z -= n.z * Math.sign(side) * over; }
      }
      const cars = [ctx.player].concat(ctx.others || [], list.filter(o => o !== b));
      for (const o of cars) {
        if (!o || o.visible === false || b.ghost > 0 || (o.f & 2) || o.ghost > 0) continue;
        const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz), min = cr.r + (o.model ? o.model.collide.r : 1.05) + 0.8;
        if (d >= min || d < 1e-3) continue;
        const nx = dx / d, nz = dz / d, heavyMe = b.star > 0 || b.ram > 0, heavyO = (o.f & 1) || (o.f & 4) || o.star > 0 || o.ram > 0;
        b.x += nx * (min - d) * (heavyMe ? 0.1 : 0.5); b.z += nz * (min - d) * (heavyMe ? 0.1 : 0.5);
        if (heavyO && !heavyMe) spinBot(b, 1.0, nx * 12, nz * 12);
        else { b.vx += nx * 2; b.vz += nz * 2; }
      }

      // Höhe und Neigung
      const hf = world.surfaceHeight(b.x + fx * 1.4, b.z + fz * 1.4), hb = world.surfaceHeight(b.x - fx * 1.4, b.z - fz * 1.4);
      b.y += ((hf + hb) / 2 - b.y) * Math.min(1, dt * 14);
      b.pitch += (Math.atan2(hf - hb, 2.8) - b.pitch) * Math.min(1, dt * 10);
      b.roll += (-b.steer * 0.04 - b.roll) * Math.min(1, dt * 6);

      // Runden zählen
      if (ctx.racing && b.finish == null) {
        const i = b.idx;
        if (i > N * 0.4 && i < N * 0.6) b.halfway = true;
        if (b.lastIdx > N * 0.85 && i < N * 0.15 && b.halfway) {
          b.lap++; b.halfway = false;
          if (b.lap >= laps) { b.finish = ctx.time; hooks.onFinish && hooks.onFinish(b); }
        }
        if (b.lastIdx < N * 0.15 && i > N * 0.85) b.halfway = false;
        b.lastIdx = i;
        let f = i / N;
        if (b.lap === 0 && !b.halfway && f > 0.5) f -= 1;
        b.progress = b.lap + f;
      }
      if (b.finish != null) b.progress = 1000 - b.finish / 10000;

      if (itemsOn && ctx.racing && b.finish == null) botItems(b, dt, ctx);

      // Pfützen
      if (itemsOn && Items.hazardAt(b.x, b.z)) spinBot(b, 1.2);

      // Effekte und Modell
      if (boostAmt > 0 && Math.random() < 0.5) hooks.spawnParticle(b.x - fx * (cr.off + 1.2), b.y + 0.6, b.z - fz * (cr.off + 1.2), Math.random() < 0.5 ? '#ff9800' : '#ffd54a', 0.7, 0.5);
      b.f = (b.star > 0 ? 1 : 0) | (b.ghost > 0 || b.rocket > 0 ? 2 : 0) | (b.ram > 0 ? 4 : 0) | (boostAmt > 0 ? 8 : 0);
      const g = b.model.group;
      g.position.set(b.x, b.y, b.z);
      g.rotation.set(b.roll, -b.a, b.pitch, 'YZX');
      for (const fp of b.model.frontPivots) fp.rotation.y = -b.steer * 0.4;
      for (const w of b.model.wheels) w.rotation.z -= b.speed * dt / b.model.wheelR;
      hooks.applyLook(b.model, b.f & 7, dt, null);
    }
  }

  function spinBot(b, sec, px, pz) {
    if (b.immune > 0 || b.hitCool > 0 || b.star > 0) return;
    b.spin = sec; b.spinDir = Math.random() < 0.5 ? -1 : 1; b.hitCool = sec + 1.2; b.boost = 0; b.rocket = 0;
    if (px) { b.vx += px; b.vz += pz; }
  }

  // ---------- Items der Bots ----------
  function botItems(b, dt, ctx) {
    b.special = Math.min(1, b.special + dt / 35);
    if (Items.grabBox(b.x, b.z)) {
      b.special = Math.min(1, b.special + 0.15);
      if (!b.item) { b.item = Items.rollFor(b.place === 1 ? 'front' : b.place >= b.total && b.total > 1 ? 'back' : 'mid'); b.uses = Items.ITEMS[b.item].uses || 1; b.itemTimer = 1 + Math.random() * 3 / level.itemSkill; }
    }
    if (b.item && b.spin <= 0 && (b.itemTimer -= dt) <= 0) {
      const it = b.item;
      if (it === 'turbo' || it === 'triple') { if (curveAhead(b.idx, 50) < 0.35) { b.boost = 1.6; b.boostPow = 1; } else { b.itemTimer = 0.4; return; } }
      else if (it === 'oil') dropBehind(b, 'oil');
      else if (it === 'star') { b.star = 7; b.immune = 7; b.boost = 7; b.boostPow = 0.6; }
      else if (it === 'rocket') { b.rocket = 3.5; b.immune = 3.5; }
      else if (it === 'charge') b.special = 1;
      b.uses--; if (b.uses <= 0) b.item = null; else b.itemTimer = 0.8;
    }
    if (b.special >= 1 && b.spin <= 0 && curveAhead(b.idx, 50) < 0.4 && Math.random() < dt * level.itemSkill) {
      b.special = 0;
      const id = b.ch.id;
      b.boost = id === 'beck' ? 2.8 : 1.8; b.boostPow = id === 'beck' ? 1.35 : 1;
      if (id === 'beck') setTimeout(() => dropBehind(b, 'schiss'), 150);
      if (id === 'waechter') b.ram = 5;
      if (id === 'maske' || id === 'geist') { b.ghost = 4.5; b.immune = 4.5; }
      if (id === 'katze') b.immune = 5;
      if (id === 'locken') shock(b.x, b.z, b, true);
    }
  }
  function dropBehind(b, type) {
    const x = b.x - Math.cos(b.a) * 4.5, z = b.z - Math.sin(b.a) * 4.5;
    Items.addHazard(type, x, z, true);
  }
  // Schrei-Welle: wirft Bots in der Nähe herum (und den Spieler, wenn ein Bot schreit)
  function shock(x, z, from, isBot) {
    for (const o of list) {
      if (o === from) continue;
      const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz);
      if (d < 20) spinBot(o, 1.0, dx / (d || 1) * 12, dz / (d || 1) * 12);
    }
    if (isBot && hooks.botShock) hooks.botShock(x, z);
  }

  return {
    setup, update, clear, shock, spinBot, LEVELS,
    list: () => list, get: id => list.find(b => b.id === id),
    // Für das Netzwerk: Zustand jedes Bots wie bei einem Mitspieler
    states: () => list.map(b => ({ id: b.id, s: { x: +b.x.toFixed(2), z: +b.z.toFixed(2), y: +b.y.toFixed(2), a: +b.a.toFixed(2), p: +b.pitch.toFixed(2), r: +b.roll.toFixed(2),
      vx: +b.vx.toFixed(2), vz: +b.vz.toFixed(2), sp: +b.speed.toFixed(2), st: +(b.steer * 0.4).toFixed(2), pr: +b.progress.toFixed(3), f: b.f } }))
  };
})();
