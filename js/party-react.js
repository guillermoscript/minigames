'use strict';
/* Table reactions and deck guesses for players who would otherwise just wait (loaded before party-modes.js). Two building blocks any mode can opt into:
   1. createReactions(R, relay, o)  a bar of five emotes: tap one and it floats up from your seat on everybody's table. A run of quick taps is a streak (o.onTap).
   2. createGuess(R, relay, o)      "which deck will they pick?": every watcher bets left or right, the bets show as little players above the decks, and the pick settles them.
   Both only use light relay messages ('react', 'guess'; nothing is stored). REACT_IDS, REACT_MODES and GUESS_SIDES must match REACT_KINDS, REACT_MODES and GUESS_SIDES
   in pocketbase/pb_hooks/party.js, which validates the relay (test/party-react.test.js checks both). */
const REACT_IDS = ['heart', 'star', 'laugh', 'wow', 'fire'];
const REACT_MODES = ['cards'];             // modes that opted in (the server refuses the messages anywhere else); co-op modes (team, lantern, duo, squad) have no idle players
const GUESS_SIDES = ['left', 'right'];
const REACT_GAP = .08, REACT_LIFE = 1.7;   // seconds between two of my taps / how long an emote floats

/* the emotes, drawn in the DUO look (thick ink outline, flat fill); s = 1 is about 40 px across */
function reactDraw(k, x, y, s = 1) {
  const c = ctx;
  c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 3.5;
  if (k === 'heart') {
    c.fillStyle = '#FF4D8D'; c.beginPath(); c.moveTo(0, 16); c.bezierCurveTo(-28, -2, -15, -24, 0, -10); c.bezierCurveTo(15, -24, 28, -2, 0, 16); c.closePath(); c.stroke(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.65)'; c.beginPath(); c.ellipse(-10, -9, 4.5, 2.6, -.6, 0, 7); c.fill();
  } else if (k === 'star') {
    star(0, 1, 21, 9.5, 5, -Math.PI / 2, '#FFE14D', 3.5);
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(-5, -6, 3, 2, -.6, 0, 7); c.fill();
  } else if (k === 'laugh') {
    circ(0, 0, 17, '#FFD23F', 3.5); c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.arc(-6.5, -4, 3.6, Math.PI * 1.1, Math.PI * 1.9); c.moveTo(10.1, -4); c.arc(6.5, -4, 3.6, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.fillStyle = '#5a0f1f'; c.beginPath(); c.moveTo(-9, 2); c.quadraticCurveTo(0, 5, 9, 2); c.quadraticCurveTo(7, 14, 0, 14); c.quadraticCurveTo(-7, 14, -9, 2); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ff7a8a'; c.beginPath(); c.ellipse(0, 11, 4, 2.4, 0, 0, 7); c.fill();
  } else if (k === 'wow') {
    circ(0, 0, 17, '#9fe3ff', 3.5); c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 2.5;
    [-7, 7].forEach(dx => { c.beginPath(); c.arc(dx, -4, 5, 0, 7); c.fill(); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(dx, -3.5, 1.9, 0, 7); c.fill(); c.fillStyle = '#fff'; });
    c.fillStyle = '#5a0f1f'; c.beginPath(); c.ellipse(0, 8, 4.4, 6, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-12, -14); c.lineTo(-4, -11); c.moveTo(12, -14); c.lineTo(4, -11); c.stroke();
  } else {
    c.fillStyle = '#FF7A1F'; c.beginPath(); c.moveTo(0, -22); c.bezierCurveTo(4, -10, 17, -6, 16, 7); c.bezierCurveTo(15, 18, 7, 21, 0, 21); c.bezierCurveTo(-8, 21, -16, 16, -15, 6); c.bezierCurveTo(-14, -2, -8, -4, -7, -12); c.bezierCurveTo(-3, -8, -1, -6, 0, -22); c.closePath(); c.stroke(); c.fill();
    c.fillStyle = '#FFE14D'; c.beginPath(); c.moveTo(0, -3); c.bezierCurveTo(3, 2, 9, 4, 8, 11); c.bezierCurveTo(7, 17, 3, 18, 0, 18); c.bezierCurveTo(-5, 18, -8, 14, -7, 9); c.bezierCurveTo(-6, 5, -2, 4, 0, -3); c.closePath(); c.fill();
  }
  c.restore();
}

/* R = the room, relay = the duoCtx of this round. o: { origin(id) -> {x, y} where that player's emotes start (default: bottom middle), onTap(streak, kind) }
   rx.send(k) throws one (false when it is too soon), rx.receive(type, data, from) is for the relay handler, rx.bar(x, y, w, h) draws the buttons, rx.draw() the floating emotes. */
function createReactions(R, relay, o = {}) {
  const rx = { items: [], streak: 0, last: -9, tapAt: -9 };
  const spawn = (k, id) => { rx.items.push({ k, id, at: now, seed: Math.random() * 6 }); if (rx.items.length > 40) rx.items.shift(); };
  rx.send = k => {
    if (!REACT_IDS.includes(k) || now - rx.tapAt < REACT_GAP) return false;
    rx.tapAt = now; rx.streak = now - rx.last < .7 ? rx.streak + 1 : 1; rx.last = now;
    spawn(k, party.you.id); relay.send('react', { k });
    sabTry(() => sfx.blip(Math.min(16, rx.streak)));
    if (o.onTap) o.onTap(rx.streak, k);
    return true;
  };
  rx.receive = (type, data, from) => {
    if (type !== 'react' || !data || !REACT_IDS.includes(data.k) || typeof from !== 'string' || from === party.you.id) return false;
    if (rx.items.filter(i => i.id === from).length >= 12) return false;     // one noisy friend cannot bury the table
    spawn(data.k, from); return true;
  };
  rx.streakNow = () => now - rx.last < .7 ? rx.streak : 0;
  rx.bar = (x, y, w, h = 36) => {
    const n = REACT_IDS.length, gap = 8, bw = (w - gap * (n - 1)) / n;
    REACT_IDS.forEach((k, i) => { const bx = x + i * (bw + gap); button(bx, y, bw, h, '', () => rx.send(k), { fill: '#fff' }); reactDraw(k, bx + bw / 2, y + h / 2 + 1, h / 46); });
  };
  rx.draw = () => {
    rx.items = rx.items.filter(i => now - i.at < REACT_LIFE);
    for (const i of rx.items) {
      const age = now - i.at, u = age / REACT_LIFE, pl = R.players.find(p => p.id === i.id), from = o.origin ? o.origin(i.id) : null, ox = from ? from.x : W / 2, oy = from ? from.y : 540;
      const x = ox + Math.sin(age * 5 + i.seed) * 16 + (i.seed - 3) * 5 * u, y = oy - 18 - (1 - Math.pow(1 - Math.min(1, age / .9), 2)) * 250 - Math.max(0, age - .9) * 60, pop = Math.min(1, age / .12);
      ctx.save(); ctx.globalAlpha = Math.min(1, (REACT_LIFE - age) / .45);
      if (pl) { ctx.strokeStyle = pl.color; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 27 * (.7 + .3 * pop), 0, 7); ctx.stroke(); }
      reactDraw(i.k, x, y, (.7 + .5 * pop) * 1.05); ctx.restore();
    }
  };
  return rx;
}

/* "which deck will they pick?" R = the room, relay = this round's duoCtx. o: { onPick(side) }
   g.mine is my current bet, g.pick(side) changes it, g.receive(type, data, from) is for the relay handler, g.sides() = { left: [ids], right: [ids] } of everybody's bets (mine included). */
function createGuess(R, relay, o = {}) {
  const g = { mine: '', others: {} };
  g.pick = side => {
    if (!GUESS_SIDES.includes(side)) return false;
    if (g.mine !== side) { g.mine = side; relay.send('guess', { s: side }, true); sabTry(() => sfx.blip(side === 'left' ? 8 : 12)); }
    if (o.onPick) o.onPick(side);
    return true;
  };
  g.receive = (type, data, from) => {
    if (type !== 'guess' || !data || !GUESS_SIDES.includes(data.s) || typeof from !== 'string' || from === party.you.id) return false;
    g.others[from] = data.s; return true;
  };
  g.sides = () => {
    const out = { left: [], right: [] };
    for (const p of R.players) { if (p.left) continue; const s = p.id === party.you.id ? g.mine : g.others[p.id]; if (s && out[s]) out[s].push(p.id); }
    return out;
  };
  return g;
}
