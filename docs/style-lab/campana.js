'use strict';
/* MiniCaos · laboratorio de estilos: MODO NIVELES (lo abre jugar.html).
   Monta sobre el laboratorio el mismo flujo de la app (js/main.js): elegir etapa → presentación → intermedio con Caos, vidas y
   puntos → tarjeta con la orden → microjuego con la mecha de la bomba → sello → ... → jefe → etapa superada / fin del juego.
   Más un modo PRÁCTICA (cualquier juego suelto, en bucle, en nivel 1/2/3) para probar.
   Antes de las etapas se elige MUNDO: VENEZUELA (las etapas de aquí) o CLÁSICO (las etapas de siempre de la app).
   El mundo clásico ES la app (../../index.html) corriendo en un iframe a pantalla completa, sin tocarle un archivo: se le
   quitan las etiquetas de analítica y el service worker (para que las pruebas no cuenten como jugadores), se abre directo
   en su selector de etapas y su botón INICIO pasa a ser MUNDOS (goTitle → vuelve aquí).
   La etapa del apagón (POWER OUT! / SE FUE LA LUZ) se mudó de mundo: aquí es la etapa 4 de VENEZUELA, con sus seis juegos y
   su jefe rehechos con las primitivas del laboratorio (juego-switch, -nevera, -zancudo, -enchufa, -voltea, -llego y
   juego-jefe-transformador), y en el iframe del mundo clásico se quita de la lista (ver openClassic).

   Cómo se engancha, sin editar index.html ni los juegos:
   - Se carga DESPUÉS de index.html, juegos-bus.js y todos los juego-*.js, y reemplaza tick(), hud(), paintFrame() y frameWW().
   - El dibujo del microjuego sigue saliendo por el laboratorio (estilos incluidos) en el canvas de siempre; todo lo de la app
     (fondo de rayos, Caos, vidas, mecha, sello, botones) va en un segundo canvas transparente encima, a 60 fps, con las mismas
     funciones de js/core.js copiadas aquí (no se puede cargar core.js: choca con los nombres globales del laboratorio).
   - Cada microjuego arranca como en el laboratorio: gameId=<id>; SP=<velocidad>; G=GAMES[id].mk(). La entrada del juego solo
     pasa mientras se juega (se corta en captura durante la tarjeta, el intermedio y los menús).
   Estilos permitidos: 16 bits, fieltro, wind waker, anime 90s, tinta, garabato (+ MEZCLA: uno distinto por microjuego).
   Teclas: 1-7 estilo · M música · ESC atrás · P práctica (menú) · R reinicia el juego (práctica).
   ?mundo=venezuela|clasico · ?etapa=1..5 · ?juego=<id> · ?estilo=<estilo> arrancan directo. */
(function(){
if(window.CAMP)return;

/* ───────── estilos y etapas ───────── */
const ESTILOS=[['snes','16 BITS'],['felt','FIELTRO'],['ww','WIND WAKER'],['anime','ANIME 90s'],['tinta','TINTA'],['garabato','GARABATO']];
const JEFES={metro:'EL METRO EN HORA PICO',arepa:'EL DESAYUNO CRIOLLO SUPREMO',alcabala:'LA ALCABALA NOCTURNA',transformador:'EL TRANSFORMADOR'};
const TODOS=Object.keys(GAMES).filter(id=>!JEFES[id]);
const ETAPAS=[
  {name:'LA CAMIONETICA',tag:'Súbete, que va saliendo.',col:'#FF6B3D',bg:['#F5B93C','#eaa926'],
    pool:['parada','baja','encaleta','agarrate','revisa','paga','pendrive','duermete','saltale','amarrala'],n:8,sp0:1,jefes:['metro']},
  {name:'LA CASA',tag:'Mamá está viendo.',col:'#F28CB1',bg:['#7FCFCC','#6fc3c0'],
    pool:['chancla','llave','sopa','queso','hallaca','cucaracha','inscribe','tapala','tranca'],n:8,sp0:1.1,jefes:['arepa']},
  {name:'LA RUMBA',tag:'Y de regreso… la alcabala.',col:'#B49CFF',bg:['#FF8FD0','#ff7cc6'],
    pool:['acomoda','hielo','tequenos','soplalo','baile','rayita','marcalo','anuncio','trencito','torta','cava','hueco','pique','trancalo','cloche'],n:10,sp0:1.2,jefes:['alcabala']},
  {name:'¡SE FUE LA LUZ!',tag:'Se fue la luz. Otra vez.',col:'#FFCC00',bg:['#1F3FA8','#142B7A'],
    pool:['switch','nevera','zancudo','enchufa','voltea','llego'],n:8,sp0:1.2,jefes:['transformador']},
  {name:'TODO EL CAOS',tag:'Todo. A la vez.',col:'#FFD23F',bg:['#FF9AA2','#ff8892'],
    pool:null /* todos */,n:12,sp0:1.3,jefes:['metro','arepa','alcabala','transformador']}
];
for(const e of ETAPAS){e.pool=(e.pool||TODOS).filter(id=>GAMES[id]);e.jefes=e.jefes.filter(id=>GAMES[id]);}

const SAVE_KEY='minicaos-lab-niveles-v1';
const save={stars:[],best:[],estilo:'snes',musica:true};
try{Object.assign(save,JSON.parse(localStorage.getItem(SAVE_KEY))||{});}catch(e){}
const persist=()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){}};
/* la etapa del apagón entró de cuarta: lo guardado de TODO EL CAOS (antes la 4) pasa a la 5 */
if(!save.v2){if(save.stars[3]||save.best[3]){save.stars[4]=save.stars[3];save.best[4]=save.best[3];save.stars[3]=save.best[3]=0;}save.v2=1;persist();}

/* ───────── página: fuera la botonera del laboratorio, canvas a pantalla completa y la capa de la app encima ───────── */
const css=document.createElement('style');
css.textContent='html,body{height:100%}body{padding:0!important;gap:0!important;justify-content:center;overflow:hidden;background:#0b0b14!important;user-select:none;-webkit-user-select:none}'+
  '.bar,#help{display:none!important}#camp{position:relative;width:min(100vw,133.333vh);aspect-ratio:4/3;flex:none}'+
  '@supports (height:100dvh){#camp{width:min(100vw,133.333dvh)}}'+
  '#camp canvas{position:absolute;left:0;top:0;width:100%!important;height:100%!important;border-radius:0!important}#camp-ov{pointer-events:none;background:transparent!important}'+
  '#camp-app{position:fixed;left:0;top:0;width:100%;height:100%;border:0;background:#0b0b14;z-index:5}';
document.head.append(css);
const fl=document.createElement('link');fl.rel='stylesheet';fl.href='https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&display=swap';document.head.append(fl);
if(document.fonts)document.fonts.load('700 20px Fredoka').catch(()=>{});
const wrap=document.createElement('div');wrap.id='camp';view.before(wrap);wrap.append(view);
const ov=document.createElement('canvas');ov.id='camp-ov';const DPR=Math.min(2,window.devicePixelRatio||1);ov.width=W*DPR;ov.height=H*DPR;wrap.append(ov);
const X=ov.getContext('2d');
document.title='MiniCaos · modo niveles';

