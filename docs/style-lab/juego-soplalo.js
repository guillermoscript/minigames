'use strict';
/* MiniCaos · laboratorio de estilos: ¡SÓPLALO! (el primer mordisco al tequeño volcánico).
   Primerísimo plano de tu cara: acabas de morder la punta del tequeño y el queso blanco sale por el hueco a temperatura de LAVA.
   La barra del PALADAR sube sola (más rápido mientras más caliente esté el queso): hay que SOPLAR alternando los dos lados
   (mitad izquierda / mitad derecha de la pantalla, o las flechas ← →): «¡FA! ¡FA! ¡FA! ¡JÚ! ¡JÚ!». Cada soplido bueno enfría un
   poco; el mismo lado dos veces seguidas no bota aire (cachetes inflados, ¡PFF!) y encima te quema un pelo, así que machacar
   a lo loco no sirve. Ganas cuando el queso llega a TIBIO antes de que se llene la barra (o se acabe el tiempo).
   Con el micrófono del laboratorio prendido, soplarle al micrófono también enfría.
   Nivel 1: 11 soplidos. Nivel 2: 13 y la barra sube más rápido. Nivel 3: a mitad de camino revienta OTRO bolsillo de lava
   y la temperatura vuelve a subir una vez.
   Ganas: mordisco feliz, el queso se estira, se revienta y te queda guindando de la nariz. Pierdes: te lo tragas ardiendo,
   cara roja, lágrimas, «¡AGUA!»... y la gallina del mostrador se está tomando el último vaso (el cartel ya lo decía).
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.soplalo)return;
const{LV,CONF,TU,say,tag}=window.BUS,PI=Math.PI;
const FX=380,FY=470,FS=2.2,MX=FX,MY=FY+FS*(HY+22),EYY=FY+FS*(HY-6),MASA='#e0a050',FRIO='#fff3c4',LAVA='#ff4a1e';
const SIL=['¡FA!','¡FA!','¡FA!','¡JÚ!','¡JÚ!'];
const mic=()=>{try{return micOn?micLevel():0;}catch(_){return 0;}};

function mkSoplalo(){
  const lv=LV(),rs=Math.sqrt(SP),N=[11,13,12][lv-1],dur=5/rs,BASE=1/([.68,.62,.6][lv-1]*dur),PEN=[.05,.055,.06][lv-1];
  let temp=1,burn=0,lastS=null,n=0,puff=0,bad=0,side=0,burst=lv<3,pop=0,micT=0,o0=0,ev=0,tearT=0,stT=0;
  function cool(k){temp-=k;
    if(!burst&&temp<=.45){burst=true;temp+=.42;pop=1;sfx.crash();snd(160,.3,'sawtooth',.07,240);spawn(MX+60,MY+6,12,'bit',[LAVA,'#ffd23f','#ffffff'],300,700,.7);say('¡OTRO BOLSILLO!',MX+90,MY-90,'#ff8a3d');}
    if(temp<=0){temp=0;g.result='win';g.why='¡TIBIECITO!';sfx.win();spawn(MX+70,MY-40,22,'conf',CONF);}}
  function sopla(s){if(g.result)return;side=s;
    if(s===lastS){bad=1;burn=Math.min(1,burn+PEN);snd(150,.12,'sawtooth',.05,-50);say('¡PFF!',MX+s*120,MY-30,'#ff9ec7');return;}
    lastS=s;puff=1;const k=n%5;snd(k<3?640:430,.08,'triangle',.06,k<3?-180:-120);nz(.07,.06);
    say(SIL[k],MX+90+Math.random()*90,MY-70-Math.random()*50,k<3?'#ffffff':'#ffe14d');n++;cool(1/N);}
  const g={lr:true,get impact(){return this.result?clamp(1-this.endT/.5,0,1):pop*.6;},
    probe:()=>({temp,burn,last:lastS,n,need:N,burst}),
    t:0,dur,result:null,why:'',endT:0,cmd:'¡SÓPLALO!',hint:'ALTERNA ◀ ▶ (los dos lados de la pantalla, o flechas ← →): sopla hasta TIBIO',
    press(k){if(k==='left')sopla(-1);else if(k==='right')sopla(1);else if(!g.result&&bad<=0){bad=.5;say('¡← →!',MX,MY-150,'#ffffff');snd(200,.06,'square',.03);}},
    down(p){sopla(p.x<W/2?-1:1);},
    update(dt){g.t+=dt;puff=Math.max(0,puff-dt*7);bad=Math.max(0,bad-dt*3);pop=Math.max(0,pop-dt*3);
      if(!g.result){
        burn=Math.min(1,burn+BASE*(.3+.7*temp)*clamp(g.t/.3,0,1)*dt);
        if(mic()>.18){puff=Math.max(puff,.6);if((micT-=dt)<=0){micT=.16;say(SIL[n++%5],MX+90+Math.random()*90,MY-70-Math.random()*50,'#ffffff');}cool(.45*dt);}
        if(!g.result&&(stT-=dt)<=0&&temp>.3){stT=.22;PT.push({x:MX+70+Math.random()*30,y:MY-22,vx:(Math.random()-.5)*30,vy:-70,g:-40,t:0,life:.7,kind:'~',col:'#ffffff',r:-4,rot:PI/2,vr:0});}
        if(!g.result&&(burn>=1||g.t>=g.dur)){o0=temp;g.result='lose';g.why='¡TE QUEMASTE!';sfx.lose();snd(300,.3,'sawtooth',.07,500);}}
      else{g.endT+=dt;const e=g.endT;
        if(g.result==='win'){
          if(ev<1&&e>=.22){ev=1;snd(180,.1,'square',.06,-60);nz(.08,.1);say('¡ÑAM!',MX+40,MY-120,'#ffe14d');}
          if(ev<2&&e>=1.15){ev=2;sfx.boing();}}
        else{
          if(ev<1&&e>=.25){ev=1;sfx.thud();say('¡GLUP!',MX+10,MY+70,'#ffffff');}
          if(ev<2&&e>=.5){ev=2;sfx.screech();}
          if(ev<3&&e>=1.05){ev=3;sfx.cluck();snd(900,.25,'sine',.05,-500);}
          if(e>.4&&(tearT-=dt)<=0){tearT=.07;for(const sg of[-1,1])PT.push({x:FX+sg*FS*24,y:EYY+10,vx:sg*(120+Math.random()*120),vy:-140,g:700,t:0,life:.7,kind:'bit',col:'#9fe3ff',r:5,rot:0,vr:6});}}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,hot=clamp(temp,0,1),qc=mix(FRIO,LAVA,hot),shk=!g.result&&burn>.7?Math.sin(now*44)*2.5:0;
      /* la fiesta: pared, banderines, el cartel y el mostrador con la gallina (y el último vaso de agua) */
      wash(gameLeft(),0,GAME_VIEW.width,600,'#ffe9b8','#ffd28a');
      line([[230,128],[470,146],[700,128]],3,INK);for(let i=0;i<8;i++){const u=i/7,x=250+u*430,y=130+Math.sin(u*PI)*15;poly([[x-13,y],[x+13,y],[x,y+26]],CONF[i%4],3);}
      rr(16,128,204,58,8,'#c4283a',4);txt('TEQUEÑOS «LA LAVA»',118,146,15,'#ffffff',0,true);txt('AGUA: SE ACABÓ',118,169,14,'#ffe14d',0,true);
      rr(0,268,214,18,6,'#8a5a3a',4);rr(10,286,16,290,0,'#6b4f2a',3);
      const sip=lose&&e>1.05,hb=sip?0:Math.abs(Math.sin(now*3))*3;hen(74,244-hb,.72,1);
      const wl=sip?clamp(1-(e-1.05)*1.2,.1,1):1;rr(142,220,30,48,5,'#e8f8ff',3.5);rr(145,223+(1-wl)*40,24,42*wl,3,'#5cc8ff',0);
      if(sip){line([[122,222],[152,214],[158,258]],4,'#ff5ca8');txt('glu glu',150,200+Math.sin(now*12)*3,15,'#ffffff');}
      /* tú, en primerísimo plano */
      const red=lose?clamp(e*3,0,.6):clamp(burn-.5,0,.5)*.5,chk=bad>0?bad:0,gulp=lose&&e<.3;
      const mood=win?'happy':lose?(gulp?'o':e>1.6?'dizzy':'yell'):bad>.3?'angry':puff>.15?'o':hot>.55||burn>.7?'panic':'worry';
      const fan=win?[{side:-1,a:-2.5,len:66,w:22}]:lose?[{side:-1,a:-2.3+Math.sin(now*26)*.4,len:70,w:22},{side:1,a:2.3+Math.sin(now*26+2)*.4,len:70,w:22}]
        :[{side:-1,a:-2.45+Math.sin(now*20)*.22,len:70,w:22}];
      bust(Object.assign({},TU,{x:FX+shk,y:FY+(lose&&!gulp?Math.sin(now*40)*4:0),s:FS,skin:mix(TU.skin,'#ff4d3d',red),th:120,rot:win?Math.sin(e*5)*.03:0,
        mood,talk:lose&&!gulp?Math.abs(Math.sin(now*16)):0,look:lose?0:1,down:g.result?0:1,sweat:win?0:burn>.5||lose?2:1,arms:fan}));
      /* cachetes inflados: soplaste dos veces del mismo lado */
      if(chk>0)for(const sg of[-1,1])ell(FX+sg*FS*31,MY-8,20+chk*14,17+chk*12,'#ff8aa5',3.5);
      /* lágrimas: de felicidad o de queso */
      if(win)for(const sg of[-1,1])ell(FX+sg*FS*27,EYY+26+Math.sin(now*8+sg)*3,6,10,'#9fe3ff',2.5);
      if(lose&&e>.5)for(const sg of[-1,1]){const u=(now*2.2+sg*.3)%1;ctx.save();ctx.globalAlpha=1-u;line([[FX+sg*FS*46,EYY-10-u*10],[FX+sg*(FS*46+18+u*30),EYY-34-u*46]],7,'#ffffff');ctx.restore();}
      /* el tequeño mordido, con el queso saliendo por el hueco */
      const off=win?(e<.22?34*(1-e/.22):Math.min(150,(e-.22)*260)):lose?34+Math.min(1,e*4)*20:34+puff*4;
      const tx=MX+off,ty=MY+6+(lose?Math.sin(now*30)*4:0);
      if(!g.result&&puff>.1){ctx.save();ctx.globalAlpha=puff;for(let i=-1;i<=1;i++)line([[MX+12,MY+i*7],[MX+32+puff*10,MY+i*15]],4,'#ffffff');ctx.restore();}
      if(win&&e>.22){const snap=e>=1.15,sag=14+off*.12;
        if(!snap){const pts=[];for(let i=0;i<=8;i++){const u=i/8;pts.push([lerp(MX+4,tx+12,u),lerp(MY+4,ty,u)+Math.sin(u*PI)*sag]);}line(pts,Math.max(3,10-off*.04)+4,INK);line(pts,Math.max(3,10-off*.04),FRIO);}
        else{const d=Math.min(1,(e-1.15)*6),sw=Math.sin(now*9)*8*Math.max(0,1.8-e);line([[FX+6,MY-52],[FX+10+sw,MY-52+50*d],[FX+8+sw*1.6,MY-52+86*d]],10,INK);line([[FX+6,MY-52],[FX+10+sw,MY-52+50*d],[FX+8+sw*1.6,MY-52+86*d]],6,FRIO);}}
      ctx.save();ctx.translate(tx,ty);ctx.rotate(.16+(win?.1:0));
      limb(150,46,186,260,54,TU.shirt,4);
      rr(0,-24,196,48,22,MASA,4.5);for(let i=0;i<5;i++)line([[34+i*32,-22],[50+i*32,22]],3.5,dark(MASA,.3));
      hand(150,34,0,2.3,TU.skin);
      if(!lose||e<.25){const gl=g.result?0:hot;
        if(gl>.3){ctx.save();ctx.globalAlpha=.3*gl;ell(2,0,30+Math.sin(now*14)*5+pop*20,30+Math.sin(now*14)*5+pop*20,'#ff8a3d',0);ctx.restore();}
        const k=lose?1-e/.25:1;ell(2,0,(15+pop*8)*k,(19+pop*8)*k,qc,4);ell(-4,14,9*k,(13+hot*10+Math.sin(now*6)*2)*k,qc,3.5);ell(-2,-6,5*k,4*k,'#ffffff',0);}
      else ell(6,0,10,16,dark(MASA,.5),3);
      ctx.restore();
      if(lose&&e>.5)for(const sg of[-1,1])for(let i=0;i<2;i++){const u=(now*1.6+i*.5)%1;ctx.save();ctx.globalAlpha=.8*(1-u);ell(FX+sg*(FS*46+20+u*50),FY+FS*HY-10-u*40,12+u*12,9+u*9,'#ffffff',2.5);ctx.restore();}
      tag(FX-150,FY-12);
      /* el queso: de LAVA a TIBIO */
      rr(250,96,300,26,10,'#2d2640',4);if(hot>.01)rr(254,100,292*hot,18,7,qc,0);
      txt('TIBIO',214,109,15,'#ffffff');txt('LAVA',588,109,15,'#ff8a3d');
      /* el paladar: la barra de quemadura */
      const bx=716+shk,bh=270;txt('PALADAR',736,142,14,'#ffffff');rr(bx,156,40,bh+8,12,'#2d2640',4);
      if(burn>.01)rr(bx+4,160+bh*(1-burn),32,bh*burn,8,burn>.7&&Math.sin(now*26)>0?'#ffe14d':'#ff4d5e',0);
      for(let i=1;i<4;i++)line([[bx+4,160+bh*i/4],[bx+14,160+bh*i/4]],2.5,'#8f8fa8');
      txt(burn>.7?'¡AY!':'AMPOLLA',736,128,13,burn>.7?'#ff4d5e':'#ffe14d');
      /* los dos lados: el que toca ahora brilla */
      if(!g.result)for(const sg of[-1,1]){const nxt=lastS==null||lastS!==sg,pz=nxt?1+Math.sin(now*12)*.05:1,w=128*pz,h=92*pz,cx=sg<0?88:712,cy=512,hit=side===sg&&(puff>.3||bad>.3);
        rr(cx-w/2,cy-h/2+(hit?4:0),w,h,20,nxt?'#ffd23f':'#8f8fa8',4.5);txt(sg<0?'◀ FA':'JÚ ▶',cx,cy+(hit?4:0),nxt?30:24,nxt?INK:'#d9dce6',0,true);}
      /* lo que se dice */
      if(win&&e>.3)bubble(590,196,e<1.15?'MMM... ¡TIBIECITO!':'¡Y SE ESTIRA!',22,FX+70,MY-70);
      if(lose&&e>.35)bubble(560,196,e<1.05?'¡AGUA! ¡AGUA!':'¡¿Y EL AGUA?!',26,FX+60,MY-80);
      drawP();
    }};
  return g;
}

BUS.add('soplalo',{name:'¡SÓPLALO!',mk:mkSoplalo,card:'LA LAVA',num:'77'});
})();
