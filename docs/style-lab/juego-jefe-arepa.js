'use strict';
/* MiniCaos · laboratorio de estilos: JEFE «EL DESAYUNO CRIOLLO SUPREMO».
   Una reina pepiada desde cero en la cocina de la abuela, antes de que suene el despertador de las 7:00. Cuatro fases:
   1. ¡AMASA! (el tazón, desde arriba): dar VUELTAS con el dedo (o flechas → ↓ ← ↑ en orden) hasta deshacer los grumos.
      Cambiar de sentido no resta, pero tampoco suma mientras te devuelves.
   2. ¡PALMEA!: alternar izquierda y derecha para aplastar la bola. Dos veces seguidas del mismo lado = una grieta; tres
      grietas y se desbarata.
   3. ¡VOLTÉALA! (el budare): cada lado tiene su punto y no dura lo mismo. Deslizar hacia arriba (o ↑ / ESPACIO) cuando la
      concha esté DORADA: antes queda cruda, después se quema. La barra de arriba es lo que falta para que se queme ese lado.
   4. ¡RELLENA!: arrastrar cucharadas de pollo (grande), aguacate (mediana) y mayonesa (chiquita) a la arepa (o ← ↓ →).
      Hay que usar los tres y dejar el relleno en la zona verde: si te pasas, la masa se rompe por detrás.
   Niveles: más vueltas y palmadas, punto de la concha más corto, zona verde más angosta y menos tiempo.
   Ganas: la abuela muerde, llora de orgullo y suena una fanfarria llanera (ORIGINAL: arpegio de arpa en 6/8, no es ninguna
   pieza real). Pierdes: el arepazo (cruda por dentro, quemada por fuera, el relleno en el piso) y suena el despertador.
   El paquete de harina es genérico a propósito (sin marca real).
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.arepa)return;
const{LV,CONF,TU,tag}=window.BUS,PI=Math.PI,GAP=.8;
const sello=f=>f<1?f*1.6:1.6+(f-1)*.29;
const rnd=(a,b)=>a+Math.random()*(b-a);
const pop=(s,x,y,col,r=8,life=.8)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
const velo=(a,f)=>{if(a<=.01)return;ctx.save();ctx.globalAlpha=Math.min(1,a);f();ctx.restore();};
const ABU={skin:'#c98a5a',shirt:'#ff7ab0',pat:'apron',sh2:'#fffdf2',hair:'bun',hairCol:'#e4e0e8',glasses:'round',wrinkles:1,cheeks:1,earring:1,bw:56,hw:42,hh:42};
const abu=(x,y,s,o)=>bust(Object.assign({},ABU,{x,y,s,th:200,look:1},o));
const CRUDA='#f6ecd0',DORADA='#e8b04a',TOSTE='#a8682a',QUEMADA='#2a2018',RELL='#e6edb0';
const ING={pollo:{n:'POLLO',c:'#f4e3c0',k:'←'},agua:{n:'AGUACATE',c:'#9fd06a',k:'↓'},mayo:{n:'MAYONESA',c:'#fffbe6',k:'→'}};
function flechaArr(x,y,s,col){poly([[x,y-24*s],[x+22*s,y],[x+9*s,y],[x+9*s,y+22*s],[x-9*s,y+22*s],[x-9*s,y],[x-22*s,y]],col,4);}
function reloj(x,y,min,ring){ctx.save();ctx.translate(x+(ring?Math.sin(now*60)*4:0),y);
  for(const sg of[-1,1]){ell(sg*30,-42,17,13,'#ffd23f',3.5);line([[sg*22,36],[sg*32,52]],6,INK);}
  ell(0,0,46,46,'#e8553d',4.5);ell(0,0,36,36,'#fffdf2',3);ell(Math.cos(7/12*TAU-PI/2)*29,Math.sin(7/12*TAU-PI/2)*29,4,4,'#c4283a',0);
  const am=min/60*TAU-PI/2,ah=(6+min/60)/12*TAU-PI/2;line([[0,0],[Math.cos(ah)*18,Math.sin(ah)*18]],5,INK);line([[0,0],[Math.cos(am)*28,Math.sin(am)*28]],3.5,'#c4283a');ell(0,0,4,4,INK,0);
  ctx.restore();if(ring)txt('¡RIIING!',x-40,y-78,24,'#ff4d5e',-.1);}
/* la cocina de la abuela: pared de baldosas, la ventana amaneciendo, el despertador, la repisa y el mesón */
function cocina(min,ring){
  wash(0,0,800,432,'#ffe9c4','#ffdcae');for(let i=1;i<8;i++)line([[i*100,96],[i*100,430]],2,'#f2cf9c');for(let j=0;j<3;j++)line([[0,180+j*84],[800,180+j*84]],2,'#f2cf9c');
  rr(516,118,154,134,10,'#8a6a4a',4.5);ctx.save();path(rrP(526,128,134,114,5));ctx.clip();wash(526,128,134,114,'#ff9e6b','#ffe08a');ell(593,244,36,36,'#fff3a8',0);ctx.restore();line([[593,128],[593,242]],4,'#8a6a4a');
  reloj(730,176,min,ring);
  rr(36,150,236,12,4,'#8a6a4a',3.5);[['#e8553d',70],['#3fb0ff',122],['#5cd06a',174],['#ffd23f',226]].forEach(([c,x])=>{rr(x-17,112,34,38,6,c,3.5);rr(x-19,105,38,11,4,'#fffdf2',3);});
  rr(-10,430,820,190,0,'#c98a5a',0);rr(-10,430,820,20,0,'#e0a878',0);line([[0,430],[800,430]],5,INK);}
