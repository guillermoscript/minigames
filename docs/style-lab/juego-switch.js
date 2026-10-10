'use strict';
/* MiniCaos · laboratorio de estilos: ¡PRENDE! (SE FUE LA LUZ: dale al switch hasta que llegue).
   Se fue la luz en la sala. La abuela alumbra el interruptor con una vela y tú le das al switch como loco, a ver si así
   vuelve: cada toque (en cualquier parte, o ESPACIO) lo voltea, arriba / abajo, y suma uno en el contador «n / hacen falta».
   A mitad de camino el bombillo AMAGA: parpadea medio segundo, todos se ilusionan... y se vuelve a ir. Hay que seguir dándole.
   Ganas: llegas a la cuenta, el bombillo prende de verdad y la sala se alumbra (¡LLEGÓ!).
   Pierdes: se acaba el tiempo y se quedan a oscuras (¡A OSCURAS!). No hay otra forma de perder.
   Toques que hacen falta: 11 a 13 en el nivel 1, 14 a 16 en el 2, 17 a 19 en el 3, siempre en 5 s / √velocidad (igual que el original).
   El estado del switch se lee por la POSICIÓN de la palanca (y las marcas I / O), no por el color.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.switch)return;
const AP=BUS.AP,CONF=BUS.CONF,TU=BUS.TU,tag=BUS.tag,say=BUS.say;
const SX=372,SY=306,BX=476,BY=140,KX=512,KY=386,KS=.95,AX=168,AY=404,AS=.86;

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
  const rs=Math.sqrt(SP),need=Math.round(11+(SP-1)*7+Math.random()*2),tease=Math.round(need*(.4+Math.random()*.15));
  let taps=0,on=false,hit=0,flash=0,lit=0,slump=0,fin=0;
  function dale(){if(g.result)return;
    on=!on;taps++;hit=1;snd(1500,.03,'square',.05,-700);nz(.03,.04);
    if(taps===tease&&taps<need){flash=.55;slump=1.1;nz(.3,.08);snd(60,.35,'sawtooth',.06,-28);say('...',SX+90,SY-96,'#ffffff');}
    if(taps>=need){g.result='win';g.why='¡LLEGÓ!';sfx.win();snd(110,.5,'sawtooth',.05,110);nz(.9,.06);spawn(BX,BY+40,26,'conf',CONF);}}
  const g={get impact(){return this.result?clamp(1-this.endT/.5,0,1):flash>0?.4:0;},
    probe:()=>({taps,need,tease,on,flash:flash>0,sw:{x:SX,y:SY}}),
    t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡PRENDE!',
    hint:'TOCA RÁPIDO (o ESPACIO): dale al switch hasta que llegue la luz',
    press(){dale();},
    down(){dale();},
    update(dt){g.t+=dt;hit=Math.max(0,hit-dt*7);flash=Math.max(0,flash-dt);slump=Math.max(0,slump-dt);
      lit+=((g.result==='win'?1:0)-lit)*Math.min(1,dt*9);
      if(g.result){fin+=dt;g.endT=fin;return;}
      if(g.t>=g.dur){g.result='lose';g.why='¡A OSCURAS!';sfx.lose();}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=fin,am=flash>0;
      const L=clamp(lit+(am?(Math.sin(now*38)>-.2?.95:.35):0),0,1),sl=(slump>0&&!am&&!win)||lose,brinco=win?Math.abs(Math.sin(now*12))*12:0;
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      AP.sala({sin:'sofa ventana virgen'});   /* la pared del switch, despejada */
      interruptor(SX,SY,on,hit);
      AP.bombillo(BX,BY,L);
      /* la abuela, alumbrando el switch con la vela */
      bust(Object.assign({},AP.CAST.abuela,{x:AX,y:AY-38*AS-(win?Math.abs(Math.sin(now*11+1))*8:0),s:AS,th:120,legs:AP.PIES.abuela,look:1,
        mood:win?'happy':am?'o':lose?'angry':'worry',talk:win&&e>.5?Math.abs(Math.sin(now*12)):0,
        arms:[{side:1,a:1.75,len:80,w:20,hand:(hx,hy)=>AP.vela(hx,hy-10,1)},win?{side:-1,a:-2.6+Math.sin(now*11)*.2,len:70,w:20}:{side:-1,a:-.2,len:66,w:20}]}));
      /* tú, dándole a la palanca: la mano va adonde está la palanca y rebota con cada golpe */
      const tx=SX+26+hit*10,ty=SY+(on?-22:22)-hit*(on?-8:8),lx=(tx-KX)/KS+39,ly=(ty-KY)/KS-4;
      bust(Object.assign({},TU,{x:KX-hit*4,y:KY-brinco+(sl?6:0),s:KS,th:110,legs:['#2f3a7a','#ffffff',60],look:-1,rot:sl?.05:-hit*.03,
        mood:win?'happy':lose?'frown':am?'grin':sl?'frown':hit>.3?'o':'worry',sweat:win?0:taps>2?2:1,lids:sl?1:0,
        arms:win?[{side:-1,a:-2.6+Math.sin(now*12)*.25,len:78,w:20},{side:1,a:2.6+Math.sin(now*12)*.25,len:78,w:20}]
          :[{side:-1,a:Math.atan2(lx,ly),len:Math.hypot(lx,ly),w:20},{side:1,a:.25,len:74,w:20}]}));
      /* la noche encima: el charco de la vela y el del bombillo, que crece con la luz */
      AP.oscuro(.86-.84*L,[{x:BX,y:BY+40,r:720*L,c:'#ffde96'},{x:AX+105,y:AY-58,r:214+Math.sin(now*17)*5,c:'#ffaa46'}]);
      /* lo que se lee a oscuras: el contador, el TÚ y lo que dice la abuela */
      if(!g.result&&g.t<1.1/rs)tag(KX,KY-136);
      txt(Math.min(taps,need)+' / '+need,SX,SY-112,32,'#ffffff');
      if(am)txt('¿LLEGÓ?',SX+6,SY-160,26,'#ffe14d',-.05);
      if(win&&e>.5)bubble(186,244,'¡BENDITO SEA DIOS!',18,180,304);
      if(lose&&e>.4)bubble(186,244,'¡OTRA NOCHE CON VELA!',17,180,304);
      ctx.restore();line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('switch',{name:'¡PRENDE!',mk:mkSwitch,card:'EL SWITCH',num:'21'});
})();