/* ───────── sonido de la app (snd/noise/jingles/música de js/core.js) por el AudioContext del laboratorio ───────── */
EGGS.use(()=>A());   /* los audios escondidos (js/eggs.js) suenan por el AudioContext del laboratorio */
let MASTER=null,NB=null,MUS=null,OUT=null;   /* OUT: a dónde van tone/hiss mientras se programa la música (si no, a MASTER) */
function salida(){const a=A();
  if(!MASTER){const comp=a.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=6;MASTER=a.createGain();MASTER.gain.value=.9;MASTER.connect(comp);comp.connect(a.destination);MUS=a.createGain();MUS.connect(MASTER);
    NB=a.createBuffer(1,a.sampleRate,a.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  return a;}
function tone(f,d=.1,type='square',v=.06,delay=0,f2){try{const a=salida(),os=a.createOscillator(),g=a.createGain(),t0=a.currentTime+delay;
  os.type=type;os.frequency.setValueAtTime(f,t0);if(f2)os.frequency.exponentialRampToValueAtTime(f2,t0+d);
  g.gain.setValueAtTime(.0001,t0);g.gain.linearRampToValueAtTime(v,t0+.006);g.gain.exponentialRampToValueAtTime(.0001,t0+d);
  os.connect(g);g.connect(OUT||MASTER);os.start(t0);os.stop(t0+d+.03);}catch(e){}}
function hiss(d=.12,v=.08,lo=800,hi=lo,type='bandpass',delay=0,q=1){try{const a=salida(),s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain(),t0=a.currentTime+delay;
  s.buffer=NB;s.loop=true;f.type=type;f.Q.value=q;f.frequency.setValueAtTime(lo,t0);if(hi!==lo)f.frequency.exponentialRampToValueAtTime(hi,t0+d);
  g.gain.setValueAtTime(.0001,t0);g.gain.linearRampToValueAtTime(v,t0+.005);g.gain.exponentialRampToValueAtTime(.0001,t0+d);
  s.connect(f);f.connect(g);g.connect(OUT||MASTER);s.start(t0,Math.random());s.stop(t0+d+.03);}catch(e){}}
const fx={
  click:()=>tone(900,.04,'square',.04,0,600),
  coin:()=>{tone(988,.07,'square',.05);tone(1319,.22,'square',.05,.07);},
  thud:()=>{tone(120,.16,'sine',.14,0,45);hiss(.08,.05,300,120,'lowpass');},
  whoosh:()=>hiss(.28,.07,300,3500,'bandpass',0,1.4),
  sparkle:()=>[1568,2093,2637,3136].forEach((f,i)=>tone(f,.09,'sine',.035,i*.045)),
  stamp:()=>{tone(90,.22,'sine',.2,0,40);hiss(.1,.08,1200,200,'lowpass');}
};
const jingleGo=()=>{[330,440,554,740].forEach((f,i)=>tone(f,.1,'triangle',.07,i*.06));hiss(.25,.04,400,3000,'bandpass');};
const jingleWin=()=>{[523,659,784,1047].forEach((f,i)=>{tone(f,.16,'square',.045,i*.075);tone(f*2,.12,'triangle',.03,i*.075+.01);});[784,988,1319].forEach(f=>tone(f,.4,'triangle',.04,.32));fx.sparkle();};
/* la salsa de las etapas. Es ORIGINAL (no es ninguna canción real): clave 2-3, campana, maracas, conga, bajo en tumbao, montuno
   de piano y, en la segunda mitad de la frase (o todo el rato con el jefe), los metales. Un ciclo de clave = 16 corcheas = 2 compases,
   un acorde por compás, frase de 8 compases. Cada etapa tiene su tono: tónica (MIDI), compases [grado, 'm'|'M'] y pulso. */
const TONOS=[
  {root:57,bpm:184,prog:[[0,'m'],[5,'m'],[7,'M'],[5,'m']]},      /* La menor: i-iv-V-iv */
  {root:60,bpm:176,prog:[[0,'M'],[5,'M'],[7,'M'],[5,'M']]},      /* Do mayor: I-IV-V-IV */
  {root:62,bpm:192,prog:[[0,'m'],[-2,'M'],[-4,'M'],[-5,'M']]},   /* Re menor: i-VII-VI-V */
  {root:55,bpm:168,prog:[[0,'m'],[0,'m'],[5,'m'],[7,'M']]},      /* Sol menor, más lenta: es de noche y no hay luz */
  {root:59,bpm:196,prog:[[0,'m'],[5,'m'],[-2,'M'],[3,'M']]}];    /* Si menor: i-iv-VII-III */
const CLAVE=[2,4,8,11,14],
  MONT={0:0,2:'c',3:2,5:'c',7:1,9:'c',11:0,13:'c',14:2},         /* montuno: 0/1/2 = tónica/tercera/quinta en octavas, 'c' = el acorde */
  METAL={2:[7,.9],3:[12,1.6],6:[1,1.4],8:[12,.9],11:[7,1.4],14:[1,2.6]};   /* metales: [nota (1 = la tercera de arriba), cuántas corcheas dura] */
const SIN_SALSA=new Set(['pendrive','baile','anuncio','pique']);  /* juegos que ya traen su propia música o su audio: ahí se calla */
const mus={on:false,step:0,next:0,mul:1,key:TONOS[0],kind:'play',vol:1,timer:0};
const midi=n=>440*Math.pow(2,(n-69)/12);
function musTick(){if(!mus.on)return;
  try{const a=salida(),K=mus.key,jefe=mus.kind==='boss';if(mus.next<a.currentTime)mus.next=a.currentTime+.05;
    MUS.gain.setTargetAtTime(mus.vol,a.currentTime,.12);OUT=MUS;
    while(mus.next<a.currentTime+.25){const s=mus.step,sd=mus.next-a.currentTime,e8=30/(K.bpm*mus.mul),n=s%16,q=s%8,bar=(s>>3)%4,
        [deg,ql]=K.prog[bar],r=K.root+deg,ter=ql==='m'?3:4,ac=[0,ter,7];
      if(CLAVE.includes(n)){tone(2350,.035,'square',.04,sd);tone(1180,.03,'sine',.04,sd);}
      if(q%2===0){const v=q%4?.014:.026;tone(800,.07,'square',v,sd);tone(540,.07,'square',v,sd);}
      hiss(.035,q%2?.022:.012,6500,6500,'highpass',sd);
      /* conga: seco en el 2, abiertos en el 4 y el 4-y */
      if(q===2)hiss(.05,.05,900,500,'bandpass',sd,3);else if(q>=6)tone(q===6?196:175,.13,'sine',.08,sd,q===6?150:130);
      /* bajo: la quinta en el 2-y; en el 4 se adelanta a la tónica del compás que viene */
      const bj=q===3?r-5:q===6?K.root+K.prog[(bar+1)%4][0]:null;
      if(bj!==null){tone(midi(bj-12),e8*2.6,'triangle',.12,sd);tone(midi(bj),e8*1.6,'square',.016,sd);}
      const m=MONT[n];
      if(m==='c'){tone(midi(r+12+ter),e8*.8,'triangle',.034,sd);tone(midi(r+19),e8*.8,'triangle',.034,sd);}
      else if(m!==undefined){tone(midi(r+12+ac[m]),e8*.9,'triangle',.045,sd);tone(midi(r+24+ac[m]),e8*.9,'triangle',.03,sd);tone(midi(r+24+ac[m]),e8*.5,'square',.008,sd);}
      const z=(jefe||s>=32)&&METAL[n];
      if(z){const f=midi(r+12+(z[0]===1?12+ter:z[0])),d=e8*z[1];tone(f,d,'sawtooth',.02,sd);tone(f*1.007,d,'sawtooth',.015,sd);tone(midi(r+12+(z[0]===1?7:z[0]-5)),d,'sawtooth',.012,sd);}
      mus.next+=e8;mus.step=(s+1)%64;}
  }catch(e){}OUT=null;}
/* vol: 1 en los intermedios, más bajita debajo del juego. La velocidad de la etapa la apura, pero solo un poco (si no, no se baila) */
function startMusic(i=0,mul=1,kind='play',vol=1){mus.key=TONOS[i%TONOS.length];mus.mul=1+(mul-1)*.35+(kind==='boss'?.06:0);mus.kind=kind;mus.vol=vol;
  if(!mus.on){mus.on=true;mus.step=0;mus.next=0;mus.timer=setInterval(musTick,60);}}
function stopMusic(){mus.on=false;clearInterval(mus.timer);}

/* ───────── dibujo de la app (js/core.js), sobre la capa X ───────── */
const OR='#FF6B3D';
const clamp01=k=>Math.max(0,Math.min(1,k)),easeOut=k=>1-Math.pow(1-clamp01(k),3),easeBack=k=>{k=clamp01(k);return 1+2.9*Math.pow(k-1,3)+1.9*Math.pow(k-1,2);};
function box(x,y,w,h,fill,o=4){X.fillStyle=INK;X.fillRect(x-o,y-o,w+o*2,h+o*2);X.fillStyle=fill;X.fillRect(x,y,w,h);}
function circ(x,y,r,fill,o=4){X.fillStyle=INK;X.beginPath();X.arc(x,y,r+o,0,7);X.fill();X.fillStyle=fill;X.beginPath();X.arc(x,y,r,0,7);X.fill();}
const face=(sz,dk)=>dk?`700 ${sz}px Fredoka, "Helvetica Neue", Arial, sans-serif`:`900 ${sz}px "Arial Black", Impact, sans-serif`;
function T(s,x,y,size,fill='#fff',align='center',maxW=0){s=String(s);const dk=fill===INK;   /* etiqueta oscura (botones): Fredoka sin contorno */
  X.font=face(size,dk);if('letterSpacing' in X)X.letterSpacing=dk?Math.max(.5,size/24)+'px':'0px';
  if(maxW){const w=X.measureText(s).width;if(w>maxW){size*=maxW/w;X.font=face(size,dk);}}
  X.textAlign=align;X.textBaseline='middle';X.lineJoin='round';
  if(!dk){X.lineWidth=size/5;X.strokeStyle=INK;X.strokeText(s,x,y);}
  X.fillStyle=fill;X.fillText(s,x,y);if('letterSpacing' in X)X.letterSpacing='0px';}
/* texto largo (las pistas del laboratorio son frases): parte en renglones y achica hasta que quepa en maxL. y = centro del primer renglón */
function TW(s,x,y,size,fill,maxW,maxL){let L;
  for(;;){X.font=face(size,fill===INK);L=[''];for(const w of String(s).split(' ')){const k=L.length-1,tr=L[k]?L[k]+' '+w:w;if(L[k]&&X.measureText(tr).width>maxW)L.push(w);else L[k]=tr;}
    if(L.length<=maxL||size<=11)break;size-=1;}
  L.slice(0,maxL).forEach((l,i)=>T(l,x,y+i*size*1.2,size,fill,'center',maxW));}
function star(cx,cy,ro,ri,n,rot,fill,o=4){X.beginPath();for(let i=0;i<n*2;i++){const r=i%2?ri:ro,a=rot+i*Math.PI/n;X.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}
  X.closePath();X.lineJoin='round';if(o){X.lineWidth=o*2;X.strokeStyle=INK;X.stroke();}X.fillStyle=fill;X.fill();}
function rays(color,ray,t){X.fillStyle=color;X.fillRect(0,0,W,H);X.fillStyle=ray;const n=16,rot=t*.12;
  for(let i=0;i<n;i++){const a0=rot+i*Math.PI*2/n,a1=a0+Math.PI/n;X.beginPath();X.moveTo(W/2,H/2);X.lineTo(W/2+Math.cos(a0)*1200,H/2+Math.sin(a0)*1200);X.lineTo(W/2+Math.cos(a1)*1200,H/2+Math.sin(a1)*1200);X.fill();}
  const gr=X.createLinearGradient(0,0,0,H);gr.addColorStop(0,'rgba(255,255,255,.16)');gr.addColorStop(1,'rgba(20,16,28,.14)');X.fillStyle=gr;X.fillRect(0,0,W,H);
  X.fillStyle='rgba(20,16,28,.06)';for(let y=10;y<H;y+=28)for(let x=(y/28&1)*14+6;x<W;x+=28){X.beginPath();X.arc(x,y,3,0,7);X.fill();}}
/* Caos, la mascota: una bombita encendida (igual que en la app). x = centro, y = pies, u = unidad */
function caos(x,y,u,o={}){const col=o.col||OR,ol=Math.max(3,u*.5),mood=o.mood;
  const wave=mood==='happy'?Math.sin(now*14)*1.4*u:0;
  const cap=[x-1.5*u,y-12.2*u,3*u,1.6*u];
  const shapes=[[x-6*u,y-8.6*u,12*u,5.8*u],[x-5*u,y-10*u,10*u,8.4*u],[x-3.6*u,y-10.8*u,7.2*u,9.6*u],[x-8*u,y-6.5*u-wave,2*u,2.4*u],[x+6*u,y-6.5*u+wave,2*u,2.4*u],cap,[x-3.6*u,y-2*u,1.6*u,2*u],[x+2*u,y-2*u,1.6*u,2*u]];
  X.fillStyle=INK;for(const s of shapes)X.fillRect(s[0]-ol,s[1]-ol,s[2]+ol*2,s[3]+ol*2);
  X.fillStyle=col;for(const s of shapes)X.fillRect(s[0],s[1],s[2],s[3]);
  X.fillStyle='#9a8fb5';X.fillRect(cap[0],cap[1],cap[2],cap[3]);
  X.fillStyle='rgba(255,255,255,.4)';X.fillRect(x-4*u,y-9.2*u,1.4*u,1.8*u);
  const px=k=>x+Math.sin(k*2)*1.6*u,py=k=>y-12.2*u-k*2.6*u;X.lineCap='round';
  for(const[cl,lw]of[[INK,u*1.1],['#e8d6a8',u*.45]]){X.strokeStyle=cl;X.lineWidth=lw;X.beginPath();X.moveTo(px(0),py(0));for(let i=1;i<=5;i++)X.lineTo(px(i/5),py(i/5));X.stroke();}
  const sx=px(1),sy=py(1);
  if(mood==='sad'){X.fillStyle='rgba(210,205,225,.55)';const p=now*1.5%1;X.fillRect(sx-.5*u+p*u,sy-(1+p*2)*u,u,u);}
  else{const f=1+.35*Math.sin(now*30);X.fillStyle='#FFE14D';X.fillRect(sx-1.2*u*f,sy-.35*u,2.4*u*f,.7*u);X.fillRect(sx-.35*u,sy-1.2*u*f,.7*u,2.4*u*f);X.fillStyle='#fff';X.fillRect(sx-.35*u,sy-.35*u,.7*u,.7*u);}
  const ey=y-6.2*u;X.strokeStyle=INK;X.fillStyle=INK;X.lineWidth=Math.max(2,u*.55);X.lineCap='round';X.lineJoin='round';
  for(const e of[x-2.8*u,x+2.8*u]){
    if(mood==='happy'){X.beginPath();X.moveTo(e-u*.9,ey+u);X.lineTo(e,ey-u*.3);X.lineTo(e+u*.9,ey+u);X.stroke();}
    else if(mood==='sad'){X.beginPath();X.moveTo(e-u*.8,ey-u*.9);X.lineTo(e+u*.8,ey+u*.9);X.moveTo(e+u*.8,ey-u*.9);X.lineTo(e-u*.8,ey+u*.9);X.stroke();}
    else{const bl=Math.sin(now*1.7)>.985?.25:1;X.fillRect(e-.6*u,ey-1.2*u*bl,1.2*u,2.4*u*bl);}}
  X.lineCap='butt';}
function shadow(x,y,rx,ry=rx*.3,a=.25){X.fillStyle=`rgba(20,16,28,${a})`;X.beginPath();X.ellipse(x,y,rx,ry,0,0,7);X.fill();}
function box3(x,y,w,h,fill,o=4,depth=6){X.fillStyle=INK;X.fillRect(x-o+depth,y-o+depth,w+o*2,h+o*2);box(x,y,w,h,fill,o);X.fillStyle='rgba(255,255,255,.35)';X.fillRect(x,y,w,Math.max(3,h*.12));}
let _vig=null;
function vignette(a=.35){if(!_vig){_vig=X.createRadialGradient(0,0,H*.45,0,0,H*.95);_vig.addColorStop(0,'rgba(20,16,28,0)');_vig.addColorStop(1,'rgba(20,16,28,1)');}
  X.save();X.translate(W/2,H/2);X.globalAlpha=a;X.fillStyle=_vig;X.fillRect(-W/2,-H/2,W,H);X.restore();}
/* confeti, destellos, anillos, texto flotante, temblor */
const parts=[],fxs=[];
function confetti(x,y,n=40){const cols=['#FFE14D','#5CFF7A','#4DB8FF','#FF4D9E','#FF6B3D','#fff'];for(let i=0;i<n;i++){const a=Math.random()*6.28,v=150+Math.random()*450;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-200,c:cols[i%cols.length],life:1+Math.random(),r:Math.random()*6});}}
function updParts(dt){for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.vy+=900*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.r+=dt*8;if(p.life<=0)parts.splice(i,1);}
  for(let i=fxs.length-1;i>=0;i--){const f=fxs[i];f.t+=dt;if(f.t>=f.life){fxs.splice(i,1);continue;}if(f.k==='dot'){f.vy+=500*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;}}}
