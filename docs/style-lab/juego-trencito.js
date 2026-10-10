'use strict';
/* MiniCaos · laboratorio de estilos: ¡AGARRA LA CINTURA! (el trencito de la Hora Loca).
   Empezó la hora loca: pitos, collares hawaianos y bombas. La familia entera va en fila india por toda la casa (vista desde
   arriba, el piso corre hacia abajo) y tú vas de TERCERO. El de adelante sabe por dónde pasar: la fila culebrea esquivando
   la nevera, el mueble de la sala y el ventilador de pie, y tú tienes que seguirle el paso sin soltar la cintura.
   Mecánica: MANTENER apretado (dedo/ratón) = manos en la cintura; levantar el dedo más de 0,4 s = te quedas sin tren.
   Mientras aguantas, ARRASTRA a los lados para no llevarte nada por delante. Con teclado el agarre es de una vez: la
   primera tecla (← → o ESPACIO) te agarra y ya no te sueltas; las flechas solo mueven, y soltarlas es quedarse en el sitio.
   Las manos de toda la fila van de verdad a la cintura del de adelante y lo siguen aunque culebree.
   Niveles: 1 = tres estorbos anchos y lentos (centro, un lado, el otro: quedarse quieto en cualquier sitio pierde).
   2 = más rápido y un PASILLO estrecho entre corotos. 3 = cinco estorbos, pasillo más estrecho y el guía amaga una vez
   para el lado malo (el estorbo siempre se ve venir: mira el piso, no al guía).
   Ganas: el tren revienta hacia el patio, pitos y papelillo, y el ventilador se pega a la fila con su collar.
   Pierdes (choque): frenazo, dominó y toda la familia encima de las bolsas de basura. Pierdes (te soltaste): el tren sigue
   sin ti y la gallina agarra tu puesto.
   Teclado: ← → (o A/D) mueven; cualquiera de ellas, ESPACIO o ENTER agarra para toda la ronda. Listeners propios solo con gameId==='trencito'.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.trencito)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI;
const LEI=['#ff5c8a','#ffd23f','#5cff7a','#3fb0ff'],S=.5,FEET=85,PY=315,PYF=PY+FEET,GAPY=75,X0=130,X1=670;
const HWK={mue:88,nev:46,ven:40};
/* teclado sostenido (el laboratorio no avisa cuando se suelta una tecla) */
let kL=0,kR=0,kS=0,kG=0;
addEventListener('keydown',e=>{if(gameId!=='trencito')return;const c=e.code;if(c==='ArrowLeft'||c==='KeyA')kL=1;else if(c==='ArrowRight'||c==='KeyD')kR=1;else if(c==='Space'||c==='Enter')kS=1;else return;kG=1;});
addEventListener('keyup',e=>{const c=e.code;if(c==='ArrowLeft'||c==='KeyA')kL=0;else if(c==='ArrowRight'||c==='KeyD')kR=0;else if(c==='Space'||c==='Enter')kS=0;});
addEventListener('blur',()=>{kL=kR=kS=0;});

function collar(x,y,s){arcPts(x,y-2*s,36*s,.08*PI,.92*PI,7,1.5).forEach((q,i)=>ell(q[0],q[1],9*s,9*s,LEI[i%4],2));}
function mueble(x,y){rr(x-88,y-84,176,84,8,'#9b6a3c',4);rr(x-80,y-74,76,58,4,'#b98450',3);rr(x+4,y-74,76,58,4,'#b98450',3);ell(x-10,y-44,4,4,'#ffd23f',2);ell(x+10,y-44,4,4,'#ffd23f',2);
  ell(x-44,y-98,13,15,'#ffffff',3);ell(x-44,y-100,5,5,'#3fb0ff',0);rr(x+12,y-114,54,32,4,'#2d2640',3);rr(x+18,y-108,42,20,2,'#7fe0d0',0);}
