// ARENA PĘTLI — a long two-base shooter map in which almost every place is a glued (looping) piece of space.
// South half (base A, yours) is mirrored to the north half (base B):
//   bases:        torus rooms — the side walls are glued, the base continues sideways forever
//   left lane:    Penrose stairs — two flights up, yet you come out at the same level (vertical glue)
//   middle lane:  a booth that is bigger inside — a huge hall (itself a torus) between its two doors
//   right lane:   a room with a pit and a narrow bridge — fall in and you drop out of the ceiling
//   junctions:    wide torus halls joining the lanes
//   centre:       corridor with three glued side passages · floorless hall with stones (bottom glued to top) ·
//                 square glued east-west
// Every glue is a seamless portal for light rays, players, the rival and bullets alike.
(function () {
  // ---------------- geometry: boxes [x0,y0,z0,x1,y1,z1,material], grouped into culled modules ----------------
  const B = (x0, y0, z0, x1, y1, z1, m) => [x0, y0, z0, x1, y1, z1, m];
  const mirror = b => [b[0], b[1], -b[5], b[3], b[4], -b[2], b[6]];   // south -> north (z -> -z)
  const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

  // --- south half (z < 0); mirrored below ---
  const SOUTH = [
    { name: 'base', boxes: [
      B(-18, 0, -83, 18, 6, -82, 2),
      B(-18, 0, -66, -11.5, 6, -65, 2), B(-8.5, 0, -66, -1.5, 6, -65, 2), B(1.5, 0, -66, 9.5, 6, -65, 2), B(12.5, 0, -66, 18, 6, -65, 2),
      B(-5, 0, -82, 5, 1.2, -79, 3), B(-1.5, 0, -79, 1.5, 0.8, -78.2, 3), B(-1.5, 0, -78.2, 1.5, 0.4, -77.4, 3),
      B(-12, 0, -73, -7, 1.2, -72.4, 4), B(7, 0, -73, 12, 1.2, -72.4, 4),
      B(-4, 0, -70, -2.6, 1.4, -68.6, 6), B(2.6, 0, -70, 4, 1.4, -68.6, 6),
      B(-11, 0, -78, -9, 6, -76, 5), B(9, 0, -78, 11, 6, -76, 5)] },
    { name: 'penrose stairs', boxes: [
      B(-12.5, 0, -65, -11.5, 6.5, -42, 7), B(-8.5, 0, -65, -7.5, 6.5, -42, 7),
      B(-11.5, 3.2, -65, -8.5, 3.7, -62, 8)] },
    { name: 'middle corridor + booth', boxes: [
      B(-2.5, 0, -65, -1.5, 4, -55.5, 14), B(1.5, 0, -65, 2.5, 4, -55.5, 14), B(-2.5, 0, -50.5, -1.5, 4, -42, 14), B(1.5, 0, -50.5, 2.5, 4, -42, 14),
      B(-2.5, 0, -55.5, -1, 3.5, -55, 9), B(1, 0, -55.5, 2.5, 3.5, -55, 9), B(-1, 2.4, -55.5, 1, 3.5, -55, 9),
      B(-2.5, 0, -51, -1, 3.5, -50.5, 9), B(1, 0, -51, 2.5, 3.5, -50.5, 9), B(-1, 2.4, -51, 1, 3.5, -50.5, 9),
      B(-2.5, 0, -55.5, -2, 3.5, -50.5, 9), B(2, 0, -55.5, 2.5, 3.5, -50.5, 9), B(-2.5, 3.5, -55.5, 2.5, 4, -50.5, 9)] },
    { name: 'big hall (inside the booth)', boxes: [
      B(48, 0, -64, 59, 8, -63, 13), B(61, 0, -64, 72, 8, -63, 13), B(59, 2.4, -64, 61, 8, -63, 13),
      B(48, 0, -43, 59, 8, -42, 13), B(61, 0, -43, 72, 8, -42, 13), B(59, 2.4, -43, 61, 8, -42, 13),
      B(54, 0, -55, 56, 8, -53, 5), B(64, 0, -53, 66, 8, -51, 5),
      B(57, 0, -48, 58.4, 1.4, -46.6, 6), B(62, 0, -60, 63.4, 1.4, -58.6, 6),
      B(52, 0, -47, 55, 1.2, -46.4, 4), B(65, 0, -60, 68, 1.2, -59.4, 4)] },
    { name: 'pit room', boxes: [
      B(4, 0, -63, 9.5, 8.5, -62, 12), B(12.5, 0, -63, 18, 8.5, -62, 12), B(9.5, 3.2, -63, 12.5, 8.5, -62, 12),
      B(4, 0, -44, 9.5, 8.5, -43, 12), B(12.5, 0, -44, 18, 8.5, -43, 12), B(9.5, 3.2, -44, 12.5, 8.5, -43, 12),
      B(4, 0, -63, 5, 8.5, -43, 12), B(17, 0, -63, 18, 8.5, -43, 12),
      B(4, 8, -63, 18, 8.5, -58, 15), B(4, 8, -48, 18, 8.5, -43, 15), B(4, 8, -58, 7.5, 8.5, -48, 15), B(14.5, 8, -58, 18, 8.5, -48, 15),
      B(10.4, -0.4, -58, 11.6, 0, -48, 3),                                                // the bridge
      B(5.5, 0, -61, 6.5, 8, -60, 5), B(15.5, 0, -46, 16.5, 8, -45, 5),
      B(8.5, 0, -65, 9.5, 4, -63, 14), B(12.5, 0, -65, 13.5, 4, -63, 14), B(8.5, 0, -43, 9.5, 4, -42, 14), B(12.5, 0, -43, 13.5, 4, -42, 14)] },
    { name: 'junction', boxes: [
      B(-26, 0, -42, -11.5, 5, -41, 2), B(-8.5, 0, -42, -1.5, 5, -41, 2), B(1.5, 0, -42, 9.5, 5, -41, 2), B(12.5, 0, -42, 26, 5, -41, 2),
      B(-1.5, 4, -42, 1.5, 5, -41, 2), B(9.5, 4, -42, 12.5, 5, -41, 2),
      B(-26, 0, -36, -22, 5, -35, 2), B(-18, 0, -36, -1.5, 5, -35, 2), B(1.5, 0, -36, 18.5, 5, -35, 2), B(21.5, 0, -36, 26, 5, -35, 2),
      B(-22, 3.5, -36, -18, 5, -35, 2),
      B(-6, 0, -37.4, -4.6, 1.4, -36, 6), B(4.6, 0, -37.4, 6, 1.4, -36, 6), B(15, 0, -41, 16.4, 1.4, -39.6, 6)] },
    { name: 'centre corridors', boxes: [
      B(-2.5, 0, -35, -1.5, 4, -15, 14), B(1.5, 0, -35, 2.5, 4, -15, 14),
      B(17.5, 0, -35, 18.5, 4, -11, 14), B(21.5, 0, -35, 22.5, 4, -11, 14)] },
  ];
  const SIDE_Z = [-20, 0, 20];                                     // glued side passages of the left corridor
  const STONES = [[-2, -8.5], [2, -5], [-1.5, -1.5], [2, 2], [-2, 5.5], [1.5, 8.8]];
  const leftWall = x => {                                          // corridor wall at x..x+1 with gaps at the side passages
    const out = []; let z = -35;
    for (const zc of SIDE_Z) { out.push(B(x, 0, z, x + 1, 3.5, zc - 2, 7)); z = zc + 2; }
    out.push(B(x, 0, z, x + 1, 3.5, 35, 7));
    return out;
  };
  const isHall = m => m.name.startsWith('big hall');
  const MODULES = [
    ...SOUTH.filter(m => !isHall(m)),
    ...SOUTH.filter(m => !isHall(m)).map(m => ({ name: m.name + ' (N)', boxes: m.boxes.map(mirror) })),
    ...SOUTH.filter(isHall), ...SOUTH.filter(isHall).map(m => ({ name: m.name + ' (N)', boxes: m.boxes.map(mirror) })),
    { name: 'left corridor', boxes: [...leftWall(-23), ...leftWall(-18), B(-23, 3.5, -35, -17, 4, 35, 8),
      B(-22, 0, -30, -20.8, 1.2, -28.8, 6), B(-19.2, 0, -12, -18, 1.2, -10.8, 6), B(-22, 0, 10.8, -20.8, 1.2, 12, 6), B(-19.2, 0, 28.8, -18, 1.2, 30, 6)] },
    ...SIDE_Z.map(zc => ({ name: 'side passage ' + zc, boxes: [
      B(-32, 0, zc - 3, -23, 3.5, zc - 2, 7), B(-32, 0, zc + 2, -23, 3.5, zc + 3, 7), B(-17, 0, zc - 3, -10, 3.5, zc - 2, 7), B(-17, 0, zc + 2, -10, 3.5, zc + 3, 7),
      B(-32, 3.5, zc - 3, -23, 4, zc + 3, 8), B(-17, 3.5, zc - 3, -10, 4, zc + 3, 8), B(-33, 0, zc - 3, -32, 3.5, zc + 3, 7), B(-10.6, 0, zc - 3, -10, 3.5, zc + 3, 7)] })),
    { name: 'floorless hall', boxes: [
      B(-9, 0, -15, -1.5, 8, -14, 12), B(1.5, 0, -15, 9, 8, -14, 12), B(-1.5, 3, -15, 1.5, 8, -14, 12),
      B(-9, 0, 14, -1.5, 8, 15, 12), B(1.5, 0, 14, 9, 8, 15, 12), B(-1.5, 3, 14, 1.5, 8, 15, 12),
      B(-9, 0, -15, -8, 8, 15, 12), B(8, 0, -15, 9, 8, 15, 12)] },
    { name: 'hall stones', boxes: [
      B(-8, -0.6, -14, 8, 0, -11, 3), B(-8, -0.6, 11, 8, 0, 14, 3),
      ...STONES.map(([x, z]) => B(x - 1.1, -0.6, z - 1.1, x + 1.1, 0, z + 1.1, 3)),
      B(6.6, -0.4, -11, 8, 0, 11, 3),
      ...[[-11, -7.5], [-6, -3], [-1.5, 1.5], [3, 6], [7.5, 11]].map(([a, b]) => B(-8, -0.4, a, -6.8, 0, b, 3)),
      B(4, -2.9, -7, 5.6, -2.5, -5.4, 3), B(-5.6, -2.9, 3, -4, -2.5, 4.6, 3)] },
    { name: 'square', boxes: [
      B(10, 0, -11, 18.5, 6, -10, 11), B(21.5, 0, -11, 30, 6, -10, 11), B(10, 0, 10, 18.5, 6, 11, 11), B(21.5, 0, 10, 30, 6, 11, 11),
      B(19, 0, -1, 21, 6, 1, 5), B(15, 0, -5, 16.4, 1.4, -3.6, 6), B(23.6, 0, 3.6, 25, 1.4, 5, 6),
      B(14, 0, 5, 17, 1.2, 5.6, 4), B(23, 0, -5.6, 26, 1.2, -5, 4)] },
  ];
  for (const m of MODULES) {
    const a = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const b of m.boxes) for (let k = 0; k < 3; k++) { a[k] = Math.min(a[k], b[k]); a[k + 3] = Math.max(a[k + 3], b[k + 3]); }
    m.aabb = a;
    m.ch = m.boxes.map(ch);
    m.cha = ch(a);
  }
  // zones of consecutive modules, culled with one box test each: south base side, north base side, the two big
  // halls, the centre
  const nS = SOUTH.filter(m => !isHall(m)).length, nH = SOUTH.filter(isHall).length;
  const GROUPS = [[0, nS], [nS, 2 * nS], [2 * nS, 2 * nS + 2 * nH], [2 * nS + 2 * nH, MODULES.length]].map(([a, b]) => {
    const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (let i = a; i < b; i++) for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], MODULES[i].aabb[k]); bb[k + 3] = Math.max(bb[k + 3], MODULES[i].aabb[k + 3]); }
    return { range: [a, b], cha: ch(bb) };
  });
  function ch(b) { return [[(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], [(b[3] - b[0]) / 2, (b[4] - b[1]) / 2, (b[5] - b[2]) / 2]]; }
  // floor openings (x0, x1, z0, z1): the floorless hall and both pits
  const HOLES = [[-8, 8, -14, 14], [7.5, 14.5, -58, -48], [7.5, 14.5, 48, 58]];
  const HALL = HOLES[0];

  // ---------------- portals (seamless): plane axis = c, rectangle given by spans of the two other axes ----------------
  const P = (axis, c, s0, s1, dir, off, col) => ({ axis, c, span: [s0, s1], dir, off, col });
  const PS = [                                                                       // south half
    P(0, 16, [-1, 60], [-82, -66], 1, [-32, 0, 0], '#8af'), P(0, -16, [-1, 60], [-82, -66], -1, [32, 0, 0], '#8af'),      // base torus
    P(2, -52, [-11.5, -8.5], [-1, 8], 1, [0, -2.5, 0], '#ff6'), P(2, -52, [-11.5, -8.5], [-1, 8], -1, [0, 2.5, 0], '#ff6'), // Penrose stairs
    P(2, -42, [-11.5, -8.5], [-1, 8], 1, [0, -2.5, 0], '#ff6'), P(2, -42, [-11.5, -8.5], [-1, 8], -1, [0, 2.5, 0], '#ff6'),
    P(2, -55.5, [-1, 1], [-1, 2.4], 1, [60, 0, -8.5], '#f8f'), P(2, -64, [59, 61], [-1, 2.4], -1, [-60, 0, 8.5], '#f8f'),     // booth front <-> hall
    P(2, -50.5, [-1, 1], [-1, 2.4], -1, [60, 0, 8.5], '#f8f'), P(2, -42, [59, 61], [-1, 2.4], 1, [-60, 0, -8.5], '#f8f'),     // booth back <-> hall
    P(0, 70, [-1, 60], [-63, -43], 1, [-20, 0, 0], '#f8f'), P(0, 50, [-1, 60], [-63, -43], -1, [20, 0, 0], '#f8f'),          // big hall torus
    P(1, 0, [7.5, 14.5], [-58, -48], -1, [0, 8, 0], '#fa4'), P(1, 8, [7.5, 14.5], [-58, -48], 1, [0, -8, 0], '#fa4'),       // pit
    P(0, 24, [-1, 60], [-41, -36], 1, [-48, 0, 0], '#6ff'), P(0, -24, [-1, 60], [-41, -36], -1, [48, 0, 0], '#6ff'),        // junction torus
  ];
  const mirrorPortal = q => {
    const o = { ...q, off: [q.off[0], q.off[1], -q.off[2]] };
    if (q.axis === 2) { o.c = -q.c; o.dir = -q.dir; }
    else o.span = [q.span[0], [-q.span[1][1], -q.span[1][0]]];
    return o;
  };
  const PORTALS = [
    ...PS, ...PS.map(mirrorPortal),
    ...SIDE_Z.flatMap(zc => [P(0, -12, [-1, 3.6], [zc - 2, zc + 2], 1, [-18, 0, 0], '#5cf'), P(0, -30, [-1, 3.6], [zc - 2, zc + 2], -1, [18, 0, 0], '#5cf')]),
    P(1, -4, [-8, 8], [-14, 14], -1, [0, 12, 0], '#fa4'), P(1, 8, [-8, 8], [-14, 14], 1, [0, -12, 0], '#fa4'),               // floorless hall
    P(0, 28, [-1, 60], [-10, 10], 1, [-16, 0, 0], '#6f6'), P(0, 12, [-1, 60], [-10, 10], -1, [16, 0, 0], '#6f6'),            // square torus
  ];
  const others = ax => [0, 1, 2].filter(i => i !== ax);
  function inPortal(q, h) {
    const [a, b] = others(q.axis);
    return h[a] > q.span[0][0] && h[a] < q.span[0][1] && h[b] > q.span[1][0] && h[b] < q.span[1][1];
  }
  // offset of the first portal crossed on the segment a -> b (or null)
  function crossPortal(a, b) {
    for (const q of PORTALS) {
      const c0 = a[q.axis] - q.c, c1 = b[q.axis] - q.c;
      if (c0 * c1 > 0 || c0 === c1 || (q.dir && (c1 - c0) * q.dir <= 0)) continue;
      const t = c0 / (c0 - c1), h = [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t);
      if (inPortal(q, h)) return q.off;
    }
    return null;
  }

  // ---------------- CPU distance field (identical shapes to map() in the shader) ----------------
  function sdBoxC(x, y, z, c, h) {
    const qx = Math.abs(x - c[0]) - h[0], qy = Math.abs(y - c[1]) - h[1], qz = Math.abs(z - c[2]) - h[2];
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
  }
  // Penrose stairs (x around -10, z in [-62,-42] south / mirrored north): two identical flights of 10 steps
  // (0.25 m each) glued with a vertical shift of 2.5 m. The distance field is "screw-periodic": each side of a glue
  // plane also sees the neighbouring flight shifted by ±2.5 m — exactly what the portal shows — so collisions
  // match the picture, and only geometry on the near side of a glue plane is used.
  function flight(zz, y) {                 // one flight: steps + stepped ceiling, zz in [0, 10]
    const k = Math.min(9, Math.max(0, Math.floor(zz)));
    let d = 1e9;
    for (let j = -1; j <= 1; j++) {
      const kk = Math.min(9, Math.max(0, k + j)), top = 0.25 * (kk + 1);
      const qz = Math.abs(zz - kk - 0.5) - 0.5;
      const qs = Math.abs(y - top / 2) - top / 2, qc = Math.abs(y - top - 3.45) - 0.25;
      d = Math.min(d, Math.hypot(Math.max(qz, 0), Math.max(qs, 0)) + Math.min(Math.max(qz, qs), 0));
      d = Math.min(d, Math.hypot(Math.max(qz, 0), Math.max(qc, 0)) + Math.min(Math.max(qz, qc), 0));
    }
    return d;
  }
  function stairsSdf(x, y, z) {
    const zs = -Math.abs(z), qx = Math.abs(x + 10) - 1.5;
    const bound = Math.max(qx, zs + 62.5 < 0 ? -62.5 - zs : 0, zs + 40 > 0 ? zs + 40 : 0);
    if (bound > 0.5) return bound;
    let d;
    if (zs < -42) {                         // inside the stairs: this flight + neighbours seen through the glue planes
      const n = zs < -52 ? 0 : 1, zz = zs + 62 - 10 * n;
      d = Math.min(flight(zz, y), flight(zz + 10, y + 2.5), flight(zz - 10, y - 2.5));
    } else d = flight(zs + 52, y + 2.5);    // just past the exit: the last flight seen 2.5 m lower
    return Math.max(d, qx);
  }
  function floorSdf(x, y, z) {                       // ground half-space with the holes carved out (all heights)
    let hole = 1e9;
    for (const [x0, x1, z0, z1] of HOLES) {
      const hx = Math.abs(x - (x0 + x1) / 2) - (x1 - x0) / 2, hz = Math.abs(z - (z0 + z1) / 2) - (z1 - z0) / 2;
      hole = Math.min(hole, Math.hypot(Math.max(hx, 0), Math.max(hz, 0)) + Math.min(Math.max(hx, hz), 0));
    }
    return Math.max(y, -hole);
  }
  function sdf(p) {
    const [x, y, z] = p;
    let d = Math.min(floorSdf(x, y, z), stairsSdf(x, y, z));
    for (const g of GROUPS) {
      const gb = sdBoxC(x, y, z, g.cha[0], g.cha[1]);
      if (gb >= 2.5) { d = Math.min(d, gb); continue; }
      for (let i = g.range[0]; i < g.range[1]; i++) {
        const m = MODULES[i], bb = sdBoxC(x, y, z, m.cha[0], m.cha[1]);
        if (bb >= 2.5) { d = Math.min(d, bb); continue; }   // exact within 2.5 m (thresholds below rely on it)
        for (const [c, h] of m.ch) d = Math.min(d, sdBoxC(x, y, z, c, h));
      }
    }
    return d;
  }
  // height of the walkable surface below (x, y0, z), or -Infinity within 6 m
  function groundAt(x, y0, z) {
    let t = 0;
    while (t < 6) { const d = sdf([x, y0 - t, z]); if (d < 0.02) return y0 - t; t += Math.max(d, 0.02); }
    return -Infinity;
  }
  function los(a, b) {
    const d = WM.sub(b, a), L = WM.len(d);
    if (L < 1e-3) return true;
    const u = WM.scale(d, 1 / L);
    for (let t = 0.2; t < L - 0.2;) { const q = sdf(WM.addScaled(a, u, t)); if (q < 0.04) return false; t += Math.max(q, 0.04); }
    return true;
  }

  // ---------------- navigation graph (walkable nodes, auto-linked + explicit portal edges) ----------------
  const NODES = [], ADJ = [];
  const NAV_SOUTH = [
    ...[-13, -8, -3, 3, 8, 13].flatMap(x => [-76, -71, -67.5].map(z => [x, 0, z])), [0, 1.2, -80.5], [0, 0, -76.5], [-10, 0, -67.5], [0, 0, -67.5], [11, 0, -67.5],
    [-10, 0, -63.5], [-10, 0.25, -61.5], [-10, 1.25, -57.5], [-10, 2.25, -53.5], [-10, 0.25, -51.5], [-10, 1.25, -47.5], [-10, 2.25, -43.5],
    [0, 0, -63.5], [0, 0, -58], [0, 0, -49.5], [0, 0, -45],
    [60, 0, -61.5], [60, 0, -44.5], ...[53, 57, 63, 67].flatMap(x => [-60, -53, -46].map(z => [x, 0, z])),
    [11, 0, -64], [8, 0, -60.5], [11, 0, -60.5], [14, 0, -60.5], [6.2, 0, -55], [6.2, 0, -50], [15.8, 0, -55], [15.8, 0, -50],
    [8, 0, -45.5], [11, 0, -45.5], [14, 0, -45.5], [11, 0, -56], [11, 0, -50],
    ...[-20, -15, -10, -5, 0, 5.5, 11, 15.5, 20, -22.5, 22.5].map(x => [x, 0, -38.5]),
    [0, 0, -34], [0, 0, -28], [0, 0, -22], [0, 0, -16.5], [20, 0, -34], [20, 0, -28], [20, 0, -22], [20, 0, -16.5],
    [0, 0, -12.5], [-5, 0, -12.5], [5, 0, -12.5], [7.3, 0, -12.5],
    [20, 0, -7.5], [14, 0, -7.5], [26, 0, -7.5], [16, 0, -2.5], [24, 0, -2.5],
  ];
  const NAV_MID = [
    ...[-34, -28, -24, -16, -10, -4, 4, 10, 16, 24, 28, 34].map(z => [-20, 0, z]),
    ...SIDE_Z.flatMap(zc => [-28, -25, -20, -15, -13].map(x => [x, 0, zc])),
    ...[-10, -5, 0, 5, 10].map(z => [7.3, 0, z]), [14, 0, 0], [26, 0, 0],
  ];
  const GLUE_SOUTH = [   // [from, to, shift]  (shift = portal offset applied while walking from -> to)
    [[13, 0, -71], [-13, 0, -71], [-32, 0, 0]],
    [[-10, 2.25, -53.5], [-10, 0.25, -51.5], [0, -2.5, 0]],
    [[-10, 2.25, -43.5], [-10, 0, -38.5], [0, -2.5, 0]],
    [[0, 0, -58], [60, 0, -61.5], [60, 0, -8.5]],
    [[60, 0, -44.5], [0, 0, -49.5], [-60, 0, -8.5]],
    [[53, 0, -53], [67, 0, -53], [20, 0, 0]],
    [[22.5, 0, -38.5], [-22.5, 0, -38.5], [-48, 0, 0]],
  ];
  const mz = p => [p[0], p[1], -p[2]];
  function buildNav() {
    if (NODES.length) return;
    const raw = [...NAV_SOUTH, ...NAV_SOUTH.map(mz), ...NAV_MID];
    for (const [x, y, z] of raw) {
      const gy = groundAt(x, y + 1.5, z);
      if (!isFinite(gy) || Math.abs(gy - y) > 0.6 || sdf([x, gy + 1.0, z]) < 0.55 || sdf([x, gy + 1.6, z]) < 0.4) continue;
      if (NODES.some(q => Math.hypot(q[0] - x, q[2] - z) < 0.3 && Math.abs(q[1] - gy) < 1)) continue;
      NODES.push([x, gy, z]); ADJ.push([]);
    }
    const walk = (a, b) => {
      if (crossPortal([a[0], a[1] + 1.55, a[2]], [b[0], b[1] + 1.55, b[2]])) return false;   // through a portal: only explicit glue edges
      const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.ceil(L / 0.6);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
        const gy = groundAt(x, y + 0.7, z);
        if (gy < y - 0.75) return false;                               // a drop (pit, hall)
        const base = Math.max(gy, y);                                   // steps: measure from the actual ground
        if (sdf([x, base + 1.0, z]) < 0.42 || sdf([x, base + 1.6, z]) < 0.3) return false;
      }
      return true;
    };
    for (let i = 0; i < NODES.length; i++) for (let j = i + 1; j < NODES.length; j++) {
      const a = NODES[i], b = NODES[j], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (L > 10.5 || Math.abs(a[1] - b[1]) > 3 || !walk(a, b)) continue;
      ADJ[i].push({ to: j, len: L, shift: null }); ADJ[j].push({ to: i, len: L, shift: null });
    }
    const id = p => NODES.findIndex(q => Math.hypot(p[0] - q[0], p[2] - q[2]) < 0.6 && Math.abs(p[1] - q[1]) < 1);
    const glue = (a, b, shift) => {
      const i = id(a), j = id(b);
      if (i < 0 || j < 0) { console.warn('nav glue missing', a, b); return; }
      const len = WM.len(WM.sub(WM.sub(NODES[j], shift), NODES[i]));
      ADJ[i].push({ to: j, len, shift }); ADJ[j].push({ to: i, len, shift: WM.scale(shift, -1) });
    };
    for (const [a, b, s] of GLUE_SOUTH) { glue(a, b, s); glue(mz(a), mz(b), mz(s)); }
    for (const zc of SIDE_Z) glue([-13, 0, zc], [-28, 0, zc], [-18, 0, 0]);
    glue([26, 0, 0], [14, 0, 0], [-16, 0, 0]);
  }
  // straight walk without a drop (no pit) from a to b — used for shortcuts
  function solidGround(a, b) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.ceil(L / 0.8);
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
      if (groundAt(x, y + 0.7, z) < y - 0.75) return false;
    }
    return true;
  }
  function nearestNode(p) {
    const order = NODES.map((q, i) => [Math.hypot(q[0] - p[0], q[2] - p[2]) + 3 * Math.abs(q[1] - p[1]), i]).sort((a, b) => a[0] - b[0]);
    for (const [, i] of order.slice(0, 6)) {
      const q = NODES[i];
      if (Math.abs(q[1] - p[1]) < 2.5 && los([p[0], p[1] + 1, p[2]], [q[0], q[1] + 1, q[2]])) return i;
    }
    return order[0][1];
  }
  function dijkstra(src) {
    const n = NODES.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), via = new Array(n).fill(null), done = new Array(n).fill(false);
    dist[src] = 0;
    for (;;) {
      let u = -1, b = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < b) { b = dist[i]; u = i; }
      if (u < 0) break;
      done[u] = true;
      for (const e of ADJ[u]) if (dist[u] + e.len < dist[e.to]) { dist[e.to] = dist[u] + e.len; prev[e.to] = u; via[e.to] = e; }
    }
    return { dist, prev, via, src };
  }
  function pathTo(D, goal) {
    const path = [];
    for (let v = goal; D.prev[v] >= 0; v = D.prev[v]) path.unshift({ to: v, shift: D.via[v].shift, crossed: false });
    path.unshift({ to: D.src, shift: null, crossed: false });
    return path;
  }

  // ---------------- the rival ----------------
  const DIFF = [
    null,
    { react: 0.75, spread: 0.07, lead: 0.4, gap: 0.27, burst: [2, 3], pause: [0.7, 1.3], speed: 3.4, cover: 0.45 },
    { react: 0.3, spread: 0.03, lead: 0.85, gap: 0.17, burst: [3, 5], pause: [0.35, 0.7], speed: 4.4, cover: 0.85 },
  ];
  const DMG = 20, MAG = 12, RELOAD = 1.7, BULLET_SPEED = 60, BULLET_G = 1;
  const rnd = (a, b) => a + Math.random() * (b - a);

  class Rival {
    constructor(world) { this.w = world; this.hp = 0; this.dead = 1e9; this.p = [0, -100, 0]; }
    reset(pos) {
      Object.assign(this, {
        p: pos.slice(), vy: 0, yaw: 0, ph: 0, hp: 100, dead: -1, flash: 0, ammo: MAG, reload: 0,
        cool: 1, burst: 0, state: 'hunt', path: [], replan: 0, vis: false, react: 0, seenT: -99, lastSeen: null,
        strafe: 1, strafeT: 0, waitT: 0, waitFor: 2, hurtT: -99, coverNode: -1,
      });
    }
    get eye() { return [this.p[0], this.p[1] + 1.55, this.p[2]]; }
    inBody(q) {
      if (this.dead >= 0 || this.hp <= 0) return false;
      return Math.hypot(q[0] - this.p[0], q[1] - WM.clamp(q[1], this.p[1] + 0.25, this.p[1] + 1.75), q[2] - this.p[2]) <= 0.45;
    }
    // player bullet at q
    hit(q) { return this.inBody(q) && this.takeDamage(DMG); }
    takeDamage(dmg) {
      if (this.dead >= 0 || this.hp <= 0) return false;
      this.hp -= dmg; this.flash = 1; this.hurtT = WE.time;
      if (this.hp <= 0) { this.dead = 0; this.w.rivalDied(); return true; }
      if (this.state !== 'cover' && (this.hp <= 40 || (this.hp <= 60 && Math.random() < this.w.diff.cover))) this.goCover();
      return true;
    }
    planTo(goal) { this.path = pathTo(dijkstra(nearestNode(this.p)), goal); this.trim(); }
    // skip waypoints behind us: while the next one is directly reachable, go straight to it
    trim() {
      const w0 = [this.p[0], this.p[1] + 1, this.p[2]];
      const tgt = s => (s.shift && !s.crossed ? WM.sub(NODES[s.to], s.shift) : NODES[s.to]);
      // already past the first waypoint (e.g. replanning halfway to a portal): drop it
      if (this.path.length > 1) {
        const a = tgt(this.path[0]), b = tgt(this.path[1]);
        const dh = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);
        if (dh(this.p, b) < dh(a, b) && (this.path[1].shift || (los(w0, [b[0], b[1] + 1, b[2]]) && solidGround(this.p, b)))) this.path.shift();
      }
      while (this.path.length > 1 && !this.path[1].shift) {
        const n = NODES[this.path[1].to];
        if (Math.hypot(n[0] - w0[0], n[2] - w0[2]) > 12 || Math.abs(n[1] - this.p[1]) > 1 || !los(w0, [n[0], n[1] + 1, n[2]]) || !solidGround(this.p, n)) break;
        this.path.shift();
      }
    }
    goCover() {
      const pl = (this.w.botTarget(this.eye) || this.w.player).pos, chest = [pl[0], pl[1] - 0.3, pl[2]];
      const D = dijkstra(nearestNode(this.p));
      let best = -1, bc = Infinity;
      NODES.forEach((q, i) => {
        if (!isFinite(D.dist[i]) || D.dist[i] > 30) return;
        const dp = Math.hypot(q[0] - pl[0], q[2] - pl[2]);
        if (dp < 6 || los(chest, [q[0], q[1] + 1.3, q[2]])) return;
        const c = D.dist[i] - 0.2 * Math.min(dp, 20);
        if (c < bc) { bc = c; best = i; }
      });
      if (best < 0) return;
      this.state = 'cover'; this.coverNode = best; this.path = pathTo(D, best); this.trim(); this.waitT = 0; this.waitFor = rnd(1.2, 2.4);
    }
    follow() {
      while (this.path.length) {
        const s = this.path[0], n = NODES[s.to];
        const t = s.shift && !s.crossed ? WM.sub(n, s.shift) : n;
        if (Math.hypot(t[0] - this.p[0], t[2] - this.p[2]) < 0.5 && Math.abs(t[1] - this.p[1]) < 2.5) { this.path.shift(); continue; }
        const d = [t[0] - this.p[0], 0, t[2] - this.p[2]], l = Math.hypot(d[0], d[2]);
        return [d[0] / l, 0, d[2] / l];
      }
      return null;
    }
    update(dt) {
      const w = this.w, df = w.diff;
      this.flash = Math.max(0, this.flash - dt * 4);
      if (this.dead >= 0) { this.dead += dt; return; }
      const eye = this.eye, pl = w.botTarget(eye) || { pos: [this.p[0], -1e3, this.p[2]], vel: [0, 0, 0], alive: false };
      const chest = [pl.pos[0], pl.pos[1] - 0.35, pl.pos[2]];
      const dist = WM.len(WM.sub(chest, eye));
      const vis = pl.alive && dist < 55 && los(eye, chest);
      if (vis && !this.vis) this.react = df.react * rnd(0.8, 1.3);
      this.vis = vis;
      if (vis) { this.seenT = WE.time; this.lastSeen = pl.pos.slice(); }
      this.react -= dt; this.cool -= dt; this.replan -= dt; this.strafeT -= dt;
      if (this.reload > 0) { this.reload -= dt; if (this.reload <= 0) this.ammo = MAG; }

      // ---- decide ----
      let mv = null, speed = df.speed;
      if (this.state === 'cover') {
        mv = this.follow();
        if (!mv) {                                                  // in cover: reload, wait, then peek out
          if (this.ammo < MAG && this.reload <= 0) this.reload = RELOAD;
          this.waitT += dt;
          if (this.waitT > this.waitFor && this.reload <= 0) {
            const D = dijkstra(this.coverNode);
            let best = -1, bd = Infinity;
            NODES.forEach((q, i) => {
              if (D.dist[i] > 0 && D.dist[i] < Math.min(bd, 14) && los(chest, [q[0], q[1] + 1.3, q[2]])) { bd = D.dist[i]; best = i; }
            });
            if (best >= 0) { this.state = 'peek'; this.path = pathTo(D, best); } else this.state = 'hunt';
          }
        }
      } else if (vis) { this.state = 'fight'; this.path = []; }
      if (this.state === 'fight') {
        if (!vis && WE.time - this.seenT > 0.8) { this.state = 'hunt'; this.replan = 0; }
        else {
          const f = [chest[0] - this.p[0], 0, chest[2] - this.p[2]], l = Math.hypot(f[0], f[2]) || 1;
          const fw = [f[0] / l, 0, f[2] / l], side = [-fw[2], 0, fw[0]];
          if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = rnd(0.6, 1.5); }
          mv = WM.addScaled(WM.scale(side, this.strafe), fw, l > 18 ? 0.8 : l < 7 ? -0.6 : 0);
          speed *= 0.75;
        }
      }
      if (this.state === 'peek') { mv = this.follow(); if (!mv) this.state = 'hunt'; }
      if (this.state === 'hunt') {
        if (this.replan <= 0 || !this.path.length) {
          this.replan = 1;
          const target = this.lastSeen && WE.time - this.seenT < 5 ? this.lastSeen : pl.pos;
          this.planTo(nearestNode([target[0], target[1] - 1.6, target[2]]));
        }
        mv = this.follow();
        if (this.reload <= 0 && this.ammo < 5) this.reload = RELOAD;
      }

      // ---- shoot ----
      if (vis && this.react <= 0 && this.ammo > 0 && this.reload <= 0 && this.cool <= 0) {
        if (this.burst <= 0) this.burst = Math.round(rnd(df.burst[0], df.burst[1]));
        const fw = WM.norm(WM.sub(chest, eye)), right = WM.norm([fw[2], 0, -fw[0]]);
        const muzzle = WM.add(WM.addScaled(eye, right, -0.25), [0, -0.15, 0]);
        const tf = dist / BULLET_SPEED;
        const aim = WM.addScaled(chest, pl.vel, tf * df.lead);
        aim[1] += 0.5 * BULLET_G * tf * tf;
        let dir = WM.norm(WM.sub(aim, muzzle));
        const sp = df.spread * (1 + WM.len(pl.vel) / 8);
        dir = WM.norm(WM.add(dir, [rnd(-sp, sp), rnd(-sp, sp), rnd(-sp, sp)]));
        const shot = { pos: WM.addScaled(muzzle, dir, -0.35), dir };
        w.rivalShots.fire(shot);
        WMP.aiShot(w, shot);
        WAudio.at(w, muzzle, 'shot');
        this.ammo--; this.burst--;
        this.cool = this.burst > 0 ? df.gap : rnd(df.pause[0], df.pause[1]);
        if (this.ammo === 0) { this.reload = RELOAD; if (Math.random() < df.cover) this.goCover(); }
      }

      // ---- move ----
      const before = this.p.slice();
      let movedThrough = false;
      const ground0 = groundAt(this.p[0], this.p[1] + 0.6, this.p[2]);
      const onGround = this.p[1] - ground0 < 0.05;
      if (mv) {
        const step = WM.scale(mv, speed * dt * (onGround ? 1 : 0.6));
        let np = [this.p[0] + step[0], this.p[1], this.p[2] + step[2]];
        // a portal crossed by this step: check the move on the far side of the glue (that is where we will be)
        const moveOff = crossPortal(WM.add(this.p, [0, 1.55, 0]), WM.add(np, [0, 1.55, 0]));
        if (moveOff) np = WM.add(np, moveOff);
        const g = groundAt(np[0], np[1] + 0.6, np[2]);
        const okGround = this.state !== 'fight' || g > np[1] - 0.8;   // do not strafe into the pit
        if (okGround && sdf([np[0], np[1] + 1.0, np[2]]) > 0.25) {
          this.p = np;
          if (moveOff) { movedThrough = true; this.crossed(moveOff); }
          this.ph += Math.hypot(step[0], step[2]) * 2.4;
          if (!vis) this.yaw = Math.atan2(mv[0], mv[2]);
        } else this.strafe *= -1;
      }
      if (vis) this.yaw = Math.atan2(chest[0] - this.p[0], chest[2] - this.p[2]);
      for (let it = 0; it < 2; it++) {                               // walls
        const c = [this.p[0], this.p[1] + 1.0, this.p[2]], d0 = sdf(c);
        if (d0 >= 0.36) break;
        const e = 0.02, gx = sdf([c[0] + e, c[1], c[2]]) - d0, gz = sdf([c[0], c[1], c[2] + e]) - d0, gl = Math.hypot(gx, gz) || 1;
        this.p[0] += gx / gl * (0.36 - d0); this.p[2] += gz / gl * (0.36 - d0);
      }
      const g = groundAt(this.p[0], this.p[1] + 0.6, this.p[2]);
      if (this.p[1] > g + 0.02) {
        this.vy = Math.max(-25, this.vy - 20 * dt);
        this.p[1] = Math.max(g, this.p[1] + this.vy * dt);
        if (this.p[1] === g) this.vy = 0;
      } else { this.p[1] = g; this.vy = 0; }
      // portals (eye segment, like the player)
      const off = movedThrough ? null : crossPortal(WM.add(before, [0, 1.55, 0]), WM.add(this.p, [0, 1.55, 0]));
      if (off) { this.p = WM.add(this.p, off); this.crossed(off); }
    }
    crossed(off) {
      const s = this.path[0];
      if (s && s.shift && !s.crossed && WM.len(WM.sub(s.shift, off)) < 0.1) s.crossed = true;
    }
  }

  // ---------------- shader ----------------
  const f2 = x => x.toFixed(2), v3 = a => `vec3(${a.map(f2).join(',')})`;
  // boxes as constant tables walked by loops whose bound is a uniform: the driver cannot unroll/inline them,
  // which keeps the compile time of this big map short
  const NB = MODULES.reduce((n, m) => n + m.boxes.length, 0), NM = MODULES.length;
  let bi = 0;
  const ranges = MODULES.map(m => { const r = [bi, bi + m.boxes.length]; bi += m.boxes.length; return r; });
  const allB = MODULES.flatMap(m => m.boxes.map((b, i) => [m.ch[i], b[6]]));
  // Geometry and portal tables live in a float texture (texelFetch). Large constant arrays indexed dynamically
  // are very slow on Direct3D drivers (they get copied into registers); a texture is cheap and has no size limit.
  //   row 0: box centre + material   row 1: box half size   row 2: module centre + first box   row 3: module half size + end
  //   row 4: portal (axis, plane, dir) row 5: portal spans     row 6: portal offset
  const zoneOf = q => (q.axis === 2 ? q.c : (q.span[1][0] + q.span[1][1]) / 2) < -34 ? 0 : (q.axis === 2 ? q.c : (q.span[1][0] + q.span[1][1]) / 2) > 34 ? 2 : 1;
  const PORT_SORTED = [0, 1, 2].flatMap(z => PORTALS.filter(q => zoneOf(q) === z));
  const pzRange = [0, 1, 2].map(z => { const a = PORT_SORTED.findIndex(q => zoneOf(q) === z); return [a, a + PORTALS.filter(q => zoneOf(q) === z).length]; });
  const TW = Math.max(NB, NM, PORTALS.length), TAB = new Float32Array(TW * 7 * 4);
  const put = (row, i, v) => TAB.set(v, (row * TW + i) * 4);
  allB.forEach(([c, m], i) => { put(0, i, [...c[0], m]); put(1, i, [...c[1], 0]); });
  MODULES.forEach((m, i) => { put(2, i, [...m.cha[0], ranges[i][0]]); put(3, i, [...m.cha[1], ranges[i][1]]); });
  PORT_SORTED.forEach((q, i) => { put(4, i, [q.axis, q.c, q.dir, 0]); put(5, i, [q.span[0][0], q.span[0][1], q.span[1][0], q.span[1][1]]); put(6, i, [...q.off, 0]); });
  let tabTex = null;
  const tablesGLSL = `
uniform sampler2D uTab;
#define TAB(r, i) texelFetch(uTab, ivec2(i, r), 0)
const int NG = ${GROUPS.length};
const vec3 GC[NG] = vec3[](${GROUPS.map(g => v3(g.cha[0])).join(',')});
const vec3 GH[NG] = vec3[](${GROUPS.map(g => v3(g.cha[1])).join(',')});
const ivec2 GR[NG] = ivec2[](${GROUPS.map(g => `ivec2(${g.range[0]},${g.range[1]})`).join(',')});
uniform int uNM;`;

  const MAXF = 4;                    // other figures drawn (the rival, or other players over the network)

  const code = `
uniform vec4 uOth[${MAXF}], uOthS[${MAXF}];   // other figures: feet + yaw; hp (<0 hidden), flash, death time, type
uniform float uOthPh[${MAXF}];
uniform int uOthN;
uniform vec4 uMe;                  // you: feet + yaw (seen only through portals)
uniform float uMePh;
${tablesGLSL}
int gPortals = 0;                  // portals crossed by the current ray
// portals as a table walked by a loop (small code, fast compile)
// portals as a table; only the zone(s) the step touches are tested (south base side / centre / north base side)
bool portalRange(inout vec3 p, vec3 np, int a, int b){
  for (int i = a; i < b; i++){
    vec4 pa = TAB(4, i);
    int ax = int(pa.x);
    float c0 = p[ax] - pa.y, c1 = np[ax] - pa.y;
    if (c0*c1 > 0. || c0 == c1 || (c1 - c0)*pa.z <= 0.) continue;
    vec3 h = mix(p, np, c0/(c0 - c1));
    vec2 o = ax == 0 ? h.yz : ax == 1 ? h.xz : h.xy;
    vec4 sp = TAB(5, i);
    if (o.x > sp.x && o.x < sp.y && o.y > sp.z && o.y < sp.w) { p = h + TAB(6, i).xyz + normalize(np - p)*.002; gPortals++; return true; }
  }
  return false;
}
bool portalStep(inout vec3 p, vec3 np){
  float zmin = min(p.z, np.z), zmax = max(p.z, np.z);
  if (zmin < -33. && portalRange(p, np, ${pzRange[0][0]}, ${pzRange[0][1]})) return true;
  if (zmax > -37. && zmin < 37. && portalRange(p, np, ${pzRange[1][0]}, ${pzRange[1][1]})) return true;
  if (zmax > 33. && portalRange(p, np, ${pzRange[2][0]}, ${pzRange[2][1]})) return true;
  return false;
}
${WHorde.GLSL}
float sdBox2(vec2 p, vec2 b){ vec2 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, q.y), 0.); }
float flight(float zz, float y){
  float k = clamp(floor(zz), 0., 9.), d = 1e9;
  for (int j = -1; j <= 1; j++){
    float kk = clamp(k + float(j), 0., 9.), top = .25*(kk + 1.);
    d = min(d, sdBox2(vec2(zz - kk - .5, y - top*.5), vec2(.5, top*.5)));
    d = min(d, sdBox2(vec2(zz - kk - .5, y - top - 3.45), vec2(.5, .25)));
  }
  return d;
}
float stairs(vec3 p){
  float zs = -abs(p.z), qx = abs(p.x + 10.) - 1.5;
  float bound = max(qx, max(-62.5 - zs, zs + 40.));
  if (bound > .5) return bound;
  float d;
  if (zs < -42.) {
    float n = zs < -52. ? 0. : 1., zz = zs + 62. - 10.*n;
    d = min(flight(zz, p.y), min(flight(zz + 10., p.y + 2.5), flight(zz - 10., p.y - 2.5)));
  } else d = flight(zs + 52., p.y + 2.5);
  return max(d, qx);
}
// nearest humanoid by bounding sphere, detailed model evaluated once (keeps the shader small)
vec2 figures(vec3 p){
  float best = 1e9, second = 1e9; int bi = -2;
  for (int i = 0; i < ${MAXF}; i++){
    if (i >= uOthN) break;
    if (uOthS[i].x < -.5) continue;
    float d = length(p - uOth[i].xyz - vec3(0,1,0)) - 1.25;
    if (d < best) { second = best; best = d; bi = i; } else second = min(second, d);
  }
  if (gPortals > 0) {
    float d = length(p - uMe.xyz - vec3(0,1,0)) - 1.25;
    if (d < best) { second = best; best = d; bi = -1; } else second = min(second, d);
  }
  if (bi == -2 || best > .3) return vec2(best, 0.);
  vec4 at = bi < 0 ? uMe : uOth[bi], st = bi < 0 ? vec4(1, 0, -1, 2) : uOthS[bi];
  vec3 q = p - at.xyz;
  q.xz = r2(-at.w)*q.xz;
  vec2 z = zombie(q, st, bi < 0 ? uMePh : uOthPh[bi]);
  return z.x < second ? vec2(z.x, (bi < 0 ? 50. : 30. + float(bi)*4.) + z.y) : vec2(second, 0.);
}
vec2 map(vec3 p){
  float hole = 1e9;
${HOLES.map(([x0, x1, z0, z1]) => `  hole = min(hole, sdBox2(p.xz - vec2(${f2((x0 + x1) / 2)}, ${f2((z0 + z1) / 2)}), vec2(${f2((x1 - x0) / 2)}, ${f2((z1 - z0) / 2)})));`).join('\n')}
  vec2 r = vec2(max(p.y, -hole), 1.);
  r = opU(r, vec2(stairs(p), 16.));
  for (int g = 0; g < NG; g++) {
    if (g >= uNM) break;
    float gb = sdBox(p - GC[g], GH[g]);
    if (gb >= 2.5) { r.x = min(r.x, gb); continue; }
    for (int m = GR[g].x; m < GR[g].y; m++) {
      vec4 mc = TAB(2, m), mh = TAB(3, m);
      float bb = sdBox(p - mc.xyz, mh.xyz);
      if (bb >= 2.5) { r.x = min(r.x, bb); continue; }   // exact near modules: soft shadows need true distances
      for (int i = int(mc.w); i < int(mh.w); i++) { vec4 bc = TAB(0, i); r = opU(r, vec2(sdBox(p - bc.xyz, TAB(1, i).xyz), bc.w)); }
    }
  }
#ifndef PROBE
  r = opU(r, figures(p));
#endif
  return r;
}
vec3 sky(vec3 rd){
  vec3 c = mix(vec3(.62,.75,.95), vec3(.2,.38,.78), clamp(rd.y, 0., 1.));
  c = mix(vec3(.7,.7,.72), c, smoothstep(-.1, .2, rd.y));
  return c + vec3(1.,.85,.6)*pow(max(dot(rd, SUN_DIR), 0.), 300.)*4.;
}
// team colour: blue towards base A (south), red towards base B (north)
vec3 team(float z){ return z < 0. ? vec3(.45,.6,.95) : vec3(.95,.5,.45); }
vec3 material(float id, vec3 p, vec3 n, inout float emit){
  if (id > 49.5) return zombieColor(id - 50., vec4(1, 0, -1, 2), p, n, emit);
  if (id > 29.5) { float k = id - 30.; int i = int(floor(k/4. + .01)); return zombieColor(k - float(i)*4., uOthS[i], p, n, emit); }
  float g = gridLines(p, n, 1.);
  if (id < 1.5) {
    vec3 c;
    float az = abs(p.z);
    if (p.x > 45.) c = mix(vec3(.55,.45,.62), vec3(.45,.36,.52), mod(floor(p.x*.5) + floor(p.z*.5), 2.));            // hall inside the booth
    else if (az > 66.) c = mix(vec3(.62,.6,.58), team(p.z), .3)*(1. - .08*mod(floor(p.x*.5) + floor(p.z*.5), 2.)); // bases
    else if (az > 35. && az < 42.) c = mix(vec3(.5,.55,.6), team(p.z), .15);                                       // junctions
    else if (az < 11. && p.x > 10.) c = mix(vec3(.32,.56,.3), vec3(.26,.47,.25), mod(floor(p.x) + floor(p.z), 2.)); // square
    else if (p.x < -9. && az < 36.) c = abs(p.x + 20.) < 1.2 || abs(mod(p.z + 20., 20.) - 10.) > 8. ? vec3(.5,.13,.13) : vec3(.55,.55,.6);
    else c = vec3(.55,.53,.5);
    return mix(c, c*.6, g);
  }
  if (id < 2.5) {                                                                                           // base & junction walls
    if (abs(p.y - 4.5) < .12) { emit = 2.; return team(p.z); }
    return mix(mix(vec3(.78,.75,.7), team(p.z), .25), vec3(.5,.48,.45), g);
  }
  if (id < 3.5) {                                                                                           // platforms, steps, stones, bridge
    if (n.y < .5 && (abs(p.x) < 8. && abs(p.z) < 14. || p.x > 7. && p.x < 15. && abs(p.z) > 47. && abs(p.z) < 59.)) { emit = .6; return vec3(1.,.7,.25); }
    vec3 c = p.x < -7. && abs(p.z) > 42. ? vec3(.8,.82,.9) : vec3(.85,.78,.6);
    return mix(c, c*.6, g);
  }
  if (id < 4.5) return mix(vec3(.75,.42,.28), vec3(.5,.28,.18), g);
  if (id < 5.5) return mix(vec3(.6,.62,.7), vec3(.4,.42,.5), gridLines(p, n, 2.));
  if (id < 6.5) return mix(vec3(.72,.55,.3), vec3(.45,.33,.15), gridLines(p, n, 2.));
  if (id < 7.5) {                                                                                           // corridor walls
    if (abs(p.y - 2.6) < .08 || p.x < -7. && abs(p.z) > 42. && abs(fract(p.y*.5) - .5) < .03) { emit = 2.; return vec3(.4,.8,1.); }
    return mix(vec3(.82,.8,.86), vec3(.6,.58,.65), g);
  }
  if (id < 8.5) {                                                                                           // corridor roofs: lamps
    if (n.y < -.5 && (abs(fract(p.z/4.) - .5) < .12 && abs(p.x + 20.) < .8 || abs(fract(p.x/4.) - .5) < .12 && abs(mod(p.z + 20., 20.) - 10.) > 9.2)) { emit = 3.; return vec3(1.,.95,.85); }
    return vec3(.35);
  }
  if (id < 9.5) { if (abs(p.y - 3.) < .1) { emit = 2.5; return vec3(1.,.4,1.); } return mix(vec3(.3,.3,.75), vec3(.2,.2,.5), g); }   // the booth
  if (id < 11.5) return mix(vec3(.75,.85,.7), vec3(.5,.6,.45), g);                                        // square walls
  if (id < 12.5) {                                                                                          // hall / pit room walls: glowing bands
    if (abs(fract(p.y/3.) - .5) < .03) { emit = 2.; return vec3(1.,.6,.2); }
    return mix(vec3(.5,.5,.55), vec3(.35,.35,.4), g);
  }
  if (id < 13.5) { if (abs(p.y - 6.) < .1) { emit = 2.; return vec3(1.,.5,1.); } return mix(vec3(.62,.5,.72), vec3(.42,.33,.5), g); } // big hall walls
  if (id < 14.5) return mix(vec3(.7,.68,.62), vec3(.5,.48,.44), g);
  if (id < 15.5) {
    if (n.y < -.5 && p.x > 7. && p.x < 15.) { emit = 3.; return vec3(1.,.7,.3); }                          // pit room roof: glowing hole rim
    return vec3(.3);
  }
  if (n.y < -.5) { if (abs(p.x + 10.) < .3) { emit = 1.2; return vec3(1.,1.,.6); } return vec3(.32,.3,.36); }  // stairs ceiling
  if (fract(abs(p.z)) > .9 && n.y > .5) { emit = 1.2; return vec3(1.,.95,.5); }                         // step nosings
  return mix(vec3(.82,.84,.92), vec3(.6,.62,.7), g);
}
`;

  // ---------------- minimap (top-down, base B up) ----------------
  function drawMap(ctx, W, Hh, world) {
    const x0 = -34, x1 = 72, z0 = -84, z1 = 84, s = Math.min((W - 12) / (x1 - x0), (Hh - 24) / (z1 - z0));
    const ox = (W - (x1 - x0) * s) / 2, oy = 18;
    const Pt = (x, z) => [ox + (x - x0) * s, oy + (z1 - z) * s];
    const rect = (a, b, c, d) => { const p = Pt(a, d), q = Pt(c, b); return [p[0], p[1], q[0] - p[0], q[1] - p[1]]; };
    ctx.save();
    ctx.font = '10px Consolas, monospace';
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('ARENA PĘTLI', 6, 12);
    for (const sg of [-1, 1]) {
      const R = (a, b, c, d, col) => { ctx.fillStyle = col; ctx.fillRect(...rect(a, sg < 0 ? b : -d, c, sg < 0 ? d : -b)); };
      R(-16, -82, 16, -66, sg < 0 ? 'rgba(110,150,255,.2)' : 'rgba(255,120,110,.2)');
      R(-11.5, -65, -8.5, -42, 'rgba(255,255,120,.15)'); R(-1.5, -65, 1.5, -42, 'rgba(255,255,255,.08)');
      R(5, -62, 17, -44, 'rgba(255,255,255,.08)'); R(-24, -41, 24, -36, 'rgba(120,255,255,.1)');
      R(50, -63, 70, -43, 'rgba(255,140,255,.12)');
      R(-1.5, -35, 1.5, -14, 'rgba(255,255,255,.08)'); R(18.5, -35, 21.5, -11, 'rgba(255,255,255,.08)');
    }
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(...rect(-22, -35, -18, 35)); ctx.fillRect(...rect(12, -10, 28, 10));
    for (const zc of SIDE_Z) ctx.fillRect(...rect(-30, zc - 2, -12, zc + 2));
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    for (const [a, b, c, d] of HOLES) ctx.fillRect(...rect(a, c, b, d));
    for (const m of MODULES) for (const b of m.boxes) {
      if (b[1] > 2.9 || b[4] < -1) continue;
      ctx.fillStyle = b[1] < 0 ? 'rgba(255,200,90,.8)' : b[4] > 2 ? 'rgba(210,205,220,.7)' : 'rgba(220,150,90,.6)';
      const r = rect(b[0], b[2], b[3], b[5]);
      ctx.fillRect(r[0], r[1], Math.max(1, r[2]), Math.max(1, r[3]));
    }
    ctx.lineWidth = 2;
    for (const q of PORTALS) {
      ctx.strokeStyle = q.col;
      if (q.axis === 1) continue;
      const [a, b] = q.axis === 0 ? [Pt(q.c, q.span[1][0]), Pt(q.c, q.span[1][1])] : [Pt(q.span[0][0], q.c), Pt(q.span[0][1], q.c)];
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // the booth leads into the big hall
    ctx.strokeStyle = 'rgba(255,140,255,.5)'; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
    for (const sg of [-1, 1]) { const a = Pt(2.5, sg * 53), b = Pt(50, sg * 53); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    for (const [x, z, t] of [[-15, -75, 'A'], [-15, 77, 'B'], [-33, -48, 'schody∞'], [51, -66, 'wnętrze budki'], [-33, 37, 'boczne∞'], [12, 13, '∞plac']]) { const p = Pt(x, z); ctx.fillText(t, p[0], p[1]); }
    // others (when visible or just shot) and you
    for (const o of world.figures()) {
      if (!o.show || !o.onMap) continue;
      const p = Pt(o.p[0], o.p[2]);
      ctx.fillStyle = '#f44'; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 2 * Math.PI); ctx.fill();
    }
    const pl = world.player, me = Pt(pl.pos[0], pl.pos[2]), f = pl.forward;
    const ang = Math.atan2(-f[2], f[0]);
    ctx.fillStyle = '#fff'; ctx.beginPath();
    ctx.moveTo(me[0] + Math.cos(ang) * 6, me[1] + Math.sin(ang) * 6);
    ctx.lineTo(me[0] + Math.cos(ang + 2.5) * 4, me[1] + Math.sin(ang + 2.5) * 4);
    ctx.lineTo(me[0] + Math.cos(ang - 2.5) * 4, me[1] + Math.sin(ang - 2.5) * 4);
    ctx.fill();
    ctx.restore();
  }

  // ---------------- the world ----------------
  const SPAWN_A = [[-12, -75], [12, -75], [-6, -70], [6, -70], [0, -80.5]];
  const SPAWN_B = SPAWN_A.map(([x, z]) => [x, -z]);
  const capsule = (q, feet) => Math.hypot(q[0] - feet[0], q[1] - WM.clamp(q[1], feet[1] + 0.1, feet[1] + 1.6), q[2] - feet[2]) < 0.42;
  const world = {
    name: 'Arena pętli',
    id: 'arena',
    subtitle: 'Długa mapa: dwie bazy i trzy ścieżki, w których prawie każde miejsce jest zapętlone — bazy i węzły ciągną się w bok bez końca, schody Penrose\'a (wchodzisz w górę, a jesteś na tym samym poziomie), budka większa w środku, sala ze studnią i mostkiem, korytarz z trzema sklejonymi bocznymi przejściami, hala bez podłogi i plac-torus. Pojedynek z botem albo gra sieciowa z drugim graczem.',
    tags: ['pojedynek', 'bot', 'gra sieciowa'],
    help: ['WASD ruch · Spacja skok · Shift bieg', 'LPM strzał · R przeładuj (12 naboi)', 'mapka: kolorowe linie = sklejone miejsca', 'Esc — menu (tryb gry)', 'N noclip'],
    modes: [{ label: 'Zwiedzanie', opts: { mode: 0 } }, { label: 'Bot: łatwy', opts: { mode: 1 } }, { label: 'Bot: trudny', opts: { mode: 2 } }, { label: 'Gra sieciowa', opts: { mode: 3 } }],
    shader: () => WG.euclid(code, '#define PORTALS\n#define FOG_DENS .011\n#define MAX_T 170.\n#define SUN_DIR normalize(vec3(.45,.8,.25))\n'),
    reverb: 0.15,
    mode: 0, score: [0, 0], playerAlive: true, rivalShotT: -9, rivalSeen: false, respawnT: 0, team: 'A',
    aim() { return this.player.aim(); },
    canFire() { return this.playerAlive; },
    // a spawn point of the team, preferably far from (and not visible to) the enemies
    spawn(list, enemies) {
      let best = null, bd = -Infinity;
      for (const [x, z] of list) {
        const p = [x, groundAt(x, 3, z), z];
        let d = Math.random() * 8;
        for (const e of enemies) d += Math.min(60, Math.hypot(x - e[0], z - e[2])) + (los([x, p[1] + 1.5, z], e) ? 0 : 30);
        if (d > bd) { bd = d; best = p; }
      }
      return best;
    },
    ownSpawns() { return this.team === 'B' ? SPAWN_B : SPAWN_A; },
    enemyEyes() {
      if (this.isBot()) return this.rival.dead < 0 ? [this.rival.eye] : [];
      return WMP.avatars(this).filter(a => a.alive).map(a => [a.g.p[0], a.g.p[1] + 1.55, a.g.p[2]]);
    },
    isBot() { return this.mode === 1 || this.mode === 2; },
    // the bot shoots at the nearest living player it can see (or the nearest one): { pos (eye), vel, alive }
    botTarget(from) {
      const c = [];
      if (this.playerAlive && !WMP.dead()) c.push({ pos: this.player.pos, vel: this.player.vel, alive: true });
      for (const a of WMP.avatars(this)) if (a.alive) c.push({ pos: [a.g.p[0], a.g.p[1] + WPlayer.EYE, a.g.p[2]], vel: [0, 0, 0], alive: true });
      let best = null, bd = Infinity;
      for (const t of c) {
        const d = WM.len(WM.sub(t.pos, from)) + (los(from, t.pos) ? 0 : 1000);
        if (d < bd) { bd = d; best = t; }
      }
      return best;
    },
    respawnMe() {
      const sp = this.spawn(this.ownSpawns(), this.enemyEyes());
      this.player.reset([sp[0], sp[1] + WPlayer.EYE, sp[2]], this.team === 'B' ? Math.PI : 0);
      this.health = this.isBot() ? 100 : null; this.playerAlive = true; WGun.refill();
    },
    enter(opts = {}) {
      buildNav();
      if (!this.player) {
        this.player = new WPlayer(3, { spawn: [0, WPlayer.EYE, -75] });
        this.player.onStep = (a, b) => { const off = crossPortal(a, b); if (off) for (let i = 0; i < 3; i++) b[i] += off[i]; };
        this.rival = new Rival(this);
        this.bullets = new WBullets(WBallistics.flat(3, { speed: BULLET_SPEED, gravity: BULLET_G, cross: crossPortal }), { hitTest: q => this.myBulletHit(q) });
        // the bot's bullets: the room's leader decides whom they hit (you or another player); for the others they are visual
        this.rivalShots = new WBullets(WBallistics.flat(3, { speed: BULLET_SPEED, gravity: BULLET_G, cross: crossPortal }), {
          hitTest: q => {
            if (!WMP.isLeader(this)) return this.playerAlive && capsule(q, this.feet());
            const t = WMP.targets(this).find(t => capsule(q, [t.eye[0], t.eye[1] - WPlayer.EYE, t.eye[2]]));
            if (t) { WMP.hurt(this, t, DMG); return true; }
            return false;
          },
        });
      }
      if (opts.mode != null) { this.mode = opts.mode; this.score = [0, 0]; }
      this.diff = DIFF[this.mode] || DIFF[1];
      // teams (spawn bases) only in the network game; otherwise everybody starts in base A
      this.team = this.mode === 3 && WMP.online() ? WNet.team : 'A';
      if (this.mode === 3 && !WMP.online()) WE.toast('Gra sieciowa: uruchom skrót „Wymiary – gra sieciowa (serwer)”, a drugi gracz „Wymiary – dołącz do gry”. Na każdej mapie można grać razem.', 7000);
      this.rivalShots.clear(); this.mePh = 0;
      this.rival.hp = 0; this.rival.dead = 99;
      this.respawnMe();
      if (this.isBot()) {
        this.rival.reset(this.spawn(SPAWN_B, [this.player.pos]));
        if (!WMP.isLeader(this)) this.rival.dead = 99;           // the leader's bot arrives with its first snapshot
        WE.toast('Pojedynek! Bot startuje z bazy B.', 2500);
      }
    },
    feet() { const p = this.player.pos; return [p[0], p[1] - WPlayer.EYE, p[2]]; },
    myBulletHit(q) {
      if (this.isBot()) {
        if (WMP.isLeader(this)) return this.rival.hit(q);
        if (!this.rival.inBody(q)) return false;
        this.rival.flash = 1; WMP.aiHit(this, 0, DMG);           // co-op: the leader runs the bot
        return true;
      }
      return WMP.hitPeers(q);
    },
    damage(n, from) {
      if (this.health == null || !this.playerAlive) return;
      this.health = Math.max(0, this.health - n);
      WE.hurt();
      if (this.health <= 0) {
        this.playerAlive = false; this.respawnT = 2.5;
        WMP.reportDeath(this, from);
        if (this.isBot()) {
          if (WMP.isLeader(this)) this.score[1]++;
          WE.toast(`Zginąłeś! ${this.score[0]} : ${this.score[1]}`, 2500);
        } else WE.toast(typeof from === 'number' ? `Zabił cię gracz ${from}!` : 'Zginąłeś!', 2000);
      }
    },
    // another player of the room died (co-op with the bot: the leader keeps the score)
    onPeerDeath(m) { if (this.isBot() && m.by === 'ai' && WMP.isLeader(this)) this.score[1]++; },
    // ---- the bot over the network (co-op): snapshot from the leader, hits from the others ----
    netExport() { const r = this.rival; return { p: r.p, yaw: r.yaw || 0, ph: r.ph || 0, hp: r.hp, dead: r.dead, score: this.score }; },
    netImport(d) {
      const r = this.rival, now = performance.now() / 1000;
      r.prev = r.dead < 0 && d.dead < 0 && r.next ? [r.p[0], r.p[1], r.p[2], r.yaw] : [...d.p, d.yaw];
      r.next = [...d.p, d.yaw]; r.tP = r.tA || now - 0.08; r.tA = now;
      if (d.hp < r.hp) r.flash = 1;
      if (d.dead >= 0 && r.dead < 0) WAudio.at(this, r.eye, 'death');
      r.hp = d.hp; r.dead = d.dead < 0 ? -1 : Math.max(r.dead, d.dead); r.ph = d.ph; this.score = d.score;
    },
    netDamage(slot, dmg) { this.rival.takeDamage(dmg); },
    followBot(dt) {
      const r = this.rival, now = performance.now() / 1000;
      r.flash = Math.max(0, r.flash - dt * 4);
      if (r.dead >= 0) r.dead += dt;
      if (r.next) {
        const f = WM.clamp((now - r.tA) / Math.max(0.03, r.tA - r.tP), 0, 1), a = r.prev, b = r.next;
        if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > 3) { r.p = b.slice(0, 3); r.yaw = b[3]; }
        else { let dy = b[3] - a[3]; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.p = [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * f); r.yaw = a[3] + dy * f; }
      }
    },
    rivalDied() {
      this.score[0]++; this.respawnRival = 2.5;
      WAudio.at(this, this.rival.eye, 'death');
      WE.toast(`Bot pokonany! ${this.score[0]} : ${this.score[1]}`, 2500);
    },
    update(dt, look) {
      const pl = this.player;
      if (this.playerAlive) pl.update(dt, look);
      else { this.respawnT -= dt; if (this.respawnT <= 0) this.respawnMe(); }
      pl.vel[1] = Math.max(pl.vel[1], -25);
      this.mePh += Math.hypot(pl.vel[0], pl.vel[2]) * dt * 2.4;
      if (this.isBot() && !WMP.isLeader(this)) this.followBot(dt);
      else if (this.isBot()) {
        this.rival.update(dt);
        if (this.respawnRival != null) {
          this.respawnRival -= dt;
          if (this.respawnRival <= 0) { this.respawnRival = null; this.rival.reset(this.spawn(SPAWN_B, [pl.pos])); }
        }
        if (this.rival.vis && this.rival.cool > (this.diff.gap - 0.05)) this.rivalShotT = WE.time;
      }
      // nobody walks through anybody
      for (const o of this.figures()) {
        if (!o.alive) continue;
        const dx = pl.pos[0] - o.p[0], dz = pl.pos[2] - o.p[2], d = Math.hypot(dx, dz), dy = pl.pos[1] - 1.6 - o.p[1];
        if (d < 0.75 && Math.abs(dy) < 1.7 && d > 1e-3) { pl.pos[0] += dx / d * (0.75 - d); pl.pos[2] += dz / d * (0.75 - d); }
      }
      if (this.isBot()) this.rivalShots.update(dt);
    },
    // everybody else, uniformly: { p: feet, yaw, ph, hp, flash, dead, alive, show, onMap }
    figures() {
      const out = WMP.avatars(this).map(a => {
        const seen = a.alive && los(this.player.pos, [a.g.p[0], a.g.p[1] + 1.2, a.g.p[2]]);
        return { p: a.g.p, yaw: a.g.yaw, ph: WE.time * 6, hp: a.hp, flash: a.flash, dead: a.dead, alive: a.alive, show: true, onMap: seen, type: a.type };
      });
      if (!this.isBot()) return out;
      const r = this.rival;
      if (r.dead < 0) this.rivalSeen = los(this.player.pos, [r.p[0], r.p[1] + 1.2, r.p[2]]);
      return [{ p: r.p, yaw: r.yaw || 0, ph: r.ph || 0, hp: Math.max(r.hp, 0), flash: r.flash || 0, dead: r.dead, alive: r.dead < 0, show: r.dead < 1.6,
        onMap: r.dead < 0 && (this.rivalSeen || WE.time - this.rivalShotT < 1.5), type: 3 }, ...out];
    },
    setBulletUniforms(gl, p) { WBullets.upload(gl, p, [[this.bullets, 0], [this.rivalShots, 1], ...WMP.extraBullets(this).map(([l, e]) => [l, e ? 1 : 0])]); },
    setUniforms(gl, prog) {
      const pl = this.player, f = pl.forward;
      pl.setUniforms3(gl, prog);
      gl.uniform1i(prog.u('uNM'), GROUPS.length);
      if (!tabTex) {
        tabTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tabTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TW, 7, 0, gl.RGBA, gl.FLOAT, TAB);
      }
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, tabTex);
      gl.uniform1i(prog.u('uTab'), 2);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform4f(prog.u('uMe'), pl.pos[0], pl.pos[1] - WPlayer.EYE, pl.pos[2], Math.atan2(f[0], f[2]));
      gl.uniform1f(prog.u('uMePh'), this.mePh || 0);
      const figs = this.figures().slice(0, MAXF);
      const a = new Float32Array(MAXF * 4), s = new Float32Array(MAXF * 4), ph = new Float32Array(MAXF);
      figs.forEach((o, i) => {
        a.set([o.p[0], o.p[1], o.p[2], o.yaw], i * 4);
        s.set([o.show ? o.hp / 100 : -1, o.flash, o.dead, o.type || 3], i * 4);
        ph[i] = o.ph;
      });
      gl.uniform4fv(prog.u('uOth'), a);
      gl.uniform4fv(prog.u('uOthS'), s);
      gl.uniform1fv(prog.u('uOthPh'), ph);
      gl.uniform1i(prog.u('uOthN'), figs.length);
    },
    overlaySize: [230, 380],
    drawOverlay(ctx, W, Hh) { drawMap(ctx, W, Hh, this); },
    duelHud() {
      if (!this.isBot()) return '';
      const r = this.rival, hp = r.dead < 0 ? Math.max(0, r.hp) : 0;
      return `<div class="score">${WMP.roomPeers(this).length ? 'WY' : 'TY'} ${this.score[0]} : ${this.score[1]} BOT</div>` +
        `<div class="bar"><div style="width:${hp}%"></div></div><div style="font-size:12px;opacity:.8">bot ${hp} HP</div>`;
    },
    stats() {
      const p = this.player.pos, r = this.rival;
      return `pozycja ${p.map(v => v.toFixed(1)).join(', ')}` + (this.mode === 3 ? `\ndrużyna ${this.team}` : '') + (this.isBot() ? `\nbot: ${r.dead >= 0 ? 'nie żyje' : r.state} · ${r.ammo}/${MAG} naboi` : '');
    },
    // multiplayer (js/mp.js)
    ai() { return this.isBot() ? { shots: this.rivalShots, netExport: () => this.netExport(), netImport: d => this.netImport(d), netDamage: (s, d) => this.netDamage(s, d) } : null; },
    playerPoints() { const p = this.player.pos; return { eye: p, body: [p, [p[0], p[1] - 0.8, p[2]], [p[0], p[1] - 1.3, p[2]]] }; },
    mp: {
      space: WSwarm.spaces.torus([1e9, 1e9, 1e9]),
      me() { const pl = world.player, f = pl.forward; return { p: world.feet(), yaw: Math.atan2(f[0], f[2]) }; },
      respawn() { world.respawnMe(); },
    },
    _test: { sdf, groundAt, los, NODES, ADJ, buildNav, nearestNode, dijkstra, pathTo, crossPortal, PORTALS },
  };
  WE.register(world);
  // build the navigation graph in the background while the menu is shown (~1-2 s of CPU)
  if (typeof window.document !== 'undefined' && window.setTimeout) setTimeout(() => { try { buildNav(); } catch (e) { console.error(e); } }, 3000);
})();