function drawParts(){for(const p of parts){X.save();X.translate(p.x,p.y);X.rotate(p.r);X.fillStyle=p.c;X.fillRect(-6,-4,12,8);X.restore();}}
function burst(x,y,col='#FFE14D',n=14,sp=260){for(let i=0;i<n;i++){const a=Math.random()*6.28,v=sp*(.4+Math.random()*.8);fxs.push({k:'dot',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.4+Math.random()*.3,t:0,r:3+Math.random()*4,c:col});}}
function ring(x,y,col='#fff',r1=90,d=.4){fxs.push({k:'ring',x,y,life:d,t:0,r:r1,c:col});}
function floatText(s,x,y,col='#FFE14D',size=34){fxs.push({k:'txt',x,y,s,life:.8,t:0,c:col,r:size});}
function drawFx(){for(const f of fxs){const u=f.t/f.life;
  if(f.k==='dot'){X.globalAlpha=1-u;X.fillStyle=INK;X.fillRect(f.x-f.r-2,f.y-f.r-2,f.r*2+4,f.r*2+4);X.fillStyle=f.c;X.fillRect(f.x-f.r,f.y-f.r,f.r*2,f.r*2);}
  else if(f.k==='ring'){X.globalAlpha=1-u;X.strokeStyle=f.c;X.lineWidth=6*(1-u)+1;X.beginPath();X.arc(f.x,f.y,f.r*u+6,0,7);X.stroke();}
  else{X.globalAlpha=1-u*u;T(f.s,f.x,f.y-u*50,f.r*(1+(1-u)*.2),f.c);}
  X.globalAlpha=1;}}
