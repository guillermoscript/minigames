'use strict';
/* MiniCaos · laboratorio de estilos: ¡VOLTEA! (la arepa en el budare, del mundo SE FUE LA LUZ).
   Se fue la luz y la abuela está haciendo arepas a la luz de una vela: la masa se va dorando sola sobre el budare y hay UN
   solo toque para voltearla. Si la volteas dentro de la zona DORADITA del medidor, ganas. Antes de tiempo sale CRUDA;
   después (o si no la tocas nunca) queda hecha CARBÓN. Port de apArepa (js/games/ap1.js): misma ventana (0.55 a 0.76 de
   cocción) y la misma velocidad, que sube con SP; en el nivel más lento se aprieta un pelo para que el carbón llegue antes
   de que se acabe el reloj.
   La arepa no cambia solo de color: cruda es lisa y con brillo de masa, dorada le salen las manchas tostadas, y quemada se
   pone negra, se agrieta y echa humo con borde (el vapor es blanco y sin borde), para que se lea en los estilos de un solo tono.
   La cocina, la abuela y la arepa son las del jefe de la arepa (BUS.AP.cocina, CAST.abuela, arepa): el budare va sobre el mesón.
   El medidor va DESPUÉS de la oscuridad: una barra con CRUDA / DORADITA / CARBÓN escritos, la zona buena entre corchetes y una aguja.
   Teclado: ESPACIO.
   Nivel 1: una arepa, zona doradita de 0.55 a 0.76. El nivel sale de BUS.LV() (no de la velocidad).
   Nivel 2: la zona se angosta (0.58 a 0.73) y la vela se APAGA una vez, justo antes de la zona (se prende al llegar a ella): hasta 0.45 s sin medidor
   («¡SE APAGÓ LA VELA!»), en que solo queda mirar la arepa a la luz de la hornilla (las manchas tostadas avisan).
   Nivel 3: lo del 2, y van DOS arepas en el budare: una se cocina 1.25 a 1.4 veces más rápido que la otra y cada una tiene
   su medidor. Se voltea cada una en su zona (toca la arepa, o ← y →); ESPACIO solo no sabe cuál. Una mal volteada o
   quemada y se pierde; con las dos doraditas se gana. La ya volteada queda marcada «¡LISTA!».
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.voltea)return;
const AP=BUS.AP,CONF=BUS.CONF,PI=Math.PI,C=AP.AREPA,BX=450,BY=350;
/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;
const tono=(c,lo,hi)=>c<hi?mix(C.CRUDA,C.DORADA,clamp(c/lo,0,1)):mix(C.DORADA,C.QUEMADA,clamp((c-hi)/.1,0,1));

/* la arepa de la abuela (BUS.AP.arepa, la del jefe) a escala K: (x, y) = centro de la cara de arriba; c = cocción 0..1;
   sy = aplastada (para la vuelta en el aire). Encima van las señas de la cocción: brillo de masa, manchas tostadas y grietas */
function arepa(x,y,c,sy,rot,K,lo,hi){const f=tono(c,lo,hi),tos=clamp((c-.3)/.3,0,1),q=clamp((c-hi)/.1,0,1);
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(K,K);
  AP.arepa(0,0,f,f,sy);
  if(c<.3)ell(-52,-12*sy,36,6*sy,'#ffffff',0);                                              /* brillo de masa cruda */
  if(q<.7)for(let i=0;i<7;i++){const a=i*2.4+.7,r=.2+hash(i,3,1)*.55,s=tos*(6+hash(i,4,1)*7);   /* las manchas tostadas */
    if(s>2)ell(Math.cos(a)*r*124,Math.sin(a)*r*28*sy,s*1.7,s*.65*sy,mix(C.TOSTE,C.QUEMADA,q),0);}
  if(q>.25)for(let i=0;i<4;i++){const x0=-108+i*62,d=(i%2)*10;                               /* las grietas del carbón */
    line([[x0,(-13+d)*sy],[x0+20,-2*sy],[x0+11,10*sy],[x0+38,(19-d)*sy]],4,q>.85?'#ff7a3d':'#6b3a1a');}
  ctx.restore();}
/* el medidor: CRUDA | [ DORADITA ] | CARBÓN, y la aguja en v. Si la zona es angosta, DORADITA va escrito arriba.
   lista = ya se volteó bien (sello en vez de aguja); fl = flecha de la tecla ('' si hay una sola arepa) */
