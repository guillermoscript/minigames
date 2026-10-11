'use strict';
/* MiniCaos · laboratorio de estilos: ¡TRANCA! (la cochina).
   La mesa de plástico vista desde arriba: mantel de flores, tres frías vacías y un dominó trancado con UN solo hueco, al lado
   de un seis. En tu mano las fichas van pasando solas (los nervios): hay que pegar EN el hueco justo cuando tienes el doble
   seis. Como la pantalla no mide la fuerza, "duro" es puntería + tiempo.
   · La cochina en el hueco = ¡CLAC!, saltan las botellas y «¡LA COCHINAAA!».
   · Otra ficha en el hueco = «ESA NO VA AHÍ, TRAMPOSO» y te sacan del juego con todo y silla.
   · Manotazo fuera del hueco = ¡EPA!, se cae una botella (nivel 1 perdona uno; niveles 2 y 3: tumbaste la mesa).
   · Si no juegas, juega otro: te ahorcaron la cochina.
   Nivel 1: 3 fichas cada 0,55 s y hueco grande. Nivel 2: 4 fichas cada 0,42 s. Nivel 3: 5 fichas cada 0,32 s, una gorda que se
   le parece (el doble cinco), hueco chiquito y un codazo que rueda la cadena una vez.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.tranca)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI;
const BONE='#fffdf2',CLOTH='#b0457e',PLAST='#f4f1ea',AMB='#b8742a',AMB2='#dc9c48';
const pop=(s,x,y,col,r=26,life=.75)=>PT.push({x,y,vx:0,vy:-50,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
const DIR={R:[1,0],D:[0,1],L:[-1,0],U:[0,-1]},ANG={R:0,D:PI/2,L:PI,U:-PI/2};
const PIP=[[],[[0,0]],[[-1,-1],[1,1]],[[-1,-1],[0,0],[1,1]],[[-1,-1],[1,-1],[-1,1],[1,1]],[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],[[-1,-1],[0,-1],[1,-1],[-1,1],[0,1],[1,1]]];
/* una ficha acostada (w × w/2) centrada en x,y: a del lado de donde viene la cadena, b del lado hacia donde sigue */
function ficha(x,y,w,a,b,rot=0,o=3.5){const h=w/2,d=h*.27,r=Math.max(2.2,h*.105);
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  rr(-w/2,-h/2,w,h,h*.16,BONE,o);line([[0,-h*.36],[0,h*.36]],Math.max(1.6,h*.05),INK);
  [a,b].forEach((n,i)=>{const cx=(i?1:-1)*w/4;for(const[px,py]of PIP[n])ell(cx+px*d,py*d,r,r,INK,0);});
  ctx.restore();}
/* la cadena: cada letra es una ficha en esa dirección (R D L U); en minúscula es un doble, que va atravesado.
   Los números casan de verdad, la última deja un seis al aire y rep cuenta las fichas repetidas (para quedarse con la mejor). */
function cadena(x,y,u,mv,used){const out=[],key=(a,b)=>Math.min(a,b)*7+Math.max(a,b),free=(a,b)=>!used.has(key(a,b));let cx=x,cy=y,pd=null,v=Math.random()*6|0,rep=0;
  for(let i=0;i<mv.length;i++){const k=mv[i].toUpperCase(),dbl=mv[i]!==k,nx=mv[i+1],nd=!!nx&&nx!==nx.toUpperCase(),[dx,dy]=DIR[k];let tx,ty,b=v;
    if(!dbl){if(i===mv.length-1)b=6;else{let c=[0,1,2,3,4,5].filter(q=>q!==v&&free(v,q)&&(!nd||free(q,q)));if(!c.length)c=[0,1,2,3,4,5].filter(q=>q!==v);b=c[Math.random()*c.length|0];}}
    if(!free(v,b))rep++;used.add(key(v,b));
    if(pd&&pd!==k){const[px,py]=DIR[pd];tx=cx+(px+dx)*u/2;ty=cy+(py+dy)*u/2;cx+=px*u/2+dx*u*1.5;cy+=py*u/2+dy*u*1.5;}
    else if(dbl){tx=cx+dx*u/2;ty=cy+dy*u/2;cx+=dx*u;cy+=dy*u;}
    else{tx=cx+dx*u;ty=cy+dy*u;cx+=dx*2*u;cy+=dy*2*u;}
    out.push({x:tx,y:ty,rot:ANG[k]+(dbl?PI/2:0),a:v,b,sx:0,sy:0,sr:0});v=b;pd=k;}
  return{tiles:out,end:[cx,cy],dx:DIR[pd][0],rep};}
