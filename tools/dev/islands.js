// Usage: node tools/dev/islands.js — can the Wyspy 4D course be done? For every pair of consecutive platforms the
// player starts on the first one and either runs + jumps towards the next (same w) or steps along W (T) onto it.
// Collisions use a CPU copy of the platforms' distance field (the same 4D boxes as the shader).
const ctx = require('./load')();
ctx.setTimeout = () => {};   // the map restarts itself 3 s after the finish: not in this test
const { WE, WM, WPlayer } = ctx;
const w = WE.worlds.find(x => x.name === 'Wyspy 4D'), { P, standing, COURSE } = w._test;
const box = (q, c, h) => { const d = [0, 1, 2, 3].map(k => Math.abs(q[k] - c[k]) - h[k]); return Math.hypot(...d.map(x => Math.max(x, 0))) + Math.min(Math.max(...d), 0); };
WE.probe = pts => pts.map(q => Math.min(...P.map(p => box(q, [p.c[0], p.c[1] - 0.4, p.c[2], p.c[3]], [p.h[0], 0.4, p.h[1], p.h[2]]) - 0.02)));
WE.world = w; w.enter({});
let fail = 0;
for (let i = 1; i < COURSE; i++) {
  const a = P[i - 1], b = P[i], pl = w.player;
  const wOverlap = Math.abs(b.c[3] - a.c[3]) < a.h[2] + b.h[2];
  let ok = false, how;
  if (!wOverlap) {
    // step through W: stand where both overlap on the floor, at a's w, walk along ana towards b
    how = 'krok w W';
    const x = WM.clamp(b.c[0], a.c[0] - a.h[0] + 0.4, a.c[0] + a.h[0] - 0.4), z = WM.clamp(b.c[2], a.c[2] - a.h[1] + 0.4, a.c[2] + a.h[1] - 0.4);
    pl.reset([x, a.c[1] + WPlayer.EYE, z, a.c[3]]);
    const key = b.c[3] > a.c[3] ? 'KeyT' : 'KeyG';
    for (let f = 0; f < 180 && !ok; f++) { WE.keys = { [key]: true }; w.update(1 / 60, { dx: 0, dy: 0 }); if (standing(pl.pos) === i) ok = true; }
  } else {
    // run and jump: start 1 m inside a's edge facing b
    how = 'skok';
    const d = WM.norm([b.c[0] - a.c[0], b.c[2] - a.c[2]]), yaw = Math.atan2(d[0], d[1]);
    const s = Math.min(a.h[0] / Math.max(Math.abs(d[0]), 1e-6), a.h[1] / Math.max(Math.abs(d[1]), 1e-6)) - 1.2;
    const wMid = WM.clamp(b.c[3], a.c[3] - a.h[2] + 0.1, a.c[3] + a.h[2] - 0.1);
    pl.reset([a.c[0] + d[0] * s, a.c[1] + WPlayer.EYE, a.c[2] + d[1] * s, wMid], yaw);
    for (let f = 0; f < 240 && !ok; f++) {
      const p = pl.pos, edge = Math.abs(p[0] - a.c[0]) > a.h[0] - 0.35 || Math.abs(p[2] - a.c[2]) > a.h[1] - 0.35;
      WE.keys = { KeyW: true, ShiftLeft: true, Space: edge };
      w.update(1 / 60, { dx: 0, dy: 0 });
      if (standing(pl.pos) === i) ok = true;
      if (pl.pos[1] < -5) break;
    }
  }
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'ŹLE'} ${i}: ${how}`);
}
console.log(fail ? `nieprzejezdne odcinki: ${fail}` : 'cała trasa przejezdna');
process.exit(fail ? 1 : 0);
