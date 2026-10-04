'use strict';
/* BATTER boss (SPORTS DAY): batting practice against a goofy pitching machine, seen from behind Claude.
   After Mega Microgame$' "Ultra Machine" / Gold's "One Hit Wonder". Pitches: normal, FASTBALL, CHANGE-UP (slow, wobbly)
   and a TRICK pitch that stops mid-air once. Swing as the ball reaches the ring: 5 hits win, 3 strikes lose. */
(function () {
  const VX = 400, HZ = 200, GK = 320, gy = z => HZ + GK / z, gx = (X, z) => VX + X * GK / z;   // ground projection
  const MX = 400, MY = gy(4), MS = .9, OX0 = MX, OY0 = MY - 56 * MS;                             // machine on the mound
  const CX = 292, CY = 534, CU = 8, PX = CX + 7 * CU, PY = CY - 5.5 * CU, ZX = 410, ZY = 446;    // Claude, hands, zone
  const NEED = 5, OUTS = 3, PITCHES = 7, HP = .75, A0 = -2.3, A1 = .5, LATE = .03, APR = .42;   // APR: approach-ring lead time
  const TYPES = { N: { fly: .82, wind: .4 }, F: { fly: .58, wind: .5, label: 'FASTBALL!', col: '#ff5a4d' },
    C: { fly: 1.3, wind: .5, label: 'CHANGE-UP!', col: '#7ad7ff' }, S: { fly: .8, wind: .5, label: 'TRICK PITCH!', col: '#c78bff' } };
  const zOf = p => p <= 1 ? 4 - 3 * p : Math.max(.3, 1 - 1.2 * (p - 1)), wOf = z => (1 / z - .25) / .75;
  const ease = u => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  const crack = () => { noise(.07, .3, 3500, 7000, 'highpass'); snd(1500, .05, 'square', .06, 0, 600); snd(180, .14, 'triangle', .1); };
  const pomp = () => { snd(150, .12, 'sine', .14, 0, 55); noise(.1, .12, 500); };
  const SKY = ['#ff4d9e', '#FFE14D', '#4DB8FF', '#5CFF7A', '#fff', '#D97757', '#c78bff'];

  function baseball(x, y, r, rot) {
    circ(x, y, r, '#fbf8ef', Math.max(2, r * .16));
    if (r < 6) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = '#e8433a'; ctx.lineWidth = Math.max(1.5, r * .12);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * r * 1.25, 0, r * .8, (sd > 0 ? Math.PI : 0) - .9, (sd > 0 ? Math.PI : 0) + .9); ctx.stroke(); }
    ctx.restore();
  }
  function machine(o) {                                   // pitching machine with a face; o: {type, wu, mood, clk, sq, open, ws, left}
    const c = o.clk, win = o.wu >= 0, F = win && o.type === 'F', sh = F ? Math.sin(c * 70) * 3 : o.mood === 'laugh' ? Math.sin(c * 40) * 2 : 0;
    const rock = o.mood === 'ko' ? .3 : win && o.type === 'C' ? Math.sin(c * 4) * .12 : win && o.type === 'S' ? Math.sin(c * 9) * .08 : 0;
    ctx.save(); ctx.translate(MX + sh, MY); ctx.rotate(rock); ctx.scale(MS * (1 + o.sq * .18), MS * (1 - o.sq * .22));
    ctx.lineCap = 'round';
    for (const [w, col] of [[10, INK], [4, '#9a96ad']]) { ctx.strokeStyle = col; ctx.lineWidth = w; for (const [x, y] of [[-38, 2], [38, 2], [0, 6]]) { ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(x, y); ctx.stroke(); } }
    ctx.beginPath(); ctx.moveTo(-34, -96); ctx.lineTo(-48, -130); ctx.lineTo(48, -130); ctx.lineTo(34, -96); ctx.closePath();   // hopper = balls left
    ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#d8d4e6'; ctx.fill();
    for (let i = 0; i < o.left; i++) circ(-30 + (i % 4) * 20 + (i > 3 ? 10 : 0), i > 3 ? -136 : -122, 8, '#fbf8ef', 3);
    box(-52, -98, 104, 60, F && (c * 16 | 0) % 2 ? '#ff5a4d' : o.mood === 'ko' ? '#5b5470' : '#4d7cff', 5);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-52, -98, 104, 8);
    for (const sd of [-1, 1]) {                              // spinning wheels
      circ(sd * 58, -66, 24, '#3a3550', 5); ctx.strokeStyle = '#8d88a6'; ctx.lineWidth = 4;
      for (let k = 0; k < 3; k++) { const a = o.ws * sd + k * 2.09; ctx.beginPath(); ctx.moveTo(sd * 58, -66); ctx.lineTo(sd * 58 + Math.cos(a) * 19, -66 + Math.sin(a) * 19); ctx.stroke(); }
      circ(sd * 58, -66, 6, '#FFE14D', 3);
    }
    for (const sd of [-1, 1]) {                              // googly eyes + brows per mood / pitch
      const ex = sd * 20, ey = -78; ctx.strokeStyle = INK; ctx.lineWidth = 5;
      if (o.mood === 'ko') { ctx.beginPath(); ctx.moveTo(ex - 8, ey - 8); ctx.lineTo(ex + 8, ey + 8); ctx.moveTo(ex + 8, ey - 8); ctx.lineTo(ex - 8, ey + 8); ctx.stroke(); continue; }
      if (o.mood === 'laugh') { ctx.beginPath(); ctx.moveTo(ex - 9, ey + 4); ctx.lineTo(ex, ey - 5); ctx.lineTo(ex + 9, ey + 4); ctx.stroke(); continue; }
      if (win && o.type === 'S' && sd > 0) { ctx.beginPath(); ctx.moveTo(ex - 9, ey); ctx.lineTo(ex + 9, ey); ctx.stroke(); continue; }   // wink
      const big = o.mood === 'shock'; circ(ex, ey, big ? 13 : 11, '#fff', 3);
      const j = Math.sin(c * 23 + sd) * (big ? 1 : 2.5); circ(ex + j, ey + (big ? 0 : 2), big ? 3 : 5, INK, 0);
      if (win && o.type === 'C') { ctx.fillStyle = '#4d7cff'; ctx.fillRect(ex - 13, ey - 14, 26, 12); ctx.beginPath(); ctx.moveTo(ex - 13, ey - 2); ctx.lineTo(ex + 13, ey - 2); ctx.stroke(); }
      if (F) { ctx.beginPath(); ctx.moveTo(ex - sd * 13, ey - 19); ctx.lineTo(ex + sd * 9, ey - 10); ctx.stroke(); }
      if (win && o.type === 'S') { ctx.beginPath(); ctx.arc(ex, ey - 12, 12, -2.6, -.5); ctx.stroke(); }
    }
    const op = o.mood === 'laugh' ? .8 + Math.sin(c * 40) * .2 : o.mood === 'shock' ? 1 : o.open;    // mouth = the ball chute
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, -55, 15 + op * 3, 4 + op * 9, 0, 0, 7); ctx.fill();
    if (win && o.left >= 0) baseball(0, -55, 6, 0);
    if (o.mood === 'laugh') { ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.ellipse(0, -49, 8, 4, 0, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  BOSSES.batter = function (sp) {
    const k = Math.sqrt(Math.min(sp, 1.3)), win = .17 - .04 * Math.min(sp, 1.3), AFT = .32 / k;
    const order = ['N'].concat(shuffle(['F', 'C', 'S', 'N', Math.random() < .5 ? 'F' : 'C', 'N']));
    let ph = 'ready', pt = .35, idx = -1, hits = 0, strikes = 0, clk = 0, stop = 0, ball = null, swingT = -1, lastCall = null;
    let msq = 0, mopen = 0, ws = 0, mmood = null, mmoodT = 0, crowdJ = 0, cflash = 0, joy = 0, smoke = [];
    const outs = [], crowd = [];
    for (let r = 0; r < 3; r++) for (let x = -700; x < 1500; x += 17) crowd.push({ x: x + r * 8, y: 146 + r * 17, c: SKY[(x * 7 + r * 3 & 255) % SKY.length], ph: x * .37 + r });
    const cur = () => TYPES[order[idx]] || TYPES.N;
    const dur = Math.ceil((.35 + order.reduce((s, ty) => s + (TYPES[ty].wind + TYPES[ty].fly + (ty === 'S' ? .5 : 0)) / k + win + LATE + AFT, 0) + .9) * 2) / 2;
    const pOf = b => b.type !== 'S' ? b.tau / b.f : b.tau < b.a ? HP * b.tau / b.a : b.tau < b.a + b.h ? HP : HP + (1 - HP) * (b.tau - b.a - b.h) / b.c;
    function bpos(b) {
      const p = pOf(b), z = zOf(p), w = wOf(z), q = Math.min(1, p);
      let x = OX0 + (ZX - OX0) * w, y = OY0 + (ZY - OY0) * w - Math.sin(q * Math.PI) * (b.type === 'C' ? 70 : 16);
      if (b.type === 'C') x += Math.sin(b.tau * 13) * 26 * (1 - q);
      if (b.type === 'S' && p === HP) x += Math.sin(clk * 70) * 2;
      return { p, z, x, y, r: 24 / z };
    }
    function startWind() { idx++; ph = 'wind'; pt = cur().wind / k; sfx.tick(); const ty = order[idx];
      if (ty === 'F') snd(260, pt, 'sawtooth', .03, 0, 1100); else if (ty === 'C') snd(520, pt, 'triangle', .04, 0, 200); else if (ty === 'S') { sfx.blip(3); sfx.blip(7); } }
    function release() {
      const ty = order[idx], f = TYPES[ty].fly / k; ph = 'fly'; msq = .7; mopen = 1; pomp();
      ball = { type: ty, tau: 0, f, judged: false, swung: false, hovered: false };
      if (ty === 'S') { ball.a = .5 * f / .8; ball.c = .42 * f / .8; ball.h = (.3 + Math.random() * .25) / k; ball.arr = ball.a + ball.h + ball.c; } else ball.arr = f;
      if (ty === 'F') sfx.zap(); if (ty === 'C') sfx.boing();
    }
    function judged() { ball.judged = true; ph = 'after'; pt = AFT; }
    function strike(msg) {
      judged(); strikes++; lastCall = { idx, t: clk };
      floatText('STRIKE!', ZX + 150, ZY - 50, '#ff4d4d', 50); if (msg) floatText(msg, ZX + 150, ZY - 5, '#fff', 26);
      sfx.buzz(); shake(6, .2); cflash = .45; mmood = 'laugh'; mmoodT = .9; floatText('HA HA!', MX - 125, MY - 75, '#fff', 24);
      if (strikes >= OUTS) { g.result = 'lose'; mmoodT = 99; sfx.miss(); }
    }
    function hit(d) {
      const b = bpos(ball), hr = Math.abs(d) <= .045, side = Math.random() < .5 ? -1 : 1;
      judged(); hits++; stop = hr ? .12 : .07; ball.hitOut = true;
      const e = Math.min(1, Math.max(0, (Math.atan2(b.y - PY, b.x - PX - 8) - A0) / (A1 - A0))); swingT = .11 * (1 - Math.cbrt(1 - e));   // freeze on the bat meeting the ball
      outs.push({ x0: b.x, y0: b.y, r0: b.r, hr, t: 0, d: hr ? 1.3 : .9, tx: 400 + side * (hr ? 230 + Math.random() * 150 : 150 + Math.random() * 220), ty: hr ? 172 + Math.random() * 18 : 222 + Math.random() * 20, trail: [] });
      ball = null; crack(); shake(hr ? 14 : 8, .25); burst(b.x, b.y, '#FFE14D', 18, 420); burst(b.x, b.y, '#fff', 8, 300); ring(b.x, b.y, '#fff', 90, .3);
      floatText(hr ? 'HOME RUN!' : 'NICE HIT!', ZX + 20, ZY - 105, hr ? '#FFE14D' : '#5CFF7A', hr ? 54 : 44);
      if (hr) { sfx.sparkle(); [660, 880, 1320].forEach((f, i) => snd(f, .12, 'square', .05, .08 * i)); } else sfx.coin();
      sfx.blip(hits * 2); crowdJ = 1; joy = .5; mmood = 'shock'; mmoodT = .6;
      if (hits >= NEED) { g.result = 'win'; mmood = 'ko'; mmoodT = 99; confetti(MX, MY - 60, 60); setTimeout(() => sfx.splat(), 150); }
    }
    function swing() {
      if (g.result) return;
      swingT = 0; sfx.whoosh();
      if (lastCall && lastCall.idx === idx && clk - lastCall.t < .35 && ball && !ball.swung) { ball.swung = true; floatText('TOO LATE!', ZX + 150, ZY - 5, '#fff', 26); }
      if (!ball || ball.judged || ball.swung) return;      // between pitches: harmless practice swing
      ball.swung = true; const d = ball.tau - ball.arr;
      if (d >= -win && d <= win + LATE) hit(d); else strike('TOO EARLY!');
    }
    const g = {
      cmd: 'BOSS!', hint: 'CLICK/SPACE AS BALL HITS RING', thint: 'TAP AS BALL HITS RING', dur, boss: true, wide: true,
      key(e) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') swing(); },
      down() { swing(); },
      update(dt) {
        if (stop > 0) { stop -= dt; return; }                 // hit-stop on contact: bat and ball freeze together
        for (const o of outs) { o.t += dt; const u = ease(o.t / o.d); o.x = o.x0 + (o.tx - o.x0) * u; o.y = o.y0 + (o.ty - o.y0) * u - Math.sin(u * Math.PI) * (o.hr ? 90 : 50); o.r = o.r0 + (2.5 - o.r0) * u;
          o.trail.push([o.x, o.y, o.r]); if (o.trail.length > 16) o.trail.shift();
          if (o.t >= o.d && !o.done) { o.done = true; if (o.hr) { confetti(o.x, o.y, 30); burst(o.x, o.y, '#FFE14D', 16, 200); ring(o.x, o.y, '#FFE14D', 60, .5); sfx.sparkle(); } } }
        for (let i = outs.length - 1; i >= 0; i--) if (outs[i].t > outs[i].d + .5) outs.splice(i, 1);
        for (const s of smoke) { s.y -= 40 * dt; s.r += 14 * dt; s.a -= dt * .7; }
        clk += dt; msq *= Math.pow(.01, dt); mopen = Math.max(0, mopen - dt * 2.5); crowdJ = Math.max(0, crowdJ - dt * 1.6);
        cflash = Math.max(0, cflash - dt); joy = Math.max(0, joy - dt); ws += dt * (ph === 'wind' && order[idx] === 'F' ? 40 : ph === 'wind' ? 14 : 4);
        if (swingT >= 0) { swingT += dt; if (swingT > .6) swingT = -1; }
        if ((mmoodT -= dt) <= 0) mmood = null;
        if (g.result === 'win' && Math.random() < dt * 8) smoke.push({ x: MX + (Math.random() - .5) * 60, y: MY - 100, r: 8, a: .8 });
        for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].a <= 0) smoke.splice(i, 1);
        if (ball) {
          ball.tau += dt; const p = pOf(ball);
          if (ball.type === 'S' && p === HP && !ball.hovered) { ball.hovered = true; snd(900, .07, 'square', .04); snd(700, .07, 'square', .04, .09); }
          if (!ball.judged && !g.result && ball.tau > ball.arr + win + LATE) strike(null);
          if (p > 1.5) { sfx.thud(); ball = null; }
        }
        if (g.result) return;
        if (ph === 'ready' || ph === 'after') { if ((pt -= dt) <= 0 && idx < PITCHES - 1) startWind(); }
        else if (ph === 'wind' && (pt -= dt) <= 0) release();
      },
      draw(t) {
        const sk = ctx.createLinearGradient(0, 0, 0, HZ + 10); sk.addColorStop(0, '#2b1d5e'); sk.addColorStop(.55, '#d9457b'); sk.addColorStop(1, '#ffb44d');
        ctx.fillStyle = sk; ctx.fillRect(-OX, 0, VW, HZ + 10);
        ctx.fillStyle = 'rgba(255,225,140,.13)'; for (let i = 0; i < 12; i++) { const a = t * .08 + i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(150, 150); ctx.arc(150, 150, 900, a, a + .14); ctx.fill(); }
        circ(150, 150, 66, '#ffd36b', 0); circ(150, 150, 50, '#fff0b8', 0);
        ctx.fillStyle = 'rgba(80,40,110,.55)'; for (const [x, y, w] of [[-120, 70, 120], [300, 56, 90], [640, 84, 140], [1000, 64, 110]]) { const cx = (x + t * 8) % (VW + 300) - OX - 150; ctx.beginPath(); ctx.ellipse(cx, y, w, 13, 0, 0, 7); ctx.ellipse(cx + w * .3, y - 10, w * .45, 12, 0, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#3b2a5c'; ctx.fillRect(-OX, 132, VW, 72); ctx.fillStyle = INK; ctx.fillRect(-OX, 128, VW, 5);   // stands + crowd
        for (const c of crowd) { if (c.x < -OX - 10 || c.x > W + OX + 10) continue; const j = Math.abs(Math.sin(t * (6 + crowdJ * 8) + c.ph)) * (1.5 + crowdJ * 9);
          ctx.fillStyle = c.c; ctx.beginPath(); ctx.arc(c.x, c.y - j, 6, 0, 7); ctx.fill(); ctx.fillRect(c.x - 6, c.y - j, 12, 9); }
        box(-OX - 10, 196, VW + 20, 14, '#1d6b45', 4); ctx.fillStyle = '#FFE14D'; ctx.fillRect(-OX, 192, VW, 4);           // outfield wall
        ctx.fillStyle = '#4fb35a'; ctx.fillRect(-OX, 208, VW, H - 208);
        for (let i = 0; i < 14; i++) {                                                                                       // mowed stripes
          const z0 = 12 / Math.pow(1.22, i), z1 = z0 / 1.22; ctx.fillStyle = i % 2 ? '#3f9a4a' : '#4fb35a'; ctx.fillRect(-OX, gy(z0), VW, gy(z1) - gy(z0) + 1); }
        const poly = (pts, fill, o) => { ctx.beginPath(); for (const [X, z] of pts) ctx.lineTo(gx(X, z), gy(z)); ctx.closePath(); if (o) { ctx.lineWidth = o; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); } ctx.fillStyle = fill; ctx.fill(); };
        poly([[-.7, .82], [-2.7, 2.6], [-1.6, 5], [0, 7.5], [1.6, 5], [2.7, 2.6], [.7, .82]], '#c98a4f', 5);              // infield dirt
        poly([[0, 1.35], [-1.75, 2.75], [0, 5.6], [1.75, 2.75]], '#45a650', 0);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(gx(0, 1), gy(1)); ctx.lineTo(gx(sd * 14.5, 12), gy(12)); ctx.stroke(); }
        for (const [X, z] of [[-1.75, 2.75], [0, 5.6], [1.75, 2.75]]) { const x = gx(X, z), y = gy(z), s = 60 / z; box(x - s / 2, y - s / 5, s, s / 2.5, '#fff', 3); }
        ctx.fillStyle = '#b97a42'; ctx.beginPath(); ctx.ellipse(MX, MY, 64, 13, 0, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(400, 508); ctx.lineTo(436, 516); ctx.lineTo(430, 530); ctx.lineTo(370, 530); ctx.lineTo(364, 516); ctx.closePath();   // home plate
        ctx.lineWidth = 5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.strokeRect(232, 496, 116, 56); ctx.strokeRect(452, 496, 116, 56);
        for (const s of smoke) { ctx.fillStyle = `rgba(60,55,80,${Math.max(0, s.a)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
        const ty = idx >= 0 ? order[idx] : 'N', wu = ph === 'wind' && !g.result ? 1 - pt / (cur().wind / k) : -1;
        shadow(MX, MY + 2, 50, 9, .35);
        machine({ type: ty, wu, mood: mmood, clk, sq: msq, open: Math.max(mopen, wu > 0 ? wu * .6 : 0), ws, left: idx < 0 ? PITCHES : PITCHES - idx - 1 });
        if (ty === 'F' && wu >= 0) for (let i = 0; i < 3; i++) { const u = (clk * 2 + i / 3) % 1; ctx.fillStyle = `rgba(255,255,255,${.7 * (1 - u)})`; ctx.beginPath(); ctx.arc(MX - 30 + i * 30, MY - 130 - u * 50, 7 + u * 10, 0, 7); ctx.fill(); }
        const T = TYPES[ty]; if (T.label && ((ph === 'wind' && !g.result) || (ball && !ball.judged && ball.tau < .35)))
          txt(T.label, MX + 94, 238, 26 * (wu >= 0 ? .8 + .2 * ease(wu * 4) : 1), T.col, 'left');
        for (const o of outs) {                                                       // batted balls + sparkle trail
          o.trail.forEach(([x, y, r], i) => { const a = i / o.trail.length; ctx.globalAlpha = a * .8; star(x, y, r * 1.6 * a + 3, r * .6 * a + 1, 4, i, i % 2 ? '#FFE14D' : '#fff', 0); });
          ctx.globalAlpha = 1; if (o.t < o.d) baseball(o.x, o.y, o.r, o.t * 20); }
        // strike zone ring: glows in the hit window
        const live = ball && !ball.judged && !g.result, hot = live && Math.abs(ball.tau - ball.arr) <= win;
        ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(ZX, ZY, 36, 0, 7); ctx.stroke();
        ctx.lineWidth = 5; ctx.strokeStyle = hot ? '#5CFF7A' : live ? '#fff' : 'rgba(255,255,255,.55)'; ctx.setLineDash(hot ? [] : [10, 8]); ctx.lineDashOffset = -clk * 20; ctx.stroke(); ctx.setLineDash([]);
        if (hot) { ctx.fillStyle = 'rgba(92,255,122,.25)'; ctx.fill(); }
        const rem = live ? ball.arr - ball.tau : -1;                               // approach ring closes onto the zone at arrival
        if (rem > 0 && rem < APR && (ball.type !== 'S' || ball.tau >= ball.a + ball.h)) { const u = rem / APR;
          ctx.globalAlpha = 1 - u * .6; ctx.lineWidth = 5; ctx.strokeStyle = '#FFE14D'; ctx.beginPath(); ctx.arc(ZX, ZY, 36 + u * 95, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
        const fade = b => Math.min(1, Math.max(0, (545 - b.y) / 60));                 // missed balls fade before the fuse bar
        if (ball) { const b = bpos(ball); if (b.z > .6) shadow(b.x, Math.min(gy(Math.max(b.z, .6)), 540), b.r * .9, b.r * .25, .3 * fade(b)); }
        // Claude at bat: helmet, waggle, swing with a smear
        const lean = swingT >= 0 && swingT < .35 ? 8 : 0, bob = joy > 0 ? Math.abs(Math.sin(clk * 18)) * 10 : 0, cx = CX + lean;
        shadow(CX, CY + 2, 56, 10, .35);
        let a = A0 + Math.sin(clk * (ph === 'wind' ? 9 : 3)) * (ph === 'wind' ? .1 : .05);
        if (swingT >= 0) a = swingT < .35 ? A0 + (A1 - A0) * ease(swingT / .11) : A1 + (A0 - A1) * ease((swingT - .35) / .22);
        if (g.result === 'win') a = A0 - .3 + Math.sin(clk * 12) * .4;
        if (swingT >= 0 && swingT < .3) { ctx.globalAlpha = .55 * (1 - swingT / .3); ctx.strokeStyle = '#fff'; ctx.lineWidth = 34; ctx.beginPath(); ctx.arc(PX + lean, PY - bob, 96, A0, a); ctx.stroke(); ctx.globalAlpha = 1; }
        claude(cx, CY - bob, CU, { mood: g.result === 'lose' || cflash > 0 ? 'sad' : g.result === 'win' || joy > 0 ? 'happy' : null, col: cflash > 0 && (clk * 20 | 0) % 2 ? '#fff' : OR });
        const hy = CY - bob - 9 * CU; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(cx, hy + 2, 6.8 * CU, 4.6 * CU, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#2f4fd6'; ctx.beginPath(); ctx.ellipse(cx, hy + 2, 6.8 * CU - 5, 4.6 * CU - 5, 0, Math.PI, 0); ctx.fill(); box(cx + 3 * CU, hy - 2, 5 * CU, 6, '#2f4fd6', 3);
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(cx - 2 * CU, hy - 2.4 * CU, 2 * CU, 1 * CU, -.3, 0, 7); ctx.fill();
        star(cx, hy - 1.8 * CU, 9, 4, 5, -Math.PI / 2, '#FFE14D', 2);
        ctx.save(); ctx.translate(PX + lean, PY - bob); ctx.rotate(a); ctx.beginPath();
        ctx.moveTo(-4, -4.5); ctx.lineTo(38, -5); ctx.quadraticCurveTo(72, -12, 116, -11); ctx.arc(116, 0, 11, -Math.PI / 2, Math.PI / 2); ctx.quadraticCurveTo(72, 12, 38, 5); ctx.lineTo(-4, 4.5); ctx.closePath();
        ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#e0a65a'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(45, -3); ctx.lineTo(112, -6); ctx.stroke();
        ctx.fillStyle = '#2b2140'; ctx.fillRect(-4, -5, 26, 10); circ(-7, 0, 6, '#2b2140', 3); ctx.restore();
        box(PX + lean - 8, PY - bob - 8, 16, 16, OR, 3);
        if (ball) { const b = bpos(ball); if (fade(b) > 0) { ctx.globalAlpha = fade(b);
          if (ball.type === 'F') { ctx.strokeStyle = 'rgba(255,90,77,.7)'; ctx.lineCap = 'round'; ctx.lineWidth = b.r * 1.2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - (b.x - OX0) * .25, b.y - (b.y - OY0) * .25); ctx.stroke(); ctx.lineCap = 'butt'; }
          baseball(b.x, b.y, b.r, ball.tau * (ball.type === 'C' ? 4 : 25));
          if (ball.type === 'S' && b.p === HP) txt('?!', b.x + 22, b.y - 26, 26, '#c78bff'); ctx.globalAlpha = 1; } }
        // HUD scoreboard: hits (left) and strikes (right)
        box3(212, 86, 376, 48, '#1d4d3a', 5, 6);
        txt('HITS', 290, 98, 16, '#fff'); txt('STRIKES', 500, 98, 16, '#fff');
        for (let i = 0; i < NEED; i++) { if (i < hits) baseball(242 + i * 24, 119, 9, 0); else circ(242 + i * 24, 119, 8, '#0f2e22', 3); }
        for (let i = 0; i < OUTS; i++) { const x = 470 + i * 30; circ(x, 119, 10, i < strikes ? '#ff4d4d' : '#0f2e22', 3);
          if (i < strikes) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 5, 114); ctx.lineTo(x + 5, 124); ctx.moveTo(x + 5, 114); ctx.lineTo(x - 5, 124); ctx.stroke(); } }
        ctx.fillStyle = '#FFE14D'; ctx.fillRect(398, 92, 4, 38);
        vignette(.3);
      },
      probe: () => ({ phase: ph, pitch: idx + 1, type: idx >= 0 ? order[idx] : null, order: order.join(''), hits, need: NEED, strikes, outs: OUTS, win: +win.toFixed(3), dur,
        toArrive: ball && !ball.judged ? +(ball.arr - ball.tau).toFixed(3) : null, live: !!(ball && !ball.judged), swung: !!(ball && ball.swung),
        press: ball && !ball.judged && Math.abs(ball.tau - ball.arr) <= win ? 'Space' : null, zone: [ZX, ZY], ball: ball ? (({ x, y, r, p }) => ({ x: +x.toFixed(1), y: +y.toFixed(1), r: +r.toFixed(1), p: +p.toFixed(3) }))(bpos(ball)) : null, result: g.result || null })
    };
    return g;
  };
})();
