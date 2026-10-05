// Network transport for multiplayer (talks to server/server.js over a WebSocket: your own server when you host,
// another player's server when you join, or the server the page came from).
// The server relays every message to all other players, adding `from`. What the messages mean is decided by
// js/mp.js; this file keeps the connection and, per peer, a short buffer of its states for interpolation:
//   s: state { room, g: geometry (numbers), alive, hp }   (20× per second)
// Remote players are drawn ~100 ms in the past, interpolated between received states.
(function () {
  const N = { ws: null, id: null, team: 'A', peers: new Map(), handlers: {}, delay: 0.1 };

  N.connected = () => !!(N.ws && N.ws.readyState === 1 && N.id != null);
  // url: ws://<server>/ws (default: the server this page came from)
  N.connect = function (handlers, url) {
    N.close();
    N.handlers = handlers || {};
    const ws = N.ws = new WebSocket(url || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'welcome') { N.id = m.id; N.team = m.team; for (const p of m.peers || []) peer(p.id).team = p.team; }
      else if (m.t === 'join') peer(m.id).team = m.team;
      else if (m.t === 'leave') N.peers.delete(m.id);
      else if (m.t === 's') {
        const p = peer(m.from), now = performance.now() / 1000;
        if (p.room !== m.room) p.buf = [];                   // changed map: do not interpolate across
        p.buf.push({ t: now, g: m.g });
        if (p.buf.length > 30) p.buf.shift();
        if (p.alive && !m.alive) p.diedAt = now;
        p.room = m.room; p.alive = m.alive; p.hp = m.hp; p.seen = now;
      }
      const h = N.handlers[m.t];
      if (h) h(m);
    };
    ws.onerror = () => { if (N.handlers.error) N.handlers.error(); };
    ws.onclose = () => { const was = N.id != null; N.ws = null; N.id = null; N.peers.clear(); if (was && N.handlers.close) N.handlers.close(); };
  };
  N.close = () => { if (N.ws) { try { N.ws.onclose = null; N.ws.close(); } catch (e) { /* ignore */ } } N.ws = null; N.id = null; N.peers.clear(); };
  N.send = m => { if (N.connected()) N.ws.send(JSON.stringify(m)); };

  function peer(id) {
    if (!N.peers.has(id)) N.peers.set(id, { id, buf: [], room: null, alive: false, hp: 100, flash: 0, team: 'A' });
    return N.peers.get(id);
  }
  // peers in `room`, each with .g = its interpolated geometry; lerp(a, b, f) interpolates two geometries
  N.peerList = function (room, lerp) {
    const T = performance.now() / 1000 - N.delay, out = [];
    for (const p of N.peers.values()) {
      const b = p.buf;
      if (!b.length || (room != null && p.room !== room)) continue;
      let i = b.length - 1;
      while (i > 0 && b[i - 1].t > T) i--;
      const a = b[Math.max(0, i - 1)], c = b[i];
      const f = c.t > a.t ? WM.clamp((T - a.t) / (c.t - a.t), 0, 1) : 1;
      p.g = lerp ? lerp(a.g, c.g, f) : c.g;
      out.push(p);
    }
    return out;
  };
  window.WNet = N;
})();
