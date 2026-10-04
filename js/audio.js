// Procedural gunshot / impact sounds, propagated through the geometry of the current world.
// A world turns a sound event into a list of ARRIVALS — the ways the sound reaches the listener:
//   { delay [s], gain, pan [-1..1], dist [m] (for air absorption), tail4d [m] (optional, 4D wake) }
// e.g. S3 returns the sound around the whole universe, the 3-torus returns it from every copy of the room,
// H3 lets it die out exponentially, conformal worlds trace sound rays along geodesics (lensing, focusing).
(function () {
  const A = { ctx: null, enabled: true, C: 343 };

  A.ensure = function () {
    if (!A.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = A.ctx = new AC();
      A.master = ctx.createGain(); A.master.gain.value = 0.7;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      A.master.connect(comp); comp.connect(ctx.destination);
      A.reverb = ctx.createConvolver(); A.reverb.buffer = roomIR(ctx);
      A.reverb.connect(A.master);
      A.shotBuf = makeShot(ctx); A.impactBuf = makeImpact(ctx);
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
  };
  document.addEventListener('pointerdown', () => A.ensure());
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyV' && !e.repeat) { A.enabled = !A.enabled; WE.toast(A.enabled ? 'Dźwięk: WŁ' : 'Dźwięk: WYŁ'); }
  });

  // short metallic click of the pistol mechanism (magazine out / in, slide) — heard directly, no propagation
  A.click = function (pitch = 1) {
    const ctx = A.ctx;
    if (!ctx || !A.enabled) return;
    const sr = ctx.sampleRate, n = Math.floor(sr * 0.06), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = noise() * Math.exp(-t / 0.004) * 0.6 + Math.sin(2 * Math.PI * 2100 * pitch * t) * Math.exp(-t / 0.012) * 0.35;
    }
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = b; g.gain.value = 0.45;
    s.connect(g); g.connect(A.master); s.start();
  };

  // ---------------- synthesis ----------------
  const noise = () => Math.random() * 2 - 1;
  function makeShot(ctx) {
    const sr = ctx.sampleRate, n = Math.floor(sr * 0.7), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    let lp = 0, lp2 = 0, ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, w = noise();
      lp += (w - lp) * 0.08; lp2 += (lp - lp2) * 0.15;
      const crack = (w - lp) * Math.exp(-t / 0.006) * 1.2;           // sharp supersonic crack
      const body = lp * Math.exp(-t / 0.07) * 2.2;                     // muzzle blast
      const f = 45 + 110 * Math.exp(-t / 0.04); ph += 2 * Math.PI * f / sr;
      const thump = Math.sin(ph) * Math.exp(-t / 0.11) * 0.9;         // low punch
      const tail = lp2 * Math.exp(-t / 0.25) * 1.2;
      d[i] = (crack + body + thump + tail) * Math.min(1, t * sr / 12);
    }
    return normalize(b, 0.9);
  }
  function makeImpact(ctx) {
    const sr = ctx.sampleRate, n = Math.floor(sr * 0.35), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    let lp = 0, ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, w = noise();
      lp += (w - lp) * 0.25;
      const hit = lp * Math.exp(-t / 0.02) * 1.5 + (w - lp) * Math.exp(-t / 0.004);
      const f = 2400 - 900 * t; ph += 2 * Math.PI * f / sr;
      const ping = Math.sin(ph) * Math.exp(-t / 0.07) * 0.25 * (Math.random() < 0.5 ? 1 : 1);   // ricochet
      d[i] = hit + ping;
    }
    return normalize(b, 0.8);
  }
  function roomIR(ctx) {
    const sr = ctx.sampleRate, n = Math.floor(sr * 1.4), b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = noise() * Math.exp(-i / sr / 0.28) * 0.5;
    }
    return b;
  }
  function normalize(b, peak) {
    const d = b.getChannelData(0); let m = 0;
    for (const x of d) m = Math.max(m, Math.abs(x));
    for (let i = 0; i < d.length; i++) d[i] *= peak / m;
    return b;
  }
  // Wave equation in 4 space dimensions: Huygens' principle fails, the Green's function has a tail inside the
  // light cone ~ (t^2 - r^2)^(-3/2). Convolving with it smears the bang into a "whoosh" behind the wavefront.
  const tailCache = new Map();
  function tail4d(ctx, r) {
    const key = Math.round(Math.min(r, 60));
    if (tailCache.has(key)) return tailCache.get(key);
    const sr = ctx.sampleRate, n = Math.floor(sr * 0.5), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    const T = Math.max(key, 0.5) / A.C, t0 = 0.0015;
    let e = 0;
    for (let i = 0; i < n; i++) {
      const tau = i / sr;
      d[i] = Math.pow(t0 / (tau + t0), 1.5) * Math.pow((2 * T + t0) / (tau + 2 * T + t0), 1.5);
      e += d[i] * d[i];
    }
    const s = 1 / Math.sqrt(e);
    for (let i = 0; i < n; i++) d[i] *= s;
    tailCache.set(key, b);
    return b;
  }

  // ---------------- playback ----------------
  function play(buf, arrivals, wet, rate = 1, vol = 1) {
    const ctx = A.ensure();
    if (!ctx || !A.enabled) return;
    const t0 = ctx.currentTime + 0.01;
    arrivals.filter(a => a.gain > 0.002).sort((a, b) => b.gain - a.gain).slice(0, 48).forEach(a => {
      const src = ctx.createBufferSource(); src.buffer = buf;
      src.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
      let node = src;
      if (a.tail4d != null) { const cv = ctx.createConvolver(); cv.normalize = false; cv.buffer = tail4d(ctx, a.tail4d); node.connect(cv); node = cv; }
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      const dist = a.dist || 0;
      lp.frequency.value = Math.max(350, 18000 * Math.exp(-dist / 120) * (a.muffle ? 0.25 : 1));
      const g = ctx.createGain(); g.gain.value = vol * Math.min(1.5, a.gain) * Math.exp(-dist / 500);
      const pan = ctx.createStereoPanner(); pan.pan.value = WM.clamp(a.pan || 0, -1, 1);
      node.connect(lp); lp.connect(g); g.connect(pan); pan.connect(A.master);
      if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; pan.connect(s); s.connect(A.reverb); }
      src.start(t0 + Math.max(0, a.delay));
    });
  }

  // default propagation: flat 3D, one straight path, amplitude 1/r
  A.flatArrivals = function (src, lis, right, fwd, dims = 3) {
    const d = WM.sub(src, lis), r = WM.len(d);
    const dir = r > 1e-6 ? WM.scale(d, 1 / r) : fwd;
    return [{ delay: r / A.C, gain: Math.pow(1 / Math.max(r, 1), (dims - 1) / 2), pan: WM.dot(dir, right), dist: r, muffle: WM.dot(dir, fwd) < -0.3 }];
  };

  // Constant curvature K=±1 (points on the sphere / hyperboloid), `scale` = metres per unit of length.
  //  H3: one geodesic, amplitude 1/(R sinh(r/R)) — dies out exponentially.
  //  S3: every geodesic closes after 2π: the sound arrives the short way (r) and the long way (2π - r, from the
  //      opposite side), again and again; amplitude 1/(R |sin(r/R)|) — it REFOCUSES at the antipode and at the source.
  A.curvedArrivals = function (K, scale, src, C) {
    const P = C[3], right = C[0], fwd = C[2], out = [];
    if (!src) {
      out.push({ delay: 0, gain: 1, pan: 0, dist: 0 });
      // your own shot comes back from all around the universe, focused onto you
      if (K > 0) for (let n = 1; n <= 8; n++) { const d = 2 * Math.PI * n * scale; out.push({ delay: d / A.C, gain: 0.85, pan: 0, dist: d }); }
      return out;
    }
    const pq = WM.kdot(K, P, src);
    const r = K > 0 ? Math.acos(WM.clamp(pq, -1, 1)) : Math.acosh(Math.max(1, -pq));
    let v = WM.addScaled(src, P, -K * pq);
    v = WM.scale(v, 1 / Math.sqrt(Math.max(1e-12, WM.kdot(K, v, v))));
    const pan = WM.kdot(K, v, right), behind = WM.kdot(K, v, fwd) < -0.3;
    if (K < 0) {
      const dm = r * scale;
      out.push({ delay: dm / A.C, gain: 1 / (scale * Math.sinh(Math.max(r, 1 / scale))), pan, dist: dm, muffle: behind });
    } else {
      const amp = 1 / (scale * Math.max(Math.abs(Math.sin(r)), 0.06));
      for (let n = 0; n < 6; n++) {
        const a = (r + 2 * Math.PI * n) * scale, b = (2 * Math.PI * (n + 1) - r) * scale;
        out.push({ delay: a / A.C, gain: amp, pan, dist: a, muffle: behind });
        out.push({ delay: b / A.C, gain: amp, pan: -pan, dist: b, muffle: !behind });
      }
    }
    return out;
  };

  // Worlds with expensive propagation (ray tracing) answer asynchronously; arrivals are then scheduled
  // relative to the moment of the event, so the computation time does not shift them.
  function playLater(buf, w, src, wet, rate, vol) {
    const ctx = A.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    w.soundArrivalsAsync(src, arr => {
      const late = ctx.currentTime - t0;
      play(buf, arr.map(a => Object.assign({}, a, { delay: a.delay - late })), wet, rate, vol);
    });
  }

  A.shot = function (w) {
    if (!A.enabled || !A.ensure()) return;
    const wet = w.reverb != null ? w.reverb : 0.12;
    if (w.soundArrivalsAsync) {
      play(A.shotBuf, [{ delay: 0, gain: 1, pan: 0, dist: 0 }], wet);   // the bang itself: immediately
      playLater(A.shotBuf, w, null, wet);                                // what the space does with it: later
      return;
    }
    const arr = w.soundArrivals ? w.soundArrivals(null) : [{ delay: 0, gain: 1, pan: 0, dist: 0 }];
    play(A.shotBuf, arr, wet);
  };
  A.impact = function (w, pos) {
    if (!A.enabled || !A.ensure()) return;
    if (w.soundArrivalsAsync) return playLater(A.impactBuf, w, pos, w.reverb != null ? w.reverb : 0.12);
    let arr;
    if (w.soundArrivals) arr = w.soundArrivals(pos);
    else { const c = w.player.camera(); arr = A.flatArrivals(pos, c.pos, c.right, c.fwd); }
    play(A.impactBuf, arr, w.reverb != null ? w.reverb : 0.12);
  };

  // a sound emitted somewhere in the world (enemy shot, death...), propagated like an impact
  A.at = function (w, pos, kind) {
    if (!A.enabled || !A.ensure()) return;
    const buf = kind === 'impact' ? A.impactBuf : A.shotBuf, rate = kind === 'enemy' ? 0.62 : kind === 'death' ? 0.45 : 1;
    const vol = kind === 'death' ? 1.4 : 1, wet = w.reverb != null ? w.reverb : 0.12;
    if (w.soundArrivalsAsync) return playLater(buf, w, pos, wet, rate, vol);
    const c = w.player.camera();
    play(buf, w.soundArrivals ? w.soundArrivals(pos) : A.flatArrivals(pos, c.pos, c.right, c.fwd), wet, rate, vol);
  };

  window.WAudio = A;
})();
