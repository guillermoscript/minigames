'use strict';
/* Shared sabotage + idle-trap kit for the party modes (loaded before party-modes.js).
   Four building blocks, each usable by any mode that opts in:
   1. SAB_KINDS      registry of screen sabotages (label, icon, colour, life, pre/draw) plus the sabBegin/sabEnd renderer
   2. createSabCharges(cfg)   charge economy: earn per time / trap / combo, spend with a cooldown
   3. createSabChannel(R, relay, o) + sabStrip/sabPicker/sabOrbs   target picker, relay send/receive, the buttons and the charge orbs
   4. createIdleTraps(o)      jam / bubble / dial / seq / fly mini-games for players who would otherwise just wait
   SAB_IDS, the `ghost` kinds, SAB_MODES, SAB_GHOST_MODES and SAB_RACE_MODES must match SAB_KINDS, GHOST_KINDS, SAB_MODES, GHOST_MODES and RACE_MODES in pocketbase/pb_hooks/party.js (the server validates the relay; test/party-sab.test.js checks both).
   Three ways to opt a mode in, all through createSabChannel: SAB_MODES (everybody sabotages everybody), SAB_GHOST_MODES (only the eliminated, js/party-ghost.js) and
   SAB_RACE_MODES (only a player who already finished, at the ones still playing, js/party-wait.js). The last two throw the `ghost` kinds, soft (SAB_SOFT). */
const SAB_MODES = ['balloon', 'cards'];     // co-op modes (team, lantern, duo, squad) never appear here: nobody sabotages a teammate
const SAB_RACE_MODES = ['versus'];                 // a finished player waits for the others: they may throw soft hits at the ones still playing (never in co-op: TEAM only cheers, see js/party-wait.js)
const SAB_GHOST_MODES = ['survival', 'knockout'];   // the living never sabotage each other there: only an ELIMINATED player (a ghost) haunts them, with the `ghost` kinds and softer hits (see SAB_SOFT)
const SAB_SOFT = { str: .6, life: .75 };            // a ghost's (or a finished racer's) hit is weaker (envelope x str) and shorter (life x life) than a balloon or cards sabotage
const sabTry = fn => { try { fn(); } catch (_) { /* sound or particles must never stop a round */ } };
let sabBufCv = null;
const sabBuf = () => sabBufCv || (sabBufCv = document.createElement('canvas'), sabBufCv.width = 280, sabBufCv.height = 210, sabBufCv);
const SAB_SPAM = ['#FF4D9E', '#4DB8FF', '#B49CFF', '#5CFF7A', '#F28CB1', '#FF9A3D'];
/* Every kind draws in the 800x600 space of whatever it covers (the actor's television or a helper's whole screen), 3 to 4 seconds, never touches input
   (flip mirrors the pointer and the arrow keys so the game stays playable).
     pre(ctx, t, a, s)   optional: transform the view before the game is drawn (shake, flip)
     draw(ctx, t, a, s)  optional: overlay after the game; t = seconds since it landed, a = fade envelope 0..1, s.seed = per-hit random
     full                a helper (who plays no microgame) gets it over the whole screen; otherwise only over the television
     tvOnly              it means nothing to a helper, so it is never thrown at one
     ghost               a ghost (or a finished VERSUS player) may throw it: it never blocks the input, it only makes the picture harder to read */
