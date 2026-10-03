'use strict';
/* DUO microgames (scope 'du'): two players inside ONE microgame, each with a different role, one shared verdict (see js/party.js duoCtx).
   fn(sp, D): D = { role: 0|1, partner, send(type, data, latest), onMsg(fn(type, data)) }. Both clients build the same level from the room seed
   (all randomness is drawn in the constructor from `R`, the same number of draws whatever the role), then each role owns its own variables and
   publishes them; the partner renders them ~150 ms behind (track()). Nothing ever blocks local input.
   One role is the JUDGE: it decides win/lose and tells the partner with an 'end' message (the server accepts a team win if either player reports one).
   The judge finishes `END_SLACK` seconds before the shared time limit so its verdict arrives before the partner's own timer runs out.
   Each game: {cmd, hint, thint, roleLabel, dur, update(dt), draw(t), down/move/up/key/keyup}; g.result = 'win'|'lose' */
(function () {

const PUR = '#7C4DFF', PUR2 = '#6a3de8', YEL = '#FFE14D', GRN = '#5CFF7A', RED = '#ff4d4d', BLU = '#4DB8FF', PNK = '#FF4D9E', ORG = '#FF9A4D', LIL = '#B49CFF';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mkR = () => mulberry32(Math.floor(Math.random() * 4294967296));   // Math.random is seeded while the constructor runs
const END_SLACK = .6, LAG = .15;
const SOLO = { role: 0, roles: 2, partner: null, send() {}, onMsg() {} };   // only used if a DUO game is ever built without a partner
const duBg = t => { bg(PUR, PUR2, t); ctx.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 6; i++) ctx.fillRect(-OX, 60 + i * 100, VW, 40); };
const duWin = (x, y) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 30); ring(x, y, '#fff', 110); };
const duLose = (x, y) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, RED, 14); ring(x, y, RED, 80); };
const duMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
function duBar(k, label) {                 // progress bar toward the goal
  const x = 200, y = 74, w = 400; k = clamp(k, 0, 1);
  box(x, y, w, 22, '#3a3550', 3); ctx.fillStyle = k >= 1 ? GRN : YEL; ctx.fillRect(x, y, w * k, 22);
  star(x + w, y + 11, 20, 9, 5, now * 2, k >= 1 ? GRN : '#4a4558', 3);
  if (label) txt(label, 400, 126, 40, '#fff');
}
/* a number that arrives in snapshots; at() reads it LAG seconds in the past, interpolated (remote entities never jump) */
function track() {
  const a = [];
  return {
    push(v) { a.push({ t: now, v }); if (a.length > 40) a.shift(); },
    at(lag) {
      if (!a.length) return null; const T = now - (lag === undefined ? LAG : lag);
      if (T <= a[0].t) return a[0].v;
      for (let i = 1; i < a.length; i++) if (a[i].t >= T) { const p = a[i - 1], q = a[i]; return p.v + (q.v - p.v) * (T - p.t) / Math.max(1e-6, q.t - p.t); }
      return a[a.length - 1].v;
    },
  };
}
/* shared wiring: partner messages go to g.msg(), 'end' from the judge is the verdict for the other role */
const DUINFO = {   // role 0, role 1: [label, what you do, how you control it]: shown on the intro card so both players know who is who
  du_catch: [['CATCHER', 'MOVE THE BASKET', 'MOVE LEFT / RIGHT'], ['THROWER', 'DROP THE COINS', 'TAP / CLICK / SPACE']],
  du_decode: [['READER', 'POINT AT THE SYMBOLS', 'TAP THE SYMBOL'], ['TYPIST', 'COPY THE FLASHES', 'TAP WHAT FLASHES']],
  du_crank: [['LEVER', 'HOLD THE GATE OPEN', 'HOLD DOWN'], ['CRANKER', 'SPIN THE WHEEL', 'DRAG IN CIRCLES']],
  du_steer: [['STEERER', 'DODGE THE ROCKS', 'MOVE LEFT / RIGHT'], ['BOOSTER', 'TAP TO GO FAST', 'TAP FAST']],
  du_seesaw: [['LEFT SIDE', 'RAISE THE LEFT END', 'HOLD DOWN'], ['RIGHT SIDE', 'RAISE THE RIGHT END', 'HOLD DOWN']],
  du_beat: [['LEFT LANE', 'PLAY THE LEFT NOTES', 'TAP ON THE LINE'], ['RIGHT LANE', 'PLAY THE RIGHT NOTES', 'TAP ON THE LINE']],
  du_guide: [['WALKER', 'WALK IN THE DARK', 'TAP THE ARROWS'], ['GUIDE', 'SHOW WHERE TO STEP', 'TAP THE ARROWS']],
  du_gun: [['GUNNER', 'AIM AND SHOOT', 'MOVE + CLICK / TAP'], ['LOADER', 'PICK THE AMMO COLOUR', 'TAP RED OR BLUE']],
};
/* animated 2D demos for the intro card: each draws role r of a game at time t in a 520x240 frame (origin top-left of the frame) */
const demoFinger = (x, y, down, k) => { if (down) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.globalAlpha = 1 - (k || 0); ctx.beginPath(); ctx.arc(x, y, 18 + (k || 0) * 26, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; } circ(x, y + (down ? 3 : 0), 15, '#fff', 4); };
const demoCoin = (x, y) => token(x, y, 16);
const DEMOS = {
  du_catch: [
    t => { const bx = 260 + 150 * Math.sin(t * 2.2), k = (t % 1.2) / 1.2; demoCoin(bx, 30 + k * 150); box(bx - 50, 168, 100, 34, ORG, 4); txt('◄', 40, 120, 56, '#fff'); txt('►', 480, 120, 56, '#fff'); demoFinger(bx, 216, true, 0); },
    t => { const T0 = Math.floor(t / 1.2) * 1.2, k = (t % 1.2) / 1.2, hx = u => 260 + 170 * Math.sin(u * 2.2), x0 = hx(T0), hxNow = hx(t); box(hxNow - 26, 14, 52, 26, '#d9d4ee', 3); box(x0 - 50, 190, 100, 34, ORG, 4);
      if (k > .15) demoCoin(x0, 44 + (k - .15) / .85 * 140); demoFinger(hxNow + 60, 60, k < .25, k * 4); txt('TAP!', 90, 150, 50, 'rgba(255,255,255,.7)'); },
  ],
  du_decode: [
    t => { const seq = [2, 0, 3], i = Math.floor(t / .9) % 3, ph = (t % .9) / .9; seq.forEach((v, j) => { const x = 160 + j * 100; box(x - 32, 8, 64, 64, j === i ? YEL : '#fff', 4); txt(String(v + 1), x, 48, 44, INK); });
      seq.forEach((v, j) => { const x = 160 + j * 100; circ(x, 160, 40, SYMC[v], 4); drawSym(v, x, 160, 20); txt(String(v + 1), x + 34, 118, 22, YEL); }); demoFinger(160 + i * 100, 168, ph > .3 && ph < .7, (ph - .3) / .4); },
    t => { const seq = [2, 0, 3], i = Math.floor(t / .9) % 3, ph = (t % .9) / .9; txt('WAIT FOR THE FLASHES', 260, 30, 24, '#fff');
      seq.forEach((v, j) => { const x = 160 + j * 100, on = j === i && ph < .6; circ(x, 150, 40, on ? '#fff' : SYMC[v], 4); if (on) { ctx.fillStyle = SYMC[v]; ctx.beginPath(); ctx.arc(x, 156, 28, 0, 7); ctx.fill(); } drawSym(v, x, 150 + (on ? 6 : 0), 20); }); demoFinger(160 + i * 100, 160, ph > .25 && ph < .6, (ph - .25) / .35); },
  ],
  du_crank: [
    t => { const ph = t % 3, on = ph < 1.8, sp = ph >= 1.8 && ph < 2.5, gx = on ? 70 : 0; box(260 - 120 - gx, 20, 120, 50, sp ? YEL : '#8d89a8', 4); box(260 + gx, 20, 120, 50, sp ? YEL : '#8d89a8', 4);
      txt(sp ? 'SPARK! LET GO!' : on ? 'GATE OPEN' : 'GATE CLOSED', 260, 110, 30, sp ? YEL : on ? GRN : '#fff', 'center', 480);
      box(170, 150, 180, 56, on ? GRN : '#e8e4f7', 4); txt(on ? 'HOLDING' : 'HOLD', 260, 188, 28, INK); demoFinger(260, 178, on, 0); },
    t => { const a = t * 3, R = 80; circ(260, 120, R + 20, '#e8e4f7', 5); ctx.save(); ctx.translate(260, 120); ctx.rotate(a); ctx.fillStyle = INK; ctx.fillRect(-9, -R, 18, R); circ(0, -R, 18, PNK, 5); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(260, 120, R + 40, a - 2 - Math.PI / 2, a - Math.PI / 2); ctx.stroke(); demoFinger(260 + Math.sin(a) * R, 120 - Math.cos(a) * R, true, 0); },
  ],
  du_steer: [
    t => { const x = 260 + 130 * Math.sin(t * 1.8), ry = ((t * 130) % 300) - 40; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(260, ry, 62, 30, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#8a86a3'; ctx.beginPath(); ctx.ellipse(260, ry - 2, 56, 25, 0, 0, 7); ctx.fill();
      claude(x, 190, 3, {}); txt('◄', 40, 190, 50, '#fff'); txt('►', 480, 190, 50, '#fff'); demoFinger(x, 232, true, 0); },
    t => { const k = (t % .3) / .3, fl = 40 + Math.sin(t * 20) * 8 + 20; ctx.fillStyle = YEL; ctx.beginPath(); ctx.moveTo(244, 150); ctx.lineTo(260, 150 + fl); ctx.lineTo(276, 150); ctx.fill(); claude(260, 110, 3, {});
      box(160, 14, 200, 18, '#3a3550', 3); ctx.fillStyle = ORG; ctx.fillRect(160, 14, 200 * (.3 + .5 * Math.abs(Math.sin(t))), 18); txt('TAP! TAP! TAP!', 260, 236, 30, '#fff'); demoFinger(430, 150, k < .4, k * 2.5); },
  ],
  du_seesaw: [0, 1].map(side => t => { const ph = t % 2.4, hold = ph < 1.3, tl = hold ? (side ? -1 : 1) : 0, bx = hold ? (side ? -1 : 1) * 110 * (ph / 1.3) : 0;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(210, 230); ctx.lineTo(310, 230); ctx.lineTo(260, 150); ctx.fill(); ctx.save(); ctx.translate(260, 150); ctx.rotate(-tl * .26); box(-200, -12, 400, 24, '#d9a066', 4); circ(bx, -38, 24, '#fff', 5); ctx.restore();
    box(side ? 330 : 30, 170, 160, 52, hold ? GRN : '#e8e4f7', 4); txt(hold ? 'PUSHING' : 'HOLD', side ? 410 : 110, 206, 24, INK); demoFinger(side ? 470 : 170, 226, hold, 0); txt(side ? 'RIGHT' : 'LEFT', side ? 410 : 110, 150, 22, YEL); }),
  du_beat: [0, 1].map(lane => t => { const LXD = [170, 350], C = [BLU, PNK]; for (let l = 0; l < 2; l++) { ctx.fillStyle = l === lane ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.25)'; ctx.fillRect(LXD[l] - 60, 10, 120, 220); }
    ctx.fillStyle = YEL; ctx.fillRect(100, 180, 340, 6); let near = false; for (let i = 0; i < 3; i++) { const y = ((t * 150 + i * 110) % 330) - 40; circ(LXD[lane], y, 22, C[lane], 4); if (Math.abs(y - 183) < 18) near = true; circ(LXD[1 - lane], ((t * 150 + i * 110 + 55) % 330) - 40, 16, C[1 - lane], 3); }
    demoFinger(LXD[lane] + 90, 205, near, .2); txt('TAP!', LXD[lane] + 90, 150, 30, near ? '#fff' : 'rgba(255,255,255,.4)'); }),
  du_guide: [
    t => { const k = Math.floor(t / 1.1) % 3; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const x = 40 + c * 70, y = 20 + r * 70, here = c === 1 && r === 2 - Math.min(2, k); ctx.fillStyle = INK; ctx.fillRect(x - 2, y - 2, 68, 68); ctx.fillStyle = here ? '#5a5680' : '#15121f'; ctx.fillRect(x, y, 64, 64); if (here) claude(x + 32, y + 38, 1.6, {}); }
      txt('GUIDE SAYS', 380, 60, 24, '#fff'); txt('▲', 380, 170, 100, GRN); },
    t => { const k = Math.floor(t / 1.1) % 3; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const x = 40 + c * 70, y = 20 + r * 70, pitC = (c === 0 && r === 1) || (c === 2 && r === 0); ctx.fillStyle = INK; ctx.fillRect(x - 2, y - 2, 68, 68); ctx.fillStyle = '#3a3550'; ctx.fillRect(x, y, 64, 64); if (pitC) { circ(x + 32, y + 32, 20, '#000', 3); txt('✕', x + 32, y + 42, 26, RED); } if (c === 1 && r === 2 - Math.min(2, k)) claude(x + 32, y + 38, 1.6, {}); }
      const ph = (t % 1.1) / 1.1; circ(380, 130, 34, ph > .5 && ph < .8 ? GRN : '#e8e4f7', 5); txt('▲', 380, 142, 34, INK); demoFinger(380, 140, ph > .5 && ph < .8, (ph - .5) / .3); },
  ],
  du_gun: [
    t => { const cx = 260 + 140 * Math.sin(t * 1.6), k = (t % 1.2) / 1.2; circ(cx + 50 * Math.sin(t), 40 + k * 60, 20, RED, 4); box(cx - 28, 196, 56, 26, '#8d89a8', 4); box(cx - 9, 164, 18, 36, RED, 4); if (k > .3 && k < .7) circ(cx, 160 - (k - .3) * 300, 8, RED, 3); demoFinger(cx, 232, k > .3 && k < .45, (k - .3) / .15); },
    t => { const ph = Math.floor(t / 1.3) % 2, p = (t % 1.3) / 1.3; circ(120, 50, 22, RED, 4); circ(400, 90, 22, BLU, 4); [0, 1].forEach(c => { box(c ? 280 : 40, 150, 200, 56, c ? BLU : RED, 4); if (ph === c) { ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.strokeRect(c ? 280 : 40, 150, 200, 56); } txt(c ? 'BLUE' : 'RED', c ? 380 : 140, 190, 28, INK); });
      demoFinger(ph ? 440 : 100, 222, p < .4, p * 2.5); },
  ],
};
function wire(g, D, judge, sp, id) {
  g.roles = DUINFO[id].map(([label, short, how], r) => ({ label, short, how, demo: DEMOS[id][r] }));
  g.role = D.role; g.judge = D.role === judge; g.limit = g.dur / Math.sqrt(sp) - END_SLACK;
  D.onMsg((t, d) => {
    if (t === 'end') { if (!g.judge && !g.result) { g.result = d === 'win' ? 'win' : 'lose'; (g.result === 'win' ? duWin : duLose)(400, 330); } }
    else if (g.msg) g.msg(t, d);
  });
  g.finish = res => { if (g.result) return; g.result = res; D.send('end', res); (res === 'win' ? duWin : duLose)(400, 330); };
}
const rolePick = (D, a, b) => D.role === 0 ? a : b;

