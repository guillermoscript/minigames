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
/* wide googly eyes over the figure's face (panic / shock) */
function mvWide(x, y, u, pi, lx, ly) {
  const b = POSES[pi].b, ey = y + (b[1] + b[3] * .42) * u;
  mvEye(x - 2.8 * u, ey, u * 1.7, lx, ly); mvEye(x + 2.8 * u, ey, u * 1.7, lx, ly);
}
/* a sentient hot dog wearing the dancer's pose: sausage body, bun outline, googly eyes */
function mvDog(x, y, u, pi, lx, ly, bun) {
  mvFig(x, y, u, pi, '#E0402F', { oc: bun || '#F0B35A', ol: u * .7 });
  const b = POSES[pi].b; ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = Math.max(2, u * .4); ctx.beginPath();
  const my = y + (b[1] + b[3] * .85) * u; ctx.moveTo(x - 4 * u, my); ctx.bezierCurveTo(x - 2 * u, my - u, x + 2 * u, my + u, x + 4 * u, my); ctx.stroke();
  mvWide(x, y, u, pi, lx, ly);
}
const poseKey = e => KEYPOSE[e.code] != null ? KEYPOSE[e.code] : -1;

/* ── 1 POSE: feed the screaming cheese wall the shape of its hole before the hot-dog conveyor delivers you ── */
reg('mv_pose', sp => {
  const rs = Math.sqrt(sp), R = sp >= 1.6 ? 2 : 1, DUR = 4.5, PASS = .25;
  const RT = (DUR / rs - .3 - R * PASS) / R;
  const SX = -OX + 100;   // conveyor start: left screen edge
  const HOLES = [[560, 110, 14], [780, 95, 20], [540, 250, 11], [790, 300, 16], [590, 410, 12], [760, 420, 10]], BELT = [0, 3, 2, 5];
  let r = 0, c = 0, c2 = 0, cur = 4, tgt = (Math.random() * 4) | 0, phase = 0, wallT = 0, flash = 0, snap = 0, belt = 0, slam = 0, slamS = '', jaw = 0;
  const press = pi => {
    if (g.result || phase || pi < 0) return;
    cur = pi; snap = .2; sfx.blip(pi * 2 + 3); snd(500 + pi * 120, .09, 'sine', .06, 0, 900);
    const x = SX + (500 - SX) * Math.min(1, c / RT);
    ring(x, 400, '#fff', 60, .3); burst(x, 420, GOLD, 6, 160);
  };
  const g = {
    wide: true, cmd: 'FEED THE WALL!', hint: 'ARROWS: MATCH THE HOLE', thint: 'TAP THE POSE THAT FITS', dur: DUR,
    key(e) { if (!e.repeat) press(poseKey(e)); },
    down(p) { press(mvBtnHit(p)); },
    update(dt) {
      wallT = Math.max(0, wallT - dt); flash = Math.max(0, flash - dt); snap = Math.max(0, snap - dt); slam = Math.max(0, slam - dt * 1.5); jaw = Math.max(0, jaw - dt);
      if (g.result) return;
      belt += dt;
      if (phase === 0) {
        c += dt;
        if (c >= RT) {
          c = RT;
          if (cur === tgt) {
            phase = 1; c2 = 0; flash = .25; jaw = .3; slam = 1; slamS = 'NOM!'; sfx.hit(); sfx.stamp(); sfx.boing(); shake(7, .22);
            burst(520, 300, GOLD, 16, 320); ring(520, 330, '#fff', 120); floatText('MATCH!', 400, 250, '#5CFF7A', 46);
          } else {
            g.result = 'lose'; slam = 1; slamS = 'WHAT?!'; mvLose(500, 380); sfx.boing(); sfx.splat(); snd(900, .3, 'sawtooth', .05, 0, 120);
            floatText('BONK!', 440, 250, '#ff4d4d', 50);
          }
        }
      } else {
        c2 += dt;
        if (c2 >= PASS) {
          r++;
          if (r >= R) { g.result = 'win'; mvWin(560, 360); confetti(660, 300, 24); }
          else {
            let n; do { n = (Math.random() * 4) | 0; } while (n === tgt);
            tgt = n; cur = 4; c = 0; phase = 0; wallT = .3; sfx.whoosh(true); snd(300, .25, 'sine', .06, 0, 600);
          }
        }
      }
    },
    draw(t) {
      const k = Math.min(1, c / RT), danger = k > .75 && !phase && !g.result;
      mvWarp(danger ? 1.6 : .6, t);
      mvPsy(MAG, '#ff5cb6', t, .8);
      mvBall(230, 120 + Math.sin(t * 2) * 8, 40, t);
      // wall (runs off the right screen edge): a screaming cheese wall with a mouth-shaped hole
      const WE = Math.max(820, W + OX + 10), sx = danger ? Math.sin(t * 60) * 3 : 0;
      ctx.save(); ctx.translate(sx, 0);
      ctx.fillStyle = INK; ctx.fillRect(520 - 6, 70 - 6, WE - 520 + 6, 392);
      ctx.fillStyle = '#FFC93C'; ctx.fillRect(520, 70, WE - 520, 380);
      ctx.fillStyle = '#E09A10'; for (const h of HOLES) { ctx.beginPath(); ctx.arc(h[0], h[1], h[2], 0, 7); ctx.fill(); }
      // the mouth
      const mry = 100 * (1 + jaw * .6 + (danger ? .15 : 0));
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(660, 350, 108, mry + 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#7a0a38'; ctx.beginPath(); ctx.ellipse(660, 350, 102, mry, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff6fa5'; ctx.beginPath(); ctx.ellipse(660 + Math.sin(t * 5) * 6, 350 + mry * .8, 70, 22, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) { const tx = 580 + i * 26.7, ty = 350 - mry * Math.sqrt(Math.max(0, 1 - Math.pow((tx - 660) / 102, 2))); ctx.beginPath(); ctx.moveTo(tx - 11, ty - 2); ctx.lineTo(tx, ty + 24); ctx.lineTo(tx + 11, ty - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      // eyes track the conveyor
      const cx0 = phase ? 500 : SX + (500 - SX) * k, lk = (cx0 - 660) / 300, er = 26 * (1 + (danger ? .35 : 0) + jaw);
      mvEye(600, 165, er, lk, .5); mvEye(720, 165, er, lk, .5);
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(570, 125 - (danger ? 10 : 0)); ctx.lineTo(626, 138); ctx.moveTo(750, 125 - (danger ? 10 : 0)); ctx.lineTo(694, 138); ctx.stroke();
      const hu = 7 * (1 + wallT * 1.2);
      mvFig(660, 444, hu, tgt, '#1b0a38', { oc: (now * 6 | 0) % 2 ? GOLD : '#fff', ol: 5 });
      drawArrow(660, 52, ARROW_DIR[tgt], 20, GOLD);
      if (flash > 0) { ctx.globalAlpha = flash * 3; ctx.fillStyle = '#fff'; ctx.fillRect(520, 70, WE - 520, 380); ctx.globalAlpha = 1; }
      ctx.restore();
      // belt
      ctx.fillStyle = INK; ctx.fillRect(-OX, 440, VW, 54); ctx.fillStyle = '#6b2a14'; ctx.fillRect(-OX, 446, VW, 42);
      ctx.fillStyle = '#d9822b'; const off = (belt * 140) % 48;
      for (let x = -OX - 48 + off; x < W + OX; x += 48) { ctx.beginPath(); ctx.moveTo(x, 458); ctx.lineTo(x + 20, 467); ctx.lineTo(x, 476); ctx.lineTo(x + 8, 467); ctx.closePath(); ctx.fill(); }
      // hot dogs riding the factory belt
      const sp2 = VW + 100;
      for (let i = 0; i < 4; i++) mvFoodie(-OX - 50 + ((i * sp2 / 4 + belt * 140) % sp2), 446, .42, BELT[i], t, .7, { lx: 1, ly: 0 });
      // claude
      const x = phase ? 500 + 160 * Math.min(1, c2 / PASS) : SX + (500 - SX) * k;
      const bob = g.result ? 0 : Math.abs(Math.sin(belt * 14)) * 3, sq = snap > 0 ? 1 + snap * .5 : 1;
      shadow(x, 446, 60, 10, .35);
      ctx.save(); ctx.translate(x, 444 - bob); ctx.scale(sq, 2 - sq); ctx.translate(-x, -444 + bob);
      mvFig(x, 444 - bob, 7, cur, OR, { face: mvMood(g) || 'idle' });
      if (danger || g.result === 'lose') mvWide(x, 444 - bob, 7, cur, (660 - x) / 300, 0);
      ctx.restore();
      if (danger && cur !== tgt) txt('!', x, 300, 60, '#ff4d4d');
      ctx.restore();   // mvWarp
      // timer bar
      box3(20, 20, 220, 22, '#fff', 4, 4); ctx.fillStyle = k > .75 ? '#ff4d4d' : TEAL; ctx.fillRect(20, 20, 220 * k, 22);
      if (R > 1) txt((r + 1) + '/' + R, 280, 31, 26, '#fff');
      mvButtons(cur === 4 ? -1 : cur);
      mvSlam(slamS, slam, slamS === 'NOM!' ? '#5CFF7A' : '#FFE14D', 250, 100);
      vignette(.25);
    }
  };
  return g;
}, 'POSE!');

/* ── 2 COPY: a dancing hot dog does 3 moves in front of a snack audience; repeat them ── */
reg('mv_mirror', sp => {
  const rs = Math.sqrt(sp), B = .62 / rs, D0 = .45 / rs, seq = [];
  for (let i = 0; i < 3; i++) { let n; do { n = (Math.random() * 4) | 0; } while (i && n === seq[i - 1]); seq.push(n); }
  let c = 0, phase = 0, i = 0, tp = 4, pp = 4, pt = 0, lastStep = -1, bounce = 0, slam = 0, slamS = '', failAt = -1, cheer = 0;
  const press = pi => {
    if (g.result || phase !== 1 || pi < 0) return;
    pp = pi; pt = .5; bounce = .2;
    if (pi === seq[i]) {
      sfx.blip(i * 3 + 2); sfx.pop(); burst(600, 300, '#5CFF7A', 10); ring(600, 300, '#5CFF7A', 80, .35); cheer = .5;
      i++; floatText('OK!', 600, 170, '#5CFF7A', 34);
      if (i >= 3) { g.result = 'win'; mvWin(600, 300); slam = 1; slamS = 'NOM!'; confetti(200, 300, 24); }
    } else { g.result = 'lose'; failAt = c; slam = 1; slamS = 'WHAT?!'; mvLose(600, 300); sfx.boing(); sfx.splat(); }
  };
  const g = {
    wide: true, cmd: 'COPY THE DOG!', hint: 'ARROWS: REPEAT THE DANCE', thint: 'TAP THE POSES IN ORDER', dur: 6,
    key(e) { if (!e.repeat) press(poseKey(e)); },
    down(p) { press(mvBtnHit(p)); },
    update(dt) {
      c += dt; pt = Math.max(0, pt - dt); bounce = Math.max(0, bounce - dt); slam = Math.max(0, slam - dt * 1.5); cheer = Math.max(0, cheer - dt);
      if (pt <= 0 && pp !== 4 && !g.result) pp = 4;
      if (g.result) return;
      if (phase === 0) {
        const s = Math.floor((c - D0) / B);
        if (s >= 3) { phase = 1; tp = 4; sfx.sparkle(); floatText('GO!', 400, 250, GOLD, 56); ring(600, 300, GOLD, 100); }
        else if (s >= 0) {
          if (s !== lastStep) { lastStep = s; sfx.blip(seq[s] * 2 + 3); sfx.hit(); snd(700 + seq[s] * 90, .1, 'sine', .06, 0, 1300); burst(200, 290, GOLD, 8); ring(200, 300, '#fff', 70, .3); cheer = .3; }
          tp = (c - D0) - s * B < B * .75 ? seq[s] : 4;
        }
      }
    },
    draw(t) {
      const lost = g.result === 'lose';
      mvWarp(.7 + (cheer > 0 ? .6 : 0), t);
      mvPsy(TEAL, '#2bd6c7', t, .9);
      mvAudience(402, t, lost ? 0 : cheer > 0 ? 2.4 : .9, .62, lost ? 0 : Math.sin(t * 2), .3);
      mvTiles(436, t, 60 / B);
      // stage pads
      for (const sx of [200, 600]) { shadow(sx, 440, 130, 18, .3); box3(sx - 130, 404, 260, 28, sx < 400 ? '#B98CFF' : '#FFC9E6', 4, 5); }
      const bob = Math.abs(Math.sin(t * 8)) * (phase === 0 ? 4 : 2), fl = lost ? Math.min(1.5, (c - failAt) * 6) : 0;
      // the hot dog dancer (falls over when you blow it)
      ctx.save(); ctx.translate(200, 404); ctx.rotate(-fl); ctx.translate(-200, -404);
      mvDog(200, 404 - bob, 9, tp, lost ? 0 : .6, lost ? -1 : .3);
      ctx.restore();
      mvFig(600, 404 - (bounce > 0 ? 12 * Math.sin(bounce / .2 * 3.14) : bob * .5), 9, pp, OR, { face: mvMood(g) || 'idle' });
      if (lost) mvWide(600, 404, 9, pp, -1, 0);
      txt(phase === 0 ? 'WATCH' : 'COPY', 200, 235, 38, '#fff');
      if (phase === 1 && !g.result && (now * 4 | 0) % 2) txt('YOU!', 600, 235, 38, GOLD); else txt('YOU', 600, 235, 38, '#fff');
      if (phase === 0 && tp !== 4) drawArrow(200, 150, ARROW_DIR[tp], 34, GOLD);
      ctx.restore();   // mvWarp
      // sequence slots
      for (let s = 0; s < 3; s++) {
        const sx = 400 + (s - 1) * 90, done = phase === 1 ? s < i : s <= lastStep;
        box3(sx - 34, 72, 68, 68, done ? '#fff' : '#12806f', 4, 4);
        if (done) drawArrow(sx, 106, ARROW_DIR[seq[s]], 20, phase === 1 ? '#5CFF7A' : MAG); else txt('?', sx, 108, 40, '#fff');
      }
      mvButtons(pt > 0 ? pp : -1);
      mvSlam(slamS, slam, slamS === 'NOM!' ? '#5CFF7A' : '#FFE14D', 260, 100);
      vignette(.25);
    }
  };
  return g;
}, 'COPY!');

/* ── 3 BEAT: the judgmental disco ball swings the tempo; land the ring on the giant eyeball and the snacks explode with joy ── */
reg('mv_beat', sp => {
  const rs = Math.sqrt(sp), B = .8 / rs, T = 1.15 / rs, H0 = 1.3 / rs, GOODW = .19 - .04 * (sp - 1), PERF = .07;
  const hs = [H0, H0 + B, H0 + 2 * B], ticks = [H0 - B, hs[0], hs[1], hs[2]], ticked = [0, 0, 0, 0];
  const res = [0, 0, 0];     // 0 pending, 1 good, 2 perfect
  let c = 0, j = 0, pulse = 0, hop = 0, joy = 0, gasp = 0, slam = 0, slamS = '';
  const press = () => {
    if (g.result || j >= 3) return;
    const d = c - hs[j];
    if (d < -GOODW * 2.2) return;
    if (Math.abs(d) > GOODW) { miss(d < 0 ? 'EARLY!' : 'LATE!'); return; }
    const perfect = Math.abs(d) < PERF;
    res[j] = perfect ? 2 : 1; hop = .25;
    if (perfect) {
      sfx.coin(); sfx.hit(); sfx.boing(); burst(400, 300, GOLD, 18, 320); ring(400, 300, GOLD, 130); floatText('PERFECT!', 400, 190, GOLD, 44);
      joy = .6; confetti(120 + Math.random() * 560, 400, 12); burst(120 + Math.random() * 560, 420, MVC[j], 10, 300);
    } else { sfx.pop(); sfx.blip(5); burst(400, 300, TEAL, 10, 240); ring(400, 300, '#fff', 100); floatText('GOOD', 400, 190, '#7dfff0', 38); joy = .3; }
    j++;
    if (j >= 3) { g.result = 'win'; mvWin(400, 300); confetti(200, 380, 20); confetti(600, 380, 20); joy = 1; }
  };
  const miss = s => { g.result = 'lose'; res[j] = -1; gasp = 1; slam = 1; slamS = 'WHAT?!'; mvLose(400, 300); sfx.splat(); snd(800, .35, 'sawtooth', .05, 0, 90); floatText(s || 'MISS!', 400, 190, '#ff4d4d', 48); };
  const g = {
    wide: true, cmd: 'OBEY THE BALL!', hint: 'SPACE / CLICK ON THE BEAT', thint: 'TAP WHEN THE RING LANDS', dur: 5,
    key(e) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || /^Arrow/.test(e.code))) press(); },
    down() { press(); },
    update(dt) {
      pulse = Math.max(0, pulse - dt); hop = Math.max(0, hop - dt); joy = Math.max(0, joy - dt); slam = Math.max(0, slam - dt * 1.5);
      if (g.result) return;
      c += dt;
      for (let i = 0; i < 4; i++) if (!ticked[i] && c >= ticks[i]) { ticked[i] = 1; i ? sfx.tickHi() : sfx.tick(); pulse = .15; }
      if (j < 3 && c > hs[j] + GOODW) miss('MISS!');
    },
    draw(t) {
      mvWarp(.5 + joy * 1.5 + gasp, t);
      mvPsy(PUR, '#8a52ee', t, 1);
      mvTiles(470, t, 60 / B);
      // the snack audience: stops dead when you blow it, goes feral when you nail it
      mvAudience(468, t, gasp ? 0 : .7 + joy * 4, .85 + joy * .25, 0, -.2);
      // target: a giant judging eyeball
      const pu = pulse / .15, tr = 62 * (1 + pu * .12);
      shadow(400, 440, 100, 16, .3);
      circ(400, 300, tr, '#fff', 6);
      const lk = Math.sin(t * 1.5) * .8;
      ctx.fillStyle = MAG; ctx.beginPath(); ctx.arc(400 + lk * 12, 300, tr * .6, 0, 7); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(400 + lk * 12, 300, tr * .32, 0, 7); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(400, 300, tr - 8, 0, 7); ctx.stroke();
      // rings
      for (let i = j; i < 3; i++) {
        const k = (hs[i] - c) / T; if (k > 1) continue;
        const r = 62 + 190 * Math.max(-.2, k), near = Math.abs(hs[i] - c) < GOODW;
        ctx.lineCap = 'round';
        ctx.strokeStyle = INK; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(400, 300, r, 0, 7); ctx.stroke();
        ctx.strokeStyle = near ? GOLD : MAG; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(400, 300, r, 0, 7); ctx.stroke();
      }
      // metronome = the judgmental disco ball, swinging on the beat
      const sw = Math.sin((c - H0) / B * Math.PI) * .5;
      mvBall(130 + sw * 260, 150 + Math.abs(sw) * -30 + (gasp ? 40 : 0), 46, t);
      // claude
      const jump = hop > 0 ? Math.sin(hop / .25 * Math.PI) * 30 : pulse > 0 ? 6 * pu : 0;
      shadow(400, 548, 50 - jump * .4, 9, .3);
      claude(400, 548 - jump, 7, { mood: mvMood(g) });
      ctx.restore();   // mvWarp
      // pips
      for (let i = 0; i < 3; i++) circ(340 + i * 60, 60, 20, res[i] === 2 ? GOLD : res[i] === 1 ? TEAL : res[i] < 0 ? '#ff4d4d' : '#2b0f5e', 5);
      mvSlam(slamS, slam, '#FFE14D', 220, 100);
      vignette(.25);
    }
  };
  return g;
}, 'BEAT!');

