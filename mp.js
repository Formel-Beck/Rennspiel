// =====================================================
//  MEHRSPIELER
//  Alle Handys verbinden sich mit einem öffentlichen MQTT-Server
//  (eine normale, verschlüsselte Webverbindung). Der Server leitet
//  die Nachrichten weiter – die Handys müssen sich nicht direkt
//  erreichen können. Einer ist Gastgeber und verwaltet den Raum.
//
//  Kanäle (Topics) pro Raum:  rennspiel-formelbeck/v1/<CODE>/…
//   info      Gastgeber meldet: "Raum existiert" (bleibt gespeichert)
//   down      Gastgeber -> alle
//   up/<id>   Spieler -> Gastgeber
//
//  Nachrichten (t = Typ):
//   hello  Spieler meldet sich (Name, Fahrer, Fahrzeug)
//   lobby  Gastgeber schickt Spielerliste und Strecke
//   start  Rennen beginnt (Strecke, Runden, Startplätze)
//   s / ss Positionen der Autos (10x pro Sekunde)
//   fin    jemand ist im Ziel,  honk  jemand hupt
//   ping   "ich bin noch da",   bye   verlässt den Raum
// =====================================================
window.MP = (() => {
  const MAX_PLAYERS = 6;
  const BASE = 'rennspiel-formelbeck/v1/';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // ohne 0/O und 1/I, die verwechselt man leicht
  // Öffentliche Server, der Reihe nach probiert (fällt einer aus, nimmt das Spiel den nächsten)
  const BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081/mqtt'
  ];
  const SEND_HZ = 10;
  const $ = id => document.getElementById(id);

  let client = null, brokerIdx = 0, code = null, stateTimer = null, beatTimer = null, joinTimer = null, wakeLock = null;
  const lastSeen = new Map(); // id -> Zeit der letzten Nachricht (Gastgeber prüft, wer noch da ist)
  let hostSeen = 0;
  const api = {
    active: false, isHost: false, racing: false, myId: null,
    players: new Map(),   // id -> { id, name, char, car }
    remote: new Map(),    // id -> [{ time, s }] (letzte Positionen)
    finishes: new Map(),  // id -> Zeit im Ziel
    trackId: null, laps: 0,
    // vom Spiel gesetzt:
    getInfo: null, getState: null, onStart: null, onHonk: null, onLeave: null, onLobby: null, onRaceEnd: null, onEvent: null
  };

  // Für Tests lässt sich ein eigener Server angeben: ?mqtt=ws://127.0.0.1:8888
  function brokerList() {
    const own = new URLSearchParams(location.search).get('mqtt');
    return own ? own.split(',') : BROKERS;
  }
  const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const randomId = () => 'p' + Math.random().toString(36).slice(2, 10);
  const T = (sub) => BASE + code + '/' + sub;

  function setStatus(text, isError) {
    const el = $('mpStatus'); if (!el) return;
    el.textContent = text || ''; el.classList.toggle('err', !!isError);
  }
  let netOk = true;
  function setNet(ok) {
    netOk = ok;
    const el = $('mpNet'); if (!el) return;
    el.textContent = ok ? (api.isHost ? '🟢 Raum ist online – Freunde können beitreten' : '🟢 Verbunden') : '🟠 Verbindung wird wiederhergestellt …';
    el.classList.toggle('warn', !ok);
  }

  // ---------- Verbindung zum Server ----------
  // Probiert die Server der Reihe nach, ab "start". Ruft done(true/false) auf.
  function connectBroker(start, done) {
    const list = brokerList();
    let i = 0;
    const tryNext = () => {
      if (i >= list.length) { done(false); return; }
      const idx = (start + i) % list.length; i++;
      const c = mqtt.connect(list[idx], {
        clientId: 'rs_' + api.myId + '_' + Math.random().toString(36).slice(2, 6),
        clean: true, keepalive: 20, connectTimeout: 6000, reconnectPeriod: 0, protocolVersion: 4
      });
      let settled = false;
      const fail = () => { if (settled) return; settled = true; try { c.end(true); } catch (e) {} tryNext(); };
      const timer = setTimeout(fail, 7000);
      c.on('connect', () => {
        if (settled) return; settled = true; clearTimeout(timer);
        brokerIdx = idx; client = c;
        c.options.reconnectPeriod = 2000; // ab jetzt bei Abbruch automatisch neu verbinden
        c.on('message', onMessage);
        c.on('offline', () => setNet(false));
        c.on('reconnect', () => setNet(false));
        c.on('connect', () => { resubscribe(); setNet(true); if (api.isHost) announce(); });
        done(true);
      });
      c.on('error', fail);
      c.on('close', () => { if (!settled) fail(); });
    };
    tryNext();
  }
  let subs = [];
  function subscribe(topics) { subs = subs.concat(topics); client.subscribe(topics, { qos: 0 }); }
  function resubscribe() { if (client && subs.length) client.subscribe(subs, { qos: 0 }); }
  function publish(sub, msg, opts) {
    if (!client || !client.connected) return;
    try { client.publish(T(sub), JSON.stringify(msg), Object.assign({ qos: 0 }, opts || {})); } catch (e) {}
  }

  function onMessage(topic, buf) {
    if (!netOk && api.active) setNet(true); // Nachrichten kommen an -> Verbindung steht
    if (!code || topic.indexOf(BASE + code + '/') !== 0) return;
    const sub = topic.slice((BASE + code + '/').length);
    let d = null;
    try { d = buf.length ? JSON.parse(buf.toString()) : null; } catch (e) { return; }
    if (sub === 'info') { onInfo(d); return; }
    if (api.isHost && sub.indexOf('up/') === 0) { if (d) hostReceive(sub.slice(3), d); return; }
    if (!api.isHost && sub === 'down') { if (d && (!d.to || d.to === api.myId)) { hostSeen = performance.now(); clientReceive(d); } }
  }

  // ---------- Gastgeber ----------
  let infoWaiter = null;
  function onInfo(d) { if (infoWaiter) infoWaiter(d); }
  function announce() { publish('info', { host: api.myId, at: Date.now() }, { retain: true }); }

  function host() {
    leave(true);
    api.myId = randomId();
    setStatus('Verbinde mit dem Server …');
    connectBroker(0, ok => {
      if (!ok) { setStatus('Kein Mehrspieler-Server erreichbar. Bist du online? (Manche Schul- oder Firmen-WLANs blockieren das – dann mobile Daten probieren.)', true); leave(true); return; }
      pickFreeCode(0);
    });
  }
  // Neuen Code wählen, der gerade nicht benutzt wird
  function pickFreeCode(tries) {
    code = randomCode();
    subs = [];
    subscribe([T('info')]);
    infoWaiter = d => { if (d && d.host && Date.now() - d.at < 60000 && tries < 5) { infoWaiter = null; client.unsubscribe(T('info')); pickFreeCode(tries + 1); } };
    setTimeout(() => {
      if (!infoWaiter) return;
      infoWaiter = null;
      api.active = true; api.isHost = true;
      api.trackId = api.trackId || TRACKS[0].id;
      api.players.set(api.myId, Object.assign({ id: api.myId }, api.getInfo()));
      subscribe([T('up/+')]);
      announce();
      startLoops();
      setStatus(''); setNet(true); keepAwake();
      render();
    }, 1200);
  }

  function hostReceive(id, d) {
    if (id === api.myId) return;
    lastSeen.set(id, performance.now());
    if (d.t === 'hello') {
      if (!api.players.has(id) && api.players.size >= MAX_PLAYERS) { publish('down', { t: 'full', to: id }); return; }
      const isNew = !api.players.has(id);
      api.players.set(id, { id, name: d.name, char: d.char, car: d.car });
      broadcastLobby();
      if (isNew && api.racing) publish('down', { t: 'busy', to: id });
    } else if (!api.players.has(id)) {
      if (d.t !== 'bye') publish('down', { t: 'who', to: id }); // unbekannt (z.B. nach Neustart): soll sich neu melden
    } else if (d.t === 's') {
      pushRemote(id, d.s);
    } else if (d.t === 'fin') {
      api.finishes.set(id, d.time);
      publish('down', { t: 'fin', id, time: d.time });
    } else if (d.t === 'honk') {
      publish('down', { t: 'honk', id });
      api.onHonk && api.onHonk(id);
    } else if (d.t === 'bye') {
      dropPlayer(id);
    } else if (d.t === 'ev') {
      publish('down', { t: 'ev', id, e: d.e });
      api.onEvent && api.onEvent(id, d.e);
    }
  }
  function dropPlayer(id) {
    if (!api.players.has(id) || id === api.myId) return;
    api.players.delete(id); api.remote.delete(id); lastSeen.delete(id);
    broadcastLobby();
    api.onLeave && api.onLeave(id);
  }
  function lobbyMsg() { return { t: 'lobby', players: [...api.players.values()], track: api.trackId, racing: api.racing }; }
  function broadcastLobby() { publish('down', lobbyMsg()); render(); api.onLobby && api.onLobby(); }

  function chooseTrack(id) { api.trackId = id; broadcastLobby(); }

  function startRace() {
    if (!api.isHost) return;
    const track = TRACKS.find(t => t.id === api.trackId) || TRACKS[0];
    const slots = {}; let k = 0;
    for (const id of api.players.keys()) slots[id] = k++;
    api.racing = true; api.finishes.clear(); api.laps = track.laps;
    publish('down', { t: 'start', track: track.id, laps: track.laps, slots });
    api.onStart && api.onStart(track.id, slots[api.myId], track.laps);
  }
  function endRace() { // zurück in die Lobby
    api.racing = false; api.remote.clear();
    if (api.isHost) broadcastLobby(); else render();
  }

  // ---------- Mitspieler ----------
  const JOIN_SECONDS = 45;
  function join(raw) {
    const c = (raw || '').trim().toUpperCase();
    if (c.length !== 4) { setStatus('Der Code hat 4 Zeichen.', true); return; }
    leave(true);
    code = c; api.myId = randomId();
    const myJoin = code, started = performance.now();
    const hint = parseInt(new URLSearchParams(location.search).get('b'), 10);
    const list = brokerList();
    let tried = 0, startIdx = isNaN(hint) ? 0 : hint % list.length;
    setStatus('Verbinde mit dem Server …');

    const fail = msg => { setStatus(msg, true); leave(true); };
    // Auf einem Server nach dem Raum suchen; wenn nicht gefunden, nächsten Server probieren
    const searchOn = idx => connectBroker(idx, ok => {
      if (code !== myJoin) return;
      if (!ok) { fail('Kein Mehrspieler-Server erreichbar. Bist du online? (Manche Schul- oder Firmen-WLANs blockieren das – dann mobile Daten probieren.)'); return; }
      tried++;
      subs = [];
      subscribe([T('info'), T('down')]);
      const ask = () => publish('up/' + api.myId, Object.assign({ t: 'hello' }, api.getInfo()));
      let found = false;
      infoWaiter = d => { if (d && d.host && Date.now() - d.at < 120000) { found = true; ask(); } };
      const tick = () => {
        if (code !== myJoin || api.active) return;
        const secs = Math.round((performance.now() - started) / 1000);
        if (secs > JOIN_SECONDS) { fail('Raum ' + myJoin + ' nicht gefunden. Stimmt der Code, und ist der Gastgeber noch im Spiel?'); return; }
        if (!found && secs > 4 * tried && tried < list.length && brokerList().length > 1) {
          // Auf diesem Server gibt es den Raum (noch) nicht: nächsten probieren
          try { client.end(true); } catch (e) {} client = null;
          searchOn((brokerIdx + 1) % list.length); return;
        }
        setStatus(found ? 'Raum gefunden – trete bei …' : 'Suche Raum ' + myJoin + ' … (' + secs + ' s)');
        ask(); // nochmal anklopfen, falls die erste Nachricht verloren ging
        joinTimer = setTimeout(tick, 1500);
      };
      ask();
      joinTimer = setTimeout(tick, 1000);
    });
    searchOn(startIdx);
  }

  function clientReceive(d) {
    if (d.t === 'lobby') {
      if (!d.players.some(p => p.id === api.myId)) return; // noch nicht aufgenommen
      if (!api.active) {
        api.active = true; api.isHost = false; infoWaiter = null; clearTimeout(joinTimer);
        startLoops(); setStatus(''); setNet(true); keepAwake();
      }
      api.players.clear();
      for (const p of d.players) api.players.set(p.id, p);
      api.trackId = d.track;
      if (!d.racing && api.racing) { api.racing = false; api.remote.clear(); api.onRaceEnd && api.onRaceEnd(); }
      render(); api.onLobby && api.onLobby();
    } else if (!api.active) {
      if (d.t === 'full') { setStatus('Der Raum ist voll (höchstens ' + MAX_PLAYERS + ' Fahrer).', true); leave(true); }
    } else if (d.t === 'start') {
      if (!(api.myId in d.slots)) return;
      api.racing = true; api.finishes.clear(); api.laps = d.laps; api.trackId = d.track;
      api.onStart && api.onStart(d.track, d.slots[api.myId] || 0, d.laps);
    } else if (d.t === 'ss') {
      for (const it of d.list) if (it.id !== api.myId) pushRemote(it.id, it.s);
    } else if (d.t === 'fin') {
      api.finishes.set(d.id, d.time);
    } else if (d.t === 'honk') {
      if (d.id !== api.myId) api.onHonk && api.onHonk(d.id);
    } else if (d.t === 'ev') {
      if (d.id !== api.myId) api.onEvent && api.onEvent(d.id, d.e);
    } else if (d.t === 'busy') {
      setStatus('Das Rennen läuft schon – du bist beim nächsten dabei.');
    } else if (d.t === 'who') {
      publish('up/' + api.myId, Object.assign({ t: 'hello' }, api.getInfo()));
    } else if (d.t === 'bye') {
      hostLeft();
    }
  }
  function hostLeft() {
    const wasRacing = api.racing;
    leave(true);
    setStatus('Der Gastgeber hat das Spiel verlassen.', true);
    api.onLeave && api.onLeave(null, wasRacing);
  }

  // ---------- Positionen und "noch da?" ----------
  function pushRemote(id, s) {
    if (!api.remote.has(id)) api.remote.set(id, []);
    const buf = api.remote.get(id);
    buf.push({ time: performance.now(), s });
    if (buf.length > 12) buf.shift();
  }
  function startLoops() {
    clearInterval(stateTimer); clearInterval(beatTimer);
    hostSeen = performance.now();
    stateTimer = setInterval(() => {
      if (!api.active || !api.racing || !api.getState) return;
      const s = api.getState();
      if (!s) return;
      if (api.isHost) {
        const list = [{ id: api.myId, s }];
        for (const [id, buf] of api.remote) if (buf.length) list.push({ id, s: buf[buf.length - 1].s });
        publish('down', { t: 'ss', list });
      } else publish('up/' + api.myId, { t: 's', s });
    }, 1000 / SEND_HZ);
    beatTimer = setInterval(() => {
      if (!api.active) return;
      const now = performance.now();
      if (api.isHost) {
        announce();
        if (!api.racing) publish('down', lobbyMsg()); // Lobby regelmässig auffrischen
        for (const id of [...api.players.keys()]) if (id !== api.myId && now - (lastSeen.get(id) || now) > 30000) dropPlayer(id);
      } else {
        if (!api.racing) publish('up/' + api.myId, { t: 'ping' });
        if (now - hostSeen > 40000 && !document.hidden) hostLeft(); // 40 s nichts mehr vom Gastgeber
      }
    }, 4000);
  }

  function sendFinish(time) {
    api.finishes.set(api.myId, time);
    if (api.isHost) publish('down', { t: 'fin', id: api.myId, time });
    else publish('up/' + api.myId, { t: 'fin', time });
  }
  // Item-Ereignis (Pfütze, Schrei-Welle …) an alle schicken
  function sendEvent(e) {
    if (!api.active || !api.racing) return;
    if (api.isHost) publish('down', { t: 'ev', id: api.myId, e });
    else publish('up/' + api.myId, { t: 'ev', e });
  }
  function sendHonk() {
    if (!api.active) return;
    if (api.isHost) publish('down', { t: 'honk', id: api.myId });
    else publish('up/' + api.myId, { t: 'honk' });
  }
  // Fahrer oder Fahrzeug geändert, während man in der Lobby ist
  function updateInfo() {
    if (!api.active) return;
    const info = api.getInfo();
    if (api.isHost) { api.players.set(api.myId, Object.assign({ id: api.myId }, info)); broadcastLobby(); }
    else publish('up/' + api.myId, Object.assign({ t: 'hello' }, info));
  }

  // Zurück in der App (z.B. nach WhatsApp): Verbindung prüfen, Bildschirm wachhalten
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !api.active) return;
    hostSeen = Math.max(hostSeen, performance.now() - 20000);
    if (client && !client.connected) { try { client.reconnect(); } catch (e) {} }
    keepAwake();
  });
  async function keepAwake() {
    try { if (navigator.wakeLock && !wakeLock && !document.hidden) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {}
  }

  function leave(silent) {
    clearInterval(stateTimer); clearInterval(beatTimer); clearTimeout(joinTimer);
    infoWaiter = null;
    if (client) {
      const c = client;
      try {
        if (api.active && api.isHost) { publish('down', { t: 'bye' }); c.publish(T('info'), '', { retain: true }); }
        else if (api.active) publish('up/' + api.myId, { t: 'bye' });
      } catch (e) {}
      setTimeout(() => { try { c.end(true); } catch (e) {} }, 300);
    }
    try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null;
    client = null; code = null; subs = [];
    api.active = false; api.isHost = false; api.racing = false;
    api.players.clear(); api.remote.clear(); api.finishes.clear(); lastSeen.clear();
    if (!silent) setStatus('');
    render();
  }

  // ---------- Einladen ----------
  function inviteLink() { return location.origin + location.pathname + '?raum=' + code + (brokerIdx ? '&b=' + brokerIdx : ''); }
  async function invite() {
    const url = inviteLink(), text = 'Fahr mit mir im Rennspiel! Raum-Code: ' + code;
    try { if (navigator.share) { await navigator.share({ title: 'Rennspiel', text, url }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text + '\n' + url); setStatus('Einladung kopiert – jetzt im Chat einfügen.'); }
    catch (e) { setStatus('Schick deinen Freunden den Code ' + code + '.'); }
  }

  // ---------- Lobby anzeigen ----------
  function esc(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function render() {
    const box = $('lobby'); if (!box) return;
    $('mpConnect').style.display = api.active ? 'none' : '';
    $('mpRoom').style.display = api.active ? '' : 'none';
    if (!api.active) return;
    $('mpCode').textContent = code;
    const list = $('mpPlayers');
    list.innerHTML = '';
    let n = 0;
    for (const p of api.players.values()) {
      const ch = CHARACTERS.find(c => c.id === p.char) || CHARACTERS[0], car = CARS.find(c => c.id === p.car) || CARS[0];
      const li = document.createElement('div');
      li.className = 'mpPlayer';
      li.style.setProperty('--c', ch.color);
      li.innerHTML = `<b>${++n}</b><span class="nm">${esc(p.name)}${p.id === api.myId ? ' (du)' : ''}${n === 1 ? ' 👑' : ''}</span><span class="sub">${esc(ch.name)} · ${esc(car.name)}</span>`;
      list.appendChild(li);
    }
    for (let k = n; k < MAX_PLAYERS; k++) list.insertAdjacentHTML('beforeend', `<div class="mpPlayer empty"><b>${k + 1}</b><span class="nm">frei</span></div>`);
    // Strecke: Gastgeber wählt, die anderen sehen sie
    const tr = $('mpTracks');
    tr.innerHTML = '';
    for (const t of TRACKS.slice().sort((a, b) => (a.difficulty || 2) - (b.difficulty || 2))) {
      const th = THEMES[t.theme];
      const b = document.createElement('button');
      b.className = 'mpTrack' + (t.id === api.trackId ? ' sel' : '');
      b.disabled = !api.isHost && t.id !== api.trackId;
      b.innerHTML = `<span>${th.emoji}</span>${esc(t.name)}`;
      if (api.isHost) b.addEventListener('click', () => chooseTrack(t.id));
      tr.appendChild(b);
    }
    $('mpStart').style.display = api.isHost ? '' : 'none';
    $('mpWait').style.display = api.isHost ? 'none' : '';
    $('mpWait').textContent = api.racing ? 'Rennen läuft – gleich geht es los …' : 'Warte, bis der Gastgeber startet …';
  }

  // ---------- Knöpfe ----------
  function init() {
    let name = '';
    try { name = localStorage.getItem('rennspiel-name') || ''; } catch (e) {}
    $('mpName').value = name;
    $('mpName').addEventListener('input', () => { try { localStorage.setItem('rennspiel-name', $('mpName').value); } catch (e) {} });
    $('mpHost').addEventListener('click', host);
    $('mpJoin').addEventListener('click', () => join($('mpJoinCode').value));
    $('mpJoinCode').addEventListener('keydown', e => { if (e.key === 'Enter') join($('mpJoinCode').value); });
    $('mpLeave').addEventListener('click', () => leave());
    $('mpInvite').addEventListener('click', invite);
    $('mpStart').addEventListener('click', startRace);
    const raum = (new URLSearchParams(location.search).get('raum') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (raum) $('mpJoinCode').value = raum;
    if (typeof mqtt === 'undefined') setStatus('Mehrspieler braucht eine Internetverbindung beim ersten Start.', true);
    render();
    return raum.length === 4 ? raum : null;
  }
  function myName() {
    const n = ($('mpName').value || '').trim().slice(0, 16);
    return n;
  }

  return Object.assign(api, { init, host, join, leave, startRace, endRace, sendFinish, sendHonk, sendEvent, updateInfo, render, myName });
})();
