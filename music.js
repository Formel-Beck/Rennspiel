// =====================================================
//  MUSIK – 80er/90er Synth-Musik, live im Spiel erzeugt (keine Musikdateien)
//
//  Alle Stücke sind im Retro-Synthwave-Stil: warme Flächen, pumpender
//  Oktav-Bass, Snare mit viel Hall und eine weiche Synth-Melodie.
//  Hohe Töne werden bewusst weggefiltert, damit es nicht schrill klingt.
//
//  Jede Strecke (und das Menü) hat ein eigenes Stück: Tempo, Tonart,
//  Akkordfolge und Stimmung. Die Melodie wird aus der Tonleiter
//  "gewürfelt" – aber immer gleich. In der letzten Runde wird es schneller.
//
//  Neues Stück?  In STYLES eintragen (Schlüssel = Thema aus themes.js).
// =====================================================
window.Music = (() => {
  const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10];
  //  bpm = Tempo, key = Grundton (MIDI), chords = Akkordstufen (4 Takte)
  //  lead = Melodie-Klang, arp = Arpeggio, drums = Rhythmus, bright = Helligkeit (Filter)
  const STYLES = {
    menu:      { name: 'Outrun Menü',     bpm: 100, key: 57, scale: MINOR,  chords: [0, 5, 2, 6], lead: 'soft',  arp: false, drums: 'drive',  bright: 1.0 },
    forest:    { name: 'Sunset Drive',    bpm: 96,  key: 62, scale: MAJOR,  chords: [0, 5, 3, 4], lead: 'soft',  arp: true,  drums: 'drive',  bright: 0.95, gain: 0.91 },
    city:      { name: 'Neon Nights',     bpm: 108, key: 52, scale: MINOR,  chords: [0, 5, 6, 4], lead: 'brass', arp: true,  drums: 'drive',  bright: 1.0, gain: 1.1 },
    desert:    { name: 'Miami Heat',      bpm: 116, key: 55, scale: DORIAN, chords: [0, 6, 3, 4], lead: 'brass', arp: false, drums: 'drive',  bright: 1.05 },
    mountains: { name: 'Gipfel-Synth',    bpm: 88,  key: 50, scale: MINOR,  chords: [0, 5, 2, 6], lead: 'soft',  arp: false, drums: 'slow',   bright: 0.85, gain: 1.45 },
    beach:     { name: 'Summer 89',       bpm: 104, key: 60, scale: MAJOR,  chords: [0, 3, 5, 4], lead: 'bell',  arp: false, drums: 'drive',  bright: 1.0, gain: 0.94 },
    snow:      { name: 'Crystal Synth',   bpm: 94,  key: 64, scale: MAJOR,  chords: [0, 4, 5, 3], lead: 'bell',  arp: true,  drums: 'slow',   bright: 0.9, gain: 0.87 },
    rainbow:   { name: 'Turbo Arcade 92', bpm: 124, key: 59, scale: MINOR,  chords: [0, 5, 6, 4], lead: 'brass', arp: true,  drums: 'dance',  bright: 1.05, gain: 0.82 }
  };

  let ctx = null, out = null, bus = null, verbIn = null, timer = null, style = null, song = null;
  let step = 0, nextTime = 0, tempoMul = 1, volume = 1, level = 0.3, playing = false, noiseBuf = null;
  const freq = midi => 440 * Math.pow(2, (midi - 69) / 12);

  // ---------- Lied erzeugen (pro Strecke immer gleich) ----------
  function makeSong(st, seedText) {
    let seed = 7; for (const c of seedText) seed = (seed * 31 + c.charCodeAt(0)) % 2147483646;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const sc = st.scale, deg = d => st.key + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    // Melodie: lange, singende Töne (typisch Synthwave), 4 Takte A + 4 Takte B
    const phrase = () => {
      const notes = [];
      let d = 7;
      for (let bar = 0; bar < 4; bar++) {
        const root = st.chords[bar];
        for (let s = 0; s < 16; s++) {
          if (s % 2) { notes.push(null); continue; }
          const strong = s % 8 === 0;
          if (!strong && rnd() < 0.45) { notes.push(null); continue; }
          if (strong) d = root + [0, 2, 4][Math.floor(rnd() * 3)] + 7;       // Akkordton
          else d += [-2, -1, 1, 1, 2][Math.floor(rnd() * 5)];
          d = Math.max(4, Math.min(12, d));
          notes.push({ m: deg(d), len: strong ? (rnd() < 0.5 ? 6 : 4) : 2 });
        }
      }
      return notes;
    };
    const A = phrase(), B = phrase();
    const rest = new Array(64).fill(null);                // Intro/Pause: nur Begleitung
    return { melody: rest.concat(A, A, B, A), deg };
  }

  // ---------- Klangbausteine ----------
  function env(g, t, a, peak, d, sus, len) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), t + Math.max(a + d, len - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.25);
  }
  function osc(type, f, t, len, dest, detune) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(t + len + 0.35); return o;
  }
  // Stimme: Lautstärke → Tiefpass → Ausgang (+ etwas Hall)
  function voice(cut, verb) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cut * style.bright; f.Q.value = 0.7;
    g.connect(f); f.connect(bus);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; f.connect(s); s.connect(verbIn); }
    return g;
  }
  const INSTR = {
    // weiche Synth-Melodie (zwei leicht verstimmte Sägezähne, Vibrato)
    soft(m, t, len) {
      const g = voice(1500, 0.35); env(g, t, 0.06, 0.06, 0.2, 0.75, len);
      for (const dt of [-7, 7]) { const o = osc('sawtooth', freq(m), t, len, g, dt);
        const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(4, t + 0.4);
        l.connect(lg).connect(o.detune); l.start(t); l.stop(t + len + 0.35); }
    },
    // Synth-Brass (80er Stab), etwas kräftiger
    brass(m, t, len) {
      const g = voice(1300, 0.3); env(g, t, 0.03, 0.065, 0.25, 0.6, len);
      osc('sawtooth', freq(m), t, len, g, -10); osc('sawtooth', freq(m), t, len, g, 10); osc('square', freq(m - 12), t, len, g);
    },
    // weiches Glocken-Piano (DX7-artig, aber gedämpft)
    bell(m, t, len) {
      const g = voice(1800, 0.4); env(g, t, 0.005, 0.07, 0.6, 0.25, len + 0.4);
      const car = osc('sine', freq(m), t, len + 0.4, g);
      const mod = ctx.createOscillator(), mg = ctx.createGain(); mod.frequency.value = freq(m) * 2;
      mg.gain.setValueAtTime(freq(m) * 1.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.5);
      mod.connect(mg).connect(car.frequency); mod.start(t); mod.stop(t + len + 0.75);
    },
    // Oktav-Bass: der typische pumpende 80er-Bass
    bass(m, t, len) {
      const g = voice(520, 0); env(g, t, 0.005, 0.16, 0.12, 0.5, len);
      osc('sawtooth', freq(m), t, len, g); osc('triangle', freq(m), t, len, g);
    },
    // Fläche: warmer Akkord, langsam ein- und ausblendend
    pad(m, t, len) {
      const g = voice(850, 0.5); env(g, t, 0.6, 0.022, 0.6, 0.85, len);
      osc('sawtooth', freq(m), t, len, g, -12); osc('sawtooth', freq(m), t, len, g, 12);
    },
    // Arpeggio: kurze, gedämpfte Töne
    arp(m, t, len) {
      const g = voice(1100, 0.3); env(g, t, 0.004, 0.035, 0.08, 0.3, len);
      osc('square', freq(m), t, len, g);
    }
  };
  function noise(t, len, vol, type, f, q, verb) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(fl).connect(g).connect(bus);
    if (verb) { const v = ctx.createGain(); v.gain.value = verb; g.connect(v).connect(verbIn); }
    s.start(t, Math.random() * 0.5); s.stop(t + len + 0.05);
  }
  const DRUM = {
    kick(t, v) { const g = ctx.createGain(); g.connect(bus); const o = ctx.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.45 * (v || 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); o.start(t); o.stop(t + 0.36); },
    // 80er-Snare mit viel Hall, aber tief gefiltert
    snare(t, v) { noise(t, 0.22, 0.2 * (v || 1), 'bandpass', 1300, 0.9, 1.4);
      const g = ctx.createGain(); g.connect(bus); const o = ctx.createOscillator(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
      g.gain.setValueAtTime(0.12 * (v || 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); o.start(t); o.stop(t + 0.13); },
    // Hi-Hat: leise und nicht zu hoch
    hat(t, v) { noise(t, 0.035, 0.025 * (v || 1), 'bandpass', 4200, 1.2); },
    tom(t, f) { const g = ctx.createGain(); g.connect(bus); const o = ctx.createOscillator(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.3);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); o.start(t); o.stop(t + 0.36);
      const v = ctx.createGain(); v.gain.value = 0.6; g.connect(v).connect(verbIn); }
  };
  function drums(kind, s, t, bar) {
    const at = (list) => list.includes(s);
    const fill = bar % 8 === 7 && s >= 12;                       // Tom-Wirbel am Ende jeder 8. Zeile
    switch (kind) {
      case 'drive': if (at([0, 8])) DRUM.kick(t); if (at([4, 12]) && !fill) DRUM.snare(t); if (s % 2 === 0) DRUM.hat(t, s % 4 === 2 ? 1 : 0.5); break;
      case 'dance': if (s % 4 === 0) DRUM.kick(t); if (at([4, 12]) && !fill) DRUM.snare(t, 0.9); if (s % 4 === 2) DRUM.hat(t, 1.3); break;
      case 'slow':  if (s === 0 || (s === 10 && bar % 2)) DRUM.kick(t, 0.9); if (s === 8) DRUM.snare(t, 1.1); if (s % 4 === 2) DRUM.hat(t, 0.6); break;
    }
    if (fill) DRUM.tom(t, [220, 180, 150, 120][s - 12]);
  }

  // ---------- Abspielen ----------
  function scheduleStep(s, t) {
    const st = style, bar = Math.floor(s / 16), s16 = s % 16, chordDeg = st.chords[bar % 4];
    const stepLen = 60 / (st.bpm * tempoMul) / 4;
    const n = song.melody[s % song.melody.length];
    if (n) INSTR[st.lead](n.m, t, stepLen * n.len * 0.95);
    // Bass: Achtel, Grundton tief/hoch im Wechsel (Oktav-Bass)
    const root = song.deg(chordDeg) - 24;
    if (s16 % 2 === 0) INSTR.bass(root + (s16 % 4 === 2 ? 12 : 0), t, stepLen * 1.7);
    // Fläche am Taktanfang
    if (s16 === 0) for (const k of [0, 2, 4]) INSTR.pad(song.deg(chordDeg + k) - 12, t, stepLen * 16);
    // Arpeggio (Sechzehntel durch den Akkord)
    if (st.arp && bar % 16 >= 4) INSTR.arp(song.deg(chordDeg + [0, 2, 4, 7, 4, 2][s16 % 6]), t, stepLen * 0.9);
    if (bar >= 1 || s16 >= 8) drums(st.drums, s16, t, bar);
  }
  function tick() {
    if (!playing) return;
    const stepLen = 60 / (style.bpm * tempoMul) / 4;
    while (nextTime < ctx.currentTime + 0.15) { scheduleStep(step, nextTime); nextTime += stepLen; step++; }
  }
  // Hall: künstlicher Raum aus abklingendem Rauschen (dunkel gefiltert)
  function makeReverb() {
    const sr = ctx.sampleRate, n = Math.floor(sr * 2.2), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.25; d[i] = lp * Math.pow(1 - i / n, 2.5); } }
    const cv = ctx.createConvolver(); cv.buffer = b; return cv;
  }

  // o.level = Grundlautstärke (Menü lauter, Rennen leiser)
  // o.race  = im Rennen die tiefen Töne wegfiltern, damit der Motor-Bass frei bleibt
  function play(audioCtx, themeId, trackId, o) {
    stop();
    ctx = audioCtx; o = o || {};
    style = STYLES[themeId] || STYLES.rainbow;
    level = (o.level != null ? o.level : 0.3) * (style.gain || 1); // alle Stücke etwa gleich laut
    song = makeSong(style, trackId || themeId);
    if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    out = ctx.createGain(); out.gain.value = 0.0001;
    out.gain.setTargetAtTime(volume * level, ctx.currentTime, 0.6);           // sanft einblenden
    // Alles läuft durch einen Tiefpass: keine schrillen Höhen
    bus = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.5;
    verbIn = ctx.createGain(); verbIn.gain.value = 0.35;
    const verb = makeReverb(), verbLp = ctx.createBiquadFilter(); verbLp.type = 'lowpass'; verbLp.frequency.value = 2200;
    bus.connect(lp); verbIn.connect(verb).connect(verbLp).connect(lp);
    lp.connect(out);
    if (o.race) {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 150; hp.Q.value = 0.6;
      const dip = ctx.createBiquadFilter(); dip.type = 'peaking'; dip.frequency.value = 450; dip.Q.value = 0.8; dip.gain.value = -4; // Platz für den Motor
      out.connect(hp).connect(dip).connect(ctx.destination);
    } else out.connect(ctx.destination);
    step = 0; tempoMul = 1; nextTime = ctx.currentTime + 0.1; playing = true;
    timer = setInterval(tick, 25);
  }
  function stop() {
    playing = false; clearInterval(timer); timer = null;
    if (out && ctx) { const o = out; o.gain.setTargetAtTime(0, ctx.currentTime, 0.3); setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 1500); }
    out = null;
  }
  function setVolume(v) { volume = v; if (out && ctx) out.gain.setTargetAtTime(v * level, ctx.currentTime, 0.1); }
  function faster(on) { tempoMul = on ? 1.06 : 1; }

  return { play, stop, setVolume, faster, styleName: id => (STYLES[id] || STYLES.rainbow).name, get playing() { return playing; } };
})();
