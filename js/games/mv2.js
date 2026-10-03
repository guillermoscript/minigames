'use strict';
/* Move It! wave 2 - pose and rhythm microgames: PUNCH, WAVE, CLAP, STAND.
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), key/keyup/down/move/up}; g.result = 'win'|'lose' */
(function () {

const MAG = '#E0399B', PUR = '#7A3FD1', TEAL = '#2EC4B6', YEL = '#FFE14D', MINT = '#5CFF7A', RED = '#ff4d4d';
const mvMood = (g) => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const mvLose = () => { sfx.miss(); sfx.thud(); shake(8, .25); };
const mvWin = (x, y) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 36); ring(x, y, '#fff', 110); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* chunky pixel spectator: x,y = feet, s = scale, arms: 0 down, 1 up, 2 together in front */
function mvPerson(x, y, s, col, arms, hop) {
  y -= hop || 0;
  shadow(x, y + 2, 20 * s, 6 * s, .22);
  box(x - 12 * s, y - 30 * s, 24 * s, 30 * s, col, 3);
  box(x - 10 * s, y - 52 * s, 20 * s, 20 * s, '#FFCBA4', 3);
  ctx.fillStyle = INK; ctx.fillRect(x - 6 * s, y - 45 * s, 4 * s, 5 * s); ctx.fillRect(x + 2 * s, y - 45 * s, 4 * s, 5 * s);
  if (arms === 1) { box(x - 20 * s, y - 52 * s, 8 * s, 22 * s, '#FFCBA4', 3); box(x + 12 * s, y - 52 * s, 8 * s, 22 * s, '#FFCBA4', 3); }
  else if (arms === 2) { box(x - 5 * s, y - 28 * s, 10 * s, 10 * s, '#FFCBA4', 3); }
  else { box(x - 19 * s, y - 28 * s, 7 * s, 20 * s, '#FFCBA4', 3); box(x + 12 * s, y - 28 * s, 7 * s, 20 * s, '#FFCBA4', 3); }
}
/* crowd columns (spacing 82) covering the whole screen: returns {m, n} = extra columns each side, total per row */
function mvCrowd() { const m = Math.ceil(OX / 82); return { m, n: 9 + 2 * m }; }
function mvMeter(x, y, w, v, col, label) {
  box3(x, y, w, 26, '#fff', 4, 4); ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(v, 0, 1), 26);
  txt(label, x + w / 2, y + 13, 18, '#fff');
}