function nevera(x,y){rr(x-46,y-150,92,150,10,'#eef2f6',4);line([[x-46,y-96],[x+46,y-96]],4,INK);rr(x+28,y-132,7,26,3,'#8f8fa8',2.5);rr(x+28,y-84,7,34,3,'#8f8fa8',2.5);
  ell(x-20,y-122,8,8,'#ff5c8a',2.5);rr(x-22,y-70,24,17,2,'#ffd23f',2.5);ell(x-2,y-30,6,6,'#5cff7a',2.5);}
function venti(x,y,lei){ell(x,y-6,34,10,'#5a5274',3.5);line([[x,y-8],[x,y-100]],8,'#8f8fa8');ell(x,y-128,40,40,'#d9dce6',4);
  for(let i=0;i<3;i++){const a=now*14+i*TAU/3;limb(x,y-128,x+Math.cos(a)*27,y-128+Math.sin(a)*27,12,'#3fb0ff',2.5);}ell(x,y-128,7,7,'#2d2640',0);
  if(lei)arcPts(x,y-96,24,.05*PI,.95*PI,6,1.2).forEach((q,i)=>ell(q[0],q[1],6,6,LEI[i%4],2));}
const PIEZA={mue:mueble,nev:nevera,ven:venti};
function bolsa(x,y,s){ell(x,y,46*s,34*s,'#2d2640',4);poly([[x-8*s,y-30*s],[x+8*s,y-30*s],[x+14*s,y-48*s],[x,y-40*s],[x-14*s,y-48*s]],'#2d2640',3.5);line([[x-18*s,y-6*s],[x-6*s,y+8*s]],3,'#5a5274');}

