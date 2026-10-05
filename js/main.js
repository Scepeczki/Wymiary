// Boot.
(function () {
  window.addEventListener('error', e => WE.showError('JS: ' + e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  if (!WE.initGL()) return;
  WE.initInput();
  // ?w=N opens world N directly (1-based), ?proj=M sets the projection — handy for testing
  const q = new URLSearchParams(location.search);
  if (q.has('defs')) WE.debugDefs = q.get('defs').split(',').map(d => '#define ' + d + '\n').join('');
  if (q.has('proj')) WE.projMode = +q.get('proj') % WE.PROJ_NAMES.length;
  WMenu.init();
  WNetUi.init();
  WVideo.init();                    // the picture: automatic resolution, frame limit
  if (q.has('shot')) WE.autoRes = WE.fpsCap = false;   // screenshots: a fixed resolution
  WInput.init();                    // key bindings, SpaceMouse (WebHID) and its screen
  WMP.start();                      // opened from a game server: connect (multiplayer on every map)
  if (q.has('shot')) WMenu.show(false);
  const wi = WM.clamp((+q.get('w') || 1) - 1, 0, WE.worlds.length - 1), wm = WE.worlds[wi].modes;
  WE.switchWorld(wi, Object.assign({ instant: true }, q.has('mode') && wm ? wm[+q.get('mode')].opts : {}));
  // prepare the other maps in the background while the menu is shown (no black screen later)
  WE.onPrepare = (i, n) => { document.getElementById('prep').textContent = i < n ? `· przygotowywanie map ${i}/${n}…` : ''; };
  if (!q.has('shot') || q.has('prep')) setTimeout(() => WE.prepareAll(), 500);
  // ?shot=URL: after a short warm-up, POST a PNG of the canvas there (used by the dev screenshot tool)
  if (q.has('shot')) {
    let n = 0;
    window.addEventListener('error', e => fetch(q.get('shot') + '&stats=' + encodeURIComponent('BŁĄD w klatce ' + n + ': ' + e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno), { method: 'POST', body: '' }));
    // report load failures (shader errors etc.) instead of timing out
    setTimeout(() => {
      const err = document.getElementById('err').textContent;
      if (n === 0 && err) fetch(q.get('shot') + '&stats=' + encodeURIComponent('BŁĄD: ' + err.slice(0, 1500)), { method: 'POST', body: '' });
    }, 8000);
    if (q.has('turn')) WE.mouseDX = +q.get('turn') / 0.0022;
    if (q.has('pitch')) WE.mouseDY = -q.get('pitch') / 0.0022;
    if (q.has('walk')) WE.keys.KeyW = true;
    WE.afterDraw = () => {
      if (n === 0) (WE.world.settings || []).forEach((s, i) => { if (q.has('s' + i)) s.set(+q.get('s' + i)); });
      if (n === (+q.get('posf') || 0) && q.has('pos')) WE.world.player.pos = q.get('pos').split(',').map(Number);
      if (q.has('walk') && n < (+q.get('frames') || 120) - 1) WE.keys.KeyW = true;
      if (q.has('keys') && n < (+q.get('frames') || 120) - 1) q.get('keys').split(',').forEach(k => { WE.keys[k] = true; });
      if (q.has('fire')) WE.fireHeld = n > (+q.get('fire') || 0);
      if (q.has('call')) { const [fn, at] = q.get('call').split('@'); if (n === +at) WE.world[fn](); }
      if (++n === (+q.get('frames') || 120)) {
        WE.keys = {};
        let bench = '';
        if (q.has('bench') && WE.world.soundArrivals) {
          const t = performance.now();
          for (let i = 0; i < 3; i++) WE.world.soundArrivals(null);
          bench = `dźwięk ${((performance.now() - t) / 3).toFixed(1)} ms | `;
        }
        const err = document.getElementById('err').textContent;
        const st = encodeURIComponent((err ? 'BŁĄD: ' + err.slice(0, 300) + ' | ' : '') + bench + 'najdłuższa klatka ' + Math.round(WE.maxFrameMs) + ' ms · kompilacja ' + (WE.prepared ? 'WSZYSTKO GOTOWE ' : '') + JSON.stringify(WE.compileMs) + ' | ' +Math.round(WE.fps || 0) + ' fps | ' + (WE.world.stats() || '').replace(/\n/g, ' | '));
        // composite the WebGL frame with the overlay canvas (minimap), like the player sees it
        const out = document.createElement('canvas'), mini = document.getElementById('mini');
        out.width = WE.canvas.width; out.height = WE.canvas.height;
        const oc = out.getContext('2d');
        oc.drawImage(WE.canvas, 0, 0);
        if (mini.style.display !== 'none') { const s = out.height / window.innerHeight; oc.drawImage(mini, out.width - (mini.width + 14) * s, out.height - (mini.height + 14) * s, mini.width * s, mini.height * s); }
        out.toBlob(b => fetch(q.get('shot') + '&stats=' + st, { method: 'POST', body: b }), 'image/png');
      }
    };
  }
  requestAnimationFrame(WE.frame);
})();
