// Main menu: map cards (with thumbnails from assets/maps/<n>.jpg) on the left, the selected map on the right —
// description, game mode, the map's settings (sliders), its keys, and GRAJ. The menu opens whenever the mouse is
// released (Esc / M / Tab); the world keeps rendering behind it. Also the in-game settings panel (#wset) and HUD.
(function () {
  const $ = id => document.getElementById(id);
  const M = { open: false, sel: 0 };
  const modeSel = [];          // per map: the selected mode (index into world.modes)
  const thumb = i => `url("assets/maps/${i + 1}.jpg")`;
  const fightModes = w => (w.modes || []).map((m, i) => (/potwor|walka|bot/i.test(m.label) ? i : -1)).filter(i => i >= 0);

  function buildList() {
    const list = $('mapList');
    list.innerHTML = '';
    WE.worlds.forEach((w, i) => {
      if (modeSel[i] == null) modeSel[i] = w.modes ? (fightModes(w)[0] != null ? fightModes(w)[0] : 0) : -1;
      const b = document.createElement('button');
      b.className = 'card';
      b.innerHTML = `<div class="thumb"></div><span class="num">${i + 1}</span><span class="pp"></span><span class="now">TERAZ</span><div class="ctxt"><b></b><div class="tags"></div></div>`;
      b.querySelector('.thumb').style.backgroundImage = thumb(i) + `, linear-gradient(135deg, hsl(${i * 47 + 200},45%,30%), hsl(${i * 47 + 260},45%,14%))`;
      b.querySelector('b').textContent = w.name;
      fillTags(b.querySelector('.tags'), w);
      b.addEventListener('click', () => select(i));
      b.addEventListener('dblclick', () => { select(i); play(); });
      list.appendChild(b);
    });
  }
  function fillTags(el, w) {
    el.innerHTML = '';
    for (const t of w.tags || []) {
      const s = document.createElement('span');
      s.className = 'tag' + (/potwor|bot|pojedynek|sieciowa/.test(t) ? ' fight' : '');
      s.textContent = t;
      el.appendChild(s);
    }
  }
  function markCards() {
    const pres = WMP.presence();
    [...$('mapList').children].forEach((b, i) => {
      b.classList.toggle('sel', i === M.sel);
      b.classList.toggle('cur', i === WE.worldIndex);
      const here = pres.filter(p => p.map === i), pp = b.querySelector('.pp');
      pp.style.display = here.length ? 'block' : 'none';
      const t = here.map(p => 'gracz ' + p.id).join(', ');
      if (pp.textContent !== t) pp.textContent = t;
    });
  }
  // other players on the selected map, each with "join" (= this map in that player's mode)
  let peersKey = '';
  function showPeers() {
    const w = WE.worlds[M.sel], here = WMP.presence().filter(p => p.map === M.sel);
    const key = M.sel + '|' + here.map(p => p.id + ':' + p.mode).join(',');
    if (key === peersKey) return;
    peersKey = key;
    const box = $('dPeers');
    box.innerHTML = '';
    for (const p of here) {
      const row = document.createElement('div');
      row.className = 'peerRow';
      const mode = w.modes ? w.modes[p.mode] : null;
      row.innerHTML = '<span></span><button>Dołącz</button>';
      row.querySelector('span').textContent = `Gracz ${p.id} gra tutaj${mode ? ' — tryb: ' + mode.label : ''}`;
      row.querySelector('button').addEventListener('click', () => { if (w.modes) modeSel[M.sel] = p.mode; play(); });
      box.appendChild(row);
    }
  }
  // opened from a game server and somebody already plays: preselect their map and mode (once)
  let followed = false;
  function followFirstPeer() {
    if (followed || M.played) return;
    const p = WMP.presence()[0];
    if (!p) return;
    followed = true;
    if (WE.worlds[p.map] && WE.worlds[p.map].modes) modeSel[p.map] = p.mode;
    select(p.map);
    WE.toast(`Gracz ${p.id} gra na mapie ${p.map + 1}. ${WE.worlds[p.map].name} — kliknij GRAJ, żeby do niego dołączyć`, 5000);
  }

  function select(i) {
    M.sel = (i + WE.worlds.length) % WE.worlds.length;
    const w = WE.worlds[M.sel];
    markCards();
    $('mapList').children[M.sel].scrollIntoView({ block: 'nearest' });
    $('dThumb').style.backgroundImage = thumb(M.sel) + `, linear-gradient(135deg, hsl(${M.sel * 47 + 200},45%,30%), hsl(${M.sel * 47 + 260},45%,14%))`;
    $('dName').innerHTML = `<span>${M.sel + 1}</span>`;
    $('dName').appendChild(document.createTextNode(w.name));
    fillTags($('dTags'), w);
    $('dDesc').textContent = w.subtitle || '';
    // modes
    const box = $('dModes');
    box.innerHTML = '';
    $('dModesWrap').style.display = w.modes ? '' : 'none';
    (w.modes || []).forEach((m, k) => {
      const b = document.createElement('button');
      b.className = 'modeBtn' + (k === modeSel[M.sel] ? ' sel' : '');
      b.textContent = m.label;
      b.addEventListener('click', () => { modeSel[M.sel] = k; select(M.sel); });
      b.addEventListener('dblclick', () => { modeSel[M.sel] = k; play(); });
      box.appendChild(b);
    });
    // settings + keys
    buildSettings($('dSet'), w, true);
    $('dSetWrap').style.display = (w.settings || []).length ? '' : 'none';
    const help = $('dHelp');
    help.innerHTML = '';
    for (const h of w.help || []) { const li = document.createElement('li'); li.textContent = h; help.appendChild(li); }
    peersKey = '';
    showPeers();
    updatePlayLabel();
  }
  // GRAJ: same map and mode as the one running = just continue; otherwise (re)start the map in the selected mode
  const running = () => WE.worldIndex === M.sel && (!WE.world.modes || WE.world._modeIdx === modeSel[M.sel]);
  function updatePlayLabel() {
    const r = WE.world && running();
    $('playBtn').textContent = r ? '▶ WZNÓW' : '▶ GRAJ';
    $('restartBtn').style.display = r ? '' : 'none';
  }
  function play(restart) {
    const w = WE.worlds[M.sel];
    M.played = true;
    if (restart || !running()) {
      const opts = w.modes ? w.modes[modeSel[M.sel]].opts : {};
      w._modeIdx = w.modes ? modeSel[M.sel] : undefined;
      WE.switchWorld(M.sel, opts);
    }
    WE.lock();
  }

  // ---- settings: one slider / checkbox per world setting (in the menu, and as a read-only panel in game) ----
  let rows = [];
  function buildSettings(box, w, inMenu) {
    box.innerHTML = '';
    rows = rows.filter(r => r.inMenu !== inMenu);
    const list = (w && w.settings) || [];
    if (!inMenu) box.style.display = list.length ? 'block' : 'none';
    for (const s of list) {
      const row = document.createElement('div');
      row.className = 'srow';
      const toggle = s.type === 'toggle';
      row.innerHTML = `<label></label><input type="${toggle ? 'checkbox' : 'range'}"><span class="val"></span>`;
      row.querySelector('label').textContent = s.label;
      const inp = row.querySelector('input');
      if (toggle) {
        inp.checked = !!s.get();
        inp.addEventListener('change', () => s.set(inp.checked));
      } else {
        inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = s.get();
        inp.addEventListener('input', () => s.set(+inp.value));
        inp.addEventListener('dblclick', () => { s.set(s.reset != null ? s.reset : 0); });
      }
      box.appendChild(row);
      rows.push({ s, inp, val: row.querySelector('.val'), inMenu });
    }
    if (!inMenu && list.length) {
      const hint = document.createElement('div');
      hint.className = 'shint';
      hint.textContent = 'zmienisz w menu (Esc) albo klawiszami z pomocy po prawej';
      box.appendChild(hint);
    }
  }
  function syncSettings() {
    for (const r of rows) {
      if (r.s.type === 'toggle') r.inp.checked = !!r.s.get();
      else if (document.activeElement !== r.inp) r.inp.value = r.s.get();
      r.val.textContent = r.s.text ? r.s.text() : r.s.type === 'toggle' ? (r.s.get() ? 'wł.' : 'wył.') : r.s.get().toFixed(2);
    }
  }

  M.show = function (open) {
    M.open = open;
    $('menu').classList.toggle('open', open);
    for (const id of ['hud', 'cross', 'wset', 'duel', 'health', 'mini', 'ammo', 'split']) { const e = $(id); if (e) e.style.visibility = open ? 'hidden' : ''; }
    $('help').style.opacity = open ? 0 : 0.8;
    if (open) select(WE.worldIndex >= 0 ? WE.worldIndex : M.sel);
  };

  M.init = function () {
    buildList();
    $('playBtn').addEventListener('click', () => play());
    $('restartBtn').addEventListener('click', () => play(true));
    WE.onLockChange = locked => M.show(!locked);
    WE.onWorldChanged = (w, opts) => {
      // remember which mode the running map is in (also when switched in game with the number keys)
      if (w.modes && opts) {
        const k = w.modes.findIndex(m => JSON.stringify(m.opts) === JSON.stringify(Object.assign({}, opts, { instant: undefined })));
        if (k >= 0) w._modeIdx = k;
      }
      if (w.modes && w._modeIdx == null) w._modeIdx = 0;
      buildSettings($('wset'), w, false);
      if (M.open) select(M.sel); else markCards();
    };
    // keyboard in the menu: arrows choose a map, digits jump to one, Enter plays
    window.addEventListener('keydown', e => {
      if (!M.open || e.target.tagName === 'INPUT') return;
      const cols = Math.max(1, Math.round($('mapList').clientWidth / 264));
      const k = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.code];
      if (k) { e.preventDefault(); select(WM.clamp(M.sel + k, 0, WE.worlds.length - 1)); }
      if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= WE.worlds.length) select(n - 1); }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); play(); }
    });
    WE.onFrame = () => {
      syncSettings();
      const w = WE.world, hb = $('health'), du = $('duel');
      const dt = !w ? '' : WMP.pvp(w) ? WMP.hud(w) : (w.duelHud ? w.duelHud() : '') + WMP.coopLine(w);
      du.style.display = dt ? 'block' : 'none';
      if (dt && du.innerHTML !== dt) du.innerHTML = dt;
      hb.style.display = w && w.health != null ? 'block' : 'none';
      if (w && w.health != null) hb.firstChild.style.width = Math.max(0, w.health) + '%';
      if (M.open) { markCards(); updatePlayLabel(); showPeers(); followFirstPeer(); }
      // split screen (4D): labels, and the crosshair in the middle of the normal view
      const split = !!(w && w.splitView && w.splitView());
      $('split').style.display = split ? 'block' : 'none';
      $('cross').style.left = split ? '25%' : ''; $('cross').style.top = split ? '25%' : '';
      const net = WMP.status();
      if ($('net').textContent !== net) $('net').textContent = net;
      // ammo
      const am = $('ammo');
      if (w && w.bullets) {
        am.style.display = 'block';
        am.style.left = w.health != null ? '250px' : '16px';
        am.classList.toggle('reloading', WGun.reloading);
        am.classList.toggle('empty', WGun.ammo === 0 && !WGun.reloading);
        const t = WGun.reloading ? 'PRZEŁADOWANIE' : WGun.ammo === 0 ? 'R — przeładuj' : `${WGun.ammo} <small>/ ${WGun.constructor.MAG}</small>`;
        const n = am.querySelector('.n');
        if (n.innerHTML !== t) n.innerHTML = t;
        am.querySelector('.rl div').style.width = (WGun.phase * 100).toFixed(1) + '%';
      } else am.style.display = 'none';
    };
    M.show(true);
  };

  window.WMenu = M;
})();
