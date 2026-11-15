// =====================================================
//  MOTORSOUND
//  Ein echter Motor klingt nach vielen kurzen "Explosionen"
//  (Zündungen) hintereinander. Wir schreiben ein paar Arbeitsspiele
//  (jeder Zylinder zündet einmal) in einen Ton-Speicher und spielen
//  ihn in einer Schleife ab – schneller bei höherer Drehzahl.
//  Leicht ungleiche Zylinder ergeben das typische Blubbern.
//  Dazu gibt es 3 Gänge: beim Hochschalten fällt die Drehzahl,
//  und ganz oben regelt ein Drehzahlbegrenzer ab.
// =====================================================
window.EngineSound = function (ctx, out, opts) {
  // Klang je nach Fahrzeug (siehe cars.js → sound):
  //  cyl      = Zylinder (4 = kerniger, 6 = seidig und höher)
  //  idle/redline = Leerlauf- und Höchstdrehzahl (U/min)
  //  rough    = wie ungleich die Zylinder klingen (blubbern)
  //  body     = Klangfarbe des Auspuffs (Hz), bright = Helligkeit, sub = Tiefbass
  //  induct   = Ansauggeräusch unter Last, crackle = Knallen beim Gaswegnehmen
  //  spool    = leises Turbo-Pfeifen bei modernen Turbomotoren
  opts = Object.assign({ cyl: 4, idle: 850, redline: 6800, rough: 0.2, body: 80, bright: 1, sub: 0.3, induct: 0.3, crackle: 0, spool: 0, pitch: 1 }, opts || {});
  const sr = ctx.sampleRate, BASE_RPM = 1000, CYCLES = 8;
  // Ein Arbeitsspiel (2 Umdrehungen) bei 1000 U/min dauert 0.12 s, darin zündet jeder Zylinder einmal
  const cycleLen = sr * 120 / BASE_RPM, len = Math.floor(cycleLen * CYCLES), per = cycleLen / opts.cyl;
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const cylAmp = [], cylF = [];
  for (let c = 0; c < opts.cyl; c++) { cylAmp.push(1 + (Math.random() - 0.5) * opts.rough * 1.6); cylF.push(opts.body * (1 + (Math.random() - 0.5) * opts.rough * 0.3)); }
  for (let k = 0; k < CYCLES; k++) for (let c = 0; c < opts.cyl; c++) {
    const start = Math.floor((k * opts.cyl + c) * per + (Math.random() - 0.5) * per * 0.05 * (1 + opts.rough * 3));
    const amp = cylAmp[c] * (1 + (Math.random() - 0.5) * opts.rough * 0.4);
    const f1 = cylF[c], f2 = f1 * 2.3;
    const dec = 1000 / per * 2.2;                                          // Abklingen passend zum Zündabstand
    for (let i = 0; i < per * 1.6; i++) {
      const t = i / sr, idx = (start + i + len) % len;
      const env = Math.exp(-t * dec);
      const body = Math.sin(2 * Math.PI * f1 * t) * env;                    // Auspuff-Stoss
      const knock = Math.sin(2 * Math.PI * f2 * t) * Math.exp(-t * dec * 2.5) * 0.35;
      const hiss = (Math.random() * 2 - 1) * Math.exp(-t * dec * 4) * 0.15;
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
  for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * (1.6 + opts.rough * 2)); }
  shaper.curve = curve;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 0.9;
  const bass = ctx.createBiquadFilter(); bass.type = 'lowshelf'; bass.frequency.value = 160; bass.gain.value = 8;
  const bodyEq = ctx.createBiquadFilter(); bodyEq.type = 'peaking'; bodyEq.frequency.value = 120; bodyEq.Q.value = 1; bodyEq.gain.value = 4;
  // Tiefbass: halbe und ganze Zündfrequenz (läuft durch die Verzerrung, damit man ihn auch am Handy hört)
  const sub = ctx.createOscillator(); sub.type = 'sine';
  const sub2 = ctx.createOscillator(); sub2.type = 'triangle';
  const subGain = ctx.createGain(); subGain.gain.value = opts.sub;
  const sub2Gain = ctx.createGain(); sub2Gain.gain.value = opts.sub * 0.5;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.12;
  const master = ctx.createGain(); master.gain.value = 0;
  src.connect(shaper);
  sub.connect(subGain).connect(shaper); sub2.connect(sub2Gain).connect(shaper);
  shaper.connect(filter).connect(bass).connect(bodyEq).connect(comp).connect(master);
  master.connect(out);
  // Rauschen für Ansaugen, Knallen und Abblasen
  const noiseBuf = ctx.createBuffer(1, sr, sr); { const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; }
  // Ansaugen: Rauschen, das mit Gas und Drehzahl lauter und heller wird
  const inNoise = ctx.createBufferSource(); inNoise.buffer = noiseBuf; inNoise.loop = true;
  const inBand = ctx.createBiquadFilter(); inBand.type = 'bandpass'; inBand.Q.value = 1.4;
  const inGain = ctx.createGain(); inGain.gain.value = 0;
  inNoise.connect(inBand).connect(inGain).connect(comp);
  src.start(); sub.start(); sub2.start(); inNoise.start();
  // Turbo: Pfeifen des Laders und "Pssscht" beim Gaswegnehmen
  const whistle = ctx.createOscillator(); whistle.type = 'sine'; whistle.frequency.value = 1500;
  const whistleGain = ctx.createGain(); whistleGain.gain.value = 0;
  whistle.connect(whistleGain).connect(comp); whistle.start();
  let lastVol = 1, turboP = 0, turboOn = false;
  function blowoff(p) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.9;
    const gg = ctx.createGain(), t = ctx.currentTime, v = 0.05 * p * lastVol;
    gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(v, t + 0.02); gg.gain.exponentialRampToValueAtTime(0.0005, t + 0.45);
    bp.frequency.setValueAtTime(3200, t); bp.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
    n.connect(bp).connect(gg).connect(out); n.start(t, Math.random() * 0.4); n.stop(t + 0.5);
  }
  // Knallen aus dem Auspuff (Fehlzündungen im Schiebebetrieb)
  function pop() {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700 + Math.random() * 600;
    const gg = ctx.createGain(), t = ctx.currentTime, v = (0.03 + Math.random() * 0.04) * lastVol;
    gg.gain.setValueAtTime(v, t); gg.gain.exponentialRampToValueAtTime(0.0005, t + 0.05 + Math.random() * 0.04);
    n.connect(lp).connect(gg).connect(out); n.start(t, Math.random() * 0.8); n.stop(t + 0.12);
  }
  function setTurbo(p, on) { turboP = p; turboOn = on; }
  let popT = 0, lastThrottle = 0;

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
    lastVol = volume == null ? 1 : volume;
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
    const now = ctx.currentTime;
    // interne Drehzahl (0.12 = Leerlauf … 0.97 = Begrenzer) → echte U/min
    const realRpm = (opts.idle + (opts.redline - opts.idle) * Math.max(0, (rpm - 0.12) / 0.85)) * opts.pitch;
    const fire = realRpm * opts.cyl / 120;                     // Zündfrequenz (Hz)
    src.playbackRate.setTargetAtTime(realRpm / BASE_RPM, now, 0.02);
    sub.frequency.setTargetAtTime(fire * 0.5, now, 0.02);
    sub2.frequency.setTargetAtTime(fire, now, 0.02);
    const open = shifting || cut ? 0 : throttle * (700 + load * 450);
    filter.frequency.setTargetAtTime((260 + fire * 3.2 + open) * opts.bright, now, cut ? 0.008 : 0.04);
    let vol = shifting ? 0.08 : 0.11 + rpm * 0.06 + throttle * 0.05 + load * 0.02;
    vol *= 0.7 * (opts.gain || 1);
    if (cut) vol *= 0.35;
    const v = active ? vol * lastVol : 0;
    master.gain.setTargetAtTime(v, now, active ? (cut || limiting ? 0.006 : 0.04) : 0.3);
    // Ansaugen unter Last
    inBand.frequency.setTargetAtTime(500 + rpm * 1600, now, 0.05);
    inGain.gain.setTargetAtTime(active && throttle && !cut && !shifting ? opts.induct * (0.2 + rpm) * 0.05 * lastVol : 0, now, 0.05);
    // Turbo-Pfeifen: alter Turbo (Ladedruck aus dem Spiel) oder moderner Turbo (leise, mit Gas und Drehzahl)
    const tp = Math.max(turboP, opts.spool ? throttle * rpm * opts.spool : 0);
    whistle.frequency.setTargetAtTime(1300 + 2600 * tp, now, 0.05);
    whistleGain.gain.setTargetAtTime(active && (turboOn || opts.spool) && throttle ? tp * tp * (opts.spool ? 0.08 : 0.18) * lastVol : 0, now, throttle ? 0.08 : 0.03);
    // Knallen: kurz nach dem Gaswegnehmen bei hoher Drehzahl
    if (opts.crackle && active) {
      if (lastThrottle && !throttle && rpm > 0.55) popT = 0.5 + opts.crackle * 0.5;
      if (popT > 0) { popT -= dt; if (Math.random() < opts.crackle * dt * 14) pop(); }
    }
    lastThrottle = throttle;
  }
  // Für Tests: Gang und Drehzahl ablesen
  function state() { return { gear: gear + 1, rpm, limiting }; }
  // Motor abschalten (beim Fahrzeugwechsel)
  function stop() {
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => { try { src.stop(); sub.stop(); sub2.stop(); whistle.stop(); inNoise.stop(); master.disconnect(); } catch (e) {} }, 400);
  }
  return { update, state, stop, setTurbo, blowoff };
};
