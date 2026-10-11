'use strict';
/* MiniCaos · laboratorio de estilos: ¡PENDRIVE! (cambia la música).
   Primer plano del tablero: el reproductor está pegado en una cuña de colchones y el chofer te manda a cambiar el pendrive.
   El pendrive es un chigüire de goma de 2GB con el enchufe USB saliéndole de la cabeza. Lo agarras por abajo y, con la
   vibración del diésel, se bambolea como un metrónomo: hay que ARRASTRARLO hasta debajo del puerto (que también tiembla)
   y SOLTARLO justo cuando el enchufe pasa derecho. Soltarlo en el puerto con el enchufe torcido = ¡AL REVÉS! (chispas,
   la cuña más duro y el chofer te mira feo). Soltarlo lejos del puerto solo te lo devuelve a la mano.
   Nivel 1: vaivén lento y ventana ancha. Niveles 2 y 3: vaivén más rápido e irregular, ventana más angosta, el puerto tiembla más.
   Nivel 3, además, el chiste de todo USB: la PRIMERA vez que lo metes derechito rebota («¡AL REVÉS!», sin perder). Hay que VOLTEARLO
   (un toque corto sobre el muñeco, o FLECHA ARRIBA) y meterlo otra vez; del lado que rebotó no entra nunca. De frente se le ve la cara,
   el 2GB y los dos huequitos del enchufe; de espaldas, el lomo, el rabito y el tridente del USB. El reloj da 7 s en vez de 5.
   Meterlo torcido sigue siendo perder (en el nivel 3 el sello dice ¡TORCIDO! para no confundirlo con el rebote).
   Teclado: ESPACIO lo acerca al puerto y otro ESPACIO lo empuja con el ángulo que tenga.
   La salsa del final es ORIGINAL (clave 3-2, montuno propio sobre Do-Fa-Sol-Fa, campana): no es ninguna canción real.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.pendrive)return;
const LV=BUS.LV,CONF=BUS.CONF,TU=BUS.TU,tag=BUS.tag,PI=Math.PI,LL=110,S=1.3,L=LL*S;/* L: del pellizco (abajo) a la punta del enchufe; el muñeco se dibuja en unidades propias (LL) a escala S */
const CH={skin:'#c98a5a',shirt:'#fffdf2',pat:'tank',cap:'#ffd23f',hairCol:'#14101c',stache:1,brow:'thick',cheeks:1,bw:58,hw:44,hh:43};
const pop=(s,x,y,col,r=8,life=.75)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.24,vr:0});
const CUNA='¡LLAME YA!  COLCHONES EL RONQUIDO FELIZ: DUERMA HOY Y PAGUE EN 36 CUOTAS...  ¡LLAME YA AL 0-800-RONQUE!  ¡QUE SE ACABAN!  ',
  GRITOS=['¡LLAME YA!','¡OFERTA!','¡36 CUOTAS!','¡LLAME YA!','¡COLCHONES!'];
/* la cuña: un timbrecito de tres notas que no se calla */
const JING=[784,0,784,0,988,0,784,0,659,659,0,784,0,0,523,0];
/* la salsa (original): 16 corcheas. Acordes Do-Fa-Sol-Fa, clave 3-2, campana en las negras, bajo en tumbao */
const STEP=.136,T0=.22,CHD=[[261.63,329.63,392],[349.23,440,523.25],[392,493.88,587.33],[349.23,440,523.25]],CLAVE=[0,3,6,10,12];
function salsa(i){const n=i%16,c=CHD[n>>2],q=n%4,v=.03,w=1+(Math.random()-.5)*.014;/* w: el lloriqueo del mp3 barato */
  if(q===0){snd(c[0]*w,.16,'square',v);snd(c[0]*2*w,.16,'sawtooth',v);}
  else if(q===2)snd(c[0]*2*w,.12,'square',v);
  else{snd(c[1]*2*w,.12,'square',v*.8);snd(c[2]*2*w,.12,'sawtooth',v*.8);}
  if(n%8===3)snd(c[2]/4*w,.2,'sawtooth',.07);else if(n%8===6)snd(CHD[((n>>2)+1)%4][0]/4*w,.24,'sawtooth',.07);
  if(CLAVE.includes(n)){snd(2350,.035,'square',.05);snd(1180,.03,'sine',.05);}
  if(n%2===0){const cv=n%8?.02:.035;snd(800,.07,'square',cv);snd(540,.07,'square',cv);}
  nz(.05,.03);}

