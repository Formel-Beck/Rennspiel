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
//  sound    = Motorklang: pitch = Tonhöhe, sub = Brummen, bright = Helligkeit
// =====================================================
window.CARS = [
  { id: 'vento', name: 'Vento GT', type: 'Kompakt-Coupé · 2024', model: 'coupe',
    info: 'Modernes Sport-Coupé mit Heckantrieb. Das schnellste Auto – präzise, kräftig und mit einem Hauch Heck-Schwenk beim Herausbeschleunigen.',
    drive: 'rwd', oversteer: 0.45,
    maxSpeed: 66, accel: 30, brake: 62, handling: 2.0, grip: 1.1, loose: 0.85, offroad: 0.85,
    sound: { pitch: 1.05, sub: 0.3, bright: 1.1 } },
  { id: 'falke', name: 'Falke S', type: '90er Sportlimousine · 1995', model: 'sedan',
    info: 'Leichte Limousine mit Heckantrieb und Reihensechser-Klang. Sehr gutes Handling – mit Gas in der Kurve lässt sie sich schön driften.',
    drive: 'rwd', oversteer: 0.9,
    maxSpeed: 60, accel: 25, brake: 56, handling: 2.2, grip: 1.0, loose: 0.9, offroad: 0.95,
    sound: { pitch: 0.92, sub: 0.28, bright: 1.15 } },
  { id: 'nordpfeil', name: 'Nordpfeil Turbo', type: '80er Turbo-Schrägheck · 1985', model: 'hatch',
    info: 'Frontantrieb und Turbo: Erst passiert wenig, dann schiebt der Lader kräftig an. Untersteuert etwas, ist dafür auf Schnee, Eis und Schotter der Beste.',
    drive: 'fwd', understeer: 0.2, turbo: { lag: 0.9, gain: 0.6 },
    maxSpeed: 62, accel: 23, brake: 52, handling: 1.9, grip: 0.95, loose: 1.3, offroad: 1.15,
    sound: { pitch: 0.85, sub: 0.35, bright: 0.9 } }
];
