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
     partyGhostReceiver(R)    the living side: a receive-only channel plus partyGhostBanner for the "NAME SABOTAGES YOU!" pill */
const GHOST_PRE = 1.4;                                                   // instruction card at the start of every round (PRE_MS in the hook): nothing to haunt before it
const GHOST_CFG = { max: 2, every: 8, trap: 1, comboEvery: 1e9, cooldown: 4 };   // a ghost holds 2 BOOs and waits 4 s between throws (a balloon pumper: 3, 3 s, +1 per 6 s); the server limits are a little looser
const GHOST_TRAPS = { fly: 0, jam: 0, bubble: .34, dial: .33, seq: .33 };       // no pump to jam and nothing to swat: only the three that pay a BOO
const GHOST_WORDS = { bubble: 'SPOOKY!', dial: 'PERFECT!', seq: 'COMBO!', over: 'TOO LATE!' };
const partyGhostOn = R => !!R && R.state === 'round' && SAB_GHOST_MODES.includes(R.mode) && !!me() && me().lives <= 0 && party.view === 'wait';

/* a little ghost: translucent body tinted with the player's colour, halo in the full colour, wavy hem. o: { lunge 0..1, ph, alpha } */
function ghostDraw(x, y, s, col, o = {}) {
  const c = ctx, w = 22 * s, h = 26 * s, bob = Math.sin(now * 3 + (o.ph || 0)) * 3 * s, lunge = o.lunge || 0;
  shadow(x, y + h + 24 * s, w * (.8 - bob / 40), w * .22, .2);
  c.save(); c.translate(x, y + bob); if (lunge) { c.rotate(-.3 * lunge); c.scale(1 + .3 * lunge, 1 + .3 * lunge); }
  c.globalAlpha = o.alpha === undefined ? .94 : o.alpha; c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = col; c.lineWidth = 4 * s; c.beginPath(); c.ellipse(0, -w - 9 * s, w * .55, 5 * s, 0, 0, 7); c.stroke();
  const sw = w * 2 / 3;
  c.beginPath(); c.moveTo(-w, h); c.lineTo(-w, 0); c.arc(0, 0, w, Math.PI, 0); c.lineTo(w, h);
  for (let i = 0; i < 3; i++) c.quadraticCurveTo(w - (i + .5) * sw, h + 15 * s + Math.sin(now * 5 + i + (o.ph || 0)) * 3.5 * s, w - (i + 1) * sw, h);
  c.closePath(); c.fillStyle = balMix('#ffffff', col, .3); c.fill(); c.strokeStyle = INK; c.lineWidth = Math.max(2.5, 4 * s); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(-w * .5, -h * .25, w * .13, h * .22, -.4, 0, 7); c.fill();
  c.fillStyle = INK; c.beginPath(); c.ellipse(-w * .34, -h * .02, 3.2 * s, (5 + lunge * 2) * s, 0, 0, 7); c.ellipse(w * .34, -h * .02, 3.2 * s, (5 + lunge * 2) * s, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(0, h * .38, (3 + lunge * 3) * s, (3.5 + lunge * 4) * s, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,110,165,.5)'; c.beginPath(); c.ellipse(-w * .6, h * .3, 4 * s, 2.5 * s, 0, 0, 7); c.ellipse(w * .6, h * .3, 4 * s, 2.5 * s, 0, 0, 7); c.fill();
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

function partyGhostDraw(R, pk) {
  const k = partyGhostKit(R), m = me(), watch = party.watch, target = pk.target, frame = pk.frame, ready = k.live && k.charges.ready();
  const alive = pk.alive, ghosts = R.players.filter(p => !p.left && p.lives <= 0 && p.id !== m.id), intro = Math.max(0, 1 - (now - k.born) / 2.4);
  txt(t('ROUND {n} / {total}', { n: R.round + 1, total: R.total }), W / 2, 32, 26, '#FFE14D');
  txt('YOU ARE A GHOST! HAUNT THE LIVING', W / 2, 70, 22, balMix('#9fe3ff', '#ffffff', .5 + .5 * Math.sin(now * 4)), 'center', 560);
  ghostDraw(200, 36, .5, m.color, { ph: 1 }); ghostDraw(600, 36, .5, m.color, { ph: 2 });
  // the living player's game, as everybody else sees it: a sabotage you throw lands here
  box3(16, 100, 468, 358, target ? target.color : '#35406a', 4, 4);
  ctx.fillStyle = '#19172d'; ctx.fillRect(20, 104, 460, 350);
  if (frame && frame.image) {
    ctx.drawImage(frame.image, 20, 106, 460, 345);
    if (target && !R.cur[target.id] && now - frame.at > 3) { box(20, 104, 460, 36, 'rgba(0,0,0,.8)', 0); txt('RECONNECTING TO THE PLAYER...', 250, 122, 16, '#FFE14D', 'center', 440); }
  } else txt(target ? 'CONNECTING TO THE PLAYER...' : 'WAITING FOR THE NEXT ROUND', 250, 280, 22, '#FFE14D', 'center', 430);
  if (target) { box(24, 108, 190, 26, target.color, 3); txt(target.name, 119, 122, 15, INK, 'center', 176); if (R.cur[target.id]) { box(20, 400, 460, 54, 'rgba(0,0,0,.7)', 0); txt('FINISHED', 250, 427, 26, '#ddd'); } }
  const fl = k.flash && now - k.flash.at < .7 ? k.flash : null;
  if (fl && fl.to === watch.target) { const a = 1 - (now - fl.at) / .7; ctx.strokeStyle = SAB_KINDS[fl.k].col; ctx.lineWidth = 14; ctx.globalAlpha = a; ctx.strokeRect(27, 111, 446, 336); ctx.globalAlpha = 1; }
  if (intro > 0) {   // first seconds as a ghost: the ghost rises over the game
    ctx.globalAlpha = Math.min(1, intro * 2); box(20, 190, 460, 150, 'rgba(10,8,30,.82)', 0); ghostDraw(110, 262 - (1 - intro) * 40, 1.7, m.color, { lunge: .6 + .4 * Math.sin(now * 8) });
    txt('YOU ARE A GHOST!', 300, 236, 30, '#9fe3ff', 'center', 290); txt('TRAPS CHARGE BOOS · BOO THE LIVING', 300, 282, 16, '#FFE14D', 'center', 290); ctx.globalAlpha = 1;
  }
  // who is still alive: tap a card to watch them, BOO! to haunt them
  alive.forEach((p, i) => {
    const y = 104 + i * 90, done = !!R.cur[p.id], sel = p.id === watch.target, hit = now - (k.hits[p.id] || -9) < .9, can = ready && !done;
    box3(496, y, 288, 80, hit ? balMix('#35406a', SAB_KINDS[(k.flash || { k: 'ink' }).k].col, .5) : sel ? '#46507a' : '#2b2845', 3, 3);
    if (sel) { ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 3; ctx.strokeRect(493, y - 3, 294, 86); }
    claude(534 + (hit ? Math.sin(now * 60) * 3 : 0), y + 71, 2.3, { col: p.color, mood: hit ? 'sad' : null });
    txt(p.name, 574, y + 24, 18, p.color, 'left', 100); txt(done ? 'FINISHED' : 'PLAYING NOW', 574, y + 54, 13, done ? '#aaa' : '#7BD88F', 'left', 100);
    btns.push({ x: 496, y, w: 186, h: 80, fn: () => { watch.target = p.id; watch.manual = true; } });
    button(690, y + 8, 86, 64, 'BOO!', () => k.ch.send(p.id), { size: 24, fill: can ? '#FF9A3D' : '#d3cfe0' });
    if (can) { ctx.globalAlpha = .4 + .4 * Math.sin(now * 8); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(693, y + 11, 80, 58); ctx.globalAlpha = 1; }
  });
  ghosts.forEach((p, i) => { const y = 104 + alive.length * 90 + 6 + i * 36; ghostDraw(512, y + 12, .42, p.color, { ph: i * 2 }); txt(p.name, 540, y + 14, 15, p.color, 'left', 130); txt('GHOST', 776, y + 14, 12, '#9fe3ff', 'right', 90); });
  // the traps: win them to charge a BOO
  k.traps.draw(16, 466, 468, (mx, y, mw) => {
    box(mx, y, mw, 88, '#322d52', 3); ghostDraw(mx + 46, y + 40, .8, m.color, { ph: 3 });
    if (!k.live) txt('GET READY...', mx + mw / 2 + 36, y + 44, 22, '#fff', 'center', 330);
    else if (k.traps.soon()) { ctx.globalAlpha = .5 + .5 * Math.sin(now * 16); txt('HEADS UP!', mx + mw / 2 + 36, y + 44, 26, '#FF4D5E', 'center', 330); ctx.globalAlpha = 1; }
    else txt('WIN THE TRAPS TO CHARGE A BOO', mx + mw / 2 + 36, y + 44, 17, '#c9c6e0', 'center', 340);
  });
  // my BOO energy: orbs fill up, no numbers
  const ch = k.charges, px = 496, py = 466;
  box3(px, py, 288, 88, ready ? '#3b3550' : '#2b2845', 3, 3);
  ghostDraw(px + 44, py + 40, .85, m.color, { lunge: k.lunge });
  for (let i = 0; i < ch.max; i++) {
    const ox = px + 120 + i * 62, oy = py + 38, full = i < ch.n, next = i === ch.n, pop = full && now - k.pulse < .5 ? 1 + (1 - (now - k.pulse) / .5) * .4 : 1;
    circ(ox, oy, 19 * pop, full ? '#9fe3ff' : '#14101c', 4);
    if (full) { ctx.fillStyle = 'rgba(255,255,255,' + (.35 + .3 * Math.sin(now * 6 + i)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(ox - 6, oy - 6, 6, 0, 7); ctx.fill(); }
    else if (next) { ctx.strokeStyle = '#9fe3ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(ox, oy, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ch.clock / ch.cfg.every)); ctx.stroke(); }
  }
  txt(ready ? 'BOO READY!' : ch.n > 0 && ch.cd > 0 ? 'RECHARGING...' : 'WIN A TRAP!', px + 176, py + 74, 14, ready ? '#5CFF7A' : '#c9c6e0', 'center', 160);
  button(14, 10, 130, 44, 'LEAVE', () => partyLeave(), { size: 18, fill: 'rgba(255,255,255,.85)' });
}

/* the living side: a channel that only receives (a hit on me draws over my game, a hit on someone else is a toast) and attaches itself to the relay */
function partyGhostReceiver(R) {
  if (!SAB_GHOST_MODES.includes(R.mode) || !party.sig) return null;
  const ch = createSabChannel(R, null, {}), S = party.sig, h = (type, data, from) => { ch.receive(type, data, from); };
  S.handler = h; S.buf.splice(0).forEach(x => x.round === S.round && h(x.t, x.d, x.from));
  return ch;
}
/* "NAME SABOTAGES YOU!" over the bottom of my game while the hit lasts */
function partyGhostBanner(hit) {
  if (!hit) return;
  const a = Math.min(1, (hit.life - (now - hit.at)) / .5), kd = SAB_KINDS[hit.k];
  ctx.save(); ctx.globalAlpha = Math.max(0, a); box(150, 500, 500, 40, 'rgba(20,16,28,.9)', 3); ghostDraw(186, 512, .42, kd.col, { ph: hit.seed });
  txt(t('{name} SABOTAGES YOU!', { name: hit.name.toUpperCase() }), 420, 520, 19, kd.col === '#E8EEFF' ? '#fff' : kd.col, 'center', 430); ctx.restore();
}
