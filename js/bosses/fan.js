'use strict';
/* BIGGEST FAN (after Smooth Moves' Wario-stage boss): bugs march at Caos in 2 waves, then an armoured big bug.
   Wave the mouse (or alternate ←/→) to swing a giant paper fan; every stroke slides all planted bugs back a bit. */
(function () {
  /* ── DUO-look art kit for the stage-4 restyle of the FAN boss (docs/ART-STYLE.md): local copy of the drawing helpers; art only, no Math.random ── */
  const TAU = Math.PI * 2;
  let X = null, FBG = null, FBW = -1;
  const fhr = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const frr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const fel = (x, y, rx, ry) => { X.beginPath(); X.ellipse(x, y, rx, ry, 0, 0, TAU); };
  const fink = (fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  const fcel = (path, base, shade, sx, sy, o = 4) => { path(); fink(shade, o); X.save(); path(); X.clip(); X.translate(-sx, -sy); path(); X.fillStyle = base; X.fill(); X.restore(); };
  function fcloud(x, y, s) {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); fink(null, 3); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); }
    X.restore();
  }
  function farms(u, la, ra, col) {   // blocky arms from caos()'s side stubs (origin = Caos's feet)
    const ol = Math.max(3, u * .5), L = 3.3 * u, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
    const one = (sx, an) => {
      X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
      X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
      X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
      X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
      X.restore();
    };
    one(-1, la); one(1, ra);
  }
  function fbug(x, y, rot, sc, legT, mood, hit) {   // cel-shaded ladybug: head along -y of its own frame, big white eyes that look ahead
    X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc); X.lineCap = 'round';
    for (const i of [-1, 0, 1]) for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 10, i * 12); X.lineTo(s * 32, i * 12 + Math.sin(legT * 25 + i * 2 + s) * 9); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); }
    fcel(() => { X.beginPath(); X.ellipse(0, 0, 21, 28, 0, 0, TAU); }, hit ? '#ffb0a8' : '#ff5348', '#c2362b', 4, 5, 3.5);
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, -26); X.lineTo(0, 27); X.stroke();
    X.fillStyle = INK; for (const d of [[-11, -4], [11, 6], [-10, 16], [10, -14]]) { X.beginPath(); X.arc(d[0], d[1], 4, 0, TAU); X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.5)'; fel(-9, -12, 4, 8); X.fill();
    fcel(() => { X.beginPath(); X.ellipse(0, -30, 13, 11, 0, 0, TAU); }, '#3a3350', '#241f33', 2, 3, 3.5);
    for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 6, -34, mood === 'panic' ? 5.4 : 4.4, 0, TAU); fink('#fff', 1.5); X.fillStyle = INK; X.beginPath(); X.arc(s * 6, -35 - (mood === 'panic' ? 0 : 1), mood === 'panic' ? 1.8 : 2.4, 0, TAU); X.fill(); }
    if (mood !== 'panic') { X.strokeStyle = '#fff'; X.lineWidth = 2.5; X.beginPath(); X.moveTo(-10, -42); X.lineTo(-2, -39); X.moveTo(10, -42); X.lineTo(2, -39); X.stroke(); }
    X.restore();
  }
  function fanBg() {   // a windy meadow: far hills, a picket fence, three dirt lanes (baked once)
    if (FBG && FBW === VW) return; FBW = VW; FBG = document.createElement('canvas'); FBG.width = VW; FBG.height = H;
    const old = X; X = FBG.getContext('2d'); X.translate(OX, 0);
    const L = -OX - 2, R = W + OX + 2, HZ = 246;
    let g = X.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, '#36b0ea'); g.addColorStop(.6, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(L, 0, R - L, HZ + 4);
    X.fillStyle = '#c9d0fb'; X.strokeStyle = '#7b80c6'; X.lineWidth = 3; X.beginPath(); X.moveTo(L, HZ); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 176 - Math.abs(Math.sin(x * .006 + 1)) * 56 - Math.sin(x * .02) * 6); X.lineTo(R, HZ); X.closePath(); X.fill(); X.stroke();
    X.fillStyle = '#87d19b'; X.strokeStyle = '#4f9a6a'; X.beginPath(); X.moveTo(L, HZ); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 214 - Math.sin(x * .014 + 5) * 16); X.lineTo(R, HZ); X.closePath(); X.fill(); X.stroke();
    for (const tx of [90, 250, 420, 560]) { const bx = tx + (fhr(tx) - .5) * 30; X.lineWidth = 10; X.strokeStyle = INK; X.beginPath(); X.moveTo(bx, HZ); X.lineTo(bx, HZ - 24); X.stroke(); X.lineWidth = 5; X.strokeStyle = '#8a5a34'; X.stroke(); X.beginPath(); X.arc(bx, HZ - 38, 20, 0, TAU); fink('#3fb260', 3.5); X.fillStyle = 'rgba(255,255,255,.28)'; fel(bx - 7, HZ - 46, 6, 4); X.fill(); }
    // the windmill tower (the blades are live)
    { const wx = 640 + OX * .5; X.beginPath(); X.moveTo(wx - 24, HZ); X.lineTo(wx - 14, 168); X.lineTo(wx + 14, 168); X.lineTo(wx + 24, HZ); X.closePath(); fink('#f6f1ff', 4); X.fillStyle = 'rgba(180,170,215,.55)'; X.beginPath(); X.moveTo(wx + 8, 170); X.lineTo(wx + 14, 168); X.lineTo(wx + 24, HZ); X.lineTo(wx + 10, HZ); X.fill(); frr(wx - 6, HZ - 26, 12, 26, 4); fink('#a5622c', 2.5); }
    X.fillStyle = INK; X.fillRect(L, HZ, R - L, 4);
    g = X.createLinearGradient(0, HZ + 4, 0, H); g.addColorStop(0, '#8fdc5c'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(L, HZ + 4, R - L, H - HZ);
    X.fillStyle = 'rgba(255,255,255,.12)'; for (let x = L - 200; x < R; x += 90) { X.beginPath(); X.moveTo(x, HZ + 4); X.lineTo(x + 40, HZ + 4); X.lineTo(x - 140, H); X.lineTo(x - 180, H); X.closePath(); X.fill(); }
    const LN = [305, 400, 495], SC = [.85, 1, 1.15], x0 = 130 - OX + 60;
    for (let i = 0; i < 3; i++) { const h = 30 * SC[i], y = LN[i] - 6; frr(x0 - 20, y, R - x0 + 40, h + 8, 12); fink('#e6c58c', 3.5); X.fillStyle = 'rgba(165,98,44,.25)'; X.fillRect(x0, y + h * .55, R - x0, h * .4); X.fillStyle = 'rgba(255,255,255,.35)'; for (let x = x0 + 30; x < R; x += 90) { frr(x + fhr(x + i) * 20, y + 8, 30, 8, 4); X.fill(); } }
    for (let i = 0; i < 14; i++) { const x = L + fhr(i + 7) * (R - L), y = HZ + 14 + fhr(i + 21) * 330; if (LN.some(l => Math.abs(y - l) < 26)) continue; X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x - 9 + 4, y - 10); X.moveTo(x, y); X.lineTo(x + 3, y - 13); X.moveTo(x + 6, y); X.lineTo(x + 10, y - 10); X.stroke(); }
    // the fence along the horizon
    for (let x = L - 10, i = 0; x < R; x += 38, i++) { frr(x, HZ - 26, 28, 34, 6); fink('#e3a868', 3); }
    X.fillStyle = INK; X.fillRect(L, HZ, R - L, 4);
    X = old;
  }
  BOSSES.fan = function (sp, s) {
    const k = Math.min(sp, 1.3) / 1.3, LANES = [305, 400, 495], LSC = [.85, 1, 1.15];
    // [lane, where it plants (u), big?]: bugs run in, plant on screen, then march; u=0 is Caos, u=1 the right edge
    const WAVES = [[[0, .86], [2, .78], [1, .7]], [[1, .9], [0, .82], [2, .74], [1, .66]], [[1, .8, true]]];
    const bugs = [], gone = [], winds = [];
    let wave = 0, waveT = .01, waveAt = 0, clock = 0, last = 0, lastKey = 0, fanDir = 1, fanA = .35, fanK = 0, strokes = 0, biter = null, biteT = 0;
    let lx = null, ly = 0, sx = 0, sy = 0, trav = 0, t0 = 0;
    const cx = () => 130 - OX, ux = u => cx() + 120 + u * (W + OX - 45 - cx() - 120);
    const cssK = () => { const r = cv.getBoundingClientRect(); return r.height ? r.height / H : 1; };   // game px -> CSS px
    const spawn = () => {
      for (const [l, eu, big] of WAVES[wave]) bugs.push({ l, u: 1.15 + Math.random() * .1, eu, vb: 0, big: !!big, m: big ? 1.5 : 1, walk: (big ? .14 : .23) * k, on: false, hit: 0, land: 0, ph: Math.random() * 6 });
      wave++; waveAt = clock; floatText(['WAVE 1!', 'WAVE 2!', 'BIG ONE!'][wave - 1], W / 2, 200, wave === 3 ? '#FF4D6D' : '#FFE14D', 52);
      if (wave === 3) { sfx.thud(); shake(8, .3); } else { sfx.tickHi(); snd(660, .1, 'square', .04, .08); }
    };
    /* one swing of the fan: str 0..1 (swings faster than 10/s are weakened); same push at any distance, no stalemate band */
    const stroke = str => {
      if (g.result || !clock) return;
      str *= Math.min(1, (clock - last) / .1); last = clock; if (str < .12) return;
      strokes++; fanDir = -fanDir; fanK = 1; sfx.whoosh(fanDir > 0); snd(fanDir > 0 ? 300 : 240, .08, 'triangle', .04 * str);
      for (let i = 0; i < 3 + str * 3; i++) winds.push({ x: ux(0) - 60 + Math.random() * 60, y: LANES[i % 3] - 30 + Math.random() * 50, len: 50 + Math.random() * 90 * str, life: .55, a: .4 + .6 * str });
      for (const b of bugs) if (b.on) { b.vb += str * .92 / b.m; b.hit = .15; }
    };
    const lose = b => {
      g.result = 'lose'; biter = b; sfx.splat(); sfx.buzz(); shake(12, .4); burst(cx() + 30, 420, '#FF4D4D', 18); ring(cx() + 30, 420, '#fff', 110);
      floatText('CHOMP!', cx() + 70, 190, '#FF4D6D', 52);
    };
    const g = {
      cmd: 'BOSS!', hint: 'WAVE THE MOUSE (OR ← →)!', thint: 'SWIPE BACK AND FORTH!', dur: 10, boss: true, wide: true,
      key(e) {
        const side = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : e.code === 'ArrowRight' || e.code === 'KeyD' ? 1 : 0;
        if (side && side !== lastKey) { lastKey = side; stroke(1); }
      },
      down(p) { lx = p.x; ly = p.y; sx = sy = trav = 0; t0 = clock; },
      move(p) {   // hover (mouse) or drag (touch): every reversal is one stroke; strength from CSS-px speed so window size doesn't matter
        if (lx === null) { lx = p.x; ly = p.y; return; }
        const dx = p.x - lx, dy = p.y - ly, d = Math.abs(dx) + Math.abs(dy); lx = p.x; ly = p.y; if (d < 2) return;
        if (dx * sx + dy * sy < 0 && trav > 30 || trav > 300) {
          const c = trav * cssK(); stroke(c < 30 ? 0 : Math.min(1, Math.max(.6, c / Math.max(.05, clock - t0) / 800))); sx = sy = trav = 0; t0 = clock;
        }
        sx += dx; sy += dy; trav += d;
      },
      update(dt) {
        clock += dt; fanK = Math.max(0, fanK - dt * 4); fanA += (fanDir * .35 - fanA) * Math.min(1, dt * 22); biteT += dt;
        for (let i = winds.length - 1; i >= 0; i--) { const w = winds[i]; w.x += 1500 * dt; w.life -= dt; if (w.life <= 0) winds.splice(i, 1); }
        for (let i = gone.length - 1; i >= 0; i--) { const o = gone[i]; o.vy += 900 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.r += o.vr * dt; o.life -= dt; if (o.life <= 0) gone.splice(i, 1); }
        for (const b of bugs) { b.hit = Math.max(0, b.hit - dt); b.land = Math.max(0, b.land - dt); }
        if (g.result) return;
        if (!bugs.length) {
          if (wave === 3) { g.result = 'win'; confetti(W / 2, 300, 60); sfx.sparkle(); shake(10, .35); ring(W / 2, 300, '#FFE14D', 240, .6); return; }
          waveT -= dt; if (waveT <= 0) { spawn(); waveT = .35; }
        }
        for (let i = bugs.length - 1; i >= 0; i--) {
          const b = bugs[i];
          if (!b.on) {   // run-in: immune to wind until planted, so every bug is seen on the field first
            b.u -= 1.6 * dt; b.ph += dt * 3;
            if (b.u <= b.eu) { b.on = true; b.land = .2; burst(ux(b.u), LANES[b.l] + 20, '#c9955a', 6, 140); snd(b.big ? 90 : 160, .08, 'square', .05); }
            continue;
          }
          b.vb *= Math.exp(-6 * dt); b.u += (b.vb - b.walk) * dt; b.ph += dt * (b.vb > b.walk ? 3 : 1);
          if (b.u >= 1) {   // reached the edge: spins away
            bugs.splice(i, 1); const x = ux(b.u), y = LANES[b.l], lastOne = wave === 3 && !bugs.length;
            gone.push({ x, y, vx: 300 + Math.random() * 200, vy: -500 - Math.random() * 200, r: 0, vr: 14, sc: (b.big ? 2.1 : LSC[b.l]), life: 1.4 });
            sfx.boing(); sfx.pop(); burst(x - 40, y, '#fff', 10, 300); if (!lastOne) floatText('BYE!', Math.min(x - 60, W + OX - 100), y - 50, '#fff', 34);
          } else if (b.u <= 0) { lose(b); return; }
        }
      },
      draw(t) {   // art: a windy meadow (windmill, fence, three dirt lanes); gameplay above is untouched
        X = ctx; fanBg();
        X.drawImage(FBG, -OX, 0);
        const won = g.result === 'win', lost = g.result === 'lose', T = now;
        for (const [x, y, sc, v] of [[60, 120, 1, 30], [420, 150, .8, 24], [-160, 100, .9, 36], [760, 130, 1.1, 28]]) fcloud(((x + T * v + 300) % (W + OX * 2 + 260)) - OX - 130, y, sc);
        // the windmill spins faster the more you fan
        { const wa = clock * 1.1 + strokes * .45 + (won ? T * 3 : 0), wx = 640 + OX * .5, wy = 168; X.save(); X.translate(wx, wy); for (let i = 0; i < 4; i++) { X.save(); X.rotate(wa + i * Math.PI / 2); X.beginPath(); X.moveTo(0, 0); X.lineTo(10, -14); X.lineTo(14, -70); X.lineTo(-10, -66); X.lineTo(-6, -12); X.closePath(); fink('#fff', 3.5); X.restore(); } X.beginPath(); X.arc(0, 0, 9, 0, TAU); fink('#ff5c8a', 3); X.restore(); }
        // the scoreboard sign (wave counter) hangs from two strings
        {
          const lab = won ? 'BLOWN AWAY!' : ['WAVE 1 / 3', 'WAVE 2 / 3', 'WAVE 3 / 3'][Math.max(0, wave - 1)], sw = Math.sin(T * 1.3) * .015;
          X.save(); X.translate(W / 2, 66); X.rotate(sw); X.strokeStyle = '#e6c58c'; X.lineWidth = 3; X.beginPath(); X.moveTo(-90, 0); X.lineTo(-90, -10); X.moveTo(90, 0); X.lineTo(90, -10); X.stroke();
          frr(-120, 0, 240, 46, 10 + 0); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill(); X.save(); X.translate(0, -3); fcel(() => frr(-120, 0, 240, 46, 10), '#d9944f', '#a5622c', 0, 5, 4); X.restore();
          X.restore(); X.save(); X.translate(W / 2, 66 + 21); X.rotate(sw); txt(lab, 0, 0, won ? 26 : 28, won ? '#5CFF7A' : '#FFE14D', 'center', 216); X.restore();
        }
        const near = bugs.length ? Math.min(...bugs.map(b => b.u)) : 1;
        if (!g.result && clock - waveAt > .8 && (near < .35 || clock > 6.5)) txt('FAN FASTER!', W / 2, 146, 30 + Math.sin(T * 20) * 3, '#FF4D6D');
        // wind streaks
        X.lineCap = 'round';
        for (const w of winds) { const a = w.a * Math.min(1, w.life * 3); X.beginPath(); for (let j = 0; j <= 8; j++) X.lineTo(w.x + w.len * j / 8, w.y + Math.sin(j * .9 + w.x * .02) * 6); X.strokeStyle = `rgba(20,16,28,${a * .5})`; X.lineWidth = 9; X.stroke(); X.strokeStyle = `rgba(255,255,255,${a})`; X.lineWidth = 5; X.stroke(); }
        X.lineCap = 'butt';
        // marching bugs (far lane first); the one that got Caos is drawn on top of him later
        const drawB = (b, x, y, sc, rot) => {
          const back = b.vb > b.walk && b.on, sq = 1 + b.hit * 1.5 - b.land * 1.2, mood = (back || b.hit > 0) ? 'panic' : 'idle';
          shadow(x, y + 30 * sc, 34 * sc, 9 * sc, .25);
          X.save(); X.translate(x, y); X.scale(1 / sq, sq); X.translate(-x, -y);
          fbug(x, y, rot + (back ? .35 : Math.sin(b.ph * 8) * .08), sc, b.ph * (back ? 2.5 : 1), mood, b.hit);
          if (b.big) {   // steel helmet + angry brows
            X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc);
            fcel(() => { X.beginPath(); X.ellipse(0, 4, 23, 26, 0, 0, TAU); }, b.hit ? '#fff' : '#d4dbe6', '#8f9cb3', 4, 5, 4);
            X.fillStyle = '#7d8a9c'; frr(-23, 0, 46, 7, 3); fink('#7d8a9c', 3);
            for (const [rx, ry] of [[-12, -12], [12, -12], [-14, 16], [14, 16]]) { X.beginPath(); X.arc(rx, ry, 2.5, 0, TAU); fink('#e8edf3', 1.5); }
            X.restore();
          }
          X.restore();
          if (back && b.u < .9) { X.fillStyle = '#9fe3ff'; for (const d of [-1, 1]) { X.beginPath(); X.ellipse(x + 10 * sc, y - 34 * sc + d * 3, 4, 7, d * .4, 0, TAU); X.fill(); } }
        };
        for (const b of [...bugs].sort((a, c) => a.l - c.l)) if (b !== biter) drawB(b, ux(b.u), LANES[b.l] - (b.big ? 20 : 4), b.big ? 2.1 : LSC[b.l], -Math.PI / 2);
        for (const o of gone) { X.globalAlpha = Math.min(1, o.life * 2); fbug(o.x, o.y, o.r, o.sc, T * 3, 'panic', 0); X.globalAlpha = 1; }
        // Caos on his crate with the giant paper fan
        const CX = cx(), Y = 450, U = 8, kq = fanK * .1;
        shadow(CX, Y + 4, 80, 14, .3);
        X.save(); X.translate(CX, Y); X.scale(1 + kq, 1 - kq); X.translate(-CX, -Y);
        const ra = won ? 1.2 : lost ? .5 : .95 + fanA * .5;
        X.save(); X.translate(CX, Y); farms(U, won ? -2.6 + Math.sin(T * 12) * .3 : lost ? -.4 : -.8, ra, OR); X.restore();
        caos(CX, Y, U, { mood: lost ? 'sad' : won ? 'happy' : null, run: g.result ? null : now * .4 });
        X.restore();
        const px = CX + 6.6 * U + 5.65 * U * Math.sin(ra) * .8, py = Y - 5.2 * U - 5.65 * U * Math.cos(ra) * .8, A = won ? Math.sin(T * 12) * .6 : lost ? 1.3 : fanA, R = 122 * (1 + fanK * .06);
        X.save(); X.translate(px, py);
        if (fanK > .3) { X.globalAlpha = .25; X.fillStyle = '#fff'; X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, R, A + fanDir * .5 - 1, A + fanDir * .5 + 1); X.closePath(); X.fill(); X.globalAlpha = 1; }
        X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, R, A - 1, A + 1); X.closePath(); X.lineJoin = 'round'; X.lineWidth = 14; X.strokeStyle = INK; X.stroke();
        for (let i = 0; i < 8; i++) { const a = A - 1 + i * .25; X.fillStyle = i % 2 ? '#FFF3D6' : '#FF4D6D'; X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, R, a, a + .25); X.closePath(); X.fill(); X.fillStyle = i % 2 ? 'rgba(200,170,120,.35)' : 'rgba(150,20,50,.25)'; X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, R, a + .16, a + .25); X.closePath(); X.fill(); }
        X.strokeStyle = INK; X.lineWidth = 3; for (let i = 0; i <= 8; i++) { const a = A - 1 + i * .25; X.beginPath(); X.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); X.lineTo(Math.cos(a) * R, Math.sin(a) * R); X.stroke(); }
        X.fillStyle = 'rgba(255,255,255,.35)'; X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, R * .96, A - .96, A - .6); X.closePath(); X.fill();
        X.restore();
        token(px + Math.cos(A) * R * .62, py + Math.sin(A) * R * .62, 18);
        X.beginPath(); X.arc(px, py, 10, 0, TAU); fink('#8a5a2b', 4);
        if (biter) {   // the winner of the race leaps onto Caos and chomps
          const e = Math.min(1, biteT / .2), bx = ux(0) + (CX + 34 - ux(0)) * e, by = LANES[biter.l] + (Y - 30 - LANES[biter.l]) * e - Math.sin(e * Math.PI) * 60;
          biter.ph += .05; drawB(biter, bx, by, (biter.big ? 1.6 : 1.05) * (1 + Math.abs(Math.sin(T * 14)) * .08), -Math.PI / 2 - .5);
        }
        vignette(.18);
      },
      probe: () => ({ wave, strokes, clock: +clock.toFixed(2), nextKey: lastKey === 1 ? 'ArrowLeft' : 'ArrowRight', fan: { x: cx() + 56, y: 406 }, contactX: ux(0),
        bugs: bugs.map(b => ({ u: +b.u.toFixed(3), x: Math.round(ux(b.u)), y: LANES[b.l], big: b.big, on: b.on })), nearest: bugs.length ? Math.min(...bugs.map(b => +b.u.toFixed(3))) : null }),
    };
    return g;
  };
})();
