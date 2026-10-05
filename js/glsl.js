// GLSL kernels. Each world supplies only its scene code (map + material); the kernel supplies
// the camera projections, ray marching in the right geometry, lighting, bullets, the gun and the probe shader.
(function () {
  const G = {};
  G.MAX_BULLETS = 24;

  G.header = `#version 300 es
precision highp float;
precision highp int;
#define PI 3.14159265
uniform vec2 uRes;
uniform float uTime;
uniform int uProj;
// Always 0 (never set). Loops starting at uZero cannot be unrolled by the shader compiler, so map() is inlined
// once per loop instead of once per iteration — this keeps compile times of big maps short.
uniform int uZero;
uniform float uFov;
uniform vec2 uViewOff;   // split screen: lower-left corner of this view in window pixels (uRes = its size)
uniform vec4 uBullets[${G.MAX_BULLETS}];
uniform float uBulletR[${G.MAX_BULLETS}];
uniform int uBulletN;
uniform float uGunKick, uGunFlash, uGunShow, uGunReload;
out vec4 fragColor;

float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash31(vec3 p){ p = fract(p*.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float hash41(vec4 p){ p = fract(p*vec4(.1031,.1030,.0973,.1099)); p += dot(p, p.wzxy+33.33); return fract((p.x+p.y)*(p.z+p.w)); }
vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.); return v*mix(vec3(1),k,s); }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
float sdBox4(vec4 p, vec4 b){ vec4 q = abs(p)-b; return length(max(q,0.))+min(max(max(q.x,q.y),max(q.z,q.w)),0.); }
vec2 opU(vec2 a, vec2 b){ return a.x < b.x ? a : b; }
// Dark lines along block edges (unit grid) — gives everything a "voxel" look.
float gridLines(vec3 p, vec3 n, float s){
  vec3 f = abs(fract(p*s)-.5); vec3 an = abs(n);
  float a = an.x > .5 ? max(f.y,f.z) : an.y > .5 ? max(f.x,f.z) : max(f.x,f.y);
  return smoothstep(.44,.49,a);
}

// Local camera ray for the current projection mode. Returns false outside the image.
bool camRay(vec2 fc, out vec3 o, out vec3 d){
  vec2 uv = (fc - .5*uRes)/uRes.y;
  o = vec3(0);
  float f = tan(uFov*.5);
  if (uProj == 1) {                  // equidistant fisheye, full 360 deg
    float r = length(uv), th = r*2.*PI;
    if (th > PI) return false;
    d = vec3(sin(th)*uv/max(r,1e-5), cos(th));
  } else if (uProj == 2) {           // equirectangular panorama
    float lon = (fc.x/uRes.x-.5)*2.*PI, lat = (fc.y/uRes.y-.5)*PI;
    d = vec3(cos(lat)*sin(lon), sin(lat), cos(lat)*cos(lon));
  } else if (uProj == 3) {           // reverse perspective: rays converge far ahead
    o = vec3(uv*f*16., 0.);
    d = normalize(vec3(-o.xy/28., 1.));
  } else if (uProj == 4) {           // orthographic
    o = vec3(uv*f*14., 0.);
    d = vec3(0,0,1);
  } else {
    d = normalize(vec3(uv*2.*f, 1.));
  }
  return true;
}
vec3 post(vec3 col, vec2 fc){
  vec2 q = fc/uRes; col *= .35 + .65*pow(16.*q.x*q.y*(1.-q.x)*(1.-q.y), .15);
  col = col/(1.+col*.15);
  col = pow(max(col,0.), vec3(1./2.2));
  return col + (hash31(vec3(fc, uTime))-.5)/255.;
}

// ---------- the pistol, drawn in camera space (x right, y up, z forward) ----------
mat2 grot(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
const vec3 GUN_POS = vec3(.19, -.21, .5);
// reload: 0..1 while reloading. The gun dips and rolls inwards, the magazine drops out and a new one slides in.
float reloadPose(){ float r = uGunReload; return r <= 0. ? 0. : smoothstep(0., .18, r)*(1. - smoothstep(.82, 1., r)); }
vec3 gunSpace(vec3 p){
  vec3 q = p - GUN_POS;
  float rp = reloadPose();
  q.y -= rp*.06; q.x += rp*.08;                     // towards the middle of the view
  q.xy = grot(rp*.45)*q.xy;                         // roll the gun inwards
  q.yz = grot(rp*.95)*q.yz;                         // muzzle up: the bottom of the grip turns towards you
  q.z += uGunKick*.05;
  vec2 piv = vec2(-.06,-.05);
  q.yz = grot(-uGunKick*.35)*(q.yz - piv) + piv;   // recoil: muzzle kicks up around the grip
  return q;
}
vec2 gunMap(vec3 p){
  vec3 q = gunSpace(p);
  float slide = sdBox(q - vec3(0,.03,.03), vec3(.026,.022,.13)) - .003;
  slide = max(slide, -(length(q.xy - vec2(0,.03)) - .008));                   // bore
  float frame = sdBox(q - vec3(0,-.006,.02), vec3(.023,.013,.112)) - .002;
  vec3 g = q - vec3(0,-.075,-.06); g.yz = grot(-.3)*g.yz;
  float grip = sdBox(g, vec3(.022,.07,.03)) - .004;
  // magazine, along the grip: out (falling) 0.12-0.45, gone, then in (sliding up) 0.55-0.85
  float rl = uGunReload, off = 0.;
  if (rl > .12 && rl < .45) off = (rl - .12)/.33*.32;
  else if (rl >= .45 && rl < .55) off = 1e3;
  else if (rl >= .55 && rl < .85) off = (1. - (rl - .55)/.3)*.16;
  vec3 mq = g - vec3(0,-off,0);
  float mag = sdBox(mq - vec3(0,-.012,0), vec3(.017,.07,.024)) - .002;
  float guard = max(sdBox(q - vec3(0,-.035,.035), vec3(.005,.024,.036)), -sdBox(q - vec3(0,-.03,.038), vec3(.01,.017,.027)));
  float sights = min(sdBox(q - vec3(0,.057,.145), vec3(.004,.006,.006)), sdBox(q - vec3(0,.057,-.085), vec3(.013,.006,.006)));
  vec2 r = vec2(slide, 1.);
  r = opU(r, vec2(frame, 2.));
  r = opU(r, vec2(min(grip, guard), 3.));
  r = opU(r, vec2(sights, 4.));
  if (off > .001 && off < 10.) r = opU(r, vec2(mag, 5.));
  return r;
}
// returns rgb + coverage
vec4 gunTrace(vec3 lo, vec3 ld){
  if (uGunShow < .5 || uProj > 2) return vec4(0);
  vec4 res = vec4(0);
  // muzzle flash glow (approximate muzzle position in camera space)
  vec3 m = GUN_POS + vec3(0, .03 + uGunKick*.05, .2 - uGunKick*.05);
  float dm = length(m - ld*max(dot(m, ld), 0.));
  vec3 flash = vec3(1.,.72,.3)*uGunFlash*(.0012/(dm*dm + .0006));
  // bounding sphere
  float b = dot(GUN_POS, ld), c = dot(GUN_POS, GUN_POS) - .45*.45, disc = b*b - c;
  if (disc > 0.) {
    float t = max(b - sqrt(disc), 0.), t1 = b + sqrt(disc);
    for (int i = 0; i < 48; i++){
      vec2 h = gunMap(ld*t);
      if (h.x < .0004) {
        vec3 p = ld*t;
        const vec2 k = vec2(1,-1); const float e = .0005;
        vec3 n = normalize(k.xyy*gunMap(p+k.xyy*e).x + k.yyx*gunMap(p+k.yyx*e).x + k.yxy*gunMap(p+k.yxy*e).x + k.xxx*gunMap(p+k.xxx*e).x);
        vec3 q = gunSpace(p);
        vec3 alb = h.y < 1.5 ? vec3(.16,.17,.19) : h.y < 2.5 ? vec3(.1,.1,.11) : h.y < 3.5 ? vec3(.07,.06,.055) : h.y < 4.5 ? vec3(1.,.45,.1) : vec3(.22,.23,.26);
        if (h.y < 1.5 && q.z < -.05 && q.y > .02) alb *= .6 + .4*step(.5, fract(q.z*110.));   // slide serrations
        vec3 L = normalize(vec3(-.4,.8,-.35));
        float dif = max(dot(n, L), 0.);
        float spec = pow(max(dot(reflect(ld, n), L), 0.), 24.);
        vec3 col = alb*(.35 + 1.4*dif) + spec*.35 + alb*uGunFlash*2.;
        if (h.y > 3.5 && h.y < 4.5) col = alb*2.;
        res = vec4(col, 1.);
        break;
      }
      t += h.x;
      if (t > t1) break;
    }
  }
  res.rgb += flash*(1. - res.a*.7);
  res.a = max(res.a, 0.);
  return res;
}
vec3 applyGun(vec3 col, vec3 lo, vec3 ld){
  vec4 g = gunTrace(lo, ld);
  return g.a > .5 ? g.rgb : col + g.rgb;
}
const vec3 BULLET_COL = vec3(1.,.8,.35);
const vec3 ENEMY_COL = vec3(.8,.25,1.);
`;

  const asProbe = s => s.replace('#define PI', '#define PROBE\n#define PI');
  const probeMain = call => `
uniform vec4 uProbe[64];
void main(){
  int i = int(gl_FragCoord.x);
  vec4 q = uProbe[i];
#ifdef RETARDED
  gRT = uTime;
#ifdef RETARD_HOOK
  retardHook();
#endif
#endif
  float d = ${call};
  fragColor = vec4(d, 0., 0., 1.);
}`;
  const dbg = () => (window.WE && WE.debugDefs) || '';

  // ---------------- Euclidean 3D (optionally with a conformally flat metric) ----------------
  // World code must define: vec2 map(vec3 p); vec3 material(float id, vec3 p, vec3 n, inout float emit); vec3 sky(vec3 rd)
  // Optional defines:
  //   SUN_DIR, FOG_DENS, MAX_T
  //   BULLET_WRAP(q)  — wrap a bullet offset (periodic worlds)
  //   CONFORMAL       — world provides vec4 metric(vec3 p) = (grad phi, phi) and float stepLimit(vec3 p);
  //                     rays follow geodesics of g = e^{2 phi} * euclidean, fog uses metric length
  //   PORTALS         — world provides bool portalStep(inout vec3 p, vec3 np) (teleports the ray when it crosses a portal)
  //   VOLUME          — world provides vec3 volume(vec3 p, vec3 rd, float st): light emitted by glowing gas / beams along
  //                     a step of length st (added up along the ray; keep the steps short there with CONFORMAL's stepLimit)
//   CUSTOM_LIGHT    — world provides vec3 light(vec3 p, vec3 n, vec3 rd, vec3 alb, float ao)
  G.euclid = function (code, defs = '') {
    const common = G.header + `
uniform vec3 uCamPos;
uniform mat3 uCamRot;
${defs}${dbg()}
#ifndef SUN_DIR
#define SUN_DIR normalize(vec3(.5,.8,.3))
#endif
#ifndef FOG_DENS
#define FOG_DENS .012
#endif
#ifndef MAX_T
#define MAX_T 200.
#endif
#ifndef BULLET_WRAP
#define BULLET_WRAP(q) (q)
#endif
#ifdef RETARDED
// light needs time: every point along a ray is seen as it was at time gRT = uTime - (distance travelled)/c
uniform float uInvC;
float gRT;
uniform vec4 uBulletV[${G.MAX_BULLETS}];   // velocity, birth time
uniform vec4 uBulletT[${G.MAX_BULLETS}];   // death time (1e9 = alive), reference time of uBullets position, gravity
#endif
#ifdef MIRROR
// number of mirror reflections of the current ray (the world may show things only in reflections)
int gBounce = 0;
#ifndef MIRROR_TINT
#define MIRROR_TINT vec3(.86,.9,.95)
#endif
#endif
${code}
`;
    const render = common + `
// x = distance to nearest bullet, y/z = distance in units of the radius (halo) for player / enemy bullets,
// w = type of the nearest one (0 player, 1 enemy — stored in the 4th component)
vec4 bulletDist(vec3 p){
  vec4 r = vec4(1e9, 1e9, 1e9, 0.);
  for (int i = 0; i < ${G.MAX_BULLETS}; i++){
    if (i >= uBulletN) break;
#ifdef RETARDED
    // seen as it was when the light left it: position at the emission time gRT of this ray point
    float T = gRT, td = uBulletT[i].x;
    if (T < uBulletV[i].w || T > td + .3) continue;                     // not fired yet / flash already over
    float tau = min(T, td) - uBulletT[i].y;
    vec3 q = p - (uBullets[i].xyz + uBulletV[i].xyz*tau - vec3(0, .5*uBulletT[i].z*tau*tau, 0));
    float rr = T < td ? uBulletR[i] : uBulletR[i]*(1. + 14.*(T - td))*max(.05, 1. - (T - td)/.3);
    // the retarded image moves along the ray (1 + v/c) times faster than the ray: keep the step conservative
    float dr = length(q) - rr, d = dr/(1. + length(uBulletV[i].xyz)*uInvC), e = uBullets[i].w;
#else
    vec3 q = BULLET_WRAP(p - uBullets[i].xyz);
    float d = length(q) - uBulletR[i], e = uBullets[i].w, dr = d;
#endif
    if (d < r.x) { r.x = d; r.w = e; }
    if (e > .5) r.z = min(r.z, dr/uBulletR[i]); else r.y = min(r.y, dr/uBulletR[i]);
  }
  return r;
}
#ifdef RELATIVITY
// World-frame direction of a ray seen in direction d by an observer moving with velocity uBeta (units of c):
// relativistic aberration, cos(world) = (cos(seen) - b)/(1 - b cos(seen)).
uniform vec3 uBeta;
uniform float uAberr, uDoppler;
vec3 aberrate(vec3 d){
  float b = length(uBeta);
  if (b < 1e-4 || uAberr < .5) return d;
  vec3 n = uBeta/b;
  float c = dot(d, n);
  float cw = (c - b)/(1. - b*c);
  vec3 perp = d - c*n; float pl = length(perp);
  return pl < 1e-6 ? n*sign(cw) : cw*n + sqrt(max(0., 1. - cw*cw))*perp/pl;
}
// Doppler: a colour is turned into a broad emitted spectrum — three wide bands (R, G, B) plus a smooth
// thermal-like continuum reaching into IR and UV, so shifted light does not simply vanish. Received light at
// wavelength l was emitted at l*D; the received spectrum is sampled across the visible range and projected
// onto the eye's R, G, B responses. Intensity scales like D^3 (relativistic beaming, clamped).
float emitted(vec3 col, float l){
  vec3 b = exp(-pow((vec3(l) - vec3(610., 545., 460.))/vec3(70., 60., 55.), vec3(2.)));
  float lum = dot(col, vec3(.3,.5,.2));
  return dot(col, b) + .35*lum*exp(-pow((l - 560.)/420., 2.));
}
vec3 dopplerShift(vec3 col, float D){
  if (uDoppler < .5 || abs(D - 1.) < .002) return col;
  vec3 o = vec3(0), norm = vec3(0);
  for (int j = 0; j < 10; j++){
    float l = 400. + float(j)*33.;                        // received wavelength
    vec3 eye = exp(-pow((vec3(l) - vec3(600., 545., 455.))/vec3(50., 45., 35.), vec3(2.)));
    o += eye*emitted(col, l*D);
    norm += eye*emitted(vec3(1), l);
  }
  // normalise so that D = 1 gives back the original colour (for white light)
  return o/norm*min(D*D*D, 8.);
}
#endif
vec3 calcNormal(vec3 p){
  vec3 n = vec3(0);
  for (int i = uZero; i < 4; i++){                          // tetrahedral gradient
    vec3 e = .5773*(2.*vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.);
    n += e*map(p + e*.0015).x;
  }
  return normalize(n);
}
float calcAO(vec3 p, vec3 n){
  float o = 0., s = 1.;
  for (int i = 1 + uZero; i <= 5; i++){ float h = .06*float(i)*float(i); o += (h - map(p+n*h).x)*s; s *= .6; }
  return clamp(1.-1.2*o, 0., 1.);
}
float shadow(vec3 p, vec3 l){
  float r = 1., t = .03;
  for (int i = uZero; i < 56; i++){
    float h = map(p+l*t).x;
    r = min(r, 7.*h/t);
    t += clamp(h, .02, .9);
    if (r < .01 || t > 40.) break;
  }
  return clamp(r, 0., 1.);
}
void main(){
  vec3 lo, ld;
  if (!camRay(gl_FragCoord.xy - uViewOff, lo, ld)) { fragColor = vec4(0,0,0,1); return; }
  vec3 p = uCamPos + uCamRot*lo, rd = uCamRot*ld;
#ifdef RELATIVITY
  rd = aberrate(rd);
  float gam = inversesqrt(max(1e-4, 1. - dot(uBeta, uBeta)));
  float Dop = gam*(1. + dot(uBeta, rd));        // frequency ratio received/emitted for this pixel
#endif
  float t = 0., tf = 0.; vec2 h = vec2(1e9, -1.); bool hit = false, inside = true;
  float bmin = 1e9, emin = 1e9;
#ifdef VOLUME
  vec3 vacc = vec3(0);
#endif
#ifdef RETARDED
  gRT = uTime;
#endif
#ifdef MIRROR
  vec3 mirrorTint = vec3(1);
  gBounce = 0;
#endif
#ifdef CONFORMAL
  float gm = length(metric(p).xyz);
#endif
  for (int i = 0; i < 400; i++){
#ifdef RETARDED
    gRT = uTime - t*uInvC;
#ifdef RETARD_HOOK
    retardHook();
#endif
#endif
    h = map(p);
    if (inside) { if (h.x < .02 && t < 60.) { p += rd*(abs(h.x)+.03); t += abs(h.x)+.03; continue; } inside = false; }
    vec4 bd = bulletDist(p);
    bmin = min(bmin, bd.y); emin = min(emin, bd.z);
    if (bd.x < h.x) h = vec2(bd.x, 99. + bd.w);
    if (h.x < .0004 + t*1.2/uRes.y) {
#ifdef MIRROR
      // mirror: reflect and keep going — the path length (and so the light delay) keeps adding up
      if (isMirror(h.y) && gBounce < 6) {
        vec3 n = calcNormal(p);
        rd = reflect(rd, n); p += n*(.03 + t*4./uRes.y); gBounce++; mirrorTint *= MIRROR_TINT;
        continue;
      }
#endif
      hit = true; break;
    }
    if (t > MAX_T) break;
    float st = h.x*.95;
#ifdef RETARDED
    st *= .6;             // objects may move towards the ray while its light is in flight
#endif
#ifdef CONFORMAL
    // adaptive step: the ray may turn by at most ~0.08 rad per step (strong fields otherwise scramble it)
    st = min(st, min(stepLimit(p), .08/max(gm, 1e-3) + .01));
    vec4 m = metric(p + rd*st*.5);                   // midpoint: bend the ray by the transverse gradient of phi
    gm = length(m.xyz);
    rd = normalize(rd + st*(m.xyz - dot(m.xyz, rd)*rd));
    tf += st*exp(m.w);
#else
    tf += st;
#endif
#ifdef VOLUME
    vacc += volume(p, rd, st)*exp(-FOG_DENS*tf);
#endif
#ifdef PORTALS
    vec3 np = p + rd*st;
    if (!portalStep(p, np)) p = np;      // seamless portal: the ray continues from the glued place
#else
    p += rd*st;
#endif
    t += st;
  }
  vec3 col;
  vec3 skyc = sky(rd);
  if (hit && h.y > 98.) col = (h.y > 99.5 ? ENEMY_COL*2.2 : BULLET_COL*5.)*clamp(t/1.5, .15, 1.);   // do not blind the player up close
  else if (hit) {
    vec3 n = calcNormal(p);
    float emit = 0.;
    vec3 alb = material(h.y, p, n, emit);
    float ao = calcAO(p, n);
#ifdef CUSTOM_LIGHT
    col = light(p, n, rd, alb, ao);
#else
    vec3 L = SUN_DIR;
    float dif = max(dot(n, L), 0.);
    if (dif > 0.) dif *= shadow(p + n*.01, L);
    float amb = .5 + .5*n.y;
    col = alb*(vec3(1.25,1.1,.9)*dif*1.3 + sky(n)*amb*ao*.9 + vec3(.25,.2,.2)*max(-n.y,0.)*ao);
#endif
    col += alb*emit;
    col = mix(skyc, col, exp(-FOG_DENS*tf));
  } else col = inside ? vec3(.06,.055,.07) : skyc;
#ifdef VOLUME
  col += vacc;
#endif
  col += BULLET_COL*exp(-max(bmin, 0.)*.6)*1.2 + ENEMY_COL*exp(-max(emin, 0.)*1.5)*.9;
#ifdef MIRROR
  col *= mirrorTint;
#endif
#ifdef RELATIVITY
  col = dopplerShift(col, Dop);
#endif
  col = applyGun(col, lo, ld);
  fragColor = vec4(post(col, gl_FragCoord.xy - uViewOff), 1);
}`;
    return { render, probe: asProbe(common) + probeMain('map(q.xyz).x') };
  };

  // ---------------- 4D Euclidean ----------------
  // World code: vec2 map(vec4 p); vec3 material(float id, vec4 p, vec4 n, inout float emit); vec3 sky(vec4 rd)
  G.nd = function (code, defs = '') {
    const common = G.header + `
uniform vec4 uPos;
uniform mat3x4 uBasis;  // columns: right, up, forward
${defs}${dbg()}
#ifndef SUN4
#define SUN4 normalize(vec4(.45,.8,.3,.25))
#endif
#ifndef FOG_DENS
#define FOG_DENS .014
#endif
${code}
`;
    const render = common + `
// x = distance to the nearest bullet, y / z = distance in radii (halo) for player / enemy bullets,
// w = 1 if the nearest one is an enemy projectile (marked by a negative radius)
vec4 bulletDist(vec4 p){
  vec4 r = vec4(1e9, 1e9, 1e9, 0.);
  for (int i = 0; i < ${G.MAX_BULLETS}; i++){
    if (i >= uBulletN) break;
    float R = abs(uBulletR[i]), d = length(p - uBullets[i]) - R, e = uBulletR[i] < 0. ? 1. : 0.;
    if (d < r.x) { r.x = d; r.w = e; }
    if (e > .5) r.z = min(r.z, d/R); else r.y = min(r.y, d/R);
  }
  return r;
}
vec4 grad(vec4 p){
  vec4 g = vec4(0);
  for (int i = uZero; i < 4; i++){ vec4 e = vec4(0); e[i] = .002; g[i] = map(p + e).x - map(p - e).x; }
  return normalize(g);
}
float calcAO(vec4 p, vec4 n){
  float o = 0., s = 1.;
  for (int i = 1 + uZero; i <= 5; i++){ float h = .06*float(i)*float(i); o += (h - map(p+n*h).x)*s; s *= .6; }
  return clamp(1.-1.2*o, 0., 1.);
}
float shadow(vec4 p, vec4 l){
  float r = 1., t = .03;
  for (int i = uZero; i < 36; i++){
    float h = map(p+l*t).x;
    r = min(r, 7.*h/t);
    t += clamp(h, .02, .9);
    if (r < .01 || t > 30.) break;
  }
  return clamp(r, 0., 1.);
}
void main(){
  vec3 lo, ld;
  if (!camRay(gl_FragCoord.xy - uViewOff, lo, ld)) { fragColor = vec4(0,0,0,1); return; }
  vec4 ro = uPos + uBasis*lo;
  vec4 rd = uBasis*ld;
  float t = 0.; vec2 h = vec2(1e9,-1.); bool hit = false, inside = true;
  float bmin = 1e9, emin = 1e9;
  for (int i = 0; i < 220; i++){
    vec4 p = ro+rd*t;
    h = map(p);
    if (inside) { if (h.x < .02 && t < 60.) { t += abs(h.x)+.03; continue; } inside = false; }
    vec4 bd = bulletDist(p);
    bmin = min(bmin, bd.y); emin = min(emin, bd.z);
    if (bd.x < h.x) h = vec2(bd.x, 99. + bd.w);
    if (h.x < .0004 + t*1.2/uRes.y) { hit = true; break; }
    if (t > 160.) break;
    t += h.x*.95;
  }
  vec3 skyc = sky(rd);
  vec3 col = inside ? vec3(.06,.055,.07) : skyc;
  if (hit && h.y > 98.) col = h.y > 99.5 ? ENEMY_COL*2.2 : BULLET_COL*5.;
  else if (hit) {
    vec4 p = ro+rd*t;
    vec4 n = grad(p);
    float emit = 0.;
    vec3 alb = material(h.y, p, n, emit);
    float dif = max(dot(n, SUN4), 0.);
    if (dif > 0.) dif *= shadow(p + n*.01, SUN4);
    float ao = calcAO(p, n);
    // how much the surface normal points "out of" the visible 3D slice (into W)
    float hidden = clamp(1. - length(vec3(dot(n,uBasis[0]), dot(n,uBasis[1]), dot(n,uBasis[2]))), 0., 1.);
    col = alb*(vec3(1.25,1.1,.95)*dif*1.3 + vec3(.45,.55,.8)*(.5+.5*n.y)*ao);
    col += alb*emit + vec3(.9,.3,1.)*hidden*.35*ao;
    col = mix(skyc, col, exp(-FOG_DENS*t));
  }
  col += BULLET_COL*exp(-max(bmin, 0.)*.6)*1.2 + ENEMY_COL*exp(-max(emin, 0.)*1.5)*.9;
  col = applyGun(col, lo, ld);
  fragColor = vec4(post(col, gl_FragCoord.xy - uViewOff), 1);
}`;
    return { render, probe: asProbe(common) + probeMain('map(q).x') };
  };

  // ---------------- constant curvature: K=+1 (S3) or K=-1 (H3) ----------------
  // Points live on the unit sphere in R4 or the hyperboloid <p,p> = -1 (w = time-like).
  // World code: vec2 map(vec4 p); vec3 material(float id, vec4 p, vec4 n, inout float emit); vec3 fogColor(vec3 ldir)
  G.curved = function (K, code, defs = '') {
    const common = G.header + `
#define KSIGN ${K > 0 ? '1.' : '-1.'}
uniform mat4 uCam;   // columns: right, up, forward, position
uniform vec4 uLight;
float kdot(vec4 a, vec4 b){ return dot(a.xyz,b.xyz) + KSIGN*a.w*b.w; }
#if ${K > 0 ? 1 : 0}
float kdist(vec4 a, vec4 b){ return acos(clamp(dot(a,b),-1.,1.)); }
vec4 geoP(vec4 p, vec4 v, float t){ return cos(t)*p + sin(t)*v; }
vec4 geoV(vec4 p, vec4 v, float t){ return -sin(t)*p + cos(t)*v; }
vec4 knorm(vec4 p){ return normalize(p); }
#else
float kdist(vec4 a, vec4 b){ return acosh(max(1., -kdot(a,b))); }
vec4 geoP(vec4 p, vec4 v, float t){ return cosh(t)*p + sinh(t)*v; }
vec4 geoV(vec4 p, vec4 v, float t){ return sinh(t)*p + cosh(t)*v; }
vec4 knorm(vec4 p){ return p/sqrt(max(1e-6, -kdot(p,p))); }
#endif
// unit tangent at p pointing towards q
vec4 kdir(vec4 p, vec4 q){ vec4 v = q - KSIGN*kdot(p,q)*p; return v/sqrt(max(1e-9, kdot(v,v))); }
${defs}${dbg()}
#ifndef MAX_T
#define MAX_T 12.
#endif
#ifndef FOG_DENS
#define FOG_DENS .25
#endif
${code}
`;
    const render = common + `
// x = distance to the nearest bullet, y / z = distance in radii (halo) for player / enemy bullets,
// w = 1 if the nearest one is an enemy projectile (marked by a negative radius)
vec4 bulletDist(vec4 p){
  vec4 r = vec4(1e9, 1e9, 1e9, 0.);
  for (int i = 0; i < ${G.MAX_BULLETS}; i++){
    if (i >= uBulletN) break;
    float R = abs(uBulletR[i]), d = kdist(p, uBullets[i]) - R, e = uBulletR[i] < 0. ? 1. : 0.;
    if (d < r.x) { r.x = d; r.w = e; }
    if (e > .5) r.z = min(r.z, d/R); else r.y = min(r.y, d/R);
  }
  return r;
}
vec4 calcNormal(vec4 p){
  vec4 g = vec4(0);
  for (int i = uZero; i < 4; i++){ vec4 e = vec4(0); e[i] = .001; g[i] = map(knorm(p + e)).x - map(knorm(p - e)).x; }
  g.w *= KSIGN;                      // raise index with the metric
  g -= KSIGN*kdot(g,p)*p;            // project to tangent space
  return g/sqrt(max(1e-12, kdot(g,g)));
}
float calcAO(vec4 p, vec4 n){
  float o = 0., s = 1.;
  for (int i = 1 + uZero; i <= 5; i++){ float h = .02*float(i)*float(i); o += (h - map(geoP(p,n,h)).x)*s; s *= .6; }
  return clamp(1.-1.5*o, 0., 1.);
}
void main(){
  vec3 lo, ld;
  if (!camRay(gl_FragCoord.xy - uViewOff, lo, ld)) { fragColor = vec4(0,0,0,1); return; }
  vec4 ro = uCam[3];
  vec4 rd = uCam*vec4(ld, 0.);
  float ol = length(lo);
  if (ol > 1e-5) {                   // origin-offset projections: exponential map, then re-project direction
    ol *= .08;
    vec4 u = uCam*vec4(lo/length(lo), 0.);
    ro = knorm(geoP(ro, u, ol));
    rd = rd - KSIGN*kdot(rd, ro)*ro; rd /= sqrt(max(1e-9, kdot(rd,rd)));
  }
  float t = 0.; vec2 h = vec2(1e9,-1.); vec4 p = ro; bool hit = false;
  float bmin = 1e9, emin = 1e9;
  for (int i = 0; i < 200; i++){
    p = geoP(ro, rd, t);
    h = map(p);
    vec4 bd = bulletDist(p);
    bmin = min(bmin, bd.y); emin = min(emin, bd.z);
    if (bd.x < h.x) h = vec2(bd.x, 99. + bd.w);
    float fp = KSIGN > 0. ? abs(sin(t)) : sinh(t);
    if (h.x < .0003 + fp*1.5/uRes.y) { hit = true; break; }
    if (t > MAX_T) break;
    t += h.x*.9;
  }
  vec3 col = fogColor(ld);
  if (hit && h.y > 98.) col = h.y > 99.5 ? ENEMY_COL*2.2 : BULLET_COL*5.;
  else if (hit) {
    p = knorm(p);
    vec4 n = calcNormal(p);
    float emit = 0.;
    vec3 alb = material(h.y, p, n, emit);
    vec4 L = kdir(p, uLight);
    float dl = kdist(p, uLight);
    float dif = max(kdot(n, L), 0.);
    float ao = calcAO(p, n);
    vec4 v = -geoV(ro, rd, t);
    float fr = pow(1. - max(kdot(n, v), 0.), 3.);
    col = alb*(dif*1.4/(1.+dl*dl*.6) + .35*ao + .25*(.5+.5*n.y)) + alb*emit + fr*.15;
    col = mix(fogColor(ld), col, exp(-FOG_DENS*t));
  }
  col += BULLET_COL*exp(-max(bmin, 0.)*.6)*1.2 + ENEMY_COL*exp(-max(emin, 0.)*1.5)*.9;
  col = applyGun(col, lo, ld);
  fragColor = vec4(post(col, gl_FragCoord.xy - uViewOff), 1);
}`;
    return { render, probe: asProbe(common) + probeMain('map(q).x') };
  };

  window.WG = G;
})();
