// Monsters for the "pure geometry" maps (3-torus, 4D, H³, S³) — the same blocky zombies as in the corridor
// building, but walking in whatever space the map is: in the 3-torus you meet endless copies of them, in 4D they
// come at you through the W axis, in H³/S³ they walk and shoot along geodesics. Played in waves.
//
// A "space" adapter hides the geometry. Each monster keeps its own frame (right, up, forward [, ana]) at its feet;
// the AI works only with LOCAL coordinates in metres (x right, y up, z forward, a = ana in 4D), which the adapter
// computes exactly (log map in curved space). Obstacles and line of sight use the GPU distance probes.
(function () {
  const MAX = 8, HP = 100;
  const SEG0 = 0.25, SEG1 = 1.65, BODY_R = 0.42, HALF_ANA = 0.35;   // hit capsule above the feet (metres)
  const add = (a, b) => a.map((x, i) => x + b[i]), sub = (a, b) => a.map((x, i) => x - b[i]);
  const sc = (a, s) => a.map(x => x * s), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const len = a => Math.sqrt(dot(a, a)), nrm = a => sc(a, 1 / (len(a) || 1));

  const S = {};
  // ---- flat 3D, periodic (the 3-torus). Monster: feet p (y fixed), yaw (forward = (sin, 0, cos)). ----
  S.torus = per => ({
    m: 1, kind: 'yaw',
    wrapD: d => d.map((x, i) => x - per[i] * Math.floor(x / per[i] + 0.5)),
    axes(g) { const s = Math.sin(g.yaw), c = Math.cos(g.yaw); return [[c, 0, -s], [s, 0, c]]; },
    place(pos, yaw) { return { p: pos.slice(), yaw }; },
    rel(g, pt) { const d = this.wrapD(sub(pt, g.p)), [R, F] = this.axes(g); return [dot(d, R), d[1], dot(d, F), 0]; },
    point(g, l) { const [R, F] = this.axes(g); return add(add(add(g.p, sc(R, l[0])), [0, l[1], 0]), sc(F, l[2])); },
    walk(g, v) {
      const [R, F] = this.axes(g);
      g.p = add(g.p, add(sc(R, v[0]), sc(F, v[1])));
      for (const i of [0, 2]) g.p[i] -= per[i] * Math.floor(g.p[i] / per[i] + 0.5);
    },
    turn(g, l, k) { g.yaw += Math.atan2(l[0], l[2]) * k; },
    dist(a, b) { return len(this.wrapD(sub(a, b))); },
    lerp(a, b, t) { return add(a, sc(this.wrapD(sub(b, a)), t)); },
    aim(from, to, jit) { return { pos: from, dir: nrm(add(nrm(this.wrapD(sub(to, from))), [0, 1, 2].map(() => (Math.random() - 0.5) * jit))) }; },
    pack(g, i, buf) { buf.pos.set([g.p[0], g.p[1], g.p[2], g.yaw], i * 4); },
  });

  // ---- flat 4D. Monster: feet p (y = 0) and a horizontal frame R, F, A in (x, z, w). ----
  S.flat4 = () => ({
    m: 1, kind: 'mat', ana: true,
    place(pos, fwd) {
      const g = { p: pos.slice(), F: nrm([fwd[0], 0, fwd[2], fwd[3]]) };
      this.ortho(g, [1, 0, 0, 0], [0, 0, 0, 1]);
      return g;
    },
    ortho(g, r0, a0) {   // Gram-Schmidt: forward first, then right, then ana
      g.F = nrm(g.F);
      let R = r0 || g.R; R = sub(R, sc(g.F, dot(R, g.F)));
      if (len(R) < 1e-3) R = sub([0, 0, 1, 0], sc(g.F, g.F[2]));
      g.R = nrm(R);
      let A = a0 || g.A; A = sub(sub(A, sc(g.F, dot(A, g.F))), sc(g.R, dot(A, g.R)));
      if (len(A) < 1e-3) { A = [0, 0, 0, 1]; A = sub(sub(A, sc(g.F, dot(A, g.F))), sc(g.R, dot(A, g.R))); }
      g.A = nrm(A);
    },
    rel(g, pt) { const d = sub(pt, g.p); return [dot(d, g.R), d[1], dot(d, g.F), dot(d, g.A)]; },
    point(g, l) { return add(add(add(add(g.p, sc(g.R, l[0])), [0, l[1], 0, 0]), sc(g.F, l[2])), sc(g.A, l[3] || 0)); },
    walk(g, v) { g.p = add(add(add(g.p, sc(g.R, v[0])), sc(g.F, v[1])), sc(g.A, v[2] || 0)); g.p[1] = 0; },
    turn(g, l, k) {
      const t = nrm(add(add(sc(g.R, l[0]), sc(g.F, l[2])), sc(g.A, l[3] || 0)));
      const c = WM.clamp(dot(g.F, t), -1, 1), th = Math.acos(c);
      if (th < 1e-4) return;
      let perp = sub(t, sc(g.F, c));
      perp = len(perp) < 1e-4 ? g.R : nrm(perp);
      g.F = add(sc(g.F, Math.cos(th * k)), sc(perp, Math.sin(th * k)));
      this.ortho(g);
    },
    dist: (a, b) => len(sub(a, b)),
    lerp: (a, b, t) => add(a, sc(sub(b, a), t)),
    aim: (from, to, jit) => ({ pos: from, dir: nrm(add(nrm(sub(to, from)), [0, 1, 2, 3].map(() => (Math.random() - 0.5) * jit))) }),
    pack(g, i, buf) { buf.mat.set([...g.R, 0, 1, 0, 0, ...g.F, ...g.p], i * 16); buf.ana.set(g.A, i * 4); },
  });

  // ---- constant curvature K (S³ / H³). Monster: frame columns [R, U, F, P] (P on the floor plane y = 0). ----
  // m = world units per metre (the player's eye height / 1.6 m).
  S.curved = (K, m) => {
    const kd = (a, b) => WM.kdot(K, a, b), C = t => WM.kcos(K, t), Sn = t => WM.ksin(K, t);
    const dist = (a, b) => K > 0 ? Math.acos(WM.clamp(kd(a, b), -1, 1)) : Math.acosh(Math.max(1, -kd(a, b)));
    const dirTo = (a, b) => { const v = sub(b, sc(a, K * kd(a, b))); return sc(v, 1 / Math.sqrt(Math.max(1e-12, kd(v, v)))); };
    const along = (p, T, s) => add(sc(p, C(s)), sc(T, Sn(s)));
    return {
      m, kind: 'mat',
      place(M) { return { M: WM.cloneMat(M) }; },
      rel(g, pt) {
        const [R, U, F, P] = g.M, c = [kd(pt, R), kd(pt, U), kd(pt, F)], l = len(c), d = dist(pt, P);
        return l < 1e-9 ? [0, 0, 0, 0] : [...sc(c, d / l / m), 0];
      },
      point(g, l) {
        const [R, U, F, P] = g.M, v = add(add(sc(R, l[0]), sc(U, l[1])), sc(F, l[2])), s = len([l[0], l[1], l[2]]) * m;
        return s < 1e-9 ? P.slice() : along(P, sc(v, m / s), s);
      },
      walk(g, v) {
        const [R, U, F, P] = g.M, s = Math.hypot(v[0], v[1]) * m;
        if (s < 1e-9) return;
        const T = nrm(add(sc(R, v[0]), sc(F, v[1]))), T2 = add(sc(P, -K * Sn(s)), sc(T, C(s)));
        const tr = e => { const a = kd(e, T); return add(sub(e, sc(T, a)), sc(T2, a)); };
        g.M = [tr(R), U, tr(F), along(P, T, s)];
        WM.korthonormalize(K, g.M);
      },
      turn(g, l, k) {
        const a = Math.atan2(l[0], l[2]) * k, [R, U, F, P] = g.M, c = Math.cos(a), s = Math.sin(a);
        g.M = [sub(sc(R, c), sc(F, s)), U, add(sc(F, c), sc(R, s)), P];
      },
      dist,
      lerp(a, b, t) { const d = dist(a, b); return d < 1e-9 ? a.slice() : along(a, dirTo(a, b), d * t); },
      aim(from, to, jit) {
        let v = add(dirTo(from, to), [0, 1, 2, 3].map(() => (Math.random() - 0.5) * jit));
        v = sub(v, sc(from, K * kd(v, from)));
        return { pos: from, dir: sc(v, 1 / Math.sqrt(Math.max(1e-12, kd(v, v)))) };
      },
      transform(g, f) { g.M = g.M.map(f); },
      pack(g, i, buf) { buf.mat.set(g.M.flat(), i * 16); },
    };
  };

  class Swarm {
    // world: { player, damage(n), playerPoints() -> { eye, body: [points] }, spawn(i, wave) -> geometry (space.place) }
    // o: { range (m), shotModel (WBallistics…), avoid(g) -> local push [x, z] (optional, CPU-only obstacles) }
    constructor(world, space, o = {}) {
      this.w = world; this.sp = space; this.o = Object.assign({ range: 26 }, o);
      this.list = []; this.wave = 0; this.kills = 0; this.best = 0; this.nextT = -1; this.losTurn = 0;
      this.shots = new WBullets(o.shotModel, {});
      Swarm.attach(world, this);
    }
    // start (or restart) the game from wave 1; on = false: no monsters (exploring)
    start(on) {
      this.on = on; this.list = []; this.shots.clear(); this.wave = 0; this.kills = 0; this.nextT = -1;
      if (on) this.nextWave();
    }
    nextWave() {
      this.wave++;
      const n = Math.min(MAX, 1 + this.wave);
      this.list = [];
      for (let i = 0; i < n; i++) this.list.push({
        slot: i, g: this.w.spawn(i, this.wave), hp: HP, type: i % 2, cool: 2.5 + Math.random() * 2.5,
        flash: 0, dead: -1, ph: Math.random() * 6, los: false, push: null, alert: false,
      });
      this.total = n;
      WE.toast(this.wave === 1 ? `Fala 1 — potwory: ${n}` : `Fala ${this.wave} — potwory: ${n}`, 2500);
    }
    alive() { return this.list.filter(m => m.dead < 0).length; }

    hitTest(q) {
      const sp = this.sp;
      for (const m of this.list) {
        if (m.dead >= 0 || sp.dist(q, m.g.p || m.g.M[3]) / sp.m > 2.6) continue;
        const l = sp.rel(m.g, q);
        if (Math.hypot(l[0], l[1] - WM.clamp(l[1], SEG0, SEG1), l[2]) > BODY_R || Math.abs(l[3]) > HALF_ANA) continue;
        m.hp -= 34; m.flash = 1; m.alert = true;
        if (m.hp <= 0) {
          m.dead = 0; this.kills++;
          WAudio.at(this.w, sp.point(m.g, [0, 1.2, 0, 0]), 'death');
          if (!this.alive()) { WE.toast(`Fala ${this.wave} pokonana!`, 2500); this.nextT = 3.5; this.best = Math.max(this.best, this.wave); }
        }
        return true;
      }
      return false;
    }

    update(dt) {
      if (!this.on) return;
      const sp = this.sp, W = this.w, pp = W.playerPoints(), eye = pp.eye, hard = 1 + 0.07 * (this.wave - 1);
      if (this.nextT > 0 && (this.nextT -= dt) <= 0) this.nextWave();
      const live = this.list.filter(m => m.dead < 0);
      for (const m of this.list) { m.flash = Math.max(0, m.flash - dt * 4); if (m.dead >= 0) m.dead += dt; }

      for (const m of live) {
        const head = sp.point(m.g, [0, 1.6, 0, 0]);
        const l = sp.rel(m.g, eye), d = Math.hypot(l[0], l[2], l[3]);
        const seen = m.los && d < this.o.range;
        if (seen) m.alert = true;
        let v = [0, 0, 0];
        if (m.alert && d < this.o.range * 1.4) {
          // face the player, keep a fighting distance and strafe (in 4D partly through W)
          sp.turn(m.g, l, Math.min(1, dt * 5));
          const want = d > 9 ? 1 : d < 4 ? -0.6 : 0, s = Math.sin(WE.time * 0.9 + m.ph) * 0.8;
          v = sp.ana ? [s * Math.cos(m.ph), want, s * Math.sin(m.ph)] : [s, want, 0];
          if (!seen) v = [0, 1, 0];
        } else {
          // not noticed yet: wander towards the player
          sp.turn(m.g, [l[0] + Math.sin(WE.time * 0.3 + m.ph) * 3, 0, l[2], l[3]], Math.min(1, dt * 0.8));
          v = [0, 0.6, 0];
        }
        if (m.push) v = add(v, m.push);
        const spd = 2.3 * hard * dt;
        sp.walk(m.g, sc(v, spd));
        if (this.o.avoid) { const a = this.o.avoid(m.g); if (a) sp.walk(m.g, a); }
        // shoot
        m.cool -= dt;
        if (seen && m.cool <= 0 && d > 1.5) {
          m.cool = (1.8 + Math.random() * 1.8) / hard;
          this.shots.fire(sp.aim(head, eye, 0.12 / Math.sqrt(hard)));
          WAudio.at(W, head, 'enemy');
        }
      }
      // keep them apart
      for (const a of live) for (const b of live) {
        if (a === b) continue;
        const l = sp.rel(a.g, sp.point(b.g, [0, 0, 0, 0])), h = Math.hypot(l[0], l[2], l[3]);
        if (h < 1.1 && h > 1e-4) sp.walk(a.g, sc([l[0], l[2], l[3]], -(1.1 - h) * 0.5 / h));
      }
      this.list = this.list.filter(m => m.dead < 1.6);

      // GPU probes: obstacle push at the waist (+ gradient), line of sight for two monsters per frame
      const e = 0.12, pts = [], plan = [];
      for (const m of live) {
        const o = pts.length;
        pts.push(sp.point(m.g, [0, 1, 0, 0]), sp.point(m.g, [e, 1, 0, 0]), sp.point(m.g, [0, 1, e, 0]));
        if (sp.ana) pts.push(sp.point(m.g, [0, 1, 0, e]));
        plan.push({ m, o });
      }
      const los = [];
      for (let k = 0; k < 2 && live.length; k++) {
        const m = live[(this.losTurn++) % live.length];
        if (los.some(x => x.m === m)) continue;
        const head = sp.point(m.g, [0, 1.6, 0, 0]), o = pts.length;
        for (let i = 1; i <= 7; i++) pts.push(sp.lerp(head, eye, i / 8));
        los.push({ m, o });
      }
      if (pts.length) {
        const d = WE.probe(pts).map(x => x / sp.m);
        for (const { m, o } of plan) {
          const d0 = d[o];
          if (!(d0 < 0.5)) { m.push = null; continue; }
          const g = [d[o + 1] - d0, d[o + 2] - d0, sp.ana ? d[o + 3] - d0 : 0], gl = len(g) || 1;
          m.push = sc(g, 3 * (0.5 - d0) / gl);
        }
        for (const { m, o } of los) m.los = [1, 2, 3, 4, 5, 6, 7].every(i => !(d[o + i - 1] < 0.03));
      }

      // enemy projectiles
      this.shots.update(dt);
      for (const b of this.shots.list) {
        if (b.dead >= 0) continue;
        const q = this.shots.model.pos(b.s);
        if (pp.body.some(p => sp.dist(q, p) / sp.m < 0.42)) { b.dead = 0; W.damage(7); }
      }
    }

    // GLSL data: 'mat' spaces -> uEn (mat4: right, up, forward, feet), uEnA (ana, 4D); 'yaw' -> uEn4 (feet, yaw)
    setUniforms(gl, p) {
      const n = Math.min(MAX, this.list.length), st = new Float32Array(MAX * 4);
      const buf = { mat: new Float32Array(MAX * 16), ana: new Float32Array(MAX * 4), pos: new Float32Array(MAX * 4) };
      this.list.slice(0, MAX).forEach((m, i) => { this.sp.pack(m.g, i, buf); st.set([m.hp / HP, m.flash, m.dead, m.type], i * 4); });
      if (this.sp.kind === 'mat') {
        gl.uniformMatrix4fv(p.u('uEn'), false, buf.mat);
        if (this.sp.ana) gl.uniform4fv(p.u('uEnA'), buf.ana);
      } else gl.uniform4fv(p.u('uEn4'), buf.pos);
      gl.uniform4fv(p.u('uEnS'), st);
      gl.uniform1i(p.u('uEnN'), this.on ? n : 0);
    }
    // in the HUD at the top (same place as the duel score on the loop arena)
    hud() {
      if (!this.on) return '';
      const nx = this.nextT > 0 ? ` · następna fala za ${Math.ceil(this.nextT)} s` : '';
      return `<div class="score">FALA ${this.wave}</div><div style="font-size:13px;opacity:.85">potwory ${this.alive()} / ${this.total} · zabite ${this.kills}${this.best ? ' · rekord: fala ' + this.best : ''}${nx}</div>`;
    }
  }
  Swarm.MAX = MAX;
  Swarm.spaces = S;
  Swarm.MODES = [{ label: 'Zwiedzanie', opts: { fight: false } }, { label: 'Walka: fale potworów', opts: { fight: true } }];
  // the map's game modes, health and HUD (the world calls startMode from its enter(opts))
  Swarm.attach = (world, swarm) => {
    world.modes = Swarm.MODES;
    world.swarm = swarm;
    world.damage = function (n) {
      if (this.health == null) return;
      this.health = Math.max(0, this.health - n);
      WE.hurt();
      if (this.health <= 0) WE.toast(`Zginąłeś na fali ${swarm.wave}! Gra od nowa.`, 3000), this.enter({});
    };
    world.duelHud = () => swarm.hud();
  };
  Swarm.startMode = (world, swarm, opts) => {
    if (opts.fight != null) world.fight = opts.fight;
    swarm.start(!!world.fight);
    world.health = world.fight ? 100 : null;
    if (world.bullets) world.bullets.clear();
  };

  // GLSL for 'mat' spaces (4D and curved). edot/edist = the space's inner product and distance; EN_M = units/metre.
  // Adds: vec2 enemies(vec4 x) -> (distance, id 20 + 4 i + part) and vec3 enemyColor(float id, vec4 p, vec4 n, inout float emit).
  Swarm.glslMat = (curved, unitsPerMetre, ana) => `
uniform mat4 uEn[${MAX}];
uniform vec4 uEnA[${MAX}], uEnS[${MAX}];
uniform int uEnN;
const float EN_M = ${unitsPerMetre.toFixed(6)};
${curved ? 'float edot(vec4 a, vec4 b){ return kdot(a,b); }\nfloat edist(vec4 a, vec4 b){ return kdist(a,b); }'
         : 'float edot(vec4 a, vec4 b){ return dot(a,b); }\nfloat edist(vec4 a, vec4 b){ return length(a-b); }'}
${WHorde.GLSL}
// local coordinates in metres (x right, y up, z forward, w = ana) — exact log map in curved space
vec4 enLocal(vec4 x, int i){
  mat4 F = uEn[i];
#if ${curved ? 1 : 0}
  vec3 v = vec3(kdot(x, F[0]), kdot(x, F[1]), kdot(x, F[2]));
  float l = length(v), D = kdist(x, F[3]);
  return vec4(l > 1e-7 ? v*(D/l) : v, 0.)/EN_M;
#else
  vec4 d = x - F[3];
  return vec4(dot(d, F[0]), dot(d, F[1]), dot(d, F[2]), dot(d, uEnA[i]))/EN_M;
#endif
}
vec2 enemies(vec4 x){
  vec2 r = vec2(1e9, 0.);
  for (int i = uZero; i < ${MAX}; i++){
    if (i >= uEnN) break;
    float far = edist(x, uEn[i][3])/EN_M - 2.3;
    if (far > .4) { r.x = min(r.x, far*EN_M); continue; }
    vec4 q = enLocal(x, i);
    vec2 z = zombie(q.xyz, uEnS[i], uTime*6. + float(i)*1.7);
#if ${ana ? 1 : 0}
    vec2 e = vec2(z.x, abs(q.w) - ${HALF_ANA.toFixed(2)});            // 4D: the body has thickness along its own ana
    z.x = min(max(e.x, e.y), 0.) + length(max(e, 0.));
#endif
    r = opU(r, vec2(z.x*EN_M, 20. + float(i)*4. + z.y));
  }
  return r;
}
vec3 enemyColor(float id, vec4 p, vec4 n, inout float emit){
  int i = int((id - 20.)/4. + .01);
  float part = id - 20. - float(i)*4.;
  mat4 F = uEn[i];
  vec3 nl = normalize(vec3(edot(n, F[0]), edot(n, F[1]), edot(n, F[2])) + 1e-5);
  return zombieColor(part, uEnS[i], enLocal(p, i).xyz, nl, emit);
}
`;
  window.WSwarm = Swarm;
})();