/* el pendrive: un chigüire de goma con el enchufe en la cabeza. (x, y) = por donde lo pellizcas, abajo */
function muneco(x,y,rot,o){const c='#a9713a',d='#7a4f2a',m=o.mood;
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(S*(o.fx==null?1:o.fx),S);
  /* de espaldas (nivel 3): el enchufe muestra el tridente del USB en vez de los huequitos, y el chigüire el lomo y el rabito */
  if(o.back&&!o.bent){rr(-12,-LL,24,36,3,o.good?'#5cff7a':'#c9ced6',3.5);line([[0,-LL+6],[0,-LL+24]],2.5,'#5a5274');line([[0,-LL+18],[-6,-LL+12],[-6,-LL+9]],2.5,'#5a5274');line([[0,-LL+21],[6,-LL+15],[6,-LL+12]],2.5,'#5a5274');ell(0,-LL+25,2.6,2.6,'#5a5274',0);
    for(const sg of[-1,1]){ell(sg*22,-79,8,8,d,3);ell(sg*31,-34,7,11,c,3);}
    rr(-31,-82,62,82,21,c,4.5);line([[0,-74],[0,-30]],3,d);for(let i=0;i<3;i++)for(const sg of[-1,1])line([[sg*4,-64+i*14],[sg*15,-58+i*14]],3,d);
    ell(0,-12,8,7,d,3);if(o.led)ell(18,-8,4.5,4.5,o.led,2);
    ctx.restore();return;}
  if(o.bent)poly([[-12,-76],[-13,-90],[-3,-97],[-17,-106],[5,-112],[15,-99],[7,-91],[12,-76]],'#c9ced6',3.5);
  else{rr(-12,-LL,24,36,3,o.good?'#5cff7a':'#c9ced6',3.5);rr(-8,-LL+8,6,7,0,'#5a5274',0);rr(2,-LL+8,6,7,0,'#5a5274',0);}
  for(const sg of[-1,1]){ell(sg*22,-79,8,8,d,3);ell(sg*31,-34,7,11,c,3);}
  rr(-31,-82,62,82,21,c,4.5);
  rr(-14,-57,28,19,8,d,3);for(const sg of[-1,1])ell(sg*5,-50,2.2,1.8,INK,0);
  for(const sg of[-1,1]){const ex=sg*13,ey=-66;
    if(m==='happy')line(arcPts(ex,ey+3,5,PI*1.1,PI*1.9,5),3.5);
    else if(m==='dizzy'){line([[ex-5,ey-5],[ex+5,ey+5]],3);line([[ex+5,ey-5],[ex-5,ey+5]],3);}
    else if(m==='o'){ell(ex,ey,6,6.5,'#ffffff',2.5);ell(ex,ey,2.2,2.2,INK,0);}
    else ell(ex,ey,4.5,5,INK,0);}
  if(m==='happy')for(const sg of[-1,1])ell(sg*22,-54,6,4,'#ff8aa5',0);
  rr(-20,-34,40,20,6,'#fffdf2',3);txt('2GB',0,-23,13,INK,0,true);
  if(o.led)ell(0,-8,4.5,4.5,o.led,2);
  ctx.restore();}
/* el puerto: (x, y) = la boca, que abre hacia abajo */
function puerto(x,y,good){rr(x-44,y-34,88,34,6,'#c9ced6',4);rr(x-26,y-21,52,21,2,'#14101c',2.5);rr(x-16,y-14,32,5,0,'#fffdf2',0);ell(x+35,y-25,4.5,4.5,good?'#5cff7a':'#ff3b4e',2);}
/* tu mano: la palma va detrás del muñeco; delante solo el pulgar y la punta de un dedo, para no tapar el 2GB */
function palma(x,y){ctx.save();ctx.translate(x,y);ctx.scale(S,S);limb(76,150,22,40,40,TU.shirt,4);ell(10,22,29,23,TU.skin,4);ctx.restore();}
function dedos(x,y){ctx.save();ctx.translate(x,y);ctx.scale(S,S);ell(-24,3,11,16,TU.skin,3.5);ell(27,10,9,12,TU.skin,3);ctx.restore();}
/* texto corrido de la pantalla, de x0 a x1 */
function corre(s,size,col,x0,x1,y,off){const w=tw(s,size);for(let x=x0-(off%w);x<x1;x+=w)txt(s,x+w/2,y,size,col,0,true);}

