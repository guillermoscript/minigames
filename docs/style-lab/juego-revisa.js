'use strict';
/* MiniCaos · laboratorio de estilos: ¡REVISA! (el billete).
   Eres el colector: cada pasajero te pasa un billete y hay que decidir YA. ✓ ACEPTAR el bueno, ✗ RECHAZAR el chimbo
   (roto y pegado con tirro marrón, de juguete, viejo del 2012, pintado a mano en una hoja de cuaderno).
   Varios billetes seguidos, cada uno con su ventanita: nivel 1 = 3 billetes, nivel 2 = 4 (más el pintado y el del tirrito),
   nivel 3 = 5 (y ya nadie pone cara de culpable).
   Se carga DESPUÉS de juegos-bus.js y dibuja con las primitivas de index.html, así que sale en todos los estilos. */
(function(){
if(!window.BUS||GAMES.revisa)return;
const{LV,CONF,TU,say,tag}=BUS;
const CH={skin:'#b87b50',shirt:'#fffdf2',pat:'tank',hair:'slick',hairCol:'#14101c',stache:1,chain:1,glasses:'shades',earring:1,gold:1,bw:58,hw:44,hh:43};
const chofer=o=>bust(Object.assign({},CH,o));
const VERDE=['#7fd08a','#d8f5cf'],AZUL=['#8fc4ff','#dcecff'],BANCO='BANCO DE LA CAMIONETICA';

/* ───────── los billetes (inventados: 360x170, centrados en 0,0) ───────── */
/* retrato: un chigüire con su naranja en la cabeza (el del 2012 ya tiene barba y lentes) */
function chig(k,viejo){const c='#a9713a',d='#7a4f2a';
  for(const sg of[-1,1])ell(sg*20*k,-22*k,7*k,7*k,d,3);
  rr(-25*k,-24*k,50*k,48*k,17*k,c,3.5);rr(-17*k,0,34*k,22*k,9*k,d,3);
  for(const sg of[-1,1]){ell(sg*12*k,-8*k,3.4*k,4*k,INK,0);ell(sg*6*k,8*k,2.4*k,2*k,INK,0);}
  if(viejo){poly([[-15*k,17*k],[15*k,17*k],[9*k,37*k],[0,43*k],[-9*k,37*k]],'#f1ece2',3);for(const sg of[-1,1])line(closeP(ellP(sg*12*k,-8*k,9*k,9*k,10)),2.5,INK);line([[-3*k,-8*k],[3*k,-8*k]],2.5,INK);}
  else{ell(0,-31*k,9*k,8*k,'#ff8a3d',3);line([[0,-38*k],[5*k,-44*k]],3,'#3aa86a');}}
function arepa(k){ell(0,10*k,38*k,19*k,'#e2b872',3.5);rr(-37*k,-5*k,74*k,14*k,6,'#ffd23f',3);ell(0,-10*k,38*k,21*k,'#f6e2b0',3.5);
  for(const[x,y]of[[-20,-18],[15,-23],[24,-8]])ell(x*k,y*k,5*k,3.5*k,'#c98a4e',0);
  for(const sg of[-1,1])ell(sg*10*k,-13*k,3*k,3.6*k,INK,0);line(arcPts(0,-12*k,9*k,Math.PI*.2,Math.PI*.8,5),3);}
function cara(col,den,top,bot,retrato,sinDer){const[b,i]=col,d=dark(b,.62);
  rr(-180,-85,360,170,10,b,4.5);rr(-168,-73,336,146,6,i,3);
  for(const sx of[-156,156])for(const sy of[-61,61])ell(sx,sy,6,6,b,2.5);
  for(const sg of sinDer?[-1]:[-1,1]){ell(sg*116,2,40,40,b,3.5);txt(den,sg*116,3,den.length>2?30:44,'#fffdf2');}
  ell(0,4,48,50,'#fffdf2',3.5);ctx.save();ctx.translate(0,8);retrato();ctx.restore();
  txt(top,0,-61,12,d,0,true);txt(bot,0,63,13,d,0,true);}
const v20=()=>cara(VERDE,'20',BANCO,'VEINTE LUCAS',()=>chig(1.05));
function tirro(x,y,w,h,r){ctx.save();ctx.translate(x,y);ctx.rotate(r);rr(-w/2,-h/2,w,h,2,'#b07a3c',3.5);
  line(w>h?[[-w/2+9,-h/2+9],[w/2-9,-h/2+9]]:[[-w/2+9,-h/2+9],[-w/2+9,h/2-9]],3,'#d9aa6a');ctx.restore();}
const ZIG=[[5,-85],[-9,-62],[8,-40],[-8,-16],[9,8],[-7,32],[8,56],[-5,85]];
/* nota: lo que flota al rechazarlo bien · grito: lo que te grita el chofer si lo aceptas */
const TIPOS={
  v20:{mas:'+20',draw:v20},
  a50:{mas:'+50',draw(){cara(AZUL,'50',BANCO,'CINCUENTA LUCAS',()=>arepa(1.05));}},
  /* partido en dos y remendado con tirro marrón; q>0: el tirro se rinde y las mitades se separan */
  roto:{nota:'¡TIRRO!',grito:'¡ESO ES PURO TIRRO!',draw(q){
    for(const sg of[-1,1]){ctx.save();ctx.translate(sg*(8+q*52),-sg*5+q*q*46);ctx.rotate(sg*(.035+q*.32));
      path([[sg*200,-110],[ZIG[0][0],-110],...ZIG,[ZIG[7][0],110],[sg*200,110]]);ctx.clip();v20();line(ZIG,7,INK);ctx.restore();}
    [[0,0,42,174,.05],[0,-40,176,36,-.1],[2,38,196,38,.08]].forEach(([x,y,w,h,r],i)=>tirro(x+(i-1)*q*34,y+q*q*(170+i*34),w,h,r+q*(i-1)*1.3));}},
  /* casi bueno: un rasgoncito y UN solo pedazo de tirro (niveles 2 y 3) */
  tirrito:{nota:'¡TIRRO!',grito:'¡ESE TIENE TIRRO!',draw(){v20();line([[96,-85],[87,-64],[100,-44],[90,-22],[98,-4]],4,INK);tirro(95,-50,56,112,.14);}},
  juguete:{nota:'¡DE JUGUETE!',grito:'¡ESO ES DE JUGUETE!',draw(){
    rr(-180,-85,360,170,10,'#ff9ec7',4.5);rr(-168,-73,336,146,6,'#ffe6f1',3);
    for(const sg of[-1,1]){ell(sg*116,2,40,40,'#ff5ca8',3.5);txt('500',sg*116,3,30,'#fffdf2');txt('★',sg*60,-40,20,'#ffd23f');}
    ctx.save();ctx.translate(0,4);ctx.rotate(-.2+Math.sin(now*5)*.06);rr(-33,-33,66,66,12,'#ffffff',4);for(const[x,y]of[[-17,-17],[17,-17],[0,0],[-17,17],[17,17]])ell(x,y,6.5,6.5,'#c4283a',0);ctx.restore();
    txt('BANCO DEL JUEGO DE MESA',0,-61,12,'#8a1f4a',0,true);txt('BILLETE DE JUGUETE',0,63,13,'#8a1f4a',0,true);}},
  viejo:{nota:'¡DEL 2012!',grito:'¡ESE ES DEL 2012!',draw(){
    cara(['#b9a57c','#dccfa8'],'100',BANCO,'SERIE 2012',()=>chig(1.05,1),1);
    ell(-66,44,22,11,'#a8915f',0);ell(58,-50,15,8,'#a8915f',0);
    ctx.save();ctx.translate(114,6);ctx.rotate(-.2);rr(-58,-27,116,54,6,'#fffdf2',4.5);txt('2012',0,1,36,'#e8293f');ctx.restore();
    poly([[146,85],[180,51],[146,51]],'#8f7d58',3);
    const R=[[88,0],[78,38],[48,66],[0,80]];for(const[x,y]of R)line([[-180,-85],[-180+x,-85+y]],2,'#5a5274');
    for(const f of[.5,.95])line(R.map(([x,y])=>[-180+x*f,-85+y*f]),2,'#5a5274');
    const a=now*7,fx=104+Math.cos(a)*30,fy=-66+Math.sin(a*1.3)*10;ell(fx-4,fy-4,5,3,'#ffffff',1.5);ell(fx+4,fy-4,5,3,'#ffffff',1.5);ell(fx,fy,5,4,INK,0);}},
  /* pintado con creyón en una hoja de cuaderno (niveles 2 y 3) */
  dibujo:{nota:'¡PINTADO!',grito:'¡ESO LO PINTÓ UN NIÑO!',draw(){const C='#3aa86a';
    rr(-180,-85,360,170,3,'#fdfbf0',4);for(let i=0;i<6;i++)line([[-176,-62+i*25],[176,-62+i*25]],1.8,'#8fc4ff');line([[-140,-83],[-140,83]],2.2,'#ff5c8a');
    for(const y of[-52,0,52])ell(-160,y,6,6,'#5a5274',0);
    line([[-128,-70],[-40,-75],[60,-68],[166,-72],[170,0],[164,70],[40,75],[-60,68],[-126,72],[-131,0],[-128,-70]],5,C);
    txt('20',-82,-4,50,C,-.14);txt('20',118,-28,30,C,.16);
    line(closeP(ellP(22,-12,30,32,9)),4.5,INK);ell(11,-20,3.5,4.5,INK,0);ell(33,-20,3.5,4.5,INK,0);line(arcPts(22,-14,16,Math.PI*.15,Math.PI*.85,5),4);
    for(const sg of[-1,1])line([[22+sg*30,-34],[22+sg*42,-52]],4);
    txt('BIYETE',40,50,24,'#ff8a3d',.05);}}};
function billete(k,x,y,rot,s,q){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);TIPOS[k].draw(q||0);ctx.restore();}
function equis(x,y,rot,s){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);line([[-74,-52],[74,52]],16,'#ff3b4e');line([[74,-52],[-74,52]],16,'#ff3b4e');ctx.restore();}
/* los ojotes del chofer: enormes, llenos de venas, con la pupila chiquita temblando */
function ojos(x,y,s,rot,fl){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(fl*s,s);const ey=HY-8,j=Math.sin(now*47)*1.4;
  for(const sg of[-1,1]){const cx=sg*22,P=(a,r)=>[cx+Math.cos(a)*r,ey+Math.sin(a)*r*1.1];ell(cx,ey,20,22,'#ffffff',4);
    for(let i=0;i<7;i++){const a=i/7*TAU+sg*.5+.3;poly([P(a-.13,19),P(a+.13,19),P(a+(i%2?.3:-.3),9+(i%3)*2.5)],'#ff3b4e',0);}
    ell(cx+j-sg*3,ey+2,5,5.5,INK,0);
    limb(sg*46,ey-35,sg*5,ey-21,9,'#14101c',2.5);line(arcPts(cx,ey+7,22,Math.PI*.2,Math.PI*.8,5),2.5);}
  ctx.restore();}

