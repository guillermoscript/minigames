'use strict';
/* Switch wave — WarioWare Get It Together! / Move It! inspired microgames.
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), key/keyup/down/up/move}; set g.result = 'win'|'lose' */

const swSad = (g) => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const swLose = () => { sfx.miss(); sfx.thud(); shake(8, .25); };
function swMix(a, b, k) {
  const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const x = p(a), y = p(b); k = Math.max(0, Math.min(1, k));
  return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',') + ')';
}
function swEllipse(x, y, rx, ry, fill, o = 4) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7);
  if (o) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}
function swPoly(pts, fill, o = 4) {
  ctx.beginPath(); pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.closePath(); ctx.lineJoin = 'round';
  if (o) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}

/* ── 1 FREEZE: don't move while a truck bears down on you ── */
function swFreeze(sp) {
  const D = 4 / Math.sqrt(sp), lim = 22; let c = 0, ax = mouse.x, ay = mouse.y, dev = 0;
  let honk = false;
  const bust = () => { if (!g.result && c > .35) { g.result = 'lose'; swLose(); burst(400, 520, '#fff', 14); floatText('MOVED!', 400, 440, '#ff4d4d', 40); } };
  const g = {
    wide: true, cmd: 'FREEZE!', hint: 'DON\'T MOVE THE MOUSE OR KEYS', thint: 'DON\'T TOUCH THE SCREEN', dur: 4, timeWin: true,
    move(p) {
      if (g.result) return;
      if (c < .35) { ax = p.x; ay = p.y; return; }
      dev = Math.max(dev, Math.hypot(p.x - ax, p.y - ay)); if (dev > lim) bust();
    },
    down() { bust(); }, key() { bust(); },
    update(dt) {
      if (g.result) return;
      c += dt; dev *= Math.pow(.6, dt);
      if (c > 1 && Math.random() < dt * 2) { sfx.thud(); noise(.2, .03, 120, 60, 'lowpass'); }
      if (!honk && c > D * .7) { honk = true; sfx.buzz(); sfx.zap(); shake(4, .3); }
    },
    draw(t) {
      bg('#9BE7FF', '#8adcf5', t);
      ctx.fillStyle = '#7ad16b'; ctx.fillRect(-OX, 250, VW, 350 + OX);
      swPoly([[375, 250], [425, 250], [800 + OX, 600 + OX * .933], [-OX, 600 + OX * .933]], '#555', 5);
      ctx.fillStyle = '#FFE14D';
      for (let i = 0; i < 6; i++) { const k = ((i + (c * 1.2) % 1) / 6), y = 255 + k * k * 340, w = 3 + k * 16; ctx.fillRect(400 - w / 2, y, w, 8 + k * 40); }
      const k = Math.min(1, c / (D * .92)), s = .12 + 1.15 * k * k;
      const ty = 255 + 230 * s + (g.result === 'lose' ? 0 : Math.sin(now * 50) * k * 2);
      shadow(400, ty + 4 * s, 140 * s, 24 * s, .3);
      ctx.save(); ctx.translate(400, ty); ctx.scale(s, s);
      box(-110, -190, 220, 170, '#E8433A', 6); box(-85, -170, 170, 70, '#BFEFFF', 5); box(-70, -90, 140, 40, '#9aa', 5);
      circ(-80, -62, 14, '#FFE14D', 4); circ(80, -62, 14, '#FFE14D', 4); box(-120, -30, 240, 26, '#333', 5);
      ctx.restore();
      if (k > .1) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; for (let i = 0; i < 8; i++) { const a = i * .78 + .2, r1 = 160 + k * 60, r2 = r1 + 60 * k; ctx.beginPath(); ctx.moveTo(400 + Math.cos(a) * r1 * 1.4, 400 + Math.sin(a) * r1 * .8); ctx.lineTo(400 + Math.cos(a) * r2 * 1.4, 400 + Math.sin(a) * r2 * .8); ctx.stroke(); } }
      for (const ex of [300, 500]) {
        circ(ex, 100, 62, '#fff', 6); circ(ex + (400 - ex) * .12, 118, 24, INK, 0);
        ctx.fillStyle = '#FFD23F'; ctx.fillRect(ex - 70, 28, 140, 34 + (k > .7 ? 14 : 0)); ctx.fillStyle = INK; ctx.fillRect(ex - 70, 60 + (k > .7 ? 14 : 0), 140, 6);
      }
      shadow(400, 594, 50, 10, .3); claude(400, 592 + (g.result === 'lose' ? 30 : 0), 6, { mood: swSad(g) });
      if (k > .5 && !g.result) { ctx.fillStyle = '#4DB8FF'; ctx.beginPath(); ctx.arc(440, 540 + (now * 60 % 20), 6, 0, 7); ctx.fill(); }
      const jx = 20 - OX; box3(jx, 20, 200, 26, '#fff', 4, 4); ctx.fillStyle = swMix('#5CFF7A', '#ff4d4d', dev / lim); ctx.fillRect(jx, 20, 200 * Math.min(1, dev / lim), 26);
      txt('JITTER', jx + 100, 33, 18, '#fff'); vignette(.2 + k * .25);
    }
  };
  return g;
}

