'use strict';
/* GHOSTS: in SURVIVAL and KNOCKOUT an eliminated player does not just watch, they haunt. While a round is live the ghost plays trap mini-games
   (createIdleTraps from js/party-sab.js: gold bubble, stop-in-the-green dial, arrow sequence) that charge BOOs, and each BOO covers a living player's game with a
   soft sabotage (the `ghost` kinds of SAB_KINDS, 60% strength, 75% of the time). Nothing here changes who wins: it is only there so nobody sits idle.
   Server rules (pocketbase/pb_hooks/party.js): only an eliminated player may send, only 'sab', only during a live round after the instruction card, only at a living
   player who has not finished yet, rate limited. The ghost uses the shared pieces and only adds the HUD:
     partyGhostOn(R)          is the ghost screen showing (me eliminated, round live)
     partyGhostUpdate(R, dt)  every frame: charges and traps tick, the relay handler is attached
     partyGhostDraw(R, pick)  the whole ghost screen, in place of the plain spectator one (pick = partyWatchPick(R))
     partyGhostKey(e)         keyboard: trap keys, E = BOO the player I am watching
     partyGhostReceiver(R)    the living side: a receive-only channel plus partyGhostBanner for the "NAME SABOTAGES YOU!" pill
   Art: a haunted-theatre box seat (marquee with chasing bulbs, velvet curtains, a ledge with candles, footlights on a stage floor) drawn with PARTY_UI (js/party-ui.js). */
const GHOST_PRE = 1.4;                                                   // instruction card at the start of every round (PRE_MS in the hook): nothing to haunt before it
const GHOST_CFG = { max: 2, every: 8, trap: 1, comboEvery: 1e9, cooldown: 4 };   // a ghost holds 2 BOOs and waits 4 s between throws (a balloon pumper: 3, 3 s, +1 per 6 s); the server limits are a little looser
const GHOST_TRAPS = { fly: 0, jam: 0, bubble: .34, dial: .33, seq: .33 };       // no pump to jam and nothing to swat: only the three that pay a BOO
const GHOST_WORDS = { bubble: 'SPOOKY!', dial: 'PERFECT!', seq: 'COMBO!', over: 'TOO LATE!' };
const partyGhostOn = R => !!R && R.state === 'round' && SAB_GHOST_MODES.includes(R.mode) && !!me() && me().lives <= 0 && party.view === 'wait';

/* ───────────── art: a haunted-theatre box seat in the DUO look (docs/ART-STYLE.md) ─────────────
   Everything draws through PARTY_UI (js/party-ui.js): inked rounded slabs with depth, base/shade/light cel shading with one glint, plates with a key cap on desktop, orbs, avatars.
   Cosmetic randomness is PARTY_UI.hash (never the game's RNG). The static wall and the stage floor are baked once; only what moves is drawn per frame. Nothing here changes a rule. */
