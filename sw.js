// =====================================================
//  SERVICE WORKER – macht das Spiel offline spielbar
//
//  WICHTIG nach Änderungen am Spiel: die Versionsnummer unten
//  um eins erhöhen (v1 -> v2 …). Dann holen sich alle Handys
//  beim nächsten Start automatisch die neue Version
//  (die App lädt sich dann einmal kurz neu).
//  Neue Dateien auch in die Liste FILES eintragen!
//  Alle Dateien liegen im selben Ordner (keine Unterordner).
// =====================================================
const VERSION = 'rennspiel-v9';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'favicon.png',
  'three.min.js', 'GLTFLoader.js',
  'themes.js', 'tracks.js', 'cars.js', 'characters.js', 'surfaces.js',
  'props.js', 'world.js', 'drivers.js', 'engine.js', 'car.js', 'devmode.js', 'game.js',
  'beck.glb', 'locken.glb'
];

// Beim Installieren: alle Dateien speichern
self.addEventListener('install', e => {
  // cache: 'reload' = immer frisch von GitHub holen, nie aus dem Browser-Zwischenspeicher
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

// Alte Versionen löschen
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Zuerst aus dem Speicher laden (schnell, auch offline),
// im Hintergrund nach einer neueren Version schauen
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    // Seitenaufrufe (navigate) dürfen nicht mit Zusatz-Optionen geholt werden, darum hier nur die Adresse
    const req = e.request.mode === 'navigate' ? e.request.url : e.request;
    const fresh = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