/* ── 2 PICK: drop the swinging finger into the open nostril ── */
function swPick(sp) {
  const rs = Math.sqrt(sp), ph = Math.random() * 6, o0 = Math.random() < .5 ? 0 : 1, NX = [355, 445], NY = 426;
  let c = 0, fx = 400, fy = 110, drop = false, landed = false, sq = 0, lock = -1, hit = false;
  const open = () => lock >= 0 ? lock : (o0 + Math.floor(c * rs / 1.6)) % 2;
  // the outcome is decided on the tap (hole frozen), so a last-second tap still counts; the fall is just the show
  const go = () => { if (drop || g.result || c < .3) return; drop = true; lock = open(); hit = Math.abs(fx - NX[lock]) < 42; g.result = hit ? 'win' : 'lose'; sfx.whoosh(false); };
  const g = {
    wide: true, cmd: 'PICK!', hint: 'CLICK / SPACE: DROP IN THE OPEN HOLE', thint: 'TAP TO DROP INTO THE OPEN HOLE', dur: 5,
    key(e) { if (e.code === 'Space' || e.code === 'ArrowDown') go(); }, down() { go(); },
    update(dt) {
      c += dt; sq = Math.max(0, sq - dt);
      if (!drop) fx = 400 + Math.sin(c * 1.1 * rs + ph) * 190;
      else if (!landed) {
        fy += 1500 * dt;
        if (fy >= 412) {
          fy = 412; landed = true; sq = .5;
          if (hit) { sfx.splat(); sfx.coin(); confetti(fx, 400, 20); burst(fx, 420, '#5CFF7A', 12); ring(fx, 420, '#fff', 80); floatText('+1', fx, 380, '#5CFF7A', 40); shake(6, .2); }
          else { swLose(); burst(fx, 420, '#ff4d4d', 10); ring(fx, 420, '#ff4d4d', 70); }
        }
      }
    },
    draw(t) {
      bg('#FFE29A', '#ffd97f', t);
      const wob = sq > 0 ? Math.sin(now * 70) * 5 : 0;
      ctx.save(); ctx.translate(wob, 0);
      shadow(400, 590, 280, 24, .25); swEllipse(400, 450, 300, 230, '#FFCBA4', 6);
      const win = g.result === 'win';
      for (const ex of [290, 510]) {
        circ(ex, 300, 40, '#fff', 5);
        if (win) { ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(ex - 30, 305); ctx.lineTo(ex + 30, 295); ctx.moveTo(ex - 30, 295); ctx.lineTo(ex + 30, 305); ctx.stroke(); }
        else circ(ex + (fx - ex) * .05, 306, 15, INK, 0);
        ctx.fillStyle = INK; ctx.fillRect(ex - 44, 240 + (g.result === 'lose' ? 6 : 0), 88, 10);
      }
      circ(400, 395, 92, '#F5B18A', 5);
      const o = open();
      NX.forEach((x, i) => {
        if (i === o) swEllipse(x, NY, 28, 22, INK, 4);
        else { swEllipse(x, NY, 28, 22, '#fff', 4); ctx.strokeStyle = '#e8433a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 14, NY - 10); ctx.lineTo(x + 14, NY + 10); ctx.moveTo(x + 14, NY - 10); ctx.lineTo(x - 14, NY + 10); ctx.stroke(); }
      });
      ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath();
      if (win) { ctx.arc(400, 520, 50, Math.PI * 1.1, Math.PI * 1.9); } else if (g.result === 'lose') { ctx.arc(400, 560, 50, Math.PI * 1.15, Math.PI * 1.85); } else { ctx.arc(400, 500, 60, Math.PI * .15, Math.PI * .85); }
      ctx.stroke(); ctx.lineCap = 'butt';
      ctx.restore();
      ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 50; ctx.beginPath(); ctx.moveTo(fx, -20); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.strokeStyle = '#FFCBA4'; ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(fx, -20); ctx.lineTo(fx, fy); ctx.stroke(); ctx.lineCap = 'butt';
      box(fx - 12, fy - 2, 24, 14, '#fff', 3);
      if (!landed) shadow(fx, 438, 20, 6, .3);
      if (!drop && c > .3) { ctx.fillStyle = '#4DB8FF'; ctx.beginPath(); ctx.arc(fx + 30, fy + 40 + (now * 80 % 30), 6, 0, 7); ctx.fill(); }
      if (win) txt('SQUISH!', 400, 100, 56, '#5CFF7A'); else if (g.result === 'lose') txt('OW!', 400, 100, 56, '#ff4d4d');
    }
  };
  return g;
}

/* ── 3 RUN: mash to outrun the monster ── */
function swRun(sp) {
  let gap = 310, v = 0, c = 0, off = 0, taps = 0;
  const mash = () => { if (g.result) return; v += 58; taps++; sfx.blip((taps % 2) * 4 - 6); burst(520 + Math.random() * 30, 520, '#e8dcff', 3, 120); };
  const g = {
    wide: true, cmd: 'RUN!', hint: 'MASH SPACE / ARROWS / CLICK', thint: 'TAP AS FAST AS YOU CAN', dur: 5, timeWin: true,
    key(e) { if (!e.repeat && (e.code === 'Space' || /^(Arrow|Key)/.test(e.code))) mash(); }, down() { mash(); },
    update(dt) {
      if (g.result) return;
      c += dt; v *= Math.pow(.35, dt);
      const ms = (150 + c * 16) * (.8 + .2 * sp);
      gap += (v - ms) * dt; off += v * dt; gap = Math.min(gap, 420);
      if (gap <= 40) { g.result = 'lose'; swLose(); sfx.splat(); burst(570, 440, '#8a4dff', 16); floatText('CAUGHT!', 400, 250, '#ff4d4d', 48); }
      else if (gap < 120 && Math.random() < dt * 3) sfx.thud();
    },
    draw(t) {
      bg('#FFB3D9', '#ff9fcd', t);
      const sh = gap < 140 ? Math.sin(now * 60) * (140 - gap) * .06 : 0;
      ctx.save(); ctx.translate(sh, -sh * .5);
      ctx.fillStyle = INK; ctx.fillRect(-OX - 30, 516, VW + 60, 90); ctx.fillStyle = '#9b6bd1'; ctx.fillRect(-OX - 30, 524, VW + 60, 80);
      const pd = Math.ceil((VW + 160) / 120) * 120, pt = Math.ceil((VW + 200) / 300) * 300;
      ctx.fillStyle = '#b48be3'; for (let i = 0; i < pd / 120; i++) ctx.fillRect(((i * 120 - off) % pd + pd) % pd - OX - 80, 560, 60, 10);
      for (let i = 0; i < pt / 300; i++) { const x = ((i * 300 - off * .5) % pt + pt) % pt - OX - 100; box(x, 380, 30, 140, '#7a5230', 4); circ(x + 15, 360, 50, '#5CC24A', 5); }
      const hx = 570, mx = hx - gap - 100;
      shadow(mx, 522, 110, 20, .3); shadow(hx, 520, 55, 11, .3);
      circ(mx, 400, 120, '#8a4dff', 6);
      circ(mx + 55, 330, 26, '#fff', 4); circ(mx + 62, 332, 10, INK, 0);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(mx + 78, 430, 48, 42, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { const a = -1.2 + i * .6; ctx.beginPath(); ctx.moveTo(mx + 78 + Math.cos(a) * 46, 430 + Math.sin(a) * 40); ctx.lineTo(mx + 78 + Math.cos(a + .25) * 46, 430 + Math.sin(a + .25) * 40); ctx.lineTo(mx + 78 + Math.cos(a + .12) * 20, 430 + Math.sin(a + .12) * 18); ctx.fill(); }
      claude(hx, 520, 8, { mood: swSad(g), run: g.result ? null : now });
      ctx.restore();
      const k = Math.max(0, Math.min(1, (gap - 40) / 380));
      box3(250, 30, 300, 20, '#fff', 4, 4); ctx.fillStyle = swMix('#ff4d4d', '#5CFF7A', k); ctx.fillRect(250, 30, 300 * k, 20);
    }
  };
  return g;
}

/* ── 4 ARREST: pick the suspect that matches the poster ── */
function swFaceDraw(x, y, s, tr) {
  const HC = [null, '#E8433A', '#4DB8FF', '#5CFF7A'];
  circ(x, y, 40 * s, '#FFCBA4', 3 * s);
  if (tr.hat) { ctx.fillStyle = INK; ctx.fillRect(x - 50 * s, y - 38 * s, 100 * s, 18 * s); ctx.fillRect(x - 32 * s, y - 72 * s, 64 * s, 40 * s); ctx.fillStyle = HC[tr.hat]; ctx.fillRect(x - 46 * s, y - 34 * s, 92 * s, 10 * s); ctx.fillRect(x - 28 * s, y - 68 * s, 56 * s, 34 * s); }
  ctx.fillStyle = INK; ctx.fillRect(x - 17 * s, y - 10 * s, 7 * s, 10 * s); ctx.fillRect(x + 10 * s, y - 10 * s, 7 * s, 10 * s);
  if (tr.gl) { ctx.strokeStyle = INK; ctx.lineWidth = 4 * s; for (const d of [-14, 14]) { ctx.beginPath(); ctx.arc(x + d * s, y - 5 * s, 11 * s, 0, 7); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 5 * s); ctx.lineTo(x + 3 * s, y - 5 * s); ctx.stroke(); }
  if (tr.mu) { ctx.fillStyle = INK; ctx.fillRect(x - 20 * s, y + 8 * s, 40 * s, 9 * s); }
  else { ctx.strokeStyle = INK; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x - 10 * s, y + 18 * s); ctx.lineTo(x + 10 * s, y + 18 * s); ctx.stroke(); }
  if (tr.scar) { ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(x + 22 * s, y - 18 * s); ctx.lineTo(x + 32 * s, y + 14 * s); ctx.stroke(); ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x + 24 * s, y - 2 * s); ctx.lineTo(x + 34 * s, y); ctx.stroke(); }
}
function swWanted(sp) {
  const all = []; for (let h = 0; h < 4; h++) for (let gl = 0; gl < 2; gl++) for (let mu = 0; mu < 2; mu++) for (let sc = 0; sc < 2; sc++) all.push({ hat: h, gl, mu, scar: sc });
  shuffle(all); const target = all.pop(), same = (a, b) => a.hat === b.hat && a.gl === b.gl && a.mu === b.mu && a.scar === b.scar;
  const people = shuffle([target, ...all.slice(0, 5)]);
  const cells = people.map((tr, i) => ({ tr, x: 380 + (i % 3) * 150, y: 230 + Math.floor(i / 3) * 190, ph: Math.random() * 6 }));
  let flash = 0, pick = -1;
  const g = {
    wide: true, cmd: 'ARREST!', hint: 'CLICK THE SUSPECT FROM THE POSTER', thint: 'TAP THE SUSPECT FROM THE POSTER', dur: 5,
    down(p) {
      if (g.result) return;
      const i = cells.findIndex(c => Math.abs(p.x - c.x) < 70 && Math.abs(p.y - c.y) < 85); if (i < 0) return;
      pick = i; flash = .3; sfx.stamp(); shake(5, .15); const c = cells[i];
      if (same(c.tr, target)) { g.result = 'win'; sfx.coin(); sfx.sparkle(); burst(c.x, c.y, '#5CFF7A', 14); ring(c.x, c.y, '#fff', 90); floatText('BUSTED!', c.x, c.y - 70, '#5CFF7A', 38); confetti(c.x, c.y, 20); } else { g.result = 'lose'; swLose(); burst(c.x, c.y, '#ff4d4d', 10); floatText('WRONG!', c.x, c.y - 70, '#ff4d4d', 34); }
    },
    update(dt) { flash = Math.max(0, flash - dt); },
    draw(t) {
      bg('#B8C0FF', '#a8b1f5', t);
      ctx.save(); ctx.translate(30, 0); ctx.rotate(-.04);
      box3(10, 130, 260, 360, '#F3DFA2', 6, 8); txt('WANTED', 140, 175, 40, '#e8433a', 'center', 220);
      swFaceDraw(140, 320, 2.1, target); txt('REWARD $$$', 140, 450, 24, INK, 'center', 220); ctx.restore();
      cells.forEach((c, i) => {
        const w = Math.sin(now * 3 + c.ph) * .05;
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(w);
        shadow(0, 88, 60, 10, .25); box3(-65, -80, 130, 160, pick === i ? (g.result === 'win' ? '#5CFF7A' : '#ff4d4d') : '#fff', 5);
        for (let k = 0; k < 4; k++) { ctx.fillStyle = INK; ctx.fillRect(-65, -80 + k * 40, 10, 3); }
        swFaceDraw(0, 0, 1.15, c.tr); ctx.restore();
      });
      if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + flash * 3 + ')'; ctx.fillRect(-OX, 0, VW, H); }
    }
  };
  return g;
}

