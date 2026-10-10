'use strict';
/* MiniCaos · laboratorio de estilos: ¡ENCHUFA! (el teléfono en 3% y la regleta que se bambolea). SE FUE LA LUZ, juego 4.
   Se fue la luz y al teléfono le queda 3%. Del techo cuelga una regleta floja (la del vecino con planta) que se bambolea
   de lado a lado: hay que llevar el enchufe del cargador hasta la toma y soltarlo JUSTO cuando las patas coincidan con
   los dos huecos. Pelar la toma = corrientazo (¡BZZT!) y se van 0.45 s de reloj. El porcentaje baja 3 → 2 → 1 con el reloj:
   si se acaba, 0% y te quedas a oscuras de verdad.
   Dura 5 s (entre raíz de la velocidad); la regleta se mece más rápido en cada velocidad, igual que el original (apBattery).
   Puntero: mientras aprietas, el enchufe sigue al dedo; al SOLTAR intenta enchufar ahí. La punta de las patas queda TIP px
   por encima del dedo. Teclado: flechas = mueven el enchufe 50 px, ESPACIO = enchufa.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.enchufa)return;
const CONF=BUS.CONF,TU=BUS.TU,tag=BUS.tag,AP=BUS.AP,PI=Math.PI,TIP=26,RAD=38,PEN=.45,PH=[228,350],CABLE='#eef1f6',CHISPA='#7ae8ff';

/* el enchufe del cargador: (x, y) = centro; la punta de las patas queda en y-TIP. met = ya está metido (sin patas) */
function enchufe(x,y,met){ctx.save();ctx.translate(x,y);
  if(!met)for(const sg of[-1,1])rr(sg*9-3.5,-TIP,7,24,2,'#c9ced6',2.5);
  rr(-5,30,10,12,3,CABLE,2.5);rr(-18,-6,36,40,8,'#ffffff',4);rr(-10,4,20,5,2,'#c9ced6',0);rr(-10,14,20,5,2,'#c9ced6',0);
  ctx.restore();}
/* la regleta que cuelga: (x, y) = centro de la toma (ahí va la punta del enchufe) */
function regleta(x,y,rot){
  const x0=x*.45+220,cu=[];for(let i=0;i<=8;i++){const u=i/8;cu.push([lerp(x0,x,u)+Math.sin(u*PI)*(x-400)*.1,lerp(0,y-34,u)]);}
  line(cu,7,INK);line(cu,3,'#ff9a3d');
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  rr(-38,-36,76,72,12,'#fff6dc',4.5);rr(-28,-26,56,52,8,'#e8dcc0',2.5);
  for(const sg of[-1,1])rr(sg*9-4.5,-15,9,28,2,'#14101c',0);ell(0,20,3.5,3.5,'#14101c',0);
  ctx.restore();}
/* la pila gigante al lado del teléfono: n rayitas llenas y el número (no depende del color) */
function pila(pct,n,rojo,rayo){const x=246,y=262,col=rojo?'#ff5c5c':'#5cff7a';
  rr(x,y,84,40,8,'#14101c',4);rr(x+84,y+11,8,18,3,'#14101c',3);
  for(let i=0;i<3;i++)rr(x+8+i*24,y+8,20,24,3,i<n?col:'#3b3550',0);
  if(rayo)poly([[x+46,y-8],[x+28,y+22],[x+41,y+22],[x+36,y+48],[x+58,y+16],[x+44,y+16]],'#ffe14d',3.5);
  txt(pct+'%',x+42,y-32,46,rojo?'#ff8a8a':'#ffffff');}

