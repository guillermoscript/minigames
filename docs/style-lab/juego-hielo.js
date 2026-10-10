'use strict';
/* MiniCaos · laboratorio de estilos: ¡ESTRÉLLALA! (el hielo).
   Sábado de rumba, estacionamiento del abasto. El tío espera con la cava abierta y a ti te tocó la bolsa de hielo, que vino
   PEGADA: un solo bloque macizo, como de concreto. Hay que alzarla sobre la cabeza y estrellarla contra el cemento.
   Dos trazos: deslizar hacia ARRIBA la alza (pesa: sube a su paso, no al del dedo) y un trazo RÁPIDO hacia ABAJO la azota.
   FUERZA = velocidad del trazo hacia abajo × qué tan arriba estaba la bolsa. Si llega al verde del medidor: ¡CRASH!, el
   bloque queda en cubitos perfectos, la bolsa intacta, y los cubitos brincan solitos en fila a la cava.
   Si no llega: ¡FLOJO!, la bolsa rebota como pelota de goma, te pega en la espinilla y se rasga un poco. Se puede volver a
   intentar mientras haya reloj, pero a la TERCERA floja la bolsa se rompe y el hielo sale rodando sucio por el estacionamiento.
   Si se acaba el tiempo se te cae sola: rebota, espinilla, y se va brincando calle abajo (¡FLOJO!, que también es "flojera").
   Niveles: hace falta más fuerza (el verde del medidor es más chico: .55 / .68 / .8, o sea unos 1400 / 1800 / 2100 px por
   segundo con la bolsa arriba del todo) y la bolsa pesa más (tarda .42 / .52 / .62 s en subir). Nivel 3 además: la bolsa
   suda y, si la aguantas arriba casi un segundo, se te resbala (cuenta como floja).
   Teclado: ↑ (o ESPACIO) la alza sola; ya arriba, la barra de fuerza sube y baja (un vaivén cada 1.1 / .85 / .68 s) y ↓ (o
   ESPACIO) la azota con lo que marque: hay que soltarla con la barra en el verde. Azotarla antes de tenerla arriba siempre
   es floja. Mientras te sobas la espinilla (medio segundo) no se puede alzar.
   Uno de cada ocho: los cubitos salen dados. La gallina de siempre está abrigada encima de la nevera del hielo.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.hielo)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI,ICE='#bfe9ff',PLAS='#d6f1ff',MUD='#8a6a4a',AZUL='#2f7fe0';
/* las flechas ↑ ↓ no deben rodar la página mientras se juega ESTE juego (el laboratorio solo frena el ESPACIO) */
addEventListener('keydown',e=>{if(gameId==='hielo'&&(e.code==='ArrowUp'||e.code==='ArrowDown'))e.preventDefault();});
const TIO={skin:'#c98a5a',shirt:'#fffdf2',pat:'tank',hair:'bald',hairCol:'#14101c',stache:1,brow:'thick',cheeks:1,bw:60,hw:42,hh:40};
const big=(s,x,y,col,r=10,life=.8)=>PT.push({x,y,vx:0,vy:-60,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
function cubito(x,y,s,rot,dado){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);rr(-8,-8,16,16,3,ICE,2.5);rr(-6,-6,6,4,1,'#ffffff',0);
  if(dado)for(const[a,b]of[[-3,3],[3,-3],[3,3]])ell(a,b,1.8,1.8,INK,0);ctx.restore();}
/* un terrón de hielo que ya rodó por la tierra (d: 0 limpio .. 1 marrón) */
function terron(x,y,s,rot,d){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);poly([[-10,-6],[1,-11],[11,-4],[8,8],[-3,10],[-12,3]],mix('#eaf6ff',MUD,d),3);
  if(d>.25){ell(-3,-2,2.4,2,dark(MUD,.3),0);ell(4,3,2,1.6,dark(MUD,.3),0);}ctx.restore();}
