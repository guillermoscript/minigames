'use strict';
/* MiniCaos · laboratorio de estilos: ¡HASTA LA RAYITA! (el vaso).
   Cumpleaños de la abuela. Te toca servirle el trago al tío en el vaso plástico rojo: ya tiene sus dos dedos de ron y el
   hielo, falta el refresco. MANTENER = echar; SOLTAR = parar. La gracia es la inercia: la espuma sigue subiendo un pelo
   después de soltar, así que hay que soltar ANTES de la rayita (la última estría, marcada en verde hasta el borde).
   Si queda corto se puede volver a echar mientras haya tiempo. Se juzga cuando la espuma lleva medio segundo quieta.
   Nivel 1: chorro lento, poca espuma, franja ancha. Nivel 2: más chorro, más espuma, franja más angosta.
   Nivel 3: además el chorro sale a borbotones y los hielos brincan (¡CLOC!) y suben el nivel de golpe.
   Ganas: ¡SALUD!, el tío choca su vasito con el tuyo. Te pasas: la espuma se bota, te chorrea la mano y el vaso se te
   queda pegado en los dedos (¡PEGOSTE!). Te quedas corto y se acaba el tiempo: ¡PICHIRRE!, el tío se asoma al vaso.
   Si el tiempo se acaba con la espuma todavía moviéndose en la franja: ¡MUY LENTO! (machacar no sirve).
   Teclado: ESPACIO (o ↓) sostenido echa; el keyup es de este archivo porque el laboratorio solo avisa del keydown.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.rayita)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI;
const COLA='#3a1c10',ESP='#f0d9b0',ROJO='#e0283a';
/* mantener presionado: banderas que solo lee este juego */
let kH=false,pH=false;
addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'||e.code==='ArrowDown'||e.code==='KeyS')kH=false;});
addEventListener('blur',()=>{kH=pH=false;});
view.addEventListener('lostpointercapture',()=>{if(gameId==='rayita')pH=false;});

const TIO={skin:'#b87b50',shirt:'#3aa86a',pat:'stripes',sh2:'#fff3a8',cap:'#c4283a',brow:'thick',stubble:1,gold:1,cheeks:1,bw:58,hw:42,hh:42};
/* vasito rojo genérico (el del tío y el de la gallina) */
function vasito(x,y,s,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);poly([[-20,-28],[20,-28],[14,24],[-14,24]],ROJO,3.5);rr(-22,-32,44,8,4,'#ffffff',3);line([[-17,-10],[17,-10]],2.5,'#ffffff');ctx.restore();}
/* la botella: (0,0) es el pico, el cuerpo va hacia -x */
function botella(x,y,a){ctx.save();ctx.translate(x,y);ctx.rotate(a);
  rr(-190,-32,166,64,18,COLA,4);poly([[-30,-28],[-6,-9],[-6,9],[-30,28]],COLA,3.5);rr(-10,-10,14,20,3,'#8f8fa8',3);
  rr(-150,-32,84,64,0,'#ffffff',3);txt('COLA',-108,0,22,'#c4283a',0,true);ctx.restore();}

