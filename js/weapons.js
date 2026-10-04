// Pistol + projectiles. A projectile is a glowing point that follows the geodesics of the current space
// (plus a simplified gravity towards "down"). Each world picks a ballistic model matching its geometry;
// hits are detected with the same GPU distance probes as player collisions.
(function () {
  const MAX = WG.MAX_BULLETS, SUBSTEPS = 3;

  class Gun {
    constructor() { this.kick = 0; this.flash = 0; this.cool = 0; }
    update(dt) {
      this.kick = Math.max(0, this.kick - dt * 5);
      this.flash = Math.max(0, this.flash - dt * 16);
      this.cool -= dt;
    }
    tryFire() {
      if (this.cool > 0) return false;
      this.cool = 0.16; this.kick = 1; this.flash = 1;
      return true;
    }
    setUniforms(gl, p, show) {
      gl.uniform1f(p.u('uGunKick'), this.kick * (2 - this.kick) * 0.9);
      gl.uniform1f(p.u('uGunFlash'), this.flash);
      gl.uniform1f(p.u('uGunShow'), show ? 1 : 0);
    }
  }

  // ---- ballistic models: spawn(aim) -> state; step(state, dt); pos(state) -> array (3 or 4 numbers) ----
  const B = {};

  // Flat N-dimensional space (axis 1 = up), optional periodic wrap.
  B.flat = (n, o = {}) => ({
    radius: o.radius || 0.06, life: o.life || 5, hitScale: 1, gravity: o.gravity == null ? 6 : o.gravity,
    spawn(aim) { return { p: WM.addScaled(aim.pos, aim.dir, 0.35), v: WM.scale(aim.dir, o.speed || 32) }; },
    step(s, dt) {
      s.v[1] -= (o.gravity == null ? 6 : o.gravity) * dt;
      const prev = s.p;
      s.p = WM.addScaled(s.p, s.v, dt);
      // seamless portals: cross(a, b) returns the offset of a portal crossed between a and b
      if (o.cross) { const off = o.cross(prev, s.p); if (off) s.p = WM.add(s.p, off); }
      if (o.wrap) for (let i = 0; i < n; i++) s.p[i] -= o.wrap[i] * Math.floor(s.p[i] / o.wrap[i] + 0.5);
    },
    pos: s => s.p,
  });

  // Constant curvature K (S3 / H3): exact geodesic flow on the sphere / hyperboloid, gravity pulls towards y=0.
  B.curved = (K, o = {}) => {
    const up = p => { // unit tangent at p pointing away from the floor plane y=0
      const v = [0, 1, 0, 0], k = WM.kdot(K, v, p);
      const t = WM.addScaled(v, p, -K * k);
      return WM.scale(t, 1 / Math.sqrt(Math.max(1e-9, WM.kdot(K, t, t))));
    };
    return {
      radius: o.radius || 0.008, life: o.life || 8, hitScale: 1,
      spawn(aim) { return { p: aim.pos.slice(), v: WM.scale(aim.dir, o.speed || 1.6) }; },
      step(s, dt) {
        s.v = WM.addScaled(s.v, up(s.p), -(o.gravity == null ? 0.25 : o.gravity) * dt);
        const sp = Math.sqrt(Math.max(1e-12, WM.kdot(K, s.v, s.v))), u = WM.scale(s.v, 1 / sp), d = sp * dt;
        const c = WM.kcos(K, d), sn = WM.ksin(K, d);
        const p = WM.addScaled(WM.scale(s.p, c), u, sn);
        const nu = WM.addScaled(WM.scale(u, c), s.p, -K * sn);
        // re-normalise onto the manifold and its tangent space
        const pn = WM.scale(p, 1 / Math.sqrt(Math.abs(WM.kdot(K, p, p))));
        let v = WM.scale(nu, sp);
        v = WM.addScaled(v, pn, -K * WM.kdot(K, v, pn));
        s.p = pn; s.v = v;
      },
      pos: s => s.p,
      // apply a global isometry (used when the hyperbolic world re-centres the player)
      transform(s, f) { s.p = f(s.p); s.v = f(s.v); },
    };
  };

  // Conformally flat metric g = e^{2 phi} * euclidean. metric(p) -> [gx, gy, gz, phi].
  // Geodesic equation: x'' = -2 (grad phi . x') x' + |x'|^2 grad phi   (+ gravity)
  B.conformal = (metric, o = {}) => ({
    radius: o.radius || 0.06, life: o.life || 6, hitScale: 1,
    spawn(aim) {
      const p = WM.addScaled(aim.pos, aim.dir, 0.35), m = metric(p);
      return { p, v: WM.scale(aim.dir, (o.speed || 18) * Math.exp(-m[3])) };
    },
    step(s, dt) {
      // adaptive sub-steps: the path may turn by ~0.05 rad per sub-step
      const m0 = metric(s.p), n = Math.min(60, Math.max(2, Math.ceil(WM.len(s.v) * dt * (Math.hypot(m0[0], m0[1], m0[2]) + 0.3) / 0.05)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const m = i ? metric(s.p) : m0, g = [m[0], m[1], m[2]];
        const gu = WM.dot(g, s.v), uu = WM.dot(s.v, s.v);
        const a = [0, 1, 2].map(k => -2 * gu * s.v[k] + uu * g[k]);
        a[1] -= (o.gravity == null ? 5 : o.gravity) * Math.exp(-2 * m[3]);
        s.v = WM.addScaled(s.v, a, h);
        s.p = WM.addScaled(s.p, s.v, h);
      }
    },
    pos: s => s.p,
  });

  class Bullets {
    constructor(model, opts = {}) { this.model = model; this.opts = opts; this.list = []; }
    clear() { this.list = []; }
    fire(aim) {
      if (this.list.length >= MAX) this.list.shift();
      this.list.push({ s: this.model.spawn(aim), age: 0, dead: -1, born: WE.time, deathT: 1e9 });
    }
    transform(f) { if (this.model.transform) for (const b of this.list) this.model.transform(b.s, f); }
    update(dt) {
      const m = this.model, live = this.list.filter(b => b.dead < 0).slice(-Math.floor(64 / SUBSTEPS));
      if (live.length) {
        // advance in sub-steps and probe every sub-step position, so fast bullets do not tunnel through walls
        const path = live.map(b => {
          const pts = [];
          for (let i = 0; i < SUBSTEPS; i++) { m.step(b.s, dt / SUBSTEPS); pts.push({ p: m.pos(b.s).slice(), s: JSON.parse(JSON.stringify(b.s)) }); }
          b.age += dt;
          return pts;
        });
        const d = WE.probe(path.flat().map(x => x.p));
        live.forEach((b, i) => {
          for (let k = 0; k < SUBSTEPS; k++) {
            // targets (monsters, the player) first: they are part of the distance field too
            if (this.opts.hitTest && this.opts.hitTest(path[i][k].p)) {
              b.s = path[i][k].s; b.dead = 0;
              if (window.WAudio) WAudio.impact(WE.world, m.pos(b.s));
              return;
            }
            if (d[i * SUBSTEPS + k] < m.radius) {
              b.s = path[i][k].s; b.dead = 0;
              if (window.WAudio) WAudio.impact(WE.world, m.pos(b.s));
              return;
            }
          }
          if (b.age > m.life) b.dead = 0;
          // a bullet that came all the way around the world and hits its shooter
          if (this.opts.selfDist && b.age > 0.4 && this.opts.selfDist(m.pos(b.s)) < 0) {
            b.dead = 0;
            WE.hurt('Trafiłeś sam siebie!');
          }
        });
      }
      for (const b of this.list) {
        if (b.dead >= 0) { if (b.deathT > 1e8) b.deathT = WE.time; b.dead += dt; }
      }
      // with a finite speed of light a finished bullet stays "visible" until its last light reaches the player
      const linger = this.opts.linger ? this.opts.linger() : 0.3;
      this.list = this.list.filter(b => b.dead < linger);
    }
    // Writes this list into the shader arrays starting at `offset`; returns the new offset.
    // `type` (3D worlds only) goes to the 4th component: 0 = player bullet, 1 = enemy projectile.
    pack(pos, rad, offset, type) {
      const r0 = this.model.radius;
      for (const b of this.list) {
        if (offset >= MAX) break;
        const q = this.model.pos(b.s);
        for (let k = 0; k < 4; k++) pos[offset * 4 + k] = q[k] || 0;
        if (type != null) pos[offset * 4 + 3] = type;
        // an impact flashes up and fades
        rad[offset] = b.dead < 0 ? r0 : r0 * (1 + 14 * b.dead) * Math.max(0.05, 1 - b.dead / 0.3);
        offset++;
      }
      return offset;
    }
    static upload(gl, p, lists) {
      const pos = new Float32Array(MAX * 4), rad = new Float32Array(MAX);
      let n = 0;
      for (const [list, type] of lists) n = list.pack(pos, rad, n, type);
      gl.uniform4fv(p.u('uBullets'), pos);
      gl.uniform1fv(p.u('uBulletR'), rad);
      gl.uniform1i(p.u('uBulletN'), n);
    }
    // For the 4D and curved kernels (all 4 components are the position): enemy projectiles get a negative radius.
    static uploadSigned(gl, p, lists) {
      const pos = new Float32Array(MAX * 4), rad = new Float32Array(MAX);
      let n = 0;
      for (const [list, enemy] of lists) {
        const n0 = n;
        n = list.pack(pos, rad, n, null);
        if (enemy) for (let i = n0; i < n; i++) rad[i] = -rad[i];
      }
      gl.uniform4fv(p.u('uBullets'), pos);
      gl.uniform1fv(p.u('uBulletR'), rad);
      gl.uniform1i(p.u('uBulletN'), n);
    }
    setUniforms(gl, p) { Bullets.upload(gl, p, [[this, null]]); }
    // For worlds that render with retarded time (RETARDED kernel): per bullet its current (or death) position,
    // velocity, birth time, death time, reference time of that position and gravity. The shader evaluates
    // pos(T) = p + v τ - g τ²/2 ŷ with τ = min(T, death) - ref at each ray point's emission time T, and the flash.
    static uploadRetarded(gl, p, lists) {
      const pos = new Float32Array(MAX * 4), rad = new Float32Array(MAX), vel = new Float32Array(MAX * 4), tt = new Float32Array(MAX * 4);
      let n = 0;
      for (const [list, type] of lists) for (const b of list.list) {
        if (n >= MAX) break;
        const q = list.model.pos(b.s), v = b.s.v || [0, 0, 0];
        pos.set([q[0], q[1], q[2], type], n * 4);
        rad[n] = list.model.radius;
        vel.set([v[0], v[1], v[2], b.born], n * 4);
        tt.set([b.deathT, Math.min(WE.time, b.deathT), list.model.gravity || 0, 0], n * 4);
        n++;
      }
      gl.uniform4fv(p.u('uBullets'), pos);
      gl.uniform1fv(p.u('uBulletR'), rad);
      gl.uniform4fv(p.u('uBulletV'), vel);
      gl.uniform4fv(p.u('uBulletT'), tt);
      gl.uniform1i(p.u('uBulletN'), n);
    }
  }

  window.WGun = new Gun();
  window.WBallistics = B;
  window.WBullets = Bullets;
})();
