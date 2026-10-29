// LA FIESTA · REDUCTOR PURO del tablero (M0.5, doc 07 §3-4). UMD, sin DOM; corre en el navegador, en Node y en Goja
// (hooks de PocketBase): solo ES2015, sin ?. ?? spread async ni clases.
//
// API (todas puras: nunca mutan sus argumentos)
//   crear(semilla, cfg, asientos, ahora) -> {S, priv}
//       S    = board PÚBLICO (rooms.board). Jamás lleva rng ni semilla (hay prueba).
//       priv = keys._f PRIVADO: {rng, semilla, deck, bonusOculta, c:{orden}, aid, cpuAt, ahorita, recientes}
//       asientos = [{name, ch, cpu?:'auto'}] (humanos primero); se rellena con CPU hasta cfg.n (4) con los personajes libres.
//   aplicar(S, priv, asiento, a, ahora) -> {S, priv, fx, error, dup?}
//       asiento 'a'..'d' (jugador) o '$' (servidor: MJ_RESULTADO, TOMAR_ASIENTO, AFK). error != null => S y priv intactos.
//       Jugadas del aviso (esp): TIRAR, USAR{slot,a?,n?}, RUTA{a}, ESTRELLA{si}, COMPRAR{item|null}, OBJETIVO{a}.
//       Otras: COMMIT{k:'orden'}, LISTO, JUEZ{k,e}, VOLVER, SALIR. Llevan {eid (=esp.id, D17), aid (idempotencia)}; ver opcional.
//       Errores: 'accion' 'fase' 'turno' (403) 'eid'/'ver' (409) 'cpu' 'asiento' 'opcion' 'slot' 'objetivo' 'monedas' 'cas'.
//   tick(S, priv, ahora) -> igual; atiende UN vencimiento (CPU con cpuAt, plazo + strike AFK, orden, carta→mj, cierre, res, final).
//       Sin nada pendiente devuelve {S, priv, fx:[], nada:true} sin tocar ver.
//   proyectar(D, fx) -> S'  aplicar el lote fx a la foto anterior D reproduce S exacto (incluido el anillo S.fx).
//   aplicaFx(D, f) muta D con UN efecto (para el director, que anima de a uno; no toca el anillo).
//   vista(S, asiento, priv?) -> lo que ese asiento puede hacer ahora (+ su parte privada si se pasa priv: ruta `mine`).
//   pagosMJ(tipo, puestos, ronda, x?) -> monedas por participante (doc 08 §8.2). x = {tot, eq, solo, relampago, reto, final, recogidos}
//   compara(modo, eq, sc) / equipos(modo, n, solo): movidos de fiesta-vs.js con la misma semántica.
//   fxMs(lote), hash(S) (FNV de JSON con claves ordenadas, sin el anillo fx).
// Fases f: lobby → orden → turno ⇄ carta → mj → res → (turno | final) → fin. Pasos del turno t.paso: pre, dado, mover, decide, casilla.
// Contrato fx (doc 07 §3.4): efectos YA resueltos; los de control llegan como {k:'set', p:'ruta.de.campo', v}, al final del lote.
(function(root){
var F=root.FIESTA=root.FIESTA||{};
var NODE=typeof require!=='undefined'&&typeof module!=='undefined';
var RNG=NODE?require('./fiesta-rng.js'):F.rng;
var MAPA=NODE?require('./fiesta-mapa-venezuela.js'):F.MAPAS.venezuela;
function CPU(){return F.cpu||(NODE?require('./fiesta-cpu.js'):null);}

/* ───── datos ───── */
var SEATS=['a','b','c','d'];
var PERSONAJES=[{id:'tu',n:'TÚ'},{id:'mama',n:'MAMÁ'},{id:'abuela',n:'LA ABUELA'},{id:'tio',n:'EL TÍO'},{id:'pana',n:'EL PANA'},
  {id:'prima',n:'LA PRIMA'},{id:'cobrador',n:'EL COBRADOR'},{id:'portu',n:'EL PORTU'}];
var CFG0={tot:15,ronda:'clasica',reglas:'caos',dadosPj:false,cpuNivel:2,n:4,mon0:20,precio:10,estrellas:2,relampagoRondas:null,tasa:false,bonus:true};
var PLAZO={DADO:20000,DADO1:30000,RUTA:12000,TIENDA:15000,ESTRELLA:10000,OBJETIVO:12000,ELIGE:15000,COMMIT:12000};
var T={cpu:400,carta:4500+15000,cuenta:3500,cierre:3000,res:5000,final:4000,relCarta:1400,relRes:1200};
var FX_MS={dado:900,hop:160,mon:500,est:2200,estrellaMueve:1600,evento:1800,obj:600,ataque:1200,turno:800,ronda:1500,
  mjIni:1200,mjRes:2000,ruleta:1800,afk:800,vuelve:600,llega:1500,pasa:300,bonus:2200,fin:3000,set:0,ver:0};
// Objetos v1 (doc 05 §9.3 + doc 03 A01). pasivo = se gasta solo (rutas, defensa); blanco = necesita objetivo.
var OBJ={
  malta:{n:'Malta con Leche Condensada',p:5,c:'dado'},          // 2d10, dobles +10
  guayoyo:{n:'Guayoyo Triple',p:12,c:'dado'},                    // 3d10, trío +30 (777 +50)
  arepa:{n:'Arepa Reina Pepiada',p:4,c:'dado'},                  // +4 y cura la Señal Caída
  medida:{n:'Dado a la Medida',p:12,c:'dado'},                   // eliges 1-10
  llave:{n:'Llave de la Finca',p:4,c:'atajo',pasivo:1},          // abre portones
  paracaidas:{n:'Paracaídas del Salto',p:8,c:'atajo',pasivo:1},  // aristas de salto
  recibo:{n:'Recibo de Luz Pagado',p:8,c:'defensa',pasivo:1},    // bloquea Don Corte, Tequeño o el Chaleco
  chancla:{n:'Chancla de Mamá',p:10,c:'ataque',blanco:1,rango:10},// retrocede 2 y suelta 5 monedas en su casilla
  tequeno:{n:'Tequeño Teledirigido',p:15,c:'ataque',blanco:1},   // roba 1 objeto (o 3 monedas)
  senal:{n:'Señal Caída',p:5,c:'ataque',blanco:1},               // el rival tira 1-3 en su próximo turno
  dato:{n:'El Dato del Vecino',p:12,c:'estrella'},               // la estrella se muda
  bono:{n:'Bono de la Abuela',p:0,c:'estrella',pasivo:1,noVenta:1}// la próxima estrella cuesta la mitad
};
var VENTA=['malta','guayoyo','arepa','medida','llave','paracaidas','recibo','chancla','tequeno','senal','dato'];
var TIENDAS={bodegon:{o:VENTA,x:1.2,luz:1},farmacia:{o:['recibo','arepa','malta','llave']},bodega_lago:{o:['malta','guayoyo','chancla']},
  heladeria:{o:['arepa','malta','guayoyo','paracaidas']},bodega_llanera:{o:['llave','chancla','medida']},
  mercado_orinoco:{o:['tequeno','dato','senal']},bodega_frontera:{o:['paracaidas','recibo','senal']},
  zona_libre:{o:VENTA,x:0.7,st:1},mercadito:{azar:3,luz:1}};
// Catálogo de minijuegos en vivo (doc 07 §6.8; M2-SPEC DM2-3: fuente única de cliente y servidor). `live:1` = tiene runtime registrado (fiesta-live);
// `fuera:1` = sigue registrado (las pruebas de red lo usan) pero ya no sale en las rondas: ¡CAPICÚA! lo reemplazó ¡TOROS COLEADOS! (doc 15 §8).
// `lim` = topes que valida el servidor (scoreMax, scoreRate por segundo, minT s de juego antes de poder terminar, finTemprano). El reductor solo elige g/seed/dur/lv.
var CATALOGO=[
  {g:'f_cola',m:['ffa'],cl:'rank',dur:20,mo:'A',live:1,lim:{scoreMax:125,scoreRate:30,minT:4,finTemprano:1}},{g:'f_domino',m:['ffa','1v1'],cl:'rank',dur:30,mo:'B',live:1,fuera:1,lim:{scoreMax:1000,scoreRate:40,minT:27,finTemprano:0}},{g:'f_toro',m:['ffa','1v1'],cl:'rank',dur:30,mo:'A',live:1,lim:{scoreMax:700,scoreRate:40,minT:27,finTemprano:0}},{g:'f_tequeno',m:['ffa'],cl:'rank',dur:30,mo:'A',live:1,lim:{scoreMax:300,scoreRate:10,minT:27,finTemprano:0}},
  {g:'f_harina',m:['ffa','1v1'],cl:'rank',dur:30,mo:'C',live:1,lim:{scoreMax:800,scoreRate:25,minT:27,finTemprano:0}},{g:'f_cotufas',m:['ffa'],cl:'rank',dur:30,mo:'B',live:1,lim:{scoreMax:120,scoreRate:5,minT:27,finTemprano:0}},{g:'f_cerro',m:['ffa'],cl:'rank',dur:35,mo:'A',live:1,lim:{scoreMax:2100,scoreRate:150,minT:8,finTemprano:1}},
  {g:'f_bolas',m:['ffa'],cl:'rank',dur:35,mo:'C',live:1,lim:{scoreMax:12,scoreRate:1,minT:26,finTemprano:1}},{g:'f_perro',m:['ffa'],cl:'rank',dur:35,mo:'A',live:1,lim:{scoreMax:950,scoreRate:200,minT:4,finTemprano:1}},
  {g:'f_mecate',m:['ffa','1v1'],cl:'survival',dur:45,mo:'A',live:1,lim:{scoreMax:1351,scoreRate:31,minT:3,finTemprano:1}},{g:'f_chancla',m:['ffa'],cl:'survival',dur:45,mo:'B',live:1,lim:{scoreMax:1351,scoreRate:31,minT:3,finTemprano:1}},{g:'f_vagon',m:['ffa'],cl:'survival',dur:50,mo:'C',live:1,lim:{scoreMax:1501,scoreRate:31,minT:6,finTemprano:1}},
  {g:'f_bombita',m:['ffa'],cl:'survival',dur:40,mo:'B',live:1,lim:{scoreMax:1201,scoreRate:31,minT:3,finTemprano:1}},{g:'f_abuela',m:['ffa','1v1'],cl:'survival',dur:45,mo:'A',live:1,lim:{scoreMax:1351,scoreRate:31,minT:3,finTemprano:1}},{g:'f_bombillo',m:['ffa'],cl:'survival',dur:45,mo:'B',live:1,lim:{scoreMax:1351,scoreRate:31,minT:3,finTemprano:1}},
  {g:'f_futbolito',m:['2v2'],cl:'binary',dur:60,mo:'C',live:1,lim:{scoreMax:15,scoreRate:0.5,minT:44,finTemprano:1}},{g:'f_carrucha',m:['2v2'],cl:'binary',dur:45,mo:'Ceq'},{g:'f_hallacas',m:['2v2'],cl:'binary',dur:45,mo:'B',live:1,lim:{scoreMax:16,scoreRate:0.45,minT:44,finTemprano:0}},
  {g:'f_cava',m:['2v2'],cl:'binary',dur:35,mo:'B',live:1,lim:{scoreMax:30,scoreRate:1,minT:30,finTemprano:0}},{g:'f_cuerda',m:['2v2'],cl:'binary',dur:30,mo:'C',live:1,lim:{scoreMax:39,scoreRate:1.4,minT:29,finTemprano:0}},{g:'f_chocones',m:['2v2'],cl:'binary',dur:40,mo:'C',live:1,lim:{scoreMax:30,scoreRate:1.5,minT:33,finTemprano:1}},{g:'f_mudanza',m:['2v2'],cl:'binary',dur:45,mo:'C',live:1,lim:{scoreMax:100,scoreRate:7,minT:15,finTemprano:1}},
  {g:'f_patilla',m:['1v3'],cl:'binary',dur:35,mo:'B',live:1,lim:{scoreMax:90,scoreRate:12,minT:6,finTemprano:1}},{g:'f_bono',m:['1v3'],cl:'binary',dur:35,mo:'B',live:1,lim:{scoreMax:60,scoreRate:8,minT:6,finTemprano:1}},{g:'f_guaya',m:['1v3'],cl:'binary',dur:40,mo:'B',live:1,lim:{scoreMax:30,scoreRate:10,minT:6,finTemprano:1}},
  {g:'f_alcabala',m:['1v3'],cl:'binary',dur:40,mo:'B',live:1,lim:{scoreMax:30,scoreRate:8,minT:5,finTemprano:1}},{g:'f_silbon',m:['1v3'],cl:'binary',dur:45,mo:'B',live:1,lim:{scoreMax:16,scoreRate:8,minT:5,finTemprano:1}}];
// Relámpago: 5 microjuegos FFA de 10 s seguidos (doc 06 §6.4), la ronda especial.
var RELAMPAGO=['f_cola','f_toro','f_harina','f_tequeno','f_machaca','f_mecate','f_abuela'];
var EVENTOS=[['billete',4],['cola',3],['regalo',2],['fresas',2],['propina',3],['relampago',1]];
var TXT_EV={billete:'Se encontró un billete en el pantalón',cola:'Cola en el banco: se le fue la plata',regalo:'La vecina le regaló algo',
  fresas:'¡Fresas con crema pa\' todos!',propina:'Propina del turista',relampago:'¡RELÁMPAGO! Esta ronda son 5 minijuegos seguidos'};
var DECK=[['flota',3],['hunde',2],['recalcula',3],['telenovela',2],['espejo',2],['cedula',1],['hamaca',2],['aprecia',2],
  ['vaca',1],['garza',2],['luz',1],['apagon',1],['penero',2]];
var BONUS_OCULTOS=['pasos','eventos','rojas','compras'];
var ST_BONUS={minijuegos:'mj',ricachon:'max',pasos:'pasos',eventos:'eventos',rojas:'rojas',compras:'compras'};
var EVT={evento:1,especial:1,vaina:1,villano:1,duelo:1,ahorita:1,delta:1};
var CTRL=['f','r','orden','t','esp','mj','nextAt','tab','estrella','podio'],PCTRL=['st','cpu','afk','col','toma'];
var RING_MAX=6000,RING_N=16,LOG_N=30;

/* ───── mapa precalculado ───── */
var NOD=MAPA.nodos,ADY=MAPA.ady,INICIO=MAPA.inicio,IDS=Object.keys(NOD),RUTA={},REV={};
var PASOS={camino:1,teleferico:1,metro:1,camionetica:2,lancha:1,ferry:2,avion:3,avioneta:3,chalana:2,curiara:1,penero:1,peaje:1,porton:1,salto:1};
MAPA.rutas.forEach(function(r){RUTA[r.de+'>'+r.a]=r;});
IDS.forEach(function(i){REV[i]=[];});IDS.forEach(function(i){ADY[i].forEach(function(b){REV[b].push(i);});});
var STARS=IDS.filter(function(i){return NOD[i].star||NOD[i].t==='azul';});   // las 15 marcadas + todas las azules (viajes más cortos, doc 05 apéndice A)
var PRIMERAS=['ccs_galipan','coc_puertocolombia','moc_mochima'];
var CHALECO={coc_barquisimeto:1,gua_pordaz:1};
function pasosArista(a,b){var r=RUTA[a+'>'+b];return r?(PASOS[r.modo]||1):1;}
function dij(src,libre){
  var d={},hecho={},i;IDS.forEach(function(x){d[x]=Infinity;});d[src]=0;
  for(;;){var u=null;for(i=0;i<IDS.length;i++){var x=IDS[i];if(!hecho[x]&&d[x]<Infinity&&(u===null||d[x]<d[u]))u=x;}
    if(u===null)break;hecho[u]=1;
    ADY[u].forEach(function(b){var r=RUTA[u+'>'+b];if(libre&&r&&(r.costo||r.req))return;var w=d[u]+pasosArista(u,b);if(w<d[b])d[b]=w;});}
  return d;
}
var DIST={};IDS.forEach(function(i){DIST[i]=dij(i,false);});
var DLIBRE=dij(INICIO,true);
function dist(a,b){var v=DIST[a]&&DIST[a][b];return v===undefined?Infinity:v;}

/* ───── utilidades ───── */
function clon(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x));}
function js(x){return x===undefined?'~':JSON.stringify(x);}
function fxMs(l){var t=0;for(var i=0;i<(l?l.length:0);i++)t+=FX_MS[l[i].k]||0;return t;}
function STATS0(m){return{gan:0,max:m,pasos:0,eventos:0,rojas:0,compras:0,ataques:0,dados:0,mj:0};}
function nom(N,s){return N.pj[s]?N.pj[s].name:s;}
function log(N,txt){N.log.push(txt);while(N.log.length>LOG_N)N.log.shift();}
function seats(N){return Object.keys(N.pj);}
function libre(o){return o.indexOf(null);}
function recta(N){return N.r>N.tot-5;}
function humanos(N,lista){return(lista||seats(N)).filter(function(s){return N.pj[s].cpu===null;});}
function rango(N){var l=seats(N).slice();l.sort(function(x,y){var a=N.pj[x],b=N.pj[y];return b.est-a.est||b.mon-a.mon||(x<y?-1:1);});return l;}
function precioPara(N,s){var p=N.pj[s];return p&&p.obj.indexOf('bono')>=0?Math.ceil(N.estrella.precio/2):N.estrella.precio;}
// Estrellas activas (M6 economía): S.estrella={nodo,b,precio}; 'nodo' es la 1.ª (compatibilidad) y 'b' la 2.ª (null con cfg.estrellas===1).
function estrellasEn(N){return N.estrella.b?[N.estrella.nodo,N.estrella.b]:[N.estrella.nodo];}
function idxEstrella(N,nodo){return N.estrella.nodo===nodo?0:(N.estrella.b&&N.estrella.b===nodo?1:-1);}
function setPath(N,p,v){var k=p.split('.'),o=N;for(var i=0;i<k.length-1;i++)o=o[k[i]];if(v===undefined)delete o[k[k.length-1]];else o[k[k.length-1]]=clon(v);}

