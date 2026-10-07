'use strict';
/* WAITING in the modes where everybody plays at once (VERSUS and TEAM). A player who finishes or fails early waits a few seconds for the others: instead of only watching
   they play the shared trap minigames (createIdleTraps, js/party-sab.js: gold bubble, stop-in-the-green dial, arrow sequence), and every win charges an orb that is spent on:
     VERSUS  SABOTAGE  a soft hit (the `ghost` kinds of SAB_KINDS at SAB_SOFT strength) on a player who has NOT finished yet. Competitive and fair: nobody is hit after their
                       result is in, and the thrower is already done, so it can only reshuffle the players behind them.
     TEAM    CHEER     a harmless sparkle border + toast on the teammates still playing (createCheerChannel below). Co-op: there is never a sabotage between teammates,
                       and a cheer changes no score, life or timer; it is only feedback.
   Waiting never lengthens a round and never blocks the next one: the server closes the round as before, and this screen simply stops being drawn.
   Server rules (pocketbase/pb_hooks/party.js): only a player whose result is in may send, only 'sab' (VERSUS) or 'cheer' (TEAM), after the instruction card, rate limited.
   CHEER_IDS and WAIT_CHEER_MODES must match CHEER_KINDS and CHEER_MODES in the hook (test/party-wait.test.js checks it). The pieces:
     partyWaitOn(R)           is the waiting screen showing (my result is in, the round is still live)
     partyWaitUpdate(R, dt)   every frame: charges and traps tick
     partyWaitDraw(R, pick)   the whole waiting screen, in place of the plain spectator one (pick = partyWatchPick(R))
     partyWaitKey(e)          keyboard: trap keys, E = throw / cheer
     partyWaitReceiver(R)     the players still playing: a receive-only channel (soft hit or cheer overlay) that partySpectatorGame draws */
const WAIT_CHEER_MODES = ['team'];
const WAIT_CFG = { versus: { max: 2, every: 4, trap: 1, comboEvery: 1e9, cooldown: 2.4 }, team: { max: 3, every: 4, trap: 1, comboEvery: 1e9, cooldown: 1.6 } };   // rounds last 5-8 s, so charges come fast; the client cooldown is a little longer than the server gap
const WAIT_TRAPS = { fly: 0, jam: 0, bubble: .34, dial: .33, seq: .33 };       // no pump to jam and nothing to swat: only the three that pay a charge
const WAIT_WORDS = { bubble: 'NICE!', dial: 'PERFECT!', seq: 'COMBO!', over: 'TOO LATE!' };

/* ───────────── cheers (the co-op counterpart of the sabotage registry) ─────────────
   Every kind draws in the 800x600 space of the receiver's game, 2 to 3 s, ONLY along the edges (never over the middle) and never touches input.
     label, col   what the toast says and its colour; life = seconds
     draw(ctx, t, a, s)  t = seconds since it landed, a = fade envelope 0..1, s.seed = per-cheer random */
