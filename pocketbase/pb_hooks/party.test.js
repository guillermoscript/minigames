// Run: node pocketbase/pb_hooks/party.test.js   (pure room-logic tests)
const assert = require("assert");
const P = require("./party.js");
let s = 7; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
const throwsStatus = (fn, status) => { try { fn(); } catch (e) { assert.ok(e instanceof P.PartyError, String(e)); assert.equal(e.status, status, e.message); return; } assert.fail("did not throw"); };

// --- lobby ---
const r = P.newRoom("ABCD", "versus", 0);
const a = P.addPlayer(r, { name: "  Ana!! ", color: "#6EA8FE" }, rand), b = P.addPlayer(r, { name: "Ana", color: "#6EA8FE" }, rand);
assert.equal(r.host, "a"); assert.equal(r.players[0].name, "Ana"); assert.equal(r.players[1].name, "Ana2");
assert.notEqual(r.players[0].color, r.players[1].color);
assert.equal(P.auth(r, "a", a.key).id, "a"); throwsStatus(() => P.auth(r, "a", b.key), 403); throwsStatus(() => P.auth(r, "a", ""), 403);
throwsStatus(() => P.start(r, "b", 0, rand), 403);
const solo = P.newRoom("SOLO", "versus", 0); const so = P.addPlayer(solo, { name: "x" }, rand); throwsStatus(() => P.start(solo, so.id, 0, rand), 409);
P.addPlayer(r, { name: "C" }, rand); P.addPlayer(r, { name: "D" }, rand); throwsStatus(() => P.addPlayer(r, { name: "E" }, rand), 409);

// --- versus: ranking by time, then by points ---
P.start(r, "a", 1000, rand);
assert.equal(r.state, "round"); assert.equal(r.total, 6); assert.ok(P.SOLO_IDS.includes(r.game)); throwsStatus(() => P.addPlayer(r, { name: "late" }, rand), 409);
const g1 = r.game; const dur = P.GAMES[g1].dur;
P.report(r, "a", 0, "win", 2.0, 5, 2000); P.report(r, "b", 0, "lose", 1.0, 0, 2000); P.report(r, "c", 0, "win", 1.5, 9, 2000);
P.report(r, "a", 0, "lose", 1, 0, 2000);                       // duplicate ignored
assert.equal(r.state, "round"); throwsStatus(() => P.report(r, "d", 5, "win", 1, 1, 2000), 409);
P.report(r, "d", 0, "win", 1.0, 5, 2000);
assert.equal(r.state, "between");
const byId = Object.fromEntries(r.last.results.map((x) => [x.id, x]));
if (P.GAMES[g1].pts) { assert.equal(byId.c.award, 100); assert.equal(byId.d.award, 70); assert.equal(byId.a.award, 50); } // pts desc, then time
else { assert.equal(byId.d.award, 100); assert.equal(byId.c.award, 70); assert.equal(byId.a.award, 50); }
assert.equal(byId.b.award, 0); assert.equal(r.players[1].score, 0);
// advance rules
throwsStatus(() => P.advance(r, 0, 1500, rand), 409);
assert.equal(P.advance(r, 1, 6000, rand), false);              // wrong round: no-op
assert.equal(P.advance(r, 0, 6000, rand), true); assert.equal(r.round, 1); assert.equal(r.state, "round"); assert.notEqual(r.game, g1);
assert.equal(P.advance(r, 0, 6100, rand), false);              // idempotent

// --- timeout counts silent players as losses ---
P.tick(r, r.roundAt + 1000); assert.equal(r.state, "round");
P.report(r, "a", 1, "win", 1, 5, 7000);
P.tick(r, r.roundAt + P.roundMs(r) + 9000); assert.equal(r.state, "between");
assert.equal(r.last.results.find((x) => x.id === "b").r, "lose");

// --- leaving mid-game: host handoff, rounds finish without the leaver ---
assert.equal(P.leave(r, "a"), false); assert.equal(r.host, "b"); assert.equal(P.active(r).length, 3);
P.advance(r, 1, 40000, rand); P.report(r, "b", 2, "win", 1, 1, 21000); P.report(r, "c", 2, "win", 1, 1, 21000); assert.equal(r.state, "round");
P.leave(r, "d"); assert.equal(r.state, "between");             // last missing player left -> round closes
P.leave(r, "c"); assert.equal(r.state, "done");                // fewer than 2 left -> game over
assert.equal(P.leave(r, "b"), true);                           // empty -> delete

// --- team mode: shared lives, final round ends the run ---
const t = P.newRoom("TEAM", "team", 0); P.addPlayer(t, { name: "A" }, rand); P.addPlayer(t, { name: "B" }, rand);
P.start(t, "a", 0, rand); assert.equal(t.total, 8); assert.equal(t.lives, 4);
P.report(t, "a", 0, "win", 1, 1, 0); P.report(t, "b", 0, "win", 1, 1, 0);
assert.equal(t.last.teamWin, true); assert.equal(t.teamScore, 350); assert.equal(t.lives, 4);
for (let i = 1; i <= 4; i++) { P.advance(t, i - 1, 100000 * i, rand); P.report(t, "a", i, "win", 1, 1, 0); P.report(t, "b", i, "lose", 1, 0, 0); }
assert.equal(t.lives, 0); assert.equal(t.last.final, true);
P.advance(t, 4, 9e6, rand); assert.equal(t.state, "done");

// --- rematch ---
const m = P.newRoom("MATC", "versus", 0); P.addPlayer(m, { name: "A" }, rand); P.addPlayer(m, { name: "B" }, rand); P.addPlayer(m, { name: "C" }, rand);
throwsStatus(() => P.again(m, "a"), 409); P.start(m, "a", 0, rand); P.leave(m, "c"); m.state = "done"; m.players[0].score = 170;
throwsStatus(() => P.again(m, "b"), 403); P.again(m, "a");
assert.equal(m.state, "lobby"); assert.equal(m.players.length, 2); assert.equal(m.keys.c, undefined); assert.equal(m.players[0].score, 0); assert.equal(m.last, null);
P.start(m, "a", 0, rand); assert.equal(m.state, "round");

