// =====================================================
//  THEMEN – wie eine Streckenart aussieht
//  Farben, Licht, Wetter, Deko. Farben sind Hex-Codes (#rrggbb).
//
//  props: welche Deko verteilt wird
//    type     = pine, snowpine, tree, bush, rock, cactus, drybush,
//               palm, umbrella, snowman, building, lamp
//    count    = wie viele
//    minDist  = Mindestabstand zum Strassenrand (Meter)
//    maxDist  = Höchstabstand zum Strassenrand (optional)
//  backdrop: Kulisse am Horizont (hills, peaks, mesas, skyline, sea)
//  roadSurface / offroadSurface: Untergrund auf und neben der Strasse (siehe surfaces.js)
// =====================================================
window.THEMES = {
  forest: {
    name: 'Wald', emoji: '🌲',
    skyTop: '#4f9fe0', skyBottom: '#d4ecff', fog: [140, 470],
    ground: '#4f9447', groundVar: '#3f7f3a',
    road: '#5a5d61', roadLine: '#ffffff', curb: ['#d32f2f', '#ffffff'], banner: '#d32f2f',
    sun: '#fff4dc', sunIntensity: 0.9, sunDir: [0.5, 1, 0.35], ambient: 0.55, hemiGround: '#557a3a',
    hills: 7,
    roadSurface: 'asphalt', offroadSurface: 'grass',
    props: [{ type: 'pine', count: 230 }, { type: 'tree', count: 90 }, { type: 'bush', count: 110 }, { type: 'rock', count: 40 }],
    backdrop: 'hills'
  },
  city: {
    name: 'Stadt', emoji: '🌃', night: true,
    skyTop: '#070b24', skyBottom: '#3b2a5c', fog: [90, 400],
    ground: '#3b3f46', groundVar: '#33373d', sidewalk: '#8d929a',
    road: '#2c2f33', roadLine: '#ffd23f', curb: ['#1e88e5', '#ffffff'], banner: '#ff2bd6',
    sun: '#9fb4ff', sunIntensity: 0.35, sunDir: [-0.4, 1, 0.3], ambient: 0.4, hemiGround: '#222233',
    hills: 0,
    roadSurface: 'asphalt', offroadSurface: 'concrete',
    props: [{ type: 'building', count: 170, minDist: 10, maxDist: 75 }, { type: 'lamp', along: 7 }],
    backdrop: 'skyline'
  },
  desert: {
    name: 'Wüste', emoji: '🏜️',
    skyTop: '#3d8fd6', skyBottom: '#ffe1b0', fog: [150, 490],
    ground: '#e3b878', groundVar: '#d4a463',
    road: '#6b625a', roadLine: '#f5f0e0', curb: ['#e65100', '#ffffff'], banner: '#e65100',
    sun: '#ffe2b0', sunIntensity: 1.0, sunDir: [0.3, 0.9, -0.5], ambient: 0.55, hemiGround: '#c49a5a',
    hills: 9,
    roadSurface: 'dustyroad', offroadSurface: 'sand',
    props: [{ type: 'cactus', count: 90 }, { type: 'rock', count: 90, color: '#b5714a' }, { type: 'drybush', count: 120 }],
    backdrop: 'mesas'
  },
  mountains: {
    name: 'Berge', emoji: '⛰️',
    skyTop: '#3b7fd1', skyBottom: '#e3f1ff', fog: [150, 530],
    ground: '#6a9a4f', groundVar: '#5a8743', rock: '#8b8a7e', rockAbove: 24,
    road: '#55585c', roadLine: '#ffffff', curb: ['#d32f2f', '#ffffff'], banner: '#2e7d32',
    sun: '#ffffff', sunIntensity: 0.95, sunDir: [-0.5, 1, 0.4], ambient: 0.55, hemiGround: '#5a7a4a',
    hills: 14,
    roadSurface: 'asphalt', offroadSurface: 'grass',
    props: [{ type: 'pine', count: 260 }, { type: 'rock', count: 80 }, { type: 'bush', count: 60 }],
    backdrop: 'peaks'
  },
  beach: {
    name: 'Strand', emoji: '🏖️',
    skyTop: '#2e9be6', skyBottom: '#d8f4ff', fog: [160, 530],
    ground: '#7fb35a', groundVar: '#6ea24c', sand: '#f0d9a0', shoreZ: 182,
    road: '#5a5d61', roadLine: '#ffffff', curb: ['#00acc1', '#ffffff'], banner: '#00acc1',
    sun: '#fff6e5', sunIntensity: 1.0, sunDir: [0.2, 1, 0.6], ambient: 0.6, hemiGround: '#b5a070',
    hills: 5,
    roadSurface: 'asphalt', offroadSurface: 'grass', beachSand: true,
    props: [{ type: 'palm', count: 70 }, { type: 'umbrella', count: 26, nearShore: true, minDist: 3 },
            { type: 'bush', count: 60 }, { type: 'rock', count: 25 }],
    backdrop: 'sea'
  },
  snow: {
    name: 'Schnee', emoji: '❄️', snowfall: true,
    skyTop: '#8fb3d6', skyBottom: '#eef4fa', fog: [100, 390],
    ground: '#f4f8fc', groundVar: '#e0e9f2',
    road: '#62666b', roadLine: '#ffffff', curb: ['#3949ab', '#e53935'], banner: '#3949ab',
    sun: '#ffffff', sunIntensity: 0.7, sunDir: [0.4, 0.8, 0.5], ambient: 0.7, hemiGround: '#dfe8f0',
    hills: 10,
    roadSurface: 'snowroad', offroadSurface: 'snow',
    props: [{ type: 'snowpine', count: 240 }, { type: 'rock', count: 40, color: '#8a9099' },
            { type: 'snowman', count: 8, minDist: 4, maxDist: 16 }],
    backdrop: 'peaks'
  },
  rainbow: {
    name: 'Regenbogen', emoji: '🌈',
    skyTop: '#5b6cff', skyBottom: '#ffc6e8', fog: [220, 700],
    ground: '#7ed957', groundVar: '#5fc24a',
    road: '#5b5f6b', roadLine: '#ffffff', curb: ['#ff4fa3', '#ffe14d'], banner: '#ff4fa3',
    sun: '#fff1d6', sunIntensity: 1.0, sunDir: [0.4, 1, 0.3], ambient: 0.65, hemiGround: '#88cc66',
    hills: 14, rock: '#8f8478', rockAbove: 58, snowAbove: 105,
    roadSurface: 'asphalt', offroadSurface: 'grass',
    props: [{ type: 'lolli', count: 70 }, { type: 'tree', count: 90 }, { type: 'pine', count: 90 }, { type: 'bush', count: 100 }, { type: 'rock', count: 40, color: '#b39ddb' }],
    backdrop: 'peaks'
  }
};
