// =====================================================
//  UNTERGRÜNDE – wie sich das Auto auf jedem Belag verhält
//
//  grip   = Bodenhaftung (1 = klebt, 0.1 = rutscht wie auf Eis)
//  accel  = wie gut das Auto beschleunigt (1 = normal)
//  top    = Höchsttempo im Verhältnis zum Auto (1 = volles Tempo)
//  topAbs = festes Höchsttempo (statt top), z.B. im Gras
//  drag   = wie stark man abgebremst wird, wenn man zu schnell ist
//  fx     = Farbe von Staub/Rauch/Spritzern
//  dusty  = wirbelt beim Fahren Staub auf
//  splash = spritzt
//  patch  = Aussehen, wenn der Belag als Fleck auf der Strasse liegt
// =====================================================
window.SURFACES = {
  asphalt:   { name: 'Asphalt',          grip: 1.0,  accel: 1.0,  top: 1.0,  drag: 4,  fx: '#d6d6d6' },
  dustyroad: { name: 'Sandiger Asphalt', grip: 0.85, accel: 1.0,  top: 1.0,  drag: 4,  fx: '#e8cf95' },
  snowroad:  { name: 'Schneefahrbahn',   grip: 0.5,  accel: 0.85, top: 0.95, drag: 4,  fx: '#ffffff' },

  grass:     { name: 'Wiese',      grip: 0.6,  accel: 0.6, topAbs: 22, drag: 45, fx: '#6b4a2b', dusty: true },
  concrete:  { name: 'Gehsteig',   grip: 0.9,  accel: 0.8, topAbs: 28, drag: 40, fx: '#9a9a9a', dusty: true },
  sand:      { name: 'Sand',       grip: 0.45, accel: 0.5, topAbs: 19, drag: 50, fx: '#d9b27a', dusty: true },
  snow:      { name: 'Tiefschnee', grip: 0.35, accel: 0.5, topAbs: 17, drag: 45, fx: '#ffffff', dusty: true },
  water:     { name: 'Wasser',     grip: 0.4,  accel: 0.4, topAbs: 9,  drag: 60, fx: '#ffffff', splash: true },

  // Flecken auf der Strasse (werden in tracks.js bei "patches" verwendet)
  ice:       { name: 'Eis!',          grip: 0.12, accel: 0.45, top: 1.0,  drag: 1,  fx: '#e0f4ff', warn: true,
               patch: { color: '#d8f3ff', opacity: 0.8, shininess: 150 } },
  wet:       { name: 'Pfütze!',       grip: 0.55, accel: 0.9,  top: 1.0,  drag: 4,  fx: '#cfd8e8', splash: true, warn: true,
               patch: { color: '#16233d', opacity: 0.6, shininess: 200 } },
  sanddrift: { name: 'Sandverwehung!', grip: 0.55, accel: 0.7, top: 0.75, drag: 25, fx: '#e3b878', dusty: true, warn: true,
               patch: { color: '#e6c084', opacity: 0.95, shininess: 2 } },
  boostpad:  { name: 'Turbo!',        grip: 1.0,  accel: 1.0,  top: 1.0,  drag: 4,  fx: '#ffd54a', boost: 1.2, warn: false,
               patch: { color: '#ff9800', opacity: 0.9, shininess: 80, arrows: true } },
  mud:       { name: 'Schlamm!',      grip: 0.3,  accel: 0.9,  top: 0.95, drag: 4,  fx: '#5a3d22', dusty: true, warn: true,
               patch: { color: '#5b3f24', opacity: 0.9, shininess: 30 } }
};
