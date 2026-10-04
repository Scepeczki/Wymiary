// WOLNE ŚWIATŁO — special relativity with an adjustable speed of light c.
// You walk at normal speed, but when c is only a few m/s that is close to light speed:
//  * aberration: the view is squeezed forward as you run (ray directions transformed per pixel),
//  * Doppler + beaming: what is ahead turns blue and bright, what is behind red and dark,
//  * finite light travel time: every point is seen as it was when the light left it — lamps you switch
//    send out a visible front of light, the clock on the far wall runs slow as you run away from it,
//    the fast carousel looks bent, your reflection in the mirror walls lags behind you by 2d/c,
//    zombies are seen where they WERE (but bullets hit where they ARE).
// The effects of your own motion (aberration, Doppler) are off by default; switch them on in the menu.
(function () {
  const S = { s: 0.43, aberr: false, doppler: false, delay: true };
  // after a hit its flash stays visible until the light from it has crossed the hall
  const linger = () => (S.delay ? 0.3 + 100 / c() : 0.3);
  const cOf = s => 2 * Math.pow(10, 2.3 * s);           // 2 ... 400 m/s
  const c = () => cOf(S.s);
  const NL = 12, CAR = [0, 1, -14], CAR_R = 5;

  // lamps: two rows along the runway; state history = base state + up to 8 switch times
  const LAMPS = [];
  for (const x of [-5, 5]) for (let k = 0; k < 6; k++) LAMPS.push({ p: [x, 3.4, 5 + k * 10], hue: ((k * 0.13) + (x > 0 ? 0.5 : 0.05)) % 1, base: 1, times: [] });
  function toggle(l) {
    l.times.push(WE.time);
    if (l.times.length > 8) { l.times.shift(); l.base = 1 - l.base; }
  }

  // Row 0: the player's feet (x, y, z, yaw); rows 1..8: monster slots. Texel 0 = now, texel k >= 1 = the
  // sample taken at histT0 - (k-1)*HDT. 64 samples x 0.12 s = ~7.5 s of history.
  const HN = 64, HDT = 0.12, ROWS = 1 + WHorde.MAX;
  const hist = new Float32Array(HN * ROWS * 4);
  let histT0 = 0, histTex = null, lastYaw = 0;
  function histFill(row, v) { for (let k = 0; k < HN; k++) hist.set(v, (row * HN + k) * 4); }
  function histNow(row, v, push) {
    if (push) hist.copyWithin(row * HN * 4 + 4, row * HN * 4, (row * HN + HN - 1) * 4);
    hist.set(v, row * HN * 4);
  }

  // CPU distance field of the hall (for the monsters: walking and line of sight)
  function sdf(p) {
    const [x, y, z] = p;
    let d = Math.min(y, Math.max(Math.min(19.75 - Math.abs(x), 72 - z, z + 22), y - 8));
    if (z > -2 && z < 62) {
      const bz = ((z + 5) % 10 + 10) % 10 - 5, bx = Math.abs(x) - 9;
      const qx = Math.abs(bx) - 0.8, qy = Math.abs(y - 1.5) - 1.5, qz = Math.abs(bz) - 0.8;
      d = Math.min(d, Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0));
    }
    return d;
  }
  function los(a, b) {
    const d = WM.sub(b, a), L = WM.len(d), u = WM.scale(d, 1 / L);
    for (let t = 0.3; t < L - 0.3;) { const q = sdf(WM.addScaled(a, u, t)); if (q < 0.05) return false; t += Math.max(q, 0.05); }
    return true;
  }
  const horde = new WHorde(null, {
    metric: () => [0, 0, 0, 0], sdf, los, nodes: [[0, 20]], next: [[0]], nearestNode: () => 0,
    linger,
    spawns: [[-12, 50], [12, 52], [0, 58], [-6, 40], [6, 44], [0, 32]],
  });

  const code = `
uniform sampler2D uHist;      // position history (see above)
uniform float uHistT0;
uniform vec4 uMonS[${WHorde.MAX}];   // monster slot state: hp (<0 = empty slot), flash, death time, type
uniform vec4 uLamp[${NL}];    // position, hue
uniform float uLampB[${NL}];  // state before the stored switch times
uniform vec4 uLampT[${NL * 2}];  // 8 switch times per lamp (1e9 = unused)
uniform float uCarPhase, uCarW;
const vec3 CAR = vec3(${CAR.join('.,')}.);
float lampOn(int i, float t){
  vec4 a = uLampT[i*2], b = uLampT[i*2+1];
  float s = uLampB[i] + step(a.x,t) + step(a.y,t) + step(a.z,t) + step(a.w,t) + step(b.x,t) + step(b.y,t) + step(b.z,t) + step(b.w,t);
  return mod(s, 2.);
}
vec3 lampCol(int i){ return hsv(uLamp[i].w, .45, 1.); }
${WHorde.GLSL}
vec4 histAt(int row, float T){
  if (T >= uHistT0) {
    float f = clamp((T - uHistT0)/max(uTime - uHistT0, 1e-4), 0., 1.);
    return mix(texelFetch(uHist, ivec2(1, row), 0), texelFetch(uHist, ivec2(0, row), 0), f);
  }
  float k = min((uHistT0 - T)/${HDT} + 1., ${HN - 1}.01);
  int i = int(floor(k));
  return mix(texelFetch(uHist, ivec2(i, row), 0), texelFetch(uHist, ivec2(min(i + 1, ${HN - 1}), row), 0), fract(k));
}
// retarded positions of the player and the monsters — refreshed by the kernel once per ray step (RETARD_HOOK)
vec4 gPos[${ROWS}];
void retardHook(){ for (int i = 0; i < ${ROWS}; i++) gPos[i] = histAt(i, gRT); }
// All figures (you + monsters): pick the nearest by bounding sphere and evaluate the detailed model only
// for that one — keeps the shader small (the model is inlined wherever map() is).
vec2 figures(vec3 p){
  float best = 1e9, other = 1e9; int bi = -1;
  for (int i = 0; i < ${ROWS}; i++){
    bool on = i == 0 ? gBounce > 0 : uMonS[max(i - 1, 0)].x > -.5;   // you: visible only in reflections
    if (!on) continue;
    float bb = length(p - gPos[i].xyz - vec3(0,1,0)) - 1.25;
    if (bb < best) { other = min(other, best); best = bb; bi = i; } else other = min(other, bb);
  }
  if (bi < 0) return vec2(1e9, 0.);
  if (best > .3) return vec2(best, 1.);
  vec4 st = bi == 0 ? vec4(1, 0, -1, 2) : uMonS[max(bi - 1, 0)];
  vec3 q = p - gPos[bi].xyz;
  q.xz = r2(-gPos[bi].w)*q.xz;
  vec2 z = zombie(q, st, gRT*6. + float(bi)*1.7);
  float id0 = bi == 0 ? 60. : 30. + float(bi - 1)*4.;
  return z.x < other ? vec2(z.x, id0 + z.y) : vec2(other, 1.);
}
bool isMirror(float id){ return id > 39.5 && id < 40.5; }
vec2 map(vec3 p){
  vec2 r = vec2(p.y, 1.);
  r = opU(r, vec2(max(min(min(20. - abs(p.x), 72. - p.z), p.z + 22.), p.y - 8.), 2.));   // hall walls, open to the sky
  // two mirror walls facing each other: reflections of reflections, each one older by 2d/c
  vec3 mq = vec3(abs(p.x) - 19.85, p.y - 3.4, p.z - 6.);
  r = opU(r, vec2(sdBox(mq, vec3(.1, 3., 15.)), 40.));
  r = opU(r, vec2(max(sdBox(mq, vec3(.16, 3.2, 15.2)), -sdBox(mq, vec3(1., 3., 15.))), 5.));   // frame: rim only
  // you — visible only in reflections (the camera sits inside your head)
  r = opU(r, figures(p));
  for (int i = 0; i < ${NL}; i++){
    vec3 q = p - uLamp[i].xyz;
    r = opU(r, vec2(sdBox(q - vec3(0,-1.7,0), vec3(.06,1.7,.06)), 5.));
    r = opU(r, vec2(length(q) - .2, 10. + float(i)));
  }
  if (p.z > -2. && p.z < 62.) {                          // reference blocks every 10 m
    vec3 b = p; b.z = mod(b.z + 5., 10.) - 5.; b.x = abs(b.x) - 9.;
    r = opU(r, vec2(sdBox(b - vec3(0,1.5,0), vec3(.8,1.5,.8)), 3.));
  }
  // carousel: seen where it WAS when the light left it (gRT = emission time along this ray)
  vec3 c = p - CAR;
  float a0 = uCarPhase + uCarW*(gRT - uTime), sec = 2.*PI/8.;
  float k = floor((atan(c.z, c.x) - a0)/sec + .5), aa = a0 + k*sec;
  vec3 lc = c - vec3(${CAR_R}.*cos(aa), 0, ${CAR_R}.*sin(aa));
  lc.xz = r2(-aa)*lc.xz;
  r = opU(r, vec2(sdBox(lc, vec3(.45,.6,.9)), 20. + mod(k, 8.)));
  r = opU(r, vec2(sdBox(p - CAR + vec3(0,.85,0), vec3(1.2,.15,1.2)), 5.));
  return r;
}
vec3 sky(vec3 rd){
  vec3 col = mix(vec3(.01,.012,.03), vec3(.03,.04,.1), clamp(rd.y*.5+.5, 0., 1.));
  vec3 q = rd*220., f = floor(q);
  float h = hash31(f);
  if (h > .991) col += hsv(hash31(f+3.), .35, 1.)*smoothstep(.3, 0., length(fract(q)-.5))*3.;
  return col;
}
vec3 material(float id, vec3 p, vec3 n, inout float emit){
#ifdef DBG_HIST
  if (id < 1.5) return vec3(gPos[1].z/60., gPos[0].z < -3. ? 1. : 0., histAt(1, gRT).z/60.);
#endif
  if (id > 59.5) return zombieColor(id - 60., vec4(1, 0, -1, 2), p, n, emit);
  if (id > 29.5) {
    float k = id - 30.; int i = int(floor(k/4. + .01));
    return zombieColor(k - float(i)*4., uMonS[i], p, n, emit);
  }
  if (id > 19.5) { emit = .7; return hsv((id - 20.)/8., .75, 1.); }
  if (id > 9.5) {
    int i = int(id - 10. + .5);
    if (lampOn(i, gRT) > .5) { emit = 6.; return lampCol(i); }
    return vec3(.15);
  }
  float g = gridLines(p, n, 1.);
  if (id < 1.5) {
    float ch = mod(floor(p.x) + floor(p.z), 2.);
    return mix(mix(vec3(.55), vec3(.35), ch), vec3(.15), g);
  }
  if (id < 2.5) {
    if (p.z > 71.9) {                                     // clock on the far wall: one turn per 10 s of MAP time
      vec2 d = p.xy - vec2(0, 5.);
      float r = length(d);
      if (r < 4.) {
        emit = .5;
        float a = PI*.5 - 2.*PI*gRT/10.;
        vec2 hd = vec2(cos(a), sin(a));
        float along = clamp(dot(d, hd), 0., 3.4), off = length(d - hd*along);
        float tick = step(.93, fract(atan(d.y, d.x)/(2.*PI)*12. + .04))*step(3.4, r);
        vec3 face = mix(vec3(.9,.88,.8), vec3(.1), max(step(off, .12), tick));
        return mix(face, vec3(.8,.2,.2), step(r, .25));
      }
    }
    return mix(vec3(.18,.2,.32), vec3(.08,.09,.15), g);
  }
  if (id < 3.5) return mix(hsv(fract(p.z/60.), .6, .9), vec3(.1), g);
  return vec3(.25,.25,.28);
}
vec3 light(vec3 p, vec3 n, vec3 rd, vec3 alb, float ao){
  vec3 col = alb*(.04 + .07*ao*(.5+.5*n.y));              // starlight
  for (int i = 0; i < ${NL}; i++){
    vec3 L = uLamp[i].xyz - p; float d = length(L); L /= d;
    // the lamp must have been on when ITS light left it: emission time of the ray point minus lamp->point travel
    if (lampOn(i, gRT - d*uInvC) < .5) continue;
    col += alb*lampCol(i)*max(dot(n, L), 0.)*7./(1. + d*d*.12)*(.4+.6*ao);
  }
  return col;
}
`;

  const world = {
    name: 'Wolne światło',
    subtitle: 'Szczególna teoria względności z regulowaną prędkością światła c. Światło potrzebuje czasu: przełączone lampy wysyłają widoczny front światła, zegar na końcu hali spóźnia się o d/c, a w lustrzanych ścianach widzisz siebie sprzed chwili — każde kolejne odbicie jeszcze dawniej. W trybie z potworami widzisz je tam, gdzie były.',
    tags: ['wolne światło', 'lustro', 'potwory'],
    help: ['WASD ruch · Shift bieg', 'Q / E — prędkość światła c', 'lustrzane ściany po bokach: odbicie się spóźnia', 'L — wszystkie lampy · F — lampa na celowniku', 'strzał w żarówkę też ją przełącza', 'B aberracja · J Doppler (efekty ruchu, domyślnie wył.)', 'K opóźnienie światła'],
    shader: () => WG.euclid(code, '#define CUSTOM_LIGHT\n#define RELATIVITY\n#define RETARDED\n#define MIRROR\n#define RETARD_HOOK\n#define FOG_DENS .004\n#define MAX_T 150.\n'),
    bullets: new WBullets(WBallistics.flat(3, { speed: 55, gravity: 1.2, life: 4 }), {
      linger,
      hitTest: q => {
        const l = LAMPS.find(l => WM.len(WM.sub(q, l.p)) < 0.45);
        if (l) { toggle(l); return true; }
        return horde.hitTest(q) || WMP.hitPeers(q);
      },
    }),
    aim() { return this.player.aim(); },
    reverb: 0.2,
    horde,
    modes: [{ label: 'Spokój', opts: { zombies: false } }, { label: 'Z potworami', opts: { zombies: true } }],
    damage(n, from) {
      if (this.health == null || WMP.dead()) return;
      this.health = Math.max(0, this.health - n);
      WE.hurt();
      if (this.health > 0 || WMP.died(this, from)) return;
      WE.toast('Zginąłeś! Potwory wracają.', 3000); this.enter({}); this.bullets.clear();
    },
    settings: [
      { label: 'Prędkość światła', min: 0, max: 1, step: 0.005, reset: 0.43, get: () => S.s, set: v => { S.s = v; }, text: () => `c = ${c().toFixed(c() < 10 ? 1 : 0)} m/s` },
      { label: 'Aberracja', type: 'toggle', get: () => S.aberr, set: v => { S.aberr = v; } },
      { label: 'Doppler + jasność', type: 'toggle', get: () => S.doppler, set: v => { S.doppler = v; } },
      { label: 'Opóźnienie światła', type: 'toggle', get: () => S.delay, set: v => { S.delay = v; } },
    ],
    enter(opts = {}) {
      if (!this.player) {
        this.player = new WPlayer(3, { spawn: [0, WPlayer.EYE, -4] });
        window.addEventListener('keydown', e => {
          if (WE.world !== world || e.repeat || !WE.locked) return;
          if (e.code === 'KeyL') { world.toggleAll(); WE.toast('Lampy przełączone — patrz na front światła'); }
          if (e.code === 'KeyF') {
            const cam = this.player.camera();
            let best = null, bd = 0.97;
            for (const l of LAMPS) { const d = WM.dot(WM.norm(WM.sub(l.p, cam.pos)), cam.fwd); if (d > bd) { bd = d; best = l; } }
            if (best) toggle(best);
          }
          if (e.code === 'KeyB') { S.aberr = !S.aberr; WE.toast('Aberracja: ' + (S.aberr ? 'wł.' : 'wył.')); }
          if (e.code === 'KeyJ') { S.doppler = !S.doppler; WE.toast('Doppler: ' + (S.doppler ? 'wł.' : 'wył.')); }
          if (e.code === 'KeyK') { S.delay = !S.delay; WE.toast('Opóźnienie światła: ' + (S.delay ? 'wł.' : 'wył.')); }
        });
      }
      this.player.reset([0, WPlayer.EYE, -4]);
      this.tau = 0; this.t0 = WE.time; this.carPhase = 0;
      if (opts.zombies != null) this.zombies = opts.zombies;
      horde.reset(!!this.zombies);
      this.health = this.zombies ? 100 : null;
      if (this.zombies) WE.toast('Potwory widzisz tam, gdzie BYŁY — przy małym c strzelaj przed nie', 4000);
      lastYaw = 0; histT0 = WE.time;
      histFill(0, [0, 0, -4, 0]);
      for (let r = 1; r < ROWS; r++) histFill(r, [0, -50, 0, 0]);
      horde.list.forEach(m => histFill(1 + m.slot, [m.p[0], 0, m.p[2], m.yaw]));
    },
    beta() {
      const v = this.player.vel, b = WM.scale(v, 1 / c()), l = WM.len(b);
      return l > 0.985 ? WM.scale(b, 0.985 / l) : b;
    },
    update(dt, look) {
      S.s = WM.clamp(S.s + WE.axis('KeyQ', 'KeyE') * dt * 0.25, 0, 1);
      this.player.update(dt, look);
      horde.update(dt);
      // record positions (player: continuous yaw so interpolation never spins around)
      const f = this.player.forward, pos = this.player.pos;
      let yaw = Math.atan2(f[0], f[2]);
      yaw = lastYaw + Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw)); lastYaw = yaw;
      const push = WE.time - histT0 >= HDT;
      if (push) histT0 = WE.time;
      histNow(0, [pos[0], pos[1] - WPlayer.EYE, pos[2], yaw], push);
      const seen = new Set();
      for (const m of horde.list) { seen.add(m.slot); histNow(1 + m.slot, [m.p[0], 0, m.p[2], m.yaw], push); }
      this.avatars = WMP.avatars(this).slice(0, WHorde.MAX - WHorde.N);
      this.avatars.forEach((a, k) => { seen.add(WHorde.N + k); histNow(1 + WHorde.N + k, [a.g.p[0], a.g.p[1], a.g.p[2], a.g.yaw], push); });
      for (let r = 0; r < WHorde.MAX; r++) if (!seen.has(r)) histNow(1 + r, [0, -50, 0, 0], push);
      const b = WM.len(this.beta());
      this.tau += dt * Math.sqrt(1 - b * b);                 // your own (proper) time runs slower
      this.carPhase += this.carW() * dt;
    },
    toggleAll() { LAMPS.forEach(toggle); },
    carW() { return Math.min(6, 0.8 * c()) / CAR_R; },       // the carousel rim never reaches c
    setBulletUniforms(gl, p) { WBullets.uploadRetarded(gl, p, [[this.bullets, 0], [horde.shots, 1], ...WMP.extraBullets(this).map(([l, e]) => [l, e ? 1 : 0])]); },
    setUniforms(gl, prog) {
      this.player.setUniforms3(gl, prog);
      const b = this.beta();
      gl.uniform3f(prog.u('uBeta'), b[0], b[1], b[2]);
      gl.uniform1f(prog.u('uAberr'), S.aberr ? 1 : 0);
      gl.uniform1f(prog.u('uDoppler'), S.doppler ? 1 : 0);
      gl.uniform1f(prog.u('uInvC'), S.delay ? 1 / c() : 0);
      const lp = new Float32Array(NL * 4), lb = new Float32Array(NL), lt = new Float32Array(NL * 8).fill(1e9);
      LAMPS.forEach((l, i) => {
        lp.set([...l.p, l.hue], i * 4);
        lb[i] = l.base;
        l.times.forEach((t, k) => { lt[i * 8 + k] = t; });
      });
      gl.uniform4fv(prog.u('uLamp'), lp);
      gl.uniform1fv(prog.u('uLampB'), lb);
      gl.uniform4fv(prog.u('uLampT'), lt);
      gl.uniform1f(prog.u('uCarPhase'), this.carPhase);
      gl.uniform1f(prog.u('uCarW'), this.carW());
      // history texture on unit 1
      if (!histTex) {
        histTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, histTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, histTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, HN, ROWS, 0, gl.RGBA, gl.FLOAT, hist);
      gl.uniform1i(prog.u('uHist'), 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(prog.u('uHistT0'), histT0);
      const ms = new Float32Array(WHorde.MAX * 4);
      for (let i = 0; i < WHorde.MAX; i++) ms[i * 4] = -1;
      for (const m of horde.list) ms.set([m.hp / 100, m.flash, m.dead, m.type], m.slot * 4);
      (this.avatars || []).forEach((a, k) => ms.set([a.hp / 100, a.flash, a.dead, a.type], (WHorde.N + k) * 4));
      gl.uniform4fv(prog.u('uMonS'), ms);
    },
    stats() {
      const b = WM.len(this.beta()), v = WM.len(this.player.vel), g = 1 / Math.sqrt(1 - b * b);
      const ahead = g * (1 + b), behind = g * (1 - b);
      return `c = ${c().toFixed(1)} m/s · v = ${v.toFixed(1)} m/s · β = ${b.toFixed(3)} · γ = ${g.toFixed(2)}\n` +
        `Doppler: przód ×${ahead.toFixed(2)}, tył ×${behind.toFixed(2)} · czas mapy ${(WE.time - this.t0).toFixed(1)} s · twój zegar ${this.tau.toFixed(1)} s` +
        `\nodbicie w lustrze spóźnia się o ${(2 * Math.max(0, 19.75 - Math.abs(this.player.pos[0])) / c()).toFixed(2)} s` +
        (this.zombies ? ` · potwory: ${horde.alive()} / ${horde.total} · życie ${Math.ceil(this.health)}` : '');
    },
    _test: { S, c, LAMPS, toggle },
  };
  horde.w = world;
  // multiplayer (js/mp.js): you are a figure with feet + yaw; the monsters are run by the room's leader
  world.ai = () => (world.zombies ? horde : null);
  world.playerPoints = () => { const p = world.player.pos; return { eye: p, body: [p, [p[0], p[1] - 0.8, p[2]], [p[0], p[1] - 1.3, p[2]]] }; };
  world.mp = {
    space: WSwarm.spaces.torus([1e9, 1e9, 1e9]),
    me() { const p = world.player.pos, f = world.player.forward; return { p: [p[0], p[1] - WPlayer.EYE, p[2]], yaw: Math.atan2(f[0], f[2]) }; },
    respawn() { const r = a => (Math.random() - 0.5) * a; world.player.reset([r(6), WPlayer.EYE, -4 + r(3)]); },
  };
  WE.register(world);
})();
