// =====================================================
//  MOTORSOUND
//  Ein echter Motor klingt nach vielen kurzen "Explosionen"
//  (Zündungen) hintereinander. Wir schreiben ein paar Dutzend
//  solche Zündungen in einen Ton-Speicher und spielen ihn in
//  einer Schleife ab – je höher die Drehzahl, desto schneller.
//  Dazu gibt es 3 Gänge: beim Hochschalten fällt die Drehzahl,
//  und ganz oben regelt ein Drehzahlbegrenzer ab.
// =====================================================
window.EngineSound = function (ctx, out, opts) {
  opts = Object.assign({ pitch: 1, sub: 0.25, bright: 1 }, opts || {}); // Klang je nach Fahrzeug
  const sr = ctx.sampleRate, BASE = 40, PULSES = 64;
  const per = sr / BASE, len = Math.floor(per * PULSES);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  for (let p = 0; p < PULSES; p++) {
    const start = Math.floor(p * per + (Math.random() - 0.5) * per * 0.08); // kleine Unregelmässigkeit
    const amp = (p % 2 ? 0.8 : 1) * (0.8 + Math.random() * 0.4);
    const f1 = 40 + Math.random() * 8, f2 = 95 + Math.random() * 20;
    for (let i = 0; i < per * 1.8; i++) {
      const t = i / sr, idx = (start + i + len) % len;
      const body = Math.sin(2 * Math.PI * f1 * t) * Math.exp(-t * 32);        // tiefer, dumpfer Schlag
      const knock = Math.sin(2 * Math.PI * f2 * t) * Math.exp(-t * 110) * 0.4; // Klopfen
      const hiss = (Math.random() * 2 - 1) * Math.exp(-t * 300) * 0.12;        // wenig Auspuff-Zischen
      d[idx] += (body + knock + hiss) * amp;
    }
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  for (let i = 0; i < len; i++) d[i] *= 0.9 / peak;

  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  // Leichte Verzerrung macht den Klang rauer
  const shaper = ctx.createWaveShaper(), curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.2); }
  shaper.curve = curve;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 0.9;
  // Bass: tiefe Frequenzen kräftig anheben
  const bass = ctx.createBiquadFilter(); bass.type = 'lowshelf'; bass.frequency.value = 160; bass.gain.value = 9;
  const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 110; body.Q.value = 1; body.gain.value = 4;
  // Tiefes Brummen darunter (zwei Töne: halbe und ganze Zündfrequenz).
  // Es läuft auch durch die Verzerrung – so hört man den Bass sogar auf Handy-Lautsprechern.
  const sub = ctx.createOscillator(); sub.type = 'sine';
  const sub2 = ctx.createOscillator(); sub2.type = 'triangle';
  const subGain = ctx.createGain(); subGain.gain.value = 0.3 + opts.sub;
  const sub2Gain = ctx.createGain(); sub2Gain.gain.value = 0.15 + opts.sub * 0.5;
  // Verhindert Übersteuern, wenn alles gleichzeitig laut ist
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.12;
  const master = ctx.createGain(); master.gain.value = 0;
  src.connect(shaper);
  sub.connect(subGain).connect(shaper); sub2.connect(sub2Gain).connect(shaper);
  shaper.connect(filter).connect(bass).connect(body).connect(comp).connect(master);
  master.connect(out);
  src.start(); sub.start(); sub2.start();

  // 3 Gänge. Die Autos sind sehr schnell auf Höchsttempo – darum wenige Gänge
  // mit grossem Drehzahlbereich, sonst würde der Motor ständig schalten.
  //   lo/hi = Tempo-Bereich des Gangs (Anteil vom Höchsttempo)
  //   up    = ab hier wird hochgeschaltet, down = darunter runtergeschaltet
  const GEARS = opts.long ? [
    // Lange, schnelle Strecken (Abenteuer-Rallye): 5 Gänge, der letzte ist lang.
    // Bei normaler Höchstgeschwindigkeit dreht der Motor hoch, aber nicht in den
    // Begrenzer – der greift nur, wenn ein Boost über das Höchsttempo schiebt.
    { lo: 0.0,  hi: 0.26, up: 0.23, down: -1 },
    { lo: 0.17, hi: 0.44, up: 0.40, down: 0.15 },
    { lo: 0.34, hi: 0.62, up: 0.58, down: 0.32 },
    { lo: 0.52, hi: 0.82, up: 0.78, down: 0.50 },
    { lo: 0.70, hi: 1.10, up: 99,   down: 0.68 }
  ] : [
    { lo: 0.0,  hi: 0.42, up: 0.38, down: -1 },
    { lo: 0.3,  hi: 0.78, up: 0.72, down: 0.28 },
    { lo: 0.62, hi: 0.99, up: 99,   down: 0.58 }
  ];
  let gear = 0, rpm = 0.12, shiftT = 0;
  // Drehzahlbegrenzer: Bei voller Drehzahl unterbricht der Motor kurz
  // die Zündung, die Drehzahl fällt ein wenig und steigt wieder – "brrrap"
  const LIMIT = 0.97;
  let cutT = 0, limiting = false;

  // speed/maxSpeed = Tempo, throttle = Gas (0/1), active = hörbar?
  // slip = seitliches Rutschen (m/s), slope = Steigung (-1 bis 1)
  function update(dt, speed, maxSpeed, throttle, active, slip, slope, volume) {
    const sf = Math.min(1.1, Math.abs(speed) / maxSpeed);
    // Schalten (mit Abstand zwischen hoch und runter, damit er nicht hin und her springt)
    if (shiftT <= 0) {
      if (sf > GEARS[gear].up && gear < GEARS.length - 1) { gear++; shiftT = 0.22; }
      else if (sf < GEARS[gear].down && gear > 0) { gear--; shiftT = 0.12; }
    }
    shiftT -= dt;
    const G = GEARS[gear];
    const inGear = Math.max(0, Math.min(1, (sf - G.lo) / (G.hi - G.lo)));
    let target;
    if (sf < 0.02) target = throttle ? 0.42 : 0.12;           // Stand: Leerlauf oder Gas geben
    else target = 0.3 + 0.66 * inGear;
    if (throttle && sf < 0.18) target += 0.15 * (1 - sf / 0.18); // Anfahren: Räder drehen kurz durch
    target += Math.min(0.12, Math.abs(slip || 0) * 0.02);       // Rutschen: Drehzahl geht hoch
    if (throttle) target += 0.04;
    // Der Motor dreht weich hoch und fällt beim Schalten schnell ab
    const k = shiftT > 0 ? 14 : (target >= LIMIT && rpm > 0.85 ? 14 : (target > rpm ? 3.2 : 4.5));
    rpm += (target - rpm) * Math.min(1, dt * k);
    // Begrenzer: im Abregeln schnell runter, sonst bis zur Grenze hoch
    limiting = false;
    if (cutT > 0) { cutT -= dt; rpm -= dt * 1.4; limiting = true; }
    else if (throttle && rpm >= LIMIT) { rpm = LIMIT; cutT = 0.055; limiting = true; }
    rpm = Math.min(LIMIT, rpm);

    const load = Math.max(0, slope || 0) * 4;                  // bergauf: angestrengter
    const shifting = shiftT > 0 && throttle;                   // beim Schalten kurz vom Gas
    const cut = cutT > 0;                                       // Zündung gerade unterbrochen
    const now = ctx.currentTime, rate = (0.5 + rpm * 2.5) * opts.pitch;
    src.playbackRate.setTargetAtTime(rate, now, 0.02);
    sub.frequency.setTargetAtTime(BASE * rate * 0.5, now, 0.02);
    sub2.frequency.setTargetAtTime(BASE * rate, now, 0.02);
    const open = shifting || cut ? 0 : throttle * (650 + load * 450);
    filter.frequency.setTargetAtTime((220 + rpm * 1250 + open) * opts.bright, now, cut ? 0.008 : 0.04);
    let vol = shifting ? 0.08 : 0.11 + rpm * 0.06 + throttle * 0.05 + load * 0.02;
    vol *= 0.42;                                              // Bass ist kräftig – Gesamtlautstärke etwas runter
    if (cut) vol *= 0.35;
    master.gain.setTargetAtTime(active ? vol * (volume == null ? 1 : volume) : 0, now, active ? (cut || limiting ? 0.006 : 0.04) : 0.3);
  }
  // Für Tests: Gang und Drehzahl ablesen
  function state() { return { gear: gear + 1, rpm, limiting }; }
  // Motor abschalten (beim Fahrzeugwechsel)
  function stop() {
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => { try { src.stop(); sub.stop(); sub2.stop(); master.disconnect(); } catch (e) {} }, 400);
  }
  return { update, state, stop };
};
