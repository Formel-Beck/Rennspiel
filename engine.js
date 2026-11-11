// =====================================================
//  MOTORSOUND
//  Ein echter Motor klingt nach vielen kurzen "Explosionen"
//  (Zündungen) hintereinander. Wir schreiben ein paar Dutzend
//  solche Zündungen in einen Ton-Speicher und spielen ihn in
//  einer Schleife ab – je höher die Drehzahl, desto schneller.
//  Dazu gibt es 5 Gänge: beim Hochschalten fällt die Drehzahl.
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

  const GEARS = [0.16, 0.32, 0.5, 0.7, 1.0]; // bis zu welchem Anteil vom Höchsttempo jeder Gang reicht
  let rpm = 0.12;

  // speed/maxSpeed = Tempo, throttle = Gas (0 oder 1), active = Motor hörbar?
  function update(dt, speed, maxSpeed, throttle, active) {
    const sf = Math.min(1.15, Math.abs(speed) / maxSpeed);
    let lo = 0, g = 0;
    while (g < GEARS.length - 1 && sf > GEARS[g]) { lo = GEARS[g]; g++; }
    const inGear = Math.min(1, (sf - lo) / (GEARS[g] - lo));
    const target = sf < 0.02 ? (throttle ? 0.35 : 0.12) : 0.28 + 0.72 * inGear;
    rpm += (target - rpm) * Math.min(1, dt * (target < rpm ? 5 : 9));
    const now = ctx.currentTime, rate = 0.65 + rpm * 3.6;
    src.playbackRate.setTargetAtTime(rate, now, 0.03);
    sub.frequency.setTargetAtTime(BASE * rate * 0.5, now, 0.03);
    filter.frequency.setTargetAtTime(350 + rpm * 1800 + throttle * 900, now, 0.05);
    master.gain.setTargetAtTime(active ? 0.1 + rpm * 0.06 + throttle * 0.05 : 0, now, active ? 0.05 : 0.3);
  }
  return { update };
};
