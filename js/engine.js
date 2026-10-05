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

    // probe render target: MAX_PROBES x PROBE_ROWS, one distance per pixel (row 0: E.probe, all rows: E.probeLater)
    E.probeTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, E.probeTex);
    if (E.hasFloatRT) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, E.MAX_PROBES, PROBE_ROWS, 0, gl.RGBA, gl.FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, E.MAX_PROBES, PROBE_ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    E.probeFB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, E.probeFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, E.probeTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    E.probeBufF = new Float32Array(E.MAX_PROBES * 4);
    E.probeBufB = new Uint8Array(E.MAX_PROBES * 4);
    gpuQ.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    E.asyncProbes = E.hasFloatRT;      // reading float pixels into a buffer object, without waiting
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
    const t0 = performance.now();
    try { return probeNow(gl, w, p, points, n); } finally { perfAcc.probe += performance.now() - t0; perfAcc.probeN++; }
  };
  // the probe program evaluates uProbe[i] into pixel (i, row)
  const probeArr = new Float32Array(64 * 4);
  function probeRow(gl, p, points, from, n, row) {
    probeArr.fill(0);
    for (let i = 0; i < n; i++) {
      const q = points[from + i];
      probeArr[i * 4] = q[0]; probeArr[i * 4 + 1] = q[1]; probeArr[i * 4 + 2] = q[2] || 0; probeArr[i * 4 + 3] = q[3] || 0;
    }
    gl.uniform4fv(p.u('uProbe'), probeArr);
    gl.viewport(0, row, E.MAX_PROBES, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function probeSetup(gl, w, p) {
    gl.useProgram(p);
    gl.uniform1f(p.u('uTime'), E.time);
    if (w.setUniforms) w.setUniforms(gl, p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, E.probeFB);
    gl.bindVertexArray(E.vao);
  }
  function probeNow(gl, w, p, points, n) {
    probeSetup(gl, w, p);
    probeRow(gl, p, points, 0, n, 0);
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
  }

  // ---------------- asynchronous probes ----------------
  // E.probe makes the CPU wait for the GPU: for everything queued before it — the whole previous frame — and then
  // for the round trip itself. E.probeLater(points, cb) instead collects the frame's requests, evaluates them all in
  // one pass right before the frame is drawn, copies the result into a buffer object behind a fence, and calls
  // cb(distances) in a later frame, once the GPU is done — the CPU never waits. Without float render targets (and in
  // the headless tests, where E.probe is a JS function) cb is called at once with E.probe(points).
  const PROBE_ROWS = 16, AP = { reqs: [], pending: [], free: [], gen: 0 };
  E.counts = { probeWait: 0, resize: 0, skipped: 0 };     // diagnostics: forced probe waits, new render sizes, frames skipped by the limit
  E.probeLater = function (points, cb) {
    if (!points.length) return;
    if (!E.asyncProbes || !E.gl || !E.world || !E.world.probeProg) { cb(E.probe(points)); return; }
    AP.reqs.push({ points, cb, gen: AP.gen });
  };
  // the frame's requests → one probe pass, read back into a buffer object (no waiting)
  function probeSubmit() {
    const gl = E.gl, w = E.world, p = w && w.probeProg;
    if (!AP.reqs.length || !p) return;
    while (AP.pending.length >= 3) { probeComplete(gl, AP.pending.shift(), true); E.counts.probeWait++; }   // the GPU is far behind: wait for the oldest
    probeSetup(gl, w, p);
    const slot = AP.free.pop() || { pbo: gl.createBuffer() }, jobs = [];
    let row = 0;
    for (const r of AP.reqs) {
      const job = { cb: r.cb, gen: r.gen, rows: [] };
      for (let i = 0; i < r.points.length && row < PROBE_ROWS; i += E.MAX_PROBES) {
        const n = Math.min(E.MAX_PROBES, r.points.length - i);
        probeRow(gl, p, r.points, i, n, row);
        job.rows.push([row++, n]);
      }
      jobs.push(job);
      if (row >= PROBE_ROWS) break;                    // more than PROBE_ROWS·64 points in one frame: the rest is dropped
    }
    AP.reqs.length = 0;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, slot.pbo);
    if (!slot.size) { gl.bufferData(gl.PIXEL_PACK_BUFFER, E.MAX_PROBES * PROBE_ROWS * 16, gl.STREAM_READ); slot.size = 1; }
    gl.readPixels(0, 0, E.MAX_PROBES, row, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    slot.rows = row; slot.jobs = jobs; slot.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    AP.pending.push(slot);
  }
  const probeOut = new Float32Array(64 * PROBE_ROWS * 4);
  function probeComplete(gl, slot, wait) {
    if (!wait) {
      const s = gl.clientWaitSync(slot.fence, 0, 0);
      if (s === gl.TIMEOUT_EXPIRED || s === gl.WAIT_FAILED) return false;
    }
    gl.deleteSync(slot.fence); slot.fence = null;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, slot.pbo);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, probeOut, 0, slot.rows * E.MAX_PROBES * 4);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    AP.free.push(slot);
    for (const j of slot.jobs) {
      if (j.gen !== AP.gen) continue;                  // asked for on another map
      const d = [];
      for (const [row, n] of j.rows) for (let i = 0; i < n; i++) d.push(probeOut[(row * E.MAX_PROBES + i) * 4]);
      j.cb(d);
    }
    slot.jobs = null;
    return true;
  }
  // results of earlier frames that the GPU has finished (start of a frame, before the world updates)
  function probeCollect() {
    const gl = E.gl;
    while (AP.pending.length && probeComplete(gl, AP.pending[0], false)) AP.pending.shift();
  }
  E.probeReset = () => { AP.gen++; AP.reqs.length = 0; };

  // ---------------- performance (HUD, the automatic resolution) ----------------
  // per frame, averaged over half a second: frame = time between frames, cpu = the game's own work in a frame
  // (update + issuing the draw), probe = waiting for distance probes (part of cpu), gpu = the world's draw on the GPU
  // (EXT_disjoint_timer_query_webgl2, when the browser offers it; results arrive a few frames late)
  E.perf = { frame: 0, cpu: 0, probe: 0, probeN: 0, gpu: 0, n: 0 };
  const perfAcc = { frame: 0, cpu: 0, probe: 0, probeN: 0, gpu: 0, gpuN: 0, n: 0, t: 0 };
  const gpuQ = { ext: null, pending: [], free: [] };
  function gpuBegin(gl) {
    if (!gpuQ.ext || gpuQ.pending.length > 4) return null;
    const q = gpuQ.free.pop() || gl.createQuery();
    gl.beginQuery(gpuQ.ext.TIME_ELAPSED_EXT, q);
    return q;
  }
  function gpuEnd(gl, q) { if (q) { gl.endQuery(gpuQ.ext.TIME_ELAPSED_EXT); gpuQ.pending.push(q); } }
  function gpuCollect(gl) {
    if (!gpuQ.ext) return;
    const lost = gl.getParameter(gpuQ.ext.GPU_DISJOINT_EXT);
    while (gpuQ.pending.length && gl.getQueryParameter(gpuQ.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = gpuQ.pending.shift();
      if (!lost) { perfAcc.gpu += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; perfAcc.gpuN++; }
      gpuQ.free.push(q);
    }
  }
  function perfFrame(frameMs, cpuMs, dt) {
    E.frameCpu = cpuMs;
    perfAcc.frame += frameMs; perfAcc.cpu += cpuMs; perfAcc.n++; perfAcc.t += dt;
    if (perfAcc.t < 0.5) return;
    const n = perfAcc.n;
    Object.assign(E.perf, { frame: perfAcc.frame / n, cpu: perfAcc.cpu / n, probe: perfAcc.probe / n, probeN: perfAcc.probeN / n,
      gpu: perfAcc.gpuN ? perfAcc.gpu / perfAcc.gpuN : 0, n: n });
    for (const k in perfAcc) perfAcc[k] = 0;
    autoRes(E.perf);
    if (E.onPerf) E.onPerf(E.perf);
  }

  // ---------------- automatic resolution: a steady frame rate ----------------
  // E.autoRes: twice a second the render scale follows the GPU time of the world's draw (the timer query; without it
  // the frame time), aiming at 80% of the frame budget of E.fpsTarget: down at once when too slow, up gently.
  // Every map remembers its own scale. E.fpsCap: frames are not drawn faster than E.fpsTarget (less heat on laptops).
  // Kept by js/video.js (menu → Obraz).
  Object.assign(E, { autoRes: true, fpsTarget: 60, fpsCap: true, resMin: 0.35, resMax: 1, resByWorld: {} });
  // after a map change or a new render size the next frames are slow for reasons of their own (warm-up, a new
  // drawing buffer): the controller waits that out
  let upT = 0;
  E.autoHold = 0;
  function autoRes(p) {
    if (!E.autoRes || !E.world || E._switching || !p.n || E.time < E.autoHold) return;
    const budget = 1000 / (E.fpsTarget || 60);
    let next = E.resScale;
    if (p.gpu > 0) {
      // the timer sees only the world's draw — the browser composes the page on the GPU too, and a frame that misses
      // a display refresh waits for the next one — so: the draw within 70% of the budget AND frames on time.
      // Nothing changes between the two thresholds (no see-saw between two sizes).
      const lg = p.gpu / (budget * 0.7), lf = p.frame / budget;
      if (lg > 1.12 || lf > 1.1) next = Math.max(E.resScale / Math.sqrt(Math.max(lg, lf, 1.15)), E.resScale * 0.8);   // too slow: down at once
      else if (lg < 0.8 && lf < 1.03) next = E.resScale + Math.min(0.03, E.resScale * (1 / Math.sqrt(Math.max(lg, 0.25)) - 1) * 0.5);
    } else {
      // no GPU timer: only the frame time is known — down when late, now and then a small step up to try
      upT += 0.5;
      if (p.frame > budget * 1.1) { next = E.resScale * 0.9; upT = -4; }
      else if (p.frame < budget * 1.03 && upT >= 2) { next = E.resScale + 0.02; upT = 0; }
    }
    next = WM.clamp(next, E.resMin, E.resMax);
    if (Math.abs(next - E.resScale) >= 0.01) { E.resScale = Math.round(next * 100) / 100; E.autoHold = E.time + 0.6; }
    E.resByWorld[E.worldIndex] = E.resScale;
  }

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
      E.probeReset();
      if (E.autoRes && E.resByWorld[i]) E.resScale = E.resByWorld[i];     // where this map ended last time
      E.autoHold = E.time + 1.5;
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
    // mouse buttons and the wheel go through the controls (js/input.js): LPM = Fire by default
    document.addEventListener('mousedown', e => { if (E.locked) WInput.press('Mouse' + e.button); });
    document.addEventListener('mouseup', e => { WInput.release('Mouse' + e.button); });
    document.addEventListener('mousemove', e => { if (E.locked) { E.mouseDX += e.movementX; E.mouseDY += e.movementY; } });
    // mouse wheel: fly up / down (the player hovers until it lands again); Ctrl + wheel: field of view
    c.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey) {
        E.fov = WM.clamp(E.fov * (e.deltaY > 0 ? 1.08 : 1 / 1.08), 0.3, 2.9);
        E.toast('FOV ' + Math.round(E.fov * 180 / Math.PI) + '°', 700);
      } else if (E.locked && e.deltaY) WInput.impulse(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!E.locked) return;   // menu open: the menu handles the keys
      E.keys[e.code] = true;
      if (e.repeat) return;
      if (e.code.startsWith('Digit')) {
        const n = +e.code.slice(5) || 10;   // 0 = map 10
        if (n <= E.worlds.length) E.switchWorld(n - 1);
      }
      if (e.code === 'KeyM' || e.code === 'Tab' || e.code === 'KeyH') E.unlock();
      if (e.code === 'KeyR' && E.world && E.world.bullets) WGun.reload();
      if (e.code === 'KeyP') { E.projMode = (E.projMode + 1) % E.PROJ_NAMES.length; E.toast('Projekcja: ' + E.PROJ_NAMES[E.projMode]); }
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {   // by hand: the automatic resolution turns off
        E.resScale = WM.clamp(Math.round((E.resScale + (e.code === 'BracketLeft' ? -0.1 : 0.1)) * 10) / 10, 0.25, 1.5);
        const was = E.autoRes;
        E.autoRes = false;
        if (E.onVideoChange) E.onVideoChange();
        E.toast('Rozdzielczość ' + Math.round(E.resScale * 100) + '%' + (was ? ' — automatyczna wyłączona (menu → Obraz)' : ''), was ? 2500 : 700);
      }
    });
    window.addEventListener('keyup', e => { E.keys[e.code] = false; });
    window.addEventListener('blur', () => { E.keys = {}; E.fireHeld = false; });
  };

  // keys, plus the analog value of a SpaceMouse axis bound to that pair (analog = false: keys only)
  E.analog = {};
  const ANALOG_OF = { KeyD: 'moveX', KeyW: 'moveY', Space: 'moveZ', KeyT: 'ana', KeyE: 'rotFW', KeyC: 'rotRW' };
  E.axis = (neg, pos, analog = true) => {
    const k = (E.keys[pos] ? 1 : 0) - (E.keys[neg] ? 1 : 0), a = analog && ANALOG_OF[pos] ? E.analog[ANALOG_OF[pos]] || 0 : 0;
    return a ? WM.clamp(k + a, -1, 1) : k;
  };

  // the offscreen target of a reduced render scale (as big as the canvas; reallocated only when the canvas is)
  const scene = { fb: null, tex: null, w: 0, h: 0 };
  function sceneTarget(gl, W, H) {
    if (!scene.fb) { scene.fb = gl.createFramebuffer(); scene.tex = gl.createTexture(); }
    if (scene.w !== W || scene.h !== H) {
      gl.bindTexture(gl.TEXTURE_2D, scene.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scene.tex, 0);
      scene.w = W; scene.h = H;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
  }

  // ---------------- loop ----------------
  let last0 = performance.now(), last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0, autoT = 0;
  let lastShown = 0, lastRaf = 0;
  E.refreshMs = 16.7;                      // the display's refresh interval (running median-ish estimate)
  E.frame = function (now) {
    const raw = now - lastRaf; lastRaf = now;
    if (raw > 2 && raw < 60) E.refreshMs += (Math.min(raw, E.refreshMs * 1.5) - E.refreshMs) * 0.05;
    // the frame limit: skip this refresh if the next frame is not due yet — only on displays clearly faster than the
    // target (144 Hz for 60 FPS), with half a refresh of slack (the callback times jitter)
    const due = E.fpsTarget ? 1000 / E.fpsTarget : 0;
    if (E.fpsCap && due && E.refreshMs < due * 0.75 && now - lastShown < due - E.refreshMs * 0.5) { E.counts.skipped++; requestAnimationFrame(E.frame); return; }
    lastShown = now;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    E.time += dt;
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = E.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    const last0prev = last0;
    E.maxFrameMs = Math.max(E.maxFrameMs || 0, now - last0); last0 = now;

    const gl = E.gl, w = E.world, t0 = performance.now();
    WInput.poll(dt);
    gpuCollect(gl);
    if (E.asyncProbes) probeCollect();
    if (w && w.prog) {
      const look = { dx: E.mouseDX * 0.0022, dy: E.mouseDY * 0.0022 };
      E.mouseDX = E.mouseDY = 0;
      WInput.look(look, dt);
      WMP.update(dt);
      w.update(dt, look);
      if (E.onFrame) E.onFrame(dt);
      WGun.update(dt);
      if (w.bullets) {
        if ((E.fireHeld || E.keys.Fire) && !WMP.dead() && (!w.canFire || w.canFire()) && WGun.tryFire()) {
          const aim = w.aim();
          w.bullets.fire(aim);
          WMP.shot(w, aim);
          if (window.WAudio) WAudio.shot(w);
          if (w.onFire) w.onFire();
        }
        w.bullets.update(dt);
      }

      probeSubmit();
      // Render size = the screen's real pixels × resScale (100% = native, e.g. all of a 4K monitor even with Windows
      // display scaling). The canvas keeps ONE size — the window × the highest scale the automatic resolution may use —
      // because resizing it reallocates the browser's drawing buffer (hundreds of ms at 4K: a hitch every time the
      // scale changed). Below that the world is drawn into a corner of an offscreen target and scaled onto the canvas
      // (blitFramebuffer), so a new render scale costs nothing.
      const dpr = window.devicePixelRatio || 1, top = E.autoRes ? Math.max(E.resMax, E.resScale) : E.resScale;
      const W = Math.max(1, Math.floor(window.innerWidth * dpr * top)), H = Math.max(1, Math.floor(window.innerHeight * dpr * top));
      if (E.canvas.width !== W || E.canvas.height !== H) { E.canvas.width = W; E.canvas.height = H; E.counts.resize++; }
      const cw = Math.max(1, Math.min(W, Math.floor(window.innerWidth * dpr * E.resScale)));
      const ch = Math.max(1, Math.min(H, Math.floor(window.innerHeight * dpr * E.resScale)));
      E.renderW = cw; E.renderH = ch;
      const scaled = cw !== W || ch !== H;
      if (scaled) sceneTarget(gl, W, H);
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
      const q = gpuBegin(gl);
      if (w.drawViews && w.drawViews(gl, w.prog, cw, ch)) gl.viewport(0, 0, cw, ch);   // split screen (4D)
      else gl.drawArrays(gl.TRIANGLES, 0, 3);
      gpuEnd(gl, q);
      if (scaled) {                              // the drawn corner → the whole canvas
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, scene.fb);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.blitFramebuffer(0, 0, cw, ch, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.LINEAR);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      perfFrame(now - last0prev, performance.now() - t0, dt);
      if (E.afterDraw) E.afterDraw();

      // optional 2D overlays of the world: a corner panel (e.g. the 4D compass; drawOverlay may return false to hide it),
      // the axis gizmo (4D maps) and a full-screen layer (labels in the tutorial)
      const mini = document.getElementById('mini');
      if (w.drawOverlay) {
        const sz = w.overlaySize || [300, 300];
        if (mini.width !== sz[0] || mini.height !== sz[1]) { mini.width = sz[0]; mini.height = sz[1]; mini.style.width = sz[0] + 'px'; mini.style.height = sz[1] + 'px'; }
        const ctx = mini.getContext('2d');
        ctx.clearRect(0, 0, mini.width, mini.height);
        mini.style.display = w.drawOverlay(ctx, mini.width, mini.height, dt) === false ? 'none' : 'block';
      } else mini.style.display = 'none';
      for (const [id, fn, full] of [['gizmo', 'drawGizmo', false], ['layer', 'drawLayer', true]]) {
        const cv = document.getElementById(id);
        if (!cv) continue;
        if (!w[fn]) { cv.style.display = 'none'; continue; }
        cv.style.display = 'block';
        if (full && (cv.width !== window.innerWidth || cv.height !== window.innerHeight)) { cv.width = window.innerWidth; cv.height = window.innerHeight; }
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        w[fn](ctx, cv.width, cv.height, dt);
      }

      autoT += dt;
      if (autoT > 0.25) {
        autoT = 0;
        const s = w.stats ? w.stats() : '';
        document.getElementById('hudStats').textContent =
          `${fps.toFixed(0)} FPS · ${cw}×${ch} (${Math.round(E.resScale * 100)}%${E.autoRes ? ' auto' : ''}) · ${E.PROJ_NAMES[E.projMode]}` +
          (E.perf.gpu ? ` · GPU ${E.perf.gpu.toFixed(1)} ms` : '') + ` · CPU ${E.perf.cpu.toFixed(1)} ms (sondy ${E.perf.probe.toFixed(1)})` + (s ? '\n' + s : '');
      }
    }
    requestAnimationFrame(E.frame);
  };

  window.WE = E;
})();