/* ═════════ 1 CATCH & THROW: P1 slides the basket, P2 drops coins (and bombs) from a swinging hand ═════════ */
function duCatch(sp, D) {
  D = D || SOLO; const R = mkR();
  const need = Math.round(4 + (sp - 1) * 4), vy = 400 + (sp - 1) * 120, FLOOR = 520, DY = 215, COOL = .42;
  const bombs = Array.from({ length: 80 }, () => R() < .24), dsp = 1.2 + R() * .4, dph = R() * 6.28;
  const handX = c => 400 + 300 * Math.sin(dsp * (.9 + sp * .1) * c + dph);
  const items = [], bxT = track();
  let bx = 400, kx = 0, caught = 0, flash = 0, nid = 0, nIdx = 0, cool = 0, lastBx = -1;
  const catcher = D.role === 0, yOf = it => DY + (g.c - it.t0) * vy;
  const g = {
    c: 0, dur: 14, pts: 0,
    cmd: catcher ? 'CATCH!' : 'THROW!', roleLabel: catcher ? 'CATCHER' : 'THROWER',
    hint: catcher ? 'MOVE THE MOUSE (OR ◄ ►) TO CATCH YOUR PARTNER\'S COINS - AVOID THE BOMBS' : 'CLICK / SPACE TO DROP THE COINS ONTO THE BASKET - NOT THE BOMBS!',
    thint: catcher ? 'DRAG TO CATCH YOUR PARTNER\'S COINS - AVOID THE BOMBS' : 'TAP TO DROP THE COINS ONTO THE BASKET - NOT THE BOMBS!',
    update(dt) {
      g.c += dt; flash = Math.max(0, flash - dt * 4); cool = Math.max(0, cool - dt);
      if (catcher) {
        if (!g.result) bx = clamp(bx + kx * 560 * dt, 60, 740);
        const r = Math.round(bx); if (r !== lastBx) { lastBx = r; D.send('bx', r, true); }
        for (const it of items) {
          if (it.got || g.result) continue; const y = yOf(it);
          if (y > FLOOR - 24 && y < FLOOR + 30 && Math.abs(it.x - bx) < 62) {
            it.got = true;
            if (it.b) { caught = Math.max(0, caught - 1); flash = 1; sfx.buzz(); shake(5, .15); burst(it.x, FLOOR, RED, 10); floatText('-1', it.x, FLOOR - 50, RED, 36); }
            else { caught++; sfx.coin(); burst(it.x, FLOOR, YEL, 8); }
            D.send('got', { id: it.id, b: it.b ? 1 : 0, n: caught });
          }
        }
        if (!g.result) { if (caught >= need) g.finish('win'); else if (g.c >= g.limit) g.finish('lose'); }
      }
      for (let i = items.length - 1; i >= 0; i--) if (yOf(items[i]) > FLOOR + 90 || (items[i].got && g.c - items[i].gt > .3)) items.splice(i, 1);
    },
    msg(t, d) {
      if (t === 'drop') items.push({ id: d.id, x: d.x, b: !!d.b, t0: g.c, got: false });
      else if (t === 'bx') bxT.push(d);
      else if (t === 'got') {
        caught = d.n; const it = items.find(q => q.id === d.id);
        if (it) { it.got = true; it.gt = g.c; }
        const x = it ? it.x : 400;
        if (d.b) { sfx.buzz(); flash = 1; burst(x, FLOOR, RED, 10); floatText('-1', x, FLOOR - 50, RED, 36); } else { sfx.coin(); burst(x, FLOOR, YEL, 8); }
      }
    },
    drop() {
      if (catcher || g.result || cool > 0 || g.c < .1) return;
      cool = COOL; const b = bombs[nIdx++ % bombs.length], it = { id: nid++, x: Math.round(handX(g.c)), b, t0: g.c, got: false };
      items.push(it); D.send('drop', { id: it.id, x: it.x, b: b ? 1 : 0 }); sfx.blip(8);
    },
    draw(t) {
      duBg(t); duBar(caught / need, `${caught} / ${need}`);
      const hX = handX(g.c), hb = bombs[nIdx % bombs.length];
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-OX, DY - 36, VW, 6);
      box(hX - 26, DY - 62, 52, 26, '#d9d4ee', 3);
      if (!catcher) { if (hb) ptBombAt(hX, DY - 12, 14); else token(hX, DY - 12, 16); }   // only the thrower sees what is in the hand
      for (const it of items) { if (it.got) continue; const y = yOf(it); if (y < -30 || y > H + 30) continue; it.b ? ptBombAt(it.x, y, 20) : token(it.x, y, 22); }
      ctx.fillStyle = INK; ctx.fillRect(-OX, FLOOR + 40, VW, H);
      const x = catcher ? bx : (bxT.at() === null ? 400 : bxT.at());
      box(x - 60, FLOOR - 6, 120, 44, flash > 0 ? RED : ORG, 4); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x - 60, FLOOR - 6, 120, 10);
      if (!catcher && !g.result) txt(TOUCH ? 'TAP!' : 'SPACE!', 400, 300, 56, 'rgba(255,255,255,.55)');
      claude(66 - OX, 590, 4.5, { mood: duMood(g) }); vignette(.22);
    },
    move(p) { if (catcher && !g.result) bx = clamp(p.x, 60, 740); },
    down(p) { catcher ? g.move(p) : g.drop(); },
    key(e) {
      if (catcher) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1; }
      else if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown')) g.drop();
    },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (kx < 0) kx = 0; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (kx > 0) kx = 0; } },
  };
  g.dbg = { caught: () => caught, bx: () => bx, items };
  wire(g, D, 0, sp, 'du_catch');
  return g;
}
function ptBombAt(x, y, r) {
  circ(x, y, r, '#2b2b3a', 4); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 8, y - r); ctx.lineTo(x + 16, y - r - 12); ctx.stroke();
  star(x + 17, y - r - 14, 8 + Math.sin(now * 30) * 2, 3, 6, now * 8, '#FFB020', 2); ctx.fillStyle = '#fff'; ctx.fillRect(x - 9, y - 9, 6, 6);
}
reg('du_catch', duCatch, 'CATCH & THROW'); REGMAP.du_catch.duo = true;

