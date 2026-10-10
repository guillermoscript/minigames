'use strict';
/* MiniCaos · laboratorio de estilos: ¡TÁPALA! (la chuleta).
   Examen final. Tienes una chuleta dobladita en la pierna, debajo del pupitre, y el profe "raspador" (lentes en la punta
   de la nariz, corbata, libreta de notas) patrulla por detrás de la fila como un tiburón.
   Pantalla partida: ARRIBA el salón (el profe, tus compañeros y tú); ABAJO el primer plano de tu pierna con la chuleta,
   tu mano y la hoja del examen.
   MANTENER = la palma tapa la chuleta (tarda 0,12 s en caer). SOLTAR = copias: el lápiz corre y la barra se llena.
   Se gana llenando la barra, NO aguantando: quien tapa todo el rato entrega EN BLANCO, y quien nunca tapa sale RASPADO.
   El aviso: el profe se frena, le brillan los lentes (y se le asoma la nariz por arriba del cuadro de abajo), y ¡zas!
   Nivel 1: 2 miradas lentas con amago largo. Nivel 2: 3 miradas, amago corto, una es doble (se voltea y regresa).
   Nivel 3: se te para al lado, se te echa encima un rato larguísimo, se hace el loco silbando... y regresa.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.tapala)return;
const{LV,CONF,TU,say,tag}=BUS;
const PR={skin:'#d9a07a',shirt:'#5a4a6a',pat:'suit',sh2:'#c4283a',hair:'bald',hairCol:'#b9b9c6',stache:1,brow:'thick',nose:'long',wrinkles:1,bw:58,hw:42,hh:44};
const FORM=['x=(-b±√…)/2a','E = mc²','sen²+cos²=1'],SIMB=['x','²','√','π','=','±','∑','÷'],ROWS=[-30,14,58];
const TC=.12,GR=.05,SEATS=[92,246,400,554,708],DY=264,WOOD='#c98a4e',PEN='#2c4fa0',ROJO='#e8293f',JEAN='#2f3a7a',CX=206,CY=480;
const ZIG=[[6,-98],[-8,-70],[7,-44],[-7,-16],[8,12],[-6,40],[7,68],[-5,98]];

/* ───────── sostenido ─────────
   El puntero llega por BUS (down/up). El teclado del laboratorio solo avisa del keydown (press), así que el soltar la
   tecla y el blur son de este archivo. Estas dos banderas solo las lee este juego. */
const H={k:0,p:0};
addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){if(gameId==='tapala')e.preventDefault();H.k=0;}});
addEventListener('blur',()=>{H.k=H.p=0;});
addEventListener('pointercancel',()=>{H.p=0;});

/* ───────── utilería ───────── */
function chuleta(x,y,rot,s){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);rr(-29,-21,58,42,3,'#fff8d8',3);
  for(let i=0;i<4;i++)line([[-22,-13+i*9],[-10,-15+i*9],[2,-12+i*9],[12,-15+i*9],[i%2?16:22,-13+i*9]],1.6,INK);ctx.restore();}
const brillo=(x,y,r)=>{poly([[x-r,y],[x,y-r*.24],[x+r,y],[x,y+r*.24]],'#ffffff',2.5);poly([[x,y-r],[x+r*.24,y],[x,y+r],[x-r*.24,y]],'#ffffff',2.5);};
function libreta(x,y){rr(x-13,y-18,26,34,3,'#c4283a',3);rr(x-8,y-12,16,8,2,'#ffffff',0);}
/* mano grande dibujada a tamaño real (la del laboratorio se engorda de línea si se escala): dedos hacia -y */
function mano(x,y,rot,k,sk){ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  limb(40*k,6*k,66*k,-26*k,26*k,sk,4);
  for(let i=0;i<4;i++)rr((-47+i*24)*k,(-98+Math.abs(i-1.4)*9)*k,22*k,76*k,11*k,sk,3.5);
  rr(-49*k,-40*k,98*k,84*k,30*k,sk,4.5);ctx.restore();}
