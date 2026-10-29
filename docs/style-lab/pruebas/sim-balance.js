// LA FIESTA · simulador de BALANCE de la economía y el tablero (Área 6, doc 06 §10.2). Node puro, solo lee el reductor.
//
//   node docs/style-lab/pruebas/sim-balance.js                      # 10 000 partidas por escenario, tabla meta-vs-resultado
//   node docs/style-lab/pruebas/sim-balance.js --partidas=2000      # corrida rápida
//   node docs/style-lab/pruebas/sim-balance.js --cfg=precio:15      # barrido: cualquier campo de CFG0 (precio, mon0, tot, tasa…)
//   node docs/style-lab/pruebas/sim-balance.js --json               # además imprime el JSON crudo
//   node docs/style-lab/pruebas/sim-balance.js --preset=base      # preset de sim-balance-parches.js (el 'base' va vacío: el reductor real)
//   SIM_VARIANTES=estrella-cerca node …   # prueba parches del reductor (sim-balance-parches.js) sin tocar fiesta-reglas.js
//
// Cada partida es una partida COMPLETA del reductor real (crear/aplicar/tick), con 4 asientos "humanos" movidos por una POLÍTICA:
//   azar    decide el tablero al azar (sembrado) y juega los minijuegos sin destreza (skill 0)
//   chamo   fiesta-cpu nivel 1 (se equivoca 35 %)          pana  nivel 2 (12 %)          arrecho  nivel 3 (nunca)
// Los minijuegos no se juegan: el veredicto sale de score = N(skill, 1) por asiento (modelo de habilidad, SKILL abajo) y el reductor
// reparte monedas/duelos/bonus exactamente como en producción. Sin Math.random: todo sale de fiesta-rng sembrado (misma semilla = misma partida).
// Escenarios (cada uno con su N de partidas):
//   igual     4 × pana        estructura de la economía: estrellas, bonus, líder, monedas, decisiones, duración, remontada
//   habilidad 1 pana + 3 chamo   la meta de doc 06 "Pana vs 3 Chamo" (40-55 %)
//   azarvs    1 arrecho + 3 azar   cuánto vale jugar bien frente a jugar sin cabeza
//   azar      4 × azar        línea base de pura suerte (el reparto debe quedar cerca de 1/4)
'use strict';
const {isMainThread,Worker,parentPort,workerData}=require('node:worker_threads');
const os=require('node:os');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const DIR=path.join(__dirname,'..');
const PRE_ARG=process.argv.find(x=>x.indexOf('--preset=')===0);
const PRESET=PRE_ARG?require('./sim-balance-parches.js').PRESETS[PRE_ARG.slice(9)]:null;
if(PRE_ARG&&!PRESET)throw new Error('preset desconocido: '+PRE_ARG);
const VARIANTES=(workerData&&workerData.variantes)||(PRESET?PRESET.variantes:(process.env.SIM_VARIANTES?process.env.SIM_VARIANTES.split(','):[]));
// Variantes del reductor: PARCHES de texto sobre fiesta-reglas.js, aplicados en memoria (el archivo de Area 1 no se toca).
// Cada parche es {ancla, por}; si el ancla no existe el simulador falla en voz alta. Son la especificación de cambios para la fase 2.
const PARCHES=require('./sim-balance-parches.js');
function cargarReglas(vs){
  if(!vs.length)return require('../fiesta-reglas.js');
  let src=fs.readFileSync(path.join(DIR,'fiesta-reglas.js'),'utf8');
  vs.forEach(v=>{const p=PARCHES[v];if(!p)throw new Error('variante desconocida: '+v);
    p.forEach(x=>{if(src.indexOf(x.ancla)<0)throw new Error('variante '+v+': ancla no encontrada ('+x.ancla.slice(0,60)+'). Si ese cambio ya está integrado en fiesta-reglas.js, la variante quedó obsoleta: quítala de --variantes/SIM_VARIANTES');src=src.split(x.ancla).join(x.por);});});
  const fn=path.join(DIR,'fiesta-reglas.variante.js'),m=new Module(fn,null);m.filename=fn;m.paths=Module._nodeModulePaths(DIR);m._compile(src,fn);return m.exports;
}
let R;try{R=cargarReglas(VARIANTES);}catch(e){console.error('[sim-balance] '+e.message);process.exit(2);}   // variante obsoleta: se explica y se sale, sin traza
const CPU=require('../fiesta-cpu.js');
const RNG=require('../fiesta-rng.js');

