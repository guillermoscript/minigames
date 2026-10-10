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
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.voltea)return;
const AP=BUS.AP,CONF=BUS.CONF,PI=Math.PI,LO=.55,HI=.76,C=AP.AREPA,BX=450,BY=350,K=.7;
/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;
const tono=c=>c<HI?mix(C.CRUDA,C.DORADA,clamp(c/LO,0,1)):mix(C.DORADA,C.QUEMADA,clamp((c-HI)/.1,0,1));

/* la arepa de la abuela (BUS.AP.arepa, la del jefe) a escala K: (x, y) = centro de la cara de arriba; c = cocción 0..1;
   sy = aplastada (para la vuelta en el aire). Encima van las señas de la cocción: brillo de masa, manchas tostadas y grietas */
function arepa(x,y,c,sy,rot){const f=tono(c),tos=clamp((c-.3)/.3,0,1),q=clamp((c-HI)/.1,0,1);
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(K,K);
  AP.arepa(0,0,f,f,sy);
  if(c<.3)ell(-52,-12*sy,36,6*sy,'#ffffff',0);                                              /* brillo de masa cruda */
  if(q<.7)for(let i=0;i<7;i++){const a=i*2.4+.7,r=.2+hash(i,3,1)*.55,s=tos*(6+hash(i,4,1)*7);   /* las manchas tostadas */
    if(s>2)ell(Math.cos(a)*r*124,Math.sin(a)*r*28*sy,s*1.7,s*.65*sy,mix(C.TOSTE,C.QUEMADA,q),0);}
  if(q>.25)for(let i=0;i<4;i++){const x0=-108+i*62,d=(i%2)*10;                               /* las grietas del carbón */
    line([[x0,(-13+d)*sy],[x0+20,-2*sy],[x0+11,10*sy],[x0+38,(19-d)*sy]],4,q>.85?'#ff7a3d':'#6b3a1a');}
  ctx.restore();}

