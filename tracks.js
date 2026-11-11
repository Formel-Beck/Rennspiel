// =====================================================
//  STRECKEN
//  Jede Strecke ist nur eine Liste von Eckpunkten: [x, z, höhe]
//  (in Metern). Das Spiel macht daraus automatisch eine runde
//  Strasse mit Gelände drumherum.
//
//  Neue Strecke? Einfach einen Block kopieren, id/name ändern
//  und die Punkte verschieben. Tipps:
//   - Die Welt reicht ungefähr von x = -150 bis 150 und z = -100 bis 100
//   - Punkte nicht zu nah aneinander (mind. ~40 m). Zu enge Kurven
//     werden automatisch etwas geglättet.
//   - Höhenunterschied zwischen zwei Punkten lieber unter 8 m
//   - theme: forest, city, desert, mountains, beach oder snow
//   - patches: besondere Stellen auf der Strasse, z.B. Eis.
//     from/to = wo auf der Runde (0 = Start, 0.5 = halbe Runde, 1 = Ziel)
//     surface = ice, wet, sanddrift oder mud (siehe surfaces.js)
// =====================================================
window.TRACKS = [
  {
    id: 'waldring', name: 'Waldring', theme: 'forest', width: 24, laps: 3,
    info: 'Sanfte Hügel zwischen Tannen – Achtung, Schlammloch!',
    patches: [{ surface: 'mud', from: 0.52, to: 0.57 }],
    points: [[-105, 0, 0], [-99, -48, 2], [-51, -73, 5], [12, -60, 6], [42, -18, 3], [87, -54, 1],
             [123, -33, 0], [117, 33, 2], [66, 66, 4], [3, 51, 2], [-36, 78, 0], [-90, 66, 0]]
  },
  {
    id: 'neoncity', name: 'Neon City', theme: 'city', width: 22, laps: 3,
    info: 'Enge Kurven bei Nacht – Pfützen machen es rutschig.',
    patches: [{ surface: 'wet', from: 0.2, to: 0.25 }, { surface: 'wet', from: 0.68, to: 0.72 }],
    points: [[-120, -70, 0], [-20, -75, 0], [20, -70, 0], [30, -30, 0], [70, -20, 0], [120, -25, 0],
             [130, 20, 0], [120, 70, 0], [40, 75, 0], [0, 40, 0], [-50, 45, 0], [-110, 70, 0], [-130, 20, 0]]
  },
  {
    id: 'canyon', name: 'Canyon-Sprint', theme: 'desert', width: 26, laps: 3,
    info: 'Schnelle Wellen – Sandverwehungen bremsen dich aus.',
    patches: [{ surface: 'sanddrift', from: 0.3, to: 0.36 }, { surface: 'sanddrift', from: 0.78, to: 0.83 }],
    points: [[-140, 0, 0], [-120, -70, 3], [-50, -90, 6], [20, -60, 2], [60, -95, 4], [130, -80, 8],
             [145, -10, 4], [110, 40, 0], [140, 85, 2], [60, 95, 5], [0, 60, 1], [-60, 95, 3], [-125, 70, 1]]
  },
  {
    id: 'pass', name: 'Passstrasse', theme: 'mountains', width: 24, laps: 3,
    info: 'Steil bergauf, rasant bergab – die Schwerkraft fährt mit.',
    points: [[-130, 60, 0], [-140, -20, 6], [-100, -80, 14], [-40, -60, 18], [-20, -100, 22], [50, -95, 25],
             [70, -40, 20], [130, -60, 16], [145, 10, 10], [100, 50, 6], [40, 20, 4], [0, 70, 2], [-60, 90, 0]]
  },
  {
    id: 'kueste', name: 'Küstenstrasse', theme: 'beach', width: 24, laps: 3,
    info: 'Palmen, Meerblick und Sand auf der Strasse.',
    patches: [{ surface: 'sanddrift', from: 0.6, to: 0.64 }],
    points: [[-140, 30, 2], [-120, -50, 4], [-60, -70, 6], [0, -40, 3], [60, -75, 5], [130, -50, 7],
             [150, 10, 4], [110, 55, 2], [50, 40, 1], [0, 70, 1], [-60, 60, 1], [-110, 75, 2]]
  },
  {
    id: 'gletscher', name: 'Gletscher-Loop', theme: 'snow', width: 24, laps: 3,
    info: 'Wenig Grip auf Schnee – und dann kommt das Eis!',
    patches: [{ surface: 'ice', from: 0.28, to: 0.35 }, { surface: 'ice', from: 0.66, to: 0.72 }],
    points: [[-140, -10, 0], [-100, -90, 4], [-20, -70, 8], [30, -100, 10], [110, -90, 12], [145, -30, 8],
             [90, 0, 5], [140, 50, 3], [100, 95, 1], [20, 80, 4], [-20, 30, 6], [-70, 85, 2], [-130, 60, 0]]
  }
];
