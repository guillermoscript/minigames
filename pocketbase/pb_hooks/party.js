/* Claude Ware PARTY mode (play with friends in a room): pure room logic + a thin PocketBase layer.
   A room is ONE record in the `rooms` collection. Clients never write it: every action goes through /api/party/* routes (see
   claudeware.pb.js) which run the pure functions below inside a DB transaction and save the record; PocketBase realtime then
   pushes the new record to everyone subscribed to it. Pure functions take `now` (ms) and `rand` so party.test.js can drive them. */

const MAX_PLAYERS = 4;
const ROUNDS = { versus: 6, team: 8, duo: 8, survival: 30, knockout: 30, lantern: 12, cards: 80, balloon: 60 };
const MODES = ["versus", "team", "duo", "survival", "knockout", "lantern", "cards", "balloon"];
const LIVES = 4;
const PRE_MS = 1400, PRE_MS_DUO = 7300;            // instruction card shown before each microgame (keep in sync with PRE in js/main.js)
const PRE_MS_TURN = 4000; // role instructions for Lanterns, Cards and Balloon (TURN_PRE in js/party.js)
const GRACE_MS = 8000;          // a silent player is counted as a loss this long after the round should have ended
const PRE_MS_BALLOON = 1400, BETWEEN_MS_BALLOON = 700, BETWEEN_MS_BALLOON_FINAL = 2500;   // BALLOON is meant to be frantic: almost no waiting (keep in sync with balloonPre/balloonBetween in js/party.js)
const PRE_MS_CARDS = 2200;   // CARDS is meant to flow: the pile card is read in 2.2 s and a deck pick has no instruction card at all (keep in sync with balloonPre in js/party.js)
const preTurn = (room) => room.mode === "balloon" ? PRE_MS_BALLOON : room.mode === "cards" ? (room.extra.phase === "draw" ? 0 : PRE_MS_CARDS) : PRE_MS_TURN;
const betweenMs = (room) => room.mode === "balloon" ? (room.last && room.last.final ? BETWEEN_MS_BALLOON_FINAL : BETWEEN_MS_BALLOON) : BETWEEN_MS;
const BETWEEN_MS = 4000;        // results screen minimum time before the next round may start
const AWARD = [100, 70, 50, 30];
const COLORS = ["#D97757", "#6EA8FE", "#7BD88F", "#F28CB1", "#B49CFF", "#FFD23F", "#FF6B4D", "#4DD0E1"];
/* party microgames: id -> { dur (s, at speed 1), pts (ranked by `pts` instead of finish time) } - keep in sync with js/games/pt1.js */
const GAMES = {
  pt_mash: { dur: 5, pts: true },
  pt_sync: { dur: 5, pts: true },
  pt_memo: { dur: 8, pts: false },
  pt_grab: { dur: 7, pts: true },
  /* DUO games: two players, two roles, ONE shared verdict - keep in sync with js/games/du1.js and js/games/duo/*.js */
  du_catch: { dur: 14, pts: false, duo: true },
  du_decode: { dur: 15, pts: false, duo: true },
  du_crank: { dur: 14, pts: false, duo: true },
  du_steer: { dur: 15, pts: false, duo: true },
  du_seesaw: { dur: 14, pts: false, duo: true },
  du_beat: { dur: 13, pts: false, duo: true },
  du_guide: { dur: 16, pts: false, duo: true },
  du_gun: { dur: 15, pts: false, duo: true },
  /* one file per game in js/games/duo/ */
  du_hippo: { dur: 19, pts: false, duo: true },
  du_legs: { dur: 15, pts: false, duo: true },
  du_shield: { dur: 22, pts: false, duo: true },
  du_panic: { dur: 15, pts: false, duo: true },
  du_rails: { dur: 15, pts: false, duo: true },
  du_crane: { dur: 15, pts: false, duo: true },
  du_granny: { dur: 15, pts: false, duo: true },
  du_hose: { dur: 15, pts: false, duo: true },
  du_keys: { dur: 15, pts: false, duo: true },
  du_barber: { dur: 15, pts: false, duo: true },
  /* Twisted-inspired DUO games (one file each in js/games/duo/): two roles that NEED each other, ONE shared verdict */
  du_squeegee: { dur: 15, pts: false, duo: true },
  du_reel: { dur: 15, pts: false, duo: true },
  du_jar: { dur: 15, pts: false, duo: true },
  du_pump: { dur: 15, pts: false, duo: true },
  du_bridge: { dur: 15, pts: false, duo: true },
  du_frog: { dur: 15, pts: false, duo: true },
  du_lighthouse: { dur: 16, pts: false, duo: true },
  /* SQUAD games: 3 or 4 players, one role each, ONE shared verdict. min/max = how many seats the game supports (default 2/2 = a DUO game).
     One file per game in js/games/squad/. Keep dur in sync with the game's g.dur. */
  sq_pizza: { dur: 18, pts: false, duo: true, min: 3, max: 4 },
  sq_pit: { dur: 14, pts: false, duo: true, min: 3, max: 4 },
  sq_circus: { dur: 16, pts: false, duo: true, min: 3, max: 4 },
  sq_sub: { dur: 18, pts: false, duo: true, min: 3, max: 4 },
  sq_movers: { dur: 17, pts: false, duo: true, min: 3, max: 4 },
  sq_vault: { dur: 16, pts: false, duo: true, min: 3, max: 4 },
  sq_blanket: { dur: 16, pts: false, duo: true, min: 3, max: 4 },
  sq_storm: { dur: 18, pts: false, duo: true, min: 3, max: 4 },
};
const TURN_CATALOG = require(typeof __hooks === "string" ? `${__hooks}/party_catalog.js` : "./party_catalog.js");
Object.assign(GAMES, TURN_CATALOG);
const TURN_IDS = Object.keys(TURN_CATALOG);
GAMES.pc_draw = { dur: 30, pts: false, menu: true };
const GAME_IDS = ["pt_mash", "pt_sync", "pt_memo", "pt_grab"];
const SOLO_IDS = TURN_IDS.filter((g) => !g.startsWith("td_"));          // SURVIVAL / KNOCKOUT: every solo 2D microgame (3D ones stay out: a phone that cannot load WebGL would cost everybody a life)
const DUO_IDS = Object.keys(GAMES).filter((g) => GAMES[g].duo);
const DUO_MAX = 4;                                                       // DUO/SQUAD rooms take 2 to 4 players; each game declares how many seats it uses
const seatsOf = (g) => ({ min: GAMES[g].min || 2, max: GAMES[g].max || 2 });
const duoIdsFor = (n) => DUO_IDS.filter((g) => { const s = seatsOf(g); return n >= s.min && n <= s.max; });
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
/* DUO/SQUAD roles (0..n-1, n = seated players) rotate every round so everybody plays each one; js/party.js derives them with the same formula */
const roleOf = (room, id) => { const a = room.players.filter((p) => !p.left), i = a.findIndex((p) => p.id === id); return i < 0 ? -1 : (i + room.round) % a.length; };

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
  const seats = room.mode === "duo" && room.state === "round" ? room.extra.seats || 2 : 2;   // the round was built for this many seats
  if (room.mode === "duo" && (alive.length < 2 || alive.length < seats) && (room.state === "round" || room.state === "between")) {   // a teammate is gone: the team loses this round; with fewer than 2 left the run ends
    if (room.state === "round") { alive.forEach((p) => { if (!room.cur[p.id]) room.cur[p.id] = { r: "lose", t: 0, pts: 0 }; }); finishRound(room, 0); }
    if (alive.length < 2) room.last.final = true;
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
  if (room.mode === "duo" && active(room).length > DUO_MAX) fail("DUO takes 2 to 4 players", 409);
  room.total = ROUNDS[room.mode];
  room.lives = LIVES; room.teamScore = 0; room.round = 0; room.last = null;
  room.players.forEach((p) => { p.score = 0; p.lives = room.mode === "knockout" ? 1 : 3; });
  room.extra = {};
  delete room.keys._gameBag;
  delete room.keys._roomGameBag;
  if (turnMode(room)) {
    room.extra.actor = active(room)[0].id;
    if (room.mode === "lantern") room.lives = 3;
    if (room.mode === "balloon") { room.extra.balloon = 0; room.extra.pumps = {}; room.extra.contrib = {}; room.extra.at = 0; room.keys._balloonLimit = 100 + Math.floor(rand() * 81); balloonShow(room); }
    if (room.mode === "cards") {
      // Four packs, each with four challenges and two PLAY cards; shuffle all but the last PLAY.
      const deck = [];
      for (let i = 0; i < 16; i++) deck.push(takeTurnGame(room, rand));
      for (let i = 0; i < 7; i++) deck.push("play");
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      deck.push("play"); room.keys._deck = deck;
      Object.assign(room.extra, { phase: "draw", pile: [], remaining: [], pot: 0, deck: deck.length, stolen: {} });
    }
  }
  beginRound(room, now, rand);
}

