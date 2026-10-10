'use strict';
/* MiniCaos · laboratorio de estilos: ¡CIERRA LA NEVERA! (SE FUE LA LUZ, el apFridge de js/games/ap1.js).
   Se fue la luz y la puerta de la nevera se empeña en abrirse: se sale el frío y se daña la comida. El tío le recuesta todo
   el peso, pero el que empuja eres tú: TOCA RÁPIDO (o ESPACIO), cada toque la cierra un poquito (-0.13).
   La puerta arranca en 0.3 y se abre sola (0.3 por segundo, más rápido con la velocidad); dos veces le da un jalón de medio
   segundo (x1.7: la puerta tiembla y sale «¡SE ABRE!»). Si llega a 1 = ¡SE DESCONGELÓ!; si aguantas hasta que se acabe
   el reloj (5 s / raíz de la velocidad) = ¡SALVADO!
   El peligro se lee en la puerta misma (se ve la comida, sale el frío, crece el charco) y además hay una barrita «ABIERTA».
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.nevera)return;
const AP=BUS.AP,CONF=BUS.CONF,TIO=AP.CAST.tio,FX=150,HR=380,W=230,TOP=96,MID=214,BOT=520,BL='#eef1f6',GR='#8f8fa8';
/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;

/* lo que hay adentro: caraotas, queso, refresco, salsa, huevos, pernil, lechuga y la gaveta */
function adentro(){
  rr(FX,MID,W,BOT-MID,6,'#d6f1fa',3.5);
  for(const y of[292,372,448])line([[FX+4,y],[HR-4,y]],4,'#8fbfd4');
  rr(166,250,74,40,8,GR,3.5);rr(160,242,86,10,4,'#c9ced6',3);ell(203,238,7,5,'#3b3550',2.5);
  poly([[256,290],[318,290],[318,254]],'#ffd23f',3.5);ell(302,280,4,4,'#e0a800',0);
  rr(168,318,22,54,6,'#4fd06a',3.5);rr(173,306,12,14,3,'#4fd06a',3);rr(198,330,22,42,6,'#e8553d',3.5);
  for(let i=0;i<3;i++)ell(248+i*26,359,11,13,'#fffdf2',3);
  rr(168,408,92,40,14,'#ff9aa8',3.5);ell(188,428,9,9,'#fffdf2',2.5);ell(298,428,24,20,'#6ecf5a',3.5);
  rr(FX+10,458,W-20,52,6,'#a6d8ea',3.5);rr(FX+80,470,70,10,4,BL,2.5);}
/* la nevera: bisagra a la derecha (x=HR); op = cuánto se abrió la puerta de abajo. Devuelve la x del borde libre */
function nevera(op,jit){
  const c=Math.max(.04,1-.8*op),s=Math.sqrt(1-c*c),e=HR-W*c+jit,d=34*s,th=14*s;
  rr(FX-7,TOP-7,W+14,BOT-TOP+12,12,'#aeb4c2',4.5);rr(FX+8,BOT+5,30,12,3,'#3b3550',3);rr(HR-38,BOT+5,30,12,3,'#3b3550',3);
  adentro();
  rr(FX,TOP,W,MID-TOP-6,8,BL,4);rr(FX+14,150,10,40,4,GR,3);
  rr(HR-74,116,36,42,2,'#fff3a8',2.5);ell(HR-56,118,6,6,'#e8293f',2.5);line([[HR-66,134],[HR-46,134]],2,GR);line([[HR-66,144],[HR-50,144]],2,GR);
  if(th>1)poly([[e-th,MID-d*.35+3],[e,MID-d*.35],[e,BOT+d],[e-th,BOT+d-5]],GR,3.5);          /* el canto de la puerta */
  poly([[HR,MID],[e,MID-d*.35],[e,BOT+d],[HR,BOT]],BL,4.5);
  rr(e+6+16*c,300-d*.2,8+4*c,84+d*.4,4,GR,3);
  return e;}