/* ── 5 FRY: hold to cook, release when golden ── */
function swFry(sp) {
  let p = 0, hold = false, done = false, by = 130, c = 0, inZ = false; const Z0 = .5, Z1 = .7, rate = .3 * sp;
  const start = () => { if (!done && !g.result && !hold) { hold = true; sfx.whoosh(false); } };
  const end = () => {
    if (!hold || g.result) return; hold = false; done = true; sfx.whoosh();
    if (p >= Z0 && p <= Z1) { g.result = 'win'; sfx.coin(); sfx.sparkle(); confetti(400, 300, 25); ring(400, 340, '#FFE14D', 120); burst(400, 340, '#FFE14D', 14); floatText('+1', 400, 250, '#FFE14D', 44); }
    else { g.result = 'lose'; swLose(); }
  };
  const col = k => k < .6 ? swMix('#F4E3B1', '#E3A02B', k / .6) : swMix('#E3A02B', '#3b2412', (k - .6) / .3);
  const g = {
    wide: true, cmd: 'FRY!', hint: 'HOLD SPACE / MOUSE, RELEASE ON GOLD', thint: 'HOLD, RELEASE ON GOLD', dur: 5,
    key(e) { if (e.code === 'Space') start(); }, keyup(e) { if (e.code === 'Space') end(); }, down() { start(); }, up() { end(); },
    update(dt) {
      c += dt; by += ((hold ? 340 : 130) - by) * Math.min(1, 9 * dt);
      if (hold && !g.result) {
        p += rate * dt; if (Math.random() < .35) noise(.03, .025, 4000 + Math.random() * 3000, 7000, 'highpass');
        if (!inZ && p >= Z0) { inZ = true; sfx.blip(7); ring(400, 340, '#FFE14D', 70, .3); }
        if (p > Z1 + .03) { g.result = 'lose'; hold = false; swLose(); sfx.zap(); burst(400, 340, '#555', 12); }
      }
    },
    draw(t) {
      bg('#FFE0B2', '#ffd49a', t);
      shadow(400, 584, 280, 18, .3); box3(180, 400, 440, 170, '#555', 6, 6); box(150, 392, 500, 22, '#777', 5);
      ctx.fillStyle = '#F2A900'; ctx.fillRect(200, 414, 400, 60);
      ctx.fillStyle = '#ffd85a'; for (let i = 0; i < 9; i++) { const bx = 215 + i * 45 + Math.sin(now * 3 + i) * 6, byy = 436 + Math.sin(now * 5 + i * 2) * 8; ctx.beginPath(); ctx.arc(bx, byy, 7 + (i % 3) * 3, 0, 7); ctx.fill(); }
      const fc = col(p);
      ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(400, 0); ctx.lineTo(400, by - 10); ctx.stroke();
      ctx.strokeStyle = '#999'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(400, 0); ctx.lineTo(400, by - 10); ctx.stroke();
      box(330, by - 14, 140, 20, '#aaa', 4);
      swEllipse(400, by - 52, 62, 42, fc, 5);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(375, by - 74, 30, 8);
      if (hold || done) for (let i = 0; i < 5; i++) { const sx = 340 + i * 30, sy = 380 - ((now * 60 + i * 30) % 90); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, 7); ctx.fill(); }
      const bx = 150, bw = 500; box(bx, 50, bw, 34, '#fff', 5);
      const n = 40; for (let i = 0; i < n; i++) { ctx.fillStyle = col(i / n * .9); ctx.fillRect(bx + i * bw / n, 50, bw / n + 1, 34); }
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.strokeRect(bx + Z0 / .9 * bw, 44, (Z1 - Z0) / .9 * bw, 46); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(bx + Z0 / .9 * bw, 44, (Z1 - Z0) / .9 * bw, 46); txt('GOLD', bx + (Z0 + Z1) / 1.8 * bw, 116, 22, '#FFE14D');
      swPoly([[bx + p / .9 * bw - 14, 96], [bx + p / .9 * bw + 14, 96], [bx + p / .9 * bw, 78]], '#fff', 3);
      shadow(110, 562, 55, 10, .3); claude(110, 560, 7, { mood: swSad(g) });
      if (g.result === 'lose') txt(p < Z0 ? 'RAW!' : 'BURNT!', 400, 300, 60, '#ff4d4d'); else if (g.result === 'win') txt('PERFECT!', 400, 300, 60, '#5CFF7A');
    }
  };
  return g;
}