// --- DUO: exactly 2 players, rotating roles, one shared verdict, relay validation, partner leaving ---
const d = P.newRoom("DUOO", "duo", 0); P.addPlayer(d, { name: "A" }, rand); P.addPlayer(d, { name: "B" }, rand); P.addPlayer(d, { name: "C" }, rand);
P.leave(d, "c");
P.start(d, "a", 0, rand); assert.equal(d.mode, "duo"); assert.equal(d.total, 8); assert.ok(P.DUO_IDS.includes(d.game));
assert.equal(P.roleOf(d, "a"), 0); assert.equal(P.roleOf(d, "b"), 1);
P.report(d, "a", 0, "win", 3, 0, 0); assert.equal(d.state, "round");
P.report(d, "b", 0, "lose", 11, 0, 0);                         // partner timed out, judge won -> team wins
assert.equal(d.last.teamWin, true); assert.ok(d.teamScore >= 200); assert.equal(d.lives, 4); assert.ok(d.last.results.every((x) => x.award === 100 && x.r === "win" && x.t === 3));   // one verdict on both rows
P.advance(d, 0, 9000, rand); assert.equal(d.round, 1); assert.equal(P.roleOf(d, "a"), 1); assert.equal(P.roleOf(d, "b"), 0);   // roles swap
for (const g of P.DUO_IDS) assert.ok(P.GAMES[g].roles === undefined || P.GAMES[g].roles === 2);
assert.ok(P.duoIdsFor(2).length >= 14 && P.duoIdsFor(2).every((g) => !g.startsWith("sq_")) && P.duoIdsFor(2).includes("du_squeegee"));   // two players only get the DUO games
assert.ok(P.duoIdsFor(3).length >= 5 && P.duoIdsFor(3).every((g) => g.startsWith("sq_")) && !P.duoIdsFor(3).includes("du_hippo") && P.duoIdsFor(4).join() === P.duoIdsFor(3).join());
// --- SQUAD: 3 and 4 players, one role each, roles rotate over all seats, game pool depends on the head count ---
for (const n of [3, 4]) {
  const q = P.newRoom("SQD" + n, "duo", 0); for (let i = 0; i < n; i++) P.addPlayer(q, { name: "P" + i }, rand);
  P.start(q, "a", 0, rand); assert.ok(P.GAMES[q.game].duo && !P.GAMES[q.game].roles && P.seatsOf(q.game).min <= n && n <= P.seatsOf(q.game).max);
  const ids = q.players.map((p) => p.id), seen = new Set(); for (let r = 0; r < n; r++) { q.round = r; seen.add(P.roleOf(q, ids[0])); assert.deepEqual(ids.map((i) => P.roleOf(q, i)).sort(), [...Array(n).keys()]); } assert.equal(seen.size, n);
  q.round = 0; ids.slice(0, n - 1).forEach((i) => P.report(q, i, 0, "lose", 5, 0, 0)); assert.equal(q.state, "round"); P.report(q, ids[n - 1], 0, "win", 4, 0, 0);   // one winner anywhere = team win
  assert.equal(q.last.teamWin, true); assert.ok(q.last.results.every((x) => x.r === "win"));
}
const q4 = P.newRoom("SQD5", "duo", 0); for (let i = 0; i < 4; i++) P.addPlayer(q4, { name: "P" + i }, rand); P.start(q4, "a", 0, rand);
P.leave(q4, "d"); assert.equal(q4.state, "between"); assert.equal(q4.last.teamWin, false); assert.ok(!q4.last.final);   // 4 -> 3: the round is lost, the run goes on
const q2 = P.newRoom("SQD6", "duo", 0); for (let i = 0; i < 3; i++) P.addPlayer(q2, { name: "P" + i }, rand); P.start(q2, "a", 0, rand);
P.leave(q2, "c"); assert.ok(!q2.last.final); P.advance(q2, 0, 9000, rand); assert.ok(P.seatsOf(q2.game).min <= 2);                                       // 3 -> 2: back to DUO games
const sg = P.sigPayload(d, "a", 1, [{ t: "bx", d: 120 }]); assert.equal(sg.from, "a"); assert.equal(sg.m[0].t, "bx");
throwsStatus(() => P.sigPayload(d, "a", 0, [{ t: "bx", d: 1 }]), 409);                       // stale round
throwsStatus(() => P.sigPayload(d, "a", 1, []), 400); throwsStatus(() => P.sigPayload(d, "a", 1, "x"), 400);
throwsStatus(() => P.sigPayload(d, "a", 1, [{ t: "bx", d: "x".repeat(600) }]), 413);
throwsStatus(() => P.sigPayload(d, "z", 1, [{ t: "bx" }]), 403);
throwsStatus(() => P.sigPayload(m, "a", 0, [{ t: "bx" }]), 409);                             // non-DUO room
P.report(d, "a", 1, "lose", 1, 0, 0); P.report(d, "b", 1, "lose", 1, 0, 0); assert.equal(d.last.teamWin, false); assert.equal(d.lives, 3); assert.ok(d.last.results.every((x) => x.r === "lose"));
P.advance(d, 1, 99000, rand); P.leave(d, "b");                 // partner leaves mid-round
assert.equal(d.state, "between"); assert.equal(d.last.teamWin, false); assert.equal(d.last.final, true);
P.advance(d, 2, 999000, rand); assert.equal(d.state, "done");
throwsStatus(() => P.sigPayload(d, "a", 2, [{ t: "bx" }]), 409);
const dm = P.newRoom("MODE", "versus", 0); P.addPlayer(dm, { name: "A" }, rand); P.setMode(dm, "a", "duo"); assert.equal(dm.mode, "duo"); P.setMode(dm, "a", "bogus"); assert.equal(dm.mode, "versus");

