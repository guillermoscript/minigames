'use strict';
// Async JPEG encoding keeps compression off the game's synchronous draw path.
// One encoder per canvas and a round/seat guard prevent stale work from being queued.
function partyCaptureFrame(canvas, metadata, send) {
  if (canvas.partyEncoding) return;
  const room = party.room, round = room && room.round, seat = party.you && party.you.id;
  if (!room || !party.you) return;
  const deliver = image => {
    if (typeof image === 'string' && image.length < 60000 && party.room && party.room.id === room.id && party.room.round === round && party.room.state === 'round' && party.you && party.you.id === seat) send(Object.assign({ image }, metadata));
  };
  if (typeof canvas.toBlob !== 'function' || typeof FileReader === 'undefined') {
    try { deliver(canvas.toDataURL('image/jpeg', .42)); } catch (_) {}
    return;
  }
  canvas.partyEncoding = true;
  try {
    canvas.toBlob(blob => {
      if (!blob) { canvas.partyEncoding = false; return; }
      const reader = new FileReader();
      reader.onload = () => { canvas.partyEncoding = false; deliver(reader.result); };
      reader.onerror = reader.onabort = () => { canvas.partyEncoding = false; };
      try { reader.readAsDataURL(blob); } catch (_) { canvas.partyEncoding = false; }
    }, 'image/jpeg', .42);
  } catch (_) { canvas.partyEncoding = false; }
}
const partyFrameGap = () => typeof linkMs === 'function' && linkMs() > 250 ? .3 : .15;

/* Turn-based party modes reuse the existing seeded microgames. The server owns turns,
   cards and the balloon; The actor broadcasts the game view; assistants relay light positions or use server actions. */
function partyStartSteal(target, round) {
  if (party.stealBusy) return;
  party.stealBusy = { target, round, at: now, completing: false };
  partyMoveAction('steal', { target }, round).finally(() => {
    if (!party.room || party.room.round !== round || !party.room.extra.stealing || !party.room.extra.stealing[party.you.id]) party.stealBusy = null;
  });
}
const partyTurnMode = R => ['lantern', 'cards', 'balloon'].includes(R.mode);
const partyActor = R => R.players.find(p => p.id === R.extra.actor);
const partyTurnLabel = R => R.mode === 'cards' ? t('{n} CARDS LEFT', { n: R.extra.deck }) : R.mode === 'balloon' ? t('TURN {n}', { n: R.round + 1 }) : t('ROUND {n} / {total}', { n: R.round + 1, total: R.total });
async function partyMoveAction(action, data, expectedRound) {
  const R = party.room; if (!R || R.state !== 'round' || R.round !== expectedRound) return;
  const r = await pcall(action, Object.assign(auth(), { round: expectedRound }, data));
  if (r.ok) applyRoom(r.data.room);
  else if (r.status === 404) roomGone();
  else if (r.status !== 409) say(partyErr(r), '#FF4D4D');
}
/* ───────────── DUO-look UI helpers (art only) ─────────────
   The kit is js/party-ui.js (PARTY_UI, loaded before this file). These are the few pieces the kit does not have: a rounded inked panel with depth, a pointer-less tag,
   a rounded bar, a button whose hit test is registered through button() and a text chip. TODO: promote pmSlab / pmTag / pmBar / pmChip into PARTY_UI.
   Cosmetic randomness uses PARTY_UI.hash (a pure function of an index), never the seeded game RNG or Math.random. */