/* ── 4 SWIM: alternate left/right strokes through a pool of soup to beat the rival rubber duck ── */
reg('mv_swim', sp => {
  const rs = Math.sqrt(sp), TR = 4.2 / rs, X0 = -OX + 80, X1 = W + OX - 100, LY = [215, 395], ks = (X1 - X0) / 620, boost = (1 + .25 * (sp - 1)) * ks;   // ks: stroke power scales with pool length so time-to-finish stays the same
  let c = 0, px = X0, v = 0, last = -1, lastT = -1, arm = 0, stumble = 0, pad = [0, 0], combo = 0, slam = 0, slamS = '', quack = 0, nextQ = 1.2, boom = 0;
  const rivalX = () => X0 + (X1 - X0) * Math.min(1, c / TR + .025 * Math.sin(c * 6));
  const stroke = side => {
    if (g.result) return;
    pad[side] = .15;
    if (side === last) { v *= .75; stumble = .25; combo = 0; sfx.tick(); burst(px, LY[1], '#fff', 3, 100); return; }
    const gap = lastT < 0 ? .22 : c - lastT, bonus = Math.max(0, 1 - Math.abs(gap - .22) / .25);
    v += (75 + 55 * bonus) * boost; last = side; lastT = c; arm = 1;
    combo = bonus > .6 ? combo + 1 : 0;
    sfx.blip((side ? 4 : 0) + Math.round(bonus * 5)); noise(.07, .03, 2000, 4000, 'bandpass');
    burst(px + 30, LY[1] - 8, '#FFC24D', 4, 160);
    if (combo === 4) { floatText('RHYTHM!', px, LY[1] - 80, GOLD, 30); sfx.sparkle(); }
  };
  const g = {
    wide: true, cmd: 'SOUP SWIM!', hint: 'ALTERNATE LEFT / RIGHT', thint: 'TAP LEFT, RIGHT, LEFT, RIGHT...', dur: 5,
    key(e) { if (e.repeat) return; if (e.code === 'ArrowLeft' || e.code === 'KeyA') stroke(0); else if (e.code === 'ArrowRight' || e.code === 'KeyD') stroke(1); },
    down(p) { stroke(p.x < W / 2 ? 0 : 1); },
    update(dt) {
      pad[0] = Math.max(0, pad[0] - dt); pad[1] = Math.max(0, pad[1] - dt); arm = Math.max(0, arm - dt * 5); stumble = Math.max(0, stumble - dt);
      slam = Math.max(0, slam - dt * 1.5); quack = Math.max(0, quack - dt); boom = Math.max(0, boom - dt);
      if (g.result) return;
      c += dt; v *= Math.pow(.082, dt); px += v * dt;
      if (c >= nextQ) { nextQ = c + 1.1; quack = .25; snd(620, .09, 'square', .04, 0, 900); snd(900, .07, 'square', .03, .08, 600); }
      if (px >= X1) { px = X1; g.result = 'win'; slam = 1; slamS = 'GLORP!'; boom = .5; mvWin(px, LY[1] - 20); floatText('FIRST!', 400, 120, GOLD, 56); confetti(rivalX(), LY[0], 30); sfx.splat(); }
      else if (rivalX() >= X1) { g.result = 'lose'; slam = 1; slamS = 'QUACK!'; mvLose(px, LY[1]); floatText('TOO SLOW!', 400, 120, '#ff4d4d', 50); snd(500, .3, 'square', .06, 0, 120); }
    },
    draw(t) {
      mvWarp(.5 + (g.result ? 1 : 0), t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, 0, VW, H);
      ctx.fillStyle = '#FFE29A'; ctx.fillRect(-OX, 0, VW, 78); ctx.fillStyle = INK; ctx.fillRect(-OX, 74, VW, 6);
      mvAudience(76, t, g.result ? 2.2 : 1, .55, 0, .5);
      ctx.fillStyle = '#E86A2A'; ctx.fillRect(-OX, 80, VW, 430);
      ctx.fillStyle = '#F58A45'; const sc = (t * 40) % 60;
      for (let y = 100; y < 500; y += 26) for (let x = ((y / 26 & 1) * 30) - 60 - Math.ceil(OX / 60) * 60 + sc; x < W + OX; x += 60) ctx.fillRect(x, y, 22, 5);
      // floating soup eyeballs and peas, all watching
      for (let i = 0; i < 4; i++) { const ex = ((i * 260 + 90 - t * 15) % (VW + 100)) - OX, ey = 150 + (i % 2) * 170 + Math.sin(t * 2 + i) * 6; if (ex > -OX + 40 && ex < X1 - 20) mvEye(ex, ey, 13, (px - ex) / 300, (LY[1] - ey) / 300); }
      ctx.fillStyle = '#7ad14f'; for (let i = 0; i < 6; i++) { const ex = ((i * 170 + 40 + t * 22) % (VW + 60)) - OX, ey = 130 + (i * 53) % 340 + Math.sin(t * 3 + i) * 4; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, 7); ctx.fill(); }
      // start wall + finish
      box(-OX, 130, 30, 355, '#fff', 4);
      for (let i = 0; i < 18; i++) for (let k = 0; k < 2; k++) { ctx.fillStyle = (i + k) & 1 ? INK : '#fff'; ctx.fillRect(X1 + 22 + k * 14, 130 + i * 19.7, 14, 19.7); }
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(X1 + 22, 130, 28, 355);
      txt('FINISH', X1 + 36, 108, 24, GOLD);
      // lane ropes
      for (const ry of [130, 305, 485]) for (let x = 24 - Math.ceil(OX / 24) * 24; x < W + OX; x += 24) circ(x, ry, 7, (x / 24) & 1 ? MAG : '#fff', 3);
      // swimmers: the rival is a rubber duck
      const rx = rivalX(), pyy = LY[1] + 10 + (stumble > 0 ? Math.sin(t * 60) * 3 : 0), dy = LY[0] + 14 + Math.sin(t * 9) * 3;
      if (boom <= 0 || !g.result) {
        shadow(rx, LY[0] + 52, 40, 7, .15);
        circ(rx, dy + 8, 30, '#FFE14D', 4); circ(rx + 26, dy - 14, 19, '#FFE14D', 4);
        ctx.fillStyle = INK; ctx.fillRect(rx + 40, dy - 16, 24 + quack * 30, 12); ctx.fillStyle = '#FF8A3D'; ctx.fillRect(rx + 42, dy - 14, 20 + quack * 30, 8);
        mvEye(rx + 26, dy - 20, 9, 1, .3);
        ctx.fillStyle = '#F2C300'; ctx.beginPath(); ctx.ellipse(rx - 8, dy + 8, 14, 9, -.4, 0, 7); ctx.fill();
      }
      claude(px, pyy + 22, 6, { mood: mvMood(g) });
      // arms
      const up = arm * 20;
      ctx.fillStyle = INK; ctx.fillRect(px + 18, pyy - 40 - up, 46, 18); ctx.fillStyle = OR; ctx.fillRect(px + 22, pyy - 36 - up, 38, 10);
      // soup cover + surface waves
      ctx.fillStyle = 'rgba(232,106,42,.6)';
      ctx.fillRect(-OX, LY[0] + 6, VW, 56); ctx.fillRect(-OX, LY[1] + 4, VW, 58);
      ctx.strokeStyle = '#FFE29A'; ctx.lineWidth = 3; ctx.beginPath();
      for (const wy of [LY[0] + 6, LY[1] + 4]) for (let x = -OX; x <= W + OX + 20; x += 20) { const yy = wy + Math.sin(x * .06 + t * 8) * 3; x > -OX ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      ctx.stroke();
      // wake of bubbles
      ctx.fillStyle = 'rgba(255,226,154,.7)';
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.arc(px - 40 - i * 22, LY[1] + 6 - Math.sin(t * 10 + i) * 4, 6 / i + 2, 0, 7); ctx.fill(); }
      ctx.restore();   // mvWarp
      // controls
      for (let s = 0; s < 2; s++) {
        const bw = 340 + OX, bx = s ? W / 2 + 20 : -OX + 40, on = pad[s] > 0;
        box3(bx, 520, bw, 66, on ? GOLD : (last === s ? '#d9c5ff' : '#fff'), 4, 4);
        drawArrow(bx + bw / 2, 553, s ? 1 : 3, 20, on ? MAG : PUR);
      }
      const prog = (px - X0) / (X1 - X0); txt('YOU', 40, 100, 18, OR, 'left');
      box(250, 52, 300, 10, '#fff', 3); ctx.fillStyle = OR; ctx.fillRect(250, 52, 300 * prog, 10);
      mvSlam(slamS, slam, slamS === 'QUACK!' ? '#FF8A3D' : '#5CFF7A', 300, 100);
      vignette(.2);
    }
  };
  return g;
}, 'SWIM!');

})();
