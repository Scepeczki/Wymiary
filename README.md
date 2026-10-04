# Wymiary

Baza pod FPS-a w nieeuklidesowych i wielowymiarowych przestrzeniach. Czysty WebGL2 + raymarching (bez bibliotek, bez builda).

## Uruchamianie

- Ikona **Wymiary** na pulpicie (albo `Wymiary.lnk` w tym folderze) — otwiera grę w Brave w trybie aplikacji.
- Skrót odtworzysz poleceniem: `powershell -ExecutionPolicy Bypass -File tools\install-shortcut.ps1`
  (szuka Brave → Chrome → Edge; bez nich otwiera `index.html` w domyślnej przeglądarce).
- Ikonę generuje `tools\make-icon.ps1`.

## Sterowanie

| | |
|---|---|
| WASD / mysz / Spacja / Shift | ruch, rozglądanie, skok, bieg |
| LPM (przytrzymaj = seria) | strzał z pistoletu |
| Esc / M | menu wyboru map (świat renderuje się obok, na dole suwaki mapy) · **1–7** szybki wybór |
| Arena pętli: R | przeładowanie (magazynek 12 naboi) |
| P | tryb projekcji: perspektywa, rybie oko 360°, panorama, perspektywa odwrócona, ortogonalna |
| kółko myszy | FOV · **[ ]** rozdzielczość renderu · **N** noclip · **V** dźwięk wł./wył. |
| 4D: R/F, Q/E, Z/C, X, G | krok w W, obrót przód↔W, obrót prawo↔W, reset obrotu, kompas 4D: widok stały / za tobą |
| Korytarze K: Q/E, X | K całej mapy, płasko (to samo suwakiem w menu); tryb z potworami wybierasz na karcie mapy |
| Wolne światło: Q/E, L, F, B/J/K | prędkość światła, wszystkie lampy, lampa na celowniku, aberracja / Doppler / opóźnienie światła |

## Światy

1. **Korytarze K** — patrz niżej.
2. **Tesserakt 4D** — prawdziwe 4D (x,y,z,w); widzisz przekrój 3D. Start w klatce, z której wychodzi się przez W.
   W rogu **kompas 4D**: pion (y) nigdy się nie obraca, więc cały ruch i obroty dzieją się w 3-wymiarowej przestrzeni
   (x, z, w) — kompas rysuje ją jako model 3D (podłoga mapki = x/z, pion mapki = W): Ty ze śladem, płaszczyzna
   przekroju, który widzisz, kierunek przodu, ukryty kierunek ana (R) i punkty orientacyjne (`js/compass4d.js`).
3. **Przestrzeń hiperboliczna** — H³ (model hiperboloidy), plaster {4,3,5}: pięć sześcianów wokół każdej krawędzi.
4. **Przestrzeń sferyczna** — S³, skończony świat z 8 sześcianów tesseraktu; obiekt na antypodzie wypełnia niebo.
5. **Pętla (3-torus)** — pokój sklejony sam ze sobą; widzisz nieskończenie wiele swoich kopii.
6. **Wolne światło** — szczególna teoria względności z regulowanym c (patrz niżej).
7. **Arena pętli** — długa mapa dwóch baz, prawie wszędzie zapętlona; bot albo gra sieciowa (patrz niżej).

## Korytarze K

Budynek w przestrzeni o metryce konforemnie płaskiej g = e^{2φ}·δ, φ = φ_globalne + φ_bańki:
- **K całej mapy** (suwak): φ = −ln(1 + K r²/4) wokół środka mapy — cała mapa leży w przestrzeni o stałej krzywiźnie K
  (mapa stereograficzna S³ dla K>0, kula Poincarégo H³ dla K<0). Zakres ujemny jest mniejszy (−0,006), bo budynek musi
  zmieścić się w kuli Poincarégo; przy skrajnym ustawieniu najdalsze narożniki łagodnie się wypłaszczają.
