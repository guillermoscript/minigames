'use strict';
// PB=http://127.0.0.1:8102 node test/party-spectators.e2e.js
const assert = require('node:assert/strict');
const base = process.env.PB || 'http://127.0.0.1:8102';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function post(action, data) {
  const response = await fetch(base + '/api/party/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return { status: response.status, data: await response.json() };
}
(async () => {
  const created = await post('create', { name: 'Spectator A', mode: 'knockout' });
  assert.equal(created.status, 200);
  const code = created.data.room.code, roomId = created.data.room.id, seats = [created.data.you];
  const call = (action, index, extra = {}) => post(action, { code, ...seats[index], ...extra });
  let reader;
  try {
    for (const name of ['Spectator B', 'Spectator C']) {
      const result = await post('join', { code, name }); assert.equal(result.status, 200); seats.push(result.data.you);
    }
    const response = await fetch(base + '/api/realtime'); reader = response.body.getReader();
    let connectedResolve, receivedResolve, receiveError;
    const connected = new Promise(resolve => { connectedResolve = resolve; });
    const received = new Promise(resolve => { receivedResolve = resolve; });
    let expectedRound = 1, buffer = '';
    const decode = new TextDecoder();
    const listening = (async () => {
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        buffer += decode.decode(chunk.value, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const lines = buffer.slice(0, end).split('\n'), fields = {}; buffer = buffer.slice(end + 2);
          for (const line of lines) { const split = line.indexOf(':'); if (split >= 0) fields[line.slice(0, split)] = line.slice(split + 1).trim(); }
          if (fields.event === 'PB_CONNECT') {
            const result = await fetch(base + '/api/realtime', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: fields.id, subscriptions: ['rooms/' + roomId, 'rooms/' + roomId + '/sig'] }) });
            assert.ok(result.ok); connectedResolve();
          } else if (fields.event === 'rooms/' + roomId + '/sig') {
            const event = JSON.parse(fields.data);
            if (event.round === expectedRound && event.m.some(m => m.t === 'frame')) receivedResolve(event);
          }
        }
      }
    })().catch(error => { receiveError = error; connectedResolve(); receivedResolve(null); });
    await connected;
    assert.equal(receiveError, undefined);
    assert.equal((await call('start', 0)).status, 200);
    for (const index of [0, 1, 2]) assert.equal((await call('report', index, { round: 0, r: index === 1 ? 'lose' : 'win', t: 1, pts: 20 })).status, 200);
    await sleep(4100);
    const next = await call('advance', 0, { round: 0 }); assert.equal(next.status, 200); assert.equal(next.data.room.round, 1);
    assert.equal(next.data.room.players.find(p => p.id === seats[1].id).lives, 0);
    const frame = { t: 'frame', d: { image: 'data:image/jpeg;base64,' + 'A'.repeat(20000), cmd: 'PLAY!', time: 5 } };
    const send = await call('sig', 2, { round: 1, m: [frame] }); assert.equal(send.status, 200); assert.ok(send.data.n >= 1);
    let timeout;
    const event = await Promise.race([received, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Spectator SSE frame timed out')), 3000); })]).finally(() => clearTimeout(timeout));
    assert.equal(receiveError, undefined); assert.ok(event); assert.equal(event.from, seats[2].id); assert.deepEqual(event.m, [frame]);
    assert.equal((await call('sig', 1, { round: 1, m: [frame] })).status, 403);
    assert.equal((await call('report', 1, { round: 1, r: 'win', t: 1 })).status, 403);
    const stored = await (await fetch(base + '/api/collections/rooms/records/' + roomId)).json();
    assert.ok(!('keys' in stored)); assert.ok(!JSON.stringify(stored).includes(frame.d.image));
    await reader.cancel(); await listening; reader = null;
    console.log('HTTP spectators: eliminated viewer receives active player frames over SSE; no game simulation, forged broadcasts or persisted images');
  } finally {
    if (reader) await reader.cancel().catch(() => {});
    for (let i = seats.length - 1; i >= 0; i--) await call('leave', i);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
