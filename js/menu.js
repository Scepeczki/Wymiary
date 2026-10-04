// Map selection menu (replaces the old hub) + the live settings panel (sliders) of the current map.
// The menu opens whenever the mouse is released (Esc / M / Tab); the world keeps rendering beside it.
(function () {
  const $ = id => document.getElementById(id);
  const M = { open: false };

  function buildList() {
    const list = $('mapList');
    list.innerHTML = '';
    WE.worlds.forEach((w, i) => {
      const b = document.createElement('button');
      b.className = 'map';
      b.innerHTML = `<span class="num">${i + 1}</span><span class="txt"><b></b><small></small></span>`;
      b.querySelector('b').textContent = w.name;
      b.querySelector('small').textContent = w.subtitle || '';
      b.addEventListener('click', () => {
        if (i !== WE.worldIndex) WE.switchWorld(i);
        WE.lock();
      });
      // maps with game modes (e.g. with / without monsters): one button per mode
      if (w.modes) {
        const row = document.createElement('span');
        row.className = 'modes';
        for (const m of w.modes) {
          const mb = document.createElement('span');
          mb.className = 'mode';
          mb.textContent = '▶ ' + m.label;
          mb.addEventListener('click', e => { e.stopPropagation(); WE.switchWorld(i, m.opts); WE.lock(); });
          row.appendChild(mb);
        }
        b.querySelector('.txt').appendChild(row);
      }
      list.appendChild(b);
    });
  }
  function markActive() {
    [...$('mapList').children].forEach((b, i) => b.classList.toggle('active', i === WE.worldIndex));
  }

  // ---- settings panel: one slider per world setting ----
  let rows = [];
  function buildSettings(w) {
    const box = $('wset');
    box.innerHTML = '';
    rows = [];
    const list = (w && w.settings) || [];
    box.style.display = list.length ? 'block' : 'none';
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
      rows.push({ s, inp, val: row.querySelector('.val') });
    }
    const hint = document.createElement('div');
    hint.className = 'shint';
    hint.textContent = 'przeciągnij suwak (Esc = kursor) · w grze: klawisze z pomocy po prawej · dwuklik = 0';
    if (list.length) box.appendChild(hint);
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
    $('hud').style.opacity = open ? 0 : 1;
    $('help').style.opacity = open ? 0 : 0.8;
    $('cross').style.opacity = open ? 0 : 1;
    $('wset').classList.toggle('interactive', open);
    if (open) markActive();
  };

  M.init = function () {
    buildList();
    $('playBtn').addEventListener('click', () => WE.lock());
    WE.onLockChange = locked => M.show(!locked);
    WE.onWorldChanged = w => { buildSettings(w); markActive(); };
    WE.onFrame = () => {
      syncSettings();
      const w = WE.world, hb = $('health'), du = $('duel');
      const dt = w && w.duelHud ? w.duelHud() : '';
      du.style.display = dt ? 'block' : 'none';
      if (dt) du.innerHTML = dt;
      hb.style.display = w && w.health != null ? 'block' : 'none';
      if (w && w.health != null) hb.firstChild.style.width = Math.max(0, w.health) + '%';
    };
    M.show(true);
  };

  window.WMenu = M;
})();