const SAB_KINDS = {
  ink: { id: 'ink', label: 'INK!', icon: '🖋', col: '#8E7CC3', life: 3.4, full: true, ghost: true, draw(ctx, t, a, s) {
    for (let i = 0; i < 6; i++) {
      const x = 110 + (s.seed * 37 + i * 173) % 580, y = 90 + (s.seed * 91 + i * 131) % 420, r = 38 + (i * 13) % 30, g = Math.min(1, t / .3);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r * g, 0, 7); for (let j = 0; j < 6; j++) { const an = j * 1.05 + i; ctx.moveTo(x + Math.cos(an) * r * 1.3 * g + 12, y + Math.sin(an) * r * 1.3 * g); ctx.arc(x + Math.cos(an) * r * 1.3 * g, y + Math.sin(an) * r * 1.3 * g, r * .28 * g, 0, 7); } ctx.fill();
      ctx.fillRect(x - 6, y, 12, 30 + Math.min(80, t * 40 + i * 6));
    }
  } },
  fog: { id: 'fog', label: 'FOG!', icon: '🌫', col: '#E8EEFF', life: 3.4, full: true, draw(ctx, t, a, s) {
    ctx.fillStyle = 'rgba(232,238,255,.8)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc((i * 120 + now * 40) % 900 - 50, 80 + (i * 67) % 460, 90, 0, 7); ctx.fill(); }
  } },
  dark: { id: 'dark', label: 'DARK!', icon: '🌑', col: '#6C6A99', life: 3.4, full: true, draw(ctx) { ctx.fillStyle = 'rgba(8,6,20,' + (.62 + Math.sin(now * 3) * .2).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); } },
  bugs: { id: 'bugs', label: 'BUGS!', icon: '🪰', col: '#9fe3ff', life: 3.4, full: true, ghost: true, draw(ctx, t, a, s) {
    for (let i = 0; i < 16; i++) {
      const x = (s.seed * 50 + i * 57 + Math.sin(now * (1.5 + i % 3) + i) * 90 + 800) % 800, y = (i * 83 + Math.cos(now * (1.2 + i % 4) + i) * 70 + 600) % 600;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y, 16, 11, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - 6, y - 12, 11, 6 + Math.sin(now * 50 + i) * 3, -.5, 0, 7); ctx.ellipse(x + 6, y - 12, 11, 6 - Math.sin(now * 50 + i) * 3, .5, 0, 7); ctx.fill();
    }
  } },
  /* the picture jitters and sways; for a helper the whole screen does (buttons move a few px, they stay hittable) */
  shake: { id: 'shake', label: 'SHAKE!', icon: '📳', col: '#FF9A3D', life: 3.6, full: true, ghost: true, pre(ctx, t, a) {
    const k = 3 + 7 * a;
    ctx.translate(W / 2, H / 2); ctx.rotate(Math.sin(t * 43) * .018 * a); ctx.translate(-W / 2 + Math.sin(t * 61) * k + Math.sin(t * 29) * k * .5, -H / 2 + Math.cos(t * 53) * k * .7);
  } },
  /* the television turns around like a card and everything is mirrored; the actor's pointer and arrow keys are mirrored too (sabMirrored) so it stays fair */
  flip: { id: 'flip', label: 'MIRROR!', icon: '🔄', col: '#B49CFF', life: 4, tvOnly: true, mirrored: a => a > .5, pre(ctx, t, a) {
    ctx.translate(W / 2, H / 2); ctx.scale(Math.cos(Math.PI * a), 1); ctx.translate(-W / 2, -H / 2);
  }, draw(ctx, t, a) {
    ctx.strokeStyle = 'rgba(180,156,255,' + (.35 + .25 * Math.sin(now * 8)).toFixed(2) + ')'; ctx.lineWidth = 14; ctx.strokeRect(7, 7, W - 14, H - 14);
  } },
  /* what is under it is re-drawn as big blocks: shapes stay guessable, details do not */
  pixel: { id: 'pixel', label: 'PIXELS!', icon: '👾', col: '#4DB8FF', life: 3.6, full: true, ghost: true, draw(ctx, t, a) {
    const b = 3 + Math.round(a * 3), m = ctx.getTransform(), tw = Math.ceil(W / b), th = Math.ceil(H / b), buf = sabBuf(), bx = buf.getContext('2d');
    bx.imageSmoothingEnabled = true; bx.clearRect(0, 0, buf.width, buf.height);
    bx.drawImage(cv, m.e, m.f, Math.round(W * m.a), Math.round(H * m.d), 0, 0, tw, th);
    ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, 0, tw, th, 0, 0, tw * b, th * b); ctx.imageSmoothingEnabled = true;
  } },
  /* a hail of fake rewards and pop-ups: harmless, only there to steal the eyes (nothing here is clickable and none of it is gold) */
  spam: { id: 'spam', label: 'SPAM!', icon: '🎉', col: '#FF4D9E', life: 3.8, full: true, ghost: true, draw(ctx, t, a, s) {
    for (let i = 0; i < 20; i++) {
      const x = (s.seed * 53 + i * 91 + Math.sin(t * (1.1 + i % 4 * .4) + i) * 60 + 1600) % 860 - 30, y = (s.seed * 29 + i * 67 + t * (70 + (i * 37) % 90)) % 680 - 40, c = SAB_SPAM[i % SAB_SPAM.length];
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + i) * .4); ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = c;
      if (i % 5 === 0) star(0, 0, 18, 8, 5, t + i, c, 3);
      else if (i % 5 === 1) { ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-20, -4, -10, -20, 0, -8); ctx.bezierCurveTo(10, -20, 20, -4, 0, 9); ctx.closePath(); ctx.stroke(); ctx.fill(); }
      else if (i % 5 === 2) { ctx.fillRect(-9, -6, 18, 12); }
      else if (i % 5 === 3) { box(-20, -15, 40, 30, '#fff', 3); ctx.fillStyle = c; ctx.fillRect(-20, -15, 40, 9); txt('!', 0, 6, 18, INK, 'center', 30); }
      else { circ(0, 0, 14, c, 3); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-5, -3, 2.4, 0, 7); ctx.arc(5, -3, 2.4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(0, 2, 6, .2, Math.PI - .2); ctx.stroke(); }
      ctx.restore();
    }
  } },
};
const SAB_IDS = Object.keys(SAB_KINDS);
/* one hit: when it landed, who threw it and a random seed so every ink splat or bug swarm differs */
const sabMake = (k, name, soft) => ({ k, at: now, name: name || '', seed: Math.random() * 100, life: SAB_KINDS[k].life * (soft ? SAB_SOFT.life : 1), str: soft ? SAB_SOFT.str : 1 });
const sabLive = s => !!s && SAB_KINDS[s.k] !== undefined && now - s.at <= s.life;
const sabEnvelope = s => Math.max(0, Math.min(1, (now - s.at) / .25, (s.life - (now - s.at)) / .6)) * (s.str || 1);
const sabMirrored = s => !!s && sabLive(s) && !!SAB_KINDS[s.k].mirrored && SAB_KINDS[s.k].mirrored(sabEnvelope(s));
const SAB_SWAP = { ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft', KeyA: 'KeyD', KeyD: 'KeyA', a: 'd', d: 'a', A: 'D', D: 'A' };
const sabMirrorKey = d => Object.assign({}, d, { code: SAB_SWAP[d.code] || d.code, key: SAB_SWAP[d.key] || d.key });
/* Render protocol. `where`: 'view' = the actor's television (every kind), 'tv' = a helper's television (kinds without `full`),
   'full' = a helper's whole screen, called first thing in the frame (kinds with `full`). Always pair sabBegin with sabEnd; both accept null. */
function sabBegin(s, c, where) {
  if (!sabLive(s)) return null;
  const kind = SAB_KINDS[s.k];
  if (where !== 'view' && (where === 'full') !== !!kind.full) return null;
  const fx = { s, kind, c, age: now - s.at, a: sabEnvelope(s) };
  c.save();
  if (kind.pre) sabTry(() => kind.pre(c, fx.age, fx.a, s));
  return fx;
}
function sabEnd(fx) {
  if (!fx) return;
  if (fx.kind.draw) { fx.c.save(); fx.c.globalAlpha = fx.a; sabTry(() => fx.kind.draw(fx.c, fx.age, fx.a, fx.s)); fx.c.restore(); }
  fx.c.restore();
}

/* ───────────── charge economy ───────────── */
/* One factory, every mode picks its numbers: { max: 3, every: 6 (s per free charge), trap: 1 (per trap success), comboEvery: 10, combo: 1, cooldown: 3 (s between sends) } */
function createSabCharges(cfg = {}) {
  const k = Object.assign({ max: 3, every: 6, trap: 1, comboEvery: 10, combo: 1, cooldown: 3 }, cfg);
  const c = { n: 0, max: k.max, clock: 0, cd: 0, cfg: k };
  const add = v => { c.n = Math.min(k.max, c.n + v); };
  c.tick = dt => { c.cd = Math.max(0, c.cd - dt); c.clock += dt; if (c.clock > k.every) { c.clock = 0; add(1); } };
  /* 'trap': a trap minigame was won; 'combo': pass the running streak, a charge drops every `comboEvery`th tap. Returns true when the reward fired (even if already full) so the caller can celebrate. */
  c.earn = (src, streak) => {
    if (src === 'trap') { add(k.trap); return true; }
    if (src === 'combo' && streak > 0 && streak % k.comboEvery === 0) { add(k.combo); return true; }
    return false;
  };
  c.ready = () => c.n > 0 && c.cd <= 0;
  c.spend = () => { if (!c.ready()) return false; c.n--; c.cd = k.cooldown; return true; };
  return c;
}

/* ───────────── send / receive + UI ───────────── */
/* o: { charges, actorId (so nothing is thrown at a helper that would not notice it), ghost (I am an eliminated player haunting the living: only `ghost` kinds, only at living
   players who are still playing), wait (I finished my VERSUS microgame and wait: the same soft kinds, only at players who have not finished), onSend(kind, targetId)
   (replaces the default toast), onHit(state, fromId) }.
   ch.state is the sabotage currently on me; read it through ch.active() so expired hits clear themselves. */
function createSabChannel(R, relay, o = {}) {
  const ch = { charges: o.charges, idx: 0, state: null, last: '' };
  const room = () => party.room && party.room.id === R.id ? party.room : R, haunts = () => SAB_GHOST_MODES.includes(R.mode), races = () => SAB_RACE_MODES.includes(R.mode), soft = !!(o.ghost || o.wait);
  ch.targets = () => room().players.filter(p => !p.left && p.id !== party.you.id && (!o.ghost || p.lives > 0) && (!soft || !(room().cur && room().cur[p.id])));
  ch.target = () => { const l = ch.targets(); return l.length ? l[ch.idx % l.length] : null; };
  ch.next = () => { ch.idx++; };
  ch.pick = to => {
    const ids = SAB_IDS.filter(k => k !== ch.last && !(SAB_KINDS[k].tvOnly && o.actorId && to !== o.actorId) && (!soft || SAB_KINDS[k].ghost));
    return ids[Math.floor(Math.random() * ids.length)];
  };
  ch.send = id => {
    if (!(SAB_MODES.includes(R.mode) || o.ghost && haunts() || o.wait && races()) || !ch.charges.ready()) return false;
    const list = ch.targets(), to = typeof id === 'string' ? id : list.length ? list[ch.idx % list.length].id : '';
    if (!to || !list.some(p => p.id === to)) return false;
    ch.charges.spend(); ch.idx++; const k = ch.last = ch.pick(to);
    relay.send('sab', { k, to });
    if (o.onSend) sabTry(() => o.onSend(k, to)); else sabTry(() => { sfx.whoosh(true); floatText('SABOTAGE SENT!', 300, 300, '#FF9A3D', 30); });
    return true;
  };
  ch.receive = (type, data, from) => {
    if (type !== 'sab' || !data || !SAB_IDS.includes(data.k) || typeof data.to !== 'string') return false;
    const cur = room(), pl = cur.players.find(p => p.id === from), tg = cur.players.find(p => p.id === data.to), mine = cur.players.find(p => p.id === party.you.id);
    if (haunts()) { if (!pl || !(pl.lives <= 0) || !SAB_KINDS[data.k].ghost || data.to === party.you.id && mine && !(mine.lives > 0)) return false; }   // only a ghost throws here, and only at the living
    else if (races()) { if (!pl || !SAB_KINDS[data.k].ghost) return false; }   // the server already checked that the thrower has finished and I have not; the room copy here may lag behind
    else if (!SAB_MODES.includes(cur.mode)) return false;
    if (data.to === party.you.id && from !== party.you.id) {
      if (!soft && sabLive(ch.state)) return true;   // never restart a hit that is still on me: the server spaces them out, this keeps a late or duplicated one from chaining overlays
      ch.state = sabMake(data.k, pl ? pl.name : '', haunts() || races());
      sabTry(() => { sfx.whoosh(false); shake(5, .3); floatText(SAB_KINDS[data.k].label, 400, 250, SAB_KINDS[data.k].col, 40); });
      if (o.onHit) o.onHit(ch.state, from);
    } else if (from !== party.you.id) sabTry(() => floatText(t('{a} SABOTAGES {b}!', { a: pl ? pl.name : '', b: tg ? tg.name : '' }), 300, 340, '#FF9A3D', 22));
    return true;
  };
  ch.active = () => { if (ch.state && !sabLive(ch.state)) ch.state = null; return ch.state; };
  return ch;
}
/* Direct to the server, not through the DUO input queue: a late sabotage is worse than a lost one (the players of VERSUS / TEAM / SURVIVAL are not in a DUO round, so there is
   no queue to wait for). A refused throw (the target just finished, a rate limit) gives the charge back: mine(R) returns the kit's charges if its room and round are still this
   one. 403 (not in the round) and 0 (offline) do not refund. */
function sabSendDirect(type, data, mine) {
  const R = party.room; if (!R) return;
  pcall('sig', Object.assign(auth(), { round: R.round, m: [sigStamp({ t: type, d: data })] })).then(r => {
    const c = mine(R);
    if (r.status === 404) roomGone();
    else if (!r.ok && c && r.status !== 0 && r.status !== 403) c.n = Math.min(c.max, c.n + 1);
  });
}
/* A relay-shaped sender for createSabChannel that goes straight to the server (sabSendDirect) instead of the DUO input queue, so a refused throw (rate limit, the round just
   ended) hands the charge back instead of retrying the whole batch. mine(R) returns the charges to refund while R is still the kit's room and round, else null. */
const sabDirectRelay = mine => ({ send: (type, data) => sabSendDirect(type, data, mine) });
/* The kit of a thrower who watches somebody else's game on a viewer whose middle is (250, 280) (ghosts and finished VERSUS players): the viewer flashes in the
   sabotage's colour, the thrower lunges and a toast says who hit whom. k = the thrower's kit { flash, lunge, hits }. */
function sabThrownFx(k, kind, to) {
  const R = party.room, kd = SAB_KINDS[kind], tg = R && R.players.find(p => p.id === to);
  k.flash = { k: kind, at: now, to }; k.lunge = 1; if (tg) k.hits[to] = now;
  sfx.whoosh(true); shake(4, .22); ring(250, 280, kd.col, 160, .5); burst(250, 280, kd.col, 22, 420);
  floatText(kd.label, 250, 236, kd.col, 48);
  if (tg) floatText(t('{a} SABOTAGES {b}!', { a: me().name, b: tg.name }), 250, 300, '#FF9A3D', 17);
}
/* one button per rival along the bottom (cards table, the actor's screen) */
function sabStrip(ch, y = 567) {
  const list = ch.targets(), ready = ch.charges.ready(), w = Math.min(190, 570 / Math.max(1, list.length));
  list.forEach((p, i) => button(16 + i * w, y, w - 6, 26, t('SABOTAGE {name}', { name: p.name }), () => ch.send(p.id), { size: 13, fill: ready ? p.color : '#d3cfe0' }));
  sabOrbs(ch.charges, 692, y + 13, { r: 8, gap: 22 });
}
/* compact picker for a side panel: tap the name to change target, tap the big button to throw */
function sabPicker(ch, x = 492, y = 414, w = 96) {
  const ready = ch.charges.ready(), tg = ch.target();
  if (tg) button(x, y, w, 20, tg.name, () => ch.next(), { size: 11, fill: tg.color });
  button(x, y + 22, w, 28, ready ? 'SABOTAGE!' : '', () => ch.send(), { size: 12, fill: ready ? '#FF9A3D' : '#d3cfe0' });
  if (!ready) sabOrbs(ch.charges, x + w / 2, y + 36, { r: 7, gap: 22 });   // charging: the orbs fill up instead of a number
}
/* the charges as orbs, no numbers: full ones glow, the next one shows its recharge ring. Centred on (cx, cy). o: { r: 13, gap, col, pulse (time of the last gain: the full orbs pop) } */
function sabOrbs(c, cx, cy, o = {}) {
  const r = o.r || 13, gap = o.gap || r * 2.5, col = o.col || '#FF9A3D', pop = o.pulse !== undefined && now - o.pulse < .5 ? 1 + (1 - (now - o.pulse) / .5) * .4 : 1;
  for (let i = 0; i < c.max; i++) {
    const x = cx + (i - (c.max - 1) / 2) * gap, full = i < c.n, next = i === c.n;
    circ(x, cy, r * (full ? pop : 1), full ? col : '#14101c', 3);
    if (full) { ctx.fillStyle = 'rgba(255,255,255,' + (.35 + .3 * Math.sin(now * 6 + i)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x - r * .3, cy - r * .3, r * .3, 0, 7); ctx.fill(); }
    else if (next) { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, cy, r * .66, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, c.clock / c.cfg.every)); ctx.stroke(); }
  }
}

