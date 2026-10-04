// TESSERAKT — a genuinely 4D world (x, y, z, w). You see the 3D slice spanned by your right/up/forward
// vectors; Q/E and Z/C rotate the view into the 4th axis, R/F step along it.
(function () {
  const code = `
${WSwarm.glslMat(false, 1, true)}
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
// edges of a tesseract (4D box frame)
float sdFrame4(vec4 p, vec4 b, float e){
  p = abs(p)-b; vec4 q = abs(p+e)-e;
  float d = length(max(vec4(p.x,q.y,q.z,q.w),0.)) + min(max(max(p.x,q.y),max(q.z,q.w)),0.);
  d = min(d, length(max(vec4(q.x,p.y,q.z,q.w),0.)) + min(max(max(q.x,p.y),max(q.z,q.w)),0.));
  d = min(d, length(max(vec4(q.x,q.y,p.z,q.w),0.)) + min(max(max(q.x,q.y),max(p.z,q.w)),0.));
  d = min(d, length(max(vec4(q.x,q.y,q.z,p.w),0.)) + min(max(max(q.x,q.y),max(q.z,p.w)),0.));
  return d;
}
// vertical slots in the room walls (too narrow to squeeze through)
float cage(vec3 p){
  float t = abs(p.z) > abs(p.x) ? p.x : p.z;
  return max(abs(mod(t, 1.)-.5)-.2, abs(p.y-2.1)-1.5);
}
vec2 map(vec4 p){
  vec2 r = vec2(p.y, 1.);
  // spawn cell: walls in x/z but only 2 units thick along w -> escape through the 4th dimension
  float room = max(sdBox4(p-vec4(0,2,0,0), vec4(4.5,2,4.5,1)), -sdBox4(p-vec4(0,2.5,0,0), vec4(4.,2.6,4.,5.)));
  room = max(room, -cage(p.xyz));
  r = opU(r, vec2(room, 2.));
  // grid of tesseract blocks spread over x, z AND w
  vec3 cell = floor(vec3(p.x,p.z,p.w)/8.+.5);
  vec3 lp = vec3(p.x,p.z,p.w) - cell*8.;
  float hh = hash31(cell+3.1);
  if (hh < .55 && length(cell) > .5) {
    vec3 s = vec3(.8)+vec3(hash31(cell+.7),hash31(cell+1.9),hash31(cell+4.2))*1.6;
    float h = .5+floor(hh*10.)*.45;
    r = opU(r, vec2(sdBox4(vec4(lp.x, p.y-h, lp.y, lp.z), vec4(s.x, h, s.y, s.z)), 3.));
  }
  r.x = min(r.x, 4.-max(abs(lp.x),max(abs(lp.y),abs(lp.z)))+1.5);
  // staircase that climbs along w: step k lives at w in [2k, 2k+2)
  float k = clamp(floor((p.w-6.)/1.2), 0., 9.);
  vec4 sp = p - vec4(-12, .25+k*.5, 0, 6.+k*1.2+.6);
  r = opU(r, vec2(sdBox4(sp, vec4(2., .25+k*.5, 2., .6)), 4.));
  // spinning tesseract frame
  vec4 q = p - vec4(0, 4.5, 16, 0);
  q.xw = rot(uTime*.5)*q.xw; q.zw = rot(uTime*.31)*q.zw; q.xy = rot(uTime*.2)*q.xy;
  r = opU(r, vec2(sdFrame4(q, vec4(1.6), .1), 5.));
  // hyperspheres at different w: they grow and shrink as you move through w
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    vec4 c = vec4(12.+fi*3.5, 1.5, -10.+fi, -4.+fi*2.);
    r = opU(r, vec2(length(p-c)-1.5, 6.+fi));
  }
  // Clifford-like torus (product of two circles) floating overhead
  vec4 t = p - vec4(-14, 6, 14, 0);
  t.xw = rot(uTime*.23)*t.xw;
  r = opU(r, vec2(length(vec2(length(t.xy)-2., length(t.zw)-2.))-.45, 12.));
#ifndef PROBE
  r = opU(r, enemies(p));
#endif
  return r;
}
vec3 sky(vec4 rd){
  vec3 c = mix(vec3(.9,.75,.85), vec3(.25,.2,.55), clamp(rd.y*1.3,0.,1.));
  c = mix(vec3(.55,.5,.6), c, smoothstep(-.15,.15,rd.y));
  c += vec3(1.,.9,.7)*pow(max(dot(rd, SUN4),0.),200.)*3.;
  return c;
}
float grid4(vec4 p, vec4 n){
  vec4 f = abs(fract(p+vec4(0,0,0,.5))-.5), an = abs(n);
  // drop the coordinate most aligned with the normal, keep the other three
  float m = max(max(an.x,an.y),max(an.z,an.w));
  vec4 k = step(m-.001, an);
  float a = max(max(f.x*(1.-k.x), f.y*(1.-k.y)), max(f.z*(1.-k.z), f.w*(1.-k.w)));
  return smoothstep(.44,.49,a);
}
vec3 material(float id, vec4 p, vec4 n, inout float emit){
  if (id > 19.5) return enemyColor(id, p, n, emit);
  float g = grid4(p, n);
  vec3 wc = hsv(fract(p.w*.07+.6), .55, 1.);        // hue encodes the w coordinate
  if (id < 1.5) return mix(vec3(.45,.43,.5)*mix(vec3(1), wc, .35), vec3(.28,.26,.32), g);
  if (id < 2.5) return mix(vec3(.8,.75,.7), vec3(.5,.45,.45), g);
  if (id < 3.5) return mix(wc*.85, wc*.45, g);
  if (id < 4.5) return mix(vec3(.9,.8,.4), vec3(.5,.4,.2), g);
  if (id < 5.5) { emit = 2.; return vec3(.4,.9,1.); }
  if (id < 11.5) return hsv((id-6.)/5., .6, .95);
  emit = .4; return vec3(1.,.5,.8);
}
`;

  // landmarks for the 4D compass, in (x, z, w) — same places as in map() above
  const compass = new WCompass4D([
    { label: 'klatka', color: 'rgba(230,220,200,.8)', box: [[-4.5, 4.5], [-4.5, 4.5], [-1, 1]] },
    { label: 'schody w W', color: 'rgba(240,200,90,.8)', box: [[-14, -10], [-2, 2], [6, 18]] },
    { label: 'tesserakt', color: '#6ee0ff', at: [0, 16, 0], r: 1.6 },
    { label: 'torus', color: '#ff8ad0', at: [-14, 14, 0], r: 2 },
    ...[0, 1, 2, 3, 4].map(i => ({ label: i ? '' : 'hipersfery', color: 'rgba(160,255,160,.8)', at: [12 + i * 3.5, -10 + i, -4 + i * 2], r: 1.5 })),
  ]);

  const world = {
    name: 'Tesserakt 4D',
    subtitle: 'Czterowymiarowy świat (x, y, z, w). Widzisz trójwymiarowy przekrój. Jesteś zamknięty w pokoju — ale ściany mają grubość tylko w osi W. Wyjdź przez czwarty wymiar.',
    tags: ['4D', 'potwory z osi W', 'kompas 4D'],
    help: ['pociski lecą w 4D: po obrocie w W znikają z przekroju', 'T / G — krok w osi W (ana / kata)', 'Q / E — obrót widoku w płaszczyźnie przód–W', 'Z / C — obrót w płaszczyźnie prawo–W', 'X — wyzeruj obrót 4D', 'walka: czerwone kropki na kompasie = potwory (mogą być obok w osi W!)', 'kompas 4D w rogu · B — widok stały / za tobą', 'kolor = współrzędna W', 'F — cztery widoki: przekroje (x y z), (w y z), (x y w), (x w z)', 'kółko myszy — lot w górę / w dół'],
    shader: () => WG.nd(code),
    bullets: new WBullets(WBallistics.flat(4, { speed: 55, gravity: 1.2, life: 4 }), { hitTest: q => swarm.hitTest(q) || WMP.hitPeers(q) }),
    aim() { return this.player.aim(); },
    reverb: 0.08,
    // 4D: amplitude ~ 1/r^1.5 and a Huygens-violating tail behind every wavefront; sound coming mostly
    // along the hidden W axis is heard muffled
    soundArrivals(src) {
      const c = this.player.camera();
      if (!src) return [{ delay: 0, gain: 1, pan: 0, dist: 0, tail4d: 0.5 }];
      const a = WAudio.flatArrivals(src, c.pos, c.right, c.fwd, 4)[0];
      const d = WM.sub(src, c.pos), r = WM.len(d) || 1;
      a.muffle = a.muffle || Math.abs(WM.dot(d, this.player.frame[2])) / r > 0.5;
      a.tail4d = r;
      return [a];
    },
    enter(opts = {}) {
      if (!this.player) this.player = new WPlayer(4, { spawn: [0, WPlayer.EYE, -1, 0] });
      this.player.reset([0, WPlayer.EYE, -1, 0]);
      compass.reset();
      WSwarm.startMode(this, swarm, opts);
      if (!this._gKey) {
        this._gKey = true;
        window.addEventListener('keydown', e => {
          if (e.repeat || WE.world !== world || !WE.locked) return;
          if (e.code === 'KeyB') compass.follow = !compass.follow;
          if (e.code === 'KeyF') { world.split = !world.split; WE.toast(world.split ? 'Cztery widoki: (x y z) · (w y z) · (x y w) · (x w z)' : 'Jeden widok'); }
        });
      }
    },
    update(dt, look) {
      swarm.update(dt);
      const p = this.player;
      if (WE.keys.KeyX) {
        // flatten the view back into the xz hyperplane
        let f = [p.forward[0], 0, p.forward[2], 0];
        if (WM.len(f) < 0.1) f = [0, 0, 1, 0];
        f = WM.norm(f);
        p.frame = [[f[2], 0, -f[0], 0], f, [0, 0, 0, 1]];
      }
      p.update(dt, look, {
        rot: [[1, 2, 'KeyQ', 'KeyE'], [0, 2, 'KeyZ', 'KeyC']],
        moves: [[2, 'KeyG', 'KeyT']],
      });
    },
    // monsters appear 11-17 m away in a random horizontal direction of the 3D space (x, z, w)
    spawn(i, wave) {
      const p = this.player.pos;
      let d;
      do d = [Math.random() - 0.5, 0, Math.random() - 0.5, Math.random() - 0.5]; while (WM.len(d) < 0.2);
      d = WM.norm(d);
      const at = WM.addScaled([p[0], 0, p[2], p[3]], d, 11 + Math.random() * 6);
      return swarm.sp.place(at, WM.scale(d, -1));
    },
    playerPoints() {
      const p = this.player.pos, dn = k => [p[0], p[1] - k, p[2], p[3]];
      return { eye: p, body: [p, dn(0.8), dn(1.3)] };
    },
    setUniforms(gl, prog) { this.player.setUniformsND(gl, prog); swarm.setUniforms(gl, prog); },
    // F: four views of the same moment, each a 3D slice through a different triple of your axes
    // (x = your right, y = up, z = forward, w = ana — the hidden 4th direction):
    //   (x y z) the normal view │ (w y z) right replaced by W
    //   (x y w) looking into W  │ (x w z) up replaced by W: a horizontal 3D slice at eye height
    split: false,
    splitView() { return this.split; },
    drawViews(gl, prog, cw, ch) {
      if (!this.split) return false;
      const hw = Math.floor(cw / 2), hh = Math.floor(ch / 2), c = this.player.camera(), A = this.player.frame[2];
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
    },
    setBulletUniforms(gl, p) { WBullets.uploadSigned(gl, p, [[this.bullets, false], [swarm.shots, true], ...WMP.extraBullets(this)]); },
    settings: [{ label: 'Cztery widoki (F)', type: 'toggle', get: () => world.split, set: v => { world.split = v; } }],
    drawOverlay(ctx, W, H, dt) {
      // monsters on the compass: red dots (you see only those that lie in your 3D slice)
      compass.extra = swarm.list.filter(m => m.dead < 0).map(m => ({ label: '', color: '#ff4b4b', at: [m.g.p[0], m.g.p[2], m.g.p[3]], r: 0.45, fill: true }))
        .concat(WMP.avatars(this).filter(a => a.alive).map(a => ({ label: 'gracz ' + a.id, color: '#6cf', at: [a.g.p[0], a.g.p[2], a.g.p[3]], r: 0.5, fill: true })));
      compass.draw(ctx, W, H, dt, this.player);
    },
    stats() {
      const p = this.player, f = p.forward;
      const tilt = Math.asin(WM.clamp(f[3], -1, 1)) * 180 / Math.PI;
      return `x ${p.pos[0].toFixed(1)}  y ${p.pos[1].toFixed(1)}  z ${p.pos[2].toFixed(1)}  w ${p.pos[3].toFixed(2)}\nnachylenie wzroku w W: ${tilt.toFixed(0)}°`;
    },
  };
  const swarm = new WSwarm(world, WSwarm.spaces.flat4(), {
    range: 28, shotModel: WBallistics.flat(4, { speed: 10, gravity: 0, life: 5, radius: 0.09 }),
  });
  // multiplayer: you are a 4D figure (feet + your horizontal frame right / forward / ana)
  world.mp = {
    space: swarm.sp,
    me() { const p = world.player.pos, fr = world.player.frame; return { p: [p[0], p[1] - WPlayer.EYE, p[2], p[3]], R: fr[0], F: fr[1], A: fr[2] }; },
    respawn() { const r = (a) => (Math.random() - 0.5) * a; world.player.reset([r(5), WPlayer.EYE, r(5), r(0.8)]); },
  };
  WE.register(world);
})();