/* la bolsa: (x, y) = el centro del bloque. o.cubos = cuántos cubitos perfectos le quedan (null: sigue siendo un bloque macizo); o.rips = rasgones */
function bolsa(x,y,rot,kx,ky,o){ctx.save();ctx.translate(x,y+35*(1-ky));ctx.rotate(rot);ctx.scale(kx,ky);
  poly([[-8,-33],[-19,-53],[-7,-46],[0,-57],[7,-46],[19,-53],[8,-33]],PLAS,3);rr(-9,-40,18,8,3,AZUL,2.5);
  rr(-50,-35,100,70,14,PLAS,4);
  if(o.cubos!=null)for(let i=15-o.cubos;i<15;i++)cubito(-33.2+(i%5)*16.6,-17.5+(i/5|0)*17.5,.95,0,o.dado);
  else{rr(-42,-27,84,54,7,'#dfe6ee',3);for(let i=0;i<7;i++)ell(-34+hash(i,1,3)*68,-20+hash(i,2,5)*40,2.2,1.8,'#aab4c2',0);
    line([[-35,-11],[-23,-21]],3,'#ffffff');rr(-25,-10,50,21,5,AZUL,2.5);txt('HIELO',0,1,12,'#ffffff',0,true);}
  if(o.rips>0){line([[-50,6],[-38,0],[-42,12],[-30,8],[-36,22]],3.5,INK);poly([[-47,8],[-37,3],[-40,15]],'#ffffff',2);}
  if(o.rips>1){line([[50,-16],[36,-9],[43,1],[29,4],[38,15],[27,21]],3.5,INK);poly([[45,-7],[34,-1],[41,8]],'#ffffff',2);}
  ctx.restore();}
/* la cava abierta: (x, y) = el centro de la base. n = cubitos que ya cayeron adentro */
function cava(x,y,n,dado){ctx.save();ctx.translate(x,y);
  rr(-60,-122,120,62,8,'#fffdf2',4);rr(-50,-114,100,44,5,'#e4ecf2',0);
  for(let i=0;i<3;i++){rr(-42+i*34,-88,13,26,4,['#ff8a3d','#3aa86a','#7a4a2a'][i],3);rr(-41+i*34,-94,11,7,2,'#c9ced6',2.5);}
  for(let i=0;i<n;i++)cubito(-45+(i%6)*18,-68-(i/6|0)*12,.95,(hash(i,3,1)-.5)*.7,dado);
  rr(-62,-64,124,64,10,'#e8293f',4);rr(-62,-64,124,15,6,'#fffdf2',3.5);rr(-24,-36,48,19,5,'#fffdf2',0);txt('CAVA',0,-26,12,'#e8293f',0,true);
  for(const sg of[-1,1])rr(sg*66-5,-44,10,22,4,'#c9ced6',3);ctx.restore();}