/* la fría vacía, paradita (medio de frente, como las caras): x,y = la base. Etiqueta inventada: un sol rojo */
function botella(x,y,rot,z=1){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(z,z);
  rr(-11,-34,22,34,6,AMB,3.5);poly([[-10,-31],[-4.5,-44],[4.5,-44],[10,-31]],AMB,3.5);rr(-4.5,-56,9,14,2,AMB,3);rr(-6,-60,12,6,2,AMB2,2.5);
  rr(-11,-27,22,17,0,'#fff3c4',2.5);ell(0,-18.5,5,5,'#e8553d',0);line([[-6.5,-33],[-6.5,-40]],2,'#ffe9b8');ctx.restore();}
function estrella(x,y,r1,r2,n,col,o=4){const p=[];for(let i=0;i<n*2;i++){const a=i/(n*2)*TAU-.2,r=i%2?r2:r1;p.push([x+Math.cos(a)*r,y+Math.sin(a)*r*.8]);}poly(p,col,o);}
function silla(x,y,rot){ctx.save();ctx.translate(x,y);ctx.rotate(rot);limb(-24,14,-30,50,8,PLAST,3);limb(24,14,30,50,8,PLAST,3);rr(-27,-46,54,50,10,PLAST,3.5);for(let i=0;i<3;i++)rr(-15+i*11,-36,6,26,3,'#d8d2c4',0);rr(-32,0,64,18,7,PLAST,3.5);ctx.restore();}

