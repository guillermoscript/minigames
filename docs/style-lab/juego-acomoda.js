'use strict';
/* MiniCaos · laboratorio de estilos: ¡ACOMODA! (las sillas).
   Son las 3:00 AM en la rumba, la miniteca «La Bulla Total» sigue a todo volumen y el carajito ya no da más: cabecea parado.
   Hay que armarle la cama de toda la vida con CUATRO arrastres: las dos sillas plásticas blancas (ya vienen frente a frente,
   cada una en su lado y no se pueden cruzar), la chaqueta de blue jean encima como colchón y el niño acostado sobre las dos.
   Lo único fino es la RANURA entre los asientos: no hay imán. Cada silla llega hasta el centro y no más (hay que mover las dos)
   y, si la sueltas montada sobre la otra, el plástico REBOTA y la deja tan lejos como se montó (x1, x1,25 y x1,5 por nivel).
   El borde del asiento avisa: verde = pegaditas, rojo = ranura, naranja = montada (va a rebotar).
   La chaqueta y el niño solo se quedan en la cama si las sillas están cerca (130 px o menos); si no, vuelven a su sitio y no
   pasa nada. Soltar al niño en la cama DECIDE: sillas pegaditas + chaqueta = gana. Con ranura (con o sin chaqueta) se cuela.
   Sin chaqueta: derrota suave, el plástico está duro y se le espanta el sueño. Si se acaba el reloj: berrinche.
   El guion pedía 3 segundos; cuatro arrastres no caben: nivel 1 = 6 s y ranura de hasta 30 px; nivel 2 = 5,4 s y 22 px;
   nivel 3 = 5 s y 15 px, y el tío que baila con los ojos cerrados sale del fondo y de un caderazo te corre la silla de la
   derecha una vez (avisa con «¡UEPA!» medio segundo antes): hay que volver a arrimarla. El reloj no depende de SP.
   Ganas: cae rendido con la luz de la miniteca en plena cara y le ponen una servilleta en los ojos; la rumba sigue.
   (1 de cada 8 victorias, la gallina DJ deja el plato y se le echa a dormir encima.)
   Pierdes (ranura): las sillas se abren, se cuela y cae sentado en el piso con la chaqueta de sombrero; se raya el disco y el
   abuelo, que dormía pegado a la corneta, se despierta porque se apagó la música. Pierdes (sin chaqueta): abre los ojos y se
   sienta a bailar. Pierdes (reloj): llora más duro que la miniteca y los que bailan se tapan los oídos (el abuelo ni se entera).
   Teclado (camino corto): ESPACIO hace el paso que toca. 1) arrima la silla izquierda sola; 2) la derecha empieza a
   deslizarse; 3) ¡FRÉNALA! (ese es el pulso: si la frenas con ranura, así se queda; si no la frenas, choca y rebota);
   4) la chaqueta; 5) el niño. Machacar ESPACIO la frena lejos y el niño se cuela.
   La cumbia es ORIGINAL (La menor, bajo en tumbao, guacharaca de ruido y un teclado propio): no es ninguna canción real.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.acomoda)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI;
/* FY: piso de las sillas · SY: tope del asiento · OV: cuánto se deja montar una silla en la mano · FAR: "cerca" para chaqueta y niño · BD: el caderazo */
const FY=540,SY=FY-80,KS=.7,OV=40,FAR=130,BD=76,KH=[60,470],JH=[741,482],STEP=.15;
const PARED='#4a3a78',PARED2='#6a4a8a',PISO='#c9774a',PISO2='#a85e38',SILLA='#f4f1ea',JEAN='#4a78b8',JEAN2='#8fb4e8',HILO='#ffd27a',LUZ=['#ff5ca8','#5cff7a','#ffe14d','#3fb0ff'];
const KID={skin:'#f0b995',shirt:'#ffd23f',pat:'hoodie',hw:46,hh:46,hr:40,bw:40,th:110,hair:'curly',hairCol:'#3a2a20',eyeS:19,eyeR:11,nose:'button',cheeks:1,brow:'thin'};
const ABU={skin:'#c98a5a',shirt:'#8fd3c8',hair:'bald',hairCol:'#d8d8e0',stache:1,brow:'thick',glasses:'round',wrinkles:1,bw:52,th:110};
const LIMP=[{side:-1,a:-.12,len:52,w:17},{side:1,a:.12,len:52,w:17}],UP=w=>[{side:-1,a:-2.6+w,len:50,w:17},{side:1,a:2.6+w,len:50,w:17}];
const pop=(s,x,y,col,r=8,life=.8)=>PT.push({x,y,vx:0,vy:-60,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
/* la cumbia (original): 32 pasos, un acorde cada 8 (La m, Mi, Re m, Mi) */
const RAIZ=[110,82.41,73.42,82.41],TER=[1.189,1.26,1.189,1.26],
  MEL=[659,0,880,0,1047,988,880,0,831,0,988,0,659,0,0,659,587,0,698,0,880,831,698,0,659,0,831,988,880,0,0,0];
function cumbia(i,v){const n=i%32,c=n>>3,r=RAIZ[c],q=n%8;
  if(q===0||q===4)snd(r,.2,'sawtooth',v*2.4);else if(q===3||q===7)snd(r*1.5,.13,'sawtooth',v*1.7);
  nz(q%2?.03:.06,q%2?v*.7:v*1.2);
  if(q===2||q===6){snd(r*4*TER[c],.09,'square',v*.6);snd(r*6,.09,'square',v*.5);}
  if(MEL[n])snd(MEL[n],.15,'square',v);}

/* silla plástica de perfil. (x, FY) = el borde de adelante del asiento, a ras del piso; d=1 mira a la derecha, d=-1 a la izquierda */
function silla(x,d,lip,up){ctx.save();ctx.translate(x,FY-up);ctx.scale(d,1);
  limb(-88,-70,-100,-3,11,SILLA,3.5);limb(-12,-70,-5,-3,11,SILLA,3.5);
  limb(-93,-74,-113,-166,14,SILLA,4);limb(-106,-118,-26,-118,9,SILLA,3.5);limb(-26,-118,-19,-80,9,SILLA,3.5);
  rr(-98,-80,98,16,7,SILLA,4);if(lip!==SILLA)rr(-14,-80,14,16,6,lip,3);
  ctx.restore();}
/* la chaqueta de blue jean, doblada */
function chaqueta(x,y,rot=0,s=1){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
  for(const sg of[-1,1])limb(sg*34,-10,sg*46,16,15,JEAN,3.5);
  rr(-38,-22,76,44,9,JEAN,4);poly([[-16,-22],[0,-6],[16,-22]],JEAN2,3);line([[0,-6],[0,22]],2.5,HILO);
  for(const sg of[-1,1]){rr(sg*20-10,-2,20,15,3,JEAN2,2.5);ell(sg*20,2,2.5,2.5,HILO,0);}
  ctx.restore();}
/* ...y tendida de colchón sobre los dos asientos: se hunde donde haya ranura */
function colchon(m,sag){const p=[];for(let i=0;i<=10;i++){const u=i/10;p.push([m-86+172*u,SY-6+Math.pow(Math.sin(u*PI),4)*sag]);}
  limb(m+82,SY-2,m+93,SY+28,13,JEAN,3.5);ell(m+94,SY+33,8,5,JEAN2,2.5);
  line(p,20,INK);line(p,14,JEAN);line(p.map(q=>[q[0],q[1]-3]),2,HILO);}
/* tu mano, con la manga saliendo hacia abajo */
function mano(x,y){limb(x+18,y+20,x+58,y+84,24,TU.shirt,4);hand(x,y,-.25,1.35,TU.skin);}
const nino=(x,y,o)=>bust(Object.assign({},KID,{x,y,s:KS,legs:['#3b5bb0','#ffffff',30]},o));

/* ═════════ ¡ACOMODA!: dos sillas, una chaqueta y un carajito rendido ═════════ */
function mkAcomoda(){
  const lv=LV(),rs=Math.sqrt(SP),n=lv-1,TOL=[30,22,15][n],BK=[1,1.25,1.5][n],VK=[190,215,240][n],tB=lv>=3?(1.5+Math.random()*.6)/rs:0,rare=Math.random()<.125;
  const L={x:240,tx:null,d:1,lo:150,hi:470,set:false},R={x:566,tx:null,d:-1,lo:330,hi:650,set:false},DAN=[[250,FACES[5]],[400,FACES[8]],[548,FACES[4]]];
  let drag=null,px=0,py=0,sw=0,kx=KH[0],ky=KH[1],k0=[0,0,0],jk='home',jkT=9,j0=JH,used=false,slide=null,bumped=false,cue=false,hip=0,scr=0,mt=0,mi=0,music=true,ev=0,zT=.5,aT=.4,jolt=0;
  const fin=c=>c.tx==null?c.x:c.tx,gap=()=>fin(R)-fin(L),mid=()=>(L.x+R.x)/2,krot=()=>clamp(-sw,-.5,.5);
  const onBed=p=>gap()<=FAR&&p.x>L.x-84&&p.x<R.x+84&&p.y>SY-150&&p.y<SY+70;
  /* soltar una silla: si quedó montada sobre la otra, rebota y la deja a (lo montado x BK) de distancia */
  function suelta(c){const o=L.x-R.x,mx=(fin(L)+fin(R))/2;c.set=true;
    if(o>0){c.tx=clamp(c.x-c.d*o*(1+BK),c.lo,c.hi);sfx.boing();pop('¡BOING!',mx,SY-116,'#ff8a3d',4);}
    const gp=gap();
    if(gp<=TOL){snd(1320,.07,'square',.06);nz(.04,.12);pop('¡PEGADITAS!',mx,SY-146,'#5cff7a',6);}
    else if(gp<=FAR&&o<=0){snd(240,.07,'square',.04);say('¡MÁS PEGADITAS!',mx,SY-130,'#ffffff');}
    else snd(240,.06,'square',.04);}
  function pone(from){jk='bed';jkT=0;j0=from;sfx.whoosh();snd(170,.12,'sine',.14,-50);}
  /* el niño toca la cama: aquí se decide todo */
  function acuesta(){k0=[kx,ky,krot()];drag=null;slide=null;
    if(gap()>TOL){g.result='lose';g.kind='ranura';g.why='¡SE COLÓ!';sfx.whoosh();}
    else if(jk!=='bed'){g.result='lose';g.kind='dura';g.why='¡ESTÁ DURA!';jolt=.6;snd(520,.07,'square',.08);nz(.06,.2);sfx.lose();}
    else{g.result='win';g.why='¡RENDIDO!';sfx.win();snd(150,.14,'sine',.2,-50);nz(.08,.06);spawn(mid(),SY-70,22,'conf',CONF);}}
  /* nivel 3: el caderazo del tío corre la silla derecha */
  function bump(){bumped=true;hip=1;jolt=.5;const nx=Math.min(R.hi,fin(R)+BD);
    if(drag&&drag.c===R){drag.dx-=nx-R.x;R.x=nx;}else if(slide===R)R.x=nx;else{R.tx=nx;R.set=false;}
    sfx.thud();snd(320,.2,'sawtooth',.05,-160);pop('¡EPA!',nx+30,SY-150,'#ff9ec7',8);spawn(nx+50,FY-8,6,'bit',['#e8c9a8'],170,300,.5);}
  const g={get impact(){return jolt;},
    probe:()=>({L:{x:L.x,gx:L.x-55,gy:SY-40,set:L.set},R:{x:R.x,gx:R.x+55,gy:SY-40,set:R.set},gap:gap(),gapv:R.x-L.x,tol:TOL,far:FAR,bk:BK,ov:OV,
      jk,jh:{x:JH[0],y:JH[1]},kid:{x:kx,y:ky-8},bed:{x:mid(),y:SY-46},tB,bumped,slide:!!slide,rare,kind:g.kind}),
    t:0,dur:[6,5.4,5][n],result:null,why:'',kind:'',endT:0,cmd:'¡ACOMODA!',
    hint:'ARRASTRA: sillas pegaditas, chaqueta y niño encima (ESPACIO: paso a paso)',
    /* teclado: ESPACIO hace el paso que toca; frenar la silla que se desliza es el único pulso */
    press(){if(g.result||drag)return;used=true;
      if(slide){const c=slide;slide=null;suelta(c);return;}
      if(!L.set&&!R.set){L.set=true;L.tx=392;snd(300,.08,'square',.04,120);return;}
      const c=!R.set?R:!L.set?L:gap()>FAR?R:null;
      if(c){slide=c;c.tx=null;snd(300,.08,'square',.04,120);return;}
      if(jk!=='bed'){pone(JH);return;}
      acuesta();},
    down(p){if(g.result||drag)return;px=p.x;py=p.y;sw=0;
      if(Math.hypot(p.x-kx,p.y-(ky-8))<58)drag={k:'kid'};
      else if(jk==='home'&&Math.hypot(p.x-JH[0],p.y-JH[1])<56)drag={k:'jk'};
      else{let best=null,bd=1e9;
        for(const c of[L,R]){const xx=(p.x-c.x)*c.d,dd=Math.abs(xx+55);if(xx>-124&&xx<14&&p.y>SY-104&&p.y<FY+12&&dd<bd){bd=dd;best=c;}}
        if(!best)return;if(slide===best)slide=null;best.tx=null;drag={k:'ch',c:best,dx:p.x-best.x};}
      used=true;snd(660,.05,'square',.04,200);g.move(p);},
    move(p){if(!drag||g.result)return;sw+=(p.x-px)*.012;px=p.x;py=p.y;
      if(drag.k==='ch'){const c=drag.c;let nx=clamp(p.x-drag.dx,c.lo,c.hi);nx=c===L?Math.min(nx,R.x+OV):Math.max(nx,L.x-OV);
        if((scr+=Math.abs(nx-c.x))>30){scr=0;nz(.03,.05);snd(150+Math.random()*60,.04,'sawtooth',.02);}c.x=nx;}
      else if(drag.k==='kid'){kx=clamp(p.x,34,766);ky=clamp(p.y-10,150,FY-40);}},
    up(p){const d=drag;if(!d||g.result)return;if(p)g.move(p);drag=null;
      if(d.k==='ch'){suelta(d.c);return;}
      if(onBed({x:px,y:py})){if(d.k==='jk')pone([px,py]);else acuesta();return;}
      sfx.whoosh();if(d.k==='jk'){jkT=0;j0=[px,py];}
      if(gap()>FAR&&py>SY-170&&px>140&&px<680)say('¡JUNTA LAS SILLAS!',clamp(px,160,640),SY-130,'#ffffff');},
    update(dt){g.t+=dt;jolt=Math.max(0,jolt-dt*3);hip=Math.max(0,hip-dt*2.5);sw*=Math.exp(-7*dt);jkT+=dt;
      if(music){mt+=dt;while(mt>=mi*STEP)cumbia(mi++,g.result==='win'?.03:.016);}
      for(const c of[L,R])if(c.tx!=null){c.x=lerp(c.x,c.tx,Math.min(1,dt*18));if(Math.abs(c.x-c.tx)<.6){c.x=c.tx;c.tx=null;}}
      if(!(drag&&drag.k==='kid')&&(!g.result||g.kind==='time')){const u=Math.min(1,dt*11);kx=lerp(kx,KH[0],u);ky=lerp(ky,KH[1],u);}
      if((aT-=dt)<=0&&!(g.kind==='ranura'&&g.endT>.8)){aT=.9;PT.push({x:114,y:238,vx:16,vy:-34,g:0,t:0,life:1.2,kind:'Z',col:'#ffffff',r:-5,rot:0,vr:0});}
      if(!g.result){
        if(slide){const c=slide;c.x=clamp(c.x+c.d*VK*dt,c.lo,c.hi);if((scr+=VK*dt)>30){scr=0;nz(.03,.05);}
          if(L.x-R.x>=OV||c.x===(c.d>0?c.hi:c.lo)){slide=null;suelta(c);}}
        if(tB&&!cue&&g.t>=tB-.5){cue=true;say('¡UEPA!',400,198,'#ffe14d');snd(880,.12,'square',.05,400);}
        if(tB&&!bumped&&g.t>=tB)bump();
        if(jk==='bed'&&gap()>FAR){jk='home';jkT=0;j0=[mid(),SY-10];sfx.whoosh();}
        if(g.t>=g.dur){drag=null;slide=null;g.result='lose';g.kind='time';g.why='¡BERRINCHE!';jolt=1;zT=.2;sfx.lose();snd(700,.6,'sawtooth',.09,500);}
        return;}
      g.endT+=dt;const e=g.endT,kd=g.kind,m=mid();
      if(g.result==='win'){
        if(ev<1&&e>=.3){ev=1;sfx.whoosh();}
        if(ev<2&&e>=1){ev=2;sfx.ding();nz(.06,.05);}
        if(rare&&ev<3&&e>=1.4){ev=3;sfx.cluck();}
        if(e>1.05&&(zT-=dt)<=0){zT=.5;snd(95,.4,'sawtooth',.05,40);pop('Z',m-36,SY-90,'#ffffff',2,1);}}
      else if(kd==='ranura'){
        if(ev<1&&e>=.04){ev=1;const d=Math.max(0,(80-(R.x-L.x))/2);L.tx=L.x-d;R.tx=R.x+d;snd(700,.2,'sawtooth',.04,500);}
        if(ev<2&&e>=.42){ev=2;music=false;jolt=1;sfx.thud();sfx.crash();sfx.screech();sfx.lose();spawn(m,FY-30,10,'★',['#ffe14d'],240,500,.8);spawn(700,150,8,'feather',['#f1ece2'],220,300,.9);}
        if(ev<3&&e>=.85){ev=3;sfx.cluck();snd(880,.5,'sawtooth',.07,-300);}
        if(e>.9&&(zT-=dt)<=0){zT=.3;for(const sg of[-1,1])spawn(m+sg*40,FY-104,1,'bit',['#9fe3ff'],160,500,.6);}}
      else if(kd==='dura'){
        if(ev<1&&e>=.45){ev=1;sfx.ding();}
        if(ev<2&&e>=.75){ev=2;sfx.boing();}
        if(ev<3&&e>=1.15){ev=3;sfx.cluck();say('¡EEESO!',250,196,'#ffe14d');}}
      else if((zT-=dt)<=0){zT=.3;snd(900+Math.random()*200,.28,'sawtooth',.06,-250);for(const sg of[-1,1])spawn(kx+sg*40,ky-56,1,'bit',['#9fe3ff'],160,500,.6);}},
    draw(){
      const win=g.result==='win',e=g.endT,kd=g.kind,k=clamp(g.t/g.dur,0,1),gp=R.x-L.x,m=(L.x+R.x)/2;
      const fall=kd==='ranura',dura=kd==='dura',cry=kd==='time',hush=fall&&e>=.42,bp=mt/STEP,pul=music?Math.max(0,1-(bp%2)):0;
      /* el patio: pared, piso de terracota y las luces de la miniteca barriendo */
      rr(gameLeft(),0,GAME_VIEW.width,12,0,PARED,0);wash(gameLeft(),6,GAME_VIEW.width,346,PARED,PARED2);
      rr(gameLeft(),350,GAME_VIEW.width,250,0,PISO,0);line([[gameLeft(),350],[gameRight(),350]],4,INK);
      for(let i=0;i<10;i++)line([[i*96-20,350],[i*150-290,600]],2,PISO2);for(const y of[396,474])line([[gameLeft(),y],[gameRight(),y]],2,PISO2);
      rr(gameLeft(),574,GAME_VIEW.width,26,0,'#fff3dc',0);line([[gameLeft(),574],[gameRight(),574]],3.5,INK);
      if(music){ctx.save();ctx.globalAlpha=.15;for(let i=0;i<2;i++){const bx=400+Math.sin(now*1.6+i*2.6)*310;poly([[393,146],[407,146],[bx+64,350],[bx-64,350]],LUZ[(i*2+Math.floor(bp/4))%4],0);}ctx.restore();}
      rr(160,94,480,28,6,'#ffd23f',3.5);txt('MINITECA «LA BULLA TOTAL» · PURO ÉXITO VIEJO',400,109,13,INK,0,true);
      rr(20,96,122,44,8,'#14101c',3.5);txt('3:00 AM',81,119,22,'#ff4d5e',0,true);
      const wire=[];for(let i=0;i<=14;i++)wire.push([i*58-6,158+(i%2)*9]);line(wire,2,INK);
      for(let i=0;i<=14;i++)ell(i*58-6,164+(i%2)*9,6,7,LUZ[(i+Math.floor(bp/2))%4],2.5);
      line([[400,122],[400,131]],3,'#c9ced6');ell(400,146,15,15,'#c9ced6',3.5);for(let i=0;i<3;i++)rr(390+i*7,139+(i%2)*7,5,5,1,'#ffffff',0);
      /* la corneta, con la gallina de siempre de DJ */
      rr(650,186,140,166,10,'#14101c',4);ell(720,298,40+pul*4,40+pul*4,'#3b3550',4);ell(720,298,15,15,'#8f8fa8',3);ell(720,218,18+pul*2,18+pul*2,'#3b3550',3.5);ell(720,218,6,6,'#8f8fa8',0);
      rr(662,174,116,14,4,'#8f8fa8',3.5);ell(744,172,22,7,'#14101c',2.5);ell(744,172,5,2,'#ff3b4e',0);
      const hj=hush?Math.abs(Math.sin((e-.42)*7))*Math.exp(-(e-.42)*2.5)*46:music?Math.abs(Math.sin(bp*PI/2))*5:0;
      const hf=win&&rare?ease(clamp((e-1.05)/.4,0,1)):0,gallina=(x,y)=>{ctx.save();ctx.translate(x,y);ctx.scale(-1,1);hen(0,0,.62,1);ctx.restore();};
      if(!hf)gallina(700,154-hj);
      /* el abuelo: dormido pegado a la corneta; solo lo despierta el silencio */
      const awake=hush&&e>=.8;
      rr(50,266,80,92,12,SILLA,3.5);
      bust(Object.assign({},ABU,{x:90,y:300,s:.5,legs:['#6a5a4a','#3b2a22',34],mood:awake?'yell':'sleep',talk:awake?.5+.5*Math.sin(now*14):0,rot:awake?Math.sin(now*30)*.03:-.12+Math.sin(now*1.6)*.03,
        arms:awake?[{side:-1,a:-2.5,len:60,w:19},{side:1,a:2.5,len:60,w:19}]:[{side:-1,a:.5,len:50,w:19},{side:1,a:-.5,len:50,w:19}]}));
      /* los que bailan; en el nivel 3 el del medio se viene para adelante */
      const fw=tB?ease(clamp((g.t-tB+.5)/.4,0,1))*(1-ease(clamp((g.t-tB-.35)/.5,0,1))):0;
      for(const i of[0,2,1]){const d=DAN[i],b=music?Math.sin(bp*PI/2+i*2.1):0,tio=i===1;let x=d[0],y=272,s=.52;
        if(tio&&fw>0){x=lerp(x,clamp(m-14,290,520),fw)+hip*26;y=lerp(y,352,fw);s=lerp(s,.74,fw);}
        const o={x,y:y-Math.abs(b)*6,s,th:110,bw:50,legs:['#3b3550','#ffffff',56],vein:0,sweat:0,rot:b*.09+(tio?hip*.3:0),mood:tio?'happy':i?'grin':'smile',
          arms:[{side:-1,a:-2.2+b*.5,len:60,w:19},{side:1,a:2.2+b*.5,len:60,w:19}]};
        if(hush)Object.assign(o,{y,rot:0,mood:e<1?'o':'worry',look:x<m?1:-1,arms:[{side:-1,a:-.15,len:64,w:19},{side:1,a:.15,len:64,w:19}]});
        else if(cry)Object.assign(o,{mood:'panic',sweat:1,rot:Math.sin(now*38+i)*.03,arms:[{side:-1,a:-2.75,len:50,w:19},{side:1,a:2.75,len:50,w:19}]});
        bust(Object.assign({},d[1],o));}
      /* la cava, con la chaqueta encima */
      rr(698,506,86,58,10,'#e8553d',4);rr(692,498,98,15,6,'#fffdf2',3.5);rr(731,528,20,7,3,'#fffdf2',0);
      const ju=ease(clamp(jkT/.16,0,1));
      if(jk==='home'&&!(drag&&drag.k==='jk'))chaqueta(lerp(j0[0],JH[0],ju),lerp(j0[1],JH[1],ju),(1-ju)*.5);
      /* las sillas */
      const lip=g.result?SILLA:gp<-2?'#ff8a3d':gp<=TOL?'#5cff7a':gp<=FAR?'#ff4d5e':SILLA;
      for(const c of[L,R]){ctx.save();ctx.globalAlpha=.22;ell(c.x-c.d*52,FY+3,66,8,INK,0);ctx.restore();silla(c.x,c.d,lip,drag&&drag.c===c?5:0);}
      const lieX=m-10,lieY=SY-32-(jk==='bed'?9:0),hx=lieX+HY*KS,sitF=fall&&e>=.42;
      if(jk==='bed'&&!sitF){if(ju<1)chaqueta(lerp(j0[0],m,ju),lerp(j0[1],SY-12,ju)-Math.sin(ju*PI)*40,(1-ju)*.5);else colchon(m,g.result?(fall?20+e*150:0):clamp((gp-8)*.55,0,70));}
      /* el carajito */
      if(!g.result){
        if(drag&&drag.k==='kid'){nino(kx,ky,{rot:krot()+Math.sin(now*7)*.05,mood:k>.8?'worry':'sleep',sweat:k>.8?1:0,arms:LIMP});mano(kx,ky+16);}
        else{const c=(g.t*1.05+.2)%1,late=k>.55,crit=k>.8;
          nino(kx,ky,{rot:late?Math.sin(now*34)*(crit?.04:.02):.3*c*c,mood:crit?'panic':late?'worry':c<.14?'o':'sleep',sweat:crit?2:late?1:0,arms:crit?UP(Math.sin(now*22)*.2):LIMP});}}
      else if(cry)nino(kx,ky,{rot:Math.sin(now*40)*.03,mood:'yell',talk:.5+.5*Math.sin(now*16),sweat:2,arms:UP(Math.sin(now*20)*.3)});
      else{const u=ease(clamp(e/.12,0,1));let x=lerp(k0[0],lieX,u),y=lerp(k0[1],lieY,u),rot=lerp(k0[2],-PI/2,u);const o={mood:'sleep',arms:LIMP};
        if(win)o.mood=e<.3?'smile':'sleep';
        else if(fall){const v=ease(clamp((e-.15)/.27,0,1));x=lerp(x,m,v);y=lerp(y,FY-49,v*v);rot*=1-v;o.mood=e<.42?'o':e<.85?'dizzy':'yell';
          if(sitF)Object.assign(o,{legs:null,th:80,talk:e<.85?0:.5+.5*Math.sin(now*16),arms:e<.85?LIMP:UP(Math.sin(now*20)*.3)});}
        else{const v=ease(clamp((e-.75)/.2,0,1)),hop=v*Math.abs(Math.sin((e-.95)*9))*12;x=lerp(x,m,v);y=lerp(y,SY-49,v)-hop;rot*=1-v;o.mood=e<.45?'sleep':e<.75?'o':'grin';
          if(v>.5)Object.assign(o,{legs:null,th:80,arms:UP(Math.sin(now*14)*.5)});}
        nino(x,y,Object.assign(o,{rot}));
        if(sitF&&jk==='bed')chaqueta(m+4,FY-130,.14,.9);}
      /* ganaste: la luz de la miniteca en plena cara y la servilleta en los ojos */
      if(win&&e>.3){const lu=ease(clamp((e-.3)/.25,0,1)),tx=lerp(560,hx,lu),col=LUZ[Math.floor(now*5)%4],nu=clamp((e-.62)/.38,0,1);
        ctx.save();ctx.globalAlpha=.3;poly([[393,150],[407,150],[tx+40,lieY+34],[tx-40,lieY-34]],col,0);ell(tx,lieY,46,40,col,0);ctx.restore();
        if(nu>0){ctx.save();
          if(nu<1){ctx.translate(lerp(m+70,hx,nu)+Math.sin(e*16)*22*(1-nu),lerp(SY-190,lieY,nu*nu));ctx.rotate(Math.sin(e*13)*.5);rr(-22,-12,44,24,3,'#ffffff',3);}
          else{ctx.translate(lieX,lieY);ctx.rotate(-PI/2+Math.sin(e*4)*.03);ctx.scale(KS,KS);rr(-38,HY-31,76,42,4,'#ffffff',3);line([[-38,HY-12],[38,HY-12]],2,'#d9dce6');}
          ctx.restore();}}
      if(hf)gallina(lerp(700,m+34,hf),lerp(154,lieY-36,hf)-Math.sin(hf*PI)*70);
      /* pistas: flechas a las sillas, y después el aro en lo que toca */
      if(!g.result){
        if(drag&&drag.k==='jk')chaqueta(px,py,Math.sin(now*14)*.1,1.1);
        if(drag&&drag.k!=='kid')mano(px,py);
        if(slide&&Math.sin(now*22)>-.4)txt('¡FRÉNALA!',m,SY-136,32,'#ffe14d',-.05);
        if(!drag&&!slide){const z=1+Math.sin(now*9)*.08;
          if(gp>FAR){for(const c of[L,R])if(!c.set)for(let i=0;i<3;i++)txt(c.d>0?'▶':'◀',c.x+c.d*(24+i*30+(now*50)%30),SY+8,22,'#ffe14d');}
          else if(gp>TOL){txt('▶',L.x+18,SY+44,24,'#ff4d5e');txt('◀',R.x-18,SY+44,24,'#ff4d5e');}
          else{const q=jk==='bed'?[kx+4,ky-14,58]:[JH[0],JH[1],50];if(jkT>.2)line(closeP(ellP(q[0],q[1],q[2]*z,q[2]*z,22)),5,'#ffe14d');}}
        if(!used){const ax=L.x-58,ay=SY-108+Math.sin(now*5)*6;mano(ax,ay);tag(ax+2,ay-46);}}
      /* lo que se dice (fuera de la franja del sello) */
      if(win&&e>.62)bubble(360,190,"PA' QUE LA LUZ NO LO MOLESTE",17,264,216);
      if(hush&&e>=.85)txt('¡BUAAA!',m+Math.sin(now*50)*3,FY+22,32,'#ff4d5e',-.05);
      if(awake)bubble(196,226,'¡¿Y LA MÚSICA?!',19,110,256);
      if(dura&&e>1)bubble(m<400?m+196:m-196,SY-66,'¡YA NO TENGO SUEÑO!',18,m+(m<400?40:-40),SY-78);
      if(cry){txt('¡BUAAAA!',186+Math.sin(now*50)*3,430,34,'#ff4d5e',-.08);if(e>.3)bubble(430,190,'¡ACUESTEN A ESE MUCHACHO!',17,268,216);}
      drawP();
    }};
  return g;
}
BUS.add('acomoda',{name:'¡ACOMODA!',mk:mkAcomoda,card:'LAS SILLAS',num:'74'});
})();
