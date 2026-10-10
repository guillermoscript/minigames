'use strict';
/* MiniCaos · laboratorio de estilos: ¡JÁLALA! (recoger la ropa del tendedero antes de que llueva).
   El patio de la casa: suena un trueno durísimo, caen las primeras gotas gordas y en la cuerda hay tres prendas con sus
   ganchos de plástico: un blue jean, una sábana y la camisa del uniforme. Hay que DESLIZAR EL DEDO HACIA ABAJO sobre cada
   prenda para arrancarla de la cuerda (TÚ pega el brinco y se la lleva en los brazos) antes del aguacero.
   El reloj es el cielo: se va poniendo negro y la lluvia arrecia. Si se acaba (5 s / raíz de la velocidad) cae el diluvio,
   la ropa va a dar al barro y mamá te manda a lavarla a mano. Si la salvas, mamá te echa la bendición desde la cocina.
   Un trazo que no baja, o que no cae sobre ninguna prenda, no hace nada (y no castiga): aquí lo que mata es el tiempo.
   Nivel 1: un jalón por prenda y agarra la más cercana al dedo. Nivel 2: la sábana tiene los ganchos duros (dos jalones) y
   hay que jalar SOBRE la prenda. Nivel 3: el jean también pide dos y la brisa mece la cuerda.
   Teclado: ↓ o ESPACIO jalan la que toque, de izquierda a derecha.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.tendedero)return;
const LV=BUS.LV,CONF=BUS.CONF,TU=BUS.TU,say=BUS.say,tag=BUS.tag,MAMA=BUS.AP.CAST.mama,PI=Math.PI;
const FY=540,LY=150,LX0=214,LX1=782,S=.62,WX=34,WY=236,WW=150,WH=150,GANCHOS=['#ff5c8a','#ffd23f','#5cd06a','#3fb0ff','#ff8a3d','#b49cff'],BARRO='#6a4a2a';
/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;
const cuerda=x=>LY+Math.sin((x-LX0)/(LX1-LX0)*PI)*12;
const gancho=(x,c)=>{rr(x-5,-14,10,27,3,c,2.5);line([[x,-5],[x,9]],1.5,INK);};

/* las prendas, en sus propias coordenadas: (0, 0) = el medio de la prenda sobre la cuerda */
const ROPA={
  jean(){rr(-36,14,32,154,7,'#3f6fd0',4);rr(4,14,32,154,7,'#3f6fd0',4);rr(-36,0,72,24,5,'#3f6fd0',4);rr(-34,3,68,7,3,'#2f55a8',0);
    line([[-28,34],[-14,34],[-14,48]],2.5,'#ffd23f');line([[28,34],[14,34],[14,48]],2.5,'#ffd23f');rr(-33,154,26,9,3,'#7fa3ee',0);rr(7,154,26,9,3,'#7fa3ee',0);},
  sabana(){const w=72,p=[[-w,0],[w,0]];for(let i=0;i<=6;i++)p.push([w-i*w/3,168+(i%2?9:0)+Math.sin(now*5+i)*3]);
    poly(p,'#fffdf2',4);line([[-w+6,11],[w-6,11]],2,'#e0d8c8');
    for(let r=0;r<3;r++)for(let c=0;c<3;c++){const x=-44+c*44+(r%2)*10,y=38+r*46;ell(x,y,9,9,'#ff9ec7',0);ell(x,y,3.5,3.5,'#ffd23f',0);}},
  uniforme(){poly([[-40,6],[-62,26],[-50,54],[-36,42],[-36,128],[36,128],[36,42],[50,54],[62,26],[40,6],[14,0],[0,13],[-14,0]],'#8fc4ff',4);
    line([[0,13],[0,128]],2.5,'#5a94d8');for(let i=0;i<3;i++)ell(0,38+i*28,3,3,'#fffdf2',1.5);
    poly([[-14,0],[0,13],[-7,24],[-23,9]],'#b9dcff',3);poly([[14,0],[0,13],[7,24],[23,9]],'#b9dcff',3);
    rr(10,48,20,22,3,'#7ab2f0',2.5);ell(20,56,5,6,'#ffd23f',2);}};          /* la insignia es genérica */