// --- helpers ---
assert.equal(P.cleanCode(" ab-c1d9 "), "ABC1"); assert.match(P.makeCode(rand), /^[A-Z2-9]{4}$/);
assert.equal(P.publicRoom(r).keys, undefined);
console.log("party.test.js OK");

// --- voice signaling: valid in the lobby too, any mode, only for players in the room ---
{
  const v = P.newRoom("VOIC", "versus", 0); const va = P.addPlayer(v, { name: "A" }, rand), vb = P.addPlayer(v, { name: "B" }, rand);
  const m1 = P.vsigPayload(v, "a", "b", "offer", { sdp: "x" }); assert.deepEqual(m1, { from: "a", to: "b", k: "offer", d: { sdp: "x" } });
  assert.equal(P.vsigPayload(v, "b", undefined, "hello").to, "*");
  for (const k of ["dhello", "doffer", "danswer", "dice"]) assert.equal(P.vsigPayload(v, "a", "b", k, { s: "x" }).k, k);   // DUO direct-link setup
  throwsStatus(() => P.vsigPayload(v, "a", "zz", "offer", {}), 400);
  throwsStatus(() => P.vsigPayload(v, "a", "b", "evil", {}), 400);
  throwsStatus(() => P.vsigPayload(v, "q", "b", "offer", {}), 403);
  throwsStatus(() => P.vsigPayload(v, "a", "b", "offer", { sdp: "x".repeat(P.VSIG_MAX) }), 413);
  v.players[1].left = true; throwsStatus(() => P.vsigPayload(v, "b", "a", "hello"), 403);
}
console.log("voice signaling OK");

// Elimination modes: spectators do not hold up rounds; timeout loses a life.
for (const mode of ['survival', 'knockout']) {
  const room = P.newRoom('TEST', mode, 0);
  for (const name of ['A', 'B', 'C']) P.addPlayer(room, { name }, rand);
  P.start(room, 'a', 1000, rand);
  const lives = mode === 'survival' ? 3 : 1;
  assert.equal(room.players[0].lives, lives);
  for (let round = 0; round < lives; round++) {
    P.report(room, 'a', room.round, 'win', 1, 5, 2000 + round * 20000);
    P.report(room, 'b', room.round, 'lose', 1, 0, 2000 + round * 20000);
    P.tick(room, room.roundAt + P.roundMs(room) + 9000);
    assert.equal(room.players[1].lives, lives - round - 1);
    assert.equal(room.players[2].lives, lives - round - 1);
    assert.equal(room.last.final, round === lives - 1);
    P.advance(room, room.round, room.betweenAt + 5000, rand);
  }
  assert.equal(room.state, 'done');
  assert.equal(room.players[0].lives, lives);
  P.again(room, 'a'); P.start(room, 'a', 100000, rand);
  assert.ok(room.players.every(p => p.lives === lives));
}
const spectate = P.newRoom('SPEC', 'knockout', 0);
for (const name of ['A', 'B', 'C']) P.addPlayer(spectate, { name }, rand);
P.start(spectate, 'a', 1000, rand);
P.report(spectate, 'a', 0, 'lose', 1, 0, 2000);
P.report(spectate, 'b', 0, 'win', 1, 0, 2000);
P.report(spectate, 'c', 0, 'win', 1, 0, 2000);
assert.equal(spectate.last.final, false);
P.advance(spectate, 0, 7000, rand);
throwsStatus(() => P.report(spectate, 'a', 1, 'win', 1, 0, 8000), 403);
P.report(spectate, 'b', 1, 'win', 1, 0, 8000);
P.report(spectate, 'c', 1, 'lose', 1, 0, 8000);
assert.equal(spectate.state, 'between');
assert.equal(spectate.last.final, true);
console.log('elimination modes OK');

