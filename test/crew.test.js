'use strict';
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : stub(), apply: () => stub(), construct: () => stub(), set: () => true });
const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout, setInterval() {}, clearInterval() {}, requestAnimationFrame() {}, addEventListener() {}, performance: { now: () => 0 },
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => stub(), addEventListener() {}, body: stub() },
  THREE: stub(), AudioContext: function () {}, Image: function () {}, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 };
sb.window = sb; vm.createContext(sb);
for (const f of ['js/i18n.js', 'js/core.js', 'js/art/crew-art.js', 'js/games/crew.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb);
vm.runInContext('globalThis.entries = REGMAP; globalThis.seed = withSeed;', sb);
const P = require('../pocketbase/pb_hooks/party.js');
for (const n of [2, 3, 4]) for (const id of ['du_wipers', 'du_spincrew', 'du_balancecrew', 'du_frogcrew', 'du_dragoncrew', 'du_bridgecrew', 'du_eggcrew']) {
  for (const sp of [1, 1.84]) for (const seed of [42, 17]) for (const missing of [false, true]) {
    let clock = 0;
    const handlers = [], queue = [], players = Array.from({length:n}, (_,role) => ({id:String(role), role}));
    const games = players.map(p => sb.seed(seed, () => sb.entries[id].fn(sp, {role:p.role, roles:n, players,
      send(t,d) { for (let j=0;j<n;j++) if(j!==p.role) queue.push({at:clock+.15,to:j,t,d,from:p.id}); }, onMsg(fn) {handlers[p.role]=fn;} })));
    for(let frame=0;frame<900;frame++) {
      clock=frame/60;
      const due=queue.filter(m=>m.at<=clock); for(let j=queue.length-1;j>=0;j--) if(queue[j].at<=clock) queue.splice(j,1); due.forEach(m=>handlers[m.to](m.t,m.d,m.from));
      games.forEach((g,r)=>{
        if(missing && r===n-1) { g.update(1/60); return; }
        if(id==='du_wipers') g.move({x:frame%2 ? 110:690,y:330});
        if(id==='du_spincrew') { if(r%2) g.key({code:'Space'}); else {const p={x:310+90*Math.cos(frame*.12),y:334+90*Math.sin(frame*.12)};if(frame===0)g.down(p);else g.move(p);} }
        if(id==='du_balancecrew') g.move({x:110+580*g.dbg.target(),y:330});
        if(id==='du_frogcrew' && Math.abs(Math.sin(g.dbg.clock()*3))<.3) g.key({code:'Space'});
        if(id==='du_bridgecrew' && Math.abs(Math.sin(g.dbg.clock()*3.5))<.3) g.down({x:400,y:330});
        if(id==='du_dragoncrew') { if(g.dbg.charge()>=.7) r%2?g.keyup({code:'Space'}):g.up(); else if(g.dbg.charge()===0) r%2?g.key({code:'Space'}):g.down({x:400,y:330}); }
        if(id==='du_eggcrew') g.move({x:110+580*g.dbg.eggX(),y:330});
        g.update(1/60);
      });
    }
    assert.ok(games.every(g=>g.result===(missing?'lose':'win')), id+' '+n+' players speed='+sp+' seed='+seed+' missing='+missing);
    games.forEach(g=>{g.draw(0);g.roles.forEach(r=>r.demo(1));});
  }
}
for(const n of [3,4]) {
 const room=P.newRoom('CREW','duo',0), rand=()=>.25;
 for(let i=0;i<n;i++) P.addPlayer(room,{name:'P'+i},rand);
 P.start(room,'a',0,rand);
 assert.ok(P.GAMES[room.game].crew);
 assert.equal(new Set(room.players.map(p=>P.roleOf(room,p.id))).size,n);
 P.sigPayload(room,'a',0,[{t:'crew_progress',d:{role:0,p:.5}}]);
 for(const p of room.players) P.report(room,p.id,0,'win',4,0,5000);
 assert.equal(room.last.teamWin,true);
 P.advance(room,0,10000,rand);
 assert.ok(P.GAMES[room.game].crew);
 P.leave(room,room.players[n-1].id,11000);
 assert.equal(room.last.final,true);
}
console.log('crew.test.js OK');
