'use strict';
/* MiniCaos · laboratorio de estilos: ¡TRÁNCALO! (la cola de la gasolina).
   Cuatro horas en la cola, vista de lado; la bomba se ve allá lejísimo en la loma. El señor de adelante rueda dos metros y
   por la bocacalle viene bajando EL VIVO ("permisito...") con el intermitente puesto, a meter la trompa en el hueco.
   MANTENER = acelerar, SOLTAR = frenar: hay que quedar PARADO con el parachoques dentro de la franja verde PEGADITO, justo
   detrás del de adelante, antes de que la trompa del vivo llegue a la cola. Tocarlo es perder (¡LO CHOCASTE!); quedar corto
   no: se puede volver a pisar si queda reloj. El vivo ES el reloj: baja parejo y llega cuando se acaba la barra (si en ese
   momento ya vas dentro de la franja, no cabe, y todavía tienes que terminar de parar sin chocar).
   El carro es una carcacha: el acelerador entra de a poco (0.28 s hasta el tope), así que machacar toquecitos casi no lo
   mueve; al soltar frena, pero sigue rodando un pelo. Antes de que el de adelante ruede, el acelerador no hace nada.
   Nivel 1: franja ancha y carro lento que frena casi en seco: alcanza con soltar al verlo entrar a la franja.
   Nivel 2: vivo más rápido, franja más angosta, carro más veloz que rueda más al soltar: hay que soltar ANTES de llegar.
   Nivel 3: todo eso más y el de adelante rueda DOS veces (130 + 60): la segunda apenas te le pegas (o a mitad de reloj si
   todavía no llegas), y hay que rematar con otro pisón corto.
   Ganas (¡PEGADITO!): el vivo se lanza igual, rebota contra tu capó (¡BOING!), queda viendo estrellas, "yo solo iba pasando..."
   y se devuelve en retroceso silbando mientras la cola aplaude y pita. Pierdes por lento (¡SE COLEÓ!, el final de la ficha):
   mete el carro entero y te empuja para atrás, saca la mano dando las gracias, y detrás se le mete el compadre ("¡vengo
   con él!"): PUESTO 37 → 38 → 39. Pierdes por bruto (¡LO CHOCASTE!): al señor se le caen el parachoques y las pimpinas del
   techo, a ti se te abre el capó echando humo y él te explica: "¡pegadito, no encima!".
   Fondo: la gallina va a pie con su pimpina y llega primero que toda la cola; una de cada ocho veces el aviso de la bomba
   dice HOY NO HAY.
   Teclado: mantener ESPACIO (o ENTER / ↑ / W), con keydown, keyup y blur propios que solo cuentan en este juego.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.trancalo)return;
const{LV,CONF,TU,tag}=window.BUS,GY=532,LEN=236,KY=336,JX=456,JB=478,GLASS='#bfe9ff',CROMO='#c9ced6',LATAS=['#ff9ec7','#a9a0ff','#6ecf8f','#ffd23f'];
const VIVO={skin:'#b87b50',shirt:'#9b6bd1',hair:'slick',hairCol:'#14101c',stache:1,gold:1,chain:1,brow:'thick',earring:1},
  DON={skin:'#e8b48a',shirt:'#fffdf2',hair:'bald',hairCol:'#8f8fa8',stache:1,brow:'thick',glasses:'round',wrinkles:1,cheeks:1};
const pop=(s,x,y,col,r=6,life=.8)=>PT.push({x,y,vx:0,vy:-60,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
const humo=(x,y,vx,c)=>PT.push({x,y,vx,vy:-40,g:-90,t:0,life:.55,kind:'bit',col:c,r:4+Math.random()*4,rot:Math.random()*6,vr:3});
const pimp=(x,y,c)=>{rr(x-8,y-20,16,20,4,c,3);line([[x-5,y-20],[x,y-27],[x+5,y-20]],3,c);};

/* ───────── mantener = acelerar ─────────
   El puntero llega por BUS (down/up). El teclado es de este archivo (keydown, keyup y blur): press() del laboratorio no sirve
   para mantener, y así un "soltar = presionar" perdido nunca deja el acelerador pegado. Solo cuentan en este juego. */
