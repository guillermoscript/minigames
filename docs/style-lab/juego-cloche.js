'use strict';
/* MiniCaos · laboratorio de estilos: ¡SUELTA EL CLOCHE! (prender el carro empujado, en segunda).
   Camino a la playa, LA NAVE no prende. Tú vas al volante con la cabeza afuera y tres panas la empujan corriendo.
   MANTÉN pisado el cloche (el dedo o el ratón en cualquier parte, o ESPACIO): mientras lo pisas los panas agarran
   velocidad y la aguja del velocímetro (el recuadro de la derecha) sube. SUELTA cuando la aguja esté DENTRO del verde.
   El cartelito de arriba del tablero te lleva la cuenta: MANTÉN → AGUANTA... → ¡SUELTA! → ¡TARDE!
   - Sueltas antes del verde = ¡MUY LENTO!   - Sueltas pasado el verde = ¡TE PASASTE!
   - No sueltas nunca: a los panas se les acaba el aire, la aguja se devuelve y, si llega a cero (o se acaba el reloj),
     ¡SE CANSARON! (si alcanzas a soltar cuando la aguja pasa otra vez por el verde, todavía prende).
   - Lo pisas tan tarde que el reloj se acaba con la aguja todavía subiendo = ¡MUY LENTO!
   - No lo pisas nunca: los panas empujan un carro trancado hasta que se acaba el reloj = ¡NI LO PISASTE!
   Un toque rápido es soltar con la aguja en cero: pierdes. Solo hay una soltada por partida.
   Nivel 1: aguja lenta y verde ancho. Nivel 2: más rápida y a empujones, verde más angosto, y un pana se tropieza (la
   aguja se frena un pelo). Nivel 3: más rápida todavía, el verde cae en un sitio distinto cada vez, y el tropezón pasa
   JUSTO antes de entrar al verde: la aguja se devuelve una vez (el que suelta por adelantado, pierde).
   Ganas: el escape suelta un tiro (¡PA!) que sienta a los tres panas, el motor ruge y LA NAVE se va... sin ellos
   ("¡NO PUEDO FRENAR, SE APAGA!") y les toca correr detrás. Pierdes (todas las derrotas): el carro frena de golpe, los
   tres quedan clavados de cabeza contra el carro (parachoques, maletero y vidrio de atrás: ¡PAF! ¡PAF! ¡PAF!), el motor
   tose dos veces y se muere, se abre el capó, se cae el parachoques de adelante, y tú preguntas "¿LE DAN OTRA VEZ?".
   Si ni lo pisaste, los panas se resbalan y se estrellan igual, pero el motor ni tose: "¿YA ESTÁN EMPUJANDO?".
   De fondo, sin nada que ver: la gallina de siempre va a pie por la carretera y, mientras el carro no agarre velocidad,
   los va pasando (1 de cada 8 veces va de polizón, echada sobre la cava del techo).
   Teclado: ESPACIO, ENTER o ↓ sostenido es el pedal (el keyup y el blur son de este archivo, solo para este juego).
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.cloche)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI;
const FY=508,CX=232,SC=.72,GX=694,GY=380,GR=66,A0=PI*.85,A1=PI*2.15,NAVE='#4fc4b8',PXS=[84,140,196],PDY=[-8,0,8];
/* los tres panas, del de atrás al que va pegado al maletero: [cara, pantalón, zapato]. El del afro va atrás para no tapar a nadie */
const PANAS=[[4,'#7a4f2a','#e8553d'],[9,'#2f3a7a','#ffffff'],[6,'#3b3550','#ffd23f']].map(([f,pants,shoe])=>Object.assign({},FACES[f],{pants,shoe}));
/* dónde queda cada cara al estrellarse: vidrio de atrás, tapa del maletero y parachoques. [x, y, giro]: quedan clavados
   de cabeza y en abanico (uno acostado, uno en diagonal, uno casi parado de cabeza) para que se vean las tres caras */
