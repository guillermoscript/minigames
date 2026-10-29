'use strict';
/* LA FIESTA · EN VIVO · f_bolas · ¡BOLAS CRIOLLAS!  (FFA por puestos, modelo C: el juez simula TODAS las bolas, que chocan entre sí)
   Cancha de tierra en el llano, tablas alrededor y el tío de árbitro. Cada quien tiene 3 bolas de su color y hay TRES lanzamientos SIMULTÁNEOS.
     Stick (izq./der.) = gira la puntería · MANTENER A = el medidor de fuerza sube y baja (ida y vuelta en 2,2 s) · SOLTAR A = lanza con la fuerza de ese momento.
   Cada lanzamiento tiene su ventana (6,2 s con dur 35, la cuenta se ve arriba; la práctica de 20 s juega 2 lanzamientos). Las bolas ruedan con fricción de tierra, chocan entre sí (¡clac!) y empujan al MINGO (la bolita blanca).
   Cuando todo para, el tío MIDE: por jugador cuenta su bola más cercana al mingo (de las que tenga en la cancha, también las de tiros anteriores):
     1.º 4 pts · 2.º 2 · 3.º 1 · 4.º 0 (empate exacto = mismos puntos). Se suma en los 3 lanzamientos (máx. 12). Quien no lanzó no tiene bola: 0.
   Las bolas SE QUEDAN en la cancha: sacarle la bola al que va ganando vale tanto como arrimar la tuya. El puesto en la raya se sortea por partida (los del centro tiran más derecho).
   CPU: apunta al mingo con ruido σ = (1 − skill)·12°, «se imagina» varios tiros con todas las bolas de la cancha (más cuanto mejor es) y elige el que más puntos le da;
   en Nv3 además prueba a sacar la bola del líder y espera a que el carajito patee.
   Niveles: 1 sin viento (día) · 2 viento lateral sembrado por lanzamiento, la banderita lo enseña (atardecer) · 3 viento y además «¡EL CARAJITO!»: a una hora sembrada de la
   ventana un chamo le da una patada al mingo (aviso 0,8 s) y lo manda a otro sitio (noche, bombillo).
   Red (modelo C, doc 09): el medidor y la puntería de un humano corren EN SU PANTALLA (sin lag) y al soltar manda `xtiro {r, a, f}` (ángulo ×10, fuerza ×1000), fiable:
   si en 0,6 s su bola no aparece en el snapshot lo repite (el juez deduplica por bola). El juez acepta el tiro si es del lanzamiento vigente y llega dentro de la ventana o
   de la gracia (si falta el tiro de alguien, la rodada espera hasta 2,5 s: por el relé HTTP una pantalla remota ve la cuenta 1-2 s atrasada; su ventana se cierra cuando ELLA ve el final). Las CPU y el asiento del propio juez lanzan dentro de step() con c.held/c.eje (mismo medidor
   a 1/30 s). Estado sincronizado (pack, 81 enteros, s + s2): bolas ×12 (x, y en 1/4 px; vx, vy en 1/64 px/tick; activa), mingo, fase, contador de choques (para el ¡clac! en
   todas las pantallas) y puntos. restore() sigue EXACTO tras migrar el juez. El azar (mingo, viento, patada) sale de c.rng en mk; CPU de c.rngFor('cpu'+p).
   Relevo del juez: el juez nuevo restaura el último snapshot; el tiro propio del juez queda anotado como xtiro y se reenvía si se pierde; si el estado quedó >2 s atrás
   del reloj se adelanta sin lanzadores y la medición se acorta (los 3 lanzamientos caben en dur). Si aun así dur llega antes de medir, scores() cuenta la cancha tal cual.
   Límite conocido: el asiento del juez ve SU medidor con el retraso de equidad del runtime (fairDelay ≤0,12 s) y tiende a pasarse un pelo; medido no le resta ni le da ventaja.
   Es el C más tolerante al lag: no hay avatar que predecir, solo bolas. Dibujo solo con primitivas del laboratorio. Sin Math.random/Date.now. */
