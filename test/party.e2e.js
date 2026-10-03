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

 // ---- DUO: live relay (/api/party/sig) through PocketBase's realtime broker ----
 const d=await post('create',{name:'Duo A',mode:'duo'}); ok(d.s===200&&d.j.room.mode==='duo','create duo room'); const dA=d.j.you,dcode=d.j.room.code,did=d.j.room.id;
 const dj=await post('join',{code:dcode,name:'Duo B'}); const dB=dj.j.you;
 const got={A:[],B:[]};
 // subscribe a client like js/party.js does (rooms/<id> + rooms/<id>/sig) and collect only the sig messages
 const listen=async(who)=>{const res=await fetch(B+'/api/realtime');const rd2=res.body.getReader();let bf='';(async()=>{const dd=new TextDecoder();for(;;){const {value,done}=await rd2.read();if(done)break;bf+=dd.decode(value);let i;while((i=bf.indexOf('\n\n'))>=0){const blk=bf.slice(0,i);bf=bf.slice(i+2);const f={};blk.split('\n').forEach(l=>{const k=l.indexOf(':');f[l.slice(0,k)]=l.slice(k+1).trim()});if(f.event==='PB_CONNECT')fetch(B+'/api/realtime',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:f.id,subscriptions:['rooms/'+did,'rooms/'+did+'/sig']})});else if(f.event==='rooms/'+did+'/sig')got[who].push(JSON.parse(f.data))}}})();return rd2};
 const rA=await listen('A'),rB=await listen('B'); await new Promise(r=>setTimeout(r,800));
 const sg=(who,round,m)=>post('sig',{code:dcode,id:who.id,key:who.key,round,m});
 ok((await sg(dA,0,[{t:'x',d:1}])).s===409,'sig before the round starts -> 409');
 ok((await post('start',{code:dcode,id:'a',key:dA.key})).j.room.state==='round','duo start');
 const s1=await sg(dA,0,[{t:'bx',d:123},{t:'drop',d:{id:1,x:50}}]); ok(s1.s===200&&s1.j.n>=1,'sig relayed to '+s1.j.n+' subscriber(s)');
 await new Promise(r=>setTimeout(r,500));
 ok(got.B.length===1&&got.B[0].from==='a'&&got.B[0].round===0&&got.B[0].m.length===2&&got.B[0].m[0].t==='bx'&&got.B[0].m[0].d===123,'partner B received the batch in order: '+JSON.stringify(got.B[0]||null).slice(0,120));
 await sg(dB,0,[{t:'end',d:'win'}]); await new Promise(r=>setTimeout(r,400));
 ok(got.A.some(x=>x.from==='b'&&x.m[0].t==='end'),'partner A received B\'s message');
 ok((await sg({id:'a',key:'bad'},0,[{t:'x'}])).s===403,'sig with a bad key -> 403');
 ok((await sg(dA,7,[{t:'x'}])).s===409,'sig for a stale round -> 409');
 ok((await sg(dA,0,[])).s===400,'empty sig -> 400');
 ok((await sg(dA,0,[{t:'x',d:'z'.repeat(700)}])).s===413,'oversize sig -> 413');
 ok(!JSON.stringify(got).includes(dA.key)&&!JSON.stringify(got).includes(dB.key),'no secret key ever goes through the relay');
 const dr=await (await fetch(B+'/api/collections/rooms/records/'+did)).json(); ok(!('keys' in dr),'duo room record still hides keys');
 ok(!JSON.stringify(dr).includes('"bx"'),'inputs are not stored in the room record');
 ok((await post('start',{code:dcode,id:'a',key:dA.key})).s===409,'cannot restart a running room');
 // rate limit: /api/party/sig has its own rule (1500/min per IP); the generic /api/ rule (600/min) must not hit it
 let limited=0,passed=0; const t0=Date.now(); for(let i=0;i<700;i++){const r=await fetch(B+'/api/party/sig',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:dcode,id:'a',key:dA.key,round:0,m:[{t:'p',d:i}]})}); if(r.status===429)limited++; else passed++; }
 ok(limited===0&&passed===700,'700 sig requests in '+((Date.now()-t0)/1000).toFixed(1)+'s are not rate limited (own rule)');
 let lim2=0; for(let i=0;i<900;i++){const r=await fetch(B+'/api/party/sig',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:dcode,id:'a',key:dA.key,round:0,m:[{t:'p',d:i}]})}); if(r.status===429)lim2++; }
 ok(lim2>0,'sustained flooding past 1500/min is rate limited ('+lim2+' x 429)');
 await post('leave',{code:dcode,id:'b',key:dB.key}); await post('leave',{code:dcode,id:'a',key:dA.key}); rA.cancel(); rB.cancel();
 process.exit(process.exitCode||0);
})();
