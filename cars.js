// =====================================================
//  FAHRZEUGE
//  Hier liegen die grossen Unterschiede im Spiel.
//
//  model    = welches 3D-Modell (coupe, sedan, hatch)
//  drive    = 'rwd' Heckantrieb (oversteer = wie stark das Heck mit Gas ausbricht)
//             'fwd' Frontantrieb (understeer = schiebt mit Gas über die Vorderräder)
//  turbo    = Turboloch: lag = Sekunden bis voller Ladedruck, gain = Extra-Schub
//  maxSpeed = Höchsttempo in m/s (×3 ≈ km/h)
//  accel    = Beschleunigung, brake = Bremskraft
//  handling = wie stark es lenkt
//  grip     = Haftung auf Asphalt (1 = normal)
//  loose    = Haftung auf rutschigem Boden (Schnee, Eis, Schlamm, Sand)
//  offroad  = Tempo im Gelände (Gras, Sand, Tiefschnee)
//  sound    = Motorklang (Zylinder, Drehzahlen, Klangfarbe – siehe engine.js)
// =====================================================
window.CARS = [
  { id: 'vento', name: 'Vento GT', type: 'Kompakt-Coupé · 2024', model: 'coupe', modes: ['normal', 'arcade', 'drift'],
    info: 'Modernes Sport-Coupé mit Heckantrieb. Das schnellste Auto – präzise, kräftig und mit einem Hauch Heck-Schwenk beim Herausbeschleunigen.',
    drive: 'rwd', oversteer: 0.45,
    maxSpeed: 66, accel: 30, brake: 62, handling: 2.0, grip: 1.1, loose: 0.85, offroad: 0.85,
    // 2-Liter-Turbo-Vierzylinder: kräftig, sportlicher Auspuff mit Knallen, leises Turbo-Pfeifen
    sound: { cyl: 4, idle: 800, redline: 7000, rough: 0.12, body: 85, bright: 1.15, sub: 0.32, induct: 0.35, crackle: 1, spool: 0.6 } },
  { id: 'falke', name: 'Falke S', type: '90er Sportlimousine · 1995', model: 'sedan', modes: ['normal', 'arcade', 'drift'],
    info: 'Leichte Limousine mit Heckantrieb und Reihensechser-Klang. Sehr gutes Handling – mit Gas in der Kurve lässt sie sich schön driften.',
    drive: 'rwd', oversteer: 0.9,
    maxSpeed: 60, accel: 25, brake: 56, handling: 2.2, grip: 1.0, loose: 0.9, offroad: 0.95,
    // Reihensechser ohne Turbo: seidig, hoch drehend, singendes Ansauggeräusch
    sound: { cyl: 6, idle: 750, redline: 7000, rough: 0.05, body: 110, bright: 1.25, sub: 0.22, induct: 0.6, crackle: 0, spool: 0, gain: 1.2 } },
  { id: 'nordpfeil', name: 'Nordpfeil Turbo', type: '80er Turbo-Schrägheck · 1985', model: 'hatch', modes: ['normal', 'arcade'],
    info: 'Frontantrieb und Turbo: Erst passiert wenig, dann schiebt der Lader kräftig an. Untersteuert etwas, ist dafür auf Schnee, Eis und Schotter der Beste.',
    drive: 'fwd', understeer: 0.2, turbo: { lag: 0.9, gain: 0.6 },
    maxSpeed: 62, accel: 23, brake: 52, handling: 1.9, grip: 0.95, loose: 1.3, offroad: 1.15,
    // 80er-Turbo-Vierzylinder: kernig und rauer, dreht weniger hoch, lautes Lader-Pfeifen
    sound: { cyl: 4, idle: 850, redline: 6000, rough: 0.3, body: 70, bright: 0.85, sub: 0.38, induct: 0.25, crackle: 0.25, spool: 0 } }
,
  // ---------- Arcade ----------
  { id: 'kart', name: 'Blitz-Kart', type: 'Arcade · Go-Kart', model: 'kart', modes: ['arcade'],
    info: 'Winzig, leicht und extrem wendig. Lenkt wie auf Schienen – perfekt für enge Ecken. Auf der Geraden aber nicht der Schnellste.',
    drive: 'rwd', oversteer: 0.2,
    maxSpeed: 54, accel: 34, brake: 70, handling: 2.9, grip: 1.25, loose: 0.9, offroad: 0.8,
    // Zweitakt-Motor: hoch drehend und knatternd
    sound: { cyl: 2, idle: 1800, redline: 11000, rough: 0.15, body: 120, bright: 1.1, sub: 0.15, induct: 0.2, crackle: 0.3, spool: 0 } },
  { id: 'knubbel', name: 'Knubbel', type: 'Arcade · Mini-Flitzer', model: 'bubble', modes: ['arcade'],
    info: 'Rund, klein und frech. Gute Beschleunigung, sehr wendig und auch auf Schnee und Sand gut unterwegs.',
    drive: 'fwd', understeer: 0.1,
    maxSpeed: 56, accel: 30, brake: 62, handling: 2.6, grip: 1.1, loose: 1.15, offroad: 1.05,
    // Dreizylinder: brummig und ungleichmässig
    sound: { cyl: 3, idle: 900, redline: 6500, rough: 0.35, body: 85, bright: 1.0, sub: 0.3, induct: 0.3, crackle: 0, spool: 0 } },
  // ---------- Drift ----------
  { id: 'kaze', name: 'Kaze RS', type: 'Drift · Turbo-Coupé', model: 'jdm', modes: ['drift'],
    info: 'Leichtes Heckantriebs-Coupé mit Klappscheinwerfern und grossem Flügel. Kommt leicht quer und lässt sich fein im Drift halten.',
    drive: 'rwd', oversteer: 1.2,
    maxSpeed: 62, accel: 27, brake: 58, handling: 2.35, grip: 0.95, loose: 0.9, offroad: 0.85,
    sound: { cyl: 4, idle: 850, redline: 8000, rough: 0.1, body: 95, bright: 1.15, sub: 0.3, induct: 0.4, crackle: 0.7, spool: 0.8 } },
  { id: 'wolf', name: 'Wolf V8', type: 'Drift · Muscle-Car', model: 'muscle', modes: ['drift'],
    info: 'Langer Bug, breites Heck, dicker V8. Viel Kraft an der Hinterachse – das Heck kommt sofort, wenn man aufs Gas tritt.',
    drive: 'rwd', oversteer: 1.5,
    maxSpeed: 66, accel: 30, brake: 55, handling: 2.05, grip: 0.9, loose: 0.85, offroad: 0.9,
    // V8: tiefes, unrundes Blubbern
    sound: { cyl: 8, idle: 700, redline: 6500, rough: 0.45, body: 60, bright: 0.9, sub: 0.45, induct: 0.3, crackle: 0.6, spool: 0 } }
];

// Beschleunigung: kräftig beim Anfahren, nahe am Höchsttempo immer weniger
// (wie Luftwiderstand). So erreicht man das Höchsttempo nicht mehr sofort.
//  ACCEL_SCALE = allgemeine Stärke, v = Tempo, top = Höchsttempo
window.ACCEL_SCALE = 0.5;
window.accelFactor = (v, top) => ACCEL_SCALE * Math.max(0.1, 1 - Math.pow(Math.max(0, v) / Math.max(1, top), 2));

// Lenkung: bei hohem Tempo lenkt das Auto etwas weniger stark (ruhiger, stabiler)
window.steerSpeedFactor = v => 1 / (1 + 0.4 * Math.max(0, Math.abs(v) - 20) / 40);
