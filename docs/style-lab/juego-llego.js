'use strict';
/* MiniCaos · laboratorio de estilos: ¡LLEGÓ LA LUZ! (SE FUE LA LUZ: el grito del barrio).
   El barrio a oscuras y los vecinos esperando en la calle, con sus velitas. En cualquier momento vuelve la luz y hay que ser
   el PRIMERO en gritarlo: un toque (o ESPACIO) DESPUÉS de que llegue y antes de que otro se te adelante (1.4 s de gracia).
   Tocar antes = ¡MUY PRONTO!: gritaste solo y todos se te quedan viendo. No tocar a tiempo = ¡TARDE!: lo gritó el tío.
   La trampa: 7 de cada 10 veces, un pelín antes parpadean unas ventanas (0.14 s) y se vuelven a apagar. Eso NO es la luz.
   La luz de verdad no se confunde: se prenden las ventanas y el farol (con sus rayos), se levanta la noche y hay un fogonazo.
   Tiempos del original (apGrita en js/games/ap1.js): llega a los 1.5–2.9 s, amago 0.55–0.85 s antes, todo entre raíz de SP.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.llego)return;
const CONF=BUS.CONF,TU=BUS.TU,tag=BUS.tag,AP=BUS.AP,C=AP.CAST,FY=552,LX=532,LY=252,POSTE='#5a5274';
/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;
/* los vecinos en fila: [cara, x, escala, piernas, de qué lado tiene la velita]: abuela, mamá, TÚ, el tío y Chuo (el elenco del mundo Venezuela) */
const GENTE=[[C.abuela,95,.58,['#6b4a8a','#3b2a22',74],1],[C.mama,240,.62,AP.PIES.mama,-1],[TU,400,.86,['#2f3a7a','#ffffff',60],0],
  [C.tio,565,.6,['#5a5274','#3b2a22',60],1],[C.chuo,705,.62,['#3b6ea8','#fffdf2',60],-1]];
/* los gritos del final: [texto, x, y, tamaño, a quién apunta (x, y)] */
const GRITOS=[['¡LLEGÓ!',400,230,26,400,292],['¡AL FIN!',152,316,20,108,372],['¡COÑO!',648,316,20,588,372]];
const globo=(s,x,y,sz,tx,ty,k)=>{const e=1+(1-clamp(k,0,1))*.5;ctx.save();ctx.translate(x,y);ctx.scale(e,e);ctx.globalAlpha=clamp(k*2,0,1);bubble(0,0,s,sz,(tx-x)/e,(ty-y)/e);ctx.restore();};

/* el farol de la calle: L = cuánto alumbra. Prendido tiene cono de luz y rayos (no solo cambia de color) */
function farol(L){
  if(L>.05){ctx.save();ctx.globalAlpha=.22*L;poly([[LX-14,LY+6],[LX+14,LY+6],[LX+124,FY+12],[LX-124,FY+12]],'#fff3a8',0);ctx.globalAlpha=.4*L;ell(LX,LY+4,44,44,'#fff3a8',0);ctx.restore();
    for(let i=0;i<8;i++){const a=i/8*TAU+now*.7,r0=28,r1=42+L*8+Math.sin(now*9+i)*3;line([[LX+Math.cos(a)*r0,LY+4+Math.sin(a)*r0],[LX+Math.cos(a)*r1,LY+4+Math.sin(a)*r1]],4.5,'#ffe14d');}}
  rr(476,546,26,14,3,'#3b3550',3);rr(484,224,10,324,3,POSTE,3);line([[489,228],[506,212],[LX,224]],7,POSTE);
  rr(LX-24,LY-26,48,16,6,'#3b3550',3);ell(LX,LY,15,13,L>.5?'#fff3a8':'#6b6880',3.5);}

