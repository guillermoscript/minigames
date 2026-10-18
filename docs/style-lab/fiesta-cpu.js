// LA FIESTA · política de la CPU del tablero (pura; doc 07 §7.3). UMD, Goja-safe (ES2015 sin ?. ?? spread).
//   decide(S, v, asiento, rng) -> acción para aplicar() | null
//     S = board público, v = reglas.vista(S, asiento), rng = RNG sembrado (en el servidor, el oculto de keys._f).
//   Nivel S.cfg.cpuNivel 1..3: el 1 se equivoca seguido, el 3 nunca. Siempre compra la estrella si le alcanza,
//   va hacia la estrella por el camino más corto (pagando si conviene), compra un objeto por visita y usa objetos antes de tirar.
(function(root){
var F=root.FIESTA=root.FIESTA||{};
var NODE=typeof require!=='undefined'&&typeof module!=='undefined';
function R(){return F.reglas||(NODE?require('./fiesta-reglas.js'):null);}
var ERR=[0,0.35,0.12,0];
var PRIO=['guayoyo','malta','medida','senal','tequeno','chancla','dato','arepa','recibo','paracaidas','llave'];

function rival(S,s,lista){var rk=R().rango(S).filter(function(x){return x!==s&&(!lista||lista.indexOf(x)>=0);});return rk[0]||null;}
// Distancia a la estrella activa MÁS CERCANA (hay 1 o 2: R().estrellasEn(S)); con una sola es la distancia de siempre.
function dEst(S,nodo){var m=99;R().estrellasEn(S).forEach(function(e){m=Math.min(m,R().dist(nodo,e));});return m;}

function dado(S,v,s,rng,err){
  var e=v.esp,p=S.pj[s],d=dEst(S,p.nodo),items=e.opc.filter(function(o){return typeof o==='object';});
  if(!items.length||rng.next()<err)return{t:'TIRAR',eid:e.id};
  function hay(o){return items.filter(function(x){return x.o===o;})[0]||null;}
  var x;
  if(p.st.senal&&(x=hay('arepa')))return{t:'USAR',slot:x.slot,eid:e.id};
  if((x=hay('medida'))&&d>=1&&d<=10)return{t:'USAR',slot:x.slot,n:d,eid:e.id};
  if(!p.st.senal){
    if((x=hay('guayoyo'))&&d>=14)return{t:'USAR',slot:x.slot,eid:e.id};
    if((x=hay('malta'))&&d>=8)return{t:'USAR',slot:x.slot,eid:e.id};
    if((x=hay('arepa'))&&d>=11)return{t:'USAR',slot:x.slot,eid:e.id};
  }
  var L=rival(S,s);
  if((x=hay('senal'))&&x.bl.indexOf(L)>=0&&dEst(S,S.pj[L].nodo)<=12)return{t:'USAR',slot:x.slot,a:L,eid:e.id};
  if((x=hay('chancla'))){var c=rival(S,s,x.bl);if(c)return{t:'USAR',slot:x.slot,a:c,eid:e.id};}
  if((x=hay('tequeno'))){var ricos=x.bl.filter(function(b){return S.pj[b].obj.some(function(o){return!!o;});}),b=rival(S,s,ricos.length?ricos:x.bl);
    if(b)return{t:'USAR',slot:x.slot,a:b,eid:e.id};}
  if((x=hay('dato'))&&d>25&&Object.keys(S.pj).some(function(o){return o!==s&&dEst(S,S.pj[o].nodo)<=10;}))return{t:'USAR',slot:x.slot,eid:e.id};
  return{t:'TIRAR',eid:e.id};
}
function ruta(S,v,s,rng,err){
  var e=v.esp,ok=e.opc.filter(function(o){return o.ok;});
  if(rng.next()<err)return{t:'RUTA',a:rng.pick(ok).a,eid:e.id};
  var best=null,bs=Infinity;
  ok.forEach(function(o){var sc=o.pasos+dEst(S,o.a)+o.costo*0.3;if(sc<bs){bs=sc;best=o;}});
  return{t:'RUTA',a:best.a,eid:e.id};
}
function tienda(S,v,s,rng,err){
  var e=v.esp,p=S.pj[s];
  if(S.t&&S.t.compras>=1)return{t:'COMPRAR',item:null,eid:e.id};
  var reserva=R().precioPara(S,s),l=e.opc.filter(function(o){return p.mon-o.precio>=reserva;});
  if(!l.length)return{t:'COMPRAR',item:null,eid:e.id};
  if(rng.next()<err)return{t:'COMPRAR',item:rng.pick(l).item,eid:e.id};
  l.sort(function(a,b){return PRIO.indexOf(a.item)-PRIO.indexOf(b.item);});
  return{t:'COMPRAR',item:l[0].item,eid:e.id};
}
function decide(S,v,s,rng){
  v=v||R().vista(S,s);
  if(!v.mio)return v.listo?{t:'LISTO'}:null;
  var e=v.esp,err=ERR[S.cfg&&S.cfg.cpuNivel||2]||0;
  if(e.k==='COMMIT')return{t:'COMMIT',k:e.c,eid:e.id};
  if(e.k==='DADO')return dado(S,v,s,rng,err);
  if(e.k==='RUTA')return ruta(S,v,s,rng,err);
  if(e.k==='ESTRELLA')return{t:'ESTRELLA',si:S.pj[s].mon>=e.opc[0].precio,eid:e.id};
  if(e.k==='TIENDA')return tienda(S,v,s,rng,err);
  if(e.k==='OBJETIVO')return{t:'OBJETIVO',a:rival(S,s,e.opc)||e.opc[0],eid:e.id};
  return null;
}
F.cpu={decide:decide,ERR:ERR};
if(typeof module!=='undefined')module.exports=F.cpu;
})(typeof window!=='undefined'?window:globalThis);