// Exhaust a shuffled catalog before reshuffling; keep the previous game away from a cycle boundary.
function takeTurnGame(room, rand) {
  if (!Array.isArray(room.keys._gameBag) || !room.keys._gameBag.length) {
    const bag = TURN_IDS.slice();
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    if (bag[bag.length - 1] === room.game) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    room.keys._gameBag = bag;
  }
  return room.keys._gameBag.pop();
}
// Shared room modes use a shuffled bag too, so every catalog game appears before a repeat.
// Keep using the existing per-round picker when fewer than two games are available.
function takeRoomGame(room, rand, ids) {
  const prev = room.game;
  if (!Array.isArray(room.keys._roomGameBag) || !room.keys._roomGameBag.length) {
    const bag = ids.slice();
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    if (bag.length > 1 && bag[bag.length - 1] === prev) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    room.keys._roomGameBag = bag;
  }
  return room.keys._roomGameBag.pop();
}
function beginRound(room, now, rand) {
  const ids = room.mode === "duo" ? duoIdsFor(active(room).length) : room.mode === "survival" || room.mode === "knockout" ? SOLO_IDS : GAME_IDS;
  if (room.mode === "duo" && Array.isArray(room.keys._roomGameBag)) room.keys._roomGameBag = room.keys._roomGameBag.filter((g) => ids.includes(g));   // somebody left since the bag was shuffled
  room.game = room.mode === "cards" ? (room.extra.phase === "draw" ? "pc_draw" : room.extra.remaining[0]) : turnMode(room) ? takeTurnGame(room, rand) : takeRoomGame(room, rand, ids);
  room.seed = 1 + Math.floor(rand() * 2147483646);
  room.sp = +(1 + Math.min(room.round, 12) * 0.07).toFixed(2);
  room.state = "round"; room.roundAt = now; room.cur = {};
  if (room.mode === "duo") room.extra.seats = active(room).length;
  if (room.mode === "cards") room.extra.stealing = {};
  if (room.mode === "balloon") { room.extra.turn = {}; room.extra.start = room.extra.danger || 0; room.extra.penalty = 0; }
}

