'use strict';
/* MiniCaos · laboratorio de estilos: ¡MÁRCALO! (el yesquero).
   Fiesta en casa: veinte vasos rojos idénticos en la mesa y un primo que se toma el que agarre. La solución de toda la
   vida: quemarle el bordecito al vaso con el yesquero para que se doble y saber cuál es el tuyo.
   MANTENER (dedo/ratón apretado, o ESPACIO apretado) = acercar la llama al borde. SOLTAR cuando el plástico ya se dobló.
   No hay barra que mirar (casi): se LEE el vaso. El borde se ablanda y tiembla, de golpe se dobla hacia adentro (¡tic!, ahí
   es), y si sigues empieza a echar humo y el chirrido sube... hasta que agarra candela.
   Soltar antes de que se doble: ni se nota (queda UN intento más). Dos veces o se acaba el tiempo: el primo se lo lleva.
   Nivel 1: como 1 s de llama, ventana ancha y un medidorcito de calor. Nivel 2: más rápido y el medidor se desvanece al
   empezar. Nivel 3: sin medidor y el ventilador prendido: la llama se ladea y el calor sube a tirones.
   Ganas: muesca inconfundible, el vaso vuelve a la mesa y el primo, que iba directo, agarra el de al lado.
   Pierdes (tarde): ¡FUSH!, el vaso se derrite entero en la mano. Pierdes (temprano/tiempo): el primo se lo lleva.
   Teclado: ESPACIO o ENTER mantenido; el keyup es de este archivo (el laboratorio solo avisa del keydown).
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.marcalo)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI,ROJO='#e8293f';
/* mantener con el teclado: el keyup y el blur son de este archivo y solo actúan si el juego en pantalla es este */
let kH=false;
const suelta=()=>{kH=false;if(gameId==='marcalo'&&G&&G.soltar)G.soltar();};
addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter')suelta();});
addEventListener('blur',suelta);
const PRIMO=Object.assign({},FACES[8],{vein:0});
/* vaso plástico: c = cuánto se dobló la esquina derecha del borde (0 nada, 1 la muesca perfecta, más = se está cayendo) */
function vaso(cx,yt,w,h,c,col=ROJO){const l=cx-w/2,r=cx+w/2,b=w*.34,nx=r-w*.02-w*.17*c,ny=yt+h*.15*c;
  poly([[l,yt],[r-w*.34,yt],[nx,ny],[r-w*.054,yt+h*.34],[cx+b,yt+h],[cx-b,yt+h]],col,w>80?4.5:3);
  line([[l+w*.07,yt+h*.42],[r-w*.2,yt+h*.42]],Math.max(2,w*.02),dark(col,.3));
  line([[l,yt],[r-w*.34,yt],[nx,ny]],Math.max(3,w*.05),'#ffffff');
  if(c>.05){ctx.save();ctx.globalAlpha=Math.min(1,c)*.7;ell(nx,ny,w*.06,w*.045,'#4a2418',0);ctx.restore();}
  return[nx,ny];}
function yesquero(lx,ly,fl,wind){limb(770,540,lx+8,ly+42,28,TU.shirt,4);
  rr(lx-11,ly-18,22,46,5,'#3fd0a0',3.5);rr(lx-11,ly-29,22,13,3,'#c4cad6',3);rr(lx-17,ly+6,36,30,11,TU.skin,4);ell(lx+11,ly-13,8,6,TU.skin,3);
  if(fl>.05){const bx=lx-4,by=ly-29,f=fl*(1+Math.sin(now*31)*.12),tx=bx-25*f+wind*30,ty=by-27*f+wind*8;
    poly([[bx-8,by],[tx,ty],[bx+8,by],[bx,by+5]],'#ff8a3d',3);poly([[bx-4,by],[lerp(bx,tx,.6),lerp(by,ty,.6)],[bx+4,by],[bx,by+3]],'#ffe14d',0);}}

