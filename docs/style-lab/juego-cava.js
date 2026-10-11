'use strict';
/* MiniCaos · laboratorio de estilos: ¡AGÁRRALA! (la cava de anime).
   Playa Grande, Choroní, vista desde el agua: el mar queda ABAJO y la arena seca ARRIBA. La cava blanca de anime (anime =
   poliestireno, no comiquitas), llena de hielo y refrescos, está casi en la orilla... y el tío está sentado encima
   comiéndose una empanada. Mientras el tío esté sentado la cava NO se mueve: jalarla antes de tiempo no es perder, pero te
   regaña (¡QUIETO!) y mientras regaña no mira el mar, así que con el olón se para más tarde: el primer jalón lo distrae
   0,55 s y cada jalón siguiente 0,3 s más que el anterior (tope: la ventana + 0,3 s). Quien machaca lo deja bravo hasta
   que la ola se lo lleva.
   Primero vienen una o dos OLITAS que se mueren antes de llegar ("esa es una olita"). El OLÓN se anuncia todo junto: el
   mar se chupa para atrás, crece la sombra, las gaviotas chillan y el tío sale corriendo (¡EL OLÓN!). Desde ahí hay una
   ventana para ARRASTRAR la cava hacia arriba hasta pasar la raya de la marea alta; ganas en cuanto la pasa.
   Nivel 1: ventana de 0,9 s. Nivel 2: 0,7 s, olitas más grandes y el olón más pegado a la última. Nivel 3: 0,5 s y la
   última olita es un AMAGUE (el mar se chupa un poquito, viene una ola mediana que casi toca la cava y el tío ni se para);
   el olón puede venir pegadito detrás.
   Ganas (¡SALVADA!): el olón se lleva la silla del tío, con la gallina de siempre surfeando encima, y sus cholas
   ("¡MIS CHOLAS!"); tú destapas la cava y la familia brinda.
   Pierdes (¡SALADA!): la ola le pega a la cava, la tapa sale volando y te cae de sombrero, y las botellas quedan
   flotando en el agua salada. Pierdes machacando (¡ADIÓS, TÍO!): el tío nunca se paró y la ola se lo lleva sentado en la
   cava, remando con una chola ("¡ESA NO ERA OLITA!"). No hacer nada también es ¡SALADA!
   Puntero: se agarra la cava (o al tío, o a ti: la zona es grande) y se arrastra hacia arriba; se puede dejar el dedo
   puesto esperando. Teclado: ↑ o ESPACIO, dos toques = dos jalones; antes de tiempo cada toque cuenta como jalón (regaño).
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.cava)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI;
const ANIME='#fdfdf6',GRIS='#dfe4ee',SHORT='#2f7fe0',ARENA='#f6e3b4',BOT=['#ff8a3d','#ff3b4e','#9b6bd1','#ffd23f','#5cd06a'];  /* refrescos: naranja, colita, uva, piña y limón */
const TIO={skin:'#c98a5a',shirt:'#fffdf2',pat:'tank',hat:'#e8d7a8',hair:'bald',hairCol:'#3b2a22',stache:1,brow:'thick',cheeks:1,chain:1,bw:60,hw:42,hh:40};
const pop=(s,x,y,col,r=10,life=.8)=>PT.push({x,y,vx:0,vy:-60,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
/* que ↑ no mueva la página mientras se juega ESTE juego */
addEventListener('keydown',e=>{if(gameId==='cava'&&e.code==='ArrowUp')e.preventDefault();});

/* ───────── utilería ───────── */
function botella(x,y,rot,col,s=1){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
  rr(-9,-14,18,34,6,col,3);rr(-5,-30,10,18,4,col,3);rr(-6,-35,12,7,2,'#c9ced6',2.5);rr(-9,-3,18,10,0,'#ffffff',0);ctx.restore();}
function tapa(x,y,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);rr(-82,-13,164,26,9,ANIME,4.5);rr(-68,-7,136,6,3,GRIS,0);ctx.restore();}
/* la cava de anime: (x, y) = centro de la base. open: 0 tapada, 1 destapada con los refrescos, 2 destapada y vacía */
function cava(x,y,rot,open){ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  for(const sg of[-1,1])line([[sg*66,-56],[sg*92,-42],[sg*64,-26]],6,'#e8a23d');
  if(open){rr(-70,-86,140,24,6,'#bfe9ff',3.5);if(open<2)for(let i=0;i<3;i++)botella(-42+i*40,-84,(i-1)*.22,BOT[i+1],.85);}
  poly([[-76,-72],[76,-72],[66,0],[-66,0]],ANIME,4.5);rr(-64,-62,128,9,4,GRIS,0);
  for(let i=0;i<8;i++)ell(-54+i*15+(i%2)*5,-42+(i*37)%30,2.6,2.6,'#cfd5e2',0);
  if(!open)tapa(0,-80);
  ctx.restore();}
/* la silla de playa del tío, con la gallina de siempre asoleándose (lentes de sol y todo) */
function silla(x,y,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  line([[-30,0],[-22,-34]],5,'#8f8fa8');line([[30,0],[22,-34]],5,'#8f8fa8');
  rr(-36,-96,72,64,10,'#ff5c8a',4);for(let i=0;i<3;i++)rr(-27+i*23,-93,9,58,0,'#fffdf2',0);
  poly([[-38,-38],[38,-38],[46,-18],[-46,-18]],'#ff5c8a',4);
  hen(-8,-52,.62,1);rr(7,-76,26,11,4,'#14101c',2.5);
  ctx.restore();}
function palma(x,y,h,lean){const tx=x+lean,ty=y-h;limb(x,y,tx,ty,16,'#a9713a',4);
  for(let i=0;i<5;i++){const a=-PI/2+(i-2)*.62,ex=tx+Math.cos(a)*80,ey=ty+Math.sin(a)*44+20;poly([[tx,ty-8],[lerp(tx,ex,.55),lerp(ty,ey,.3)-18],[ex,ey],[lerp(tx,ex,.5),lerp(ty,ey,.7)+4]],'#3aa86a',3.5);}
  ell(tx-7,ty+6,8,8,'#7a4f2a',3);ell(tx+7,ty+9,8,8,'#7a4f2a',3);}
function gaviota(x,y,s,f){line([[x-25*s,y-11*s*f],[x-9*s,y],[x,y+3*s],[x+9*s,y],[x+25*s,y-11*s*f]],4*s,'#3b3550');ell(x,y+3*s,8*s,5*s,'#ffffff',2.5);poly([[x+6*s,y+1*s],[x+16*s,y+4*s],[x+6*s,y+6*s]],'#ffb300',2);}
/* agua con el borde ondulado y su espuma */
const borde=(y,amp)=>{const p=[];for(let x=-20;x<=820;x+=40)p.push([x,y+Math.sin(x*.022+now*2.6)*amp]);return p;};
function agua(y,col,foam,amp=4){const p=borde(y,amp);poly(p.concat([[820,640],[-20,640]]),col,0);if(foam)line(p,foam,'#ffffff');}

/* ═════════ ¡AGÁRRALA!: sube la cava cuando venga el olón (y solo entonces) ═════════ */
function mkCava(){
  const rs=Math.sqrt(SP),lv=LV(),R=(a,b)=>a+Math.random()*(b-a),WIN=[.9,.7,.5][lv-1],ANG=.55,AMAX=WIN+.3,RI=.55/rs,FA=.7/rs,PB=.3/rs;
  const LINE=330,CX=404,Y0=462,YS=306,YR=530,YF=504,TX=570,VMAX=1100,IMP=.28,SEAT=156,TY=127,TS=.74,US=.84,DRY=[252,204],WASH=[640,440];
  /* el guion: 1 o 2 olitas (en el nivel 3 la última es el amague) y después el olón */
  const olas=[];{let tp=R(.95,1.25)/rs;const n=Math.random()<(lv===1?.5:.35)?1:2;
    for(let i=0;i<n;i++){const am=lv>=3&&i===n-1;olas.push({tp,amp:am?64:[44,52,56][lv-1]+R(-3,3),am,i,ev:0});tp+=R(1,1.25)/rs;}}
  const tA=olas[olas.length-1].tp+R([.8,.65,.45][lv-1],[1.3,1.2,1][lv-1])/rs,tHit=tA+WIN;
  let cy=Y0,cyT=Y0,cyE=Y0,seated=true,tUp=0,mad=0,grab=false,g0=0,c0=0,py=0,strain=0,shake=0,haul=0,cue=false,w0=0,ev=0,wet=YR,sq=0,nTug=0,used=false;
  /* hasta dónde llega el agua en la orilla */
  const mar=t=>{let y=YR+Math.sin(now*1.7)*3;
    for(const o of olas){const a=(t-o.tp+RI)/RI,b=(t-o.tp)/FA;if(a>0&&b<1)y-=o.amp*(b<0?ease(Math.min(1,a)):1-ease(b));
      if(o.am){const c=(t-o.tp+RI+PB)/(PB*1.4);if(c>0&&c<1)y+=24*Math.sin(PI*c);}}
    return t>tA?y+44*ease(clamp((t-tA)/(WIN*.4),0,1)):y;};
  /* jalar con el tío sentado: no se mueve nada y él se pone bravo (antes del olón, cada jalón lo distrae más) */
  function tug(){grab=false;strain=0;shake=1;nTug++;used=true;sfx.boing();snd(180,.12,'square',.05,-60);
    if(g.t<tA)mad=Math.min(AMAX,mad+ANG+.3*(nTug-1));
    say(['¡QUIETO!','¡ES UNA OLITA!','¡DEJA LA CAVA!'][(nTug-1)%3],CX-80,cy-SEAT-112,'#ffe14d');}
  function choque(y){shake=1;wet=LINE+4;sfx.crash();nz(.6,.12);spawn(CX,y,20,'bit',['#ffffff','#bfe9ff','#7fd0ff'],400,800,.8);pop('¡SPLASH!',CX+150,y-20,'#ffffff',12);}

  const g={get impact(){const u=this.endT-(this.result==='win'?IMP:0);return this.result&&u>=0?clamp(1-u/.5,0,1):0;},
    probe:()=>({tA,tHit,win:WIN,alarma:cue,libre:!seated,mad,cy,x:CX,y:cy-40,line:LINE,kind:g.kind,olas:olas.map(o=>({tp:o.tp,am:o.am}))}),
    t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,cmd:'¡AGÁRRALA!',hint:'OLITAS: ¡quieto!  ·  OLÓN: arrastra la cava hacia ARRIBA (o ↑ / ESPACIO x2)',
    /* teclado: cada toque es un jalón; hacen falta dos para pasar la raya */
    press(k){if(g.result||k==='down')return;used=true;if(seated){tug();return;}cyT=Math.max(YS,cyT-84);haul=1;},
    down(p){if(g.result||p.x<CX-140||p.x>TX+80||p.y<cy-290||p.y>cy+80)return;grab=true;used=true;g0=py=p.y;c0=cy;snd(660,.05,'square',.04,200);},
    move(p){if(!grab||g.result)return;py=p.y;if(seated){strain=clamp((g0-py)/40,0,1);if(g0-py>40&&g.t<tA)tug();}},
    up(){grab=false;strain=0;},
    update(dt){g.t+=dt;shake=Math.max(0,shake-dt*4);haul=Math.max(0,haul-dt*4);
      if(!g.result){mad=Math.max(0,mad-dt);wet=Math.min(wet,mar(g.t));
        for(const o of olas){if(o.ev<1&&g.t>=o.tp-RI-(o.am?PB:0)){o.ev=1;nz(.6/rs,.04);if(o.am)snd(190,.3,'sine',.05,-80);}
          if(o.ev<2&&g.t>=o.tp){o.ev=2;snd(520,.25,'sine',.02,-300);}}
        if(!cue&&g.t>=tA){cue=true;sfx.thud();snd(110,.7,'sawtooth',.08,-50);snd(1500,.18,'square',.05,-500);setTimeout(()=>snd(1700,.2,'square',.05,-600),160);}
        if(seated&&cue&&mad<=0){seated=false;tUp=g.t;strain=0;sfx.boing();pop('¡EL OLÓN!',CX+70,Y0-SEAT-104,'#ff4d5e',14,.9);}
        if(!seated){if(grab)cyT=clamp(c0+py-g0,YS,Y0);const y0=cy;cy+=clamp((cyT-cy)*Math.min(1,dt*20),-VMAX*dt,VMAX*dt);
          if((sq+=y0-cy)>24){sq=0;snd(900+Math.random()*600,.05,'sawtooth',.025,400);}}  /* el chillido del anime en la arena */
        if(!seated&&cy<=LINE-8){w0=clamp((g.t-tA)/WIN,0,1);cyE=LINE-10;grab=false;g.result='win';g.why='¡SALVADA!';sfx.win();spawn(CX,cy-110,22,'conf',CONF);}
        else if(g.t>=tHit){g.kind=seated?'tio':'ola';cyE=cy;grab=false;strain=0;g.result='lose';g.why=seated?'¡ADIÓS, TÍO!':'¡SALADA!';choque(cy-50);sfx.lose();}
        return;}
      g.endT+=dt;const u=g.endT-(g.result==='win'?IMP:0);
      if(g.result==='win'){cy+=(cyE-cy)*Math.min(1,dt*12);
        if(ev<1&&u>=0){ev=1;choque(LINE+60);}
        if(ev<2&&u>=.45){ev=2;sfx.cluck();}
        if(ev<3&&u>=.8){ev=3;sfx.ding();pop('¡SALUD!',110,196,'#ffe14d',8);}}
      else if(g.kind==='ola'){if(ev<1&&u>=.4){ev=1;for(let i=0;i<4;i++)setTimeout(()=>snd(420+i*90,.09,'sine',.07,-200),i*55);}  /* ploc, ploc: las botellas al agua */
        if(ev<2&&u>=.8){ev=2;sfx.boing();sfx.thud();spawn(WASH[0],WASH[1]-90,8,'★',['#ffe14d'],220,400,.8);}
        if(ev<3&&u>=1.25){ev=3;sfx.cluck();}}
      else{if(ev<1&&u>=.5){ev=1;sfx.boing();}if(ev<2&&u>=1.1){ev=2;sfx.cluck();}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,al=cue&&!g.result,e2=g.result?e-(win?IMP:0):-1,hit=e2>=0,tioE=lose&&g.kind==='tio',sc=mad>0;
      const q=!cue?0:win?lerp(w0,1,clamp(e/IMP,0,1)):lose?1:clamp((g.t-tA)/WIN,0,1);
      const nx=olas.find(o=>g.t<o.tp+.3/rs),rise=!cue&&!!nx&&g.t>nx.tp-RI-(nx.am?PB:0),uT=seated?0:clamp((g.t-tUp)/.5,0,1);
      /* lo que se lleva el agua: sube con la ola y después se va mar adentro, flotando */
      const fl=(x0,y0,x1,y1,ph)=>{const u=ease(clamp((e2-.3)/1.2,0,1));return[lerp(x0,x1,u)+Math.sin(now*3+ph)*5*u,lerp(y0,y1,u)-12*clamp(e2/.14,0,1)*(1-u)+Math.sin(now*5+ph)*4,Math.sin(now*4+ph)*.14];};
      ctx.save();if(hit&&shake>0)ctx.translate(0,Math.sin(now*55)*5*shake);
      /* cielo, los cerros de Choroní, palmas, el cartel y las gaviotas */
      wash(gameLeft(),0,GAME_VIEW.width,260,'#8fd8ff','#e8f8ff');
      poly([[-10,200],[-10,132],[80,100],[190,138],[320,104],[450,142],[590,108],[700,136],[810,112],[810,200]],'#3aa86a',4);
      palma(30,214,112,18);palma(776,214,122,-14);
      rr(612,112,184,42,6,'#c98a4e',4);txt('PLAYA GRANDE',704,126,15,'#fffdf2',0,true);txt('CHORONÍ',704,143,12,'#ffe14d',0,true);
      for(let i=0;i<3;i++){const gx=[176,368,534][i]+Math.sin(now*.7+i*2)*22+(al?Math.sin(now*40+i)*4:0),gy=[128,114,132][i]+Math.cos(now*.9+i)*5;
        gaviota(gx,gy,al?1.35:1,Math.sin(now*(al?30:6)+i));if(al)txt('¡!',gx+32,gy-12,22,'#ff4d5e',.2);}
      /* arena seca arriba, arena mojada abajo y la raya de la marea alta (algas y conchas) */
      rr(gameLeft()-10,184,GAME_VIEW.width+20,430,0,ARENA,0);line([[-10,184],[810,184]],4,INK);rr(gameLeft()-10,LINE,GAME_VIEW.width+20,300,0,'#e9cb8e',0);
      if(hit||wet<YR-4)rr(gameLeft()-10,hit?LINE+4:wet,GAME_VIEW.width+20,300,0,'#d6b677',0);
      for(let i=0;i<14;i++){const x=24+i*58+(i%3)*9,y=LINE+Math.sin(i*2.3)*5;if(i%3===1)ell(x,y,8,5,'#ff9ec7',2.5);else line([[x-12,y+3],[x-3,y-3],[x+8,y+2]],4,'#3aa86a');}
      txt('▲ ARENA SECA ▲',104,LINE-13,12,'#a8843f',0,true);
      if(al&&!seated&&Math.sin(now*24)>-.2)line([[gameLeft(),LINE-5],[gameRight(),LINE-5]],6,'#ffe14d');
      /* la familia bajo la sombrilla */
      const fm=win&&e2>.3?'happy':lose&&hit?'o':al?'panic':'smile',cheer=win&&e2>.6;
      line([[112,300],[120,152]],7,'#8f8fa8');poly(arcPts(120,160,102,PI,TAU,12,.56),'#ff5c8a',4);
      for(const i of[1,3])poly([[120,160]].concat(arcPts(120,160,102,PI+i*PI/5,PI+(i+1)*PI/5,3,.56)),'#fffdf2',0);
      rr(22,274,176,30,10,'#3fb0ff',3.5);
      bust(Object.assign({},FACES[7],{x:66,y:242,s:.56,th:66,mood:fm,look:1,down:1,talk:al?1:0,
        arms:cheer?[{side:1,a:2.6+Math.sin(now*10)*.2,len:62,w:19,hand:(hx,hy)=>botella(hx,hy-16,0,BOT[1],1)},{side:-1,a:-2.6,len:60,w:19}]:al?[{side:1,a:2.8,len:60,w:19},{side:-1,a:-2.8,len:60,w:19}]:null}));
      baby(140,262-(cheer?Math.abs(Math.sin(now*9))*8:0),.58,fm==='smile'?'calm':fm);
      /* el gag de fondo: el enterrado con cola de sirena, que no se entera de nada */
      bust(Object.assign({},FACES[6],{x:664,y:268,s:.5,th:40,mood:'sleep'}));
      ell(728,282,78,24,ARENA,3.5);poly([[790,274],[814,250],[806,282],[814,308]],ARENA,3.5);
      for(let i=0;i<4;i++)line(arcPts(692+i*24,284,9,PI,TAU,4),2.5,'#c9a868');
      txt('z',690+Math.sin(now*2)*4,214-(now*14)%22,15,'#ffffff',.2);
      /* las cholas y la silla del tío (hasta que el agua se las lleva) */
      if(!hit){chanclaP(296,478,.3,.62);chanclaP(330,486,-.25,.62);silla(206,464);}
      /* el mar: la orilla; después del golpe, la sábana de agua que sube hasta la raya y se devuelve */
      if(hit){ctx.save();ctx.globalAlpha=.8;agua(e2<.14?lerp(476,LINE+4,ease(e2/.14)):lerp(LINE+4,YF,ease(clamp((e2-.4)/1.15,0,1))),'#7fd0ff',9,6);ctx.restore();agua(YF+22,'#3fb0ff',0);}
      else{const y=mar(g.t);agua(y,'#7fd0ff',7);agua(Math.max(y+18,YR+12),'#3fb0ff',0);}
      /* el tío: de pie en la arena seca (ya corrió) o todavía encima de la cava */
      const sentado=(x,y,rot,o)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rot);cava(0,0,0,0);bust(Object.assign({},TIO,{x:0,y:-SEAT,s:US,th:96},o));
        ell(0,-96,50,14,SHORT,4);for(const sg of[-1,1]){limb(sg*24,-92,sg*30,-34,18,TIO.skin,3.5);ell(sg*32,-26,15,9,TIO.skin,3.5);}ctx.restore();};
      const dePie=()=>{const k=ease(uT),o={x:lerp(CX,DRY[0],k),y:lerp(Y0-SEAT,DRY[1],k)-Math.sin(PI*uT)*28,s:lerp(US,.78,k),th:104,legs:[SHORT,TIO.skin,50],mood:'yell',talk:1,sweat:2,
          arms:[{side:1,a:2.6+Math.sin(now*30)*.3,len:64,w:21},{side:-1,a:-2.6+Math.cos(now*30)*.3,len:64,w:21}]};
        if(uT>=1){if(win&&e2>.45)Object.assign(o,{talk:Math.abs(Math.sin(now*14)),down:1,sweat:0,arms:[{side:-1,a:-.5,len:86,w:21},{side:1,a:2.7,len:60,w:21}]});
          else if(win&&hit)Object.assign(o,{mood:'o',talk:0});
          else Object.assign(o,{mood:lose?'yell':'panic',talk:lose?Math.abs(Math.sin(now*16)):0,down:1,arms:[{side:1,a:2.75,len:58,w:21},{side:-1,a:-2.75,len:58,w:21}]});}
        bust(Object.assign({},TIO,o));};
      if(!seated&&uT>=.6)dePie();
      if(tioE){const f=fl(CX,cyE,452,604,1);sentado(f[0],f[1],f[2]+.08,{mood:'yell',talk:Math.abs(Math.sin(now*15)),look:1,sweat:2,
          arms:[{side:1,a:1.3+Math.sin(now*9)*.7,len:66,w:21,hand:(hx,hy)=>chanclaP(hx+6,hy+8,.5,.6)},{side:-1,a:-2.6,len:58,w:21}]});}
      else if(seated){const amg=rise&&nx.am&&g.t<nx.tp-.05,ch=Math.sin(now*9)>0;
        sentado(CX+(shake>0?Math.sin(now*60)*4*shake:0),cy-4*strain,strain*.03,{mood:sc?'angry':strain>.4?'worry':amg?'o':rise?'smile':'calm',look:sc||strain>.4?1:0,down:sc?0:1,vein:sc?1:0,teeth:sc?1:0,talk:sc?Math.abs(Math.sin(now*17)):0,
          arms:[{side:-1,a:2.5,len:34,w:21,hand:(hx,hy)=>poly(arcPts(hx,hy-4+(ch?2:0),17,PI,TAU,6),'#e8a23d',3)},sc?{side:1,a:2.2+Math.sin(now*22)*.3,len:60,w:21}:{side:1,a:.4,len:54,w:21}]});}
      else if(lose){const f=fl(CX,cyE,318,548,2);cava(f[0],f[1],.4+f[2],2);}
      else{cava(CX,cy,0,win&&e2>.7?1:0);if(win&&e2>.7)tapa(CX-18,cy+12,.05);}
      if(!seated&&uT<.6)dePie();
      /* tú: una mano en el asa de mecate; con el olón, las dos */
      {const hx=CX+88,hy=cy-44,o={s:TS,th:110,legs:['#2f3a7a','#ffffff',56],look:-1};let x=TX,y=cy-TY;
        const arm=(sd,tx,ty)=>{const lx=(tx-x)/TS-sd*39,ly=(ty-y)/TS-4;return{side:sd,a:Math.atan2(lx,ly),len:clamp(Math.hypot(lx,ly),30,230),w:20};};
        if(lose){const k=ease(clamp(e2/.3,0,1)),hat=!tioE&&e2>=.8;x=lerp(TX,WASH[0],k);y=lerp(cyE-TY,WASH[1],k);
          Object.assign(o,{legs:null,th:96,mood:hat?'dizzy':tioE&&e2>.3?'o':'yell',talk:hat||tioE?0:1,look:tioE?-1:0,sweat:2,arms:hat||tioE?[{side:1,a:.5,len:66,w:20},{side:-1,a:-.5,len:66,w:20}]:[{side:1,a:2.4,len:70,w:20},{side:-1,a:-2.4,len:70,w:20}]});}
        else if(win){const up=e2>.7;if(up)y-=Math.abs(Math.sin(now*9))*10;
          Object.assign(o,{mood:e2<0?'yell':e2<.45?'o':'happy',talk:e2<0?1:0,arms:[arm(-1,hx,hy),up?{side:1,a:2.75,len:80,w:20,hand:(a,b)=>botella(a,b-18,0,BOT[0],1.1)}:{side:1,a:.3,len:70,w:20}]});}
        else{const pull=strain>0||(!seated&&(grab||haul>0));
          Object.assign(o,{mood:!seated?(pull?'yell':'panic'):cue?'panic':shake>0?'frown':rise?'o':'worry',talk:pull&&!seated?1:0,down:1,sweat:cue?2:rise?1:0,arms:[arm(-1,hx,hy),pull?arm(1,hx,hy):{side:1,a:.25,len:70,w:20}]});}
        bust(Object.assign({},TU,o,{x,y}));
        if(lose){for(const sg of[-1,1]){limb(x+sg*16,y+56,x+sg*34,y+96,20,'#2f3a7a',3.5);ell(x+sg*38,y+102,15,9,'#ffffff',3.5);}
          if(!tioE){const u=clamp(e2/.8,0,1),hy2=WASH[1]-TS*106-14;tapa(lerp(CX,WASH[0],u),lerp(cyE-80,hy2,u)-Math.sin(PI*u)*170,u<1?u*TAU*2+.12:.12);
            if(u>=1)for(let i=0;i<3;i++){const a=now*5+i*TAU/3;txt('★',WASH[0]+Math.cos(a)*74,hy2-18+Math.sin(a)*8,20,'#ffe14d');}}}
        if(!used&&!g.result)tag(x,y-TS*106-26);}
      /* la silla con la gallina surfeando, y las botellas en el agua salada */
      if(hit){const f=fl(206,464,130,548,0),a=fl(296,478,560,536,3),b=fl(330,486,236,552,5);ell(f[0],f[1]-4,52,9,'#ffffff',0);silla(f[0],f[1],f[2]);
        chanclaP(a[0],a[1],.3+a[2]*3,.62);if(!tioE)chanclaP(b[0],b[1],-.25+b[2]*3,.62);
        if(lose&&!tioE)for(let i=0;i<5;i++){const lx=[150,268,410,512,728][i],ly=434+(i%2)*26,u=clamp(e2/.4,0,1);
          if(u<1)botella(lerp(CX,lx,u),lerp(cyE-80,ly,u)-Math.sin(PI*u)*(110+i*14),u*9+i,BOT[i],1.15);
          else{const f2=fl(lx,ly,lx+(i-2)*12,522+(i%3)*10,i*1.7);ell(f2[0],f2[1]+9,24,5,'#ffffff',0);botella(f2[0],f2[1],1.25+f2[2]*2.5,BOT[i],1.15);}}
        agua(566,'#3fb0ff',5);}
      /* el olón: la sombra por delante y la pared de agua que se levanta */
      if(cue&&!hit){const wy=606-152*(.35*q+.65*ease(q));
        ctx.save();ctx.globalAlpha=.18;rr(gameLeft()-10,wy-40-170*q,GAME_VIEW.width+20,300,0,'#14101c',0);ctx.restore();
        poly(borde(wy,10).concat([[820,640],[-20,640]]),'#2f7fe0',4.5);agua(wy+34,'#1f5fb8',0,8);
        for(let x=14;x<800;x+=62)ell(x+Math.sin(now*7+x)*6,wy+Math.sin(x*.022+now*2.6)*10-2,24,15,'#ffffff',3);
        if(!g.result)txt('¡¡OLÓN!!',150+Math.sin(now*60)*3,Math.min(516,wy-34),46,'#ff4d5e',-.06);}
      /* por aquí se sube */
      if(al&&!seated)for(let i=0;i<3;i++){const yy=cy-118-i*34-(now*100)%34;if(yy>LINE-120)poly([[CX,yy-16],[CX+24,yy+8],[CX-24,yy+8]],'#ffe14d',3.5);}
      /* lo que se dice */
      if(seated&&!sc&&rise&&!g.result)bubble(CX-136,188,nx.am?(g.t<nx.tp-RI*.4?'¿Y ESA...?':'OLITA TAMBIÉN'):nx.i?'OTRA OLITA...':'ESA ES UNA OLITA',17,CX-44,cy-SEAT-44);
      if(win&&e2>.45)bubble(396,130,'¡MIS CHOLAS!',20,296,156);
      if(lose&&!tioE&&e2>.35)bubble(404,130,'¡LOS REFRESCOS!',20,296,156);
      if(tioE&&e2>.5){const f=fl(CX,cyE,452,604,1);bubble(556,182,'¡ESA NO ERA OLITA!',18,f[0]+40,f[1]-SEAT-74);}
      ctx.restore();
      drawP();
    }};
  return g;
}
BUS.add('cava',{name:'¡AGÁRRALA!',mk:mkCava,card:'LA CAVA',num:'72'});
})();
