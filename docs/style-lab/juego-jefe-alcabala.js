'use strict';
/* MiniCaos · laboratorio de estilos: JEFE «LA ALCABALA NOCTURNA».
   De noche por la nacional: conos anaranjados y una linterna. Tres fases seguidas, cada una con su reloj:
   1. ¡ALÍSTATE! (primera persona, llegando al cono): tres botones del tablero son interruptores y tienen que quedar bien
      (VIDRIOS abajo, luces BAJAS, luz INTERIOR prendida). Tocarlos otra vez los devuelve. Los demás son trampas que cuestan
      tiempo (corneta; nivel 2 reguetón; nivel 3 limpiaparabrisas, y desde el nivel 2 los botones salen barajados).
   2. ¡LOS PAPELES! (la guantera): hay que ARRASTRAR la basura a un lado y TOCAR la cédula, el carnet y el seguro; un papel
      solo se agarra si ya no tiene nada encima del centro. Los papeles falsos (menú del pollo, factura, carnet del gym)
      cuestan tiempo. El reloj es el guardia caminando, que se ve en el retrovisor. ESPACIO: aparta/agarra solo.
   3. ¡CALMA! (el interrogatorio): el latido corre por el monitor; hay que tocar cuando cruza el verde. Cada acierto es una
      palabra de la respuesta; cada fallo es un tartamudeo que sube los NERVIOS (tocar mal sube más que dejarlo pasar;
      con tres o cuatro fallos te orillan).
      Nivel 2: una pregunta más. Nivel 3: además, arritmia (un latido adelantado cada cuatro) y ventana más angosta.
   Ganas: «PROSIGA, MI PANA». Pierdes en cualquier fase: al hombrillo, a vaciar el maletero (y sale la gallina de siempre).
   El guardia es genérico a propósito: chaleco reflectivo, sin insignias ni cuerpo real.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.alcabala)return;
const{LV,CONF,TU,tag}=window.BUS,PI=Math.PI,GAP=.8;
/* el letrero ¡...! del laboratorio se queda 1 s y el final se ve limpio ~2.4 s más (el laboratorio reinicia con endT > 2.3) */
const sello=f=>f<1?f*1.6:1.6+(f-1)*.29;
const rnd=(a,b)=>a+Math.random()*(b-a);
const shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
const pop=(s,x,y,col,r=8,life=.8)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
const velo=(a,f)=>{if(a<=.01)return;ctx.save();ctx.globalAlpha=Math.min(1,a);f();ctx.restore();};
const GUARDIA={skin:'#b87b50',shirt:'#3d4a5c',pat:'stripes',sh2:'#e6ff4d',cap:'#2b3442',brow:'thick',hairCol:'#14101c',bw:58,hw:42,hh:42};
const NOCHE=['#12102c','#2a2752'];

function cielo(h){wash(gameLeft(),0,GAME_VIEW.width,h,NOCHE[0],NOCHE[1]);for(let i=0;i<16;i++)ell((i*137+60)%800,104+(i*53)%120,1.7,1.7,'#ffffff',0);ell(700,138,22,22,'#fff6c8',0);ell(708,132,18,18,NOCHE[0],0);}
function cono(x,y,s){rr(x-22*s,y-7*s,44*s,10*s,3,'#ff7a1a',Math.min(3,s*3));poly([[x-15*s,y-6*s],[x+15*s,y-6*s],[x+4*s,y-58*s],[x-4*s,y-58*s]],'#ff7a1a',Math.min(3.5,s*3.5));
  poly([[x-11.5*s,y-22*s],[x+11.5*s,y-22*s],[x+8.5*s,y-36*s],[x-8.5*s,y-36*s]],'#ffffff',0);}
/* la linterna: (x, y) = la mano; el foco mira hacia +x antes de girar */
function linterna(x,y,rot,s=1){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);rr(-30,-9,42,18,5,'#2b2b3a',3.5);poly([[10,-9],[26,-18],[26,18],[10,9]],'#8f8fa8',3.5);ell(27,0,5,17,'#fffbe0',2.5);ctx.restore();}
/* papeles de la guantera: los tres buenos y los tres falsos, todos del mismo tamaño (124 x 80) */
function papel(id,x,y,rot,s){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
  if(id==='ced'){rr(-62,-40,124,80,8,'#bfe0ff',4);rr(-54,-28,38,50,4,'#ffffff',2.5);rr(-47,6,24,16,6,'#3fb0ff',2);ell(-35,-8,10,11,'#e9a77c',2.5);ell(-35,-17,11,6,'#2a1a14',0);
    txt('CÉDULA',22,-24,14,INK,0,true);for(let i=0;i<3;i++)rr(-8,-8+i*13,58-i*12,6,3,'#5a7fb0',0);}
  else if(id==='car'){rr(-62,-40,124,80,8,'#ffe08a',4);txt('CARNET DE',0,-26,12,INK,0,true);txt('CIRCULACIÓN',0,-11,12,INK,0,true);rr(-18,0,34,14,5,'#c4283a',2.5);rr(-32,10,64,16,6,'#c4283a',2.5);ell(-17,27,6,6,INK,0);ell(17,27,6,6,INK,0);}
  else if(id==='seg'){rr(-62,-40,124,80,6,'#fffdf2',4);poly([[-48,-28],[-18,-28],[-18,2],[-33,18],[-48,2]],'#e8553d',3);txt('SEGURO',24,-22,14,INK,0,true);for(let i=0;i<3;i++)rr(-6,-6+i*12,56,5,2,'#8f8fa8',0);}
  else if(id==='menu'){rr(-62,-40,124,80,6,'#ffb3d0',4);txt('POLLO',0,-22,16,'#c4283a',0,true);txt('EN BRASA',0,-4,13,INK,0,true);txt('· MENÚ ·',0,20,12,INK,0,true);}
  else if(id==='fact'){rr(-62,-40,124,80,2,'#e4e0d6',4);txt('FACTURA',0,-26,13,INK,0,true);for(let i=0;i<4;i++)rr(-48,-12+i*11,96-(i%2)*30,4,2,'#8f8fa8',0);txt('2009',32,30,11,'#c4283a',0,true);}
  else{rr(-62,-40,124,80,10,'#ffb36b',4);txt('GIMNASIO',0,-24,12,INK,0,true);txt('EL TORO',0,-5,16,'#c4283a',0,true);txt('VENCIDO',0,20,13,INK,-.1,true);}
  ctx.restore();}
