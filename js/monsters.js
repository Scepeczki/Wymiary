// Monsters ("zombies") for the corridor building. Each one carries a bubble of curved space with it
// (type 0: K > 0, a lens; type 1: K < 0, a hyperbolic bubble) and shoots slow projectiles that are small
// flying lenses themselves. All of it feeds the metric, so light, bullets and sound bend around them.
(function () {
  const MAX = 8, HP = 100;
  const SEG0 = 0.25, SEG1 = 1.65, BODY_R = 0.42;   // hit capsule (above the feet)
  // curvature bubbles: [K, R, R2]
  const BUBBLE = [[0.9, 0.9, 2.1], [-0.6, 0.9, 2.1]];
  const SHOT_BUBBLE = [1.6, 0.25, 0.85];

  const capsuleDist = (q, x, z, y0, y1) => Math.hypot(q[0] - x, q[1] - WM.clamp(q[1], y0, y1), q[2] - z);

  class Horde {
    // o: { metric(p), sdf(p), los(a, b), nodes: [[x,z]...], next: [[...]], nearestNode(p), spawns: [[x,z]...] }
    constructor(world, o) {
      this.w = world; this.o = o; this.list = []; this.killed = 0; this.total = 0;
      this.shots = new WBullets(WBallistics.conformal(o.metric, { speed: 9, gravity: 0, radius: 0.09, life: 7 }), { linger: o.linger });
    }
    reset(on) {
      this.list = []; this.shots.clear(); this.killed = 0;
      if (on) this.o.spawns.slice(0, MAX).forEach(([x, z], i) => this.list.push({
        slot: i, p: [x, 0, z], yaw: 0, hp: HP, type: i % 2, cool: 2.5 + Math.random() * 2, flash: 0, dead: -1, ph: Math.random() * 6,
      }));
      this.total = this.list.length;
    }
    alive() { return this.list.filter(m => m.dead < 0).length; }

    // curvature sources for the metric: [x, y, z, K, R, R2]
    zones() {
      const z = [];
      for (const m of this.list) {
        const [K, R, R2] = BUBBLE[m.type], fade = m.dead < 0 ? 1 : Math.max(0, 1 - m.dead / 1.2);
        z.push([m.p[0], 1.0, m.p[2], K * fade, R, R2]);
      }
      for (const b of this.shots.list) if (b.dead < 0) {
        const p = this.shots.model.pos(b.s);
        z.push([p[0], p[1], p[2], SHOT_BUBBLE[0], SHOT_BUBBLE[1], SHOT_BUBBLE[2]]);
      }
      return z;
    }

    // player bullet at q: did it hit a monster?
    hitTest(q) {
      for (const m of this.list) {
        if (m.dead >= 0 || capsuleDist(q, m.p[0], m.p[2], SEG0, SEG1) > BODY_R) continue;
        m.hp -= 34; m.flash = 1;
        if (m.hp <= 0) {
          m.dead = 0; this.killed++;
          WAudio.at(this.w, [m.p[0], 1.2, m.p[2]], 'death');
          if (!this.alive()) WE.toast('Wszystkie potwory pokonane!', 3500);
        }
        return true;
      }
      return false;
    }

    update(dt) {
      const o = this.o, pl = this.w.player, eye = pl.pos;
      const pNode = o.nearestNode(eye);
      for (const m of this.list) {
        m.flash = Math.max(0, m.flash - dt * 4);
        if (m.dead >= 0) { m.dead += dt; continue; }
        const head = [m.p[0], 1.6, m.p[2]];
        const dist = WM.len(WM.sub(eye, head));
        const los = dist < 26 && o.los(head, eye);
        const mNode = o.nearestNode(m.p);
        let mv = [0, 0, 0];
        if (los || mNode === pNode) {
          // keep a fighting distance and strafe
          const f = [eye[0] - m.p[0], 0, eye[2] - m.p[2]], d = Math.hypot(f[0], f[2]) || 1;
          const dir = [f[0] / d, 0, f[2] / d], side = [-dir[2], 0, dir[0]];
          const want = d > 8 ? 1 : d < 4 ? -0.6 : 0;
          mv = WM.addScaled(WM.scale(dir, want), side, Math.sin(WE.time * 0.9 + m.ph) * 0.8);
          m.yaw = Math.atan2(dir[0], dir[2]);
        } else {
          const n = o.nodes[o.next[mNode][pNode]], f = [n[0] - m.p[0], 0, n[1] - m.p[2]], d = Math.hypot(f[0], f[2]);
          if (d > 0.05) { mv = [f[0] / d, 0, f[2] / d]; m.yaw = Math.atan2(mv[0], mv[2]); }
        }
        // metric speed is constant: in coordinates they are slower where space is stretched
        const sp = 2.3 * Math.exp(-o.metric([m.p[0], 1, m.p[2]])[3]);
        m.p = WM.addScaled(m.p, mv, sp * dt);
        // walls: push out of the static geometry (sphere at waist height)
        for (let it = 0; it < 2; it++) {
          const c = [m.p[0], 1.0, m.p[2]], d0 = o.sdf(c);
          if (d0 >= 0.45) break;
          const e = 0.02, gx = o.sdf([c[0] + e, 1, c[2]]) - d0, gz = o.sdf([c[0], 1, c[2] + e]) - d0, gl = Math.hypot(gx, gz) || 1;
          m.p[0] += gx / gl * (0.45 - d0); m.p[2] += gz / gl * (0.45 - d0);
        }
        // shoot
        m.cool -= dt;
        if (los && m.cool <= 0 && dist > 1.5) {
          m.cool = 1.4 + Math.random() * 1.6;
          let dir = WM.norm(WM.sub(eye, head));
          dir = WM.norm(WM.add(dir, [0, 1, 2].map(() => (Math.random() - 0.5) * 0.08)));
          this.shots.fire({ pos: WM.addScaled(head, dir, 0.3), dir });
          WAudio.at(this.w, head, 'enemy');
        }
      }
      // keep them apart
      for (const a of this.list) for (const b of this.list) {
        if (a === b || a.dead >= 0 || b.dead >= 0) continue;
        const d = [a.p[0] - b.p[0], 0, a.p[2] - b.p[2]], l = Math.hypot(d[0], d[2]);
        if (l < 1.1 && l > 1e-4) { a.p[0] += d[0] / l * (1.1 - l) * 0.5; a.p[2] += d[2] / l * (1.1 - l) * 0.5; }
      }
      this.list = this.list.filter(m => m.dead < 1.6);
      // enemy projectiles: fly, hit walls, hit the player
      this.shots.update(dt);
      for (const b of this.shots.list) {
        if (b.dead >= 0) continue;
        const q = this.shots.model.pos(b.s);
        if (capsuleDist(q, eye[0], eye[2], eye[1] - 1.5, eye[1]) < 0.4) { b.dead = 0; this.w.damage(8); }
      }
    }

    setUniforms(gl, p) {
      const a = new Float32Array(MAX * 4), s = new Float32Array(MAX * 4);
      this.list.slice(0, MAX).forEach((m, i) => {
        a.set([m.p[0], m.p[1], m.p[2], m.yaw], i * 4);
        s.set([m.hp / HP, m.flash, m.dead, m.type], i * 4);
      });
      gl.uniform4fv(p.u('uMon'), a);
      gl.uniform4fv(p.u('uMonS'), s);
      gl.uniform1i(p.u('uMonN'), Math.min(MAX, this.list.length));
    }
  }
  Horde.MAX = MAX;
  // Shared GLSL: blocky humanoid (feet at the origin, facing +z) and its colours.
  // st = (hp 0..1, hit flash, death time or -1, type: 0 orange zombie, 1 blue zombie, 2 the player, 3 the rival)
  Horde.GLSL = `
mat2 r2(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
// ids: 0 skin, 1 clothes, 2 eyes
vec2 zombie(vec3 q, vec4 st, float ph){
  if (st.z >= 0.) { q.yz = r2(-min(st.z*2.2, 1.45))*q.yz; q.y += max(st.z - .9, 0.)*1.2; }   // falls back, sinks
  float sw = st.z < 0. ? sin(ph)*.5 : 0.;
  vec3 l = q - vec3(.14,.85,0.); l.yz = r2(sw)*l.yz;
  vec3 l2 = q - vec3(-.14,.85,0.); l2.yz = r2(-sw)*l2.yz;
  float legs = min(sdBox(l - vec3(0,-.42,0), vec3(.1,.42,.1)), sdBox(l2 - vec3(0,-.42,0), vec3(.1,.42,.1)));
  float torso = sdBox(q - vec3(0,1.2,0), vec3(.27,.34,.15));
  vec3 a;
  if (st.w > 1.5) { a = q - vec3(0,1.2,0); a.x = abs(a.x) - .36; a.yz = r2(sw*.6)*a.yz; }   // player: arms swing
  else { a = q - vec3(0,1.42,.3); a.x = abs(a.x) - .36; a.y += sin(ph*.5)*.05*sign(q.x); }   // zombie: arms forward
  float arms = st.w > 1.5 ? sdBox(a, vec3(.08,.3,.08)) : sdBox(a, vec3(.08,.08,.3));
  float head = sdBox(q - vec3(0,1.75,.04), vec3(.17,.19,.17));
  vec3 e = q - vec3(0,1.78,.215); e.x = abs(e.x) - .075;
  vec2 r = vec2(min(legs, torso), 1.);
  r = opU(r, vec2(min(arms, head), 0.));
  r = opU(r, vec2(sdBox(e, vec3(.035,.025,.012)), 2.));
  return r;
}
vec3 zombieColor(float part, vec4 st, vec3 p, vec3 n, inout float emit){
  vec3 c;
  if (st.w > 2.5) c = part < .5 ? vec3(.9,.68,.52) : part < 1.5 ? vec3(.8,.14,.1) : vec3(.05);   // rival
  else if (st.w > 1.5) { c = part < .5 ? vec3(.95,.72,.55) : part < 1.5 ? vec3(.25,.45,.85) : vec3(.05); emit = .35; }
  else {
    c = part < .5 ? vec3(.33,.52,.28) : st.w < .5 ? vec3(.85,.4,.12) : vec3(.15,.32,.8);
    if (part > 1.5) { emit = 5.*(st.z < 0. ? 1. : 0.); c = st.w < .5 ? vec3(1.,.55,.1) : vec3(.2,.75,1.); }
  }
  c = mix(c, vec3(1.,.25,.2), st.y*.85);
  c *= 1. - .6*clamp(st.z, 0., 1.);
  return c*(.8 + .2*(1. - gridLines(p, n, 5.)));
}
`;
  window.WHorde = Horde;
})();
