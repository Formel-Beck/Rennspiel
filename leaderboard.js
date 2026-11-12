// =====================================================
//  ONLINE-BESTENLISTE
//  Die Top 10 jeder Strecke liegen als "gespeicherte Nachricht"
//  auf dem MQTT-Server (dieselben Server wie beim Mehrspieler).
//  Wer eine Zeit fährt, liest die Liste, fügt sich ein und
//  speichert die neue Liste wieder.
//
//  Gezählt wird nur, wenn im Entwicklermodus nichts geändert ist.
// =====================================================
window.Leaderboard = (() => {
  const BASE = 'rennspiel-formelbeck/v1/lb/';
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  const SIZE = 10;
  const lists = {};         // Strecken-id -> [{ n: Name, t: Zeit, c: Fahrer, v: Fahrzeug, d: Datum }]
  const seen = new Set();   // Strecken, deren Liste schon geladen ist
  let client = null, connecting = false, onChange = () => {};

  function brokers() {
    const own = new URLSearchParams(location.search).get('mqtt');
    return own ? own.split(',') : BROKERS;
  }
  // Verbindet sich mit dem ersten erreichbaren Server und lädt alle Listen
  function connect() {
    if (client || connecting || typeof mqtt === 'undefined') return;
    connecting = true;
    const list = brokers();
    let i = 0;
    const tryNext = () => {
      if (i >= list.length) { connecting = false; return; }
      const c = mqtt.connect(list[i++], { clientId: 'lb_' + Math.random().toString(36).slice(2, 10), clean: true, keepalive: 30, connectTimeout: 6000, reconnectPeriod: 0, protocolVersion: 4 });
      let ok = false;
      const fail = () => { if (ok) return; try { c.end(true); } catch (e) {} tryNext(); };
      const timer = setTimeout(fail, 7000);
      c.on('connect', () => {
        ok = true; clearTimeout(timer); client = c; connecting = false;
        c.options.reconnectPeriod = 5000;
        c.subscribe(BASE + '+', { qos: 0 });
        c.on('message', (topic, buf) => {
          const id = topic.slice(BASE.length);
          try { const arr = JSON.parse(buf.toString()); if (Array.isArray(arr)) { lists[id] = clean(arr); seen.add(id); onChange(id); } } catch (e) {}
        });
      });
      c.on('error', fail);
      c.on('close', () => { if (!ok) fail(); });
    };
    tryNext();
  }
  // Nur gültige Einträge behalten, beste Zeit pro Name, sortiert
  function clean(arr) {
    const best = new Map();
    for (const e of arr) {
      if (!e || typeof e.t !== 'number' || !(e.t > 5) || typeof e.n !== 'string') continue;
      const n = e.n.slice(0, 16), k = n.toLowerCase();
      if (!best.has(k) || e.t < best.get(k).t) best.set(k, { n, t: Math.round(e.t * 100) / 100, c: String(e.c || '').slice(0, 20), v: String(e.v || '').slice(0, 20), d: e.d || 0 });
    }
    return [...best.values()].sort((a, b) => a.t - b.t).slice(0, SIZE);
  }
  // Zeit eintragen. Gibt per Rückruf den Platz zurück (oder null)
  function submit(trackId, entry, done) {
    connect();
    let waited = 0;
    const go = () => {
      if (!client || !client.connected) { if ((waited += 300) > 12000) { done && done(null, 'offline'); return; } return setTimeout(go, 300); }
      // kurz warten, bis die gespeicherte Liste angekommen ist
      if (!seen.has(trackId) && waited < 2500) { waited += 300; return setTimeout(go, 300); }
      const merged = clean((lists[trackId] || []).concat([Object.assign({ d: Date.now() }, entry)]));
      lists[trackId] = merged; seen.add(trackId);
      const place = merged.findIndex(e => e.n.toLowerCase() === entry.n.toLowerCase() && e.t === Math.round(entry.t * 100) / 100);
      try { client.publish(BASE + trackId, JSON.stringify(merged), { qos: 1, retain: true }); } catch (e) {}
      onChange(trackId);
      done && done(place >= 0 ? place + 1 : null);
    };
    go();
  }
  return {
    connect, submit, get: id => lists[id] || [], loaded: id => seen.has(id),
    set onChange(f) { onChange = f; }
  };
})();