const roundMs = (room) => Math.round(GAMES[room.game].dur / Math.sqrt(room.sp) * 1000) + (room.mode === "duo" ? PRE_MS_DUO : turnMode(room) ? preTurn(room) : PRE_MS);

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
    const tw = teamWin ? Math.min.apply(null, winners.map((w) => w.t)) : 0;
    res.forEach((x) => { x.award = teamWin ? 100 : 0; x.r = teamWin ? "win" : "lose"; x.t = tw; });   // both seats show the team's verdict
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
    balloonSettle(room, now);
    if (!win && !e.loser) { e.balloon += 8; e.penalty = 8; }
    balloonShow(room);
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
  e.deck = deck.length; e.card = card; e.side = side;   // `side` lets the watchers' guesses be settled when the next round starts
  if (card !== "play") e.pile.push(card);
  if ((card === "play" || !e.deck) && e.pile.length) { e.phase = "challenge"; e.remaining = e.pile.slice(); }
  else {
    e.actor = nextActor(room, id);
    if (!e.deck) { endGame(room); return; }
  }
  room.round++; beginRound(room, now, rand);
}
function stealCard(room, id, round, target, now) {
  checkTurnAction(room, id, round, "cards");
  const e = room.extra, victim = player(room, target);
  if (e.phase !== "challenge" || id === e.actor || id === target) fail("Cannot steal now", 403);
  if (!victim || victim.left || victim.score <= 0) fail("No cards to steal", 409);
  if (e.stolen[id] === round) return;
  if (!Number.isFinite(now)) fail("Invalid action time", 400);
  if (now < room.roundAt + preTurn(room)) return;
  const attempts = e.stealing || (e.stealing = {}), attempt = attempts[id];
  if (!attempt || attempt.round !== round || attempt.target !== target) {
    attempts[id] = { round, target, readyAt: now + 1200 }; return;
  }
  if (now < attempt.readyAt) return;
  e.stolen[id] = round; delete attempts[id]; victim.score--; player(room, id).score++;
}
/* The balloon slowly leaks while nobody pumps: a tiny loss per second, only counted while a round is live.
   `at` is the server time the balloon was last settled; clients extrapolate with `leak` (danger per second). */
