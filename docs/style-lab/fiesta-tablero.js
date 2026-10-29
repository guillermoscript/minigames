// LA FIESTA · TABLERO (M1, doc 07 §5.1/§7.1): dibujo del mapa de Venezuela, casillas, rutas, fichas, estrella y avisos del tablero.
// HUD-agnóstico: solo pinta el tablero dentro de la vista de la cámara (FIESTA.cam). Dibuja con las primitivas del laboratorio
// (engine.js: rr, ell, line, poly, txt, bust, STY…), así que sale en todos los estilos. Sin assets de arte: gris jugable con la
// silueta y los colores de región del borrador (docs/mario-party/mapa-venezuela-borrador.svg, embebido aquí como polígonos).
// La geometría (posiciones, aristas, apilado, toques) es pura y corre en Node; el dibujo solo en el navegador.
//
// Mundo 4000×3000 = lienzo de diseño 1000×1000 del mapa ×4 en x, ×3 en y.
// Capa ESTÁTICA (mar, tierra, regiones, ríos, rutas, casillas, candidatas a estrella, tiendas) cacheada en lienzos fuera de
// pantalla: una base de vista general (0,25 px/u) y teselas de 512 px por nivel de detalle (0,5 y 1 px/u), creadas a demanda
// (≤ `presupuesto` por cuadro, 1 por defecto) con LRU de 32; mientras falta una tesela se ve la base ampliada. Se invalida al
// cambiar el estilo. Capa DINÁMICA cada cuadro (con culling): estrella, peajes/bancos/monedas sueltas/chaleco de S.tab, apagón,
// flechas de RUTA, fichas (bust() a escala) con apilado, salto en arco, halo del jugador de turno y placas con su color.
//
// API
//   const T = FIESTA.tablero.crear({mapa?})        mapa = FIESTA.MAPAS.venezuela por defecto
//   T.dibujar(ctx, cam, D, opts) → stats           D = board mostrado (estado del director). opts:
//       t (s, por defecto `now`), yo (mi asiento), actual (asiento de turno; por defecto D.t.s), mio (aviso mío; por defecto esp.s===yo),
//       aim (nodo que el actor señala en la RUTA), colores {a:'#..'} (color de asiento del servidor), equipos [[..],[..]],
//       animo {a:'happy'}, saltos {a:{de,a,k}} (salto forzado por el director, k 0..1), etiquetas (true), presupuesto (1)
//   T.dibujarMini(ctx, cam, D, rect, opts) → FIESTA.cam.mini(rect)   minimapa 120×90 (tocar: m.aMundo → cam.irA)
//   T.nodoEn(sx,sy,cam) → id|null    T.fichaEn(sx,sy,cam,D) → asiento|null    T.rutaEn(sx,sy,cam,D,opts) → id destino|null
//   T.ancla(q, cam, D) → {x,y,ve} en pantalla sobre la ficha (q = asiento) o el nodo (q = id): para burbujas, tienda, avisos
//   T.foco(D, opts) → {x,y} en el mundo de la ficha de turno (para cam.seguir)    T.pos(id) → {x,y}   T.posFicha(s, D)
//   T.rutas(D) → {s, de, opc:[{a,modo,costo,pasos,ok,...}]} | null    T.invalidar()   T.aristas  T.nodos
//   Puras: FIESTA.tablero.apilar(n,i) → {dx,dy}   .arco(a,b,k,h) → {x,y}   .enTierra(wx,wy)   .ESC  .MUNDO  .TIPOS  .MODOS
(function(root){
'use strict';
const F=root.FIESTA=root.FIESTA||{};
const NODE=typeof module!=='undefined'&&typeof require!=='undefined';

const ESC={x:4,y:3},MUNDO={w:4000,h:3000};
const R_NODO=24,R_GRANDE=31,COLORES=['#D97757','#6EA8FE','#7BD88F','#F28CB1'],SEATS=['a','b','c','d'];
const EQUIPO=['#2f6fdb','#d93a3a'];
const TIERRA='#efe2bf',MAR='#a9d8ee',AGUA='#8cc8e6',COSTA='#8a7a52',ARTE_MAR='#0a3a8c';
// Casillas por tipo (colores del borrador). g = glifo.
// f = forma de la casilla (además del color, para daltonismo): o círculo, q cuadrado, d rombo, h hexágono, k octágono.
const TIPOS={
  salida:{c:'#1f1f1f',g:'salida',f:'o',big:1},banco:{c:'#f2c230',g:'$',f:'o'},azul:{c:'#2f6fdb',g:'+',f:'o'},roja:{c:'#d93a3a',g:'-',f:'q'},
  transporte:{c:'#00a6a6',g:'bus',f:'q'},evento:{c:'#9b5de5',g:'!',f:'d'},especial:{c:'#ff4f81',g:'rombo',f:'k'},vaina:{c:'#8bc34a',g:'?',f:'h'},
  duelo:{c:'#ff8a00',g:'VS',f:'k'},alcabala:{c:'#6b4f3a',g:'barrera',f:'q'},villano:{c:'#151515',g:'rayo',f:'d',big:1},ahorita:{c:'#8d8d99',g:'reloj',f:'h'},
  delta:{c:'#8A4FFF',g:'ola',f:'h'}};
// Leyenda del panel «CASILLAS»: un nombre en español por tipo de casilla (el orden es el de TIPOS).
const NOMBRES={salida:'Salida',banco:'Banco',azul:'Monedas +',roja:'Pierdes monedas',transporte:'Transporte',evento:'Evento',especial:'Especial',
  vaina:'Vaina (sorpresa)',duelo:'Duelo',alcabala:'Alcabala',villano:'Villano',ahorita:'Ahorita (espera)',delta:'Delta'};
const LEYENDA=Object.keys(TIPOS).map(t=>({t:t,n:NOMBRES[t]||t}));
// Estilo de cada modo de ruta: tipo de trazo y si se curva.
const MODOS={
  camino:{k:'via'},peaje:{k:'via',icono:'peaje'},porton:{k:'via',icono:'porton',punteado:1},camionetica:{k:'via',raya:'#ffd23f'},
  teleferico:{k:'cable'},metro:{k:'cable'},
  ferry:{k:'agua'},lancha:{k:'agua'},chalana:{k:'agua'},curiara:{k:'agua'},penero:{k:'agua'},
  avion:{k:'aire',curva:.22},avioneta:{k:'aire',curva:.18},salto:{k:'salto',curva:.3}};

/* ── borrador SVG (lienzo de diseño 1000×1000) ── */
const SILUETA=[[60,110],[95,75],[120,120],[135,170],[175,160],[215,130],[240,95],[255,60],[285,80],[270,115],[300,140],[350,170],
  [400,140],[450,140],[520,145],[600,165],[660,170],[720,160],[780,170],[860,165],[960,175],[930,215],[985,260],[975,330],[930,390],
  [960,430],[920,470],[960,520],[990,600],[980,700],[930,760],[860,760],[800,730],[760,780],[700,800],[650,880],[600,960],[540,940],
  [520,860],[560,780],[500,700],[470,620],[420,580],[330,560],[230,540],[150,520],[100,490],[70,450],[90,400],[60,340],[40,280],
  [55,220],[45,160]];
const ISLAS=[[775,105,70,30],[790,155,14,8],[592,62,50,30]];
const LAGO=[[125,205],[160,200],[178,230],[183,280],[165,325],[125,335],[105,300],[118,250]];
const RIOS=[[[560,960],[520,800],[470,620],[480,520],[560,440],[640,420],[700,405],[790,390],[860,360],[920,330],[970,300]],
  [[190,505],[320,490],[430,470],[520,455]],[[735,630],[720,560],[720,470],[790,395]]];
const ROTULOS={ccs:[515,128],coc:[350,138],zul:[150,188],and:[200,318],lla:[360,358],gua:[720,358],can:[840,578],del:[905,248],
  moc:[770,153],mar:[780,43],roq:[590,14]};

/* ── utilidades puras ── */
const REGION_ROT=56,ROT_MIN=11,ROT_MAX=22;      // tamaño del rótulo de región: 56 u de mundo, pero en pantalla entre 11 y 22
const aW=p=>({x:p[0]*ESC.x,y:p[1]*ESC.y});
const cl=(v,a,b)=>v<a?a:v>b?b:v;
function hx(c){c=c.replace('#','');if(c.length===3)c=c.split('').map(x=>x+x).join('');return[0,2,4].map(i=>parseInt(c.slice(i,i+2),16));}
function mezcla(a,b,k){const A=hx(a),B=hx(b);return'#'+A.map((v,i)=>Math.round(v+(B[i]-v)*k).toString(16).padStart(2,'0')).join('');}
function h01(a,b){let h=(a*374761393+b*668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295;}
function enPoligono(x,y,pts){let d=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];
  if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)d=!d;}return d;}