const CHEER_KINDS = {
  sparkle: { id: 'sparkle', label: 'SPARKLE!', col: '#FFE14D', life: 2.4, draw(c, t, a, s) {
    c.strokeStyle = 'rgba(255,225,77,' + (.45 + .2 * Math.sin(now * 9)).toFixed(2) + ')'; c.lineWidth = 12; c.strokeRect(6, 6, W - 12, H - 12);
    const per = 2 * (W + H);
    for (let i = 0; i < 18; i++) {
      const d = ((i / 18 + t * .07 + s.seed * .013) % 1) * per; let x, y;
      if (d < W) { x = d; y = 12; } else if (d < W + H) { x = W - 12; y = d - W; } else if (d < 2 * W + H) { x = W - (d - W - H); y = H - 12; } else { x = 12; y = H - (d - 2 * W - H); }
      star(x, y, 13 + 6 * Math.sin(now * 8 + i * 1.7), 4, 4, now * 2 + i, '#FFE14D', 2);
    }
  } },
  rainbow: { id: 'rainbow', label: 'RAINBOW!', col: '#4DB8FF', life: 2.4, draw(c, t) {
    ['#FF4D5E', '#FF9A3D', '#FFE14D', '#5CFF7A', '#4DB8FF', '#B49CFF'].forEach((col, i) => { const o = 4 + i * 5 + Math.sin(now * 6 + i) * 2; c.strokeStyle = col; c.lineWidth = 5; c.strokeRect(o, o, W - 2 * o, H - 2 * o); });
  } },
  hearts: { id: 'hearts', label: 'LOVE!', col: '#FF4D8D', life: 2.6, draw(c, t, a, s) {
    for (let i = 0; i < 12; i++) {
      const left = i % 2 === 0, x = (left ? 30 : W - 30) + Math.sin(t * 2 + i) * 12 + (left ? 1 : -1) * (i * 13 % 34), y = H + 30 - ((t * 120 + i * 71 + s.seed * 7) % (H + 80));
      reactDraw('heart', x, y, .55 + (i % 3) * .12);   // js/party-react.js
    }
  } },
  party: { id: 'party', label: 'PARTY!', col: '#B49CFF', life: 2.6, draw(c, t, a, s) {
    const cols = ['#FF4D9E', '#4DB8FF', '#FFE14D', '#5CFF7A', '#FF9A3D', '#B49CFF'];
    for (let i = 0; i < 28; i++) {
      const x = (i % 2 ? 6 : W - 66) + (i * 29 + s.seed * 5) % 60, y = (t * (90 + i * 4 % 50) + i * 53) % (H + 40) - 20;
      c.save(); c.translate(x, y); c.rotate(t * 3 + i); c.fillStyle = cols[i % cols.length]; c.fillRect(-6, -3, 12, 6); c.restore();
    }
  } },
};
const CHEER_IDS = Object.keys(CHEER_KINDS);
const cheerMake = (k, name) => ({ k, at: now, name: name || '', seed: Math.random() * 100, life: CHEER_KINDS[k].life });
const cheerLive = c => !!c && CHEER_KINDS[c.k] !== undefined && now - c.at <= c.life;
const cheerEnvelope = c => Math.max(0, Math.min(1, (now - c.at) / .2, (c.life - (now - c.at)) / .5));
function cheerDraw(c) {
  if (!cheerLive(c)) return;
  ctx.save(); ctx.globalAlpha = cheerEnvelope(c); sabTry(() => CHEER_KINDS[c.k].draw(ctx, now - c.at, cheerEnvelope(c), c)); ctx.restore();
}
/* "NAME CHEERS YOU ON!" over the bottom of my game while it lasts (the same place as the ghost pill) */
function cheerBanner(c) {
  if (!cheerLive(c)) return;
  const kd = CHEER_KINDS[c.k];
  ctx.save(); ctx.globalAlpha = Math.min(1, (c.life - (now - c.at)) / .5); box(150, 500, 500, 40, 'rgba(20,16,28,.9)', 3); star(186, 520, 14, 6, 5, now * 2, kd.col, 2);
  txt(t('{name} CHEERS YOU ON!', { name: c.name.toUpperCase() }), 420, 520, 19, kd.col, 'center', 430); ctx.restore();
}

/* The cheer channel, shaped like createSabChannel: o = { charges, send(type, data) (the relay), onSend(kind), onHit(state, fromId) }.
   cc.send() spends a charge and tells the whole team; cc.receive(type, data, from) is for the relay handler; cc.active() is the cheer on me (expires by itself). */
function createCheerChannel(R, o = {}) {
  const cc = { charges: o.charges, state: null, last: '' };
  cc.pick = () => { const ids = CHEER_IDS.filter(k => k !== cc.last); return ids[Math.floor(Math.random() * ids.length)]; };
  cc.send = () => {
    if (!WAIT_CHEER_MODES.includes(R.mode) || !cc.charges.ready()) return false;
    cc.charges.spend(); const k = cc.last = cc.pick();
    if (o.send) o.send('cheer', { k });
    if (o.onSend) sabTry(() => o.onSend(k));
    return true;
  };
  cc.receive = (type, data, from) => {
    if (type !== 'cheer' || !data || !CHEER_IDS.includes(data.k) || from === party.you.id) return false;
    const cur = party.room && party.room.id === R.id ? party.room : R, pl = cur.players.find(p => p.id === from);
    if (!pl || !WAIT_CHEER_MODES.includes(cur.mode)) return false;
    cc.state = cheerMake(data.k, pl.name);
    sabTry(() => { sfx.sparkle(); floatText(CHEER_KINDS[data.k].label, 400, 150, CHEER_KINDS[data.k].col, 36); });
    if (o.onHit) o.onHit(cc.state, from);
    return true;
  };
  cc.active = () => { if (cc.state && !cheerLive(cc.state)) cc.state = null; return cc.state; };
  return cc;
}