let shakeT=0,shakeA=0;
function shake(a=8,d=.25){shakeA=a;shakeT=d;}

/* ───────── estado (mismos nombres que js/main.js) ───────── */
const PRE=1.4,FIN=2.3;                 /* tarjeta con la orden; el final de cada juego dura lo mismo que en el laboratorio (endT>2.3) */
let state='worlds',st=0,mode='stage',pre=0;
let stageIdx=0,stage=ETAPAS[0],lives=4,played=0,score=0,lastOut=null,stars=0,recent=[],retryId=null,isBoss=false,bossK=0,curId='';
let practiceId=TODOS[0],practiceSp=1;
let outT=0,outcome=null,scored=false,tickN=0,fuseF=0,fuseLeft=9,lastCmd='',cmdT=9,playT=0;
let shownScore=0,scorePop=0,lifeT=99,shownStars=0,toast=null,musKey=null;
let hp={x:-999,y:-999},pressing=false,btns=[];
const live=()=>state==='play'&&pre<=0&&!!G&&!G.result;
const speed=()=>Math.min(1.8,+(stage.sp0+Math.floor(played/2)*.1).toFixed(2));
const hovered=(x,y,w,h)=>hp.x>=x&&hp.x<=x+w&&hp.y>=y&&hp.y<=y+h;
const say=(s,col='#5CFF7A')=>{toast={s,col,t:0};};

function estilo(k){save.estilo=k;persist();if(k!=='mezcla')setStyle(k);else if(!ESTILOS.some(e=>e[0]===style))setStyle('snes');}
function mezcla(){const op=ESTILOS.map(e=>e[0]).filter(k=>k!==style);setStyle(op[Math.random()*op.length|0]);}
const nombreEstilo=()=>(ESTILOS.find(e=>e[0]===style)||['',style])[1];

function goMenu(){state='menu';st=0;mode='stage';parts.length=0;}

/* ───────── mundos ───────── */
const APP=new URL('../../',location.href).href;
let appFr=null,appOn=false,appStages=19,appStars=0;
/* la etapa del apagón ya no es del mundo clásico: se quita de su lista (y sus juegos del MEGA MIX y de la práctica) antes de que
   arranque js/main.js. Es la última de STAGES, así que los índices guardados de las demás no se mueven. */
const SIN_APAGON="<script>{const i=STAGES.findIndex(s=>s.boss==='blackout');if(i>=0)STAGES.splice(i,1);for(let k=REG.length-1;k>=0;k--)if(REG[k].id.startsWith('ap_')){delete REGMAP[REG[k].id];REG.splice(k,1);}}</script>";
const cuentaClasico=()=>{try{appStars=((JSON.parse(localStorage.getItem('claudeware-save-v2'))||{}).stars||[]).slice(0,appStages).reduce((a,b)=>a+(b||0),0);}catch(e){appStars=0;}};
fetch(APP+'js/stages.js').then(r=>r.text()).then(t=>{const n=(t.match(/\{\s*name:/g)||[]).length;if(n){appStages=n-(/boss:\s*'blackout'/.test(t)?1:0);cuentaClasico();}}).catch(()=>{});
function goWorlds(){state='worlds';st=0;mode='stage';parts.length=0;cuentaClasico();}
function closeClassic(){if(appFr){appFr.remove();appFr=null;}appOn=false;goWorlds();try{window.focus();}catch(e){}}
function openClassic(){if(appFr)return;
  const f=appFr=document.createElement('iframe');f.id='camp-app';f.allowFullscreen=true;f.style.visibility='hidden';document.body.append(f);
  fetch(APP+'index.html',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text();}).then(h=>{if(appFr!==f)return;
    h=h.replace(/<meta name="(openpanel-client-id|openpanel-api-url|meta-pixel-id)"[^>]*>/g,'').replace(/<script src="js\/pwa\.js[^"]*"><\/script>/,'').replace(/(<script src="js\/stages\.js[^"]*"><\/script>)/,'$1'+SIN_APAGON).replace('<head>','<head><base href="'+APP+'">');
    const w=f.contentWindow,d=f.contentDocument;d.open();
    w.addEventListener('load',()=>{if(appFr!==f)return;
      if(typeof w.goMenu!=='function'){closeClassic();say('EL MUNDO CLÁSICO NO CARGÓ','#FF4D4D');return;}
      try{w.eval("I18N.add('es',{'TITLE':'MUNDOS'});I18N.add('en',{'TITLE':'WORLDS'});");}catch(e){}
      w.goTitle=()=>setTimeout(closeClassic,0);w.goMenu();
      f.style.visibility='';appOn=true;stopMusic();musKey=null;try{w.focus();}catch(e){}});
    d.write(h);d.close();
  }).catch(e=>{if(appFr===f){closeClassic();say('NO PUDE ABRIR EL MUNDO CLÁSICO: '+(e&&e.message||e),'#FF4D4D');}});}
