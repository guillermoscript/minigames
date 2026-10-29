// Reglas de LA FIESTA (reductor puro, doc 07 §3-4): una prueba por regla.
const test=require('node:test'),assert=require('node:assert');
const fs=require('node:fs'),path=require('node:path');
const R=require('../docs/style-lab/fiesta-reglas.js');
const CPU=require('../docs/style-lab/fiesta-cpu.js');
const M=require('../docs/style-lab/fiesta-mapa-venezuela.js');
const NOW=1e12;
const J=x=>JSON.parse(JSON.stringify(x));

// Partida con 2 humanos (a, b) + 2 CPU, ya en la ronda 1 con el orden revelado.
function arrancar(cfg){
  let {S,priv}=R.crear(7,cfg||{},[{name:'ANA',ch:'mama'},{name:'BETO',ch:'tio'}],NOW);
  let r=R.aplicar(S,priv,'a',{t:'COMMIT',k:'orden',eid:S.esp.id,aid:'o1'},NOW);assert.ifError(r.error);
  r=R.aplicar(r.S,r.priv,'b',{t:'COMMIT',k:'orden',eid:r.S.esp.id,aid:'o2'},NOW);assert.ifError(r.error);
  return r;
}
// Fuerza que sea el turno de `s` en el nodo dado, con un aviso DADO fresco (el estado es JSON plano).
function turnoDe(base,s,nodo,mods){
  const S=J(base.S),P=J(base.priv);
  S.f='turno';S.mj=null;S.pj[s].nodo=nodo;S.pj[s].obj=['medida',null,null];
  S.t={s,paso:'pre',resto:0,usado:0,mod:null,pend:[],cas:0,compro:0,compras:0,desde:nodo};
  S.esp={id:S.ver,s,k:'DADO',opc:['TIRAR'],hasta:NOW+20000};
  S.estrella.nodo='roq_cayoagua';
  if(mods)mods(S,P);
  return {S,priv:P};
}
// Avanza exactamente n casillas con el Dado a la Medida (slot 0).
function mover(st,s,n){
  let r=R.aplicar(st.S,st.priv,s,{t:'USAR',slot:0,n,eid:st.S.esp.id},NOW);assert.ifError(r.error);
  const r2=R.aplicar(r.S,r.priv,s,{t:'TIRAR',eid:r.S.esp.id},NOW);assert.ifError(r2.error);
  r2.fx=r.fx.concat(r2.fx);return r2;
}
function claves(o,out){if(o&&typeof o==='object'){for(const k of Object.keys(o)){out.add(k);claves(o[k],out);}}return out;}

