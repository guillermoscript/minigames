'use strict';
/* PARTY microgames: MASH!, STOP!, COPY!, GRAB! - built for rooms with friends (see js/party.js).
   Everyone in a room builds the same game from the same seed (withSeed in core.js), so all the randomness is drawn once in the
   constructor from the local rng `R`; update/draw never touch Math.random for gameplay. Each game also reports `pts` (higher is
   better, used for ranking) and wins when it reaches `need`. Inputs: pointer, keyboard and touch all work.
   Each game: {cmd, hint, thint, dur, pts, update(dt), draw(t), down/move/up/key/keyup}; g.result = 'win'|'lose' */
(function () {

const PUR = '#7C4DFF', PUR2 = '#6a3de8', YEL = '#FFE14D', GRN = '#5CFF7A', RED = '#ff4d4d', BLU = '#4DB8FF', PNK = '#FF4D9E', CRM = '#FFF3D1';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mkR = () => mulberry32(Math.floor(Math.random() * 4294967296));   // Math.random is seeded while the constructor runs
const ptMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const ptBg = t => { bg(PUR, PUR2, t); ctx.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 6; i++) ctx.fillRect(-OX, 60 + i * 100, VW, 40); };
const ptWin = (x, y) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 30); ring(x, y, '#fff', 110); };
const ptLose = (x, y) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, RED, 14); ring(x, y, RED, 80); };
function ptNeed(g, cur) {                 // progress bar toward the goal, drawn near the top
  const x = 200, y = 74, w = 400, k = clamp(cur / g.need, 0, 1);
  box(x, y, w, 22, '#3a3550', 3); ctx.fillStyle = k >= 1 ? GRN : YEL; ctx.fillRect(x, y, w * k, 22);
  star(x + w, y + 11, 20, 9, 5, now * 2, k >= 1 ? GRN : '#4a4558', 3);
}

/* 1 MASH: hit the pad as often as you can; reach the goal to win, the most taps takes the round */
function ptMash(sp) {
  const R = mkR(), need = Math.round(13 + R() * 3 + (sp - 1) * 10);
  let taps = 0, squish = 0, last = 0;
  const g = {
    c: 0, cmd: 'MASH!', hint: 'CLICK / TAP / SPACE AS FAST AS YOU CAN!', thint: 'TAP AS FAST AS YOU CAN!', dur: 5, need, pts: 0, timeWin: false,
    update(dt) {
      g.c += dt; squish = Math.max(0, squish - dt * 7);
      if (!g.result && g.c >= g.dur) { g.result = taps >= need ? 'win' : 'lose'; (g.result === 'win' ? ptWin : ptLose)(400, 330); }
    },
    draw(t) {
      ptBg(t); ptNeed(g, taps);
      txt(`${taps} / ${need}`, 400, 140, 54, '#fff');
      const s = 1 - squish * .12 + (g.result ? 0 : Math.sin(now * 14) * .01);
      ctx.save(); ctx.translate(400, 340); ctx.scale(s, s);
      circ(0, 14, 120, '#c43b6c', 5); circ(0, 0, 120, taps >= need ? GRN : PNK, 5);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-36, -50, 52, 26, -.5, 0, 7); ctx.fill();
      txt(taps >= need ? 'GO ON!' : 'HIT!', 0, 4, 50, '#fff', 'center', 190); ctx.restore();
      claude(66 - OX, 590, 4.5, { mood: ptMood(g) }); vignette(.22);
    },
    down() { g.tap(); },
    key(e) { if (e.repeat) return; if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return; g.tap(); },
    tap() { if (g.result) return; taps++; g.pts = taps; squish = 1; last = g.c; sfx.blip(Math.min(18, taps)); burst(400, 330, YEL, 3, 160); },
  };
  return g;
}
reg('pt_mash', ptMash, 'MASH!');