// Habilidad en minijuegos (desviaciones estándar sobre un rival de 0): modelo, ajustable.
const SKILL={azar:0,chamo:0.25,pana:0.5,arrecho:0.9};
const NIVEL={chamo:1,pana:2,arrecho:3};
// Tiempos nominales (ms) para estimar la duración que vería una mesa humana (animaciones del reductor + pensar + minijuegos).
const PIENSA={DADO:2500,RUTA:4000,TIENDA:6000,ESTRELLA:3000,OBJETIVO:3000,COMMIT:4000};
const MJ_FIJO={carta:8000,cuenta:3500,cierre:2500,res:5000};     // carta leída en ~8 s con humanos (todos LISTO)
const MIN_FIN_TEMPRANO=0.85;                                    // fracción de dur que dura un juego con finTemprano
const TOPE=8000,T0=1e12;

/* ───── política ───── */
function gauss(r){let u=r.next();if(u<1e-12)u=1e-12;return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r.next());}
function azar(S,v,s,r){
  if(!v.mio)return v.listo?{t:'LISTO'}:null;
  const e=v.esp;
  if(e.k==='COMMIT')return{t:'COMMIT',k:e.c,eid:e.id};
  if(e.k==='DADO'){const it=e.opc.filter(o=>typeof o==='object');
    if(it.length&&r.next()<0.3){const x=r.pick(it),a={t:'USAR',slot:x.slot,eid:e.id};if(x.bl)a.a=r.pick(x.bl);if(x.o==='medida')a.n=r.int(1,10);return a;}
    return{t:'TIRAR',eid:e.id};}
  if(e.k==='RUTA')return{t:'RUTA',a:r.pick(e.opc.filter(o=>o.ok)).a,eid:e.id};
  if(e.k==='ESTRELLA')return{t:'ESTRELLA',si:r.next()<0.5,eid:e.id};
  if(e.k==='TIENDA')return{t:'COMPRAR',item:e.opc.length&&r.next()<0.5?r.pick(e.opc).item:null,eid:e.id};
  if(e.k==='OBJETIVO')return{t:'OBJETIVO',a:r.pick(e.opc),eid:e.id};
  return null;
}
function decide(pol,S,v,s,r){
  if(pol==='azar')return azar(S,v,s,r);
  const S2=Object.assign({},S,{cfg:Object.assign({},S.cfg,{cpuNivel:NIVEL[pol]})});   // el nivel de la CPU lo lee S.cfg
  return CPU.decide(S2,v,s,r);
}

