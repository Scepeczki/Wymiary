// Usage: node tools/dev/swarm.js — the wave mode (js/enemies.js) on every map that has it, headless:
// monsters must stay on their manifold, come closer, shoot and hurt you, die after 3 hits, and the next wave must come.
const ctx = require('./load')();
const WE = ctx.WE, WM = ctx.WM;
WE.probe = pts => pts.map(() => 5);   // open space (no obstacles)
let fail = 0;
for (const w of WE.worlds.filter(w => w.swarm)) {
  WE.world = w; WE.keys = {};
  w.enter({ fight: true });
  w.player.noclip = true;   // no floor in this test: do not fall
  const sw = w.swarm, sp = sw.sp, m0 = sp.m;
  const eyeDist = m => { const l = sp.rel(m.g, w.playerPoints().eye); return Math.hypot(l[0], l[2], l[3]); };
  const d0 = Math.min(...sw.list.map(eyeDist));
  let hurt = 0, shots = 0, minD = 1e9, bad = '';
  const dmg = w.damage.bind(w);
  w.damage = n => { hurt += n; };
  for (let f = 0; f < 60 * 20; f++) {
    WE.time += 1 / 60;
    sw.list.forEach(m => { m.los = true; });
    w.update(1 / 60, { dx: 0, dy: 0 });
    shots = Math.max(shots, sw.shots.list.length);
    for (const m of sw.list) {
      minD = Math.min(minD, eyeDist(m));
      if (m.g.M) {
        const P = m.g.M[3];
        const k = WM.kdot(w.player.K, P, P);
        if (Math.abs(k - w.player.K) > 1e-6 || Math.abs(P[1]) > 1e-6) bad = `poza rozmaitością: <P,P>=${k.toFixed(6)} y=${P[1].toExponential(1)}`;
      } else if (m.g.p.some(x => !Number.isFinite(x))) bad = 'NaN';
    }
  }
  w.damage = dmg;
  // shoot the first monster in the chest three times
  const m = sw.list[0], chest = sp.point(m.g, [0, 1.2, 0, 0]);
  let hits = 0;
  for (let i = 0; i < 3; i++) if (sw.hitTest(chest)) hits++;
  const miss = sw.hitTest(sp.point(m.g, [1.5, 1.2, 0, 0]));
  const wave = sw.wave;
  for (const x of sw.list) while (x.dead < 0) sw.hitTest(sp.point(x.g, [0, 1.2, 0, 0]));
  for (let f = 0; f < 60 * 5; f++) { WE.time += 1 / 60; w.update(1 / 60, { dx: 0, dy: 0 }); }
  const ok = !bad && minD < 9.5 && hurt > 0 && hits === 3 && m.dead >= 0 && !miss && sw.wave === wave + 1;
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'ŹLE'} ${w.name}: start ${d0.toFixed(1)} m → najbliżej ${minD.toFixed(1)} m · obrażenia ${hurt} · max pocisków ${shots} · trafienia ${hits}/3 (zabity: ${m.dead >= 0}, pudło obok: ${miss}) · fala ${wave} → ${sw.wave}${bad ? ' · ' + bad : ''}`);
}
process.exit(fail ? 1 : 0);