/* ═════════ 2 DECODE: P1 reads a numeric code and points at the matching symbols, P2 presses what flashes ═════════ */
const SYMC = [BLU, YEL, GRN, PNK, ORG, LIL];
const SLOTS = [[190, 322], [400, 322], [610, 322], [190, 482], [400, 482], [610, 482]];
function drawSym(i, x, y, r) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.beginPath();
  if (i === 0) ctx.arc(0, 0, r, 0, 7);
  else if (i === 1) ctx.rect(-r * .9, -r * .9, r * 1.8, r * 1.8);
  else if (i === 2) { ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 1.05, r * .8); ctx.lineTo(-r * 1.05, r * .8); ctx.closePath(); }
  else if (i === 3) { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * .45 : r * 1.1; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
  else if (i === 4) { ctx.moveTo(0, -r * 1.15); ctx.lineTo(r * .85, 0); ctx.lineTo(0, r * 1.15); ctx.lineTo(-r * .85, 0); ctx.closePath(); }
  else { const q = r * .38, s = r * 1.05; ctx.moveTo(-q, -s); ctx.lineTo(q, -s); ctx.lineTo(q, -q); ctx.lineTo(s, -q); ctx.lineTo(s, q); ctx.lineTo(q, q); ctx.lineTo(q, s); ctx.lineTo(-q, s); ctx.lineTo(-q, q); ctx.lineTo(-s, q); ctx.lineTo(-s, -q); ctx.lineTo(-q, -q); ctx.closePath(); }
  ctx.stroke(); ctx.fill(); ctx.restore();
}
function duDecode(sp, D) {
  D = D || SOLO; const R = mkR(), reader = D.role === 0, n = 4 + (sp > 1.3 ? 1 : 0);
  const code = Array.from({ length: n }, () => Math.floor(R() * 6)), shuf = () => { const a = [0, 1, 2, 3, 4, 5]; for (let i = 5; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const permT = shuf(), permR = shuf(), perm = reader ? permR : permT;            // pad slot -> symbol; each role gets its own layout
  const pings = [];                                                              // typist: { s, c } flashes sent by the reader
  let at = 0, wrong = -1, wrongT = 0, lastPing = -9, pingGlow = -1, pingT = 0;
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: reader ? 'READ!' : 'TYPE!', roleLabel: reader ? 'READER' : 'TYPIST',
    hint: reader ? 'FIND EACH NUMBER OF THE CODE ON THE PADS AND TAP THEM IN ORDER - YOUR PARTNER SEES THEM FLASH' : 'PRESS THE PADS THAT FLASH, IN ORDER (CLICK OR KEYS 1-6) - IF YOU SLIP, THE CODE STARTS OVER',
    thint: reader ? 'TAP THE PADS FOR EACH NUMBER, IN ORDER - YOUR PARTNER SEES THEM FLASH' : 'TAP THE PADS THAT FLASH, IN ORDER - IF YOU SLIP, THE CODE STARTS OVER',
    update(dt) {
      g.c += dt; wrongT = Math.max(0, wrongT - dt); pingT = Math.max(0, pingT - dt);
      if (!reader && !g.result && g.c >= g.limit) g.finish('lose');
    },
    msg(t, d) {
      if (t === 'ping' && !reader) { pings.push({ s: d, c: g.c }); snd(330 + d * 90, .2, 'triangle', .07); }
      else if (t === 'press' && reader) { at = d.at; if (!d.ok) { wrongT = .5; sfx.miss(); } else snd(330 + d.s * 90, .15, 'triangle', .06); }
    },
    ping(s) {
      if (!reader || g.result || g.c - lastPing < .22) return; lastPing = g.c; pingGlow = s; pingT = .2; D.send('ping', s); snd(330 + s * 90, .15, 'triangle', .06);
    },
    press(s) {
      if (reader || g.result || g.c < .15) return;
      if (s === code[at]) { at++; snd(330 + s * 90, .2, 'triangle', .08); D.send('press', { at, ok: 1, s }); if (at === n) { g.finish('win'); floatText('DECODED!', 400, 190, YEL, 50); } }
      else { at = 0; wrong = s; wrongT = .5; sfx.miss(); shake(4, .1); D.send('press', { at: 0, ok: 0, s }); }
    },
    draw(t) {
      duBg(t);
      for (let i = 0; i < n; i++) {
        const x = 400 + (i - (n - 1) / 2) * 92, done = i < at;
        if (reader) { box(x - 36, 100, 72, 72, done ? GRN : '#fff', 4); txt(String(code[i] + 1), x, 138, 52, done ? '#fff' : INK); }
        else circ(x, 138, 30, done ? GRN : wrongT > 0 ? RED : '#3a3550', 4);
      }
      txt(reader ? 'YOUR PARTNER ENTERS WHAT YOU POINT AT' : g.result ? '' : 'WAIT FOR THE FLASHES', 400, 206, 24, '#fff', 'center', 700);
      if (!reader && !g.result) { while (pings.length && g.c - pings[0].c > 1.4) pings.shift(); }
      perm.forEach((s, k) => {
        const [x, y] = SLOTS[k], glow = reader ? (pingGlow === s && pingT > 0) : pings.some(p => p.s === s && g.c - p.c < .7), bad = !reader && wrong === s && wrongT > 0;
        circ(x, y + (glow ? 6 : 0), 62, bad ? RED : glow ? '#fff' : SYMC[s], 5);
        if (glow) { ctx.fillStyle = SYMC[s]; ctx.beginPath(); ctx.arc(x, y + 6, 44, 0, 7); ctx.fill(); }
        drawSym(s, x, y + (glow ? 6 : 0), 26);
        if (reader) txt(String(s + 1), x + 46, y - 46, 26, YEL);
        else if (!TOUCH) txt(String(k + 1), x - 46, y - 46, 22, '#fff');
      });
      claude(66 - OX, 590, 4.5, { mood: duMood(g) }); vignette(.22);
    },
    down(p) {
      let b = -1, bd = 1e9; SLOTS.forEach((q, k) => { const d = Math.hypot(p.x - q[0], p.y - q[1]); if (d < 76 && d < bd) { bd = d; b = k; } });
      if (b >= 0) reader ? g.ping(perm[b]) : g.press(perm[b]);
    },
    key(e) {
      if (e.repeat) return; const m = /^(?:Digit|Numpad)([1-6])$/.exec(e.code); if (!m) return; const k = +m[1] - 1;
      reader ? g.ping(k) : g.press(perm[k]);        // reader: the key IS the number on the code; typist: the key is the pad position
    },
  };
  g.dbg = { code };                                                              // read by test/duo.test.js (bots)
  wire(g, D, 1, sp, 'du_decode');
  return g;
}
reg('du_decode', duDecode, 'DECODE'); REGMAP.du_decode.duo = true;

/* ═════════ 3 LEVER & CRANK: P1 holds the gate open (but must let go when it sparks), P2 cranks to fill the bar ═════════ */
function duCrank(sp, D) {
  D = D || SOLO; const R = mkR(), lever = D.role === 0, TURNS = 2 + Math.round((sp - 1) * 2), CX = 400, CY = 380;
  const k = 1 / Math.sqrt(sp), sparks = Array.from({ length: 4 }, (_, i) => ({ a: (2.2 + i * 2.4 + R() * .4) * k, b: 0 })); sparks.forEach(s => { s.b = s.a + .7; });   // the schedule speeds up with the round
  const sparkAt = c => { for (const s of sparks) { if (c >= s.a && c < s.b) return 1; if (c >= s.a - .5 && c < s.a) return 2; } return 0; };   // 2 = warning, 1 = live
  let on = false, prog = 0, gate = 0, lvOn = false, sparkV = 0, sparkAge = 0, shocked = false, shockT = 0, lastLv = -1, lastSp = -1, lastPg = -1;
  let holding = false, lastAng = null, ang = 0, keyAlt = 0; const pgT = track();
  const g = {
    c: 0, dur: 14, pts: 0,
    cmd: lever ? 'HOLD!' : 'CRANK!', roleLabel: lever ? 'LEVER' : 'CRANKER',
    hint: lever ? 'HOLD CLICK / SPACE TO KEEP THE GATE OPEN - LET GO WHEN IT SPARKS!' : 'DRAG IN CIRCLES (OR MASH SPACE) TO FILL THE BAR - IT ONLY WORKS WHILE THE GATE IS OPEN',
    thint: lever ? 'HOLD YOUR FINGER TO KEEP THE GATE OPEN - LET GO WHEN IT SPARKS!' : 'DRAG IN CIRCLES TO FILL THE BAR - IT ONLY WORKS WHILE THE GATE IS OPEN',
    update(dt) {
      g.c += dt; shockT = Math.max(0, shockT - dt);
      if (lever) {
        const s = g.c < 1.2 ? 0 : sparkAt(g.c); if (s !== lastSp) { lastSp = s; D.send('sp', s, true); if (s === 1) sfx.buzz(); else if (s === 2) snd(880, .08, 'square', .04); }
        const v = on ? 1 : 0; if (v !== lastLv) { lastLv = v; D.send('lv', v, true); }
        sparkV = s; gate += ((on ? 1 : 0) - gate) * Math.min(1, dt * 12);
        const p = pgT.at(.05); if (p !== null) prog = p;
      } else {
        gate += ((lvOn ? 1 : 0) - gate) * Math.min(1, dt * 12);
        if (sparkV === 1) sparkAge += dt; else { sparkAge = 0; shocked = false; }
        if (!g.result) {
          if (!lvOn) prog = Math.max(0, prog - .12 * dt);
          if (sparkV === 1 && lvOn && sparkAge > .3 && !shocked) { shocked = true; prog = Math.max(0, prog - .3); shockT = .5; D.send('shock', 1); sfx.buzz(); shake(7, .2); burst(CX, 250, YEL, 14); }
          const r = Math.round(prog * 100); if (r !== lastPg) { lastPg = r; D.send('pg', r / 100, true); }
          if (prog >= 1) g.finish('win'); else if (g.c >= g.limit) g.finish('lose');
        }
      }
    },
    msg(t, d) {
      if (t === 'lv') lvOn = d === 1;
      else if (t === 'sp') { sparkV = d; if (d === 1) sfx.buzz(); else if (d === 2) snd(880, .08, 'square', .04); }
      else if (t === 'pg') pgT.push(d);
      else if (t === 'shock') { shockT = .5; sfx.buzz(); shake(7, .2); burst(CX, 250, YEL, 14); }
    },
    turn(f) {                                       // f = fraction of a full turn, only counts while the gate is open
      if (g.result) return; if (lvOn) { prog = Math.min(1, prog + f / TURNS); sfx.blip(Math.min(14, Math.round(prog * 14))); } else { sfx.miss(); shockT = .15; }
    },
    draw(t) {
      duBg(t); duBar(prog);
      const open = gate > .5, warn = sparkV === 2, live = sparkV === 1;
      // gate: two doors that slide apart when the lever is held
      const gx = 120 * gate;
      box(CX - 200 - gx, 170, 200, 70, live ? '#ffe14d' : warn ? ORG : '#8d89a8', 4); box(CX + gx, 170, 200, 70, live ? '#ffe14d' : warn ? ORG : '#8d89a8', 4);
      if (live) for (let i = 0; i < 5; i++) { ctx.strokeStyle = YEL; ctx.lineWidth = 4; ctx.beginPath(); const x = CX - 100 + i * 50; ctx.moveTo(x, 150); ctx.lineTo(x + (Math.random() - .5) * 40, 180); ctx.lineTo(x + (Math.random() - .5) * 40, 215); ctx.stroke(); }
      txt(live ? 'SPARK!' : warn ? 'GET READY...' : open ? 'GATE OPEN' : 'GATE CLOSED', CX, 275, live ? 44 : 30, live ? YEL : warn ? ORG : open ? GRN : '#fff', 'center', 600);
      // crank wheel (the lever player sees the partner's wheel turn from the shared progress)
      const a = lever ? prog * TURNS * 6.2832 : ang;
      ctx.save(); ctx.translate(CX, CY + 40); if (shockT > 0) ctx.translate((Math.random() - .5) * 8, 0);
      circ(0, 0, 100, open ? '#e8e4f7' : '#8d89a8', 6); ctx.rotate(a);
      ctx.fillStyle = INK; ctx.fillRect(-10, -92, 20, 92); circ(0, -92, 20, open ? PNK : '#6b6880', 5); ctx.restore();
      circ(CX, CY + 40, 14, INK, 0);
      if (lever) {
        const k = on ? 1 : 0; box(CX - 90, 530, 180, 56, on ? GRN : '#e8e4f7', 4); txt(on ? 'HOLDING' : TOUCH ? 'HOLD!' : 'HOLD (SPACE)', CX, 558 + k * 2, 26, INK, 'center', 160);
      } else if (!g.result && !holding && prog < .05) txt(TOUCH ? 'DRAG IN CIRCLES' : 'DRAG IN CIRCLES / MASH SPACE', CX, 560, 24, 'rgba(255,255,255,.7)', 'center', 700);
      claude(66 - OX, 590, 4.5, { mood: duMood(g) }); vignette(.22);
    },
    down(p) { if (lever) { on = true; sfx.blip(6); } else { holding = true; lastAng = null; g.drag(p); } },
    move(p) { if (!lever && holding) g.drag(p); },
    up() { if (lever) on = false; else { holding = false; lastAng = null; } },
    drag(p) {
      const dx = p.x - CX, dy = p.y - (CY + 40); if (Math.hypot(dx, dy) < 34) { lastAng = null; return; }
      const a = Math.atan2(dy, dx); if (lastAng !== null) { let d = a - lastAng; if (d > Math.PI) d -= 6.2832; else if (d < -Math.PI) d += 6.2832; if (Math.abs(d) < 1.2) { ang += d; g.turn(Math.abs(d) / 6.2832); } } lastAng = a;
    },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (lever) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'ArrowUp') { on = true; } }
      else if (!e.repeat) { ang += .8; g.turn(1 / 8); }
    },
    keyup(e) { if (lever && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'ArrowUp')) on = false; },
  };
  g.dbg = { sparks };
  wire(g, D, 1, sp, 'du_crank');
  return g;
}
reg('du_crank', duCrank, 'LEVER & CRANK'); REGMAP.du_crank.duo = true;