(function(){
if(typeof window==='undefined'||!window.FIESTA||!FIESTA.LIVE||FIESTA.LIVE.get('f_bolas'))return;

var TK=30, MAXP=4, NR=3, NBALL=MAXP*NR;
var CX=400, AX0=168, AX1=632, AY0=112, AY1=440;        /* cancha (cara interna de las tablas) */
var LINEA=410, YB=400, PY=468;                          /* raya de tiro, salida de la bola, pies del lanzador */
var RB=11, RM=6, MB=1, MM=0.4, FRM=0.28;                /* radios y masas: bola, mingo; el mingo (chiquito) frena más en la tierra */
var FR=0.12, VMIN=3.0, VMAX=9.6;                        /* fricción de tierra (px/tick²) y velocidad de salida (px/tick) */
var REST=0.9, REST_PARED=0.45;
var ROT=60, ANGMAX=60, PERIODO=2.2;                     /* giro de la puntería (°/s), tope (°), medidor ida y vuelta (s) */
var GRACIA=75, GRACIA0=12, ROLLMAX=90, MEDT=60, AVISO=24, LAGMAX=60; /* gracia para tiros remotos (si falta alguien / si ya lanzaron todos), tope de rodada, medición, aviso del carajito, retraso tolerado tras migrar (ticks) */
var PTS=[4,2,1,0];
var G=13, PS=2, BS=5, PACKN=G+PS*MAXP+BS*NBALL;          /* 13 globales + 2 por jugador + 5 por bola = 81 */
var I_BOLA=G+PS*MAXP;

function q4(v){return Math.round(v*4)/4;}
function q64(v){return Math.round(v*64)/64;}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function medidor(m){var u=(m%PERIODO)/(PERIODO/2);return u<=1?u:2-u;}
function vSalida(f){return VMIN+clamp(f,0,1)*(VMAX-VMIN);}
function SND(f,d,ty,v,sl){try{if(typeof snd==='function')snd(f,d,ty,v,sl);}catch(e){}}
function PUFF(x,y,k,cols){try{if(typeof spawn==='function')spawn(x,y,k,'bit',cols,160,260,.6);}catch(e){}}

/* física de un objeto (bola o mingo): fricción de Coulomb, viento lateral mientras rueda, tablas con rebote amortiguado */
function mueve(o,wx){
  var sp=Math.sqrt(o.vx*o.vx+o.vy*o.vy);
  if(sp<=0)return;
  var ns=sp-(o.fr||FR);
  if(ns<=0){o.vx=0;o.vy=0;return;}
  o.vx=o.vx*ns/sp+wx;o.vy=o.vy*ns/sp;
  o.x+=o.vx;o.y+=o.vy;
  if(o.x<AX0+o.r){o.x=AX0+o.r;o.vx=-o.vx*REST_PARED;}
  if(o.x>AX1-o.r){o.x=AX1-o.r;o.vx=-o.vx*REST_PARED;}
  if(o.y<AY0+o.r){o.y=AY0+o.r;o.vy=-o.vy*REST_PARED;}
  if(o.y>AY1-o.r){o.y=AY1-o.r;o.vy=-o.vy*REST_PARED;}
}
/* choques elásticos entre círculos (masa y restitución) + separación; cb(A,B,vrel) en cada impacto del primer pase */
function choques(L,cb){
  var i2,j,A,B,dx,dy,d,nx,ny,mr,vrel,J,ov,wa,pass;
  for(pass=0;pass<2;pass++){
    for(i2=0;i2<L.length;i2++)for(j=i2+1;j<L.length;j++){
      A=L[i2];B=L[j];dx=B.x-A.x;dy=B.y-A.y;mr=A.r+B.r;
      if(dx>mr||dx<-mr||dy>mr||dy<-mr)continue;
      d=Math.sqrt(dx*dx+dy*dy);if(d>=mr)continue;
      if(d<0.001){nx=1;ny=0;d=0;}else{nx=dx/d;ny=dy/d;}
      vrel=(B.vx-A.vx)*nx+(B.vy-A.vy)*ny;
      if(vrel<0){
        J=-(1+REST)*vrel/(1/A.ms+1/B.ms);
        A.vx-=J/A.ms*nx;A.vy-=J/A.ms*ny;B.vx+=J/B.ms*nx;B.vy+=J/B.ms*ny;
        if(cb&&pass===0)cb(A,B,vrel);
      }
      ov=mr-d;wa=(1/A.ms)/(1/A.ms+1/B.ms);
      A.x-=nx*ov*wa;A.y-=ny*ov*wa;B.x+=nx*ov*(1-wa);B.y+=ny*ov*(1-wa);
    }
  }
}
/* trayectoria de una bola sola (sin choques): la usan las CPU para apuntar */
function simula(x,y,a,f,wx){
  var v=vSalida(f),r=a*Math.PI/180,o={x:x,y:y,vx:Math.sin(r)*v,vy:-Math.cos(r)*v,r:RB},i;
  for(i=0;i<240&&(o.vx!==0||o.vy!==0);i++)mueve(o,wx);
  return o;
}

var DISC=[];
var POSIDX=[8,9];
(function(){var i;for(i=0;i<G;i++)if(i!==8&&i!==9)DISC.push(i);for(i=G;i<I_BOLA;i++)DISC.push(i);
  for(i=0;i<NBALL;i++){var b=I_BOLA+BS*i;POSIDX.push(b,b+1);DISC.push(b+2,b+3,b+4);}})();

var PAL=[
  {cielo:'#9fdcff',cielo2:'#d8f2ff',cerro:'#7fa86a',cerro2:'#5f8a54',pasto:'#8cc063',pasto2:'#74a94f',tierra:'#d7a86e',tierra2:'#c4925a',tabla:'#8a5a32',tablaD:'#64401f',raya:'#fff8e6',sol:'#ffe66b',noche:0},
  {cielo:'#ff9d66',cielo2:'#ffd38c',cerro:'#a8765c',cerro2:'#8a5a48',pasto:'#b39a52',pasto2:'#9a8040',tierra:'#d39a62',tierra2:'#bd844e',tabla:'#7a4a2a',tablaD:'#56321a',raya:'#fff0d8',sol:'#ffb35a',noche:0},
  {cielo:'#1c1a46',cielo2:'#34306e',cerro:'#2a3550',cerro2:'#1f2840',pasto:'#3a5640',pasto2:'#2e4634',tierra:'#9b7f68',tierra2:'#87705c',tabla:'#5a3a26',tablaD:'#3e2818',raya:'#e8e4ff',sol:'#f4f0d0',noche:1}
];

FIESTA.LIVE.add('f_bolas',{
  name:'¡BOLAS CRIOLLAS!', modos:['ffa'], clase:'rank', modelo:'C', dur:35,
  stick:true, botones:1, snapHz:10, migra:true, minHumanos:1,
  limites:{scoreMax:12, scoreRate:1, minT:26, finTemprano:1},
  packN:PACKN, packDiscretos:DISC,
  carta:{
    obj:'Arrima tu bola al mingo (la bolita blanca) o saca la del que va ganando',
    gana:'Tras cada lanzamiento: la bola más cerca 4 pts, luego 2, 1 y 0. Se suman los 3 tiros.',
    como:{tactil:'Joystick = apuntar · MANTÉN A para la fuerza y SUELTA para lanzar', teclado:'← → apuntar · MANTÉN ESPACIO y suelta'},
    demos:[{id:'apuntar',txt:'Gira la flecha con el joystick hacia el mingo'},{id:'fuerza',txt:'Mantén A: el medidor sube y baja. Suelta cuando marque la fuerza justa'},{id:'sacar',txt:'Las bolas chocan: ¡dale a la del líder y sácala!'}],
    roles:null
  },
  mk:function(c){
    var n=c.n, lv=clamp(c.lv||1,1,3), pal=PAL[lv-1], rng=c.rng, i, p, r;
    var durT=Math.max(90,Math.round(c.dur*TK));
    /* calendario por lanzamiento: cabe en dur (35 s => ventana de 6,5 s; práctica de 20 s => ≈3 s) */
    var NRE=durT>=900?NR:2;                         /* lanzamientos de esta partida: 3 (dur ≥30 s); la práctica de 20 s juega 2 con la ventana normal */
    var presu=Math.floor((durT-15)/NRE);
    var MEDK=presu>=280?MEDT:Math.max(30,Math.round(presu*0.2));
    var ROLLK=presu>=280?ROLLMAX:Math.max(45,Math.round(presu*0.3));
    var AIMT=clamp(presu-ROLLK-MEDK-9,75,186);                    /* 6,2 s con dur 35; 4,4 s en la práctica */

    /* ── azar sembrado (idéntico en todas las pantallas) ── */
    var m0x=rng.int(340,460), m0y=rng.int(180,240);
    var WX=[],KICK=[],KA=[],KV=[];
    for(r=0;r<NR;r++){
      var w=0.012+rng.next()*0.02, sg=rng.next()<0.5?-1:1;
      WX.push(lv>=2?Math.round(sg*w*1000)/1000:0);
      KICK.push(clamp(rng.int(70,130),AVISO+10,AIMT-30));
      KA.push(rng.next()*Math.PI*2);
      KV.push(4.6+rng.next()*2.0);
    }
    /* puesto en la raya sorteado por partida: los del centro tiran más derecho (medido: ganan ~31 % contra ~20 % de las puntas), así nadie lo tiene fijo */
    var orden=[];for(p=0;p<n;p++)orden.push(p);orden=rng.shuffle(orden);
    var XS=[];for(p=0;p<MAXP;p++)XS.push(CX+((p<n?orden[p]:p)-(n-1)/2)*84);

    /* ── estado autoritativo ── */
    var st={k:0,r:0,fase:0,ft:0,choqN:0,choqX:0,choqY:0,choqF:0,pat:0,
      m:{x:m0x,y:m0y,vx:0,vy:0,r:RM,ms:MM,fr:FRM},u:[],lp:[],b:[]};
    for(p=0;p<MAXP;p++){st.u.push(0);st.lp.push(0);}
    for(i=0;i<NBALL;i++)st.b.push({x:0,y:0,vx:0,vy:0,act:0,r:RB,ms:MB});

    /* lanzadores: puntería + medidor. El juez mueve los de las CPU y el suyo en step(); un no-juez mueve el suyo en update() y lo manda por xtiro */
    var TH=[];for(p=0;p<MAXP;p++){var a0=Math.atan2(m0x-XS[p],YB-m0y)*180/Math.PI;TH.push({ang:Math.round(clamp(a0,-ANGMAX,ANGMAX)/5)*5,carg:0,m:0});}
    var cola=[];                                    /* tiros recibidos (solo juez), se aplican en el próximo step */
    var env=null;                                   /* último xtiro propio enviado (no juez) */
    var cp=[];for(p=0;p<n;p++)cp.push({r:-1,plan:null,est:0,tt:0,rr:c.rngFor('cpu'+p)});

    /* ── cosmético ── */
    var at=0,prev={act:[],choqN:0,fase:-1,pat:0,r:-1},swing=[],pops=[],sparks=[],shake=0,banner=null,med=null,medT=0,tioDice=null,lanceT=-9;
    for(i=0;i<NBALL;i++)prev.act.push(0);
    for(p=0;p<MAXP;p++)swing.push(-9);
    var dots=[];(function(){var h=12345,k;for(k=0;k<70;k++){h=(Math.imul(h,1103515245)+12345)>>>0;var x=AX0+8+(h%1000)/1000*(AX1-AX0-16);h=(Math.imul(h,1103515245)+12345)>>>0;var y=AY0+8+(h%1000)/1000*(AY1-AY0-16);h=(Math.imul(h,1103515245)+12345)>>>0;dots.push({x:x,y:y,s:1.5+(h%100)/40});}})();
    var gags=['¡Esa bola está más cerca|que el bono!','¡Pegadita, pegadita!','¡Eso es MANO, señores!'];

    function lanzo(p2){return st.b[p2*NR+st.r]?st.b[p2*NR+st.r].act:0;}
    function lanzoR(p2,r2){var b=st.b[p2*NR+r2];return b?b.act:0;}
    function activos(){var l=[],j;for(j=0;j<NBALL;j++)if(st.b[j].act)l.push(st.b[j]);l.push(st.m);return l;}
    function todos(){var p2;for(p2=0;p2<n;p2++)if(!lanzo(p2))return false;return true;}
    function quietos(){var j;for(j=0;j<NBALL;j++){var b=st.b[j];if(b.act&&(b.vx!==0||b.vy!==0))return false;}return st.m.vx===0&&st.m.vy===0;}
    function dist(b){var dx=b.x-st.m.x,dy=b.y-st.m.y;return Math.sqrt(dx*dx+dy*dy);}
    /* bola más cercana de un jugador (índice o -1) */
    function mejor(p2){var bi=-1,bd=1e9,j;for(j=0;j<NR;j++){var b=st.b[p2*NR+j];if(!b.act)continue;var d=dist(b);if(d<bd){bd=d;bi=p2*NR+j;}}return bi;}
    /* reparto del lanzamiento: 4/2/1/0 por la mejor bola de cada uno (empate exacto = mismos puntos) */
    function ranking(){
      var out=[],p2,q,d=[];
      for(p2=0;p2<n;p2++){var bi=mejor(p2);d.push(bi>=0?dist(st.b[bi]):-1);}
      for(p2=0;p2<n;p2++){
        if(d[p2]<0){out.push({p:p2,pts:0,d:-1,bi:-1});continue;}
        var rk=0;for(q=0;q<n;q++)if(q!==p2&&d[q]>=0&&d[q]<d[p2]-0.001)rk++;
        out.push({p:p2,pts:PTS[rk]||0,d:d[p2],bi:mejor(p2)});
      }
      return out;
    }

    /* puntería + medidor de un asiento: devuelve {a,f} al soltar A */
    function avanza(th,held,ex,dt,puede){
      th.ang=clamp(th.ang+ex*ROT*dt,-ANGMAX,ANGMAX);
      if(!puede){th.carg=0;th.m=0;return null;}
      if(held){if(!th.carg){th.carg=1;th.m=0;}else th.m+=dt;return null;}
      if(th.carg){var f=medidor(th.m);th.carg=0;th.m=0;return {a:th.ang,f:f};}
      return null;
    }
    function aplicaTiro(p2,r2,a,f){
      if(!(p2>=0&&p2<n)||r2!==st.r)return false;
      if(!(st.fase===0||(st.fase===1&&st.ft<GRACIA)))return false;
      var b=st.b[p2*NR+r2];if(!b||b.act)return false;
      a=Math.round(clamp(+a||0,-ANGMAX,ANGMAX)*10)/10;f=Math.round(clamp(+f||0,0,1)*1000)/1000;
      var v=vSalida(f),ra=a*Math.PI/180;
      b.act=1;b.x=XS[p2];b.y=YB;b.vx=q64(Math.sin(ra)*v);b.vy=q64(-Math.cos(ra)*v);
      return true;
    }
    c.on('xtiro',function(d,p2){
      if(!c.juez()||!d||typeof d!=='object')return;
      cola.push({p:p2,r:d.r|0,a:(+d.a||0)/10,f:(+d.f||0)/1000});
    });

    /* ───────────────────────── reglas (solo juez) ───────────────────────── */
    function alChoque(A,B,vrel){
      if(-vrel>0.6){st.choqN=(st.choqN+1)%1000;st.choqX=Math.round((A.x+B.x)/2);st.choqY=Math.round((A.y+B.y)/2);st.choqF=Math.min(9,Math.round(-vrel));}
    }
    function fisica(){
      var L=activos(),i2,wx=WX[st.r]||0;
      for(i2=0;i2<L.length;i2++)mueve(L[i2],wx);
      choques(L,alChoque);
      for(i2=0;i2<L.length;i2++){
        var o=L[i2];
        o.x=q4(clamp(o.x,AX0+o.r,AX1-o.r));o.y=q4(clamp(o.y,AY0+o.r,AY1-o.r));
        o.vx=q64(o.vx);o.vy=q64(o.vy);
        if(Math.abs(o.vx)+Math.abs(o.vy)<FR*0.5){o.vx=0;o.vy=0;}
      }
    }
    /* un tick del juez. Si el estado va atrás del reloj (un juez nuevo restauró un snapshot viejo: el runtime salta k30 sin simular), la partida queda «retrasada».
       Hasta 2 s de retraso se respeta (los tiros perdidos en el relevo se reenvían y caben en la ventana) y se recupera acortando la medición; más allá se adelanta
       aquí mismo sin lanzadores. Así los 3 lanzamientos caben en dur aunque migre el juez. */
    var retraso=0;
    function step(){
      var ahora=Math.floor((typeof c.ahora==='function'?c.ahora():0)*TK),g=0;
      retraso=Math.max(0,ahora-st.k-8);
      tick1(false);
      while(st.fase!==3&&ahora-st.k>LAGMAX&&g++<600)tick1(true);
    }
    function tick1(rapido){
      var p2,j,t;
      if(st.fase===3){st.k++;return;}
      /* lanzadores que mueve el juez: CPU y su propio asiento */
      for(p2=0;p2<n&&!rapido;p2++){
        if(!(c.cpu[p2]||p2===c.yo))continue;
        var e=c.eje(p2)||{x:0,y:0};
        t=avanza(TH[p2],c.held(p2,'a'),clamp(+e.x||0,-1,1),1/TK,st.fase===0&&!lanzo(p2));
        if(t){
          cola.push({p:p2,r:st.r,a:t.a,f:t.f});
          /* mi propio tiro como juez: queda anotado como xtiro, por si me relevan antes del próximo snapshot (el juez nuevo lo recibe en el reenvío) */
          if(p2===c.yo&&!c.cpu[p2])env={r:st.r,a:Math.round(t.a*10),f:Math.round(t.f*1000),at:at};
        }
      }
      for(j=0;j<cola.length;j++)aplicaTiro(cola[j].p,cola[j].r,cola[j].a,cola[j].f);
      cola.length=0;
      if(st.fase===0){
        if(lv>=3&&!st.pat&&st.ft>=KICK[st.r]){
          st.pat=1;st.m.vx=q64(Math.cos(KA[st.r])*KV[st.r]);st.m.vy=q64(Math.sin(KA[st.r])*KV[st.r]);
        }
        fisica();
        st.ft++;
        if(st.ft>=AIMT){
          /* se cierra la ventana: quien estaba cargando lanza con lo que tenga */
          for(p2=0;p2<n&&!rapido;p2++){
            if(!(c.cpu[p2]||p2===c.yo))continue;
            var th=TH[p2];
            if(th.carg&&!lanzo(p2)&&aplicaTiro(p2,st.r,th.ang,medidor(th.m))&&p2===c.yo&&!c.cpu[p2])env={r:st.r,a:Math.round(th.ang*10),f:Math.round(medidor(th.m)*1000),at:at};
            th.carg=0;th.m=0;
          }
          st.fase=1;st.ft=0;
        }
      }else if(st.fase===1){
        fisica();
        st.ft++;
        if((st.ft>=GRACIA0&&quietos()&&todos())||(st.ft>=GRACIA&&quietos())||st.ft>=ROLLK){
          for(j=0;j<NBALL;j++){st.b[j].vx=0;st.b[j].vy=0;}
          st.m.vx=0;st.m.vy=0;
          var rk=ranking();
          for(j=0;j<rk.length;j++){st.u[rk[j].p]+=rk[j].pts;st.lp[rk[j].p]=rk[j].pts;}
          st.fase=2;st.ft=0;
        }
      }else if(st.fase===2){
        st.ft++;
        if(st.ft>=MEDK-Math.min(MEDK-30,retraso)){
          st.r++;st.ft=0;st.pat=0;
          st.fase=st.r>=NRE?3:0;
          if(st.fase===3)st.r=NRE-1;
        }
      }
      st.k++;
    }

    /* ───────────────────────── snapshot ───────────────────────── */
    function pack(){
      var a=[st.k,st.r,st.fase,st.ft,st.choqN,st.choqX,st.choqY,st.choqF,Math.round(st.m.x*4),Math.round(st.m.y*4),Math.round(st.m.vx*64),Math.round(st.m.vy*64),st.pat],j,b;
      for(j=0;j<MAXP;j++)a.push(st.u[j],st.lp[j]);
      for(j=0;j<NBALL;j++){b=st.b[j];a.push(Math.round(b.x*4),Math.round(b.y*4),Math.round(b.vx*64),Math.round(b.vy*64),b.act);}
      return a;
    }
    function load(a){
      if(!a||a.length<PACKN)return;
      var j,b,o;
      st.k=a[0]|0;st.r=a[1]|0;st.fase=a[2]|0;st.ft=a[3]|0;st.choqN=a[4]|0;st.choqX=a[5]|0;st.choqY=a[6]|0;st.choqF=a[7]|0;
      st.m.x=a[8]/4;st.m.y=a[9]/4;st.m.vx=a[10]/64;st.m.vy=a[11]/64;st.pat=a[12]|0;
      for(j=0;j<MAXP;j++){st.u[j]=a[G+PS*j]|0;st.lp[j]=a[G+PS*j+1]|0;}
      for(j=0;j<NBALL;j++){o=I_BOLA+BS*j;b=st.b[j];b.x=a[o]/4;b.y=a[o+1]/4;b.vx=a[o+2]/64;b.vy=a[o+3]/64;b.act=a[o+4]|0;}
    }
    function lerp(a,b,u){
      var out=b.slice(),j,ix;
      for(j=0;j<POSIDX.length;j++){
        ix=POSIDX[j];
        if(ix>=I_BOLA){var act=I_BOLA+BS*Math.floor((ix-I_BOLA)/BS)+4;if(!a[act]||!b[act])continue;}
        if(Math.abs(b[ix]-a[ix])<800)out[ix]=Math.round(a[ix]+(b[ix]-a[ix])*u);
      }
      return out;
    }

    /* ───────────────────────── presentación ───────────────────────── */
    function newPop(s,x,y,col,life,size){pops.push({s:s,x:x,y:y,col:col||'#fff',t:0,life:life||1.4,size:size||22});if(pops.length>12)pops.shift();}
    /* color de la bola = color de identidad del personaje (el mismo de la ficha del HUD); si dos asientos coinciden, el segundo toma uno de respaldo */
    var RESP=['#ff6b6b','#4dd0e1','#ffd23f','#9b6bff'];
    function colorBase(p2){
      var s=c.seats[p2]||{},col=null;
      try{if(window.FIESTA&&FIESTA.ui&&FIESTA.ui.ident&&s.ch){var id=FIESTA.ui.ident(s.ch);col=id&&id.col;}}catch(e){col=null;}
      return col||s.color||RESP[p2%4];
    }
    var colMemo=[],colAt=-1;
    function colorDe(p2){
      if(colAt===at&&colMemo[p2])return colMemo[p2];
      if(colAt!==at){colMemo=[];colAt=at;}
      var col=colorBase(p2),q;
      for(q=0;q<p2;q++)if(colorBase(q)===col){col=RESP[(p2+1)%4]===col?RESP[(p2+2)%4]:RESP[(p2+1)%4];break;}
      colMemo[p2]=col;return col;
    }
    function nombreDe(p2){var s=c.seats[p2]||{};return s.name||('P'+(p2+1));}

    function update(dt){
      at+=dt;var j,p2;
      /* mi puntería y mi medidor (no juez): corre aquí sin lag y sale por xtiro */
      var yo=c.yo;
      if(!c.juez()&&yo>=0&&yo<n){
        var th=TH[yo],e=c.eje(yo)||{x:0,y:0},ya=lanzo(yo)||(env&&env.r===st.r);
        var t=null;
        if(st.fase===1&&th.carg&&!ya&&st.ft<GRACIA){t={a:th.ang,f:medidor(th.m)};th.carg=0;th.m=0;}
        else t=avanza(th,c.held(yo,'a'),clamp(+e.x||0,-1,1),dt,st.fase===0&&!ya);
        if(t){
          env={r:st.r,a:Math.round(t.a*10),f:Math.round(t.f*1000),at:at};
          c.send('xtiro',{r:env.r,a:env.a,f:env.f});
          swing[yo]=at;lanceT=at;if(v3)tiro3D(yo,-1);else SND(420,.22,'triangle',.08,-260);
        }else if(env&&env.r===st.r&&!lanzo(yo)&&at-env.at>0.6&&(st.fase===0||(st.fase===1&&st.ft<GRACIA))){
          env.at=at;c.send('xtiro',{r:env.r,a:env.a,f:env.f});
        }
      }
      /* eventos cosméticos por diferencias del estado */
      for(j=0;j<NBALL;j++){
        var b=st.b[j];
        if(b.act&&!prev.act[j]){p2=Math.floor(j/NR);if(at-swing[p2]>0.5)swing[p2]=at;if(v3)tiro3D(p2,j);else{PUFF(b.x,b.y+6,6,['#e8c79a','#c9a06e']);if(p2!==yo||c.juez())SND(380,.18,'triangle',.05,-200);}}
        prev.act[j]=b.act;
      }
      if(st.choqN!==prev.choqN){
        var f=st.choqF;
        if(v3)clac3D(f);
        else{SND(900+f*120,.06,'square',.05+f*.01);SND(1900+f*60,.04,'triangle',.05);
          sparks.push({x:st.choqX,y:st.choqY,t:0,f:f});if(sparks.length>6)sparks.shift();
          shake=Math.max(shake,Math.min(6,1+f*.8));}
        if(f>=4)newPop('¡CLAC!',st.choqX,st.choqY-26,'#fff6c9',0.7,18+f*2);
        prev.choqN=st.choqN;
      }
      if(st.pat&&!prev.pat){newPop('¡PUM!',st.m.x,st.m.y-30,'#ffd23f',0.9,30);if(v3)patada3D();else{SND(160,.18,'sawtooth',.08,-60);shake=6;}}
      prev.pat=st.pat;
      if(st.fase!==prev.fase||st.r!==prev.r){
        if(st.fase===0){banner={s:'LANZAMIENTO '+(st.r+1)+' DE '+NRE,t:0,life:1.4,col:'#ffffff'};med=null;tioDice=null;if(!v3)SND(660,.12,'square',.05);}
        if(st.fase===2){med=ranking();medT=0;med.sort(function(x,y){return (y.d<0?-1:y.d)-(x.d<0?-1:x.d)||x.p-y.p;});tioDice=null;}
        if(st.fase===3&&prev.fase!==3){banner={s:'¡SE ACABÓ!',t:0,life:3,col:'#ffd23f'};}
        if(v3&&(st.fase!==prev.fase||st.fase===0))fase3D();
        prev.fase=st.fase;prev.r=st.r;
      }
      if(med){
        var ant=medT;medT+=dt;
        var N=med.length,k;
        for(k=0;k<N;k++){
          var tk=0.25+k*0.32;
          if(ant<tk&&medT>=tk&&med[k].bi>=0){if(v3)mide3D(k);else SND(520+k*140,.08,'square',.05);}
        }
        var tf=0.25+N*0.32+0.15;
        if(ant<tf&&medT>=tf){
          for(k=0;k<N;k++){var mk=med[k];if(mk.bi<0)continue;var bb=st.b[mk.bi],sx2=bb.x>=st.m.x?1:-1;newPop('+'+mk.pts,bb.x+sx2*26,bb.y-18-(N-1-k)*10,mk.pts>=4?'#ffe14d':colorDe(mk.p),1.5,mk.pts>=4?30:20);}
          var top=null;for(k=0;k<N;k++)if(med[k].pts===4&&med[k].bi>=0)top=med[k];
          if(v3)canta3D(top);
          if(top){if(!v3){SND(1046,.25,'square',.06);SND(1318,.3,'square',.05);}
            tioDice=top.d<19.5?gags[0]:(top.d<36?gags[1]:gags[2]);
            if(top.d>=19.5)tioDice=tioDice+'|('+nombreDe(top.p)+')';}
          else tioDice='¡Nadie lanzó, chamos!';
        }
      }
      if(!v3&&lv>=3&&st.fase===0&&!st.pat&&st.ft>=KICK[st.r]-AVISO&&st.ft<KICK[st.r]&&Math.floor(at*6)!==Math.floor((at-dt)*6))SND(300,.05,'square',.04);
      var kk;for(kk=pops.length-1;kk>=0;kk--){pops[kk].t+=dt;if(pops[kk].t>pops[kk].life)pops.splice(kk,1);}
      for(kk=sparks.length-1;kk>=0;kk--){sparks[kk].t+=dt;if(sparks[kk].t>0.35)sparks.splice(kk,1);}
      if(banner){banner.t+=dt;if(banner.t>banner.life)banner=null;}
      shake=Math.max(0,shake-dt*30);
    }

    /* ───────────────────────── CPU ───────────────────────── */
    function gauss(rr){var u1=Math.max(1e-6,rr.next()),u2=rr.next();return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);}
    function lider(p2){var best=-1,j;for(j=0;j<n;j++){if(j===p2)continue;if(st.u[j]>0&&(best<0||st.u[j]>st.u[best]))best=j;}return best;}
    /* ángulo y fuerza para que una bola SOLA pare a `extra` px del punto (negativo = antes), con el viento estimado */
    function apunta(x0,y0,tx,ty,extra,wx){
      var dx=tx-x0,dy=ty-y0,d=Math.max(1,Math.sqrt(dx*dx+dy*dy));
      var gx=tx+dx/d*extra,gy=ty+dy/d*extra,dG=Math.sqrt((gx-x0)*(gx-x0)+(gy-y0)*(gy-y0));
      var ang=Math.atan2(gx-x0,y0-gy)*180/Math.PI;
      var A2=1/(2*FR),v=(-0.5+Math.sqrt(0.25+4*A2*dG))/(2*A2),f=clamp((v-VMIN)/(VMAX-VMIN),0,1);
      for(var it=0;it<6;it++){
        var s2=simula(x0,y0,ang,f,wx);
        ang=clamp(ang+(Math.atan2(gx-x0,y0-gy)-Math.atan2(s2.x-x0,y0-s2.y))*180/Math.PI,-ANGMAX,ANGMAX);
        var dS=Math.sqrt((s2.x-x0)*(s2.x-x0)+(s2.y-y0)*(s2.y-y0));
        if(dS>1){v=vSalida(f)*Math.sqrt(dG/dS);f=clamp((v-VMIN)/(VMAX-VMIN),0,1);}
      }
      return {a:ang,f:f};
    }
    /* la CPU «se imagina» el tiro con TODAS las bolas de la cancha: cuántos puntos sacaría (4/2/1/0) y a qué distancia queda su mejor bola */
    function evalua(p2,a,f,wx){
      var L=[],j,o,ra=a*Math.PI/180,v=vSalida(f),k,quieto;
      for(j=0;j<NBALL;j++){var b=st.b[j];if(b.act)L.push({x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:RB,ms:MB,own:Math.floor(j/NR)});}
      var M={x:st.m.x,y:st.m.y,vx:st.m.vx,vy:st.m.vy,r:RM,ms:MM,fr:FRM,own:-1};L.push(M);
      L.push({x:XS[p2],y:YB,vx:Math.sin(ra)*v,vy:-Math.cos(ra)*v,r:RB,ms:MB,own:p2});
      for(k=0;k<150;k++){
        for(j=0;j<L.length;j++)mueve(L[j],wx);
        choques(L,null);
        quieto=true;for(j=0;j<L.length;j++)if(L[j].vx!==0||L[j].vy!==0){quieto=false;break;}
        if(quieto)break;
      }
      var best=[],q;for(q=0;q<n;q++)best.push(-1);
      for(j=0;j<L.length;j++){o=L[j];if(o.own<0)continue;var dd=Math.sqrt((o.x-M.x)*(o.x-M.x)+(o.y-M.y)*(o.y-M.y));if(best[o.own]<0||dd<best[o.own])best[o.own]=dd;}
      var rk=0;for(q=0;q<n;q++)if(q!==p2&&best[q]>=0&&best[q]<best[p2]-0.001)rk++;
      return {pts:PTS[rk]||0,d:best[p2],best:best};
    }
    var CANDS=[[0,1],[0,0.97],[0,1.04],[3,1],[-3,1],[6,1],[-6,1],[0,1.1],[10,1],[-10,1],[6,1.05],[-6,1.05],[15,1],[-15,1]];
    function planea(p2,sk,rr){
      var x0=XS[p2],wx=(WX[st.r]||0)*(0.35+0.65*sk),i2;
      var base=apunta(x0,YB,st.m.x,st.m.y,-(RB+RM+3),wx);
      var nC=Math.min(CANDS.length,Math.round(1+sk*13)),best=null,bs=-1e9,obj=-1;
      for(i2=0;i2<nC;i2++){
        var a=clamp(base.a+CANDS[i2][0],-ANGMAX,ANGMAX),v=vSalida(base.f)*CANDS[i2][1],f=clamp((v-VMIN)/(VMAX-VMIN),0,1);
        var e=evalua(p2,a,f,wx),sc=e.pts*100-e.d;
        if(sc>bs){bs=sc;best={a:a,f:f};}
      }
      if(lv>=3){                                   /* Nv3: probar a sacar la bola del líder */
        var ld=lider(p2),bi=ld>=0?mejor(ld):-1;
        if(bi>=0&&dist(st.b[bi])<90){
          var kq=apunta(x0,YB,st.b[bi].x,st.b[bi].y,70,wx),ek=evalua(p2,kq.a,kq.f,wx),antes=dist(st.b[bi]);
          var sk2=ek.pts*100-ek.d+Math.min(60,(ek.best[ld]-antes))*1.5;
          if(sk2>bs){bs=sk2;best=kq;obj=bi;}
        }
      }
      var ang=clamp(best.a+gauss(rr)*(1-sk)*12,-ANGMAX,ANGMAX);
      var fz=clamp(best.f+gauss(rr)*(1-sk)*0.05,0.02,0.98);
      return {a:ang,f:fz,mx:st.m.x,my:st.m.y,obj:obj,ox:obj>=0?st.b[obj].x:0,oy:obj>=0?st.b[obj].y:0,firma:firma()};
    }
    function firma(){var h=0,j;for(j=0;j<NBALL;j++){var b=st.b[j];if(b.act)h+=Math.round(b.x)*(j+3)+Math.round(b.y)*(j+7);}return h+Math.round(st.m.x)*13+Math.round(st.m.y)*17;}
    function todoQuieto(){var j;for(j=0;j<NBALL;j++){var b=st.b[j];if(b.act&&(b.vx!==0||b.vy!==0))return false;}return st.m.vx===0&&st.m.vy===0;}
    function ai(p2,dt,api){
      var S=cp[p2];if(!S)return;
      var th=TH[p2],sk=(c.skill&&typeof c.skill[p2]==='number')?c.skill[p2]:0.6;
      if(st.fase!==0||lanzo(p2)||(p2===c.yo&&!c.juez()&&env&&env.r===st.r)){api.hold('a',false);api.eje(0,0);S.est=0;return;}
      var t=st.ft/TK,aimS=AIMT/TK;
      if(S.r!==st.r){S.r=st.r;S.plan=null;S.est=0;S.tt=Math.min(aimS-2.2,0.8+S.rr.next()*3.0);}
      /* Nv3: esperar a que el carajito patee y el mingo pare */
      var esperaPatada=lv>=3&&!st.pat&&st.ft<KICK[st.r]&&t<aimS-1.6;
      var quieto=todoQuieto(),tarde=t>=aimS-2.0;
      if(S.est===0&&(quieto||(tarde&&!S.plan))){
        if(!S.plan||S.plan.firma!==firma())S.plan=planea(p2,sk,S.rr);
      }
      if(!S.plan){api.eje(0,0);api.hold('a',false);return;}
      var dA=S.plan.a-th.ang;
      api.eje(clamp(dA/6,-1,1),0);
      if(S.est===0){
        if(((t>=S.tt&&!esperaPatada&&quieto)||tarde)&&Math.abs(dA)<0.8){api.hold('a',true);S.est=1;}
        else api.hold('a',false);
      }else if(S.est===1){
        if(th.carg){
          var rate=2/PERIODO;
          if(Math.abs(medidor(th.m)-S.plan.f)<=rate*dt*0.55+1e-9){api.hold('a',false);S.est=2;return;}
        }
        api.hold('a',true);
      }else api.hold('a',false);
    }

    /* ───────────────────────── dibujo ───────────────────────── */
    function drawBall(x,y,col,rad,spin,glow){
      ell(x+2,y+rad*.7,rad*1.05,rad*.45,'rgba(0,0,0,.28)',0);
      if(glow){ctx.save();ctx.globalAlpha=.35+.2*Math.sin(at*10);ell(x,y,rad+6,rad+6,'#fff59a',0);ctx.restore();}
      ell(x,y,rad,rad,col,2.5);
      var sx=Math.cos(spin)*rad*.62,sy=Math.sin(spin)*rad*.62;
      line([[x-sx,y-sy],[x+sx,y+sy]],2,'rgba(0,0,0,.25)');
      ell(x-rad*.35,y-rad*.4,rad*.3,rad*.22,'rgba(255,255,255,.7)',0);
    }
    function drawMingo(x,y){
      ell(x+1.5,y+4,RM+1,3,'rgba(0,0,0,.3)',0);
      ctx.save();ctx.globalAlpha=.25+.15*Math.sin(at*4);ell(x,y,RM+5,RM+5,'#ffffff',0);ctx.restore();
      ell(x,y,RM,RM,'#fdfbf2',2);ell(x-2,y-2,2,1.6,'#ffffff',0);
    }
    function drawFondo(f){
      var W2=f.x1-f.x0;
      rr(f.x0,0,W2,600,0,pal.cielo,0);
      rr(f.x0,40,W2,60,0,pal.cielo2,0);
      if(pal.noche){for(var s=0;s<16;s++){var sx=f.x0+((s*137)%Math.max(1,W2|0)),sy=12+((s*53)%70);ell(sx,sy,1.6,1.6,'#fffbe0',0);}ell(f.x1-90,40,18,18,pal.sol,2);}
      else ell(f.x1-110,48,26,26,pal.sol,2);
      poly([[f.x0,100],[f.x0+120,62],[f.x0+260,92],[f.x0+380,58],[f.x0+520,94],[f.x0+660,66],[f.x1,96],[f.x1,108],[f.x0,108]],pal.cerro,0);
      rr(f.x0,98,W2,502,0,pal.pasto,0);
      /* palmas de moriche a los lados */
      var lados=[f.x0+60,f.x1-60],k;
      for(k=0;k<2;k++){var px=lados[k];line([[px,300],[px+(k?-6:6),150]],8,'#6b4a2a');
        for(var h=0;h<6;h++){var an=-Math.PI*.95+h*Math.PI*.38;line([[px+(k?-6:6),150],[px+(k?-6:6)+Math.cos(an)*46,150+Math.sin(an)*26]],6,pal.cerro2);}}
      for(k=0;k<14;k++){var gx=f.x0+((k*97)%Math.max(1,W2|0)),gy=470+((k*41)%110);line([[gx,gy],[gx-3,gy-9]],2,pal.pasto2);line([[gx,gy],[gx+3,gy-8]],2,pal.pasto2);}
    }
    function drawCancha(){
      rr(AX0-12,AY0-12,AX1-AX0+24,AY1-AY0+24,6,pal.tablaD,3);
      rr(AX0-8,AY0-8,AX1-AX0+16,AY1-AY0+16,4,pal.tabla,0);
      rr(AX0,AY0,AX1-AX0,AY1-AY0,2,pal.tierra,0);
      for(var i2=0;i2<dots.length;i2++){var d=dots[i2];ell(d.x,d.y,d.s,d.s*.6,pal.tierra2,0);}
      line([[AX0+4,LINEA],[AX1-4,LINEA]],3,pal.raya);
      txt('RAYA',AX0+28,LINEA+14,10,pal.raya,0,true);
      if(lv>=3){ctx.save();ctx.globalAlpha=.10+.04*Math.sin(at*2.3);ell(CX,AY0+130,230,150,'#fff3b0',0);ctx.restore();
        line([[CX,0],[CX,52]],2,'#2a2a2a');ell(CX,60,9,11,'#fff3b0',2);}
    }
    function drawViento(){
      var w=WX[st.r]||0;if(!w)return;
      var dir=w>0?1:-1,len=18+Math.abs(w)*900,px=dir>0?AX1-26-len:AX1-24,py=AY0+22,fl=Math.sin(at*12)*3;
      line([[px,py+44],[px,py-6]],3,'#5a3a20');
      poly([[px,py-6],[px+dir*len,py+2+fl],[px,py+12]],'#e8433a',2);
      txt('VIENTO',px+dir*len*.5,py-14,11,'#ffffff',0,false);
      txt(dir>0?'→'+(Math.abs(w)>0.022?'→':''):(Math.abs(w)>0.022?'←':'')+'←',px+dir*len*.5,py+26,14,'#ffffff',0,false);
    }
    function drawCarajito(){
      if(lv<3||st.fase!==0)return;
      var k0=KICK[st.r];
      if(st.pat||st.ft<k0-AVISO)return;
      var u=clamp((st.ft-(k0-AVISO))/AVISO,0,1),sx=AX0-40,x=sx+(st.m.x-14-sx)*u,y=st.m.y+(1-u)*10;
      ell(x,y+14,10,4,'rgba(0,0,0,.3)',0);
      rr(x-7,y-10,14,20,5,'#3a7bd5',2);ell(x,y-18,8,8,'#c98b5a',2);
      line([[x-3,y+10],[x-6+Math.sin(at*30)*4,y+20]],3,'#2b2b33');line([[x+3,y+10],[x+6-Math.sin(at*30)*4,y+20]],3,'#2b2b33');
      txt('¡EPA, EL CARAJITO!',CX,AY0+24,18,'#ffd0dc',0,false);
    }
    /* campo visible: en el navegador c.campo() devuelve 0..800 (gameLeft/gameRight son const del motor, no cuelgan de window); se leen directo (vertical ~340, apaisado ~1300).
       La cancha lógica es la misma en todas las pantallas; en vertical se dibuja encogida (k<1) alrededor de (CX, PIVY) para que quepan las tablas y los lanzadores. */
    var PIVY=100;
    function vis(){var f=c.campo();if(typeof gameLeft==='function'&&typeof gameRight==='function')f={x0:gameLeft(),x1:gameRight(),y0:f.y0,y1:f.y1};return f;}
    function geom(){var f=vis(),w=f.x1-f.x0,k=Math.min(1,Math.max(0.5,(w-8)/(AX1-AX0+40)));return {f:f,k:k,x0:CX+(f.x0-CX)/k,x1:CX+(f.x1-CX)/k};}
    function drawTio(G){
      var angosto=G.x0>AX0-100,x=angosto?AX0+30:AX0-62,y=angosto?PY-6:AY1-150;
      var hay=false;
      try{var tio=BUS.AP.CAST.tio;if(tio&&typeof bust==='function'){bust(Object.assign({},tio,{x:x,y:y,s:.42,mood:st.fase===2?'happy':'calm',talk:tioDice?Math.abs(Math.sin(at*14)):0}));hay=true;}}catch(e){hay=false;}
      if(!hay){ell(x,y+30,22,30,'#e07b39',3);ell(x,y-8,16,16,'#e8b48a',3);rr(x-18,y-28,36,8,3,'#3a2a1a',0);}
      txt('EL TÍO',x,y+68,11,'#ffffff',0,false);
      if(tioDice){
        var ls=tioDice.split('|'),size=14,w=0,i2;
        for(i2=0;i2<ls.length;i2++)w=Math.max(w,ls[i2].length*size*.56);
        w+=22;var h=ls.length*(size+4)+12,bx=clamp(x+40+w/2,G.x0+w/2+4,G.x1-w/2-4),by=angosto?AY1-40:y-70;
        rr(bx-w/2,by-h/2,w,h,9,'#ffffff',3);poly([[bx-w/2+14,by+h/2-2],[bx-w/2+26,by+h/2-2],[x+12,y-40]],'#ffffff',0);
        for(i2=0;i2<ls.length;i2++)txt(ls[i2],bx,by-h/2+12+i2*(size+4),size,'#1b1630',0,true);
      }
    }
    function drawLanzador(p2){
      var x=XS[p2],col=colorDe(p2),seat=c.seats[p2]||{},sw=at-swing[p2],arm=sw<0.4?Math.sin(sw/0.4*Math.PI):0;
      ell(x,PY+14,26,9,'rgba(0,0,0,.28)',0);
      ell(x,PY+10,24,10,col,3);
      var drawn=false;
      try{if(c.util&&c.util.pj){c.util.pj(seat.ch,x,PY-24-arm*6,62,1);drawn=true;}}catch(e){drawn=false;}
      if(!drawn){ell(x,PY-10,18,24,col,3);ell(x,PY-38,13,13,'#f3c9a0',3);}
      /* bolas que le quedan en la mano */
      var quedan=0;for(var j=0;j<NRE;j++)if(!lanzoR(p2,j))quedan++;
      for(j=0;j<quedan;j++)ell(x-22+j*11,PY+30,5,5,col,1.5);
      txt(String(st.u[p2]),x+30,PY+30,15,'#ffffff',0,false);
      if(p2===c.yo)poly([[x-8,PY-78],[x+8,PY-78],[x,PY-68]],'#ffffff',2.5);
      if(st.fase===0&&!lanzo(p2)){
        if(p2===c.yo)return;
        txt(Math.floor(at*3)%3===0?'·':(Math.floor(at*3)%3===1?'··':'···'),x,PY-88,18,'#ffffff',0,false);
      }else if(st.fase===0&&lanzo(p2))txt('✓',x,PY-88,18,col,0,false);
    }
    function drawPunteria(){
      var yo=c.yo;if(yo<0||yo>=n||st.fase!==0||lanzo(yo)||(env&&env.r===st.r&&!c.juez()))return;
      var th=TH[yo],x=XS[yo],ra=th.ang*Math.PI/180,dx=Math.sin(ra),dy=-Math.cos(ra),col=colorDe(yo);
      for(var k=1;k<=6;k++){var L2=14+k*13;ell(x+dx*L2,YB+dy*L2,2.6,2.6,'#ffffff',0);}
      var tx=x+dx*104,ty=YB+dy*104;
      poly([[tx+dx*12,ty+dy*12],[tx-dy*7,ty+dx*7],[tx+dy*7,ty-dx*7]],'#ffffff',2);
      drawBall(x,YB,col,RB,0,th.carg);
      /* medidor de fuerza */
      var mx=x+(th.ang>=0?-46:46),my=YB+6,H2=96,f=th.carg?medidor(th.m):0,seg=12,sh=th.carg?Math.sin(at*40)*(f*2.2):0;
      rr(mx-9+sh,my-H2-6,18,H2+12,6,'#1b1630',2.5);
      for(var s=0;s<seg;s++){
        var on=(s+0.5)/seg<=f,cc=s<5?'#5ad15a':(s<9?'#ffd23f':'#ff4d3d');
        rr(mx-5+sh,my-(s+1)*(H2/seg)+1,10,H2/seg-2,2,on?cc:'#3a3450',0);
      }
      if(th.carg){
        var yy=my-f*H2;poly([[mx+12+sh,yy],[mx+22+sh,yy-6],[mx+22+sh,yy+6]],'#ffffff',1.5);
        if(f>0.85){ctx.save();ctx.globalAlpha=.3+.2*Math.sin(at*30);ell(mx+sh,my-H2*.85,16,26,'#ff4d3d',0);ctx.restore();}
        txt(f<0.35?'suavecito':(f<0.7?'¡ASÍ!':'¡CON TODO!'),mx+sh,my-H2-18,12,'#ffffff',0,false);
      }else txt('MANTÉN A',mx,my-H2-16,10,'#ffffff',0,false);
    }
    function drawMedicion(){
      if(!med||st.fase!==2)return;
      var N=med.length,k;
      for(k=0;k<N;k++){
        var mk=med[k];if(mk.bi<0)continue;
        var tk=0.25+k*0.32,u=clamp((medT-tk+0.3)/0.3,0,1);if(u<=0)continue;
        var b=st.b[mk.bi],ex=st.m.x+(b.x-st.m.x)*u,ey=st.m.y+(b.y-st.m.y)*u;
        line([[st.m.x,st.m.y],[ex,ey]],3.5,'#ffd23f');
        var dd=Math.max(1,mk.d),steps=Math.floor(dd*u/14);
        for(var s=1;s<=steps;s++){var q=s*14/dd;ell(st.m.x+(b.x-st.m.x)*q,st.m.y+(b.y-st.m.y)*q,1.6,1.6,'#7a4a10',0);}
        if(u>=1&&k>=N-2){var ddx=b.x-st.m.x,ddy=b.y-st.m.y,dl=Math.max(1,Math.sqrt(ddx*ddx+ddy*ddy)),px=-ddy/dl,py=ddx/dl;if(py>0){px=-px;py=-py;}
          txt(Math.round(mk.d*2)+' cm',(st.m.x+b.x)/2+px*16,(st.m.y+b.y)/2+py*16,11,'#ffffff',0,false);}
      }
      ctx.save();ctx.globalAlpha=.55+.35*Math.sin(at*9);ell(st.m.x,st.m.y,RM+5,RM+5,'#ffffff',2);ctx.restore();
      ell(st.m.x,st.m.y,RM,RM,'#fdfbf2',2);
      txt('¡A MEDIR!',CX,AY0+22,22,'#ffffff',0,false);
    }
    function drawTimer(){
      if(st.fase!==0)return;
      var left=Math.max(0,AIMT-st.ft)/TK,u=left/(AIMT/TK),w=AX1-AX0-120;
      rr(CX-w/2,AY0-30,w,10,5,'#1b1630',2);
      rr(CX-w/2+2,AY0-28,Math.max(0,(w-4)*u),6,3,left<2?'#ff4d3d':'#ffffff',0);
      if(left<3&&left>0)txt(String(Math.ceil(left)),CX,AY0+40,34,'#ff6b5a',0,false);
    }
    /* 2D de respaldo (sin WebGL o ?plano=1): el dibujo de siempre */
    function dibujar2D(){
      var G=geom(),i2;
      ctx.save();
      if(shake>0)ctx.translate(Math.sin(at*93)*shake*.6,Math.cos(at*71)*shake*.4);
      drawFondo(G.f);
      if(G.k<1){ctx.translate(CX,PIVY);ctx.scale(G.k,G.k);ctx.translate(-CX,-PIVY);}
      drawCancha();
      drawViento();
      txt('TIRO '+(Math.min(st.r,NRE-1)+1)+'/'+NRE,AX0+40,AY0+14,13,'#ffffff',0,false);
      drawTimer();
      /* bolas por profundidad (y) con el mingo */
      var L=[];for(i2=0;i2<NBALL;i2++)if(st.b[i2].act)L.push(i2);
      L.sort(function(a,b){return st.b[a].y-st.b[b].y||a-b;});
      var lead=-1;if(st.fase===2&&med){for(i2=0;i2<med.length;i2++)if(med[i2].pts===4&&medT>0.25+med.length*0.32)lead=med[i2].bi;}
      var mDib=false;
      for(i2=0;i2<L.length;i2++){
        var b=st.b[L[i2]];
        if(!mDib&&st.m.y<b.y){drawMingo(st.m.x,st.m.y);mDib=true;}
        drawBall(b.x,b.y,colorDe(Math.floor(L[i2]/NR)),RB,(b.x+b.y*1.3)/RB,L[i2]===lead);
      }
      if(!mDib)drawMingo(st.m.x,st.m.y);
      drawMedicion();
      for(i2=0;i2<sparks.length;i2++){var sp=sparks[i2],k2=sp.t/0.35;
        for(var r2=0;r2<6;r2++){var an=r2*1.047+sp.f;line([[sp.x+Math.cos(an)*(6+k2*10),sp.y+Math.sin(an)*(6+k2*10)],[sp.x+Math.cos(an)*(10+k2*18),sp.y+Math.sin(an)*(10+k2*18)]],2.5,'#fff6c9');}}
      drawCarajito();
      for(i2=0;i2<n;i2++)drawLanzador(i2);
      drawPunteria();
      drawTio(G);
      for(i2=0;i2<pops.length;i2++){var po=pops[i2],al=Math.min(1,(po.life-po.t)*3);ctx.save();ctx.globalAlpha=Math.max(0,al);txt(po.s,po.x,po.y-po.t*18,po.size,po.col,0,false);ctx.restore();}
      if(banner){var kb=Math.min(1,banner.t*5);ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,(banner.life-banner.t)*3));txt(banner.s,CX,260-(1-kb)*30,30*kb+4,banner.col,0,false);ctx.restore();}
      if(c.practica&&st.r===0&&st.fase===0)txt('← → apunta · MANTÉN A y suelta',CX,AY1-14,14,'#ffffff',0,false);
      if(c.juez()===false&&env&&env.r===st.r&&!lanzo(c.yo)&&st.fase<2&&at-lanceT<1.2)txt('¡ZAS!',XS[c.yo],YB-30,22,'#ffffff',0,false);
      ctx.restore();
    }

    /* ───────────────────────── 3D low poly (fiesta-3d.js): la cancha de bolas criollas en el llano ─────────────────────────
       Solo dibujo: lee st, TH, med y los cambios que update() ya detecta; no toca la simulación ni la red. Sin WebGL o con ?plano=1 queda dibujar2D() de siempre.
       Cancha de tierra con sus tablas, la raya, bolas que ruedan de verdad (giran según cuánto avanzan) y levantan polvo, el mingo, el tío que va a medir con su
       cabuya, la barra con la cava de las frías bajo el toldo, el caney con su chinchorro, garzas, y de noche el bombillo colgado y las luciérnagas. */
    var V3=window.FIESTA&&FIESTA.V3, v3=null, v3T=0;
    var ES=1/22, CZ0=290, RB3=RB*ES, RM3=RM*ES, TB3=.36, TH3=.7;      /* px de la cancha -> metros; grosor y alto de las tablas */
    function X3(x){return (x-CX)*ES;}
    function Z3(y){return (y-CZ0)*ES;}
    var PAL3={
      1:{cielo:['#5ab8ff','#d8f2ff'],hemi:[0xffffff,0x8a7a5a,.55],sol:[0xfff2d8,.72],niebla:'#d8f2ff',pasto:'#8cc063',pasto2:'#74a94f',tierra:'#d7a86e',tierra2:'#c4925a',tabla:'#8a5a32',noche:0},
      2:{cielo:['#ff8a5a','#ffd9a0'],hemi:[0xffd0a0,0x7a5a6a,.5],sol:[0xffb070,.8],niebla:'#ffcf9a',pasto:'#b39a52',pasto2:'#9a8040',tierra:'#d39a62',tierra2:'#bd844e',tabla:'#7a4a2a',noche:0},
      3:{cielo:['#141238','#3a2f6a'],hemi:[0x8a8aff,0x3a2a4a,.45],sol:[0x9aa8ff,.3],niebla:'#2a2550',pasto:'#3a5640',pasto2:'#2e4634',tierra:'#b09078',tierra2:'#98785f',tabla:'#5a3a26',noche:1}
    };
    var POLVO=['#e8c79a','#c9a06e','#d7b080'], CONF3=['#ff5c8a','#ffd23f','#3fd0a0','#3fa9ff','#ff8a3f'];
    function asiento(p2){return (c.seats&&c.seats[p2])||{name:'P'+(p2+1),ch:null};}
    /* reparte personajes que no estén ya en la cancha (si no alcanzan, se repiten) */
    function elegir(usados,lista,k){
      var out=[],j;
      for(j=0;j<lista.length&&out.length<k;j++)if(usados.indexOf(lista[j])<0){out.push(lista[j]);usados.push(lista[j]);}
      for(j=0;out.length<k;j++)out.push(lista[j%lista.length]);
      return out;
    }
    function montar3D(){
      var T=THREE,pl=PAL3[lv],k,j;
      var esc=V3.escena({fondo:V3.cielo(pl.cielo[0],pl.cielo[1]),niebla:[pl.niebla,70,170],fov:32});
      if(!esc)return null;
      /* joropo llanero (pajarillo): i–iv–V–i en La menor, rápido y con el arpa corriendo */
      V3.pista('bolas',{bpm:168,acordes:[[57,60,64],[50,53,57],[52,56,59],[57,60,64]],
        mel:[76,0,74,72,0,71,69,0,72,0,74,76,0,77,76,0,74,0,72,71,0,69,68,0,71,0,74,0,76,0,0,0]});
      esc.luces.hemi.color.set(pl.hemi[0]);esc.luces.hemi.groundColor.set(pl.hemi[1]);esc.luces.hemi.intensity=pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]);esc.luces.sol.intensity=pl.sol[1];
      if(lv===2)esc.luces.sol.position.set(-26,12,6);
      var S3=esc.scene,M=V3.malla,tn=V3.toon,grad=V3.toon('#fff').gradientMap;
      /* el llano */
      var texP=V3.texturaCanvas(128,128,function(x,w,h){
        x.fillStyle=pl.pasto;x.fillRect(0,0,w,h);
        var s=7,q;for(q=0;q<110;q++){s=(s*1103+12345)%65536;var px=s%w;s=(s*1103+12345)%65536;x.fillStyle=pl.pasto2;x.fillRect(px,s%h,2,5);}
      },[34,24]);
      var llano=new T.Mesh(new T.PlaneGeometry(200,140),new T.MeshToonMaterial({map:texP,gradientMap:grad}));
      llano.rotation.x=-Math.PI/2;llano.receiveShadow=true;S3.add(llano);
      /* la cancha de tierra (con las mismas manchitas del 2D), la raya y las tablas */
      var cw=(AX1-AX0)*ES,cd=(AY1-AY0)*ES,ccz=Z3((AY0+AY1)/2);
      var texT=V3.texturaCanvas(512,360,function(x,w,h){
        x.fillStyle=pl.tierra;x.fillRect(0,0,w,h);x.fillStyle=pl.tierra2;
        for(var q=0;q<dots.length;q++){var d=dots[q];x.fillRect((d.x-AX0)/(AX1-AX0)*w,(d.y-AY0)/(AY1-AY0)*h,d.s*2.4,d.s*1.6);}
        x.fillStyle=V3.oscurecer(pl.tierra,1.06);for(q=0;q<9;q++)x.fillRect(0,q*40+12,w,3);
      });
      var tierra=new T.Mesh(new T.PlaneGeometry(cw,cd),new T.MeshToonMaterial({map:texT,gradientMap:grad}));
      tierra.rotation.x=-Math.PI/2;tierra.position.set(0,.02,ccz);tierra.receiveShadow=true;S3.add(tierra);
      var raya=new T.Mesh(new T.PlaneGeometry(cw-.3,.14),tn('#fff8e6'));raya.rotation.x=-Math.PI/2;raya.position.set(0,.035,Z3(LINEA));S3.add(raya);
      function tabla(x,z,w,d){var m=M(new T.BoxGeometry(w,TH3,d),pl.tabla,{recibe:true,g:.03});m.position.set(x,TH3/2,z);S3.add(m);}
      tabla(0,Z3(AY0)-TB3/2,cw+TB3*2,TB3);tabla(0,Z3(AY1)+TB3/2,cw+TB3*2,TB3);
      tabla(X3(AX0)-TB3/2,ccz,TB3,cd);tabla(X3(AX1)+TB3/2,ccz,TB3,cd);
      for(k=0;k<4;k++){var es=M(new T.BoxGeometry(.24,1.05,.24),V3.oscurecer(pl.tabla,.7),{g:.04});es.position.set((k%2?1:-1)*(cw/2+TB3),.52,k<2?Z3(AY0)-TB3:Z3(AY1)+TB3);S3.add(es);}
      /* la cerca de alambre al fondo */
      for(k=0;k<17;k++){var po=M(new T.CylinderGeometry(.08,.1,1.4,5),'#6b4a2a',{g:.05});po.position.set(-24+k*3,.7,-14.5);S3.add(po);}
      for(k=0;k<2;k++){var al=new T.Mesh(new T.BoxGeometry(48,.03,.03),tn('#3a3a44'));al.position.set(0,.6+k*.5,-14.5);S3.add(al);}
      /* palmas de moriche */
      var hojas=[];
      function palma(x,z,h){
        var g3=new T.Group();g3.position.set(x,0,z);S3.add(g3);
        for(var i2=0;i2<6;i2++){var tr=M(new T.CylinderGeometry(.26-i2*.02,.32-i2*.02,h/6,6),i2%2?'#8a6a48':'#75583a',{g:.04});tr.position.set(0,h/12+i2*h/6,0);g3.add(tr);}
        for(var j2=0;j2<9;j2++){var ho=M(new T.ConeGeometry(.55,3.2,4),j2%2?'#4f9a3a':'#3f8a30',{g:.03});ho.geometry.translate(0,1.6,0);ho.position.set(0,h,0);ho.rotation.set(0,j2/9*6.28,0);ho.rotateZ(1.25+(j2%3)*.25);g3.add(ho);hojas.push(ho);}
      }
      palma(-16,-7,8);palma(16,-9,7.6);palma(-17,5,6.8);palma(17,4,7.2);palma(-21,-12,7);
      /* el caney con su chinchorro (se mece solo) */
      var cx0=-15,cz0=-12.2;
      for(k=0;k<4;k++){var pc=M(new T.CylinderGeometry(.1,.12,2.8,6),'#6b4a2a',{g:.05});pc.position.set(cx0+(k%2?2:-2),1.4,cz0+(k<2?1.4:-1.4));S3.add(pc);}
      var techo=M(new T.ConeGeometry(3.6,2,4),'#c9a25a',{g:.02});techo.rotation.y=Math.PI/4;techo.position.set(cx0,3.75,cz0);S3.add(techo);
      var chin=new T.Group();chin.position.set(cx0,1.9,cz0+1.4);S3.add(chin);
      var ptsC=[],q2;for(q2=0;q2<=12;q2++){var uq=q2/12;ptsC.push(new T.Vector3(-2+4*uq,-Math.sin(uq*Math.PI)*.9,0));}
      var red=M(new T.TubeGeometry(new T.CatmullRomCurve3(ptsC),20,.2,5),'#e8433a',{g:.04});red.scale.set(1,1,1.6);chin.add(red);
      /* la barra: toldo a rayas, banco con los mirones y la cava de las frías */
      var zb=Z3(AY0)-2.4;
      var texR=V3.texturaCanvas(64,8,function(x,w,h){for(var q=0;q<8;q++){x.fillStyle=q%2?'#fffdf2':'#e8433a';x.fillRect(q*8,0,8,h);}});
      for(k=0;k<4;k++){var pt2=M(new T.CylinderGeometry(.07,.08,3.1,6),'#5a3a22',{g:.05});pt2.position.set(k%2?3.8:-3.8,1.55,zb+(k<2?1.3:-1.3));S3.add(pt2);}
      var lona=new T.Mesh(new T.BoxGeometry(8.2,.12,3.2),new T.MeshToonMaterial({map:texR,gradientMap:grad}));lona.position.set(0,3.12,zb);lona.castShadow=true;S3.add(lona);
      V3.borde(lona,.02);
      var banco=M(new T.BoxGeometry(6.4,.2,.9),'#c4783a',{recibe:true});banco.position.set(0,.85,zb);S3.add(banco);
      for(k=0;k<2;k++){var pa=M(new T.BoxGeometry(.2,.85,.8),'#5a3a22');pa.position.set(k?2.9:-2.9,.42,zb);S3.add(pa);}
      var cava=M(new T.BoxGeometry(1.3,.8,.8),'#2f7fd0',{recibe:true});cava.position.set(5.3,.4,zb+.3);S3.add(cava);
      var tapa=M(new T.BoxGeometry(1.38,.14,.86),'#fffdf2');tapa.position.set(5.3,.87,zb+.3);S3.add(tapa);
      var latas=['#d0342a','#ffd23f','#c8c8d0','#3fae4a'];
      for(k=0;k<4;k++){var la2=M(new T.CylinderGeometry(.08,.08,.24,8),latas[k],{g:.08});la2.position.set(4.9+k*.27,1.06,zb+.3+(k%2)*.12);S3.add(la2);}
      /* los personajes: lanzadores en la raya, el tío de árbitro, los mirones y (Nv3) el carajito */
      var usados=['tio'],lanz=[],p2;
      for(p2=0;p2<n;p2++){
        var s2=asiento(p2),ch=s2.ch||'tu',pj=V3.PJ.crear(ch,{prop:false,escala:1.35});usados.push(ch);
        var col=colorDe(p2),lx=X3(XS[p2]),lz=Z3(PY);
        pj.g.position.set(lx,0,lz);S3.add(pj.g);
        var aro=new T.Mesh(new T.RingGeometry(.75,.95,20),new T.MeshBasicMaterial({color:col,transparent:true,opacity:.85}));aro.rotation.x=-Math.PI/2;aro.position.set(lx,.04,lz);S3.add(aro);
        var mano=M(new T.SphereGeometry(.16,10,8),col,{g:.08});mano.position.set(0,-.1,.05);pj.mano('der').add(mano);
        var pies=[];
        for(k=0;k<NR;k++){var pb=M(new T.SphereGeometry(.2,10,8),col,{g:.07});pb.position.set(lx+1.05+k*.42,.2,lz+.45);S3.add(pb);pies.push(pb);}
        lanz.push({pj:pj,mano:mano,pies:pies,x:lx,z:lz,lanzT:-9});
      }
      var tio=V3.PJ.crear('tio',{prop:false,escala:1.35}),thx=X3(AX0)-1.7,thz=Z3(300);
      tio.g.position.set(thx,0,thz);S3.add(tio.g);
      var caraj=null;
      if(lv>=3){var cj=elegir(usados,['pana','prima','tu','portu','cobrador'],1)[0],kp=V3.PJ.crear(cj,{prop:false,escala:1.05});S3.add(kp.g);
        caraj={pj:kp,hx:X3(AX0)-2.4,hz:Z3(180),x:X3(AX0)-2.4,z:Z3(180),px:X3(AX0)-2.4,pz:Z3(180),kickT:-9,rumbo:Math.PI/2};}
      var mir=elegir(usados,['abuela','mama','portu','cobrador','prima','pana','tu'],3),mirones=[];
      for(k=0;k<3;k++){var mp=V3.PJ.crear(mir[k],{prop:false,escala:1.25});mp.g.position.set(-2+k*2,.45,zb+.25);S3.add(mp.g);mirones.push(mp);}
      /* bolas (una por lanzamiento de cada jugador): color del jugador con dos franjas oscuras para que se vea rodar */
      var bolas=[];
      for(j=0;j<NBALL;j++){
        var dueno=Math.floor(j/NR);if(dueno>=n){bolas.push(null);continue;}
        var cb=colorDe(dueno),bm=M(new T.SphereGeometry(RB3,16,12),cb,{g:.05});
        var f1=new T.Mesh(new T.TorusGeometry(RB3*.99,.05,4,24),tn(V3.oscurecer(cb,.55)));bm.add(f1);
        var f2=new T.Mesh(new T.TorusGeometry(RB3*.99,.05,4,24),tn(V3.oscurecer(cb,.55)));f2.rotation.y=Math.PI/2;bm.add(f2);
        bm.visible=false;S3.add(bm);
        bolas.push({m:bm,eje:new T.Vector3(),px:0,pz:0,on:false,polvo:0});
      }
      var mm=M(new T.SphereGeometry(RM3,12,9),'#fdfbf2',{g:.08,em:'#fffbe0',emI:.25});
      var pinta=new T.Mesh(new T.SphereGeometry(RM3*.3,6,4),tn('#d0342a'));pinta.position.set(0,RM3*.85,0);mm.add(pinta);S3.add(mm);
      var mAro=new T.Mesh(new T.RingGeometry(RM3+.12,RM3+.26,24),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6,depthWrite:false}));mAro.rotation.x=-Math.PI/2;S3.add(mAro);
      var lider=new T.Mesh(new T.RingGeometry(RB3+.1,RB3+.3,28),new T.MeshBasicMaterial({color:0xfff59a,transparent:true,opacity:.8,depthWrite:false}));lider.rotation.x=-Math.PI/2;lider.visible=false;S3.add(lider);
      /* la cabuya del tío para medir: del mingo a la mejor bola de cada uno */
      var cuerdas=[];
      for(k=0;k<MAXP;k++){var cg=new T.Group(),cc=new T.Mesh(new T.CylinderGeometry(.035,.035,1,5),tn('#ffd23f'));cc.rotation.z=Math.PI/2;cg.add(cc);cg.visible=false;S3.add(cg);cuerdas.push({g:cg,c:cc});}
      /* puntería del jugador local: puntos en la tierra + punta de flecha, y la bola fantasma en la salida */
      var mira=new T.Group(),puntos=[];S3.add(mira);
      for(k=1;k<=6;k++){var dt2=new T.Mesh(new T.CircleGeometry(.12,10),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false}));dt2.rotation.x=-Math.PI/2;dt2.position.set(0,0,-(RB3+.3+k*.62));mira.add(dt2);puntos.push(dt2);}
      var punta=new T.Mesh(new T.ConeGeometry(.3,.6,3),new T.MeshBasicMaterial({color:0xffffff}));punta.rotation.x=-Math.PI/2;punta.position.set(0,.05,-(RB3+4.6));mira.add(punta);
      var fantasma=c.yo>=0&&c.yo<n?new T.Mesh(new T.SphereGeometry(RB3,14,10),V3.toon(colorDe(c.yo),{op:.55})):null;
      if(fantasma){fantasma.visible=false;S3.add(fantasma);}
      var flecha=M(new T.ConeGeometry(.35,.7,4),'#ffd23f',{g:.1});flecha.rotation.x=Math.PI;flecha.visible=false;S3.add(flecha);
      /* la banderita del viento (Nv2-3) en la esquina del fondo */
      var bandera=new T.Group(),bx0=X3(AX1)+1.1,bz0=Z3(AY0)+1.4;
      var asta=M(new T.CylinderGeometry(.05,.06,3.4,6),'#5a3a20',{g:.06});asta.position.set(bx0,1.7,bz0);S3.add(asta);
      var triG=new T.BufferGeometry();triG.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1.3,-.3,0,0,-.6,0],3));triG.computeVertexNormals();
      var trapo=new T.Mesh(triG,new T.MeshToonMaterial({color:'#e8433a',side:T.DoubleSide,gradientMap:grad}));trapo.castShadow=true;bandera.add(trapo);
      bandera.position.set(bx0,3.35,bz0);bandera.visible=false;S3.add(bandera);
      /* garzas que dan vueltas sobre el llano (de día y al atardecer) */
      var aves=[];
      for(k=0;k<(pl.noche?0:2);k++){
        var ag=new T.Group(),cu2=new T.Mesh(new T.SphereGeometry(.22,6,4),tn('#fffdf2'));cu2.scale.set(1,.8,2.4);ag.add(cu2);
        var gw=new T.PlaneGeometry(1.1,.36);gw.translate(.55,0,0);
        var ad=new T.Mesh(gw,new T.MeshBasicMaterial({color:0xfffdf2,side:T.DoubleSide}));ad.rotation.x=-Math.PI/2;var adg=new T.Group();adg.add(ad);ag.add(adg);
        var ai2=new T.Mesh(gw,new T.MeshBasicMaterial({color:0xfffdf2,side:T.DoubleSide}));ai2.rotation.x=-Math.PI/2;var aig=new T.Group();aig.rotation.y=Math.PI;aig.add(ai2);ag.add(aig);
        S3.add(ag);aves.push({g:ag,ad:adg,ai:aig,cx:k?4:-3});
      }
      /* de noche: el bombillo colgado sobre la cancha (se mece) y luz bajo el toldo */
      var foco=null;
      if(pl.noche){
        for(k=0;k<2;k++){var pp=M(new T.CylinderGeometry(.1,.13,7,6),'#3a3a44');pp.position.set(k?cw/2+1.4:-cw/2-1.4,3.5,ccz);S3.add(pp);}
        var cab=new T.Mesh(new T.BoxGeometry(cw+2.8,.03,.03),tn('#14101c'));cab.position.set(0,6.95,ccz);S3.add(cab);
        foco=new T.Group();foco.position.set(0,6.95,ccz);S3.add(foco);
        var hilo=new T.Mesh(new T.BoxGeometry(.03,.9,.03),tn('#14101c'));hilo.position.y=-.45;foco.add(hilo);
        var bom=new T.Mesh(new T.SphereGeometry(.28,10,8),tn('#fff6c0',{em:'#ffd36a',emI:2}));bom.position.y=-1.05;foco.add(bom);
        var luz=new T.PointLight(0xffe0a0,1.5,30,2);luz.position.y=-1.3;foco.add(luz);
        var luz2=new T.PointLight(0xffc870,1,12,2);luz2.position.set(0,2.7,zb);S3.add(luz2);
        var bt=new T.Mesh(new T.SphereGeometry(.16,8,6),tn('#fff6c0',{em:'#ffb030',emI:2}));bt.position.set(0,2.95,zb);S3.add(bt);
      }
      var part=V3.particulas(esc,500);
      esc.encuadrar(32,26,new T.Vector3(0,.6,3.5),.92);   /* lanzadores en el medio-bajo (feet ~y396 en 800x600), fuera de los controles táctiles */
      return V3.ultimo={esc:esc,part:part,lanz:lanz,tio:{pj:tio,hx:thx,hz:thz,x:thx,z:thz},caraj:caraj,mirones:mirones,emoT:-9,bolas:bolas,
        mingo:{m:mm,aro:mAro,eje:new T.Vector3(),px:X3(st.m.x),pz:Z3(st.m.y),polvo:0},lider:lider,cuerdas:cuerdas,mira:mira,puntos:puntos,fantasma:fantasma,flecha:flecha,
        bandera:bandera,trapo:trapo,aves:aves,hojas:hojas,chin:chin,foco:foco,noche:pl.noche,lucT:0,cuenta:-1,avisoR:-1};
    }
    /* una bola (o el mingo) rueda: gira sobre el eje perpendicular al avance lo que avanzó entre su radio, y levanta polvo */
    function rueda(B,x,z,rad,dt){
      var dx=x-B.px,dz=z-B.pz,dd=Math.sqrt(dx*dx+dz*dz);
      if(dd>0.0001&&dd<3){B.eje.set(dz,0,-dx).normalize();B.m.rotateOnWorldAxis(B.eje,dd/rad);}
      B.px=x;B.pz=z;B.m.position.set(x,rad,z);
      if(dd/dt>1.2){B.polvo-=dt;if(B.polvo<0){B.polvo=.06;v3.part.soltar(x,.08,z,1,{k:'gota',cols:POLVO,vel:.7,arriba:.8,g:2.5,vida:.55,esc:rad>.3?0.75:0.45});}}
    }
    function actualizar3D(dt,now){
      var V=v3,t=at,j,p2,k;
      V.part.update(dt);
      /* lo que se mueve solo */
      for(k=0;k<V.hojas.length;k++)V.hojas[k].rotation.x=Math.sin(t*1.3+k)*.07;
      V.chin.rotation.x=Math.sin(t*1.1)*.18;
      for(k=0;k<V.aves.length;k++){var av=V.aves[k],aa=t*.32+k*3.1;
        av.g.position.set(Math.cos(aa)*15+av.cx,8.5+k*1.6+Math.sin(t*.8+k)*.5,Math.sin(aa)*6-13);av.g.rotation.y=-aa;
        av.ad.rotation.z=Math.sin(t*8+k)*.6;av.ai.rotation.z=-Math.sin(t*8+k)*.6;}
      if(V.foco)V.foco.rotation.z=Math.sin(t*1.7)*.1;
      if(V.noche){V.lucT-=dt;if(V.lucT<0){V.lucT=.25;V.part.soltar((c.fx()-.5)*34,.6+c.fx()*2,-13+c.fx()*6,1,{k:'chispa',cols:['#fff59a','#d8ff6a'],vel:.4,arriba:.4,g:-.1,vida:2.2,esc:.5,suelo:false});}}
      var w=WX[st.r]||0;V.bandera.visible=!!w;
      if(w){V.bandera.rotation.y=(w>0?0:Math.PI)+Math.sin(t*7)*.15;V.trapo.scale.set(.7+Math.abs(w)*22,1+Math.sin(t*13)*.07,1);}
      /* bolas y mingo */
      for(j=0;j<NBALL;j++){
        var B=V.bolas[j];if(!B)continue;
        var b=st.b[j],on=!!b.act;B.m.visible=on;
        if(!on){B.on=false;continue;}
        var bx=X3(b.x),bz=Z3(b.y);
        if(!B.on){B.on=true;B.px=bx;B.pz=bz;}
        rueda(B,bx,bz,RB3,dt);
      }
      rueda(V.mingo,X3(st.m.x),Z3(st.m.y),RM3,dt);
      V.mingo.aro.position.set(X3(st.m.x),.05,Z3(st.m.y));V.mingo.aro.scale.setScalar(1+.18*Math.sin(t*4));
      V.mingo.aro.material.opacity=st.fase===2?0.55+.35*Math.sin(t*9):0.35+.2*Math.sin(t*4);
      /* medición: la cabuya del mingo a cada bola, una tras otra; la ganadora con su aro */
      var medN=st.fase===2&&med?med.length:0,rev=medN>0&&medT>=0.25+medN*0.32+0.15,lead=-1;
      for(k=0;k<V.cuerdas.length;k++){
        var cu=V.cuerdas[k],mk2=k<medN?med[k]:null,u=0;
        if(mk2&&mk2.bi>=0)u=clamp((medT-(0.25+k*0.32)+0.3)/0.3,0,1);
        cu.g.visible=u>0;
        if(u>0){var bb=st.b[mk2.bi],mx=X3(st.m.x),mz=Z3(st.m.y),ex=X3(bb.x)-mx,ez=Z3(bb.y)-mz,L=Math.sqrt(ex*ex+ez*ez)*u;
          cu.g.position.set(mx,.1,mz);cu.g.rotation.y=-Math.atan2(ez,ex);cu.c.scale.y=Math.max(.01,L);cu.c.position.x=L/2;}
        if(mk2&&mk2.pts===4&&rev)lead=mk2.bi;
      }
      V.lider.visible=lead>=0;
      if(lead>=0){V.lider.position.set(X3(st.b[lead].x),.05,Z3(st.b[lead].y));V.lider.scale.setScalar(1+.12*Math.sin(t*10));}
      /* lanzadores */
      var fin=st.fase===3,umax=-1,umin=1e9;
      for(p2=0;p2<n;p2++){umax=Math.max(umax,st.u[p2]);umin=Math.min(umin,st.u[p2]);}
      for(p2=0;p2<n;p2++){
        var L3=V.lanz[p2],th=TH[p2],ra=th.ang*Math.PI/180,pj=L3.pj,ya=!!(lanzo(p2)||(p2===c.yo&&!c.juez()&&env&&env.r===st.r));
        if(fin&&now>0){
          if(st.u[p2]===umax&&umax>umin)pj.anim('celebrar').cara('feliz');
          else if(st.u[p2]===umin&&umax>umin)pj.anim('triste').cara('triste');
          else pj.anim('bailar').cara('normal');
        }else if(rev){
          if(st.lp[p2]>=4)pj.anim('celebrar').cara('feliz');
          else if(st.lp[p2]===0)pj.anim('triste').cara('triste');
          else pj.anim('quieto').cara('normal');
        }else if(st.fase===0&&!ya)pj.anim('quieto').cara(th.carg?'concentrado':'normal');
        else pj.anim('quieto').cara(st.fase===1?'concentrado':'normal');
        pj.rumbo(fin||rev?0:Math.atan2(Math.sin(ra),-Math.cos(ra))).update(dt);
        var enMano=st.fase===0&&!ya;
        L3.mano.visible=enMano;
        if(enMano&&th.carg)L3.mano.scale.setScalar(1+.25*medidor(th.m));else L3.mano.scale.setScalar(1);
        var quedan=0;for(k=0;k<NRE;k++)if(!lanzoR(p2,k))quedan++;
        if(enMano)quedan--;
        for(k=0;k<L3.pies.length;k++)L3.pies[k].visible=k<quedan;
      }
      /* puntería del jugador local */
      var yo=c.yo,apunta=!!(yo>=0&&yo<n&&st.fase===0&&!lanzo(yo)&&!(env&&env.r===st.r&&!c.juez()));
      V.mira.visible=apunta;
      if(V.fantasma)V.fantasma.visible=apunta;
      if(apunta){
        V.mira.position.set(X3(XS[yo]),.06,Z3(YB));V.mira.rotation.y=-TH[yo].ang*Math.PI/180;
        for(k=0;k<V.puntos.length;k++)V.puntos[k].scale.setScalar(1+.3*Math.sin(t*8-k*.9));
        if(V.fantasma)V.fantasma.position.set(X3(XS[yo]),RB3,Z3(YB));
      }
      V.flecha.visible=!!(yo>=0&&yo<n);
      if(yo>=0&&yo<n)V.flecha.position.set(V.lanz[yo].x,4.4+Math.abs(Math.sin(t*4))*.3,V.lanz[yo].z);
      /* el tío: en su puesto junto a la cancha; al medir camina hasta el mingo, mide y canta el resultado */
      var ti=V.tio,tx=ti.hx,tz=ti.hz;
      if(st.fase===2){tx=X3(st.m.x)+1.3;tz=Z3(st.m.y)-.9;}
      var dx3=tx-ti.x,dz3=tz-ti.z,d3=Math.sqrt(dx3*dx3+dz3*dz3),lim=7*dt;
      if(d3>lim){ti.x+=dx3/d3*lim;ti.z+=dz3/d3*lim;}else{ti.x=tx;ti.z=tz;}
      if(d3>.05)ti.pj.anim('caminar',{vel:.8}).cara('concentrado').rumbo(Math.atan2(dx3,dz3));
      else if(st.fase===2)ti.pj.anim(rev?'saludar':'quieto').cara(rev?'feliz':'concentrado').rumbo(rev?0:Math.atan2(X3(st.m.x)-ti.x,Z3(st.m.y)-ti.z));
      else if(fin)ti.pj.anim('saludar').cara('feliz').rumbo(0);
      else ti.pj.anim('quieto').cara('normal').rumbo(Math.PI/2);
      ti.pj.update(dt);ti.pj.g.position.set(ti.x,0,ti.z);
      /* Nv3: el carajito espera pícaro, corre al mingo en el aviso, lo patea y se va bailando */
      var K=V.caraj;
      if(K){
        var k0=KICK[st.r],corre=false;
        if(st.fase===0&&!st.pat&&st.ft>=k0-AVISO){
          if(V.avisoR!==st.r){V.avisoR=st.r;V3.sfx('silbido');}
          var uu=clamp((st.ft-(k0-AVISO))/AVISO,0,1);K.x=K.hx+(X3(st.m.x)-.8-K.hx)*uu;K.z=K.hz+(Z3(st.m.y)-K.hz)*uu;corre=true;
        }else{var ddx=K.hx-K.x,ddz=K.hz-K.z,dk=Math.sqrt(ddx*ddx+ddz*ddz),lk=6*dt;if(dk>lk){K.x+=ddx/dk*lk;K.z+=ddz/dk*lk;corre=true;}else{K.x=K.hx;K.z=K.hz;}}
        var kvx=(K.x-K.px)/dt,kvz=(K.z-K.pz)/dt;K.px=K.x;K.pz=K.z;
        if(corre&&kvx*kvx+kvz*kvz>.2)K.rumbo=Math.atan2(kvx,kvz);else if(!corre)K.rumbo=Math.PI/2;
        K.pj.anim(corre?'correr':(t-K.kickT<4?'bailar':'quieto'),{vel:1}).cara('feliz').rumbo(K.rumbo).update(dt);
        K.pj.g.position.set(K.x,0,K.z);
      }
      /* los mirones de la barra */
      var emo=t-V.emoT<1.6;
      for(k=0;k<V.mirones.length;k++)V.mirones[k].anim('sentado').cara(emo?'feliz':(fin?'feliz':'normal')).rumbo(0).update(dt);
      /* la cuenta: tic en los 3 últimos segundos de la ventana */
      if(st.fase===0){var left=Math.ceil(Math.max(0,AIMT-st.ft)/TK);if(left<=3&&left>0&&left!==V.cuenta)V3.sfx('tic');V.cuenta=left;}
    }
    /* efectos de los eventos (los detecta update() comparando el estado) */
    function tiro3D(p2,j){
      if(!v3||!v3.lanz[p2])return;
      var L3=v3.lanz[p2];
      if(at-L3.lanzT>.6){L3.lanzT=at;L3.pj.uno('lanzar');V3.sfx('whoosh');}
      if(j>=0){var b=st.b[j];v3.part.soltar(X3(b.x),.15,Z3(b.y),8,{k:'gota',cols:POLVO,vel:1.6,arriba:1.4,g:4,vida:.6,esc:.9});}
    }
    function clac3D(f){
      if(!v3)return;
      var x=X3(st.choqX),z=Z3(st.choqY);
      V3.sfx(f>=4?'golpe':'tic');if(f>=6)V3.sfx('choque');
      v3.part.soltar(x,RB3,z,4+f,{k:'chispa',cols:['#fff6c9','#ffd23f','#fffdf2'],vel:2+f*.5,arriba:1.5+f*.3,vida:.35});
      v3.part.soltar(x,.1,z,3+f,{k:'gota',cols:POLVO,vel:1.4,arriba:1,g:3,vida:.6,esc:.8});
      if(f>=4)v3.esc.sacudir(Math.min(.9,.15+f*.09));
      if(f>=6){v3.emoT=at;for(var k=0;k<v3.mirones.length;k++)v3.mirones[k].uno('saltar');}
    }
    function patada3D(){
      if(!v3)return;
      var x=X3(st.m.x),z=Z3(st.m.y);
      if(v3.caraj){v3.caraj.kickT=at;v3.caraj.pj.uno('lanzar');}
      V3.sfx('golpe');V3.sfx('whoosh');v3.esc.sacudir(.8);
      v3.part.soltar(x,.15,z,22,{k:'gota',cols:POLVO,vel:3,arriba:2.5,g:5,vida:.8,esc:1.1});
      v3.emoT=at;for(var k=0;k<v3.mirones.length;k++)v3.mirones[k].uno('saltar');
    }
    function fase3D(){
      if(!v3)return;
      if(st.fase===0){V3.sfx('silbato');v3.tio.pj.uno('saltar');}
      else if(st.fase===2)V3.sfx('tambor');
      else if(st.fase===3){
        V3.sfx('aplauso');V3.sfx('ding');v3.emoT=at;
        var umax=-1,p2;for(p2=0;p2<n;p2++)umax=Math.max(umax,st.u[p2]);
        for(p2=0;p2<n;p2++)if(st.u[p2]===umax&&umax>0){var L3=v3.lanz[p2];L3.pj.uno('festejo');v3.part.soltar(L3.x,3.2,L3.z,40,{k:'confeti',cols:CONF3,vel:4,arriba:5,g:5,vida:2});}
        for(p2=0;p2<v3.mirones.length;p2++)v3.mirones[p2].uno('festejo');
      }
    }
    function mide3D(k){if(v3)V3.sfx('tic');}
    function canta3D(top){
      if(!v3)return;
      if(!top){V3.sfx('error');return;}
      V3.sfx('ding');V3.sfx('aplauso');v3.emoT=at;
      var b=st.b[top.bi];v3.part.soltar(X3(b.x),.8,Z3(b.y),30,{k:'confeti',cols:CONF3.concat([colorDe(top.p)]),vel:3.5,arriba:4,g:6,vida:1.4});
      if(v3.lanz[top.p])v3.lanz[top.p].pj.uno('festejo');
      for(var k=0;k<v3.mirones.length;k++)v3.mirones[k].uno('saltar');
    }
    function dibujar3D(f){
      var dt=Math.max(0,Math.min(.05,v3T?at-v3T:1/60)),now=typeof c.ahora==='function'?c.ahora():0,i2,k;v3T=at;
      if(dt>0)actualizar3D(dt,now);
      if(now>=0&&st.fase!==3)V3.musica('bolas');
      v3.esc.render(dt);
      var E=v3.esc,mid=(f.x0+f.x1)/2;
      /* nombres, puntos y quién falta por lanzar */
      for(i2=0;i2<n;i2++){
        var L3=v3.lanz[i2],pt=E.proyectar(L3.x,0,L3.z+1.15),col=colorDe(i2);
        txt(i2===c.yo?'TÚ':String(asiento(i2).name||'').slice(0,7),pt.x,pt.y,12,i2===c.yo?'#ffd23f':'#fffdf2',0,true);
        txt(st.u[i2]+' pts',pt.x,pt.y+15,11,col,0,true);
        if(st.fase===0&&i2!==c.yo){var ph=E.proyectar(L3.x,4.1,L3.z);
          txt(lanzo(i2)?'✓':(Math.floor(at*3)%3===0?'·':(Math.floor(at*3)%3===1?'··':'···')),ph.x,ph.y,18,lanzo(i2)?col:'#ffffff',0,true);}
      }
      /* marcador de arriba (debajo de la barra del motor): tiro y la ventana que se acaba */
      txt('TIRO '+(Math.min(st.r,NRE-1)+1)+'/'+NRE,f.x0+56,88,13,'#ffffff',0,true);
      if(st.fase===0){
        var left=Math.max(0,AIMT-st.ft)/TK,u=left/(AIMT/TK),w=Math.max(120,Math.min(360,(f.x1-f.x0)-200));
        rr(mid-w/2,82,w,10,5,'#1b1630',2);rr(mid-w/2+2,84,Math.max(0,(w-4)*u),6,3,left<2?'#ff4d3d':'#ffffff',0);
        if(left<3&&left>0)txt(String(Math.ceil(left)),mid,122,34,'#ff6b5a',0,true);
      }
      var wv=WX[st.r]||0;
      if(wv){var pw=E.proyectar(X3(AX1)+1.1,3.9,Z3(AY0)+1.4),dir=wv>0?1:-1;
        txt('VIENTO',pw.x,pw.y-14,11,'#ffffff',0,true);
        txt(dir>0?'→'+(Math.abs(wv)>0.022?'→':''):(Math.abs(wv)>0.022?'←':'')+'←',pw.x,pw.y+2,14,'#ffffff',0,true);}
      if(lv>=3&&st.fase===0&&!st.pat&&st.ft>=KICK[st.r]-AVISO)txt('¡EPA, EL CARAJITO!',mid,150,18,'#ffd0dc',0,true);
      /* medición: centímetros de las dos últimas cabuyas */
      if(med&&st.fase===2){
        txt('¡A MEDIR!',mid,150,22,'#ffffff',0,true);
        var N=med.length;
        for(k=Math.max(0,N-2);k<N;k++){var mk3=med[k];if(mk3.bi<0)continue;if(medT<0.25+k*0.32)continue;
          var bk=st.b[mk3.bi],pc=E.proyectar(X3((st.m.x+bk.x)/2),.2,Z3((st.m.y+bk.y)/2)+.5);txt(Math.round(mk3.d*2)+' cm',pc.x,pc.y,11,'#ffffff',0,true);}
      }
      /* el tío canta: globito sobre su cabeza */
      if(tioDice){
        var tp=E.proyectar(v3.tio.x,4.3,v3.tio.z),ls=tioDice.split('|'),size=14,bw=0,i3;
        for(i3=0;i3<ls.length;i3++)bw=Math.max(bw,ls[i3].length*size*.56);
        bw+=22;var bh=ls.length*(size+4)+12,bxx=clamp(tp.x+bw/2-10,f.x0+bw/2+4,f.x1-bw/2-4),byy=Math.max(170,tp.y-bh/2-14);
        rr(bxx-bw/2,byy-bh/2,bw,bh,9,'#ffffff',3);poly([[bxx-bw/2+14,byy+bh/2-2],[bxx-bw/2+26,byy+bh/2-2],[tp.x,tp.y]],'#ffffff',0);
        for(i3=0;i3<ls.length;i3++)txt(ls[i3],bxx,byy-bh/2+12+i3*(size+4),size,'#1b1630',0,true);
      }
      for(i2=0;i2<pops.length;i2++){var po=pops[i2],al=Math.min(1,(po.life-po.t)*3),pp=E.proyectar(X3(po.x),1.2,Z3(po.y));
        ctx.save();ctx.globalAlpha=Math.max(0,al);txt(po.s,pp.x,pp.y-po.t*18,po.size,po.col,0,true);ctx.restore();}
      if(banner){var kb=Math.min(1,banner.t*5);ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,(banner.life-banner.t)*3));txt(banner.s,mid,200-(1-kb)*30,30*kb+4,banner.col,0,true);ctx.restore();}
      if(c.practica&&st.r===0&&st.fase===0)txt('← → apunta · MANTÉN A y suelta',mid,540,14,'#ffffff',0,true);
      /* medidor de fuerza del jugador local, al lado de su personaje */
      var yo=c.yo;
      if(yo>=0&&yo<n&&st.fase===0&&!lanzo(yo)&&!(env&&env.r===st.r&&!c.juez())){
        var th=TH[yo],pm=E.proyectar(v3.lanz[yo].x,1.3,v3.lanz[yo].z),mx=pm.x+(th.ang>=0?-58:58),my=pm.y+34,H2=96,fz=th.carg?medidor(th.m):0,seg=12,sh=th.carg?Math.sin(at*40)*(fz*2.2):0,s3;
        rr(mx-9+sh,my-H2-6,18,H2+12,6,'#1b1630',2.5);
        for(s3=0;s3<seg;s3++){var onS=(s3+0.5)/seg<=fz,cS=s3<5?'#5ad15a':(s3<9?'#ffd23f':'#ff4d3d');rr(mx-5+sh,my-(s3+1)*(H2/seg)+1,10,H2/seg-2,2,onS?cS:'#3a3450',0);}
        if(th.carg){var yy=my-fz*H2;poly([[mx+12+sh,yy],[mx+22+sh,yy-6],[mx+22+sh,yy+6]],'#ffffff',1.5);
          if(fz>0.85){ctx.save();ctx.globalAlpha=.3+.2*Math.sin(at*30);ell(mx+sh,my-H2*.85,16,26,'#ff4d3d',0);ctx.restore();}
          txt(fz<0.35?'suavecito':(fz<0.7?'¡ASÍ!':'¡CON TODO!'),mx+sh,my-H2-18,12,'#ffffff',0,true);}
        else txt('MANTÉN A',mx,my-H2-16,10,'#ffffff',0,true);
      }
      if(c.juez()===false&&env&&env.r===st.r&&!lanzo(c.yo)&&st.fase<2&&at-lanceT<1.2){var pz2=E.proyectar(X3(XS[c.yo]),2,Z3(YB));txt('¡ZAS!',pz2.x,pz2.y,22,'#ffffff',0,true);}
    }
    function draw(){
      if(v3===null&&V3&&V3.listo&&V3.listo())v3=montar3D()||false;
      if(v3)return dibujar3D(vis());
      dibujar2D();
    }

    return {
      update:update, draw:draw, ai:ai,
      scores:function(){
        var a=[],j;for(j=0;j<n;j++)a.push(st.u[j]);
        /* red de seguridad: si se acaba dur antes de medir el último lanzamiento (migraciones muy tardías), cuenta como está la cancha */
        if(st.fase<2&&typeof c.ahora==='function'&&c.ahora()>=c.dur-0.05){var rk=ranking();for(j=0;j<rk.length;j++)a[rk[j].p]+=rk[j].pts;}
        return a;
      },
      step:step, pack:pack, unpack:load, restore:load, lerp:lerp,
      done:function(){return st.fase===3;},
      vivo:function(){return true;},
      alCpu:function(){}, alHum:function(){},
      hudChip:function(p2){return st.fase===0&&lanzo(p2)?'✓':null;},
      destacado:function(){
        var s=this.scores(),m=0,j;for(j=1;j<n;j++)if(s[j]>s[m])m=j;
        return s[m]>0?'le arrimó la bola al mingo: '+s[m]+' puntos':'nadie se arrimó al mingo';
      },
      vista:function(){
        var o={k:st.k,r:st.r,fase:st.fase,ft:st.ft,u:st.u.slice(0,n),lp:st.lp.slice(0,n),pat:st.pat,choqN:st.choqN,m:{x:st.m.x,y:st.m.y,vx:st.m.vx,vy:st.m.vy},
          b:[],NR:NRE,WX:WX.slice(),KICK:KICK.slice(),AIMT:AIMT,ROLLK:ROLLK,MEDK:MEDK,XS:XS.slice(0,n),YB:YB,th:[]},j;
        for(j=0;j<NBALL;j++){var b=st.b[j];o.b.push({x:b.x,y:b.y,vx:b.vx,vy:b.vy,act:b.act});}
        for(j=0;j<n;j++)o.th.push({ang:TH[j].ang,carg:TH[j].carg,m:TH[j].m});
        o.rank=ranking();
        return o;
      }
    };
  }
});
})();