function medidor(mx,my,mw,lo,hi,v,lista,fl){const mh=24,zx=mx+mw*lo,zw=mw*(hi-lo),nx=mx+mw*clamp(v,0,1),ch=mw<300,sz=ch?10:13;
  rr(mx-5,my-5,mw+10,mh+10,8,'#14101c',3.5);
  rr(mx,my,mw*lo,mh,3,C.CRUDA,0);rr(zx,my,zw,mh,0,'#ffd23f',0);rr(zx+zw,my,mw*(1-hi),mh,3,C.QUEMADA,0);
  txt('CRUDA',mx+mw*lo/2,my+mh/2+1,sz,'#6b5a3a',0,true);txt('CARBÓN',zx+zw+mw*(1-hi)/2,my+mh/2+1,sz,'#c9b8a0',0,true);
  if(zw>=76)txt('DORADITA',zx+zw/2,my+mh/2+1,12,'#3b2a14',0,true);else txt('DORADITA',zx+zw/2,my-24,ch?13:15,'#ffffff');
  for(const[x,d]of[[zx,1],[zx+zw,-1]])line([[x+d*9,my-11],[x,my-11],[x,my+mh+11],[x+d*9,my+mh+11]],5,'#ffffff');
  if(fl)txt(fl,fl==='←'?mx-26:mx+mw+26,my+mh/2,30,'#ffffff');
  if(lista){rr(mx+mw/2-52,my+mh+12,104,26,8,'#ffd23f',3.5);txt('¡LISTA!',mx+mw/2,my+mh+25,15,INK,0,true);return;}
  line([[nx,my-9],[nx,my+mh+9]],6,'#ffffff');poly([[nx,my+mh+10],[nx-11,my+mh+28],[nx+11,my+mh+28]],'#ffffff',3.5);}