function mkMarcalo(){
  kH=false;
  const rs=Math.sqrt(SP),lv=LV(),LO=[.85,.9,.9][lv-1],B=[1.4,1.35,1.3][lv-1],ph=Math.random()*TAU;
  const CX=430,YT=250,CW=150,CH=180,SX=384,SY=496,NX=456;                 /* vaso grande, su hueco en la mesa y el vaso vecino */
  let h=0,held=false,lit=0,tries=0,bf=1,pop=0,sad=0,szT=0,smT=0,mark=0,ev=0,px0=870,jump=0;
  const curl=()=>h>=LO?1+(h-LO)/(B-LO)*.45:Math.max(mark,h<.4?0:ease((h-.4)/(LO-.4))*.6);
  const primoX=()=>lerp(870,752,clamp(g.t/g.dur,0,1));
  function agarra(){if(g.result||held)return;held=true;snd(1900,.03,'square',.05);nz(.04,.08);}
  function fin(res,kind,why){held=false;px0=primoX();g.result=res;g.kind=kind;g.why=why;}
  function seLoLlevan(why){fin('lose','primo',why);sfx.whoosh();sfx.lose();}
  const g={get impact(){return this.result==='lose'&&this.kind==='fush'?clamp(1-this.endT/.5,0,1):0;},
    probe:()=>({h,lo:LO,hi:B,held,lit,tries,bf,kind:g.kind}),
    t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,cmd:'¡MÁRCALO!',hint:'MANTÉN (dedo o ESPACIO) la llama en el borde y SUELTA cuando el plástico se doble',
    press(k){if(k==='any'&&!kH){kH=true;agarra();}},
    down(){agarra();},
    up(){g.soltar();},
    soltar(){if(g.result||!held)return;held=false;
      if(h>=LO){fin('win','','¡MARCADO!');sfx.win();spawn(CX+60,YT,20,'conf',CONF);return;}
      tries++;mark=Math.max(mark,.1);h=0;sad=.7;snd(240,.14,'sawtooth',.05,-90);
      if(tries>=2)seLoLlevan('¡NI SE NOTA!');else say('¡NI SE NOTA!',CX+40,YT-40,'#ffffff');},
    update(dt){g.t+=dt;pop=Math.max(0,pop-dt*5);sad=Math.max(0,sad-dt);jump=Math.max(0,jump-dt*2);
      if(!g.result){bf=lv>=3?.35+.65*(.5+.5*Math.sin(g.t*4.6+ph)):1;
        lit=clamp(lit+(held?dt*9:-dt*9),0,1);
        if(held&&lit>=1){const h0=h;h+=dt*rs*bf;
          if((szT-=dt)<=0){szT=.08;snd(260+h*620,.05,'sawtooth',.018+h*.012);}
          if(h0<LO&&h>=LO){pop=1;snd(1500,.07,'triangle',.07);nz(.05,.06);}
          if(h>(LO+B)/2&&(smT-=dt)<=0){smT=.07;spawn(CX+50,YT+10,1,'bit',['#b8b8c4','#8f8fa8'],50,-260,.6);}
          if(h>=B){fin('lose','fush','¡FUSH!');jump=1;nz(.5,.25);snd(180,.5,'sawtooth',.09,500);sfx.lose();spawn(CX+20,YT+20,22,'bit',['#ff8a3d','#ffe14d','#ff4d5e'],360,500,.8);spawn(650,200,6,'feather',['#f1ece2'],200,300,.9);}}
        if(!g.result&&g.t>=g.dur)seLoLlevan('¡SE LO LLEVARON!');}
      else{g.endT+=dt;const e=g.endT;lit=Math.max(0,lit-dt*9);
        if(g.result==='win'){if(ev<1&&e>=.3){ev=1;sfx.thud();}if(ev<2&&e>=.95){ev=2;sfx.ding();}}
        else if(g.kind==='fush'){if(ev<1&&e>=.5){ev=1;sfx.cluck();}if(ev<2&&e>=.9){ev=2;snd(300,.3,'sine',.1,-120);}}
        else{if(ev<1&&e>=.3){ev=1;snd(520,.1,'square',.05,300);}if(ev<2&&e>=1.15){ev=2;sfx.boing();}}}},
    draw(){
      const win=g.result==='win',lose=!!g.result&&!win,fush=lose&&g.kind==='fush',primo=lose&&!fush,e=g.endT,c=curl(),wind=lv>=3?1-bf:0;
      /* la sala: banderines, el cartel con error, la repisa con el radio y la gallina de siempre */
      wash(gameLeft(),0,GAME_VIEW.width,600,'#ffe2b8','#ffcf9c');
      line([[0,98],[400,116],[800,98]],3,INK);
      for(let i=0;i<10;i++){const x=14+i*80,y=99+(1-Math.abs(i-4.5)/5)*15;poly([[x,y],[x+52,y],[x+26,y+36]],CONF[i%4],3);}
      rr(262,146,276,36,6,'#ffffff',3.5);txt('FELIZ CUNPLEAÑO',400,165,20,'#c4283a',-.01,true);
      rr(600,240,186,10,3,'#8a5a3a',3.5);rr(704,198,66,42,7,'#3b3550',3.5);ell(722,219,11,11,'#c4cad6',2.5);rr(740,208,22,6,2,'#ffd23f',0);line([[760,198],[776,168]],3,INK);
      for(let i=0;i<2;i++){const u=(now*.7+i*.5)%1;ctx.save();ctx.globalAlpha=1-u;txt('♪',748+Math.sin(u*9+i)*12,190-u*46,20,'#ff5c8a');ctx.restore();}
      hen(646,214-Math.abs(Math.sin(now*8))*5-jump*40,.6,-1);
      /* el ventilador: en el nivel 3 está prendido y ladea la llama */
      line([[66,200],[66,330]],8,'#8f8fa8');ell(66,188,46,46,'#d9dce6',4);
      for(let i=0;i<3;i++){const a=(lv>=3?now*22:.4)+i*TAU/3;limb(66,188,66+Math.cos(a)*34,188+Math.sin(a)*34,15,'#3fb0ff',3);}ell(66,188,8,8,'#3b3550',2.5);
      if(lv>=3&&!g.result)for(let i=0;i<3;i++){const u=(now*1.3+i/3)%1,x=130+u*420,y=214+i*26;ctx.save();ctx.globalAlpha=(1-u)*(.3+wind*.6);line([[x,y],[x+46,y-3]],3,'#ffffff');ctx.restore();}
      /* el primo: se va acercando con el reloj */
      let px=primoX(),pm='grin',parm=[{side:1,a:.2,len:70,w:20},{side:-1,a:-.2,len:70,w:20}],vx=CX,vy=YT,vw=CW,vh=CH,drawBig=true;
      if(win){px=lerp(px0,668,ease(clamp(e/.5,0,1)));pm=e>.95?'o':'grin';}
      if(fush){px=px0+e*90;pm='o';}
      if(primo){const u=ease(clamp(e/.3,0,1)),out=Math.max(0,e-.95);px=lerp(px0,612,u)+out*out*900;pm=e>.3?'happy':'grin';
        parm=[{side:1,a:1.9,len:74,w:20},{side:-1,a:-.2,len:70,w:20}];
        const k=ease(clamp((e-.1)/.25,0,1));vx=lerp(CX,px-78,k);vy=lerp(YT,262,k);vw=lerp(CW,74,k);vh=lerp(CH,90,k);}
      bust(Object.assign({},PRIMO,{x:px,y:350,s:.74,flip:true,th:170,mood:pm,look:1,rot:primo&&e>.95?-.08:0,arms:parm}));
      /* tú */
      const hot=held&&h>LO+(B-LO)*.55,ok=held&&h>=LO;
      bust(Object.assign({},TU,{x:190,y:322+(hot?Math.sin(now*44)*2:0),s:1,th:190,look:1,down:held&&!ok?1:0,
        mood:win?'happy':fush?(e<.45?'yell':'frown'):primo?(e<1.1?'o':'frown'):sad>0?'frown':hot?'panic':ok?'grin':held?'worry':'smile',
        talk:fush&&e<.45?1:0,sweat:hot?2:held||fush?1:0,lids:fush&&e>.45?1:0,
        arms:win?[{side:1,a:2.6,len:84,w:22},{side:-1,a:-2.6,len:84,w:22}]:primo&&e>.2?[{side:1,a:1.5,len:120,w:22},{side:-1,a:-.2,len:80,w:22}]:[{side:1,a:1.3,len:172,w:22},{side:-1,a:-.2,len:80,w:22}]}));
      if(!win)tag(190,148);
      /* la mesa con los otros diecinueve */
      const nb=win?-clamp((e-1.15)*220,0,90):0;
      for(let i=0;i<10;i++)vaso(60+i*72,462,44,54,0);
      rr(gameLeft()-10,510,GAME_VIEW.width+20,100,0,'#8a5a3a',0);line([[-10,510],[810,510]],4,INK);rr(gameLeft()-10,530,GAME_VIEW.width+20,80,0,'#fff3c4',0);for(let i=0;i<11;i++)rr(i*80-6,530,40,80,0,'#ff9ec7',0);
      for(let i=0;i<10;i++)if(i!==4)vaso(96+i*72,SY-(i===5?-nb*0:0)+(i===5?nb:0),44,56,0);
      /* tu vaso */
      if(win){const k=ease(clamp(e/.3,0,1));vx=lerp(CX,SX,k);vy=lerp(YT,SY,k);vw=lerp(CW,44,k);vh=lerp(CH,56,k);}
      if(fush){const m=ease(clamp((e-.12)/.7,0,1));ctx.save();ctx.translate(CX,YT+CH);ctx.scale(1+m*.7,1-m*.87);ctx.translate(-CX,-YT-CH);vaso(CX,YT,CW,CH,1.45,mix(ROJO,'#7a1e2a',m*.5));ctx.restore();
        for(let i=0;i<3;i++){const u=clamp((e-.35-i*.18)/.5,0,1);if(u>0&&u<1)ell(CX-40+i*38,YT+CH+u*u*80,7,10+u*6,ROJO,3);}
        if(e<.55){const f=1-e/.55;for(let i=0;i<3;i++){const x=CX-44+i*44,hh=(120+i%2*50)*f*(1+Math.sin(now*40+i)*.15);poly([[x-30,YT+30],[x+Math.sin(now*25+i)*14,YT+30-hh],[x+30,YT+30]],'#ff8a3d',3.5);poly([[x-14,YT+30],[x,YT+30-hh*.55],[x+14,YT+30]],'#ffe14d',0);}}
        drawBig=false;}
      if(drawBig){const j=held&&h>.2&&h<LO?Math.sin(now*46)*h*1.6:0,n=vaso(vx,vy+j*.3,vw,vh,c+pop*.25);
        if(held&&lit>=1&&h>.15){ctx.save();ctx.globalAlpha=clamp(h/B,0,1)*.45;ell(n[0],n[1],24,18,'#ff8a3d',0);ctx.restore();}
        if(!g.result)for(let i=0;i<3;i++)ell(CX-58+i*2,YT+92+i*20,13,9,TU.skin,3);
        if(win&&e>.3){for(let i=0;i<3;i++){const a=now*4+i*TAU/3;txt('✦',n[0]+Math.cos(a)*30,n[1]-8+Math.sin(a)*18,18,'#ffe14d');}tag(SX,SY-34);}}
      /* el yesquero y el medidor de calor (nivel 1; en el 2 se desvanece) */
      if(!win&&!primo){const q=ease(lit),back=fush?Math.min(1,e*4):0,lx=lerp(626,540,q)+back*70,ly=lerp(338,305,q)+back*30;
        yesquero(lx,ly,fush?0:lit,wind);
        const ga=g.result||lv>=3?0:lv===2?clamp(1-(h-.15)/.35,0,1):1;
        if(ga>0){const gx=lx+34,gy=ly-44,GH=92,M=B*1.06,yy=v=>gy+GH-GH*clamp(v/M,0,1);ctx.save();ctx.globalAlpha=ga;
          rr(gx,gy,16,GH,6,'#2d2640',3);rr(gx+2,yy(B),12,yy(LO)-yy(B),0,'#5cff7a',0);rr(gx+2,gy+2,12,yy(B)-gy-2,0,'#ff4d5e',0);
          rr(gx-4,yy(h)-3,24,6,3,'#ffffff',2.5);ctx.restore();}}
      /* la mano del primo: iba directo a tu vaso, ve la muesca y agarra el de al lado */
      if(win&&e>.25){const u=ease(clamp((e-.25)/.3,0,1)),v=ease(clamp((e-.95)/.15,0,1)),hx=lerp(lerp(px-40,SX,u),NX,v)+(e<.95&&u>=1?Math.sin(now*30)*3:0),hy=lerp(lerp(380,452,u),480+nb,v);
        limb(px-34,372,hx,hy-14,20,PRIMO.shirt,4);hand(hx,hy,PI,1.5,PRIMO.skin);}
      /* lo que se dice */
      if(win&&e>.95)bubble(592,200,'¡UY, ESE TIENE DUEÑO!',19,px-10,262);
      if(primo&&e>.3&&e<1.3)bubble(572,198,'¡GRACIAS, PRIMO!',22,Math.min(760,px-6),262);
      if(primo&&e>1.15)bubble(280,206,'¿ESE ERA EL MÍO?',21,214,236);
      if(fush&&e>.9)bubble(570,200,'¿QUÉ HUELE A QUEMADO?',19,790,250);
      drawP();
    }};
  return g;
}

BUS.add('marcalo',{name:'¡MÁRCALO!',mk:mkMarcalo,card:'EL YESQUERO',num:'80'});
})();
