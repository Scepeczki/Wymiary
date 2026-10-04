// LABIRYNT 4D — a maze of 4 × 4 × 3 chambers spread over the floor (x, y) AND the 4th axis w. The floor exists
// only inside the maze, and some chambers have a pit in half of their W range: at the same spot on the floor there
// is ground at one w and an abyss at another. Doors in the walls are open only in the middle of a chamber's
// W range; some passages lead through W itself (a violet / cyan square on the floor marks where: step along W
// there with T / G or the mouse wheel). Find the golden hypersphere.
// Engine axes: x, y (up), z, w — shown as x, z (height), y, w.
(function () {
  const NX = 4, NZ = 4, NW = 3, CS = [8, 8, 4], ORG = [-16, -16, -6];   // chamber size and the maze corner in (x, z, w)
  const T = 0.15, H = 4;                                                  // wall half thickness, wall height
  const START = [0, 0, 1], GOAL = [3, 3, 0];
  const idx = (i, j, k) => i + NX * (j + NZ * k);
  const centre = (i, j, k, y = 0) => [ORG[0] + (i + 0.5) * CS[0], y, ORG[1] + (j + 0.5) * CS[1], ORG[2] + (k + 0.5) * CS[2]];

  // ---- the maze: depth-first search over the 3D grid of chambers (fixed seed: everybody gets the same maze) ----
  let seed = 4242;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const bits = new Float32Array(NX * NZ * NW);   // 1 +x open, 2 +y open, 4 +w open, 8 pit (upper w half), 16 pit (lower w half)
  const open = (a, b) => {                        // open the face between two neighbouring chambers
    const lo = a.map((v, k) => Math.min(v, b[k])), ax = a.findIndex((v, k) => v !== b[k]);
    bits[idx(...lo)] = (bits[idx(...lo)] | (1 << ax));
  };
  const isOpen = (c, ax, dir) => {                // is the face of chamber c on side dir (+1/-1) of axis ax open?
    const n = c.slice(); if (dir < 0) n[ax]--;
    if (n[ax] < 0 || (dir > 0 && c[ax] >= [NX, NZ, NW][ax] - 1)) return false;
    return !!(bits[idx(...n)] & (1 << ax));
  };
  {
    const seen = new Set([idx(...START)]), stack = [START];
    while (stack.length) {
      const c = stack[stack.length - 1];
      const nb = [];
      for (let ax = 0; ax < 3; ax++) for (const d of [-1, 1]) {
        const n = c.slice(); n[ax] += d;
        if (n[ax] >= 0 && n[ax] < [NX, NZ, NW][ax] && !seen.has(idx(...n))) nb.push(n);
      }
      if (!nb.length) { stack.pop(); continue; }
      const n = nb[Math.floor(rnd() * nb.length)];
      open(c, n); seen.add(idx(...n)); stack.push(n);
    }
    // a few extra openings: loops
    for (let k = 0; k < 10; k++) {
      const c = [Math.floor(rnd() * NX), Math.floor(rnd() * NZ), Math.floor(rnd() * NW)], ax = Math.floor(rnd() * 3);
      const n = c.slice(); n[ax]++;
      if (n[ax] < [NX, NZ, NW][ax]) open(c, n);
    }
    // pits in half of the W range of some chambers (never on the side of an open W passage, never start / goal)
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) for (let k = 0; k < NW; k++) {
      if ((i === START[0] && j === START[1] && k === START[2]) || (i === GOAL[0] && j === GOAL[1] && k === GOAL[2]) || rnd() > 0.75) continue;
      const upper = rnd() < 0.5;
      if (upper && !isOpen([i, j, k], 2, 1)) bits[idx(i, j, k)] |= 8;
      if (!upper && !isOpen([i, j, k], 2, -1)) bits[idx(i, j, k)] |= 16;
    }
  }
  const startPos = () => centre(...START, WPlayer.EYE);
  const goalPos = centre(...GOAL, 1.5);

  const code = `
${WSwarm.glslMat(false, 1, true)}
uniform float uCell[${NX * NZ * NW}];
const vec3 CS = vec3(${CS.join('.,')}.), ORG = vec3(${ORG.join('.,')}.);
const ivec3 NC = ivec3(${NX}, ${NZ}, ${NW});
const vec4 GOAL = vec4(${goalPos.map(v => v.toFixed(2)).join(',')});
int cellBits(ivec3 c){
  if (any(lessThan(c, ivec3(0))) || any(greaterThanEqual(c, NC))) return 0;
  return int(uCell[c.x + NC.x*(c.y + NC.y*c.z)] + .5);
}
bool faceOpen(ivec3 c, int ax, float dir){
  ivec3 n = c; if (dir < 0.) n[ax] -= 1;
  if (n[ax] < 0 || (dir > 0. && c[ax] >= NC[ax] - 1)) return false;
  return (cellBits(n) & (1 << ax)) != 0;
}
// a wall on the side dir of axis ax of the chamber (local coords l = (x, z, w) from its centre, y = height)
float wall(vec3 l, float y, int ax, float dir, bool isOpen){
  float d = max(abs(l[ax] - dir*CS[ax]*.5) - ${T}, y - ${H}.);
  if (!isOpen) return d;
  // the doorway: in x / y walls a door 2.4 wide, 3 high, open only for |w| < 1.2 inside the chamber;
  // in w walls a 3 × 3 hole in the middle of the floor
  float hole = ax == 2 ? sdBox(vec3(l.x, y - 1.75, l.y), vec3(1.5, 1.75, 1.5))
                       : sdBox(vec3(ax == 0 ? l.y : l.x, y - 1.5, l.z), vec3(1.2, 1.5, 1.2));
  return max(d, -hole);
}
vec2 map(vec4 p){
  vec3 q = vec3(p.x, p.z, p.w) - ORG;
  ivec3 c = ivec3(clamp(floor(q/CS), vec3(0), vec3(NC - 1)));
  vec3 l = q - (vec3(c) + .5)*CS;
  int b = cellBits(c);
  // floor: only inside the maze, with pits in half of the W range of some chambers
  vec3 hb = vec3(NC)*CS*.5;
  float fl = sdBox4(vec4(q.x - hb.x, p.y + .25, q.y - hb.y, q.z - hb.z), vec4(hb.x, .25, hb.y, hb.z));
  if ((b & 8) != 0)  fl = max(fl, -sdBox4(vec4(l.x, p.y, l.y, l.z - 1.), vec4(2.5, 1., 2.5, 1.05)));
  if ((b & 16) != 0) fl = max(fl, -sdBox4(vec4(l.x, p.y, l.y, l.z + 1.), vec4(2.5, 1., 2.5, 1.05)));
  vec2 r = vec2(fl, 1.);
  float wl = 1e9, bound = 1e9;
  for (int ax = uZero; ax < 3; ax++) for (int s = 0; s < 2; s++) {
    float dir = s == 0 ? -1. : 1.;
    bool o = faceOpen(c, ax, dir);
    wl = min(wl, wall(l, p.y, ax, dir, o));
    // through an open face the next chamber's walls begin: never step across its boundary blindly
    if (o) bound = min(bound, abs(l[ax] - dir*CS[ax]*.5) + .05);
  }
  r = opU(r, vec2(wl, 2.));
  r.x = min(r.x, bound);
#ifndef PROBE
  r = opU(r, vec2(length(p - GOAL) - .8, 3.));
  r = opU(r, enemies(p));                                  // the other players
#endif
  return r;
}
vec3 sky(vec4 rd){
  vec3 c = mix(vec3(.75,.7,.9), vec3(.2,.25,.55), clamp(rd.y*1.2, 0., 1.));
  c = mix(vec3(.05,.03,.08), c, smoothstep(-.4, .05, rd.y));            // the abyss below the maze
  return c + vec3(1.,.9,.7)*pow(max(dot(rd, SUN4), 0.), 200.)*3.;
}
float grid4(vec4 p, vec4 n){
  vec4 f = abs(fract(p+vec4(0,0,0,.5))-.5), an = abs(n);
  float m = max(max(an.x,an.y),max(an.z,an.w));
  vec4 k = step(m-.001, an);
  return smoothstep(.44,.49, max(max(f.x*(1.-k.x), f.y*(1.-k.y)), max(f.z*(1.-k.z), f.w*(1.-k.w))));
}
vec3 material(float id, vec4 p, vec4 n, inout float emit){
  if (id > 19.5) return enemyColor(id, p, n, emit);
  vec3 q = vec3(p.x, p.z, p.w) - ORG;
  ivec3 c = ivec3(clamp(floor(q/CS), vec3(0), vec3(NC - 1)));
  vec3 l = q - (vec3(c) + .5)*CS;
  vec3 wc = hsv(fract(p.w*.07 + .6), .55, 1.);          // hue = the w coordinate
  float g = grid4(p, n);
  if (id < 1.5) {
    // passages through W: violet square = ana (+w), cyan = kata (−w)
    if (n.y > .5 && abs(l.x) < 1.5 && abs(l.y) < 1.5) {
      bool up = faceOpen(c, 2, 1.), dn = faceOpen(c, 2, -1.);
      if (up || dn) { emit = 1.2; return up && dn ? vec3(.8,.6,1.) : up ? vec3(.8,.3,1.) : vec3(.3,.9,1.); }
    }
    // pit edges glow red
    int b = cellBits(c);
    float pit = ((b & 8) != 0 && l.z > -.05) || ((b & 16) != 0 && l.z < .05) ? 1. : 0.;
    if (pit > .5 && max(abs(l.x), abs(l.y)) < 2.9 && n.y > .5) { emit = .8; return vec3(1.,.25,.15); }
    float ch = mod(float(c.x + c.y + c.z), 2.);
    return mix(mix(vec3(.62,.6,.66), vec3(.5,.48,.56), ch)*mix(vec3(1), wc, .3), vec3(.3), g);
  }
  if (id < 2.5) return mix(wc*.85, wc*.5, g);
  emit = 3.; return vec3(1.,.8,.3);
}
`;

  const compass = new WCompass4D([
    { label: 'start', color: 'rgba(230,220,200,.8)', box: [[0, 1], [0, 1], [0, 1]].map((_, a) => [ORG[a] + START[a] * CS[a], ORG[a] + (START[a] + 1) * CS[a]]) },
    { label: 'META', color: '#ffd24a', at: [goalPos[0], goalPos[2], goalPos[3]], r: 1, fill: true },
    { label: 'labirynt', color: 'rgba(160,200,255,.35)', box: [0, 1, 2].map(a => [ORG[a], ORG[a] + [NX, NZ, NW][a] * CS[a]]) },
  ]);

  const world = {
    name: 'Labirynt 4D',
    id: 'labirynt',
    subtitle: 'Labirynt 4 × 4 × 3 komór rozłożonych po podłodze (x, y) i po czwartej osi w. Podłoga jest tylko w labiryncie, a w niektórych komorach ma dziurę tylko w połowie zakresu W — w tym samym miejscu podłogi przy jednym w jest grunt, przy innym przepaść. Część przejść prowadzi przez W: fioletowy / błękitny kwadrat na podłodze. Znajdź złotą hiperkulę.',
    tags: ['4D', 'labirynt przez oś W', 'wyścig z czasem'],
    help: ['cel: złota hiperkula (kompas: META)', 'fioletowy kwadrat = przejście w +W (T / kółko w górę), błękitny = w −W', 'drzwi w ścianach są otwarte tylko w środku zakresu W komory', 'czerwony brzeg = dziura w podłodze (tylko przy części w)', ...W4D.HELP],
    shader: () => WG.nd(code, '#define FOG_DENS .02\n'),
    bullets: new WBullets(WBallistics.flat(4, { speed: 55, gravity: 1.2, life: 4 }), { hitTest: q => WMP.hitPeers(q) }),
    aim() { return this.player.aim(); },
    reverb: 0.15,
    soundArrivals(src) { return W4D.soundArrivals(this, src); },
    enter() {
      if (!this.player) this.player = new WPlayer(4, { spawn: startPos(), respawnY: -14 });
      this.player.reset(startPos());
      compass.reset();
      this.t0 = WE.time; this.done = false;
      // the first hint: which ways lead out of the start chamber
      const ways = [];
      for (let ax = 0; ax < 3; ax++) for (const d of [-1, 1]) if (isOpen(START, ax, d)) ways.push(ax === 2 ? (d > 0 ? '+W (fioletowy kwadrat, T / kółko w górę)' : '−W (błękitny kwadrat, G / kółko w dół)') : 'drzwi w ścianie');
      WE.toast('Wyjście z komory startowej: ' + ways.join(', '), 6000);
    },
    update(dt, look) {
      const p = this.player, y0 = p.pos[1];
      W4D.update(this, dt, look);
      if (y0 < -10 && p.pos[1] > 0) { WE.toast('Spadłeś w przepaść — od startu', 2000); this.t0 = WE.time; }
      if (!this.done && WM.len(WM.sub(p.pos, goalPos)) < 1.6) {
        this.done = true;
        const t = WE.time - this.t0;
        this.best = Math.min(this.best || Infinity, t);
        WE.toast(`META! Czas ${t.toFixed(1)} s${t <= this.best ? ' — rekord!' : ''}`, 4000);
        setTimeout(() => { if (WE.world === world) world.enter({}); }, 3000);
      }
    },
    duelHud() {
      const t = (this.done ? 0 : WE.time - this.t0);
      return `<div style="font-size:15px">⏱ ${this.done ? 'META!' : t.toFixed(1) + ' s'}${this.best ? ` · rekord ${this.best.toFixed(1)} s` : ''}</div>`;
    },
    playerPoints() { return W4D.playerPoints(this); },
    damage(n, from) { W4D.damage(this, n, from); },
    setUniforms(gl, prog) {
      this.player.setUniformsND(gl, prog);
      gl.uniform1fv(prog.u('uCell'), bits);
      avatars.setUniforms(gl, prog);
    },
    drawViews(gl, prog, cw, ch) { return W4D.drawViews(this, gl, prog, cw, ch); },
    setBulletUniforms(gl, p) { WBullets.uploadSigned(gl, p, [[this.bullets, false], ...WMP.extraBullets(this)]); },
    drawOverlay(ctx, W, H, dt) {
      compass.extra = WMP.avatars(this).filter(a => a.alive).map(a => ({ label: 'gracz ' + a.id, color: '#6cf', at: [a.g.p[0], a.g.p[2], a.g.p[3]], r: 0.5, fill: true }));
      compass.draw(ctx, W, H, dt, this.player);
    },
    stats() { return W4D.stats(this); },
    _test: { bits, isOpen, START, GOAL, centre },
  };
  // other players are drawn by the monster renderer (no monsters here, only figures)
  const avatars = new WSwarm({}, WSwarm.spaces.flat4(), { shotModel: WBallistics.flat(4, {}) });
  world.compass = compass;
  W4D.setup(world);
  world.mp = W4D.mp(world, avatars.sp, () => world.player.reset(startPos()));
  avatars.w = world;
  WE.register(world);
})();
