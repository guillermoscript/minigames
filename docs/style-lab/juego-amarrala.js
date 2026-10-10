'use strict';
/* MiniCaos · laboratorio de estilos: ¡AMÁRRALA! (la cabulla).
   El fondo de la camionetica por dentro: la puerta de atrás no tiene seguro, se aguanta con una cabulla azul amarrada al tubo.
   El bus agarra una curva cerrada y la puerta se va abriendo: hay que darle VUELTAS a la cabulla alrededor del tubo (el dedo
   o el ratón apretado girando, o las flechas en orden → ↓ ← ↑) antes de que la doña se salga con todo y cartera.
   La puerta ES el reloj: la curva la empuja sin parar y cada vuelta completa la cierra un poco (1/N). Girar al revés desenrolla.
   Nivel 1: 3 vueltas. Nivel 2: 4 vueltas y empuja más. Nivel 3: 5 vueltas, empuja más y un hueco (¡PLOC!) afloja media vuelta.
   Ganas: lazo, portazo y bendición. Pierdes: la doña se queda (agarrada del asiento), pero la cartera se va rodando por la avenida.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.amarrala)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI;
const ROPE='#2f7fe0',ROPE2='#8fc4ff',BLD=['#ffb36b','#a9a0ff','#ff9ec7','#6ecf8f','#ffd23f','#8aa0ff'];
/* la doña de los rolos */
const DONA={skin:'#d9a07a',shirt:'#ff5ca8',pat:'floral',sh2:'#fff3a8',hair:'rolos',hairCol:'#3b2a22',glasses:'round',cheeks:1,earring:1,wrinkles:1,bw:50,th:84};
const big=(s,x,y,col,r=20)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life:.75,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
const soga=(pts,w=6)=>{line(pts,w+4,INK);line(pts,w,ROPE);};
function cartera(x,y,rot=0,s=1){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
  line(arcPts(0,-16,17,PI,TAU,8),6,'#7a1e2a');rr(-29,-18,58,40,10,'#c4283a',4);rr(-29,-18,58,15,7,'#e8553d',3);ell(0,-4,6,6,'#ffd23f',2.5);ctx.restore();}
/* la gallina de siempre, mirando para adentro */
function gallina(x,y,s,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(-1,1);hen(0,0,s,1);ctx.restore();}
/* tu mano: puño con la manga; rot=0 deja la manga hacia abajo */
function puno(x,y,rot,up){ctx.save();ctx.translate(x,y);ctx.rotate(rot);limb(0,10,0,44,26,TU.shirt,4);
  if(up)rr(-7,-36,14,28,7,TU.skin,3.5);
  rr(-17,-14,34,28,11,TU.skin,4);for(let i=0;i<3;i++)line([[-8+i*8,-12],[-8+i*8,-1]],2.5,dark(TU.skin,.35));if(!up)ell(-16,3,7,9,TU.skin,3);ctx.restore();}
function lazo(x,y,k){ctx.save();ctx.translate(x,y);ctx.scale(k,k);
  soga([[-4,4],[-10,20],[-20,36]],5);soga([[4,4],[12,22],[18,38]],5);
  for(const sg of[-1,1]){ell(sg*22,-3,19,13,ROPE,3.5);ell(sg*23,-3,8,5,ROPE2,0);}ell(0,0,10,10,ROPE,3.5);ctx.restore();}

