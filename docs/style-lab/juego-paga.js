'use strict';
/* MiniCaos · laboratorio de estilos: ¡PAGA Y CORRE! (el billete mocho).
   Un microjuego en dos tiempos: ¡DOBLA! (deslizar: el billete mocho se dobla hasta que no se le ve lo mocho y sale volando
   a la mano del colector) y ¡CORRE! (machacar: llega a la puerta de atrás antes de que el colector termine de desdoblarlo;
   cada doblez es un desdoblez, y ese desdoblar ES el reloj).
   Se carga después de index.html y juegos-bus.js: dibuja con sus primitivas y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.paga)return;
const{LV,CONF,TU,say,tag}=window.BUS;
/* el colector de ¡PARADA!: gorra pa' atrás, franela de pelotero, zarcillo y diente de oro */
const COL={skin:'#c98a5a',shirt:'#ffd23f',pat:'jersey',sh2:'#e8553d',cap:'#2b2b3a',capBack:1,hair:'curly',hairCol:'#14101c',earring:1,gold:1,teeth:1,bw:46,hw:36,hh:40};
const paper=()=>{nz(.07,.16);snd(1300,.05,'triangle',.03,-700);};
const wad=(x,y)=>{for(let i=0;i<3;i++){ctx.save();ctx.translate(x,y-8);ctx.rotate(-.4+i*.35);rr(-3,-30,26,38,3,['#5cd06a','#7be48a','#48b85a'][i],2.5);ctx.restore();}};
const BW=440,BH=210,BG='#bfe8b0',BD='#2f8f5a',BB='#9fd69a';
/* el billete inventado: CINCO CAOS del Banco de MiniCaos, con la esquina de arriba (la del número) arrancada */
function billete(){
  poly([[-220,-105],[110,-105],[104,-78],[140,-74],[134,-46],[172,-40],[168,-14],[220,-4],[220,105],[-220,105]],BG,4.5);
  line([[92,-91],[-206,-91],[-206,91],[206,91],[206,12]],3,BD);
  ell(0,4,60,70,'#e8f8dc',3.5);hen(-14,26,.95,1);
  txt('5',-168,-52,46,BD,0,true);txt('5',168,58,46,BD,0,true);
  txt('BANCO DE MINICAOS',-64,-76,14,BD,0,true);txt('CINCO',-134,12,22,BD,0,true);txt('CAOS',-134,38,22,BD,0,true);txt('MC 000123',132,-2,12,BD,0,true);
  line([[-78,105],[-70,74],[-82,56]],2.5,BD);ctx.save();ctx.translate(-76,74);ctx.rotate(-.5);rr(-22,-8,44,16,2,'#fff3c4',2);ctx.restore();}
/* el dorso: lo que se ve ya doblado (n capas debajo) */
function dorso(w,h,n){for(let i=Math.min(n,3);i>0;i--)rr(-w/2+i*4,-h/2+i*4,w,h,4,dark(BB,.1+i*.07),3.5);
  rr(-w/2,-h/2,w,h,4,BB,4.5);if(w>46&&h>46){line(closeP(rrP(-w/2+9,-h/2+9,w-18,h-18,3)),2.5,BD);txt('5',0,2,Math.min(w,h)*.42,BD,0,true);}}

