'use strict';
/* MiniCaos · laboratorio de estilos: JEFE «EL METRO EN HORA PICO».
   Seis de la tarde en Plaza Venezuela. Tres fases seguidas, cada una con su reloj:
   1. ¡AGUANTA! (el andén): la marea te empuja hacia la raya amarilla sin parar. Sale una flecha: marcarla (teclado o los
      cuatro botones) es un codazo que te devuelve un paso; marcar otra te resbala. Aguanta hasta que el tren termine de llegar.
      Pasarse de la raya no es caerse: se te va el zapato a la fosa y se lo lleva la rata.
   2. ¡MÉTETE! (la puerta, de frente): abre unos 3 segundos. Machacar (tocar o ESPACIO) te va metiendo entre la pared de
      gente, que empuja de vuelta. Las hojas de la puerta son el reloj.
   3. ¡EQUILIBRIO! (adentro, 40 grados): frenazos avisados con flecha; ← → sostenido, un lado de la pantalla o INCLINAR el
      teléfono para quedarte en el verde. Fuera del verde la mano se te resbala por el tubo; si llega abajo, pisas a alguien.
   Niveles: más empuje, más toques, frenazos más fuertes y verde más angosto.
   Ganas: la marea te escupe intacto en tu estación y sales al aire libre. Pierdes en la puerta: te muerde el bolso por la
   mitad y te vas con medio cuerpo afuera por el túnel a oscuras.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.metro)return;
const{LV,CONF,TU,tag,steer}=window.BUS,PI=Math.PI,GAP=.8;
const sello=f=>f<1?f*1.6:1.6+(f-1)*.29;
const rnd=(a,b)=>a+Math.random()*(b-a);
const pop=(s,x,y,col,r=8,life=.8)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
const velo=(a,f)=>{if(a<=.01)return;ctx.save();ctx.globalAlpha=Math.min(1,a);f();ctx.restore();};
const DIRS=['left','down','up','right'],ROT={right:0,down:PI/2,left:PI,up:-PI/2};
const DONA={skin:'#d9a07a',shirt:'#9b6bd1',pat:'floral',sh2:'#ffe08a',hair:'rolos',hairCol:'#3b2a22',glasses:'round',cheeks:1,wrinkles:1,earring:1,bw:52};
const SENOR={skin:'#c98a5a',shirt:'#fffdf2',pat:'tank',hair:'bald',brow:'uni',stubble:1,bw:60,hw:44};
function flecha(x,y,dir,s,col,o=4){ctx.save();ctx.translate(x,y);ctx.rotate(ROT[dir]);ctx.scale(s,s);poly([[-22,-9],[2,-9],[2,-22],[24,0],[2,22],[2,9],[-22,9]],col,o);ctx.restore();}
function bolso(x,y,rot,s,mitad){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
  if(mitad){ctx.beginPath();ctx.moveTo(-40,-50);for(let i=0;i<=8;i++)ctx.lineTo(i%2?6:-6,-50+i*12);ctx.lineTo(-40,50);ctx.closePath();ctx.clip();}
  rr(-34,-40,68,84,18,'#e8553d',4.5);rr(-22,0,44,32,8,'#c4283a',3);line([[-16,-22],[16,-22]],3,'#ffd23f');ell(0,-40,12,7,'#c4283a',3);ctx.restore();}
/* tú, de espaldas: (x, y) = media espalda; los pies quedan en y + 140·s */
function espalda(x,y,s,o){ctx.save();ctx.translate(x,y);ctx.rotate(o.rot||0);ctx.scale(s,s);const k=o.kick||0,a=o.arm||0;
  for(const sg of[-1,1]){limb(sg*18,60,sg*22+sg*k*16,128-Math.abs(k)*8,24,'#2f3a7a',4);ell(sg*25+sg*k*18,135-Math.abs(k)*8,20,10,'#ffffff',3.5);}
  for(const sg of[-1,1]){limb(sg*40,-24,sg*(52+a*30),-10-a*36,20,TU.shirt,4);ell(sg*(52+a*30),-10-a*36,12,12,TU.skin,3.5);}
  rr(-46,-40,92,112,30,TU.shirt,4.5);
  for(const sg of[-1,1])ell(sg*35,-76,7,10,TU.skin,3.5);ell(0,-78,35,37,TU.skin,4.5);ell(0,-86,35,30,TU.hairCol,4);
  if(o.bag!==0)bolso(0,6,0,1,o.bag==='mitad');ctx.restore();}
function rata(x,y,s,carga){ctx.save();ctx.translate(x,y);ctx.scale(s,s);line([[-30,-6],[-50,-16],[-66,-4]],4,'#ff9ec7');ell(0,-12,30,16,'#8f8fa8',4);ell(28,-18,14,11,'#8f8fa8',3.5);ell(22,-30,8,8,'#ffb3d0',3);ell(33,-20,2.5,2.5,INK,0);ell(42,-15,3,3,'#ff5ca8',0);
  if(carga)carga();ctx.restore();}
