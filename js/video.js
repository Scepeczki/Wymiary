// The picture (menu → 🖥 Obraz): automatic resolution for a steady frame rate (target FPS, the range of the render
// scale), the frame limit, or a fixed resolution by hand; live numbers of the current map. The controller itself is
// in js/engine.js (autoRes). Kept with the player's settings (localStorage 'wymiary.video' → js/store.js).
(function () {
  const V = { open: false };
  const $ = id => document.getElementById(id);
  const KEYS = ['autoRes', 'fpsTarget', 'fpsCap', 'resMin', 'resMax', 'resScale'];
  let saved = '';
  function save() {
    const o = {};
    for (const k of KEYS) o[k] = WE[k];
    const s = JSON.stringify(o);
    if (s === saved) return;
    saved = s;
    try { localStorage.setItem('wymiary.video', s); } catch (e) { /* no storage */ }
  }
  V.load = function () {
    try {
      const o = JSON.parse(localStorage.getItem('wymiary.video') || '{}');
      for (const k of KEYS) if (k in o) WE[k] = o[k];
    } catch (e) { /* no storage */ }
  };

  function sync() {
    $('vidAuto').checked = WE.autoRes;
    $('vidFps').value = String(WE.fpsTarget);
    $('vidCap').checked = WE.fpsCap;
    for (const [id, k] of [['vidMin', 'resMin'], ['vidMax', 'resMax'], ['vidScale', 'resScale']]) { $(id).value = WE[k]; $(id + 'V').textContent = Math.round(WE[k] * 100) + '%'; }
    $('vidAutoBox').style.display = WE.autoRes ? '' : 'none';
    $('vidManBox').style.display = WE.autoRes ? 'none' : '';
  }
  function live() {
    const p = WE.perf;
    $('vidLive').textContent = `${Math.round(WE.fps || 0)} FPS · render ${WE.renderW || 0}×${WE.renderH || 0} (${Math.round(WE.resScale * 100)}%)` +
      (p.gpu ? ` · GPU ${p.gpu.toFixed(1)} ms` : ' · (bez pomiaru GPU — według czasu klatki)') + ` · CPU ${p.cpu.toFixed(1)} ms` +
      (WE.world ? ` · mapa: ${WE.world.name}` : '');
    if (!WE.autoRes) return;
    $('vidScale').value = WE.resScale;
  }

  V.show = function () { V.open = true; $('vid').style.display = 'flex'; sync(); live(); };
  V.close = function () { V.open = false; $('vid').style.display = 'none'; };
  V.init = function () {
    V.load();
    $('vidBtn').addEventListener('click', V.show);
    $('vidClose').addEventListener('click', V.close);
    $('vid').addEventListener('mousedown', e => { if (e.target === $('vid')) V.close(); });
    $('vidAuto').addEventListener('change', () => { WE.autoRes = $('vidAuto').checked; save(); sync(); });
    $('vidFps').addEventListener('change', () => { WE.fpsTarget = +$('vidFps').value; save(); });
    $('vidCap').addEventListener('change', () => { WE.fpsCap = $('vidCap').checked; save(); });
    $('vidMin').addEventListener('input', () => { WE.resMin = Math.min(+$('vidMin').value, WE.resMax); WE.resByWorld = {}; save(); sync(); });
    $('vidMax').addEventListener('input', () => { WE.resMax = Math.max(+$('vidMax').value, WE.resMin); WE.resByWorld = {}; save(); sync(); });
    $('vidScale').addEventListener('input', () => { WE.resScale = +$('vidScale').value; save(); sync(); });
    $('vidReset').addEventListener('click', () => {
      Object.assign(WE, { autoRes: true, fpsTarget: 60, fpsCap: true, resMin: 0.35, resMax: 1, resByWorld: {} });
      save(); sync();
    });
    WE.onVideoChange = () => { save(); if (V.open) sync(); };
    window.addEventListener('keydown', e => { if (V.open && e.code === 'Escape') { e.stopImmediatePropagation(); V.close(); } }, true);
    setInterval(() => { if (V.open) live(); }, 500);
    setInterval(() => { if (WE.autoRes) save(); }, 10000);     // the scale it settled on: the next start begins there
  };
  window.WVideo = V;
})();