const SIL_W=SILUETA.map(aW),LAGO_W=LAGO.map(aW),ISLAS_W=ISLAS.map(i=>({x:i[0]*ESC.x,y:i[1]*ESC.y,rx:i[2]*ESC.x,ry:i[3]*ESC.y})),
  RIOS_W=RIOS.map(r=>r.map(aW));
function enTierra(x,y){
  if(enPoligono(x,y,SIL_W))return!enPoligono(x,y,LAGO_W);
  return ISLAS_W.some(i=>((x-i.x)/i.rx)**2+((y-i.y)/i.ry)**2<=1);}
// Desplazamiento de la ficha i (0..n-1) cuando n comparten casilla (mundo). Abanico en arco, de izquierda a derecha, con la cabeza de cada
// ficha (≈ 39 u) sin taparse: 1 al centro, 2 lado a lado, 3 y 4 en arco suave (el arco sube un poco al medio). ≥ 44 u entre centros
// (≥ 0,9 × el ancho de la cabeza a zoom normal) y simétrico en x. Crece con el radio de la casilla (R_NODO 24 / R_GRANDE 31).
const FAN=[null,[[0,0]],[[-24,0],[24,0]],[[-44,6],[0,-6],[44,6]],[[-66,8],[-22,-6],[22,-6],[66,8]]];
function apilar(n,i,radio){
  n=n|0;i=i|0;if(n<=1)return{dx:0,dy:0};
  const q=FAN[Math.min(n,4)][((i%4)+4)%Math.min(n,4)],r=radio>0?radio:R_NODO,k=Math.max(1,r/R_NODO),lim=n>=3?r+48*k:r+10;
  let dx=q[0]*k,dy=q[1]*k;const d=Math.hypot(dx,dy);if(d>lim){dx*=lim/d;dy*=lim/d;}
  return{dx:dx,dy:dy};}
// Salto en arco de a a b: k 0..1, altura h.
function arco(a,b,k,h){k=cl(k,0,1);return{x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k-Math.sin(Math.PI*k)*h};}
function largo(pts){let s=0;for(let i=1;i<pts.length;i++)s+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);return s;}
function puntoEn(pts,k){const L=largo(pts)*cl(k,0,1);let s=0;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],d=Math.hypot(b.x-a.x,b.y-a.y);
    if(s+d>=L||i===pts.length-1){const u=d?cl((L-s)/d,0,1):0;return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,ang:Math.atan2(b.y-a.y,b.x-a.x)};}s+=d;}
  return{x:pts[0].x,y:pts[0].y,ang:0};}
// Trozos de un trazo para dibujar rayas sin setLineDash (que cada estilo maneja distinto).
function rayas(pts,on,off){const out=[],L=largo(pts);for(let s=0;s<L;s+=on+off){const seg=[],e=Math.min(L,s+on);
  for(let k=0;k<=3;k++)seg.push(puntoEn(pts,(s+(e-s)*k/3)/L));out.push(seg);}return out;}
function trazo(a,b,curva,flip){
  if(!curva)return[a,b];
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,d=Math.hypot(b.x-a.x,b.y-a.y);let nx=(a.y-b.y)/(d||1),ny=(b.x-a.x)/(d||1);
  if(ny>0===!flip){nx=-nx;ny=-ny;}                                   // siempre hacia el norte (o al sur si flip)
  const c={x:mx+nx*d*curva,y:my+ny*d*curva},o=[];
  for(let i=0;i<=16;i++){const t=i/16,u=1-t;o.push({x:u*u*a.x+2*u*t*c.x+t*t*b.x,y:u*u*a.y+2*u*t*c.y+t*t*b.y});}return o;}

// Ordenador de rótulos de pantalla (puro, probado en Node). items[i] = {x,y,w,h}: centro y tamaño a escala 1; prohibidos = [{x,y,w,h}]
// (esquina sup-izq: fichas, placas, dado, HUD); vista = {x,y,w,h}. Cada rótulo se desplaza al lado libre más cercano; si no cabe se
// reduce (.8, .65) y, como último recurso, se queda donde está con alfa .35. out[i] = {x,y,w,h,esc,alfa,libre} (se reusan los objetos).
const OFS=[[0,0],[0,-1],[0,1],[-.7,0],[.7,0],[0,-2],[0,2],[-1,-1],[1,-1],[-1,1],[1,1],[-1.4,0],[1.4,0]],ESCALAS=[1,.8,.65];
function chocaR(x0,y0,x1,y1,r){return x1>r.x&&x0<r.x+r.w&&y1>r.y&&y0<r.y+r.h;}
// Un intento: ancla k a escala e. Si cae libre rellena o (x,y,w,h,esc,alfa,libre,e,k) y devuelve true. sin = true: sin mirar choques (histéresis).
function probarEti(it,e,k,prohibidos,vista,out,i,o,sin){
  const w=it.w*ESCALAS[e],h=it.h*ESCALAS[e];
  let cx=it.x+OFS[k][0]*w,cy=it.y+OFS[k][1]*h;
  if(vista){if(vista.w>=w)cx=cl(cx,vista.x+w/2,vista.x+vista.w-w/2);if(vista.h>=h)cy=cl(cy,vista.y+h/2,vista.y+vista.h-h/2);}
  const x0=cx-w/2,y0=cy-h/2,x1=cx+w/2,y1=cy+h/2;let libre=true;
  if(!sin){
    for(let j=0;j<prohibidos.length&&libre;j++)if(chocaR(x0,y0,x1,y1,prohibidos[j]))libre=false;
    for(let j=0;j<i&&libre;j++){const q=out[j];if(q.libre&&chocaR(x0,y0,x1,y1,{x:q.x-q.w/2,y:q.y-q.h/2,w:q.w,h:q.h}))libre=false;}}
  if(libre){o.x=cx;o.y=cy;o.w=w;o.h=h;o.esc=ESCALAS[e];o.alfa=1;o.libre=true;o.e=e;o.k=k;}
  return libre;}
// it.pe/it.pk (opcionales) = anclaje elegido el cuadro anterior: se prueba primero (histéresis). out[i].e/.k = anclaje elegido (-1 si no cupo).
function ordenarEtiquetas(items,prohibidos,vista,out){
  out=out||[];prohibidos=prohibidos||[];
  for(let i=0;i<items.length;i++){
    const it=items[i],o=out[i]||(out[i]={x:0,y:0,w:0,h:0,esc:1,alfa:1,libre:true,e:0,k:0});let ok=false;
    if(it.pe>=0&&it.pk>=0)ok=probarEti(it,it.pe,it.pk,prohibidos,vista,out,i,o,false);
    for(let e=0;e<ESCALAS.length&&!ok;e++)for(let k=0;k<OFS.length&&!ok;k++)ok=probarEti(it,e,k,prohibidos,vista,out,i,o,false);
    if(!ok){const w=it.w*ESCALAS[2],h=it.h*ESCALAS[2];o.x=it.x;o.y=it.y;o.w=w;o.h=h;o.esc=ESCALAS[2];o.alfa=.6;o.libre=false;o.e=-1;o.k=-1;}}
  out.length=items.length;return out;}
// Tamaño en pantalla de un rótulo de región según el zoom (nunca menos de 11 ni más de 22).
function tamRotulo(z){return cl(REGION_ROT*z,ROT_MIN,ROT_MAX);}

/* ── acceso a las primitivas del motor (solo navegador) ── */
const E=()=>typeof rr!=='undefined';
const estilo=()=>typeof style!=='undefined'?style:'tinta';
const col=c=>(typeof STY!=='undefined'&&STY[estilo()])?STY[estilo()].col(c):c;
function semilla(n){if(typeof sid!=='undefined')sid=n;}
function conCtx(c,fn){
  if(typeof ctx==='undefined'){fn();return;}
  const prev=ctx;ctx=c;try{fn();}finally{ctx=prev;}}
