'use strict';
/* MiniCaos · laboratorio de estilos: ¡AMÁRRALA! (ponerle el pabilo a la hallaca, Navidad).
   La mesa vista desde arriba: la hoja de plátano recién doblada con el guiso adentro. Hay que DESLIZAR el dedo en dos
   líneas en cruz, una de arriba abajo y otra de lado a lado, derechitas y pasando por el medio, para apretar el pabilo
   antes de que el guiso se desborde por los lados (el guiso que se asoma es el reloj). El orden da igual.
   Un trazo torcido o fuera del centro es amarrar CHUECO: la hoja se raja y se sale una aceituna rodando por la mesa.
   Un trazo muy cortico no amarra nada (y no castiga).
   Nivel 1: una cruz, perdona un chueco. Nivel 2: una cruz, más derechito y ni un chueco.
   Nivel 3: doble amarre, dos pasadas en cada sentido (cuatro trazos).
   Teclado: ↑ o ↓ amarran a lo largo, ← o → a lo ancho; ESPACIO hace el que falte.
   OJO: el comando es el mismo de la cuerda del bus (juego-amarrala.js); aquí el juego se llama «hallaca».
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.hallaca)return;
const LV=BUS.LV,CONF=BUS.CONF,PI=Math.PI,C=[400,326],HW=135,HH=88,OLLA=[702,312],HOJA='#3f8f4a',VENA='#2f6f3a',HILO='#fff8e0',GUISO='#c4571a';
const pop=(s,x,y,col,r=8,life=.75)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.24,vr:0});
/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;
function aceituna(x,y,r,s=1){ell(x,y,15*s,12*s,'#7a9a2a',3.5);ell(x+Math.cos(r)*7*s,y+Math.sin(r)*5*s,4.5*s,3.5*s,'#e8293f',0);}
const hilo=(p,c=HILO)=>{line(p,9,INK);line(p,5,c);};

/* ═════════ ¡AMÁRRALA!: dos trazos en cruz antes de que se desborde el guiso ═════════ */
function mkHallaca(){
  const rs=Math.sqrt(SP),lv=LV(),TOL=[.42,.32,.25][lv-1],OFF=[56,44,30][lv-1],MINL=[150,165,180][lv-1],MISS=lv===1?1:0,N=lv>=3?2:1,TOTAL=N*2;
  /* los carriles donde va cada pasada: V = de arriba abajo (o = corrimiento en x), H = de lado a lado (o = corrimiento en y) */
  const lanes={V:(N===2?[-46,46]:[0]).map(o=>({o,on:false})),H:(N===2?[-30,30]:[0]).map(o=>({o,on:false}))};
  let s0=null,cur=null,bad=null,miss=0,done=0,kEnd=0,flash=0,did=0,toc=0,fin=0;
  const libre=ax=>lanes[ax].filter(l=>!l.on);
  /* ¿qué es este trazo? null = ni cuenta (un toque, o pasó lejos) · {corto} · {sobra} · {ax, ln, ok} */
  function juzga(a,b){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<70)return null;
    const ax=Math.abs(dy)>=Math.abs(dx)?'V':'H',ang=ax==='V'?Math.atan2(Math.abs(dx),Math.abs(dy)):Math.atan2(Math.abs(dy),Math.abs(dx));
    const dist=Math.abs(dx*(C[1]-a.y)-dy*(C[0]-a.x))/len,u=((C[0]-a.x)*dx+(C[1]-a.y)*dy)/(len*len);
    if(dist>HH+70||u<-.15||u>1.15)return null;
    if(len<MINL)return{corto:true};
    const pos=ax==='V'?a.x+dx*(C[1]-a.y)/dy-C[0]:a.y+dy*(C[0]-a.x)/dx-C[1],fr=libre(ax);
    if(!fr.length)return{sobra:true};
    let ln=fr[0];for(const l of fr)if(Math.abs(pos-l.o)<Math.abs(pos-ln.o))ln=l;
    return{ax,ln,ok:ang<=TOL&&Math.abs(pos-ln.o)<=OFF};}
  function ata(ax,ln){ln.on=true;done++;nz(.05,.16);snd(700,.1,'sawtooth',.05,900);pop('¡ZAS!',C[0]+(ax==='V'?ln.o+70:HW+20),C[1]+(ax==='H'?ln.o-30:-HH-34),'#ffffff',6,.5);
    if(done>=TOTAL){g.result='win';g.why='¡AMARRADITA!';kEnd=clamp(g.t/g.dur,0,1);sfx.win();spawn(C[0],C[1],22,'conf',CONF);}}
  function chueco(a,b){bad={a,b,t:0};miss++;snd(240,.18,'sawtooth',.07,-140);
    if(miss>MISS){g.result='lose';g.kind='chueco';g.why='¡CHUECO!';sfx.crash();sfx.lose();}
    else{flash=1;pop('¡CHUECO!',(a.x+b.x)/2,(a.y+b.y)/2-30,'#ff4d5e',8);}}
  function trazo(a,b){if(g.result)return;const j=juzga(a,b);if(!j)return;
    if(j.corto){pop('¡MÁS LARGO!',C[0],C[1]-HH-44,'#ffe14d',2,.6);return;}
    if(j.sobra){pop('¡ESA YA ESTÁ!',C[0],C[1]-HH-44,'#ffe14d',2,.6);return;}
    if(j.ok)ata(j.ax,j.ln);else chueco(a,b);}
  const g={lr:true,get impact(){return this.result?clamp(1-fin/.5,0,1):0;},
    probe:()=>({C:{x:C[0],y:C[1]},V:lanes.V.map(l=>l.o),H:lanes.H.map(l=>l.o),done,total:TOTAL,miss,maxMiss:MISS,tol:TOL,off:OFF,kind:g.kind}),
    t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,cmd:'¡AMÁRRALA!',
    hint:'DESLIZA ↕ y después ↔ sobre la hallaca, DERECHITO y por el medio (o las flechas)',
    press(k){if(g.result)return;const ax=k==='up'||k==='down'?'V':k==='left'||k==='right'?'H':libre('V').length?'V':'H',fr=libre(ax);if(fr.length)ata(ax,fr[0]);},
    down(p){if(g.result)return;s0=cur=p;},
    move(p){if(s0)cur=p;},
    up(p){if(!s0)return;const a=s0,b=p||cur;s0=cur=null;trazo(a,b);},
    update(dt){g.t+=dt;flash=Math.max(0,flash-dt*3);if(bad)bad.t+=dt;
      if(!g.result){if(g.t>=g.dur){g.result='lose';g.kind='desborda';g.why='¡SE DESBORDÓ!';s0=cur=null;sfx.lose();sfx.thud();}return;}
      fin+=dt;g.endT=sello(fin);s0=cur=null;
      if(g.result==='win'){if(did<1&&fin>.95){did=1;nz(.2,.2);snd(180,.25,'sine',.15,-80);spawn(OLLA[0],OLLA[1],16,'bit',['#bfe9ff','#ffffff'],300,700,.7);pop('¡PLOP!',OLLA[0]-50,OLLA[1]-124,'#ffffff',8);}}
      else{if(did<1){did=1;spawn(C[0],C[1],14,'bit',[GUISO,'#e8862a',HOJA],320,700,.8);}
        if(fin<1.5&&(toc-=dt)<=0){toc=.26;snd(700,.04,'square',.04,-200);}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=fin,k=win?kEnd:lose?1:clamp(g.t/g.dur,0,1),tv=!libre('V').length,th=!libre('H').length;
      /* la hallaca, en sus propias coordenadas (el centro es 0, 0) */
      const hall=(kk,rip)=>{const pu=!g.result&&kk>.7?1+Math.sin(now*26)*.014:1;ctx.scale(pu,pu);
        for(const sg of[-1,1]){ell(sg*(HW-6),Math.sin(now*5+sg)*3,(14+kk*46)*(th?.45:1),(24+kk*48)*(th?.6:1),GUISO,4);
          ell(-sg*34,sg*(HH-4),(30+kk*40)*(tv?.5:1),(8+kk*30)*(tv?.4:1),GUISO,4);
          if(kk>.35&&!th){ell(sg*(HW+kk*22),-8,5,4,'#3b2a22',0);ell(sg*(HW+kk*14),14,7,4,'#e8293f',0);}}
        rr(-HW,-HH,2*HW,2*HH,24,HOJA,5);rr(-HW+16,-HH+12,2*HW-32,2*HH-24,16,'#4fa055',0);
        for(let i=0;i<8;i++)line([[-HW+26+i*30,-HH+10],[-HW+36+i*30,HH-10]],2,VENA);
        line([[-HW+44,-HH+4],[-HW+44,HH-4]],3,VENA);line([[HW-44,-HH+4],[HW-44,HH-4]],3,VENA);
        if(rip){const z=[[-HW,-26],[-70,-4],[-40,-30],[0,2],[36,-22],[80,12],[HW,-8]];poly(z.concat(z.map(([x,y])=>[x,y+30]).reverse()),GUISO,3.5);line(z,5,INK);}
        for(const l of lanes.V)if(l.on)hilo([[l.o,-HH-9],[l.o,HH+9]]);
        for(const l of lanes.H)if(l.on)hilo([[-HW-9,l.o],[HW+9,l.o]]);
        if(win){for(const sg of[-1,1]){ell(sg*13,-9,11,7,HILO,3);line([[0,0],[sg*18,16]],4,HILO);}ell(0,0,5.5,5.5,HILO,3);}};
      ctx.save();path([[gameLeft(),0],[gameRight(),0],[gameRight(),576],[gameLeft(),576]]);ctx.clip();
      /* la mesa */
      wash(gameLeft(),0,GAME_VIEW.width,600,'#d9a066','#c98a4e');
      for(let i=0;i<5;i++)line([[gameLeft(),120+i*100],[gameRight(),120+i*100]],3,'#b3773e');
      for(let i=0;i<9;i++)line([[40+i*90,168+(i%4)*100],[96+i*90,168+(i%4)*100]],2.5,'#b3773e');
      /* hojas, aceitunas, pasas, el rollo de pabilo y la olla del guiso */
      ctx.save();ctx.translate(104,518);ctx.rotate(-.12);rr(-96,-36,196,84,22,'#2f7a3c',4.5);rr(-90,-46,196,84,22,HOJA,4.5);for(let i=0;i<6;i++)line([[-66+i*30,-40],[-58+i*30,32]],2,VENA);ctx.restore();
      ell(130,166,52,46,'#fffdf2',4.5);ell(130,166,41,35,'#e8f4d8',3);for(let i=0;i<6;i++)aceituna(108+(i%3)*22,155+Math.floor(i/3)*22,i*1.3,.7);
      ell(246,134,36,32,'#fffdf2',4.5);ell(246,134,27,23,'#f0e0c0',3);for(let i=0;i<8;i++)ell(232+(i%4)*9+(i>3?4:0),127+Math.floor(i/4)*14,4.5,3.5,'#3b2a22',0);
      ell(92,330,44,44,'#e8d7a8',4.5);for(let i=0;i<3;i++)line(closeP(ellP(92,330,34-i*9,34-i*9,14)),2.5,'#c9b27a');ell(92,330,8,8,'#8a5a30',3);
      if(!win||e<.3)line([[134,322],[178,342],[222,316],[C[0]-HW-4,C[1]]],4,HILO);
      ell(282,530,66,44,'#8f8fa8',4.5);ell(282,526,54,33,GUISO,3.5);ell(262,520,7,5,'#e8293f',0);ell(300,534,6,4,'#3b2a22',0);line([[310,514],[362,480]],8,'#c9ced6');
      /* la olla hirviendo, con las que ya están */
      rr(OLLA[0]-112,OLLA[1]-14,26,28,8,'#5a5274',3.5);rr(OLLA[0]+86,OLLA[1]-14,26,28,8,'#5a5274',3.5);
      ell(OLLA[0],OLLA[1],92,92,'#8f8fa8',5);ell(OLLA[0],OLLA[1],78,78,'#9fd8ff',3.5);
      for(const[mx,my,mr]of[[-30,-34,.3],[28,34,-.5]]){ctx.save();ctx.translate(OLLA[0]+mx,OLLA[1]+my+Math.sin(now*3+mx)*2);ctx.rotate(mr);rr(-38,-25,76,50,8,HOJA,3.5);line([[0,-27],[0,27]],3.5,HILO);line([[-40,0],[40,0]],3.5,HILO);ctx.restore();}
      for(let i=0;i<7;i++){const u=(now*1.3+hash(i,1,3))%1;line(closeP(ellP(OLLA[0]-52+hash(i,2,3)*104,OLLA[1]-48+hash(i,3,3)*96,3+u*9,3+u*9,10)),2.5,'#ffffff');}
      /* se rajó: el charco de guiso */
      if(lose){const q=ease(clamp(e/.25,0,1));for(let i=0;i<7;i++){const a=i/7*TAU+.4,r=(.8+hash(i,4,4)*.5)*q;ell(C[0]+Math.cos(a)*(HW+10)*r,C[1]+Math.sin(a)*(HH+16)*r,(24+hash(i,5,5)*22)*q,(18+hash(i,6,6)*14)*q,GUISO,3.5);}}
      /* la hallaca: en la mesa, volando a la olla, o ya adentro */
      const u=win?clamp((e-.3)/.65,0,1):0,ap=win?ease(clamp(e/.25,0,1)):0;
      ctx.save();ctx.translate(lerp(C[0],OLLA[0],ease(u))+(lose&&e<.4?Math.sin(now*40)*3:0),lerp(C[1],OLLA[1],u)-Math.sin(u*PI)*150+(u>=1?Math.sin(now*3)*2:0));
      ctx.rotate(u<1?u*TAU:Math.sin(now*2)*.08);const hs=lerp(1,.9,ap)*lerp(1,.34,ease(u));ctx.scale(hs,hs);hall(win?k*(1-ap):k,lose);ctx.restore();
      if(u>=1){ctx.save();ctx.globalAlpha=.35;ell(OLLA[0],OLLA[1],78,78,'#9fd8ff',0);ctx.restore();}
      /* por dónde va cada pasada */
      if(!g.result){const ax=libre('V').length?'V':'H';ctx.save();ctx.globalAlpha=.75+.25*Math.sin(now*9);
        for(const l of libre(ax)){
          if(ax==='V'){const x=C[0]+l.o;for(let i=0;i<7;i++)line([[x,C[1]-HH-46+i*40],[x,C[1]-HH-24+i*40]],6,'#ffe14d');poly([[x-16,C[1]+HH+44],[x+16,C[1]+HH+44],[x,C[1]+HH+70]],'#ffe14d',3);}
          else{const y=C[1]+l.o;for(let i=0;i<10;i++)line([[C[0]-HW-56+i*40,y],[C[0]-HW-34+i*40,y]],6,'#ffe14d');poly([[C[0]+HW+50,y-16],[C[0]+HW+50,y+16],[C[0]+HW+78,y]],'#ffe14d',3);}}
        ctx.restore();}
      /* el trazo que vas haciendo, y el chueco */
      if(s0&&cur){const j=juzga(s0,cur);hilo([[s0.x,s0.y],[cur.x,cur.y]],!j||j.corto||j.sobra?HILO:j.ok?'#5cff7a':'#ff6b6b');}
      if(bad&&(bad.t<.45||(lose&&g.kind==='chueco'))){ctx.save();if(!lose)ctx.globalAlpha=clamp(1-bad.t/.45,0,1);hilo([[bad.a.x,bad.a.y],[bad.b.x,bad.b.y]],'#ff6b6b');ctx.restore();}
      /* la aceituna que se va rodando */
      if(lose){const ox=C[0]+120+e*200,oy=C[1]+20+Math.min(1,e/.6)*150-Math.abs(Math.sin(e*10))*16*Math.max(0,1-e/1.6);aceituna(ox,oy,e*11,1.5);}
      if(flash>0){ctx.save();ctx.globalAlpha=flash*.25;rr(gameLeft(),0,GAME_VIEW.width,576,0,'#ff4d5e',0);ctx.restore();}
      if(lose&&e>.75)bubble(530,150,'¡ESA TE LA COMES TÚ!',20,794,104);
      if(win&&e>1.15)bubble(520,150,'¡QUEDÓ DE REVISTA!',20,794,104);
      ctx.restore();line([[gameLeft(),576],[gameRight(),576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('hallaca',{name:'¡HALLACA!',mk:mkHallaca,card:'LA HALLACA',num:'4'});
})();
