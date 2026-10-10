'use strict';
/* MiniCaos · laboratorio de estilos: ¡MATA EL ZANCUDO! (SE FUE LA LUZ, el zancudo en la sala a oscuras).
   Se fue la luz y hay un zancudo zumbando por la sala. No se ve nada: el dedo es la LINTERNA (arrastra para alumbrar) y al
   SOLTAR cae el chancletazo justo ahí. El bicho solo se ve completo dentro del charco de luz, pero sus dos ojitos rojos
   brillan siempre en lo oscuro y el zumbido suena más duro mientras más cerca lo tienes. Pelar el chancletazo cuesta un
   reposo cortico (0.32 s) y deja un aro donde pegó. Se acaba el tiempo = ¡TE PICÓ!
   Mismo vuelo que el original (js/games/ap1.js, apMosquito): dos senos montados, más rápido en cada nivel de velocidad.
   Teclado: las flechas mueven la luz 60 px y ESPACIO da el chancletazo.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.zancudo)return;
const AP=BUS.AP,PI=Math.PI,RH=44,OJO='#ff3b3b';
/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;

/* el zancudo visto desde arriba: la cabeza y la trompa apuntan hacia -y.
   o: {ojos (solo los dos ojos rojos, para pintarlos encima de la oscuridad), muerto (patas tiesas, alas caídas, sin ojos)} */
function zancudo(x,y,s,rot,o){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
  if(!o.ojos){const f=o.muerto?-.6:Math.sin(now*60)*.35;
    for(const sg of[-1,1]){
      for(let i=0;i<3;i++){const j=o.muerto?0:Math.sin(now*9+i*2+sg)*2;
        if(o.muerto)line([[sg*4,-4+i*4],[sg*(13+i*2),4+i*6],[sg*(15+i*2),24+i*5]],1.6,INK);
        else line([[sg*4,-4+i*4],[sg*(15+i*3),-12+i*9+j],[sg*(22+i*4),8+i*9+j]],1.6,INK);}
      ctx.save();ctx.translate(sg*4,-6);ctx.rotate(sg*(.5+f));ctx.globalAlpha=.8;ell(sg*15,-3,15,6,'#dff3ff',1.5);ctx.restore();
      line([[sg*2,-19],[sg*8,-27]],1.2,INK);}
    line([[0,-18],[0,-38]],2,INK);                                                      /* la trompa */
    ell(0,10,5.5,14,'#7a6450',2);for(let i=0;i<3;i++)line([[-5,4+i*6],[5,4+i*6]],1.6,'#f2e6c8');
    ell(0,-5,7,7,'#4a3b30',2);ell(0,-15,5.5,5,'#4a3b30',2);
    if(o.muerto)for(const sg of[-1,1])txt('×',sg*4,-15,6,'#ffffff',0,true);}
  if(!o.muerto)for(const sg of[-1,1]){ctx.save();ctx.globalAlpha=.4+.2*Math.sin(now*11);ell(sg*4,-16,5,5,'#ffb0b0',0);ctx.restore();
    ell(sg*4,-16,2.7,2.7,OJO,0);ell(sg*4-.8,-16.8,.9,.9,'#ffffff',0);}
  ctx.restore();}