/* ───── efectos: cada fx se aplica con AP; el reductor muta lo visible SOLO con emit() ───── */
var AP={
  hop:function(N,f){var p=N.pj[f.s];p.nodo=f.a;p.stats.pasos+=f.pasos;},
  mon:function(N,f){var p=N.pj[f.s];p.mon=f.tot;if(f.d>0)p.stats.gan+=f.d;if(f.tot>p.stats.max)p.stats.max=f.tot;},
  est:function(N,f){N.pj[f.s].est=f.tot;log(N,N.pj[f.s].name+(f.d>0?' ganó ':' perdió ')+Math.abs(f.d)+' estrella'+(Math.abs(f.d)>1?'s':''));},
  obj:function(N,f){var p=N.pj[f.s];p.obj=f.obj.slice();if(f.que==='compra'){p.stats.compras++;log(N,p.name+' compró '+OBJ[f.item].n);}},
  pasa:function(N,f){var st=N.pj[f.s].stats;if(f.que==='roja')st.rojas++;else if(EVT[f.que])st.eventos++;},
  dado:function(N,f){if(f.de!=='orden')N.pj[f.s].stats.dados+=f.v;},
  estrellaMueve:function(N,f){if(f.i===1){N.estrella.b=f.a;N.estrella.m1=N.r;}else{N.estrella.nodo=f.a;N.estrella.m0=N.r;}log(N,'La Abuela se mudó a '+NOD[f.a].n);},
  evento:function(N,f){log(N,(f.s?N.pj[f.s].name+': ':'')+f.txt);},
  ataque:function(N,f){N.pj[f.s].stats.ataques++;log(N,N.pj[f.s].name+' usó '+OBJ[f.item].n+' contra '+N.pj[f.a].name);},
  mjRes:function(N,f){if(f.empate){log(N,'Se fue la luz en todo el país: empate');return;}
    for(var i=0;i<f.as.length;i++)if(f.puestos[i]===1)N.pj[f.as[i]].stats.mj++;},
  afk:function(N,f){log(N,N.pj[f.s].name+' se fue a la hamaca (CPU)');},
  vuelve:function(N,f){log(N,'¡VOLVIÓ '+N.pj[f.s].name+'!');},
  llega:function(N,f){var p=N.pj[f.s];p.name=f.name;p.ch=f.ch;log(N,'¡LLEGÓ '+f.name+'!');},
  ronda:function(N,f){log(N,'RONDA '+f.r);},
  fin:function(N,f){log(N,'¡Ganó '+f.gan.map(function(s){return N.pj[s].name;}).join(' y ')+'!');},
  set:function(N,f){setPath(N,f.p,f.v);},
  ver:function(N,f){N.ver=f.v;}
};
function aplicaFx(N,f){if(AP[f.k])AP[f.k](N,f);return N;}
function emit(Z,f){Z.fx.push(f);aplicaFx(Z.N,f);return f;}
function anillo(N,v,s,fx){var c=clon(fx),b=JSON.stringify(c).length,tot=b;N.fx.push({v:v,s:s,b:b,fx:c});
  for(var i=0;i<N.fx.length-1;i++)tot+=N.fx[i].b;
  while(N.fx.length>1&&(N.fx.length>RING_N||tot>RING_MAX)){tot-=N.fx[0].b;N.fx.shift();}}
// Copia profunda del board salvo el anillo y el log: sus entradas son inmutables y se comparten (Goja: ~10 KB por acción menos).
function clonS(S){var o={},k;for(k in S)if(k!=='fx'&&k!=='log')o[k]=S[k];var N=clon(o);N.fx=S.fx?S.fx.slice():[];N.log=S.log?S.log.slice():[];return N;}
function proyectar(D,fx){var N=clonS(D),u=null;for(var i=0;i<fx.length;i++){aplicaFx(N,fx[i]);if(fx[i].k==='ver')u=fx[i];}
  if(u)anillo(N,u.v,u.s,fx);return N;}

/* ───── monedas, objetos, estrellas ───── */
function mon(Z,s,d,por){var p=Z.N.pj[s],tot=Math.max(0,p.mon+d);d=tot-p.mon;if(d)emit(Z,{k:'mon',s:s,d:d,tot:tot,por:por});return d;}
function est(Z,s,d,por){var p=Z.N.pj[s],tot=Math.max(0,p.est+d);d=tot-p.est;if(d)emit(Z,{k:'est',s:s,d:d,tot:tot,por:por});return d;}
// Tope de daño ajeno por ronda (doc 05 §10, lección de MP8): nadie pierde más de TOPE_DANO monedas por ataques de otros en una ronda.
var TOPE_DANO=20;
function dano(Z,s,n,por){var d=Z.N.tab.danoRonda||(Z.N.tab.danoRonda={}),ya=d[s]||0,q=Math.max(0,Math.min(n,TOPE_DANO-ya));if(!q)return 0;
  var r=-mon(Z,s,-q,por);d[s]=ya+r;return r;}
function darObj(Z,s,item,que){var o=Z.N.pj[s].obj.slice(),i=libre(o);if(i<0)return false;o[i]=item;emit(Z,{k:'obj',s:s,obj:o,item:item,que:que});return true;}
function quitarObj(Z,s,i,que){var o=Z.N.pj[s].obj.slice(),item=o[i];o[i]=null;emit(Z,{k:'obj',s:s,obj:o,item:item,que:que});return item;}
function usaPasivo(Z,s,item){var i=Z.N.pj[s].obj.indexOf(item);if(i<0)return false;quitarObj(Z,s,i,'usa');return true;}
function evento(Z,s,id,txt){emit(Z,{k:'evento',s:s||null,id:id,txt:txt});}
function tele(Z,s,a){var p=Z.N.pj[s];if(p.nodo!==a)emit(Z,{k:'hop',s:s,de:p.nodo,a:a,modo:'tele',pasos:0});}
function atras(Z,s,n){for(var i=0;i<n;i++){var p=Z.N.pj[s],b=REV[p.nodo][0];if(!b)return;emit(Z,{k:'hop',s:s,de:p.nodo,a:b,modo:'atras',pasos:0});}}
function moverEstrella(Z,comprador,idx){
  var N=Z.N,ss=seats(N),rk=rango(N),lider=rk[0],ultimo=rk[rk.length-1],reg=comprador?NOD[N.pj[comprador].nodo].r:null;
  if(idx===undefined||idx===null){                                // sin comprador (Dato del Vecino): se muda la que está más cerca del líder
    var e0=estrellasEn(N),bi=0;e0.forEach(function(x,i){if(dist(N.pj[lider].nodo,x)<dist(N.pj[lider].nodo,e0[bi]))bi=i;});idx=bi;}
  var prev=idx===1?N.estrella.b:N.estrella.nodo,otras=estrellasEn(N);
  var c=STARS.filter(function(x){if(x===prev||otras.indexOf(x)>=0||(reg&&NOD[x].r===reg))return false;
    for(var i=0;i<ss.length;i++)if(dist(N.pj[ss[i]].nodo,x)<4)return false;return true;});
  if(!c.length)c=STARS.filter(function(x){return otras.indexOf(x)<0;});
  var l=c.map(function(x){var w=2,mn=99;ss.forEach(function(q){mn=Math.min(mn,dist(N.pj[q].nodo,x));});
    if(Math.min(99,dist(N.pj[ultimo].nodo,x))<=10)w*=4;               // remontada: las que le quedan cerca al último
    if(DLIBRE[x]===Infinity)w/=2;if(dist(N.pj[lider].nodo,x)<=10)w=0;
    if(mn>8)w/=8;                                                     // la estrella se queda pegada a la acción
    if(otras.some(function(o){return o!==prev&&NOD[o].r===NOD[x].r;}))w/=4;   // las dos estrellas en regiones distintas
    return[x,w];});
  var vivos=l.filter(function(x){return x[1]>0;});
  var a=vivos.length?RNG.pesos(Z.r,vivos):Z.r.pick(c);
  emit(Z,{k:'estrellaMueve',de:prev,a:a,i:idx});
}
function comprarEstrella(Z,s){var N=Z.N,pr=precioPara(N,s);if(N.pj[s].mon<pr)return false;
  if(pr<N.estrella.precio)usaPasivo(Z,s,'bono');mon(Z,s,-pr,'estrella');est(Z,s,1,'compra');if(N.t)N.t.compro=1;moverEstrella(Z,s,idxEstrella(N,N.pj[s].nodo));return true;}