/* 1 PUNCH: enemies pop from left / right / up; punch the matching direction */
function mvPunch(sp) {
  const rs = Math.sqrt(sp), N = 4, WIN = 1.0 / rs, GAP = .22 / rs;
  const L = 0, R = 1, U = 2;
  const POS = [[130, 430], [670, 430], [400, 160]], ARR = [3, 1, 0];
  const CX = 400, CY = 485;
  const dirs = []; let lastD = -1;
  for (let i = 0; i < N; i++) { let d; do { d = Math.floor(Math.random() * 3); } while (d === lastD); dirs.push(d); lastD = d; }
  let c = 0, gapT = .45 / rs, idx = 0, cnt = 0, cur = null, fist = null, hurt = 0; const dead = [];
  const lose = (msg) => {
    if (g.result) return; g.result = 'lose'; mvLose(); hurt = .5;
    floatText(msg, 400, 300, RED, 46); burst(CX, CY - 20, RED, 14);
  };
  const punch = (d) => {
    if (g.result) return;
    fist = { d, t: 0 };
    if (!cur) { sfx.whoosh(); return; }
    if (d === cur.d) {
      const p = POS[d]; dead.push({ d, t: 0 }); cnt++; idx++;
      sfx.hit(); sfx.thud(); shake(6, .18); burst(p[0], p[1], YEL, 16); ring(p[0], p[1], '#fff', 90);
      floatText(['POW!', 'BAM!', 'WHAM!', 'KO!'][Math.min(3, cnt - 1)], p[0], p[1] - 70, YEL, 40);
      cur = null; gapT = GAP;
      if (cnt >= N) { g.result = 'win'; mvWin(400, 300); }
    } else lose('WRONG WAY!');
  };
  const KM = { ArrowLeft: L, KeyA: L, ArrowRight: R, KeyD: R, ArrowUp: U, KeyW: U };
  const g = {
    wide: true, cmd: 'PUNCH!', hint: 'ARROWS: PUNCH THE ENEMY\'S SIDE', thint: 'TAP THE SIDE WHERE THEY POP UP', dur: 5.6,
    key(e) { if (!e.repeat && KM[e.code] != null) punch(KM[e.code]); },
    down(p) { const dx = p.x - 400; punch(Math.abs(dx) > 170 ? (dx < 0 ? L : R) : U); },
    update(dt) {
      c += dt; hurt = Math.max(0, hurt - dt);
      if (fist) { fist.t += dt; if (fist.t > .25) fist = null; }
      for (let i = dead.length - 1; i >= 0; i--) { dead[i].t += dt; if (dead[i].t > .5) dead.splice(i, 1); }
      if (g.result) return;
      if (!cur) {
        gapT -= dt;
        if (gapT <= 0 && idx < N) { cur = { d: dirs[idx], t: 0 }; sfx.pop(); ring(POS[cur.d][0], POS[cur.d][1], '#fff', 70, .3); }
      } else {
        cur.t += dt;
        if (cur.t > WIN) lose('TOO SLOW!');
      }
    },
    draw(t) {
      bg(MAG, '#cb2c8b', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, 524, VW, 80); ctx.fillStyle = PUR; ctx.fillRect(-OX, 532, VW, 70);
      ctx.fillStyle = '#9560e8'; for (let i = -Math.ceil(OX / 110); i < (W + OX) / 110; i++) ctx.fillRect(i * 110 + 20, 560, 60, 8);
      const drawEnemy = (d, k, a, ko) => {
        const p = POS[d], sc = k, ex = p[0], ey = p[1];
        ctx.save(); ctx.globalAlpha = a; ctx.translate(ex, ey); ctx.scale(sc, sc);
        if (ko) ctx.rotate(ko * (d === L ? -1 : 1));
        shadow(0, 62, 62, 14, .3);
        circ(0, 0, 56, PUR, 6);
        ctx.fillStyle = TEAL; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 30 - 12, -52); ctx.lineTo(i * 30, -84); ctx.lineTo(i * 30 + 12, -52); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); }
        circ(-20, -8, 14, '#fff', 4); circ(20, -8, 14, '#fff', 4);
        ctx.fillStyle = INK; ctx.fillRect(-24, -10, 8, 8); ctx.fillRect(16, -10, 8, 8);
        ctx.fillRect(-36, -30, 30, 7); ctx.fillRect(6, -30, 30, 7);
        if (ko) { ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-26, 30); ctx.lineTo(26, 30); ctx.stroke(); }
        else { ctx.fillStyle = INK; ctx.fillRect(-26, 22, 52, 22); ctx.fillStyle = '#fff'; ctx.fillRect(-20, 22, 10, 8); ctx.fillRect(10, 22, 10, 8); }
        ctx.restore();
      };
      for (const dd of dead) {
        const u = dd.t / .5;
        ctx.save(); ctx.translate((dd.d === L ? -1 : dd.d === R ? 1 : 0) * u * 260, (dd.d === U ? -1 : 0) * u * 180 - 60 * Math.sin(u * 3));
        drawEnemy(dd.d, 1, 1 - u, u * 8); ctx.restore();
      }
      if (cur) {
        const k = clamp(cur.t / .12, 0, 1), sc = k < 1 ? 1.25 * k : 1 + Math.max(0, .25 * (1 - (cur.t - .12) / .1));
        const p = POS[cur.d];
        drawEnemy(cur.d, sc, 1, 0);
        const left = 1 - cur.t / WIN, blink = left < .35 && Math.sin(now * 40) > 0;
        const ax = CX + (p[0] - CX) * .55, ay = CY - 20 + (p[1] - (CY - 20)) * .55 - (cur.d === U ? 0 : 20);
        if (!blink) drawArrow(ax, ay, ARR[cur.d], 30, YEL);
        box3(p[0] - 50, p[1] + 78, 100, 14, '#fff', 3, 3); ctx.fillStyle = left < .35 ? RED : MINT; ctx.fillRect(p[0] - 50, p[1] + 78, 100 * left, 14);
      }
      // Claude + fist
      const f = fist ? Math.sin(clamp(fist.t / .25, 0, 1) * Math.PI) : 0;
      shadow(CX, 528, 70, 14, .3);
      ctx.save(); if (hurt > 0) ctx.translate(Math.sin(now * 80) * 6, 0);
      claude(CX, 524, 8, { mood: mvMood(g) }); ctx.restore();
      if (fist) {
        const p = POS[fist.d], tx = CX + (p[0] - CX) * .72 * f, ty = CY - 5 + (p[1] - (CY - 5)) * .72 * f;
        ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(CX, CY - 5); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = OR; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(CX, CY - 5); ctx.lineTo(tx, ty); ctx.stroke(); ctx.lineCap = 'butt';
        circ(tx, ty, 26, '#fff', 5);
        if (f > .8) { star(tx, ty, 50, 24, 8, now * 4, YEL, 4); }
      }
      for (let i = 0; i < N; i++) { circ(300 + i * 67, 50, 16, i < cnt ? YEL : '#fff', 4); if (i < cnt) star(300 + i * 67, 50, 10, 4, 5, 0, '#fff', 0); }
      vignette(.25);
    }
  };
  return g;
}
reg('mv_punch', mvPunch, 'Punch!');