/* los lentes en la punta de la nariz: van por fuera de bust() porque los personajes de cada estilo ignoran over() */
function lentes(x,y,s,rot,gl){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);const ly=HY+14;
  for(const sg of[-1,1])rr(sg*17-13,ly-7,26,15,6,'#dff4ff',3);line([[-4,ly-1],[4,ly-1]],3);
  if(gl>0)brillo(-17,ly,7+gl*19);
  ctx.restore();}
/* la cara del profe asomada por arriba del cuadro de abajo. 0,0 = línea de los ojos; entra de barbilla.
   o.m: stare (te clava los ojos) · away (se hace el loco) · squint (sospecha) · grin (te agarró) */
function cara(x,y,k,o){const sk=PR.skin,gris=PR.hairCol,m=o.m,st=m==='stare'||m==='grin';
  ctx.save();ctx.translate(x,y);ctx.scale(k,k);
  for(const sg of[-1,1])ell(sg*64,6,10,16,sk,3.5);
  rr(-62,-160,124,262,54,sk,5);
  for(const sg of[-1,1]){ell(sg*25,0,17,19,'#ffffff',3.5);ell(sg*25+o.lx*8,o.ly*9,st?5.5:8,st?6:9,INK,0);
    if(!st)rr(sg*25-20,-23,40,m==='squint'?25:15,4,sk,2.5);
    if(m==='away')limb(sg*45,-40,sg*9,-42,9,gris,2.5);else limb(sg*47,-37,sg*7,-23,9,gris,2.5);}
  poly([[-8,-8],[8,-8],[13,32],[0,44],[-13,32]],mix(sk,'#d9604a',.2),3);
  for(const sg of[-1,1])rr(sg*27-21,22,42,23,9,'#dff4ff',3.5);line([[-6,32],[6,32]],3.5);
  if(o.gl>0)brillo(-27,33,10+o.gl*24);
  poly([[-34,52],[-12,46],[0,52],[12,46],[34,52],[26,66],[0,59],[-26,66]],gris,3);
  if(m==='grin'){ell(0,80,29,16,'#5a0f1f',3.5);rr(-23,67,46,11,3,'#ffffff',0);rr(8,67,10,11,2,'#ffd23f',1.5);}
  else if(m==='away')ell(9,79,7,8,'#5a0f1f',3);
  else line(arcPts(0,92,17,Math.PI*1.2,Math.PI*1.8,6),4.5);
  ctx.restore();}
/* la hoja del examen, centrada en 0,0 (310 x 196). p3: 0..3 fórmulas copiadas */
function hoja(p3){rr(-155,-98,310,196,4,'#fffdf2',4);
  txt('EXAMEN FINAL',-74,-78,16,INK,0,true);txt('NOMBRE: TÚ',-98,-56,11,'#5a5274',0,true);
  rr(88,-92,58,32,5,'#ffffff',2.5);txt('NOTA',117,-76,11,'#8f8fa8',0,true);
  ROWS.forEach((ry,i)=>{txt((i+1)+')',-140,ry,15,INK,0,true);rr(-122,ry+13,264,2,0,'#9fc0e8',0);
    const s=escrito(p3,i);if(s)txt(s,-118+tw(s,19)/2,ry,19,PEN,0,true);});}
const escrito=(p3,i)=>FORM[i].slice(0,Math.ceil(FORM[i].length*clamp(p3-i,0,1)-1e-6));
function paloma(x,y,ala){const bob=Math.floor(now*3)%2*3;
  poly([[x-12,y-2],[x-30,y-8],[x-26,y+6]],'#7d8296',3);ell(x,y,16,11,'#9aa0b4',3.5);
  if(ala)poly([[x-8,y-4],[x+6,y-4],[x-2,y-26-Math.sin(now*40)*8]],'#c9cede',3);else ell(x-3,y+1,9,6,'#c9cede',2.5);
  ell(x+13+bob,y-12,8,8,'#9aa0b4',3.5);poly([[x+20+bob,y-13],[x+29+bob,y-10],[x+20+bob,y-8]],'#ff8a3d',2.5);ell(x+15+bob,y-13,2,2,INK,0);}