/* ───── tiendas ───── */
function precioObj(tid,item){return Math.ceil(OBJ[item].p*(TIENDAS[tid].x||1));}
function abierta(N,tid){return !N.tab.apagon||!!TIENDAS[tid].luz;}
function ofertaTienda(N,s){var p=N.pj[s],tid=NOD[p.nodo].tienda,d=tid&&TIENDAS[tid];if(!d||d.azar||!abierta(N,tid)||libre(p.obj)<0)return[];
  var st=N.tab.stock[tid];return d.o.filter(function(o){return st[o]>0&&precioObj(tid,o)<=p.mon;}).map(function(o){return{item:o,precio:precioObj(tid,o),quedan:st[o]};});}
function puedeTienda(N,s){var p=N.pj[s],tid=NOD[p.nodo].tienda;if(!tid||!abierta(N,tid)||libre(p.obj)<0)return false;
  return TIENDAS[tid].azar?p.mon>=1:ofertaTienda(N,s).length>0;}
function surtir(){var st={};Object.keys(TIENDAS).forEach(function(t){var d=TIENDAS[t];if(d.azar)return;st[t]={};d.o.forEach(function(o){st[t][o]=d.st||2;});});return st;}

/* ───── avisos (esp) y plazos ───── */
function abrir(Z,k,s,opc,plazo){
  var N=Z.N,p=N.pj[s],ms=fxMs(Z.fx);
  if(p.toma){p.toma=0;p.cpu=null;p.afk=0;}                       // toma de asiento: el control pasa en este límite (D14)
  N.esp={id:Z.S.ver+1,s:s,k:k,opc:opc||[],hasta:Z.now+ms+plazo};
  if(p.cpu){Z.P.cpuAt=Z.now+ms+T.cpu;N.nextAt=Math.min(N.esp.hasta,Z.P.cpuAt);}else{Z.P.cpuAt=null;N.nextAt=N.esp.hasta;}
}
function blancos(N,s,item){var d=OBJ[item];return seats(N).filter(function(x){if(x===s)return false;
  if(d.rango&&Math.min(dist(N.pj[s].nodo,N.pj[x].nodo),dist(N.pj[x].nodo,N.pj[s].nodo))>d.rango)return false;return true;});}
function opcDado(N,s){var p=N.pj[s],o=['TIRAR'];if(N.t.usado)return o;
  p.obj.forEach(function(it,i){if(!it||OBJ[it].pasivo)return;var e={slot:i,o:it};if(OBJ[it].blanco){e.bl=blancos(N,s,it);if(!e.bl.length)return;}o.push(e);});return o;}
function abrirDado(Z){var N=Z.N;abrir(Z,'DADO',N.t.s,opcDado(N,N.t.s),N.r===1?PLAZO.DADO1:PLAZO.DADO);}

/* ───── movimiento ───── */
function salidas(N,s,nodo,resto){
  var p=N.pj[s];return ADY[nodo].map(function(a){
    var k=nodo+'>'+a,r=RUTA[k],modo=r?r.modo:'camino',x={a:a,modo:modo,costo:0,pasos:PASOS[modo]||1,ok:true};
    if(r&&r.costo==='1+'){x.costo=N.tab.apagon?1:(N.tab.peajes[k]||1);x.peaje=1;}else if(r&&r.costo)x.costo=r.costo;
    if(CHALECO[nodo]&&N.tab.chaleco[nodo]===a){if(p.obj.indexOf('recibo')>=0)x.recibo=1;else x.costo+=recta(N)?8:5;x.chaleco=1;}
    if(r&&r.req==='llave'||r&&r.req==='paracaidas'){x.req=r.req;if(p.obj.indexOf(r.req)<0)x.ok=false;}
    if(r&&r.req==='isla_visible'&&!islaVisible(N))x.ok=false;
    if(N.tab.apagon&&modo==='teleferico')x.ok=false;
    if(x.costo>p.mon||x.pasos>resto)x.ok=false;
    return x;});
}
function forzada(op,p){for(var i=0;i<op.length;i++){var x=op[i];if(x.peaje&&!x.req)return x;}return null;}  // peaje obligado: paga lo que tenga
function islaVisible(N){return N.r%2===0||idxEstrella(N,'del_isla')>=0;}
function tomar(Z,x){
  var N=Z.N,t=N.t,s=t.s,p=N.pj[s],de=p.nodo,k=de+'>'+x.a;
  if(x.costo)mon(Z,s,-Math.min(x.costo,p.mon),x.peaje?'peaje':x.chaleco?'chaleco':'pasaje');
  if(x.peaje&&!N.tab.apagon)N.tab.peajes[k]=Math.min(10,(N.tab.peajes[k]||1)+1);
  if(x.recibo)usaPasivo(Z,s,'recibo');
  if(x.req==='llave'||x.req==='paracaidas')usaPasivo(Z,s,x.req);
  if(CHALECO[de]&&!x.chaleco)N.tab.chaleco[de]=x.a;               // el Señor del Chaleco se muda a la salida libre
  emit(Z,{k:'hop',s:s,de:de,a:x.a,modo:x.modo,pasos:x.pasos});
  t.resto=Math.max(0,t.resto-x.pasos);
  var su=N.tab.sueltas[x.a];if(su){delete N.tab.sueltas[x.a];mon(Z,s,su,'sueltas');}
  if(t.resto>0){pasar(Z,s);t.pend=ofertas(N,s);}
}
function ofertas(N,s){var p=N.pj[s],o=[];
  if(idxEstrella(N,p.nodo)>=0&&!N.t.compro&&p.mon>=precioPara(N,s))o.push('estrella');
  if(NOD[p.nodo].tienda&&puedeTienda(N,s))o.push('tienda');
  if(p.nodo==='and_sanantonio'&&p.mon>0)o.push('sanantonio');                 // alcabala de paso obligado: pagas o juegas al cambio
  if(p.nodo==='gua_guri'&&p.mon>=10&&N.tab.guriRonda!==N.r)o.push('guri');   // interruptor global, 1 cambio por ronda
  return o;}
function pasar(Z,s){                                              // efectos AL PASAR (sin caer)
  var N=Z.N,p=N.pj[s],n=p.nodo,ty=NOD[n].t;
  if(ty==='salida')mon(Z,s,5,'cafecito');
  else if(ty==='banco'){var d=-mon(Z,s,-(recta(N)?5:3),'banco');if(d)N.tab.bancos[n]+=d;}
  else if(ty==='alcabala')cobro(Z,s);
  else if(ty==='delta'&&Z.r.int(1,6)===6)cartaDelta(Z,s);
  if(ty==='roja'&&!N.t.colee){                                    // Colearse: al pasar por alguien en una casilla roja le quitas 2 (1 por turno)
    var v=seats(N).filter(function(x){return x!==s&&N.pj[x].nodo===n;})[0];
    if(v){var q=dano(Z,v,2,'colea');if(q){N.t.colee=1;evento(Z,s,'colea',N.pj[s].name+' se coló por '+N.pj[v].name+': +'+q);mon(Z,s,q,'colea');}}}
}
function cobro(Z,s){var n=Z.N.pj[s].nodo;if(n==='and_sanantonio')return;if(ADY[n].some(function(a){return RUTA[n+'>'+a]&&RUTA[n+'>'+a].costo==='1+';}))return;  // el Puente cobra en la arista
  mon(Z,s,-(recta(Z.N)?5:3),'alcabala');}
function ofrecer(Z,o){
  var N=Z.N,s=N.t.s,p=N.pj[s];
  if(o==='estrella'){if(p.mon<precioPara(N,s))return false;abrir(Z,'ESTRELLA',s,[{precio:precioPara(N,s)}],PLAZO.ESTRELLA);return true;}
  if(o==='sanantonio'){var cs=recta(N)?5:3;
    eligeAbrir(Z,s,'sanantonio','Casa de Cambio de San Antonio','Paso obligado: sellado o jugártela',[{id:'pagar',txt:'Pagar el sellado',sub:'−'+cs,off:false},
      {id:'cambio',txt:'Jugar al cambio',sub:'de −30 % a +50 %'}],'pagar');return true;}
  if(o==='guri'){eligeAbrir(Z,s,'guri','Represa de Guri','El interruptor de todo el país',[{id:'no',txt:'Dejarlo así'},
      {id:'si',txt:N.tab.apagon>0?'Prender la luz':'Apagar el país',sub:'−10',off:p.mon<10}],'no');return true;}
  if(!puedeTienda(N,s))return false;
  var tid=NOD[p.nodo].tienda,op;
  if(TIENDAS[tid].azar){var v=Z.r.shuffle(VENTA).slice(0,TIENDAS[tid].azar);op=v.map(function(it){return{item:it,precio:Z.r.int(1,15),quedan:1};})
    .filter(function(x){return x.precio<=p.mon;});if(!op.length)return false;}
  else op=ofertaTienda(N,s);
  abrir(Z,'TIENDA',s,op,PLAZO.TIENDA);return true;
}
function seguir(Z){                                               // corre el turno hasta el próximo aviso o el fin del turno
  var N=Z.N;
  for(var g=0;g<400;g++){
    var t=N.t;if(!t||N.f!=='turno')return;var s=t.s,p=N.pj[s];
    if(t.pend.length){if(ofrecer(Z,t.pend.shift()))return;continue;}
    if(t.paso==='mover'){
      if(t.resto>0){var op=salidas(N,s,p.nodo,t.resto),ok=op.filter(function(x){return x.ok;});
        if(ok.length>1&&p.st.oscuro===2){tomar(Z,Z.r.pick(ok));continue;}   // «A oscuras»
        if(ok.length>1){t.paso='decide';abrir(Z,'RUTA',s,op,PLAZO.RUTA);return;}
        var x=ok[0]||forzada(op,p);if(!x){t.resto=0;continue;}tomar(Z,x);continue;}
      t.paso='casilla';t.cas=1;t.pend=ofertas(N,s);continue;
    }
    if(t.paso==='casilla'){if(t.cas){t.cas=0;if(casilla(Z,s))return;if(t.ext>0){t.paso='mover';t.resto=t.ext;t.ext=0;}continue;}finTurno(Z);return;}
    return;
  }
  throw new Error('fiesta: seguir() sin salida');
}

