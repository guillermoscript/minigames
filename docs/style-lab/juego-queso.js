'use strict';
/* MiniCaos · laboratorio de estilos: ¡PÉSALO! (medio kilo de queso duro «bien rallao»).
   En la charcutería: MANTIENES el dedo para echar queso rallado de la ponchera a la bolsa que está sobre la balanza digital,
   y el número sube rapidísimo. Hay que SOLTAR cuando marque entre 0.490 y 0.510 kg. Si sueltas antes puedes volver a echar
   (un toque corto es un pellizco), pero el reloj corre; apenas pasa de 0.510 se te va la ponchera entera.
   Ganas: marca 0.500 clavado, el charcutero le pone el tirro amarillo y suelta «¡Ojo clínico!».
   Pierdes por pasarte: la balanza se dispara a 0.850 kg y te cobran casi el doble de lo que traías ($4.25 contra $2.50).
   Pierdes por tiempo: te quedaste corto y hay cola.
   Nivel 1: 0.24 kg/s a chorro lleno. Nivel 2: 0.30. Nivel 3: 0.36 (un pellizco ya pesa casi media ventana).
   Teclado: mantén ESPACIO y suéltalo.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.queso)return;
const LV=BUS.LV,CONF=BUS.CONF,TU=BUS.TU,tag=BUS.tag,PI=Math.PI,LO=.49,HI=.51,PRECIO=5,Q='#ffe07a',MET='#c9ced6';
const CH={skin:'#d9a07a',shirt:'#3fa0ff',pat:'apron',sh2:'#fffdf2',cap:'#fffdf2',hairCol:'#3b2a22',stache:1,brow:'thick',cheeks:1};
const pop=(s,x,y,col,r=8,life=.75)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.24,vr:0});
/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;
/* soltar ESPACIO también es soltar el dedo (el laboratorio solo avisa cuando se presiona) */
addEventListener('keyup',e=>{if((e.code==='Space'||e.code==='Enter')&&gameId==='queso'&&G&&G.up)G.up();});

