/* Claude Ware PARTY mode (play with friends in a room): pure room logic + a thin PocketBase layer.
   A room is ONE record in the `rooms` collection. Clients never write it: every action goes through /api/party/* routes (see
   claudeware.pb.js) which run the pure functions below inside a DB transaction and save the record; PocketBase realtime then
   pushes the new record to everyone subscribed to it. Pure functions take `now` (ms) and `rand` so party.test.js can drive them. */

const MAX_PLAYERS = 4;
const ROUNDS = { versus: 6, team: 8, duo: 8, survival: 30, knockout: 30, lantern: 12, cards: 80, balloon: 60 };
const MODES = ["versus", "team", "duo", "survival", "knockout", "lantern", "cards", "balloon"];
const LIVES = 4;
const PRE_MS = 1400, PRE_MS_DUO = 4500;            // instruction card shown before each microgame (keep in sync with PRE in js/main.js)
const GRACE_MS = 8000;          // a silent player is counted as a loss this long after the round should have ended
const BETWEEN_MS = 4000;        // results screen minimum time before the next round may start
const AWARD = [100, 70, 50, 30];
const COLORS = ["#D97757", "#6EA8FE", "#7BD88F", "#F28CB1", "#B49CFF", "#FFD23F", "#FF6B4D", "#4DD0E1"];
/* party microgames: id -> { dur (s, at speed 1), pts (ranked by `pts` instead of finish time) } - keep in sync with js/games/pt1.js */
const GAMES = {
  pt_mash: { dur: 5, pts: true },
  pt_sync: { dur: 5, pts: true },
  pt_memo: { dur: 8, pts: false },
  pt_grab: { dur: 7, pts: true },
  /* DUO games: two players, two roles, ONE shared verdict - keep in sync with js/games/du1.js */
  du_catch: { dur: 14, pts: false, duo: true },
  du_decode: { dur: 15, pts: false, duo: true },
  du_crank: { dur: 14, pts: false, duo: true },
  du_steer: { dur: 15, pts: false, duo: true },
  du_seesaw: { dur: 14, pts: false, duo: true },
  du_beat: { dur: 14, pts: false, duo: true },
  du_guide: { dur: 16, pts: false, duo: true },
  du_gun: { dur: 15, pts: false, duo: true },
};
GAMES.pc_draw = { dur: 30, pts: false, menu: true };
const GAME_IDS = Object.keys(GAMES).filter((g) => !GAMES[g].duo && !GAMES[g].menu);
const DUO_IDS = Object.keys(GAMES).filter((g) => GAMES[g].duo);
const SLOTS = ["a", "b", "c", "d"];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O/1/I

class PartyError extends Error { constructor(msg, status) { super(msg); this.status = status || 400; } }
const fail = (msg, status) => { throw new PartyError(msg, status); };

const cleanName = (s) => String(s == null ? "" : s).replace(/[^\w -]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
const cleanCode = (s) => String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
const makeCode = (rand) => { let s = ""; for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]; return s; };
const makeKey = (rand) => { let s = ""; for (let i = 0; i < 16; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]; return s; };
const active = (room) => room.players.filter((p) => !p.left);
const elimination = (room) => room.mode === "survival" || room.mode === "knockout";
const turnMode = (room) => ["lantern", "cards", "balloon"].includes(room.mode);
const contenders = (room) => active(room).filter((p) => (!elimination(room) || p.lives > 0) && (!turnMode(room) || p.id === room.extra.actor));
const nextActor = (room, id) => { const all = active(room), i = all.findIndex((p) => p.id === id); return all[(i + 1) % all.length].id; };
const player = (room, id) => room.players.find((p) => p.id === id);
const cleanMode = (m) => (MODES.includes(m) ? m : "versus");
/* DUO roles (0 or 1) rotate every round so both players get to play each one; js/party.js derives them with the same formula */
const roleOf = (room, id) => { const i = room.players.filter((p) => !p.left).findIndex((p) => p.id === id); return i < 0 ? -1 : (i + room.round) % 2; };

function newRoom(code, mode, now) {
  return { code, mode: cleanMode(mode), state: "lobby", round: 0, total: 0, players: [], keys: {}, host: "", game: "", seed: 0, sp: 1,
    roundAt: 0, betweenAt: 0, cur: {}, last: null, lives: LIVES, teamScore: 0, created: now, extra: {} };
}