const GHOST_C = { cyan: '#9fe3ff', gold: '#FFE14D', go: '#5CFF7A', danger: '#ff4d5e', boo: ['#FF9A3D', '#c4640f'], seat: '#3d3480', seatDk: '#241d4a', seatLit: '#51479a', screen: '#19172d' };
let GHOST_WALL = null, GHOST_WALL_W = 0;
const CANDLES = [[560, 34, '#fff3d6'], [648, 50, '#f6d6ff'], [738, 38, '#d6f2ff']];   // x, height, wax
/* the wall, the curtains and the stage boards, baked at the full logical width (wide screens show more of the curtains) */
function ghostWall() {
  if (GHOST_WALL && GHOST_WALL_W === VW) return GHOST_WALL;
  const U = PARTY_UI, cv2 = document.createElement('canvas'); cv2.width = VW; cv2.height = H;
  const c = cv2.getContext('2d'), prev = U.target(c);
  c.save(); c.translate(OX, 0);
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d1840'); g.addColorStop(.55, '#2c2560'); g.addColorStop(1, '#17122f');
  c.fillStyle = g; c.fillRect(-OX, 0, VW, H);
  const x0 = -Math.ceil(OX / 44) * 44;
  for (let x = x0; x < W + OX; x += 44) {                                       // wallpaper: wide stripes with a diamond between them
    c.fillStyle = 'rgba(255,255,255,.032)'; U.rr(x, -6, 22, H + 12, 5); c.fill();
    c.fillStyle = 'rgba(180,156,255,.1)';
    for (let y = 30; y < 570; y += 56) { const dy = y + (x / 44 & 1) * 28; c.beginPath(); c.moveTo(x + 11, dy - 9); c.lineTo(x + 19, dy); c.lineTo(x + 11, dy + 9); c.lineTo(x + 3, dy); c.closePath(); c.fill(); }
  }
  c.fillStyle = 'rgba(20,16,28,.22)'; c.fillRect(-OX, 392, VW, 182);              // the lower wall sits in the dark
  // the stage floor: boards under the footlights, a hard ink horizon line where it starts
  const f = c.createLinearGradient(0, 574, 0, H); f.addColorStop(0, '#8a5530'); f.addColorStop(1, '#4d2f18');
  c.fillStyle = f; c.fillRect(-OX, 574, VW, H - 574);
  c.strokeStyle = 'rgba(20,16,28,.4)'; c.lineWidth = 3; for (let x = x0 - 20; x < W + OX; x += 66) { c.beginPath(); c.moveTo(x + 12, 590); c.lineTo(x, H); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,.1)'; for (let x = x0; x < W + OX; x += 132) { U.rr(x + 8, 594, 58, 5, 2.5); c.fill(); }
  c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(-OX, 574); c.lineTo(W + OX, 574); c.stroke();
  U.rr(-OX - 10, 568, VW + 20, 11, 5.5); U.ink('#c99512', 3);                      // the brass rail the footlights sit on
  U.rr(-OX - 4, 569.5, VW + 8, 3, 1.5); c.fillStyle = 'rgba(255,255,255,.4)'; c.fill();
  U.rr(500, 440, 288, 12, 6); U.ink('#c99512', 3); U.rr(508, 442, 272, 3, 1.5); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();   // the ledge of the box: the candles stand on it
  // velvet curtains at both edges
  for (const side of [-1, 1]) {
    const edge = side < 0 ? 9 : W - 9, far = side < 0 ? -OX - 12 : W + OX + 12, x1 = Math.min(edge, far), wd = Math.abs(far - edge);
    U.rr(x1, -14, wd, H + 28, 7); U.ink('#8c2f5e', 4);
    c.save(); c.clip(); const n = Math.ceil(wd / 15);
    for (let i = 0; i < n; i++) { const fx = side < 0 ? edge - 8 - i * 15 : edge + 3 + i * 15; c.fillStyle = 'rgba(20,16,28,.3)'; U.rr(fx, -6, 6, H + 12, 3); c.fill(); c.fillStyle = 'rgba(255,255,255,.13)'; U.rr(fx + 6, -6, 3, H + 12, 1.5); c.fill(); }
    c.restore();
  }
  c.restore(); U.target(prev);
  GHOST_WALL = cv2; GHOST_WALL_W = VW; return cv2;
}
function ghostSparkle(x, y, r, col, rot = 0, o = 2) {
  const U = PARTY_UI, c = ctx;
  c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
  for (let i = 0; i < 8; i++) { const q = i % 2 ? r * .34 : r, a = i * Math.PI / 4; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
  c.closePath(); U.ink(col, o); c.restore();
}
/* a lit bulb (marquee, footlights): a glow, a body, a glint */
function ghostBulb(x, y, lit, r = 3.6) {
  const U = PARTY_UI, c = ctx;
  if (lit) { c.fillStyle = 'rgba(255,225,77,.2)'; c.beginPath(); c.arc(x, y, r * 2.6, 0, 7); c.fill(); }
  c.beginPath(); c.arc(x, y, r, 0, 7); U.ink(lit ? '#FFE14D' : '#6e5320', 1.7);
  if (lit) { c.fillStyle = '#fff3a0'; c.beginPath(); c.arc(x - r * .3, y - r * .3, r * .38, 0, 7); c.fill(); }
}
/* the living room behind the panels: far ghosts drifting past, dust in the light, the footlights */
function ghostAmbient() {
  const U = PARTY_UI, c = ctx;
  for (let i = 0; i < 3; i++) {                                              // far layer: no ink, a tint of their own colour
    const sp = 14 + i * 7, x = ((now * sp + i * 311) % (VW + 160)) - 80 - OX, y = 150 + i * 150 + Math.sin(now * (.7 + i * .2) + i) * 16, r = 15 + i * 3, w = r * 2 / 3;
    c.save(); c.translate(x, y); c.globalAlpha = .55; c.fillStyle = 'rgba(159,227,255,.13)'; c.strokeStyle = 'rgba(159,227,255,.28)'; c.lineWidth = 3; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-r, r); c.lineTo(-r, 0); c.arc(0, 0, r, Math.PI, 0); c.lineTo(r, r);
    for (let j = 0; j < 3; j++) c.quadraticCurveTo(r - (j + .5) * w * 1.5 + 0, r + 7 + Math.sin(now * 3 + j + i) * 2.5, r - (j + 1) * w * 1.5, r);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(159,227,255,.35)'; c.beginPath(); c.ellipse(-r * .35, -r * .1, 2.6, 4, 0, 0, 7); c.ellipse(r * .35, -r * .1, 2.6, 4, 0, 0, 7); c.fill(); c.restore();
  }
  c.fillStyle = 'rgba(255,240,150,.5)';
  for (let i = 0; i < 16; i++) {
    const q = (now * (.018 + U.hash(i) * .02) + U.hash(i + 40)) % 1, x = U.hash(i + 80) * VW - OX + Math.sin(now * .8 + i) * 14, y = 560 - q * 540, a = Math.sin(q * Math.PI);
    c.globalAlpha = a * .6; c.beginPath(); c.arc(x, y, 1.2 + U.hash(i + 120) * 1.8, 0, 7); c.fill();
  }
  c.globalAlpha = 1;
  CANDLES.forEach(([cx, h, col], i) => {                                      // three candles on the ledge, flames that flicker
    const fl = Math.sin(now * 9 + i * 2) * .5 + Math.sin(now * 14 + i) * .3, top = 440 - h;
    for (let g = 0; g < 3; g++) { c.fillStyle = 'rgba(255,225,77,' + (.05 + fl * .008).toFixed(3) + ')'; c.beginPath(); c.arc(cx, top - 12, 16 + g * 10 + fl * 2, 0, 7); c.fill(); }
    U.rr(cx - 7, top, 14, h, 4); U.ink(col, 3); c.fillStyle = 'rgba(255,255,255,.4)'; U.rr(cx - 4, top + 3, 3, h - 8, 1.5); c.fill();
    c.beginPath(); c.moveTo(cx, top - 24 - fl * 2); c.quadraticCurveTo(cx + 9, top - 8, cx, top - 3); c.quadraticCurveTo(cx - 9, top - 8, cx, top - 24 - fl * 2); c.closePath(); U.ink('#FFE14D', 2);
    c.fillStyle = '#fff3a0'; c.beginPath(); c.ellipse(cx, top - 9, 2.6, 5, 0, 0, 7); c.fill();
  });
  for (let x = -OX + 20, i = 0; x < W + OX; x += 40, i++) ghostBulb(x, 576, (i + Math.floor(now * 2.2)) % 3 !== 0, 5);
}