const CHOQUE=[[CX+90,FY-136,2.4],[CX+32,FY-112,2],[CX-14,FY-44,PI/2]],TCH=i=>.07+(2-i)*.09;
const pop=(s,x,y,col,r=20,life=.8)=>PT.push({x,y,vx:0,vy:-60,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
const estrella=(x,y,r)=>{const p=[];for(let i=0;i<14;i++){const a=i*TAU/14,q=i%2?r*.45:r;p.push([x+Math.cos(a)*q,y+Math.sin(a)*q]);}return p;};

/* ───────── mantener presionado ─────────
   El puntero llega por BUS (down/up). El teclado del laboratorio solo avisa del keydown (press), así que el keyup y el
   blur son de este archivo: le hablan al juego en curso y solo si es este. */
let cur=null;
const alza=e=>{if(gameId==='cloche'&&cur&&(e.type==='blur'||e.code==='Space'||e.code==='Enter'||e.code==='ArrowDown'||e.code==='KeyS'))cur.kup();};
addEventListener('keyup',alza);addEventListener('blur',alza);

function palma(x,y,h){const tx=x+18,ty=y-h;limb(x,y,tx,ty,12,'#a9713a',3.5);
  for(let i=0;i<5;i++){const a=PI+i*PI/4,c=Math.cos(a),s=Math.sin(a);limb(tx,ty,tx+c*56,ty+s*24+(1-Math.abs(s))*26,13,i%2?'#5cd06a':'#3aa86a',3);}
  ell(tx-6,ty+8,7,7,'#7a4f2a',2.5);ell(tx+7,ty+10,7,7,'#7a4f2a',2.5);}
/* las piernas van aparte del bust: los estilos con personajes propios solo las saben dibujar quietas.
   modo '': corriendo (ph, amp) · 'sienta': estiradas hacia adelante · 'choca': por el aire */
function piernas(x,y,rot,F,modo,ph,amp){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(SC,SC);
  for(const sg of[-1,1]){let fx,fy;
    if(modo==='sienta'){fx=62+sg*8;fy=102+sg*5;}
    else if(modo==='choca'){fx=-20+sg*14+Math.sin(now*10+sg*2)*12;fy=150+sg*8;}
    else{const p=ph+(sg>0?PI:0);fx=-4+Math.sin(p)*34*amp;fy=158-Math.max(0,Math.cos(p))*20*amp;}
    limb(sg*13,92,fx,fy,24,F.pants,4);
    if(modo==='sienta')ell(fx+7,fy,10,17,F.shoe,3.5);else ell(fx+12,fy+5,20,9,F.shoe,3.5);}
  ctx.restore();}
/* LA NAVE, de lado: x = el parachoques de atrás; las ruedas pisan FY.
   o: {rot, giro: vuelta de las ruedas, tu(): dibuja al chofer, bf: parachoques de adelante cayéndose 0..1, ho: capó abierto 0..1, freno, polizon: la gallina va sobre la cava} */
function nave(x,o){ctx.save();ctx.translate(x+165,FY-28);ctx.rotate(o.rot||0);ctx.translate(-165,28);
  rr(-24,-38,38,9,4,'#8f8fa8',3);
  line([[96,-155],[214,-155]],5,'#8f8fa8');for(const lx of[104,206])line([[lx,-155],[lx,-147]],4,'#8f8fa8');
  if(o.polizon)hen(124,-206,.5,1);
  rr(100,-192,58,36,7,'#fffdf2',3.5);rr(100,-192,58,12,5,'#e8553d',3);line([[96,-170],[162,-170]],3,'#3b3550');
  poly([[60,-94],[92,-150],[212,-150],[252,-94]],NAVE,4.5);
  poly([[82,-98],[102,-141],[142,-141],[142,-98]],'#bfe9ff',3.5);poly([[152,-98],[152,-141],[206,-141],[236,-98]],'#bfe9ff',3.5);
  o.tu();
  if(o.ho>0){poly([[252,-96],[318,-96-o.ho*42],[325,-89-o.ho*42],[258,-88]],dark(NAVE,.18),3.5);rr(262,-98,52,12,3,'#3b3550',0);}
  rr(0,-98,330,70,18,NAVE,4.5);
  rr(152,-95,84,60,6,'#c9ced6',3.5);rr(162,-84,16,6,3,'#5a5274',0);
  ell(290,-56,17,9,'#b3552d',0);ell(34,-46,12,7,'#b3552d',0);ell(122,-40,9,5,'#b3552d',0);
  txt('LA NAVE',72,-78,13,INK,-.03,true);
  rr(-3,-94,9,18,4,o.freno?'#ff3b4e':'#a8283a',2.5);ell(326,-78,7,10,'#fff3a8',3);rr(-13,-60,25,15,6,'#c9ced6',3.5);
  ctx.save();ctx.translate(327,-52+o.bf*45);ctx.rotate(o.bf*.6);rr(-11,-8,23,15,6,'#c9ced6',3.5);ctx.restore();
  const c=Math.cos(o.giro)*11,s=Math.sin(o.giro)*11;
  for(const wx of[72,262]){ell(wx,-28,29,29,'#14101c',4);ell(wx,-28,13,13,'#c9ced6',3);line([[wx-c,-28-s],[wx+c,-28+s]],3,INK);line([[wx+s,-28-c],[wx-s,-28+c]],3,INK);}
  ctx.restore();}

/* ═════════ ¡SUELTA EL CLOCHE! ═════════ */
function mkCloche(){
  const lv=LV(),n=lv-1,rs=Math.sqrt(SP),RISE=[.4,.54,.66][n],BW=[.24,.19,.16][n],JIT=[.2,.45,.6][n],DIP=[0,.05,.13][n],DT=[0,.2,.3][n];
  /* el verde [b0, b1] en la escala 0..1 de la aguja; vD = a qué altura se tropieza el pana */
  const b0=lv<3?[.56,.6][n]:.44+Math.random()*.34,b1=b0+BW,vD=lv===1?9:lv===2?b0-.2:b0-.04,ph0=Math.random()*TAU,rara=Math.random()<.125;
  let vel=0,kH=false,pH=false,used=false,fase=0,topT=.22,dipT=0,dipped=false,trip=0,tau=0,run=0,sc=0,giro=0,ped=0,inZ=false,tkT=0,stT=0,nagT=.6;
  let ev=0,v0=0,carX=0,rT=0,henX=30;const puffs=[],hits=[0,0,0];
  const humo=(x,y,vx,vy,r,c,life)=>puffs.push({x,y,vx,vy,r,c,life,t:0});
  const verde=()=>vel>=b0&&vel<=b1;
  function pisa(){if(g.result||used)return;used=true;snd(260,.07,'square',.06,-120);nz(.04,.1);say('¡DALE!',PXS[1],FY-240,'#ffffff');}
  function fail(kind){g.result='lose';g.kind=kind;v0=vel;g.why={lento:'¡MUY LENTO!',pasado:'¡TE PASASTE!',cansados:'¡SE CANSARON!',nada:'¡NI LO PISASTE!'}[kind];
    if(v0>.08)sfx.screech();else sfx.thud();sfx.lose();snd(140,.12,'square',.08,-60);}
  /* la única soltada de la partida: en el verde prende, fuera del verde se apaga */
  function suelta(){if(g.result||!used)return;
    if(!verde()){fail(vel>b1?'pasado':fase>1?'cansados':'lento');return;}
    g.result='win';g.why='¡PRENDIÓ!';v0=vel;nz(.3,.45);snd(85,.4,'sawtooth',.22,-30);snd(1400,.05,'square',.09);
    pop('¡PA!',CX-84,FY-92,'#ffe14d',34,.9);spawn(CX-26,FY-34,10,'★',['#ffe14d','#ff8a3d'],320,500,.6);
    for(let i=0;i<10;i++)humo(CX-26,FY-34,-130-Math.random()*280,-30-Math.random()*150,15+Math.random()*16,'#4a4560',.8+Math.random()*.5);}
  /* la postura de cada pana: [x, y, giro, modo de piernas] */
  function pose(i){const e=g.endT,r0=used?.3:.42,amp=used?.55+(g.result?v0:vel)*.55:.4,y0=FY-10-114*Math.cos(r0)+PDY[i]-Math.abs(Math.sin(run+i*1.3))*5*amp;
    let x=PXS[i],y=y0,r=r0,m='';
    if(i===2&&trip>0){const q=Math.sin(Math.min(1,trip)*PI);x-=q*10;y+=q*44;r+=q*.8;}   /* el de adelante se va de boca */
    if(g.result==='lose'){const c=CHOQUE[i],u=clamp(e/TCH(i),0,1);
      x=lerp(x,c[0]-46*Math.sin(c[2]),u*u);y=lerp(y,c[1]+46*Math.cos(c[2]),u*u)-Math.sin(u*PI)*14+Math.min(10,Math.max(0,e-TCH(i))*7);r=lerp(r,c[2],u);m=u>.5?'choca':'';}
    else if(g.result==='win'){const sx=58+i*70,sy=FY-76+PDY[i];
      if(e<.32){const u=e/.32;x=lerp(x,sx,ease(u));y=lerp(y,sy,u)-Math.sin(u*PI)*44;r=lerp(r,-.5,u);m='sienta';}
      else if(e<1.5){const d=e-.32;x=sx;y=sy-Math.abs(Math.sin(d*13))*10*Math.exp(-d*5);r=-.1;m='sienta';}
      else{x=sx+Math.pow(e-1.5,1.5)*520;r=.3;}}
    return[x,y,r,m,amp];}
  function pana(i){const F=PANAS[i],e=g.endT,win=g.result==='win',lose=g.result==='lose',[x,y,r,m,amp]=pose(i),hit=lose&&hits[i],d=hit?e-TCH(i):0,aa=PI/2+r+.15;
    let mood,talk=0,sweat=1,vein=0,sy=1,arms=[{side:-1,a:aa,len:84,w:19},{side:1,a:aa,len:44,w:19}];
    if(win){mood=e<.32?'o':e<1.15?'happy':e<1.5?'panic':'yell';talk=e>1.5?1:0;sweat=e<1.15?0:2;
      arms=e<.5?[{side:-1,a:-2.2,len:70,w:19},{side:1,a:2.2,len:70,w:19}]:e<1.15?[{side:-1,a:-2.6+Math.sin(now*11+i)*.25,len:72,w:19},{side:1,a:2.6+Math.sin(now*11+i)*.25,len:72,w:19}]
        :[{side:-1,a:PI/2+r+.4,len:84,w:19},{side:1,a:PI/2+r+.4,len:60,w:19}];}
    else if(lose){mood=hit?'dizzy':'panic';talk=hit?.6:0;sweat=2;sy=hit?1-.24*Math.exp(-d*9):1;if(hit)arms=[{side:-1,a:r-.25,len:i>1?40:62,w:19},{side:1,a:r+.25,len:i>1?40:62,w:19}];}
    else if(!used){mood=i===1?'angry':'yell';talk=Math.abs(Math.sin(now*11+i*2));vein=1;sweat=2;}
    else if(i===2&&trip>.15){mood='o';arms=[{side:-1,a:-2.3,len:70,w:19},{side:1,a:2.3,len:70,w:19}];}
    else if(verde()){mood='yell';talk=.4+.6*Math.abs(Math.sin(now*20+i));}
    else if(fase>0||vel>b1){mood=fase>1?'dizzy':'panic';sweat=2;}
    else{mood=['worry','yell','angry'][i];talk=Math.abs(Math.sin(now*9+i));vein=i===2?1:0;}
    piernas(x,y,r,F,m,run+i*1.3,amp);
    bust(Object.assign({},F,{x,y,s:SC,rot:r,sy,th:104,bw:48,mood,talk,sweat,vein,look:win&&e>1.15?1:lose?0:1,arms}));
    if(hit)for(let j=0;j<2;j++){const a=now*5+j*PI+i*2,c=CHOQUE[i];txt('★',c[0]+12+Math.cos(a)*36,c[1]-30+Math.sin(a)*9,18,'#ffe14d');}}
  /* tú: la cabeza por la ventana (coordenadas de la nave) */
  function chofer(){const e=g.endT,o={x:192,y:-88,s:.8,th:60,look:1};
    if(g.result==='win')Object.assign(o,e<1.15?{mood:'happy',rot:-.12*Math.max(0,1-e*3),arms:[{side:1,a:2.75+Math.sin(now*14)*.15,len:74,w:20}]}:{mood:'panic',look:-1,sweat:2,talk:1});
    else if(g.result==='lose')Object.assign(o,e<.5?{mood:g.kind==='nada'?'calm':'o',rot:g.kind==='nada'?0:.34*Math.exp(-e*7)}:{mood:g.kind==='nada'?'o':'smile',look:-1,sweat:1});
    else if(!used)Object.assign(o,{mood:'calm',lids:1,rot:Math.sin(now*2)*.03});
    else if(verde())Object.assign(o,{mood:'o',x:192+Math.sin(now*50)*1.5,sweat:1});
    else if(fase>0||vel>b1)Object.assign(o,{mood:fase>1?'yell':'panic',talk:1,sweat:2,look:fase>1?-1:1});
    else Object.assign(o,{mood:'worry',sweat:vel>b0*.5?1:0});
    bust(Object.assign({},TU,o));}

  const g={get impact(){return this.result?clamp(1-this.endT/.5,0,1):trip*.4;},
    probe:()=>({v:vel,b0,b1,lv,fase,used,hold:kH||pH,dipped,verde:verde(),kind:g.kind}),
    t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,cmd:'¡SUELTA EL CLOCHE!',
    hint:'MANTÉN el dedo (o ESPACIO) y SUELTA con la aguja en el VERDE',
    press(k){if(k==='any'||k==='down'){kH=true;pisa();}},
    kup(){if(kH){kH=false;if(!pH)suelta();}},
    down(){pH=true;pisa();},
    up(){if(pH){pH=false;if(!kH)suelta();}},
    update(dt){g.t+=dt;trip=Math.max(0,trip-dt*2.4);ped+=((used&&!g.result?1:0)-ped)*Math.min(1,dt*30);
      for(let i=puffs.length-1;i>=0;i--){const p=puffs[i];p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-3*dt);p.vy-=50*dt;p.r+=24*dt;if(p.t>p.life)puffs.splice(i,1);}
      if(!g.result){
        if(used){tau+=dt;
          /* fase 0: sube a empujones (y se tropieza una vez) · 1: se quedan sin aire arriba · 2: la aguja se devuelve */
          if(fase===0){
            if(dipT>0){dipT-=dt;vel=Math.max(0,vel-DIP/DT*dt);}
            else{vel+=RISE*(1+JIT*Math.sin(tau*11*rs+ph0))*dt;
              if(!dipped&&vel>=vD){dipped=true;dipT=DT;trip=1;sfx.boing();nz(.08,.14);say('¡UY!',PXS[2]+30,FY-222,'#ff9ec7');}
              if(vel>=1){vel=1;fase=1;snd(300,.3,'sawtooth',.05,-160);say('¡NO PUEDO MÁS!',PXS[1]+16,FY-250,'#ff9ec7');}}}
          else if(fase===1){if((topT-=dt)<=0)fase=2;}
          else if((vel-=RISE*1.6*dt)<=0){vel=0;fail('cansados');}
          const z=verde();
          if(z&&!inZ){snd(1568,.1,'sine',.09);tkT=0;}else if(!z&&inZ&&vel>b1)snd(220,.14,'sawtooth',.05,-60);
          inZ=z;if(z&&(tkT-=dt)<=0){tkT=.08;snd(1320,.03,'square',.035);}
          if((stT-=dt*(5+vel*13))<=0){stT+=PI;nz(.025,.05);snd(150+vel*420,.05,'triangle',.035);}}
        else if((nagT-=dt)<=0){nagT=1;snd(120,.14,'sawtooth',.04,-30);}
        run+=dt*(used?5+vel*13:9);sc+=vel*250*dt;giro+=vel*250*dt/29;henX=Math.max(-60,henX+(50-vel*250)*dt);
        if(!g.result&&g.t>=g.dur)fail(!used?'nada':fase?'cansados':'lento');
        return;}
      g.endT+=dt;const e=g.endT;
      if(g.result==='win'){carX=1000*Math.pow(Math.max(0,e-.16),2);giro+=dt*(6+e*30);henX+=50*dt;if(e>1.5)run+=dt*18;
        if(e<1.3&&(rT-=dt)<=0){rT=.055;snd(74+e*130+Math.random()*14,.08,'sawtooth',.05);humo(CX+carX-26,FY-34,-90,-30,7,'#c9ced6',.5);}
        if(ev<1&&e>=.16){ev=1;sfx.win();spawn(CX+60,FY-210,22,'conf',CONF);}
        if(ev<2&&e>=1.15){ev=2;sfx.boing();}
        if(ev<3&&e>=1.5){ev=3;sfx.whoosh();say('¡ESPÉRANOS!',PXS[1],FY-230,'#ffe14d');}}
      else{vel=v0*Math.max(0,1-e/.45);henX+=150*dt;
        for(let i=0;i<3;i++)if(!hits[i]&&e>=TCH(i)){hits[i]=1;sfx.thud();snd(540-i*90,.06,'square',.06,-200);pop('¡PAF!',CX+150-i*57,FY-160+i*76,'#ffe14d',4+i*3,.6);}
        /* el motor tose dos veces y se muere: se abre el capó */
        const tos=g.kind!=='nada';
        if(ev<1&&e>=.5){ev=1;if(tos){snd(150,.12,'sawtooth',.1,-40);humo(CX-28,FY-34,-50,-20,8,'#c9ced6',.6);}}
        if(ev<2&&e>=.66){ev=2;if(tos){snd(118,.12,'sawtooth',.09,-40);humo(CX-28,FY-34,-40,-20,6,'#c9ced6',.6);}else sfx.boing();}
        if(ev<3&&e>=.84){ev=3;if(tos){snd(92,.45,'sawtooth',.09,-50);nz(.3,.07);for(let i=0;i<4;i++)humo(CX+276+i*12,FY-106,(i-1.5)*26,-60-i*12,11,'#e8e8ee',1.4);pop('pfff...',CX+316,FY-126,'#ffffff',2,1);}}
        if(ev<4&&e>=1.12){ev=4;snd(860,.07,'square',.07);nz(.07,.16);}
        if(ev<5&&e>=1.4){ev=5;sfx.cluck();}}},
    draw(){
      const e=g.endT,win=g.result==='win',lose=g.result==='lose',inB=!g.result&&used&&verde(),over=!g.result&&used&&!inB&&(fase>0||vel>b1);
      /* la playa: mar, peñero, arena, palmas y el kiosco */
      wash(gameLeft(),0,GAME_VIEW.width,600,'#8fd8ff','#e8f8ff');ell(86,148,32,32,'#ffe14d',0);
      rr(gameLeft(),330,GAME_VIEW.width,70,0,'#3fb0ff',0);line([[gameLeft(),330],[gameRight(),330]],4,INK);
      for(let i=0;i<5;i++){const x=(i*190+now*16)%950-70,y=350+(i%3)*15;line([[x,y],[x+16,y-4],[x+34,y]],3,'#e8f8ff');}
      {const x=(now*9+610)%900-50;poly([[x-26,344],[x+26,344],[x+17,357],[x-17,357]],'#e8553d',3);line([[x,344],[x,322]],3,INK);poly([[x+2,322],[x+19,340],[x+2,340]],'#fffdf2',2.5);}
      rr(gameLeft(),398,GAME_VIEW.width,82,0,'#f0d9a0',0);
      for(let i=0;i<4;i++)palma(((i*270+90-sc*.6)%1080+1080)%1080-140,474-(i%2)*14,i%2?206:226);
      {const x=((620-sc)%1500+1500)%1500-240;rr(x+16,440,9,40,0,'#8a5a30',3);rr(x+146,440,9,40,0,'#8a5a30',3);rr(x,402,172,50,6,'#ffd23f',4);txt('EMPANADAS',x+86,418,16,INK,0,true);txt('LA OLA BRAVA',x+86,438,13,'#c4283a',0,true);}
      rr(gameLeft(),478,GAME_VIEW.width,122,0,'#6f6790',0);line([[gameLeft(),478],[gameRight(),478]],5,INK);
      for(let i=0;i<7;i++)rr(((i*130-sc)%910+910)%910-70,530,62,8,3,'#ffe14d',0);
      rr(gameLeft(),574,GAME_VIEW.width,26,0,'#d8d2c4',0);line([[gameLeft(),574],[gameRight(),574]],4,INK);   /* la acera: aquí cae la ayuda */
      /* la nave */
      const cx=CX+carX+(used||g.result?0:Math.sin(now*26)*1.2),crot=win?-.07*Math.max(0,1-e*2.2):lose&&g.kind!=='nada'?.07*Math.exp(-e*6):0;
      nave(cx,{rot:crot,giro,tu:chofer,freno:lose,polizon:rara,bf:lose?ease(clamp((e-1.12)/.22,0,1)):0,ho:lose&&g.kind!=='nada'?ease(clamp((e-.84)/.14,0,1)):0});
      if(!g.result)tag(cx+192,FY-208);
      if(win&&e<.16)poly(estrella(CX-40,FY-34,26+70*(1-e/.16)),'#ffe14d',3.5);
      for(let i=0;i<3;i++)pana(i);
      for(const p of puffs){ctx.save();ctx.globalAlpha=clamp(1-p.t/p.life,0,1)*.85;ell(p.x,p.y,p.r,p.r,p.c,0);ctx.restore();}
      /* la gallina de siempre: a pie, y mientras el carro no agarre velocidad los va pasando (1 de cada 8 veces va de polizón en la cava) */
      if(!rara)hen(henX,552-Math.abs(Math.sin(now*9))*4,.58,lose?-1:1);
      /* el tablero: velocímetro, pedal y tu pie */
      ctx.save();if(win)ctx.translate(0,ease(clamp(e/.3,0,1))*330);
      rr(598,294,194,276,20,'#2d2640',4.5);
      const py=lerp(514,540,ped),sy=py-12-(1-ped)*15;
      rr(700,py+12,12,562-py-12,3,'#8f8fa8',3);rr(676,py,60,14,5,'#c9ced6',3.5);for(let i=0;i<4;i++)line([[688+i*12,py+3],[688+i*12,py+11]],2,'#5a5274');
      limb(616,sy-22,684,sy-4,22,'#2f3a7a',4);ell(700,sy,32,12,'#e8553d',4);line([[672,sy+8],[728,sy+8]],3,'#fffdf2');
      txt('CLOCHE',756,486,11,'#ffd23f',0,true);
      const ang=u=>A0+(A1-A0)*u,na=ang(clamp(vel,0,1)),c=Math.cos(na),s=Math.sin(na),fl=inB&&Math.sin(now*36)>0;
      ell(GX,GY,GR+15,GR+15,fl?'#2f5a3a':'#14101c',4);
      line(arcPts(GX,GY,GR,A0,ang(b0),12),11,'#8f8fa8');line(arcPts(GX,GY,GR,ang(b1),A1,8),11,'#ff4d5e');
      line(arcPts(GX,GY,GR,ang(b0),ang(b1),8),fl?22:17,fl?'#d8ffe0':'#5cff7a');
      for(let i=0;i<=4;i++){const a=ang(i/4);txt(''+i*10,GX+Math.cos(a)*(GR-24),GY+Math.sin(a)*(GR-24),12,'#fffdf2',0,true);}
      poly([[GX-s*6,GY+c*6],[GX+c*(GR+7),GY+s*(GR+7)],[GX+s*6,GY-c*6]],'#fffdf2',3);ell(GX,GY,9,9,'#ffd23f',3);
      txt('km/h',GX,GY+38,12,'#c9ced6',0,true);rr(610,302,40,24,7,'#ffd23f',3);txt('2ª',630,315,14,INK,0,true);
      ctx.restore();
      if(!g.result){
        /* el cartelito: qué toca hacer ahora mismo */
        const[s1,c1,c2]=!used?['MANTÉN','#ffd23f',INK]:inB?['¡SUELTA!','#5cff7a',INK]:over?['¡TARDE!','#ff4d5e','#ffffff']:['AGUANTA...','#fff3c4',INK],z=!used||inB?1+Math.sin(now*12)*.07:1;
        ctx.save();ctx.translate(695,262);ctx.scale(z,z);rr(-86,-22,172,44,14,c1,4);txt(s1,0,1,24,c2,0,true);ctx.restore();
        if(!used)bubble(150,262,'¡PISA EL CLOCHE!',19,PXS[2]+14,318);
        else if(inB)bubble(150,262,'¡SUÉLTALO YA!',22,PXS[2]+14,318);}
      if(win&&e>1.15)bubble(588,170,'¡NO PUEDO FRENAR, SE APAGA!',17,794,330);
      if(lose&&e>.62)bubble(456,196,g.kind==='nada'?'¿YA ESTÁN EMPUJANDO?':'¿LE DAN OTRA VEZ?',19,cx+196,318);
      drawP();
    }};
  cur=g;return g;
}
BUS.add('cloche',{name:'¡SUELTA EL CLOCHE!',mk:mkCloche,card:'EL CLOCHE',num:'73'});
})();