test('crear: 4 asientos, relleno con CPU, personajes únicos, board sin rng ni semilla',()=>{
  const {S,priv}=R.crear(5,{},[{name:'ANA',ch:'mama'},{name:'BETO',ch:'mama'}],NOW);
  assert.deepStrictEqual(Object.keys(S.pj),['a','b','c','d']);
  const chs=Object.values(S.pj).map(p=>p.ch);assert.strictEqual(new Set(chs).size,4);
  assert.strictEqual(S.pj.a.ch,'mama');assert.notStrictEqual(S.pj.b.ch,'mama');
  assert.strictEqual(S.pj.a.cpu,null);assert.strictEqual(S.pj.c.cpu,'auto');assert.match(S.pj.c.name,/^CPU · /);
  for(const p of Object.values(S.pj)){assert.strictEqual(p.mon,20);assert.strictEqual(p.est,0);assert.strictEqual(p.nodo,'ccs_start');}
  assert.strictEqual(S.f,'orden');assert.deepStrictEqual(S.esp.quien,['a','b']);assert.strictEqual(S.cfg.reglas,'caos');assert.strictEqual(S.cfg.ronda,'clasica');
  const k=claves(S,new Set());assert.ok(!k.has('rng')&&!k.has('semilla'));
  assert.ok(typeof priv.rng==='number'&&priv.semilla===5);
  assert.ok(['ccs_galipan','coc_puertocolombia','moc_mochima'].includes(S.estrella.nodo));
  assert.strictEqual(S.estrella.precio,10);assert.strictEqual(S.cfg.estrellas,2);
});
test('crear: misma semilla => mismo estado; rechaza tamaños inválidos',()=>{
  assert.deepStrictEqual(R.crear(9,{},[],NOW),R.crear(9,{},[],NOW));
  assert.throws(()=>R.crear(1,{n:5}));assert.throws(()=>R.crear(1,{n:1}));
  assert.strictEqual(Object.keys(R.crear(1,{n:2},[{name:'X'}]).S.pj).length,2);
});
test('orden (D5): commit oculto, valores 1-10 distintos, se revela y queda fijo',()=>{
  let {S,priv}=R.crear(7,{},[{name:'A'},{name:'B'}],NOW);
  const r1=R.aplicar(S,priv,'a',{t:'COMMIT',k:'orden',eid:S.esp.id},NOW);
  assert.ifError(r1.error);assert.strictEqual(r1.S.f,'orden');assert.strictEqual(r1.S.esp.hecho.a,1);
  assert.ok(r1.priv.c.orden.a>=1);assert.ok(!JSON.stringify(r1.fx).includes('"de":"orden"'),'no se revela antes de tiempo');
  assert.strictEqual(R.vista(r1.S,'a',r1.priv).priv.orden,r1.priv.c.orden.a);
  assert.strictEqual(R.aplicar(r1.S,r1.priv,'c',{t:'COMMIT',k:'orden'},NOW).error,'turno');
  const r2=R.aplicar(r1.S,r1.priv,'b',{t:'COMMIT',k:'orden'},NOW);
  const dados=r2.fx.filter(f=>f.k==='dado'&&f.de==='orden');assert.strictEqual(dados.length,4);
  const v=dados.map(f=>f.v);assert.strictEqual(new Set(v).size,4);assert.ok(v.every(x=>x>=1&&x<=10));
  const ord=dados.slice().sort((x,y)=>y.v-x.v).map(f=>f.s);assert.deepStrictEqual(r2.S.orden,ord);
  assert.strictEqual(r2.S.f,'turno');assert.strictEqual(r2.S.r,1);assert.strictEqual(r2.S.t.s,ord[0]);
  // sin humanos: el tick revela solo
  const c=R.crear(3,{},[],NOW),t=R.tick(c.S,c.priv,NOW);assert.strictEqual(t.S.f,'turno');assert.strictEqual(t.S.orden.length,4);
});
test('asiento equivocado => turno (403); eid viejo => eid (409); ver viejo => ver; S intacto',()=>{
  const st=turnoDe(arrancar(),'a','ccs_petare');
  const mal=R.aplicar(st.S,st.priv,'b',{t:'TIRAR',eid:st.S.esp.id},NOW);assert.strictEqual(mal.error,'turno');assert.strictEqual(mal.S,st.S);
  const viejo=R.aplicar(st.S,st.priv,'a',{t:'TIRAR',eid:st.S.esp.id-1},NOW);assert.strictEqual(viejo.error,'eid');assert.strictEqual(viejo.fx.length,0);
  const ver=R.aplicar(st.S,st.priv,'a',{t:'TIRAR',ver:st.S.ver-1},NOW);assert.strictEqual(ver.error,'ver');
  const cpu=R.aplicar(st.S,st.priv,'a',{t:'NADA'},NOW);assert.strictEqual(cpu.error,'accion');
  const st2=turnoDe(arrancar(),'c','ccs_petare');assert.strictEqual(R.aplicar(st2.S,st2.priv,'c',{t:'TIRAR'},NOW).error,'cpu');
});
test('aid idempotente: el mismo aid no se reaplica',()=>{
  const st=turnoDe(arrancar(),'a','ccs_petare');
  const r1=R.aplicar(st.S,st.priv,'a',{t:'TIRAR',eid:st.S.esp.id,aid:'z1'},NOW);
  const r2=R.aplicar(r1.S,r1.priv,'a',{t:'TIRAR',eid:st.S.esp.id,aid:'z1'},NOW);
  assert.ok(r2.dup);assert.strictEqual(r2.S,r1.S);assert.strictEqual(r2.S.ver,r1.S.ver);assert.deepStrictEqual(r2.fx,[]);
});
test('ver monótono y proyectar(D, fx) == S',()=>{
  const st=turnoDe(arrancar(),'a','ccs_petare');
  const r=R.aplicar(st.S,st.priv,'a',{t:'TIRAR',eid:st.S.esp.id},NOW);
  assert.strictEqual(r.S.ver,st.S.ver+1);assert.deepStrictEqual(R.proyectar(st.S,r.fx),r.S);
  assert.strictEqual(R.hash(R.proyectar(st.S,r.fx)),R.hash(r.S));
  assert.strictEqual(r.S.fx[r.S.fx.length-1].v,r.S.ver);
});
test('casilla azul +4 y roja -3; dobles en las últimas 5 rondas; nunca negativas',()=>{
  let r=mover(turnoDe(arrancar(),'a','ccs_petare'),'a',1);assert.strictEqual(r.S.pj.a.nodo,'ccs_chacao');assert.strictEqual(r.S.pj.a.mon,24);
  r=mover(turnoDe(arrancar(),'a','coc_coro'),'a',1);assert.strictEqual(r.S.pj.a.nodo,'zul_dabajuro');assert.strictEqual(r.S.pj.a.mon,17);
  r=mover(turnoDe(arrancar(),'a','ccs_petare',S=>{S.r=S.tot-2;}),'a',1);assert.strictEqual(r.S.pj.a.mon,28);
  r=mover(turnoDe(arrancar(),'a','coc_coro',S=>{S.r=S.tot-4;}),'a',1);assert.strictEqual(r.S.pj.a.mon,14);
  r=mover(turnoDe(arrancar(),'a','coc_coro',S=>{S.r=S.tot-5;}),'a',1);assert.strictEqual(r.S.pj.a.mon,17,'la ronda tot-5 todavía no es Recta Final');
  r=mover(turnoDe(arrancar(),'a','coc_coro',S=>{S.pj.a.mon=2;}),'a',1);assert.strictEqual(r.S.pj.a.mon,0);
  assert.strictEqual(r.S.pj.a.col,'r');
});
test('banco: al pasar se paga 3 al pote y al caer se cobra todo',()=>{
  let r=mover(turnoDe(arrancar(),'a','ccs_start'),'a',2);
  assert.strictEqual(r.S.pj.a.nodo,'ccs_parquecentral');assert.strictEqual(r.S.tab.bancos.ccs_sabana,3);assert.strictEqual(r.S.pj.a.mon,20-3+4);
  r=mover(turnoDe(arrancar(),'a','ccs_start',S=>{S.tab.bancos.ccs_sabana=17;}),'a',1);
  assert.strictEqual(r.S.pj.a.mon,37);assert.strictEqual(r.S.tab.bancos.ccs_sabana,0);
});
test('transporte da +2; el turno pasa al siguiente en el orden fijo',()=>{
  const b=arrancar();const r=mover(turnoDe(b,'a','ccs_parquecentral',S=>{S.orden=['a','b','c','d'];}),'a',1);
  assert.strictEqual(r.S.pj.a.mon,22);assert.strictEqual(r.S.t.s,'b');assert.deepStrictEqual(r.S.orden,['a','b','c','d']);
});
test('estrella: se ofrece al pasar, cuesta 10, y la Abuela se muda lejos de todos',()=>{
  const st=turnoDe(arrancar(),'a','ccs_start',S=>{S.estrella.nodo='ccs_sabana';S.pj.a.mon=25;});
  const r=mover(st,'a',3);
  assert.strictEqual(r.S.esp.k,'ESTRELLA');assert.strictEqual(r.S.pj.a.nodo,'ccs_sabana');assert.strictEqual(r.S.esp.opc[0].precio,10);
  const c=R.aplicar(r.S,r.priv,'a',{t:'ESTRELLA',si:true,eid:r.S.esp.id},NOW);assert.ifError(c.error);
  assert.strictEqual(c.S.pj.a.est,1);
  const mv=c.fx.find(f=>f.k==='estrellaMueve');assert.ok(mv);assert.strictEqual(mv.de,'ccs_sabana');
  assert.notStrictEqual(c.S.estrella.nodo,'ccs_sabana');assert.ok(M.nodos[c.S.estrella.nodo].star||M.nodos[c.S.estrella.nodo].t==='azul');
  assert.notStrictEqual(M.nodos[c.S.estrella.nodo].r,'ccs','nunca en la región del comprador');
  // sigue caminando: 1 paso más tras la estrella (sabana es banco => pagó 3 al pasar)
  assert.strictEqual(c.S.pj.a.nodo,'ccs_metro');assert.strictEqual(c.S.pj.a.mon,25-3-10+2);
  // sin plata no hay oferta
  const p=mover(turnoDe(arrancar(),'a','ccs_start',S=>{S.estrella.nodo='ccs_sabana';S.pj.a.mon=5;}),'a',3);
  assert.notStrictEqual(p.S.esp&&p.S.esp.s==='a'&&p.S.esp.k,'ESTRELLA');assert.strictEqual(p.S.pj.a.est,0);
});
test('peaje del Puente: escalante +1 por pago, tope 10, y paga lo que tenga si no alcanza',()=>{
  let st=turnoDe(arrancar(),'a','zul_puente');let r=mover(st,'a',1);
  assert.strictEqual(r.S.pj.a.nodo,'zul_maracaibo');assert.strictEqual(r.S.tab.peajes['zul_puente>zul_maracaibo'],2);
  assert.ok(r.fx.some(f=>f.k==='mon'&&f.por==='peaje'&&f.d===-1));
  st=turnoDe(arrancar(),'a','zul_puente',S=>{S.tab.peajes['zul_puente>zul_maracaibo']=10;S.pj.a.mon=30;});
  r=mover(st,'a',1);assert.ok(r.fx.some(f=>f.por==='peaje'&&f.d===-10));assert.strictEqual(r.S.tab.peajes['zul_puente>zul_maracaibo'],10);
  st=turnoDe(arrancar(),'a','zul_puente',S=>{S.tab.peajes['zul_puente>zul_maracaibo']=6;S.pj.a.mon=4;});
  r=mover(st,'a',1);assert.strictEqual(r.S.pj.a.nodo,'zul_maracaibo');assert.ok(r.fx.some(f=>f.por==='peaje'&&f.d===-4));
});
test('atajos con costo: teleférico (5), sin plata no se ofrece; portón exige la llave y la gasta',()=>{
  let st=turnoDe(arrancar(),'a','ccs_avila');let r=mover(st,'a',2);
  assert.strictEqual(r.S.esp.k,'RUTA');const tel=r.S.esp.opc.find(o=>o.a==='ccs_galipan');assert.strictEqual(tel.costo,5);assert.ok(tel.ok);
  const c=R.aplicar(r.S,r.priv,'a',{t:'RUTA',a:'ccs_galipan',eid:r.S.esp.id},NOW);assert.ifError(c.error);
  assert.ok(c.fx.some(f=>f.k==='mon'&&f.d===-5&&f.por==='pasaje'));assert.ok(c.fx.some(f=>f.k==='hop'&&f.modo==='teleferico'));
  st=turnoDe(arrancar(),'a','ccs_avila',S=>{S.pj.a.mon=3;});r=mover(st,'a',1);
  assert.strictEqual(r.S.pj.a.nodo,'ccs_start','sin plata toma el camino gratis sin preguntar');
  st=turnoDe(arrancar(),'a','coc_valencia');r=mover(st,'a',1);
  assert.strictEqual(r.S.esp.opc.find(o=>o.a==='coc_barquisimeto').ok,false);
  st=turnoDe(arrancar(),'a','coc_valencia',S=>{S.pj.a.obj=['medida','llave',null];});r=mover(st,'a',1);
  assert.strictEqual(r.S.esp.opc.find(o=>o.a==='coc_barquisimeto').ok,true);
  const k=R.aplicar(r.S,r.priv,'a',{t:'RUTA',a:'coc_barquisimeto',eid:r.S.esp.id},NOW);assert.ifError(k.error);
  assert.strictEqual(k.S.pj.a.obj.indexOf('llave'),-1);
  const bad=R.aplicar(r.S,r.priv,'a',{t:'RUTA',a:'zul_maracaibo',eid:r.S.esp.id},NOW);assert.strictEqual(bad.error,'opcion');
});
test('Señor del Chaleco: la salida vigilada cuesta 5 y se muda a la salida libre que tomes',()=>{
  const st=turnoDe(arrancar(),'a','coc_barquisimeto',S=>{S.tab.chaleco.coc_barquisimeto='and_carora';});
  const r=mover(st,'a',1);const o=r.S.esp.opc;
  assert.strictEqual(o.find(x=>x.a==='and_carora').costo,5);assert.strictEqual(o.find(x=>x.a==='lla_acarigua').costo,0);
  const c=R.aplicar(r.S,r.priv,'a',{t:'RUTA',a:'lla_acarigua',eid:r.S.esp.id},NOW);
  assert.strictEqual(c.S.tab.chaleco.coc_barquisimeto,'lla_acarigua');
});
test('objetos: malta 2 dados, arepa +4 y cura, señal 1-3, tequeño roba, recibo bloquea, chancla, dato',()=>{
  // malta
  let st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.pj.a.obj=['malta',null,null];});
  let r=R.aplicar(st.S,st.priv,'a',{t:'USAR',slot:0,eid:st.S.esp.id},NOW);assert.ifError(r.error);
  assert.deepStrictEqual(r.S.esp.opc,['TIRAR'],'un objeto por turno');
  r=R.aplicar(r.S,r.priv,'a',{t:'TIRAR',eid:r.S.esp.id},NOW);let d=r.fx.find(f=>f.k==='dado');
  assert.strictEqual(d.dados.length,2);assert.strictEqual(d.de,'malta');
  // señal: b tira 1-3; arepa la cura
  st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.pj.a.obj=['senal',null,null];});
  r=R.aplicar(st.S,st.priv,'a',{t:'USAR',slot:0,a:'b',eid:st.S.esp.id},NOW);assert.ifError(r.error);
  assert.strictEqual(r.S.pj.b.st.senal,1);assert.ok(r.fx.some(f=>f.k==='ataque'&&f.a==='b'));
  const sb=turnoDe(r,'b','ccs_petare',S=>{S.pj.b.obj=[null,null,null];});
  r=R.aplicar(sb.S,sb.priv,'b',{t:'TIRAR',eid:sb.S.esp.id},NOW);d=r.fx.find(f=>f.k==='dado');
  assert.strictEqual(d.de,'senal');assert.ok(d.v>=1&&d.v<=3);assert.ok(!r.S.pj.b.st.senal);
  const sa=turnoDe(arrancar(),'b','ccs_petare',S=>{S.pj.b.st.senal=1;S.pj.b.obj=['arepa',null,null];});
  r=R.aplicar(sa.S,sa.priv,'b',{t:'USAR',slot:0,eid:sa.S.esp.id},NOW);r=R.aplicar(r.S,r.priv,'b',{t:'TIRAR',eid:r.S.esp.id},NOW);
  d=r.fx.find(f=>f.k==='dado');assert.strictEqual(d.de,'arepa');assert.strictEqual(d.v,d.dados[0]+4);
  // tequeño: roba un objeto; con recibo se bloquea; sin objetos roba 3 monedas
  st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.pj.a.obj=['tequeno',null,null];S.pj.b.obj=['guayoyo',null,null];});
  r=R.aplicar(st.S,st.priv,'a',{t:'USAR',slot:0,a:'b',eid:st.S.esp.id},NOW);
  assert.ok(r.S.pj.a.obj.includes('guayoyo'));assert.ok(!r.S.pj.b.obj.includes('guayoyo'));
  st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.pj.a.obj=['tequeno',null,null];S.pj.b.obj=['guayoyo','recibo',null];});
  r=R.aplicar(st.S,st.priv,'a',{t:'USAR',slot:0,a:'b',eid:st.S.esp.id},NOW);
  assert.deepStrictEqual(r.S.pj.b.obj,['guayoyo',null,null]);assert.ok(!r.S.pj.a.obj.includes('guayoyo'));
  st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.pj.a.obj=['tequeno',null,null];});
  r=R.aplicar(st.S,st.priv,'a',{t:'USAR',slot:0,a:'b',eid:st.S.esp.id},NOW);assert.strictEqual(r.S.pj.a.mon,23);assert.strictEqual(r.S.pj.b.mon,17);
  // chancla: retrocede 2 y suelta 5 monedas en su casilla; fuera de rango no se puede
  st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.pj.a.obj=['chancla',null,null];S.pj.b.nodo='ccs_metro';});
  r=R.aplicar(st.S,st.priv,'a',{t:'USAR',slot:0,a:'b',eid:st.S.esp.id},NOW);assert.ifError(r.error);
  assert.strictEqual(r.S.pj.b.mon,15);assert.strictEqual(r.S.tab.sueltas.ccs_metro,5);
  assert.strictEqual(r.fx.filter(f=>f.k==='hop'&&f.s==='b'&&f.modo==='atras').length,2);
  st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.pj.a.obj=['chancla',null,null];S.pj.b.nodo='can_roraima';});
  assert.strictEqual(R.aplicar(st.S,st.priv,'a',{t:'USAR',slot:0,a:'b',eid:st.S.esp.id},NOW).error,'objetivo');
  // monedas sueltas: las recoge el primero que pase
  r=mover(turnoDe(arrancar(),'a','ccs_parquecentral',S=>{S.tab.sueltas.ccs_metro=5;}),'a',1);
  assert.strictEqual(r.S.pj.a.mon,20+5+2);assert.ok(!('ccs_metro' in r.S.tab.sueltas));
  // dato del vecino: la estrella se muda
  st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.pj.a.obj=['dato',null,null];});
  r=R.aplicar(st.S,st.priv,'a',{t:'USAR',slot:0,eid:st.S.esp.id},NOW);assert.ok(r.S.estrella.nodo!=='roq_cayoagua'||r.S.estrella.b!==st.S.estrella.b,'una de las dos se mudó');
  // objetos pasivos no se usan a mano
  st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.pj.a.obj=['llave',null,null];});
  assert.strictEqual(R.aplicar(st.S,st.priv,'a',{t:'USAR',slot:0,eid:st.S.esp.id},NOW).error,'slot');
});
test('tienda: compra al pasar, descuenta stock, mano llena no ofrece',()=>{
  const st=turnoDe(arrancar(),'a','ccs_chacao',S=>{S.pj.a.mon=30;});
  const r=mover(st,'a',2);assert.strictEqual(r.S.esp.k,'TIENDA');assert.strictEqual(r.S.pj.a.nodo,'ccs_altamira');
  const malta=r.S.esp.opc.find(o=>o.item==='malta');assert.strictEqual(malta.precio,6,'Bodegón +20 %');
  const c=R.aplicar(r.S,r.priv,'a',{t:'COMPRAR',item:'malta',eid:r.S.esp.id},NOW);assert.ifError(c.error);
  assert.ok(c.S.pj.a.obj.includes('malta'));assert.strictEqual(c.S.tab.stock.bodegon.malta,1);assert.strictEqual(c.S.esp.k,'TIENDA','puede seguir comprando');
  const n=R.aplicar(c.S,c.priv,'a',{t:'COMPRAR',item:null,eid:c.S.esp.id},NOW);assert.ifError(n.error);assert.notStrictEqual(n.S.esp&&n.S.esp.s==='a'&&n.S.esp.k,'TIENDA');
  const lleno=turnoDe(arrancar(),'a','ccs_altamira',S=>{S.pj.a.mon=30;S.pj.a.obj=['medida','malta','malta'];});
  assert.deepStrictEqual(R.ofertaTienda(lleno.S,'a'),[],'con la mano llena no se ofrece nada');
  lleno.S.pj.a.obj=['medida',null,null];assert.ok(R.ofertaTienda(lleno.S,'a').length>0);
});
test('duelo: elige rival, apuesta por ruleta, minijuego 1v1 y el ganador cobra',()=>{
  const st=turnoDe(arrancar(),'a','lla_calabozo',S=>{S.orden=['a','b','c','d'];S.pj.a.mon=30;S.pj.b.mon=30;});
  let r=mover(st,'a',1);assert.strictEqual(r.S.esp.k,'OBJETIVO');
  r=R.aplicar(r.S,r.priv,'a',{t:'OBJETIVO',a:'b',eid:r.S.esp.id},NOW);assert.ifError(r.error);
  assert.strictEqual(r.S.f,'carta');assert.strictEqual(r.S.mj.tipo,'1v1');assert.deepStrictEqual(r.S.mj.as,['a','b']);
  const ap=r.S.mj.duelo.apuesta;assert.ok([5,10,20].includes(ap));
  r=R.aplicar(r.S,r.priv,'a',{t:'LISTO'},NOW);r=R.aplicar(r.S,r.priv,'b',{t:'LISTO'},NOW);assert.strictEqual(r.S.f,'mj');
  r=R.aplicar(r.S,r.priv,'$',{t:'MJ_RESULTADO',k:r.S.mj.k,sc:[1,5]},NOW);assert.ifError(r.error);
  assert.strictEqual(r.S.pj.b.mon,30+ap);assert.strictEqual(r.S.f,'res');
  r=R.tick(r.S,r.priv,r.S.nextAt);assert.strictEqual(r.S.f,'turno');assert.strictEqual(r.S.t.s,'b','el turno sigue tras el duelo');
});
test('minijuego de ronda: carta → LISTO → mj → MJ_RESULTADO paga; k equivocado se rechaza; sin veredicto empata',()=>{
  const st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.orden=['b','c','d','a'];});
  let r=mover(st,'a',1);assert.strictEqual(r.S.f,'carta');const mj=r.S.mj;
  assert.strictEqual(mj.cola.length,1,'clásica: un minijuego por ronda');assert.ok(['ffa','2v2','1v3'].includes(mj.tipo));
  assert.ok(mj.juez==='a'||mj.juez==='b');assert.strictEqual(mj.e,0);assert.ok(mj.cola[0].seed>0);
  assert.strictEqual(R.aplicar(r.S,r.priv,'$',{t:'MJ_RESULTADO',k:mj.k,sc:[1,2,3,4]},NOW).error,'fase');
  r=R.aplicar(r.S,r.priv,'a',{t:'LISTO'},NOW);assert.strictEqual(r.S.f,'carta');
  r=R.aplicar(r.S,r.priv,'b',{t:'LISTO'},NOW);assert.strictEqual(r.S.f,'mj');assert.strictEqual(r.S.mj.startAt,NOW+3500);
  assert.strictEqual(r.S.mj.cierre,r.S.mj.startAt+r.S.mj.cola[0].dur*1000+3000);
  assert.strictEqual(R.aplicar(r.S,r.priv,'$',{t:'MJ_RESULTADO',k:mj.k+1,sc:[1,2,3,4]},NOW).error,'fase');
  const antes=['a','b','c','d'].map(s=>r.S.pj[s].mon);
  const ok=R.aplicar(r.S,r.priv,'$',{t:'MJ_RESULTADO',k:mj.k,sc:[4,3,2,1]},NOW);assert.ifError(ok.error);
  const pg=ok.fx.find(f=>f.k==='mjRes').pagos;['a','b','c','d'].forEach((s,i)=>assert.strictEqual(ok.S.pj[s].mon,antes[i]+pg[i]));
  const vencido=R.tick(r.S,r.priv,r.S.mj.cierre);assert.strictEqual(vencido.S.f,'res');
  assert.ok(vencido.fx.find(f=>f.k==='mjRes').empate);assert.ok(['a','b','c','d'].every((s,i)=>vencido.S.pj[s].mon===antes[i]));
});
test('JUEZ por CAS: solo con la época vigente',()=>{
  const st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.orden=['b','c','d','a'];});
  const r=mover(st,'a',1);const k=r.S.mj.k;
  const ok=R.aplicar(r.S,r.priv,'b',{t:'JUEZ',k,e:0},NOW);assert.ifError(ok.error);assert.strictEqual(ok.S.mj.juez,'b');assert.strictEqual(ok.S.mj.e,1);
  assert.strictEqual(R.aplicar(ok.S,ok.priv,'a',{t:'JUEZ',k,e:0},NOW).error,'cas');
});
test('Relámpago: 5 microjuegos seguidos (opción y ronda especial), pago 3/2/1/0 y rey de la rumba',()=>{
  let st=turnoDe(arrancar({ronda:'relampago'}),'a','ccs_petare',S=>{S.orden=['b','c','d','a'];});
  let r=mover(st,'a',1);assert.strictEqual(r.S.mj.cola.length,5);assert.strictEqual(r.S.mj.tipo,'ffa');assert.ok(r.S.mj.cola.every(g=>g.dur===10));
  let pagos=[0,0,0,0];
  for(let i=0;i<5;i++){
    r=R.aplicar(r.S,r.priv,'a',{t:'LISTO'},NOW);r=R.aplicar(r.S,r.priv,'b',{t:'LISTO'},NOW);assert.strictEqual(r.S.f,'mj');
    r=R.aplicar(r.S,r.priv,'$',{t:'MJ_RESULTADO',k:r.S.mj.k,i,sc:[4,3,2,1]},NOW);assert.ifError(r.error);
    r.fx.find(f=>f.k==='mjRes').pagos.forEach((v,j)=>pagos[j]+=v);
  }
  assert.deepStrictEqual(pagos,[15,10,5,0]);assert.strictEqual(r.S.f,'res');assert.ok(r.fx.some(f=>f.k==='evento'&&f.id==='rey'&&f.s==='a'));
  // por defecto (clásica) la ronda especial es la de la mitad
  st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.orden=['b','c','d','a'];S.r=8;});
  r=mover(st,'a',1);assert.strictEqual(r.S.mj.cola.length,5);
  st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.orden=['b','c','d','a'];S.r=7;});
  r=mover(st,'a',1);assert.strictEqual(r.S.mj.cola.length,1);
});
test('pagosMJ: tabla del doc 08',()=>{
  assert.deepStrictEqual(R.pagosMJ('ffa',[1,2,3,4],1,{tot:15}),[14,9,5,2]);
  assert.deepStrictEqual(R.pagosMJ('ffa',[1,1,3,4],1,{tot:15}),[12,12,5,2]);
  assert.deepStrictEqual(R.pagosMJ('ffa',[2,1,2,4],1,{tot:15}),[7,14,7,2]);
  assert.deepStrictEqual(R.pagosMJ('2v2',[1,2,1,2],1,{tot:15}),[7,2,7,2]);
  assert.deepStrictEqual(R.pagosMJ('2v2',[1,1,1,1],1,{tot:15}),[4,4,4,4]);
  assert.deepStrictEqual(R.pagosMJ('1v3',[1,2,2,2],1,{tot:15,solo:0}),[12,0,0,0]);
  assert.deepStrictEqual(R.pagosMJ('1v3',[2,1,1,1],1,{tot:15,solo:0}),[0,4,4,4]);
  assert.deepStrictEqual(R.pagosMJ('1v3',[2,2,1,2],1,{tot:15}),[0,0,12,0],'detecta al solitario por su puesto');
  assert.deepStrictEqual(R.pagosMJ('1v3',[1,1,1,1],1,{tot:15,solo:3}),[2,2,2,5]);
  assert.deepStrictEqual(R.pagosMJ('ffa',[1,2,3,4],5,{tot:15}),[28,18,10,4],'×2 en rondas múltiplo de 5');
  assert.deepStrictEqual(R.pagosMJ('ffa',[1,2,3,4],15,{tot:15}),[14,9,5,2],'menos la última');
  assert.deepStrictEqual(R.pagosMJ('ffa',[1,2,3,4],1,{tot:15,relampago:1}),[3,2,1,0]);
  assert.deepStrictEqual(R.pagosMJ('ffa',[1,2,3,4],1,{tot:15,reto:1}),[15,9,5,2]);
  assert.deepStrictEqual(R.pagosMJ('ffa',[1,2,3,4],1,{tot:15,recogidos:[25,4,10,0]}),[17,9,7,2]);
});
test('compara (de fiesta-vs.js): ffa con empates, 2v2 por suma, 1v3 por la media del trío',()=>{
  assert.deepStrictEqual(R.compara('ffa',[0,1,2,3],[5,9,9,1]).puestos,[3,1,1,4]);
  const v=R.compara('2v2',[0,0,1,1],[3,3,5,0]);assert.deepStrictEqual(v.puestos,[1,1,2,2]);assert.strictEqual(v.equipoGanador,0);
  assert.deepStrictEqual(R.compara('1v3',[0,1,1,1],[6,9,3,3]).puestos,[1,2,2,2],'6 supera la media del trío (5)');
  assert.deepStrictEqual(R.compara('1v3',[0,1,1,1],[2,9,3,3]).puestos,[2,1,1,1]);
  assert.deepStrictEqual(R.compara('1v3',[0,1,1,1],[4,6,3,3]).puestos,[1,1,1,1]);
  assert.deepStrictEqual(R.compara('ffa',[0,1],[2,7]).ganadores,[1]);
  assert.deepStrictEqual(R.equipos('2v2',4),[0,0,1,1]);assert.deepStrictEqual(R.equipos('1v3',4,2),[1,1,0,1]);assert.deepStrictEqual(R.equipos('ffa',3),[0,1,2]);
});
test('AFK: 2 strikes en el dado => CPU; VOLVER devuelve el control; una acción real resetea',()=>{
  let st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.orden=['a','b','c','d'];S.pj.a.obj=[null,null,null];});
  let r=R.tick(st.S,st.priv,st.S.esp.hasta);assert.strictEqual(r.S.pj.a.afk,1);assert.strictEqual(r.S.pj.a.cpu,null);
  assert.ok(r.fx.some(f=>f.k==='dado'&&f.s==='a'),'tira solo al vencer');
  st=turnoDe(r,'a','ccs_petare',S=>{S.pj.a.obj=[null,null,null];});
  r=R.tick(st.S,st.priv,st.S.esp.hasta);assert.strictEqual(r.S.pj.a.cpu,'afk');assert.ok(r.fx.some(f=>f.k==='afk'));
  const v=R.aplicar(r.S,r.priv,'a',{t:'VOLVER'},NOW);assert.ifError(v.error);assert.strictEqual(v.S.pj.a.cpu,null);assert.strictEqual(v.S.pj.a.afk,0);
  st=turnoDe(arrancar(),'a','ccs_petare',S=>{S.pj.a.afk=1;});r=mover(st,'a',1);assert.strictEqual(r.S.pj.a.afk,0);
  assert.strictEqual(R.aplicar(st.S,st.priv,'$',{t:'AFK',s:'a'},NOW).S.pj.a.cpu,'afk');
});
test('CPU: tick respeta cpuAt y juega sola; nada pendiente => nada',()=>{
  const st=turnoDe(arrancar(),'c','ccs_petare',S=>{S.esp.id=S.ver;});st.priv.cpuAt=NOW+400;st.S.nextAt=NOW+400;
  assert.ok(R.tick(st.S,st.priv,NOW+100).nada);
  const r=R.tick(st.S,st.priv,NOW+400);assert.ifError(r.error);assert.ok(r.fx.some(f=>f.k==='dado'||f.k==='obj'));
});
test('TOMAR_ASIENTO: un humano nuevo hereda la CPU en el próximo límite',()=>{
  const b=arrancar();
  const st=turnoDe(b,'c','ccs_petare');st.priv.cpuAt=NOW+400;
  let r=R.aplicar(st.S,st.priv,'$',{t:'TOMAR_ASIENTO',s:'c',name:'CARLA'},NOW);assert.ifError(r.error);
  assert.strictEqual(r.S.pj.c.name,'CARLA');assert.strictEqual(r.S.pj.c.cpu,'auto','el aviso en curso lo termina la CPU');assert.strictEqual(r.S.pj.c.toma,1);
  assert.ok(r.fx.some(f=>f.k==='llega'&&f.name==='CARLA'));assert.deepStrictEqual(R.proyectar(st.S,r.fx),r.S);
  const t=R.tick(r.S,r.priv,NOW+400);assert.ifError(t.error);
  // fuera de su turno: inmediato
  const s2=turnoDe(b,'a','ccs_petare');r=R.aplicar(s2.S,s2.priv,'$',{t:'TOMAR_ASIENTO',s:'d',name:'DANI',ch:'tu'},NOW);
  assert.strictEqual(r.S.pj.d.cpu,null);assert.strictEqual(r.S.pj.d.stats.mj,s2.S.pj.d.stats.mj);
  assert.strictEqual(R.aplicar(s2.S,s2.priv,'$',{t:'TOMAR_ASIENTO',s:'a',name:'X'},NOW).error,'asiento');
});
test('vista: solo el actor ve su aviso; la parte privada solo con priv',()=>{
  const st=turnoDe(arrancar(),'a','ccs_petare');
  assert.ok(R.vista(st.S,'a').mio);assert.ok(!R.vista(st.S,'b').mio);assert.strictEqual(R.vista(st.S,'b').esp,null);
  assert.strictEqual(R.vista(st.S,'a').priv,undefined);assert.ok(R.vista(st.S,'a',st.priv).priv);
  const a=CPU.decide(st.S,R.vista(st.S,'a'),'a',require('../docs/style-lab/fiesta-rng.js').crear(1));assert.ok(a&&a.eid===st.S.esp.id);
});
test('fin: tras la ronda tot vienen las estrellas bonus, el podio y f=fin',()=>{
  const st=turnoDe(arrancar({tot:3}),'a','ccs_petare',S=>{S.orden=['b','c','d','a'];S.r=3;});
  let r=mover(st,'a',1);r=R.tick(r.S,r.priv,r.S.mj.cartaHasta);
  r=R.aplicar(r.S,r.priv,'$',{t:'MJ_RESULTADO',k:r.S.mj.k,sc:[1,2,3,4]},NOW);r=R.tick(r.S,r.priv,r.S.nextAt);
  assert.strictEqual(r.S.f,'final');assert.ok(r.fx.some(f=>f.k==='bonus'));assert.strictEqual(r.S.podio.length,4);
  r=R.tick(r.S,r.priv,r.S.nextAt);assert.strictEqual(r.S.f,'fin');
  assert.strictEqual(R.aplicar(r.S,r.priv,'a',{t:'TIRAR'},NOW).error,'fase');assert.ok(R.tick(r.S,r.priv,NOW*2).nada);
});
test('Goja: el código compartido no usa ?. ?? spread/rest async ni class',()=>{
  for(const f of ['fiesta-reglas.js','fiesta-cpu.js','fiesta-rng.js']){
    const src=fs.readFileSync(path.join(__dirname,'../docs/style-lab',f),'utf8').replace(/\/\/[^\n]*|'(?:\\.|[^'\\\n])*'/g,'');
    assert.ok(!/\?\.(?!\d)/.test(src),f+' usa ?.');assert.ok(!/\?\?/.test(src),f+' usa ??');assert.ok(!/\.\.\./.test(src),f+' usa spread');
    assert.ok(!/\basync\b|\bawait\b|\bclass\s/.test(src),f+' usa async/class');assert.ok(!/\.(at|flat|flatMap|includes)\(/.test(src),f+' usa at/flat/includes');
  }
});
test('M3 equipos: eqIdx se exporta y coincide con equipos(); formatos de equipo = clase binary; los live traen topes para el servidor',()=>{
  const as=['a','b','c','d'];
  assert.deepStrictEqual(R.eqIdx({tipo:'2v2',as,eq:[['a','b'],['c','d']]}),R.equipos('2v2',4));
  assert.deepStrictEqual(R.eqIdx({tipo:'2v2',as,eq:[['a','d'],['b','c']]}),[0,1,1,0],'por mj.eq, no por orden de asiento');
  assert.deepStrictEqual(R.eqIdx({tipo:'1v3',as,eq:[['c'],['a','b','d']],solo:'c'}),R.equipos('1v3',4,2));
  assert.deepStrictEqual(R.eqIdx({tipo:'ffa',as,eq:as.map(s=>[s])}),[0,1,2,3]);assert.deepStrictEqual(R.eqIdx({tipo:'1v1',as:['a','b'],eq:[['a'],['b']]}),[0,1]);
  R.CATALOGO.filter(g=>g.m.indexOf('2v2')>=0||g.m.indexOf('1v3')>=0).forEach(g=>assert.strictEqual(g.cl,'binary',g.g));
  R.CATALOGO.filter(g=>g.live).forEach(g=>{assert.ok(g.lim&&g.lim.scoreMax>0&&g.lim.scoreRate>0&&g.lim.minT<g.dur,g.g+' lim');});
  const fut=R.CATALOGO.find(g=>g.g==='f_futbolito'),pat=R.CATALOGO.find(g=>g.g==='f_patilla');
  assert.deepStrictEqual([fut.mo,fut.dur,fut.lim],['C',60,{scoreMax:15,scoreRate:0.5,minT:44,finTemprano:1}]);
  assert.deepStrictEqual([pat.mo,pat.dur,pat.lim],['B',35,{scoreMax:90,scoreRate:12,minT:6,finTemprano:1}]);
  assert.ok(pat.lim.scoreMax>=10*9,'9 golpes de diseño (3 tiros × 3 víctimas) caben en scoreMax');
  assert.ok(pat.lim.scoreRate*(Math.min(pat.lim.minT,pat.dur-1)-0.4+1.5)>=25,'el 25 constante del trío cabe en el ritmo al minT');
});