function harina(x,y){rr(x-36,y-62,72,112,8,'#ffd23f',4);rr(x-36,y-30,72,40,0,'#c4283a',0);txt('HARINA',x,y-18,14,'#ffffff',0,true);txt('DE MAÍZ',x,y,11,'#ffffff',0,true);ell(x,y+30,18,10,DORADA,3);rr(x-36,y-70,72,14,5,'#fff3a8',3.5);}
/* la arepa de lado, sobre el budare o el plato: (x, y) = centro de la cara de arriba */
function arepa(x,y,top,bot,sy=1){const w=150,h=40*sy,g_=34;
  ell(x,y+g_,w,h,bot,4.5);rr(x-w,y,w*2,g_,0,mix(top,bot,.5),0);line([[x-w,y],[x-w,y+g_]],4.5,INK);line([[x+w,y],[x+w,y+g_]],4.5,INK);ell(x,y,w,h,top,4.5);
  if(top===DORADA)for(let i=0;i<6;i++)ell(x-90+i*36,y+((i*7)%3-1)*h*.3,15,6*sy,TOSTE,0);
  if(top===QUEMADA)for(let i=0;i<4;i++)ell(x-70+i*46,y+((i*5)%3-1)*h*.3,18,7*sy,'#14101c',0);}
/* la arepa abierta como una boca (bisagra a la izquierda) con su relleno */
function abierta(x,y,fill,o){const cG=o.burnt?QUEMADA:DORADA,cD=o.burnt?'#14101c':'#c98a3a';
  ell(x,y+22,152,50,cD,4.5);ell(x,y+14,144,42,o.burnt?CRUDA:'#fbf0c8',0);
  if(fill>0){const h=10+Math.min(fill,1.15)*52;ell(x+10,y+8-h*.45,124+fill*16,h,RELL,4);
    for(let i=0;i<7;i++)ell(x-84+i*30,y+8-h*.45+((i*5)%3-1)*h*.3,12,7,i%3===0?'#9fd06a':i%3===1?'#fffdf2':'#f4e3c0',2.5);}
  ctx.save();ctx.translate(x-142,y+8);ctx.rotate(-(.16+Math.min(fill,1.1)*.4)-(o.wob||0));ell(142,-14,150,40,cD,4.5);ell(142,-20,144,34,cG,0);
  if(!o.burnt)for(let i=0;i<5;i++)ell(62+i*40,-24+(i%2)*8,13,6,TOSTE,0);if(o.crack)line([[120,-52],[136,-30],[124,-14],[142,6]],5,INK);ctx.restore();}
function cuchara(x,y,k){ctx.save();ctx.translate(x,y);ctx.rotate(-.5);rr(-6,0,12,74,5,'#c9ced6',3.5);ell(0,-4,24,18,'#d9dce6',3.5);ell(0,-12,20+(k==='pollo'?6:k==='agua'?2:-3),14+(k==='pollo'?6:k==='agua'?2:-3),ING[k].c,3);ctx.restore();}
/* fanfarria llanera (original): arpegio de arpa en 6/8, Re - La7 - Re, con su bordón y las maracas */
function fanfarria(){const N=[294,440,587,740,587,440,277,440,554,659,554,440,294,440,587,740,880,1175];
  N.forEach((f,i)=>setTimeout(()=>{snd(f,.2,'triangle',.07);if(i%3===0)snd([147,110,147][i/6|0]*(i%6?1.5:1),.22,'sawtooth',.05);nz(.03,i%3?.03:.06);},i*95));
  setTimeout(()=>[587,740,880,1175].forEach(f=>snd(f,.6,'triangle',.05)),N.length*95);}