- **Potwory** (tryb „Z potworami”): 6 blokowych zombie chodzi po budynku (graf pokoi i korytarzy), trzyma dystans i strzela.
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

Tryby (karta mapy w menu): zwiedzanie, bot łatwy/trudny, **gra sieciowa**. Bot ma 100 HP, ten sam pistolet (20 obrażeń),
magazynek 12, przeładowanie 1,7 s; chodzi po grafie ~200 węzłów (także przez wszystkie pętle), strzela seriami z wyprzedzeniem,
chowa się, przeładowuje, wychyla. Geometria i portale są w teksturze danych (szybki shader). Test bez GPU: `node tools/dev/duel.js`.

## Gra sieciowa (np. z bratem)

1. Na swoim komputerze uruchom skrót **„Wymiary – gra sieciowa”** (`launcher\host.cmd`). Otworzy się okno serwera z adresami
   i gra w trybie sieciowym.
2. Brat klika **„Wymiary – dołącz do gry”** i wpisuje adres z okna serwera (np. `192.168.1.55:8080`, a przez Tailscale
   adres `100.x.x.x:8080`). Bez instalacji wystarczy przeglądarka: `http://192.168.1.55:8080/?w=7&mode=3`.
3. Pierwszy gracz dostaje drużynę A (baza południowa), drugi B. Wynik i życie przeciwnika są na górze ekranu.
4. Jeśli Windows zapyta o zaporę — zezwól na sieci prywatne. Przez Internet (inna sieć) potrzebne jest przekierowanie portu
   8080 na routerze albo VPN typu ZeroTier / Tailscale / Radmin VPN.

Działanie: każdy liczy swój ruch u siebie i wysyła stan 20×/s; trafienia ocenia strzelający, ofiara odejmuje życie
(`js/net.js`, `server/server.js` — czysty Node, bez pakietów). Test dwóch klientów na jednym PC: `node tools/dev/mptest.js <katalog>`.

## Instalator i aktualizacje (dla drugiego komputera)

Zbuduj instalatory: `powershell -ExecutionPolicy Bypass -File tools\build-installer.ps1` → katalog `dist\`:
- **`Wymiary-gra.exe`** (~33 MB) — pełna instalacja: gra + Node.js (żeby drugi gracz też mógł hostować). Instaluje bez
  uprawnień administratora do `%LOCALAPPDATA%\Programs\Wymiary`, tworzy skróty (pulpit + menu Start) i wpis w
  „Aplikacje i funkcje” (odinstalowanie).
- **`Wymiary-nowa-wersja.exe`** (~0,3 MB) — same pliki gry; uruchomiony na zainstalowanej grze aktualizuje ją.

Skróty po instalacji: *Wymiary* (gra offline), *Wymiary – dołącz do gry*, *Wymiary – gra sieciowa (serwer)*.

**Aktualizacje same się rozchodzą:** „Dołącz do gry” pyta o adres serwera (zapamiętuje go), porównuje sumy SHA-256 plików
z serwerem i pobiera tylko zmienione. Wystarczy, że zmienisz grę u siebie i uruchomisz serwer — brat przy następnym
dołączeniu dostaje tę samą wersję. Wersję serwer liczy sam (data + skrót zawartości) i pokazuje w swoim oknie.
`Wymiary-nowa-wersja.exe` przydaje się tylko, gdy brat ma grać bez łączenia się z Tobą.

Windows SmartScreen może ostrzec przed nieznanym plikiem .exe: „Więcej informacji” → „Uruchom mimo to”.

## Strzelanie

Pocisk to świecący punkt lecący po geodezyjnych danej przestrzeni plus uproszczona grawitacja: w H³/S³ dokładny przepływ geodezyjny na hiperboloidzie/sferze, w 4D lot w czterech wymiarach, w torusie zawijanie (pocisk wraca i może trafić strzelca), w Korytarzach K równanie geodezyjnych metryki konforemnej. Trafienia wykrywają te same sondy SDF na GPU co kolizje gracza (`js/weapons.js`).

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