/* ───────────── idle traps ───────────── */
/* Mini-games thrown at a player who is just waiting (a pumper): a stuck valve (wiggle), gold bubbles (some fake), a stop-in-the-green dial, an arrow
   sequence and a fly that swallows half the taps. Winning the bubble, dial or sequence gives TURBO (x2 for a few seconds) and calls o.onReward(type).
   Layout is a 362x88 panel; coordinates below are written for the panel at y = 492 and moved with Y().
   o: { at: {x, y} (where the sparks go), first: [min, span] s before the first trap, gap: [min, span] between traps, weights: {fly, jam, bubble, dial, seq} (0 = off), onReward(type),
        words: {bubble, dial, seq, over} the pop-up shouted on a win / a missed dial (a ghost has no pump, so no TURBO) }
   The host keeps its own pump button: ask gate() before counting a tap (0 = swallowed, 1 or 2 = air) and read stuck() / shaking() / turboOn() / soon() to dress it. */
function createIdleTraps(o = {}) {
  const at = o.at || { x: 400, y: 534 }, first = o.first || [1.2, 1.3], gap = o.gap || [2.2, 2.2];
  const wt = Object.assign({ fly: .18, jam: .2, bubble: .2, dial: .22, seq: .2 }, o.weights), words = Object.assign({ bubble: 'TURBO!', dial: 'PERFECT! TURBO', seq: 'COMBO! TURBO', over: 'OVERPRESSURE!' }, o.words);
  let el = 0, nextTrap = first[0] + Math.random() * first[1], turbo = 0, stall = 0, shakeT = 0, flash = 0;
  const T = { jam: null, bubble: null, dial: null, seq: null, fly: null }, busy = () => !!(T.jam || T.bubble || T.dial || T.seq || T.fly);
  const nextIn = () => { nextTrap = el + gap[0] + Math.random() * gap[1]; };
  const reward = (type, sec, word, col) => {
    turbo = el + sec; nextIn(); flash = 1;
    sabTry(() => { sfx.hit(); burst(at.x, at.y, col, 24, 400); ring(at.x, at.y, col, 100, .4); floatText(word, at.x, at.y - 34, col, 34); });
    if (o.onReward) o.onReward(type);
  };
  const fail = word => { stall = el + .9; nextIn(); shakeT = .4; sabTry(() => { sfx.miss(); shake(6, .25); floatText(word, at.x, at.y - 34, '#FF4D5E', 30); }); };
  const dialPos = () => .5 + .5 * Math.sin(T.dial.seed + (el - T.dial.at) * 4.6);
  const api = {
    get jam() { return T.jam; }, get bubble() { return T.bubble; }, get dial() { return T.dial; }, get seq() { return T.seq; }, get fly() { return T.fly; },
    active: () => Object.keys(T).find(k => T[k]) || '',
    stuck: () => !!T.jam || stall > el, shaking: () => shakeT > 0, turboOn: () => turbo > el, turboLeft: () => Math.max(0, turbo - el), soon: () => !busy() && nextTrap - el < 1.2, flash: () => flash,
    spawn(type) {
      if (type === 'fly') { T.fly = { at: el, life: 4.5, seed: Math.random() * 6 }; sabTry(() => noise(.3, .04, 1500, 2500, 'bandpass')); }
      else if (type === 'jam') { T.jam = { have: 0, need: 8, side: 0 }; sabTry(() => { sfx.miss(); shake(7, .3); }); }
      else if (type === 'bubble') { T.bubble = { at: el, life: 2.8, seed: Math.random() * 6, fakes: Math.random() < .5 ? [Math.random() * 6, Math.random() * 6] : [] }; sabTry(() => sfx.blip(14)); }
      else if (type === 'dial') { T.dial = { at: el, life: 3.2, seed: Math.random() * 6, zone: .3 + Math.random() * .4, w: .2 }; sabTry(() => sfx.blip(10)); }
      else if (type === 'seq') { T.seq = { at: el, life: 4, i: 0, keys: [0, 1, 2].map(() => Math.floor(Math.random() * 3)) }; sabTry(() => sfx.blip(12)); }
    },
    update(dt) {
      el += dt; shakeT = Math.max(0, shakeT - dt); flash = Math.max(0, flash - dt * 2);
      if (!busy() && el >= nextTrap) {
        const order = ['fly', 'jam', 'bubble', 'dial', 'seq'], total = order.reduce((n, k) => n + wt[k], 0);
        let r = Math.random() * total, pick = order[order.length - 1];
        for (const k of order) { if (r < wt[k]) { pick = k; break; } r -= wt[k]; }
        api.spawn(pick);
      }
      for (const k of ['bubble', 'dial', 'seq', 'fly']) if (T[k] && el - T[k].at > T[k].life) { T[k] = null; nextIn(); }
    },
    /* a pump tap arrives: 0 = swallowed (jam, stall, or the fly ate it), otherwise how much air it is worth */
    gate() {
      if (T.jam || stall > el) { shakeT = .3; sabTry(() => sfx.miss()); return 0; }
      const v = turbo > el ? 2 : 1;
      if (T.fly && Math.random() < .55) { sabTry(() => noise(.06, .03, 1800, 2600, 'bandpass')); shakeT = .15; return 0; }
      return v;
    },
    swat() { if (!T.fly) return; T.fly = null; nextIn(); flash = 1; sabTry(() => { sfx.hit(); burst(at.x, at.y + 2, '#9fe3ff', 14, 300); floatText('SPLAT!', at.x, at.y - 34, '#9fe3ff', 30); }); },
    wiggle(side) {
      const j = T.jam; if (!j) return;
      if (side === j.side) { shakeT = .25; return; }
      j.side = side; j.have++; sabTry(() => sfx.blip(j.have * 2));
      if (j.have >= j.need) { T.jam = null; turbo = el + 1.6; nextIn(); flash = 1; sabTry(() => { sfx.whoosh(true); burst(at.x, at.y, '#5CFF7A', 22, 380); floatText('UNJAMMED!', at.x, at.y - 34, '#5CFF7A', 34); }); }
    },
    hitBubble() { if (T.bubble) { T.bubble = null; reward('bubble', 4, words.bubble, '#FFE14D'); } },
    dialStop() { if (!T.dial) return; const hit = Math.abs(dialPos() - T.dial.zone) < T.dial.w / 2; T.dial = null; if (hit) reward('dial', 3.5, words.dial, '#5CFF7A'); else fail(words.over); },
    seqPress(d) {
      const s = T.seq; if (!s) return;
      if (d === s.keys[s.i]) { s.i++; sabTry(() => sfx.blip(s.i * 3)); if (s.i >= s.keys.length) { T.seq = null; reward('seq', 3.5, words.seq, '#4DB8FF'); } }
      else { s.i = 0; shakeT = .3; sabTry(() => sfx.miss()); }
    },
    /* keyboard: A/D or arrows (left 0, up 1, right 2), Enter, F. Returns true when a trap used the key. */
    key(c) {
      const d = c === 'ArrowLeft' || c === 'KeyA' ? 0 : c === 'ArrowUp' || c === 'KeyW' ? 1 : c === 'ArrowRight' || c === 'KeyD' ? 2 : -1;
      if (T.jam && d !== 1 && d >= 0) api.wiggle(d - 1);
      else if (T.seq && d >= 0) api.seqPress(d);
      else if (T.dial && (c === 'Enter' || d === 1)) api.dialStop();
      else if (T.fly && (c === 'Enter' || c === 'KeyF')) api.swat();
      else if (c === 'Enter') api.hitBubble();
      else return false;
      return true;
    },
    /* draws the active trap into the panel (and its tap targets into btns); with no trap it calls idle(mx, y, mw) so the host can draw its own status */
    draw(mx, y, mw, idle) {
      const Y = n => y + n - 492, cxm = mx + mw / 2, c = ctx;
      if (T.jam) {
        const j = T.jam;
        box(mx, Y(492), mw, 88, Math.sin(now * 12) > 0 ? '#7a1f2e' : '#5a1626', 3);
        txt('VALVE JAMMED!', cxm, Y(510), 21, '#FFE14D', 'center', 340);
        c.fillStyle = '#14101c'; c.fillRect(mx + 14, Y(522), mw - 28, 12); c.fillStyle = '#5CFF7A'; c.fillRect(mx + 14, Y(522), (mw - 28) * j.have / j.need, 12);
        button(mx + 14, Y(542), mw / 2 - 18, 36, '< A / LEFT', () => api.wiggle(-1), { size: 18, fill: j.side !== -1 ? '#FFE14D' : '#d3cfe0' });
        button(mx + mw / 2 + 4, Y(542), mw / 2 - 18, 36, 'D / RIGHT >', () => api.wiggle(1), { size: 18, fill: j.side !== 1 ? '#FFE14D' : '#d3cfe0' });
      } else if (T.fly) {
        const f = T.fly, age = el - f.at, fx = cxm + Math.sin(age * 3.1 + f.seed) * 140 + Math.sin(age * 9) * 12, fy = Y(536) + Math.sin(age * 4.7 + f.seed) * 24;
        box(mx, Y(492), mw, 88, '#322d52', 3); txt('A FLY! HALF YOUR PUMPS FAIL · SWAT IT! TAP / ENTER', cxm, Y(508), 13, '#FF9A3D', 'center', 345);
        c.lineCap = 'round'; c.beginPath(); c.moveTo(mx + 14, Y(548)); c.lineTo(mx + mw - 26, Y(548)); c.strokeStyle = INK; c.lineWidth = 14; c.stroke(); c.strokeStyle = '#c9ced6'; c.lineWidth = 7; c.stroke();
        c.fillStyle = INK; c.beginPath(); c.ellipse(fx, fy, 11, 7, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; const fl = Math.sin(now * 60) * 5; c.beginPath(); c.ellipse(fx - 5, fy - 8, 7, 4 + fl * .4, -.5, 0, 7); c.ellipse(fx + 5, fy - 8, 7, 4 - fl * .4, .5, 0, 7); c.fill();
        btns.unshift({ x: fx - 34, y: fy - 34, w: 68, h: 68, fn: api.swat });
      } else if (T.dial) {
        const d = T.dial, age = el - d.at, tx = mx + 30, tw = mw - 60, pos = dialPos();
        box(mx, Y(492), mw, 88, '#3b3550', 3); txt('STOP IN THE GREEN! TAP / ENTER / W', cxm, Y(508), 14, '#FFE14D', 'center', 340);
        box(tx, Y(522), tw, 22, '#14101c', 3); c.fillStyle = '#5CFF7A'; c.fillRect(tx + tw * (d.zone - d.w / 2), Y(524), tw * d.w, 18);
        c.fillStyle = age > d.life * .75 ? '#FF4D5E' : '#fff'; c.beginPath(); c.moveTo(tx + tw * pos, Y(548)); c.lineTo(tx + tw * pos - 9, Y(562)); c.lineTo(tx + tw * pos + 9, Y(562)); c.closePath(); c.fill(); c.fillRect(tx + tw * pos - 2, Y(520), 4, 26);
        button(cxm - 70, Y(548), 140, 32, 'STOP!', api.dialStop, { size: 20, fill: '#5CFF7A' });
      } else if (T.seq) {
        const s = T.seq;
        box(mx, Y(492), mw, 88, '#3b3550', 3); txt('COPY THE ARROWS!', cxm, Y(508), 15, '#FFE14D', 'center', 340);
        const tri = (x, yy, d, col) => { c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); if (d === 0) { c.moveTo(x + 11, yy - 11); c.lineTo(x - 11, yy); c.lineTo(x + 11, yy + 11); } else if (d === 1) { c.moveTo(x - 11, yy + 10); c.lineTo(x, yy - 12); c.lineTo(x + 11, yy + 10); } else { c.moveTo(x - 11, yy - 11); c.lineTo(x + 11, yy); c.lineTo(x - 11, yy + 11); } c.closePath(); c.stroke(); c.fill(); };
        s.keys.forEach((d, i) => { const x = cxm + (i - 1) * 56; box(x - 22, Y(518), 44, 34, i < s.i ? '#5CFF7A' : i === s.i ? '#FFE14D' : '#d3cfe0', 3); tri(x, Y(535), d, INK); });
        [0, 1, 2].forEach(d => { const x = mx + 14 + d * ((mw - 28) / 3); button(x, Y(558), (mw - 28) / 3 - 8, 22, '', () => api.seqPress(d), { fill: '#fff' }); tri(x + ((mw - 28) / 3 - 8) / 2, Y(569), d, '#4fd06a'); });
      } else if (T.bubble) {
        const b = T.bubble, age = el - b.at, u = Math.min(1, age / b.life), bx = mx + 60 + (mw - 120) * (.5 + .5 * Math.sin(b.seed + age * 2.2)), by = Y(548) + Math.sin(age * 5 + b.seed) * 8;
        box(mx, Y(492), mw, 88, '#3b3550', 3); txt('GOLD BUBBLE! TAP IT / ENTER', cxm, Y(506), 14, '#FFE14D', 'center', 340);
        c.strokeStyle = u > .7 ? '#FF4D5E' : '#FFE14D'; c.lineWidth = 5; c.beginPath(); c.arc(bx, by, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - u)); c.stroke();
        (b.fakes || []).forEach((sd, i) => { const fx = mx + 60 + (mw - 120) * (.5 + .5 * Math.sin(sd + age * (1.6 + i * .7))), fy = Y(548) + Math.sin(age * 4 + sd) * 8; circ(fx, fy, 20, '#9a98ad', 3); c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(fx - 7, fy - 7); c.lineTo(fx + 7, fy + 7); c.moveTo(fx + 7, fy - 7); c.lineTo(fx - 7, fy + 7); c.stroke(); btns.push({ x: fx - 30, y: fy - 30, w: 60, h: 60, fn: () => { T.bubble = null; fail('FAKE!'); } }); });
        circ(bx, by, 22, '#FFD23F', 4); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(bx - 8, by - 9, 5, 8, -.5, 0, 7); c.fill(); c.fillStyle = INK; c.beginPath(); c.moveTo(bx + 3, by - 12); c.lineTo(bx - 8, by + 2); c.lineTo(bx - 1, by + 2); c.lineTo(bx - 4, by + 12); c.lineTo(bx + 8, by - 3); c.lineTo(bx + 1, by - 3); c.closePath(); c.fill();   // a bolt: TURBO
        btns.unshift({ x: bx - 36, y: by - 36, w: 72, h: 72, fn: api.hitBubble });
      } else if (idle) idle(mx, y, mw);
      if (flash > 0) { c.fillStyle = 'rgba(255,255,255,' + (flash * .5).toFixed(2) + ')'; c.fillRect(mx, y, mw, 88); }
    },
  };
  return api;
}
