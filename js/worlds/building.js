// KORYTARZE K — a building of 5 × 5 rooms joined by corridors, in a space whose curvature you control.
// The metric is conformally flat, g = e^{2 phi(x)} * euclidean, with phi = phi_global + phi_rooms + phi_sources:
//  * global: phi = -ln(1 + K r^2/4) around the map centre — the WHOLE map lies in a space of constant
//    curvature K (stereographic chart of S3 for K>0, Poincaré ball of H3 for K<0);
//  * rooms and corridors: almost every room and corridor has its OWN curvature — a bubble of constant K
//    (same formula) filling it and fading out at its doorways (tables ROOM_K / COR_X / COR_Z);
//  * sources: monsters and their projectiles carry moving bubbles of curvature (same formula, faded out
//    between radius R and R2).
// Light rays, bullets, sound and walking all follow this metric.
(function () {
  const CENTER = [0, 2, 0];
  // slider position s in [-1,1] -> K (asymmetric: a Poincaré ball must still contain the building)
  const K_NEG = 0.0015, K_POS = 0.05;  // at K_NEG the whole building (r < 52) still fits into the Poincaré ball
  const S = { g: 0 };
  const globalK = () => (S.g < 0 ? S.g * K_NEG : S.g * K_POS);
  let zones = [];                      // moving curvature sources: [x, y, z, K, R, R2]
  // static curvature of the rooms (5 × 5, index (i+2) + 5 (j+2)) and of the corridors between them:
  // COR_X[(i+2) + 4 (j+2)] joins rooms (i, j) and (i+1, j), COR_Z[(i+2) + 5 (j+2)] joins (i, j) and (i, j+1)
  const ROOM_K = [
    0.05, -0.04, 0.03, -0.05, 0.06,
    -0.03, 0.06, -0.045, 0.04, -0.02,
    0.04, -0.05, 0, 0.055, -0.04,
    -0.05, 0.03, -0.035, -0.02, 0.05,
    0.06, -0.025, 0.045, -0.05, 0.035];
  const CK = [0.3, -0.22, 0.15, 0, -0.18, 0.35, -0.12, 0.22, -0.25, 0];
  const COR_X = Array.from({ length: 20 }, (_, k) => CK[(k * 3) % 10]);
  const COR_Z = Array.from({ length: 20 }, (_, k) => CK[(k * 7 + 4) % 10]);
  const ROOM_R = [4, 7], COR_R = [1.5, 3.2];
  const MAXZ = 24;

  // Smooth lower bound keeps 1 + K r^2/4 positive (no hard kink — a kink bends rays like a mirror).
  const FLOOR = 0.12, SOFT = 0.04;
  // Negative K of a bubble is capped so it stays well inside its Poincaré ball (scale e^phi <= ~3.3);
  // otherwise the bubble becomes an infinite hyperbolic space that traps light rays.
  const zoneK = z => Math.max(z[3], -2.8 / (z[5] * z[5]));
  // constant-curvature term at radius r: sets tL = L(r), tD = dL/dr   (allocation-free: used in hot loops)
  let tL = 0, tD = 0;
  function term(K, r) {
    const a = 1 + K * r * r / 4, x = (a - FLOOR) / SOFT;
    const as = FLOOR + SOFT * (Math.max(x, 0) + Math.log1p(Math.exp(-Math.abs(x))));
    tL = -Math.log(as);
    tD = -(K * r / 2) / as / (1 + Math.exp(-x));
  }
  const clampI = v => Math.max(-2, Math.min(2, v));
  // writes [dphi/dx, dphi/dy, dphi/dz, phi] into o
  function metricInto(x, y, z, o) {
    let gx = 0, gy = 0, gz = 0, ph = 0;
    const Kg = globalK();
    if (Kg !== 0) {
      const dx = x - CENTER[0], dy = y - CENTER[1], dz = z - CENTER[2], r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      term(Kg, r);
      const q = tD / Math.max(r, 1e-4);
      ph += tL; gx += q * dx; gy += q * dy; gz += q * dz;
    }
    const bubble = (dx, dy, dz, K, R, R2) => {
      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 >= R2 * R2 || K === 0) return;
      const r = Math.sqrt(r2);
      term(Math.max(K, -2.8 / (R2 * R2)), r);
      const sm = Math.min(1, Math.max(0, (r - R) / (R2 - R))), w = 1 - sm * sm * (3 - 2 * sm);
      const dw = sm > 0 && sm < 1 ? -6 * sm * (1 - sm) / (R2 - R) : 0;
      const q = (dw * tL + w * tD) / Math.max(r, 1e-4);
      ph += w * tL; gx += q * dx; gy += q * dy; gz += q * dz;
    };
    // the room you are in and the two nearest corridors
    const ci = clampI(Math.floor(x / 16 + 0.5)), cj = clampI(Math.floor(z / 16 + 0.5));
    const xi = Math.max(-2, Math.min(1, Math.floor(x / 16))), zj = Math.max(-2, Math.min(1, Math.floor(z / 16)));
    bubble(x - 16 * ci, y - 2, z - 16 * cj, ROOM_K[ci + 2 + 5 * (cj + 2)], ROOM_R[0], ROOM_R[1]);
    bubble(x - 16 * xi - 8, y - 1.5, z - 16 * cj, COR_X[xi + 2 + 4 * (cj + 2)], COR_R[0], COR_R[1]);
    bubble(x - 16 * ci, y - 1.5, z - 16 * zj - 8, COR_Z[ci + 2 + 5 * (zj + 2)], COR_R[0], COR_R[1]);
    for (let i = 0; i < zones.length; i++) { const Z = zones[i]; bubble(x - Z[0], y - Z[1], z - Z[2], Z[3], Z[4], Z[5]); }
    o[0] = gx; o[1] = gy; o[2] = gz; o[3] = ph;
    return o;
  }
  const metric = p => metricInto(p[0], p[1], p[2], [0, 0, 0, 0]);
  // sectional curvature estimate from the scalar curvature: R = -e^{-2phi}(4 lap(phi) + 2 |grad phi|^2), K = R/6
  function localK(p) {
    const h = 0.05, m = metric(p);
    let lap = 0;
    for (let k = 0; k < 3; k++) {
      const a = p.slice(), b = p.slice(); a[k] += h; b[k] -= h;
      lap += (metric(a)[3] + metric(b)[3] - 2 * m[3]) / (h * h);
    }
    const g2 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2];
    return -Math.exp(-2 * m[3]) * (4 * lap + 2 * g2) / 6;
  }

  // ---- static geometry on the CPU (same shapes as map() in the shader): monsters' collisions, line of sight ----
  const clamp = WM.clamp;
  function sdBox(x, y, z, bx, by, bz) {
    const qx = Math.abs(x) - bx, qy = Math.abs(y) - by, qz = Math.abs(z) - bz;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
  }
  const blockH = (i, j) => ((((i + 2 * j + 3) % 3) + 3) % 3) * 0.25;
  function sdf(p) {
    const [x, y, z] = p;
    const ri = clamp(Math.floor(x / 16 + 0.5), -2, 2), rj = clamp(Math.floor(z / 16 + 0.5), -2, 2);
    const rx = 16 * ri, rz = 16 * rj;
    const room = sdBox(x - rx, y - 2, z - rz, 5, 2, 5);
    const cx = clamp(Math.floor(x / 16), -2, 1) * 16 + 8, cz = clamp(Math.floor(z / 16), -2, 1) * 16 + 8;
    const air = Math.min(room, sdBox(x - cx, y - 1.5, z - rz, 4.5, 1.5, 1.5), sdBox(x - rx, y - 1.5, z - cz, 1.5, 1.5, 4.5));
    let d = -air;
    d = Math.min(d, sdBox(Math.abs(x - rx) - 2.8, y - 2, Math.abs(z - rz) - 2.8, 0.3, 2, 0.3));
    const h = blockH(ri, rj);
    d = Math.min(d, sdBox(x - rx + 1.3, y - 0.5 - h, z - rz - 1.3, 0.55, 0.5 + h, 0.55));
    return d;
  }
  function los(a, b) {
    const d = WM.sub(b, a), L = WM.len(d), u = WM.scale(d, 1 / L);
    for (let t = 0.3; t < L - 0.3;) {
      const s = sdf(WM.addScaled(a, u, t));
      if (s < 0.05) return false;
      t += Math.max(s, 0.05);
    }
    return true;
  }

  // ---- navigation graph: room centres + corridor midpoints, next-hop table by BFS ----
  const NODES = [], ADJ = [], idx = {};
  const addNode = (key, x, z) => { idx[key] = NODES.length; NODES.push([x, z]); ADJ.push([]); };
  const link = (a, b) => { ADJ[a].push(b); ADJ[b].push(a); };
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) addNode(`r${i},${j}`, 16 * i, 16 * j);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    if (i < 2) { addNode(`x${i},${j}`, 16 * i + 8, 16 * j); link(idx[`x${i},${j}`], idx[`r${i},${j}`]); link(idx[`x${i},${j}`], idx[`r${i + 1},${j}`]); }
    if (j < 2) { addNode(`z${i},${j}`, 16 * i, 16 * j + 8); link(idx[`z${i},${j}`], idx[`r${i},${j}`]); link(idx[`z${i},${j}`], idx[`r${i},${j + 1}`]); }
  }
  const NEXT = NODES.map((_, dst) => {
    // BFS from the destination: next[src] = neighbour of src that is closer to dst
    const dist = NODES.map(() => Infinity); dist[dst] = 0;
    const q = [dst];
    while (q.length) { const a = q.shift(); for (const b of ADJ[a]) if (dist[b] === Infinity) { dist[b] = dist[a] + 1; q.push(b); } }
    return NODES.map((_, src) => src === dst ? dst : ADJ[src].reduce((best, b) => (dist[b] < dist[best] ? b : best), ADJ[src][0]));
  });
  const next = NODES.map((_, src) => NODES.map((_, dst) => NEXT[dst][src]));
  const nearestNode = p => {
    let best = 0, bd = Infinity;
    NODES.forEach(([x, z], i) => { const d = (p[0] - x) ** 2 + (p[2] - z) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const SPAWNS = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 1], [-2, -1], [1, -2], [-1, 2]].map(([i, j]) => [16 * i, 16 * j - 2]);

  // Sound: a fan of rays is traced from the source along geodesics of the metric. Rays passing close to the
  // listener (within a cone of half-width k*s) are collected; groups with the same path length are separate
  // arrivals. Their count relative to flat space gives the focusing/defocusing of the sound by curvature
  // (ray-tube intensity), the path length gives the delay, the arrival direction gives the stereo pan.
  // Walls are ignored — this is about what the geometry itself does to the sound.
  // The work is sliced into chunks of rays (run between frames) so a shot never stalls rendering;
  // echoes arrive tens of ms later anyway. Results for your own shot are cached while you stand still.
  function soundRaysAsync(src, lis, own, right, fwd, done) {
    const N = own ? 200 : 180, k = 0.3, Lmax = own ? 90 : 70;
    const m = [0, 0, 0, 0], hits = [];
    const nL = Math.exp(metricInto(lis[0], lis[1], lis[2], m)[3]);
    const lx = lis[0], ly = lis[1], lz = lis[2];
    let i = 0;
    const trace = end => {
      for (; i < end; i++) {
        const yy = 1 - 2 * (i + 0.5) / N, rr = Math.sqrt(1 - yy * yy), th = i * 2.399963;
        let ux = rr * Math.cos(th), uy = yy, uz = rr * Math.sin(th);
        let px = src[0], py = src[1], pz = src[2], s = 0, steps = 0;
        let prev = Infinity, prevS = 0, px0 = ux, py0 = uy, pz0 = uz, closing = false;
        while (s < Lmax && steps++ < 600) {
          metricInto(px, py, pz, m);
          const n = Math.exp(m[3]), gl = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
          const h = Math.min(1, 0.08 * n / Math.max(gl, 1e-6));        // metric step: turn <= 0.08 rad
          const hc = h / n, gu = m[0] * ux + m[1] * uy + m[2] * uz;
          ux += (m[0] - gu * ux) * hc; uy += (m[1] - gu * uy) * hc; uz += (m[2] - gu * uz) * hc;
          const ul = Math.sqrt(ux * ux + uy * uy + uz * uz); ux /= ul; uy /= ul; uz /= ul;
          px += ux * hc; py += uy * hc; pz += uz * hc; s += h;
          if (s < (own ? 3 : 0.3)) continue;
          const dm = Math.sqrt((px - lx) ** 2 + (py - ly) ** 2 + (pz - lz) ** 2) * nL;
          if (dm < prev) closing = true;
          else if (closing) {               // the previous sample was the closest approach of this pass
            if (prev < k * prevS) hits.push({ s: prevS, u: [px0, py0, pz0] });
            closing = false;
          }
          prev = dm; prevS = s; px0 = ux; py0 = uy; pz0 = uz;
          if (Math.abs(px) + Math.abs(py) + Math.abs(pz) > 1e5) break;
        }
      }
    };
    const finish = () => {
      hits.sort((p, q) => p.s - q.s);
      const out = [];
      for (let j0 = 0; j0 < hits.length;) {
        let j = j0, us = [0, 0, 0], ss = 0;
        while (j < hits.length && hits[j].s - hits[j0].s < Math.max(2, 0.15 * hits[j0].s)) { us = WM.add(us, hits[j].u); ss += hits[j].s; j++; }
        const cnt = j - j0, sm = ss / cnt, from = WM.scale(WM.norm(us), -1);
        out.push({ delay: sm / WAudio.C, gain: Math.sqrt((cnt / N) / (k * k / 4)) / Math.max(sm, 1), pan: WM.dot(from, right), dist: sm, muffle: WM.dot(from, fwd) < -0.3 });
        j0 = j;
      }
      done(out);
    };
    if (!done.async) { trace(N); return finish(); }
    const chunk = () => { trace(Math.min(N, i + 25)); if (i < N) setTimeout(chunk, 0); else finish(); };
    chunk();
  }
  let ownCache = null;

  const f = x => x.toFixed(3);
  const code = `
uniform float uGK;
uniform vec4 uZC[${MAXZ}];   // moving curvature sources: centre, K
uniform vec2 uZR[${MAXZ}];   // R, R2
uniform int uZN;
uniform vec4 uMon[${WHorde.MAX}], uMonS[${WHorde.MAX}];   // monsters: position + yaw; hp, hit flash, death time, type
uniform int uMonN;
uniform float uRoomK[25], uCorX[20], uCorZ[20];   // own curvature of every room and corridor (see ROOM_K)
const vec3 MAPC = vec3(${CENTER.join('.,')}.);
float softplus(float x){ return max(x, 0.) + log(1. + exp(-abs(x))); }
vec2 kterm(float K, float r){
  float a = 1. + K*r*r*.25, as = ${FLOOR} + ${SOFT}*softplus((a - ${FLOOR})/${SOFT});
  return vec2(-log(as), -(K*r*.5)/as/(1. + exp(-(a - ${FLOOR})/${SOFT})));
}
void bubble(vec3 d, float K, float R, float R2, inout vec4 m){
  float r2 = dot(d,d);
  if (r2 >= R2*R2 || K == 0.) return;
  float r = sqrt(r2);
  vec2 t = kterm(max(K, -2.8/(R2*R2)), r);
  float s = clamp((r - R)/(R2 - R), 0., 1.), w = 1. - s*s*(3.-2.*s);
  float dw = (s > 0. && s < 1.) ? -6.*s*(1.-s)/(R2 - R) : 0.;
  m.w += w*t.x;
  m.xyz += (dw*t.x + w*t.y)*d/max(r, 1e-4);
}
// the room around p and the two nearest corridors: (centre, K) — room in .x row, corridors after
vec2 cellRoom(vec3 p){ return clamp(floor(p.xz/16. + .5), -2., 2.); }
void staticZones(vec3 p, inout vec4 m){
  vec2 c = cellRoom(p);
  float xi = clamp(floor(p.x/16.), -2., 1.), zj = clamp(floor(p.z/16.), -2., 1.);
  bubble(p - vec3(c.x*16., 2., c.y*16.), uRoomK[int(c.x + 2.) + 5*int(c.y + 2.)], ${ROOM_R[0]}., ${ROOM_R[1]}., m);
  bubble(p - vec3(xi*16. + 8., 1.5, c.y*16.), uCorX[int(xi + 2.) + 4*int(c.y + 2.)], ${COR_R[0]}, ${COR_R[1]}, m);
  bubble(p - vec3(c.x*16., 1.5, zj*16. + 8.), uCorZ[int(c.x + 2.) + 5*int(zj + 2.)], ${COR_R[0]}, ${COR_R[1]}, m);
}
vec4 metric(vec3 p){
  vec4 m = vec4(0);
  staticZones(p, m);
  if (uGK != 0.) {
    vec3 d = p - MAPC; float r = length(d);
    vec2 t = kterm(uGK, r);
    m.w += t.x; m.xyz += t.y*d/max(r, 1e-4);
  }
  for (int i = 0; i < ${MAXZ}; i++){
    if (i >= uZN) break;
    vec3 d = p - uZC[i].xyz; float r2 = dot(d,d), R2 = uZR[i].y;
    if (r2 >= R2*R2) continue;
    float r = sqrt(r2);
    vec2 t = kterm(max(uZC[i].w, -2.8/(R2*R2)), r);
    float s = clamp((r - uZR[i].x)/(R2 - uZR[i].x), 0., 1.), w = 1. - s*s*(3.-2.*s);
    float dw = (s > 0. && s < 1.) ? -6.*s*(1.-s)/(R2 - uZR[i].x) : 0.;
    m.w += w*t.x;
    m.xyz += (dw*t.x + w*t.y)*d/max(r, 1e-4);
  }
  return m;
}
// do not step blindly into a bubble (its field only starts at R2)
float stepLimit(vec3 p){
  float l = 1e9;
  vec2 c = cellRoom(p);
  float xi = clamp(floor(p.x/16.), -2., 1.), zj = clamp(floor(p.z/16.), -2., 1.);
  float dr = length(p - vec3(c.x*16., 2., c.y*16.)) - ${ROOM_R[1]}.;
  if (dr > 0. && uRoomK[int(c.x + 2.) + 5*int(c.y + 2.)] != 0.) l = dr + .3;
  float dx = length(p - vec3(xi*16. + 8., 1.5, c.y*16.)) - ${COR_R[1]};
  if (dx > 0. && uCorX[int(xi + 2.) + 4*int(c.y + 2.)] != 0.) l = min(l, dx + .3);
  float dz = length(p - vec3(c.x*16., 1.5, zj*16. + 8.)) - ${COR_R[1]};
  if (dz > 0. && uCorZ[int(c.x + 2.) + 5*int(zj + 2.)] != 0.) l = min(l, dz + .3);
  for (int i = 0; i < ${MAXZ}; i++){ if (i >= uZN) break; l = min(l, max(length(p - uZC[i].xyz) - uZR[i].y, 0.) + .3); }
  return l;
}
// curvature used for colouring: global + bubbles
float zoneK(vec3 p){
  float k = (uGK < 0. ? uGK/${K_NEG} : uGK/${K_POS})*.24;
  vec2 c = cellRoom(p);
  float xi = clamp(floor(p.x/16.), -2., 1.), zj = clamp(floor(p.z/16.), -2., 1.);
  float sr = clamp((length(p - vec3(c.x*16., 2., c.y*16.)) - ${ROOM_R[0]}.)/${ROOM_R[1] - ROOM_R[0]}., 0., 1.);
  k += (1. - sr*sr*(3. - 2.*sr))*uRoomK[int(c.x + 2.) + 5*int(c.y + 2.)]*14.;
  float sx = clamp((length(p - vec3(xi*16. + 8., 1.5, c.y*16.)) - ${COR_R[0]})/${(COR_R[1] - COR_R[0]).toFixed(2)}, 0., 1.);
  k += (1. - sx*sx*(3. - 2.*sx))*uCorX[int(xi + 2.) + 4*int(c.y + 2.)]*2.5;
  float sz = clamp((length(p - vec3(c.x*16., 1.5, zj*16. + 8.)) - ${COR_R[0]})/${(COR_R[1] - COR_R[0]).toFixed(2)}, 0., 1.);
  k += (1. - sz*sz*(3. - 2.*sz))*uCorZ[int(c.x + 2.) + 5*int(zj + 2.)]*2.5;
  for (int i = 0; i < ${MAXZ}; i++){
    if (i >= uZN) break;
    float s = clamp((length(p - uZC[i].xyz) - uZR[i].x)/(uZR[i].y - uZR[i].x), 0., 1.);
    k += (1. - s*s*(3.-2.*s))*uZC[i].w*.3;
  }
  return k;
}
${WHorde.GLSL}
vec2 monsters(vec3 p){
  vec2 r = vec2(1e9, 0.);
  for (int i = 0; i < ${WHorde.MAX}; i++){
    if (i >= uMonN) break;
    vec3 q = p - uMon[i].xyz;
    float bb = length(q - vec3(0,1.,0)) - 1.25;
    if (bb > .3) { r.x = min(r.x, bb); continue; }
    q.xz = r2(-uMon[i].w)*q.xz;
    vec2 z = zombie(q, uMonS[i], uTime*6. + float(i)*1.7);
    if (z.x < r.x) r = vec2(z.x, 30. + float(i)*4. + z.y);
  }
  return r;
}
vec3 roomCenter(vec3 p){ return vec3(16.*clamp(floor(p.x/16.+.5),-2.,2.), 0., 16.*clamp(floor(p.z/16.+.5),-2.,2.)); }
vec2 map(vec3 p){
  vec3 rc = roomCenter(p);
  float room = sdBox(p - rc - vec3(0,2,0), vec3(5.,2.,5.));
  vec3 cx = vec3(clamp(floor(p.x/16.),-2.,1.)*16.+8., 1.5, rc.z);
  vec3 cz = vec3(rc.x, 1.5, clamp(floor(p.z/16.),-2.,1.)*16.+8.);
  // corridors reach deep into the rooms so the union bound stays tight at doorways
  float air = min(room, min(sdBox(p - cx, vec3(4.5,1.5,1.5)), sdBox(p - cz, vec3(1.5,1.5,4.5))));
  vec2 r = vec2(-air, 1.);                           // solid everywhere outside rooms and corridors
  vec3 q = p - rc;
  vec2 aq = abs(q.xz);
  r = opU(r, vec2(sdBox(vec3(aq.x-2.8, q.y-2., aq.y-2.8), vec3(.3,2.,.3)), 2.));   // four pillars
  float h = mod(rc.x/16. + 2.*rc.z/16. + 3., 3.)*.25;
  r = opU(r, vec2(sdBox(q - vec3(-1.3, .5+h, 1.3), vec3(.55, .5+h, .55)), 3.));   // cover block
  r = opU(r, monsters(p));
  return r;
}
vec3 sky(vec3 rd){ return vec3(.03,.03,.04); }
vec3 material(float id, vec3 p, vec3 n, inout float emit){
  if (id > 29.5) {
    float k = id - 30.; int i = int(floor(k/4. + .01)); float part = k - float(i)*4.;
    return zombieColor(part, uMonS[i], p, n, emit);
  }
  float k = clamp(zoneK(p), -1., 1.);
  vec3 tint = k < 0. ? mix(vec3(.6), vec3(.2,.45,.9), -k) : mix(vec3(.6), vec3(.95,.4,.2), k);
  float g = gridLines(p, n, 1.);
  if (id < 1.5) {
    vec3 q = p - roomCenter(p);
    if (n.y < -.5 && p.y > 3.9) {                   // ceiling: lamp panels
      vec2 a = abs(q.xz);
      if (max(a.x, a.y) < 1.2 && max(a.x, a.y) > .2) { emit = 1.6; return vec3(1.,.95,.85); }
      if (abs(q.x) < .4 && abs(q.z) > 5.5 || abs(q.z) < .4 && abs(q.x) > 5.5) { emit = 1.2; return vec3(1.,.95,.85); }
    }
    vec3 base = n.y > .5 ? tint*.8*(.85+.15*step(.5, fract((floor(p.x)+floor(p.z))*.5))) : tint;
    return mix(base, base*.45, g);
  }
  if (id < 2.5) return mix(tint*.9, tint*.5, gridLines(p, n, 2.));
  return mix(vec3(.85,.8,.3), vec3(.5,.45,.15), g);
}
vec3 light(vec3 p, vec3 n, vec3 rd, vec3 alb, float ao){
  vec3 lp = roomCenter(p) + vec3(0, 3.8, 0);
  vec3 L = lp - p; float dl = length(L); L /= dl;
  vec3 c = alb*(.12 + .35*ao*(.6+.4*n.y));
  c += alb*vec3(1.,.93,.8)*max(dot(n, L), 0.)*4.5/(1. + dl*dl*.1)*(.3+.7*ao);
  return c;
}
`;

  const horde = new WHorde(null, { metric, sdf, los, nodes: NODES, next, nearestNode, spawns: SPAWNS });
  const world = {
    name: 'Korytarze K',
    subtitle: 'Budynek z 25 pokoi połączonych korytarzami — prawie każdy pokój i korytarz ma WŁASNĄ krzywiznę: pomarańczowe K>0 (sferyczne, soczewka), niebieskie K<0 (hiperboliczne). Suwakiem dokładasz krzywiznę K całej mapy. W trybie z potworami każdy potwór nosi bańkę zakrzywionej przestrzeni, a ich pociski to latające soczewki.',
    tags: ['25 pokoi, każdy z własnym K', 'potwory', 'suwak K'],
    help: ['WASD ruch · Spacja skok · Shift bieg', 'kolor ścian = krzywizna pokoju: pomarańczowy K>0, niebieski K<0', 'w rogu: lokalne K tam, gdzie stoisz', 'Q / E — K całej mapy · X — płasko', 'potwory: 3 trafienia', 'N noclip'],
    modes: [{ label: 'Spokój', opts: { zombies: false } }, { label: 'Z potworami', opts: { zombies: true } }],
    shader: () => WG.euclid(code, '#define CONFORMAL\n#define CUSTOM_LIGHT\n#define FOG_DENS .03\n#define MAX_T 90.\n'),
    bullets: new WBullets(WBallistics.conformal(metric, { speed: 50, gravity: 1.2, life: 4 }), { hitTest: p => horde.hitTest(p) || WMP.hitPeers(p) }),
    horde,
    aim() { return this.player.aim(); },
    reverb: 0.3,
    // sync version (tests); the game uses soundArrivalsAsync
    soundArrivals(src) {
      let res; const c = this.player.camera();
      soundRaysAsync(src || c.pos, c.pos, !src, c.right, c.fwd, r => { res = r; });
      if (!src) res.push({ delay: 0, gain: 1, pan: 0, dist: 0 });
      return res;
    },
    soundArrivalsAsync(src, done) {
      const c = this.player.camera();
      if (!src) {
        // cache the echo of your own shot while nothing moves (no monsters) and you stand still
        const key = zones.length ? null : c.pos.map(v => Math.round(v * 2)).join() + '|' + S.g.toFixed(2) + '|' + c.right.map(v => v.toFixed(1)).join();
        if (key && ownCache && ownCache.key === key) return done(ownCache.out);
        const cb = out => { ownCache = { key, out }; done(out); };
        cb.async = true;
        return soundRaysAsync(c.pos, c.pos, true, c.right, c.fwd, cb);
      }
      done.async = true;
      soundRaysAsync(src, c.pos, false, c.right, c.fwd, done);
    },
    settings: [{
      label: 'K całej mapy', min: -1, max: 1, step: 0.01, reset: 0, get: () => S.g, set: v => { S.g = v; },
      text: () => { const k = globalK(); return (k >= 0 ? '+' : '') + k.toFixed(4) + (k ? ` (R = ${(1 / Math.sqrt(Math.abs(k))).toFixed(1)} m)` : ' (płaska)'); },
    }],
    enter(opts = {}) {
      // metric speed stays constant: in coordinates you move slower where e^phi is large (K<0 feels bigger)
      if (!this.player) this.player = new WPlayer(3, { spawn: [-3, WPlayer.EYE, -1], speedAt: p => Math.exp(-metric(p)[3]) });
      this.player.reset([-3, WPlayer.EYE, -1], Math.PI / 2);
      if (opts.zombies != null) this.zombies = opts.zombies;
      horde.reset(!!this.zombies);
      zones = horde.zones();
      this.health = this.zombies ? 100 : null;
      if (this.zombies) WE.toast(`Potwory: ${horde.total} — zabij je wszystkie`, 2500);
    },
    damage(n, from) {
      if (this.health == null || WMP.dead()) return;
      this.health = Math.max(0, this.health - n);
      WE.hurt();
      if (this.health > 0 || WMP.died(this, from)) return;
      WE.toast('Zginąłeś! Potwory wracają.', 3000); this.enter({}); this.bullets.clear();
    },
    update(dt, look) {
      S.g = WM.clamp(S.g + WE.axis('KeyQ', 'KeyE') * dt * 0.4, -1, 1);
      if (WE.keys.KeyX) S.g = 0;
      this.player.update(dt, look);
      horde.update(dt);
      zones = horde.zones();
    },
    setBulletUniforms(gl, p) { WBullets.upload(gl, p, [[this.bullets, 0], [horde.shots, 1], ...WMP.extraBullets(this).map(([l, e]) => [l, e ? 1 : 0])]); },
    setUniforms(gl, prog) {
      this.player.setUniforms3(gl, prog);
      gl.uniform1f(prog.u('uGK'), globalK());
      gl.uniform1fv(prog.u('uRoomK'), ROOM_K);
      gl.uniform1fv(prog.u('uCorX'), COR_X);
      gl.uniform1fv(prog.u('uCorZ'), COR_Z);
      const zc = new Float32Array(MAXZ * 4), zr = new Float32Array(MAXZ * 2), n = Math.min(MAXZ, zones.length);
      for (let i = 0; i < n; i++) { const z = zones[i]; zc.set([z[0], z[1], z[2], z[3]], i * 4); zr.set([z[4], z[5]], i * 2); }
      gl.uniform4fv(prog.u('uZC'), zc);
      gl.uniform2fv(prog.u('uZR'), zr);
      gl.uniform1i(prog.u('uZN'), n);
      horde.setUniforms(gl, prog);
    },
    stats() {
      const p = this.player.pos, eye = p.slice(); eye[1] -= 0.6;
      const k = localK(eye), n = Math.exp(metric(eye)[3]);
      const kind = Math.abs(k) < 0.001 ? 'płaska' : k < 0 ? 'hiperboliczna' : 'sferyczna';
      const mon = this.zombies ? `\npotwory: ${horde.alive()} / ${horde.total} · życie ${Math.ceil(this.health)}` : '';
      return `lokalne K = ${k >= 0 ? '+' : ''}${k.toFixed(4)} (${kind}) · skala e^φ = ${n.toFixed(2)}\npozycja ${p.map(v => v.toFixed(1)).join(', ')}` + mon;
    },
    _test: { metric, localK, S, globalK, sdf, NODES, next, nearestNode, horde, ROOM_K, COR_X, COR_Z },
  };
  horde.w = world;
  // multiplayer (js/mp.js): you are a figure with feet + yaw; the monsters are run by the room's leader
  world.ai = () => (world.zombies ? horde : null);
  world.playerPoints = () => { const p = world.player.pos; return { eye: p, body: [p, [p[0], p[1] - 0.8, p[2]], [p[0], p[1] - 1.3, p[2]]] }; };
  world.mp = {
    space: WSwarm.spaces.torus([1e9, 1e9, 1e9]),
    me() { const p = world.player.pos, f = world.player.forward; return { p: [p[0], p[1] - WPlayer.EYE, p[2]], yaw: Math.atan2(f[0], f[2]) }; },
    respawn() { const r = a => (Math.random() - 0.5) * a; world.player.reset([-3 + r(3), WPlayer.EYE, -1 + r(3)], Math.PI / 2); },
  };
  WE.register(world);
})();