/* 2 WAVE: wave the mouse (or alternate left/right) until the crowd cheers */
function mvWave(sp) {
  const rs = Math.sqrt(sp), need = 8 + Math.round(sp - 1);
  let meter = 0, c = 0, s = 1, ha = 0, lx = null, dir = 0, ext = 0, lastKey = '', hearts = [], flash = 0;
  const wave = () => {
    if (g.result) return;
    meter = Math.min(1, meter + 1 / need); s = -s; flash = .12;
    sfx.blip(Math.round(meter * 14)); sfx.whoosh(s > 0);
    const hx = 400 + 110 * Math.sin(s * .7) + 50, hy = 260 - 110 * Math.cos(s * .7);
    burst(hx, hy, '#fff', 4, 160);
    if (meter > .25 && Math.random() < .6) hearts.push({ x: 140 - OX + Math.random() * (520 + 2 * OX), y: 470, t: 0 });
    if (meter >= 1) { g.result = 'win'; mvWin(400, 300); floatText('CHEERS!', 400, 170, YEL, 50); }
  };
  const g = {
    wide: true, cmd: 'WAVE!', hint: 'WAVE THE MOUSE (OR ALTERNATE LEFT / RIGHT)', thint: 'SWIPE LEFT AND RIGHT FAST', dur: 5,
    key(e) {
      if (e.repeat) return;
      const k = (e.code === 'ArrowLeft' || e.code === 'KeyA') ? 'L' : (e.code === 'ArrowRight' || e.code === 'KeyD') ? 'R' : '';
      if (k && k !== lastKey) { lastKey = k; wave(); }
    },
    move(p) {
      if (lx === null) { lx = p.x; return; }
      const dx = p.x - lx; if (Math.abs(dx) < 3) return; lx = p.x;
      const nd = dx > 0 ? 1 : -1;
      if (dir === 0) { dir = nd; ext = Math.abs(dx); return; }
      if (nd === dir) ext += Math.abs(dx);
      else { if (ext >= 35) wave(); dir = nd; ext = Math.abs(dx); }
    },
    update(dt) {
      c += dt; flash = Math.max(0, flash - dt);
      ha += (s * .7 - ha) * Math.min(1, dt * 18);
      if (!g.result) meter = Math.max(0, meter - .06 * dt * sp);
      for (let i = hearts.length - 1; i >= 0; i--) { hearts[i].t += dt; if (hearts[i].t > 1) hearts.splice(i, 1); }
    },
    draw(t) {
      bg(TEAL, '#27b0a3', t);
      // stage
      ctx.fillStyle = INK; ctx.fillRect(-OX, 336, VW, 260); ctx.fillStyle = PUR; ctx.fillRect(-OX, 344, VW, 252);
      box3(120, 310, 560, 34, '#FF6FC4', 4, 6);
      // crowd
      const cols = [MAG, '#4DB8FF', YEL, MINT, '#fff', OR];
      const { m, n } = mvCrowd();
      for (let r = 0; r < 2; r++) for (let j = 0; j < n; j++) {
        const i = j - m, x = 70 + i * 82 + (r ? 41 : 0), y = r ? 590 : 520, thr = (j + r * n) / (2 * n), up = meter > thr * .9 + .05;
        mvPerson(x, y, 1.15, cols[(j + r * 2) % cols.length], up ? 1 : 0, up ? Math.abs(Math.sin(now * 9 + i)) * meter * 22 : 0);
      }
      // Claude on stage
      shadow(400, 316, 80, 14, .3);
      const base = { mood: mvMood(g) || (meter > .5 ? 'happy' : null) };
      claude(400, 312, 9, base);
      const sx = 448, sy = 262, L = 120, hx = sx + Math.sin(ha) * L, hy = sy - Math.cos(ha) * L;
      ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = OR; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke(); ctx.lineCap = 'butt';
      circ(hx, hy, 30, '#fff', 5);
      ctx.fillStyle = INK; for (let i = -1; i <= 1; i++) ctx.fillRect(hx + i * 10 - 2, hy - 8, 4, 16);
      if (flash > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(sx, sy - 10, 150, -Math.PI * .5 - s * 1.2, -Math.PI * .5 - s * .5, s > 0); ctx.stroke(); }
      for (const h of hearts) { const u = h.t; ctx.globalAlpha = 1 - u; txt('♥', h.x + Math.sin(u * 8) * 10, h.y - u * 120, 40, '#ff4d9e'); ctx.globalAlpha = 1; }
      mvMeter(250, 24, 300, meter, meter > .7 ? MINT : YEL, 'CHEER');
      vignette(.2);
    }
  };
  return g;
}
reg('mv_wave', mvWave, 'Wave!');