// --- LA FIESTA (doc 07 §3-4, M0.5): lobby, start, commit, act (409/403/aid), tick, AFK, takeover, rejoin, privacy ---
{
  const R = P.reglas();
  const F = (room, action, body, now) => P.fiesta(room, action, body || {}, now || 0, rand, action === "join" ? body : null);
  const secret = (room) => { const j = JSON.stringify(P.publicRoom(room)); assert.ok(!/"keys"|"_f"|"rng"|"semilla"|"deck"|"bonusOculta"/.test(j), "nothing private in the public room"); };
  const sizes = (room) => { assert.ok(JSON.stringify(room.board).length < 32768, "board < 32 KB"); assert.ok(JSON.stringify(room.keys).length < 16384, "keys < 16 KB"); };

  // lobby: create + join, unique character pick, host-only cfg, start needs 2 humans and everyone ready
  const f = P.fiestaNew("FIES", 0, { tot: 10, ronda: "relampago", cpuNivel: 9 });
  assert.equal(f.mode, "fiesta"); assert.equal(f.board.f, "lobby"); assert.equal(f.board.cfg.tot, 10); assert.equal(f.board.cfg.ronda, "relampago"); assert.equal(f.board.cfg.cpuNivel, 2);
  assert.ok(!P.MODES.includes("fiesta"), "fiesta is not a classic room mode");
  const A = F(f, "join", { name: "Ana", ch: "mama" }).you;
  assert.equal(A.id, "a"); assert.equal(f.host, "a"); assert.equal(f.board.pj.a.ch, "mama");
  throwsStatus(() => F(f, "start", { id: "a" }), 409);                       // a single human cannot start
  const B = F(f, "join", { name: "Beto", ch: "mama" }).you;                  // mama is taken: Beto joins without a character
  assert.equal(B.id, "b"); assert.equal(f.board.pj.b.ch, null);
  throwsStatus(() => F(f, "pick", { id: "b", ch: "mama" }), 409);
  throwsStatus(() => F(f, "pick", { id: "b", ch: "nadie" }), 400);
  F(f, "pick", { id: "b", ch: "abuela" }); assert.equal(f.board.pj.b.ch, "abuela");
  throwsStatus(() => F(f, "cfg", { id: "b", tot: 20 }), 403);
  let v0 = f.ver; F(f, "cfg", { id: "a", tot: 15 }); assert.equal(f.board.cfg.tot, 15); assert.equal(f.ver, v0 + 1); assert.equal(f.board.ver, f.ver);
  throwsStatus(() => F(f, "start", { id: "b" }), 403);                       // only the host
  throwsStatus(() => F(f, "start", { id: "a" }, 1000), 409);                 // Beto is not ready
  const back = F(f, "join", { id: "b", key: B.key }); assert.equal(back.you.id, "b"); assert.equal(f.players.length, 2);   // rejoin in the lobby keeps the seat
  F(f, "ready", { id: "b", on: true }, 2000);
  secret(f);
  v0 = f.ver; F(f, "start", { id: "a" }, 3000);
  assert.equal(f.state, "play"); assert.equal(f.board.f, "orden"); assert.ok(f.ver > v0 && f.board.ver === f.ver, "ver never goes back at start");
  assert.equal(f.players.length, 4); assert.deepEqual(f.players.map((p) => p.id), ["a", "b", "c", "d"]);
  assert.ok(f.players[2].cpu && f.players[3].cpu && !f.keys.c && !f.keys.d, "CPU fill to 4, without keys");
  assert.equal(f.board.pj.a.ch, "mama"); assert.equal(f.board.pj.b.ch, "abuela"); assert.equal(f.board.pj.c.cpu, "auto");
  assert.equal(new Set(["a", "b", "c", "d"].map((s) => f.board.pj[s].ch)).size, 4, "8-character roster, all different");
  assert.ok(f.keys._f && typeof f.keys._f.rng === "number"); secret(f); sizes(f);
  throwsStatus(() => F(f, "pick", { id: "a", ch: "tio" }), 409);
  throwsStatus(() => P.auth(f, "c", ""), 403);                               // nobody speaks for a CPU seat

  // the order dice: hidden commit until everybody committed
  throwsStatus(() => F(f, "act", { id: "a", eid: f.board.esp.id, aid: "x0", a: { t: "TIRAR" } }, 3100), 409);   // not the board phase yet
  F(f, "commit", { id: "a", k: "orden", aid: "c1", v: 99 }, 3100);
  const mineA = F(f, "mine", { id: "a" }).priv.orden;
  assert.ok(mineA >= 1 && mineA <= 10, "my hidden order value"); assert.equal(F(f, "mine", { id: "b" }).priv.orden, null);
  assert.equal(f.board.f, "orden"); assert.ok(!JSON.stringify(P.publicRoom(f)).includes('"orden":{'), "the committed value is not in the board");
  v0 = f.ver; F(f, "commit", { id: "a", k: "orden", aid: "c1" }, 3200); assert.equal(f.ver, v0, "same aid: not applied twice");
  throwsStatus(() => F(f, "commit", { id: "a", k: "duelo", aid: "c2" }, 3200), 400);
  F(f, "commit", { id: "b", k: "orden", aid: "c3" }, 3300);
  assert.equal(f.board.f, "turno"); assert.equal(f.board.orden.length, 4); assert.equal(F(f, "mine", { id: "a" }).priv.orden, null);
  const reveal = f.board.fx[f.board.fx.length - 1].fx.filter((x) => x.k === "dado" && x.de === "orden");
  assert.equal(reveal.find((x) => x.s === "a").v, mineA, "the reveal shows the value committed earlier");

  // tick: cheap when nothing is due; drive CPU turns until a human's dice prompt
  let now = 3300;
  const human = (s) => f.board.pj[s].cpu === null;
  const step = () => { now = Math.max(now, f.board.nextAt || now) + 1; P.fiestaTick(f, now); };
  assert.equal(P.fiestaDue(f, f.board.nextAt - 1), false); v0 = f.ver; P.fiestaTick(f, f.board.nextAt - 1); assert.equal(f.ver, v0);
  for (let i = 0; i < 500 && !(f.board.f === "turno" && f.board.esp && f.board.esp.k === "DADO" && human(f.board.esp.s)); i++) step();
  const s1 = f.board.esp.s, other = s1 === "a" ? "b" : "a", eid = f.board.esp.id;
  throwsStatus(() => F(f, "act", { id: other, eid, aid: "w1", a: { t: "TIRAR" } }, now), 403);    // not your turn
  throwsStatus(() => F(f, "act", { id: s1, eid: eid - 1, aid: "s1", a: { t: "TIRAR" } }, now), 409);   // stale prompt (D17)
  throwsStatus(() => F(f, "act", { id: s1, aid: "s2", a: { t: "TIRAR" } }, now), 409);                 // no eid = stale
  throwsStatus(() => F(f, "act", { id: s1, eid, ver: f.ver - 1, aid: "s3", a: { t: "TIRAR" } }, now), 409);   // optional strict ver
  throwsStatus(() => F(f, "act", { id: s1, eid, aid: "s4", a: { t: "BORRAR" } }, now), 400);
  throwsStatus(() => F(f, "act", { id: s1, eid, a: { t: "TIRAR" } }, now), 400);                       // aid required
  v0 = f.ver; F(f, "act", { id: s1, eid, aid: "go1", a: { t: "TIRAR" } }, now);
  assert.ok(f.ver > v0); assert.ok(f.board.fx.some((b) => b.fx.some((x) => x.k === "dado" && x.s === s1)));
  const snap = JSON.stringify(f); assert.deepEqual(F(f, "act", { id: s1, eid, aid: "go1", a: { t: "TIRAR" } }, now), { dup: true });
  assert.equal(JSON.stringify(f), snap, "aid retry: 200 and nothing re-applied");
  secret(f);

  // leave in game = AFK with the key kept; back / rejoin clears it
  F(f, "leave", { id: other }, now); assert.equal(f.board.pj[other].cpu, "afk"); assert.ok(f.keys[other]); assert.equal(f.extra.afkAt[other], now);
  F(f, "back", { id: other }, now); assert.equal(f.board.pj[other].cpu, null); assert.ok(!f.extra.afkAt[other]);
  throwsStatus(() => F(f, "back", { id: other }, now), 409);
  F(f, "leave", { id: other }, now);
  const rj = F(f, "join", { id: other, key: other === "a" ? A.key : B.key, name: "x" }, now + 5);
  assert.equal(rj.you.id, other); assert.equal(f.board.pj[other].cpu, null, "rejoin after leave takes the seat back");

  // takeover: a new human gets a CPU seat (new key, inherits everything, fx llega); with none left: spectator
  const cpuSeat = ["c", "d"].find((s) => f.board.pj[s].cpu === "auto"), coins = f.board.pj[cpuSeat].mon;
  const T1 = F(f, "join", { name: "Carla", ch: "mama", seat: cpuSeat }, now + 10).you;
  assert.equal(T1.id, cpuSeat); assert.equal(f.keys[cpuSeat], T1.key); assert.equal(f.players.find((p) => p.id === cpuSeat).name, "Carla");
  assert.ok(!f.players.find((p) => p.id === cpuSeat).cpu); assert.equal(f.board.pj[cpuSeat].mon, coins); assert.notEqual(f.board.pj[cpuSeat].ch, "mama", "taken characters stay unique");
  assert.ok(f.board.fx.some((b) => b.fx.some((x) => x.k === "llega" && x.s === cpuSeat)));
  assert.ok(f.board.pj[cpuSeat].cpu === null || f.board.pj[cpuSeat].toma === 1, "control now or at the next safe boundary");
  throwsStatus(() => F(f, "join", { name: "Dani", seat: cpuSeat }, now + 11), 409);              // that seat is no longer free
  const T2 = F(f, "join", { name: "Dani" }, now + 12); assert.ok(T2.you && T2.you.id !== cpuSeat);
  assert.deepEqual(F(f, "join", { name: "Eva" }, now + 13), { spectate: true });               // 4 humans: spectator
  // an AFK seat can be taken only after its owner is away for more than 180 s; the old key stops working
  F(f, "leave", { id: other }, now + 20);
  assert.deepEqual(F(f, "join", { name: "Eva" }, now + 20 + P.FIESTA_TAKE_MS), { spectate: true });
  const T3 = F(f, "join", { name: "Eva" }, now + 21 + P.FIESTA_TAKE_MS).you; assert.equal(T3.id, other);
  throwsStatus(() => P.auth(f, other, other === "a" ? A.key : B.key), 403);
  assert.ok(!f.extra.afkAt[other] || f.board.pj[other].cpu === "afk");
  secret(f); sizes(f);

  // AFK strikes: a human who never acts goes to the hammock; everybody AFK still finishes the game
  now += 1000 + P.FIESTA_TAKE_MS;
  const watch = T3.id;
  for (let i = 0; i < 3000 && f.board.pj[watch].cpu !== "afk"; i++) step();
  assert.equal(f.board.pj[watch].cpu, "afk", "2 missed dice = AFK"); assert.ok(f.extra.afkAt[watch]);
  F(f, "back", { id: watch }, now); assert.equal(f.board.pj[watch].cpu, null);
  let last = f.ver, steps = 0;
  while (f.board.f !== "fin" && steps++ < 20000) { step(); assert.ok(f.ver >= last); last = f.ver; }
  assert.equal(f.board.f, "fin"); assert.equal(f.state, "done"); assert.equal(f.board.r, f.board.tot);
  secret(f); sizes(f);
  assert.deepEqual(F(f, "join", { name: "Late" }, now), { spectate: true });
  throwsStatus(() => F(f, "mjfin", { id: "a" }, now), 409);                 // no minigame in progress: nothing to finish
  throwsStatus(() => F(f, "mjack", { id: "a" }, now), 409);

  // a host may force the start 20 s after the 2nd human marked ready; lobby leave frees the seat; the last one deletes the room
  const g = P.fiestaNew("FOR2", 0); const ga = F(g, "join", { name: "A" }).you, gb = F(g, "join", { name: "B" }).you; F(g, "join", { name: "C" });
  F(g, "ready", { id: "a" }, 1000); F(g, "ready", { id: "b" }, 2000); assert.equal(g.board.listoAt, 2000);
  throwsStatus(() => F(g, "start", { id: "a" }, 2000 + P.FIESTA_FORCE_MS - 1), 409);
  F(g, "leave", { id: "c" }, 3000); assert.equal(g.players.length, 2); assert.equal(g.board.pj.c, undefined); assert.equal(g.keys.c, undefined);
  F(g, "leave", { id: "a" }); assert.equal(g.host, "b");
  assert.deepEqual(F(g, "leave", { id: "b" }), { del: true });
  const h = P.fiestaNew("FOR3", 0); F(h, "join", { name: "A" }); F(h, "join", { name: "B" }); F(h, "join", { name: "C" });
  F(h, "ready", { id: "a" }, 1000); F(h, "ready", { id: "b" }, 2000);
  F(h, "start", { id: "a" }, 2000 + P.FIESTA_FORCE_MS); assert.equal(h.board.f, "orden"); assert.equal(h.players.filter((p) => p.cpu).length, 1);
  assert.deepEqual(h.board.esp.quien, ["a", "b", "c"]);
  void ga; void gb; void R;
}
console.log("fiesta OK");