/* ═════════ GAME 18: ¡REVISA! ═════════ */
function mkRevisa(){
  const rs=Math.sqrt(SP),lv=LV(),N=lv+2,DUR=5/rs,WIN=1.5*DUR/N,IN=.24/rs,LOCK=.09,OUT=.55/rs,FLY=.2;
  const mez=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
  /* siempre hay al menos uno bueno y uno chimbo; la mitad de las veces el primer chimbo de la bolsa es el del tirro */
  const bag=mez(lv>=2?['roto','juguete','viejo','dibujo','tirrito']:['roto','juguete','viejo']),ti=bag.findIndex(k=>k==='roto'||k==='tirrito');if(Math.random()<.5)bag.unshift(bag.splice(ti,1)[0]);
  const nb=lv===2?2:lv===1?1+(Math.random()<.5):2+(Math.random()<.5),flags=mez(Array.from({length:N},(_,i)=>i<nb)),fs=mez([0,3,4,5,6,7,9,10,11]);let bi=0;
  const Q=flags.map((bad,i)=>({k:bad?bag[bi++]:lv>=2&&Math.random()<.5?'a50':'v20',bad,f:FACES[fs[i]],st:'cola',tx:0}));
  const HA=.95,hold=len=>[{side:-1,a:-HA,len,w:20},{side:1,a:HA,len,w:20}],HL=75/Math.cos(HA),HOLD=hold(HL),REL=[{side:-1,a:-.2,len:72,w:20},{side:1,a:.2,len:72,w:20}],UP=[{side:-1,a:-2.5,len:76,w:20},{side:1,a:2.5,len:76,w:20}];
  /* cada billete tiene su ventanita (vez y media el promedio), pero el reloj de arriba manda: lo que ahorras en uno fácil te sirve para el siguiente */
  const lim=()=>Math.min(t0+WIN,DUR);
  let cur=0,t0=0,bL=0,bR=0,kind='',drv=false,boo=false,scroll=0,note=0,rain=0;
  const pas=(b,x,y,s,o)=>bust(Object.assign({},b.f,{x,y,s,th:110,bw:50,vein:0,sweat:0,legs:['#3b3550','#ffffff',120],arms:HOLD},o));
  const pulgares=(b,x,y,s,len)=>{for(const sg of[-1,1])ell(x+sg*s*(39+len*Math.sin(HA)),y+s*(len*Math.cos(HA)+13),10*s,14*s,b.f.skin,3.5);};
  const colado=()=>400-clamp((g.endT-.1)/1.1,0,1)*520;
  function decide(acc){if(g.result||g.t-t0<LOCK)return;const b=Q[cur];if(acc)bR=1;else bL=1;b.tx=g.t;
    if(acc===!b.bad){b.st=acc?'ok':'no';cur++;t0=g.t;
      if(acc){snd(988,.09,'sine',.1);snd(1480,.14,'sine',.07);say(TIPOS[b.k].mas,400,470,'#5cff7a');}
      else{nz(.07,.12);snd(190,.12,'square',.06,-90);say(TIPOS[b.k].nota,400,262,'#ff4d5e');spawn(400,300,6,'★',['#ffe14d'],240,500,.5);}
      if(cur>=N){g.result='win';g.why='¡COBRADO!';sfx.win();spawn(400,340,26,'conf',CONF);}}
    else{g.result='lose';kind=acc?'chimbo':'bueno';g.why=acc?'¡CHIMBO!':'¡ERA BUENO!';sfx.lose();if(!acc)sfx.thud();}}
  const g={lr:true,get impact(){return this.result?clamp(1-this.endT/.5,0,1):0;},probe:()=>({cur,N,Q,t0,WIN,LOCK,kind}),t:0,dur:DUR,result:null,why:'',endT:0,cmd:'¡REVISA!',
    hint:'← RECHAZA el billete chimbo (roto, de juguete, viejo)  ·  ACEPTA el bueno →',
    press(k){if(k==='left')decide(false);else if(k==='right')decide(true);},
    down(p){decide(p.x>=400);},
    update(dt){g.t+=dt;scroll+=dt*150;bL=Math.max(0,bL-dt*5);bR=Math.max(0,bR-dt*5);
      if(!g.result){if(g.t>=lim()){g.result='lose';kind='lento';g.why='¡SE COLEÓ!';Q[cur].tx=g.t;sfx.lose();}return;}
      g.endT+=dt;
      if(g.result==='win'){if(g.endT<1.3&&(rain-=dt)<=0){rain=.07;PT.push({x:60+Math.random()*680,y:86,vx:(Math.random()-.5)*80,vy:140,g:260,t:0,life:1.5,kind:'bill',col:'#5cd06a',r:7+Math.random()*4,rot:Math.random()*6,vr:(Math.random()-.5)*10});}}
      else if(kind==='bueno'){if(!boo&&g.endT>=.45){boo=true;sfx.boing();say(Q[cur+1]?'¡ABUSADOR!':'¡QUÉ ABUSO!',Q[cur+1]?690:150,214,'#ffe14d');}}
      else{if(!drv&&g.endT>=.14){drv=true;sfx.crash();sfx.screech();spawn(600,226,7,'bit',['#15131c','#6a6a88'],320,800,.9);spawn(70,300,6,'feather',['#f1ece2','#b3552d'],200,300,1);}
        if((note-=dt)<=0){note=.3;PT.push({x:colado()+44,y:204,vx:-20,vy:-34,g:0,t:0,life:.7,kind:'♪',col:'#ffffff',r:4,rot:0,vr:0});}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,b=Q[cur],nx=Q[cur+1],tell=lv<3,wdx=lerp(1010,668,ease(clamp((e-.2)/.25,0,1)));
      ctx.save();if(lose)ctx.translate(Math.sin(now*40)*5*Math.max(0,1-e*2.2),0);
      /* el bus por dentro: techo con sus avisos, pasamanos, ventanas con la calle */
      wash(gameLeft(),0,GAME_VIEW.width,600,'#f6e3b4','#ecd29a');
      rr(gameLeft(),92,GAME_VIEW.width,36,0,'#d9dce6',0);line([[gameLeft(),128],[gameRight(),128]],4,INK);txt('NO SE ACEPTAN BILLETES ROTOS',150,110,13,INK,0,true);txt('NO HAY VUELTO',580,110,13,'#c4283a',0,true);
      line([[0,150],[690,150]],8,'#c4cad6');
      for(let i=0;i<6;i++){const x=50+i*118,sw=Math.sin(now*2+i)*2;line([[x,150],[x+sw,174]],4,'#3b3550');line(closeP(ellP(x+sw,185,9,11,10)),4,'#ffd23f');}
      for(const wx of[26,184,534]){rr(wx,200,134,112,12,'#5a4a78',4.5);
        ctx.save();path(rrP(wx+6,206,122,100,8));ctx.clip();wash(wx,200,134,112,'#8fd8ff','#e8f8ff');
        for(let j=0;j<6;j++){const bx=((j*170-scroll)%1020+1020)%1020-120;rr(bx,238+(j%3)*14,128,100,4,['#ffb36b','#a9a0ff','#ff9ec7','#6ecf8f','#ffd23f','#8aa0ff'][j],3);}
        ctx.restore();}
      /* asientos del fondo + la abuela dormida con la gallina de sombrero */
      for(const sx of[10,150,540]){rr(sx,356,118,130,18,'#3fa0ff',4);rr(sx+12,340,94,40,14,'#6fbcff',3.5);}
      bust(Object.assign({},FACES[2],{x:70,y:392,s:.6,th:110,mood:g.result?'o':'sleep'}));
      hen(70,311-(lose&&e<1?Math.abs(Math.sin(e*10))*22:0),.5,1);
      if(!g.result)for(let i=0;i<3;i++){const u=(now*.5+i/3)%1;txt('Z',104+u*30,318-u*56,11+u*13,'#ffffff');}
      /* los que ya pasaron: el que pagó bien camina pa'l fondo; el del billete chimbo sale volando con todo y billete */
      for(const p of Q){if(p===b&&lose)continue;
        if(p.st==='ok'){const u=clamp((g.t-p.tx)/OUT,0,1);if(u<1)pas(p,400-490*u*(.4+.6*u),226+12*u-Math.abs(Math.sin(u*9))*8,lerp(.9,.74,u),{mood:'happy',look:-1,arms:REL});}
        else if(p.st==='no'){const u=clamp((g.t-p.tx)/OUT,0,1);if(u<1){const x=400+u*330,y=226-u*520+u*u*200,s=lerp(.9,.55,u),r=u*5.5;
          pas(p,x,y,s,{mood:'panic',rot:r,arms:UP});ctx.save();ctx.translate(x,y);ctx.rotate(r);billete(p.k,0,s*166,0,s);equis(0,s*166,0,s);ctx.restore();}}}
      /* el colado: aceptaste el chimbo (o te dormiste) y se va silbando pa'l fondo */
      if(lose&&kind!=='bueno'){const x=colado(),s=.84;pas(b,x,236-Math.abs(Math.sin(e*8))*6,s,{mood:'grin',gold:1,look:-1,arms:kind==='lento'?HOLD:REL});
        if(kind==='lento')billete(b.k,x,236+s*75+56,0,.66);}
      /* asientos de adelante */
      rr(-14,404,232,100,22,'#2f7fe0',4.5);rr(8,392,84,34,12,'#6fbcff',3.5);rr(112,392,84,34,12,'#6fbcff',3.5);rr(584,404,104,100,22,'#2f7fe0',4.5);rr(594,392,84,34,12,'#6fbcff',3.5);
      /* la puerta: por ahí se montan */
      rr(692,140,108,350,10,'#2d2640',4.5);
      ctx.save();path(rrP(700,150,92,334,6));ctx.clip();wash(700,150,92,260,'#8fd8ff','#e8f8ff');rr(700,392,92,100,0,'#d8d2c4',0);line([[700,392],[792,392]],4,INK);ctx.restore();
      rr(700,96,92,30,8,'#c4283a',3.5);txt('SUBIDA',746,112,15,'#ffffff',0,true);rr(686,446,114,44,0,'#8f8fa8',4);rr(686,440,114,12,4,'#ffd23f',3.5);
      if(nx)pas(nx,748,313,.62,{mood:lose&&kind==='bueno'?'angry':g.result?'o':'calm',look:-1,arms:REL});
      /* el pasajero de turno con su billete */
      if(b&&!g.result){const u=ease(clamp((g.t-t0)/IN,0,1)),x=lerp(748,400,u),y=lerp(313,226,u),s=lerp(.62,.9,u),bs=s/.9,sus=b.bad&&tell;
        pas(b,x,y,s,{mood:sus?'grin':'smile',gold:sus?1:0,look:sus?-1:0,sweat:sus?2:0});
        billete(b.k,x,y+s*72+85*bs,(1-u)*.25+Math.sin(now*9)*.012,bs);pulgares(b,x,y,s,HL);
        const w=clamp((lim()-g.t)/WIN,0,1);rr(238,466,324,13,6,'#14101c',0);if(w>.01)rr(241,469,318*w,7,3,w<.35?'#ff4d5e':'#ffd23f',0);}
      /* rechazaste uno bueno: el pasajero se te viene encima con su billete */
      if(lose&&kind==='bueno'){const u=ease(clamp(e/.22,0,1)),s=lerp(.9,1.32,u),y=lerp(226,292,u),x=400+Math.sin(now*44)*3*Math.max(0,1-e),by=lerp(376,452,u),len=((by-85-y)/s-4)/Math.cos(HA);
        pas(b,x,y,s,{mood:'yell',talk:.5+.5*Math.sin(now*24),vein:1,teeth:1,sweat:1,rot:Math.sin(now*27)*.025,arms:hold(len)});
        billete(b.k,x,by,Math.sin(now*30)*.02,1);pulgares(b,x,y,s,len);
        if(e>.3){ctx.save();ctx.translate(x+96,by-58);ctx.rotate(.16);const k=1+Math.max(0,.5-e)*2;ctx.scale(k,k);rr(-64,-23,128,46,8,'#5cff7a',4);txt('¡BUENO!',0,1,24,INK,0,true);ctx.restore();}}
      /* ganaste: el chofer se asoma con el pulgar arriba */
      if(win&&e>.2)chofer({x:wdx,y:318-Math.abs(Math.sin(now*7))*5,s:1.02,flip:true,mood:'grin',rot:Math.sin(now*7)*.03,legs:['#2b2b3a','#14101c',80],
        arms:[{side:1,a:2.2,len:78,w:22,hand:(hx,hy)=>{rr(hx-13,hy-13,26,26,9,CH.skin,3.5);rr(hx-6,hy-40,13,30,6,CH.skin,3.5);}},{side:-1,a:-.3,len:70,w:22}]});
      /* tablero: los dos botones, cuántos van y el fajo */
      rr(gameLeft(),484,GAME_VIEW.width,116,0,'#5a5274',0);line([[gameLeft(),484],[gameRight(),484]],5,INK);
      if(!g.result){
        const boton=(cx,col,lab,on,ic)=>{ctx.save();ctx.translate(cx,528);rr(-160,-32,320,74,22,dark(col,.5),4);ctx.translate(0,on*7);rr(-160,-40,320,74,22,col,4.5);for(const p of ic)line(p,9,'#fffdf2');txt(lab,26,-3,30,'#fffdf2');ctx.restore();};
        boton(184,'#ff4d5e','RECHAZAR',bL,[[[-128,-19],[-98,13]],[[-98,-19],[-128,13]]]);boton(616,'#3ecf6a','ACEPTAR',bR,[[[-124,-4],[-112,11],[-90,-19]]]);
        for(let i=0;i<N;i++)ell(400+(i-(N-1)/2)*18,499,6,6,i<cur?'#5cff7a':i===cur?'#ffe14d':'#2d2640',2.5);
        const got=Q.filter(p=>p.st==='ok'&&g.t-p.tx>=FLY);ell(400,566,22,13,TU.skin,3.5);
        got.forEach((p,i)=>{ctx.save();ctx.translate(400,566);ctx.rotate((i-(got.length-1)/2)*.34);rr(-15,-54,30,44,3,p.k==='a50'?AZUL[0]:VERDE[0],2.5);ell(0,-32,7,8,'#fffdf2',0);ctx.restore();});
        if(got.length)ell(391,562,9,7,TU.skin,3);}
      /* el billete bueno vuela al fajo */
      for(const p of Q)if(p.st==='ok'){const v=clamp((g.t-p.tx)/FLY,0,1);if(v<1)billete(p.k,400,lerp(376,540,ease(v)),-.3*v,lerp(1,.12,v));}
      /* ¡CHIMBO! / ¡SE COLEÓ!: el chofer se asoma con los ojos inyectados */
      if(lose&&kind!=='bueno'){const u=ease(clamp((e-.14)/.2,0,1)),dx=lerp(1060,596,u),dy=300,ds=1.5,dr=-.09+Math.sin(now*31)*.025;
        if(kind==='chimbo'){const v=ease(clamp(e/.3,0,1));billete(b.k,lerp(400,226,v),lerp(376,408,v),-.08*v+Math.sin(now*36)*.02*Math.max(0,1-e),lerp(1,.76,v),clamp((e-.6)/.5,0,1));}
        if(e>.14){chofer({x:dx,y:dy,s:ds,rot:dr,flip:true,glasses:null,mood:'yell',talk:.5+.5*Math.sin(now*22),vein:1,teeth:1,sweat:2,legs:['#2b2b3a','#14101c',80],
            arms:[{side:-1,a:-2.35+Math.sin(now*24)*.22,len:84,w:24},{side:1,a:1.25,len:86,w:24,hand:(hx,hy)=>limb(hx,hy,hx+26,hy+10,10,CH.skin,3)}]});
          ojos(dx,dy,ds,dr,-1);}
        if(e>.32)bubble(300,128,kind==='lento'?'¡SE TE COLEÓ, DORMIDO!':TIPOS[b.k].grito,22,dx-70,dy-ds*34);}
      if(lose&&kind==='bueno'&&e>.25)bubble(400,121,'¡ESE BILLETE ESTÁ BUENO!',22,440,176);
      /* ¡COBRADO!: el fajo abierto en abanico y el chofer te da el visto bueno */
      if(win){const u=ease(clamp(e/.28,0,1)),by=lerp(770,522,u),m=7;
        rr(362,by+26,76,170,24,TU.shirt,4.5);
        for(let i=0;i<m;i++){const c=i%3===1?AZUL:VERDE;ctx.save();ctx.translate(400,by);ctx.rotate((i/(m-1)*2-1)*(.95+Math.sin(now*7)*.04)*u);
          rr(-34,-178,68,150,6,c[0],4);rr(-26,-170,52,100,4,c[1],2.5);ell(0,-120,15,17,'#fffdf2',2.5);ctx.restore();}
        ell(400,by+4,46,36,TU.skin,4.5);for(let i=0;i<4;i++)rr(367+i*17,by-22,15,34,7,TU.skin,3);tag(306,by+10);
        if(e>.45)bubble(330,126,'¡ESE ES MI COLECTOR!',24,wdx-52,238);}
      ctx.restore();
      drawP();
    }};
  return g;
}
BUS.add('revisa',{name:'¡REVISA!',mk:mkRevisa,card:'EL BILLETE',num:'18'});
})();
