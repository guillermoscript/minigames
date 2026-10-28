'use strict';
/* MiniCaos · laboratorio de estilos: ¡MÁTALA! (la cucaracha que abre las alas en la pared).
   Una cucaracha marrón gigante, quieta en la pared del cuarto, y tú con la chola en la mano apuntando. De repente abre las
   alas (¡FZZZT!) y sale volando directo a la pantalla, o sea, a tu cara: tienes medio segundo para meterle el cholazo
   EN PLENO VUELO (un toque en cualquier parte). Darle antes, mientras está en la pared, es pelar: se aparta, la chola
   queda marcada en la pared y la que sigue ya no la paras.
   Ganas: cae al piso patas arriba, con las patitas tiesas.
   Pierdes: te aterriza en la frente, la pantalla se llena de sombras con patas y se oye el grito.
   Nivel 1: 0.50 s para darle y perdona un cholazo adelantado. Nivel 2: 0.46 s, ni uno, y antes hace un amago (corre un poquito).
   Nivel 3: 0.42 s y además amaga con las alas (las entreabre y las cierra) antes de volar de verdad.
   Teclado: ESPACIO.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.cucaracha)return;
const LV=BUS.LV,CONF=BUS.CONF,TU=BUS.TU,PI=Math.PI,CAFE='#7a4a22',OSC='#4a2a12';
const pop=(s,x,y,col,r=8,life=.75)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.24,vr:0});
/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;

/* la cucaracha vista desde arriba: la cabeza apunta hacia -y.
   o: {wings 0..1 (alas abiertas), fly (aleteando), fast (patas a millón), tw (antenas inquietas), dead (patas tiesas), belly (por debajo)} */
function cuca(x,y,s,rot,o){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);const w=o.wings||0,tw=o.tw||0;
  for(const sg of[-1,1])for(let i=0;i<3;i++){const y0=-14+i*16,j=o.dead?(i===1&&sg>0?Math.sin(now*26)*3:0):Math.sin(now*(o.fast?40:7)+i*2+sg)*(o.fast?5:1.5);
    if(o.dead)line([[sg*14,y0],[sg*27,y0+12],[sg*30+j,y0+34]],3.5,OSC);
    else line([[sg*14,y0],[sg*32,y0+(i-1)*10+j],[sg*44,y0+(i-1)*18+8+j]],3.5,OSC);}
  for(const sg of[-1,1])line([[sg*6,-38],[sg*(18+tw*8),-62],[sg*(30+Math.sin(now*(7+tw*30)+sg)*(5+tw*6)),-84]],2.5,OSC);
  if(w>0)for(const sg of[-1,1]){ctx.save();ctx.translate(sg*6,-16);ctx.rotate(-sg*(w*1.15+(o.fly?Math.sin(now*70)*.3:0)));ctx.globalAlpha=.8;ell(sg*4,34,15,40,'#d9b27a',3);ctx.restore();}
  ell(0,8,20,36,o.belly?'#a36a34':CAFE,4);
  if(o.belly||w>=.5)for(let i=0;i<4;i++)line([[-15,-8+i*11],[15,-8+i*11]],2.5,OSC);else{line([[0,-18],[0,42]],2.5,OSC);ell(-7,-4,4,12,'#a36a34',0);}
  ell(0,-30,14,11,OSC,3.5);
  ctx.restore();}