/* ───── una partida ───── */
function jugar(seed,pols,cfg){
  const as=pols.map((p,i)=>({name:'P'+i}));
  let now=T0,{S,priv}=R.crear(seed,cfg,as,now),pasos=0,ms=0;
  const rp=RNG.crear(seed*7919+1),rs=RNG.crear(seed*104729+3);                    // rp = decisiones, rs = destreza en minijuegos
  const seats=Object.keys(S.pj);
  const pol={};seats.forEach((s,i)=>{pol[s]=pols[i];});
  const g={compras:0,estPorCompra:0,dec:0,turnos:0,racha0:{},rachaMax:{},ult8:null,lider10:null,preFinal:null,fmt:{},
    mjPorPuesto:[0,0,0,0],ganMJ:{},ataques:0,tiendas:0,sueltas:0};
  seats.forEach(s=>{g.racha0[s]=0;g.rachaMax[s]=0;});
  let decTurno=false;
  function dur(){const mj=S.mj,q=mj.cola[mj.i],cat=R.CATALOGO.filter(c=>c.g===q.g)[0];
    return MJ_FIJO.carta+MJ_FIJO.cuenta+q.dur*1000*(cat&&cat.lim&&cat.lim.finTemprano?MIN_FIN_TEMPRANO:1)+MJ_FIJO.cierre+MJ_FIJO.res;}
  function paso(r){
    if(r.error)throw new Error('seed '+seed+': error '+r.error+' f='+S.f+' esp='+JSON.stringify(S.esp));
    if(r.nada||r.dup)return;
    ms+=R.fxMs(r.fx);
    for(const f of r.fx){
      if(f.k==='turno'){
        if(g.turnos>0&&!decTurno)g.sinDec=(g.sinDec||0)+1;
        g.turnos++;decTurno=false;
        const m=r.S.pj[f.s].mon;g.racha0[f.s]=m===0?g.racha0[f.s]+1:0;if(g.racha0[f.s]>g.rachaMax[f.s])g.rachaMax[f.s]=g.racha0[f.s];
      }
      else if(f.k==='est'&&f.por==='compra'){g.compras++;(g.rondasCompra=g.rondasCompra||[]).push(r.S.r);}
      else if(f.k==='estrellaMueve'){(g.mueve=g.mueve||[]).push(r.S.r);}
      else if(f.k==='ataque')g.ataques++;
      else if(f.k==='mjIni'){const k=f.tipo+(f.rel?'+R':'');g.fmt[k]=(g.fmt[k]||0)+1;}
      else if(f.k==='obj'&&f.que==='compra')g.tiendas++;
    }
    const e=r.S.esp;
    if(e&&e.k&&e.s!=='*'&&r.S.f==='turno'&&(e.k==='RUTA'||e.k==='TIENDA'||e.k==='ESTRELLA'||e.k==='OBJETIVO'||(e.k==='DADO'&&e.opc.length>1)))decTurno=true;
    if(g.ult8===null&&r.S.f==='turno'&&r.S.r===9){                       // foto al empezar la ronda 9 = fin de la 8
      const rk=R.rango(r.S),p=rk.map(s=>r.S.pj[s]),last=p[p.length-1],emp=rk.filter((s,i)=>r.S.pj[s].est===last.est&&r.S.pj[s].mon===last.mon);
      g.ult8=emp;}
    if(g.lider10===null&&r.S.f==='turno'&&r.S.r===11){const rk=R.rango(r.S),a=r.S.pj[rk[0]],emp=rk.filter(s=>r.S.pj[s].est===a.est&&r.S.pj[s].mon===a.mon);g.lider10=emp;}
    if(r.S.f==='final'&&g.preFinal===null){                               // el estado ANTES del bonus (S sigue siendo el de 'res')
      const rk=R.rango(S),a=S.pj[rk[0]],emp=rk.filter(s=>S.pj[s].est===a.est&&S.pj[s].mon===a.mon);
      g.preFinal={gan:emp,est:S.pj[rk[0]].est};}
    S=r.S;priv=r.priv;
  }
  while(S.f!=='fin'){
    if(++pasos>TOPE)throw new Error('seed '+seed+': bucle en f='+S.f);
    let hizo=false;
    for(const s of seats){
      const v=R.vista(S,s);if(!v.mio&&!v.listo)continue;
      const a=decide(pol[s],S,v,s,rp);if(!a)continue;
      if(v.mio&&v.esp&&PIENSA[v.esp.k])ms+=PIENSA[v.esp.k];
      a.aid=s+':'+pasos;paso(R.aplicar(S,priv,s,a,now));hizo=true;break;
    }
    if(hizo)continue;
    if(S.f==='mj'){
      ms+=dur();
      const sc=S.mj.as.map(s=>SKILL[pol[s]]+gauss(rs));
      paso(R.aplicar(S,priv,'$',{t:'MJ_RESULTADO',k:S.mj.k,i:S.mj.i,sc},now));continue;}
    const prox=S.nextAt!=null?S.nextAt:now;now=Math.max(now,prox);
    const r=R.tick(S,priv,now);if(r.nada){now+=250;continue;}
    paso(r);
  }
  if(!decTurno)g.sinDec=(g.sinDec||0)+1;
  const win=S.podio.filter(x=>x.p===1).map(x=>x.s);
  return{seed,tot:S.tot,min:ms/60000,pols:pols.join(','),seats,pol,win,g,
    mon:seats.map(s=>S.pj[s].mon),est:seats.map(s=>S.pj[s].est),podio:S.podio.map(x=>x.s),
    cambia:g.preFinal?g.preFinal.gan.filter(x=>win.indexOf(x)>=0).length===0:false,
    sueltasFin:Object.keys(S.tab.sueltas).length};
}

