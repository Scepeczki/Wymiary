// BENCHMARK: OSOBLIWOŚĆ — a scene made to load the GPU, for comparing hardware, screens and settings.
//  * a black hole whose gravity bends light (CONFORMAL: rays follow geodesics of g = e^{2φ}·δ, φ = M/r — like a
//    refractive index n = 1 + 2GM/rc²): a dark horizon, a photon ring, a lensed starry sky; an accretion disk (one side
//    brighter: the gas coming towards you) and two polar jets — glowing gas integrated along the ray (VOLUME);
//  * two invisible gravitational lenses orbiting the fractals (only a small glowing core shows where they are);
//  * fractals: a Mandelbulb (coloured by its orbit trap), towers of Menger sponges, a rotating Sierpiński tetrahedron;
//  * spiral energy beams between pylons, pulsing; the floor lines pulse in rings around the black hole.
// Modes: walking around, or the BENCHMARK — a 60 s flight on a fixed path through six scenes, measuring every frame:
// average FPS, 1% / 0.1% low, GPU time, render size — kept in a history (localStorage 'wymiary.bench' → js/store.js).
(function () {
  const S = { iter: 10, grav: 1, stream: 1, shadow: true, refl: true };
  const BH = [0, 16, 70], MB = [-36, 13, 36], SPC = [34, 13, 32];
  const v3 = a => `vec3(${a.map(x => x.toFixed(1)).join(',')})`;

  const code = `
uniform float uIter, uGrav, uStream, uShadow, uRefl;
float gRefl = 0.;                                    // reflectivity of the surface just shaded (set by material)
uniform vec3 uL1, uL2;
uniform mat3 uRotS;
const vec3 BH = ${v3(BH)};
const float RH = 3.;
const vec3 MB = ${v3(MB)};
const float MBS = 9.;
const vec3 SPC = ${v3(SPC)};
const float SPS = 8.;

// ---- fractals ----
float mandelbulb(vec3 p, out float trap){
  vec3 z = p; float dr = 1., r = length(z); trap = 1e9;
  for (int i = uZero; i < 16; i++){
    if (float(i) >= uIter || r > 2.) break;
    float th = acos(clamp(z.y/r, -1., 1.))*8. + uTime*.12, ph = atan(z.z, z.x)*8.;
    dr = pow(r, 7.)*8.*dr + 1.;
    z = pow(r, 8.)*vec3(sin(th)*cos(ph), cos(th), sin(th)*sin(ph)) + p;
    trap = min(trap, dot(z, z));
    r = length(z);
  }
  return .5*log(max(r, 1e-6))*r/dr;
}
float menger(vec3 p){                       // unit cube [-1, 1]
  float d = sdBox(p, vec3(1.)), s = 1.;
  for (int m = uZero; m < 5; m++){
    if (float(m) >= min(uIter*.5, 5.)) break;
    vec3 a = mod(p*s, 2.) - 1.;
    s *= 3.;
    vec3 r = abs(1. - 3.*abs(a));
    float c = (min(max(r.x, r.y), min(max(r.y, r.z), max(r.z, r.x))) - 1.)/s;
    d = max(d, c);
  }
  return d;
}
float sierpinski(vec3 z){                   // tetrahedron, vertices at (±1, ±1, ±1) with an even number of minuses
  float s = 1.;
  for (int n = uZero; n < 16; n++){
    if (float(n) >= uIter + 2.) break;
    if (z.x + z.y < 0.) z.xy = -z.yx;
    if (z.x + z.z < 0.) z.xz = -z.zx;
    if (z.y + z.z < 0.) z.zy = -z.yz;
    z = z*2. - vec3(1.);
    s *= 2.;
  }
  return (length(z) - 1.2)/s;
}

vec2 map(vec3 p){
  vec2 r = vec2(p.y, 1.);                                          // the floor
  r = opU(r, vec2(length(p - BH) - RH, 5.));                       // the horizon
  { vec3 q = (p - MB)/MBS; float b = length(q) - 1.25;
    if (b > .1) r = opU(r, vec2(b*MBS, 3.)); else { float tr; r = opU(r, vec2(mandelbulb(q, tr)*MBS*.9, 3.)); } }
  { vec3 q = uRotS*((p - SPC)/SPS); float b = length(q) - 1.8;
    if (b > .1) r = opU(r, vec2(b*SPS, 4.)); else r = opU(r, vec2(sierpinski(q)*SPS, 4.)); }
  { vec3 q = vec3(abs(p.x) - 26., p.y, p.z); q.z -= 15.*clamp(floor(q.z/15. + .5), 0., 4.);   // 2 rows of 5 towers
    float b = sdBox(q - vec3(0, 9, 0), vec3(3.1, 9.1, 3.1));
    if (b > .2) r = opU(r, vec2(b, 2.));
    else { q.y -= 3.; q.y -= 6.*clamp(floor(q.y/6. + .5), 0., 2.); r = opU(r, vec2(menger(q/3.)*3., 2.)); } }
  { vec3 q = vec3(abs(p.x) - 12., p.y - 3.5, min(abs(p.z + 12.), abs(p.z - 62.)));          // pylons of the beams
    r = opU(r, vec2(sdBox(q, vec3(.45, 3.5, .45)) - .05, 6.)); }
#ifndef PROBE
  r = opU(r, vec2(min(length(p - uL1), length(p - uL2)) - .12, 7.));  // the cores of the lenses (the lens magnifies them)
#endif
  return r;
}

// ---- curved light: n = e^phi, phi = sum M/r (the black hole, two lenses) ----
vec4 lensTerm(vec3 p, vec3 c, float M, float rmin){
  vec3 d = p - c; float r = max(length(d), rmin);
  return vec4(-M*d/(r*r*r), M/r);
}
vec4 metric(vec3 p){
  return uGrav*(lensTerm(p, BH, 2.8, RH*.6) + lensTerm(p, uL1, .9, .8) + lensTerm(p, uL2, .9, .8));
}

// ---- glowing gas and beams ----
vec3 diskSpace(vec3 p){ vec3 q = p - BH; q.yz = grot(.25)*q.yz; return q; }
float stepLimit(vec3 p){
  vec3 q = diskSpace(p);
  float rq = length(q.xz);
  float l = max(max(abs(q.y) - 2., rq - 20.), .25);                 // the disk
  l = min(l, max(max(rq - 2.5, abs(q.y) - 45.), .3));                // the jets
  float ds = min(length(p.xy - vec2(-12., 7.)), length(p.xy - vec2(12., 7.))) - 3.5;
  l = min(l, max(max(ds, max(-12. - p.z, p.z - 62.)), .18));        // the beams
  return l;
}
vec3 volume(vec3 p, vec3 rd, float st){
  vec3 acc = vec3(0);
  vec3 q = diskSpace(p);
  float rq = length(q.xz);
  if (rq > RH*1.2 && rq < 20. && abs(q.y) < 2.) {                   // accretion disk
    float ang = atan(q.z, q.x);
    float turb = (.55 + .45*sin(ang*7. + 40./rq - uTime*25./rq))*(.65 + .35*sin(rq*2.7 - uTime*1.7 + ang*3.));
    float dens = exp(-q.y*q.y*3.)*smoothstep(RH*1.2, RH*2.2, rq)*(1. - smoothstep(13., 20., rq))*turb;
    float temp = clamp((19. - rq)/15., 0., 1.);
    vec3 col = mix(vec3(1., .3, .06), vec3(.85, .95, 1.3), temp*temp);
    vec3 dq = rd; dq.yz = grot(.25)*dq.yz;                            // the ray in the disk's frame
    float beam = 1. + .8*dot(normalize(vec3(-q.z, 0., q.x)), -dq);    // brighter where the gas comes towards you
    acc += col*dens*beam*2.4;
  }
  if (rq < 2.5 && abs(q.y) > RH && abs(q.y) < 45.) {                 // polar jets
    float a = abs(q.y);
    acc += vec3(.45, .65, 1.5)*exp(-rq*rq/(.12 + a*.025))*exp(-a*.045)*(.55 + .45*sin(a*1.4 - uTime*14.))*3.;
  }
  if (p.z > -12. && p.z < 62.) {                                      // spiral beams
    for (int k = 0; k < 2; k++){
      vec2 rel = p.xy - vec2(k == 0 ? -12. : 12., 7.);
      if (dot(rel, rel) > 12.25) continue;
      for (int j = 0; j < 3; j++){
        float ph = p.z*.45 - uTime*2.5*(k == 0 ? 1. : -1.) + float(j)*2.094;
        vec2 e = rel - 2.2*vec2(cos(ph), sin(ph));
        float pulse = .5 + .5*sin(p.z*1.3 - uTime*9. + float(j)*2.);
        acc += hsv(.5 + .12*float(j) + .33*float(k), .75, 1.)*exp(-dot(e, e)*7.)*(.35 + 1.8*pulse*pulse)*1.6;
      }
    }
  }
  return acc*st*uStream;
}

vec3 sky(vec3 rd){
  vec3 c = mix(vec3(.008, .006, .016), vec3(.03, .015, .05), .5 + .5*rd.y);
  float band = exp(-pow((rd.y + .15*sin(rd.x*2.3 + rd.z))*3.2, 2.));        // a nebula band across the sky
  c += vec3(.2, .07, .28)*band*(.6 + .4*sin(rd.x*9. + rd.z*7.));
  vec3 d = rd*190., id = floor(d);
  float h = hash31(id);
  if (h > .991) { vec3 f = fract(d) - .5; c += vec3(.75 + .25*h, .82, 1.)*exp(-dot(f, f)*45.)*(h - .991)*160.; }
  return c;
}
vec3 material(float id, vec3 p, vec3 n, inout float emit){
  gRefl = id < 1.5 ? .3 : (id > 3.5 && id < 4.5) ? .45 : 0.;
  if (id < 1.5) {                                                    // floor: tiles, lines pulsing around the hole
    vec2 g = abs(fract(p.xz/4.) - .5);
    float line = smoothstep(.465, .5, max(g.x, g.y));
    float pulse = .5 + .5*sin(length(p.xz - BH.xz)*.35 - uTime*2.2);
    emit = line*(.4 + 1.6*pulse*pulse);
    return mix(vec3(.07, .07, .1), vec3(.2, .5, 1.), line);
  }
  if (id < 2.5) return mix(vec3(.5, .45, .42), vec3(.85, .74, .58), .5 + .5*n.y);
  if (id < 3.5) {
    float tr; mandelbulb((p - MB)/MBS, tr);
    vec3 c = mix(vec3(1., .45, .15), vec3(.15, .55, 1.), clamp(tr*.45, 0., 1.));
    emit = .25*clamp(1. - tr, 0., 1.);
    return c;
  }
  if (id < 4.5) return hsv(fract(.78 + length(p - SPC)*.04), .55, .95);
  if (id < 5.5) return vec3(0);                                      // the horizon: nothing comes back
  if (id < 6.5) { emit = 2.5 + 1.5*sin(uTime*4. + p.y); return vec3(.5, .85, 1.); }
  emit = 1.2; return vec3(.7, .5, 1.);
}
#ifndef PROBE
float shadow(vec3 p, vec3 l);
vec3 calcNormal(vec3 p);
// a reflection: a second march of the scene (straight rays — the lensing of the reflected ray is left out), lit by
// the disk; costs about as much as the first ray on every reflecting pixel
vec3 reflTrace(vec3 p, vec3 d){
  float t = .05;
  for (int i = uZero; i < 160; i++){
    vec3 q = p + d*t; vec2 h = map(q);
    if (h.x < .0015*t) {
      vec3 n = calcNormal(q); float e = 0.;
      vec3 a = material(h.y, q, n, e), L = normalize(BH - q);
      float dl = length(BH - q);
      vec3 c = a*(vec3(1., .62, .32)*max(dot(n, L), 0.)*(2600./(dl*dl + 500.)) + vec3(.06, .05, .1)) + a*e;
      return mix(sky(d), c, exp(-FOG_DENS*t));
    }
    t += h.x*.9;
    if (t > 140.) break;
  }
  return sky(d);
}
vec3 light(vec3 p, vec3 n, vec3 rd, vec3 alb, float ao){
  float refl = gRefl;
  vec3 L = BH - p; float dl = length(L); L /= dl;                     // the disk lights everything, warm
  float dif = max(dot(n, L), 0.);
  if (dif > 0. && uShadow > .5) dif *= shadow(p + n*.02, L);
  vec3 col = alb*vec3(1., .62, .32)*dif*(2600./(dl*dl + 500.));
  col += alb*vec3(.25, .3, .55)*max(dot(n, normalize(vec3(-.4, .7, -.5))), 0.)*.5;   // a cold fill light
  col += alb*vec3(.05, .04, .08)*ao*(.6 + .4*n.y);
  col += vec3(1., .7, .4)*pow(max(dot(reflect(rd, n), L), 0.), 32.)*.35*dif;
  if (uRefl > .5 && refl > 0.) {
    float fr = refl*(.35 + .65*pow(1. - max(dot(-rd, n), 0.), 4.));     // Fresnel: more at grazing angles
    col += reflTrace(p + n*.03, reflect(rd, n))*fr;
  }
  return col;
}
#endif
`;

  // ---------------- the benchmark flight: keyframes (eye, where it looks), scene names ----------------
  const K = [
    [[0, 3, -16], [0, 8, 40], 'Start — wiązki energii'], [[6, 5, 4], [0, 9, 45], 'Start — wiązki energii'], [[-4, 7, 18], [-12, 7, 40], 'Start — wiązki energii'],
    [[-18, 9, 20], MB, 'Mandelbulb'], [[-24, 15, 50], MB, 'Mandelbulb'], [[-50, 10, 42], MB, 'Mandelbulb'], [[-44, 6, 22], MB, 'Mandelbulb'],
    [[-26, 7, -6], [-26, 9, 40], 'Wieże Mengera'], [[-18, 12, 30], [26, 9, 30], 'Wieże Mengera'], [[20, 8, 62], [26, 8, 0], 'Wieże Mengera'],
    [[18, 10, 14], SPC, 'Sierpiński + soczewka'], [[44, 16, 22], SPC, 'Sierpiński + soczewka'], [[42, 9, 46], SPC, 'Sierpiński + soczewka'],
    [[16, 18, 48], BH, 'Czarna dziura'], [[2, 22, 46], BH, 'Czarna dziura'], [[-12, 15, 58], BH, 'Czarna dziura'], [[-6, 14, 84], BH, 'Czarna dziura'], [[12, 17, 86], BH, 'Czarna dziura'],
    [[24, 30, 40], [0, 12, 50], 'Wszystko naraz'], [[0, 42, -30], [0, 10, 45], 'Wszystko naraz'], [[0, 42, -30], [0, 10, 45], 'Wszystko naraz'],
  ];
  const DUR = 60, WARM = 3;
  const cr = (a, b, c, d, t) => a.map((_, i) => 0.5 * (2 * b[i] + (-a[i] + c[i]) * t + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * t * t + (-a[i] + 3 * b[i] - 3 * c[i] + d[i]) * t * t * t));
  function pathAt(t) {                         // t in 0..1 → { eye, look, seg }
    const u = WM.clamp(t, 0, 1) * (K.length - 1), i = Math.min(Math.floor(u), K.length - 2), f = u - i;
    const k = j => K[WM.clamp(j, 0, K.length - 1)];
    return { eye: cr(k(i - 1)[0], k(i)[0], k(i + 1)[0], k(i + 2)[0], f), look: cr(k(i - 1)[1], k(i)[1], k(i + 1)[1], k(i + 2)[1], f), seg: k(i + (f > 0.5 ? 1 : 0))[2] };
  }

  // ---------------- results ----------------
  const B = { on: false, t: 0, frames: [], segs: [], gpu: [], res: [], times: [], last: 0, result: null };
  const loadHist = () => { try { return JSON.parse(localStorage.getItem('wymiary.bench') || '[]'); } catch (e) { return []; } };
  const saveHist = h => { try { localStorage.setItem('wymiary.bench', JSON.stringify(h.slice(0, 30))); } catch (e) { /* no storage */ } };
  function gpuName() {
    try { const gl = WE.gl, e = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(e.UNMASKED_RENDERER_WEBGL).replace(/^ANGLE \(|\s*\(0x[0-9A-F]+\)|\s*Direct3D.*$|,\s*D3D1\d\)?$/gi, '').replace(/^(\w+), \1 /, '$1 '); } catch (e) { return '?'; }
  }
  const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  function summarize(frames) {
    if (!frames.length) return null;
    const s = frames.slice().sort((a, b) => a - b), sum = frames.reduce((a, b) => a + b, 0);
    return { fps: 1000 * frames.length / sum, low1: 1000 / pct(s, 0.99), low01: 1000 / pct(s, 0.999), med: pct(s, 0.5), max: s[s.length - 1] };
  }
  function finish(done) {
    B.on = false;
    restoreVideo();
    if (done) {
      const all = summarize(B.frames), segs = [];
      for (const name of [...new Set(K.map(k => k[2]))]) {
        const f = B.frames.filter((_, i) => B.segs[i] === name), g = B.gpu.filter((x, i) => x > 0 && B.segs[i] === name);
        const r = summarize(f);
        if (r) segs.push({ name, fps: r.fps, low1: r.low1, gpu: g.length ? g.reduce((a, b) => a + b, 0) / g.length : 0 });
      }
      const g = B.gpu.filter(x => x > 0), dpr = window.devicePixelRatio || 1;
      B.result = Object.assign(all, {
        date: new Date().toLocaleString('pl-PL'), gpuName: gpuName(), mode: world.modes[world._modeIdx || 0].label,
        screen: `${Math.round(screen.width * dpr)}×${Math.round(screen.height * dpr)}`, hz: Math.round(1000 / WE.refreshMs),
        render: `${Math.round(B.res.reduce((a, r) => a + r[0], 0) / B.res.length)}×${Math.round(B.res.reduce((a, r) => a + r[1], 0) / B.res.length)}`,
        scale: B.res.reduce((a, r) => a + r[2], 0) / B.res.length, auto: B.auto,
        gpu: g.length ? g.reduce((a, b) => a + b, 0) / g.length : 0, gpuMax: g.length ? Math.max(...g) : 0,
        worst: B.frames.map((d, i) => ({ d, t: B.times[i], seg: B.segs[i] })).sort((a, b) => b.d - a.d).slice(0, 6),
        long: B.frames.filter(d => d > 50).length,
        set: `fraktale ${S.iter}, grawitacja ${S.grav.toFixed(1)}, wiązki ${S.stream.toFixed(1)}, cienie ${S.shadow ? 'wł.' : 'wył.'}, odbicia ${S.refl ? 'wł.' : 'wył.'}`, segs,
      });
      const h = loadHist(); h.unshift(B.result); saveHist(h);
      WE.toast(`Benchmark: ${B.result.fps.toFixed(1)} FPS średnio, 1% low ${B.result.low1.toFixed(1)} — wyniki w menu`, 5000);
    } else WE.toast('Benchmark przerwany', 2000);
    world.player.reset([0, 1.6, -14], 0);
    setTimeout(() => WE.unlock(), 50);                 // the menu shows the results
  }
  // the "native" benchmark: a fixed 100% render scale, no frame limit; the player's own picture settings come back after
  let savedVideo = null;
  function restoreVideo() { if (savedVideo) { Object.assign(WE, savedVideo); savedVideo = null; } }
  function startBench(mode) {
    restoreVideo();
    if (mode === 2) {
      savedVideo = { autoRes: WE.autoRes, fpsCap: WE.fpsCap, resScale: WE.resScale };
      Object.assign(WE, { autoRes: false, fpsCap: false, resScale: 1 });
    }
    Object.assign(B, { on: true, t: -WARM, frames: [], segs: [], gpu: [], res: [], times: [], last: 0, result: null, auto: WE.autoRes, started: false });
  }
  const fmtRes = r => `${r.fps.toFixed(1)} FPS · 1% low ${r.low1.toFixed(1)} · 0,1% low ${r.low01.toFixed(1)} · GPU ${r.gpu ? r.gpu.toFixed(1) + ' ms' : '—'}`;
  function resultText(r) {
    return [`Wymiary — Benchmark: Osobliwość (${r.date})`, `Karta: ${r.gpuName} · ekran ${r.screen} @ ${r.hz} Hz`,
      `Tryb: ${r.mode} · render ${r.render} (${Math.round(r.scale * 100)}%${r.auto ? ', automatyczna' : ''}) · ${r.set}`,
      `Wynik: ${fmtRes(r)} (max ${r.gpuMax.toFixed(1)} ms) · mediana klatki ${r.med.toFixed(1)} ms, najdłuższa ${r.max.toFixed(0)} ms`,
      `Klatki > 50 ms: ${r.long || 0}; najdłuższe: ${(r.worst || []).map(x => `${x.d.toFixed(0)} ms (${x.t.toFixed(1)} s, ${x.seg})`).join(', ')}`,
      ...r.segs.map(s => `  ${s.name.padEnd(24)} ${s.fps.toFixed(1).padStart(6)} FPS · 1% low ${s.low1.toFixed(1).padStart(5)} · GPU ${s.gpu.toFixed(1)} ms`)].join('\n');
  }

  const world = {
    name: 'Benchmark: Osobliwość',
    id: 'benchmark',
    subtitle: 'Scena do testów wydajności: czarna dziura zakrzywiająca światło (pierścień fotonowy, soczewkowane niebo), dysk akrecyjny i dżety, ' +
      'krążące soczewki grawitacyjne, fraktale (Mandelbulb, wieże z gąbki Mengera, trójkąt Sierpińskiego 3D) i spiralne wiązki energii. ' +
      'Tryb Benchmark przelatuje 60 s po stałej trasie przez 6 scen i mierzy każdą klatkę.',
    tags: ['benchmark', 'czarna dziura', 'fraktale', 'zakrzywienie światła'],
    help: ['Tryb „Benchmark”: wybierz na karcie mapy, GRAJ — przelot 60 s, potem wyniki w menu', 'Esc — przerywa benchmark',
      'zwiedzanie: WASD, kółko — lot, N noclip', 'suwaki mapy: detal fraktali, grawitacja, wiązki, cienie — wchodzą do wyniku'],
    modes: [{ label: 'Zwiedzanie', opts: { bench: 0 } }, { label: 'Benchmark — ustawienia z „Obraz”', opts: { bench: 1 } },
      { label: 'Benchmark — natywna rozdzielczość (100%, bez limitu)', opts: { bench: 2 } }],
    settings: [
      { label: 'Detal fraktali', min: 4, max: 14, step: 1, reset: 10, get: () => S.iter, set: v => { S.iter = v; }, text: () => `${S.iter} iteracji` },
      { label: 'Grawitacja', min: 0, max: 2, step: 0.05, reset: 1, get: () => S.grav, set: v => { S.grav = v; }, text: () => `×${S.grav.toFixed(2)}` },
      { label: 'Wiązki i gaz', min: 0, max: 2, step: 0.05, reset: 1, get: () => S.stream, set: v => { S.stream = v; }, text: () => `×${S.stream.toFixed(2)}` },
      { label: 'Cienie', type: 'toggle', get: () => S.shadow, set: v => { S.shadow = v; } },
      { label: 'Odbicia', type: 'toggle', get: () => S.refl, set: v => { S.refl = v; } },
    ],
    shader: () => WG.euclid(code, '#define CONFORMAL\n#define CUSTOM_LIGHT\n#define VOLUME\n#define FOG_DENS .0035\n#define MAX_T 260.\n'),
    enter(opts = {}) {
      if (!this.player) this.player = new WPlayer(3, { spawn: [0, 1.6, -14], respawnY: -50 });
      this.player.reset([0, 1.6, -14], 0);
      if (opts.bench) startBench(opts.bench); else if (B.on) { B.on = false; restoreVideo(); }
    },
    update(dt, look) {
      if (!B.on) { this.player.update(dt, look); return; }
      if (!WE.locked) {                         // waiting for the click that starts the game; Esc during the run aborts
        if (B.started) return finish(false);
        const a = pathAt(0); this.place(a);
        return;
      }
      B.started = true;
      // the other maps' shaders are still being compiled in the background: that stalls the browser's GPU process for
      // up to half a second at a time — wait, or the result would measure the compiler
      if (!WE.prepared) { B.prep = true; this.place(pathAt(0)); return; }
      B.prep = false;
      B.t += dt;
      const a = pathAt(Math.max(0, B.t) / DUR);
      this.place(a);
      if (B.t > 0) {                            // after the warm-up: every frame counts
        const now = performance.now();
        if (B.last) { B.frames.push(now - B.last); B.segs.push(a.seg); B.gpu.push(WE.perf.gpu || 0); B.res.push([WE.renderW || 0, WE.renderH || 0, WE.resScale]); B.times.push(B.t); }
        B.last = now;
      }
      B.seg = a.seg;
      if (B.t >= DUR) finish(true);
    },
    place(a) {
      const p = this.player, d = WM.norm(WM.sub(a.look, a.eye));
      p.reset(a.eye, Math.atan2(d[0], d[2]));
      p.pitch = Math.asin(WM.clamp(d[1], -1, 1));
    },
    setUniforms(gl, prog) {
      this.player.setUniforms3(gl, prog);
      const t = WE.time;
      gl.uniform1f(prog.u('uIter'), S.iter);
      gl.uniform1f(prog.u('uGrav'), S.grav);
      gl.uniform1f(prog.u('uStream'), S.stream);
      gl.uniform1f(prog.u('uShadow'), S.shadow ? 1 : 0);
      gl.uniform1f(prog.u('uRefl'), S.refl ? 1 : 0);
      gl.uniform3f(prog.u('uL1'), MB[0] + 15 * Math.cos(t * 0.3), MB[1] + 3 * Math.sin(t * 0.5), MB[2] + 15 * Math.sin(t * 0.3));
      gl.uniform3f(prog.u('uL2'), SPC[0] + 13 * Math.cos(-t * 0.37 + 2), SPC[1] + 4 * Math.sin(t * 0.4), SPC[2] + 13 * Math.sin(-t * 0.37 + 2));
      const a = t * 0.2, b = 0.5 + 0.3 * Math.sin(t * 0.13), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      gl.uniformMatrix3fv(prog.u('uRotS'), false, new Float32Array([ca, sa * sb, -sa * cb, 0, cb, sb, sa, -ca * sb, ca * cb]));
    },
    stats() {
      const p = this.player.pos;
      return B.on ? `BENCHMARK ${Math.max(0, B.t).toFixed(1)} / ${DUR} s · ${B.seg || ''}` : `odległość od czarnej dziury: ${WM.len(WM.sub(p, BH)).toFixed(1)} m`;
    },
    // the panel top right: progress during the run
    tutorialHtml() {
      if (!B.on) return '';
      if (!B.started) return '<div class="step">Benchmark</div><h2>Kliknij, żeby zacząć</h2><p>Przelot 60 s po stałej trasie. Esc przerywa.</p>';
      if (B.prep) return '<div class="step">Benchmark</div><h2>Czekam na przygotowanie map…</h2><p>Kompilacja shaderów w tle zaburzyłaby pomiar.</p>';
      const p = Math.max(0, B.t) / DUR, warm = B.t < 0;
      return `<div class="step">Benchmark ${warm ? '· rozgrzewka' : Math.round(p * 100) + '%'}</div><h2>${B.seg || ''}</h2>` +
        `<p>${Math.round(WE.fps || 0)} FPS · GPU ${WE.perf.gpu ? WE.perf.gpu.toFixed(1) + ' ms' : '—'} · render ${WE.renderW || 0}×${WE.renderH || 0} (${Math.round(WE.resScale * 100)}%)</p>` +
        `<div class="task" style="padding:0;height:8px;overflow:hidden"><div style="height:100%;width:${(p * 100).toFixed(1)}%;background:#fd7"></div></div>`;
    },
    // in the menu: the last result, the history, copying
    menuPanel(box) {
      const h = loadHist(), wrap = document.createElement('div');
      wrap.className = 'benchBox';
      if (!h.length) { wrap.innerHTML = '<p>Brak wyników. Wybierz tryb „Benchmark” i kliknij GRAJ.</p>'; box.appendChild(wrap); return; }
      const r = h[0];
      wrap.innerHTML = `<h3>Ostatni wynik</h3><div class="bigfps"></div><p class="bmeta"></p><table class="bseg"></table><h3>Historia</h3><table class="bhist"></table>` +
        '<div class="bbtns"><button class="modeBtn lay bcopy">📋 Kopiuj wyniki</button><button class="modeBtn lay bclear">🗑 Wyczyść historię</button></div>';
      wrap.querySelector('.bigfps').textContent = `${r.fps.toFixed(1)} FPS`;
      wrap.querySelector('.bmeta').textContent = `1% low ${r.low1.toFixed(1)} · 0,1% low ${r.low01.toFixed(1)} · GPU ${r.gpu.toFixed(1)} ms (max ${r.gpuMax.toFixed(1)}) · ` +
        `${r.gpuName} · ekran ${r.screen} @ ${r.hz} Hz · render ${r.render} (${Math.round(r.scale * 100)}%${r.auto ? ', auto' : ''}) · ${r.mode} · ${r.set} · ${r.date}`;
      const seg = wrap.querySelector('.bseg');
      for (const s of r.segs) { const tr = seg.insertRow(); tr.innerHTML = '<td></td><td></td><td></td>'; tr.cells[0].textContent = s.name; tr.cells[1].textContent = `${s.fps.toFixed(1)} FPS`; tr.cells[2].textContent = s.gpu ? `GPU ${s.gpu.toFixed(1)} ms` : ''; }
      const hist = wrap.querySelector('.bhist');
      for (const x of h.slice(0, 12)) {
        const tr = hist.insertRow(); tr.innerHTML = '<td></td><td></td><td></td>';
        tr.cells[0].textContent = x.date; tr.cells[1].textContent = `${x.fps.toFixed(1)} FPS · 1% ${x.low1.toFixed(1)}`;
        tr.cells[2].textContent = `${x.render} ${x.auto ? 'auto' : Math.round(x.scale * 100) + '%'} · ${x.gpuName}`;
      }
      wrap.querySelector('.bcopy').addEventListener('click', () => navigator.clipboard.writeText(h.map(resultText).join('\n\n')).then(() => WE.toast('Skopiowano wyniki', 1200)));
      wrap.querySelector('.bclear').addEventListener('click', () => { if (confirm('Wyczyścić historię wyników?')) { saveHist([]); wrap.remove(); } });
      box.appendChild(wrap);
    },
  };
  // another map chosen during the run (number keys): the run ends, the picture settings come back
  if (typeof setInterval === 'function') setInterval(() => { if (B.on && WE.world && WE.world !== world) { B.on = false; restoreVideo(); } }, 500);
  WE.register(world);
})();