// --- LA FIESTA M2: mjfin (judge only, epoch, bounds), mjack + witness close, judge CAS, relay cache invalidation ---
{
  const { liveRoom } = require("../../test/helpers/fiesta-room.js");
  const R = P.reglas();
  const fin = (t, id, o) => Object.assign({ id: id, q: 0, e: 0, kk: 900, sc: [400, 300, 200, 100], cpu: ["c", "d"] }, o);

  // the happy path: the judge's result is clamped (never rejected), `pl` is ignored, the server computes places and pays (10/6/3/1)
  let t = liveRoom({ game: "f_domino", dur: 30 }), f = t.room, mj = f.board.mj, at = mj.startAt + 30000;
  throwsStatus(() => t.F(f, "mjfin", fin(t, "b"), at), 409);                                   // not the judge
  throwsStatus(() => t.F(f, "mjfin", fin(t, "a", { e: 3 }), at), 409);                         // old epoch
  throwsStatus(() => t.F(f, "mjfin", fin(t, "a", { q: 4 }), at), 409);                         // not this game of the queue
  throwsStatus(() => t.F(f, "mjfin", fin(t, "a", { sc: [1, 2, 3] }), at), 400);                // wrong length
  throwsStatus(() => t.F(f, "mjfin", fin(t, "a", { sc: [1, "x", 3, 4] }), at), 400);
  throwsStatus(() => t.F(f, "mjfin", fin(t, "a", { cpu: ["z"] }), at), 400);
  throwsStatus(() => t.F(f, "mjfin", fin(t, "a"), mj.startAt + 5000), 409);                    // far too early for a 30 s game
  assert.equal(f.board.f, "mj", "nothing changed by the failures");
  const v0 = f.ver, r1 = t.F(f, "mjfin", fin(t, "a", { sc: [900, 5000, 0, -4], pl: [1, 1, 1, 1] }), at);
  assert.equal(r1.ok, true); assert.equal(r1.aj, true, "the server had to clamp"); assert.ok(f.ver > v0);
  assert.equal(f.board.f, "res"); assert.deepEqual(f.board.mj.res.sc, [900, 1000, 0, 0]);
  assert.deepEqual(f.board.mj.res.puestos, [2, 1, 3, 3], "places come from compara, not from `pl`");
  assert.deepEqual(f.board.mj.res.pagos, R.pagosMJ("ffa", [2, 1, 3, 3], f.board.r, { tot: f.board.tot, eq: [0, 1, 2, 3], solo: -1 }));
  throwsStatus(() => t.F(f, "mjfin", fin(t, "a"), at + 10), 409);                               // a second verdict is refused
  assert.ok(JSON.stringify(f.board).length < 16384, "board < 16 KB");

  // rate bound: score <= scoreRate * (elapsed + 1.5); a short survival game with dur=4 (the e2e patch) accepts a finish at 3 s
  t = liveRoom({ game: "f_harina", dur: 30 }); f = t.room; mj = f.board.mj;
  assert.equal(t.F(f, "mjfin", fin(t, "a", { sc: [800, 800, 800, 800] }), mj.startAt + 28000).aj, true, "25 pts/s * 29.5 s = 737 < 800");
  assert.deepEqual(f.board.mj.res.sc, [737, 737, 737, 737]);
  t = liveRoom({ game: "f_mecate", dur: 4 }); f = t.room; mj = f.board.mj;
  throwsStatus(() => t.F(f, "mjfin", fin(t, "a", { sc: [100, 90, 10, 10] }), mj.startAt + 2000), 409);   // minT = min(3, dur-1) = 3
  const rs = t.F(f, "mjfin", fin(t, "a", { sc: [121, 119, 100, 90] }), mj.startAt + 3000);
  assert.equal(rs.aj, false); assert.deepEqual(f.board.mj.res.sc, [121, 121, 100, 90], "survival: scores within 3 ticks (100 ms) are one cluster");
  assert.deepEqual(f.board.mj.res.puestos, [1, 1, 3, 4]);

  // mjack + the closing deadline: without a verdict the witness with the highest kk wins; without witnesses, a draw that pays nothing
  t = liveRoom({ game: "f_domino", dur: 30 }); f = t.room; mj = f.board.mj;
  throwsStatus(() => t.F(f, "mjack", { id: "b", q: 7, e: 0, kk: 1, h: 1, sc: [1] }, mj.startAt + 1000), 409);
  throwsStatus(() => t.F(f, "mjack", { id: "b", q: 0, e: 0, kk: "x", h: 1, sc: [1] }, mj.startAt + 1000), 400);
  throwsStatus(() => t.F(f, "mjack", { id: "z", q: 0, e: 0, kk: 1, h: 1, sc: [1] }, mj.startAt + 1000), 403);
  t.F(f, "mjack", { id: "a", q: 0, e: 0, kk: 800, h: 11, sc: [10, 50, 0, 0] }, mj.startAt + 29000);
  t.F(f, "mjack", { id: "b", q: 0, e: 0, kk: 900, h: 12, sc: [60, 20, 0, 0] }, mj.startAt + 29500);
  assert.equal(f.extra.mjw.k, mj.k); assert.equal(Object.keys(f.extra.mjw.w).length, 2);
  t.F(f, "tick", { id: "a" }, mj.cierre - 1); assert.equal(f.board.f, "mj");
  t.F(f, "tick", { id: "a" }, mj.cierre + 1);
  assert.equal(f.board.f, "res"); assert.deepEqual(f.board.mj.res.sc, [60, 20, 0, 0], "the witness with the highest kk decides"); assert.deepEqual(f.board.mj.res.puestos, [1, 2, 3, 3]);
  t = liveRoom({ game: "f_domino", dur: 30 }); f = t.room; mj = f.board.mj;
  t.F(f, "tick", { id: "a" }, mj.cierre + 1);
  assert.equal(f.board.f, "res"); assert.equal(f.board.mj.res.empate, 1); assert.deepEqual(f.board.mj.res.pagos, [0, 0, 0, 0]);

  // judge CAS (route `juez`): two claimants of the same epoch, one wins; the new judge's mjfin needs the new epoch
  t = liveRoom({ game: "f_domino", dur: 30 }); f = t.room; mj = f.board.mj;
  throwsStatus(() => t.F(f, "juez", { id: "b", k: mj.k, e: 0, q: 3 }, mj.startAt + 2000), 409);   // stale game of the queue
  throwsStatus(() => t.F(f, "juez", { id: "b", k: mj.k, e: 0, q: 0 }, mj.startAt + 2000), 409);   // the judge is not known to be dead: no takeover
  t.store.set("fs:" + f.code + ":a", String(mj.startAt + 3500));                                   // the judge spoke 0.5 s ago: still alive
  throwsStatus(() => t.F(f, "juez", { id: "b", k: mj.k, e: 0, q: 0 }, mj.startAt + 4000), 409);
  t.F(f, "juez", { id: "b", k: mj.k, e: 0, q: 0 }, mj.startAt + 4600);                              // silent for > 1 s and b is the first successor
  assert.equal(f.board.mj.juez, "b"); assert.equal(f.board.mj.e, 1);
  throwsStatus(() => t.F(f, "juez", { id: "a", k: mj.k, e: 0 }, mj.startAt + 4601), 409);        // the other one lost the race
  throwsStatus(() => t.F(f, "mjfin", fin(t, "a", { e: 0 }), mj.startAt + 30000), 409);           // old judge, old epoch
  throwsStatus(() => t.F(f, "mjfin", fin(t, "b", { e: 0 }), mj.startAt + 30000), 409);           // new judge, old epoch
  assert.equal(t.F(f, "mjfin", fin(t, "b", { e: 1 }), mj.startAt + 30000).ok, true);
}
console.log("fiesta M2 server OK");