const PEDAL=['Space','Enter','ArrowUp','KeyW'];let kH=false,pH=false;
addEventListener('keydown',e=>{if(gameId==='trancalo'&&!e.repeat&&PEDAL.includes(e.code))kH=true;});
addEventListener('keyup',e=>{if(gameId==='trancalo'&&PEDAL.includes(e.code))kH=false;});
addEventListener('blur',()=>{if(gameId==='trancalo')kH=pH=false;});
view.addEventListener('lostpointercapture',()=>{if(gameId==='trancalo')pH=false;});

/* carro de lado, mirando a la derecha. xF = la punta del parachoques delantero.
   o: {f: cara, m: gestos, rot, dy, luz: frenos, capo: 0..1 abierto, sinP: sin parachoques trasero, rack: pimpinas en el techo} */
function carro(xF,col,o){const d=dark(col,.3);
  ctx.save();ctx.translate(xF-LEN,GY+(o.dy||0));if(o.rot){ctx.translate(LEN/2,-30);ctx.rotate(o.rot);ctx.translate(-LEN/2,30);}
  if(!o.sinP)rr(-8,-54,18,22,6,CROMO,3.5);rr(LEN-10,-54,18,22,6,CROMO,3.5);
  if(o.rack){line([[44,-202],[162,-202]],5,'#8f8fa8');for(let i=0;i<3;i++)pimp(76+i*27,-204,['#ff3b4e','#3fb0ff','#ff3b4e'][i]);}
  poly([[34,-94],[50,-198],[152,-198],[174,-94]],col,4.5);
  rr(0,-100,LEN,80,24,col,4.5);
  ell(5,-80,6,12,o.luz?'#ff3b4e':'#8a2434',3);ell(LEN-5,-80,7,11,'#fff3a8',3);
  line([[104,-92],[104,-30]],3,d);rr(112,-84,20,7,3,d,0);
  ctx.save();path(rrP(56,-190,94,92,12));ctx.clip();rr(50,-196,106,104,0,GLASS,0);
  if(o.f)bust(Object.assign({},o.f,{x:103,y:-86,s:.88,th:50,bw:50},o.m));ctx.restore();
  line(closeP(rrP(56,-190,94,92,12)),5,'#2d2640');
  if(o.capo){ctx.save();ctx.translate(176,-100);ctx.rotate(-o.capo*.95);rr(0,-8,58,10,4,col,3.5);ctx.restore();}
  for(const wx of[52,LEN-52]){ell(wx,-25,27,27,'#14101c',4);ell(wx,-25,11,11,CROMO,3);}
  ctx.restore();}
/* un carro de frente (el vivo y su compadre). (x, yb) = centro del parachoques, a ras de piso. o: {col, f, m, sy, luz: intermitente, pl: placa} */
function trompa(x,yb,s,o){
  ctx.save();ctx.translate(x,yb);ctx.scale(s,s*(o.sy||1));
  rr(-82,-38,30,40,9,'#14101c',3.5);rr(52,-38,30,40,9,'#14101c',3.5);
  for(const sg of[-1,1])ell(sg*80,-126,12,9,o.col,3.5);
  poly([[-68,-108],[-58,-204],[58,-204],[68,-108]],o.col,4.5);
  ctx.save();path(rrP(-54,-196,108,86,12));ctx.clip();rr(-60,-200,120,96,0,GLASS,0);
  bust(Object.assign({},o.f,{x:0,y:-100,s:.8,th:50,bw:50},o.m));ctx.restore();
  line(closeP(rrP(-54,-196,108,86,12)),5,'#2d2640');
  rr(-84,-116,168,94,24,o.col,4.5);
  rr(-36,-78,72,32,8,'#14101c',3);for(let i=0;i<4;i++)line([[-24+i*16,-72],[-24+i*16,-52]],2.5,'#8f8fa8');
  for(const sg of[-1,1]){ell(sg*60,-64,15,13,'#fff3a8',3.5);ell(sg*74,-94,8,6,o.luz&&sg<0?'#ffb300':'#8a5a10',2.5);}
  rr(-90,-36,180,22,9,CROMO,4);rr(-26,-34,52,17,3,'#fffdf2',2.5);txt(o.pl||'VIVO',0,-25,11,INK,0,true);
  ctx.restore();}
