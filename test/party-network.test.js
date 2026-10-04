'use strict';
// Exercise the actual transport with delayed requests and congested/recovering data channels.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { sigPayload } = require('../pocketbase/pb_hooks/party.js');
assert.deepEqual(sigPayload({mode:'duo',state:'round',round:1,players:[{id:'a'}]}, 'a', 1,
  [{t:'press',d:1,n:2,v:'newsession',l:false}]).m[0],
  {t:'press',d:1,n:2,l:false,v:'newsession'}, 'server preserves session and event identities');
let time = 10000;
const calls = [], received = [], pcs = [];
class Peer {
  constructor(config) { this.config = config; this.signalingState = 'stable'; pcs.push(this); }
  createDataChannel(label) { return { label, readyState: 'open', bufferedAmount: 0, send() {} }; }
  async createOffer() { return { type: 'offer', sdp: 'offer' }; }
  async createAnswer() { return { type: 'answer', sdp: 'answer' }; }
  async setLocalDescription(d) { this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable'; }
  async setRemoteDescription(d) { this.remoteDescription = d; }
  async addIceCandidate(c) { (this.candidates ||= []).push(c); }
  close() { this.closed = true; }
}
const sb = { console, URLSearchParams, performance: { now: () => time },
  now: 10, state: 'play', net: {}, API_BASE: '',
  document: { getElementById: () => null }, location: { search: '' }, navigator: {},
  matchMedia: () => ({ matches: false }), addEventListener() {}, setInterval() {},
  setTimeout, clearTimeout, AbortController, RTCPeerConnection: Peer,
  rtcIceServers: () => [{ urls: 'stun:test' }],
  partyTurnMode: r => ['lantern', 'cards', 'balloon'].includes(r.mode),
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
  vsend() {}, Image: class {}, t: s => s,
};
sb.window = sb;
vm.createContext(sb);
for (const file of ['js/party.js', 'js/voice.js', 'js/link.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sb, { filename: file });
const run = code => vm.runInContext(code, sb);
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
sb.requests = calls; sb.received = received;
run(`party.you = { id: 'a', key: 'secret' }; party.room = { id: 'room', code: 'ABCD', mode: 'duo', state: 'round', round: 1,
  players: [{ id: 'a' }, { id: 'b' }] };
  duoCtx(party.room).onMsg((type, data, from) => received.push({ type, data, from }));
  pcall = (action, body) => new Promise(resolve => requests.push({ action, body, resolve }));`);
(async () => {
  // A game signal called ping must reach the game rather than become a network heartbeat.
  run(`onSig({from: 'b', round: 1, m: [{t: 'ping', d: 4}]});`);
  assert.equal(received[0].type, 'ping');
  assert.equal(received[0].data, 4);
  run(`onSig({from: 'b', round: 1, m: [{t: '_net_ping', d: 10}]});`);
  assert.equal(received.length, 1);
  run('party.sig.q = [];');
  // DUO has no spectators; shared-screen modes upload independently of controls.
  run(`partySendFrame({image: 'data:image/jpeg;base64,YQ=='});`);
  assert.equal(run('party.sig.q.length'), 0, 'DUO does not generate unused screen traffic');
  run("party.room.mode='lantern'; party.room.extra={actor:'a'};");
  // Start a screen upload, then send an input while the upload remains pending.
  run(`partySendFrame({image: 'data:image/jpeg;base64,YQ=='}); sigFlush();`);
  assert.equal(calls.length, 1);
  run(`party.sig.q.push({t: 'press', d: 1, l: false}); now += .1; sigFlush();`);
  assert.equal(calls.length, 2, 'screen upload cannot block an input');
  const input = calls[1]; input.resolve({ok: false, status: 0}); await tick();
  assert.equal(run('party.sig.q[0].t'), 'press', 'failed event is restored');
  run('now += .3; sigFlush();');
  assert.equal(calls[2].body.m[0].n, input.body.m[0].n, 'retry retains event identity');
  calls[2].resolve({ok: true, status: 200}); calls[0].resolve({ok: true, status: 200}); await tick();
  const payload = JSON.stringify(input.body.m);
  run(`onSig({from: 'b', round: 1, m: ${payload}}); onSig({from: 'b', round: 1, m: ${payload}});`);
  assert.equal(received.filter(m => m.type === 'press').length, 1, 'retries do not repeat a game action');
  run(`onSig({from:'b', round:1, m:[{t:'bx',d:200,l:true,n:20}]}); onSig({from:'b',round:1,m:[{t:'bx',d:100,l:true,n:19}]});`);
  assert.equal(received.filter(m => m.type === 'bx').length, 1, 'unordered old positions cannot move a player backward');
  run("onSig({from:'b',round:1,m:[{t:'bx',d:300,l:true,n:1,v:'reload'}]});");
  assert.equal(received.filter(m => m.type === 'bx').length, 2, 'reloaded peers can restart their message sequence');
  // A stale request completing after the next round cannot refill its queue.
  run(`now += .1; party.sig.q.push({t:'end',d:'win',l:false}); sigFlush();`);
  const stale = calls.at(-1);
  run('party.room.round = 2; duoCtx(party.room);');
  stale.resolve({ok:false,status:0}); await tick();
  assert.equal(run('party.sig.q.length'), 0);
  // Open a mesh in a non-DUO room: one healthy channel per remote player.
  run(`party.room.mode = 'lantern'; party.room.players.push({id:'c'}, {id:'d'}); linkSync();`);
  const sent = {b: [], c: [], d: []}; sb.sent = sent;
  run(`for (const id of ['b','c','d']) { const p = peerLink(id); p.id=id; p.state='open'; p.rx=lnow();
    p.fast={readyState:'open',bufferedAmount:0,send: raw => sent[id].push(JSON.parse(raw))};
    p.rel={readyState:'open',bufferedAmount:0,send: raw => sent[id].push(JSON.parse(raw))}; }`);
  assert.equal(run('linkUsable()'), true);
  assert.equal(run(`linkSend(2,[{t:'light',d:{x:20,y:30},l:true,n:21}]).length`), 1);
  for (const id of ['b','c','d']) assert.equal(sent[id].length, 1);
  run("peerLink('c').fast.bufferedAmount = 20000;");
  assert.equal(run(`linkSend(2,[{t:'light',d:{x:30,y:30},l:true,n:22}]).length`), 0, 'congested peer retains the batch for retry');
  run("peerLink('c').fast.bufferedAmount = 0;");
  assert.equal(run(`linkSend(2,[{t:'light',d:{x:30,y:30},l:true,n:22}]).length`), 1);
  // A quiet open link still gets probes; it must be able to become usable again.
  run("peerLink('b').rx = lnow()-3; peerLink('b').pingAt=0; linkUpdate();");
  assert.ok(sent.b.some(p => p.p !== undefined));
  run("linkRx(JSON.stringify({q:lnow()-.1}),peerLink('b'));");
  assert.equal(run('linkUsable()'), true);
  run("party.room.players[2].left=true; linkSync();");
  assert.equal(run("roomLinks.has('c')"), false, 'departed peers are removed');
  run("window.CLAUDEWARE_ICE_SERVERS=[{urls:'turn:temporary',username:'expiring-user',credential:'temporary-credential'}];");
  // ICE arriving before an offer must survive construction of the answerer's PC.
  run("linkClose(); party.you.id='z'; party.room.players=[{id:'b'},{id:'z'}];");
  await run("onLinkSig({from:'b',to:'z',k:'dice',d:{s:'session',c:{candidate:'early'}}});");
  await run("onLinkSig({from:'b',to:'z',k:'doffer',d:{s:'session',t:'offer',sdp:'offer'}});");
  assert.equal(pcs.at(-1).candidates[0].candidate, 'early');
  assert.equal(pcs.at(-1).config.iceServers[0].urls, 'turn:temporary', 'deployment ICE configuration is used');
  run("gotPong(lnow()-.2, 'relay');");
  assert.equal(run('link.via'), 'relay');
  run('linkClose();');
  assert.equal(pcs.at(-1).closed, true);
  assert.equal(run('roomLinks.size'), 0);
  console.log('party network: independent frames, retry identities, deduplication, stale positions/rounds, four-player mesh, congestion, recovery and early ICE OK');
})().catch(e => { console.error(e); process.exitCode = 1; });
