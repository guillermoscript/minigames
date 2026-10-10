'use strict';
/* MiniCaos · laboratorio de estilos: ¡QUITA EL ANUNCIO! (el anuncio).
   La rumba está en su mejor momento: la laptop de la música (montada en una silla plástica, con la pantalla llena de grasa de
   tequeño) suena salsa brava... y de golpe se corta: cuña de 30 segundos de CHANCLAS CON WIFI, a todo volumen.
   Mecánica (apuntar rápido): el anuncio está lleno de botones tramposos (¡HAZ CLIC!, DESCARGAR, una X falsa). Tras la cuenta
   "SALTAR EN 3, 2, 1" aparece el botoncito GRIS de SALTAR ANUNCIO: hay que darle clic a ESE. El reloj es la paciencia de la gente.
   El botón se VE diminuto pero perdona (zona de toque más grande). Tocar su esquina antes de tiempo no hace nada (¡TODAVÍA NO!).
   Nivel 1: 3 trampas, cuenta de 1 s. Nivel 2: botón más chico, cuenta más larga y un "SALTAR YA" azul falso.
   Nivel 3: otra trampa más (ACEPTAR) y el botón, apenas sale, BRINCA una vez a otra esquina.
   Ganas: vuelve la salsa en el clímax y toda la sala grita ¡WUUUU!. Pierdes (clic al anuncio): se abre otra pestaña
   (¡GANASTE UN CHIGÜIRE!), llueven ventanitas y la fiesta queda en silencio incómodo, con grillo. Pierdes (tiempo): ¡BUUUU!,
   te cae un tequeño en la cabeza y encima viene el ANUNCIO 2 DE 7.
   Teclado: ← → mueven el foco entre los botones (arranca en ¡HAZ CLIC!; el de saltar queda a un ← ) y ESPACIO hace clic.
   El cursor sigue al ratón con un pointermove propio (el laboratorio solo avisa del movimiento con el dedo apretado).
   El sitio (VEOVAINAS), el producto, la salsa y la cuña son inventados/originales.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.anuncio)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI;
const SX0=152,SY0=104,SW=496,SH=288,VY0=130,GRIS='#9a9aa8';
const G1={skin:'#8a5a3a',shirt:'#ffd23f',hair:'afro',hairCol:'#14101c',earring:1,cheeks:1,bw:50,th:110},
  G2={skin:'#e8b48a',shirt:'#ff5ca8',pat:'stripes',sh2:'#ffffff',hair:'slick',hairCol:'#14101c',stache:1,brow:'thick',chain:1,bw:52,th:110};
/* el cursor del juego en curso: sigue al ratón aunque no esté apretado */
let cur=null;
view.addEventListener('pointermove',e=>{if(gameId!=='anuncio'||!cur)return;const r=view.getBoundingClientRect();cur.x=(e.clientX-r.left)/r.width*W;cur.y=(e.clientY-r.top)/r.height*H;cur.kb=false;});
/* la salsa (original): La menor - Re menor - Mi - Re menor, clave 2-3, campana y bajo */
const STEP=.13,CHD=[[220,261.63,329.63],[293.66,349.23,440],[329.63,415.3,493.88],[293.66,349.23,440]],CLAVE=[2,4,8,11,14];
function salsa(i,v=.03){const n=i%16,c=CHD[n>>2],q=n%4;
  if(q===0){snd(c[0],.15,'square',v);snd(c[2]*2,.15,'sawtooth',v);}else if(q===3)snd(c[1]*2,.11,'square',v);else{snd(c[1]*2,.11,'sawtooth',v*.8);snd(c[2]*2,.11,'square',v*.8);}
  if(n%8===3||n%8===6)snd(c[0]/2,.2,'sawtooth',.06);
  if(CLAVE.includes(n))snd(2200,.03,'square',.045);
  if(n%4===0)snd(760,.06,'square',.03);nz(.04,.025);}
