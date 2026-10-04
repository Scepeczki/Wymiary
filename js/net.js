// Network client for multiplayer (talks to server/server.js over a WebSocket on the same host).
// Every client simulates its own player; it sends its state 20× per second and events:
//   s: state {p: feet, yaw, ph, alive, hp}   f: shot {p, d}   h: hit {to, dmg}   d: death {by}
// Hits are decided by the shooter (it sees the target where it is drawn), the victim applies the damage.
// Remote players are drawn ~100 ms in the past, interpolated between received states.
(function () {
  const N = { ws: null, id: null, peers: new Map(), handlers: {}, delay: 0.1 };

  N.connected = () => !!(N.ws && N.ws.readyState === 1 && N.id != null);
  N.connect = function (handlers) {
    N.close();
    N.handlers = handlers || {};
    const ws = N.ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'welcome') { N.id = m.id; for (const p of m.peers || []) peer(p.id).team = p.team; }
      else if (m.t === 'join') peer(m.id).team = m.team;
      else if (m.t === 'leave') N.peers.delete(m.id);
      else if (m.t === 's') {
        const p = peer(m.from), now = performance.now() / 1000;
        p.buf.push({ t: now, p: m.p, yaw: m.yaw, ph: m.ph });
        if (p.buf.length > 30) p.buf.shift();
        p.alive = m.alive; p.hp = m.hp;
      }
      const h = N.handlers[m.t];
      if (h) h(m);
    };
    ws.onerror = () => { if (N.handlers.error) N.handlers.error(); };
    ws.onclose = () => { N.id = null; N.peers.clear(); };
  };
  N.close = () => { if (N.ws) { try { N.ws.close(); } catch (e) { /* ignore */ } } N.ws = null; N.id = null; N.peers.clear(); };
  N.send = m => { if (N.connected()) N.ws.send(JSON.stringify(m)); };

  function peer(id) {
    if (!N.peers.has(id)) N.peers.set(id, { id, buf: [], p: [0, -100, 0], yaw: 0, ph: 0, alive: false, hp: 100, flash: 0 });
    return N.peers.get(id);
  }
  // interpolated view of every peer (portal jumps are not interpolated: big steps snap)
  N.peerList = function () {
    const T = performance.now() / 1000 - N.delay, out = [];
    for (const p of N.peers.values()) {
      const b = p.buf;
      if (!b.length) continue;
      let i = b.length - 1;
      while (i > 0 && b[i - 1].t > T) i--;
      const a = b[Math.max(0, i - 1)], c = b[i];
      let f = c.t > a.t ? WM.clamp((T - a.t) / (c.t - a.t), 0, 1) : 1;
      if (Math.hypot(c.p[0] - a.p[0], c.p[1] - a.p[1], c.p[2] - a.p[2]) > 3) f = f < 0.5 ? 0 : 1;
      let dy = c.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      p.p = [0, 1, 2].map(k => a.p[k] + (c.p[k] - a.p[k]) * f);
      p.yaw = a.yaw + dy * f; p.ph = a.ph + (c.ph - a.ph) * f;
      out.push(p);
    }
    return out;
  };
  window.WNet = N;
})();
