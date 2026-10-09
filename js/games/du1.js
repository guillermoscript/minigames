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
const SOLO = { role: 0, roles: 2, partner: null, seats: [], byRole: [], send() {}, onMsg() {} };   // only used if a DUO game is ever built without a partner
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
  du_steer: [['STEERER', 'DODGE THE ROCKS', 'MOVE LEFT / RIGHT'], ['BOOSTER', 'TAP TO GO FAST', 'TAP FAST']],
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
  du_steer: [
    t => { const x = 260 + 130 * Math.sin(t * 1.8), ry = ((t * 130) % 300) - 40; ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(260, ry, 62, 30, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#8a86a3'; ctx.beginPath(); ctx.ellipse(260, ry - 2, 56, 25, 0, 0, 7); ctx.fill();
      caos(x, 190, 3, {}); txt('◄', 40, 190, 50, '#fff'); txt('►', 480, 190, 50, '#fff'); demoFinger(x, 232, true, 0); },
    t => { const k = (t % .3) / .3, fl = 40 + Math.sin(t * 20) * 8 + 20; ctx.fillStyle = YEL; ctx.beginPath(); ctx.moveTo(244, 150); ctx.lineTo(260, 150 + fl); ctx.lineTo(276, 150); ctx.fill(); caos(260, 110, 3, {});
      box(160, 14, 200, 18, '#3a3550', 3); ctx.fillStyle = ORG; ctx.fillRect(160, 14, 200 * (.3 + .5 * Math.abs(Math.sin(t))), 18); txt('TAP! TAP! TAP!', 260, 236, 30, '#fff'); demoFinger(430, 150, k < .4, k * 2.5); },
  ],
  du_gun: [
    t => { const cx = 260 + 140 * Math.sin(t * 1.6), k = (t % 1.2) / 1.2; circ(cx + 50 * Math.sin(t), 40 + k * 60, 20, RED, 4); box(cx - 28, 196, 56, 26, '#8d89a8', 4); box(cx - 9, 164, 18, 36, RED, 4); if (k > .3 && k < .7) circ(cx, 160 - (k - .3) * 300, 8, RED, 3); demoFinger(cx, 232, k > .3 && k < .45, (k - .3) / .15); },
    t => { const ph = Math.floor(t / 1.3) % 2, p = (t % 1.3) / 1.3; circ(120, 50, 22, RED, 4); circ(400, 90, 22, BLU, 4); [0, 1].forEach(c => { box(c ? 280 : 40, 150, 200, 56, c ? BLU : RED, 4); if (ph === c) { ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.strokeRect(c ? 280 : 40, 150, 200, 56); } txt(c ? 'BLUE' : 'RED', c ? 380 : 140, 190, 28, INK); });
      demoFinger(ph ? 440 : 100, 222, p < .4, p * 2.5); },
  ],
};
function wire(g, D, judge, sp, id) {
  const info = typeof DUINFO[id] === 'function' ? DUINFO[id](D.roles) : DUINFO[id], demos = typeof DEMOS[id] === 'function' ? DEMOS[id](D.roles) : DEMOS[id];   // SQUAD games give a function of the head count (3 or 4)
  g.roles = info.map(([label, short, how], r) => ({ label, short, how, demo: demos[r] }));
  g.role = D.role; g.judge = D.role === judge; g.duoWait = !g.judge; g.limit = g.dur / Math.sqrt(sp) - END_SLACK;
  D.onMsg((t, d, from) => {   // from = the sender's role (SQUAD games: who sent it)
    if (t === 'end') { if (!g.judge && !g.result) { g.result = d === 'win' ? 'win' : 'lose'; (g.result === 'win' ? duWin : duLose)(400, 330); } }
    else if (g.msg) g.msg(t, d, from);
  });
  g.finish = res => { if (g.result) return; g.result = res; D.send('end', res); (res === 'win' ? duWin : duLose)(400, 330); };
}
const rolePick = (D, a, b) => D.role === 0 ? a : b;


/* ───────────── art kit for the four games below (docs/ART-STYLE.md). Everything draws on X: ctx while playing, an offscreen
   context while a background is baked. txt/star/caos/shadow/vignette draw on the global ctx, so they are never used while baking ───────────── */
const TAU = Math.PI * 2;
let X = null;                                                                    // set to ctx at the top of each draw()
const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const rgbC = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixC = (a, b, k) => { const A = rgbC(a), B = rgbC(b); k = clamp(k, 0, 1); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness: never the level's R
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
const pCol = D => (D.partner && D.partner.color) || '#6EA8FE';
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function line(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function arms(u, la, ra, k, col) {                                               // blocky arms with square hands, drawn before caos() at its feet origin
  const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gp = .35 * u;
  const one = (sx, an) => {
    X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
    X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gp - hs - ol, hs + ol * 2, hs + ol * 2);
    X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gp - hs, hs, hs);
    X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gp - hs, hs * .45, hs * .4); X.restore();
  };
  one(-1, la); one(1, ra);
}
function sweat(x, y, s, T) { const k = (T * 2.2) % 1; X.globalAlpha = 1 - k; X.save(); X.translate(x - k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); X.globalAlpha = 1; }
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
function zee(x, y, s, a) { X.globalAlpha = a; X.save(); X.translate(x, y); X.scale(s, s); line([[-6, -6], [6, -6], [-6, 6], [6, 6]], 3, '#fff'); X.restore(); X.globalAlpha = 1; }
function badge(s, x, y, size, bgc, fg, sc, rot) {                                // a feedback word on a slab (pops in with outBack)
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(300, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 300); X.restore();
}
function popDraw(p) {                                                            // p = { s, at, x, y, col, rot }: holds .8 s, fades by 1.05 s; returns p or null
  if (!p) return null; const a = now - p.at; if (a > 1.05) return null;
  X.globalAlpha = clamp(1 - (a - .8) / .25, 0, 1); badge(p.s, p.x, p.y, p.size || 28, p.col, p.fg, a < .25 ? outBack(a / .25) : 1, p.rot || .07); X.globalAlpha = 1; return p;
}
function pill(x, y, label, col, up, size = 15) {                                 // a name tag with a little pointer (down, or up)
  X.font = `700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif`; const w = Math.min(330, X.measureText(t(label)).width + 24), h = size + 11;
  if (up !== null) { const py = up ? -1 : 1; X.beginPath(); X.moveTo(x - 8, y + (h / 2 - 2) * py); X.lineTo(x, y + (h / 2 + 9) * py); X.lineTo(x + 8, y + (h / 2 - 2) * py); X.closePath(); ink(col, 3); }
  rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - h / 2 + 3, w - 12, h * .24, h * .12); X.fill();
  txt(label, x, y + 1, size, INK, 'center', w - 12);
}
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
function plate(b, col, dk, down, lit) {                                          // a chunky control slab with depth; returns how far the face is raised
  const [x, y, w, h] = b, d = down ? 3 : 9;
  rr(x, y + 9, w, h, 20); ink(dk, 4);
  rr(x, y + 9 - d, w, h, 20); ink(col, 0); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 10, y + 13 - d, w - 20, 10, 5); X.fill();
  rr(x, y + 9 - d, w, h, 20); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  if (lit) { X.strokeStyle = '#fff'; X.lineWidth = 4; X.globalAlpha = .6 + .4 * Math.sin(now * 10); rr(x + 7, y + 16 - d, w - 14, h - 14, 15); X.stroke(); X.globalAlpha = 1; }
  return 9 - d;
}
function bake(fn) { const c = document.createElement('canvas'); c.width = W; c.height = H; const old = X; X = c.getContext('2d'); fn(); X = old; return c; }
function sun(sx, sy, T) {                                                        // live: the disc and its slowly turning rays
  X.save(); X.translate(sx, sy); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
  for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, 38); X.lineTo(8, 38); X.lineTo(0, 62); X.fill(); }
  X.restore(); X.beginPath(); X.arc(sx, sy, 28, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(sx - 8, sy - 8, 10, 6, -.6); X.fill();
}
function cloud(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
}
function clouds(T, ys) { cloud(((T * 9 + 380) % 980) - 120, ys[0], .75); cloud(((T * 5 + 40) % 1000) - 140, ys[1], .6); cloud(((T * 7 + 760) % 1000) - 140, ys[2], .55); }
function skyGrad(y1, stops) { const gr = X.createLinearGradient(0, 0, 0, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); X.fillStyle = gr; X.fillRect(0, 0, W, H); }
function tree(x, y, r, dark, foot) {
  rr(x - 7, y, 14, foot - y, 5); ink('#8a5a34', 3);
  const blobs = [[0, 0, r], [-r * .7, r * .25, r * .7], [r * .7, r * .25, r * .72], [0, -r * .55, r * .72]];
  for (const [a, b, c] of blobs) { X.beginPath(); X.arc(x + a, y + b, c, 0, TAU); ink(null, 3.5); }
  for (const [a, b, c] of blobs) { X.beginPath(); X.arc(x + a, y + b, c, 0, TAU); X.fillStyle = dark ? '#2f9a55' : '#3fb260'; X.fill(); }
  for (const [a, b, c] of blobs) { X.beginPath(); X.arc(x + a - c * .2, y + b - c * .25, c * .72, 0, TAU); X.fillStyle = dark ? '#43b366' : '#5bcf72'; X.fill(); }
  X.fillStyle = 'rgba(255,255,255,.28)'; for (const [a, b, c] of blobs.slice(1)) { el(x + a - c * .35, y + b - c * .45, c * .25, c * .14, -.5); X.fill(); }
}
function coin(x, y, r, spin) {                                                   // a gold coin seen spinning
  const sx = Math.max(.18, Math.abs(Math.cos(spin)));
  X.save(); X.translate(x, y); X.scale(sx, 1);
  el(0, 0, r, r); ink('#d9971f', 3.5 / Math.max(sx, .5));
  X.fillStyle = '#FFC93C'; el(-r * .12, -r * .1, r * .86, r * .86); X.fill();
  X.strokeStyle = '#d9971f'; X.lineWidth = 2.5; el(-r * .06, -r * .05, r * .58, r * .58); X.stroke();
  if (sx > .45) { X.fillStyle = '#c7861a'; X.font = `900 ${r * .95}px "Arial Black", Impact, sans-serif`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('$', -r * .04, r * .02); }
  glint(-r * .42, -r * .44, r * .3, r * .16, -.6, .7);
  X.restore();
}
function bomb(x, y, T, s = 1) {                                                  // a cartoon bomb with a cross face and a sparking fuse
  const w = Math.sin(T * 9 + x) * .12;
  X.save(); X.translate(x, y); X.scale(s, s); X.rotate(w);
  rr(-8, -27, 16, 10, 3); ink('#8f9cb3', 3);
  X.strokeStyle = INK; X.lineWidth = 7; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, -27); X.quadraticCurveTo(4, -38, 12, -40); X.stroke(); X.strokeStyle = '#e6c58c'; X.lineWidth = 3; X.stroke();
  cel('#3b3550', '#1f1a2e', () => el(0, 0, 21, 21), -4, -4, 4);
  glint(-8, -9, 6, 3.5, -.6, .55);
  X.strokeStyle = '#fff'; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(-11, -3); X.lineTo(-4, 0); X.moveTo(11, -3); X.lineTo(4, 0); X.stroke();
  X.fillStyle = '#fff'; el(-6, 4, 2.6, 3); X.fill(); el(6, 4, 2.6, 3); X.fill();
  X.strokeStyle = '#fff'; X.lineWidth = 2.5; X.beginPath(); X.arc(0, 15, 5, Math.PI * 1.15, Math.PI * 1.85); X.stroke();
  X.restore();
  star(x + 12 * s, y - 41 * s, (9 + Math.sin(T * 30) * 2.5) * s, 4 * s, 7, T * 8, '#FFB020', 2);
  X.fillStyle = '#fff'; el(x + 12 * s, y - 41 * s, 2.5 * s, 2.5 * s); X.fill();
}
function puffs(x, y, k, n, col, sz = 14) { for (let i = 0; i < n; i++) { el(x + Math.sin(i * 2.1 + 1) * 26 * (1 + k), y - k * 50 - (i % 3) * 8, sz + k * sz, sz * .8 + k * sz * .7); ink(col, 2.5); } }
function woodSign(x0, y0, w, h, T, hangY) {                                      // a hanging wooden board on two strings (sways), returns nothing; caller draws on it
  X.lineCap = 'round'; for (const rx of [x0 + 24, x0 + w - 24]) { X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(rx, hangY); X.lineTo(rx, y0 + 6); X.stroke(); X.strokeStyle = '#e6c58c'; X.lineWidth = 3; X.stroke(); }
  rr(x0, y0 + 5, w, h, 14); ink('#a5622c', 4);
  rr(x0, y0, w, h, 14); ink('#d9944f', 4);
  X.save(); rr(x0, y0, w, h, 14); X.clip(); X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(x0, y0 + 3, w, 6); X.fillStyle = '#c98443'; X.fillRect(x0, y0 + h - 9, w, 2); X.restore();
}
function rainbowRim(x0, y0, w, h, T) { X.globalAlpha = .5 + Math.sin(T * 12) * .3; rr(x0 - 3, y0 - 3, w + 6, h + 6, 16); X.strokeStyle = `hsl(${(T * 400) % 360},100%,65%)`; X.lineWidth = 5; X.stroke(); X.globalAlpha = 1; }