/* ── 6 FILL: hold to pump, release in the band ── */
function swFill(sp) {
  let f = 0, hold = false, done = false, c = 0, inB = false; const B0 = .78, B1 = .9;
  const start = () => { if (!done && !g.result && !hold) { hold = true; sfx.click(); } };
  const end = () => {
    if (!hold || g.result) return; hold = false; done = true; sfx.click();
    if (f >= B0 && f <= B1) { g.result = 'win'; sfx.coin(); sfx.sparkle(); confetti(560, 400, 20); ring(560, 440, '#5CFF7A', 120); floatText('+1', 560, 360, '#5CFF7A', 44); } else { g.result = 'lose'; swLose(); }
  };
  const g = {
    wide: true, cmd: 'FILL!', hint: 'HOLD SPACE / MOUSE, RELEASE IN GREEN', thint: 'HOLD, RELEASE IN GREEN', dur: 5,
    key(e) { if (e.code === 'Space') start(); }, keyup(e) { if (e.code === 'Space') end(); }, down() { start(); }, up() { end(); },
    update(dt) {
      c += dt;
      if (hold && !g.result) {
        f += .42 * sp * (1 - .35 * f) * dt; if (Math.random() < .4) noise(.04, .03, 300 + f * 1500, 600 + f * 2500, 'bandpass');
        if (!inB && f >= B0) { inB = true; sfx.blip(9); }
        if (f >= 1) { f = 1; g.result = 'lose'; hold = false; swLose(); sfx.splat(); burst(450, 410, '#4DB8FF', 18); }
      }
    },
    draw(t) {
      bg('#C3F584', '#b4ea6e', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, 516, VW, 90); ctx.fillStyle = '#888'; ctx.fillRect(-OX, 524, VW, 80);
      shadow(135, 524, 90, 12, .3); shadow(565, 540, 150, 14, .3);
      box3(60, 190, 150, 330, '#E8433A', 6, 6); box(80, 215, 110, 60, '#222', 4); txt(((f * 12) | 0) + '.' + ((f * 120) % 10 | 0) + 'L', 135, 246, 28, '#5CFF7A');
      box(100, 300, 70, 40, '#fff', 4);
      const sh = hold ? Math.sin(now * 60) * 2 : 0;
      ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(210, 340); ctx.quadraticCurveTo(300, 520, 450, 430); ctx.stroke();
      ctx.strokeStyle = '#444'; ctx.lineWidth = 8; ctx.stroke();
      ctx.save(); ctx.translate(sh, 0);
      box(430, 440, 270, 70, '#4DB8FF', 5); box(500, 385, 140, 60, '#BFEFFF', 5); circ(500, 515, 30, '#333', 5); circ(650, 515, 30, '#333', 5);
      box(610, 450, 40, 30, '#ffd23f', 3); ctx.restore();
      if (hold) { ctx.fillStyle = '#FFD23F'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(450 + ((now * 200 + i * 17) % 30), 430 + ((now * 120 + i * 11) % 14), 4, 0, 7); ctx.fill(); } }
      const gx = 320, gy = 130, gh = 340;
      box3(gx, gy, 56, gh, '#fff', 5, 5);
      ctx.fillStyle = '#5CFF7A'; ctx.fillRect(gx, gy + gh * (1 - B1), 56, gh * (B1 - B0));
      ctx.fillStyle = 'rgba(255,210,63,.9)'; ctx.fillRect(gx + 3, gy + gh * (1 - f), 50, gh * f);
      ctx.fillStyle = INK; ctx.fillRect(gx - 10, gy + gh * (1 - f) - 3, 76, 6);
      txt('FULL', gx + 28, gy - 14, 20, '#fff');
      if (g.result === 'lose' && f >= 1) txt('OVERFLOW!', 560, 300, 44, '#ff4d4d'); else if (g.result === 'lose') txt(f < B0 ? 'NOT ENOUGH!' : 'TOO MUCH!', 560, 300, 40, '#ff4d4d'); else if (g.result === 'win') txt('PERFECT!', 560, 300, 50, '#5CFF7A');
      shadow(260, 572, 45, 9, .3); claude(260, 570, 6, { mood: swSad(g) });
    }
  };
  return g;
}