/* ───── escenarios ───── */
const ESC={
  igual:     {n:'igual',     pols:['pana','pana','pana','pana'],       rot:false},
  habilidad: {n:'habilidad', pols:['pana','chamo','chamo','chamo'],     rot:true},
  azarvs:    {n:'azarvs',    pols:['arrecho','azar','azar','azar'],     rot:true},
  azar:      {n:'azar',      pols:['azar','azar','azar','azar'],        rot:false}
};
function lote(esc,desde,hasta,cfg){
  const out=[];
  for(let i=desde;i<hasta;i++){
    let p=ESC[esc].pols.slice();
    if(ESC[esc].rot){const k=i%4;p=p.slice(k).concat(p.slice(0,k));}          // el hábil rota de asiento (el orden de turno ya es aleatorio)
    const g=jugar(i+1,p,cfg);
    out.push(g);
  }
  return out;
}

if(!isMainThread){
  try{parentPort.postMessage({ok:lote(workerData.esc,workerData.desde,workerData.hasta,workerData.cfg)});}
  catch(e){parentPort.postMessage({err:String(e&&e.stack||e)});}
}else if(require.main===module)main();
module.exports={jugar,lote,ESC,SKILL};

/* ───── agregación ───── */
function corre(esc,N,cfg){
  const nW=Math.max(1,Math.min(8,(os.availableParallelism?os.availableParallelism():os.cpus().length)-1)),tam=Math.ceil(N/nW),tareas=[];
  for(let w=0;w<nW;w++){const desde=w*tam,hasta=Math.min(N,desde+tam);if(desde>=hasta)break;
    tareas.push(new Promise((ok,mal)=>{const wk=new Worker(__filename,{workerData:{esc,desde,hasta,cfg,variantes:VARIANTES}});
      wk.once('message',m=>{wk.terminate();m.err?mal(new Error(m.err)):ok(m.ok);});wk.once('error',mal);}));}
  return Promise.all(tareas).then(a=>[].concat.apply([],a));
}
const sum=a=>a.reduce((x,y)=>x+y,0),avg=a=>sum(a)/Math.max(1,a.length);
const pct=(a,b)=>100*a/Math.max(1,b);
function ic(p,n){const e=1.96*Math.sqrt(p*(1-p)/n);return[100*(p-e),100*(p+e)];}      // Wilson simple, p en [0,1]
function metricas(res){
  const n=res.length,m={n};
  m.estrellasPartida=avg(res.map(r=>r.g.compras));
  m.estGanadorPre=avg(res.map(r=>r.g.preFinal?r.g.preFinal.est:0));
  m.bonusCambia=pct(res.filter(r=>r.cambia).length,n);
  let lid=0,ult=0;
  res.forEach(r=>{const w=r.win;
    if(r.g.lider10){const hit=r.g.lider10.filter(s=>w.indexOf(s)>=0).length;lid+=hit/(r.g.lider10.length*w.length);}
    if(r.g.ult8){const hit=r.g.ult8.filter(s=>w.indexOf(s)>=0).length;ult+=hit/(r.g.ult8.length);}});
  m.lider10Gana=pct(lid,n);m.ultimo8Gana=pct(ult,n);
  m.monFin=avg([].concat.apply([],res.map(r=>r.mon)));
  m.monFinP90=(()=>{const a=[].concat.apply([],res.map(r=>r.mon)).sort((x,y)=>x-y);return a[Math.floor(.9*a.length)];})();
  m.sinDec=pct(sum(res.map(r=>r.g.sinDec||0)),sum(res.map(r=>r.g.turnos)));
  const jug=sum(res.map(r=>r.seats.length));
  m.racha0=pct(sum(res.map(r=>r.seats.filter(s=>r.g.rachaMax[s]>=3).length)),jug);
  m.min=avg(res.map(r=>r.min));m.minP90=res.map(r=>r.min).sort((x,y)=>x-y)[Math.floor(.9*n)];
  m.ataques=avg(res.map(r=>r.g.ataques));m.compras=avg(res.map(r=>r.g.tiendas));
  m.estFin=avg([].concat.apply([],res.map(r=>r.est)));
  m.empateGan=pct(res.filter(r=>r.win.length>1).length,n);
  return m;
}
function cuota(res,quien){                                            // % de partidas que gana el asiento con política 'quien' (reparto de empates)
  let w=0,c=0;res.forEach(r=>{const seats=r.seats.filter(s=>r.pol[s]===quien);if(seats.length!==1)return;c++;if(r.win.indexOf(seats[0])>=0)w+=1/r.win.length;});
  return{p:w/Math.max(1,c),n:c};
}