function zapato(x,y,rot,s=1){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);rr(-20,-8,40,16,7,'#e8553d',3.5);rr(-20,2,40,7,3,'#ffffff',2.5);line([[-4,-8],[6,-2]],2.5,'#ffffff');ctx.restore();}

/* ═════════ JEFE: EL METRO EN HORA PICO ═════════ */
function mkMetro(){
  const lv=LV(),n=lv-1,rs=Math.sqrt(SP);
  const FASES=[
    {cmd:'¡AGUANTA!',hint:'Marca la FLECHA que sale (teclado o los botones) para no pasarte de la raya amarilla',dur:6},
    {cmd:'¡MÉTETE!',hint:'¡MACHACA! (toca rápido o ESPACIO) antes de que cierre la puerta',dur:[3.2,3,2.8][n]},
    {cmd:'¡EQUILIBRIO!',hint:'← → (o mantén un lado / INCLINA el teléfono): quédate en el verde',dur:[7,7.5,8][n]}];
  let ph=0,pt=0,gap=0,fin=0,T=0,shake=0,lph=0,ev=0;

  /* ── fase 1: el andén ── */
  const EMP=[.16,.2,.24][n],PASO=.08,ph0=Math.random()*TAU,X0=230,X1=556,FY=470,PAD=[[250,538],[350,538],[450,538],[550,538]];
  const gente=[4,6,9,1,5].map((fi,i)=>({f:FACES[fi],i}));
  let px=.34,dir=DIRS[Math.random()*4|0],okT=0,malT=0,codo=0,grito=1.2,padT=[0,0,0,0];
  function marca(k){const i=DIRS.indexOf(k);if(i<0)return;padT[i]=1;
    if(k===dir){px=Math.max(.04,px-PASO);codo=1;okT=1;snd(520+Math.random()*120,.07,'square',.05);let d;do d=DIRS[Math.random()*4|0];while(d===dir);dir=d;}
    else{px+=.055;malT=1;shake=.5;snd(150,.14,'sawtooth',.06,-40);}}

  /* ── fase 2: la puerta ── */
  const NT=[10,12,14][n],REM=.04*rs;let m=0,taps=0,lunge=0;
  function machaca(){taps++;lunge=1;m=Math.min(1,m+1/NT);snd(170+(taps%5)*26,.07,'square',.045);if(taps%4===1)pop('¡PERMISO!',400+rnd(-90,90),200,'#ffffff',2);
    if(m>=1){pop('¡ADENTRO!',400,260,'#5cff7a',14);sig();}}

  /* ── fase 3: el viaje ── */
  const A0=[3.6,4,4.4][n],B=3.6,ZW=[.38,.34,.3][n],FR=[];
  {let t=1,dr=Math.random()<.5?-1:1;while(t<FASES[2].dur-1){FR.push({t,dir:dr,w:0});t+=rnd(1.25,1.7)/Math.sqrt(rs);if(Math.random()<.7)dr=-dr;}}
  let d=0,v=0,grip=1,scroll=0,tspd=1,caida=0;
  const frena=t=>{let f=.5*Math.sin(2.1*t+ph0);for(const e of FR){const u=(t-e.t)/.55;if(u>0&&u<1)f+=e.dir*A0*Math.sin(u*PI);}return f;};
  const aviso=()=>FR.find(e=>pt>=e.t-.5&&pt<e.t+.3);

  function sig(){ph++;pt=0;gap=GAP;if(ph===1){sfx.screech();sfx.ding();}else sfx.thud();
    if(ph===2&&window.DeviceOrientationEvent&&DeviceOrientationEvent.requestPermission)DeviceOrientationEvent.requestPermission().catch(()=>{});}
  function gana(){g.result='win';g.why='¡LLEGASTE!';sfx.ding();sfx.win();spawn(400,280,26,'conf',CONF);}
  function pierde(why){g.result='lose';g.why=why;lph=ph;shake=1;sfx.lose();}

  /* ── dibujo: fase 1 (el andén, de lado; la fosa a la derecha y el tren viene de frente) ── */
  function d1(){const k=clamp(pt/FASES[0].dur,0,1),lose=g.result==='lose',X=lerp(X0,X1,px)+(lose?Math.min(26,fin*90):0),S=.74,Y=FY-170*S;
    wash(0,0,800,600,'#e8dcc0','#d8c9a8');for(let i=0;i<9;i++)line([[i*100,96],[i*100,FY]],2,'#cdbd98');line([[0,300],[620,300]],2,'#cdbd98');
    rr(20,102,236,34,8,'#2f5fa8',4);txt('PLAZA VENEZUELA',138,119,18,'#ffffff',0,true);
    rr(424,102,160,54,8,'#14101c',4);txt('6:00 PM',504,119,17,'#ff8a3d',0,true);txt('RETRASO: 45 MIN',504,141,11,'#ff4d5e',0,true);
    ell(350,122,15,15,'#8f8fa8',3.5);ell(350,122,7,7,'#14101c',0);
    /* la fosa y el tren que llega de frente */
    rr(596,96,214,520,0,'#1a1626',0);
    const tk=k*k,tw_=30+tk*176,th=46+tk*300,tx=700,ty=250+tk*110;
    velo(.25+.2*k,()=>ell(tx,ty,tw_*.9,th*.7,'#fff6c8',0));
    rr(tx-tw_/2,ty-th/2,tw_,th,14*tk+3,'#e4e6ee',Math.max(2,4.5*tk));rr(tx-tw_*.4,ty-th*.36,tw_*.8,th*.3,6,'#5a4a78',Math.max(1.5,3.5*tk));rr(tx-tw_/2,ty+th*.12,tw_,th*.1,0,'#ff7a1a',0);
    for(const sg of[-1,1])ell(tx+sg*tw_*.32,ty+th*.32,3+tk*13,3+tk*13,'#fffbe0',Math.max(1.5,3*tk));
    if(tk>.3)txt('LÍNEA 1',tx,ty-th*.43,6+tk*12,INK,0,true);
    for(const sg of[-1,1])line([[tx+sg*60,600],[tx+sg*(20+tk*6),ty+th/2]],5,'#8f8fa8');
    rr(596,532,214,80,0,'#2d2640',0);
    if(!lose)rata(650+Math.sin(now*1.3)*26,566,.7,()=>{ell(48,-22,14,9,'#f4d9a0',3);});
    /* el andén y su raya amarilla */
    rr(-10,FY,606,140,0,'#b8b2a4',0);line([[0,FY],[596,FY]],5,INK);rr(536,FY-2,60,18,0,'#ffd23f',3.5);for(let i=0;i<5;i++)ell(546+i*10,FY+7,2.5,2.5,'#c9a51a',0);
    rr(590,FY-2,8,140,0,'#8f8fa8',3);
    /* la marea: todos empujan */
    const empuje=Math.sin(now*9)*.5+.5;
    for(const p of gente.slice().reverse()){const gx=X-64*(p.i+1)-8+Math.sin(now*7+p.i*2)*5,sy=Y+(p.i%2)*8;
      bust(Object.assign({},p.f,{x:gx,y:sy,s:S,th:110,bw:50,legs:['#3b3550','#ffffff',60],look:1,rot:.1+empuje*.06,mood:lose?'o':p.i%2?'yell':'angry',talk:p.i%2?empuje:0,sweat:1,vein:0,
        arms:[{side:1,a:1.45+empuje*.2,len:70,w:19},{side:-1,a:1.2,len:60,w:19}]}));}
    /* tú */
    const tambalea=lose?Math.sin(fin*18)*.25*Math.max(0,1-fin*.6):0;
    bust(Object.assign({},TU,{x:X+codo*-8,y:Y,s:S,th:110,legs:['#2f3a7a','#e8553d',60,lose&&fin>.25?'#ffffff':'#e8553d'],look:lose?1:-1,rot:lose?.22+tambalea:.12-codo*.2,
      mood:lose?(fin<1.2?'panic':'frown'):malT>.3?'yell':px>.72?'panic':'worry',talk:malT,sweat:px>.5?2:1,
      arms:lose&&fin<1.2?[{side:1,a:2.2+Math.sin(now*26),len:76,w:20},{side:-1,a:-2.2+Math.cos(now*26),len:76,w:20}]:[{side:-1,a:-1.5-codo*.5,len:60+codo*14,w:20},{side:1,a:.3,len:70,w:20}]}));
    if(!lose)tag(X,Y-S*110-26);
    /* la flecha que toca marcar */
    if(!g.result&&gap<=0){const z=1+okT*.3+Math.sin(now*12)*.04;rr(X-44*z,Y-250-44*z+44,88*z,88*z,18,malT>.3?'#ff8a8a':'#ffd23f',4.5);flecha(X,Y-206,dir,1.5*z,'#14101c',0);}
    /* los cuatro botones */
    if(!g.result)PAD.forEach(([bx,by],i)=>{const on=padT[i];rr(bx-40,by-30+on*4,80,60,14,on>.2?'#ffd23f':'#fff3c4',4);flecha(bx,by+on*4,DIRS[i],1,INK,0);});
    /* la raya */
    if(px>.7&&!g.result&&Math.sin(now*22)>-.3)txt('¡LA RAYA!',520,FY-270,30,'#ff4d5e',-.06);
    if(!g.result&&k<.3)bubble(400,196,'TREN LLEGANDO AL ANDÉN...',15,354,134);
    if(lose){const u=clamp((fin-.25)/.45,0,1);
      if(fin>.25&&fin<1.5)zapato(lerp(X+20,640,u),lerp(FY-10,556,u*u)-Math.sin(u*PI)*40,u*9);
      if(fin>=1.5)rata(640+(fin-1.5)*120,566,.75,()=>zapato(40,-34,-.3,.9));
      bubble(262,190,'¡DETRÁS DE LA RAYA AMARILLA!',17,350,134);if(fin>1.3)bubble(X-60,Y-170,'¡MI ZAPATO!',20,X,Y-100);}}

  /* ── dibujo: fase 2 (la puerta del vagón, de frente; tú de espaldas) ── */
  function d2(){const k=clamp(pt/FASES[1].dur,0,1),lose=g.result==='lose',osc=lose?clamp((fin-1)/.5,0,1):0;
    const lw=lose?116:152*ease(k),mm=ease(m),ys=lerp(476,404,mm),ss=lerp(1.1,.8,mm),ap=18+mm*46;
    wash(0,0,800,600,'#d8d2c4','#c9c2b0');
    rr(-20,100,840,432,0,'#e4e6ee',0);line([[0,100],[800,100]],5,INK);rr(-20,404,840,40,0,'#ff7a1a',0);rr(-20,444,840,12,0,'#c4283a',0);
    txt('CAP. 180 PERSONAS',116,372,13,INK,0,true);txt('(HOY: 400)',116,390,12,'#c4283a',0,true);
    for(const[wx,fa,fb]of[[36,2,7],[604,8,10]]){rr(wx,170,160,150,16,'#5a4a78',4.5);ctx.save();path(rrP(wx+7,177,146,136,10));ctx.clip();wash(wx,170,160,150,'#fff3c4','#ffe9a8');
      bust(Object.assign({},FACES[fa],{x:wx+52,y:300,s:.7,sy:.9,th:60,mood:'o',rot:-.12}));bust(Object.assign({},FACES[fb],{x:wx+112,y:306,s:.7,sy:.9,th:60,mood:lose?'yell':'worry',rot:.14,sweat:1}));ctx.restore();}
    /* el hueco de la puerta y la pared de gente */
    rr(236,140,328,392,12,'#2d2640',4.5);ctx.save();path(rrP(248,152,304,378,6));ctx.clip();wash(248,152,304,378,'#fff3c4','#ffe9a8');
    line([[248,196],[552,196]],7,'#c4cad6');for(let i=0;i<4;i++)line(closeP(ellP(290+i*74,222,10,12,10)),4,'#ffd23f');
    [5,3,0].forEach((fi,i)=>bust(Object.assign({},FACES[fi],{x:306+i*94,y:300+(i%2)*10,s:.74,th:150,mood:i===1?'yell':'angry',talk:lunge*(i===1?1:0),look:0,sweat:1})));
    const muro=()=>[[-1,SENOR],[1,DONA]].forEach(([sg,f])=>bust(Object.assign({},f,{x:400+sg*(62+ap),y:356,s:.98,th:200,flip:sg<0,rot:sg*(.04+mm*.16+lunge*.04),mood:lunge>.4?'yell':'angry',talk:lunge,look:sg<0?1:-1,sweat:2,
      arms:[{side:-1,a:-.25,len:86,w:22},{side:1,a:.25,len:86,w:22}]})));
    const yo=()=>espalda(400+Math.sin(now*40)*lunge*3,ys-lunge*8,ss,{arm:.3+mm*.7+lunge*.2,bag:lose?'mitad':1,kick:lose?Math.sin(now*20):lunge*.3,rot:Math.sin(now*30)*lunge*.03});
    if(lose||mm<.5)muro();else{yo();muro();}
    ctx.restore();
    /* las hojas: son el reloj */
    for(const sg of[-1,1]){const x=sg<0?248:552-lw;if(lw>3){rr(x,152,lw,378,0,'#c9ced6',4);if(lw>40)rr(x+10,190,lw-20,120,8,'#bfe9ff',3);if(lw>70)for(let i=0;i<3;i++)rr(x+14+i*((lw-40)/3+2),470,(lw-40)/3,12,2,i%2?INK:'#ffd23f',0);}}
    rr(264,104,272,30,8,'#14101c',3.5);txt(lose?'CERRANDO PUERTAS':k>.6?'¡CERRANDO PUERTAS!':'LÍNEA 1 · HORA PICO',400,120,14,k>.6?'#ff4d5e':'#ffd23f',0,true);
    /* el andén */
    if(!lose||fin<1){rr(0,530,800,70,0,'#b8b2a4',0);rr(0,530,800,16,0,'#ffd23f',3);}
    else{rr(0,530,800,70,0,'#1a1626',0);for(let i=0;i<6;i++)rr(((i*210-(fin-1)*1500)%1260+1260)%1260-200,548,120,8,4,'#ffe9a0',0);}
    if(lose){/* atrapado: solo se ve lo que queda entre las hojas, y las piernas pataleando sobre el andén */ctx.save();ctx.beginPath();ctx.rect(364,150,72,382);ctx.rect(270,532,260,68);ctx.clip();yo();ctx.restore();}
    else if(mm<.5)yo();
    if(!g.result){rr(250,548,300,26,13,'#14101c',3.5);if(m>.01)rr(253,551,294*m,20,10,m>.7?'#5cff7a':'#ffd23f',0);txt('¡EMPUJA!',400,561,13,m>.5?INK:'#ffffff',0,true);tag(400,ys+ss*150>560?ys-ss*150:ys-ss*138);}
    if(lose){
      /* medio bolso se queda en el andén (y luego en el túnel, tú con las piernas afuera) */
      if(fin<1){const u=clamp(fin/.4,0,1);ctx.save();ctx.scale(-1,1);bolso(-lerp(400,300,u),lerp(ys,566,u*u)-Math.sin(u*PI)*50,u*3,1,true);ctx.restore();
        if(u>=1){ell(350,572,12,8,'#f4d9a0',3);rr(232,566,26,16,3,'#3fb0ff',3);}}
      velo(osc*.62,()=>rr(0,0,800,600,0,'#05040c',0));
      if(osc>0)for(let i=0;i<4;i++){const x=((i*330-(fin-1)*1700)%1320+1320)%1320-260;velo(.5,()=>poly([[x,100],[x+70,100],[x+10,530],[x-60,530]],'#ffe9a0',0));}
      if(fin>.35)bubble(400,196,fin>1.6?'MMFF... ¿ALGUIEN ME HALA?':'¡MI BOLSO!',fin>1.6?19:24,400,ys-ss*110);
      if(fin>2)bubble(610,330,'PERMISO, VOY SALIENDO',15,520,400);}}

  /* ── dibujo: fase 3 (adentro, 40 grados) ── */
  function d3(){const win=g.result==='win',lose=g.result==='lose',F3=FASES[2],k=clamp(pt/F3.dur,0,1),FL=520,S=.82,av=g.result?null:aviso(),brk=av?1:0;
    const sal=win?ease(clamp(fin/.9,0,1)):0,lado=Math.sign(d)||1;
    ctx.save();ctx.translate(400,560);ctx.rotate(g.result?0:-d*.012+(brk?Math.sin(now*50)*.004:0));ctx.translate(-400,-560);
    wash(-40,-40,880,680,'#e8e8ee','#d8dae4');
    /* ventanas: el túnel pasa */
    for(let i=0;i<3;i++){const wx=40+i*200;rr(wx,180,170,130,14,'#5a4a78',4.5);ctx.save();path(rrP(wx+7,187,156,116,9));ctx.clip();
      if(win){wash(wx,180,170,130,'#ffe9a8','#fff3c4');txt('TU ESTACIÓN',wx+85,246,16,INK,0,true);}
      else{ctx.fillStyle=STY[style].col('#0e0c18');ctx.fillRect(wx,180,170,130);for(let j=0;j<3;j++)rr(((j*190-scroll)%570+570)%570-100+wx-200,236,70,7,3,'#ffe9a0',0);}
      ctx.restore();}
    rr(-40,96,880,40,0,'#c9ced6',0);line([[-40,136],[840,136]],4,INK);line([[-40,158],[640,158]],8,'#c4cad6');
    for(let i=0;i<6;i++){const x=40+i*104,sw=(g.result?0:-d*10)+Math.sin(now*3+i)*3;line([[x,158],[x+sw,184]],4,'#3b3550');line(closeP(ellP(x+sw,196,10,12,10)),4,'#ffd23f');}
    /* el recorrido: el trencito llega a tu estación (es el reloj) */
    rr(60,104,430,24,8,'#fffdf2',3);line([[84,116],[466,116]],4,'#ff7a1a');for(let i=0;i<5;i++)ell(84+i*95.5,116,6,6,i===4?'#5cff7a':'#ffffff',2.5);rr(76+382*(win?1:k),108,18,16,4,'#c4283a',2.5);
    rr(506,100,128,30,8,'#14101c',3);txt('40°C · SIN AIRE',570,116,13,'#ff8a3d',0,true);
    /* la puerta, a la derecha */
    rr(650,150,160,FL-150,10,'#2d2640',4.5);const dw=70*(1-ease(clamp(fin/.3,0,1))*(win?1:0));
    ctx.save();path(rrP(660,160,140,FL-160,6));ctx.clip();wash(660,160,140,FL-160,'#ffe9a8','#fff3c4');if(win)rr(660,440,140,80,0,'#b8b2a4',0);
    if(dw>2)for(const x of[660,800-dw]){rr(x,160,dw,FL-160,0,'#c9ced6',4);rr(x+8,200,dw-16,110,6,'#bfe9ff',3);}ctx.restore();
    rr(-40,FL,880,120,0,'#9b95b8',0);line([[-40,FL],[840,FL]],5,INK);
    /* los vecinos */
    const pisa=!g.result&&Math.abs(d)>ZW,cae=lose?ease(clamp(fin/.35,0,1)):0;
    const vecino=(sg,f,frase)=>{const x=400+sg*150+sal*(520-sg*150)+(lose&&lado===sg?sg*cae*30:0),hit=lose&&lado===sg,cer=pisa&&lado===sg;
      bust(Object.assign({},f,{x,y:FL-170*S-sal*30,s:S,th:110,legs:[sg<0?f.skin:'#3b3550',sg<0?'#7a1e2a':'#14101c',60],flip:sg>0,look:1,rot:(g.result?0:-d*.08)+(hit?sg*cae*.5:0),
        mood:win?'yell':hit?'yell':cer?'angry':brk?'panic':sg>0?'sleep':'calm',talk:hit||win?Math.abs(Math.sin(now*18)):0,sweat:2,vein:hit||cer?1:0,
        arms:sg<0?[{side:1,a:.2,len:70,w:19,hand:(hx,hy)=>{rr(hx-22,hy,44,46,8,'#5cd06a',3.5);line(arcPts(hx,hy,14,PI,TAU,6),4,'#3a8f4a');}},{side:-1,a:PI-.3,len:86,w:19}]
          :[{side:1,a:PI-.2,len:86,w:20},{side:-1,a:hit?2.4:.9,len:54,w:20,hand:hit?null:(hx,hy)=>{ell(hx,hy-10,17,10,'#f4d9a0',3);ell(hx,hy-11,10,5,'#e8b86a',0);}}]}));
      if(hit&&fin>.3)bubble(clamp(x,190,610),200,frase,22,x,FL-170*S-90);};
    vecino(-1,DONA,'¡MI JUANETE!');vecino(1,SENOR,'¡MI EMPANADA!');
    if(lose&&lado>0&&fin>.3){const u=clamp((fin-.3)/.8,0,1);ell(lerp(560,690,u),lerp(360,FL-12,u*u)-Math.sin(u*PI)*150,17,10,'#f4d9a0',3);}
    /* el tubo y tú */
    pole(400,140,FL+8);
    const ang=lose?lado*cae*1.15:win?0:d*.34,fx=354+(g.result?0:d*14)+sal*520,gy=lerp(430,236,grip),s2=S;
    if(win&&fin<.9){/* la marea te saca en hombros */const yy=FL-250-Math.sin(sal*PI)*40;
      bust(Object.assign({},TU,{x:fx,y:yy,s:s2,th:110,rot:-1.2,legs:['#2f3a7a','#e8553d',60],mood:'o',look:1,arms:[{side:1,a:2.6,len:70,w:20},{side:-1,a:-2.6,len:70,w:20}]}));
      for(let i=0;i<4;i++)bust(Object.assign({},FACES[[4,9,6,1][i]],{x:fx-90+i*56,y:FL-170*.7,s:.7,th:110,legs:['#3b3550','#ffffff',60],mood:'yell',talk:1,look:1,arms:[{side:1,a:2.9,len:70,w:19},{side:-1,a:-2.9,len:70,w:19}]}));}
    else if(!win){
      /* la mano va en el tubo, a la altura del agarre: el brazo la sigue aunque el cuerpo se incline */
      const c=Math.cos(-ang),sn=Math.sin(-ang),dx=400-fx,dy=gy-FL,lx=(dx*c-dy*sn)/s2-TU.bw*.78,ly=(dx*sn+dy*c)/s2+170-4,aA=Math.atan2(lx,ly),aL=clamp(Math.hypot(lx,ly),16,150);
      ctx.save();ctx.translate(fx,FL);ctx.rotate(ang);
      bust(Object.assign({},TU,{x:0,y:-170*s2,s:s2,th:110,legs:['#2f3a7a','#e8553d',60],look:lose?lado:-lado,
        mood:lose?'yell':pisa?'yell':Math.abs(d)>ZW*.6||brk?'panic':'worry',talk:pisa||lose?Math.abs(Math.sin(now*18)):0,sweat:2,
        arms:lose?[{side:1,a:2.4,len:76,w:20},{side:-1,a:-2.4,len:76,w:20}]:[{side:1,a:aA,len:aL,w:20},{side:-1,a:-.5+Math.sin(now*(pisa?22:6))*(pisa?.5:.1),len:66,w:20,hand:(hx,hy)=>bolso(hx,hy+34,Math.sin(now*5)*.1,.62)}]}));
      ctx.restore();
      if(!lose){ell(400,gy,13,13,TU.skin,3.5);if(grip<.6)for(let i=0;i<2;i++)ell(392+i*16,gy+22+((now*60+i*30)%40),3,5,'#9fe3ff',2);tag(fx,FL-170*s2-116);}
      else{const u=clamp(fin/.9,0,1);bolso(lerp(fx,fx-lado*190,u),lerp(380,FL-30,u*u)-Math.sin(u*PI)*230,u*8,.62);}}
    if(win&&fin>.25)bubble(430,214,'¡PERMISO, PERMISO, PERMISO!',19,560,330);
    ctx.restore();
    /* el calor */
    velo(.08+.05*Math.sin(now*3),()=>rr(0,96,800,424,0,'#ff8a3d',0));
    if(!g.result){
      /* la barra de equilibrio */
      rr(118,530,564,44,20,'#2d2640',4);const gx=u=>400+240*u;
      line([[gx(-1),552],[gx(1),552]],14,'#ff4d5e');line([[gx(-ZW),552],[gx(ZW),552]],14,brk&&Math.sin(now*30)>0?'#fff3a8':'#5cff7a');
      const st=steer();flecha(142,552,'left',.6,st<-.2?'#ffe14d':'#8f8fa8',0);flecha(658,552,'right',.6,st>.2?'#ffe14d':'#8f8fa8',0);
      ell(gx(d),552,14,14,pisa&&Math.sin(now*30)>0?'#ff4d5e':'#ffffff',4);
      rr(340,532,120,8,4,'#14101c',0);if(grip>.02)rr(342,534,116*grip,4,2,grip<.4?'#ff4d5e':'#ffd23f',0);
      if(av){txt('¡FRENAZO!',400,158,32,'#ff4d5e');for(let i=0;i<3;i++)flecha(400+av.dir*(130+i*34+(now*120%34)),158,av.dir>0?'right':'left',.8,'#ff4d5e',3);}}}

  /* ── el final bueno: al aire libre ── */
  function dFuera(u){
    wash(0,0,800,600,'#8fd8ff','#e8f8ff');ell(660,150,44,44,'#ffe14d',0);for(let i=0;i<8;i++){const a=i*TAU/8+now*.4;line([[660+Math.cos(a)*56,150+Math.sin(a)*56],[660+Math.cos(a)*74,150+Math.sin(a)*74]],5,'#ffe14d');}
    [[-20,250,150,230,'#ffb36b'],[120,300,120,180,'#a9a0ff'],[560,270,140,210,'#ff9ec7'],[690,230,140,250,'#6ecf8f']].forEach(([x,y,w,h,c])=>{rr(x,y,w,h,6,c,3.5);for(let i=0;i<2;i++)rr(x+16+i*(w/2.2),y+22,w/4,26,4,'#ffffff',2.5);});
    rr(0,480,800,120,0,'#d8d2c4',0);line([[0,480],[800,480]],4,INK);
    /* la boca del metro */
    rr(60,400,210,90,8,'#5a5274',4.5);rr(76,414,178,76,4,'#14101c',3);for(let i=0;i<4;i++)rr(84+i*8,474-i*14,162-i*16,12,0,'#3b3550',0);rr(96,352,138,40,8,'#2f5fa8',4);txt('SALIDA',165,372,20,'#ffffff',0,true);
    const sale=ease(clamp(u/.35,0,1)),hop=Math.abs(Math.sin(u*8))*18*Math.max(0,1-u*.5);
    bust(Object.assign({},TU,{x:lerp(170,400,sale),y:lerp(420,320,sale)-hop,s:lerp(.6,1,sale),th:110,legs:['#2f3a7a','#e8553d',60],mood:'happy',cheeks:1,sweat:1,
      arms:[{side:1,a:2.7+Math.sin(now*9)*.15,len:80,w:21},{side:-1,a:.5,len:60,w:21,hand:(hx,hy)=>bolso(hx,hy+36,0,.66)}]}));
    hen(700,468,.6,-1);
    if(u>.3)txt('¡AIRE!',400,150+Math.sin(now*6)*4,60,'#ffffff',-.05);
    [['BOLSO','✓'],['ZAPATOS','✓'],['PEINADO','✗']].forEach(([a,b],i)=>{if(u<.6+i*.3)return;rr(560,300+i*46,200,38,10,'#fffdf2',3.5);txt(a,632,320+i*46,16,INK,0,true);txt(b,730,320+i*46,24,b==='✓'?'#2f8f4a':'#ff4d5e');});}

  const g={lr:true,result:null,why:'',endT:0,
    get t(){return gap>0?0:pt;},get dur(){return FASES[ph].dur;},get cmd(){return FASES[ph].cmd;},get hint(){return FASES[ph].hint;},
    get impact(){return this.result?clamp(1-fin/.5,0,1):shake*.6;},
    probe:()=>({ph,pt,gap,px,dir,m,need:NT,d,v,grip,ZW,FR,fin}),
    press(k){if(g.result||gap>.25)return;if(ph===0)marca(k);else if(ph===1)machaca();},
    down(p){if(g.result||gap>.25)return;
      if(ph===0){PAD.forEach(([bx,by],i)=>{if(Math.abs(p.x-bx)<48&&Math.abs(p.y-by)<40)marca(DIRS[i]);});}
      else if(ph===1)machaca();},
    update(dt){T+=dt;shake=Math.max(0,shake-dt*3);okT=Math.max(0,okT-dt*5);malT=Math.max(0,malT-dt*3);codo=Math.max(0,codo-dt*5);lunge=Math.max(0,lunge-dt*6);
      for(let i=0;i<4;i++)padT[i]=Math.max(0,padT[i]-dt*6);
      if(g.result){fin+=dt;g.endT=sello(fin);
        if(g.result==='win'){if(ev<1&&fin>=.95){ev=1;sfx.whoosh();}if(ev<2&&fin>=1.6){ev=2;sfx.ding();}if(ev<3&&fin>=1.9){ev=3;sfx.ding();}if(ev<4&&fin>=2.2){ev=4;sfx.boing();}}
        else if(lph===0){if(ev<1&&fin>=.7){ev=1;snd(900,.12,'sine',.08,-500);}if(ev<2&&fin>=1.5){ev=2;sfx.cluck();}}
        else if(lph===1){if(ev<1&&fin>=1){ev=1;snd(90,1.6,'sawtooth',.07,60);nz(.5,.1);}}
        else{if(ev<1&&fin>=.3){ev=1;sfx.crash();}}
        return;}
      if(gap>0){gap-=dt;return;}
      pt+=dt;const F=FASES[ph];
      if(ph===0){const k=pt/F.dur;px+=EMP*(1+.4*k)*(1+.35*Math.sin(pt*3.1+ph0))*dt;
        if((grito-=dt)<=0){grito=rnd(.9,1.5);pop(['¡EMPUJEN!','¡CÓRRANSE!','¡AVANCEN!','¡EPA!'][Math.random()*4|0],lerp(X0,X1,px)-rnd(120,260),FY-300,'#ffffff',2);}
        if(px>=1){px=1;pierde('¡LA RAYA!');sfx.screech();}
        else if(pt>=F.dur)sig();}
      else if(ph===1){m=Math.max(0,m-REM*dt);if(pt>=F.dur){pierde('¡TE MORDIÓ!');sfx.crash();}}
      else{for(const e of FR)if(!e.w&&pt>=e.t-.5){e.w=1;sfx.screech();}
        const f=frena(pt);tspd+=((aviso()?.25:1)-tspd)*Math.min(1,dt*5);scroll+=dt*900*tspd;
        v+=(f+steer()*B)*dt;v*=Math.exp(-2.2*dt);d+=v*dt;if(Math.abs(d)>1){d=Math.sign(d);v=0;}
        grip=clamp(grip+(Math.abs(d)>ZW?-dt/1.05:dt/3),0,1);
        if(grip<=0)pierde(d<0?'¡PISASTE A LA DOÑA!':'¡TUMBASTE AL SEÑOR!');
        else if(pt>=F.dur)gana();}},
    draw(){
      ctx.save();if(shake>0)ctx.translate(Math.sin(now*70)*shake*5,Math.cos(now*61)*shake*3);
      if(g.result==='win'&&fin>.95)dFuera(fin-.95);else[d1,d2,d3][ph]();
      ctx.restore();
      if(!g.result){for(let i=0;i<3;i++)ell(574+i*22,76,7,7,i<ph?'#5cff7a':i===ph?'#ffd23f':'#fff3c4',3);
        if(gap>0){velo(gap/GAP*1.6,()=>{rr(0,250,800,96,0,'#14101c',0);txt('FASE '+(ph+1)+' DE 3',400,298,44,'#ffd23f');});}}
      drawP();
    }};
  return g;
}

BUS.add('metro',{name:'JEFE · METRO',mk:mkMetro,card:'EL METRO',num:'J2'});
})();