/* la casa: la pared, el techo de zinc y la ventana de la cocina con mamá asomada */
function casa(mood,talk,bendice){
  rr(-10,104,224,FY-104,0,'#ffd9a0',0);for(let i=0;i<3;i++)rr(i*80+8,110,40,FY-110,0,'#f5c27a',0);line([[214,104],[214,FY]],4,INK);
  poly([[-10,76],[240,98],[240,118],[-10,106]],'#9aa3b0',4);for(let i=0;i<7;i++)line([[10+i*34,80+i*3],[10+i*34,106+i*1.4]],2,'#6f7888');
  rr(WX-9,WY-9,WW+18,WH+18,8,'#8a6a4a',4.5);
  ctx.save();path(rrP(WX,WY,WW,WH,4));ctx.clip();rr(WX,WY,WW,WH,0,'#ffe9c4',0);
  rr(WX,WY+22,WW,8,0,'#8a6a4a',0);rr(WX+12,WY-2,22,24,4,'#e8553d',2.5);rr(WX+112,WY-2,22,24,4,'#3fb0ff',2.5);
  bust(Object.assign({},MAMA,{x:WX+75,y:WY+128,s:.64,th:170,look:1,mood,talk,
    arms:bendice?[{side:1,a:2.45+Math.sin(now*5)*.3,len:66,w:20}]:mood==='angry'||mood==='yell'?[{side:1,a:2.2+Math.sin(now*16)*.25,len:70,w:20}]:[]}));
  ctx.restore();rr(WX-16,WY+WH+4,WW+32,13,3,'#f7e7c4',3.5);}
function lluvia(k,diluvio){const n=diluvio?110:Math.round(5+k*k*52);
  for(let i=0;i<n;i++){const sp=620+hash(i,1,5)*420,x=hash(i,2,5)*880-30,y=((now*sp+hash(i,3,5)*700)%650)-40;
    if(i<5&&!diluvio)ell(x,y,5,10,'#bfe6ff',2.5);else line([[x,y],[x-9,y+28]],diluvio?3:2.5,'#d8eeff');}}

