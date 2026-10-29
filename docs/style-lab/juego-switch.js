'use strict';
/* MiniCaos · laboratorio de estilos: ¡PRENDE! (SE FUE LA LUZ: dale al switch hasta que llegue).
   Se fue la luz en la sala. La abuela alumbra el interruptor con una vela y tú le das al switch como loco, a ver si así
   vuelve: cada toque (en cualquier parte, o ESPACIO) lo voltea, arriba / abajo, y suma uno en el contador «n / hacen falta».
   A mitad de camino el bombillo AMAGA: parpadea medio segundo, todos se ilusionan... y se vuelve a ir. Hay que seguir dándole.
   Ganas: llegas a la cuenta, el bombillo prende de verdad y la sala se alumbra (¡LLEGÓ!).
   Pierdes: se acaba el tiempo y se quedan a oscuras (¡A OSCURAS!). No hay otra forma de perder.
   Toques que hacen falta: 11 a 13 en el nivel 1, 14 a 16 en el 2, 17 a 19 en el 3, en 5 s / √velocidad (igual que el original); el nivel 3 da 5.9 s por lo de la vela.
   El nivel sale de BUS.LV() (no de la velocidad: en el modo niveles el 3 corre casi a velocidad 1).
   Nivel 1: 11 a 13 toques y UN amago, por la mitad.
   Nivel 2: 14 a 16 toques y DOS amagos (como al 30 % y al 65 %).
   Nivel 3: 17 a 19 toques, los dos amagos y además, por la mitad, a la abuela se le APAGA LA VELA: todo queda más oscuro,
            sale «¡SE APAGÓ LA VELA!» y los toques al switch NO cuentan hasta que toques la vela (o FLECHA IZQUIERDA / A) para prenderla.
            La vela apagada se lee por la forma: sin llama, con humito, un aro que late y el letrero «¡TÓCALA!».
   El estado del switch se lee por la POSICIÓN de la palanca (y las marcas I / O), no por el color.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.switch)return;
const AP=BUS.AP,CONF=BUS.CONF,TU=BUS.TU,tag=BUS.tag,say=BUS.say;
const SX=372,SY=306,BX=476,BY=140,KX=512,KY=386,KS=.95,AX=168,AY=404,AS=.86,VX=AX+104,VY=AY-68,VR=70;   /* (VX, VY) = la vela en la mano de la abuela; VR = hasta dónde vale el toque */
/* la vela apagada (misma base que AP.vela): sin llama, el pabilo negro y torcido */
function velaApagada(x,y){rr(x-16,y,32,8,3,'#c4cad6',3);rr(x-7,y-34,14,36,3,'#fff6dc',3);line([[x,y-34],[x+1,y-41],[x+5,y-44]],2.5,'#14101c');}

/* el interruptor de pared: (x, y) = centro de la tapa; on = palanca arriba; h = 0..1, el golpe que le acaban de dar */
function interruptor(x,y,on,h){
  rr(x-46,y-70,92,140,12,'#fffdf2',4.5);ell(x,y-57,4,4,'#8f8fa8',2);ell(x,y+57,4,4,'#8f8fa8',2);
  txt('I',x-31,y-30,18,'#5a5274',0,true);txt('O',x-31,y+30,18,'#5a5274',0,true);
  rr(x-19,y-44,38,88,7,'#3b3550',3.5);
  const ly=y+(on?-40:2)+(on?1:-1)*h*5;
  rr(x-14,ly,28,38,6,'#e8e8ee',3.5);line([[x-7,ly+(on?10:28)],[x+7,ly+(on?10:28)]],3,'#8f8fa8');
  if(h>.45)for(let i=0;i<5;i++){const a=-1.9+i*.95;line([[x+Math.cos(a)*58,y+Math.sin(a)*82],[x+Math.cos(a)*74,y+Math.sin(a)*100]],4,'#ffffff');}}