/* add a player; returns { id, key }. `info` = { name, color, uid } */
function addPlayer(room, info, rand) {
  if (room.state !== "lobby") fail("Game already started", 409);
  if (room.players.length >= MAX_PLAYERS) fail("Room is full", 409);
  const id = SLOTS.find((s) => !player(room, s));
  let name = cleanName(info.name) || "PLAYER", base = name, n = 2;
  while (room.players.some((p) => p.name === name)) name = base.slice(0, 13) + n++;
  const used = new Set(room.players.map((p) => p.color));
  let color = COLORS.includes(info.color) && !used.has(info.color) ? info.color : COLORS.find((c) => !used.has(c)) || COLORS[0];
  room.players.push({ id, name, color, score: 0, left: false });
  room.players.sort((a, b) => SLOTS.indexOf(a.id) - SLOTS.indexOf(b.id));
  const key = makeKey(rand);
  room.keys[id] = key;
  if (!room.host) room.host = id;
  return { id, key };
}

function auth(room, id, key) {
  const p = player(room, id);
  if (!p || !key || room.keys[id] !== key) fail("Not in this room", 403);
  return p;
}

/* returns true when the room is now empty and should be deleted */
function leave(room, id, now = 0) {
  const p = player(room, id);
  if (!p) return false;
  if (room.state === "lobby") {
    room.players = room.players.filter((q) => q.id !== id);
    delete room.keys[id];
  } else p.left = true;
  const alive = active(room);
  if (!alive.length) return true;
  if (room.host === id || !player(room, room.host) || player(room, room.host).left) room.host = alive[0].id;
  if (turnMode(room) && room.state !== "lobby" && room.state !== "done") {
    if (room.state === "round" && room.extra.actor === id) {
      room.cur[id] = { r: "lose", t: 0, pts: 0 }; finishTurn(room, now);
      room.extra.actor = alive[0].id;
    }
    if (alive.length < 2) { if (room.last) room.last.final = true; endGame(room); }
    return false;
  }
  if (room.mode === "duo" && alive.length < 2 && (room.state === "round" || room.state === "between")) {   // the partner is gone: the team loses this round and the run ends
    if (room.state === "round") { alive.forEach((p) => { if (!room.cur[p.id]) room.cur[p.id] = { r: "lose", t: 0, pts: 0 }; }); finishRound(room, 0); }
    room.last.final = true;
  } else if (room.state === "round") maybeFinishRound(room, 0);
  else if (room.state !== "done" && alive.length < 2 && room.state !== "lobby") endGame(room);
  return false;
}

function setMode(room, id, mode) {
  if (room.host !== id) fail("Only the host can do that", 403);
  if (room.state !== "lobby") fail("Game already started", 409);
  room.mode = cleanMode(mode);
}

function start(room, id, now, rand) {
  if (room.host !== id) fail("Only the host can start", 403);
  if (room.state !== "lobby") fail("Game already started", 409);
  if (active(room).length < 2) fail("Need at least 2 players", 409);
  if (room.mode === "duo" && active(room).length !== 2) fail("DUO needs exactly 2 players", 409);
  room.total = ROUNDS[room.mode];
  room.lives = LIVES; room.teamScore = 0; room.round = 0; room.last = null;
  room.players.forEach((p) => { p.score = 0; p.lives = room.mode === "knockout" ? 1 : 3; });
  room.extra = {};
  if (turnMode(room)) {
    room.extra.actor = active(room)[0].id;
    if (room.mode === "lantern") room.lives = 3;
    if (room.mode === "balloon") { room.extra.balloon = 0; room.extra.pumps = {}; room.keys._balloonLimit = 100 + Math.floor(rand() * 81); }
    if (room.mode === "cards") {
      // Four packs, each with four challenges and two PLAY cards; shuffle all but the last PLAY.
      const deck = [];
      for (let i = 0; i < 16; i++) deck.push(GAME_IDS[Math.floor(rand() * GAME_IDS.length)]);
      for (let i = 0; i < 7; i++) deck.push("play");
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      deck.push("play"); room.keys._deck = deck;
      Object.assign(room.extra, { phase: "draw", pile: [], remaining: [], pot: 0, deck: deck.length, stolen: {} });
    }
  }
  beginRound(room, now, rand);
}

