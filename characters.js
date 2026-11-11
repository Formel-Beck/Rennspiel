// =====================================================
//  FAHRER – die Figuren aus Marienfeld
//
//  color  = Farbe ihres Autos, number = Startnummer
//  model  = welches 3D-Modell (siehe drivers.js)
//  horn   = welcher Hupen-Sound (siehe drivers.js)
//  stats  = kleine Boni (1 = normal, 1.05 = 5 % besser).
//           Die grossen Unterschiede machen die Fahrzeuge (cars.js)!
//    top      = Höchsttempo
//    accel    = Beschleunigung
//    handling = Lenkung
//    grip     = Bodenhaftung
//    offroad  = Tempo im Gelände (Gras, Sand, Schnee)
//
//  Eigenes 3D-Modell (.glb) verwenden: Datei neben index.html legen
//  und beim Fahrer eintragen, z.B.  glb: 'beck.glb'
//    glbHeight = wie gross das ganze Modell ist (Standard 2.0)
//    glbY      = wie weit es nach unten rutscht, damit die Hüfte
//                auf dem Sitz ist (Standard -1.04)
//    glbRotY   = Drehung, falls es in die falsche Richtung schaut
//  Ohne glb wird das eingebaute Modell aus drivers.js benutzt.
// =====================================================
window.CHARACTERS = [
  { id: 'beck', name: 'Johanal Beck', title: 'Revisor der BECK GROUP',
    info: 'Schwergewicht mit Dreadlocks. Etwas mehr Endtempo, etwas träger beim Start.',
    color: '#2f5fb3', number: 'B', model: 'beck', horn: 'tuba',
    glb: 'beck.glb', glbHeight: 1.15, glbY: -0.12, // sitzt schon im Schneidersitz
    stats: { top: 1.04, accel: 0.97, handling: 1.0, grip: 1.0, offroad: 1.0 } },
  { id: 'orla', name: 'Orla Venn', title: 'Funkerin auf Ostwacht',
    info: 'Die Allrounderin: ein bisschen mehr Lenkung und Grip. Hupt mit vier Funk-Impulsen.',
    color: '#e86a2a', number: '4', model: 'orla', horn: 'funk',
    stats: { top: 1.0, accel: 1.0, handling: 1.02, grip: 1.02, offroad: 1.0 } },
  { id: 'waechter', name: 'Der Wächter', title: 'Wache im unteren Frachtdeck',
    info: 'Grunzt dumpf und hat am meisten Grip.',
    color: '#556b2f', number: 'W', model: 'waechter', horn: 'grunz',
    stats: { top: 1.0, accel: 1.0, handling: 0.98, grip: 1.06, offroad: 1.0 } },
  { id: 'locken', name: 'Der Lockenkopf', title: 'Schreit, wenn man ihm zu nahe kommt',
    info: 'Bester Start – und ein Schrei als Hupe.',
    color: '#8e44ad', number: 'L', model: 'locken', horn: 'schrei',
    glb: 'locken.glb', glbHeight: 0.8, glbY: 0.32, // nur Kopf und Schultern
    stats: { top: 0.98, accel: 1.07, handling: 1.0, grip: 1.0, offroad: 1.0 } },
  { id: 'maske', name: 'Der Maskierte', title: 'Niemand kennt sein Gesicht',
    info: 'Lenkt am schärfsten durch die Kurven.',
    color: '#26282e', number: '?', model: 'maske', horn: 'maske',
    stats: { top: 1.0, accel: 1.0, handling: 1.06, grip: 0.98, offroad: 1.0 } },
  { id: 'katze', name: 'Die grüne Katze', title: 'Kam einfach mit an Bord',
    info: 'Flink beim Start und in Kurven, dafür etwas langsamer.',
    color: '#43a047', number: 'K', model: 'katze', horn: 'miau',
    stats: { top: 0.97, accel: 1.04, handling: 1.03, grip: 1.0, offroad: 1.0 } },
  { id: 'geist', name: 'Der Geist', title: 'Fliegt seit Jahren mit',
    info: 'Schwebt etwas schneller über Gras, Sand und Schnee.',
    color: '#8fb8d8', number: 'G', model: 'geist', horn: 'geist',
    stats: { top: 1.0, accel: 1.0, handling: 1.0, grip: 0.98, offroad: 1.1 } }
];