function goPractice(){state='practice';st=0;mode='practice';parts.length=0;}
function startStage(i){if(!ETAPAS[i])return;mode='stage';stageIdx=i;stage=ETAPAS[i];lives=4;played=0;score=0;lastOut=null;recent=[];retryId=null;bossK=0;
  state='stagein';st=0;shownScore=0;lifeT=99;jingleGo();}
function startPractice(id){if(!GAMES[id])return;mode='practice';practiceId=id;lastOut=null;state='inter';st=0;}
function toInter(){state='inter';st=0;if(mode!=='practice')jingleGo();}
function beginGame(){let id,s;
  if(mode==='practice'){id=practiceId;s=practiceSp;isBoss=!!JEFES[id];}
  else if(played>=stage.n){id=stage.jefes[bossK];s=Math.min(1.8,+(stage.sp0+Math.floor(stage.n/2)*.1).toFixed(2));isBoss=true;}
  else{const pool=stage.pool,free=pool.filter(k=>!recent.includes(k));
    id=retryId&&pool.includes(retryId)?retryId:free[Math.random()*free.length|0];
    if(!recent.includes(id))recent.push(id);if(recent.length>Math.min(6,pool.length-2))recent.shift();
    s=speed();isBoss=false;}
  if(save.estilo==='mezcla'&&id!==retryId)mezcla();
  SP=s;gameId=curId=id;PT.length=0;G=GAMES[id].mk();EGGS.begin(id);
  outT=0;outcome=null;scored=false;tickN=0;fuseF=0;fuseLeft=9;lastCmd=G.cmd;cmdT=9;playT=0;pre=PRE;state='play';}
function setOutcome(r){outcome=r;outT=0;fx.stamp();EGGS.outcome(curId,r);
  if(r==='win'){if(mode==='stage'){const g=100+Math.round((1-fuseF)*50);score+=g;scorePop=1;floatText('+'+g,W-80,108,'#FFE14D',30);}}
  else{if(mode==='stage'){lives--;lifeT=0;ring(36+Math.max(0,lives)*40,52,'#FF4D4D',40,.5);}shake(12,.35);}}
function next(){lastOut=outcome;const win=lastOut==='win';
  if(mode==='practice'){state='inter';st=0;}
  else if(isBoss){if(win){bossK++;if(bossK>=stage.jefes.length)clearStage();else toInter();}else if(lives<=0)toOver();else toInter();}
  else{if(win){played++;retryId=null;}else retryId=curId;if(lives<=0)toOver();else toInter();}}   /* perder = repetir ese microjuego; solo ganar avanza */
function clearStage(){stars=lives>=3?3:lives>=2?2:1;save.stars[stageIdx]=Math.max(save.stars[stageIdx]||0,stars);save.best[stageIdx]=Math.max(save.best[stageIdx]||0,score);persist();
  state='clear';st=0;shownStars=0;jingleWin();confetti(W/2,200,60);EGGS.clear(false);}
function toOver(){state='over';st=0;fx.thud();shake(14,.45);}
function afterClear(){if(stageIdx<ETAPAS.length-1)startStage(stageIdx+1);else goMenu();}
function exitPlay(){mode==='practice'?goPractice():goMenu();}
/* un juego que revienta no congela la prueba: se avisa cuál fue y se sigue */
function fallo(e,donde){console.error('[campana] '+donde+' · '+curId,e);say('ERROR EN '+curId.toUpperCase()+': '+(e&&e.message||e),'#FF4D4D');
  for(let i=0;i<40;i++)ctx.restore();
  if(state!=='play')return;
  if(mode==='practice')goPractice();else{if(!isBoss)played++;else bossK++;retryId=null;if(isBoss&&bossK>=stage.jefes.length)clearStage();else toInter();}}

function syncMusic(){let want=null,boss=false,bajo=false,i=stageIdx;const sp=mode==='practice'?practiceSp:speed();
  if(save.musica&&(state==='play'||(mode==='stage'&&(state==='stagein'||state==='inter')))){
    bajo=state==='play'&&pre<=0;
    if(mode==='stage')boss=state!=='stagein'&&played>=stage.n;else{boss=isBoss;i=Math.max(0,TODOS.indexOf(curId));}   /* práctica: cada juego con uno de los tonos */
    if(!(bajo&&SIN_SALSA.has(curId))&&!EGGS.song())want=i+(boss?'b':'p')+(bajo?'j':'')+sp;}
  if(want===musKey)return;musKey=want;
  if(want)startMusic(i,Math.min(1.5,sp),boss?'boss':'play',bajo?.5:1);else stopMusic();}

function update(dt){
  st+=dt;lifeT+=dt;cmdT+=dt;scorePop=Math.max(0,scorePop-dt*3);if(shakeT>0)shakeT-=dt;if(toast){toast.t+=dt;if(toast.t>4)toast=null;}
  updParts(dt);shownScore+=(score-shownScore)*Math.min(1,dt*7);if(Math.abs(score-shownScore)<.5)shownScore=score;
  if(state==='clear'&&shownStars<stars&&st>.5+shownStars*.45){const sx=W/2+(shownStars-1)*100;shownStars++;fx.coin();burst(sx,250,'#FFE14D',16,300);ring(sx,250,'#fff',70,.45);if(shownStars===stars)fx.sparkle();}
  if(state==='stagein'){if(st>2.4)toInter();}
  else if(state==='inter'){if(st>(mode==='practice'?.8:1.4))beginGame();}
  else if(state==='play'){
    if(pre>0){pre-=dt;if(pre<=0)lastPaint=-9;}
    else{
      G.update(dt);updP(dt);playT+=dt;
      if(!G.result){
        const t=G.t,d=G.dur||1;fuseF=clamp(t/d,0,1);fuseLeft=d-t;
        const n=Math.floor(t*2);if(n!==tickN){tickN=n;tone(430+520*fuseF+(fuseLeft<1.5?200:0),.04,'square',fuseLeft<1.5?.035:.02);}
        if(G.cmd!==lastCmd){lastCmd=G.cmd;cmdT=0;jingleGo();}                       /* jefes: cambió la fase, nueva orden */
        if(playT>90)throw new Error('90 s sin resultado');
      }else{if(!scored){scored=true;setOutcome(G.result);}outT+=dt;if(G.endT>FIN)next();}
    }
  }else if(state==='clear'&&Math.random()<dt*6)confetti(Math.random()*W,100,12);
  syncMusic();
}

/* ───────── piezas de interfaz ───────── */
function hoverBox(x,y,w,h,fill,o=5,depth=5){const hv=hovered(x,y,w,h),pr=hv&&pressing;X.save();const off=pr?depth-1:hv?-2:0;X.translate(off,off);
  box3(x,y,w,h,fill,o,pr?1:hv?depth+2:depth);if(hv){X.fillStyle='rgba(255,255,255,.22)';X.fillRect(x,y,w,h);}return hv;}
function button(x,y,w,h,label,fn,op={}){hoverBox(x,y,w,h,op.fill||'#fff',op.o||5,op.depth||5);T(label,x+w/2,y+h/2+2,op.size||26,op.col||INK,'center',w-16);X.restore();btns.push({x,y,w,h,fn});}
function livesRow(x,y,u,gap){for(let i=0;i<4;i++){const cx=x+i*gap;
  if(i<lives){caos(cx,y-(lives===1?Math.abs(Math.sin(now*8))*u*.8:0),u);continue;}
  const k=i===lives?lifeT/.9:9;if(k>=1){caos(cx,y,u,{col:'#4a4558',mood:'sad'});continue;}      /* la que se acaba de perder: salta, parpadea en rojo y se apaga */
  const sc=k<.25?1+k*2.4:1.6-(k-.25)/.75*.6;X.save();X.translate(cx+(Math.random()-.5)*4*(1-k),y);X.scale(sc,sc);caos(0,0,u,{col:k<.5?(Math.sin(k*40)>0?'#FF4D4D':'#fff'):'#4a4558',mood:'sad'});X.restore();}}
