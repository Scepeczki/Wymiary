// Usage: node tools/dev/levels.js — can every practice level of the 4D tutorial be done by walking (no jumps)?
// The floor space (x, y on the floor, w) is cut into 0.35 cells; a cell is walkable when your feet stand on a
// platform there (inside its box, keeping 0.15 from its edges) and no wall is closer than your radius. Neighbouring
// walkable cells connect when their heights differ by at most a step (0.45). Every crystal must be reachable
// from the start (searched breadth-first), and must hang at hand height above a walkable cell.
const ctx = require('./load')();
const w = ctx.WE.worlds.find(x => x.name === 'Samouczek 4D'), { LEVELS } = w._test;
const G = 0.35, MARGIN = 0.15, RADIUS = 0.33, STEP = 0.45;
let fail = 0;
LEVELS.forEach((lv, li) => {
  const plats = lv.boxes.filter(b => b[8] === 1), walls = lv.boxes.filter(b => b[8] === 2);
  const top = (x, z, ww) => {                                 // the highest platform top under (x, z, w)
    let t = null;
    for (const b of plats) if (Math.abs(x - b[0]) <= b[4] - MARGIN && Math.abs(z - b[2]) <= b[6] - MARGIN && Math.abs(ww - b[3]) <= b[7] - MARGIN) t = Math.max(t ?? -1e9, b[1] + b[5]);
    return t;
  };
  const blocked = (x, z, ww) => walls.some(b => Math.max(Math.abs(x - b[0]) - b[4], Math.abs(z - b[2]) - b[6], Math.abs(ww - b[3]) - b[7]) < RADIUS);
  const key = (i, j, k) => `${i},${j},${k}`;
  const cell = p => [Math.round(p[0] / G), Math.round(p[2] / G), Math.round(p[3] / G)];
  const s0 = cell(lv.start), seen = new Map([[key(...s0), top(lv.start[0], lv.start[2], lv.start[3])]]), q = [s0];
  if (seen.get(key(...s0)) == null) { console.log(`ŹLE  ${li + 1}. ${lv.title}: start nie stoi na platformie`); fail++; return; }
  while (q.length && seen.size < 1500000) {
    const [i, j, k] = q.shift(), h = seen.get(key(i, j, k));
    for (const [di, dj, dk] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = [i + di, j + dj, k + dk], kk = key(...n);
      if (seen.has(kk)) continue;
      const t = top(n[0] * G, n[1] * G, n[2] * G);
      if (t == null || Math.abs(t - h) > STEP || blocked(n[0] * G, n[1] * G, n[2] * G)) continue;
      seen.set(kk, t); q.push(n);
    }
  }
  const bad = lv.crystals.map((c, i) => {
    // reachable when some walkable cell within reach (0.9 on the floor / in w) has the crystal at hand height
    const [ci, cj, ck] = cell(c);
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let d = -3; d <= 3; d++) {
      const t = seen.get(key(ci + a, cj + b, ck + d));
      if (t != null && Math.hypot(a, b, d) * G < 0.9 && c[1] - t > 0.6 && c[1] - t < 1.9) return null;
    }
    return i + 1;
  }).filter(Boolean);
  if (lv.boxes.length > 24 || lv.crystals.length > 8) bad.push('za dużo elementów');
  if (bad.length) fail++;
  console.log(`${bad.length ? 'ŹLE' : 'OK '}  ${li + 1}. ${lv.title}${bad.length ? ` — nieosiągalne kryształy: ${bad.join(', ')}` : ''} (komórek: ${seen.size})`);
});
console.log(fail ? `poziomów z błędami: ${fail}` : 'wszystkie poziomy przechodnie');
process.exit(fail ? 1 : 0);