/* ═════════ 4 STEER & BOOST: P1 steers the ship around rocks, P2 mashes to boost it to the finish ═════════ */
function duSteer(sp, D) {
  D = D || SOLO; const R = mkR(), steer = D.role === 0, LEN = 2000, TS = Math.sqrt(sp), BASE = 115, YS = 470, ROCK = [];
  for (let p0 = 380; p0 < LEN - 160;) {
    const x = 100 + R() * 600, w = 110 + R() * 50, two = R() < .4, off = 300 + R() * 130, side = x < 400 ? 1 : -1, gap = 170 + R() * 80;
    ROCK.push({ p: p0, x, w }); if (two) ROCK.push({ p: p0 + 8, x: clamp(x + side * off, 90, 710), w: 100 }); p0 += gap;
  }
  const pT = track(), xT = track(), eT = track();
  let x = 400, p = 0, extra = 0, kx = 0, inv = 0, stun = 0, pend = 0, sendAt = 0, tapFx = 0, lastSh = '';
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: steer ? 'STEER!' : 'BOOST!', roleLabel: steer ? 'STEERER' : 'BOOSTER',
    hint: steer ? 'MOVE THE MOUSE (OR ◄ ►) TO DODGE THE ROCKS - YOUR PARTNER MAKES YOU GO FAST' : 'CLICK / TAP / SPACE AS FAST AS YOU CAN TO BOOST YOUR PARTNER\'S SHIP',
    thint: steer ? 'DRAG TO DODGE THE ROCKS - YOUR PARTNER MAKES YOU GO FAST' : 'TAP AS FAST AS YOU CAN TO BOOST YOUR PARTNER\'S SHIP',
    update(dt) {
      g.c += dt; inv = Math.max(0, inv - dt); stun = Math.max(0, stun - dt); tapFx = Math.max(0, tapFx - dt * 5);
      if (steer) {
        if (g.result) return;
        x = clamp(x + kx * 520 * dt, 50, 750);
        extra *= Math.exp(-2.2 * dt);
        if (stun <= 0) p += (BASE + extra) * dt * TS;           // the whole course runs faster in later rounds (same number of taps, less time)
        for (const o of ROCK) if (inv <= 0 && Math.abs(o.p - p) < 26 && Math.abs(o.x - x) < o.w / 2 + 22) { extra = 0; stun = .5; inv = .9; p = Math.max(0, p - 140); shake(7, .2); sfx.thud(); burst(x, YS, RED, 12); D.send('hit', o.x); break; }
        const sh = [Math.round(p), Math.round(x), Math.round(extra)]; if (g.c - sendAt >= .05 && sh.join() !== lastSh) { lastSh = sh.join(); sendAt = g.c; D.send('sh', sh, true); }
        if (p >= LEN) g.finish('win'); else if (g.c >= g.limit) g.finish('lose');
      } else {
        if (pend && g.c - sendAt >= .1) { sendAt = g.c; D.send('b', pend); pend = 0; }
      }
    },
    msg(t, d) {
      if (t === 'sh' && !steer) { pT.push(d[0]); xT.push(d[1]); eT.push(d[2]); }
      else if (t === 'b' && steer) { extra = Math.min(340, extra + 70 * Math.min(d, 3)); sfx.blip(6); }
      else if (t === 'hit' && !steer) { shake(5, .15); sfx.thud(); burst(xT.at() || 400, YS, RED, 10); }
    },
    boost() { if (steer || g.result) return; pend++; tapFx = 1; sfx.blip(Math.min(14, 4 + pend)); },
    draw(t) {
      duBg(t);
      const P = steer ? p : (pT.at() === null ? 0 : pT.at()), X = steer ? x : (xT.at() === null ? 400 : xT.at()), E = steer ? extra : (eT.at() || 0);
      duBar(P / LEN);
      const off = P % 80; ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -1; i < 9; i++) ctx.fillRect(396, 40 + i * 80 + off, 8, 40);
      const fy = YS - (LEN - P); if (fy > -40) { for (let i = -Math.ceil(OX / 40); i < 20 + Math.ceil(OX / 40); i++) { ctx.fillStyle = i % 2 ? INK : '#fff'; ctx.fillRect(i * 40, fy, 40, 24); } }
      for (const o of ROCK) {
        const y = YS - (o.p - P); if (y < -50 || y > H + 50) continue;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(o.x, y, o.w / 2 + 5, 30, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#8a86a3'; ctx.beginPath(); ctx.ellipse(o.x, y - 2, o.w / 2, 25, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(o.x - o.w * .15, y - 10, o.w * .22, 8, 0, 0, 7); ctx.fill();
      }
      const fl = Math.min(1, E / 200); if (fl > .05) { ctx.fillStyle = YEL; ctx.beginPath(); ctx.moveTo(X - 16, YS + 26); ctx.lineTo(X, YS + 26 + 30 + fl * 90 + Math.random() * 14); ctx.lineTo(X + 16, YS + 26); ctx.fill(); }
      ctx.save(); if (steer && inv > 0 && Math.floor(now * 20) % 2) ctx.globalAlpha = .45; claude(X, YS, 3.4, { mood: duMood(g) }); ctx.restore();
      if (!steer) { box(250, 560, 300, 22, '#3a3550', 3); ctx.fillStyle = tapFx > 0 ? '#fff' : ORG; ctx.fillRect(250, 560, 300 * Math.min(1, E / 300), 22); if (!g.result) txt(TOUCH ? 'TAP! TAP! TAP!' : 'MASH SPACE!', 400, 520, 36, '#fff'); }
      vignette(.22);
    },
    move(p) { if (steer && !g.result) x = clamp(p.x, 50, 750); },
    down(p) { steer ? g.move(p) : g.boost(); },
    key(e) {
      if (steer) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1; }
      else if (!e.repeat && e.code !== 'KeyP' && e.code !== 'KeyM' && e.code !== 'Escape') g.boost();
    },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (kx < 0) kx = 0; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (kx > 0) kx = 0; } },
  };
  g.dbg = { ROCK, pos: () => ({ p, x }) };
  wire(g, D, 0, sp, 'du_steer');
  return g;
}
reg('du_steer', duSteer, 'STEER & BOOST'); REGMAP.du_steer.duo = true;

