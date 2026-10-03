'use strict';
// Rules and failure paths for the three turn modes. Run: node test/party-modes.test.js
const assert = require('node:assert/strict');
const P = require('../pocketbase/pb_hooks/party.js');
let seed = 17;
const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const make = mode => {
  const r = P.newRoom('TEST', mode, 0);
  ['A', 'B', 'C'].forEach(name => P.addPlayer(r, { name }, rand));
  P.start(r, 'a', 1000, rand); return r;
};
const rejects = (fn, status) => assert.throws(fn, e => e instanceof P.PartyError && e.status === status);
const verdict = (r, win) => P.report(r, r.extra.actor, r.round, win ? 'win' : 'lose', 2, 10, r.roundAt + 4000);
const next = r => P.advance(r, r.round, r.betweenAt + 5000, rand);

// Lanterns rotates the active player and only their verdict spends shared lives.
const light = make('lantern');
assert.equal(light.lives, 3);
rejects(() => P.report(light, 'b', 0, 'win', 1, 0, 3000), 403);
verdict(light, true); assert.equal(light.teamScore, 100); assert.equal(light.state, 'between');
next(light); assert.equal(light.extra.actor, 'b');
for (let i = 0; i < 3; i++) { verdict(light, false); next(light); }
assert.equal(light.state, 'done'); assert.equal(light.lives, 0);
P.again(light, 'a'); assert.deepEqual(light.extra, {});
P.start(light, 'a', 100000, rand); assert.equal(light.extra.actor, 'a'); assert.equal(light.lives, 3);
// Relay messages keep their authenticated sender; assistants cannot forge active-player inputs.
assert.equal(P.sigPayload(light, 'b', 0, [{ t: 'light', d: { x: 200, y: 300 } }]).from, 'b');
rejects(() => P.sigPayload(light, 'b', 0, [{ t: 'down', d: { x: 200, y: 300 } }]), 400);
rejects(() => P.sigPayload(light, 'a', 0, [{ t: 'light', d: { x: 200, y: 300 } }]), 400);
rejects(() => P.sigPayload(light, 'b', 0, [{ t: 'light', d: { x: null, y: 300 } }]), 400);
P.sigPayload(light, 'a', 0, [{ t: 'key', d: { code: 'Space' } }]);

// Balloon: win passes, loss retains, helpers pump with a per-player rate cap, pop identifies one loser.
const balloon = make('balloon');
rejects(() => P.pump(balloon, 'a', 0, 8, 4000), 403);
P.pump(balloon, 'b', 0, 999, 2000); assert.equal(balloon.extra.balloon, 0);
P.pump(balloon, 'b', 0, 999, 3400); assert.equal(balloon.extra.balloon, 8);
P.pump(balloon, 'b', 0, 999, 3400); assert.equal(balloon.extra.balloon, 8);
verdict(balloon, true); next(balloon); assert.equal(balloon.extra.actor, 'b');
verdict(balloon, false); next(balloon); assert.equal(balloon.extra.actor, 'b');
balloon.keys._balloonLimit = balloon.extra.balloon + 1;
P.pump(balloon, 'a', balloon.round, 1, balloon.roundAt + 3000);
assert.equal(balloon.extra.loser, 'b'); assert.equal(balloon.last.final, true);
rejects(() => P.pump(balloon, 'c', balloon.round, 1, balloon.roundAt + 3100), 409);
next(balloon); assert.equal(balloon.state, 'done');
assert.ok(!('keys' in P.publicRoom(balloon)));
P.again(balloon, 'a'); P.start(balloon, 'a', 100000, rand);
assert.equal(balloon.extra.balloon, 0); assert.equal(balloon.extra.loser, undefined);