/* ───────────── the waiting player's kit ───────────── */
const partyWaitOn = R => !!R && R.state === 'round' && (SAB_RACE_MODES.includes(R.mode) || WAIT_CHEER_MODES.includes(R.mode)) && party.view === 'wait' && !!me() && !!(R.cur && R.cur[party.you.id] || party.pending);
/* built once per room (charges survive the rounds), traps and channel rebuilt every round */
function partyWaitKit(R) {
  let k = party.wait;
  if (!k || k.room !== R.id) k = party.wait = { room: R.id, round: -1, charges: createSabCharges(WAIT_CFG[R.mode]), pulse: -9, flash: null, lunge: 0, hits: {} };
  if (k.round !== R.round) {
    k.round = R.round; k.hits = {};
    k.traps = createIdleTraps({ at: { x: 250, y: 500 }, first: [.25, .35], gap: [.8, 1], weights: WAIT_TRAPS, words: WAIT_WORDS, onReward: () => { k.charges.earn('trap'); k.pulse = now; } });
    const send = (type, data) => sabSendDirect(type, data, R2 => { const w = party.wait; return w && w.room === R2.id && w.round === R2.round ? w.charges : null; });
    if (SAB_RACE_MODES.includes(R.mode)) k.ch = createSabChannel(R, { send }, { charges: k.charges, wait: true, onSend: (kind, to) => sabThrownFx(k, kind, to) });
    else k.cc = createCheerChannel(R, { charges: k.charges, send, onSend: kind => partyWaitCheered(k, kind) });
  }
  return k;
}
/* TEAM: the cheer went out. Everybody still playing is lit on its card, the viewer glows in the cheer's colour, and a toast says what it was */
function partyWaitCheered(k, kind) {
  const R = party.room, kd = CHEER_KINDS[kind];
  k.flash = { k: kind, at: now, to: '*' }; k.lunge = 1; if (R) R.players.forEach(p => { if (!p.left && p.id !== party.you.id && !R.cur[p.id]) k.hits[p.id] = now; });
  sfx.sparkle(); shake(3, .2); ring(250, 280, kd.col, 160, .5); burst(250, 280, kd.col, 22, 420); floatText(kd.label, 250, 236, kd.col, 48);
}
function partyWaitUpdate(R, dt) {
  const k = party.wait;
  if (!partyWaitOn(R)) { if (k) k.charges.cd = Math.max(0, k.charges.cd - dt); return; }   // the cooldown keeps running through the results screen
  const w = partyWaitKit(R); w.lunge = Math.max(0, w.lunge - dt * 3.2); w.charges.tick(dt); w.traps.update(dt);
}
/* E (or Q) throws at the player I am watching (VERSUS) or cheers the team (TEAM) */
function partyWaitThrow(k) {
  if (k.cc) { k.cc.send(); return; }
  const list = k.ch.targets(), pick = list.find(p => p.id === party.watch.target) || list[0];
  if (pick) k.ch.send(pick.id);
}
function partyWaitKey(e) {
  const R = party.room; if (!R || e.repeat || !partyWaitOn(R)) return;
  const k = partyWaitKit(R); if (!k.traps.key(e.code) && (e.code === 'KeyE' || e.code === 'KeyQ')) partyWaitThrow(k);
}