function beginRound(room, now, rand) {
  const prev = room.game, ids = room.mode === "duo" ? DUO_IDS : GAME_IDS, pool = ids.filter((g) => g !== prev);
  room.game = pool[Math.floor(rand() * pool.length)];
  if (room.mode === "cards") room.game = room.extra.phase === "draw" ? "pc_draw" : room.extra.remaining[0];
  room.seed = 1 + Math.floor(rand() * 2147483646);
  room.sp = +(1 + Math.min(room.round, 12) * 0.07).toFixed(2);
  room.state = "round"; room.roundAt = now; room.cur = {};
}

const roundMs = (room) => Math.round(GAMES[room.game].dur / Math.sqrt(room.sp) * 1000) + (room.mode === "duo" ? PRE_MS_DUO : PRE_MS);

function report(room, id, round, r, t, pts, now) {
  if (room.state !== "round" || round !== room.round) fail("Round is over", 409);
  const p = player(room, id);
  if (!p || p.left || (elimination(room) && p.lives <= 0)) fail("Not in this round", 403);
  if (turnMode(room) && (id !== room.extra.actor || room.game === "pc_draw")) fail("Not your turn", 403);
  if (room.cur[id]) return;                                  // first report wins
  const dur = GAMES[room.game].dur / Math.sqrt(room.sp);
  room.cur[id] = { r: r === "win" ? "win" : "lose", t: +Math.max(0.05, Math.min(dur, Number(t) || dur)).toFixed(2), pts: Math.max(0, Math.min(999, Math.floor(Number(pts) || 0))) };
  maybeFinishRound(room, now);
}

function maybeFinishRound(room, now) {
  if (room.state === "round" && contenders(room).every((p) => room.cur[p.id])) finishRound(room, now);
}

function tick(room, now) {
  if (room.state === "round" && now > room.roundAt + roundMs(room) + GRACE_MS) {
    if (room.mode === "cards" && room.extra.phase === "draw") { drawCard(room, room.extra.actor, room.round, "left", now, () => .5); return; }
    contenders(room).forEach((p) => { if (!room.cur[p.id]) room.cur[p.id] = { r: "lose", t: 0, pts: 0 }; });
    finishRound(room, now);
  }
}

function finishRound(room, now) {
  if (turnMode(room)) { finishTurn(room, now); return; }
  const g = GAMES[room.game], act = contenders(room);
  const res = act.map((p) => Object.assign({ id: p.id, award: 0 }, room.cur[p.id] || { r: "lose", t: 0, pts: 0 }));
  const winners = res.filter((x) => x.r === "win").sort((a, b) => (g.pts ? b.pts - a.pts || a.t - b.t : a.t - b.t));
  let teamWin = null;
  if (elimination(room)) {
    res.forEach((x) => { const p = player(room, x.id); if (x.r !== "win") p.lives = Math.max(0, p.lives - 1); x.award = x.r === "win" ? 100 : 0; });
  } else if (room.mode === "versus") {
    winners.forEach((x, i) => { x.award = AWARD[Math.min(i, AWARD.length - 1)]; });
  } else if (room.mode === "duo") {
    teamWin = winners.length >= 1;                                 // one shared verdict: the judge of each game reports it, the partner may only have timed out
    res.forEach((x) => { x.award = teamWin ? 100 : 0; });
    if (teamWin) room.teamScore += 200 + Math.max(0, Math.round((g.dur - Math.min.apply(null, winners.map((w) => w.t))) * 10)); else room.lives--;
  } else {
    const need = act.length >= 3 ? act.length - 1 : act.length;
    teamWin = winners.length >= need;
    winners.forEach((x) => { x.award = 100; });
    if (winners.length === act.length) room.teamScore += 150;
    room.teamScore += winners.length * 100;
    if (!teamWin) room.lives--;
  }
  res.forEach((x) => { const p = player(room, x.id); p.score += x.award; });
  const final = room.round + 1 >= room.total || (elimination(room) ? contenders(room).length <= 1 : room.mode !== "versus" && room.lives <= 0);
  room.last = { round: room.round, game: room.game, results: res, teamWin, final };
  room.state = "between"; room.betweenAt = now;
}

