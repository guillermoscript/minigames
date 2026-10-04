'use strict';
// HTTP persistence/integration test against an isolated running PocketBase.
// PB=http://127.0.0.1:8099 node test/party-modes.e2e.js
const assert = require('node:assert/strict');
const base = process.env.PB || 'http://127.0.0.1:8099';
const post = async (action, data) => { const response = await fetch(base + '/api/party/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: response.status, data: await response.json() }; };
const { PRE_MS_TURN } = require('../pocketbase/pb_hooks/party.js');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function setup(mode, count = 2) {
  let result = await post('create', { name: 'Modes A', mode }); assert.equal(result.status, 200);
  const code = result.data.room.code, seats = [result.data.you];
  for (let i = 1; i < count; i++) { result = await post('join', { code, name: 'Modes ' + i }); assert.equal(result.status, 200); seats.push(result.data.you); }
  const call = (action, seat, data = {}) => post(action, { code, ...seats[seat], ...data });
  result = await call('start', 0); assert.equal(result.status, 200); assert.equal(result.data.room.mode, mode); assert.ok(result.data.room.extra.actor);
  return { call, seats, room: result.data.room, cleanup: async () => { for (let i = 0; i < seats.length; i++) await call('leave', i); } };
}
(async () => {
  const light = await setup('lantern');
  try {
    let result = await light.call('sig', 1, { round: 0, m: [{ t: 'light', d: { x: 300, y: 250 } }] }); assert.equal(result.status, 200);
    result = await light.call('report', 1, { round: 0, r: 'win', t: 1 }); assert.equal(result.status, 403);
    result = await light.call('report', 0, { round: 0, r: 'win', t: 1 }); assert.equal(result.status, 200); assert.equal(result.data.room.teamScore, 100);
    await sleep(3800); result = await light.call('advance', 1, { round: 0 }); assert.equal(result.status, 200); assert.equal(result.data.room.extra.actor, 'b');
    console.log('HTTP Lanterns: actor validation, relay, shared score and role rotation OK');
  } finally { await light.cleanup(); }
  const balloon = await setup('balloon', 4);
  try {
    let result = await balloon.call('pump', 0, { round: 0, count: 8 }); assert.equal(result.status, 403);
    await sleep(PRE_MS_TURN + 810);
    let room = balloon.room;
    for (let i = 0; room.state === 'round' && i < 24; i++) {
      for (const seat of [1, 2, 3]) {
        result = await balloon.call('pump', seat, { round: 0, count: 8 });
        if (result.status === 409) break;
        assert.equal(result.status, 200); room = result.data.room;
        assert.ok(!('keys' in room)); assert.ok(!('_balloonLimit' in room.extra));
        if (room.state !== 'round') break;
      }
      if (room.state === 'round') await sleep(810);
    }
    assert.equal(room.state, 'between'); assert.equal(room.extra.loser, 'a'); assert.equal(room.last.final, true);
    console.log('HTTP Balloon: persisted pumping, private threshold and authoritative pop OK');
  } finally { await balloon.cleanup(); }
  const cards = await setup('cards', 3);
  try {
    let room = cards.room, challenges = 0, draws = 0;
    for (let turn = 0; room.state !== 'done' && turn < 100; turn++) {
      assert.ok(!('keys' in room)); assert.ok(!('_deck' in room.extra));
      const actor = cards.seats.findIndex(s => s.id === room.extra.actor);
      if (room.state === 'between') { await sleep(3800); const result = await cards.call('advance', 0, { round: room.round }); assert.equal(result.status, 200); room = result.data.room; continue; }
      if (room.extra.phase === 'draw') {
        const result = await cards.call('draw', actor, { round: room.round, side: 'left' }); assert.equal(result.status, 200); room = result.data.room; draws++;
      } else {
        challenges++;
        const helper = (actor + 1) % cards.seats.length, victim = room.players.find(p => p.id !== cards.seats[helper].id && p.score > 0);
        if (victim) { const result = await cards.call('steal', helper, { round: room.round, target: victim.id }); assert.equal(result.status, 200); room = result.data.room; }
        const result = await cards.call('report', actor, { round: room.round, r: 'win', t: 1, pts: 10 }); assert.equal(result.status, 200); room = result.data.room;
      }
    }
    assert.equal(room.state, 'done'); assert.equal(draws, 24); assert.equal(challenges, 16);
    assert.equal(room.players.reduce((sum, p) => sum + p.score, 0), 16);
    console.log('HTTP Cards: full 24-card match, 16 challenges, stealing and scoring OK');
  } finally { await cards.cleanup(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