function mkPaga(){
  const rs=Math.sqrt(SP),lv=LV(),NF=lv>1?3:2,need=[10,13,15][lv-1],DUR=5.5/rs,T1=DUR*.4,FD=.16/rs,FL=.4/rs;
  const BX=400,BY=400,X0=330,X1=644,FY=524,PY=FY-136,STEP=(X1-X0)/need,CX=150,CY=FY-170,CS=.8,SX=CX+CS*36,SY=CY+CS*6;
  const folds=[];let ph=1,nf=0,fa=null,w=BW,h=BH,ox=0,oy=0,hold=0,nud=0,sw0=null,swOn=false;
  let t2=0,tC=1e9,UI=1,open=0,caught=false,px=X0,taps=0,lunge=0,runA=0,scroll=0,flash=0,grabbed=false,yelled=false,out=false,late=false,got=false,kind='';
  /* ── fase 1: doblar ── */
  function endFold(){if(fa.ax==='h'){ox+=fa.d*w/4;w/=2;}else{oy+=fa.d*h/4;h/=2;}folds.push(fa.ax);fa=null;}
  /* d = hacia dónde va el dedo: la mitad de atrás se monta sobre la de adelante. El primer doblez siempre tapa lo mocho. */
  function fold(ax,d){if(g.result||ph!==1||nf>=NF)return;if(fa)endFold();if(!nf)d=ax==='h'?1:-1;fa={ax,d,u:0};nf++;paper();snd(420+nf*140,.09,'square',.05);
    say(['¡EN DOS!','¡EN CUATRO!','¡EN OCHO!'][nf-1],BX+ox,BY+oy-h/2-36,'#ffe14d');}
  const nudge=()=>{if(g.result||ph!==1||nud>0)return;nud=.5;snd(200,.06,'square',.03);say('¡DESLIZA!',BX,BY-h/2-36,'#ffffff');};
  const swipe=p=>{const dx=p.x-sw0.x,dy=p.y-sw0.y;if(Math.hypot(dx,dy)<60)return false;swOn=false;Math.abs(dx)>=Math.abs(dy)?fold('h',Math.sign(dx)):fold('v',Math.sign(dy));return true;};
  function hoja(){const pre=nf-(fa?1:0),sh=()=>pre?dorso(w,h,pre):billete();
    if(!fa){sh();return;}
    const c=Math.cos(Math.PI*ease(fa.u)),H=fa.ax==='h',d=fa.d;
    ctx.save();ctx.beginPath();if(H)ctx.rect(d>0?0:-w/2-14,-h/2-14,w/2+14,h+28);else ctx.rect(-w/2-14,d>0?0:-h/2-14,w+28,h/2+14);ctx.clip();sh();ctx.restore();
    if(Math.abs(c)<.06)return;
    ctx.save();if(H)ctx.scale(c,1);else ctx.scale(1,c);
    if(c>0){ctx.beginPath();if(H)ctx.rect(d>0?-w/2-14:0,-h/2-14,w/2+14,h+28);else ctx.rect(-w/2-14,d>0?-h/2-14:0,w+28,h/2+14);ctx.clip();sh();}
    else if(H)rr(d>0?-w/2:0,-h/2,w/2,h,4,BB,4.5);else rr(-w/2,d>0?-h/2:0,w,h/2,4,BB,4.5);
    ctx.restore();}
  /* ── fase 2: correr ── */
  const dims=k=>{let a=BW,b=BH;for(let i=0;i<NF-k;i++)if(folds[i]==='h')a/=2;else b/=2;return[a,b];};
  function startRun(){ph=2;t2=g.t;tC=t2+FL;UI=(g.dur-tC)/NF;flash=1;g.cmd='¡CORRE!';g.hint='TOCA RÁPIDO (o ESPACIO): corre a la puerta de atrás antes de que lo desdoble';sfx.whoosh();PT.length=0;say('¡AHÍ VA!',X0+10,PY-150,'#ffffff');}
  function step(){if(g.result||ph!==2)return;taps++;lunge=1;px=Math.min(X1,px+STEP);snd(170+(taps%5)*26,.07,'square',.045);
    if(taps>=need){px=X1;g.result='win';g.why='¡CORONASTE!';sfx.win();spawn(724,330,20,'conf',CONF);}}
  /* el billete en la mano del colector: se va abriendo un doblez por tramo */
  const held=(hx,hy)=>{const full=open>=NF,u=clamp((g.t-tC)/UI,0,NF-.001),k=Math.floor(u),q=ease(clamp((u-k-.6)/.4,0,1)),a=dims(k),b=dims(k+1),S=full?.46:.4;
    ctx.save();ctx.translate(hx+(full?-46:-30),hy+(full?-60:-30));ctx.rotate(-.06+Math.sin(now*(full?44:8))*(full?.07:.03+q*.2));ctx.scale(S,S);
    if(full){billete();if(Math.sin(now*18)>0)line(closeP(ellP(166,-60,74,66,18)),9,'#ff4d5e');}else dorso(lerp(a[0],b[0],q),lerp(a[1],b[1],q),NF-k-(q>.5?1:0));
    ctx.restore();};
  function espejo(mad,z){ctx.save();ctx.translate(150,166);ctx.scale(z,z);line([[0,-34],[0,-20]],6,'#3b3550');rr(-62,-22,124,46,12,'#2d2640',4);
    if(mad){rr(-55,-16,110,34,8,COL.skin,0);for(const sg of[-1,1]){ell(sg*24,3,14,12,'#ffffff',3);ell(sg*24+6,4,5,6,INK,0);limb(sg*40,-15,sg*9,-5,6,COL.hairCol,2);}}
    else{rr(-55,-16,110,34,8,'#bfe9ff',0);line([[-40,8],[-22,-10]],4,'#ffffff');line([[-24,8],[-12,-4]],3,'#ffffff');}
    ctx.restore();}

  function drawDobla(){
    const lose=g.result==='lose',e=g.endT,k=clamp(g.t/T1,0,1),pop=lose?ease(clamp(e/.2,0,1)):0,cx=BX+ox+(nud>.3?Math.sin(now*60)*5:0),cy=BY+oy,done=nf>=NF;
    wash(0,0,800,600,'#f6e3b4','#ecd29a');
    rr(0,92,800,36,0,'#d9dce6',0);line([[0,128],[800,128]],4,INK);txt('NO SE ACEPTAN BILLETES MOCHOS',560,110,13,INK,0,true);
    /* el parabrisas al fondo, con la gallina de siempre en el tablero */
    rr(290,142,480,146,14,'#5a4a78',4.5);
    ctx.save();path(rrP(298,150,464,130,8));ctx.clip();wash(298,150,464,130,'#8fd8ff','#e8f8ff');
    rr(298,176,130,110,4,'#ffb36b',3);rr(636,166,130,120,4,'#a9a0ff',3);poly([[430,284],[640,284],[552,206],[516,206]],'#4d4a6e',0);
    for(let i=0;i<4;i++){const u=(i/4+now*.9)%1;rr(533-u*5,206+u*u*76,3+u*10,5+u*14,2,'#ffe14d',0);}
    ctx.restore();
    const fw=Math.sin(now*3)*.2;ctx.save();ctx.translate(470,150);ctx.rotate(fw);line([[0,0],[0,34]],2.5,INK);poly([[0,30],[14,58],[-14,58]],'#3aa86a',3);ctx.restore();
    rr(280,268,500,30,8,'#2d2640',4);hen(700,252,.55,-1);
    /* el colector, volteado sobre el espaldar, con la mano estirada */
    bust(Object.assign({},COL,{x:lerp(108,190,pop),y:lerp(306,326,pop)+(lose?Math.sin(now*40)*1.5:0),s:lerp(.9,1.25,pop),th:120,look:lose||k>.7?1:-1,down:lose?1:0,
      mood:lose||k>.7?'angry':'grin',vein:lose||k>.85?1:0,rot:lose?.1:Math.sin(now*3)*.03}));
    rr(24,302,752,330,44,'#3fa0ff',4.5);rr(70,324,660,20,10,'#6fbcff',0);
    if(!lose){const wg=Math.sin(now*(k>.7?22:12))*4;limb(160,300,226,280+wg*.4,20,COL.skin,3.5);hand(240,270+wg,1.1,1.5,COL.skin);
      if(g.t<1.1/rs)bubble(330,196,'¡EL PASAJE!',22,176,236);else if(k>.66&&!done)bubble(330,196,"¡ES PA' HOY!",22,176,236);}
    /* tus manos y el billete */
    const sc=lose?lerp(Math.max(w/BW,h/BH),1,pop):1,hw=lose?lerp(w,BW,pop)/2:w/2,hh=lose?lerp(h,BH,pop)/2:h/2,tr=lose?Math.sin(now*50)*2:0;
    const bx=lose?lerp(cx,BX,pop):cx,by=lose?lerp(cy,BY,pop):cy;
    for(const sg of[-1,1]){const hx=bx+sg*Math.max(hw-18,16)+tr,hy=by+hh-4;limb(400+sg*330,650,hx+sg*10,hy+30,54,TU.shirt,4.5);ell(hx,hy+10,30,26,TU.skin,4);}
    ctx.save();ctx.translate(bx,by);
    if(lose){ctx.scale(sc,sc);billete();if(pop>=1&&Math.sin(now*16)>0)line(closeP(ellP(166,-60,74,66,18)),7,'#ff4d5e');}
    else{hoja();
      if(!done&&!fa){const u=(now*1.3)%1,ax=lerp(-w*.26,w*.26,u);ctx.globalAlpha=Math.sin(u*Math.PI)*.9;poly([[ax-30,-10],[ax,-10],[ax,-22],[ax+26,0],[ax,22],[ax,10],[ax-30,10]],'#ffe14d',3.5);}}
    ctx.restore();
    for(const sg of[-1,1]){const hx=bx+sg*Math.max(hw-18,16)+tr,hy=by+hh-4;ell(hx-sg*8,hy-10,13,21,TU.skin,3.5);}
    if(!lose){for(let i=0;i<NF;i++)ell(400+(i-(NF-1)/2)*34,552,11,11,i<nf?'#5cff7a':'#fff3c4',3.5);
      /* marca en el reloj: hasta aquí hay chance de doblar */
      if(!done)poly([[430,85],[441,102],[419,102]],'#ff4d5e',3);}
    if(lose&&e>.15)bubble(500,196,'¿Y ESO QUÉ ES?',26,250,250);
  }

  function drawBus(){
    const win=g.result==='win',lose=g.result==='lose',e=g.endT,mad=lose&&kind==='grab',rem=caught?clamp((g.t-tC)/(g.dur-tC),0,1):0;
    ctx.save();if(mad&&e<.35)ctx.translate(Math.sin(now*70)*4*(1-e/.35),0);
    wash(0,0,800,600,'#f6e3b4','#ecd29a');
    rr(0,92,800,36,0,'#d9dce6',0);line([[0,128],[800,128]],4,INK);txt('NO SE ACEPTAN BILLETES MOCHOS',440,110,13,INK,0,true);
    line([[250,150],[650,150]],8,'#c4cad6');
    for(let i=0;i<4;i++){const x=290+i*104,sw=Math.sin(now*2+i)*2;line([[x,150],[x+sw,178]],4,'#3b3550');line(closeP(ellP(x+sw,190,10,12,10)),4,'#ffd23f');}
    /* el frente queda a la izquierda: parabrisas y ventanas con la calle pasando */
    rr(-16,146,52,300,10,'#5a4a78',4.5);rr(-16,154,44,284,6,'#bfe9ff',0);
    for(let i=0;i<4;i++){const wx=56+i*150;rr(wx,200,130,118,12,'#5a4a78',4.5);
      ctx.save();path(rrP(wx+6,206,118,106,8));ctx.clip();wash(wx,200,130,118,'#8fd8ff','#e8f8ff');
      for(let j=0;j<6;j++){const bx=((j*170+scroll)%1020+1020)%1020-120;rr(bx,236+(j%3)*16,128,100,4,['#ffb36b','#a9a0ff','#ff9ec7','#6ecf8f','#ffd23f','#8aa0ff'][j],3);}
      ctx.restore();}
    /* asientos: la doña dormida y la gallina */
    for(let i=0;i<3;i++){const sx=274+i*126;rr(sx,356,104,170,18,'#3fa0ff',4);rr(sx+10,340,84,40,14,'#6fbcff',3.5);}
    hen(590,326,.6,1);
    bust(Object.assign({},FACES[2],{x:452,y:440,s:.6,th:90,bw:50,mood:mad&&e>.3?'o':'sleep',rot:mad?0:Math.sin(now*2)*.05}));
    if(!mad)txt('z',492,356+Math.sin(now*3)*5,20,'#ffffff',.2);
    for(let i=0;i<3;i++)rr(270+i*126,484,112,42,12,'#2f7fe0',4);
    rr(0,FY,800,80,0,'#5a5274',0);line([[0,FY],[800,FY]],5,INK);for(let i=0;i<9;i++)rr(i*95-10,FY+34,56,6,3,'#6f6790',0);
    /* la puerta de atrás, abierta y con la calle corriendo */
    rr(654,140,146,FY-132,10,'#2d2640',4.5);
    ctx.save();path(rrP(664,150,128,FY-150,6));ctx.clip();wash(664,150,128,300,'#8fd8ff','#e8f8ff');
    for(let j=0;j<3;j++){const bx=(j*190+scroll*1.4)%570+560;rr(bx,250+(j%2)*30,120,200,4,['#ffb36b','#a9a0ff','#6ecf8f'][j],3);}
    rr(664,430,128,FY-430,0,'#d8d2c4',0);line([[664,430],[792,430]],4,INK);ctx.restore();
    rr(654,FY-6,146,14,4,'#ffd23f',3.5);rr(672,96,112,34,8,'#c4283a',3.5);txt('BAJADA',728,114,17,'#ffffff',0,true);
    if(!g.result&&Math.sin(now*14)>0)line(closeP(rrP(658,144,138,FY-140,10)),6,'#ffe14d');
    /* el colector en el puesto de copiloto: de espaldas a ti, desdoblando */
    rr(92,350,120,176,18,'#e8553d',4);rr(102,334,100,40,14,'#ff8a6b',3.5);
    const gk=mad?ease(clamp((e-.3)/.25,0,1)):0,pull=grabbed?48+Math.sin(now*26)*10:0,gx=px-42-pull,gy=PY+14,ax=lerp(SX+34,gx,gk),ay=lerp(SY+12,gy,gk);
    if(gk>0)limb(SX,SY,ax,ay,20,COL.shirt,4);
    bust(Object.assign({},COL,{x:CX,y:CY+(mad?Math.sin(now*40)*2:0),s:CS,th:120,look:mad&&e>.22?1:-1,down:!mad&&caught?1:0,
      mood:mad?(e>.22?'yell':'o'):caught?(rem>.66?'angry':'calm'):'grin',talk:mad?Math.abs(Math.sin(now*18)):0,vein:mad?1:0,
      arms:mad?[{side:-1,a:-2.95,len:80,w:20,hand:held}]:caught?[{side:-1,a:-2.3+Math.sin(now*9)*.05,len:58,w:20,hand:held},{side:1,a:-.9,len:50,w:20,hand:wad}]
        :[{side:-1,a:-.5,len:50,w:20},{side:1,a:1.9+Math.sin(now*24)*.12,len:58,w:20}]}));
    rr(86,478,132,48,12,'#c4283a',4);
    espejo(mad,mad?1+.4*ease(clamp(e/.15,0,1)):1);
    /* el billete doblado, por el aire */
    if(!caught){const u=clamp((g.t-t2)/FL,0,1);ctx.save();ctx.translate(lerp(X0-20,SX+50,u),lerp(PY-30,CY-20,u)-Math.sin(u*Math.PI)*110);ctx.rotate(u*11);ctx.scale(.36,.36);dorso(w,h,NF);ctx.restore();}
    /* tú */
    const hop=win?Math.abs(Math.sin(e*9))*30:0,sw=Math.cos(runA),fl=Math.sin(now*30)*.7;
    bust(Object.assign({},TU,{x:px+lunge*8,y:PY-lunge*8-hop+(grabbed?Math.sin(now*50)*3:0),s:.8,look:1,th:110,legs:['#2f3a7a','#ffffff',60],
      mood:win?'happy':grabbed?'panic':lunge>.3?'yell':rem>.6?'panic':'worry',talk:grabbed?Math.abs(Math.sin(now*20)):lunge,sweat:win?0:rem>.4?2:1,rot:win?0:grabbed?.22:.1+lunge*.08,
      arms:win?[{side:1,a:2.7,len:80,w:20},{side:-1,a:-2.7,len:80,w:20}]:grabbed?[{side:1,a:1.5+fl,len:74,w:20},{side:-1,a:1.2-fl,len:66,w:20}]
        :!caught&&!taps?[{side:-1,a:-2.3,len:76,w:20},{side:1,a:.3,len:66,w:20}]:[{side:1,a:1.2+sw*.8,len:72,w:20},{side:-1,a:.5-sw*.8,len:66,w:20}]}));
    if(gk>0){if(grabbed)poly([[px-18,PY-8],[px-18,PY+52],[gx+8,gy+10],[gx+8,gy-10]],TU.shirt,3.5);hand(ax+8,ay,Math.PI/2,1.5,COL.skin);}
    tag(px,PY-114-hop);
    ctx.restore();
    if(mad&&e>.3)bubble(440,222,'¡EPA, ESTO ESTÁ MOCHO!',22,CX+26,CY-84);
    if(flash>0){ctx.save();ctx.globalAlpha=clamp(flash*3,0,1);txt('¡CORRE!',520,250,40+16*(1-flash),'#ffe14d',-.05);ctx.restore();}
  }

  /* ganaste: ya estás en la acera y la camionetica se va con el colector asomado (el grito llega tarde) */
  function drawCalle(){
    const e=g.endT-.32,bx=70-40*e-300*e*e,hop=Math.abs(Math.sin(e*8))*24*Math.max(0,1-e*.45),MX=650,MY=402-hop;
    wash(0,0,800,430,'#8fd8ff','#e8f8ff');ell(700,160,34,34,'#ffe14d',0);
    [[20,210,150,220,'#ffb36b'],[190,170,130,260,'#a9a0ff'],[340,220,170,210,'#ff9ec7'],[530,190,140,240,'#6ecf8f'],[690,230,130,200,'#ffd23f']].forEach(([x,y,ww,hh,c])=>{rr(x,y,ww,hh,6,c,3.5);for(let i=0;i<3;i++)rr(x+14+i*(ww/3.4),y+20,ww/5,26,4,'#ffffff',2.5);});
    rr(0,430,800,100,0,'#4d4a6e',0);rr(0,424,800,10,0,'#d8d2c4',0);for(let i=0;i<5;i++)rr(i*180-30,486,90,8,4,'#ffe14d',0);
    ctx.save();ctx.translate(bx,Math.sin(now*34)*1.4);
    for(let i=0;i<3;i++){const u=(now*1.6+i/3)%1;ctx.save();ctx.globalAlpha=.5*(1-u);ell(540+u*70,444-u*30,12+u*22,10+u*16,'#d8d2c4',0);ctx.restore();}
    rr(0,190,520,262,38,'#ff6b3d',5);rr(0,190,520,34,26,'#fff3c4',4);rr(2,376,516,34,0,'#ffd23f',0);rr(2,410,516,12,0,'#2f7fe0',0);line([[2,376],[518,376]],4,INK);line([[2,422],[518,422]],4,INK);
    txt('PAGUE COMPLETO  ·  DIOS LO VE',196,394,15,INK,0,true);
    for(let i=0;i<3;i++){const wx=34+i*114;ctx.save();path(rrP(wx,236,96,112,10));ctx.clip();ctx.fillStyle=STY[style].col('#5a4a78');ctx.fillRect(wx,236,96,112);
      bust(Object.assign({},FACES[[6,4,10][i]],{x:wx+48,y:352,s:.56,th:50,bw:50,look:1,mood:['o','happy','worry'][i]}));ctx.restore();line(closeP(rrP(wx,236,96,112,10)),6,'#c9ced6');}
    rr(386,214,112,238,12,'#2d2640',4.5);
    bust(Object.assign({},COL,{x:446,y:352+Math.sin(now*30)*2,s:.72,th:104,look:1,mood:'yell',talk:Math.abs(Math.sin(now*18)),vein:1,rot:.1,
      arms:[{side:1,a:2.4+Math.sin(now*20)*.3,len:84,w:20,hand:e<.45?(hx,hy)=>{ctx.save();ctx.translate(hx+10,hy-30);ctx.rotate(Math.sin(now*40)*.1);ctx.scale(.4,.4);billete();ctx.restore();}:null},{side:-1,a:-1.2,len:60,w:20}]}));
    for(const wx of[104,330]){ell(wx,460,42,42,'#14101c',3);ell(wx,460,17,17,'#c9ced6',3);}
    ctx.restore();
    rr(0,520,800,90,0,'#d8d2c4',0);line([[0,520],[800,520]],5,INK);pole(64,330,596);rr(22,300,84,44,8,'#2f7fe0',4.5);txt('PARADA',64,322,15,'#ffffff',0,true);dog(150,590,1);
    /* tú, y el billete mocho que se le va de la mano y te vuelve */
    const HX=MX-120,HY2=MY-104,u=clamp((e-.45)/.8,0,1);
    bust(Object.assign({},TU,{x:MX,y:MY,s:1,th:110,legs:['#2f3a7a','#ffffff',60],mood:got?'grin':'happy',look:-1,rot:Math.sin(e*8)*.05,
      arms:[{side:-1,a:got?-2.45:-2.6+Math.sin(now*12)*.3,len:84,w:22},{side:1,a:got?.5:2.6+Math.sin(now*12)*.3,len:84,w:22}]}));
    tag(MX,MY-142);
    if(e>=.45){ctx.save();ctx.translate(lerp(505,HX,ease(u))+Math.sin(u*14)*30*(1-u),lerp(286,HY2,u)-Math.sin(u*Math.PI)*90);ctx.rotate(got?-.2+Math.sin(now*10)*.06:Math.sin(now*9)*.7);ctx.scale(.32,.32);billete();ctx.restore();}
    if(e>.35)bubble(clamp(bx+420,196,560),150,'¡EPA, ESTO ESTÁ MOCHO!',22,Math.max(-30,bx+450),278);
  }

  const g={lr:true,get impact(){return this.result?clamp(1-this.endT/.5,0,1):0;},probe:()=>({ph,nf,NF,w,h,px,taps,need,open,caught,t2,tC,T1,kind}),
    t:0,dur:DUR,result:null,why:'',endT:0,cmd:'¡DOBLA!',hint:'DESLIZA el dedo (o las FLECHAS): dobla el billete mocho bien chiquito',
    press(k){if(ph===2)step();else if(k==='left'||k==='right')fold('h',k==='left'?-1:1);else if(k==='up'||k==='down')fold('v',k==='up'?-1:1);else nudge();},
    down(p){if(ph===2)step();else if(!g.result){sw0=p;swOn=true;}},
    move(p){if(swOn&&ph===1)swipe(p);},
    up(p){if(swOn&&ph===1&&!swipe(p))nudge();swOn=false;},
    update(dt){g.t+=dt;scroll+=dt*300;lunge=Math.max(0,lunge-dt*6);nud=Math.max(0,nud-dt);flash=Math.max(0,flash-dt*2.6);
      const u=Math.min(1,dt*12);ox+=-ox*u;oy+=-oy*u;runA+=(taps*Math.PI-runA)*Math.min(1,dt*22);
      if(fa&&(fa.u+=dt/FD)>=1)endFold();
      if(!g.result){
        if(ph===1){if(nf>=NF){if(!fa&&(hold+=dt)>=.12/rs)startRun();}
          else if(g.t>=T1){g.result='lose';kind='lento';g.why='¡TE PILLÓ!';swOn=false;sfx.boing();sfx.lose();spawn(BX,BY+70,8,'bit',['#9fe3ff'],200,600,.6);}}
        else{if(!caught&&g.t>=tC){caught=true;snd(660,.07,'square',.05,200);say('¡DALE!',CX+20,CY-150,'#ffe14d');}
          const k=Math.min(NF-1,Math.floor((g.t-tC)/UI));if(k>open){open=k;paper();say('¡RAS!',64,246,'#ffffff');}
          if(g.t>=g.dur){open=NF;g.result='lose';kind='grab';g.why='¡TE AGARRÓ!';paper();sfx.thud();sfx.lose();}}}
      else{g.endT+=dt;
        if(g.result==='win'){px=Math.min(790,px+420*dt);
          if(!out&&g.endT>=.32){out=true;sfx.thud();spawn(650,300,22,'conf',CONF);}
          if(!late&&g.endT>=.67){late=true;snd(240,.35,'sawtooth',.05,-90);}
          if(!got&&g.endT>=1.57){got=true;sfx.ding();spawn(530,296,5,'♥',['#ff4d6d'],120,-60,.9);}}
        else if(kind==='grab'){if(!yelled&&g.endT>=.22){yelled=true;snd(240,.35,'sawtooth',.06,-90);}
          if(!grabbed&&g.endT>=.55){grabbed=true;sfx.boing();say('¡AY!',px+60,PY-96,'#ffffff');}
          if(grabbed)px=Math.max(X0-30,px-45*dt);}}},
    draw(){if(ph===1)drawDobla();else if(g.result==='win'&&g.endT>=.32)drawCalle();else drawBus();drawP();}};
  return g;
}

BUS.add('paga',{name:'¡PAGA Y CORRE!',mk:mkPaga,card:'EL MOCHO',num:'9'});
})();
