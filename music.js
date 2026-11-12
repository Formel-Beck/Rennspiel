// =====================================================
//  MUSIK – wird im Spiel live erzeugt (keine Musikdateien)
//
//  Jede Streckenart hat einen eigenen Stil: Tempo, Tonart,
//  Akkordfolge und Instrumente. Die Melodie wird aus der Tonleiter
//  "gewürfelt" – aber immer gleich, damit jede Strecke ihr eigenes
//  Lied hat. In der letzten Runde wird es etwas schneller.
//
//  Neuen Stil?  In STYLES eintragen (Schlüssel = Thema aus themes.js).
// =====================================================
window.Music = (() => {
  // Akkordfolgen: Stufen der Tonleiter (0 = Grundton)
  const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10], HARM = [0, 1, 4, 5, 7, 8, 10];
  const STYLES = {
    forest:    { name: 'Wald-Folk',   bpm: 118, key: 62, scale: MAJOR, chords: [0, 4, 5, 3], lead: 'whistle', bass: 'pluck', drums: 'folk',   pad: false, swing: 0.1 },
    city:      { name: 'Synthwave',   bpm: 102, key: 57, scale: MINOR, chords: [0, 5, 2, 6], lead: 'saw',     bass: 'synth', drums: 'synth',  pad: true,  swing: 0 },
    desert:    { name: 'Surf-Rock',   bpm: 152, key: 52, scale: HARM,  chords: [0, 0, 5, 4], lead: 'twang',   bass: 'pluck', drums: 'surf',   pad: false, swing: 0 },
    mountains: { name: 'Gipfel-Epos', bpm: 92,  key: 50, scale: MINOR, chords: [0, 5, 2, 6], lead: 'horn',    bass: 'synth', drums: 'epic',   pad: true,  swing: 0 },
    beach:     { name: 'Reggae',      bpm: 82,  key: 60, scale: MAJOR, chords: [0, 3, 4, 3], lead: 'steel',   bass: 'round', drums: 'reggae', pad: false, swing: 0.15, skank: true },
    snow:      { name: 'Glockenspiel',bpm: 112, key: 67, scale: MAJOR, chords: [0, 5, 3, 4], lead: 'glock',   bass: 'round', drums: 'sleigh', pad: true,  swing: 0.05 },
    rainbow:   { name: 'Chiptune',    bpm: 142, key: 60, scale: MAJOR, chords: [0, 4, 5, 3], lead: 'chip',    bass: 'chip',  drums: 'chip',   pad: false, swing: 0, arp: true }
  };

  let ctx = null, out = null, timer = null, style = null, song = null, step = 0, nextTime = 0, tempoMul = 1, volume = 0.5, playing = false;
  const freq = midi => 440 * Math.pow(2, (midi - 69) / 12);

  // ---------- Lied erzeugen (pro Strecke immer gleich) ----------
  function makeSong(st, seedText) {
    let seed = 7; for (const c of seedText) seed = (seed * 31 + c.charCodeAt(0)) % 2147483646;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const sc = st.scale, deg = d => st.key + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    // Melodie: 4 Takte A + 4 Takte B, je 16 Sechzehntel
    const phrase = () => {
      const notes = [];
      let d = 7 + Math.floor(rnd() * 3);
      for (let bar = 0; bar < 4; bar++) {
        const root = st.chords[bar];
        for (let s = 0; s < 16; s++) {
          const strong = s % 4 === 0, eighth = s % 2 === 0;
          if (!eighth && rnd() < 0.85) { notes.push(null); continue; }
          if (!strong && rnd() < 0.3) { notes.push(null); continue; }
          if (strong) { const ct = [0, 2, 4][Math.floor(rnd() * 3)]; d = root + ct + 7; } // Akkordton
          else d += [-2, -1, -1, 1, 1, 2][Math.floor(rnd() * 6)];                                          // kleine Schritte
          d = Math.max(3, Math.min(14, d));
          notes.push({ m: deg(d), len: strong && rnd() < 0.4 ? 3 : 1 });
        }
      }
      return notes;
    };
    const A = phrase(), B = phrase();
    return { melody: A.concat(A, B, A), deg }; // AABA = 16 Takte
  }

  // ---------- Instrumente ----------
  function env(g, t, a, peak, d, sus, len) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  }
  function osc(type, f, t, len, gainNode, detune) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    o.connect(gainNode); o.start(t); o.stop(t + len + 0.05); return o;
  }
  function voice(t, len, vol, filterF) {
    const g = ctx.createGain(); let node = g;
    if (filterF) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterF; g.connect(f); node = f; }
    node.connect(out);
    return g;
  }
  const INSTR = {
    whistle(m, t, len) { const g = voice(t, len); env(g, t, 0.03, 0.16, 0.1, 0.7, len); const o = osc('sine', freq(m + 12), t, len, g);
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6; lg.gain.value = 6; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + len); },
    saw(m, t, len) { const g = voice(t, len, 0, 2200); env(g, t, 0.02, 0.09, 0.15, 0.6, len + 0.1); osc('sawtooth', freq(m), t, len + 0.1, g, -8); osc('sawtooth', freq(m), t, len + 0.1, g, 8); },
    twang(m, t, len) { const g = voice(t, len, 0, 1800); env(g, t, 0.005, 0.18, 0.12, 0.25, len + 0.2); osc('sawtooth', freq(m), t, len + 0.2, g); osc('square', freq(m) * 1.003, t, len + 0.2, g); },
    horn(m, t, len) { const g = voice(t, len, 0, 1100); env(g, t, 0.08, 0.13, 0.2, 0.8, len + 0.15); osc('sawtooth', freq(m - 12), t, len + 0.15, g, -5); osc('sawtooth', freq(m - 12), t, len + 0.15, g, 5); },
    steel(m, t, len) { const g = voice(t, len); env(g, t, 0.005, 0.2, 0.3, 0.15, 0.6); osc('sine', freq(m + 12), t, 0.6, g); const g2 = voice(t, len); env(g2, t, 0.005, 0.06, 0.15, 0.1, 0.4); osc('sine', freq(m + 12) * 2.76, t, 0.4, g2); },
    glock(m, t, len) { const g = voice(t, len); env(g, t, 0.003, 0.18, 0.4, 0.1, 0.9); osc('sine', freq(m + 24), t, 0.9, g); const g2 = voice(t, len); env(g2, t, 0.003, 0.05, 0.1, 0.1, 0.3); osc('sine', freq(m + 24) * 3.9, t, 0.3, g2); },
    chip(m, t, len) { const g = voice(t, len); env(g, t, 0.005, 0.07, 0.05, 0.8, len); osc('square', freq(m + 12), t, len, g); },
    // Bass
    pluck(m, t, len) { const g = voice(t, len, 0, 900); env(g, t, 0.005, 0.25, 0.2, 0.3, len); osc('triangle', freq(m - 24), t, len, g); osc('sawtooth', freq(m - 24), t, len, g); },
    synth(m, t, len) { const g = voice(t, len, 0, 700); env(g, t, 0.01, 0.2, 0.1, 0.6, len); osc('sawtooth', freq(m - 24), t, len, g); },
    round(m, t, len) { const g = voice(t, len); env(g, t, 0.02, 0.3, 0.2, 0.6, len); osc('sine', freq(m - 24), t, len, g); const g2 = voice(t, len); env(g2, t, 0.02, 0.06, 0.2, 0.5, len); osc('triangle', freq(m - 12), t, len, g2); },
    chipbass(m, t, len) { const g = voice(t, len); env(g, t, 0.005, 0.18, 0.05, 0.9, len); osc('triangle', freq(m - 12), t, len, g); }
  };
  function noise(t, len, vol, type, f, q) {
    const n = Math.floor(ctx.sampleRate * len), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl).connect(g).connect(out); s.start(t);
  }
  const DRUM = {
    kick(t, v) { const g = ctx.createGain(); g.connect(out); const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
      g.gain.setValueAtTime(0.5 * (v || 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); o.start(t); o.stop(t + 0.32); },
    snare(t, v) { noise(t, 0.18, 0.25 * (v || 1), 'bandpass', 1800, 0.8); },
    clap(t) { for (let k = 0; k < 3; k++) noise(t + k * 0.012, 0.09, 0.18, 'bandpass', 1400, 1.5); },
    hat(t, v) { noise(t, 0.04, 0.08 * (v || 1), 'highpass', 7000); },
    shaker(t) { noise(t, 0.06, 0.05, 'highpass', 5000); },
    timp(t) { const g = ctx.createGain(); g.connect(out); const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.6);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.connect(g); o.start(t); o.stop(t + 0.95); },
    click(t) { noise(t, 0.02, 0.12, 'bandpass', 3500, 4); },          // Kastagnetten
    bells(t) { for (let k = 0; k < 3; k++) noise(t + k * 0.015, 0.08, 0.05, 'bandpass', 6000 + k * 900, 8); }, // Schlittenglocken
    chipnoise(t, v) { noise(t, 0.06, 0.12 * (v || 1), 'highpass', 2500); }
  };
  // Schlagzeug-Muster: was auf welcher Sechzehntel spielt (0–15)
  function drums(kind, s, t, bar) {
    const at = (list, i) => list.includes(i);
    switch (kind) {
      case 'folk': if (at([0, 8], s)) DRUM.kick(t, 0.7); if (at([4, 12], s)) DRUM.clap(t); if (s % 2 === 0) DRUM.shaker(t); break;
      case 'synth': if (s % 4 === 0) DRUM.kick(t); if (at([4, 12], s)) DRUM.snare(t, 1.1); if (s % 2 === 0) DRUM.hat(t, s % 4 === 2 ? 1.3 : 0.6); break;
      case 'surf': if (at([0, 6, 8, 10], s)) DRUM.kick(t, 0.8); if (at([4, 12], s)) DRUM.snare(t); DRUM.hat(t, 0.5); if (at([2, 3, 14], s)) DRUM.click(t); break;
      case 'epic': if (at([0, 3, 8, 11], s)) DRUM.timp(t); if (at([12, 14, 15], s) && bar % 4 === 3) DRUM.snare(t, 0.8); break;
      case 'reggae': if (s === 8) DRUM.kick(t); if (s === 8) DRUM.snare(t, 0.6); if (s % 2 === 1) DRUM.hat(t, 0.7); break;
      case 'sleigh': if (at([0, 8], s)) DRUM.kick(t, 0.5); if (s % 2 === 0) DRUM.bells(t); break;
      case 'chip': if (at([0, 8, 10], s)) DRUM.kick(t, 0.6); if (at([4, 12], s)) DRUM.chipnoise(t, 1.4); if (s % 2 === 0) DRUM.chipnoise(t, 0.35); break;
    }
  }

  // ---------- Abspielen ----------
  function scheduleStep(s, t) {
    const st = style, bar = Math.floor(s / 16), s16 = s % 16, chordDeg = st.chords[bar % 4];
    const stepLen = 60 / (st.bpm * tempoMul) / 4;
    const n = song.melody[s % song.melody.length];
    if (n) INSTR[st.lead](n.m, t, stepLen * n.len * 0.95);
    // Bass: Grundton auf 1 und 3 (Reggae: auf 1 und dem "und" von 3), Achtel bei Synthwave
    const root = song.deg(chordDeg);
    const bassInstr = st.bass === 'chip' ? 'chipbass' : st.bass;
    if (st.bass === 'synth' && s16 % 2 === 0) INSTR[bassInstr](root + (s16 % 4 === 2 ? 12 : 0), t, stepLen * 1.6);
    else if (st.bass !== 'synth' && (s16 === 0 || s16 === (st.skank ? 10 : 8) || (st.bass === 'chip' && s16 % 4 === 2))) INSTR[bassInstr](s16 === 8 && !st.skank ? song.deg(chordDeg + 4) : root, t, stepLen * 3);
    // Reggae: Akkord auf die Nachschläge
    if (st.skank && (s16 === 4 || s16 === 12)) for (const k of [0, 2, 4]) { const g = voice(t, 0.15, 0, 2500); env(g, t, 0.005, 0.05, 0.05, 0.3, 0.15); osc('square', freq(song.deg(chordDeg + k)), t, 0.15, g); }
    // Chiptune: schnelles Arpeggio
    if (st.arp && s16 % 2 === 1) INSTR.chip(song.deg(chordDeg + [0, 2, 4, 7][(s16 >> 1) % 4]) - 12, t, stepLen * 0.9);
    // Flächenklang am Taktanfang
    if (st.pad && s16 === 0) for (const k of [0, 2, 4]) { const g = voice(t, stepLen * 16, 0, 1200); env(g, t, 0.4, 0.035, 0.5, 0.7, stepLen * 16); osc('sawtooth', freq(song.deg(chordDeg + k) - 12), t, stepLen * 16, g, k * 3); }
    drums(st.drums, s16, t, bar);
  }
  function tick() {
    if (!playing) return;
    const stepLen = () => 60 / (style.bpm * tempoMul) / 4;
    while (nextTime < ctx.currentTime + 0.15) {
      const swing = (step % 2 === 1) ? style.swing * stepLen() : 0;
      scheduleStep(step, nextTime + swing);
      nextTime += stepLen(); step++;
    }
  }

  function play(audioCtx, themeId, trackId) {
    stop();
    ctx = audioCtx;
    style = STYLES[themeId] || STYLES.rainbow;
    song = makeSong(style, trackId || themeId);
    out = ctx.createGain(); out.gain.value = volume * 0.6;
    const comp = ctx.createDynamicsCompressor(); out.connect(comp).connect(ctx.destination);
    step = 0; tempoMul = 1; nextTime = ctx.currentTime + 0.1; playing = true;
    timer = setInterval(tick, 25);
  }
  function stop() {
    playing = false; clearInterval(timer); timer = null;
    if (out && ctx) { const o = out; o.gain.setTargetAtTime(0, ctx.currentTime, 0.2); setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 800); }
    out = null;
  }
  function setVolume(v) { volume = v; if (out && ctx) out.gain.setTargetAtTime(v * 0.6, ctx.currentTime, 0.1); }
  function faster(on) { tempoMul = on ? 1.08 : 1; }

  return { play, stop, setVolume, faster, styleName: id => (STYLES[id] || STYLES.rainbow).name, get playing() { return playing; } };
})();