/* ═════════ ¡MATA EL ZANCUDO!: alumbra, búscale los ojos y suelta el chancletazo ═════════ */
function mkZancudo(){
  const rs=Math.sqrt(SP),seed=Math.random()*100,spd=.55+(SP-1)*.22,AB=AP.CAST.mama;   /* mamá, la de la chancla */
  const M={x:400,y:280,a:0};
  let px=400,py=330,swing=0,cool=0,sx=px,sy=py,misses=[],bz=0,fin=0,hit=null;
  function dale(x,y){px=x;py=y;if(g.result||cool>0)return;
    swing=1;cool=.32;sx=x;sy=y;sfx.whoosh();setTimeout(()=>sfx.thud(),70);
    if(Math.hypot(M.x-x,M.y-y)<RH){g.result='win';g.why='¡PLAF!';hit={x:M.x,y:M.y,vy:-120,r:M.a};nz(.1,.3);sfx.win();
      spawn(x,y,14,'★',['#ffe14d','#ffffff','#c4283a'],300,600,.7);}
    else{misses.push({x,y,t:.5});nz(.06,.12);}}
  const luz=p=>{px=clamp(p.x,0,800);py=clamp(p.y,50,566);};
  const g={lr:true,get impact(){return this.result?clamp(1-fin/.5,0,1):0;},
    probe:()=>({x:M.x,y:M.y,px,py,cool,R:RH}),
    t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡MATA EL ZANCUDO!',
    hint:'ARRASTRA para alumbrar y SUELTA para darle con la chancleta (o flechas y ESPACIO)',
    press(k){if(g.result)return;const d={left:[-60,0],right:[60,0],up:[0,-60],down:[0,60]}[k];
      if(d)luz({x:px+d[0],y:py+d[1]});else dale(px,py);},
    down(p){if(!g.result)luz(p);},
    move(p){if(!g.result)luz(p);},
    up(p){if(g.result)return;if(p)luz(p);dale(px,py);},
    update(dt){g.t+=dt;swing=Math.max(0,swing-dt*4.5);cool=Math.max(0,cool-dt);
      for(const m of misses)m.t-=dt;misses=misses.filter(m=>m.t>0);
      if(!g.result){const c=g.t*spd*rs;
        const tx=470+Math.sin(c*2.1+seed)*220+Math.sin(c*5.3)*35,   /* vuela a la derecha de mamá, no sobre su cara */ty=290+Math.cos(c*1.7+seed*1.3)*130+Math.sin(c*6.1)*30;
        const vx=(tx-M.x)*9,vy=(ty-M.y)*9;M.x+=vx*dt;M.y+=vy*dt;M.a=Math.atan2(vx,-vy)*.5;
        if((bz-=dt)<=0){bz=.1;const v=clamp(1-Math.hypot(M.x-px,M.y-py)/360,0,1);snd(480+v*220,.09,'sawtooth',.014+.03*v,-50+v*40);}   /* el zumbido */
        if(g.t>=g.dur){g.result='lose';g.why='¡TE PICÓ!';sfx.lose();snd(900,.5,'sawtooth',.06,500);}
        return;}
      fin+=dt;g.endT=sello(fin);
      if(hit){hit.vy+=1100*dt;hit.y+=hit.vy*dt;hit.r+=dt*7;if(hit.y>536){hit.y=536;hit.vy=0;hit.r=PI;}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=fin,cerca=Math.hypot(M.x-px,M.y-py)<170;
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      /* la sala a todo color: el bombillo apagado, la mesita con la vela y mamá, que no le quita los ojos de encima */
      AP.sala();AP.bombillo(400,150,0);
      rr(222,400,84,12,4,'#7a3b2e',3.5);rr(232,412,10,56,2,'#7a3b2e',3);rr(286,412,10,56,2,'#7a3b2e',3);AP.vela(264,400,1);
      const tm=win?0:Math.sin(now*34)*.07,ox=win?hit.x:M.x,oy=win?hit.y:M.y;
      bust(Object.assign({},AB,{x:128+(win||lose?0:Math.sin(now*38)*1.5),y:373-(win?Math.abs(Math.sin(now*10))*10:0),s:.9,th:130,legs:AP.PIES.mama,vein:lose?1:0,
        mood:win?'grin':lose?'yell':'worry',talk:lose?Math.abs(Math.sin(now*14)):0,sweat:win?0:1,look:clamp((ox-128)/300,-1,1),down:oy>330,
        arms:win?[{side:1,a:2.7+Math.sin(now*12)*.2,len:64,w:19},{side:-1,a:-2.7-Math.sin(now*12)*.2,len:64,w:19}]
          :[{side:1,a:2.2+tm,len:58,w:19},{side:-1,a:-2.2-tm,len:58,w:19}]}));
      /* el zancudo: completo solo donde llega la linterna */
      if(!g.result&&cerca)zancudo(M.x,M.y,1.8,M.a,{});
      if(win&&e<.5){ctx.save();ctx.globalAlpha=1-e*2;ell(sx,sy,30,22,'#c4283a',0);ctx.restore();}
      /* la chancleta: sigue al dedo y baja de un latigazo */
      const k=1-Math.abs(swing*2-1),q=swing>0?k:0;
      chanclaP(lerp(px+34,sx+8,q),lerp(py+40,sy+6,q),swing>0?-1.1+k*1.6:-.45,1.5);
      /* la noche encima: la linterna y la velita */
      AP.oscuro(.93,[{x:px,y:py,r:170,c:'#fff5d2'},{x:240,y:356,r:104,c:'#ffaa46'}]);
      /* lo que brilla en lo oscuro: los ojos rojos, los aros de los chancletazos pelados y los globos */
      if(!g.result)zancudo(M.x,M.y,1.8,M.a,{ojos:1});
      for(const m of misses){ctx.save();ctx.globalAlpha=clamp(m.t*2,0,1);line(closeP(ellP(m.x,m.y,RH*(1.4-m.t),RH*(1.4-m.t),18)),3.5,'#ffffff');ctx.restore();
        txt('¡FUA!',m.x,m.y-RH-18+m.t*20,22,'#ffffff',-.08);}
      if(win){zancudo(hit.x,hit.y,2.1,hit.r,{muerto:1});
        if(e>.5)bubble(300,236,'¡ESE NO PICA MÁS!',20,170,300);}
      if(lose){const u=ease(clamp(e/.45,0,1));zancudo(lerp(M.x,400,u)+Math.sin(now*40)*3,lerp(M.y,330,u),1.8+u*5,lerp(M.a,0,u),{});
        for(let i=0;i<3;i++){const z=(now*1.5+i/3)%1;ctx.save();ctx.globalAlpha=1-z;txt('¡ZZZZ!',200+i*200,150-z*40+(i%2)*36,26+z*12,'#ffffff',(i-1)*.12);ctx.restore();}
        if(e>.5)bubble(300,470,'¡AY, MIJO, TE PICÓ!',20,170,330);}
      ctx.restore();line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('zancudo',{name:'¡EL ZANCUDO!',mk:mkZancudo,card:'EL ZANCUDO',num:'27'});
})();
