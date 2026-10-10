'use strict';
/* MiniCaos · laboratorio de estilos: ¡MÉTELE! (el pique de camioneticas).
   Vista de lado: tu camionetica va detrás de la rival, que te echa humo negro en la cara. El tacómetro sube y hay que tocar
   JUSTO cuando la aguja entra al rojo para meter el cambio; cada cambio te adelanta. Muy pronto = raspas la caja (¡RRRAC!);
   si la aguja llega al tope, el motor tose (¡PUM!).
   Nivel 1: 2 cambios y perdona un error. Nivel 2: 3 cambios, ni un error. Nivel 3: 3 cambios más rápidos y el rojo más angosto.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.pique)return;
const LV=BUS.LV,CONF=BUS.CONF,tag=BUS.tag,PI=Math.PI,SOOT='#1c1822';
/* La Cucaracha en corneta de aire: sol-sol-sol-DO-MI, dos veces. [segundo, hz, duración] */
const CUCA=[];for(let r=0;r<2;r++)[[0,392,.1],[.115,392,.1],[.23,392,.1],[.345,523.25,.28],[.655,659.25,.34]].forEach(([t,f,d])=>CUCA.push([.1+r*1.06+t,f,d]));
const toot=(f,d)=>{snd(f,d*1.8,'sawtooth',.055);snd(f*1.013,d*1.8,'sawtooth',.045);snd(f/2,d*1.5,'square',.02);};
const pop=(s,x,y,col,r=26)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life:.75,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
const CH_ME={skin:'#c98a5a',shirt:'#fffdf2',pat:'tank',cap:'#ffd23f',hairCol:'#14101c',stache:1,brow:'thick',cheeks:1},
  CH_RV={skin:'#b87b50',shirt:'#2b2b3a',hair:'slick',hairCol:'#14101c',goatee:1,chain:1,gold:1,teeth:1,brow:'thick',earring:1};
const LEV=[[-14,-16],[-14,16],[14,-16],[14,16]];
/* una mano marcada en el hollín */
function huella(x,y,rot,s){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);ell(0,8,21,22,'#4a4560',0);limb(-17,8,-36,-8,11,'#4a4560',0);
  for(let i=0;i<4;i++)limb(-13+i*9,-8,-18+i*12,-40+Math.abs(i-1.5)*7,9,'#4a4560',0);ctx.restore();}

/* la camionetica clásica de PARADA, más corta y con el chofer sacando la cabeza. (x, yb) = esquina trasera, a ras de piso.
   o: {name, pas:[caras], pm(i,cara)→ajustes, ch: chofer, L: sacudón, rot, horn: pulso de la corneta (o null), look} */
