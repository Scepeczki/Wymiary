// PĘTLA — a 3-torus: one room whose every side is glued to the opposite one. There are no walls,
// yet the room is finite: you see endless copies of it, and endless copies of YOURSELF.
// Fall through the hole in the floor and you drop in from the ceiling.
(function () {
  const P = [16, 12, 16];

  const code = `
uniform vec3 uPlayer;
uniform vec2 uFwd;
const vec3 PER = vec3(${P.join('.,')}.);
vec3 wrapc(vec3 p){ return p - PER*floor(p/PER + .5); }
float avatar(vec3 q){
  vec3 l = vec3(q.x*uFwd.y - q.z*uFwd.x, q.y, q.x*uFwd.x + q.z*uFwd.y);
  float d = length(l - vec3(0,-.1,0)) - .22;
  d = min(d, sdBox(l - vec3(0,-.85,0), vec3(.3,.5,.18)) - .03);
  d = min(d, sdBox(l - vec3(0,-1.45,0), vec3(.26,.14,.16)));
  return d;
}
// monsters (js/enemies.js): feet + yaw; seen in every copy of the cell, like you
uniform vec4 uEn4[${WSwarm.CAP}], uEnS[${WSwarm.CAP}];
uniform int uEnN;
${WHorde.GLSL}
vec3 enLocal(vec3 v, int i){
  float s = sin(uEn4[i].w), c = cos(uEn4[i].w);
  return vec3(dot(v.xz, vec2(c,-s)), v.y, dot(v.xz, vec2(s,c)));
}
vec2 enemies(vec3 p){
  vec2 r = vec2(1e9, 0.);
  for (int i = uZero; i < ${WSwarm.CAP}; i++){
    if (i >= uEnN) break;
    vec3 q = enLocal(wrapc(p - uEn4[i].xyz), i);
    float b = length(q - vec3(0,1,0)) - 1.4;
    if (b > .5) { r.x = min(r.x, b); continue; }
    vec2 z = zombie(q, uEnS[i], uTime*6. + float(i)*1.7);
    r = opU(r, vec2(z.x, 20. + float(i)*4. + z.y));
  }
  return r;
}
float visor(vec3 q){
  vec3 l = vec3(q.x*uFwd.y - q.z*uFwd.x, q.y, q.x*uFwd.x + q.z*uFwd.y);
  return sdBox(l - vec3(0,-.07,.19), vec3(.14,.05,.05));
}
vec2 map(vec3 p){
  vec3 c = wrapc(p);
  // floor slab with a hole — repeated around its own center so the slab of the cell above is seen too
  float sy = mod(p.y + 4.5 + .5*PER.y, PER.y) - .5*PER.y;
  float fl = sdBox(vec3(c.x, sy, c.z), vec3(8.,.5,8.));
  fl = max(fl, -sdBox(vec3(c.x-5.5, sy, c.z-5.5), vec3(1.5,1.,1.5)));
  vec2 slab = vec2(fl, 1.);
  // everything else stays >= 0.9 away from the cell border: bound the distance accordingly
  vec3 bd = .5*PER - abs(c);
  vec2 r = vec2(min(bd.x, min(bd.y, bd.z)) + .9, 0.);
  // stairs up to a bridge
  for (int i = 0; i < 6; i++){ float fi = float(i);
    r = opU(r, vec2(sdBox(c - vec3(-6.+fi*.9, -4.+.25+fi*.5, -5.), vec3(.45, .25+fi*.5, 1.2)), 2.)); }
  r = opU(r, vec2(sdBox(c - vec3(0,-1.25,-5.), vec3(2.,.25,1.2)), 2.));
  r = opU(r, vec2(sdBox(c - vec3(-5.5,0.,4.), vec3(.6,4.,.6)), 3.));
  r = opU(r, vec2(sdBox(c - vec3(4.,-3.5,-1.), vec3(.5)), 4.));
  r = opU(r, vec2(sdBox(c - vec3(2.,-3.,3.), vec3(1.,1.,.5)), 4.));
  // lamps
#ifndef PROBE
  r = opU(r, vec2(sdBox(c - vec3(0,5.,0), vec3(.8,.1,.8)), 6.));
#endif
  r = opU(r, slab);
#ifndef PROBE
  // clones of the player (your own copy is skipped)
  vec3 q = p - uPlayer, idx = floor(q/PER + .5);
  vec3 qq = q - idx*PER;
  float av, vi;
  if (dot(idx, idx) > .5) { av = avatar(qq); vi = visor(qq); }
  else {
    vec3 s = sign(qq + 1e-6);
    av = min(avatar(qq - vec3(s.x*PER.x,0,0)), min(avatar(qq - vec3(0,s.y*PER.y,0)), avatar(qq - vec3(0,0,s.z*PER.z))));
    vi = 1e3;
  }
  r = opU(r, vec2(av, 5.));
  r = opU(r, vec2(vi, 7.));
  r = opU(r, enemies(p));
#endif
  return r;
}
vec3 sky(vec3 rd){ return mix(vec3(.25,.18,.35), vec3(.55,.45,.7), .5+.5*rd.y); }
vec3 material(float id, vec3 p, vec3 n, inout float emit){
  if (id > 19.5) {
    int i = int((id - 20.)/4. + .01);
    return zombieColor(id - 20. - float(i)*4., uEnS[i], enLocal(wrapc(p - uEn4[i].xyz), i), enLocal(n, i), emit);
  }
  float g = gridLines(p, n, 1.);
  if (id < 1.5) return mix(vec3(.7,.65,.8), vec3(.45,.4,.55), g);
  if (id < 2.5) return mix(vec3(.9,.7,.4), vec3(.6,.45,.25), g);
  if (id < 3.5) return mix(vec3(.4,.8,.75), vec3(.25,.5,.5), g);
  if (id < 4.5) return mix(vec3(.9,.4,.4), vec3(.6,.25,.25), g);
  if (id < 5.5) return vec3(.95,.55,.2);
  if (id < 6.5) { emit = 4.; return vec3(1.,.95,.8); }
  emit = 3.; return vec3(.3,.9,1.);
}
`;

  const world = {
    name: 'Pętla (3-torus)',
    id: 'petla',
    subtitle: 'Skończony pokój bez ścian: każda strona sklejona z przeciwną. Widzisz nieskończenie wiele kopii pokoju — i siebie. Wpadnij w dziurę w podłodze.',
    tags: ['3-torus', 'kopie ciebie', 'potwory'],
    help: ['WASD ruch · Spacja skok · Shift bieg', 'strzel poziomo — pocisk wróci z drugiej strony', 'pomarańczowe postacie = Ty', 'dziura w podłodze → spadasz z sufitu', 'walka: potwory też mają nieskończenie wiele kopii — strzelaj do najbliższej', 'N noclip'],
    shader: () => WG.euclid(code, '#define FOG_DENS .028\n#define MAX_T 110.\n#define SUN_DIR normalize(vec3(.25,.9,.35))\n#define BULLET_WRAP(q) ((q) - PER*floor((q)/PER + .5))\n'),
    bullets: new WBullets(WBallistics.flat(3, { speed: 55, gravity: 1, wrap: P, life: 3 }), {
      hitTest: q => swarm.hitTest(q) || WMP.hitPeers(q),
      selfDist(b) {   // distance from the bullet to the nearest copy of the player's body (eye to feet segment)
        const p = world.player.pos, d = [0, 1, 2].map(i => { const x = b[i] - p[i]; return x - P[i] * Math.floor(x / P[i] + 0.5); });
        const y = WM.clamp(d[1], -1.5, 0);
        return Math.hypot(d[0], d[1] - y, d[2]) - 0.35;
      },
    }),
    aim() { return this.player.aim(); },
    reverb: 0.06,
    // the sound reaches you from every copy of the source (image sources on the lattice) — including the shots of your clones
    soundArrivals(src) {
      const c = this.player.camera(), L = c.pos, s = src || L, out = [];
      const base = [0, 1, 2].map(i => { const x = s[i] - L[i]; return x - P[i] * Math.floor(x / P[i] + 0.5); });
      for (let a = -3; a <= 3; a++) for (let b = -4; b <= 4; b++) for (let e = -3; e <= 3; e++) {
        const d = [base[0] + a * P[0], base[1] + b * P[1], base[2] + e * P[2]], r = WM.len(d);
        if (r > 45) continue;
        if (r < 1e-6) { out.push({ delay: 0, gain: 1, pan: 0, dist: 0 }); continue; }
        const dir = WM.scale(d, 1 / r);
        out.push({ delay: r / WAudio.C, gain: 1 / Math.max(r, 1), pan: WM.dot(dir, c.right), dist: r, muffle: WM.dot(dir, c.fwd) < -0.3 });
      }
      return out;
    },
    enter(opts = {}) {
      if (!this.player) {
        this.player = new WPlayer(3, { spawn: [0, -4 + WPlayer.EYE, 0], respawnY: -1e9 });
        this.player.onStep = (a, b) => {
          for (let i = 0; i < 3; i++) {
            const w = P[i] * Math.floor(b[i] / P[i] + 0.5);
            if (w) { b[i] -= w; this.wraps++; }
          }
        };
      }
      this.player.reset([0, -4 + WPlayer.EYE, 0]);
      this.wraps = 0;
      WSwarm.startMode(this, swarm, opts);
    },
    // where monsters appear: safe spots on the floor, the ones farthest from you first
    spawn(i, wave) {
      const p = this.player.pos, far = SPOTS.map((s, k) => ({ s, k, d: swarm.sp.dist([s[0], p[1], s[1]], p) + ((k * 7 + wave * 3) % 5) }))
        .sort((a, b) => b.d - a.d);
      const s = far[i % far.length].s;
      return swarm.sp.place([s[0], FLOOR, s[1]], Math.random() * 6.28);
    },
    playerPoints() {
      const p = this.player.pos;
      return { eye: p, body: [p, [p[0], p[1] - 0.8, p[2]], [p[0], p[1] - 1.3, p[2]]] };
    },
    update(dt, look) {
      this.player.update(dt, look);
      swarm.update(dt);
      // keep fall speed sane when falling forever
      this.player.vel[1] = Math.max(this.player.vel[1], -25);
    },
    setUniforms(gl, prog) {
      const p = this.player, f = p.forward;
      p.setUniforms3(gl, prog);
      swarm.setUniforms(gl, prog);
      gl.uniform3f(prog.u('uPlayer'), p.pos[0], p.pos[1], p.pos[2]);
      gl.uniform2f(prog.u('uFwd'), f[0], f[2]);
    },
    setBulletUniforms(gl, p) { WBullets.upload(gl, p, [[this.bullets, 0], [swarm.shots, 1], ...WMP.extraBullets(this).map(([l, e]) => [l, e ? 1 : 0])]); },
    stats() { return `przejścia przez sklejone ściany: ${this.wraps}`; },
  };
  // monsters walk on the floor slab (top at y = -4); the hole in it is avoided (CPU), the rest via GPU probes
  const FLOOR = -4, SPOTS = [[5, 1], [-1, 6], [6, -6], [-7, 0], [1, -7], [-3, 2], [7.5, 2], [3, 7], [-6, -1.5], [0, 3]];
  const swarm = new WSwarm(world, WSwarm.spaces.torus(P), {
    range: 30,
    shotModel: WBallistics.flat(3, { speed: 10, gravity: 0, wrap: P, life: 5, radius: 0.09 }),
    avoid(g) {
      const dx = g.p[0] - 5.5, dz = g.p[2] - 5.5, ox = 2.1 - Math.abs(dx), oz = 2.1 - Math.abs(dz);
      if (ox <= 0 || oz <= 0) return null;
      const w = ox < oz ? [Math.sign(dx) * ox, 0, 0] : [0, 0, Math.sign(dz) * oz], [R, F] = swarm.sp.axes(g);
      return [w[0] * R[0] + w[2] * R[2], w[0] * F[0] + w[2] * F[2]];
    },
  });
  // multiplayer (js/mp.js): you are a figure with feet + yaw, like the monsters
  world.mp = {
    space: swarm.sp,
    me() { const p = world.player.pos, f = world.player.forward; return { p: [p[0], p[1] - WPlayer.EYE, p[2]], yaw: Math.atan2(f[0], f[2]) }; },
    respawn() { const r = (a) => (Math.random() - 0.5) * a; world.player.reset([r(10), -4 + WPlayer.EYE, r(10)], Math.random() * 6.28); },
  };
  WE.register(world);
})();
