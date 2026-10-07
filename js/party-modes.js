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
function partyCardTable(R, interactive) {
  const all = R.players.filter(p => !p.left), w = 720 / all.length;
  all.forEach((p, i) => {
    const x = 40 + i * w, can = interactive && p.id !== party.you.id && p.score > 0 && R.extra.stolen[party.you.id] !== R.round;
    if (can) button(x + 3, 518, w - 6, 68, t('STEAL: {name}', { name: p.name }), () => partyStartSteal(p.id, R.round), { size: 18, fill: p.color });
    else { box(x + 3, 518, w - 6, 68, '#302b50', 3); txt(p.name, x + w / 2, 539, 17, p.color, 'center', w - 12); }
    txt(t('{n} CARDS', { n: p.score }), x + w / 2, 572, 19, can ? INK : '#FFE14D', 'center', w - 12);
    if (p.id === R.extra.actor && !interactive) { ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 3; ctx.strokeRect(x, 515, w, 74); }   // whose turn it is at the table
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
  const e = R.extra, b = balloonView, list = R.players.filter(p => !p.left && p.id !== e.actor).slice(0, rows), turn = e.turn || {}, top = Math.max(1, ...list.map(p => turn[p.id] || 0));
  list.forEach((p, i) => {
    const yy = y + i * (rh + 5), live = R.state === 'round' && now - (b.pumping[p.id] || -9) < .8, mine = p.id === party.you.id, n = turn[p.id] || 0;
    box3(x, yy, w, rh, live ? balMix('#35406a', p.color, .5) : '#2b2845', 3, 3);
    claude(x + 17, yy + rh - 3, 1.15, { col: p.color, mood: live ? 'happy' : null });
    if (mine) { ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 3; ctx.strokeRect(x - 1, yy - 1, w + 2, rh + 2); }
    txt(p.name, x + 36, yy + 12, 14, p.color, 'left', w - 100);
    txt(live ? 'PUMPING!' : 'IDLE', x + 36, yy + rh - 9, 11, live ? '#fff' : '#9a98ad', 'left', 64);
    if (live) for (let k = 0; k < 3; k++) { ctx.globalAlpha = Math.max(0, 1 - ((now * 3 + k * .33) % 1)); txt('>', x + 100 + k * 9, yy + rh - 9, 12, '#fff'); } ctx.globalAlpha = 1;
    txt('+' + n, x + w - 8, yy + 13, 17, '#FFE14D', 'right', 46);
    ctx.fillStyle = '#14101c'; ctx.fillRect(x + w - 62, yy + rh - 13, 54, 7); ctx.fillStyle = p.color; ctx.fillRect(x + w - 62, yy + rh - 13, 54 * n / top, 7);
    if (n > 0 && n === top && list.length > 1) star(x + 8, yy + 9, 8, 4, 5, -Math.PI / 2, '#FFE14D', 2);
  });
}
/* right-hand column: the balloon, its pressure and who is inflating it */
function partyBalloonSide(R, mine) {
  const b = balloonView, l = partyBalloonShown(R), pu = .5 + .5 * Math.sin(now * (6 + l * 14));
  box3(606, 110, 180, 262, balMix('#2a2547', '#5a1626', l * l), 4, 4);
  ctx.save(); ctx.beginPath(); ctx.rect(606, 110, 180, 262); ctx.clip();
  for (let i = 0; i < 8; i++) { const a = now * .15 + i * Math.PI / 4; ctx.fillStyle = 'rgba(255,255,255,' + (.04 + l * .05).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(696, 232); ctx.arc(696, 232, 260, a, a + .2); ctx.closePath(); ctx.fill(); }
  const leaking = R.state === 'round' && now > b.roundAt + BAL_PRE && now - b.lastPump > .9 && l > .02;
  partyBalloonDraw(696, 226, 56, l, { leak: leaking });
  const ry = 56 * (.5 + .8 * l);
  b.pops.forEach(p => { const age = now - p.at; if (age > 1) return; const pl = R.players.find(q => q.id === p.id); ctx.globalAlpha = 1 - age; txt('+' + p.n, 696 + (p.x - .5) * 120, 226 - ry - 6 - age * 46, 20, pl ? pl.color : '#fff'); ctx.globalAlpha = 1; });
  if (l > .8) { ctx.fillStyle = 'rgba(255,40,60,' + ((l - .8) * .9 * pu * .6).toFixed(3) + ')'; ctx.fillRect(606, 110, 180, 262); }
  ctx.restore();
  txt(mine ? 'YOU PLAY' : 'YOU PUMP', 650, 128, 13, '#FFE14D', 'center', 80);
  partyPumpers(R, 608, 386, 176, 40, 3);
}
/* big popping scene used on the between-turns card */
function drawBalloonBetween(R, L) {
  const e = R.extra, b = balloonView, res = L.results[0] || { id: e.actor, r: 'lose' }, actor = R.players.find(p => p.id === res.id) || partyActor(R), popped = !!e.loser, passed = res.r === 'win';
  partyBalloonShown(R);
  const fast = L.final ? 1 : 2.6, T = st * fast;   // regular turns blink by; only the last one gets its full show
  const k = easeOut(Math.min(1, T / 1.1)), lv = (popped ? Math.min(1, (e.start || 0) + (1 - (e.start || 0)) * k) : (e.start || 0) + ((e.danger || 0) - (e.start || 0)) * k);
  box3(30, 108, 350, 392, popped && T > .9 ? '#4a1d2e' : balMix('#2a2547', '#5a1626', lv * lv), 4, 5);
  ctx.save(); ctx.beginPath(); ctx.rect(30, 108, 350, 392); ctx.clip();
  for (let i = 0; i < 10; i++) { const a = now * .15 + i * Math.PI / 5; ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(205, 290); ctx.arc(205, 290, 400, a, a + .18); ctx.closePath(); ctx.fill(); }
  if (popped && T > .9) {
    if (b.poppedRound !== R.round) { b.poppedRound = R.round; balTry(() => { burst(205, 290, '#ff5c8a', 34, 520); burst(205, 290, '#FFE14D', 18, 380); ring(205, 290, '#fff', 150, .5); confetti(205, 290, 40); shake(16, .6); sfx.pop(); noise(.5, .12, 900, 120, 'lowpass'); }); }
    const sc = easeOut(Math.min(1, (T - .9) / .25));
    [[-70, 40, .4], [60, 70, -.9], [-10, 105, 2.2], [90, -20, 1.2]].forEach(([dx, dy, a]) => { ctx.save(); ctx.translate(205 + dx * sc, 330 + dy * sc * .6); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-26, 12); ctx.lineTo(0, -22); ctx.lineTo(30, 14); ctx.closePath(); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = '#F28CB1'; ctx.fill(); ctx.restore(); });
    ctx.save(); ctx.translate(205, 250); ctx.rotate(-.1); ctx.scale(.5 + sc * .45, .5 + sc * .45); star(0, 0, 110, 56, 12, 0, '#FFE14D', 5); txt('BOOM!', 0, 8, 56, '#FF3B3B', 'center', 170); ctx.restore();
  } else partyBalloonDraw(205, 284, 84, lv, { leak: false });
  ctx.restore();
  const col = popped ? '#FF3B3B' : passed ? '#5CFF7A' : '#FFE14D';
  box3(400, 108, 370, 112, '#35406a', 4, 5);
  claude(450, 205, 3.4, { col: actor.color, mood: popped ? 'sad' : passed ? 'happy' : null });
  txt(popped ? 'POPPED!' : passed ? 'TURN PASSED!' : 'TRY AGAIN!', 600, 140, popped ? 46 : 36, col, 'center', 280);
  txt(actor.name, 600, 178, 20, actor.color, 'center', 280);
  txt(popped ? t('{name} POPPED THE BALLOON!', { name: actor.name.toUpperCase() }) : passed ? 'WON THE MICROGAME' : 'LOST THE MICROGAME', 600, 203, 13, '#fff', 'center', 330);
  if (!passed && !popped) { box(412, 228, 346, 30, '#5a1626', 3); txt('+8 AIR · THE BALLOON GREW', 585, 244, 16, '#FF8A8A', 'center', 330); }
  txt(L.final ? 'WHOLE GAME · TOTAL AIR' : 'AIR ADDED BY', 585, 284, 15, '#FFE14D', 'center', 340);
  const turn = (L.final ? e.contrib : e.turn) || {}, list = R.players.filter(p => !p.left && p.id !== actor.id), top = Math.max(1, ...list.map(p => turn[p.id] || 0));
  list.slice(0, 3).forEach((p, i) => {
    const y = 298 + i * 52, g = easeOut((T - .1 - i * .1) / .4), n = turn[p.id] || 0;
    box3(400, y, 370, 44, '#2b2845', 3, 3); claude(430, y + 40, 1.6, { col: p.color, mood: n === top && n > 0 ? 'happy' : null });
    txt(p.name, 462, y + 15, 17, p.color, 'left', 150);
    ctx.fillStyle = '#14101c'; ctx.fillRect(462, y + 26, 220, 10); ctx.fillStyle = p.color; ctx.fillRect(462, y + 26, 220 * (n / top) * Math.max(0, g), 10);
    txt('+' + Math.round(n * Math.max(0, g)), 750, y + 22, 24, '#FFE14D', 'right', 60);
    if (n > 0 && n === top && list.length > 1) { star(580, y + 15, 10, 5, 5, -Math.PI / 2, '#FFE14D', 2); txt('MVP', 596, y + 15, 12, '#FFE14D', 'left', 36); }
  });
  if (L.final) {
    const all = Object.values(e.contrib || {}).reduce((a, n) => a + n, 0), best = Math.max(...Object.values(e.contrib || { x: 0 }));
    txt(t('{n} TURNS SURVIVED', { n: R.round }) + ' · ' + t('{n} AIR PUMPED', { n: all }), 585, 470, 16, '#fff', 'center', 360);
    txt(t('BIGGEST PUMPER: {n} AIR', { n: best }), 585, 494, 14, '#FFE14D', 'center', 360);
  }
  const next = R.players.find(p => p.id === e.next);
  if (!L.final && next) txt(t('NEXT: {name}', { name: next.name }), 585, 470, 19, next.color, 'center', 340);
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
    draw() {
      bg('#26304b', '#392d59', now);
      txt(partyCardReveal(R), 400, 76, 19, '#F28CB1', 'center', 720);
      txt('CARD TABLE', 400, 122, 42, '#FFE14D');
      txt(t('{n} MICROGAMES IN THE PILE', { n: R.extra.pile.length }), 400, 176, 25, '#fff');
      txt(t('{n} CARDS IN THE POT', { n: R.extra.pot }), 400, 208, 21, '#F28CB1');
      const bets = gs.sides();
      for (const [x, side, label] of [[180, 'left', 'LEFT DECK'], [430, 'right', 'RIGHT DECK']]) {
        for (let i = 2; i >= 0; i--) box(x + i * 5, 268 - i * 5, 190, 150, '#493e7c', 4);
        star(x + 95, 324, 34, 17, 5, -.2, '#FFE14D', 3);
        bets[side].forEach((id, i) => { const pl = R.players.find(p => p.id === id); claude(x + 34 + i * 44, 262 - Math.abs(Math.sin(now * 5 + i * 1.7)) * 9, 2.4, { col: pl.color, mood: 'happy' }); });   // the watchers' bets: their little players hop on the deck they chose
        if (mine) button(x, 369, 190, 54, busy ? 'ONE MOMENT...' : label, () => choose(side), { size: 21, fill: '#B49CFF' });
        else {
          const on = gs.mine === side;
          button(x, 369, 190, 54, on ? 'YOUR GUESS!' : side === 'left' ? 'GUESS LEFT' : 'GUESS RIGHT', () => choose(side), { size: 21, fill: on ? '#FFE14D' : '#B49CFF' });
        }
      }
      if (!mine) {
        sabOrbs(kit.charges, 112, 450, { r: 12, gap: 31, pulse: kit.pulse });
        rx.bar(244, 432, 312, 36);
        const run = rx.streakNow(), per = kit.charges.cfg.comboEvery;
        if (run) { box(244, 473, 312, 6, '#14101c', 0); ctx.fillStyle = '#FF9A3D'; ctx.fillRect(244, 473, 312 * (run % per) / per, 6); }
      }
      txt(mine ? 'MICROGAME CARDS STACK UP · PLAY CARD STARTS THE CHALLENGE' : t('{name} IS DRAWING', { name: actor.name }), 400, 497, 18, '#fff', 'center', 740);
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
  const e = R.extra, id = party.you.id, attempt = e.stealing && e.stealing[id], busy = !!attempt && attempt.round === round, done = e.stolen[id] === round;
  txt('YOU STEAL', 692, 142, 22, '#FFE14D', 'center', 166);
  for (let i = 2; i >= 0; i--) box(650 + i * 4, 178 - i * 3, 76, 28, '#B49CFF', 2);
  txt(e.pile.length + e.pot, 688, 192, 20, INK);
  txt(t('{n} CARDS AT STAKE', { n: e.pile.length + e.pot }), 692, 222, 16, '#FFE14D', 'center', 172);
  txt(t('{n} MICROGAMES TO GO', { n: e.remaining.length }), 692, 243, 14, '#fff', 'center', 172);
  const rivals = R.players.filter(p => !p.left && p.id !== id), h = rivals.length > 2 ? 86 : 100;
  rivals.forEach((p, i) => {
    const y = 262 + i * (h + 8), can = p.score > 0 && !done, aim = busy && attempt.target === p.id, cx = 696;
    if (can) {
      button(608, y, 176, h, '', () => partyStartSteal(p.id, round), { fill: p.color });
      ctx.globalAlpha = .45 + .35 * Math.sin(now * 7 + i); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(612, y + 4, 168, h - 8); ctx.globalAlpha = 1;
      if (aim) { ctx.fillStyle = 'rgba(20,16,28,.55)'; ctx.fillRect(612, y + h - 16, 168, 10); ctx.fillStyle = '#fff'; ctx.fillRect(612, y + h - 16, 168 * Math.max(0, Math.min(1, 1 - (attempt.readyAt - Date.now()) / 1200)), 10); }
      txt(t('STEAL: {name}', { name: p.name }), cx, y + 22, 17, INK, 'center', 160);
      txt(t('{n} CARDS', { n: p.score }), cx, y + h / 2 + 10, 26, INK, 'center', 160);
    } else {
      box(608, y, 176, h, '#302b50', 3); txt(p.name, cx, y + 22, 17, p.color, 'center', 160);
      txt(t('{n} CARDS', { n: p.score }), cx, y + h / 2 + 10, 24, '#9a98ad', 'center', 160);
    }
  });
  txt(busy ? 'STEALING...' : done ? 'CARD STOLEN! WAIT FOR THE NEXT GAME' : '', 692, 570, 14, '#F28CB1', 'center', 172);
}
/* the watchers' middle column: sabotage orbs and one tap per rival (the player at the table included) */
function partyCardsSab(ch, kit) {
  const list = ch.targets(), ready = ch.charges.ready(), x = 488, n = Math.max(1, list.length), h = Math.min(84, (466 - 194 - 8 - 6 * (n - 1)) / n);
  box3(x, 122, 104, 344, '#2b2845', 3, 3);
  txt('SABOTAGE!', 540, 142, 15, '#FF9A3D', 'center', 96);
  sabOrbs(ch.charges, 540, 170, { r: 12, gap: 31, pulse: kit.pulse });
  list.forEach((p, i) => {
    const y = 192 + i * (h + 6);
    button(x + 4, y, 96, h, '', () => ch.send(p.id), { fill: ready ? '#FF9A3D' : '#d3cfe0' });
    claude(x + 52, y + h - 26, Math.min(3.4, (h - 34) / 9.5), { col: p.color });
    txt(p.name, x + 52, y + h - 10, 13, INK, 'center', 88);
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
    const e = current.extra, m = me(), turnN = (e.turn || {})[party.you.id] || 0, totalN = (e.contrib || {})[party.you.id] || 0, turboOn = traps.turboOn(), rate = tapLog.length;
    box3(488, 122, 104, 344, '#2b2845', 3, 3);
    txt('YOUR AIR', 540, 142, 14, '#FFE14D', 'center', 96);
    claude(540, 232 - pumpKick * 6, 3.2, { col: m.color, mood: rate > 4 ? 'happy' : null });
    txt('AIR THIS TURN', 540, 262, 11, '#fff', 'center', 96); txt(String(turnN), 540, 292, 36, m.color, 'center', 96);
    txt('TOTAL', 540, 322, 11, '#fff', 'center', 96); txt(String(totalN), 540, 345, 20, '#fff', 'center', 96);
    if (combo >= 10) { const fl = Math.sin(now * 20) * 3; ctx.fillStyle = '#FF9A3D'; ctx.beginPath(); ctx.moveTo(516, 400); ctx.quadraticCurveTo(522, 368 + fl, 540, 358 - fl); ctx.quadraticCurveTo(558, 368 - fl, 564, 400); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#FFE14D'; ctx.beginPath(); ctx.moveTo(526, 400); ctx.quadraticCurveTo(540, 374 + fl, 554, 400); ctx.closePath(); ctx.fill(); }
    txt('COMBO', 540, 358, 11, '#fff', 'center', 96); txt('x' + combo, 540, 384, 26, combo >= 10 ? INK : '#fff', 'center', 96);
    txt(t('{n}/s', { n: rate }), 540, 410, 13, '#9fe3ff', 'center', 96);
    sabPicker(ch, 492, 414, 96);
    box3(12, 484, 580, 104, '#2b2845', 4, 4);
    const stuck = traps.stuck(), kick = pumpKick * 6, face = stuck ? '#d3cfe0' : turboOn ? '#ffd23f' : '#4fd06a', base = stuck ? '#8f88a6' : turboOn ? '#c99512' : '#24803a';
    ctx.save(); if (stuck && traps.shaking()) ctx.translate(Math.sin(now * 90) * 4, 0);
    box(22, 500, 188, 80, base, 4); box(22, 492 + kick, 188, 80, face, 4);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(26, 496 + kick, 180, 8);
    box(174, 540 + kick, 16, 24, '#c9ced6', 3); box(160, 520 + kick * 2.2, 44, 8, '#8f9cb3', 3); box(179, 526 + kick * 2.2, 6, 16, '#8f9cb3', 1);
    txt(stuck ? 'STUCK!' : 'PUMP!', 96, 518 + kick, 30, INK, 'center', 120);
    box(40, 538 + kick, 112, 24, '#fff', 3); txt('SPACE / TAP', 96, 551 + kick, 13, INK, 'center', 104);
    ctx.restore();
    btns.push({ x: 22, y: 492, w: 188, h: 88, fn: tap });
    traps.draw(222, 492, 362, (mx, y, mw) => {
      const cxm = mx + mw / 2;
      box(mx, 492, mw, 88, '#322d52', 3);
      txt(t('{n}/s', { n: rate }), mx + 12, 510, 15, '#9fe3ff', 'left', 80);
      if (combo > 1) txt(t('COMBO x{n}', { n: combo }), mx + mw - 12, 510, 17, combo >= 10 ? '#FF9A3D' : '#fff', 'right', 160);
      ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(mx + 14, 540); ctx.lineTo(mx + mw - 26, 540); ctx.strokeStyle = INK; ctx.lineWidth = 18; ctx.stroke();
      ctx.strokeStyle = turboOn ? '#ffd23f' : '#c9ced6'; ctx.lineWidth = 10; ctx.stroke();
      for (let i = 0; i < 8; i++) { const x = mx + 18 + ((now * (70 + rate * 45) + i * 44) % (mw - 56)); ctx.globalAlpha = rate ? .95 : .3; circ(x, 540, turboOn ? 6 : 4, turboOn ? '#fff3a0' : '#9fe3ff', 1.5); } ctx.globalAlpha = 1;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(mx + mw - 30, 526); ctx.lineTo(mx + mw - 8, 540); ctx.lineTo(mx + mw - 30, 554); ctx.closePath(); ctx.fill();
      if (turboOn) {
        ctx.fillStyle = 'hsl(' + Math.round(now * 300 % 360) + ',90%,60%)'; ctx.fillRect(mx + 14, 518, (mw - 28) * Math.max(0, traps.turboLeft() / 4), 8);
        txt(t('TURBO x2 · {n}s', { n: Math.ceil(traps.turboLeft()) }), cxm, 573, 15, '#FFE14D', 'center', 340);
      } else if (traps.soon()) { ctx.globalAlpha = .5 + .5 * Math.sin(now * 16); txt('HEADS UP!', cxm, 573, 16, '#FF4D5E', 'center', 340); ctx.globalAlpha = 1; }
      else txt('KEEP TAPPING! TRAPS ARE COMING', cxm, 573, 14, '#c9c6e0', 'center', 340);
    });
  };
  g.draw = gameTime => {
    const current = party.room, hit = ch && ch.active(), fxFull = !mine ? sabBegin(hit, ctx, 'full') : null;   // a helper's whole screen takes the hit (shake, ink, pixels...)
    bg('#26304b', '#392d59', now);
    const bez = balloon ? balMix(actor.color, '#ff3b3b', (partyBalloonShown(current) - .7) / .3) : actor.color;
    if (watcher) { box(10, 118, 472, 358, '#14101c', 5); box(14, 122, 464, 350, bez, 4); }
    else { box(6, 115, 594, 448, '#14101c', 5); box(12, 120, 584, 440, bez, 4); }
    // Chunky television bezel keeps the microgame and the surrounding party props in one stage.
    circ(590, 110, 5, '#7BD88F', 0);
    ctx.save(); ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
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
    txt(t('{name} IS PLAYING', { name: actor.name }), 302, 59, 23, actor.color, 'center', 560);
    if (mine) { if (hit) { ctx.globalAlpha = .6 + .4 * Math.sin(now * 14); txt(t('{name} SABOTAGES YOU!', { name: hit.name.toUpperCase() }), 302, 89, 19, '#FF9A3D', 'center', 552); ctx.globalAlpha = 1; } else txt(base.hint || '', 302, 89, 17, '#fff', 'center', 552); }
    const seconds = mine ? Math.max(0, base.dur / Math.sqrt(sp) - gameTime) : Math.max(0, sharedTime - (now - sharedClockAt));
    const clockDuration = mine ? base.dur / Math.sqrt(sp) : sharedDuration;
    txt(modeLabel(R.mode), 692, 28, 19, '#FFE14D', 'center', 168);
    txt(t('{n} SECONDS', { n: Math.ceil(seconds) }), 692, 66, 19, seconds < 2 ? '#F28CB1' : '#fff', 'center', 168);
    if (R.mode === 'lantern') txt(t('{n} TEAM LIVES', { n: current.lives }), 692, 97, 16, '#7BD88F', 'center', 168);
    box(16, 107, 576, 6, '#14101c', 0);
    box(16, 107, 576 * Math.max(0, Math.min(1, seconds / clockDuration)), 6, seconds < 2 ? '#F28CB1' : '#7BD88F', 0);
    const cardWatch = cards && !mine;
    if (!balloon && !cardWatch) {
      txt(mine ? 'YOU PLAY' : R.mode === 'lantern' ? 'YOU LIGHT' : 'YOU STEAL', 692, 142, 20, '#FFE14D', 'center', 166);
      const teammates = current.players.filter(p => !p.left && p.id !== actor.id);
      txt(mine ? 'YOUR TEAMMATES' : 'HELPER TEAM', 692, 176, 15, '#fff', 'center', 164);
      teammates.forEach((p, i) => txt(p.name, 692, 199 + i * 21, 15, p.color, 'center', 164));
    }
    if (balloon) {
      partyBalloonSide(current, mine);
      if (!mine) drawPumpUI(current);
    } else if (cardWatch) {
      partyCardsSab(ch, kit); partyCardsSteal(current, round);
      box3(12, 484, 580, 104, '#2b2845', 4, 4);
      traps.draw(16, 492, 572, (mx, y, mw) => {
        box(mx, y, mw, 88, '#322d52', 3);
        if (traps.soon()) { ctx.globalAlpha = .5 + .5 * Math.sin(now * 16); txt('HEADS UP!', mx + mw / 2, y + 44, 26, '#FF4D5E', 'center', 540); ctx.globalAlpha = 1; }
        else txt('WIN TRAPS TO CHARGE SABOTAGE', mx + mw / 2, y + 44, 20, '#c9c6e0', 'center', 540);
      });
    } else if (cards) {   // the player at the table: the pile, and who holds what (watchers have partyCardsSteal)
      txt(t('{n} CARDS AT STAKE', { n: current.extra.pile.length + current.extra.pot }), 692, 305, 19, '#FFE14D', 'center', 168);
      txt(t('{n} MICROGAMES TO GO', { n: current.extra.remaining.length }), 692, 345, 17, '#fff', 'center', 168);
      txt('WIN TO KEEP THE PILE', 692, 396, 15, '#fff', 'center', 168);
      txt('OTHERS CAN STEAL', 692, 427, 15, '#F28CB1', 'center', 168);
      for (let i = 2; i >= 0; i--) { box(650 + i * 4, 258 - i * 3, 76, 32, '#B49CFF', 2); }
      txt(current.extra.pile.length + current.extra.pot, 688, 275, 21, INK);
      current.players.filter(p => !p.left).forEach((p, i) => txt(t('{name}: {n} CARDS', { name: p.name, n: p.score }), 692, 460 + i * 32, 15, p.color, 'center', 168));
    } else {
      txt(mine ? 'YOUR FRIENDS MOVE THE LIGHT' : 'MOVE THE LIGHT', 692, 310, 19, '#FFE14D', 'center', 166);
      txt(mine ? 'PLAY INSIDE THE LIGHT' : 'MOUSE / TOUCH', 692, 344, 16, '#fff', 'center', 166);
      txt(mine ? 'FOLLOW YOUR GAME CONTROLS' : 'OR ARROW KEYS', 692, 371, 16, '#fff', 'center', 166);
      txt('KEEP THE ACTION LIT!', 692, 425, 15, '#FFE14D', 'center', 168);
      txt('WIN TOGETHER', 692, 470, 18, '#7BD88F', 'center', 168);
    }
    if (!mine && !canSab) txt(g.hint, 400, 580, 17, '#fff', 'center', 770);
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