/* ═════════ 5 SEESAW: P1 raises the left end, P2 the right end; the wind pushes the ball, keep it in the middle ═════════ */
function duSeesaw(sp, D) {
  D = D || SOLO; const R = mkR(), left = D.role === 0, TS = Math.sqrt(sp), A = 4, GOAL = 5, ZONE = .45, PW = 250, PX = 400, PY = 350;
  const winds = []; { let u = 0, s = R() < .5 ? 1 : -1; while (u < 40) { const len = 1.3 + R() * .9; winds.push({ b: u + len, w: s * (2.8 + R() * .3 + (sp - 1) * .3) }); u += len; s = -s; } }   // the wind flips side every 1.3-2.2 s: one end alone can never fix it
  const windAt = c => { if (c < 1) return 0; const u = c * TS; for (const w of winds) if (u < w.b) return w.w; return 0; };
  let on = false, pHold = 0, tilt = 0, pos = 0, vel = 0, prog = 0, lastH = -1, lastSt = -9, flash = 0; const bT = track();
  const g = {
    c: 0, dur: 14, pts: 0,
    cmd: left ? 'LEFT!' : 'RIGHT!', roleLabel: left ? 'LEFT SIDE' : 'RIGHT SIDE',
    hint: left ? 'HOLD CLICK / SPACE TO RAISE THE LEFT END - THE BALL ROLLS AWAY FROM IT. KEEP IT IN THE GREEN!' : 'HOLD CLICK / SPACE TO RAISE THE RIGHT END - THE BALL ROLLS AWAY FROM IT. KEEP IT IN THE GREEN!',
    thint: left ? 'HOLD YOUR FINGER TO RAISE THE LEFT END - KEEP THE BALL IN THE GREEN!' : 'HOLD YOUR FINGER TO RAISE THE RIGHT END - KEEP THE BALL IN THE GREEN!',
    update(dt) {
      g.c += dt; flash = Math.max(0, flash - dt * 3);
      const h = on ? 1 : 0; if (h !== lastH) { lastH = h; D.send('h', h, true); }
      tilt += ((left ? h - pHold : pHold - h) - tilt) * Math.min(1, dt * 9);
      if (left && !g.result) {
        vel += (tilt * A + windAt(g.c)) * dt; vel *= Math.exp(-2 * dt); pos += vel * dt;
        if (Math.abs(pos) > 1) { pos = 0; vel = 0; prog = Math.max(0, prog - 1.5); flash = 1; sfx.miss(); shake(6, .2); D.send('fall', 1); }
        else if (Math.abs(pos) < ZONE && g.c > 1) prog = Math.min(GOAL, prog + dt);
        if (g.c - lastSt >= .05) { lastSt = g.c; D.send('st', [Math.round(pos * 1000), Math.round(prog * 100)], true); }
        if (prog >= GOAL) g.finish('win'); else if (g.c >= g.limit) g.finish('lose');
      }
    },
    msg(t, d) { if (t === 'h') pHold = d; else if (t === 'st') { bT.push(d[0] / 1000); prog = d[1] / 100; } else if (t === 'fall') { flash = 1; sfx.miss(); shake(6, .2); } },
    draw(t) {
      duBg(t); duBar(prog / GOAL);
      const P = g.dbg.ball(), w = windAt(g.c);
      txt('WIND', 400, 156, 22, '#fff'); txt(w > 0 ? '►►►' : w < 0 ? '◄◄◄' : '...', 400, 214, 36 + Math.abs(w) * 10, ORG);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(PX - 50, PY + 110); ctx.lineTo(PX + 50, PY + 110); ctx.lineTo(PX, PY); ctx.fill();
      ctx.save(); ctx.translate(PX, PY); ctx.rotate(-tilt * .26);
      box(-PW - 20, -14, PW * 2 + 40, 28, '#d9a066', 4); ctx.fillStyle = 'rgba(92,255,122,.7)'; ctx.fillRect(-ZONE * PW, -14, ZONE * PW * 2, 28);
      circ(P * PW, -14 - 26, 26, flash > 0 ? RED : '#fff', 5); ctx.restore();
      const bx = left ? 60 : 540; box(bx, 496, 200, 56, on ? GRN : '#e8e4f7', 4); txt(on ? 'PUSHING' : TOUCH ? 'HOLD!' : 'HOLD (SPACE)', bx + 100, 534, 26, INK, 'center', 180);
      txt('YOU', left ? 160 : 640, 472, 24, YEL); txt('▼', left ? 160 : 640, 486, 18, YEL);
      claude(66 - OX, 590, 4.5, { mood: duMood(g) }); vignette(.22);
    },
    down() { on = true; sfx.blip(6); }, up() { on = false; },
    key(e) { if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return; on = true; },
    keyup(e) { if (e.code !== 'KeyP' && e.code !== 'KeyM' && e.code !== 'Escape') on = false; },
  };
  g.dbg = { ball: () => left ? pos : (bT.at(.08) === null ? 0 : bT.at(.08)), wind: () => windAt(g.c) };
  wire(g, D, 0, sp, 'du_seesaw');
  return g;
}
reg('du_seesaw', duSeesaw, 'SEESAW'); REGMAP.du_seesaw.duo = true;