function partyWaitDraw(R, pk) {
  const k = partyWaitKit(R), m = me(), watch = party.watch, target = pk.target, frame = pk.frame, race = !k.cc, ready = k.charges.ready(), my = R.cur[m.id] || party.pending;
  const kindOf = id => SAB_KINDS[id] || CHEER_KINDS[id] || SAB_KINDS.ink, accent = race ? '#FF9A3D' : '#FFE14D';
  txt(t('ROUND {n} / {total}', { n: R.round + 1, total: R.total }), W / 2, 32, 26, '#FFE14D');
  txt(race ? 'DONE! WIN TRAPS TO SABOTAGE THE REST' : 'DONE! WIN TRAPS TO CHEER YOUR TEAM ON', W / 2, 70, 21, my && my.r === 'win' ? '#5CFF7A' : '#FFE14D', 'center', 700);
  // the game of the player I am watching, as everybody sees it: a sabotage I throw lands here
  box3(16, 100, 468, 358, target ? target.color : '#35406a', 4, 4);
  ctx.fillStyle = '#19172d'; ctx.fillRect(20, 104, 460, 350);
  if (frame && frame.image) {
    ctx.drawImage(frame.image, 20, 106, 460, 345);
    if (target && !R.cur[target.id] && now - frame.at > 3) { box(20, 104, 460, 36, 'rgba(0,0,0,.8)', 0); txt('RECONNECTING TO THE PLAYER...', 250, 122, 16, '#FFE14D', 'center', 440); }
  } else txt(target ? 'CONNECTING TO THE PLAYER...' : 'WAITING FOR THE NEXT ROUND', 250, 280, 22, '#FFE14D', 'center', 430);
  if (target) { box(24, 108, 190, 26, target.color, 3); txt(target.name, 119, 122, 15, INK, 'center', 176); if (R.cur[target.id]) { box(20, 400, 460, 54, 'rgba(0,0,0,.7)', 0); txt('FINISHED', 250, 427, 26, '#ddd'); } }
  const fl = k.flash && now - k.flash.at < .7 ? k.flash : null;
  if (fl && (fl.to === '*' || fl.to === watch.target)) { ctx.strokeStyle = kindOf(fl.k).col; ctx.lineWidth = 14; ctx.globalAlpha = 1 - (now - fl.at) / .7; ctx.strokeRect(27, 111, 446, 336); ctx.globalAlpha = 1; }
  // everybody else: tap a card to watch them; VERSUS also has a SABOTAGE! button on every player still playing
  pk.friends.forEach((p, i) => {
    const y = 104 + i * 90, done = !!R.cur[p.id], sel = p.id === watch.target, hit = now - (k.hits[p.id] || -9) < .9, can = race && ready && !done;
    box3(496, y, 288, 80, hit ? balMix('#35406a', kindOf((k.flash || { k: 'ink' }).k).col, .5) : sel ? '#46507a' : '#2b2845', 3, 3);
    if (sel) { ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 3; ctx.strokeRect(493, y - 3, 294, 86); }
    claude(534 + (hit ? Math.sin(now * 60) * 3 : 0), y + 71, 2.3, { col: p.color, mood: hit && race ? 'sad' : hit || done ? 'happy' : null });
    txt(p.name, 574, y + 24, 18, p.color, 'left', race ? 100 : 196); txt(done ? 'FINISHED' : 'PLAYING NOW', 574, y + 54, 13, done ? '#aaa' : '#7BD88F', 'left', race ? 100 : 196);
    btns.push({ x: 496, y, w: race ? 190 : 288, h: 80, fn: () => { watch.target = p.id; watch.manual = true; } });
    if (race) {
      button(690, y + 8, 88, 64, 'SABOTAGE!', () => k.ch.send(p.id), { size: 15, fill: can ? '#FF9A3D' : '#d3cfe0' });
      if (can) { ctx.globalAlpha = .4 + .4 * Math.sin(now * 8); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(693, y + 11, 82, 58); ctx.globalAlpha = 1; }
    }
  });
  // the traps: win them to charge
  k.traps.draw(16, 466, 468, (mx, y, mw) => {
    box(mx, y, mw, 88, '#322d52', 3); claude(mx + 40, y + 80, 2.4, { col: m.color, mood: my && my.r === 'win' ? 'happy' : null });
    if (k.traps.soon()) { ctx.globalAlpha = .5 + .5 * Math.sin(now * 16); txt('HEADS UP!', mx + mw / 2 + 36, y + 44, 26, '#FF4D5E', 'center', 330); ctx.globalAlpha = 1; }
    else txt(race ? 'WIN TRAPS TO CHARGE SABOTAGE' : 'WIN TRAPS TO CHARGE A CHEER', mx + mw / 2 + 36, y + 44, 17, '#c9c6e0', 'center', 340);
  });
  // my charges: orbs, no numbers, and the big throw / cheer button
  const px = 496, py = 466;
  box3(px, py, 288, 88, ready ? '#3b3550' : '#2b2845', 3, 3);
  sabOrbs(k.charges, px + 74, py + 32, { r: 15, gap: 38, col: accent, pulse: k.pulse });
  txt(ready ? race ? 'SABOTAGE READY!' : 'CHEER READY!' : k.charges.n > 0 && k.charges.cd > 0 ? 'RECHARGING...' : 'WIN A TRAP!', px + 74, py + 70, 13, ready ? '#5CFF7A' : '#c9c6e0', 'center', 140);
  button(px + 150, py + 10, 130, 68, race ? 'SABOTAGE!' : 'CHEER!', () => partyWaitThrow(k), { size: 22, fill: ready ? accent : '#d3cfe0' });
  button(14, 10, 130, 44, 'LEAVE', () => partyLeave(), { size: 18, fill: 'rgba(255,255,255,.85)' });
}

/* ───────────── the players still playing ───────────── */
/* a receive-only channel that attaches itself to the relay: { active() = the soft sabotage on me, after() = what to draw over my game after the sabotage (the cheer) } */
function partyWaitReceiver(R) {
  if (!party.sig || !(SAB_RACE_MODES.includes(R.mode) || WAIT_CHEER_MODES.includes(R.mode))) return null;
  const S = party.sig, race = SAB_RACE_MODES.includes(R.mode), ch = race ? createSabChannel(R, null, {}) : createCheerChannel(R, {});
  const h = (type, data, from) => { ch.receive(type, data, from); };
  S.handler = h; S.buf.splice(0).forEach(x => x.round === S.round && h(x.t, x.d, x.from));
  return race ? { active: ch.active, after: null } : { active: () => null, after: () => { const c = ch.active(); if (c) { cheerDraw(c); cheerBanner(c); } } };
}