/* ═════════ ¡LLEGÓ LA LUZ!: grita apenas llegue, ni antes ni tarde ═════════ */
function mkLlego(){
  const rs=Math.sqrt(SP),T=(1.5+Math.random()*1.4)/rs,fake=Math.random()<.7?T-(.55+Math.random()*.3)/rs:-9,GR=1.4/rs;
  let on=false,shout=0,fin=0;
  const amago=()=>g.t>fake&&g.t<fake+.14;
  function grita(){if(g.result)return;shout=1;
    if(g.t<T){g.result='lose';g.kind='pronto';g.why='¡MUY PRONTO!';snd(520,.25,'sawtooth',.08,-300);sfx.lose();return;}
    g.result='win';g.why='¡LLEGÓ!';sfx.win();nz(.9,.07);spawn(400,300,30,'conf',CONF);
    [660,800,940,1080,1220].forEach((f,i)=>setTimeout(()=>{snd(f,.4,'triangle',.05);snd(f*1.51,.3,'sine',.03);},i*110));}   /* las ollas */
  const g={get impact(){return this.result?clamp(1-fin/.5,0,1):on?clamp(1-(this.t-T)/.3,0,1)*.7:0;},
    probe:()=>({T,fake,grace:GR,on,amago:amago(),kind:g.kind}),
    t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,cmd:'¡GRITA!',
    hint:'TOCA (o ESPACIO) apenas LLEGUE LA LUZ… ¡no antes!',
    press(){grita();},
    down(){grita();},
    update(dt){g.t+=dt;shout=Math.max(0,shout-dt*3);
      if(!on&&g.t>=T){on=true;nz(.45,.16);snd(90,.55,'sine',.28,-60);snd(110,.5,'sawtooth',.05,110);   /* ¡PUM! y el zumbido del transformador */
        if(!g.result)spawn(LX,LY,12,'★',['#ffe14d','#ffffff'],300,500,.7);}
      if(!g.result){if(g.t>T+GR){g.result='lose';g.kind='tarde';g.why='¡TARDE!';sfx.lose();}return;}
      fin+=dt;g.endT=sello(fin);},
    draw(){
      const win=g.result==='win',pronto=g.kind==='pronto',tarde=g.kind==='tarde',e=fin,fl=amago();
      const luz=on?clamp((g.t-T)/.8,0,1):0,noche=on?.6*(1-clamp((g.t-T)/.25,0,1)):.6;
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      AP.barrio(fl?.18:luz);
      farol(on?clamp((g.t-T)/.15,0,1):0);
      /* los vecinos, cada uno con su velita en el piso */
      GENTE.forEach(([f,x,s,legs,sd],i)=>{const yo=i===2;
        if(sd)AP.vela(x+sd*40,FY+4,.7);
        const up=yo?win||shout>.1:win||tarde||(luz>.3&&!pronto),yell=(yo&&shout>.1)||(win&&e>i*.08)||(tarde&&i===3);
        const bob=win||yell?Math.abs(Math.sin(now*11+i*1.3))*(win?16:8):0,a=up?2.6+Math.sin(now*12+i)*.2:.15;
        bust(Object.assign({},f,{x,y:FY-(110+legs[2])*s-bob,s,th:50+legs[2],legs,vein:0,look:pronto&&!yo?Math.sign(400-x):0,
          mood:win?'happy':yell?'yell':pronto?(yo?'worry':'o'):tarde&&yo?'frown':up?'grin':on?'happy':yo?'worry':'calm',
          talk:yell?.4+.6*Math.abs(Math.sin(now*14+i)):0,sweat:yo&&pronto?2:yo&&!on?1:0,lids:yo&&tarde?1:0,
          arms:[{side:1,a,len:78,w:20},{side:-1,a:-a,len:78,w:20}]}));});
      /* la noche encima, con el charquito de luz de cada vela */
      AP.oscuro(noche,GENTE.filter(q=>q[4]).map(([,x,,,sd])=>({x:x+sd*36,y:514,r:72,c:'#ffb040'})));
      /* el fogonazo: llegó de verdad */
      if(on&&!pronto&&g.t-T<.35){ctx.save();ctx.globalAlpha=.8*(1-(g.t-T)/.35);rr(0,0,800,576,0,'#fff8d0',0);ctx.restore();}
      if(!g.result){tag(400,284);
        if(!on&&!fl&&g.t>.2){ctx.save();ctx.globalAlpha=.6+Math.sin(now*5)*.3;txt('...',400,130,46,'#ffffff');ctx.restore();}}
      if(win)GRITOS.forEach(([s,x,y,sz,tx,ty],i)=>{const k=(e-.15-i*.18)*6;if(k>0)globo(s,x,y,sz,tx,ty,k);});
      if(pronto&&e>.15)globo('¿...?',262,314,26,248,370,(e-.15)*6);
      if(pronto&&e>.5)globo('¿...?',600,316,22,572,372,(e-.5)*6);
      if(tarde&&e>.1)globo('¡LLEGÓ!',612,312,24,572,370,(e-.1)*6);
      ctx.restore();line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('llego',{name:'¡LLEGÓ LA LUZ!',mk:mkLlego,card:'LA LUZ',num:'27'});
})();
