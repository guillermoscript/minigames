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

/* the emotes: inked emoji stickers in the DUO look (thick INK outline, base / shade cel shading, one glint, a face that moves). s = 1 is about 44 px across.
   o (all optional): { t: seconds for the idle motion, halo: die-cut white sticker border, rot: radians, sx / sy: squash }. Draws on the global ctx and needs no kit. */
const REACT_ART = (function () {
  const circle = (c, r) => { c.beginPath(); c.arc(0, 0, r, 0, 7); };
  const eye = (c, x, y, rx, ry) => { c.fillStyle = INK; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x - rx * .32, y - ry * .38, rx * .36, ry * .3, 0, 0, 7); c.fill(); };
  const blush = (c, x, y, rx, ry) => { c.fillStyle = 'rgba(255,110,165,.55)'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); };
  const gl = (c, x, y, rx, ry, rot, a = .75) => { c.fillStyle = 'rgba(255,255,255,' + a + ')'; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 7); c.fill(); };
  const drop = (c, x, y, w) => {
    c.save(); c.translate(x, y); c.scale(w, w); c.beginPath(); c.moveTo(0, -5.5); c.quadraticCurveTo(4.6, .5, 4.2, 3); c.arc(0, 3, 4.2, 0, Math.PI); c.quadraticCurveTo(-4.6, .5, 0, -5.5); c.closePath();
    c.fillStyle = '#9fe3ff'; c.lineWidth = 2.2 / w; c.strokeStyle = INK; c.stroke(); c.fill(); gl(c, -1.4, 2, .9, 1.5, .2, .9); c.restore();
  };
  return {
    heart: { base: '#FF4D8D', shd: '#c42a68', sx: 3, sy: 4,
      body: c => { c.beginPath(); c.moveTo(0, 17); c.bezierCurveTo(-30, -2, -17, -25, 0, -10); c.bezierCurveTo(17, -25, 30, -2, 0, 17); c.closePath(); },
      face: c => { gl(c, -11, -9, 5.5, 3, -.6, .8); gl(c, -3.5, -15, 1.6, 1.6, 0, .6); } },
    star: { base: '#FFE14D', shd: '#e0a312', sx: 3, sy: 4,
      body: c => { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 10.5 : 23, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, 1.5 + Math.sin(a) * r); } c.closePath(); },
      face: (c, T) => {
        gl(c, -7, -8, 4, 2.3, -.7, .8); blush(c, -8.5, 7.5, 3.2, 2); blush(c, 8.5, 7.5, 3.2, 2);
        const bl = Math.sin(T * 1.9) > .985; if (bl) { c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(-7, 3); c.lineTo(-3, 3); c.moveTo(3, 3); c.lineTo(7, 3); c.stroke(); } else { eye(c, -5, 3, 2.2, 2.9); eye(c, 5, 3, 2.2, 2.9); }
        c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(0, 6, 3.4, .2 * Math.PI, .8 * Math.PI); c.stroke(); } },
    laugh: { base: '#FFD23F', shd: '#d9941a', sx: 4, sy: 5,
      body: c => circle(c, 19),
      face: (c, T) => {
        gl(c, -8, -11.5, 6, 3, -.5, .7); blush(c, -12.5, 4, 4, 2.4); blush(c, 12.5, 4, 4, 2.4);
        c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.arc(-7, -3, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.arc(7, -3, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
        c.fillStyle = '#5a0f1f'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-10, 3); c.quadraticCurveTo(0, 6.5, 10, 3); c.quadraticCurveTo(8, 15.5, 0, 15.5); c.quadraticCurveTo(-8, 15.5, -10, 3); c.closePath(); c.stroke(); c.fill();
        c.save(); c.clip(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, 3.5, 9, 2.6, 0, 0, 7); c.fill(); c.fillStyle = '#ff7a8a'; c.beginPath(); c.ellipse(0, 14.5, 5.2, 3.6, 0, 0, 7); c.fill(); c.restore();
        const w = Math.sin(T * 9); drop(c, -21.5 - w * .8, -1 + w * .8, 1); drop(c, 21.5 + w * .8, -1 - w * .8, 1); } },
    wow: { base: '#9fe3ff', shd: '#4fb0dc', sx: 4, sy: 5,
      body: c => circle(c, 19),
      face: (c, T) => {
        gl(c, -8, -12, 6, 3, -.5, .75);
        const j = Math.sin(T * 14) * .35;   // a tiny shiver
        for (const s of [-1, 1]) {
          c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.ellipse(s * 7 + j, -4.5, 5.4, 6.2, 0, 0, 7); c.fill(); c.stroke();
          c.fillStyle = INK; c.beginPath(); c.arc(s * 7 + j, -4, 2.3, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(s * 7 - .8 + j, -5, .9, 0, 7); c.fill();
          c.strokeStyle = INK; c.lineWidth = 2.6; c.beginPath(); c.moveTo(s * 12.5, -15.5); c.lineTo(s * 4, -13.5); c.stroke();
        }
        c.fillStyle = '#5a0f1f'; c.strokeStyle = INK; c.lineWidth = 2.6; c.beginPath(); c.ellipse(0, 9, 4.6, 6.2, 0, 0, 7); c.fill(); c.stroke();
        c.fillStyle = '#ff7a8a'; c.beginPath(); c.ellipse(0, 12, 2.6, 1.9, 0, 0, 7); c.fill(); } },
    fire: { base: '#FF7A1F', shd: '#d4480a', sx: 3, sy: 3,
      body: (c, T) => { const w = Math.sin(T * 11) * 1.6, v = .5 * w;
        c.beginPath(); c.moveTo(w, -23); c.bezierCurveTo(4 + v, -10, 17, -6, 16, 7); c.bezierCurveTo(15, 18, 7, 21, 0, 21); c.bezierCurveTo(-8, 21, -16, 16, -15, 6); c.bezierCurveTo(-14, -2, -8, -4, -7, -12); c.bezierCurveTo(-3, -8, -1 + v, -6, w, -23); c.closePath(); },
      face: (c, T) => {
        const w = Math.sin(T * 11 + 1) * 1;
        c.fillStyle = '#FFE14D'; c.beginPath(); c.moveTo(w, -3); c.bezierCurveTo(3, 2, 9, 4, 8.5, 11); c.bezierCurveTo(7.5, 17.5, 3, 18.5, 0, 18.5); c.bezierCurveTo(-5, 18.5, -8.5, 14.5, -7.5, 9); c.bezierCurveTo(-6.5, 5, -2, 4, w, -3); c.closePath(); c.fill();
        gl(c, -9, -2, 2, 4.5, .35, .55);
        eye(c, -3.2, 10, 1.7, 2.3); eye(c, 3.2, 10, 1.7, 2.3);
        c.strokeStyle = INK; c.lineWidth = 1.7; c.beginPath(); c.arc(0, 12.2, 2.4, .2 * Math.PI, .8 * Math.PI); c.stroke(); } },
  };
})();
function reactDraw(k, x, y, s = 1, o = {}) {
  const c = ctx, E = REACT_ART[k] || REACT_ART.fire, T = o.t || 0, oo = 3.5;
  c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(s * (o.sx || 1), s * (o.sy || 1)); c.lineJoin = c.lineCap = 'round';
  if (o.halo) { E.body(c, T); c.strokeStyle = INK; c.lineWidth = (oo + 4.5) * 2; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = (oo + 4.5) * 2 - 4.5; c.stroke(); }
  E.body(c, T); c.strokeStyle = INK; c.lineWidth = oo * 2; c.stroke(); c.fillStyle = E.shd; c.fill();
  c.save(); E.body(c, T); c.clip(); c.translate(-E.sx, -E.sy); E.body(c, T); c.fillStyle = E.base; c.fill(); c.restore();
  E.face(c, T);
  c.restore();
}
/* cosmetic seeds never touch Math.random or the game's RNG: a hash of how many emotes this table has thrown */
const reactSeed = n => { let a = (n | 0) + 0x6D2B79F5 | 0; a = Math.imul(a ^ a >>> 15, a | 1); a ^= a + Math.imul(a ^ a >>> 7, a | 61); return ((a ^ a >>> 14) >>> 0) / 4294967296 * 6; };
const reactKit = () => (typeof PARTY_UI !== 'undefined' ? PARTY_UI : null);   // js/party-ui.js; every piece of tray and floater art waits for it, the emote stickers above do not

