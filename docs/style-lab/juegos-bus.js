'use strict';
/* MiniCaos · laboratorio de estilos: tres microjuegos de camionetica.
   ¡BAJA! (machacar), ¡ENCALETA! (reflejo + arrastrar) y ¡AGÁRRATE! (equilibrio).
   Se carga DESPUÉS del script de index.html y dibuja con sus primitivas (bust, rr, ell, line, txt...), así que cada juego
   sale en todos los estilos sin tocar nada. No modifica PARADA ni CHANCLA: solo agrega entradas a GAMES y sus propios
   listeners (puntero con coordenadas, izquierda/derecha sostenido, inclinación del teléfono).
   Nivel = LV() (1/2/3): lo fija el modo niveles con window.NIVEL; sin eso sale del botón "vel" (1x / 1.4x / 1.8x).
   La velocidad (SP) es otro eje: acelera todo, pero los giros de cada nivel (anotados encima de cada juego) no dependen de ella. */
(function(){
if(GAMES.baja)return;
/* el nivel ya no sale de la velocidad: el modo niveles (campana.js) fija window.NIVEL = 1/2/3 antes de cada mk().
   Sin eso (bus.html, el banco de pruebas) sigue saliendo del botón "vel". */
const LV=()=>window.NIVEL||(SP>=1.7?3:SP>=1.3?2:1);
const CONF=['#ffd23f','#ff5c8a','#5cff7a','#3fb0ff'];
const say=(s,x,y,col)=>PT.push({x,y,vx:0,vy:-60,g:0,t:0,life:.8,kind:s,col,r:-2,rot:(Math.random()-.5)*.16,vr:0});
const TU={skin:'#e9a77c',shirt:'#3fb0ff',pat:'hoodie',hair:'curly',hairCol:'#2a1a14',cheeks:1,brow:'thin',bw:50,hw:38,hh:40,eyeR:10};
const tag=(x,y)=>{rr(x-28,y-14,56,28,10,'#ffd23f',3.5);txt('TÚ',x,y,18,INK,0,true);};
function phone(x,y,rot=0,s=1){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);rr(-14,-25,28,50,7,'#14101c',3.5);rr(-10,-19,20,34,3,'#7fe0d0',0);ell(0,20,2.5,2.5,'#8f8fa8',0);ctx.restore();}

/* ───────── input propio ───────── */
const MINE={},heldK={l:0,r:0},heldP={l:0,r:0};let tilt=0,tiltAsked=false,ptr=false,lastP={x:0,y:0};
const steer=()=>clamp(heldK.r-heldK.l+heldP.r-heldP.l+tilt,-1,1);
const cpos=canvasPoint;
view.addEventListener('pointerdown',e=>{if(!MINE[gameId]||!G)return;try{view.setPointerCapture(e.pointerId);}catch(_){}
  const a=A();a.resume&&a.resume();const p=cpos(e);lastP=p;ptr=true;heldP.l=+(p.x<W/2);heldP.r=+(p.x>=W/2);if(G.down)G.down(p);
  if(gameId==='agarrate'&&!tiltAsked&&window.DeviceOrientationEvent&&DeviceOrientationEvent.requestPermission){tiltAsked=true;DeviceOrientationEvent.requestPermission().catch(()=>{});}});
view.addEventListener('pointermove',e=>{if(ptr&&MINE[gameId]&&G){lastP=cpos(e);if(G.move)G.move(lastP);}});
/* en captura: estos juegos no usan el "soltar = presionar" del laboratorio.
   Un pointercancel cuenta como soltar donde estaba el dedo, para que nada se quede "agarrado". */
const end=e=>{heldP.l=heldP.r=0;if(!ptr)return;ptr=false;if(MINE[gameId]&&G){if(G.up)G.up(e.type==='pointerup'?cpos(e):lastP);pdown=null;e.stopImmediatePropagation();}};
addEventListener('pointerup',end,true);addEventListener('pointercancel',end,true);
addEventListener('keydown',e=>{const L=e.code==='ArrowLeft'||e.code==='KeyA',R=e.code==='ArrowRight'||e.code==='KeyD';if(!L&&!R)return;
  if(MINE[gameId])e.preventDefault();if(e.repeat)return;if(L)heldK.l=1;else heldK.r=1;if(MINE[gameId]&&G&&G.lr)G.press(L?'left':'right');});
addEventListener('keyup',e=>{if(e.code==='ArrowLeft'||e.code==='KeyA')heldK.l=0;else if(e.code==='ArrowRight'||e.code==='KeyD')heldK.r=0;});
addEventListener('blur',()=>{heldK.l=heldK.r=0;});
addEventListener('deviceorientation',e=>{const v=e.gamma==null?0:e.gamma;tilt=Math.abs(v)<4?0:clamp(v/22,-1,1);});

/* ═════════ GAME 3: ¡BAJA! (pide permiso hasta la puerta antes de que cierre) ═════════ */
/* Nivel 1: solo machacar. Nivel 2: además un vecino bravo (te espera con la mano de «pare») te devuelve DOS pasos de un empujón, una sola vez.
   Nivel 3: el empujón + la gente más apretada + la señora de las dos tortas. */
function mkBaja(){
  const rs=Math.sqrt(SP),lv=LV(),need=Math.round(11+(SP-1)*6),X0=92,X1=644,FY=524,STEP=(X1-X0)/need;
  const crowd=(lv>=3?[196,292,388,484]:[210,322,434,546]).map((x,i)=>({x,f:FACES[[4,6,9,1][i]],say:['¡EPA!','¡AY, MIJO!','¡ME PISASTE!','¡CONCHALE!'][i],push:0,said:false}));
  const torta=lv>=3?{x:584,on:true}:null;
  const emp=lv>=2?crowd[1+(Math.random()*2|0)]:null;      /* el que empuja: uno de los dos del medio */
  let px=X0,lunge=0,taps=0,scroll=0,kEnd=0,kb=0,shv=0;
  const g={get impact(){return this.result?clamp(1-this.endT/.5,0,1):0;},probe:()=>({px,taps,need,emp:emp?emp.x:0,did:!!(emp&&emp.did)}),t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡BAJA!',
    hint:'TOCA RÁPIDO (o ESPACIO): pide permiso y llega a la puerta antes de que cierre',
    press(){if(g.result)return;taps++;lunge=1;snd(170+(taps%5)*26,.07,'square',.045);
      px=Math.min(X1,px+STEP*(torta&&torta.on&&px>torta.x-76?.5:1));
      if(emp&&!emp.did&&px>=emp.x-58){emp.did=emp.said=true;shv=1;kb=Math.min(px-X0,2*STEP);px-=kb;sfx.thud();spawn(emp.x-56,FY-200,7,'★',['#ffe14d'],220,400,.7);say("¡PA' ATRÁS!",px+kb*.5,FY-300,'#ff4d5e');}
      if(taps%4===1)say('¡PERMISO!',px+10,FY-262,'#ffffff');
      for(const c of crowd)if(Math.abs(px-c.x)<58){c.push=1;if(!c.said){c.said=true;say(c.say,c.x,FY-286,'#ffe14d');}}
      if(torta&&torta.on&&px>=torta.x+14){torta.on=false;sfx.crash();spawn(torta.x-30,FY-170,18,'bit',['#ff9ec7','#ffffff','#ffd23f'],320,800,1);say('¡MI TORTA!',torta.x,FY-300,'#ff9ec7');}
      if(px>=X1){g.result='win';g.why='¡BAJASTE!';kEnd=clamp(g.t/g.dur,0,1);sfx.win();spawn(724,330,24,'conf',CONF);}},
    down(){g.press();},
    update(dt){g.t+=dt;lunge=Math.max(0,lunge-dt*6);kb*=Math.exp(-12*dt);shv=Math.max(0,shv-dt/.9);for(const c of crowd)c.push=Math.max(0,c.push-dt*2.2);
      if(!g.result){px=Math.max(X0,px-14*rs*dt);if(g.t>=g.dur){g.result='lose';g.why='¡TE PASASTE!';sfx.thud();sfx.lose();}}
      else{g.endT+=dt;if(g.result==='lose')scroll+=Math.min(560,g.endT*460)*dt;else px=Math.min(730,px+380*dt);}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',k=win?kEnd*Math.max(0,1-g.endT*5):clamp(g.t/g.dur,0,1),kk=k*k*(3-2*k);
      ctx.save();if(lose)ctx.translate(0,Math.sin(now*34)*1.6);
      /* pared, techo y pasamanos */
      wash(0,0,800,600,'#f6e3b4','#ecd29a');
      rr(0,92,800,36,0,'#d9dce6',0);line([[0,128],[800,128]],4,INK);txt('PROHIBIDO HABLARLE AL CHOFER',250,110,13,INK,0,true);
      line([[0,150],[650,150]],8,'#c4cad6');
      for(let i=0;i<6;i++){const x=70+i*104,sw=Math.sin(now*(lose?9:2)+i)*(lose?8:2);line([[x,150],[x+sw,178]],4,'#3b3550');line(closeP(ellP(x+sw,190,10,12,10)),4,'#ffd23f');}
      /* ventanas con la calle */
      for(let i=0;i<4;i++){const wx=30+i*156;rr(wx,200,134,118,12,'#5a4a78',4.5);
        ctx.save();path(rrP(wx+6,206,122,106,8));ctx.clip();wash(wx,200,134,118,'#8fd8ff','#e8f8ff');
        for(let j=0;j<6;j++){const bx=((j*170-scroll)%1020+1020)%1020-120;rr(bx,236+(j%3)*16,128,100,4,['#ffb36b','#a9a0ff','#ff9ec7','#6ecf8f','#ffd23f','#8aa0ff'][j],3);}
        ctx.restore();}
      /* asientos + la gallina de siempre */
      for(let i=0;i<5;i++){const sx=14+i*130;rr(sx,356,104,170,18,'#3fa0ff',4);rr(sx+10,340,84,40,14,'#6fbcff',3.5);}
      hen(60,326,.6,1);
      rr(0,FY,800,80,0,'#5a5274',0);line([[0,FY],[800,FY]],5,INK);for(let i=0;i<9;i++)rr(i*95-10,FY+34,56,6,3,'#6f6790',0);
      /* la puerta ES el reloj: las hojas se van cerrando */
      rr(654,140,146,FY-132,10,'#2d2640',4.5);
      ctx.save();path(rrP(664,150,128,FY-150,6));ctx.clip();wash(664,150,128,300,'#8fd8ff','#e8f8ff');rr(664,430,128,FY-430,0,'#d8d2c4',0);line([[664,430],[792,430]],4,INK);
      pole(752,300,FY);rr(716,268,72,40,8,'#2f7fe0',4);txt('PARADA',752,288,13,'#ffffff',0,true);
      const lw=64*kk;if(lw>2)for(const lx of[664,792-lw]){rr(lx,150,lw,FY-150,0,'#ff6b3d',4);if(lw>30)rr(lx+8,196,lw-16,110,6,'#bfe9ff',3);}
      ctx.restore();
      rr(654,FY-6,146,14,4,'#ffd23f',3.5);rr(672,96,112,34,8,'#c4283a',3.5);txt('BAJADA',728,114,17,'#ffffff',0,true);
      /* la gente del pasillo */
      /* el que empuja se lee por la pose: antes, la mano de «pare» hacia ti; en el empujón, los dos brazos estirados */
      const drawC=c=>{const sh=c===emp&&shv>.45,wt=c===emp&&!c.did&&!g.result,q=sh?0:c.push,dir=px<c.x?1:-1;
        bust(Object.assign({},c.f,{x:c.x+dir*q*12-(sh?26:0),y:FY-146-q*10,s:.84,th:110,bw:50,legs:['#3b3550','#ffffff',64],rot:sh?-.15:dir*q*.17+Math.sin(now*(lose?8:3)+c.x)*(lose?.06:.02),
          mood:sh?'yell':wt?'angry':q>.3?'yell':lose?'calm':c.f.mood,talk:sh?1:q,sweat:q>.3?1:0,look:sh||wt?-1:q>.3?-dir:0,
          arms:sh?[{side:-1,a:-1.45,len:100,w:19},{side:1,a:-1.3,len:100,w:19}]
            :wt?[{side:-1,a:-1.35,len:60,w:19,hand:(hx,hy)=>hand(hx-4,hy-2,0,1.5,c.f.skin)},{side:1,a:.12,len:84,w:19}]
            :[{side:-1,a:-.12,len:84,w:19},{side:1,a:.12,len:84,w:19}]}));};
      const drawT=()=>{const on=torta.on,wob=Math.sin(now*9)*(.05+lunge*.12);
        bust({x:torta.x,y:FY-150,s:.86,flip:true,skin:'#d9a07a',shirt:'#9b6bd1',pat:'floral',sh2:'#ffe08a',hair:'bun',hairCol:'#d8d8e0',glasses:'round',wrinkles:1,cheeks:1,th:112,bw:52,legs:['#d9a07a','#2b2b3a',62],
          mood:on?(px>torta.x-120?'angry':'calm'):'yell',talk:on?0:1,look:1,
          arms:on?[{side:1,a:1.15,len:62,w:20,hand:(x,y)=>{ctx.save();ctx.translate(x+6,y-6);ctx.rotate(wob);rr(-40,-34,84,34,5,'#ffffff',3.5);line([[2,-34],[2,0]],4,'#ff5ca8');rr(-34,-66,72,32,5,'#ff9ec7',3.5);line([[2,-66],[2,-34]],4,'#c4283a');ctx.restore();}},{side:-1,a:.9,len:50,w:20}]
            :[{side:1,a:2.6,len:70,w:20},{side:-1,a:-2.6,len:70,w:20}]});};
      const hop=win?Math.abs(Math.sin(g.endT*9))*26:0;
      const emj=shv>.45&&!g.result;
      const me=()=>{bust(Object.assign({},TU,{x:px+kb+lunge*8,y:FY-136-lunge*8-hop,s:.8,look:1,th:110,legs:['#2f3a7a','#ffffff',60],
          mood:win?'happy':lose?'frown':emj?'o':lunge>.3?'yell':k>.7?'panic':'worry',talk:lunge,sweat:win?0:k>.5?2:1,lids:lose?1:0,rot:win?0:lose?-.04:emj?-.22:.08+lunge*.1,
          arms:win?[{side:1,a:2.7,len:80,w:20},{side:-1,a:-2.7,len:80,w:20}]:lose?[{side:1,a:.1,len:80,w:20},{side:-1,a:-.1,len:80,w:20}]
            :emj?[{side:1,a:2.2,len:76,w:20},{side:-1,a:-2.2,len:76,w:20}]:[{side:1,a:1.3+lunge*.3,len:76,w:20},{side:-1,a:1.1-lunge*.5,len:66,w:20}]}));};
      for(const c of crowd)if(c.x<px)drawC(c);if(torta&&torta.x<px)drawT();
      me();
      for(const c of crowd)if(c.x>=px)drawC(c);if(torta&&torta.x>=px)drawT();
      tag(px+kb,FY-250-hop);
      ctx.restore();
      if(lose&&g.endT>.5)bubble(470,170,'¡ÚLTIMA PARADA: NUEVO CIRCO!',22,772,250);
      if(win&&g.endT>.25)bubble(520,180,'¡GRACIAS, SEÑOR!',24,px-10,FY-270);
      if(shv>0&&!g.result)bubble(clamp(emp.x-20,170,520),176,'¡NO EMPUJE, CHAMO!',22,emp.x-16,FY-262);
      drawP();
    }};
  return g;
}

/* ═════════ GAME 4: ¡ENCALETA! (se montan a robar el bus: esconde el teléfono antes de que lleguen a tu puesto; con el vendedor, quieto) ═════════ */
/* Nivel 1: un teléfono; el vendedor de chupetas sale poco (.35). Nivel 2: el ladrón camina 15% más rápido y el vendedor sale casi siempre (.9).
   Nivel 3: DOS cosas, el teléfono Y la cartera, cada una en un escondite distinto (en cada escondite cabe una sola); el ladrón tarda un pelo más
   en llegar (2.1 en vez de 1.5) y el vendedor sale como antes (.8). El vendedor siempre camina a su paso de siempre (VSP). */
function mkEncaleta(){
  const rs=Math.sqrt(SP),lv=LV(),RE=[1.5,1.5/1.15,2.1][lv-1]/rs,decoy=Math.random()<[.35,.9,.8][lv-1];
  const tB=decoy?.45/rs:1e9;let tM=decoy?(2.25+Math.random()*.25)/rs:(.9+Math.random()*1.3)/rs;
  const DX=748,SNX=440,SPD=(DX-SNX)/RE,VSP=(DX-SNX)*rs/1.5,AY=452,HOME=[350,300],HOME2=[84,306],PX=215,PY=318,PS=1.05;
  const SPOTS=[{x:150,y:540,n:'MEDIA'},{x:226,y:466,n:'PRETINA'},{x:430,y:548,n:'ASIENTO'}];
  const pas=[{x:640,f:FACES[7]},{x:536,f:FACES[6]}].map(p=>({...p,rob:false}));
  /* lo que hay que esconder: w=0 teléfono (mano derecha), w=1 cartera (mano izquierda, solo nivel 3). drag = la cosa agarrada */
  const its=[{x:HOME[0],y:HOME[1],h:HOME,hid:null,hidT:0,w:0}];if(lv>=3)its.push({x:HOME2[0],y:HOME2[1],h:HOME2,hid:null,hidT:0,w:1});
  const ph=its[0],all=()=>its.every(i=>i.hid),libre=s=>!its.some(i=>i.hid===s),vic=()=>robI||its.find(i=>!i.hid)||ph;
  let drag=null,robI=null,cueB=false,cueM=false,snT=-1,note=0,scroll=0,loot=0,paid=false;
  const vx=(t0,sp=SPD)=>DX-(g.t-t0)*sp;
  function wallet(x,y,rot=0,s=1){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);rr(-15,-23,26,14,2,'#5cd06a',2.5);rr(-21,-14,42,28,6,'#8a5a2b',3.5);line([[-21,-2],[21,-2]],2.5,'#5a3716');ell(12,6,4,4,'#ffd23f',2.5);ctx.restore();}
  /* si ganas, el ladrón se queda un momento frente a ti antes de irse; si pierdes, sale corriendo con el saco */
  const robX=()=>{if(snT<0)return vx(tM);const u=g.t-snT;return g.result==='win'?SNX+700*Math.max(0,u-1.25)**2:SNX+120*u+320*u*u;};
  function hide(it,s){if(g.result||!it||it.hid)return;
    if(!libre(s)){if(drag===it)drag=null;snd(120,.12,'square',.05);say('¡AHÍ NO CABE!',s.x,s.y-74,'#ff4d5e');return;}
    it.hid=s;it.hidT=0;if(drag===it)drag=null;sfx.whoosh();
    if(g.t<tM){g.result='lose';g.why='¡FALSA ALARMA!';g.kind=g.t>=tB&&vx(tB,VSP)>120?'pana':'nada';tM=1e9;sfx.lose();}}
  /* el vendedor de chupetas: la falsa alarma */
  function vendedor(x){const sw=Math.sin(now*9);
    bust({x,y:AY-112-Math.abs(sw)*4,s:.66,flip:true,skin:'#8a5a3a',shirt:'#ffd23f',pat:'stripes',sh2:'#3aa86a',hair:'afro',hairCol:'#14101c',mood:g.kind==='pana'?'frown':'happy',cheeks:1,earring:1,look:1,th:110,bw:52,legs:['#2f7fe0','#ffffff',60],rot:sw*.04,
      arms:[{side:1,a:2.3+sw*.15,len:70,w:19,hand:(hx,hy)=>{rr(hx-30,hy-34,60,30,5,'#ff5ca8',3.5);for(let i=0;i<4;i++){line([[hx-20+i*13,hy-34],[hx-20+i*13,hy-48]],2.5,'#ffffff');ell(hx-20+i*13,hy-52,6,6,['#ff3b4e','#ffd23f','#5cff7a','#3fb0ff'][i],2.5);}}},{side:-1,a:-.3,len:70,w:19}]});}
  /* el que recoge los teléfonos: sin armas, solo el grito y el saco */
  function ladron(x,gr){const win=g.result==='win',robo=g.result==='lose'&&g.kind==='robo',S=.7,y=AY-119,u=snT<0?0:g.t-snT,walk=snT<0&&gr<=0?Math.sin(now*14):robo?Math.sin(now*22):0;
    let a=1+walk*.2,len=72;const k=snT>=0?(win?0:Math.max(0,1-u*3)):gr;
    if(k>0){const V=vic().h,lx=(x-V[0])/S-42,ly=(V[1]-y)/S-4;a=lerp(1,Math.atan2(lx,ly),k);len=lerp(72,clamp(Math.hypot(lx,ly),50,150),k);}
    if(win&&u>.7&&u<1.1){a=2.1;len=84;}
    bust({x,y:y-Math.abs(walk)*4,s:S,flip:!(robo&&u>.12),skin:'#b87b50',shirt:'#2b2b3a',pat:'hoodie',cap:'#14101c',brow:'thick',stubble:1,gold:1,look:1,th:112,bw:54,legs:['#3b3550','#ffffff',60],rot:walk*.04,
      mood:snT<0?(gr>0?'grin':'yell'):win?(u<.7?'o':'frown'):'grin',talk:snT<0&&gr<=0?Math.abs(Math.sin(now*16)):0,
      arms:[{side:1,a,len,w:21,hand:robo&&u<.25?(hx,hy)=>(vic().w?wallet:phone)(hx,hy-10,.3,1.3):null},
        {side:-1,a:-.5,len:66,w:21,hand:(hx,hy)=>{const q=1+.14*loot;ell(hx,hy+26*q,24*q,28*q,'#a98a4a',4);line([[hx-10,hy+2],[hx+10,hy+2]],5,'#6b4f2a');}}]});}
  const g={lr:true,get impact(){return this.result?clamp(1-this.endT/.5,0,1):0;},probe:()=>({tB,tM,RE,decoy,hid:all(),ph,its,SPOTS}),t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,cmd:'¡ENCALETA!',
    hint:lv>=3?'Si ROBAN: teléfono Y cartera, cada uno en SU escondite (o ← ESPACIO →). Vendedor: ¡quieto!':'Si ROBAN: arrastra el teléfono a un escondite (o ESPACIO). Vendedor: ¡quieto!',
    press(k){hide(its.find(i=>!i.hid),SPOTS[k==='left'?0:k==='right'?2:1]);},
    down(p){if(g.result)return;let b=null,bd=100;for(const i of its){if(i.hid)continue;const d=Math.hypot(p.x-i.x,p.y-i.y);if(d<bd){bd=d;b=i;}}if(b){drag=b;b.x=p.x;b.y=p.y;}},
    move(p){if(drag){drag.x=clamp(p.x,20,780);drag.y=clamp(p.y,100,580);}},
    up(){if(!drag)return;const it=drag;drag=null;let b=null,bd=110;for(const s of SPOTS){const d=Math.hypot(it.x-s.x,it.y-s.y);if(d<bd){bd=d;b=s;}}if(b)hide(it,b);},
    update(dt){g.t+=dt;scroll+=dt*150;
      if(!cueB&&g.t>=tB){cueB=true;sfx.ding();}
      if(!cueM&&g.t>=tM){cueM=true;sfx.thud();snd(140,.5,'sawtooth',.07,-70);}
      if(cueM&&snT<0){const rx=robX();for(const p of pas)if(!p.rob&&rx<=p.x+46){p.rob=true;loot++;snd(520,.08,'square',.05,300);say('¡AY!',p.x,AY-236,'#ffe14d');}}
      for(const i of its){if(i.hid){i.hidT+=dt;const u=Math.min(1,dt*22);i.x=lerp(i.x,i.hid.x,u);i.y=lerp(i.y,i.hid.y,u);}
        else if(drag!==i){const u=Math.min(1,dt*14);i.x=lerp(i.x,i.h[0],u);i.y=lerp(i.y,i.h[1],u);}}
      if(!g.result&&g.t>=tM+RE){snT=g.t;
        if(all()){g.result='win';g.why='¡ENCALETADO!';sfx.win();spawn(PX,PY-60,22,'conf',CONF);}
        else{robI=vic();g.result='lose';g.kind='robo';g.why=robI.w?'¡CHAO, CARTERA!':'¡CHAO, TELÉFONO!';loot++;drag=null;sfx.whoosh();sfx.lose();setTimeout(()=>sfx.boing(),350);}}
      if(g.result){g.endT+=dt;
        if(g.result==='win'&&!paid&&g.t-snT>.85){paid=true;sfx.ding();PT.push({x:SNX-70,y:AY-170,vx:-170,vy:-250,g:700,t:0,life:1.1,kind:'bill',col:'#5cd06a',r:9,rot:0,vr:7});}
        if(g.result==='win'&&(note-=dt)<=0){note=.35;PT.push({x:PX+56,y:PY-110,vx:30,vy:-70,g:0,t:0,life:1,kind:'♪',col:'#ffffff',r:4,rot:0,vr:0});}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',robo=lose&&g.kind==='robo',rx=cueM?robX():9999,bx=cueB?vx(tB,VSP):9999;
      const hid=all(),alert=cueM&&!g.result&&!hid,gr=cueM&&snT<0?clamp((g.t-(tM+RE-.32))/.32,0,1):0,aboard=cueM&&rx<DX+70;
      /* el bus por dentro: techo, pasamanos, ventanas, asientos del fondo */
      wash(0,0,800,600,'#f6e3b4','#ecd29a');
      rr(0,92,800,36,0,'#d9dce6',0);line([[0,128],[800,128]],4,INK);txt('CUIDE SUS PERTENENCIAS',170,110,13,INK,0,true);
      line([[286,150],[690,150]],8,'#c4cad6');
      for(let i=0;i<4;i++){const x=330+i*100,sw=Math.sin(now*2+i)*2;line([[x,150],[x+sw,172]],4,'#3b3550');line(closeP(ellP(x+sw,183,9,11,10)),4,'#ffd23f');}
      for(let i=0;i<3;i++){const wx=322+i*124;rr(wx,196,108,96,12,'#5a4a78',4.5);
        ctx.save();path(rrP(wx+6,202,96,84,8));ctx.clip();wash(wx,196,108,96,'#8fd8ff','#e8f8ff');
        for(let j=0;j<5;j++){const x=((j*170+scroll)%850+850)%850+200;rr(x,226+(j%3)*14,120,90,4,['#ffb36b','#a9a0ff','#ff9ec7','#6ecf8f','#ffd23f'][j],3);}
        ctx.restore();}
      for(let i=0;i<3;i++){const sx=326+i*124;rr(sx,340,100,116,16,'#3fa0ff',4);rr(sx+10,324,80,38,12,'#6fbcff',3.5);}
      /* la puerta por donde se montan */
      rr(692,140,108,AY-132,10,'#2d2640',4.5);
      ctx.save();path(rrP(700,150,92,AY-150,6));ctx.clip();wash(700,150,92,260,'#8fd8ff','#e8f8ff');rr(700,392,92,AY-392,0,'#d8d2c4',0);line([[700,392],[792,392]],4,INK);ctx.restore();
      rr(700,96,92,30,8,'#c4283a',3.5);txt('SUBIDA',746,112,15,'#ffffff',0,true);
      rr(0,AY,800,148,0,'#5a5274',0);line([[0,AY],[800,AY]],5,INK);for(let i=0;i<5;i++)rr(340+i*95,AY+16,56,6,3,'#6f6790',0);
      rr(692,AY-6,108,14,4,'#ffd23f',3.5);
      /* el campanero se queda en la puerta */
      if(aboard)bust({x:756,y:AY-105,s:.62,flip:true,skin:'#d9a07a',shirt:'#5a5274',cap:'#c4283a',capBack:1,brow:'thick',mood:'angry',look:1,th:110,bw:52,legs:['#2b2b3a','#ffffff',60],arms:[{side:1,a:1.2,len:44,w:20},{side:-1,a:-1.2,len:44,w:20}]});
      /* pasajeros con el teléfono en la mano */
      const scared=aboard&&!win;
      for(const p of pas)bust(Object.assign({},p.f,{x:p.x,y:AY-105,s:.62,th:110,bw:50,legs:['#3b3550','#ffffff',60],look:scared?1:0,down:scared?0:1,mood:p.rob?'panic':scared?'worry':'calm',sweat:scared?1:0,vein:0,
        arms:p.rob?[{side:1,a:2.6,len:70,w:19},{side:-1,a:-2.6,len:70,w:19}]:[{side:1,a:-.9,len:40,w:19,hand:(hx,hy)=>phone(hx,hy-14,0,1.15)},{side:-1,a:.25,len:70,w:19}]}));
      if(cueB&&bx>-80)vendedor(bx);
      if(aboard)ladron(rx,gr);
      if(cueB&&bx>300&&bx<DX-20){const p=g.kind==='pana';bubble(clamp(bx-40,480,590),196,p?'¿Y ESA DESCONFIANZA?':'¡BUENAS TARDES, SEÑORES PASAJEROS!',p?18:15,bx-6,AY-196);}
      if(cueM&&g.t-tM<.7)txt('¡QUIETOS!',640+Math.sin(now*60)*3,214,40,'#ff4d5e',-.06);
      else if(cueM&&snT<0)bubble(clamp(rx-70,430,620),196,lv>=3?'¡TELÉFONOS Y CARTERAS!':'¡LOS TELÉFONOS!',lv>=3?17:20,rx-10,AY-208);
      /* tu puesto */
      rr(40,300,290,200,26,'#3fa0ff',4.5);rr(130,282,170,48,16,'#6fbcff',3.5);
      rr(14,486,520,38,14,'#2f7fe0',4.5);rr(30,524,490,52,0,'#2d2640',0);rr(36,524,14,52,0,'#8f8fa8',3);rr(500,524,14,52,0,'#8f8fa8',3);
      line([[0,576],[800,576]],4,INK);
      /* tú: el brazo sigue al teléfono */
      const arm=(it,sg)=>{const tg=robo&&!it.hid?it.h:it.hid&&it.hidT>.45?null:[it.x,it.y];if(!tg)return{side:sg,a:sg*.22,len:84,w:22};
        const lx=(tg[0]-PX)/PS-sg*42,ly=(tg[1]-PY)/PS-4;return{side:sg,a:Math.atan2(lx,ly),len:clamp(Math.hypot(lx,ly),30,210),w:22};};
      const shrug=win&&g.endT<1.3;
      bust(Object.assign({},TU,{x:PX,y:PY+(alert?Math.sin(now*40)*2:0),s:PS,hw:40,hh:42,bw:54,th:170,
        mood:robo?'frown':win?(shrug?'smile':'grin'):lose?'worry':hid?'smile':alert?'panic':'calm',look:hid&&!win?-1:1,down:!cueM&&!cueB&&!g.result?1:0,sweat:alert?2:lose?1:0,
        arms:shrug?[{side:1,a:1.9,len:70,w:22},{side:-1,a:-1.9,len:70,w:22}]:[arm(ph,1),its[1]?arm(its[1],-1):{side:-1,a:-.2,len:82,w:22}]}));
      if(robo&&g.endT>.35){const ny=PY+PS*(HY+9);for(const sg of[-1,1])ell(PX+sg*PS*52,PY+PS*(HY-14),22,24,sg<0?'#ff8a3d':'#3aa86a',4);ell(PX,ny,16,15,'#ff3b4e',3.5);ell(PX-5,ny-5,4,3,'#ffffff',0);}
      tag(PX,PY-PS*106-28);
      /* piernas: la media queda a la vista */
      const pants='#2f3a7a';ell(182,498,34,20,pants,4);ell(262,498,34,20,pants,4);limb(176,504,152,550,26,pants,4);limb(268,504,292,550,26,pants,4);
      limb(153,540,151,556,24,'#ffffff',3);line([[141,545],[164,547]],3,'#e8553d');limb(291,540,293,556,24,'#ffffff',3);line([[280,547],[303,545]],3,'#e8553d');
      ell(142,570,30,12,'#e8553d',4);ell(302,570,30,12,'#e8553d',4);
      /* escondites */
      for(const s of SPOTS){const on=(drag||alert)&&!hid&&libre(s),pz=on?1+Math.sin(now*12)*.08:1;
        line(closeP(ellP(s.x,s.y,36*pz,26*pz,16)),on?5:3.5,on?'#ffe14d':'#fff3c4');
        rr(s.x-40,s.y-52,80,22,8,on?'#ffd23f':'#fff3c4',3);txt(s.n,s.x,s.y-40,12,INK,0,true);}
      /* el teléfono (alto y negro) y la cartera (ancha, con el billete asomado): escondidos solo asoma la puntica */
      for(const i of its){const s=i.hid,dg=drag===i;
        if(s&&i.hidT>.14){if(i.w){rr(s.x-15,s.y-17,30,20,5,'#8a5a2b',3);line([[s.x-15,s.y-9],[s.x+15,s.y-9]],2.5,'#5a3716');}else rr(s.x-9,s.y-18,18,24,5,'#14101c',3);
          const j=Math.sin(now*50)*2;for(const sg of[-1,1])line([[s.x+sg*(24+j),s.y-16],[s.x+sg*(30+j),s.y-8],[s.x+sg*(24+j),s.y]],3,'#ffe14d');}
        else if(!robo)(i.w?wallet:phone)(i.x,i.y,dg?Math.sin(now*20)*.12:-.12,dg?1.3:1.1);}
      if(gr>.55){const V=vic().h;hand(V[0]+22,V[1]-4,-1.5,1.2,'#b87b50');}
      if(alert)txt('¡!',PX-92,PY-118,44,'#ff4d5e',-.12);
      if(alert&&its[1])txt(its.filter(i=>i.hid).length+'/2',PX-92,PY-74,24,'#ffe14d',-.12);
      if(win&&g.endT>.1&&rx<DX)bubble(540,196,g.endT<.85?'¿NI UN POTECITO?':"TOMA, PA' QUE TE AYUDES",g.endT<.85?22:19,clamp(rx-10,430,740),AY-208);
      if(robo&&g.endT>.15)bubble(560,196,'¡GRACIAS, MI PANA!',22,clamp(rx,460,760),AY-208);
      if(lose&&g.kind==='nada'&&g.endT>.2)bubble(540,200,'NO SE HA MONTADO NADIE...',20,PX+70,PY-70);
      drawP();
    }};
  return g;
}

/* ═════════ GAME 5: ¡AGÁRRATE! (de pescante en la curva: mantén el punto en el verde) ═════════ */
/* Nivel 1: un frenazo (el perro) que achica el verde a .27. Nivel 2: lo achica más (.22). Nivel 3: más todavía (.18) y, apenas pasa el primero,
   un SEGUNDO frenazo (el perro se devuelve) que te empuja para el lado contrario. */
function mkAgarrate(){
  const rs=Math.sqrt(SP),lv=LV(),A0=1.5+(SP-1)*.8,B=3.4,ph1=Math.random()*TAU,ph2=Math.random()*TAU,w1=6.1*rs,w2=2.3*rs,dir=Math.random()<.5?-1:1,tF=(.5+Math.random()*.12)*5/rs;
  const tD=(2.2+Math.random()*.6)/rs,dD=1.05/rs,ZW=.36,ZMIN=[.27,.22,.18][lv-1],crash=Math.random()<.34?'retro':'poste',HX=548,HH=214,S=.8;
  const tD2=lv>=3?tD+dD+.3/rs:1e9,dD2=.8/rs;
  let d=0,v=0,grip=1,lean=0,zw=ZW,brk=0,jolt=0,j1=0,fx=0,fy=0,frot=0,hit=false;
  /* una curva en S: empuja parejo hacia un lado y a mitad de camino se voltea; quedarse quieto es caerse */
  const F=t=>clamp(t/.5,0,1)*A0*(dir*Math.tanh((tF-t)*5)*(.72+.2*Math.sin(w2*t+ph2))+.28*Math.sin(w1*t+ph1));
  /* el cuerpo cuelga de la mano: la mano queda fija en el tubo y el resto gira */
  const hang=()=>{const r=-(.2+d*.5)+(Math.abs(d)>zw?Math.sin(now*46)*.03:0),c=Math.cos(r),s=Math.sin(r),hx=-S*39,hy=-S*88;return{x:HX-(hx*c-hy*s),y:HH-(hx*s+hy*c),r};};
  const meO=Object.assign({},TU,{s:S,th:110,legs:['#2f3a7a','#ffffff',60]});
  const g={get impact(){return this.result==='lose'?clamp(1-this.endT/.5,0,1):0;},probe:()=>({d,v,zw,grip,tD,tD2,jolt}),t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡AGÁRRATE!',
    hint:'← → (o mantén un lado de la pantalla / inclina el teléfono): el punto en el verde',
    press(){},
    update(dt){g.t+=dt;
      const inD=!g.result&&(g.t>=tD&&g.t<tD+dD||g.t>=tD2&&g.t<tD2+dD2);brk=inD?Math.min(1,brk+dt*8):Math.max(0,brk-dt*4);zw=lerp(ZW,ZMIN,brk);
      if(inD&&jolt<(g.t>=tD2?2:1)){if(!jolt)j1=Math.random()<.5?-1:1;jolt++;v+=(jolt>1?-j1:j1)*.55;sfx.screech();}
      if(!g.result){const f=F(g.t);lean+=(f/A0-lean)*Math.min(1,dt*6);v+=(f+steer()*B)*dt;v*=Math.exp(-2.4*dt);d+=v*dt;if(Math.abs(d)>1){d=Math.sign(d);v=0;}
        grip=clamp(grip+(Math.abs(d)>zw?-dt/.8:dt/2.5),0,1);
        if(grip<=0){const h=hang();fx=h.x;fy=h.y;frot=h.r;g.result='lose';g.why='¡TE CAÍSTE!';sfx.whoosh();sfx.lose();}
        else if(g.t>=g.dur){g.result='win';g.why='¡AGUANTASTE!';sfx.win();spawn(600,300,24,'conf',CONF);}}
      else{g.endT+=dt;lean*=Math.exp(-4*dt);
        if(g.result==='lose'&&!hit&&g.endT>=.28){hit=true;sfx.crash();spawn(crash==='poste'?700:560,320,10,'★',['#ffe14d'],220,400,.8);}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,out=Math.abs(d)>zw,mv=!lose;
      const away=lose?ease(clamp(e/1.3,0,1)):0,bs=1-.62*away;
      /* la calle se inclina al revés que el bus */
      ctx.save();ctx.translate(400,300);ctx.rotate(-lean*.045);ctx.translate(-400-lean*46,-300);
      wash(-120,-40,1040,350,'#8fd8ff','#e8f8ff');ell(650,96,32,32,'#ffe14d',0);
      [[-90,140,170,170,'#ffb36b'],[70,188,120,122,'#a9a0ff'],[560,170,130,140,'#ff9ec7'],[680,128,200,182,'#6ecf8f']].forEach(([x,y,w,h,c])=>{rr(x,y,w,h,6,c,3.5);for(let i=0;i<2;i++)rr(x+16+i*(w/2.2),y+22,w/4,26,4,'#ffffff',2.5);});
      rr(-120,306,1040,340,0,'#d8d2c4',0);poly([[-60,640],[860,640],[470,306],[330,306]],'#4d4a6e',0);line([[-120,306],[920,306]],4,INK);
      for(let i=0;i<5;i++){const u=(i/5+(mv?now*1.4:0))%1,y=306+u*u*300,w=5+u*22;rr(400-w/2,y,w,10+u*40,3,'#ffe14d',0);}
      ctx.restore();
      /* el perro que cruza: frenazo */
      const dgx=-70+(g.t-tD)*150*rs;if(g.t>=tD&&dgx<126)dog(dgx,470,.85);
      const otro=g.t>=tD2,dgx2=126-(g.t-tD2)*150*rs;if(otro&&dgx2>-80){ctx.save();ctx.translate(dgx2,470);ctx.scale(-1,1);dog(0,0,.85);ctx.restore();}
      /* bus visto desde atrás */
      ctx.save();ctx.translate(330,500-away*196);ctx.scale(bs,bs);ctx.rotate(lean*.085+(mv?Math.sin(now*31)*.004:0));ctx.translate(-330,-500+brk*12+(mv?Math.sin(now*34)*1.3:0));
      ell(226,118,36,20,'#e8d7a8',4);ell(300,110,40,24,'#e8d7a8',4);hen(408,110,.52,-.5);
      rr(150,446,68,74,16,'#14101c',3);rr(442,446,68,74,16,'#14101c',3);
      for(let i=0;i<3;i++){const u=(now*1.8+i/3)%1;ctx.save();ctx.globalAlpha=.55*(1-u);ell(214-u*20,486+u*46,10+u*20,8+u*14,'#d8d2c4',0);ctx.restore();}
      rr(128,130,404,336,42,'#ff6b3d',5);rr(128,130,404,38,26,'#fff3c4',4);rr(130,372,400,34,0,'#ffd23f',0);rr(130,406,400,12,0,'#2f7fe0',0);line([[130,372],[530,372]],4,INK);line([[130,418],[530,418]],4,INK);
      ctx.save();path(rrP(166,182,328,122,14));ctx.clip();ctx.fillStyle=STY[style].col('#5a4a78');ctx.fillRect(166,182,328,122);
      [0,5,8,2].forEach((fi,i)=>bust(Object.assign({},FACES[fi],{x:208+i*82,y:312,s:.56,th:50,bw:50,look:1,mood:lose?'yell':out?(i%2?'o':'panic'):brk>.3?'panic':FACES[fi].mood,talk:lose?1:0})));
      ctx.restore();line(closeP(rrP(166,182,328,122,14)),6,'#c9ced6');
      txt('DIOS ME GUÍA',330,340,24,'#c4283a',0,true);txt('SI VAS A CHOCAR, AVISA',330,391,13,INK,0,true);
      for(const lx of[158,502]){if(brk>.2){ctx.save();ctx.globalAlpha=.35;ell(lx,346,30,30,'#ff3b4e',0);ctx.restore();}ell(lx,346,15,15,brk>.2?'#ff3b4e':'#a8283a',3.5);}
      rr(292,424,76,24,5,'#ffffff',3);txt('PETARE',330,437,12,INK,0,true);rr(114,448,432,24,10,'#c9ced6',4);
      rr(522,178,24,262,8,'#2d2640',4);pole(HX,168,444);
      if(!lose){const h=hang();
        bust(Object.assign({},meO,{x:h.x,y:h.y,rot:h.r,look:-1,mood:win?'happy':out?'yell':Math.abs(d)>zw*.6?'panic':'worry',talk:out?Math.abs(Math.sin(now*18)):0,sweat:win?0:out?2:1,
          arms:[{side:-1,a:Math.PI,len:92,w:20},{side:1,a:win?2.7:1.9+Math.sin(now*(out?22:9))*(out?.6:.25),len:80,w:20}]}));
        ell(HX,HH,12,12,TU.skin,3.5);tag(h.x+Math.sin(h.r)*S*64+44,h.y-Math.cos(h.r)*S*64-70);}
      if(win&&e>.15)hand(HX-6,326+Math.sin(now*10)*4,-1.3,1.5,'#c98a5a');
      ctx.restore();
      /* te soltaste: contra el poste de la parada, o pegado al retrovisor de un por puesto */
      if(lose){const u=clamp(e/.28,0,1),T=crash==='poste'?[694,300,.16]:[566,404,.5],cy=(1-ease(u))*300;
        if(crash==='poste'){const qx=lerp(900,720,ease(u));rr(qx-15,90,30,520,6,'#8f8fa8',4);rr(qx-58,96,116,46,8,'#2f7fe0',4.5);txt('PARADA',qx,119,18,'#ffffff',0,true);}
        else{rr(560,396+cy,330,260,40,'#ffd23f',5);rr(604,416+cy,210,86,14,'#5a4a78',4.5);
          ctx.save();path(rrP(608,420+cy,202,78,10));ctx.clip();bust(Object.assign({},FACES[1],{x:706,y:520+cy,s:.6,th:50,mood:'yell',talk:1,look:-1}));ctx.restore();
          for(let i=0;i<9;i++)rr(572+i*26,516+cy,13,13,0,i%2?'#ffffff':INK,0);txt('POR PUESTO',716,556+cy,17,INK,0,true);
          line([[578,446+cy],[552,420+cy]],9,'#3b3550');ell(542,408+cy,28,20,'#c9ced6',4);}
        const x=lerp(fx,T[0],u),y=lerp(fy,T[1],u)-Math.sin(u*Math.PI)*60+(u>=1&&crash==='poste'?Math.min(70,(e-.28)*44):0);
        bust(Object.assign({},meO,{x,y,rot:u<1?frot-u*7:T[2],sy:u>=1?.86:1,mood:u>=1?'dizzy':'yell',talk:1,arms:[{side:-1,a:-2.2,len:84,w:20},{side:1,a:2.2,len:84,w:20}]}));
        if(u>=1)for(let i=0;i<3;i++){const a=now*5+i*TAU/3;txt('★',x+Math.cos(a)*44,y-S*120+Math.sin(a)*10,22,'#ffe14d');}
        if(crash==='retro'&&e>.5)bubble(600,330,'¡MI RETROVISOR!',22,700,432);}
      if(brk>.3&&!g.result)bubble(150,330,otro?'¡SE DEVOLVIÓ!':'¡UN PERRO!',24,Math.max(40,otro?dgx2:dgx),400);
      if(win&&e>.2)bubble(350,150,'¡EL PASAJE, MI REY!',24,536,300);
      /* barra de equilibrio */
      if(!g.result){rr(118,500,564,70,22,'#2d2640',4);
        const gx=u=>400+226*u,gy=u=>548-16*u*u,seg=(a,b,n)=>{const p=[];for(let i=0;i<=n;i++){const u=a+(b-a)*i/n;p.push([gx(u),gy(u)]);}return p;};
        line(seg(-1,1,20),16,'#ff4d5e');line(seg(-zw,zw,10),16,brk>.3&&Math.sin(now*30)>0?'#fff3a8':'#5cff7a');
        const st=steer();txt('◀',140,538,24,st<-.2?'#ffe14d':'#8f8fa8',0,true);txt('▶',660,538,24,st>.2?'#ffe14d':'#8f8fa8',0,true);
        ell(gx(d),gy(d),15,15,out&&Math.sin(now*30)>0?'#ff4d5e':'#ffffff',4);
        rr(340,507,120,9,4,'#14101c',0);if(grip>.02)rr(342,509,116*grip,5,2,grip<.4?'#ff4d5e':'#ffd23f',0);
        if(brk>.3)txt(otro?"¡OTRO FRENAZO: PA'L OTRO LADO!":'¡FRENAZO!',400,478,otro?22:26,'#ff4d5e');}
      drawP();
    }};
  return g;
}

/* ───────── registro ───────── */
/* BUS: lo que comparten los demás archivos de juegos (juego-*.js). BUS.add registra el juego, le da este input
   (down/move/up con coordenadas 800x600, izquierda/derecha sostenido) y le pone su botón.
   card/num: nombre y número de carta para el estilo LOTERÍA (index.html todavía los tiene fijos para PARADA y CHANCLA). */
const cs=document.currentScript,want=new URLSearchParams(location.search).get('juego')||(cs&&cs.dataset.juego);
function add(id,def){GAMES[id]=def;MINE[id]=1;const menu=document.getElementById('games');if(menu){const b=document.createElement('button');b.textContent=def.name;b.dataset.k=id;b.onclick=()=>setGame(id);menu.append(b);if(want===id)setGame(id);}}
/* ───────── SE FUE LA LUZ: lo que comparten los juegos del apagón (juego-switch, -nevera, -zancudo, -enchufa, -voltea, -llego
   y juego-jefe-transformador). Las escenas se dibujan a todo color y la noche va ENCIMA, con oscuro(). ───────── */
const oc=document.createElement('canvas');oc.width=W;oc.height=H;const ox=oc.getContext('2d');
/* la oscuridad: una capa de noche (a = cuánta, 0..1) con huecos de luz. luces=[{x,y,r,c}]: r = radio del charco de luz,
   c = color del resplandor (opcional). Va por un canvas aparte para que dos luces se puedan montar una sobre otra. */
function oscuro(a,luces=[],col='#0a0820'){if(a<=.01)return;
  ox.globalCompositeOperation='source-over';ox.globalAlpha=1;ox.fillStyle=col;ox.fillRect(0,0,W,H);ox.globalCompositeOperation='destination-out';
  for(const[k,al]of[[1,.45],[.7,1]]){ox.globalAlpha=al;for(const l of luces)if(l.r>1){ox.beginPath();ox.arc(l.x,l.y,l.r*k,0,TAU);ox.fill();}}
  ctx.save();
  for(const l of luces)if(l.c&&l.r>1){ctx.globalAlpha=.16*a;ctx.fillStyle=l.c;ctx.beginPath();ctx.arc(l.x,l.y,l.r*.7,0,TAU);ctx.fill();}
  ctx.globalAlpha=clamp(a,0,1);ctx.drawImage(oc,0,0);ctx.restore();}
/* el bombillo que cuelga del techo: (x, y) = centro del vidrio, L = cuánto alumbra (0 apagado .. 1 prendido) */
function bombillo(x,y,L=0){line([[x,0],[x,y-30]],4,'#3b3550');rr(x-9,y-32,18,16,3,'#8f8fa8',3);
  if(L>.05){ctx.save();ctx.globalAlpha=.35*L;ell(x,y,54,54,'#fff3a8',0);ctx.restore();}
  ell(x,y,20,24,L>.5?'#fff3a8':L>.05?'#e8d98a':'#6b6880',3.5);line([[x-6,y-4],[x,y+6],[x+6,y-4]],2.5,L>.5?'#ff9a3d':'#3b3550');}
/* la vela en su platico: (x, y) = base */
function vela(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);rr(-16,0,32,8,3,'#c4cad6',3);rr(-7,-34,14,36,3,'#fff6dc',3);
  const f=1+Math.sin(now*17)*.12;ell(0,-46,7,12*f,'#ffb020',2.5);ell(0,-43,3,6*f,'#fff3a8',0);ctx.restore();}
/* la sala de ¡CHANCLA!, sin luz: pared de listones, ventilador parado, ventana con cortinas (de noche), la Virgen con su
   velita (la única luz que queda: BUS.AP.VIRGEN), el sofá, la tele apagada y el florero. Piso en y=470.
   o.sin = lo que no se dibuja, p. ej. 'sofa tele florero virgen ventana' (para despejar la pared de un juego) */
const VIRGEN={x:448,y:270};
function sala(o={}){const sin=o.sin||'';
  wash(0,0,800,480,'#ffd9a0','#ffe9c4');for(let i=0;i<10;i++)rr(i*90+8,0,44,480,0,'#f5c27a',0);
  rr(0,470,800,130,0,'#b97a46',0);for(let i=0;i<9;i++)rr(i*95-20,470,3,130,0,'#8a5530',0);rr(0,462,800,14,0,'#f7e7c4',4);
  if(!sin.includes('ventilador')){line([[400,0],[400,40]],6,'#8f8fa8');for(let i=0;i<4;i++){const a=.5+i*Math.PI/2;limb(400,54,400+Math.cos(a)*100,54+Math.sin(a)*14,18,'#c9ced6',3);}ell(400,54,13,13,'#5a5274',3);}
  if(!sin.includes('ventana')){rr(300,120,110,130,6,'#7a5230',4.5);rr(310,130,90,110,4,'#232a52',3);ell(372,160,10,10,'#fff3c4',0);rr(300,120,26,130,6,'#ff5c8a',3.5);rr(384,120,26,130,6,'#ff5c8a',3.5);}
  if(!sin.includes('virgen')){rr(450,300,100,12,3,'#fff',3.5);rr(466,200,68,100,8,'#3fa0ff',4);ell(500,230,13,13,'#f2b88c',2.5);poly([[480,244],[500,238],[520,244],[528,300],[472,300]],'#fff',3);ell(448,285,7,13,'#ffe14d',2.5);ell(448+Math.sin(now*9)*1.5,267,4,7,'#ff8a3d',0);}
  if(!sin.includes('sofa')){rr(330,360,190,16,0,'#7a3b2a',0);rr(326,370,200,110,22,'#4fa66a',4.5);rr(342,328,168,60,18,'#5fbd7c',4.5);line([[372,392],[400,352]],5,'#fff');line([[420,392],[448,352]],5,'#fff');}
  if(!sin.includes('tele')){rr(24,296,170,122,14,'#3b3550',5);rr(38,310,142,92,10,'#14101c',3.5);rr(14,418,190,16,4,'#8a5530',4);}
  if(!sin.includes('florero')){rr(72,478,60,56,16,'#2f9fe3',4);rr(90,458,24,26,6,'#2f9fe3',4);ell(102,444,12,12,'#ff4d6d',3);ell(84,452,9,9,'#ffd23f',3);ell(120,450,9,9,'#ff8aa5',3);}}
/* la cocina de la abuela (la del jefe de la arepa), de noche: baldosas, la ventana, la repisa con los potes y abajo el mesón
   (borde en y=430). cocina(true) = con piso en vez de mesón (línea del piso en y=470), para lo que va parado en el suelo */
function cocina(piso=false){
  wash(0,0,800,piso?472:432,'#ffe9c4','#ffdcae');for(let i=1;i<8;i++)line([[i*100,96],[i*100,piso?470:430]],2,'#f2cf9c');for(let j=0;j<(piso?4:3);j++)line([[0,180+j*84],[800,180+j*84]],2,'#f2cf9c');
  rr(516,118,154,134,10,'#8a6a4a',4.5);rr(526,128,134,114,5,'#232a52',0);ell(626,160,12,12,'#fff3c4',0);line([[593,128],[593,242]],4,'#8a6a4a');
  rr(36,150,236,12,4,'#8a6a4a',3.5);[['#e8553d',70],['#3fb0ff',122],['#5cd06a',174],['#ffd23f',226]].forEach(([c,x])=>{rr(x-17,112,34,38,6,c,3.5);rr(x-19,105,38,11,4,'#fffdf2',3);});
  if(piso){rr(0,470,800,130,0,'#b97a46',0);for(let i=0;i<9;i++)rr(i*95-20,470,3,130,0,'#8a5530',0);rr(0,462,800,14,0,'#f7e7c4',4);}
  else{rr(-10,430,820,190,0,'#c98a5a',0);rr(-10,430,820,20,0,'#e0a878',0);line([[0,430],[800,430]],5,INK);}}
/* la arepa de la abuela (la misma del jefe): vista de lado, (x, y) = centro de la cara de arriba. top/bot = AREPA.CRUDA|DORADA|QUEMADA (o cualquier color) */
const AREPA={CRUDA:'#f6ecd0',DORADA:'#e8b04a',TOSTE:'#a8682a',QUEMADA:'#2a2018'};
function arepa(x,y,top,bot,sy=1){const w=150,h=40*sy,g_=34;
  ell(x,y+g_,w,h,bot,4.5);rr(x-w,y,w*2,g_,0,mix(top,bot,.5),0);line([[x-w,y],[x-w,y+g_]],4.5,INK);line([[x+w,y],[x+w,y+g_]],4.5,INK);ell(x,y,w,h,top,4.5);
  if(top===AREPA.DORADA)for(let i=0;i<6;i++)ell(x-90+i*36,y+((i*7)%3-1)*h*.3,15,6*sy,AREPA.TOSTE,0);
  if(top===AREPA.QUEMADA)for(let i=0;i<4;i++)ell(x-70+i*46,y+((i*5)%3-1)*h*.3,18,7*sy,'#14101c',0);}
/* el barrio de noche: edificios con ventanas (lit = cuántas están prendidas, 0..1) y la calle (acera en y=478) */
function barrio(lit=0){rr(0,0,800,8,0,'#1b1b4a',0);wash(0,5,800,595,'#1b1b4a','#3a2f6e');ell(700,70,26,26,'#fff3c4',0);
  for(let i=0;i<14;i++)ell(hash(i,1,7)*800,20+hash(i,2,7)*170,2,2,'#ffffff',0);
  [[0,250,130,'#8a4f6b'],[130,200,120,'#5a6fa8'],[250,270,110,'#b5654a'],[360,180,130,'#6b8a5a'],[490,240,120,'#a85a8a'],[610,210,110,'#5a8aa8'],[720,260,90,'#b58a4a']].forEach(([x,y,w,c],b)=>{rr(x,y,w,480-y,0,c,4);
    for(let j=0;y+24+j*58<440;j++)for(let i=0;i<2;i++)rr(x+16+i*(w-62),y+22+j*58,30,34,3,hash(b,i,j)<lit?'#ffe14d':'#232a52',3);});
  rr(0,478,800,122,0,'#4a4558',0);line([[0,478],[800,478]],4,INK);for(let i=0;i<5;i++)rr(40+i*170,532,70,8,0,'#8f8fa8',0);}
/* el elenco del apagón es el del mundo Venezuela: TÚ (BUS.TU, el chamo de ¡CHANCLA!), mamá (la de ¡CHANCLA!, con sus rolos),
   la abuela (la del desayuno criollo, con su delantal) y los vecinos de la camionetica. vecina = mamá (nombre viejo) */
const MAMA={skin:'#d9a07a',shirt:'#ff7ab0',pat:'floral',sh2:'#fff0a0',hair:'rolos',hairCol:'#3b2a22',earring:1,brow:'thick',wrinkles:1,hw:44,hh:44,bw:54,teeth:1};
const ABU={skin:'#c98a5a',shirt:'#ff7ab0',pat:'apron',sh2:'#fffdf2',hair:'bun',hairCol:'#e4e0e8',glasses:'round',wrinkles:1,cheeks:1,earring:1,bw:56,hw:42,hh:42};
/* las piernas de cuerpo entero, como salen en su juego: mamá descalza con sus chanclas azules (¡CHANCLA!, th:130) y la abuela con
   su falda morada (¡PARADA!, th:120) */
const PIES={mama:['#d9a07a','#d9a07a',70,'#2f7fe0'],abuela:['#5a3a8a','#2b2b3a',74]};
const AP={oscuro,bombillo,vela,sala,cocina,barrio,arepa,AREPA,VIRGEN,PIES,CAST:{mama:MAMA,vecina:MAMA,abuela:ABU,tio:FACES[6],chuo:FACES[11],pana:FACES[0]}};
window.BUS={add,LV,CONF,TU,say,tag,phone,steer,AP};
add('baja',{name:'¡BAJA!',mk:mkBaja,card:'LA PUERTA',num:'12'});
add('encaleta',{name:'¡ENCALETA!',mk:mkEncaleta,card:'EL TELÉFONO',num:'31'});
add('agarrate',{name:'¡AGÁRRATE!',mk:mkAgarrate,card:'EL PESCANTE',num:'45'});
if(window.__lab)window.__lab.hold=(l,r)=>{heldK.l=l;heldK.r=r;};
})();