/* ═════════ ¡PÉSALO!: suelta cuando la balanza marque medio kilo ═════════ */
function mkQueso(){
  const rs=Math.sqrt(SP),lv=LV(),R=[.24,.3,.36][lv-1],PX=215,PY=196,BX=335,BY=380;
  let w=0,hold=false,ht=0,rel=9,tilt=.18,shT=0,tick=0,used=false,did=0,fin=0;
  const sh=[];
  const dentro=()=>w>=LO&&w<=HI;
  function gana(){hold=false;w=.5;g.result='win';g.why='¡MEDIO KILO!';sfx.ding();sfx.win();spawn(BX,BY-150,24,'conf',CONF);}
  /* una hebra de queso que sale por el pico de la ponchera */
  function hebra(f=1){const c=Math.cos(tilt),s=Math.sin(tilt);sh.push({x:PX+c*84+(Math.random()-.5)*16,y:PY+s*84,vx:(20+Math.random()*60)*f,vy:20+Math.random()*60,r:Math.random()*PI,t:0});}
  function echa(){if(g.result||hold)return;hold=true;ht=0;used=true;w+=.003;snd(520,.05,'square',.04,200);}
  const g={get impact(){return this.result?clamp(1-fin/.5,0,1):0;},probe:()=>({w,lo:LO,hi:HI,hold,R,kind:g.kind}),
    t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,cmd:'¡PÉSALO!',
    hint:'MANTÉN para echar queso y SUELTA entre 0.490 y 0.510 kg (o ESPACIO)',
    press(k){if(k==='any')echa();},
    down(){echa();},
    up(){if(hold){hold=false;rel=0;}},
    update(dt){g.t+=dt;const pasa=g.result==='lose'&&g.kind==='pasa';
      tilt=lerp(tilt,pasa?1.45:hold?.5+.38*Math.min(1,ht/.35):.18,Math.min(1,dt*(pasa?7:14)));
      if(!g.result){
        if(hold){ht+=dt;w+=R*(.25+.75*Math.min(1,ht/.35))*dt;
          if((shT-=dt)<=0){shT=.02;hebra();hebra();}
          if((tick-=dt)<=0){tick=.05;snd(300+w*1500,.03,'square',.022);}
          if(w>HI+.0005){hold=false;g.result='lose';g.kind='pasa';g.why='¡TE PASASTE!';sfx.crash();sfx.lose();}}
        else{rel+=dt;if(used&&rel>=.22&&dentro())gana();}    /* la balanza tarda un momentico en asentarse */
        if(!g.result&&g.t>=g.dur){if(dentro())gana();else{hold=false;g.result='lose';g.kind='falta';g.why='¡TE FALTÓ!';sfx.lose();}}}
      else{fin+=dt;g.endT=sello(fin);
        if(pasa){if(w<.85){w=Math.min(.85,w+dt*.9);if((shT-=dt)<=0){shT=.012;hebra(2.2);hebra(2.2);hebra(2.2);}if((tick-=dt)<=0){tick=.04;snd(300+w*1500,.03,'square',.03);}}
          if(did<1&&fin>.9){did=1;sfx.ding();}}
        if(g.result==='win'&&did<1&&fin>.3){did=1;nz(.06,.2);snd(900,.06,'square',.06);pop('¡ZAS!',BX+104,BY-150,'#ffd23f',8);}}
      const top=BY-(8+Math.min(w,.6)*170);
      for(let i=sh.length-1;i>=0;i--){const s=sh[i];s.t+=dt;s.vy+=1100*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.r+=dt*9;if(s.y>top+12||s.t>1.2)sh.splice(i,1);}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',pasa=lose&&g.kind==='pasa',falta=lose&&!pasa,e=fin,inW=dentro(),ph=8+Math.min(w,.6)*170;
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      /* la charcutería: baldosas, embutidos colgando y el cartel de siempre */
      wash(0,0,800,600,'#fdf3d8','#f6e3b4');
      for(let i=0;i<9;i++)for(let j=0;j<4;j++)if((i+j)%2)rr(i*90,104+j*80,90,80,0,'#f3e2b0',0);
      line([[0,98],[300,98]],6,'#8f8fa8');
      [[36,'#c4283a',74],[78,'#e8553d',100],[120,'#c4283a',60]].forEach(([x,c,l],i)=>{ctx.save();ctx.translate(x,98);ctx.rotate(Math.sin(now*2+i)*.04);line([[0,0],[0,16]],3,INK);limb(0,24,0,24+l,26,c,4);line([[-12,24+l*.5],[12,24+l*.5]],2.5,'#fff3c4');ctx.restore();});
      rr(318,100,108,40,6,'#fff3c4',3.5);txt('HOY NO FÍO',372,113,12,INK,0,true);txt('MAÑANA SÍ',372,129,12,'#c4283a',0,true);
      /* la pantalla de la balanza */
      const col=pasa?(Math.sin(now*26)>0?'#ff4d5e':'#ffe14d'):inW?'#5cff7a':'#ffb300';
      line([[452,200],[432,300],[404,400]],4,'#3b3550');
      rr(440,98,332,104,12,'#2d2640',4.5);rr(450,106,312,58,6,'#14101c',3);
      txt(w.toFixed(3),590,137,48,col,0,true);txt('kg',724,146,20,col,0,true);
      rr(452,172,186,14,4,'#14101c',2.5);rr(452+186*LO/.6-1,170,186*(HI-LO)/.6+3,18,2,'#5cff7a',0);rr(452+186*Math.min(w,.6)/.6-2,168,4,22,1,'#ffffff',0);
      txt('TOTAL $'+(w*PRECIO).toFixed(2),704,180,15,'#fffdf2',0,true);
      ctx.save();ctx.translate(486,214);ctx.rotate(-.08);rr(-46,-14,92,30,3,'#fff3c4',3);txt('½ KILO',0,1,16,INK,0,true);ctx.restore();
      /* el charcutero */
      let cm=win?'happy':pasa?'grin':falta?'angry':hold&&w>.42?'o':'calm',ca=[{side:-1,a:-.25,len:70,w:22},{side:1,a:.25,len:70,w:22}];
      if(win&&e>.12&&e<.75){const lx=BX+56-650+42,ly=BY-134-334;ca=[{side:-1,a:Math.atan2(lx,ly),len:clamp(Math.hypot(lx,ly),40,240),w:22},ca[1]];}
      else if(win)ca=[{side:-1,a:-.25,len:70,w:22},{side:1,a:2.5+Math.sin(now*10)*.12,len:72,w:22}];
      else if(pasa)ca=[{side:-1,a:.55+Math.sin(now*14)*.12,len:50,w:22},{side:1,a:-.55-Math.sin(now*14)*.12,len:50,w:22}];
      bust(Object.assign({},CH,{x:650,y:330,s:1,look:-1,mood:cm,arms:ca,lids:!g.result&&!hold&&!used?1:0,talk:(win&&e>.75)||(lose&&e>.75)?Math.abs(Math.sin(now*12)):0,vein:falta?1:0}));
      /* el mostrador y la vitrina */
      rr(0,424,800,160,0,'#e8e8ee',0);line([[0,424],[800,424]],5,INK);
      rr(24,452,752,116,10,'#cfeaf5',4);
      rr(54,492,112,64,8,'#fffdf2',3.5);txt('BLANCO',110,524,13,INK,0,true);
      ell(250,524,72,34,'#ff9eb0',3.5);ell(250,524,50,20,'#ffc2cc',0);
      limb(372,532,500,520,30,'#c4283a',3.5);
      poly([[560,556],[690,556],[690,500]],'#ffd23f',3.5);for(const[x,y]of[[640,540],[668,524],[610,548]])ell(x,y,6,5,'#e8a800',0);
      rr(700,468,60,24,4,'#fff3c4',3);txt('REF',730,480,13,'#c4283a',0,true);
      /* la balanza, la bolsa y el montoncito */
      rr(245,398,180,40,10,MET,4.5);rr(232,380,206,18,8,'#eef1f6',4);
      ctx.save();ctx.globalAlpha=.55;rr(BX-73,BY-122,146,122,16,'#f4fbff',3.5);ctx.restore();
      ctx.save();path(rrP(BX-70,BY-120,140,120,14));ctx.clip();ell(BX,BY+2,66,ph,Q,3.5);
      for(let i=0;i<7;i++){const a=hash(i,1,7)*PI,qx=BX-30+hash(i,2,7)*60,qy=BY-6-hash(i,3,7)*ph*.6;line([[qx,qy],[qx+Math.cos(a)*10,qy+Math.sin(a)*4]],2.5,'#e8b83a');}
      ctx.restore();
      line(closeP(rrP(BX-73,BY-122,146,122,16)),3.5,'#8fc8e8');line([[BX-58,BY-104],[BX-58,BY-44]],4,'#ffffff');
      if(win&&e>.3){poly([[BX-36,BY-122],[BX+36,BY-122],[BX+12,BY-154],[BX-12,BY-154]],'#f4fbff',3.5);rr(BX-32,BY-144,64,16,2,'#ffd23f',3);rr(BX-30,BY-84,60,30,4,'#ffffff',3);txt('$2.50',BX,BY-69,14,INK,0,true);}
      if(pasa){const ov=clamp((w-HI)/.34,0,1);ell(BX,BY+4,76+ov*96,30+ov*112,Q,4);for(let i=0;i<9;i++){const a=hash(i,4,7)*PI,qx=BX-90*ov+hash(i,5,7)*180*ov,qy=BY-hash(i,6,7)*90*ov;line([[qx,qy],[qx+Math.cos(a)*12,qy+Math.sin(a)*5]],2.5,'#e8b83a');}}
      /* la ponchera, en tus manos */
      ctx.save();ctx.translate(PX,PY);ctx.rotate(tilt);
      limb(-80,14,-200,76,36,TU.shirt,4);limb(-24,62,-150,150,36,TU.shirt,4);
      poly(arcPts(0,0,88,0,PI,12,.62),'#3aa86a',4.5);ell(0,0,88,24,'#5cd08a',4);ell(8,-2,66,15,Q,3);
      ell(-86,8,20,24,TU.skin,3.5);ell(-22,54,22,18,TU.skin,3.5);
      ctx.restore();
      for(const s of sh){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.r);rr(-6,-1.8,12,3.6,1,Q,1.5);ctx.restore();}
      if(!used&&!g.result){tag(86,300);for(let i=0;i<3;i++)txt('▼',BX,150+i*30+(now*60)%30,22,'#ffe14d');}
      /* te pasaste: la cartera, con su polilla */
      if(pasa&&e>1){const u=e-1,up=ease(clamp(u/.25,0,1));ctx.save();ctx.translate(140,650-up*140);
        limb(-20,60,-90,130,34,TU.shirt,4);ell(-14,50,20,22,TU.skin,3.5);rr(-64,-34,128,74,10,'#8a5a30',4.5);rr(-54,-26,108,30,5,'#5a3a22',3);txt('TRAES $2.50',0,22,15,'#fff3c4',0,true);ctx.restore();
        const mx=140+Math.sin(u*5)*46,my=478-u*120,f=Math.abs(Math.sin(now*34));for(const sg of[-1,1])ell(mx+sg*(4+9*f),my-3,10*f+2,8,'#d8d2c4',2.5);ell(mx,my,5,9,'#8f8fa8',2.5);}
      if(win&&e>.75)bubble(462,252,'¡OJO CLÍNICO!',24,594,296);
      if(pasa&&e>.75)bubble(448,252,'SON $4.25, MI REY',21,594,296);
      if(falta&&e>.75)bubble(446,252,'¡APÚRATE, QUE HAY COLA!',18,594,296);
      ctx.restore();line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('queso',{name:'¡PÉSALO!',mk:mkQueso,card:'EL QUESO',num:'5'});
})();