/* ═════════ GAME: ¡TÁPALA! ═════════ */
function mkTapala(){
  const rs=Math.sqrt(SP),lv=LV(),DUR=5/rs,R=Math.random,LK=[];let t0;
  /* miradas: w = empieza el amago · a = te clava los ojos · b = deja de mirar.
     Las de un mismo grp van pegadas (doble mirada / finta): entre una y otra NO se ha ido. */
  const one=(W,L,o)=>{LK.push(Object.assign({w:t0,a:t0+W,b:t0+W+L,grp:LK.length},o));t0+=W+L;};
  const dbl=(W,L1,Wd,L2,lean)=>{one(W,L1,{lean});t0+=.1;one(Wd,L2,{lean,snap:1,grp:LK.length-1});};
  if(lv===1){t0=.45+R()*.25;one(.55,.7);t0+=.5+R()*.25;one(.55,.7);}
  else if(lv===2){const d=R()<.5;t0=.28+R()*.1;if(d)dbl(.42,.34,.3+R()*.12,.3);else one(.42,.42);t0+=.3+R()*.1;if(d)one(.42,.42);else dbl(.42,.34,.3+R()*.12,.3);}
  else{t0=.25+R()*.13;dbl(.42,.8,.24+R()*.14,.36,1);}
  /* cuánto hay que copiar: lo que copia alguien con 200 ms de reflejos (tapa al ver el amago, destapa al verlo irse)
     si quiere que le sobren 0,65 s. Así la cuenta sale justa con cualquier horario de miradas. */
  const thr=t=>LK.some(l=>t>=l.w&&t<l.b);let N=0;
  for(let u=0,cc=0,d=1/240;u<DUR-.65;u+=d){cc=clamp(cc+(thr(u-.2)?d:-d)/TC,0,1);if(cc<=0)N+=d;}
  const st=t=>{for(let i=0;i<LK.length;i++){const l=LK[i],n=LK[i+1];if(t>=l.w&&t<l.a)return['wind',l];if(t>=l.a&&t<l.b)return['look',l];
    if(n&&n.grp===l.grp&&t>=l.b&&t<n.w)return['gap',l];}return['free',null];};
  const s0=R()<.5?-1:1,V=58*rs,sus=R()<.3,fly=[];
  const CL=[Object.assign({},FACES[9],{shirt:'#bfe0ff',pat:0,sweat:0}),Object.assign({},FACES[10],{shirt:'#e8d9b0'}),null,Object.assign({},FACES[7],{shirt:'#bfe0ff'}),Object.assign({},FACES[4],{shirt:'#e8d9b0'})];
  let px=400+s0*(lv===3?236:250),dir=-s0,lean=0,ls=s0,x0=px,c=0,prog=0,nf=0,slam=false,slamT=9,snapT=9,pk=0,pkk=.9,mode='free',seg=null,kind='',scr=0,nSim=0,note=0,stamp=false,rip=false,nb=3;
  const g={get impact(){return this.result==='lose'?clamp(1-this.endT/.5,0,1):clamp(1-snapT*3,0,1)*.7;},
    probe:()=>({looks:LK,N,prog,c,TC,GR,hold:!!(H.k||H.p),mode,kind,px,lean,sus}),
    t:0,dur:DUR,result:null,why:'',endT:0,cmd:'¡TÁPALA!',
    hint:'MANTÉN (o ESPACIO) = tapas la chuleta si te mira · SUELTA = copias',
    press(k){if(k==='any')H.k=1;},
    down(){H.p=1;},up(){H.p=0;},
    update(dt){g.t+=dt;snapT+=dt;slamT+=dt;const hold=!!(H.k||H.p),ef=Math.min(1,dt*14);
      for(const f of fly)f.u+=dt/.32;while(fly.length&&fly[0].u>=1)fly.shift();
      if(g.result){g.endT+=dt;const e=g.endT;
        if(kind==='pillado'){pk+=(1-pk)*Math.min(1,dt*20);pkk+=(1.15-pkk)*ef;
          if(!rip&&e>=.45){rip=true;nz(.3,.2);snd(240,.3,'sawtooth',.05,-120);}
          if(!stamp&&e>=.95){stamp=true;sfx.thud();spawn(690,470,5,'★',['#ffe14d'],260,500,.5);}}
        else if(kind==='blanco'){pk-=pk*ef;lean=Math.max(0,lean-dt*4);
          if(!rip&&e>=.3){rip=true;sfx.whoosh();}
          if(!stamp&&e>=.75){stamp=true;sfx.boing();}}
        else{c=clamp(c+(e<.9||sus?dt:-dt)/TC,0,1);lean=Math.max(0,lean-dt*4);pk+=((sus&&e>.5?.8:0)-pk)*ef;pkk+=(.9-pkk)*ef;
          if(!stamp&&e>=.2){stamp=true;sfx.ding();spawn(690,400,6,'★',['#ffe14d'],240,500,.6);}
          if(!rip&&!sus&&e>=.95){rip=true;sfx.whoosh();}}
        return;}
      /* la mano */
      c=clamp(c+(hold?dt:-dt)/TC,0,1);
      if(c>=1&&!slam){slam=true;slamT=0;nz(.05,.12);snd(150,.08,'sine',.12,-60);}else if(c<1)slam=false;
      /* el profe: patrulla, se frena, mira; en el nivel 3 se te viene encima durante el amago */
      const[m,l]=st(g.t);
      if(m!==mode){
        if(m==='wind'){snd(98,.12,'sawtooth',.05);setTimeout(()=>snd(104,.14,'sawtooth',.05),110);if(l.lean&&!l.snap){x0=px;ls=px<400?-1:1;}}
        else if(m==='look'){snapT=0;nz(.06,.14);snd(660,.16,'square',.05,-300);}
        mode=m;seg=l;}
      if(m==='free'){lean=Math.max(0,lean-dt*4);px+=dir*V*dt;if(px<110){px=110;dir=1;}else if(px>690){px=690;dir=-1;}}
      else if(l.lean){if(m==='wind'&&!l.snap){const u=ease(clamp((g.t-l.w)/(l.a-l.w),0,1));px=lerp(x0,400+ls*52,u);lean=u;}else lean=1;dir=ls;}
      const wd=m==='wind'&&!l.snap,wu=wd?clamp((g.t-l.w)/(l.a-l.w),0,1):0;
      pk+=((m==='free'?0:wd?.24+.36*wu:l.lean?1:.8)-pk)*Math.min(1,dt*(m==='look'?30:m==='wind'?22:14));
      if(m!=='free')pkk+=((l.lean?1.15:.9)-pkk)*ef;
      /* silbiditos: él cuando se hace el loco, tú cuando te está viendo con la mano encima */
      if((note-=dt)<=0&&(m==='gap'||m==='look'&&c>=1)){note=.28;const gp=m==='gap';PT.push({x:gp?px+30:432,y:gp?lerp(140,178,lean):214,vx:gp?24:30,vy:-50,g:0,t:0,life:.6,kind:'♪',col:'#ffffff',r:-4,rot:0,vr:0});}
      /* te ve con la chuleta al aire: raspado. Si no, y con la mano arriba: a copiar */
      if(m==='look'&&g.t>=l.a+GR&&g.t<l.b-GR&&c<1){g.result='lose';kind='pillado';g.why='¡RASPADO!';sfx.lose();spawn(92,180,7,'feather',['#c9cede','#9aa0b4'],200,300,1);return;}
      if(c<=0){prog+=dt;
        if((scr-=dt)<=0){scr=.075;snd(1100+R()*600,.025,'square',.012);fly.push({u:0,s:SIMB[nSim++%SIMB.length],r:Math.min(2,Math.floor(prog/N*3)),j:R()});}
        const f3=Math.min(3,Math.floor(prog/N*3+1e-6));if(f3>nf){nf=f3;snd(988,.09,'sine',.09);if(f3<3)say('✓',752,440+ROWS[f3-1],'#5cff7a');}
        if(prog>=N){g.result='win';kind=sus?'19':'20';g.why='¡COPIADO!';nb=px>400?1:3;sfx.win();spawn(592,420,24,'conf',CONF);return;}}
      if(g.t>=DUR){g.result='lose';kind='blanco';g.why='¡EN BLANCO!';sfx.lose();snd(1318,.5,'square',.04);snd(1568,.5,'square',.03);}},
    draw(){
      const win=g.result==='win',pill=kind==='pillado',blanco=kind==='blanco',lose=pill||blanco,e=g.endT,m=mode,l=seg,p3=clamp(prog/N,0,1)*3;
      const ha=px===400?-ls:Math.sign(400-px);                                   /* hacia dónde quedas tú, visto desde el profe */
      const look=!g.result&&m==='look',gap=!g.result&&(m==='gap'||m==='wind'&&l.snap),wind=!g.result&&m==='wind'&&!l.snap;
      const wu=wind?clamp((g.t-l.w)/(l.a-l.w),0,1):0,pop=look?Math.max(0,1-snapT*5):0,watch=look||gap;
      ctx.save();if(pill)ctx.translate(Math.sin(now*40)*5*Math.max(0,1-e*2.5),0);
      /* ── ARRIBA: el salón ── */
      wash(0,0,800,336,'#f6efd6','#efe2bc');rr(0,238,800,98,0,'#8fcfb0',0);line([[0,238],[800,238]],4,INK);
      rr(196,92,408,110,6,'#8a5a30',4.5);rr(206,100,388,92,3,'#2f6b4f',0);txt('EXAMEN FINAL',400,124,22,'#ffffff',0,true);txt('PROHIBIDO COPIARSE',400,156,15,'#ffe14d',0,true);rr(318,168,164,3,0,'#ffe14d',0);
      /* la ventana con su paloma chismosa */
      rr(22,96,140,118,10,'#5a4a78',4.5);
      ctx.save();path(rrP(28,102,128,106,6));ctx.clip();wash(22,96,140,118,'#8fd8ff','#e8f8ff');rr(118,150,12,70,0,'#8a5a30',3);ell(124,140,34,26,'#3aa86a',3.5);
      if(pill)paloma(84-e*150,186-e*190,1);else paloma(84,186+(blanco?0:Math.sin(now*2)*1),0);ctx.restore();
      rr(18,208,148,10,4,'#d9dce6',3.5);line([[92,102],[92,208]],4,'#5a4a78');
      /* el reloj del salón */
      {const cx=706+(blanco&&e<.9?Math.sin(now*70)*4:0),an=-Math.PI/2+clamp(g.t/DUR,0,1)*TAU;ell(cx,140,30,30,'#ffffff',4.5);
        for(let i=0;i<4;i++){const a=i*Math.PI/2;line([[cx+Math.cos(a)*21,140+Math.sin(a)*21],[cx+Math.cos(a)*26,140+Math.sin(a)*26]],2.5);}
        line([[cx,140],[cx+Math.cos(an)*21,140+Math.sin(an)*21]],4,ROJO);ell(cx,140,3.5,3.5,INK,0);
        if(blanco&&e<.9)txt('¡RIIING!',cx-14,98,22,'#ffe14d',-.08);}
      /* el profe raspador, por detrás de la fila */
      const S=lerp(.68,.92,lean)*(1+.1*pop),py=lerp(206,238,lean),prot=lean>0?-ls*.3*lean:wind?ha*.1*wu:dir*.05+Math.sin(now*2.2)*.02;
      const ex=px+66*S*Math.sin(prot),ey=py-66*S*Math.cos(prot),fl=dir<0?-1:1;
      if(look||pill&&e<.45){ctx.save();ctx.globalAlpha=.5;poly([[ex-8,ey],[ex+8,ey],[466,300],[334,300]],Math.sin(now*40)>0?'#ff4d5e':'#ff8a3d',0);ctx.restore();}
      let pm='calm',lids=1,plk=dir,pd=1,arms=[{side:1,a:1.9,len:46,w:20,hand:(x,y)=>libreta(x,y-6)}];
      if(pill){pm=e>.35?'grin':'angry';lids=0;plk=ha;if(e>.2)arms=[{side:1,a:2.5,len:74,w:20,hand:(x,y)=>chuleta(x,y-18,.25,.62)}];}
      else if(blanco){pm='angry';plk=ha;if(e>.75)arms=[{side:1,a:2.2,len:60,w:20,hand:(x,y)=>{rr(x-22,y-56,44,56,2,'#fffdf2',3);if(prog>N*.3)line([[x-14,y-40],[x-2,y-43],[x+10,y-39]],2);}}];}
      else if(win){pm=sus?'angry':'frown';plk=ha;}
      else if(look){pm='angry';lids=0;plk=ha;}
      else if(gap){pm='o';plk=-ha;pd=0;}
      else if(wind)plk=ha*wu;
      bust(Object.assign({},PR,{x:px,y:py,s:S,rot:prot,flip:fl<0,mood:pm,lids,look:plk*fl,down:pd,gold:1,arms}));
      lentes(px,py,S,prot,wind?wu:gap&&m==='wind'?clamp((g.t-l.w)/(l.a-l.w),0,1):0);
      if(pop>0)txt('¡!',px-ha*52,py-S*118,30+pop*14,'#ff4d5e',-.1*ha);
      if(wind)txt('…',px-ha*40,py-S*122,30,'#ffe14d');
      if(win&&e>.3)txt('¿?',px-ha*46,py-S*120,30,'#ffe14d',-.1*ha);
      /* la fila: compañeros sudando el examen, y tú en el medio */
      const near=x=>!g.result&&Math.abs(px-x)<96,pup=x=>{rr(x-60,296,120,14,5,WOOD,3.5);rr(x-52,310,104,28,0,dark(WOOD,.18),3);rr(x-24,289,48,10,2,'#fffdf2',2.5);};
      const al=(i,o)=>{bust(Object.assign({},CL[i],{x:SEATS[i],y:DY,s:.5,th:110,bw:50,vein:0,down:1},o));pup(SEATS[i]);};
      /* 0: el que trae las fórmulas escritas en el brazo (lo esconde cuando el profe se acerca) */
      {const x=SEATS[0],hide=near(x)||!!g.result;
        al(0,{mood:pill?'o':win?'happy':hide?'smile':'calm',look:hide?1:-1,down:hide?0:1,sweat:hide&&!win?2:0,arms:hide?null:[{side:-1,a:-2.45,len:66,w:19,col:CL[0].skin}]});
        if(!hide)for(let j=0;j<4;j++){const u=.34+j*.17,ax=x-21-21*u,ay=DY+2-25*u;line([[ax-4,ay-3],[ax+4,ay+2]],2);}}
      al(1,{mood:pill?'o':win?(nb===1&&e>.45?'o':'happy'):near(SEATS[1])?'panic':'worry',look:g.result?1:0,down:g.result?0:1,sweat:g.result?0:near(SEATS[1])?2:1,rot:win&&nb===1&&e>.45?.14:0});
      {const tm=win?'grin':pill?'panic':blanco?'dizzy':watch?(c>=1?'o':'panic'):wind?'worry':c<=0?'smile':'worry';
        bust(Object.assign({},TU,{x:400,y:DY+(watch&&c<1?Math.sin(now*40)*1.5:0),s:.52,th:110,mood:tm,down:!g.result&&!watch&&!wind?1:0,
          look:win?0:pill?-ha:watch?ha:wind?-ha*.7:-.4,sweat:pill||watch?2:wind||blanco?1:0}));pup(400);tag(400,314);}
      al(3,{mood:pill?'o':win?(nb===3&&e>.45?'o':'happy'):near(SEATS[3])?'worry':'calm',look:g.result?-1:0,down:g.result?0:1,sweat:near(SEATS[3])?2:0,rot:win&&nb===3&&e>.45?-.14:0});
      {const zz=!g.result&&!near(SEATS[4]);al(4,{mood:pill?'o':win?'happy':zz?'sleep':'o',look:g.result?-1:0,down:0,sweat:zz||g.result?0:2});
        if(zz)for(let i=0;i<2;i++){const u=(now*.6+i/2)%1;txt('Z',SEATS[4]+26+u*22,226-u*44,11+u*12,'#ffffff');}}
      /* ¡pásala!: la chuleta vuela al de al lado */
      if(win&&!sus&&e>1&&e<1.35){const u=(e-1)/.35;chuleta(lerp(400,SEATS[nb],u),250-Math.sin(u*Math.PI)*46,u*9,.4);}
      /* ── ABAJO: debajo del pupitre ── */
      ctx.save();path(rrP(0,336,800,264,0));ctx.clip();
      wash(0,336,800,264,'#d8cdb4','#c2b598');rr(0,452,400,3,0,'#b3a688',0);rr(150,336,3,264,0,'#b3a688',0);
      limb(330,690,352,486,150,JEAN,4.5);limb(118,690,212,466,178,JEAN,4.5);
      /* la chuleta en la pierna */
      const cu=pill?ease(clamp((e-.1)/.3,0,1)):win&&!sus?clamp((e-.95)/.3,0,1):0,chx=pill?lerp(CX,238,cu):lerp(CX,440,cu),chy=pill?lerp(CY,404,cu):lerp(CY,290,cu);
      if(!g.result){rr(236,522,84,22,8,'#fff3c4',3);txt('CHULETA',278,533,12,INK,0,true);line([[244,522],[232,506]],3);}
      if(!(win&&cu>=1))chuleta(chx,chy,.12+cu*(pill?.3+Math.sin(now*9)*.1:5),1);
      /* tu mano: arriba copiando, o de un palmazo encima del papelito */
      {const k=ease(c),tr=watch||pill?Math.sin(now*50)*1.6:0,hx=lerp(98,CX,k)+tr,hy=lerp(400,CY-2,k),hk=lerp(1.12,1,k);
        if(c<1)ell(hx+26-k*20,hy+34-k*26,62,50,dark(JEAN,.3),0);
        limb(-110,hy+150,-8,hy+92,70,TU.shirt,4.5);limb(-30,hy+104,hx-42,hy+26,56,TU.skin,4.5);mano(hx,hy,lerp(1.05,.8,k),hk,TU.skin);
        if(slamT<.14&&!g.result)for(let i=0;i<6;i++){const a=i/6*TAU+.4;line([[CX+Math.cos(a)*84,CY+Math.sin(a)*70],[CX+Math.cos(a)*108,CY+Math.sin(a)*90]],4,'#ffe14d');}}
      /* la paleta del pupitre con la hoja del examen */
      rr(398,342,440,300,34,WOOD,4.5);rr(410,566,400,3,0,dark(WOOD,.2),0);
      ctx.save();ctx.translate(592,440);ctx.rotate(-.035);
      if(pill&&e>.25){const q=ease(clamp((e-.45)/.3,0,1));
        for(const sg of[-1,1]){ctx.save();ctx.translate(sg*q*26,q*q*14);ctx.rotate(sg*q*.12);
          ctx.save();path([[sg*220,-140],[ZIG[0][0],-140],...ZIG,[ZIG[7][0],140],[sg*220,140]]);ctx.clip();hoja(p3);if(q>0)line(ZIG,5,INK);ctx.restore();
          mano(sg*78,-92,Math.PI-sg*.15,.42,PR.skin);
          if(sg>0&&e>=.95){const z=1+Math.max(0,1-(e-.95)*7)*.7;ctx.save();ctx.translate(84,20);ctx.rotate(-.14);ctx.scale(z,z);line(closeP(ellP(0,2,62,50,18)),6,ROJO);txt('01',0,0,78,ROJO);ctx.restore();}
          ctx.restore();}}
      else if(blanco){const u=ease(clamp((e-.3)/.4,0,1)),rx=Math.min(1,e*.8)*150-90;limb(rx-44,52,rx+44,40,13,'#ffd23f',3);ell(rx+48,39,7.5,7.5,'#ff8aa5',2.5);poly([[rx-62,55],[rx-46,45],[rx-43,58]],'#f0c9a0',2.5);
        if(u<1){ctx.translate(0,-u*460);hoja(p3);if(e>.12)mano(40,-96,Math.PI+.1,.5,PR.skin);}}
      else{hoja(p3);
        if(win&&e>=.2){const z=1+Math.max(0,1-(e-.2)*7)*.7;ctx.save();ctx.translate(96,-40);ctx.rotate(-.16);ctx.scale(z,z);line(closeP(ellP(0,2,48,37,16)),5,ROJO);txt(kind,0,0,54,ROJO);ctx.restore();}
        if(!g.result){const fi=Math.min(2,Math.floor(p3)),wr=c<=0,tx=-116+tw(escrito(p3,fi),19)+(wr?Math.sin(now*60)*4:0),ty=ROWS[fi]+7+(wr?Math.cos(now*47)*3:0);
          limb(tx+84,ty+22,tx+250,ty+180,54,TU.skin,4.5);limb(tx+12,ty-11,tx+86,ty-74,13,'#ffd23f',3);ell(tx+90,ty-78,7.5,7.5,'#ff8aa5',2.5);
          poly([[tx,ty],[tx+5,ty-16],[tx+17,ty-5]],'#f0c9a0',2.5);ell(tx+62,ty-8,30,26,TU.skin,4.5);}}
      ctx.restore();
      /* las fórmulas saltan del papelito a la hoja */
      for(const f of fly){const u=f.u,tx=476+f.j*150,ty=440+ROWS[f.r];txt(f.s,lerp(CX,tx,u),lerp(CY-12,ty,u)-Math.sin(u*Math.PI)*74,20+Math.sin(u*Math.PI)*8,'#ffe14d',(f.j-.5)*1.4);}
      /* la barra de copiado */
      if(!g.result){rr(446,548,292,17,8,'#2d2640',3.5);if(p3>.03)rr(449,551,286*p3/3,11,5,c<=0?'#5cff7a':'#9fd8a8',0);for(const q of[1,2])rr(449+286*q/3-1,551,2,11,0,'#2d2640',0);txt('COPIA',422,557,13,'#ffffff');}
      /* el profe asomado */
      if(pk>.02){const fx=356+(pkk>1.02?0:clamp((px-400)*.06,-12,12)),fy=336+(-100+150*pk)*pkk;
        cara(fx,fy,pkk,pill?{m:e>.35?'grin':'stare',lx:-.8,ly:.9}:win?{m:'squint',lx:-.8,ly:.9}:m==='gap'?{m:'away',lx:.9,ly:-.8}:gap?{m:'squint',lx:.3,ly:-.2,gl:clamp((g.t-l.w)/(l.a-l.w),0,1)}:{m:'stare',lx:-.8,ly:.9,gl:wu});}
      /* te agarró la chuleta con dos dedos */
      if(pill&&cu>0){limb(chx+40,326,chx+24,chy-64,46,PR.shirt,4.5);ell(chx+20,chy-52,22,20,PR.skin,4);limb(chx+12,chy-44,chx-7,chy-17,13,PR.skin,3.5);limb(chx+24,chy-40,chx+9,chy-15,13,PR.skin,3.5);}
      if(look||pill&&e<.4)line(closeP(rrP(7,343,786,250,10)),7,Math.sin(now*30)>0?ROJO:'#ff8a3d');
      else if(wind)line(closeP(rrP(7,343,786,250,10)),2+wu*3,'#ffe14d');
      ctx.restore();
      rr(-8,327,816,9,0,'#fffdf2',3.5);
      ctx.restore();
      /* remates */
      const bx=clamp(px+(px<400?196:-196),170,630),mx=px+(px<400?26:-26);
      if(pill&&e>1.05)bubble(bx,118,'¡CERO UNO, BACHILLER!',19,mx,py-S*24);
      if(blanco&&e>.8)bubble(bx,118,prog<N*.3?'¿NI EL NOMBRE, BACHILLER?':'¿Y EL RESTO, BACHILLER?',17,mx,py-S*24);
      if(win&&e>.45)bubble(nb===3?626:172,178,'¡PÁSALA!',20,SEATS[nb]+(nb===3?24:-24),240);
      drawP();
    }};
  return g;
}

/* ───────── registro ───────── */
BUS.add('tapala',{name:'¡TÁPALA!',mk:mkTapala,card:'LA CHULETA',num:'01'});
})();