/* the wooden tray under the emote buttons: a plank slab with depth, a slot for each sticker, studs that light up on a streak. Draws only (the hit regions are the buttons). */
function reactTray(rx, x, y, w, h, bw, gap) {
  const U = reactKit(), c = ctx, run = rx.streakNow(), T = now;
  const tx = x - 14, ty = y - 5, tw = w + 28, th = h + 7;   // ends 2 px (the plank) under the buttons: the streak bar of the cards screen starts right below
  c.save();
  if (!run) U.shadow(x + w / 2 + 3, ty + th + 6, tw / 2, 5, .26);   // a streak shows its bar under the tray instead
  U.rr(tx, ty + 2, tw, th, 16); U.ink('#a5622c', 4);
  U.rr(tx, ty, tw, th, 16); U.ink('#e0a060', 4);
  c.save(); U.rr(tx, ty, tw, th, 16); c.clip(); c.fillStyle = '#cf8a45'; U.rr(tx + 8, ty + th * .62, tw - 16, 3, 1.5); c.fill(); U.rr(tx + 8, ty + th * .84, tw - 16, 2.5, 1.2); c.fill(); c.restore();
  c.fillStyle = 'rgba(255,255,255,.34)'; U.rr(tx + 10, ty + 3, tw - 20, 4, 2); c.fill();
  if (run) { c.save(); c.globalAlpha = .55 + .45 * Math.sin(T * 14); U.rr(tx - 3, ty - 4, tw + 6, th + 4, 19); c.lineWidth = 3.5; c.strokeStyle = '#FFE14D'; c.stroke(); c.restore(); }
  const studs = [tx + 7, tx + tw - 7]; for (let i = 1; i < REACT_IDS.length; i++) studs.push(x + i * (bw + gap) - gap / 2);
  studs.forEach((sx, i) => {
    const lit = run > 0, ph = Math.sin(T * 16 + i * 1.7) > 0;
    c.beginPath(); c.arc(sx, y + h / 2, lit ? 3.4 : 2.8, 0, 7); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); c.fillStyle = lit ? (ph ? '#FFE14D' : '#ff9a3d') : '#a5622c'; c.fill();
  });
  REACT_IDS.forEach((k, i) => {
    const bx = x + i * (bw + gap), cx = bx + bw / 2, cy = y + h / 2 + 1, hv = typeof hovered === 'function' && hovered(bx, y, bw, h), pr = hv && typeof pressing !== 'undefined' && pressing;
    const age = now - ((rx.pops && rx.pops[k]) || -9), pop = age < .5 ? Math.exp(-age * 7) * Math.cos(age * 24) : 0, wig = age < .5 ? Math.exp(-age * 6) * Math.sin(age * 31) * .25 : 0;
    U.rr(bx + 1, y, bw - 2, h - 1, 12); U.ink(pr ? '#8a5530' : hv ? '#c27a3a' : '#b06d33', 3);
    c.fillStyle = 'rgba(20,16,28,.25)'; U.rr(bx + 6, y + 3, bw - 12, 5, 2.5); c.fill();
    if (hv) { c.strokeStyle = '#fff'; c.globalAlpha = .75; c.lineWidth = 2.5; U.rr(bx + 4, y + 3, bw - 8, h - 7, 9); c.stroke(); c.globalAlpha = 1; }
    const bob = Math.sin(T * (run ? 5 : 2.2) + i * 1.3) * 1.5, br = 1 + Math.sin(T * 3.1 + i) * .035 + (hv ? .1 : 0) + pop * .35 - (pr ? .12 : 0);
    reactDraw(k, cx, cy + bob + (pr ? 2 : 0), .72 * br, { t: T + i, halo: true, rot: wig + Math.sin(T * 1.7 + i * 2) * .05 });
  });
  c.restore();
}

