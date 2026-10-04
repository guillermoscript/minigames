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
    const st = { z: Z0 + 2 * SEG, v: V * .55, px: 0, vx: 0, tgt: 0, ptr: false, acc: 99, lx: null, spin: 0, sq: 0, sky: 0, eng: 0, rum: 0, cin: false, crash: 0 }, puffs = [];
    const segAt = z => Math.max(0, Math.min(N - 1, Math.floor(z / SEG)));
    const Dm = () => st.ptr ? D : DK;
    const drift = () => curve[segAt(st.z)] * Dm() * (st.v / V);
    // time to the line; the fuse is sized so it never turns red before it (distance is the goal, not time)
    let tFin = 0; for (let z = st.z, v = st.v; z < FIN * SEG; tFin += 1 / 60) { z += v / 60; v += (V - v) * .05; }
    const puff = (x, y, r, col, vy) => puffs.push({ x, y, r, col, vx: (Math.random() - .5) * 60, vy, life: .6 + Math.random() * .3, t: 0 });
    const carX = () => W / 2 + st.px * PXK;
    const crash = () => {
      g.result = 'lose'; st.crash = 1; st.spin = Math.sign(st.px) * 14; sfx.thud(); sfx.buzz(); noise(.5, .12, 900, 120); shake(14, .45);
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
          g.result = 'win'; sfx.sparkle(); sfx.coin(); confetti(W / 2, 260, 60); shake(8, .3); ring(W / 2, 300, '#FFE14D', 240, .6); floatText('FINISH!', W / 2, 330, '#FFE14D', 64);
        }
      },
      draw(t) {
        // sky, sun, clouds, mountains (parallax on curves)
        const sk = ctx.createLinearGradient(0, 0, 0, HZ); sk.addColorStop(0, '#4fb3f0'); sk.addColorStop(1, '#cfeee6');
        ctx.fillStyle = sk; ctx.fillRect(-OX, 0, VW, HZ + 2);
        circ(W / 2 + 230 + st.sky * .3 % 40, 175, 34, '#FFE14D', 4);
        for (let i = 0; i < 6; i++) { const cx = ((i * 260 + st.sky * .5 - t * 8) % (VW + 300) + VW + 300) % (VW + 300) - OX - 150, cy = 150 + (i % 3) * 22; ctx.fillStyle = 'rgba(255,255,255,.85)'; for (const [dx, r] of [[-30, 18], [0, 26], [30, 18]]) { ctx.beginPath(); ctx.arc(cx + dx, cy, r, 0, 7); ctx.fill(); } }
        for (const [k, col, hgt, par] of [[0, '#86b8a8', 70, .4], [1, '#5f9a7e', 44, .8]]) {
          ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-OX, HZ + 4);
          for (let x = -OX; x <= W + OX + 20; x += 20) { const u = (x - st.sky * par) / 90 + k * 3; ctx.lineTo(x, HZ - hgt * (.55 + .3 * Math.sin(u) + .15 * Math.sin(u * 2.7))); }
          ctx.lineTo(W + OX, HZ + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
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
        const lose = g.result === 'lose', bob = g.result ? 0 : Math.sin(now * 38) * (Math.abs(st.px) > .8 ? 3 : .8);
        drawCar(carX(), 538 + bob, lose ? st.crash : st.vx * .035, st.sq, lose ? 'sad' : g.result === 'win' ? 'happy' : null);
        if (!g.result && Math.abs(st.px) > .8 && now % .25 < .15) txt('!', carX() + Math.sign(st.px) * 90, 440, 54, '#FF4D4D');
        if (lose) for (let k = 0; k < 3; k++) { const a = now * 5 + k * 2.1; star(carX() + Math.cos(a) * 46, 432 + Math.sin(a) * 12, 12, 5, 5, a, '#FFE14D', 3); }
        // HUD: progress to the finish flag
        const prog = Math.max(0, Math.min(1, (st.z - Z0 - 2 * SEG) / (FIN * SEG - Z0 - 2 * SEG)));
        box3(W / 2 - 200, 92, 400, 14, '#2b2540', 4, 4); ctx.fillStyle = '#FFE14D'; ctx.fillRect(W / 2 - 200, 92, 400 * prog, 14);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { ctx.fillStyle = (r + c) % 2 ? '#fff' : INK; ctx.fillRect(W / 2 + 212 + c * 7, 85 + r * 7, 7, 7); }
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(W / 2 + 212, 85, 21, 21);
        circ(W / 2 - 200 + 400 * prog, 99, 10, OR, 3);
        txt('FOREST RALLY', W / 2, 130, 22);
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
            const h = (1100 + o.v * 600) * sc, w = h * .5;
            box(gx - w * .08, gy - h * .25, w * .16, h * .25, '#7a4a2a', o2);
            for (let j = 0; j < 3; j++) {
              const yb = gy - h * (.18 + j * .25), ww = w * (1 - j * .22);
              ctx.beginPath(); ctx.moveTo(gx - ww / 2, yb); ctx.lineTo(gx + ww / 2, yb); ctx.lineTo(gx, yb - h * .42); ctx.closePath();
              ctx.lineJoin = 'round'; ctx.lineWidth = o2 * 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = o.v > .5 ? '#2f8a4a' : '#3a9c4f'; ctx.fill();
            }
          } else if (o.k === 'bush') {
            const r = (170 + o.v * 90) * sc;
            for (const [dx, dy, k] of [[-1, -.7, .8], [1, -.7, .8], [0, -1.1, 1]]) circ(gx + dx * r * .9, gy + dy * r, r * k, o.v > .7 ? '#e86aa8' : '#4fae46', o2);
          } else {
            const h = 520 * sc, w = 300 * sc;
            box(gx - w * .06, gy - h, w * .12, h, '#ccc', o2);
            box(gx - w / 2, gy - h - w * .7, w, w * .8, '#FFE14D', o2);
            ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, w * .1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            for (const d of [-.2, .15]) { const cx = gx + d * w * o.v, cy = gy - h - w * .3; ctx.beginPath(); ctx.moveTo(cx - w * .12 * o.v, cy - w * .22); ctx.lineTo(cx + w * .12 * o.v, cy); ctx.lineTo(cx - w * .12 * o.v, cy + w * .22); ctx.stroke(); }
            ctx.lineCap = 'butt';
          }
        }
      },
      probe: () => {
        // ahead = the bend a driver sees ~0.4 s up the road; D = the push scale for the current input mode
        const ah = curve[segAt(st.z + AH * SEG)] * Dm(), dr = drift(), b = Math.abs(ah) > Math.abs(dr) ? ah : dr;
        return { phase: g.result || (curve[segAt(st.z)] ? 'curve' : 'straight'), px: +st.px.toFixed(3), vx: +st.vx.toFixed(2), tgt: +st.tgt.toFixed(2), drift: +dr.toFixed(2), ahead: +ah.toFixed(2), bend: Math.sign(Math.round(b * 10)), ptr: st.ptr,
          z: Math.round(st.z), fin: FIN * SEG, tFin: +tFin.toFixed(2), carX: Math.round(carX()), aimX: Math.round(W / 2 + Math.max(-1.6, Math.min(1.6, .25 * Math.sign(b) + b / G)) * PXK), G, SK, D: Dm(), pxk: PXK };
      }
    };
    function drawCar(x, y, rot, sq, mood) {
      ctx.save(); ctx.translate(x, y - 34); ctx.rotate(rot); ctx.translate(0, 34); ctx.scale(1 + sq * .08, 1 - sq * .08);
      shadow(0, 2, 84, 14, .35);
      // headband tails flap in the wind (away from the steer)
      const fl = Math.sin(now * 30) * 5, side = rot > .02 ? -1 : 1;
      ctx.fillStyle = '#FF4D4D'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(side * 22, -104 + k * 4); ctx.lineTo(side * (52 + k * 8), -112 + k * 14 + fl * (k ? -1 : 1)); ctx.lineTo(side * (50 + k * 8), -102 + k * 14 + fl * (k ? -1 : 1)); ctx.lineTo(side * 22, -97 + k * 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      claude(0, -62, 4.4, { mood, run: null });
      box(-28, -107, 56, 8, '#FF4D4D', 3);
      const tr = (st.z / 40) % 2 | 0;
      for (const s of [-1, 1]) { box(s * 58 - 13, -36, 26, 36, '#2a2533', 4); ctx.fillStyle = '#4a4458'; for (let k = 0; k < 4; k++) if ((k + tr) % 2) ctx.fillRect(s * 58 - 13, -36 + k * 9, 26, 4); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-70, -66, 140, 52, 14); ctx.fill();
      ctx.fillStyle = '#4DB8FF'; ctx.beginPath(); ctx.roundRect(-64, -60, 128, 40, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-56, -58, 112, 6);
      const brake = g.result ? '#ff2d2d' : '#c8323a';
      for (const s of [-1, 1]) box(s * 43 - 11, -48, 22, 11, brake, 3);
      box(-17, -42, 34, 14, '#fff', 3); ctx.fillStyle = INK; ctx.font = '900 11px Arial Black, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CL-4', 0, -35);
      box(-60, -20, 120, 6, '#2a2533', 3);
      box(26, -20, 14, 8, '#9a96a8', 3);
      ctx.restore();
    }
    return g;
  };
})();