/* ═════════ ¡PRENDE!: machaca el switch hasta que llegue la luz ═════════ */
function mkSwitch(){
  const rs=Math.sqrt(SP),lv=BUS.LV(),need=Math.round(11+(lv-1)*3+Math.random()*2);
  /* los amagos (uno en el nivel 1, dos desde el 2) y el toque en que se apaga la vela (solo nivel 3; -1 = nunca) */
  const teases=lv<2?[Math.round(need*(.4+Math.random()*.15))]:[Math.round(need*(.3+Math.random()*.08)),Math.round(need*(.62+Math.random()*.1))];
  const soplo=lv>2?Math.round(need*(.47+Math.random()*.06)):-1;
  let taps=0,on=false,hit=0,flash=0,lit=0,slump=0,fin=0,vela=true,vt=9,nove=0;
  function prende(){vela=true;vt=0;snd(900,.09,'triangle',.06,500);nz(.05,.05);spawn(VX,VY-24,6,'bit',['#ffb020','#fff3a8'],140,300,.4);say('¡YA!',VX,VY-84,'#ffe14d');}
  /* p = dónde tocaron (null si fue tecla); k = la tecla. Con la vela apagada solo vale tocar la vela (o 'left') */
  function dale(p,k){if(g.result)return;
    if(!vela){if(k==='left'||(p&&Math.hypot(p.x-VX,p.y-VY)<VR))prende();else if(k!=='right'){nove=1;snd(140,.07,'square',.04,-40);}return;}
    if(k==='left'||k==='right')return;
    on=!on;taps++;hit=1;snd(1500,.03,'square',.05,-700);nz(.03,.04);
    if(taps===soplo&&taps<need){vela=false;vt=0;nove=0;nz(.25,.07);snd(520,.3,'sine',.05,-380);say('¡FFFF!',VX,VY-84,'#ffffff');}
    if(teases.includes(taps)&&taps<need){flash=.55;slump=1.1;nz(.3,.08);snd(60,.35,'sawtooth',.06,-28);say('...',SX+90,SY-96,'#ffffff');}
    if(taps>=need){g.result='win';g.why='¡LLEGÓ!';sfx.win();snd(110,.5,'sawtooth',.05,110);nz(.9,.06);spawn(BX,BY+40,26,'conf',CONF);}}
  const g={get impact(){return this.result?clamp(1-this.endT/.5,0,1):flash>0?.4:0;},
    lr:lv>2,   /* nivel 3: la flecha izquierda (o A) prende la vela */
    probe:()=>({taps,need,tease:teases[0],teases,soplo,on,flash:flash>0,sw:{x:SX,y:SY},vela:{x:VX,y:VY,on:vela}}),
    t:0,dur:(lv>=3?5.9:5)/rs,result:null,why:'',endT:0,cmd:'¡PRENDE!',
    hint:lv>2?'TOCA RÁPIDO (o ESPACIO). Si se apaga la vela, TÓCALA (o FLECHA IZQUIERDA)':'TOCA RÁPIDO (o ESPACIO): dale al switch hasta que llegue la luz',
    press(k){dale(null,k);},
    down(p){dale(p);},
    update(dt){g.t+=dt;vt+=dt;nove=Math.max(0,nove-dt*2.2);hit=Math.max(0,hit-dt*7);flash=Math.max(0,flash-dt);slump=Math.max(0,slump-dt);
      lit+=((g.result==='win'?1:0)-lit)*Math.min(1,dt*9);
      if(g.result){fin+=dt;g.endT=fin;return;}
      if(g.t>=g.dur){g.result='lose';g.why='¡A OSCURAS!';sfx.lose();}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=fin,am=flash>0,apag=!vela&&!win;
      const L=clamp(lit+(am?(Math.sin(now*38)>-.2?.95:.35):0),0,1),sl=(slump>0&&!am&&!win)||lose,brinco=win?Math.abs(Math.sin(now*12))*12:0;
      ctx.save();path([[gameLeft(),0],[gameRight(),0],[gameRight(),576],[gameLeft(),576]]);ctx.clip();
      AP.sala({sin:'sofa ventana virgen'});   /* la pared del switch, despejada */
      interruptor(SX,SY,on,hit);
      AP.bombillo(BX,BY,L);
      /* la abuela, alumbrando el switch con la vela */
      bust(Object.assign({},AP.CAST.abuela,{x:AX,y:AY-38*AS-(win?Math.abs(Math.sin(now*11+1))*8:0),s:AS,th:120,legs:AP.PIES.abuela,look:1,
        mood:win?'happy':am?'o':lose?'angry':apag?'panic':'worry',talk:win&&e>.5?Math.abs(Math.sin(now*12)):0,
        arms:[{side:1,a:1.75,len:80,w:20,hand:(hx,hy)=>vela?AP.vela(hx,hy-10,1):velaApagada(hx,hy-10)},win?{side:-1,a:-2.6+Math.sin(now*11)*.2,len:70,w:20}:{side:-1,a:-.2,len:66,w:20}]}));
      /* tú, dándole a la palanca: la mano va adonde está la palanca y rebota con cada golpe */
      const tx=SX+26+hit*10,ty=SY+(on?-22:22)-hit*(on?-8:8),lx=(tx-KX)/KS+39,ly=(ty-KY)/KS-4;
      bust(Object.assign({},TU,{x:KX-hit*4,y:KY-brinco+(sl?6:0),s:KS,th:110,legs:['#2f3a7a','#ffffff',60],look:-1,rot:sl?.05:-hit*.03,
        mood:win?'happy':lose?'frown':am?'grin':apag?'panic':sl?'frown':hit>.3?'o':'worry',sweat:win?0:taps>2?2:1,lids:sl?1:0,
        arms:win?[{side:-1,a:-2.6+Math.sin(now*12)*.25,len:78,w:20},{side:1,a:2.6+Math.sin(now*12)*.25,len:78,w:20}]
          :[{side:-1,a:Math.atan2(lx,ly),len:Math.hypot(lx,ly),w:20},{side:1,a:.25,len:74,w:20}]}));
      /* la noche encima: el charco de la vela y el del bombillo, que crece con la luz */
      /* vela apagada (nivel 3): más noche y apenas un resplandorcito donde quedó, para poder encontrarla */
      AP.oscuro(.86-.84*L+(vela?0:.1*(1-L)),[{x:BX,y:BY+40,r:720*L,c:'#ffde96'},vela?{x:AX+105,y:AY-58,r:lerp(60,214,clamp(vt/.18,0,1))+Math.sin(now*17)*5,c:'#ffaa46'}:{x:VX,y:VY,r:58}]);
      if(apag&&!lose){const pu=VR*(.82+Math.sin(now*14)*.08);
        for(let i=0;i<3;i++){const u=(now*.9+i/3)%1;ctx.save();ctx.globalAlpha=.75*(1-u);ell(VX+Math.sin(u*6+i*2)*9,VY-40-u*54,5+u*8,5+u*8,'#d8d8e4',0);ctx.restore();}   /* el humito */
        line(closeP(ellP(VX,VY,pu,pu,22)),4.5,'#ffe14d');
        txt('¡TÓCALA!',VX,VY+VR+26,24,'#ffe14d',-.04);
        txt('¡SE APAGÓ LA VELA!',SX+30,SY-52,30,'#ff4d5e',-.04+Math.sin(now*20)*.015);
        if(nove>0)txt('¡NO SE VE!',SX+96,SY+52,22,'#ffffff',.06);}
      /* lo que se lee a oscuras: el contador, el TÚ y lo que dice la abuela */
      if(!g.result&&g.t<1.1/rs)tag(KX,KY-136);
      txt(Math.min(taps,need)+' / '+need,SX,SY-112,32,'#ffffff');
      if(am)txt('¿LLEGÓ?',SX+6,SY-160,26,'#ffe14d',-.05);
      if(win&&e>.5)bubble(186,244,'¡BENDITO SEA DIOS!',18,180,304);
      if(lose&&e>.4)bubble(186,244,'¡OTRA NOCHE CON VELA!',17,180,304);
      ctx.restore();line([[gameLeft(),576],[gameRight(),576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('switch',{name:'¡PRENDE!',mk:mkSwitch,card:'EL SWITCH',num:'21'});
})();