/* 3 CLAP: watch the crowd clap 3 beats, then echo the rhythm */
function mvClap(sp) {
  const rs = Math.sqrt(sp), b = .5 / rs, tol = .17 / Math.pow(sp, .35);
  const pats = [[0, 1, 2], [0, .5, 1.5], [0, 1, 1.5], [0, .5, 1]];
  const pat = pats[Math.floor(Math.random() * pats.length)];
  const D0 = .45, E0 = D0 + (pat[2] + 1.6) * b;
  const dem = pat.map(o => D0 + o * b), ech = pat.map(o => E0 + o * b);
  const BX = [300, 400, 500], hit = [false, false, false], demoDone = [false, false, false], lit = [false, false, false];
  let c = 0, pulse = 0, mine = 0;
  const clapFx = (me) => { pulse = .16; if (me) mine = .16; snd(me ? 520 : 330, .07, 'square', .06, 0, me ? 260 : 180); noise(.05, .06, 2500, 5000, 'highpass'); };
  const press = () => {
    if (g.result) return;
    clapFx(true);
    if (c < E0 - tol) { sfx.tick(); return; }
    let bj = -1, bd = 9;
    for (let j = 0; j < 3; j++) if (!hit[j] && Math.abs(c - ech[j]) < bd) { bd = Math.abs(c - ech[j]); bj = j; }
    if (bj >= 0 && bd <= tol) {
      hit[bj] = true; lit[bj] = true; sfx.hit(); sfx.blip(bj * 3);
      const perf = bd < tol * .5; burst(BX[bj], 150, perf ? YEL : MINT, 10); ring(BX[bj], 150, '#fff', 60, .3);
      floatText(perf ? 'PERFECT' : 'GOOD', BX[bj], 215, perf ? YEL : MINT, 26);
      if (hit.every(Boolean)) { g.result = 'win'; mvWin(400, 300); }
    } else { g.result = 'lose'; mvLose(); floatText('OFF BEAT!', 400, 300, RED, 46); }
  };
  const g = {
    wide: true, cmd: 'CLAP!', hint: 'WATCH THE RHYTHM, THEN ECHO IT: SPACE / CLICK', thint: 'WATCH, THEN TAP THE BEATS', dur: 4.6,
    key(e) { if (!e.repeat && e.code === 'Space') press(); },
    down() { press(); },
    update(dt) {
      c += dt; pulse = Math.max(0, pulse - dt); mine = Math.max(0, mine - dt);
      if (g.result) return;
      for (let j = 0; j < 3; j++) if (!demoDone[j] && c >= dem[j]) { demoDone[j] = true; clapFx(false); }
      for (let j = 0; j < 3; j++) if (!hit[j] && c > ech[j] + tol) { g.result = 'lose'; mvLose(); floatText('MISSED!', 400, 300, RED, 46); break; }
    },
    draw(t) {
      bg(PUR, '#6c36bd', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, 380, VW, 230); ctx.fillStyle = MAG; ctx.fillRect(-OX, 388, VW, 220);
      const cols = [TEAL, YEL, '#4DB8FF', MINT, OR, '#fff'];
      const { m, n } = mvCrowd();
      for (let r = 0; r < 2; r++) for (let j = 0; j < n; j++) {
        const x = 70 + (j - m) * 82 + (r ? 41 : 0), y = r ? 470 : 420, cl = pulse > 0;
        mvPerson(x, y, 1, cols[(j + r) % cols.length], cl ? 2 : 0, cl ? 6 : 0);
      }
      // Claude clapping
      shadow(400, 590, 80, 14, .3);
      claude(400, 588, 9, { mood: mvMood(g) });
      const sp2 = mine > 0 ? 0 : 20;
      box(400 - 54 - sp2 - 12, 540, 24, 24, '#fff', 4); box(400 + 54 + sp2 - 12, 540, 24, 24, '#fff', 4);
      if (mine > 0) star(400, 552, 36, 16, 8, now * 5, YEL, 3);
      // beat targets
      const echoing = c >= E0 - b * 1.2;
      for (let j = 0; j < 3; j++) {
        const lt = lit[j] || demoDone[j] && !echoing;
        circ(BX[j], 150, 26, hit[j] ? MINT : lt ? YEL : '#fff', 5);
        if (echoing && !hit[j]) {
          const k = clamp((ech[j] - c) / (b * 1.1), -.2, 1), r = 28 + k * 70;
          ctx.strokeStyle = k < .15 ? YEL : '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(BX[j], 150, r, 0, 7); ctx.stroke();
        }
      }
      txt(echoing ? 'NOW!' : 'WATCH', 400, 80, 34, echoing ? YEL : '#fff');
      vignette(.25);
    }
  };
  return g;
}
reg('mv_clap', mvClap, 'Clap!');

