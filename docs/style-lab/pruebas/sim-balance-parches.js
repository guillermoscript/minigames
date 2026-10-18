// Parches de TEXTO sobre fiesta-reglas.js para que sim-balance.js pruebe cambios de economía sin editar el reductor (Área 1).
// Formato: { nombre: [ {ancla:'texto exacto', por:'reemplazo'} ] }. Lo que gane se pasa a Área 1 como cambio real (fase 2).
// NOTA: los parches 'dos-estrellas', 'estrella-*', 'ingreso-alto' y 'bono-mitad' ya están INTEGRADOS en fiesta-reglas.js (economía v2).
// Solo sirven si su ancla aún existe; si no, sim-balance.js lo reporta ("variante obsoleta") y sale con código 2. Se conservan de ejemplo.
module.exports={
  // La estrella reaparece a >=4 pasos de todos (antes >=8)
  'estrella-cerca':[{ancla:"if(dist(N.pj[ss[i]].nodo,x)<8)return false;",por:"if(dist(N.pj[ss[i]].nodo,x)<4)return false;"}],
  // Candidatas a estrella = las 15 marcadas + TODAS las casillas azules (más destinos => viajes más cortos)
  'estrella-azules':[{ancla:"var STARS=IDS.filter(function(i){return NOD[i].star;});",por:"var STARS=IDS.filter(function(i){return NOD[i].star||NOD[i].t==='azul';});"}],
  // La estrella prefiere (x1) destinos a <=12 pasos del jugador más cercano; los más lejos pesan 1/8
  'estrella-pegada':[
    {ancla:"var l=c.map(function(x){var w=2,m=0;ult.forEach",por:"var l=c.map(function(x){var w=2,m=0,mn=99;ss.forEach(function(q){mn=Math.min(mn,dist(N.pj[q].nodo,x));});ult.forEach"},
    {ancla:"if(dist(N.pj[lider].nodo,x)<=10)w=0;return[x,w];",por:"if(dist(N.pj[lider].nodo,x)<=10)w=0;if(mn>12)w/=8;return[x,w];"}],
  'estrella-pegada8':[
    {ancla:"var l=c.map(function(x){var w=2,m=0;ult.forEach",por:"var l=c.map(function(x){var w=2,m=0,mn=99;ss.forEach(function(q){mn=Math.min(mn,dist(N.pj[q].nodo,x));});ult.forEach"},
    {ancla:"if(dist(N.pj[lider].nodo,x)<=10)w=0;return[x,w];",por:"if(dist(N.pj[lider].nodo,x)<=10)w=0;if(mn>8)w/=8;return[x,w];"}],
  // Más ingreso: pago por puesto del FFA 10/6/3/1 -> 14/9/5/2 y la azul +3 -> +4
  'ingreso-alto':[
    {ancla:"promArriba([10,6,3,1],p,puestos)",por:"promArriba([14,9,5,2],p,puestos)"},
    {ancla:"if(ty==='azul')mon(Z,s,3*x,'azul');",por:"if(ty==='azul')mon(Z,s,4*x,'azul');"}],
  // PROTOTIPO: segunda estrella simultánea. Vive en N.estrella.b (el nodo de la principal sigue en N.estrella.nodo); cada compra muda SOLO la que se compró.
  'dos-estrellas':[
    {ancla:"var S={f:'orden',r:0,",por:"var A0=r.pick(PRIMERAS),B0=PRIMERAS.filter(function(x){return x!==A0;})[0];var S={f:'orden',r:0,"},
    {ancla:"estrella:{nodo:r.pick(PRIMERAS),precio:c.precio}",por:"estrella:{nodo:A0,b:B0,precio:c.precio}"},
    {ancla:"var N=Z.N,prev=N.estrella.nodo,ss=seats(N)",por:"var N=Z.N,esB=!!(comprador&&N.estrella.b&&N.pj[comprador].nodo===N.estrella.b&&N.pj[comprador].nodo!==N.estrella.nodo),prev=esB?N.estrella.b:N.estrella.nodo,ss=seats(N)"},
    {ancla:"if(x===prev||(reg&&NOD[x].r===reg))return false;",por:"if(x===prev||x===N.estrella.nodo||x===N.estrella.b||(reg&&NOD[x].r===reg))return false;"},
    {ancla:"emit(Z,{k:'estrellaMueve',de:prev,a:a});",por:"emit(Z,{k:'estrellaMueve',de:prev,a:a,b:esB?1:0});"},
    {ancla:"estrellaMueve:function(N,f){N.estrella.nodo=f.a;",por:"estrellaMueve:function(N,f){if(f.b)N.estrella.b=f.a;else N.estrella.nodo=f.a;"},
    {ancla:"if(p.nodo===N.estrella.nodo&&!N.t.compro",por:"if((p.nodo===N.estrella.nodo||p.nodo===N.estrella.b)&&!N.t.compro"}],
  // Bonus final: solo 2 categorías (minijuegos + la oculta); sin 'ricachon' (premiaba acaparar monedas en vez de comprar estrellas)
  'bonus-2':[{ancla:"['minijuegos','ricachon',Z.P.bonusOculta]",por:"['minijuegos',Z.P.bonusOculta]"}],
  // Bonus final: solo la oculta
  'bonus-1':[{ancla:"['minijuegos','ricachon',Z.P.bonusOculta]",por:"[Z.P.bonusOculta]"}],
  // Remontada real: la regla vieja (x3 si la media de los 2 últimos está a <=25) casi siempre se cumple (no discrimina). Ahora x4 si el ÚLTIMO está a <=10 pasos de esa candidata
  'estrella-ultimo':[{ancla:"if(m/ult.length<=25)w*=3;",por:"if(Math.min(99,dist(N.pj[rk[rk.length-1]].nodo,x))<=10)w*=4;"}],
  // Con la estrella a 10, el Bono de la Abuela (min(10,precio)) no haría nada: ahora deja la estrella en la MITAD del precio
  'bono-mitad':[{ancla:"Math.min(10,N.estrella.precio)",por:"Math.ceil(N.estrella.precio/2)"}]
};
module.exports.PRESETS={
  // 'base' = el reductor real sin variantes (la economía v2 ya está integrada)
  base:{variantes:[],cfg:{}}
};