/* ═════════ 6 DUET: two lanes of falling notes, each player plays their own lane; the team needs most of the notes ═════════ */
function duBeat(sp, D) {
  D = D || SOLO; const R = mkR(), lane = D.role, TS = Math.sqrt(sp), VY = 330 * TS, LY = 430, WIN = .2, N = 14, LX = [270, 530], LC = [BLU, PNK], PITCH = [262, 330, 392, 330, 523];
  const notes = []; { let u = 1.6; for (let i = 0; i < N; i++) { notes.push({ t: u / TS, lane: (i + (R() < .25 ? 1 : 0)) % 2, hit: false, idx: i }); u += .55 + R() * .3; } }
  const cnt = [notes.filter(n => n.lane === 0).length, notes.filter(n => n.lane === 1).length], need = Math.min(N, Math.max(Math.ceil(N * .8), Math.max(cnt[0], cnt[1]) + 1));
  const lastT = notes[N - 1].t; let mine = 0, theirs = 0, lastStray = -9, lastC = -1, flash = 0, padFx = 0;
  const g = {
    c: 0, dur: 14, pts: 0,
    cmd: 'TAP THE BEAT!', roleLabel: lane === 0 ? 'LEFT LANE' : 'RIGHT LANE',
    hint: lane === 0 ? 'TAP / CLICK / SPACE WHEN A BLUE NOTE HITS THE LINE - YOUR PARTNER PLAYS THE PINK ONES' : 'TAP / CLICK / SPACE WHEN A PINK NOTE HITS THE LINE - YOUR PARTNER PLAYS THE BLUE ONES',
    thint: lane === 0 ? 'TAP WHEN A BLUE NOTE HITS THE LINE - YOUR PARTNER PLAYS THE PINK ONES' : 'TAP WHEN A PINK NOTE HITS THE LINE - YOUR PARTNER PLAYS THE BLUE ONES',
    update(dt) {
      g.c += dt; flash = Math.max(0, flash - dt * 4); padFx = Math.max(0, padFx - dt * 6);
      if (lane === 0 && !g.result) { if (mine + theirs >= need) g.finish('win'); else if (g.c > lastT + .45 || g.c >= g.limit) g.finish('lose'); }
    },
    msg(t, d) { if (t === 'h') { const n = notes[d]; if (n) { n.hit = true; snd(PITCH[d % 5] * 2, .16, 'triangle', .07); } } else if (t === 'c') theirs = d; },
    tap() {
      if (g.result || g.c < .3) return; padFx = 1;
      const n = notes.find(q => q.lane === lane && !q.hit && Math.abs(q.t - g.c) < WIN);
      if (n) { n.hit = true; mine++; snd(PITCH[n.idx % 5], .16, 'triangle', .09); burst(LX[lane], LY, LC[lane], 8); D.send('h', n.idx); D.send('c', mine, true); }
      else if (!notes.some(q => q.lane === lane && !q.hit && Math.abs(q.t - g.c) < .35) && g.c - lastStray > .15) { lastStray = g.c; mine = Math.max(0, mine - 1); flash = 1; sfx.miss(); D.send('c', mine, true); }
    },
    draw(t) {
      duBg(t); duBar((mine + theirs) / need, `${mine + theirs} / ${need}`);
      for (let l = 0; l < 2; l++) { const x = LX[l]; ctx.fillStyle = l === lane ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.22)'; ctx.fillRect(x - 80, 150, 160, 380); }
      ctx.fillStyle = YEL; ctx.fillRect(170, LY - 4, 460, 8);
      for (const n of notes) { if (n.hit) continue; const y = LY - (n.t - g.c) * VY; if (y < 140 || y > H + 20) continue; const mineN = n.lane === lane; circ(LX[n.lane], y, mineN ? 26 : 20, LC[n.lane], mineN ? 5 : 3); if (!mineN) { ctx.fillStyle = 'rgba(20,16,40,.45)'; ctx.beginPath(); ctx.arc(LX[n.lane], y, 20, 0, 7); ctx.fill(); } }
      txt('YOU', LX[lane], 144, 24, YEL); txt('▼', LX[lane], 166, 20, YEL);
      circ(LX[lane], 500 + padFx * 4, 34, flash > 0 ? RED : LC[lane], 5); txt(TOUCH ? 'TAP' : 'SPACE', LX[lane], 508, 20, INK, 'center', 62);
      claude(66 - OX, 590, 4.5, { mood: duMood(g) }); vignette(.22);
    },
    down() { g.tap(); },
    key(e) { if (!e.repeat && e.code !== 'KeyP' && e.code !== 'KeyM' && e.code !== 'Escape') g.tap(); },
  };
  g.dbg = { notes, lane };
  wire(g, D, 0, sp, 'du_beat');
  return g;
}
reg('du_beat', duBeat, 'DUET'); REGMAP.du_beat.duo = true;

