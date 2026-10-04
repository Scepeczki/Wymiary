// WYSPY 4D — floating platforms over an abyss. Each platform is a 4D box: it exists only within its own range of w,
// so in your 3D slice platforms appear and vanish as you step along W. The way to the golden platform mixes
// ordinary jumps over gaps on the floor (x, y) with steps through W onto a platform that lies "beside" you in the
// 4th dimension (same spot on the floor, different w). Falling: back to the last platform you stood on.
// Engine axes: x, y (up), z, w — shown as x, z (height), y, w.
(function () {
  // ---- the course (fixed seed: everybody gets the same one) ----
  let seed = 777;
  const rnd = (a = 0, b = 1) => { seed = (seed * 1664525 + 1013904223) >>> 0; return a + (b - a) * seed / 4294967296; };
  const P = [];   // { c: [x, top, z, w], h: [hx, hz, hw] }
  P.push({ c: [0, 0, 0, 0], h: [3.5, 3.5, 1.6] });
  let heading = 0;   // mostly towards +z, wandering left / right
  // two platforms collide when their boxes in (x, y on the floor, w) overlap (with a margin) at similar heights
  const clash = (c, h, skip) => P.some((q, i) => i !== skip && Math.abs(q.c[1] - c[1]) < 3 &&
    Math.abs(q.c[0] - c[0]) < q.h[0] + h[0] + 0.8 && Math.abs(q.c[2] - c[2]) < q.h[1] + h[1] + 0.8 && Math.abs(q.c[3] - c[3]) < q.h[2] + h[2] + 0.3);
  for (let k = 1; k < 18; k++) {
    const a = P[k - 1];
    let c, h;
    for (let tries = 0; tries < 40; tries++) {
    h = [rnd(1.6, 2.8), rnd(1.6, 2.8), rnd(0.8, 1.4)];
    c = a.c.slice();
    if ((k % 3 === 2 || rnd() < 0.3) && tries < 30) {
      // a step through W: overlapping on the floor, the next range of w (a small gap in w between them)
      const dw = (rnd() < 0.5 ? -1 : 1) * (a.h[2] + rnd(0.2, 0.5) + h[2]);
      c[3] += dw; c[0] += rnd(-1.5, 1.5); c[2] += rnd(-1.5, 1.5); c[1] += rnd(0, 0.2);
    } else {
      // a jump over a gap on the floor, in the same range of w
      heading = WM.clamp(heading + rnd(-0.9, 0.9), -1.2, 1.2);
      const dx = Math.sin(heading), dz = Math.cos(heading), gap = rnd(1.2, 2.2);
      const reach = Math.abs(dx) * (a.h[0] + h[0]) + Math.abs(dz) * (a.h[1] + h[1]) + gap;
      c[0] += dx * reach; c[2] += dz * reach; c[3] += rnd(-0.4, 0.4); c[1] += rnd(-0.5, 0.45);
    }
    if (!clash(c, h, k - 1)) break;
    }
    P.push({ c, h });
  }
  P[P.length - 1].goal = true;
  // a few decoys: platforms off the course (in other ranges of w)
  for (let k = 0, tries = 0; k < 8 && tries < 200; tries++) {
    const a = P[1 + Math.floor(rnd(0, P.length - 2))];
    const d = { c: [a.c[0] + rnd(-6, 6), a.c[1] + rnd(-1, 1.5), a.c[2] + rnd(-6, 6), a.c[3] + (rnd() < 0.5 ? -1 : 1) * rnd(3, 6)], h: [rnd(1, 2), rnd(1, 2), rnd(0.6, 1.2)], decoy: true };
    if (clash(d.c, d.h, -1)) continue;
    k++;
    P.push(d);
  }
  const NP = P.length, COURSE = P.filter(p => !p.decoy).length;
  const top = (p, y) => [p.c[0], p.c[1] + y, p.c[2], p.c[3]];
  const PC = new Float32Array(NP * 4), PH = new Float32Array(NP * 4);
  P.forEach((p, i) => { PC.set([p.c[0], p.c[1] - 0.4, p.c[2], p.c[3]], i * 4); PH.set([p.h[0], 0.4, p.h[1], p.h[2]], i * 4); });
  const goal = P.find(p => p.goal);

  const code = `
${WSwarm.glslMat(false, 1, true)}
uniform vec4 uPC[${NP}], uPH[${NP}];
const vec4 GOALB = vec4(${top(goal, 1.6).map(v => v.toFixed(2)).join(',')});
vec2 map(vec4 p){
  vec2 r = vec2(1e9, 0.);
  // platform i has material id 64 + i (20..63: figures, 99+: bullets); far platforms are skipped by a cheap bound first
  for (int i = uZero; i < ${NP}; i++) {
    vec4 d = abs(p - uPC[i]) - uPH[i];
    if (max(max(d.x, d.y), max(d.z, d.w)) > r.x) continue;
    r = opU(r, vec2(sdBox4(p - uPC[i], uPH[i]) - .02, 64. + float(i)));
  }
#ifndef PROBE
  r = opU(r, vec2(length(p - GOALB) - .7, 4.));
  r = opU(r, enemies(p));                                  // the other players
#endif
  return r;
}
vec3 sky(vec4 rd){
  vec3 c = mix(vec3(.85,.75,.7), vec3(.25,.35,.7), clamp(rd.y*1.2, 0., 1.));
  c = mix(vec3(.03,.02,.06), c, smoothstep(-.5, .1, rd.y));             // the abyss
  return c + vec3(1.,.9,.7)*pow(max(dot(rd, SUN4), 0.), 200.)*3.;
}
vec3 material(float id, vec4 p, vec4 n, inout float emit){
  if (id > 19.5 && id < 63.9) return enemyColor(id, p, n, emit);
  if (id > 3.5 && id < 4.5) { emit = 3.; return vec3(1.,.85,.35); }
  int k = int(id - 64. + .5);
  if (k == ${P.indexOf(goal)}) { emit = .5; return vec3(1.,.8,.3); }     // the golden platform
  vec3 wc = hsv(fract(uPC[k].w*.09 + .55), .6, 1.);      // hue = the w of the platform
  // the platform's own W range: the top glows near its two W ends (that is where it vanishes from your slice)
  float we = uPH[k].w - abs(p.w - uPC[k].w);
  vec3 c = wc*(k >= ${COURSE} ? .55 : 1.);
  if (n.y > .5) {
    vec2 e = uPH[k].xz - abs(p.xz - uPC[k].xz);
    if (min(e.x, e.y) < .12) c = mix(c, vec3(1), .5);
    if (we < .25) { emit = .9; c = mix(c, vec3(.9,.4,1.), .7); }
  }
  return c*(.85 + .15*step(.5, fract((floor(p.x) + floor(p.z))*.5)));
}
`;

  const compass = new WCompass4D(P.map((p, i) => ({
    label: p.goal ? 'META' : i === 0 ? 'start' : '',
    color: p.goal ? '#ffd24a' : p.decoy ? 'rgba(160,160,180,.35)' : `hsla(${Math.round(((p.c[3] * 0.09 + 0.55) % 1 + 1) % 1 * 360)},80%,70%,.8)`,
    box: [[p.c[0] - p.h[0], p.c[0] + p.h[0]], [p.c[2] - p.h[1], p.c[2] + p.h[1]], [p.c[3] - p.h[2], p.c[3] + p.h[2]]],
  })));
  compass.range = 16;

  // the platform you stand on (feet within its box, just above its top)
  const standing = pos => P.findIndex(p => Math.abs(pos[0] - p.c[0]) <= p.h[0] && Math.abs(pos[2] - p.c[2]) <= p.h[1] &&
    Math.abs(pos[3] - p.c[3]) <= p.h[2] && Math.abs(pos[1] - WPlayer.EYE - p.c[1]) < 0.3);

  const world = {
    name: 'Wyspy 4D',
    subtitle: 'Platformy nad przepaścią. Każda jest czterowymiarowym prostopadłościanem: istnieje tylko w swoim zakresie w, więc gdy idziesz wzdłuż W, w twoim przekroju platformy znikają i pojawiają się. Droga do złotej platformy to skoki nad przerwami na podłodze i kroki przez W na platformę, która leży „obok” w czwartym wymiarze — w tym samym miejscu podłogi, przy innym w.',
    tags: ['4D', 'parkour przez oś W', 'wyścig z czasem'],
    help: ['cel: złota platforma (kompas: META) — mapka pokazuje wszystkie platformy w (x, y, w)', 'fioletowy brzeg platformy = jej koniec w osi W', 'gdy następnej wyspy nie widać: jest obok w W (T / G, kółko)', 'spadniesz → wracasz na ostatnią wyspę', ...W4D.HELP],
    shader: () => WG.nd(code, '#define FOG_DENS .012\n'),
    bullets: new WBullets(WBallistics.flat(4, { speed: 55, gravity: 1.2, life: 4 }), { hitTest: q => WMP.hitPeers(q) }),
    aim() { return this.player.aim(); },
    reverb: 0.04,
    soundArrivals(src) { return W4D.soundArrivals(this, src); },
    enter() {
      if (!this.player) this.player = new WPlayer(4, { spawn: top(P[0], WPlayer.EYE), respawnY: -1e9 });
      this.player.reset(top(P[0], WPlayer.EYE));
      compass.reset();
      this.t0 = WE.time; this.done = false; this.check = 0; this.reached = 0;
    },
    update(dt, look) {
      const p = this.player;
      W4D.update(this, dt, look);
      const k = standing(p.pos);
      if (k >= 0 && !P[k].decoy) {
        this.check = k;
        if (k > this.reached) { this.reached = k; }
        if (P[k].goal && !this.done) {
          this.done = true;
          const t = WE.time - this.t0;
          this.best = Math.min(this.best || Infinity, t);
          WE.toast(`META! Czas ${t.toFixed(1)} s${t <= this.best ? ' — rekord!' : ''}`, 4000);
          setTimeout(() => { if (WE.world === world) world.enter({}); }, 3500);
        }
      }
      if (p.pos[1] < -14) {
        p.reset(top(P[this.check], WPlayer.EYE));
        WE.toast('Spadłeś — z powrotem na ostatnią wyspę', 1500);
      }
    },
    duelHud() {
      const t = this.done ? 0 : WE.time - this.t0;
      return `<div style="font-size:15px">⏱ ${this.done ? 'META!' : t.toFixed(1) + ' s'} · wyspa ${this.reached + 1} / ${COURSE}${this.best ? ` · rekord ${this.best.toFixed(1)} s` : ''}</div>`;
    },
    playerPoints() { return W4D.playerPoints(this); },
    damage(n, from) { W4D.damage(this, n, from); },
    setUniforms(gl, prog) {
      this.player.setUniformsND(gl, prog);
      gl.uniform4fv(prog.u('uPC'), PC);
      gl.uniform4fv(prog.u('uPH'), PH);
      avatars.setUniforms(gl, prog);
    },
    drawViews(gl, prog, cw, ch) { return W4D.drawViews(this, gl, prog, cw, ch); },
    setBulletUniforms(gl, p) { WBullets.uploadSigned(gl, p, [[this.bullets, false], ...WMP.extraBullets(this)]); },
    drawOverlay(ctx, W, H, dt) {
      compass.extra = WMP.avatars(this).filter(a => a.alive).map(a => ({ label: 'gracz ' + a.id, color: '#6cf', at: [a.g.p[0], a.g.p[2], a.g.p[3]], r: 0.5, fill: true }));
      compass.draw(ctx, W, H, dt, this.player);
    },
    stats() { return W4D.stats(this); },
    _test: { P, standing, COURSE },
  };
  const avatars = new WSwarm({}, WSwarm.spaces.flat4(), { shotModel: WBallistics.flat(4, {}) });
  world.compass = compass;
  W4D.setup(world);
  world.mp = W4D.mp(world, avatars.sp, () => world.player.reset(top(P[world.check || 0], WPlayer.EYE)));
  avatars.w = world;
  WE.register(world);
})();