function mkAmarrala(){
  const lv=LV(),rs=Math.sqrt(SP),N=[3,4,5][lv-1],K=1/N,PUSH=[.19,.3,.38][lv-1],ph=Math.random()*TAU,tB=lv>=3?(1.2+Math.random()*.5)/rs:0,rare=Math.random()<.125;
  const PX=356,CY=340,R=100,FY=556,TH=.06,DY=FY-126,DS=.92,VX=700,VY=330,P0=[676,FY-28],AY=CY-20,KEY={right:0,down:1,left:2,up:3};
  let acc=0,loops=0,open=.4,lean=0,jolt=0,slack=0,pop=0,nud=0,la=null,spun=0,ha=2.3,hs=2.3,hr=R,hrS=R,touched=false,kq=-1,nk=0,tk=0;
  let bumped=false,said=0,fT=0,o0=0,ev=0,hx0=0,hy0=0,nb=0;const spill=[];
  const SX=()=>514+open*36,henXY=()=>[602+open*20,FY-120-Math.abs(Math.sin(now*(7+open*14)))*(3+open*16)];
  /* el bus va inclinado: el centro del tubo en pantalla y el puntero en coordenadas del bus */
  const rot=(x,y,a)=>{const c=Math.cos(a),s=Math.sin(a);x-=400;y-=560;return[400+x*c-y*s,560+x*s+y*c];};
  const nudge=()=>{if(g.result||nud>0)return;nud=.7;snd(200,.06,'square',.03);const c=rot(PX,CY,lean*TH);say('¡DALE VUELTAS!',c[0],c[1]-R-56,'#ffffff');};
  /* d = giro en radianes, con signo. Cualquier sentido sirve, pero el contrario desenrolla. */
  function wind(d){if(g.result)return;const b=Math.abs(acc);acc+=d;const tn=Math.abs(acc)/TAU;open=clamp(open-K*(Math.abs(acc)-b)/TAU,0,1);
    const q=Math.floor(tn*8);if(q!==tk){tk=q;snd(520+(q&7)*40,.025,'square',.025);}
    if(tn>=N){loops=N;pop=1;o0=open;[hx0,hy0]=henXY();g.result='win';g.why='¡AMARRADA!';sfx.win();snd(260,.22,'sawtooth',.05,340);spawn(SX(),DY-60,22,'conf',CONF);return;}
    while(loops<Math.floor(tn+1e-6)){loops++;pop=1;snd(150+loops*35,.16,'sawtooth',.05,110);nz(.05,.07);const c=rot(PX,CY,lean*TH);big('¡'+loops+'!',c[0],c[1]-R-54,'#ffe14d');}
    if(tn<loops-.2){loops=Math.floor(tn);snd(210,.12,'sawtooth',.04,-90);}}
  function feed(p){if(g.result)return;const q=rot(p.x,p.y,-lean*TH),dx=q[0]-PX,dy=q[1]-CY,r=Math.hypot(dx,dy);
    if(r<40||r>260){la=null;return;}
    const a=Math.atan2(dy,dx);touched=true;ha=a;hr=clamp(r,66,150);
    if(la!=null){let d=a-la;d-=TAU*Math.round(d/TAU);if(Math.abs(d)<2.2){spun+=Math.abs(d);wind(d);}}
    la=a;}
  function bump(){bumped=true;const cut=Math.min(Math.abs(acc),PI);acc-=Math.sign(acc)*cut;loops=Math.floor(Math.abs(acc)/TAU+1e-6);tk=Math.floor(Math.abs(acc)/TAU*8);
    open=Math.min(.96,open+K*cut/TAU+.05);slack=1;jolt=1;sfx.thud();nz(.2,.15);big('¡PLOC!',230,FY-54,'#ff8a3d',26);
    const c=rot(PX,CY,lean*TH);say('¡SE AFLOJÓ!',c[0],c[1]-R-56,'#ff9ec7');spawn(c[0],c[1],6,'bit',[ROPE,ROPE2],220,600,.6);}
  function fail(){[hx0,hy0]=henXY();o0=open;la=null;loops=0;g.result='lose';g.why='¡SE ABRIÓ!';jolt=1;sfx.crash();sfx.whoosh();sfx.lose();
    const c=rot(PX,CY,lean*TH);spawn(c[0],c[1],10,'bit',[ROPE,ROPE2],300,700,.8);spawn(604,FY-104,8,'feather',['#f1ece2'],220,300,.9);}

  /* la avenida que se aleja, vista por la puerta y por el vidrio de atrás; se inclina al revés que el bus */
  function calle(vx,vy,extra){ctx.save();ctx.translate(vx,vy);ctx.rotate(-lean*TH*2.2);ctx.translate(-vx-lean*16,-vy);
    wash(vx-340,vy-270,680,272,'#8fd8ff','#e8f8ff');rr(vx-340,vy,680,340,0,'#d8d2c4',0);line([[vx-340,vy],[vx+340,vy]],4,INK);
    const bs=[];for(let i=0;i<4;i++)for(const sg of[-1,1])bs.push([((i/4-now*.45+(sg>0?.13:0))%1+1)%1,sg,i]);bs.sort((a,b)=>a[0]-b[0]);
    for(const[u,sg,i]of bs){const q=u*u,w=26+q*150,h=50+q*260,x=vx+sg*(26+q*330);rr(sg>0?x:x-w,vy+q*46-h,w,h,4,BLD[(i*2+(sg>0?1:0))%6],3);}
    poly([[vx-300,vy+340],[vx+300,vy+340],[vx+12,vy],[vx-12,vy]],'#4d4a6e',0);
    for(let i=0;i<5;i++){const u=((i/5-now*1.5)%1+1)%1,w=3+u*20;rr(vx-w/2,vy+u*u*300,w,6+u*38,3,'#ffe14d',0);}
    if(extra)extra();ctx.restore();}
  /* lo que queda atrás en la avenida: el hueco, y si pierdes la cartera rodando con todo lo que bota */
  function fuera(){
    if(bumped){const f=1/(1+3.2*(g.t-tB));if(f>.06)ell(VX-40*f,VY+196*f,62*f+2,22*f+1,'#2d2640',3);}
    const tq=g.endT-.34;if(g.result!=='lose'||tq<0)return;
    for(const it of spill){const f=1/(1+1.6*it.t+.7*(tq-it.t)),s=.35+f,x=VX+(P0[0]+it.off-VX)*f,y=VY+(P0[1]-VY)*f;
      if(it.k){ell(x,y,9*s,6*s,'#ffd23f',2.5);ell(x-2*s,y-1.5*s,3*s,2*s,'#fff3a8',0);}
      else{ctx.save();ctx.translate(x,y);ctx.rotate(.9);rr(-4*s,-6*s,8*s,15*s,2,'#ffd23f',2.5);rr(-3*s,-17*s,6*s,12*s,3,'#ff3b6a',2.5);ctx.restore();}}
    const f=1/(1+1.6*tq),hop=Math.abs(Math.sin(tq*8.5))*60*f*Math.exp(-tq*.5);
    cartera(VX+(P0[0]-VX)*f,VY+(P0[1]-VY)*f-20*f-hop,tq*7,.15+1.05*f);}

  const g={lr:true,get impact(){return this.result?clamp(1-this.endT/.5,0,1):jolt*.7;},
    probe:()=>{const c=rot(PX,CY,lean*TH);return{turns:Math.abs(acc)/TAU,acc,loops,need:N,open,lean,tB,bumped,cx:c[0],cy:c[1],R};},
    t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡AMÁRRALA!',hint:'GIRA el dedo alrededor del tubo (o flechas → ↓ ← ↑): '+N+' vueltas',
    press(k){if(g.result)return;const i=KEY[k];if(i==null){nudge();return;}
      if(kq<0)wind((acc<0?-1:1)*PI/2);
      else if(i===(kq+1)%4)wind(PI/2);
      else if(i===(kq+3)%4){if(nk===1&&spun===0)acc=-acc;wind(-PI/2);}
      else return;
      kq=i;nk++;touched=true;ha=i*PI/2;hr=R;},
    down(p){la=null;spun=0;feed(p);},
    move(p){feed(p);},
    up(){la=null;if(spun<.3)nudge();},
    update(dt){g.t+=dt;jolt=Math.max(0,jolt-dt*3.5);slack=Math.max(0,slack-dt*1.5);pop=Math.max(0,pop-dt*4);nud=Math.max(0,nud-dt);
      let d=ha-hs;d-=TAU*Math.round(d/TAU);hs+=d*Math.min(1,dt*30);hrS+=(hr-hrS)*Math.min(1,dt*20);
      if(!g.result){
        lean+=(clamp(g.t/.4,0,1)*(1+.1*Math.sin(g.t*5+ph))-lean)*Math.min(1,dt*7);
        open=Math.min(1,open+PUSH*clamp(g.t/.35,0,1)*(1+.2*Math.sin(g.t*4.3+ph))*dt);
        if(!touched)ha=2.3+Math.sin(now*5)*.3;
        if(tB&&!bumped&&g.t>=tB)bump();
        if(said<1&&open>.62){said=1;say('¡AY, AY, AY!',SX()-40,DY-160,'#ffe14d');}
        if(said<2&&open>.84){said=2;say('¡ME SALGO!',SX()-40,DY-160,'#ffe14d');}
        if(open>.55&&(fT-=dt)<=0){fT=.28;const h=henXY();spawn(h[0],h[1]-10,1,'feather',['#f1ece2'],120,300,.7);snd(760,.05,'square',.025,260);}
        if(open>=1||g.t>=g.dur)fail();}
      else{g.endT+=dt;const e=g.endT;
        if(g.result==='win'){lean+=(.25-lean)*Math.min(1,dt*4);open=o0*(1-clamp(e/.12,0,1));
          if(ev<1&&e>=.12){ev=1;jolt=.8;sfx.thud();big('¡PAM!',706,456,'#ffffff',22);}
          if(ev<2&&e>=.7){ev=2;sfx.cluck();spawn(SX(),DY-10,5,'♥',['#ff4d6d'],120,-60,.9);}
          if(ev<3&&e>=1.05){ev=3;sfx.ding();}}
        else{lean+=(1-lean)*Math.min(1,dt*4);open=o0+(1-o0)*clamp(e/.08,0,1);
          if(ev<1&&e>=.2){ev=1;snd(260,.4,'sawtooth',.06,-80);}
          if(ev<2&&e>=1.1){ev=2;sfx.boing();}
          for(const tq=e-.34;nb<6&&tq>=nb*PI/8.5;nb++){snd(1300+nb*170,.07,'triangle',.06);if(!nb)nz(.08,.12);spill.push({t:tq,off:(nb%2?-1:1)*(16+nb*8),k:nb%3});}}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,ang=lean*TH,tn=Math.abs(acc)/TAU,fr=clamp(tn-loops,0,1),dir=acc<0?-1:1;
      const op=clamp(open+(g.result||open<.03?0:Math.sin(now*11)*.012),0,1),sx=514+op*36,glare=lose&&e>=1.1;
      ctx.save();ctx.translate(400,560);ctx.rotate(ang);ctx.translate(-400,-560-jolt*12+Math.sin(now*34)*1.2);
      /* pared del fondo, techo, pasamanos con las agarraderas volteadas por la curva */
      wash(-70,-70,940,740,'#f6e3b4','#ecd29a');
      rr(-70,94,940,36,0,'#d9dce6',0);line([[-70,130],[870,130]],4,INK);txt('LA PUERTA NO TIENE SEGURO  ·  EL BUS TAMPOCO',296,112,13,INK,0,true);
      line([[-70,152],[596,152]],8,'#c4cad6');
      for(let i=0;i<5;i++){const x=64+i*118,sw=lean*16+Math.sin(now*3+i)*3;line([[x,152],[x+sw,180]],4,'#3b3550');line(closeP(ellP(x+sw,192,10,12,10)),4,'#ffd23f');}
      rr(-70,FY,940,150,0,'#9b95b8',0);line([[-70,FY],[870,FY]],5,INK);for(let i=0;i<9;i++)rr(i*95-10,FY+9,56,5,2,'#857fa3',0);
      /* vidrio de atrás */
      rr(20,166,236,130,12,'#5a4a78',4.5);ctx.save();path(rrP(27,173,222,116,8));ctx.clip();calle(138,236);ctx.restore();
      /* la puerta de atrás: bisagra a la derecha, el borde suelto se va con la curva */
      rr(600,138,204,FY-130,10,'#2d2640',4.5);
      ctx.save();path(rrP(612,148,180,FY-148,6));ctx.clip();calle(VX,VY,fuera);ctx.restore();
      const lw=180*(1-.88*Math.pow(op,.7)),fx=792-lw,hx=fx+15,hy=AY-20;
      poly([[fx,150+op*26],[792,150],[792,FY-2],[fx,FY-2-op*12]],'#ff6b3d',4.5);
      if(lw>44){poly([[fx+12,188+op*22],[780,186],[780,250],[fx+12,250+op*3]],'#bfe9ff',3.5);line([[fx+22,240],[fx+40,202]],3,'#ffffff');}
      if(lw>96){const fs=clamp((lw-40)/6.6,8,15);rr(fx+16,356,lw-32,56,6,'#ffd23f',3.5);txt('NO SE',fx+lw/2,374,fs,INK,0,true);txt('RECUESTE',fx+lw/2,394,fs,INK,0,true);}
      ell(hx,hy,10,10,'#c4cad6',3.5);
      rr(600,FY-6,204,14,4,'#ffd23f',3.5);rr(632,98,140,30,8,'#c4283a',3.5);txt('SALIDA',702,114,15,'#ffffff',0,true);
      /* la cabulla, del tubo a la manilla (pasa por detrás de la doña) */
      if(!lose){const sg=win?0:5+slack*48,pts=[];for(let i=0;i<=10;i++){const u=i/10;pts.push([lerp(PX+13,hx,u),lerp(AY,hy,u)+Math.sin(u*PI)*sg+(op>.7&&!win?Math.sin(now*50+i)*1.6:0)]);}soga(pts);ell(hx,hy,7,7,ROPE,3);}
      /* el asiento largo del fondo */
      rr(12,FY-132,588,74,18,'#3fa0ff',4);rr(24,FY-122,564,13,6,'#6fbcff',0);rr(6,FY-70,598,34,14,'#2f7fe0',4);rr(22,FY-36,572,36,0,'#2d2640',0);
      /* el señor del periódico: ni se entera (ni se inclina) */
      ctx.save();ctx.translate(120,FY-54);ctx.rotate(-ang);
      for(const sg of[-1,1]){ell(sg*20,2,24,13,'#3b3550',3.5);limb(sg*22,8,sg*24,40,16,'#3b3550',3.5);ell(sg*27,48,17,8,'#14101c',3.5);}
      ell(0,-134,30,20,'#14101c',4);rr(-60,-132,120,114,4,'#f4f0e6',4);txt('EL CAOS',0,-113,18,INK,0,true);line([[-50,-100],[50,-100]],2.5,INK);
      txt(rare?'SE BUSCA GALLINA':'TODO NORMAL',0,-88,rare?9:11,INK,0,true);rr(-48,-76,42,46,2,'#d9dce6',2.5);hen(-30,-48,.3,1);for(let i=0;i<5;i++)line([[4,-72+i*10],[48,-72+i*10]],2.5,'#8f8fa8');
      for(const sg of[-1,1])ell(sg*60,-68,8,13,'#c98a5a',3);
      ctx.restore();
      /* la doña: se va rodando hacia la puerta, cada vez más alarmada */
      const pan=op>.55&&!g.result,drot=win?Math.sin(e*7)*.05*Math.max(0,1-e):lose?(glare?.04:.22):lean*.05+op*.13+(op>.7?Math.sin(now*38)*.02:0);
      bust(Object.assign({},DONA,{x:sx,y:DY,s:DS,rot:drot,
        mood:win?'happy':lose?(glare?'angry':'yell'):op>.8?'yell':op>.55?'panic':op>.3?'o':op<.1&&loops?'smile':'worry',
        talk:(lose&&!glare)||(!g.result&&op>.8)?Math.abs(Math.sin(now*18)):0,look:win||glare?-1:1,sweat:g.result?0:op>.5?2:1,vein:glare?1:0,
        arms:win?[{side:-1,a:-2.5+Math.sin(now*9)*.25,len:66,w:19},{side:1,a:-.5,len:56,w:19}]
          :lose?(glare?[{side:-1,a:-.75,len:42,w:19},{side:1,a:.75,len:42,w:19}]:[{side:-1,a:-.9,len:86,w:19},{side:1,a:1.8+Math.sin(now*24)*.15,len:80,w:19}])
          :[{side:-1,a:-1.05-op*.2,len:60+op*18,w:19},pan?{side:1,a:2.3+Math.sin(now*22)*.4,len:70,w:19}:{side:1,a:-.5,len:56,w:19}]}));
      const lx=sx-drot*70;ell(lx,FY-56,54,21,DONA.shirt,4);
      for(const sg of[-1,1]){const kk=pan?Math.sin(now*20+sg)*5:0;limb(lx+sg*20,FY-44,lx+sg*22+kk,FY-18,17,DONA.skin,3.5);ell(lx+sg*26+kk,FY-11,17,9,'#7a1e2a',3.5);}
      if(!lose)cartera(lx+2+(g.result?0:op*8),DY+52-(pan?Math.abs(Math.sin(now*24))*5:0),drot*1.5,1.15);
      else if(e<.34){const u=e/.34;cartera(lerp(lx+10,P0[0],u),lerp(DY+52,P0[1]-18,u)-Math.sin(u*PI)*70,(u-1)*4,1.15-.15*u);}
      /* la gallina: a punto de irse también */
      if(win){const u=ease(clamp((e-.3)/.4,0,1));gallina(lerp(hx0,lx+6,u),lerp(hy0,DY+20,u)-Math.sin(u*PI)*60,.6,(1-u)*.3);}
      else if(lose){const u=ease(clamp((e-.04)/.3,0,1));gallina(lerp(hx0,sx+6,u),lerp(hy0,DY-132,u)-Math.sin(u*PI)*40,.55,Math.sin(now*30)*.08);}
      else{const h=henXY();gallina(h[0],h[1],.58,op*.35*Math.sin(now*20));}
      /* el tubo y la cabulla */
      pole(PX,132,FY+14);ell(PX,FY+16,24,9,'#8f8fa8',3.5);
      if(lose){/* se soltó: la cabulla da el latigazo y queda guindando */const th=PI/2*(1-Math.exp(-e*5)*Math.cos(e*14)),c=Math.cos(th),s=Math.sin(th),pts=[];
        for(let i=0;i<=9;i++){const u=i/9,wv=Math.sin(u*9-e*26)*16*u*Math.exp(-e*2.5);pts.push([PX+13+c*170*u-s*wv,AY+s*170*u+c*wv]);}soga(pts);}
      const rollo=()=>{rr(PX-17,AY-8,34,15,7,ROPE,3.5);
        for(let i=0;i<loops;i++){const y=AY+14*(i+1),pz=i===loops-1?pop*5:0;rr(PX-22-pz,y-8-pz/2,44+pz*2,16+pz,8,ROPE,4);line([[PX-13,y-3],[PX+10,y-4]],2.5,ROPE2);}};
      if(!g.result){
        /* la guía: por aquí se le da vueltas */
        ctx.save();ctx.globalAlpha=.3;line(closeP(ellP(PX,CY,R,R,30)),13,INK);ctx.globalAlpha=.9;line(closeP(ellP(PX,CY,R,R,30)),7,'#ffffff');ctx.restore();
        if(fr>.02)line(arcPts(PX,CY,R,-PI/2,-PI/2+dir*TAU*fr,Math.max(2,Math.ceil(fr*28))),12,'#5cff7a');
        const z=touched?1.15:1.25+.25*Math.sin(now*10);
        for(let i=0;i<6;i++){const a=i*TAU/6+dir*now*1.8,c=Math.cos(a),s=Math.sin(a),cx=PX+c*R,cy=CY+s*R,tx=-s*dir*z,ty=c*dir*z;
          poly([[cx+tx*15,cy+ty*15],[cx-tx*9+c*12*z,cy-ty*9+s*12*z],[cx-tx*9-c*12*z,cy-ty*9-s*12*z]],'#ffe14d',3.5);}
        for(let i=0;i<N;i++)ell(PX+(i-(N-1)/2)*28,CY-R-28,10,10,i<loops?'#5cff7a':'#fff3c4',3.5);
        rollo();const mx=PX+Math.cos(hs)*hrS,my=CY+Math.sin(hs)*hrS;soga([[PX,AY+14*loops+2],[mx,my]],5);puno(mx,my,hs-PI/2);
        if(!touched)tag(PX+Math.cos(hs)*(hrS+68),CY+Math.sin(hs)*(hrS+68));}
      else{rollo();const my=FY-150-(win?Math.abs(Math.sin(e*9))*16*Math.max(0,1-e*.6):0);puno(PX-104,my,win?0:.25,win);tag(PX-104,my+70);
        if(lose)ell(PX-76,my-26,5,8,'#9fe3ff',2.5);
        if(win){lazo(PX+2,AY+14*N+14,ease(clamp(e/.18,0,1))*(1+.5*Math.max(0,1-e*5)));for(let i=0;i<3;i++){const a=now*4+i*TAU/3;txt('✦',PX+Math.cos(a)*64,AY+14*N+12+Math.sin(a)*40,20,'#ffe14d');}}}
      /* lo que se dice */
      if(!g.result&&g.t<1.15/rs)bubble(506,214,'¡MIJO, LA PUERTA!',20,sx-6,DY-112);
      if(win&&e>.25)bubble(524,214,'¡DIOS TE LO PAGUE, MIJO!',19,sx-8,DY-112);
      if(lose&&e>.2)bubble(glare?446:486,214,glare?'¡ERA DE CUERO!':'¡MI CARTERA!',glare?22:26,glare?sx-46:sx-4,glare?DY-84:DY-112);
      ctx.restore();
      if(!g.result&&op>.72&&Math.sin(now*22)>-.3)txt('¡SE SALE!',700+Math.sin(now*60)*3,196,30,'#ff4d5e',-.06);
      drawP();
    }};
  return g;
}

BUS.add('amarrala',{name:'¡AMÁRRALA!',mk:mkAmarrala,card:'LA CABULLA',num:'50'});
})();