/* 2 STOP: a needle swings back and forth; stop it inside the zone. Closer to the middle of the zone = more points */
function ptSync(sp) {
  const R = mkR(), spd = (2.1 + R() * .5) * (.9 + sp * .1), ph = R() * 6.28, zc = .2 + R() * .6, zw = .13 - Math.min(.04, (sp - 1) * .1);
  const X0 = 90, X1 = 710, Y = 330, pos = c => .5 + .5 * Math.sin(spd * c + ph);
  let stopAt = -1, stopPos = 0, acc = 0;
  const g = {
    c: 0, cmd: 'STOP!', hint: 'CLICK / TAP / SPACE TO STOP THE NEEDLE IN THE ZONE', thint: 'TAP TO STOP THE NEEDLE IN THE ZONE', dur: 5, need: 40, pts: 0,
    update(dt) {
      g.c += dt;
      if (!g.result && g.c >= g.dur) { g.result = 'lose'; ptLose(400, 330); }
    },
    stop() {
      if (g.result || g.c < .12) return;
      stopAt = g.c; stopPos = pos(g.c); const d = Math.abs(stopPos - zc);
      acc = Math.max(0, Math.round(100 * (1 - d / (zw * 1.6)))); g.pts = acc; sfx.stamp();
      const x = X0 + (X1 - X0) * stopPos;
      if (acc >= g.need) { g.result = 'win'; ptWin(x, Y); floatText(acc >= 90 ? 'PERFECT!' : acc >= 70 ? 'GREAT!' : 'NICE!', 400, 230, YEL, 50); }
      else { g.result = 'lose'; ptLose(x, Y); floatText('MISSED!', 400, 230, RED, 50); }
    },
    draw(t) {
      ptBg(t);
      txt('STOP IT IN THE ZONE', 400, 160, 36, '#fff', 'center', 700);
      box(X0 - 10, Y - 30, X1 - X0 + 20, 60, '#2b2757', 4);
      const zx = X0 + (X1 - X0) * (zc - zw), zww = (X1 - X0) * zw * 2;
      ctx.fillStyle = GRN; ctx.fillRect(zx, Y - 30, zww, 60); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(zx + zww / 2 - 3, Y - 30, 6, 60);
      const p = stopAt >= 0 ? stopPos : pos(g.c), nx = X0 + (X1 - X0) * p;
      ctx.fillStyle = INK; ctx.fillRect(nx - 9, Y - 60, 18, 120); ctx.fillStyle = stopAt >= 0 ? (g.result === 'win' ? '#fff' : RED) : YEL; ctx.fillRect(nx - 5, Y - 56, 10, 112);
      if (stopAt >= 0) txt(String(acc), 400, 440, 80, g.result === 'win' ? GRN : RED);
      else txt(TOUCH ? 'TAP!' : 'SPACE!', 400, 450, 64, '#fff');
      claude(66 - OX, 590, 4.5, { mood: ptMood(g) }); vignette(.22);
    },
    down() { g.stop(); },
    key(e) { if (e.repeat) return; if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') g.stop(); },
  };
  return g;
}
reg('pt_sync', ptSync, 'STOP!');

/* 3 COPY: watch a sequence of pads light up, then repeat it. Wrong pad loses; the fastest correct player wins */
function ptMemo(sp) {
  const R = mkR(), n = 4 + (sp > 1.25 ? 1 : 0) + (sp > 1.5 ? 1 : 0), seq = Array.from({ length: n }, () => Math.floor(R() * 4));
  const pads = [{ x: 400, y: 215, c: BLU, k: 'ArrowUp', l: 'W' }, { x: 560, y: 340, c: YEL, k: 'ArrowRight', l: 'D' }, { x: 400, y: 465, c: GRN, k: 'ArrowDown', l: 'S' }, { x: 240, y: 340, c: PNK, k: 'ArrowLeft', l: 'A' }];
  const STEP = .55, SHOW0 = .3, showEnd = SHOW0 + n * STEP + .2;
  let at = 0, glow = -1, glowT = 0, wrong = -1;
  const lit = c => { const i = Math.floor((c - SHOW0) / STEP); return i >= 0 && i < n && (c - SHOW0) % STEP < STEP * .75 ? seq[i] : -1; };
  let lastLit = -1;
  const g = {
    c: 0, cmd: 'COPY!', hint: 'WATCH, THEN CLICK THE PADS (OR ARROWS / WASD)', thint: 'WATCH, THEN TAP THE PADS IN ORDER', dur: 8, need: 0, pts: 0,
    update(dt) {
      g.c += dt; glowT = Math.max(0, glowT - dt);
      const l = g.c < showEnd ? lit(g.c) : -1; if (l !== lastLit) { lastLit = l; if (l >= 0) snd(330 + l * 110, .22, 'triangle', .07); }
      if (!g.result && g.c >= g.dur) { g.result = 'lose'; ptLose(400, 340); }
    },
    press(i) {
      if (g.result || g.c < showEnd) return;
      glow = i; glowT = .18;
      if (i === seq[at]) { snd(330 + i * 110, .2, 'triangle', .08); at++; if (at === n) { g.result = 'win'; g.pts = 1; ptWin(400, 340); floatText('COPIED!', 400, 150, YEL, 50); } }
      else { wrong = i; g.result = 'lose'; ptLose(pads[i].x, pads[i].y); floatText('WRONG!', 400, 150, RED, 50); }
    },
    draw(t) {
      ptBg(t);
      const showing = g.c < showEnd;
      txt(g.result ? '' : showing ? 'WATCH...' : 'YOUR TURN!', 400, 100, 48, showing ? '#fff' : YEL);
      if (!g.result) for (let i = 0; i < n; i++) circ(400 + (i - (n - 1) / 2) * 34, 150, 10, i < at ? GRN : '#3a3550', 3);
      const L = showing ? lit(g.c) : glowT > 0 ? glow : -1;
      pads.forEach((p, i) => {
        const on = L === i, bad = wrong === i;
        circ(p.x, p.y + (on ? 8 : 0), 76, bad ? RED : on ? '#fff' : p.c, 5);
        if (on) { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y + 8, 52, 0, 7); ctx.fill(); }
        if (!TOUCH) txt(p.l, p.x, p.y + 4, 28, on ? INK : '#fff');
      });
      claude(66 - OX, 590, 4.5, { mood: ptMood(g) }); vignette(.22);
    },
    down(p) { let b = -1, bd = 1e9; pads.forEach((q, i) => { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < 90 && d < bd) { bd = d; b = i; } }); if (b >= 0) g.press(b); },
    key(e) {
      if (e.repeat) return;
      const m = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 }[e.code];
      if (m !== undefined) g.press(m);
    },
  };
  return g;
}
reg('pt_memo', ptMemo, 'COPY!');

