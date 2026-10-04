'use strict';
const assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const readers = [], blobs = [], delivered = [];
const sb = { party: { room: { id:'room', round:1, state:'round' }, you: {id:'a'} },
  FileReader: class {
    constructor() { readers.push(this); }
    readAsDataURL(blob) { this.blob = blob; }
  }, delivered,
  canvas: { toBlob(cb) { blobs.push(cb); }, toDataURL() { throw Error('synchronous encoding used'); } },
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync('js/party-modes.js','utf8'),sb);
const run = s => vm.runInContext(s,sb);
run("partyCaptureFrame(canvas,{cmd:'PLAY'},data=>delivered.push(data)); partyCaptureFrame(canvas,{},data=>delivered.push(data));");
assert.equal(blobs.length,1,'only one asynchronous encoder may run at a time');
assert.equal(delivered.length,0,'encoding returns to the game loop before delivery');
blobs.shift()({size:10});
readers[0].result='data:image/jpeg;base64,YQ=='; readers[0].onload();
assert.equal(delivered[0].cmd,'PLAY');
assert.equal(sb.canvas.partyEncoding,false);
run("partyCaptureFrame(canvas,{},data=>delivered.push(data)); party.room={id:'room',round:2,state:'round'};");
blobs.shift()({size:10}); readers[1].result='data:image/jpeg;base64,Yg=='; readers[1].onload();
assert.equal(delivered.length,1,'old encoder cannot publish into the next round');
run("partyCaptureFrame(canvas,{},data=>delivered.push(data));");
blobs.shift()(null);
assert.equal(sb.canvas.partyEncoding,false,'null blob frees encoder');
run("partyCaptureFrame(canvas,{},data=>delivered.push(data));");
blobs.shift()({size:10}); readers[2].onerror();
assert.equal(sb.canvas.partyEncoding,false,'read failure frees encoder');
run("partyCaptureFrame(canvas,{},data=>delivered.push(data)); party.room={id:'room',round:2,state:'round'};");
blobs.shift()({size:10}); readers[3].result='data:image/jpeg;base64,Yw=='; readers[3].onload();
assert.equal(delivered.length,2,'room updates in the same round do not discard valid captures');
console.log('party capture: asynchronous encoding, single encoder, stale round guards and failure recovery OK');
