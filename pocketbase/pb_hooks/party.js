/* Claude Ware PARTY mode (play with friends in a room): pure room logic + a thin PocketBase layer.
   A room is ONE record in the `rooms` collection. Clients never write it: every action goes through /api/party/* routes (see
   claudeware.pb.js) which run the pure functions below inside a DB transaction and save the record; PocketBase realtime then
   pushes the new record to everyone subscribed to it. Pure functions take `now` (ms) and `rand` so party.test.js can drive them. */

const MAX_PLAYERS = 4;
const ROUNDS = { versus: 6, team: 8, duo: 8 };
const MODES = ["versus", "team", "duo"];
const LIVES = 4;
const PRE_MS = 1400, PRE_MS_DUO = 3600;            // instruction card shown before each microgame (keep in sync with PRE in js/main.js)
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
};
const GAME_IDS = Object.keys(GAMES).filter((g) => !GAMES[g].duo);
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
const player = (room, id) => room.players.find((p) => p.id === id);
const cleanMode = (m) => (MODES.includes(m) ? m : "versus");
/* DUO roles (0 or 1) rotate every round so both players get to play each one; js/party.js derives them with the same formula */
const roleOf = (room, id) => { const i = room.players.filter((p) => !p.left).findIndex((p) => p.id === id); return i < 0 ? -1 : (i + room.round) % 2; };

function newRoom(code, mode, now) {
  return { code, mode: cleanMode(mode), state: "lobby", round: 0, total: 0, players: [], keys: {}, host: "", game: "", seed: 0, sp: 1,
    roundAt: 0, betweenAt: 0, cur: {}, last: null, lives: LIVES, teamScore: 0, created: now };
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
function leave(room, id) {
  const p = player(room, id);
  if (!p) return false;
  if (room.state === "lobby") {
    room.players = room.players.filter((q) => q.id !== id);
    delete room.keys[id];
  } else p.left = true;
  const alive = active(room);
  if (!alive.length) return true;
  if (room.host === id || !player(room, room.host) || player(room, room.host).left) room.host = alive[0].id;
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
  room.players.forEach((p) => { p.score = 0; });
  beginRound(room, now, rand);
}

function beginRound(room, now, rand) {
  const prev = room.game, ids = room.mode === "duo" ? DUO_IDS : GAME_IDS, pool = ids.filter((g) => g !== prev);
  room.game = pool[Math.floor(rand() * pool.length)];
  room.seed = 1 + Math.floor(rand() * 2147483646);
  room.sp = +(1 + room.round * 0.07).toFixed(2);
  room.state = "round"; room.roundAt = now; room.cur = {};
}

const roundMs = (room) => Math.round(GAMES[room.game].dur / Math.sqrt(room.sp) * 1000) + (room.mode === "duo" ? PRE_MS_DUO : PRE_MS);

function report(room, id, round, r, t, pts, now) {
  if (room.state !== "round" || round !== room.round) fail("Round is over", 409);
  const p = player(room, id);
  if (!p || p.left) fail("Not in this round", 403);
  if (room.cur[id]) return;                                  // first report wins
  const dur = GAMES[room.game].dur / Math.sqrt(room.sp);
  room.cur[id] = { r: r === "win" ? "win" : "lose", t: +Math.max(0.05, Math.min(dur, Number(t) || dur)).toFixed(2), pts: Math.max(0, Math.min(999, Math.floor(Number(pts) || 0))) };
  maybeFinishRound(room, now);
}

function maybeFinishRound(room, now) {
  if (room.state === "round" && active(room).every((p) => room.cur[p.id])) finishRound(room, now);
}

function tick(room, now) {
  if (room.state === "round" && now > room.roundAt + roundMs(room) + GRACE_MS) {
    active(room).forEach((p) => { if (!room.cur[p.id]) room.cur[p.id] = { r: "lose", t: 0, pts: 0 }; });
    finishRound(room, now);
  }
}

function finishRound(room, now) {
  const g = GAMES[room.game], act = active(room);
  const res = act.map((p) => Object.assign({ id: p.id, award: 0 }, room.cur[p.id] || { r: "lose", t: 0, pts: 0 }));
  const winners = res.filter((x) => x.r === "win").sort((a, b) => (g.pts ? b.pts - a.pts || a.t - b.t : a.t - b.t));
  let teamWin = null;
  if (room.mode === "versus") {
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
  const final = room.round + 1 >= room.total || (room.mode !== "versus" && room.lives <= 0);
  room.last = { round: room.round, game: room.game, results: res, teamWin, final };
  room.state = "between"; room.betweenAt = now;
}

function endGame(room) { room.state = "done"; }

/* any player may call this once the results have been up for a moment; it is idempotent per round */
function advance(room, round, now, rand) {
  if (room.state !== "between" || round !== room.round) return false;
  if (now - room.betweenAt < BETWEEN_MS - 300) fail("Too soon", 409);
  if (room.last && room.last.final) { endGame(room); return true; }
  room.round++;
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
  Object.assign(room, { state: "lobby", round: 0, total: 0, game: "", seed: 0, sp: 1, cur: {}, last: null, lives: LIVES, teamScore: 0 });
}

const SIG_MAX = 512, SIG_COUNT = 10;
/* DUO live relay: validates a batch of small input messages from one player and returns the payload to forward to the others.
   Not stored anywhere (inputs never touch the room record). Dropped unless the room is in a round of a DUO game. */
function sigPayload(room, id, round, m) {
  if (room.mode !== "duo" || room.state !== "round" || round !== room.round) fail("Round is over", 409);
  const p = player(room, id);
  if (!p || p.left) fail("Not in this round", 403);
  if (!Array.isArray(m) || !m.length || m.length > SIG_COUNT) fail("Bad message", 400);
  const out = m.map((x) => ({ t: String((x && x.t) || "").slice(0, 12), d: x && x.d !== undefined ? x.d : null }));
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

module.exports = { fail, MAX_PLAYERS, ROUNDS, LIVES, AWARD, GAMES, GAME_IDS, DUO_IDS, MODES, roleOf, cleanMode, sigPayload, SIG_MAX, vsigPayload, VSIG_MAX, PartyError, cleanName, cleanCode, makeCode, active, newRoom, addPlayer, auth, leave, setMode, start, again, report, tick, advance, roundMs, publicRoom };
