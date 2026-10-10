'use strict';
/* MiniCaos · laboratorio de estilos: ¡SÍGUELE EL PASO! (la tía entonada).
   Fiesta en la casa: tu tía, contenta y con su vasito plástico en la mano, te saca a bailar a la fuerza mientras suena un
   merengue (ORIGINAL, sintetizado: tambora en cada tiempo, güira en el contratiempo, bajo y un jaleo propio; el afiche dice
   "ORQUESTA LOS MELOSOS", que no existe). Por el carril de abajo vienen flechas: las ROSADAS llegan por la izquierda, las
   AZULES por la derecha, y todas caen en el aro del centro justo en el golpe de tambora. Toca ese lado (← → / A D, o la mitad
   izquierda / derecha de la pantalla) cuando la flecha esté en el aro. Se puede jugar de oído: cada flecha cae en un tamborazo.
   Fallar, no tocar o tocar el lado contrario = le pisas el juanete a la tía (¡AY!). Tres pisotones y se acabó.
   Nivel 1: 10 pasos alternados, ventana ±0.16 s. Nivel 2: más rápido, con dobles, ±0.13 s. Nivel 3: más rápido, dobles y
   un paso a contratiempo, ±0.10 s. El patrón sale espejado al azar. Tocar fuera de tiempo no cuenta (ni ayuda).
   Ganas: das la vuelta con estilo, la tía aplaude: «¡ESE ES MI SOBRINO BELLO!».
   Pierdes: te enredas con la mesa, tumbas el refresco y la tía te sigue bailando arrastrado por el piso. El tío ni se despierta.
   Teclado: flechas izquierda/derecha (o A/D). ESPACIO no hace nada.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.baile)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI;
const CL='#ff5c8a',CR='#3fb0ff',SODA='#ff8a3d';
const TIA={skin:'#c98a5a',shirt:'#9b6bd1',pat:'floral',sh2:'#fff3a8',hair:'bun',hairCol:'#8a2a1e',cheeks:1,earring:1,brow:'thin',bw:54,th:112,legs:['#c98a5a','#c4283a',58]};
/* pasos por nivel: tiempos (en negras) y lado */
const PAT=[[[2,3,4,5,6,7,8,9,10,11],'LRLRLRLRLR'],[[2,3,4,5,6,7,8,9,10,11],'LRLLRLRRLR'],[[2,3,4,5,6,7,7.5,9,10,11],'LRRLRLRLLR']];
/* el merengue (original): i cuenta corcheas. Tambora en cada negra: es la pista para jugar de oído */
const BAJO=[131,196,147,196],JAL=[523,659,784,659,587,698,784,698];
function merengue(i,B){
  if(i%2===0){snd(118,.13,'sine',.22,-50);nz(.04,.07);snd(BAJO[(i>>1)%4],.16,'triangle',.06);}
  else{nz(.03,.045);if(i%4===3)setTimeout(()=>nz(.025,.035),B*250);}
  snd(JAL[i%8]*(i&8?1.125:1),.07,'square',.016);}
function flecha(x,y,d,col,s=1,o=3.5){poly([[x+26*d*s,y],[x,y-22*s],[x,y-9*s],[x-22*d*s,y-9*s],[x-22*d*s,y+9*s],[x,y+9*s],[x,y+22*s]],col,o);}
function botella(x,y,rot){ctx.save();ctx.translate(x,y);ctx.rotate(rot);rr(-11,-50,22,50,6,SODA,3.5);rr(-6,-66,12,20,4,SODA,3);rr(-7,-72,14,8,3,'#ffffff',2.5);rr(-11,-34,22,14,0,'#ffffff',0);ctx.restore();}
const vaso=(hx,hy)=>{poly([[hx-11,hy-28],[hx+11,hy-28],[hx+7,hy-2],[hx-7,hy-2]],'#e8553d',3);rr(hx-12,hy-31,24,6,3,'#ffffff',2);};

