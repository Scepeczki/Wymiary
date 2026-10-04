// Usage: node tools/dev/smoke.js — runs every world's logic headless (stubbed GL/probes), fires bullets, checks for NaNs
const ctx = require('./load')();
const WE = ctx.WE, WM = ctx.WM;
// fake distance field: floor at y=0 for flat worlds, nothing near in curved worlds
WE.probe = pts => pts.map(p => (WE.world.player && WE.world.player.K ? 10 : p[1]));
const bad = v => !Number.isFinite(v);
const gl = new Proxy({}, { get: () => (...a) => { for (const x of a) { if (typeof x === 'number' && bad(x)) throw new Error('NaN uniform'); if (x && typeof x === 'object' && x.length) for (const y of x) if (bad(y)) throw new Error('NaN uniform'); } } });
const prog = { u: n => n };
WE.worlds.forEach((w, i) => {
  WE.world = w; WE.worldIndex = i; w.prog = prog; w.probeProg = prog;
  w.enter({});
  if (w.bullets) w.bullets.clear();
  WE.keys = { KeyW: true, KeyD: true, KeyQ: true, KeyR: true, ShiftLeft: true };
  let fired = 0;
  for (let f = 0; f < 600; f++) {
    if (f === 300) WE.keys = { KeyS: true, KeyE: true, KeyC: true, Space: true, KeyX: true };
    w.update(1 / 60, { dx: 0.01, dy: 0.002 });
    if (w.bullets && f % 20 === 0) { w.bullets.fire(w.aim()); fired++; }
    if (w.bullets) { w.bullets.update(1 / 60); w.bullets.setUniforms(gl, prog); }
    w.setUniforms(gl, prog);
  }
  const p = w.player, pos = p.pos || p.M[3];
  if (pos.some(bad)) throw new Error(w.name + ' NaN pos');
  let extra = '';
  if (p.M) extra = ' <p,p>=' + WM.kdot(p.K, p.M[3], p.M[3]).toFixed(6);
  if (w.bullets) extra += ` bullets fired ${fired}, alive ${w.bullets.list.length}`;
  console.log(`OK ${w.name}:${extra} | ${w.stats().replace(/\n/g, ' | ')}`);
});
const b = WE.worlds.find(w => w._test);
// own curvature of the rooms: at the centre of every room the measured K equals its table value
const statics = b ? [b._test.ROOM_K, b._test.COR_X, b._test.COR_Z] : [];
const saved = statics.map(a => a.slice());
const flatten = on => statics.forEach((a, k) => a.forEach((_, i) => { a[i] = on ? 0 : saved[k][i]; }));
if (b) {
  b.enter({ zombies: false });
  let bad = 0;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const want = b._test.ROOM_K[i + 2 + 5 * (j + 2)], got = b._test.localK([16 * i + 0.3, 2, 16 * j + 0.2]);
    if (Math.abs(got - want) > 2e-3 + Math.abs(want) * 0.05) { bad++; console.log(`room ${i},${j}: K ${want} measured ${got.toFixed(4)}`); }
  }
  console.log(`rooms: own K measured at 25 room centres ${bad ? 'CHECK (' + bad + ')' : 'OK'}`);
  const cor = b._test.COR_X[2 + 4 * 2], got = b._test.localK([8, 1.5, 0.1]);
  console.log(`corridor (0,0)-(1,0): K ${cor} measured ${got.toFixed(4)} ${Math.abs(got - cor) < 0.01 + Math.abs(cor) * 0.05 ? 'OK' : 'CHECK'}`);
}
// global curvature: with only the global term, K must be constant over the whole map
if (b) {
  const S = b._test.S;
  b.enter({ zombies: false });
  flatten(true);
  for (const g of [-1, -0.5, 0.5, 1]) {
    S.g = g;
    const want = b._test.globalK();
    const got = [[0, 2, 0], [10, 1, 5], [-14, 3, 12], [14, 1, -14]].map(p => b._test.localK(p));
    console.log(`global s=${g} K=${want.toFixed(4)} measured ${got.map(k => k.toFixed(4)).join(' ')} ${got.every(k => Math.abs(k - want) < 2e-4 + Math.abs(want) * 0.02) ? 'OK' : 'CHECK'}`);
  }
  S.g = 0;
}
// monsters: simulate a fight against the real (CPU) building geometry
if (b) {
  WE.world = b;
  WE.probe = pts => pts.map(p => b._test.sdf(p));
  WE.keys = {};
  b.enter({ zombies: true });
  const h = b._test.horde;
  // curvature at the centre of each bubble must equal the bubble's K (rooms flat for this check)
  b.update(0.001, { dx: 0, dy: 0 });
  for (const m of h.list.slice(0, 2)) {
    const k = b._test.localK([m.p[0], 1.0, m.p[2]]);
    console.log(`monster type ${m.type} bubble K measured ${k.toFixed(3)} (expected ${m.type ? -0.6 : 0.9})`);
  }
  flatten(false);
  let shots = 0, minHealth = 100;
  const start = h.list.map(m => m.p.slice());
  for (let f = 0; f < 60 * 25; f++) {
    b.update(1 / 60, { dx: 0, dy: 0 });
    minHealth = Math.min(minHealth, b.health);
    shots = Math.max(shots, h.shots.list.length);
  }
  const moved = h.list.map((m, i) => WM.len(WM.sub(m.p, start[i])).toFixed(1));
  const inWalls = h.list.filter(m => b._test.sdf([m.p[0], 1, m.p[2]]) < 0.2).length;
  console.log(`25 s of monsters: moved ${moved.join(' ')} m · in walls: ${inWalls} · max projectiles ${shots} · player health min ${minHealth}`);
  // shoot the nearest monster until it dies (straight bullets at close range)
  const m = h.list.find(x => x.dead < 0);
  if (m) {
    m.p = [3, 0, -1]; h.list.forEach(x => { if (x !== m) x.p = [16, 0, 16]; });
    b.player.pos = [-3, 1.6, -1];
    b.update(0.001, { dx: 0, dy: 0 });
    let hits = 0;
    for (let k = 0; k < 6 && m.dead < 0; k++) {
      const eye = b.player.pos, dir = WM.norm(WM.sub([m.p[0], 1.2, m.p[2]], eye));
      b.bullets.fire({ pos: eye, dir });
      for (let f = 0; f < 30; f++) b.bullets.update(1 / 60);
      hits++;
    }
    console.log(`killing a monster: ${m.dead >= 0 ? 'dead' : 'still alive'} after ${hits} shots · killed total ${h.killed}`);
  }
}