const LEAK_PER_S = 0.9;
function balloonSettle(room, now) {
  const e = room.extra, from = Math.max(e.at || 0, room.roundAt + preTurn(room));
  if (now > from) { e.balloon = Math.max(0, e.balloon - LEAK_PER_S * (now - from) / 1000); e.at = now; }
  else e.at = from;
  balloonShow(room);
}
function balloonShow(room) {
  const e = room.extra, limit = room.keys._balloonLimit || 140;
  e.danger = Math.round(Math.min(1, e.balloon / limit) * 1000) / 1000;
  e.leak = Math.round(LEAK_PER_S / limit * 10000) / 10000;
}
function pump(room, id, round, count, now) {
  checkTurnAction(room, id, round, "balloon");
  const e = room.extra;
  if (id === e.actor) fail("Only the other players can pump", 403);
  if (now < room.roundAt + preTurn(room)) return;
  const prev = e.pumps[id] === undefined ? room.roundAt + preTurn(room) : e.pumps[id];
  const allowance = Math.min(8, Math.floor((now - prev) / 45));
  const accepted = Math.min(allowance, Math.max(0, Math.min(8, Math.floor(Number(count) || 0))));
  if (accepted <= 0) return;
  e.pumps[id] = now; balloonSettle(room, now);
  e.balloon += accepted / Math.max(1, active(room).length - 1);
  e.contrib = e.contrib || {}; e.contrib[id] = (e.contrib[id] || 0) + accepted; e.turn = e.turn || {}; e.turn[id] = (e.turn[id] || 0) + accepted; e.lastPump = { id, n: accepted, at: now };
  balloonShow(room);
  if (e.balloon >= room.keys._balloonLimit) {
    e.loser = e.actor; room.cur[e.actor] = { r: "lose", t: 0, pts: 0 }; finishTurn(room, now);
  }
}

function endGame(room) { room.state = "done"; }