/* ═════════ ¡ESTRÉLLALA!: alza la bolsa de hielo y azótala contra el cemento ═════════ */
function mkHielo(){
  const rs=Math.sqrt(SP),lv=LV(),n=lv-1,NEED=[.55,.68,.8][n],LIFT=[.42,.52,.62][n],PER=[1.1,.85,.68][n],HOLD=lv>=3?.95:1e9,STUN=[.56,.5,.45][n];
  const VMAX=2600,LPX=130,DROP=48,TS=.11,MAXW=3,rare=Math.random()<.125;
  const PX=292,FY=428,S=.9,OY=FY-S*166,BY0=352,BY1=146,IX=PX+92,IY=FY-14,SHX=PX+60,SHY=FY-48,CX=556,CY=FY+14,TX=690,TSC=.92,TY=FY-TSC*170,MX=58,MT=168,MB=462;
  const B={x:PX,y:BY0,r:0,k:1},smp=[],chunks=[];
  let st='hold',h=0,hT=0,topT=0,kb=false,pd=false,py=0,yA=0,yPk=0,hA=0,vel=0,vmax=0,su=0,h0=0,x0=0,y0=0,F=0,fT=0,weak=0,bt=0,paf=false,slip=false,
    acted=false,nud=0,shake=0,inZ=false,ev=0,nc=0,nb=0,grito=0,drip=.4;
  const tri=x=>1-Math.abs(1-2*(x%1)),pulse=()=>tri(topT/PER);
  const nudge=s=>{if(nud>0||g.result)return;nud=.9;snd(200,.06,'square',.03);say(s||'¡ÁLZALA PRIMERO!',PX+150,FY-22,'#ffffff');};
  /* la azota: con el dedo la fuerza se mide al llegar al piso (F=-1 por ahora); con teclado, lo que marque la barra; si se resbaló, nada */
  function slam(sl){st='slam';su=0;h0=h;x0=B.x;y0=B.y;slip=!!sl;F=sl?0:kb?(h>=1?pulse():.3*h):-1;fT=0;acted=true;sfx.whoosh();}
  function bonk(){snd(170,.14,'sine',.2,-70);snd(880,.05,'square',.05);nz(.1,.1);spawn(PX+34,SHY+6,5,'★',['#ffe14d'],170,300,.5);say('¡AY, MI ESPINILLA!',PX,152,'#ffe14d');}
  function golpe(){if(F<0)F=clamp(vmax/VMAX,0,1)*h0;fT=1;B.x=IX;B.y=IY;B.r=0;
    if(F>=NEED){g.result='win';g.why='¡CRASH!';shake=1;sfx.crash();sfx.win();spawn(IX,IY+20,16,'bit',['#ffffff',ICE],360,800,.7);spawn(IX,IY-10,8,'★',['#ffe14d'],260,500,.7);
      spawn(IX,IY-60,20,'conf',CONF);spawn(196,240,5,'feather',['#f1ece2'],160,300,.8);return;}
    weak++;shake=.55;nz(.12,.12);snd(300,.1,'sawtooth',.04,200);
    if(weak>=MAXW){g.result='lose';g.kind='rota';g.why='¡SE ROMPIÓ!';sfx.crash();sfx.lose();spawn(IX,IY,12,'bit',[PLAS,'#ffffff'],300,700,.8);
      for(let i=0;i<9;i++)chunks.push({sg:i%2?1:-1,v:150+Math.random()*250,y:FY+10+Math.random()*116,s:.8+Math.random()*.7});return;}
    st='bounce';bt=0;paf=false;sfx.boing();big(slip?'¡SE RESBALÓ!':F>=NEED*.8?'¡CASI!':'¡FLOJO!',IX+44,IY-86,'#ff4d5e');big('¡RRRAS!',IX+96,IY-20,'#ffffff',2,.6);}
  /* se acabó el tiempo: se te cae de puro flojo, donde sea que la tengas */
  function floja(){g.result='lose';g.kind='floja';g.why='¡FLOJO!';x0=B.x;y0=B.y;pd=false;sfx.whoosh();}
  function fin(){const e=g.endT;
    if(g.result==='win'){if(ev<1&&e>=.14){ev=1;snd(2093,.22,'sine',.08);}
      while(nc<12&&e>=.62+nc*.085){nc++;snd(1250+nc*70,.04,'triangle',.05);if(nc===12)sfx.ding();}}
    else if(g.kind==='rota'){while(nb<6&&e>=.1+nb*.15){nb++;snd(250-nb*22,.06,'triangle',.06);}if(ev<1&&e>=.5){ev=1;snd(260,.4,'sawtooth',.05,-90);}}
    else if(e<.16){const u=e/.16;B.x=lerp(x0,IX,u);B.y=lerp(y0,IY,u*u)-Math.sin(u*PI)*(y0>300?34:0);B.r=u*.3;}
    else if(e<.34){if(ev<1){ev=1;sfx.boing();nz(.06,.1);shake=.4;}const u=(e-.16)/.18;B.x=lerp(IX,SHX,u);B.y=lerp(IY,SHY,u)-Math.sin(u*PI)*24;B.r=.3-u*.8;}
    else{if(ev<2){ev=2;bonk();sfx.lose();}const q=e-.34;B.x=SHX+q*340;B.y=IY-Math.abs(Math.sin(q*9+.3))*118*Math.exp(-q*.8);B.r=-.5+q*7;
      while(nb<5&&q*9+.3>=(nb+1)*PI){nb++;snd(330-nb*30,.22,'sine',.1,380);}}}

  const g={get impact(){return shake;},
    probe:()=>({st,h,hT,topT,pulse:st==='hold'&&h>=1?pulse():0,need:NEED,weak,maxw:MAXW,paf:st==='bounce'&&paf,F,kb,rare,lift:LIFT,per:PER,hold:HOLD,vmax:VMAX,kind:g.kind}),
    t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,cmd:'¡ESTRÉLLALA!',hint:'DESLIZA ↑ para alzarla y ↓ RAPIDÍSIMO (teclas: ↑, y ↓ con la barra en verde)',
    /* teclado: ↑ la alza sola, ↓ la azota con lo que marque la barra; ESPACIO hace lo que toque */
    press(k){if(g.result||st!=='hold')return;kb=true;
      if(k==='up'||(k==='any'&&hT<=0)){if(hT<1){hT=1;acted=true;}}
      else if(h>.12)slam();else nudge();},
    down(p){if(g.result)return;pd=true;kb=false;py=yA=yPk=p.y;hA=hT;vmax=0;smp.length=0;smp.push([g.t,py]);},
    /* hacia arriba alza (lo que suba el dedo desde donde empezó); DROP px por debajo de su punto más alto ya es azotarla */
    move(p){if(!pd||g.result)return;py=p.y;if(st!=='hold')return;
      if(py<yPk){yPk=py;vmax=0;let t=clamp(hA+(yA-yPk)/LPX,0,1);if(t>=.85)t=1;if(t>hT){hT=t;acted=true;}}
      else if(py-yPk>=DROP){if(h>.12)slam();else{nudge();yA=yPk=py;hA=hT;vmax=0;}}},
    up(p){if(pd&&p)g.move(p);if(pd&&!acted)nudge('¡DESLIZA PARA ARRIBA!');pd=false;},
    update(dt){g.t+=dt;fT=Math.max(0,fT-dt);nud=Math.max(0,nud-dt);shake=Math.max(0,shake-dt*3);
      /* velocidad del dedo: contra la muestra de hace ~60 ms (una por cuadro), para que no dependa de cuántos eventos lleguen */
      if(pd){smp.push([g.t,py]);while(smp.length>2&&g.t-smp[1][0]>=.06)smp.shift();const a=smp[0];vel=g.t>a[0]?(py-a[1])/(g.t-a[0]):0;if(vel>vmax)vmax=vel;}else vel=0;
      if(g.result){g.endT+=dt;fin();return;}
      if(st==='hold'){const was=h;h=Math.min(hT,h+dt/LIFT);
        if(h>was&&(grito-=dt)<=0){grito=.15;snd(90+h*130,.12,'sawtooth',.04,60);}
        if(h>=1){if(was<1)snd(988,.06,'square',.05);topT+=dt;const z=kb&&pulse()>=NEED;if(z&&!inZ)snd(1500,.03,'square',.03);inZ=z;}
        if((drip-=dt)<=0){drip=lerp(.5,.14,clamp(g.t/g.dur,0,1));PT.push({x:B.x-34+Math.random()*68,y:B.y+34,vx:0,vy:30,g:700,t:0,life:.45,kind:'bit',col:'#7fd8ff',r:3,rot:0,vr:0});}
        B.x=PX+Math.sin(h*PI)*84+(h>=1&&topT>HOLD*.5?Math.sin(now*52)*3:0);B.y=lerp(BY0,BY1,h);B.r=0;B.k=1;
        if(topT>=HOLD)slam(true);}
      else if(st==='slam'){su=Math.min(1,su+dt/TS);B.x=lerp(x0,IX,Math.sqrt(su));B.y=lerp(y0,IY,su*su);B.r=su*.25;if(su>=1)golpe();}
      else{bt+=dt;const a=STUN*.3,b=STUN*.62,c=STUN*.72;B.k=bt<.05?.7:1;
        if(bt<a){const u=bt/a;B.x=lerp(IX,SHX,u);B.y=lerp(IY,SHY,u)-Math.sin(u*PI)*24;B.r=-u*.5;}
        else{if(!paf){paf=true;bonk();}
          if(bt<b){const u=(bt-a)/(b-a);B.x=lerp(SHX,PX+84,u);B.y=lerp(SHY,IY,u*u);B.r=-.5+u*.5;}
          else if(bt>=c){const u=ease(clamp((bt-c)/(STUN-c),0,1));B.x=lerp(PX+84,PX,u);B.y=lerp(IY,BY0,u);B.r=0;}}
        if(bt>=STUN){st='hold';h=hT=topT=0;slip=false;if(pd){yA=yPk=py;hA=0;vmax=0;}}}
      if(!g.result&&st!=='slam'&&g.t>=g.dur)floja();},
    draw(){
      const win=g.result==='win',lose=!!g.result&&!win,rota=lose&&g.kind==='rota',fj=lose&&!rota,e=g.endT,k=clamp(g.t/g.dur,0,1),top=!g.result&&st==='hold'&&h>=1,
        lifting=!g.result&&st==='hold'&&h<hT,late=top&&topT>HOLD*.5,pain=(st==='bounce'&&paf&&bt<STUN*.72&&!g.result)||(fj&&e>=.34),q=shake*shake;
      ctx.save();ctx.translate(Math.sin(now*93)*q*9,Math.cos(now*71)*q*7);
      /* el abasto: toldo, pared, la puerta con su aviso, el letrero */
      wash(0,0,800,600,'#8fd8ff','#e8f8ff');rr(-12,118,824,240,0,'#ffe2ad',0);rr(-12,304,824,54,0,'#f2b56b',0);
      for(let i=0;i<10;i++)rr(-12+i*83,92,83,34,0,i%2?'#fffdf2':'#e8293f',3);
      rr(430,170,172,190,8,'#5a4a78',4.5);for(let i=0;i<3;i++){rr(442,206+i*48,148,8,0,'#3b3550',0);for(let j=0;j<5;j++)rr(448+j*28,184+i*48,20,22,3,['#ffd23f','#ff9ec7','#6ecf8f','#8aa0ff','#ffb36b'][(i*2+j)%5],2.5);}
      rr(448,226,136,46,4,'#fffdf2',3);txt('HOY NO SE FÍA',516,241,13,INK,0,true);txt('MAÑANA TAMPOCO',516,259,11,'#c4283a',0,true);
      rr(92,138,164,58,8,AZUL,4);txt('ABASTO',174,155,18,'#ffffff',0,true);txt('EL PINGÜINO SUDADO',174,178,12,'#ffe14d',0,true);
      /* el estacionamiento */
      rr(-12,356,824,260,0,'#cfc8bc',0);line([[-12,356],[812,356]],5,INK);line([[-12,486],[812,486]],2.5,'#a8a094');line([[236,358],[204,486]],2.5,'#a8a094');line([[470,358],[492,486]],2.5,'#a8a094');
      line([[127,570],[150,490]],9,'#ffd23f');line([[735,570],[716,490]],9,'#ffd23f');ell(214,540,48,13,'#b9b1a2',0);
      /* la nevera del hielo y la gallina de siempre, abrigada */
      rr(98,272,152,86,8,'#eef4f7',4);rr(98,272,152,18,6,'#c9ced6',3.5);txt('HIELO',174,322,24,AZUL,0,true);
      for(let i=0;i<5;i++)poly([[112+i*28,290],[122+i*28,290],[117+i*28,300+(i%2)*6]],ICE,2);
      const hx=174+Math.sin(now*44)*1.3,hy=250-(win?Math.abs(Math.sin(e*8))*36*Math.max(0,1-e):0);
      hen(hx,hy,.62,g.result?1:0);ell(hx+25,hy-27,11,7,'#e8293f',2.5);ell(hx+25,hy-35,4,4,'#ffffff',2);rr(hx+11,hy-11,20,7,3,'#3fb0ff',2.5);rr(hx+12,hy-8,7,15,3,'#3fb0ff',2.5);
      /* el tío de la cava */
      let tm='calm',tt=0,tl=-1,ta=[{side:-1,a:.55,len:52,w:22},{side:1,a:-.55,len:52,w:22}];
      if(win){tm='happy';ta=[{side:-1,a:-2.6+Math.sin(now*10)*.2,len:74,w:22},{side:1,a:2.6+Math.sin(now*10)*.2,len:74,w:22}];}
      else if(rota){if(e<.5){tm='yell';tt=1;ta=[{side:-1,a:-2.75,len:66,w:22},{side:1,a:2.75,len:66,w:22}];}else tm='frown';}
      else if(fj){tm=e<.34?'o':'frown';tl=B.x>TX?1:-1;}
      else if(st==='bounce'){tm=weak>1?'worry':'frown';ta=[{side:-1,a:-2.45,len:62,w:22},ta[1]];}
      else if(top||st==='slam'){tm='grin';ta=[{side:-1,a:-.95,len:78,w:22},ta[1]];}
      else if(lifting)tm='o';
      else if(k>.62){tm='yell';tt=Math.abs(Math.sin(now*14));}
      bust(Object.assign({},TIO,{x:TX,y:TY-(win?Math.abs(Math.sin(e*9))*12:0),s:TSC,th:112,legs:['#3b3550',AZUL,60],mood:tm,look:tl,talk:tt,arms:ta,sweat:weak>1&&!g.result?1:0,vein:rota&&e>=.5?1:0}));
      cava(CX,CY,nc,rare);
      /* grietas en el cemento */
      if(win){const u=clamp(e/.1,0,1);for(let i=0;i<7;i++){const a=i*TAU/7+.3,L=(58+hash(i,2,7)*62)*u,c=Math.cos(a),s=Math.sin(a)*.4;line([[IX,IY+36],[IX+c*L*.5+s*14,IY+36+s*L*.5+c*5],[IX+c*L,IY+36+s*L]],3,INK);}}
      /* tú */
      const hop=pain?Math.abs(Math.sin(now*13))*12:win&&e>.2?Math.abs(Math.sin(e*9))*18:0,rot=st==='slam'&&!g.result?su*.14:pain?Math.sin(now*13)*.05:0;
      const br=(sg,tx,ty)=>{const lx=(tx-PX)/S-sg*39,ly=(ty-OY+hop)/S-4;return{side:sg,a:Math.atan2(lx,ly),len:clamp(Math.hypot(lx,ly),22,170),w:20};};
      const gq=ease(clamp(h/.5,0,1)),gx=lerp(13,44,gq),gy=lerp(-44,31,gq);
      let mood='worry',sweat=1,talk=0,ex=null,arms=[{side:-1,a:-.1,len:84,w:20},{side:1,a:.1,len:84,w:20}];
      if(win){mood=e<.2?'o':'happy';sweat=0;if(e>=.2)arms=[{side:-1,a:-2.7,len:80,w:20},{side:1,a:2.7,len:80,w:20}];}
      else if(rota){mood=e<.4?'panic':'frown';ex={down:1};}
      else if(pain){mood='yell';talk=Math.abs(Math.sin(now*17));sweat=2;arms=[{side:-1,a:-2.4+Math.sin(now*19)*.3,len:76,w:20},br(1,PX+36,SHY+8)];}
      else if(fj||(st==='bounce'&&bt<STUN*.72))mood='o';
      else if(st==='slam'){mood='yell';talk=1;arms=su<.5?[br(-1,B.x-44,B.y+31),br(1,B.x+44,B.y+31)]:[{side:-1,a:.8,len:90,w:20},{side:1,a:.62,len:96,w:20}];}
      else{arms=[br(-1,B.x-gx,B.y+gy),br(1,B.x+gx,B.y+gy)];
        if(top){mood=late?'panic':'yell';talk=.6;sweat=2;}else if(lifting){mood='angry';ex={teeth:1,vein:1};sweat=2;}}
      const me=()=>bust(Object.assign({},TU,{x:PX+S*166*Math.sin(rot),y:FY-S*166*Math.cos(rot)-hop,s:S,rot,th:110,legs:['#2f3a7a','#ffffff',56],mood,arms,sweat,talk,look:1},ex));
      /* la bolsa sube por un lado (en arco, para no taparte la cara) y arriba queda detrás de la cabeza, con las manos por delante */
      const sq=win?Math.max(0,1-e*8)*.3:0,sal=win?clamp(Math.floor((e-.32)/.085)+1,0,12):0,atras=!g.result&&((st==='hold'&&h>.85)||(st==='slam'&&su<.45&&h0>.85));
      const bag=()=>{if(!rota)return bolsa(B.x,B.y,B.r,1+sq+(1-B.k)*.8,(1-sq)*B.k,{cubos:win?15-sal:null,rips:weak,dado:rare});
        poly([[IX-54,IY+34],[IX-36,IY+12],[IX-20,IY+26],[IX-4,IY+6],[IX+12,IY+24],[IX+30,IY+10],[IX+56,IY+34],[IX+40,IY+44],[IX-44,IY+44]],PLAS,3.5);
        ctx.save();ctx.translate(IX+4,IY+32);ctx.rotate(-.14);rr(-25,-10,50,20,5,AZUL,2.5);txt('HIELO',0,1,12,'#ffffff',0,true);ctx.restore();};
      if(atras)bag();me();if(!atras)bag();
      if(!acted&&!g.result)tag(PX,OY-S*104-28);
      /* cubitos perfectos: brincan en fila de la bolsa a la cava */
      if(win){for(let i=0;i<12;i++){const u=(e-.32-i*.085)/.3;if(u>0&&u<1)cubito(lerp(IX,CX-45+(i%6)*18,u),lerp(IY-54,CY-72,u)-Math.sin(u*PI)*34,1,u*6,rare);}
        if(e>.14)for(let i=0;i<3;i++){const a=now*4+i*TAU/3;txt('✦',IX+Math.cos(a)*74,IY-4+Math.sin(a)*34,20,'#ffe14d');}}
      /* hielo sucio rodando por todo el estacionamiento */
      if(rota)for(const c of chunks){const d=c.v*(1-Math.exp(-1.4*e))/1.4;terron(IX+c.sg*d,lerp(IY+26,c.y,clamp(e*3,0,1)),c.s,c.sg*d/13,clamp(d/250,0,.85));}
      if(pain)for(let i=0;i<3;i++){const a=now*7+i*TAU/3;txt('★',PX+34+Math.cos(a)*26,SHY+6+Math.sin(a)*12,18,'#ffe14d');}
      ctx.restore();
      /* el medidor de fuerza: lo verde de arriba es ¡CRASH!; abajo, las flojas que llevas */
      const mv=clamp(fT>0||g.result?F:st==='slam'?(F>=0?F:clamp(vmax/VMAX,0,1)*h0):top&&kb?pulse():pd&&vel>0?clamp(vel/VMAX,0,1)*h:0,0,1),MH=MB-MT,zy=MT+MH*(1-NEED),ok=mv>=NEED;
      rr(MX-30,MT-34,60,MH+82,12,'#2d2640',4);txt('FUERZA',MX,MT-17,11,'#ffffff',0,true);
      rr(MX-13,MT,26,MH,6,'#14101c',0);rr(MX-13,MT,26,zy-MT,6,ok&&Math.sin(now*30)>0?'#fff3a8':'#5cff7a',0);
      if(mv>.01)rr(MX-8,MB-MH*mv,16,MH*mv,4,ok?'#ffe14d':'#ff8a3d',0);line([[MX-18,zy],[MX+18,zy]],3,'#ffffff');
      for(let i=0;i<MAXW;i++){const x=MX-17+i*17;ell(x,MB+28,6.5,6.5,i<weak?'#ff4d5e':'#fff3c4',2.5);if(i<weak){line([[x-3,MB+25],[x+3,MB+31]],2,INK);line([[x+3,MB+25],[x-3,MB+31]],2,INK);}}
      if(!g.result){
        if(!acted)for(let i=0;i<3;i++)txt('▲',PX+96,330-i*36-(now*80)%36,28,'#ffe14d');
        else if(top&&kb){if(ok)txt('◀ ¡YA!',MX+78,zy-22,22,'#5cff7a');}
        else if(top){for(let i=0;i<3;i++)txt('▼',PX+96,176+i*36+(now*110)%36,28,'#5cff7a');txt('¡DURO!',PX+168,214,26,'#5cff7a',-.08);}
        if(late)txt('¡SE RESBALA!',PX+178+Math.sin(now*60)*3,166,22,'#ff4d5e',-.04);}
      /* lo que dice el tío */
      const bx=622,by=148,tx=TX-14,ty=TY-TSC*104-2;
      if(!g.result){if(st==='bounce')bubble(bx,by,weak>1?'¡QUE SE ROMPE LA BOLSA!':slip?'¡NO LA AGUANTES TANTO!':'¡MÁS DURO, MIJO!',weak>1||slip?17:20,tx,ty);
        else if(g.t>.15&&g.t<1.3/rs&&!weak&&st==='hold')bubble(bx,by,'¡ESE HIELO VINO PEGADO!',17,tx,ty);
        else if(k>.62&&st==='hold'&&!top)bubble(bx,by,'¡QUE SE DERRITE!',20,tx,ty);}
      else if(win&&e>.4)bubble(bx,by,rare?'¿Y ESTOS DADOS?':'¡CUBITOS PERFECTOS!',19,tx,ty);
      else if(rota&&e>.5)bubble(bx,by,'¡AHORA SABEN A TIERRA!',17,tx,ty);
      else if(fj&&e>.6)bubble(bx,by,'¿ESO ES HIELO O PELOTA?',17,tx,ty);
      drawP();
    }};
  return g;
}
BUS.add('hielo',{name:'¡ESTRÉLLALA!',mk:mkHielo,card:'EL HIELO',num:'75'});
})();