/* ═════════ 7 DARK STEPS: P1 walks a dark floor full of pits, P2 sees the whole map and shows where to step ═════════ */
const GDX = [-1, 0, 1, 0], GDY = [0, -1, 0, 1], GARW = ['◄', '▲', '►', '▼'];
function duGuide(sp, D) {
  D = D || SOLO; const R = mkR(), walker = D.role === 0, C = 5, RW = 5, CS = 76, GX = 90, GY = 152, BX = 640, BY = 360;
  const path = []; let pc = Math.floor(R() * C), pr = RW - 1; path.push([pc, pr]);
  while (pr > 0) { const n = Math.floor(R() * 3), dir = R() < .5 ? -1 : 1; for (let i = 0; i < n; i++) { const nc = pc + dir; if (nc < 0 || nc >= C) break; pc = nc; path.push([pc, pr]); } pr--; path.push([pc, pr]); }
  const pit = Array.from({ length: RW }, () => Array(C).fill(false)), start = path[0], flag = pc;
  for (let r = 1; r < RW - 1; r++) { const free = [0, 1, 2, 3, 4].filter(c => !path.some(q => q[0] === c && q[1] === r)); for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; } free.slice(0, 2).forEach(c => { pit[r][c] = true; }); }
  let wc = start[0], wr = start[1], gc = wc, gr = wr, stun = 0, cool = 0, fellAt = null, fellT = 0, sig = -1, sigT = 0, bf = -1, bfT = 0; const vis = new Set([wc + ',' + wr]);
  const cx = c => GX + c * CS + CS / 2, cy = r => GY + r * CS + CS / 2, BTN = [[BX - 76, BY], [BX, BY - 76], [BX + 76, BY], [BX, BY + 76]];
  const g = {
    c: 0, dur: 16, pts: 0,
    cmd: walker ? 'WALK!' : 'GUIDE!', roleLabel: walker ? 'WALKER' : 'GUIDE',
    hint: walker ? 'YOU CAN\'T SEE THE PITS - STEP WITH THE ARROWS (OR ARROW KEYS) WHERE YOUR GUIDE POINTS, UP TO THE TOP' : 'YOU SEE THE PITS - TAP THE ARROW (OR ARROW KEY) THAT SHOWS THE WALKER WHERE TO STEP, UP TO THE FLAG',
    thint: walker ? 'YOU CAN\'T SEE THE PITS - TAP THE ARROWS WHERE YOUR GUIDE POINTS, UP TO THE TOP' : 'YOU SEE THE PITS - TAP THE ARROW THAT SHOWS THE WALKER WHERE TO STEP, UP TO THE FLAG',
    update(dt) {
      g.c += dt; cool = Math.max(0, cool - dt); stun = Math.max(0, stun - dt); sigT = Math.max(0, sigT - dt); fellT = Math.max(0, fellT - dt); bfT = Math.max(0, bfT - dt);
      if (walker && !g.result && g.c >= g.limit) g.finish('lose');
    },
    msg(t, d) {
      if (t === 'sig' && walker) { sig = d; sigT = 1.3; snd(440 + d * 110, .14, 'triangle', .08); }
      else if (t === 'p' && !walker) { gc = d[0]; gr = d[1]; sfx.blip(6); }
      else if (t === 'fall' && !walker) { fellAt = d; fellT = .9; sfx.buzz(); }
    },
    step(dx, dy) {
      if (!walker || g.result || stun > 0 || cool > 0 || g.c < .2) return; cool = .14; const nc = wc + dx, nr = wr + dy; if (nc < 0 || nc >= C || nr < 0 || nr >= RW) return;
      if (pit[nr][nc]) { D.send('fall', [nc, nr]); fellAt = [nc, nr]; fellT = .9; wc = start[0]; wr = start[1]; stun = .9; sfx.buzz(); shake(7, .2); burst(cx(nc), cy(nr), RED, 12); D.send('p', [wc, wr], true); return; }
      wc = nc; wr = nr; vis.add(nc + ',' + nr); sfx.blip(8); D.send('p', [wc, wr], true); if (wr === 0) g.finish('win');
    },
    signal(d) { if (walker || g.result || cool > 0 || g.c < .3) return; cool = .25; bf = d; bfT = .3; D.send('sig', d); snd(440 + d * 110, .12, 'triangle', .07); },
    act(d) { walker ? g.step(GDX[d], GDY[d]) : g.signal(d); },
    draw(t) {
      duBg(t); const pc2 = walker ? [wc, wr] : [gc, gr];
      for (let r = 0; r < RW; r++) for (let c = 0; c < C; c++) {
        const lit = !walker || vis.has(c + ',' + r), x = GX + c * CS, y = GY + r * CS, here = pc2[0] === c && pc2[1] === r;
        ctx.fillStyle = INK; ctx.fillRect(x - 2, y - 2, CS + 2, CS + 2); ctx.fillStyle = lit ? (here ? '#5a5680' : '#3a3550') : '#15121f'; ctx.fillRect(x, y, CS - 2, CS - 2);
        if (!walker) { if (pit[r][c]) { circ(cx(c), cy(r), 26, '#000', 3); txt('✕', cx(c), cy(r) + 12, 34, RED); } if (r === 0 && c === flag) { ctx.fillStyle = GRN; ctx.fillRect(x, y, CS - 2, CS - 2); star(cx(c), cy(r), 30, 14, 5, now, YEL, 3); } if (r === RW - 1 && c === start[0]) txt('START', cx(c), cy(r) + 30, 16, '#fff'); }
        else if (fellT > 0 && fellAt && fellAt[0] === c && fellAt[1] === r) { circ(cx(c), cy(r), 26, '#000', 3); txt('✕', cx(c), cy(r) + 12, 34, RED); }
      }
      claude(cx(pc2[0]), cy(pc2[1]) + 6, 2.3, { col: walker ? undefined : (D.partner && D.partner.color), mood: duMood(g) });
      if (walker && g.c < 3 && sig < 0) txt('WAIT FOR YOUR GUIDE', 640, 200, 22, '#fff', 'center', 260);
      if (walker && sigT > 0) { txt('GUIDE SAYS', BX, 190, 22, '#fff'); txt(GARW[sig], BX, 270, 100, GRN); }
      if (!walker) txt('SHOW THE WAY', BX, 200, 24, '#fff', 'center', 260);
      if (walker && stun > 0) txt('AAAH!', 280, 56 + 44, 54, RED);
      BTN.forEach(([x, y], d) => { const hot = !walker && bf === d && bfT > 0; circ(x, y, 34, hot ? GRN : '#e8e4f7', 5); txt(GARW[d], x, y + 12, 34, INK); });
      vignette(.22);
    },
    down(p) { let b = -1, bd = 1e9; BTN.forEach((q, d) => { const k = Math.hypot(p.x - q[0], p.y - q[1]); if (k < 52 && k < bd) { bd = k; b = d; } }); if (b >= 0) g.act(b); },
    key(e) {
      if (e.repeat) return; const d = { ArrowLeft: 0, KeyA: 0, ArrowUp: 1, KeyW: 1, ArrowRight: 2, KeyD: 2, ArrowDown: 3, KeyS: 3 }[e.code]; if (d !== undefined) g.act(d);
    },
  };
  g.dbg = { pit, path, flag, start, C, RW, pos: () => walker ? [wc, wr] : [gc, gr] };
  wire(g, D, 0, sp, 'du_guide');
  return g;
}
reg('du_guide', duGuide, 'DARK STEPS'); REGMAP.du_guide.duo = true;