function stars3(cx,cy,n,size,gap){for(let i=0;i<3;i++)star(cx+(i-1)*gap,cy,size,size*.45,5,-Math.PI/2,i<n?'#FFE14D':'#4a4558',3);}
/* la mecha de la bomba: se quema de izquierda a derecha hasta la bomba; al final tiembla y cuenta los segundos */
function fuse(){const f=fuseF,done=!!G.result,danger=!done&&fuseLeft<2;
  const col=f<.5?'#5CFF7A':f<.75?'#FFE14D':'#FF4D4D',x0=24,x1=W-70,sx=x0+(x1-x0)*f,y=H-20+(danger?(Math.random()-.5)*4:0);
  X.fillStyle='rgba(0,0,0,.45)';X.fillRect(0,H-40,W,40);
  X.fillStyle=INK;X.fillRect(x0-4,y-10,x1-x0+8,20);X.fillStyle='#3a3550';X.fillRect(x0,y-6,x1-x0,12);
  X.globalAlpha=danger&&Math.sin(now*26)>.4?.6:1;X.fillStyle=col;X.fillRect(sx,y-6,x1-sx,12);X.fillStyle='rgba(255,255,255,.4)';X.fillRect(sx,y-6,x1-sx,3);X.globalAlpha=1;
  if(!done)star(sx,y,14+Math.random()*6,5,8,now*10,'#FFB020',3);
  const shk=f>.75&&!done?(Math.random()-.5)*5:0;
  circ(W-40+shk,y,16,f>.85&&!done&&Math.sin(now*30)>0?'#ff3b3b':'#2b2b3a',4);X.fillStyle='#fff';X.fillRect(W-47+shk,y-8,5,5);
  if(danger)T(Math.ceil(fuseLeft)+'',W-40,y-36-Math.abs(Math.sin(now*10))*6,30,'#FF4D4D');}
function chips(y,h){const all=ESTILOS.concat([['mezcla','MEZCLA']]),w=104,g=6,x0=(W-(all.length*w+(all.length-1)*g))/2;
  all.forEach(([k,n],i)=>button(x0+i*(w+g),y,w,h,n,()=>estilo(k),{fill:save.estilo===k?'#FFE14D':'#fff',size:15,depth:4,o:4}));}

function worldCard(i,x,y,w,h,m,fn){const pop=easeOut((st-i*.08)/.35);X.save();X.translate(0,(1-pop)*50);X.globalAlpha=pop;
  const hv=hoverBox(x,y,w,h,m.bg,5,8),sp=Math.min(76,(w-56)/m.cols.length);
  T('MUNDO',x+w/2,y+36,26,'#fff');T(m.name,x+w/2,y+84,54,'#FFE14D','center',w-36);
  m.cols.forEach((cl,k)=>{const cx=x+w/2+(k-(m.cols.length-1)/2)*sp,j=Math.abs(Math.sin(now*(hv?7:4)+k*.9))*(hv?20:12);shadow(cx,y+222,24,5,.25);caos(cx,y+220-j,4.4,{col:cl,mood:hv?'happy':null});});
  T(m.l1,x+w/2,y+262,20,'#fff','center',w-30);TW(m.l2,x+w/2,y+296,16,INK,w-44,2);
  star(x+w/2-58,y+356,15,6.8,5,-Math.PI/2,'#FFE14D',3);T(m.stars,x+w/2-34,y+358,22,'#fff','left');
  X.restore();X.restore();btns.push({x,y,w,h,fn});}

