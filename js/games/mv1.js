'use strict';
/* MOVE IT! wave 1 — pose and rhythm microgames (WarioWare Move It! / Smooth Moves inspired).
   Poses are ArrowUp / ArrowDown / ArrowLeft / ArrowRight (or tap the on-screen pose buttons). */
(function () {

const MAG = '#FF3EA5', PUR = '#7B3FE4', TEAL = '#19C6B7', GOLD = '#FFE14D';
const mvMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const mvLose = (x = 400, y = 300) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, '#ff4d4d', 14); ring(x, y, '#ff4d4d', 80); };
const mvWin = (x = 400, y = 300) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 28); ring(x, y, '#fff', 110); shake(5, .2); };

/* ── Claude-shaped silhouettes in 5 poses: 0 up, 1 crouch, 2 left, 3 right, 4 neutral ── */
const KEYPOSE = { ArrowUp: 0, KeyW: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowRight: 3, KeyD: 3 };
const ARROW_DIR = [0, 2, 3, 1];           // pose index -> drawArrow dir (0 up, 1 right, 2 down, 3 left)
const LEGS = [[-5, -2, 1.2, 2], [-2.6, -2, 1.2, 2], [1.4, -2, 1.2, 2], [3.8, -2, 1.2, 2]];
const LEGC = [[-5.5, -2, 1.5, 2], [-2.8, -2, 1.5, 2], [1.3, -2, 1.5, 2], [4, -2, 1.5, 2]];
const BODY = [-6, -9, 12, 7];
const POSES = [
  { b: BODY, r: [[-8, -15, 2, 8], [6, -15, 2, 8]].concat(LEGS) },
  { b: [-7, -6, 14, 4], r: [[-9, -4.5, 2, 3], [7, -4.5, 2, 3]].concat(LEGC) },
  { b: BODY, r: [[-16, -7.5, 10, 2], [6, -6.5, 2, 2.4]].concat(LEGS) },
  { b: BODY, r: [[6, -7.5, 10, 2], [-8, -6.5, 2, 2.4]].concat(LEGS) },
  { b: BODY, r: [[-8, -6.5, 2, 2.4], [6, -6.5, 2, 2.4]].concat(LEGS) }
];
function mvFig(x, y, u, pi, fill, o = {}) {
  const P = POSES[pi], ol = o.ol != null ? o.ol : Math.max(3, u * .5), all = [P.b].concat(P.r);
  if (ol) { ctx.fillStyle = o.oc || INK; for (const s of all) ctx.fillRect(x + s[0] * u - ol, y + s[1] * u - ol, s[2] * u + ol * 2, s[3] * u + ol * 2); }
  ctx.fillStyle = fill; for (const s of all) ctx.fillRect(x + s[0] * u, y + s[1] * u, s[2] * u, s[3] * u);
  if (o.face) {
    const b = P.b, ey = y + (b[1] + b[3] * .42) * u, eh = Math.min(2.4, b[3] * .5) * u;
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = Math.max(2, u * .55); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const k of [-2.8, 2.8]) {
      const e = x + k * u;
      if (o.face === 'happy') { ctx.beginPath(); ctx.moveTo(e - u * .9, ey + u); ctx.lineTo(e, ey - u * .3); ctx.lineTo(e + u * .9, ey + u); ctx.stroke(); }
      else if (o.face === 'sad') { ctx.beginPath(); ctx.moveTo(e - u * .8, ey - u * .8); ctx.lineTo(e + u * .8, ey + u * .8); ctx.moveTo(e + u * .8, ey - u * .8); ctx.lineTo(e - u * .8, ey + u * .8); ctx.stroke(); }
      else ctx.fillRect(e - .6 * u, ey - eh / 2, 1.2 * u, eh);
    }
    ctx.lineCap = 'butt';
  }
}
/* on-screen pose buttons (keyboard arrows + touch) */
const BX = i => 400 + (i - 1.5) * 112, BY = 508;
function mvButtons(hl) {
  for (let i = 0; i < 4; i++) {
    const x = BX(i);
    box3(x - 48, BY, 96, 76, hl === i ? GOLD : '#fff', 4, 4);
    drawArrow(x, BY + 20, ARROW_DIR[i], 11, hl === i ? MAG : PUR);
    mvFig(x, BY + 70, 2.2, i, INK, { ol: 0 });
  }
}
function mvBtnHit(p) {
  if (p.y < BY - 8) return -1;
  const i = Math.round((p.x - 400) / 112 + 1.5);
  return i >= 0 && i < 4 && Math.abs(p.x - BX(i)) <= 56 ? i : -1;
}
const poseKey = e => KEYPOSE[e.code] != null ? KEYPOSE[e.code] : -1;

