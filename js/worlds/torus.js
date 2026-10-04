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
#endif
  return r;
}
vec3 sky(vec3 rd){ return mix(vec3(.25,.18,.35), vec3(.55,.45,.7), .5+.5*rd.y); }
vec3 material(float id, vec3 p, vec3 n, inout float emit){
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
    subtitle: 'Skończony pokój bez ścian: każda strona sklejona z przeciwną. Widzisz nieskończenie wiele kopii pokoju — i siebie. Wpadnij w dziurę w podłodze.',
    help: ['WASD ruch · Spacja skok · Shift bieg', 'strzel poziomo — pocisk wróci z drugiej strony', 'pomarańczowe postacie = Ty', 'dziura w podłodze → spadasz z sufitu', 'N noclip'],
    shader: () => WG.euclid(code, '#define FOG_DENS .028\n#define MAX_T 110.\n#define SUN_DIR normalize(vec3(.25,.9,.35))\n#define BULLET_WRAP(q) ((q) - PER*floor((q)/PER + .5))\n'),
    bullets: new WBullets(WBallistics.flat(3, { speed: 30, gravity: 2.5, wrap: P, life: 4 }), {
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
    enter() {
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
    },
    update(dt, look) {
      this.player.update(dt, look);
      // keep fall speed sane when falling forever
      this.player.vel[1] = Math.max(this.player.vel[1], -25);
    },
    setUniforms(gl, prog) {
      const p = this.player, f = p.forward;
      p.setUniforms3(gl, prog);
      gl.uniform3f(prog.u('uPlayer'), p.pos[0], p.pos[1], p.pos[2]);
      gl.uniform2f(prog.u('uFwd'), f[0], f[2]);
    },
    stats() { return `przejścia przez sklejone ściany: ${this.wraps}`; },
  };
  WE.register(world);
})();