/* any player may call this once the results have been up for a moment; it is idempotent per round */
function advance(room, round, now, rand) {
  if (room.state !== "between" || round !== room.round) return false;
  if (now - room.betweenAt < betweenMs(room) - 300) fail("Too soon", 409);
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

const SIG_MAX = 512, SIG_FRAME_MAX = 65536, SIG_COUNT = 10;
/* Sabotage relay ('sab' messages: someone covers a rival's screen with a harmless overlay). Only competitive modes opt in: co-op modes (team, lantern, duo, squad)
   never do, so nobody can be sabotaged by a teammate. To give another mode sabotage add it to SAB_MODES and teach the client to build a channel for it.
   SURVIVAL and KNOCKOUT (GHOST_MODES) are different: the living never sabotage each other, but an ELIMINATED player (a ghost) may haunt the living, with softer
   kinds (GHOST_KINDS), only while a round is live and under the rate limits below.
   VERSUS (RACE_MODES) is the third case: a player who has FINISHED (won or failed) their microgame waits for the others and may throw the same soft kinds at the players
   who are still playing (never at one who already finished, so nobody can be sabotaged after their result is in).
   TEAM (CHEER_MODES) is co-op and never has sabotage: the waiting finisher may only send a 'cheer' (below), a harmless sparkle for the teammates still playing.
   SAB_KINDS, GHOST_KINDS, SAB_MODES, GHOST_MODES and RACE_MODES are mirrored by SAB_IDS, the `ghost` flags, SAB_MODES, SAB_GHOST_MODES and SAB_RACE_MODES in js/party-sab.js; test/party-sab.test.js fails if they drift apart. */
const SAB_KINDS = ["ink", "fog", "dark", "bugs", "shake", "flip", "pixel", "spam"];
const GHOST_KINDS = ["ink", "bugs", "shake", "pixel", "spam"];
const SAB_MODES = ["balloon", "cards"];
const GHOST_MODES = ["survival", "knockout"];
const RACE_MODES = ["versus"];
const GHOST_GAP_MS = 3000, GHOST_HIT_GAP_MS = 2000, GHOST_ROUND_MAX = 2;   // per ghost, per victim and per ghost per round (the client's cooldown is a little longer, so honest play never trips these)
const RACE_GAP_MS = 2000, RACE_HIT_GAP_MS = 1500, RACE_ROUND_MAX = 2;      // the same for a finished VERSUS player: rounds last 5 to 8 s, so the limits are tighter in time and equal in count
const CHEER_KINDS = ["sparkle", "rainbow", "hearts", "party"], CHEER_MODES = ["team"];   // mirrored by CHEER_IDS / WAIT_CHEER_MODES in js/party-wait.js (test/party-wait.test.js checks both)
const CHEER_GAP_MS = 1200, CHEER_ROUND_MAX = 4;
const isGhost = (room, p) => GHOST_MODES.indexOf(room.mode) >= 0 && !!p && !p.left && p.lives <= 0;
/* may `from` throw a sabotage at `to` right now? both must be present in this room and it cannot be yourself; in GHOST_MODES only a ghost may, and only at a living player who is still playing this round;
   in RACE_MODES only a player who already finished, and only at one who has not */
function sabAllowed(room, from, to) {
  if (typeof to !== "string" || to.length > 24 || from === to) return false;
  const a = player(room, from), b = player(room, to);
  if (!a || a.left || !b) return false;
  if (SAB_MODES.indexOf(room.mode) >= 0) return true;
  if (RACE_MODES.indexOf(room.mode) >= 0) return !!room.cur && !!room.cur[from] && !b.left && !room.cur[to];   // I have my result in, they do not
  return isGhost(room, a) && !b.left && b.lives > 0 && !(room.cur && room.cur[to]);
}
/* The soft relay limits (sabotage from ghosts, finished VERSUS players and BALLOON / CARDS watchers, TEAM cheers, CARDS emotes) all live in ONE app-store string per room,
   "sl:<code>", changed through limiter.update(key, fn): fn(old) gets the current string and returns the next one, and the store runs it under its own lock (PocketBase's
   store.setFunc), so requests that arrive in the same millisecond cannot all read the same old allowance before any of them writes. `limiter` = { update(key, fn) } or,
   for a plain { get, set } (tests), the same steps without the lock; with no limiter only the timing rule applies.
   Per round counts reset when the round token (round + seed, new for every round of every game, so a rematch with the same room code never inherits an allowance) changes;
   gaps are timestamps and carry over. fn(state) returns false to refuse: nothing is written then. */
function limitRoom(room, limiter, fn) {
  const key = "sl:" + room.code, token = room.round + ":" + room.seed;
  let ok = true;
  const step = (raw) => {
    let s = null;
    try { s = JSON.parse(raw); } catch (_) { /* first use of this room */ }
    s = s && typeof s === "object" ? s : {};
    const next = { g: token, n: s.g === token && s.n || {}, t: s.t || {}, v: s.v || {}, b: s.b || {} };
    ok = fn(next) !== false;
    return ok ? JSON.stringify(next) : raw;
  };
  if (typeof limiter.update === "function") limiter.update(key, step);
  else limiter.set(key, step(limiter.get(key)));
  return ok;
}
/* soft sabotage fairness: not before the instruction card is over, and rate limited per thrower, per victim and per round.
   `lim` = { gap, hit, max, pre } in ms / ms / count / ms after the round starts. */
const GHOST_LIMITS = { gap: GHOST_GAP_MS, hit: GHOST_HIT_GAP_MS, max: GHOST_ROUND_MAX }, RACE_LIMITS = { gap: RACE_GAP_MS, hit: RACE_HIT_GAP_MS, max: RACE_ROUND_MAX };
/* BALLOON and CARDS: the client earns 1 charge per 6 s plus one per trap won and waits 3 s between sends, so the server (which cannot see the traps) only enforces a looser
   gap between a thrower's sends and, mainly, a long gap per victim: the hardest kinds last about 4 s, so nobody is hit again before they got a breather (3 watchers cannot keep one actor blind) */
const SAB_GAP_MS = 2500, SAB_HIT_GAP_MS = 5000, SAB_LIMITS = { gap: SAB_GAP_MS, hit: SAB_HIT_GAP_MS, max: Infinity };
function ghostLimit(room, id, to, now, limiter, lim = GHOST_LIMITS) {
  if (now < room.roundAt + (lim.pre === undefined ? PRE_MS : lim.pre)) fail("Too early", 409);
  if (!limiter) return;
  const mine = "s:" + id;
  if (!limitRoom(room, limiter, (s) => {
    const rounds = s.n[mine] || 0;
    if (now - (s.t[mine] || 0) < lim.gap || now - (s.v[to] || 0) < lim.hit || rounds >= lim.max) return false;
    s.n[mine] = rounds + 1; s.t[mine] = now; s.v[to] = now;
  })) fail("Slow down", 429);
}
/* a TEAM cheer: same idea with no victim (it goes to the whole team), so only the sender's gap and the round allowance */
function cheerLimit(room, id, now, limiter) {
  if (now < room.roundAt + PRE_MS) fail("Too early", 409);
  if (!limiter) return;
  const mine = "c:" + id;
  if (!limitRoom(room, limiter, (s) => {
    const rounds = s.n[mine] || 0;
    if (now - (s.t[mine] || 0) < CHEER_GAP_MS || rounds >= CHEER_ROUND_MAX) return false;
    s.n[mine] = rounds + 1; s.t[mine] = now;
  })) fail("Slow down", 429);
}
/* emotes and deck bets: a token bucket per sender (a burst of REACT_BURST, then one per REACT_REFILL_MS: faster than a thumb, slower than a script) */
const REACT_BURST = 8, REACT_REFILL_MS = 70;
function reactLimit(room, id, now, limiter) {
  if (!limiter) return;
  const mine = "r:" + id;
  if (!limitRoom(room, limiter, (s) => {
    const b = s.b[mine] || [REACT_BURST, now], have = Math.min(REACT_BURST, (+b[0] || 0) + Math.max(0, now - (+b[1] || 0)) / REACT_REFILL_MS);
    if (have < 1) return false;
    s.b[mine] = [have - 1, now];
  })) fail("Slow down", 429);
}
/* Table reactions and deck guesses (js/party-react.js): emotes everybody sees on the table, and a watcher's bet on which deck the player will pick. Harmless relay
   messages like 'sab': nothing is stored. Only modes in REACT_MODES opt in (add a mode here and build createReactions on the client); REACT_KINDS and GUESS_SIDES are
   mirrored by REACT_IDS and GUESS_SIDES in js/party-react.js (test/party-react.test.js checks both). */
const REACT_KINDS = ["heart", "star", "laugh", "wow", "fire"];
const REACT_MODES = ["cards"];
const GUESS_SIDES = ["left", "right"];
/* Live relay for DUO inputs, spectator snapshots in every mode and lantern light positions.
   Payloads are authenticated and forwarded, never stored in the room record. */
function sigPayload(room, id, round, m, now, limiter) {
  if (!MODES.includes(room.mode) || room.state !== "round" || round !== room.round) fail("Round is over", 409);
  const p = player(room, id), ghost = elimination(room) && !!p && p.lives <= 0;
  if (!p || p.left || (ghost && !(Array.isArray(m) && m.length === 1 && m[0] && m[0].t === "sab"))) fail("Not in this round", 403);   // an eliminated player may send nothing but one sabotage
  if (!Array.isArray(m) || !m.length || m.length > SIG_COUNT) fail("Bad message", 400);
  const out = m.map((x) => {
    const o = { t: String((x && x.t) || "").slice(0, 12), d: x && x.d !== undefined ? x.d : null };
    if (x && Number.isSafeInteger(x.n) && x.n > 0) { o.n = x.n; o.l = x.l === true;
      if (typeof x.v === "string" && /^[a-z0-9]{1,24}$/.test(x.v)) o.v = x.v; }
    return o;
  });
  let hasFrame = false;
  for (const x of out) {
    if (x.t === "frame") {
      if (turnMode(room) && id !== room.extra.actor) fail("Not your turn", 403);
      if (!x.d || typeof x.d.image !== "string" || x.d.image.length > 60000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x.d.image)) fail("Bad frame", 400);
      hasFrame = true;
      continue;
    }
    /* sabotage: any player of a mode that opted in (SAB_MODES) may cover someone's screen with a harmless overlay; DUO keeps relaying its own custom inputs */
    if (x.t === "sab" && room.mode !== "duo") {
      if (SAB_MODES.indexOf(room.mode) < 0 && GHOST_MODES.indexOf(room.mode) < 0 && RACE_MODES.indexOf(room.mode) < 0) fail("Sabotage unavailable in this mode", 409);
      if (GHOST_MODES.indexOf(room.mode) >= 0) {
        if (!ghost) fail("Only ghosts can sabotage", 403);
        if (!x.d || GHOST_KINDS.indexOf(x.d.k) < 0 || !sabAllowed(room, id, x.d.to)) fail("Bad sabotage", 400);
        ghostLimit(room, id, x.d.to, Number.isFinite(now) ? now : Date.now(), limiter);
      } else if (RACE_MODES.indexOf(room.mode) >= 0) {
        if (!room.cur[id]) fail("Finish your game first", 409);   // waiting is the only time a VERSUS player may sabotage
        if (!x.d || GHOST_KINDS.indexOf(x.d.k) < 0 || !sabAllowed(room, id, x.d.to)) fail("Bad sabotage", 400);
        ghostLimit(room, id, x.d.to, Number.isFinite(now) ? now : Date.now(), limiter, RACE_LIMITS);
      } else {
        if (!x.d || SAB_KINDS.indexOf(x.d.k) < 0 || !sabAllowed(room, id, x.d.to)) fail("Bad sabotage", 400);
        ghostLimit(room, id, x.d.to, Number.isFinite(now) ? now : Date.now(), limiter, Object.assign({ pre: preTurn(room) }, SAB_LIMITS));
      }
      continue;
    }
    /* cheer: a finished TEAM player sends a harmless sparkle to the teammates still playing; nothing is stored and it never changes a score */
    if (x.t === "cheer" && room.mode !== "duo") {
      if (CHEER_MODES.indexOf(room.mode) < 0) fail("Cheers unavailable in this mode", 409);
      if (!x.d || CHEER_KINDS.indexOf(x.d.k) < 0) fail("Bad cheer", 400);
      if (!room.cur[id]) fail("Finish your game first", 409);
      cheerLimit(room, id, Number.isFinite(now) ? now : Date.now(), limiter);
      continue;
    }
    if ((x.t === "react" || x.t === "guess") && room.mode !== "duo") {
      if (REACT_MODES.indexOf(room.mode) < 0) fail("Reactions unavailable in this mode", 409);
      if (x.t === "react" ? !x.d || REACT_KINDS.indexOf(x.d.k) < 0 : !x.d || GUESS_SIDES.indexOf(x.d.s) < 0 || room.extra.phase !== "draw" || id === room.extra.actor) fail("Bad " + x.t, 400);   // a guess is only for watchers of a deck pick
      reactLimit(room, id, Number.isFinite(now) ? now : Date.now(), limiter);
      continue;
    }
    if (room.mode === "duo") continue; // Preserve the DUO games' existing custom relay inputs.
    if (x.t === "hb" || x.t === "ping" || x.t === "pong" || x.t === "_net_ping" || x.t === "_net_pong") continue;
    if (!turnMode(room)) fail("Inputs unavailable in this mode", 409);
    if (id === room.extra.actor) {
      if (room.mode === "lantern" && ["move", "down", "up", "key", "keyup"].includes(x.t)) {
        if (x.t === "key" || x.t === "keyup") { if (!x.d || typeof x.d.code !== "string" || x.d.code.length > 24) fail("Bad key", 400); }
        else if (!x.d || !Number.isFinite(x.d.x) || !Number.isFinite(x.d.y)) fail("Bad position", 400);
      } else fail("Bad input", 400);
    } else if (room.mode !== "lantern" || x.t !== "light" || !x.d || !Number.isFinite(x.d.x) || !Number.isFinite(x.d.y)) fail("Bad light", 400);
  }
  if (JSON.stringify(out).length > (hasFrame || turnMode(room) ? SIG_FRAME_MAX : SIG_MAX)) fail("Message too big", 413);
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

module.exports = { fail, MAX_PLAYERS, ROUNDS, LIVES, AWARD, GAMES, GAME_IDS, SOLO_IDS, DUO_IDS, duoIdsFor, seatsOf, takeRoomGame, TURN_IDS, takeTurnGame, MODES, roleOf, cleanMode, drawCard, stealCard, pump, turnMode, sigPayload, SAB_KINDS, GHOST_KINDS, SAB_MODES, GHOST_MODES, RACE_MODES, RACE_GAP_MS, RACE_HIT_GAP_MS, RACE_ROUND_MAX, CHEER_KINDS, CHEER_MODES, CHEER_GAP_MS, CHEER_ROUND_MAX, REACT_KINDS, REACT_MODES, GUESS_SIDES, PRE_MS_CARDS, GHOST_GAP_MS, GHOST_HIT_GAP_MS, GHOST_ROUND_MAX, SAB_GAP_MS, SAB_HIT_GAP_MS, REACT_BURST, REACT_REFILL_MS, PRE_MS, sabAllowed, SIG_MAX, SIG_FRAME_MAX, PRE_MS_TURN, vsigPayload, VSIG_MAX, PartyError, cleanName, cleanCode, makeCode, active, newRoom, addPlayer, auth, leave, setMode, start, again, report, tick, advance, roundMs, publicRoom };