/* ───── casillas ───── */
function casilla(Z,s){
  var N=Z.N,p=N.pj[s],n=p.nodo,ty=NOD[n].t,x=recta(N)?2:1,sinEsp=N.t.extHecho&&(ty==='evento'||ty==='especial');
  emit(Z,{k:'pasa',s:s,nodo:n,que:ty});
  p.col=ty==='azul'?'a':(ty==='roja'||ty==='villano'||ty==='alcabala')?'r':'v';
  if(ty==='azul')mon(Z,s,4*x,'azul');
  else if(ty==='roja')mon(Z,s,-3*x,'roja');
  else if(ty==='salida')mon(Z,s,3,'salida');
  else if(ty==='banco'){var b=N.tab.bancos[n];if(b){N.tab.bancos[n]=0;mon(Z,s,b,'banco');}}
  else if(ty==='transporte')mon(Z,s,2,'transporte');
  else if(ty==='evento'||ty==='especial'){if(!sinEsp){var rg=regional(Z,s,n);if(rg===2)return true;if(!rg)eventoRegion(Z,s);}}
  else if(ty==='vaina')vaina(Z,s);
  else if(ty==='villano')donCorte(Z,s);
  else if(ty==='alcabala')cobro(Z,s);
  else if(ty==='ahorita')ahorita(Z,s);
  else if(ty==='delta')cartaDelta(Z,s);
  else if(ty==='duelo'){var op=seats(N).filter(function(x){return x!==s;});abrir(Z,'OBJETIVO',s,op,PLAZO.OBJETIVO);N.t.duelo=1;return true;}
  return false;
}
/* ───── aviso ELIGE (doc 12 §1): elección genérica con opciones {id,txt,sub?,off?}; esp.def = opción por defecto (nunca off); el contexto vive en t.elige ───── */
function eligeAbrir(Z,s,que,tit,sub,opc,def,ctx){abrir(Z,'ELIGE',s,opc,PLAZO.ELIGE);var e=Z.N.esp;e.que=que;e.tit=tit;e.sub=sub||'';e.def=def;Z.N.t.elige=ctx||{};}
function bancoCerca(N,nodo){var b=null;Object.keys(N.tab.bancos).forEach(function(x){if(b===null||dist(nodo,x)<dist(nodo,b))b=x;});return b;}
function alternar(Z){var N=Z.N;if(N.tab.apagon>0){N.tab.apagon=0;evento(Z,null,'luz','Volvió la luz: la apagaron desde Guri');}else apagon(Z);}
function resolverElige(Z,s,que,id){            // devuelve 2 si abrió otro aviso (el turno no sigue todavía)
  var N=Z.N,t=N.t,p=N.pj[s],r=Z.r,ctx=t.elige||{},x,q;delete t.elige;
  if(que==='galipan'){
    if(id==='m4'){evento(Z,s,'galipan','Fresas con crema: +4');mon(Z,s,4,'evento');}
    else{x=id.slice(2);q=Math.max(1,OBJ[x].p-2);evento(Z,s,'galipan','Fresas con crema y '+OBJ[x].n);mon(Z,s,-q,'tienda');darObj(Z,s,x,'compra');t.compras++;}}
  else if(que==='morrocoy'){
    if(id==='playa'){evento(Z,s,'morrocoy','Día de playa en Cayo Sombrero: +2');mon(Z,s,2,'evento');}
    else{x=id.slice(2);mon(Z,s,-3,'pasaje');evento(Z,s,'morrocoy','Alquilaste la lancha a '+NOD[x].n);tele(Z,s,x);t.pend=ofertas(N,s);}}
  else if(que==='catatumbo1'){
    if(id==='azar'){if(r.int(1,2)===1){evento(Z,s,'rayo','El rayo te cargó el celular: +5');mon(Z,s,5,'evento');}else{evento(Z,s,'rayo','El rayo te cayó a ti: −5');mon(Z,s,-5,'evento');}}
    else{x=id.slice(2);mon(Z,s,-5,'rayo');
      if(usaPasivo(Z,x,'recibo')){evento(Z,x,'recibo','El recibo pagado frenó el rayo');return 0;}
      eligeAbrir(Z,s,'catatumbo2','Dirige el rayo contra '+nom(N,x),'¿Qué le haces?',[{id:'mon',txt:'Quitarle 8 monedas',sub:'van al banco más cercano'},
        {id:'lim',txt:'Su tirada será 1-5',sub:'en su próximo turno'}],'mon',{x:x});return 2;}}
  else if(que==='catatumbo2'){x=ctx.x;
    if(id==='mon'){q=dano(Z,x,8,'rayo');var b=bancoCerca(N,N.pj[x].nodo);if(q&&b)N.tab.bancos[b]+=q;evento(Z,x,'rayo','¡Rayo! '+nom(N,x)+' pierde '+q);}
    else{N.pj[x].st.lim5=1;evento(Z,x,'rayo','¡Rayo! '+nom(N,x)+' queda aturdido: su tirada será 1-5');}}
  else if(que==='pampatar'){
    if(id!=='no'){x=id.slice(2);evento(Z,s,'canon','¡CAÑONAZO a '+nom(N,x)+'! Retrocede 4');atras(Z,x,4);}}
  else if(que==='guri'){
    if(id==='si'){mon(Z,s,-10,'guri');N.tab.guriRonda=N.r;t.guriPago=1;alternar(Z);}}
  else if(que==='noronqui'){
    if(id==='si'){var es=estrellasEn(N),cay='roq_cayoagua',i=es.length>1&&dist(es[1],cay)>dist(es[0],cay)?1:0;
      mon(Z,s,-20,'vip');p.st.vip=1;evento(Z,s,'vip','Servicio VIP: la Abuela muda la estrella a Cayo de Agua');emit(Z,{k:'estrellaMueve',de:es[i],a:cay,i:i});}}
  else if(que==='isla'){
    if(id==='mon'){evento(Z,s,'isla','El tesoro del peñero: +10');mon(Z,s,10,'evento');}
    else{x=id.slice(2);evento(Z,s,'isla','El tesoro del peñero: '+OBJ[x].n);darObj(Z,s,x,'recibe');}}
  else if(que==='saltoangel'){
    if(id==='si'){mon(Z,s,-35,'premium');est(Z,s,1,'premium');p.st.premium=1;evento(Z,s,'premium','¡Estrella premium del Salto Ángel!');}}
  else if(que==='mochima'){
    if(id==='playa'){evento(Z,s,'playa','Te echaste en la playa: +8, pero la próxima tirada será 1-3');mon(Z,s,8,'evento');p.st.lim3=1;}
    else{mon(Z,s,-2,'pasaje');q=2*r.int(1,6);evento(Z,s,'playa','Peñero a las islas: pescaste '+q);mon(Z,s,q,'evento');}}
  else if(que==='sanantonio'){
    if(id==='pagar'){mon(Z,s,-Math.min(recta(N)?5:3,p.mon),'alcabala');}
    else{var d=r.int(1,6),m=p.mon,dd=d===1?-Math.floor(m*0.3):d<=3?0:d<=5?Math.floor(m*0.2):Math.min(15,Math.floor(m*0.5));
      evento(Z,s,'cambio','Casa de Cambio: '+(dd>0?'ganaste '+dd:dd<0?'perdiste '+(-dd):'quedó igual'));if(dd)mon(Z,s,dd,'cambio');}}
  return 0;
}

// Eventos propios de cada casilla (doc 12, R1: los que se resuelven solos). true = resuelto; false = cae a la tabla genérica.
function pasoHacia(Z,x,meta,k){for(var i=0;i<k;i++){var cur=Z.N.pj[x].nodo,best=null;
  ADY[cur].forEach(function(b){if(dist(b,meta)<dist(cur,meta)&&(best===null||dist(b,meta)<dist(best,meta)||(dist(b,meta)===dist(best,meta)&&b<best)))best=b;});
  if(!best)return i;emit(Z,{k:'hop',s:x,de:cur,a:best,modo:'camino',pasos:0});}return k;}
function extender(Z,s,n,txt){var t=Z.N.t;if(t.extHecho){mon(Z,s,2,'evento');return;}
  t.extHecho=1;t.ext=n;evento(Z,s,'avanza',txt.replace('#',n));}