/* la basura: cada pieza tapa más o menos un óvalo de 76 x 56 */
function basura(j){ctx.save();ctx.translate(j.x,j.y);ctx.rotate(j.rot);const k=j.kind;
  if(k==='cable'){const p=[];for(let i=0;i<=26;i++){const a=i/26*TAU*2.2+j.sd,r=34+20*Math.sin(a*1.7+j.sd);p.push([Math.cos(a)*r*1.5,Math.sin(a)*r]);}line(p,10,'#14101c');line(p,4,'#4a4466');rr(p[26][0]-9,p[26][1]-14,18,26,4,'#c9ced6',3);}
  else if(k==='servi'){const p=[];for(let i=0;i<9;i++){const a=i/9*TAU,r=56+hash(i,j.sd*9|0,3)*24;p.push([Math.cos(a)*r*1.2,Math.sin(a)*r*.82]);}poly(p,'#f4f0e6',4);ell(-14,6,20,13,'#e8c98a',0);line([[-40,-14],[10,-24],[44,-6]],2.5,'#c9c2b0');line([[-30,24],[20,18]],2.5,'#c9c2b0');}
  else if(k==='chicle'){ell(0,0,66,46,'#ff8ac0',4);ell(-20,-12,22,10,'#ffc0de',0);for(let i=0;i<3;i++)line([[36,8+i*8],[70+i*6,26+i*12]],4,'#ff8ac0');rr(-44,10,48,24,4,'#3fb0ff',3);txt('MENTA',-20,22,10,'#ffffff',0,true);}
  else if(k==='cd'){ell(0,0,62,56,'#d9dce6',4);ell(0,0,40,36,'#bfe9ff',0);ell(0,0,13,12,'#3a3350',3);line([[-48,-14],[-22,-34]],2.5,'#8f8fa8');line([[18,30],[44,10]],2.5,'#8f8fa8');txt('MIX 2006',0,-24,10,INK,0,true);}
  else if(k==='media'){limb(-46,-18,18,-8,48,'#e8553d',4);limb(18,-8,40,30,44,'#e8553d',4);for(let i=0;i<3;i++)line([[-40+i*16,-36+i*2],[-44+i*16,2+i*2]],5,'#ffffff');ell(46,36,10,8,'#c4283a',0);}
  else if(k==='ketchup'){rr(-64,-40,128,80,8,'#e8293f',4);ell(-28,0,20,20,'#ff7a5c',3);poly([[-34,-20],[-28,-28],[-22,-20]],'#5cd06a',2);txt('SALSA',26,-10,15,'#ffffff',0,true);txt('x 400',26,12,12,'#ffe08a',0,true);}
  else if(k==='control'){rr(-70,-30,140,60,12,'#2b2b3a',4);ell(-48,0,10,10,'#e8293f',2.5);for(let i=0;i<8;i++)rr(-22+(i%4)*22,-16+(i>3?18:0),14,10,3,'#8f8fa8',0);}
  else if(k==='caset'){rr(-66,-42,132,84,8,'#3b3550',4);rr(-54,-32,108,34,4,'#fffdf2',2.5);txt('SALSA BAÚL',0,-15,12,INK,0,true);rr(-40,10,80,22,10,'#14101c',2.5);ell(-22,21,7,7,'#fffdf2',2);ell(22,21,7,7,'#fffdf2',2);}
  else{line(closeP(ellP(-30,-10,24,24,14)),6,'#c9ced6');for(const[a,c]of[[.5,'#ffd23f'],[1.2,'#c9ced6']]){ctx.save();ctx.translate(-22,4);ctx.rotate(a-1);rr(-6,0,12,62,4,c,3);rr(4,34,12,8,2,c,2.5);rr(4,48,10,8,2,c,2.5);ctx.restore();}ell(-50,-30,20,15,'#f4d9a0',3.5);ell(-50,-31,13,8,'#e8b86a',0);}
  ctx.restore();}