/* ═════════ 1 CATCH & THROW: P1 slides the basket, P2 drops coins (and bombs) from a swinging hand ═════════
   Art: a desert gold mine. The thrower rides an ore bucket along a cable between two timber towers and drops from its hatch;
   the catcher pushes a mine cart along the rails. A buzzard on the right tower watches the coins and flaps at every bomb.
   Win: coins fountain out of the cart. Lose: a wheel pops off and the cart tips over, spilling the coins. */
const CA_RIM = 500, CA_RAIL = 540, CA_CY = x => 118 + 12 * Math.sin(Math.PI * clamp(x / W, 0, 1));
let CA_BG = null, CA_FG = null;
function duCatch(sp, D) {
  D = D || SOLO; const R = mkR();
  const need = Math.round(4 + (sp - 1) * 4), vy = 400 + (sp - 1) * 120, FLOOR = 520, DY = 215, COOL = .42;
  const bombs = Array.from({ length: 80 }, () => R() < .24), dsp = 1.2 + R() * .4, dph = R() * 6.28;
  const handX = c => 400 + 300 * Math.sin(dsp * (.9 + sp * .1) * c + dph);
  const items = [], bxT = track();
  let bx = 400, kx = 0, caught = 0, flash = 0, nid = 0, nIdx = 0, cool = 0, lastBx = -1;
  const catcher = D.role === 0, yOf = it => DY + (g.c - it.t0) * vy;
  // art only (never touches R): outro clock, the last catch / bomb, which side of the cart the catcher pushes from, sign slot pops
  let rT0 = -1, happyAt = -9, hitAt = -9, hitX = 400, dropAt = -9, flapAt = -9, pop = null, side = -1;
  const slotAt = [];
  const boom = (x, was) => { if (was > 0) slotAt[was - 1] = -now; hitAt = now; hitX = x; flapAt = now; pop = { s: 'BOOM!', at: now, x: clamp(x, 130, 670), y: CA_RIM - 96, col: '#ff4d5e' }; };
  const g = {
    c: 0, dur: 14, pts: 0,
    cmd: catcher ? 'CATCH!' : 'THROW!', roleLabel: catcher ? 'CATCHER' : 'THROWER',
    hint: catcher ? 'MOVE THE MOUSE (OR ◄ ►) TO CATCH YOUR PARTNER\'S COINS - AVOID THE BOMBS' : 'CLICK / SPACE TO DROP THE COINS ONTO THE BASKET - NOT THE BOMBS!',
    thint: catcher ? 'DRAG TO CATCH YOUR PARTNER\'S COINS - AVOID THE BOMBS' : 'TAP TO DROP THE COINS ONTO THE BASKET - NOT THE BOMBS!',
    update(dt) {
      g.c += dt; flash = Math.max(0, flash - dt * 4); cool = Math.max(0, cool - dt);
      if (g.result && rT0 < 0) rT0 = now;
      if (catcher) {
        if (!g.result) bx = clamp(bx + kx * 560 * dt, 60, 740);
        const r = Math.round(bx); if (r !== lastBx) { lastBx = r; D.send('bx', r, true); }
        for (const it of items) {
          if (it.got || g.result) continue; const y = yOf(it);
          if (y > FLOOR - 24 && y < FLOOR + 30 && Math.abs(it.x - bx) < 62) {
            it.got = true;
            if (it.b) { boom(it.x, caught); caught = Math.max(0, caught - 1); flash = 1; sfx.buzz(); shake(5, .15); burst(it.x, FLOOR, '#4a4452', 10); burst(it.x, FLOOR, '#ff9a3a', 8); }
            else { caught++; slotAt[caught - 1] = now; happyAt = now; sfx.coin(); burst(it.x, FLOOR, YEL, 8); }
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
        const was = caught; caught = d.n; const it = items.find(q => q.id === d.id);
        if (it) { it.got = true; it.gt = g.c; }
        const x = it ? it.x : 400;
        if (d.b) { sfx.buzz(); flash = 1; boom(x, was); burst(x, FLOOR, '#4a4452', 10); burst(x, FLOOR, '#ff9a3a', 8); } else { slotAt[caught - 1] = now; happyAt = now; sfx.coin(); burst(x, FLOOR, YEL, 8); }
      }
    },
    drop() {
      if (catcher || g.result || cool > 0 || g.c < .1) return;
      cool = COOL; const b = bombs[nIdx++ % bombs.length], it = { id: nid++, x: Math.round(handX(g.c)), b, t0: g.c, got: false };
      items.push(it); D.send('drop', { id: it.id, x: it.x, b: b ? 1 : 0 }); sfx.blip(8); dropAt = now;
    },
    draw() {
      X = ctx; if (!CA_BG) { CA_BG = bake(caBg); CA_FG = bake(caFg); }
      const T = now, res = g.result, rT = rT0 < 0 ? 0 : now - rT0, won = res === 'win', lost = res === 'lose';
      X.drawImage(CA_BG, 0, 0);
      sun(150, 206, T); clouds(T, [176, 204, 150]);
      X.drawImage(CA_FG, 0, 0);                                                  // the towers and the cable go in front of the clouds
      // a tumbleweed rolls along the horizon now and then
      { const k = (T * 70) % 1500 - 260, y = 398 - Math.abs(Math.sin(T * 5)) * 12; if (k > -60 && k < W + 60) { X.save(); X.translate(k, y); X.rotate(T * 5);
        el(0, 0, 17, 17); ink('#e2b46a', 3, '#9a6a34'); X.strokeStyle = '#9a6a34'; X.lineWidth = 2; for (let i = 0; i < 5; i++) { X.beginPath(); X.arc(i * 2 - 4, i - 2, 6 + i * 2, i, i + 3.4); X.stroke(); } X.restore(); } }
      caBuzzard(T, items, yOf, flapAt, res, rT);
      caSign(T, caught, need, slotAt, res);
      // shadows of what is falling, on the rail bed (they firm up as things come down)
      for (const it of items) { if (it.got) continue; const y = yOf(it); if (y < DY || y > CA_RAIL - 6) continue; const k = clamp((y - DY) / (CA_RIM - DY), 0, 1); shadow(it.x, CA_RAIL + 4, 8 + 14 * k, 3 + 3 * k, .08 + .2 * k); }
      // the ore bucket on the cable, with the thrower in it
      const hX = handX(g.c), hv = (hX - handX(g.c - .05)) / .05, sw = clamp(-hv / 2600, -.16, .16) + Math.sin(T * 2.3) * .02, cy = CA_CY(hX);
      const thCol = catcher ? pCol(D) : myCol(), dropK = clamp((T - dropAt) / .25, 0, 1);
      X.save(); X.translate(hX, cy);
      el(0, -3, 9, 9); ink('#8f9cb3', 3); X.fillStyle = INK; el(0, -3, 3, 3); X.fill();
      X.rotate(sw);
      rr(-4, 2, 8, 16, 3); ink('#6b7690', 2.5);
      for (const s of [-1, 1]) line([[0, 14], [s * 27, 50]], 2.5, '#e6c58c');
      X.save(); X.translate(0, 60 - (won ? Math.abs(Math.sin(rT * 9)) * 8 : 0));
      if (won) arms(3.4, -.35 + Math.sin(rT * 14) * .2, .35 - Math.sin(rT * 14) * .2, 1, thCol);
      caos(0, 0, 3.4, { col: thCol, mood: won || dropK < 1 ? 'happy' : lost ? 'sad' : null });
      X.restore();
      const bucket = () => { X.beginPath(); X.moveTo(-31, 50); X.lineTo(31, 50); X.lineTo(25, 84); X.lineTo(-25, 84); X.closePath(); };
      cel('#8f9cb3', '#6b7690', bucket, -5, -4, 4);
      X.fillStyle = 'rgba(20,16,28,.25)'; X.fillRect(-29, 66, 58, 4); X.fillStyle = '#c9ced6'; for (const rx of [-22, -8, 8, 22]) { el(rx * (1 - .1), 59, 2.2, 2.2); X.fill(); }
      rr(-34, 46, 68, 8, 4); ink('#c9ced6', 3);
      if (!won) { for (const s of [-1, 1]) { rr(s * 22 - 5, 42, 10, 9, 2); ink(thCol, 2.5); } }   // hands on the rim
      rr(-12, 82 + dropK * 0, 24, 5, 2); ink(dropK < 1 ? '#3b3550' : '#6b7690', 2);   // the hatch
      tagC(0, 67, catcher ? 'FRIEND' : 'YOU', thCol, 11);
      if (!catcher && !res) { if (bombs[nIdx % bombs.length]) bomb(0, 112, T, .6); else coin(0, 102, 13, T * 3); }   // only the thrower sees what is in the hatch
      X.restore();
      // the mine cart and the catcher pushing it
      const cx = catcher ? bx : (bxT.at() === null ? 400 : bxT.at());
      if (side < 0 && cx < 160) side = 1; else if (side > 0 && cx > 640) side = -1;
      const caCol = catcher ? myCol() : pCol(D), soot = clamp(1 - (T - hitAt) / .8, 0, 1), jump = T - hitAt < .3 ? Math.sin((T - hitAt) / .3 * Math.PI) * 12 : 0;
      const danger = !res && items.some(it => it.b && !it.got && Math.abs(it.x - cx) < 100 && yOf(it) > 300 && yOf(it) < CA_RIM + 20);
      const px = cx + side * 100, hop = won ? Math.abs(Math.sin(rT * 9)) * 16 : (T - happyAt < .25 ? Math.sin((T - happyAt) / .25 * Math.PI) * 6 : 0);
      shadow(px, CA_RAIL + 1, 24, 5, .25);
      X.save(); X.translate(px, CA_RAIL - 1 - hop);
      if (won) arms(4.2, -.35 + Math.sin(rT * 14) * .15, .35 - Math.sin(rT * 14) * .15, 1, caCol);
      else if (lost) arms(4.2, -2.7, 2.7, .9, caCol);
      else arms(4.2, side * -1.3, side * -1.2, 1, caCol);
      caos(0, 0, 4.2, { col: soot > .3 ? mixC(caCol, '#4a4452', soot) : caCol, mood: won || T - happyAt < .35 ? 'happy' : lost || soot > .3 ? 'sad' : null });
      X.restore();
      if (danger || lost) sweat(px - 24, CA_RAIL - 40 - hop, 1, T);
      const front = cx > 560 ? -1 : cx < 240 ? 1 : -side, tip = lost ? ease((rT - .08) / .35) : 0, wheelOff = lost ? clamp((rT - .05) / .8, 0, 1) : 0;
      shadow(cx, CA_RAIL + 2, 64, 6, .25);
      X.save(); X.translate(cx, CA_RIM - jump);
      if (tip) { X.translate(-front * 32, 29); X.rotate(front * .32 * tip); X.translate(front * 32, -29); }
      const n = won ? Math.min(need, 8) : Math.min(caught, 8), spill = lost ? Math.floor(clamp(rT / .25, 0, 3)) : 0;
      for (let i = spill; i < n; i++) { const row = i < 5 ? 0 : 1, j = row ? i - 5 : i, cnt = row ? 3 : 5; coin((j - (cnt - 1) / 2) * 22, -4 - row * 11 + (j % 2) * 2, 12, .3 + i * .7); }
      const steel = flash > 0 ? mixC('#8f9cb3', '#ff4d5e', flash) : mixC('#8f9cb3', '#4a4452', soot);
      const body = () => { X.beginPath(); X.moveTo(-62, 0); X.lineTo(62, 0); X.lineTo(52, 27); X.lineTo(-52, 27); X.closePath(); };
      cel(steel, mixC('#6b7690', '#2b2438', soot), body, -6, -5, 4);
      X.save(); body(); X.clip(); X.fillStyle = 'rgba(20,16,28,.22)'; X.fillRect(-70, 9, 140, 4); X.fillStyle = '#c9ced6'; for (let i = -2; i <= 2; i++) { el(i * 24, 19, 2.2, 2.2); X.fill(); } X.restore();
      rr(-66, -5, 132, 9, 4); ink('#c9ced6', 3);
      line([[side * 62, 1], [side * 84, -8]], 4, '#a5622c');
      tagC(0, 15, catcher ? 'YOU' : 'FRIEND', caCol);
      for (const s of [-1, 1]) { if (wheelOff && s === front) continue; caWheel(s * 32, 29, cx / 11); }
      X.restore();
      if (wheelOff) { const k = wheelOff; caWheel(cx + front * (32 + k * 210), CA_RIM + 29 - Math.abs(Math.sin(k * 9)) * 22 * (1 - k), k * 14); }
      if (spill) for (let i = 0; i < spill; i++) { const a = clamp((rT - i * .08) / .6, 0, 1); coin(cx + front * (60 + a * (90 + i * 40)), CA_RIM - 10 - Math.sin(a * Math.PI) * 50 + a * 40, 12, a * 12 + i); }
      if (soot > 0) { X.globalAlpha = soot; puffs(hitX, CA_RIM - 16, 1 - soot, 5, '#5a5468'); X.globalAlpha = 1; if (soot > .6) star(hitX, CA_RIM - 6, 46 * soot, 22 * soot, 10, T * 2, '#ff9a3a', 3); }
      if (won) for (let i = 0; i < 10; i++) {                                   // the coin fountain: low and wide, so it reads beside the stamp
        const a = rT * 1.25 - i * .05; if (a <= 0 || a > 1) continue;
        const vx = (i % 2 ? 1 : -1) * (170 + (i * 53) % 160), h = 70 + (i * 29) % 50;
        coin(cx + vx * a, CA_RIM - 10 - h * 4 * a * (1 - a) + a * (CA_RAIL - CA_RIM - 6), 14, a * 14 + i);
      }
      // what is falling, on top of everything; what missed puffs up from the rail bed
      for (const it of items) {
        if (it.got) continue; const y = yOf(it); if (y < -40) continue;
        if (y > CA_RAIL - 6) { const k = clamp((y - CA_RAIL + 6) / 76, 0, 1); X.globalAlpha = 1 - k; puffs(it.x, CA_RAIL - 4, k, 3, it.b ? '#8a8496' : '#f2d9a8', 10); X.globalAlpha = 1; continue; }
        it.b ? bomb(it.x, y, T) : coin(it.x, y, 22, T * 6 + it.id);
      }
      pop = popDraw(pop);
      if (!catcher && !res) {                                                   // the thrower's button, riding beside the bucket
        const ready = cool <= 0, bx2 = hX + (hX > 560 ? -86 : 86), by = cy + 62;
        X.globalAlpha = ready ? 1 : .45; pill(bx2, by + (ready ? Math.sin(T * 8) * 2 : 0), TOUCH ? 'TAP!' : 'SPACE!', '#FFE14D', null, 16); X.globalAlpha = 1;
      }
      vignette(.16);
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
function tagC(x, y, label, col, size = 12) {                                     // a small round label stuck on a prop
  X.font = `700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif`; const w = Math.min(90, X.measureText(t(label)).width + 16), h = size + 8;
  rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 2.5); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 5, y - h / 2 + 3, w - 10, 3, 1.5); X.fill();
  txt(label, x, y + 1, size, INK, 'center', w - 8);
}
function caWheel(x, y, a) { X.beginPath(); X.arc(x, y, 11, 0, TAU); ink('#3b3550', 3); X.save(); X.translate(x, y); X.rotate(a); X.strokeStyle = '#8f9cb3'; X.lineWidth = 2.5; X.beginPath(); X.moveTo(-8, 0); X.lineTo(8, 0); X.moveTo(0, -8); X.lineTo(0, 8); X.stroke(); X.restore(); X.beginPath(); X.arc(x, y, 3.5, 0, TAU); ink('#c9ced6', 1.5); }
/* the sign hanging under the hint: one slot per coin needed, and the count */
function caSign(T, n, need, slotAt, res) {
  const pitch = 24, w = need * pitch + 74, x0 = 400 - w / 2, y0 = 70, h = 38;
  X.save(); X.translate(400, 58); X.rotate(Math.sin(T * 1.3) * .012); X.translate(-400, -58);
  woodSign(x0, y0, w, h, T, 58);
  for (let i = 0; i < need; i++) {
    const px = x0 + 22 + i * pitch, py = y0 + h / 2, at = slotAt[i], full = i < n || res === 'win';
    X.beginPath(); X.arc(px, py, 10, 0, TAU); ink(res === 'lose' ? '#b9a88c' : '#f1e3c8', 2.5);
    if (full) { const k = at > 0 && i < n ? outBack((T - at) / .3) : 1; X.save(); X.translate(px, py); X.scale(k, k); coin(0, 0, 9, res === 'win' ? T * 8 + i : 0); X.restore(); }
    else if (at < 0 && T + at < .3) { X.globalAlpha = 1 - (T + at) / .3; coin(px, py - (T + at) * 60, 9 * (1 + (T + at) * 3), 0); X.globalAlpha = 1; }
  }
  txt(`${n}/${need}`, x0 + w - 28, y0 + h / 2 + 2, 18, res === 'lose' ? '#ff8a96' : n >= need ? '#5CFF7A' : '#fff', 'center', 48);
  if (res === 'win') rainbowRim(x0, y0, w, h, T);
  X.restore();
}
/* the buzzard on the right tower: looks at the lowest coin, flaps at every bomb, claps on a win, cackles on a lose */
function caBuzzard(T, items, yOf, flapAt, res, rT) {
  const x = 772, y = 92; let look = -1; { let best = -1; for (const it of items) { if (it.b || it.got) continue; const yy = yOf(it); if (yy > best && yy < CA_RAIL) { best = yy; look = clamp((it.x - x) / 200, -1, 1); } } }
  const fly = res === 'win' ? Math.abs(Math.sin(rT * 10)) * .8 : clamp(1 - (T - flapAt) / .6, 0, 1), cack = res === 'lose' ? Math.abs(Math.sin(rT * 18)) * 4 : 0;
  X.save(); X.translate(x, y - fly * 10); X.scale(look > .2 ? 1 : -1, 1);
  line([[-4, 12], [-4, 18]], 2.5, '#ffb84d'); line([[5, 12], [5, 18]], 2.5, '#ffb84d');
  X.beginPath(); X.moveTo(-12, 4); X.lineTo(-28, 0); X.lineTo(-22, 12); X.closePath(); ink('#5a3b2e', 3);
  cel('#7a5040', '#5a3b2e', () => el(0, 4, 17, 13), -4, -4, 3.5);
  const wf = fly ? Math.sin(T * 40) : 0; X.save(); X.translate(-2, 0); X.rotate(-.3 - wf * .9 - fly * .5); el(-4, 0, 15, 7); ink('#5a3b2e', 3); X.restore();
  rr(-6, -6, 16, 7, 3.5); ink('#f2e3c8', 2.5);                                     // the feather collar
  X.save(); X.translate(10, -14 - cack); el(0, 0, 8, 8); ink('#e8a0a0', 3);
  X.beginPath(); X.moveTo(5, -2); X.quadraticCurveTo(15, -1, 13, 6); X.lineTo(6, 3); X.closePath(); ink('#ffd23f', 2);
  X.fillStyle = '#fff'; el(1, -2, 3.2, 3.4); X.fill(); X.fillStyle = INK; el(2, -1.5, 1.7, 2); X.fill();
  X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(-3, -6); X.lineTo(4, -5 - (res === 'lose' ? 2 : 0)); X.stroke();
  X.restore(); X.restore();
}
/* the baked mine: sky, mesas with a mine entrance, a sandy yard with cacti, and the rail track along the bottom */
function caBg() {
  skyGrad(400, ['#3fb0ff', '#8fdcff', '#fff0cf']);
  const mesa = (x0, x1, top, fill, ol, w) => { X.beginPath(); X.moveTo(x0, 401); X.lineTo(x0 + 18, top + 14); X.lineTo(x0 + 34, top); X.lineTo(x1 - 30, top); X.lineTo(x1 - 16, top + 16); X.lineTo(x1, 401); X.closePath(); X.fillStyle = fill; X.fill(); X.strokeStyle = ol; X.lineWidth = w; X.stroke(); };
  mesa(-40, 250, 292, '#f6cfa3', '#e0a874', 3); mesa(500, 860, 280, '#f6cfa3', '#e0a874', 3);
  mesa(150, 390, 318, '#e8a46a', '#b8653a', 3.5);
  X.save(); X.beginPath(); X.rect(150, 318, 240, 84); X.clip(); X.fillStyle = 'rgba(184,101,58,.35)'; for (const yy of [338, 358, 378]) X.fillRect(150, yy, 240, 5); X.restore();
  // the mine entrance: a timber frame round a dark hole, a lantern by it
  X.beginPath(); X.moveTo(240, 401); X.lineTo(240, 362); X.arc(272, 362, 32, Math.PI, 0); X.lineTo(304, 401); X.closePath(); ink('#2b2033', 3.5);
  rr(234, 352, 12, 50, 3); ink('#a5622c', 3); rr(298, 352, 12, 50, 3); ink('#a5622c', 3); rr(228, 342, 88, 12, 4); ink('#d9944f', 3);
  rr(326, 370, 12, 16, 4); ink('#fff3a0', 2.5);
  // the yard
  let gr = X.createLinearGradient(0, 400, 0, 600); gr.addColorStop(0, '#f4d29a'); gr.addColorStop(1, '#e0ab66'); X.fillStyle = gr; X.fillRect(0, 400, W, 200);
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -4; i < 12; i++) { X.beginPath(); X.moveTo(i * 90, 600); X.lineTo(i * 90 + 45, 600); X.lineTo(i * 90 + 145, 402); X.lineTo(i * 90 + 100, 402); X.fill(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 400); X.lineTo(W, 400); X.stroke();
  for (let i = 0; i < 16; i++) { const px = hsh(i) * W, py = 420 + hsh(i + 40) * 100; el(px, py, 5 + hsh(i + 9) * 5, 3 + hsh(i + 3) * 2); ink('#d9a36a', 2, '#a87440'); }
  const cactus = (x, y, s) => { X.save(); X.translate(x, y); X.scale(s, s);
    for (const [a, b, w2, h2] of [[-22, -52, 12, 30], [14, -64, 12, 34], [-7, -86, 16, 88]]) { rr(a, b, w2, h2, w2 / 2); ink('#5fb944', 3, '#2f7a49'); }
    rr(-22, -30, 20, 10, 5); ink('#5fb944', 3, '#2f7a49'); rr(4, -38, 20, 10, 5); ink('#5fb944', 3, '#2f7a49');
    X.fillStyle = 'rgba(255,255,255,.3)'; rr(-4, -82, 4, 70, 2); X.fill(); el(-1, -92, 7, 5); ink('#ff5c8a', 2); X.restore(); };
  cactus(100, 404, .8); cactus(640, 412, .9); cactus(470, 406, .55);
  // the rail track
  for (let x = -12; x < W + 20; x += 36) { rr(x, 543, 24, 12, 3); ink('#a5622c', 2.5); }
  rr(-10, 538, W + 20, 6, 3); ink('#c9ced6', 2.5);
}
/* the two timber towers and the cable between them (in front of the clouds) */
function caFg() {
  for (const tx of [24, 776]) {
    for (const s of [-1, 1]) line([[tx + s * 16, 402], [tx + s * 7, 116]], 5, '#d9944f');
    for (let y = 150; y < 400; y += 60) line([[tx - 14, y], [tx + 13, y + 46]], 3, '#a5622c');
    rr(tx - 22, 108, 44, 10, 3); ink('#d9944f', 3);
    X.beginPath(); X.arc(tx, 102, 7, 0, TAU); ink('#8f9cb3', 2.5);
  }
  X.lineCap = 'round'; X.beginPath(); for (let x = 24; x <= 776; x += 8) x === 24 ? X.moveTo(x, CA_CY(x)) : X.lineTo(x, CA_CY(x)); X.strokeStyle = INK; X.lineWidth = 5; X.stroke(); X.strokeStyle = '#6b7690'; X.lineWidth = 2; X.stroke();
}
reg('du_catch', duCatch, 'CATCH & THROW'); REGMAP.du_catch.duo = true;


/* ═════════ 2 DECODE: P1 reads a numeric code and points at the matching symbols, P2 presses what flashes ═════════
   Art: a bank vault. The six pads are big arcade buttons on a steel console; the reader has the code on cards pinned to a
   corkboard, the typist a row of lamps on a steel plaque. A guard dog sleeps on its rug and jumps up at every slip.
   Win: the vault door swings open on a pile of gold. Lose: the door lamp flashes red and the dog barks. */
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
const DC_VX = 722, DC_VY = 166, DC_VR = 70;
let DC_BG = null;
function duDecode(sp, D) {
  D = D || SOLO; const R = mkR(), reader = D.role === 0, n = 4 + (sp > 1.3 ? 1 : 0);
  const code = Array.from({ length: n }, () => Math.floor(R() * 6)), shuf = () => { const a = [0, 1, 2, 3, 4, 5]; for (let i = 5; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const permT = shuf(), permR = shuf(), perm = reader ? permR : permT;            // pad slot -> symbol; each role gets its own layout
  const pings = [];                                                              // typist: { s, c } flashes sent by the reader
  let at = 0, wrong = -1, wrongT = 0, lastPing = -9, pingGlow = -1, pingT = 0;
  let rT0 = -1, okAt = -9, badAt = -9, pop = null;                               // art only: outro clock, the last good / bad press
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: reader ? 'READ!' : 'TYPE!', roleLabel: reader ? 'READER' : 'TYPIST',
    hint: reader ? 'FIND EACH NUMBER OF THE CODE ON THE PADS AND TAP THEM IN ORDER - YOUR PARTNER SEES THEM FLASH' : 'PRESS THE PADS THAT FLASH, IN ORDER (CLICK OR KEYS 1-6) - IF YOU SLIP, THE CODE STARTS OVER',
    thint: reader ? 'TAP THE PADS FOR EACH NUMBER, IN ORDER - YOUR PARTNER SEES THEM FLASH' : 'TAP THE PADS THAT FLASH, IN ORDER - IF YOU SLIP, THE CODE STARTS OVER',
    update(dt) {
      g.c += dt; wrongT = Math.max(0, wrongT - dt); pingT = Math.max(0, pingT - dt);
      if (g.result && rT0 < 0) rT0 = now;
      if (!reader && !g.result && g.c >= g.limit) g.finish('lose');
    },
    msg(t, d) {
      if (t === 'sym' && !reader) { pings.push({ s: d, c: g.c }); snd(330 + d * 90, .2, 'triangle', .07); }
      else if (t === 'press' && reader) { at = d.at; if (!d.ok) { wrongT = .5; sfx.miss(); badAt = now; pop = { s: 'WOOF!', at: now, x: 742, y: 452, size: 22, col: '#ff4d5e', rot: -.08 }; } else { snd(330 + d.s * 90, .15, 'triangle', .06); okAt = now; } }
    },
    ping(s) {
      if (!reader || g.result || g.c - lastPing < .22) return; lastPing = g.c; pingGlow = s; pingT = .2; D.send('sym', s); snd(330 + s * 90, .15, 'triangle', .06);
    },
    press(s) {
      if (reader || g.result || g.c < .15) return;
      if (s === code[at]) { at++; okAt = now; snd(330 + s * 90, .2, 'triangle', .08); D.send('press', { at, ok: 1, s }); if (at === n) { g.finish('win'); floatText('DECODED!', 400, 190, YEL, 50); } }
      else { at = 0; wrong = s; wrongT = .5; badAt = now; pop = { s: 'WOOF!', at: now, x: 742, y: 452, size: 22, col: '#ff4d5e', rot: -.08 }; sfx.miss(); shake(4, .1); D.send('press', { at: 0, ok: 0, s }); }
    },
    draw() {
      X = ctx; if (!DC_BG) DC_BG = bake(dcBg); X.drawImage(DC_BG, 0, 0);
      const T = now, res = g.result, rT = rT0 < 0 ? 0 : now - rT0, won = res === 'win', lost = res === 'lose';
      dcVault(T, res, rT, wrongT, at, n);
      dcDog(T, res, rT, T - badAt);
      // the code: cards on the corkboard (reader) or lamps on a steel plaque (typist); the next one to enter is ringed
      const cx = i => 400 + (i - (n - 1) / 2) * 82;
      if (reader) {
        rr(170, 150, 460, 92, 12); ink('#a5622c', 4); rr(180, 159, 440, 74, 7); ink('#d9a86a', 0);
        X.fillStyle = 'rgba(165,98,44,.35)'; for (let i = 0; i < 26; i++) { el(190 + hsh(i) * 420, 166 + hsh(i + 7) * 60, 1.6, 1.6); X.fill(); }
        for (let i = 0; i < n; i++) {
          const x = cx(i), done = i < at || won, rot = (hsh(i + 3) - .5) * .12, nx = i === at && !res;
          X.save(); X.translate(x, 198 - (nx ? 3 + Math.sin(T * 6) * 2 : 0)); X.rotate(rot);
          rr(-27, -32, 54, 64, 6); ink(done ? '#c8f5c0' : '#fffaf0', nx ? 4 : 3, nx ? '#ff9a3a' : INK);
          X.fillStyle = 'rgba(110,168,254,.35)'; for (const ly of [-14, 0, 14]) X.fillRect(-22, ly + 6, 44, 2);
          txt(String(code[i] + 1), 0, 4, 40, INK);
          el(0, -27, 6, 6); ink('#ff5d5d', 2); glint(-2, -29, 2, 1.4, 0, .7);
          if (done) { el(17, 22, 12, 12); ink('#5CFF7A', 2.5); line([[11, 22], [15, 27], [23, 16]], 3, '#fff'); }
          X.restore();
        }
      } else {
        rr(170, 152, 460, 88, 16); ink('#c9ced6', 4); X.fillStyle = 'rgba(20,16,28,.18)'; rr(176, 226, 448, 8, 4); X.fill();
        for (const [a, b] of [[184, 164], [616, 164], [184, 228], [616, 228]]) { el(a, b, 3, 3); ink('#8f9cb3', 1.5); }
        for (let i = 0; i < n; i++) {
          const x = cx(i), done = i < at || won, bad = wrongT > 0 && !done, on = done || bad;
          el(x, 196, 28, 28); ink('#3b3550', 3.5);
          el(x, 196, 21, 21); ink(done ? '#5CFF7A' : bad ? '#ff4d5e' : lost ? '#5a3040' : '#4a4562', 0);
          if (on) { X.globalAlpha = .35 + Math.sin(T * 10) * .1; el(x, 196, 30, 30); X.fillStyle = done ? '#b8ffc6' : '#ffb3bb'; X.fill(); X.globalAlpha = 1; }
          glint(x - 7, 188, 7, 4, -.5, .55);
          if (i === at && !res && !bad) { X.strokeStyle = '#FFE14D'; X.lineWidth = 3; X.globalAlpha = .5 + Math.sin(T * 6) * .4; el(x, 196, 31, 31); X.stroke(); X.globalAlpha = 1; }
        }
      }
      if (!res) pill(400, 150, reader ? 'YOUR PARTNER ENTERS WHAT YOU POINT AT' : 'WAIT FOR THE FLASHES', reader ? '#FFE14D' : '#9fe3ff', null, 14);
      if (!reader && !g.result) { while (pings.length && g.c - pings[0].c > 1.4) pings.shift(); }
      // the six arcade buttons
      perm.forEach((s, k) => {
        const [x, y] = SLOTS[k], glow = reader ? (pingGlow === s && pingT > 0) : pings.some(p => p.s === s && g.c - p.c < .7), bad = !reader && wrong === s && wrongT > 0;
        dcPad(x, y, s, glow, bad, lost, T);
        if (reader) { el(x + 48, y - 44, 15, 15); ink('#FFE14D', 3); txt(String(s + 1), x + 48, y - 43, 20, INK); }
        else if (!TOUCH) keyCap(x - 48, y - 44, String(k + 1));
      });
      // Caos at the console
      const col = myCol(), ok = T - okAt < .35, slip = T - badAt < .5, hop = won ? Math.abs(Math.sin(rT * 9)) * 16 : ok ? Math.sin((T - okAt) / .35 * Math.PI) * 5 : 0;
      shadow(58, 541, 30, 6, .25);
      X.save(); X.translate(58, 539 - hop);
      if (won) arms(4.4, -.35 + Math.sin(rT * 14) * .15, .35 - Math.sin(rT * 14) * .15, 1, col);
      else if (lost || slip) arms(4.4, -2.7, 2.7, .9, col);
      else arms(4.4, -.25, 1.05 + Math.sin(T * 3) * .08, 1, col);
      caos(0, 0, 4.4, { col, mood: won || ok ? 'happy' : lost || slip ? 'sad' : null });
      X.restore();
      if (lost || slip) sweat(34, 500 - hop, 1, T);
      pill(58, 474 - hop, 'YOU', col, false, 14);
      pop = popDraw(pop);
      vignette(.16);
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
/* one arcade button: a dark housing, a coloured cap that sinks when it flashes, the symbol on top */
function dcPad(x, y, s, glow, bad, dim, T) {
  const col = bad ? '#ff4d5e' : dim ? mixC(SYMC[s], '#8f88a6', .5) : SYMC[s], d = glow || bad ? 2 : 9;
  el(x, y + 8, 58, 50); ink(mixC(col, INK, .45), 4);
  el(x, y + 8 - d, 58, 50); ink(glow ? mixC(col, '#ffffff', .45) : col, 4);
  X.save(); el(x, y + 8 - d, 58, 50); X.clip(); X.fillStyle = 'rgba(20,16,28,.16)'; el(x + 10, y + 16 - d, 58, 50); X.fill(); X.restore();
  glint(x - 26, y - 22 - d, 15, 7, -.5, .5);
  if (glow) { X.globalAlpha = .7; X.strokeStyle = '#fff'; X.lineWidth = 5; el(x, y + 8 - d, 66, 58); X.stroke(); X.globalAlpha = 1; }
  drawSym(s, x, y + 6 - d, 24);
}
/* the vault door: bolts round a turning wheel and a status lamp; it swings open on its right hinge on a win */
function dcVault(T, res, rT, wrongT, at, n) {
  const k = res === 'win' ? ease(rT / .45) : 0;
  if (k > 0) {                                                                    // what is behind it: stacked gold, twinkling
    el(DC_VX, DC_VY, DC_VR - 4, DC_VR - 4); ink('#2b2438', 0);
    X.save(); el(DC_VX, DC_VY, DC_VR - 6, DC_VR - 6); X.clip();
    for (let r = 0; r < 4; r++) for (let i = 0; i < 5 - r; i++) { const bx = DC_VX - 50 + i * 22 + r * 11, by = DC_VY + 46 - r * 16; rr(bx, by, 20, 14, 3); ink('#FFC93C', 2.5); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(bx + 3, by + 3, 10, 3); }
    X.restore();
    for (let i = 0; i < 4; i++) { const a = (T * 2 + i * .7) % 1; star(DC_VX - 40 + i * 26, DC_VY + 10 - i % 2 * 30, 9 * Math.sin(a * Math.PI), 3, 4, 0, '#fff', 2); }
  }
  const sx = 1 - k * .82, cx = DC_VX + DC_VR - DC_VR * sx;
  X.save(); X.translate(cx, DC_VY); X.scale(sx, 1);
  cel('#c9ced6', '#8f9cb3', () => el(0, 0, DC_VR, DC_VR), 6, 6, 4);
  el(0, 0, DC_VR - 16, DC_VR - 16); ink(null, 2); X.strokeStyle = '#a7b0c0'; X.lineWidth = 3; X.stroke();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + .2; el(Math.cos(a) * (DC_VR - 8), Math.sin(a) * (DC_VR - 8), 4.5, 4.5); ink('#e6eaf0', 1.5); }
  glint(-30, -36, 18, 8, -.6, .45);
  const spin = res === 'win' ? rT * 14 : at * .6 + Math.sin(T * 1.2) * .05;
  X.save(); X.rotate(spin); for (let i = 0; i < 3; i++) { X.rotate(TAU / 3); line([[0, 0], [0, -32]], 5, '#8f9cb3'); el(0, -34, 6, 6); ink('#ffd23f', 2); } X.restore();
  el(0, 0, 11, 11); ink('#ffd23f', 3);
  const lamp = res === 'win' ? '#5CFF7A' : (res === 'lose' || wrongT > 0) ? (Math.sin(T * 24) > 0 ? '#ff4d5e' : '#7a2030') : (Math.sin(T * 4) > 0 ? '#ffd23f' : '#c99512');
  el(0, -48, 7, 7); ink(lamp, 2.5);
  X.restore();
}
/* the guard dog on its rug: asleep (Zs), jumps up at a slip, barks on a lose, wags on a win */
function dcDog(T, res, rT, sinceBad) {
  const awake = res === 'lose' || sinceBad < .9, won = res === 'win', x = 742, y = 528;
  const bark = res === 'lose' ? Math.abs(Math.sin(rT * 16)) : sinceBad < .9 ? Math.abs(Math.sin(sinceBad * 16)) * (1 - sinceBad / .9) : 0;
  const up = awake ? 1 : won ? .7 : 0, brth = Math.sin(T * 2.4) * 2;
  X.save(); X.translate(x, y);
  const wag = won ? Math.sin(T * 26) * .5 : awake ? Math.sin(T * 14) * .2 : 0;
  X.save(); X.translate(30, -8); X.rotate(-.6 + wag); rr(-4, -22, 8, 24, 4); ink('#c98443', 3); X.restore();          // tail
  cel('#e0a868', '#c98443', () => el(4, -12 - brth * .3, 34, 16 + brth * .2), -4, -4, 4);                      // body
  X.fillStyle = '#fff3dd'; el(12, -6, 14, 7); X.fill();
  const hx = -26, hy = -14 - up * 22;
  cel('#e0a868', '#c98443', () => el(hx, hy, 18, 15), -3, -3, 4);                                                // head
  X.save(); X.translate(hx - 13, hy - 6); X.rotate(.5 - up * .3 + bark * .3); el(0, 8, 6, 12); ink('#8a5a34', 3); X.restore();
  X.save(); X.translate(hx + 11, hy - 8); X.rotate(-.4 + up * .2 - bark * .3); el(0, 8, 6, 12); ink('#8a5a34', 3); X.restore();
  el(hx - 16, hy + 5, 9, 7); ink('#fff3dd', 3); el(hx - 21, hy + 2, 3.5, 3); X.fillStyle = INK; X.fill();
  if (awake || won) { for (const ex of [hx - 8, hx + 4]) { el(ex, hy - 3, 4, 4.5); ink('#fff', 1.5); X.fillStyle = INK; el(ex - 1, hy - 2, 2.2, 2.6); X.fill(); } }
  else { X.strokeStyle = INK; X.lineWidth = 2.5; for (const ex of [hx - 8, hx + 4]) { X.beginPath(); X.arc(ex, hy - 3, 4, .2, Math.PI - .2); X.stroke(); } }
  if (bark > .3) { el(hx - 14, hy + 12, 6, 4 + bark * 4); ink('#7a2030', 2); }
  el(-12, -2, 9, 5); ink('#e0a868', 2.5); el(-30 + up * 4, -2, 9, 5); ink('#e0a868', 2.5);                     // paws
  rr(hx - 12, hy + 9, 24, 6, 3); ink('#ff4d5e', 2); el(hx, hy + 17, 3, 3); ink('#ffd23f', 1.5);                 // collar + tag
  X.restore();
  if (!awake && !won) for (let i = 0; i < 2; i++) { const a = (T * .6 + i * .5) % 1; zee(x - 20 + a * 20, y - 44 - a * 40, .6 + a * .5, 1 - a); }
  if (won) for (let i = 0; i < 3; i++) { const a = (rT * 1.4 + i * .33) % 1; heart(x - 40 + i * 18, y - 60 - a * 50, .6, 1); }
}
/* the baked vault room: warm wall with panels, a piggy-bank painting, the dark recess the vault door sits in, a marble floor, the steel console and the dog's rug */
function dcBg() {
  skyGrad(440, ['#f2dcb0', '#f7e8c8']);
  X.fillStyle = 'rgba(200,140,80,.16)'; for (let x = 0; x < W; x += 100) X.fillRect(x, 0, 4, 400);
  rr(-10, 396, W + 20, 46, 0); ink('#a5622c', 0); X.fillStyle = '#c98443'; X.fillRect(0, 404, W, 4);
  let gr = X.createLinearGradient(0, 440, 0, 600); gr.addColorStop(0, '#efe3cc'); gr.addColorStop(1, '#d8c6a6'); X.fillStyle = gr; X.fillRect(0, 440, W, 160);
  X.fillStyle = 'rgba(160,130,90,.25)'; for (let r = 0, y = 440; y < 600; r++, y += 24 + r * 4) for (let x = (r % 2) * 40 - 40; x < W; x += 80) X.fillRect(x, y, 40, 24 + r * 4);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 440); X.lineTo(W, 440); X.stroke();
  // the painting of a piggy bank
  rr(18, 196, 96, 112, 6); ink('#ffd23f', 4); rr(28, 206, 76, 92, 3); ink('#9fd8f0', 2.5);
  el(66, 262, 26, 19); ink('#ff9ab8', 3); el(88, 258, 7, 6); ink('#ff9ab8', 2.5); X.beginPath(); X.moveTo(58, 244); X.lineTo(64, 236); X.lineTo(70, 244); X.closePath(); ink('#ff9ab8', 2);
  for (const lx of [52, 76]) { rr(lx, 276, 7, 10, 2); ink('#ff9ab8', 2); } X.fillStyle = INK; el(78, 254, 2.4, 2.4); X.fill(); rr(58, 247, 14, 3, 1.5); X.fill();
  // the vault recess
  el(DC_VX, DC_VY, DC_VR + 14, DC_VR + 14); ink('#5a5468', 4); el(DC_VX, DC_VY, DC_VR + 4, DC_VR + 4); ink('#2b2438', 0);
  rr(DC_VX + DC_VR - 6, DC_VY - 30, 16, 60, 5); ink('#8f9cb3', 3);                                                  // the hinge
  // the steel console the buttons sit in
  rr(100, 254, 600, 330, 26); ink('#77809a', 4); rr(100, 246, 600, 322, 26); ink('#9aa3b8', 4);
  X.fillStyle = 'rgba(255,255,255,.25)'; rr(118, 254, 564, 12, 6); X.fill();
  for (const [a, b] of [[118, 266], [682, 266], [118, 548], [682, 548]]) { el(a, b, 4, 4); ink('#c9ced6', 1.5); }
  for (const [x, y] of SLOTS) { el(x, y + 10, 66, 58); ink('#3b3550', 4); }
  // the dog's rug
  el(742, 532, 58, 14); ink('#ff8a96', 3); X.strokeStyle = '#fff3dd'; X.lineWidth = 3; el(742, 532, 44, 9); X.stroke();
}
reg('du_decode', duDecode, 'DECODE'); REGMAP.du_decode.duo = true;

/* ═════════ 4 STEER & BOOST: P1 steers the ship around rocks, P2 mashes to boost it to the finish ═════════
   Art: a river run seen from above. The steerer sits in the bow of a wooden motorboat, the booster at the stern by the outboard;
   rocks stick out of the foam, grassy banks scroll past and a seagull rides the bow (a big boost blows it off its perch).
   Win: the boat shoots under the FINISH banner with arms up. Lose: the motor coughs black smoke and the gull walks off. */
const ST_EDGE = (w, k) => 30 + 9 * Math.sin(w * .012 + k * 2) + 5 * Math.sin(w * .037 + k);
let ST_BG = null;
function duSteer(sp, D) {
  D = D || SOLO; const R = mkR(), steer = D.role === 0, LEN = 2000, TS = Math.sqrt(sp), BASE = 115, YS = 470, ROCK = [];
  for (let p0 = 380; p0 < LEN - 160;) {
    const x = 100 + R() * 600, w = 110 + R() * 50, two = R() < .4, off = 300 + R() * 130, side = x < 400 ? 1 : -1, gap = 170 + R() * 80;
    ROCK.push({ p: p0, x, w }); if (two) ROCK.push({ p: p0 + 8, x: clamp(x + side * off, 90, 710), w: 100 }); p0 += gap;
  }
  const pT = track(), xT = track(), eT = track();
  let x = 400, p = 0, extra = 0, kx = 0, inv = 0, stun = 0, pend = 0, sendAt = 0, tapFx = 0, lastSh = '';
  let rT0 = -1, hitAt = -9, pop = null, lastX = null, lean = 0;                // art only: outro clock, the last bump, the boat's lean
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: steer ? 'STEER!' : 'BOOST!', roleLabel: steer ? 'STEERER' : 'BOOSTER',
    hint: steer ? 'MOVE THE MOUSE (OR ◄ ►) TO DODGE THE ROCKS - YOUR PARTNER MAKES YOU GO FAST' : 'CLICK / TAP / SPACE AS FAST AS YOU CAN TO BOOST YOUR PARTNER\'S SHIP',
    thint: steer ? 'DRAG TO DODGE THE ROCKS - YOUR PARTNER MAKES YOU GO FAST' : 'TAP AS FAST AS YOU CAN TO BOOST YOUR PARTNER\'S SHIP',
    update(dt) {
      g.c += dt; inv = Math.max(0, inv - dt); stun = Math.max(0, stun - dt); tapFx = Math.max(0, tapFx - dt * 5);
      if (g.result && rT0 < 0) rT0 = now;
      if (steer) {
        if (g.result) return;
        x = clamp(x + kx * 520 * dt, 50, 750);
        extra *= Math.exp(-2.2 * dt);
        if (stun <= 0) p += (BASE + extra) * dt * TS;           // the whole course runs faster in later rounds (same number of taps, less time)
        for (const o of ROCK) if (inv <= 0 && Math.abs(o.p - p) < 26 && Math.abs(o.x - x) < o.w / 2 + 22) { extra = 0; stun = .5; inv = .9; p = Math.max(0, p - 140); shake(7, .2); sfx.thud(); burst(x, YS, '#e8fbff', 12); D.send('hit', o.x); hitAt = now; pop = { s: 'BONK!', at: now, x: clamp(x, 130, 670), y: YS - 128, col: '#ff4d5e' }; break; }
        const sh = [Math.round(p), Math.round(x), Math.round(extra)]; if (g.c - sendAt >= .05 && sh.join() !== lastSh) { lastSh = sh.join(); sendAt = g.c; D.send('sh', sh, true); }
        if (p >= LEN) g.finish('win'); else if (g.c >= g.limit) g.finish('lose');
      } else {
        if (pend && g.c - sendAt >= .1) { sendAt = g.c; D.send('b', pend); pend = 0; }
      }
    },
    msg(t, d) {
      if (t === 'sh' && !steer) { pT.push(d[0]); xT.push(d[1]); eT.push(d[2]); }
      else if (t === 'b' && steer) { extra = Math.min(340, extra + 70 * Math.min(d, 3)); sfx.blip(6); }
      else if (t === 'hit' && !steer) { shake(5, .15); sfx.thud(); burst(xT.at() || 400, YS, '#e8fbff', 10); hitAt = now; pop = { s: 'BONK!', at: now, x: clamp(xT.at() || 400, 130, 670), y: YS - 128, col: '#ff4d5e' }; }
    },
    boost() { if (steer || g.result) return; pend++; tapFx = 1; sfx.blip(Math.min(14, 4 + pend)); },
    draw() {
      X = ctx; if (!ST_BG) ST_BG = bake(stBg); X.drawImage(ST_BG, 0, 0);
      const T = now, res = g.result, rT = rT0 < 0 ? 0 : now - rT0, won = res === 'win', lost = res === 'lose';
      const P = steer ? p : (pT.at() === null ? 0 : pT.at()), BX = steer ? x : (xT.at() === null ? 400 : xT.at()), E = steer ? extra : (eT.at() || 0);
      const sy = wp => YS - (wp - P);                                            // screen row of a point of the course
      // ripples drifting with the current
      X.strokeStyle = 'rgba(255,255,255,.45)'; X.lineWidth = 3; X.lineCap = 'round';
      for (let k = Math.floor((P - 200) / 64); k <= Math.ceil((P + YS + 60) / 64); k++) { const y = sy(k * 64), x0 = 70 + hsh(k) * 660, w = 14 + hsh(k + 50) * 16; X.beginPath(); X.arc(x0, y, w, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); X.beginPath(); X.arc(x0 + w * 1.6, y + 6, w * .7, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); }
      stBanks(P, sy);
      // the finish: a checkered float line, posts on both banks and a banner
      const fy = sy(LEN);
      if (fy > 40 && fy < H + 40) {                                             // clipped under the hint line
        X.save(); X.beginPath(); X.rect(0, 60, W, H); X.clip();
        for (const px of [26, 774]) { rr(px - 7, fy - 62, 14, 66, 4); ink('#d9944f', 3); }
        for (let i = 0, xx = 20; xx < W - 20; i++, xx += 24) { rr(xx, fy - 9, 22, 18, 6); ink(i % 2 ? '#fff' : INK, 2); }
        X.translate(400, fy - 50); X.rotate(Math.sin(T * 2) * .01);
        X.beginPath(); X.moveTo(-374, -6); X.quadraticCurveTo(0, 12, 374, -6); X.lineTo(374, 20); X.quadraticCurveTo(0, 38, -374, 20); X.closePath(); ink('#ff5d5d', 3.5);
        txt('FINISH', 0, 15, 22, '#fff', 'center', 200); X.restore();
      }
      ROCK.forEach((o, i) => { const y = sy(o.p); if (y > -50 && y < H + 50) stRock(o.x, y, o.w, i, T); });
      // the boat
      if (lastX === null) lastX = BX; lean += (clamp((BX - lastX) * 1.2 / 60, -.18, .18) - lean) * .2; lastX = BX;
      const blink = steer && inv > 0 && Math.floor(now * 20) % 2;
      if (blink) X.globalAlpha = .55;
      stBoat(BX, YS, T, E, lean, steer, D, res, rT, T - hitAt, tapFx);
      X.globalAlpha = 1;
      stSign(T, P / LEN, E, res, ROCK, LEN);
      if (!steer && !res) { const s = 1 + tapFx * .18; X.save(); X.translate(465, 154); X.scale(s, s); pill(0, 0, TOUCH ? 'TAP! TAP! TAP!' : 'MASH SPACE!', '#FFE14D', null, 17); X.restore(); }
      pop = popDraw(pop);
      vignette(.16);
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
/* grassy banks on both sides, with a sandy rim and bushes, scrolling with the course */
function stBanks(P, sy) {
  for (const k of [0, 1]) {
    const ex = y => { const e = ST_EDGE(P + (470 - y), k); return k ? W - e : e; }, out = k ? W + 10 : -10;
    for (const [off, col, o] of [[8, '#f4d998', 0], [0, '#7cd46f', 4]]) {
      X.beginPath(); X.moveTo(out, -20); for (let y = -20; y <= H + 20; y += 20) X.lineTo(ex(y) + (k ? -off : off), y); X.lineTo(out, H + 20); X.closePath();
      if (o) ink(col, 3.5); else { X.fillStyle = col; X.fill(); }
    }
    for (let j = Math.floor((P - 200) / 150); j <= Math.ceil((P + 520) / 150); j++) {
      if (hsh(j * 3 + k) < .35) continue; const y = sy(j * 150 + hsh(j + k * 9) * 60), bx = k ? W - 6 : 6, r = 20 + hsh(j + 17 * k) * 10;
      for (const [a, b, c] of [[0, 0, r], [k ? -r * .6 : r * .6, r * .5, r * .7], [0, -r * .7, r * .7]]) { X.beginPath(); X.arc(bx + a, y + b, c, 0, TAU); ink('#3fb260', 3); }
      X.fillStyle = 'rgba(255,255,255,.25)'; el(bx + (k ? -r * .3 : r * .2), y - r * .5, r * .3, r * .16, -.5); X.fill();
    }
  }
}
function stRock(x, y, w, k, T) {
  X.globalAlpha = .85; el(x, y + 8, w / 2 + 12 + Math.sin(T * 4 + k) * 2, 30 + Math.cos(T * 3 + k) * 2); X.fillStyle = '#e8fbff'; X.fill(); X.globalAlpha = 1;
  const build = () => { X.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = 1 - hsh(k * 13 + i) * .16, px = x + Math.cos(a) * w / 2 * r, py = y + Math.sin(a) * 25 * r - (Math.sin(a) < 0 ? 5 : 0); i ? X.lineTo(px, py) : X.moveTo(px, py); } X.closePath(); };
  cel('#b3adc6', '#8a84a3', build, 5, 5, 4);
  glint(x - w * .18, y - 13, w * .14, 5, -.3, .5);
  X.strokeStyle = '#8a84a3'; X.lineWidth = 2.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(x + w * .12, y - 16); X.lineTo(x + w * .06, y - 5); X.lineTo(x + w * .16, y + 3); X.stroke();
}
/* the motorboat seen from above: bow up, the steerer in the bow, the booster at the stern by the motor, a gull on the bow */
function stBoat(bx, by, T, E, lean, steer, D, res, rT, sinceHit, tapFx) {
  const won = res === 'win', lost = res === 'lose', boost = clamp(E / 300, 0, 1), sCol = steer ? myCol() : pCol(D), bCol = steer ? pCol(D) : myCol();
  // the wake and, with a big boost, two spray jets
  const wl = lost ? 10 : 34 + E * .5;
  X.lineCap = 'round'; X.strokeStyle = 'rgba(232,251,255,.85)'; X.lineWidth = 6;
  for (const s of [-1, 1]) { X.beginPath(); X.moveTo(bx + s * 22, by + 38); X.quadraticCurveTo(bx + s * (34 + wl * .2), by + 40 + wl * .5, bx + s * (40 + wl * .4), by + 44 + wl); X.stroke(); }
  if (!lost) { X.fillStyle = 'rgba(232,251,255,.9)'; for (let i = 0; i < 3 + Math.round(boost * 6); i++) { const a = (T * 3 + i * .37) % 1; el(bx + Math.sin(i * 2.3 + T * 9) * 10 * a, by + 62 + a * (20 + E * .3), 5 + a * 6, 4 + a * 4); X.fill(); } }
  X.save(); X.translate(bx, by); X.rotate(lean);
  const hull = () => { X.beginPath(); X.moveTo(0, -66); X.quadraticCurveTo(40, -42, 35, 8); X.quadraticCurveTo(32, 46, 0, 50); X.quadraticCurveTo(-32, 46, -35, 8); X.quadraticCurveTo(-40, -42, 0, -66); X.closePath(); };
  cel('#d9944f', '#a5622c', hull, -6, -3, 4);
  X.save(); X.translate(0, -2); X.scale(.78, .82); hull(); X.fillStyle = '#8a5530'; X.fill(); X.restore();
  X.strokeStyle = 'rgba(20,16,28,.18)'; X.lineWidth = 2; for (const lx of [-12, 0, 12]) { X.beginPath(); X.moveTo(lx, -42); X.lineTo(lx, 36); X.stroke(); }
  glint(-18, -30, 6, 16, .3, .35);
  // the steerer in the bow (hands on the gunwales), then its bench over its legs
  const hitK = sinceHit < .6 ? 1 - sinceHit / .6 : 0, hopS = won ? Math.abs(Math.sin(rT * 9)) * 8 : 0;
  X.save(); X.translate(0, 2 - hopS);
  if (won) arms(3.2, -.3 + Math.sin(rT * 14) * .2, .3 - Math.sin(rT * 14) * .2, 1, sCol); else arms(3.2, -1.9 - lean, 1.9 - lean, .85, sCol);
  caos(0, 0, 3.2, { col: sCol, mood: won ? 'happy' : lost || hitK > 0 ? 'sad' : null });
  X.restore();
  rr(-30, -4, 60, 10, 3); ink('#e3a868', 2.5);
  // the booster at the stern, pumping the motor
  const pump = lost ? 0 : clamp(tapFx + boost * .5, 0, 1), hopB = won ? Math.abs(Math.sin(rT * 9 + 1)) * 6 : 0;
  X.save(); X.translate(0, 34 - hopB);
  if (won) arms(2.6, -.3, .3, 1, bCol); else arms(2.6, -.5 - Math.sin(T * 30) * .5 * pump, .5 + Math.sin(T * 30) * .5 * pump, .9, bCol);
  caos(0, 0, 2.6, { col: bCol, mood: won || pump > .6 ? 'happy' : lost ? 'sad' : null });
  X.restore();
  rr(-24, 30, 48, 9, 3); ink('#e3a868', 2.5);
  rr(-10, 42, 20, 17, 5); ink('#3b3550', 3); rr(-12, 40, 24, 7, 3); ink(lost ? '#8f88a6' : '#ff9a3a', 2.5);
  X.restore();
  if (hitK > 0) for (let i = 0; i < 3; i++) { const a = T * 6 + i * TAU / 3; star(bx + Math.cos(a) * 26, by - 34 + Math.sin(a) * 8, 7, 3, 5, T * 4, '#FFE14D', 2); }
  if (lost) for (let i = 0; i < 4; i++) { const a = (rT * 1.3 + i * .25) % 1; X.globalAlpha = .85 * (1 - a); el(bx + 20 + a * 70, by + 50 - a * 30 + Math.sin(i * 2 + rT * 3) * 6, 6 + a * 12, 5 + a * 9); ink('#4a4452', 2.5); X.globalAlpha = 1; }
  // the gull on the bow: a big boost blows it back, flapping and hanging on; on a lose it walks off along the bank
  const blow = won ? .3 + Math.abs(Math.sin(rT * 8)) * .4 : clamp((E - 150) / 140, 0, 1);
  let gx = bx + Math.sin(lean) * 60, gy = by - 70 - blow * 26;
  if (lost) { const k = clamp(rT / .8, 0, 1); gx += k * 130; gy -= Math.sin(k * Math.PI) * 50 + k * 40; }
  X.save(); X.translate(gx, gy); X.scale(lost ? 1 : -1, 1);
  if (!blow && !lost) { line([[-3, 9], [-3, 15]], 2.5, '#ffb84d'); line([[4, 9], [4, 15]], 2.5, '#ffb84d'); }
  cel('#fff', '#d8dde6', () => el(0, 2, 13, 9), -3, -3, 3);
  X.beginPath(); X.moveTo(-10, 0); X.lineTo(-20, -3); X.lineTo(-16, 6); X.closePath(); ink('#8f9cb3', 2.5);
  const wf = blow || lost ? Math.sin(T * 36) : 0; X.save(); X.translate(-1, 0); X.rotate(-.2 - wf * .9 - (blow ? .4 : 0)); el(-3, 0, 12, 5); ink('#c9ced6', 2.5); X.restore();
  X.save(); X.translate(8, -8); el(0, 0, 7, 7); ink('#fff', 2.5); X.beginPath(); X.moveTo(5, -1); X.lineTo(13, 1); X.lineTo(5, 3); X.closePath(); ink('#ffd23f', 1.5);
  X.fillStyle = INK; el(2, -2, 1.6, blow > .5 ? .6 : 1.8); X.fill(); X.restore();
  X.restore();
}
/* the wooden sign at the top: a river map with the rocks and the boat, and the boost gauge under it */
function stSign(T, k, E, res, ROCK, LEN) {
  const x0 = 315, y0 = 66, w = 300, h = 56, mx = x0 + 26, mw = w - 74;
  X.save(); X.translate(465, 58); X.rotate(Math.sin(T * 1.3) * .012); X.translate(-465, -58);
  woodSign(x0, y0, w, h, T, 58);
  rr(mx, y0 + 10, mw, 12, 6); ink('#5fd2f7', 2.5);
  X.fillStyle = '#8a84a3'; for (const o of ROCK) { el(mx + 6 + o.p / LEN * (mw - 12), y0 + 16, 2.4, 2.4); X.fill(); }
  for (let i = 0; i < 4; i++) { X.fillStyle = i % 2 ? '#fff' : INK; X.fillRect(mx + mw + 6 + (i % 2) * 6, y0 + 8 + Math.floor(i / 2) * 6, 6, 6); }
  line([[mx + mw + 6, y0 + 8], [mx + mw + 6, y0 + 24]], 1.5, '#a5622c');
  const bxm = mx + 6 + clamp(k, 0, 1) * (mw - 12); X.beginPath(); X.moveTo(bxm + 9, y0 + 16); X.lineTo(bxm - 6, y0 + 10); X.lineTo(bxm - 6, y0 + 22); X.closePath(); ink(res === 'lose' ? '#b9a88c' : '#ff9a3a', 2);
  X.beginPath(); X.moveTo(x0 + 26, y0 + 30); X.quadraticCurveTo(x0 + 34, y0 + 40, x0 + 26, y0 + 48); X.quadraticCurveTo(x0 + 18, y0 + 40, x0 + 26, y0 + 30); ink('#ffd23f', 2);
  const f = clamp(E / 300, 0, 1); rr(x0 + 40, y0 + 33, w - 74, 12, 6); ink('#3b3550', 2.5);
  if (f > .02) { rr(x0 + 40, y0 + 33, (w - 74) * f, 12, 6); ink(f > .7 ? '#FFE14D' : '#ff9a3a', 0); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(x0 + 44, y0 + 35, (w - 82) * f, 3); }
  if (res === 'win') rainbowRim(x0, y0, w, h, T);
  X.restore();
}
function stBg() { const gr = X.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#5fd2f7'); gr.addColorStop(1, '#2f9fe3'); X.fillStyle = gr; X.fillRect(0, 0, W, H); }
reg('du_steer', duSteer, 'STEER & BOOST'); REGMAP.du_steer.duo = true;

/* ═════════ 8 GUNNER & LOADER: P1 aims and shoots, P2 picks the ammo colour: only the matching colour pops a target ═════════
   Art: a farm under attack by jelly slimes on parachutes. The gunner works a paint cannon on wheels, the loader stands by it
   with a bucket of the loaded colour; a hit pops the slime in a splash and its empty parachute floats away. A cow watches
   over the fence and jumps every time a slime lands. Win: the cow gets hearts. Lose: a slime lands on the cow's head (MOO!). */
const GU_GY = 456, GU_COL = [['#ff4d5e', '#c42f43', '#ffd0d5'], ['#4DB8FF', '#2b86c9', '#d2efff']];
let GU_BG = null, GU_FG = null;
function duGun(sp, D) {
  D = D || SOLO; const R = mkR(), gun = D.role === 0, TS = Math.sqrt(sp), N = 9, NEED = 7, FY = 430, VY = 140, CY = 470, COL = [RED, BLU];
  const cols = [0, 0, 0, 0, 1, 1, 1, 1, R() < .5 ? 0 : 1]; for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
  const tg = cols.map((c, i) => ({ id: i, u: 1 + i * .9 + R() * .3, x: 70 + R() * 660, c, dead: false, esc: false }));
  const ty = T => -30 + (g.c * TS - T.u) * VY, live = T => !T.dead && !T.esc && g.c * TS >= T.u;
  const bullets = [], cxT = track(); let cx = 400, ammo = 0, cd = 0, hp = 3, kills = 0, kx = 0, lastCx = -1, flash = 0;
  // art only: outro clock, when each slime popped / landed (and where), the last shot (recoil), the last wrong colour
  let rT0 = -1, shotAt = -9, pop = null, pickAt = -9; const gone = {}, slotAt = [];
  const popped = T => { gone[T.id] = { at: now, y: ty(T), dead: true }; slotAt[kills - 1] = now; };
  const landed = T => { gone[T.id] = { at: now, y: FY, dead: false }; pop = { s: 'SPLAT!', at: now, x: clamp(T.x, 120, 680), y: GU_GY - 70, col: '#7fd34a', size: 24 }; };
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: gun ? 'SHOOT!' : 'LOAD!', roleLabel: gun ? 'GUNNER' : 'LOADER',
    hint: gun ? 'MOVE THE MOUSE (OR ◄ ►) TO AIM, CLICK / SPACE TO FIRE - ONLY THE COLOUR YOUR LOADER PICKS POPS A TARGET' : 'PICK THE AMMO COLOUR (CLICK A SIDE, OR KEYS Z / X) THAT MATCHES THE LOWEST TARGET - YOUR GUNNER SHOOTS IT',
    thint: gun ? 'DRAG TO AIM, TAP TO FIRE - ONLY THE COLOUR YOUR LOADER PICKS POPS A TARGET' : 'TAP RED OR BLUE TO LOAD THE COLOUR OF THE LOWEST TARGET - YOUR GUNNER SHOOTS IT',
    update(dt) {
      g.c += dt; cd = Math.max(0, cd - dt); flash = Math.max(0, flash - dt * 3);
      if (g.result && rT0 < 0) rT0 = now;
      for (const b of bullets) b.y -= 650 * dt; for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].dead || bullets[i].y < -30) bullets.splice(i, 1);
      if (!gun) return;
      if (!g.result) cx = clamp(cx + kx * 520 * dt, 40, 760);
      const r = Math.round(cx); if (r !== lastCx) { lastCx = r; D.send('cx', r, true); }
      for (const b of bullets) for (const T of tg) {
        if (b.dead || !live(T)) continue; const y = ty(T); if (Math.abs(b.x - T.x) < 34 && Math.abs(b.y - y) < 30) {
          b.dead = true;
          if (b.c === T.c) { T.dead = true; kills++; popped(T); sfx.coin(); burst(T.x, y, COL[T.c], 12); D.send('hit', { id: T.id, n: kills }); } else { sfx.buzz(); pop = { s: 'WRONG COLOUR', at: now, x: clamp(T.x, 150, 650), y: clamp(y - 70, 160, 400), col: '#fff', fg: INK, size: 20 }; D.send('bad', { id: T.id }); }
        }
      }
      for (const T of tg) if (live(T) && ty(T) > FY) { T.esc = true; hp--; flash = 1; landed(T); sfx.thud(); shake(7, .2); D.send('esc', { id: T.id, hp }); }
      if (!g.result) { if (kills >= NEED) g.finish('win'); else if (hp <= 0 || g.c >= g.limit) g.finish('lose'); }
    },
    msg(t, d) {
      if (t === 'cx') cxT.push(d); else if (t === 'ammo') ammo = d;
      else if (t === 'shot') { bullets.push({ x: d.x, y: CY - 30, c: d.c, dead: false }); shotAt = now; }
      else if (t === 'hit' || t === 'bad') { const T = tg[d.id]; if (!T) return; const y = ty(T), b = bullets.find(q => Math.abs(q.x - T.x) < 40 && Math.abs(q.y - y) < 80); if (b) b.dead = true;
        if (t === 'hit') { T.dead = true; kills = d.n; popped(T); sfx.coin(); burst(T.x, y, COL[T.c], 12); } else { sfx.buzz(); pop = { s: 'WRONG COLOUR', at: now, x: clamp(T.x, 150, 650), y: clamp(y - 70, 160, 400), col: '#fff', fg: INK, size: 20 }; } }
      else if (t === 'esc') { const T = tg[d.id]; if (T) { T.esc = true; landed(T); } hp = d.hp; flash = 1; sfx.thud(); shake(7, .2); }
    },
    fire() { if (!gun || g.result || cd > 0 || g.c < .2) return; cd = .3; bullets.push({ x: cx, y: CY - 30, c: ammo, dead: false }); D.send('shot', { x: Math.round(cx), c: ammo }); sfx.blip(10); shotAt = now; },
    pick(c) { if (gun || g.result) return; ammo = c; D.send('ammo', c, true); sfx.blip(c ? 12 : 6); pickAt = now; },
    draw() {
      X = ctx; if (!GU_BG) { GU_BG = bake(guBg); GU_FG = bake(guFg); }
      const T = now, res = g.result, rT = rT0 < 0 ? 0 : now - rT0, won = res === 'win', lost = res === 'lose';
      X.drawImage(GU_BG, 0, 0);
      sun(668, 168, T); clouds(T, [150, 196, 124]);
      let lastLand = -9; for (const k in gone) if (!gone[k].dead) lastLand = Math.max(lastLand, gone[k].at);
      guCow(T, res, rT, T - lastLand);
      X.drawImage(GU_FG, 0, 0);                                                    // the fence goes in front of the cow
      if (flash > 0) { X.globalAlpha = flash * .6; X.fillStyle = '#ff4d5e'; X.fillRect(0, GU_GY - 3, W, 6); X.globalAlpha = 1; }
      // slimes that landed: a green-tinged puddle that wobbles and fades; popped ones: a splash and the empty parachute drifting off
      for (const Tg of tg) {
        const q = gone[Tg.id]; if (!q) continue; const a = now - q.at, [base, shade, light] = GU_COL[Tg.c];
        if (q.dead) { if (a > 1.1) continue; X.globalAlpha = clamp(1 - (a - .7) / .4, 0, 1); guChute(Tg.x + a * 40 * (Tg.id % 2 ? 1 : -1), q.y - 50 - a * 60, base, light, Math.sin(a * 6) * .3); X.globalAlpha = 1;
          if (a < .35) { const k = a / .35; for (let i = 0; i < 7; i++) { const an = i / 7 * TAU; el(Tg.x + Math.cos(an) * 30 * k, q.y + Math.sin(an) * 26 * k, 8 * (1 - k) + 2, 7 * (1 - k) + 2); ink(base, 2); } } }
        else { const k = clamp(a / .25, 0, 1); X.globalAlpha = clamp(1.6 - a / 1.2, 0, 1); el(Tg.x, GU_GY + 14, 30 * k + 8, 9 * k + 3); ink(base, 3); glint(Tg.x - 10, GU_GY + 11, 8, 2.5, 0, .5); X.globalAlpha = 1; }
      }
      // the cannon, the gunner and the loader
      const x = gun ? cx : (cxT.at() === null ? 400 : cxT.at()), rec = clamp(1 - (T - shotAt) / .18, 0, 1);
      const gCol = gun ? myCol() : pCol(D), lCol = gun ? pCol(D) : myCol(), ac = GU_COL[ammo];
      const hop = won ? Math.abs(Math.sin(rT * 9)) * 14 : 0, sad = lost;
      shadow(x, 516, 56, 7, .25);
      for (const s of [-1, 1]) {                                                   // the two crew, either side of the cannon
        const px = x + s * 58, col = s > 0 ? gCol : lCol, mine = (s > 0) === gun;
        shadow(px, 514, 20, 5, .22);
        X.save(); X.translate(px, 512 - hop * (s > 0 ? 1 : .8));
        if (won) arms(3.4, -.35 + Math.sin(rT * 14 + s) * .15, .35 - Math.sin(rT * 14 + s) * .15, 1, col);
        else if (sad) arms(3.4, -2.7, 2.7, .9, col);
        else if (s > 0) arms(3.4, -1.2 + rec * .3, .3, 1, col);                    // the gunner holds the lever
        else arms(3.4, -.2, 1.25 - clamp(1 - (T - pickAt) / .3, 0, 1) * .4, 1, col); // the loader tips its bucket into the cannon
        caos(0, 0, 3.4, { col, mood: won ? 'happy' : sad ? 'sad' : null });
        X.restore();
        if (s < 0) { X.save(); X.translate(px + 26, 474 - hop * .8); X.rotate(-.5); rr(-10, -10, 20, 18, 4); ink('#c9ced6', 2.5); rr(-10, -10, 20, 6, 3); ink(ac[0], 2); X.restore(); }
        if (mine && gun) pill(px, 462 - hop, 'YOU', col, false, 13);
      }
      for (const s of [-1, 1]) guWheel(x + s * 26, 500, x / 13);
      cel('#d9944f', '#a5622c', () => rr(x - 32, 474, 64, 20, 5), -5, -3, 3.5);
      const by = 430 + rec * 8;
      cel('#c9ced6', '#8f9cb3', () => rr(x - 12, by, 24, 54, 9), -5, 0, 3.5);
      rr(x - 12, by + 16, 24, 11, 3); ink(ac[0], 2.5);
      rr(x - 16, by - 5, 32, 10, 5); ink(ac[0], 3); el(x + 9, by + 8 + Math.sin(T * 3) * 2, 3, 5); X.fillStyle = ac[0]; X.fill();
      glint(x - 5, by + 6, 2.5, 8, 0, .5);
      if (gun && !res) pill(x, 536, ammo ? 'LOADED: BLUE' : 'LOADED: RED', ac[0], null, 13);
      // the slimes on their parachutes, the paint shots
      for (const Tg of tg) { if (!live(Tg)) continue; const y = ty(Tg); if (y < -90) continue; guSlime(Tg.x, y, Tg.c, T, Tg.id, (x - Tg.x) / 300); }
      for (const b of bullets) { const c = GU_COL[b.c][0]; X.globalAlpha = .35; el(b.x, b.y + 22, 5, 16); X.fillStyle = c; X.fill(); X.globalAlpha = 1; el(b.x, b.y, 9, 12); ink(c, 2.5); glint(b.x - 3, b.y - 5, 3, 2, -.5, .6); }
      guSign(T, kills, NEED, hp, res, slotAt);
      if (!gun) {                                                                   // the loader's two buckets
        for (const c of [0, 1]) {
          const b = [c ? 552 : 18, 504, 230, 40], on = ammo === c && !res, [base, shade] = GU_COL[c], d = plate(b, res ? '#d3cfe0' : base, res ? '#8f88a6' : shade, on, on);
          const ix = b[0] + 34, iy = b[1] + 20 - d + 9; rr(ix - 12, iy - 11, 24, 22, 4); ink('#c9ced6', 2.5); rr(ix - 12, iy - 11, 24, 7, 3); ink(base, 2);
          txt(c ? 'BLUE' : 'RED', b[0] + 124 - (TOUCH ? 0 : 20), iy + 1, 24, '#fff', 'center', 120);
          if (!TOUCH) keyCap(b[0] + 196, iy, c ? 'X' : 'Z');
        }
      }
      pop = popDraw(pop);
      vignette(.16);
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
function guWheel(x, y, a) { X.beginPath(); X.arc(x, y, 14, 0, TAU); ink('#d9944f', 3); X.save(); X.translate(x, y); X.rotate(a); X.strokeStyle = '#a5622c'; X.lineWidth = 3; for (let i = 0; i < 3; i++) { X.rotate(TAU / 6); X.beginPath(); X.moveTo(-11, 0); X.lineTo(11, 0); X.stroke(); } X.restore(); X.beginPath(); X.arc(x, y, 4, 0, TAU); ink('#8f9cb3', 1.5); }
/* a striped parachute canopy (strings hang to y+34) */
function guChute(x, y, base, light, rot) {
  X.save(); X.translate(x, y); X.rotate(rot);
  X.strokeStyle = INK; X.lineWidth = 1.5; X.beginPath(); for (const [a, b] of [[-32, -14], [0, -2], [32, 14]]) { X.moveTo(a, 0); X.lineTo(b, 34); } X.stroke();
  const can = () => { X.beginPath(); X.moveTo(-36, 0); X.bezierCurveTo(-36, -36, 36, -36, 36, 0); X.quadraticCurveTo(24, -6, 12, 0); X.quadraticCurveTo(0, -6, -12, 0); X.quadraticCurveTo(-24, -6, -36, 0); X.closePath(); };
  can(); ink('#fff', 3); X.save(); can(); X.clip(); X.fillStyle = light; for (const sx of [-24, 8]) X.fillRect(sx, -40, 16, 44); X.fillStyle = 'rgba(20,16,28,.1)'; X.fillRect(10, -40, 40, 44); X.restore();
  glint(-16, -16, 8, 4, -.4, .6);
  X.restore();
}
/* a jelly slime hanging under its parachute, looking at the cannon */
function guSlime(x, y, c, T, id, look) {
  const [base, shade, light] = GU_COL[c], sw = Math.sin(T * 2.2 + id) * .08, sq = Math.sin(T * 5 + id) * .04;
  X.save(); X.translate(x, y - 22); X.rotate(sw); X.translate(-x, -(y - 22));
  guChute(x, y - 56, base, light, 0);
  X.save(); X.translate(x, y + 20); X.scale(1 + sq, 1 - sq); X.translate(-x, -(y + 20));
  const body = () => { X.beginPath(); X.moveTo(x - 25, y + 16); X.quadraticCurveTo(x - 30, y - 12, x, y - 24); X.quadraticCurveTo(x + 30, y - 12, x + 25, y + 16); X.quadraticCurveTo(x, y + 24, x - 25, y + 16); X.closePath(); };
  cel(base, shade, body, -5, -4, 3.5);
  glint(x - 10, y - 12, 7, 4, -.6, .6);
  const lx = clamp(look, -1, 1) * 2;
  for (const ex of [x - 8, x + 8]) { el(ex, y - 1, 5.5, 6.5); ink('#fff', 1.8); X.fillStyle = INK; el(ex + lx, y + 2, 2.6, 3.2); X.fill(); X.fillStyle = '#fff'; el(ex + lx - 1, y + 1, 1, 1); X.fill(); }
  X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round'; X.beginPath(); X.arc(x, y + 9, 4, .2, Math.PI - .2); X.stroke();
  X.restore(); X.restore();
}
/* the cow behind the fence: chews and follows the action; jumps when a slime lands; hearts on a win; slimed on a lose */
function guCow(T, res, rT, sinceLand) {
  const x = 96, y = 410, jump = sinceLand < .4 ? Math.sin(sinceLand / .4 * Math.PI) * 14 : 0, won = res === 'win', lost = res === 'lose';
  const chew = Math.sin(T * 8) * 1.5, hy = y - jump - (won ? Math.abs(Math.sin(rT * 9)) * 8 : 0);
  cel('#fff', '#d8d4e0', () => el(x + 26, hy + 34, 46, 26), -5, -3, 4);
  X.fillStyle = INK; el(x + 40, hy + 26, 12, 9); X.fill(); el(x + 10, hy + 40, 9, 7); X.fill();
  X.save(); X.translate(x, hy);
  for (const s of [-1, 1]) { X.save(); X.translate(s * 22, -14); X.rotate(s * .5); el(0, 0, 11, 5); ink('#fff', 3); X.restore(); X.beginPath(); X.moveTo(s * 10, -20); X.quadraticCurveTo(s * 16, -32, s * 12, -36); ink(null, 4); X.strokeStyle = '#fff3dd'; X.lineWidth = 3; X.stroke(); }
  cel('#fff', '#d8d4e0', () => { X.beginPath(); X.ellipse(0, 0, 20, 22, 0, 0, TAU); }, -4, -3, 4);
  X.fillStyle = INK; el(-8, -12, 7, 6); X.fill();
  el(0, 14 + chew * .3, 17, 11); ink('#ffb3c6', 3); X.fillStyle = INK; el(-6, 13, 2.4, 3); X.fill(); el(6, 13, 2.4, 3); X.fill();
  const scared = sinceLand < .6 || lost;
  for (const ex of [-8, 8]) { if (won) { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(ex, -2, 4, Math.PI + .3, -.3); X.stroke(); } else { el(ex, -3, scared ? 5.5 : 4.5, scared ? 6 : 5); ink('#fff', 1.5); X.fillStyle = INK; el(ex + 1, scared ? -3 : -2, scared ? 1.8 : 2.4, scared ? 2 : 2.8); X.fill(); } }
  if (lost) {                                                                     // a slime splats onto its head
    const k = clamp(rT / .3, 0, 1); X.save(); X.translate(0, -18 - (1 - k) * 120); X.scale(1 + (k >= 1 ? Math.sin(rT * 20) * .05 : 0), 1);
    X.beginPath(); X.moveTo(-24, 6); X.quadraticCurveTo(-26, -16, 0, -22); X.quadraticCurveTo(26, -16, 24, 6); X.quadraticCurveTo(0, 12, -24, 6); X.closePath(); ink(GU_COL[0][0], 3);
    for (const dx of [-14, 4, 16]) { el(dx, 10 + ((rT * 30 + dx) % 10), 3, 5); X.fillStyle = GU_COL[0][0]; X.fill(); }
    X.fillStyle = INK; el(-6, -6, 2.5, 3); X.fill(); el(6, -6, 2.5, 3); X.fill(); X.restore();
  }
  X.restore();
  if (won) for (let i = 0; i < 3; i++) { const a = (rT * 1.4 + i * .33) % 1; heart(x - 20 + i * 22, y - 40 - a * 50, .6); }
  if (lost && rT > .3 && rT < 1.2) badge('MOO!', x - 30, y - 58, 18, '#fff', INK, 1, -.1);
}
/* the sign: a slot per slime to pop, and three hearts for the slimes that may land */
function guSign(T, kills, need, hp, res, slotAt) {
  const pitch = 26, w = need * pitch + 104, x0 = 465 - w / 2, y0 = 70, h = 40;
  X.save(); X.translate(465, 58); X.rotate(Math.sin(T * 1.3) * .012); X.translate(-465, -58);
  woodSign(x0, y0, w, h, T, 58);
  for (let i = 0; i < need; i++) {
    const px = x0 + 22 + i * pitch, py = y0 + h / 2, full = i < kills || res === 'win';
    X.beginPath(); X.arc(px, py, 10, 0, TAU); ink(res === 'lose' ? '#b9a88c' : '#f1e3c8', 2.5);
    if (full) { const k = slotAt[i] > 0 && i < kills ? outBack((T - slotAt[i]) / .3) : 1; X.save(); X.translate(px, py); X.scale(k, k); X.beginPath(); X.arc(0, 0, 7, 0, TAU); ink('#5CFF7A', 2); line([[-3.5, 0], [-1, 3], [4, -3]], 1.5, '#fff'); X.restore(); }
  }
  for (let i = 0; i < 3; i++) { const hx = x0 + w - 70 + i * 24, on = i < hp; X.globalAlpha = on ? 1 : .35; heart(hx, y0 + h / 2 + 1, .62); X.globalAlpha = 1; if (!on) line([[hx - 6, y0 + 14], [hx + 6, y0 + 26]], 2, '#8f88a6'); }
  if (res === 'win') rainbowRim(x0, y0, w, h, T);
  X.restore();
}
/* the baked farm: sky, hills, a red barn with a silo, the field (the fence is its own layer, in front of the cow) */
function guBg() {
  skyGrad(GU_GY, ['#36b0ea', '#86d8fb', '#d6f7ff']);
  X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(0, GU_GY); for (let x = 0; x <= W; x += 20) X.lineTo(x, 352 - Math.sin(x * .011 + 1) * 22 - Math.sin(x * .027) * 8); X.lineTo(W, GU_GY); X.fill();
  X.fillStyle = '#87d19b'; X.beginPath(); X.moveTo(0, GU_GY); for (let x = 0; x <= W; x += 20) X.lineTo(x, 388 - Math.sin(x * .014 + 3) * 16); X.lineTo(W, GU_GY); X.closePath(); X.fill(); X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.stroke();
  tree(250, 360, 30, true, 430); tree(560, 352, 34, false, 430);
  // the barn and the silo
  rr(720, 300, 50, 150, 22); ink('#c9ced6', 4); X.fillStyle = 'rgba(20,16,28,.12)'; for (const yy of [330, 360, 390, 420]) X.fillRect(722, yy, 46, 3); el(745, 304, 25, 12); ink('#8f9cb3', 3);
  rr(612, 350, 120, 100, 4); ink('#d9534f', 4); X.beginPath(); X.moveTo(602, 356); X.lineTo(672, 306); X.lineTo(742, 356); X.closePath(); ink('#a33b38', 4);
  X.strokeStyle = '#fff'; X.lineWidth = 4; X.strokeRect(646, 392, 52, 58); X.beginPath(); X.moveTo(646, 392); X.lineTo(698, 450); X.moveTo(698, 392); X.lineTo(646, 450); X.stroke();
  rr(658, 330, 28, 22, 4); ink('#fff3a0', 3);
  // the field
  const gr = X.createLinearGradient(0, GU_GY, 0, H); gr.addColorStop(0, '#8fdc5c'); gr.addColorStop(1, '#5fb944'); X.fillStyle = gr; X.fillRect(0, GU_GY, W, H - GU_GY);
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -4; i < 12; i++) { X.beginPath(); X.moveTo(i * 90, H); X.lineTo(i * 90 + 45, H); X.lineTo(i * 90 + 145, GU_GY + 2); X.lineTo(i * 90 + 100, GU_GY + 2); X.fill(); }
  X.strokeStyle = '#3f8f35'; X.lineWidth = 2.5; X.lineCap = 'round'; for (let i = 0; i < 18; i++) { const tx = hsh(i) * W, tyy = GU_GY + 20 + hsh(i + 30) * 110; for (const d of [-5, 0, 5]) { X.beginPath(); X.moveTo(tx + d * .4, tyy); X.lineTo(tx + d, tyy - 9 + Math.abs(d) * .6); X.stroke(); } }
}
function guFg() {
  for (let x = 10; x < W; x += 70) { rr(x - 6, 412, 12, 46, 3); ink('#e3a868', 3); }
  for (const yy of [420, 440]) { rr(-10, yy, W + 20, 9, 3); ink('#e3a868', 3); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(0, yy + 2, W, 2); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, GU_GY); X.lineTo(W, GU_GY); X.stroke();
}
reg('du_gun', duGun, 'GUNNER & LOADER'); REGMAP.du_gun.duo = true;

/* shared kit for the DUO games that live one per file in js/games/duo/*.js (loaded after this file). A game there adds its
   intro-card text and demos to DUO.INFO / DUO.DEMOS under its id, then calls DUO.wire(g, D, judgeRole, sp, id) like the ones above. */
window.DUO = { PUR, PUR2, YEL, GRN, RED, BLU, PNK, ORG, LIL, clamp, mkR, END_SLACK, LAG, SOLO, duBg, duWin, duLose, duMood, duBar, track, wire, rolePick, demoFinger, demoCoin, INFO: DUINFO, DEMOS };

})();