function regional(Z,s,n){
  var N=Z.N,p=N.pj[s],r=Z.r,d,l,i;
  function conObj(){var o=[];p.obj.forEach(function(it,j){if(it)o.push(j);});return o;}
  switch(n){
  case'ccs_galipan':{var of=r.shuffle(VENTA).slice(0,2),op=[{id:'m4',txt:'+4 monedas',sub:'fresas con crema'}];
    of.forEach(function(it){var pr=Math.max(1,OBJ[it].p-2);op.push({id:'o:'+it,txt:OBJ[it].n,sub:pr+' monedas (−2)',off:p.mon<pr||libre(p.obj)<0});});
    eligeAbrir(Z,s,'galipan','Galipán: fresas con crema','Eliges: monedas o un objeto con descuento',op,'m4');return 2;}
  case'coc_morrocoy':{var mo=[{id:'playa',txt:'Día de playa',sub:'+2 monedas'}];
    ['coc_puertocolombia','coc_puertocabello','coc_coro'].forEach(function(d){mo.push({id:'l:'+d,txt:'Lancha a '+NOD[d].n,sub:'−3',off:p.mon<3});});
    eligeAbrir(Z,s,'morrocoy','Cayo Sombrero: alquila la lancha','¿Playa o atajo?',mo,'playa');return 2;}
  case'zul_catatumbo':{var ca=[{id:'azar',txt:'Que caiga donde caiga',sub:'gratis: ±5'}];
    seats(N).forEach(function(x){if(x!==s)ca.push({id:'r:'+x,txt:'Rayo a '+nom(N,x),sub:'−5',off:p.mon<5});});
    eligeAbrir(Z,s,'catatumbo1','Relámpago del Catatumbo','Dirige el rayo contra quien quieras, esté donde esté',ca,'azar');return 2;}
  case'mar_pampatar':{var cn=seats(N).filter(function(x){var rg=NOD[N.pj[x].nodo].r;return x!==s&&(rg==='mar'||rg==='moc');});
    if(!cn.length){evento(Z,s,'canon','Castillo de Pampatar: no hay a quién apuntar. +2');mon(Z,s,2,'evento');return 1;}
    eligeAbrir(Z,s,'pampatar','¡Cañonazo en Pampatar!','Apunta a alguien en Margarita u Oriente: retrocede 4',cn.map(function(x){return{id:'n:'+x,txt:nom(N,x),sub:'retrocede 4'};}).concat([{id:'no',txt:'Perdonar'}]),'no');return 2;}
  case'roq_noronqui':{var ev=estrellasEn(N);if(p.st.vip||recta(N)||ev.indexOf('roq_cayoagua')>=0)return false;
    eligeAbrir(Z,s,'noronqui','Noronquí: Servicio VIP','La Abuela muda una estrella a Cayo de Agua (una vez)',[{id:'no',txt:'No, gracias'},{id:'si',txt:'Pagar el VIP',sub:'−20',off:p.mon<20}],'no');return 2;}
  case'del_isla':{var ob=r.shuffle(VENTA).slice(0,2),oi=[{id:'mon',txt:'+10 monedas'}];
    if(libre(p.obj)>=0)ob.forEach(function(it){oi.push({id:'o:'+it,txt:OBJ[it].n,sub:'gratis'});});
    eligeAbrir(Z,s,'isla','La Isla que Aparece','El tesoro del peñero: elige',oi,'mon');return 2;}
  case'can_saltoangel':if(p.st.premium)return false;
    eligeAbrir(Z,s,'saltoangel','Salto Ángel: estrella premium','Una por jugador y partida',[{id:'no',txt:'Seguir de largo'},{id:'si',txt:'Comprar la estrella',sub:'35 monedas',off:p.mon<35}],'no');return 2;
  case'moc_mochima':
    eligeAbrir(Z,s,'mochima','Mochima: Playa Blanca','¿Playa o peñero a las islas?',[{id:'playa',txt:'Échate en la playa',sub:'+8, tirada 1-3'},{id:'islas',txt:'Peñero a las islas',sub:'−2 y pescas',off:p.mon<2}],'playa');return 2;
  case'gua_guri':if(!N.t.guriPago){evento(Z,s,'turnoguri','Turno de vigilante en Guri: +3');mon(Z,s,3,'evento');}return 1;
  case'coc_choroni':
    if(r.int(1,6)<=2){p.st.lim5=1;evento(Z,s,'curvas','¡Cuántas curvas! Te mareaste: tu próxima tirada es 1-5');}
    else{evento(Z,s,'curvas','Compraste cacao en la vía: +3');mon(Z,s,3,'evento');}return true;
  case'coc_coro':extender(Z,s,r.int(1,4),'Sandboard por los médanos: avanzas # más');return true;
  case'zul_gaita':evento(Z,s,'gaita','¡Gaitazo! Todos +2 y quien cae +5');seats(N).forEach(function(x){mon(Z,x,2,'evento');});mon(Z,s,5,'evento');return true;
  case'and_picoespejo':evento(Z,s,'selfie','Selfie a 4.765 m: +4');mon(Z,s,4,'evento');return true;
  case'and_aguila':
    for(i=0;i<p.obj.length;i++)if(p.obj[i]==='arepa'||p.obj[i]==='malta'||p.obj[i]==='guayoyo')break;
    if(i<p.obj.length){var com=quitarObj(Z,s,i,'usa');evento(Z,s,'paramo','Te pegó el páramo, pero te comiste '+OBJ[com].n+': sin límite');}
    else{p.st.lim5=1;evento(Z,s,'paramo','Te pegó el páramo: tu próxima tirada es 1-5');}return true;
  case'and_sancristobal':d=r.int(1,3);
    if(d===1){evento(Z,s,'feria','La Feria: +6');mon(Z,s,6,'evento');}
    else if(d===2){evento(Z,s,'feria','La Feria: un regalo');if(!darObj(Z,s,r.pick(VENTA),'recibe'))mon(Z,s,3,'evento');}
    else{evento(Z,s,'feria','Te pisaron en la multitud: -3');mon(Z,s,-3,'evento');}return true;
  case'lla_hato':
    if(r.int(1,6)>=4){evento(Z,s,'coleo','¡Colaste al toro! +8');mon(Z,s,8,'evento');}else evento(Z,s,'coleo','Te revolcó el polvero: nada');return true;
  case'lla_calabozo':
    if(r.int(1,6)<=3){l=conObj();evento(Z,s,'anguila','Anguila eléctrica: corrientazo');
      if(l.length)quitarObj(Z,s,r.pick(l),'pierde');else mon(Z,s,-3,'evento');}
    else{p.st.bonus2=1;evento(Z,s,'anguila','Cargaste la batería: tu próxima tirada +2');}return true;
  case'gua_elcallao':var c=0;
    seats(N).forEach(function(x){if(x===s||dist(N.pj[x].nodo,n)<1||dist(N.pj[x].nodo,n)>6)return;if(pasoHacia(Z,x,n,2)>0)c++;});
    evento(Z,s,'calipso',c?'Comparsa de calipso: se unieron '+c:'Comparsa de calipso: nadie se unió');if(c)mon(Z,s,Math.min(6,2*c),'evento');return true;
  case'can_roraima':d=r.int(1,6);
    if(d===1){evento(Z,s,'dino','¿Eso fue un dinosaurio? Te persigue: retrocedes 3');atras(Z,s,3);}
    else if(d<=5){evento(Z,s,'dino','¿Eso fue un dinosaurio? No: +4');mon(Z,s,4,'evento');}
    else{evento(Z,s,'dino','Encontraste un huevo raro');if(!darObj(Z,s,r.pick(VENTA),'recibe'))mon(Z,s,3,'evento');}return true;
  case'can_carrao':extender(Z,s,r.int(1,4),'Rápidos del Carrao: avanzas # más');return true;
  case'moc_caripe':p.st.oscuro=1;evento(Z,s,'oscuro','A oscuras en la cueva: +3, y en tu próximo turno los cruces salen al azar');mon(Z,s,3,'evento');return true;
  case'moc_higuerote':
    if(r.int(1,6)>=4){evento(Z,s,'tambores','Tambores: aciertas el ritmo, +6');mon(Z,s,6,'evento');}else{evento(Z,s,'tambores','Tambores: bailas igual, +1');mon(Z,s,1,'evento');}return true;
  case'mar_restinga':extender(Z,s,r.int(1,4),'Paseo por los manglares: avanzas # más');return true;
  case'roq_madrisqui':d=r.int(1,6);
    if(d<=2){evento(Z,s,'snorkel','Snorkel: te picó un erizo, -2');mon(Z,s,-2,'evento');}
    else if(d<=5){evento(Z,s,'snorkel','Snorkel: +4');mon(Z,s,4,'evento');}
    else{evento(Z,s,'snorkel','Snorkel: una botella con un mensaje');if(!darObj(Z,s,'dato','recibe'))mon(Z,s,3,'evento');}return true;
  }
  return false;
}
function eventoRegion(Z,s){
  var N=Z.N,id=RNG.pesos(Z.r,EVENTOS);evento(Z,s,id,TXT_EV[id]);
  if(id==='billete')mon(Z,s,5,'evento');
  else if(id==='cola')mon(Z,s,-3,'evento');
  else if(id==='regalo'){if(!darObj(Z,s,Z.r.pick(VENTA),'recibe'))mon(Z,s,3,'evento');}
  else if(id==='fresas')seats(N).forEach(function(x){mon(Z,x,2,'evento');});
  else if(id==='propina')mon(Z,s,Z.r.int(2,8),'evento');
  else if(id==='relampago')N.tab.relampago=1;
}
function vaina(Z,s){                                              // ¡Qué Vaina! (Chance Time): da, qué, recibe
  var N=Z.N,ss=seats(N),da=Z.r.pick(ss),re=Z.r.pick(ss.filter(function(x){return x!==da;}));
  var q=[5,10,'lugar'];if(N.r>=6)q=q.concat([20,'monedas','estrella']);var que=Z.r.pick(q);
  emit(Z,{k:'ruleta',s:s,que:'vaina',v:[da,que,re]});
  if(typeof que==='number'){var d=-mon(Z,da,-que,'vaina');if(d)mon(Z,re,d,'vaina');}
  else if(que==='lugar'){var a=N.pj[da].nodo,b=N.pj[re].nodo;tele(Z,da,b);tele(Z,re,a);}
  else if(que==='monedas'){var ma=N.pj[da].mon,mb=N.pj[re].mon;mon(Z,da,mb-ma,'vaina');mon(Z,re,ma-mb,'vaina');}
  else if(que==='estrella'){if(est(Z,da,-1,'vaina'))est(Z,re,1,'vaina');else{var d2=-mon(Z,da,-10,'vaina');if(d2)mon(Z,re,d2,'vaina');}}
}
function donCorte(Z,s){                                           // villano: ruleta de Don Corte (doc 05 §12.1)
  var N=Z.N,p=N.pj[s];
  if(!p.mon){evento(Z,s,'lastima','Don Corte le tuvo lástima: +10');mon(Z,s,10,'villano');return;}
  var v=Z.r.pick(['planta','planta','apagon','bombillo',N.r>=6&&!N.tab.reparto?'reparto':'planta','buendia']);
  emit(Z,{k:'ruleta',s:s,que:'villano',v:v});
  if(v!=='buendia'&&usaPasivo(Z,s,'recibo')){evento(Z,s,'recibo','«Tengo el recibo pagado»: no pasó nada');return;}
  if(v==='planta')mon(Z,s,-10,'villano');
  else if(v==='apagon')apagon(Z);
  else if(v==='bombillo'){var l=[];p.obj.forEach(function(o,i){if(o)l.push(i);});if(l.length)quitarObj(Z,s,Z.r.pick(l),'pierde');else mon(Z,s,-5,'villano');}
  else if(v==='reparto'){var ss=seats(N),sum=0;ss.forEach(function(x){sum+=N.pj[x].mon;});var c=Math.floor(sum/ss.length);
    N.tab.reparto=1;ss.forEach(function(x){mon(Z,x,c-N.pj[x].mon,'reparto');});}
  else mon(Z,s,5,'villano');
}
function apagon(Z){var N=Z.N;N.tab.apagon=3;N.tab.peajes={};evento(Z,null,'apagon','¡SE FUE LA LUZ! (3 rondas)');}
function ahorita(Z,s){var P=Z.P;if(P.ahorita[s])return;
  P.ahorita[s]={en:Z.r.int(1,4),que:RNG.pesos(Z.r,[['transferencia',2],['objeto',1],['nunca',1]])};
  Z.N.pj[s].st.ahorita=1;evento(Z,s,'ahorita','Le dieron una carta «ahorita»');}
function resolverAhorita(Z,s,que){
  if(que==='transferencia'){evento(Z,s,'ahorita','¡Llegó la transferencia!');mon(Z,s,10,'ahorita');}
  else if(que==='objeto'){evento(Z,s,'ahorita','Ahorita llegó el pedido');if(!darObj(Z,s,Z.r.pick(VENTA),'recibe'))mon(Z,s,3,'ahorita');}
  else evento(Z,s,'ahorita','Ahorita era nunca');
}
function cartaDelta(Z,s){
  var N=Z.N,P=Z.P,ss=seats(N);
  if(!P.deck.length){var d=[];DECK.forEach(function(c){for(var i=0;i<c[1];i++)d.push(c[0]);});P.deck=Z.r.shuffle(d);}
  var c=P.deck.pop();emit(Z,{k:'ruleta',s:s,que:'delta',v:c});
  if(c==='flota')mon(Z,s,Z.r.int(1,10),'delta');
  else if(c==='hunde')mon(Z,s,-Z.r.int(1,6),'delta');
  else if(c==='recalcula')tele(Z,s,Z.r.pick(IDS.filter(function(i){return NOD[i].r==='del'&&i!=='del_isla';})));
  else if(c==='telenovela'){var x=Z.r.shuffle(ss),a=N.pj[x[0]].nodo,b=N.pj[x[1]].nodo;tele(Z,x[0],b);tele(Z,x[1],a);}
  else if(c==='espejo'){var me=N.pj[s].nodo,far=null,fd=-1;ss.forEach(function(x){var dd=Math.min(99,dist(me,N.pj[x].nodo));if(x!==s&&dd>fd){fd=dd;far=x;}});
    var fn=N.pj[far].nodo;tele(Z,far,me);tele(Z,s,fn);}
  else if(c==='cedula'){tele(Z,s,INICIO);mon(Z,s,5,'delta');}
  else if(c==='hamaca')N.pj[s].st.hamaca=1;
  else if(c==='aprecia')ss.forEach(function(x){if(NOD[N.pj[x].nodo].r==='del')mon(Z,x,5,'delta');});
  else if(c==='vaca'){var bk=null;Object.keys(N.tab.bancos).forEach(function(b){if(bk===null||N.tab.bancos[b]>N.tab.bancos[bk])bk=b;});
    var v=N.tab.bancos[bk];if(v){N.tab.bancos[bk]=0;mon(Z,s,v,'delta');}}
  else if(c==='garza')tele(Z,s,Z.r.pick(IDS.filter(function(i){return(NOD[i].r==='moc'||NOD[i].r==='gua')&&NOD[i].t!=='salida';})));
  else if(c==='luz'){if(N.tab.apagon){N.tab.apagon=0;evento(Z,null,'luz','Volvió la luz');}else mon(Z,s,5,'delta');}
  else if(c==='apagon')apagon(Z);
  else if(c==='penero')atras(Z,s,Z.r.int(1,4));
}