/* ── 7 DUCK: crouch under UFOs ── */
function swLimbo(sp) {
  const sq = [0, 1, 0, 0].map((d, i) => ({ x: Math.max(900, W + OX + 80) + i * (330 - OX * .25), decoy: d, ph: Math.random() * 6, pass: false }));
  let crouch = 0, tgt = 0, held = false, c = 0;
  const g = {
    wide: true, cmd: 'DUCK!', hint: 'HOLD ↓ / SPACE / MOUSE TO CROUCH', thint: 'HOLD TO CROUCH, RELEASE TO STAND', dur: 5, timeWin: true,
    key(e) { if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') { if (!held) sfx.whoosh(false); held = true; } },
    keyup(e) { if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') held = false; },
    down() { if (!held) sfx.whoosh(false); held = true; }, up() { held = false; },
    update(dt) {
      c += dt; tgt = held ? 1 : 0; crouch += (tgt - crouch) * Math.min(1, 16 * dt);
      if (g.result) return;
      for (const u of sq) {
        u.x -= 380 * sp * dt;
        if (!u.decoy && Math.abs(u.x - 200) < 62 && crouch < .75) { g.result = 'lose'; swLose(); burst(200, 400, '#FFE14D', 14); floatText('BONK!', 200, 330, '#ff4d4d', 40); }
        else if (!u.pass && u.x < 140) { u.pass = true; if (!u.decoy) { sfx.whoosh(); sfx.blip(7); floatText('+1', 200, 350, '#5CFF7A', 32); } }
      }
    },
    draw(t) {
      bg('#FFB347', '#ffa733', t);
      ctx.fillStyle = '#4DB8FF'; ctx.fillRect(-OX, 400, VW, 80); ctx.fillStyle = '#fff'; for (let i = 0; i < Math.ceil(VW / 110); i++) ctx.fillRect(i * 110 - OX + Math.sin(now * 2 + i) * 10, 415 + (i % 2) * 20, 50, 6);
      ctx.fillStyle = INK; ctx.fillRect(-OX, 470, VW, 140); ctx.fillStyle = '#F4D9A0'; ctx.fillRect(-OX, 476, VW, 130);
      for (const x of [60 - OX, 740 + OX]) { box(x - 6, 300, 12, 180, '#7a5230', 4); circ(x, 290, 14, '#ff6b2b', 3); }
      for (const u of sq) {
        const y = u.decoy ? 190 : 360, bob = Math.sin(now * 4 + u.ph) * 4;
        if (!u.decoy) { swPoly([[u.x - 20, y + 18], [u.x + 20, y + 18], [u.x + 48, 420], [u.x - 48, 420]], 'rgba(120,255,160,.45)', 0); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(u.x - 20, y + 18); ctx.lineTo(u.x - 48, 420); ctx.moveTo(u.x + 20, y + 18); ctx.lineTo(u.x + 48, 420); ctx.stroke(); }
        shadow(u.x, 468, 50, 9, u.decoy ? .12 : .22); circ(u.x, y + bob - 16, 22, '#BFEFFF', 4); swEllipse(u.x, y + bob, 56, 20, '#9aa', 4);
        for (const d of [-30, 0, 30]) circ(u.x + d, y + bob + 2, 5, '#FFE14D', 2);
      }
      shadow(200, 472, 55 + crouch * 12, 10, .3); ctx.save(); ctx.translate(200, 470); ctx.scale(1 + .12 * crouch, 1 - .45 * crouch); claude(0, 0, 9, { mood: swSad(g) }); ctx.restore();
      if (c < 1.2) txt('GET LOW!', 400, 90, 44, '#fff');
    }
  };
  return g;
}

/* ── 8 STEER: broom through a scrolling night canyon ── */
function swSteer(sp) {
  const ph = Math.random() * 6, spd = 300 * sp; let s = 0, py = 300, tgt = 300, vy = 0, sp8 = 0;
  const cen = w => 300 + Math.min(1, Math.max(0, w) / 500) * (95 * Math.sin(w * .0075 + ph) + 40 * Math.sin(w * .017 + ph * 2));
  const hh = w => 205 - Math.min(1, Math.max(0, w) / 700) * (75 + 10 * Math.min(sp, 2));
  const top = w => cen(w) - hh(w) + (Math.sin(w * .05) + 1) * 7;
  const bot = w => cen(w) + hh(w) - Math.abs(Math.sin(w * .045)) * 24;
  const g = {
    wide: true, cmd: 'STEER!', hint: 'MOUSE UP/DOWN OR ↑ ↓ TO FLY', thint: 'DRAG UP AND DOWN', dur: 4.5, timeWin: true,
    move(p) { tgt = p.y; },
    update(dt) {
      if (g.result) return;
      if (keys.ArrowUp || keys.KeyW) tgt -= 520 * dt; if (keys.ArrowDown || keys.KeyS) tgt += 520 * dt;
      tgt = Math.max(60, Math.min(540, tgt)); const o = py; py += (tgt - py) * Math.min(1, 14 * dt); vy = (py - o) / Math.max(dt, .001);
      s += spd * dt;
      if (s === spd * dt) sfx.whoosh();
      if ((sp8 -= dt) < 0) { sp8 = .07; burst(130, py + 8, '#FFE14D', 1, 60); }
      for (const dx of [-24, 0, 24]) if (py - 16 < top(s + 170 + dx) || py + 14 > bot(s + 170 + dx)) { g.result = 'lose'; swLose(); burst(170, py, '#fff', 14); ring(170, py, '#ff4d4d', 80); break; }
    },
    draw(t) {
      bg('#2a1a5e', '#33236e', t);
      ctx.fillStyle = 'rgba(255,243,176,.12)'; ctx.beginPath(); ctx.arc(580, 170, 140, 0, 7); ctx.fill(); circ(580, 170, 100, '#FFF3B0', 6); circ(550, 140, 18, '#f0dc86', 0); circ(610, 200, 26, '#f0dc86', 0); circ(620, 120, 10, '#f0dc86', 0);
      ctx.beginPath(); ctx.moveTo(-OX - 10, 0);
      for (let x = -OX - 10; x <= W + OX + 10; x += 8) ctx.lineTo(x, top(s + x));
      ctx.lineTo(W + OX + 10, 0); ctx.closePath(); ctx.fillStyle = '#C9B6FF'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-OX - 10, H);
      for (let x = -OX - 10; x <= W + OX + 10; x += 8) ctx.lineTo(x, bot(s + x));
      ctx.lineTo(W + OX + 10, H); ctx.closePath(); ctx.fillStyle = '#1c4a32'; ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(170, py); ctx.rotate(Math.max(-.4, Math.min(.4, vy / 1200)));
      ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-50, 8); ctx.lineTo(50, 8); ctx.stroke();
      ctx.strokeStyle = '#b5793a'; ctx.lineWidth = 8; ctx.stroke(); ctx.lineCap = 'butt';
      box(-72, -2, 26, 20, '#e8c06a', 3);
      claude(0, 4, 4.5, { mood: swSad(g) });
      swPoly([[-16, -36], [0, -78], [16, -36]], '#5b2a86', 3); box(-22, -40, 44, 7, '#5b2a86', 3);
      ctx.restore(); vignette(.3);
    }
  };
  return g;
}

