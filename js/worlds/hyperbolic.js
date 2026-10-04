// HIPERBOLA — real hyperbolic space H3 (hyperboloid model), filled with the {4,3,5} honeycomb:
// right-angled-looking cubes, but FIVE of them meet around every edge. You walk on the plane y=0.
(function () {
  // Klein half-size a of the cube with 72° dihedral angles: cos72 = a^2/(1-a^2)
  const A = Math.sqrt(Math.cos(2 * Math.PI / 5) / (1 + Math.cos(2 * Math.PI / 5)));
  const CH = 1 / Math.sqrt(1 - A * A), SH = A * CH;   // cosh d, sinh d where tanh d = A
  const K = -1, EN_M = 0.17 / 1.6;   // world units per metre (eye height 0.17 = 1.6 m)

  const code = `
${WSwarm.glslMat(true, EN_M, false)}
const float CH = ${CH.toFixed(7)}, SH = ${SH.toFixed(7)};
vec4 fold(vec4 p, out float nref){
  nref = 0.;
  for (int i = 0; i < 24; i++){
    bool moved = false;
    for (int a = 0; a < 3; a++){
      float c = p[a], s = abs(c)*CH - p.w*SH;       // <p, n> for the face on the side of c
      if (s > 0.) { p[a] -= 2.*s*sign(c)*CH; p.w -= 2.*s*SH; moved = true; nref += 1.; }
    }
    if (!moved) break;
  }
  return p;
}
// distance to the nearest face along each axis (positive inside the cell)
vec3 faceDist(vec4 p){
  return vec3(asinh(-(abs(p.x)*CH - p.w*SH)), asinh(-(abs(p.y)*CH - p.w*SH)), asinh(-(abs(p.z)*CH - p.w*SH)));
}
vec2 map(vec4 p){
  vec2 r = vec2(asinh(p.y), 1.);                      // floor = the plane y=0
  float nr; vec4 q = fold(p, nr);
  vec3 f = faceDist(q);
  float beams = min(max(f.x,f.z), min(max(f.x,f.y), max(f.y,f.z))) - .022;
  r = opU(r, vec2(beams, 2.));
  r = opU(r, vec2(max(f.x,max(f.y,f.z)) - .07, 3.));  // blocks at the vertices
#ifndef PROBE
  float lamp = kdist(q, vec4(0, sinh(.4), 0, cosh(.4))) - .035;
  r = opU(r, vec2(lamp, 4.));
#endif
#ifndef PROBE
  r = opU(r, enemies(p));
#endif
  return r;
}
vec3 fogColor(vec3 d){ return mix(vec3(.02,.02,.05), vec3(.1,.05,.15), .5+.5*d.y); }
vec3 material(float id, vec4 p, vec4 n, inout float emit){
  if (id > 19.5) return enemyColor(id, p, n, emit);
  float nr; vec4 q = fold(p, nr);
  vec3 f = faceDist(q);
  if (id < 1.5) {
    float line = smoothstep(.03, .015, min(f.x, f.z));
    float ring = .5+.5*cos(kdist(q, vec4(0,0,0,1))*40.);
    return mix(vec3(.18,.2,.3) + .05*ring, vec3(.9,.5,.2), line);
  }
  if (id < 2.5) return mix(vec3(.95,.6,.3), vec3(.4,.8,1.), smoothstep(-.1,.6,asinh(p.y)));
  if (id < 3.5) return vec3(.3,.9,.8);
  emit = 3.; return vec3(1.,.85,.6);
}
`;

  const world = {
    name: 'Przestrzeń hiperboliczna',
    id: 'hiperbola',
    subtitle: 'H³ o krzywiźnie −1. Plaster miodu {4,3,5}: sześcienne pokoje o kątach prostych, ale wokół każdej krawędzi stoi PIĘĆ sześcianów. Przestrzeń rośnie wykładniczo z odległością.',
    tags: ['K = −1', 'H³', 'potwory'],
    help: ['WASD ruch · Spacja skok', 'pociski lecą po geodezyjnych H³ — rozbiegają się wykładniczo', 'policz sześciany wokół narożnika podłogi (5!)', 'walka: ich fioletowe pociski też lecą po geodezyjnych', 'N noclip (Spacja/Ctrl — wysokość)'],
    shader: () => WG.curved(K, code, '#define MAX_T 7.\n#define FOG_DENS .42\n'),
    bullets: new WBullets(WBallistics.curved(K, { speed: 4.5, gravity: 0.1, radius: 0.007, life: 3 }), { hitTest: q => swarm.hitTest(q) || WMP.hitPeers(q) }),
    aim() { return this.player.aim(); },
    reverb: 0.05,
    soundArrivals(src) { return WAudio.curvedArrivals(K, 1.6 / 0.17, src, this.player.camera()); },
    enter(opts = {}) {
      if (!this.player) {
        this.player = new WCurvedPlayer(K, { eye: 0.17, radius: 0.045, speed: 0.3, run: 0.7 });
        // keep the player inside the fundamental cell: when crossing a face, apply the
        // orientation-preserving symmetry (face reflection followed by the mid-plane mirror)
        this.player.onMoved = () => {
          const p = this.player, P = p.M[3];
          for (const a of [0, 2]) {
            const s = Math.abs(P[a]) * CH - P[3] * SH;
            if (s > 0) {
              const n = [0, 0, 0, SH]; n[a] = Math.sign(P[a]) * CH;
              const f = v => {
                const k = WM.kdot(K, v, n), r = WM.addScaled(v, n, -2 * k);
                r[a] = -r[a];
                return r;
              };
              p.M = p.M.map(f);
              // the shared (network) coordinates: local = T · absolute
              const F = [0, 1, 2, 3].map(i => f([0, 1, 2, 3].map(j => (i === j ? 1 : 0))));
              T = WM.mulMat(F, T); Tinv = WM.inverse(T);
              this.bullets.transform(f);   // bullets live in the same coordinates: move them along
              swarm.shots.transform(f);
              for (const m of swarm.list) swarm.sp.transform(m.g, f);
              this.crossed = (this.crossed || 0) + 1;
            }
          }
        };
      }
      this.player.reset();
      this.crossed = 0;
      WSwarm.startMode(this, swarm, opts);
    },
    update(dt, look) { this.player.update(dt, look); swarm.update(dt); },
    setUniforms(gl, prog) { this.player.setUniforms(gl, prog); swarm.setUniforms(gl, prog); },
    setBulletUniforms(gl, p) { WBullets.uploadSigned(gl, p, [[this.bullets, false], [swarm.shots, true], ...WMP.extraBullets(this)]); },
    // monsters appear on the floor plane around you, facing you
    spawn(i, wave) {
      const r = 1.1 + Math.random() * 0.7;
      let M = WM.mulMat(this.player.M, WM.planeRot(4, 2, 0, i * 2.4 + Math.random() * 1.2));
      M = WM.mulMat(M, WM.ktrans(K, 2, r));
      M = WM.mulMat(M, WM.planeRot(4, 2, 0, Math.PI));
      WM.korthonormalize(K, M);
      return swarm.sp.place(M);
    },
    playerPoints() {
      const p = this.player, h = p.h;
      return { eye: p.camera()[3], body: [p.local(0, h, 0), p.local(0, Math.max(0.01, h - 0.8 * EN_M), 0), p.local(0, Math.max(0.01, h - 1.3 * EN_M), 0)] };
    },
    stats() { return `przekroczone ściany komórek: ${this.crossed}`; },
  };
  const swarm = new WSwarm(world, WSwarm.spaces.curved(K, EN_M), {
    range: 22, shotModel: WBallistics.curved(K, { speed: 9 * EN_M, gravity: 0, radius: 0.012, life: 6 }),
  });
  // multiplayer: the world keeps re-centring itself on you (above), so positions are sent in shared coordinates
  // absolute = T⁻¹ · local, where T collects all the re-centring maps applied so far
  let T = WM.ident(4), Tinv = WM.ident(4);
  world.mp = {
    space: swarm.sp,
    me: () => ({ M: world.player.M.map(c => c.slice()) }),
    respawn() { world.player.reset(); world.player.move((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3); },
    toAbs: v => WM.mulVec(Tinv, v),
    toLocal: v => WM.mulVec(T, v),
  };
  WE.register(world);
})();
