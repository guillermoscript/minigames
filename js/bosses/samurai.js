'use strict';
/* SAMURAI boss (GET TOGETHER): a ronin bug winds up a strike from the LEFT, RIGHT or ABOVE and you parry that way.
   After Smooth Moves' "Samurai" form / "Produce Stand-Off". 6 parries shatter his sword; 2 hits and Claude is out. */
(function () {
  const DIRS = ['L', 'R', 'U'], CODE = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp' };
  const KEYS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U' };
  const PAD = { L: [200, 420], R: [600, 420], U: [400, 378] }, RING = { L: 92, R: 92, U: 70 }, ARW = { L: 3, R: 1, U: 0 };   // telegraph arrows
  const CX = 400, CY = 530, CU = 7, BX = 400, FY = 442, BLADE = 150;
  const POSE = { idle: [455, 350, -1.0], L: [282, 248, -2.55], R: [518, 248, -.6], U: [400, 178, -Math.PI / 2],   // rival: hand x, y, blade angle
    sL: [235, 430, .35], sR: [565, 430, Math.PI - .35], sU: [400, 330, Math.PI / 2] };
  const GUARD = { idle: [447, 500, -1], L: [337, 514, -Math.PI / 2], R: [463, 514, -Math.PI / 2], U: [325, 427, 0] };   // Claude's katana
  const HIT = { L: [337, 450], R: [463, 450], U: [400, 427] };
  const angL = (a, b, k) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;
  const lerpP = (p, q, k) => { p[0] += (q[0] - p[0]) * k; p[1] += (q[1] - p[1]) * k; p[2] = angL(p[2], q[2], k); };
  const up = p => Math.max(0, -Math.sin(p[2])) ** 6, bl = p => BLADE * (1 - .3 * up(p));   // overhead blade is foreshortened
  const tipOf = p => [p[0] + Math.cos(p[2]) * bl(p), p[1] + Math.sin(p[2]) * bl(p)];
  const clang = () => { snd(1250, .18, 'square', .05); snd(1870, .25, 'triangle', .06); snd(2630, .12, 'sine', .04, .02); noise(.12, .12, 5000, 7000, 'highpass'); };
  const glint = () => { snd(1400, .06, 'triangle', .05, 0, 2800); snd(3000, .1, 'sine', .04, .05); };

  /* ── DUO-look kit (local; draws on X so the same code paints the baked backdrop and the live frame). Cosmetic noise = hr(), never the game RNG ── */
  const TAU = Math.PI * 2, hr = i => { const q = Math.sin(i * 127.1 + 311.7) * 43758.5453; return q - Math.floor(q); };
  let X = null, BG = null, BGK = '';
  function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
  function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
  function cel(f, base, shade, sx, sy, o = 4) { f(); ink(shade, o); X.save(); f(); X.clip(); X.translate(-sx, -sy); f(); X.fillStyle = base; X.fill(); X.restore(); }
  function gloss(f, x, y, rx, ry, col, rot = -.5) { X.save(); f(); X.clip(); X.fillStyle = col; el(x, y, rx, ry, rot); X.fill(); X.restore(); }
  function plank(x, y, w, h, r, face, depth) { X.fillStyle = 'rgba(20,16,28,.3)'; rr(x + 4, y + 8, w, h, r); X.fill(); rr(x, y + 6, w, h, r); ink(depth, 4); rr(x, y, w, h, r); ink(face, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 8, y + 5, w - 16, 6, 3); X.fill(); }
  function paintBg() {
    const gs = X.createLinearGradient(0, 0, 0, FY); gs.addColorStop(0, '#171033'); gs.addColorStop(.55, '#3b2a72'); gs.addColorStop(1, '#94548a');
    X.fillStyle = gs; X.fillRect(-OX, 0, VW, FY + 4);
    for (let i = 0; i < 60; i++) { X.fillStyle = `rgba(255,255,255,${.3 + hr(i + 5) * .6})`; X.beginPath(); X.arc(-OX + hr(i) * VW, hr(i + 99) * 250, .8 + hr(i + 7) * 1.3, 0, TAU); X.fill(); }
    for (const [r, a] of [[196, .07], [164, .1], [136, .16]]) { X.fillStyle = `rgba(255,240,190,${a})`; X.beginPath(); X.arc(BX, 230, r, 0, TAU); X.fill(); }
    X.beginPath(); X.arc(BX, 230, 118, 0, TAU); ink('#f6e8b4', 4, '#d9c27a');
    X.fillStyle = 'rgba(200,180,120,.4)'; for (const [x, y, r] of [[-70, 10, 16], [75, 40, 20], [-25, 78, 11], [62, -52, 9]]) { X.beginPath(); X.arc(BX + x, 230 + y, r, 0, TAU); X.fill(); }
    // the moon rabbit pounds mochi (silhouette on the disc)
    X.fillStyle = 'rgba(160,125,80,.55)'; el(BX - 12, 218, 22, 17); X.fill(); el(BX - 28, 196, 8, 19, -.3); X.fill(); el(BX - 14, 193, 8, 19, .1); X.fill(); el(BX + 12, 238, 16, 8); X.fill();
    X.strokeStyle = 'rgba(160,125,80,.55)'; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(BX + 4, 214); X.lineTo(BX + 40, 180); X.stroke(); el(BX + 44, 176, 12, 8, -.8); X.fill();
    for (const [col, ol, base, amp, ph] of [['#2d2566', '#4a3f94', 330, 28, 0], ['#241d57', '#3b3280', 372, 20, 2]]) {      // far ranges: coloured outline, no ink
      X.beginPath(); X.moveTo(-OX, FY); for (let x = -OX; x <= W + OX + 20; x += 20) X.lineTo(x, base - amp * Math.abs(Math.sin(x * .006 + ph)) - amp * .5 * Math.sin(x * .017 + ph)); X.lineTo(W + OX + 20, FY); X.closePath(); X.lineJoin = 'round'; X.lineWidth = 4; X.strokeStyle = ol; X.stroke(); X.fillStyle = col; X.fill();
    }
    const px = 168, py = 392; X.lineJoin = 'round';                                        // pagoda on the hill
    X.fillStyle = '#1b1548'; X.fillRect(px - 26, py - 46, 52, 46);
    for (let i = 0; i < 3; i++) { const w = 74 - i * 14, y = py - 46 - i * 40; X.beginPath(); X.moveTo(px - w, y); X.quadraticCurveTo(px - w * .4, y - 8, px - w * .3, y - 26); X.lineTo(px + w * .3, y - 26); X.quadraticCurveTo(px + w * .4, y - 8, px + w, y); X.quadraticCurveTo(px, y + 7, px - w, y); X.closePath(); X.lineWidth = 3; X.strokeStyle = '#5a4eb0'; X.stroke(); X.fillStyle = '#2a2262'; X.fill(); X.fillStyle = '#ffd86a'; X.fillRect(px - 5, y + 5, 10, 14); }
    X.fillStyle = '#5a4eb0'; X.fillRect(px - 2, py - 176, 4, 28);
    for (const [col, shd, step, off, w, o] of [['#1e4636', '#173627', 58, 0, 18, 0], ['#3f8c57', '#2c6b42', 96, 30, 26, 4]]) for (let x = -OX - 20 + off; x < W + OX + 20; x += step) {   // bamboo
      if (Math.abs(x - BX) < (o ? 300 : 250)) continue;
      if (o) { X.fillStyle = INK; rr(x - w / 2 - o, -14, w + 2 * o, 482, 6); X.fill(); }
      X.fillStyle = col; X.fillRect(x - w / 2, -10, w, 470); X.fillStyle = shd; X.fillRect(x + w / 2 - w * .3, -10, w * .3, 470); X.fillStyle = 'rgba(255,255,255,.2)'; X.fillRect(x - w / 2 + 3, -10, 4, 470);
      X.fillStyle = INK; for (let y = 60 + (x * 7 % 50); y < 440; y += 90) X.fillRect(x - w / 2 - o, y, w + 2 * o, o ? 6 : 4);
      X.fillStyle = col; for (let y = 100 + (x * 3 % 60); y < 380; y += 140) { const sd = x % 2 ? 1 : -1; X.save(); X.translate(x, y); X.rotate(sd * .5); X.beginPath(); X.ellipse(sd * 30, 0, 32, 8, 0, 0, TAU); if (o) { X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); } X.fill(); X.restore(); }
    }
    const gd = X.createLinearGradient(0, FY, 0, H); gd.addColorStop(0, '#a4663a'); gd.addColorStop(1, '#6c3f22'); X.fillStyle = gd; X.fillRect(-OX, FY, VW, H - FY);   // dojo deck
    X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 3; for (let i = -16; i <= 16; i++) { X.beginPath(); X.moveTo(BX + i * 45, FY); X.lineTo(BX + i * 150, H); X.stroke(); }
    for (const y of [468, 502, 546]) { X.beginPath(); X.moveTo(-OX, y); X.lineTo(W + OX, y); X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.07)'; for (let i = -6; i < 8; i++) { X.beginPath(); X.moveTo(i * 150, FY); X.lineTo(i * 150 + 60, FY); X.lineTo(i * 150 + 160, H); X.lineTo(i * 150 + 70, H); X.fill(); }
    rr(150, 452, 500, 92, 12); ink('#b3a15a', 4); X.save(); rr(150, 452, 500, 92, 12); X.clip(); X.fillStyle = '#d9c97c'; X.fillRect(150, 448, 500, 82); X.fillStyle = 'rgba(255,255,255,.25)'; el(300, 468, 90, 8, -.05); X.fill(); X.restore();   // tatami
    X.strokeStyle = '#3d2a66'; X.lineWidth = 5; rr(158, 460, 484, 76, 8); X.stroke(); X.strokeStyle = 'rgba(80,60,30,.35)'; X.lineWidth = 2; X.beginPath(); X.moveTo(400, 462); X.lineTo(400, 534); X.stroke();
    X.fillStyle = INK; X.fillRect(-OX, FY - 3, VW, 6);
    const lx = 34, ly = 462;                                                                // stone lantern, far left
    rr(lx - 17, ly - 10, 34, 10, 4); ink('#9aa0b4', 3); rr(lx - 8, ly - 42, 16, 34, 4); ink('#7d839a', 3);
    rr(lx - 20, ly - 74, 40, 32, 5); ink('#9aa0b4', 3.5); X.fillStyle = '#ffd86a'; rr(lx - 11, ly - 68, 22, 20, 3); X.fill(); rr(lx - 30, ly - 96, 60, 20, 6); ink('#7d839a', 3.5); X.beginPath(); X.arc(lx, ly - 102, 8, 0, TAU); ink('#9aa0b4', 3);
    const rx = 724, ry = 478; X.fillStyle = 'rgba(20,16,28,.3)'; el(rx, ry + 4, 62, 9); X.fill();   // ramen cart, far right
    rr(rx - 52, ry - 52, 104, 50, 8); ink('#c43d3d', 4); X.fillStyle = '#e2a45a'; rr(rx - 46, ry - 22, 92, 10, 3); X.fill();
    X.beginPath(); X.arc(rx - 30, ry, 14, 0, TAU); ink('#7a4a26', 3.5); X.beginPath(); X.arc(rx - 30, ry, 5, 0, TAU); ink('#d9944f', 2);
    X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(rx - 56, ry - 96); X.lineTo(rx - 56, ry - 52); X.moveTo(rx + 56, ry - 96); X.lineTo(rx + 56, ry - 52); X.stroke();
    for (let i = 0; i < 5; i++) { X.beginPath(); X.moveTo(rx - 62 + i * 25, ry - 88); X.lineTo(rx - 37 + i * 25, ry - 88); X.lineTo(rx - 40 + i * 25, ry - 62); X.lineTo(rx - 65 + i * 25, ry - 62); X.closePath(); ink(i % 2 ? '#fff4d8' : '#e8433a', 3); }
    X.beginPath(); X.arc(rx + 14, ry - 26, 17, 0, Math.PI); X.closePath(); ink('#fff4d8', 3); X.strokeStyle = '#e8433a'; X.lineWidth = 3; X.beginPath(); X.arc(rx + 14, ry - 26, 10, .3, 2.8); X.stroke();
  }
  function bakeBg() { const k = VW + ':' + OX; if (BG && BGK === k) return BG; const c = document.createElement('canvas'); c.width = VW; c.height = H; const old = X; X = c.getContext('2d'); X.translate(OX, 0); try { paintBg(); } finally { X = old; } BG = c; BGK = k; return c; }
  function eyeDot(x, y, r, look) { el(x, y, r, r * 1.08); ink('#fff', r * .28); X.fillStyle = INK; X.beginPath(); X.arc(x + look * r * .38, y, r * .52, 0, TAU); X.fill(); X.fillStyle = '#fff'; X.beginPath(); X.arc(x + look * r * .38 - r * .18, y - r * .2, r * .2, 0, TAU); X.fill(); }
  /* the frog in the audience (far left) munching popcorn: eyes follow the blade, hands over its eyes on a loss, cheers on a win */
  function frog(x, y, T, mode, look) {
    const bob = Math.sin(T * 5) * (mode === 'idle' ? 1.5 : 0), jump = mode === 'win' ? -Math.abs(Math.sin(T * 9)) * 18 : 0, sc = mode === 'wind' ? 1.06 : 1;
    X.save(); X.translate(x, y + jump); X.scale(sc, sc);
    X.fillStyle = 'rgba(20,16,28,.3)'; el(0, 4 - jump * .2, 40, 8); X.fill();
    cel(() => el(0, -24 + bob, 34, 26), '#7ed957', '#4fa83c', 6, 5, 4);
    X.fillStyle = '#ecf8b0'; el(0, -14 + bob, 21, 14); X.fill();
    for (const sd of [-1, 1]) { const ex = sd * 17, ey = -52 + bob; el(ex, ey, 14, 14); ink('#7ed957', 4); if (mode === 'lose') { X.fillStyle = '#7ed957'; el(ex, ey, 11, 11); X.fill(); } else eyeDot(ex, ey, 10, look); }
    X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath();
    if (mode === 'win') X.arc(0, -30 + bob, 12, .15, Math.PI - .15); else if (mode === 'lose') { X.moveTo(-9, -20); X.quadraticCurveTo(0, -30, 9, -20); } else if (mode === 'wind') X.ellipse(0, -24 + bob, 6, 5, 0, 0, TAU); else X.ellipse(0, -26 + bob, 8, 2 + Math.abs(Math.sin(T * 6)) * 3, 0, 0, TAU);
    X.stroke(); X.fillStyle = 'rgba(255,110,150,.5)'; for (const sd of [-1, 1]) { el(sd * 24, -32 + bob, 6, 4); X.fill(); }
    rr(-17, -4, 34, 24, 4); ink('#fff4d8', 3); X.fillStyle = '#e8433a'; for (const sx of [-12, -2, 8]) X.fillRect(sx - 1, -3, 5, 22);
    for (const [px, py] of [[-9, -9], [0, -12], [8, -8], [-3, -7]]) { X.beginPath(); X.arc(px, py, 5, 0, TAU); ink('#fff6c8', 2); }
    if (mode === 'lose') for (const sd of [-1, 1]) { rr(sd * 17 - 8, -62, 16, 22, 7); ink('#7ed957', 3.5); }
    X.restore();
    if (mode === 'win') for (let i = 0; i < 6; i++) { const u = (T * 1.4 + i / 6) % 1; X.beginPath(); X.arc(x - 30 + i * 12 + Math.sin(i * 3) * 8, y - 70 - u * 46, 4.2, 0, TAU); ink('#fff6c8', 2); }
  }

  function katana(x, y, a, len, gl, broken) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.lineJoin = 'round';
    ctx.fillStyle = INK; ctx.fillRect(-32, -8, 38, 16); ctx.fillStyle = '#5b2d86'; ctx.fillRect(-29, -4.5, 32, 9);
    ctx.fillStyle = '#FFE14D'; for (let i = -24; i < 0; i += 8) ctx.fillRect(i, -4.5, 3, 9);
    const L = broken ? 22 : len;
    ctx.beginPath(); ctx.moveTo(8, -5); ctx.lineTo(L - (broken ? 0 : 22), -6); ctx.lineTo(L, broken ? 5 : 3); ctx.lineTo(8, 5); ctx.closePath();
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#e9eef6'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, -1.5); ctx.lineTo(L - 26, -2.5); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(7, 0, 7, 15, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.ellipse(7, 0, 4, 11, 0, 0, 7); ctx.fill();
    if (gl > 0 && !broken) star(L, 0, 26 * gl, 6, 4, now * 5, '#fff', 3);
    ctx.restore();
  }
  function heart(x, y, s, fill, lw) {
    ctx.beginPath(); ctx.moveTo(x, y + s * .9); ctx.bezierCurveTo(x - s * 1.4, y, x - s * .9, y - s * 1.1, x, y - s * .4);
    ctx.bezierCurveTo(x + s * .9, y - s * 1.1, x + s * 1.4, y, x, y + s * .9); ctx.closePath();
    ctx.lineWidth = lw || 7; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = fill; ctx.fill();
  }

  BOSSES.samurai = function (sp, s) {
    const k = Math.sqrt(Math.min(sp, 1.8)), need = 6;
    let ph = 'intro', pt = .8, tw = 1, dir = null, prev = [], parries = 0, hearts = 2, strikes = 0, clk = 0, stop = 0;
    let fallDir = 1, guard = 'idle', guardT = 0, cflash = 0, knock = 0, sq = 0, lean = 0, smear = 0, fall = 0, slashT = -1, ptr = null, mood = 'idle', hpop = 0, rT0 = -1;
    const rp = POSE.idle.slice(), gp = GUARD.idle.slice(), smearFrom = [0, 0], shards = [];
    const leaves = Array.from({ length: 12 }, (_, i) => ({ x: Math.random(), y: Math.random() * 600, s: .6 + Math.random() * .6, p: i }));
    const pick = () => { let d; do d = DIRS[Math.random() * 3 | 0]; while (prev[0] === d && prev[1] === d); prev = [d, prev[0]]; return d; };
    const strike = () => { Object.assign(smearFrom, tipOf(rp)); smear = .14; const q = POSE['s' + dir]; rp[0] = q[0]; rp[1] = q[1]; rp[2] = q[2]; sfx.whoosh(false); };
    const hurt = msg => {
      strike(); ph = 'hurt'; pt = .7; hearts--; hpop = .4; cflash = .45; knock = dir === 'R' ? -30 : dir === 'L' ? 30 : 0; mood = 'laugh';
      sfx.thud(); sfx.buzz(); shake(12, .3); burst(CX, CY - 30, '#ff4d4d', 16); ring(CX, CY - 30, '#ff4d4d', 90);
      floatText(msg, CX, CY - 110, '#ff9a9a', 34); floatText('HA HA!', BX + 120, 200, '#fff', 28);
      if (hearts <= 0) { g.result = 'lose'; sfx.miss(); }
    };
    const parry = d => {
      if (g.result) return;
      guard = d; guardT = .3;
      if (ph !== 'wind') { sfx.whoosh(); return; }              // swinging at nothing is harmless
      if (d !== dir) { hurt('WRONG WAY!'); return; }
      strike(); parries++; stop = .08; guardT = .45; ph = 'recoil'; pt = .4; sq = .35; mood = 'dizzy';
      const [hx, hy] = HIT[dir]; clang(); sfx.blip(parries * 2); shake(8, .15); burst(hx, hy, '#FFE14D', 18, 380); burst(hx, hy, '#fff', 8, 260); ring(hx, hy, '#fff', 80, .3);
      floatText('CLANG!', hx, hy - 70, '#FFE14D', 42);
      if (parries >= need) {                                    // the sword shatters, the ronin keels over
        g.result = 'win'; stop = .14; slashT = 0; mood = 'dead'; fallDir = dir === 'L' ? 1 : dir === 'R' ? -1 : Math.random() < .5 ? -1 : 1;
        const [ax, ay] = [rp[0], rp[1]], [tx, ty] = tipOf(rp);
        for (let i = 0; i < 8; i++) { const u = .2 + i * .1; shards.push({ x: ax + (tx - ax) * u, y: ay + (ty - ay) * u, vx: (Math.random() - .5) * 700, vy: -200 - Math.random() * 400, r: Math.random() * 6, vr: (Math.random() - .5) * 20 }); }
        noise(.35, .14, 6000, 3000, 'highpass'); sfx.sparkle(); sfx.splat(); shake(16, .5); confetti(BX, 300, 60); ring(BX, 320, '#FFE14D', 240, .6);
      }
    };
    const zone = x => x < 290 ? 'L' : x > 510 ? 'R' : 'U';   // side thirds = L / R, middle column = UP
    const g = {
      cmd: 'BOSS!', hint: 'PARRY WITH ← ↑ →', thint: 'SWIPE OR TAP TO PARRY', dur: 11, boss: true, wide: true, swipe: true,
      key(e) { if (ptr) ptr.used = true; const d = KEYS[e.code]; if (d) parry(d); },
      down(p) { ptr = { x: p.x, y: p.y, used: false }; },
      up() { if (ptr && !ptr.used) parry(zone(ptr.x)); ptr = null; },
      update(dt) {
        if (g.result && rT0 < 0) rT0 = now;
        for (const l of leaves) { l.y += 40 * l.s * dt; if (l.y > 620) { l.y = -20; l.x = Math.random(); } }
        for (const q of shards) { q.vy += 1100 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt; }
        if (slashT >= 0) slashT += dt;
        if (stop > 0) { stop -= dt; return; }                     // freeze-frame on CLANG
        clk += dt; cflash = Math.max(0, cflash - dt); smear = Math.max(0, smear - dt); hpop = Math.max(0, hpop - dt);
        knock *= Math.pow(.02, dt); sq *= Math.pow(.004, dt);
        guardT -= dt; if (guardT <= 0 && ph !== 'recoil') guard = 'idle';
        lerpP(gp, GUARD[guard], Math.min(1, 30 * dt));
        if (g.result) { if (g.result === 'win') fall = Math.min(1, fall + dt * 2.2); else lerpP(rp, POSE.U, Math.min(1, 6 * dt)); return; }
        const tgt = ph === 'wind' ? POSE[dir] : POSE.idle;
        lean += ((ph === 'wind' ? (dir === 'L' ? -20 : dir === 'R' ? 20 : 0) : 0) - lean) * Math.min(1, 10 * dt);
        if (!(ph === 'hurt' && pt > .45) && !(ph === 'recoil' && pt > .3)) lerpP(rp, tgt, Math.min(1, (ph === 'wind' ? 16 : 7) * dt));
        pt -= dt; if (pt > 0) return;
        if (ph === 'wind') { hurt('TOO SLOW!'); return; }
        if (ph === 'gap') { ph = 'wind'; dir = pick(); strikes++; tw = pt = Math.max(.5, (.8 - parries * .03) / k); mood = 'angry'; glint(); sfx.tickHi(); return; }
        ph = 'gap'; pt = Math.max(.25, (.6 - parries * .05) / k); mood = 'idle'; guard = 'idle'; if (strikes === 0) { sfx.whoosh(); glint(); }
      },
      draw(t) {
        X = ctx; ctx.drawImage(bakeBg(), -OX, 0);
        ctx.fillStyle = 'rgba(255,243,192,' + (.05 + .03 * Math.sin(clk * 1.6)) + ')'; ctx.beginPath(); ctx.arc(BX, 230, 150 + Math.sin(clk * 1.6) * 6, 0, 7); ctx.fill();   // moon halo breathes
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const fx = -OX + hr(i + 40) * VW + Math.sin(clk * .8 + i * 2) * 26, fy = 250 + hr(i + 60) * 180 + Math.cos(clk * 1.1 + i) * 14; ctx.fillStyle = 'rgba(216,255,122,' + (.25 + .35 * Math.abs(Math.sin(clk * 2 + i * 1.7))) + ')'; ctx.beginPath(); ctx.arc(fx, fy, 3, 0, 7); ctx.fill(); } ctx.restore();   // fireflies
        { const lf = .55 + .25 * Math.sin(clk * 9) * Math.sin(clk * 3.1); ctx.fillStyle = 'rgba(255,216,106,' + (.12 * lf) + ')'; ctx.beginPath(); ctx.arc(40, 424, 62, 0, 7); ctx.fill();                                 // stone lantern flicker
          for (let i = 0; i < 3; i++) { const u = (clk * .5 + i / 3) % 1; ctx.fillStyle = 'rgba(255,255,255,' + (.5 * (1 - u)) + ')'; ctx.beginPath(); ctx.arc(738 + Math.sin(u * 6 + i) * 8, 436 - u * 46, 5 + u * 7, 0, 7); ctx.fill(); } }   // ramen steam
        const rT = rT0 >= 0 ? now - rT0 : clk, tipLook = ph === 'wind' ? (dir === 'L' ? -1 : dir === 'R' ? 1 : 0) : Math.sin(clk * 1.3) * .6;
        frog(96, 522, rT, g.result === 'win' ? 'win' : g.result === 'lose' ? 'lose' : ph === 'wind' || ph === 'hurt' ? 'wind' : 'idle', Math.abs(tipLook) < .1 ? .8 : Math.sign(tipLook));
        ctx.fillStyle = '#5fae6e'; for (const l of leaves) { ctx.save(); ctx.translate(-OX + l.x * VW + Math.sin(clk * 2 + l.p) * 30, l.y); ctx.rotate(Math.sin(clk * 3 + l.p)); ctx.beginPath(); ctx.ellipse(0, 0, 12 * l.s, 4 * l.s, 0, 0, 7); ctx.fill(); ctx.restore(); }
        // telegraph glow on the strike side
        if (ph === 'wind' && !g.result) {
          const fl = (clk * 14 | 0) % 2;
          const sg = dir === 'L' ? ctx.createLinearGradient(-OX, 0, 330, 0) : dir === 'R' ? ctx.createLinearGradient(W + OX, 0, 470, 0) : ctx.createLinearGradient(0, 60, 0, 300);
          sg.addColorStop(0, `rgba(255,77,77,${.35 + .2 * fl})`); sg.addColorStop(1, 'rgba(255,77,77,0)'); ctx.fillStyle = sg; ctx.fillRect(-OX, 0, VW, H);
        } else if (TOUCH && !g.result) { ctx.globalAlpha = .18; for (const d of DIRS) drawArrow(PAD[d][0], PAD[d][1], ARW[d], 40, '#fff'); ctx.globalAlpha = 1; }
        X = ctx; plank(474, 74, 206, 80, 14, g.result === 'win' ? '#FFE14D' : '#d9944f', g.result === 'win' ? '#c99512' : '#a5622c');   // drawn under the bug so the overhead blade passes in front
        ctx.font = '900 20px "Arial Black", Impact, sans-serif'; const lw = ctx.measureText(window.t('PARRIES')).width;   // right of the overhead blade, left of the score popup
        txt('PARRIES', 492, 98, 20, '#fff', 'left'); txt(`${parries} / ${need}`, 502 + lw, 98, 20, '#FFE14D', 'left');
        for (let i = 0; i < need; i++) { const on = i < parries, x = 506 + i * 31; circ(x, 130, 11, on ? '#FFE14D' : '#3a2a4a', 4); if (on) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 7, 137); ctx.lineTo(x + 7, 123); ctx.stroke(); } }
        // the ronin bug
        shadow(BX, FY, 110, 16, .35);
        const pv = BX + fallDir * 55;
        ctx.save(); ctx.translate(pv + lean, FY - Math.sin(fall * Math.PI) * 26); ctx.rotate(fallDir * fall * fall * 1.1); ctx.scale(1 + sq * .25, 1 - sq * .2 + Math.sin(clk * 3) * .015); ctx.translate(-pv, -FY);
        const by = 335, hy = by - 100;
        ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round';
        for (const x of [-48, -18, 18, 48]) { ctx.beginPath(); ctx.moveTo(BX + x, by + 70); ctx.lineTo(BX + x * 1.15, FY - 4); ctx.stroke(); }
        const bodyP = () => { ctx.beginPath(); ctx.ellipse(BX, by, 80, 90, 0, 0, 7); };
        cel(bodyP, '#e8433a', '#a92a2f', 14, 10, 4); gloss(bodyP, BX - 42, by - 52, 22, 12, 'rgba(255,255,255,.4)');
        ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(BX, by - 85); ctx.lineTo(BX, by + 88); ctx.stroke();
        ctx.fillStyle = INK; for (const [x, y, r] of [[-40, -30, 13], [38, -42, 10], [-30, 40, 11], [44, 30, 14], [-55, 5, 7]]) { ctx.beginPath(); ctx.arc(BX + x, by + y, r, 0, 7); ctx.fill(); }
        box(BX - 74, by + 8, 148, 22, '#3d2a66', 4);                                  // obi sash
        ctx.lineWidth = 6; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(BX + sd * 14, hy - 30); ctx.quadraticCurveTo(BX + sd * 30, hy - 90, BX + sd * 52, hy - 96); ctx.stroke(); circ(BX + sd * 52, hy - 96, 6, '#e8433a', 3); }
        const headP = () => { ctx.beginPath(); ctx.arc(BX, hy, 42, 0, 7); };
        cel(headP, '#3a2d58', '#1e1636', 9, 7, 5); gloss(headP, BX - 20, hy - 22, 12, 6, 'rgba(255,255,255,.28)');
        if (mood === 'dead') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; for (const sd of [-1, 1]) { const ex = BX + sd * 17, ey = hy + 4; ctx.beginPath(); ctx.moveTo(ex - 8, ey - 8); ctx.lineTo(ex + 8, ey + 8); ctx.moveTo(ex + 8, ey - 8); ctx.lineTo(ex - 8, ey + 8); ctx.stroke(); } }
        else if (mood === 'laugh') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(BX + sd * 17 - 9, hy + 8); ctx.lineTo(BX + sd * 17, hy); ctx.lineTo(BX + sd * 17 + 9, hy + 8); ctx.stroke(); } }
        else for (const sd of [-1, 1]) {
          const ex = BX + sd * 17, ey = hy + 4, wob = mood === 'dizzy' ? Math.sin(clk * 30 + sd) * 3 : 0;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, 12, mood === 'angry' ? 7 : 10, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(ex + wob + (mood === 'angry' ? (dir === 'L' ? -4 : dir === 'R' ? 4 : 0) : 0), ey + (mood === 'angry' && dir === 'U' ? -2 : 0), 4.5, 0, 7); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + wob - 2 + (mood === 'angry' ? (dir === 'L' ? -4 : dir === 'R' ? 4 : 0) : 0), ey - 2, 1.6, 0, 7); ctx.fill();
          if (mood === 'dizzy') { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); for (let a = 0; a < 12; a += .4) ctx.lineTo(ex + Math.cos(a + clk * 14) * a * .7, ey + Math.sin(a + clk * 14) * a * .7); ctx.stroke(); }
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ex - sd * 13, ey - (mood === 'angry' ? 18 : 14)); ctx.lineTo(ex + sd * 11, ey - (mood === 'angry' ? 9 : 14)); ctx.stroke();
        }
        ctx.lineCap = 'round'; for (const sd of [-1, 1]) {                             // droopy mustache
          ctx.beginPath(); ctx.moveTo(BX, hy + 22); ctx.quadraticCurveTo(BX + sd * 30, hy + 18, BX + sd * 38, hy + 46 + (mood === 'laugh' ? Math.sin(clk * 40) * 4 : 0));
          ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = '#f4efe4'; ctx.lineWidth = 5; ctx.stroke(); }
        const hatP = () => { ctx.beginPath(); ctx.moveTo(BX - 112, hy - 16); ctx.lineTo(BX, hy - 74); ctx.lineTo(BX + 112, hy - 16); ctx.quadraticCurveTo(BX, hy - 4, BX - 112, hy - 16); ctx.closePath(); };   // kasa hat
        cel(hatP, '#e8b857', '#b27d2c', 0, 10, 6); gloss(hatP, BX - 40, hy - 46, 34, 7, 'rgba(255,255,255,.35)', -.5);
        ctx.strokeStyle = 'rgba(20,16,28,.35)'; ctx.lineWidth = 3; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(BX, hy - 70); ctx.lineTo(BX + i * 30, hy - 14); ctx.stroke(); }
        const [hx, hy2, ha] = rp, bow = 20 + 45 * up(rp);                              // noodle arms + sword
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(BX + sd * 62, by - 40); ctx.quadraticCurveTo((BX + sd * 62 + hx) / 2 + sd * bow, (by - 40 + hy2) / 2 + 20, hx + sd * 8, hy2); ctx.strokeStyle = INK; ctx.lineWidth = 20; ctx.stroke(); ctx.strokeStyle = '#e8433a'; ctx.lineWidth = 11; ctx.stroke(); }
        if (smear > 0) { const [tx, ty] = tipOf(rp); ctx.globalAlpha = smear / .14; ctx.strokeStyle = '#fff'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(smearFrom[0], smearFrom[1]); ctx.quadraticCurveTo((smearFrom[0] + tx) / 2 + (BX - hx) * .3, (smearFrom[1] + ty) / 2 - 40, tx, ty); ctx.stroke(); ctx.globalAlpha = 1; }
        katana(hx, hy2, ha, bl(rp), ph === 'wind' && !g.result ? .7 + .3 * Math.sin(clk * 30) : 0, g.result === 'win');
        circ(hx, hy2, 13, '#2b2140', 4); ctx.lineCap = 'butt';
        ctx.restore();
        if (ph === 'wind' && !g.result) {                                              // ticking ring + big flashing arrow
          const u = 1 - pt / tw, [ax, ay] = PAD[dir], rr = RING[dir];
          ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(ax, ay, rr, -Math.PI / 2, -Math.PI / 2 + (1 - u) * 6.283); ctx.stroke();
          ctx.strokeStyle = u > .6 ? '#ff4d4d' : '#FFE14D'; ctx.lineWidth = 9; ctx.stroke(); ctx.lineCap = 'butt';
          drawArrow(ax, ay, ARW[dir], rr * .7 * (1 + .1 * Math.sin(clk * 40)) * Math.min(1, u * 8 + .4), (clk * 14 | 0) % 2 ? '#fff' : '#FFE14D'); }
        if (ph === 'wind' && !g.result) txt('!', BX + 70 + lean, hy - 70, 64 + Math.sin(clk * 30) * 6, '#ff4d4d');
        for (const q of shards) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.beginPath(); ctx.moveTo(-14, -5); ctx.lineTo(16, 0); ctx.lineTo(-10, 6); ctx.closePath(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#e9eef6'; ctx.fill(); ctx.restore(); }
        // Claude the samurai: headband + katana guard
        const cx = CX + knock + (cflash > 0 ? Math.sin(clk * 90) * 4 : 0), cy = CY - (g.result === 'win' ? Math.abs(Math.sin(clk * 10)) * 16 : 0);
        shadow(CX, CY + 2, 54, 10, .35);
        const blk = guard !== 'idle' && guardT > .2 ? 1.08 : 1; ctx.save(); ctx.translate(cx, cy); ctx.scale(blk, 2 - blk); ctx.translate(-cx, -cy);
        claude(cx, cy, CU, { mood: g.result === 'lose' || cflash > 0 ? 'sad' : g.result === 'win' ? 'happy' : null, col: cflash > 0 && (clk * 20 | 0) % 2 ? '#fff' : OR });
        const bt = cy - 9 * CU; box(cx - 6 * CU, bt + 1, 12 * CU, 8, '#e8433a', 3);
        for (const j of [0, 1]) { const w = Math.sin(clk * 12 + j) * 6; ctx.beginPath(); ctx.moveTo(cx + 6 * CU, bt + 3 + j * 4); ctx.quadraticCurveTo(cx + 6 * CU + 16, bt - 4 + w, cx + 6 * CU + 32, bt + j * 10 + w); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#e8433a'; ctx.stroke(); }
        ctx.lineCap = 'butt';
        katana(gp[0] + (cx - CX), gp[1] + (cy - CY), gp[2], 128, 0, false);
        ctx.restore();
        if (g.result) {                                                                // outro: stars circle a beaten Claude, hearts float up from a winner
          const oT = rT0 >= 0 ? now - rT0 : 0;
          if (g.result === 'lose') for (let i = 0; i < 3; i++) { const a = oT * 5 + i * 2.09; star(cx + Math.cos(a) * 44, cy - 112 + Math.sin(a) * 10, 10, 5, 4, oT * 3, '#FFE14D', 3); }
          else for (let i = 0; i < 4; i++) { const u = (oT * 1.2 + i / 4) % 1; X = ctx; ctx.globalAlpha = 1 - u * u; heart(cx - fallDir * 70 + (i % 2 ? 14 : -14) +Math.sin(u * 6 + i) * 6, cy - 70 - u * 150, 14, '#ff5c8a', 3.5); ctx.globalAlpha = 1; }
        }
        // HUD: hearts (left) and parries (right), on lacquer and wood plaques
        X = ctx; plank(142, 88, 118, 52, 14, g.result === 'lose' ? '#5a4a60' : '#7a2f3a', '#4b1c26');
        for (let i = 0; i < 2; i++) { const pop = i === hearts && hpop > 0 ? 1 + hpop : 1; heart(170 + i * 50, 116, 17 * pop, i < hearts ? '#ff4d6d' : '#3a2a4a'); }
        if (slashT >= 0 && slashT < .7) {                                               // the finishing diagonal slash
          const a = 1 - slashT / .7; ctx.lineCap = 'round';
          ctx.strokeStyle = INK; ctx.lineWidth = 60 * a + 10; ctx.beginPath(); ctx.moveTo(-OX - 20, 150); ctx.lineTo(W + OX + 20, 470); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 60 * a; ctx.stroke(); ctx.lineCap = 'butt';
          if (slashT < .1) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-OX, 0, VW, H); }
        }
        vignette(.3);
      },
      probe: () => ({ phase: ph, dir, press: ph === 'wind' ? CODE[dir] : null, tap: ph === 'wind' ? PAD[dir] : null, left: +pt.toFixed(3), windT: +tw.toFixed(3), parries, need, hearts, strikes, result: g.result || null })
    };
    return g;
  };
})();