/* ── 9 SHHH: quiet everything that is waking the sleeper ── */
function swSleep(sp) {
  const items = [
    { k: 'alarm', x: 110, y: 410, r: 55, on: true },
    { k: 'lamp', x: 690, y: 300, r: 60, on: true },
    { k: 'fly', x: 400, y: 200, r: 38, on: true, a: Math.random() * 6 }
  ];
  if (sp > 1.5) items.push({ k: 'phone', x: 680, y: 480, r: 48, on: true });
  let z = 1, c = 0, rt = 0;
  const g = {
    wide: true, cmd: 'SHHH!', hint: 'CLICK EVERY NOISY THING', thint: 'TAP EVERY NOISY THING', dur: 5,
    down(p) {
      if (g.result) return;
      let best = null, bd = 1e9;
      for (const o of items) { const d = Math.hypot(p.x - o.x, p.y - o.y); if (o.on && d < o.r + 12 && d < bd) { best = o; bd = d; } }
      if (!best) return;
      best.on = false; (best.k === 'fly' ? sfx.hit : sfx.pop)(); burst(best.x, best.y, '#FFE14D', 8); ring(best.x, best.y, '#fff', 50, .3); floatText('SHH!', best.x, best.y - 40, '#fff', 26);
      if (items.every(o => !o.on)) { g.result = 'win'; sfx.coin(); sfx.sparkle(); floatText('NICE!', 400, 200, '#5CFF7A', 50); }
    },
    update(dt) {
      c += dt; if (g.result) return;
      const n = items.filter(o => o.on).length; z -= n * .14 * sp * dt;
      if (n && (rt -= dt) < 0) { rt = .45; snd(1800, .04, 'square', .015); snd(1500, .04, 'square', .015, .08); }
      const f = items[2]; if (f.on) { f.a += (Math.random() - .5) * 8 * dt; f.x += Math.cos(f.a + c * 3) * 190 * dt; f.y += Math.sin(f.a * 1.3 + c * 4) * 150 * dt; f.x = Math.max(250 - OX * .5, Math.min(550 + OX * .5, f.x)); f.y = Math.max(110, Math.min(280, f.y)); }
      if (z <= 0) { z = 0; g.result = 'lose'; swLose(); sfx.buzz(); floatText('WOKE UP!', 400, 200, '#ff4d4d', 44); }
    },
    draw(t) {
      bg('#2B2D6E', '#33377d', t);
      circ(690, 90, 40, '#FFF3B0', 5);
      box(-OX - 10, 470, VW + 20, 140, '#6b4a2e', 6);
      shadow(400, 488, 190, 14, .25); shadow(690, 474, 50, 8, .25);
      const lamp = items[1], al = items[0], fl = items[2], ph = items[3];
      if (lamp.on) { ctx.fillStyle = 'rgba(255,225,77,.22)'; ctx.beginPath(); ctx.moveTo(660, 330); ctx.lineTo(760, 330); ctx.lineTo(850, 600); ctx.lineTo(480, 600); ctx.fill(); }
      box(670, 340, 40, 130, '#9aa', 4); swPoly([[650, 340], [730, 340], [708, 270], [672, 270]], lamp.on ? '#FFE14D' : '#8a8a60', 4);
      box(230, 340, 340, 140, '#B8E3FF', 6); box(240, 330, 110, 50, '#fff', 5);
      const awake = g.result === 'lose';
      claude(400, 372, 11, { mood: awake ? 'sad' : 'happy' });
      box(230, 395, 340, 90, '#7C4DFF', 6);
      ctx.fillStyle = '#9a78ff'; for (let i = 0; i < 4; i++) ctx.fillRect(250 + i * 80, 405, 30, 70);
      box(40, 440, 150, 36, '#7a5230', 4);
      const sh = al.on ? Math.sin(now * 60) * 4 : 0;
      circ(al.x + sh, al.y, 42, al.on ? '#E8433A' : '#a85a55', 5); circ(al.x - 30 + sh, al.y - 40, 14, '#FFD23F', 4); circ(al.x + 30 + sh, al.y - 40, 14, '#FFD23F', 4);
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(al.x + sh, al.y); ctx.lineTo(al.x + sh, al.y - 24); ctx.moveTo(al.x + sh, al.y); ctx.lineTo(al.x + 16 + sh, al.y + 8); ctx.stroke();
      if (al.on) txt('RIIING!', al.x, al.y - 80, 24, '#FFE14D');
      if (ph) { const s2 = ph.on ? Math.sin(now * 70) * 4 : 0; box(ph.x - 22 + s2, ph.y - 38, 44, 76, ph.on ? '#4DB8FF' : '#58687a', 5); if (ph.on) txt('BZZ', ph.x - 40, ph.y - 52, 20, '#fff'); }
      if (fl.on) { const fx = fl.x, fy = fl.y; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(fx - 14, fy - 14, 12, 7, -.5 + Math.sin(now * 90) * .4, 0, 7); ctx.ellipse(fx + 14, fy - 14, 12, 7, .5 - Math.sin(now * 90) * .4, 0, 7); ctx.fill(); circ(fx, fy, 14, '#222', 3); txt('bzz', fx + 30, fy - 20, 16, '#fff'); }
      if (!awake) for (let i = 0; i < 3; i++) { const k = ((now * .5 + i / 3) % 1); txt('Z', 440 + k * 70 + i * 6, 310 - k * 130, 24 + i * 8, 'rgba(255,255,255,' + (1 - k) + ')'); }
      else txt('!', 400, 250, 70, '#ff4d4d');
      box3(250, 22, 300, 24, '#fff', 4, 4); ctx.fillStyle = swMix('#ff4d4d', '#5CFF7A', z); ctx.fillRect(250, 22, 300 * z, 24); txt('Zzz', 150, 34, 26, '#fff');
    }
  };
  return g;
}