/* ═════════ 8 GUNNER & LOADER: P1 aims and shoots, P2 picks the ammo colour: only the matching colour pops a target ═════════ */
function duGun(sp, D) {
  D = D || SOLO; const R = mkR(), gun = D.role === 0, TS = Math.sqrt(sp), N = 9, NEED = 7, FY = 430, VY = 140, CY = 470, COL = [RED, BLU];
  const cols = [0, 0, 0, 0, 1, 1, 1, 1, R() < .5 ? 0 : 1]; for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
  const tg = cols.map((c, i) => ({ id: i, u: 1 + i * .9 + R() * .3, x: 70 + R() * 660, c, dead: false, esc: false }));
  const ty = T => -30 + (g.c * TS - T.u) * VY, live = T => !T.dead && !T.esc && g.c * TS >= T.u;
  const bullets = [], cxT = track(); let cx = 400, ammo = 0, cd = 0, hp = 3, kills = 0, kx = 0, lastCx = -1, flash = 0;
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: gun ? 'SHOOT!' : 'LOAD!', roleLabel: gun ? 'GUNNER' : 'LOADER',
    hint: gun ? 'MOVE THE MOUSE (OR ◄ ►) TO AIM, CLICK / SPACE TO FIRE - ONLY THE COLOUR YOUR LOADER PICKS POPS A TARGET' : 'PICK THE AMMO COLOUR (CLICK A SIDE, OR KEYS Z / X) THAT MATCHES THE LOWEST TARGET - YOUR GUNNER SHOOTS IT',
    thint: gun ? 'DRAG TO AIM, TAP TO FIRE - ONLY THE COLOUR YOUR LOADER PICKS POPS A TARGET' : 'TAP RED OR BLUE TO LOAD THE COLOUR OF THE LOWEST TARGET - YOUR GUNNER SHOOTS IT',
    update(dt) {
      g.c += dt; cd = Math.max(0, cd - dt); flash = Math.max(0, flash - dt * 3);
      for (const b of bullets) b.y -= 650 * dt; for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].dead || bullets[i].y < -30) bullets.splice(i, 1);
      if (!gun) return;
      if (!g.result) cx = clamp(cx + kx * 520 * dt, 40, 760);
      const r = Math.round(cx); if (r !== lastCx) { lastCx = r; D.send('cx', r, true); }
      for (const b of bullets) for (const T of tg) {
        if (b.dead || !live(T)) continue; const y = ty(T); if (Math.abs(b.x - T.x) < 34 && Math.abs(b.y - y) < 30) {
          b.dead = true;
          if (b.c === T.c) { T.dead = true; kills++; sfx.coin(); burst(T.x, y, COL[T.c], 12); D.send('hit', { id: T.id, n: kills }); } else { sfx.buzz(); floatText('WRONG COLOUR', T.x, y - 40, '#fff', 22); D.send('bad', { id: T.id }); }
        }
      }
      for (const T of tg) if (live(T) && ty(T) > FY) { T.esc = true; hp--; flash = 1; sfx.thud(); shake(7, .2); D.send('esc', { id: T.id, hp }); }
      if (!g.result) { if (kills >= NEED) g.finish('win'); else if (hp <= 0 || g.c >= g.limit) g.finish('lose'); }
    },
    msg(t, d) {
      if (t === 'cx') cxT.push(d); else if (t === 'ammo') ammo = d;
      else if (t === 'shot') bullets.push({ x: d.x, y: CY - 30, c: d.c, dead: false });
      else if (t === 'hit' || t === 'bad') { const T = tg[d.id]; if (!T) return; const y = ty(T), b = bullets.find(q => Math.abs(q.x - T.x) < 40 && Math.abs(q.y - y) < 80); if (b) b.dead = true;
        if (t === 'hit') { T.dead = true; kills = d.n; sfx.coin(); burst(T.x, y, COL[T.c], 12); } else sfx.buzz(); }
      else if (t === 'esc') { const T = tg[d.id]; if (T) T.esc = true; hp = d.hp; flash = 1; sfx.thud(); shake(7, .2); }
    },
    fire() { if (!gun || g.result || cd > 0 || g.c < .2) return; cd = .3; bullets.push({ x: cx, y: CY - 30, c: ammo, dead: false }); D.send('shot', { x: Math.round(cx), c: ammo }); sfx.blip(10); },
    pick(c) { if (gun || g.result) return; ammo = c; D.send('ammo', c, true); sfx.blip(c ? 12 : 6); },
    draw(t) {
      duBg(t); duBar(kills / NEED, `${kills} / ${NEED}`);
      ctx.fillStyle = flash > 0 ? RED : 'rgba(255,255,255,.25)'; ctx.fillRect(-OX, FY + 24, VW, 6);
      for (let i = 0; i < hp; i++) circ(90 + i * 36, 170, 12, PNK, 3);
      for (const T of tg) { if (!live(T)) continue; const y = ty(T); if (y < -30) continue; circ(T.x, y, 24, COL[T.c], 4); ctx.fillStyle = '#fff'; ctx.fillRect(T.x - 10, y - 8, 6, 6); ctx.fillRect(T.x + 4, y - 8, 6, 6); }
      for (const b of bullets) circ(b.x, b.y, 9, COL[b.c], 3);
      const x = gun ? cx : (cxT.at() === null ? 400 : cxT.at()); box(x - 32, CY, 64, 30, '#8d89a8', 4); box(x - 10, CY - 36, 20, 40, COL[ammo], 4);
      if (gun) txt('LOADED: ' + (ammo ? 'BLUE' : 'RED'), 400, 540, 22, '#fff', 'center', 300);
      else { [0, 1].forEach(c => { const bx = c ? 430 : 110; box(bx, 512, 260, 48, COL[c], 4); if (ammo === c) { ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.strokeRect(bx, 512, 260, 48); } txt(c ? 'BLUE' : 'RED', bx + 130, 548, 28, INK); }); }
      vignette(.22);
    },
    move(p) { if (gun && !g.result) cx = clamp(p.x, 40, 760); },
    down(p) { if (gun) { g.move(p); g.fire(); } else g.pick(p.x < 400 ? 0 : 1); },
    key(e) {
      if (gun) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1; else if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp')) g.fire(); }
      else if (e.code === 'KeyZ' || e.code === 'Digit1' || e.code === 'ArrowLeft' || e.code === 'KeyA') g.pick(0); else if (e.code === 'KeyX' || e.code === 'Digit2' || e.code === 'ArrowRight' || e.code === 'KeyD') g.pick(1);
    },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (kx < 0) kx = 0; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (kx > 0) kx = 0; } },
  };
  g.dbg = { tg, ty, live, ammo: () => ammo, cx: () => cx };
  wire(g, D, 0, sp, 'du_gun');
  return g;
}
reg('du_gun', duGun, 'GUNNER & LOADER'); REGMAP.du_gun.duo = true;

})();