/* ═════════ ¡VOLTEA!: un solo toque, cuando esté doradita ═════════ */
function mkVoltea(){
  const rs=Math.sqrt(SP),dur=5/rs,rate=Math.max((.2+Math.random()*.05)*rs*(.9+(SP-1)*.35),1/(dur-.05));
  let cook=0,flipT=-1,shown=0,fin=0,siz=0,cayo=false;
  function voltea(){if(g.result)return;flipT=0;sfx.whoosh();
    if(cook>=LO&&cook<=HI){g.result='win';g.why='¡DORADITA!';}
    else{g.result='lose';g.kind=cook<LO?'cruda':'carbon';g.why=cook<LO?'¡CRUDA!':'¡CARBÓN!';sfx.lose();}}
  const g={get impact(){return this.result?clamp(1-fin/.5,0,1):0;},
    probe:()=>({cook,lo:LO,hi:HI,rate,kind:g.kind}),
    t:0,dur,result:null,why:'',kind:'',endT:0,cmd:'¡VOLTEA!',
    hint:'TOCA (o ESPACIO) cuando la arepa esté DORADITA',
    press(){voltea();},
    down(){voltea();},
    update(dt){g.t+=dt;
      if(!g.result){cook+=rate*dt;
        if((siz-=dt)<=0){siz=.11;nz(.06,.012+.03*cook);}                                       /* el chirrido del budare */
        if(cook>=1){cook=1;g.result='lose';g.kind='carbon';g.why='¡CARBÓN!';sfx.lose();nz(.4,.14);}}
      else{fin+=dt;g.endT=sello(fin);if(flipT>=0)flipT+=dt;
        if(flipT>=.7&&!cayo){cayo=true;sfx.thud();
          if(g.result==='win'){sfx.win();spawn(BX,BY-50,22,'conf',CONF);spawn(BX,BY-40,8,'★',['#ffe14d','#ffffff'],300,600,.7);}}}
      shown=lerp(shown,cook,Math.min(1,dt*20));},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',cruda=lose&&g.kind==='cruda',e=fin,f=flipT>=0?clamp(flipT/.7,0,1):0;
      const q=clamp((cook-HI)/.2,0,1),humo=cook>HI,gas=clamp(1-cook*.55,.25,1),sw=f>0&&f<1?Math.sin(f*PI):0;
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      AP.cocina();
      /* la abuela detrás del mesón (la espátula va después, por encima del budare) */
      const ay=336-(win&&cayo?Math.abs(Math.sin(now*11))*10:0),aa=1.45+sw*.8,hx=216+88*Math.sin(aa),hy=ay+4+88*Math.cos(aa);
      ctx.save();path([[0,0],[800,0],[800,430],[0,430]]);ctx.clip();
      bust(Object.assign({},AP.CAST.abuela,{x:170,y:ay,s:1.05,look:1,
        mood:win?'grin':cruda?'frown':lose?'yell':cook>HI?'panic':cook>LO?'o':'calm',talk:lose&&!cruda&&e>.3?Math.abs(Math.sin(now*13)):0,sweat:!win&&cook>.7?1:0,
        arms:[{side:1,a:aa,len:84,w:20},
          {side:-1,a:win&&cayo?-2.6+Math.sin(now*11)*.2:-.2,len:74,w:20}]}));
      ctx.restore();
      /* sobre el mesón: la harina, la vela, y la hornilla de gas con su llama y el budare encima */
      rr(738,394,46,58,4,'#ffd23f',3.5);txt('HARINA',761,424,10,INK,0,true);
      AP.vela(690,456,1.5);
      rr(352,426,196,24,6,'#8f8fa8',4);ell(388,438,6,6,'#3b3550',2.5);ell(512,438,6,6,'#3b3550',2.5);
      for(let i=0;i<9;i++){const x=366+i*21,h=(26+Math.sin(now*19+i*1.7)*7)*gas+10;
        poly([[x-10,424],[x,424-h],[x+10,424]],'#3fb0ff',2.5);poly([[x-4,424],[x,424-h*.5],[x+4,424]],'#fff3a8',0);}
      rr(344,419,212,9,3,'#3b3550',3);
      rr(BX+150,BY-1,74,13,5,'#2b2433',3.5);
      ell(BX,BY+12,172,32,'#14101c',4.5);ell(BX,BY,172,32,'#4a4560',4.5);ell(BX,BY+2,146,24,'#2b2433',0);
      /* la arepa: brinca y se da la vuelta */
      const jy=Math.sin(f*PI)*140;
      ctx.save();ctx.globalAlpha=.3;ell(BX,BY-2,105-jy*.2,26-jy*.05,'#000000',0);ctx.restore();
      arepa(BX,BY-28-jy,cook,flipT>=0?Math.max(.1,Math.abs(Math.cos(f*PI))):1,sw*.22);
      ctx.save();ctx.translate(hx,hy);ctx.rotate(-.05-sw*.8);line([[0,0],[64,0]],7,'#8a5a30');rr(58,-13,48,26,5,'#c9ced6',3.5);ell(0,0,14,14,AP.CAST.abuela.skin,3.5);ctx.restore();
      if(win&&cayo)for(let i=0;i<3;i++){const a=now*4+i*TAU/3;txt('★',BX+Math.cos(a)*130,BY-70+Math.sin(a)*16,20,'#ffe14d');}
      /* vapor (blanco, sin borde) y humo (oscuro, con borde) */
      for(let i=0;i<6;i++){const u=(now*.5+i/6)%1;ctx.save();ctx.globalAlpha=(1-u)*(humo?.4+.4*q:.3);
        ell(BX-60+i*24+Math.sin(now*3+i)*8,BY-52-u*(120+q*60),14+u*22+q*10,9+u*14+q*8,humo?'#2b2433':'#ffffff',humo?2.5:0);ctx.restore();}
      /* la noche encima: alumbran la llama y la vela */
      AP.oscuro(.5,[{x:BX,y:390,r:250,c:'#ffb060'},{x:690,y:398,r:150,c:'#ffd27a'}]);
      /* el medidor: CRUDA | [ DORADITA ] | CARBÓN, y la aguja */
      const mx=262,my=98,mw=380,mh=24,zx=mx+mw*LO,zw=mw*(HI-LO),nx=mx+mw*clamp(shown,0,1);
      rr(mx-5,my-5,mw+10,mh+10,8,'#14101c',3.5);
      rr(mx,my,mw*LO,mh,3,C.CRUDA,0);rr(zx,my,zw,mh,0,'#ffd23f',0);rr(zx+zw,my,mw*(1-HI),mh,3,C.QUEMADA,0);
      txt('CRUDA',mx+mw*LO/2,my+mh/2+1,13,'#6b5a3a',0,true);txt('DORADITA',zx+zw/2,my+mh/2+1,12,'#3b2a14',0,true);txt('CARBÓN',zx+zw+mw*(1-HI)/2,my+mh/2+1,13,'#c9b8a0',0,true);
      for(const[x,d]of[[zx,1],[zx+zw,-1]])line([[x+d*9,my-11],[x,my-11],[x,my+mh+11],[x+d*9,my+mh+11]],5,'#ffffff');
      line([[nx,my-9],[nx,my+mh+9]],6,'#ffffff');poly([[nx,my+mh+10],[nx-11,my+mh+28],[nx+11,my+mh+28]],'#ffffff',3.5);
      if(win&&e>.8)bubble(300,188,'¡ESA SÍ QUEDÓ BUENA!',18,214,236);
      if(lose&&e>.8)bubble(300,188,cruda?'¡ESO ESTÁ CRUDO, MIJO!':'¡SE QUEMÓ LA AREPA!',18,214,236);
      ctx.restore();line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('voltea',{name:'¡VOLTEA!',mk:mkVoltea,card:'LA AREPA',num:'22'});
})();
