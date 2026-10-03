'use strict';
/* BRAINY BUNCH wave 1 - observation and logic microgames: WEIGH!, TURN IT!, FOCUS!, SPOT IT!, PROFILE!, COUNT!, ALIGN!, PUSH!
   Every game is a "pick the right thing" puzzle, so mouse, finger and keyboard all work:
     pointer: down(p) on a big target (>= 56px logical) - no hover, no drag, no chords needed
     keyboard: digits 1-9 pick directly, arrows move a highlight and Space / Enter confirms (bbNav)
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), key/keyup/down/move/up}; g.result = 'win'|'lose'
   Constructors only compute data: no DOM, no audio. */
(function () {

const BLU = '#4A5BE0', BLU2 = '#3F4ED0', LIME = '#B8F34A', PINK = '#FF6FB5', CREAM = '#FFF3D1', ORG = '#FF9F43';
const TEAL = '#2EC4B6', YEL = '#FFE14D', RED = '#ff4d4d', VIO = '#8B6CFF', NAVY = '#27306E', STONE = '#D8D2E8';

const bbMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const bbLoseFx = (x = 400, y = 300) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, RED, 14); ring(x, y, RED, 80); };
const bbWinFx = (x = 400, y = 300) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 32); ring(x, y, '#fff', 110); };
const WINW = ['BRAINY!', 'SMART!', 'GENIUS!', 'NICE!'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const sum = a => a.reduce((s, v) => s + v, 0);

function bbBg(t) {                       // blue sunburst + graph paper
  bg(BLU, BLU2, t);
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}
const bbMascot = g => claude(62, 594, 4.5, { mood: bbMood(g) });
const bbPrompt = s => txt(s, 400, 46, 30, '#fff', 'center', 700);

/* ── shared input: hit-test big rects, keyboard digits / arrows + Space ── */
const inR = (p, r, pad) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
function bbHit(p, rs, pad) {             // nearest rect (by centre) that contains the point
  let best = -1, bd = 1e9;
  for (let i = 0; i < rs.length; i++) {
    if (!inR(p, rs[i], pad)) continue;
    const d = Math.hypot(p.x - (rs[i].x + rs[i].w / 2), p.y - (rs[i].y + rs[i].h / 2));
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function bbNav(e, st, n, cols) {         // returns the chosen index or -1
  const c = e.code || '', m = /^(?:Digit|Numpad)([1-9])$/.exec(c);
  if (m) { st.kb = true; const i = +m[1] - 1; if (i < n) { st.sel = i; return i; } return -1; }
  if (c === 'ArrowLeft' || c === 'KeyA') { st.kb = true; st.sel = (st.sel + n - 1) % n; sfx.tick(); }
  else if (c === 'ArrowRight' || c === 'KeyD') { st.kb = true; st.sel = (st.sel + 1) % n; sfx.tick(); }
  else if ((c === 'ArrowUp' || c === 'KeyW') && cols > 1) { st.kb = true; st.sel = (st.sel - cols + n) % n; sfx.tick(); }
  else if ((c === 'ArrowDown' || c === 'KeyS') && cols > 1) { st.kb = true; st.sel = (st.sel + cols) % n; sfx.tick(); }
  else if (c === 'Space' || c === 'Enter') { st.kb = true; return st.sel; }
  return -1;
}
function bbInput(g, st, rects, cols, choose) {
  g.down = p => { if (g.result || g.c < .15) return; const i = bbHit(p, rects, 12); if (i >= 0) { st.kb = false; st.sel = i; choose(i); } };
  g.move = p => { if (!TOUCH) st.hov = bbHit(p, rects, 0); };
  g.up = () => {};
  g.key = e => { if (g.result || g.c < .15 || e.repeat) return; const i = bbNav(e, st, rects.length, cols); if (i >= 0) choose(i); };
  g.keyup = () => {};
}
/* card with lift on hover, keyboard cursor and (desktop) number badge; returns the vertical lift */
function bbCard(r, i, st, g, mark, fill, badge = true) {
  const lift = (st.hov === i && !g.result) ? -4 : 0;
  box3(r.x, r.y + lift, r.w, r.h, mark === 'good' ? LIME : mark === 'bad' ? '#ff9a9a' : (fill || CREAM), 4, 6);
  if (st.kb && st.sel === i && !g.result) { ctx.strokeStyle = YEL; ctx.lineWidth = 6; ctx.strokeRect(r.x - 9, r.y - 9 + lift, r.w + 18, r.h + 18); }
  if (badge && !TOUCH && i < 9) { circ(r.x + 15, r.y + 15 + lift, 11, NAVY, 2); txt(String(i + 1), r.x + 15, r.y + 15 + lift, 14, '#fff'); }
  return lift;
}
const bbMark = (g, i, good, chosen) => !g.result ? null : i === good ? 'good' : i === chosen ? 'bad' : null;

/* 1 WEIGH: two piles of columns of blocks (1 or 2 high): the heavier pile has the MORE blocks, not more columns */
function bbScale(sp) {
  const minD = sp > 1.5 ? 1 : 2;
  let A = [2, 2, 2], B = [1, 1, 1, 1];
  for (let k = 0; k < 300; k++) {
    const mk = () => Array.from({ length: ri(3, 5) }, () => ri(1, 2));
    const a = mk(), b = mk(), d = Math.abs(sum(a) - sum(b));
    if (d >= minD && d <= minD + 1) { A = a; B = b; if ((a.length > b.length) !== (sum(a) > sum(b)) || k > 150) break; }
  }
  const P = [A, B], heavy = sum(A) > sum(B) ? 0 : 1, COL = [LIME, PINK];
  let ang = 0, chosen = -1, tap = 0;
  const g = {
    c: 0, cmd: 'WEIGH!', hint: 'CLICK THE HEAVIER PILE (OR LEFT / RIGHT)', thint: 'TAP THE HEAVIER PILE', dur: 5.4,
    down(p) { if (g.result || g.c < .15) return; choose(p.x < 400 ? 0 : 1); },
    move() {}, up() {}, keyup() {},
    key(e) {
      if (g.result || g.c < .15 || e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'Digit1') choose(0);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Digit2') choose(1);
    },
    update(dt) {
      g.c += dt; tap = Math.max(0, tap - dt);
      const tgt = g.result ? (heavy === 1 ? .22 : -.22) : Math.sin(g.c * 1.6) * .02;
      ang += (tgt - ang) * Math.min(1, dt * 7);
    },
    draw(t) {
      bbBg(t); bbPrompt('WHICH IS HEAVIER?');
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(300, 548); ctx.lineTo(500, 548); ctx.lineTo(430, 470); ctx.lineTo(370, 470); ctx.fill();
      box(388, 232, 24, 258, VIO, 4); box(330, 530, 140, 18, TEAL, 4);
      const ex = 250 * Math.cos(ang), ey = 250 * Math.sin(ang);
      ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(400 - ex, 230 - ey); ctx.lineTo(400 + ex, 230 + ey); ctx.stroke();
      ctx.strokeStyle = YEL; ctx.lineWidth = 10; ctx.stroke(); ctx.lineCap = 'butt';
      circ(400, 230, 18, ORG, 4);
      for (let s = 0; s < 2; s++) {
        const px = 400 + (s ? ex : -ex), py = 230 + (s ? ey : -ey), top = py + 150, hot = !g.result && (s === 0 ? mouse.x < 400 : mouse.x >= 400) && !TOUCH;
        ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 140, top); ctx.moveTo(px, py); ctx.lineTo(px + 140, top); ctx.stroke();
        const n = P[s].length, x0 = px - n * 20;
        for (let i = 0; i < n; i++) for (let k = 0; k < P[s][i]; k++) {
          box(x0 + i * 40 + 2, top - (k + 1) * 36, 34, 34, COL[s], 3);
          ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x0 + i * 40 + 6, top - (k + 1) * 36 + 4, 26, 6);
        }
        box3(px - 150, top, 300, 18, hot ? YEL : CREAM, 4, 4);
        if (g.result && s === chosen) { ctx.strokeStyle = g.result === 'win' ? LIME : RED; ctx.lineWidth = 6; ctx.strokeRect(px - 154, top - 90, 308, 120); }
      }
      if (!TOUCH) { txt('◀', 120, 120, 30, YEL); txt('▶', 680, 120, 30, YEL); }
      bbMascot(g); vignette(.22);
    }
  };
  const choose = s => {
    chosen = s; tap = .2; sfx.click();
    if (s === heavy) { g.result = 'win'; bbWinFx(400, 330); floatText(pick(WINW), 400, 130, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(400, 330); floatText('WRONG!', 400, 130, RED, 46); }
  };
  return g;
}
reg('bb_scale', bbScale, 'WEIGH!');

/* 2 TURN IT: critter seen from the front; pick its back (the bag swaps sides when it turns round) */
const BODYC = [TEAL, PINK, VIO, ORG, LIME], HATC = [YEL, RED, '#4DB8FF', '#fff', LIME];
function bbCritter(cx, by, s, view, P) {
  const bw = 64 * s, bh = 60 * s, hw = 56 * s, hh = 42 * s, lh = 14 * s, bodyTop = by - lh - bh, headTop = bodyTop - hh + 4 * s;
  box(cx - 22 * s, by - lh, 14 * s, lh, NAVY, 3); box(cx + 8 * s, by - lh, 14 * s, lh, NAVY, 3);
  const side = view === 'front' ? P.bag : -P.bag;
  const bx = side > 0 ? cx + bw / 2 - 2 : cx - bw / 2 - 22 * s + 2;
  ctx.strokeStyle = INK; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(cx + side * 10 * s, bodyTop + 2 * s); ctx.lineTo(bx + 11 * s, bodyTop + 22 * s); ctx.stroke();
  box(cx - bw / 2, bodyTop, bw, bh, P.body, 3);
  box(bx, bodyTop + 22 * s, 22 * s, 28 * s, ORG, 3);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(bx + 3 * s, bodyTop + 25 * s, 16 * s, 4 * s);
  box(cx - hw / 2, headTop, hw, hh, P.body, 3);
  if (P.kind === 0) {
    ctx.beginPath(); ctx.moveTo(cx - hw / 2, headTop); ctx.lineTo(cx + hw / 2, headTop); ctx.lineTo(cx, headTop - 36 * s); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = P.hat; ctx.fill();
  } else if (P.kind === 1) { box(cx - hw / 2 - 6 * s, headTop - 8 * s, hw + 12 * s, 12 * s, P.hat, 3); box(cx - hw / 3, headTop - 24 * s, hw * 2 / 3, 18 * s, P.hat, 3); }
  else { box(cx - hw / 3, headTop - 6 * s, hw * 2 / 3, 8 * s, P.hat, 3); circ(cx, headTop - 14 * s, 13 * s, P.hat, 3); }
  if (view === 'front') {
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 18 * s, headTop + 12 * s, 11 * s, 11 * s); ctx.fillRect(cx + 7 * s, headTop + 12 * s, 11 * s, 11 * s);
    ctx.fillStyle = INK; ctx.fillRect(cx - 14 * s, headTop + 16 * s, 6 * s, 6 * s); ctx.fillRect(cx + 11 * s, headTop + 16 * s, 6 * s, 6 * s);
    ctx.fillRect(cx - 8 * s, headTop + 32 * s, 16 * s, 3 * s);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(cx, bodyTop + 30 * s, 16 * s, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(20,16,28,.22)'; for (let i = 0; i < 3; i++) ctx.fillRect(cx - 18 * s, bodyTop + (14 + i * 14) * s, 36 * s, 5 * s);
    circ(cx + 2 * s, by - lh - 6 * s, 7 * s, PINK, 3);
  }
}
function bbBehind(sp) {
  const body = pick(BODYC), P = { body, hat: pick(HATC), kind: ri(0, 2), bag: Math.random() < .5 ? -1 : 1 };
  const mods = ['bag', 'hat', 'body', 'kind'].sort(() => Math.random() - .5).slice(0, 3);
  const opts = [{ P, ok: true }];
  for (const m of mods) {
    const Q = Object.assign({}, P);
    if (m === 'bag') Q.bag = -P.bag;
    else if (m === 'hat') Q.hat = pick(HATC.filter(c => c !== P.hat));
    else if (m === 'body') Q.body = pick(BODYC.filter(c => c !== P.body));
    else Q.kind = (P.kind + ri(1, 2)) % 3;
    opts.push({ P: Q, ok: false });
  }
  opts.sort(() => Math.random() - .5);
  const good = opts.findIndex(o => o.ok), st = { sel: 0, kb: false, hov: -1 };
  const rects = opts.map((o, i) => ({ x: 300 + (i % 2) * 230, y: 100 + Math.floor(i / 2) * 215, w: 210, h: 195 }));
  let chosen = -1;
  const g = {
    c: 0, cmd: 'TURN IT!', hint: 'CLICK ITS BACK (OR 1-4, ARROWS + SPACE)', thint: 'TAP WHAT IT LOOKS LIKE FROM BEHIND', dur: 5.8,
    update(dt) { g.c += dt; },
    draw(t) {
      bbBg(t); bbPrompt('WHICH IS THE BACK?');
      txt('FRONT', 150, 112, 24, YEL);
      box3(40, 130, 220, 300, CREAM, 4, 6);
      bbCritter(150, 400, 1.5, 'front', P);
      for (let i = 0; i < 4; i++) {
        const r = rects[i], lift = bbCard(r, i, st, g, bbMark(g, i, good, chosen));
        bbCritter(r.x + r.w / 2, r.y + r.h - 18 + lift, 1.15, 'back', opts[i].P);
      }
      bbMascot(g); vignette(.22);
    }
  };
  bbInput(g, st, rects, 2, i => {
    chosen = i; sfx.click();
    if (i === good) { g.result = 'win'; bbWinFx(rects[i].x + 105, rects[i].y + 90); floatText(pick(WINW), 400, 300, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(rects[i].x + 105, rects[i].y + 90); floatText('WRONG!', 400, 300, RED, 46); }
  });
  return g;
}
reg('bb_behind', bbBehind, 'TURN IT!');

/* 3 FOCUS: a pixel mosaic sharpens step by step; pick which picture it is */
const PAL = { r: '#e8433a', g: '#3cb44b', y: '#FFD23F', b: '#3d8bff', w: '#ffffff', k: '#14101c', o: '#FF9F43', p: '#FF6FB5', n: '#8a5a2b', t: '#E8C79A' };
const ICONS = {
  apple: ['.....n......', '....nggg....', '..rrrnrrr...', '.rrrrrrrrr..', '.rrwrrrrrr..', 'rrrwrrrrrrr.', 'rrrrrrrrrrr.', 'rrrrrrrrrrr.', '.rrrrrrrrr..', '.rrrrrrrrr..', '..rrr.rrr...', '............'],
  heart: ['............', '.pppp..pppp.', 'pppppppppppp', 'pppwppppppp.', 'pppppppppppp', '.pppppppppp.', '..pppppppp..', '...pppppp...', '....pppp....', '.....pp.....', '............', '............'],
  star: ['.....yy.....', '.....yy.....', '....yyyy....', 'yyyyyyyyyyyy', '.yyyyyyyyyy.', '..yyyyyyyy..', '...yyyyyy...', '...yyyyyy...', '..yyyy.yyy..', '..yyy...yyy.', '.yy.......yy', '............'],
  fish: ['............', '...bbbb...o.', '..bbbbbbb.oo', '.bbwkbbbbboo', 'bbbbbbbbbbo.', '.bbbbbbbbboo', '..bbbbbbb.oo', '...bbbb...o.', '............', '............', '............', '............'],
  house: ['............', '.....rr.....', '....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '.rrrrrrrrrr.', '..tttttttt..', '..tbbttbbt..', '..tbbttbbt..', '..ttttttt...', '..tttnnttt..', '..tttnnttt..'],
  moon: ['....yyyy....', '..yyyyy.....', '.yyyyy......', '.yyyy.......', 'yyyyy.......', 'yyyyy.......', 'yyyyy.......', '.yyyy.......', '.yyyyy......', '..yyyyyy....', '....yyyyy...', '............']
};
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BGRGB = hex(CREAM);
const GRIDS = {}; for (const k in ICONS) GRIDS[k] = ICONS[k].map(row => Array.from(row.padEnd(12, '.').slice(0, 12), ch => PAL[ch] ? hex(PAL[ch]) : null));
const LV = [12, 6, 4, 3, 2, 1];
function bbMosaic(grid, b) {             // average colour of each b x b block (transparent counts as paper)
  const out = [];
  for (let by = 0; by < 12; by += b) for (let bx = 0; bx < 12; bx += b) {
    let r = 0, gg = 0, bl = 0;
    for (let y = 0; y < b; y++) for (let x = 0; x < b; x++) { const c = grid[by + y][bx + x] || BGRGB; r += c[0]; gg += c[1]; bl += c[2]; }
    const n = b * b; out.push({ x: bx, y: by, c: `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(bl / n)})` });
  }
  return out;
}
function bbFocus(sp) {
  const rs = Math.sqrt(sp), names = Object.keys(ICONS).sort(() => Math.random() - .5).slice(0, 4), good = Math.floor(Math.random() * 4);
  const grid = GRIDS[names[good]], levels = LV.map(b => bbMosaic(grid, b)), step = .7 / rs;
  const st = { sel: 0, kb: false, hov: -1 };
  const rects = names.map((n, i) => ({ x: 55 + i * 170, y: 440, w: 150, h: 100 }));
  let chosen = -1;
  const g = {
    c: 0, cmd: 'FOCUS!', hint: 'CLICK WHAT IT IS (OR 1-4, ARROWS + SPACE)', thint: 'TAP WHAT THE BLURRY PICTURE IS', dur: 5.6,
    update(dt) { g.c += dt; },
    draw(t) {
      bbBg(t); bbPrompt('WHAT IS IT?');
      const lvl = g.result ? 5 : Math.min(5, Math.floor(g.c / step)), px = 25, x0 = 250, y0 = 80;
      box3(x0 - 6, y0 - 6, 312, 312, CREAM, 5, 6);
      const b = LV[lvl];
      for (const m of levels[lvl]) { ctx.fillStyle = m.c; ctx.fillRect(x0 + m.x * px, y0 + m.y * px, b * px, b * px); }
      if (!g.result) { const k = (g.c % step) / step; ctx.strokeStyle = 'rgba(255,255,255,' + (.55 * (1 - k)) + ')'; ctx.lineWidth = 6; ctx.strokeRect(x0 - 12 - k * 10, y0 - 12 - k * 10, 300 + 24 + k * 20, 300 + 24 + k * 20); }
      for (let i = 0; i < 4; i++) {
        const r = rects[i], lift = bbCard(r, i, st, g, bbMark(g, i, good, chosen));
        const G = GRIDS[names[i]], s = 7, ox = r.x + (r.w - 12 * s) / 2, oy = r.y + (r.h - 12 * s) / 2 + lift;
        for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (G[y][x]) { ctx.fillStyle = `rgb(${G[y][x][0]},${G[y][x][1]},${G[y][x][2]})`; ctx.fillRect(ox + x * s, oy + y * s, s, s); }
      }
      bbMascot(g); vignette(.22);
    }
  };
  bbInput(g, st, rects, 4, i => {
    chosen = i; sfx.click();
    if (i === good) { g.result = 'win'; bbWinFx(400, 230); floatText(pick(WINW), 400, 400, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(400, 230); floatText('WRONG!', 400, 400, RED, 46); }
  });
  return g;
}
reg('bb_focus', bbFocus, 'FOCUS!');

/* 4 SPOT IT: a grid of identical critters, one mutated */
function bbMon(cx, cy, r, P) {
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
  for (let i = 0; i < P.ant; i++) {
    const d = P.ant === 1 ? 0 : (i ? 1 : -1) * .45, ax = cx + Math.sin(d) * r * 1.5, ay = cy - Math.cos(d) * r * 1.5;
    ctx.beginPath(); ctx.moveTo(cx + Math.sin(d) * r * .8, cy - Math.cos(d) * r * .8); ctx.lineTo(ax, ay); ctx.stroke(); circ(ax, ay, r * .16, YEL, 3);
  }
  ctx.lineCap = 'butt';
  if (P.ears) { circ(cx - r * .85, cy - r * .55, r * .3, P.col, 3); circ(cx + r * .85, cy - r * .55, r * .3, P.col, 3); }
  circ(cx, cy, r, P.col, 4);
  ctx.fillStyle = 'rgba(20,16,28,.28)';
  for (let i = 0; i < P.spots; i++) { ctx.beginPath(); ctx.arc(cx + [-.5, .55, .1][i] * r, cy + [.35, .4, .72][i] * r, r * .14, 0, 7); ctx.fill(); }
  const n = P.eyes, er = r * (n === 3 ? .2 : n === 2 ? .24 : .3);
  for (let i = 0; i < n; i++) {
    const ex = cx + (n === 1 ? 0 : n === 2 ? (i ? 1 : -1) * r * .38 : (i - 1) * r * .58), ey = cy - r * .22;
    circ(ex, ey, er, '#fff', 3); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex, ey + er * .1, er * .45, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
  if (P.mouth === 0) ctx.arc(cx, cy + r * .2, r * .3, .2, Math.PI - .2); else if (P.mouth === 1) { ctx.moveTo(cx - r * .28, cy + r * .5); ctx.lineTo(cx + r * .28, cy + r * .5); } else ctx.arc(cx, cy + r * .5, r * .13, 0, 7);
  ctx.stroke(); ctx.lineCap = 'butt';
}
function bbMutation(sp) {
  const big = sp > 1.4, cols = big ? 4 : 3, rows = big ? 3 : 2, n = cols * rows, cw = big ? 160 : 200, ch = big ? 130 : 190, gap = big ? 14 : 20;
  const col = pick([ORG, PINK, TEAL, LIME, VIO, YEL]);
  const base = { col, eyes: ri(2, 3), ant: ri(0, 2), spots: ri(0, 2), mouth: 0, ears: ri(0, 1) };
  const attrs = sp > 1.15 ? ['eyes', 'ant', 'spots', 'mouth', 'ears'] : ['eyes', 'ant', 'ears'];
  const M = Object.assign({}, base), a = pick(attrs);
  if (a === 'eyes') M.eyes = base.eyes === 2 ? 3 : 2; else if (a === 'ant') M.ant = (base.ant + ri(1, 2)) % 3;
  else if (a === 'spots') M.spots = (base.spots + ri(1, 2)) % 3; else if (a === 'mouth') M.mouth = ri(1, 2); else M.ears = 1 - base.ears;
  const good = Math.floor(Math.random() * n), st = { sel: 0, kb: false, hov: -1 };
  const x0 = (W - (cols * cw + (cols - 1) * gap)) / 2, y0 = big ? 100 : 105;
  const rects = Array.from({ length: n }, (_, i) => ({ x: x0 + (i % cols) * (cw + gap), y: y0 + Math.floor(i / cols) * (ch + gap), w: cw, h: ch }));
  let chosen = -1;
  const g = {
    c: 0, cmd: 'SPOT IT!', hint: 'CLICK THE MUTANT (OR ARROWS + SPACE)', thint: 'TAP THE ONE THAT CHANGED', dur: 5.8,
    update(dt) { g.c += dt; },
    draw(t) {
      bbBg(t); bbPrompt('WHO MUTATED?');
      for (let i = 0; i < n; i++) {
        const r = rects[i], lift = bbCard(r, i, st, g, bbMark(g, i, good, chosen), CREAM, false);
        const bob = Math.sin(now * 3 + i * .5) * 2.5, rad = Math.min(r.w, r.h) * .27;
        bbMon(r.x + r.w / 2, r.y + r.h / 2 + 8 + lift + bob, rad, i === good ? M : base);
      }
      bbMascot(g); vignette(.22);
    }
  };
  bbInput(g, st, rects, cols, i => {
    chosen = i; sfx.click();
    const r = rects[i];
    if (i === good) { g.result = 'win'; bbWinFx(r.x + r.w / 2, r.y + r.h / 2); floatText(pick(WINW), 400, 300, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(r.x + r.w / 2, r.y + r.h / 2); floatText('WRONG!', 400, 300, RED, 46); }
  });
  return g;
}
reg('bb_mutation', bbMutation, 'SPOT IT!');

/* 5 PROFILE: match a black silhouette to the right character */
function bbHead(cx, cy, s, P, sil) {
  const F = c => sil ? INK : c;
  if (P.hair === 2) { box(cx - 46 * s, cy - 22 * s, 20 * s, 76 * s, F('#8a5a2b'), 3); box(cx + 26 * s, cy - 22 * s, 20 * s, 76 * s, F('#8a5a2b'), 3); }
  if (P.ears) { circ(cx - 43 * s, cy + 2 * s, 14 * s, F('#FFCBA4'), 3); circ(cx + 43 * s, cy + 2 * s, 14 * s, F('#FFCBA4'), 3); }
  if (P.beard) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(cx, cy + 30 * s, 31 * s, 28 * s, 0, 0, 7); ctx.fill(); ctx.fillStyle = F('#6b4423'); ctx.beginPath(); ctx.ellipse(cx, cy + 30 * s, 27 * s, 24 * s, 0, 0, 7); ctx.fill(); }
  circ(cx, cy, 34 * s, F('#FFCBA4'), 3);
  if (P.hair === 1) {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(cx + i * 14 * s - 9 * s, cy - 28 * s); ctx.lineTo(cx + i * 14 * s, cy - (58 - Math.abs(i) * 4) * s); ctx.lineTo(cx + i * 14 * s + 9 * s, cy - 28 * s); ctx.closePath();
      ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = F('#8a5a2b'); ctx.fill();
    }
  }
  if (P.hat === 1) { box(cx - 36 * s, cy - 40 * s, 72 * s, 10 * s, F(P.hc), 3); box(cx - 21 * s, cy - 84 * s, 42 * s, 46 * s, F(P.hc), 3); }
  else if (P.hat === 2) {
    ctx.beginPath(); ctx.moveTo(cx - 26 * s, cy - 28 * s); ctx.lineTo(cx + 26 * s, cy - 28 * s); ctx.lineTo(cx, cy - 86 * s); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = F(P.hc); ctx.fill(); circ(cx, cy - 88 * s, 8 * s, F('#fff'), 3);
  } else if (P.hat === 3) {
    ctx.beginPath(); ctx.arc(cx, cy - 8 * s, 39 * s, Math.PI, 0); ctx.closePath(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = F(P.hc); ctx.fill();
    box(cx - 40 * s, cy - 12 * s, 80 * s, 9 * s, F(P.hc), 3);
  }
  if (!sil) {
    ctx.fillStyle = INK; ctx.fillRect(cx - 17 * s, cy - 6 * s, 8 * s, 10 * s); ctx.fillRect(cx + 9 * s, cy - 6 * s, 8 * s, 10 * s);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy + 12 * s, 11 * s, .3, Math.PI - .3); ctx.stroke(); ctx.lineCap = 'butt';
  }
}
function bbProfiler(sp) {
  const T = { hat: ri(0, 3), hair: ri(0, 2), ears: ri(0, 1), beard: ri(0, 1), hc: pick(HATC) };
  const fix = P => { if (P.hat > 0 && P.hair === 1) P.hair = 0; return P; };
  fix(T);
  const key = P => [P.hat, P.hair, P.ears, P.beard].join(), seen = new Set([key(T)]), opts = [{ P: T, ok: true }];
  const range = { hat: 3, hair: 2, ears: 1, beard: 1 }, flips = sp > 1.3 ? 1 : 2;
  for (let guard = 0; opts.length < 4 && guard < 400; guard++) {
    const Q = Object.assign({}, T, { hc: pick(HATC) }), as = Object.keys(range).sort(() => Math.random() - .5).slice(0, flips);
    for (const a of as) Q[a] = (T[a] + ri(1, range[a])) % (range[a] + 1);
    fix(Q);
    if (!seen.has(key(Q))) { seen.add(key(Q)); opts.push({ P: Q, ok: false }); }
  }
  for (let i = 0; opts.length < 4; i++) opts.push({ P: { hat: i % 4, hair: 2, ears: 1, beard: 1, hc: RED }, ok: false });   // unreachable safety net
  opts.sort(() => Math.random() - .5);
  const good = opts.findIndex(o => o.ok), st = { sel: 0, kb: false, hov: -1 };
  const rects = opts.map((o, i) => ({ x: 50 + i * 180, y: 340, w: 160, h: 190 }));
  let chosen = -1;
  const g = {
    c: 0, cmd: 'PROFILE!', hint: 'CLICK THE MATCH (OR 1-4, ARROWS + SPACE)', thint: 'TAP WHO CASTS THE SHADOW', dur: 5.8,
    update(dt) { g.c += dt; },
    draw(t) {
      bbBg(t); bbPrompt('WHO IS IT?');
      box3(300, 85, 200, 230, CREAM, 4, 6);
      bbHead(400, 215, 1.3, T, true);
      for (let i = 0; i < 4; i++) {
        const r = rects[i], lift = bbCard(r, i, st, g, bbMark(g, i, good, chosen));
        bbHead(r.x + r.w / 2, r.y + 108 + lift, 1.1, opts[i].P, false);
      }
      bbMascot(g); vignette(.22);
    }
  };
  bbInput(g, st, rects, 4, i => {
    chosen = i; sfx.click();
    if (i === good) { g.result = 'win'; bbWinFx(400, 200); floatText(pick(WINW), 400, 320, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(400, 200); floatText('WRONG!', 400, 320, RED, 46); }
  });
  return g;
}
reg('bb_profiler', bbProfiler, 'PROFILE!');

/* 6 COUNT: scattered numbered tiles, click 1..N in order (or type the digits) */
function bbNumbers(sp) {
  const N = sp > 1.8 ? 7 : sp > 1.3 ? 6 : 5, R = 40;
  const cells = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) cells.push({ x: 130 + c * 180, y: 170 + r * 150 });
  cells.sort(() => Math.random() - .5);
  const vals = Array.from({ length: N }, (_, i) => i + 1).sort(() => Math.random() - .5);
  const tiles = vals.map((v, i) => ({ v, x: cells[i].x + ri(-22, 22), y: cells[i].y + ri(-22, 22), done: 0, pop: 0, ph: Math.random() * 6 }));
  const rects = tiles.map(t => ({ x: t.x - R, y: t.y - R, w: R * 2, h: R * 2 }));
  let next = 1, bad = -1;
  const tapTile = i => {
    const t = tiles[i]; if (g.result || t.done) return;
    if (t.v === next) {
      t.done = 1; t.pop = .3; next++; sfx.hit(); sfx.blip(next * 2); burst(t.x, t.y, YEL, 8, 200);
      if (next > N) { g.result = 'win'; bbWinFx(400, 320); floatText(pick(WINW), 400, 300, YEL, 46); }
    } else { bad = i; g.result = 'lose'; bbLoseFx(t.x, t.y); floatText('WRONG!', 400, 300, RED, 46); }
  };
  const g = {
    c: 0, cmd: 'COUNT!', hint: 'CLICK THE NUMBERS IN ORDER (OR TYPE THEM)', thint: 'TAP THE NUMBERS IN ORDER', dur: 5.8,
    down(p) { if (g.result || g.c < .15) return; const i = bbHit(p, rects, 8); if (i >= 0) tapTile(i); },
    move() {}, up() {}, keyup() {},
    key(e) {
      if (g.result || g.c < .15 || e.repeat) return;
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || ''); if (!m) return;
      const i = tiles.findIndex(t => t.v === +m[1]); if (i >= 0) tapTile(i);
    },
    update(dt) { g.c += dt; for (const t of tiles) t.pop = Math.max(0, t.pop - dt); },
    draw(t) {
      bbBg(t); bbPrompt('1, 2, 3 ...');
      tiles.forEach((tl, i) => {
        const bob = tl.done ? 0 : Math.sin(now * 2.5 + tl.ph) * 3, k = tl.pop > 0 ? 1 + tl.pop * 1.2 : 1;
        ctx.save(); ctx.translate(tl.x, tl.y + bob); ctx.scale(k, k);
        shadow(0, R + 4, R * .9, 8, .25);
        circ(0, 0, R, tl.done ? '#9fb0ff' : i === bad ? RED : CREAM, 4);
        if (!tl.done) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(-12, -14, 9, 0, 7); ctx.fill(); }
        txt(String(tl.v), 0, 2, tl.done ? 36 : 52, tl.done ? '#fff' : INK);
        ctx.restore();
      });
      bbMascot(g); vignette(.22);
    }
  };
  return g;
}
reg('bb_numbers', bbNumbers, 'COUNT!');

/* 7 ALIGN: statues that turn when clicked; make them all face the same way */
function bbBust(cx, by, dir, sq) {       // dir: 0 front, 1 left, 2 back, 3 right; by = top of the pedestal
  ctx.save(); ctx.translate(cx, by); ctx.scale(sq, 1);
  box3(-46, -56, 92, 56, STONE, 4, 4); circ(0, -92, 38, STONE, 4);
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 5;
  if (dir === 0) { ctx.fillRect(-20, -102, 9, 12); ctx.fillRect(11, -102, 9, 12); ctx.beginPath(); ctx.moveTo(-11, -72); ctx.lineTo(11, -72); ctx.stroke(); }
  else if (dir === 2) { circ(0, -138, 12, '#b9b3cf', 3); ctx.beginPath(); ctx.moveTo(-22, -108); ctx.lineTo(22, -108); ctx.moveTo(-26, -92); ctx.lineTo(26, -92); ctx.moveTo(-22, -76); ctx.lineTo(22, -76); ctx.stroke(); }
  else {
    const d = dir === 1 ? -1 : 1;
    circ(-d * 12, -90, 9, '#b9b3cf', 3);
    ctx.beginPath(); ctx.moveTo(d * 34, -102); ctx.lineTo(d * 58, -84); ctx.lineTo(d * 34, -74); ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.stroke(); ctx.fillStyle = STONE; ctx.fill();
    ctx.fillStyle = INK; ctx.fillRect(d * 18 - 5, -102, 9, 12); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(d * 14, -66); ctx.lineTo(d * 30, -66); ctx.stroke();
  }
  ctx.lineCap = 'butt'; ctx.restore();
}
function bbStatues(sp) {
  const n = sp > 1.5 ? 6 : 5, S = sp > 1.15 ? 4 : 2, ORDER = S === 2 ? [1, 3] : [0, 1, 2, 3], sp0 = n === 5 ? 150 : 125;
  let v;
  for (let k = 0; k < 400; k++) {
    v = Array.from({ length: n }, () => ri(0, S - 1));
    let best = 99; for (let tg = 0; tg < S; tg++) best = Math.min(best, sum(v.map(x => (tg - x + S) % S)));
    if (!v.every(x => x === v[0]) && best <= (S === 2 ? 3 : 5) && best >= 2) break;
    if (k === 399) v = Array.from({ length: n }, (_, i) => i === 0 ? 1 % S : 0);
  }
  const st = { sel: 0, kb: false, hov: -1 }, tw = new Array(n).fill(0);
  const cxs = v.map((_, i) => 400 + (i - (n - 1) / 2) * sp0);
  const rects = cxs.map(cx => ({ x: cx - (sp0 - 10) / 2, y: 190, w: sp0 - 10, h: 330 }));
  const g = {
    c: 0, cmd: 'ALIGN!', hint: 'CLICK STATUES TO TURN THEM (OR 1-6, ARROWS + SPACE)', thint: 'TAP STATUES UNTIL THEY ALL MATCH', dur: 5.8,
    update(dt) { g.c += dt; for (let i = 0; i < n; i++) tw[i] = Math.max(0, tw[i] - dt); },
    draw(t) {
      bbBg(t); bbPrompt('ALL FACE THE SAME WAY');
      for (let i = 0; i < n; i++) {
        const r = rects[i], hov = st.hov === i && !g.result, cur = st.kb && st.sel === i && !g.result;
        box3(cxs[i] - 52, 420, 104, 100, hov ? YEL : TEAL, 4, 5);
        if (cur) { ctx.strokeStyle = YEL; ctx.lineWidth = 6; ctx.strokeRect(cxs[i] - 62, 200, 124, 330); }
        const sq = tw[i] > 0 ? Math.abs(Math.cos((1 - tw[i] / .18) * Math.PI / 2)) * .85 + .15 : 1;
        shadow(cxs[i], 424, 56, 10, .25);
        bbBust(cxs[i], 420, ORDER[v[i]], sq);
        if (!TOUCH) txt(String(i + 1), cxs[i], 480, 26, '#fff');
      }
      bbMascot(g); vignette(.22);
    }
  };
  bbInput(g, st, rects, n, i => {
    v[i] = (v[i] + 1) % S; tw[i] = .18; sfx.click(); sfx.whoosh(i % 2 === 0);
    if (v.every(x => x === v[0])) {
      g.result = 'win'; bbWinFx(400, 300); floatText(pick(WINW), 400, 150, YEL, 46);
      for (const cx of cxs) burst(cx, 300, YEL, 6, 200);
    }
  });
  return g;
}
reg('bb_statues', bbStatues, 'ALIGN!');

/* 8 PUSH: a clue (sum, product, dots or a numeral) and four buttons: push the one that fits */
function bbDots(cx, cy, n, size, cells) {  // cells: list of [col,row] slots in a 5x2 / 3x3 grid, already chosen
  for (const c of cells.slice(0, n)) circ(cx + c[0], cy + c[1], size, ORG, 3);
}
function bbButtons(sp) {
  const mx = clamp(5 + Math.floor((sp - 1) * 4), 5, 9), kinds = sp > 1.4 ? ['sum', 'dots', 'num', 'mul'] : ['sum', 'dots', 'num'], kind = pick(kinds);
  let ans, label = '';
  if (kind === 'sum') { const a = ri(1, mx), b = ri(1, mx); ans = a + b; label = `${a} + ${b} = ?`; }
  else if (kind === 'mul') { const a = ri(2, 5), b = ri(2, 5); ans = a * b; label = `${a} × ${b} = ?`; }
  else ans = ri(3, 9);
  const lo = kind === 'num' ? 1 : 0, hi = kind === 'num' ? 9 : 40, vals = new Set([ans]);
  for (let k = 0; vals.size < 4 && k < 200; k++) { const d = ri(1, 3) * (Math.random() < .5 ? -1 : 1), q = ans + d; if (q >= lo && q <= hi) vals.add(q); }
  for (let q = lo; vals.size < 4; q++) vals.add(q);
  const opts = [...vals].sort(() => Math.random() - .5), good = opts.indexOf(ans), st = { sel: 0, kb: false, hov: -1 };
  const slots = [], gridCells = (n, sx, sy, cols) => { const o = []; for (let i = 0; i < n; i++) o.push([(i % cols - (cols - 1) / 2) * sx, (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * sy]); return o; };
  const scatter = (() => {                                  // dots clue: n of 10 jittered slots
    const idx = Array.from({ length: 10 }, (_, i) => i).sort(() => Math.random() - .5).slice(0, ans);
    return idx.map(i => [((i % 5) - 2) * 64 + ri(-8, 8), (Math.floor(i / 5) - .5) * 56 + ri(-6, 6)]);
  })();
  const rects = opts.map((o, i) => ({ x: 55 + i * 172, y: 340, w: 150, h: 150 }));
  let chosen = -1, press = -1, pt = 0;
  const g = {
    c: 0, cmd: 'PUSH!', hint: 'CLICK THE MATCHING BUTTON (OR 1-4, ARROWS + SPACE)', thint: 'TAP THE MATCHING BUTTON', dur: 5.6,
    update(dt) { g.c += dt; pt = Math.max(0, pt - dt); },
    draw(t) {
      bbBg(t); bbPrompt('WHICH BUTTON?');
      box3(200, 80, 400, 215, CREAM, 4, 6);
      if (kind === 'dots') bbDots(400, 188, ans, 18, scatter);
      else if (kind === 'num') txt(String(ans), 400, 188, 130, INK);
      else txt(label, 400, 188, 84, INK, 'center', 360);
      for (let i = 0; i < 4; i++) {
        const r = rects[i], mark = bbMark(g, i, good, chosen), down = (press === i && pt > 0) || (g.result && i === chosen);
        const lift = (st.hov === i && !g.result) ? -4 : 0, dy = down ? 10 : lift;
        box(r.x, r.y + 14, r.w, r.h - 10, NAVY, 4);                                    // base
        box(r.x, r.y + dy, r.w, r.h - 14, mark === 'good' ? LIME : mark === 'bad' ? '#ff9a9a' : PINK, 4);
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(r.x, r.y + dy, r.w, 10);
        if (st.kb && st.sel === i && !g.result) { ctx.strokeStyle = YEL; ctx.lineWidth = 6; ctx.strokeRect(r.x - 9, r.y - 9, r.w + 18, r.h + 8); }
        const cx = r.x + r.w / 2, cy = r.y + (r.h - 14) / 2 + dy;
        if (kind === 'num') bbDots(cx, cy, opts[i], 14, gridCells(opts[i], 36, 36, 3));
        else txt(String(opts[i]), cx, cy, 70, '#fff');
        if (!TOUCH) { circ(r.x + 15, r.y + 15 + dy, 11, NAVY, 2); txt(String(i + 1), r.x + 15, r.y + 15 + dy, 14, '#fff'); }
      }
      bbMascot(g); vignette(.22);
    }
  };
  bbInput(g, st, rects, 4, i => {
    chosen = i; press = i; pt = .2; sfx.stamp();
    if (i === good) { g.result = 'win'; bbWinFx(rects[i].x + 75, rects[i].y + 60); floatText(pick(WINW), 400, 300, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(rects[i].x + 75, rects[i].y + 60); floatText('WRONG!', 400, 300, RED, 46); }
  });
  return g;
}
reg('bb_buttons', bbButtons, 'PUSH!');

})();
