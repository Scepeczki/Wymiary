// Controls: every game action can be bound to keyboard keys, mouse buttons / the wheel and SpaceMouse buttons, and
// each of the six SpaceMouse axes to an analog control (target, invert, sensitivity). The window is opened from the
// menu (⌨ Sterowanie); everything is kept in this browser (localStorage 'wymiary.input').
// The game itself still reads the key codes it always used (WE.keys.KeyW, e.code === 'KeyQ' …): these are the
// "virtual" codes of the actions. In game a real key (or button) is translated into synthetic key events of the
// actions bound to it, so all the maps' own key handlers keep working unchanged.
// Analog values (WE.analog) are added to WE.axis(): moveX → A/D, moveY → W/S, moveZ → Space/Ctrl (and flying),
// ana → T/G, rotFW → Q/E, rotRW → Z/C; yaw / pitch turn the view like the mouse does.
(function () {
  const I = { uiOpen: false };
  // [virtual code, label, group, default inputs] — inputs: e.code of a key, Mouse0/1/2, WheelUp/WheelDown, SM<n> (SpaceMouse button n)
  const ACTIONS = [
    ['KeyW', 'Naprzód', 'Ruch', ['KeyW']],
    ['KeyS', 'Do tyłu', 'Ruch', ['KeyS']],
    ['KeyA', 'W lewo', 'Ruch', ['KeyA']],
    ['KeyD', 'W prawo', 'Ruch', ['KeyD']],
    ['Space', 'Skok (noclip: w górę)', 'Ruch', ['Space', 'SM2']],
    ['ControlLeft', 'Noclip: w dół', 'Ruch', ['ControlLeft']],
    ['ShiftLeft', 'Bieg', 'Ruch', ['ShiftLeft', 'ShiftRight']],
    ['FlyUp', 'Lot w górę (4D: krok w W, ana)', 'Ruch', ['WheelUp']],
    ['FlyDown', 'Lot w dół (4D: krok w W, kata)', 'Ruch', ['WheelDown']],
    ['Fire', 'Strzał (przytrzymaj = seria)', 'Gra', ['Mouse0', 'SM1']],
    ['KeyR', 'Przeładowanie', 'Gra', ['KeyR', 'SM3']],
    ['KeyM', 'Menu', 'Gra', ['KeyM', 'Tab', 'KeyH']],
    ['KeyP', 'Tryb projekcji', 'Gra', ['KeyP']],
    ['BracketLeft', 'Rozdzielczość −', 'Gra', ['BracketLeft']],
    ['BracketRight', 'Rozdzielczość +', 'Gra', ['BracketRight']],
    ['FovUp', 'Pole widzenia (FOV) +', 'Gra', []],
    ['FovDown', 'Pole widzenia (FOV) −', 'Gra', []],
    ['KeyN', 'Noclip wł./wył.', 'Gra', ['KeyN']],
    ['KeyV', 'Dźwięk wł./wył.', 'Gra', ['KeyV']],
    ['KeyT', 'Ruch wzdłuż w + (ana)', 'Mapy 4D', ['KeyT']],
    ['KeyG', 'Ruch wzdłuż w − (kata)', 'Mapy 4D', ['KeyG']],
    ['KeyQ', 'Obrót w płaszczyźnie y–w − · Korytarze: K − · Światło: c −', 'Mapy 4D', ['KeyQ']],
    ['KeyE', 'Obrót w płaszczyźnie y–w + · Korytarze: K + · Światło: c +', 'Mapy 4D', ['KeyE']],
    ['KeyZ', 'Obrót w płaszczyźnie x–w −', 'Mapy 4D', ['KeyZ']],
    ['KeyC', 'Obrót w płaszczyźnie x–w +', 'Mapy 4D', ['KeyC']],
    ['KeyX', 'Reset obrotu 4D · Korytarze: K = 0', 'Mapy 4D', ['KeyX', 'SM6']],
    ['KeyY', 'Następna kamera', 'Mapy 4D', ['KeyY', 'SM4']],
    ['KeyF', 'Cztery widoki · Światło: lampa na celowniku', 'Mapy 4D', ['KeyF', 'SM5']],
    ['KeyB', 'Kompas 4D · Światło: aberracja', 'Mapy 4D', ['KeyB']],
    ['KeyL', 'Światło: wszystkie lampy · Samouczek: wybór lekcji', 'Inne mapy', ['KeyL']],
    ['KeyJ', 'Światło: Doppler', 'Inne mapy', ['KeyJ']],
    ['KeyK', 'Światło: opóźnienie światła', 'Inne mapy', ['KeyK']],
    ['Enter', 'Samouczek: dalej', 'Inne mapy', ['Enter', 'NumpadEnter']],
    ['Backspace', 'Samouczek: wstecz', 'Inne mapy', ['Backspace']],
  ];
  for (let n = 1; n <= 10; n++) ACTIONS.push(['Digit' + (n % 10), 'Mapa ' + n, 'Wybór mapy', ['Digit' + (n % 10)]]);
  const IS_ACTION = Object.fromEntries(ACTIONS.map(a => [a[0], true]));

  // SpaceMouse axes (the device's own: X across, Y towards / away from you, Z up and down the cap) and what they can
  // control — the player's axes as everywhere in the game: x = across (right), y = forward, z = up, w = ana (4D)
  const AXES = [['TX', 'przesuw wzdłuż X'], ['TY', 'przesuw wzdłuż Y'], ['TZ', 'przesuw wzdłuż Z'],
    ['RX', 'obrót wokół X'], ['RY', 'obrót wokół Y'], ['RZ', 'obrót wokół Z']];
  const TARGETS = [['none', '— nic —'], ['moveX', 'Ruch wzdłuż x'], ['moveY', 'Ruch wzdłuż y'], ['moveZ', 'Ruch wzdłuż z (lot)'],
    ['ana', 'Ruch wzdłuż w (4D)'], ['yaw', 'Obrót x–y (wokół z)'], ['pitch', 'Obrót y–z (wokół x, patrzenie)'],
    ['rotFW', 'Obrót y–w (4D)'], ['rotRW', 'Obrót x–w (4D)']];
  const TCOL = { moveX: 'x', moveY: 'y', moveZ: 'z', ana: 'w', yaw: 'z', pitch: 'x', rotFW: 'w', rotRW: 'w' };
  const LOOK_RATE = { yaw: 2.4, pitch: 1.7 };      // rad/s at a full push

  const defaults = () => ({
    bind: Object.fromEntries(ACTIONS.map(a => [a[0], a[3].slice()])),
    axes: [{ t: 'moveX', inv: false, sens: 1 }, { t: 'moveY', inv: true, sens: 1 }, { t: 'moveZ', inv: true, sens: 1 },
      { t: 'pitch', inv: false, sens: 1 }, { t: 'ana', inv: false, sens: 1 }, { t: 'yaw', inv: false, sens: 1 }],
    sm: true, sens: 1, dead: 0.08, curve: 1.5, lcd: true, lcdInvert: false,
  });
  let cfg = defaults();
  try {
    const s = JSON.parse(localStorage.getItem('wymiary.input') || '{}');
    if (s.bind) Object.assign(cfg.bind, s.bind);
    if (Array.isArray(s.axes)) s.axes.slice(0, 6).forEach((a, i) => Object.assign(cfg.axes[i], a));
    for (const k of ['sm', 'sens', 'dead', 'curve', 'lcd', 'lcdInvert']) if (k in s) cfg[k] = s[k];
  } catch (e) { /* no storage */ }
  const save = () => { try { localStorage.setItem('wymiary.input', JSON.stringify(cfg)); } catch (e) { /* no storage */ } };
  I.cfg = () => cfg;
  I.rebuild = () => rebuild();

  // ---------------- translation: real input → actions ----------------
  let map = {};                                   // input → [virtual codes]
  const held = {};                                // virtual code → Set of inputs holding it
  function rebuild() {
    map = {};
    for (const [v] of ACTIONS) for (const p of cfg.bind[v] || []) (map[p] = map[p] || []).push(v);
    WSpace.lcdSetInvert(cfg.lcdInvert);
  }
  const synth = (type, code, repeat) => { const e = new KeyboardEvent(type, { code, key: code, repeat, bubbles: true, cancelable: true }); e._wym = true; return e; };
  const fov = k => { WE.fov = WM.clamp(WE.fov * k, 0.3, 2.9); WE.toast('FOV ' + Math.round(WE.fov * 180 / Math.PI) + '°', 700); };
  function down(v, inp, repeat) {
    const h = held[v] || (held[v] = new Set()), first = !h.size;
    h.add(inp);
    if (v === 'Fire') { WE.keys.Fire = true; return; }
    if (v === 'FlyUp' || v === 'FlyDown') { if (first && !repeat) { WE.flyImpulse += v === 'FlyUp' ? 1 : -1; flyHold = 0; } WE.keys[v] = true; return; }
    if (v === 'FovUp' || v === 'FovDown') { fov(v === 'FovUp' ? 1.08 : 1 / 1.08); return; }
    if (first || repeat) window.dispatchEvent(synth('keydown', v, !first));
  }
  function up(v, inp) {
    const h = held[v];
    if (!h || !h.delete(inp) || h.size) return;
    if (v === 'Fire' || v === 'FlyUp' || v === 'FlyDown') { WE.keys[v] = false; return; }
    if (v === 'FovUp' || v === 'FovDown') return;
    window.dispatchEvent(synth('keyup', v, false));
  }
  // returns true when the input belongs to the game (then the original event should go no further)
  I.press = (inp, repeat = false) => {
    if (!WE.locked) return false;
    const vs = map[inp];
    if (vs) vs.forEach(v => down(v, inp, repeat));
    return !!vs || !!IS_ACTION[inp];
  };
  I.release = inp => { (map[inp] || []).forEach(v => up(v, inp)); return !!map[inp] || !!IS_ACTION[inp]; };
  I.impulse = inp => { if (I.press(inp)) I.release(inp); };
  function releaseAll() { for (const v in held) held[v].clear(); WE.keys.Fire = WE.keys.FlyUp = WE.keys.FlyDown = false; }

  let capture = null;                              // the controls window waits for an input: (input) => void
  window.addEventListener('keydown', e => {
    if (e._wym) return;
    if (capture) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code === 'Escape') return endCapture();
      return capture(e.code);
    }
    if (I.uiOpen && e.code === 'Escape') { e.stopImmediatePropagation(); return I.close(); }
    if (I.uiOpen) { e.stopImmediatePropagation(); return; }    // the menu's keys (arrows, Enter) stay quiet under the window
    if (!WE.locked) return;
    if (I.press(e.code, e.repeat)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('keyup', e => {
    if (e._wym || capture) return;
    if (I.release(e.code)) e.stopImmediatePropagation();
  }, true);
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) releaseAll(); });

  // SpaceMouse buttons
  WSpace.onButton = (n, pressed) => {
    if (pressed) lastSmButton = n;
    if (capture && pressed && captureSm) return capture('SM' + n);
    if (!cfg.sm) return;
    if (pressed) I.press('SM' + n); else I.release('SM' + n);
  };
  let lastSmButton = 0;

  // ---------------- per frame: analog values ----------------
  WE.analog = { moveX: 0, moveY: 0, moveZ: 0, yaw: 0, pitch: 0, ana: 0, rotFW: 0, rotRW: 0 };
  let flyHold = 0, lcdT = 0;
  I.shape = function (x, sens) {             // dead zone, then the response curve; result about -1..1
    const a = Math.abs(x), d = cfg.dead;
    if (a <= d) return 0;
    return Math.sign(x) * Math.pow(Math.min(1.5, (a - d) / (1 - d)), cfg.curve) * sens * cfg.sens;
  };
  // the analog controls from the SpaceMouse axes, through the axis settings
  function analogInto(an) {
    for (const k in an) an[k] = 0;
    cfg.axes.forEach((a, i) => { if (a.t !== 'none') an[a.t] += I.shape(WSpace.axes[i], a.sens) * (a.inv ? -1 : 1); });
    for (const k in an) an[k] = WM.clamp(an[k], -1.5, 1.5);
  }
  I.poll = function (dt) {
    WSpace.poll();
    const an = WE.analog;
    if (cfg.sm && WE.locked && WSpace.active()) analogInto(an);
    else for (const k in an) an[k] = 0;
    // a held key for flying: one step at once, then a steady climb
    if (WE.keys.FlyUp || WE.keys.FlyDown) {
      flyHold += dt;
      if (flyHold > 0.3) WE.flyImpulse += ((WE.keys.FlyUp ? 1 : 0) - (WE.keys.FlyDown ? 1 : 0)) * dt * 5;
    } else flyHold = 0;
    // the SpaceMouse screen, a few times a second (only the changed parts are sent)
    lcdT += dt;
    if (lcdT > 0.25 && WSpace.hasLcd && cfg.lcd) { lcdT = 0; WSpace.lcdCompose(); WSpace.lcdFlush(); }
    if (I.uiOpen) refreshUi(dt);
  };
  // turning from the analog values (added to the mouse look)
  I.look = (look, dt) => { look.dx += WE.analog.yaw * LOOK_RATE.yaw * dt; look.dy -= WE.analog.pitch * LOOK_RATE.pitch * dt; };

  // ---------------- names ----------------
  const KEYNAMES = { Space: 'Spacja', ShiftLeft: 'L Shift', ShiftRight: 'P Shift', ControlLeft: 'L Ctrl', ControlRight: 'P Ctrl', AltLeft: 'L Alt', AltRight: 'P Alt',
    Enter: 'Enter', NumpadEnter: 'Num Enter', Backspace: '⌫ Backspace', Tab: 'Tab', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
    Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    CapsLock: 'Caps Lock', Mouse0: 'LPM', Mouse1: 'Środkowy przycisk myszy', Mouse2: 'PPM', Mouse3: 'Mysz 4', Mouse4: 'Mysz 5', WheelUp: 'Kółko ↑', WheelDown: 'Kółko ↓' };
  I.name = c => KEYNAMES[c] || (c.startsWith('SM') ? 'SM ' + c.slice(2) : c.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num '));

  // ---------------- the controls window ----------------
  const $ = id => document.getElementById(id);
  let captureSm = false, captureEl = null;
  function endCapture() {
    capture = null; captureSm = false;
    if (captureEl) captureEl.classList.remove('wait');
    captureEl = null;
    document.removeEventListener('mousedown', onCapMouse, true);
    document.removeEventListener('wheel', onCapWheel, true);
  }
  function onCapMouse(e) { if (!capture || captureSm) return; e.preventDefault(); e.stopPropagation(); capture('Mouse' + e.button); }
  function onCapWheel(e) { if (!capture || captureSm) return; e.preventDefault(); e.stopPropagation(); capture(e.deltaY < 0 ? 'WheelUp' : 'WheelDown'); }
  function startCapture(btn, v, sm) {
    endCapture();
    captureEl = btn; captureSm = sm; btn.classList.add('wait');
    capture = inp => {
      endCapture();
      const list = cfg.bind[v] || (cfg.bind[v] = []);
      if (!list.includes(inp)) list.push(inp);
      save(); rebuild(); buildBinds();
    };
    // the click that started the capture must not be taken as the input
    if (!sm) setTimeout(() => { if (capture) { document.addEventListener('mousedown', onCapMouse, true); document.addEventListener('wheel', onCapWheel, { capture: true, passive: false }); } }, 0);
  }

  function buildBinds() {
    const box = $('ctlBinds'), uses = {};
    for (const v in cfg.bind) for (const p of cfg.bind[v]) uses[p] = (uses[p] || 0) + 1;
    box.innerHTML = '';
    let group = '';
    for (const [v, label, g] of ACTIONS) {
      if (g !== group) { group = g; const h = document.createElement('h4'); h.textContent = g; box.appendChild(h); }
      const row = document.createElement('div');
      row.className = 'brow';
      row.innerHTML = '<span class="bl"></span><span class="bk"></span><span class="bs"></span>';
      row.querySelector('.bl').textContent = label;
      for (const sm of [false, true]) {
        const cell = row.querySelector(sm ? '.bs' : '.bk');
        for (const p of cfg.bind[v] || []) {
          if (p.startsWith('SM') !== sm) continue;
          const chip = document.createElement('button');
          chip.className = 'chip' + (uses[p] > 1 ? ' dup' : '');
          chip.textContent = I.name(p);
          chip.title = (uses[p] > 1 ? 'Przypisane też do innej akcji. ' : '') + 'Kliknij, żeby usunąć';
          chip.addEventListener('click', () => { cfg.bind[v] = cfg.bind[v].filter(x => x !== p); save(); rebuild(); buildBinds(); });
          cell.appendChild(chip);
        }
        const add = document.createElement('button');
        add.className = 'chip add';
        add.textContent = '+';
        add.title = sm ? 'Naciśnij przycisk na SpaceMouse (Esc — anuluj)' : 'Naciśnij klawisz, przycisk myszy albo kręć kółkiem (Esc — anuluj)';
        add.addEventListener('click', () => startCapture(add, v, sm));
        cell.appendChild(add);
      }
      box.appendChild(row);
    }
  }

  function buildAxes() {
    const box = $('ctlAxes');
    box.innerHTML = '';
    cfg.axes.forEach((a, i) => {
      const row = document.createElement('div');
      row.className = 'arow';
      row.innerHTML = `<span class="an"></span><span class="abar"><i></i></span><select></select><label><input type="checkbox"> odwróć</label><input type="range" min="0.2" max="3" step="0.05"><span class="av"></span>`;
      row.querySelector('.an').innerHTML = `<b>${AXES[i][0]}</b> ${AXES[i][1]}`;
      const sel = row.querySelector('select');
      for (const [t, l] of TARGETS) { const o = document.createElement('option'); o.value = t; o.textContent = l; sel.appendChild(o); }
      sel.value = a.t;
      sel.addEventListener('change', () => { a.t = sel.value; save(); });
      const inv = row.querySelector('input[type=checkbox]');
      inv.checked = a.inv;
      inv.addEventListener('change', () => { a.inv = inv.checked; save(); });
      const sens = row.querySelector('input[type=range]'), sv = row.querySelector('.av');
      sens.value = a.sens; sv.textContent = '×' + a.sens.toFixed(2);
      sens.addEventListener('input', () => { a.sens = +sens.value; sv.textContent = '×' + a.sens.toFixed(2); save(); });
      box.appendChild(row);
    });
    for (const [id, key, fmt] of [['ctlSens', 'sens', v => '×' + v.toFixed(2)], ['ctlDead', 'dead', v => Math.round(v * 100) + '%'], ['ctlCurve', 'curve', v => v.toFixed(1)]]) {
      const inp = $(id), out = $(id + 'V');
      inp.value = cfg[key]; out.textContent = fmt(cfg[key]);
      inp.oninput = () => { cfg[key] = +inp.value; out.textContent = fmt(cfg[key]); save(); };
    }
    for (const [id, key] of [['ctlSm', 'sm'], ['ctlLcd', 'lcd'], ['ctlLcdInv', 'lcdInvert']]) {
      const inp = $(id);
      inp.checked = cfg[key];
      inp.onchange = () => { cfg[key] = inp.checked; save(); rebuild(); };
    }
  }

  // ---- preview: a 4D compass of a test player that the SpaceMouse moves as it would in a 4D map ----
  // (the same rates as in the game: js/physics.js — moves along your frame, turns of the frame in its planes)
  const pv = { an: { moveX: 0, moveY: 0, moveZ: 0, yaw: 0, pitch: 0, ana: 0, rotFW: 0, rotRW: 0 }, compass: null };
  function pvReset() {
    pv.player = { pos: [0, 1.6, 0, 0], frame: [[1, 0, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], pitch: 0 };
    if (pv.compass) pv.compass.reset();
  }
  pvReset();
  function pvStep(dt) {
    const an = pv.an, p = pv.player, f = p.frame, sp = 4;
    if (cfg.sm && WSpace.active()) analogInto(an); else for (const k in an) an[k] = 0;
    WM.rotFrame(f, 1, 0, an.yaw * LOOK_RATE.yaw * dt);
    WM.rotFrame(f, 1, 2, WM.clamp(an.rotFW, -1, 1) * dt * 1.2);
    WM.rotFrame(f, 0, 2, WM.clamp(an.rotRW, -1, 1) * dt * 1.2);
    WM.orthonormalize(f, [0, 1, 2]);
    p.pitch = WM.clamp(p.pitch + an.pitch * LOOK_RATE.pitch * dt, -1.55, 1.55);
    let pos = WM.addScaled(p.pos, f[0], WM.clamp(an.moveX, -1, 1) * sp * dt);
    pos = WM.addScaled(pos, f[1], WM.clamp(an.moveY, -1, 1) * sp * dt);
    pos = WM.addScaled(pos, f[2], WM.clamp(an.ana, -1, 1) * sp * dt);
    pos[1] = WM.clamp(pos[1] + WM.clamp(an.moveZ, -1, 1) * sp * dt, 0, 8);
    p.pos = pos;
    if (Math.hypot(pos[0], pos[2], pos[3]) > 11) pvReset();
  }
  const AX = { x: '#ff6b6b', y: '#5ee08a', z: '#5aa9ff', w: '#d77bff' };
  function pvDraw(dt) {
    const cv = $('ctlCompass'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, CW = 340;   // the compass on the left
    if (!pv.compass) {
      pv.compass = new WCompass4D([{ label: '+x', color: AX.x, at: [6, 0, 0], r: 0.4, fill: true }, { label: '+y', color: AX.y, at: [0, 6, 0], r: 0.4, fill: true },
        { label: '+w', color: AX.w, at: [0, 0, 4], r: 0.4, fill: true }, { label: 'start', color: '#888', at: [0, 0, 0], r: 0.3 }]);
      pv.compass.range = 9;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(6,4,16,.6)'; ctx.fillRect(0, 0, W, H);
    pv.compass.draw(ctx, CW, H, dt, pv.player);
    // right of it: height (z) and looking up / down (y–z), then every control with its value
    const p = pv.player, x0 = CW + 14;
    ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.strokeRect(x0 + 0.5, 20.5, 10, H - 40);
    const hz = (p.pos[1] - 1.6) / 6.4;
    ctx.fillStyle = AX.z; ctx.fillRect(x0 + 1, 20 + (H - 40) * (1 - WM.clamp(0.2 + hz * 0.8, 0, 1)), 9, 3);
    ctx.fillText('z', x0 + 1, 14);
    const cx = x0 + 46, cy = H / 2;
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(cx, cy, 20, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.strokeStyle = AX.y; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 20 * Math.cos(p.pitch), cy - 20 * Math.sin(p.pitch)); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillText('y–z', cx - 6, cy + 36);
    let y = 16;
    const bx = x0 + 84, bw = W - bx - 8;
    for (const [t, label] of TARGETS.slice(1)) {
      const v = WM.clamp(pv.an[t], -1, 1);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(label, bx, y);
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(bx, y + 4, bw, 5);
      ctx.fillStyle = AX[TCOL[t]]; ctx.fillRect(bx + bw / 2 + Math.min(0, v) * bw / 2, y + 4, Math.abs(v) * bw / 2, 5);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(bx + bw / 2, y + 2, 1, 9);
      y += 26;
    }
  }

  let statKey = '';
  function refreshUi(dt = 0) {
    if (dt) { pvStep(dt); pvDraw(dt); }
    const S = WSpace;
    const st = !S.supported && !S.active() ? 'Ta przeglądarka nie ma WebHID — SpaceMouse działa tylko jako gamepad (bez ekranu).'
      : S.active() ? `✓ Wykryty: ${S.name}` + (S.source === 'gamepad' ? ' — przez Gamepad API (bez ekranu)' : S.hasLcd ? ' — z ekranem LCD' : '')
      : 'Nie wykryto SpaceMouse. Podłącz go i kliknij „Połącz SpaceMouse” (przeglądarka zapyta o zgodę tylko raz).';
    const key = st + S.error + (S.lcdError || '');
    if (key !== statKey) {
      statKey = key;
      $('ctlStat').textContent = st + (S.error ? '  · ' + S.error : '') + (S.lcdError ? '  · LCD: ' + S.lcdError : '');
      $('ctlStat').classList.toggle('ok', S.active());
      $('ctlConnect').style.display = S.supported && S.source !== 'hid' ? '' : 'none';
      $('ctlLcdBox').style.display = S.hasLcd ? '' : 'none';
    }
    [...$('ctlAxes').children].forEach((row, i) => {
      const v = WM.clamp(S.axes[i], -1, 1), bar = row.querySelector('i');
      bar.style.left = (50 + Math.min(0, v) * 50) + '%'; bar.style.width = Math.abs(v) * 50 + '%';
    });
    $('ctlBtns').textContent = S.buttons.size ? 'naciśnięte: ' + [...S.buttons].map(n => 'SM ' + n).join(', ') : lastSmButton ? 'ostatnio: SM ' + lastSmButton : 'naciśnij przycisk na SpaceMouse';
    if (S.hasLcd) {
      S.lcdCompose();
      S.lcdPreview($('ctlLcdView'));
      if (cfg.lcd) S.lcdFlush();
    }
  }

  I.open = function () {
    I.uiOpen = true;
    $('ctl').style.display = 'flex';
    statKey = '';
    buildAxes(); buildBinds(); pvReset(); refreshUi();
  };
  I.close = function () {
    endCapture();
    I.uiOpen = false;
    $('ctl').style.display = 'none';
  };

  I.init = function () {
    rebuild();
    $('ctlClose').addEventListener('click', I.close);
    $('ctlPvReset').addEventListener('click', pvReset);
    $('ctl').addEventListener('mousedown', e => { if (e.target === $('ctl') && !capture) I.close(); });
    $('ctlReset').addEventListener('click', () => {
      if (!confirm('Przywrócić domyślne klawisze i ustawienia SpaceMouse?')) return;
      cfg = defaults(); save(); rebuild(); buildAxes(); buildBinds();
    });
    $('ctlResetKeys').addEventListener('click', () => { cfg.bind = defaults().bind; save(); rebuild(); buildBinds(); });
    $('ctlConnect').addEventListener('click', async () => { await WSpace.request(); statKey = ''; });
    WSpace.onChange = () => {
      statKey = '';
      const b = $('smStat');
      if (b) { b.textContent = WSpace.active() ? '🎛 ' + WSpace.name : ''; b.style.display = WSpace.active() ? '' : 'none'; }
      if (WSpace.active() && WSpace.source === 'hid') WE.toast('SpaceMouse: ' + WSpace.name + (WSpace.hasLcd ? ' (z ekranem)' : ''), 2500);
    };
    WSpace.init();
  };

  window.WInput = I;
})();
