// =====================================================
//  MEHRSPIELER
//  Einer ist Gastgeber und erstellt einen Raum mit Code.
//  Die anderen verbinden sich direkt mit seinem Handy (PeerJS/WebRTC).
//  Der Gastgeber verteilt alle Nachrichten an alle.
//
//  Nachrichten (t = Typ):
//   hello  Spieler meldet sich (Name, Fahrer, Fahrzeug)
//   lobby  Gastgeber schickt Spielerliste und Strecke
//   start  Rennen beginnt (Strecke, Runden, Startplätze)
//   s / ss Positionen der Autos (ca. 15x pro Sekunde)
//   fin    jemand ist im Ziel
//   honk   jemand hupt
// =====================================================
window.MP = (() => {
  const MAX_PLAYERS = 6;
  const PREFIX = 'rennspiel-formelbeck-';                 // damit sich unsere Räume nicht mit anderen PeerJS-Apps mischen
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // ohne 0/O und 1/I, die verwechselt man leicht
  const $ = id => document.getElementById(id);

  let peer = null, hostConn = null, conns = new Map(), code = null, stateTimer = null;
  const api = {
    active: false, isHost: false, racing: false, myId: null,
    players: new Map(),   // id -> { id, name, char, car }
    remote: new Map(),    // id -> [{ time, s }] (letzte Positionen)
    finishes: new Map(),  // id -> Zeit im Ziel
    trackId: null, laps: 0,
    // vom Spiel gesetzt:
    getInfo: null, getState: null, onStart: null, onHonk: null, onLeave: null, onLobby: null, onRaceEnd: null
  };

  // Für Tests lässt sich ein eigener Vermittlungsserver angeben: ?peerhost=localhost:9000
  function peerOptions() {
    const ph = new URLSearchParams(location.search).get('peerhost');
    if (ph) { const [host, port] = ph.split(':'); return { host, port: +port, path: '/', secure: false, debug: 1, config: { iceServers: [] } }; }
    return { debug: 1 };
  }
  const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

  function setStatus(text, isError) {
    const el = $('mpStatus'); if (!el) return;
    el.textContent = text || ''; el.classList.toggle('err', !!isError);
  }

  // ---------- Gastgeber ----------
  function host() {
    leave(true);
    code = randomCode();
    setStatus('Raum wird erstellt …');
    peer = new Peer(PREFIX + code, peerOptions());
    peer.on('open', id => {
      api.active = true; api.isHost = true; api.myId = id;
      api.trackId = api.trackId || TRACKS[0].id;
      api.players.set(id, Object.assign({ id }, api.getInfo()));
      setStatus('');
      startStateLoop();
      render();
    });
    peer.on('connection', conn => {
      conn.on('open', () => conns.set(conn.peer, conn));
      conn.on('data', d => hostReceive(conn, d));
      conn.on('close', () => dropPlayer(conn.peer));
      conn.on('error', () => dropPlayer(conn.peer));
    });
    peer.on('error', err => {
      if (err.type === 'unavailable-id') return host(); // Code schon vergeben: neuen nehmen
      networkError(err);
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  }

  function hostReceive(conn, d) {
    const id = conn.peer;
    if (d.t === 'hello') {
      if (!api.players.has(id) && api.players.size >= MAX_PLAYERS) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; }
      api.players.set(id, { id, name: d.name, char: d.char, car: d.car });
      broadcastLobby();
      if (api.racing) conn.send({ t: 'busy' });
    } else if (d.t === 's') {
      pushRemote(id, d.s);
    } else if (d.t === 'fin') {
      api.finishes.set(id, d.time);
      broadcast({ t: 'fin', id, time: d.time });
    } else if (d.t === 'honk') {
      broadcast({ t: 'honk', id }, id);
      api.onHonk && api.onHonk(id);
    }
  }

  function dropPlayer(id) {
    if (!conns.has(id) && !api.players.has(id)) return;
    conns.delete(id); api.players.delete(id); api.remote.delete(id);
    broadcastLobby();
    api.onLeave && api.onLeave(id);
  }

  function broadcast(msg, exceptId) {
    for (const [id, c] of conns) if (id !== exceptId && c.open) { try { c.send(msg); } catch (e) {} }
  }
  function lobbyMsg() { return { t: 'lobby', players: [...api.players.values()], track: api.trackId, racing: api.racing, code }; }
  function broadcastLobby() { broadcast(lobbyMsg()); render(); api.onLobby && api.onLobby(); }

  function chooseTrack(id) { api.trackId = id; broadcastLobby(); }

  function startRace() {
    if (!api.isHost) return;
    const track = TRACKS.find(t => t.id === api.trackId) || TRACKS[0];
    const slots = {}; let k = 0;
    for (const id of api.players.keys()) slots[id] = k++;
    api.racing = true; api.finishes.clear(); api.laps = track.laps;
    const msg = { t: 'start', track: track.id, laps: track.laps, slots };
    broadcast(msg);
    api.onStart && api.onStart(track.id, slots[api.myId], track.laps);
  }
  function endRace() { // zurück in die Lobby
    api.racing = false; api.remote.clear();
    if (api.isHost) broadcastLobby(); else render();
  }

  // ---------- Mitspieler ----------
  function join(raw) {
    const c = (raw || '').trim().toUpperCase();
    if (c.length !== 4) { setStatus('Der Code hat 4 Zeichen.', true); return; }
    leave(true);
    code = c;
    setStatus('Verbinde mit Raum ' + code + ' …');
    peer = new Peer(undefined, peerOptions());
    peer.on('open', id => {
      api.myId = id;
      hostConn = peer.connect(PREFIX + code, { reliable: true });
      const timeout = setTimeout(() => { if (!api.active) { setStatus('Raum ' + code + ' nicht gefunden. Stimmt der Code?', true); leave(true); } }, 9000);
      hostConn.on('open', () => {
        clearTimeout(timeout);
        api.active = true; api.isHost = false;
        hostConn.send(Object.assign({ t: 'hello' }, api.getInfo()));
        startStateLoop();
        setStatus('');
      });
      hostConn.on('data', clientReceive);
      hostConn.on('close', () => { if (api.active) networkError({ type: 'host-left' }); });
    });
    peer.on('error', err => {
      if (err.type === 'peer-unavailable') { setStatus('Raum ' + code + ' nicht gefunden. Stimmt der Code?', true); leave(true); return; }
      networkError(err);
    });
  }

  function clientReceive(d) {
    if (d.t === 'lobby') {
      api.players.clear();
      for (const p of d.players) api.players.set(p.id, p);
      api.trackId = d.track;
      if (!d.racing && api.racing) { api.racing = false; api.remote.clear(); api.onRaceEnd && api.onRaceEnd(); }
      render(); api.onLobby && api.onLobby();
    } else if (d.t === 'start') {
      api.racing = true; api.finishes.clear(); api.laps = d.laps; api.trackId = d.track;
      api.onStart && api.onStart(d.track, d.slots[api.myId] || 0, d.laps);
    } else if (d.t === 'ss') {
      for (const it of d.list) if (it.id !== api.myId) pushRemote(it.id, it.s);
    } else if (d.t === 'fin') {
      api.finishes.set(d.id, d.time);
    } else if (d.t === 'honk') {
      api.onHonk && api.onHonk(d.id);
    } else if (d.t === 'full') {
      setStatus('Der Raum ist voll (höchstens ' + MAX_PLAYERS + ' Fahrer).', true); leave(true);
    } else if (d.t === 'busy') {
      setStatus('Das Rennen läuft schon – du bist beim nächsten dabei.');
    }
  }

  // ---------- Positionen austauschen ----------
  function pushRemote(id, s) {
    if (!api.remote.has(id)) api.remote.set(id, []);
    const buf = api.remote.get(id);
    buf.push({ time: performance.now(), s });
    if (buf.length > 12) buf.shift();
  }
  function startStateLoop() {
    clearInterval(stateTimer);
    stateTimer = setInterval(() => {
      if (!api.active || !api.racing || !api.getState) return;
      const s = api.getState();
      if (!s) return;
      if (api.isHost) {
        const list = [{ id: api.myId, s }];
        for (const [id, buf] of api.remote) if (buf.length) list.push({ id, s: buf[buf.length - 1].s });
        broadcast({ t: 'ss', list });
      } else if (hostConn && hostConn.open) {
        try { hostConn.send({ t: 's', s }); } catch (e) {}
      }
    }, 66);
  }

  function sendFinish(time) {
    api.finishes.set(api.myId, time);
    if (api.isHost) broadcast({ t: 'fin', id: api.myId, time });
    else if (hostConn && hostConn.open) hostConn.send({ t: 'fin', time });
  }
  function sendHonk() {
    if (!api.active) return;
    if (api.isHost) broadcast({ t: 'honk', id: api.myId });
    else if (hostConn && hostConn.open) hostConn.send({ t: 'honk' });
  }
  // Fahrer oder Fahrzeug geändert, während man in der Lobby ist
  function updateInfo() {
    if (!api.active) return;
    const info = api.getInfo();
    if (api.isHost) { api.players.set(api.myId, Object.assign({ id: api.myId }, info)); broadcastLobby(); }
    else if (hostConn && hostConn.open) hostConn.send(Object.assign({ t: 'hello' }, info));
  }

  function networkError(err) {
    const msgs = {
      'host-left': 'Der Gastgeber hat das Spiel verlassen.',
      'network': 'Keine Verbindung zum Vermittlungsdienst. Bist du online?',
      'server-error': 'Der Vermittlungsdienst antwortet nicht. Versuch es gleich nochmal.',
      'browser-incompatible': 'Dieser Browser kann leider keinen Mehrspieler.',
      'webrtc': 'Die Verbindung zu den anderen Handys hat nicht geklappt.'
    };
    const wasRacing = api.racing;
    leave(true);
    setStatus(msgs[err.type] || ('Verbindungsfehler: ' + (err.type || err.message || err)), true);
    api.onLeave && api.onLeave(null, wasRacing);
  }

  function leave(silent) {
    clearInterval(stateTimer);
    try { if (hostConn) hostConn.close(); } catch (e) {}
    for (const c of conns.values()) { try { c.close(); } catch (e) {} }
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = null; hostConn = null; conns = new Map(); code = null;
    api.active = false; api.isHost = false; api.racing = false; api.myId = null;
    api.players.clear(); api.remote.clear(); api.finishes.clear();
    if (!silent) setStatus('');
    render();
  }

  // ---------- Einladen ----------
  function inviteLink() { return location.origin + location.pathname + '?raum=' + code; }
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
    const raum = new URLSearchParams(location.search).get('raum');
    if (raum) $('mpJoinCode').value = raum.toUpperCase();
    if (typeof Peer === 'undefined') setStatus('Mehrspieler braucht eine Internetverbindung beim ersten Start.', true);
    render();
    return !!raum;
  }
  function myName() {
    const n = ($('mpName').value || '').trim().slice(0, 16);
    return n;
  }

  return Object.assign(api, { init, host, join, leave, startRace, endRace, sendFinish, sendHonk, updateInfo, render, myName });
})();
