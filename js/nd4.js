// Shared controls of the 4D maps (Tesserakt, Labirynt 4D, Wyspy 4D).
// Inside the engine the axes are (x, y, z, w) with y up. On screen and in the HUD they are named like on a map:
// x and y span the floor, z is the height, w is the 4th axis:  shown x = x, shown y = engine z, shown z = engine y.
//  * Q / E and Z / C rotate the view into W; pressing the same key twice quickly aligns that rotation with the
//    axes again (to 0° or 180°, whichever is nearer) — a short animated turn.
//  * T / G and the mouse wheel step along ana / kata (your hidden 4th direction).
//  * F: four views — 3D slices through different triples of your axes (x right, y forward, z up, w ana).
//  * B: the 4D compass turns with you / stays fixed.   X: back to the plain 3D view (no rotation into W).
(function () {
  const D = {};
  const DOUBLE = 0.33;                       // seconds between two presses that count as a double press
  D.HELP = ['T / G albo kółko myszy — krok w osi W (ana / kata)', 'Q / E — obrót przód↔W · 2× szybko: wyrównaj do 0° / 180°',
    'Z / C — obrót prawo↔W · 2× szybko: wyrównaj', 'X — wyzeruj obrót 4D', 'F — cztery widoki: (x y z) (w y z) (x w z) (x y w)',
    'kompas 4D w rogu · B — widok stały / za tobą', 'osie: x, y — podłoga · z — wysokość · w — czwarta oś'];

  // shown coordinates of an engine position
  D.shown = p => ({ x: p[0], y: p[2], z: p[1], w: p[3] });

  // world: { player (WPlayer 4D), compass }  — call once when the world is created
  D.setup = function (world) {
    world.split = false;
    world.splitView = () => world.split;
    world.snap = null;                       // running alignment turn: { a: frame index, left: angle still to turn }
    world.anaQueue = 0;                      // mouse wheel: distance still to step along ana
    world.settings = (world.settings || []).concat([{ label: 'Cztery widoki (F)', type: 'toggle', get: () => world.split, set: v => { world.split = v; } }]);
    const last = {};
    window.addEventListener('keydown', e => {
      if (e.repeat || WE.world !== world || !WE.locked) return;
      if (e.code === 'KeyB' && world.compass) world.compass.follow = !world.compass.follow;
      if (e.code === 'KeyF') { world.split = !world.split; WE.toast(world.split ? 'Cztery widoki: (x y z) · (w y z) · (x w z) · (x y w)' : 'Jeden widok'); }
      // double press of a rotation key: align that rotation plane with the axes
      const plane = { KeyQ: 1, KeyE: 1, KeyZ: 0, KeyC: 0 }[e.code];
      if (plane != null) {
        const t = performance.now() / 1000;
        if (last[e.code] && t - last[e.code] < DOUBLE) { D.startSnap(world, plane); last[e.code] = 0; }
        else last[e.code] = t;
      }
    });
  };

  // Rotation in the plane (frame[a], ana) that brings frame[a] back into the hyperplane w = 0, the smaller of the
  // two possible turns (so the direction ends at 0° or 180° from where it was before you turned it into W).
  D.snapAngle = function (frame, a) {
    const u = frame[a], v = frame[2];
    if (Math.abs(u[3]) < 1e-6) return 0;
    if (Math.abs(v[3]) < 1e-6) return Math.sign(u[3] * (v[3] || 1)) * Math.PI / 2;
    return Math.atan(u[3] / v[3]);
  };
  D.startSnap = function (world, a) {
    const phi = D.snapAngle(world.player.frame, a);
    world.snap = { a, left: phi };
    const deg = Math.round(Math.abs(phi) * 180 / Math.PI);
    WE.toast(deg < 1 ? 'Już wyrównane do osi' : `Wyrównanie do osi (obrót o ${deg}°)`, 1200);
  };

  // per frame, instead of player.update
  D.update = function (world, dt, look) {
    const p = world.player;
    if (WE.keys.KeyX) {
      // flatten the view back into the floor-and-height hyperplane (no rotation into W)
      let f = [p.forward[0], 0, p.forward[2], 0];
      if (WM.len(f) < 0.1) f = [0, 0, 1, 0];
      f = WM.norm(f);
      p.frame = [[f[2], 0, -f[0], 0], f, [0, 0, 0, 1]];
      world.snap = null;
    }
    if (world.snap) {
      const s = world.snap, step = Math.sign(s.left) * Math.min(Math.abs(s.left), dt * 5);
      WM.rotFrame(p.frame, s.a, 2, -step);
      s.left -= step;
      if (Math.abs(s.left) < 1e-6) {
        world.snap = null;
        p.frame[s.a][3] = 0;                 // exactly aligned
        WM.orthonormalize(p.frame, [s.a, 1 - s.a, 2]);
      }
    }
    // mouse wheel: steps along ana (instead of flying, which the other maps use the wheel for)
    world.anaQueue = WM.clamp(world.anaQueue + WE.takeFly() * 1.0, -6, 6);
    if (Math.abs(world.anaQueue) > 1e-4) {
      const step = Math.sign(world.anaQueue) * Math.min(Math.abs(world.anaQueue), dt * 6);
      p.pos = WM.addScaled(p.pos, p.frame[2], step);
      world.anaQueue -= step;
    }
    p.update(dt, look, {
      rot: [[1, 2, 'KeyQ', 'KeyE'], [0, 2, 'KeyZ', 'KeyC']],
      moves: [[2, 'KeyG', 'KeyT']],
    });
    if (WE.keys.KeyQ || WE.keys.KeyE || WE.keys.KeyZ || WE.keys.KeyC) world.snap = null;
  };

  // F: four views of the same moment, each a 3D slice through a different triple of your axes
  // (shown names: x = your right, y = forward, z = up, w = ana)
  D.drawViews = function (world, gl, prog, cw, ch) {
    if (!world.split) return false;
    const hw = Math.floor(cw / 2), hh = Math.floor(ch / 2), c = world.player.camera(), A = world.player.frame[2];
    //            (x y z) normal         (w y z) right → W      (x w z) forward → W      (x y w) up → W
    const views = [[0, hh, c.right, c.up, c.fwd], [hw, hh, A, c.up, c.fwd], [0, 0, c.right, c.up, A], [hw, 0, c.right, A, c.fwd]];
    views.forEach(([x, y, r, u, f], i) => {
      gl.viewport(x, y, hw, hh);
      gl.uniform2f(prog.u('uRes'), hw, hh);
      gl.uniform2f(prog.u('uViewOff'), x, y);
      gl.uniformMatrix3x4fv(prog.u('uBasis'), false, new Float32Array([...r, ...u, ...f]));
      if (i === 1) gl.uniform1f(prog.u('uGunShow'), 0);    // the pistol only in the normal view
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    return true;
  };

  D.stats = function (world) {
    const p = world.player, f = p.forward, s = D.shown(p.pos);
    const tilt = Math.asin(WM.clamp(f[3], -1, 1)) * 180 / Math.PI, side = Math.asin(WM.clamp(p.right[3], -1, 1)) * 180 / Math.PI;
    return `x ${s.x.toFixed(1)}  y ${s.y.toFixed(1)}  z ${s.z.toFixed(1)} (wysokość)  w ${s.w.toFixed(2)}\n` +
      `obrót w W: przód ${tilt.toFixed(0)}° · prawo ${side.toFixed(0)}°${world.split ? ' · cztery widoki' : ''}`;
  };

  // multiplayer: you are a 4D figure (feet + your horizontal frame right / forward / ana)
  D.mp = (world, space, respawn) => ({
    space,
    me() { const p = world.player.pos, fr = world.player.frame; return { p: [p[0], p[1] - WPlayer.EYE, p[2], p[3]], R: fr[0], F: fr[1], A: fr[2] }; },
    respawn,
  });
  // hit by another player (PvP: health exists only while somebody else is in the room, see js/mp.js)
  D.damage = function (world, n, from) {
    if (world.health == null || WMP.dead()) return;
    world.health = Math.max(0, world.health - n);
    WE.hurt();
    if (world.health <= 0) WMP.died(world, from);
  };
  D.playerPoints = world => { const p = world.player.pos, dn = k => [p[0], p[1] - k, p[2], p[3]]; return { eye: p, body: [p, dn(0.8), dn(1.3)] }; };
  // sound in 4D: amplitude ~ 1/r^1.5 and a Huygens-violating tail behind every wavefront; sound coming mostly
  // along the hidden W axis is heard muffled
  D.soundArrivals = function (world, src) {
    const c = world.player.camera();
    if (!src) return [{ delay: 0, gain: 1, pan: 0, dist: 0, tail4d: 0.5 }];
    const a = WAudio.flatArrivals(src, c.pos, c.right, c.fwd, 4)[0];
    const d = WM.sub(src, c.pos), r = WM.len(d) || 1;
    a.muffle = a.muffle || Math.abs(WM.dot(d, world.player.frame[2])) / r > 0.5;
    a.tail4d = r;
    return [a];
  };
  window.W4D = D;
})();
