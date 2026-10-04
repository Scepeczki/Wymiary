// Small N-dimensional math helpers. Vectors are plain arrays, matrices are arrays of columns.
(function () {
  const M = {};

  M.vec = (n, fill = 0) => new Array(n).fill(fill);
  M.add = (a, b) => a.map((x, i) => x + b[i]);
  M.sub = (a, b) => a.map((x, i) => x - b[i]);
  M.scale = (a, s) => a.map(x => x * s);
  M.addScaled = (a, b, s) => a.map((x, i) => x + b[i] * s);
  M.dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  M.len = a => Math.sqrt(M.dot(a, a));
  M.norm = a => { const l = M.len(a) || 1; return M.scale(a, 1 / l); };
  M.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  M.lerp = (a, b, t) => a + (b - a) * t;

  // Identity matrix as columns.
  M.ident = n => Array.from({ length: n }, (_, c) => Array.from({ length: n }, (_, r) => (r === c ? 1 : 0)));
  M.cloneMat = m => m.map(c => c.slice());
  // m * v (m given as columns)
  M.mulVec = (m, v) => {
    const n = m[0].length, out = M.vec(n);
    for (let c = 0; c < m.length; c++) for (let r = 0; r < n; r++) out[r] += m[c][r] * v[c];
    return out;
  };
  // a * b
  M.mulMat = (a, b) => b.map(col => M.mulVec(a, col));
  // Rotation in plane (i, j) by angle t (rotates axis i towards axis j).
  M.planeRot = (n, i, j, t) => {
    const m = M.ident(n), c = Math.cos(t), s = Math.sin(t);
    m[i][i] = c; m[i][j] = s; m[j][i] = -s; m[j][j] = c;
    return m;
  };
  // Rotate basis columns bi and bj of an orthonormal frame in place (frame-local rotation).
  M.rotFrame = (frame, i, j, t) => {
    const c = Math.cos(t), s = Math.sin(t), a = frame[i], b = frame[j];
    frame[i] = a.map((x, k) => c * x + s * b[k]);
    frame[j] = b.map((x, k) => -s * a[k] + c * x);
  };
  // Euclidean Gram-Schmidt on columns, in given order of indices.
  M.orthonormalize = (frame, order) => {
    const done = [];
    for (const i of order) {
      let v = frame[i];
      for (const j of done) v = M.addScaled(v, frame[j], -M.dot(v, frame[j]));
      frame[i] = M.norm(v);
      done.push(i);
    }
  };

  // ---- constant-curvature 4D helpers (K = +1 sphere S3 in R4, K = -1 hyperboloid H3 in R^{3,1}) ----
  M.kdot = (K, a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + K * a[3] * b[3];
  M.kcos = (K, t) => (K > 0 ? Math.cos(t) : Math.cosh(t));
  M.ksin = (K, t) => (K > 0 ? Math.sin(t) : Math.sinh(t));
  // Isometry moving the origin (0,0,0,1) a distance t along axis i (i in 0..2), as 4x4 columns.
  M.ktrans = (K, i, t) => {
    const m = M.ident(4), c = M.kcos(K, t), s = M.ksin(K, t);
    m[i][i] = c; m[i][3] = -K * s;   // e_i -> c e_i - K s e_w
    m[3][i] = s; m[3][3] = c;        // origin -> s e_i + c e_w
    return m;
  };
  // Gram-Schmidt of a 4x4 frame w.r.t. the curvature metric: position column (3) first.
  M.korthonormalize = (K, m) => {
    const order = [3, 0, 1, 2], done = [];
    for (const i of order) {
      let v = m[i];
      for (const j of done) {
        const g = M.kdot(K, m[j], m[j]); // +1 for spacelike, K for position
        v = M.addScaled(v, m[j], -M.kdot(K, v, m[j]) / g);
      }
      const q = Math.abs(M.kdot(K, v, v)) || 1;
      m[i] = M.scale(v, 1 / Math.sqrt(q));
      done.push(i);
    }
  };
  // Inverse of an n x n matrix given as columns (Gauss-Jordan with partial pivoting).
  M.inverse = a => {
    const n = a.length, r = Array.from({ length: n }, (_, i) => [...a.map(c => c[i]), ...M.ident(n)[i]]);   // rows [A | I]
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let i = c + 1; i < n; i++) if (Math.abs(r[i][c]) > Math.abs(r[p][c])) p = i;
      [r[c], r[p]] = [r[p], r[c]];
      const d = r[c][c];
      for (let j = 0; j < 2 * n; j++) r[c][j] /= d;
      for (let i = 0; i < n; i++) if (i !== c) { const f = r[i][c]; for (let j = 0; j < 2 * n; j++) r[i][j] -= f * r[c][j]; }
    }
    return Array.from({ length: n }, (_, c) => r.map(row => row[n + c]));
  };
  // Flatten a 4x4 column matrix for gl.uniformMatrix4fv.
  M.flat = m => new Float32Array(m.flat());

  window.WM = M;
})();
