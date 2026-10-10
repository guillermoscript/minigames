'use strict';
/* MiniCaos · laboratorio de estilos: ¡HUECO! (esquivar troneras).
   Vista desde el volante: vas a toda mecha por una calle de tres canales y por el horizonte aparece un hueco sin tapa
   (o un cráter con su caucho y su trapo rojo de aviso). Un toque a la izquierda o a la derecha = un canal. El que tienes
   en el centro de la pantalla es TU canal. Meterse en el canal del hueco también cuenta como caerse.
   Nivel 1: 2 huecos. Nivel 2: 3, más rápidos, y aparece el mega hueco de dos canales (un solo canal sano).
   Nivel 3: 4, todavía más rápidos, y el hueco pelado viene con un caucho al lado (a veces uno en cada orilla: solo el centro sirve).
   El primer hueco siempre viene por tu canal; los demás casi siempre (si no, lo correcto es quedarse quieto).
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.hueco)return;
const{LV,CONF,say}=BUS,PI=Math.PI;
/* horizonte, alto de la calle en pantalla, ancho de canal al ras del tablero, volante y retrovisor */
const HZ=246,DY=200,LW=250,KP=4,DASH=446,WX=400,WY=548,WR=132,MX=220,MY=92,MW=360,MH=104;
const SK='#c98a5a',ASF='#55516e',NEGRO='#1c1822',CAB='#2d2640';
const GRITOS=['¡HUECO!','¡OTRO!','¡¿OTRO?!','¡¿MÁS?!'];
const pop=(s,x,y,col,r=26,life=.8)=>PT.push({x,y,vx:0,vy:-60,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
/* u = cuánto falta (0 aparece, 1 llega al parachoques) → escala en pantalla: perspectiva de verdad, se viene encima al final */
const S=u=>1/(1+KP*(1-Math.min(u,1.15)));
const chispas=(x,y,n,w)=>{for(let i=0;i<n;i++)PT.push({x:x+(Math.random()-.5)*w,y,vx:(Math.random()-.5)*300,vy:-80-Math.random()*200,g:520,t:0,life:.5+Math.random()*.3,kind:'★',col:'#ffe14d',r:-8+Math.random()*6,rot:Math.random()*6,vr:(Math.random()-.5)*10});};

/* el hueco: borde de asfalto roto y la boca negra. (x,y) centro en pantalla, rx medio ancho */
function hoyo(x,y,rx,seed){const ry=rx*.3,o=clamp(rx*.045,1.2,4.5),p=[];
  for(let i=0;i<14;i++){const a=i/14*TAU,k=1.04+hash(seed,i,3)*.22;p.push([x+Math.cos(a)*rx*k,y+Math.sin(a)*ry*k]);}
  poly(p,'#9a8f84',o);ell(x,y+ry*.1,rx*.86,ry*.8,NEGRO,o*.8);ell(x,y+ry*.42,rx*.56,ry*.3,'#3a3048',0);
  for(let i=0;i<3;i++){const a=(.3+i*.37+hash(seed,i,7)*.2)*TAU,c=Math.cos(a),s=Math.sin(a);
    line([[x+c*rx*1.15,y+s*ry*1.15],[x+c*rx*1.42+s*rx*.08,y+s*ry*1.5],[x+c*rx*1.7,y+s*ry*1.75]],clamp(rx*.03,1,3),CAB);}}
/* el aviso criollo: un caucho parado en el cráter, con su palo y su trapo rojo */
function caucho(x,y,k){const o=clamp(k*4,1.2,4);ctx.save();ctx.translate(x,y);ctx.rotate(-.1);
  line([[10*k,-70*k],[30*k,-172*k]],Math.max(2,6*k),'#8a5a30');
  const f=Math.sin(now*11)*8*k;poly([[30*k,-172*k],[80*k,-158*k+f],[36*k,-132*k]],'#ff3b4e',o*.8);
  ell(0,-40*k,44*k,50*k,'#14101c',o);ell(0,-40*k,23*k,28*k,'#6f6790',o*.7);
  for(let i=0;i<5;i++){const a=PI*(1.15+i*.175),c=Math.cos(a),s=Math.sin(a);line([[c*34*k,-40*k+s*39*k],[c*43*k,-40*k+s*49*k]],Math.max(1,2.5*k),'#6f6790');}
  ctx.restore();}
/* la mata que alguien sembró en el mega hueco */
function mata(x,y,k){line([[x,y],[x-4*k,y-70*k]],Math.max(2,9*k),'#6ecf8f');
  for(const[a,l]of[[-1.1,72],[-.45,96],[.3,100],[1,76]]){ctx.save();ctx.translate(x-4*k,y-64*k);ctx.rotate(a+Math.sin(now*4+a)*.05);
    ell(0,-l*k*.5,13*k,l*k*.5,'#3aa86a',clamp(k*3.5,1,3.5));line([[0,-4*k],[0,-l*k*.9]],Math.max(1,2*k),'#2a7a4a');ctx.restore();}}
/* el chiste de fondo: un perro durmiendo al lado del hueco, pase lo que pase */
function perroDormido(x,y,k,sd){ctx.save();ctx.translate(x,y);ctx.scale(sd*k,k);
  limb(-34,-12,-52,-24,8,'#d9a05b',3);ell(0,-14,40,17,'#d9a05b',4);ell(34,-10,17,14,'#d9a05b',4);ell(48,-6,8,6,'#7a4a2a',3);ell(27,-22,7,11,'#8a5a30',3);
  line([[31,-12],[40,-10]],3,INK);ctx.restore();
  if(k>.22)for(let i=0;i<3;i++){const u=(now*.7+i/3)%1;txt('z',x+sd*k*(44+u*30),y-k*(36+u*64),Math.max(7,k*(18+u*18)),'#ffffff');}}
function aviso(x,y,k){ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.rotate(-.05);
  line([[0,0],[0,-150]],9,'#8f8fa8');rr(-118,-252,236,106,8,'#fff3c4',4);rr(-118,-252,236,22,6,'#ff8a3d',3);
  if(k>.3){txt('DISCULPE LAS',0,-208,23,INK,0,true);txt('MOLESTIAS',0,-182,23,INK,0,true);txt('DESDE 2009',0,-159,15,'#c4283a',0,true);}
  ctx.restore();}
function rueda(x,y,R,a){const o=clamp(R*.08,1,4);ell(x,y,R,R,'#14101c',o);ell(x,y,R*.55,R*.55,'#c9ced6',o*.8);ell(x,y,R*.16,R*.16,'#7a7f92',0);
  for(let i=0;i<5;i++){const t=a+i*TAU/5,c=Math.cos(t),s=Math.sin(t);line([[x+c*R*.22,y+s*R*.22],[x+c*R*.44,y+s*R*.44]],Math.max(1,R*.08),'#7a7f92');}}
/* la virgencita del tablero. up: pulgar arriba */
function virgen(x,y,k,rot,up){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(k,k);
  rr(-23,-8,46,11,4,'#8a5a30',3);if(up)ell(0,-64,27,27,'#fff3a8',0);
  line(closeP(ellP(0,-64,19,19,14)),4,'#ffd23f');
  poly([[-21,-8],[-14,-56],[0,-74],[14,-56],[21,-8]],'#2f7fe0',3.5);poly([[-9,-8],[-7,-44],[7,-44],[9,-8]],'#fffdf2',2.5);
  ell(0,-56,9.5,10.5,'#e8b48a',2.5);ell(-3.4,-57,1.5,1.8,INK,0);ell(3.4,-57,1.5,1.8,INK,0);line(arcPts(0,-56,4.5,PI*.2,PI*.8,4),1.8);
  if(up){limb(12,-38,28,-50,8,'#2f7fe0',2.5);ell(30,-53,8,8,'#e8b48a',2.5);rr(26.5,-72,7,15,3,'#e8b48a',2.5);}
  else ell(0,-34,5,6.5,'#e8b48a',2);
  ctx.restore();}
/* el perrito que dice que sí con la cabeza */
function perrito(x,y,nod){rr(x-20,y-8,10,10,3,'#c28a4e',2.5);rr(x+10,y-8,10,10,3,'#c28a4e',2.5);ell(x,y-18,27,15,'#c28a4e',3.5);
  ctx.save();ctx.translate(x+12,y-30);ctx.rotate(nod);ell(-14,-14,6,12,'#8a5a30',2.5);ell(14,-14,6,12,'#8a5a30',2.5);ell(0,-12,18,16,'#d9a05b',3.5);
  ell(-6,-15,2.4,3,INK,0);ell(6,-15,2.4,3,INK,0);ell(0,-6,6,4.5,'#7a4a2a',2);ctx.restore();}

/* ═════════ ¡HUECO! (esquivar troneras): cámbiate de canal antes de que el hueco llegue al parachoques ═════════ */
function mkHueco(){
  const rs=Math.sqrt(SP),lv=LV(),N=[2,3,4][lv-1],T=[1.35,1,.76][lv-1],LEAD=[.7,.5,.35][lv-1],PER=[1.8,1.12,.8][lv-1],UO=1+.1/T,e0=Math.random()<.5?1:0;
  const pas=[5,2,9,7].map((fi,i)=>({f:FACES[fi],x:MX+45+i*90,ph:Math.random()*TAU,tilt:(Math.random()-.5)*.8,idle:['angry','sleep','calm','smile'][i]}));
  const rows=[];let lane=1,cam=1,nx=0,done=0,road=0,kerb=0,kd=0,relief=0,ws=1,crac=false,stuck=false,bnc=0,spin=0,kiss=false,ok=false;
  const X=(lx,s)=>400+(lx-cam)*LW*s,Y=s=>HZ+DY*s;
  /* la rueda suelta: primero rebota a un lado (el letrero tapa el centro), después se va calle abajo */
  const rda=t=>{const s=1/(1+.45*t+.2*t*t),q=(t%.42)/.42;return{s,x:400+ws*lerp(300*(.7+.3*s),290*s,ease(clamp((t-1)/.6,0,1))),h:4*q*(1-q)*125*Math.pow(.7,Math.floor(t/.42))*s};};
  /* cada fila se decide cuando aparece, según el canal en que estés: el canal sano queda a un toque
     (a dos, solo de vez en cuando en el nivel 3) */
  function mkRow(i){const p=lane,must=i===0||Math.random()<.78;let blk=null,kind='hueco',cau=-1;
    if(lv>=2&&Math.random()<[0,.5,.72][lv-1]){let c=[0,1,2].filter(s=>lv>=3||s!==1);
      if(!(lv>=3&&Math.random()<.22))c=c.filter(s=>Math.abs(s-p)<=1);
      if(must)c=c.filter(s=>s!==p);
      if(c.length){const s=c[Math.random()*c.length|0];blk=[0,1,2].filter(l=>l!==s);kind=s===1||(lv>=3&&Math.random()<.55)?'par':'mega';if(kind==='par')cau=blk[Math.random()*2|0];}}
    if(!blk){blk=[must?p:[0,1,2].filter(l=>l!==p)[Math.random()*2|0]];if(Math.random()<.4){kind='caucho';cau=blk[0];}}
    return{id:i*7+3,t0:g.t,u:0,blk,kind,cau,ext:(i+e0)%2?'perro':'aviso',sd:p===0?-1:p===2?1:Math.random()<.5?-1:1,out:false};}
  function caer(){g.result='lose';g.why='¡AL HUECO!';ws=lane===0?1:lane===2?-1:Math.random()<.5?-1:1;sfx.thud();sfx.lose();}
  function girar(d){if(g.result)return;const nl=clamp(lane+d,0,2);
    if(nl===lane){kerb=1;kd=d;snd(130,.09,'square',.06,-40);return;}
    lane=nl;nz(.12,.06);snd(520,.14,'sawtooth',.03,-220);}
  const g={lr:true,get impact(){return this.result==='lose'?clamp(1-this.endT/.5,0,1):Math.min(.6,Math.abs(lane-cam));},
    probe:()=>({lane,cam,lv,n:N,done,T,uo:UO,rows:rows.filter(r=>!r.out).map(r=>({u:r.u,t0:r.t0,blk:r.blk.slice(),kind:r.kind}))}),
    t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡ESQUIVA!',
    hint:'← → (o toca un lado de la pantalla): cambia de canal, esquiva el hueco',
    press(k){if(k==='left')girar(-1);else if(k==='right')girar(1);},
    down(p){girar(p.x<400?-1:1);},
    update(dt){g.t+=dt;cam+=(lane-cam)*Math.min(1,dt*13);kerb=Math.max(0,kerb-dt*5);relief=Math.max(0,relief-dt*1.5);
      if(g.result!=='lose'){road+=dt/T;for(const r of rows)r.u=(g.t-r.t0)/T;while(rows.length&&rows[0].u>1.6)rows.shift();}
      if(!g.result){
        if(nx<N&&g.t>=LEAD+nx*PER){rows.push(mkRow(nx));snd(988,.07,'square',.05);setTimeout(()=>snd(988,.07,'square',.05),90);say(GRITOS[nx],668,178,'#ffe14d');nx++;}
        for(const r of rows){if(r.out)continue;
          if(r.u>=1&&r.blk.includes(lane)){caer();break;}
          if(r.u>=UO){r.out=true;done++;relief=1;sfx.whoosh();say('¡UFF!',128,214,'#5cff7a');}}
        /* pasar el último hueco es ganar (el reloj nunca llega primero, pero por si acaso: aguantar también gana) */
        if(!g.result&&(done>=N||g.t>=g.dur)){g.result='win';g.why='¡ESQUIVADO!';sfx.win();spawn(400,250,26,'conf',CONF);}}
      else{g.endT+=dt;const e=g.endT;
        if(g.result==='lose'){spin+=dt*16*Math.exp(-e*1.6)*ws;
          if(!crac&&e>=.16){crac=true;sfx.crash();sfx.boing();pop('¡CRAC!',400+ws*118,408,'#ff4d5e',26);spawn(400+ws*120,DASH-6,12,'bit',['#9a8f84',ASF,'#3a3048'],300,800,.8);}
          if(!stuck&&e>=.3){stuck=true;sfx.thud();chispas(400,218,7,380);}
          const n=Math.floor((e-.16)/.42);if(n>bnc){bnc=n;snd(300-n*30,.16,'sine',.09/(n*.5+1),300);const w=rda(e-.16);say('¡toc!',w.x,Y(w.s)-36-70*w.s,'#ffffff');}}
        else{
          if(!kiss&&e>=.45){kiss=true;snd(1300,.09,'sine',.09,700);
            for(let i=0;i<3;i++)PT.push({x:222,y:400,vx:-150-i*50,vy:-130-i*30,g:260,t:0,life:.5+i*.08,kind:'♥',col:'#ff5c8a',r:2+i*3,rot:0,vr:0});}
          if(!ok&&e>=.85){ok=true;sfx.ding();chispas(128,340,6,70);}}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,sw=lane-cam,cur=rows.find(r=>!r.out),dng=cur&&!g.result?clamp(cur.u,.01,1):0;
      const hitT=lose?Math.max(0,e-.16):0,drop=lose?ease(clamp(e/.16,0,1)):0,shk=lose&&e>=.16?Math.exp(-hitT*5):0,kb=kerb*Math.sin(kerb*9)*kd;
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      ctx.translate(Math.sin(now*71)*7*shk+kb*8,Math.cos(now*59)*5*shk);
      /* ── la calle: se ladea con el volantazo; al caer, la trompa se hunde y todo se va de lado ── */
      ctx.save();ctx.translate(400,DASH);ctx.rotate(sw*.035-ws*drop*.085);ctx.translate(-400-sw*56,-DASH-drop*36-Math.sin(hitT*26)*9*shk+(lose?0:Math.sin(now*33)*1.3));
      wash(-200,-140,1200,HZ+140,'#8fd8ff','#e8f8ff');ell(118,150,28,28,'#ffe14d',0);
      poly([[-220,HZ],[-80,HZ-64],[60,HZ-112],[210,HZ-86],[330,HZ-124],[470,HZ-98],[610,HZ-132],[790,HZ-78],[1020,HZ]],'#6fb894',3.5);
      [[-30,170,90,'#ffb36b'],[66,196,70,'#a9a0ff'],[142,182,76,'#ff9ec7'],[590,188,72,'#ffd23f'],[668,160,84,'#6ecf8f'],[758,192,90,'#8aa0ff']].forEach(([x,y,w,c])=>{
        rr(x,y,w,HZ-y+6,5,c,3.5);for(let i=0;i<2;i++)rr(x+10+i*(w/2.3),y+12,w/4.2,14,3,'#ffffff',2);});
      rr(-300,HZ,1400,460,0,'#d6c08e',0);line([[-300,HZ],[1100,HZ]],4,INK);
      const F=2.2,yF=Y(F);
      poly([[400,HZ],[X(-.5,F),yF],[X(-1.25,F),yF]],'#d8d2c4',0);poly([[400,HZ],[X(3.25,F),yF],[X(2.5,F),yF]],'#d8d2c4',0);
      poly([[400,HZ],[X(2.5,F),yF],[X(-.5,F),yF]],ASF,0);
      line([[400,HZ],[X(-.5,F),yF]],4,'#fff3c4');line([[400,HZ],[X(2.5,F),yF]],4,'#fff3c4');
      /* rayas de canal y postes: todo viene a la misma velocidad que los huecos */
      const ph=road%.36;
      for(const b of[.5,1.5])for(let i=0;i<10;i++){const u=-2.3+ph+i*.36;if(u>1.12)break;const a=S(u),c=S(Math.min(u+.14,1.15)),xa=X(b,a),xc=X(b,c);
        poly([[xa-5*a,Y(a)],[xa+5*a,Y(a)],[xc+5*c,Y(c)],[xc-5*c,Y(c)]],'#ffe14d',0);}
      for(let i=0;i<8;i++){const u=-2.3+road%.9+i*.45;if(u>1.12)break;const s=S(u),sd=i%2?1:-1,x=X(sd<0?-1.1:3.1,s),y=Y(s);
        line([[x,y],[x,y-330*s]],Math.max(1.5,8*s),'#8f8fa8');line([[x,y-322*s],[x-sd*56*s,y-332*s]],Math.max(1.5,6*s),'#8f8fa8');ell(x-sd*60*s,y-326*s,13*s,7*s,'#fff3a8',clamp(3*s,1,3));}
      /* los huecos, del más lejano al más cercano */
      for(let i=rows.length-1;i>=0;i--){const r=rows[i],s=S(r.u),y=Y(s),k=s*(.45+.55*ease(clamp((g.t-r.t0)/.14,0,1))),mid=(r.blk[0]+r.blk[r.blk.length-1])/2;
        if(r.kind==='mega'){const x=X(mid,s);hoyo(x,y,LW*.9*k,r.id);mata(x+r.sd*LW*.4*k,y+8*k,k*.9);}
        else for(const l of r.blk){const x=X(l,s),rx=LW*.4*k;hoyo(x,y,rx,r.id+l);if(l===r.cau){caucho(x,y+10*k,k);ell(x,y+rx*.2,rx*.5,rx*.085,NEGRO,0);}}
        const ex=X(r.sd<0?-.8:2.8,s);if(r.ext==='perro')perroDormido(ex,y+4*s,s*.95,-r.sd);else aviso(ex,y,s);
        if(!g.result&&r.u<.3&&Math.sin(now*30)>-.3)txt('¡!',X(mid,s),y-14-(r.cau<0?60:190)*s,30,'#ff4d5e');}
      /* la rueda que se fue: rebota calle abajo */
      if(lose&&e>=.16){const w=rda(hitT),R=60*w.s;ell(w.x,Y(w.s),R*.9,R*.24,'#3a3650',0);rueda(w.x,Y(w.s)-w.h-R,R,hitT*13*ws);}
      ctx.restore();
      /* ── la cabina: techo, parales y flecos ── */
      rr(-10,-10,820,100,0,CAB,0);poly([[-10,90],[30,90],[16,DASH+4],[-10,DASH+4]],CAB,0);poly([[810,90],[770,90],[784,DASH+4],[810,DASH+4]],CAB,0);
      line([[30,90],[16,DASH]],4,INK);line([[770,90],[784,DASH]],4,INK);line([[30,90],[770,90]],4,INK);
      for(let i=0;i<15;i++)ell(52+i*50-sw*8,100+Math.sin(now*6+i*1.7)*1.5+shk*Math.sin(now*40+i)*5,9,10,['#ffd23f','#2f7fe0','#c4283a'][i%3],3);
      /* retrovisor: los pasajeros opinan (la abuela no se despierta ni pegada al techo) */
      const mz=lose?1+.2*Math.min(1,e/.2)+.06*Math.sin(hitT*20)*shk:1,fly=lose?clamp(e/.3,0,1):0,fq=1-(1-fly)*(1-fly);
      ctx.save();ctx.translate(400,MY-6);ctx.rotate(lose?ws*.03*drop:sw*.02);ctx.scale(mz,mz);ctx.translate(-400,-MY+6);
      const ca=-sw*.5+Math.sin(now*3)*.07+shk*Math.sin(now*17)*.7,cx=540+Math.sin(ca)*28,cy=MY+MH+10+Math.cos(ca)*28;
      line([[540,MY+MH+8],[cx,cy]],2,'#fffdf2');ell(cx,cy,13,13,'#c9ced6',2.5);ell(cx,cy,4,4,CAB,0);line(arcPts(cx,cy,8.5,now*2,now*2+1.3,4),2.5,'#ff9ec7');
      rr(388,MY-14,24,16,4,'#14101c',3);rr(MX-9,MY-5,MW+18,MH+16,20,'#14101c',4);
      ctx.save();path(rrP(MX,MY+2,MW,MH,14));ctx.clip();ctx.fillStyle=STY[style].col('#5a4a78');ctx.fillRect(MX-2,MY,MW+4,MH+6);
      rr(MX+96,MY+14,168,44,8,'#9fdcff',3);line([[MX,MY+11],[MX+MW,MY+11]],5,'#c4cad6');
      for(const p of pas)rr(p.x-38,MY+MH-22,76,40,10,'#3fa0ff',3);
      pas.forEach((p,i)=>{const dz=p.idle==='sleep';
        if(lose){const st=fly>=1;
          bust(Object.assign({},p.f,{x:p.x+p.tilt*10*fq,y:lerp(MY+MH-9,MY+44,fq),s:lerp(.56,.38,fq),sy:st?.86:1,th:64,bw:50,legs:['#3b3550','#ffffff',40],rot:p.tilt*fq+(st?Math.sin(now*5+p.ph)*.04:0),
            look:0,mood:dz?'sleep':st?'dizzy':'yell',talk:1,vein:0,sweat:0,arms:[{side:-1,a:-2+p.tilt,len:56,w:19},{side:1,a:2+p.tilt,len:56,w:19}]}));}
        else{const pn=dng>.4,m=dz?'sleep':win?'happy':Math.abs(sw)>.25?'o':pn?(i%2?'yell':'panic'):dng>0?'worry':relief>0?'smile':p.idle,
            o=Object.assign({},p.f,{x:p.x-sw*16,y:MY+MH-9+(dz?0:win?-Math.abs(Math.sin(now*10+p.ph))*7:pn?Math.sin(now*38+p.ph)*1.5:0),s:.56,th:50,bw:50,rot:-sw*.22+(dz?.08+Math.sin(now*2)*.05:0),
              look:0,mood:m,vein:m==='angry'?1:0,talk:pn&&!dz?Math.abs(Math.sin(now*17+p.ph)):0,sweat:dz||win?0:pn?2:dng>0?1:0});
          if(win&&!dz){const w=Math.sin(now*12+p.ph)*.25;o.arms=[{side:-1,a:-2.7+w,len:52,w:19},{side:1,a:2.7-w,len:52,w:19}];}
          bust(o);}});
      ctx.restore();line(closeP(rrP(MX,MY+2,MW,MH,14)),5,'#c9ced6');ctx.restore();
      /* ── tablero: calcomanía, contador de huecos, la virgencita y el perrito ── */
      poly([[-20,DASH+8],[70,DASH],[730,DASH],[820,DASH+8],[820,600],[-20,600]],CAB,4.5);line([[-20,DASH+22],[820,DASH+22]],3,'#4a4266');
      rr(36,484,176,38,8,'#fff3c4',3);txt('DIOS ES MI COPILOTO',124,504,12,'#c4283a',0,true);
      rr(592,476,172,56,10,'#14101c',3.5);txt('HUECOS',678,490,11,'#c9ced6',0,true);
      for(let i=0;i<N;i++)ell(678+(i-(N-1)/2)*30,513,9,9,i<done?'#5cff7a':lose&&i===done?'#ff3b4e':'#5a5274',3);
      virgen(128,DASH+3,win?1.1+.2*ease(clamp((e-.6)/.2,0,1))+(ok?Math.sin(now*9)*.03:0):1.1,lose?-1.5*ease(clamp(hitT/.25,0,1)):Math.sin(now*33)*.012,ok);
      perrito(676,DASH+2,lose?Math.sin(now*30)*.7*Math.exp(-hitT*1.5):Math.sin(now*7)*.2+sw*.5);
      /* volante: la cinta amarilla marca cuánto giras */
      const th=lose?spin:clamp(sw*1.2,-1,1)+kb*.3+Math.sin(now*31)*.012;
      rr(WX-36,WY+10,72,60,10,'#3b3550',3.5);
      line(closeP(ellP(WX,WY,WR,WR,40)),24,'#14101c');line(arcPts(WX,WY,WR,th-PI/2-.17,th-PI/2+.17,4),25,'#ffd23f');
      for(const a of[th,th+PI,th+PI/2]){const c=Math.cos(a),s=Math.sin(a);limb(WX+c*30,WY+s*30,WX+c*(WR-12),WY+s*(WR-12),22,'#3b3550',3.5);}
      ell(WX,WY,40,40,'#3b3550',4);ell(WX,WY,21,21,'#ffd23f',3.5);line([[WX-Math.cos(th)*12,WY-Math.sin(th)*12],[WX+Math.cos(th)*12,WY+Math.sin(th)*12]],4,CAB);
      /* las manos del chofer */
      const hp=a=>[WX+Math.sin(a)*WR,WY-Math.cos(a)*WR],
        fist=(sd,[hx,hy])=>{limb(WX+sd*240,660,hx,hy,36,SK,4);ell(hx,hy,25,21,SK,4);for(const j of[-1,0,1])line([[hx+j*10-2,hy-11],[hx+j*10,hy+3]],2.5,dark(SK,.35));ell(hx-sd*19,hy+9,9,13,SK,3);},
        open=(sd,hx,hy,r)=>{limb(WX+sd*240,660,hx,hy+10,36,SK,4);hand(hx,hy,r,2.2,SK);};
      if(lose){for(const sd of[-1,1]){const dn=sd===ws?0:ease(clamp((e-.5)/.25,0,1));if(dn<1)open(sd,WX+sd*152,426+dn*240+Math.sin(now*23+sd)*7,sd*.35+Math.sin(now*19+sd)*.2);}}
      else{const kq=win?ease(clamp((e-.12)/.28,0,1)):0,[hx,hy]=hp(-.9+th);
        if(kq>0)open(-1,lerp(hx,236,kq),lerp(hy,424,kq)+(e>.45?Math.sin(now*10)*4:0),-.9*kq);else fist(-1,[hx,hy]);
        fist(1,hp(.9+th));}
      ctx.restore();line([[0,576],[800,576]],4,INK);
      if(lose&&e>.75)bubble(400-ws*166,376,'¡SE PARTIÓ EL MUÑÓN!',18,400-ws*84,470);
      if(win&&e>.3)bubble(452,392,'¡GRACIAS, VIRGENCITA!',18,330,470);
      drawP();
    }};
  return g;
}
BUS.add('hueco',{name:'¡HUECO!',mk:mkHueco,card:'EL HUECO',num:'33'});
})();
