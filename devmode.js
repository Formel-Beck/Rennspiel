// =====================================================
//  ENTWICKLERMODUS
//  Schieberegler, um Werte direkt im Spiel zu ändern.
//  Geänderte Werte werden im Handy gespeichert.
//
//  Neuen Regler hinzufügen: unten in SCHEMA eine Zeile ergänzen:
//    ['bereich.name', 'Beschriftung', min, max, schritt, anzeige]
//  oder für Ein/Aus:  ['bereich.name', 'Beschriftung', 'bool']
// =====================================================
window.DevMode = (() => {
  let targets = {}, onChange = () => {}, defaults = {}, saved = {};
  const KEY = 'rennspiel-dev';

  const times = v => '×' + (+v).toFixed(2);

  function schema() {
    const surf = Object.keys(SURFACES).map(k => ['surf.' + k + '.grip', SURFACES[k].name.replace('!', ''), 0.02, 1.5, 0.01]);
    return [
      { title: '🚗 Fahrzeug (wirkt auf alle Fahrzeuge)', items: [
        ['tune.maxSpeed', 'Höchsttempo', 0.3, 3, 0.05, times],
        ['tune.accel', 'Beschleunigung', 0.3, 3, 0.05, times],
        ['tune.brake', 'Bremskraft', 0.3, 3, 0.05, times],
        ['tune.handling', 'Lenkung', 0.3, 3, 0.05, times],
        ['phys.ignoreStats', 'Fahrer-Werte ignorieren', 'bool']] },
      { title: '🧲 Fahrphysik', items: [
        ['phys.gripAll', 'Grip überall', 0.2, 2, 0.05, times],
        ['phys.slide', 'Wie schnell Rutschen aufhört', 2, 40, 1],
        ['phys.gravity', 'Schwerkraft am Hang', 0, 3, 0.1],
        ['phys.offroadSpeed', 'Tempo im Gelände', 0.3, 3, 0.05, times],
        ['phys.collisions', 'Bäume und Häuser fest', 'bool'],
        ['phys.bounce', 'Abprallen', 1, 2, 0.05]] },
      { title: '🧊 Grip pro Untergrund', items: surf },
      { title: '🎥 Kamera', items: [
        ['cam.back', 'Abstand', 3, 25, 0.5],
        ['cam.up', 'Höhe', 1, 15, 0.1],
        ['cam.fov', 'Sichtfeld', 40, 100, 1, v => v + '°']] },
      { title: '🏁 Rennen', items: [
        ['race.laps', 'Runden (0 = wie Strecke)', 0, 10, 1],
        ['race.itemsAll', 'Items auf allen Strecken', 'bool']] },
      { title: '🔊 Sound', items: [
        ['sound.engineVol', 'Motor-Lautstärke', 0, 2, 0.05, times],
        ['sound.musicVol', 'Musik-Lautstärke', 0, 1.5, 0.05, times]] },
      { title: '📱 Kippsteuerung', items: [
        ['tilt.sens', 'Empfindlichkeit', 0.4, 2.5, 0.05, times],
        ['tilt.invert', 'Richtung umkehren', 'bool']] },
      { title: '🐞 Anzeige', items: [
        ['debug.fps', 'Bilder pro Sekunde (FPS) anzeigen', 'bool'],
        ['debug.info', 'Technik-Infos anzeigen', 'bool']] }
    ];
  }

  // Wert lesen/schreiben über einen Pfad wie "car.maxSpeed" oder "surf.ice.grip"
  function resolve(path) {
    const parts = path.split('.'), key = parts.pop();
    let obj = targets[parts.shift()];
    for (const p of parts) obj = obj && obj[p];
    return { obj, key };
  }
  const get = path => { const r = resolve(path); return r.obj ? r.obj[r.key] : undefined; };
  function set(path, value, store) {
    const r = resolve(path);
    if (!r.obj) return;
    r.obj[r.key] = value;
    if (store) {
      if (value === defaults[path]) delete saved[path]; else saved[path] = value;
      try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
      updateBadge();
    }
    onChange(path, value);
  }

  function init(opts) {
    targets = opts.targets; onChange = opts.onChange || onChange;
    for (const g of schema()) for (const it of g.items) defaults[it[0]] = get(it[0]);
    try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { saved = {}; }
    for (const p in saved) if (p in defaults) set(p, saved[p], false); else delete saved[p];
    build();
    updateBadge();
  }

  function fmt(it, v) {
    const f = it[5];
    if (typeof f === 'function') return f(v);
    return (+v).toFixed(it[4] < 1 ? (it[4] < 0.1 ? 2 : 1) : 0);
  }

  function build() {
    const box = document.getElementById('devBody');
    box.innerHTML = '';
    for (const g of schema()) {
      const sec = document.createElement('div');
      sec.className = 'devsec';
      sec.innerHTML = `<h3>${g.title}</h3>`;
      for (const it of g.items) {
        const [path, label] = it, row = document.createElement('label');
        row.className = 'devrow';
        if (it[2] === 'bool') {
          row.innerHTML = `<span>${label}</span><input type="checkbox">`;
          const cb = row.querySelector('input');
          cb.checked = !!get(path);
          cb.addEventListener('change', () => { set(path, cb.checked, true); mark(row, path); });
        } else {
          row.innerHTML = `<span>${label} <b></b></span><input type="range" min="${it[2]}" max="${it[3]}" step="${it[4]}">`;
          const r = row.querySelector('input'), out = row.querySelector('b');
          r.value = get(path); out.textContent = fmt(it, get(path));
          r.addEventListener('input', () => { const v = +r.value; set(path, v, true); out.textContent = fmt(it, v); mark(row, path); });
        }
        mark(row, path);
        sec.appendChild(row);
      }
      box.appendChild(sec);
    }
  }
  function mark(row, path) { row.classList.toggle('changed', path in saved); }

  function updateBadge() {
    const n = Object.keys(saved).length;
    document.querySelectorAll('.devBadge').forEach(el => { el.textContent = n ? ` (${n} geändert)` : ''; });
  }

  function open() { build(); document.getElementById('devPanel').style.display = 'flex'; }
  function close() { document.getElementById('devPanel').style.display = 'none'; }
  function reset() {
    for (const p in defaults) set(p, defaults[p], false);
    saved = {};
    try { localStorage.removeItem(KEY); } catch (e) {}
    build(); updateBadge();
  }
  async function copy() {
    const txt = JSON.stringify(saved, null, 2);
    const btn = document.getElementById('devCopy');
    try { await navigator.clipboard.writeText(txt); btn.textContent = '✓ Kopiert'; }
    catch (e) { document.getElementById('devOut').style.display = 'block'; document.getElementById('devOut').value = txt; btn.textContent = 'Unten markieren & kopieren'; }
    setTimeout(() => { btn.textContent = '📋 Geänderte Werte kopieren'; }, 2500);
  }

  return { init, open, close, reset, copy, changed: () => Object.keys(saved).length };
})();