/* ───────── pantallas ───────── */
function render(){
  btns=[];X.setTransform(DPR,0,0,DPR,0,0);X.clearRect(0,0,W,H);X.save();
  if(shakeT>0){const k=shakeT*shakeA*3;X.translate((Math.random()-.5)*k,(Math.random()-.5)*k);}
  if(state==='worlds'){
    rays('#2b2757','#322d66',now);
    T('ELIGE MUNDO',W/2,52,54,'#FFE14D');
    worldCard(0,30,104,360,396,{name:'VENEZUELA',bg:'#F5B93C',cols:ETAPAS.map(e=>e.col),l1:ETAPAS.length+' ETAPAS · '+TODOS.length+' JUEGOS · '+Object.keys(JEFES).length+' JEFES',
      l2:'La camionetica, la casa, la rumba… y se fue la luz. Otra vez.',stars:save.stars.reduce((a,b)=>a+(b||0),0)+' / '+ETAPAS.length*3},goMenu);
    worldCard(1,410,104,360,396,{name:'CLÁSICO',bg:'#6EC6FF',cols:['#FF6B3D','#6EA8FE','#7BD88F','#F28CB1','#B49CFF'],l1:appStages+' ETAPAS · 100+ JUEGOS',
      l2:'Las etapas de siempre: bichos, teclado, reflejos, 3D, deportes…',stars:appStars+' / '+appStages*3},openClassic);
    if(appFr&&!appOn){X.fillStyle='rgba(20,16,28,.7)';X.fillRect(0,0,W,H);T('CARGANDO MUNDO CLÁSICO…',W/2,H/2,40,'#FFE14D','center',740);btns=[];}
    T('DENTRO DE CADA MUNDO, «MUNDOS» O ESC TE DEVUELVEN AQUÍ',W/2,548,16,'#fff','center',770);
  }else if(state==='menu'){
    rays('#2b2757','#322d66',now);
    button(14,14,132,38,'◄ MUNDOS',goWorlds,{size:16,depth:4,o:4});T('ELIGE ETAPA',W/2,36,40,'#FFE14D');T('MUNDO VENEZUELA',W-16,36,15,'#fff','right');
    ETAPAS.forEach((s,i)=>{const sola=i===ETAPAS.length-1&&i%2===0,x=sola?210:14+(i%2)*392,y=62+(i/2|0)*102,w=380,h=90,pop=easeOut((st-i*.05)/.3),dk=lum(s.bg[0])<.3?'#fff':INK;
      X.save();X.translate(0,(1-pop)*40);X.globalAlpha=pop;hoverBox(x,y,w,h,s.bg[0],5,7);
      shadow(x+50,y+80,26,5,.25);caos(x+50,y+78-Math.abs(Math.sin(now*3+i))*5,3.8,{col:s.col});
      T('ETAPA '+(i+1),x+98,y+15,14,'#fff','left');if(save.best[i])T('RÉCORD '+save.best[i],x+w-12,y+15,13,'#fff','right');
      T(s.name,x+98,y+39,25,'#fff','left',268);
      T(s.n+' JUEGOS + '+(s.jefes.length>1?s.jefes.length+' JEFES':'JEFE'),x+98,y+62,14,dk,'left',170);
      T(s.jefes.length>1?'LOS '+(['','','DOS','TRES','CUATRO','CINCO'][s.jefes.length]||s.jefes.length)+', SEGUIDOS':JEFES[s.jefes[0]]||'',x+98,y+79,12,dk,'left',170);
      stars3(x+w-52,y+70,save.stars[i]||0,11,27);
      X.restore();X.restore();btns.push({x,y,w,h,fn:()=>startStage(i)});});
    T('ESTILO DE DIBUJO',W/2,380,16,'#fff');chips(394,36);
    button(60,446,320,56,'PRÁCTICA',goPractice,{fill:'#5CFF7A'});
    button(420,446,320,56,save.musica?'MÚSICA: SÍ':'MÚSICA: NO',()=>{save.musica=!save.musica;persist();},{fill:'#fff'});
    T('4 VIDAS · SI PIERDES, REPITES ESE JUEGO · CADA 2 JUEGOS, MÁS RÁPIDO · TODAS LAS ETAPAS ABIERTAS',W/2,528,14,'#fff','center',770);
    T('1-7 ESTILO (TAMBIÉN JUGANDO) · P PRÁCTICA · M MÚSICA · ESC MUNDOS',W/2,562,16,'#fff','center',770);
  }else if(state==='practice'){
    rays('#1f2a44','#26335a',now);
    button(14,10,150,40,'◄ ETAPAS',goMenu,{size:17,depth:4,o:4});T('PRÁCTICA',W/2,31,34,'#FFE14D');
    [1,1.4,1.8].forEach((s,i)=>button(W-14-228+i*79,10,70,40,'NIV '+(i+1),()=>{practiceSp=s;},{size:16,depth:4,o:4,fill:practiceSp===s?'#FFE14D':'#fff'}));
    chips(64,34);
    const ids=TODOS.concat(Object.keys(JEFES).filter(id=>GAMES[id])),rows=Math.ceil(ids.length/5),ph=Math.min(60,478/rows);
    ids.forEach((id,i)=>button(13+(i%5)*156,112+(i/5|0)*ph,150,ph-10,GAMES[id].name,()=>startPractice(id),{size:16,depth:4,o:4,fill:JEFES[id]?'#FF9A8A':'#fff'}));
  }else if(state==='stagein'){
    rays(stage.bg[0],stage.bg[1],now);
    const e1=easeOut(st/.45),e2=easeOut((st-.15)/.45),e3=easeBack((st-.35)/.4),stn='ETAPA '+(stageIdx+1);
    T(stn,W/2-(1-e1)*800+5,110,90,INK,'center',760);T(stn,W/2-(1-e1)*800,105,90,'#fff','center',760);
    T(stage.name,W/2+(1-e2)*900+4,209,64,INK,'center',740);T(stage.name,W/2+(1-e2)*900,205,64,'#FFE14D','center',740);
    X.globalAlpha=clamp01((st-.5)/.3);T(stage.tag,W/2,275,28,'#fff','center',700);X.globalAlpha=1;
    const jb=Math.abs(Math.sin(now*5))*30;shadow(W/2,502,74-jb*.6,11,.3);
    X.save();X.translate(W/2,498-jb);X.scale(e3,e3);caos(0,0,11,{col:stage.col,mood:'happy'});X.restore();
    X.globalAlpha=clamp01((st-.7)/.3);T(stage.n+' JUEGOS + '+(stage.jefes.length>1?stage.jefes.length+' JEFES':'JEFE'),W/2,545,28,'#fff');X.globalAlpha=1;
  }else if(state==='inter'){
    const bossNext=mode==='stage'&&played>=stage.n;
    rays(bossNext?(Math.sin(now*12)>0?'#3b0d14':'#4d1119'):'#1b1b3a',bossNext?'#5b1d2b':'#26265a',now);
    let msg,mc='#5CFF7A';
    if(mode==='practice'){msg='¿LISTO?';mc='#FFE14D';}
    else if(bossNext){msg=lastOut==='lose'?'¡OTRA VEZ!':bossK>0?'¡OTRO JEFE!':'¡JEFE!';mc='#FF4D4D';}
    else if(played===0&&!lastOut){msg='¡PREPÁRATE!';mc='#FFE14D';}
    else if(lastOut==='lose'){msg='¡AUCH!';mc='#FF4D4D';}
    else if(played%2===0){msg='¡MÁS RÁPIDO!';mc='#FFE14D';}
    else msg='¡BIEN!';
    const zk=easeBack(st/.3),zs=bossNext?1+Math.sin(now*14)*.03:1;
    X.save();X.translate(W/2+(bossNext?(Math.random()-.5)*4:0),120);X.rotate(Math.sin(now*8)*.04);X.scale(zk*zs,zk*zs);T(msg,5,7,96,INK,'center',760);T(msg,0,0,96,mc,'center',760);X.restore();
    X.globalAlpha=clamp01((st-.12)/.2);
    T(mode==='practice'?GAMES[practiceId].name+' · NIVEL '+(practiceSp>=1.7?3:practiceSp>=1.3?2:1):bossNext?JEFES[stage.jefes[bossK]]:'JUEGO '+(played+1)+' / '+stage.n,W/2-(1-easeOut((st-.1)/.3))*300,205,36,'#fff','center',700);X.globalAlpha=1;
    const mood=!lastOut||mode==='practice'?null:lastOut==='win'?'happy':'sad',hop=mood==='happy'?Math.abs(Math.sin(now*9))*28:0,rise=(1-easeOut(st/.35))*220;
    shadow(W/2,438,78-hop*.5,11,.3);caos(W/2,434-hop+rise,12,{col:mode==='stage'?stage.col:OR,mood});
    if(mode==='stage'){livesRow(W/2-108,520,3.2,72);const sp=1+scorePop*.3;X.save();X.translate(W/2,572);X.scale(sp,sp);T('PUNTOS '+Math.round(shownScore),0,0,24);X.restore();}
    else button(W-78,80,66,30,'SALIR',exitPlay,{size:15,fill:'rgba(255,255,255,.85)'});
  }else if(state==='play'){
    if(pre>0){                                              /* primero la tarjeta con la orden; el juego aparece después */
      rays(isBoss?'#3b0d14':'#1b1b3a',isBoss?'#5b1d2b':'#26265a',now);
      const k=Math.min(1,(PRE-pre)/.15),sc=1+(1-k)*.8;
      X.save();X.translate(W/2,H/2-50);X.scale(sc,sc);X.rotate(Math.sin(now*12)*.03);T(G.cmd,0,0,120,isBoss?'#FF4D4D':'#FFE14D','center',740);X.restore();
      TW(G.hint,W/2,H/2+50,28,'#fff',700,3);
    }else{
      if(!G.result){
        TW(G.hint,W/2,24,17,'#fff',430,2);                    /* entre la placa de vidas y la de puntos */
        if(cmdT<1.2){const k=easeBack(cmdT/.25);X.save();X.translate(W/2,130);X.scale(k,k);X.rotate(Math.sin(now*12)*.03);X.globalAlpha=clamp01((1.2-cmdT)/.2);T(G.cmd,0,0,84,'#FF4D4D','center',720);X.restore();}
      }else if(G.endT<1.6){                                 /* el sello: el texto es el «porqué» de cada juego, con el marco de la app */
        const win=outcome==='win',sc=outT<.14?2.6-1.6*easeOut(outT/.14):1+Math.max(0,.12-(outT-.14))*1.2,lab=G.why||(win?'¡BIEN!':'¡FALLASTE!'),cc=win?'#5CFF7A':'#FF4D4D';
        X.save();X.translate(W/2,H/2);X.rotate(-.1);X.scale(sc,sc);X.globalAlpha=Math.min(1,outT/.06)*clamp01((1.6-G.endT)/.15);
        X.font=face(104,false);const tw=Math.min(640,X.measureText(lab).width)+50;
        X.fillStyle='rgba(20,16,28,.55)';X.fillRect(-tw/2+8,-64+10,tw,128);
        X.lineWidth=9;X.strokeStyle=cc;X.strokeRect(-tw/2,-64,tw,128);X.lineWidth=3;X.strokeStyle=INK;X.strokeRect(-tw/2-8,-72,tw+16,144);
        T(lab,0,4,104,cc,'center',tw-30);X.restore();
      }
      fuse();
    }
    if(mode==='stage'){
      X.fillStyle='rgba(20,16,28,.4)';X.fillRect(10,36,176,40);X.fillRect(W-140,10,132,66);
      livesRow(36,66,2.4,40);
      T(isBoss?(stage.jefes.length>1?'JEFE '+(bossK+1)+'/'+stage.jefes.length:'JEFE'):(played+1)+'/'+stage.n,W-16,30,26,isBoss?'#FF4D4D':'#fff','right',116);
      X.save();const sp=1+scorePop*.3;X.translate(W-16,62);X.scale(sp,sp);T(String(Math.round(shownScore)),0,0,22,'#FFE14D','right');X.restore();
    }else{T('PRÁCTICA',W-16,30,22,'#fff','right');T(nombreEstilo()+' · NIV '+(SP>=1.7?3:SP>=1.3?2:1),W-16,58,14,'#fff','right');}
    button(W-78,80,66,30,mode==='practice'?'SALIR':'MENÚ',exitPlay,{size:15,fill:'rgba(255,255,255,.85)'});
  }else if(state==='over'){
    rays('#3b0d14','#4d1119',now);
    const gk=st<.14?2.6-1.6*easeOut(st/.14):1;
    X.save();X.translate(W/2,120);X.rotate(-.06);X.scale(gk,gk);X.globalAlpha=Math.min(1,st/.06);T('FIN DEL JUEGO',6,8,100,INK,'center',760);T('FIN DEL JUEGO',0,0,100,'#FF4D4D','center',760);X.restore();
    shadow(W/2,404,74,11,.3);caos(W/2,400+(1-easeOut(st/.5))*120,13,{mood:'sad'});
    T(stage.name+' · PUNTOS '+Math.round(shownScore),W/2,455,34,'#fff','center',760);
    if(st>.4){button(110,495,280,70,'REINTENTAR',()=>startStage(stageIdx),{fill:'#5CFF7A'});button(410,495,280,70,'ETAPAS',goMenu);}
  }else if(state==='clear'){
    rays(stage.bg[0],stage.bg[1],now);
    const last=stageIdx===ETAPAS.length-1;
    T(last?'¡TE PASASTE EL CAOS!':'¡ETAPA SUPERADA!',W/2,105,84,'#fff','center',760);T(stage.name,W/2,180,40,'#FFE14D','center',700);
    const jc=Math.abs(Math.sin(now*6))*24;shadow(W/2,436,52-jc*.6,8,.3);caos(W/2,432-jc,8,{col:stage.col,mood:'happy'});
    for(let i=0;i<3;i++){const thr=.5+i*.45,on=i<stars&&st>=thr,k=on?easeBack((st-thr)/.35):1,sz=on?40*k:34;
      star(W/2+(i-1)*100,250,sz,sz*.45,5,-Math.PI/2+(on?(1-k)*.9:0),on?'#FFE14D':'#4a4558',3);}
    drawParts();
    T(score>=(save.best[stageIdx]||0)&&score>0?'PUNTOS '+Math.round(shownScore)+'  ¡NUEVO RÉCORD!':'PUNTOS '+Math.round(shownScore)+'  RÉCORD '+(save.best[stageIdx]||0),W/2,466,30,'#fff','center',760);
    if(st>.5){if(!last)button(110,500,280,66,'SIGUIENTE ►',afterClear,{fill:'#5CFF7A'});button(last?260:410,500,280,66,'ETAPAS',goMenu);}
  }
  drawFx();
  if(!(state==='play'&&pre<=0))vignette(.35);
  if(toast){X.globalAlpha=clamp01(4-toast.t);X.fillStyle='rgba(20,16,28,.85)';X.fillRect(0,H-84,W,40);T(toast.s,W/2,H-64,18,toast.col,'center',770);X.globalAlpha=1;}
  X.restore();
}