const pmNum = v => Math.round(v * 10) / 10;
function pmPath(x, y, w, h, r) {   // memoized rounded-rect Path2D (static rects only: the cache is keyed by the numbers)
  r = pmNum(Math.max(0, Math.min(r, w / 2, h / 2))); x = pmNum(x); y = pmNum(y); w = pmNum(w); h = pmNum(h);
  return PARTY_UI.P(`M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`);
}
const pmDark = c => { const n = parseInt(c.slice(1), 16); return (.299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255 < .3; };
const pmW = {};
function pmTextW(s, size, maxW) {   // width of a shouted (Arial Black) label, measured once per string
  const k = size + '|' + s; if (pmW[k] === undefined) { if (Object.keys(pmW).length > 300) for (const q in pmW) delete pmW[q]; ctx.save(); ctx.font = '900 ' + size + 'px "Arial Black", Impact, sans-serif'; pmW[k] = ctx.measureText(s).width; ctx.restore(); }
  return Math.min(maxW || 1e9, pmW[k]);
}
const pmHover = (x, y, w, h) => typeof hovered === 'function' && hovered(x, y, w, h);
/* the click region still goes through button() (so tests and the input loop see the same rectangles); it draws nothing, the art is ours */
function pmHit(x, y, w, h, fn) { ctx.save(); ctx.globalAlpha = 0; button(x, y, w, h, '', fn); ctx.restore(); }
/* a rounded slab with depth, a soft drop shadow and a gloss strip (scoreboard 16, small panels 12). (x, y, w, h) is the face; the base peeks out d px below */
function pmSlab(x, y, w, h, col, o = {}) {
  const U = PARTY_UI, r = o.r == null ? 16 : o.r, d = o.d == null ? 5 : o.d, ol = o.o || 3.5;
  ctx.save(); if (o.a != null) ctx.globalAlpha *= o.a;
  ctx.fillStyle = 'rgba(20,16,28,.3)'; U.rr(x + 4, y + 7 + d, w, h, r); ctx.fill();
  U.rr(x, y + d, w, h, r); U.ink(o.dk || U.shade(col, .36), ol);
  U.rr(x, y, w, h, r); U.ink(col, ol);
  if (!o.flat) { ctx.fillStyle = 'rgba(255,255,255,' + (o.gloss == null ? .15 : o.gloss) + ')'; U.rr(x + r * .55, y + 4, w - r * 1.1, Math.max(3, Math.min(9, h * .1)), 4); ctx.fill(); }
  ctx.restore();
}
/* a name tag without a pointer: fully round, ink 3, gloss strip; dark colours get a white shouted label, light ones an INK Fredoka label */
function pmTag(cx, cy, w, label, col, size = 14, o = {}) {
  const U = PARTY_UI, h = Math.round(size * 1.75);
  ctx.save(); if (o.rot) { ctx.translate(cx, cy); ctx.rotate(o.rot); ctx.translate(-cx, -cy); } if (o.a != null) ctx.globalAlpha *= o.a;
  ctx.fillStyle = 'rgba(20,16,28,.24)'; U.rr(cx - w / 2 + 2, cy - h / 2 + 5, w, h, h / 2); ctx.fill();
  U.rr(cx - w / 2, cy - h / 2, w, h, h / 2); U.ink(col, 3);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; U.rr(cx - w / 2 + size * .45, cy - h / 2 + 3, w - size * .9, h * .22, h * .11); ctx.fill();
  if (pmDark(col)) U.text(label, cx, cy + 1, size * .9, '#fff', 'center', w - size); else U.text(label, cx, cy + 1, size, INK, 'center', w - size);
  ctx.restore(); return h;
}
/* a shouted label (any colour) on a dark rounded chip that fits its text: for lines that used to float on the background */
function pmChip(cx, cy, s, size, fill, maxW, o = {}) {
  const U = PARTY_UI, label = U.tr(s), w = pmTextW(label, size, maxW) + size * 1.4, h = Math.round(size * 1.75);
  ctx.save(); if (o.a != null) ctx.globalAlpha *= o.a;
  ctx.fillStyle = 'rgba(20,16,28,.25)'; U.rr(cx - w / 2 + 2, cy - h / 2 + 5, w, h, h / 2); ctx.fill();
  U.rr(cx - w / 2, cy - h / 2, w, h, h / 2); U.ink(o.bg || '#2b2845', 3);
  ctx.fillStyle = 'rgba(255,255,255,.14)'; U.rr(cx - w / 2 + size * .45, cy - h / 2 + 3, w - size * .9, h * .2, h * .1); ctx.fill();
  ctx.restore();
  txt(s, cx, cy + 1, size, fill, 'center', maxW);
  return w;
}
/* a rounded progress bar: the fill is clipped to the track, so a tiny value is a round dot */
function pmBar(x, y, w, h, k, col, o = {}) {
  const U = PARTY_UI; k = Math.max(0, Math.min(1, k));
  ctx.save();
  U.rr(x, y, w, h, h / 2); U.ink(o.track || '#2a2545', o.o || 2.5);
  if (k > .001) {
    ctx.save(); U.rr(x, y, w, h, h / 2); ctx.clip();
    const fw = Math.max(h, w * k);
    U.rr(x, y, fw, h, h / 2); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; U.rr(x + 3, y + 1.5, Math.max(0, fw - 6), Math.max(1.5, h * .26), h * .13); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
/* a control plate: hover lifts it, a press drops it, `off` greys it. (x, y, w, h) is the old rectangle (face + depth). Returns { y, dy }: draw the content at y + dy */
function pmBtn(x, y, w, h, fn, col, o = {}) {
  const U = PARTY_UI, hv = !o.off && pmHover(x, y, w, h), down = !!o.down || (hv && typeof pressing !== 'undefined' && pressing), ty = y - (hv && !down ? 2 : 0);
  if (fn) pmHit(x, y, w, h, fn);
  const dy = U.plate([x, ty, w, h - 9], col, o.dk || U.shade(col, .3), down, o.lit, o.off);
  return { y: ty, dy };
}
/* a four-point twinkle, tiny, for dark backdrops (cosmetic: a pure function of the index and the clock) */
function pmTwinkle(x, y, s, a) {
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#fff'; ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill(); ctx.restore();
}
const pmStar = (n, ro, ri) => { let d = ''; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = -Math.PI / 2 + i * Math.PI / n; d += (i ? 'L' : 'M') + pmNum(Math.cos(a) * r) + ' ' + pmNum(Math.sin(a) * r); } return PARTY_UI.P(d + 'Z'); };

function partyCardTable(R, interactive) {
  const U = PARTY_UI, all = R.players.filter(p => !p.left), w = 720 / all.length;
  all.forEach((p, i) => {
    const x = 40 + i * w, can = interactive && p.id !== party.you.id && p.score > 0 && R.extra.stolen[party.you.id] !== R.round, turn = p.id === R.extra.actor && !interactive;
    const face = turn ? U.mix('#35306a', '#FFE14D', .22) : '#2f2a52', mid = 518 + 31;
    if (can) { const bt = pmBtn(x + 3, 518, w - 6, 68, () => partyStartSteal(p.id, R.round), p.color); pmTag(x + w / 2, bt.y + bt.dy + 17, w - 24, t('STEAL: {name}', { name: p.name }), '#fff', 15); }
    else pmSlab(x + 3, 518, w - 6, 63, face, { r: 14, d: 5, o: 3.5, gloss: turn ? .24 : .13 });
    const ax = x + 3 + Math.min(26, (w - 6) * .2);
    U.avatar(ax, mid, Math.min(17, (w - 6) * .14), p.color, { t: now, seed: i * 1.3, mood: turn ? 'eager' : p.score > 0 ? 'idle' : 'sleepy', look: [0, -.4] });
    const tx = ax + Math.min(17, (w - 6) * .14) + 8, tw = x + w - 9 - tx;
    if (!can) txt(p.name, tx, 538, 17, p.color, 'left', tw);
    txt(t('{n} CARDS', { n: p.score }), tx, 569, 19, can ? INK : '#FFE14D', 'left', tw);
    if (turn) {   // whose turn it is at the table: a pulsing gold ring around the seat
      ctx.save(); ctx.lineJoin = 'round'; U.rr(x - 1, 515, w + 2, 71, 17); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke();
      ctx.globalAlpha = .75 + .25 * Math.sin(now * 6); ctx.lineWidth = 4.5; ctx.strokeStyle = '#FFE14D'; ctx.stroke(); ctx.restore();
    }
  });
}
/* ───────────── BALLOON: one balloon, everybody watches the pressure ─────────────
   The server owns the real balloon (`extra.danger` 0..1, `extra.leak` danger lost per second at rest, `extra.contrib/turn` per pumper).
   Here we only predict: the leak, our own taps (optimistic) and a smoothed `shown` value so the balloon grows and shrinks in real time. */
const BAL_LEAK = .9, BAL_PRE = 1.4;     // keep in sync with LEAK_PER_S / PRE_MS_BALLOON in pocketbase/pb_hooks/party.js
const balloonView = { room: '', stamp: '', roundKey: '', roundAt: 0, recv: 0, base: 0, leak: 0, shown: 0, opt: 0, at: 0, frame: -1, init: false, contrib: {}, pumping: {}, pops: [], tick: 0, hiss: 0, lastPump: -9, lastSfx: 0, poppedRound: -1 };
const balMix = (a, b, k) => { const f = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); const x = f(a), y = f(b); k = Math.max(0, Math.min(1, k)); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const balTry = fn => sabTry(fn);   // sabTry lives in js/party-sab.js
const balUnit = R => { const b = balloonView, others = Math.max(1, R.players.filter(p => !p.left).length - 1); return 1 / others / (b.leak ? BAL_LEAK / b.leak : 140); };
function partyBalloonShown(R) {
  const e = R.extra || {}, b = balloonView;
  if (b.room !== R.id) Object.assign(b, { room: R.id, stamp: '', roundKey: '', init: false, contrib: {}, pumping: {}, pops: [], shown: 0, opt: 0, lastPump: -9, poppedRound: -1 });
  if (b.frame === now) return b.view;
  const dt = Math.min(.1, Math.max(0, now - b.at)); b.at = now; b.frame = now;
  const danger = e.danger !== undefined ? e.danger : Math.min(1, (e.balloon || 0) / 180), rk = R.round + ':' + R.state;
  if (rk !== b.roundKey) { b.roundKey = rk; b.roundAt = now; }
  const stamp = [e.at, danger, rk].join('|');
  if (stamp !== b.stamp) {
    b.stamp = stamp; b.recv = now; b.base = danger; b.leak = e.leak || 0;
    const c = e.contrib || {}, me = party.you && party.you.id;
    for (const id in c) {
      const d = c[id] - (b.contrib[id] || 0);
      if (b.init && d > 0) {
        b.pumping[id] = now; b.lastPump = now; b.pops.push({ id, n: d, at: now, x: Math.random() }); if (b.pops.length > 16) b.pops.shift();
        if (id === me) b.opt = Math.max(0, b.opt - d * balUnit(R));
        if (now - b.lastSfx > .18) { b.lastSfx = now; balTry(() => noise(.1, .03, 600 + danger * 900, 1500 + danger * 1500, 'bandpass')); }
      }
      b.contrib[id] = c[id];
    }
    b.init = true;
  }
  b.opt *= Math.exp(-dt * 1.2);
  let level;
  if (R.state === 'round') level = Math.max(0, b.base - b.leak * Math.max(0, now - Math.max(b.recv, b.roundAt + BAL_PRE)));
  else level = Math.min(1, b.base);
  const target = (R.state === 'round' ? Math.min(1, level + b.opt) : level);   // no numbers or labels anywhere: the balloon itself is the only warning
  b.shown += (target - b.shown) * Math.min(1, dt * 7);
  b.view = Math.max(0, b.shown + (b.shown > .05 ? Math.sin(now * 2.3) * .045 + Math.sin(now * 5.7 + 1) * .03 : 0));
  if (R.state === 'round' && now > b.roundAt + BAL_PRE) {
    if (b.shown > .6) { b.tick -= dt; if (b.tick <= 0) { b.tick = .95 - (Math.min(1, b.shown) - .6) * 1.6; balTry(() => snd(70 + b.shown * 40, .09, 'sine', .07)); } }
    if (b.shown > .02 && now - b.lastPump > .9) { b.hiss -= dt; if (b.hiss <= 0) { b.hiss = .9; balTry(() => noise(.16, .018, 3500, 7000, 'highpass')); } }
  }
  return b.view;
}
/* the balloon itself: body goes pink -> red, grows, wobbles, sweats, cracks and screams as the pressure rises */
function partyBalloonDraw(cx, cy, r0, l, o = {}) {
  l = Math.min(1, l);
  const tm = now, r = r0 * (.5 + .8 * l), wob = Math.sin(tm * (4 + l * 12)) * (.02 + l * .05), sq = 1 + Math.sin(tm * (7 + l * 20)) * l * .04;
  const body = balMix('#F28CB1', '#ff3b3b', Math.pow(l, 1.15)), shade = balMix(body, '#3a1030', .32);
  const rx = r * .84 * sq, ry = r / sq, shk = l > .8 ? (l - .8) * 16 : 0;
  ctx.save(); ctx.translate(cx + Math.sin(tm * 61) * shk, cy + Math.cos(tm * 53) * shk * .6); ctx.rotate(wob);
  ctx.lineJoin = ctx.lineCap = 'round';
  if (l > .7) { const pu = .5 + .5 * Math.sin(tm * (8 + l * 10)); ctx.fillStyle = 'rgba(255,60,70,' + ((l - .7) * .9 * pu).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(0, 0, rx + 16, ry + 16, 0, 0, 7); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, ry + 10); ctx.quadraticCurveTo(12 * Math.sin(tm * 3), ry + 34, 8 * Math.sin(tm * 2.2) - 4, ry + 60); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, ry - 3); ctx.lineTo(-11, ry + 15); ctx.lineTo(11, ry + 15); ctx.closePath(); ctx.lineWidth = 8; ctx.stroke(); ctx.fillStyle = shade; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.lineWidth = 12; ctx.stroke(); ctx.fillStyle = shade; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-rx * .12, -ry * .08, rx, ry, 0, 0, 7); ctx.fill();
  if (l > .5) {
    ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(.8, (l - .5) * 1.6).toFixed(2) + ')'; ctx.lineWidth = 3;
    [-.3, .45, 1.25, 2.3, 3.5, 4.5].forEach(a => { ctx.beginPath(); ctx.ellipse(0, 0, rx * .86, ry * .86, 0, a, a + .3); ctx.stroke(); });
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-rx * .45, -ry * .5, rx * .13, ry * .24, -.5, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-rx * .62, -ry * .17, rx * .05, rx * .05, 0, 0, 7); ctx.fill();   // second glint: the rubber catches the light twice
  if (l > .9) {
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    [[.8, 1], [-.5, -1], [2.2, 1]].forEach(([a, s]) => { const x0 = Math.cos(a) * rx, y0 = Math.sin(a) * ry; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 - s * rx * .1, y0 - ry * .07); ctx.lineTo(x0 + s * rx * .02, y0 - ry * .15); ctx.lineTo(x0 - s * rx * .12, y0 - ry * .24); ctx.stroke(); });
  }
  const er = Math.max(6, rx * (l > .88 ? .21 : .17)), ey = -ry * .05, look = o.look || { x: -1, y: 0 };
  [-1, 1].forEach(s => {
    ctx.beginPath(); ctx.arc(s * rx * .3, ey, er, 0, 7); ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(s * rx * .3 + look.x * er * .3 + Math.sin(tm * 40) * (l > .88 ? 1.5 : 0), ey + look.y * er * .3, er * (l > .88 ? .26 : .5), 0, 7); ctx.fill();
    if (l > .4) { ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s * rx * .3 - s * er * 1.1, ey - er * 1.55 + (l > .7 ? 0 : 4)); ctx.lineTo(s * rx * .3 + s * er * .9, ey - er * 1.1 - (l - .4) * er * .8); ctx.stroke(); }
  });
  const my = ry * .3 + (l > .85 ? 2 : 0), mw = rx * .22;
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  if (l < .35) { ctx.beginPath(); ctx.arc(0, my - mw * .6, mw, .2, Math.PI - .2); ctx.stroke(); }
  else if (l < .6) { ctx.beginPath(); ctx.moveTo(-mw, my); for (let i = 1; i <= 4; i++) ctx.lineTo(-mw + i * mw / 2, my + (i % 2 ? 4 : -2) + Math.sin(tm * 9) * l * 2); ctx.stroke(); }
  else {
    const open = l > .85 ? 1.35 : .7 + (l - .6) * 1.2; ctx.beginPath(); ctx.ellipse(0, my + mw * .3, mw * (.9 + Math.sin(tm * 30) * .06 * (l > .85)), mw * open, 0, 0, 7);
    ctx.fillStyle = '#5a0f1f'; ctx.fill(); ctx.stroke();
    if (l > .85) { ctx.fillStyle = '#ff7a8a'; ctx.beginPath(); ctx.ellipse(0, my + mw * 1.1, mw * .5, mw * .3, 0, 0, 7); ctx.fill(); }
  }
  if (l < .5) { ctx.fillStyle = 'rgba(255,110,165,.55)'; [-1, 1].forEach(s => { ctx.beginPath(); ctx.ellipse(s * rx * .56, ey + er * 1.5, er * .8, er * .5, 0, 0, 7); ctx.fill(); }); }
  else {
    ctx.fillStyle = '#9fe3ff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (let i = 0; i < (l > .8 ? 3 : 2); i++) { const ph = (tm * .9 + i * .37) % 1, dx = (i % 2 ? 1 : -1) * rx * (.62 + i * .06), dy = -ry * .4 + ph * ry * .6; ctx.globalAlpha = 1 - ph * ph; ctx.beginPath(); ctx.arc(dx, dy, 5, 0, 7); ctx.moveTo(dx - 4, dy - 2); ctx.lineTo(dx, dy - 12); ctx.lineTo(dx + 4, dy - 2); ctx.fill(); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (o.leak) for (let i = 0; i < 3; i++) { const ph = (tm * 1.3 + i / 3) % 1; ctx.globalAlpha = (1 - ph) * .75; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((i - 1) * 8 * ph + (i === 1 ? 6 : -6) * ph, ry + 18 + ph * 34, 3 + ph * 6, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.restore();
}
function partyPumpers(R, x, y, w, rh, rows) {
  const U = PARTY_UI, e = R.extra, b = balloonView, list = R.players.filter(p => !p.left && p.id !== e.actor).slice(0, rows), turn = e.turn || {}, top = Math.max(1, ...list.map(p => turn[p.id] || 0)), l = partyBalloonShown(R);
  list.forEach((p, i) => {
    const yy = y + i * (rh + 5), live = R.state === 'round' && now - (b.pumping[p.id] || -9) < .8, mine = p.id === party.you.id, n = turn[p.id] || 0, sh = rh - 4;
    pmSlab(x, yy, w, sh, live ? balMix('#35406a', p.color, .5) : '#2b2845', { r: 12, d: 4, o: 3, gloss: live ? .24 : .12 });
    if (mine) { ctx.save(); U.rr(x - 3, yy - 3, w + 6, sh + 10, 15); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#FFE14D'; ctx.stroke(); ctx.restore(); }
    U.avatar(x + 22, yy + sh / 2 + 1, 14, p.color, { t: now, seed: i * 1.7, mood: live ? 'happy' : l > .75 ? 'panic' : 'idle', look: [0, -.6], bob: live });   // pumping = a happy hop; a hot balloon scares the idle ones
    txt(p.name, x + 44, yy + 11, 14, p.color, 'left', w - 106);
    txt(live ? 'PUMPING!' : 'IDLE', x + 44, yy + sh - 9, 11, live ? '#fff' : '#9a98ad', 'left', 58);
    if (live) {
      ctx.save(); ctx.lineCap = ctx.lineJoin = 'round';
      for (let k = 0; k < 3; k++) { const cx = x + 106 + k * 9, cy = yy + sh - 9; ctx.globalAlpha = Math.max(0, 1 - ((now * 3 + k * .33) % 1)); ctx.beginPath(); ctx.moveTo(cx - 2.5, cy - 4.5); ctx.lineTo(cx + 2, cy); ctx.lineTo(cx - 2.5, cy + 4.5); ctx.lineWidth = 5.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      ctx.restore();
    }
    txt('+' + n, x + w - 9, yy + 11, 17, '#FFE14D', 'right', 46);
    pmBar(x + w - 62, yy + sh - 15, 53, 9, n / top, p.color, { o: 2, track: '#171428' });
    if (n > 0 && n === top && list.length > 1) star(x + 6, yy + 6, 8, 4, 5, -Math.PI / 2 + Math.sin(now * 2 + i) * .15, '#FFE14D', 2);
  });
}
/* right-hand column: the balloon, its pressure and who is inflating it */
function partyBalloonSide(R, mine) {
  const U = PARTY_UI, b = balloonView, l = partyBalloonShown(R), pu = .5 + .5 * Math.sin(now * (6 + l * 14)), bx = 606, by = 118, bw = 180, bh = 254;   // starts under the LEAVE plate (y < 116) of the HUD
  pmSlab(bx, by, bw, bh, balMix('#2a2547', '#5a1626', l * l), { r: 20, d: 6, o: 4, gloss: .1 });
  const clip = pmPath(bx, by, bw, bh, 20);
  ctx.save(); ctx.clip(clip);
  for (let i = 0; i < 8; i++) { const a = now * .15 + i * Math.PI / 4; ctx.fillStyle = 'rgba(255,255,255,' + (.04 + l * .05).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(696, 238); ctx.arc(696, 238, 260, a, a + .2); ctx.closePath(); ctx.fill(); }
  for (let i = 0; i < 7; i++) pmTwinkle(bx + 14 + U.hash(i * 5 + 1) * (bw - 28), by + 30 + U.hash(i * 5 + 2) * (bh - 110), 2 + U.hash(i * 5 + 3) * 3, .25 + .6 * Math.max(0, Math.sin(now * (1.2 + U.hash(i * 5 + 4)) + i * 2)));   // twinkles, they wake up as the balloon gets hot
  const leaking = R.state === 'round' && now > b.roundAt + BAL_PRE && now - b.lastPump > .9 && l > .02;
  partyBalloonDraw(696, 232, 56, l, { leak: leaking });
  const ry = 56 * (.5 + .8 * l);
  b.pops.forEach(p => { const age = now - p.at; if (age > 1) return; const pl = R.players.find(q => q.id === p.id); ctx.globalAlpha = 1 - age; txt('+' + p.n, 696 + (p.x - .5) * 120, 232 - ry - 6 - age * 46, 20, pl ? pl.color : '#fff'); ctx.globalAlpha = 1; });
  if (l > .8) { ctx.fillStyle = 'rgba(255,40,60,' + ((l - .8) * .9 * pu * .6).toFixed(3) + ')'; ctx.fill(clip); }
  ctx.restore();
  ctx.save(); U.rr(bx + 5, by + 5, bw - 10, bh - 10, 16); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.stroke(); ctx.restore();
  pmTag(696, 135, 112, mine ? 'YOU PLAY' : 'YOU PUMP', '#FFE14D', 14);
  partyPumpers(R, 608, 386, 176, 40, 3);
}
/* big popping scene used on the between-turns card */
function drawBalloonBetween(R, L) {
  const U = PARTY_UI, e = R.extra, b = balloonView, res = L.results[0] || { id: e.actor, r: 'lose' }, actor = R.players.find(p => p.id === res.id) || partyActor(R), popped = !!e.loser, passed = res.r === 'win';
  partyBalloonShown(R);
  const fast = L.final ? 1 : 2.6, T = st * fast;   // regular turns blink by; only the last one gets its full show
  const k = easeOut(Math.min(1, T / 1.1)), lv = (popped ? Math.min(1, (e.start || 0) + (1 - (e.start || 0)) * k) : (e.start || 0) + ((e.danger || 0) - (e.start || 0)) * k);
  const boom = popped && T > .9;
  pmSlab(30, 108, 350, 392, boom ? '#4a1d2e' : balMix('#2a2547', '#5a1626', lv * lv), { r: 24, d: 6, o: 4, gloss: .1 });
  const clip = pmPath(30, 108, 350, 392, 24);
  ctx.save(); ctx.clip(clip);
  for (let i = 0; i < 10; i++) { const a = now * .15 + i * Math.PI / 5; ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(205, 290); ctx.arc(205, 290, 400, a, a + .18); ctx.closePath(); ctx.fill(); }
  if (boom) {
    if (b.poppedRound !== R.round) { b.poppedRound = R.round; balTry(() => { burst(205, 290, '#ff5c8a', 34, 520); burst(205, 290, '#FFE14D', 18, 380); ring(205, 290, '#fff', 150, .5); confetti(205, 290, 40); shake(16, .6); sfx.pop(); noise(.5, .12, 900, 120, 'lowpass'); }); }
    const sc = easeOut(Math.min(1, (T - .9) / .25));
    for (let i = 0; i < 9; i++) pmTwinkle(60 + U.hash(i * 3 + 11) * 290, 140 + U.hash(i * 3 + 12) * 340, 3 + U.hash(i * 3 + 13) * 4, .3 + .6 * Math.max(0, Math.sin(now * 3 + i * 1.7)));
    [[-70, 40, .4], [60, 70, -.9], [-10, 105, 2.2], [90, -20, 1.2]].forEach(([dx, dy, a], i) => {   // the shreds: inked, with a light edge, tumbling slowly
      ctx.save(); ctx.translate(205 + dx * sc, 330 + dy * sc * .6); ctx.rotate(a + (T - .9) * (i % 2 ? 1.1 : -1.1)); ctx.scale(.9 + sc * .1, .9 + sc * .1);
      U.cel(U.P('M-26 12L0 -22L30 14Z'), '#F28CB1', '#c25586', 5, 7, 4); U.glint(U.P('M-26 12L0 -22L30 14Z'), -8, -4, 9, 4, 'rgba(255,255,255,.55)', -.9); ctx.restore();
    });
    ctx.save(); ctx.translate(205, 250); ctx.rotate(-.1 + Math.sin(now * 5) * .015); const bs = .5 + sc * .45; ctx.scale(bs, bs);
    U.cel(pmStar(12, 112, 58), '#FFE14D', '#f2b705', 0, 9, 5); ctx.save(); ctx.rotate(Math.PI / 12); U.inkP(pmStar(12, 80, 44), '#fff3a0', 0); ctx.restore();
    txt('BOOM!', 0, 8, 56, '#FF3B3B', 'center', 170); ctx.restore();
  } else {
    for (let i = 0; i < 6; i++) pmTwinkle(60 + U.hash(i * 3 + 21) * 290, 140 + U.hash(i * 3 + 22) * 300, 2 + U.hash(i * 3 + 23) * 3, .2 + .5 * Math.max(0, Math.sin(now * 1.5 + i * 2.1)));
    partyBalloonDraw(205, 284, 84, lv, { leak: false });
  }
  ctx.restore();
  ctx.save(); U.rr(35, 113, 340, 382, 20); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.stroke(); ctx.restore();
  const col = popped ? '#FF4D5E' : passed ? '#5CFF7A' : '#FFE14D', title = popped ? 'POPPED!' : passed ? 'TURN PASSED!' : 'TRY AGAIN!';
  pmSlab(400, 108, 370, 106, '#35406a', { r: 16, d: 6, o: 4 });
  U.shadow(452, 196, 30, 7, .28);
  U.avatar(452, 166, 28, actor.color, { t: now, seed: 2, mood: popped ? 'bonk' : passed ? 'happy' : 'sad', bob: true, look: [.3, 0], k: easeOut(T / .3) });
  U.badge(title, 622, 142, popped ? 32 : 30, col, popped ? '#fff' : '#fff', U.outBack(T / .28), Math.sin(now * 2.3) * .025 - .02, 236);
  txt(actor.name, 622, 176, 20, actor.color, 'center', 240);
  txt(popped ? t('{name} POPPED THE BALLOON!', { name: actor.name.toUpperCase() }) : passed ? 'WON THE MICROGAME' : 'LOST THE MICROGAME', 600, 200, 13, '#fff', 'center', 330);
  if (!passed && !popped) { pmSlab(412, 230, 346, 28, '#5a1626', { r: 14, d: 4, o: 3 }); txt('+8 AIR · THE BALLOON GREW', 585, 245, 16, '#FF8A8A', 'center', 330); }
  pmTag(585, 284, L.final ? 262 : 220, L.final ? 'WHOLE GAME · TOTAL AIR' : 'AIR ADDED BY', '#FFE14D', 15);
  const turn = (L.final ? e.contrib : e.turn) || {}, list = R.players.filter(p => !p.left && p.id !== actor.id), top = Math.max(1, ...list.map(p => turn[p.id] || 0));
  list.slice(0, 3).forEach((p, i) => {
    const y = 306 + i * 52, g = easeOut((T - .1 - i * .1) / .4), n = turn[p.id] || 0, best = n === top && n > 0;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, g * 2.2)); ctx.translate((1 - Math.max(0, Math.min(1, g))) * 36, 0);
    pmSlab(400, y, 370, 40, best && list.length > 1 ? U.mix('#2b2845', '#B49CFF', .4) : '#2b2845', { r: 14, d: 4, o: 3 });
    U.avatar(430, y + 21, 15, p.color, { t: now, seed: i * 1.9, mood: best ? 'happy' : n === 0 ? 'sleepy' : 'idle', bob: best });
    txt(p.name, 458, y + 12, 17, p.color, 'left', 120);
    pmBar(458, y + 22, 224, 11, n / top * Math.max(0, Math.min(1, g)), p.color, { track: '#171428' });
    txt('+' + Math.round(n * Math.max(0, g)), 752, y + 20, 24, '#FFE14D', 'right', 60);
    if (best && list.length > 1) { star(594, y + 12, 10, 5, 5, -Math.PI / 2 + Math.sin(now * 3) * .2, '#FFE14D', 2); txt('MVP', 610, y + 12, 12, '#FFE14D', 'left', 36); }
    ctx.restore();
  });
  if (L.final) {
    const all = Object.values(e.contrib || {}).reduce((a, n) => a + n, 0), best = Math.max(...Object.values(e.contrib || { x: 0 }));
    pmSlab(400, 462, 370, 54, '#2b2845', { r: 16, d: 5, o: 3.5 });
    txt(t('{n} TURNS SURVIVED', { n: R.round }) + ' · ' + t('{n} AIR PUMPED', { n: all }), 585, 481, 16, '#fff', 'center', 340);
    txt(t('BIGGEST PUMPER: {n} AIR', { n: best }), 585, 503, 14, '#FFE14D', 'center', 340);
  }
  const next = R.players.find(p => p.id === e.next);
  if (!L.final && next) pmTag(585, 478, 330, t('NEXT: {name}', { name: next.name }), next.color, 19);
}
function partyCardReveal(R) {
  if (!R.extra.card) return '';
  if (R.extra.card !== 'play') return 'MICROGAME CARD ADDED · NEXT PLAYER DRAWS';
  return R.extra.phase === 'challenge' ? 'PLAY CARD · BEAT THE PILE TO KEEP IT' : 'PLAY CARD · EMPTY PILE: NEXT PLAYER';
}
/* ───────────── CARDS: what the watchers do ─────────────
   Everybody but the player at the table watches. They STEAL (the big buttons at the right) and keep busy with the shared kits: trap minigames, deck guesses and table
   emotes (js/party-react.js) charge SABOTAGE (js/party-sab.js), which covers a rival's screen. The kit is per room, so what is earned while a deck is picked is still there in the challenge. */
