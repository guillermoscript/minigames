'use strict';
/* MiniCaos · laboratorio de estilos: ¡SÓPLALE! (tomarse la sopa hirviendo a mediodía).
   Domingo, 1:00 PM, bajo un techo de zinc que quema. La abuela te sirvió un sancocho de costilla en plato hondo de peltre
   que está hirviendo. Hay dos botones de SOPLAR y hay que tocarlos ALTERNADOS, rápido, para enfriar la cuchara antes de
   que tu termómetro de insolación reviente (el termómetro es el reloj). Repetir el mismo botón no sopla nada, y la
   cuchara se vuelve a calentar sola si te quedas quieto.
   Ganas: te la tomas, sudas una gota gigante de satisfacción y te vas a dormir al chinchorro.
   Pierdes: revienta el termómetro, te metes la cuchara caliente, se te quema la lengua y te bajas un vaso de agua con hielo de golpe.
   Nivel 1: 10 soplidos. Nivel 2: 12. Nivel 3: 14 (con menos tiempo, y se recalienta más rápido).
   Teclado: ← → son los dos botones; ESPACIO alterna solo.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.sopa)return;
const LV=BUS.LV,CONF=BUS.CONF,TU=BUS.TU,PI=Math.PI,PELTRE='#f4f4f8',CALDO='#e8b23a';
const ABU={skin:'#a96f48',shirt:'#9b6bd1',pat:'floral',sh2:'#ffe08a',hair:'bun',hairCol:'#d8d8e0',glasses:'round',wrinkles:1,cheeks:1};
const pop=(s,x,y,col,r=8,life=.75)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.24,vr:0});

/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;

/* el termómetro de la insolación: (x, y) = tope del tubo */
function termo(x,y,k,roto){ctx.save();ctx.translate(x+(k>.8&&!roto?Math.sin(now*50)*2.5:0),y);
  ell(0,-34,15,15,'#ffe14d',3.5);for(let i=0;i<8;i++){const a=i/8*TAU+now;line([[Math.cos(a)*20,-34+Math.sin(a)*20],[Math.cos(a)*28,-34+Math.sin(a)*28]],3.5,'#ffb300');}
  if(roto){poly([[-17,236],[-17,120],[-6,138],[2,112],[10,134],[17,116],[17,236]],'#fffdf2',4.5);ell(0,250,30,30,'#ff3b4e',4.5);ell(-10,282,44,10,'#ff3b4e',3);ctx.restore();return;}
  rr(-17,0,34,236,17,'#fffdf2',4.5);ell(0,250,30,30,'#ff3b4e',4.5);
  const h=204*k;rr(-8,222-h,16,h+22,6,k>.8&&Math.sin(now*30)>0?'#ff8a3d':'#ff3b4e',0);
  for(let i=0;i<5;i++)line([[-17,36+i*40],[-5,36+i*40]],3,INK);
  ctx.restore();}
/* un botón de soplar. sd: -1 izquierda, 1 derecha; on: es el que toca; pr: recién apretado; mal: repetiste */
function boton(x,y,sd,on,pr,mal){const s=1-pr*.12;ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  ell(0,7,58,54,'#2d2640',0);ell(0,0,58,54,mal?'#ff4d5e':on?'#ffd23f':'#8f8fa8',4.5);
  txt('SOPLA',0,-12,19,INK,0,true);for(let i=0;i<3;i++)line([[-sd*24,10+i*10],[sd*(6+(i%2)*12),10+i*10]],4,INK);
  ctx.restore();}
/* el plato hondo de peltre, con su sancocho de costilla */
function plato(x,y,vap){
  ell(x,y+8,132,44,PELTRE,4.5);line(closeP(ellP(x,y,126,36,26)),7,'#2f7fe0');ell(x,y,110,27,CALDO,3);
  rr(x-58,y-12,42,18,8,'#ffd23f',3);for(let i=0;i<4;i++)ell(x-50+i*9,y-3,2.5,2.5,'#e8a800',0);
  limb(x+22,y-6,x+70,y+6,11,'#fffdf2',3);ell(x+40,y+2,20,10,'#a8553a',3);
  ell(x-8,y+10,15,9,'#ff8a3d',2.5);ell(x+86,y-4,11,7,'#fff3c4',2.5);
  for(const[dx,dy]of[[-80,4],[-22,-14],[10,14],[62,-14],[-44,14]])ell(x+dx,y+dy,4,2.5,'#3aa86a',0);
  ell(x-112,y+26,7,4,INK,0);ell(x+96,y+34,5,3,INK,0);
  if(vap>0)for(let i=0;i<4;i++){const bx=x-66+i*44,p=now*3+i*1.9;ctx.save();ctx.globalAlpha=.5*vap;line([0,1,2,3,4].map(j=>[bx+Math.sin(p+j*1.2)*7,y-24-j*13]),4,'#ffffff');ctx.restore();}}
