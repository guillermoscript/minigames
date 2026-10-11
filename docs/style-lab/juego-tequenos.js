'use strict';
/* MiniCaos · laboratorio de estilos: ¡AGARRA! (los tequeños).
   Fiesta familiar. La tía sale de la cocina gritando «¡TEQUEÑOOOS!» y cruza la sala apurada con la bandeja plateada, por
   detrás de la fila de primos (tú eres el del medio). En la pared, el cartel que nadie respeta: «UNO POR PERSONA».
   Hay que TOCAR 2 tequeños de la bandeja mientras pasa. Los primos van metiendo la mano uno por uno (se les ve venir: la
   mano sube antes de agarrar) y siempre dejan 2... hasta que se acaba el reloj y el primo burlón barre con lo que quede.
   Tocar un puesto vacío, uno que un primo se acaba de llevar, la servilleta o el aire = manotazo en falso: la mano se queda
   temblando 0,45 s (y si le sigues dando, más), así que machacar no sirve. Agarrar bien no bloquea: con dos dedos salen los dos.
   El reloj ES el recorrido de la bandeja, por eso dura menos que el 5/rs de costumbre: 4,3 s / 3,1 s / 2,4 s.
   Nivel 1: 6 tequeños, bandeja lenta, 4 manotazos de primos. Nivel 2: 5 tequeños, más rápido, 3 manotazos que avisan menos.
   Nivel 3: 4 tequeños, 2 manotazos, todavía más rápido y, colada entre ellos, una servilleta grasosa enrollada (no echa humo).
   Ganas (¡PROVECHO!): mordisco y el queso se estira y se estira hasta que hace ¡PLOP!; la prima te acusa y la tía regaña.
   Pierdes (¡PURO AIRE!, o ¡UNO SOLO! si alcanzaste uno): agarras aire, pestañeas, y el primo de al lado se traga lo
   último con su sonrisita y su diente de oro («¿IBAS A QUERER?»). En la bandeja solo queda la servilleta con la grasa.
   Teclado: ESPACIO (o ↑ ↓) agarra el tequeño que esté pasando justo encima de tu mano (suena un tic y sale ▲): es puro ritmo.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.tequenos)return;
const{LV,CONF,TU,tag}=window.BUS,PI=Math.PI;
const ORO='#e9a13b',TOSTE='#b9701f',QUESO='#fff3a8',PLATA='#c9ced6',SERV='#f6f1e4',GRASA='#e3cf8f';
const TIA={skin:'#c98a5a',shirt:'#8a4fd0',pat:'apron',sh2:'#fffdf2',hair:'afro',hairCol:'#7a2a1e',earring:1,cheeks:1,brow:'thin',bw:58,hw:42,hh:42,legs:['#c98a5a','#7a1e2a',112]};
const pop=(s,x,y,col,r=6,life=.7)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.24,vr:0});
/* el tequeño: (x, y) = la punta de abajo (por donde se agarra); k = cuánto queda, se come desde arriba y asoma el queso */
function teq(x,y,rot=0,s=1,k=1){if(k<.04)return;ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);const L=44*k;
  limb(0,0,0,-L,24,ORO,3.5);for(let yy=-3;yy>-L;yy-=15)line([[-8,yy+3],[8,yy-4]],2.5,TOSTE);
  if(k<1)ell(0,-L-11,8,6,QUESO,2.5);else ell(-5,-L-5,3.5,2.5,'#ffd58a',0);ctx.restore();}