function mkBaile(){
  const lv=LV(),rs=Math.sqrt(SP),B=.5/rs,WIN=[.16,.13,.1][lv-1],TR=2*B,mir=Math.random()<.5?-1:1,[bs,ss]=PAT[lv-1],rare=Math.random()<.15;
  const notes=bs.map((b,i)=>({t:b*B,d:(ss[i]==='L'?-1:1)*mir,st:0}));
  const FY=478,LY=530,TX=326,MX=478,TY=FY-145,MY=FY-136;
  let strikes=0,si=0,stepD=0,stepK=0,ouch=0,good=0,ev=0,combo=0;
  function strike(n){n.st=2;strikes++;ouch=1;combo=0;sfx.thud();snd(880,.18,'square',.06,500);
    say(['¡AY!','¡MI JUANETE!','¡EL CALLO!'][strikes-1]||'¡AY!',TX-10,TY-150,'#ffe14d');spawn(TX+30,FY-6,5,'★',['#ffe14d'],160,400,.6);
    if(strikes>=3){g.result='lose';g.why='¡ENREDADO!';sfx.lose();}}
  function hit(n){n.st=1;good=1;combo++;stepD=n.d;stepK=1;snd(n.d<0?660:880,.08,'triangle',.08);spawn(400,LY,4,'bit',[n.d<0?CL:CR],160,300,.4);
    if(combo%3===0)say(['¡ESO!','¡WEPA!','¡SABROSO!'][(combo/3-1)%3],MX+60,MY-150,'#ffffff');}
  function check(){if(!g.result&&notes.every(n=>n.st)){g.result='win';g.why='¡QUÉ PASO!';sfx.win();spawn(MX,MY-60,26,'conf',CONF);}}
  /* se juzga la flecha pendiente más cercana dentro de la ventana; fuera de la ventana el toque no cuenta */
  function paso(d){if(g.result)return;let b=null,bd=WIN;for(const n of notes)if(!n.st){const q=Math.abs(n.t-g.t);if(q<=bd){bd=q;b=n;}}
    if(!b){snd(240,.04,'square',.03);stepD=d;stepK=.5;return;}
    if(b.d===d)hit(b);else strike(b);check();}

  const g={lr:true,get impact(){return this.result?clamp(1-this.endT/.5,0,1):ouch*.5;},
    probe:()=>{const n=notes.find(q=>!q.st);return{B,WIN,strikes,left:notes.filter(q=>!q.st).length,next:n?{t:n.t,d:n.d}:null};},
    t:0,dur:notes[notes.length-1].t+WIN+.4,result:null,why:'',endT:0,cmd:'¡SÍGUELE EL PASO!',
    hint:'← → (o toca el lado IZQUIERDO / DERECHO) cuando la flecha llegue al aro',
    press(k){if(k==='left')paso(-1);else if(k==='right')paso(1);},
    down(p){paso(p.x<W/2?-1:1);},
    update(dt){g.t+=dt;ouch=Math.max(0,ouch-dt*2.2);good=Math.max(0,good-dt*4);stepK=Math.max(0,stepK-dt*3.5);
      if(!g.result){while(g.t>=si*B/2)merengue(si++,B);
        for(const n of notes)if(!n.st&&g.t>n.t+WIN){strike(n);if(g.result)break;}
        check();}
      else{g.endT+=dt;const e=g.endT;
        if(g.result==='win'){if(ev<1&&e>=.3){ev=1;sfx.whoosh();}if(ev<2&&e>=.7){ev=2;sfx.ding();}
          if(e>.75&&e<1.9&&Math.floor(e*9)!==Math.floor((e-dt)*9))nz(.03,.09);}
        else{if(ev<1&&e>=.32){ev=1;sfx.crash();say('¡PUM!',610,330,'#ffffff');spawn(626,360,12,'bit',[SODA,'#ffffff'],260,700,.8);}
          if(ev<2&&e>=.75){ev=2;sfx.whoosh();}if(ev<3&&e>=1.25){ev=3;sfx.boing();}}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,bp=g.t/B,bob=g.result?Math.abs(Math.sin(now*7)):Math.abs(Math.sin(bp*PI)),sw=g.result?Math.sin(now*7):Math.sin(bp*PI);
      /* la sala: pared, banderines, afiche */
      wash(0,0,800,600,'#ffe3b0','#ffc98a');
      line([[0,100],[800,100]],3,INK);for(let i=0;i<10;i++){const x=40+i*80;poly([[x-17,101],[x+17,101],[x,128]],CONF[i%4],3);}
      rr(176,140,170,104,6,'#fff3c4',3.5);txt('HOY · EN VIVO',261,158,12,INK,0,true);txt('ORQUESTA',261,182,19,'#c4283a',0,true);txt('LOS MELOSOS',261,206,19,'#c4283a',0,true);txt(rare?'(SI LLEGAN)':'MERENGUE DEL BUENO',261,228,10,INK,0,true);
      /* los pisotones que te quedan */
      rr(14,140,150,60,10,'#fff3c4',3.5);txt('PISOTONES',89,154,12,INK,0,true);
      for(let i=0;i<3;i++){const x=53+i*36,on=i<strikes;ell(x,178,13,8,on?'#8f8fa8':'#c4283a',3);if(on){line([[x-9,170],[x+9,186]],3.5,'#ff3b4e');line([[x+9,170],[x-9,186]],3.5,'#ff3b4e');}}
      rr(0,440,800,160,0,'#b5764a',0);line([[0,440],[800,440]],5,INK);for(let i=0;i<7;i++)line([[i*130-20,440],[i*150-80,600]],2.5,'#8a5a30');
      /* la corneta con la gallina de siempre */
      rr(34,292,104,150,10,'#2d2640',4);ell(86,332,22+bob*3,22+bob*3,'#5a5274',3.5);ell(86,398,30+bob*5,30+bob*5,'#5a5274',3.5);ell(86,398,9,9,'#14101c',0);
      hen(82,266-bob*10,.55,1);
      /* el tío dormido detrás de la mesa: no se entera de nada */
      bust(Object.assign({},FACES[1],{x:706,y:318,s:.62,th:90,mood:'sleep',rot:.14+Math.sin(now*1.6)*.03,arms:[{side:-1,a:.5,len:60,w:20},{side:1,a:-.5,len:60,w:20}]}));
      for(let i=0;i<3;i++){const u=(now*.5+i/3)%1;txt('z',748+u*26,236-u*56,12+u*12,'#ffffff');}
      line([[594,392],[588,474]],8,'#8a5a30');line([[760,392],[766,474]],8,'#8a5a30');
      rr(574,372,206,18,6,'#fff3c4',3.5);rr(584,390,186,30,0,'#ff9ec7',3);
      ell(700,370,24,7,'#ffffff',3);rr(690,352,20,16,3,'#ffd0d8',2.5);
      const bk=lose?ease(clamp((e-.32)/.18,0,1)):0;
      if(bk>0){ell(640,374,34*bk,6*bk,SODA,2.5);if(bk>=1)for(let i=0;i<2;i++){const u=(now*1.4+i*.5)%1;ell(600+i*14,394+u*70,3.5,6,SODA,2);}}
      botella(626+bk*8,372-bk*10,-bk*PI/2);
      /* los bailarines */
      const off=stepD*stepK*16;
      if(!g.result){
        bust(Object.assign({},TIA,{x:TX+off+sw*6,y:TY-bob*9,s:.92,look:1,rot:sw*.06+.03,lids:1,mood:ouch>.3?'yell':good>.3?'grin':'happy',talk:ouch,
          arms:[{side:-1,a:-2.3+sw*.2,len:66,w:20,hand:vaso},{side:1,a:1.35,len:56,w:20}]}));
        bust(Object.assign({},TU,{x:MX+off-sw*5,y:MY-bob*6,s:.85,look:-1,th:110,legs:['#2f3a7a','#ffffff',60],rot:-sw*.05,
          mood:ouch>.3?'panic':good>.4?'grin':strikes>=2?'worry':strikes?'o':'calm',sweat:strikes,talk:0,
          arms:[{side:-1,a:-1.35,len:58,w:20},{side:1,a:.5+sw*.4,len:66,w:20}]}));
        tag(MX+off,MY-142);
        if(g.t<1.1*B*2)bubble(300,300-200+96,'¡VENTE, MIJO!',22,TX+10,TY-104);
      }else if(win){
        /* la vuelta con estilo y el aplauso */
        const sp=clamp(e/.7,0,1),c=Math.cos(sp*TAU*2),k=sp<1?(Math.abs(c)<.14?(c<0?-.14:.14):c):1,hop=sp>=1?Math.abs(Math.sin(e*9))*14:0,cl=Math.sin(now*26)*.22;
        bust(Object.assign({},TIA,{x:TX-14,y:TY-bob*6,s:.92,look:1,mood:e<.7?'o':'grin',talk:e>.7?Math.abs(Math.sin(now*14)):0,arms:[{side:-1,a:2.55+cl,len:60,w:20},{side:1,a:2.55-cl+.5,len:60,w:20}]}));
        ctx.save();ctx.translate(MX+30,0);ctx.scale(k,1);
        bust(Object.assign({},TU,{x:0,y:MY-hop,s:.85,look:-1,th:110,legs:['#2f3a7a','#ffffff',60],mood:sp<1?'o':'happy',arms:sp<1?[{side:-1,a:-2.2,len:70,w:20},{side:1,a:1.2,len:70,w:20}]:[{side:-1,a:-2.6,len:76,w:20},{side:1,a:2.3,len:76,w:20}]}));
        ctx.restore();tag(MX+30,MY-150-hop);
        for(let i=0;i<4;i++){const a=now*4+i*TAU/4;txt('✦',MX+30+Math.cos(a)*92,MY-10+Math.sin(a)*56,20,'#ffe14d');}
        if(e>.45)bubble(300,196,'¡ESE ES MI SOBRINO BELLO!',21,TX,TY-110);
      }else{
        /* tropiezo contra la mesa, y de trapeador */
        const fall=clamp(e/.32,0,1),dg=Math.max(0,e-.75)*170,tx=TX-dg*.8;
        if(e<.32){
          bust(Object.assign({},TIA,{x:TX,y:TY,s:.92,look:1,mood:'o',arms:[{side:-1,a:-2.3,len:66,w:20,hand:vaso},{side:1,a:1.5,len:70,w:20}]}));
          bust(Object.assign({},TU,{x:lerp(MX,560,fall),y:MY+fall*20,s:.85,look:1,th:110,legs:['#2f3a7a','#ffffff',60],rot:fall*.7,mood:'panic',sweat:2,arms:[{side:-1,a:-2.4,len:74,w:20},{side:1,a:2.2,len:74,w:20}]}));
        }else{const u=ease(clamp((e-.32)/.4,0,1)),mx=lerp(560,tx+176,u),my=lerp(MY+60,FY-46,u);
          bust(Object.assign({},TU,{x:mx,y:my,s:.85,look:1,th:110,legs:['#2f3a7a','#ffffff',60],rot:lerp(.7,-1.42,u)+(dg?Math.sin(now*20)*.03:0),mood:'dizzy',arms:[{side:-1,a:-2.95,len:84,w:20},{side:1,a:.5,len:70,w:20}]}));
          bust(Object.assign({},TIA,{x:tx+sw*5,y:TY-bob*9,s:.92,look:dg?-1:1,lids:1,rot:sw*.05,mood:e<.75?'o':'happy',talk:e>.8?Math.abs(Math.sin(now*14)):0,
            arms:[{side:-1,a:-2.3+sw*.2,len:66,w:20,hand:vaso},{side:1,a:u*.75+.6-u*.3,len:lerp(60,96,u),w:20}]}));
          const hx=mx-.85*118,hy=my-.85*22;for(let i=0;i<3;i++){const a=now*5+i*TAU/3;txt('★',hx+Math.cos(a)*40,hy-56+Math.sin(a)*10,20,'#ffe14d');}
          tag(mx+30,my-74);}
        if(e>.8)bubble(clamp(tx+60,210,420),196,'¡PÁRATE, MIJO, QUE ESTA ES LA MÍA!',19,tx+6,TY-110);
      }
      /* el carril: rosadas por la izquierda, azules por la derecha, todas al aro */
      rr(22,LY-36,756,72,24,'#2d2640',4);
      ctx.save();ctx.globalAlpha=.3;rr(30,LY-28,364,56,18,CL,0);rr(406,LY-28,364,56,18,CR,0);ctx.restore();
      flecha(58,LY,-1,stepD<0&&stepK>.2?'#ffffff':CL,.8,3);flecha(742,LY,1,stepD>0&&stepK>.2?'#ffffff':CR,.8,3);
      if(!g.result){const fr=bp-Math.floor(bp),pz=1+good*.25;
        ell(400,LY,10+14*(1-fr),10+14*(1-fr),'#ffe14d',0);
        line(closeP(ellP(400,LY,32*pz,30*pz,18)),7,ouch>.5?'#ff4d5e':'#ffffff');
        for(let i=notes.length-1;i>=0;i--){const n=notes[i];if(n.st)continue;const u=(n.t-g.t)/TR;if(u>1.02||u<-.3)continue;
          const x=400+n.d*340*u,near=Math.abs(n.t-g.t)<=WIN;ell(x,LY,26,26,n.d<0?CL:CR,near?5.5:4);flecha(x,LY,n.d,'#ffffff',.72,3);}}
      else txt(win?'♪ ♫ ♪':'· · ·',400,LY,26,win?'#ffe14d':'#8f8fa8',0,true);
      drawP();
    }};
  return g;
}

BUS.add('baile',{name:'¡SÍGUELE EL PASO!',mk:mkBaile,card:'LA TÍA',num:'78'});
})();