/* ═════════ ¡JÁLALA!: un jalón hacia abajo por prenda antes del aguacero ═════════ */
function mkTendedero(){
  const rs=Math.sqrt(SP),lv=LV(),MIN=60,AMP=[4,9,24][lv-1];
  const prendas=[{k:'jean',x:350,hw:36,h:168,pin:24,col:'#3f6fd0',left:lv>=3?2:1},{k:'sabana',x:515,hw:72,h:172,pin:56,col:'#fffdf2',left:lv>=2?2:1},
    {k:'uniforme',x:680,hw:46,h:128,pin:30,col:'#8fc4ff',left:1}].map((q,i)=>Object.assign(q,{i,on:true,tug:0,ft:0,need:q.left}));
  let s0=null,cur=null,tgt=null,done=0,fin=0,boom=0,gota=0,X=292,tuX=292,brinco=0,did=0;const carga=[];
  const cx=q=>q.x+Math.sin(g.t*2.6+q.i*2.1)*AMP;
  function pick(x){let b=null;for(const q of prendas)if(q.on&&(!b||Math.abs(x-cx(q))<Math.abs(x-cx(b))))b=q;
    return b&&(lv===1||Math.abs(x-cx(b))<=b.hw+44)?b:null;}
  function jala(q){if(g.result||!q||!q.on)return;q.left--;q.tug=1;brinco=1;tuX=cx(q);nz(.05,.12);snd(520,.08,'square',.05,-200);
    spawn(cx(q)-q.pin,LY,2,'bit',GANCHOS,260,800,.6);
    if(q.left>0){say('¡OTRA VEZ!',cx(q),LY+q.h+30,'#ffe14d');return;}
    spawn(cx(q)+q.pin,LY,2,'bit',GANCHOS,260,800,.6);q.on=false;q.ft=0;done++;
    if(done>=prendas.length){g.result='win';g.why='¡SEQUITA!';sfx.win();}}
  /* ¿ya bajó lo suficiente? Jala apenas se cumple (no espera a que sueltes) y pide un dedo nuevo para la próxima */
  function mira(p){if(!s0||g.result)return;const dy=p.y-s0.y,dx=p.x-s0.x;if(dy<MIN||dy<Math.abs(dx)*1.1)return;
    const q=tgt,a=s0;s0=cur=tgt=null;if(q)jala(q);else say('¡AIRE!',a.x,a.y-20,'#ffffff');}
  const g={get impact(){return this.result?clamp(1-fin/.5,0,1):this.t<.3?.5:0;},
    probe:()=>({prendas:prendas.map(q=>({x:cx(q),y:LY+q.h*.4,on:q.on,left:q.left})),done,total:prendas.length}),
    t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡JÁLALA!',
    hint:'DESLIZA EL DEDO HACIA ABAJO sobre cada prenda (o ↓ / ESPACIO) antes de que caiga el aguacero',
    press(k){if(g.result||k==='up')return;jala(prendas.find(q=>q.on));},
    down(p){if(g.result)return;s0=cur=p;tgt=pick(p.x);},
    move(p){if(s0){cur=p;mira(p);}},
    up(p){if(s0&&p)mira(p);s0=cur=tgt=null;},
    update(dt){g.t+=dt;brinco=Math.max(0,brinco-dt*4.5);X+=(tuX-X)*Math.min(1,dt*16);
      if(!boom){boom=1;nz(.9,.22);snd(70,.9,'sawtooth',.12,-30);}
      for(const q of prendas){q.tug=Math.max(0,q.tug-dt*5);if(!q.on){if(q.ft<.22&&q.ft+dt>=.22)carga.push(q.col);q.ft+=dt;}}
      if(!g.result){const k=clamp(g.t/g.dur,0,1);if((gota-=dt)<=0){gota=.3-.22*k;snd(900+Math.random()*500,.03,'sine',.02+.03*k,-400);}
        if(g.t>=g.dur){g.result='lose';g.why='¡SE MOJÓ TODO!';s0=cur=tgt=null;sfx.lose();nz(1.1,.22);snd(60,1,'sawtooth',.12,-25);}
        return;}
      fin+=dt;g.endT=sello(fin);s0=cur=tgt=null;
      if(g.result==='win'){tuX=264;if(did<1&&fin>.55){did=1;spawn(X,FY-150,22,'conf',CONF);snd(1320,.3,'sine',.07);snd(1760,.4,'sine',.05);}}
      else if(did<1&&fin>.4){did=1;sfx.thud();for(const q of prendas)if(q.on)spawn(q.x,FY-10,8,'bit',[BARRO,'#8a6a3a'],260,700,.7);}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=fin,k=lose?1:clamp(g.t/g.dur,0,1),kk=win?k*Math.max(.35,1-e):k;
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      /* el cielo que se cierra, la pared de bloques y el piso (tierra… o barro) */
      const sk=mix('#a9c4d8','#454a62',kk);wash(0,0,800,360,sk,mix(sk,'#ffffff',.3));
      const rayo=lose?e<.35:g.t<.3;
      if(rayo){const a=lose?1-e/.35:1-g.t/.3;ctx.save();ctx.globalAlpha=.75*a;rr(0,0,800,360,0,'#ffffff',0);ctx.restore();line([[560,60],[530,140],[566,150],[524,250],[548,250],[516,330]],7,'#fff8b0');}
      for(let i=0;i<7;i++)ell(40+i*128,34+(i%2)*22+kk*26,116,50+kk*14,mix('#93a0b4','#33374a',kk),4);
      rr(0,330,800,FY-330,0,mix('#e3b98a','#a88a6e',kk),0);line([[0,330],[800,330]],4,INK);
      for(let j=0;j<5;j++){line([[0,372+j*42],[800,372+j*42]],2,'#c99a6a');for(let i=0;i<9;i++)line([[i*96+(j%2)*48,330+j*42],[i*96+(j%2)*48,372+j*42]],2,'#c99a6a');}
      const ch=lose?ease(clamp(e/.5,0,1)):0;rr(0,FY,800,60,0,mix('#b97a46','#7a5632',Math.max(kk*.5,ch)),0);line([[0,FY],[800,FY]],4,INK);
      if(lose)for(let i=0;i<5;i++)ell(290+i*118,FY+16+(i%2)*8,(50+hash(i,1,6)*30)*ch,9*ch,'#8fb8d8',2.5);
      casa(win?'happy':lose?(e>.5?'yell':'o'):'worry',lose&&e>.5?.5+.5*Math.sin(now*18):!g.result&&g.t<.9?.6:0,win&&e>.3);
      /* el poste y la cuerda */
      rr(LX1-6,LY-18,13,FY-LY+18,3,'#8f8fa8',3.5);rr(LX1-20,LY-14,40,8,3,'#8f8fa8',3);
      const cu=[];for(let i=0;i<=12;i++){const x=lerp(LX0,LX1,i/12);cu.push([x,cuerda(x)]);}line(cu,6,INK);line(cu,3,'#fff8e0');
      /* las prendas: colgadas, a medio soltar, volando a los brazos o en el barro */
      const Y=FY-160*S-ease(brinco)*52-(win&&e>.5?Math.abs(Math.sin(now*11))*10:0);
      for(const q of prendas){const x=cx(q),y=cuerda(x),dib=ROPA[q.k];
        if(!q.on){const u=clamp(q.ft/.22,0,1);if(u>=1)continue;
          ctx.save();ctx.translate(lerp(x,X,u),lerp(y,Y+10,u*u));ctx.rotate(u*.6);ctx.scale(1-u*.6,1-u*.6);dib();ctx.restore();continue;}
        if(lose){const u=clamp(e/.4,0,1),cy=lerp(y,FY-34,u*u);
          ctx.save();ctx.translate(q.x,cy);ctx.rotate((hash(q.i,3,3)-.5)*.5*u);ctx.scale(1+u*.15,lerp(1,.2,u));dib();ctx.restore();
          if(u>=1){ell(q.x-q.hw*.4,FY-18,q.hw*.34,8,BARRO,0);ell(q.x+q.hw*.5,FY-12,q.hw*.26,7,BARRO,0);ell(q.x,FY-2,q.hw+26,8,BARRO,2.5);}continue;}
        const medio=q.left<q.need,st=s0&&cur&&tgt===q?clamp(cur.y-s0.y,0,MIN)/MIN:0;
        ctx.save();ctx.translate(x,y);
        if(medio){ctx.translate(q.pin,0);ctx.rotate(-.42+Math.sin(now*7)*.05);ctx.translate(-q.pin,0);}else ctx.rotate(Math.sin(g.t*2.6+q.i*2.1+1.2)*AMP*.004);
        ctx.scale(1-st*.06,1+st*.16+q.tug*.12);dib();
        if(!medio)gancho(-q.pin,GANCHOS[q.i*2]);gancho(q.pin,GANCHOS[q.i*2+1]);ctx.restore();
        if(!g.result){const o=(now*1.5+q.i*.3)%1;ctx.save();ctx.globalAlpha=.9-o*.6;
          poly([[x-16,y+52+o*34],[x+16,y+52+o*34],[x,y+78+o*34]],'#ffe14d',3.5);ctx.restore();
          if(q.need>1)txt('×'+q.left,x,y-34,22,'#ffe14d');}}
      /* TÚ: pega el brinco para jalar y va cargando el montón */
      const sube=brinco>.15||(s0&&tgt),corre=win&&e>.2;
      bust(Object.assign({},TU,{x:X,y:Y,s:S,th:110,legs:['#2f3a7a','#ffffff',60],look:corre?-1:0,rot:corre?-.06:0,
        mood:win?'happy':lose?'frown':sube?'o':'worry',sweat:lose?2:g.result?0:1,lids:lose?1:0,
        arms:sube&&!g.result?[{side:1,a:2.85,len:86,w:19},{side:-1,a:-2.85,len:86,w:19}]:[{side:1,a:-.75,len:54,w:19},{side:-1,a:.75,len:54,w:19}]}));
      carga.forEach((c,i)=>rr(X-36+(i%2)*6,Y+34-i*17,72-(i%2)*8,22,9,c,3.5));
      if(win&&e>.5)line(closeP(ellP(X,Y-128+Math.sin(now*6)*3,26,8,14)),5,'#ffe14d');           /* la bendición le llegó */
      lluvia(kk,lose);
      if(!g.result&&g.t<1/rs)tag(X,Y-124);
      if(!g.result&&g.t<.9)txt('¡LA ROPAAA!',112,WY-34,22,'#ffffff',-.06+Math.sin(now*30)*.02);
      if(win&&e>.6)bubble(214,196,'¡DIOS TE BENDIGA, MIJO!',18,WX+96,WY+40);
      if(lose&&e>.7)bubble(232,196,'¡AHORA LA LAVAS A MANO!',18,WX+96,WY+40);
      ctx.restore();line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('tendedero',{name:'¡JÁLALA!',mk:mkTendedero,card:'EL TENDEDERO',num:'17'});
})();