/* ───────── enganche con el laboratorio ───────── */
hud=function(){};                                  /* la orden, la pista, el reloj y el sello los pone la capa de la app */
frameWW=function(){};                              /* los corazones y rupias de adorno del estilo wind waker chocan con las vidas */
const pintar=paintFrame;
paintFrame=function(){if(state!=='play'||pre>0)return;try{pintar();}catch(e){fallo(e,'draw');}};
tick=function(dt){now+=dt;if(appOn)return;try{update(dt);}catch(e){fallo(e,'update');}render();};   /* con el mundo clásico abierto, aquí no se mueve nada */

/* ───────── entrada: en captura, antes que el laboratorio y los juegos ───────── */
const pos=e=>{const r=view.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};};
const despierta=()=>{try{const a=A();a.resume&&a.resume();}catch(e){}};
addEventListener('pointerdown',e=>{if(e.target!==view)return;despierta();const p=pos(e);hp=p;pressing=true;
  const b=btns.find(b=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h);
  if(b){e.stopImmediatePropagation();e.preventDefault();fx.click();b.fn();return;}
  if(!live())e.stopImmediatePropagation();},true);
addEventListener('pointermove',e=>{if(e.target!==view)return;hp=pos(e);if(!live())e.stopImmediatePropagation();},true);
const suelta=e=>{pressing=false;if(e.pointerType==='touch')hp={x:-999,y:-999};};
addEventListener('pointerup',suelta,true);addEventListener('pointercancel',suelta,true);
addEventListener('contextmenu',e=>{if(e.target===view)e.preventDefault();});
addEventListener('keydown',e=>{despierta();const k=e.code,go=k==='Enter'||k==='Space';
  if(/^Digit[1-9]$/.test(k)){e.stopImmediatePropagation();const i=+k.slice(5)-1;if(!e.repeat&&i<=ESTILOS.length)estilo(i<ESTILOS.length?ESTILOS[i][0]:'mezcla');return;}
  if(k==='KeyM'){e.stopImmediatePropagation();if(!e.repeat){save.musica=!save.musica;persist();say(save.musica?'MÚSICA: SÍ':'MÚSICA: NO','#FFE14D');}return;}
  if(k==='Escape'){e.stopImmediatePropagation();if(state==='play'||state==='inter'||state==='stagein')exitPlay();else if(state==='practice'||state==='over'||state==='clear')goMenu();else if(!appFr)goWorlds();return;}
  if(k==='KeyR'&&mode==='practice'&&state==='play'){e.stopImmediatePropagation();if(!e.repeat)beginGame();return;}
  if(live())return;                                                       /* jugando: la tecla es del juego */
  e.stopImmediatePropagation();if(go||k.startsWith('Arrow'))e.preventDefault();if(e.repeat)return;
  if(state==='menu'&&k==='KeyP')goPractice();
  else if(state==='over'&&go&&st>.4)startStage(stageIdx);
  else if(state==='clear'&&go&&st>.5)afterClear();},true);

/* ───────── arranque ───────── */
const q=new URLSearchParams(location.search),qe=q.get('estilo');
estilo(qe&&(qe==='mezcla'||ESTILOS.some(e=>e[0]===qe))?qe:(save.estilo==='mezcla'||ESTILOS.some(e=>e[0]===save.estilo))?save.estilo:'snes');
goWorlds();
if(q.get('juego')&&GAMES[q.get('juego')])startPractice(q.get('juego'));else if(ETAPAS[+q.get('etapa')-1])startStage(+q.get('etapa')-1);
else if(q.get('mundo')==='venezuela')goMenu();else if(q.get('mundo')==='clasico')openClassic();
window.CAMP={get state(){return state;},get info(){return{state,mode,stage:stageIdx,played,lives,score,pre,curId,isBoss,bossK,style,SP,result:G&&G.result,endT:G&&G.endT};},
  ETAPAS,JEFES,TODOS,startStage,startPractice,goMenu,goPractice,goWorlds,openClassic,closeClassic,get app(){return appFr&&appFr.contentWindow;},estilo,set lives(n){lives=n;},set played(n){played=n;}};
})();
