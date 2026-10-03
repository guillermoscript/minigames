// End-to-end check of /api/party/* + realtime against a RUNNING PocketBase (see docs/HANDOFF-DUO-MODE.md for how to start one).
// Run: PB=http://127.0.0.1:8099 node test/party.e2e.js

const B=process.env.PB||'http://127.0.0.1:8099', post=async(a,b)=>{const r=await fetch(B+'/api/party/'+a,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {s:r.status,j:await r.json()}};
const ok=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{
 const c=await post('create',{name:'Ana',color:'#6EA8FE',mode:'versus'}); ok(c.s===200&&/^[A-Z2-9]{4}$/.test(c.j.room.code),'create '+JSON.stringify(c.j).slice(0,160));
 ok(!('keys' in c.j.room),'create response hides keys'); const code=c.j.room.code,id=c.j.room.id,A=c.j.you;
 // realtime
 const ev=[]; const es=await fetch(B+'/api/realtime'); const rd=es.body.getReader(); let buf=''; let cid;
 (async()=>{const d=new TextDecoder();for(;;){const {value,done}=await rd.read();if(done)break;buf+=d.decode(value);let i;while((i=buf.indexOf('\n\n'))>=0){const blk=buf.slice(0,i);buf=buf.slice(i+2);const f={};blk.split('\n').forEach(l=>{const k=l.indexOf(':');f[l.slice(0,k)]=l.slice(k+1).trim()});if(f.event==='PB_CONNECT'){cid=f.id;fetch(B+'/api/realtime',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:cid,subscriptions:['rooms/'+id]})})}else if(f.data)ev.push(JSON.parse(f.data))}}})();
 await new Promise(r=>setTimeout(r,800));
 const j=await post('join',{code:code.toLowerCase(),name:'Beto'}); ok(j.s===200&&j.j.you.id==='b','join (lowercase code) '+j.j.you?.id);
 const jr=await post('join',{code,id:j.j.you.id,key:j.j.you.key}); ok(jr.j.you.id==='b'&&jr.j.room.players.length===2,'rejoin same slot');
 ok((await post('join',{code:'ZZZZ',name:'x'})).s===404,'unknown room 404');
 ok((await post('start',{code,id:'b',key:j.j.you.key})).s===403,'non-host cannot start');
 ok((await post('start',{code,id:'a',key:'nope'})).s===403,'bad key 403');
 ok((await post('mode',{code,id:'a',key:A.key,mode:'team'})).j.room.mode==='team','host sets team mode');
 const s=await post('start',{code,id:'a',key:A.key}); ok(s.s===200&&s.j.room.state==='round'&&s.j.room.total===8,'start -> round, team total 8 game='+s.j.room.game);
 ok((await post('join',{code,name:'late'})).s===409,'join after start 409');
 await post('report',{code,id:'a',key:A.key,round:0,r:'win',t:1.2,pts:7});
 const r2=await post('report',{code,id:'b',key:j.j.you.key,round:0,r:'win',t:1.4,pts:5}); ok(r2.j.room.state==='between'&&r2.j.room.last.teamWin===true,'both report -> between, teamWin');
 ok(r2.j.room.teamScore===350,'team score 350');
 ok((await post('advance',{code,id:'a',key:A.key,round:0})).s===409,'advance too soon 409');
 await new Promise(r=>setTimeout(r,3900)); const ad=await post('advance',{code,id:'a',key:A.key,round:0}); ok(ad.j.room.state==='round'&&ad.j.room.round===1,'advance -> round 1');
 const t=await post('tick',{code}); ok(t.s===200,'tick without auth ok');
 const g=await (await fetch(B+'/api/collections/rooms/records/'+id)).json(); ok(!('keys' in g)&&g.players.length===2,'GET record by id hides keys');
 ok((await fetch(B+'/api/collections/rooms/records')).status===403||(await fetch(B+'/api/collections/rooms/records')).status===200&&false,'rooms not listable');
 ok((await fetch(B+'/api/collections/rooms/records',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"code":"XXXX"}'})).status>=400,'client cannot create rooms directly');
 console.log('realtime events:',ev.length,ev.map(e=>e.action+':'+e.record.state+'/'+e.record.round).join(' '));
 ok(ev.length>=5 && !ev.some(e=>'keys' in e.record),'realtime pushed updates, no keys');
 const L=await post('leave',{code,id:'b',key:j.j.you.key}); ok(L.s===200,'leave');
 const L2=await post('leave',{code,id:'a',key:A.key}); ok(L2.j.ok===true,'last player leaves -> room deleted');
 ok((await post('tick',{code})).s===404,'room gone');
 const inv=await fetch(B+'/r/'+code); ok(inv.status===200&&(await inv.text()).includes('?r='+code),'/r/CODE invite page');
 process.exit(process.exitCode||0);
})();