// --- Margarita on LA FIESTA rooms (doc 14 M2): reglas(room) picks the board, create with tab, cfg, act, SECRETO, tick, AFK, takeover, minigame verdict ---
{
  const { memStore } = require("../../test/helpers/fiesta-room.js");
  const store = memStore();
  const F = (room, action, body, now) => P.fiesta(room, action, body || {}, now || 0, rand, action === "join" ? body : null, store);
  const secret = (room) => { const j = JSON.stringify(P.publicRoom(room)); assert.ok(!/"keys"|"_f"|"rng"|"semilla"|"recientes"/.test(j), "nothing private in the public room"); };
  const VE = P.reglas(), MA = P.reglas({ board: { tab: "margarita" } });

  // dispatch: Venezuela by default (its board.tab is the minigame object), Margarita only for the string tab
  assert.notEqual(VE, MA); assert.equal(MA.lobby().tab, "margarita");
  assert.equal(P.reglas(P.fiestaNew("VENE", 0)), VE); assert.equal(P.reglas({ board: { tab: { k: 3 } } }), VE); assert.equal(P.reglas("margarita"), MA);
  assert.equal(P.fiestaNew("VENE", 0, { tab: "nada" }).board.tab, undefined, "an unknown tab is Venezuela");

  // create: only CFG_VALIDA passes; online stays random order, real minigames, no MICRO
  const m = P.fiestaNew("MARG", 0, { tab: "margarita", tot: 15, cpuNivel: 9, ronda: "relampago", micro: true, sinMJ: true, orden: "fijo", n: 2, dadosPj: true });
  assert.equal(m.mode, "fiesta"); assert.equal(m.board.tab, "margarita"); assert.equal(m.board.f, "lobby"); assert.equal(P.reglas(m), MA);
  assert.deepEqual(m.board.cfg, Object.assign({}, MA.CFG0, { tot: 15 }), "only tot/cpuNivel can change, and only to valid values");
  const A = F(m, "join", { name: "Ana", ch: "mama" }).you, B = F(m, "join", { name: "Beto", ch: "abuela" }).you;
  throwsStatus(() => F(m, "cfg", { id: "b", tot: 20 }), 403);
  F(m, "cfg", { id: "a", tot: 20, cpuNivel: 3, micro: true }); assert.equal(m.board.cfg.tot, 20); assert.equal(m.board.cfg.cpuNivel, 3); assert.equal(m.board.cfg.micro, false);
  F(m, "cfg", { id: "a", tot: 10 });
  F(m, "ready", { id: "b" }, 1000); F(m, "start", { id: "a" }, 2000);
  assert.equal(m.state, "play"); assert.equal(m.board.tab, "margarita"); assert.equal(m.board.f, "orden"); assert.equal(m.board.tot, 10);
  assert.deepEqual(m.players.map((p) => p.id), ["a", "b", "c", "d"]); assert.equal(m.board.pj.c.cpu, "auto"); assert.ok(!m.keys.c);
  assert.equal(m.board.pj.a.ch, "mama"); assert.equal(m.board.pj.b.name, "Beto"); assert.equal(m.board.pj.a.bs, 10);
  secret(m); assert.ok(JSON.stringify(m.board).length < 32768, "board < 32 KB");
  throwsStatus(() => F(m, "commit", { id: "a", k: "orden", aid: "c1" }, 2100), 409);         // Margarita has no hidden order dice

  // ticks run the order and the CPU turns until a human has the dice
  let now = 2000;
  const human = (s) => m.board.pj[s].cpu === null;
  const step = () => { now = Math.max(now, m.board.nextAt || now) + 1; P.fiestaTick(m, now, store); };
  for (let i = 0; i < 2000 && !(m.board.f === "turno" && m.board.esp && m.board.esp.k === "DADO" && human(m.board.esp.s)); i++) step();
  const s1 = m.board.esp.s, other = s1 === "a" ? "b" : "a", eid = m.board.esp.id;
  throwsStatus(() => F(m, "act", { id: other, eid, aid: "w1", a: { t: "TIRAR" } }, now), 403);               // not your turn
  throwsStatus(() => F(m, "act", { id: s1, eid: eid - 1, aid: "s1", a: { t: "TIRAR" } }, now), 409);         // stale prompt
  for (const t of ["ESTRELLA", "LISTO", "JUEZ", "VOLVER", "SALIR", "MICRO"]) throwsStatus(() => F(m, "act", { id: s1, eid, aid: "x" + t, a: { t } }, now), 400);   // Venezuela's, or their own route, or local-only
  throwsStatus(() => F(m, "act", { id: s1, eid, aid: "u1", a: { t: "USAR", item: "cafe" } }, now), 400);     // an item you do not have

  // SECRETO: any seat, any time; pays once per secret
  const bs0 = m.board.pj[other].bs;
  F(m, "act", { id: other, aid: "sec0", a: { t: "SECRETO", n: 0 } }, now); F(m, "act", { id: other, aid: "sec0b", a: { t: "SECRETO", n: 0 } }, now);
  assert.equal(m.board.pj[other].bs, bs0 + 3); assert.deepEqual(m.board.pj[other].sec, [0]);
  throwsStatus(() => F(m, "act", { id: other, aid: "sec9", a: { t: "SECRETO", n: 99 } }, now), 400);

  let v0 = m.ver; F(m, "act", { id: s1, eid: m.board.esp.id, aid: "go1", a: { t: "TIRAR" } }, now);
  assert.ok(m.ver > v0 && m.board.ver === m.ver); assert.ok(m.board.fx.some((b) => b.fx.some((x) => x.k === "dado" && x.s === s1)));
  const snap = JSON.stringify(m); assert.deepEqual(F(m, "act", { id: s1, eid, aid: "go1", a: { t: "TIRAR" } }, now), { dup: true });
  assert.equal(JSON.stringify(m), snap, "aid retry: nothing re-applied");
  assert.deepEqual(F(m, "mine", { id: s1 }), { priv: null, mio: !!(m.board.esp && m.board.esp.s === s1) });

  // leave = AFK (key kept), back clears it; a new human takes a CPU seat with everything it had; the 4th is a spectator
  F(m, "leave", { id: other }, now); assert.equal(m.board.pj[other].cpu, "afk"); assert.equal(m.extra.afkAt[other], now);
  F(m, "back", { id: other }, now); assert.equal(m.board.pj[other].cpu, null); assert.ok(!m.extra.afkAt[other]);
  const cpuSeat = ["c", "d"].find((s) => m.board.pj[s].cpu === "auto"), bsC = m.board.pj[cpuSeat].bs;
  const T1 = F(m, "join", { name: "Carla", seat: cpuSeat }, now + 1).you;
  assert.equal(T1.id, cpuSeat); assert.equal(m.board.pj[cpuSeat].bs, bsC); assert.ok(m.board.fx.some((b) => b.fx.some((x) => x.k === "llega" && x.s === cpuSeat)));
  F(m, "join", { name: "Dani" }, now + 2);
  assert.deepEqual(F(m, "join", { name: "Eva" }, now + 3), { spectate: true });

  // a minigame with humans: everybody LISTO, the judge's verdict pays through the shared minigame code (party_mj.js)
  const live = () => ["a", "b", "c", "d"].filter((s) => m.board.pj[s].cpu === null);
  const ready = () => { for (const s of ["a", "b", "c", "d"]) if (m.board.pj[s].cpu === "afk") F(m, "back", { id: s }, now); };
  for (let i = 0; i < 20000 && !(m.board.f === "carta" && m.board.mj && m.board.mj.as.some((s) => live().indexOf(s) >= 0)); i++) { ready(); step(); }
  assert.equal(m.board.f, "carta"); const mk = m.board.mj.k;
  assert.equal(m.round, mk, "room.round follows the minigame counter");
  for (const s of m.board.mj.as) if (m.board.pj[s].cpu === null) F(m, "ready", { id: s }, now);
  assert.equal(m.board.f, "mj"); const mj = m.board.mj, g = mj.cola[mj.i];
  const sc = mj.as.map((s, i) => 100 - i * 10), cpu = mj.as.filter((s) => m.board.pj[s].cpu !== null);
  const notJudge = mj.as.find((s) => s !== mj.juez && live().indexOf(s) >= 0);
  if (notJudge) throwsStatus(() => F(m, "mjfin", { id: notJudge, q: mj.i, e: mj.e, kk: 9, sc, cpu }, mj.startAt + g.dur * 1000), 409);   // only the judge closes it
  assert.equal(F(m, "mjfin", { id: mj.juez, q: mj.i, e: mj.e, kk: 9, sc, cpu }, mj.startAt + g.dur * 1000).ok, true);
  assert.equal(m.board.f, "res"); assert.equal(m.board.mj.k, mk);
  assert.ok(m.board.fx.some((b) => b.fx.some((x) => x.k === "mjRes" && x.mk === mk)), "the result went through the Margarita reducer");

  // to the end: humans go AFK by strikes or come back; minigames with nobody judging close on their deadline
  let last = m.ver, steps = 0;
  while (m.board.f !== "fin" && steps++ < 40000) { step(); assert.ok(m.ver >= last); last = m.ver; }
  assert.equal(m.board.f, "fin"); assert.equal(m.state, "done"); assert.equal(m.board.r, m.board.tot); assert.ok(m.board.ganador);
  secret(m); assert.ok(JSON.stringify(m.board).length < 32768, "board < 32 KB at the end");
  assert.deepEqual(F(m, "join", { name: "Late" }, now), { spectate: true });
  void A; void B;
}
console.log("margarita OK");
