# Wymiary

Strzelanka FPS w nieeuklidesowych przestrzeniach: 4D, przestrzeń hiperboliczna i sferyczna, zapętlone pokoje,
zmienna krzywizna, wolne światło. Gra sieciowa dla dwóch graczy.

## Instalacja (Windows)

1. Pobierz instalator: **[Wymiary-instalator.exe](https://github.com/Scepeczki/Wymiary/releases/latest/download/Wymiary-instalator.exe)**
   (albo ze strony [Releases](https://github.com/Scepeczki/Wymiary/releases/latest) → *Assets*).
2. Uruchom go. Jeśli Windows ostrzeże („system Windows ochronił komputer”), kliknij *Więcej informacji* → *Uruchom mimo to*.
3. Instalator pobierze najnowszą wersję gry z GitHuba, a na pulpicie pojawią się skróty.

Potrzebna jest przeglądarka Chrome, Brave albo Edge. Uprawnienia administratora nie są potrzebne.

**Aktualizacje:** gra sama sprawdza, czy na GitHubie jest nowsze wydanie. Przy starcie skrótu *Wymiary* pyta, czy je
pobrać, a w trakcie gry pokazuje w menu ramkę **Nowa wersja… → Aktualizuj teraz** (gra zamknie się, zaktualizuje
i uruchomi ponownie). W menu Start jest też *Wymiary – sprawdź aktualizacje*. *Wymiary – dołącz do gry* dodatkowo
wyrównuje wersję z serwerem, do którego się łączysz.

**Gra we dwóch — na każdej mapie i w każdym trybie:** jeden gracz uruchamia *Wymiary – gra sieciowa (serwer)* (za pierwszym
razem gra sama pobierze przenośny Node.js), drugi *Wymiary – dołącz do gry* i wpisuje adres pokazany w oknie serwera.
W menu widać, na której mapie gra drugi gracz (przycisk **Dołącz**). Z innego domu: oba komputery w tej samej sieci
[Tailscale](https://tailscale.com) → adres `100.x.x.x:8080`.

## Wydawanie aktualizacji (dla autora)

Wystarczy zatwierdzić zmiany i wypchnąć je na gałąź **main** — w GitHub Desktop: *Commit to main* → *Push origin*.
GitHub Actions (`.github/workflows/release.yml`) samo zbuduje i opublikuje nowe wydanie **v1.0.N** z plikami
`Wymiary.zip` (pobierają go instalator i aktualizator) i `Wymiary-instalator.exe`; opis wydania to lista commitów.
Postęp widać w zakładce **Actions** repozytorium, gotowe wydania w **Releases**.

- Wydanie powstaje tylko wtedy, gdy zmieniły się pliki gry (nie np. samo README). Push bez wydania: dopisz `[skip ci]` do opisu commita.
- Nowa seria numerów: zmień plik `VERSION` (np. `1.0` → `1.1`).
- Wydanie ręcznie: *Actions → Release → Run workflow*. Lokalny test budowania:
  `powershell -ExecutionPolicy Bypass -File tools\build-release.ps1 -Version 1.0.99` → folder `dist\`.

---

## Uruchamianie (komputer autora)

- Ikona **Wymiary** na pulpicie (albo `Wymiary.lnk` w tym folderze) — otwiera grę w Brave w trybie aplikacji.
- Skrót odtworzysz poleceniem: `powershell -ExecutionPolicy Bypass -File tools\install-shortcut.ps1`
  (szuka Brave → Chrome → Edge; bez nich otwiera `index.html` w domyślnej przeglądarce).
- Ikonę generuje `tools\make-icon.ps1`.

## Sterowanie

| | |
|---|---|
| WASD / mysz / Spacja / Shift | ruch, rozglądanie, skok, bieg |
| LPM (przytrzymaj = seria) | strzał z pistoletu (magazynek 12 naboi, licznik w lewym dolnym rogu) |
| R | przeładowanie (animacja: broń unosi się, stary magazynek wypada, nowy wchodzi; pusty magazynek przeładowuje sam) |
| Esc / M | menu wyboru map (świat renderuje się obok, na dole suwaki mapy) · **1–9** szybki wybór |
| P | tryb projekcji: perspektywa, rybie oko 360°, panorama, perspektywa odwrócona, ortogonalna |
| kółko myszy | **lot** w górę / w dół: unosisz się w powietrzu, dopóki znów nie staniesz na podłodze; **na mapach 4D: krok w osi W** |
| Ctrl + kółko | FOV · **[ ]** rozdzielczość renderu · **N** noclip · **V** dźwięk wł./wył. |
| 4D: T/G, kółko | krok w osi W (ana / kata) |
| 4D: Q/E, Z/C | obrót przód↔W, obrót prawo↔W · **dwa szybkie naciśnięcia** tego samego klawisza wyrównują ten obrót do osi (do 0° albo 180°, bliżej którego jesteś) |
| 4D: Y | następna **kamera**: (x y z) → (w y z) → (x w z) → (x y w) — każda to przekrój przez inną trójkę twoich kierunków |
| 4D: X, B | reset obrotu 4D · kompas 4D: obraca się z tobą / stały / ukryty |
| 4D: F | (układ ustawisz w menu: **⚙ Układ widoków 4D** — dla każdej ćwiartki kamera albo pusta, gizmo wł./wył.; zapamiętywane) **cztery widoki** naraz — przekroje przez różne trójki twoich osi (x = w prawo, y = do przodu, z = w górę, w = ana): (x y z) zwykły, (w y z) zamiast „w prawo” oś W, (x w z) patrzysz wzdłuż W, (x y w) zamiast wysokości oś W (poziomy przekrój 3D na wysokości oczu) |
| Korytarze K: Q/E, X | K całej mapy, płasko (to samo suwakiem w menu); tryb z potworami wybierasz na karcie mapy |
| Wolne światło: Q/E, L, F, B/J/K | prędkość światła, wszystkie lampy, lampa na celowniku, aberracja / Doppler / opóźnienie światła |

## Światy

1. **Korytarze K** — patrz niżej.
2. **Samouczek 4D** — **zacznij tutaj**: 11 lekcji z wyjaśnieniami i zadaniami sprawdzanymi automatycznie. Osie x, y, z
   (strzałki w świecie i gizmo osi) → czwarta oś w i czym jest przekrój → hiperkula i brama, która istnieje tylko dla części w →
   obroty w W (Q / E, Z / C) i wyrównywanie dwukrotnym naciśnięciem → każda kamera osobno: co pokazuje i jak ją sobie
   wyobrazić (szereg słupów ułożonych wzdłuż W widać w (w y z) obok siebie, w (x w z) jako aleję w głąb, w (x y w) jako
   wieżę) → cztery kamery naraz → sprawdzian (klatka ze ścianami grubymi tylko w W). Enter — dalej, Backspace — wstecz,
   a po lekcjach **10 poziomów ćwiczeń** z orientacji i ruchu w 4D, coraz trudniejszych: zbieranie kryształów
   na podłodze, w jednym miejscu przy różnych w, rozrzuconych w (x, y, w), w klatkach o grubości w W, most wzdłuż W, ukośny
   most (trzeba obrócić się o 45° w W), ścieżka skręcająca w osiach y, w, x, schody przez W, kryształy bez podpowiedzi
   (tylko kompas 4D) i na czas. Złota strzałka w gizmo wskazuje najbliższy kryształ (z „% poza” widokiem).
   **Okno wyboru** lekcji i poziomów: klawisz **L** w grze albo przycisk w menu; ✓ i rekordowe czasy zapamiętuje przeglądarka.
   Testy: `node tools/dev/tutorial.js` (wszystkie lekcje) i `node tools/dev/levels.js` (każdy poziom przechodni).
3. **Tesserakt 4D** — prawdziwe 4D (x,y,z,w); widzisz przekrój 3D. Start w klatce, z której wychodzi się przez W.
   W rogu **kompas 4D**: pion (y) nigdy się nie obraca, więc cały ruch i obroty dzieją się w 3-wymiarowej przestrzeni
   (x, z, w) — kompas rysuje ją jako model 3D (podłoga mapki = x/z, pion mapki = W): Ty ze śladem, płaszczyzna
   przekroju, który widzisz, kierunek przodu, ukryty kierunek ana (T) i punkty orientacyjne (`js/compass4d.js`).
4. **Labirynt 4D** — 4 × 4 × 3 komory rozłożone po podłodze (x, y) i po osi w. Podłoga jest tylko w labiryncie, a w części
   komór ma dziurę tylko w połowie zakresu W (w tym samym miejscu przy jednym w grunt, przy innym przepaść). Drzwi w ścianach
   są otwarte tylko w środku zakresu W komory; część przejść prowadzi przez W (fioletowy / błękitny kwadrat na podłodze).
   Cel: złota hiperkula, czas i rekord. Labirynt jest losowany ze stałym ziarnem (ten sam u wszystkich graczy).
5. **Wyspy 4D** — platformy nad przepaścią; każda to prostopadłościan 4D istniejący tylko w swoim zakresie w. Trasa łączy
   skoki nad przerwami na podłodze z krokami przez W na platformę „obok” w czwartym wymiarze. Kompas pokazuje wszystkie
   platformy w (x, y, w). Spadniesz — wracasz na ostatnią wyspę. Test przejezdności trasy: `node tools/dev/islands.js`.

6. **Przestrzeń hiperboliczna** — H³ (model hiperboloidy), plaster {4,3,5}: pięć sześcianów wokół każdej krawędzi.
7. **Przestrzeń sferyczna** — S³, skończony świat z 8 sześcianów tesseraktu; obiekt na antypodzie wypełnia niebo.
8. **Pętla (3-torus)** — pokój sklejony sam ze sobą; widzisz nieskończenie wiele swoich kopii.
9. **Wolne światło** — szczególna teoria względności z regulowanym c (patrz niżej).
10. **Arena pętli** — długa mapa dwóch baz, prawie wszędzie zapętlona; bot albo gra sieciowa (patrz niżej).

W grze mapy 1–9 wybierasz cyframi, a mapę 10 (Arena pętli) klawiszem **0**.

**Osie w 4D** (wszystkie mapy 4D, HUD i kompas): x i y to podłoga, z to wysokość, w to czwarta oś. W lewym dolnym rogu
stale widać **gizmo osi**: dokąd wskazują osie świata względem kamery, przez którą patrzysz, i jaka ich część leży poza
twoim przekrojem (fioletowe kółko z procentami; oś zupełnie poza przekrojem to ⊙). (W kodzie silnika oś
pionowa nazywa się y — `js/nd4.js` przelicza nazwy.) Wspólne sterowanie map 4D jest w `js/nd4.js`.

**Na każdej mapie da się grać.** Menu (Esc) pokazuje karty map z podglądem. Po wybraniu mapy po prawej widać opis,
**tryb gry**, suwaki mapy i jej klawisze; przycisk **GRAJ** albo Enter uruchamia grę. Strzałki i 1–9 wybierają mapę,
dwuklik na karcie od razu ją uruchamia.

- Korytarze K i Wolne światło: tryb *Z potworami*. Arena pętli: bot albo gra sieciowa.
- Tesserakt, H³, S³ i Pętla: tryb **Walka: fale potworów** (`js/enemies.js`). Te same blokowe zombie chodzą
  i strzelają w geometrii danej mapy. Fala N ma N+1 potworów (najwyżej 8), a kolejne fale są szybsze i celniejsze.
  - W 3-torusie widać nieskończenie wiele kopii każdego potwora.
  - W 4D potwory podchodzą przez oś W; na kompasie są czerwonymi kropkami z kreską do Twojego poziomu W.
  - W H³ i S³ ich pociski lecą po geodezyjnych; w S³ chybiony pocisk okrąża świat.
  - Śmierć zaczyna grę od fali 1; rekord fali widać u góry ekranu.
  - Każdy potwór ma lokalny układ współrzędnych przy stopach. SI, trafienia i rysowanie liczą się w metrach przez
    dokładną mapę logarytmiczną danej przestrzeni; przeszkody i linia wzroku idą przez sondy GPU.
- Podglądy map to `assets/maps/<n>.jpg` (zrzuty z `tools/dev/shotserver.js`). Test fal: `node tools/dev/swarm.js`.

## Korytarze K

Budynek 5 × 5 pokoi połączonych korytarzami, w przestrzeni o metryce konforemnie płaskiej g = e^{2φ}·δ,
φ = φ_globalne + φ_pokoje + φ_bańki:
- **Własne K pokoi i korytarzy**: prawie każdy pokój (K od −0,05 do +0,06) i korytarz (od −0,25 do +0,35) jest bańką stałej
  krzywizny, która wygasa przy drzwiach (tabele `ROOM_K`, `COR_X`, `COR_Z` w `js/worlds/building.js`). Kolor ścian
  pokazuje krzywiznę: pomarańczowy K>0 (sfera — soczewka, rzeczy rosną), niebieski K<0 (hiperbola — rzeczy maleją).
  Pokój startowy jest płaski. Korytarze z dużym K działają jak szklane kule.
- **K całej mapy** (suwak): φ = −ln(1 + K r²/4) wokół środka mapy — cała mapa leży w przestrzeni o stałej krzywiźnie K
  (mapa stereograficzna S³ dla K>0, kula Poincarégo H³ dla K<0). Zakres ujemny jest mniejszy (−0,0015), bo cały budynek
  (promień ~52 m) musi zmieścić się w kuli Poincarégo.
- **Potwory** (tryb „Z potworami”): 8 blokowych zombie chodzi po budynku (graf pokoi i korytarzy), trzyma dystans i strzela.
  Każdy nosi bańkę zakrzywionej przestrzeni — pomarańczowe K = +0,9 (soczewka), niebieskie K = −0,6 — a ich wolne fioletowe
  pociski to latające soczewki. Wszystko to wchodzi do metryki: zakrzywia obraz, Twoje pociski i dźwięk. 3 trafienia zabijają.
- Promienie całkowane są krokiem adaptacyjnym (skręt ≤ 0,08 rad na krok); HUD pokazuje lokalne K liczone z krzywizny skalarnej
  (w powłoce przejściowej bańki K ma przeciwny znak — to poprawny wynik matematyczny).

## Wolne światło

Hala z lampami, blokami co 10 m, zegarem na końcu i karuzelą. Suwak zmienia prędkość światła c od 2 do 400 m/s; chodzisz
normalnie (5 m/s, bieg 9,5), więc przy małym c poruszasz się z prędkością przyświetlną. Efekty własnego ruchu
(aberracja, Doppler) są domyślnie wyłączone — włączasz je w menu albo klawiszami B / J:
- **aberracja** — kierunek każdego promienia przekształcany wzorem relatywistycznym: w biegu widok ściska się do przodu,
- **Doppler + jasność** — kolor zamieniany na szerokie widmo, przesuwany o czynnik D = γ(1+β cos θ), jasność ~D³:
  przód niebieski i jasny, tył czerwony i ciemny, przy β → 1 „tęcza gwiazd”,
- **opóźnienie światła** — każdy punkt promienia widziany jest w chwili, gdy wyszło z niego światło: przełączone lampy
  wysyłają widoczny front światła/ciemności, zegar pokazuje czas sprzed d/c, szybka karuzela wygląda na wygiętą.
- **lustra** — dwie lustrzane ściany naprzeciw siebie; odbicie pokazuje Ciebie (awatar) sprzed 2d/c, każde kolejne
  odbicie w tunelu jeszcze dawniej (pozycje gracza i potworów zapisywane są w teksturze historii ~7,5 s),
- **tryb z potworami** — zombie widać tam, gdzie były, gdy wyszło od nich światło; pociski trafiają tam, gdzie są.
- **pociski** poruszają się normalnie, ale ich światło też potrzebuje czasu: widzisz je (i rozbłysk trafienia) z opóźnieniem d/c;
  przy c mniejszym niż prędkość pocisku (32 m/s) obraz pocisku wyprzedza światło i robi się rozmyty — tak wyglądają obiekty szybsze od światła.
HUD pokazuje β, γ, czynniki Dopplera, Twój czas własny i opóźnienie odbicia.

## Arena pętli

Długa mapa (~170 m) z dwiema bazami: **A** (Twoja, niebieska, południe) i **B** (czerwona, północ — lustrzana).
Prawie każde miejsce ma zapętlony fragment (portal bez szwów — działa na obraz, graczy, bota i pociski):
- **bazy i węzły** przed środkiem — sale-torusy: boczne ściany sklejone, ciągną się w bok bez końca,
- **lewa ścieżka — schody Penrose'a**: dwa biegi w górę, a wychodzisz na tym samym poziomie (sklejenie z przesunięciem 2,5 m w pionie),
- **środkowa — budka większa w środku**: drzwi prowadzą do wielkiej hali (też torus), tylne drzwi hali wychodzą 5 m dalej za budką,
- **prawa — sala ze studnią i wąskim mostkiem**: spadniesz — wypadasz z sufitu,
- **środek mapy**: korytarz z trzema sklejonymi bocznymi przejściami, hala bez podłogi z kamieniami i półkami (dno sklejone
  z sufitem), plac-torus.

Tryby (karta mapy w menu): zwiedzanie, bot łatwy/trudny, **gra sieciowa** (drużyny A/B, bazy po dwóch stronach).
Bot ma 100 HP, ten sam pistolet (20 obrażeń), magazynek 12, przeładowanie 1,7 s; chodzi po grafie ~200 węzłów (także przez wszystkie pętle), strzela seriami z wyprzedzeniem,
chowa się, przeładowuje, wychyla. Geometria i portale są w teksturze danych (szybki shader). Test bez GPU: `node tools/dev/duel.js`.

## Gra sieciowa (np. z bratem) — każda mapa, każdy tryb

1. Na swoim komputerze uruchom skrót **„Wymiary – gra sieciowa (serwer)”** (`launcher\host.cmd`). Otworzy się okno serwera
   z adresami i gra (menu map).
2. Brat klika **„Wymiary – dołącz do gry”** i wpisuje adres z okna serwera (np. `192.168.1.55:8080`, a przez Tailscale
   adres `100.x.x.x:8080`). Bez instalacji wystarczy przeglądarka: `http://192.168.1.55:8080/`.
3. Obaj wybieracie w menu **tę samą mapę i ten sam tryb** — karta mapy pokazuje, kto na niej gra, a w panelu mapy jest
   przycisk **Dołącz** (wybiera mapę i tryb drugiego gracza). Gra otwarta z serwera sama podpowiada mapę, na której ktoś już gra.
4. Jeśli Windows zapyta o zaporę — zezwól na sieci prywatne.

Co znaczy wspólna gra w danym trybie:
- **Bez potworów / bota** (zwiedzanie, spokój, gra sieciowa na arenie) — **pojedynek**: widzicie się (w 4D jako przekroje
  4-wymiarowej postaci, w H³/S³ wzdłuż geodezyjnych, w 3-torusie w nieskończenie wielu kopiach, w Wolnym świetle z opóźnieniem
  światła), strzelacie do siebie (25 obrażeń), po śmierci odrodzenie po 3 s, na górze wynik.
- **Z potworami / z botem** — **kooperacja**: potwory (bota) prowadzi gracz o najniższym numerze („lider”), wysyła ich stan
  12×/s, a pozostali widzą je płynnie i ich trafienia trafiają do lidera. Potwory celują w najbliższego żywego gracza,
  przy dwóch graczach fale są większe. Po śmierci odradzasz się po 3 s, gra toczy się dalej.

Jak to działa (`js/mp.js`, `js/net.js`, `server/server.js` — czysty Node, bez pakietów): pokój = mapa + tryb. Każdy liczy
swój ruch u siebie i wysyła stan 20×/s (geometria zakodowana przez adapter przestrzeni z `js/enemies.js`: stopy + kierunek
w 3D, cała rama w 4D i w H³/S³). H³ ciągle przecentrowuje świat na gracza, więc pozycje idą we wspólnych współrzędnych
(złożenie wszystkich przecentrowań). Trafienia w graczy ocenia strzelający, ofiara odejmuje życie.
Testy: `node tools/dev/mpsim.js` (dwóch klientów w jednym procesie, wszystkie mapy i tryby) i
`node tools/dev/mptest.js <katalog> [mapa] [tryb] …` (serwer + dwa okna przeglądarki, zrzuty ekranu).

**Aktualizacje przez serwer:** „Dołącz do gry” porównuje sumy SHA-256 plików z serwerem i pobiera tylko zmienione, więc brat
gra zawsze tą samą wersją co serwer. Niezależnie od tego zainstalowana gra sama pobiera nowe wydania z GitHuba (patrz wyżej).

## Strzelanie

Pocisk to świecący punkt lecący szybko (ok. 50–60 m/s, zasięg ponad 200 m) po geodezyjnych danej przestrzeni plus słaba
grawitacja (opada łagodnie): w H³/S³ dokładny przepływ geodezyjny na hiperboloidzie/sferze, w 4D lot w czterech wymiarach, w torusie zawijanie (pocisk wraca i może trafić strzelca), w Korytarzach K równanie geodezyjnych metryki konforemnej. Trafienia wykrywają te same sondy SDF na GPU co kolizje gracza (`js/weapons.js`).

## Dźwięk

Strzał i trafienia są syntetyzowane (Web Audio, bez plików) i rozchodzą się zgodnie z geometrią świata. Świat zamienia
zdarzenie na listę *dojść* (opóźnienie, głośność, kierunek, stłumienie powietrzem):
- **S³** — dźwięk obiega wszechświat (~84 m) i wraca skupiony: własny strzał powtarza się echem co ~0,24 s; odległe
  trafienie słychać krótką drogą i długą — z przeciwnej strony; amplituda 1/|sin r| (ogniskowanie na antypodzie).
- **H³** — amplituda 1/sinh r: dalekie trafienia gasną wykładniczo.
- **4D** — amplituda 1/r^1,5, a w parzystej liczbie wymiarów nie działa zasada Huygensa: za czołem fali ciągnie się
  ogon ~ (t²−r²)^(−3/2), huk rozmywa się w „szum"; dźwięk z kierunku W jest stłumiony.
- **Pętla** — źródła-obrazy na sieci torusa: słyszysz strzały wszystkich swoich kopii (gęste echo).
- **Korytarze K** — śledzenie ~200 promieni dźwięku po geodezyjnych metryki: skupianie przez soczewki (głośniej),
  wielokrotne drogi, przy K>0 obieganie wszechświata. Liczone porcjami między klatkami; ściany są pomijane.
- `node tools/dev/sound.js` wypisuje dojścia dla każdego świata.

## Ładowanie

Shadery ray-marchingu kompilują się w sterowniku ~0,5–1,5 s. Wszystkie mapy przygotowują się w tle zaraz po starcie
(gdy widać menu, `KHR_parallel_shader_compile`); jeśli wejdziesz wcześniej, zamiast czarnego ekranu jest napis „Kompilowanie…”.

## Architektura

- `js/glsl.js` — trzy „jądra” geometrii: `euclid` (3D, opcjonalnie z metryką konforemną), `nd` (4D), `curved` (K=±1), plus pistolet i pociski. Świat dostarcza tylko `map()` i `material()`.
- `js/audio.js` — synteza dźwięku, odtwarzanie dojść, propagacja w S³/H³/4D.
- `js/monsters.js` — potwory: AI, strzały, bańki krzywizny.
- `js/weapons.js` — pistolet, modele balistyczne (płaski, zakrzywiony, konforemny), trafienia.
- `js/physics.js` — gracz N-wymiarowy (kolizje sferami względem SDF) i gracz w przestrzeni zakrzywionej.
- `js/menu.js` — menu wyboru map i panel suwaków (`settings` świata).
- `js/engine.js` — WebGL, wejście, pętla; kolizje liczone **na GPU**: ten sam `map()` ewaluowany w punktach-sondach (`WE.probe`).
- `js/worlds/*.js` — jeden plik = jeden świat (`WE.register({...})`). Nowy świat: skopiuj istniejący, dodaj `<script>` w `index.html`.

## Narzędzia deweloperskie (`tools/dev`)

- `node tools/dev/smoke.js` — logika wszystkich światów bez GPU (NaN-y, metryka).
- `node tools/dev/check.js <glslang.exe>` — kompilacja wszystkich shaderów walidatorem Khronosa.
- `node tools/dev/shotserver.js <katalog> bld:w=1&s0=0.5 hyper:w=3&proj=1` — zrzuty ekranu z prawdziwego GPU (okno poza ekranem).
- Parametry URL: `?w=N` (świat), `proj=M`, `defs=A,B` (dodatkowe `#define` do shaderów); dla zrzutów: `turn`, `pitch`, `walk=1`, `fire=N`, `frames=N`, `s0=…` `s1=…` (suwaki mapy).