/* ═════════ ¡MÁTALA!: cholazo en pleno vuelo, ni antes ni después ═════════ */
function mkCucaracha(){
  const rs=Math.sqrt(SP),lv=LV(),W=[.5,.46,.42][lv-1],MISS=lv===1?1:0,REST=[646,440],CARA=[400,330];
  let tL=(1.2+Math.random()*1.9)/rs;
  const tAm=lv>=2?tL-(.85+Math.random()*.4)/rs:-1,tAl=lv>=3?tL-(.42+Math.random()*.2)/rs:-1;   /* los amagos: corretear, y entreabrir las alas */
  let cx=440+Math.random()*90,cy=230+Math.random()*50,crot=(Math.random()-.5)*.8,tx=cx,ty=cy;
  let fly=false,miss=0,cd=0,sw=0,swT=[cx,cy],hit=null,tarde=false,dAm=false,dAl=false,al=0,tw=0,scr=0,fin=0,grito=false;
  const marcas=[];
  /* el vuelo: de la pared a tu cara, haciendo eses y creciendo */
  const pos=u=>{const q=u*u;return{x:lerp(cx,CARA[0],q)+Math.sin(u*17)*46*(1-u),y:lerp(cy,CARA[1],q)+Math.cos(u*13)*22*(1-u),s:1.15+6.5*q};};
  function dale(){if(g.result||cd>0||tarde)return;sw=1;cd=.3;
    if(fly){const p=pos(clamp((g.t-tL)/W,0,1));swT=[p.x,p.y];hit={x:p.x,y:p.y,s:p.s,vy:-260,r:0};g.result='win';g.why='¡CHOLAZO!';
      sfx.thud();nz(.12,.3);sfx.win();spawn(p.x,p.y,12,'★',['#ffe14d','#ffffff'],340,600,.7);pop('¡PAF!',p.x,p.y-70,'#ffe14d',14);return;}
    /* te adelantaste: cholazo a la pared y el bicho se aparta */
    miss++;swT=[cx,cy];marcas.push([cx,cy]);sfx.thud();nz(.1,.25);pop('¡PAF!',cx,cy-56,'#ffffff',8);
    tx=clamp(cx+(Math.random()<.5?-1:1)*(110+Math.random()*60),330,720);ty=clamp(cy+(Math.random()-.5)*120,170,400);
    if(miss>MISS){tarde=true;tL=g.t+.34;}                                          /* y ahora sí viene */
    else tL=Math.min(g.dur-W-.15,Math.max(tL,g.t+.7+Math.random()*.6));}
  const g={get impact(){return this.result?clamp(1-fin/.5,0,1):fly?.6:0;},
    probe:()=>({fly,tL,W,miss,maxMiss:MISS,cd,tarde,cuca:{x:cx,y:cy}}),
    t:0,dur:5/rs,result:null,why:'',endT:0,cmd:'¡MÁTALA!',
    hint:'ESPERA... y cuando VUELE hacia ti, ¡TOCA! (o ESPACIO). Antes no',
    press(){dale();},
    down(){dale();},
    update(dt){g.t+=dt;cd=Math.max(0,cd-dt);sw=Math.max(0,sw-dt*5);al=Math.max(0,al-dt);tw=Math.max(0,tw-dt*2.5);
      if(!g.result){
        if(!fly){const dx=tx-cx,dy=ty-cy,d=Math.hypot(dx,dy);
          if(d>2){const st=Math.min(d,460*dt);cx+=dx/d*st;cy+=dy/d*st;crot=Math.atan2(dx,-dy);if((scr-=dt)<=0){scr=.05;snd(2200,.012,'square',.02);}}
          if(!dAm&&tAm>.3&&g.t>=tAm&&!miss){dAm=true;tw=1;tx=clamp(cx+(Math.random()<.5?-40:40),330,720);}
          if(!dAl&&tAl>.3&&g.t>=tAl&&!miss){dAl=true;al=.16;tw=1;nz(.06,.05);snd(170,.07,'sawtooth',.04,60);}
          if(g.t>=tL){fly=true;tL=g.t;nz(.35,.12);snd(150,W,'sawtooth',.07,260);snd(96,W,'square',.04,120);pop('¡FZZZT!',cx,cy-60,'#ffffff',8,.45);}}
        else if(g.t>=tL+W){g.result='lose';g.why=tarde?'¡TE ADELANTASTE!':'¡EN LA FRENTE!';sfx.crash();}
        return;}
      fin+=dt;g.endT=sello(fin);
      if(g.result==='lose'&&!grito&&fin>.16){grito=true;snd(1250,1,'sawtooth',.07,900);snd(1500,.9,'square',.04,700);}
      if(hit){hit.vy+=1500*dt;hit.y+=hit.vy*dt;hit.r=Math.min(PI,hit.r+dt*12);hit.s=lerp(hit.s,1.5,Math.min(1,dt*6));
        if(hit.y>520){hit.y=520;if(hit.vy>200){hit.vy*=-.35;snd(300,.04,'square',.04);}else hit.vy=0;}}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=fin,u=fly?clamp((g.t-tL)/W,0,1):0,susto=fly&&!win;
      ctx.save();path([[gameLeft(),0],[gameRight(),0],[gameRight(),576],[gameLeft(),576]]);ctx.clip();
      /* perdiste: tu cara con el bicho en la frente, y las sombras con patas tapando todo */
      if(lose&&e>.16){const v=e-.16,sh=Math.sin(now*46)*3;
        wash(gameLeft(),0,GAME_VIEW.width,600,'#3a2f55','#1c1630');
        bust(Object.assign({},TU,{x:400+sh,y:524,s:1.6,mood:'yell',talk:.6+.4*Math.sin(now*24),sweat:2,skin:mix(TU.skin,'#cfe0ff',.3),
          arms:[{side:-1,a:-2.75+Math.sin(now*30)*.2,len:80,w:22},{side:1,a:2.75-Math.sin(now*30)*.2,len:80,w:22}]}));
        cuca(400+sh+Math.sin(now*9)*5,524+1.6*(HY-38),1.25,Math.sin(now*6)*.3,{belly:true,fast:true,tw:1});
        const n=Math.min(16,Math.floor(v*11));
        for(let i=0;i<n;i++){const a=i*2.4+.5,bx=400+Math.cos(a)*560,by=300+Math.sin(a)*430,q=clamp((v-i/11)*2.4,0,1),len=q*(170+hash(i,1,9)*150),dx=-Math.cos(a),dy=-Math.sin(a),wv=Math.sin(now*8+i)*30;
          line([[bx,by],[bx+dx*len*.5-dy*wv,by+dy*len*.5+dx*wv],[bx+dx*len-dy*wv*1.6+dy*26,by+dy*len+dx*wv*1.6-dx*26]],13,'#0a0810');}
        for(let i=0;i<3;i++){const q=(now*1.6+i/3)%1;ctx.save();ctx.globalAlpha=1-q;txt('¡AAAH!',170+i*230,150-q*50+(i%2)*40,30+q*16,'#ffffff',(i-1)*.14);ctx.restore();}
        ctx.restore();line([[gameLeft(),576],[gameRight(),576]],4,INK);drawP();return;}
      /* el cuarto: pared, zócalo, almanaque, interruptor y una grieta */
      wash(gameLeft(),0,GAME_VIEW.width,600,'#f2d9a6','#ecc88e');
      rr(gameLeft(),520,GAME_VIEW.width,60,0,'#c98a4e',0);rr(gameLeft(),500,GAME_VIEW.width,22,0,'#8a5a30',0);line([[gameLeft(),500],[gameRight(),500]],4,INK);
      rr(600,112,130,150,6,'#fffdf2',4);rr(600,112,130,38,6,'#c4283a',3.5);txt('DICIEMBRE',665,131,14,'#ffffff',0,true);
      for(let i=0;i<15;i++)rr(612+(i%5)*22,160+Math.floor(i/5)*30,16,20,2,i===8?'#ffd23f':'#e8e8ee',0);
      rr(540,330,26,40,5,'#fffdf2',3.5);rr(549,340,8,14,2,'#c9ced6',2.5);
      line([[330,128],[346,170],[338,196],[356,232]],2.5,'#c9a877');
      /* el espejo: ahí te ves la cara */
      rr(60,140,220,270,18,'#8a5a30',5);
      ctx.save();path(rrP(74,154,192,242,10));ctx.clip();wash(74,154,192,242,'#cfe9f5','#eef8fc');
      bust(Object.assign({},TU,{x:164+(susto?Math.sin(now*44)*2.5:0),y:404-(win?Math.abs(Math.sin(now*9))*10:0),s:.95,look:1,mood:win?'grin':susto||lose?'yell':al>0||tw>.3?'panic':'worry',talk:susto?1:0,sweat:win?0:susto?2:1,teeth:1,
        arms:[{side:1,a:win?2.75+Math.sin(now*12)*.2:2.6+sw*.5,len:74,w:20,hand:(hx,hy)=>chanclaP(hx+4,hy-22,-.5,.8)},win?{side:-1,a:-2.75-Math.sin(now*12)*.2,len:74,w:20}:{side:-1,a:-.2,len:70,w:20}]}));
      ctx.restore();line([[92,170],[126,170]],4,'#ffffff');
      if(!g.result&&g.t<1.1/rs)BUS.tag(164,196);
      /* dónde pegó la chola antes de tiempo */
      for(const[mx,my]of marcas){ctx.save();ctx.translate(mx,my);ctx.rotate(-.5);ctx.globalAlpha=.55;ell(0,0,62,27,'#d3ad78',0);ctx.restore();}
      /* el bicho */
      if(win){ctx.save();ctx.globalAlpha=.25;ell(hit.x,532,34*hit.s*.6,8,INK,0);ctx.restore();cuca(hit.x,hit.y,hit.s,hit.r,{dead:true,belly:true});
        if(hit.vy===0)for(let i=0;i<3;i++){const a=now*5+i*TAU/3;txt('★',hit.x+Math.cos(a)*50,hit.y-64+Math.sin(a)*10,20,'#ffe14d');}}
      else if(fly){const p=lose?{x:CARA[0],y:CARA[1],s:7.65+e*30}:pos(u);ctx.save();ctx.globalAlpha=.2;ell(lerp(cx,p.x,.4)+18,lerp(cy,p.y,.4)+26,26*(1+u),30*(1+u),INK,0);ctx.restore();
        cuca(p.x,p.y,p.s,Math.sin(u*20)*.25,{wings:1,fly:true,fast:true,tw:1});}
      else cuca(cx,cy,1.15,crot,{wings:al>0?.38:0,tw,fast:Math.hypot(tx-cx,ty-cy)>2});
      /* tu brazo y la chola */
      const q=Math.sin(Math.min(1,sw*1.4)*PI/2),hx=lerp(REST[0],swT[0]+40,q),hy=lerp(REST[1],swT[1]+50,q)+(g.result?0:Math.sin(now*33)*2.5)-(win&&!q?Math.abs(Math.sin(now*9))*14:0);
      limb(860,640,hx+30,hy+34,56,TU.shirt,4.5);ell(hx+22,hy+24,30,27,TU.skin,4);chanclaP(hx-16,hy-22,-.75-q*.5,2.3);ell(hx+6,hy+12,13,16,TU.skin,3.5);
      if(sw>.5&&!win)for(let i=0;i<5;i++){const a=i/5*TAU+.3;line([[swT[0]+Math.cos(a)*40,swT[1]+Math.sin(a)*40],[swT[0]+Math.cos(a)*66,swT[1]+Math.sin(a)*66]],5,'#ffffff');}
      if(tarde&&!fly)txt('¡UY!',cx+10,cy-78,34,'#ff4d5e',-.1);
      if(win&&e>.75)bubble(310,112,'¡ESTA CASA SE RESPETA!',19,220,286);
      ctx.restore();line([[gameLeft(),576],[gameRight(),576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('cucaracha',{name:'¡MÁTALA!',mk:mkCucaracha,card:'LA CUCARACHA',num:'3'});
})();