/* ───── objetos en uso ───── */
function usar(Z,s,a){
  var N=Z.N,t=N.t,p=N.pj[s],i=a.slot,it=p.obj[i],d=it&&OBJ[it];
  if(t.usado||!d||d.pasivo)return'slot';
  var bl=null;if(d.blanco){bl=a.a;if(blancos(N,s,it).indexOf(bl)<0)return'objetivo';}
  if(it==='medida'&&!(a.n>=1&&a.n<=10&&Math.floor(a.n)===a.n))return'opcion';
  quitarObj(Z,s,i,'usa');t.usado=1;
  if(it==='malta'||it==='guayoyo')t.mod=it;
  else if(it==='arepa'){t.mod='arepa';delete p.st.senal;delete p.st.lim3;delete p.st.lim5;delete p.st.oscuro;}
  else if(it==='medida'){t.mod='medida';t.n=a.n;}
  else if(it==='dato'){evento(Z,s,'dato','«El dato del vecino»: la Abuela se muda');moverEstrella(Z,null,null);}
  else{var q=N.pj[bl];emit(Z,{k:'ataque',s:s,a:bl,item:it});
    if(it==='senal')q.st.senal=1;
    else if(it==='chancla'){var l=dano(Z,bl,5,'chancla'),n=q.nodo;if(l)N.tab.sueltas[n]=(N.tab.sueltas[n]||0)+l;atras(Z,bl,2);}
    else if(it==='tequeno'){
      if(usaPasivo(Z,bl,'recibo'))evento(Z,bl,'recibo','El recibo pagado frenó el tequeño');
      else{var l2=[];q.obj.forEach(function(o,j){if(o)l2.push(j);});
        if(l2.length){var ro=quitarObj(Z,bl,Z.r.pick(l2),'robo');darObj(Z,s,ro,'roba');}
        else{var m=dano(Z,bl,3,'tequeno');if(m)mon(Z,s,m,'tequeno');}}}
  }
  abrirDado(Z);return null;
}
function tirar(Z){
  var N=Z.N,t=N.t,s=t.s,p=N.pj[s],r=Z.r,dd,de='d10',tot=0,i;
  if(p.st.senal){dd=[r.int(1,3)];de='senal';delete p.st.senal;}
  else if(!t.mod&&(p.st.lim3||p.st.lim5)){dd=[r.int(1,p.st.lim3?3:5)];de='lim';}
  else if(t.mod==='malta'){dd=[r.int(1,10),r.int(1,10)];de='malta';}
  else if(t.mod==='guayoyo'){dd=[r.int(1,10),r.int(1,10),r.int(1,10)];de='guayoyo';}
  else if(t.mod==='medida'){dd=[t.n];de='medida';}
  else dd=[r.int(1,10)];
  delete p.st.lim3;delete p.st.lim5;                              // la comida (Malta, Guayoyo, Medida, Arepa) supera el límite
  for(i=0;i<dd.length;i++)tot+=dd[i];
  if(p.st.bonus2){tot+=2;delete p.st.bonus2;}
  if(t.mod==='arepa'&&de==='d10'){tot+=4;de='arepa';}
  emit(Z,{k:'dado',s:s,v:tot,dados:dd,de:de});
  if(de==='malta'&&dd[0]===dd[1])mon(Z,s,10,'dobles');
  if(de==='guayoyo'&&dd[0]===dd[1]&&dd[1]===dd[2])mon(Z,s,dd[0]===7?50:30,'trio');
  N.esp=null;t.paso='mover';t.resto=tot;t.mod=null;delete t.n;seguir(Z);
}

/* ───── turnos y rondas ───── */
function iniTurno(Z,s){
  var N=Z.N,p=N.pj[s];N.f='turno';N.esp=null;
  emit(Z,{k:'turno',s:s});
  N.t={s:s,paso:'pre',resto:0,usado:0,mod:null,pend:[],cas:0,compro:0,compras:0,desde:p.nodo};
  var ah=Z.P.ahorita[s];if(ah){ah.en--;if(ah.en<=0){delete Z.P.ahorita[s];delete p.st.ahorita;resolverAhorita(Z,s,ah.que);}}
  if(p.st.oscuro===1)p.st.oscuro=2;
  if(p.st.hamaca){delete p.st.hamaca;evento(Z,s,'hamaca','Se quedó en la hamaca: +8 por descansar');mon(Z,s,8,'hamaca');finTurno(Z);return;}
  abrirDado(Z);
}
function finTurno(Z){var N=Z.N,s=N.t.s,i=N.orden.indexOf(s);N.esp=null;if(N.pj[s].st.oscuro===2)delete N.pj[s].st.oscuro;N.t=null;Z.P.cpuAt=null;
  if(i<N.orden.length-1)iniTurno(Z,N.orden[i+1]);else formarMJ(Z,null);}
function iniRonda(Z,r){
  var N=Z.N;N.r=r;N.f='turno';emit(Z,{k:'ronda',r:r});N.tab.relampago=0;N.tab.danoRonda={};
  if(r>1&&(r-1)%5===0)N.tab.stock=surtir();
  if(N.tab.apagon>0){N.tab.apagon--;if(!N.tab.apagon)evento(Z,null,'luz','Volvió la luz… por ahora');}
  if(!islaVisible(N))seats(N).forEach(function(s){if(N.pj[s].nodo==='del_isla')tele(Z,s,'del_mercado');});
  if(N.cfg.tasa){var pr=Math.round(N.cfg.precio*Z.r.pick([0.75,1,1,1.25]));N.estrella.precio=pr;emit(Z,{k:'ruleta',s:null,que:'tasa',v:pr});}
  [0,1].forEach(function(i){var nodo=i===1?N.estrella.b:N.estrella.nodo;   // estrella estancada: 6 rondas sin mudarse => se muda sola
    if(nodo&&r-(N.estrella['m'+i]||0)>=6)moverEstrella(Z,null,i);});
  if(N.tot>=5&&r===N.tot-4)ultimos5(Z);
  iniTurno(Z,N.orden[0]);
}
function ultimos5(Z){                                             // Recta Final: ruleta del último lugar (doc 05 §14)
  var N=Z.N,s=rango(N).slice(-1)[0],v=Z.r.pick(['autobus','bono','vaca']);
  evento(Z,null,'ultimos5','¡ÚLTIMOS 5! Azules y rojas valen doble');emit(Z,{k:'ruleta',s:s,que:'ultimos5',v:v});
  if(v==='autobus'){var es=estrellasEn(N),st=es.reduce(function(m,x){return dist(N.pj[s].nodo,x)<dist(N.pj[s].nodo,m)?x:m;},es[0]),c=IDS.filter(function(x){var d=dist(x,st);return d>=1&&d<=3&&x!==st;});
    c.sort(function(a,b){return dist(b,st)-dist(a,st)||(a<b?-1:1);});if(c.length)tele(Z,s,c[0]);}
  else if(v==='bono'){if(!darObj(Z,s,'bono','recibe'))mon(Z,s,10,'ultimos5');}
  else{var falta=20;Object.keys(N.tab.bancos).forEach(function(b){var q=Math.min(falta,N.tab.bancos[b]);N.tab.bancos[b]-=q;falta-=q;});mon(Z,s,20,'ultimos5');}
}
function revelarOrden(Z){
  var N=Z.N,P=Z.P,ss=seats(N),v={},pool=[1,2,3,4,5,6,7,8,9,10];
  ss.forEach(function(s){var x=P.c.orden[s];if(x)pool.splice(pool.indexOf(x),1);});
  ss.forEach(function(s){var x=P.c.orden[s];if(!x){x=Z.r.pick(pool);pool.splice(pool.indexOf(x),1);}v[s]=x;emit(Z,{k:'dado',s:s,v:x,dados:[x],de:'orden'});});
  N.orden=ss.slice().sort(function(a,b){return v[b]-v[a];});P.c.orden={};N.esp=null;
  iniRonda(Z,1);
}

/* ───── minijuegos (el reductor solo arma la cola y recibe los puestos) ───── */
function nivel(N){return N.r<=N.tot/3?1:N.r<=2*N.tot/3?2:3;}
function elegir(Z,modo){var P=Z.P,l=CATALOGO.filter(function(g){return g.live&&!g.fuera&&g.m.indexOf(modo)>=0;});
  if(!l.length)return null;           // ningún juego en vivo admite ese formato: formarMJ degrada a ffa (DM2-15)
  var n=l.filter(function(g){return P.recientes.indexOf(g.g)<0;});var g=Z.r.pick(n.length?n:l);
  P.recientes.push(g.g);while(P.recientes.length>4)P.recientes.shift();return g;}
function formarMJ(Z,duelo){
  var N=Z.N,P=Z.P,as,tipo,eq,solo=null,i;
  if(duelo){as=[duelo.s,duelo.a].sort();tipo='1v1';eq=[[duelo.s],[duelo.a]];}
  else{as=seats(N).slice().sort();
    if(as.length<4){tipo='ffa';eq=as.map(function(s){return[s];});}
    else{var az=[],ro=[];as.forEach(function(s){var c=N.pj[s].col;
        if(c==='v'){c=Z.r.next()<0.5?'a':'r';emit(Z,{k:'ruleta',s:s,que:'color',v:c});}(c==='a'?az:ro).push(s);});
      if(!az.length||!ro.length){tipo='ffa';eq=as.map(function(s){return[s];});}
      else if(az.length===2){tipo='2v2';eq=[az,ro];}
      else{tipo='1v3';solo=az.length===1?az[0]:ro[0];eq=[[solo],as.filter(function(s){return s!==solo;})];}}}
  var rr=N.cfg.relampagoRondas||[Math.round(N.tot/2)];
  var rel=!duelo&&(N.cfg.ronda==='relampago'||N.tab.relampago||rr.indexOf(N.r)>=0);
  var lv=nivel(N),cola=[];
  if(rel){tipo='ffa';solo=null;eq=as.map(function(s){return[s];});
    var vivos=RELAMPAGO.filter(function(x){return CATALOGO.some(function(c){return c.g===x&&c.live;});}),mic=Z.r.shuffle(vivos.length?vivos:RELAMPAGO);
    for(i=0;i<5;i++){var gx=mic[i%mic.length],cx=CATALOGO.filter(function(c){return c.g===gx;})[0];
      cola.push({g:gx,seed:Z.r.int(1,2147483646),dur:10,lv:lv,modelo:cx?cx.mo:'A',reto:false});}}
  else{var g=elegir(Z,tipo);
    if(!g){tipo='ffa';solo=null;eq=as.map(function(s){return[s];});g=elegir(Z,'ffa');}
    cola.push({g:g.g,seed:Z.r.int(1,2147483646),dur:g.dur,lv:lv,modelo:g.mo,reto:false});}
  as.forEach(function(s){var p=N.pj[s];if(p.toma){p.toma=0;p.cpu=null;p.afk=0;}});
  var hs=humanos(N,as).sort(function(a,b){return(a===solo)-(b===solo)||(a<b?-1:1);});
  humanos(N).forEach(function(s){if(hs.indexOf(s)<0)hs.push(s);});
  var clase=rel?'rank':(tipo==='2v2'||tipo==='1v3')?'binary':(CATALOGO.filter(function(x){return x.g===cola[0].g;})[0]||{cl:'rank'}).cl;
  N.tab.k++;
  N.mj={k:N.tab.k,tipo:tipo,clase:clase,eq:eq,solo:solo,as:as,cola:cola,i:0,juez:hs[0]||null,suc:hs.slice(1),e:0,
    cartaHasta:0,startAt:null,cierre:null,listos:{},watch:0,res:null,duelo:duelo||null,rel:rel?1:0,suma:rel?{}:null};
  emit(Z,{k:'mjIni',mk:N.tab.k,tipo:tipo,eq:eq,g:cola[0].g,rel:rel?1:0});
  N.f='carta';N.esp=null;Z.P.cpuAt=null;
  N.mj.cartaHasta=Z.now+fxMs(Z.fx)+(rel?T.relCarta:T.carta);N.nextAt=N.mj.cartaHasta;
}
function listosTodos(N){var mj=N.mj;return humanos(N,mj.as).every(function(s){return mj.listos[s];});}
function empezarMJ(Z){var N=Z.N,mj=N.mj,g=mj.cola[mj.i];N.f='mj';mj.startAt=Z.now+T.cuenta;mj.cierre=mj.startAt+g.dur*1000+T.cierre;N.nextAt=mj.cierre;}
function eqIdx(mj){return mj.as.map(function(s,i){if(mj.tipo==='ffa'||mj.tipo==='1v1')return i;
  for(var j=0;j<mj.eq.length;j++)if(mj.eq[j].indexOf(s)>=0)return j;return i;});}