/* R = the room, relay = the duoCtx of this round. o: { origin(id) -> {x, y} where that player's emotes start (default: bottom middle), onTap(streak, kind) }
   rx.send(k) throws one (false when it is too soon), rx.receive(type, data, from) is for the relay handler, rx.bar(x, y, w, h) draws the buttons, rx.draw() the floating emotes. */
function createReactions(R, relay, o = {}) {
  const rx = { items: [], streak: 0, last: -9, tapAt: -9, pops: {}, thrown: 0 };   // pops / thrown only feed the art
  const spawn = (k, id) => { rx.items.push({ k, id, at: now, seed: reactSeed(rx.thrown++ * 7 + (id.length ? id.charCodeAt(0) : 0)) }); if (rx.items.length > 40) rx.items.shift(); };
  rx.send = k => {
    if (!REACT_IDS.includes(k) || now - rx.tapAt < REACT_GAP) return false;
    rx.tapAt = now; rx.streak = now - rx.last < .7 ? rx.streak + 1 : 1; rx.last = now; rx.pops[k] = now;
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
    REACT_IDS.forEach((k, i) => {
      const bx = x + i * (bw + gap);
      ctx.save(); ctx.globalAlpha = 0; button(bx, y, bw, h, '', () => rx.send(k), { fill: '#fff' }); ctx.restore();   // the hit region; the tray below is the art
    });
    if (reactKit()) reactTray(rx, x, y, w, h, bw, gap);
  };
  rx.draw = () => {
    rx.items = rx.items.filter(i => now - i.at < REACT_LIFE);
    const U = reactKit(); if (!U) return;
    for (const i of rx.items) {
      const age = now - i.at, pl = R.players.find(p => p.id === i.id), from = o.origin ? o.origin(i.id) : null, ox = from ? from.x : W / 2, oy = from ? from.y : 540;
      const at = a => ({ x: ox + Math.sin(a * 5 + i.seed) * 16 + (i.seed - 3) * 5 * (a / REACT_LIFE), y: oy - 18 - (1 - Math.pow(1 - Math.min(1, a / .9), 2)) * 250 - Math.max(0, a - .9) * 60 });
      const p = at(age), end = Math.min(1, Math.max(0, (REACT_LIFE - age) / .3)), sc = U.outBack(age / .26) * (.5 + .5 * U.ease(end)) * 1.25;
      ctx.save(); ctx.globalAlpha = Math.min(1, (REACT_LIFE - age) / .45);
      if (age < .4) { ctx.strokeStyle = pl ? pl.color : '#fff'; ctx.globalAlpha *= 1 - age / .4; ctx.lineWidth = 6 * (1 - age / .4) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, 18 + age * 90, 0, 7); ctx.stroke(); ctx.globalAlpha = Math.min(1, (REACT_LIFE - age) / .45); }
      if (pl) for (let j = 1; j <= 3; j++) {   // a little sparkle trail in the sender's colour
        const a2 = age - j * .1; if (a2 <= 0) continue; const q = at(a2), tw = .6 + .4 * Math.sin(age * 20 + j * 2 + i.seed);
        ctx.save(); ctx.globalAlpha *= .8 - j * .2; star(q.x + (j % 2 ? 9 : -9), q.y + j * 6, (6 - j) * tw + 1, (3 - j * .5) * tw + .5, 4, .3 * j, pl.color, 1.5); ctx.restore();
      }
      U.shadow(p.x + 5, p.y + 27 * sc, 17 * sc, 5 * sc, .26);
      reactDraw(i.k, p.x, p.y, sc * .95, { t: now + i.seed, halo: true, rot: Math.sin(age * 6 + i.seed) * .13 * Math.min(1, age * 4) });
      if (pl) U.avatar(p.x + 17 * sc, p.y + 17 * sc, 8.5 * sc, pl.color, { t: now, seed: i.seed, mood: 'happy' });
      ctx.restore();
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
  /* the art of one deck of the pick screen (the screen itself calls this, the bets are what g.sides() says). (x, y) = top-left of the top card (190 x 150); side = 'left' | 'right';
     o: { t: seconds, bets: [player ids hopping on it], lit: this is my bet, players: [{id, color}] (default R.players) }. Draws only, no hit regions. */
  g.drawDeck = (x, y, side, o = {}) => {
    const U = reactKit(); if (!U) return;
    const c = ctx, T = o.t || 0, lit = !!o.lit, pls = o.players || R.players, ids = o.bets || [], wob = Math.sin(T * 1.3 + (side === 'left' ? 0 : 2)) * 1.2;
    c.save();
    U.shadow(x + 100, y + 160, 100, 12, .3);
    for (let i = 2; i >= 0; i--) {
      const cx = x + i * 6, cy = y - i * 6, top = i === 0, dy = top ? wob * .5 : 0;
      U.rr(cx, cy + dy, 190, 150, 16); U.ink(top ? '#3f3475' : '#352c63', 4);
      c.save(); U.rr(cx, cy + dy, 190, 150, 16); c.clip(); c.translate(-4, -5); U.rr(cx, cy + dy, 190, 150, 16); c.fillStyle = top ? '#6a58b4' : '#54478f'; c.fill(); c.restore();
      if (top) {
        c.save(); U.rr(cx, cy + dy, 190, 150, 16); c.clip();
        c.fillStyle = 'rgba(255,255,255,.07)'; for (let k = -4; k < 12; k++) { c.beginPath(); c.moveTo(cx + k * 24, cy); c.lineTo(cx + k * 24 + 12, cy); c.lineTo(cx + k * 24 + 12 + 150, cy + 150); c.lineTo(cx + k * 24 + 150, cy + 150); c.closePath(); c.fill(); }
        c.restore();
        c.strokeStyle = lit ? '#FFE14D' : '#f4e9c8'; c.lineWidth = 3; c.globalAlpha = lit ? .6 + .4 * Math.sin(T * 8) : .75; U.rr(cx + 10, cy + dy + 10, 170, 130, 9); c.stroke(); c.globalAlpha = 1;
        c.fillStyle = 'rgba(255,255,255,.3)'; U.rr(cx + 14, cy + dy + 5, 162, 5, 2.5); c.fill();
        const sp = 1 + Math.sin(T * 3 + (side === 'left' ? 0 : 1.4)) * .05;
        c.save(); c.translate(cx + 95, cy + dy + 56); c.scale(sp, sp); c.rotate(Math.sin(T * 1.6) * .06);
        star(0, 0, 36, 18, 5, -Math.PI / 2, '#FFE14D', 3.5);
        c.save(); c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 18 : 36, a = -Math.PI / 2 + k * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.clip();
        c.fillStyle = '#e0a312'; c.beginPath(); c.arc(0, 0, 60, 0, 7); c.arc(-3, -4, 60, 0, 7, true); c.fill();
        c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(-9, -14, 8, 3.6, -.7, 0, 7); c.fill(); c.restore();
        c.restore();
        for (const [qx, qy] of [[24, 24], [166, 24], [24, 126], [166, 126]]) star(cx + qx, cy + dy + qy, 7, 3.2, 4, Math.PI / 4, '#f4e9c8', 1.5);
      }
    }
    if (lit) {   // my bet: the deck glows
      c.save(); U.rr(x - 7, y - 7, 204, 164, 21); c.lineWidth = 11; c.strokeStyle = INK; c.stroke(); c.globalAlpha = .8 + .2 * Math.sin(T * 7); c.lineWidth = 5; c.strokeStyle = '#FFE14D'; c.stroke(); c.restore();
    }
    const n = ids.length; if (n) {
      const per = 4, rows = Math.ceil(n / per);
      for (let row = rows - 1; row >= 0; row--) {
        const inRow = Math.min(per, n - row * per);
        for (let j = 0; j < inRow; j++) {
          const i = row * per + j, pl = pls.find(p => p.id === ids[i]); if (!pl) continue;
          const hop = Math.abs(Math.sin(T * 5 + i * 1.7)) * 9, air = hop > 3;
          U.avatar(x + 95 + (j - (inRow - 1) / 2) * 42 + row * 12, y - 14 - row * 24 - hop, 13, pl.color, { t: T, seed: i * 2.3, mood: air ? 'happy' : 'eager', k: 1, bob: false, look: [0, .3] });
        }
      }
    }
    c.restore();
  };
  g.sides = () => {
    const out = { left: [], right: [] };
    for (const p of R.players) { if (p.left) continue; const s = p.id === party.you.id ? g.mine : g.others[p.id]; if (s && out[s]) out[s].push(p.id); }
    return out;
  };
  return g;
}
