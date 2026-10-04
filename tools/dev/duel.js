// Usage: node tools/dev/duel.js — checks the loop arena: navigation graph, portals, rival routes and a simulated duel
const ctx = require('./load')();
const WE = ctx.WE, WM = ctx.WM;
const w = WE.worlds.find(x => x.name === 'Arena pętli');
const T = w._test;
WE.world = w;
WE.probe = pts => pts.map(p => T.sdf(p));
w.prog = w.probeProg = { u: n => n };
let t = Date.now();
T.buildNav();
console.log(`nav: ${T.NODES.length} nodes, ${T.ADJ.reduce((s, a) => s + a.length, 0)} directed edges (${Date.now() - t} ms)`);
const D = T.dijkstra(T.nearestNode([0, 0, -71]));
const unreached = T.NODES.filter((n, i) => !isFinite(D.dist[i]));
console.log(`unreachable from base A: ${unreached.length}`, unreached.map(n => n.map(v => v.toFixed(1)).join(',')).join(' | '));
console.log('portal edges:', T.ADJ.flat().filter(e => e.shift).length);
for (const [name, p] of [["base B", [0, 0, 75]], ["penrose top", [-10, 2.25, -43.5]], ["big hall", [60, 0, -53]], ["pit bridge", [11, 0, -50]], ["side passage", [-28, 0, 20]], ["square", [14, 0, 0]]]) {
  const i = T.nearestNode(p);
  console.log(`  ${name}: node ${T.NODES[i].map(v => v.toFixed(1)).join(",")} path ${D.dist[i].toFixed(1)} m`);
}
// rival routes (vision off): every lane, and through each glue
const r = (w.enter({ mode: 1 }), w.rival);
function route(from, to, label, secs = 40) {
  r.reset(from); w.player.pos = to.slice(); w.playerAlive = false;
  let jumps = 0, prev = r.p.slice(), arrived = -1;
  for (let f = 0; f < 60 * secs && arrived < 0; f++) {
    WE.time += 1 / 60; r.update(1 / 60);
    if (WM.len(WM.sub(r.p, prev)) > 3) jumps++;
    prev = r.p.slice();
    if (Math.hypot(r.p[0] - to[0], r.p[2] - to[2]) < 1.5 && Math.abs(r.p[1] - (to[1] - 1.6)) < 1) arrived = f / 60;
  }
  console.log(`  ${label.padEnd(30)} portal jumps ${jumps}, ${arrived >= 0 ? 'arrived in ' + arrived.toFixed(1) + ' s' : 'NOT ARRIVED, at ' + r.p.map(v => v.toFixed(1))}`);
}
console.log("rival routes:");
route([0, 0, 75], [-8, 1.6, -71], "base B -> base A", 90);
route([-10, 0, -63.5], [-10, 1.6, -38.5], "Penrose stairs up");
route([-10, 0, -38.5], [-10, 1.6, -63.5], "Penrose stairs down");
route([0, 0, -63.5], [0, 1.6, -45], "through the booth");
route([0, 0, -45], [0, 1.6, -63.5], "booth backwards");
route([11, 0, -64], [11, 1.6, -38.5], "pit room");
route([13, 0, -71], [-13, 1.6, -71], "base torus");
route([20, 0, -38.5], [-20, 1.6, -38.5], "junction torus");
route([-15, 0, 0], [-25, 1.6, 0], "side passage via glue");
route([5, 0, 12.5], [5, 1.6, -12.5], "hall along the ledge");
route([26, 0, 0], [14, 1.6, 0], "square via glue");

// a duel: the player stands in base A and shoots back when he sees the rival
w.enter({ mode: 2 });
const states = {};
let shots = 0;
const fire = w.rivalShots.fire.bind(w.rivalShots);
w.rivalShots.fire = a => { shots++; fire(a); };
for (let f = 0; f < 60 * 90; f++) {
  WE.time += 1 / 60;
  w.update(1 / 60, { dx: 0, dy: 0 });
  const rv = w.rival;
  if (f % 30 === 0 && w.playerAlive && rv.dead < 0 && T.los(w.player.pos, [rv.p[0], rv.p[1] + 1.2, rv.p[2]]))
    w.bullets.fire({ pos: w.player.pos, dir: WM.norm(WM.sub([rv.p[0], rv.p[1] + 1.1, rv.p[2]], w.player.pos)) });
  w.bullets.update(1 / 60);
  states[rv.state] = (states[rv.state] || 0) + 1;
  if (rv.p.some(v => !Number.isFinite(v))) throw new Error('NaN rival');
}
console.log(`90 s duel (hard): rival shots ${shots}, score you ${w.score[0]} : ${w.score[1]} rival`);
console.log('rival time by state (s):', Object.fromEntries(Object.entries(states).map(([k, v]) => [k, (v / 60).toFixed(1)])));