/* ── 1 POSE: match the hole in the wall before the conveyor carries you into it ── */
reg('mv_pose', sp => {
  const rs = Math.sqrt(sp), R = sp >= 1.6 ? 2 : 1, DUR = 4.5, PASS = .25;
  const RT = (DUR / rs - .3 - R * PASS) / R;
  const SX = -OX + 100;   // conveyor start: left screen edge
  let r = 0, c = 0, c2 = 0, cur = 4, tgt = (Math.random() * 4) | 0, phase = 0, wallT = 0, flash = 0, snap = 0, belt = 0;
  const press = pi => {
    if (g.result || phase || pi < 0) return;
    cur = pi; snap = .2; sfx.blip(pi * 2 + 3);
    const x = SX + (500 - SX) * Math.min(1, c / RT);
    ring(x, 400, '#fff', 60, .3); burst(x, 420, GOLD, 6, 160);
  };
  const g = {
    wide: true, cmd: 'POSE!', hint: 'ARROWS: MATCH THE HOLE', thint: 'TAP THE POSE THAT FITS', dur: DUR,
    key(e) { if (!e.repeat) press(poseKey(e)); },
    down(p) { press(mvBtnHit(p)); },
    update(dt) {
      wallT = Math.max(0, wallT - dt); flash = Math.max(0, flash - dt); snap = Math.max(0, snap - dt);
      if (g.result) return;
      belt += dt;
      if (phase === 0) {
        c += dt;
        if (c >= RT) {
          c = RT;
          if (cur === tgt) {
            phase = 1; c2 = 0; flash = .25; sfx.hit(); sfx.stamp(); shake(7, .22);
            burst(520, 300, GOLD, 16, 320); ring(520, 330, '#fff', 120); floatText('MATCH!', 400, 250, '#5CFF7A', 46);
          } else {
            g.result = 'lose'; mvLose(500, 380); sfx.boing();
            floatText('BONK!', 440, 250, '#ff4d4d', 50);
          }
        }
      } else {
        c2 += dt;
        if (c2 >= PASS) {
          r++;
          if (r >= R) { g.result = 'win'; mvWin(560, 360); }
          else {
            let n; do { n = (Math.random() * 4) | 0; } while (n === tgt);
            tgt = n; cur = 4; c = 0; phase = 0; wallT = .3; sfx.whoosh(true);
          }
        }
      }
    },
    draw(t) {
      bg(MAG, '#ff5cb6', t);
      const k = Math.min(1, c / RT);
      // wall (runs off the right screen edge)
      const WE = Math.max(820, W + OX + 10);
      ctx.fillStyle = INK; ctx.fillRect(520 - 6, 70 - 6, WE - 520 + 6, 392);
      ctx.fillStyle = PUR; ctx.fillRect(520, 70, WE - 520, 380);
      ctx.strokeStyle = 'rgba(20,16,28,.28)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let y = 70; y < 450; y += 40) { ctx.moveTo(520, y); ctx.lineTo(WE, y); for (let x = 520 + ((y / 40) & 1) * 30; x < WE; x += 60) { ctx.moveTo(x, y); ctx.lineTo(x, y + 40); } }
      ctx.stroke();
      const hu = 7 * (1 + wallT * 1.2);
      mvFig(660, 444, hu, tgt, '#1b0a38', { oc: (now * 6 | 0) % 2 ? GOLD : '#fff', ol: 5 });
      drawArrow(660, 118, ARROW_DIR[tgt], 20, GOLD);
      if (flash > 0) { ctx.globalAlpha = flash * 3; ctx.fillStyle = '#fff'; ctx.fillRect(520, 70, WE - 520, 380); ctx.globalAlpha = 1; }
      // belt
      ctx.fillStyle = INK; ctx.fillRect(-OX, 440, VW, 54); ctx.fillStyle = '#3b1d6e'; ctx.fillRect(-OX, 446, VW, 42);
      ctx.fillStyle = '#7B3FE4'; const off = (belt * 140) % 48;
      for (let x = -OX - 48 + off; x < W + OX; x += 48) { ctx.beginPath(); ctx.moveTo(x, 458); ctx.lineTo(x + 20, 467); ctx.lineTo(x, 476); ctx.lineTo(x + 8, 467); ctx.closePath(); ctx.fill(); }
      // claude
      const x = phase ? 500 + 160 * Math.min(1, c2 / PASS) : SX + (500 - SX) * k;
      const bob = g.result ? 0 : Math.abs(Math.sin(belt * 14)) * 3, sq = snap > 0 ? 1 + snap * .5 : 1;
      shadow(x, 446, 60, 10, .35);
      ctx.save(); ctx.translate(x, 444 - bob); ctx.scale(sq, 2 - sq); ctx.translate(-x, -444 + bob);
      mvFig(x, 444 - bob, 7, cur, OR, { face: mvMood(g) || 'idle' });
      ctx.restore();
      if (k > .75 && !phase && !g.result && cur !== tgt) txt('!', x, 300, 60, '#ff4d4d');
      // timer bar
      box3(20, 20, 220, 22, '#fff', 4, 4); ctx.fillStyle = k > .75 ? '#ff4d4d' : TEAL; ctx.fillRect(20, 20, 220 * k, 22);
      if (R > 1) txt((r + 1) + '/' + R, 280, 31, 26, '#fff');
      mvButtons(cur === 4 ? -1 : cur);
      vignette(.25);
    }
  };
  return g;
}, 'POSE!');