/* la cuña de las chanclas: un timbrecito chillón que no se calla */
const JING=[659,659,880,0,659,0,988,880,0,659,784,0,523,0,587,0];
function chiguire(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  for(const lx of[-40,-18,20,40])limb(lx,26,lx,48,13,'#7a4f2a',3);ell(0,0,70,40,'#a9713a',4);rr(40,-52,62,50,18,'#a9713a',4);
  ell(52,-54,8,8,'#7a4f2a',3);ell(88,-54,8,8,'#7a4f2a',3);ell(64,-34,5,6,INK,0);ell(86,-34,5,6,INK,0);rr(74,-22,26,16,7,'#7a4f2a',3);
  poly([[56,-56],[70,-96],[86,-56]],'#ff5c8a',3.5);ell(70,-98,6,6,'#ffe14d',2.5);ctx.restore();}

function mkAnuncio(){
  const lv=LV(),rs=Math.sqrt(SP),T0=.3/rs,CD=[1,1.2,1.4][lv-1]/rs,BW=[96,84,74][lv-1],BH=[24,21,19][lv-1],PAD=[24,18,14][lv-1],tHop=lv>=3?T0+CD+.55/rs:0;
  const CORN={br:[SX0+SW-10-BW,SY0+SH-22-BH],bl:[SX0+10,SY0+SH-22-BH],tl:[SX0+10,VY0+8]};
  const FK=[{x:330,y:196,w:230,h:76,s:'¡HAZ CLIC!',c:'#ff3b4e',f:30},{x:168,y:286,w:150,h:44,s:'DESCARGAR',c:'#2fbf5a',f:18},{x:608,y:138,w:32,h:32,s:'X',c:'#ffffff',f:20}];
  if(lv>=2)FK.push({x:492,y:284,w:146,h:40,s:'SALTAR YA ▶',c:'#3fb0ff',f:16});
  if(lv>=3)FK.push({x:346,y:322,w:124,h:38,s:'ACEPTAR',c:'#ff8a3d',f:16});
  let sk=CORN.br.slice(),hopped=false,hopK=0,cut=false,si=0,jT=0,ji=0,cdN=4,shown=false,flash=0,foc=0,said=0,ev=0,kind='',noteT=0,nag=0;
  cur={x:400,y:470,kb:false};const me=cur;
  const ad=()=>g.t>=T0,vis=()=>g.t>=T0+CD,items=()=>vis()?FK.concat([{x:sk[0],y:sk[1],w:BW,h:BH}]):FK;
  function win(){g.result='win';g.why='¡WUUUU!';si=0;sfx.win();snd(300,.5,'sawtooth',.05,900);spawn(400,240,30,'conf',CONF,380);spawn(90,230,8,'conf',CONF);spawn(710,230,8,'conf',CONF);}
  function fail(k){kind=k;g.result='lose';
    if(k==='clic'){g.why='¡ERA EL OTRO!';nz(.12,.2);[392,494,587,784].forEach((f,i)=>snd(f,.1+i*.03,'square',.06));}
    else{g.why='¡BUUUU!';sfx.lose();snd(150,.9,'sawtooth',.08,-50);snd(170,.8,'sawtooth',.06,-60);}}
  function click(p){if(g.result)return;me.x=p.x;me.y=p.y;
    if(!ad()){snd(180,.04,'square',.03);return;}
    if(p.x>=sk[0]-PAD&&p.x<=sk[0]+BW+PAD&&p.y>=sk[1]-PAD&&p.y<=sk[1]+BH+PAD){
      if(vis())win();else if(nag<=0){nag=.5;snd(200,.07,'square',.04);say('¡TODAVÍA NO!',clamp(sk[0]+BW/2,240,560),sk[1]-26,'#ffffff');}
      return;}
    if(p.x<SX0||p.x>SX0+SW||p.y<VY0||p.y>SY0+SH){snd(180,.04,'square',.03);return;}
    fail('clic');}

  /* la gente: k = qué tan hartos están (0..1) */
  function gente(k){const win=g.result==='win',lose=g.result==='lose',e=g.endT,clic=lose&&kind==='clic',buu=lose&&!clic,beat=win?e/STEP:0;
    for(const[o,x,sg,d]of[[G1,70,-1,0],[G2,730,1,.15]]){const kk=k+d,hop=win?Math.abs(Math.sin(beat*PI/4+d*9))*14:buu?Math.abs(Math.sin(now*14+d*9))*5:0;
      bust(Object.assign({},o,{x,y:300-hop,s:.8,flip:sg>0,rot:win?Math.sin(beat*PI/4)*.06:0,
        mood:win?'happy':clic?(e<.7?'o':'calm'):buu?'yell':!ad()?'happy':kk<.3?'o':kk<.55?'frown':kk<.85?'angry':'yell',
        talk:buu||(!g.result&&kk>=.85)?Math.abs(Math.sin(now*16)):0,look:clic?0:1,down:clic?1:0,lids:clic&&e>.7?1:0,vein:!g.result&&kk>=.55?1:0,
        arms:win?[{side:-1,a:PI+.5+Math.sin(now*10+d)*.3,len:54,w:18},{side:1,a:PI-.5+Math.sin(now*10+d+2)*.3,len:54,w:18}]
          :buu?[{side:1,a:PI-.9+Math.sin(now*18)*.2,len:52,w:18}]:null}));}
    /* tú, el encargado de la música */
    const bonk=buu&&e>=.55;
    bust(Object.assign({},TU,{x:84,y:505+(win?-Math.abs(Math.sin(beat*PI/4))*10:0),s:.8,th:70,
      mood:win?'grin':clic?(e<.6?'panic':'worry'):buu?(bonk?'dizzy':'frown'):!ad()?'smile':k<.35?'o':k<.7?'worry':'panic',
      look:1,sweat:g.result?(clic?2:0):k>.7?2:k>.35?1:0,
      arms:win?[{side:1,a:PI-.3+Math.sin(now*12)*.25,len:56,w:18}]:g.result?null:[{side:1,a:2.1+(k>.7?Math.sin(now*24)*.12:0),len:58,w:18}]}));
    if(!g.result&&g.t<1.3/rs)tag(84,548);
    if(buu){const u=clamp((e-.25)/.3,0,1),tx=bonk?92:lerp(700,84,u),ty=bonk?412+Math.min(1,(e-.55)*3)*4:lerp(250,420,u)-Math.sin(u*PI)*120;
      if(e>=.25){ctx.save();ctx.translate(tx,ty);ctx.rotate(bonk?.3:e*20);limb(-18,0,18,0,13,'#e0a95a',3.5);ctx.restore();}}}

  function pantalla(){const win=g.result==='win',lose=g.result==='lose',e=g.endT,clic=lose&&kind==='clic';
    ctx.save();path(rrP(SX0,SY0,SW,SH,4));ctx.clip();
    if(win||!ad()){/* el video de la salsa */
      rr(SX0,SY0,SW,SH,0,'#2a1650',0);
      for(let i=0;i<14;i++){const h=40+Math.abs(Math.sin(now*(win?11:8)+i*1.7))*(win?170:110);rr(SX0+22+i*33,SY0+SH-24-h,24,h,4,CONF[i%4],3);}
      txt('SALSA BRAVA MIX',400,166,30,'#ffe14d');txt('3 HORAS · PA\' BAILAR PEGAO',400,196,14,'#ffffff',0,true);
    }else{/* la cuña */
      const fl=Math.sin(now*14)>0;rr(SX0,SY0,SW,SH,0,fl?'#ffe14d':'#ff9ec7',0);
      for(let i=0;i<10;i++){const a=i*TAU/10+now*.8;poly([[400,250],[400+Math.cos(a)*420,250+Math.sin(a)*420],[400+Math.cos(a+.3)*420,250+Math.sin(a+.3)*420]],fl?'#fff3a8':'#ffc4de',0);}
      const dos=lose&&e>.9;txt(dos?'¡ANUNCIO 2 DE 7!':'¡CHANCLAS CON WIFI!',400,158+Math.sin(now*9)*2,dos?28:25,dos?'#ff3b4e':'#2f7fe0',-.02);
      chanclaP(244,226+Math.sin(now*7)*5,-.35+Math.sin(now*5)*.1,1.5);
      for(let i=1;i<=3;i++)line(arcPts(282,196,10*i,-PI*.75,-PI*.25,6),4,i<=1+Math.floor(now*5)%3?'#2f7fe0':'#c4cad6');
      txt('¡LLAME YA AL 0-800-CHANCLA!',400,374,11,INK,0,true);
      for(const b of FK){const pz=b.f>=30?1+Math.sin(now*12)*.05:1,cx=b.x+b.w/2,cy=b.y+b.h/2;rr(cx-b.w*pz/2,cy-b.h*pz/2,b.w*pz,b.h*pz,b.h>50?16:8,b.c,3.5);txt(b.s,cx,cy+1,b.f*pz,b.c==='#ffffff'?INK:'#ffffff',0,b.c==='#ffffff');}
      /* el botoncito gris de verdad */
      const v=vis(),hk=hopK>0?Math.sin(hopK*PI)*10:0;rr(sk[0],sk[1]-hk,BW,BH,3,flash>0&&Math.sin(now*40)>0?'#ffffff':GRIS,2);
      txt(v?'SALTAR ANUNCIO':'SALTAR EN '+clamp(cdN,1,3),sk[0]+BW/2,sk[1]+BH/2+1-hk,BW/10.5,v?INK:'#e8e8ee',0,true);
      rr(SX0,SY0+SH-8,SW,8,0,'#5a5274',0);rr(SX0,SY0+SH-8,SW*clamp((g.t-T0)/30,0,1)+6,8,0,'#ffe14d',0);}
    /* la barra del sitio */
    rr(SX0,SY0,SW,26,0,'#1f6f6a',0);txt('▶ VEOVAINAS',214,117,14,'#ffffff',0,true);
    if(ad()&&!win)txt('ANUNCIO · 0:'+String(Math.max(0,30-Math.floor(g.t-T0))).padStart(2,'0'),588,117,12,'#ffe14d',0,true);
    if(clic){/* la otra pestaña */
      const k=ease(clamp(e/.15,0,1));ctx.save();ctx.translate(400,248);ctx.scale(k,k);ctx.translate(-400,-248);
      rr(SX0,SY0,SW,SH,0,'#fff8e0',0);rr(SX0,SY0,SW,26,0,'#c9ced6',0);txt('✕  gane-un-chiguire.caos  ·  PESTAÑA NUEVA',330,117,12,INK,0,true);
      txt('¡GANASTE UN CHIGÜIRE!',400,160+Math.sin(now*10)*2,30,'#ff3b4e',-.02);chiguire(380,290,.95);
      txt('(solo pagas el envío, en 36 cuotas)',400,374,13,INK,0,true);ctx.restore();
      const POP=[[176,200],[512,190],[196,300],[520,304]];for(let i=0;i<ev&&i<4;i++){const[x,y]=POP[i];rr(x,y,118,62,4,'#ffffff',3);rr(x,y,118,14,0,'#ff5c8a',0);txt('¡GANASTE!',x+59,y+30,13,'#ff3b4e',0,true);txt('ACEPTAR',x+59,y+49,9,INK,0,true);}}
    /* la grasa de tequeño */
    ctx.save();ctx.globalAlpha=.24;ell(300,338,58,20,'#fff3c4',0);ell(540,176,34,46,'#fff3c4',0);ell(206,170,26,18,'#fff3c4',0);
    for(let i=0;i<3;i++)line([[430+i*16,300],[470+i*16,370]],9,'#fff3c4');ctx.restore();
    ctx.restore();}

  const g={lr:true,get impact(){return this.result?clamp(1-this.endT/.5,0,1):0;},
    probe:()=>({lv,ad:ad(),vis:vis(),sx:sk[0]+BW/2,sy:sk[1]+BH/2,hopped,foc,kb:me.kb,fk:FK.map(b=>({x:b.x+b.w/2,y:b.y+b.h/2})),kind}),
    t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡QUITA EL ANUNCIO!',hint:'CLIC/TOCA el botoncito GRIS de saltar · teclado: ← → eligen, ESPACIO hace clic',
    press(k){if(g.result||!ad())return;const it=items(),n=it.length;
      if(k==='left'||k==='right'){foc=(foc+(k==='left'?n-1:1))%n;me.kb=true;snd(520,.03,'square',.03);}
      else if(k==='any'){if(!me.kb){me.kb=true;snd(520,.03,'square',.03);return;}const b=it[foc%n];click({x:b.x+b.w/2,y:b.y+b.h/2});}},
    down(p){me.kb=false;click(p);},move(p){me.x=p.x;me.y=p.y;},up(){},
    update(dt){g.t+=dt;flash=Math.max(0,flash-dt);hopK=Math.max(0,hopK-dt*4);nag=Math.max(0,nag-dt);
      if(!g.result){
        if(!ad()){while(g.t>=si*STEP)salsa(si++);}
        else{if(!cut){cut=true;sfx.screech();say('¡SE CORTÓ!',400,470,'#ff4d5e');}
          if((jT-=dt)<=0){jT=.11;const f=JING[ji++%16];if(f){snd(f,.1,'square',.045);snd(f*1.5,.08,'sawtooth',.025);}}
          const n=Math.ceil((T0+CD-g.t)/CD*3);if(n!==cdN&&n>=1){cdN=n;snd(440,.05,'sine',.05);}
          if(vis()&&!shown){shown=true;flash=.35;snd(1320,.12,'sine',.08);}
          if(tHop&&!hopped&&g.t>=tHop){hopped=true;hopK=1;sk=CORN[Math.random()<.5?'bl':'tl'].slice();sfx.boing();say('¡JE JE!',sk[0]+70,sk[1]-(sk[1]<200?-46:24),'#ffffff');}
          if(me.kb){const it=items(),b=it[foc%it.length];me.x=b.x+b.w/2;me.y=b.y+b.h/2;}
          const k=(g.t-T0)/(g.dur-T0);
          if(said<1&&k>.4){said=1;say('¡QUITA ESO!',100,176,'#ffe14d');snd(160,.2,'sawtooth',.04,-30);}
          if(said<2&&k>.65){said=2;say('¡DALE PUES!',696,170,'#ffe14d');snd(140,.2,'sawtooth',.04,-30);}
          if(said<3&&k>.85){said=3;say('¡BUUU...!',100,176,'#ff9ec7');snd(130,.3,'sawtooth',.05,-30);}
          if(g.t>=g.dur)fail('buu');}}
      else{g.endT+=dt;const e=g.endT;
        if(g.result==='win'){while(e>=.1+si*STEP)salsa(si++,.04);
          if(ev<1&&e>=.15){ev=1;snd(700,.5,'sawtooth',.05,600);snd(900,.5,'square',.03,500);}
          if((noteT-=dt)<=0){noteT=.16;PT.push({x:180+Math.random()*440,y:400,vx:(Math.random()-.5)*80,vy:-110,g:0,t:0,life:.9,kind:Math.random()<.5?'♪':'♫',col:CONF[si%4],r:6,rot:(Math.random()-.5)*.6,vr:0});}}
        else if(kind==='clic'){
          for(const tq of[.4,.65,.9,1.1])if(ev<4&&e>=tq&&ev===[.4,.65,.9,1.1].indexOf(tq)){ev++;snd(880+ev*110,.06,'square',.05);}
          if(ev===4&&e>=1.3){ev=5;snd(4200,.05,'sine',.04);snd(4200,.05,'sine',.03,200);}
          if(ev===5&&e>=1.55){ev=6;snd(4200,.05,'sine',.04);}
          if(ev===6&&e>=1.85){ev=7;sfx.cluck();}}
        else{if((jT-=dt)<=0){jT=.11;const f=JING[ji++%16];if(f)snd(f,.1,'square',.04);}
          if(ev<1&&e>=.55){ev=1;sfx.boing();nz(.06,.12);spawn(92,410,6,'bit',['#e0a95a','#c98a3a'],180,500,.6);}
          if(ev<2&&e>=.9){ev=2;snd(988,.3,'square',.06);snd(1319,.3,'square',.05);}}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,clic=lose&&kind==='clic',k=clamp((g.t-T0)/(g.dur-T0),0,1),thump=win||!ad()?Math.abs(Math.sin(now*PI/STEP/4)):0;
      /* la sala */
      wash(0,0,800,600,'#ffcf8a','#f7a86b');rr(0,468,800,132,0,'#b5764a',0);line([[0,468],[800,468]],4,INK);
      for(const[x,y,c]of[[34,128,'#ff5c8a'],[770,124,'#3fb0ff'],[14,168,'#5cff7a']]){line([[x,y+26],[x+4,y+90]],2.5,INK);ell(x,y,21,27,c,3.5);ell(x-6,y-8,5,8,'#ffffff',0);}
      /* la corneta con la gallina de siempre: baila si hay música, se asoma si hay silencio */
      rr(672,474,104,98,8,'#2d2640',4);ell(724,506,22+thump*4,22+thump*4,'#5a5274',3.5);ell(724,506,8,8,INK,0);ell(724,550,12,12,'#5a5274',3);
      ctx.save();ctx.translate(722,448-thump*8);ctx.rotate(win?Math.sin(now*12)*.2:0);ctx.scale(-1,1);hen(0,0,.6,clic?-1:1);ctx.restore();
      if(clic&&e>=1.85)bubble(690,404,'¿CO?',14,716,424);
      gente(k);
      /* la silla plástica y la laptop */
      limb(176,462,156,572,15,'#f1ece2',3.5);limb(624,462,644,572,15,'#f1ece2',3.5);rr(128,440,544,24,9,'#ffffff',4);
      rr(140,94,520,310,12,'#2d2640',4.5);poly([[140,404],[660,404],[690,440],[110,440]],'#c4cad6',4);
      for(let r=0;r<2;r++)for(let i=0;i<13;i++)rr(160+i*37-r*6,410+r*13,30+r,9,2,'#5a5274',0);
      ctx.save();ctx.translate(586,424);ctx.rotate(.2);limb(-17,0,17,0,12,'#e0a95a',3.5);ctx.restore();ell(300,428,16,6,'#fff3c4',0);
      pantalla();
      /* foco del teclado y cursor */
      if(!g.result&&ad()){
        if(me.kb&&Math.sin(now*16)>-.6){const it=items(),b=it[foc%it.length];line(closeP(rrP(b.x-6,b.y-6,b.w+12,b.h+12,7)),5,INK);line(closeP(rrP(b.x-6,b.y-6,b.w+12,b.h+12,7)),2.5,'#ffe14d');}}
      if(!g.result||e<.3){const x=me.x,y=me.y;poly([[x,y],[x,y+23],[x+6,y+17],[x+11,y+27],[x+15,y+25],[x+10,y+16],[x+18,y+16]],'#ffffff',2.5);}
      /* lo que se dice */
      if(win&&e>.12){bubble(92,170,'¡WUUUU!',20,74,214);bubble(706,166,'¡WUUUU!',20,726,212);}
      if(clic){if(e>.6)bubble(84,176,'. . .',20,72,214);if(e>1)bubble(706,170,'¿Y ESO?',17,726,212);if(e>1.3)bubble(176,490,'FUE SIN QUERER',13,124,468);}
      if(lose&&!clic){bubble(92,170,'¡BUUUU!',20,74,214);if(e>.3)bubble(700,166,'¡FUERA!',19,726,212);}
      drawP();
    }};
  return g;
}

BUS.add('anuncio',{name:'¡QUITA EL ANUNCIO!',mk:mkAnuncio,card:'EL ANUNCIO',num:'81'});
})();