/* 4 STAND: keep your balance on one leg; tap against the lean */
function mvBalance(sp) {
  const rs = Math.sqrt(sp), K = 2.4, DAMP = .9, ZONE = .4;
  const p1 = Math.random() * 6, p2 = Math.random() * 6, A = .75 * rs;
  let a = (Math.random() < .5 ? -1 : 1) * .28, w = 0, c = 0, md = 0, fall = 0, warn = 0, lastDir = 0;
  const push = (d) => { if (g.result) return; w += d * 1.4; sfx.click(); burst(400 - d * -20, 470, '#fff', 3, 120); lastDir = d; };
  const g = {
    get lean() { return a; }, wide: true, cmd: 'STAND!', hint: 'LEFT / RIGHT AGAINST THE LEAN', thint: 'TAP THE SIDE OPPOSITE THE LEAN', dur: 5, timeWin: true,
    key(e) {
      if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') push(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') push(1);
    },
    down(p) { md = p.x < 400 ? -1 : 1; push(md); },
    up() { md = 0; },
    update(dt) {
      c += dt; warn = Math.max(0, warn - dt);
      if (g.result === 'lose') { fall += dt; a += Math.sign(a || 1) * dt * 3; return; }
      if (g.result) return;
      let u = 0;
      if (keys.ArrowLeft || keys.KeyA) u -= 4; if (keys.ArrowRight || keys.KeyD) u += 4; u += md * 4;
      const wind = A * (Math.sin(c * 2.1 + p1) + .7 * Math.sin(c * 3.7 + p2)) * Math.min(1, c / .5);
      const acc = K * a + wind - DAMP * w + u;
      w += acc * dt; a += w * dt;
      if (Math.abs(a) > .75 && warn <= 0) { warn = .3; sfx.tick(); }
      if (Math.abs(a) >= 1) {
        g.result = 'lose'; a = Math.sign(a) * 1; mvLose(); sfx.splat(); burst(400 + a * 120, 460, RED, 16); floatText('TIMBER!', 400, 250, RED, 50);
      }
    },
    draw(t) {
      bg('#FF5CB8', '#f046a8', t);
      // abyss + pillar
      ctx.fillStyle = INK; ctx.fillRect(-OX, 500, VW, 100); ctx.fillStyle = '#3a1c70'; ctx.fillRect(-OX, 508, VW, 92);
      ctx.fillStyle = TEAL; for (let i = -Math.ceil(OX / 100); i < (W + OX) / 100; i++) { const x = i * 100 + 10; ctx.beginPath(); ctx.moveTo(x, 600); ctx.lineTo(x + 30, 540); ctx.lineTo(x + 60, 600); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(); }
      box3(340, 470, 120, 130, TEAL, 5, 6); box(330, 462, 140, 20, '#7ff0e3', 5);
      shadow(400, 482, 70, 12, .3);
      const lost = g.result === 'lose';
      ctx.save();
      ctx.translate(400, 462 + (lost ? fall * fall * 700 : 0)); ctx.rotate(a * .55 + (lost ? fall * 4 * Math.sign(a) : 0));
      claude(0, 0, 8, { mood: mvMood(g) });
      // raised foot gag + flailing arms
      const fl = Math.sin(now * 12) * .3 * Math.min(1, Math.abs(a) * 2);
      box(46, -26 + fl * 20, 28, 12, OR, 3); box(-74, -26 - fl * 20, 28, 12, OR, 3);
      ctx.restore();
      if (!lost && Math.abs(a) > .6) { ctx.fillStyle = '#4DB8FF'; ctx.beginPath(); ctx.arc(400 + a * 100, 340 + (now * 70 % 20), 6, 0, 7); ctx.fill(); }
      // wind streaks
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 4 + Math.floor(OX / 150); i++) { const sw = VW + 100, x = ((now * 200 * (i % 2 ? 1 : -1) + i * 230) % sw + sw) % sw - OX - 50, y = 200 + (i % 4) * 55; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 46, y); ctx.stroke(); }
      ctx.lineCap = 'butt';
      // sway meter
      const mx = 150, mw = 500, my = 60;
      box3(mx, my, mw, 36, '#fff', 4, 5);
      ctx.fillStyle = RED; ctx.fillRect(mx, my, mw, 36);
      ctx.fillStyle = MINT; ctx.fillRect(mx + mw * (.5 - ZONE / 2), my, mw * ZONE, 36);
      ctx.fillStyle = INK; ctx.fillRect(mx + mw / 2 - 2, my, 4, 36);
      const px = mx + mw / 2 + clamp(a, -1, 1) * mw / 2;
      ctx.beginPath(); ctx.moveTo(px, my + 42); ctx.lineTo(px - 16, my + 74); ctx.lineTo(px + 16, my + 74); ctx.closePath();
      ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = YEL; ctx.fill();
      ctx.fillStyle = INK; ctx.fillRect(px - 4, my - 6, 8, 48);
      txt('◀', 100, my + 18, 36, YEL); txt('▶', 700, my + 18, 36, YEL);
      vignette(.22);
    }
  };
  return g;
}
reg('mv_balance', mvBalance, 'Stand!');

})();