function resultadoMJ(Z,a,vencido){
  var N=Z.N,mj=N.mj,n=mj.as.length,sc=null,pu,pg,i;
  if(!vencido){sc=a.sc;if(!sc||sc.length!==n)return'opcion';for(i=0;i<n;i++)if(typeof sc[i]!=='number'||!isFinite(sc[i]))return'opcion';
    var eqi=eqIdx(mj),soloI=mj.solo?mj.as.indexOf(mj.solo):-1;
    if(a.pl&&a.pl.length===n&&a.pl.every(function(x){return x>=1&&x<=n&&Math.floor(x)===x;}))pu=a.pl.slice();
    else pu=compara(mj.tipo==='1v3'?'1v3':mj.tipo==='2v2'?'2v2':'ffa',eqi,sc).puestos;
    if(mj.duelo){var g=[];pu.forEach(function(p,j){if(p===1)g.push(j);});pg=[0,0];
      var w=g.length===1?g[0]:-1,d=w<0?0:Math.min(mj.duelo.apuesta,N.pj[mj.as[1-w]].mon);if(d){pg[w]=d;pg[1-w]=-d;}
      emit(Z,{k:'mjRes',mk:mj.k,i:mj.i,as:mj.as,puestos:pu.slice(),pagos:pg.slice()});
      if(d){mon(Z,mj.as[1-w],-d,'duelo');mon(Z,mj.as[w],d,'duelo');}}
    else{pg=pagosMJ(mj.tipo,pu,N.r,{tot:N.tot,eq:eqi,solo:soloI,relampago:mj.rel,recogidos:a.recogidos});
      emit(Z,{k:'mjRes',mk:mj.k,i:mj.i,as:mj.as,puestos:pu.slice(),pagos:pg.slice()});
      for(i=0;i<n;i++)if(pg[i])mon(Z,mj.as[i],pg[i],'mj');}
  }else{pu=mj.as.map(function(){return 1;});pg=mj.as.map(function(){return 0;});emit(Z,{k:'mjRes',mk:mj.k,i:mj.i,as:mj.as,puestos:pu,pagos:pg,empate:1});}
  mj.res={sc:sc,puestos:pu,pagos:pg,empate:vencido?1:0,cpu:a&&a.cpu||[],h:a&&a.h||0,por:a&&a.por||(vencido?'plazo':'juez'),disputado:!!(a&&a.disputado),aj:!!(a&&a.aj)};
  if(mj.rel){mj.as.forEach(function(s,j){mj.suma[s]=(mj.suma[s]||0)+pg[j];});
    if(mj.i<mj.cola.length-1){mj.i++;mj.listos={};mj.startAt=null;mj.cierre=null;N.f='carta';
      mj.e=0;mj.jz=0;mj.suc=humanos(N,mj.as).filter(function(x){return x!==mj.juez;});
      mj.cartaHasta=Z.now+fxMs(Z.fx)+T.relRes+T.relCarta;N.nextAt=mj.cartaHasta;return null;}
    var mx=0;mj.as.forEach(function(s){if(mj.suma[s]>mx)mx=mj.suma[s];});
    if(mx>0)mj.as.forEach(function(s){if(mj.suma[s]===mx){evento(Z,s,'rey','¡El rey de la rumba! +5');mon(Z,s,5,'rey');}});}
  N.f='res';N.nextAt=Z.now+fxMs(Z.fx)+T.res;return null;
}
function postRes(Z){var N=Z.N,mj=N.mj;N.mj=null;
  if(mj.duelo){N.f='turno';finTurno(Z);}else if(N.r>=N.tot)final(Z);else iniRonda(Z,N.r+1);}
function final(Z){
  var N=Z.N,ss=seats(N);N.t=null;N.esp=null;N.f='final';
  if(N.cfg.bonus)['minijuegos','ricachon',Z.P.bonusOculta].forEach(function(id){var k=ST_BONUS[id],mx=0;
    ss.forEach(function(s){if(N.pj[s].stats[k]>mx)mx=N.pj[s].stats[k];});
    if(mx>0)ss.forEach(function(s){if(N.pj[s].stats[k]===mx){emit(Z,{k:'bonus',s:s,id:id,v:mx});est(Z,s,1,'bonus');}});});
  var rk=rango(N),pod=[];rk.forEach(function(s,i){var p=N.pj[s],q=pod[i-1],pu=q&&q.est===p.est&&q.mon===p.mon?q.p:i+1;pod.push({s:s,est:p.est,mon:p.mon,p:pu});});
  N.podio=pod;emit(Z,{k:'fin',gan:pod.filter(function(x){return x.p===1;}).map(function(x){return x.s;})});
  N.nextAt=Z.now+fxMs(Z.fx)+T.final;
}

/* ───── pagos y comparación (doc 08 §8) ───── */
function promArriba(tabla,p,puestos){var c=0,i,s=0;for(i=0;i<puestos.length;i++)if(puestos[i]===p)c++;
  for(i=0;i<c;i++)s+=tabla[p-1+i]||0;return Math.ceil(s/Math.max(1,c));}
function pagosMJ(tipo,puestos,ronda,x){
  x=x||{};var n=puestos.length,mult=(ronda%5===0&&ronda!==x.tot)?2:1,m,i,iguales=puestos.every(function(p){return p===puestos[0];});
  if(x.relampago)m=puestos.map(function(p){return promArriba([3,2,1,0],p,puestos);});
  else if(x.reto)m=puestos.map(function(p){return promArriba([15,9,5,2],p,puestos);});
  else if(tipo==='2v2')m=iguales?puestos.map(function(){return 4;}):puestos.map(function(p){return p===1?7:2;});
  else if(tipo==='1v3'){var so=x.solo>=0&&x.solo!==undefined?x.solo:-1;
    if(so<0)for(i=0;i<n;i++){var c=0;for(var j=0;j<n;j++)if(puestos[j]===puestos[i])c++;if(c===1)so=i;}
    if(iguales||so<0)m=puestos.map(function(p,j){return j===so?5:2;});
    else if(puestos[so]===1)m=puestos.map(function(p,j){return j===so?12:0;});
    else m=puestos.map(function(p,j){return j===so?0:4;});}
  else m=puestos.map(function(p){return promArriba([14,9,5,2],p,puestos);});
  return m.map(function(v,j){var b=x.recogidos?Math.min(3,Math.floor((x.recogidos[j]||0)/5)):0,t=(v+b)*mult;
    if(x.reto&&x.final)t=Math.ceil(t*1.5);return t;});
}
// Movido de fiesta-vs.js (misma semántica): ffa por score; 2v2 suma del equipo; 1v3 el solo contra la MEDIA del trío.
function compara(modo,eq,sc){
  var team={};eq.forEach(function(t,i){(team[t]=team[t]||[]).push(i);});
  var ts=Object.keys(team).map(function(t){var ids=team[t],sum=0;ids.forEach(function(i){sum+=sc[i];});
    return{t:+t,ids:ids,v:modo==='1v3'?(ids.length===1?sc[ids[0]]:sum/ids.length):sum};});
  ts.sort(function(a,b){return b.v-a.v;});
  var puestoEq={};ts.forEach(function(x,i){puestoEq[x.t]=i>0&&Math.abs(ts[i-1].v-x.v)<1e-9?puestoEq[ts[i-1].t]:i+1;});
  var puestos=eq.map(function(t){return puestoEq[t];}),best=Math.min.apply(null,puestos);
  return{puestos:puestos,ganadores:puestos.map(function(p,i){return p===best?i:-1;}).filter(function(i){return i>=0;}),equipoGanador:ts[0].t,tabla:ts};
}
function equipos(modo,n,solo){
  if(modo==='2v2'&&n===4)return[0,0,1,1];
  if(modo==='1v3'&&n===4){var s=solo>=0?solo:0;return[0,1,2,3].map(function(i){return i===s?0:1;});}
  var r=[];for(var i=0;i<n;i++)r.push(i);return r;
}

/* ───── crear / aplicar / tick ───── */
function lobby(cfg){return{f:'lobby',cfg:Object.assign({},CFG0,cfg||{}),pj:{},ver:0,fx:[],log:[]};}
function crear(semilla,cfg,asientos,ahora){
  var c=Object.assign({},CFG0,cfg||{}),n=c.n,now=ahora||0,i;
  if(!(n>=2&&n<=4))throw new Error('fiesta: cfg.n debe ser 2..4');
  if(!(c.tot>=1))throw new Error('fiesta: cfg.tot debe ser >=1');
  asientos=asientos||[];if(asientos.length>n)throw new Error('fiesta: demasiados asientos');
  var r=RNG.crear(semilla),usados={},pj={};
  asientos.forEach(function(a){if(a&&a.ch&&!usados[a.ch]&&PERSONAJES.some(function(x){return x.id===a.ch;}))usados[a.ch]=1;});
  var libres=r.shuffle(PERSONAJES.filter(function(x){return!usados[x.id];}));
  for(i=0;i<n;i++){var s=SEATS[i],a=asientos[i],ch,cpu=a?(a.cpu==='auto'?'auto':null):'auto';
    ch=a&&a.ch&&usados[a.ch]===1?(usados[a.ch]=2,a.ch):libres.shift().id;
    var pn=PERSONAJES.filter(function(x){return x.id===ch;})[0].n;
    pj[s]={ch:ch,name:a&&a.name?String(a.name).slice(0,16):(cpu?'CPU · '+pn:pn),nodo:INICIO,mon:c.mon0,est:0,obj:[null,null,null],st:{},
      cpu:cpu,afk:0,toma:0,col:'v',stats:STATS0(c.mon0)};}
  var bancos={};IDS.forEach(function(x){if(NOD[x].t==='banco')bancos[x]=0;});
  var chal={};Object.keys(CHALECO).forEach(function(x){chal[x]=ADY[x][0];});
  var A0=r.pick(PRIMERAS);
  var S={f:'orden',r:0,tot:c.tot,cfg:c,orden:[],t:null,esp:null,pj:pj,estrella:{nodo:A0,b:c.estrellas===1?null:PRIMERAS[(PRIMERAS.indexOf(A0)+1)%PRIMERAS.length],precio:c.precio},
    tab:{k:0,peajes:{},bancos:bancos,stock:surtir(),chaleco:chal,apagon:0,sueltas:{},relampago:0,reparto:0},
    mj:null,podio:null,nextAt:now,ver:1,fx:[],log:[]};
  var hs=Object.keys(pj).filter(function(s){return pj[s].cpu===null;});
  S.esp={id:1,s:'*',k:'COMMIT',c:'orden',quien:hs,hecho:{},opc:[],hasta:now+PLAZO.COMMIT};
  if(hs.length)S.nextAt=S.esp.hasta;
  var P={rng:0,semilla:semilla,deck:[],bonusOculta:r.pick(BONUS_OCULTOS),c:{orden:{}},aid:{},cpuAt:null,ahorita:{},recientes:[]};
  P.rng=r.estado;
  return{S:S,priv:P};
}
function ctx(S,P,ahora){var Q=clon(P);return{N:clonS(S),P:Q,S:S,fx:[],now:ahora||0,r:RNG.desde(Q.rng),auto:false};}
function cerrar(Z,s){
  var N=Z.N,S=Z.S;Z.P.rng=Z.r.estado;
  CTRL.forEach(function(k){if(js(N[k])!==js(S[k]))Z.fx.push({k:'set',p:k,v:clon(N[k])});});
  Object.keys(N.pj).forEach(function(x){PCTRL.forEach(function(k){if(js(N.pj[x][k])!==js(S.pj[x][k]))Z.fx.push({k:'set',p:'pj.'+x+'.'+k,v:clon(N.pj[x][k])});});});
  emit(Z,{k:'ver',v:S.ver+1,s:s});anillo(N,S.ver+1,s,Z.fx);
  return{S:N,priv:Z.P,fx:Z.fx,error:null};
}
function volver(Z,s){var N=Z.N,p=N.pj[s];p.cpu=null;p.afk=0;emit(Z,{k:'vuelve',s:s});
  if(N.esp&&N.esp.s===s){Z.P.cpuAt=null;N.nextAt=N.esp.hasta;}}
