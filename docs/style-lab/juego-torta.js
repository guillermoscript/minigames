'use strict';
/* MiniCaos · laboratorio de estilos: ¡NO TE MANCHES! (la torta).
   Cumpleaños en el patio. Te sirvieron el pedazo de torta empapada en almíbar con una MONTAÑA de merengue azul fosforescente,
   en un platico de cartón que se dobla solo, y andas con tu camisa blanca de salir. Hay que llevarlo de la mesa a tu silla
   con una sola mano. El camino ES el reloj: si llegas con la torta en el plato, ganas.
   Mecánica (equilibrio con inercia, como una pelota en una bandeja): ← → sostenidas, un lado de la pantalla o inclinar el teléfono
   INCLINAN el plato; la torta resbala con aceleración, no la mueves directo. El plato de cartón se dobla hacia donde está la torta
   (equilibrio inestable): quien no toca nada la pierde. Tropezones avisados medio segundo antes (flecha amarilla): el carajito
   corriendo, el tío bailando y el perro; llegan por el lado contrario a la torta y la empujan hacia el borde donde ya iba.
   Nivel 1: 2 tropezones suaves. Nivel 2: 3, plato más endeble y almíbar más resbaloso. Nivel 3: más de todo y el plato tiembla.
   Ganas: te sientas impecable, primer mordisco triunfal... y sonrisa azul fosforescente. Pierdes: la torta sale volando, cae boca
   abajo contra el pecho y deja la mancha azul brillante que no sale ni con cloro.
   Teclado: ← → (o A/D) sostenidas. Se carga DESPUÉS de index.html y juegos-bus.js y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.torta)return;
const{LV,CONF,TU,say,tag,steer}=window.BUS,PI=Math.PI;
const AZ='#19d8ff',AZ2='#aef6ff',BIZ='#f2c46a',FY=524,MX=330,HX=520,HYP=372,PL=110;
const YO=Object.assign({},TU,{shirt:'#ffffff',pat:'none',bw:52});
const TIA={skin:'#d9a07a',shirt:'#9b6bd1',pat:'floral',sh2:'#ffe08a',hair:'bun',hairCol:'#d8d8e0',glasses:'round',wrinkles:1,cheeks:1,earring:1};
const TIO={skin:'#b87b50',shirt:'#ff7a3d',pat:'floral',sh2:'#ffe14d',hair:'mullet',hairCol:'#14101c',glasses:'shades',chain:1,stache:1};
const NINO={skin:'#e0a070',shirt:'#e8553d',pat:'stripes',sh2:'#ffd23f',hair:'curly',hairCol:'#3b2a22',cheeks:1,brow:'thin'};
let tiltAsk=false;
/* el pedazo de torta: base en (0,0), merengue hacia arriba; inc = cuánto se ladea la montaña */
function torta(x,y,rot,inc,s=1){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
  ell(0,-2,40,7,'#e8a23a',0);rr(-34,-42,68,40,6,BIZ,4);rr(-34,-24,68,7,0,'#fff3c4',0);ell(-22,-4,5,8,'#e8a23a',0);ell(18,-2,4,7,'#e8a23a',0);
  ell(inc*.3,-56,37,21,AZ,4);ell(inc*.9,-82,29,19,AZ,4);ell(inc*1.7,-106,20,16,AZ,4);ell(inc*2.6,-126,11,12,AZ,3.5);
  ell(inc*.3-12,-62,10,5,AZ2,0);ell(inc*.9-8,-88,8,4,AZ2,0);ell(inc*2.9,-140,7,7,'#e8293f',3);ctx.restore();}
function sombrerito(x,y,s){poly([[x-12*s,y],[x+12*s,y],[x,y-30*s]],'#ff5c8a',3);ell(x,y-30*s,4*s,4*s,'#ffd23f',2);}