/* ───── dos estrellas simultáneas + economía v2 (doc 05 apéndice A) ───── */
const ES=S=>R.estrellasEn(S);
const eStar=n=>M.nodos[n].star||M.nodos[n].t==='azul';
// Compra la estrella del nodo donde está `a` (precio 10, mon 30) y devuelve el resultado.
function comprarEn(nodoEstrella,mods){
  const st=turnoDe(arrancar(),'a','ccs_start',S=>{S.pj.a.mon=30;S.pj.a.nodo='ccs_sabana';
    S.estrella.nodo=nodoEstrella.A;S.estrella.b=nodoEstrella.B;S.t.desde='ccs_sabana';if(mods)mods(S);});
  const e={S:st.S,priv:st.priv};
  e.S.esp={id:e.S.ver,s:'a',k:'ESTRELLA',opc:[{precio:10}],hasta:NOW+10000};e.S.t.pend=[];e.S.t.resto=0;
  return R.aplicar(e.S,e.priv,'a',{t:'ESTRELLA',si:true,eid:e.S.esp.id},NOW);
}
test('economía v2: defaults (20 monedas, estrella 10, 2 estrellas) y pagos FFA 14/9/5/2',()=>{
  assert.strictEqual(R.CFG0.mon0,20);assert.strictEqual(R.CFG0.precio,10);assert.strictEqual(R.CFG0.estrellas,2);
  assert.deepStrictEqual(R.pagosMJ('ffa',[1,2,3,4],1,{tot:15}),[14,9,5,2]);
});
test('crear: dos estrellas en nodos distintos de PRIMERAS; estrellasEn y vista las listan',()=>{
  const P=['ccs_galipan','coc_puertocolombia','moc_mochima'];
  for(let sem=1;sem<=40;sem++){
    const {S}=R.crear(sem,{},[{name:'A'}],NOW);
    assert.ok(P.includes(S.estrella.nodo)&&P.includes(S.estrella.b),'sem '+sem);assert.notStrictEqual(S.estrella.nodo,S.estrella.b);
    assert.deepStrictEqual(ES(S),[S.estrella.nodo,S.estrella.b]);
    const v=R.vista(S,'a');assert.deepStrictEqual(v.estrellas,[S.estrella.nodo,S.estrella.b]);assert.strictEqual(v.estrella,S.estrella.nodo);
  }
});
test('cfg.estrellas=1: b es null, estrellasEn tiene una y nunca se crea la segunda',()=>{
  const {S}=R.crear(3,{estrellas:1},[{name:'A'}],NOW);
  assert.strictEqual(S.estrella.b,null);assert.deepStrictEqual(ES(S),[S.estrella.nodo]);assert.deepStrictEqual(R.vista(S,'a').estrellas,[S.estrella.nodo]);
  for(let k=0;k<12;k++){
    const r=comprarEn({A:'ccs_sabana',B:null},S2=>{S2.cfg.estrellas=1;S2.estrella.b=null;S2.r=k+1;});
    assert.ifError(r.error);assert.strictEqual(r.S.estrella.b,null);assert.notStrictEqual(r.S.estrella.nodo,'ccs_sabana');
  }
});
test('comprar la estrella A muda solo A; comprar la B muda solo B (fx lleva i)',()=>{
  const ra=comprarEn({A:'ccs_sabana',B:'moc_mochima'});assert.ifError(ra.error);
  const ma=ra.fx.filter(f=>f.k==='estrellaMueve');assert.strictEqual(ma.length,1);assert.strictEqual(ma[0].i,0);assert.strictEqual(ma[0].de,'ccs_sabana');
  assert.strictEqual(ra.S.estrella.b,'moc_mochima','B intacta');assert.notStrictEqual(ra.S.estrella.nodo,'ccs_sabana');assert.strictEqual(ra.S.pj.a.mon,20);
  const rb=comprarEn({A:'moc_mochima',B:'ccs_sabana'});assert.ifError(rb.error);
  const mb=rb.fx.filter(f=>f.k==='estrellaMueve');assert.strictEqual(mb.length,1);assert.strictEqual(mb[0].i,1);assert.strictEqual(mb[0].de,'ccs_sabana');
  assert.strictEqual(rb.S.estrella.nodo,'moc_mochima','A intacta');assert.notStrictEqual(rb.S.estrella.b,'ccs_sabana');
});
test('las dos estrellas nunca coinciden, son candidatas válidas y quedan a >=4 pasos de todos',()=>{
  let n=0;
  for(let k=0;k<30;k++){
    for(const [A,B] of [['ccs_sabana','moc_mochima'],['moc_mochima','ccs_sabana']]){
      const r=comprarEn({A,B},S=>{S.r=1+(k%10);S.pj.b.nodo=['ccs_petare','coc_coro','lla_calabozo','zul_puente'][k%4];S.pj.c.mon=k;S.pj.d.est=k%3;});
      assert.ifError(r.error);const [x,y]=ES(r.S);n++;
      assert.notStrictEqual(x,y);assert.ok(eStar(x)&&eStar(y));
      const nuevo=r.fx.find(f=>f.k==='estrellaMueve').a;
      const ds=Object.keys(r.S.pj).map(q=>R.dist(r.S.pj[q].nodo,nuevo));
      // 'a' (comprador) está en ccs_sabana y la región ccs se excluye, así que hay alternativa siempre
      assert.ok(Math.min.apply(null,ds)>=4,'a '+Math.min.apply(null,ds)+' pasos de '+nuevo);
    }
  }
  assert.ok(n>=60);
});
test('proyectar(D, fx) == S con estrellaMueve{i} en ambas estrellas',()=>{
  for(const [A,B] of [['ccs_sabana','moc_mochima'],['moc_mochima','ccs_sabana']]){
    const st=turnoDe(arrancar(),'a','ccs_start',S=>{S.pj.a.mon=30;S.pj.a.nodo='ccs_sabana';S.estrella.nodo=A;S.estrella.b=B;});
    st.S.esp={id:st.S.ver,s:'a',k:'ESTRELLA',opc:[{precio:10}],hasta:NOW+10000};
    const r=R.aplicar(st.S,st.priv,'a',{t:'ESTRELLA',si:true,eid:st.S.esp.id},NOW);assert.ifError(r.error);
    assert.ok(r.fx.some(f=>f.k==='estrellaMueve'&&(f.i===0||f.i===1)));
    assert.deepStrictEqual(R.proyectar(st.S,r.fx),r.S);assert.strictEqual(R.hash(R.proyectar(st.S,r.fx)),R.hash(r.S));
  }
  // fx suelto: i=1 muda b, i=0 (o sin i) muda nodo
  const {S}=R.crear(4,{},[{name:'A'}],NOW);
  const f1=[{k:'estrellaMueve',de:S.estrella.b,a:'ccs_sabana',i:1,v:S.ver+1}];
  const P1=R.proyectar(S,f1);assert.strictEqual(P1.estrella.b,'ccs_sabana');assert.strictEqual(P1.estrella.nodo,S.estrella.nodo);
  const P0=R.proyectar(S,[{k:'estrellaMueve',de:S.estrella.nodo,a:'ccs_sabana',i:0,v:S.ver+1}]);assert.strictEqual(P0.estrella.nodo,'ccs_sabana');assert.strictEqual(P0.estrella.b,S.estrella.b);
});
test('Dato del Vecino: muda la estrella más cercana al líder',()=>{
  for(const [A,B,lider,cerca] of [['ccs_sabana','moc_mochima','ccs_chacao',0],['moc_mochima','ccs_sabana','ccs_chacao',1]]){
    const st=turnoDe(arrancar(),'b','ccs_petare',S=>{S.pj.b.obj=['dato',null,null];S.estrella.nodo=A;S.estrella.b=B;
      S.pj.a.est=3;S.pj.a.nodo=lider;S.orden=['b','a','c','d'];});
    st.S.t.s='b';st.S.esp={id:st.S.ver,s:'b',k:'DADO',opc:['TIRAR'],hasta:NOW+20000};
    const r=R.aplicar(st.S,st.priv,'b',{t:'USAR',slot:0,eid:st.S.esp.id},NOW);assert.ifError(r.error);
    const m=r.fx.filter(f=>f.k==='estrellaMueve');assert.strictEqual(m.length,1);assert.strictEqual(m[0].i,cerca);
    assert.strictEqual(m[0].de,cerca?B:A);assert.deepStrictEqual(R.proyectar(st.S,r.fx),r.S);
    assert.notStrictEqual(r.S.estrella.nodo,r.S.estrella.b);
  }
});
test('ofertas: la estrella se ofrece en cualquiera de las dos; con una sola no hay oferta en el nodo vacío',()=>{
  for(const [A,B] of [['ccs_sabana','roq_cayoagua'],['roq_cayoagua','ccs_sabana']]){
    const st=turnoDe(arrancar(),'a','ccs_start',S=>{S.estrella.nodo=A;S.estrella.b=B;S.pj.a.mon=25;});
    const r=mover(st,'a',3);assert.strictEqual(r.S.esp.k,'ESTRELLA');assert.strictEqual(r.S.pj.a.nodo,'ccs_sabana');
  }
  const st=turnoDe(arrancar(),'a','ccs_start',S=>{S.estrella.nodo='roq_cayoagua';S.estrella.b=null;S.cfg.estrellas=1;S.pj.a.mon=25;});
  const r=mover(st,'a',3);assert.notStrictEqual(r.S.esp&&r.S.esp.s==='a'&&r.S.esp.k,'ESTRELLA');
});
test('precioPara: con el Bono de la Abuela la estrella cuesta ceil(precio/2); sin bono, el precio',()=>{
  const {S}=R.crear(5,{},[{name:'A'}],NOW);
  assert.strictEqual(R.precioPara(S,'a'),10);S.pj.a.obj=['bono',null,null];assert.strictEqual(R.precioPara(S,'a'),5);
  S.estrella.precio=11;assert.strictEqual(R.precioPara(S,'a'),6);S.pj.a.obj=[null,null,null];assert.strictEqual(R.precioPara(S,'a'),11);
  assert.strictEqual(R.vista(S,'a').precio,11);
});
test('islaVisible: la 2.ª estrella en del_isla también la hace visible (rondas impares)',()=>{
  const ok=b=>{const st=turnoDe(arrancar(),'a','del_espejo',S=>{S.r=3;S.estrella.nodo='roq_cayoagua';S.estrella.b=b;});
    const o=R.salidas(st.S,'a','del_espejo',1).find(x=>x.a==='del_isla');return o&&o.ok;};
  assert.ok(!ok('ccs_sabana'),'ronda impar sin estrella en la isla: oculta');
  assert.ok(ok('del_isla'),'la 2.ª estrella en la isla la muestra');
  const st=turnoDe(arrancar(),'a','del_espejo',S=>{S.r=3;S.estrella.nodo='del_isla';S.estrella.b='ccs_sabana';});
  assert.ok(R.salidas(st.S,'a','del_espejo',1).find(x=>x.a==='del_isla').ok,'la 1.ª también');
});
test('determinismo: misma semilla y mismas acciones => mismo hash con dos estrellas',()=>{
  const run=()=>{const a=arrancar();let r=comprarEn({A:'ccs_sabana',B:'moc_mochima'});return R.hash(r.S)+':'+R.hash(a.S);};
  assert.strictEqual(run(),run());
  assert.strictEqual(R.hash(R.crear(11,{},[{name:'A'}],NOW).S),R.hash(R.crear(11,{},[{name:'A'}],NOW).S));
});
