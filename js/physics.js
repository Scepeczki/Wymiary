// Generic N-dimensional FPS controller for flat worlds (3D, 4D).
// Axis 1 is always "up". The horizontal frame spans all other axes: [right, forward, ana1, ana2...].
// Collision: a capsule made of spheres, resolved against the world's distance field via GPU probes.
(function () {
  // body spheres (offsets below the eye); the lowest one floats above the feet so low steps are climbed
  // by the ground probe (anything up to STEP high with a floor-like normal).
  const EYE = 1.6, RADIUS = 0.33, SPHERES = [0.25, 0.8, 1.05], STEP = 0.45, H = 0.01;

  class Player {
    constructor(n, opts = {}) {
      this.n = n;
      this.opts = Object.assign({ speed: 5, run: 9.5, jump: 7.2, gravity: 20, respawnY: -60 }, opts);
      this.noclip = false;
      this.reset(opts.spawn || [0, EYE, 0], opts.yaw || 0);
    }
    reset(pos, yaw = 0) {
      const n = this.n;
      this.pos = pos.slice(); while (this.pos.length < n) this.pos.push(0);
      this.vel = WM.vec(n);
      this.pitch = 0;
      // horizontal frame: axes other than 1
      const horiz = [0, 2, 3, 4].filter(a => a < n);
      this.frame = horiz.map(a => { const v = WM.vec(n); v[a] = 1; return v; });
      WM.rotFrame(this.frame, 1, 0, yaw); // yaw: forward towards right
      this.grounded = false; this.flying = false;
      this.snap = null;                        // probes of another place
    }
    get right() { return this.frame[0]; }
    get forward() { return this.frame[1]; }
    up() { const u = WM.vec(this.n); u[1] = 1; return u; }

    // camera vectors including pitch
    camera() {
      const u = this.up(), f = this.forward, c = Math.cos(this.pitch), s = Math.sin(this.pitch);
      return {
        pos: this.pos,
        right: this.right,
        up: WM.addScaled(WM.scale(u, c), f, -s),
        fwd: WM.addScaled(WM.scale(f, c), u, s),
      };
    }

    // look = {dx, dy}; rot = list of [frameA, frameB, keyNeg, keyPos] extra rotations; moves = [frameIdx, keyNeg, keyPos]
    update(dt, look, extra = {}) {
      const E = WE, o = this.opts, n = this.n;
      // mouse look
      WM.rotFrame(this.frame, 1, 0, look.dx);
      this.pitch = WM.clamp(this.pitch - look.dy, -1.55, 1.55);
      for (const [a, b, kn, kp] of extra.rot || []) {
        const r = E.axis(kn, kp);
        if (r) WM.rotFrame(this.frame, a, b, r * dt * 1.2);
      }
      WM.orthonormalize(this.frame, this.frame.map((_, i) => i));

      // wish direction
      let wish = WM.vec(n);
      wish = WM.addScaled(wish, this.right, E.axis('KeyA', 'KeyD'));
      wish = WM.addScaled(wish, this.forward, E.axis('KeyS', 'KeyW'));
      for (const [fi, kn, kp] of extra.moves || []) wish = WM.addScaled(wish, this.frame[fi], E.axis(kn, kp));
      const wl = WM.len(wish);
      if (wl > 1) wish = WM.scale(wish, 1 / wl);
      const speed = (E.keys.ShiftLeft || E.keys.ShiftRight ? o.run : o.speed) * (o.speedAt ? o.speedAt(this.pos) : 1);

      if (this.noclip) {
        const c = this.camera();
        let w = WM.scale(c.right, E.axis('KeyA', 'KeyD'));
        w = WM.addScaled(w, c.fwd, E.axis('KeyS', 'KeyW'));
        w = WM.addScaled(w, this.up(), E.axis('ControlLeft', 'Space'));
        for (const [fi, kn, kp] of extra.moves || []) w = WM.addScaled(w, this.frame[fi], E.axis(kn, kp));
        this.prev = this.pos.slice();
        this.pos = WM.addScaled(this.pos, w, speed * 1.5 * dt);
        this.vel = WM.vec(n);
        return;
      }

      // mouse wheel: fly up / down — while flying there is no gravity, the vertical speed dies out (you hover)
      // and you land as soon as you touch the floor again
      const fi = WM.clamp(E.takeFly ? E.takeFly() : 0, -3, 3);
      if (fi) { this.flying = true; this.vel[1] = WM.clamp(this.vel[1] + fi * 2.5, -9, 9); }
      // horizontal velocity towards wish
      const accel = this.grounded || this.flying ? 14 : 3;
      const k = 1 - Math.exp(-accel * dt);
      for (let i = 0; i < n; i++) if (i !== 1) this.vel[i] += (wish[i] * speed - this.vel[i]) * k;
      // SpaceMouse lifted / pushed down (analog moveZ): fly at that speed
      const az = E.analog.moveZ || 0;
      if (Math.abs(az) > 0.02 && !(this.grounded && az < 0)) { this.flying = true; this.vel[1] += (az * speed - this.vel[1]) * k; }
      else if (this.flying) this.vel[1] *= Math.exp(-dt * 1.2);
      else this.vel[1] -= o.gravity * dt;
      if (this.grounded && E.keys.Space) { this.vel[1] = o.jump; this.grounded = false; this.flying = false; }

      // integrate with substeps
      this.prev = this.pos.slice();
      const steps = Math.max(1, Math.ceil(WM.len(this.vel) * dt / 0.25));
      this.grounded = false;
      for (let s = 0; s < steps; s++) {
        const before = this.pos.slice();
        this.pos = WM.addScaled(this.pos, this.vel, dt / steps);
        if (this.onStep) this.onStep(before, this.pos);
        this.collide();
      }
      if (this.flying && this.grounded && this.vel[1] <= 0.5) this.flying = false;   // landed
      if (this.pos[1] < o.respawnY) { this.reset(o.spawn || [0, EYE, 0]); E.toast('Respawn'); }
      this.probeAhead();
    }

    // the body's probe points at pos: the sphere centres, then the foot; each followed by n points H further along
    // each axis (the gradient)
    bodyPoints(pos) {
      const n = this.n, out = [];
      const foot = pos.slice(); foot[1] -= EYE - STEP;
      for (const c of [...SPHERES.map(off => { const c = pos.slice(); c[1] -= off; return c; }), foot]) {
        out.push(c);
        for (let a = 0; a < n; a++) { const q = c.slice(); q[a] += H; out.push(q); }
      }
      return out;
    }

    // Collision against the distance field. Normally (WE.asyncProbes) with the probes of the previous frame: the
    // distance at the body point now is extrapolated from where it was measured, d + n·(now − then) — exact for flat
    // walls and floors, and the next frame measures again. Waits for the GPU (WE.probe) only without a recent
    // measurement (first frame, respawn, a jump of more than 1 m).
    collide() {
      const n = this.n, s = this.snap;
      const lagged = WE.asyncProbes && s && WE.time - s.t < 0.25 && WM.len(WM.sub(this.pos, s.pos)) < 1;
      for (let iter = 0; iter < 2; iter++) {
        const pts = this.bodyPoints(this.pos), src = lagged ? s.pts : pts, d = lagged ? s.d : WE.probe(pts);
        // distance and outward normal at body point i
        const at = i => {
          const base = i * (n + 1), g = WM.vec(n);
          for (let a = 0; a < n; a++) g[a] = (d[base + 1 + a] - d[base]) / H;
          const l = WM.len(g);
          if (l < 1e-6) return null;
          const u = WM.scale(g, 1 / l);
          return { d: lagged ? d[base] + WM.dot(u, WM.sub(pts[base], src[base])) : d[base], g: u };
        };
        let moved = false;
        for (let si = 0; si < SPHERES.length; si++) {
          const f = at(si);
          if (!f || !(f.d < RADIUS)) continue;
          this.pos = WM.addScaled(this.pos, f.g, RADIUS - f.d);
          const vn = WM.dot(this.vel, f.g);
          if (vn < 0) this.vel = WM.addScaled(this.vel, f.g, -vn);
          if (f.g[1] > 0.55) this.grounded = true;
          moved = true;
        }
        // ground probe: keeps the feet on the floor and climbs steps
        const f = at(SPHERES.length);
        if (f && f.d < STEP + 0.03 && this.vel[1] <= 0.5 && f.g[1] > 0.6) {
          if (f.d < STEP) { this.pos[1] += STEP - f.d; moved = true; }
          if (this.vel[1] < 0) this.vel[1] = 0;
          this.grounded = true;
        }
        if (!moved) break;
      }
    }
    // measure the field around the body where it ended this frame (the result is used in a later frame)
    probeAhead() {
      if (!WE.asyncProbes) return;
      const pos = this.pos.slice(), pts = this.bodyPoints(pos), t = WE.time;
      WE.probeLater(pts, d => { this.snap = { pts, d, pos, t }; });
    }

    // uniforms for the 3D Euclidean kernel
    setUniforms3(gl, p, posOverride) {
      const c = this.camera(), pos = posOverride || c.pos;
      gl.uniform3f(p.u('uCamPos'), pos[0], pos[1], pos[2]);
      gl.uniformMatrix3fv(p.u('uCamRot'), false, new Float32Array([...c.right, ...c.up, ...c.fwd]));
    }
    // uniforms for the 4D kernel
    setUniformsND(gl, p) {
      const c = this.camera();
      gl.uniform4fv(p.u('uPos'), c.pos);
      gl.uniformMatrix3x4fv(p.u('uBasis'), false, new Float32Array([...c.right, ...c.up, ...c.fwd]));
    }
    aim() { const c = this.camera(); return { pos: c.pos.slice(), dir: c.fwd.slice() }; }
  }
  Player.EYE = EYE;

  // Key handler shared by all worlds: N toggles noclip.
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyN' && !e.repeat && WE.world && WE.world.player && 'noclip' in WE.world.player) {
      WE.world.player.noclip = !WE.world.player.noclip;
      WE.toast(WE.world.player.noclip ? 'Noclip: WŁ' : 'Noclip: WYŁ');
    }
  });

  window.WPlayer = Player;
})();