/* ── 2 COPY: watch the dancer, then repeat the 3-move sequence ── */
reg('mv_mirror', sp => {
  const rs = Math.sqrt(sp), B = .62 / rs, D0 = .45 / rs, seq = [];
  for (let i = 0; i < 3; i++) { let n; do { n = (Math.random() * 4) | 0; } while (i && n === seq[i - 1]); seq.push(n); }
  let c = 0, phase = 0, i = 0, tp = 4, pp = 4, pt = 0, lastStep = -1, bounce = 0;
  const press = pi => {
    if (g.result || phase !== 1 || pi < 0) return;
    pp = pi; pt = .5; bounce = .2;
    if (pi === seq[i]) {
      sfx.blip(i * 3 + 2); sfx.pop(); burst(600, 300, '#5CFF7A', 10); ring(600, 300, '#5CFF7A', 80, .35);
      i++; floatText('OK!', 600, 170, '#5CFF7A', 34);
      if (i >= 3) { g.result = 'win'; mvWin(600, 300); }
    } else { g.result = 'lose'; mvLose(600, 300); }
  };
  const g = {
    wide: true, cmd: 'COPY!', hint: 'ARROWS: REPEAT THE DANCE', thint: 'TAP THE POSES IN ORDER', dur: 6,
    key(e) { if (!e.repeat) press(poseKey(e)); },
    down(p) { press(mvBtnHit(p)); },
    update(dt) {
      c += dt; pt = Math.max(0, pt - dt); bounce = Math.max(0, bounce - dt);
      if (pt <= 0 && pp !== 4 && !g.result) pp = 4;
      if (g.result) return;
      if (phase === 0) {
        const s = Math.floor((c - D0) / B);
        if (s >= 3) { phase = 1; tp = 4; sfx.sparkle(); floatText('GO!', 400, 250, GOLD, 56); ring(600, 300, GOLD, 100); }
        else if (s >= 0) {
          if (s !== lastStep) { lastStep = s; sfx.blip(seq[s] * 2 + 3); sfx.hit(); burst(200, 290, GOLD, 8); ring(200, 300, '#fff', 70, .3); }
          tp = (c - D0) - s * B < B * .75 ? seq[s] : 4;
        }
      }
    },
    draw(t) {
      bg(TEAL, '#2bd6c7', t);
      // stage pads
      for (const sx of [200, 600]) { shadow(sx, 440, 130, 18, .3); box3(sx - 130, 404, 260, 28, sx < 400 ? '#B98CFF' : '#FFC9E6', 4, 5); }
      const bob = Math.abs(Math.sin(now * 8)) * (phase === 0 ? 4 : 2);
      mvFig(200, 404 - bob, 9, tp, '#B98CFF', { face: (g.result === 'win' ? 'happy' : 'idle') });
      mvFig(600, 404 - (bounce > 0 ? 12 * Math.sin(bounce / .2 * 3.14) : bob * .5), 9, pp, OR, { face: mvMood(g) || 'idle' });
      txt(phase === 0 ? 'WATCH' : 'COPY', 200, 235, 38, '#fff');
      if (phase === 1 && !g.result && (now * 4 | 0) % 2) txt('YOU!', 600, 235, 38, GOLD); else txt('YOU', 600, 235, 38, '#fff');
      if (phase === 0 && tp !== 4) drawArrow(200, 150, ARROW_DIR[tp], 34, GOLD);
      // sequence slots
      for (let s = 0; s < 3; s++) {
        const sx = 400 + (s - 1) * 90, done = phase === 1 ? s < i : s <= lastStep;
        box3(sx - 34, 72, 68, 68, done ? '#fff' : '#12806f', 4, 4);
        if (done) drawArrow(sx, 106, ARROW_DIR[seq[s]], 20, phase === 1 ? '#5CFF7A' : MAG); else txt('?', sx, 108, 40, '#fff');
      }
      mvButtons(pt > 0 ? pp : -1);
      vignette(.25);
    }
  };
  return g;
}, 'COPY!');

