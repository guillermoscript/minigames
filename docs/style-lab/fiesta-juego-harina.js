'use strict';
/* LA FIESTA · EN VIVO · ¡LA ÚLTIMA HARINA!  (modelo C: el juez simula, los demás interpolan; M2-SPEC §6.4)
   Supermercado en plena cola. Los reponedores ponen harina P.A.N. en los anaqueles de los lados y el camión la tira por el portón.
   Stick + A. La idea: agarra hasta 3 bolsas y cóbralas en la CAJA ABIERTA (la otra está cerrada; a veces cambian).
   - A junto a una bolsa en el piso = la agarras (+2). Cargas hasta 3; cada bolsa te pone más lento.
   - En la caja abierta cobras solo con llegar: 12 por bolsa (30 la DORADA) + combo (2 bolsas +8, 3 bolsas +24).
   - A pegado a uno que carga harina = le ROBAS una (la dorada primero). La víctima queda 1,2 s intocable (contrajuego: empújalo).
   - A sin nada cerca = EMPUJÓN (arranque corto). Si chocas a alguien: lo aturdes y se le cae una bolsa. Recarga 1,2 s.
   - Eventos sembrados (aviso ~0,8 s): carritos que cruzan un pasillo (te tumban y riegas todo), piso mojado (si cargas, resbalas
     y se te cae una), oferta (aparece una bolsa DORADA), cambio de caja, y el camión (2 veces) que tira 3–4 bolsas.
   - Escalada por fracción de dur: calma (<34 %), «¡SE ARMÓ LA COLA!» (reponen más rápido, más eventos), y «¡ÚLTIMOS SEGUNDOS!»
     (≥70 %: dos carritos a la vez, más doradas, la caja paga DOBLE).
   Toda la lógica de reglas vive en step() (solo el juez, a 1/30 s). El calendario (reposiciones y eventos) sale de c.rng en mk() y
   depende solo de k; el estado (pack) son enteros y alcanza para que el juez nuevo siga EXACTO con restore().
   Dibujo: 3D low poly (fiesta-3d.js: el supermercado, doc 15) o, sin WebGL / ?plano=1, el 2D con primitivas del laboratorio. */