function ejecutar(Z,s,a){
  var N=Z.N,t=a&&a.t,p,e;
  if(typeof t!=='string')return'accion';
  if(N.f==='fin'||N.f==='final'||N.f==='lobby')return'fase';
  if(s==='$'){
    if(t==='MJ_RESULTADO'||t==='MJ_RESULT'){if(N.f!=='mj'||!N.mj||a.k!==N.mj.k||(a.i!=null&&a.i!==N.mj.i))return'fase';return resultadoMJ(Z,a,false);}
    if(t==='JUEZ_ELEGIR'){var jm=N.mj;   // M2 DM2-9: el servidor elige al juez por presencia (RTT) justo tras fijar startAt; solo antes de la cuenta y en la época 0
      if(!((N.f==='carta'||N.f==='mj')&&jm&&a.k===jm.k&&jm.e===0&&(jm.startAt==null||Z.now<jm.startAt)))return'cas';
      var hh=humanos(N,jm.as),su=Array.isArray(a.suc)?a.suc:[],vis={};if(hh.indexOf(a.juez)<0)return'cas';
      for(var q=0;q<su.length;q++){if(hh.indexOf(su[q])<0||su[q]===a.juez||vis[su[q]])return'cas';vis[su[q]]=1;}
      jm.juez=a.juez;jm.suc=su.slice();jm.jz=1;return null;}
    if(t==='TOMAR_ASIENTO'){p=N.pj[a.s];if(!p||p.cpu===null)return'asiento';
      var ch=p.ch;if(a.ch&&a.ch!==ch&&!N.cfg.dadosPj&&PERSONAJES.some(function(x){return x.id===a.ch;})&&!seats(N).some(function(x){return N.pj[x].ch===a.ch;}))ch=a.ch;
      emit(Z,{k:'llega',s:a.s,name:String(a.name||'PANA').slice(0,16),ch:ch});p.toma=1;
      if(!(N.esp&&(N.esp.s===a.s))&&!(N.mj&&N.mj.as.indexOf(a.s)>=0&&N.f!=='turno')){p.toma=0;p.cpu=null;p.afk=0;}
      return null;}
    if(t==='AFK'){p=N.pj[a.s];if(!p||p.cpu!==null)return'asiento';p.cpu='afk';emit(Z,{k:'afk',s:a.s});
      if(N.esp&&N.esp.s===a.s){Z.P.cpuAt=Z.now+T.cpu;N.nextAt=Math.min(N.esp.hasta,Z.P.cpuAt);}return null;}
    return'accion';
  }
  p=N.pj[s];if(!p)return'asiento';
  if(t==='VOLVER'){if(p.cpu!=='afk')return'asiento';volver(Z,s);return null;}
  if(t==='SALIR'){if(p.cpu!==null)return'asiento';return ejecutar(Z,'$',{t:'AFK',s:s});}
  if(t==='LISTO'){if(N.f!=='carta'||N.mj.as.indexOf(s)<0||p.cpu!==null)return'fase';if(N.mj.listos[s])return null;
    N.mj.listos[s]=1;if(listosTodos(N))empezarMJ(Z);return null;}
  if(t==='JUEZ'){if((N.f!=='carta'&&N.f!=='mj')||p.cpu!==null||a.k!==N.mj.k||a.e!==N.mj.e||(a.q!=null&&a.q!==N.mj.i))return'cas';
    if(N.mj.as.indexOf(s)<0)return'asiento';N.mj.juez=s;N.mj.e++;
    N.mj.suc=N.mj.suc.filter(function(x){return x!==s;});return null;}
  e=N.esp;
  if(t==='COMMIT'){if(N.f!=='orden'||!e||e.k!=='COMMIT'||a.k!=='orden')return'fase';if(e.quien.indexOf(s)<0)return'turno';
    if(a.eid!=null&&a.eid!==e.id)return'eid';if(e.hecho[s])return null;
    var usados=Object.keys(Z.P.c.orden).map(function(x){return Z.P.c.orden[x];}),pool=[1,2,3,4,5,6,7,8,9,10].filter(function(v){return usados.indexOf(v)<0;});
    Z.P.c.orden[s]=Z.r.pick(pool);e.hecho[s]=1;
    if(e.quien.every(function(x){return e.hecho[x];}))revelarOrden(Z);return null;}
  if(N.f!=='turno'||!e)return'fase';
  if(e.s!==s)return'turno';
  if(a.eid!=null&&a.eid!==e.id)return'eid';
  if(a.ver!=null&&a.ver!==Z.S.ver)return'ver';
  if(p.cpu==='auto'&&!Z.auto)return'cpu';
  if(!Z.auto){if(p.cpu==='afk')volver(Z,s);p.afk=0;}
  if(e.k==='DADO'){if(t==='TIRAR'){tirar(Z);return null;}if(t==='USAR')return usar(Z,s,a);return'accion';}
  if(e.k==='RUTA'){if(t!=='RUTA')return'accion';var x=e.opc.filter(function(o){return o.a===a.a&&o.ok;})[0];if(!x)return'opcion';
    N.esp=null;N.t.paso='mover';tomar(Z,x);seguir(Z);return null;}
  if(e.k==='ESTRELLA'){if(t!=='ESTRELLA')return'accion';N.esp=null;if(a.si&&!comprarEstrella(Z,s))return'monedas';seguir(Z);return null;}
  if(e.k==='TIENDA'){if(t!=='COMPRAR')return'accion';N.esp=null;
    if(a.item){var o=e.opc.filter(function(x){return x.item===a.item;})[0];if(!o)return'opcion';if(p.mon<o.precio)return'monedas';if(libre(p.obj)<0)return'slot';
      var tid=NOD[p.nodo].tienda;if(!TIENDAS[tid].azar)N.tab.stock[tid][a.item]--;
      mon(Z,s,-o.precio,'tienda');darObj(Z,s,a.item,'compra');N.t.compras++;
      if(!TIENDAS[tid].azar&&puedeTienda(N,s))N.t.pend.unshift('tienda');}
    seguir(Z);return null;}
  if(e.k==='ELIGE'){if(t!=='ELIGE')return'accion';var oe=e.opc.filter(function(x){return x.id===a.id;})[0];if(!oe||oe.off)return'opcion';
    N.esp=null;resolverElige(Z,s,e.que,oe.id);if(!N.esp)seguir(Z);return null;}
  if(e.k==='OBJETIVO'){if(t!=='OBJETIVO')return'accion';if(e.opc.indexOf(a.a)<0)return'objetivo';N.esp=null;N.t.duelo=0;
    var ap=Math.min(Z.r.pick([5,10,20]),p.mon,N.pj[a.a].mon);emit(Z,{k:'ruleta',s:s,que:'duelo',v:ap,a:a.a});
    if(ap<=0){evento(Z,s,'pelaos','Duelo de pelaos: nadie tiene real');seguir(Z);return null;}
    formarMJ(Z,{s:s,a:a.a,apuesta:ap});return null;}
  return'accion';
}
function aplicar(S,P,s,a,ahora){
  if(a&&a.aid&&s&&s!=='$'&&P.aid&&P.aid[s]===a.aid)return{S:S,priv:P,fx:[],error:null,dup:true};
  var Z=ctx(S,P,ahora),e=ejecutar(Z,s,a);
  if(e)return{S:S,priv:P,fx:[],error:e};
  if(a.aid&&s&&s!=='$')Z.P.aid[s]=a.aid;
  return cerrar(Z,s);
}
// Acción por defecto al vencer un aviso (doc 07 §7.3).
function defecto(N,s){var e=N.esp,p=N.pj[s];
  if(e.k==='DADO')return{t:'TIRAR',eid:e.id};
  if(e.k==='RUTA'){var ok=e.opc.filter(function(o){return o.ok;}),m=ok.filter(function(o){return o.a===ADY[p.nodo][0];})[0]||ok[0];return{t:'RUTA',a:m.a,eid:e.id};}
  if(e.k==='TIENDA')return{t:'COMPRAR',item:null,eid:e.id};
  if(e.k==='ESTRELLA')return{t:'ESTRELLA',si:p.mon>=e.opc[0].precio,eid:e.id};
  if(e.k==='ELIGE')return{t:'ELIGE',id:e.def,eid:e.id};
  if(e.k==='OBJETIVO'){var rk=rango(N).filter(function(x){return x!==s;});return{t:'OBJETIVO',a:rk[0],eid:e.id};}
  return null;}
function vence(S,P,now){
  var e=S.esp,f=S.f;
  if(f==='orden'&&e)return(e.quien.every(function(x){return e.hecho[x];})||now>=e.hasta)?'orden':null;
  if(f==='turno'&&e){var p=S.pj[e.s];if(p.cpu)return P.cpuAt!=null&&now>=P.cpuAt?'cpu':null;return now>=e.hasta?'plazo':null;}
  if(f==='carta'&&S.mj){var hay=humanos(S,S.mj.as).length>0;return(now>=S.mj.cartaHasta||(hay&&listosTodos(S)))?'carta':null;}
  if(f==='mj'&&S.mj)return now>=S.mj.cierre?'cierre':null;
  if((f==='res'||f==='final')&&S.nextAt!=null)return now>=S.nextAt?f:null;
  return null;
}
function tick(S,P,ahora){
  var due=vence(S,P,ahora);if(!due)return{S:S,priv:P,fx:[],error:null,nada:true};
  var Z,N,e;
  if(due==='cpu'){                                                // la CPU decide sobre el board de solo lectura con el RNG oculto
    var r0=RNG.desde(P.rng),C=CPU(),act=C?C.decide(S,vista(S,S.esp.s,P),S.esp.s,r0):null;
    if(act){Z=ctx(S,P,ahora);Z.auto=true;Z.r=r0;if(!ejecutar(Z,S.esp.s,act))return cerrar(Z,'$');}
  }
  Z=ctx(S,P,ahora);N=Z.N;Z.auto=true;
  if(due==='orden')revelarOrden(Z);
  else if(due==='cpu'||due==='plazo'){
    var s=N.esp.s,p=N.pj[s];
    if(due==='plazo'&&N.esp.k==='DADO'){p.afk++;if(p.afk>=2&&p.cpu===null){p.cpu='afk';emit(Z,{k:'afk',s:s});}}
    e=ejecutar(Z,s,defecto(N,s));if(e)throw new Error('fiesta: acción por defecto inválida '+e);
  }
  else if(due==='carta')empezarMJ(Z);
  else if(due==='cierre')resultadoMJ(Z,null,true);
  else if(due==='res')postRes(Z);
  else if(due==='final'){N.f='fin';N.nextAt=null;}
  return cerrar(Z,'$');
}

/* ───── vista por asiento (lo que el cliente puede hacer; con priv = ruta mine) ───── */
function vista(S,s,P){
  var e=S.esp,p=S.pj&&S.pj[s]||null,mio=false;
  if(e&&p)mio=e.k==='COMMIT'?(e.quien.indexOf(s)>=0&&!e.hecho[s]):e.s===s;
  var v={s:s,f:S.f,mio:mio,esp:mio?e:null,pj:p,precio:p?precioPara(S,s):null,
    listo:!!(S.f==='carta'&&S.mj&&p&&p.cpu===null&&S.mj.as.indexOf(s)>=0&&!S.mj.listos[s]),
    estrella:S.estrella?S.estrella.nodo:null,estrellas:S.estrella?estrellasEn(S):[],t:S.t};
  if(P&&p)v.priv={orden:P.c&&P.c.orden[s]||null,ahorita:P.ahorita&&P.ahorita[s]?1:0};
  return v;
}
// Utilidades del veredicto (M2-SPEC §3.2): las usan el cliente (fiesta-live) y el servidor, así el mismo (sc, kk) da el mismo puesto y el mismo hash.
function fnv(str){var h=0x811c9dc5;for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function hashRes(sc,pl,kk){return fnv(sc.join(',')+'|'+pl.join(',')+'|'+kk);}
// une en un racimo los valores consecutivos (de mayor a menor) que difieren <=3 ticks (100 ms); el racimo toma su máximo. Idempotente.
function normSurvival(sc){var ix=sc.map(function(v,i){return i;}).sort(function(a,b){return sc[b]-sc[a]||a-b;}),out=sc.slice(),top=null,prev=null;
  for(var j=0;j<ix.length;j++){var v=sc[ix[j]];if(prev===null||prev-v>3)top=v;out[ix[j]]=top;prev=v;}return out;}
function puestos(tipo,eq,sc,clase){if(tipo==='1v1')tipo='ffa';if(clase==='survival')sc=normSurvival(sc);return compara(tipo,eq,sc).puestos;}
function hash(S){var h=0x811c9dc5;function w(x){
    if(x===null||typeof x!=='object')return JSON.stringify(x===undefined?null:x);
    if(Array.isArray(x))return'['+x.map(w).join(',')+']';
    return'{'+Object.keys(x).sort().filter(function(k){return x[k]!==undefined;}).map(function(k){return JSON.stringify(k)+':'+w(x[k]);}).join(',')+'}';}
  var o={};Object.keys(S).forEach(function(k){if(k!=='fx')o[k]=S[k];});var str=w(o);
  for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}

F.reglas={eqIdx:eqIdx,CFG0:CFG0,PERSONAJES:PERSONAJES,OBJ:OBJ,VENTA:VENTA,TIENDAS:TIENDAS,CATALOGO:CATALOGO,RELAMPAGO:RELAMPAGO,FX_MS:FX_MS,PLAZO:PLAZO,T:T,
  CONFIG_DEFECTO:CFG0,crear:crear,lobby:lobby,aplicar:aplicar,tick:tick,proyectar:proyectar,aplicaFx:aplicaFx,vista:vista,pagosMJ:pagosMJ,
  compara:compara,hashRes:hashRes,normSurvival:normSurvival,puestos:puestos,equipos:equipos,fxMs:fxMs,hash:hash,defecto:defecto,salidas:salidas,dist:dist,precioPara:precioPara,rango:rango,
  blancos:blancos,estrellasEn:estrellasEn,ofertaTienda:ofertaTienda,mapa:MAPA,STARS:STARS};
if(typeof module!=='undefined')module.exports=F.reglas;
})(typeof window!=='undefined'?window:globalThis);
