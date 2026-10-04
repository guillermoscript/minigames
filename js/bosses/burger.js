'use strict';
/* BURGER boss (CUBE PARTY), after Smooth Moves' "Fresh off the Grill": stuff gets thrown onto a burger,
   grab it the instant the sesame TOP BUN lands. Too early (or on a look-alike decoy) loses, too late and a seagull steals it. */
(function () {
  const BUN = '#E8A54B', BUN2 = '#C9802F';
  const SIZE = { bottom: 30, patty: 24, cheese: 10, lettuce: 14, tomato: 12, sneaker: 34, duck: 42, bug: 30, keyboard: 18, hat: 44, ufo: 44, shell: 44, top: 46 };
  const DECOY = { hat: 'A HAT?!', ufo: 'A UFO?!', shell: 'A SHELL?!' };
  const path = (pts, fill, lw = 5) => { ctx.beginPath(); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); };
  const rr = (x, y, w, h, r, fill) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); };
  const ell = (x, y, rx, ry, fill, lw = 5) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fillStyle = fill; ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); } };
  const domeP = h => { ctx.beginPath(); ctx.moveTo(-78, 0); ctx.bezierCurveTo(-80, -h * 1.3, 80, -h * 1.3, 78, 0); ctx.closePath(); };
  const dome = (h, fill) => { domeP(h); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); };
  const SEEDS = [[-40, -26], [-14, -44], [12, -34], [36, -46], [50, -22], [-56, -14], [0, -18], [26, -14]];
  const bun = (h = 46, seeds = SEEDS) => { dome(h, BUN); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-30, -h * .8, 22, 8, -.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#FFF6DC'; for (const [x, y] of seeds) { ctx.beginPath(); ctx.ellipse(x, y, 5, 3, .5, 0, 7); ctx.fill(); } };
  const pop = (a, d) => Math.max(0, Math.min(1, (a - d) * 7));   // decoy tells pop out a beat after landing
  /* every piece is drawn with (0,0) at its bottom centre, ~156px wide */
  const ART = {
    bottom() { rr(-76, -30, 152, 30, [6, 6, 14, 14], BUN); ctx.fillStyle = '#F6C77E'; ctx.fillRect(-70, -27, 140, 6); },
    patty() { rr(-80, -24, 160, 24, 12, '#6B3A1E'); ctx.strokeStyle = '#3e1f0e'; ctx.lineWidth = 4; for (let x = -55; x < 60; x += 28) { ctx.beginPath(); ctx.moveTo(x, -18); ctx.lineTo(x + 14, -6); ctx.stroke(); } },
    cheese() { path([[-84, -10], [84, -10], [84, 0], [62, 0], [56, 12], [48, 0], [0, 0], [-8, 14], [-16, 0], [-56, 0], [-62, 10], [-68, 0], [-84, 0]], '#FFC93C', 4); },
    lettuce() { const p = [[-86, 0]]; for (let x = -86; x <= 86; x += 12) p.push([x, -8 - (x / 12 & 1) * 6]); p.push([86, 0]); for (let x = 80; x > -86; x -= 16) p.push([x, 4 + (x / 16 & 1) * 4]); path(p, '#5CC85C', 4); },
    tomato() { for (const s of [-36, 36]) { ell(s, -6, 42, 8, '#E8433A', 4); ctx.fillStyle = '#FFD1C4'; for (const d of [-14, 0, 14]) ctx.fillRect(s + d - 2, -8, 4, 3); } },
    sneaker() { rr(-62, -12, 128, 12, 5, '#fff'); path([[-62, -12], [-60, -30], [-14, -34], [6, -24], [56, -18], [66, -12]], '#4DB8FF'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; for (let x = -40; x < 0; x += 11) { ctx.beginPath(); ctx.moveTo(x, -31); ctx.lineTo(x + 6, -22); ctx.stroke(); } },
    duck() { ell(0, -16, 44, 16, '#FFE14D'); ell(18, -34, 15, 13, '#FFE14D'); path([[30, -36], [46, -32], [30, -28]], '#FF8A2A', 3); ctx.fillStyle = INK; ctx.fillRect(18, -40, 5, 5); ctx.beginPath(); ctx.moveTo(-34, -18); ctx.quadraticCurveTo(-10, -4, 6, -18); ctx.lineWidth = 3; ctx.stroke(); },
    bug() {   // a bug on its back, legs flailing
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const lx = -26 + i * 11; ctx.beginPath(); ctx.moveTo(lx, -20); ctx.lineTo(lx + Math.sin(now * 30 + i * 2) * 8, -44); ctx.stroke(); }
      ctx.lineCap = 'butt'; ell(0, -14, 48, 15, '#e8433a'); circ(-52, -14, 12, INK, 0); ctx.fillStyle = '#fff'; ctx.fillRect(-58, -18, 4, 4); ctx.fillRect(-51, -18, 4, 4);
      ctx.fillStyle = INK; for (const x of [-22, 4, 28]) { ctx.beginPath(); ctx.arc(x, -12, 5, 0, 7); ctx.fill(); } },
    keyboard() { rr(-74, -18, 148, 18, 4, '#3a3f4b'); ctx.fillStyle = '#e8e8f0'; for (let r = 0; r < 2; r++) for (let x = -66; x < 62; x += 14) ctx.fillRect(x + r * 5, -15 + r * 7, 10, 5); },
    hat(a) {   // tell: a brim and a red band; tips itself after landing
      ctx.rotate(-pop(a, .12) * .12); ell(0, -3, 104, 8, BUN2); bun(44, SEEDS.filter(s => s[1] < -24));
      ctx.save(); domeP(44); ctx.clip(); ctx.fillStyle = '#E8433A'; ctx.fillRect(-90, -19, 180, 11); ctx.restore(); domeP(44); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); },
    ufo(a) {   // tell: a grey saucer rim; lights + antenna switch on and it hovers after landing
      const u = pop(a, .12); ctx.translate(0, -u * (10 + Math.sin(now * 7) * 4));
      if (u) { ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(0, -56 - 22 * u); ctx.stroke(); circ(0, -58 - 22 * u, 7 * u, '#FF4D9E', 3); }
      ell(0, -4, 94, 9, '#9aa3b5'); bun(44, SEEDS);
      for (const x of [-70, -35, 0, 35, 70]) circ(x, -4, 5, u ? ((now * 6 + x / 35) & 1 ? '#5CFF7A' : '#FFE14D') : '#5b6170', 2); },
    shell(a) {   // tell: plate lines instead of seeds; a turtle head and feet pop out after landing
      const u = pop(a, .15); if (u) { for (const x of [-50, 50]) ell(x, -2, 14 * u, 9 * u, '#7BD88F', 4); ell(-80 - 14 * u, -14, 16 * u, 12 * u, '#7BD88F', 4); ctx.fillStyle = INK; ctx.fillRect(-92 - 14 * u, -20, 5 * u, 5 * u); }
      dome(44, BUN); ctx.strokeStyle = BUN2; ctx.lineWidth = 4;
      for (const x of [-38, 0, 38]) { const y = -26 - (x ? 0 : 10); ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3; ctx.lineTo(x + Math.cos(an) * 15, y + Math.sin(an) * 11); } ctx.closePath(); ctx.stroke(); } },
    top() { bun(46); }
  };
  const piece = (k, x, y, rot = 0, sq = 0, sc = 1, a = 0) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc * (1 + sq * .22), sc * (1 - sq * .3)); ART[k](a); ctx.restore(); };
  function gull(x, y, f, dir = 1) {   // a cheeky seagull, (x,y) = belly
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * 1.5, 1.5); const w = Math.sin(f) * 26;
    path([[-10, -14], [-60, -30 - w], [-24, -6]], '#c9d0dc'); path([[10, -14], [60, -30 - w], [24, -6]], '#c9d0dc');
    ell(0, -10, 34, 18, '#fff'); ell(30, -26, 14, 12, '#fff'); path([[40, -28], [62, -22], [40, -18]], '#FF8A2A', 3);
    ctx.fillStyle = INK; ctx.fillRect(32, -32, 5, 5); ctx.restore();
  }

  function poster(x, y, kind, t) {   // diner wall art: fries / soda / a winking cherry, no text
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(x) * .06); box3(-62, -80, 124, 160, kind === 1 ? '#FF4D9E' : kind === 2 ? '#4DB8FF' : '#FFE14D', 5, 6);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 8; i++) { const a = t * .5 + i * .785; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 70, a, a + .3); ctx.fill(); }
    if (kind === 0) { for (let i = -2; i <= 2; i++) path([[i * 11 - 5, 6], [i * 13 - 4, -46 + Math.abs(i) * 6], [i * 13 + 6, -46 + Math.abs(i) * 6], [i * 11 + 5, 6]], '#FFC93C', 3); path([[-36, 0], [36, 0], [28, 52], [-28, 52]], '#E8433A'); }
    else if (kind === 1) { path([[-28, -30], [28, -30], [20, 56], [-20, 56]], '#fff'); ctx.fillStyle = '#E8433A'; ctx.fillRect(-24, 0, 48, 14); ell(0, -32, 32, 9, '#fff', 4); path([[4, -34], [18, -66], [24, -64], [10, -34]], '#E8433A', 3); }
    else { ctx.strokeStyle = '#3a7a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(10, -50, 26, -56); ctx.stroke(); circ(0, 6, 30, '#E8433A', 5); ctx.fillStyle = INK; ctx.fillRect(-14, -4, 6, 10); ctx.fillRect(6, 0, 10, 4); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-12, -8, 7, 4, -.5, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  BOSSES.burger = function (sp, s) {
    const k = Math.min(sp, 1.3), win0 = .68 / Math.sqrt(Math.min(sp, 1.8));   // ~0.52 s at sp 1.7
    const CX = W / 2, BASE = 504, NEED = 3, SILLY = ['sneaker', 'duck', 'bug', 'keyboard'], DEC = shuffle(['hat', 'ufo', 'shell']);
    let round = 0, phase = 'drop', next = .5, queue = [], gaps = [], stack = [], fly = [], win = 0, wob = 0, served = 0, sv = null;
    let resT = 0, how = '', bites = 0, cl = { x: 650, hop: 0, hopIn: 0 }, tpop = 0, gl = null, debris = [], clock = 0, SC = 1.3, reacts = [];
    const H_ = () => stack.reduce((a, p) => a + SIZE[p.k], 0), TOPY = () => BASE - H_() * SC;   // SC zooms out as the stack grows
    /* plan all 3 burgers up front (random counts + random gaps, with suspense pauses), then squeeze the gaps
       so even a player who uses every grab window finishes before the fuse burns out */
    const plan = [0, 1, 2].map(r => {
      const food = shuffle(['patty', 'cheese', 'lettuce', 'tomato']).slice(0, (r < 2 ? 2 : 1) + (Math.random() * 2 | 0));
      const q = shuffle(food.concat(shuffle(SILLY.slice()).slice(0, 1 + (r === 2 && food.length < 2 ? 1 : 0))));
      DEC.slice(0, r).forEach((d, i) => q.splice(i === 0 && Math.random() < .6 ? q.length : 1 + (Math.random() * q.length | 0), 0, d)); q.push('top');   // a decoy often comes right before the real bun
      return { q, gaps: q.map((kd, i) => .3 + Math.random() * .35 + (Math.random() < .25 || (i === q.length - 1 && Math.random() < .6) ? .55 : 0)) };
    });
    const DUR = 12, over = 3 * (.6 / k + win0 + .42) + 1, G = plan.reduce((a, r) => a + r.gaps.reduce((x, y) => x + y, 0), 0) / k, squeeze = Math.min(1, (DUR - over) / G);
    function newRound() {
      queue = plan[round].q.slice(); gaps = plan[round].gaps.map(x => x * squeeze / k);
      stack = [{ k: 'bottom', sq: 1 }]; fly = []; phase = 'drop'; next = gaps.shift(); wob = 1;
    }
    newRound();
    const throwIt = kind => {
      const side = kind === 'top' || DECOY[kind] ? 2 : Math.random() * 2 | 0;   // buns and look-alikes always drop from above
      const sx = side === 0 ? -OX - 90 : side === 1 ? W + OX + 90 : CX + (Math.random() - .5) * 300;
      fly.push({ k: kind, sx, sy: side === 2 ? -60 : 300 + Math.random() * 60, u: 0, T: (.42 + Math.random() * .12) / k, spin: (Math.random() - .5) * 6, arc: side === 2 ? 0 : 110 + Math.random() * 50 });
      sfx.whoosh(side !== 2);
    };
    const landSfx = kind => {
      if (kind === 'duck') snd(900, .12, 'sine', .08, 0, 1400); else if (kind === 'bug') sfx.splat(); else if (kind === 'keyboard') noise(.08, .06, 3000, 5000, 'highpass');
      else if (kind === 'patty') noise(.3, .05, 2500, 4000, 'highpass'); else if (kind === 'top') { sfx.thud(); snd(1320, .18, 'triangle', .06, .02); } else sfx.thud();
    };
    function grab() {
      if (g.result || phase === 'served' || clock < .2) return;
      const topFly = fly.find(f => f.k === 'top');
      if (phase === 'ready' || (topFly && (1 - topFly.u) * topFly.T < .09)) {   // a hair early on the bun still counts
        if (topFly) { for (const f of fly) if (f !== topFly) stack.push({ k: f.k, sq: 1 }); stack.push({ k: 'top', sq: 1 }); fly = []; }
        reacts.push(+(win0 - win).toFixed(3)); served++; sfx.coin(); sfx.pop(); burst(CX, TOPY(), '#FFE14D', 16); ring(CX, (BASE + TOPY()) / 2, '#fff', 150, .4); shake(4, .15);
        if (served >= NEED) { g.result = 'win'; how = 'bite'; resT = 0; sfx.sparkle(); tpop = 1; return; }
        floatText('NICE!', CX, TOPY() - 40, '#5CFF7A', 40); phase = 'served'; sv = { t: 0, items: stack, x: CX, y: BASE };
        return;
      }
      const top = stack[stack.length - 1].k;   // too early: the whole thing topples
      g.result = 'lose'; how = 'early'; resT = 0; sfx.buzz(); sfx.thud(); shake(10, .3);
      if (DECOY[top]) floatText(DECOY[top], CX, 480, '#FFE14D', 44);
      let y = BASE; debris = stack.map(p => { y -= SIZE[p.k] * SC; return { k: p.k, x: CX, y: y + SIZE[p.k] * SC, vx: (Math.random() - .5) * 700, vy: -300 - Math.random() * 400, r: 0, vr: (Math.random() - .5) * 12 }; });
      for (const f of fly) debris.push({ k: f.k, x: f.x, y: f.y, vx: (Math.random() - .5) * 500, vy: -200, r: f.r || 0, vr: 6 });
      stack = []; fly = [];
    }
    const g = {
      cmd: 'BOSS!', hint: 'GRAB WHEN TOP BUN LANDS!', thint: 'TAP WHEN TOP BUN LANDS!', dur: DUR, boss: true, wide: true,
      key(e) { if (e.code === 'Space' || e.code === 'Enter') grab(); },
      down() { grab(); },
      update(dt) {
        clock += dt; if (!g.result && phase !== 'served') SC += (Math.min(1.3, 270 / H_()) - SC) * Math.min(1, dt * 5); wob = Math.max(.25, wob - dt * 1.6); cl.hop = Math.max(0, cl.hop - dt * 3);
        for (const p of stack) { p.sq = Math.max(0, (p.sq || 0) - dt * 5); p.age = (p.age || 0) + dt; }
        tpop = Math.max(0, tpop - dt * 3); if (cl.hopIn > 0 && (cl.hopIn -= dt) <= 0) { cl.hop = .6; snd(520, .1, 'square', .05, 0, 880); }
        if (g.result) {
          resT += dt;
          if (how === 'early') for (const d of debris) { d.vy += 1500 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.vr * dt; }
          if (how === 'late' && gl) { gl.t += dt; const u = Math.min(1, gl.t / .3); gl.x = -OX - 80 + (CX - 20 + OX + 80) * u; gl.y = 160 + (TOPY() - 30 - 160) * u; if (gl.t > .3) { gl.x += (gl.t - .3) * 900; gl.y -= (gl.t - .3) * 140; } }
          if (how === 'bite') { cl.x += (CX + 78 * SC + 30 - cl.x) * Math.min(1, dt * 10); const b = Math.min(3, Math.floor((resT - .15) / .2) + 1); if (resT > .15 && b > bites) { bites = b; sfx.splat(); snd(300, .08, 'square', .06, 0, 120); burst(CX + 70 * SC, BASE - H_() * SC * (bites * .2 + .1), '#E8A54B', 10); shake(6, .12); cl.hop = 1; if (bites === 1) floatText('CHOMP!', CX + 120, 170, '#FFE14D', 60); } }
          return;
        }
        if (phase === 'served') {   // the finished burger zooms up into the order tracker, a new bun lands
          sv.t += dt * 2.4; if (sv.t >= 1) { round++; newRound(); sfx.boing(); tpop = 1; }
          return;
        }
        if (phase === 'ready') { win -= dt; if (win <= 0) { g.result = 'lose'; how = 'late'; resT = 0; gl = { t: 0, x: -OX - 80, y: 160 }; snd(700, .14, 'sawtooth', .07, 0, 500); snd(760, .16, 'sawtooth', .07, .16, 480); } return; }
        next -= dt;
        if (next <= 0 && queue.length) { const kind = queue.shift(); throwIt(kind); next = gaps.shift() || 0; }
        for (let i = fly.length - 1; i >= 0; i--) {
          const f = fly[i]; f.u += dt / f.T; const ty = TOPY(), u = Math.min(1, f.u);
          f.x = f.sx + (CX - f.sx) * u; f.y = f.sy + (ty - f.sy) * u * u - f.arc * 4 * u * (1 - u); f.r = f.spin * (1 - u);
          if (f.u >= 1) {
            fly.splice(i, 1); stack.push({ k: f.k, sq: 1 }); wob = Math.min(2.4, wob + .5 + stack.length * .08); landSfx(f.k); burst(CX, ty, '#fff', 5, 160);
            if (f.k === 'top') { phase = 'ready'; win = win0; ring(CX, ty - 30, '#FFE14D', 120, .3); }
            else if (DECOY[f.k]) cl.hopIn = .3;   // Claude notices a beat later
          }
        }
      },
      draw(t) {
        bg('#2a6f78', '#317f89', t);
        // diner: checker wainscot, chrome rail, red counter
        for (let x = -OX - (OX % 40) - 40, i = 0; x < W + OX; x += 40, i++) for (let r = 0; r < 2; r++) { ctx.fillStyle = (i + r) & 1 ? '#f4efe6' : '#24202e'; ctx.fillRect(x, 432 + r * 40, 40, 40); }
        for (const [x, kd] of [[120, 0], [680, 1], [-150, 2], [950, 2], [-420, 1], [1220, 0]]) if (x > -OX - 70 && x < W + OX + 70) poster(x, 290, kd, t);
        ctx.fillStyle = INK; ctx.fillRect(-OX, 506, VW, 8); ctx.fillStyle = '#cfd6e0'; ctx.fillRect(-OX, 508, VW, 10); ctx.fillStyle = '#fff'; ctx.fillRect(-OX, 509, VW, 3);
        ctx.fillStyle = INK; ctx.fillRect(-OX, 518, VW, 4); ctx.fillStyle = '#e04e4e'; ctx.fillRect(-OX, 522, VW, 80); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-OX, 522, VW, 8);
        // order tracker
        const lit = served - (phase === 'served' && !g.result ? 1 : 0);
        if (g.result !== 'lose') for (let i = 0; i < NEED; i++) { const x = CX + (i - 1) * 64, done = i < lit, pul = (i === lit && !g.result ? 1 + Math.sin(now * 8) * .05 : 1) + (i === lit - 1 ? tpop * .4 : 0);
          circ(x, 112, 26 * pul, done ? '#5CFF7A' : 'rgba(255,255,255,.18)', 4); ctx.globalAlpha = done ? 1 : .45; piece('bottom', x, 124, 0, 0, .2); piece('patty', x, 118, 0, 0, .2); piece('top', x, 113, 0, 0, .2); ctx.globalAlpha = 1; }
        // plate + stack (wobbles more the taller it gets)
        shadow(CX, 512, 150, 16, .3); ell(CX, 506, 136, 13, '#fff', 4); ell(CX, 504, 100, 7, '#e6e9f0', 0);
        const drawStack = (items, bx, by, sc = SC, bite = 0) => {
          ctx.save(); ctx.translate(bx, by); ctx.scale(sc, sc);
          if (bite) { ctx.beginPath(); ctx.rect(-200, -400, 400, 420); for (let i = 0; i < bite; i++) ctx.arc(92, -H_() * (i + 1) * .13 - 8, 44, 0, 7); ctx.clip('evenodd'); }
          let y = 0, n = items.length;
          items.forEach((p, i) => { const hh = -y / 100, off = Math.sin(now * 7 + .3) * wob * hh * hh * 9; piece(p.k, off, y, off * .004, p.sq || 0, 1, p.age || 0); y -= SIZE[p.k]; });
          ctx.restore();
          if (phase === 'ready' && items === stack && !g.result) {   // steam + shrinking ring: the bun is hot, grab it!
            const ty = by + y * sc, cy = ty + 30, u = win / win0;
            ctx.lineCap = 'round'; for (let j = -1; j <= 1; j++) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 6; ctx.beginPath(); for (let q = 0; q < 6; q++) ctx.lineTo(bx + j * 34 + Math.sin(now * 12 + q + j) * 6, ty - 22 - q * 9 - (1 - u) * 16); ctx.stroke(); } ctx.lineCap = 'butt';
            ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(bx, cy, 112 + 70 * u, 48 + 34 * u, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = '#FFE14D'; ctx.stroke();
          }
          return n;
        };
        if (phase === 'served' && sv) { const u = Math.min(1, sv.t), e = u * u; drawStack(sv.items, CX + (served - 2) * 64 * e, BASE + (124 - BASE) * e, SC - (SC - .2) * e); }
        else if (how === 'late' && gl && gl.t > .3) { drawStack(stack, gl.x + 20, gl.y + 30 + H_() * SC); }
        else drawStack(stack, CX, BASE, SC, how === 'bite' ? bites : 0);
        for (const f of fly) piece(f.k, f.x, f.y, f.r, 0, SC);
        for (const d of debris) piece(d.k, d.x, d.y, d.r, 0, SC);
        if (gl) gull(gl.x, gl.y, now * 22);
        // Claude at the counter: watches nervously, hops on decoys, chomps at the end
        const nerv = phase === 'ready' && !g.result ? Math.sin(now * 40) * 2 : 0;
        shadow(cl.x, 514, 50, 10); claude(cl.x + nerv, 512 - Math.sin(cl.hop * Math.PI) * 34, 6.5, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' || phase === 'served' ? 'happy' : null });
        if (how === 'early' || how === 'late') txt(how === 'early' ? 'NOT YET!' : 'TOO SLOW!', W / 2, 150 + Math.sin(now * 20) * 3, 58, '#FF4D4D');   // above the FAIL stamp
        vignette(.3);
      },
      probe: () => ({ phase, round, served, need: NEED, top: stack.length ? stack[stack.length - 1].k : null, decoyOnTop: !!(stack.length && DECOY[stack[stack.length - 1].k]),
        flying: fly.map(f => f.k), topIn: (f => f ? +((1 - f.u) * f.T).toFixed(3) : null)(fly.find(f => f.k === 'top')), queue: queue.length, grabNow: phase === 'ready' && !g.result, windowLeft: +win.toFixed(3), window: +win0.toFixed(3), result: g.result || null, how, reacts })
    };
    return g;
  };
})();
