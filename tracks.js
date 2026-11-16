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
//   - Ein Punkt mit 4. Wert 1 ([x, z, höhe, 1]) ist eine gewollt enge Bremskurve.
//     Alle anderen Kurven werden auf mindestens 40 m Radius geglättet (minRadius).
//   - mode = 'arcade' oder 'drift' (sonst normale Strecke): bestimmt Fahrgefühl und in welchem Modus sie erscheint
//   - laps = Anzahl Runden
//   - difficulty = Schwierigkeit: 1 = Leicht, 2 = Mittel, 3 = Schwer
//   - items: true = ?-Boxen und Spezial-Boosts (itemRows = wo die Boxen stehen)
//   - tunnels: Abschnitte im Tunnel (from/to wie bei patches)
//   - mountains: Berge [x, z, Radius, Höhe] – neben der Strasse entsteht eine Schlucht,
//                über einem Tunnel bleibt der Berg stehen
//   - rivers: Flüsse mit Punkten [x, z, Wasserhöhe] und Breite (width)
//   - theme: forest, city, desert, mountains, beach oder snow
//   - patches: besondere Stellen auf der Strasse, z.B. Eis.
//     from/to = wo auf der Runde (0 = Start, 0.5 = halbe Runde, 1 = Ziel)
//     surface = ice, wet, sanddrift oder mud (siehe surfaces.js)
// =====================================================
window.TRACKS = [
  {
    id: 'waldring', name: 'Waldring', theme: 'forest', width: 26, laps: 3, difficulty: 1,
    info: 'Lange Gerade, Haarnadel ins Infield, Schlangenlinien den Hügel hinauf, zweite Haarnadel unten und Wellen bis zum Schlammloch.',
    patches: [{ surface: 'mud', from: 0.8, to: 0.84 }],
    // [x, z, höhe, 1 = gewollt enge Bremskurve]
    points: [[-80, -132, 1], [10, -130, 2], [85, -108, 3], [124, -78, 4], [128, -42, 5, 1], [92, -30, 6],
             [30, -42, 6], [-40, -56, 7], [-95, -42, 8], [-102, 8, 9], [-48, 36, 10], [8, 16, 11], [65, 26, 12], [112, 55, 12],
             [168, 58, 10], [212, 92, 8], [200, 140, 6, 1], [150, 152, 5], [92, 126, 4], [40, 152, 3], [-20, 128, 2], [-80, 152, 1],
             [-140, 126, 0], [-190, 80, 0], [-206, 10, 0], [-196, -70, 0], [-160, -118, 0]]
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
    id: 'pass', name: 'Passstrasse', theme: 'mountains', width: 20, laps: 2, difficulty: 3, minRadius: 0, // Spitzkehren bleiben eng
    info: 'Schmale Strasse, fünf Spitzkehren bergauf, dann die rasante Abfahrt.',
    points: [[-100, 150, 0], [-160, 150, 2.6], [-215, 150, 5.2], [-215, 105, 7.8], [-160, 105, 10.4], [-100, 105, 13], [-100, 60, 15.6],
             [-160, 60, 18.2], [-215, 60, 20.8], [-215, 15, 23.4], [-160, 15, 26], [-100, 15, 28.6], [-100, -30, 31.2], [-160, -30, 33.8],
             [-215, -30, 36.4], [-245, -75, 36], [-225, -125, 38], [-150, -150, 39], [-60, -135, 38], [30, -155, 37], [120, -140, 35],
             [200, -110, 32], [245, -40, 27], [230, 40, 21], [260, 110, 15], [210, 170, 10], [120, 185, 6], [30, 175, 3],
             [-40, 165, 1]]
  },
  {
    id: 'kueste', name: 'Küstenstrasse', theme: 'beach', width: 26, laps: 2, difficulty: 2,
    info: 'Schnell am Strand entlang mit einer Schikane, dann den Klippenhügel hinauf zur Spitzkehre und in Schlangenlinien wieder hinunter.',
    patches: [{ surface: 'sanddrift', from: 0.10, to: 0.13 }, { surface: 'sanddrift', from: 0.27, to: 0.30 }, { surface: 'sanddrift', from: 0.86, to: 0.89 }],
    points: [[-260, 140, 2], [-180, 148, 2], [-110, 142, 2], [-62, 140, 2], [-42, 116, 2, 1], [-8, 116, 2, 1], [24, 142, 2],
             [80, 150, 2], [150, 135, 3], [215, 145, 3], [268, 110, 5], [285, 40, 9], [258, -20, 14], [262, -90, 19],
             [235, -128, 22, 1], [205, -92, 21], [160, -40, 18], [100, -55, 15], [52, -12, 12], [-5, -42, 10], [-60, -8, 8],
             [-115, -58, 7], [-172, -108, 5], [-242, -98, 4], [-286, -40, 3], [-292, 40, 2], [-284, 108, 2]]
  },
  {
    id: 'gletscher', name: 'Gletscher-Knochen', theme: 'snow', width: 22, laps: 3, difficulty: 3,
    info: 'Schmal und vereist – sogar mitten in der Kurve.',
    patches: [{ surface: 'ice', from: 0.06, to: 0.15 }, { surface: 'ice', from: 0.29, to: 0.34 }, { surface: 'ice', from: 0.54, to: 0.63 }],
    points: [[-110, -35, 6], [-30, -35, 7], [50, -35, 8], [130, -35, 9], [185, -75, 10], [240, -40, 9], [245, 30, 8],
             [195, 75, 6], [130, 40, 5], [50, 40, 4], [-30, 40, 3], [-110, 40, 2], [-170, 80, 1], [-235, 35, 0],
             [-235, -40, 2], [-180, -80, 4]]
  },
  {
    id: 'regenbogen', name: 'Abenteuer-Rallye', theme: 'rainbow', width: 28, laps: 3, difficulty: 2, speed: 1.35, // 35 % schneller – die Strecke ist sehr lang
    info: '6 km Abenteuer: Flüsse, Berge, Schlucht und zwei Tunnel – mit ?-Boxen und Spezial-Boosts!',
    items: true,                                       // ?-Boxen und Spezial-Boosts auf dieser Strecke
    itemRows: [0.04, 0.13, 0.22, 0.31, 0.47, 0.55, 0.64, 0.72, 0.84, 0.93],
    tunnels: [{ from: 0.364, to: 0.427 }, { from: 0.755, to: 0.783 }],
    // Berge: [x, z, Radius, Höhe]
    mountains: [[640, -340, 230, 120], [250, -645, 170, 120], [0, -665, 180, 145], [-250, -690, 170, 110],
                [150, -355, 150, 80], [-100, -365, 160, 95], [-330, -385, 130, 70], [-450, -45, 120, 55],
                [-900, -700, 260, 160], [950, -650, 260, 170], [980, 250, 240, 120], [-960, 180, 200, 110],
                [300, -60, 200, 70]],
    // Flüsse: Punkte [x, z, Wasserhöhe]
    rivers: [{ width: 32, points: [[-1000, 600, 1.5], [-820, 585, 1.3], [-700, 575, 1.2], [-560, 600, 1.1], [-420, 570, 1], [-280, 600, 0.9], [-140, 567, 0.8], [0, 600, 0.7], [140, 570, 0.6], [280, 600, 0.5], [420, 567, 0.4], [560, 535, 0.3], [700, 560, 0.2], [1000, 600, 0]] },
             { width: 20, points: [[-560, -760, 16], [-610, -650, 14], [-700, -570, 12], [-830, -410, 10], [-858, -260, 8], [-852, -100, 6], [-900, 100, 4], [-930, 300, 2], [-960, 500, 1], [-1000, 610, 1]] }],
    patches: [{ surface: 'boostpad', from: 0.02, to: 0.028 }, { surface: 'boostpad', from: 0.175, to: 0.182 },
              { surface: 'boostpad', from: 0.5, to: 0.507 }, { surface: 'boostpad', from: 0.8, to: 0.807 },
              { surface: 'mud', from: 0.61, to: 0.625 }],
    points: [[-700, 520, 4], [-560, 545, 4], [-420, 515, 5], [-280, 545, 5], [-140, 512, 6], [0, 545, 6], [140, 515, 7],
             [280, 545, 8], [420, 512, 9], [540, 480, 11], [630, 420, 16], [700, 340, 22], [650, 260, 28], [720, 180, 34],
             [660, 100, 40], [730, 20, 46], [700, -70, 52], [760, -150, 57], [740, -250, 61], [680, -330, 63], [590, -390, 63],
             [490, -430, 62], [380, -470, 57], [260, -520, 51], [140, -480, 45], [20, -540, 39], [-110, -490, 33], [-240, -550, 28],
             [-370, -500, 24], [-500, -560, 20], [-630, -500, 17], [-740, -390, 14], [-790, -260, 12], [-780, -130, 11], [-700, -30, 14],
             [-600, 20, 18], [-500, -20, 22], [-400, -60, 24], [-300, -30, 22], [-200, -80, 20], [-90, -20, 18], [-20, 80, 15],
             [-90, 180, 12], [-220, 240, 10], [-370, 260, 8], [-520, 320, 6], [-640, 410, 5]]
  },
  // ===================== ARCADE-STRECKEN (abrupte Lenkung, enge Kurven) =====================
  {
    id: 'zickzack', name: 'Zickzack-Mesa', theme: 'desert', mode: 'arcade', width: 20, laps: 3, difficulty: 2, minRadius: 0,
    info: 'Treppen aus rechtwinkligen Kurven, eine Haarnadel und Schikanen – nur mit schnellen Lenkbewegungen zu schaffen.',
    patches: [{ surface: 'sanddrift', from: 0.47, to: 0.5 }],
    points: [[-200, -130, 2], [-120, -130, 2], [-60, -130, 2], [-60, -80, 3], [-10, -80, 3], [-10, -30, 4], [40, -30, 4],
             [40, 20, 5], [90, 20, 5], [90, 70, 6], [150, 70, 6], [180, 110, 6], [150, 150, 6], [90, 150, 6], [40, 120, 5],
             [-10, 150, 4], [-60, 120, 3], [-110, 150, 3], [-170, 130, 2], [-210, 80, 2], [-180, 30, 2], [-215, -20, 2], [-230, -80, 2]]
  },
  {
    id: 'labyrinth', name: 'Neon-Labyrinth', theme: 'city', mode: 'arcade', width: 18, laps: 3, difficulty: 3, minRadius: 0,
    info: 'Ein Gewirr aus 90-Grad-Ecken zwischen den Hochhäusern. Wer zu spät einlenkt, landet in der Wand.',
    patches: [{ surface: 'wet', from: 0.3, to: 0.33 }, { surface: 'wet', from: 0.7, to: 0.73 }],
    points: [[-180, -140, 0], [-60, -140, 0], [-60, -90, 0], [-120, -90, 0], [-120, -40, 0], [-5, -40, 0], [-5, -140, 0],
             [50, -140, 0], [50, -60, 0], [108, -60, 0], [108, -140, 0], [170, -140, 0], [170, 0, 0], [110, 0, 0], [110, 60, 0],
             [170, 60, 0], [170, 140, 0], [60, 140, 0], [60, 80, 0], [0, 80, 0], [0, 140, 0], [-90, 140, 0], [-90, 60, 0],
             [-150, 60, 0], [-150, 140, 0], [-210, 140, 0], [-210, -100, 0]]
  },
  // ===================== DRIFT-STRECKEN (breit, lange Kurven zum Durchdriften) =====================
  {
    id: 'touge', name: 'Touge-Drift', theme: 'mountains', mode: 'drift', width: 26, laps: 2, difficulty: 2, minRadius: 48,
    info: 'Ein Bergpass mit langen, gleichmässigen Kurven: quer rein, mit Gas durchdriften, Drift-Boost holen.',
    points: [[-230, 120, 10], [-250, 30, 13], [-230, -60, 16], [-170, -140, 19], [-80, -170, 22], [10, -150, 25], [100, -175, 28],
             [190, -150, 30], [240, -80, 30], [210, -10, 28], [240, 60, 25], [200, 130, 22], [120, 150, 20], [60, 100, 18], [100, 40, 17],
             [40, -40, 16], [-40, -60, 15], [-110, -10, 14], [-60, 60, 13], [-120, 130, 12], [-180, 160, 11]]
  },
  {
    id: 'schneedrift', name: 'Schnee-Drift', theme: 'snow', mode: 'drift', width: 28, laps: 3, difficulty: 2, minRadius: 32,
    info: 'Festgefahrener Schnee, weite Kehren und lange S-Kurven – hier gleitet man quer durch jede Biegung.',
    points: [[-200, -60, 0], [-130, -120, 1], [-40, -110, 2], [30, -140, 3], [120, -130, 3], [190, -80, 3], [200, 0, 3],
             [150, 50, 2], [90, 25, 2], [15, 75, 1], [80, 128, 1], [165, 118, 1], [215, 160, 0], [165, 215, 0], [65, 200, 0], [-10, 175, 0], [-60, 140, 0],
             [-120, 170, 0], [-200, 140, 0], [-240, 70, 0], [-230, 0, 0]]
  }
];
