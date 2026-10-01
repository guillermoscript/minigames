'use strict';
/* MEGA MICROGAME$ wave 1 — GBA-WarioWare-inspired: 4-shade Game Boy green, blocky fillRect sprites, square-wave beeps.
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), key/keyup/down/up/move}; set g.result = 'win'|'lose' */
(function () {
  const C = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];   // darkest .. lightest
  const R = (x, y, w, h, c) => { ctx.fillStyle = C[c]; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const FLAT = () => { ctx.fillStyle = C[3]; ctx.fillRect(0, 0, W, H); };
  /* sprite from char rows: digits = palette index, 'b' = tint colour tc, '.' = empty */
  function spr(rows, x, y, s, tc) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]; if (ch === '.') continue;
        R(x + i * s, y + r * s, s, s, ch === 'b' ? tc : +ch);
      }
    }
  }
  /* pixel Claude. x = centre, y = bottom of feet, c = cell size */
  function cl(x, y, c, mood, armsUp) {
    R(x - 7 * c, y - 8 * c, 14 * c, 6 * c, 0); R(x - 6 * c, y - 7 * c, 12 * c, 4 * c, 2);
    const ay = armsUp ? y - 9 * c : y - 6 * c;
    R(x - 9 * c, ay, 2 * c, 3 * c, 0); R(x - 8 * c, ay + c, c, c, 2);
    R(x + 7 * c, ay, 2 * c, 3 * c, 0); R(x + 7 * c, ay + c, c, c, 2);
    for (const lx of [-5, -2, 1, 4]) R(x + lx * c, y - 2 * c, c, 2 * c, 0);
    for (const ex of [-3, 2]) {
      if (mood === 'happy') { R(x + (ex - 1) * c, y - 5 * c, c, c, 0); R(x + ex * c, y - 6 * c, c, c, 0); R(x + (ex + 1) * c, y - 5 * c, c, c, 0); }
      else if (mood === 'sad') { R(x + ex * c, y - 5 * c, c, c, 0); R(x + ex * c, y - 4 * c, c, c, 1); }
      else R(x + ex * c, y - 6 * c, c, 2 * c, 0);
    }
  }
  /* tiny pixel fx (own system so nothing is drawn outside the 4 shades) */
  const fx = [];
  function pix(x, y, n = 10, c = 0, sp = 240) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = sp * (.4 + Math.random() * .8); fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, l: .45 + Math.random() * .3, t: 0, s: 8, c }); }
  }
  function ptxt(s, x, y) { fx.push({ x, y, s, l: .8, t: 0, txt: 1 }); }
  function fxUpdate(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.t += dt; if (f.t >= f.l) { fx.splice(i, 1); continue; }
      if (!f.txt) { f.vy += 700 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    }
  }
  function fxDraw() {
    for (const f of fx) {
      if (f.txt) {
        const y = f.y - f.t / f.l * 48;
        ctx.font = 'bold 36px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = C[2]; ctx.fillText(t(f.s), f.x + 3, y + 3); ctx.fillStyle = C[0]; ctx.fillText(t(f.s), f.x, y);
      } else R(f.x, f.y, f.s, f.s, f.c);
    }
  }
  const beep = (f, d = .08, v = .05, delay = 0) => snd(f, d, 'square', v, delay);
  const mWin = () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .09, .05, i * .07));
  const mLose = () => [392, 330, 262, 196].forEach((f, i) => beep(f, .12, .05, i * .09));
  const pxRect = (x, y, w, h, fill) => { R(x, y, w, h, 0); R(x + 6, y + 6, w - 12, h - 12, fill); };   // chunky 6px border rect

  /* ── 1 ROPE: hop the swinging pixel rope 3 times ── */
  reg('mm_rope', sp => {
    fx.length = 0;
    const rs = Math.sqrt(sp), w = 4.7 * rs, JD = .6, CX = 400, GY = 450;
    let th = -2.3, jt = -1, passed = 0, blip = 0;
    const jump = () => { if (g.result || jt >= 0) return; jt = 0; beep(660, .07); beep(990, .06, .04, .04); };
    const jh = () => jt < 0 ? 0 : Math.sin(Math.PI * jt / JD) * 76;
    const ropeY = () => 360 + Math.cos(th) * 90;
    const g = {
      cmd: 'JUMP!', hint: 'SPACE / CLICK: HOP OVER THE ROPE', thint: 'TAP TO HOP', dur: 5, timeWin: true,
      key(e) { if (e.code === 'Space' || e.code === 'ArrowUp') jump(); }, down() { jump(); },
      update(dt) {
        fxUpdate(dt);
        if (g.result) return;
        th += w * dt;
        if (jt >= 0) { jt += dt; if (jt >= JD) { jt = -1; pix(CX, GY, 5, 1, 120); beep(220, .04, .04); } }
        if (ropeY() >= 438 && jh() < 18) {
          g.result = 'lose'; mLose(); shake(7, .25); pix(CX, GY - 20, 14, 0, 300); ptxt('TRIP!', CX, 300); return;
        }
        const need = passed * 6.2832 + .6;
        if (th > need) {
          passed++; beep(880 + passed * 120, .09, .05); ptxt(passed + '/3', CX, 300); pix(CX, GY, 8, 1, 200);
          if (passed >= 3) { g.result = 'win'; mWin(); shake(4, .15); pix(CX, 380, 24, 0, 380); }
        }
      },
      draw(t) {
        FLAT();
        R(0, GY, W, 8, 0); R(0, GY + 8, W, H - GY - 8, 2);
        for (let x = 0; x < W; x += 32) R(x + ((x / 32 & 1) ? 8 : 0), GY + 40, 8, 8, 1);
        // handles / posts
        for (const px of [CX - 180, CX + 180]) { R(px - 8, 360, 16, GY - 360, 1); R(px - 16, 344, 32, 24, 0); }
        const back = Math.sin(th) > 0;
        const drawRope = () => {
          for (let i = 0; i <= 44; i++) {
            const u = -1 + i / 22, x = CX + u * 180, y = 356 + Math.cos(th) * 94 * (1 - u * u);
            R(Math.round(x / 6) * 6 - 4, Math.round(y / 6) * 6 - 4, 8, 8, 0);
          }
        };
        if (back) drawRope();
        const h = jh(), over = g.result;
        R(CX - 52, GY - 2, 104, 6, 1);
        cl(CX, GY - h + (0), 6, over === 'lose' ? 'sad' : over === 'win' ? 'happy' : null, over === 'win' || jt >= 0);
        if (!back) drawRope();
        for (let i = 0; i < 3; i++) { R(24 + i * 40, 24, 32, 32, 0); R(28 + i * 40, 28, 24, 24, i < passed ? 0 : 3); }
        fxDraw();
      }
    };
    return g;
  }, 'Pixel Rope');

  /* ── 2 STAMP: stamp the paper when its target box is under the stamper ── */
  reg('mm_stamp', sp => {
    fx.length = 0;
    const rs = Math.sqrt(sp), v = 320 * rs, SP = 250, SX = 400, PY = 300, PW = 128, PH = 112;
    const papers = Array.from({ length: 4 }, (_, k) => ({ k, off: Math.round((Math.random() - .5) * 44 / 4) * 4, done: 0, mark: 0, gone: 0 }));
    let t0 = 0, anim = 0, cd = 0, good = 0, fails = 0;
    const px = p => -90 + v * t0 - p.k * SP;
    const lose = (s) => { if (g.result) return; g.result = 'lose'; mLose(); shake(8, .3); ptxt(s, SX, 130); };
    const stamp = () => {
      if (g.result || cd > 0) return;
      anim = .22; cd = .28; shake(3, .1); beep(110, .1, .09); beep(80, .1, .06, .03);
      let best = null, bd = 1e9;
      for (const p of papers) { const d = Math.abs(px(p) - SX); if (d < 100 && d < bd && !p.done) { bd = d; best = p; } }
      if (!best) { for (const p of papers) if (Math.abs(px(p) - SX) < 100) { /* stamped an already-marked paper */ } lose('BLANK!'); pix(SX, 380, 12, 0); return; }
      const d = Math.abs(px(best) + best.off - SX);
      best.mark = SX - px(best);
      if (d < 26) { best.done = 1; good++; ptxt('GOOD!', SX, 200); pix(SX, 330, 14, 0, 260); beep(1047, .08, .05, .05); beep(1319, .1, .05, .1); if (good >= 3) { g.result = 'win'; mWin(); } }
      else { best.done = 2; fails++; ptxt('OFF!', SX, 200); pix(SX, 330, 8, 1); beep(150, .15, .06, .05); if (fails >= 2) lose('SMUDGE!'); }
    };
    const g = {
      cmd: 'STAMP!', hint: 'SPACE / CLICK: STAMP THE BOX', thint: 'TAP TO STAMP', dur: 5,
      key(e) { if (e.code === 'Space' || e.code === 'ArrowDown') stamp(); }, down() { stamp(); },
      update(dt) {
        fxUpdate(dt); anim = Math.max(0, anim - dt); cd = Math.max(0, cd - dt);
        if (g.result) { t0 += dt * .3; return; }
        t0 += dt;
        for (const p of papers) if (!p.done && !p.gone && px(p) + p.off > SX + 70) { p.gone = 1; fails++; ptxt('MISSED', SX, 200); beep(150, .15, .06); shake(4, .15); if (fails >= 2) lose('TOO SLOW!'); }
      },
      draw(t) {
        FLAT();
        // conveyor
        R(0, PY + PH, W, 40, 0); R(0, PY + PH + 6, W, 28, 1);
        const off = (t0 * v) % 32;
        for (let x = -32; x < W + 32; x += 32) R(x + off, PY + PH + 14, 16, 12, 0);
        for (let x = 40; x < W; x += 160) { R(x, PY + PH + 40, 16, 70, 0); R(x - 16, PY + PH + 100, 48, 10, 0); }
        // papers
        for (const p of papers) {
          const x = px(p); if (x < -100 || x > W + 100) continue;
          pxRect(x - PW / 2, PY, PW, PH, 3);
          for (let i = 0; i < 3; i++) R(x - PW / 2 + 16, PY + 14 + i * 10, 40 + (i * 13 % 24), 4, 2);
          const tx = x + p.off - 24;
          if (!p.done) { // target dashed box
            const bl = (Math.sin(now * 14) > 0) ? 0 : 1;
            for (let i = 0; i < 6; i++) if (i % 2 === 0) { R(tx + i * 8, PY + 48, 8, 4, bl); R(tx + i * 8, PY + 92, 8, 4, bl); R(tx, PY + 48 + i * 8, 4, 8, bl); R(tx + 44, PY + 48 + i * 8, 4, 8, bl); }
            R(tx + 16, PY + 62, 16, 16, 2);
          } else {
            R(tx, PY + 48, 48, 48, 2); R(tx + 4, PY + 52, 40, 4, 1); R(tx + 4, PY + 88, 40, 4, 1);
          }
          if (p.done) {
            const mx = x + p.mark - 24;
            if (p.done === 1) { R(mx, PY + 40, 48, 48, 0); R(mx + 8, PY + 48, 32, 32, 3); R(mx + 16, PY + 56, 16, 16, 0); }
            else { R(mx + 4, PY + 44, 40, 40, 1); R(mx - 4, PY + 60, 20, 12, 1); R(mx + 36, PY + 52, 16, 20, 1); }
          }
        }
        // stamper
        const dn = anim > 0 ? Math.sin(Math.min(1, (.22 - anim) / .22) * Math.PI) : 0, sy = 70 + dn * 130;
        R(SX - 8, 0, 16, sy, 1); R(SX - 32, sy, 64, 24, 0); R(SX - 24, sy + 24, 48, 24, 1); R(SX - 40, sy + 48, 80, 20, 0); R(SX - 32, sy + 62, 64, 6, 2);
        R(SX - 6, 150 + 90, 12, 4, 3);
        // claude clerk
        cl(690, 560, 6, g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null, g.result === 'win');
        for (let i = 0; i < 3; i++) { R(24 + i * 40, 24, 32, 32, 0); R(28 + i * 40, 28, 24, 24, i < good ? 0 : 3); }
        fxDraw();
      }
    };
    return g;
  }, 'Pixel Stamp');

  /* ── 3 TOAST: hold to charge, release in the golden zone ── */
  reg('mm_toast', sp => {
    fx.length = 0;
    const rs = Math.sqrt(sp), rate = .6 * rs, zs = .5 + Math.random() * .18, zw = Math.max(.12, .2 - .045 * (sp - 1)), ze = zs + zw;
    const BREAD = ['..000000..', '.0bbbbbb0.', '0bbbbbbbb0', '00bbbbbb00', '.0bbbbbb0.', '.0bbbbbb0.', '.0bbbbbb0.', '.0bbbbbb0.', '.00000000.'];
    let f = 0, hold = false, tk = 0, inZone = false, fly = null;
    const col = () => f < zs * .55 ? 3 : f < zs ? 2 : f <= ze ? 1 : 0;
    const start = () => { if (g.result || hold || fly) return; hold = true; sfx.click(); };
    const pop = () => {
      hold = false;
      const ok = f >= zs && f <= ze;
      fly = { x: 360, y: 240, vx: 390, vy: -800, c: col(), land: 0 };
      noise(.1, .03, 400, 2000, 'bandpass');
      if (ok) { g.result = 'win'; mWin(); shake(5, .2); pix(400, 330, 18, 0, 320); ptxt('GOLDEN!', 400, 250); }
      else { g.result = 'lose'; mLose(); shake(7, .25); pix(400, 330, 12, 0, 280); ptxt(f < zs ? 'RAW!' : 'BURNT!', 400, 250); }
    };
    const g = {
      cmd: 'POP!', hint: 'HOLD CLICK / SPACE, RELEASE IN THE ZONE', thint: 'HOLD, RELEASE IN THE ZONE', dur: 5,
      key(e) { if (e.code === 'Space' && !e.repeat) start(); }, keyup(e) { if (e.code === 'Space' && hold) pop(); },
      down() { start(); }, up() { if (hold) pop(); },
      update(dt) {
        fxUpdate(dt);
        if (hold && !g.result) {
          f += rate * dt; tk -= dt;
          if (tk <= 0) { tk = .09; beep(300 + f * 700, .04, .035); }
          const z = f >= zs && f <= ze; if (z && !inZone) { beep(1319, .08, .05); pix(400, 240, 6, 1, 120); } inZone = z;
          if (f >= 1) { f = 1; pop(); }
        }
        if (fly) {
          fly.vy += 3200 * dt; fly.x += fly.vx * dt * (fly.land ? 0 : 1); fly.y += fly.vy * dt;
          if (!fly.land && fly.vy > 0 && fly.y + 72 >= 462) { fly.y = 462 - 72; fly.land = 1; fly.vy = 0; fly.vx = 0; beep(180, .08, .06); pix(fly.x + 40, 462, 6, 1, 140); }
          if (fly.land) { fly.y = 462 - 72; }
        }
      },
      draw(t) {
        FLAT();
        R(0, 480, W, 8, 0); R(0, 488, W, H - 488, 2);
        // plate
        R(590, 462, 130, 12, 0); R(602, 474, 106, 8, 1);
        // toaster
        const tx = 280, ty = 330, tw = 240, th2 = 150;
        R(tx + 20, ty + th2 + 2, 200, 10, 1);
        // bread rising in slot (clipped to above toaster top)
        if (!fly) {
          const vis = 22 + f * 36;
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, ty + 8); ctx.clip();
          spr(BREAD, 360, ty + 8 - vis, 8, col()); ctx.restore();
        }
        pxRect(tx, ty, tw, th2, 2);
        R(tx + 18, ty + 18, 204, 12, 0); R(tx + 24, ty + 20, 192, 6, 1);
        R(tx + 18, ty + 54, 204, 6, 1); R(tx + 18, ty + 66, 80, 6, 1);
        R(tx + 24, ty + 110, 16, 16, 0); R(tx + 28, ty + 114, 8, 8, 3);                // dial
        R(tx + tw, ty + 30, 18, 12, 0); R(tx + tw + 12, ty + 30 + (hold ? f * 70 : 0) - 6, 18, 36, 0);  // lever
        R(tx + tw + 16, ty + 34 + (hold ? f * 70 : 0) - 2, 10, 28, 2);
        R(tx + 8, ty + th2, 40, 16, 0); R(tx + tw - 48, ty + th2, 40, 16, 0);          // feet
        if (fly) spr(BREAD, fly.x, fly.y, 8, fly.c);
        // smoke when burnt
        if (g.result === 'lose' && f > ze) for (let i = 0; i < 4; i++) { const k = (now * .8 + i * .27) % 1; R(400 + Math.sin(k * 9 + i) * 30, 300 - k * 140, 16 - k * 8, 16 - k * 8, 1); }
        // meter
        const mx = 200, my = 100, mw = 400, mh = 40;
        R(mx - 8, my - 8, mw + 16, mh + 16, 0); R(mx, my, mw, mh, 2);
        R(mx, my, mw * f, mh, 1);
        R(mx + mw * ze, my, mw * (1 - ze), mh, 0);
        for (let i = 0; i < (1 - ze) * mw / 16; i++) R(mx + mw * ze + i * 16 + 4, my + 4, 8, mh - 8, 1);
        R(mx + mw * zs, my - 8, mw * zw, mh + 16, 0); R(mx + mw * zs + 6, my - 2, mw * zw - 12, mh + 4, 3);
        R(mx + mw * zs + mw * zw / 2 - 6, my + 12, 12, 16, 0);
        R(mx + mw * f - 4, my - 20, 8, mh + 40, 0);
        cl(130, 560, 6, g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null, g.result === 'win');
        fxDraw();
      }
    };
    return g;
  }, 'Pixel Toast');

  /* ── 4 SHOOT: aim the cannon and shoot all invaders before they land ── */
  reg('mm_shoot', sp => {
    fx.length = 0;
    const rs = Math.sqrt(sp), cols = sp > 1.5 ? 4 : 3, rows = 2, CY = 570, LINE = 490;
    const A = ['.0....0.', '..0..0..', '.111111.', '11311311', '11111111', '1.1111.1', '1.1..1.1', '..0..0..'];
    const B = ['.0....0.', '1.0..0.1', '11111111', '11311311', '11111111', '.111111.', '..1..1..', '.1.00.1.'];
    const inv = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) inv.push({ c, r, alive: 1 });
    let ox = 120, oy = 90, dir = 1, cx = 400, tx = 400, cd = 0, rec = 0;
    const bul = [];
    const px = i => ox + i.c * 76, py = i => oy + i.r * 62;
    const fire = () => {
      if (g.result || cd > 0 || bul.length >= 3) return;
      cd = .2; rec = .1; bul.push({ x: cx, y: 480 }); beep(1175, .05, .05); beep(784, .06, .04, .03);
    };
    const g = {
      cmd: 'SHOOT!', hint: 'MOUSE / ARROWS: AIM   CLICK / SPACE: FIRE', thint: 'DRAG TO AIM, TAP TO FIRE', dur: 5,
      key(e) { if (e.code === 'Space' || e.code === 'ArrowUp') fire(); },
      move(p) { tx = Math.max(40, Math.min(W - 40, p.x)); },
      down(p) { tx = Math.max(40, Math.min(W - 40, p.x)); cx = tx; fire(); },
      update(dt) {
        fxUpdate(dt); cd = Math.max(0, cd - dt); rec = Math.max(0, rec - dt);
        if (g.result) return;
        const kd = (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0) - (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0);
        if (kd) { cx += kd * 460 * dt; tx = cx; } else cx += (tx - cx) * Math.min(1, dt * 20);
        cx = Math.max(40, Math.min(W - 40, cx));
        const live = inv.filter(i => i.alive);
        ox += dir * 120 * rs * dt; oy += 36 * rs * dt;
        const minX = Math.min(...live.map(px)), maxX = Math.max(...live.map(px)) + 48;
        if (maxX > 776 && dir > 0) { dir = -1; oy += 22; beep(196, .05, .04); }
        else if (minX < 24 && dir < 0) { dir = 1; oy += 22; beep(196, .05, .04); }
        for (let i = bul.length - 1; i >= 0; i--) {
          const b = bul[i]; b.y -= 780 * dt;
          let hit = null;
          for (const v of live) if (b.x > px(v) - 4 && b.x < px(v) + 52 && b.y < py(v) + 48 && b.y + 18 > py(v)) { hit = v; break; }
          if (hit) {
            hit.alive = 0; bul.splice(i, 1); pix(px(hit) + 24, py(hit) + 24, 12, 1, 260); pix(px(hit) + 24, py(hit) + 24, 6, 0, 180);
            ptxt('POW!', px(hit) + 24, py(hit)); shake(3, .1); beep(880, .05, .06); beep(440, .09, .06, .04); beep(220, .1, .05, .08);
            if (!inv.some(v => v.alive)) { g.result = 'win'; mWin(); pix(400, 300, 20, 0, 360); }
          } else if (b.y < -30) bul.splice(i, 1);
        }
        for (const v of inv) if (v.alive && py(v) + 48 >= LINE && !g.result) {
          g.result = 'lose'; mLose(); shake(9, .35); pix(cx, CY - 30, 18, 0, 340); ptxt('LANDED!', 400, 300);
        }
      },
      draw(t) {
        FLAT();
        R(0, LINE + 6, W, 6, 1);
        for (let x = 0; x < W; x += 24) R(x, LINE + 6, 12, 6, 0);
        R(0, 600 - 16, W, 16, 2);
        const fr = Math.floor(now * 3) % 2 ? A : B;
        for (const v of inv) if (v.alive) spr(fr, px(v), py(v), 6);
        for (const b of bul) { R(b.x - 4, b.y, 8, 20, 0); R(b.x - 2, b.y + 4, 4, 8, 3); }
        // cannon-Claude
        R(cx - 12, CY - 48 - 26 + (rec > 0 ? 6 : 0), 24, 26, 0); R(cx - 6, CY - 48 - 20 + (rec > 0 ? 6 : 0), 12, 18, 1);
        if (rec > .05) { R(cx - 10, CY - 96, 20, 8, 3); R(cx - 4, CY - 106, 8, 8, 3); }
        cl(cx, CY, 6, g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null, g.result === 'win');
        fxDraw();
      }
    };
    return g;
  }, 'Pixel Shoot');
})();