/* la calle: el abasto, la bocacalle que sube la loma y, allá lejísimo, la bomba con el resto de la cola */
function fondo(rare){
  wash(0,0,800,KY,'#8fd8ff','#e8f8ff');
  poly([[384,KY],[384,246],[470,214],[600,228],[716,204],[810,190],[810,KY]],'#8fcf7a',3.5);
  line([[810,312],[748,288],[706,252],[718,214]],11,'#e8d7a8');
  [[786,304],[762,294],[738,280],[720,264],[709,246],[712,228]].forEach(([x,y],i)=>rr(x-9,y-6,18,11,4,LATAS[i%4],2.5));
  rr(688,196,60,8,3,'#fffdf2',3);line([[697,204],[697,216]],3,'#8f8fa8');line([[739,204],[739,216]],3,'#8f8fa8');
  line([[770,214],[770,142]],5,'#8f8fa8');rr(716,98,82,46,8,'#c4283a',3.5);txt('BOMBA',757,113,15,'#ffffff',0,true);txt(rare?'HOY NO HAY':'HOY SÍ HAY',757,131,10,'#ffe14d',0,true);
  rr(556,288,254,30,0,'#e8d7a8',3.5);
  rr(-10,150,400,KY-170,0,'#ffb36b',4);rr(-10,150,400,16,0,'#e8553d',0);line([[-10,166],[390,166]],4,INK);
  rr(204,178,172,34,8,'#fff3c4',3.5);txt('ABASTO LA BENDICIÓN',290,196,12,INK,0,true);
  for(let i=0;i<3;i++){rr(22+i*58,188,40,50,6,'#5a4a78',3.5);rr(22+i*58,228,40,10,3,'#fff3c4',2.5);}
  for(let i=0;i<8;i++)rr(-10+i*50,262,50,16,0,i%2?'#fffdf2':'#e8553d',2.5);
  rr(-10,KY-20,820,20,0,'#d8d2c4',0);
  poly([[386,KY+2],[560,KY+2],[520,214],[430,214]],'#4d4a6e',0);line([[386,KY],[430,214]],4,INK);line([[560,KY],[520,214]],4,INK);
  for(let i=0;i<4;i++)rr(471,224+i*30,5,14,2,'#ffe14d',0);
  line([[382,KY-2],[382,212]],5,'#8f8fa8');rr(290,216,90,22,5,'#2f7fe0',3);txt('CALLE EL VIVO',335,227,10,'#ffffff',0,true);
  rr(-10,KY,820,280,0,'#4d4a6e',0);line([[-10,KY],[386,KY]],4,INK);line([[560,KY],[810,KY]],4,INK);rr(-10,574,820,36,0,'#d8d2c4',0);line([[-10,574],[810,574]],4,INK);}

