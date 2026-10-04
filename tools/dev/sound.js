// Usage: node tools/dev/sound.js — prints how each world propagates a gunshot (own shot + a hit ~10 m ahead)
const ctx = require('./load')();
const WE = ctx.WE, WM = ctx.WM, WA = ctx.WAudio;
const fmt = arr => arr.sort((a, b) => a.delay - b.delay).slice(0, 8)
  .map(a => `${(a.delay * 1000).toFixed(0)}ms g=${a.gain.toFixed(3)} pan=${(a.pan || 0).toFixed(2)}${a.tail4d != null ? ' +ogon4D' : ''}`).join(' | ');
function report(w, label) {
  let t = Date.now();
  const own = w.soundArrivals(null);
  const t1 = Date.now() - t;
  // a point ~10 m (or the world's equivalent) straight ahead of the player
  let src;
  if (w.player.M) {
    const C = w.player.camera(), d = 10 / (w.name.includes('hiper') ? 9.4 : 13.3);
    src = WM.addScaled(WM.scale(C[3], WM.kcos(w.player.K, d)), C[2], WM.ksin(w.player.K, d));
  } else { const c = w.player.camera(); src = WM.addScaled(c.pos, c.fwd, 10); }
  t = Date.now();
  const hit = w.soundArrivals(src);
  const t2 = Date.now() - t;
  console.log(`\n== ${label} (${t1}+${t2} ms)\n  strzał:  ${own.length} dojść: ${fmt(own)}\n  trafienie 10 m: ${hit.length} dojść: ${fmt(hit)}`);
}
WE.worlds.forEach((w, i) => {
  WE.world = w; w.enter({});
  report(w, w.name);
  if (w._test) {
    const S = w._test.S;
    for (const [g, z, lab] of [[0, 0, 'płasko'], [1, 0, 'K całej mapy = +0.05'], [-1, 0, 'K całej mapy = -0.006']]) {
      S.g = g; S.z = z; report(w, w.name + ' — ' + lab);
    }
    S.g = 0; S.z = 1;
  }
});
