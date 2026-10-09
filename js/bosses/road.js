'use strict';
/* ROAD: pseudo-3D forest rally (after Smooth Moves' "Driver's Ed" / Gold's "Road Wario").
   The car drives itself; steer to stay on the winding road. Curves fling you outward, so counter-steer.
   Off the road = wipeout. Reach the FINISH banner = win. */
(() => {
  const SEG = 100, RW = 680, CAMH = 1000, F = 285, Z0 = 1000, HZ = 250, DRAW = 170, CURV = 3, CAMF = .35;
  const PXK = RW * (F / Z0) * (1 - CAMF);                      // screen px per road half-width at the car
  // pointer: car is pulled toward the finger (G) and bends push it outward (D); a finger parked mid-road can't hold the sharp bend.
  // keys: slower, smoother steering (SK, KR) with a softer push (DK) so a ~300 ms human reaction is enough.
  const G = 2.5, SMAX = 5, D = 2.4, SK = 2, KR = 9, DK = 1, AH = 15;
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const HAZE = rgb('#cfeee6'), mix = (c, f) => `rgb(${c.map((v, i) => v + (HAZE[i] - v) * f | 0)})`;
  const C = { g1: rgb('#62c24d'), g2: rgb('#54b042'), r1: rgb('#ffffff'), r2: rgb('#e8433a'), a1: rgb('#6f6d7c'), a2: rgb('#676575'), ink: rgb('#14101c') };
  const smooth = u => u * u * (3 - 2 * u);
  /* ---- DUO-look mini kit (draws on the global ctx; decor randomness is a hash, never the game RNG) ---- */
  const TAU = Math.PI * 2, hz = i => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const rrP = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
  const elP = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, TAU); return p; };
  const inkP = (p, fill, o = 4) => { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; if (o) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.stroke(p); } if (fill) { ctx.fillStyle = fill; ctx.fill(p); } };
  const celP = (p, base, shade, sx, sy, o = 4) => { inkP(p, shade, o); ctx.save(); ctx.clip(p); ctx.translate(-sx, -sy); ctx.fillStyle = base; ctx.fill(p); ctx.restore(); };
  const glintP = (p, x, y, rx, ry, col, rot = 0) => { ctx.save(); ctx.clip(p); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); ctx.restore(); };
  const outBack = u => { const c = 1.70158; u = Math.max(0, Math.min(1, u)); return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  const heartP = (x, y, k) => { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); const p = new Path2D('M0 8C-18-4-12-20 0-10C12-20 18-4 0 8Z'); inkP(p, '#ff5c8a', 3); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-6, -9, 3, 2, -.6, 0, TAU); ctx.fill(); ctx.restore(); };
  let SKYC = null;                                              // baked sky gradient (the only fully static layer), rebuilt if the canvas width changes
  const skyBake = () => { if (SKYC && SKYC.width === VW) return SKYC; SKYC = document.createElement('canvas'); SKYC.width = VW; SKYC.height = HZ + 4; const x = SKYC.getContext('2d'); const sk = x.createLinearGradient(0, 0, 0, HZ); sk.addColorStop(0, '#36b0ea'); sk.addColorStop(.55, '#86d8fb'); sk.addColorStop(1, '#d6f7ff'); x.fillStyle = sk; x.fillRect(0, 0, VW, HZ + 4); return SKYC; };

  BOSSES.road = function (sp, s) {
    const kk = Math.min(sp, 1.3), V = 3350 + 200 * kk;
    // course: [straight] or [enter, hold, leave, curve]; a gentle opener, one hard left, then an S with a breather between halves
    const curve = [], plan = [[20], [20, 6, 30, .5], [12], [20, 34, 32, -1.12], [8], [20, 22, 32, 1.1], [8], [20, 20, 32, -1.1], [8]];
    for (const p of plan) {
      if (p.length === 1) { for (let i = 0; i < p[0]; i++) curve.push(0); continue; }
      const [a, h, l, c] = p;
      for (let i = 0; i < a; i++) curve.push(c * smooth(i / a));
      for (let i = 0; i < h; i++) curve.push(c);
      for (let i = 0; i < l; i++) curve.push(c * smooth(1 - i / l));
    }
    const FIN = curve.length; for (let i = 0; i < DRAW + 40; i++) curve.push(0);
    const N = curve.length, Y = [];
    for (let i = 0; i <= N; i++) Y.push(380 * (1 - Math.cos(i * Math.PI * 2 / 150)) * Math.min(1, i / 40));
    const roadY = z => { const i = Math.max(0, Math.min(N - 1, Math.floor(z / SEG))), f = z / SEG - i; return Y[i] + (Y[i + 1] - Y[i]) * f; };
    // scenery: trees + bushes on both shoulders, chevron boards on the outside of each curve, the finish banner
    const spr = curve.map(() => []);
    for (let i = 4; i < N; i += 2) {
      const side = (i >> 1) & 1 ? 1 : -1, far = Math.random() < .45;
      spr[i].push({ x: side * (far ? 2.6 + Math.random() * 4 : 1.55 + Math.random() * .9), k: Math.random() < .68 ? 'pine' : 'bush', v: Math.random() });
    }
    for (let i = 1; i < FIN; i++) if (curve[i] && !curve[i - 1]) for (let j = 0; j < 4; j++) spr[i + 2 + j * 5].push({ x: -Math.sign(curve[i]) * 1.38, k: 'sign', v: Math.sign(curve[i]) });
    spr[FIN].push({ k: 'fin' });
    const st = { z: Z0 + 2 * SEG, v: V * .55, px: 0, vx: 0, tgt: 0, ptr: false, acc: 99, lx: null, spin: 0, sq: 0, sky: 0, eng: 0, rum: 0, cin: false, crash: 0, t0: null, cx0: 0 }, puffs = [];
    const segAt = z => Math.max(0, Math.min(N - 1, Math.floor(z / SEG)));
    const Dm = () => st.ptr ? D : DK;
    const drift = () => curve[segAt(st.z)] * Dm() * (st.v / V);
    // time to the line; the fuse is sized so it never turns red before it (distance is the goal, not time)
    let tFin = 0; for (let z = st.z, v = st.v; z < FIN * SEG; tFin += 1 / 60) { z += v / 60; v += (V - v) * .05; }
    const puff = (x, y, r, col, vy) => puffs.push({ x, y, r, col, vx: (Math.random() - .5) * 60, vy, life: .6 + Math.random() * .3, t: 0 });
    const carX = () => W / 2 + st.px * PXK;
    const crash = () => {
      g.result = 'lose'; st.t0 = now; st.cx0 = carX(); st.crash = 1; st.spin = Math.sign(st.px) * 14; sfx.thud(); sfx.buzz(); noise(.5, .12, 900, 120); shake(14, .45);
      burst(carX(), 500, '#8a6b4a', 18, 320); ring(carX(), 500, '#fff', 110); floatText('WIPEOUT!', carX(), 420, '#FFE14D', 46);
      for (let i = 0; i < 10; i++) puff(carX() + (Math.random() - .5) * 120, 520, 20 + Math.random() * 18, '#5a5466', -60 - Math.random() * 80);
    };
    const g = {
      cmd: 'BOSS!', hint: 'STEER! STAY ON THE ROAD!', thint: 'DRAG TO STEER!', dur: tFin / .72, timeWin: true, boss: true, wide: true,
      // a resting mouse brushed by a keyboard player doesn't steal the wheel: it must travel 40 px quickly (acc leaks 60 px/s)
      move(p) { if (g.result) return; const dx = st.lx == null ? 0 : Math.abs(p.x - st.lx); st.lx = p.x; if (!st.ptr && (st.acc += dx) < 40) return; st.ptr = true; st.tgt = Math.max(-1.7, Math.min(1.7, (p.x - W / 2) / PXK)); },
      down(p) { st.acc = 99; g.move(p); },
      key(e) { if (/Arrow(Left|Right)|Key[AD]/.test(e.code) && !g.result) { st.ptr = false; st.acc = 0; sfx.tick(); } },
      update(dt) {
        st.sq = Math.max(0, st.sq - dt * 3); st.sky -= curve[segAt(st.z)] * (st.v / V) * dt * 40;
        for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += 30 * dt; if (q.t > q.life) puffs.splice(i, 1); }
        if (g.result === 'lose') { st.v *= Math.pow(.08, dt); st.z += st.v * dt; st.px = Math.max(-1.8, Math.min(1.8, st.px + st.vx * dt)); st.vx *= Math.pow(.02, dt); st.spin *= Math.pow(.25, dt); st.crash += st.spin * dt; return; }
        st.z += st.v * dt;
        if (g.result === 'win') { st.v *= Math.pow(.35, dt); return; }
        st.v += (V - st.v) * Math.min(1, 3 * dt);
        const kd = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
        if (kd) { st.ptr = false; st.acc = 0; } else if (!st.ptr) st.acc = Math.max(0, st.acc - 60 * dt);
        const want = st.ptr ? Math.max(-SMAX, Math.min(SMAX, (st.tgt - st.px) * G)) : kd * SK;
        st.vx += (want - st.vx) * Math.min(1, (st.ptr ? 14 : KR) * dt);
        st.px += (st.vx - drift()) * dt;
        const c = curve[segAt(st.z)];
        if (!!c !== st.cin) { st.cin = !!c; if (c) sfx.whoosh(); }
        st.eng -= dt; if (st.eng < 0) { st.eng = .09; snd(70 + 50 * st.v / V + Math.abs(st.vx) * 6, .1, 'sawtooth', .022); puff(carX() + 34 + st.px * 0, 515, 6, '#d8d4e0', -40); }
        if (Math.abs(st.px) > .8) { st.rum -= dt; if (st.rum < 0) { st.rum = .08; noise(.07, .06, 260); shake(2, .08); st.sq = .4; } }
        if (Math.abs(st.px) > 1) return crash();
        if (st.z >= FIN * SEG) {
          g.result = 'win'; st.t0 = now; sfx.sparkle(); sfx.coin(); confetti(W / 2, 260, 60); shake(8, .3); ring(W / 2, 300, '#FFE14D', 240, .6); floatText('FINISH!', W / 2, 330, '#FFE14D', 64);
        }
      },
      draw(t) {
        // sky, sun with turning rays, clouds, a hot-air-balloon sheep, far range + hills (parallax on curves)
        ctx.drawImage(skyBake(), -OX, 0);
        const sx0 = W / 2 + 230 + st.sky * .3 % 40, sy0 = 188;
        ctx.fillStyle = 'rgba(255,240,150,.45)';
        for (let i = 0; i < 12; i++) { const a0 = t * .25 + i * TAU / 12, a1 = a0 + TAU / 24; ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx0 + Math.cos(a0) * 96, sy0 + Math.sin(a0) * 96); ctx.lineTo(sx0 + Math.cos(a1) * 96, sy0 + Math.sin(a1) * 96); ctx.fill(); }
        circ(sx0, sy0, 33, '#ffe14d', 4); ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.ellipse(sx0 - 10, sy0 - 11, 10, 6, -.5, 0, TAU); ctx.fill();
        for (let i = 0; i < 6; i++) {
          const cx = ((i * 260 + st.sky * .5 - t * 8) % (VW + 300) + VW + 300) % (VW + 300) - OX - 150, cy = 150 + (i % 3) * 22;
          for (const [dx, r] of [[-30, 18], [0, 26], [30, 18]]) { ctx.beginPath(); ctx.arc(cx + dx, cy, r, 0, 7); ctx.lineWidth = 6; ctx.strokeStyle = '#7fa8dc'; ctx.stroke(); }
          for (const [dx, r] of [[-30, 18], [0, 26], [30, 18]]) { ctx.fillStyle = '#e4f5ff'; ctx.beginPath(); ctx.arc(cx + dx, cy, r, 0, 7); ctx.fill(); }
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - 3, cy - 5, 16, 0, 7); ctx.fill();
        }
        for (const [k, col, ol, hgt, par] of [[0, '#c9d0fb', '#7b80c6', 70, .4], [1, '#87d19b', '#4f9a6a', 44, .8]]) {
          ctx.fillStyle = col; ctx.strokeStyle = ol; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-OX, HZ + 4);
          for (let x = -OX; x <= W + OX + 20; x += 20) { const u = (x - st.sky * par) / 90 + k * 3; ctx.lineTo(x, HZ - hgt * (.55 + .3 * Math.sin(u) + .15 * Math.sin(u * 2.7))); }
          ctx.lineTo(W + OX, HZ + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        balloon(t);
        ctx.fillStyle = INK; ctx.fillRect(-OX, HZ - 2, VW, 4);
        ctx.fillStyle = mix(C.g2, .7); ctx.fillRect(-OX, HZ, VW, H - HZ);
        // project segments (near → far), then paint far → near
        const camZ = st.z - Z0, camY = roadY(st.z) + CAMH, camX = st.px * RW * CAMF, base = Math.floor(camZ / SEG), P = [];
        let x = 0, dx = 0; const xs = [];
        for (let n = 0; n <= DRAW && base + n <= N; n++) { xs.push(x); x += dx; dx += curve[Math.min(N - 1, base + n)] * CURV; }
        const zc = (st.z / SEG - base), i0 = Math.floor(zc), xc = xs[i0] + (xs[i0 + 1] - xs[i0]) * (zc - i0), sl = xs[i0 + 1] - xs[i0];
        for (let n = 0; n < xs.length; n++) {
          const z = (base + n) * SEG, cz = z - camZ, sc = F / Math.max(1, cz);
          P.push({ cz, sc, x: W / 2 + (xs[n] - xc - sl * (base + n - st.z / SEG) - camX) * sc, y: Math.round(HZ + (camY - Y[Math.min(N, base + n)]) * sc), w: RW * sc, xr: xs[n] - xc - sl * (base + n - st.z / SEG) });
        }
        const quad = (a, b, ka, kb, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a.x - a.w * ka, a.y); ctx.lineTo(a.x + a.w * ka, a.y); ctx.lineTo(b.x + b.w * kb, b.y); ctx.lineTo(b.x - b.w * kb, b.y); ctx.fill(); };
        for (let n = P.length - 2; n >= 0; n--) {
          const a = P[n], b = P[n + 1], i = base + n; if (a.cz < 40) continue;
          const f = Math.min(1, Math.max(0, (b.cz - 2500) / (DRAW * SEG - 2500))) ** 1.2, lt = (i / 3 | 0) % 2;
          if (a.y > b.y) {
            ctx.fillStyle = mix(lt ? C.g1 : C.g2, f); ctx.fillRect(-OX, b.y, VW, a.y - b.y);
            quad(a, b, 1.2 + 4 / a.w, 1.2 + 4 / b.w, mix(C.ink, f));
            quad(a, b, 1.17, 1.17, mix(lt ? C.r1 : C.r2, f));
            quad(a, b, 1, 1, mix(lt ? C.a1 : C.a2, f));
            if (i === FIN || i === FIN + 1) for (let c = 0; c < 10; c++) { ctx.fillStyle = (c + i) % 2 ? '#fff' : INK; ctx.beginPath(); const u0 = -1 + c * .2, u1 = u0 + .2; ctx.moveTo(a.x + a.w * u0, a.y); ctx.lineTo(a.x + a.w * u1, a.y); ctx.lineTo(b.x + b.w * u1, b.y); ctx.lineTo(b.x + b.w * u0, b.y); ctx.fill(); }
            else if (lt) quad(a, b, .035, .035, mix(rgb('#fff6c8'), f));
          }
          ctx.globalAlpha = 1 - f;
          for (const o of spr[i] || []) drawSprite(o, a);
          ctx.globalAlpha = 1;
        }
        // exhaust / smoke behind the car
        for (const q of puffs) { ctx.globalAlpha = .7 * (1 - q.t / q.life); circ(q.x, q.y, q.r, q.col, 2); } ctx.globalAlpha = 1;
        // pointer aim ghost: where the finger is steering (the car trails it in bends)
        if (st.ptr && !g.result) { const ax = W / 2 + st.tgt * PXK; ctx.globalAlpha = .55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(carX(), 520); ctx.lineTo(ax, 520); ctx.stroke(); ctx.setLineDash([]); circ(ax, 520, 13, '#FFE14D', 4); ctx.globalAlpha = 1; }
        // the car
        const lose = g.result === 'lose', win = g.result === 'win';
        if ((lose || win) && st.t0 == null) st.t0 = now;
        const T = st.t0 == null ? 0 : Math.max(0, now - st.t0), bob = win ? Math.abs(Math.sin(T * 9)) * -14 * Math.max(0, 1 - T * .6) : g.result ? 0 : Math.sin(now * 38) * (Math.abs(st.px) > .8 ? 3 : .8);
        if (win) fireworks(T);
        drawCar(carX(), 520 + bob, lose ? st.crash : st.vx * .035, st.sq, lose ? 'sad' : win ? 'happy' : Math.abs(st.px) > .8 ? 'panic' : null, T);
        if (!g.result && Math.abs(st.px) > .8 && now % .25 < .15) { const wx = carX() + Math.sign(st.px) * 90; ctx.save(); ctx.translate(wx, 440); ctx.rotate(.08 * Math.sign(st.px)); inkP(new Path2D('M0-34L32 22L-32 22Z'), '#ff4d5e', 4); ctx.restore(); txt('!', wx, 446, 34, '#fff'); }
        if (lose) {
          for (let k = 0; k < 3; k++) { const a = now * 5 + k * 2.1; star(carX() + Math.cos(a) * 46, 432 + Math.sin(a) * 12, 12, 5, 5, a, '#FFE14D', 3); }
          // a wheel pops off and bounces away from the wreck
          const dir = st.cx0 >= W / 2 ? 1 : -1, wx = st.cx0 + dir * T * 260, wy = 490 - Math.abs(Math.sin(T * 7)) * 90 * Math.max(0, 1 - T * .7), wr = 17;
          ctx.save(); ctx.translate(wx, wy); ctx.rotate(dir * T * 14); inkP(elP(0, 0, wr, wr), '#2a2533', 4); inkP(elP(0, 0, wr * .45, wr * .45), '#c9ced6', 2.5); ctx.fillStyle = '#5a5274'; for (let k = 0; k < 6; k++) { ctx.save(); ctx.rotate(k * TAU / 6); ctx.fillRect(wr * .62, -2.5, wr * .3, 5); ctx.restore(); } ctx.restore();
        }
        if (win) for (let k = 0; k < 5; k++) { const u = ((T * 1.1 + k * .21) % 1), hx = carX() + Math.sin(k * 2.3 + T * 3) * 70 + (k - 2) * 30; ctx.globalAlpha = Math.min(1, (1 - u) * 2); heartP(hx, 420 - u * 130, .9 + (k % 2) * .25); ctx.globalAlpha = 1; }
        // HUD: a wooden plank with a progress track; a mini rally car drives to the checkered flag
        const prog = Math.max(0, Math.min(1, (st.z - Z0 - 2 * SEG) / (FIN * SEG - Z0 - 2 * SEG)));
        const pl = rrP(W / 2 - 222, 78, 444, 62, 16);
        ctx.save(); ctx.translate(4, 7); ctx.fillStyle = 'rgba(20,16,28,.3)'; ctx.fill(pl); ctx.restore();
        celP(pl, '#d9944f', '#a5622c', 0, 6, 4);
        ctx.strokeStyle = '#c98443'; ctx.lineWidth = 2; for (const gy of [92, 126]) { ctx.beginPath(); ctx.moveTo(W / 2 - 210, gy); ctx.bezierCurveTo(W / 2 - 100, gy - 3, W / 2 + 60, gy + 3, W / 2 + 210, gy); ctx.stroke(); }
        const tk = rrP(W / 2 - 196, 88, 392, 16, 8); inkP(tk, '#2b2540', 3);
        if (prog > 0) { ctx.save(); ctx.clip(tk); ctx.fillStyle = '#ffe14d'; ctx.fillRect(W / 2 - 196, 88, 392 * prog + 6, 16); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(W / 2 - 196, 90, 392 * prog + 6, 4); ctx.restore(); }
        for (let k = 1; k < 4; k++) { ctx.fillStyle = 'rgba(20,16,28,.5)'; ctx.fillRect(W / 2 - 196 + 392 * k / 4 - 1, 88, 2, 16); }
        const fx = W / 2 + 214, fy = 96; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx, fy + 10); ctx.lineTo(fx, fy - 18); ctx.stroke();
        ctx.save(); ctx.translate(fx, fy - 18); const wv = Math.sin(now * 8) * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, wv); ctx.lineTo(22, 12 + wv); ctx.lineTo(0, 12); ctx.closePath(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.fillStyle = INK; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) if ((r + c) % 2 === 0) ctx.fillRect(c * 7.3, r * 6 + (c / 3) * wv, 7.3, 6); ctx.restore();
        const mx = W / 2 - 196 + 392 * prog; ctx.save(); ctx.translate(mx, 90 + Math.sin(now * 20) * .8);
        { const bd = rrP(-11, -10, 22, 13, 5); celP(bd, '#4DB8FF', '#2f86d6', 0, -3, 2.5); ctx.fillStyle = OR; ctx.fillRect(-5, -16, 10, 7); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-5, -16, 10, 7); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-8, 3, 3.4, 0, TAU); ctx.arc(8, 3, 3.4, 0, TAU); ctx.fill(); }
        ctx.restore();
        txt('FOREST RALLY', W / 2, 123, 19, INK, 'center', 300);
        vignette(.3);
        function drawSprite(o, a) {
          const sc = a.sc, gx = a.x + o.x * RW * sc, gy = a.y;
          if (o.k === 'fin') {
            const l = a.x - a.w * 1.28, r = a.x + a.w * 1.28, top = gy - 1350 * sc, bot = gy - 1000 * sc, pw = Math.max(3, 40 * sc);
            for (const px of [l, r]) box(px - pw / 2, top, pw, gy - top, '#fff', Math.max(2, 6 * sc));
            box(l, top, r - l, bot - top, '#fff', Math.max(2, 8 * sc));
            const cs = (bot - top) / 4, nc = Math.ceil((r - l) / cs);
            for (let c = 0; c < nc; c++) for (const rr of [0, 3]) { ctx.fillStyle = (c + rr) % 2 ? INK : '#fff'; ctx.fillRect(l + c * cs, top + rr * cs, Math.min(cs, r - l - c * cs), cs); }
            if (sc > .006) txt('FINISH', a.x, (top + bot) / 2, (bot - top) * .42, '#FF4D4D', 'center', r - l);
            return;
          }
          if (gx < -OX - 400 * sc * 4 || gx > W + OX + 400 * sc * 4 || sc < .004) return;
          const o2 = Math.max(1.5, 7 * sc);
          if (o.k === 'pine') {
            const h = (1100 + o.v * 600) * sc, w = h * .5, lite = o.v > .5, bs = lite ? '#2f8a4a' : '#3a9c4f', sh = lite ? '#1f6a38' : '#2a7f3f';
            box(gx - w * .08, gy - h * .25, w * .16, h * .25, '#8a5a34', o2);
            if (sc > .01) { ctx.fillStyle = '#5e3a1e'; ctx.fillRect(gx + w * .02, gy - h * .25, w * .06, h * .25); }
            for (let j = 0; j < 3; j++) {
              const yb = gy - h * (.18 + j * .25), ww = w * (1 - j * .22), ty = yb - h * .42;
              ctx.beginPath(); ctx.moveTo(gx - ww / 2, yb); ctx.lineTo(gx + ww / 2, yb); ctx.lineTo(gx, ty); ctx.closePath();
              ctx.lineJoin = 'round'; ctx.lineWidth = o2 * 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = bs; ctx.fill();
              if (sc > .008) {
                ctx.fillStyle = sh; ctx.beginPath(); ctx.moveTo(gx + ww / 2, yb); ctx.lineTo(gx + ww * .08, yb); ctx.lineTo(gx, ty); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(gx - ww * .36, yb - h * .03); ctx.lineTo(gx - ww * .2, yb - h * .03); ctx.lineTo(gx - ww * .02, ty + h * .08); ctx.closePath(); ctx.fill();
              }
            }
          } else if (o.k === 'bush') {
            const r = (170 + o.v * 90) * sc, pink = o.v > .7, bc = pink ? '#e86aa8' : '#4fae46', bsh = pink ? '#c24c88' : '#388c35';
            const cow = o.v < .16 && sc > .02;
            if (cow) peekCow(gx, gy - r * 2.35, r * 1.05, o.v);
            for (const [dx, dy, k] of [[-1, -.7, .8], [1, -.7, .8], [0, -1.1, 1]]) {
              circ(gx + dx * r * .9, gy + dy * r, r * k, bsh, o2);
              ctx.fillStyle = bc; ctx.beginPath(); ctx.arc(gx + dx * r * .9 - r * k * .12, gy + dy * r - r * k * .12, r * k * .86, 0, 7); ctx.fill();
              if (sc > .012) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(gx + dx * r * .9 - r * k * .35, gy + dy * r - r * k * .45, r * k * .24, r * k * .12, -.5, 0, 7); ctx.fill(); }
            }
          } else {
            const h = 520 * sc, w = 300 * sc;
            box(gx - w * .06, gy - h, w * .12, h, '#d9dde6', o2);
            const pl = rrP(gx - w / 2, gy - h - w * .7, w, w * .8, Math.max(1, w * .12)); celP(pl, '#FFE14D', '#e0b520', 0, w * .08, o2);
            ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, w * .1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            for (const d of [-.2, .15]) { const cx = gx + d * w * o.v, cy = gy - h - w * .3; ctx.beginPath(); ctx.moveTo(cx - w * .12 * o.v, cy - w * .22); ctx.lineTo(cx + w * .12 * o.v, cy); ctx.lineTo(cx - w * .12 * o.v, cy + w * .22); ctx.stroke(); }
            ctx.lineCap = 'butt';
          }
        }
        // rainbow fireworks over the hills when you win (animated from the verdict clock)
        function fireworks(T) {
          for (const [bx, by, d, hue] of [[90, 215, 0, 20], [710, 220, .15, 190], [200, 235, .3, 300]]) {
            const u = (T - d) / .55; if (u < 0 || u > 1) continue;
            ctx.save(); ctx.translate(bx, by); ctx.globalAlpha = 1 - u * u; ctx.lineCap = 'round';
            for (let k = 0; k < 12; k++) { const a = k * TAU / 12 + hue, r0 = 14 + u * 34, r1 = r0 + 16 * (1 - u) + 6; ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); ctx.strokeStyle = `hsl(${hue + k * 30},95%,62%)`; ctx.lineWidth = 5; ctx.stroke(); }
            ctx.restore(); ctx.globalAlpha = 1;
          }
        }
        // a cow peeking over a bush: watches the car go by, gasps when it crashes, cheers when it wins
        function peekCow(x, y, r, v) {
          const L = st.t0 != null ? Math.max(0, now - st.t0) : 0, bob = Math.sin(now * 3 + v * 40) * r * .04, look = Math.max(-1, Math.min(1, (carX() - x) / 300));
          ctx.save(); ctx.translate(x, y + bob);
          for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * r * .78, -r * .05); ctx.rotate(sd * .5); inkP(elP(0, 0, r * .34, r * .2), '#f2d9d0', Math.max(1.5, r * .07)); ctx.restore(); }
          for (const sd of [-1, 1]) inkP(rrP(sd * r * .42 - r * .07, -r * .98, r * .14, r * .28, r * .06), '#f6efd8', Math.max(1.5, r * .07));
          const hd = rrP(-r * .8, -r * .72, r * 1.6, r * 1.34, r * .5); celP(hd, '#ffffff', '#d9d6e6', -r * .08, -r * .06, Math.max(2, r * .09));
          glintP(hd, -r * .3, -r * .5, r * .3, r * .12, '#fff', -.4);
          ctx.save(); ctx.clip(hd); ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(r * .45, -r * .4, r * .3, r * .22, .4, 0, TAU); ctx.fill(); ctx.restore();
          inkP(elP(0, r * .3, r * .5, r * .3), '#ff9fb8', Math.max(1.5, r * .07)); ctx.fillStyle = INK; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * r * .2, r * .3, r * .06, r * .09, 0, 0, TAU); ctx.fill(); }
          const lose = g.result === 'lose', win = g.result === 'win';
          for (const sd of [-1, 1]) {
            const ex = sd * r * .36, ey = -r * .1;
            if (win) { ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, r * .09); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(ex, ey + r * .08, r * .13, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
            else { const er = lose ? r * .24 : r * .17; inkP(elP(ex, ey, er, er * 1.1), '#fff', Math.max(1.5, r * .05)); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + look * er * .45, ey, er * (lose ? .3 : .52), 0, TAU); ctx.fill(); }
          }
          if (lose) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, r * .52, r * .1, r * .07, 0, 0, TAU); ctx.fill(); }
          ctx.restore();
        }
        // hot-air balloon with a sheep in the basket, drifting across the sky
        function balloon(tt) {
          const bx = ((tt * 22 + 520) % (VW + 200) + VW + 200) % (VW + 200) - OX - 100, by = 188 + Math.sin(tt * 1.3) * 5;
          ctx.save(); ctx.translate(bx, by); ctx.scale(1.2, 1.2); ctx.rotate(Math.sin(tt * 1.1) * .04);
          ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 16); ctx.lineTo(-8, 38); ctx.moveTo(14, 16); ctx.lineTo(8, 38); ctx.stroke();
          const bl = new Path2D('M0 -30C34 -30 36 10 10 18L-10 18C-36 10-34 -30 0 -30Z'); celP(bl, '#ff5c8a', '#c2386a', -5, -2, 3.5);
          ctx.save(); ctx.clip(bl); ctx.fillStyle = '#ffe14d'; ctx.fillRect(-6, -34, 12, 60); ctx.restore(); inkP(bl, null, 3.5);
          glintP(bl, -14, -14, 5, 10, 'rgba(255,255,255,.55)', .3);
          inkP(rrP(-12, 38, 24, 14, 3), '#d9944f', 3);
          ctx.save(); ctx.beginPath(); ctx.rect(-12, 38, 24, 14); ctx.clip(); ctx.translate(0, 36); inkP(elP(0, -3, 8, 7), '#fff', 2.5); inkP(elP(0, -12, 5, 5), '#3a3450', 2.5); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -12, 1.4, 0, 7); ctx.arc(3, -12, 1.4, 0, 7); ctx.fill(); ctx.restore();
          ctx.restore();
        }
      },
      probe: () => {
        // ahead = the bend a driver sees ~0.4 s up the road; D = the push scale for the current input mode
        const ah = curve[segAt(st.z + AH * SEG)] * Dm(), dr = drift(), b = Math.abs(ah) > Math.abs(dr) ? ah : dr;
        return { phase: g.result || (curve[segAt(st.z)] ? 'curve' : 'straight'), px: +st.px.toFixed(3), vx: +st.vx.toFixed(2), tgt: +st.tgt.toFixed(2), drift: +dr.toFixed(2), ahead: +ah.toFixed(2), bend: Math.sign(Math.round(b * 10)), ptr: st.ptr,
          z: Math.round(st.z), fin: FIN * SEG, tFin: +tFin.toFixed(2), carX: Math.round(carX()), aimX: Math.round(W / 2 + Math.max(-1.6, Math.min(1.6, .25 * Math.sign(b) + b / G)) * PXK), G, SK, D: Dm(), pxk: PXK };
      }
    };
    // rally car, seen from behind with Caos at the wheel: cel-shaded body, goggles whose pupils follow the steering, a face that reacts
    function drawCar(x, y, rot, sq, mood, T) {
      const lose = mood === 'sad', win = mood === 'happy', scared = mood === 'panic';
      ctx.save(); ctx.translate(x, y - 34); ctx.rotate(rot); ctx.translate(0, 34); ctx.scale(1 + sq * .08, 1 - sq * .08);
      shadow(0, 2, 84, 14, .35);
      // headband tails flap in the wind (away from the steer)
      const fl = Math.sin(now * 30) * 5, side = rot > .02 ? -1 : 1;
      ctx.fillStyle = '#FF4D4D'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(side * 22, -104 + k * 4); ctx.lineTo(side * (52 + k * 8), -112 + k * 14 + fl * (k ? -1 : 1)); ctx.lineTo(side * (50 + k * 8), -102 + k * 14 + fl * (k ? -1 : 1)); ctx.lineTo(side * 22, -97 + k * 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      // arms (behind the body, reaching for the wheel; up in the air on a win)
      const sw = win ? 0 : Math.max(-1, Math.min(1, st.vx * .18)), hy = win ? -112 + Math.sin(now * 14) * 4 : -58;
      for (const sd of [-1, 1]) { const hx = win ? sd * 40 : sd * 17 + sw * 7; ctx.strokeStyle = INK; ctx.lineWidth = 17; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sd * 24, -84); ctx.lineTo(hx, hy); ctx.stroke(); ctx.strokeStyle = OR; ctx.lineWidth = 9; ctx.stroke(); }
      caos(0, -62, 4.4, { mood: win ? 'happy' : lose ? 'sad' : null, run: null });
      box(-28, -107, 56, 8, '#FF4D4D', 3);
      // goggles: lenses over the eyes
      for (const sd of [-1, 1]) {
        const ex = sd * 12.3, ey = -89, lk = Math.max(-1, Math.min(1, st.vx * .35));
        inkP(elP(ex, ey, scared ? 10.5 : 9, scared ? 11.5 : 10), '#fff', 2.8);
        ctx.fillStyle = '#ffe14d'; ctx.fillRect(sd * 21, ey - 2, sd * 6, 4);
        if (win) { ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(ex, ey + 3, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
        else if (lose) { ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); for (let k = 0; k < 26; k++) { const a = k * .5 + T * 12, r = k * .2; ctx.lineTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r); } ctx.stroke(); }
        else { const pr = scared ? 3 : 5; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + lk * 4, ey + 1, pr, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + lk * 4 - pr * .35, ey + 1 - pr * .4, pr * .35, 0, TAU); ctx.fill(); }
        glintP(elP(ex, ey, 9, 10), ex - 4, ey - 5, 3, 1.6, 'rgba(255,255,255,.9)', -.5);
        if (scared) { ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(ex - sd * 9, ey - 15 + sd * 2); ctx.lineTo(ex + sd * 7, ey - 17 - sd * 3); ctx.stroke(); }
      }
      // mouth + cheeks: a grin, a gritted line when scared, an O when wrecked
      ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
      if (win) { ctx.beginPath(); ctx.arc(0, -80, 5.5, .1, Math.PI - .1); ctx.fill(); }
      else if (lose) { ctx.beginPath(); ctx.ellipse(0, -77, 4, 5, 0, 0, TAU); ctx.fill(); }
      else if (scared) { ctx.beginPath(); ctx.moveTo(-6, -77); ctx.lineTo(-2, -79); ctx.lineTo(2, -77); ctx.lineTo(6, -79); ctx.stroke(); }
      if (scared) { const u = (now * 1.8) % 1; ctx.globalAlpha = 1 - u; inkP(new Path2D('M0-6C4 0 6 4 0 7C-6 4-4 0 0-6Z'), '#9fe3ff', 1.8); ctx.globalAlpha = 1; ctx.save(); ctx.translate(30, -100 + u * 16); inkP(new Path2D('M0-6C4 0 6 4 0 7C-6 4-4 0 0-6Z'), '#9fe3ff', 2); ctx.restore(); }
      ctx.fillStyle = 'rgba(255,110,165,.55)'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 21, -80, 5, 3, 0, 0, TAU); ctx.fill(); }
      // tyres
      const tr = (st.z / 40) % 2 | 0;
      for (const s of [-1, 1]) { const tp = rrP(s * 58 - 13, -36, 26, 36, 8); celP(tp, '#3a3450', '#2a2533', -3, 0, 4); ctx.save(); ctx.clip(tp); ctx.fillStyle = '#6a6284'; for (let k = 0; k < 4; k++) if ((k + tr) % 2) ctx.fillRect(s * 58 - 13, -36 + k * 9, 26, 4); ctx.restore(); }
      // body shell
      const bd = rrP(-70, -66, 140, 52, 16); celP(bd, '#4DB8FF', '#2f86d6', 0, -7, 4);
      glintP(bd, -38, -58, 30, 4, 'rgba(255,255,255,.55)', -.05);
      ctx.save(); ctx.clip(bd); ctx.fillStyle = '#fff'; ctx.fillRect(-6, -66, 12, 52); ctx.fillStyle = 'rgba(20,16,28,.18)'; ctx.fillRect(6, -66, 4, 52); ctx.restore(); inkP(bd, null, 4);
      // steering wheel in front of the driver's hands
      ctx.save(); ctx.translate(0, -59); ctx.rotate(st.vx * .12 + (lose ? T * 6 : 0)); inkP(elP(0, 0, 22, 9), null, 5.5); ctx.strokeStyle = '#5a5274'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, 0, 22, 9, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 22, 9, 0, 3.5, 5.2); ctx.stroke(); ctx.restore();
      const brake = g.result ? '#ff2d2d' : '#c8323a';
      for (const s of [-1, 1]) { const tl = rrP(s * 43 - 11, -48, 22, 11, 4); celP(tl, brake, '#8e1f28', 0, -3, 3); if (g.result) { ctx.save(); ctx.globalAlpha = .4 + .3 * Math.sin(now * 20); ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.ellipse(s * 43, -42, 20, 12, 0, 0, TAU); ctx.fill(); ctx.restore(); } }
      inkP(rrP(-17, -42, 34, 14, 4), '#fff', 3); ctx.fillStyle = INK; ctx.font = '900 11px Arial Black, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CL-4', 0, -35);
      celP(rrP(-60, -20, 120, 7, 3.5), '#4a4458', '#2a2533', 0, -2, 3);
      inkP(rrP(26, -20, 14, 8, 3), '#c9ced6', 2.5);
      ctx.restore();
    }
    return g;
  };
})();
