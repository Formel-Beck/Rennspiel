// =====================================================
//  MOTORSOUND
//  Ein echter Motor klingt nach vielen kurzen "Explosionen"
//  (Zündungen) hintereinander. Wir schreiben ein paar Dutzend
//  solche Zündungen in einen Ton-Speicher und spielen ihn in
//  einer Schleife ab – je höher die Drehzahl, desto schneller.
//  Dazu gibt es 3 Gänge: beim Hochschalten fällt die Drehzahl.
// =====================================================
window.EngineSound = function (ctx, out) {
  const sr = ctx.sampleRate, BASE = 40, PULSES = 64;
  const per = sr / BASE, len = Math.floor(per * PULSES);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  for (let p = 0; p < PULSES; p++) {
    const start = Math.floor(p * per + (Math.random() - 0.5) * per * 0.08); // kleine Unregelmässigkeit
    const amp = (p % 2 ? 0.8 : 1) * (0.8 + Math.random() * 0.4);
    const f1 = 65 + Math.random() * 15, f2 = 150 + Math.random() * 40;
    for (let i = 0; i < per * 1.5; i++) {
      const t = i / sr, idx = (start + i + len) % len;
      const body = Math.sin(2 * Math.PI * f1 * t) * Math.exp(-t * 55);        // dumpfer Schlag
      const knock = Math.sin(2 * Math.PI * f2 * t) * Math.exp(-t * 140) * 0.5; // Klopfen
      const hiss = (Math.random() * 2 - 1) * Math.exp(-t * 260) * 0.35;        // Auspuff-Zischen
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
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 0.8;
  // Tiefes Brummen darunter
  const sub = ctx.createOscillator(); sub.type = 'triangle';
  const subGain = ctx.createGain(); subGain.gain.value = 0.25;
  const master = ctx.createGain(); master.gain.value = 0;
  src.connect(shaper).connect(filter).connect(master);
  sub.connect(subGain).connect(filter);
  master.connect(out);
  src.start(); sub.start();

  // 3 Gänge. Die Autos sind sehr schnell auf Höchsttempo – darum wenige Gänge
  // mit grossem Drehzahlbereich, sonst würde der Motor ständig schalten.
  //   lo/hi = Tempo-Bereich des Gangs (Anteil vom Höchsttempo)
  //   up    = ab hier wird hochgeschaltet, down = darunter runtergeschaltet
  const GEARS = [
    { lo: 0.0,  hi: 0.42, up: 0.38, down: -1 },
    { lo: 0.3,  hi: 0.78, up: 0.72, down: 0.28 },
    { lo: 0.62, hi: 1.08, up: 99,   down: 0.58 }
  ];
  let gear = 0, rpm = 0.12, shiftT = 0;

  // speed/maxSpeed = Tempo, throttle = Gas (0/1), active = hörbar?
  // slip = seitliches Rutschen (m/s), slope = Steigung (-1 bis 1)
  function update(dt, speed, maxSpeed, throttle, active, slip, slope) {
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
    else target = 0.3 + 0.62 * inGear;
    if (throttle && sf < 0.18) target += 0.15 * (1 - sf / 0.18); // Anfahren: Räder drehen kurz durch
    target += Math.min(0.12, Math.abs(slip || 0) * 0.02);       // Rutschen: Drehzahl geht hoch
    if (throttle) target += 0.04;
    // Der Motor dreht weich hoch und fällt beim Schalten schnell ab
    const k = shiftT > 0 ? 14 : (target > rpm ? 3.2 : 4.5);
    rpm += (target - rpm) * Math.min(1, dt * k);
    rpm = Math.min(1.05, rpm);

    const load = Math.max(0, slope || 0) * 4;                  // bergauf: angestrengter
    const shifting = shiftT > 0 && throttle;                   // beim Schalten kurz vom Gas
    const now = ctx.currentTime, rate = 0.6 + rpm * 3.4;
    src.playbackRate.setTargetAtTime(rate, now, 0.03);
    sub.frequency.setTargetAtTime(BASE * rate * 0.5, now, 0.03);
    filter.frequency.setTargetAtTime(320 + rpm * 1700 + (shifting ? 0 : throttle * (900 + load * 600)), now, 0.04);
    const vol = shifting ? 0.07 : 0.09 + rpm * 0.06 + throttle * 0.05 + load * 0.02;
    master.gain.setTargetAtTime(active ? vol : 0, now, active ? 0.04 : 0.3);
  }
  // Für Tests: Gang und Drehzahl ablesen
  function state() { return { gear: gear + 1, rpm }; }
  return { update, state };
};