function mkTranca(){
  const rs=Math.sqrt(SP),lv=LV(),mir=Math.random()<.5,sg=mir?-1:1,mx=x=>mir?800-x:x;
  const U=[52,44,36][lv-1],TW=U*2,PAD=[8,7,5][lv-1],PER=[.55,.42,.32][lv-1],NT=lv+2,GR=.07,IMP=.07,FRZ=.05,HX=400,HY0=506,PBX=mx(92),PBY=566;
  /* tu mano: la cochina y fichas de relleno que no llevan seis (así ninguna otra "va ahí"); nunca arranca con la cochina */
  const pick=(a,n)=>a.slice().sort(()=>Math.random()-.5).slice(0,n),esC=f=>f[0]+f[1]===12;
  const FI=[[6,6]].concat(lv===1?pick([[0,1],[1,2],[2,3],[0,3],[1,4],[2,2]],2):lv===2?pick([[1,2],[2,3],[3,4],[4,1],[5,0],[3,3],[5,2]],3):[[5,5]].concat(pick([[4,4],[5,4]],1),pick([[1,2],[0,3],[3,2],[4,1]],2)));
  do FI.sort(()=>Math.random()-.5);while(esC(FI[0]));
  const DEF=[[568,236,'LLLDdRRR'],[590,222,'LLLLDDRrRR'],[224,216,'RRRRDdLLLLDdRRRR']][lv-1];
  const MV=mir?DEF[2].replace(/[LRlr]/g,c=>({L:'R',R:'L',l:'r',r:'l'})[c]):DEF[2];let ch=null;
  for(let i=0;i<40&&(!ch||ch.rep);i++){const c=cadena(mx(DEF[0]),DEF[1],U,MV,new Set(FI.map(f=>Math.min(f[0],f[1])*7+Math.max(f[0],f[1]))));if(!ch||c.rep<ch.rep)ch=c;}
  const slot={x:ch.end[0]+ch.dx*U,y:ch.end[1]},off={x:0,y:0},NDX=ch.dx*26,NDY=-10,tN=(.42+Math.random()*.14)*5/rs;
  const bot=[[612,214,-1.45],[644,232,-1.9],[616,246,-2.2]].map(([x,y,fa],i)=>({x:mx(x),y,ph:i*2.1,wob:0,hop:9,down:false,fall:0,fa:fa*sg}));
  const caps=[[612,275,'#ffd23f'],[630,302,'#e8553d'],[606,328,'#ffd23f']].map(c=>[mx(c[0]),c[1],c[2]]);
  /* los otros tres: el compadre arriba, la doña a la izquierda, el de la gorra a la derecha. o = centro de su borde, in = hacia la mesa */
  const RV=[{f:FACES[1],o:[400,146],in:[0,1],rot:0,n:3},{f:FACES[5],o:[118,300],in:[1,0],rot:-PI/2,n:2},{f:FACES[11],o:[682,300],in:[-1,0],rot:PI/2,n:4}];
  const acu=mir?RV[1]:RV[2],emp=mir?RV[2]:RV[1],ak=Math.random()*5|0,fl=[];
  const RP=(r,a,b)=>[r.o[0]-r.in[1]*a+r.in[0]*b,r.o[1]+r.in[0]*a+r.in[1]*b];
  let idx=0,swT=9,sl=null,kind='',warned=false,shake=0,rat=0,epaT=0,hintT=0,nud=false,nudT=9,flyOut=0,henJ=9,evA=false,evB=false,evC=false,juega=false;
  const hueco=()=>({x:slot.x+off.x-TW/2-PAD,y:slot.y+off.y-U/2-PAD,w:TW+2*PAD,h:U+2*PAD});
  /* ── el golpe ── p = dónde tocaste (null = teclado: directo al hueco, solo cuenta el tiempo) */
  function pega(p){if(g.result||(sl&&sl.t<.3))return;const R=hueco();
    if(p&&!(p.x>=R.x&&p.x<=R.x+R.w&&p.y>=R.y&&p.y<=R.y+R.h)){
      /* fuera de la mesa no pasa nada; en la mesa es un manotazo */
      if(p.x<118||p.x>682||p.y<146||p.y>456){if(hintT<=0){hintT=.7;snd(200,.06,'square',.03);say('¡EN EL HUECO!',slot.x+off.x,R.y-22,'#ffe14d');}return;}
      sl={x:p.x,y:p.y,t:0,a:FI[idx][0],b:FI[idx][1],k:'epa'};sfx.whoosh();
      if(lv===1&&!warned)warned=true;else{sl.k=kind='mesa';g.result='lose';g.why='¡MANOTAZO!';}
      return;}
    /* un pelín de gracia: si la cochina se acaba de ir, todavía vale */
    let T=FI[idx];if(!esC(T)&&g.t>PER&&g.t%PER<GR&&esC(FI[(idx+NT-1)%NT]))T=[6,6];
    sl={x:slot.x+off.x,y:slot.y+off.y,t:0,a:T[0],b:T[1],k:esC(T)?'win':'trampa'};kind=sl.k;sfx.whoosh();
    if(esC(T)){g.result='win';g.why='¡CLAC!';}else{g.result='lose';g.why='¡TRAMPOSO!';}}
  function golpe(){const k=sl.k,x=sl.x,y=sl.y;flyOut=flyOut||.001;
    if(k==='win'){nz(.05,.5);snd(2400,.03,'square',.12);snd(1100,.05,'square',.1,-500);snd(95,.3,'sine',.3,-50);}
    else if(k==='trampa'){nz(.04,.2);snd(300,.08,'square',.08,-120);snd(150,.3,'sawtooth',.07,-60);shake=.35;rat=.4;}
    else{sfx.thud();nz(.1,.25);shake=k==='mesa'?1:.6;rat=1;epaT=.9;henJ=0;for(const b of bot)b.wob=7;
      RV.forEach((r,i)=>(i||k==='epa')&&say('¡EPA!',...RP(r,0,i?74:58),'#ffe14d'));spawn(x,y,8,'bit',['#ffffff','#ffe14d'],240,500,.5);
      if(k==='mesa'){sfx.crash();for(const b of bot)b.down=true;
        for(const t of ch.tiles){const a=Math.atan2(t.y-y,t.x-x)+(Math.random()-.5)*1.2,d=34+Math.random()*70;t.sx=Math.cos(a)*d;t.sy=Math.sin(a)*d*.8;t.sr=(Math.random()-.5)*2.4;}}
      else{(bot[2].down?bot[0]:bot[2]).down=true;snd(1800,.12,'sine',.06);pop('¡AHÍ NO!',clamp(x,190,610),Math.max(200,y-44),'#ff4d5e',4);}}}
  /* pasado el congelado: todo lo que estaba en la mesa brinca */
  function suelta(){shake=1;rat=1;henJ=0;snd(2100,.12,'sine',.05);snd(2640,.14,'sine',.04);
    for(const b of bot){b.hop=0;b.wob=9;}
    spawn(sl.x,sl.y,10,'bit',['#ffffff','#ffe14d'],300,500,.5);spawn(mx(724),520,6,'feather',['#f1ece2','#ffffff'],160,300,.9);
    for(const r of RV)for(let j=0;j<r.n;j++){const[x,y]=RP(r,(j-(r.n-1)/2)*30,14);
      const f={x,y,vx:r.in[0]*(60+Math.random()*80)+(Math.random()-.5)*150,vy:r.in[1]*(60+Math.random()*80)+(Math.random()-.5)*150,t:0,life:.7+Math.random()*.4,vr:(Math.random()-.5)*16,a:Math.random()*6|0,b:Math.random()*6|0};
      /* que ninguna caiga encima de la cochina */
      if(Math.hypot(x+f.vx*f.life-sl.x,y+f.vy*f.life-sl.y)<TW*1.1){f.vx*=.3;f.vy*=.3;}fl.push(f);}}

  const g={get impact(){return this.result==='win'&&this.endT>=IMP?clamp(1-(this.endT-IMP)/.5,0,1):0;},
    probe:()=>{const R=hueco();return{lv,slot:R,cx:R.x+R.w/2,cy:R.y+R.h/2,mesa:{x:118,y:146,w:564,h:310},tile:FI[idx].slice(),cochina:esC(FI[idx]),idx,per:PER,n:NT,fichas:FI.map(f=>f.slice()),warned,kind,nud,tN,mir,caidas:bot.filter(b=>b.down).length,cadena:ch.tiles.map(t=>[t.x+off.x,t.y+off.y,Math.abs(Math.cos(t.rot))>.5?TW:U,Math.abs(Math.cos(t.rot))>.5?U:TW,t.a,t.b])};},
    t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡TRANCA!',hint:'TOCA EL HUECO cuando tengas el DOBLE SEIS (o ESPACIO)',
    press(){pega(null);},
    down(p){pega(p);},
    update(dt){g.t+=dt;swT+=dt;henJ+=dt;epaT=Math.max(0,epaT-dt);hintT=Math.max(0,hintT-dt);shake=Math.max(0,shake-dt*3.2);rat*=Math.exp(-5*dt);if(flyOut)flyOut+=dt;
      if(!g.result){const i=Math.floor(g.t/PER)%NT;if(i!==idx){idx=i;swT=0;const c=esC(FI[i]);snd(c?880:520,.04,'triangle',c?.05:.03);}
        if(!juega&&g.t>=g.dur*.3){juega=true;say('¡JUEGA, PUES!',196,258,'#ffffff');}
        if(lv===3&&!nud&&g.t>=tN){nud=true;nudT=0;rat=.5;nz(.08,.12);snd(120,.12,'sine',.12,-40);say('¡UPS!',...RP(emp,0,84),'#ffffff');for(const b of bot)b.wob=Math.max(b.wob,4);}}
      if(nud){nudT+=dt;const u=ease(clamp(nudT/.12,0,1));off.x=NDX*u;off.y=NDY*u;}
      for(const b of bot){b.wob*=Math.exp(-2.4*dt);b.hop+=dt;if(b.down)b.fall=Math.min(1,b.fall+dt*5);}
      for(const f of fl)f.t+=dt;
      if(sl){sl.t+=dt;if(!sl.hit&&sl.t>=IMP){sl.hit=true;golpe();}
        if(sl.k==='win'&&!sl.free&&sl.t>=IMP+FRZ){sl.free=true;suelta();}
        if(sl.k==='epa'&&sl.t>.38)sl=null;}
      if(!g.result){if(g.t>=g.dur){g.result='lose';kind='ahorca';g.why='¡AHORCADA!';idx=FI.findIndex(esC);snd(200,.2,'square',.05,-80);}}
      else{g.endT+=dt;const e=g.endT;
        if(kind==='win'){if(!evA&&e>=.3){evA=true;sfx.win();spawn(PBX+sg*30,PBY-190,24,'conf',CONF);snd(330,.5,'sawtooth',.045,300);}}
        else if(kind==='trampa'){if(!evA&&e>=.22){evA=true;sfx.lose();}
          if(!evB&&e>=.85){evB=true;sfx.whoosh();sfx.boing();pop('¡FUERA!',mx(220),516,'#ff4d5e',14,.9);}}
        else if(kind==='mesa'){if(!evA&&e>=.28){evA=true;sfx.lose();}}
        else{if(!evA&&e>=.3){evA=true;shake=.35;rat=.5;nz(.04,.3);snd(1900,.03,'square',.08);snd(110,.2,'sine',.2,-50);for(const b of bot)b.wob=4;}
          if(!evB&&e>=.42){evB=true;sfx.lose();}
          if(!evC&&e>=.7){evC=true;RV.forEach((r,i)=>i&&say('¡JA JA JA!',r.o[0]+r.in[0]*86,372,'#ffe14d'));}}}},
    draw(){
      const win=g.result==='win',eT=g.endT,e=win?eT-IMP-FRZ:-1,k=clamp(g.t/g.dur,0,1),sx=slot.x+off.x,sy=slot.y+off.y,C=!g.result&&esC(FI[idx]);
      const hit=!!(sl&&sl.hit),puesta=hit&&(sl.k==='win'||sl.k==='trampa'),ahor=kind==='ahorca',mesa=kind==='mesa'&&hit,tramp=kind==='trampa'&&hit,risa=ahor&&eT>.42;
      const sdir=ch.dx>0?0:PI;
      ctx.save();if(shake>0)ctx.translate(Math.sin(now*91)*9*shake,Math.cos(now*77)*7*shake);
      /* el patio: cemento, la cava y la gallina de siempre */
      wash(gameLeft(),0,GAME_VIEW.width,600,'#e2c7a0','#cfa97c');
      for(let i=1;i<6;i++)line([[i*134,88],[i*134,600]],2,'#c09a6c');for(let j=0;j<4;j++)line([[gameLeft(),150+j*130],[gameRight(),150+j*130]],2,'#c09a6c');
      rr(14,96,86,60,10,'#e8553d',4);rr(22,104,70,44,6,'#bfe9ff',3);for(const[x,y]of[[30,110],[62,126],[40,132]])rr(x,y,13,11,3,'#ffffff',2);
      ell(54,116,9,9,AMB,3);ell(54,116,3.5,3.5,'#3a2410',0);ell(78,136,9,9,AMB,3);ell(78,136,3.5,3.5,'#3a2410',0);
      {const hj=henJ<.6?Math.sin(PI*henJ/.6)*46:0,pk=hj?0:Math.max(0,Math.sin(now*5))*.3;ctx.save();ctx.translate(mx(724),552-hj);ctx.scale(-sg,1);ctx.rotate(pk+(hj?Math.sin(now*40)*.2:0));hen(0,0,.62,1);ctx.restore();}
      /* los rivales: cabeza y hombros (lo demás lo tapa la mesa) */
      RV.forEach((r,i)=>{let m=i===1?(k>.45?'angry':'calm'):i?'grin':'calm',talk=0,sw=0,bob=0,dn=1;
        if(win&&e>=0){m=['panic','yell','o'][i];talk=1;sw=2;dn=0;bob=-Math.abs(Math.sin(now*26+i))*3;}
        else if(tramp){m=r===acu?'yell':'angry';talk=r===acu?Math.abs(Math.sin(now*16)):0;dn=0;}
        else if(mesa){m='yell';talk=Math.abs(Math.sin(now*18+i));dn=0;sw=1;}
        else if(risa){m=i===1?'grin':'happy';bob=Math.abs(Math.sin(now*15+i*2))*5;dn=0;}
        else if(epaT>0){m=i===1?'yell':'o';talk=1;dn=0;}
        bust(Object.assign({},r.f,{x:r.o[0]+r.in[0]*(10+bob),y:r.o[1]+r.in[1]*(10+bob),s:.56,rot:r.rot,th:60,mood:m,talk,sweat:sw,down:dn,look:0,vein:m==='angry'||m==='yell'?1:0}));});
      /* la mesa de plástico con su mantel de flores */
      rr(118,146,564,322,26,PLAST,4.5);rr(130,158,540,298,16,CLOTH,3);
      for(let j=0;j<4;j++)for(let i=0;i<6;i++){const fx=166+i*92+(j%2)*46,fy=186+j*76;if(fx>650)continue;ell(fx,fy,10,4.5,'#e07fb2',0);ell(fx,fy,4.5,10,'#e07fb2',0);ell(fx,fy,3.2,3.2,'#ffd23f',0);}
      /* la libreta de los puntos y las chapas */
      ctx.save();ctx.translate(mx(164),200);ctx.rotate(-.12*sg);rr(-22,-30,44,60,3,BONE,3);line([[-22,-16],[22,-16]],2,'#2f7fe0');line([[0,-30],[0,30]],2,'#2f7fe0');
      for(let i=0;i<4;i++)line([[-17+i*4,-9],[-17+i*4,5]],2,INK);line([[-19,2],[-3,-8]],2,INK);line([[9,-9],[9,5]],2,INK);limb(26,-26,30,22,6,'#ffd23f',2.5);ctx.restore();
      for(const[x,y,c]of caps){const j=rat>.05?Math.abs(Math.sin(now*30+x))*6*rat:0;ell(x,y-j,7.5,7.5,c,2.5);ell(x,y-j,4,4,'#fff3c4',0);}
      /* la cadena: tiembla con cada golpe; si tumbaste la mesa, se desparrama */
      const ks=mesa?ease(clamp((eT-IMP)/.3,0,1)):0;
      ch.tiles.forEach((t,i)=>ficha(t.x+off.x+t.sx*ks+Math.sin(now*80+i*1.7)*4*rat,t.y+off.y+t.sy*ks+Math.cos(now*71+i*2.3)*3*rat,TW,t.a,t.b,t.rot+t.sr*ks+Math.sin(now*64+i)*.1*rat,3));
      /* el hueco: el borde amarillo ES el área que vale */
      if(!puesta&&!(ahor&&eT>=.3)&&!mesa){const pz=Math.sin(now*9)*3,q=PAD-3;rr(sx-TW/2,sy-U/2,TW,U,U*.16,dark(CLOTH,.4),0);
        line(closeP(rrP(sx-TW/2-q-pz/2,sy-U/2-q-pz/2,TW+2*q+pz,U+2*q+pz,U*.2)),6,hintT>0&&Math.sin(now*40)>0?'#ffffff':'#ffe14d');
        if(lv===1&&!g.result){const ay=sy-U/2-22-Math.abs(Math.sin(now*6))*10;poly([[sx-13,ay-16],[sx+13,ay-16],[sx,ay]],'#ffe14d',3.5);}}
      /* la ficha que cayó en el hueco */
      if(puesta){const z=1+.3*Math.max(0,1-(sl.t-IMP)/.1);
        if(win&&sl.t<IMP+FRZ+.1){estrella(sx,sy,TW*1.05,TW*.6,12,'#ffe14d');estrella(sx,sy,TW*.8,TW*.45,12,'#ffffff',0);}
        ficha(sx,sy,TW*z,sl.a,sl.b,win?sdir:sdir+.16*sg,3.5);
        if(tramp&&Math.sin(now*14)>-.4){const q=U*.62;line([[sx-q,sy-q],[sx+q,sy+q]],7,'#ff4d5e');line([[sx+q,sy-q],[sx-q,sy+q]],7,'#ff4d5e');}}
      if(ahor&&eT>=.3)ficha(sx,sy,TW*(1+.3*Math.max(0,1-(eT-.3)/.1)),6,ak,sdir,3.5);
      /* onda del golpe */
      if(hit){const t0=sl.t-IMP-(sl.k==='win'?FRZ:0);for(const dl of[0,.09]){const u=(t0-dl)/.42;if(u>0&&u<1){ctx.save();ctx.globalAlpha=1-u;line(closeP(ellP(sl.x,sl.y,TW*.5+u*300,(TW*.5+u*300)*.8,30)),9*(1-u)+2,'#ffffff');ctx.restore();}}}
      /* las frías: brincan, se bambolean, se caen */
      for(const b of bot){const j=b.hop<.34?Math.sin(PI*b.hop/.34):0,u=ease(b.fall),rock=Math.sin(now*17+b.ph)*b.wob*(b.down?.012:.035);
        ell(b.x+3,b.y,13+j*4,5,dark(CLOTH,.4),0);botella(b.x,b.y-j*18,b.fa*u+rock,1+j*.15);}
      /* la mosca de la fría */
      {const b=bot[1],o=Math.min(1,flyOut*2.2),fx=lerp(b.x+Math.cos(now*3.1)*22+Math.sin(now*9)*5,mx(770),o),fy=lerp(b.y-50+Math.sin(now*4.3)*14,70,o)+Math.sin(now*31)*2;
        if(o<1){ell(fx-3,fy-3,3.5,2.2,'#ffffff',0);ell(fx+3,fy-3,3.5,2.2,'#ffffff',0);ell(fx,fy,3.6,3,INK,0);}}
      /* manos de los rivales y sus fichas paradas de canto */
      RV.forEach((r,i)=>{const hw=r.n*15+14,hr=Math.atan2(r.in[0],-r.in[1]),sk=r.f.skin,sh=r.f.shirt,up=(win&&e>=0)||mesa||epaT>.3;
        const qS=Math.sign(-r.in[1]*(sx-r.o[0])+r.in[0]*(sy-r.o[1]))||1;
        if(!(win&&e>=0)&&!mesa)for(let j=0;j<r.n;j++){const[x,y]=RP(r,(j-(r.n-1)/2)*30,14);r.in[0]?rr(x-4,y-13,8,26,2,BONE,2.5):rr(x-13,y-4,26,8,2,BONE,2.5);}
        for(const q of[-1,1]){const A=RP(r,q*32,-4);let B=RP(r,q*hw,13+(i===1&&!g.result?Math.max(0,Math.sin(now*20))*3:0)),rot=hr;
          if(up){B=RP(r,q*(hw+20)+Math.sin(now*24+q+i)*7,12+Math.cos(now*21+i)*6);rot=hr+Math.sin(now*24+q+i)*.5;}
          else if(r===emp&&nud&&nudT<.3)B=RP(r,q*hw,13+34*Math.sin(PI*nudT/.3));
          else if(r===acu&&q===qS&&(tramp||ahor)){
            /* el dedo que te señala (o la mano que te quita el puesto) */
            const dx=sx-A[0],dy=sy-A[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
            if(tramp){const u=ease(clamp((eT-IMP-.08)/.18,0,1)),jab=Math.sin(now*18)*5,F=[lerp(B[0],sx-ux*(TW/2+64-jab),u),lerp(B[1],sy-uy*(TW/2+64-jab),u)];
              limb(A[0],A[1],F[0],F[1],20,sh,3.5);limb(F[0],F[1],F[0]+ux*50*u,F[1]+uy*50*u,13,sk,3.5);ell(F[0],F[1],19,18,sk,3.5);line([[F[0]-uy*8-ux*4,F[1]+ux*8-uy*4],[F[0]-uy*8+ux*8,F[1]+ux*8+uy*8]],2.5,dark(sk,.4));continue;}
            const u=eT<.3?ease(clamp((eT-.12)/.18,0,1)):1-ease(clamp((eT-.5)/.25,0,1));B=[lerp(B[0],sx-ux*(TW/2-6),u),lerp(B[1],sy-uy*(TW/2-6),u)];rot=Math.atan2(ux,-uy);}
          limb(A[0],A[1],B[0],B[1],15,sh,3.5);hand(B[0]+r.in[0]*5,B[1]+r.in[1]*5,rot,.8,sk);}});
      /* las fichas de ellos, por el aire */
      for(const f of fl){const u=Math.min(1,f.t/f.life),tt=Math.min(f.t,f.life);ficha(f.x+f.vx*tt,f.y+f.vy*tt,lerp(30,TW*.5,u)*(1+.8*Math.sin(PI*u)),f.a,f.b,f.vr*tt,3);}
      /* tú, en tu esquina */
      const te=tramp?eT-.85:-1;let m=C?'grin':epaT>0?'o':k>.6?'panic':'worry',bx=PBX,by=PBY,br=0,bs=.78,tk=0,sw=k>.6?2:k>.3?1:0,lids=0,arms=null;
      if(win&&e>=0){m='yell';tk=.5+.5*Math.abs(Math.sin(now*16));by=PBY-34-Math.abs(Math.sin(e*9))*18;bs=.9;sw=0;if(e>=.2){const w=Math.sin(now*18)*.25;arms=[{side:1,a:2.6+w,len:84,w:20},{side:-1,a:-2.6-w,len:84,w:20}];}}
      else if(tramp){m=te>0?'panic':'worry';sw=2;if(te>0){bx=PBX-sg*te*420;by=PBY-te*1150+te*te*520;br=-sg*te*11;tk=1;arms=[{side:1,a:2.2,len:80,w:20},{side:-1,a:-2.2,len:80,w:20}];}}
      else if(mesa){m=eT<.45?'o':'worry';sw=2;}
      else if(ahor){m='frown';lids=1;sw=1;}
      if(te>0)silla(PBX+sg*te*240,546-Math.abs(Math.sin(te*5))*110,te*8*sg);
      bust(Object.assign({},TU,{x:bx,y:by,s:bs,rot:br,th:110,mood:m,talk:tk,sweat:sw,lids,look:te>0?0:sg,arms}));
      if(te<=0&&!(win&&e>=0))tag(bx,by-bs*152);
      /* tu mano: el brazo sale de abajo, la ficha bien grande */
      const brazo=(x,y,s)=>limb(HX+34,700,x+10*s,y+66*s,30+26*s,TU.shirt,4.5);
      const mano=(x,y,s,rot,a,b)=>{brazo(x,y,s);ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);ell(8,50,46,38,TU.skin,4);ficha(0,0,180,a,b,0,4.5);limb(3,66,0,24,17,TU.skin,3.5);ctx.restore();};
      const ts=TW/180;
      if(win&&e>=.2){/* ya está celebrando con las dos manos arriba */}
      else if(sl&&sl.t<IMP+FRZ){const q=clamp(sl.t/IMP,0,1)**2,s1=puesta||sl.k==='win'||sl.k==='trampa'?ts:.62;mano(lerp(HX,sl.x,q),lerp(HY0,sl.y,q),lerp(1,s1,q),0,sl.a,sl.b);}
      else if(sl&&sl.k==='epa'){const v=ease(clamp((sl.t-IMP-FRZ)/.25,0,1)),T=FI[idx];mano(lerp(sl.x,HX,v),lerp(sl.y,HY0,v),lerp(.62,1,v),0,T[0],T[1]);}
      else if(sl&&sl.k==='mesa')mano(sl.x,sl.y+Math.max(0,sl.t-.55)**2*900,.62,0,sl.a,sl.b);
      else if(sl){const v=clamp((sl.t-IMP-FRZ)/.2,0,1),x=lerp(sl.x,HX,v),y=lerp(sl.y,660,ease(v)),s=lerp(ts,1,v);brazo(x,y,s);hand(x,y+20*s,0,3.4*s,TU.skin);}
      else if(ahor)mano(HX+Math.sin(now*50)*4,HY0,1,Math.sin(now*40)*.03,6,6);
      else{const T=FI[idx],pp=Math.max(0,1-swT/.09),jit=1+k*2.2;mano(HX+Math.sin(now*31)*jit,HY0+Math.cos(now*27)*jit*.7+pp*12,1-pp*.12,Math.sin(now*5)*.03+pp*.1,T[0],T[1]);}
      ctx.restore();
      /* lo que se gritan */
      if(win&&e>.25)bubble(mx(266),446,'¡LA COCHINAAA!',26,PBX+sg*36,by-bs*40);
      if(tramp&&eT>.3&&eT<1.9)bubble(mx(500),212,'ESA NO VA AHÍ, TRAMPOSO',20,acu.o[0]-acu.in[0]*8,acu.o[1]-34);
      if(mesa&&eT>.35)bubble(400,214,'¡TUMBASTE LA MESA, CHAMO!',20,400,152);
      if(ahor&&eT>.5)bubble(400,214,'¡TE AHORCAMOS LA COCHINA!',20,400,152);
      drawP();
    }};
  return g;
}

BUS.add('tranca',{name:'¡TRANCA!',mk:mkTranca,card:'LA COCHINA',num:'66'});
})();