/* 4 GRAB: coins and bombs fall on a fixed schedule; slide the basket to catch coins and dodge bombs */
function ptGrab(sp) {
  const R = mkR(), items = [], gap = .34 / (.9 + sp * .1), vy = 380 + (sp - 1) * 160, FLOOR = 520;
  for (let t0 = .5; t0 < 6.2; t0 += gap) items.push({ t0, x: 70 + R() * 660, bomb: R() < .22, got: false });
  let bx = 400, kx = 0, caught = 0, flash = 0;
  const yOf = it => 20 + (g.c - it.t0) * vy;
  const g = {
    c: 0, cmd: 'GRAB!', hint: 'MOVE THE MOUSE (OR ◄ ►) TO CATCH COINS, AVOID BOMBS', thint: 'DRAG TO CATCH COINS, AVOID BOMBS', dur: 7, need: 7, pts: 0,
    update(dt) {
      g.c += dt; flash = Math.max(0, flash - dt * 4);
      if (!g.result) {
        bx = clamp(bx + kx * 560 * dt, 60, 740);
        for (const it of items) {
          if (it.got) continue; const y = yOf(it);
          if (y > FLOOR - 24 && y < FLOOR + 30 && Math.abs(it.x - bx) < 62) {
            it.got = true;
            if (it.bomb) { caught = Math.max(0, caught - 1); flash = 1; sfx.buzz(); shake(5, .15); burst(it.x, FLOOR, RED, 10); floatText('-1', it.x, FLOOR - 50, RED, 36); }
            else { caught++; sfx.coin(); burst(it.x, FLOOR, YEL, 8); }
            g.pts = caught;
          }
        }
        if (g.c >= g.dur) { g.result = caught >= g.need ? 'win' : 'lose'; (g.result === 'win' ? ptWin : ptLose)(400, 330); }
      }
    },
    draw(t) {
      ptBg(t); ptNeed(g, caught);
      txt(`${caught} / ${g.need}`, 400, 140, 44, '#fff');
      for (const it of items) { if (it.got) continue; const y = yOf(it); if (y < -30 || y > H + 30) continue; it.bomb ? ptBomb(it.x, y) : token(it.x, y, 22); }
      ctx.fillStyle = INK; ctx.fillRect(-OX, FLOOR + 40, VW, H);
      box(bx - 60, FLOOR - 6, 120, 44, flash > 0 ? RED : '#FF9A4D', 4); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(bx - 60, FLOOR - 6, 120, 10);
      claude(66 - OX, 590, 4.5, { mood: ptMood(g) }); vignette(.22);
    },
    move(p) { if (!g.result) bx = clamp(p.x, 60, 740); },
    down(p) { g.move(p); },
    key(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1; },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (kx < 0) kx = 0; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (kx > 0) kx = 0; } },
  };
  return g;
}
function ptBomb(x, y) {
  circ(x, y, 20, '#2b2b3a', 4); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 8, y - 18); ctx.lineTo(x + 16, y - 30); ctx.stroke();
  star(x + 17, y - 32, 8 + Math.sin(now * 30) * 2, 3, 6, now * 8, '#FFB020', 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 9, y - 9, 6, 6);
}
reg('pt_grab', ptGrab, 'GRAB!');

})();