/* ── 3 BEAT: hit the target exactly as the shrinking ring lands ── */
reg('mv_beat', sp => {
  const rs = Math.sqrt(sp), B = .8 / rs, T = 1.15 / rs, H0 = 1.3 / rs, GOODW = .19 - .04 * (sp - 1), PERF = .07;
  const hs = [H0, H0 + B, H0 + 2 * B], ticks = [H0 - B, hs[0], hs[1], hs[2]], ticked = [0, 0, 0, 0];
  const res = [0, 0, 0];     // 0 pending, 1 good, 2 perfect
  let c = 0, j = 0, pulse = 0, hop = 0;
  const press = () => {
    if (g.result || j >= 3) return;
    const d = c - hs[j];
    if (d < -GOODW * 2.2) return;
    if (Math.abs(d) > GOODW) { miss(d < 0 ? 'EARLY!' : 'LATE!'); return; }
    const perfect = Math.abs(d) < PERF;
    res[j] = perfect ? 2 : 1; hop = .25;
    if (perfect) { sfx.coin(); sfx.hit(); burst(400, 300, GOLD, 18, 320); ring(400, 300, GOLD, 130); floatText('PERFECT!', 400, 190, GOLD, 44); }
    else { sfx.pop(); sfx.blip(5); burst(400, 300, TEAL, 10, 240); ring(400, 300, '#fff', 100); floatText('GOOD', 400, 190, '#7dfff0', 38); }
    j++;
    if (j >= 3) { g.result = 'win'; mvWin(400, 300); }
  };
  const miss = s => { g.result = 'lose'; res[j] = -1; mvLose(400, 300); floatText(s || 'MISS!', 400, 190, '#ff4d4d', 48); };
  const g = {
    wide: true, cmd: 'BEAT!', hint: 'SPACE / CLICK ON THE BEAT', thint: 'TAP WHEN THE RING LANDS', dur: 5,
    key(e) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || /^Arrow/.test(e.code))) press(); },
    down() { press(); },
    update(dt) {
      pulse = Math.max(0, pulse - dt); hop = Math.max(0, hop - dt);
      if (g.result) return;
      c += dt;
      for (let i = 0; i < 4; i++) if (!ticked[i] && c >= ticks[i]) { ticked[i] = 1; i ? sfx.tickHi() : sfx.tick(); pulse = .15; }
      if (j < 3 && c > hs[j] + GOODW) miss('MISS!');
    },
    draw(t) {
      bg(PUR, '#8a52ee', t);
      // floor
      ctx.fillStyle = INK; ctx.fillRect(-OX, 470, VW, 130); ctx.fillStyle = '#3b1d6e'; ctx.fillRect(-OX, 476, VW, 124);
      ctx.fillStyle = '#5a2fa8'; for (let x = -Math.ceil(OX / 80) * 80; x < W + OX; x += 80) ctx.fillRect(x, 560, 40, 8);
      // target
      const pu = pulse / .15, tr = 62 * (1 + pu * .12);
      shadow(400, 440, 100, 16, .3);
      circ(400, 300, tr, '#2b0f5e', 6); ctx.strokeStyle = GOLD; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(400, 300, tr - 8, 0, 7); ctx.stroke();
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(400, 300, 8, 0, 7); ctx.fill();
      // rings
      for (let i = j; i < 3; i++) {
        const k = (hs[i] - c) / T; if (k > 1) continue;
        const r = 62 + 190 * Math.max(-.2, k), near = Math.abs(hs[i] - c) < GOODW;
        ctx.lineCap = 'round';
        ctx.strokeStyle = INK; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(400, 300, r, 0, 7); ctx.stroke();
        ctx.strokeStyle = near ? GOLD : MAG; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(400, 300, r, 0, 7); ctx.stroke();
      }
      // metronome
      const sw = Math.sin((c - H0) / B * Math.PI) * .5;
      shadow(120, 556, 60, 10, .3);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(60, 552); ctx.lineTo(180, 552); ctx.lineTo(145, 410); ctx.lineTo(95, 410); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFC9E6'; ctx.beginPath(); ctx.moveTo(70, 546); ctx.lineTo(170, 546); ctx.lineTo(140, 418); ctx.lineTo(100, 418); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(120, 540); ctx.rotate(sw);
      ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -120); ctx.stroke();
      box(-13, -100, 26, 22, GOLD, 4); ctx.restore();
      // claude
      const jump = hop > 0 ? Math.sin(hop / .25 * Math.PI) * 30 : pulse > 0 ? 6 * pu : 0;
      shadow(400, 548, 50 - jump * .4, 9, .3);
      claude(400, 548 - jump, 7, { mood: mvMood(g) });
      // pips
      for (let i = 0; i < 3; i++) circ(340 + i * 60, 60, 20, res[i] === 2 ? GOLD : res[i] === 1 ? TEAL : res[i] < 0 ? '#ff4d4d' : '#2b0f5e', 5);
      vignette(.25);
    }
  };
  return g;
}, 'BEAT!');

