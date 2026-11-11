// =====================================================
//  STRECKEN
//  Jede Strecke ist nur eine Liste von Eckpunkten: [x, z, höhe]
//  (in Metern). Das Spiel macht daraus automatisch eine runde
//  Strasse mit Gelände drumherum.
//
//  Neue Strecke? Einfach einen Block kopieren, id/name ändern
//  und die Punkte verschieben. Tipps:
//   - Die Welt wächst mit der Strecke mit (bis etwa ±300 m ist gut)
//   - Punkte nicht zu nah aneinander (mind. ~25 m). Zu enge Kurven
//     werden automatisch etwas geglättet.
//   - Steigung lieber unter 10 % (z.B. 5 m Höhe auf 50 m Strecke)
//   - Zwei Strassenteile müssen mind. Strassenbreite + 10 m auseinander sein
//   - laps = Anzahl Runden
//   - difficulty = Schwierigkeit: 1 = Leicht, 2 = Mittel, 3 = Schwer
//   - theme: forest, city, desert, mountains, beach oder snow
//   - patches: besondere Stellen auf der Strasse, z.B. Eis.
//     from/to = wo auf der Runde (0 = Start, 0.5 = halbe Runde, 1 = Ziel)
//     surface = ice, wet, sanddrift oder mud (siehe surfaces.js)
// =====================================================
window.TRACKS = [
  {
    id: 'waldring', name: 'Waldring', theme: 'forest', width: 26, laps: 4, difficulty: 1,
    info: 'Kurzer Klassiker zwischen Tannen – Achtung, Schlammloch!',
    patches: [{ surface: 'mud', from: 0.52, to: 0.57 }],
    points: [[-105, 0, 0], [-99, -48, 2], [-51, -73, 5], [12, -60, 6], [42, -18, 3], [87, -54, 1], [123, -33, 0],
             [117, 33, 2], [66, 66, 4], [3, 51, 2], [-36, 78, 0], [-90, 66, 0]]
  },
  {
    id: 'neoncity', name: 'Neon City', theme: 'city', width: 22, laps: 3, difficulty: 2,
    info: 'Rechtwinklige Kurven um die Häuserblocks, eine Schikane und Pfützen.',
    patches: [{ surface: 'wet', from: 0.17, to: 0.21 }, { surface: 'wet', from: 0.62, to: 0.66 }, { surface: 'wet', from: 0.88, to: 0.92 }],
    points: [[-220, -110, 0], [-200, -130, 0], [-113, -130, 0], [-95, -130, 0], [-70, -115, 0], [-45, -130, 0], [-27, -130, 0],
             [60, -130, 0], [80, -110, 0], [80, -70, 0], [100, -50, 0], [150, -50, 0], [200, -50, 0], [220, -30, 0],
             [220, 40, 0], [220, 110, 0], [200, 130, 0], [130, 130, 0], [60, 130, 0], [40, 110, 0], [40, 70, 0],
             [20, 50, 0], [-30, 50, 0], [-80, 50, 0], [-100, 70, 0], [-100, 110, 0], [-120, 130, 0], [-200, 130, 0],
             [-220, 110, 0], [-220, 37, 0], [-220, -37, 0]]
  },
  {
    id: 'canyon', name: 'Canyon-Schlange', theme: 'desert', width: 24, laps: 2, difficulty: 2,
    info: 'Lange Geraden, enge Haarnadeln und Sandverwehungen.',
    patches: [{ surface: 'sanddrift', from: 0.08, to: 0.12 }, { surface: 'sanddrift', from: 0.48, to: 0.53 }, { surface: 'sanddrift', from: 0.76, to: 0.80 }],
    points: [[-200, -165, 3], [-145, -155, 5.5], [-90, -160, 5.7], [-35, -172, 3.4], [20, -174, 0.7], [75, -163, 0.1], [130, -155, 2.2],
             [185, -162, 5], [240, -173, 6], [275, -110, 6], [240, -61, 5], [185, -63, 7.2], [130, -53, 8], [75, -46, 7],
             [20, -52, 4.8], [-35, -62, 2.7], [-90, -62, 2], [-145, -51, 3.1], [-200, -46, 5.3], [-235, 0, 3], [-200, 57, 2],
             [-145, 64, 4.7], [-90, 58, 4.4], [-35, 48, 1.5], [20, 48, -0.9], [75, 59, -0.1], [130, 64, 2.9], [185, 56, 5],
             [240, 47, 3.8], [275, 110, 4], [240, 168, 3], [185, 158, 4.7], [130, 159, 4.8], [75, 168, 3.3], [20, 173, 1.5],
             [-35, 166, 1.1], [-90, 158, 2.4], [-145, 160, 4.3], [-230, 175, 2], [-290, 120, 1], [-300, 0, 1], [-295, -110, 2],
             [-255, -160, 3]]
  },
  {
    id: 'pass', name: 'Passstrasse', theme: 'mountains', width: 20, laps: 2, difficulty: 3,
    info: 'Schmale Strasse, fünf Spitzkehren bergauf, dann die rasante Abfahrt.',
    points: [[-100, 150, 0], [-160, 150, 2.6], [-215, 150, 5.2], [-215, 105, 7.8], [-160, 105, 10.4], [-100, 105, 13], [-100, 60, 15.6],
             [-160, 60, 18.2], [-215, 60, 20.8], [-215, 15, 23.4], [-160, 15, 26], [-100, 15, 28.6], [-100, -30, 31.2], [-160, -30, 33.8],
             [-215, -30, 36.4], [-245, -75, 36], [-225, -125, 38], [-150, -150, 39], [-60, -135, 38], [30, -155, 37], [120, -140, 35],
             [200, -110, 32], [245, -40, 27], [230, 40, 21], [260, 110, 15], [210, 170, 10], [120, 185, 6], [30, 175, 3],
             [-40, 165, 1]]
  },
  {
    id: 'kueste', name: 'Küstenstrasse', theme: 'beach', width: 26, laps: 2, difficulty: 1,
    info: 'Kurvig am Meer entlang, zurück über die Hügel.',
    patches: [{ surface: 'sanddrift', from: 0.12, to: 0.16 }, { surface: 'sanddrift', from: 0.26, to: 0.29 }],
    points: [[-250, 125, 2], [-185, 142, 2], [-120, 122, 2], [-55, 145, 1], [10, 125, 1], [75, 145, 1], [140, 125, 2],
             [205, 140, 2], [260, 95, 3], [275, 20, 5], [250, -60, 8], [195, -115, 10], [130, -95, 12], [70, -140, 14],
             [5, -110, 12], [-60, -150, 10], [-125, -115, 9], [-190, -145, 7], [-250, -100, 5], [-280, -20, 4], [-280, 60, 3]]
  },
  {
    id: 'gletscher', name: 'Gletscher-Knochen', theme: 'snow', width: 22, laps: 3, difficulty: 3,
    info: 'Schmal und vereist – sogar mitten in der Kurve.',
    patches: [{ surface: 'ice', from: 0.06, to: 0.15 }, { surface: 'ice', from: 0.29, to: 0.34 }, { surface: 'ice', from: 0.54, to: 0.63 }],
    points: [[-110, -35, 6], [-30, -35, 7], [50, -35, 8], [130, -35, 9], [185, -75, 10], [240, -40, 9], [245, 30, 8],
             [195, 75, 6], [130, 40, 5], [50, 40, 4], [-30, 40, 3], [-110, 40, 2], [-170, 80, 1], [-235, 35, 0],
             [-235, -40, 2], [-180, -80, 4]]
  }
];