/* ── 10 CONNECT: link the stars in order ── */
function swStars(sp) {
  const n = sp > 1.6 ? 5 : 4, pts = [];
  for (let tries = 0; pts.length < n && tries < 400; tries++) {
    const q = { x: 100 - OX * .7 + Math.random() * (600 + OX * 1.4), y: 140 + Math.random() * 360 };
    if (pts.every(p => Math.hypot(p.x - q.x, p.y - q.y) > (tries > 300 ? 90 : 160))) pts.push(q);
  }
  while (pts.length < n) pts.push({ x: 100 + pts.length * 100, y: 300 });
  let next = 0, wob = 0, cur = { x: 0, y: 0 }, started = false;
  const move = p => {
    cur = p; started = true; if (g.result || next >= n) return;
    for (let i = 0; i < n; i++) {
      if (Math.hypot(p.x - pts[i].x, p.y - pts[i].y) < 54) {
        if (i === next) { next++; sfx.blip(next * 2); burst(pts[i].x, pts[i].y, '#FFE14D', 8); ring(pts[i].x, pts[i].y, '#fff', 60, .3); if (next === n) { g.result = 'win'; sfx.coin(); sfx.sparkle(); confetti(400, 300, 30); floatText('NICE!', 400, 300, '#FFE14D', 54); } }
        else if (i > next) { if (wob <= 0) sfx.miss(); wob = .25; }
      }
    }
  };
  const g = {
    wide: true, cmd: 'CONNECT!', hint: 'MOUSE OVER THE STARS 1, 2, 3...', thint: 'DRAG THROUGH THE STARS IN ORDER', dur: 7,
    move, update(dt) { wob = Math.max(0, wob - dt); },
    draw(t) {
      bg('#1b1f4d', '#232963', t);
      for (let i = 0, ns = Math.round(30 * VW / W); i < ns; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (.4 + .4 * Math.sin(now * 3 + i)) + ')'; ctx.fillRect((i * 97) % VW - OX, (i * 53) % H, 3, 3); }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const path = () => { ctx.beginPath(); for (let i = 0; i < next; i++) ctx.lineTo(pts[i].x, pts[i].y); if (g.result === 'win') ctx.closePath(); };
      if (next > 0) {
        ctx.strokeStyle = INK; ctx.lineWidth = 14; path(); ctx.stroke(); ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 7; path(); ctx.stroke();
        if (!g.result && started) { ctx.beginPath(); ctx.moveTo(pts[next - 1].x, pts[next - 1].y); ctx.lineTo(cur.x, cur.y); ctx.strokeStyle = 'rgba(255,225,77,.5)'; ctx.lineWidth = 5; ctx.stroke(); }
      }
      if (g.result === 'win') { ctx.fillStyle = 'rgba(255,225,77,.3)'; path(); ctx.fill(); }
      ctx.lineCap = 'butt';
      pts.forEach((p, i) => {
        const done = i < next, sx = (i > next && wob > 0) ? Math.sin(now * 80) * 5 : 0;
        if (done) { ctx.fillStyle = 'rgba(255,225,77,.18)'; ctx.beginPath(); ctx.arc(p.x, p.y, 52 + Math.sin(now * 5 + i) * 4, 0, 7); ctx.fill(); }
        star(p.x + sx, p.y, 36 + (i === next ? Math.sin(now * 8) * 4 : 0), 17, 5, now * (done ? 1 : .3), done ? '#FFE14D' : '#fff', 4);
        txt(String(i + 1), p.x + sx, p.y + 2, 26, INK);
      });
    }
  };
  return g;
}

