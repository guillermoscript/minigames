// Simulador de LA FIESTA (doc 07 §10 M0.5, aceptación 1): 1000 partidas sembradas hasta el final, con invariantes en CADA acción,
// más un reporte de balance (no afirma nada: es para calibrar). Corre en paralelo con worker_threads.
// Mezcla: 4 CPU; 2 o 3 humanos jugados por la política de CPU; un humano que se duerme (AFK por strikes); una toma de asiento.
const {isMainThread,Worker,parentPort,workerData}=require('node:worker_threads');
const R=require('../docs/style-lab/fiesta-reglas.js');
const CPU=require('../docs/style-lab/fiesta-cpu.js');
const RNG=require('../docs/style-lab/fiesta-rng.js');
const M=require('../docs/style-lab/fiesta-mapa-venezuela.js');
const assert=require('node:assert');
const PARTIDAS=1000,TOPE=6000,T0=1e12;

function escenario(i){
  const h=i%4===1?2:i%4===2?3:0;
  return{h,dormido:i%20===7?'b':null,toma:i%20===11?'d':null,cfg:i%10===9?{tot:10,ronda:'relampago'}:{}};
}
function jugar(seed,esc,chequear){
  const as=[];for(let k=0;k<(esc.dormido?Math.max(2,esc.h):esc.h);k++)as.push({name:'H'+k});
  let now=T0,{S,priv}=R.crear(seed,esc.cfg,as,now),pasos=0,tomado=false;
  const lr=RNG.crear(seed*7919+1),log={fmt:{},compras:0,acciones:0};
  function paso(r,quien){
    if(r.error)throw new Error('seed '+seed+': error '+r.error+' de '+quien+' en f='+S.f+' esp='+JSON.stringify(S.esp));
    if(r.nada||r.dup)return;
    if(chequear){
      const P=R.proyectar(S,r.fx),js=JSON.stringify(r.S);
      if(JSON.stringify(P)!==js)assert.deepStrictEqual(P,r.S,'proyectar != S (seed '+seed+')');
      assert.strictEqual(r.S.ver,S.ver+1,'ver monótono');
      assert.ok(js.length<16384,'board >16KB: '+js.length);
      assert.ok(!/"(rng|semilla)":/.test(js),'el board filtra rng/semilla');
      for(const s in r.S.pj){const p=r.S.pj[s];
        assert.ok(p.mon>=0&&p.est>=0,'negativo '+s+' '+p.mon+'/'+p.est);assert.ok(M.nodos[p.nodo],'nodo inválido '+p.nodo);
        assert.ok(p.obj.length===3);}
      assert.ok(r.S.r>=0&&r.S.r<=r.S.tot);
      const E=r.S.estrella;assert.ok(M.nodos[E.nodo],'estrella.nodo inválida '+E.nodo);
      if(r.S.cfg.estrellas===1)assert.strictEqual(E.b,null,'con 1 estrella b es null');
      else{assert.ok(M.nodos[E.b],'estrella.b inválida '+E.b);assert.notStrictEqual(E.nodo,E.b,'las dos estrellas en el mismo nodo (seed '+seed+')');}
    }
    for(const f of r.fx){if(f.k==='mjIni')log.fmt[f.tipo+(f.rel?'+R':'')]=(log.fmt[f.tipo+(f.rel?'+R':'')]||0)+1;
      if(f.k==='est'&&f.por==='compra')log.compras++;}
    log.acciones++;S=r.S;priv=r.priv;
  }
  while(S.f!=='fin'){
    if(++pasos>TOPE)throw new Error('seed '+seed+': bucle infinito en f='+S.f);
    if(esc.toma&&!tomado&&S.r>=5&&S.f==='turno'){tomado=true;paso(R.aplicar(S,priv,'$',{t:'TOMAR_ASIENTO',s:esc.toma,name:'NUEVO'},now),'$');continue;}
    let hizo=false;
    for(const s of Object.keys(S.pj)){                       // humanos jugados por la política de CPU (con aid, como el cliente)
      if(S.pj[s].cpu!==null||s===esc.dormido)continue;
      const v=R.vista(S,s);if(!v.mio&&!v.listo)continue;
      const a=CPU.decide(S,v,s,lr);if(!a)continue;a.aid=s+':'+pasos;
      paso(R.aplicar(S,priv,s,a,now),s);hizo=true;break;
    }
    if(hizo)continue;
    if(S.f==='mj'){                                          // el servidor recibe el veredicto del juez
      paso(R.aplicar(S,priv,'$',{t:'MJ_RESULTADO',k:S.mj.k,i:S.mj.i,sc:S.mj.as.map(()=>lr.int(0,20))},now),'$');continue;}
    const prox=S.nextAt!=null?S.nextAt:now;now=Math.max(now,prox);
    const r=R.tick(S,priv,now);if(r.nada){now+=250;continue;}paso(r,'tick');
  }
  return{S,priv,log,pasos};
}
function lote(desde,hasta){
  const out=[];
  for(let i=desde;i<hasta;i++){
    const esc=escenario(i),g=jugar(i+1,esc,true),S=g.S;
    assert.strictEqual(S.f,'fin');assert.strictEqual(S.r,S.tot,'termina en cfg.tot');
    if(esc.dormido)assert.strictEqual(S.pj[esc.dormido].cpu,'afk','el dormido acaba cubierto por la CPU');
    if(esc.toma)assert.strictEqual(S.pj[esc.toma].name,'NUEVO');
    let hash=null;
    if(i%25===0){const g2=jugar(i+1,esc,false);assert.strictEqual(R.hash(g2.S),R.hash(S),'determinismo');assert.deepStrictEqual(g2.priv,g.priv);hash=R.hash(S);}
    out.push({i,tot:S.tot,h:esc.h,est:Object.values(S.pj).map(p=>p.est),mon:Object.values(S.pj).map(p=>p.mon),
      gan:S.podio.filter(x=>x.p===1).map(x=>S.pj[x.s].est),fmt:g.log.fmt,compras:g.log.compras,acciones:g.log.acciones,
      bytes:JSON.stringify(S).length,cpuGana:S.podio.filter(x=>x.p===1).some(x=>S.pj[x.s].cpu==='auto'),hash});
  }
  return out;
}