(function(){
if(typeof window==='undefined'||!window.FIESTA||!FIESTA.LIVE||FIESTA.LIVE.get('f_harina'))return;

var TK=30, RAD=22, NB=10, MAXP=4, MAXC=3;
var AX0=100, AX1=700, AY0=150, AY1=455;               /* arena lógica (igual en todas las pantallas) */
var CX=400, CY=303;
var CAJAS=[[165,190],[635,190]], CAJA_R=52;            /* las dos cajas (arriba a los lados del portón) */
var PORTON=[400,206];
var SPD=170/TK, SPD_BOLSA=21/TK;                       /* cada bolsa cargada te quita 21 px/s */
var REACH=46, REACH_STEAL=54;
var DASH_T=8, DASH_K=2.4, CD_DASH=36, CD_STEAL=24, INV=36;
var ST_HIT=15, ST_STEAL=8, ST_CART=24, ST_WET=12;
var P_GRAB=2, P_BAG=12, P_GOLD=30, COMBO=[0,0,8,24];
var EV_WARN=24, CART_RUN=[40,32,24], WET_DUR=150, TRUCK_WARN=36, OFERTA_WARN=27;
var LIM_MAX=800, LIM_RATE=25;
var G=1, PS=10, BS=3;                                   /* globales, ints por jugador, ints por bolsa del piso */
var PACKN=G+PS*MAXP+BS*NB;
var DROPS=[[-34,-30],[34,-30],[0,38]];

function q4(v){return Math.round(v*4)/4;}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function dist(ax,ay,bx,by){var dx=ax-bx,dy=ay-by;return Math.sqrt(dx*dx+dy*dy);}

var DISC=[0];
(function(){var i,b,j;
  for(i=0;i<MAXP;i++){b=G+PS*i;for(j=2;j<PS;j++)DISC.push(b+j);}
  for(i=0;i<NB;i++){b=G+PS*MAXP+BS*i;DISC.push(b,b+1,b+2);}
})();
var POSIDX=[];
(function(){var i,b;for(i=0;i<MAXP;i++){b=G+PS*i;POSIDX.push(b,b+1);}})();

var PAL=[
  {wall:'#efe7cc',floor:'#d8cfae',tile:'#c7bd98',shelf:'#a0703f',shelfD:'#7b5330',mark:'#ffffff',lamp:'#fffbe6',sign:'#d63a2f'},
  {wall:'#f0c79a',floor:'#d9a56e',tile:'#c28d58',shelf:'#8e5a33',shelfD:'#6d4122',mark:'#fff1d0',lamp:'#ffd99a',sign:'#c2402a'},
  {wall:'#2c3152',floor:'#3b4270',tile:'#2f3560',shelf:'#4c3d63',shelfD:'#33284a',mark:'#8fb6ff',lamp:'#9fe8ff',sign:'#e04d7e'}
];

FIESTA.LIVE.add('f_harina',{
  name:'¡LA ÚLTIMA HARINA!', modos:['ffa','1v1'], clase:'rank', modelo:'C', dur:30,
  stick:true, botones:1, snapHz:10, migra:true, minHumanos:1,
  limites:{scoreMax:800, scoreRate:25, minT:27, finTemprano:0},
  packN:PACKN, packDiscretos:DISC,
  carta:{
    obj:'Agarra harina y cóbrala en la CAJA ABIERTA',
    gana:'Más puntos: 12 por bolsa (30 la dorada), combo con 2 o 3. Al final la caja paga DOBLE.',
    como:{tactil:'Joystick · A = agarrar / robar / empujón', teclado:'WASD o flechas · ESPACIO'},
    demos:[{id:'mover',txt:'Agarra hasta 3 bolsas con A y llévalas a la CAJA abierta'},{id:'robar',txt:'A pegado a otro = le robas una · A solo = ¡empujón!'}],
    roles:null
  },
  mk:function(c){
    var n=c.n, lv=c.lv||1, durT=Math.max(3,Math.round(c.dur*TK)), pal=PAL[clamp(lv,1,3)-1];
    var rng=c.rng, i, p, t, ph;
    var F1=Math.round(durT*0.34), F2=Math.round(durT*0.70);
    function fase(k){return k<F1?0:(k<F2?1:2);}
    var GS=clamp(durT/900,0.5,1);

    /* ── calendario sembrado (idéntico en todas las pantallas; solo depende de k) ── */
    var rest={};                                               /* k -> bolsa que reponen en un anaquel de los lados */
    t=8;
    while(t<durT-6){
      ph=fase(t);
      var der=rng.int(0,1);
      rest[t]={x:der?652:148,y:rng.int(232,424),kd:rng.int(0,99)<[4,8,16][ph]?2:1};
      t+=[46,32,21][ph]+rng.int(0,12);
    }
    var EV=[];
    var tks=durT>=240?[0.27,0.62]:[0.42];
    for(i=0;i<tks.length;i++)EV.push({t:Math.round(durT*tks[i]),tipo:'camion',w:TRUCK_WARN,d:24,nb:tks[i]>0.5?4:3});
    t=Math.max(45,Math.round(durT*0.10));var lastCaja=-999,lastT='';
    while(t<durT-26){
      ph=fase(t);
      var r=rng.int(0,99),tipo=r<40?'carro':(r<62?'mojado':(r<80?'oferta':'caja'));
      if(tipo==='caja'&&t-lastCaja<210)tipo='carro';
      if(tipo===lastT&&tipo!=='carro')tipo='carro';
      var ev={t:t,tipo:tipo,w:tipo==='oferta'?OFERTA_WARN:EV_WARN,d:1};
      if(tipo==='carro'){
        ev.d=CART_RUN[ph];ev.ly=rng.int(220,410);ev.dir=rng.int(0,1)?1:-1;
        ev.ly2=ph===2?(ev.ly>312?ev.ly-rng.int(110,150):ev.ly+rng.int(110,150)):-1;
      }else if(tipo==='mojado'){ev.d=WET_DUR;ev.x=rng.int(230,570);ev.y=rng.int(245,400);}
      else if(tipo==='oferta'){ev.x=rng.int(240,560);ev.y=rng.int(250,405);}
      else lastCaja=t;
      EV.push(ev);lastT=tipo;
      t+=Math.round(([108,76,40][ph]+rng.int(0,24))*GS);
    }
    EV.sort(function(a,b){return a.t-b.t;});

    function cajaAbierta(k){var m=0,e;for(e=0;e<EV.length;e++)if(EV[e].tipo==='caja'&&EV[e].t+EV[e].w<=k)m++;return m%2;}
    function cajaProxima(k){var e;for(e=0;e<EV.length;e++){var E=EV[e];if(E.tipo==='caja'&&k>=E.t&&k<E.t+E.w)return 1;}return 0;}
    function cartX(E,rel,dir){
      var u=(rel-E.w)/E.d;
      return dir>0?(AX0-70)+u*(AX1-AX0+140):(AX1+70)-u*(AX1-AX0+140);
    }

    /* ── estado autoritativo (display == sim) ── */
    var st={k:0,p:[],b:[]};
    for(p=0;p<MAXP;p++){
      var a0=Math.PI*2*p/Math.max(2,n)+Math.PI/4;
      st.p.push({x:q4(CX+Math.cos(a0)*175),y:q4(CY+30+Math.sin(a0)*95),stun:0,nb:0,ng:0,pts:0,dsh:0,cd:0,inv:0,fa:90});
    }
    for(i=0;i<NB;i++)st.b.push({x:0,y:0,kd:0});
    st.b[0]={x:CX,y:CY+10,kd:1};st.b[1]={x:CX-120,y:CY+60,kd:1};st.b[2]={x:CX+120,y:CY+60,kd:1};

    var cp=[];for(p=0;p<n;p++)cp.push({t:0,seen:-1,lastA:-9,r:c.rngFor('cpu'+p),greed:0});

    /* ── cosmético (no autoritativo) ── */
    var at=0,pops=[],banner=null,prev={nb:[],ng:[],pts:[],stun:[],kd:[],k:-1,fase:0,caja:0};
    for(p=0;p<MAXP;p++){prev.nb.push(0);prev.ng.push(0);prev.pts.push(0);prev.stun.push(0);}
    for(i=0;i<NB;i++)prev.kd.push(st.b[i].kd);
    var mp=null;                                              /* mi avatar predicho (no juez) */
    var stealLines=['¡Señora, ese es MÍO,|yo hice la cola desde las 4!','¡Eso lo vi YO primero!','¡Ay no, ese paquete es del barrio!','¡Suelta esa harina, chamo!'];
    var sline=0,perdio=[];

    function speedOf(pl){return SPD-SPD_BOLSA*pl.nb;}
    function addBag(x,y,kd){
      for(var j=0;j<NB;j++)if(!st.b[j].kd){st.b[j].x=Math.round(clamp(x,AX0+14,AX1-14));st.b[j].y=Math.round(clamp(y,AY0+14,AY1-14));st.b[j].kd=kd;return true;}
      return false;
    }
    function freeBags(){var m=0;for(var j=0;j<NB;j++)if(st.b[j].kd)m++;return m;}
    function drop1(pl,ox,oy){
      if(pl.nb<=0)return;
      var kd=pl.nb>pl.ng?1:2;if(kd===2)pl.ng--;pl.nb--;
      addBag(pl.x+ox,pl.y+oy,kd);
    }
    function award(pl,v){
      var cap=Math.min(LIM_MAX,Math.floor(LIM_RATE*(st.k/TK+1.5)));
      pl.pts=Math.min(cap,pl.pts+v);
    }
    function valor(pl,k){var v=(pl.nb-pl.ng)*P_BAG+pl.ng*P_GOLD+COMBO[pl.nb];return fase(k)===2?v*2:v;}
    function evActivos(k){var o=[],e;for(e=0;e<EV.length;e++){var E=EV[e],rel=k-E.t;if(rel>=0&&rel<E.w+E.d)o.push({E:E,rel:rel});}return o;}

    function newPop(s,x,y,col,life,pi){pops.push({s:s,x:x,y:y,col:col||'#fff',t:0,life:life||1.5,p:pi===undefined?-1:pi});if(pops.length>8)pops.shift();}
    function puff(x,y,k,cols){try{if(typeof spawn==='function')spawn(x,y,k,'bit',cols||['#ffffff','#fff6c9','#f2e4a8'],200,240,.7);}catch(e){}}

    /* ───────────────────────── reglas (solo juez) ───────────────────────── */
    function step(dt){
      var P=st.p,B=st.b,k=st.k,pl,v,i2,j,d,len,best,bd;
      var tap=[],ex=[],ey=[],acted=[],dashing=[];
      for(i2=0;i2<n;i2++){
        tap.push(c.tap(i2,'a')>0);
        var e=c.eje(i2)||{x:0,y:0};var ax=+e.x||0,ay=+e.y||0;len=Math.sqrt(ax*ax+ay*ay);
        if(len>1){ax/=len;ay/=len;}
        ex.push(ax);ey.push(ay);acted.push(false);dashing.push(false);
        pl=P[i2];
        if(pl.stun>0)pl.stun--;if(pl.cd>0)pl.cd--;if(pl.inv>0)pl.inv--;
        if(pl.stun===0&&len>0.2)pl.fa=Math.round(Math.atan2(ay,ax)*180/Math.PI);
      }
      /* 1) agarrar una bolsa del piso */
      for(j=0;j<NB;j++){
        var bj=B[j];if(!bj.kd)continue;
        best=-1;bd=1e9;
        for(i2=0;i2<n;i2++){
          pl=P[i2];if(!tap[i2]||acted[i2]||pl.stun>0||pl.nb>=MAXC)continue;
          d=dist(pl.x,pl.y,bj.x,bj.y);
          if(d<=REACH&&d<bd-0.001){bd=d;best=i2;}
        }
        if(best>=0){pl=P[best];acted[best]=true;pl.nb++;if(bj.kd===2)pl.ng++;award(pl,P_GRAB);bj.kd=0;}
      }
      /* 2) robar al que carga (la dorada primero) */
      for(i2=0;i2<n;i2++){
        pl=P[i2];if(!tap[i2]||acted[i2]||pl.stun>0||pl.nb>=MAXC||pl.cd>0)continue;
        best=-1;bd=1e9;
        for(j=0;j<n;j++){
          if(j===i2)continue;v=P[j];if(v.nb<=0||v.inv>0)continue;
          d=dist(pl.x,pl.y,v.x,v.y);
          if(d<=REACH_STEAL&&d<bd-0.001){bd=d;best=j;}
        }
        if(best>=0){
          v=P[best];acted[i2]=true;
          if(v.ng>0){v.ng--;pl.ng++;}v.nb--;pl.nb++;
          v.stun=Math.max(v.stun,ST_STEAL);v.inv=INV;pl.cd=CD_STEAL;
        }
      }
      /* 3) A sin nada = empujón */
      for(i2=0;i2<n;i2++){pl=P[i2];if(tap[i2]&&!acted[i2]&&pl.stun===0&&pl.cd===0){pl.dsh=DASH_T;pl.cd=CD_DASH;}}
      /* movimiento */
      for(i2=0;i2<n;i2++){
        pl=P[i2];
        if(pl.stun>0){pl.dsh=0;continue;}
        if(pl.dsh>0){
          var an=pl.fa*Math.PI/180,sp2=SPD*DASH_K;
          pl.x=q4(pl.x+Math.cos(an)*sp2);pl.y=q4(pl.y+Math.sin(an)*sp2);pl.dsh--;dashing[i2]=true;
        }else{var sp=speedOf(pl);pl.x=q4(pl.x+ex[i2]*sp);pl.y=q4(pl.y+ey[i2]*sp);}
      }
      /* el empujón choca */
      for(i2=0;i2<n;i2++){
        if(!dashing[i2])continue;pl=P[i2];
        for(j=0;j<n;j++){
          if(j===i2)continue;v=P[j];if(v.inv>0)continue;
          if(dist(pl.x,pl.y,v.x,v.y)<RAD*2+6){
            var an2=pl.fa*Math.PI/180;
            v.stun=Math.max(v.stun,ST_HIT);v.inv=INV;
            if(v.nb>0)drop1(v,Math.cos(an2)*46,Math.sin(an2)*46);
            pl.dsh=0;break;
          }
        }
      }
      /* empujones entre círculos */
      var dx,dy;
      for(var pass=0;pass<2;pass++){
        for(i2=0;i2<n;i2++)for(j=i2+1;j<n;j++){
          dx=P[j].x-P[i2].x;dy=P[j].y-P[i2].y;d=Math.sqrt(dx*dx+dy*dy);
          if(d>=RAD*2)continue;
          if(d<0.01){dx=(j-i2);dy=0.5;d=Math.sqrt(dx*dx+dy*dy);}
          var push=(RAD*2-d)/2;dx/=d;dy/=d;
          P[i2].x-=dx*push;P[i2].y-=dy*push;P[j].x+=dx*push;P[j].y+=dy*push;
        }
      }
      for(i2=0;i2<n;i2++){P[i2].x=q4(clamp(P[i2].x,AX0+RAD,AX1-RAD));P[i2].y=q4(clamp(P[i2].y,AY0+RAD,AY1-RAD));}

      /* eventos que pegan: carritos y piso mojado */
      var act=evActivos(k),ea,E,rel;
      for(ea=0;ea<act.length;ea++){
        E=act[ea].E;rel=act[ea].rel;if(rel<E.w)continue;
        if(E.tipo==='carro'){
          var lanes=[[E.ly,E.dir]];if(E.ly2>0)lanes.push([E.ly2,-E.dir]);
          for(var L=0;L<lanes.length;L++){
            var cxp=cartX(E,rel,lanes[L][1]);
            for(i2=0;i2<n;i2++){
              pl=P[i2];if(pl.inv>0)continue;
              if(Math.abs(pl.y-lanes[L][0])<40&&Math.abs(pl.x-cxp)<46){
                pl.stun=Math.max(pl.stun,ST_CART);pl.inv=INV;pl.dsh=0;
                var dd=0;while(pl.nb>0&&dd<3){drop1(pl,DROPS[dd][0],DROPS[dd][1]);dd++;}
              }
            }
          }
        }else if(E.tipo==='mojado'){
          for(i2=0;i2<n;i2++){
            pl=P[i2];if(pl.nb<=0||pl.inv>0)continue;
            if(dist(pl.x,pl.y,E.x,E.y)<58){
              var an3=pl.fa*Math.PI/180;
              drop1(pl,Math.cos(an3)*48,Math.sin(an3)*48);pl.stun=Math.max(pl.stun,ST_WET);pl.inv=30;pl.dsh=0;
            }
          }
        }
      }
      /* lo que aparece: reposición, camión, oferta */
      if(rest[k]&&freeBags()<7)addBag(rest[k].x,rest[k].y,rest[k].kd);
      for(ea=0;ea<EV.length;ea++){
        E=EV[ea];if(k!==E.t+E.w)continue;
        if(E.tipo==='camion'){
          var off=[[-56,14],[0,30],[56,14],[0,72]];
          for(j=0;j<E.nb;j++)addBag(PORTON[0]+off[j][0],PORTON[1]+off[j][1],(j===3||(j===1&&fase(k)===2))?2:1);
        }else if(E.tipo==='oferta')addBag(E.x,E.y,2);
      }
      /* cobrar en la caja abierta */
      var ca=CAJAS[cajaAbierta(k)];
      for(i2=0;i2<n;i2++){
        pl=P[i2];if(pl.nb<=0||pl.stun>0)continue;
        if(dist(pl.x,pl.y,ca[0],ca[1])<=CAJA_R){award(pl,valor(pl,k));pl.nb=0;pl.ng=0;}
      }
      st.k++;
    }

    /* ───────────────────────── snapshot ───────────────────────── */
    function pack(){
      var a=[st.k],i2,pl,bb;
      for(i2=0;i2<MAXP;i2++){
        pl=st.p[i2];
        a.push(Math.round(pl.x*4),Math.round(pl.y*4),pl.stun,pl.nb,pl.ng,pl.pts,pl.dsh,pl.cd,pl.inv,pl.fa);
      }
      for(i2=0;i2<NB;i2++){bb=st.b[i2];if(bb.kd)a.push(bb.x,bb.y,bb.kd);else a.push(0,0,0);}
      return a;
    }
    function load(a){
      if(!a||a.length<PACKN)return;
      var i2,pl,bb,o;
      st.k=a[0]|0;
      for(i2=0;i2<MAXP;i2++){
        o=G+PS*i2;pl=st.p[i2];
        pl.x=a[o]/4;pl.y=a[o+1]/4;pl.stun=a[o+2]|0;pl.nb=a[o+3]|0;pl.ng=a[o+4]|0;pl.pts=a[o+5]|0;pl.dsh=a[o+6]|0;pl.cd=a[o+7]|0;pl.inv=a[o+8]|0;pl.fa=a[o+9]|0;
      }
      for(i2=0;i2<NB;i2++){o=G+PS*MAXP+BS*i2;bb=st.b[i2];bb.x=a[o]|0;bb.y=a[o+1]|0;bb.kd=a[o+2]|0;}
    }
    function lerp(a,b,u){
      var out=b.slice(),i2,ix;
      for(i2=0;i2<POSIDX.length;i2++){
        ix=POSIDX[i2];
        if(Math.abs(b[ix]-a[ix])<600)out[ix]=Math.round(a[ix]+(b[ix]-a[ix])*u);
      }
      return out;
    }

    /* ───────────────────────── presentación ───────────────────────── */
    function isJudge(){return c.juez();}
    function posOf(p2){
      var pl=st.p[p2];
      if(p2===c.yo&&!isJudge()&&mp)return mp;
      return pl;
    }

    function predict(dt,auth){
      if(isJudge()||c.yo<0||c.yo>=n)return;
      var a=(auth&&typeof auth.x==='number'&&typeof auth.y==='number')?auth:st.p[c.yo];
      if(!mp)mp={x:a.x,y:a.y};
      if(a.stun>0||a.dsh>0){mp.x+=(a.x-mp.x)*Math.min(1,dt*12);mp.y+=(a.y-mp.y)*Math.min(1,dt*12);}
      else{
        var e=c.eje(c.yo)||{x:0,y:0},ax=+e.x||0,ay=+e.y||0,len=Math.sqrt(ax*ax+ay*ay);
        if(len>1){ax/=len;ay/=len;}
        var sp=speedOf(st.p[c.yo])*TK*dt;
        mp.x=clamp(mp.x+ax*sp,AX0+RAD,AX1-RAD);mp.y=clamp(mp.y+ay*sp,AY0+RAD,AY1-RAD);
      }
      var dx=a.x-mp.x,dy=a.y-mp.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d>60){mp.x=a.x;mp.y=a.y;}
      else if(d>26){var m=Math.min(8,d-26);mp.x+=dx/d*m;mp.y+=dy/d*m;}
    }

    var BANNER_EV={carro:['¡CUIDADO, CARRITO!','#ffb0cc'],mojado:['¡PISO MOJADO!','#9fe8ff'],oferta:['¡OFERTA! HARINA DORADA','#ffd23f'],caja:['¡CAMBIO DE CAJA!','#5cff7a'],camion:['¡VIENE EL CAMIÓN!','#ffd23f']};
    function update(dt){
      at+=dt;var i2,j,k=st.k,e;
      /* fase (escalada) */
      var fz=fase(k);
      if(fz!==prev.fase&&k>0){
        if(fz===1){banner={s:'¡SE ARMÓ LA COLA!',t:0,life:2,col:'#ff8a3f'};if(v3){V3.sfx('silbato');v3.esc.sacudir(.6);}}
        if(fz===2){banner={s:'¡ÚLTIMOS SEGUNDOS! · CAJA x2',t:0,life:2.4,col:'#ff4d6d'};if(v3){V3.sfx('tambor');V3.sfx('bocina');v3.esc.sacudir(1.2);}}
      }
      prev.fase=fz;
      /* eventos del calendario: el aviso y el momento en que pegan */
      if(prev.k>=0&&k>prev.k&&k-prev.k<60){
        for(e=0;e<EV.length;e++){
          var E=EV[e];
          if(prev.k<E.t&&E.t<=k){var bn=BANNER_EV[E.tipo];if(!(banner&&banner.t<.6&&fz!==prev.faseB)){banner={s:bn[0],t:0,life:1.6,col:bn[1]};}if(v3)aviso3D(E);}
          if(prev.k<E.t+E.w&&E.t+E.w<=k&&v3)pega3D(E);
        }
      }
      prev.k=k;prev.faseB=fz;
      var cz=cajaAbierta(k);if(cz!==prev.caja){var cq=CAJAS[cz];newPop('¡CAJA '+(cz+1)+' ABIERTA!',cq[0],cq[1]-60,'#5cff7a',1.4,-1);prev.caja=cz;}
      /* bolsas que aparecen en el piso */
      for(j=0;j<NB;j++){
        var b=st.b[j];
        if(b.kd&&!prev.kd[j]){if(v3)aparece3D(j);else puff(b.x,b.y,6);}
        prev.kd[j]=b.kd;
      }
      /* lo que le pasó a cada uno (por diferencias del estado) */
      for(i2=0;i2<n;i2++)perdio[i2]=st.p[i2].nb<prev.nb[i2];
      for(i2=0;i2<n;i2++){
        var pl=st.p[i2],ps=posOf(i2),dp=pl.pts-prev.pts[i2],dn=pl.nb-prev.nb[i2];
        if(v3&&dn!==0)tamb3D(i2,dn>0?0.12:.22);
        if(dp>=10&&pl.nb===0){newPop('¡COBRÓ +'+dp+'!',ps.x,ps.y-90,'#ffd23f',1.4,i2);if(v3)cobra3D(i2,prev.nb[i2],prev.ng[i2],dp);}
        else if(dn>0&&dp>0){newPop(pl.ng>prev.ng[i2]?'¡LA DORADA!':'¡LA AGARRÉ!',ps.x,ps.y-80,'#fff',0.9,i2);if(v3)agarra3D(i2);}
        else if(dn>0&&dp===0){newPop(stealLines[sline%stealLines.length],ps.x,ps.y-92,'#fff',1.8,i2);sline++;if(v3)robo3D(i2);}
        else if(dn<0&&pl.stun>0&&prev.stun[i2]===0){
          var porCarro=pl.stun>ST_HIT;
          newPop(porCarro?'¡ME TUMBÓ EL CARRITO!':(pl.stun>ST_STEAL?'¡SE ME CAYÓ!':'¡ME LA ROBARON!'),ps.x,ps.y-80,'#ffb0cc',1.1,i2);
          if(v3&&pl.stun>ST_STEAL){var qc=caidaDe(i2);tumbo3D(i2,qc.kind,qc.dx,qc.dz);}
        }else if(dn<0){if(v3){var qg=caidaDe(i2);v3.pjs[i2].pj.impacto(qg.dx,qg.dz,1.2);}}
        else if(pl.stun>prev.stun[i2]&&prev.stun[i2]===0){newPop(pl.stun>ST_HIT?'¡AY, EL CARRITO!':'¡EMPUJÓN!',ps.x,ps.y-80,'#ffe14d',.9,i2);if(v3){var qe=caidaDe(i2);tumbo3D(i2,qe.kind,qe.dx,qe.dz);}}
        if(pl.dsh>0&&v3&&!v3.pjs[i2].dashV){v3.pjs[i2].dashV=1;V3.sfx('whoosh');}
        if(pl.dsh===0&&v3)v3.pjs[i2].dashV=0;
        prev.stun[i2]=pl.stun;prev.nb[i2]=pl.nb;prev.ng[i2]=pl.ng;prev.pts[i2]=pl.pts;
      }
      var kk;for(kk=pops.length-1;kk>=0;kk--){pops[kk].t+=dt;if(pops[kk].t>pops[kk].life)pops.splice(kk,1);}
      if(banner){banner.t+=dt;if(banner.t>banner.life)banner=null;}
    }

    /* ───────────────────────── CPU ───────────────────────── */
    function ai(p2,dt,api){
      var S=cp[p2],me=st.p[p2],P=st.p,B=st.b,k=st.k,j,i2,d;
      S.t+=dt;
      if(me.stun>0){api.eje(0,0);return;}
      var sk=(c.skill&&typeof c.skill[p2]==='number')?c.skill[p2]:0.6;
      var ca=CAJAS[cajaAbierta(k)],dC=dist(me.x,me.y,ca[0],ca[1]);
      /* bolsa del piso más conveniente (la dorada pesa más) */
      var fb=-1,fd=1e9;
      for(j=0;j<NB;j++){if(!B[j].kd)continue;d=dist(B[j].x,B[j].y,me.x,me.y)*(B[j].kd===2?0.6:1);if(d<fd){fd=d;fb=j;}}
      /* el rival más cercano */
      var en=-1,ed=1e9;
      for(i2=0;i2<n;i2++){if(i2===p2)continue;d=dist(P[i2].x,P[i2].y,me.x,me.y);if(d<ed){ed=d;en=i2;}}
      var tx=me.x,ty=me.y,press=false,why='';
      if(me.nb>0){
        var amenaza=en>=0&&ed<70&&P[en].nb<MAXC&&P[en].stun===0&&me.inv===0;
        var cobrar=me.nb>=MAXC||fb<0||amenaza||fase(k)===2&&me.nb>=2||fd>dC*(0.45+0.25*S.greed)||me.ng>0&&fd>dC*0.3;
        if(cobrar){tx=ca[0];ty=ca[1];}
        else{tx=B[fb].x;ty=B[fb].y;if(fd<=REACH-6){press=true;why='g';}}
        if(amenaza&&me.cd===0&&!press&&S.r.next()<0.10*sk){press=true;why='d';}
      }else if(fb>=0&&(fd<220||!hayPortador())){
        tx=B[fb].x;ty=B[fb].y;if(dist(B[fb].x,B[fb].y,me.x,me.y)<=REACH-6){press=true;why='g';}
      }else{
        var tv=-1,td=1e9;
        for(i2=0;i2<n;i2++){if(i2===p2||P[i2].nb<=0)continue;d=dist(P[i2].x,P[i2].y,me.x,me.y)-P[i2].nb*20;if(d<td){td=d;tv=i2;}}
        if(tv>=0){
          var V=P[tv];tx=V.x;ty=V.y;d=dist(V.x,V.y,me.x,me.y);
          if(d<=REACH_STEAL-4&&V.inv===0&&me.cd===0){press=true;why='s';}
          else if(d>70&&d<130&&me.cd===0&&V.inv===0&&S.r.next()<0.03*sk){press=true;why='d';}
        }else if(fb>=0){tx=B[fb].x;ty=B[fb].y;}
        else{tx=CX;ty=CY;}
      }
      /* esquivar: carritos (aviso o corriendo) y piso mojado si cargas */
      var vx=tx-me.x,vy=ty-me.y,vl=Math.sqrt(vx*vx+vy*vy);
      if(vl>8){vx/=vl;vy/=vl;}else{vx=0;vy=0;}
      var act=evActivos(k),ea;
      for(ea=0;ea<act.length;ea++){
        var E=act[ea].E;
        if(E.tipo==='carro'&&sk>0.25){
          var ls=[E.ly];if(E.ly2>0)ls.push(E.ly2);
          for(var L=0;L<ls.length;L++){
            var dy=me.y-ls[L];
            if(Math.abs(dy)<62){var sg=dy>=0?1:-1;if(me.y+sg*70>AY1-RAD||me.y+sg*70<AY0+RAD)sg=-sg;vy=sg;vx*=0.4;}
          }
        }else if(E.tipo==='mojado'&&me.nb>0){
          var wx=me.x-E.x,wy=me.y-E.y,wd=Math.sqrt(wx*wx+wy*wy)+0.01;
          if(wd<95){vx+=wx/wd*1.2;vy+=wy/wd*1.2;}
        }
      }
      var ln=Math.sqrt(vx*vx+vy*vy);if(ln>1){vx/=ln;vy/=ln;}
      api.eje(vx,vy);
      if(press){
        if(S.seen<0)S.seen=S.t+Math.max(0.12,0.32-0.2*sk+(S.r.next()-0.5)*0.08);
        if(S.t>=S.seen&&S.t-S.lastA>0.22){S.lastA=S.t;S.seen=-1;S.greed=S.r.next();api.press('a');}
      }else S.seen=-1;
    }
    function hayPortador(){for(var i2=0;i2<n;i2++)if(st.p[i2].nb>0)return true;return false;}

    /* ───────────────────────── dibujo 2D (respaldo) ───────────────────────── */
    function drawBag(x,y,sc,gold){
      ctx.save();ctx.translate(x,y);ctx.scale(sc,sc);
      if(gold){ctx.globalAlpha=.25+.12*Math.sin(at*10);ell(0,-2,34,40,'#fff59a',0);ctx.globalAlpha=1;}
      rr(-16,-26,32,50,7,gold?'#ffe27a':'#fdf1c4',3);
      rr(-16,-26,32,13,5,'#f2b705',2.5);
      ell(0,-4,10,8,'#f6d15a',2);
      txt('HARINA',0,10,8,'#c0392b',0,true);
      txt('P.A.N.',0,-18,8,'#7a4a10',0,true);
      ctx.restore();
    }
    function drawPlayer(p2){
      var pl=st.p[p2],ps=posOf(p2),seat=c.seats[p2]||{},col=seat.color||'#ffd23f';
      var stunned=pl.stun>0,wob=stunned?Math.sin(at*30)*3:0,i2;
      ell(ps.x,ps.y+16,28,11,'rgba(0,0,0,.28)',0);
      ell(ps.x,ps.y+12,RAD+3,RAD*.5+3,col,3);
      if(pl.dsh>0){ctx.save();ctx.globalAlpha=.4;ell(ps.x-Math.cos(pl.fa*Math.PI/180)*20,ps.y-Math.sin(pl.fa*Math.PI/180)*20,RAD,RAD*.6,'#ffffff',0);ctx.restore();}
      var drawn=false;
      try{if(c.util&&c.util.pj){c.util.pj(seat.ch,ps.x+wob,ps.y-26,66,1);drawn=true;}}catch(e){drawn=false;}
      if(!drawn){ell(ps.x+wob,ps.y-12,RAD,RAD+8,col,3.5);ell(ps.x+wob,ps.y-40,15,15,'#f3c9a0',3);}
      for(i2=0;i2<pl.nb;i2++)drawBag(ps.x+wob,ps.y-74-i2*24,.62,i2>=pl.nb-pl.ng);
      if(stunned){for(i2=0;i2<3;i2++){var an=at*6+i2*2.1;txt('★',ps.x+Math.cos(an)*24,ps.y-70+Math.sin(an)*6,15,'#ffe14d',0,true);}}
      if(p2===c.yo){var hy=ps.y-84-pl.nb*24;poly([[ps.x-8,hy],[ps.x+8,hy],[ps.x,hy+10]],'#ffffff',2.5);}
      txt(String(pl.pts),ps.x,ps.y+32,16,'#ffffff',0,false);
    }
    function drawBubble(po){
      var lines=po.s.split('|'),size=15,w=0,i2;
      for(i2=0;i2<lines.length;i2++)w=Math.max(w,lines[i2].length*size*.56);
      w+=26;var h=lines.length*(size+4)+14,a=Math.min(1,(po.life-po.t)*3,po.t*8+.2);
      ctx.save();ctx.globalAlpha=Math.max(0,a);
      var bx=clamp(po.x,c.campo().x0+w/2+6,c.campo().x1-w/2-6),by=po.y-h/2-(po.t*14);
      rr(bx-w/2,by-h/2,w,h,10,'#ffffff',3);
      for(i2=0;i2<lines.length;i2++)txt(lines[i2],bx,by-h/2+13+i2*(size+4),size,'#1b1630',0,true);
      ctx.restore();
    }
    function drawCart2D(x,y,dir){
      ctx.save();ctx.translate(x,y);ctx.scale(dir,1);
      rr(-44,-4,88,40,8,'#ff7ab0',4);
      for(var i2=-2;i2<=2;i2++)line([[i2*16,0],[i2*16,32]],2,'#b8447c');
      line([[-44,-4],[-62,-40]],6,'#8d92a3');
      ell(-26,42,10,10,'#33323c',3);ell(26,42,10,10,'#33323c',3);
      ctx.restore();
    }
    function drawEventos2D(){
      var act=evActivos(st.k),ea,E,rel,warn;
      for(ea=0;ea<act.length;ea++){
        E=act[ea].E;rel=act[ea].rel;warn=rel<E.w;
        if(E.tipo==='carro'){
          var lanes=[[E.ly,E.dir]];if(E.ly2>0)lanes.push([E.ly2,-E.dir]);
          for(var L=0;L<lanes.length;L++){
            ctx.save();ctx.globalAlpha=warn?(.18+.14*Math.sin(at*22)):.14;rr(AX0-10,lanes[L][0]-46,AX1-AX0+20,92,8,'#ff4d6d',0);ctx.restore();
            if(warn)txt(lanes[L][1]>0?'➜ ¡CARRITO! ➜':'⬅ ¡CARRITO! ⬅',CX,lanes[L][0]-4,18,'#ffd0dc',0,false);
            else drawCart2D(cartX(E,rel,lanes[L][1]),lanes[L][0],lanes[L][1]);
          }
        }else if(E.tipo==='mojado'){
          ctx.save();ctx.globalAlpha=warn?0.25+.2*Math.sin(at*16):.45;ell(E.x,E.y,58,40,'#7fd6ff',0);ctx.restore();
          poly([[E.x-8,E.y-6],[E.x+8,E.y-6],[E.x,E.y-34]],'#ffd23f',2);
        }else if(E.tipo==='oferta'&&warn){
          ctx.save();ctx.globalAlpha=.25+.2*Math.sin(at*18);ell(E.x,E.y,34,20,'#fff59a',0);ctx.restore();
        }
      }
    }
    function dibujar2D(){                                     /* el 2D (sin WebGL o con ?plano=1) */
      var f=c.campo(),W=f.x1-f.x0,i2,j,b;
      rr(f.x0,0,W,640,0,pal.wall,0);
      rr(f.x0,150,W,490,0,pal.floor,0);
      for(var x=AX0-40;x<=AX1+40;x+=80)line([[x,150],[x,610]],1.4,pal.tile);
      for(var y=170;y<=600;y+=52)line([[f.x0,y],[f.x1,y]],1.2,pal.tile);
      /* anaqueles de los lados (de ahí reponen) */
      rr(AX0-40,220,26,220,4,pal.shelf,3);rr(AX1+14,220,26,220,4,pal.shelf,3);
      ctx.save();ctx.globalAlpha=.22;rr(AX0,AY0,AX1-AX0,AY1-AY0,18,pal.mark,0);ctx.restore();
      /* las cajas */
      var ab=cajaAbierta(st.k),cambio=cajaProxima(st.k);
      for(i2=0;i2<2;i2++){
        var cq=CAJAS[i2],open=i2===ab,blink=cambio&&Math.sin(at*20)>0;
        ctx.save();ctx.globalAlpha=open?0.4:.15;ell(cq[0],cq[1],CAJA_R,CAJA_R*.6,open?'#5cff7a':'#888888',0);ctx.restore();
        rr(cq[0]-40,cq[1]-70,80,30,6,open?'#d63a2f':'#77737a',3);
        txt(open?(blink?'CERRANDO':'CAJA '+(i2+1)):(blink?'ABRIENDO':'CERRADA'),cq[0],cq[1]-55,13,'#fffdf2',0,true);
      }
      drawEventos2D();
      for(j=0;j<NB;j++){b=st.b[j];if(b.kd){ell(b.x,b.y+22,22,8,'rgba(0,0,0,.25)',0);drawBag(b.x,b.y-(Math.sin(at*4+j)*3+2),1,b.kd===2);}}
      var ord=[];for(i2=0;i2<n;i2++)ord.push(i2);
      ord.sort(function(a,b2){return posOf(a).y-posOf(b2).y||a-b2;});
      for(i2=0;i2<ord.length;i2++)drawPlayer(ord[i2]);
      for(i2=0;i2<pops.length;i2++)drawBubble(pops[i2]);
      if(banner){
        var k2=Math.min(1,banner.t*5);ctx.save();ctx.globalAlpha=Math.min(1,(banner.life-banner.t)*3);
        txt(banner.s,CX,235-(1-k2)*30,36*k2+4,banner.col,0,false);ctx.restore();
      }
      if(fase(st.k)===2)txt('¡CAJA x2!',CX,140,18,'#ff4d6d',0,false);
      var now=c.ahora();
      if(now>=0&&now<5||c.practica&&at<7)txt('A = agarrar · llévala a la CAJA abierta · A pegado a otro = ¡robo!',CX,490,15,'#ffffff',0,false);
    }


    /* ───── 3D low poly (fiesta-3d.js): el supermercado de la última harina. Solo dibujo: lee st/posOf/pops; no toca la simulación ───── */
    var V3=window.FIESTA&&FIESTA.V3, v3=null, v3T=0;
    var ESX=1/18, ESZ=1.15/18, ZF=-13.5;                      /* px de la arena -> metros; ZF = la pared del fondo */
    function WX(x){return (x-CX)*ESX;}
    function WZ(y){return (y-CY)*ESZ;}
    function fx(){return c.fx?c.fx():0.5;}
    var PAL3=[
      {fondo:['#dfe8e4','#f6f3e6'],hemi:[0xffffff,0x9a8a70,.6],sol:[0xfff6e0,.65],niebla:'#f6f3e6',pisoA:'#efe8d2',pisoB:'#d3c6a8',pared:'#f3ecd2',calle:'#8a8a92',noche:0},
      {fondo:['#ff9a6a','#ffd9a0'],hemi:[0xffd8b0,0x7a5a6a,.52],sol:[0xffb070,.75],niebla:'#ffd0a0',pisoA:'#f0d6b0',pisoB:'#d2a878',pared:'#f5cf9f',calle:'#8a6a62',noche:0},
      {fondo:['#141238','#2c2a5a'],hemi:[0x8a8aff,0x3a2a4a,.42],sol:[0x9aa8ff,.28],niebla:'#2a2550',pisoA:'#62627e',pisoB:'#4a4b68',pared:'#3d4269',calle:'#2a2a38',noche:1}
    ];
    var PROD=['#e63946','#f2b705','#2a9d8f','#3fa9ff','#ff8a3f','#8a4fd0','#5cbf4a','#fffdf2'];
    var CONF3=['#ff5c8a','#ffd23f','#3fd0a0','#3fa9ff','#ff8a3f'];
    var HARINA=['#fffdf2','#fff6c9','#f2e4a8'];
    var ORO=['#ffd23f','#fff59a','#ffffff'];
    function cartel(s,bg,fg,w,h){                            /* un letrero con texto pintado (se ve igual de día y de noche) */
      var T=THREE,tex=V3.texturaCanvas(256,64,function(x,W,H){
        x.fillStyle=bg;x.fillRect(0,0,W,H);x.fillStyle=fg;
        var fs=38;x.font='bold '+fs+'px sans-serif';var mw=x.measureText(s).width;
        if(mw>W-16){fs=Math.floor(fs*(W-16)/mw);x.font='bold '+fs+'px sans-serif';}
        x.textAlign='center';x.textBaseline='middle';x.fillText(s,W/2,H/2+2);
      });
      return new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex}));
    }
    function texProd(lleno,sem){                             /* la cara de una góndola: tres filas de productos (o casi vacía) */
      return V3.texturaCanvas(256,192,function(x,w,h){
        x.fillStyle='#e9e4d8';x.fillRect(0,0,w,h);
        var fila,i2,k=sem;
        for(fila=0;fila<3;fila++){
          var base=(fila+1)*h/3-4;
          x.fillStyle='rgba(0,0,0,.14)';x.fillRect(0,base,w,4);
          for(i2=0;i2<12;i2++){
            k=(k*37+11)%101;
            if(!lleno&&k%6!==0)continue;
            var bw=14+(k%3)*3,bh=24+(k%4)*7,bx=5+i2*21;
            x.fillStyle=PROD[k%PROD.length];x.fillRect(bx,base-bh,bw,bh);
            x.fillStyle='rgba(255,255,255,.55)';x.fillRect(bx+2,base-bh+6,bw-4,6);
          }
        }
      });
    }
    var BAGM=null;
    function bagMats(){                                      /* materiales compartidos de la bolsa: normal y dorada */
      if(BAGM)return BAGM;
      var T=THREE,gm=V3.toon('#fff').gradientMap;
      function tx(oro){return V3.texturaCanvas(128,160,function(x,w,h){
        x.fillStyle=oro?'#ffe27a':'#fdf1c4';x.fillRect(0,0,w,h);
        x.fillStyle=oro?'#ff9f1c':'#f2b705';x.fillRect(0,0,w,40);
        x.fillStyle='#7a4a10';x.font='bold 26px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('P.A.N.',w/2,22);
        x.fillStyle='#f6d15a';x.beginPath();x.ellipse(w/2,78,22,16,0,0,6.3);x.fill();
        x.fillStyle='#5cbf4a';x.beginPath();x.ellipse(w/2-20,84,10,22,.6,0,6.3);x.fill();
        x.fillStyle='#c0392b';x.font='bold 24px sans-serif';x.fillText('HARINA',w/2,124);
        x.fillStyle=oro?'#c0392b':'#2a7fd0';x.font='bold 14px sans-serif';x.fillText(oro?'¡DORADA!':'MAÍZ BLANCO',w/2,146);
      });}
      var lado=new T.MeshToonMaterial({color:0xfdf1c4,gradientMap:gm});
      var cara=new T.MeshToonMaterial({map:tx(false),gradientMap:gm});
      var ladoG=new T.MeshToonMaterial({color:0xffd23f,gradientMap:gm,emissive:new T.Color('#ffb800'),emissiveIntensity:.35});
      var caraG=new T.MeshToonMaterial({map:tx(true),gradientMap:gm,emissive:new T.Color('#fff59a'),emissiveIntensity:.35});
      BAGM={geo:new T.BoxGeometry(.95,1.3,.55),n:[lado,lado,lado,lado,cara,cara],g:[ladoG,ladoG,ladoG,ladoG,caraG,caraG],oro:[ladoG,caraG]};
      return BAGM;
    }
    function bolsaMesh(){                                    /* una bolsa: cuerpo (cambia de material normal/dorada) + tapa */
      var T=THREE,BM=bagMats(),g3=new T.Group();
      var cu=new T.Mesh(BM.geo,BM.n);cu.castShadow=true;V3.borde(cu,.06);cu.position.y=.65;g3.add(cu);
      var tapa=V3.malla(new T.BoxGeometry(1,.16,.42),'#f2b705',{g:.08});tapa.position.y=1.36;g3.add(tapa);
      return {g:g3,cu:cu,oro:false};
    }
    function ponOro(b,oro){if(b.oro!==oro){b.oro=oro;b.cu.material=oro?bagMats().g:bagMats().n;}}
    function carrito3D(S3,M,tn){                             /* un carrito de mercado (rosado, con mercado adentro) */
      var T=THREE,carro=new T.Group();S3.add(carro);
      var cesta=M(new T.BoxGeometry(2.2,1.1,1.4),'#ff7ab0',{g:.03});cesta.position.y=1.15;carro.add(cesta);
      for(var k=0;k<4;k++){var ba=new T.Mesh(new T.BoxGeometry(.05,1.12,1.42),tn('#b8447c'));ba.position.set(-.8+k*.53,1.15,0);carro.add(ba);}
      for(k=0;k<5;k++){var co=M(new T.BoxGeometry(.4,.5,.35),PROD[(k*3)%PROD.length],{g:.05});co.position.set(-.7+k*.35,1.8,(k%2)*.3-.15);co.rotation.y=k*.6;carro.add(co);}
      var asa=M(new T.CylinderGeometry(.06,.06,1.4,6),'#8d92a3',{g:.06});asa.rotation.x=Math.PI/2;asa.position.set(-1.25,1.9,0);carro.add(asa);
      var ruedas=[];
      [[-.85,-.55],[.85,-.55],[-.85,.55],[.85,.55]].forEach(function(r){var ru=M(new T.CylinderGeometry(.2,.2,.14,10),'#33323c',{g:.06});ru.rotation.x=Math.PI/2;ru.position.set(r[0],.22,r[1]);carro.add(ru);ruedas.push(ru);});
      var franja=new T.Mesh(new T.PlaneGeometry(WX(AX1)-WX(AX0)+2,92*ESZ),new T.MeshBasicMaterial({color:0xff4d6d,transparent:true,opacity:0,depthWrite:false}));franja.rotation.x=-Math.PI/2;franja.position.y=.035;S3.add(franja);
      var flecha=M(new T.ConeGeometry(.6,1.4,4),'#ff4d6d',{g:.08});S3.add(flecha);
      carro.visible=false;franja.visible=false;flecha.visible=false;
      return {g:carro,ruedas:ruedas,franja:franja,flecha:flecha};
    }
    function montar3D(){
      var T=THREE,pl=PAL3[clamp(lv,1,3)-1],k;
      var esc=V3.escena({fondo:V3.cielo(pl.fondo[0],pl.fondo[1]),niebla:[pl.niebla,70,170],fov:32});
      if(!esc)return null;
      esc.luces.hemi.color.set(pl.hemi[0]);esc.luces.hemi.groundColor.set(pl.hemi[1]);esc.luces.hemi.intensity=pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]);esc.luces.sol.intensity=pl.sol[1];
      if(lv===2)esc.luces.sol.position.set(-24,14,8);
      var gaita={acordes:[[57,60,64],[50,53,57],[52,56,59],[57,60,64]],      /* gaita zuliana (furro y charrasca): i–iv–V–i en La menor */
        mel:[76,0,76,74,72,0,71,72,74,0,74,72,71,0,69,0,68,0,71,74,0,76,74,71,72,0,71,69,0,69,0,0]};
      V3.pista('harina',{bpm:124,acordes:gaita.acordes,mel:gaita.mel});
      V3.pista('harina2',{bpm:156,acordes:gaita.acordes,mel:gaita.mel});    /* ¡ÚLTIMOS SEGUNDOS!: la misma gaita, acelerada */
      var S3=esc.scene,M=V3.malla,tn=V3.toon,gm=V3.toon('#fff').gradientMap;
      /* piso de baldosas */
      var bald=V3.texturaCanvas(128,128,function(x,w,h){x.fillStyle=pl.pisoA;x.fillRect(0,0,w,h);x.fillStyle=pl.pisoB;x.fillRect(0,0,w/2,h/2);x.fillRect(w/2,h/2,w/2,h/2);
        x.fillStyle='rgba(0,0,0,.08)';x.fillRect(0,0,w,2);x.fillRect(0,h/2,w,2);x.fillRect(0,0,2,h);x.fillRect(w/2,0,2,h);},[22.5,15]);
      var piso=new T.Mesh(new T.PlaneGeometry(90,60),new T.MeshToonMaterial({map:bald,gradientMap:gm}));piso.rotation.x=-Math.PI/2;piso.receiveShadow=true;S3.add(piso);
      var calle=new T.Mesh(new T.PlaneGeometry(60,40),tn(pl.calle));calle.rotation.x=-Math.PI/2;calle.position.set(0,.02,ZF-20.3);S3.add(calle);
      /* la arena: cinta amarilla en el piso */
      var x0=WX(AX0)-.2,x1=WX(AX1)+.2,z0=WZ(AY0)-.2,z1=WZ(AY1)+.2,bw=x1-x0,bd=z1-z0,cz=(z0+z1)/2;
      [[0,z0,bw,.2],[0,z1,bw,.2],[x0,cz,.2,bd],[x1,cz,.2,bd]].forEach(function(r){
        var m=new T.Mesh(new T.PlaneGeometry(r[2],r[3]),tn('#ffd23f'));m.rotation.x=-Math.PI/2;m.position.set(r[0],.03,r[1]);m.receiveShadow=true;S3.add(m);
      });
      /* la pared del fondo con el portón del depósito (por ahí entra el camión) */
      var paredM=tn(pl.pared);
      [[-22,8,36],[22,8,36]].forEach(function(r){var m=M(new T.BoxGeometry(r[2],r[1],.6),null,{mat:paredM,recibe:true,g:.01});m.position.set(r[0],r[1]/2,ZF);S3.add(m);});
      var dintel=M(new T.BoxGeometry(8,2.5,.6),null,{mat:paredM,recibe:true,g:.01});dintel.position.set(0,6.75,ZF);S3.add(dintel);
      var franjaP=M(new T.BoxGeometry(80,.5,.65),'#d63a2f',{borde:false,recibe:true});franjaP.position.set(0,.25,ZF);S3.add(franjaP);
      var rejaT=V3.texturaCanvas(64,64,function(x,w,h){x.fillStyle='#a9adb8';x.fillRect(0,0,w,h);x.fillStyle='#7c808c';for(var i2=0;i2<8;i2++)x.fillRect(0,i2*8,w,3);});
      var santamaria=new T.Mesh(new T.BoxGeometry(8,5.5,.15),new T.MeshToonMaterial({map:rejaT,gradientMap:gm}));santamaria.position.set(0,2.75,ZF+.4);santamaria.castShadow=true;S3.add(santamaria);
      var rollo=M(new T.CylinderGeometry(.35,.35,8.2,10),'#7c808c',{g:.04});rollo.rotation.z=Math.PI/2;rollo.position.set(0,5.75,ZF+.5);S3.add(rollo);
      var rotP=cartel('DEPÓSITO','#2a2a34','#ffd23f',3.6,.8);rotP.position.set(0,6.6,ZF+.32);S3.add(rotP);
      var letrero=cartel('AUTOMERCADO EL PANA','#d63a2f','#fffdf2',14,1.6);letrero.position.set(-21,6.4,ZF+.32);S3.add(letrero);
      /* el reloj de pared */
      var reloj=new T.Group();reloj.position.set(21,6.4,ZF+.35);S3.add(reloj);
      var esf=M(new T.CylinderGeometry(.9,.9,.12,20),'#fffdf2',{g:.06});esf.rotation.x=Math.PI/2;reloj.add(esf);
      var agH=new T.Mesh(new T.BoxGeometry(.08,.55,.05),tn('#14101c'));agH.geometry.translate(0,.25,0);agH.position.z=.08;reloj.add(agH);
      var agM=new T.Mesh(new T.BoxGeometry(.05,.78,.05),tn('#d63a2f'));agM.geometry.translate(0,.36,0);agM.position.z=.1;reloj.add(agM);
      /* góndolas: las del fondo y las de los lados (ahí reponen la harina) */
      function gondola(x,z,w,h,rot,lleno,sem,rotulo,colR){
        var g3=new T.Group();g3.position.set(x,0,z);g3.rotation.y=rot;S3.add(g3);
        var fondo=M(new T.BoxGeometry(w,h,.25),'#c9ccd4',{recibe:true,g:.02});fondo.position.set(0,h/2,-.45);g3.add(fondo);
        var pr=new T.Mesh(new T.PlaneGeometry(w-.2,h-.4),new T.MeshToonMaterial({map:texProd(lleno,sem),gradientMap:gm}));pr.position.set(0,.3+(h-.4)/2,-.31);g3.add(pr);
        for(var i2=0;i2<4;i2++){var tb=M(new T.BoxGeometry(w,.1,1),'#9aa0ae',{recibe:true,g:.03});tb.position.set(0,.25+i2*(h-.4)/3,0);g3.add(tb);}
        [-1,1].forEach(function(sx){var la=M(new T.BoxGeometry(.14,h,1.1),'#b9bdc8',{recibe:true,g:.02});la.position.set(sx*w/2,h/2,-.05);g3.add(la);});
        var zo=M(new T.BoxGeometry(w,.3,1),colR||'#d63a2f',{borde:false,recibe:true});zo.position.y=.15;g3.add(zo);
        if(rotulo){var cr=cartel(rotulo,colR||'#d63a2f','#fffdf2',Math.min(w*.8,6),.75);cr.position.set(0,h+.55,-.3);g3.add(cr);
          var mc=M(new T.BoxGeometry(Math.min(w*.8,6)+.15,.88,.08),'#14101c',{borde:false});mc.position.set(0,h+.55,-.36);g3.add(mc);}
        return g3;
      }
      gondola(-23.5,ZF+1.2,8,3.8,0,true,7,'ACEITE','#2a9d8f');
      gondola(-19.2,-4.3,8,3.6,Math.PI/2,true,13,'HARINA · REPONIENDO','#f2b705');
      gondola(-19.2,4.2,8,3.6,Math.PI/2,true,29,null,'#f2b705');
      gondola(19.2,-4.3,8,3.6,-Math.PI/2,true,41,'HARINA · REPONIENDO','#f2b705');
      gondola(19.2,4.2,8,3.6,-Math.PI/2,true,53,null,'#f2b705');
      /* los reponedores de los lados (cosmético; la bolsa aparece donde dice el calendario) */
      var ids=V3.PJ.ids();
      var repo=[];
      [[-16.9,1],[16.9,-1]].forEach(function(r,i2){var rp=V3.PJ.crear(ids[(i2*3+2)%ids.length],{prop:false,escala:1.1});rp.g.position.set(r[0],0,0);rp.g.rotation.order='YXZ';S3.add(rp.g);repo.push({pj:rp,lado:r[1],z:0,zd:0,cd:0,iw:1+i2,box:false});});
      /* la nevera de refrigerados (de noche brilla) */
      var nev=M(new T.BoxGeometry(6.4,4.4,1.4),'#e8eef2',{recibe:true,g:.02});nev.position.set(19.6,2.2,ZF+1.1);S3.add(nev);
      var vidrio=new T.Mesh(new T.BoxGeometry(5.8,3.4,.1),tn('#bfe9ff',{em:'#8fdcff',emI:pl.noche?1.2:.3}));vidrio.position.set(19.6,2.3,ZF+1.82);S3.add(vidrio);
      var rotN=cartel('REFRIGERADOS','#3fa9ff','#fffdf2',4,.6);rotN.position.set(19.6,4.75,ZF+1.82);S3.add(rotN);
      /* las DOS cajas: la abierta tiene luz verde y anillo en el piso */
      var cajas=[];
      for(k=0;k<2;k++){
        var cxw=WX(CAJAS[k][0]),czw=WZ(AY0)-1.5,gC=new T.Group();gC.position.set(cxw,0,czw);S3.add(gC);
        var caja=M(new T.BoxGeometry(3,1.3,1.3),'#d63a2f',{recibe:true,g:.03});caja.position.y=.65;gC.add(caja);
        var tope=M(new T.BoxGeometry(3.2,.12,1.5),'#efe8d2',{recibe:true,g:.03});tope.position.y=1.36;gC.add(tope);
        var regi=M(new T.BoxGeometry(.9,.6,.7),'#2a2a34',{g:.04});regi.position.set(-.8,1.72,0);gC.add(regi);
        var poste=M(new T.CylinderGeometry(.05,.05,3.4,6),'#2a2a34',{borde:false});poste.position.set(1.1,2.9,-.3);gC.add(poste);
        var rotC=cartel('CAJA '+(k+1),'#ffd23f','#14101c',1.8,.55);rotC.position.set(1.1,4.3,-.25);gC.add(rotC);
        var lampM=tn('#5cff7a',{em:'#5cff7a',emI:.9,nuevo:true});
        var lamp=new T.Mesh(new T.SphereGeometry(.32,10,8),lampM);lamp.position.set(1.1,4.85,-.25);gC.add(lamp);
        var anillo=new T.Mesh(new T.RingGeometry(CAJA_R*ESX-.25,CAJA_R*ESX,32),new T.MeshBasicMaterial({color:0x5cff7a,transparent:true,opacity:.6,depthWrite:false}));
        anillo.rotation.x=-Math.PI/2;anillo.scale.set(1,ESZ/ESX,1);anillo.position.set(cxw,.04,WZ(CAJAS[k][1]));S3.add(anillo);
        var disco=new T.Mesh(new T.CircleGeometry(CAJA_R*ESX-.25,32),new T.MeshBasicMaterial({color:0x5cff7a,transparent:true,opacity:.15,depthWrite:false}));
        disco.rotation.x=-Math.PI/2;disco.scale.set(1,ESZ/ESX,1);disco.position.set(cxw,.035,WZ(CAJAS[k][1]));S3.add(disco);
        cajas.push({g:gC,lampM:lampM,anillo:anillo,disco:disco,x:cxw,z:czw});
      }
      /* la cola desde las 4 a.m. (a la izquierda de la caja 1) */
      for(k=0;k<3;k++){var pz=M(new T.CylinderGeometry(.08,.12,1.1,8),'#c9ccd4',{g:.05});pz.position.set(-16.2-k*2.1,.55,-9.4);S3.add(pz);}
      var cuerda=new T.Mesh(new T.CylinderGeometry(.04,.04,4.2,6),tn('#d63a2f'));cuerda.rotation.z=Math.PI/2;cuerda.position.set(-18.3,1,-9.4);S3.add(cuerda);
      var rotCola=cartel('COLA DESDE LAS 4 A.M.','#fffdf2','#14101c',3.4,.55);rotCola.position.set(-18.3,1.6,-9.34);S3.add(rotCola);
      /* tubos fluorescentes colgando */
      var tubos=[];
      for(k=0;k<4;k++){
        var tb2=new T.Mesh(new T.BoxGeometry(3.2,.18,.3),tn('#fffdf2',{em:'#fffbe6',emI:pl.noche?1.5:.35,nuevo:true}));tb2.position.set(-15+k*10,6.3,-10.6);S3.add(tb2);tubos.push(tb2);
        for(var w2=-1;w2<=1;w2+=2){var cab=new T.Mesh(new T.BoxGeometry(.03,1.7,.03),tn('#2a2a34'));cab.position.set(-15+k*10+w2*1.2,7.2,-10.6);S3.add(cab);}
      }
      /* letreros colgantes (se mecen) */
      var colg=[];
      [[-9,'¡OFERTA!','#ff5c8a'],[9,'LÍMITE: 3 POR PERSONA','#d63a2f']].forEach(function(r){
        var g3=new T.Group();g3.position.set(r[0],7.6,-1.5);S3.add(g3);
        var cr=cartel(r[1],r[2],'#fffdf2',3.6,.8);cr.position.y=-1.1;g3.add(cr);
        var hilo=new T.Mesh(new T.BoxGeometry(.03,.75,.03),tn('#2a2a34'));hilo.position.y=-.35;g3.add(hilo);
        colg.push(g3);
      });
      /* el ventilador de pared */
      var vent=new T.Group();vent.position.set(-6.6,5.6,ZF+.6);S3.add(vent);
      var motor=M(new T.SphereGeometry(.3,8,6),'#c9ccd4',{g:.05});vent.add(motor);
      var aspas=new T.Group();aspas.position.z=.2;vent.add(aspas);
      for(k=0;k<3;k++){var asp=M(new T.BoxGeometry(.32,1.1,.04),'#3fa9ff',{g:.05});asp.geometry.translate(0,.6,0);asp.rotation.z=k*2.094;aspas.add(asp);}
      if(pl.noche){
        [[-8,7.5,-2],[8,7.5,-2]].forEach(function(r){var luz=new T.PointLight(0xcfe8ff,1.1,24,2);luz.position.set(r[0],r[1],r[2]);S3.add(luz);});
      }
      /* el camión de Harina P.A.N. (entra de retroceso por el portón) */
      var camion=new T.Group();camion.position.set(0,0,ZF-30);S3.add(camion);
      var cajaC=M(new T.BoxGeometry(4.6,3.6,7),'#f3f3f6',{g:.02});cajaC.position.set(0,2.5,0);camion.add(cajaC);
      var cabC=M(new T.BoxGeometry(4.6,2.8,2.4),'#d63a2f',{g:.02});cabC.position.set(0,2,-4.8);camion.add(cabC);
      var logo=cartel('HARINA P.A.N.','#f2b705','#c0392b',4,1.2);logo.position.set(0,3,3.52);camion.add(logo);
      var ruedasC=[];
      [[-2.3,2],[2.3,2],[-2.3,-3.8],[2.3,-3.8]].forEach(function(r){var ru=M(new T.CylinderGeometry(.7,.7,.5,12),'#2a2a34',{g:.04});ru.rotation.z=Math.PI/2;ru.position.set(r[0],.7,r[1]);camion.add(ru);ruedasC.push(ru);});
      var faroC=[];
      [-1.6,1.6].forEach(function(xx){var fa=new T.Mesh(new T.BoxGeometry(.6,.35,.1),tn('#ff3b4e',{em:'#ff3b4e',emI:.9}));fa.position.set(xx,1.1,3.52);camion.add(fa);faroC.push(fa);});

      /* los jugadores (cada uno con su torre de hasta 3 bolsas en la cabeza) */
      var usados={},pjs=[];
      for(k=0;k<n;k++){
        var seat=c.seats&&c.seats[k]||{},ch=seat.ch&&V3.PJ.ELENCO[seat.ch]?seat.ch:ids[k%ids.length];usados[ch]=1;
        var pj=V3.PJ.crear(ch,{prop:false,escala:1.35});pj.g.rotation.order='YXZ';S3.add(pj.g);
        var aro=new T.Mesh(new T.RingGeometry(.75,.95,20),new T.MeshBasicMaterial({color:seat.color||CONF3[k%CONF3.length],transparent:true,opacity:.85}));
        aro.rotation.x=-Math.PI/2;aro.position.y=.04;S3.add(aro);
        var est=new T.Group();S3.add(est);
        for(var e2=0;e2<3;e2++){var es=M(new T.OctahedronGeometry(.2,0),'#ffe14d',{g:.08});es.position.set(Math.cos(e2*2.094)*.75,0,Math.sin(e2*2.094)*.75);est.add(es);}
        est.visible=false;
        var torre=new T.Group();S3.add(torre);var pila=[];
        for(e2=0;e2<MAXC;e2++){var bm=bolsaMesh();bm.g.scale.setScalar(.72);bm.g.position.y=e2*1.02;bm.g.rotation.y=(e2-1)*.25;torre.add(bm.g);bm.g.visible=false;pila.push(bm);}
        var pp=posOf(k);
        pjs.push({pj:pj,aro:aro,est:est,torre:torre,pila:pila,x:WX(pp.x),z:WZ(pp.y),px:WX(pp.x),pz:WZ(pp.y),rumbo:0,ptsC:0,polvo:0,dashV:0,fz:null,cai:null,bend:null,tamb:null});
      }
      /* los cajeros (uno por caja) y la gente de la cola */
      var libres=[];for(k=0;k<ids.length;k++)if(!usados[ids[k]]&&ids[k]!=='abuela')libres.push(ids[k]);
      for(k=0;libres.length<5;k++)libres.push(ids[k%ids.length]);
      var npcs=[];
      for(k=0;k<2;k++){var pjC=V3.PJ.crear(k===0&&libres.indexOf('portu')>=0?'portu':libres[k],{prop:false,escala:1.2});pjC.g.position.set(cajas[k].x-.3,0,cajas[k].z-1.3);pjC.g.rotation.order='YXZ';S3.add(pjC.g);npcs.push({pj:pjC,r:0,a:'quieto',cara:'normal',cd:1,cajero:k+1,esc:0,bx:cajas[k].x-.3,bz:cajas[k].z-1.3});}
      for(k=0;k<3;k++){var pn=V3.PJ.crear(libres[2+k],{prop:false,escala:1.2});pn.g.position.set(-17.2-k*1.75,0,-10.6);pn.g.rotation.order='YXZ';S3.add(pn.g);npcs.push({pj:pn,r:Math.PI/2,a:'quieto',cara:'enojado',cd:.5+k,cajero:0,bx:-17.2-k*1.75,bz:-10.6});}
      /* las bolsas del piso (pool) con su chispero dorado */
      var bolsas=[];
      for(k=0;k<NB;k++){
        var b3=bolsaMesh();S3.add(b3.g);b3.g.visible=false;b3.g.scale.setScalar(1.1);
        var halo=new T.Mesh(new T.SphereGeometry(1.1,14,10),new T.MeshBasicMaterial({color:0xfff59a,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));halo.position.y=.65;b3.g.add(halo);
        b3.halo=halo;b3.pop=1;bolsas.push(b3);
      }
      /* charcos de piso mojado (con su cono amarillo) y el foco de la oferta */
      var charcos=[];
      for(k=0;k<2;k++){
        var ch3=new T.Mesh(new T.CircleGeometry(58*ESX,24),new T.MeshBasicMaterial({color:0x7fd6ff,transparent:true,opacity:0,depthWrite:false}));ch3.rotation.x=-Math.PI/2;ch3.scale.set(1,ESZ/ESX*.95,1);ch3.position.y=.045;ch3.visible=false;S3.add(ch3);
        var cono=new T.Group();S3.add(cono);
        var cn=M(new T.ConeGeometry(.45,1.4,4),'#ffd23f',{g:.06});cn.position.y=.7;cono.add(cn);
        var cb=M(new T.BoxGeometry(1,.1,1),'#ffd23f',{g:.05});cb.position.y=.05;cono.add(cb);
        var cc=cartel('PISO MOJADO','#ffd23f','#14101c',1.6,.4);cc.position.set(0,1.75,0);cono.add(cc);
        cono.visible=false;charcos.push({m:ch3,cono:cono});
      }
      var foco=new T.Mesh(new T.CylinderGeometry(.6,1.6,9,16,1,true),new T.MeshBasicMaterial({color:0xfff6c0,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));foco.visible=false;S3.add(foco);
      /* los carritos (dos: en ¡ÚLTIMOS SEGUNDOS! cruzan dos a la vez) y, de noche, la señora empuja el primero */
      var carros=[carrito3D(S3,M,tn),carrito3D(S3,M,tn)];
      var vieja=null;if(lv>=3){vieja=V3.PJ.crear('abuela',{prop:false,escala:1.3});vieja.g.visible=false;S3.add(vieja.g);}
      /* la gente del super: cuatro clientes en el frente, una señora empujando su carrito y el limpiador con el trapero */
      var clientes=[];
      for(k=0;k<4;k++){
        var cl3=V3.PJ.crear(ids[(k*3+4)%ids.length],{prop:false,escala:1.2});cl3.g.rotation.order='YXZ';S3.add(cl3.g);
        var cx0=(k<2?-1:1)*17.8,cz0=-5+(k%2)*6;
        clientes.push({pj:cl3,x:cx0,z:cz0,tx:cx0,tz:cz0,cd:.5+k*.6,rum:Math.PI});
      }
      var sraPJ=V3.PJ.crear('mama',{prop:false,escala:1.25});sraPJ.g.rotation.order='YXZ';S3.add(sraPJ.g);
      var cartS=carrito3D(S3,M,tn);cartS.g.visible=true;
      var sra={pj:sraPJ,cart:cartS,x:-6,z:-12.3,dir:1,cd:0};
      var limpPJ=V3.PJ.crear('tio',{prop:false,escala:1.2});limpPJ.g.rotation.order='YXZ';S3.add(limpPJ.g);
      var trapero=new T.Group(),palo=new T.Mesh(new T.CylinderGeometry(.04,.04,1.7,6),tn('#9a7040'));
      palo.position.y=.8;trapero.add(palo);
      var cabT=M(new T.BoxGeometry(.6,.14,.3),'#e9e4d8',{g:.04});cabT.position.y=.1;trapero.add(cabT);
      limpPJ.mano('der').add(trapero);
      var limp={pj:limpPJ,x:-17.8,z:-8.4,rum:0,mop:trapero};
      var flecha=M(new T.ConeGeometry(.35,.7,4),'#ffd23f',{g:.1});flecha.rotation.x=Math.PI;flecha.visible=false;S3.add(flecha);
      var part=V3.particulas(esc,700);
      esc.encuadrar(37,24,new T.Vector3(0,1.5,-1.3),.78);
      return {esc:esc,pjs:pjs,npcs:npcs,clientes:clientes,sra:sra,limp:limp,bolsas:bolsas,charcos:charcos,foco:foco,carros:carros,vieja:vieja,cajas:cajas,repo:repo,flecha:flecha,part:part,tubos:tubos,colg:colg,aspas:aspas,agH:agH,agM:agM,
        camion:camion,ruedasC:ruedasC,faroC:faroC,santa:santamaria,camT:-1,alegria:0,chisme:0,fin:0,noche:pl.noche,polvoT:0,
        hemi0:pl.hemi[2],sol0:pl.sol[1],solC:new T.Color(pl.sol[0]),rojo:new T.Color('#ff7a5a'),vol:[]};
    }
    function envCaida(u){                                 /* 0..1: cae rápido, se queda en el piso y se levanta */
      if(u<.22){var a=u/.22;return 1-(1-a)*(1-a);}
      if(u<.7)return 1;
      var b=(u-.7)/.3;return 1-b*b*(3-2*b);
    }
    function actualizar3D(dt,now){
      var T=THREE,V=v3,t=at,p,k,j,fin=now>=c.dur-.2,fz=fase(st.k);
      V.part.update(dt);
      V.aspas.rotation.z-=dt*(fz===2?20:9);V.agM.rotation.z=-t*(fz===2?4:1.2);V.agH.rotation.z=-t*.1;
      for(k=0;k<V.colg.length;k++){V.colg[k].rotation.z=Math.sin(t*1.3+k*2)*(fz===2?0.18:.07);V.colg[k].rotation.x=Math.sin(t*.9+k)*.05;}
      /* luz por fase: en ¡ÚLTIMOS SEGUNDOS! late roja y los tubos parpadean */
      var pul=Math.abs(Math.sin(t*6));
      if(fz===2){
        V.esc.luces.sol.color.copy(V.solC).lerp(V.rojo,.35+.3*pul);V.esc.luces.sol.intensity=V.sol0*(.85+.2*pul);
        for(k=0;k<V.tubos.length;k++)V.tubos[k].material.emissiveIntensity=((Math.floor(t*8)+k)%2)?1.6:.2;
      }else{
        V.esc.luces.sol.color.copy(V.solC);V.esc.luces.sol.intensity=V.sol0;
        if(V.noche){var fl=V.tubos[1].material;fl.emissiveIntensity=(Math.sin(t*23)>.6||fx()<.04)?0.15:1.5;}
      }
      V.polvoT-=dt;if(V.polvoT<0){V.polvoT=.5;V.part.soltar((fx()-.5)*30,6,(fx()-.5)*14-3,1,{k:'chispa',cols:['#fffbe6'],vel:.2,arriba:.1,g:.15,vida:4,esc:.4});}
      V.alegria=Math.max(0,V.alegria-dt);V.chisme=Math.max(0,V.chisme-dt);
      /* el camión */
      if(V.camT>=0){
        var u=t-V.camT,ks=u<.6?u/.6:(u<4.4?1:Math.max(0,1-(u-4.4)/.6));
        V.santa.scale.y=1-ks*.92;V.santa.position.y=5.5-5.5*(1-ks*.92)/2;
        var zc=u<1.2?(ZF-30)+(u/1.2)*(30-4.2):(u<3.4?ZF-4.2:(ZF-4.2)-(u-3.4)*14);
        var vz=V.camion.position.z;V.camion.position.z=zc;
        for(k=0;k<V.ruedasC.length;k++)V.ruedasC[k].rotation.x+=(zc-vz)/.7;
        for(k=0;k<V.faroC.length;k++)V.faroC[k].visible=!!(u>3.4||Math.floor(t*6)%2);
        if(u>5.2){V.camT=-1;V.santa.scale.y=1;V.santa.position.y=2.75;V.camion.position.z=ZF-30;}
      }
      /* las cajas */
      var ab=cajaAbierta(st.k),cambio=cajaProxima(st.k),blink=cambio&&Math.sin(t*20)>0;
      for(k=0;k<2;k++){
        var C3=V.cajas[k],op=k===ab;
        C3.lampM.color.set(op!==blink?'#5cff7a':'#ff3b4e');C3.lampM.emissive.set(op!==blink?'#5cff7a':'#ff3b4e');
        C3.anillo.material.color.set(op?0x5cff7a:0x8a8a92);C3.anillo.material.opacity=op?0.55+.3*Math.abs(Math.sin(t*4)):(blink?0.5:.2);
        C3.disco.material.opacity=op?(fz===2?0.22+.12*pul:.14):0;
      }
      /* jugadores: la pose sale de lo que les pasa (caída, forcejeo, golpe, carga) y encima va el peso, el agacharse y el tambaleo */
      var mejor=-1,mp2=-1;for(p=0;p<n;p++){var up=st.p[p].pts;if(up>mp2){mp2=up;mejor=p;}}
      if(fin&&!V.fin&&now>0){V.fin=1;V3.sfx('aplauso');var sw=V.pjs[mejor];V.part.soltar(sw.x,5,sw.z,40,{k:'confeti',cols:CONF3,vel:4,arriba:6,g:6,vida:1.6});}
      for(p=0;p<n;p++){
        var s3=V.pjs[p],pp=posOf(p),pl=st.p[p];
        s3.x=WX(pp.x);s3.z=WZ(pp.y);
        var vx0=(s3.x-s3.px)/Math.max(dt,1e-3),vz0=(s3.z-s3.pz)/Math.max(dt,1e-3),ka=Math.min(1,dt*6);s3.svx=(s3.svx||0)+(vx0-(s3.svx||0))*ka;s3.svz=(s3.svz||0)+(vz0-(s3.svz||0))*ka;var vx=s3.svx,vz2=s3.svz,v=Math.sqrt(vx*vx+vz2*vz2);s3.px=s3.x;s3.pz=s3.z;
        var stun=pl.stun>0,lleva=pl.nb>0,vn=Math.min(1,v/9),pj=s3.pj,rx=0,rz=0,ox=0,oz=0,cara,pose,uq,ca=s3.cai,tug=s3.fz;
        if(v>1.2&&!stun)s3.rumbo=Math.atan2(vx,vz2);
        /* caída (empujón, carrito o piso mojado): se tumba hacia donde lo tiró el golpe, queda en el piso y se levanta */
        if(ca){
          ca.t+=dt;uq=Math.min(1,ca.t/ca.d);
          var ef=envCaida(uq);rx+=ca.ax*ef;rz+=ca.az*ef;ox+=ca.sx*Math.sin(uq*Math.PI);oz+=ca.sz*Math.sin(uq*Math.PI);
          if(ca.t>=ca.d||(ca.t>.25&&!pj.volando))s3.cai=null;
        }
        /* forcejeo: el ladrón y la víctima tiran de la misma bolsa y se sacuden */
        if(tug){tug.t+=dt;if(tug.t>=tug.d)s3.fz=null;if(!ca){var sh=Math.sin(t*34+p*2)*.06;ox+=sh;oz+=sh*.4;}}
        /* agacharse a recoger una bolsa, y tambaleo al ganar o perder una */
        if(s3.bend){s3.bend.t+=dt;uq=Math.min(1,s3.bend.t/s3.bend.d);rx+=.42*Math.sin(uq*Math.PI);if(s3.bend.t>=s3.bend.d)s3.bend=null;}
        if(s3.tamb){s3.tamb.t+=dt;uq=Math.min(1,s3.tamb.t/s3.tamb.d);rz+=s3.tamb.a*Math.sin(uq*Math.PI*3)*(1-uq);if(s3.tamb.t>=s3.tamb.d)s3.tamb=null;}
        /* peso: con cada bolsa se va más hacia adelante y se bambolea al caminar */
        if(lleva&&!ca){rx+=.035*pl.nb;rz+=Math.sin(t*(3+pl.nb*1.6)+p)*.035*pl.nb;}
        if(stun&&!ca&&!tug)rz+=Math.sin(t*9+p)*.09;
        if(fin&&now>0){pose=p===mejor?'celebrar':'triste';cara=p===mejor?'feliz':'triste';}
        else if(ca){pose='quieto';cara=ca.kind==='carro'?'susto':'mareado';}
        else if(tug){pose=tug.rol?'empujar':'empujado';cara=tug.rol?'concentrado':'enojado';}
        else if(stun){pose='mareado';cara='mareado';}
        else if(s3.bend){pose='agacharse';cara='concentrado';}
        else if(pl.dsh>0){pose='empujar';cara='enojado';}
        else if(lleva){pose='cargar';cara=pl.nb>=MAXC?'susto':(pl.inv>0?'enojado':'feliz');}
        else{var mv=s3.mov||0;if(mv===0&&v>1.3)mv=1;else if(mv>=1&&v<.6)mv=0;if(mv===1&&v>5)mv=2;else if(mv===2&&v<3.5)mv=1;s3.mov=mv;pose=mv===2?'correr':(mv===1?'caminar':'quieto');cara='concentrado';}
        pj.anim(pose,{vel:pose==='empujar'?1:vn}).cara(cara);
        if(tug){var ot=V.pjs[tug.con];pj.rumbo(Math.atan2(ot.x-s3.x,ot.z-s3.z));}
        else pj.rumbo(s3.rumbo);
        pj.update(dt);
        pj.g.rotation.x=rx;pj.g.rotation.z=rz;
        pj.g.position.set(s3.x+ox,0,s3.z+oz);
        s3.aro.position.set(s3.x,.04,s3.z);
        s3.aro.material.opacity=pl.inv>0?(.3+.5*Math.abs(Math.sin(t*14))):.85;
        s3.est.visible=!!(stun&&!fin);if(s3.est.visible){s3.est.position.set(s3.x,4.3,s3.z);s3.est.rotation.y=t*6;}
        /* la torre de bolsas sobre la cabeza (se bambolea más mientras más cargas) */
        s3.torre.position.set(s3.x+ox,4.1,s3.z+oz);s3.torre.rotation.y=s3.rumbo;
        s3.torre.rotation.z=lleva?Math.sin(t*(4+pl.nb*2))*.05*pl.nb:0;
        for(k=0;k<MAXC;k++){var bm=s3.pila[k];bm.g.visible=k<pl.nb;if(k<pl.nb)ponOro(bm,k>=pl.nb-pl.ng);}
        if((v>5||pl.dsh>0)&&!stun){s3.polvo-=dt;if(s3.polvo<0){s3.polvo=pl.dsh>0?0.05:.22;V.part.soltar(s3.x,.1,s3.z,pl.dsh>0?3:1,{k:'gota',cols:['#d9ccb0','#ffffff'],vel:.6,arriba:.6,g:3,vida:.4,esc:.6});}}
      }
      /* bolsas del piso */
      for(j=0;j<NB;j++){
        var b=st.b[j],B3=V.bolsas[j];
        B3.g.visible=!!b.kd;
        if(!b.kd)continue;
        ponOro(B3,b.kd===2);
        B3.pop=Math.min(1,B3.pop+dt*4);
        var sc=1.1*(B3.pop<1?(1-Math.pow(1-B3.pop,3))*1.0+Math.sin(B3.pop*Math.PI)*.25:1);
        B3.g.scale.setScalar(Math.max(.05,sc));
        B3.g.position.set(WX(b.x),.06+Math.abs(Math.sin(t*3+j))*.2,WZ(b.y));
        B3.g.rotation.y=t*.8+j;
        B3.halo.material.opacity=b.kd===2?0.18+.14*pul:0;
        if(b.kd===2&&fx()<dt*6)V.part.soltar(B3.g.position.x,1.6,B3.g.position.z,1,{k:'chispa',cols:ORO,vel:1,arriba:1.5,g:1,vida:.6,esc:.7});
      }
      bagMats().oro[0].emissiveIntensity=bagMats().oro[1].emissiveIntensity=.3+.35*pul;
      /* eventos activos: carritos, charcos, foco de la oferta */
      var act=evActivos(st.k),ea,E,rel,warn,nc=0,nw=0,focoOn=false,limpE=null;
      for(k=0;k<2;k++){V.carros[k].g.visible=false;V.carros[k].franja.visible=false;V.carros[k].flecha.visible=false;V.charcos[k].m.visible=false;V.charcos[k].cono.visible=false;}
      if(V.vieja)V.vieja.g.visible=false;
      for(ea=0;ea<act.length;ea++){
        E=act[ea].E;rel=act[ea].rel+Math.min(1,Math.max(0,(at-V.kAt)*TK));warn=rel<E.w;
        if(E.tipo==='mojado')limpE=E;
        if(E.tipo==='carro'){
          if(warn)V.chisme=Math.max(V.chisme,.8);
          var lanes=[[E.ly,E.dir]];if(E.ly2>0)lanes.push([E.ly2,-E.dir]);
          for(var L=0;L<lanes.length&&nc<2;L++,nc++){
            var CR=V.carros[nc],dir=lanes[L][1],zs=WZ(lanes[L][0]);
            var xs=warn?WX(dir>0?AX0-70:AX1+70):WX(cartX(E,rel,dir));
            CR.franja.visible=true;CR.franja.position.set((x0f()+x1f())/2,.035,zs);CR.franja.material.opacity=warn?0.22+.22*Math.abs(Math.sin(t*11)):.12;
            CR.flecha.visible=!!warn;CR.flecha.position.set(WX(dir>0?AX0+30:AX1-30),.9,zs);CR.flecha.rotation.set(0,0,dir>0?-Math.PI/2:Math.PI/2);
            CR.g.visible=true;CR.g.position.set(xs+dir*1.4,0,zs);CR.g.rotation.y=dir>0?0:Math.PI;
            for(k=0;k<CR.ruedas.length;k++)CR.ruedas[k].rotation.z=warn?0:t*14;
            if(!warn&&fx()<dt*10)V.part.soltar(xs,.2,zs,1,{k:'gota',cols:['#d9ccb0'],vel:.8,arriba:.4,g:3,vida:.3});
            if(nc===0&&V.vieja){V.vieja.g.visible=true;V.vieja.g.position.set(xs-dir*.6,0,zs);V.vieja.anim(warn?'quieto':'empujar',{vel:1}).cara(warn?'concentrado':'enojado').rumbo(dir>0?Math.PI/2:-Math.PI/2).update(dt);}
          }
        }else if(E.tipo==='mojado'&&nw<2){
          var CH=V.charcos[nw++],gr=warn?rel/E.w:Math.min(1,(E.w+E.d-rel)/12);
          CH.m.visible=true;CH.m.position.set(WX(E.x),.045,WZ(E.y));CH.m.material.opacity=warn?0.15+.2*Math.abs(Math.sin(t*12)):.42*gr;
          CH.m.scale.set(Math.max(.1,warn?gr:1),Math.max(.1,warn?gr:1)*ESZ/ESX*.95,1);
          CH.cono.visible=true;CH.cono.position.set(WX(E.x)+2.6,0,WZ(E.y)-1.2);
        }else if(E.tipo==='oferta'&&warn){
          focoOn=true;V.foco.position.set(WX(E.x),4.5,WZ(E.y));V.foco.material.opacity=.15+.15*Math.abs(Math.sin(t*14));
        }
      }
      V.foco.visible=focoOn;
      /* reponedores: se pasean por su anaquel (a veces con una caja) y van a donde aparece la siguiente bolsa */
      for(k=0;k<V.repo.length;k++){
        var R=V.repo[k],mv=R.zd-R.z;
        R.iw-=dt;
        if(R.iw<=0&&Math.abs(mv)<.3){R.iw=3+fx()*3;R.zd=(fx()-.5)*12;R.box=fx()<.5;mv=R.zd-R.z;}
        R.z+=Math.max(-2.2*dt,Math.min(2.2*dt,mv));mv=R.zd-R.z;
        var anda=Math.abs(mv)>.25;
        R.pj.g.position.set(R.lado>0?-16.9:16.9,0,R.z);
        R.pj.anim(anda?(R.box?'cargar':'caminar'):'quieto',{vel:.6}).cara(anda?'normal':'concentrado').rumbo(anda?(mv>0?0:Math.PI):R.lado*Math.PI/2).update(dt);
      }
      /* cajeras y cola: la cajera abierta escanea y saluda a quien cobra; la cerrada duerme. La cola avanza y se impacienta */
      for(k=0;k<V.npcs.length;k++){
        var nn=V.npcs[k];nn.cd-=dt;
        if(nn.cajero){
          if(nn.cajero-1!==ab)nn.pj.anim('sentado').cara('dormido');
          else if(V.alegria>0)nn.pj.anim('saludar').cara('feliz');
          else{nn.esc=(nn.esc||0)-dt;if(nn.esc<=0){nn.esc=1.1+fx()*.9;nn.pj.uno('lanzar');}nn.pj.anim('quieto').cara('concentrado');}
          nn.pj.rumbo(0).update(dt);
          continue;
        }
        var ph=t*.45+k*1.3,ox2=(Math.sin(ph)+1)*.35,andaC=Math.cos(ph)>.2;
        nn.pj.g.position.set(nn.bx+ox2,0,nn.bz);
        if(V.alegria>0)nn.pj.anim('celebrar').cara('feliz');
        else if(V.chisme>0)nn.pj.anim('quieto').cara('susto');
        else if(fz===2)nn.pj.anim('bailar').cara('enojado');
        else nn.pj.anim(andaC?'caminar':'quieto',{vel:.4}).cara(nn.cara);
        nn.pj.mirar(Math.sin(t*.8+k*2)*.7,0).rumbo(Math.PI/2).update(dt);
      }
      /* la gente del frente: se pasean, se paran a mirar el juego y se asustan con los carritos */
      var asusta=V.chisme>0;
      for(k=0;k<V.clientes.length;k++){
        var cl=V.clientes[k],ddx=cl.tx-cl.x,ddz=cl.tz-cl.z,dl=Math.sqrt(ddx*ddx+ddz*ddz),andC=false;
        if(cl.cd>0)cl.cd-=dt;
        else if(dl<=.12){cl.cd=1.5+fx()*3;cl.tx=cl.x;cl.tz=-7+fx()*14;}
        else if(!asusta){var spc=Math.min(dl,.8*dt);cl.x+=ddx/dl*spc;cl.z+=ddz/dl*spc;cl.rum=Math.atan2(ddx,ddz);andC=true;}
        cl.pj.g.position.set(cl.x,0,cl.z);
        if(V.alegria>0)cl.pj.anim('celebrar').cara('feliz');
        else if(asusta)cl.pj.anim('quieto').cara('susto');
        else if(fz===2)cl.pj.anim('bailar').cara('enojado');
        else if(andC)cl.pj.anim('caminar',{vel:.7}).cara('normal');
        else cl.pj.anim('quieto').cara(cl.cd>0?'concentrado':'normal');
        cl.pj.rumbo(andC?cl.rum:Math.PI).mirar(Math.sin(t*.7+k*2)*.8,0).update(dt);
      }
      /* la señora con su carrito: cruza el frente empujándolo y se para un rato al llegar a un lado */
      var sr=V.sra;
      if(sr.cd>0)sr.cd-=dt;
      else{sr.x+=sr.dir*1.1*dt;if(Math.abs(sr.x)>15){sr.dir=-sr.dir;sr.cd=2.2;}}
      var rodS=sr.cd<=0;
      sr.cart.g.position.set(sr.x,0,sr.z);sr.cart.g.rotation.y=sr.dir>0?0:Math.PI;
      for(k=0;k<sr.cart.ruedas.length;k++)sr.cart.ruedas[k].rotation.z=rodS?t*sr.dir*6:0;
      sr.pj.g.position.set(sr.x-sr.dir*1.9,0,sr.z);
      if(rodS)sr.pj.anim('empujar',{vel:.6}).cara('normal').rumbo(sr.dir>0?Math.PI/2:-Math.PI/2).update(dt);
      else sr.pj.anim('quieto').cara('feliz').rumbo(sr.dir>0?Math.PI/2:-Math.PI/2).update(dt);
      /* el limpiador: cuando hay piso mojado va a secarlo con el trapero, y después vuelve a su rincón */
      var lp=V.limp,tgx=-17.8,tgz=-8.4;
      if(limpE){tgx=WX(limpE.x)-.5;tgz=WZ(limpE.y)+2.9;}
      var ldx=tgx-lp.x,ldz=tgz-lp.z,ldl=Math.sqrt(ldx*ldx+ldz*ldz),lan=false;
      if(ldl>.1){var spl=Math.min(ldl,1.5*dt);lp.x+=ldx/ldl*spl;lp.z+=ldz/ldl*spl;lan=true;lp.rum=Math.atan2(ldx,ldz);}
      lp.pj.g.position.set(lp.x,0,lp.z);
      if(limpE&&!lan)lp.pj.anim('empujar',{vel:.45}).cara('concentrado').rumbo(Math.atan2(WX(limpE.x)-lp.x,WZ(limpE.y)-lp.z)).update(dt);
      else lp.pj.anim(lan?'caminar':'quieto',{vel:.7}).cara('normal').rumbo(lp.rum).update(dt);
      /* bolsas voladoras (cobro y robo) */
      for(k=V.vol.length-1;k>=0;k--){
        var vo=V.vol[k];vo.u+=dt/vo.dur;
        var uu=Math.min(1,vo.u),ee=uu*uu*(3-2*uu);
        vo.b.g.position.set(vo.a[0]+(vo.c[0]-vo.a[0])*ee,vo.a[1]+(vo.c[1]-vo.a[1])*ee+Math.sin(uu*Math.PI)*vo.arco,vo.a[2]+(vo.c[2]-vo.a[2])*ee);
        vo.b.g.rotation.z+=dt*8;
        if(uu>=1){vo.b.g.visible=false;V.vol.splice(k,1);}
      }
      var yo=c.yo>=0&&c.yo<n?V.pjs[c.yo]:null;
      V.flecha.visible=!!yo;if(yo)V.flecha.position.set(yo.x,4.9+st.p[c.yo].nb*.95+Math.abs(Math.sin(t*4))*.3,yo.z);
    }
    function x0f(){return WX(AX0)-.2;}
    function x1f(){return WX(AX1)+.2;}
    var VOLP=null;
    function volar(a,b2,oro,dur,arco){                       /* una bolsa que vuela de a a b2 (cosmético) */
      if(!VOLP){VOLP=[];for(var i2=0;i2<6;i2++){var bm=bolsaMesh();bm.g.scale.setScalar(.75);bm.g.visible=false;v3.esc.scene.add(bm.g);VOLP.push(bm);}}
      for(var q=0;q<VOLP.length;q++){
        var libre=true;for(var w=0;w<v3.vol.length;w++)if(v3.vol[w].b===VOLP[q])libre=false;
        if(libre){ponOro(VOLP[q],!!oro);VOLP[q].g.visible=true;v3.vol.push({b:VOLP[q],a:a,c:b2,u:0,dur:dur||.45,arco:arco||2});return;}
      }
    }
    /* efectos 3D de los eventos (los dispara update() al ver el cambio de estado) */
    function agarra3D(p){
      var s3=v3.pjs[p];s3.bend={t:0,d:.36};V3.sfx('pop');
      v3.part.soltar(s3.x,1,s3.z,12,{k:'gota',cols:HARINA,vel:3,arriba:3,g:8,vida:.7});
      if(st.p[p].ng>0&&p===c.yo)V3.sfx('ding');
    }
    function forcejeo(a,b){                               /* el ladrón y la víctima se agarran de la misma bolsa */
      v3.pjs[a].fz={t:0,d:.8,con:b,rol:1};v3.pjs[b].fz={t:0,d:.8,con:a,rol:0};
    }
    function robo3D(p){
      var a=v3.pjs[p],mejor=-1,md=1e9,q,b,d;
      for(q=0;q<n;q++){if(q===p||!perdio[q])continue;b=v3.pjs[q];d=(b.x-a.x)*(b.x-a.x)+(b.z-a.z)*(b.z-a.z);if(d<md){md=d;mejor=q;}}
      if(mejor<0)for(q=0;q<n;q++){if(q===p)continue;b=v3.pjs[q];d=(b.x-a.x)*(b.x-a.x)+(b.z-a.z)*(b.z-a.z);if(d<md){md=d;mejor=q;}}
      a.pj.uno('lanzar');V3.sfx('golpe');v3.esc.sacudir(c.yo===p||c.yo===mejor?1:.5);v3.chisme=1.4;
      if(mejor>=0){
        var vb=v3.pjs[mejor];forcejeo(p,mejor);vb.pj.impacto(vb.x-a.x,vb.z-a.z,1.5);
        volar([vb.x,5,vb.z],[a.x,5,a.z],false,.3,1.4);
        v3.part.soltar((a.x+vb.x)/2,2.5,(a.z+vb.z)/2,30,{k:'gota',cols:HARINA,vel:5,arriba:4,g:8,vida:.9,esc:1.2});
      }
    }
    function caidaDe(i2){                                 /* de qué cayó y hacia dónde lo tira (solo visual) */
      var pl=st.p[i2],act=evActivos(st.k),ea,E,j,bd=1e9,best=-1,dd;
      if(pl.stun>ST_HIT){
        for(ea=0;ea<act.length;ea++){E=act[ea].E;if(E.tipo==='carro'&&act[ea].rel>=E.w)return {kind:'carro',dx:E.dir,dz:0};}
        return {kind:'carro',dx:1,dz:0};
      }
      for(ea=0;ea<act.length;ea++){
        E=act[ea].E;
        if(E.tipo==='mojado'&&act[ea].rel>=E.w&&dist(pl.x,pl.y,E.x,E.y)<70)return {kind:'mojado',dx:(pl.x-E.x)*ESX,dz:(pl.y-E.y)*ESZ};
      }
      for(j=0;j<n;j++){if(j===i2)continue;dd=dist(st.p[j].x,st.p[j].y,pl.x,pl.y);if(dd<bd){bd=dd;best=j;}}
      if(best>=0)return {kind:'empuje',dx:(pl.x-st.p[best].x)*ESX,dz:(pl.y-st.p[best].y)*ESZ};
      return {kind:'empuje',dx:0,dz:1};
    }
    function caer3D(p,kind,dx,dz){                        /* arma la caída: se inclina hacia (dx,dz) en el marco del cuerpo */
      var s3=v3.pjs[p],len=Math.sqrt(dx*dx+dz*dz)||1,yaw=s3.pj.g.rotation.y,f,sd,A,D,S;
      dx/=len;dz/=len;
      f=dx*Math.sin(yaw)+dz*Math.cos(yaw);sd=dx*Math.cos(yaw)-dz*Math.sin(yaw);
      A=kind==='carro'?1.35:(kind==='mojado'?0.9:1.15);
      D=kind==='carro'?1.3:(kind==='mojado'?0.95:1.05);
      S=kind==='mojado'?0.9:.4;
      s3.cai={t:0,d:D,kind:kind,ax:A*f,az:-A*sd,sx:dx*S,sz:dz*S};
    }
    function tamb3D(p,a){v3.pjs[p].tamb={t:0,d:.55,a:a};}
    function tumbo3D(p,kind,dx,dz){
      var s3=v3.pjs[p],fuerte=kind!=='mojado';
      V3.sfx(kind==='carro'?'choque':(fuerte?'caida':'resbalon'));v3.esc.sacudir(kind==='carro'?1:(fuerte?0.6:.4));
      if(kind==='carro')s3.pj.volar(dx,dz,1.7,{giro:1.1});
      else if(kind==='mojado')s3.pj.volar(dx,dz,.85,{giro:.8,alcance:.9});
      else s3.pj.impacto(dx,dz,1.8);
      if(kind!=='empuje')s3.cai={t:0,d:kind==='carro'?2.6:2,kind:kind,ax:0,az:0,sx:0,sz:0};
      v3.part.soltar(s3.x,2,s3.z,kind==='carro'?30:14,{k:'gota',cols:HARINA,vel:5,arriba:4,g:8,vida:.9,esc:1.2});
    }
    function cobra3D(p,nb,ng,pts){
      var s3=v3.pjs[p],ca=v3.cajas[cajaAbierta(st.k)],q;
      s3.pj.uno('festejo');V3.sfx('moneda');if(nb>=2)V3.sfx('ding');v3.alegria=1.2;
      for(q=0;q<Math.min(nb,3);q++)volar([s3.x,4.4+q,s3.z],[ca.x,1.6,ca.z],q>=nb-ng,.35+q*.08,1.6);
      v3.part.soltar(ca.x,2.4,ca.z,8+nb*8,{k:'chispa',cols:['#ffd23f','#fff59a','#5cff7a'],vel:3,arriba:3,g:4,vida:.8});
      if(pts>=40)v3.part.soltar(s3.x,5,s3.z,20,{k:'confeti',cols:CONF3,vel:3,arriba:4,g:6,vida:1});
    }
    function aparece3D(j){
      var b=st.b[j],B3=v3.bolsas[j];B3.pop=0;
      var x=WX(b.x),z=WZ(b.y);
      v3.part.soltar(x,.4,z,10,{k:'gota',cols:b.kd===2?ORO:HARINA,vel:2.5,arriba:2,g:6,vida:.6});
      if(b.kd===2)V3.sfx('ding');else V3.sfx('pop');
      var R=b.x<CX?v3.repo[0]:v3.repo[1];if(Math.abs(b.x-CX)>200){R.zd=z;R.pj.uno('lanzar');}
    }
    function aviso3D(E){
      if(E.tipo==='carro'){V3.sfx('silbato');}
      else if(E.tipo==='mojado')V3.sfx('splash');
      else if(E.tipo==='oferta')V3.sfx('tic');
      else if(E.tipo==='caja')V3.sfx('tic');
      else if(E.tipo==='camion'){v3.camT=at;v3.alegria=3;V3.sfx('bocina');V3.sfx('motor');}
    }
    function pega3D(E){
      if(E.tipo==='carro'){V3.sfx('whoosh');v3.esc.sacudir(.5);}
      else if(E.tipo==='caja'){V3.sfx('ding');}
      else if(E.tipo==='camion'){V3.sfx('caida');v3.esc.sacudir(.8);v3.part.soltar(0,2,WZ(PORTON[1]+30),40,{k:'gota',cols:HARINA,vel:5,arriba:4,g:8,vida:.9,esc:1.2});}
      else if(E.tipo==='oferta'){v3.part.soltar(WX(E.x),2,WZ(E.y),20,{k:'confeti',cols:ORO,vel:3,arriba:4,g:6,vida:1});}
    }
    function dibujar3D(f){
      var dt=Math.max(0,Math.min(.05,v3T?at-v3T:1/60)),now=c.ahora(),k,j;v3T=at;
      if(v3.kK!==st.k){v3.kK=st.k;v3.kAt=at;}
      if(dt>0)actualizar3D(dt,now);
      if(now>=0)V3.musica(fase(st.k)===2?'harina2':'harina');
      v3.esc.render(dt);
      var V=v3,pt,mid=f.x0+(f.x1-f.x0)/2;
      for(k=0;k<n;k++){
        var s3=V.pjs[k],seat=c.seats&&c.seats[k]||{},mio=k===c.yo;
        pt=V.esc.proyectar(s3.x,0,s3.z+1.15);
        txt(mio?'TÚ':String(seat.name||('P'+(k+1))).slice(0,7),pt.x,pt.y,11,mio?'#ffd23f':'#fffdf2',0,true);
        txt(String(st.p[k].pts),pt.x,pt.y+15,16,st.p[k].nb>0?'#ffe14d':'#ffffff',0,false);
        if(mio&&st.p[k].nb>=MAXC){pt=V.esc.proyectar(s3.x,8.4,s3.z);txt('¡LLENO! ¡A LA CAJA!',pt.x,pt.y,13,'#5cff7a',0,true);}
      }
      /* la caja abierta */
      var ab=cajaAbierta(st.k),C3=V.cajas[ab];
      pt=V.esc.proyectar(C3.x,5.8,C3.z);
      txt(cajaProxima(st.k)?'¡CAMBIA!':(fase(st.k)===2?'CAJA x2 ➜ $$':'COBRA AQUÍ'),pt.x,pt.y+Math.sin(at*5)*3,14,fase(st.k)===2?'#ff4d6d':'#5cff7a',0,true);
      for(j=0;j<NB;j++){var b=st.b[j];if(b.kd!==2)continue;pt=V.esc.proyectar(WX(b.x),2.4,WZ(b.y));txt('¡DORADA! 30',pt.x,pt.y+Math.sin(at*6)*2,12,'#ffd23f',0,true);}
      /* el aviso del carrito sobre su pasillo */
      var act=evActivos(st.k),ea;
      for(ea=0;ea<act.length;ea++){var E=act[ea].E;if(E.tipo==='carro'&&act[ea].rel<E.w){pt=V.esc.proyectar(0,0,WZ(E.ly));txt('¡CARRITO!',mid,pt.y-6,16,'#ffd0dc',0,false);if(E.ly2>0){pt=V.esc.proyectar(0,0,WZ(E.ly2));txt('¡CARRITO!',mid,pt.y-6,16,'#ffd0dc',0,false);}}}
      for(k=0;k<pops.length;k++){
        var po=pops[k],q=po;
        if(po.p>=0&&po.p<n){var sp=V.pjs[po.p];pt=V.esc.proyectar(sp.x,6.2+st.p[po.p].nb*.9,sp.z);q={s:po.s,x:pt.x,y:pt.y,t:po.t,life:po.life};}
        else{var cq=V.cajas[ab];if(po.s.indexOf('CAJA')>=0){pt=V.esc.proyectar(cq.x,7,cq.z);q={s:po.s,x:pt.x,y:pt.y,t:po.t,life:po.life};}}
        drawBubble(q);
      }
      if(banner){
        var k2=Math.min(1,banner.t*5);ctx.save();ctx.globalAlpha=Math.min(1,(banner.life-banner.t)*3);
        txt(banner.s,mid,235-(1-k2)*30,36*k2+4,banner.col,0,false);ctx.restore();
      }
      if(now>=0&&now<5||c.practica&&at<7)txt('A = agarrar · llévala a la CAJA abierta · A pegado a otro = ¡robo!',mid,560,15,'#ffffff',0,false);
    }

    function draw(){
      if(v3===null&&V3&&V3.listo&&V3.listo())v3=montar3D()||false;
      if(v3)return dibujar3D(c.campo());
      dibujar2D();
    }

    return {
      update:update, draw:draw, ai:ai,
      scores:function(){var a=[],i2;for(i2=0;i2<n;i2++)a.push(st.p[i2].pts);return a;},
      step:step, pack:pack, unpack:load, restore:load, lerp:lerp, predict:predict,
      vivo:function(){return true;},
      alCpu:function(){},
      alHum:function(){},
      destacado:function(){
        var s=this.scores(),m=0,i2;for(i2=1;i2<n;i2++)if(s[i2]>s[m])m=i2;
        return 'cobró la harina: '+s[m]+' puntos';
      },
      vista:function(){
        var i2,o={k:st.k,fase:fase(st.k),caja:cajaAbierta(st.k),u:[],pts:[],has:[],nb:[],ng:[],stun:[],inv:[],cd:[],dsh:[],x:[],y:[],bags:[],ev:EV,F1:F1,F2:F2};
        for(i2=0;i2<n;i2++){var pl=st.p[i2];o.u.push(pl.pts);o.pts.push(pl.pts);o.has.push(pl.nb>0?0:-1);o.nb.push(pl.nb);o.ng.push(pl.ng);o.stun.push(pl.stun);o.inv.push(pl.inv);o.cd.push(pl.cd);o.dsh.push(pl.dsh);o.x.push(pl.x);o.y.push(pl.y);}
        for(i2=0;i2<NB;i2++){var bb=st.b[i2];o.bags.push({x:bb.x,y:bb.y,h:-1,act:bb.kd?1:0,kd:bb.kd});}
        return o;
      }
    };
  }
});
})();
