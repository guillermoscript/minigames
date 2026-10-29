'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup({ delayed = false } = {}) {
  const decodes = [], starts = [], stops = [], downloads = [];
  let muted = false;
  const audio = {
    currentTime: 1, destination: {},
    decodeAudioData(bytes, success, failure) { decodes.push({ success, failure }); },
    createGain() { return { gain: { value: 0, setTargetAtTime() {} }, connect() {} }; },
    createBufferSource() {
      return { connect() {}, start() { starts.push(this.buffer); }, stop() { stops.push(this.buffer); } };
    }
  };
  const math = Object.create(Math); math.random = () => 0;
  const context = vm.createContext({
    Math: math, location: { protocol: 'https:' },
    document: { currentScript: { src: 'https://game.test/js/eggs.js?v=123' } },
    fetch: url => {
      assert.match(url, /^https:\/\/game\.test\/audio\/eggs\/[^/]+\.mp3$/);
      const response = { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
      if (!delayed) return Promise.resolve(response);
      return new Promise(resolve => downloads.push(() => resolve(response)));
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/eggs.js'), 'utf8'), context);
  const eggs = vm.runInContext('EGGS', context);
  eggs.use(() => audio, () => muted);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return { eggs, decodes, starts, stops, downloads, flush, mute() { muted = true; } };
}

test('pending decoding cannot restart clips after stop, mute or a new microgame', async () => {
  for (const action of ['stop', 'mute', 'begin']) {
    const h = setup(); h.eggs.begin('hello'); await h.flush();
    assert.equal(h.eggs.play('heavenly'), true);
    if (action === 'stop') h.eggs.stop();
    if (action === 'mute') h.mute();
    if (action === 'begin') h.eggs.begin('hello');
    h.decodes[0].success('old clip');
    assert.deepEqual(h.starts, [], action);
  }
});

test('a newer clip wins even when decoding completes in reverse order', async () => {
  const h = setup(); h.eggs.begin('hello'); await h.flush();
  h.eggs.play('heavenly'); h.eggs.play('correct');
  h.decodes[1].success('correct'); h.decodes[0].success('heavenly');
  assert.deepEqual(h.starts, ['correct']);
  assert.equal(h.eggs.song(), false);
  h.eggs.play('heavenly');
  assert.deepEqual(h.starts, ['correct', 'heavenly']);
  assert.deepEqual(h.stops, ['correct']);
  assert.equal(h.eggs.song(), true);
  h.eggs.stop(); assert.equal(h.eggs.song(), false);
});

test('stopping cancels an opening clip whose download is still pending', async () => {
  const h = setup({ delayed: true });
  h.eggs.begin('pique'); h.eggs.stop();
  h.downloads.forEach(resolve => resolve()); await h.flush();
  assert.equal(h.decodes.length, 0);
  assert.deepEqual(h.starts, []);
});

test('failed decoding can be retried and missing clips are optional', async () => {
  const h = setup(); h.eggs.begin('hello'); await h.flush();
  assert.equal(h.eggs.play('missing'), false);
  assert.equal(h.eggs.play('correct'), true); h.decodes[0].failure();
  assert.equal(h.eggs.play('correct'), true); h.decodes[1].success('correct');
  assert.deepEqual(h.starts, ['correct']);
});

test('winning the bus driving game uses a normal win clip, without Goku', async () => {
  const h=setup();h.eggs.begin('hueco');await h.flush();
  h.eggs.outcome('hueco','win');
  assert.equal(h.decodes.length,1);
  h.decodes[0].success('win clip');
  assert.equal(h.eggs.song(),false,'Goku is a song; the driving game should play a regular win effect');
  assert.deepEqual(h.starts,['win clip']);
  // Other dodging games keep their existing celebration.
  h.eggs.stage();h.eggs.begin('sw_limbo');h.eggs.outcome('sw_limbo','win');
  h.decodes[1].success('dodge clip');
  assert.equal(h.eggs.song(),true);
});

test('a clip plays once per stage, and becomes available on a new attempt', async () => {
  const h=setup();h.eggs.stage();h.eggs.begin('hello');await h.flush();
  assert.equal(h.eggs.play('alert'),true);
  assert.equal(h.eggs.play('alert'),false,'pending clip is reserved');
  h.decodes[0].success('alert');
  h.eggs.begin('hello');assert.equal(h.eggs.play('alert'),false);
  h.eggs.stage();assert.equal(h.eggs.play('alert'),true);
  assert.deepEqual(h.starts,['alert','alert']);
});

test('only one win and one loss egg can play in a stage, including stage clear', async () => {
  const h=setup();h.eggs.stage();h.eggs.begin('hello');await h.flush();
  h.eggs.outcome('hello','win');h.eggs.outcome('whack','win');
  assert.equal(h.decodes.length,1);
  h.decodes[0].success('win');
  h.eggs.begin('catch');h.eggs.outcome('catch','win');h.eggs.clear(true);
  assert.equal(h.decodes.length,1);
  h.eggs.begin('hello');h.eggs.outcome('hello','lose');
  h.decodes[1].success('lose');
  h.eggs.begin('whack');h.eggs.outcome('whack','lose');
  assert.equal(h.decodes.length,2);
  assert.deepEqual(h.starts,['win','lose']);
});

test('winning music and the outcome share the same exclusive win slot', async () => {
  const h=setup();h.eggs.stage();h.eggs.begin('pendrive');await h.flush();
  assert.equal(h.eggs.music(),true);h.eggs.outcome('pendrive','win');
  assert.equal(h.decodes.length,1);h.decodes[0].success('song');
  h.eggs.begin('anuncio');assert.equal(h.eggs.music(),false);h.eggs.outcome('anuncio','win');
  assert.equal(h.decodes.length,1);
});

test('cancellation and failed decoding leave the stage slots available', async () => {
  const h=setup();h.eggs.stage();h.eggs.begin('hello');await h.flush();
  h.eggs.outcome('hello','win');h.eggs.begin('hello');h.decodes[0].success('cancelled');
  h.eggs.outcome('hello','win');assert.deepEqual(h.starts,['cancelled']);
  h.eggs.stage();h.eggs.begin('hello');h.eggs.outcome('hello','lose');
  h.decodes[1].failure();h.eggs.begin('hello');h.eggs.outcome('hello','lose');
  h.decodes[2].success('lose');assert.deepEqual(h.starts,['cancelled','lose']);
});

test('the visual sticker appears only after playback and expires', async () => {
  const h=setup();h.eggs.begin('hello');await h.flush();
  const labels=[],x={save(){},restore(){},translate(){},rotate(){},scale(){},fillRect(){},strokeRect(){},fillText(s){labels.push(s);}};
  h.eggs.play('alert');h.eggs.draw(x,800,true);assert.deepEqual(labels,[]);
  h.decodes[0].success('alert');h.eggs.draw(x,800,true);
  assert.deepEqual(labels,['★ EASTER EGG ★','¡VERSIÓN ESPECIAL!']);
  labels.length=0;h.eggs.update(2.1);h.eggs.draw(x);assert.deepEqual(labels,[]);
});