/* ═════════ ¡TRÁNCALO! ═════════ */
function mkTrancalo(){
  kH=pH=false;
  const rs=Math.sqrt(SP),lv=LV(),n=lv-1,AC=[300,340,380][n],VM=[140,205,240][n],BR=[700,560,480][n],Z=[52,38,28][n],D1=lv>2?130:190,D2=lv>2?60:0;
  const T=5/rs,tR=.25,dR=.5/rs,dR2=.32,t2=tR+(T-tR)*.5,RAMP=.28,PX0=300,AX0=PX0+16,Y0=KY+4,Y1=510,rare=Math.random()<.125;
  let px=PX0,v=0,ax=AX0,r2=-1,gas=false,hold=0,eng=0,blk=.3,bl=false,puff=0,ev=0,clap=0,nota=0,uE=0;
  const U=()=>clamp((g.t-tR)/(T-tR),0,1),rueda=()=>g.t>=tR&&(g.t<tR+dR||(r2>=0&&g.t<r2+dR2));
  const fin=(kind,res,why)=>{g.kind=kind;g.result=res;g.why=why;uE=U();ev=0;puff=0;};
  const otra=()=>{r2=g.t;snd(170,.25,'sawtooth',.05,70);pop('¡RODÓ OTRA VEZ!',ax+90,258,'#ffe14d');};
  /* los finales: cada golpe suena cuando se ve */
  function fx(e,dt){const k=g.kind;
    if(k==='win'){
      if(ev<1&&e>=.25){ev=1;sfx.boing();sfx.thud();spawn(JB,GY-102,9,'★',['#ffe14d','#ffffff'],240,500,.7);pop('¡BOING!',JB+4,GY-128,'#ffffff');}
      if(ev<2&&e>=.6){ev=2;snd(660,.1,'square',.05);setTimeout(()=>snd(880,.24,'square',.05),130);pop('¡BRAVO!',706,262,'#ffe14d');pop('¡ESO!',104,262,'#ffffff');}
      if(ev<3&&e>=1.05){ev=3;sfx.cluck();}
      if(ev<4&&e>=1.45){ev=4;pop('¡ASÍ ES!',112,262,'#ffe14d');pop('¡BRAVO!',706,262,'#ffffff');}
      if(e>=.6&&e<2&&(clap-=dt)<=0){clap=.13;nz(.03,.06);}
      if(e>=1.3&&(nota-=dt)<=0){nota=.28;snd(1500+Math.random()*400,.12,'sine',.03,200);PT.push({x:JB+50,y:GY-170,vx:40,vy:-50,g:0,t:0,life:.9,kind:'♪',col:'#ffffff',r:2,rot:0,vr:0});}}
    else if(k==='coleo'){
      if(ev<1&&e>=.3){ev=1;sfx.thud();}
      if(ev<2&&e>=.5){ev=2;snd(740,.1,'square',.06);setTimeout(()=>snd(740,.2,'square',.06),150);}
      if(ev<3&&e>=.85){ev=3;sfx.whoosh();}
      if(ev<4&&e>=1.15){ev=4;sfx.thud();sfx.boing();}}
    else{
      if(ev<1&&e>=.45){ev=1;snd(1400,.09,'triangle',.07);nz(.06,.12);}
      if(ev<2&&e>=.9){ev=2;sfx.cluck();}}}
  const g={get impact(){const e=this.endT;return this.kind==='choque'?clamp(1-e/.5,0,1):this.kind==='win'&&e>=.25?clamp(1-(e-.25)/.4,0,1):0;},
    probe:()=>({px,v,ax,gap:ax-px,Z,AC,BR,VM,go:g.t>=tR,rueda:rueda(),otra:r2>=0,u:U(),gas,kind:g.kind}),
    t:0,dur:T,result:null,why:'',kind:'',endT:0,cmd:'¡TRÁNCALO!',
    hint:'MANTÉN (dedo o ESPACIO): acelera · SUELTA: frena · pégate SIN chocarlo',
    press(){},
    down(){pH=true;},
    up(){pH=false;},
    update(dt){g.t+=dt;
      if(g.result){g.endT+=dt;fx(g.endT,dt);return;}
      const u=U(),was=gas;gas=(kH||pH)&&g.t>=tR;
      if(ev<1&&g.t>=tR){ev=1;snd(170,.25,'sawtooth',.045,60);}
      hold=gas?hold+dt:0;v=gas?Math.min(VM,v+AC*Math.min(1,hold/RAMP)*dt):Math.max(0,v-BR*dt);px+=v*dt;
      ax=AX0+D1*ease(clamp((g.t-tR)/dR,0,1))+(r2<0?0:D2*ease(clamp((g.t-r2)/dR2,0,1)));
      if(gas){if((eng-=dt)<=0){eng=.065;snd(52+v*.42,.08,'sawtooth',.03);}
        if((puff-=dt)<=0){puff=.1;humo(px-LEN-8,GY-36,-70-Math.random()*50,'#d8d2c4');}}
      else if(was&&v>50){snd(840,.14,'sawtooth',.022,-420);nz(.1,.04);}
      if(g.t>=tR&&(blk-=dt)<=0){blk=lerp(.44,.14,u);bl=!bl;snd(bl?1250:940,.03,'square',.028);}
      const gap=ax-px;
      if(gap<=0){px=ax;fin('choque','lose','¡LO CHOCASTE!');sfx.crash();sfx.lose();
        spawn(ax,GY-46,10,'★',['#ffe14d','#ffffff'],260,500,.7);spawn(ax+110,GY-214,7,'bit',['#ff3b4e','#3fb0ff','#ff3b4e'],240,700,.9);spawn(730,KY-40,5,'feather',['#f1ece2'],200,300,.8);}
      else if(!gas&&v===0&&gap<=Z&&g.t>=tR&&!rueda()){
        if(D2&&r2<0)otra();
        else{fin('win','win','¡PEGADITO!');sfx.win();spawn(px,GY-120,22,'conf',CONF);}}
      else if(D2&&r2<0&&g.t>=t2)otra();
      if(!g.result&&g.t>=T&&gap>Z){fin('coleo','lose','¡SE COLEÓ!');sfx.lose();sfx.whoosh();}},
    draw(){
      const k=g.kind,win=k==='win',col=k==='coleo',cho=k==='choque',e=g.endT,play=!g.result,go=g.t>=tR,u=play?U():uE,gap=ax-px,inZ=go&&gap<=Z&&!rueda();
      let mx=px,aX=ax,rot=0,dy=0;
      if(play){rot=gas?-.016:v>0?.028*Math.min(1,v/120):0;dy=gas?Math.sin(now*46)*1.2:0;}
      else if(cho){const q=ease(clamp(e/.15,0,1));mx=px-14*q;aX=ax+24*ease(clamp(e/.2,0,1));rot=.04*q*(1-clamp((e-.15)/.3,0,1));}
      else if(col)mx=lerp(lerp(px,Math.min(px,340),ease(clamp(e/.3,0,1))),176,ease(clamp((e-.85)/.3,0,1)));
      else if(e>=.25)dy=-3*clamp(1-(e-.25)/.2,0,1);
      const sk=cho?clamp(1-e/.25,0,1):win&&e>=.25?clamp(1-(e-.25)/.2,0,1):0;
      ctx.save();ctx.translate(Math.sin(now*70)*4*sk,0);
      fondo(rare);
      /* la gallina de siempre va a pie con su pimpina: llega primero que toda la cola */
      const hx=686+Math.min(1,g.t/T)*70,hop=win&&e>.6?Math.abs(Math.sin(e*13))*16:Math.abs(Math.sin(now*9))*3;
      hen(hx,KY-36-hop,.55,cho||col?-1:1);pimp(hx+26,KY-22-hop,'#ff3b4e');
      /* el vivo: mientras baja por la bocacalle va DETRÁS de la cola */
      let jx=JX,jy=lerp(Y0,Y1,u),sy=1;
      if(win){const q=Math.min(1,e/.25)**2;jx=lerp(JX,JB,q);jy=lerp(jy,Y1,q);
        if(e>=.25){jy=Y1-6-70*ease(clamp((e-1.3)/1,0,1));sy=1-.16*clamp(1-(e-.25)/.2,0,1);}}
      const qc=col?ease(clamp(e/.35,0,1)):0;if(col){jx=lerp(JX,440,qc);jy=lerp(Y1,GY+4,qc);}
      const js=col?lerp(.92,1,qc):lerp(.66,.92,clamp((jy-Y0)/(Y1-Y0),0,1));
      const jm=win?(e<.25?{mood:'yell',talk:1}:e<.75?{mood:'dizzy'}:{mood:'worry',sweat:2,look:1})
        :col?{mood:e>.45?'grin':'happy',look:-1}:cho?{mood:'o',look:1}
        :!go?{mood:'smile',lids:1,look:Math.sin(now*2.2)>0?1:-1}
        :inZ?{mood:'worry',sweat:1,look:-1}:{mood:u>.5?'grin':'smile',lids:u>.5?0:1,look:Math.sin(now*4)>0?1:-1};
      const vivo=()=>trompa(jx,jy,js,{col:'#5a4a78',f:VIVO,m:jm,sy,luz:play&&go&&bl});
      if(!col)vivo();
      /* el PEGADITO: la franja verde pegada al parachoques de adelante */
      if(play&&go){ctx.save();ctx.globalAlpha=inZ?.8:.42+.14*Math.sin(now*9);rr(aX-Z,GY-90,Z,74,6,'#5cff7a',0);ctx.restore();}
      /* la cola */
      const near=play&&go&&gap<110&&v>90,br=win&&e>.6?-Math.abs(Math.sin(e*13))*7:0;
      carro(AX0+D1+D2+2*LEN+16,'#a9a0ff',{luz:1});
      carro(aX+LEN,'#ffd23f',{f:DON,rack:!cho,sinP:cho,luz:!rueda(),dy:cho?-5*clamp(1-e/.25,0,1):win?dy+br:0,
        m:win?{mood:'happy',look:-1}:cho?{mood:'yell',look:-1,vein:1,talk:Math.abs(Math.sin(now*14))}:col?{mood:'o',look:-1}
          :!go?{mood:'sleep'}:near?{mood:'panic',look:-1,sweat:1}:{mood:'calm',look:1}});
      carro(mx,'#e8553d',{f:TU,rot,dy:dy+br,luz:play&&go&&!gas&&v>0,capo:cho?ease(clamp((e-.08)/.25,0,1)):0,
        m:win?{mood:e<.6?'grin':'happy',look:1}:col?{mood:e<.85?'angry':'frown',vein:1,look:1,lids:e>1.3?1:0}
          :cho?{mood:e<.5?'panic':'dizzy',sweat:2}:!go?{mood:'calm',lids:1,look:1}
          :{mood:gas?(u>.7?'panic':'yell'):v>0?'o':u>.7?'panic':'worry',look:1,sweat:u>.5?2:1,talk:gas?1:0}});
      carro(Math.min(PX0,mx)-LEN-16,'#6ecf8f',{});
      if(cho){const q=clamp(e/.45,0,1);ctx.save();ctx.translate(aX-6-12*q,lerp(GY-43,GY-5,q*q));ctx.rotate(q*6.1);rr(-24,-7,48,14,6,CROMO,3.5);ctx.restore();
        for(let i=0;i<4;i++){const w=(e*1.1+i/4)%1;ctx.save();ctx.globalAlpha=1-w*w;ell(mx-30+Math.sin(e*5+i*2)*12,GY-112-w*80,10+w*18,9+w*14,'#ffffff',2.5);ctx.restore();}}
      /* en el piso: dónde está tu parachoques y dónde tiene que quedar */
      if(play&&go){rr(aX-Z,GY+9,Z,13,4,'#5cff7a',3);rr(aX+2,GY+9,40,13,4,'#ff4d5e',3);txt('PEGADITO',aX-Z/2,GY+33,13,'#5cff7a',0,true);
        poly([[px,GY+4],[px-10,GY+24],[px+10,GY+24]],'#ffe14d',3);}
      /* se coleó: ya adentro va DELANTE de la cola, y detrás se le mete el compadre */
      if(col){
        if(e>=.85){const q=ease(clamp((e-.85)/.3,0,1));trompa(lerp(JX,262,q),lerp(Y0,GY+4,q),lerp(.66,.92,q),{col:'#3fa0ff',f:FACES[4],m:{mood:'happy',look:-1},pl:'PANA'});}
        vivo();
        if(e>.45){const ox=jx-80*js,oy=jy-146*js;limb(ox+8,oy+6,ox-30,oy-22,15,VIVO.shirt,3.5);hand(ox-36,oy-31,-.6+Math.sin(now*14)*.5,1.25,VIVO.skin);}}
      if(win&&e>.6){const c=Math.abs(Math.sin(e*22))*9;limb(-8,GY-118,20,GY-140,14,'#ff7ab0',3.5);for(const sg of[-1,1])hand(26+sg*(8+c),GY-152,sg*.25,1.1,'#c68a5c');}
      tag(mx-LEN+103,GY-226);
      /* tu puesto en la cola */
      const np=37+(col?(e>=.3)+(e>=1.15):0),tc=col?(e>=1.15?e-1.15:e>=.3?e-.3:9):9,pk=1+.3*clamp(1-tc/.2,0,1);
      ctx.save();ctx.translate(100,120);ctx.scale(pk,pk);rr(-86,-24,172,48,10,np>37?'#ff4d5e':win?'#5cff7a':'#ffd23f',4);
      txt('PUESTO '+np,0,-5,23,INK,0,true);txt('COLA: 4 HORAS',0,14,10,INK,0,true);ctx.restore();
      /* lo que se dice */
      if(play&&go&&g.t<tR+1.3/rs)bubble(470,150,'PERMISITO...',17,jx+10,jy-200*js);
      if(play&&u>.6&&!inZ&&Math.sin(now*20)>-.3)txt('¡SE COLEA!',jx,jy-204*js-18,24,'#ff4d5e',-.05);
      if(win&&e>.75)bubble(506,172,'YO SOLO IBA PASANDO...',17,jx+26,jy-198*js);
      if(cho&&e>.3)bubble(596,172,'¡PEGADITO, NO ENCIMA!',18,aX+110,GY-204);
      if(col&&e>.45)bubble(548,172,'¡GRACIAS, MI LLAVE!',19,jx-8,jy-206*js);
      if(col&&e>1.2)bubble(210,196,'¡VENGO CON ÉL!',17,262,GY-190);
      ctx.restore();drawP();
    }};
  return g;
}
BUS.add('trancalo',{name:'¡TRÁNCALO!',mk:mkTrancalo,card:'LA COLA',num:'71'});
})();