/* ═════════ ¡ENCHUFA!: la toma se bambolea; suelta el enchufe cuando coincida ═════════ */
function mkEnchufa(){
  const rs=Math.sqrt(SP),D=5/rs,ph=Math.random()*6.28,sx=1.5+(SP-1)*.6,sy=1.1+(SP-1)*.4;
  let px=400,py=420,c=0,zap=0,cool=0,miss=0,plugged=false,ag=false;
  /* dónde está la toma a los c segundos (c no lleva los castigos: la regleta no salta cuando pelas) */
  const oAt=c=>({x:400+Math.sin(c*sx+ph)*220,y:250+Math.sin(c*sy*1.3+ph*2)*60});
  const pon=p=>{px=clamp(p.x,0,800);py=clamp(p.y,120,548);};
  function enchufa(){if(g.result||cool>0)return;
    const o=oAt(c),d=Math.hypot(px-o.x,py-TIP-o.y);
    if(d<RAD){g.result='win';g.why='¡CARGANDO!';plugged=true;snd(1900,.05,'square',.08);snd(240,.12,'sine',.2,-80);setTimeout(()=>sfx.win(),140);spawn(o.x,o.y,24,'conf',CONF);}
    else{zap=1;cool=.3;miss++;g.t+=PEN;nz(.25,.09);snd(60,.3,'sawtooth',.07);spawn(px,py-TIP,7,'bit',[CHISPA,'#ffffff'],190,400,.4);BUS.say('¡BZZT!',px,py-64,CHISPA);}}
  const g={lr:true,get impact(){return this.result?clamp(1-this.endT/.5,0,1):zap*.5;},
    /* x, y = la toma AHORA; tip = cuánto más abajo hay que soltar (el dedo va en y+tip); r = tolerancia; en(dt) = la toma dentro de dt s */
    probe:()=>Object.assign(oAt(c),{tip:TIP,r:RAD,px,py,cool,miss,pen:PEN,paso:50,en:dt=>oAt(c+dt)}),
    t:0,dur:D,result:null,why:'',endT:0,cmd:'¡ENCHUFA!',
    hint:'ARRASTRA el enchufe y SUÉLTALO cuando coincida con la toma (o flechas y ESPACIO)',
    press(k){if(g.result)return;
      const d={left:[-50,0],right:[50,0],up:[0,-50],down:[0,50]}[k];
      if(d)pon({x:px+d[0],y:py+d[1]});else enchufa();},
    down(p){if(g.result)return;ag=true;pon(p);},
    move(p){if(ag&&!g.result)pon(p);},
    up(p){if(!ag)return;ag=false;if(g.result)return;pon(p);enchufa();},
    update(dt){zap=Math.max(0,zap-dt*3);cool=Math.max(0,cool-dt);
      if(g.result){g.endT+=dt;return;}
      g.t+=dt;c+=dt;
      if(g.t>=g.dur){g.result='lose';g.why='¡0%!';ag=false;sfx.lose();}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,o=oAt(c),left=Math.max(0,g.dur-g.t);
      const pct=win?3+(e>1.1?1:0):lose?0:Math.max(1,Math.ceil(left/g.dur*3)),rojo=!win&&pct<=1;
      const ptx=plugged?o.x:px,pty=plugged?o.y-8:py,muere=lose?clamp(e/.35,0,1):0;
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      AP.sala({sin:'ventilador tele florero'});AP.bombillo(612,140,0);   /* la sala de ¡CHANCLA!: sin el ventilador (ahí cuelga la regleta) ni la tele y el florero (ahí estás tú) */
      regleta(o.x,o.y,g.result?0:Math.cos(c*sx+ph)*.16);
      /* tú, con el teléfono en alto */
      bust(Object.assign({},TU,{x:130+(zap>0?Math.sin(now*60)*3*zap:0),y:386,s:.95,th:110,legs:['#2f3a7a','#ffffff',60],look:1,
        mood:win?'happy':lose?(e>.5?'frown':'yell'):zap>.3?'yell':rojo?'panic':'worry',talk:lose&&e<.5?1:0,sweat:win?0:rojo?2:1,
        arms:[{side:1,a:1.97,len:66,w:20},{side:-1,a:win?-2.5+Math.sin(now*11)*.25:-.15,len:80,w:20}]}));
      BUS.phone(PH[0],PH[1],.12,1.25);
      if(muere>0){ctx.save();ctx.translate(PH[0],PH[1]);ctx.rotate(.12);ctx.scale(1.25,1.25);ctx.globalAlpha=muere;rr(-10,-19,20,34,3,'#14101c',0);ctx.restore();}
      /* la noche: la velita de la Virgen, un charco azulado en la toma y uno verdoso en el teléfono (que se apaga con el 0%) */
      AP.oscuro(.86,[{x:AP.VIRGEN.x,y:AP.VIRGEN.y,r:64,c:'#ffb020'},{x:o.x,y:o.y,r:220,c:'#78e6ff'},{x:PH[0],y:PH[1],r:150*(1-muere)+(win?40:0),c:'#8cffa0'}]);
      /* lo que se tiene que leer a oscuras: dónde va la punta, la pila, el cable y el enchufe */
      if(!g.result){tag(130,262);ctx.save();ctx.globalAlpha=.5+.35*Math.sin(now*9);line(closeP(ellP(o.x,o.y,RAD+4,RAD+4,18)),3.5,'#ffe14d');ctx.restore();}
      ctx.save();if(rojo&&!lose)ctx.globalAlpha=.6+.4*Math.sin(now*16);
      pila(pct,win?1+Math.floor(now*4)%3:pct,rojo,win);ctx.restore();
      const hx=PH[0]+3,hy=PH[1]+30,bx=ptx,by=pty+40,cab=[];
      for(let i=0;i<=16;i++){const u=i/16,v=1-u;
        cab.push([v*v*v*hx+3*v*v*u*(hx+90)+3*v*u*u*(bx-120)+u*u*u*bx,v*v*v*hy+3*v*v*u*(hy+120+Math.sin(now*3)*6)+3*v*u*u*(by+110)+u*u*u*by]);}
      line(cab,8,INK);line(cab,4,CABLE);
      enchufe(ptx,pty,plugged);
      if(zap>0){ctx.save();ctx.globalAlpha=zap;
        for(const sg of[-1,1])line([[px+sg*24,py-46],[px+sg*8,py-30],[px+sg*18,py-26],[px-sg*4,py-4]],4,CHISPA);ctx.restore();}
      if(lose&&e>.45)bubble(172,146,'¡NOOO! ¡MI TELÉFONO!',19,140,288);
      if(win&&e>.5)bubble(172,146,'¡ÉPALE, SÍ HAY LUZ!',19,140,288);
      ctx.restore();line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('enchufa',{name:'¡ENCHUFA!',mk:mkEnchufa,card:'EL CARGADOR',num:'3'});
})();
