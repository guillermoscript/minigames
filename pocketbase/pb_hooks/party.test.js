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
assert.equal(r.state, "round"); assert.equal(r.total, 6); assert.ok(P.GAME_IDS.includes(r.game)); throwsStatus(() => P.addPlayer(r, { name: "late" }, rand), 409);
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
throwsStatus(() => P.start(d, "a", 0, rand), 409);             // 3 players: not allowed
P.leave(d, "c");
P.start(d, "a", 0, rand); assert.equal(d.mode, "duo"); assert.equal(d.total, 8); assert.ok(P.DUO_IDS.includes(d.game));
assert.equal(P.roleOf(d, "a"), 0); assert.equal(P.roleOf(d, "b"), 1);
P.report(d, "a", 0, "win", 3, 0, 0); assert.equal(d.state, "round");
P.report(d, "b", 0, "lose", 11, 0, 0);                         // partner timed out, judge won -> team wins
assert.equal(d.last.teamWin, true); assert.ok(d.teamScore >= 200); assert.equal(d.lives, 4); assert.ok(d.last.results.every((x) => x.award === 100 && x.r === "win" && x.t === 3));   // one verdict on both rows
P.advance(d, 0, 9000, rand); assert.equal(d.round, 1); assert.equal(P.roleOf(d, "a"), 1); assert.equal(P.roleOf(d, "b"), 0);   // roles swap
for (const g of P.DUO_IDS) assert.ok(P.GAMES[g].roles === undefined || P.GAMES[g].roles === 2);
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