/* a little ghost: an inked sheet in the player's colour, big eyes with a pupil and a glint, blush, a halo, stubby arms, a wobbling hem and wisps trailing under it.
   (x, y) is the middle of the head, s = size (22 * s is the body radius). o: { lunge 0..1 (a BOO), ph, alpha, mood, look: [x, y] } */
function ghostDraw(x, y, s, col, o = {}) {
  const U = PARTY_UI, c = ctx, r = 22 * s, ph = o.ph || 0, lunge = o.lunge || 0, T = now + ph * 1.7;
  const bob = Math.sin(now * 2.2 + ph) * r * .1, ol = Math.max(2.5, r * .15), bot = r * 1.02, a = o.alpha === undefined ? 1 : o.alpha;
  const mood = o.mood || (lunge > .15 ? 'eager' : 'idle'), br = 1 + Math.sin(now * 3.1 + ph) * .025, pale = U.lite(col, .62), mid = U.lite(col, .22);
  c.save(); c.globalAlpha *= a;
  U.shadow(x, y + r * 1.62, r * .8 * (1 - bob / r * .5), r * .17, .22);
  c.translate(x, y + bob); c.rotate(-.3 * lunge + Math.sin(now * 1.7 + ph) * .04); c.scale(br * (1 + .28 * lunge), (2 - br) * (1 + .28 * lunge));
  if (r > 13) for (let i = 0; i < 3; i++) {                                 // wisps: little inked drops that slip off the hem and fade
    const q = (now * .55 + ph * .3 + i / 3) % 1, wx = (i - 1) * r * .55 + Math.sin(now * 2 + i + ph) * r * .12;
    c.save(); c.globalAlpha *= (1 - q) * .85; c.beginPath(); c.arc(wx, bot + r * .45 + q * r * .85, r * .15 * (1 - q * .5), 0, 7); U.ink(U.lite(col, .75), 1.8); c.restore();
  }
  c.beginPath(); c.ellipse(0, -r * 1.2, r * .52, r * .14, 0, 0, 7);        // halo: ink under the player's colour
  c.lineWidth = Math.max(4, r * .18) + 4; c.strokeStyle = INK; c.stroke(); c.lineWidth = Math.max(2, r * .18); c.strokeStyle = col; c.stroke();
  const wv = lunge > .1 ? -.9 - Math.sin(now * 18) * .25 * lunge : Math.sin(now * 3 + ph) * .12 + .55;   // stubby arms: down while idle, flung up on a BOO
  for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * r * 1.02, r * .3, r * .26, r * .15, sd * wv, 0, 7); U.ink(mid, ol * .8); }
  const p = new Path2D(), n = 4, w = 2 * r / n;
  p.moveTo(-r, bot); p.lineTo(-r, 0); p.arc(0, 0, r, Math.PI, 0); p.lineTo(r, bot);
  for (let i = 0; i < n; i++) { const x2 = r - (i + 1) * w, wob = Math.sin(T * 4 + i * 1.7) * r * .1; p.quadraticCurveTo(x2 + w / 2, bot + r * .36 + wob, x2, bot - (i < n - 1 ? wob * .3 : 0)); }
  p.closePath();
  U.cel(p, pale, mid, r * .16, r * .22, ol);
  U.glint(p, -r * .42, -r * .5, r * .3, r * .15, 'rgba(255,255,255,.8)', -.5);
  const look = o.look || [Math.sin(now * .9 + ph) * .5, .1], ex = r * .36, ey = -r * .12, er = r * .3;
  c.fillStyle = 'rgba(255,110,165,.55)'; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * r * .64, r * .26, r * .17, r * .1, 0, 0, 7); c.fill(); }
  U.eye(-ex, ey, er, mood === 'sleepy' ? 'sleepy' : mood === 'happy' ? 'happy' : mood === 'panic' ? 'panic' : 'idle', look, T, 0); U.eye(ex, ey, er, mood === 'sleepy' ? 'sleepy' : mood === 'happy' ? 'happy' : mood === 'panic' ? 'panic' : 'idle', look, T, 1);
  c.strokeStyle = INK; c.lineCap = 'round'; c.lineWidth = Math.max(2, r * .13);
  if (mood === 'eager' || lunge > .15) for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * ex - sd * er * .9, ey - er * 1.1); c.lineTo(sd * ex + sd * er * .9, ey - er * 1.65); c.stroke(); }   // slanted, mischievous brows
  const my = r * .46, mo = lunge > .15 ? 1 : mood === 'panic' ? .8 : mood === 'sleepy' ? .35 : 0;
  c.beginPath(); c.ellipse(0, my, r * (.13 + mo * .11), r * (.16 + mo * .17), 0, 0, 7); c.fillStyle = INK; c.fill();
  if (mo > .5) { c.fillStyle = 'rgba(255,110,165,.85)'; c.beginPath(); c.ellipse(0, my + r * .14, r * .1, r * .08, 0, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(r * .58, -r * .55, r * .06, 0, 7); c.fill();
  if (mood === 'sleepy' && r > 13) for (let i = 0; i < 2; i++) {                    // Zs rise from a sleeping ghost
    const q = (now * .5 + i * .5 + ph) % 1, zx = r * (.9 + q * .5), zy = -r * (.9 + q * .9), z = r * (.16 + i * .08);
    c.save(); c.globalAlpha *= Math.sin(q * Math.PI); c.translate(zx, zy); c.beginPath(); c.moveTo(-z, -z); c.lineTo(z, -z); c.lineTo(-z, z); c.lineTo(z, z);
    c.lineWidth = Math.max(2.5, r * .09) + 3.5; c.strokeStyle = INK; c.stroke(); c.lineWidth = Math.max(2.5, r * .09); c.strokeStyle = '#fff'; c.stroke(); c.restore();
  }
  c.restore();
}

/* the ghost's whole kit, built once per room and rebuilt traps / channel every round (charges survive the rounds) */
function partyGhostKit(R) {
  let k = party.ghost;
  if (!k || k.room !== R.id) k = party.ghost = { room: R.id, round: -1, born: now, charges: createSabCharges(GHOST_CFG), pulse: -9, flash: null, lunge: 0, hits: {}, handler: null };
  if (k.round !== R.round) {
    k.round = R.round; k.roundAt = now; k.live = false;
    k.traps = createIdleTraps({ at: { x: 250, y: 500 }, first: [.3, .5], gap: [.9, 1.2], weights: GHOST_TRAPS, words: GHOST_WORDS, onReward: () => { k.charges.earn('trap'); k.pulse = now; } });
    k.ch = createSabChannel(R, { send: partyGhostSend }, { charges: k.charges, ghost: true, onSend: (kind, to) => sabThrownFx(k, kind, to) });
    k.handler = (type, data, from) => { k.ch.receive(type, data, from); };
  }
  return k;
}
/* a BOO goes straight to the server (sabSendDirect in js/party-sab.js); a refused one gives the BOO back */
function partyGhostSend(type, data) {
  sabSendDirect(type, data, R => { const k = party.ghost; return k && k.room === R.id && k.round === R.round ? k.charges : null; });
}
function partyGhostUpdate(R, dt) {
  if (!partyGhostOn(R)) { if (party.ghost) party.ghost.charges.cd = Math.max(0, party.ghost.charges.cd - dt); return; }   // the cooldown runs on the results screen too
  const k = partyGhostKit(R), S = party.sig;
  if (S.round === R.round && S.handler !== k.handler) { S.handler = k.handler; S.buf.splice(0).forEach(x => x.round === S.round && k.handler(x.t, x.d, x.from)); }   // see the haunts that landed while the screen was loading
  k.lunge = Math.max(0, k.lunge - dt * 3.2);
  k.live = now - k.roundAt > GHOST_PRE;
  if (k.live) { k.charges.tick(dt); k.traps.update(dt); }
}
function partyGhostKey(e) {
  const R = party.room; if (!R || e.repeat || !partyGhostOn(R)) return;
  const k = partyGhostKit(R); if (!k.live || k.traps.key(e.code) || e.code !== 'KeyE' && e.code !== 'KeyQ') return;
  const list = k.ch.targets(), pick = list.find(p => p.id === party.watch.target) || list[0];
  if (pick) k.ch.send(pick.id);
}

/* a status lozenge on a card: a dot (pulsing while they play) and a word */
function ghostStatus(x, y, w, label, col, live) {
  const U = PARTY_UI, c = ctx;
  U.rr(x, y, w, 20, 10); U.ink('#1d1840', 2.5);
  c.fillStyle = col; c.beginPath(); c.arc(x + 11, y + 10, 4 + (live ? Math.sin(now * 6) * .9 : 0), 0, 7); c.fill();
  U.text(label, x + 20, y + 11, 12, col, 'left', w - 26);
}
function partyGhostDraw(R, pk) {
  const U = PARTY_UI, c = ctx, k = partyGhostKit(R), m = me(), watch = party.watch, target = pk.target, frame = pk.frame, ready = k.live && k.charges.ready();
  const alive = pk.alive, ghosts = R.players.filter(p => !p.left && p.lives <= 0 && p.id !== m.id), intro = Math.max(0, 1 - (now - k.born) / 2.4);
  const press = (x, y, w, h) => typeof hovered === 'function' && hovered(x, y, w, h);
  c.drawImage(ghostWall(), -OX, 0); ghostAmbient();
  // the marquee: the round, framed by chasing bulbs, with a ghost at each end
  U.rr(176, 5, 448, 49, 22); U.ink('#2a2350', 4); U.rr(184, 10, 432, 8, 4); c.fillStyle = 'rgba(255,255,255,.14)'; c.fill();
  for (let i = 0; i < 21; i++) { const bx = 198 + i * 20.4; ghostBulb(bx, 13, (i + Math.floor(now * 4)) % 3 === 0, 3.2); ghostBulb(bx, 46, (i + 1 + Math.floor(now * 4)) % 3 === 0, 3.2); }
  U.text(t('ROUND {n} / {total}', { n: R.round + 1, total: R.total }), W / 2, 30, 26, GHOST_C.gold);
  ghostDraw(232, 28, .55, m.color, { ph: 1 }); ghostDraw(568, 28, .55, m.color, { ph: 2 });
  U.text('YOU ARE A GHOST! HAUNT THE LIVING', W / 2, 74, 22, U.mix('#9fe3ff', '#ffffff', .5 + .5 * Math.sin(now * 4)), 'center', 560);
  // the stage: the living player's game, as everybody else sees it (a sabotage you throw lands here)
  const fcol = target ? target.color : '#4a5a9a', ink0 = U.shade(fcol, .38);
  U.rr(12, 102, 476, 360, 18); U.ink(ink0, 4);
  U.rr(12, 98, 476, 360, 18); U.ink(fcol, 4);
  c.fillStyle = 'rgba(255,255,255,.3)'; U.rr(26, 102, 448, 6, 3); c.fill();
  U.rr(18, 104, 464, 350, 12); U.ink(GHOST_C.screen, 3);
  const stale = !!(frame && frame.image && target && !R.cur[target.id] && now - frame.at > 3), fin = !!(target && R.cur[target.id]);
  c.save(); U.rr(20, 106, 460, 346, 10); c.clip();
  if (frame && frame.image) c.drawImage(frame.image, 20, 106, 460, 345);
  else { if (intro <= 0) ghostDraw(250, 214, 1.1, m.color, { mood: 'sleepy', ph: 3 }); U.text(target ? 'CONNECTING TO THE PLAYER...' : 'WAITING FOR THE NEXT ROUND', 250, 310, 22, GHOST_C.gold, 'center', 430); }
  if (fin) { c.fillStyle = 'rgba(20,16,28,.42)'; U.rr(20, 106, 460, 346, 10); c.fill(); }
  c.restore();
  if (stale) {                                                                       // the picture froze: a small sign says so
    U.rr(52, 396, 396, 36, 18); U.ink('rgba(20,16,28,.92)', 3);
    for (let i = 0; i < 3; i++) { c.fillStyle = GHOST_C.gold; c.beginPath(); c.arc(76 + i * 14, 414 - Math.max(0, Math.sin(now * 7 - i)) * 5, 3.6, 0, 7); c.fill(); }
    U.text('RECONNECTING TO THE PLAYER...', 268, 415, 16, GHOST_C.gold, 'center', 330);
  }
  const fl = k.flash && now - k.flash.at < .7 ? k.flash : null;
  if (fl && fl.to === watch.target) {                                                 // my BOO just landed: the stage flashes in the sabotage's colour
    const a = 1 - (now - fl.at) / .7, kc = SAB_KINDS[fl.k].col;
    c.save(); c.globalAlpha = a * .22; c.fillStyle = kc; U.rr(20, 106, 460, 346, 10); c.fill();
    c.globalAlpha = a; U.rr(27, 113, 446, 332, 8); c.lineWidth = 14; c.strokeStyle = kc; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#fff'; c.globalAlpha = a * .8; U.rr(33, 119, 434, 320, 6); c.stroke(); c.restore();
  }
  if (fin) { const fk = R.round + target.id; k.fin = k.fin || {}; if (k.fin[fk] === undefined) k.fin[fk] = now; U.badge('FINISHED', 250, 400, 28, '#4fd06a', '#fff', U.outBack((now - k.fin[fk]) / .25), -.05); }
  if (target) U.pill(98, 122, target.name, target.color, false, 17);
  if (intro > 0) {   // first seconds as a ghost: the ghost rises over the stage
    const pop = U.outBack((1 - intro) / .22);
    c.save(); c.globalAlpha = Math.min(1, intro * 2); c.translate(250, 265); c.scale(pop, pop); c.translate(-250, -265);
    U.rr(30, 187, 440, 156, 24); c.fillStyle = 'rgba(20,16,28,.3)'; c.save(); c.translate(4, 8); c.fill(); c.restore();
    U.rr(30, 187, 440, 156, 24); U.ink('#2a2350', 4); U.rr(40, 195, 420, 8, 4); c.fillStyle = 'rgba(255,255,255,.16)'; c.fill();
    U.rr(36, 193, 428, 144, 19); c.lineWidth = 3; c.strokeStyle = GHOST_C.gold; c.stroke();
    ghostDraw(104, 255 - (1 - intro) * 40, 1.6, m.color, { lunge: .6 + .4 * Math.sin(now * 8) });
    U.text('YOU ARE A GHOST!', 322, 232, 30, GHOST_C.cyan, 'center', 262);
    t('TRAPS CHARGE BOOS · BOO THE LIVING').split(' · ').forEach((line, i) => U.text(line, 322, 272 + i * 22, 17, GHOST_C.gold, 'center', 262));   // two lines: the Spanish one is long
    ghostSparkle(448, 214, 11 + Math.sin(now * 5) * 2, GHOST_C.gold, now); ghostSparkle(200, 322, 8 + Math.sin(now * 5 + 2) * 2, GHOST_C.cyan, -now);
    c.restore();
  }
  // who is still alive: tap a card to watch them, BOO! to haunt them
  alive.forEach((p, i) => {
    const y = 104 + i * 90, done = !!R.cur[p.id], sel = p.id === watch.target, hit = now - (k.hits[p.id] || -9) < .9, can = ready && !done, kc = SAB_KINDS[(k.flash || { k: 'ink' }).k].col;
    const face = hit ? U.mix('#46507a', kc, .45) : sel ? GHOST_C.seatLit : GHOST_C.seat, jx = hit ? Math.sin(now * 60) * 3 : 0;
    if (sel) { U.rr(491 + jx, y - 5, 298, 90, 22); U.ink(GHOST_C.gold, 3); }
    U.rr(496 + jx, y + 6, 288, 74, 17); U.ink(U.shade(face, .45), 4);
    U.rr(496 + jx, y, 288, 74, 17); U.ink(face, 4);
    c.fillStyle = 'rgba(255,255,255,.14)'; U.rr(508 + jx, y + 5, 264, 6, 3); c.fill();
    U.avatar(536 + jx, y + 36, 21, p.color, { t: now, seed: i * 2 + 1, look: [-1, .15], mood: hit ? 'dizzy' : done ? 'happy' : sel && can ? 'eager' : 'idle', k: 1 });
    U.text(p.name, 574 + jx, y + 25, 18, p.color, 'left', 104);
    ghostStatus(574 + jx, y + 40, 104, done ? 'FINISHED' : 'PLAYING NOW', done ? '#c9c6e0' : '#7BD88F', !done);
    btns.push({ x: 496, y, w: 186, h: 80, fn: () => { watch.target = p.id; watch.manual = true; } });
    const hv = can && press(690, y + 8, 86, 64), bb = [690, y + 4 - (hv && !pressing ? 2 : 0), 86, 62], dy = U.plate(bb, can ? GHOST_C.boo[0] : 'off', can ? GHOST_C.boo[1] : null, hv && pressing, can, !can);
    const key = sel && !TOUCH;   // E throws at the card I am watching: the cap sits on that card's plate only
    c.save(); if (!can) c.globalAlpha *= .62; U.text('BOO!', 733, bb[1] + dy + (key ? 21 : 31), key ? 21 : 24, can ? '#fff' : '#14101c', 'center', 70); c.restore();
    if (key) U.keyCap(733, bb[1] + dy + 47, 'E', { down: dy > 5 });
    btns.push({ x: 690, y: y + 8, w: 86, h: 64, label: 'BOO!', fn: () => k.ch.send(p.id) });
  });
  ghosts.forEach((p, i) => {
    const y = 104 + alive.length * 90 + 6 + i * 36;
    U.rr(496, y - 6, 288, 30, 15); U.ink('#2a2350', 3);
    ghostDraw(516, y + 7, .42, p.color, { ph: i * 2 });
    U.text(p.name, 540, y + 9, 15, p.color, 'left', 140);
    U.rr(700, y + 1, 76, 18, 9); U.ink(GHOST_C.cyan, 2.5); U.text('GHOST', 738, y + 11, 11, INK, 'center', 66);
  });
  // the ghost's own seat: win a trap to charge a BOO
  U.rr(8, 464, 480, 98, 16); U.ink('#2a2350', 4);
  k.traps.draw(16, 466, 468, (mx, y, mw) => {
    U.rr(mx, y, mw, 88, 14); U.ink(GHOST_C.seatDk, 3);
    const soon = k.live && k.traps.soon();
    ghostDraw(mx + 50, y + 38, .95, m.color, { ph: 3, mood: !k.live ? 'sleepy' : soon ? 'panic' : 'idle' });
    if (!k.live) U.text('GET READY...', mx + mw / 2 + 36, y + 44, 22, '#fff', 'center', 330);
    else if (soon) U.badge('HEADS UP!', mx + mw / 2 + 36, y + 44, 24, GHOST_C.danger, '#fff', 1 + Math.sin(now * 16) * .06, Math.sin(now * 9) * .04, 300);
    else U.text('WIN THE TRAPS TO CHARGE A BOO', mx + mw / 2 + 36, y + 44, 17, '#c9c6e0', 'center', 340);
  });
  // my BOO energy: glossy orbs fill up, no numbers
  const ch = k.charges, px = 496, py = 466, cx = px + 151, orbY = py + 36, orbR = 18, orbGap = 60, sincePulse = now - k.pulse;
  U.rr(px, py + 8, 288, 88, 18); U.ink(U.shade(ready ? GHOST_C.seatLit : GHOST_C.seat, .45), 4);
  U.rr(px, py, 288, 88, 18); U.ink(ready ? GHOST_C.seatLit : GHOST_C.seat, 4);
  c.fillStyle = 'rgba(255,255,255,.14)'; U.rr(px + 12, py + 5, 264, 6, 3); c.fill();
  if (ready) { c.save(); c.globalAlpha = .45 + .35 * Math.sin(now * 6); U.rr(px + 6, py + 6, 276, 76, 14); c.lineWidth = 3; c.strokeStyle = GHOST_C.gold; c.stroke(); c.restore(); }
  ghostDraw(px + 44, py + 38, 1, m.color, { lunge: k.lunge, mood: ready ? 'eager' : ch.n === 0 ? 'sleepy' : 'idle', ph: 4 });
  const at = []; if (sincePulse < .5 && ch.n > 0) at[ch.n - 1] = k.pulse;
  U.orbRow(cx, orbY, ch.n, ch.max, orbR, GHOST_C.cyan, now, { gap: orbGap, pulse: ready, at });
  if (ch.n < ch.max && ch.clock > 0) {                                                   // the next orb charges: a ring fills inside it
    const ox = cx + (ch.n - (ch.max - 1) / 2) * orbGap;
    c.strokeStyle = GHOST_C.cyan; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.arc(ox, orbY, orbR * .55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ch.clock / ch.cfg.every)); c.stroke();
  }
  if (ready) U.badge('BOO READY!', cx, py + 72, 14, '#4fd06a', '#fff', 1 + Math.sin(now * 6) * .03, 0, 160);
  else U.text(ch.n > 0 && ch.cd > 0 ? 'RECHARGING...' : 'WIN A TRAP!', cx, py + 72, 14, '#c9c6e0', 'center', 160);
  // LEAVE: a plate (the hit area is the old button's)
  const lv = press(14, 10, 130, 44), lb = [14, 10 - (lv && !pressing ? 2 : 0), 130, 38], ld = U.plate(lb, '#f6f4fb', '#8f88a6', lv && pressing, false, false);
  U.plateLabel(lb, ld, 'LEAVE', null, { size: 18, fg: INK });
  btns.push({ x: 14, y: 10, w: 130, h: 44, label: 'LEAVE', fn: () => partyLeave() });
}

