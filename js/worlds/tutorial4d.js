// SAMOUCZEK 4D — a guided course in moving through four dimensions, lesson by lesson:
//   the familiar axes x, y, z → the 4th axis w and what a 3D slice is → slices of a hypersphere and a gate that
//   exists only for some w → turning into W (Q / E, Z / C) and aligning back → the cameras one by one
//   ((x y z), (w y z), (x w z), (x y w)) → all four at once → a final test.
// Each lesson has a text panel, tasks checked automatically, labels pinned to things in the world and the axis
// gizmo (js/nd4.js) in the corner. Engine axes: x, y (up), z, w — shown as x, z (height), y (floor), w.
(function () {
  const EYE = 1.6;
  // places (engine coordinates)
  const POST_X = [8, 1, 0, 0], POST_Y = [0, 1, 8, 0];
  const SPHERE = [0, 1.6, 12, 4], SPHERE_R = 2.2, GATE = [0, 1.8, 16, 4];
  const BEACON = [0, 1.6, -6, 9], LESSON_ROT = [0, EYE, -6, 0];
  const CAM0 = [-12, EYE, -12, 0];
  const ROW1 = [], ROW2 = [];                          // pillars along W: in front of you / right beside you
  for (let w = -6; w <= 14; w += 2) ROW1.push([CAM0[0], 1, CAM0[2] + 6, w]);
  for (let w = 2; w <= 14; w += 2) ROW2.push([CAM0[0] + 1.6, 1, CAM0[2], w]);
  const GOAL = [12, 1.5, 12, 0];
  const FINAL = [7, EYE, 7, 0];

  // ---- practice levels: collect the crystals (glowing hyperspheres). Harder and harder. ----
  // boxes: [cx, cy, cz, cw, hx, hy, hz, hw, kind] (kind 1 platform / floor, 2 wall), engine axes (x, y up, z, w)
  const plat = (x, z, w, hx, hz, hw, top = 0) => [x, top - 0.2, z, w, hx, 0.2, hz, hw, 1];
  const wall = (x, z, w, hx, hz, hw, h = 3) => [x, h / 2, z, w, hx, h / 2, hz, hw, 2];
  const floorW = (w0, w1, s) => plat(0, 0, (w0 + w1) / 2, s, s, (w1 - w0) / 2);
  const cage = (x, z, w0, w1) => { const wc = (w0 + w1) / 2, hw = (w1 - w0) / 2; return [wall(x - 2.2, z, wc, 0.15, 2.35, hw), wall(x + 2.2, z, wc, 0.15, 2.35, hw), wall(x, z - 2.2, wc, 2.35, 0.15, hw), wall(x, z + 2.2, wc, 2.35, 0.15, hw)]; };
  const C = (x, z, w, y = 1.2) => [x, y, z, w];
  const diag = [];
  for (let k = 1; k <= 14; k++) diag.push(plat(0, k * 0.75, k * 0.75, 0.85, 0.85, 0.85));
  const stairs = [];
  for (let k = 1; k <= 9; k++) stairs.push(plat(k * 0.6, 0, 0.5 + k, 1.2, 1.4, 0.7, k * 0.35));
  const LEVELS = [
    { title: 'Rozgrzewka', text: 'Zbierz trzy kryształy. Wszystkie leżą przy w = 0, więc wystarczy zwykłe chodzenie. Złota strzałka w gizmo pokazuje kierunek do najbliższego.',
      start: [0, EYE, -8, 0], boxes: [floorW(-2, 2, 12)], crystals: [C(6, 0, 0), C(0, 7, 0), C(-6, -5, 0)], hint: true },
    { title: 'Jedno miejsce, różne w', text: 'Trzy kryształy w tym samym miejscu podłogi, ale przy różnym w. Chodź tylko w osi W (T / G, kółko).',
      start: [0, EYE, 2, 0], boxes: [floorW(-10, 10, 10)], crystals: [C(0, 5, 3), C(0, 5, -4), C(0, 5, 8)], hint: true },
    { title: 'Rozrzucone w (x, y, w)', text: 'Kryształy leżą w różnych miejscach podłogi I przy różnym w. Łącz zwykły ruch z krokami w W — patrz, ile strzałki celu jest „poza” widokiem.',
      start: [0, EYE, 0, 0], boxes: [floorW(-10, 12, 12)], crystals: [C(5, 3, 4), C(-5, 7, -6), C(3, -6, 9), C(-7, -3, 2)], hint: true },
    { title: 'Klatki z grubością w W', text: 'Każdy kryształ siedzi w klatce bez drzwi, ale każda klatka istnieje tylko w pewnym zakresie w. Obejdź ścianę czwartym wymiarem.',
      start: [0, EYE, 0, 0], boxes: [floorW(-8, 10, 12), ...cage(6, 6, -1.5, 1.5), ...cage(-6, 4, 3, 7), ...cage(0, -7, -6, 1)], crystals: [C(6, 6, 0), C(-6, 4, 5), C(0, -7, -3)], hint: true },
    { title: 'Most wzdłuż W', text: 'Pod tobą przepaść. Most biegnie wzdłuż osi W, więc w zwykłej kamerze widzisz tylko jego kawałek. Przełącz kamerę na (x w z) klawiszem Y — zobaczysz most przed sobą. Uwaga na zakręt w bok.',
      start: [0, EYE, 0, 0], boxes: [plat(0, 0, 0, 2, 2, 1.2), plat(0, 0, 5, 0.6, 0.6, 4.3), plat(2, 0, 8, 2.6, 0.6, 0.6), plat(4, 0, 12.8, 0.6, 0.6, 4.9), plat(4, 0, 18.8, 2, 2, 1.8)],
      crystals: [C(2, 0, 8), C(4, 0, 18.8)], hint: true, void: true },
    { title: 'Ukośny most', text: 'Most biegnie po skosie: naraz do przodu (y) i w osi W. Obróć się w W (E) o 45°, aż „przód” będzie wzdłuż mostu — wtedy idź zwykłym W. Po drodze pomoże kamera (x w z) albo cztery kamery (F).',
      start: [0, EYE, -1, 0], boxes: [plat(0, 0, 0, 2, 2, 1.2), ...diag, plat(0, 12.6, 12.6, 2, 2, 1.4)], crystals: [C(0, 5.25, 5.25), C(0, 12.6, 12.6)], hint: true, void: true },
    { title: 'Zakręty w 4D', text: 'Wąska ścieżka nad przepaścią skręca kolejno w osi y, w, x, znowu w i y. Na każdym zakręcie leży kryształ. Używaj kamer (Y / F) i gizma.',
      start: [0, EYE, 0, 0], boxes: [plat(0, 0, 0, 2, 2, 1), plat(0, 6, 0, 0.7, 4.6, 0.7), plat(0, 10, 4, 0.7, 0.7, 4.7), plat(4, 10, 8, 4.7, 0.7, 0.7), plat(8, 10, 4, 0.7, 0.7, 4.7), plat(8, 11.5, 0, 0.7, 1.7, 0.7), plat(8, 14, 0, 2, 2, 1.2)],
      crystals: [C(0, 10, 0), C(0, 10, 8), C(8, 10, 8), C(8, 14, 0)], hint: true, void: true },
    { title: 'Schody przez W', text: 'Każdy stopień leży przy innym w (i trochę wyżej). Wchodź po nich krokami w W — w zwykłej kamerze następny stopień pojawia się dopiero, gdy do niego dojdziesz.',
      start: [0, EYE, 0, 0], boxes: [plat(0, 0, 0, 2, 2, 1), ...stairs, plat(6, 0, 10.8, 2, 2, 1, 3.5)], crystals: [C(2.4, 0, 4.5, 2.6), C(6, 0, 10.8, 4.7)], hint: true, void: true },
    { title: 'Ukryte w przekrojach', text: 'Bez strzałki! Pięć kryształów rozrzuconych daleko w (x, y, w). Pomaga kompas 4D w rogu (B) — pokazuje kryształy w przestrzeni (x, y, w) — oraz kamery.',
      start: [0, EYE, 0, 0], boxes: [floorW(-14, 14, 14)], crystals: [C(9, -8, -11), C(-10, 9, 12), C(2, 11, -6), C(-8, -9, 6), C(11, 6, 1)], hint: false, compass: true },
    { title: 'Na czas', text: 'Sześć kryształów — na podłodze, w klatkach i na moście w W — w 90 sekund. Strzałka wskazuje najbliższy.',
      start: [0, EYE, 0, 0], boxes: [floorW(-8, 8, 12), ...cage(7, -7, -2, 2), ...cage(-7, 7, 2, 6), plat(0, 13, 0, 1.5, 2, 0.8), plat(0, 13.5, 6, 0.6, 0.6, 5.8), plat(0, 13.5, 12, 1.5, 1.5, 1)],
      crystals: [C(7, -7, 0), C(-7, 7, 4), C(9, 8, -6), C(-9, -9, 7), C(0, 13.5, 12), C(4, 0, -7)], hint: true, time: 90 },
  ];
  const NB = 24, NC = 8;

  const v4 = a => `vec4(${a.map(x => (+x).toFixed(2)).join(',')})`;
  const code = `
${WSwarm.glslMat(false, 1, true)}
const vec4 SPH = ${v4(SPHERE)}, GATEC = ${v4(GATE)}, BEAC = ${v4(BEACON)}, GOALP = ${v4(GOAL)};
const vec4 ROW1[${ROW1.length}] = vec4[](${ROW1.map(v4).join(',')});
const vec4 ROW2[${ROW2.length}] = vec4[](${ROW2.map(v4).join(',')});
// practice levels: boxes and crystals from uniforms
uniform int uLvl, uBN, uCrN;
uniform vec4 uBC[${NB}], uBH[${NB}], uCr[${NC}];
uniform float uBK[${NB}];
vec2 levelMap(vec4 p){
  vec2 r = vec2(1e9, 0.);
  for (int i = uZero; i < ${NB}; i++) {
    if (i >= uBN) break;
    vec4 d = abs(p - uBC[i]) - uBH[i];
    if (max(max(d.x, d.y), max(d.z, d.w)) > r.x) continue;
    r = opU(r, vec2(sdBox4(p - uBC[i], uBH[i]), uBK[i] > 1.5 ? 91. : 90.));
  }
#ifndef PROBE
  for (int i = uZero; i < ${NC}; i++) { if (i >= uCrN) break; r = opU(r, vec2(length(p - uCr[i]) - .45, 92.)); }
  r = opU(r, enemies(p));
#endif
  return r;
}
vec2 lessonMap(vec4 p);
vec2 map(vec4 p){ return uLvl == 1 ? levelMap(p) : lessonMap(p); }
vec2 lessonMap(vec4 p){
  // the floor exists for x, y in [-24, 24] and w in [-8, 16]
  vec2 r = vec2(sdBox4(p - vec4(0,-.25,0,4), vec4(24.,.25,24.,12.)), 1.);
  // the axes at the origin: x (red), y (green) on the floor, z (blue) up — they lie in the slice w = 0 (thickness .3)
  r = opU(r, vec2(sdBox4(p - vec4(3.,.06,0,0), vec4(3.,.06,.06,.3)), 10.));
  r = opU(r, vec2(sdBox4(p - vec4(6.2,.12,0,0), vec4(.25,.12,.18,.3)), 10.));
  r = opU(r, vec2(sdBox4(p - vec4(0,.06,3.,0), vec4(.06,.06,3.,.3)), 11.));
  r = opU(r, vec2(sdBox4(p - vec4(0,.12,6.2,0), vec4(.18,.12,.25,.3)), 11.));
  r = opU(r, vec2(sdBox4(p - vec4(0,1.5,0,0), vec4(.06,1.5,.06,.3)), 12.));
  r = opU(r, vec2(sdBox4(p - vec4(0,3.1,0,0), vec4(.18,.18,.18,.3)), 12.));
  // the w axis: a violet cube at the origin present in every slice w = 0 … 12 (that is where the axis crosses it)
  r = opU(r, vec2(sdBox4(p - vec4(0,.35,0,6.), vec4(.25,.25,.25,6.)), 13.));
  // lesson 1: posts on the x and y axes
  r = opU(r, vec2(sdBox4(p - ${v4(POST_X)}, vec4(.3,1.,.3,.4)), 10.));
  r = opU(r, vec2(sdBox4(p - ${v4(POST_Y)}, vec4(.3,1.,.3,.4)), 11.));
  // lesson 3: a hypersphere (centre w = 4) and a gate that exists only for w in [3, 5]
  r = opU(r, vec2(length(p - SPH) - ${SPHERE_R.toFixed(2)}, 14.));
  vec4 g = p - GATEC;
  r = opU(r, vec2(max(sdBox4(g, vec4(2.2,1.8,.25,1.)), -sdBox4(g, vec4(1.4,1.4,1.,2.))), 15.));
  // lessons 4, 5: a beacon at the same spot of the floor as the lesson start, but at w = 9
  r = opU(r, vec2(min(length(p - BEAC) - .7, sdBox4(p - BEAC - vec4(0,1.6,0,0), vec4(.12,1.6,.12,.4))), 16.));
  // lessons 6 – 9: pillars along W
  for (int i = uZero; i < ${ROW1.length}; i++) r = opU(r, vec2(sdBox4(p - ROW1[i], vec4(.35,1.,.35,.3)), 64. + float(i)));
  for (int i = uZero; i < ${ROW2.length}; i++) r = opU(r, vec2(sdBox4(p - ROW2[i], vec4(.3,1.,.3,.3)), 80. + float(i)));
  // the final test: the golden hypersphere in a cage whose walls are thick only in W (w from -1 to 1)
  vec4 c = p - (GOALP - vec4(0,1.5,0,0));
  r = opU(r, vec2(max(sdBox4(c - vec4(0,1.6,0,0), vec4(2.6,1.6,2.6,1.)), -sdBox4(c - vec4(0,1.6,0,0), vec4(2.3,3.,2.3,3.))), 17.));
  r = opU(r, vec2(length(p - GOALP) - .7, 18.));
#ifndef PROBE
  r = opU(r, enemies(p));                                  // the other players
#endif
  return r;
}
vec3 sky(vec4 rd){
  vec3 c = mix(vec3(.85,.82,.92), vec3(.32,.38,.7), clamp(rd.y*1.2, 0., 1.));
  c = mix(vec3(.1,.08,.14), c, smoothstep(-.35, .05, rd.y));
  return c + vec3(1.,.9,.7)*pow(max(dot(rd, SUN4), 0.), 200.)*3.;
}
vec3 material(float id, vec4 p, vec4 n, inout float emit){
  if (id > 19.5 && id < 63.9) return enemyColor(id, p, n, emit);
  if (id > 89.5 && id < 90.5) {                           // level platforms: hue = w, grid
    vec2 f = abs(fract(p.xz) - .5);
    return mix(hsv(fract(p.w*.07 + .6), .5, 1.)*.8, vec3(.25), smoothstep(.47, .49, max(f.x, f.y))*.6);
  }
  if (id > 90.5 && id < 91.5) return mix(vec3(.55,.6,.75), vec3(.35,.4,.55), step(.5, fract(p.y*2.)));
  if (id > 91.5 && id < 92.5) { emit = 2.5 + sin(uTime*4.)*.8; return vec3(.5,1.,.95); }   // crystals
  vec3 wc = hsv(fract(p.w*.07 + .6), .5, 1.);            // the hue of the floor = your w
  if (id < 1.5) {
    vec2 f = abs(fract(p.xz) - .5);
    float line = smoothstep(.47, .49, max(f.x, f.y));
    float major = smoothstep(.06, .03, min(abs(p.x), abs(p.z)));   // the x and y axes drawn on the floor
    vec3 c = mix(wc*.75, vec3(.25), line*.6);
    if (abs(p.w) < .35) c = mix(c, abs(p.z) < abs(p.x) ? vec3(1.,.4,.4) : vec3(.4,1.,.55), major*.7);
    return c;
  }
  if (id < 10.5) { emit = .5; return vec3(1.,.35,.35); }   // x: red
  if (id < 11.5) { emit = .5; return vec3(.35,.95,.5); }   // y: green
  if (id < 12.5) { emit = .5; return vec3(.35,.6,1.); }    // z: blue
  if (id < 13.5) { emit = .9; return vec3(.85,.45,1.); }   // w: violet
  if (id < 14.5) return hsv(fract(p.w*.12 + .1), .55, 1.);  // the hypersphere: hue = w
  if (id < 15.5) { emit = .4; return vec3(.95,.8,.35); }    // the gate
  if (id < 16.5) { emit = 2.; return vec3(1.,.85,.4); }     // the beacon
  if (id < 17.5) return vec3(.7,.72,.8);                    // the cage
  if (id < 18.5) { emit = 3.; return vec3(1.,.8,.3); }      // the goal
  if (id < 79.5) { emit = .3; return hsv(fract((id - 64.)/${ROW1.length}.), .7, 1.); }   // row 1: hue by index (= by w)
  emit = .3; return hsv(fract((id - 80.)/${ROW2.length}. + .3), .7, 1.);
}
`;

  // ---- lessons ----
  const A = k => `<span class="ax-${k}">${k}</span>`, K = k => `<kbd>${k}</kbd>`;
  const P = () => world.player, pos = () => P().pos;
  const near = (a, b, r, wr = 0.6) => Math.hypot(a[0] - b[0], a[2] - b[2]) < r && Math.abs(a[3] - b[3]) < wr;
  const L = [
    {
      title: 'Trzy znane osie: x, y, z',
      text: `Ten świat ma cztery osie. Trzy znasz z codzienności: ${A('x')} — w bok (czerwona) i ${A('y')} — w przód (zielona) leżą na podłodze,
        a ${A('z')} — wysokość (niebieska) — sterczy w górę. Ich strzałki stoją przed tobą przy początku układu.<br>
        W lewym dolnym rogu ekranu jest <b>gizmo osi</b>: pokazuje, dokąd wskazują osie świata względem tego, co widzisz.
        Obróć się myszą i patrz, jak się obraca.`,
      start: w => w.goto([-3, EYE, -5, 0], 0),
      tasks: [
        ['Podejdź do czerwonego słupka na osi x (x = 8)', () => near(pos(), POST_X, 1.4)],
        ['Podejdź do zielonego słupka na osi y (y = 8)', () => near(pos(), POST_Y, 1.4)],
        [`Skocz (${K('Spacja')}) — to ruch wzdłuż osi z`, () => pos()[1] > EYE + 0.6],
      ],
    },
    {
      title: 'Czwarta oś: w',
      text: `Jest jeszcze czwarta oś: ${A('w')} (fioletowa). Jest prostopadła do x, y i z <i>naraz</i>, więc nie da się jej narysować w 3D.
        Ekran pokazuje zawsze trójwymiarowy <b>przekrój</b> świata przy twoim w — tak jak kartka przecinająca bryłę pokazuje tylko płaski kształt.<br>
        Fioletowa kostka przy początku osi to miejsce, w którym oś w przebija twój przekrój. W gizmo oś w jest kółkiem ⊙ z napisem „100% poza” — leży cała poza tym, co widzisz.
        Kolor podłogi zależy od w: zobaczysz, że się przesuwasz.`,
      tasks: [
        [`Zrób krok w +W: przytrzymaj ${K('T')} albo przekręć kółko myszy w górę — aż do w = 4`, () => Math.abs(pos()[3] - 4) < 0.45],
      ],
    },
    {
      title: 'Przekroje: hiperkula i brama',
      text: `Przed tobą (y = 12) wisi <b>hiperkula</b> — kula 4D o środku przy w = 4. W przekroju widzisz zwykłą kulę: największą, gdy twoje w = 4,
        mniejszą, gdy oddalasz się w W, a dalej niż o 2,2 — znika. Zauważ, że strzałki osi x, y, z zniknęły: leżą przy w = 0, a ty jesteś w innym przekroju.<br>
        Za kulą stoi <b>brama</b>, która istnieje tylko dla w od 3 do 5.`,
      tasks: [
        [`Pochodź w W (${K('T')} / ${K('G')}, kółko) od w = 2 do w = 6 i patrz, jak kula rośnie i maleje`, w => w.seenW(2.2) && w.seenW(5.8)],
        ['Przejdź przez bramę (y = 16) przy w między 3 a 5', w => w.gatePassed],
        [`Wróć do w = 0 (${K('G')} albo kółko w dół)`, () => Math.abs(pos()[3]) < 0.35],
      ],
    },
    {
      title: 'Obrót w W: Q / E',
      text: `Do tej pory przesuwałeś się w W, ale patrzyłeś zawsze tak samo. ${K('Q')} / ${K('E')} obracają widok w płaszczyźnie <b>przód–W</b>:
        kierunek „przód” przechyla się w stronę osi w, a przekrój, który widzisz, obraca się razem z nim.<br>
        Złota latarnia stoi w tym samym miejscu podłogi co ty, ale przy w = 9 — teraz jej nie widzisz. W gizmo patrz, jak oś y znika z widoku („% poza”), a oś w się pojawia.`,
      start: w => w.goto(LESSON_ROT, 0),
      tasks: [
        [`Przytrzymaj ${K('E')}, aż latarnia stanie dokładnie przed tobą (przód = oś w)`, () => P().forward[3] > 0.96],
        [`Podejdź do niej (${K('W')}) — idziesz teraz wzdłuż osi w!`, () => Math.hypot(pos()[0] - BEACON[0], pos()[2] - BEACON[2], pos()[3] - BEACON[3]) < 2.6],
        [`Naciśnij <b>dwa razy szybko</b> ${K('Q')} — obrót wyrówna się do osi (do 0° albo 180°)`, () => Math.abs(P().forward[3]) < 0.02],
      ],
    },
    {
      title: 'Obrót w W: Z / C',
      text: `Drugi obrót, ${K('Z')} / ${K('C')}, przechyla kierunek <b>„w prawo”</b> w stronę osi w. To, co leży w W, widzisz wtedy z boku.
        Latarnia znów jest przy w = 9, w tym samym miejscu podłogi.<br>${K('X')} zawsze kasuje wszystkie obroty w W naraz.`,
      start: w => w.goto(LESSON_ROT, 0),
      tasks: [
        [`Przytrzymaj ${K('C')}, aż latarnia będzie dokładnie z boku (prawo = oś w)`, () => Math.abs(P().right[3]) > 0.96],
        [`Wyrównaj obrót: <b>dwa razy szybko</b> ${K('Z')} albo ${K('C')}`, () => Math.abs(P().right[3]) < 0.02],
      ],
    },
    {
      title: 'Kamery: (x y z)',
      text: `Masz cztery kierunki: w prawo (${A('x')}), do przodu (${A('y')}), w górę (${A('z')}) i ana (${A('w')}). Obraz powstaje z <b>trzech</b> z nich —
        to jest <b>kamera</b>. Zwykła kamera (x y z) ukrywa w.<br>
        Przed tobą stoi szereg kolorowych słupów ułożonych <b>wzdłuż W</b> (co 2, od w = −6 do 14) — w tym samym miejscu podłogi. Ta kamera widzi tylko jeden: ten przy twoim w.
        Klawisz ${K('Y')} przełącza kamery.`,
      start: w => { w.goto(CAM0, 0); w.view = 0; w.split = false; },
      tasks: [[`Naciśnij ${K('Y')} — następna kamera`, w => w.view === 1]],
    },
    {
      title: 'Kamera (w y z)',
      text: `Teraz poziomo na ekranie zamiast „w prawo” leży <b>oś W</b>. Wyobraź sobie, że odwracasz głowę nie w bok, tylko „w czwarty wymiar”:
        to, co leży przy większym w, jest po prawej, przy mniejszym — po lewej. Dlatego <b>cały szereg słupów</b> stoi przed tobą obok siebie!<br>
        W gizmo oś x jest teraz ⊙ (cała poza widokiem), a w wskazuje w prawo. ${K('A')} / ${K('D')} wciąż idą w bok po podłodze — tego ruchu ta kamera nie pokazuje.`,
      start: w => { w.goto(CAM0, 0); w.view = 1; w.split = false; },
      tasks: [
        [`Zrób krok w +W (${K('T')}): obraz przesuwa się w lewo, jak przy kroku w prawo w zwykłej kamerze`, w => pos()[3] > 1.6],
        [`Naciśnij ${K('Y')} — następna kamera`, w => w.view === 2],
      ],
    },
    {
      title: 'Kamera (x w z)',
      text: `Teraz w głąb ekranu zamiast „do przodu” biegnie <b>oś W</b> — patrzysz wzdłuż czwartego wymiaru. Słupy stojące tuż obok ciebie
        przy w = 2, 4, 6… widzisz jako <b>aleję uciekającą w dal</b>. Krok w +W (${K('T')}, kółko) to w tej kamerze krok do przodu.<br>
        ${K('W')} / ${K('S')} dalej idą przed siebie po podłodze — ten kierunek jest teraz prostopadły do obrazu.`,
      start: w => { w.goto(CAM0, 0); w.view = 2; w.split = false; },
      tasks: [
        [`Podejdź w W do trzeciego słupa alei (w = 6)`, () => pos()[3] > 5.3],
        [`Naciśnij ${K('Y')} — następna kamera`, w => w.view === 3],
      ],
    },
    {
      title: 'Kamera (x y w)',
      text: `Teraz pionowo na ekranie zamiast wysokości jest <b>oś W</b>. To przekrój świata na wysokości twoich oczu: podłogi nie widać
        (leży pod tobą, w osi z, której ta kamera nie pokazuje). Szereg słupów wygląda jak <b>wieża</b>: wyżej na ekranie = większe w.<br>
        Krok w W przesuwa cały obraz w górę lub w dół.`,
      start: w => { w.goto(CAM0, 0); w.view = 3; w.split = false; },
      tasks: [
        [`Pochodź w W (${K('T')} / ${K('G')}) i patrz, jak wieża jedzie`, w => w.wTravel > 4],
        [`Naciśnij ${K('Y')} — wróć do zwykłej kamery (x y z)`, w => w.view === 0],
      ],
    },
    {
      title: 'Cztery kamery naraz: F',
      text: `${K('F')} dzieli ekran na cztery kamery: (x y z) zwykła, (w y z), (x w z) i (x y w). Wszystkie pokazują <b>tę samą chwilę</b>,
        każda z innej trójki kierunków. Pochodź, poobracaj się w W i patrz, co się dzieje w każdej.`,
      start: w => { w.goto(CAM0, 0); w.view = 0; },
      tasks: [
        [`Włącz cztery kamery: ${K('F')}`, w => w.split],
        [`Obróć się w W (${K('E')}) o co najmniej 30°`, () => Math.abs(P().forward[3]) > 0.5],
        [`Wyrównaj: <b>dwa razy szybko</b> ${K('Q')}`, () => Math.abs(P().forward[3]) < 0.02],
        [`Wyłącz: ${K('F')}`, w => !w.split],
      ],
    },
    {
      title: 'Sprawdzian',
      text: `Złota hiperkula siedzi w klatce bez drzwi. Ściany klatki mają jednak grubość tylko w osi W: od w = −1 do 1.
        Dostań się do kuli — użyj tego, czego się nauczyłeś.`,
      start: w => { w.goto(FINAL, Math.PI / 4); w.view = 0; w.split = false; },
      tasks: [['Dotknij złotej hiperkuli', () => near(pos(), GOAL, 1.3, 0.9)]],
      end: 'Brawo! Umiesz się poruszać w czterech wymiarach. Enter — <b>poziomy ćwiczeń</b> (coraz trudniejsze), potem mapy <b>Labirynt 4D</b> i <b>Wyspy 4D</b>.',
    },
  ];

  // labels pinned to things in the world: [point, text, colour, lesson numbers (empty = always)]
  const LABELS = [
    [[6.7, 0.5, 0, 0], '+x', '#ff8a8a', []], [[0, 0.5, 6.7, 0], '+y', '#7ef0a0', []], [[0, 3.6, 0, 0], '+z', '#8cc0ff', []],
    [POST_X.map((v, i) => (i === 1 ? 2.4 : v)), 'słupek x = 8', '#ff8a8a', [0]], [POST_Y.map((v, i) => (i === 1 ? 2.4 : v)), 'słupek y = 8', '#7ef0a0', [0]],
    [[SPHERE[0], 4.2, SPHERE[2], SPHERE[3]], 'hiperkula (środek: w = 4)', '#fff', [1, 2], 2.4],
    [[GATE[0], 4.0, GATE[2], GATE[3]], 'brama: istnieje tylko dla w 3 … 5', '#ffd27a', [2], 1.1],
    [[BEACON[0], 3.8, BEACON[2], BEACON[3]], 'latarnia (w = 9)', '#ffd27a', [3, 4]],
    [[GOAL[0], 3.6, GOAL[2], GOAL[3]], 'cel', '#ffd27a', [10]],
  ];

  // progress (kept in this browser): lessons done, best times of the levels
  const PROG = { lessons: {}, levels: {} };
  try { Object.assign(PROG, JSON.parse(localStorage.getItem('wymiary.tutorial') || '{}')); } catch (e) { /* no storage */ }
  const saveProg = () => { try { localStorage.setItem('wymiary.tutorial', JSON.stringify(PROG)); } catch (e) { /* no storage */ } };
  const levelCompass = new WCompass4D([]);
  levelCompass.range = 16;

  const world = {
    name: 'Samouczek 4D',
    id: 'samouczek',
    subtitle: 'Nauka poruszania się w czterech wymiarach: 11 lekcji (osie x, y, z i w, przekroje, krok w W, obroty w W i wyrównywanie, każda z czterech kamer osobno — co pokazuje i jak ją sobie wyobrazić) i 10 coraz trudniejszych poziomów ćwiczeń z orientacji i ruchu w 4D. Lekcję lub poziom wybierasz poniżej.',
    tags: ['4D', 'samouczek', 'zacznij tutaj'],
    help: ['Enter — dalej (gdy zaliczone)', 'Backspace — wstecz', 'L albo Esc — wybór lekcji i poziomów', ...W4D.HELP],
    shader: () => WG.nd(code, '#define FOG_DENS .008\n'),
    bullets: new WBullets(WBallistics.flat(4, { speed: 55, gravity: 1.2, life: 4 }), { hitTest: q => WMP.hitPeers(q) }),
    aim() { return this.player.aim(); },
    reverb: 0.05,
    soundArrivals(src) { return W4D.soundArrivals(this, src); },
    mode: 'lesson', lesson: 0, level: 0, step: 0,
    enter() {
      if (!this.player) {
        this.player = new WPlayer(4, { spawn: [-3, EYE, -5, 0], respawnY: -1e9 });
        window.addEventListener('keydown', e => {
          if (WE.world !== world || !WE.locked || e.repeat) return;
          if (e.code === 'KeyL') { WE.unlock(); setTimeout(() => world.openLevels(), 60); }   // the window: choose a lesson or a level
          if (e.code === 'Enter' && world.finished()) world.next(1);
          if (e.code === 'Backspace') world.next(-1);
        });
      }
      this.start(this.mode, this.mode === 'level' ? this.level : this.lesson);
    },
    goto(p, yaw) { this.player.reset(p, yaw); this.snap = null; this.anaQueue = 0; },
    // choose a lesson or a level (from the menu before entering: applied on enter)
    start(mode, i) {
      this.mode = mode;
      if (mode === 'level') this.level = WM.clamp(i, 0, LEVELS.length - 1); else this.lesson = WM.clamp(i, 0, L.length - 1);
      if (!this.player) return;
      this.step = 0; this.doneT = -1; this.minW = 1e9; this.maxW = -1e9; this.wTravel = 0; this.gatePassed = false;
      if (mode === 'level') {
        const lv = LEVELS[this.level];
        this.got = lv.crystals.map(() => false); this.t0 = WE.time; this.view = 0; this.split = false;
        this.goto(lv.start, 0);
        levelCompass.marks = [];
        levelCompass.reset();
      } else {
        const les = L[this.lesson];
        if (les.start) les.start(this); else if (this.lesson === 0) this.goto([-3, EYE, -5, 0], 0);
      }
      this.lastW = this.player.pos[3]; this.lastZ = this.player.pos[2];
    },
    setLesson(i) { this.start('lesson', i); },
    finished() { return this.mode === 'level' ? this.doneT >= 0 : this.step >= L[this.lesson].tasks.length; },
    // Enter / Backspace: next or previous (after the last lesson come the levels)
    next(d) {
      if (this.mode === 'lesson') {
        const i = this.lesson + d;
        if (i >= L.length) this.start('level', 0); else this.start('lesson', Math.max(0, i));
      } else {
        const i = this.level + d;
        if (i < 0) this.start('lesson', L.length - 1); else this.start('level', Math.min(LEVELS.length - 1, i));
      }
    },
    seenW(w) { return w < 3 ? this.minW <= w : this.maxW >= w; },
    update(dt, look) {
      W4D.update(this, dt, look);
      if (this.mode === 'level') return this.updateLevel();
      const p = this.player.pos;
      if (p[1] < -10) { WE.toast('Spadłeś z podłogi — ona istnieje tylko dla w od −8 do 16', 2500); this.start('lesson', this.lesson); return; }
      this.minW = Math.min(this.minW, p[3]); this.maxW = Math.max(this.maxW, p[3]);
      this.wTravel += Math.abs(p[3] - this.lastW);
      if (this.lastZ < GATE[2] && p[2] >= GATE[2] && Math.abs(p[0]) < 1.4 && Math.abs(p[3] - GATE[3]) < 1) this.gatePassed = true;
      this.lastW = p[3]; this.lastZ = p[2];
      const les = L[this.lesson];
      while (this.step < les.tasks.length && les.tasks[this.step][1](this)) {
        this.step++;
        WAudio.click(1.4);
        if (this.step === les.tasks.length) {
          this.doneT = WE.time; PROG.lessons[this.lesson] = true; saveProg();
          WE.toast(les.end ? 'Brawo! Teraz poziomy ćwiczeń — Enter' : 'Lekcja zaliczona — Enter: dalej', 2500);
        }
      }
      // auto-advance a few seconds after the last task (not after the final test)
      if (this.doneT >= 0 && !les.end && WE.time - this.doneT > 4) this.next(1);
    },
    updateLevel() {
      const lv = LEVELS[this.level], p = this.player.pos, body = [p[0], p[1] - 0.6, p[2], p[3]];
      if (p[1] < -8) { WE.toast('Spadłeś — od startu poziomu (zebrane kryształy zostają)', 2000); this.goto(lv.start, 0); return; }
      if (this.doneT >= 0) return;
      lv.crystals.forEach((c, i) => {
        if (!this.got[i] && WM.len(WM.sub(body, c)) < 1.15) { this.got[i] = true; WAudio.click(1.8); }
      });
      const t = WE.time - this.t0;
      if (this.got.every(Boolean)) {
        this.doneT = WE.time;
        const best = PROG.levels[this.level];
        PROG.levels[this.level] = best ? Math.min(best, t) : t; saveProg();
        WE.toast(`Poziom ukończony w ${t.toFixed(1)} s${!best || t < best ? ' — rekord!' : ''} · Enter: następny`, 4000);
      } else if (lv.time && t > lv.time) {
        WE.toast('Koniec czasu — jeszcze raz!', 2500);
        this.start('level', this.level);
      }
    },
    // the golden arrow in the gizmo: towards the nearest crystal not collected yet
    gizmoTarget() {
      if (this.mode !== 'level' || !LEVELS[this.level].hint || this.doneT >= 0) return null;
      const lv = LEVELS[this.level], e = this.player.camera().pos;
      let best = null, bd = Infinity;
      lv.crystals.forEach((c, i) => { if (!this.got[i]) { const d = WM.len(WM.sub(c, e)); if (d < bd) { bd = d; best = c; } } });
      return best ? { p: best, label: 'kryształ' } : null;
    },
    tutorialHtml() {
      const keys = `<div class="keys">${K('Enter')} dalej · ${K('Backspace')} wstecz · ${K('L')} / ${K('Esc')} wybór lekcji i poziomów</div>`;
      if (this.mode === 'level') {
        const lv = LEVELS[this.level], n = this.got.filter(Boolean).length, t = (this.doneT >= 0 ? this.doneT : WE.time) - this.t0;
        const best = PROG.levels[this.level];
        return `<div class="step">Poziom ${this.level + 1} / ${LEVELS.length}</div><h2>${lv.title}</h2><p>${lv.text}</p>` +
          `<div class="task${this.doneT >= 0 ? ' done' : ''}">${this.doneT >= 0 ? '✓' : '▶'} Kryształy: ${n} / ${lv.crystals.length} · ⏱ ${t.toFixed(1)} s${lv.time ? ` z ${lv.time}` : ''}${best ? ` · rekord ${best.toFixed(1)} s` : ''}</div>` +
          (this.doneT >= 0 ? `<p><b>Ukończony!</b> ${this.level + 1 < LEVELS.length ? 'Enter — następny poziom.' : 'To był ostatni poziom — brawo!'}</p>` : '') + keys;
      }
      const les = L[this.lesson];
      const tasks = les.tasks.map(([t], i) => `<div class="task${i < this.step ? ' done' : ''}">${i < this.step ? '✓' : i === this.step ? '▶' : '○'} ${t}</div>`).join('');
      const end = this.step >= les.tasks.length ? (les.end ? `<p><b>${les.end}</b></p>` : '<p><b>Zaliczone!</b> Za chwilę następna lekcja (albo Enter).</p>') : '';
      return `<div class="step">Lekcja ${this.lesson + 1} / ${L.length}</div><h2>${les.title}</h2><p>${les.text}</p>${tasks}${end}` + keys;
    },
    // the menu panel: every lesson and level, with progress; a click starts it
    menuPanel(box, play) {
      this._play = play;
      const open = document.createElement('button');
      open.className = 'modeBtn lay'; open.textContent = '📋 Okno wyboru lekcji i poziomów (L)';
      open.addEventListener('click', () => this.openLevels());
      box.appendChild(open);
      box.appendChild(this.levelGrid(play));
    },
    // the big window with every lesson and level (key L in the game, or the button in the menu)
    openLevels() {
      let win = document.getElementById('lvwin');
      if (!win) { win = document.createElement('div'); win.id = 'lvwin'; win.className = 'modal'; document.body.appendChild(win); }
      win.innerHTML = '<div class="ed wide"><h3>Samouczek 4D — lekcje i poziomy</h3><p>Lekcje uczą po kolei, poziomy ćwiczą orientację i ruch w 4D — każdy następny trudniejszy. ✓ = zaliczone; przy poziomach rekordowy czas.</p></div>';
      const ed = win.querySelector('.ed');
      ed.appendChild(this.levelGrid(() => { win.style.display = 'none'; if (this._play) this._play(); }));
      const btns = document.createElement('div'); btns.className = 'btns';
      btns.innerHTML = '<button>Zamknij</button>';
      btns.querySelector('button').addEventListener('click', () => { win.style.display = 'none'; });
      ed.appendChild(btns);
      win.onclick = e => { if (e.target === win) win.style.display = 'none'; };
      win.style.display = 'flex';
    },
    levelGrid(play) {
      const grid = document.createElement('div');
      grid.className = 'lvgrid';
      const add = (mode, i, title, sub, done) => {
        const b = document.createElement('button');
        b.className = 'lv' + (done ? ' done' : '') + (this.mode === mode && (mode === 'level' ? this.level : this.lesson) === i ? ' cur' : '');
        b.innerHTML = `<b></b><small></small>`;
        b.querySelector('b').textContent = `${done ? '✓ ' : ''}${mode === 'level' ? 'Poziom' : 'Lekcja'} ${i + 1}`;
        b.querySelector('small').textContent = title + (sub ? ` · ${sub}` : '');
        b.addEventListener('click', () => { this.start(mode, i); play(); });
        grid.appendChild(b);
      };
      grid.innerHTML = '<h4>Lekcje — nauka</h4>';
      L.forEach((les, i) => add('lesson', i, les.title, '', PROG.lessons[i]));
      const h = document.createElement('h4'); h.textContent = 'Poziomy — ćwiczenia (coraz trudniejsze)'; grid.appendChild(h);
      LEVELS.forEach((lv, i) => add('level', i, lv.title, PROG.levels[i] ? `rekord ${PROG.levels[i].toFixed(1)} s` : '', PROG.levels[i]));
      return grid;
    },
    playerPoints() { return W4D.playerPoints(this); },
    damage(n, from) { W4D.damage(this, n, from); },
    setUniforms(gl, prog) {
      this.player.setUniformsND(gl, prog);
      avatars.setUniforms(gl, prog);
      const lvl = this.mode === 'level';
      gl.uniform1i(prog.u('uLvl'), lvl ? 1 : 0);
      if (!lvl) return;
      const lv = LEVELS[this.level], bc = new Float32Array(NB * 4), bh = new Float32Array(NB * 4), bk = new Float32Array(NB), cr = new Float32Array(NC * 4);
      lv.boxes.slice(0, NB).forEach((b, i) => { bc.set(b.slice(0, 4), i * 4); bh.set(b.slice(4, 8), i * 4); bk[i] = b[8]; });
      const left = lv.crystals.filter((c, i) => !this.got[i]).slice(0, NC);
      left.forEach((c, i) => cr.set(c, i * 4));
      gl.uniform4fv(prog.u('uBC'), bc); gl.uniform4fv(prog.u('uBH'), bh); gl.uniform1fv(prog.u('uBK'), bk);
      gl.uniform1i(prog.u('uBN'), Math.min(NB, lv.boxes.length));
      gl.uniform4fv(prog.u('uCr'), cr); gl.uniform1i(prog.u('uCrN'), left.length);
    },
    setBulletUniforms(gl, p) { WBullets.uploadSigned(gl, p, [[this.bullets, false], ...WMP.extraBullets(this)]); },
    drawViews(gl, prog, cw, ch) { return W4D.drawViews(this, gl, prog, cw, ch); },
    // the 4D compass only in levels that allow it: the crystals left, in the space (x, y, w)
    drawOverlay(ctx, W, H, dt) {
      if (this.mode !== 'level' || !LEVELS[this.level].compass) return false;
      levelCompass.marks = LEVELS[this.level].crystals.map((c, i) => this.got[i] ? null : { label: '', color: '#7ff', at: [c[0], c[2], c[3]], r: 0.6, fill: true }).filter(Boolean);
      levelCompass.draw(ctx, W, H, dt, this.player);
    },
    // labels: projected into the normal camera (perspective) when the thing lies in your slice (lessons only)
    drawLayer(ctx, W, H) {
      if (this.mode !== 'lesson' || this.split || WE.projMode !== 0) return;
      const [r, u, f, hdn] = W4D.basis(this, this.view), eye = this.player.camera().pos, t = Math.tan(WE.fov / 2);
      ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
      for (const [pt, text, col, only, wTol] of LABELS) {
        if (only.length && !only.includes(this.lesson)) continue;
        const d = WM.sub(pt, eye), a = WM.dot(d, r), b = WM.dot(d, u), c = WM.dot(d, f), h = WM.dot(d, hdn);
        if (c < 0.5 || Math.abs(h) > (wTol || 0.5)) continue;
        const x = W / 2 + a / c / (2 * t) * H, y = H / 2 - b / c / (2 * t) * H;
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        const tw = ctx.measureText(text).width;
        ctx.fillRect(x - tw / 2 - 6, y - 15, tw + 12, 21);
        ctx.fillStyle = col; ctx.fillText(text, x, y);
      }
    },
    stats() { return W4D.stats(this); },
    _test: { L, LABELS, LEVELS, PROG },
  };
  // other players (multiplayer): drawn by the monster renderer, no monsters here
  const avatars = new WSwarm({}, WSwarm.spaces.flat4(), { shotModel: WBallistics.flat(4, {}) });
  world.compass = levelCompass;
  W4D.setup(world);
  world.mp = W4D.mp(world, avatars.sp, () => world.start(world.mode, world.mode === 'level' ? world.level : world.lesson));
  avatars.w = world;
  WE.register(world);
})();
