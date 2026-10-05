// Usage: node tools/dev/mpsim.js — two game clients in one process, connected through an in-memory copy of the
// server's relay. On every map: the two see each other in the same room (map + mode), PvP hits and deaths work in
// modes without AI, and in modes with AI the leader runs it, the other player follows its snapshots and its hits
// reach the leader. No GPU: probes say "open space".
const loadGame = require('./load');
let clock = 0;
const relay = { clients: [], next: 1, queue: [] };
function makeWS(ctx) {
  return class FakeWS {
    constructor() {
      this.readyState = 1; this.ctx = ctx;
      const teams = relay.clients.map(c => c.team);
      this.id = relay.next++; this.team = teams.filter(t => t === 'A').length <= teams.filter(t => t === 'B').length ? 'A' : 'B';
      const peers = relay.clients.map(c => ({ id: c.id, team: c.team }));
      relay.clients.push(this);
      relay.queue.push([this, { t: 'welcome', id: this.id, team: this.team, peers }]);
      for (const c of relay.clients) if (c !== this) relay.queue.push([c, { t: 'join', id: this.id, team: this.team }]);
    }
    send(data) { const m = JSON.parse(data); m.from = this.id; for (const c of relay.clients) if (c !== this) relay.queue.push([c, m]); }
    close() { this.readyState = 3; }
  };
}
function flush() {
  while (relay.queue.length) { const [c, m] = relay.queue.shift(); if (c.onmessage) c.onmessage({ data: JSON.stringify(m) }); }
}
function client() {
  const ctx = loadGame({ before: c => { c.location = { protocol: 'http:', host: 'sim' }; c.WebSocket = makeWS(c); } });
  ctx.performance.now = () => clock * 1000;
  ctx.WE.probe = pts => pts.map(() => 5);
  ctx.WMP.start();
  return ctx;
}
const A = client(), B = client();
flush();
const step = (n = 1, dt = 1 / 60, after) => {
  for (let i = 0; i < n; i++) {
    clock += dt;
    for (const c of [A, B]) {
      c.WE.time += dt;
      c.WMP.update(dt);
      c.WE.world.update(dt, { dx: 0, dy: 0 });
      if (c.WE.world.bullets) c.WE.world.bullets.update(dt);
    }
    flush();
    if (after) after();
  }
};
const enter = (c, wi, mode) => {
  const w = c.WE.worlds[wi];
  c.WE.world = w; c.WE.worldIndex = wi; c.WE.keys = {};
  w._modeIdx = mode;
  w.enter(w.modes ? w.modes[mode].opts : {});
  if (w.player && 'noclip' in w.player) w.player.noclip = true;
  c.WGun.refill();
};
let fail = 0;
const check = (ok, msg) => { if (!ok) fail++; console.log(`  ${ok ? 'OK ' : 'ŹLE'} ${msg}`); };

console.log(`połączeni: A = gracz ${A.WNet.id}, B = gracz ${B.WNet.id}`);
A.WE.worlds.forEach((wA, wi) => {
  if (!wA.mp) { console.log(`${wA.name}: mapa bez gry sieciowej — pominięta`); return; }
  const modes = wA.modes ? wA.modes.map((m, k) => k) : [0];
  for (const mode of modes) {
    enter(A, wi, mode); enter(B, wi, mode);
    step(30);
    const wB = B.WE.worlds[wi], label = `${wA.name} / ${wA.modes ? wA.modes[mode].label : '—'}`;
    console.log(label);
    const avA = A.WMP.avatars(wA), avB = B.WMP.avatars(wB);
    check(avA.length === 1 && avB.length === 1, `widzą się nawzajem (A widzi ${avA.length}, B widzi ${avB.length})`);
    const ai = A.WMP.ai(wA);
    if (!ai) {
      // PvP: A shoots B: put a bullet inside B's body as A sees it
      const sp = wA.mp.space, g = avA[0].g;
      const hp0 = wB.health;
      const hit = A.WMP.hitPeers(sp.point(g, [0, 1.2, 0, 0]));
      flush();
      check(A.WMP.pvp(wA) && hit && wB.health < hp0, `PvP: trafienie A→B (zdrowie B ${hp0} → ${wB.health})`);
      for (let k = 0; k < 6 && wB.health > 0; k++) { A.WMP.hitPeers(sp.point(A.WMP.avatars(wA)[0].g, [0, 1.2, 0, 0])); flush(); }
      step(5);
      check((A.WMP.kills[A.WNet.id] || 0) >= 1, `PvP: zabójstwo policzone u A (${A.WMP.kills[A.WNet.id] || 0})`);
      step(60 * 4);
      check(wB.health === 100 && !B.WMP.dead(), `PvP: B odrodził się (zdrowie ${wB.health})`);
    } else {
      step(60);
      const aiB = B.WMP.ai(wB), lead = A.WNet.id < B.WNet.id ? 'A' : 'B';
      const L = lead === 'A' ? A : B, F = lead === 'A' ? B : A, wL = L.WE.worlds[wi], wF = F.WE.worlds[wi];
      const aiL = L.WMP.ai(wL), aiF = F.WMP.ai(wF);
      const count = x => (x.list ? x.list.filter(m => m.dead < 0).length : (wi === 6 ? (L === A ? wA : wB).rival.dead < 0 ? 1 : 0 : 0));
      if (aiL.list) {
        check(L.WMP.isLeader(wL) && !F.WMP.isLeader(wF), `lider: gracz ${L.WNet.id}`);
        check(aiF.list.length === aiL.list.length && aiL.list.length > 0, `obserwator widzi potwory lidera (${aiF.list.length} / ${aiL.list.length})`);
        // the follower hits a monster: the leader applies the damage
        const mF = aiF.list.find(m => m.dead < 0), mL = aiL.list.find(m => m.slot === mF.slot);
        const hp0 = mL.hp;
        const q = aiF.sp ? aiF.sp.point(mF.g, [0, 1.2, 0, 0]) : [mF.p[0], 1.2, mF.p[2]];
        const hit = aiF.hitTest(q);
        flush();
        check(hit && mL.hp < hp0, `trafienie obserwatora dociera do lidera (hp ${hp0} → ${mL.hp})`);
      } else {
        // the arena bot
        const rL = wL.rival, rF = wF.rival;
        check(rF.dead < 0 && Math.hypot(rF.p[0] - rL.p[0], rF.p[2] - rL.p[2]) < 3, `obserwator widzi bota lidera (odległość ${Math.hypot(rF.p[0] - rL.p[0], rF.p[2] - rL.p[2]).toFixed(2)} m)`);
        const hp0 = rL.hp;
        const hit = wF.myBulletHit([rF.p[0], rF.p[1] + 1.2, rF.p[2]]);
        flush();
        check(hit && rL.hp < hp0, `trafienie bota przez obserwatora (hp ${hp0} → ${rL.hp})`);
      }
      // the AI hurts the follower too: let the leader's AI shoot for a while (the follower stands still)
      // (the leader plays dead meanwhile, so the AI has only the follower to shoot at)
      const hF0 = wF.health;
      let hurt = false;
      L.WMP.deadT = 1e9;
      step(60 * (aiL.list ? 25 : 70), 1 / 60, () => { if (wF.health < hF0 || F.WMP.dead() || wF.playerAlive === false) hurt = true; });
      L.WMP.deadT = 0;
      check(hurt, `SI lidera rani obserwatora`);
    }
  }
});
console.log(fail ? `BŁĘDÓW: ${fail}` : 'wszystko OK');
process.exit(fail ? 1 : 0);