/* ───── metas (doc 06 §10.2; la de remontada la propone esta área, doc 06 no da una) ───── */
const METAS=[
  ['Estrellas compradas por partida (4 jugadores, 15 turnos)','8 – 14',        m=>m.estrellasPartida,8,14,2],
  ['Estrellas del ganador antes del bonus','3 – 6',                              m=>m.estGanadorPre,3,6,2],
  ['% partidas donde el bonus cambia al ganador','15 – 30 %',                    m=>m.bonusCambia,15,30,1],
  ['% ganadas por el líder tras la ronda 10','45 – 65 %',                        m=>m.lider10Gana,45,65,1],
  ['Monedas medias al final','10 – 40',                                          m=>m.monFin,10,40,1],
  ['Turnos con 0 decisiones','< 35 %',                                           m=>m.sinDec,0,35,1],
  ['Jugadores con 3+ turnos seguidos en 0 monedas','< 5 %',                      m=>m.racha0,0,5,1],
  ['Duración simulada, media (min)','25 – 40 (brief: ≤ 45)',                     m=>m.min,25,40,1],
  ['REMONTADA · el último tras la ronda 8 gana','≥ 12 % (propuesta)',            m=>m.ultimo8Gana,12,100,1]
];
const f1=x=>(Math.round(x*10)/10).toFixed(1);