/* ═════════ JEFE: LA ALCABALA NOCTURNA ═════════ */
function mkAlcabala(){
  const lv=LV(),n=lv-1,rs=Math.sqrt(SP);
  const FASES=[
    {cmd:'¡ALÍSTATE!',hint:'TOCA: VIDRIOS abajo (←) · luces BAJAS (↓) · luz INTERIOR prendida (↑)',dur:4.4/rs},
    {cmd:'¡LOS PAPELES!',hint:'ARRASTRA la basura a un lado y TOCA la cédula, el carnet y el seguro (o ESPACIO)',dur:[9.5,8.5,8][n]},
    {cmd:'¡CALMA!',hint:'TOCA (o ESPACIO) justo cuando el latido cruza el VERDE',dur:9}];
  let ph=0,pt=0,gap=0,fin=0,T=0,shake=0,road=0,evI=0,clk=0;
  const rara=Math.random()<.34;

  /* ── fase 1: el tablero ── */
  const st={vid:false,luz:false,int:false},an={vid:0,luz:0,int:0};
  const BT=[{id:'vid',a:'VIDRIOS',off:'ARRIBA',on:'ABAJO',key:'←'},{id:'luz',a:'LUCES',off:'ALTAS',on:'BAJAS',key:'↓'},{id:'int',a:'LUZ INTERIOR',off:'APAGADA',on:'PRENDIDA',key:'↑'},
    {id:'cor',a:'CORNETA',off:'¡PIII!'},{id:'reg',a:'REGUETÓN',off:'A TODO VOLUMEN'},{id:'lim',a:'LIMPIA',off:'PARABRISAS'}].slice(0,3+lv);
  const SL=[[338,452],[484,452],[630,452],[338,530],[484,530],[630,530]].slice(0,BT.length);if(lv>1)shuf(SL);
  BT.forEach((b,i)=>{b.x=SL[i][0];b.y=SL[i][1];b.pop=0;});
  let ok1=0,honk=0,barre=0,perreo=0;
  function tocaB(b){if(ok1)return;b.pop=1;
    if(b.id in st){st[b.id]=!st[b.id];snd(st[b.id]?660:300,.09,'square',.05);
      if(b.id==='vid')snd(180,.35,'sawtooth',.03,st.vid?-60:60);
      if(st.vid&&st.luz&&st.int){ok1=.001;sfx.ding();}}
    else{pt+=.45;shake=1;
      if(b.id==='cor'){honk=.7;snd(392,.5,'sawtooth',.09);snd(494,.5,'sawtooth',.07);pop('¡PIIII!',470,300,'#ffe14d',22);}
      else if(b.id==='reg'){perreo=1;pop('¡TUCUTÚN!',470,300,'#ff5ca8',20);[0,140,280,420].forEach((d,i)=>setTimeout(()=>snd(i%2?110:82,.1,'square',.09),d));}
      else{barre=1;sfx.whoosh();pop('¡FRIS, FRIS!',480,260,'#9fe3ff',16);}}}

  /* ── fase 2: la guantera ── */
  const cells=shuf([[176,306],[400,292],[624,306],[190,458],[410,470],[616,452]]);
  const DOC=[['ced','CÉDULA'],['car','CARNET'],['seg','SEGURO']].map(([id,nm],i)=>({id,nm,x:cells[i][0]+rnd(-14,14),y:cells[i][1]+rnd(-8,8),rot:rnd(-.25,.25),found:false,fly:0,slot:i,fx:0,fy:0}));
  const FK=['menu','fact','gym'].slice(0,lv).map((id,i)=>({id,x:cells[3+i][0],y:cells[3+i][1],rot:rnd(-.3,.3),wob:0}));
  const KINDS=shuf(['cable','servi','chicle','cd','media','ketchup','control','caset','llaves','servi','cable','chicle','media','cd']),JK=[];
  const masB=(x,y)=>JK.push({kind:KINDS[JK.length%KINDS.length],x:clamp(x,96,704),y:clamp(y,236,516),rot:rnd(-.5,.5),sd:Math.random()*9,rx:76,ry:56,gx:null,gy:0});
  for(const d of DOC)for(let i=0;i<[2,3,3][n];i++)masB(d.x+rnd(-30,30),d.y+rnd(-20,20));
  for(const f of FK)masB(f.x+rnd(-24,24),f.y+rnd(-16,16));
  for(let i=0;i<lv;i++)masB(rnd(120,680),rnd(250,500));
  let drag=null,dOff=[0,0],ok2=0,paso=.4,nf=0;
  const encima=(j,x,y)=>((x-j.x)/j.rx)**2+((y-j.y)/j.ry)**2<1;
  const tapado=d=>JK.some(j=>encima(j,d.x,d.y));
  const sobre=(d,p)=>Math.abs(p.x-d.x)<66&&Math.abs(p.y-d.y)<44;
  function agarra(d){d.found=true;d.fx=d.x;d.fy=d.y;nf++;sfx.ding();pop('¡'+d.nm+'!',d.x,d.y-50,'#5cff7a',6);if(nf>=3)ok2=.001;}
  function falso(f){pt+=.6;f.wob=1;shake=.6;sfx.thud();pop({menu:'¡ESO ES EL MENÚ!',fact:'¡UNA FACTURA VIEJA!',gym:'¡EL CARNET DEL GYM!'}[f.id],clamp(f.x,170,630),f.y-56,'#ff9ec7',2);}
  function abajo2(p){
    for(let i=JK.length-1;i>=0;i--)if(encima(JK[i],p.x,p.y)){drag=JK[i];drag.gx=null;JK.splice(i,1);JK.push(drag);dOff=[drag.x-p.x,drag.y-p.y];snd(240,.05,'square',.03);return;}
    for(const d of DOC)if(!d.found&&sobre(d,p)){agarra(d);return;}
    for(const f of FK)if(sobre(f,p)){falso(f);return;}}
  /* teclado: agarra un papel destapado; si no hay, tira a un lado lo que tape al siguiente */
  function solo(){const d=DOC.find(d=>!d.found&&!tapado(d));if(d){agarra(d);return;}
    for(const d of DOC)if(!d.found)for(let i=JK.length-1;i>=0;i--)if(encima(JK[i],d.x,d.y)){const j=JK[i];j.gx=j.x<400?rnd(70,84):rnd(716,730);j.gy=rnd(250,500);sfx.whoosh();return;}}

  /* ── fase 3: el interrogatorio ── */
  const TB=.64/rs,TOL=[.15,.125,.105][n],FALLO=[.3,.3,.36][n],ZX=400,VEL=250;
  const PREG=[{q:"¿DE DÓNDE VIENES Y PA' DÓNDE VAS?",w:['VENGO','DE CASA','DE MI ABUELA','Y VOY',"PA'",'LA MÍA']}];
  if(lv>1)PREG.push({q:'¿Y ESA CARA DE SUSTO?',w:['ES','LA QUE','TENGO']});
  const WORDS=PREG.flatMap((q,qi)=>q.w.map(w=>({w,qi}))),NB=WORDS.length,SPK=[];
  {let t=1.5;for(let i=0;i<NB+5;i++){SPK.push({t,st:0,snd:0});t+=TB*(lv>=3&&i%4===2?.6:1);}}
  FASES[2].dur=SPK[SPK.length-1].t+.4;
  let hits=0,nerv=.1,beat=0,stut=0,tMiss=-9;
  function falla(k){nerv+=FALLO*k;stut=1;shake=.5;snd(160,.14,'sawtooth',.06,-40);const w=WORDS[Math.min(hits,NB-1)].w;pop(w[0]+'-'+w[0]+'-'+w[0]+'...',690,340,'#ff9ec7',4);
    if(nerv>=1)pierde('¡QUÉ NERVIOS!');}
  function toca3(){if(pt<.3)return;let b=null,bd=9;for(const s of SPK)if(!s.st){const d=Math.abs(s.t-pt);if(d<bd){bd=d;b=s;}}
    if(b&&bd<=TOL){b.st=1;hits++;nerv=Math.max(0,nerv-.07);beat=1;snd(520+hits*30,.08,'triangle',.08);if(hits>=NB)gana();}
    else if(pt-tMiss>.25){if(b&&bd<TB*.5)b.st=2;tMiss=pt;falla(1);}}

  function sig(){ph++;pt=0;gap=GAP;drag=null;if(ph===1)sfx.screech();else{sfx.thud();setTimeout(()=>sfx.thud(),160);}}
  function gana(){g.result='win';g.why='¡PROSIGA!';sfx.win();spawn(400,280,26,'conf',CONF);}
  function pierde(why){g.result='lose';g.why=why;drag=null;shake=1;sfx.thud();sfx.lose();}

  /* ── dibujo: fase 1 ── */
  function d1(){const k=clamp(pt/FASES[0].dur,0,1),VX=490,hi=1-an.luz,lose=g.result==='lose';
    cielo(430);poly([[150,252],[260,214],[380,244],[520,206],[680,240],[800,220],[800,262],[150,262]],'#1d1a3c',0);
    rr(gameLeft(),250,GAME_VIEW.width,180,0,'#23203a',0);poly([[VX-46,250],[VX+46,250],[VX+470,430],[VX-470,430]],'#35324a',0);
    for(const sg of[-1,1])line([[VX+sg*46,250],[VX+sg*470,430]],4,'#d8d2c4');
    for(let i=0;i<5;i++){const u=(i/5+road)%1,y=250+u*u*180,w=2+u*9;for(const sg of[-1,1])ell(VX+sg*(40+u*u*366),y,w,w*.6,'#ffb300',0);}
    /* los faros: en altas alumbran hasta al guardia */
    velo(.16+hi*.3,()=>poly([[VX-360,430],[VX+360,430],[VX+60+hi*130,250-hi*80],[VX-60-hi*130,250-hi*80]],hi>.5?'#ffffff':'#ffe9a0',0));
    for(const[z,off]of[[-.5,-1],[-.3,1],[-.1,0]]){const u=clamp(k+z,0,1);if(u>0)cono(VX+off*(40+u*u*230),256+u*u*150,.25+u*u*1.5);}
    const ug=clamp(k-.12,0,1);let gx=0,gy=0,gs=0;
    if(ug>0){gs=.16+ug*ug*.52;gx=VX+74+ug*ug*150;gy=258+ug*ug*150-166*gs;const cov=hi>.5&&!lose;
      velo(.3,()=>ell(gx-58*gs,gy+40*gs,70*gs+Math.sin(now*9)*3,64*gs,'#fff6c8',0));
      bust(Object.assign({},GUARDIA,{x:gx,y:gy,s:gs,flip:true,th:110,legs:['#2b3442','#14101c',60],mood:lose||cov||honk>0?'angry':'calm',look:1,talk:lose?Math.abs(Math.sin(now*16)):0,
        arms:[{side:1,a:cov?2.6:1.2+Math.sin(now*6)*.3,len:cov?60:70,w:20,hand:cov?null:(hx,hy)=>linterna(hx,hy,-.3,1)},{side:-1,a:cov?-2.5:-.2,len:cov?64:74,w:20}]}));}
    if(barre>0){const a=-PI/2+Math.sin(barre*TAU)*1.1;line([[480,428],[480+Math.cos(a)*250,428+Math.sin(a)*250]],9,INK);}
    /* la ventana del chofer, con su papel ahumado: baja con el botón */
    const wy=104+an.vid*300;velo(.86,()=>poly([[0,wy],[150-(wy-104)*.093,wy],[122,404],[0,404]],'#0c0a14',0));if(an.vid<.97)line([[0,wy],[150-(wy-104)*.093,wy]],3,'#8f8fa8');
    poly([[150,96],[190,96],[152,410],[114,410]],'#1c1a2a',4);rr(gameLeft()-10,-10,GAME_VIEW.width+20,108,0,'#1c1a2a',0);line([[gameLeft(),98],[gameRight(),98]],4,INK);
    const sw=Math.sin(now*2.6)*(.12+shake*.3);line([[640,98],[640+Math.sin(sw)*70,98+Math.cos(sw)*70]],2.5,'#c9ced6');ell(640+Math.sin(sw)*90,98+Math.cos(sw)*90,22,22,'#d9dce6',3);ell(640+Math.sin(sw)*90,98+Math.cos(sw)*90,6,6,'#3a3350',2);
    rr(gameLeft()-20,404,GAME_VIEW.width+40,230,36,'#2a2540',4.5);rr(gameLeft(),408,GAME_VIEW.width,12,6,'#3a3456',0);
    line(closeP(ellP(120,606,150,150,30)),32,'#14101c');line(closeP(ellP(120,606,150,150,30)),18,'#3b3550');ell(14,512,25,21,TU.skin,4);ell(232,520,25,21,TU.skin,4);
    /* sin la luz interior, adentro no se ve nada (los botones tienen su lucecita) */
    velo(.55*(1-an.int),()=>{rr(gameLeft(),404,GAME_VIEW.width,196,0,'#000000',0);rr(gameLeft(),0,GAME_VIEW.width,98,0,'#000000',0);});
    rr(424,86,92,24,10,an.int>.5?'#fff3a8':'#4a4660',3.5);velo(.14*an.int,()=>ell(470,330,440,250,'#fff3a8',0));
    for(const b of BT){const sw=b.id in st,ok=sw&&st[b.id],z=b.pop*5;
      rr(b.x-66-z,b.y-31-z,132+z*2,62+z*2,14,sw?(ok?'#5cff7a':'#ffd23f'):'#c9ced6',4);
      txt(b.a,b.x,b.y-11,b.a.length>9?13:16,INK,0,true);txt(sw?(ok?b.on+' ✓':b.off):b.off,b.x,b.y+13,b.off.length>10?10:13,sw&&!ok?'#c4283a':'#3b3550',0,true);
      if(b.key){ell(b.x+58,b.y-26,12,12,'#ffffff',2.5);txt(b.key,b.x+58,b.y-26,15,INK,0,true);}}
    if(perreo>0)for(let i=0;i<3;i++)txt('♪',300+i*120+Math.sin(now*20+i)*8,380-(1-perreo)*60,30,'#ff5ca8');
    if(ug>0&&!lose&&hi>.5&&k>.3)bubble(clamp(gx-70,330,600),176,'¡BAJE ESAS LUCES!',18,gx-10,gy-100*gs);
    if(lose&&ug>0)bubble(clamp(gx-90,330,560),170,'¡ORÍLLESE AL HOMBRILLO!',19,gx-10,gy-100*gs);
    if(ok1)txt('¡LISTO!',470,300,44,'#5cff7a',-.05);}

  /* ── dibujo: fase 2 ── */
  function d2(){const k=clamp(pt/FASES[1].dur,0,1),lose=g.result==='lose';
    wash(gameLeft(),0,GAME_VIEW.width,600,'#2a2540','#1e1a30');rr(24,170,752,400,26,'#14101c',5);rr(40,186,720,368,16,'#3a3350',0);velo(.3,()=>rr(40,186,720,36,0,'#000000',0));
    rr(16,558,768,36,10,'#4a4466',4);
    for(const f of FK)papel(f.id,f.x+Math.sin(now*40)*f.wob*6,f.y,f.rot,1);
    for(const d of DOC)if(!d.found)papel(d.id,d.x,d.y,d.rot,1);
    for(const j of JK){if(j===drag)velo(.3,()=>ell(j.x+6,j.y+10,j.rx,j.ry,'#000000',0));basura(j);}
    /* la linterna ya anda buscando */
    velo(.1+.08*k,()=>ell(400+Math.sin(now*1.7)*250,370+Math.cos(now*1.1)*60,170,140,'#fff6c8',0));
    /* la bandeja de papeles */
    DOC.forEach((d,i)=>{const sx=92+i*112,ok=d.found&&d.fly>=1;rr(sx-50,98,100,54,10,ok?'#5cff7a':'#4a4466',3.5);if(!d.found)txt(d.nm,sx,125,13,'#c9ced6',0,true);});
    for(const d of DOC)if(d.found){const u=ease(d.fly),sx=92+d.slot*112;papel(d.id,lerp(d.fx,sx,u),lerp(d.fy,125,u)-Math.sin(u*PI)*70,d.rot*(1-u),1-.42*u);}
    /* el retrovisor: el guardia viene caminando (es el reloj) */
    rr(596,92,188,64,14,'#8f8fa8',4);ctx.save();path(rrP(603,99,174,50,9));ctx.clip();wash(603,99,174,50,NOCHE[0],NOCHE[1]);
    const s=.2+k*.36;velo(.35,()=>ell(668-k*10,124,26+k*30,22+k*14,'#fff6c8',0));
    bust(Object.assign({},GUARDIA,{x:716-k*26,y:130+54*s+Math.abs(Math.sin(pt*7))*3*(1-k),s,th:60,mood:lose||k>.8?'angry':'calm',look:-1}));ctx.restore();
    txt(lose?'¡LLEGÓ!':k>.7?'¡YA CASI LLEGA!':'YA VIENE...',690,168,12,k>.7?'#ff4d5e':'#c9ced6',0,true);
    if(lose)bubble(400,330,'¿Y LOS PAPELES? ¡ORÍLLESE AL HOMBRILLO!',19,700,150);
    if(ok2)txt('¡COMPLETOS!',400,360,46,'#5cff7a',-.05);}

  /* ── dibujo: fase 3 ── */
  function d3(){const win=g.result==='win',lose=g.result==='lose',hot=nerv>.6,gx=250-(win?26*ease(clamp(fin/.4,0,1)):0),GS=1.32;
    cielo(470);rr(gameLeft(),360,GAME_VIEW.width,120,0,'#23203a',0);line([[gameLeft(),360],[gameRight(),360]],4,'#35324a');for(let i=0;i<3;i++)cono(60+i*96,440-i*8,.9);
    const a=win?2.3+Math.sin(fin*10)*.45:1.5+Math.sin(now*3)*.03;
    bust(Object.assign({},GUARDIA,{x:gx,y:330,s:GS,th:260,mood:win?'smile':lose||hot?'angry':beat>.3?'o':'calm',look:1,talk:lose?Math.abs(Math.sin(now*16)):0,
      arms:[{side:1,a,len:win?92:70,w:24,hand:(hx,hy)=>linterna(hx,hy,PI/2-a,1.5)},{side:-1,a:-.15,len:90,w:24}]}));
    const lx=gx+GS*(GUARDIA.bw*.78+70*Math.sin(a))+56,ly=330+GS*(4+70*Math.cos(a));
    if(!win){velo(.16,()=>poly([[lx-10,ly-24],[800,96],[800,470],[lx-10,ly+24]],'#fff6c8',0));velo(.5,()=>ell(lx,ly,84+Math.sin(now*13)*5,84,'#fff6c8',0));velo(.9,()=>ell(lx,ly,32,32,'#ffffff',0));}
    /* la puerta del carro por dentro, el paral y el espejo donde te ves la cara */
    rr(-10,452,600,160,0,'#2a2540',4.5);rr(0,456,580,10,5,'#3a3456',0);rr(564,90,34,390,6,'#1c1a2a',4);rr(598,90,212,520,0,'#2a2540',0);rr(gameLeft()-10,-10,GAME_VIEW.width+20,108,0,'#1c1a2a',0);line([[gameLeft(),98],[gameRight(),98]],4,INK);
    rr(606,116,180,170,18,'#8f8fa8',4.5);ctx.save();path(rrP(614,124,164,154,12));ctx.clip();wash(614,124,164,154,'#3a3350','#2a2540');
    bust(Object.assign({},TU,{x:696,y:262+(hot&&!g.result?Math.sin(now*44)*2:0),s:.84,th:60,look:-1,mood:win?'happy':lose?'panic':stut>.2?'yell':hot?'panic':nerv>.3?'worry':'smile',talk:stut,sweat:win?0:nerv>.3?2:1}));
    if(!win)velo(.22,()=>ell(650,170,90,80,'#fffbe0',0));ctx.restore();tag(642,304);
    /* el monitor: el latido corre hacia la izquierda y cruza el verde */
    rr(50,470,700,92,16,'#0c1418',4.5);const zw=TOL*VEL;rr(ZX-zw,477,zw*2,78,8,beat>.4?'#baffc8':'#2f8f4a',0);line([[ZX,480],[ZX,552]],2.5,'#5cff7a');
    line([[60,518],[740,518]],3,'#2f6a5a');
    if(!g.result)for(const sp of SPK){const x=ZX+(sp.t-pt)*VEL;if(x<76||x>724||sp.st===1)continue;
      line([[x-18,518],[x-10,508],[x-5,532],[x,474+6],[x+6,542],[x+11,518],[x+20,518]],5,sp.st===2?'#ff4d5e':'#ffffff');}
    txt('♥',92,510,26+beat*12,nerv>.6?'#ff4d5e':'#ff8aa5');txt(Math.round(60/TB*(1+nerv*.5))+'',92,540,13,'#ffffff',0,true);
    rr(598,444,152,16,8,'#14101c',3);if(nerv>.02)rr(600,446,148*clamp(nerv,0,1),12,6,hot?'#ff4d5e':'#ffd23f',0);txt('NERVIOS',674,432,12,'#ffffff',0,true);
    txt(hits+' / '+NB,700,490,14,'#c9ced6',0,true);
    /* lo que se dice */
    const qi=WORDS[Math.min(hits,NB-1)].qi;
    if(!g.result){bubble(300,134,PREG[qi].q,17,gx+20,196);
      const dichas=WORDS.slice(0,hits).filter(w=>w.qi===qi).map(w=>w.w);if(dichas.length){const fr=dichas.slice(-3).join(' ')+(dichas.length<PREG[qi].w.length?'...':'');bubble(Math.min(684,782-(tw(fr,15)+40)/2),356,fr,15,700,292);}}
    if(win){bubble(330,134,'PROSIGA, MI PANA',26,gx+20,196);if(rara&&fin>1.7)bubble(330,206,'...Y CÁMBIESE ESA FOTO',17,gx+60,240);if(fin>.5)txt('¡FIUUU!',696,320,24,'#9fe3ff',-.08);}
    if(lose)bubble(300,134,'¡ORÍLLESE AL HOMBRILLO!',22,gx+20,196);}

  /* ── el final malo: al hombrillo, a vaciar el maletero ── */
  const COSAS=[[540,560,(x,y)=>{ell(x,y-36,36,36,'#14101c',4);ell(x,y-36,16,16,'#8f8fa8',3);}],
    [610,560,(x,y)=>{rr(x-22,y-76,44,76,14,'#8f8fa8',4);rr(x-10,y-90,20,16,4,'#5a5274',3);rr(x-22,y-50,44,8,0,'#c4283a',0);}],
    [676,560,(x,y)=>{rr(x-40,y-48,80,48,6,'#3fb0ff',4);rr(x-44,y-60,88,15,5,'#ffffff',3.5);txt('HIELO',x,y-24,12,'#ffffff',0,true);}],
    [608,484,(x,y)=>{rr(x-104,y-28,208,28,10,'#ffb3d0',4);for(let i=0;i<6;i++)line([[x-84+i*34,y-26],[x-84+i*34,y-2]],3,'#ffffff');}],
    [600,456,(x,y)=>{line([[x-14,y-52],[x-30,y-78]],3,INK);line([[x+10,y-52],[x+28,y-80]],3,INK);rr(x-34,y-54,68,54,8,'#6b4f2a',4);rr(x-26,y-46,40,38,6,'#7fe0d0',3);ell(x+24,y-36,4,4,'#ffd23f',2);}]];
  function dMal(u){
    cielo(430);rr(gameLeft(),420,GAME_VIEW.width,180,0,'#35324a',0);line([[gameLeft(),420],[gameRight(),420]],4,INK);rr(gameLeft(),566,GAME_VIEW.width,34,0,'#3f5a3a',0);for(let i=0;i<4;i++)cono(40+i*50,430-i*3,.5);
    /* el carro, con la maleta abierta */
    ell(140,560,36,36,'#14101c',4);ell(140,560,14,14,'#8f8fa8',3);ell(350,560,36,36,'#14101c',4);ell(350,560,14,14,'#8f8fa8',3);
    rr(124,372,236,90,28,'#c4283a',5);rr(144,386,196,56,14,'#5a4a78',3.5);rr(60,440,380,116,34,'#c4283a',5);
    poly([[344,440],[440,444],[470,330],[372,338]],'#a8283a',4.5);rr(350,446,84,52,10,'#14101c',3.5);ell(434,520,9,14,'#ff3b4e',3);rr(70,520,26,14,5,'#fff3a8',3);
    /* la linterna alumbra el montón */
    velo(.2,()=>poly([[706,300],[470,580],[760,580]],'#fff6c8',0));
    COSAS.forEach(([x,y,f],i)=>{const q=clamp((u-i*.24)/.32,0,1);if(q<=0)return;const e2=ease(q);f(lerp(392,x,e2),lerp(470,y,e2)-Math.sin(q*PI)*110);});
    const qh=clamp((u-1.5)/.3,0,1);if(qh>0)hen(lerp(392,600,ease(qh)),lerp(460,378,ease(qh))-Math.sin(qh*PI)*90-(qh>=1?Math.abs(Math.sin(now*9))*5:0),.7,-1);
    const car=u<1.5;
    bust(Object.assign({},TU,{x:470,y:386,s:.62,th:110,legs:['#2f3a7a','#ffffff',60],mood:qh>=1?'o':'frown',look:1,sweat:2,rot:car?Math.sin(now*12)*.04:0,
      arms:car?[{side:1,a:1.3+Math.sin(now*12)*.4,len:70,w:20},{side:-1,a:1+Math.sin(now*12+2)*.4,len:60,w:20}]:[{side:1,a:1.9,len:60,w:20},{side:-1,a:-1.9,len:60,w:20}]}));tag(470,300);
    bust(Object.assign({},GUARDIA,{x:742,y:330,s:.66,flip:true,th:110,legs:['#2b3442','#14101c',60],mood:qh>=1?'o':'angry',look:1,
      arms:[{side:1,a:1.1,len:60,w:20,hand:(hx,hy)=>linterna(hx,hy,.5,1)},{side:-1,a:-.2,len:74,w:20}]}));
    if(u>1.9)bubble(560,250,'¿Y ESA GALLINA?',22,726,290);else if(u>.2)bubble(560,250,'TODO PA\' FUERA',20,726,290);}

  const g={lr:true,result:null,why:'',endT:0,
    get t(){return gap>0?0:pt;},get dur(){return FASES[ph].dur;},get cmd(){return FASES[ph].cmd;},get hint(){return FASES[ph].hint;},
    get impact(){return this.result?clamp(1-fin/.5,0,1):shake*.6;},
    probe:()=>({ph,pt,gap,st,BT,DOC,FK,JK,tapado,SPK,TOL,hits,need:NB,nerv,nf,fin}),
    press(k){if(g.result||gap>.25)return;
      if(ph===0){const b=BT.find(b=>b.id==={left:'vid',down:'luz',up:'int'}[k]);if(b)tocaB(b);}
      else if(ph===1){if(k==='any')solo();}
      else if(k==='any'||k==='up'||k==='down')toca3();},
    down(p){if(g.result||gap>.25)return;
      if(ph===0){for(const b of BT)if(Math.abs(p.x-b.x)<70&&Math.abs(p.y-b.y)<36){tocaB(b);return;}}
      else if(ph===1)abajo2(p);else toca3();},
    move(p){if(drag&&!g.result){drag.x=clamp(p.x+dOff[0],70,730);drag.y=clamp(p.y+dOff[1],214,530);}},
    up(){drag=null;},
    update(dt){T+=dt;shake=Math.max(0,shake-dt*3);
      for(const k in an)an[k]+=((st[k]?1:0)-an[k])*Math.min(1,dt*7);
      for(const b of BT)b.pop=Math.max(0,b.pop-dt*5);honk=Math.max(0,honk-dt);barre=Math.max(0,barre-dt*1.2);perreo=Math.max(0,perreo-dt*1.5);
      for(const d of DOC)if(d.found)d.fly=Math.min(1,d.fly+dt*3);for(const f of FK)f.wob=Math.max(0,f.wob-dt*3);
      for(const j of JK)if(j.gx!=null){const u=Math.min(1,dt*12);j.x=lerp(j.x,j.gx,u);j.y=lerp(j.y,j.gy,u);if(Math.abs(j.x-j.gx)<2)j.gx=null;}
      beat=Math.max(0,beat-dt*5);stut=Math.max(0,stut-dt*2.5);
      if(g.result){fin+=dt;g.endT=sello(fin);
        if(g.result==='lose'){const u=fin-.9;while(evI<COSAS.length&&u>=evI*.24+.32){evI++;sfx.thud();}if(!clk&&u>=1.8){clk=1;sfx.cluck();}}
        return;}
      if(gap>0){gap-=dt;return;}
      pt+=dt;const F=FASES[ph];
      if(ph===0){road+=dt*(1-clamp(pt/F.dur,0,1))*1.1;
        if(ok1){ok1+=dt;if(ok1>.45)sig();}
        else if(pt>=F.dur)pierde(!st.luz?'¡LO ENCANDILASTE!':!st.vid?'¡VIDRIOS ARRIBA!':'¡A OSCURAS!');}
      else if(ph===1){if((paso-=dt)<=0){paso=.55-.3*pt/F.dur;snd(120,.05,'square',.04);}
        if(ok2){ok2+=dt;if(ok2>.5)sig();}
        else if(pt>=F.dur)pierde('¡SIN PAPELES!');}
      else{for(const s of SPK){if(!s.snd&&pt>=s.t){s.snd=1;snd(74,.11,'sine',.22);setTimeout(()=>snd(60,.1,'sine',.14),110);}
          if(!s.st&&pt-s.t>TOL){s.st=2;tMiss=pt;falla(.7);if(g.result)return;}}
        if(pt>=F.dur)pierde('¡TE TRABASTE!');}},
    draw(){
      ctx.save();if(shake>0)ctx.translate(Math.sin(now*70)*shake*5,Math.cos(now*61)*shake*3);
      if(g.result==='lose'&&fin>.9)dMal(fin-.9);else[d1,d2,d3][ph]();
      ctx.restore();
      if(!g.result){for(let i=0;i<3;i++)ell(574+i*22,76,7,7,i<ph?'#5cff7a':i===ph?'#ffd23f':'#fff3c4',3);
        if(gap>0){velo(gap/GAP*1.6,()=>{rr(gameLeft(),250,GAME_VIEW.width,96,0,'#14101c',0);txt('FASE '+(ph+1)+' DE 3',400,298,44,'#ffd23f');});}}
      drawP();
    }};
  return g;
}

BUS.add('alcabala',{name:'JEFE · ALCABALA',mk:mkAlcabala,card:'LA ALCABALA',num:'J1'});
})();