/* ═════════ JEFE: EL DESAYUNO CRIOLLO SUPREMO ═════════ */
function mkArepa(){
  const lv=LV(),n=lv-1,rs=Math.sqrt(SP);
  const FASES=[
    {cmd:'¡AMASA!',hint:'GIRA el dedo en círculos dentro del tazón (o flechas → ↓ ← ↑ en orden)',dur:[6,5.8,5.5][n]},
    {cmd:'¡PALMEA!',hint:'ALTERNA ← → (o los lados de la pantalla): nunca el mismo lado dos veces',dur:[5,4.6,4.2][n]},
    {cmd:'¡VOLTÉALA!',hint:'DESLIZA hacia arriba (o ↑ / ESPACIO) cuando la concha esté DORADA',dur:9},
    {cmd:'¡RELLENA!',hint:'ARRASTRA pollo, aguacate y mayonesa a la arepa (← ↓ →): hasta el verde, sin pasarte',dur:[7.5,6.8,6.2][n]}];
  let ph=0,pt=0,gap=0,fin=0,shake=0,lph=0,ev=0;

  /* ── fase 1: el amasado ── */
  const NV=[4,5,6][n],CX=410,CY=352,KEY={right:0,down:1,left:2,up:3};
  const GR=[];for(let i=0;i<9;i++)GR.push({a:rnd(0,TAU),r:rnd(24,96),s:Math.random(),th:(i+1)/9.5});
  let mezc=0,acc=0,la=null,dirS=0,rev=0,ha=2.2,hs=2.2,kq=-1,tk=0,tocado=false;
  function gira(dl){if(!dl)return;const sg=Math.sign(dl);if(!dirS)dirS=sg;acc+=dl;
    if(sg===dirS){rev=0;mezc+=Math.abs(dl);}else if((rev+=Math.abs(dl))>.9){dirS=sg;rev=0;}
    const q=Math.floor(mezc/TAU*6);if(q!==tk){tk=q;snd(260+(q%6)*26,.04,'triangle',.05);nz(.03,.03);if(q%6===0)pop('¡'+(q/6)+'!',CX,CY-176,'#ffe14d',10);}
    if(mezc>=NV*TAU){mezc=NV*TAU;pop('¡LISA!',CX,CY-40,'#5cff7a',16);sig();}}
  function dedo(p){const dx=p.x-CX,dy=p.y-CY,r=Math.hypot(dx,dy);if(r<22||r>250){la=null;return;}
    const a=Math.atan2(dy,dx);tocado=true;ha=a;if(la!=null){let dl=a-la;dl-=TAU*Math.round(dl/TAU);if(Math.abs(dl)<2.2)gira(dl);}la=a;}

  /* ── fase 2: el redondeo ── */
  const NP=[14,18,20][n],grietas=[];let pats=0,ult=null,slapL=0,slapR=0;
  function palmea(sd){if(sd==='left')slapL=1;else slapR=1;
    if(sd===ult){grietas.push((sd==='left'?PI:0)+rnd(-.9,.9));shake=.7;nz(.12,.16);snd(180,.12,'sawtooth',.06,-80);pop('¡CRAC!',CX+(sd==='left'?-120:120),300,'#ff4d5e',12);
      if(grietas.length>=3)pierde('¡SE AGRIETÓ!');return;}
    ult=sd;pats++;nz(.05,.12);snd(sd==='left'?190:240,.07,'sine',.14);
    if(pats>=NP){pop('¡REDONDITA!',CX,250,'#5cff7a',14);sig();}}

  /* ── fase 3: el budare ── */
  const WN=[.95,.75,.6][n],QUEMA=.7,punto=()=>rnd(1.5,2.2)/rs;
  let lado=0,c=0,t0=punto(),flip=0,sw=null,siz=0,aviso=lv>1?.3:0;const caras=[CRUDA,CRUDA];
  const concha=()=>c<t0?mix(CRUDA,DORADA,ease(c/t0)*.8):c<=t0+WN?DORADA:mix(DORADA,QUEMADA,clamp((c-t0-WN)/QUEMA,0,1));
  function voltea(){if(flip>0||lado>1)return;
    if(c<t0){caras[lado]=CRUDA;pierde('¡CRUDA!');return;}
    if(c>t0+WN){caras[lado]=QUEMADA;pierde('¡SE QUEMÓ!');return;}
    caras[lado]=DORADA;lado++;flip=1;sfx.whoosh();pop('¡DORADITA!',400,250,'#ffe14d',12);}

  /* ── fase 4: el relleno ── */
  const SUMA={pollo:lv>2?.28:.26,agua:.17,mayo:.1},ZL=[.84,.87,.9][n],BOL=[['pollo',672,300],['agua',672,400],['mayo',672,500]],AX=372,AY=404;
  const uso={pollo:0,agua:0,mayo:0};let fill=0,hold=null,plop=0;
  const enArepa=p=>((p.x-AX)/180)**2+((p.y-(AY-20))/120)**2<1;
  function echa(k){fill+=SUMA[k];uso[k]++;plop=1;snd(220-fill*60,.12,'sine',.16,-60);nz(.05,.08);spawn(AX,AY-40,5,'bit',[ING[k].c],160,600,.5);
    if(fill>1.001){pierde('¡SE ROMPIÓ!');spawn(AX+60,AY,22,'bit',[RELL,'#9fd06a','#fffdf2'],380,800,1);sfx.crash();return;}
    if(fill>=ZL){const falta=Object.keys(uso).find(q=>!uso[q]);if(falta)pop('¡FALTA '+ING[falta].n+'!',AX,AY-150,'#ff9ec7',6);else gana();}}

  const minuto=()=>ph===2?52+2*lado+2*clamp(c/(t0+WN),0,1):44+4*ph+4*clamp(pt/FASES[ph].dur,0,1);
  function sig(){ph++;pt=0;gap=GAP;la=null;sfx.ding();}
  function gana(){g.result='win';g.why='¡QUÉ AREPA!';sfx.win();spawn(400,280,26,'conf',CONF);}
  function pierde(why){g.result='lose';g.why=why;lph=ph;hold=null;shake=1;sfx.thud();sfx.lose();}

  /* ── dibujo: fase 1 ── */
  function d1(){const k=mezc/(NV*TAU),lose=g.result==='lose';
    cocina(minuto());abu(112,336,.78,{mood:lose?'angry':k>.6?'smile':'calm'});harina(700,380);rr(748,340,44,74,10,'#bfe9ff',4);rr(752,372,36,38,6,'#6fbcff',0);
    if(pt<1.4&&!g.result)bubble(236,222,'¡SIN GRUMOS, MIJO!',17,156,262);
    velo(.22,()=>ell(CX+10,CY+26,172,140,'#000000',0));ell(CX,CY,168,140,'#c9ced6',5);ell(CX,CY,152,124,'#9aa0b0',0);line(arcPts(CX,CY,160,PI*1.1,PI*1.45,8,.83),5,'#ffffff');
    ell(CX,CY+4,136,110,mix('#fdf8ea','#f2dc9a',k),3.5);
    velo((1-k)*.7,()=>ell(CX+Math.cos(acc)*30,CY+10+Math.sin(acc)*22,72-k*30,52-k*20,'#8fd0ff',0));
    for(let i=0;i<3;i++){const a0=acc+i*TAU/3;line(arcPts(CX,CY+4,56+i*24,a0,a0+1.5,8,.8),4,mix('#e2c67c','#ecd590',k));}
    GR.forEach(q=>{const z=clamp((q.th-k)*6,0,1);if(z>0){const a=q.a+acc*.6;ell(CX+Math.cos(a)*q.r,CY+4+Math.sin(a)*q.r*.8,(9+q.s*8)*z,(7+q.s*6)*z,'#fffdf2',3);}});
    if(!g.result){const R=96,dr=dirS||1;
      velo(.8,()=>line(closeP(ellP(CX,CY+4,R,R*.8,30)),6,'#ffffff'));if(k>.01)line(arcPts(CX,CY+4,R,-PI/2,-PI/2+dr*TAU*((mezc/TAU)%1),Math.max(2,Math.ceil(((mezc/TAU)%1)*28)),.8),10,'#5cff7a');
      const z=tocado?1:1.2+.2*Math.sin(now*10);
      for(let i=0;i<6;i++){const a=i*TAU/6+dr*now*1.8,cs=Math.cos(a),sn=Math.sin(a),x=CX+cs*R,y=CY+4+sn*R*.8,tx=-sn*dr*z,ty=cs*dr*z;poly([[x+tx*15,y+ty*15],[x-tx*9+cs*12*z,y-ty*9+sn*12*z],[x-tx*9-cs*12*z,y-ty*9-sn*12*z]],'#ffe14d',3.5);}
      for(let i=0;i<NV;i++)ell(CX+(i-(NV-1)/2)*26,CY-162,9,9,i<Math.floor(mezc/TAU+1e-6)?'#5cff7a':'#fff3c4',3.5);}
    const hx=CX+Math.cos(hs)*86,hy=CY+4+Math.sin(hs)*68;limb(560,640,hx+12,hy+16,36,TU.shirt,4);ell(hx,hy,23,20,TU.skin,4);for(let i=0;i<3;i++)line([[hx-9+i*9,hy-12],[hx-9+i*9,hy-2]],2.5,dark(TU.skin,.35));
    if(!tocado&&!g.result)tag(hx+50,hy-40);}

  /* ── dibujo: fase 2 ── */
  function d2(){const k=pats/NP,R=lerp(64,132,ease(k)),CY2=312,lose=g.result==='lose',rx=R*(1-.06*(slapL+slapR)),ry=R*(1+.04*(slapL+slapR));
    cocina(minuto());abu(112,336,.78,{mood:lose?'angry':grietas.length?'worry':k>.6?'smile':'calm'});harina(716,380);
    ell(CX,CY2,rx,ry,CRUDA,5);if(k>.2)ell(CX,CY2,rx*.8,ry*.8,'#fbf4e0',0);ell(CX-R*.36,CY2-R*.42,R*.22,R*.11,'#ffffff',0);
    for(const a of grietas){const p=[];for(let i=0;i<5;i++){const r=R*(1.02-i*.13),aa=a+(i%2?.1:-.1);p.push([CX+Math.cos(aa)*r,CY2+Math.sin(aa)*r]);}line(p,5,'#8a6a3a');}
    for(const sg of[-1,1]){const sl=sg<0?slapL:slapR,hx=CX+sg*(R+38+(1-sl)*50),toca=!g.result&&(ult==null||(ult==='left')===(sg>0));
      if(toca)velo(.45+.25*Math.sin(now*12),()=>ell(hx,CY2-10,64,96,'#ffe14d',0));
      limb(CX+sg*340,640,hx+sg*24,CY2+60,58,TU.shirt,4.5);
      for(let i=0;i<4;i++)rr(hx-34+i*17,CY2-84+Math.abs(i-1.5)*8,16,62,8,TU.skin,3.5);rr(hx-36,CY2-34,72,90,26,TU.skin,4);ell(hx-sg*34,CY2-4,13,24,TU.skin,3.5);
      if(toca)flechaArr(hx,CY2+120+Math.sin(now*10)*5,.8,'#ffe14d');}
    if(!g.result){rr(CX-122,470,244,24,12,'#14101c',3.5);if(k>.01)rr(CX-119,473,238*k,18,9,'#5cff7a',0);txt('REDONDEZ',CX,456,12,INK,0,true);
      for(let i=0;i<3;i++)txt(i<grietas.length?'✗':'·',CX-150-i*22,482,22,i<grietas.length?'#ff4d5e':'#ffffff');}
    if(pt<1.2&&!g.result)bubble(236,222,'¡CON CARIÑO!',17,156,262);}

  /* ── dibujo: fase 3 ── */
  function d3(){const lose=g.result==='lose',fin_=t0+WN+QUEMA,enP=c>=t0&&c<=t0+WN,u=1-flip,BY=452;
    cocina(minuto());abu(112,336,.78,{mood:lose?'angry':enP?'yell':c>t0+WN?'panic':'calm',talk:enP?Math.abs(Math.sin(now*14)):0});
    rr(170,470,470,150,12,'#e4e6ee',4.5);for(let i=0;i<4;i++)ell(220+i*40,580,10,10,'#3b3550',3);
    for(let i=0;i<9;i++){const fx=262+i*34,fh=16+Math.sin(now*14+i*1.7)*6;poly([[fx-9,BY+44],[fx,BY+44-fh],[fx+9,BY+44]],'#3fb0ff',2.5);}
    ell(400,BY+10,236,58,'#1c1a24',5);ell(400,BY+4,214,46,'#2d2a38',0);limb(630,BY+8,730,BY-4,20,'#14101c',4);
    /* el vapor y, si te pasas, el humo */
    const hum=clamp((c-t0-WN)/QUEMA,0,1);
    if(flip<=0&&!lose)for(let i=0;i<4;i++){const q=(now*.7+i/4)%1,x=310+i*60+Math.sin(now*3+i)*10;velo((1-q)*(.5+hum*.4),()=>ell(x,BY-40-q*120,12+q*18+hum*16,10+q*14+hum*12,mix('#ffffff','#3b3550',hum),0));}
    /* la arepa: la cara de abajo es la que se está cocinando */
    const top=lado===0?CRUDA:caras[0],yy=BY-34-Math.sin(u*PI)*(flip>0?200:0),sy=flip>0?Math.cos(u*PI):1;
    if(flip>0){/* en el aire: hasta la mitad se ve la cara vieja; después, la recién dorada */const vieja=lado===1?CRUDA:caras[0];arepa(400,yy,sy>0?vieja:DORADA,sy>0?DORADA:vieja,Math.max(.12,Math.abs(sy)));}
    else arepa(400,yy,lose?(caras[lado]===QUEMADA?QUEMADA:top):top,lado>1?DORADA:concha());
    if(enP&&flip<=0&&!g.result){for(let i=0;i<5;i++){const a=now*3+i*TAU/5;txt('✦',400+Math.cos(a)*176,BY-14+Math.sin(a)*36,20,'#ffe14d');}flechaArr(400,BY-150+Math.sin(now*12)*8,1.2,'#5cff7a');}
    /* el medidor de la concha */
    if(!g.result&&lado<2){const MX=706,M0=478,MH=166,yv=v=>M0-MH*v/fin_;rr(MX-22,M0-MH-6,44,MH+12,10,'#14101c',4);rr(MX-16,yv(t0),32,yv(0)-yv(t0),0,CRUDA,0);rr(MX-16,yv(t0+WN),32,yv(t0)-yv(t0+WN),0,'#5cff7a',0);rr(MX-16,yv(fin_),32,yv(t0+WN)-yv(fin_),0,QUEMADA,0);
      const ny=yv(Math.min(c,fin_));poly([[MX-34,ny-9],[MX-18,ny],[MX-34,ny+9]],'#ffffff',3.5);line([[MX-18,ny],[MX+18,ny]],3,'#ffffff');txt('CONCHA',MX,M0+22,12,INK,0,true);txt('LADO '+(lado+1)+' DE 2',MX,M0-MH-22,12,INK,0,true);}
    if(enP&&!g.result&&c>t0+WN*aviso)bubble(236,222,'¡YA, MIJO, YA!',19,156,262);
    if(lose)txt(caras[lado]===QUEMADA?'¡CARBÓN!':'¡PURA MASA!',400,250,34,'#ff4d5e',-.05);}

  /* ── dibujo: fase 4 ── */
  function d4(){const lose=g.result==='lose',roto=lose&&fill>1;
    cocina(minuto());abu(150,336,.78,{mood:roto?'panic':fill>=ZL?'smile':'calm'});
    ell(AX,AY+40,214,56,'#fffdf2',4.5);ell(AX,AY+38,180,40,'#f0ece0',0);
    for(let i=0;i<3;i++){const q=(now*.6+i/3)%1;velo((1-q)*.5,()=>ell(AX-60+i*70+Math.sin(now*3+i)*10,AY-70-q*110,12+q*16,10+q*12,'#ffffff',0));}
    abierta(AX,AY,fill,{wob:plop*.08,crack:roto});
    if(roto)for(let i=0;i<3;i++)ell(AX+150+i*26,AY+30+i*16+Math.min(60,fin*200),26-i*5,14-i*2,RELL,3.5);
    /* la barra del relleno */
    const B0=500,BH=300,yv=v=>B0-BH*Math.min(v,1.08)/1.08;
    rr(14,B0-BH-6,44,BH+12,12,'#14101c',4);rr(20,yv(1.08),32,yv(1)-yv(1.08),0,'#ff4d5e',0);rr(20,yv(1),32,yv(ZL)-yv(1),0,'#5cff7a',0);
    if(fill>.01)rr(24,yv(fill),24,B0-yv(fill),6,fill>1?'#ff4d5e':RELL,3);txt('RELLENO',40,B0+22,12,INK,0,true);
    /* los tres potes */
    for(const[k,x,y]of BOL){const I=ING[k],on=hold&&hold.k===k;ell(x,y+8,62,34,'#8a5a3a',4.5);ell(x,y,56,26,I.c,3.5);
      if(k==='pollo')for(let i=0;i<5;i++)line([[x-34+i*16,y-6+(i%2)*8],[x-22+i*16,y+2-(i%2)*8]],3,'#d9c090');else if(k==='agua')for(let i=0;i<4;i++)ell(x-30+i*20,y+(i%2)*8-4,8,5,'#6aa84a',0);else line(arcPts(x,y,24,0,TAU*1.5,14,.4),3,'#f0e6b8');
      rr(x-60,y+38,120,22,8,uso[k]?'#5cff7a':'#fff3c4',3);txt(I.n+(uso[k]?' ✓':''),x,y+49,12,INK,0,true);ell(x+62,y-22,12,12,'#ffffff',2.5);txt(I.k,x+62,y-22,15,INK,0,true);
      if(on)velo(.5,()=>ell(x,y,58,28,'#ffffff',0));}
    if(hold)cuchara(hold.x,hold.y,hold.k);
    if(hold&&!g.result)velo(.5+.3*Math.sin(now*12),()=>line(closeP(ellP(AX,AY-20,176,116,26)),6,'#ffe14d'));
    if(pt<1.3&&!g.result)bubble(300,214,'¡QUE QUEDE BIEN RESUELTA!',16,186,262);}

  /* ── el final bueno: la abuela muerde y llora de orgullo ── */
  function dBien(u){const bite=u>=.6,llora=u>1.25,AXB=400,AYB=372,S=1.2;
    cocina(59);hen(96,424,.55,1);harina(748,380);
    const sube=ease(clamp(u/.55,0,1)),baja=ease(clamp((u-1.25)/.3,0,1)),a=lerp(lerp(1.2,2.7,sube),2.2,baja),len=lerp(lerp(74,34,sube),64,baja);
    abu(AXB,AYB,S,{th:260,look:0,mood:!bite?'o':llora?'happy':Math.sin(now*18)>0?'o':'smile',
      arms:[{side:1,a,len,w:22,hand:(hx,hy)=>{const p=bite?arcPts(hx+4,hy-14,58,-PI/2-.3,PI/2+.3,10,.6).concat([[hx-8,hy+4],[hx+4,hy-14],[hx-8,hy-32]]):ellP(hx,hy-14,58,35);
        poly(p,DORADA,4);line([[hx+(bite?2:-40),hy-14],[hx+50,hy-14]],9,RELL);for(let i=0;i<3;i++)ell(hx+14+i*16,hy-30+(i%2)*6,7,3.5,TOSTE,0);}},{side:-1,a:-.3,len:80,w:22}]});
    if(llora){const ex=17*S,ey=AYB+(-64-6)*S;for(const sg of[-1,1])for(let i=0;i<3;i++)ell(AXB+sg*(ex+6),ey+10+((now*130+i*32)%96),5,8,'#9fe3ff',2.5);
      for(let i=0;i<4;i++){const q=(now*.8+i/4)%1;txt('♥',AXB-170+i*110+Math.sin(now*3+i)*10,300-q*150,26,'#ff4d6d');}}
    bust(Object.assign({},TU,{x:640,y:352,s:.7,th:110,look:-1,mood:llora?'happy':'worry',cheeks:1,arms:[{side:1,a:llora?2.7:.2,len:70,w:20},{side:-1,a:-.2,len:70,w:20}]}));tag(640,252);
    if(u>.6&&u<1.25)txt('¡ÑAM!',250,250,44,'#ffffff',-.1);
    if(u>1.5)bubble(300,160,'IGUALITA A LA MÍA...',22,AXB-20,AYB-150);if(u>2.5)bubble(330,222,'(BUENO, CASI)',16,AXB,AYB-150);}

  /* ── el final malo: el arepazo ── */
  function dMal(u){
    cocina(60,true);rr(0,548,800,52,0,'#e8dcc0',0);line([[0,548],[800,548]],4,INK);
    ell(400,440,170,36,'#fffdf2',4.5);
    for(let i=0;i<4;i++){const q=(now*.5+i/4)%1;velo((1-q)*.6,()=>ell(360+i*30+Math.sin(now*2+i)*14,380-q*170,16+q*26,14+q*20,'#3b3550',0));}
    abierta(400,402,.5,{burnt:true,crack:true,wob:Math.sin(now*4)*.03});
    /* el relleno se va al piso */
    const q=clamp(u/.7,0,1);rr(486,440,22,Math.min(116,q*124),10,RELL,3.5);if(q>=1)ell(498,566,64*clamp((u-.7)/.5,0,1),14*clamp((u-.7)/.5,0,1),RELL,3.5);
    const dq=ease(clamp((u-1)/.6,0,1));if(dq>0){ctx.save();ctx.translate(lerp(900,612,dq),590+Math.sin(now*16)*(dq>=1?3:0));ctx.scale(-1,1);dog(0,0,1.15);ctx.restore();if(dq>=1&&Math.sin(now*7)>0)txt('ÑAM ÑAM',600,506,18,'#ffffff',-.08);}
    abu(150,336,.82,{mood:'angry',vein:1,talk:u>.3&&u<1.6?Math.abs(Math.sin(now*16)):0,arms:[{side:1,a:2.5+Math.sin(now*9)*.15,len:76,w:21,hand:(hx,hy)=>chanclaP(hx+6,hy-22,-.7,1.1)},{side:-1,a:-.6,len:50,w:21}]});
    bust(Object.assign({},TU,{x:690,y:372,s:.64,th:110,look:-1,mood:'panic',sweat:2}));tag(690,280);
    if(u>.3)bubble(300,196,'¡QUÉ AREPAZO TAN ARRECHO!',20,190,246);}

  const g={lr:true,result:null,why:'',endT:0,
    get t(){return gap>0?0:ph===2?Math.min(c,t0+WN+QUEMA):pt;},get dur(){return ph===2?t0+WN+QUEMA:FASES[ph].dur;},get cmd(){return FASES[ph].cmd;},get hint(){return FASES[ph].hint;},
    get impact(){return this.result?clamp(1-fin/.5,0,1):shake*.6;},
    probe:()=>({ph,pt,gap,turns:mezc/TAU,needTurns:NV,pats,needPats:NP,ult,grietas:grietas.length,lado,c,t0,WN,flip,fill,ZL,SUMA,uso,BOL,AX,AY,fin}),
    press(k){if(g.result||gap>.25)return;
      if(ph===0){const i=KEY[k];if(i==null)return;if(kq>=0){if(i===(kq+1)%4)gira(PI/2);else if(i===(kq+3)%4)gira(-PI/2);}kq=i;tocado=true;ha=i*PI/2;}
      else if(ph===1){if(k==='left'||k==='right')palmea(k);}
      else if(ph===2){if(k==='up'||k==='any')voltea();}
      else{const q={left:'pollo',down:'agua',right:'mayo'}[k];if(q)echa(q);}},
    down(p){if(g.result||gap>.25)return;
      if(ph===0){la=null;dedo(p);}
      else if(ph===1)palmea(p.x<400?'left':'right');
      else if(ph===2)sw=p.y;
      else for(const[k,x,y]of BOL)if(Math.hypot(p.x-x,p.y-y)<70){hold={k,x:p.x,y:p.y};snd(300,.05,'square',.04);}},
    move(p){if(g.result||gap>.25)return;
      if(ph===0)dedo(p);
      else if(ph===2){if(sw!=null&&sw-p.y>34){sw=null;voltea();}}
      else if(hold){hold.x=p.x;hold.y=p.y;}},
    up(p){la=null;
      if(ph===2&&sw!=null){sw=null;if(!g.result&&gap<=0)pop("¡DESLIZA PA' ARRIBA!",400,250,'#ffffff',2);}
      if(hold){const h=hold;hold=null;if(g.result)return;if(enArepa(p))echa(h.k);else{sfx.whoosh();spawn(p.x,p.y,5,'bit',[ING[h.k].c],140,700,.5);pop('¡AL MESÓN NO!',clamp(p.x,140,660),p.y-30,'#ff9ec7',2);}}},
    update(dt){shake=Math.max(0,shake-dt*3);slapL=Math.max(0,slapL-dt*7);slapR=Math.max(0,slapR-dt*7);plop=Math.max(0,plop-dt*4);
      let dd=ha-hs;dd-=TAU*Math.round(dd/TAU);hs+=dd*Math.min(1,dt*30);
      if(g.result){fin+=dt;g.endT=sello(fin);
        if(g.result==='win'){if(ev<1&&fin>=.6){ev=1;nz(.12,.2);snd(140,.12,'square',.1,-40);}if(ev<2&&fin>=1.25){ev=2;fanfarria();}}
        else{if(ev<1&&fin>=.8){ev=1;for(let i=0;i<6;i++)setTimeout(()=>{snd(1900,.07,'square',.06);snd(2400,.07,'square',.05);},i*110);}if(ev<2&&fin>=1.5){ev=2;sfx.thud();}if(ev<3&&fin>=2.4){ev=3;sfx.boing();}}
        return;}
      if(gap>0){gap-=dt;return;}
      pt+=dt;const F=FASES[ph];
      if(ph===0){if(!tocado)ha=2.2+Math.sin(now*5)*.4;if(pt>=F.dur)pierde('¡PUROS GRUMOS!');}
      else if(ph===1){if(pt>=F.dur)pierde('¡QUEDÓ BOLA!');}
      else if(ph===2){
        if(flip>0){flip-=dt/.5;if(flip<=0){flip=0;sfx.thud();if(lado>1){pop('¡LISTA!',400,300,'#5cff7a',16);sig();}else{c=0;t0=punto();aviso=lv>1?.3:0;}}}
        else if(lado<2){c+=dt;if((siz-=dt)<=0){siz=.09;nz(.05,.02+.05*clamp(c/t0,0,1));}
          if(c>t0+WN+QUEMA){caras[lado]=QUEMADA;pierde('¡SE QUEMÓ!');}}}
      else if(pt>=F.dur)pierde('¡SONÓ LA ALARMA!');},
    draw(){
      ctx.save();if(shake>0)ctx.translate(Math.sin(now*70)*shake*5,Math.cos(now*61)*shake*3);
      if(g.result==='win')dBien(fin);else if(g.result==='lose'&&fin>.8)dMal(fin-.8);else[d1,d2,d3,d4][ph]();
      ctx.restore();
      if(!g.result){for(let i=0;i<4;i++)ell(572+i*20,76,6.5,6.5,i<ph?'#5cff7a':i===ph?'#ffd23f':'#fff3c4',3);
        if(gap>0){velo(gap/GAP*1.6,()=>{rr(0,250,800,96,0,'#14101c',0);txt('FASE '+(ph+1)+' DE 4',400,298,44,'#ffd23f');});}}
      drawP();
    }};
  spawn(CX-40,150,12,'bit',['#fffdf2'],70,900,.8);spawn(CX+50,150,8,'bit',['#8fd0ff'],60,900,.8);
  return g;
}

BUS.add('arepa',{name:'JEFE · AREPA',mk:mkArepa,card:'LA AREPA',num:'J3'});
})();