function mkTrencito(){
  const lv=LV(),rs=Math.sqrt(SP),n=[3,4,5][lv-1],V=250*rs,dur=5/rs,GW=[0,190,165][lv-1],LEAD=GAPY/V;
  /* ── los estorbos: centro, un lado, el otro (así no hay sitio donde quedarse quieto), y en 2 y 3 un pasillo y uno suelto ── */
  const lado=Math.random()<.5?-1:1,tipo=()=>Math.random()<.5?'mue':'nv';
  let ws=[{ox:400+(Math.random()-.5)*30,k:tipo()}];const resto=[{ox:400+lado*185,k:tipo()},{ox:400-lado*185,k:tipo()}];
  if(lv>=2)resto.push({ox:300+Math.random()*200,gap:true});
  if(lv>=3)resto.push({ox:240+Math.random()*320,k:Math.random()<.5?'nev':'ven'});
  while(resto.length)ws.push(resto.splice(Math.random()*resto.length|0,1)[0]);
  const t0=1.5,t1=5-.35;let prev=400;
  ws.forEach((w,i)=>{w.t=(t0+i*(t1-t0)/(n-1))/rs;w.parts=[];
    if(w.gap){w.G=GW;for(const sg of[-1,1]){let e=w.ox+sg*GW/2,j=sg<0?0:1;while(sg<0?e>70:e<730){const k=['mue','nev','ven'][j++%3],h=HWK[k];w.parts.push({k,x:e+sg*h});e+=sg*(2*h+4);}}w.sx=w.ox;}
    else{if(w.k==='nv'){w.hw=92;w.parts.push({k:'nev',x:w.ox-46},{k:'ven',x:w.ox+50});}else{w.hw=HWK[w.k]+2;w.parts.push({k:w.k,x:w.ox});}
      const m=w.hw+80;if(Math.abs(prev-w.ox)>=m)w.sx=prev;else{const a=w.ox-m,b=w.ox+m,okA=a>=X0,okB=b<=X1;w.sx=okA&&okB?(Math.abs(prev-w.ox)<8?(Math.random()<.5?a:b):prev<w.ox?a:b):okA?a:b;}}
    prev=w.sx;});
  /* nivel 3: el guía amaga una vez (en un tramo donde de verdad hay que moverse) */
  let fkI=-1;if(lv>=3){for(let i=1;i<n;i++)if(Math.abs(ws[i].sx-ws[i-1].sx)>60){fkI=i;break;}if(fkI<0)fkI=0;}
  const hits=(w,x)=>w.gap?Math.abs(x-w.ox)>w.G/2-20:Math.abs(x-w.ox)<w.hw+20;
  /* por dónde pasa la fila: el que va adelante lo recorre antes (tt = t + adelanto) */
  function ruta(tt,amago){let i=0;while(i<n&&tt>=ws[i].t)i++;if(i>=n)return ws[n-1].sx;
    const ta=i?ws[i-1].t:0,xa=i?ws[i-1].sx:400,u=clamp((tt-ta)/(ws[i].t-ta),0,1),late=i===fkI;
    let x=lerp(xa,ws[i].sx,ease(clamp((u-(late?.45:.1))/(late?.4:.55),0,1)));
    if(amago&&late)x-=Math.sign(ws[i].sx-xa||1)*100*Math.sin(PI*clamp(u/.45,0,1));return x;}
  const CAST=[FACES[8],FACES[4],null,FACES[7],FACES[1]];kG=0;
  /* brazos hasta los lados de la cintura del de adelante (en unidades del busto) */
  const cintura=(X,Y,ax,ay,bw)=>[1,-1].map(sd=>{const lx=(ax+sd*26-X)/S-sd*bw*.78,ly=(ay+32-Y)/S-4;return{side:sd,a:Math.atan2(lx,ly),len:clamp(Math.hypot(lx,ly),30,170),w:19};});
  let px=400,tx=400,pH=false,was=false,grabbed=false,loose=0,sc=0,beat=0,nb=0,ev=0,kind='',cw=null,q1=400,q2=400,px0=400,lx0=400,pitoT=.4,sg0=1;
  const g={lr:true,get impact(){return this.result==='lose'&&kind==='choque'?clamp(1-this.endT/.5,0,1):0;},
    probe:()=>{const w=ws.find(w=>!w.done)||ws[n-1];return{px,tx,safe:w.sx,next:w.t,hold:pH||!!kG,loose,kind,n,danger:hits(w,px)};},
    t:0,dur,result:null,why:'',endT:0,cmd:'¡AGARRA LA CINTURA!',hint:'MANTÉN apretado y ARRASTRA a los lados (teclado: ← →): ¡no choques!',
    press(){},
    down(p){pH=true;tx=clamp(p.x,X0,X1);},
    move(p){pH=true;tx=clamp(p.x,X0,X1);},
    up(){pH=false;},
    update(dt){g.t+=dt;
      if(!g.result){sc+=V*dt;
        if(kL||kR||kS)kG=1;const hold=pH||!!kG;
        if(kL||kR)tx=clamp(tx+(kR-kL)*620*rs*dt,X0,X1);
        if(hold&&!was){snd(660,.05,'square',.04,200);if(!grabbed)say('¡AGARRADO!',px,PY-96,'#5cff7a');grabbed=true;}if(!hold&&was)snd(300,.12,'sine',.05,-150);was=hold;
        if(hold){loose=0;px+=(tx-px)*Math.min(1,dt*16);}else if(grabbed)loose+=dt;
        q1+=(px-q1)*Math.min(1,dt*9);q2+=(q1-q2)*Math.min(1,dt*9);
        /* la conga: un-dos-tres ¡pum! y el pito del guía */
        if((beat-=dt)<=0){beat=.22/rs;const b=nb++%8;if(b<3||b===6)snd(b===6?120:190+b*30,.07,'triangle',.06);if(b===6)nz(.05,.05);}
        if((pitoT-=dt)<=0){pitoT=1.1/rs;snd(1900,.09,'square',.03);snd(2100,.12,'square',.025);say('¡PÍÍ!',ruta(g.t+2*LEAD,1)+50,PY-2*GAPY-60,'#ffffff');}
        for(const w of ws)if(!w.done&&g.t>=w.t){w.done=true;
          if(hits(w,px)){cw=w;kind='choque';g.result='lose';g.why='¡DOMINÓ!';sfx.crash();sfx.lose();spawn(px,PY-20,12,'★',['#ffe14d'],260,500,.8);break;}
          else{snd(880,.05,'sine',.04,300);say(['¡UFF!','¡EPA!','¡POR POQUITO!'][Math.random()*3|0],px,PY-90,'#5cff7a');}}
        if(!g.result&&((grabbed&&loose>.4)||(!grabbed&&g.t>1.4/rs))){kind='suelto';g.result='lose';g.why='¡TE SOLTASTE!';px0=px;lx0=ruta(g.t+2*LEAD,0);sg0=px<400?1:-1;sfx.whoosh();sfx.lose();}
        if(!g.result&&g.t>=dur){g.result='win';g.why='¡AL PATIO!';lx0=ruta(g.t+2*LEAD,0);sfx.win();spawn(400,260,34,'conf',CONF,380);spawn(px,PY-40,16,'conf',LEI);
          for(let i=0;i<4;i++)setTimeout(()=>{snd(1900+i%2*250,.1,'square',.035);},200+i*170);}}
      else{g.endT+=dt;const e=g.endT;
        if(kind!=='choque')sc+=V*dt*(g.result==='win'?.6:1);
        if(kind==='choque')for(;ev<5&&e>=.12+ev*.1;ev++){sfx.thud();spawn(260+ev*70,470,3,'bit',['#2d2640','#5a5274'],160,500,.6);}
        if(kind==='choque'&&ev===5&&e>=.95){ev=6;sfx.cluck();spawn(400,400,5,'feather',['#f1ece2'],160,300,.9);}
        if(kind==='suelto'&&ev<1&&e>=.55){ev=1;sfx.cluck();}
        if(g.result==='win'&&ev<1&&e>=.5){ev=1;sfx.boing();spawn(400,200,20,'conf',CONF,300);}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,choque=kind==='choque',suelto=kind==='suelto',hold=pH||!!kG;
      const nx=ws.find(w=>!w.done),danger=!g.result&&nx&&nx.t-g.t<.7&&hits(nx,px);
      ctx.save();if(choque&&e<.4)ctx.translate(Math.sin(now*70)*5*(1-e/.4),0);
      /* ── el piso de la casa (o la grama del patio), que corre hacia abajo ── */
      if(win){wash(0,0,800,600,'#8fdc9a','#62c47a');
        for(let i=0;i<9;i++){const y=((i*83+sc)%680)-40,x=60+(i*197)%700;ell(x,y,7,7,LEI[i%4],2.5);ell(x,y,3,3,'#ffffff',0);}
        const yd=470+e*260;rr(0,yd,800,150,0,'#f1dcb0',0);rr(0,yd,800,22,0,'#c98a5a',3.5);txt('PATIO',400,yd+50,22,'#c98a5a',0,true);}
      else{wash(0,0,800,600,'#f4e2ba','#e9cf98');
        for(let x=170;x<740;x+=100)line([[x,0],[x,600]],3,'#dcc086');for(let i=0;i<6;i++){const y=(i*100+sc)%600;line([[70,y],[730,y]],3,'#dcc086');}
        rr(0,0,70,600,0,'#8fd0c0',0);rr(730,0,70,600,0,'#8fd0c0',0);line([[70,0],[70,600]],5,INK);line([[730,0],[730,600]],5,INK);
        /* bombas pegadas en la pared */
        for(let i=0;i<4;i++){const y=((i*230+sc)%920)-80,x=i%2?764:36;line([[x,y+22],[x+4,y+52]],2.5,INK);ell(x,y,20,24,LEI[i%4],3.5);ell(x-6,y-8,5,7,'#ffffff',0);}
        /* gags de fondo: la gallina con gorrito y el tío rendido en la silla */
        const hy=((sc*1+380)%1500)-150;hen(34,hy,.5,1);poly([[44,hy-36],[64,hy-36],[55,hy-64]],'#ff5c8a',3);ell(55,hy-66,5,5,'#ffd23f',2.5);
        const ty=((sc+1050)%1500)-150;rr(742,ty-6,46,74,8,'#ffffff',3.5);bust(Object.assign({},FACES[6],{x:765,y:ty,s:.36,th:110,mood:'sleep',rot:.12}));txt('Zz',748,ty-48-Math.sin(now*3)*5,18,'#ffffff',-.2);}
      /* ── todo lo que tiene pies, ordenado de atrás para adelante ── */
      const it=[];
      for(const w of ws){const y=PYF-(w.t-(choque?cw.t:g.t))*V;if(y<96||y>780||win)continue;for(const p of w.parts)it.push({y:y-(p.k==='ven'?2:0),f:()=>PIEZA[p.k](p.x,y)});}
      const hop=i=>g.result&&!win?0:Math.abs(Math.sin(now*(win?11:9)+i*1.3))*(win?16:6);
      const PILE=[[292,476,-1.4],[486,484,1.5],[392,446,1.25],[548,452,-1.2],[236,450,1.3]];
      const xs=[win||suelto?lx0:ruta(g.t+2*LEAD,1),win||suelto?ruta(g.t+LEAD,0):ruta(g.t+LEAD,1),px,q1,q2];
      for(let i=0;i<5;i++){let x=xs[i],y=PY+(i-2)*GAPY-hop(i),rot=g.result?0:Math.sin(now*9+i*1.3)*.07,mood='happy',talk=i===0?Math.abs(Math.sin(now*12)):0,arms,sy=1;
        const me=i===2;
        arms=i===0?[{side:1,a:2.6+Math.sin(now*12)*.3,len:76,w:19},{side:-1,a:-2.6+Math.sin(now*12)*.3,len:76,w:19}]:cintura(x,y,xs[i-1],PY+(i-3)*GAPY-hop(i-1),(me?TU.bw:CAST[i].bw)||54);
        if(me){mood=danger?'panic':!grabbed?'o':hold?'grin':'worry';if(!hold&&!g.result)arms=[{side:1,a:1.9+Math.sin(now*24)*.4,len:76,w:19},{side:-1,a:-1.9+Math.sin(now*24)*.4,len:76,w:19}];}
        if(win){mood=me?'happy':i%2?'grin':'happy';talk=i===0?1:0;arms=[{side:1,a:2.7+Math.sin(now*10+i)*.3,len:84,w:19},{side:-1,a:-2.7+Math.sin(now*10+i)*.3,len:84,w:19}];}
        if(choque){const k=ease(clamp((e-i*.1)/.32,0,1)),P=PILE[i];x=lerp(x,P[0],k);y=lerp(y,P[1],k)-Math.sin(k*PI)*40;rot=P[2]*k;mood=k>=1?(me?'dizzy':i%2?'o':'dizzy'):'yell';talk=k<1?1:0;
          arms=[{side:1,a:2.2,len:80,w:19},{side:-1,a:-2.2,len:80,w:19}];}
        if(suelto){if(me){y+=Math.min(e*V,330);rot=Math.sin(e*5)*.5;mood=e<.3?'o':'dizzy';sy=.9;arms=[{side:1,a:1.4,len:80,w:19},{side:-1,a:-1.4,len:80,w:19}];}
          else if(i>2){const k=ease(clamp(e/.5,0,1));y-=k*GAPY*0;x=lerp(x,i===3?px0+sg0*0:q1,0);mood=e<.5?'o':'happy';}}
        const o=me?Object.assign({},TU):Object.assign({},CAST[i],{vein:0,sweat:0});
        const X=x,Y=y,R=rot,M=mood,TK=talk,AR=arms,SY=sy;
        it.push({y:(choque?Y+40:Y+FEET)+(me?.5:0),f:()=>{bust(Object.assign(o,{x:X,y:Y,s:S,sy:SY,rot:R,mood:M,talk:TK,th:110,legs:[me?'#2f3a7a':'#3b3550','#ffffff',60],arms:AR,sweat:me&&danger?2:0,look:0}));
          if(!choque||e<.2)collar(X,Y,S);
          if(i===4&&!choque){line([[X+24,Y+6],[X+46,Y-70]],2.5,INK);ell(X+48,Y-92,20,24,'#ff5c8a',3.5);ell(X+42,Y-100,5,7,'#ffffff',0);}
          if(me&&!g.result){tag(X+64,Y-14);if(danger&&Math.sin(now*26)>-.2)txt('¡!',X-58,Y-44,40,'#ff4d5e',-.12);
            if(!grabbed){const z=1+Math.sin(now*12)*.12;line(closeP(ellP(xs[1],PY-GAPY+32,44*z,22*z,16)),5,'#ffe14d');}}}});}
      /* te soltaste: la gallina agarra tu puesto */
      if(suelto){const k=ease(clamp((e-.3)/.4,0,1)),hx=lerp(px0+sg0*420,px0,k),hy2=PY+40-Math.abs(Math.sin(now*11))*14;
        it.push({y:PYF-1,f:()=>{hen(hx,hy2,.75,1);poly([[hx+22,hy2-34],[hx+40,hy2-34],[hx+31,hy2-60]],'#ff5c8a',3);arcPts(hx,hy2-6,22,.1*PI,.9*PI,5,1).forEach((q,i)=>ell(q[0],q[1],5,5,LEI[i%4],2));}});}
      /* ganaste: el ventilador se pegó a la fila */
      let fx=0;if(win){fx=clamp(q2+(q2<400?150:-150),120,680);const fy=560-Math.abs(Math.sin(now*11+2))*16;it.push({y:900,f:()=>venti(fx,fy,1)});}
      if(choque){const k=ease(clamp(e/.25,0,1));[[250,536,1.1],[340,548,1.25],[440,544,1.2],[530,540,1.15],[390,520,1]].forEach((b,i)=>it.push({y:300+i*.1,f:()=>bolsa(b[0],b[1]+(1-k)*140,b[2])}));}
      it.sort((a,b)=>a.y-b.y);for(const o of it)o.f();
      if(choque&&e>.75){for(let i=0;i<4;i++){const a=now*5+i*TAU/4;txt('★',392+Math.cos(a)*150,404+Math.sin(a)*14,22,'#ffe14d');}
        hen(400,402-Math.abs(Math.sin(now*9))*6,.6,1);}
      ctx.restore();
      /* lo que se dice (fuera de la franja del sello) */
      if(!g.result&&g.t<1.1/rs)bubble(clamp(xs[0]+(xs[0]<400?170:-170),170,630),132,'¡HORA LOCAAA!',22,xs[0],PY-2*GAPY-30);
      if(choque&&e>.6)bubble(400,150,"¡ESA BASURA ERA PA'L ASEO!",22,440,400);
      if(suelto&&e>.6)bubble(clamp(lx0+(lx0<400?190:-190),190,610),132,'¡LA GALLINA BAILA MEJOR!',19,lx0,PY-2*GAPY-30);
      if(win&&e>.35)bubble(clamp(fx,170,630),388,'¡SE PEGÓ EL VENTILADOR!',18,fx,424);
      if(win&&e>.2)bubble(clamp(lx0+(lx0<400?180:-180),180,620),130,'¡QUE NO PARE!',22,lx0,PY-2*GAPY-30);
      drawP();
    }};
  return g;
}

BUS.add('trencito',{name:'¡AGARRA LA CINTURA!',mk:mkTrencito,card:'EL TRENCITO',num:'82'});
})();