function mkRayita(){
  const lv=LV(),rs=Math.sqrt(SP),RATE=[.3,.4,.48][lv-1],TAUV=[.14,.17,.2][lv-1],LO=[.8,.84,.87][lv-1],FK=[.3,.42,.55][lv-1],ph=Math.random()*TAU;
  const CX=300,BY=508,TY=268,HH=BY-TY,BW=58,TW=86,yOf=u=>BY-u*HH,wAt=y=>lerp(BW,TW,(BY-y)/HH);
  const brincos=lv>=3?[.4+Math.random()*.06,.58+Math.random()*.08]:[];
  let h=.18,v=0,f=.02,idle=0,acted=false,pk=0,glug=0,corto=false,ev=0,jolt=0,bi=0,drip=0;
  kH=pH=false;
  const cubos=[[-26,.2,.2],[18,-.3,.9],[-2,.5,1.7]];
  function fin(res,kind,why){g.result=res;g.kind=kind;g.why=why;}
  const g={get impact(){return this.result?clamp(1-this.endT/.5,0,1):jolt*.5;},
    probe:()=>({h,v,tau:TAUV,lo:LO,rate:RATE,pour:kH||pH,idle,lv,kind:g.kind}),
    t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,cmd:'¡HASTA LA RAYITA!',
    hint:'MANTÉN (dedo o ESPACIO) y SUELTA antes de la rayita: ¡la espuma sigue subiendo!',
    press(k){if(k==='any'||k==='down')kH=true;},
    down(){pH=true;},up(){pH=false;},
    update(dt){g.t+=dt;jolt=Math.max(0,jolt-dt*4);
      const pour=!g.result&&(kH||pH);pk+=((pour?1:0)-pk)*Math.min(1,dt*14);
      if(!g.result){
        const tg=pour?RATE*(lv>=3?1+.4*Math.sin(g.t*9+ph):1):0;v+=(tg-v)*Math.min(1,dt/TAUV);h+=v*dt;
        f=clamp(f+v*dt*FK-dt*.012,.02,.2);
        if(pour){if(!acted||idle>.1)snd(240,.05,'square',.03,200);acted=true;idle=0;corto=false;
          if((glug-=dt)<=0){glug=.09;snd(180+h*520,.06,'sine',.04,60);nz(.05,.025);}
          while(bi<brincos.length&&h>=brincos[bi]){bi++;h+=.035;jolt=1;snd(900,.06,'triangle',.07);snd(420,.08,'square',.04);say('¡CLOC!',CX+110,yOf(h)-10,'#bfe9ff');}}
        else{if(idle===0&&acted)snd(520,.05,'triangle',.04,-200);idle+=dt;}
        if(h>=1){h=1;fin('lose','bota','¡SE BOTÓ!');kH=pH=false;sfx.lose();nz(.35,.16);snd(140,.4,'sawtooth',.07,-60);spawn(CX,TY,16,'bit',[ESP,'#ffffff'],260,700,.9);}
        else if(acted&&!pour&&idle>=.5&&h>=LO){fin('win','','¡SALUD!');sfx.win();spawn(CX,TY-20,22,'conf',CONF);}
        else if(g.t>=g.dur){if(h>=LO)fin('lose','tarde','¡MUY LENTO!');else fin('lose','corto','¡PICHIRRE!');sfx.lose();sfx.thud();}
        else if(acted&&!pour&&idle>=.5&&!corto){corto=true;snd(300,.08,'square',.04,-80);say('¡FALTA!',CX,yOf(h)-34,'#ffe14d');}}
      else{g.endT+=dt;const e=g.endT;v=0;
        if(g.result==='win'){if(ev<1&&e>=.35){ev=1;sfx.ding();say('¡CLIN!',CX+120,TY+30,'#ffffff');}if(ev<2&&e>=.9){ev=2;sfx.cluck();}}
        else if(g.kind==='bota'){drip=Math.min(1,e/.6);if(ev<1&&e>=.7){ev=1;sfx.boing();say('¡PEGOSTE!',CX-120,430,'#ffe14d');}if(ev<2&&e>=1.2){ev=2;sfx.boing();}}
        else if(ev<1&&e>=.45){ev=1;sfx.boing();}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',bota=lose&&g.kind==='bota',e=g.endT,pour=pk>.5,zona=h>=LO,casi=h>LO-.14;
      const jy=jolt*6,pega=bota&&e>.7,sh=pega?Math.sin(now*40)*7*Math.max(0,1-(e-.7)*.6):0,cx=CX+sh;
      /* la fiesta: pared, banderines, mesa */
      wash(0,0,800,600,'#ffe9b8','#ffd28a');
      line([[0,100],[400,134],[800,100]],3,'#3b3550');
      for(let i=0;i<9;i++){const x=46+i*88,y=104+30*(1-Math.abs(i-4)/4);poly([[x-24,y],[x+24,y],[x,y+44]],CONF[i%4],3);}
      txt('FELIS CUMPLEAÑO, ABUELA',400,172,20,'#c4283a',0,true);
      /* el tío: la cara lo dice todo */
      const tm=win?'happy':bota?(e<.7?'yell':'frown'):lose?'angry':h>.95?'panic':zona?(pour?'o':'grin'):casi&&pour?'o':pour?'smile':corto?'worry':'calm';
      bust(Object.assign({},TIO,{x:626,y:340+(win?-Math.abs(Math.sin(e*9))*10*Math.max(0,1-e):0),s:1.2,th:170,look:-1,down:g.result?0:.6,mood:tm,
        talk:bota&&e<.7||h>.95&&!g.result?Math.abs(Math.sin(now*18)):0,sweat:!g.result&&casi&&pour?2:0,rot:lose&&!bota?-.06:0,
        arms:[{side:-1,a:win?-1.5:-.75,len:win?lerp(60,128,ease(clamp(e/.35,0,1))):60,w:22,hand:(hx,hy)=>vasito(hx-4,hy-16,1,win?-.3:0)},
          bota&&e<.7?{side:1,a:2.6,len:80,w:22}:{side:1,a:.2,len:84,w:22}]}));
      rr(-10,496,820,120,0,'#a86a3c',0);line([[0,496],[800,496]],5,INK);rr(-10,540,820,70,0,'#8a5230',0);
      /* chiste de fondo: la gallina con gorrito picoteando la bolsa de hielo */
      rr(704,424,84,82,10,'#bfe9ff',4);txt('HIELO',746,466,17,'#2f7fe0',0,true);
      {const pk2=Math.max(0,Math.sin(now*5))*8,hx=476+(win&&e>.9?Math.sin(now*20)*3:0);hen(hx,474+pk2*.3,.6,1);poly([[hx+15,474-30],[hx+33,474-30],[hx+25,474-58]],'#ff5c8a',3);ell(hx+25,474-60,4,4,'#ffd23f',2);}
      /* tus brazos salen de la izquierda: uno echa, el otro aguanta el vaso */
      const ba=lerp(-.12,.55,pk),mx=CX+2,my=206,fx=mx-118*Math.cos(ba)-30*Math.sin(ba),fy=my-118*Math.sin(ba)+30*Math.cos(ba);
      if(!bota||e<.25){limb(-30,300,fx,fy,40,TU.shirt,4);ell(fx,fy,26,20,TU.skin,4);}
      limb(-30,590,cx-78,470,44,TU.shirt,4);ell(cx-60,462,30,34,TU.skin,4);
      /* el chorro */
      if(pk>.45&&!g.result){const w=10+Math.sin(now*40)*2+(lv>=3?Math.sin(g.t*9+ph)*4:0);limb(mx,my+8,mx+Math.sin(now*30)*2,yOf(h)+jy,w,COLA,3);}
      if(!bota||e<.25)botella(mx,my,ba);
      /* el vaso: se ve lo de adentro */
      ctx.save();ctx.translate(sh,jy*.3);
      const cup=[[CX-TW,TY],[CX+TW,TY],[CX+BW,BY],[CX-BW,BY]];poly(cup,ROJO,4.5);
      ctx.save();path([[CX-TW+9,TY+4],[CX+TW-9,TY+4],[CX+BW-7,BY-7],[CX-BW+7,BY-7]]);ctx.clip();
      rr(CX-TW,TY,TW*2,HH,0,'#7a1420',0);
      const yt=yOf(h)-jy,yl=yOf(Math.max(.02,h-f))-jy;
      rr(CX-TW,yl,TW*2,BY-yl,0,COLA,0);rr(CX-TW,yOf(.11),TW*2,BY-yOf(.11),0,'#7a3a12',0);
      for(const[ox,r,p]of cubos){const y=Math.min(BY-30,yl+6+Math.sin(now*3+p)*3+(pour?Math.sin(now*17+p)*3:0));ctx.save();ctx.translate(CX+ox,y+10);ctx.rotate(r+Math.sin(now*2+p)*.1);rr(-14,-14,28,28,5,'#cfeeff',3);ctx.restore();}
      rr(CX-TW,yt,TW*2,yl-yt,0,ESP,0);
      for(let i=0;i<7;i++)ell(CX-70+i*23+Math.sin(now*6+i)*2,yt+Math.sin(now*9+i*2)*(pour?3:1),14,8,i%2?'#ffffff':ESP,0);
      ctx.restore();
      /* estrías: la de arriba es LA RAYITA */
      for(const u of[.3,.52])line([[CX-wAt(yOf(u))+6,yOf(u)],[CX+wAt(yOf(u))-6,yOf(u)]],2.5,'#a81c2c');
      const yr=yOf(LO),on=zona&&!g.result;line([[CX-wAt(yr)-4,yr],[CX+wAt(yr)+4,yr]],6,on&&Math.sin(now*20)>0?'#5cff7a':'#ffffff');
      rr(CX-TW-7,TY-9,TW*2+14,16,8,'#ffffff',4);
      if(!g.result||win){const gx=CX+TW+16;line([[gx,TY+2],[gx,yr]],9,'#5cff7a');poly([[gx+10,yr-4],[gx+34,yr-18],[gx+34,yr+10]],'#ffd23f',3.5);rr(gx+32,yr-18,96,28,8,'#ffd23f',3.5);txt('RAYITA',gx+80,yr-4,16,INK,0,true);}
      /* se botó: la espuma chorrea por los lados hasta la mano */
      if(bota){for(let i=0;i<5;i++)ell(CX-70+i*35,TY-8-Math.sin(i*2.1)*6,24,16,i%2?'#ffffff':ESP,3);
        for(const[sg,k]of[[-1,1],[1,.7],[-1,.45]]){const x0=CX+sg*(TW-6-k*8),y1=TY+drip*k*210;limb(x0,TY+4,x0-sg*drip*k*26*(1-k*.2),y1,14,ESP,3);ell(x0-sg*drip*k*26*(1-k*.2),y1+4,10,12,ESP,3);}}
      ctx.restore();
      /* tus dedos sobre el vaso; si te pasaste, abres la mano y el vaso no se cae */
      {const off=pega?26+Math.sin(now*40)*4:0;for(let i=0;i<4;i++){const y=420+i*21,xr=cx-wAt(y)+38;
        if(pega){line([[xr-off-4,y+8],[xr-6,y+6+Math.sin(now*30+i)*3]],5,ESP);}
        rr(xr-50-off,y,50,18,9,TU.skin,3.5);}
        if(bota&&drip>.8)for(let i=0;i<3;i++)ell(cx-70-off+i*14,500+((now*60+i*30)%60),5,8,ESP,2.5);}
      if(!g.result&&g.t<1.2&&!acted)tag(cx-130,440);
      if(!g.result&&h>.95&&Math.sin(now*24)>-.3)txt('¡YA, YA!',CX+Math.sin(now*60)*3,TY-60,34,'#ff4d5e',-.05);
      /* lo que dice el tío */
      if(!g.result&&g.t<1.1/rs)bubble(600,150,'¡HASTA LA RAYITA, SOBRINO!',19,620,236);
      if(win&&e>.2)bubble(596,150,'¡ESE ES MI SOBRINO!',22,620,236);
      if(bota&&e>.3)bubble(600,150,e<1.2?'¡ESO ES PURA ESPUMA!':'¡NI SE TE CAE EL VASO!',20,620,236);
      if(lose&&!bota&&e>.2)bubble(600,150,g.kind==='tarde'?'¡SE ME DERRITIÓ EL HIELO!':h<.3?'¿Y EL REFRESCO, MIJO?':'¿ESO ES UN JARABE O QUÉ?',20,620,236);
      drawP();
    }};
  return g;
}

BUS.add('rayita',{name:'¡HASTA LA RAYITA!',mk:mkRayita,card:'EL VASO',num:'79'});
})();