/* la siesta: (u = segundos desde que te acostaste) */
function chinchorro(u){const sw=Math.sin(u*2.6)*.06;
  rr(70,150,28,440,6,'#8a5a30',4);rr(702,150,28,440,6,'#8a5a30',4);
  ctx.save();ctx.translate(400,170);ctx.rotate(sw);ctx.translate(-400,-170);
  line([[98,186],[190,302]],4.5,'#e8d7a8');line([[702,186],[610,302]],4.5,'#e8d7a8');
  bust(Object.assign({},TU,{x:292,y:302,s:.9,rot:-1.25,th:120,mood:'sleep',cheeks:1}));
  ell(424,330,82,38,TU.shirt,4);ell(566,306,24,14,'#ffffff',3.5);ell(590,296,24,14,'#ffffff',3.5);
  const top=[],bot=[];for(let i=0;i<=12;i++){const t=i/12,x=190+420*t,s=Math.sin(t*PI);top.push([x,302+s*46]);bot.push([x,302+s*150]);}
  poly(top.concat(bot.slice().reverse()),'#ff8a3d',4.5);
  for(const f of[.3,.6]){line(top.map(([x,y],j)=>[x,y+(bot[j][1]-y)*f]),5,f<.5?'#ffd23f':'#c4283a');}
  for(let i=1;i<12;i++)line([[bot[i][0],bot[i][1]],[bot[i][0]+Math.sin(u*5+i)*3,bot[i][1]+20]],3,'#fff3c4');
  ctx.restore();
  for(let i=0;i<3;i++){const q=(u*.55+i/3)%1;ctx.save();ctx.globalAlpha=1-q;txt('Z',262+q*70,236-q*90,16+q*24,'#ffffff',-.2);ctx.restore();}}

