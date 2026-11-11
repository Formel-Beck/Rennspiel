// =====================================================
//  FAHRZEUGE
//  Hier liegen die grossen Unterschiede im Spiel.
//
//  model    = welches 3D-Modell (sport, formula, kart, monster, buggy)
//  maxSpeed = Höchsttempo in m/s (×3 ≈ km/h)
//  accel    = Beschleunigung, brake = Bremskraft
//  handling = wie stark es lenkt
//  grip     = Haftung auf Asphalt (1 = normal)
//  loose    = Haftung auf rutschigem Boden (Schnee, Eis, Schlamm, Sand)
//  offroad  = Tempo im Gelände (Gras, Sand, Tiefschnee)
//  sound    = Motorklang: pitch = Tonhöhe, sub = Brummen, bright = Helligkeit
// =====================================================
window.CARS = [
  { id: 'blitz', name: 'Blitz', type: 'Sport-Cabrio', model: 'sport',
    info: 'Schnell und ausgewogen – der Klassiker für jede Strecke.',
    maxSpeed: 60, accel: 26, brake: 55, handling: 1.9, grip: 1.0, loose: 1.0, offroad: 1.0,
    sound: { pitch: 1, sub: 0.25, bright: 1 } },
  { id: 'rakete', name: 'Rakete', type: 'Formel-Renner', model: 'formula',
    info: 'Unschlagbar auf Asphalt. Im Gelände und auf Eis aber hilflos.',
    maxSpeed: 72, accel: 30, brake: 72, handling: 2.1, grip: 1.25, loose: 0.55, offroad: 0.6,
    sound: { pitch: 1.35, sub: 0.15, bright: 1.35 } },
  { id: 'flitzer', name: 'Flitzer', type: 'Go-Kart', model: 'kart',
    info: 'Winzig, wendig und blitzschnell beim Start – aber wenig Endtempo.',
    maxSpeed: 46, accel: 40, brake: 62, handling: 2.6, grip: 1.1, loose: 0.95, offroad: 0.9,
    sound: { pitch: 1.8, sub: 0.05, bright: 1.4 } },
  { id: 'brummbaer', name: 'Brummbär', type: 'Monstertruck', model: 'monster',
    info: 'Riesenräder! Langsam und schwerfällig, aber im Gelände kaum zu bremsen.',
    maxSpeed: 50, accel: 20, brake: 45, handling: 1.5, grip: 0.9, loose: 1.35, offroad: 1.8,
    sound: { pitch: 0.62, sub: 0.5, bright: 0.7 } },
  { id: 'fuchs', name: 'Wüstenfuchs', type: 'Buggy', model: 'buggy',
    info: 'Der Allrounder für Sand, Schnee und Schlamm.',
    maxSpeed: 56, accel: 25, brake: 55, handling: 1.95, grip: 0.95, loose: 1.25, offroad: 1.4,
    sound: { pitch: 0.9, sub: 0.35, bright: 0.95 } }
];
