// 3D compass for a 4D world. "Up" (y) never rotates in the 4D worlds, so all turning and moving happens in the
// horizontal space (x, z, w) — which is 3-dimensional. The compass draws that space as a small 3D model:
// the minimap's floor is the real x/z plane, its vertical axis is W.
// Shown: axes, the player with a trail, the 2D floor of the 3D slice you currently see (a plane in xzw),
// your forward direction, the hidden direction (normal of the slice = "into W"), and landmarks.
(function () {
  const COL = { x: '#ff6b6b', z: '#5aa9ff', w: '#e070ff', fwd: '#ffd24a', slice: 'rgba(120,220,255,', kata: '#e070ff' };

  class Compass4D {
    // landmarks: [{ label, color, box: [[x0,x1],[z0,z1],[w0,w1]] } | { label, color, at: [x,z,w], r }]
    constructor(landmarks) {
      this.marks = landmarks; this.trail = []; this.trailT = 0;
      this.follow = true; this.view = 0; this.range = 12;
    }
    reset() { this.trail = []; }

    draw(ctx, W, H, dt, player) {
      const pos = player.pos, fr = player.frame;           // frame: [right, forward, kata], 4D vectors (x,y,z,w)
      const P = [pos[0], pos[2], pos[3]];                   // player in (x, z, w)
      const h = v => [v[0], v[2], v[3]];
      const right = h(fr[0]), fwd = h(fr[1]), kata = h(fr[2]);

      // trail (one point every 0.15 s)
      this.trailT += dt;
      if (this.trailT > 0.15) { this.trailT = 0; this.trail.push(P.slice()); if (this.trail.length > 120) this.trail.shift(); }

      // minimap camera: orbit around the player; in follow mode it looks along your forward (projected to xz)
      const target = this.follow ? Math.atan2(fwd[0], fwd[1]) : 0.6;
      let d = target - this.view; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.view += d * Math.min(1, dt * 4);
      const yaw = this.view, pitch = 0.55, S = W * 0.36 / this.range;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      // (x, z, w) -> screen; the camera sits behind and above the player
      const proj = q => {
        const a = q[0] - P[0], b = q[1] - P[1], c = q[2] - P[2];
        const xr = a * cy - b * sy, zr = a * sy + b * cy;     // rotate around the W (vertical) axis
        const yv = c * cp - zr * sp, depth = c * sp + zr * cp;
        const k = 1 / (1 + depth * 0.012);
        return [W / 2 + xr * S * k, H * 0.56 - yv * S * k, depth];
      };
      const line = (a, b, color, width = 1, dash) => {
        const p = proj(a), q = proj(b);
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      };
      const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
      const label = (q, text, color) => { const p = proj(q); ctx.fillStyle = color; ctx.fillText(text, p[0] + 4, p[1] - 3); };

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      ctx.font = '11px Consolas, monospace';

      // ground grid of the xz plane at w = your w (the "floor" of the compass), 4 m spacing
      const R = this.range, g0x = Math.round(P[0] / 4) * 4, g0z = Math.round(P[1] / 4) * 4;
      for (let k = -R; k <= R; k += 4) {
        line([g0x + k, g0z - R, P[2]], [g0x + k, g0z + R, P[2]], 'rgba(255,255,255,.07)');
        line([g0x - R, g0z + k, P[2]], [g0x + R, g0z + k, P[2]], 'rgba(255,255,255,.07)');
      }
      // W = 0 level (where most of the map lives), if different from yours
      if (Math.abs(P[2]) > 0.3) {
        for (let k = -R; k <= R; k += 8) line([g0x + k, g0z - R, 0], [g0x + k, g0z + R, 0], 'rgba(224,112,255,.10)');
        line([P[0], P[1], P[2]], [P[0], P[1], 0], 'rgba(224,112,255,.5)', 1, [3, 3]);
      }

      // landmarks
      for (const m of this.marks.concat(this.extra || [])) {
        if (m.box) {
          const [[x0, x1], [z0, z1], [w0, w1]] = m.box;
          const c = [[x0, z0, w0], [x1, z0, w0], [x1, z1, w0], [x0, z1, w0], [x0, z0, w1], [x1, z0, w1], [x1, z1, w1], [x0, z1, w1]];
          for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) line(c[i], c[j], m.color, 1.2);
          label(c[6], m.label, m.color);
        } else {
          const p = proj(m.at), r = Math.max(2, m.r * S / (1 + p[2] * 0.012));
          ctx.strokeStyle = m.color; ctx.lineWidth = 1.2; ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.stroke();
          if (m.fill) { ctx.fillStyle = m.color; ctx.fill(); line(m.at, [m.at[0], m.at[1], P[2]], m.color, 1, [2, 3]); }
          if (m.label) label(m.at, m.label, m.color);
        }
      }

      // trail
      for (let i = 1; i < this.trail.length; i++)
        line(this.trail[i - 1], this.trail[i], `rgba(255,255,255,${0.1 + 0.5 * i / this.trail.length})`);

      // the floor of your current 3D slice: the plane spanned by right and forward (in xzw)
      const s = 5, c4 = [add(add(P, right, -s), fwd, -s), add(add(P, right, s), fwd, -s), add(add(P, right, s), fwd, s), add(add(P, right, -s), fwd, s)].map(proj);
      ctx.fillStyle = COL.slice + '0.2)'; ctx.strokeStyle = COL.slice + '0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath(); c4.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();

      // direction arrows from the player
      const arrow = (dir, len, color, text) => {
        const e = add(P, dir, len);
        line(P, e, color, 2.5);
        const p = proj(e); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill();
        if (text) label(e, text, color);
      };
      arrow(kata, 5, COL.kata, 'ana (T)');
      arrow(right, 3.5, 'rgba(255,255,255,.6)', '');
      arrow(fwd, 6, COL.fwd, 'przód');
      const pp = proj(P);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pp[0], pp[1], 4, 0, Math.PI * 2); ctx.fill();

      // world axes gizmo (bottom-left)
      const gx = 36, gy = H - 34, gs = 20;
      const gz = v => { const xr = v[0] * cy - v[1] * sy, zr = v[0] * sy + v[1] * cy; return [gx + xr * gs, gy - (v[2] * cp - zr * sp) * gs]; };
      for (const [v, col, t] of [[[1, 0, 0], COL.x, 'X'], [[0, 1, 0], COL.z, 'Z'], [[0, 0, 1], COL.w, 'W']]) {
        const e = gz(v);
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(e[0], e[1]); ctx.stroke();
        ctx.fillStyle = col; ctx.fillText(t, e[0] + 2, e[1] - 2);
      }

      // numbers: how much of your view lies in W
      const tilt = Math.asin(WM.clamp(fwd[2], -1, 1)) * 180 / Math.PI;
      const sliceTilt = Math.acos(WM.clamp(Math.abs(kata[2]), 0, 1)) * 180 / Math.PI;
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText(`KOMPAS 4D  (pion mapki = oś W)`, 8, 14);
      ctx.fillStyle = COL.fwd; ctx.fillText(`przód: ${tilt >= 0 ? '+' : ''}${tilt.toFixed(0)}° w stronę W`, 8, 28);
      ctx.fillStyle = COL.slice + '0.9)'; ctx.fillText(`przekrój odchylony od W=const o ${sliceTilt.toFixed(0)}°`, 8, 42);
      ctx.fillStyle = COL.w; ctx.fillText(`w = ${P[2].toFixed(2)}`, W - 70, 14);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillText(this.follow ? 'B: widok stały' : 'B: widok za tobą', W - 104, H - 8);
      ctx.restore();
    }
  }
  window.WCompass4D = Compass4D;
})();