function camioneta(x,yb,s,col,o){const L=o.L||0;
  ctx.save();ctx.translate(x,yb-56*s);ctx.scale(s,s);ctx.translate(110,10);ctx.rotate(o.rot||0);ctx.translate(-110,-10+Math.sin(now*34+x*.1)*1.6);
  /* techo: sacos y cornetas */
  for(const[sx,r]of o.horn!=null?[[66,26],[128,31]]:[[84,28],[150,32],[222,26]]){ell(sx-L*12,-318,r,r*.62,'#e8d7a8',4);line([[sx-L*12-r*.5,-322],[sx-L*12+r*.5,-322]],2.5,'#a98a4a');}
  if(o.horn!=null){const k=1+o.horn*.6;for(const[hx,hy,hl]of[[188,-313,104],[206,-336,74]]){limb(hx,hy,hx+hl,hy,11,'#c9ced6',3);poly([[hx+hl-4,hy],[hx+hl+30*k,hy-15*k],[hx+hl+30*k,hy+15*k]],'#ffd23f',3);}}
  rr(-24,-28,34,12,5,'#8f8fa8',3);
  /* carrocería */
  rr(0,-302,520,302,38,col,5);rr(0,-302,520,34,26,'#fff3c4',4);
  rr(0,-86,520,40,0,'#ffd23f',0);rr(0,-46,520,14,0,'#2f7fe0',0);line([[0,-86],[520,-86]],4,INK);line([[0,-32],[520,-32]],4,INK);
  for(let i=0;i<5;i++)poly([[352+i*30,0],[366+i*30,-56],[380+i*30,0]],i%2?'#ffd23f':'#ff3b4e',2.5);
  txt(o.name,214,-66,26,INK,0,true);rr(-4,-124,10,30,4,'#ff3b4e',2.5);
  for(let i=0;i<6;i++)poly([[14+i*58,-268],[44+i*58,-268],[29+i*58,-252]],['#ff3b4e','#ffd23f','#3fa0ff','#5cff7a'][i%4],2);
  /* ventanas con pasajeros: se van para atrás con cada cambio */
  o.pas.forEach((f,i)=>{const wx=20+i*106;
    ctx.save();path(rrP(wx,-244,94,128,10));ctx.clip();ctx.fillStyle=STY[style].col('#5a4a78');ctx.fillRect(wx,-244,94,128);
    bust(Object.assign({},f,{x:wx+47-L*18,y:-122,s:.78,th:50,bw:50,rot:-L*.4,look:o.look||0,cheeks:1},o.pm?o.pm(i,f):null));
    ctx.restore();line(closeP(rrP(wx,-244,94,128,10)),6,'#c9ced6');});
  /* el chofer saca la cabeza por su ventana */
  rr(344,-254,152,142,14,'#5a4a78',4.5);rr(350,-248,140,130,10,'#9fdcff',0);line(closeP(rrP(344,-254,152,142,14)),6,'#c9ced6');
  ctx.save();path([[-300,-800],[900,-800],[900,-112],[-300,-112]]);ctx.clip();
  bust(Object.assign({x:420-L*10,y:-146,s:1.3,th:60,bw:56,hw:44,hh:43,rot:-L*.25},o.ch));
  ctx.restore();line([[340,-112],[500,-112]],7,'#c9ced6');
  /* retrovisor, faro, parachoques, ruedas */
  rr(508,-226,22,40,6,'#c9ced6',3.5);ell(510,-74,9,12,'#fff3a8',3);rr(490,-44,48,26,8,'#c9ced6',3.5);
  for(const wx of[110,410]){ell(wx,2,62,52,col,4.5);ell(wx,10,46,46,'#14101c',3);ell(wx,10,19,19,'#c9ced6',3);
    for(let i=0;i<5;i++){const a=now*14+i*TAU/5;line([[wx+Math.cos(a)*6,10+Math.sin(a)*6],[wx+Math.cos(a)*16,10+Math.sin(a)*16]],3,'#7a7f92');}}
  ctx.restore();}