/* Turn modes keep one authoritative actor; assistants never submit a microgame verdict. */
function finishTurn(room, now) {
  const e = room.extra, id = e.actor, p = player(room, id), result = room.cur[id] || { r: "lose", t: 0, pts: 0 };
  const win = result.r === "win", res = Object.assign({ id, award: 0 }, result);
  let final = active(room).length < 2, teamWin = null;
  if (room.mode === "lantern") {
    teamWin = win;
    if (win) { room.teamScore += 100; res.award = 100; } else room.lives = Math.max(0, room.lives - 1);
    final = final || room.lives <= 0 || room.round + 1 >= room.total;
    e.next = nextActor(room, id);
  } else if (room.mode === "balloon") {
    if (win && !e.loser) res.award = 100;
    if (!win && !e.loser) e.balloon += 8;
    if (e.balloon >= room.keys._balloonLimit) e.loser = id;
    final = final || !!e.loser || room.round + 1 >= room.total;
    e.next = win ? nextActor(room, id) : id;
  } else if (room.mode === "cards") {
    if (win) {
      e.remaining.shift();
      if (!e.remaining.length) { res.award = e.pile.length + e.pot; e.pile = []; e.pot = 0; e.phase = "draw"; e.next = nextActor(room, id); }
    } else {
      e.pot += e.pile.length + p.score; p.score = 0;
      e.pile = []; e.remaining = []; e.phase = "draw"; e.next = nextActor(room, id);
    }
    final = final || (!e.deck && !e.remaining.length);
  }
  p.score += res.award;
  room.last = { round: room.round, game: room.game, results: [res], teamWin, final };
  room.state = "between"; room.betweenAt = now;
}
function checkTurnAction(room, id, round, mode) {
  if (room.mode !== mode || room.state !== "round" || room.round !== round) fail("Round is over", 409);
  const p = player(room, id); if (!p || p.left) fail("Not in this round", 403);
}
function drawCard(room, id, round, side, now, rand) {
  checkTurnAction(room, id, round, "cards");
  const e = room.extra;
  if (e.actor !== id || e.phase !== "draw") fail("Not your turn", 403);
  if (side !== "left" && side !== "right") fail("Choose a deck", 400);
  const deck = room.keys._deck, card = side === "left" ? deck.shift() : deck.pop();
  // The final card always resolves the stock, even when PLAY was drawn from the other end earlier.
  e.deck = deck.length; e.card = card;
  if (card !== "play") e.pile.push(card);
  if ((card === "play" || !e.deck) && e.pile.length) { e.phase = "challenge"; e.remaining = e.pile.slice(); }
  else {
    e.actor = nextActor(room, id);
    if (!e.deck) { endGame(room); return; }
  }
  room.round++; beginRound(room, now, rand);
}
function stealCard(room, id, round, target) {
  checkTurnAction(room, id, round, "cards");
  const e = room.extra, victim = player(room, target);
  if (e.phase !== "challenge" || id === e.actor || id === target) fail("Cannot steal now", 403);
  if (!victim || victim.left || victim.score <= 0) fail("No cards to steal", 409);
  if (e.stolen[id] === round) return;
  e.stolen[id] = round; victim.score--; player(room, id).score++;
}
function pump(room, id, round, count, now) {
  checkTurnAction(room, id, round, "balloon");
  const e = room.extra;
  if (id === e.actor) fail("Only the other players can pump", 403);
  if (now < room.roundAt + PRE_MS) return;
  const prev = e.pumps[id] === undefined ? room.roundAt + PRE_MS : e.pumps[id];
  const allowance = Math.min(8, Math.floor((now - prev) / 100));
  const accepted = Math.min(allowance, Math.max(0, Math.min(8, Math.floor(Number(count) || 0))));
  if (accepted <= 0) return;
  e.pumps[id] = now; e.balloon += accepted;
  if (e.balloon >= room.keys._balloonLimit) {
    e.loser = e.actor; room.cur[e.actor] = { r: "lose", t: 0, pts: 0 }; finishTurn(room, now);
  }
}

function endGame(room) { room.state = "done"; }