// Cards: choosing decks rotates turns; PLAY starts the accumulated sequence; only all wins collect it.
const cards = make('cards');
assert.equal(cards.game, 'pc_draw'); assert.equal(cards.extra.deck, 24);
assert.ok(!('keys' in P.publicRoom(cards)));
cards.keys._deck = ['pt_sync', 'pt_memo', 'play', 'pt_grab', 'play']; cards.extra.deck = 5;
rejects(() => P.drawCard(cards, 'b', 0, 'left', 3000, rand), 403);
rejects(() => P.drawCard(cards, 'a', 0, 'middle', 3000, rand), 400);
P.drawCard(cards, 'a', 0, 'left', 3000, rand);
assert.equal(cards.extra.actor, 'b'); assert.deepEqual(cards.extra.pile, ['pt_sync']);
rejects(() => P.drawCard(cards, 'a', 0, 'left', 3000, rand), 409);
P.drawCard(cards, 'b', cards.round, 'left', 4000, rand);
P.drawCard(cards, 'c', cards.round, 'left', 5000, rand);
assert.equal(cards.extra.actor, 'c'); assert.equal(cards.game, 'pt_sync');
verdict(cards, true); next(cards); assert.equal(cards.game, 'pt_memo'); assert.equal(cards.players[2].score, 0);
verdict(cards, true); assert.equal(cards.players[2].score, 2); next(cards);
assert.equal(cards.game, 'pc_draw'); assert.equal(cards.extra.actor, 'a');
P.drawCard(cards, 'a', cards.round, 'left', cards.roundAt + 2000, rand);
P.drawCard(cards, 'b', cards.round, 'left', cards.roundAt + 2000, rand);
// Assistants steal once per microgame. Active player cannot steal or report from another seat.
P.stealCard(cards, 'a', cards.round, 'c'); P.stealCard(cards, 'a', cards.round, 'c');
assert.equal(cards.players[0].score, 1); assert.equal(cards.players[2].score, 1);
rejects(() => P.stealCard(cards, 'b', cards.round, 'c'), 403);
rejects(() => P.report(cards, 'a', cards.round, 'win', 1, 0, 9000), 403);
verdict(cards, false); assert.equal(cards.extra.pot, 1); assert.equal(cards.last.final, true); next(cards);
assert.equal(cards.state, 'done');
// A failed challenge forfeits the player's cards into the pot, which the next success collects.
const pot = make('cards');
pot.keys._deck = ['pt_sync', 'play', 'pt_grab', 'play']; pot.extra.deck = 4;
P.drawCard(pot, 'a', 0, 'left', 3000, rand); P.drawCard(pot, 'b', pot.round, 'left', 4000, rand);
pot.players[1].score = 3; verdict(pot, false); assert.equal(pot.extra.pot, 4); assert.equal(pot.players[1].score, 0); next(pot);
P.drawCard(pot, 'c', pot.round, 'left', 9000, rand); P.drawCard(pot, 'a', pot.round, 'left', 10000, rand);
verdict(pot, true); assert.equal(pot.players[0].score, 5); assert.equal(pot.extra.pot, 0); next(pot); assert.equal(pot.state, 'done');
// Drawing from the right cannot strand the pile without a PLAY card at the end.
const right = make('cards'); right.keys._deck = ['pt_sync', 'play']; right.extra.deck = 2;
P.drawCard(right, 'a', 0, 'right', 3000, rand); P.drawCard(right, 'b', right.round, 'right', 4000, rand);
assert.equal(right.extra.phase, 'challenge'); assert.equal(right.game, 'pt_sync');
verdict(right, true); next(right); assert.equal(right.state, 'done');
// Silence auto-draws, then timeout fails only the actor; leaving rotates safely and ends a lone-player room.
for (const mode of ['lantern', 'cards', 'balloon']) {
  const r = make(mode);
  if (mode === 'cards') { r.keys._deck = ['pt_sync', 'play']; r.extra.deck = 2; }
  P.tick(r, r.roundAt + P.roundMs(r) + 9000);
  assert.notEqual(r.state + ':' + r.round, 'round:0');
  const leaveRoom = make(mode); P.leave(leaveRoom, 'a', 3000);
  assert.equal(leaveRoom.state, 'between'); next(leaveRoom); assert.notEqual(leaveRoom.extra.actor, 'a');
  P.leave(leaveRoom, 'b', 9000); assert.equal(leaveRoom.state, 'done');
}
console.log('party turn modes OK');