/* ═════════ ¡MÉTELE! (la chancleta): mete el cambio cuando la aguja toca el rojo ═════════ */
function mkPique(){
  const rs=Math.sqrt(SP),lv=LV(),N=lv===1?2:3,Z0=[.76,.8,.83][lv-1],S0=.18,MISS=lv===1?1:0,LEAD=.3/rs,CX=400,CY=556,MS=.58,MY=424,RS=.5,RY=322;
  const blobs=[];for(let i=0;i<15;i++)blobs.push({x:80+(i%5)*160+(Math.random()-.5)*90,y:150+Math.floor(i/5)*150+(Math.random()-.5)*80,r:74+Math.random()*40,sx:(Math.random()<.5?-1:1)*(.85+Math.random()*.3)});
  const smk=[],puff=(x,y,vx,vy,r,life,gr)=>smk.push({x,y,vx,vy,r,life,gr,t:0});
  let p0=0,v=S0,gear=1,shifts=0,miss=0,ph='rise',stall=0,lock=0,p=0,pT=0,kick=0,sT=9,stomp=0,grind=0,hp=0,dropT=9,vFrom=S0,scroll=0,eng=0,emit=0,ni=0,cofN=-1,lx=-14,ly=-16,jet=false;
  /* cada cambio sube más rápido que el anterior; el rojo va de Z0 hasta el tope de la esfera */
  const TR=()=>(1.05-.1*Math.min(shifts,N-1))/rs,rate=()=>(Z0-S0)/TR(),ang=u=>PI*(1+clamp(u,0,1));
  /* dónde va cada bus: p=0 la rival adelante, p≈.5 parejos, p>1 ya la pasaste. Si pierdes, la rival se te atraviesa */
  const geo=()=>{const lose=g.result==='lose',e=g.endT,cut=lose?ease(clamp(e/.4,0,1)):0,gone=lose?Math.max(0,e-1.05):0,xm=20+260*p+kick*14-cut*26;
    return{xm,cut,xr:lerp(470-330*p,Math.min(xm+336,486),cut)+gone*gone*900,yr:lerp(RY,MY,cut),sr:lerp(RS,MS,cut)};};
  function fail(){g.result='lose';g.why='¡AHUMADO!';sfx.lose();sfx.screech();}
  function bad(late){miss++;grind=1;
    if(late){pop('¡PUM!',CX,408,'#ff4d5e');sfx.crash();const q=geo();for(let i=0;i<7;i++)puff(q.xm-14,MY-78*MS,-(60+Math.random()*160),-(20+Math.random()*90),10,.8,40);}
    else{pop('¡RRRAC!',CX,408,'#ff4d5e');nz(.3,.2);snd(95,.3,'sawtooth',.09,-30);snd(130,.12,'square',.05);}
    if(miss>MISS)fail();else{ph='stall';stall=.38/rs;pT-=.08;}}
  const g={get impact(){return Math.max(kick,this.result?clamp(1-this.endT/.5,0,1):0);},
    probe:()=>({v,z0:Z0,gear,shifts,need:N,miss,maxMiss:MISS,ph,lock,lead:LEAD,rate:rate(),eta:(Z0-v)/rate(),win:(1-Z0)/rate(),inRed:ph==='rise'&&v>=Z0,p,pT}),
    t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡MÉTELE!',
    hint:'TOCA (o ESPACIO) justo cuando la aguja entre al ROJO',
    /* con la aguja todavía abajo (arrancando o recién metido el cambio) el toque no cuenta: perdona el doble toque */
    press(){if(g.result||g.t<LEAD||lock>0||ph!=='rise'||v<S0+.09)return;
      if(v<Z0){bad(false);return;}
      shifts++;gear++;kick=1;sT=0;stomp=1;lock=.16/rs;vFrom=v;dropT=0;v=S0;pT=.55*shifts/N-miss*.08;
      pop('¡'+gear+'ª!',CX,408,'#5cff7a',30);nz(.06,.18);snd(200+gear*70,.14,'square',.06,260);
      if(shifts>=N){g.result='win';g.why='¡LO PASASTE!';p0=p;spawn(geo().xm+170,300,24,'conf',CONF);}},
    down(){g.press('any');},
    update(dt){g.t+=dt;sT+=dt;dropT+=dt;lock-=dt;kick=Math.max(0,kick-dt*3);stomp=Math.max(0,stomp-dt*4.5);grind=Math.max(0,grind-dt*2.4);hp=Math.max(0,hp-dt*5);
      const win=g.result==='win',lose=g.result==='lose',T=LEV[(gear-1)%4],u=Math.min(1,dt*20);lx=lerp(lx,T[0],u);ly=lerp(ly,T[1],u);
      if(!win)p+=(pT-p)*Math.min(1,dt*6);scroll+=(240+gear*80+v*140)*dt*(lose?Math.max(.3,1-g.endT*.8):1);
      if(!g.result){
        if(ph==='stall'){v=Math.max(S0,v-2.6*dt);if((stall-=dt)<=0){ph='rise';v=S0;}}
        else if(g.t>=LEAD){v+=rate()*dt;if(v>=1){v=1;bad(true);}}
        if((eng-=dt)<=0){eng=.07;snd(58+gear*12+v*150,.09,v>=Z0?'square':'sawtooth',.018);}
        if((emit-=dt)<=0){emit=.04;const q=geo();puff(q.xr-24*RS,RY-78*RS,-(150+Math.random()*110),-(10+Math.random()*60),10,.95,42);}
        if(!g.result&&g.t>=g.dur)fail();}
      else{g.endT+=dt;const e=g.endT;if(win)p=lerp(p0,1.38,ease(clamp(e/1.4,0,1)));const q=geo();
        if(win){v+=(.5-v)*Math.min(1,dt*2);
          /* la corneta: cada nota cae en su pulso */
          while(ni<CUCA.length&&e>=CUCA[ni][0]){toot(CUCA[ni][1],CUCA[ni][2]);hp=1;ni++;PT.push({x:q.xm+196,y:196,vx:50+Math.random()*70,vy:-80,g:0,t:0,life:.8,kind:'♪',col:'#ffffff',r:6,rot:(Math.random()-.5)*.6,vr:0});}
          /* ahora el humo es para ella */
          const tx=q.xr+420*RS,ty=RY-285*RS,ex=q.xm-24*MS,ey=MY-78*MS;
          if(e<1.9&&ex>tx+10&&(emit-=dt)<=0){emit=.05;const d=Math.hypot(tx-ex,ty-ey),sp=d/.5;puff(ex,ey,(tx-ex)/d*sp+(Math.random()-.5)*60,(ty-ey)/d*sp+(Math.random()-.5)*60,8,.55,34);}}
        else{v=Math.max(0,v-dt*2);
          if(e>.3&&e<.95){if(!jet){jet=true;nz(.7,.16);snd(64,.7,'sawtooth',.08,-20);}
            if((emit-=dt)<=0){emit=.03;puff(q.xr-24*q.sr,q.yr-78*q.sr,-(260+Math.random()*260),-(50+Math.random()*170),15,.7,110);}}
          const c=Math.floor((e-1)/.36);if(e>=1&&c>cofN){cofN=c;snd(175,.09,'square',.06,-70);nz(.08,.1);PT.push({x:246+(c%2)*96,y:410-(c%2)*34,vx:0,vy:-50,g:0,t:0,life:.45,kind:'¡COF!',col:'#ffffff',r:4,rot:(c%2?.12:-.1),vr:0});}}}
      for(let i=smk.length-1;i>=0;i--){const s=smk[i];s.t+=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=Math.exp(-1.2*dt);if(s.t>s.life)smk.splice(i,1);}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,inRed=!g.result&&ph==='rise'&&v>=Z0,q=geo(),xm=q.xm,xr=q.xr;
      const L=(shifts?(1-Math.exp(-sT*25))*Math.exp(-2.6*sT)*Math.cos(sT*6):0)+grind*Math.sin(now*55)*.18;
      const sh=lose&&e>.3&&e<1?1:grind>.4?.5:0;
      ctx.save();if(sh)ctx.translate(Math.sin(now*61)*3*sh,Math.cos(now*53)*2*sh);
      /* cielo, edificios y calle */
      wash(0,0,800,270,'#8fd8ff','#e8f8ff');ell(716,118,24,24,'#ffe14d',0);
      const bo=-(scroll*.12%900);
      for(let k=0;k<2;k++)[[0,150,120,'#ffb36b'],[130,118,110,'#a9a0ff'],[250,168,150,'#ff9ec7'],[410,134,120,'#6ecf8f'],[540,176,140,'#ffd23f'],[690,144,200,'#8aa0ff']].forEach(([x,y,w,c])=>{const bx=bo+k*900+x;if(bx>800||bx+w<0)return;
        rr(bx,y,w,264-y,6,c,3.5);for(let i=0;i<3;i++)rr(bx+12+i*(w/3.4),y+16,w/5,20,4,'#ffffff',2.5);});
      /* la gallina con capa, que los pasa a los dos */
      const hx=-70+g.t/g.dur*1150,hy=106+Math.sin(now*7)*5,fl=Math.sin(now*24)*7;
      poly([[hx-6,hy-10],[hx-52,hy-16+fl],[hx-46,hy+8+fl]],'#c4283a',3);hen(hx,hy,.5,1);
      rr(0,264,800,170,0,'#4d4a6e',0);rr(0,256,800,10,0,'#d8d2c4',0);
      for(let i=0;i<6;i++)rr(((i*170-scroll)%1020+1020)%1020-90,338,80,7,3,'#ffe14d',0);
      for(let i=0;i<5;i++)rr(((i*190-scroll*2.2)%950+950)%950-80,[282,300,362,380,410][i],60,4,2,'#6f6790',0);
      /* los dos buses */
      const sooty=win&&e>1.45,far=shifts>=N-1&&shifts>0;
      const rival=()=>camioneta(xr,q.yr,q.sr,'#8a5fd6',{name:'EL RAYO',pas:[FACES[8],FACES[6],FACES[0]],look:win?1:-1,rot:lose?-.02*q.cut:0,
        pm:i=>win&&e>.25?{mood:i%2?'o':'panic'}:lose?{mood:'grin'}:null,
        ch:Object.assign({},CH_RV,win?{look:1,mood:sooty?'dizzy':'panic',sweat:2,skin:sooty?mix(CH_RV.skin,SOOT,.72):CH_RV.skin,arms:[{side:-1,a:-2.6,len:60,w:22},{side:1,a:2.6,len:60,w:22}]}
          :{look:-1,mood:lose?'grin':sT<.45&&shifts?'o':far?'worry':'grin',talk:lose||!shifts?Math.abs(Math.sin(now*11)):0,sweat:shifts&&!lose?1:0,arms:[{side:-1,a:-2.5+Math.sin(now*9)*.35,len:60,w:22}]})});
      if(q.cut<.5)rival();
      camioneta(xm,MY,MS,'#ff6b3d',{name:'LA CONSENTIDA',pas:[FACES[2],FACES[4],FACES[9]],L,look:1,horn:hp,rot:-L*.035+(lose?.03*q.cut:0),
        pm:(i,f)=>i?{mood:win?'happy':lose?'panic':Math.abs(L)>.25?(i%2?'yell':'panic'):inRed?'worry':f.mood,sweat:inRed||lose?1:0,talk:Math.abs(L)}:{sweat:0},
        ch:Object.assign({},CH_ME,{look:win?-1:1,mood:win?(e<.5?'grin':'happy'):lose||ph==='stall'?'panic':sT<.4&&shifts?'grin':inRed?'yell':'angry',talk:inRed?Math.abs(Math.sin(now*20)):0,
          lids:!g.result&&!inRed&&sT>.4&&ph==='rise'?1:0,sweat:win?0:inRed?2:1,vein:inRed?1:0,arms:win?[{side:-1,a:-2.5+Math.sin(now*12)*.4,len:62,w:22}]:[{side:1,a:1.25,len:58,w:22}]})});
      if(!g.result)tag(xm+86,178);
      if(q.cut>=.5)rival();
      /* humo negro */
      for(const s of smk){const r=s.r+s.gr*s.t;ctx.save();ctx.globalAlpha=clamp((1-s.t/s.life)*1.5,0,.88);ell(s.x,s.y,r,r*.85,SOOT,0);ctx.restore();}
      ctx.restore();
      /* tablero: el pie con la chancleta, el tacómetro y la palanca */
      rr(0,434,800,142,0,'#2d2640',0);line([[0,434],[800,434]],5,INK);line([[0,576],[800,576]],4,INK);
      const lift=Math.sin(stomp*PI)*24,dip=g.result?0:(v-S0)*8;
      ctx.save();path([[0,437],[800,437],[800,574],[0,574]]);ctx.clip();
      ctx.save();ctx.translate(104,522+dip);ctx.rotate(-.5);ctx.scale(1.3,1.3);limb(34,22,52,52,10,'#5a5274',3);rr(-4,16,66,11,4,'#8f8fa8',3.5);ctx.restore();
      ctx.save();ctx.translate(104,522+dip-lift);ctx.rotate(-.5-lift*.012);ctx.scale(1.3,1.3);
      limb(-24,-14,-12,-96,34,'#2f3a7a',4);rr(-48,2,100,13,6,'#2f7fe0',3.5);ell(-2,-10,42,14,CH_ME.skin,3.5);ell(38,-9,10,9,CH_ME.skin,3);line([[-8,-23],[10,-14],[30,2]],7,'#ffffff');
      ctx.restore();ctx.restore();
      bubble(234,460,'LA CHANCLETA',13,172,490,'#ffd23f');
      /* tacómetro */
      const A0=ang(Z0),hot=inRed&&Math.sin(now*40)>0;
      poly(arcPts(CX,CY,128,PI,TAU,24).concat([[CX+128,CY+16],[CX-128,CY+16]]),hot?'#fff3a8':'#fff8e0',5);
      poly(arcPts(CX,CY,123,A0,TAU,8).concat(arcPts(CX,CY,78,TAU,A0,8)),hot?'#ffe14d':'#ff3b4e',3.5);
      line(arcPts(CX,CY,119,PI,A0,18),6,'#2d2640');
      for(let i=0;i<=8;i++){const a=ang(i/8),c=Math.cos(a),s=Math.sin(a);line([[CX+c*104,CY+s*104],[CX+c*120,CY+s*120]],4,INK);txt(''+i,CX+c*90,CY+s*90-(i%8?0:8),15,INK,0,true);}
      txt('RPM x1000',CX,CY-36,12,INK,0,true);
      const vv=dropT<.1?lerp(vFrom,v,ease(dropT/.1)):v,na=ang(vv)+(v>=1||grind>.3?Math.sin(now*70)*.05:g.result?0:Math.sin(now*43)*.008),nc=Math.cos(na),ns=Math.sin(na);
      poly([[CX+nc*114,CY+ns*114],[CX-ns*8-nc*18,CY+nc*8-ns*18],[CX+ns*8-nc*18,CY-nc*8-ns*18]],'#2d2640',3);ell(CX,CY,14,14,'#c4283a',3.5);
      /* el cambio en que vas + la palanca */
      rr(566,448,112,88,12,'#14101c',4);
      ctx.save();ctx.translate(622,490);ctx.scale(1+kick*.35,1+kick*.35);txt(gear+'ª',0,0,56,'#ffe14d');ctx.restore();
      for(let i=0;i<=N;i++)ell(622+(i-N/2)*24,555,7,7,i<gear?'#5cff7a':'#5a5274',3);
      const gj=grind>.3?Math.sin(now*60)*4:0;ell(730,558,34,10,'#14101c',3);line([[730,554],[730+lx+gj,496+ly]],9,'#c9ced6');ell(730+lx+gj,496+ly,17,17,'#c4283a',3.5);
      ell(774,456,9,9,miss?(Math.sin(now*14)>0?'#ff3b4e':'#a8283a'):'#5a5274',3);
      /* perdiste: la pantalla queda tiznada y tu chofer, tosiendo */
      if(lose&&e>.45){for(const b of blobs){const k=ease(clamp((e-.45-Math.hypot(b.x-xm-250,b.y-290)/1300)/.3,0,1));if(k>0){ell(b.x,b.y,b.r*k,b.r*.78*k,SOOT,0);ell(b.x+b.r*b.sx*k,b.y-b.r*.62*k,b.r*.24*k,b.r*.2*k,SOOT,0);ell(b.x-b.r*b.sx*.8*k,b.y+b.r*.7*k,b.r*.16*k,b.r*.14*k,SOOT,0);}}
        if(e>1){huella(640,190,.3,2.1);huella(560,470,-.35,1.8);}
        if(e>.85){
          const c=((e-1)/.36)%1,cof=e>=1&&c<.45,up=ease(clamp((e-.85)/.2,0,1));
          bust(Object.assign({},CH_ME,{x:150,y:556+(1-up)*220-(cof?Math.sin(c/.45*PI)*12:0),s:1.15,skin:mix(CH_ME.skin,SOOT,.74),shirt:'#6f6790',cap:'#5a5274',cheeks:0,hw:44,hh:43,bw:56,
            mood:cof?'yell':'o',talk:cof?1:0,rot:cof?.08:-.03,arms:[{side:1,a:2.3,len:64,w:22}]}));}}
      if(lose&&e>.12&&e<.95)bubble(clamp(xr+150,180,620),128,'¡CHAO, PESCAO!',22,xr+420*q.sr,q.yr-360*q.sr);
      if(win&&e>.35)bubble(clamp(xm+150,180,620),128,'¡CHAO, PESCAO!',22,xm+420*MS-30,MY-356*MS);
      drawP();
    }};
  return g;
}
BUS.add('pique',{name:'¡MÉTELE!',mk:mkPique,card:'EL PIQUE',num:'27'});
})();
