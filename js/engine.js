// Core engine: WebGL2 setup, input, world switching, GPU distance probes, main loop.
(function () {
  const E = {
    worlds: [], world: null, worldIndex: -1,
    time: 0, projMode: 0, resScale: 0.6, fov: 1.35,
    keys: {}, mouseDX: 0, mouseDY: 0, locked: false, started: false,
  };
  E.PROJ_NAMES = ['Perspektywa', 'Rybie oko 360°', 'Panorama sferyczna', 'Perspektywa odwrócona', 'Ortogonalna'];
  E.MAX_PROBES = 64;

  E.register = w => E.worlds.push(w);
  // mouse wheel notches waiting for the player controller (flying up / down)
  E.flyImpulse = 0;
  E.takeFly = () => { const f = E.flyImpulse; E.flyImpulse = 0; return f; };

  function showError(msg) {
    const el = document.getElementById('err');
    el.style.display = 'block';
    el.textContent += msg + '\n\n';
    console.error(msg);
  }
  E.showError = showError;

  E.hurt = msg => {
    const h = document.getElementById('hurt');
    h.style.transition = 'none'; h.style.opacity = 1;
    requestAnimationFrame(() => { h.style.transition = 'opacity .8s'; h.style.opacity = 0; });
    if (msg) E.toast(msg);
  };

  E.toast = (msg, ms = 1800) => {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.opacity = 1;
    clearTimeout(E._toastT);
    E._toastT = setTimeout(() => (t.style.opacity = 0), ms);
  };

  // ---------------- GL ----------------
  E.initGL = function () {
    const canvas = document.getElementById('c');
    const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
    if (!gl) { showError('Brak WebGL2 w tej przeglądarce.'); return false; }
    E.gl = gl; E.canvas = canvas;
    E.hasFloatRT = !!gl.getExtension('EXT_color_buffer_float');
    E.parallel = gl.getExtension('KHR_parallel_shader_compile');

    E.vs = `#version 300 es
      void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.0-1.0,0.0,1.0); }`;
    E.vao = gl.createVertexArray();

    // probe render target: MAX_PROBES x 1, one distance per pixel
    E.probeTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, E.probeTex);
    if (E.hasFloatRT) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, E.MAX_PROBES, 1, 0, gl.RGBA, gl.FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, E.MAX_PROBES, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    E.probeFB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, E.probeFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, E.probeTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    E.probeBufF = new Float32Array(E.MAX_PROBES * 4);
    E.probeBufB = new Uint8Array(E.MAX_PROBES * 4);
    return true;
  };

  // Programs are built asynchronously when the browser supports KHR_parallel_shader_compile: compile + link are
  // issued, and the (blocking) status query is only made once the driver reports completion. Heavy ray-marching
  // shaders take ~0.5-1.5 s to compile, so all maps are prepared in the background while the menu is shown.
  function reportCompileError(sh, src, label) {
    const gl = E.gl, log = gl.getShaderInfoLog(sh);
    const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l);
    const m = /ERROR: \d+:(\d+)/.exec(log);
    const around = m ? lines.slice(Math.max(0, m[1] - 6), +m[1] + 3).join('\n') : '';
    showError(`[${label}] błąd kompilacji shadera:\n${log}\n${around}`);
  }
  // start building; returns a handle { p, vs, fs, src, label, state: 'pending' | 'ok' | 'error' }
  E.startProgram = function (fsSrc, label) {
    const gl = E.gl, h = { src: fsSrc, label, state: 'pending' };
    h.vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(h.vs, E.vs); gl.compileShader(h.vs);
    h.fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(h.fs, fsSrc); gl.compileShader(h.fs);
    h.p = gl.createProgram();
    gl.attachShader(h.p, h.vs); gl.attachShader(h.p, h.fs); gl.linkProgram(h.p);
    return h;
  };
  E.programReady = h => h.state !== 'pending' || !E.parallel || E.gl.getProgramParameter(h.p, E.parallel.COMPLETION_STATUS_KHR);
  // finish (blocks if the driver is not done yet); returns the program or null
  E.finishProgram = function (h) {
    if (h.state === 'ok') return h.p;
    if (h.state === 'error') return null;
    const gl = E.gl;
    if (!gl.getProgramParameter(h.p, gl.LINK_STATUS)) {
      h.state = 'error';
      if (!gl.getShaderParameter(h.fs, gl.COMPILE_STATUS)) reportCompileError(h.fs, h.src, h.label);
      else showError(`[${h.label}] link: ` + gl.getProgramInfoLog(h.p));
      return null;
    }
    h.state = 'ok';
    const p = h.p, cache = {};
    p.u = name => (name in cache ? cache[name] : (cache[name] = gl.getUniformLocation(p, name)));
    return p;
  };
  E.makeProgram = (fsSrc, label) => E.finishProgram(E.startProgram(fsSrc, label));

  E.compileMs = {};
  function startWorld(w) {
    if (w._build) return;
    const src = w.shader();
    w._build = { t0: performance.now(), render: E.startProgram(src.render, w.name), probe: E.startProgram(src.probe, w.name + ' (probe)') };
  }
  const worldReady = w => { startWorld(w); return E.programReady(w._build.render) && E.programReady(w._build.probe); };
  function finishWorld(w) {
    if (w.prog) return true;
    startWorld(w);
    w.prog = E.finishProgram(w._build.render);
    w.probeProg = E.finishProgram(w._build.probe);
    E.compileMs[w.name] = Math.round(performance.now() - w._build.t0);
    if (!w.prog || !w.probeProg) { w.prog = w.probeProg = null; return false; }
    // draw once into a tiny target: some drivers finish the work only on first use
    const gl = E.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, E.probeFB); gl.viewport(0, 0, 1, 1);
    gl.useProgram(w.prog); gl.uniform2f(w.prog.u('uRes'), 1, 1); gl.uniform1i(w.prog.u('uBulletN'), 0);
    gl.bindVertexArray(E.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(w.probeProg); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }
  // background preparation of all maps (one at a time, finished only when the driver reports completion)
  E.prepareAll = function () {
    let i = 0;
    const tick = () => {
      while (i < E.worlds.length && E.worlds[i].prog) i++;
      if (i >= E.worlds.length) { E.prepared = true; if (E.onPrepare) E.onPrepare(E.worlds.length, E.worlds.length); return; }
      const w = E.worlds[i];
      if (worldReady(w)) { finishWorld(w); i++; if (E.onPrepare) E.onPrepare(i, E.worlds.length); }
      setTimeout(tick, E.parallel ? 30 : 60);
    };
    tick();
  };

  // Evaluate the world's distance field at up to MAX_PROBES points (arrays of length 4 or 5).
  E.probe = function (points) {
    const gl = E.gl, w = E.world, p = w.probeProg, n = Math.min(points.length, E.MAX_PROBES);
    if (!p || n === 0) return [];
    gl.useProgram(p);
    const a = new Float32Array(E.MAX_PROBES * 4);
    for (let i = 0; i < n; i++) {
      const q = points[i];
      a[i * 4] = q[0]; a[i * 4 + 1] = q[1]; a[i * 4 + 2] = q[2] || 0; a[i * 4 + 3] = q[3] || 0;
    }
    gl.uniform4fv(p.u('uProbe'), a);
    gl.uniform1f(p.u('uTime'), E.time);
    if (w.setUniforms) w.setUniforms(gl, p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, E.probeFB);
    gl.viewport(0, 0, E.MAX_PROBES, 1);
    gl.bindVertexArray(E.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const out = new Array(n);
    if (E.hasFloatRT) {
      gl.readPixels(0, 0, E.MAX_PROBES, 1, gl.RGBA, gl.FLOAT, E.probeBufF);
      for (let i = 0; i < n; i++) out[i] = E.probeBufF[i * 4];
    } else {
      // fallback: distance encoded as d/16 clamped in R channel (low precision)
      gl.readPixels(0, 0, E.MAX_PROBES, 1, gl.RGBA, gl.UNSIGNED_BYTE, E.probeBufB);
      for (let i = 0; i < n; i++) out[i] = (E.probeBufB[i * 4] / 255) * 16 - 1;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return out;
  };

  // ---------------- worlds ----------------
  E.switchWorld = function (i, opts = {}) {
    if (i < 0 || i >= E.worlds.length || E._switching) return;
    const fade = document.getElementById('fade'), w = E.worlds[i];
    E._switching = true;
    fade.style.opacity = 1;
    const go = () => {
      if (!worldReady(w)) {                              // still compiling in the driver: wait, say so
        fade.textContent = 'Kompilowanie shaderów mapy „' + w.name + '”…';
        return setTimeout(go, 50);
      }
      fade.textContent = '';
      if (!finishWorld(w)) { E._switching = false; fade.style.opacity = 0; return; }
      E.world = w; E.worldIndex = i;
      w.enter(opts);
      if (w.bullets) w.bullets.clear();
      WGun.refill();
      document.getElementById('hudName').textContent = `${i + 1}. ${w.name}`;
      document.getElementById('hudSub').textContent = w.subtitle || '';
      document.getElementById('help').textContent = (w.help || []).join('\n') +
        '\n\nLPM strzał · 1–' + E.worlds.length + ' mapy · Esc / M menu\nP projekcja · [ ] rozdz.';
      if (E.onWorldChanged) E.onWorldChanged(w, opts);
      fade.style.opacity = 0;
      E._switching = false;
    };
    startWorld(w);
    setTimeout(go, opts.instant ? 0 : 350);
  };

  // ---------------- input ----------------
  E.initInput = function () {
    const c = E.canvas;
    E.lock = () => { c.requestPointerLock && c.requestPointerLock(); };
    E.unlock = () => { if (document.exitPointerLock) document.exitPointerLock(); };
    c.addEventListener('click', E.lock);
    document.addEventListener('pointerlockchange', () => {
      E.locked = document.pointerLockElement === c;
      if (!E.locked) { E.keys = {}; E.fireHeld = false; }
      if (E.onLockChange) E.onLockChange(E.locked);
    });
    document.addEventListener('mousedown', e => { if (E.locked && e.button === 0) E.fireHeld = true; });
    document.addEventListener('mouseup', e => { if (e.button === 0) E.fireHeld = false; });
    document.addEventListener('mousemove', e => { if (E.locked) { E.mouseDX += e.movementX; E.mouseDY += e.movementY; } });
    // mouse wheel: fly up / down (the player hovers until it lands again); Ctrl + wheel: field of view
    c.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey) {
        E.fov = WM.clamp(E.fov * (e.deltaY > 0 ? 1.08 : 1 / 1.08), 0.3, 2.9);
        E.toast('FOV ' + Math.round(E.fov * 180 / Math.PI) + '°', 700);
      } else if (E.locked && e.deltaY) E.flyImpulse += e.deltaY < 0 ? 1 : -1;
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!E.locked) return;   // menu open: the menu handles the keys
      E.keys[e.code] = true;
      if (e.repeat) return;
      if (e.code.startsWith('Digit')) {
        const n = +e.code.slice(5);
        if (n >= 1 && n <= E.worlds.length) E.switchWorld(n - 1);
      }
      if (e.code === 'KeyM' || e.code === 'Tab' || e.code === 'KeyH') E.unlock();
      if (e.code === 'KeyR' && E.world && E.world.bullets) WGun.reload();
      if (e.code === 'KeyP') { E.projMode = (E.projMode + 1) % E.PROJ_NAMES.length; E.toast('Projekcja: ' + E.PROJ_NAMES[E.projMode]); }
      if (e.code === 'BracketLeft') { E.resScale = Math.max(0.25, E.resScale - 0.1); E.toast('Rozdzielczość ' + Math.round(E.resScale * 100) + '%', 700); }
      if (e.code === 'BracketRight') { E.resScale = Math.min(1.5, E.resScale + 0.1); E.toast('Rozdzielczość ' + Math.round(E.resScale * 100) + '%', 700); }
    });
    window.addEventListener('keyup', e => { E.keys[e.code] = false; });
    window.addEventListener('blur', () => { E.keys = {}; E.fireHeld = false; });
  };

  E.axis = (neg, pos) => (E.keys[pos] ? 1 : 0) - (E.keys[neg] ? 1 : 0);

  // ---------------- loop ----------------
  let last0 = performance.now(), last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0, autoT = 0;
  E.frame = function (now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    E.time += dt;
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = E.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    E.maxFrameMs = Math.max(E.maxFrameMs || 0, now - last0); last0 = now;

    const gl = E.gl, w = E.world;
    if (w && w.prog) {
      const look = { dx: E.mouseDX * 0.0022, dy: E.mouseDY * 0.0022 };
      E.mouseDX = E.mouseDY = 0;
      WMP.update(dt);
      w.update(dt, look);
      if (E.onFrame) E.onFrame(dt);
      WGun.update(dt);
      if (w.bullets) {
        if (E.fireHeld && !WMP.dead() && (!w.canFire || w.canFire()) && WGun.tryFire()) {
          const aim = w.aim();
          w.bullets.fire(aim);
          WMP.shot(w, aim);
          if (window.WAudio) WAudio.shot(w);
          if (w.onFire) w.onFire();
        }
        w.bullets.update(dt);
      }

      const cw = Math.max(1, Math.floor(window.innerWidth * E.resScale));
      const ch = Math.max(1, Math.floor(window.innerHeight * E.resScale));
      if (E.canvas.width !== cw || E.canvas.height !== ch) { E.canvas.width = cw; E.canvas.height = ch; }
      gl.viewport(0, 0, cw, ch);
      gl.useProgram(w.prog);
      gl.uniform2f(w.prog.u('uRes'), cw, ch);
      gl.uniform1f(w.prog.u('uTime'), E.time);
      gl.uniform1i(w.prog.u('uProj'), E.projMode);
      gl.uniform1f(w.prog.u('uFov'), E.fov);
      gl.uniform2f(w.prog.u('uViewOff'), 0, 0);
      w.setUniforms(gl, w.prog);
      WGun.setUniforms(gl, w.prog, !!w.bullets && !WMP.dead());
      if (w.setBulletUniforms) w.setBulletUniforms(gl, w.prog);
      else if (w.bullets) w.bullets.setUniforms(gl, w.prog); else gl.uniform1i(w.prog.u('uBulletN'), 0);
      gl.bindVertexArray(E.vao);
      if (w.drawViews && w.drawViews(gl, w.prog, cw, ch)) gl.viewport(0, 0, cw, ch);   // split screen (4D)
      else gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (E.afterDraw) E.afterDraw();

      // optional 2D overlay of the world (e.g. the 4D compass)
      const mini = document.getElementById('mini');
      if (w.drawOverlay) {
        mini.style.display = 'block';
        const sz = w.overlaySize || [300, 300];
        if (mini.width !== sz[0] || mini.height !== sz[1]) { mini.width = sz[0]; mini.height = sz[1]; mini.style.width = sz[0] + 'px'; mini.style.height = sz[1] + 'px'; }
        const ctx = mini.getContext('2d');
        ctx.clearRect(0, 0, mini.width, mini.height);
        w.drawOverlay(ctx, mini.width, mini.height, dt);
      } else mini.style.display = 'none';

      autoT += dt;
      if (autoT > 0.25) {
        autoT = 0;
        const s = w.stats ? w.stats() : '';
        document.getElementById('hudStats').textContent =
          `${fps.toFixed(0)} FPS · ${cw}×${ch} · ${E.PROJ_NAMES[E.projMode]}` + (s ? '\n' + s : '');
      }
    }
    requestAnimationFrame(E.frame);
  };

  window.WE = E;
})();