async function main(){
  const arg=k=>{const a=process.argv.find(x=>x.indexOf('--'+k+'=')===0);return a?a.slice(k.length+3):null;};
  const N=+(arg('partidas')||10000),json=process.argv.indexOf('--json')>=0,cfg={};
  (arg('cfg')||'').split(',').filter(Boolean).forEach(kv=>{const p=kv.split(':');cfg[p[0]]=isNaN(+p[1])?p[1]:+p[1];});
  if(PRESET)Object.assign(cfg,PRESET.cfg,cfg);
  const t0=Date.now(),R_={};
  const solo=(arg('esc')||Object.keys(ESC).join(',')).split(',');
  for(const e of solo)R_[e]=await corre(e,N,cfg);
  const M={};for(const e of Object.keys(R_))M[e]=metricas(R_[e]);
  const m=M.igual,L=[];
  if(process.argv.indexOf('--linea')>=0){console.log(['cfg '+JSON.stringify(cfg),'var '+VARIANTES.join('+'),'est/partida '+f1(m.estrellasPartida),'ganPre '+f1(m.estGanadorPre),'bonus '+f1(m.bonusCambia)+'%','lider10 '+f1(m.lider10Gana)+'%','ult8 '+f1(m.ultimo8Gana)+'%','$fin '+f1(m.monFin),'sinDec '+f1(m.sinDec)+'%','cero3 '+f1(m.racha0)+'%','min '+f1(m.min)].join(' · '));return;}
  L.push('');L.push('LA FIESTA · balance de la economía · '+N+' partidas por escenario · cfg '+JSON.stringify(Object.assign({},R.CFG0,cfg))+(VARIANTES.length?' · variantes '+VARIANTES.join('+'):'')+' · '+((Date.now()-t0)/1000).toFixed(0)+' s');
  L.push('');L.push('| Métrica (escenario "igual": 4 × pana) | Meta | Resultado | ¿Cumple? |');L.push('|---|---|---|---|');
  let fallan=0;
  METAS.forEach(x=>{const v=x[2](m),ok=v>=x[3]&&v<=x[4];if(!ok)fallan++;L.push('| '+x[0]+' | '+x[1]+' | '+f1(v)+' | '+(ok?'sí':'**NO**')+' |');});
  if(solo.length<Object.keys(ESC).length){console.log(L.join('\n'));console.log('\n(--esc parcial: sin filas de habilidad ni línea base)');return;}
  const hab=cuota(R_.habilidad,'pana'),arr=cuota(R_.azarvs,'arrecho');
  const sg=(c,lo,hi)=>{const [a,b]=ic(c.p,c.n);return{a,b,ok:c.p*100>=lo&&c.p*100<=hi};};
  const h=sg(hab,40,55),r=sg(arr,0,100);
  L.push('| Pana vs 3 Chamo: % que gana el Pana (n='+hab.n+', IC95 '+f1(h.a)+'–'+f1(h.b)+') | 40 – 55 % | '+f1(hab.p*100)+' | '+(h.ok?'sí':'**NO**')+' |');
  L.push('| Habilidad: Arrecho vs 3 Azar, % que gana el Arrecho (n='+arr.n+', IC95 '+f1(r.a)+'–'+f1(r.b)+') | > 25 % con claridad (azar puro = 25 %) | '+f1(arr.p*100)+' | '+(r.a>25?'sí':'**NO**')+' |');
  if(!h.ok)fallan++;if(!(r.a>25))fallan++;
  const z=cuota(R_.azar,'azar');
  L.push('');L.push('Línea base de suerte (4 × azar): reparto de victorias por asiento — se espera ~25 % cada uno.');
  const rep={};R_.azar.forEach(x=>{x.win.forEach(s=>{rep[s]=(rep[s]||0)+1/x.win.length;});});
  L.push('  '+Object.keys(rep).sort().map(s=>s+' '+f1(100*rep[s]/R_.azar.length)+' %').join('  '));
  L.push('');L.push('Datos extra (escenario igual): estrellas finales por jugador '+f1(m.estFin)+' · monedas fin p90 '+m.monFinP90+' · duración p90 '+f1(m.minP90)+' min · ataques/partida '+f1(m.ataques)+' · compras en tienda/partida '+f1(m.compras)+' · empates en 1.º '+f1(m.empateGan)+' %');
  L.push('Otros escenarios: duración habilidad '+f1(M.habilidad.min)+' min · azarvs '+f1(M.azarvs.min)+' min · azar '+f1(M.azar.min)+' min · azar: monedas fin '+f1(M.azar.monFin)+', estrellas/partida '+f1(M.azar.estrellasPartida)+', último-r8 gana '+f1(M.azar.ultimo8Gana)+' %');
  L.push('');L.push(fallan?fallan+' métrica(s) fuera de meta.':'Todas las metas cumplidas.');
  console.log(L.join('\n'));
  if(json)console.log(JSON.stringify(M,null,1));
  process.exitCode=0;
}