function mkTorta(){
  const lv=LV(),rs=Math.sqrt(SP),dur=5/rs,GA=1400,TM=.3;
  const FLEX=[.16,.2,.24][lv-1],MU=[2,1.6,1.25][lv-1],KICK=[120,145,165][lv-1],WOB=[.012,.022,.036][lv-1];
  const kinds=['nino','tio','perro'].sort(()=>Math.random()-.5),frac=lv===1?[.36,.7]:[.26,.5,.76];
  const bumps=frac.map((f,i)=>({t:dur*f+(Math.random()-.5)*.2,from:Math.random()<.5?-1:1,kind:kinds[i],hit:false,warned:false}));
  let cp=(Math.random()<.5?-1:1)*14,cv=0,st=0,jolt=0,th=0,sq=0,paso=0,fx=0,fy=0,frot=0,splat=false,bite=false,touched=false,boca=0;
  const g={t:0,dur,result:null,why:'',endT:0,cmd:'¡NO TE MANCHES!',lr:true,
    hint:'MANTÉN ← → (o un lado de la pantalla, o inclina el teléfono): que no se resbale',
    get impact(){return this.result==='lose'&&splat?clamp(1-(this.endT-.35)/.4,0,1):0;},
    probe:()=>({c:cp,v:cv,th,PL,st,prox:(bumps.find(b=>!b.hit)||{t:99}).t-g.t,from:(bumps.find(b=>b.warned&&!b.hit)||{from:0}).from}),
    press(){touched=true;},
    down(){touched=true;if(!tiltAsk&&window.DeviceOrientationEvent&&DeviceOrientationEvent.requestPermission){tiltAsk=true;try{DeviceOrientationEvent.requestPermission().catch(()=>{});}catch(_){}}},
    update(dt){
      if(g.result){g.endT+=dt;const e=g.endT;
        if(g.result==='lose'&&!splat&&e>=.35){splat=true;sfx.crash();snd(140,.3,'sine',.2,-80);spawn(MX,340,22,'bit',[AZ,AZ2,'#ffffff'],340,800,1);say('¡PLAF!',MX+10,214,AZ);}
        if(g.result==='win'&&!bite&&e>=.8){bite=true;snd(520,.07,'square',.06);snd(240,.12,'sine',.1,-80);spawn(MX,236,8,'bit',[AZ,AZ2],160,500,.6);say('¡ÑAM!',MX+90,170,AZ);}
        return;}
      g.t+=dt;const s=steer();if(s)touched=true;st+=(s-st)*Math.min(1,dt*10);jolt*=Math.exp(-dt*7);
      th=st*TM+(cp/PL)*FLEX+jolt+Math.sin(g.t*7.3)*WOB+(lv>=3?Math.sin(g.t*31)*.012:0);
      cv+=(GA*th-MU*cv)*dt;cp+=cv*dt;
      /* tropezones: aviso .55 s antes, empujón al llegar */
      for(const b of bumps){if(!b.warned&&g.t>=b.t-.55){b.warned=true;if(Math.abs(cp)>3)b.from=cp>0?-1:1;snd(880,.07,'square',.05);snd(660,.07,'square',.04,0);}
        if(!b.hit&&g.t>=b.t){b.hit=true;cv-=b.from*KICK;jolt-=b.from*.22;sfx.thud();if(b.kind==='perro')sfx.boing();
          say(b.kind==='nino'?'¡PERMISOOO!':b.kind==='tio'?'¡ÉPALE, SOBRINO!':'¡GUAU!',HX+b.from*90,HYP+70,'#ffe14d');}}
      sq-=dt;if(Math.abs(cv)>70&&sq<=0){sq=.16;snd(500+Math.abs(cp)*4,.05,'sine',.03,120);}
      paso-=dt;if(paso<=0){paso=.3/rs;snd(120,.03,'square',.02);}
      if(Math.abs(cp)>PL-6){g.result='lose';g.why='¡TE MANCHASTE!';fx=HX+Math.cos(th)*cp;fy=HYP+Math.sin(th)*cp-10;frot=th;sfx.whoosh();sfx.lose();}
      else if(g.t>=dur){g.result='win';g.why='¡IMPECABLE!';sfx.win();spawn(MX,200,26,'conf',CONF);}
    },
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,k=clamp(g.t/dur,0,1),sc=k*420,chX=MX+420-sc,dng=Math.abs(cp)/PL;
      const sit=win?ease(clamp(e/.25,0,1))*26:0,bob=g.result?0:Math.sin(g.t*12*rs)*4,py=250+sit+bob;
      /* patio: pared, banderines, globos */
      wash(gameLeft(),0,GAME_VIEW.width,600,'#ffd9a0','#ffc27a');rr(gameLeft(),FY,GAME_VIEW.width,80,0,'#c98a5a',0);line([[gameLeft(),FY],[gameRight(),FY]],5,INK);
      for(let i=0;i<7;i++)line([[i*140-(sc*.8)%140,FY+26],[i*140+60-(sc*.8)%140,FY+26]],4,'#a86f44');
      line([[0,104],[200,128],[400,108],[600,130],[800,104]],3,INK);
      for(let i=0;i<10;i++){const bx=30+i*82,by=106+Math.sin(i*1.6)*11;poly([[bx-15,by],[bx+15,by],[bx,by+30]],CONF[i%4],3);}
      txt('FELIS CUMPLEAÑO',140,170,22,'#c4283a',-.02,true);
      for(let i=0;i<3;i++){const bx=660+i*46-sc*.5,by=250+Math.sin(now*2+i)*8;line([[bx,by+34],[bx+6,FY-150]],2.5,INK);ell(bx,by,26,32,['#ff5c8a','#3fb0ff','#ffd23f'][i],3.5);}
      /* la mesa de la torta, con la gallina de siempre en sombrerito comiéndose lo que queda */
      const mx=120-sc;if(mx>-220){rr(mx-130,FY-150,260,16,6,'#ffffff',4);poly([[mx-124,FY-134],[mx+124,FY-134],[mx+110,FY-40],[mx-110,FY-40]],'#ff9ec7',4);
        rr(mx-112,FY-40,10,40,3,'#8a5a30',3);rr(mx+102,FY-40,10,40,3,'#8a5a30',3);
        rr(mx-80,FY-200,96,50,8,BIZ,4);ell(mx-32,FY-204,50,14,AZ,4);rr(mx-36,FY-240,5,34,2,'#ff5c8a',2);
        const pk=Math.sin(now*9)>.2?6:0;hen(mx+52,FY-176+pk,.62,1);sombrerito(mx+76,FY-204+pk,.6);}
      /* la tía y tu silla van llegando */
      bust(Object.assign({},TIA,{x:chX-190,y:FY-126,s:.76,th:110,legs:['#d9a07a','#2b2b3a',60],look:1,mood:lose?(e>.4?'yell':'o'):win?'happy':dng>.7?'worry':'smile',talk:lose?1:0,
        arms:lose&&e>.4?[{side:1,a:2.6,len:70,w:19},{side:-1,a:-2.6,len:70,w:19}]:[{side:1,a:.15,len:80,w:19},{side:-1,a:-.15,len:80,w:19}]}));
      rr(chX-58,FY-196,14,196,5,'#e8e8ee',4);rr(chX-58,FY-196,104,14,5,'#e8e8ee',4);rr(chX-58,FY-92,116,14,5,'#e8e8ee',4);rr(chX+44,FY-92,14,92,5,'#e8e8ee',4);
      /* TÚ, con tu camisa blanca de salir */
      const mood=win?(e>.8?'grin':'happy'):lose?(e<.35?'yell':'frown'):jolt*jolt>.004?'o':dng>.72?'panic':dng>.42?'worry':'smile';
      bust(Object.assign({},YO,{x:MX,y:py,s:1.05,th:176,legs:['#2f3a7a','#14101c',win?112:138],mood,talk:lose?1:0,look:lose?0:clamp(.6+cp/PL,-1,1),down:lose||!win,
        sweat:win?0:dng>.72?2:dng>.42?1:0,rot:lose?-.05:0,arms:[{side:-1,a:lose&&e>.4?-.5:-.12,len:92,w:21,col:'#ffffff'}],
        over(){if(win&&e>.8){rr(-15,HY+9,30,8,3,AZ,0);ell(-22,HY+20,6,5,AZ,0);}}}));
      for(let i=0;i<3;i++)ell(MX,py+34+i*36,4,4,'#c4cad6',2);
      if(!touched&&!g.result)tag(MX-96,py-40);
      /* la mancha: azul brillante, imposible de sacar */
      if(lose&&splat){const u=clamp((e-.35)/.9,0,1),gl=mix(AZ,'#ffffff',.25+.25*Math.sin(now*14));
        for(let i=0;i<5;i++)limb(MX-34+i*17,py+84,MX-34+i*17,py+100+u*(30+hash(i,3,1)*46),9,AZ,3);
        ell(MX,py+72,46,50,AZ,4);ell(MX-6,py+62,26,24,gl,0);ell(MX+30,py+26,9,8,AZ,3);ell(MX-40,py+30,6,6,AZ,3);
        torta(MX+4,py+70+u*150,PI,0,.8);
        for(let i=0;i<3;i++){const a=now*3+i*TAU/3;txt('✦',MX+Math.cos(a)*74,py+70+Math.sin(a)*60,22,'#ffffff');}}
      if(win)for(let i=0;i<4;i++){const a=now*3+i*TAU/4;txt('✦',MX+Math.cos(a)*84,py+70+Math.sin(a)*74,24,'#ffe14d');}
      /* el brazo del plato */
      const hx=lose?474:HX,hy=lose?Math.min(456,HYP+e*320):HYP+sit*.5+bob*.5,sx=MX+44,sy=py+10;
      limb(sx,sy,lerp(sx,hx,.45),hy+34,23,'#ffffff',4);limb(lerp(sx,hx,.45),hy+34,hx,hy+12,19,YO.skin,3.5);
      if(win&&e>.45){const u=ease(clamp((e-.45)/.3,0,1)),bx=lerp(HX-40,MX+8,u),by=lerp(hy-40,py-36,u);if(e<.85)ell(bx,by,11,9,AZ,3);}
      /* el plato de cartón (se dobla) y la torta encima */
      if(lose){const u=clamp(e/.35,0,1),dy=Math.min(FY-HYP-8,e*e*900);ctx.save();ctx.translate(HX,HYP+dy);ctx.rotate(frot+Math.min(e*5,2.6));line([[-PL,6],[0,0],[PL,6]],9,'#e9e2d0');ctx.restore();
        if(!splat)torta(lerp(fx,MX+4,u),lerp(fy,340,u)-Math.sin(u*PI)*130,frot+u*PI,0,1);}
      else{ctx.save();ctx.translate(hx,hy);ctx.rotate(th);const dr=6+dng*16,sd=cp>0?1:-1;
        const pts=[[-PL-12,sd<0?dr:3],[-PL*.5,sd<0?dr*.3:0],[0,0],[PL*.5,sd>0?dr*.3:0],[PL+12,sd>0?dr:3]];
        line(pts,13,INK);line(pts,8,'#f4efe2');line([[-PL-10,pts[0][1]],[-PL+10,pts[0][1]*.8]],8,'#ff4d5e');line([[PL-10,pts[4][1]*.8],[PL+10,pts[4][1]]],8,'#ff4d5e');
        line([[cp-clamp(cv*.25,-60,60),-7],[cp,-7]],5,'#e8a23a');
        torta(cp,-6+Math.abs(cp)/PL*dr*.5,(cp/PL)*FLEX*.6,clamp(-cv*.05,-12,12)+Math.sin(now*9)*1.5,win?1:1+Math.sin(now*20)*.02*dng);ctx.restore();
        hand(hx,hy+10,th*.4,1.1,YO.skin);}
      /* los tropezones */
      for(const b of bumps){const d=g.t-b.t,f=b.from;if(g.result&&!b.hit)continue;if(!b.warned||d>1.1)continue;
        if(b.kind==='tio'){const x=HX+f*(118+Math.abs(d)*420),dz=Math.sin(now*14);
          bust(Object.assign({},TIO,{x,y:FY-140+Math.abs(dz)*8,s:.8,flip:f>0,th:110,legs:['#3b3550','#ffffff',66],mood:d>0?'o':'grin',rot:dz*.1,gold:1,arms:[{side:1,a:2.2+dz*.4,len:70,w:19},{side:-1,a:-2.2+dz*.4,len:70,w:19}]}));}
        else{const x=HX-f*d*520;if(b.kind==='nino')bust(Object.assign({},NINO,{x,y:FY-74-Math.abs(Math.sin(now*18))*10,s:.5,flip:f>0,th:100,legs:['#2f7fe0','#ffffff',44],mood:'yell',talk:1,rot:-f*.12*(f>0?-1:1),
            arms:[{side:1,a:2.4,len:70,w:19},{side:-1,a:-2.4,len:70,w:19}]}));
          else{ctx.save();ctx.translate(x,FY-Math.abs(Math.sin(now*16))*14);ctx.scale(f>0?-1.25:1.25,1.25);dog(0,0,1);ctx.restore();}}
        if(d<0&&Math.sin(now*26)>-.4){const ax=HX-f*40,ay=HYP-190;poly([[ax+f*34,ay-13],[ax-f*4,ay-13],[ax-f*4,ay-28],[ax-f*40,ay],[ax-f*4,ay+28],[ax-f*4,ay+13],[ax+f*34,ay+13]],'#ffe14d',4);
          txt('¡OJO!',HX+f*230<60?60:HX+f*230>740?740:HX+f*230,HYP-110,26,'#ff4d5e',-.05*f);}}
      /* lo que se dice (fuera de la franja del sello) */
      if(!g.result&&g.t<1.1/rs)bubble(chX-150<160?160:Math.min(640,chX-150),210,'¡CUIDADO CON LA CAMISA!',17,chX-190,FY-190);
      if(lose&&e>.5)bubble(chX-190<MX?170:626,150,'¡ESA CAMISA ERA BLANCA!',19,chX-190,FY-200);
      if(lose&&e>.8)txt('NO SALE NI CON CLORO',MX+60,FY+26,22,AZ,-.03);
      if(win&&e>.3)bubble(chX-190<MX?170:626,150,e>.9?'MIJO... ¿Y ESOS DIENTES?':'¡QUÉ NIÑO TAN PULCRO!',19,chX-190,FY-200);
      if(!g.result&&dng>.72&&Math.sin(now*22)>-.3)txt('¡SE RESBALA!',HX+60+Math.sin(now*60)*3,HYP+120,26,'#ff4d5e',-.05);
      drawP();
    }};
  return g;
}

BUS.add('torta',{name:'¡NO TE MANCHES!',mk:mkTorta,card:'LA TORTA',num:'83'});
})();