/* ── 4 SWIM: alternate left/right strokes in rhythm to beat the rival bug ── */
reg('mv_swim', sp => {
  const rs = Math.sqrt(sp), TR = 4.2 / rs, X0 = -OX + 80, X1 = W + OX - 100, LY = [215, 395], ks = (X1 - X0) / 620, boost = (1 + .25 * (sp - 1)) * ks;   // ks: stroke power scales with pool length so time-to-finish stays the same
  let c = 0, px = X0, v = 0, last = -1, lastT = -1, arm = 0, stumble = 0, pad = [0, 0], combo = 0;
  const rivalX = () => X0 + (X1 - X0) * Math.min(1, c / TR + .025 * Math.sin(c * 6));
  const stroke = side => {
    if (g.result) return;
    pad[side] = .15;
    if (side === last) { v *= .75; stumble = .25; combo = 0; sfx.tick(); burst(px, LY[1], '#fff', 3, 100); return; }
    const gap = lastT < 0 ? .22 : c - lastT, bonus = Math.max(0, 1 - Math.abs(gap - .22) / .25);
    v += (75 + 55 * bonus) * boost; last = side; lastT = c; arm = 1;
    combo = bonus > .6 ? combo + 1 : 0;
    sfx.blip((side ? 4 : 0) + Math.round(bonus * 5)); noise(.07, .03, 2000, 4000, 'bandpass');
    burst(px + 30, LY[1] - 8, '#fff', 4, 160);
    if (combo === 4) { floatText('RHYTHM!', px, LY[1] - 80, GOLD, 30); sfx.sparkle(); }
  };
  const g = {
    wide: true, cmd: 'SWIM!', hint: 'ALTERNATE LEFT / RIGHT', thint: 'TAP LEFT, RIGHT, LEFT, RIGHT...', dur: 5,
    key(e) { if (e.repeat) return; if (e.code === 'ArrowLeft' || e.code === 'KeyA') stroke(0); else if (e.code === 'ArrowRight' || e.code === 'KeyD') stroke(1); },
    down(p) { stroke(p.x < W / 2 ? 0 : 1); },
    update(dt) {
      pad[0] = Math.max(0, pad[0] - dt); pad[1] = Math.max(0, pad[1] - dt); arm = Math.max(0, arm - dt * 5); stumble = Math.max(0, stumble - dt);
      if (g.result) return;
      c += dt; v *= Math.pow(.082, dt); px += v * dt;
      if (px >= X1) { px = X1; g.result = 'win'; mvWin(px, LY[1] - 20); floatText('FIRST!', 400, 120, GOLD, 56); }
      else if (rivalX() >= X1) { g.result = 'lose'; mvLose(px, LY[1]); floatText('TOO SLOW!', 400, 120, '#ff4d4d', 50); }
    },
    draw(t) {
      ctx.fillStyle = INK; ctx.fillRect(-OX, 0, VW, H);
      ctx.fillStyle = '#FFE29A'; ctx.fillRect(-OX, 0, VW, 78); ctx.fillStyle = INK; ctx.fillRect(-OX, 74, VW, 6);
      ctx.fillStyle = '#e8c97a'; for (let x = -Math.ceil(OX / 50) * 50; x < W + OX; x += 50) ctx.fillRect(x, 0, 4, 74);
      ctx.fillStyle = TEAL; ctx.fillRect(-OX, 80, VW, 430);
      ctx.fillStyle = '#4fe0d2'; const sc = (now * 40) % 60;
      for (let y = 100; y < 500; y += 26) for (let x = ((y / 26 & 1) * 30) - 60 - Math.ceil(OX / 60) * 60 + sc; x < W + OX; x += 60) ctx.fillRect(x, y, 22, 5);
      // start wall + finish
      box(-OX, 130, 30, 355, '#fff', 4);
      for (let i = 0; i < 18; i++) for (let k = 0; k < 2; k++) { ctx.fillStyle = (i + k) & 1 ? INK : '#fff'; ctx.fillRect(X1 + 22 + k * 14, 130 + i * 19.7, 14, 19.7); }
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(X1 + 22, 130, 28, 355);
      txt('FINISH', X1 + 36, 108, 24, GOLD);
      // lane ropes
      for (const ry of [130, 305, 485]) for (let x = 24 - Math.ceil(OX / 24) * 24; x < W + OX; x += 24) circ(x, ry, 7, (x / 24) & 1 ? MAG : '#fff', 3);
      // swimmers
      const rx = rivalX(), pyy = LY[1] + 10 + (stumble > 0 ? Math.sin(now * 60) * 3 : 0);
      drawBug(rx, LY[0] + 12, Math.PI / 2, .75, c);
      shadow(rx, LY[0] + 52, 40, 7, .15);
      claude(px, pyy + 22, 6, { mood: mvMood(g) });
      // arms
      const up = arm * 20;
      ctx.fillStyle = INK; ctx.fillRect(px + 18, pyy - 40 - up, 46, 18); ctx.fillStyle = OR; ctx.fillRect(px + 22, pyy - 36 - up, 38, 10);
      // water cover + surface waves
      ctx.fillStyle = 'rgba(25,198,183,.55)';
      ctx.fillRect(-OX, LY[0] + 6, VW, 56); ctx.fillRect(-OX, LY[1] + 4, VW, 58);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath();
      for (const wy of [LY[0] + 6, LY[1] + 4]) for (let x = -OX; x <= W + OX + 20; x += 20) { const yy = wy + Math.sin(x * .06 + now * 8) * 3; x > -OX ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      ctx.stroke();
      // wake
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.arc(px - 40 - i * 22, LY[1] + 6, 6 / i + 2, 0, 7); ctx.fill(); }
      // controls
      for (let s = 0; s < 2; s++) {
        const bw = 340 + OX, bx = s ? W / 2 + 20 : -OX + 40, on = pad[s] > 0;
        box3(bx, 520, bw, 66, on ? GOLD : (last === s ? '#d9c5ff' : '#fff'), 4, 4);
        drawArrow(bx + bw / 2, 553, s ? 1 : 3, 20, on ? MAG : PUR);
      }
      const prog = (px - X0) / (X1 - X0); txt('YOU', 40, 100, 18, OR, 'left');
      ctx.fillStyle = OR; ctx.fillRect(40, 60 - 0, 0, 0); box(250, 52, 300, 10, '#fff', 3); ctx.fillStyle = OR; ctx.fillRect(250, 52, 300 * prog, 10);
      vignette(.2);
    }
  };
  return g;
}, 'SWIM!');

})();