if(!isMainThread){
  try{parentPort.postMessage({ok:lote(workerData.desde,workerData.hasta)});}
  catch(e){parentPort.postMessage({err:String(e&&e.stack||e)});}
}else{
  const test=require('node:test'),os=require('node:os');
  test('1000 partidas sembradas: invariantes en cada acción, fin en cfg.tot, determinismo + balance',async()=>{
    const nW=Math.max(1,Math.min(8,(os.availableParallelism?os.availableParallelism():os.cpus().length)-1)),tam=Math.ceil(PARTIDAS/nW),tareas=[];
    for(let w=0;w<nW;w++){const desde=w*tam,hasta=Math.min(PARTIDAS,desde+tam);if(desde>=hasta)break;
      tareas.push(new Promise((ok,mal)=>{const wk=new Worker(__filename,{workerData:{desde,hasta}});
        wk.once('message',m=>{wk.terminate();m.err?mal(new Error(m.err)):ok(m.ok);});wk.once('error',mal);}));}
    const res=[].concat.apply([],await Promise.all(tareas));
    assert.strictEqual(res.length,PARTIDAS);
    // ───── balance (solo informa) ─────
    const q=(a,p)=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(p*b.length))];};
    const avg=a=>(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2);
    const est=[].concat.apply([],res.map(r=>r.est)),mon=[].concat.apply([],res.map(r=>r.mon)),gan=[].concat.apply([],res.map(r=>r.gan));
    const tot=res.map(r=>r.est.reduce((x,y)=>x+y,0)),fmt={};res.forEach(r=>{for(const k in r.fmt)fmt[k]=(fmt[k]||0)+r.fmt[k];});
    const histo=a=>{const h={};a.forEach(v=>h[v]=(h[v]||0)+1);return Object.keys(h).sort((x,y)=>x-y).map(k=>k+':'+h[k]).join(' ');};
    console.log('\n── BALANCE LA FIESTA (%d partidas; tot 15 salvo %d de tot 10 Relámpago) ──',res.length,res.filter(r=>r.tot===10).length);
    console.log('estrellas por jugador  media %s  p50 %d  p90 %d  máx %d   histo %s',avg(est),q(est,.5),q(est,.9),Math.max.apply(null,est),histo(est));
    console.log('estrellas del ganador  media %s  histo %s',avg(gan),histo(gan));
    console.log('estrellas por partida  media %s (compradas %s, el resto bonus/vaina)',avg(tot),avg(res.map(r=>r.compras)));
    console.log('monedas finales        media %s  p10 %d  p50 %d  p90 %d  máx %d',avg(mon),q(mon,.1),q(mon,.5),q(mon,.9),Math.max.apply(null,mon));
    console.log('formatos de minijuego  %s',JSON.stringify(fmt));
    console.log('acciones por partida   media %s  máx %d;  board final máx %d B',avg(res.map(r=>r.acciones)),Math.max.apply(null,res.map(r=>r.acciones)),Math.max.apply(null,res.map(r=>r.bytes)));
  });
}