function lienzo(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function ahora(){if(typeof now!=='undefined')return now;return(typeof performance!=='undefined'?performance.now():Date.now())/1000;}
function rostro(ch){
  const B=typeof BUS!=='undefined'?BUS:null,C=B&&B.AP&&B.AP.CAST||{},Fc=typeof FACES!=='undefined'?FACES:[];
  const m={tu:B&&B.TU,mama:C.mama,abuela:C.abuela,tio:C.tio||Fc[6],pana:C.pana||Fc[0],prima:Fc[7],cobrador:Fc[3],portu:Fc[1]};
  return m[ch]||Fc[0]||{};}

function crear(o){
  o=o||{};
  const mapa=o.mapa||(F.MAPAS&&F.MAPAS.venezuela)||(NODE?require('./fiesta-mapa-venezuela.js'):null);
  if(!mapa)throw new Error('fiesta-tablero: falta el mapa');
  const NOD=mapa.nodos,ADY=mapa.ady,ids=Object.keys(NOD),RUTA={};
  (mapa.rutas||[]).forEach(r=>{RUTA[r.de+'>'+r.a]=r;});
  const P={};ids.forEach(i=>{P[i]={x:NOD[i].x*ESC.x,y:NOD[i].y*ESC.y};});
  const radio=id=>(TIPOS[NOD[id].t]||{}).big?R_GRANDE:R_NODO;
  // aristas no dirigidas (una por par) con su modo y su trazo en el mundo
  const AR=[],IDX={};
  ids.forEach(a=>(ADY[a]||[]).forEach(b=>{
    const k=a<b?a+'|'+b:b+'|'+a;if(IDX[k]!==undefined){const e=AR[IDX[k]];if(a===e.a)e.ida=1;else e.vuelta=1;return;}
    const r=RUTA[a+'>'+b]||RUTA[b+'>'+a]||null,modo=r?r.modo:'camino',st=MODOS[modo]||MODOS.camino;
    const e={a:a,b:b,ida:1,vuelta:0,ruta:r,modo:modo,st:st,pts:trazo(P[a],P[b],st.curva,false)};
    e.bb={x0:Math.min.apply(null,e.pts.map(p=>p.x)),y0:Math.min.apply(null,e.pts.map(p=>p.y)),
      x1:Math.max.apply(null,e.pts.map(p=>p.x)),y1:Math.max.apply(null,e.pts.map(p=>p.y))};
    IDX[k]=AR.length;AR.push(e);}));
  AR.forEach(e=>{if((ADY[e.b]||[]).indexOf(e.a)>=0)e.vuelta=1;});
  // trazo de a→b (sigue la misma curva que la arista dibujada)
  function camino(a,b){const k=a<b?a+'|'+b:b+'|'+a,e=AR[IDX[k]];if(!e)return[P[a],P[b]];return e.a===a?e.pts:e.pts.slice().reverse();}
  // olas deterministas en el mar, lejos de la costa y de las casillas
  const OLAS=[];for(let gx=0;gx<20;gx++)for(let gy=0;gy<15;gy++){
    const x=gx*200+60+h01(gx,gy)*80,y=gy*200+60+h01(gy+50,gx)*80;
    if(enTierra(x,y)||enTierra(x+90,y)||enTierra(x-90,y))continue;
    if(ids.some(i=>Math.hypot(P[i].x-x,P[i].y-y)<160))continue;OLAS.push({x:x,y:y});}
  // casillas que el borrador dejó apenas fuera de la costa: llevan una lengua de tierra propia
  const ORILLA=ids.filter(i=>!enTierra(P[i].x,P[i].y));
  const REG={};(mapa.regiones||[]).forEach(r=>{REG[r.id]=r;});
  // aristas de peaje (costo '1+') y rótulos de región, calculados una vez (nada de recorrer las 114 aristas por cuadro)
  const PEAJES=AR.filter(e=>e.ruta&&e.ruta.costo==='1+').map(e=>({e:e,m:puntoEn(e.pts,.5),k:e.ruta.de+'>'+e.ruta.a}));
  const ROT=Object.keys(ROTULOS).filter(id=>REG[id]).map(id=>{const p=aW(ROTULOS[id]);
    return{id:id,x:p.x,y:p.y+18,s:REG[id].nombre.toUpperCase(),c:mezcla(REG[id].color,'#14101c',.45),prio:id==='ccs'?2:1,pe:-1,pk:-1,hn:0};});
  ROT.push({id:'ama',x:2000,y:2800,s:'AMAZONAS: PRÓXIMAMENTE',c:COSTA,prio:0,pe:-1,pk:-1,hn:0});

  const T={mapa:mapa,nodos:P,aristas:AR,costa:ORILLA,MUNDO:MUNDO,ult:{},anim:{},stats:{}};
  if(F.arte&&F.arte.cargar)F.arte.cargar(()=>{if(T.invalidar)T.invalidar();});      // el PNG del arte llega tarde: se repinta la capa estática
  T.pos=id=>P[id]||null;
  T.camino=camino;

  /* ── fichas: posición con apilado y salto ── */
  function asientos(D){return D&&D.pj?Object.keys(D.pj).sort():[];}
  function basePos(s,D){
    const n=D.pj[s].nodo,p=P[n];if(!p)return null;
    const mismos=asientos(D).filter(x=>D.pj[x].nodo===n),i=mismos.indexOf(s),d=apilar(mismos.length,i);
    return{x:p.x+d.dx,y:p.y+d.dy};}
  // Avanza la animación interna: si cambió el nodo de una ficha, salta en arco desde donde estaba.
  function animar(D,t,saltos){
    asientos(D).forEach(s=>{
      const b=basePos(s,D);if(!b)return;const u=T.ult[s],sx=saltos&&saltos[s];
      if(sx&&P[sx.de]&&P[sx.a]){const pts=camino(sx.de,sx.a),m=puntoEn(pts,sx.k),d=largo(pts);
        T.ult[s]={nodo:D.pj[s].nodo,x:m.x,y:m.y-Math.sin(Math.PI*cl(sx.k,0,1))*cl(d*.25,36,220),alt:0,vola:1,kk:cl(sx.k,0,1),land:u&&u.land};T.anim[s]=null;return;}
      if(!u){T.ult[s]={nodo:D.pj[s].nodo,x:b.x,y:b.y};return;}
      if(u.nodo!==D.pj[s].nodo){const de={x:u.x,y:u.y},d=Math.hypot(b.x-de.x,b.y-de.y);
        T.anim[s]={de:de,t0:t,dur:cl(d/1400,.16,.6),h:cl(d*.3,30,380)};u.nodo=D.pj[s].nodo;}
      const a=T.anim[s];
      if(a){const k=(t-a.t0)/a.dur;if(k>=1||k<0){T.anim[s]=null;u.x=b.x;u.y=b.y;if(u.vola){u.vola=0;u.land=t;}}else{const q=arco(a.de,b,k,a.h);u.x=q.x;u.y=q.y;u.vola=1;u.kk=k;}}
      else{if(u.vola){u.vola=0;u.land=t;}const k=.35;u.x+=(b.x-u.x)*k;u.y+=(b.y-u.y)*k;if(Math.abs(b.x-u.x)<.5&&Math.abs(b.y-u.y)<.5){u.x=b.x;u.y=b.y;}}
    });
    Object.keys(T.ult).forEach(s=>{if(!D.pj||!D.pj[s])delete T.ult[s];});}
  T.posFicha=function(s,D){const u=T.ult[s];if(u)return{x:u.x,y:u.y};return D&&D.pj&&D.pj[s]?basePos(s,D):null;};
  const actualDe=(D,op)=>op&&op.actual!==undefined?op.actual:(D&&D.t&&D.t.s)||(D&&D.esp&&D.esp.s&&D.esp.s!=='*'?D.esp.s:null);
  T.foco=function(D,op){const s=actualDe(D,op);if(s&&D.pj&&D.pj[s])return T.posFicha(s,D);return null;};
  // escala de la ficha en el mundo: nunca más chica que ~24 u de pantalla
  const ALTO=190,escFicha=cam=>Math.max(.46,24/(ALTO*cam.z));   // cabeza ≈ 39 u de pantalla a zoom normal (antes .36)

  /* ── toques ── */
  T.nodoEn=function(sx,sy,cam,tol){
    const w=cam.aMundo(sx,sy),t=(tol===undefined?14:tol)/cam.z;let best=null,bd=Infinity;
    ids.forEach(i=>{const d=Math.hypot(P[i].x-w.x,P[i].y-w.y);if(d<=radio(i)+t&&d<bd){bd=d;best=i;}});return best;};
  T.fichaEn=function(sx,sy,cam,D){
    const w=cam.aMundo(sx,sy),s0=escFicha(cam);let best=null,bd=Infinity;
    asientos(D).forEach(s=>{const p=T.posFicha(s,D);if(!p)return;const cx=p.x,cy=p.y-70*s0,
      d=Math.hypot((cx-w.x)/(40*s0+22/cam.z),(cy-w.y)/(ALTO*s0*.55+22/cam.z));if(d<=1&&d<bd){bd=d;best=s;}});return best;};
  T.rutas=function(D){
    if(!D||!D.esp||D.esp.k!=='RUTA'||!D.pj||!D.pj[D.esp.s])return null;
    const s=D.esp.s,de=D.pj[s].nodo;
    return{s:s,de:de,opc:(D.esp.opc||[]).filter(x=>P[x.a]).map(x=>Object.assign({},x,{flecha:puntoEn(camino(de,x.a),.55)}))};};
  T.rutaEn=function(sx,sy,cam,D){
    const R=T.rutas(D);if(!R)return null;const w=cam.aMundo(sx,sy),tol=26/cam.z;let best=null,bd=Infinity;
    R.opc.forEach(x=>{if(x.ok===false)return;
      const d=Math.min(Math.hypot(P[x.a].x-w.x,P[x.a].y-w.y)-radio(x.a),Math.hypot(x.flecha.x-w.x,x.flecha.y-w.y)-18);
      if(d<=tol&&d<bd){bd=d;best=x.a;}});return best;};
  T.ancla=function(q,cam,D){
    let p,h;
    if(D&&D.pj&&D.pj[q]){p=T.posFicha(q,D);h=ALTO*escFicha(cam)*1.05;}else if(P[q]){p=P[q];h=radio(q)+8;}else return null;
    const s=cam.aPantalla(p.x,p.y-h);return{x:s.x,y:s.y,ve:cam.ve(p.x,p.y,h)};};

  /* ── capa estática ── */
  const LOD=[.5,1],BASE=.25,TP=512,PAD=2,MAXT=32;
  const cache={estilo:null,base:null,teselas:new Map(),hechas:0,lod:undefined};
  // banda de necesidad (px por u) en la que se conserva el nivel actual aunque otro sea el candidato (histéresis ≈ ±10-20 %)
  const BANDA={n:[0,.32],.5:[.24,.61],1:[.5,Infinity]};
  T.invalidar=function(){cache.estilo=null;cache.base=null;cache.teselas.clear();cache.lod=undefined;};
  function cruza(bb,x0,y0,x1,y1){return bb.x1>=x0&&bb.x0<=x1&&bb.y1>=y0&&bb.y0<=y1;}

  function caminoTierra(c){c.beginPath();SIL_W.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
    ISLAS_W.forEach(i=>{c.moveTo(i.x+i.rx,i.y);c.ellipse(i.x,i.y,i.rx,i.ry,0,0,Math.PI*2);});}
  function glifo(g,x,y,r){
    const W_='#ffffff';
    if(g==='+'){rr(x-r*.5,y-r*.13,r,r*.26,3,W_,0);rr(x-r*.13,y-r*.5,r*.26,r,3,W_,0);}
    else if(g==='-')rr(x-r*.5,y-r*.13,r,r*.26,3,W_,0);
    else if(g==='bus'){rr(x-r*.56,y-r*.4,r*1.12,r*.62,5,W_,0);rr(x-r*.44,y-r*.3,r*.88,r*.22,2,'#00a6a6',0);
      ell(x-r*.3,y+r*.26,r*.13,r*.13,'#14101c',0);ell(x+r*.3,y+r*.26,r*.13,r*.13,'#14101c',0);}
    else if(g==='rombo')poly([[x,y-r*.6],[x+r*.42,y],[x,y+r*.6],[x-r*.42,y]],W_,0);
    else if(g==='barrera'){rr(x-r*.6,y-r*.14,r*1.2,r*.28,3,W_,0);for(let i=0;i<3;i++)rr(x-r*.45+i*r*.35,y-r*.14,r*.16,r*.28,0,'#d93a3a',0);}
    else if(g==='rayo')poly([[x+r*.16,y-r*.66],[x-r*.38,y+r*.08],[x-r*.02,y+r*.08],[x-r*.2,y+r*.66],[x+r*.4,y-r*.14],[x+r*.04,y-r*.14]],'#ffd23f',0);
    else if(g==='reloj'){ell(x,y,r*.52,r*.52,W_,0);line([[x,y-r*.36],[x,y],[x+r*.26,y+r*.12]],r*.12,'#14101c');}
    else if(g==='ola'){const a=[];for(let i=0;i<=8;i++)a.push([x-r*.55+i*r*.1375,y+Math.sin(i/8*Math.PI*2)*r*.2]);line(a,r*.16,W_);}
    else if(g==='salida'){rr(x-r*.06,y-r*.62,r*.12,r*1.15,2,W_,0);poly([[x+r*.06,y-r*.62],[x+r*.62,y-r*.42],[x+r*.06,y-r*.2]],'#e8553d',0);}
    else txt(g,x,y+r*.04,g.length>1?r*.72:r*1.05,W_,0,true);}
  // Estampa el arte pixel (FIESTA.arte, 2 u de mundo por píxel) en el rectángulo de mundo; false si aún no hay arte (se usa el dibujo plano).
  function pintarArte(x0,y0,x1,y1){
    const A=F.arte,im=A&&A.lienzo&&A.lienzo();if(!im)return false;
    const k=A.U,sx=Math.max(0,Math.floor(x0/k)),sy=Math.max(0,Math.floor(y0/k)),ex=Math.min(A.W,Math.ceil(x1/k)),ey=Math.min(A.H,Math.ceil(y1/k));
    ctx.fillStyle=ARTE_MAR;ctx.fillRect(x0,y0,x1-x0,y1-y0);
    if(ex<=sx||ey<=sy)return true;
    let esc=1;try{esc=ctx.getTransform().a;}catch(_){}
    const sm=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=esc<.45;       // reducido (vista general): suave · ampliado: píxeles nítidos
    ctx.drawImage(im,sx,sy,ex-sx,ey-sy,sx*k,sy*k,(ex-sx)*k,(ey-sy)*k);ctx.imageSmoothingEnabled=sm;return true;}
  function pintarEstatico(x0,y0,x1,y1){
    const M=60;x0-=M;y0-=M;x1+=M;y1+=M;
    if(pintarArte(x0,y0,x1,y1)){
      // el arte ilustrado ya trae mar, tierra, regiones, lago y ríos: solo faltan rutas y casillas encima
      AR.forEach((e,i)=>{if(!cruza(e.bb,x0,y0,x1,y1))return;pintarArista(e,i);});
      ids.forEach((id,i)=>{const p=P[id],r=radio(id);if(p.x+r+40<x0||p.x-r-40>x1||p.y+r+40<y0||p.y-r-40>y1)return;pintarNodo(id,i);});
      return;}
    semilla(1);rr(x0,y0,x1-x0,y1-y0,0,MAR,0);
    OLAS.forEach((w,i)=>{if(w.x<x0-60||w.x>x1+60||w.y<y0-40||w.y>y1+40)return;semilla(100+i);
      line([[w.x-40,w.y],[w.x-20,w.y-12],[w.x,w.y],[w.x+20,w.y-12],[w.x+40,w.y]],6,mezcla(MAR,'#ffffff',.45));});
    ORILLA.forEach((i,k)=>{semilla(400+k);ell(P[i].x,P[i].y+8,R_NODO*2.6,R_NODO*2,TIERRA,5);});
    semilla(500);poly(SIL_W.map(p=>[p.x,p.y]),TIERRA,5);
    ORILLA.forEach((i,k)=>{semilla(450+k);ell(P[i].x,P[i].y+8,R_NODO*2.6-5,R_NODO*2-5,TIERRA,0);});
    ISLAS_W.forEach((i,k)=>{semilla(510+k);ell(i.x,i.y,i.rx,i.ry,TIERRA,5);});
    // manchas de región (unión de óvalos alrededor de sus casillas), recortadas a la tierra
    ctx.save();caminoTierra(ctx);ctx.clip();
    (mapa.regiones||[]).forEach(r=>{ctx.fillStyle=col(mezcla(r.color,TIERRA,.5));ctx.beginPath();
      ids.forEach(i=>{if(NOD[i].r!==r.id)return;const p=P[i];if(p.x+150<x0||p.x-150>x1||p.y+120<y0||p.y-120>y1)return;
        ctx.moveTo(p.x+136,p.y);ctx.ellipse(p.x,p.y,136,102,0,0,Math.PI*2);});ctx.fill();});
    ctx.restore();
    semilla(600);poly(LAGO_W.map(p=>[p.x,p.y]),MAR,3);
    RIOS_W.forEach((r,k)=>{semilla(610+k);line(r.map(p=>[p.x,p.y]),16,AGUA);});
    // (los rótulos de región ya no van en la capa estática: se pintan en pantalla tras las fichas, ver pintarRotulos)
    // rutas
    AR.forEach((e,i)=>{if(!cruza(e.bb,x0,y0,x1,y1))return;pintarArista(e,i);});
    // casillas
    ids.forEach((id,i)=>{const p=P[id],r=radio(id);if(p.x+r+40<x0||p.x-r-40>x1||p.y+r+40<y0||p.y-r-40>y1)return;pintarNodo(id,i);});}
  function pintarArista(e,i){
    const st=e.st,pts=e.pts.map(p=>[p.x,p.y]);semilla(2000+i*20);
    if(st.k==='via'){
      if(st.punteado)rayas(e.pts,14,12).forEach(s=>line(s.map(p=>[p.x,p.y]),14,'#d9c49a'));
      else line(pts,16,'#e6d3a8');
      if(st.raya)rayas(e.pts,26,22).forEach(s=>line(s.map(p=>[p.x,p.y]),5,st.raya));}
    else if(st.k==='cable'){line(pts,5,'#3a3a46');[.33,.66].forEach(k=>{const m=puntoEn(e.pts,k);rr(m.x-11,m.y+2,22,18,5,'#e8553d',3);});}
    else if(st.k==='agua')rayas(e.pts,22,16).forEach(s=>line(s.map(p=>[p.x,p.y]),7,'#2f7fe0'));
    else if(st.k==='aire')rayas(e.pts,18,18).forEach(s=>line(s.map(p=>[p.x,p.y]),5,'#7a7a8a'));
    else if(st.k==='salto')rayas(e.pts,6,14).forEach(s=>line(s.map(p=>[p.x,p.y]),7,'#8A4FFF'));
    const m=puntoEn(e.pts,.5);
    if(st.k==='aire'){ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.ang);poly([[16,0],[-12,-5],[-16,0],[-12,5]],'#ffffff',2.5);
      poly([[2,-2],[-6,-16],[-10,-16],[-6,0],[-10,16],[-6,16],[2,2]],'#ffffff',2.5);ctx.restore();}
    if(st.icono==='porton'){rr(m.x-18,m.y-16,6,30,2,'#6b4f3a',2.5);rr(m.x+12,m.y-16,6,30,2,'#6b4f3a',2.5);rr(m.x-16,m.y-8,32,8,2,'#c9a227',2);}
    if(st.icono==='peaje'){rr(m.x-16,m.y-34,32,22,4,'#ffd23f',3);rr(m.x-20,m.y-38,40,8,3,'#d93a3a',2.5);}
    // sentido único: chevrón a 58%
    if(!(e.ida&&e.vuelta)){const de=e.ida?e.a:e.b,a=e.ida?e.b:e.a,c=puntoEn(camino(de,a),.58);
      ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.ang);poly([[11,0],[-7,-10],[-3,0],[-7,10]],'#5b4636',0);ctx.restore();}
    // costo fijo
    const r=e.ruta;if(r&&typeof r.costo==='number'){const b=puntoEn(e.pts,st.k==='aire'?.5:.5),bx=b.x,by=b.y+(st.k==='aire'?22:0);
      ell(bx,by,17,17,'#ffd23f',3);txt(String(r.costo),bx,by+1,18,'#5b3a00',0,true);}}
  function pintarNodo(id,i){
    const p=P[id],n=NOD[id],ty=TIPOS[n.t]||{c:'#888',g:'?'},r=radio(id);semilla(5000+i*30);
    ctx.save();ctx.globalAlpha=.22;ctx.fillStyle='#14101c';ctx.beginPath();ctx.ellipse(p.x+3,p.y+8,r+3,r*.85,0,0,Math.PI*2);ctx.fill();ctx.restore();
    if(n.star||n.premium)ell(p.x,p.y,r+8,r+8,n.premium?'#ffef9a':'#ffd23f',3.5);
    forma(ty.f,p.x,p.y,r,ty.c,4);
    glifo(ty.g,p.x,p.y,r*.95);
    if(n.star){const sx=p.x+r*.78,sy=p.y-r*.78;poly(estrellaPts(sx,sy,10,4.5,0),'#ffd23f',2.5);}
    if(n.tienda){const tx=p.x-r-4,ty2=p.y-r-6;rr(tx-14,ty2-8,28,20,4,'#ffffff',3);
      for(let k=0;k<4;k++)rr(tx-14+k*7,ty2-12,7,8,2,k%2?'#ffffff':'#2f9f5a',k%2?0:1.5);}}
  // Forma de casilla (además del color): círculo, cuadrado, rombo, hexágono u octágono, todas inscritas en el radio de toque.
  function formaPts(n,x,y,r,rot){const a=[];for(let i=0;i<n;i++){const t=rot+i*Math.PI*2/n;a.push([x+Math.cos(t)*r,y+Math.sin(t)*r]);}return a;}
  function forma(f,x,y,r,c,lw){
    if(f==='q')rr(x-r*.86,y-r*.86,r*1.72,r*1.72,r*.3,c,lw);
    else if(f==='d')poly(formaPts(4,x,y,r*1.2,-Math.PI/2),c,lw);
    else if(f==='h')poly(formaPts(6,x,y,r*1.02,Math.PI/6),c,lw);
    else if(f==='k')poly(formaPts(8,x,y,r*1.02,Math.PI/8),c,lw);
    else ell(x,y,r,r,c,lw);}
  function estrellaPts(x,y,R,r,rot){const a=[];for(let i=0;i<10;i++){const t=rot-Math.PI/2+i*Math.PI/5,q=i%2?r:R;a.push([x+Math.cos(t)*q,y+Math.sin(t)*q]);}return a;}
  T.estrellaPts=estrellaPts;
  // lista de estrellas a dibujar: la del director (D.estrellas) o, con un tablero crudo, estrella.nodo y estrella.b
  function estrellasDe(D){if(D.estrellas)return D.estrellas;const e=D.estrella;return e?(e.b?[e,{nodo:e.b,precio:e.precio}]:[e]):[];}
  T.precalentar=function(cam,n){if(!E())return T;base();
    // opcional: pinta hasta n teselas de la vista actual (a su nivel de detalle) antes de jugar, para que no se creen durante el juego
    if(cam&&n>0){const L=cam.z>=.555*.9?1:.5,ws=TP/L,r=cam.rect(0);
      for(let i=Math.max(0,Math.floor(r.x0/ws));i<=Math.floor(Math.min(MUNDO.w-1e-6,r.x1)/ws)&&n>0;i++)
        for(let j=Math.max(0,Math.floor(r.y0/ws));j<=Math.floor(Math.min(MUNDO.h-1e-6,r.y1)/ws)&&n>0;j++)if(!cache.teselas.has(L+':'+i+':'+j)){tesela(L,i,j,true);n--;}}
    return T;};   // pinta la base de vista general (una vez, ~1 cuadro) fuera del juego

  function base(){
    if(cache.base)return cache.base;const L=BASE,c=lienzo(Math.ceil(MUNDO.w*L),Math.ceil(MUNDO.h*L)),x=c.getContext('2d');
    x.setTransform(L,0,0,L,0,0);conCtx(x,()=>pintarEstatico(0,0,MUNDO.w,MUNDO.h));cache.hechas++;return cache.base=c;}
  function tesela(L,i,j,crea){
    const k=L+':'+i+':'+j,m=cache.teselas;let t=m.get(k);
    if(t){m.delete(k);m.set(k,t);return t;}
    if(!crea)return null;
    const ws=TP/L,c=lienzo(TP+2*PAD,TP+2*PAD),x=c.getContext('2d');
    x.setTransform(L,0,0,L,PAD-i*ws*L,PAD-j*ws*L);
    conCtx(x,()=>pintarEstatico(i*ws,j*ws,(i+1)*ws,(j+1)*ws));cache.hechas++;
    m.set(k,c);while(m.size>MAXT)m.delete(m.keys().next().value);return c;}
  function estatico(c,cam,escala,presupuesto,st){
    if(cache.estilo!==estilo()){T.invalidar();cache.estilo=estilo();}
    const r=cam.rect(0),b=base();
    const x0=cl(r.x0,0,MUNDO.w),y0=cl(r.y0,0,MUNDO.h),x1=cl(r.x1,0,MUNDO.w),y1=cl(r.y1,0,MUNDO.h);
    // fuera del mundo: mar liso
    c.fillStyle=F.arte&&F.arte.lienzo&&F.arte.lienzo()?ARTE_MAR:col(MAR);c.fillRect(r.x0,r.y0,r.x1-r.x0,r.y1-r.y0);
    if(x1<=x0||y1<=y0)return;
    // nivel de detalle con histéresis: sube con un 12 % de margen y baja con un 20 %, así el zoom suave no cambia de nivel (ni parpadea)
    const need=cam.z*escala;let L=null;for(let i=0;i<LOD.length;i++)if(LOD[i]>=need*.9){L=LOD[i];break;}
    if(need<=BASE*1.15)L=null;else if(L===null)L=LOD[LOD.length-1];
    if(cache.lod!==undefined&&L!==cache.lod){const bd=BANDA[cache.lod===null?'n':cache.lod];if(bd&&need>=bd[0]&&need<=bd[1])L=cache.lod;}
    cache.lod=L;
    const smooth=c.imageSmoothingEnabled;c.imageSmoothingEnabled=true;
    const ws=L?TP/L:0,i0=L?Math.floor(x0/ws):0,i1=L?Math.floor((x1-1e-6)/ws):-1,j0=L?Math.floor(y0/ws):0,j1=L?Math.floor((y1-1e-6)/ws):-1;
    let falta=!L;
    if(L)for(let i=i0;i<=i1&&!falta;i++)for(let j=j0;j<=j1;j++)if(!cache.teselas.has(L+':'+i+':'+j)){falta=true;break;}
    if(falta){const sx=x0*BASE,sy=y0*BASE,sw=(x1-x0)*BASE,sh=(y1-y0)*BASE;
      if(sw>0&&sh>0)c.drawImage(b,sx,sy,sw,sh,x0,y0,x1-x0,y1-y0);st.base=1;}
    if(L){let n=presupuesto;
      for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){let t=tesela(L,i,j,false);
        if(!t&&n>0){t=tesela(L,i,j,true);n--;}
        if(!t)continue;st.teselas++;c.drawImage(t,PAD,PAD,TP,TP,i*ws,j*ws,ws,ws);}
      st.lod=L;}
    c.imageSmoothingEnabled=smooth;}

  /* ── capa dinámica ── */
  function badge(x,y,s,bg,fg,size){size=size||14;const w=Math.max(size*1.6,(typeof tw==='function'?tw(s,size):s.length*size*.6)+14),h=size+10;
    rr(x-w/2,y-h/2,w,h,h/2,bg,3);txt(s,x,y+1,size,fg||'#14101c',0,true);return w;}
  function moneda(x,y,r){ell(x,y,r,r,'#ffd23f',2.5);ell(x-r*.2,y-r*.25,r*.35,r*.25,'#fff6c0',0);}

  // el reductor llama «CPU · EL PORTU» a las CPU: la placa muestra el nombre limpio y la insignia CPU sale de e.cpu
  function limpio(n){return String(n==null?'':n).replace(/^CPU\s*[·•-]\s*/i,'');}
  function corto(n,max){n=String(n);if(n.length<=max)return n;const i=n.lastIndexOf(' ',max-1);return i>=max*.5?n.slice(0,i):n.slice(0,max-1)+'…';}   // corta en palabra; si no hay, con puntos suspensivos
  // buffers reutilizados por cuadro (sin asignar arrays nuevos en el bucle caliente)
  const FO={},FP={},CL={x:0,y:0,w:0,h:0},BUF={eti:[],lista:[],placas:[],puestas:[],proh:[],it:[],out:[]},BO={};
  // identidad de la ficha: color/nombre de F.ui.ident (perezoso: ui se carga DESPUÉS); respaldo: color de asiento del servidor
  function identidad(UI,ch,s,op){
    const PJ=F.PJ,f=PJ&&PJ.ident?PJ.ident:UI&&UI.ident;            // una sola fuente de nombre/color: F.PJ (respaldo F.ui)
    if(f&&ch){const i=f(ch);if(i&&i.id)return{col:i.col,col2:i.col2||i.col,n:i.n};}
    const c=(op.colores&&op.colores[s])||COLORES[SEATS.indexOf(s)%4]||'#ffffff';return{col:c,col2:c,n:null};}
  // Rectángulos prohibidos del HUD (pantalla lógica): vm.reservados / op.reservados, o los de ui.reservado(vm) (dado, QUEDAN n, banner); sin ui, el centro del dado ±70.
  function reservadosDe(v,op,res){
    res.length=0;const UI=F.ui,vm=UI&&UI.vm;let r=op.reservados||op.reservado||(vm&&vm.reservados);
    if(!r&&UI&&UI.reservadosActual&&UI.reservadosActual.length)r=UI.reservadosActual;       // lo que el HUD dibujó el cuadro anterior: tarjetas, ronda, panel, banner, dado
    if(!r&&UI&&typeof UI.reservado==='function'&&vm){try{r=UI.reservado(vm);}catch(_){r=null;}}
    if(r){for(let i=0;i<r.length;i++)res.push(r[i]);}
    else res.push({x:v.x+v.w/2-70,y:v.y+v.h*.34-70,w:140,h:140});
    // bandas fijas del HUD: reloj/cabecera, columna de tarjetas y pie; y la columna del minimapa con sus 2 botones (los dibuja fiesta-main a la izquierda)
    res.push({x:v.x,y:v.y,w:v.w,h:80});res.push({x:v.x,y:v.y+v.h-80,w:v.w,h:80});res.push({x:v.x,y:v.y+108,w:152,h:215});return res;}
  const HOLD=6;                                        // cuadros seguidos que un rótulo aguanta su anclaje aunque choque (no parpadea al mover la cámara)
  // Pasada de rótulos de región (pantalla). proh/np = rectángulos prohibidos ya reservados por las fichas y sus placas.
  // Prioridad: región de la ficha de turno > hub (Caracas) > resto; los de menor prioridad que no caben se esconden.
  function pintarRotulos(c,cam,v,op,proh,np,regAct){
    const pr=BUF.prohT||(BUF.prohT=[]);pr.length=0;for(let i=0;i<np;i++)pr.push(proh[i]);
    const res=reservadosDe(v,op,BUF.res||(BUF.res=[]));for(let i=0;i<res.length;i++)pr.push(res[i]);
    const z=cam.z,size=tamRotulo(z),items=BUF.it;let n=0;
    for(let i=0;i<ROT.length;i++){const r=ROT[i],sp=cam.aPantalla(r.x,r.y),w=(typeof tw==='function'?tw(r.s,size):r.s.length*size*.6)+10,h=size+6;
      if(sp.x+w/2<v.x||sp.x-w/2>v.x+v.w||sp.y+h<v.y||sp.y-h>v.y+v.h){r.pe=r.pk=-1;r.hn=0;continue;}       // culling (y olvida el anclaje)
      const q=items[n]||(items[n]={x:0,y:0,w:0,h:0,r:null,pe:-1,pk:-1,p:0});q.x=sp.x;q.y=sp.y;q.w=w;q.h=h;q.r=r;q.pe=r.pe;q.pk=r.pk;
      q.p=r.id===regAct?3:r.prio;
      let j=n++;while(j>0&&items[j-1].p<q.p){items[j]=items[j-1];j--;}items[j]=q;}                       // inserción por prioridad (≤ 12 rótulos)
    items.length=n;const out=ordenarEtiquetas(items,pr,v,BUF.out);
    for(let i=0;i<n;i++){const o=out[i],it=items[i],r=it.r;
      if(it.pe>=0&&(o.e!==it.pe||o.k!==it.pk)&&r.hn<HOLD){        // el anclaje de antes choca: aguanta unos cuadros antes de saltar
        probarEti(it,it.pe,it.pk,pr,v,out,i,o,true);r.hn++;}
      else{r.pe=o.e;r.pk=o.k;r.hn=0;}
      if(!o.libre&&it.p<2)continue;                               // sin sitio: se esconde el de menor prioridad
      const sz=size*o.esc;
      c.save();c.globalAlpha=o.alfa*.9;rr(o.x-o.w/2,o.y-o.h/2,o.w,o.h,o.h/2,'rgba(20,16,28,.82)',2.5);c.restore();
      c.save();c.globalAlpha=o.alfa;txt(r.s,o.x,o.y+1,sz,'#fff3c4',0,true);c.restore();}}
  // Leyenda «CASILLAS» (plegable: el botón vive en main/HUD). rect = {x,y,w,h}; op.abierta (true) o solo el título. Devuelve alto usado.
  T.dibujarLeyenda=function(c,rect,op){
    op=op||{};if(!E())return 0;let alto=26;
    conCtx(c,()=>{
      const filas=LEYENDA.length,cols=rect.w>=300?2:1,por=Math.ceil(filas/cols),fh=22;
      if(op.abierta===false){rr(rect.x,rect.y,rect.w,26,13,'#14101c',3);txt('CASILLAS ▾',rect.x+rect.w/2,rect.y+14,12,'#ffffff',0,true);return;}
      alto=26+por*fh+8;rr(rect.x,rect.y,rect.w,alto,12,'#14101c',3);txt('CASILLAS ▴',rect.x+rect.w/2,rect.y+14,12,'#ffd23f',0,true);
      LEYENDA.forEach((l,i)=>{const col=Math.floor(i/por),fi=i%por,cw=rect.w/cols,x=rect.x+col*cw+16,y=rect.y+26+fi*fh+11,ty=TIPOS[l.t];
        forma(ty.f,x,y,10,'#ffffff',0);forma(ty.f,x,y,8,ty.c,2);glifo(ty.g,x,y,8*.95);
        txt(l.n,x+16+(typeof tw==='function'?tw(l.n,11)/2:l.n.length*3),y+1,11,'#ffffff',0,true);});});
    return alto;};

  T.dibujar=function(c,cam,D,op){
    op=op||{};const t=op.t!==undefined?op.t:ahora(),st={teselas:0,base:0,lod:null,fichas:0,creadas:0},hechas0=cache.hechas;
    if(!E())throw new Error('fiesta-tablero: dibujar necesita engine.js');
    D=D||{};
    let escala=op.escala;if(!escala){try{const m=c.getTransform();escala=Math.hypot(m.a,m.b)||1;}catch(_){escala=1;}}
    const v=cam.v,s0=escFicha(cam),act=actualDe(D,op),pj=D.pj||{};
    conCtx(c,()=>{
      c.save();c.beginPath();c.rect(v.x,v.y,v.w,v.h);c.clip();
      c.save();cam.aplicar(c);
      estatico(c,cam,escala,op.presupuesto===undefined?1:op.presupuesto,st);
      const r=cam.rect(80),tab=D.tab||{},eti=BUF.eti;eti.length=0;
      if(F.arte&&F.arte.dibujarDin&&op.animarMapa!==false)F.arte.dibujarDin(c,t,r);   // olas, barcos, rayos, nubes… (arte pixel animado)
      semilla(7000);                                   // capa dinámica determinista: dos cuadros en reposo salen idénticos (sin parpadeo en tinta/garabato)
      // apagón: el país a oscuras (las tiendas con planta siguen prendidas en el HUD)
      if(tab.apagon){c.save();c.fillStyle='rgba(8,10,30,.38)';c.fillRect(r.x0,r.y0,r.x1-r.x0,r.y1-r.y0);c.restore();}
      // peajes (costo variable de las aristas '1+')
      PEAJES.forEach(q=>{const m=q.m;if(!cam.ve(m.x,m.y,40))return;
        const val=tab.apagon?1:((tab.peajes||{})[q.k]||1);eti.push({x:m.x,y:m.y-44,s:val+'',k:'peaje'});});
      // bancos y monedas sueltas
      Object.keys(tab.bancos||{}).forEach(n=>{const p=P[n];if(!p||!cam.ve(p.x,p.y,60))return;const b=tab.bancos[n];
        if(b>0)eti.push({x:p.x,y:p.y+R_NODO+22,s:'$'+b,k:'banco'});});
      Object.keys(tab.sueltas||{}).forEach((n,i)=>{const p=P[n],q=tab.sueltas[n];if(!p||!q||!cam.ve(p.x,p.y,60))return;
        for(let k=0;k<Math.min(5,q);k++)moneda(p.x+R_NODO+6+(k%3)*8,p.y+10-k*5,9);eti.push({x:p.x+R_NODO+18,y:p.y-24,s:'+'+q,k:'suelta'});});
      // el Señor del Chaleco: tapa la salida tab.chaleco[nodo]
      Object.keys(tab.chaleco||{}).forEach(n=>{const a=tab.chaleco[n];if(!P[n]||!P[a])return;const m=puntoEn(camino(n,a),.32);if(!cam.ve(m.x,m.y,40))return;
        rr(m.x-12,m.y-30,24,30,6,'#ff8a00',3);rr(m.x-3,m.y-30,6,30,0,'#c4cad6',0);ell(m.x,m.y-38,10,10,'#c98a5a',3);});
      // flechas de RUTA
      const R=T.rutas(D);
      if(R){const mio=op.mio!==undefined?op.mio:(op.yo?R.s===op.yo:true),pul=.5+.5*Math.sin(t*7);
        R.opc.forEach(x=>{const pts=camino(R.de,x.a),aim=op.aim===x.a,ok=x.ok!==false;
          const cc=!ok?'#9a9aa6':mio?(aim?'#ffffff':'#ffd23f'):(aim?'#ffffff':'#c8c8d0');
          c.save();c.globalAlpha=ok?.9:.4;line(pts.map(p=>[p.x,p.y]),aim?30:24,'#ffffff');line(pts.map(p=>[p.x,p.y]),aim?18:13,cc);c.restore();
          const f=x.flecha,sz=(aim?1.35:1)*(ok?1+.12*pul:.85);c.save();c.translate(f.x,f.y);c.rotate(f.ang);c.scale(sz,sz);
          if(!ok)c.globalAlpha=.6;poly([[34,0],[-14,-28],[-4,0],[-14,28]],cc,4.5);c.restore();
          if(ok){const p=P[x.a];line(ellP(p.x,p.y,radio(x.a)+10+pul*6,radio(x.a)+10+pul*6),aim?7:5,cc,true);}
          if(x.costo)eti.push({x:f.x,y:f.y-34,s:'-'+x.costo,k:'costo'});
          if(!ok&&x.req)eti.push({x:f.x,y:f.y-34,s:x.req==='llave'?'LLAVE':x.req==='paracaidas'?'PARACAÍDAS':'CERRADO',k:'req'});});}
      // estrella (la Abuela con la arepa): dorada y rebotando
      let star=null;
      estrellasDe(D).forEach((es,k)=>{
        const E_=P[es.nodo];
        if(E_&&cam.ve(E_.x,E_.y,140)){const b=Math.abs(Math.sin(t*3.2+k*1.7))*16,y=E_.y-74-b;
          c.save();c.globalAlpha=.35+.15*Math.sin(t*4);ell(E_.x,E_.y,R_NODO*2,R_NODO*.95,'#ffe66b',0);c.restore();
          c.save();c.translate(E_.x,y);c.rotate(Math.sin(t*2+k*1.7)*.12);
          for(let i=0;i<8;i++){const a=t*.8+i*Math.PI/4;c.save();c.globalAlpha=.35;line([[Math.cos(a)*40,Math.sin(a)*40],[Math.cos(a)*58,Math.sin(a)*58]],5,'#ffe66b');c.restore();}
          poly(estrellaPts(0,0,36,16,0),'#ffd23f',4.5);ell(-9,-10,6,4,'#fff6c0',0);c.restore();
          eti.push({x:E_.x,y:y-48,s:String(es.precio||10),k:'precio'});if(!star)star={x:E_.x,y:y};}});
      // fichas
      animar(D,t,op.saltos);
      const UI=F.ui,lista=BUF.lista;lista.length=0;
      asientos(D).forEach(s=>{const p=T.posFicha(s,D);if(p)lista.push({s:s,p:p});});
      lista.sort((a,b)=>((a.s===act)-(b.s===act))||a.p.y-b.p.y);        // el de turno al frente
      const k_=s0/.46,sc=cam.z,proh=BUF.proh;let np=0;
      const cnt=BUF.cnt||(BUF.cnt={});for(const k in cnt)cnt[k]=0;lista.forEach(f=>{const nd=pj[f.s].nodo;cnt[nd]=(cnt[nd]||0)+1;});   // fichas por casilla (apilado: placas solo turno y yo)
      const regAct=act&&pj[act]&&NOD[pj[act].nodo]?NOD[pj[act].nodo].r:null,PJ=F.PJ;
      const prohibir=(x,y,w,h)=>{const q=proh[np]||(proh[np]={x:0,y:0,w:0,h:0});q.x=x;q.y=y;q.w=w;q.h=h;np++;};
      if(star){const sp=cam.aPantalla(star.x,star.y);prohibir(sp.x-62*sc,sp.y-62*sc,124*sc,150*sc);}
      lista.forEach(f=>{const s=f.s,p=f.p,q=pj[s],hgt=ALTO*s0;if(!cam.veRect(p.x-60*s0-40,p.y-hgt-40,p.x+60*s0+40,p.y+30))return;st.fichas++;
        const idn=identidad(UI,q.ch,s,op),u=T.ult[s]||{},nodoP=P[q.nodo]||p,salta=Math.hypot(p.x-nodoP.x,p.y-nodoP.y)>40;
        const dl=u.land!==undefined?t-u.land:9,rebota=dl>=0&&dl<.5,lev=s===act?10*k_:0;
        semilla(8000+SEATS.indexOf(s)*40);
        // sombra individual (se achica al subir)
        c.save();c.globalAlpha=.25;c.fillStyle='#14101c';c.beginPath();c.ellipse(p.x,(salta?p.y+20:p.y)+4,30*k_*.9*(salta?.8:1),12*k_*.9*(salta?.8:1),0,0,Math.PI*2);c.fill();c.restore();
        if(s===act){const k=.5+.5*Math.sin(t*5);c.save();c.globalAlpha=.5+.4*k;
          line(ellP(p.x,p.y,(34+k*8)*k_,(15+k*4)*k_),6*k_,'#ffffff',true);c.restore();}
        ell(p.x,p.y,28*k_,11*k_,idn.col,3.5);
        const afk=q.cpu==='afk',vuela=u.vola&&u.kk>0&&u.kk<1;
        // squash & stretch: se estira al subir, se aplasta y rebota al aterrizar (oscilación determinista por tiempo)
        let sy=1;if(vuela)sy=1+.12*Math.sin(Math.PI*u.kk);else if(rebota)sy=1-.2*Math.exp(-dl*9)*Math.cos(dl*26);
        if(rebota){const a=1-dl/.5;c.save();c.globalAlpha=.55*a;semilla(9900+SEATS.indexOf(s));
          for(let i=0;i<4;i++){const dir=i<2?-1:1,rap=i%2?.6:1;ell(p.x+dir*(16+90*dl*rap)*k_,p.y-(2+10*dl)*k_,(5+14*dl)*k_,(4+8*dl)*k_,'#ffffff',0);}c.restore();}
        c.save();c.translate(p.x,p.y);c.scale(1/sy,sy);c.translate(-p.x,-p.y);
        semilla(9000+SEATS.indexOf(s)*400);
        const fx=p.x,by=p.y-6*s0-lev,flip=p.x>2000,ov=op.animo&&op.animo[s];       // by = base del busto; la cabeza queda 64·s0 más arriba (centro a 70·s0 de la casilla)
        if(PJ&&PJ.draw){                                  // el personaje de la hoja (F.PJ): misma cara que en los minijuegos, con su gorra/lentes/bigote
          const o=FO;o.modo='cara';o.clip=CL;CL.x=fx-62*s0;CL.y=by-64*s0-76*s0;CL.w=124*s0;CL.h=128*s0;o.flip=flip;o.gris=afk;o.semilla=9000+SEATS.indexOf(s)*400;o.confeti=false;o.sombra=false;
          o.mood=afk?'sleep':ov||(vuela?'o':undefined);
          PJ.draw(c,q.ch,fx,by-64*s0,s0,rebota?'celebrar':(s===act&&D.esp&&D.esp.s===s)?'hablar':'esperar',t,o);}
        else{const L=rostro(q.ch),mood=ov||(afk?'sleep':vuela?'o':rebota?'happy':s===act?'grin':'calm');
          const B=BO[s]&&BO[s].ch===q.ch?BO[s]:(BO[s]=Object.assign({ch:q.ch},L,{th:80,legs:null,under:null,pat:L.pat==='apron'?null:L.pat}));
          B.x=fx;B.y=by;B.s=s0;B.mood=mood;B.flip=flip;bust(B);}
        c.restore();
        if(afk)txt('z z z',p.x+40*k_,p.y-hgt-6-((t*20)%12),18*k_,'#ffffff',-.2);
        const sp=cam.aPantalla(p.x,p.y);prohibir(sp.x-Math.max(20,60*s0*sc*.55),sp.y-(hgt+lev)*sc,Math.max(40,60*s0*sc*1.1),(hgt+lev+14)*sc);
        if(op.etiquetas!==false&&(cnt[q.nodo]>1?(s===act||s===op.yo):(cam.z>=.4||s===act||s===op.yo)))eti.push({x:p.x,y:p.y,s:corto(limpio(q.name||s),12),k:'nombre',col:idn.col,col2:idn.col2,seat:s,cpu:q.cpu,ch:q.ch});});
      c.restore();
      // pantalla: placas y burbujas a tamaño fijo (legibles con cualquier zoom)
      const eq=op.equipos||(D.mj&&(D.mj.tipo==='2v2'||D.mj.tipo==='1v3')?D.mj.eq:null);
      // placas de nombre: lista ordenada por x, hasta 4 filas bajo la casilla (no tapan su icono), sin encimarse
      const pl=BUF.placas;pl.length=0;
      eti.forEach(e=>{if(e.k==='nombre')pl.push(e);});
      pl.sort((a,b)=>a.x-b.x);
      const puestas=BUF.puestas;puestas.length=0;
      // insignias de monto (banco, monedas sueltas, peajes, precio, costo): se dibujan ANTES que las placas y reservan su sitio, así una placa nunca las tapa
      eti.forEach(e=>{if(e.k==='nombre')return;const sp=cam.aPantalla(e.x,e.y);let w=40;
        if(e.k==='peaje'){moneda(sp.x-16,sp.y,9);w=badge(sp.x+8,sp.y,e.s,'#ffffff','#14101c',13)+26;}
        else if(e.k==='banco')w=badge(sp.x,sp.y,e.s,'#f2c230','#3a2a00',13);
        else if(e.k==='suelta')w=badge(sp.x,sp.y,e.s,'#fff6c0','#3a2a00',12);
        else if(e.k==='precio'){moneda(sp.x-20,sp.y,10);w=badge(sp.x+8,sp.y,e.s,'#ffd23f','#3a2a00',15)+28;}
        else if(e.k==='costo'){moneda(sp.x-18,sp.y,9);w=badge(sp.x+6,sp.y,e.s,'#ffffff','#d93a3a',14)+24;}
        else if(e.k==='req')w=badge(sp.x,sp.y,e.s,'#3a3a46','#ffffff',12);
        puestas.push({x:sp.x,y:sp.y-13,w:w});});
      pl.forEach(e=>{const sp=cam.aPantalla(e.x,e.y),usaPJ=!!(PJ&&PJ.placa),tag=e.cpu==='afk'?' zzz':e.cpu?' CPU':'',s=e.s+(usaPJ?'':e.cpu==='afk'?' zz':''),
        eqi=eq?eq.findIndex(g=>g.indexOf(e.seat)>=0):-1,ins=usaPJ&&eqi>=0?14:0,
        w=usaPJ?Math.max(48,(typeof tw==='function'?tw(s+tag,14):s.length*8)+24+ins):Math.max(40,(typeof tw==='function'?tw(s,12):s.length*7)+18),y0=sp.y+R_NODO*sc*.95+4;let fila=0;
        for(;fila<3;fila++){const yy=y0+fila*26;if(!puestas.some(q=>Math.abs(q.x-sp.x)<(q.w+w)/2+2&&Math.abs(q.y-yy)<26))break;}
        const y=y0+fila*26;puestas.push({x:sp.x,y:y,w:w});prohibir(sp.x-w/2-3,y,w+6,26);
        if(usaPJ){const po=FP;po.w=w;po.cpu=e.cpu||null;po.equipo=eqi>=0?eqi%2:undefined;PJ.placa(sp.x,y+13,s,e.ch,po);}   // placa con el color de identidad del personaje
        else{const bc=eqi>=0?EQUIPO[eqi%2]:e.col;rr(sp.x-w/2-3,y+2,w+6,24,12,bc,3);rr(sp.x-w/2,y+5,w,18,9,e.col2||e.col,0);txt(s,sp.x,y+15,12,'#ffffff',0);}});
      // rótulos de región: pasada de pantalla DESPUÉS de las fichas, apartados de fichas, placas, dado/«QUEDAN n», HUD y minimapa
      if(op.rotulos!==false)pintarRotulos(c,cam,v,op,proh,np,regAct);
      c.restore();
    });
    st.creadas=cache.hechas-hechas0;T.stats=st;return st;};

  T.dibujarMini=function(c,cam,D,rect,op){
    op=op||{};const m=F.cam?F.cam.mini(rect,MUNDO):null;if(!m||!E())return m;
    conCtx(c,()=>{
      const b=base();if(cache.estilo!==estilo()){T.invalidar();cache.estilo=estilo();}
      rr(rect.x-4,rect.y-4,rect.w+8,rect.h+8,8,'#14101c',3);
      c.save();c.beginPath();c.rect(m.x,m.y,m.w,m.h);c.clip();c.drawImage(b,m.x,m.y,m.w,m.h);
      const r=cam.rect(0),a=m.aMini(r.x0,r.y0),z=m.aMini(r.x1,r.y1);
      c.strokeStyle='#ffffff';c.lineWidth=2;c.strokeRect(a.x,a.y,z.x-a.x,z.y-a.y);
      if(D)estrellasDe(D).forEach(es=>{if(!P[es.nodo])return;const p=m.aMini(P[es.nodo].x,P[es.nodo].y);poly(estrellaPts(p.x,p.y,6,2.6,0),'#ffd23f',1.5);});
      asientos(D).forEach(s=>{const q=T.posFicha(s,D);if(!q)return;const p=m.aMini(q.x,q.y);
        const q2=D.pj[s],idn=identidad(F.ui,q2&&q2.ch,s,op);ell(p.x,p.y,4.5,4.5,idn.col,2);});
      c.restore();});
    return m;};
  return T;
}

F.tablero={crear:crear,apilar:apilar,ordenarEtiquetas:ordenarEtiquetas,tamRotulo:tamRotulo,LEYENDA:LEYENDA,arco:arco,enTierra:enTierra,puntoEn:puntoEn,trazo:trazo,ESC:ESC,MUNDO:MUNDO,TIPOS:TIPOS,MODOS:MODOS,
  SILUETA:SILUETA,COLORES:COLORES};
if(typeof module!=='undefined')module.exports=F.tablero;
})(typeof window!=='undefined'?window:globalThis);
