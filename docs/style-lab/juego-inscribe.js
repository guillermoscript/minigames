'use strict';
/* MiniCaos · laboratorio de estilos: ¡INSCRIBE! (el cupo).
   Son las 3 a. m. y la página de inscripciones de la Universidad del Caos (el SICE, un portal inventado) lleva horas en
   blanco con la ruedita. De golpe sale el botón azul GUARDAR HORARIO y dura un suspiro antes del Error 504: tócalo YA.
   Nivel 1 = 0,8 s de botón · nivel 2 = 0,6 s y antes sale un señuelo (el anuncio del teléfono o un CERRAR SESIÓN rojo) ·
   nivel 3 = 0,45 s, el señuelo de antes y además un CERRAR SESIÓN gemelo al lado del bueno.
   Tocar antes de tiempo recarga la página (medio segundo sin poder tocar) y a la tercera tumbas el servidor.
   Se carga DESPUÉS de juegos-bus.js y dibuja con las primitivas de index.html, así que sale en todos los estilos. */
(function(){
if(!window.BUS||GAMES.inscribe)return;
const{LV,CONF,TU,tag,phone}=BUS;
/* la pantalla del monitor (X0..X1, Y0..Y1) y, adentro, la página (PT0..PB) */
const X0=40,Y0=110,SW=544,SH=356,X1=X0+SW,XM=X0+SW/2,PT0=210,PB=440,BW=220,BH=88,AW=264,AH=152;
const BEIGE='#d8cba8',BEIGE2='#b9ab86',AZUL='#2f6fe0',ROJO='#e8293f',PAPEL='#fffdf2',GRIS='#d9dce6',MARINO='#1f2f7a',RECIBO='#c9f5c0',VERDE='#1f7a44';
const MATERIAS=['SIESTA II · LUN 2 PM','AREPA APLICADA · 11 AM','DOMINÓ I · VIE 4 PM','CHISME III · JUE 10 AM','COLA AVANZADA · 9 AM','TIGRITOS I · LUN 3 PM'];
const pop=(s,x,y,col,size)=>PT.push({x,y,vx:0,vy:-46,g:0,t:0,life:.9,kind:s,col,r:size-22,rot:(Math.random()-.5)*.12,vr:0});
const mil=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
/* texto liso alineado a la izquierda (txt centra) */
const izq=(s,x,y,size,col)=>txt(s,x+tw(s,size)/2,y,size,col,0,true);

/* el escudo inventado de la Universidad del Caos: un reloj de arena, por la cola eterna */
function escudo(x,y,k){ctx.save();ctx.translate(x,y);ctx.scale(k,k);poly([[-16,-19],[16,-19],[16,5],[0,20],[-16,5]],'#ffd23f',3);
  poly([[-9,-13],[9,-13],[0,-1]],MARINO,0);poly([[-9,11],[9,11],[0,-1]],MARINO,0);ctx.restore();}
/* los dos botones gemelos: el azul bueno (con su disquete) y el rojo que te saca (con su equis) */
function boton(b,k,rem){const real=b.k==='real',c=real?AZUL:ROJO;ctx.save();ctx.translate(b.x,b.y);ctx.scale(k,k);
  rr(-BW/2,-BH/2+7,BW,BH,16,dark(c,.5),4);rr(-BW/2,-BH/2,BW,BH,16,c,4.5);
  if(real){rr(-98,-24,44,44,5,PAPEL,3);rr(-90,-24,28,15,2,'#8f8fa8',0);rr(-88,2,24,18,2,MARINO,0);}
  else{line([[-94,-18],[-60,16]],9,PAPEL);line([[-60,-18],[-94,16]],9,PAPEL);}
  txt(real?'GUARDAR':'CERRAR',26,-17,26,PAPEL);txt(real?'HORARIO':'SESIÓN',26,13,26,PAPEL);
  if(real&&rem>0)rr(-BW/2+16,32,(BW-32)*rem,7,3,'#ffe14d',0);
  ctx.restore();}
/* el anuncio emergente */
function anuncio(a,k){ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.sin(now*9+a.x)*.025);ctx.scale(k,k);
  rr(-AW/2,-AH/2,AW,AH,8,'#ffe14d',4.5);rr(-AW/2,-AH/2,AW,28,8,'#ff5ca8',3.5);txt('¡FELICIDADES, VISITANTE!',0,-AH/2+14,14,PAPEL,0,true);
  phone(-92,22,-.18+Math.sin(now*14)*.08,1.35);
  txt('¡GANASTE UN',36,-24,18,ROJO);txt('TELÉFONO!',36,4,24,ROJO);
  rr(-26,30,120,34,10,'#3ecf6a',3.5);txt('RECLAMAR',34,47,17,PAPEL);
  for(const[x,y,p]of[[-116,-30,0],[112,-34,2],[-44,52,4]])if(Math.sin(now*12+p)>0)txt('★',x,y,18,'#ff5ca8');
  ctx.restore();}
/* la gallina de siempre con cola y cresta de gallo; k = cuánto está cantando */
function gallo(x,y,s,k){ctx.save();ctx.translate(x,y);ctx.scale(-s,s);ctx.rotate(-k*.4);
  limb(-26,-46,-56,-82,12,'#2f8f5a',3);limb(-28,-42,-66,-60,12,'#c4283a',3);limb(-28,-38,-62,-36,12,'#ffd23f',3);
  for(const lx of[-8,10])line([[lx,-18],[lx,0]],4,'#ffb300');
  hen(0,-40,1,1);poly([[30,-80],[34,-100],[42,-88],[48,-104],[54,-86],[58,-78]],'#e8293f',3);
  if(k>.2)poly([[50,-58],[62,-52],[50,-50]],'#ffb300',2.5);
  ctx.restore();}
function taza(x,y,k,rot){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(k,k);
  for(let i=0;i<2;i++){const u=(now*.6+i/2)%1;ctx.save();ctx.globalAlpha=(1-u)*.6;ell(-5+i*10+Math.sin(u*7+i)*4,-24-u*26,3+u*3,4+u*4,PAPEL,0);ctx.restore();}
  line(arcPts(15,0,9,-1.2,1.2,6),5,PAPEL);rr(-15,-16,30,32,5,PAPEL,3.5);ell(0,-13,10,3.5,'#5a3a22',0);rr(-9,-3,18,9,2,ROJO,0);ctx.restore();}

/* ═════════ GAME 504: ¡INSCRIBE! ═════════ */
function mkInscribe(){
  const R=Math.random,rs=Math.sqrt(SP),lv=LV(),WIN=[.8,.6,.45][lv-1],DUR=5/rs,LOCK=.5,DW=.75/rs;
  /* el botón sale entre 1,2 y 3,4 s (desde 1,8 s si antes va un señuelo); el contador de cupos llega a 1 un rato antes */
  const tB=(lv>1?1.8+R()*1.6:1.2+R()*2.2)/rs,tUno=tB*(.5+R()*.35),C0=9+(R()*6|0),visita=4829+(R()*900|0);
  const lugar=()=>({x:lerp(X0+BW/2+16,X1-BW/2-16,R()),y:lerp(PT0+BH/2+10,PB-BH/2-10,R())});
  const celdas=[0,1,2,3].sort(()=>R()-.5).map(i=>({x:(i%2?X1-BW/2-20:X0+BW/2+20)+(R()-.5)*16,y:(i>1?PB-BH/2-12:PT0+BH/2+12)+(R()-.5)*8}));
  const mats=MATERIAS.slice().sort(()=>R()-.5).slice(0,3),its=[];
  if(lv>1){const t0=(.55+R()*(tB*rs-1.7))/rs;
    its.push(R()<.5?{k:'ad',x:lerp(X0+AW/2+8,X1-AW/2-8,R()),y:lerp(PT0+AH/2+4,PB-AH/2-4,R()),w:AW,h:AH,t0,t1:t0+DW}:Object.assign({k:'cerrar',w:BW,h:BH,t0,t1:t0+DW},lugar()));}
  its.push(Object.assign({k:'real',w:BW,h:BH,t0:tB,t1:tB+WIN},lv>2?celdas[0]:lugar()));
  if(lv>2)its.push(Object.assign({k:'cerrar',w:BW,h:BH,t0:tB,t1:tB+WIN},celdas[1]));
  let lockT=-1,strikes=0,kind='',cup=C0,spin=0,crow=.5,crowK=0,clk=0,hit=null,stamp=false,slip=false,canto=false,prt=0;
  const on=i=>g.t>=i.t0&&g.t<i.t1,ins=(i,p,m)=>Math.abs(p.x-i.x)<=i.w/2+m&&Math.abs(p.y-i.y)<=i.h/2+m;
  const fin=(res,k,why)=>{g.result=res;kind=k;g.why=why;};
  /* p = dónde tocaste (null = teclado: vale como tocar el botón bueno si está) */
  function tap(p){if(g.result)return;clk=1;
    if(g.t<lockT){snd(140,.04,'square',.03);return;}
    const act=its.filter(on),h=p?act.find(i=>i.k==='real'&&ins(i,p,8))||act.find(i=>ins(i,p,0)):act.find(i=>i.k==='real');
    if(h&&h.k==='real'){hit=h;fin('win','','¡INSCRITO!');sfx.ding();sfx.win();spawn(h.x,h.y,22,'conf',CONF);}
    else if(h){hit=h;cup=0;fin('lose',h.k,h.k==='ad'?'¡ERA VIRUS!':'¡TE SALISTE!');sfx.lose();if(h.k==='ad')sfx.boing();else sfx.thud();}
    else if(++strikes>=3){cup=0;fin('lose','tumbo','¡LO TUMBASTE!');sfx.crash();sfx.lose();spawn(XM,300,10,'bit',['#8f8fa8',BEIGE],300,800,.9);}
    else{lockT=g.t+LOCK;spin=0;nz(.08,.1);snd(220,.18,'square',.06,-80);}}
  const g={get impact(){return this.result?clamp(1-this.endT/.5,0,1):0;},
    probe:()=>({lv,tB,WIN,LOCK,lock:Math.max(0,lockT-g.t),strikes,cup,kind,its:its.map(i=>({k:i.k,x:i.x,y:i.y,w:i.w,h:i.h,t0:i.t0,t1:i.t1,on:!g.result&&on(i)})),
      btn:(i=>!g.result&&on(i)?{x:i.x,y:i.y,w:i.w,h:i.h,left:i.t1-g.t}:null)(its.find(i=>i.k==='real'))}),
    t:0,dur:DUR,result:null,why:'',endT:0,cmd:'¡INSCRIBE!',hint:'TOCA el botón azul apenas aparezca (o ESPACIO)  ·  ¡antes NO!',
    press(){tap(null);},
    down(p){tap(p);},
    update(dt){g.t+=dt;spin+=dt;clk=Math.max(0,clk-dt*7);crowK=Math.max(0,crowK-dt*1.5);
      if(!g.result){
        if((crow-=dt)<=0){crow=2.3;crowK=1;sfx.cluck();pop('¡KIKIRIKÍ!',706,124,'#ffe14d',19);}
        const c=g.t>=tUno?1:1+Math.ceil((C0-1)*Math.pow(1-g.t/tUno,1.4));if(c<cup){cup=c;snd(c<2?330:520,.05,'square',c<2?.06:.03);}
        for(const i of its)if(!i.seen&&g.t>=i.t0){i.seen=true;if(i.k==='real'){snd(988,.07,'square',.07);snd(1480,.12,'sine',.06);}else if(i.k==='ad')sfx.boing();else snd(660,.07,'square',.05);}
        if(g.t>=tB+WIN||g.t>=g.dur){cup=0;fin('lose','504','¡SIN CUPO!');sfx.lose();nz(.2,.15);snd(120,.5,'sawtooth',.09,-50);}
        return;}
      g.endT+=dt;const e=g.endT;
      if(g.result==='win'){if(e<.75&&(prt-=dt)<=0){prt=.06;nz(.03,.05);snd(1900,.02,'square',.015);}
        if(!stamp&&e>=.95){stamp=true;sfx.thud();crowK=1;sfx.cluck();spawn(474,398,4,'★',['#ffe14d'],320,500,.5);pop('¡KIKIRIKÍ!',706,124,'#ffe14d',19);}}
      else{if(!slip&&e>=.65){slip=true;sfx.boing();}
        if(!canto&&e>=1.05){canto=true;crowK=1;sfx.cluck();}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,act=g.result?[]:its.filter(on),real=act.find(i=>i.k==='real'),lock=!g.result&&g.t<lockT;
      const pin=i=>1+.3*Math.max(0,1-(g.t-i.t0)/.07);
      ctx.save();if(lose&&e<.4)ctx.translate(Math.sin(now*60)*6*(1-e/.4),0);else if(stamp&&e<1.12)ctx.translate(0,Math.sin(now*70)*4);
      /* el cuarto a las 3 a. m.: por la ventana, el gallo que no sabe qué hora es */
      wash(0,0,800,600,'#3b3157','#2a2342');
      rr(626,98,164,146,8,'#5a4a78',4.5);
      ctx.save();path(rrP(634,106,148,130,4));ctx.clip();rr(634,106,148,130,0,'#1d2452',0);
      ell(756,130,13,13,'#fff3c4',0);for(const[x,y]of[[650,122],[688,114],[722,146],[664,156],[770,170]])ell(x,y,2,2,PAPEL,0);
      poly([[630,240],[630,212],[668,196],[716,212],[786,202],[786,240]],'#3b3550',3);
      gallo(702,200-crowK*5,.5,crowK);
      ctx.restore();
      /* el monitor beige */
      rr(250,514,124,30,4,BEIGE2,4);rr(14,88,596,436,28,BEIGE,5);rr(30,100,564,376,16,BEIGE2,3.5);
      ctx.save();path(rrP(X0,Y0,SW,SH,6));ctx.clip();
      if(lose){
        /* ── la pantalla de la derrota ── */
        if(kind==='cerrar'){rr(X0,Y0,SW,SH,0,'#8f8fa8',0);if(e<.3)boton(hit,1-e*2.4,0);
          txt('SESIÓN CERRADA',XM,148,42,PAPEL);txt('Hasta luego, bachiller.',XM,194,20,INK,0,true);txt('Su nuevo puesto en la cola: 9.999',XM,226,20,INK,0,true);}
        else if(kind==='ad'){rr(X0,Y0,SW,SH,0,'#3aa86a',0);
          [[130,286],[330,262],[500,300],[214,348],[420,372],[112,410],[300,424],[512,418],[316,318]].forEach(([x,y],i)=>{if(e>i*.09)anuncio({x,y},.52*Math.min(1,(e-i*.09)*9));});
          txt('¡GANASTE UN VIRUS!',XM,150,40,'#ffe14d');txt('Instalando 47 barras de herramientas...',XM,198,19,PAPEL,0,true);}
        else{rr(X0,Y0,SW,SH,0,'#c4283a',0);const j=Math.sin(now*50)*3*Math.max(0,1-e*2);
          txt('ERROR 504',XM+j,142,56,PAPEL);txt('ERROR DE CONEXIÓN',XM,186,22,PAPEL,0,true);
          txt(kind==='tumbo'?'TUMBASTE EL SERVIDOR':'CUPOS AGOTADOS',XM,222,kind==='tumbo'?28:36,'#ffe14d');txt(':(',XM,296,58,'#8a1f2f',0,true);}
        /* el premio de consolación: lo único que quedaba */
        if(e>.65){const y=lerp(150,0,ease(clamp((e-.65)/.22,0,1)));ctx.save();ctx.translate(0,y);ctx.rotate(-.012);
          rr(64,350,496,108,8,PAPEL,4.5);txt('SOLO QUEDABA ESTA:',XM,368,16,'#5a5274',0,true);txt('CÁLCULO III',XM,397,32,INK,0,true);
          rr(84,419,456,30,6,'#ffe14d',3);txt('SÁBADOS 7:00 AM  ·  Prof. Raspador',XM,435,21,INK,0,true);ctx.restore();}
      }else{
        /* ── el navegador con el SICE ── */
        rr(X0,Y0,SW,24,0,'#2a3f9a',0);izq('SICE · Navegador Caos 98',50,Y0+13,16,PAPEL);for(let i=0;i<3;i++)rr(X1-24-i*22,Y0+5,16,14,3,i?GRIS:ROJO,2);
        rr(X0,134,SW,28,0,GRIS,0);rr(96,138,430,21,4,PAPEL,2);txt('http://sice.ucaos.edu.ve/inscripcion.php',311,149,15,INK,0,true);txt('◀  ▶',66,149,14,INK,0,true);
        rr(X0,162,SW,48,0,win?VERDE:lock?ROJO:MARINO,0);
        if(lock)txt(strikes>1?'¡QUE NO TOQUES!':'¡NO TOQUES!',232,187,28,PAPEL);
        else if(win)txt('INSCRIPCIÓN EXITOSA',232,187,22,PAPEL);
        else{escudo(68,186,1);txt('SICE',132,187,28,'#ffd23f');izq('UNIVERSIDAD DEL CAOS',184,177,16,PAPEL);izq('Sistema de Control de Estudios',184,197,13,'#bfe9ff');}
        const uno=cup<=1&&!win;rr(424,168,152,36,6,uno&&Math.sin(now*18)>0?'#ffe14d':PAPEL,3);txt('CUPOS: '+(win?0:cup),500,187,20,uno?ROJO:INK,0,true);
        rr(X0,PT0,SW,PB-PT0,0,real?'#fff3a8':PAPEL,0);
        if(!real&&!win){const n=Math.floor(spin*10);
          for(let i=0;i<8;i++){const a=i/8*TAU;ell(XM+Math.cos(a)*26,278+Math.sin(a)*26,6.5,6.5,mix(AZUL,GRIS,((n-i)%8+8)%8/7),0);}
          txt(lock?'Recargando...':'Cargando...',XM,336,26,INK,0,true);
          txt(mil(3482+Math.floor(g.t*41*rs)+strikes*500)+' estudiantes en cola',XM,372,21,'#5a5274',0,true);
          txt('POR FAVOR NO RECARGUE LA PÁGINA',XM,412,16,ROJO,0,true);}
        for(const i of act)if(i.k==='ad')anuncio(i,pin(i));else boton(i,pin(i),i.k==='real'?clamp((i.t1-g.t)/WIN,0,1):0);
        if(lock){ctx.save();ctx.globalAlpha=.5;rr(X0,PT0,SW,PB-PT0,0,PAPEL,0);ctx.restore();}
        rr(X0,PB,SW,26,0,GRIS,0);izq('Visitante N.º '+mil(visita+Math.floor(g.t*3)),50,PB+14,15,INK);
        izq(win?'Listo.':lock?'Recargando…':real?'¡Listo! Guarde YA.':'Esperando al servidor…',262,PB+14,15,'#5a5274');txt('3:07 a. m.',532,PB+14,15,INK,0,true);
      }
      ctx.restore();
      line(closeP(rrP(X0,Y0,SW,SH,6)),4,INK);
      izq('CAOSTRON 3000',52,500,15,dark(BEIGE,.55));for(let i=0;i<3;i++)rr(456+i*26,493,16,13,3,BEIGE2,2.5);ell(566,500,6,6,lose?'#ff4d5e':'#5cff7a',2.5);
      /* tú, trasnochado, con tu café y el resplandor del monitor en la cara */
      const mug=(hx,hy)=>taza(hx-6,hy-14,1,Math.sin(now*2)*.06),tr=Math.sin(now*31)*.05,fl=Math.sin(now*26)*.25,hop=win?Math.abs(Math.sin(e*9))*26:0,caido=lose&&e>=.6;
      const mood=win?'happy':lose?(caido?'dizzy':'yell'):real?'panic':act.length||lock?'o':g.t>tUno*.45?'worry':'calm';
      ctx.save();ctx.globalAlpha=.17;ell(628,430,150,170,win?'#5cff7a':lose&&kind!=='cerrar'&&kind!=='ad'?'#ff4d5e':'#bfe9ff',0);ctx.restore();
      bust(Object.assign({},TU,{x:700+(real?Math.sin(now*44)*3:0),y:452-hop+(caido?24:0),s:1.05,look:-1,mood,lids:mood==='calm'?1:0,down:mood==='calm'?1:0,
        talk:lose?Math.abs(Math.sin(now*20)):0,sweat:win||lose?0:real||cup<=1?2:mood==='worry'?1:0,rot:caido?.26:win?Math.sin(e*9)*.05:0,sy:caido?.94:1,
        arms:win?[{side:-1,a:-2.7+fl,len:76,w:21},{side:1,a:2.7-fl,len:76,w:21}]
          :lose?(caido?[{side:-1,a:-.2,len:70,w:21},{side:1,a:.2,len:70,w:21}]:[{side:-1,a:-2.9,len:62,w:21},{side:1,a:2.9,len:62,w:21}])
          :real?[{side:-1,a:-2.6+fl,len:70,w:21,hand:mug},{side:1,a:2.6-fl,len:74,w:21}]
          :[{side:-1,a:-2.45+(mood==='calm'?Math.sin(now*1.5)*.08:tr),len:60,w:21,hand:mug},{side:1,a:.25,len:70,w:21}]}));
      if(!g.result)tag(700,312);
      /* el escritorio con su teclado y su ratón */
      rr(0,534,800,66,0,'#cf9f68',0);line([[0,534],[800,534]],5,INK);
      rr(140,540,320,30,6,BEIGE,3.5);for(let i=0;i<2;i++)rr(150,546+i*10,300,6,2,BEIGE2,0);
      ell(520,556+clk*2,22,14-clk*3,BEIGE,3.5);line([[520,543+clk*4],[520,552+clk*2]],2.5,INK);
      /* ganaste: el monitor imprime el comprobante verde, pantalla abajo */
      if(win){const u=clamp(e/.75,0,1),RX=76,RW=472,yT=94,hh=lerp(26,400,ease(u)),yB=yT+hh,zig=[];
        for(let i=0;i<=24;i++)zig.push([RX+RW-i*RW/24,yB+(i%2?8:0)]);
        ctx.save();ctx.beginPath();ctx.rect(RX-10,yT,RW+20,hh+14);ctx.clip();
        poly([[RX,yT-6],[RX+RW,yT-6]].concat(zig),RECIBO,4);
        txt('UNIVERSIDAD DEL CAOS · SICE',XM,120,16,VERDE,0,true);txt('COMPROBANTE DE INSCRIPCIÓN',XM,150,22,VERDE,0,true);
        rr(RX+30,172,RW-60,56,8,VERDE,3.5);txt('CUPO ASEGURADO',XM,201,35,PAPEL);
        txt('Bachiller: TÚ   ·   Turno 3.482 de 3.482',XM,250,17,VERDE,0,true);
        for(let i=0;i<36;i++)rr(RX+48+i*10.5,268,hash(i,5,1)<.5?3:6.5,46,0,VERDE,0);
        mats.forEach((m,i)=>{ell(RX+32,360+i*31,5.5,5.5,VERDE,0);izq(m,RX+48,361+i*31,20,INK);});
        izq('Conserve este papel: la página no vuelve.',RX+26,458,15,VERDE);
        ctx.restore();
        rr(RX-14,yT-10,RW+28,14,5,INK,3);
        if(stamp){const k=1+Math.max(0,1.1-e)*5;ctx.save();ctx.translate(474,398);ctx.rotate(-.24);ctx.scale(k,k);
          line(closeP(ellP(0,0,60,36,18)),6,ROJO);txt('¡POR FIN!',0,1,21,ROJO,0,true);ctx.restore();}}
      ctx.restore();
      if(lose&&e>1.05)bubble(708,272,'¡A LAS 7!',18,716,214);
      drawP();
    }};
  return g;
}
BUS.add('inscribe',{name:'¡INSCRIBE!',mk:mkInscribe,card:'EL CUPO',num:'504'});
})();
