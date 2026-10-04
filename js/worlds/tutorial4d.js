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

  const v4 = a => `vec4(${a.map(x => (+x).toFixed(2)).join(',')})`;
  const code = `
${WSwarm.glslMat(false, 1, true)}
const vec4 SPH = ${v4(SPHERE)}, GATEC = ${v4(GATE)}, BEAC = ${v4(BEACON)}, GOALP = ${v4(GOAL)};
const vec4 ROW1[${ROW1.length}] = vec4[](${ROW1.map(v4).join(',')});
const vec4 ROW2[${ROW2.length}] = vec4[](${ROW2.map(v4).join(',')});
vec2 map(vec4 p){
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
      end: 'Brawo! Umiesz się poruszać w czterech wymiarach. Spróbuj map <b>Labirynt 4D</b> i <b>Wyspy 4D</b>.',
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

  const world = {
    name: 'Samouczek 4D',
    id: 'samouczek',
    subtitle: 'Nauka poruszania się w czterech wymiarach krok po kroku: osie x, y, z i w, przekroje, krok w W, obroty w W i wyrównywanie, a potem każda z czterech kamer osobno — co pokazuje i jak ją sobie wyobrazić. Na końcu sprawdzian.',
    tags: ['4D', 'samouczek', 'zacznij tutaj'],
    help: ['Enter — następna lekcja (gdy zadania zrobione)', 'Backspace — poprzednia lekcja', ...W4D.HELP],
    shader: () => WG.nd(code, '#define FOG_DENS .008\n'),
    bullets: new WBullets(WBallistics.flat(4, { speed: 55, gravity: 1.2, life: 4 }), { hitTest: q => WMP.hitPeers(q) }),
    aim() { return this.player.aim(); },
    reverb: 0.05,
    soundArrivals(src) { return W4D.soundArrivals(this, src); },
    lesson: 0, step: 0,
    settings: [{ label: 'Lekcja', min: 1, max: L.length, step: 1, reset: 1, get: () => world.lesson + 1, set: v => world.setLesson(Math.round(v) - 1), text: () => `${world.lesson + 1}. ${L[world.lesson].title}` }],
    enter() {
      if (!this.player) {
        this.player = new WPlayer(4, { spawn: [-3, EYE, -5, 0], respawnY: -14 });
        window.addEventListener('keydown', e => {
          if (WE.world !== world || !WE.locked || e.repeat) return;
          if (e.code === 'Enter' && (world.step >= L[world.lesson].tasks.length)) world.setLesson(world.lesson + 1);
          if (e.code === 'Backspace') world.setLesson(world.lesson - 1);
        });
      }
      this.setLesson(this.lesson || 0);
    },
    goto(p, yaw) { this.player.reset(p, yaw); this.snap = null; this.anaQueue = 0; },
    setLesson(i) {
      this.lesson = WM.clamp(i, 0, L.length - 1);
      if (!this.player) return;                 // chosen in the menu before the map was entered: applied on enter
      this.step = 0; this.doneT = -1; this.minW = 1e9; this.maxW = -1e9; this.wTravel = 0; this.gatePassed = false;
      if (L[this.lesson].start) L[this.lesson].start(this);
      else if (this.lesson === 0) this.goto([-3, EYE, -5, 0], 0);
      this.lastW = this.player.pos[3]; this.lastZ = this.player.pos[2];
    },
    seenW(w) { return w < 3 ? this.minW <= w : this.maxW >= w; },
    update(dt, look) {
      W4D.update(this, dt, look);
      const p = this.player.pos;
      if (p[1] < -10) { WE.toast('Spadłeś z podłogi — ona istnieje tylko dla w od −8 do 16', 2500); }
      this.minW = Math.min(this.minW, p[3]); this.maxW = Math.max(this.maxW, p[3]);
      this.wTravel += Math.abs(p[3] - this.lastW);
      if (this.lastZ < GATE[2] && p[2] >= GATE[2] && Math.abs(p[0]) < 1.4 && Math.abs(p[3] - GATE[3]) < 1) this.gatePassed = true;
      this.lastW = p[3]; this.lastZ = p[2];
      const les = L[this.lesson];
      while (this.step < les.tasks.length && les.tasks[this.step][1](this)) {
        this.step++;
        WAudio.click(1.4);
        if (this.step === les.tasks.length) { this.doneT = WE.time; WE.toast(les.end ? 'Brawo!' : 'Lekcja zaliczona — Enter: dalej', 2500); }
      }
      // auto-advance a few seconds after the last task (not after the final test)
      if (this.doneT >= 0 && !les.end && WE.time - this.doneT > 4) this.setLesson(this.lesson + 1);
    },
    tutorialHtml() {
      const les = L[this.lesson];
      const tasks = les.tasks.map(([t], i) => `<div class="task${i < this.step ? ' done' : ''}">${i < this.step ? '✓' : i === this.step ? '▶' : '○'} ${t}</div>`).join('');
      const end = this.step >= les.tasks.length ? (les.end ? `<p><b>${les.end}</b></p>` : '<p><b>Zaliczone!</b> Za chwilę następna lekcja (albo Enter).</p>') : '';
      return `<div class="step">Lekcja ${this.lesson + 1} / ${L.length}</div><h2>${les.title}</h2><p>${les.text}</p>${tasks}${end}` +
        `<div class="keys">${K('Enter')} dalej · ${K('Backspace')} poprzednia lekcja · lekcję wybierzesz też w menu (Esc)</div>`;
    },
    playerPoints() { return W4D.playerPoints(this); },
    damage(n, from) { W4D.damage(this, n, from); },
    setUniforms(gl, prog) { this.player.setUniformsND(gl, prog); avatars.setUniforms(gl, prog); },
    setBulletUniforms(gl, p) { WBullets.uploadSigned(gl, p, [[this.bullets, false], ...WMP.extraBullets(this)]); },
    drawViews(gl, prog, cw, ch) { return W4D.drawViews(this, gl, prog, cw, ch); },
    // labels: projected into the normal camera (perspective) when the thing lies in your slice
    drawLayer(ctx, W, H) {
      if (this.split || WE.projMode !== 0) return;
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
    _test: { L, LABELS },
  };
  // other players (multiplayer): drawn by the monster renderer, no monsters here
  const avatars = new WSwarm({}, WSwarm.spaces.flat4(), { shotModel: WBallistics.flat(4, {}) });
  W4D.setup(world);
  world.mp = W4D.mp(world, avatars.sp, () => { const st = L[world.lesson].start; if (st) st(world); else world.goto([-3, EYE, -5, 0], 0); });
  avatars.w = world;
  WE.register(world);
})();