/* the living side: a channel that only receives (a hit on me draws over my game, a hit on someone else is a toast) and attaches itself to the relay */
function partyGhostReceiver(R) {
  if (!SAB_GHOST_MODES.includes(R.mode) || !party.sig) return null;
  const ch = createSabChannel(R, null, {}), S = party.sig, h = (type, data, from) => { ch.receive(type, data, from); };
  S.handler = h; S.buf.splice(0).forEach(x => x.round === S.round && h(x.t, x.d, x.from));
  return ch;
}
/* "NAME SABOTAGES YOU!" over the bottom of my game while the hit lasts: a round banner that pops in with the sabotage's ghost peeking over its corner */
function partyGhostBanner(hit) {
  if (!hit) return;
  const c = ctx; c.save();
  try {   // pure decoration over somebody's game: whatever goes wrong here must never stop their round
    const U = PARTY_UI, age = now - hit.at, a = Math.min(1, (hit.life - age) / .5), kd = SAB_KINDS[hit.k], pop = U.outBack(age / .25);
    if (a <= 0 || pop <= .01) return;
    const msg = t('{name} SABOTAGES YOU!', { name: hit.name.toUpperCase() }), light = kd.col === '#E8EEFF' ? '#fff' : kd.col, w = 470, h = 40;
    c.globalAlpha = Math.max(0, a); c.translate(W / 2, 520 + (1 - pop) * 28); c.scale(pop, pop); c.rotate(Math.sin(now * 5 + hit.seed) * .012);
    c.fillStyle = 'rgba(20,16,28,.3)'; U.rr(-w / 2 + 3, -h / 2 + 7, w, h, h / 2); c.fill();
    U.rr(-w / 2, -h / 2, w, h, h / 2); U.ink('#2a2350', 4);
    U.rr(-w / 2 + 7, -h / 2 + 6, w - 14, h - 12, h / 2 - 6); c.lineWidth = 3; c.strokeStyle = kd.col; c.globalAlpha *= .8; c.stroke(); c.globalAlpha = Math.max(0, a);
    c.fillStyle = 'rgba(255,255,255,.2)'; U.rr(-w / 2 + 22, -h / 2 + 4, w - 44, 5, 2.5); c.fill();
    U.text(msg, 26, 1, 19, U.lite(light, .5), 'center', w - 150);
    ghostDraw(-w / 2 + 28, -4, .72, kd.col, { ph: hit.seed, lunge: Math.max(0, 1 - age * 2.5), mood: 'eager' });
  } catch (_) { /* ignore */ } finally { c.restore(); }
}