/* la servilleta enrollada: misma silueta de lejos, pero blanca, con la punta mordisqueada y sin humo */
function rollo(x,y,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  limb(0,0,0,-30,22,SERV,3.5);poly([[-11,-32],[-6,-50],[0,-38],[6,-52],[11,-32]],SERV,3);ell(-3,-8,5,4,GRASA,0);ell(4,-22,3,3,GRASA,0);ctx.restore();}
const humo=(x,y,ph)=>{const u=(now*1.1+ph)%1;ctx.save();ctx.globalAlpha=.8*(1-u);line([[x-4,y-u*20],[x+4,y-8-u*20],[x-4,y-16-u*20],[x+3,y-24-u*20]],3,'#ffffff');ctx.restore();};
const hilo=p=>{line(p,9,INK);line(p,5,QUESO);};
/* la gallina de siempre, con gorrito de cumpleaños, picoteando la torta (1 de cada 8 veces ya consiguió su tequeño) */
function gallina(x,y,s,rot,rara){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(-s,s);hen(0,0,1,1);
  poly([[31,-38],[41,-66],[51,-40]],'#ff5ca8',3);ell(41,-67,4.5,4.5,'#ffd23f',2);if(rara)teq(58,-22,1.35,.55);ctx.restore();}

/* ═════════ ¡AGARRA!: 2 tequeños antes de que la bandeja pase de largo ═════════ */
function mkTequenos(){
  const rs=Math.sqrt(SP),lv=LV(),n=lv-1,NS=[6,5,5][n],GAP=[66,80,80][n],V=[150,200,245][n],X0=[-40,-10,20][n],XS=600,dur=(XS-X0)/V;
  const TY=340,IY=TY-28,KY=558,KS=.92,TX=392,TS=1,HX=TX+38,HY0=TY+58,KW=20,HW=[33,35,35][n],RE=.32/rs,nk=lv>=3?+(Math.random()<.5):-1,rara=Math.random()<.125;
  const it=[];for(let i=0;i<NS;i++)it.push({i,o:(i-(NS-1)/2)*GAP,nap:i===nk,on:true,tilt:(i%2?.1:-.1)+(Math.random()-.5)*.08,ph:Math.random()});
  /* los primos: dos antes de ti y dos después; el tercero (lentes oscuros, diente de oro) es el burlón */
  const PR=[[90,3],[245,10],[555,8],[710,4]].map(([x,fi])=>({x,f:fi===8?Object.assign({},FACES[8],{hair:'slick',gold:1}):FACES[fi],q:null,r:0,eat:9,sd:1,gx:0,gy:0}));
  /* el plan: en qué punto del recorrido de la bandeja mete la mano cada quien (los de la izquierda se llevan los de atrás,
     que todavía no te han pasado por delante; los de la derecha, los que ya pasaron). Siempre quedan 2 hasta el final. */
  const PLAN=[[[180,0],[330,1],[420,2],[520,3]],[[180,0],[360,1],[470,2]],[[180,0],[470,2]]][n].map(([at,c])=>({at,p:PR[c],st:0}));
  let cx=X0-240,got=0,lock=0,rT=9,rx=HX,ry=HY0,rq=0,inW=false,stepT=0,paso=0,ent=false,ev=0,bip=0,sw=[],lx=HX,ly=IY;
  const vivos=()=>it.filter(c=>c.on&&!c.nap);
  /* el tequeño de verdad más cercano a x (primero los que se ven) */
  const cerca=x=>{let b=null,bd=1e9;for(const c of vivos()){const ix=cx+c.o,d=Math.abs(ix-x)+(ix<12||ix>788?400:0);if(d<bd){bd=d;b=c;}}return b;};
  /* tu manotazo: con el dedo, donde toques; con el teclado, justo encima de tu mano. rq = qué se trae la mano (0 aire, 1 tequeño, 2 servilleta) */
  function intento(x,y,key){if(g.result)return;if(lock>0){lock=Math.max(lock,.35);snd(150,.04,'square',.03);return;}
    let q=null,bd=key?KW:HW;for(const c of it){const d=Math.abs(cx+c.o-x);if(c.on&&d<=bd&&Math.abs(IY-y)<=66){bd=d;q=c;}}
    rT=0;rx=q?cx+q.o:x;ry=q?IY:clamp(y,120,470);rq=!q?0:q.nap?2:1;
    if(!q){lock=.45;sfx.whoosh();pop('¡AIRE!',rx,ry-34,'#ffffff');return;}
    q.on=false;
    if(q.nap){lock=.55;snd(170,.16,'sine',.12,-70);nz(.06,.08);pop('¡SERVILLETA!',clamp(rx,120,680),ry-44,'#ff9ec7');return;}
    got++;nz(.04,.1);snd(620+got*240,.09,'square',.06,260);pop(got<2?'¡UNO!':'¡DOS!',rx,ry-48,'#ffe14d',10);
    if(got>=2){g.result='win';g.why='¡PROVECHO!';sfx.win();spawn(TX,KY-150,22,'conf',CONF);}}
  /* se acabó el reloj: el burlón se lleva lo que quede (1 o 2) y tú llegas tarde */
  function barre(){sw=vivos().map(c=>{c.on=false;return[cx+c.o,IY];}).sort((a,b)=>Math.abs(a[0]-TX)-Math.abs(b[0]-TX));
    if(sw[0])[lx,ly]=sw[0];for(const p of PR)p.q=null;
    g.result='lose';g.why=got?'¡UNO SOLO!':'¡PURO AIRE!';sfx.whoosh();sfx.lose();snd(480,.07,'square',.05,-180);}

  const g={get impact(){return this.result?clamp(1-this.endT/.5,0,1):0;},
    probe:()=>({got,lock,cx,V,dur,HX,KW,HW,IY,nk,plan:PLAN.map(e=>e.st),items:it.map(c=>({i:c.i,x:cx+c.o,y:IY,on:c.on,nap:c.nap,tg:PR.some(p=>p.q===c)}))}),
    t:0,dur,result:null,why:'',endT:0,cmd:'¡AGARRA!',hint:'TOCA 2 tequeños antes que tus primos (o ESPACIO cuando pasen por tu mano)',
    press(){intento(HX,IY,true);},
    down(p){intento(p.x,p.y,false);},
    update(dt){g.t+=dt;lock=Math.max(0,lock-dt);rT+=dt;for(const p of PR)p.eat+=dt;
      if(!g.result){if(!ent){ent=true;sfx.whoosh();}
        cx=X0+V*g.t-240*Math.pow(1-Math.min(1,g.t/.25),2);
        if((stepT-=dt)<=0){stepT=.2/rs;snd(120+(paso++%2)*30,.03,'square',.018);}
        for(const e of PLAN){const p=e.p;
          if(!e.st&&cx>=e.at-V*RE){e.st=1;p.q=cerca(p.x);p.r=0;snd(330,.05,'triangle',.03,240);}
          if(e.st===1){p.r=Math.min(1,p.r+dt/RE);if(!p.q||!p.q.on)p.q=cerca(p.x);
            if(cx>=e.at){e.st=2;const q=p.q;p.q=null;if(q){q.on=false;p.sd=cx+q.o>=p.x?1:-1;p.gx=cx+q.o;p.gy=IY;p.eat=0;snd(480,.07,'square',.04,-180);nz(.04,.06);}}}}
        /* tic cada vez que un tequeño entra a la ventana de tu mano (la pista para el teclado) */
        const w=vivos().some(c=>Math.abs(cx+c.o-HX)<=KW);if(w&&!inW)snd(1500,.025,'square',.022);inW=w;
        if(g.t>=dur)barre();
        return;}
      g.endT+=dt;const e=g.endT;
      if(g.result==='win'){
        if(ev<1&&e>=.2){ev=1;snd(240,.09,'square',.08,-90);nz(.05,.12);pop('¡ÑAM!',TX+74,KY-64,'#ffffff');}
        if(e>.22&&e<1&&(bip-=dt)<=0){bip=.1;snd(300+e*560,.05,'sine',.05);}
        if(ev<2&&e>=1.02){ev=2;sfx.boing();pop('¡PLOP!',TX+70,KY-150,QUESO,8);}}
      else{
        if(ev<1&&e>=.14){ev=1;nz(.08,.1);spawn(lx,ly,6,'bit',['#ffffff'],160,300,.5);}
        if(ev<2&&e>=.6){ev=2;snd(210,.13,'sine',.14,-120);pop('¡GLUP!',PR[2].x+70,KY-86,'#ffffff');}
        if(ev<3&&e>=.78){ev=3;snd(130,.1,'sine',.1,70);}
        if(ev<4&&e>=1.1){ev=4;snd(520,.07,'square',.05);setTimeout(()=>snd(440,.1,'square',.05),120);}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,mv=!g.result,st=Math.sin(now*11),ty=TY+(mv?st*2.5:0);
      const van=PR.some(p=>p.q),idos=it.filter(c=>!c.on).length;
      ctx.save();path([[gameLeft(),0],[gameRight(),0],[gameRight(),576],[gameLeft(),576]]);ctx.clip();/* la franja de abajo queda libre para la ayuda */
      /* la sala: pared, banderines, el cartel que nadie respeta y los globos */
      wash(gameLeft(),0,GAME_VIEW.width,600,'#cdeeb4','#e6f7d3');
      line([[gameLeft(),98],[gameRight(),98]],3,INK);for(let i=0;i<12;i++)poly([[8+i*67,98],[52+i*67,98],[30+i*67,128]],CONF[i%4],3);
      rr(566,150,206,62,6,'#fffdf2',3.5);txt('TEQUEÑOS:',669,168,14,INK,0,true);txt('UNO POR PERSONA',669,192,17,'#c4283a',0,true);
      [[44,176,0],[82,150,1],[118,184,3]].forEach(([x,y,c])=>{const by=y+Math.sin(now*2+c)*3;line([[x,by+26],[34,404]],2.5,'#5a5274');ell(x,by,21,27,CONF[c],3.5);});
      /* la mesa de la torta: la gallina ya empezó sin esperar a nadie */
      rr(8,404,276,14,5,'#fffdf2',3.5);rr(20,418,252,62,0,'#ff9ec7',3);
      rr(50,356,96,48,8,'#ffe9c4',3.5);rr(50,356,96,16,8,'#ff5ca8',3);for(let i=0;i<3;i++){line([[74+i*24,356],[74+i*24,340]],4,'#3fb0ff');ell(74+i*24,334,4,6,'#ffd23f',2);}
      const pk=Math.max(0,Math.sin(now*7));gallina(204,384,.62,g.result?0:-pk*.42,rara);if(mv&&pk>.8)ell(158,398,3,2.5,'#ffe9c4',0);
      rr(gameLeft(),470,GAME_VIEW.width,130,0,'#c9774f',0);line([[gameLeft(),470],[gameRight(),470]],4,INK);for(let i=0;i<7;i++)line([[i*130+40,470],[i*150-30,600]],2.5,'#a85f3c');
      /* la tía y la bandeja: fondo, servilleta de papel (con la grasa de los que ya no están), tequeños y borde */
      bust(Object.assign({},TIA,{x:cx,y:TY-90-(mv?Math.abs(st)*5:0),rot:mv?st*.025:0,look:win?Math.sign(TX-cx)||1:1,down:lose?1:0,
        mood:win?(e<.9?'o':'angry'):lose?'worry':g.t<1.1?'grin':van?'o':idos>=2?'worry':'happy',talk:mv&&g.t<1.1?Math.abs(Math.sin(now*16)):0,sweat:lose?2:idos>=2?1:0,
        arms:[{side:-1,a:-.42,len:104,w:22},{side:1,a:.42,len:104,w:22}]}));
      rr(cx-236,ty-16,472,38,16,PLATA,4.5);rr(cx-214,ty-11,428,18,8,SERV,3);
      for(const c of it){const x=cx+c.o;if(!c.on){ell(x,ty-1,15,6,GRASA,0);continue;}
        if(c.nap)rollo(x,ty,c.tilt);else{teq(x,ty,c.tilt);humo(x,ty-64,c.ph);}}
      rr(cx-236,ty+3,472,21,10,'#aeb4c0',4);line([[cx-214,ty+10],[cx+214,ty+10]],3,'#ffffff');
      for(const sg of[-1,1])ell(cx+sg*88,ty+13,13,11,TIA.skin,3.5);
      /* los muchachos. Los brazos que trabajan van a mano (iguales en todos los estilos):
         BR = [hombro x, y, mano x, y, camisa, piel, qué lleva (0 nada, 1 tequeño, 2 servilleta), cuánto queda, giro de lo que lleva] */
      const BR=[],BU=[],arm=(o,sd,hx,hy,car,k,tr)=>BR.push([o.x+sd*o.s*40,o.y+o.s*4,hx,hy,o.shirt,o.skin,car,k,tr]),
        up=sd=>({side:sd,a:sd*(2.5+Math.sin(now*9+sd)*.12),len:40,w:17});
      PR.forEach((p,c)=>{const o=Object.assign({},p.f,{x:p.x,y:KY,s:KS,th:70,bw:50,vein:0,sweat:0,mood:'grin',look:clamp((cx-p.x)/160,-1,1)}),my=KY-KS*40;let sd=0;
        if(lose&&c===2){/* el burlón: se los lleva a la boca, se los traga enteros y sonríe */
          const u=ease(clamp(e/.26,0,1)),kk=1-clamp((e-.55)/.2,0,1),d=44*kk+12,w=ease(clamp((e-.78)/.2,0,1));
          sw.forEach((s,j)=>{const sg=j?-1:1;arm(o,sg,lerp(lerp(s[0],p.x+sg*.5*d,u),p.x+sg*56,w),lerp(lerp(s[1],my+.87*d,u),KY-22,w),kk>.04?1:0,kk,-sg*.52*u);});
          o.mood=e>.26&&e<.75?'yell':'grin';o.talk=1;o.look=-1;sd=sw.length>1?2:1;}
        else if(mv&&p.q){const k=ease(p.r);sd=cx+p.q.o>=p.x?1:-1;arm(o,sd,lerp(p.x+sd*30,cx+p.q.o,k),lerp(KY-36,ty-26,k),0);o.mood='yell';o.talk=p.r;}
        else if(p.eat<1.1){/* la mano se va acercando a la boca a medida que se lo come */
          const u=ease(clamp(p.eat/.2,0,1)),kk=1-clamp((p.eat-.25)/.8,0,1),d=44*kk+12;sd=p.sd;
          arm(o,sd,lerp(p.gx,p.x+sd*.5*d,u),lerp(p.gy,my+.87*d,u),1,kk,-sd*.52*u);o.mood=p.eat<.25?'yell':'happy';o.talk=1;}
        if(win){o.look=Math.sign(TX-p.x);if(p.eat>=1.1){o.mood=['o','yell','frown','o'][c];o.talk=c===1?Math.abs(Math.sin(now*14)):0;}}
        else if(lose&&c!==2)o.mood='happy';
        o.arms=sd===2?[]:sd?[up(-sd)]:[up(-1),up(1)];BU.push(o);});
      /* tú: la mano derecha espera debajo de la bandeja; la izquierda guarda el primero */
      const me=Object.assign({},TU,{x:TX,y:KY,s:TS,th:70,look:mv?clamp((cx-TX)/160,-1,1):0,arms:[]}),M=[TX+5,KY-TS*41];
      let hx=HX,hy=HY0+Math.sin(now*6)*3,car=0,tk=1,tr,E=null;
      if(win){/* el segundo va directo a la boca; mordisco y a estirar el queso */
        const u=ease(clamp(e/.2,0,1)),v=ease(clamp((e-.2)/.8,0,1));
        hx=e<.2?lerp(rx,TX+34,u):lerp(TX+34,TX+152,v);hy=e<.2?lerp(ry,KY-7,u):lerp(KY-7,KY-162,v);car=1;tk=e<.2?1:.7;
        const dx=M[0]-hx,dy=M[1]-hy,L=Math.hypot(dx,dy)||1;tr=Math.atan2(dx,-dy)*u;E=[hx+dx/L*(44*tk+14),hy+dy/L*(44*tk+14),L];
        me.mood=e<.2?'yell':e<1.02?'o':'happy';me.talk=1;}
      else if(lose){/* llegas tarde: agarras aire, pestañeas dos veces y volteas a ver al primo */
        const u=ease(clamp(e/.14,0,1)),d=ease(clamp((e-.95)/.3,0,1));
        hx=lerp(lerp(HX,lx,u),HX+8,d)+(e>.14&&e<.95?Math.sin(now*42)*3:0);hy=lerp(lerp(HY0,ly,u),HY0+44,d);
        me.mood=e<.3?'yell':e>1?'frown':(e>.36&&e<.48)||(e>.64&&e<.76)?'sleep':'o';me.look=e>.5?1:0;me.sweat=1;}
      else{if(rT<.26){const k=rT<.07?rT/.07:1-ease((rT-.07)/.19);hx=lerp(HX,rx,k);hy=lerp(HY0,ry,k);car=rT>=.07?rq:0;}
        else if(lock>0){hx+=Math.sin(now*50)*3;hy+=8;}
        me.mood=rT<.3?(rq===1?'grin':'o'):lock>0?'frown':van?'panic':got?'smile':'worry';me.sweat=van?2:1;me.talk=rT<.2?1:0;}
      arm(me,1,hx,hy,car,tk,tr);
      if(got&&!(mv&&got===1&&rq===1&&rT<.26))arm(me,-1,TX-76,KY-(lose?48:70),1,1,-.35);else me.arms=[up(-1)];
      for(const b of BR)limb(b[0],b[1],b[2],b[3],17,b[4],4);
      for(const o of BU)bust(o);bust(me);
      for(const b of BR){const r=Math.atan2(b[2]-b[0],b[1]-b[3]);
        if(b[6]){(b[6]>1?rollo:teq)(b[2],b[3],b[8]==null?r:b[8],1,b[7]==null?1:b[7]);ell(b[2],b[3],13,12,b[5],3.5);}else hand(b[2],b[3],r,1.15,b[5]);}
      /* el queso */
      if(win&&e>=.2&&e<1.02){const p=[],L=E[2];for(let i=0;i<=8;i++){const u=i/8;p.push([lerp(M[0],E[0],u)+Math.sin(now*26+u*7)*L*.012,lerp(M[1],E[1],u)+Math.sin(u*PI)*(6+L*.14)]);}hilo(p);}
      else if(win&&e>=1.02){const s=Math.sin(now*9)*Math.max(.25,1.7-e);hilo([M,[M[0]+s*5,M[1]+14],[M[0]+s*10,M[1]+26]]);ell(E[0],E[1],7,6,QUESO,2.5);}
      if(lose&&e>.8){const x=PR[2].x+14,y=KY-KS*36,s=Math.sin(now*7)*2.5;hilo([[x,y],[x+2+s,y+13],[x+s*1.8,y+24]]);}
      /* pistas: la mano temblando no agarra (×); ▲ = hay uno encima de tu mano */
      if(mv&&lock>0&&rT>=.26)txt('×',hx+28,hy-12,30,'#ff4d5e');else if(mv&&inW&&rT>=.26)txt('▲',HX,HY0-30+Math.sin(now*20)*2,20,'#ffe14d');
      tag(TX-14,424);if(mv){rr(HX+24,HY0-18,66,34,10,'#2d2640',3.5);txt(got+'/2',HX+57,HY0,24,got?'#5cff7a':'#ffe14d',0,true);}
      /* lo que se dice */
      if(mv&&g.t>.15&&g.t<1.1)bubble(clamp(cx+190,160,430),166,'¡TEQUEÑOOOS!',22,cx+52,204);
      if(win&&e>.3)bubble(196,408,'¡TÍAAA, AGARRÓ DOS!',17,PR[1].x+8,452);
      if(win&&e>.9){const sg=cx>320?-1:1;bubble(cx+sg*150,168,'¡ERA UNO!',22,cx+sg*50,202);}
      if(lose&&e>.75)bubble(PR[2].x+66,406,'¿IBAS A QUERER?',19,PR[2].x+20,450);
      ctx.restore();line([[gameLeft(),576],[gameRight(),576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('tequenos',{name:'¡AGARRA!',mk:mkTequenos,card:'EL TEQUEÑO',num:'76'});
})();