/* ═════════ ¡CIERRA LA NEVERA!: toca rápido hasta que se acabe el reloj ═════════ */
function mkNevera(){
  const rs=Math.sqrt(SP),drift=.3+(SP-1)*.2,surges=[(Math.random()*1.2+.8)/rs,(Math.random()*1.2+2.4)/rs];
  let o=.3,shove=0,taps=0,sg=false,fin=0,charco=0,gota=0;
  const surge=()=>surges.some(s=>g.t>s&&g.t<s+.5);
  function dale(){if(g.result)return;o=Math.max(0,o-.13);shove=1;taps++;sfx.thud();
    spawn(HR-W*(1-.8*o)+10,360,2,'bit',['#cfeaf0','#ffffff'],150,500,.35);}
  const g={get impact(){return this.result?clamp(1-fin/.5,0,1):sg?.25:0;},
    probe:()=>({o,taps,surge:sg}),
    t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡CIERRA LA NEVERA!',
    hint:'TOCA RÁPIDO (o ESPACIO): mantén la nevera cerrada hasta que se acabe el tiempo',
    press(){dale();},
    down(){dale();},
    update(dt){g.t+=dt;shove=Math.max(0,shove-dt*6);
      if(!g.result){const was=sg;sg=surge();charco=clamp(g.t/g.dur,0,1);
        if(sg&&!was){snd(170,.35,'sawtooth',.05,140);nz(.2,.06);}
        if(o>.2&&(gota-=dt)<=0){gota=.5-.3*o;snd(1400,.04,'sine',.03,-500);}
        o+=drift*rs*(sg?1.7:1)*dt;
        if(o>=1){o=1;sg=false;g.result='lose';g.why='¡SE DESCONGELÓ!';sfx.crash();sfx.lose();}
        else if(g.t>=g.dur){sg=false;g.result='win';g.why='¡SALVADO!';sfx.thud();sfx.win();spawn(300,300,24,'conf',CONF);}
        return;}
      fin+=dt;g.endT=sello(fin);
      if(g.result==='win')o=lerp(o,0,Math.min(1,dt*16));
      else{o=Math.min(1.2,o+dt*1.4);charco=Math.min(1.6,charco+dt*.5);}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e0=fin,k=clamp(o,0,1);
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      /* la cocina: el bombillo apagado, el mesón con la vela y la olla */
      AP.cocina(true);AP.bombillo(470,118,0);
      rr(540,342,270,134,6,'#b5805a',4);rr(528,326,290,18,4,'#e8e8ee',3.5);
      for(const x of[556,676]){rr(x,362,104,96,4,'#c9966c',3);ell(x+52,378,5,5,'#5a5274',2.5);}
      rr(700,292,64,34,6,'#5a5274',3.5);rr(692,286,80,9,4,GR,3);
      AP.vela(626,326,1.25);
      /* el charco, la nevera, las gotas y el frío que se sale */
      ell(FX+76,546,56+86*charco,8+7*charco,'#9fdcff',2.5);
      const e=nevera(o,sg||(k>.6&&!g.result)?Math.sin(now*40)*(sg?4:1.5):0),gap=e-FX;
      if(k>.15)for(let i=0;i<3;i++){const u=(now*1.3+i/3)%1;ell(FX+26+i*(gap-30)/3,lerp(BOT-4,544,u*u),3.5,6,'#9fdcff',2.5);}
      if(k>.12){ctx.save();for(let i=0;i<6;i++){const u=(now*.6+i/6)%1;ctx.globalAlpha=.5*k*(1-u*.6);ell(FX+gap*.5-u*90+i*7,BOT+8-i*15,24+u*40,9+u*13,'#e6faff',0);}ctx.restore();}
      /* el tío: todo el peso contra el borde de la puerta */
      const S=1.05,bw=TIO.bw||54,X=e+118-(g.result?0:shove*9),Y=372+(win?-Math.abs(Math.sin(now*10))*12:lose?8:Math.sin(now*18)*(1+k*2)),rot=win?0:lose?.22:-.14-shove*.08+k*.08;
      const brazo=(side,wx,wy)=>{const lx=(wx-X)/S,ly=(wy-Y)/S,cr=Math.cos(rot),sr=Math.sin(rot),dx=lx*cr+ly*sr-side*bw*.78,dy=-lx*sr+ly*cr-4;
        return{side,a:Math.atan2(dx,dy),len:clamp(Math.hypot(dx,dy),30,150),w:20,col:TIO.skin};};
      const arriba=sgn=>({side:sgn,a:sgn*(2.6+Math.sin(now*(win?12:26))*.22),len:76,w:20,col:TIO.skin});
      bust(Object.assign({},TIO,{x:X,y:Y,s:S,rot,th:110,legs:['#5a6fa8','#3b2a22',60],look:g.result?0:-1,
        mood:win?'grin':lose?'yell':k>.66||sg?'panic':shove>.4?'angry':'worry',talk:lose?.6+.4*Math.sin(now*22):0,sweat:win?0:k>.5?2:1,
        arms:g.result?[arriba(1),arriba(-1)]:[brazo(1,e+32,404),brazo(-1,e+22,322)]}));
      ctx.restore();
      /* la noche encima: la luz de la vela y el resplandor frío de la nevera abierta */
      AP.oscuro(.55,[{x:626,y:268,r:215,c:'#ffb060'},{x:FX+gap*.5,y:372,r:gap<6?0:50+gap*1.15,c:'#9fdcff'}]);
      /* lo que se lee a través de la oscuridad */
      if(sg&&Math.sin(now*24)>-.3)txt('¡SE ABRE!',264,156,30,'#ff4d5e',-.08+Math.sin(now*30)*.03);
      if(!g.result){rr(548,506,236,52,14,'#2d2640',4);txt('ABIERTA',606,533,16,'#ffffff',0,true);
        rr(660,522,112,20,6,'#14101c',0);if(k>.02)rr(663,525,106*k,14,4,k>.66?(Math.sin(now*26)>0?'#ff4d5e':'#fff3a8'):'#ffd23f',0);
        line([[663+106*.66,518],[663+106*.66,546]],2.5,'#ffffff');}
      if(win&&e0>.75)bubble(520,300,'¡SE SALVÓ EL QUESO!',20,X+62,Y-70);
      if(lose&&e0>.5)bubble(600,180,'¡AY, MI PERNIL!',22,X+40,Y-110);
      line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('nevera',{name:'¡LA NEVERA!',mk:mkNevera,card:'LA NEVERA',num:'22'});
})();
