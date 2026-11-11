// =====================================================
//  FAHRER – die Figuren aus Marienfeld
//
//  color  = Farbe ihres Autos, number = Startnummer
//  model  = welches 3D-Modell (siehe drivers.js)
//  horn   = welcher Hupen-Sound (siehe drivers.js)
//  stats  = Fahrwerte (1 = normal, höher = besser)
//    top      = Höchsttempo
//    accel    = Beschleunigung
//    handling = Lenkung
//    grip     = Bodenhaftung
//    offroad  = Tempo im Gelände (Gras, Sand, Schnee)
// =====================================================
window.CHARACTERS = [
  { id: 'beck', name: 'Johanal Beck', title: 'Revisor der BECK GROUP',
    info: 'Schwergewicht mit Dreadlocks. Langsam in Fahrt, aber dann kaum zu bremsen.',
    color: '#2f5fb3', number: 'B', model: 'beck', horn: 'tuba',
    stats: { top: 1.06, accel: 0.85, handling: 0.9, grip: 1.05, offroad: 1.0 } },
  { id: 'orla', name: 'Orla Venn', title: 'Funkerin auf Ostwacht',
    info: 'Die Allrounderin. Hupt mit vier kurzen Funk-Impulsen.',
    color: '#e86a2a', number: '4', model: 'orla', horn: 'funk',
    stats: { top: 1.0, accel: 1.0, handling: 1.0, grip: 1.0, offroad: 1.0 } },
  { id: 'waechter', name: 'Der Wächter', title: 'Wache im unteren Frachtdeck',
    info: 'Grunzt dumpf und klebt auf der Strasse wie Kaugummi.',
    color: '#556b2f', number: 'W', model: 'waechter', horn: 'grunz',
    stats: { top: 1.03, accel: 0.9, handling: 0.92, grip: 1.12, offroad: 0.95 } },
  { id: 'locken', name: 'Der Lockenkopf', title: 'Schreit, wenn man ihm zu nahe kommt',
    info: 'Explosiver Start – und ein Schrei als Hupe.',
    color: '#8e44ad', number: 'L', model: 'locken', horn: 'schrei',
    stats: { top: 0.98, accel: 1.14, handling: 1.0, grip: 0.98, offroad: 1.0 } },
  { id: 'maske', name: 'Der Maskierte', title: 'Niemand kennt sein Gesicht',
    info: 'Lenkt messerscharf durch jede Kurve.',
    color: '#26282e', number: '?', model: 'maske', horn: 'maske',
    stats: { top: 1.0, accel: 0.97, handling: 1.14, grip: 0.98, offroad: 1.0 } },
  { id: 'katze', name: 'Die grüne Katze', title: 'Kam einfach mit an Bord',
    info: 'Leicht und flink – aber nicht die Schnellste.',
    color: '#43a047', number: 'K', model: 'katze', horn: 'miau',
    stats: { top: 0.95, accel: 1.15, handling: 1.08, grip: 1.0, offroad: 1.05 } },
  { id: 'geist', name: 'Der Geist', title: 'Fliegt seit Jahren mit',
    info: 'Schwebt über Gras, Sand und Schnee fast ohne Tempoverlust.',
    color: '#8fb8d8', number: 'G', model: 'geist', horn: 'geist',
    stats: { top: 1.0, accel: 1.0, handling: 1.0, grip: 0.95, offroad: 1.3 } }
];