/* ═════════ ¡VOLTEA!: un solo toque (por arepa), cuando esté doradita ═════════ */
function mkVoltea(){
  const rs=Math.sqrt(SP),dur=5/rs,rate=Math.max((.2+Math.random()*.05)*rs*(.9+(SP-1)*.35),1/(dur-.05));
  const lv=BUS.LV(),LO=lv>1?.58:.55,HI=lv>1?.73:.76,dos=lv>2,MY=lv>1?122:98;   /* con la zona angosta, DORADITA va arriba: el medidor baja para no chocar con el reloj */
  /* las arepas: en el nivel 3 una va 1.25–1.4 veces más rápido (de qué lado, al azar); la lenta lleva el paso de siempre */
  const mk=(x,K,r)=>({x,K,rate:r,cook:0,shown:0,flipT:-1,cayo:false,st:''});
  const A=dos?[mk(BX-74,.45,rate),mk(BX+74,.45,rate)]:[mk(BX,.7,rate)];
  if(dos)A[Math.random()<.5?0:1].rate*=1.25+Math.random()*.15;
  /* la vela se apaga una vez (nivel 2+): cuando la más adelantada llega a tv de cocción, dura VD s */
  const tv=lv>1?LO-.1-Math.random()*.05:9,VD=.45/rs;
  let fin=0,siz=0,vela=-1,ult=0;
  const viva=()=>A.filter(a=>!a.st),mas=()=>Math.max.apply(null,(viva().length?viva():A).map(a=>a.cook)),oscura=()=>vela>=0&&vela<VD;
  function voltea(i){const a=A[i];if(g.result||!a||a.st)return;a.flipT=0;ult=i;sfx.whoosh();
    if(a.cook>=LO&&a.cook<=HI){a.st='ok';if(A.every(q=>q.st==='ok')){g.result='win';g.why=dos?'¡DORADITAS!':'¡DORADITA!';}else snd(880,.08,'triangle',.06);}
    else{a.st=a.cook<LO?'cruda':'carbon';g.result='lose';g.kind=a.st;g.why=a.cook<LO?'¡CRUDA!':'¡CARBÓN!';sfx.lose();}}
  const g={lr:dos,get impact(){return this.result?clamp(1-fin/.5,0,1):0;},
    /* cook = la más adelantada sin voltear; a = todas [{x, y, cook, rate, st}] (dos en el nivel 3); vela = el medidor está tapado */
    probe:()=>({cook:mas(),lo:LO,hi:HI,rate,kind:g.kind,lv,vela:oscura(),a:A.map(a=>({x:a.x,y:BY-20,cook:a.cook,rate:a.rate,st:a.st}))}),
    t:0,dur,result:null,why:'',kind:'',endT:0,cmd:dos?'¡VOLTEA LAS DOS!':'¡VOLTEA!',
    hint:dos?'TOCA cada arepa (o ← y →) cuando ESA esté DORADITA: ¡las dos!':'TOCA (o ESPACIO) cuando la arepa esté DORADITA',
    press(k){if(g.result)return;
      if(!dos)voltea(0);else if(k==='left')voltea(0);else if(k==='right')voltea(1);else BUS.say('¿CUÁL? ← →',BX,BY-120,'#ffffff');},
    down(p){voltea(dos&&p&&p.x>=BX?1:0);},
    update(dt){g.t+=dt;
      for(const a of A){if(a.flipT>=0)a.flipT+=dt;
        if(a.flipT>=.7&&!a.cayo){a.cayo=true;sfx.thud();
          if(g.result==='win'&&A.every(q=>q.cayo)){sfx.win();spawn(BX,BY-50,22,'conf',CONF);spawn(BX,BY-40,8,'★',['#ffe14d','#ffffff'],300,600,.7);}}}
      if(!g.result){
        if(vela<0&&mas()>=tv){vela=0;snd(300,.12,'sine',.05,-200);}else if(vela>=0){vela+=dt;if(mas()>=LO-.015)vela=Math.max(vela,VD);}   /* vuelve antes de la zona, a cualquier velocidad */
        if((siz-=dt)<=0){siz=.11;nz(.06,.012+.03*mas());}                                      /* el chirrido del budare */
        for(const a of A)if(!a.st){a.cook+=a.rate*dt;
          if(a.cook>=1&&!g.result){a.cook=1;a.st='carbon';g.result='lose';g.kind='carbon';g.why='¡CARBÓN!';sfx.lose();nz(.4,.14);}}}
      else{fin+=dt;g.endT=sello(fin);}
      for(const a of A)a.shown=lerp(a.shown,a.cook,Math.min(1,dt*20));},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',cruda=lose&&g.kind==='cruda',e=fin,cayo=A.every(a=>a.cayo),cook=lose?Math.max.apply(null,A.map(a=>a.cook)):mas();
      const fu=A[ult].flipT>=0?clamp(A[ult].flipT/.7,0,1):0,gas=clamp(1-cook*.55,.25,1),sw=fu>0&&fu<1?Math.sin(fu*PI):0,osc=!g.result&&oscura();
      ctx.save();path([[gameLeft(),0],[gameRight(),0],[gameRight(),576],[gameLeft(),576]]);ctx.clip();
      AP.cocina();
      /* la abuela detrás del mesón (la espátula va después, por encima del budare) */
      const ay=336-(win&&cayo?Math.abs(Math.sin(now*11))*10:0),aa=1.45+sw*.8,hx=216+88*Math.sin(aa),hy=ay+4+88*Math.cos(aa);
      ctx.save();path([[0,0],[800,0],[800,430],[0,430]]);ctx.clip();
      bust(Object.assign({},AP.CAST.abuela,{x:170,y:ay,s:1.05,look:1,
        mood:win?'grin':cruda?'frown':lose?'yell':cook>HI?'panic':osc?'worry':cook>LO?'o':'calm',talk:lose&&!cruda&&e>.3?Math.abs(Math.sin(now*13)):0,sweat:!win&&(cook>.7||osc)?1:0,
        arms:[{side:1,a:aa,len:84,w:20},
          {side:-1,a:win&&cayo?-2.6+Math.sin(now*11)*.2:-.2,len:74,w:20}]}));
      ctx.restore();
      /* sobre el mesón: la harina, la vela (apagada: sin llama, la mecha y un hilito de humo), y la hornilla con el budare encima */
      rr(738,394,46,58,4,'#ffd23f',3.5);txt('HARINA',761,424,10,INK,0,true);
      if(osc){ctx.save();ctx.translate(690,456);ctx.scale(1.5,1.5);rr(-16,0,32,8,3,'#c4cad6',3);rr(-7,-34,14,36,3,'#fff6dc',3);line([[0,-34],[1,-41]],2.5,INK);ctx.restore();}
      else AP.vela(690,456,1.5);
      rr(352,426,196,24,6,'#8f8fa8',4);ell(388,438,6,6,'#3b3550',2.5);ell(512,438,6,6,'#3b3550',2.5);
      for(let i=0;i<9;i++){const x=366+i*21,h=(26+Math.sin(now*19+i*1.7)*7)*gas+10;
        poly([[x-10,424],[x,424-h],[x+10,424]],'#3fb0ff',2.5);poly([[x-4,424],[x,424-h*.5],[x+4,424]],'#fff3a8',0);}
      rr(344,419,212,9,3,'#3b3550',3);
      rr(BX+150,BY-1,74,13,5,'#2b2433',3.5);
      ell(BX,BY+12,172,32,'#14101c',4.5);ell(BX,BY,172,32,'#4a4560',4.5);ell(BX,BY+2,146,24,'#2b2433',0);
      /* las arepas: cada una brinca y se da la vuelta */
      for(const a of A){const f=a.flipT>=0?clamp(a.flipT/.7,0,1):0,jy=Math.sin(f*PI)*140,ks=a.K/.7,yb=BY-12-16*ks;
        ctx.save();ctx.globalAlpha=.3;ell(a.x,BY-2,(105-jy*.2)*ks,(26-jy*.05)*ks,'#000000',0);ctx.restore();
        arepa(a.x,yb-jy,a.cook,a.flipT>=0?Math.max(.1,Math.abs(Math.cos(f*PI))):1,f>0&&f<1?Math.sin(f*PI)*.22:0,a.K,LO,HI);}
      ctx.save();ctx.translate(hx,hy);ctx.rotate(-.05-sw*.8);line([[0,0],[64,0]],7,'#8a5a30');rr(58,-13,48,26,5,'#c9ced6',3.5);ell(0,0,14,14,AP.CAST.abuela.skin,3.5);ctx.restore();
      if(win&&cayo)for(let i=0;i<3;i++){const a=now*4+i*TAU/3;txt('★',BX+Math.cos(a)*130,BY-70+Math.sin(a)*16,20,'#ffe14d');}
      /* vapor (blanco, sin borde) y humo (oscuro, con borde), el de cada arepa */
      for(const a of A){const n=dos?3:6,ks=a.K/.7,q=clamp((a.cook-HI)/.2,0,1),humo=a.cook>HI;
        for(let i=0;i<n;i++){const u=(now*.5+i/n+a.x*.01)%1;ctx.save();ctx.globalAlpha=(1-u)*(humo?.4+.4*q:.3);
          ell(a.x+(i-(n-1)/2)*24+Math.sin(now*3+i)*8,BY-52-u*(120+q*60),(14+u*22+q*10)*ks,(9+u*14+q*8)*ks,humo?'#2b2433':'#ffffff',humo?2.5:0);ctx.restore();}}
      if(osc)for(let i=0;i<3;i++){const u=(vela*1.6+i/3)%1;ctx.save();ctx.globalAlpha=(1-u)*.8;ell(691+Math.sin(u*5+i)*6,388-u*50,4+u*7,3+u*5,'#c9ced6',2.5);ctx.restore();}
      /* la noche encima: alumbran la llama y la vela (si se apagó, queda solo la hornilla y la noche se cierra) */
      AP.oscuro(osc?.72:.5,[{x:BX,y:390,r:osc?215:250,c:'#ffb060'},{x:690,y:398,r:osc?0:150,c:'#ffd27a'}]);
      /* los medidores (o el hueco donde iban, mientras la vela está apagada) */
      if(osc){rr(257,MY-5,390,34,8,'#14101c',3.5);if(Math.sin(now*26)>-.3)txt('¡SE APAGÓ LA VELA!',452,MY+13,17,'#ffffff',0,true);}
      else if(dos)A.forEach((a,i)=>medidor(i?474:238,MY,188,LO,HI,a.shown,a.st==='ok',i?'→':'←'));
      else medidor(262,MY,380,LO,HI,A[0].shown,false,'');
      if(win&&e>.8)bubble(300,MY+90,dos?'¡ESAS SÍ QUEDARON BUENAS!':'¡ESA SÍ QUEDÓ BUENA!',18,214,236);
      if(lose&&e>.8)bubble(300,MY+90,cruda?'¡ESO ESTÁ CRUDO, MIJO!':'¡SE QUEMÓ LA AREPA!',18,214,236);
      ctx.restore();line([[gameLeft(),576],[gameRight(),576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('voltea',{name:'¡VOLTEA!',mk:mkVoltea,card:'LA AREPA',num:'22'});
})();