/* any player may call this once the results have been up for a moment; it is idempotent per round */
function advance(room, round, now, rand) {
  if (room.state !== "between" || round !== room.round) return false;
  if (now - room.betweenAt < BETWEEN_MS - 300) fail("Too soon", 409);
  if (room.last && room.last.final) { endGame(room); return true; }
  room.round++;
  if (turnMode(room) && room.extra.next) { room.extra.actor = room.extra.next; delete room.extra.next; }
  if (turnMode(room) && (!player(room, room.extra.actor) || player(room, room.extra.actor).left)) room.extra.actor = active(room)[0].id;
  beginRound(room, now, rand);
  return true;
}

/* rematch: the host sends everyone still here back to the lobby */
function again(room, id) {
  if (room.host !== id) fail("Only the host can do that", 403);
  if (room.state !== "done") fail("Game not finished", 409);
  room.players.filter((p) => p.left).forEach((p) => delete room.keys[p.id]);
  room.players = room.players.filter((p) => !p.left);
  room.players.forEach((p) => { p.score = 0; });
  Object.assign(room, { state: "lobby", round: 0, total: 0, game: "", seed: 0, sp: 1, cur: {}, last: null, lives: LIVES, teamScore: 0, extra: {} });
}

const SIG_MAX = 512, SIG_COUNT = 10;
/* DUO live relay: validates a batch of small input messages from one player and returns the payload to forward to the others.
   Not stored anywhere (inputs never touch the room record). Dropped unless the room is in a round of a DUO game. */
function sigPayload(room, id, round, m) {
  if (!["duo", "lantern"].includes(room.mode) || room.state !== "round" || round !== room.round) fail("Round is over", 409);
  const p = player(room, id);
  if (!p || p.left) fail("Not in this round", 403);
  if (!Array.isArray(m) || !m.length || m.length > SIG_COUNT) fail("Bad message", 400);
  const out = m.map((x) => ({ t: String((x && x.t) || "").slice(0, 12), d: x && x.d !== undefined ? x.d : null }));
  if (room.mode === "lantern") for (const x of out) {
    if (x.t === "hb" || x.t === "ping" || x.t === "pong") continue;
    if (id === room.extra.actor) {
      if (!["move", "down", "up", "key", "keyup"].includes(x.t)) fail("Bad input", 400);
      if (x.t === "key" || x.t === "keyup") { if (!x.d || typeof x.d.code !== "string" || x.d.code.length > 24) fail("Bad key", 400); }
      else if (!x.d || !Number.isFinite(x.d.x) || !Number.isFinite(x.d.y)) fail("Bad position", 400);
    } else if (x.t !== "light" || !x.d || !Number.isFinite(x.d.x) || !Number.isFinite(x.d.y)) fail("Bad light", 400);
  }
  if (JSON.stringify(out).length > SIG_MAX) fail("Message too big", 413);
  return { from: id, round, m: out };
}

/* voice chat signaling (WebRTC offer/answer/ICE): any room state, any mode, to one player (`to`) or everybody ('*'). Audio itself never touches the server. */
const VSIG_MAX = 4096, VSIG_KINDS = ["hello", "here", "bye", "offer", "answer", "ice", "dhello", "doffer", "danswer", "dice"];
function vsigPayload(room, id, to, k, d) {
  const p = player(room, id);
  if (!p || p.left) fail("Not in this room", 403);
  if (VSIG_KINDS.indexOf(k) < 0) fail("Bad message", 400);
  to = String(to || "*");
  if (to !== "*" && !player(room, to)) fail("Unknown player", 400);
  const out = { from: id, to: to, k: k, d: d === undefined ? null : d };
  if (JSON.stringify(out).length > VSIG_MAX) fail("Message too big", 413);
  return out;
}

/* what clients may see (the record itself hides `keys`; this is for tests and logs) */
const publicRoom = (room) => { const o = Object.assign({}, room); delete o.keys; return o; };

module.exports = { fail, MAX_PLAYERS, ROUNDS, LIVES, AWARD, GAMES, GAME_IDS, DUO_IDS, MODES, roleOf, cleanMode, drawCard, stealCard, pump, turnMode, sigPayload, SIG_MAX, vsigPayload, VSIG_MAX, PartyError, cleanName, cleanCode, makeCode, active, newRoom, addPlayer, auth, leave, setMode, start, again, report, tick, advance, roundMs, publicRoom };
