// SpaceMouse: 3Dconnexion 6-DOF controllers through WebHID — no 3Dconnexion driver is needed, the browser talks to
// the plain Windows HID device. The browser asks once for permission (button "Połącz SpaceMouse" in the controls
// window); after that the device is opened automatically whenever it is plugged in. Without WebHID (e.g. the game
// opened from another computer over plain http) the Gamepad API is tried instead (axes and buttons, no screen).
//   axes: [TX right, TY towards you, TZ down, RX tilt, RY roll, RZ twist], about -1..1 (raw counts / FULL)
//   The original SpacePilot (046D:C625) has a 240×64 monochrome LCD driven by HID feature reports
//   (reverse-engineered by jtsiomb/3dxdisp): 0x12 stops the firmware redrawing it, 0x0C sets the cursor
//   (page 0–7 of 8 pixel rows, column 0–239), 0x0D writes 7 columns (bit 0 = top row of the page),
//   0x0E writes up to 3 runs (count, column byte). The game draws its status there (WSpace.lcdCompose).
(function () {
  const S = { device: null, name: '', source: '', axes: [0, 0, 0, 0, 0, 0], raw: [0, 0, 0, 0, 0, 0], buttons: new Set(),
    hasLcd: false, error: '', supported: false, onButton: null, onChange: null };
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  S.supported = !!nav.hid;
  const VID_LOGI = 0x046d, VID_3DX = 0x256f, PID_SPACEPILOT = 0xc625;
  const FULL = 350;                          // raw count taken as a full push (the devices report about ±350..±500)
  const NAMES = { 0xc603: 'SpaceMouse Plus XT', 0xc605: 'CADman', 0xc606: 'SpaceMouse Classic', 0xc621: 'SpaceBall 5000',
    0xc623: 'SpaceTraveler', 0xc625: 'SpacePilot', 0xc626: 'SpaceNavigator', 0xc627: 'SpaceExplorer', 0xc628: 'SpaceNavigator for Notebooks',
    0xc629: 'SpacePilot Pro', 0xc62b: 'SpaceMouse Pro', 0xc62e: 'SpaceMouse Wireless', 0xc62f: 'SpaceMouse Wireless', 0xc631: 'SpaceMouse Pro Wireless',
    0xc632: 'SpaceMouse Pro Wireless', 0xc633: 'SpaceMouse Enterprise', 0xc635: 'SpaceMouse Compact', 0xc652: 'Universal Receiver' };
  const multiAxis = d => !d.collections || !d.collections.length || d.collections.some(c => c.usagePage === 1 && c.usage === 8);
  const isSpace = d => (d.vendorId === VID_3DX || (d.vendorId === VID_LOGI && NAMES[d.productId])) && multiAxis(d);

  S.active = () => !!S.device || S.source === 'gamepad';
  const changed = () => { if (S.onChange) S.onChange(); };
  function setButtons(now) {
    for (const b of now) if (!S.buttons.has(b) && S.onButton) S.onButton(b, true);
    for (const b of S.buttons) if (!now.has(b) && S.onButton) S.onButton(b, false);
    S.buttons = now;
  }
  function clear() { S.raw.fill(0); S.axes.fill(0); setButtons(new Set()); }

  // ---------------- WebHID ----------------
  function onReport(e) {
    const v = e.data, id = e.reportId;
    if (id === 1 && v.byteLength >= 6) {
      for (let k = 0; k < 3; k++) S.raw[k] = v.getInt16(2 * k, true);
      if (v.byteLength >= 12) for (let k = 0; k < 3; k++) S.raw[3 + k] = v.getInt16(6 + 2 * k, true);   // newer models: all six in one report
    } else if (id === 2 && v.byteLength >= 6) {
      for (let k = 0; k < 3; k++) S.raw[3 + k] = v.getInt16(2 * k, true);
    } else if (id === 3) {
      const now = new Set();
      for (let i = 0; i < v.byteLength; i++) for (let b = 0; b < 8; b++) if (v.getUint8(i) >> b & 1) now.add(i * 8 + b + 1);
      setButtons(now);
    }
    for (let k = 0; k < 6; k++) S.axes[k] = WM.clamp(S.raw[k] / FULL, -1.5, 1.5);
  }
  async function open(d) {
    try { if (!d.opened) await d.open(); }
    catch (e) { S.error = 'Nie mogę otworzyć urządzenia: ' + e.message; changed(); return false; }
    if (S.device && S.device !== d) S.device.removeEventListener('inputreport', onReport);
    S.device = d; S.source = 'hid'; S.error = '';
    S.name = NAMES[d.productId] || d.productName || 'SpaceMouse';
    S.hasLcd = d.vendorId === VID_LOGI && d.productId === PID_SPACEPILOT;
    d.addEventListener('inputreport', onReport);
    lcd.sent = []; lcd.next = 0;
    changed();
    return true;
  }
  S.init = async function () {
    if (!nav.hid) return;
    nav.hid.addEventListener('connect', e => { if (!S.device && isSpace(e.device)) open(e.device); });
    nav.hid.addEventListener('disconnect', e => {
      if (e.device !== S.device) return;
      S.device = null; S.source = ''; S.hasLcd = false; clear(); changed();
    });
    try { const d = (await nav.hid.getDevices()).find(isSpace); if (d) await open(d); } catch (e) { S.error = e.message; }
    window.addEventListener('pagehide', () => { if (S.hasLcd) S.lcdBye(); });
  };
  // needs a user gesture (a click): the browser shows its device chooser
  S.request = async function () {
    if (!nav.hid) return false;
    try {
      const ds = await nav.hid.requestDevice({ filters: [{ vendorId: VID_LOGI, usagePage: 1, usage: 8 }, { vendorId: VID_3DX, usagePage: 1, usage: 8 }] });
      const d = ds.find(isSpace) || ds[0];
      return d ? open(d) : false;
    } catch (e) { S.error = e.message; changed(); return false; }
  };

  // ---------------- Gamepad API (fallback without WebHID) ----------------
  const PAD = /vendor: ?(046d|256f).*product: ?c6[0-5]/i;
  S.poll = function () {
    if (S.device) return;
    const g = [...(nav.getGamepads ? nav.getGamepads() : [])].find(p => p && PAD.test(p.id));
    if (!g) { if (S.source === 'gamepad') { S.source = ''; clear(); changed(); } return; }
    if (S.source !== 'gamepad') { S.source = 'gamepad'; S.name = (g.id.split('(')[0].trim() || 'SpaceMouse') + ' (gamepad)'; S.hasLcd = false; changed(); }
    for (let k = 0; k < 6; k++) S.axes[k] = WM.clamp((g.axes[k] || 0) * 500 / FULL, -1.5, 1.5);
    const now = new Set();
    g.buttons.forEach((b, i) => { if (b.pressed) now.add(i + 1); });
    setButtons(now);
  };

  // ---------------- LCD (SpacePilot) ----------------
  const LW = 240, LH = 64;
  const lcd = { canvas: null, sent: [], busy: false, next: 0, invert: false };
  if (document.createElement) { lcd.canvas = S.lcdCanvas = document.createElement('canvas'); lcd.canvas.width = LW; lcd.canvas.height = LH; }
  const send = (id, bytes) => { const b = new Uint8Array(7); b.set(bytes.slice(0, 7)); return S.device.sendFeatureReport(id, b); };
  // one page (240 column bytes) as reports: runs of equal columns packed (0x0E), the rest 7 columns at a time (0x0D)
  function encodePage(cols) {
    const out = [];
    let start = 0;
    while (start < LW) {
      const pat = [cols[start]], cnt = [1];
      let i = start + 1;
      for (; i < LW; i++) {
        const k = pat.length - 1;
        if (cols[i] === pat[k] && cnt[k] < 255) cnt[k]++;
        else if (pat.length < 3) { pat.push(cols[i]); cnt.push(1); }
        else break;
      }
      if (i - start > 7 || LW - i < 7) {
        const b = [];
        pat.forEach((p, k) => b.push(cnt[k], p));
        out.push([0x0e, b]);
        start = i;
      } else {
        const b = [];
        for (let k = 0; k < 7; k++) b.push(start + k < LW ? cols[start + k] : 0);
        out.push([0x0d, b]);
        start += 7;
      }
    }
    return out;
  }
  function pagesOf(ctx) {
    const px = ctx.getImageData(0, 0, LW, LH).data, pages = [];
    for (let p = 0; p < 8; p++) {
      const cols = new Uint8Array(LW);
      for (let x = 0; x < LW; x++) {
        let c = 0;
        for (let j = 0; j < 8; j++) if ((px[((p * 8 + j) * LW + x) * 4] > 150) !== lcd.invert) c |= 1 << j;
        cols[x] = c;
      }
      pages.push(cols);
    }
    return pages;
  }
  const same = (a, b) => a && b && a.every((v, i) => v === b[i]);
  // send the pages that differ from what the screen shows (everything again every 15 s: the firmware may take the
  // screen back after a while). Asynchronous; skipped while the previous frame is still being written.
  async function flush(force) {
    if (!S.device || !S.hasLcd || lcd.busy) return;
    const now = performance.now();
    if (now > lcd.next) { lcd.sent = []; lcd.next = now + 15000; }
    const pages = pagesOf(lcd.canvas.getContext('2d'));
    const todo = pages.map((c, p) => (force || !same(c, lcd.sent[p]) ? p : -1)).filter(p => p >= 0);
    if (!todo.length) return;
    lcd.busy = true;
    try {
      await send(0x12, [0, 0, 0x2f]);
      for (const p of todo) {
        await send(0x0c, [p, 0, 0]);
        for (const [id, b] of encodePage(pages[p])) await send(id, b);
        lcd.sent[p] = pages[p];
      }
      S.lcdError = '';
    } catch (e) { S.lcdError = e.message; lcd.sent = []; }
    lcd.busy = false;
  }
  S.lcdFlush = flush;
  // what the screen really shows (1 bit per pixel) drawn into a canvas of the controls window
  S.lcdPreview = function (dst) {
    const pages = pagesOf(lcd.canvas.getContext('2d')), img = new ImageData(LW, LH);
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      const on = pages[y >> 3][x] >> (y & 7) & 1, i = (y * LW + x) * 4;
      img.data[i] = on ? 20 : 150; img.data[i + 1] = on ? 30 : 190; img.data[i + 2] = on ? 20 : 140; img.data[i + 3] = 255;
    }
    const tmp = document.createElement('canvas'); tmp.width = LW; tmp.height = LH; tmp.getContext('2d').putImageData(img, 0, 0);
    const c = dst.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(tmp, 0, 0, dst.width, dst.height);
  };
  S.lcdSetInvert = v => { if (lcd.invert !== !!v) { lcd.invert = !!v; lcd.sent = []; } };

  // what the screen shows: a title bar, the map, ammo / health, a line from the map (4D: W and camera) and the six axes
  const fit = (ctx, s, w) => { if (ctx.measureText(s).width <= w) return s; while (s.length > 1 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; };
  S.lcdCompose = function () {
    const ctx = lcd.canvas.getContext('2d'), E = WE, w = E.world, inGame = E.locked;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, LW, LH);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, LW, 13);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000'; ctx.font = '10px Verdana, Tahoma, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('WYMIARY', 3, 10);
    ctx.textAlign = 'right'; ctx.fillText(inGame ? (w && w.player && w.player.noclip ? 'NOCLIP' : 'W GRZE') : 'MENU', LW - 3, 10);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    const menu = window.WMenu && WMenu.open, idx = menu ? WMenu.sel : E.worldIndex, mw = E.worlds[idx];
    ctx.font = '11px Tahoma, Verdana, sans-serif';
    if (mw) ctx.fillText(fit(ctx, `${idx + 1}. ${mw.name}`, LW - 6), 3, 26);
    ctx.font = '10px Verdana, Tahoma, sans-serif';
    let l3 = '', l4 = '';
    if (menu) {
      l3 = mw && mw.modes && mw._modeIdx != null ? 'tryb: ' + mw.modes[mw._modeIdx].label : 'wybierz mapę, kliknij GRAJ';
      l4 = idx === E.worldIndex ? 'ta mapa jest uruchomiona' : '';
    } else if (w) {
      if (w.bullets) l3 = WGun.reloading ? 'PRZEŁADOWANIE' : `amunicja ${WGun.ammo}/${WGun.constructor.MAG}`;
      else if (w.modes && w._modeIdx != null) l3 = 'tryb: ' + w.modes[w._modeIdx].label;
      l4 = w.lcdInfo ? w.lcdInfo() : `${Math.round(E.fps || 0)} FPS · ${E.PROJ_NAMES[E.projMode]}`;
    }
    ctx.fillText(fit(ctx, l3, w && w.health != null && !menu ? 130 : LW - 6), 3, 39);
    if (w && w.health != null && !menu) {                // health bar right of the ammo
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(140.5, 31.5, 96, 8);
      ctx.fillRect(142, 33, Math.round(93 * WM.clamp(w.health / 100, 0, 1)), 6);
    }
    ctx.fillText(fit(ctx, l4, LW - 6), 3, 52);
    // the six axes of the controller: a short bar from the middle of each box
    for (let k = 0; k < 6; k++) {
      const x = 2 + k * 40, v = WM.clamp(S.axes[k], -1, 1), c = x + 18;
      ctx.fillRect(c, 56, 1, 8);
      const len = Math.round(v * 17);
      if (len) ctx.fillRect(Math.min(c, c + len), 58, Math.abs(len), 4);
    }
  };
  // the last frame stays on the screen after the game closes (the display keeps it while powered): say goodbye
  S.lcdBye = function () {
    const ctx = lcd.canvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, LW, LH);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Tahoma, Verdana, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('WYMIARY', LW / 2, 28); ctx.font = '10px Verdana, Tahoma, sans-serif'; ctx.fillText('gra zamknięta', LW / 2, 46);
    lcd.busy = false; flush(true);
  };

  window.WSpace = S;
})();