// Player for constant-curvature spaces (K=+1: S3, K=-1: H3). The floor is the totally geodesic
// surface y=0; the frame M only ever acts on (x, z, w), so walking never changes the height above it.
(function () {
  class CurvedPlayer {
    constructor(K, opts = {}) {
      this.K = K;
      this.opts = Object.assign({ eye: 0.18, radius: 0.05, speed: 0.35, run: 0.8, jump: 0.9, gravity: 3.2 }, opts);
      this.noclip = false;
      this.reset();
    }
    reset() {
      this.M = WM.ident(4);
      this.h = this.opts.eye; this.vh = 0; this.pitch = 0; this.flying = false;
    }
    // point at local (horizontal x, height, horizontal z) relative to the player's feet
    local(x, y, z) {
      const K = this.K;
      let m = WM.mulMat(this.M, WM.ktrans(K, 0, x));
      m = WM.mulMat(m, WM.ktrans(K, 2, z));
      m = WM.mulMat(m, WM.ktrans(K, 1, y));
      return m[3];
    }
    camera() {
      let m = WM.mulMat(this.M, WM.ktrans(this.K, 1, this.h));
      return WM.mulMat(m, WM.planeRot(4, 2, 1, this.pitch));
    }
    move(dx, dz) {
      const K = this.K;
      this.M = WM.mulMat(this.M, WM.ktrans(K, 0, dx));
      this.M = WM.mulMat(this.M, WM.ktrans(K, 2, dz));
    }
    update(dt, look) {
      const E = WE, o = this.opts, K = this.K;
      this.M = WM.mulMat(this.M, WM.planeRot(4, 2, 0, look.dx));
      this.pitch = WM.clamp(this.pitch - look.dy, -1.55, 1.55);
      const sp = (E.keys.ShiftLeft || E.keys.ShiftRight ? o.run : o.speed) * dt;
      let mx = E.axis('KeyA', 'KeyD'), mz = E.axis('KeyS', 'KeyW');
      const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
      this.move(mx * sp, mz * sp);

      if (this.noclip) this.h = Math.max(0.02, this.h + E.axis('ControlLeft', 'Space') * sp);
      else {
        // mouse wheel: fly up / down (hover, land on the floor) — speeds in metres scaled to this world's units
        const unit = o.eye / 1.6, fi = WM.clamp(E.takeFly ? E.takeFly() : 0, -3, 3);
        if (fi) { this.flying = true; this.vh = WM.clamp(this.vh + fi * 2.5 * unit, -9 * unit, 9 * unit); }
        const ground = this.h <= o.eye + 1e-4;
        if (ground && E.keys.Space) { this.vh = o.jump; this.flying = false; }
        const az = E.analog.moveZ || 0;                // SpaceMouse lifted / pushed down: fly at that speed
        if (Math.abs(az) > 0.02 && !(ground && az < 0)) { this.flying = true; this.vh += (az * 5 * unit - this.vh) * (1 - Math.exp(-14 * dt)); }
        else if (this.flying) this.vh *= Math.exp(-dt * 1.2);
        else this.vh -= o.gravity * dt;
        this.h += this.vh * dt;
        const top = K > 0 ? 1.3 : 2.5;
        if (this.h > top) { this.h = top; this.vh = Math.min(this.vh, 0); }
        if (this.h < o.eye) { this.h = o.eye; this.vh = 0; this.flying = false; }
        this.collide();
      }
      if (this.onMoved) this.onMoved();
      WM.korthonormalize(K, this.M);
    }
    collide() {
      const e = 0.004, o = this.opts, hb = Math.max(o.radius, this.h - o.eye * 0.5);
      for (let it = 0; it < 2; it++) {
        const d = WE.probe([this.local(0, hb, 0), this.local(e, hb, 0), this.local(0, hb, e)]);
        if (!(d[0] < o.radius)) return;
        let gx = (d[1] - d[0]) / e, gz = (d[2] - d[0]) / e;
        const gl = Math.hypot(gx, gz);
        if (gl < 1e-6) return;
        gx /= gl; gz /= gl;
        this.move(gx * (o.radius - d[0]), gz * (o.radius - d[0]));
      }
    }
    setUniforms(gl, p) {
      gl.uniformMatrix4fv(p.u('uCam'), false, WM.flat(this.camera()));
      gl.uniform4fv(p.u('uLight'), this.local(0, this.h + 0.15, 0.05));
    }
    aim() { const c = this.camera(); return { pos: c[3].slice(), dir: c[2].slice() }; }
  }
  window.WCurvedPlayer = CurvedPlayer;
})();
