// SFERA — spherical space S3 (curvature +1). The whole universe is finite: the surface of a 4D ball.
// It is tiled by the 8 cubes of a tesseract, whose angles here are 120°, so THREE cubes meet at each edge.
// Rays that go straight ahead come back from behind; objects near your antipode look gigantic.
(function () {
  const K = 1, EN_M = 0.12 / 1.6;   // world units per metre (eye height 0.12 = 1.6 m)

  const code = `
${WSwarm.glslMat(true, EN_M, false)}
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
vec4 canon(vec4 p){                       // |coords| sorted descending (the 8-cell's symmetry)
  vec4 a = abs(p);
  if (a.x < a.y) a.xy = a.yx; if (a.z < a.w) a.zw = a.wz;
  if (a.x < a.z) a.xz = a.zx; if (a.y < a.w) a.yw = a.wy;
  if (a.y < a.z) a.yz = a.zy;
  return a;
}
// small box on the floor at angle th along the great circle x=0 (Euclidean chord coordinates)
float floorBox(vec4 p, float th, vec3 off, vec3 b){
  vec4 c = vec4(0,0,sin(th),cos(th)), t = vec4(0,0,cos(th),-sin(th));
  if (dot(p,c) < .3) return .8;
  return sdBox(vec3(p.x, p.y, dot(p,t)) - off, b);
}
vec2 map(vec4 p){
  vec2 r = vec2(asin(clamp(p.y,-1.,1.)), 1.);
  vec4 c = canon(p);
  float f1 = asin((c.x-c.y)*.7071068), f2 = asin((c.x-c.z)*.7071068), f3 = asin((c.x-c.w)*.7071068);
  r = opU(r, vec2(max(f1,f2) - .018, 2.));        // tesseract edges
  r = opU(r, vec2(f3 - .06, 3.));                  // tesseract vertices
  for (int i = 1; i < 12; i++){
    float fi = float(i), th = fi*PI/6.;
    float h = .02 + .05*hash11(fi*7.3);
    float s = mod(fi, 2.) < .5 ? 1. : -1.;
    r = opU(r, vec2(floorBox(p, th, vec3(s*.14, h, 0), vec3(.03, h, .03)), 5.+fi));
  }
  // a small cube sitting at your antipode: it fills half the sky
  vec4 q = p; q.xz = rot(uTime*.3)*q.xz;
  if (q.w < -.5) r = opU(r, vec2(sdBox(q.xyz - vec3(0,.05,0), vec3(.04)), 4.));
#ifndef PROBE
  r = opU(r, enemies(p));
#endif
  return r;
}
vec3 fogColor(vec3 d){ return mix(vec3(.75,.8,.95), vec3(.55,.65,.9), .5+.5*d.y); }
vec3 material(float id, vec4 p, vec4 n, inout float emit){
  if (id > 19.5) return enemyColor(id, p, n, emit);
  vec4 c = canon(p);
  if (id < 1.5) {
    vec3 a = abs(vec3(p.x, p.z, p.w));
    float cell = a.x > a.y && a.x > a.z ? (p.x > 0. ? 0. : 1.) : a.y > a.z ? (p.z > 0. ? 2. : 3.) : (p.w > 0. ? 4. : 5.);
    float edge = smoothstep(.03, .012, asin((c.x-c.y)*.7071068));
    float g = smoothstep(.46, .49, max(abs(fract(p.x*20.)-.5), abs(fract(p.z*20.)-.5)));
    return mix(hsv(cell/6., .45, .85) * (1.-.15*g), vec3(.2), edge);
  }
  if (id < 2.5) return vec3(.95,.95,1.);
  if (id < 3.5) return vec3(1.,.4,.3);
  if (id < 4.5) { emit = 1.2; return vec3(1.,.8,.2); }
  return hsv((id-5.)/11., .6, .9);
}
`;

  const world = {
    name: 'Przestrzeń sferyczna',
    subtitle: 'S³ o krzywiźnie +1 — skończony wszechświat bez brzegu. Kafelkowany ośmioma sześcianami tesseraktu (po 3 wokół krawędzi). Idź prosto, a wrócisz z drugiej strony. Mały sześcian na antypodzie wygląda jak gigant.',
    tags: ['K = +1', 'S³', 'potwory'],
    help: ['WASD ruch · Spacja skok', 'strzel prosto — pocisk okrąży świat i trafi Cię w plecy', 'podłoga: 6 kolorowych pokoi', 'idź prosto wzdłuż kolorowych bloków', 'walka: chybiony pocisk potwora okrąża świat — uważaj na plecy', 'N noclip (Spacja/Ctrl — wysokość)'],
    shader: () => WG.curved(K, code, '#define MAX_T 6.\n#define FOG_DENS .16\n'),
    bullets: new WBullets(WBallistics.curved(K, { speed: 1.2, gravity: 0, radius: 0.006, life: 7 }), {
      hitTest: q => swarm.hitTest(q),
      selfDist: b => Math.acos(WM.clamp(WM.dot(b, world.player.camera()[3]), -1, 1)) - 0.03,
    }),
    aim() { return this.player.aim(); },
    reverb: 0.05,
    soundArrivals(src) { return WAudio.curvedArrivals(K, 1.6 / 0.12, src, this.player.camera()); },
    enter(opts = {}) {
      if (!this.player) this.player = new WCurvedPlayer(K, { eye: 0.12, radius: 0.035, speed: 0.35, run: 0.9, jump: 0.8, gravity: 3 });
      this.player.reset();
      this.dist = 0;
      WSwarm.startMode(this, swarm, opts);
    },
    update(dt, look) {
      const P0 = this.player.M[3].slice();
      this.player.update(dt, look);
      const P1 = this.player.M[3];
      this.dist = (this.dist || 0) + Math.acos(WM.clamp(WM.dot(P0, P1), -1, 1));
      swarm.update(dt);
    },
    setUniforms(gl, prog) { this.player.setUniforms(gl, prog); swarm.setUniforms(gl, prog); },
    setBulletUniforms(gl, p) { WBullets.uploadSigned(gl, p, [[this.bullets, false], [swarm.shots, true]]); },
    // monsters appear on the floor plane around you, facing you
    spawn(i, wave) {
      const r = 1.0 + Math.random() * 1.6;
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
    stats() {
      const P = this.player.M[3], home = Math.acos(WM.clamp(P[3], -1, 1));
      return `odległość od startu: ${home.toFixed(2)} (max π = 3.14) · przebyto: ${(this.dist || 0).toFixed(1)} · obwód świata 2π = 6.28`;
    },
  };
  const swarm = new WSwarm(world, WSwarm.spaces.curved(K, EN_M), {
    range: 28, shotModel: WBallistics.curved(K, { speed: 9 * EN_M, gravity: 0, radius: 0.009, life: 9 }),
  });
  WE.register(world);
})();
