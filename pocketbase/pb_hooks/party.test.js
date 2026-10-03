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

// --- helpers ---
assert.equal(P.cleanCode(" ab-c1d9 "), "ABC1"); assert.match(P.makeCode(rand), /^[A-Z2-9]{4}$/);
assert.equal(P.publicRoom(r).keys, undefined);
console.log("party.test.js OK");