const CARDS_TRAPS = { fly: 0, jam: 0, bubble: .34, dial: .33, seq: .33 }, CARDS_WORDS = { bubble: 'NICE!', dial: 'PERFECT!', seq: 'COMBO!', over: 'TOO LATE!' };   // no pump to jam and no fly: only the three that pay a charge
function partyCardsKit(R) {
  let k = party.cards;
  if (!k || k.room !== R.id) k = party.cards = { room: R.id, charges: createSabCharges(), pulse: -9, bet: null };
  const bet = k.bet;
  if (bet && bet.round < R.round) {                      // the deck pick I bet on has been made (the hook records it as extra.side): settle it
    k.bet = null;
    if (bet.round === R.round - 1 && R.extra && R.extra.side === bet.side) { k.charges.earn('trap'); partyCardsPulse(k, 'CALLED IT!', '#5CFF7A'); }
  }
  return k;
}
const partyCardsPulse = (k, word, col) => { k.pulse = now; sabTry(() => { sfx.hit(); ring(400, 300, '#FF9A3D', 130, .5); burst(400, 300, '#FF9A3D', 20, 360); floatText(word, 400, 280, col, 44); }); };
const partyCardsTraps = k => createIdleTraps({ at: { x: 304, y: 534 }, first: [.8, .8], gap: [1.5, 1.7], weights: CARDS_TRAPS, words: CARDS_WORDS, onReward: () => { k.charges.earn('trap'); k.pulse = now; } });
/* where a player's emotes start: the middle of their box on the table */
const partyCardsSlot = (R, id) => { const all = R.players.filter(p => !p.left), i = Math.max(0, all.findIndex(p => p.id === id)); return { x: 40 + (i + .5) * 720 / all.length, y: 516 }; };
function partyDrawGame(R) {
  const actor = partyActor(R), mine = R.extra.actor === party.you.id, round = R.round, kit = partyCardsKit(R), relay = duoCtx(R);
  const rx = createReactions(R, relay, { origin: id => partyCardsSlot(R, id), onTap: streak => {
    const before = kit.charges.n;
    if (kit.charges.earn('combo', streak) && kit.charges.n > before) partyCardsPulse(kit, 'SABOTAGE!', '#FF9A3D');
  } });
  const gs = createGuess(R, relay, { onPick: side => { kit.bet = { round, side }; } });   // the player at the table only watches the bets pile up
  relay.onMsg((type, data, role, from) => { rx.receive(type, data, from); gs.receive(type, data, from); });
  let busy = false;
  const choose = side => {
    if (!mine) { gs.pick(side); return; }
    if (busy) return; busy = true;
    partyMoveAction('draw', { side }, round).finally(() => { busy = false; });
  };
  return {
    dur: 30, partyDraw: true, cmd: mine ? 'DRAW A CARD!' : 'CARD TABLE',
    hint: mine ? 'CHOOSE A DECK · ARROWS OR TAP' : t('{name} IS DRAWING', { name: actor.name }),
    update(dt) { kit.charges.tick(dt); },
    draw(tt) {
      const U = PARTY_UI, age = Number.isFinite(tt) ? tt : 9;
      bg('#26304b', '#392d59', now);
      const reveal = partyCardReveal(R); if (reveal) pmChip(400, 74, reveal, 19, '#F28CB1', 430);   // clear of the player chips at the left and the LEAVE plate at the right
      U.badge('CARD TABLE', 400, 124, 40, '#8e6bff', '#FFE14D', U.outBack(age / .3), Math.sin(now * 1.3) * .02 - .015, 340);
      pmChip(400, 178, t('{n} MICROGAMES IN THE PILE', { n: R.extra.pile.length }), 24, '#fff', 560);
      pmChip(400, 214, t('{n} CARDS IN THE POT', { n: R.extra.pot }), 20, '#F28CB1', 520);
      const bets = gs.sides();
      for (const [x, side, label] of [[180, 'left', 'LEFT DECK'], [430, 'right', 'RIGHT DECK']]) {
        const hop = Math.sin(now * 2 + (side === 'left' ? 0 : 1.6)) * 1.5;   // the top card of the deck breathes
        U.shadow(x + 98, 418, 100, 12, .26);
        for (let i = 2; i >= 0; i--) {
          const cp = pmPath(x + i * 5, 262 - i * 5, 190, 100, 16);
          if (i) U.cel(cp, '#5b4d9c', '#3c3170', 0, 6, 4);
          else {
            ctx.save(); ctx.translate(0, hop); U.cel(pmPath(x, 262, 190, 100, 16), '#6e5db8', '#4a3d8c', 0, 8, 4);
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.22)'; U.rr(x + 9, 271, 172, 80, 10); ctx.stroke();
            U.glint(pmPath(x, 262, 190, 100, 16), x + 40, 276, 34, 7, 'rgba(255,255,255,.35)', -.15);
            star(x + 95, 300 + Math.sin(now * 2.2) * 2, 29, 14.5, 5, -.2 + Math.sin(now * 1.4) * .08, '#FFE14D', 3);
            ctx.restore();
          }
        }
        bets[side].forEach((id, i) => { const pl = R.players.find(p => p.id === id); if (pl) { const hp = Math.abs(Math.sin(now * 5 + i * 1.7)) * 7; U.shadow(x + 30 + i * 36, 264, 11 - hp * .3, 3, .22); U.avatar(x + 30 + i * 36, 250 - hp, 12, pl.color, { t: now, seed: i, mood: 'happy' }); } });   // the watchers' bets: their little players hop on the deck they chose
        const on = !mine && gs.mine === side, lbl = mine ? (busy ? 'ONE MOMENT...' : label) : on ? 'YOUR GUESS!' : side === 'left' ? 'GUESS LEFT' : 'GUESS RIGHT', hint = side === 'left' ? '←' : '→';
        const bt = pmBtn(x, 340, 190, 85, () => choose(side), on ? '#ffd23f' : '#9b7bff', { dk: on ? '#c99512' : '#5a3fc0', lit: on, down: busy && mine });
        PARTY_UI.plateLabel([x, bt.y, 190, 76], bt.dy, lbl, hint, { size: 21 });
      }
      if (!mine) {
        sabOrbs(kit.charges, 112, 450, { r: 12, gap: 31, pulse: kit.pulse });
        rx.bar(244, 432, 312, 36);
        const run = rx.streakNow(), per = kit.charges.cfg.comboEvery;
        if (run) pmBar(244, 472, 312, 9, (run % per) / per, '#FF9A3D', { track: '#171428' });
      }
      pmChip(400, 497, mine ? 'MICROGAME CARDS STACK UP · PLAY CARD STARTS THE CHALLENGE' : t('{name} IS DRAWING', { name: actor.name }), 17, '#fff', 720);
      partyCardTable(party.room, false);
      rx.draw();
    },
    key(e) {
      if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') choose('left');
      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Space') choose('right');
      const n = /^Digit([1-5])$/.exec(e.code); if (n && !mine) rx.send(REACT_IDS[n[1] - 1]);
    },
  };
}
/* the watchers' right-hand column: the pile at stake and one big STEAL button per rival (the progress of a steal in progress fills the button) */
function partyCardsSteal(R, round) {
  const U = PARTY_UI, e = R.extra, id = party.you.id, attempt = e.stealing && e.stealing[id], busy = !!attempt && attempt.round === round, done = e.stolen[id] === round;
  pmSlab(608, 130, 176, 122, '#2f2a52', { r: 18, d: 5, o: 3.5 });
  pmTag(696, 128, 150, 'YOU STEAL', '#FFE14D', 17);
  const total = e.pile.length + e.pot;
  const bob = Math.sin(now * 2.4) * 1.3;
  for (let i = 2; i >= 0; i--) {   // the pile at stake: three little cards, the top one holds the count
    ctx.save(); ctx.translate(i * 4, -i * 3 + (i ? 0 : bob)); U.cel(pmPath(650, 176, 76, 28, 9), i ? '#9a80f0' : '#B49CFF', '#6f55c4', 0, 5, 2.5);
    if (!i) U.glint(pmPath(650, 176, 76, 28, 9), 662, 182, 14, 3, 'rgba(255,255,255,.55)', -.1);
    ctx.restore();
  }
  txt(total, 688, 191 + bob, 20, INK);
  txt(t('{n} CARDS AT STAKE', { n: total }), 696, 212, 16, '#FFE14D', 'center', 164);
  txt(t('{n} MICROGAMES TO GO', { n: e.remaining.length }), 696, 234, 14, '#fff', 'center', 164);
  const rivals = R.players.filter(p => !p.left && p.id !== id), h = rivals.length > 2 ? 86 : 100;
  rivals.forEach((p, i) => {
    const y = 262 + i * (h + 8), can = p.score > 0 && !done, aim = busy && attempt.target === p.id, cx = 696, fy = h - 9;
    if (can) {
      const bt = pmBtn(608, y, 176, h, () => partyStartSteal(p.id, round), p.color, { lit: true }), top = bt.y + bt.dy;
      txt(t('STEAL: {name}', { name: p.name }), cx, top + 17, 16, INK, 'center', 160);
      U.avatar(638, top + fy * .62, 16, U.lite(p.color, .35), { t: now, seed: i * 2.3, mood: aim ? 'panic' : 'eager', look: [0, -.5], bob: true });
      txt(t('{n} CARDS', { n: p.score }), 722, top + fy * .62 + 1, 21, INK, 'center', 92);
      if (aim) pmBar(620, top + fy - 11, 152, 7, Math.max(0, Math.min(1, 1 - (attempt.readyAt - Date.now()) / 1200)), '#fff', { track: 'rgba(20,16,28,.6)', o: 2 });
    } else {
      const bt = pmBtn(608, y, 176, h, null, '#d3cfe0', { off: true }), top = bt.y + bt.dy;
      txt(p.name, cx, top + 17, 16, p.color, 'center', 160);
      U.avatar(638, top + fy * .62, 16, p.color, { t: now, seed: i * 2.3, mood: p.score > 0 ? 'idle' : 'sleepy' });
      txt(t('{n} CARDS', { n: p.score }), 722, top + fy * .62 + 1, 19, INK, 'center', 92);
    }
  });
  const msg = busy ? 'STEALING...' : done ? 'CARD STOLEN! WAIT FOR THE NEXT GAME' : '';
  if (msg) pmTag(696, 568, 176, msg, '#F28CB1', 13, { rot: Math.sin(now * 2) * .012 });
}
/* the watchers' middle column: sabotage orbs and one tap per rival (the player at the table included) */
function partyCardsSab(ch, kit) {
  const U = PARTY_UI, list = ch.targets(), ready = ch.charges.ready(), x = 488, n = Math.max(1, list.length), h = Math.min(84, (466 - 194 - 8 - 6 * (n - 1)) / n), tg = ch.target && ch.target();
  pmSlab(x, 122, 104, 338, '#2f2a52', { r: 16, d: 6, o: 3.5 });
  pmTag(540, 140, 92, 'SABOTAGE!', '#FF9A3D', 14);
  sabOrbs(ch.charges, 540, 170, { r: 12, gap: 31, pulse: kit.pulse });
  list.forEach((p, i) => {
    const y = 192 + i * (h + 6), fh = h - 9;
    const bt = pmBtn(x + 4, y, 96, h, () => ch.send(p.id), '#FF9A3D', { off: !ready, lit: ready && tg && tg.id === p.id }), top = bt.y + bt.dy;
    const r = Math.max(12, Math.min(20, (fh - 24) / 2));
    U.avatar(x + 52, top + 3 + r + (fh - 24 - r * 2) / 2, r, p.color, { t: now, seed: i * 2.1, mood: ready ? (tg && tg.id === p.id ? 'panic' : 'idle') : 'sleepy', look: [0, 0] });
    txt(p.name, x + 52, top + fh - 11, 13, INK, 'center', 88);
  });
}
// Normalize dimensions and pointer state for games that read global mouse/pressing or spawn in widescreen space.
function partyGameScope(fn, pointer) {
  const old = { VW, OX, mouse, pressing };
  VW = W; OX = 0;
  if (pointer) { mouse = pointer.pos; pressing = pointer.held; }
  try { return fn(); } finally { VW = old.VW; OX = old.OX; mouse = old.mouse; pressing = old.pressing; }
}
function partyWrapGame(base, R, sp) {
  const actor = partyActor(R), mine = actor.id === party.you.id, round = R.round;
  const balloon = R.mode === 'balloon', cards = R.mode === 'cards', canSab = SAB_MODES.includes(R.mode), watcher = !mine && (balloon || cards);   // watchers get the small television and the trap kit below it
  const view = watcher ? { x: 20, y: 126, w: 456, h: 342, scale: .57 } : { x: 16, y: 124, w: 576, h: 432, scale: .72 };
  const g = { ...base, partyHelper: !mine, partyScene: true, wide: false, partyDark: R.mode === 'lantern' && mine };
  if (!mine) { g.dur = 3600; delete g.result; }
  let instruction = base.cmd || 'MICROGAME';
  g.cmd = mine ? instruction : R.mode === 'lantern' ? 'LIGHT THE WAY!' : R.mode === 'balloon' ? 'PUMP THE BALLOON!' : 'STEAL CARDS!';
  g.hint = mine ? base.hint : R.mode === 'lantern' ? 'MOVE THE LIGHT · MOUSE / TOUCH / ARROWS' : R.mode === 'balloon' ? 'TAP / SPACE TO INFLATE · FIX JAMS WITH A / D · GRAB GOLD BUBBLES' : 'TAP A RIVAL TO STEAL ONE CARD PER MICROGAME';
  g.thint = mine ? base.thint : g.hint;
  let lx = 400, ly = 300, held = {}, elapsed = 0, lightAt = -1, taps = 0, lastTap = -1, sentAt = 0, pumping = false, frameAt = -1, frame = null, frameTime = -1, frameSeq = 0, sharedTime = 0, sharedDuration = 1, sharedClockAt = 0;
  let combo = 0, comboAt = -9, pumpKick = 0;
  const tapLog = [];
  const lights = {}, pointer = { pos: { x: 400, y: 300 }, held: false };
  const relay = duoCtx(R);
  // Shared kit (js/party-sab.js): charges, sabotage channel and the pumpers' trap minigames. Built before onMsg, which replays buffered messages at once.
  const kit = cards ? partyCardsKit(R) : null;   // CARDS keeps its charges from round to round (they are also earned while a deck is picked)
  const charges = canSab ? kit ? kit.charges : createSabCharges() : null;
  const ch = canSab ? createSabChannel(R, sabDirectRelay(R2 => R2.id === R.id && (cards || R2.round === round) ? charges : null), { charges, actorId: actor.id }) : null;   // straight to the server: it rate limits throws and a refused one gives the charge back
  const traps = watcher ? balloon ? createIdleTraps({ onReward: () => charges.earn('trap') }) : partyCardsTraps(kit) : null;
  const capture = mine ? document.createElement('canvas') : null;
  if (capture) { capture.width = 400; capture.height = 300; }
  const dark = R.mode === 'lantern' && mine ? document.createElement('canvas') : null;
  if (dark) { dark.width = W; dark.height = H; }
  relay.onMsg((type, data, role, from) => {   // `role` is the sender's seat in a DUO game; here only the id matters
    if (ch) ch.receive(type, data, from);
    if (type === 'light' && from !== actor.id && data && Number.isFinite(data.x) && Number.isFinite(data.y)) {
      lights[from] = { x: Math.max(0, Math.min(W, data.x)), y: Math.max(0, Math.min(H, data.y)), at: now };
    }
    if (!mine && type === 'frame' && from === actor.id && data && typeof data.image === 'string' && data.image.startsWith('data:image/jpeg;base64,') && data.image.length < 60000) {
      if (typeof data.cmd === 'string' && data.cmd.length < 120) instruction = data.cmd;
      if (Number.isFinite(data.time) && Number.isFinite(data.duration)) { sharedTime = Math.max(0, data.time); sharedDuration = Math.max(1, data.duration); sharedClockAt = now; }
      const seq = ++frameSeq, incoming = new Image();
      incoming.onload = () => { if (seq === frameSeq) { frame = incoming; frameTime = now; } };
      incoming.src = data.image;
    }
  });
  const localPoint = data => ({ x: Math.max(0, Math.min(W, (data.x - view.x) / view.scale)), y: Math.max(0, Math.min(H, (data.y - view.y) / view.scale)) });
  const inside = data => data.x >= view.x && data.x <= view.x + view.w && data.y >= view.y && data.y <= view.y + view.h;
  const keyMap = {};   // physical key -> key actually delivered, so a FLIP that starts or ends mid-press never leaves a key stuck
  const invoke = (type, data) => {
    const flip = mine && sabMirrored(ch && ch.active());
    if (type === 'move' || type === 'down' || type === 'up') {
      if (type === 'down' && !inside(data)) return;
      data = localPoint(data); if (flip) data = { x: W - data.x, y: data.y }; pointer.pos = data;
      if (type === 'down') pointer.held = true;
      if (type === 'up') pointer.held = false;
    }
    else if (type === 'key') { const phys = data.code; if (flip) data = sabMirrorKey(data); keyMap[phys] = data; }
    else if (type === 'keyup') { const phys = data.code, sent = keyMap[phys]; delete keyMap[phys]; data = sent ? Object.assign({}, data, { code: sent.code, key: sent.key }) : flip ? sabMirrorKey(data) : data; }
    return partyGameScope(() => base[type] && base[type](data), pointer);
  };
  // Pumper mini-game: tapping pumps; the traps (stuck valve, gold bubbles, dial, arrows, fly) come from createIdleTraps and interrupt the mashing.
  const tap = () => {
    if (mine || !balloon || elapsed - lastTap < .085) return;
    lastTap = elapsed; pumpKick = 1;
    const v = traps.gate(); if (!v) return;
    taps = Math.min(8, taps + v); balloonView.opt += v * balUnit(R);
    combo = elapsed - comboAt < .45 ? combo + 1 : 1; comboAt = elapsed; tapLog.push(elapsed);
    const bonus = charges.earn('combo', combo);
    balTry(() => { sfx.blip(Math.min(16, combo / 2) + balloonView.shown * 8); if (bonus) { ring(150, 536, '#FFE14D', 70, .4); floatText(t('COMBO x{n}', { n: combo }), 116, 478, '#FFE14D', 22); } });
  };
  g.update = (dt, time) => {
    elapsed += dt;
    const attempt = party.room && party.room.extra.stealing && party.room.extra.stealing[party.you.id];
    if (!mine && R.mode === 'cards' && attempt && attempt.round === round && party.room.state === 'round') {
      const busy = party.stealBusy;
      if (Date.now() >= attempt.readyAt && (!busy || !busy.completing)) {
        party.stealBusy = { target: attempt.target, round, completing: true };
        partyMoveAction('steal', { target: attempt.target }, round).finally(() => { party.stealBusy = null; });
      }
    } else if (party.stealBusy && party.stealBusy.round !== round) party.stealBusy = null;
    if (mine) { partyGameScope(() => base.update(dt, time), pointer); g.result = base.result; g.pts = base.pts; g.timeWin = base.timeWin; }
    if (!mine && R.mode === 'lantern') {
      lx = Math.max(0, Math.min(W, lx + ((held.ArrowRight || held.KeyD ? 1 : 0) - (held.ArrowLeft || held.KeyA ? 1 : 0)) * dt * 440));
      ly = Math.max(0, Math.min(H, ly + ((held.ArrowDown || held.KeyS ? 1 : 0) - (held.ArrowUp || held.KeyW ? 1 : 0)) * dt * 440));
      if (elapsed - lightAt > .08) { lightAt = elapsed; relay.send('light', { x: Math.round(lx), y: Math.round(ly) }, true); }
    }
    if (charges) charges.tick(dt);
    if (traps) {
      pumpKick = Math.max(0, pumpKick - dt * 7);
      if (elapsed - comboAt > .6) combo = 0;
      while (tapLog.length && elapsed - tapLog[0] > 1) tapLog.shift();
      traps.update(dt);
    }
    if (!mine && R.mode === 'balloon' && taps && !pumping && elapsed - sentAt > .22) {
      const count = taps; taps = 0; pumping = true; sentAt = elapsed;
      partyMoveAction('pump', { count }, round).finally(() => { pumping = false; });
    }
  };
  const drawPumpUI = current => {
    const U = PARTY_UI, e = current.extra, m = me(), turnN = (e.turn || {})[party.you.id] || 0, totalN = (e.contrib || {})[party.you.id] || 0, turboOn = traps.turboOn(), rate = tapLog.length, hot = combo >= 10;
    pmSlab(488, 122, 104, 338, '#2f2a52', { r: 16, d: 6, o: 3.5 });
    pmTag(540, 140, 92, 'YOUR AIR', '#FFE14D', 14);
    U.shadow(540, 219, 26 - pumpKick * 3, 6, .26);
    ctx.save(); ctx.translate(540, 217); ctx.scale(1 + pumpKick * .09, 1 - pumpKick * .09); ctx.translate(-540, -217);   // squashes with every tap
    U.avatar(540, 190, 27, m.color, { t: now, seed: 1, mood: turboOn ? 'eager' : rate > 4 ? 'happy' : 'idle', look: [0, -.35] });
    ctx.restore();
    pmSlab(494, 228, 92, 46, '#211d40', { r: 11, d: 3, o: 2.5, gloss: .06 });
    txt('AIR THIS TURN', 540, 238, 10, '#fff', 'center', 84); txt(String(turnN), 540, 259, 30, m.color, 'center', 84);
    pmSlab(494, 282, 92, 34, '#211d40', { r: 11, d: 3, o: 2.5, gloss: .06 });
    txt('TOTAL', 540, 291, 10, '#fff', 'center', 84); txt(String(totalN), 540, 306, 19, '#fff', 'center', 84);
    pmSlab(494, 324, 92, 42, hot ? U.mix('#FF9A3D', '#FFE14D', .5 + .5 * Math.sin(now * 10) * .5) : '#211d40', { r: 11, d: 3, o: 2.5, gloss: hot ? .3 : .06 });
    if (hot) {   // the combo is on fire: an inked flame that licks upwards
      const fl = Math.sin(now * 14) * .06;
      ctx.save(); ctx.translate(510, 360); ctx.rotate(Math.sin(now * 9) * .06); ctx.scale(.62 + fl, .62 - fl);
      U.cel(U.P('M0 0C-24 -4 -28 -26 -10 -46C-8 -34 -2 -34 0 -52C14 -40 26 -20 24 -8C22 3 8 5 0 0Z'), '#FF9A3D', '#d3571a', 4, 4, 4);
      U.inkP(U.P('M0 -2C-12 -4 -13 -16 -4 -26C0 -18 8 -14 10 -8C10 -3 5 -1 0 -2Z'), '#FFE14D', 0); ctx.restore();
    }
    const cx = hot ? 556 : 540;
    txt('COMBO', cx, 334, 10, hot ? INK : '#fff', 'center', hot ? 52 : 84); txt('x' + combo, cx, 354, hot ? 22 : 24, hot ? INK : '#fff', 'center', hot ? 52 : 84);
    pmChip(540, 388, t('{n}/s', { n: rate }), 12, '#9fe3ff', 66);
    sabPicker(ch, 492, 414, 96);
    pmSlab(12, 484, 580, 98, '#2f2a52', { r: 20, d: 6, o: 4 });
    const stuck = traps.stuck(), pk = pumpKick, col = stuck ? '#d3cfe0' : turboOn ? '#ffd23f' : '#4fd06a', dk = stuck ? '#8f88a6' : turboOn ? '#c99512' : '#24803a';
    ctx.save(); if (stuck && traps.shaking()) ctx.translate(Math.sin(now * 90) * 4, 0);
    const bt = pmBtn(22, 492, 188, 88, null, col, { dk, off: stuck, lit: turboOn, down: pk > .4 }), top = bt.y + bt.dy;
    const hy = top + 20 + pk * 9;   // the handle goes down with every tap
    U.rr(181, hy + 7, 9, 26 + (1 - pk) * 4, 4); U.ink('#8f9cb3', 2.5);
    U.rr(170, top + 40, 31, 30, 8); U.ink('#c9ced6', 3); ctx.fillStyle = 'rgba(255,255,255,.55)'; U.rr(174, top + 44, 6, 20, 3); ctx.fill();
    U.rr(162, hy, 47, 11, 5.5); U.ink('#dde2ea', 3); ctx.fillStyle = 'rgba(255,255,255,.7)'; U.rr(167, hy + 2.5, 24, 3, 1.5); ctx.fill();
    PARTY_UI.plateLabel([22, bt.y, 188, 79], bt.dy, stuck ? 'STUCK!' : 'PUMP!', 'SPACE / TAP', { size: 30, x: 91, w: 124, off: stuck });
    ctx.restore();
    btns.push({ x: 22, y: 492, w: 188, h: 88, fn: tap });
    traps.draw(222, 492, 362, (mx, y, mw) => {
      const cxm = mx + mw / 2, pipeY = 527, pw = mw - 40;
      pmSlab(mx, 492, mw, 82, '#3a3463', { r: 14, d: 4, o: 3, gloss: .1 });
      txt(t('{n}/s', { n: rate }), mx + 14, 506, 15, '#9fe3ff', 'left', 80);
      if (combo > 1) txt(t('COMBO x{n}', { n: combo }), mx + mw - 14, 506, 17, combo >= 10 ? '#FF9A3D' : '#fff', 'right', 160);
      const pp = pmPath(mx + 14, pipeY, pw, 20, 10);   // the air hose: a steel pipe with bubbles racing towards the balloon
      U.cel(pp, turboOn ? '#ffd23f' : '#c9ced6', turboOn ? '#c99512' : '#8f9cb3', 0, 5, 3);
      ctx.save(); ctx.clip(pp);
      for (let i = 0; i < 6; i++) { const bx = mx + 20 + ((now * (70 + rate * 45) + i * 52) % (pw - 12)), bs = turboOn ? 5 : 3.6; ctx.globalAlpha = rate ? .95 : .35; U.el(bx, pipeY + 10, bs, bs); ctx.fillStyle = turboOn ? '#fff3a0' : '#9fe3ff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.translate(mx + mw - 19, pipeY + 10); ctx.scale(1 + Math.max(0, rate) * .03 * Math.sin(now * 14), 1); U.inkP(U.P('M-10 -13L11 0L-10 13Z'), turboOn ? '#FFE14D' : '#fff', 3); ctx.restore();
      if (turboOn) {
        pmBar(mx + 14, 515, mw - 28, 9, Math.max(0, traps.turboLeft() / 4), 'hsl(' + Math.round(now * 300 % 360) + ',90%,60%)', { o: 2, track: '#171428' });
        txt(t('TURBO x2 · {n}s', { n: Math.ceil(traps.turboLeft()) }), cxm, 564, 15, '#FFE14D', 'center', 340);
      } else if (traps.soon()) U.badge('HEADS UP!', cxm, 562, 14, '#ff4d5e', '#fff', 1 + .05 * Math.sin(now * 16), Math.sin(now * 12) * .02, 300);
      else txt('KEEP TAPPING! TRAPS ARE COMING', cxm, 564, 14, '#c9c6e0', 'center', 340);
    });
  };
  g.draw = gameTime => {
    const current = party.room, hit = ch && ch.active(), fxFull = !mine ? sabBegin(hit, ctx, 'full') : null;   // a helper's whole screen takes the hit (shake, ink, pixels...)
    bg('#26304b', '#392d59', now);
    const bez = balloon ? balMix(actor.color, '#ff3b3b', (partyBalloonShown(current) - .7) / .3) : actor.color;
    // Chunky television bezel keeps the microgame and the surrounding party props in one stage: an inked, cel-shaded slab with the screen set into it.
    const bz = [view.x - 8, view.y - 8, view.w + 16, view.h + 16], bzp = pmPath(bz[0], bz[1], bz[2], bz[3], 22);   // the frame grows outwards: the screen keeps every pixel of the game
    ctx.fillStyle = 'rgba(20,16,28,.32)'; PARTY_UI.rr(bz[0] + 5, bz[1] + 9, bz[2], bz[3], 22); ctx.fill();
    PARTY_UI.cel(bzp, bez, PARTY_UI.shade(bez, .34), 0, 7, 5);
    PARTY_UI.glint(bzp, bz[0] + 64, bz[1] + 3.5, 56, 3.5, 'rgba(255,255,255,.5)', 0);
    PARTY_UI.rr(view.x - 2.5, view.y - 2.5, view.w + 5, view.h + 5, 13); ctx.fillStyle = INK; ctx.fill();
    ctx.save(); ctx.clip(pmPath(view.x, view.y, view.w, view.h, 11));
    ctx.translate(view.x, view.y); ctx.scale(view.scale, view.scale);
    if (mine) {
      partyGameScope(() => { const fx = sabBegin(hit, ctx, 'view'); try { base.draw(gameTime); if (typeof drawParts === 'function') drawParts(); } finally { sabEnd(fx); } }, pointer);
      // Capture the actor's rendered game before darkness and controls. Helpers never simulate RNG or outcomes.
      if (elapsed - frameAt >= partyFrameGap() && !capture.partyEncoding && capture.getContext && capture.toDataURL) {
        frameAt = elapsed;
        try {
          capture.getContext('2d').drawImage(cv, view.x + OX, view.y, view.w, view.h, 0, 0, 400, 300);
          partyCaptureFrame(capture, { cmd: instruction, hint: base.hint || '', time: Math.max(0, base.dur / Math.sqrt(sp) - gameTime), duration: base.dur / Math.sqrt(sp) }, data => relay.send('frame', data, true));
        } catch (_) { /* Tainted third-party canvases cannot be broadcast. */ }
      }
      if (dark) {
        const mask = dark.getContext('2d'); mask.globalCompositeOperation = 'source-over'; mask.clearRect(0, 0, W, H);
        mask.fillStyle = '#090911'; mask.fillRect(0, 0, W, H); mask.globalCompositeOperation = 'destination-out';
        for (const p of current.players.filter(p => !p.left && p.id !== actor.id)) {
          const light = lights[p.id]; if (!light || now - light.at > 2) continue;
          mask.beginPath(); mask.arc(light.x, light.y, 125, 0, Math.PI * 2); mask.fill();
        }
        mask.globalCompositeOperation = 'source-over'; ctx.drawImage(dark, 0, 0);
      }
    } else {
      const fx = sabBegin(hit, ctx, 'tv');
      ctx.fillStyle = '#19172d'; ctx.fillRect(0, 0, W, H);
      if (frame) ctx.drawImage(frame, 0, 0, W, H);
      if (!frame || now - frameTime > 3) txt('CONNECTING TO THE PLAYER...', 400, 300, 28, '#FFE14D', 'center', 740);
      if (R.mode === 'lantern') { ctx.strokeStyle = me().color; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(lx, ly, 125, 0, Math.PI * 2); ctx.stroke(); }
      sabEnd(fx);
    }
    ctx.restore();
    txt(instruction, 302, 28, 24, '#FFE14D', 'center', 550);
    const playing = t('{name} IS PLAYING', { name: actor.name });
    txt(playing, 302, 59, 23, actor.color, 'center', 560);
    const pw = ctx.measureText(playing).width;   // txt() leaves its font on the context: the width of what was just drawn
    if (302 - pw / 2 - 24 > 22) PARTY_UI.avatar(302 - pw / 2 - 22, 58, 13, actor.color, { t: now, seed: 3, mood: mine ? 'eager' : 'smug', look: [1, 0], bob: true });   // the one at the table, as a tiny portrait
    if (mine) { if (hit) pmChip(302, 89, t('{name} SABOTAGES YOU!', { name: hit.name.toUpperCase() }), 16, '#FF9A3D', 540, { a: .75 + .25 * Math.sin(now * 14), bg: '#5a1626' }); else txt(base.hint || '', 302, 89, 17, '#fff', 'center', 552); }
    const seconds = mine ? Math.max(0, base.dur / Math.sqrt(sp) - gameTime) : Math.max(0, sharedTime - (now - sharedClockAt));
    const clockDuration = mine ? base.dur / Math.sqrt(sp) : sharedDuration;
    pmTag(692, 28, 156, modeLabel(R.mode), '#FFE14D', 17);
    txt(t('{n} SECONDS', { n: Math.ceil(seconds) }), 692, 66, 19, seconds < 2 ? '#F28CB1' : '#fff', 'center', 168);
    if (R.mode === 'lantern') txt(t('{n} TEAM LIVES', { n: current.lives }), 692, 97, 16, '#7BD88F', 'center', 168);
    const clockK = Math.max(0, Math.min(1, seconds / clockDuration));   // the fuse of the round: a rounded bar with a little spark at its head
    pmBar(16, 103, 576, 9, clockK, seconds < 2 ? '#F28CB1' : '#7BD88F', { track: '#1b1830' });
    if (clockK > .01) PARTY_UI.orb(16 + Math.max(9, 576 * clockK) - 4.5, 107.5, 5, { col: seconds < 2 ? '#FFE14D' : '#fff3a0', state: 'full', t: now });
    const cardWatch = cards && !mine;
    if (!balloon && !cardWatch) {
      pmSlab(606, 132, 180, 428, '#2f2a52', { r: 18, d: 6, o: 3.5 });
      pmTag(696, 132, 156, mine ? 'YOU PLAY' : R.mode === 'lantern' ? 'YOU LIGHT' : 'YOU STEAL', '#FFE14D', 17);
    }
    if (!balloon && !cardWatch && !cards) {
      txt(mine ? 'YOUR TEAMMATES' : 'HELPER TEAM', 696, 178, 15, '#fff', 'center', 164);
      current.players.filter(p => !p.left && p.id !== actor.id).forEach((p, i) => txt(p.name, 696, 201 + i * 21, 15, p.color, 'center', 164));
    }
    if (balloon) {
      partyBalloonSide(current, mine);
      if (!mine) drawPumpUI(current);
    } else if (cardWatch) {
      partyCardsSab(ch, kit); partyCardsSteal(current, round);
      pmSlab(12, 484, 580, 98, '#2f2a52', { r: 20, d: 6, o: 4 });
      traps.draw(16, 492, 572, (mx, y, mw) => {
        pmSlab(mx, y, mw, 80, '#3a3463', { r: 14, d: 4, o: 3, gloss: .1 });
        if (traps.soon()) PARTY_UI.badge('HEADS UP!', mx + mw / 2, y + 42, 26, '#ff4d5e', '#fff', 1 + .04 * Math.sin(now * 16), Math.sin(now * 12) * .018, 540);
        else {
          PARTY_UI.orb(mx + 30, y + 41, 12, { col: '#FF9A3D', state: 'full', t: now });
          txt('WIN TRAPS TO CHARGE SABOTAGE', mx + mw / 2 + 12, y + 41, 20, '#c9c6e0', 'center', mw - 90);
        }
      });
    } else if (cards) {   // the player at the table: the pile, and who holds what (watchers have partyCardsSteal)
      const U = PARTY_UI, total = current.extra.pile.length + current.extra.pot, bob = Math.sin(now * 2.4) * 1.3;
      txt(t('{n} CARDS AT STAKE', { n: total }), 696, 305, 19, '#FFE14D', 'center', 168);
      txt(t('{n} MICROGAMES TO GO', { n: current.extra.remaining.length }), 696, 345, 17, '#fff', 'center', 168);
      txt('WIN TO KEEP THE PILE', 696, 396, 15, '#fff', 'center', 168);
      txt('OTHERS CAN STEAL', 696, 427, 15, '#F28CB1', 'center', 168);
      for (let i = 2; i >= 0; i--) { ctx.save(); ctx.translate(i * 4, -i * 3 + (i ? 0 : bob)); U.cel(pmPath(650, 252, 76, 32, 9), i ? '#9a80f0' : '#B49CFF', '#6f55c4', 0, 5, 2.5); if (!i) U.glint(pmPath(650, 252, 76, 32, 9), 662, 259, 14, 3, 'rgba(255,255,255,.55)', -.1); ctx.restore(); }
      txt(total, 688, 270 + bob, 21, INK);
      current.players.filter(p => !p.left).forEach((p, i) => txt(t('{name}: {n} CARDS', { name: p.name, n: p.score }), 696, 462 + i * 30, 15, p.color, 'center', 164));
    } else {
      txt(mine ? 'YOUR FRIENDS MOVE THE LIGHT' : 'MOVE THE LIGHT', 696, 310, 19, '#FFE14D', 'center', 166);
      txt(mine ? 'PLAY INSIDE THE LIGHT' : 'MOUSE / TOUCH', 696, 344, 16, '#fff', 'center', 166);
      txt(mine ? 'FOLLOW YOUR GAME CONTROLS' : 'OR ARROW KEYS', 696, 371, 16, '#fff', 'center', 166);
      txt('KEEP THE ACTION LIT!', 696, 425, 15, '#FFE14D', 'center', 168);
      txt('WIN TOGETHER', 696, 470, 18, '#7BD88F', 'center', 168);
    }
    if (!mine && !canSab) pmChip(400, 578, g.hint, 17, '#fff', 740);
    if (canSab && !watcher) sabStrip(ch);
    sabEnd(fxFull);
  };
  for (const type of ['move', 'down', 'up', 'key', 'keyup']) g[type] = data => {
    if (mine) { if (canSab && type === 'key' && data.code === 'KeyQ' && !data.repeat) ch.send(); else invoke(type, data); }
    else if (R.mode === 'lantern') {
      if ((type === 'move' || type === 'down') && inside(data)) { const p = localPoint(data); lx = p.x; ly = p.y; }
      if (type === 'key' || type === 'keyup') held[data.code] = type === 'key';
    } else if (cards && type === 'key' && !data.repeat) {   // a watcher: a trap may take the key, then E throws a sabotage and R changes the target
      if (traps.key(data.code)) { /* a trap took the key */ }
      else if (data.code === 'KeyE') ch.send();
      else if (data.code === 'KeyR') ch.next();
    } else if (balloon && type === 'key' && !data.repeat) {
      const c = data.code;
      if (c === 'Space' || c === 'ArrowDown') tap();
      else if (traps.key(c)) { /* a trap took the key */ }
      else if (c === 'KeyE') ch.send();
      else if (c === 'KeyR') ch.next();
    }
  };
  return g;
}
// Passive spectators watch rendered pixels; the game keeps its original input, state and DUO channel.
// In SURVIVAL and KNOCKOUT the living also take the ghosts' sabotage, in VERSUS the soft sabotage of players who already finished, in TEAM their cheers: it covers the game (and so the frames the spectators see)
// and a pill says who did it (js/party-ghost.js, js/party-wait.js).
function partySpectatorGame(base, R, sp) {
  if (base.partyScene || base.partyDraw || typeof base.draw !== 'function') return base;
  const draw = base.draw, haunted = partyGhostReceiver(R) || partyWaitReceiver(R);
  let capture = null, frameAt = -Infinity;
  base.draw = function (...args) {
    const fx = haunted ? sabBegin(haunted.active(), ctx, 'view') : null;
    let value; try { value = draw.apply(this, args); } finally { sabEnd(fx); }
    if (haunted) { partyGhostBanner(haunted.active()); if (haunted.after) haunted.after(); }   // after(): a teammate's cheer (TEAM)
    if (typeof partySendFrame !== 'function' || now - frameAt < partyFrameGap() || capture && capture.partyEncoding) return value;
    frameAt = now;
    try {
      if (!capture) { capture = document.createElement('canvas'); capture.width = 400; capture.height = 300; }
      if (!capture.getContext || !capture.toDataURL) return value;
      capture.getContext('2d').drawImage(cv, OX, 0, W, H, 0, 0, 400, 300);
      partyCaptureFrame(capture, {
        cmd: base.cmd || '', hint: base.hint || '',
        time: Math.max(0, base.dur / Math.sqrt(sp) - (Number(args[0]) || 0)),
      }, partySendFrame);
    } catch (_) { /* A game canvas unavailable for capture must still keep playing. */ }
    return value;
  };
  return base;
}
function partyBuildGame(R, sp, dc) {
  if (R.game === 'pc_draw') return partyDrawGame(R);
  if (partyTurnMode(R) && R.extra.actor !== party.you.id) return partyWrapGame({}, R, sp);
  const base = partyTurnMode(R) ? partyGameScope(() => REGMAP[R.game].fn(sp, dc), { pos: { x: 400, y: 300 }, held: false }) : REGMAP[R.game].fn(sp, dc);
  if (R.game === 'pt_mash' || R.game === 'pt_grab') {
    const update = base.update;
    base.update = (dt, t) => { update(dt, t); base.timeWin = base.pts >= base.need; };
  }
  return partyTurnMode(R) ? partyWrapGame(base, R, sp) : partySpectatorGame(base, R, sp);
}
