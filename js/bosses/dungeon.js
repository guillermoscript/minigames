'use strict';
/* DUNGEON boss (MEGA MICROGAME$): a Game Boy RPG battle where the GLITCH SLIME garbled the menu.
   After Mega Microgame$' "Dungeon Dilemma": each turn pick the ONE correctly spelled command. 3 hits = KO, one typo = you get eaten. */
(function () {
  const C = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];                 // the only 4 shades, darkest .. lightest
  const R = (x, y, w, h, c) => { const x0 = Math.round(x), y0 = Math.round(y); ctx.fillStyle = C[c]; ctx.fillRect(x0, y0, Math.round(x + w) - x0, Math.round(y + h) - y0); };
  const WORDS = ['ATTACK', 'MAGIC', 'DEFEND', 'ITEM', 'FIRE', 'POTION'];
  const MX = 540, MY = 352, P = 10, MW = 24, MH = 18, HX = 190, HY = 360, BOX = [40, 386, 720, 160];
  const CELL = i => [52 + i * 238, 430, 220, 104];
  const beep = (f, d = .07, v = .05, delay = 0, f2) => snd(f, d, 'square', v, delay, f2);
  /* typos AFTER translating: swap two adjacent interior letters, or (easy turns / short words) the first and last interior ones.
     A swap that only moves an accent (POCIÓN -> PÓCION) is not a fair typo, so it is dropped. */
  const base = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function typos(w, hard) {
    const a = [...w], n = a.length, sw = (i, j) => { const b = a.slice(); [b[i], b[j]] = [b[j], b[i]]; return b.join(''); }, adj = [];
    for (let i = 1; i < n - 2; i++) adj.push(sw(i, i + 1));
    const tiers = [adj, [sw(1, n - 2)], [sw(0, 1), sw(n - 2, n - 1)]].map(t => shuffle(t.filter(x => base(x) !== base(w))));
    if (!hard) tiers.unshift(tiers[1].splice(0, 1));                     // easy first turn: one decoy is the obvious far swap
    const out = []; for (const x of tiers.flat()) if (out.length < 2 && !out.includes(x)) out.push(x);
    return out;
  }
  /* the slime, built once as palette cells: dark body (1) with dithered shade (0), outline (0) and a shine (3, 2) */
  const SL = [];
  const inside = (i, r) => { const x = (i + .5 - MW / 2) / (MW / 2), y = r + .5;
    return r < 0 || r >= MH ? false : y < 13 ? x * x + ((13 - y) / 13) ** 2 < 1 : Math.abs(x) < 1 - (y - 13) * .02 && !(r === MH - 1 && i % 6 === 3); };
  for (let r = 0; r < MH; r++) for (let i = 0; i < MW; i++) if (inside(i, r)) {
    const edge = !inside(i - 1, r) || !inside(i + 1, r) || !inside(i, r - 1) || !inside(i, r + 1), x = (i + .5 - MW / 2) / (MW / 2);
    const d = Math.hypot(i - 7, r - 4);
    SL.push([i, r, edge ? 0 : d < 1.6 ? 3 : d < 2.7 ? 2 : (x > .5 || r >= 15) && (i + r) % 2 ? 0 : 1]);
  }
  /* pixel text (Courier, drop shadow in another shade) */
  function ptxt(s, x, y, size, fg = 0, sh = 3, align = 'center', maxW = 0) {
    const f = z => `bold ${z}px "Courier New", Courier, monospace`; ctx.font = f(size);
    if (maxW) { const w = ctx.measureText(s).width; if (w > maxW) ctx.font = f(size * maxW / w); }
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (sh != null) { ctx.fillStyle = C[sh]; ctx.fillText(s, x + 3, y + 3); }
    ctx.fillStyle = C[fg]; ctx.fillText(s, x, y);
  }
  const pell = (cx, cy, rx, ry, c) => { for (let y = -ry; y < ry; y += 6) { const hw = rx * Math.sqrt(1 - ((y + 3) / ry) ** 2); R(cx - hw, cy + y, hw * 2, 6, c); } };
  const frame = (x, y, w, h, fill) => { R(x - 6, y - 6, w + 12, h + 12, 0); R(x, y, w, h, fill); };
  /* pixel Caos with a sword. pose: 0 sword up, 1 lunge */
  function hero(x, y, c, mood, pose, hide) {
    if (hide) return;
    if (pose) { R(x + 8 * c, y - 6.5 * c, 10 * c, 2 * c, 0); R(x + 9 * c, y - 6 * c, 8.5 * c, c, 3); R(x + 8 * c, y - 8 * c, c, 5 * c, 0); }
    else { R(x + 7 * c, y - 16 * c, 2 * c, 9 * c, 0); R(x + 7.5 * c, y - 15.5 * c, c, 7.5 * c, 3); R(x + 6 * c, y - 8 * c, 4 * c, c, 0); }
    R(x - 7 * c, y - 8 * c, 14 * c, 6 * c, 0); R(x - 6 * c, y - 7 * c, 12 * c, 4 * c, 2);
    const ay = mood === 'happy' ? y - 9 * c : y - 6 * c;
    R(x - 9 * c, ay, 2 * c, 3 * c, 0); R(x - 8 * c, ay + c, c, c, 2); R(x + 7 * c, y - 6 * c, 2 * c, 3 * c, 0); R(x + 7 * c, y - 5 * c, c, c, 2);
    for (const lx of [-5, -2, 1, 4]) R(x + lx * c, y - 2 * c, c, 2 * c, 0);
    for (const ex of [-3, 2]) {
      if (mood === 'happy') { R(x + (ex - 1) * c, y - 5 * c, c, c, 0); R(x + ex * c, y - 6 * c, c, c, 0); R(x + (ex + 1) * c, y - 5 * c, c, c, 0); }
      else if (mood === 'sad') { R(x + (ex - .5) * c, y - 6.5 * c, c, c, 0); R(x + (ex + .5) * c, y - 5.5 * c, c, c, 0); R(x + (ex + .5) * c, y - 6.5 * c, c, c, 0); R(x + (ex - .5) * c, y - 5.5 * c, c, c, 0); }
      else R(x + ex * c, y - 6 * c, c, 2 * c, 0);
    }
  }

  BOSSES.dungeon = function (sp, s) {
    const need = 3, T = 3 / Math.sqrt(Math.min(sp, 1.8)), fx = [];
    const list = shuffle(WORDS.slice()).slice(0, need).sort((x, y) => [...window.t(x)].length - [...window.t(y)].length);  // longest word last
    let kb = !TOUCH, ptr = null, TT = T, ph = 'intro', pt = .5, turn = -1, hits = 0, word = '', opts = [], ok = -1, curs = 0, picked = -1, tickB = 9;
    let mk = 0, clk = 0, it = 0, sq = 0, flick = 0, slash = 0, flash = 0, atkT = -1, struck = false, lungeT = -1, bit = false, knock = 0, boom = false, hpv = need;
    const pix = (x, y, n, c, v = 260, sz = 8) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, u = v * (.4 + Math.random() * .8); fx.push({ x, y, vx: Math.cos(a) * u, vy: Math.sin(a) * u - 80, l: .5 + Math.random() * .4, t: 0, s: sz, c }); } };
    const pop = (key, x, y, size = 40) => fx.push({ s: window.t(key), x, y, l: .9, t: 0, size });
    const newTurn = () => {
      turn++; word = window.t(list[turn]); opts = shuffle([word, ...typos(word, turn > 0)]); ok = opts.indexOf(word);
      ph = 'pick'; pt = TT = T + (turn ? 0 : .4); picked = -1; curs = ptr ? Math.max(0, cellAt(ptr)) : 0; tickB = 9; beep(988, .05, .04); beep(1319, .06, .04, .05);
    };
    const fail = (msg, i) => {
      g.result = 'lose'; ph = 'hurt'; picked = i; lungeT = 0; sq = -.3;
      beep(196, .25, .06, 0, 98); sfx.buzz(); pop(msg, 400, 300, 42);
    };
    const choose = i => {
      if (g.result || ph !== 'pick' || i < 0) return;
      curs = i; picked = i;
      if (i !== ok) { fail('TYPO!', i); return; }
      ph = 'atk'; pt = .75; atkT = 0; struck = false; beep(660, .05, .05); beep(880, .05, .05, .04);
    };
    const strike = () => {                                  // the sword connects
      struck = true; hits++; flick = .42; slash = .2; sq = .4; mk = 40; shake(7, .18);
      noise(.12, .12, 2600, 5000, 'bandpass'); beep(1047, .06, .06, 0, 523); sfx.hit();
      pix(MX - 40, MY - 80, 16, 0, 340); pix(MX - 40, MY - 80, 10, 3, 260);
      if (hits < need) { pop('SLASH!', MX, 180); return; }
      g.result = 'win'; boom = true; pop('KO!', MX, 230, 64); shake(14, .45); flash = .1;
      for (const [i, r, c] of SL) { const x = MX + (i - MW / 2 + .5) * P, y = MY - (MH - r) * P, a = Math.atan2(y - (MY - 80), x - MX), v = 150 + Math.random() * 420;
        fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 260, l: .7 + Math.random() * .6, t: 0, s: P, c }); }
      noise(.5, .16, 400, 2000, 'lowpass'); [523, 659, 784, 1047, 1319].forEach((f, k) => beep(f, .1, .05, .15 + k * .07)); sfx.sparkle();
    };
    const cellAt = p => { if (p.y < 420 || p.y > 548) return -1; for (let i = 0; i < 3; i++) { const [x, , w] = CELL(i); if (p.x >= x - 9 && p.x <= x + w + 9) return i; } return -1; };
    const g = {
      cmd: 'BOSS!', hint: 'PICK THE CORRECT SPELLING!', thint: 'TAP THE CORRECT SPELLING!', dur: 11, boss: true, wide: true,
      key(e) {
        if (g.result || ph !== 'pick') return; const c = e.code; kb = true; ptr = null;
        const d = /^(Digit|Numpad)[123]$/.test(c) ? +c.slice(-1) - 1 : -1;
        if (d >= 0) choose(d);
        else if (/^(ArrowUp|ArrowLeft|KeyW|KeyA)$/.test(c)) { curs = (curs + 2) % 3; beep(1200, .03, .04); }
        else if (/^(ArrowDown|ArrowRight|KeyS|KeyD)$/.test(c)) { curs = (curs + 1) % 3; beep(1200, .03, .04); }
        else if (c === 'Space' || c === 'Enter' || c === 'NumpadEnter') choose(curs);
      },
      move(p) { if (!p.touch) ptr = { x: p.x, y: p.y }; const i = cellAt(p); if (i >= 0 && !p.touch) kb = true; if (i >= 0 && i !== curs && ph === 'pick' && !g.result) { curs = i; beep(1200, .03, .03); } },
      down(p) { choose(cellAt(p)); },
      update(dt) {
        clk += dt; it += dt; flick = Math.max(0, flick - dt); slash = Math.max(0, slash - dt); flash = Math.max(0, flash - dt);
        sq *= Math.pow(.01, dt); mk *= Math.pow(.02, dt); knock *= Math.pow(.03, dt); hpv += (need - hits - hpv) * Math.min(1, 8 * dt);
        for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; if (f.t >= f.l) { fx.splice(i, 1); continue; } if (f.vx != null) { f.vy += 800 * dt; f.x += f.vx * dt; f.y += f.vy * dt; } }
        if (it > .35 && it - dt <= .35) { sq = .5; sfx.thud(); pix(MX, MY, 12, 1, 200); }  // landing
        if (atkT >= 0) { atkT += dt; if (!struck && atkT >= .2) strike(); }
        if (lungeT >= 0) { lungeT += dt; if (!bit && lungeT >= .18) { bit = true; flash = .09; knock = 60; shake(12, .35); sfx.thud(); noise(.25, .14, 300, 900, 'lowpass'); pix(HX + 20, HY - 40, 14, 0, 320); pop('HA HA!', MX + 40, 170, 34); } }
        if (g.result) return;
        pt -= dt;
        if (ph === 'intro' && pt <= 0) newTurn();
        else if (ph === 'pick') { const b = Math.floor(pt * 2); if (pt < 1.05 && b < tickB) { tickB = b; beep(b % 2 ? 1568 : 1175, .03, .04); } if (pt <= 0) fail('TOO SLOW!', -1); }
        else if (ph === 'atk' && pt <= 0) newTurn();
      },
      draw() {
        // backdrop: dithered sky, pixel hills, perspective floor, all four shades only
        R(-OX, 0, VW, H, 3); R(-OX, 0, VW, 66, 2);
        for (let y = 66; y < 102; y += 6) for (let x = -OX + ((y / 6) % 2) * 6; x < W + OX; x += 12) if (y < 84 || (x / 12 + y / 6) % 3 < 1) R(x, y, 6, 6, 2);
        for (let k = 0; k < 4; k++) { const cx = ((k * 330 + clk * 14) % (VW + 200)) - OX - 100, cy = 136 + (k % 2) * 34; R(cx, cy, 72, 12, 2); R(cx + 12, cy - 12, 36, 12, 2); }
        for (let x = -OX - (-OX % 18) - 18; x < W + OX; x += 18) { const h = 34 + Math.sin(x * .013) * 22 + Math.sin(x * .041) * 9; R(x, 300 - h, 18, h, 2); R(x, 300 - h, 18, 6, 1); }
        R(-OX, 300, VW, H - 300, 3); R(-OX, 300, VW, 6, 1);
        for (const y of [318, 340, 372, 414, 470, 540]) R(-OX, y, VW, 3, 2);
        pell(MX, MY + 2, 160, 22, 1); pell(MX, MY, 150, 16, 2); pell(HX, HY + 2, 104, 14, 1); pell(HX, HY + 1, 96, 10, 2);
        // the glitch slime
        if (!boom && !(flick > 0 && (clk * 28 | 0) % 2)) {
          const lx = mk + (lungeT >= 0 ? -250 * Math.sin(Math.PI * Math.min(1, lungeT / .42)) : 0), drop = -320 * Math.pow(1 - Math.min(1, it / .35), 2);
          const wob = Math.sin(clk * 5) * .045, sx = 1 + sq * .3 + wob, sy = 1 - sq * .3 - wob, cw = P * sx, ch = P * sy;
          const gl = (clk % 1.3) < .09 && !g.result, g0 = 5 + ((clk / 1.3 | 0) * 7) % 9, gs = ((clk / 1.3 | 0) % 2 ? 2 : -2) * cw;
          const ox = MX + lx - MW / 2 * cw, cell = (i, r, c) => R(ox + i * cw + (gl && r >= g0 && r < g0 + 3 ? gs : 0), MY + drop - (MH - r) * ch, cw, ch, c);
          for (const [i, r, c] of SL) cell(i, r, c);
          const aw = Math.round(Math.sin(clk * 6));                                  // bug antennae
          for (const sd of [-1, 1]) { const b = sd < 0 ? 9 : 14; for (let k = 1; k <= 3; k++) cell(b + sd * k + (k === 3 ? aw : 0), -k + 1, 0);
            const bx = b + sd * 3.5 + aw; cell(bx - .5, -4, 0); cell(bx + .5, -4, 0); cell(bx - .5, -3, 0); cell(bx + .5, -3, 0); cell(bx - .5, -4, 3); }
          const mood = g.result === 'lose' ? 'laugh' : flick > 0 ? 'hurt' : 'mad', look = ph === 'pick' ? -1 : 0;
          for (const ex of [7, 15]) {
            if (mood === 'hurt') { for (let k = 0; k < 3; k++) { cell(ex + k - .5, 7 + k, 3); cell(ex + 1.5 - k, 7 + k, 3); } }
            else if (mood === 'laugh') { cell(ex - .5, 9, 3); cell(ex + .5, 8, 3); cell(ex + 1.5, 9, 3); }
            else { for (let k = 0; k < 3; k++) { cell(ex - .5, 7 + k, 3); cell(ex + .5, 7 + k, 3); cell(ex + 1.5, 7 + k, 3); } cell(ex + .5 + look, 8, 0); cell(ex + .5 + look, 9, 0); }
          }
          if (mood === 'mad') { cell(5.5, 5, 0); cell(6.5, 5, 0); cell(7.5, 6, 0); cell(8.5, 6, 0); cell(17.5, 5, 0); cell(16.5, 5, 0); cell(15.5, 6, 0); cell(14.5, 6, 0); }
          const open = mood !== 'mad' || ph === 'pick' && pt < 1;
          for (let i = 9; i <= 14; i++) cell(i, 12, 0); if (open) { for (let i = 9; i <= 14; i++) cell(i, 13, 0); for (let i = 10; i <= 13; i++) cell(i, 14, 0); cell(11, 14, 1); cell(12, 14, 1); }
          cell(10, 12, 3); cell(13, 12, 3); cell(10, 13, open ? 3 : 1);
        }
        if (slash > 0) { const k = Math.min(1, (1 - slash / .2) * 2.5), n = 16 * k | 0;       // chunky diagonal sword slash
          for (let j = 0; j < n; j++) { const x = MX + 130 - j * 17, y = MY - 215 + j * 13; R(x - 6, y - 6, 30, 22, 0); R(x, y, 18, 10, 3); } }
        // Caos the hero
        const dash = atkT >= 0 && atkT < .6 ? (atkT < .2 ? 170 * (atkT / .2) : 170 * (1 - (atkT - .2) / .4)) : 0;
        const hy = HY - (g.result === 'win' ? Math.abs(Math.sin(clk * 10)) * 22 : dash > 0 ? Math.sin(Math.min(1, atkT / .2) * Math.PI) * 30 : 0);
        hero(HX + dash - knock, hy, 8, g.result === 'win' ? 'happy' : bit ? 'sad' : null, dash > 0 && atkT < .45 ? 1 : 0, bit && knock > 3 && (clk * 24 | 0) % 2);
        if (!boom) drawFx(true, false);                            // hit sparks stay under the command window so they never hide a word
        // HUD: name plate + HP blocks
        frame(70, 96, 280, 50, 3);
        ptxt(window.t('GLITCH SLIME'), 84, 110, 22, 0, 2, 'left', 252);
        ptxt(window.t('HP'), 98, 133, 16, 0, null, 'center');
        R(120, 125, 220, 16, 0); R(123, 128, 214 * Math.max(0, hpv) / need, 10, hpv < 1.2 ? 1 : 2); for (let k = 1; k < need; k++) R(120 + 220 * k / need - 1.5, 125, 3, 16, 0);
        // command window
        const [bx, by, bw, bh] = BOX; frame(bx, by, bw, bh, 3); R(bx + 4, by + 4, bw - 8, 3, 1); R(bx + 4, by + bh - 7, bw - 8, 3, 1);
        ptxt(window.t('COMMAND?'), 62, 410, 20, 0, 2, 'left', 180);
        const u = ph === 'pick' ? Math.max(0, pt / TT) : ph === 'intro' ? 1 : 0;
        R(250, 402, 488, 16, 0); if (!(u < .3 && (clk * 10 | 0) % 2)) R(253, 405, 482 * u, 10, u < .3 ? 1 : 2);
        for (let i = 0; i < 3; i++) {
          const [x, y, w, h] = CELL(i), sel = kb && ph === 'pick' && i === curs && !g.result, won = ph !== 'pick' && i === picked && i === ok, bad = g.result === 'lose' && i === picked;
          const showOk = g.result === 'lose' && i === ok && (clk * 6 | 0) % 2;
          R(x, y, w, h, won || showOk ? 0 : sel ? 2 : 3); R(x, y, w, 3, 1); R(x, y + h - 3, w, 3, 1); R(x, y, 3, h, 1); R(x + w - 3, y, 3, h, 1);
          if (ph === 'intro') { ptxt('...', x + w / 2, y + h / 2, 34, 1, null); continue; }
          const fg = won || showOk ? 3 : 0;
          ptxt(String(i + 1), x + 14, y + 18, 18, fg === 3 ? 2 : 1, null, 'left');
          if (sel && (clk * 4 | 0) % 2 === 0 || won) { const ax = x + 14, ay = y + h / 2 - 12; for (let k = 0; k < 5; k++) R(ax + k * 4, ay - 4 + k * 4, 4, 32 - k * 8, fg); }
          ptxt(opts[i] || '', x + w / 2 + 12, y + h / 2 + 2, 38, fg, fg === 3 ? 1 : 2, 'center', w - 56);
          if (bad) for (let k = 0; k < 10; k++) { R(x + 20 + k * 18, y + 12 + k * 8, 14, 10, 0); R(x + 20 + k * 18, y + 82 - k * 8, 14, 10, 0); }
        }
        drawFx(boom, true);                                   // popups (and the KO explosion) on top
        if (flash > 0) R(-OX, 0, VW, H, 0);
      },
      probe: () => ({ phase: ph, turn, hits, need, word, opts: opts.slice(), ok, cursor: curs, picked, press: ok >= 0 ? 'Digit' + (ok + 1) : null,
        tap: ok >= 0 ? [CELL(ok)[0] + 110, CELL(ok)[1] + 52] : null, left: +pt.toFixed(3), T: +TT.toFixed(3), result: g.result || null })
    };
    function drawFx(pix, txt) {
      for (const f of fx) {
        if (f.vx != null) { if (pix) R(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s, f.c); continue; }
        if (!txt) continue;
        const k = f.t / f.l, y = f.y - k * 46; ctx.font = `bold ${f.size}px "Courier New", Courier, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.lineWidth = f.size / 4; ctx.strokeStyle = C[3]; ctx.strokeText(f.s, f.x, y); ctx.fillStyle = C[0]; ctx.fillText(f.s, f.x, y);
      }
    }
    return g;
  };
})();