/* ═════════ ¡SÓPLALE!: enfría la cuchara alternando los dos botones ═════════ */
function mkSopa(){
  const rs=Math.sqrt(SP),lv=LV(),need=[10,12,14][lv-1],RE=[.04,.05,.06][lv-1],X=400,Y=318,S=1.2,MY=Y+S*(HY+23),BT=[[112,506],[688,506]];
  let hot=1,last=0,taps=0,puf=0,side=1,mal=0,malS=0,kEnd=0,glu=0,did=0,fin=0;const pr=[0,0];
  function sopla(sd){if(g.result)return;const i=sd<0?0:1;pr[i]=1;
    if(sd===last){if(mal<.2)pop('¡EL OTRO!',BT[i][0],BT[i][1]-84,'#ff4d5e',2,.5);mal=1;malS=sd;snd(160,.08,'square',.05,-40);return;}
    last=side=sd;taps++;puf=1;hot=Math.max(0,hot-1/need);nz(.1,.06);snd(520-hot*160,.09,'sine',.04,-180);
    if(hot<=0){g.result='win';g.why='¡BUEN PROVECHO!';kEnd=clamp(g.t/g.dur,0,1);sfx.win();}}
  const g={lr:true,get impact(){return this.result?clamp(1-this.endT/.5,0,1):0;},probe:()=>({hot,need,last,taps,bt:BT}),
    t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡SÓPLALE!',
    hint:'ALTERNA los dos botones de SOPLAR (o ← →) hasta enfriar la cuchara',
    press(k){sopla(k==='left'?-1:k==='right'?1:last===1?-1:1);},
    down(p){sopla(p.x<400?-1:1);},
    update(dt){g.t+=dt;puf=Math.max(0,puf-dt*5);mal=Math.max(0,mal-dt*3);pr[0]=Math.max(0,pr[0]-dt*7);pr[1]=Math.max(0,pr[1]-dt*7);
      if(!g.result){hot=Math.min(1,hot+RE*dt);
        if(g.t>=g.dur){g.result='lose';g.why='¡TE QUEMASTE!';sfx.crash();sfx.lose();spawn(726,300,16,'bit',['#ff3b4e','#ffffff','#bfe9ff'],320,700,.8);pop('¡PUM!',690,236,'#ff4d5e',12);}
        return;}
      fin+=dt;g.endT=sello(fin);const e=fin;
      if(g.result==='win'){if(did<1&&e>.3){did=1;snd(300,.3,'sine',.1,500);pop('¡SLURP!',X+120,MY-30,'#ffffff',8);}
        if(did<2&&e>1.05){did=2;spawn(400,250,20,'conf',CONF);}}
      else{if(did<1&&e>.3){did=1;snd(1100,.6,'sawtooth',.07,700);pop('¡QUEMA!',X+130,MY-40,'#ff4d5e',10);}
        if(e>1.25&&e<2.1&&(glu-=dt)<=0){glu=.2;snd(220+Math.random()*60,.09,'sine',.1,-90);pop('¡GLU!',X+100+Math.random()*70,MY-10,'#9fe3ff',2,.5);}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=fin,k=win?kEnd:lose?1:clamp(g.t/g.dur,0,1);
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      /* la pared, el techo de zinc que quema y el reloj en la una */
      wash(0,0,800,600,'#f6d9a0','#f0c078');
      rr(0,86,800,42,0,'#aeb4c2',0);for(let i=0;i<27;i++)line([[i*30+8,88],[i*30+8,126]],3,'#7f8698');line([[0,128],[800,128]],4,INK);
      for(let i=0;i<5;i++){const x=160+i*112,p=now*3+i;ctx.save();ctx.globalAlpha=.25+.35*k;line([0,1,2,3,4].map(j=>[x+Math.sin(p+j*1.3)*7,134+j*10]),3,'#ff8a3d');ctx.restore();}
      ell(566,186,30,30,'#fffdf2',4.5);line([[566,186],[566,164]],3.5,INK);line([[566,186],[575,172]],5,INK);txt('1:00 PM',566,230,13,INK,0,true);
      if(win&&e>1.05){chinchorro(e-1.05);if(e>1.45)bubble(520,520,'¡BARRIGA LLENA, CORAZÓN CONTENTO!',15,792,566);ctx.restore();line([[0,576],[800,576]],4,INK);drawP();return;}
      /* la abuela con su cucharón */
      const dice=!g.result&&g.t>.15&&g.t<1.5/rs,rega=lose&&e>.5;
      bust(Object.assign({},ABU,{x:112,y:330,s:.84,look:1,mood:win?'happy':rega||dice?'yell':lose?'o':'smile',talk:dice||rega?Math.abs(Math.sin(now*12)):0,
        arms:[{side:1,a:2.2+Math.sin(now*4)*.1,len:58,w:19,hand:(hx,hy)=>{line([[hx,hy],[hx+10,hy-58]],6,'#8f8fa8');ell(hx+12,hy-66,17,12,'#c9ced6',3.5);}},{side:-1,a:-.2,len:70,w:19}]}));
      termo(726,160,k,lose);
      /* tú y la cuchara */
      const quema=lose&&e>.3&&e<1.25,agua=lose&&e>=1.25,frio=lose?clamp((e-2.05)/.3,0,1):0,red=lose?(agua?Math.max(0,.75-(e-1.25)*1.2):.75):k*.55;
      const skin=frio?mix(TU.skin,'#9fd8ff',frio*.55):mix(TU.skin,'#ff5a3a',red);
      const boca=win?ease(clamp(e/.3,0,1)):lose?ease(clamp(e/.22,0,1)):0,baja=win?ease(clamp((e-.45)/.25,0,1)):lose?ease(clamp((e-.3)/.25,0,1)):0;
      const sx=X+side*puf*4+baja*150,sy=lerp(338,MY+6,boca)+baja*74+(g.result?0:Math.sin(now*30)*(.6+k*1.2));
      const hx=agua?X+66:sx+138,hy=agua?MY+4:sy+62,lx=(hx-X)/S-39,ly=(hy-Y)/S-4;
      bust(Object.assign({},TU,{x:X+(quema?Math.sin(now*50)*4:0),y:Y,s:S,skin,look:0,down:g.result?0:1,rot:g.result?0:side*puf*.06,
        mood:win?'happy':lose?(e<.3?'o':quema?'yell':frio>.5?'dizzy':'o'):puf>.25?'o':k>.75?'panic':'worry',talk:quema?1:0,sweat:g.result?(lose?2:0):k>.7?2:k>.35?1:0,
        arms:[{side:1,a:Math.atan2(lx,ly),len:clamp(Math.hypot(lx,ly),40,150),w:22},{side:-1,a:g.result?-.2:-2.3+Math.sin(now*15)*.3,len:70,w:22}]}));
      if(!agua){line([[hx,hy],[sx+36,sy+8]],10,INK);line([[hx,hy],[sx+36,sy+8]],6,'#e8e8ee');ell(sx,sy,46,24,PELTRE,4);
        if(baja<=0){ell(sx,sy-3,36,15,mix(CALDO,'#ff3b1e',hot),3);ell(sx-12,sy-6,8,4,'#ffd23f',0);}}
      if(!g.result){for(let i=0;i<Math.ceil(hot*5);i++){const bx=sx-28+i*14,p=now*4+i*1.7;ctx.save();ctx.globalAlpha=.35+.4*hot;line([0,1,2,3,4].map(j=>[bx+Math.sin(p+j*1.2)*6-side*puf*j*6,sy-22-j*13]),4,'#ffffff');ctx.restore();}
        if(puf>0){ctx.save();ctx.globalAlpha=puf;for(let i=-1;i<=1;i++)line([[X+i*10+side*8,MY+16],[X+i*26+side*(8+26*(1-puf)),MY+42+12*(1-puf)]],4,'#dff4ff');ctx.restore();}}
      /* la gota gigante de satisfacción */
      if(win&&e>.4){const d=ease(clamp((e-.4)/.35,0,1)),dx=X+S*52,dy=Y+S*(HY-22)+d*26;poly([[dx-13*d,dy-10*d],[dx,dy-44*d],[dx+13*d,dy-10*d]],'#9fe3ff',3.5);ell(dx,dy,18*d+1,24*d+1,'#9fe3ff',3.5);ell(dx-6*d,dy-4*d,4*d,8*d,'#ffffff',0);}
      /* la lengua quemada, el humo por las orejas... */
      if(quema){rr(X-15,MY+8,30,48,13,'#ff3b1e',3.5);line([[X,MY+16],[X,MY+44]],2.5,'#a8140a');
        for(const sg of[-1,1])for(let i=0;i<3;i++){const u=(now*2.4+i/3)%1;ctx.save();ctx.globalAlpha=1-u;ell(X+sg*(S*48+u*70),Y+S*HY-u*34,10+u*14,8+u*10,'#ffffff',0);ctx.restore();}}
      /* ...y el vaso de agua con hielo, de golpe */
      if(agua){const dr=clamp((e-1.25)/.8,0,1);ctx.save();ctx.translate(X+6,MY+4);ctx.rotate(-1.15-dr*.9);
        rr(-27,0,54,90,8,'#dff4ff',3.5);rr(-21,5,42,78*(1-dr),4,'#7fc8ff',0);for(const[ix,iy]of[[-12,8],[4,20],[-6,36]])if(iy<74*(1-dr))rr(ix,iy,18,18,3,'#ffffff',2.5);ctx.restore();}
      /* la mesa con su mantel de cuadros y el plato */
      rr(0,430,800,150,0,'#c4283a',0);for(let r=0;r<4;r++)for(let c=0;c<10;c++)rr(c*80+(r%2)*40,430+r*38,40,38,0,'#fff3c4',0);line([[0,430],[800,430]],5,INK);
      plato(400,470,g.result?.3:1);
      if(!g.result){rr(262,524,276,24,10,'#2d2640',3.5);rr(266,528,Math.max(4,268*hot),16,6,mix('#ffd23f','#ff3b1e',hot),0);txt(hot>.66?'HIRVIENDO':hot>.33?'CALIENTE':'TIBIECITA',400,537,13,'#ffffff',0,true);
        boton(BT[0][0],BT[0][1],-1,last!==-1,pr[0],mal>0&&malS<0);boton(BT[1][0],BT[1][1],1,last!==1,pr[1],mal>0&&malS>0);
        if(!taps)BUS.tag(X,Y+S*(HY-40)-34);}
      if(dice)bubble(196,170,'¡CALIENTICA ES QUE ALIMENTA!',15,134,246);
      if(rega)bubble(190,170,'¡TE DIJE QUE SOPLARAS!',17,134,246);
      if(win&&e>.5)bubble(180,170,'¡ASÍ ME GUSTA!',20,134,246);
      ctx.restore();line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('sopa',{name:'¡SÓPLALE!',mk:mkSopa,card:'EL SANCOCHO',num:'7'});
})();