/* ── 11 DRAW: wait for the "!" then click (beware fake-outs) ── */
function swDraw(sp) {
  const rs = Math.sqrt(sp), t1 = (.8 + Math.random() * .5) / rs, fakeLen = .45 / rs, t2 = t1 + fakeLen + (.7 + Math.random() * .6) / rs, win = .62 / rs;
  let c = 0, slash = 0, early = false;
  const phase = () => c < t1 ? 0 : c < t1 + fakeLen ? 1 : c < t2 ? 0 : 2;
  const g = {
    wide: true, cmd: 'DRAW!', hint: 'CLICK ONLY WHEN YOU SEE "!"', thint: 'TAP ONLY WHEN YOU SEE "!"', dur: 5,
    key(e) { if (e.code === 'Space') fire(); }, down() { fire(); },
    update(dt) {
      if (g.result) { slash = Math.max(0, slash - dt); return; }
      const o = c; c += dt;
      if (o < t1 && c >= t1) { sfx.blip(-7); sfx.click(); }
      if (o < t2 && c >= t2) { sfx.zap(); sfx.blip(12); shake(3, .12); }
      if (c > t2 + win) { g.result = 'lose'; swLose(); }
    }
  };
  function fire() {
    if (g.result) return;
    if (phase() === 2) { g.result = 'win'; slash = .4; sfx.whoosh(); sfx.hit(); sfx.coin(); shake(10, .25); burst(580, 380, '#fff', 16, 340); ring(580, 380, '#FFE14D', 120); floatText('+1', 400, 220, '#5CFF7A', 44); }
    else { g.result = 'lose'; early = true; swLose(); }
  }
  g.draw = function (t) {
    bg('#FFB347', '#ffa733', t);
    circ(400, 330, 90, '#FF7A3D', 0);
    ctx.fillStyle = INK; ctx.fillRect(-OX, 470, VW, 140); ctx.fillStyle = '#D9A066'; ctx.fillRect(-OX, 476, VW, 130);
    box(110, 330, 20, 140, '#4a9a3a', 4); box(670, 360, 20, 110, '#4a9a3a', 4);
    const ph = phase(), lose = g.result === 'lose', won = g.result === 'win';
    shadow(220, 472, 55, 10, .3); shadow(580, 472, 60, 10, .3); claude(220, 470, 9, { mood: swSad(g) });
    box(250, 420, 80, 8, '#ddd', 3);
    ctx.save(); ctx.translate(580, 470); if (won) ctx.rotate(.8);
    box(-30, -130, 60, 100, INK, 0); box(-28, -128, 56, 98, '#333', 3); box(-45, -150, 90, 20, '#222', 4); box(-26, -178, 52, 34, '#222', 4);
    box(-26, -30, 20, 30, '#222', 3); box(6, -30, 20, 30, '#222', 3); circ(-8, -105, 4, '#fff', 0); circ(10, -105, 4, '#fff', 0);
    if (ph === 2 || lose) box(-110, -95, 70, 8, '#ccc', 3);
    ctx.restore();
    if (ph === 1 && !g.result) txt('?', 400, 150, 100, '#4DB8FF');
    if (ph === 2 && !g.result) { star(400, 160, 100, 70, 12, now * 3, '#ff4d4d', 6); txt('!', 400, 160, 110, '#fff'); }
    if (slash > 0) { ctx.strokeStyle = 'rgba(255,255,255,' + slash * 2.5 + ')'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(260, 380); ctx.lineTo(620, 330); ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,' + slash * 2.5 + ')'; ctx.beginPath(); ctx.moveTo(280, 400); ctx.lineTo(600, 350); ctx.stroke(); }
    if (lose) txt(early ? 'TOO EARLY!' : 'TOO SLOW!', 400, 150, 54, '#ff4d4d'); else if (won) txt('CLEAN CUT!', 400, 150, 54, '#5CFF7A');
    else if (ph === 0) txt('...', 400, 150, 60, '#fff');
  };
  return g;
}

/* ── 12 PROTECT: shoot down meteors before they hit the flowers ── */
function swProtect(sp) {
  const rs = Math.sqrt(sp), nm = sp > 1.5 ? 5 : 4, sp1 = (sp > 1.5 ? .6 : .75) / rs, fall = 1.7 / rs, nf = 5 + 2 * Math.floor(OX / 140), fl = Array.from({ length: nf }, (_, i) => ({ x: 400 + (i - (nf - 1) / 2) * 140, hurt: false }));
  const mets = []; for (let i = 0; i < nm; i++) { const tx = fl[(Math.random() * nf) | 0].x; mets.push({ at: (.4 + i * sp1 * 1) , sx: tx + (Math.random() - .5) * 500, tx, alive: true, x: 0, y: -50, hit: false }); }
  let c = 0, killed = 0;
  const g = {
    wide: true, cmd: 'PROTECT!', hint: 'CLICK THE METEORS', thint: 'TAP THE METEORS', dur: 5, timeWin: true,
    down(p) {
      if (g.result) return;
      let b = null, bd = 1e9;
      for (const m of mets) { if (!m.alive || c < m.at) continue; const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < 55 && d < bd) { b = m; bd = d; } }
      if (b) { b.alive = false; killed++; sfx.pop(); sfx.hit(); confetti(b.x, b.y, 10); burst(b.x, b.y, '#FF8A3D', 12); ring(b.x, b.y, '#fff', 60, .3); floatText('+1', b.x, b.y - 30, '#fff', 30); if (killed === nm) { g.result = 'win'; sfx.coin(); sfx.sparkle(); } }
      else sfx.click();
    },
    update(dt) {
      c += dt; if (g.result) return;
      for (const m of mets) {
        if (!m.alive || c < m.at) continue;
        const k = (c - m.at) / fall; m.x = m.sx + (m.tx - m.sx) * k; m.y = -40 + k * 520;
        if (k >= 1) { m.alive = false; fl.find(f => f.x === m.tx).hurt = true; g.result = 'lose'; swLose(); sfx.splat(); shake(12, .35); burst(m.tx, 480, '#FF8A3D', 20, 340); ring(m.tx, 500, '#ff4d4d', 110); }
      }
    },
    draw(t) {
      bg('#FFD6E8', '#ffc9e0', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, 524, VW, 90); ctx.fillStyle = '#9be37f'; ctx.fillRect(-OX, 530, VW, 80);
      for (const f of fl) {
        const dy = f.hurt ? 14 : 0; shadow(f.x, 540, 34, 7, .25);
        ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(f.x, 540); ctx.lineTo(f.x, 470 + dy); ctx.stroke();
        ctx.strokeStyle = '#3aa34a'; ctx.lineWidth = 5; ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = i * 1.047; circ(f.x + Math.cos(a) * 22, 456 + dy + Math.sin(a) * 22, 14, f.hurt ? '#9a8a99' : '#FF4D9E', 3); }
        circ(f.x, 456 + dy, 14, f.hurt ? '#777' : '#FFE14D', 3);
      }
      for (const m of mets) {
        if (!m.alive || c < m.at) continue;
        const dx = (m.tx - m.sx) * .2; shadow(m.tx + (m.x - m.tx) * .1, 536, 10 + (m.y + 40) / 520 * 24, 5, .2);
        swPoly([[m.x - 18, m.y - 10], [m.x + 18, m.y - 10], [m.x - dx, m.y - 110]], '#FFC93C', 0);
        circ(m.x, m.y, 26, '#FF8A3D', 5); circ(m.x - 8, m.y - 6, 7, '#c0501d', 0); circ(m.x + 9, m.y + 7, 5, '#c0501d', 0);
      }
      shadow(400, 598, 40, 8, .3); claude(400, 600, 5, { mood: swSad(g) });
    }
  };
  return g;
}

reg('sw_freeze', swFreeze, 'FREEZE');
reg('sw_pick', swPick, 'PICK');
reg('sw_run', swRun, 'RUN');
reg('sw_wanted', swWanted, 'ARREST');
reg('sw_fry', swFry, 'FRY');
reg('sw_fill', swFill, 'FILL');
reg('sw_limbo', swLimbo, 'DUCK');
reg('sw_steer', swSteer, 'STEER');
reg('sw_sleep', swSleep, 'SHHH');
reg('sw_stars', swStars, 'CONNECT');
reg('sw_draw', swDraw, 'DRAW');
reg('sw_protect', swProtect, 'PROTECT');
