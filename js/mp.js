// Multiplayer on every map and in every mode. When the game is opened from a game server (host.cmd / server.js),
// every player is connected all the time. Players see each other when they are in the same ROOM = the same map in
// the same mode; the menu shows where the others are and lets you join them.
//  * Every client simulates its own player and sends its state 20× per second (WNet 's'): the room, its geometry
//    (the map's space adapter encodes it as numbers: feet + yaw in 3D, a whole frame in 4D and in curved space).
//  * Shots ('f') are sent as aim (position + direction); the others fly a visual copy of the bullet.
//  * Modes without monsters / bot = PvP: the shooter decides hits on the others ('h'), the victim applies the damage,
//    reports its death ('d'), and respawns after 3 s. Kills are counted per player.
//  * Modes with monsters / a bot = co-op: the LEADER of the room (lowest id) runs the AI and sends snapshots ('ai');
//    the others draw them interpolated, send their hits on the AI ('ah') and receive the AI's shots ('af') as visuals.
//    The AI targets the nearest living player; the leader decides when an AI projectile hits somebody ('h' with ai).
// A world plugs in with world.mp = { space, respawn() } (+ optional toAbs / toLocal 4-vector maps when its coordinates
// are re-centred, like H³), world.playerPoints() and world.ai() (-> object with netExport / netImport / netDamage / shots).
(function () {
  const MP = { kills: {}, deadT: 0, room: null };
  let sendT = 0, aiT = 0, retryT = 0, started = false;

  const online = () => WNet.connected();
  const roomOf = w => (w && WE.worldIndex >= 0 ? `${WE.worlds.indexOf(w)}:${w._modeIdx || 0}` : null);
  const mpOf = w => (w && w.mp) || null;
  // geometry arrays are 4-vectors in a row (curved space) — apply a 4-vector map to each
  const xfArr = (f, a) => (f ? a.map((_, i) => (i % 4 ? null : f(a.slice(i, i + 4)))).filter(Boolean).flat() : a);
  const toAbs = (w, a) => xfArr(w.mp && w.mp.toAbs, a);
  const toLocal = (w, a) => xfArr(w.mp && w.mp.toLocal, a);
  const vAbs = (w, v) => (w.mp && w.mp.toAbs ? w.mp.toAbs(v) : v);
  const vLocal = (w, v) => (w.mp && w.mp.toLocal ? w.mp.toLocal(v) : v);

  MP.online = online;
  MP.myId = () => WNet.id;
  MP.roomPeers = w => (online() && mpOf(w) ? WNet.peerList(roomOf(w), (a, b, f) => w.mp.space.lerpArr(a, b, f)) : []);
  MP.isLeader = w => !online() || MP.roomPeers(w).every(p => p.id > WNet.id);
  MP.ai = w => (w && w.ai ? w.ai() : null);
  MP.pvp = w => !!(w && MP.roomPeers(w).length && !MP.ai(w));
  MP.dead = () => MP.deadT > 0;

  // the other players in your room, ready to draw: geometry in local coordinates
  MP.avatars = function (w) {
    const out = [], now = performance.now() / 1000, sp = mpOf(w) && w.mp.space;
    if (!sp) return out;
    for (const p of MP.roomPeers(w)) {
      const dead = p.alive ? -1 : now - (p.diedAt || now);
      if (dead > 2.9) continue;
      out.push({ id: p.id, g: sp.decode(toLocal(w, p.g)), hp: p.hp == null ? 100 : p.hp, flash: p.flash || 0, dead, alive: p.alive, team: p.team,
        type: MP.pvp(w) ? 3 : 2 });
    }
    return out;
  };
  // everybody the AI may shoot at: { id (null = you), me, eye, body: [points] }
  MP.targets = function (w) {
    const out = [];
    if (!MP.dead() && w.playerAlive !== false) { const pp = w.playerPoints(); out.push({ id: null, me: true, eye: pp.eye, body: pp.body }); }
    const sp = mpOf(w) && w.mp.space;
    if (sp) for (const a of MP.avatars(w)) {
      if (!a.alive) continue;
      const pt = h => sp.point(a.g, [0, h, 0, 0]);
      out.push({ id: a.id, me: false, eye: pt(1.6), body: [pt(1.6), pt(0.8), pt(0.3)] });
    }
    return out;
  };
  // the AI (on the leader) hit somebody
  MP.hurt = function (w, t, dmg) {
    if (t.me) w.damage(dmg, 'ai');
    else WNet.send({ t: 'h', room: roomOf(w), to: t.id, dmg, ai: 1 });
  };
  MP.aiShot = (w, aim) => { if (MP.roomPeers(w).length) WNet.send({ t: 'af', room: roomOf(w), pos: vAbs(w, aim.pos), dir: vAbs(w, aim.dir) }); };
  MP.aiHit = (w, slot, dmg) => WNet.send({ t: 'ah', room: roomOf(w), slot, dmg });

  // your bullet at q: did it hit another player? (PvP only)
  MP.hitPeers = function (q) {
    const w = WE.world;
    if (!MP.pvp(w)) return false;
    for (const a of MP.avatars(w)) {
      if (!a.alive || !WSwarm.inBody(w.mp.space, a.g, q)) continue;
      const p = WNet.peers.get(a.id);
      if (p) p.flash = 1;
      WNet.send({ t: 'h', room: roomOf(w), to: a.id, dmg: 25 });
      return true;
    }
    return false;
  };
  // you fired
  MP.shot = (w, aim) => { if (MP.roomPeers(w).length) WNet.send({ t: 'f', room: roomOf(w), pos: vAbs(w, aim.pos), dir: vAbs(w, aim.dir) }); };
  // the other players' bullets (visual), drawn with the map's own bullets: [[list, isEnemy]]
  MP.extraBullets = w => (w && w.mpShots ? [[w.mpShots, MP.pvp(w)]] : []);

  // your death. reportDeath only tells the others (worlds with their own respawn: the arena); died also respawns you
  // after 3 s and returns true — when you are not alone in the room (alone, the map decides what a death means)
  MP.reportDeath = function (w, from) {
    if (!MP.roomPeers(w).length) return false;
    WNet.send({ t: 'd', room: roomOf(w), by: from == null ? 'ai' : from });
    if (typeof from === 'number') MP.kills[from] = (MP.kills[from] || 0) + 1;
    return true;
  };
  MP.died = function (w, from) {
    if (!MP.reportDeath(w, from)) return false;
    MP.deadT = 3;
    WE.toast(typeof from === 'number' ? `Zabił cię gracz ${from}! Odrodzenie za 3 s` : 'Zginąłeś! Odrodzenie za 3 s', 2800);
    return true;
  };

  // ---- HUD ----
  MP.hud = function (w) {
    const peers = MP.roomPeers(w), me = MP.kills[WNet.id] || 0;
    const rows = peers.map(p => `gracz ${p.id}: ${MP.kills[p.id] || 0}${p.alive ? '' : ' (nie żyje)'}`).join(' · ');
    const one = peers.length === 1 ? peers[0] : null;
    return `<div class="score">TY ${me} : ${one ? (MP.kills[one.id] || 0) : '–'} ${one ? 'GRACZ ' + one.id : ''}</div>` +
      (one ? `<div class="bar"><div style="width:${one.alive ? one.hp : 0}%"></div></div>` : '') +
      `<div style="font-size:12px;opacity:.8">gra sieciowa · ${rows}</div>`;
  };
  MP.coopLine = function (w) {
    const peers = MP.roomPeers(w);
    if (!peers.length) return '';
    return `<div style="font-size:12px;opacity:.8;margin-top:3px">razem z: ${peers.map(p => `gracz ${p.id} ${p.alive ? Math.ceil(p.hp == null ? 100 : p.hp) + ' HP' : '(odradza się)'}`).join(' · ')}${MP.isLeader(w) ? '' : ' · potwory prowadzi gracz ' + Math.min(...peers.map(p => p.id))}</div>`;
  };
  // where everybody is (for the menu): [{ id, map, mode, alive }]
  MP.presence = function () {
    if (!online()) return [];
    return [...WNet.peers.values()].filter(p => p.room).map(p => { const [map, mode] = p.room.split(':').map(Number); return { id: p.id, map, mode, alive: p.alive }; });
  };
  MP.status = () => (online() ? `sieć: jesteś graczem ${WNet.id} · połączonych: ${WNet.peers.size + 1}` : started ? 'sieć: łączenie z serwerem…' : '');

  // ---- per frame ----
  MP.update = function (dt) {
    const w = WE.world;
    if (started && !WNet.ws && (retryT -= dt) <= 0) { retryT = 3; connect(); }
    if (!w) return;
    const room = roomOf(w);
    if (room !== MP.room) { MP.room = room; MP.kills = {}; MP.deadT = 0; if (w.mpShots) w.mpShots.clear(); }
    for (const p of WNet.peers.values()) p.flash = Math.max(0, (p.flash || 0) - dt * 4);
    // PvP needs health even on maps that have none when you are alone
    const pvp = MP.pvp(w);
    if (pvp && w.health == null) { w.health = 100; w._mpHealth = true; }
    if (!pvp && w._mpHealth) { w._mpHealth = false; if (!MP.ai(w)) w.health = null; }
    if (MP.deadT > 0) {
      WE.keys = {}; WE.fireHeld = false;
      if ((MP.deadT -= dt) <= 0) {
        MP.deadT = 0;
        if (w.mp && w.mp.respawn) w.mp.respawn();
        if (w.health != null) w.health = 100;
        WGun.refill();
      }
    }
    if (!online() || !w.mp) return;
    if (w.mpShots) w.mpShots.update(dt);
    if ((sendT -= dt) <= 0) {
      sendT = 0.05;
      WNet.send({ t: 's', room, g: toAbs(w, w.mp.space.encode(w.mp.me())), alive: !MP.dead() && w.playerAlive !== false, hp: w.health == null ? 100 : Math.max(0, w.health) });
    }
    const ai = MP.ai(w);
    if (ai && MP.isLeader(w) && MP.roomPeers(w).length && (aiT -= dt) <= 0) {
      aiT = 0.08;
      WNet.send({ t: 'ai', room, d: ai.netExport(a => toAbs(w, a)) });
    }
  };

  // ---- messages ----
  function inRoom(m) { const w = WE.world; return w && w.mp && m.room === roomOf(w) ? w : null; }
  const handlers = {
    welcome: m => { WE.toast(`Połączono z serwerem gry — jesteś graczem ${m.id}`, 3000); },
    join: m => WE.toast(`Dołączył gracz ${m.id}`, 2500),
    leave: m => WE.toast(`Gracz ${m.id} wyszedł`, 2500),
    f: m => {
      const w = inRoom(m);
      if (!w || !w.bullets) return;
      if (!w.mpShots) w.mpShots = new WBullets(w.bullets.model, {});
      const pos = vLocal(w, m.pos);
      w.mpShots.fire({ pos, dir: vLocal(w, m.dir) });
      WAudio.at(w, pos, 'shot');
    },
    h: m => {
      const w = inRoom(m);
      if (!w || m.to !== WNet.id || MP.dead()) return;
      if (m.ai) w.damage(m.dmg, 'ai');
      else if (MP.pvp(w)) w.damage(m.dmg, m.from);
    },
    d: m => {
      if (!inRoom(m)) return;
      if (typeof m.by === 'number') {
        MP.kills[m.by] = (MP.kills[m.by] || 0) + 1;
        if (m.by === WNet.id) WE.toast(`Trafiony i zabity — gracz ${m.from}!`, 1800);
      }
      const w = WE.world;
      if (w.onPeerDeath) w.onPeerDeath(m);
    },
    ai: m => {
      const w = inRoom(m), ai = MP.ai(w);
      if (ai && !MP.isLeader(w)) ai.netImport(m.d, a => toLocal(w, a));
    },
    af: m => {
      const w = inRoom(m), ai = MP.ai(w);
      if (!ai || MP.isLeader(w)) return;
      const pos = vLocal(w, m.pos);
      ai.shots.fire({ pos, dir: vLocal(w, m.dir) });
      WAudio.at(w, pos, 'enemy');
    },
    ah: m => {
      const w = inRoom(m), ai = MP.ai(w);
      if (ai && MP.isLeader(w)) ai.netDamage(m.slot, m.dmg, m.from);
    },
    error: () => {},
    close: () => { WE.toast('Rozłączono z serwerem gry — łączę ponownie…', 3000); },
  };
  function connect() { WNet.connect(handlers); }
  // connect when the game was opened from a game server
  MP.start = function () {
    if (!/^https?:/.test(location.protocol) || typeof WebSocket === 'undefined') return;
    started = true; connect();
  };
  window.WMP = MP;
})();