/* ═════════ ¡PENDRIVE!: mete el chigüire USB derechito en el puerto ═════════ */
function mkPendrive(){
  const rs=Math.sqrt(SP),lv=LV(),n=lv-1,GAG=lv>2,AMP=[.8,.9,.95][n],WS=[3.5,4.6,5.4][n],B=[0,.05,.08][n],TOL=[.34,.27,.22][n],RPOS=[56,46,38][n],J=[2.5,5,8][n];
  const PX=420,MY=388,HOME=[676,540],ph0=Math.random()*TAU,pas=[2,5,6,0].map((fi,i)=>({f:FACES[fi],x:350+i*96}));
  let px=HOME[0],py=HOME[1],held=false,kb=false,used=false,a0=0,x0=0,y0=0,jT=.2,ji=0,si=0,adT=.45,adN=0,scroll=0,mq=0,inZ=false,hit=false,noteT=0,egg=false;
  /* nivel 3: volt = está de espaldas; mal = el lado que ya rebotó (null: todavía no lo has metido); flT anima el volteo; dT/dP: dónde y cuándo bajó el dedo */
  let volt=false,mal=null,reb=0,flT=0,rbT=0,dT=-9,dP=null;
  /* el vaivén: un metrónomo (en los niveles 2 y 3, con un temblor encima) */
  const ang=()=>AMP*Math.sin(WS*g.t+ph0)+B*Math.sin(2.3*WS*g.t+1.3);
  const mouth=()=>g.result==='win'?[PX,MY]:[PX+Math.sin(g.t*41)*J+Math.sin(g.t*17.3)*J*.5,MY+Math.cos(g.t*33)*J*.6];
  const dock=()=>{const m=mouth();return[m[0],m[1]+L+2];};
  const grita=(k,big)=>{adN++;const lado=adN%2;pop(GRITOS[adN%GRITOS.length],lado?236+Math.random()*90:620+Math.random()*120,(big?272:284)+Math.random()*22,lado?'#ffe14d':'#ff4d5e',-6+k*10+(big?8:0),.7);};
  function voltea(){if(g.result)return;volt=!volt;flT=1;used=true;snd(700,.05,'square',.05,volt?500:-300);nz(.03,.1);}
  /* soltar: lejos del puerto vuelve a la mano; en el puerto, entra derecho o no entra */
  function suelta(){const d=dock(),m=mouth(),a=ang(),tx=px+Math.sin(a)*L,ty=py-Math.cos(a)*L;
    held=false;kb=false;
    if(Math.hypot(px-d[0],py-d[1])>RPOS&&Math.hypot(tx-m[0],ty-m[1])>RPOS){sfx.whoosh();return;}
    a0=a;x0=px;y0=py;
    if(Math.abs(a)<TOL&&GAG&&(mal===null||volt===mal)){/* derechito, pero del lado que no es: rebota y vuelve a la mano */
      if(mal===null)mal=volt;reb++;rbT=1.1;sfx.boing();snd(160,.12,'square',.07,-40);spawn(m[0],m[1],6,'★',['#ffe14d','#ffffff'],220,500,.5);pop('¡AL REVÉS!',PX+118,MY+44,'#ffe14d',10,.9);
      g.hint="¡AL REVÉS! TOCA el pendrive (o FLECHA ARRIBA) pa' voltearlo y mételo otra vez";return;}
    if(Math.abs(a)<TOL){g.result='win';g.why='¡SALSA!';nz(.05,.25);snd(1320,.08,'square',.07);snd(180,.1,'sine',.2,-60);pop('¡CLAC!',PX+110,MY+50,'#5cff7a',6);}
    else{g.result='lose';g.kind='rev';g.why=GAG?'¡TORCIDO!':'¡AL REVÉS!';sfx.crash();snd(120,.5,'sawtooth',.1,-50);sfx.lose();
      spawn(m[0],m[1],14,'★',['#ffe14d','#ffffff'],300,600,.7);spawn(m[0],m[1],8,'bit',['#ffd23f','#ff8a3d'],340,700,.6);pop('¡BZZT!',PX+112,MY+50,'#ffe14d',8);}}
  const set=p=>{px=clamp(p.x,30,770);py=clamp(p.y,330,566);};
  const g={get impact(){return this.result?clamp(1-this.endT/.5,0,1):0;},
    probe:()=>{const d=dock(),m=mouth(),a=ang();return{a,tol:TOL,rpos:RPOS,amp:AMP,w:WS,good:Math.abs(a)<TOL,piv:{x:px,y:py},dock:{x:d[0],y:d[1]},mouth:{x:m[0],y:m[1]},home:{x:HOME[0],y:HOME[1]},held,kb,kind:g.kind,lv,volt,mal,reb};},
    t:0,dur:(GAG?7:5)/rs,result:null,why:'',kind:'',endT:0,cmd:'¡EL PENDRIVE!',
    hint:'ARRASTRA al puerto y SUELTA con el enchufe en VERDE (o ESPACIO x2)',
    /* teclado: el primer toque lo acerca al puerto; el segundo lo empuja como esté */
    press(k){if(g.result||held)return;
      if(GAG&&(k==='up'||k==='down')){voltea();return;}
      if(!kb){kb=true;used=true;snd(520,.06,'square',.04,200);return;}
      const d=dock();if(Math.hypot(px-d[0],py-d[1])<RPOS*.6)suelta();},
    down(p){if(g.result)return;if(Math.hypot(p.x-px,p.y-(py-60))<120){held=true;kb=false;used=true;dT=g.t;dP=p;set(p);snd(660,.05,'square',.04,200);}},
    move(p){if(held&&!g.result)set(p);},
    up(p){if(!held||g.result)return;
      /* nivel 3: un toque corto (sin arrastrar) lo voltea en vez de soltarlo */
      if(GAG&&p&&dP&&g.t-dT<.25&&Math.hypot(p.x-dP.x,p.y-dP.y)<18){held=false;voltea();return;}
      if(p)set(p);suelta();},
    update(dt){g.t+=dt;scroll+=dt*120;flT=Math.max(0,flT-dt/.2);rbT=Math.max(0,rbT-dt);
      if(!g.result){const k=clamp(g.t/g.dur,0,1);mq+=dt*150*rs*(1+k*.6);
        if(kb){const d=dock(),u=Math.min(1,dt*12);px=lerp(px,d[0],u);py=lerp(py,d[1],u);}
        else if(!held){const u=Math.min(1,dt*12);px=lerp(px,HOME[0],u);py=lerp(py,HOME[1],u);}
        /* tic del metrónomo cada vez que el enchufe entra a la zona buena */
        const z=Math.abs(ang())<TOL;if(z&&!inZ&&(held||kb))snd(1500,.03,'square',.03);inZ=z;
        if((jT-=dt)<=0){jT=.17/rs;const f=JING[ji++%JING.length];if(f){snd(f,.12,'square',.014+.02*k);snd(f*1.5,.1,'square',.006+.01*k);}}
        if((adT-=dt)<=0){adT=.8-.42*k;grita(k,false);}
        if(g.t>=g.dur){g.result='lose';g.kind='time';g.why='¡PURA CUÑA!';held=false;kb=false;sfx.lose();sfx.thud();}
        return;}
      g.endT+=dt;const e=g.endT;
      if(g.result==='win'){
        /* un tiempito de silencio ("LEYENDO USB...") y arranca la salsa */
        if(!hit&&e>=T0){hit=true;nz(2,.014);spawn(PX,MY-60,26,'conf',CONF);egg=typeof EGGS!=='undefined'&&EGGS.music();}   /* a veces el pendrive trae otra cosa (js/eggs.js) */
        if(hit){while(e>=T0+si*STEP){if(!egg)salsa(si);si++;}
          if((noteT-=dt)<=0){noteT=.2;PT.push({x:240+Math.random()*500,y:276,vx:(Math.random()-.5)*80,vy:-90,g:0,t:0,life:.9,kind:Math.random()<.5?'♪':'♫',col:['#ffffff','#ffe14d','#5cff7a'][si%3],r:6,rot:(Math.random()-.5)*.6,vr:0});}}}
      else{/* la cuña, ahora a todo volumen */
        if((jT-=dt)<=0){jT=.11;const f=JING[ji++%JING.length];if(f){snd(f,.12,'square',.05);snd(f*1.5,.1,'sawtooth',.03);}}
        if((adT-=dt)<=0){adT=.2;grita(1,true);}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',rev=lose&&g.kind==='rev',e=g.endT,k=win?0:lose?1:clamp(g.t/g.dur,0,1),a=ang(),good=!g.result&&Math.abs(a)<TOL,m=mouth(),d=dock();
      const dz=win&&hit,beat=dz?(e-T0)/STEP:0,sw=dz?Math.sin(beat*PI/2):0,hop=dz?Math.abs(Math.cos(beat*PI/2)):0,vib=lose?2.4:win?.4:1+k*1.2;
      /* todo vibra con el diésel (la franja de abajo queda libre para la ayuda) */
      ctx.save();path([[gameLeft(),0],[gameRight(),0],[gameRight(),576],[gameLeft(),576]]);ctx.clip();ctx.translate(Math.sin(now*38)*.7*vib,Math.cos(now*31)*.9*vib);
      /* parabrisas: la calle, la visera y los flecos */
      wash(gameLeft(),0,GAME_VIEW.width,252,'#8fd8ff','#e8f8ff');
      for(let j=0;j<6;j++){const bx=((j*190-scroll)%1140+1140)%1140-170,by=140+(j%3)*20;rr(bx,by,150,130,5,['#ffb36b','#a9a0ff','#ff9ec7','#6ecf8f','#ffd23f','#8aa0ff'][j],3.5);for(let i=0;i<2;i++)rr(bx+18+i*64,by+20,40,26,4,'#ffffff',2.5);}
      rr(gameLeft(),0,GAME_VIEW.width,88,0,'#5a4a78',0);rr(gameLeft(),84,GAME_VIEW.width,10,0,'#c4283a',0);line([[gameLeft(),94],[gameRight(),94]],4,INK);
      for(let i=0;i<8;i++){const x=16+i*36,s=Math.sin(now*9+i)*2.5*vib+sw*6;line([[x,94],[x+s,110]],3,'#c4283a');ell(x+s,115,6,6,i%2?'#ffd23f':'#ff5ca8',2.5);}
      /* el retrovisor: los pasajeros sufriendo (y después bailando) */
      rr(530,84,16,16,3,'#2d2640',3);rr(288,96,496,130,26,'#2d2640',4.5);
      ctx.save();path(rrP(296,104,480,114,20));ctx.clip();wash(296,104,480,114,'#cfe9f5','#eef8fc');
      for(let i=0;i<5;i++)rr(306+i*96,146,88,90,14,'#3fa0ff',3.5);
      pas.forEach((p,i)=>{const st=win?0:lose?3:Math.min(3,Math.floor(k*3.3+i*.3)),bob=dz?Math.sin(beat*PI/2+i*1.3):0,up=dz?Math.abs(Math.cos(beat*PI/2+i*1.3)):0;
        bust(Object.assign({},p.f,{x:p.x+bob*9+(st>=2?Math.sin(now*40+i)*1.5:0),y:202-up*7,s:.64,th:60,bw:50,rot:bob*.12,look:dz?0:-1,
          vein:st>=2?1:0,sweat:st>=3?2:st>=2?1:0,talk:dz?.5+.5*bob:st>=2?Math.abs(Math.sin(now*14+i)):0,
          mood:dz?(i%2?'grin':'happy'):win?'o':st===0?(i?'frown':'sleep'):st===1?(i%2?'angry':'worry'):lose&&!i?'dizzy':st===2||i%2?'yell':'panic',
          arms:dz?[{side:-1,a:-2.3+bob*.5,len:58,w:19},{side:1,a:2.3+bob*.5,len:58,w:19}]:st>=1?[{side:-1,a:-2.85,len:66,w:19},{side:1,a:2.85,len:66,w:19}]:null}));});
      /* la gallina de siempre, con audífonos: ella anda en lo suyo */
      const gy=198-Math.abs(Math.sin(now*5.2))*5-hop*8;hen(718,gy,.8,dz?1:0);
      line(arcPts(750,gy-22,15,PI*1.08,PI*1.92,6),4,'#14101c');ell(748,gy-19,6,8,'#ff3b4e',2.5);
      if(!win){const u=(now*.7)%1;txt('♪',722-u*26,gy-36-u*22,13+u*6,'#5a4a78',0,true);}
      ctx.restore();line(closeP(rrP(296,104,480,114,20)),5,'#c9ced6');line([[318,116],[352,116]],3,'#ffffff');
      /* tablero */
      rr(-6,250,812,340,0,'#3b3550',0);rr(-6,250,812,12,0,'#5a5274',0);line([[-6,250],[806,250]],5,INK);
      /* el reproductor */
      const RX=206,RY=266,RW=572,RH=106,DX=RX+98,DY=RY+40,DW=RW-112,DH=54,KX=RX+50,KY=RY+48;
      ctx.save();if(lose)ctx.translate(Math.sin(now*70)*3,Math.cos(now*57)*2);else if(dz)ctx.translate(0,-hop*3);
      rr(RX,RY,RW,RH,16,'#8f8fa8',4.5);rr(RX+7,RY+7,RW-14,RH-14,10,'#2d2640',3);
      txt('EL ESCÁNDALO 3000',RX+200,RY+23,15,'#ffd23f',0,true);
      for(let i=0;i<6;i++){rr(RX+318+i*40,RY+12,32,22,5,'#5a5274',3);txt(''+(i+1),RX+334+i*40,RY+24,12,'#fffdf2',0,true);}
      const kn=lose?2.3+Math.sin(now*50)*.1:dz?sw*.5:-.9+k*1.6+Math.sin(now*3)*.06;
      ell(KX,KY,33,33,'#c9ced6',4);ell(KX,KY,21,21,'#5a5274',3);line([[KX,KY],[KX+Math.sin(kn)*28,KY-Math.cos(kn)*28]],6,'#ff3b4e');txt('VOL',KX,RY+92,11,'#fffdf2',0,true);
      /* pantalla */
      const fl=lose&&Math.sin(now*26)>0;
      rr(DX,DY,DW,DH,6,fl?'#c4283a':'#14101c',3.5);
      ctx.save();path(rrP(DX+4,DY+4,DW-8,DH-8,3));ctx.clip();
      if(dz){for(let i=0;i<6;i++){const h=8+Math.abs(Math.sin(beat*1.7+i*2.1))*32;rr(DX+12+i*13,DY+DH-8-h,9,h,2,i<4?'#5cff7a':'#ffd23f',0);}
        txt('SALSA BRAVA',DX+214,DY+18,19,'#5cff7a',0,true);txt('♪ PISTA 07.mp3',DX+214,DY+39,14,'#ffb300',0,true);
        rr(DX+DW-122,DY+9,112,DH-18,6,Math.floor(beat)%2?'#5cff7a':'#ffd23f',0);txt('120 kbps',DX+DW-66,DY+DH/2+1,19,INK,0,true);}
      else if(win)txt('LEYENDO USB'+'...'.slice(0,1+Math.floor(e*14)%3),DX+DW/2,DY+DH/2+1,26,'#5cff7a',0,true);
      else if(lose){const z=1+Math.abs(Math.sin(now*13))*.12;ctx.save();ctx.translate(DX+DW/2,DY+DH/2+1);ctx.scale(z,z);txt('¡¡LLAME YA!!',0,0,40,fl?'#ffe14d':'#ff4d5e',0,true);ctx.restore();}
      else corre(CUNA,28,'#ffb300',DX+10,DX+DW,DY+DH/2+1,mq);
      ctx.restore();
      ctx.restore();
      /* enchufado: el enchufe queda tapado por el puerto */
      if(win){const u=ease(clamp(e/.12,0,1));muneco(lerp(x0,PX,u),lerp(y0,MY+L-24*S,u),lerp(a0,0,u)+sw*.07,{mood:'happy',back:volt,led:dz&&Math.floor(beat)%2?'#5cff7a':'#ff3b4e'});}
      txt('USB',PX-84,MY-8,14,'#fffdf2',0,true);puerto(m[0],m[1],good||win);
      /* el chofer y su volante */
      const CX=98,CY=376,AW=[{side:-1,a:.12,len:92,w:23},{side:1,a:-.2,len:92,w:23}],late=k>.7,ch={x:CX,y:CY,s:1.05,look:1,arms:AW};
      if(dz)Object.assign(ch,{y:CY-hop*8,rot:sw*.07,mood:'happy',arms:[{side:-1,a:-2.5+sw*.45,len:84,w:23},{side:1,a:2.5+sw*.45,len:84,w:23}]});
      else if(win)ch.mood='o';
      else if(rev){const u=ease(clamp(e/.25,0,1));Object.assign(ch,{x:CX+30*u,s:1.05+.14*u,rot:.07*u+Math.sin(now*30)*.012,mood:'angry',teeth:1,vein:1});}
      else if(lose)Object.assign(ch,{x:CX+Math.sin(now*44)*2,mood:'yell',talk:.5+.5*Math.sin(now*20),sweat:2,vein:1,arms:[{side:-1,a:-2.85,len:70,w:23},{side:1,a:2.85,len:70,w:23}]});
      else Object.assign(ch,{mood:late?'yell':k>.35?'angry':'calm',lids:k>.35?0:1,talk:late?Math.abs(Math.sin(now*15)):0,vein:late?1:0,sweat:late?1:0});
      bust(Object.assign({},CH,ch));
      line(closeP(ellP(52,566,126,96,18)),20,'#14101c');
      /* la guía: silueta de dónde va y el cono del ángulo bueno (verde = ¡ya!) */
      if(!g.result){const gc=good?'#5cff7a':'#fff3c4',near=(held||kb)&&Math.hypot(px-d[0],py-d[1])<RPOS*1.8;
        ctx.save();ctx.globalAlpha=good?.55:.25;poly([[d[0],d[1]]].concat(arcPts(d[0],d[1],L+2,-PI/2-TOL,-PI/2+TOL,6)),gc,0);ctx.restore();
        line(closeP(rrP(d[0]-31*S,d[1]-82*S,62*S,82*S,21*S)),good?5:3,gc);line(closeP(rrP(d[0]-12*S,d[1]-L,24*S,30*S,3)),good?5:3,gc);
        if(good&&near)txt('¡YA!',d[0]+112,d[1]-92,34,'#5cff7a',-.1);
        if(!used)for(let i=0;i<3;i++)txt('◀',610-i*38-(now*70)%38,474,26,'#ffe14d');}
      /* tu mano y el pendrive */
      if(win){const u=ease(clamp((e-.14)/.3,0,1)),hx=lerp(x0,HOME[0],u),hy=lerp(y0,HOME[1],u)-hop*10;palma(hx,hy);for(let i=0;i<4;i++)ell(hx-16+i*15,hy+2-(i%3?6:0),10,19,TU.skin,3);ell(hx-32,hy+30,13,11,TU.skin,3);}
      else if(rev){const u=clamp((e-.07)/.55,0,1),lx=556,ly=534;palma(x0,y0);dedos(x0,y0);
        muneco(lerp(x0,lx,u)+(u?0:Math.sin(now*90)*4),lerp(y0,ly,u)-Math.sin(u*PI)*120,lerp(a0,PI*2.5,ease(u)),{mood:'dizzy',bent:u>0,back:volt});
        if(u>=1)for(let i=0;i<3;i++){const q=now*5+i*TAU/3;txt('★',lx+96+Math.cos(q)*34,ly-58+Math.sin(q)*9,20,'#ffe14d');}}
      else{palma(px,py);muneco(px,py,a,{mood:lose?'dizzy':held||kb?(good?'happy':'o'):'calm',good,back:flT>.5?!volt:volt,fx:Math.max(.08,Math.abs(1-2*flT))});dedos(px,py);
        if(!used&&!g.result)tag(px+76,py+8);
        /* rebotó y sigue del lado malo: que lo voltee */
        if(GAG&&!g.result&&mal!==null&&volt===mal&&!held&&!kb&&rbT<.75){const b=Math.abs(Math.sin(now*7));txt('¡VOLTÉALO!',px+8,py-148-b*6,26,'#ffe14d',-.05);txt('TÓCALO',px+8,py-122-b*6,16,'#ffffff',-.05);
          for(const sg of[-1,1])poly([[px+sg*(66+b*8),py-70],[px+sg*(50+b*8),py-82],[px+sg*(50+b*8),py-58]],'#ffe14d',3);}}
      if(!g.result&&rbT>0)bubble(158,150,'¡ESTÁ AL REVÉS, CHICO!',16,CX+16,246);
      else if(!g.result&&g.t>.15&&g.t<1.7/rs)bubble(158,150,'¡CAMBIA EL PENDRIVE!',17,CX+16,246);
      if(dz&&e>.55)bubble(160,150,'¡ESA SÍ ES MÚSICA!',19,CX+16,240);
      if(rev&&e>.3)bubble(170,150,"¡ERA PA'L OTRO LADO!",18,CX+60,232);
      if(lose&&!rev&&e>.3)bubble(160,150,'¡YA ME SÉ LA CUÑA!',19,CX+16,244);
      ctx.restore();line([[gameLeft(),576],[gameRight(),576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('pendrive',{name:'¡PENDRIVE!',mk:mkPendrive,card:'EL PENDRIVE',num:'2'});
})();
