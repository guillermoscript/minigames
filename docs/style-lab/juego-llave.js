'use strict';
/* MiniCaos · laboratorio de estilos: ¡ELIGE LA LLAVE! (la llave correcta del candado de la reja).
   Llegas a tu casa de noche y empieza a lloviznar. En la reja hay un candado plateado enorme y traes un manojo de 5 llaves
   casi iguales: mamá le pintó una marquita de esmalte de uñas ROJO a la buena. Hay que agarrar esa y ARRASTRARLA hasta la
   boca del candado antes de que caiga el aguacero (unos 2 segundos: 2.6 s en el nivel 1, 2.2 s en el 2, 1.9 s en el 3).
   Meter otra = ¡ÑIC!, se traba en el cilindro y te empapas tratando de sacarla. Soltarla lejos del candado solo la devuelve al manojo.
   Nivel 1: solo la buena tiene marca. Nivel 2: una señuelo con tirro y el manojo se bambolea. Nivel 3: otra más, con forro azul.
   La marca buena es una MANCHA en la cabeza de la llave (no solo un color), para que se distinga en los estilos de un solo tono.
   Teclado: ← → escogen la llave y ESPACIO la mete.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.llave)return;
const LV=BUS.LV,CONF=BUS.CONF,TU=BUS.TU,tag=BUS.tag,PI=Math.PI,L=128,MET='#c9ced6',REJA='#e8e8ee';

/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;

/* una llave: (x, y) = centro de la cabeza; la paleta sale hacia "arriba" (-y) y mide L. Los dientes cambian con q.seed */
function llave(x,y,rot,q,hi){ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  if(hi){ctx.save();ctx.globalAlpha=.55+.35*Math.sin(now*14);line(closeP(ellP(0,0,46,42,18)),7,'#ffe14d');ctx.restore();}
  rr(-9,-L,18,L-22,4,MET,3.5);
  for(let i=0;i<4;i++)rr(7,-L+8+i*19,7+((q.seed+i*3)%4)*3,11,2,MET,3);
  line([[-2,-L+10],[-2,-34]],2.5,'#8f8fa8');
  ell(0,0,34,30,MET,4);ell(0,13,8,8,'#3b3550',2.5);
  if(q.mark==='roja'){ell(-3,-9,16,12,'#e8293f',3);ell(11,-2,7,6,'#e8293f',0);ell(-8,-13,5,3,'#ffb0bb',0);}
  else if(q.mark==='tirro')rr(-35,-17,70,15,2,'#fff3c4',3);
  else if(q.mark==='forro')line(closeP(ellP(0,0,33,29,18)),8,'#3fb0ff');
  ctx.restore();}
/* el candado: (x, y) = centro del cuerpo; ab = cuánto se abrió el gancho. La llave entra por debajo */
function candado(x,y,ab){
  ctx.save();ctx.translate(x+40,y-38);ctx.rotate(ab*.45);ctx.translate(0,-ab*20);
  const U=[[0,14],[0,-16]].concat(arcPts(-40,-16,40,0,-PI,10),[[-80,14]]);line(U,25,INK);line(U,15,'#aeb4c2');ctx.restore();
  rr(x-72,y-44,144,118,20,MET,5);rr(x-58,y-32,116,14,7,'#eef1f6',0);
  ell(x,y+12,19,19,'#aeb4c2',3.5);txt('MACIZO',x,y+46,14,'#5a5274',0,true);rr(x-13,y+62,26,12,3,INK,0);}
/* la lluvia: llovizna que se vuelve aguacero */
function lluvia(n,fuerte){ctx.save();ctx.globalAlpha=fuerte?.8:.55;
  for(let i=0;i<n;i++){const sp=640+hash(i,3,3)*360,x=((hash(i,1,1)*980-now*130)%980+980)%980-90,y=((hash(i,2,2)*660+now*sp)%660)-50,l=fuerte?36:20;
    line([[x,y],[x-l*.28,y+l]],fuerte?3:2,'#cfeaff');}
  ctx.restore();}

/* ═════════ ¡ELIGE LA LLAVE!: la del esmalte rojo, al candado, antes del aguacero ═════════ */
function mkLlave(){
  const rs=Math.sqrt(SP),lv=LV(),R=440,PY=928,CX=400,CY=250,K=[CX,CY+74],SW=[0,.07,.11][lv-1],good=Math.floor(Math.random()*5);
  const otras=[0,1,2,3,4].filter(i=>i!==good);for(let i=otras.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[otras[i],otras[j]]=[otras[j],otras[i]];}
  /* el manojo en abanico: hx, hy = dónde descansa cada cabeza; x, y, r = dónde está ahora */
  const keys=[0,1,2,3,4].map(i=>{const a=(i-2)*.22,hx=CX+R*Math.sin(a),hy=PY-R*Math.cos(a);
    return{i,a,hx,hy,x:hx,y:hy,r:a,seed:i*5+1,mark:i===good?'roja':lv>=2&&i===otras[0]?'tirro':lv>=3&&i===otras[1]?'forro':null};});
  let di=-1,ins=-1,sel=2,kb=false,px=0,py=0,patter=0,boom=false,tug=0,fin=0;
  const punta=()=>Math.hypot(px-K[0],py-L-K[1]);
  function mete(i){if(g.result)return;ins=i;di=-1;
    if(i===good){g.result='win';g.why='¡CLIC!';nz(.04,.3);snd(1900,.05,'square',.08);snd(240,.12,'sine',.2,-80);setTimeout(()=>sfx.win(),160);spawn(K[0],K[1]-60,22,'conf',CONF);}
    else{g.result='lose';g.kind='traba';g.why='¡ÑIC!';snd(420,.22,'sawtooth',.08,-260);nz(.12,.18);sfx.lose();}}
  /* la llave más cercana al dedo (cabeza o paleta) */
  function agarra(p){let b=-1,bd=58;for(const q of keys){const d=Math.min(Math.hypot(p.x-q.x,p.y-q.y),Math.hypot(p.x-(q.x+Math.sin(q.r)*L*.55),p.y-(q.y-Math.cos(q.r)*L*.55)));if(d<bd){bd=d;b=q.i;}}return b;}
  const g={lr:true,get impact(){return this.result?clamp(1-this.endT/.5,0,1):0;},
    probe:()=>({good,sel,di,ins,L,K:{x:K[0],y:K[1]},keys:keys.map(q=>({x:q.hx,y:q.hy,mark:q.mark})),kind:g.kind}),
    t:0,dur:2.6/rs,result:null,why:'',kind:'',endT:0,cmd:'¡ELIGE LA LLAVE!',
    hint:'ARRASTRA la llave de la MANCHA ROJA hasta el candado (o ← → y ESPACIO)',
    press(k){if(g.result)return;kb=true;
      if(k==='left'||k==='right'){sel=clamp(sel+(k==='left'?-1:1),0,4);snd(700+sel*60,.04,'square',.04);return;}
      mete(sel);},
    down(p){if(g.result)return;const b=agarra(p);if(b<0)return;di=sel=b;kb=false;px=p.x;py=p.y;snd(1250,.04,'square',.04);snd(1700,.05,'square',.03);},
    move(p){if(di<0||g.result)return;px=clamp(p.x,30,770);py=clamp(p.y,150,560);if(punta()<40)mete(di);},
    up(){if(di<0||g.result)return;if(punta()<84)mete(di);else{di=-1;sfx.whoosh();}},
    update(dt){g.t+=dt;
      const lead=ins>=0?ins:di,u=Math.min(1,dt*(ins>=0?24:20)),wr=g.result==='lose'&&g.kind==='traba';
      keys.forEach((q,j)=>{let tx=q.hx,ty=q.hy,tr=q.a+(SW&&!g.result?Math.sin(g.t*(4.3+j*.7)+j*1.9)*SW:0);
        if(lead>=0){const m=keys[lead];
          if(j!==lead){const n=j<lead?j:j-1,b=(n-1.5)*.42+Math.sin(g.t*8+j*2)*(wr?.16:.07);tx=m.x+33*Math.sin(b);ty=m.y+33+33*Math.cos(b);tr=PI-b;}   /* las demás cuelgan del aro */
          else if(ins<0){tx=px;ty=py;tr=0;}
          else{tx=K[0]+(wr?Math.sin(now*46)*3:0);ty=K[1]+L-36+(wr?Math.abs(Math.sin(now*23))*5:0);tr=wr?Math.sin(now*37)*.05:0;}}
        q.x=lerp(q.x,tx,u);q.y=lerp(q.y,ty,u);q.r=lerp(q.r,tr,u);});
      if(!g.result){if((patter-=dt)<=0){patter=.08;nz(.04,.006+.02*clamp(g.t/g.dur,0,1));}
        if(g.t>=g.dur){g.result='lose';g.kind='agua';g.why='¡TE EMPAPASTE!';di=-1;sfx.lose();}
        return;}
      fin+=dt;g.endT=sello(fin);
      if(!boom&&fin>(g.result==='win'?.95:.2)){boom=true;nz(1.5,.15);snd(64,1.2,'sawtooth',.09,-24);}   /* el trueno */
      if(wr&&(tug-=dt)<=0){tug=.28;snd(310,.05,'square',.035,-130);}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',wr=lose&&g.kind==='traba',e=fin,k=win?0:lose?1:clamp(g.t/g.dur,0,1);
      const pour=lose?clamp((e-.2)/.2,0,1):win?clamp((e-.95)/.2,0,1):0,ab=win?ease(clamp((e-.05)/.15,0,1)):0,open=win?ease(clamp((e-.28)/.45,0,1)):0;
      const run=win?ease(clamp((e-.5)/.45,0,1)):0,dentro=run>.6,lead=ins>=0?ins:di,nub=Math.max(k,pour),grita=(lose&&e>.4)||(win&&e>1.25);
      const yo=(x,y,s,o)=>bust(Object.assign({},TU,{x,y,s,th:110,legs:['#2f3a7a','#ffffff',60]},o));
      const barra=x=>rr(x-4,126,8,330,3,REJA,2.5);
      const manojo=()=>{
        if(lead<0)line(arcPts(CX,PY,R-13,-PI/2-.5,-PI/2+.5,14),4.5,'#ffd23f');
        else line(closeP(ellP(keys[lead].x,keys[lead].y+33,20,20,14)),4.5,'#ffd23f');
        for(const q of keys)if(q.i!==lead)llave(q.x,q.y,q.r,q,lose&&q.i===good);
        if(lead>=0){const m=keys[lead];ctx.save();ctx.translate(m.x,m.y);ctx.scale(1-.7*ab,1);llave(0,0,m.r,m,false);ctx.restore();}};
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      /* de noche: la luna se va tapando */
      wash(0,0,800,600,'#232a52','#3a3f6e');ell(716,50,24,24,'#fff3c4',0);
      for(let i=0;i<3;i++)ell(lerp(930,690,nub)+i*44,46+(i%2)*14,46,22,'#4a4f7a',0);
      /* la casa: fachada, alero, la puerta y el bombillo del porche */
      rr(0,112,800,360,0,'#b5654a',0);
      for(let i=0;i<7;i++)rr(30+i*118,150+(i*67)%250,56,14,3,'#a3573f',0);
      rr(-10,92,820,26,6,'#7a3b2e',4);
      rr(336,196,128,280,6,'#6b4226',4.5);rr(352,214,96,100,4,'#7d5030',3);ell(448,350,6,6,'#ffd23f',2.5);
      ctx.save();ctx.globalAlpha=.3;ell(232,170,54,44,'#ffe9a8',0);ctx.restore();rr(226,126,12,20,2,'#5a5274',2.5);ell(232,160,11,13,'#fff3a8',3);
      /* la ventana de mamá: ella fue la del esmalte */
      rr(572,170,176,140,8,'#3b2a22',4.5);
      ctx.save();path(rrP(580,178,160,124,5));ctx.clip();wash(580,178,160,124,'#ffe9a8','#ffd27a');
      bust(Object.assign({},FACES[5],{x:660,y:304,s:.74,th:60,bw:50,look:-1,mood:grita?'yell':win?'smile':lose?'o':k>.6?'worry':'angry',talk:grita?Math.abs(Math.sin(now*13)):0,vein:lose?1:0}));
      rr(580,178,20,124,0,'#ff9ec7',2.5);rr(720,178,20,124,0,'#ff9ec7',2.5);
      ctx.restore();
      /* la acera y los charcos */
      rr(0,462,800,140,0,'#5a5274',0);line([[0,462],[800,462]],4,INK);
      if(nub>.15)for(const[x,y,w]of[[170,548,70],[620,532,90],[430,560,56]])ell(x,y,w*nub,w*.22*nub,'#7f8fc0',0);
      /* ya adentro, sequito */
      if(dentro)yo(lerp(112,400,run),374-Math.abs(Math.sin(now*9))*10,lerp(.95,.84,run),{mood:'happy',arms:[{side:1,a:2.6+Math.sin(now*11)*.25,len:78,w:20},{side:-1,a:-2.6+Math.sin(now*11)*.25,len:78,w:20}]});
      /* la reja: dos hojas que se abren hacia adentro; el candado cuelga de la derecha */
      for(let i=0;i<7;i++){barra(22+i*42);barra(778-i*42);}
      for(const x0 of[0,512]){rr(x0,120,288,12,0,REJA,3);rr(x0,448,288,12,0,REJA,3);}
      ctx.save();ctx.translate(300,0);ctx.scale(1-.84*open,1);rr(0,120,100,12,0,REJA,3);rr(0,448,100,12,0,REJA,3);for(const x of[26,60,95])barra(x);ctx.restore();
      ctx.save();ctx.translate(500,0);ctx.scale(1-.84*open,1);ctx.translate(-500,0);
      rr(400,120,100,12,0,REJA,3);rr(400,448,100,12,0,REJA,3);for(const x of[405,440,474])barra(x);
      for(const x of[374,400,426])line(closeP(ellP(x,CY-80-(x===400?6:0),15,10,12)),5,'#8f8fa8');
      if(ins>=0)manojo();
      candado(CX+(wr?Math.sin(now*46)*2.5:0),CY+(wr?Math.abs(Math.sin(now*23))*3:0),ab);
      if(!g.result){ctx.save();ctx.globalAlpha=.5+.35*Math.sin(now*9);line(closeP(ellP(K[0],K[1]+2,30,16,14)),4,'#ffe14d');ctx.restore();}
      ctx.restore();
      rr(288,108,12,356,4,MET,3.5);rr(500,108,12,356,4,MET,3.5);
      /* tú, afuera */
      if(!dentro){
        if(wr){const u=ease(clamp(e/.2,0,1)),X=lerp(112,246,u),S=.95,m=keys[ins],lx=(m.x-X)/S-39,ly=(m.y-386)/S-4;
          yo(X+Math.sin(now*40)*1.5,386,S,{hair:'slick',mood:e>.5?'frown':'yell',talk:e<.5?1:0,look:1,lids:e>.9?1:0,sweat:2,rot:.05,
            arms:[{side:1,a:Math.atan2(lx,ly),len:clamp(Math.hypot(lx,ly),40,190),w:20},{side:-1,a:-.2,len:78,w:20}]});}
        else if(lose)yo(112+Math.sin(now*40)*1.5,386,.95,{hair:'slick',mood:'frown',lids:1,sweat:2,look:1,arms:[{side:1,a:-.5,len:56,w:20},{side:-1,a:.5,len:56,w:20}]});
        else yo(lerp(112,400,run),386,.95,{look:1,mood:win?'happy':k>.66?'panic':'worry',sweat:win?0:k>.5?1:0,arms:[{side:1,a:.95,len:72,w:20},{side:-1,a:-.15,len:80,w:20}]});
        if(!g.result)tag(112,262);}
      /* el manojo en la mano (o colgando de la llave que arrastras) */
      if(ins<0){manojo();
        if(kb&&!g.result){const q=keys[sel];txt('▼',q.x+Math.sin(q.r)*(L+24),q.y-Math.cos(q.r)*(L+24)+Math.sin(now*10)*4,26,'#ffe14d');}}
      lluvia(Math.round(10+k*34+pour*70),pour>.5);
      if(pour>.5)for(let i=0;i<10;i++){const u=(now*2.2+hash(i,5,5))%1;ctx.save();ctx.globalAlpha=1-u;line(closeP(ellP(hash(i,6,6)*800,476+hash(i,7,7)*90,4+u*16,2+u*5,10)),2,'#cfeaff');ctx.restore();}
      if(pour>0&&pour<1){ctx.save();ctx.globalAlpha=.5*(1-pour);rr(0,0,800,576,0,'#ffffff',0);ctx.restore();}   /* el relámpago */
      if(lose&&e>.4)bubble(wr?540:560,146,wr?'¡LA DEL ESMALTE ROJO, MIJO!':'¡MIJO, TE VAS A RESFRIAR!',17,650,202);
      if(win&&e>1.05)bubble(292,214,'¡SEQUITO!',22,376,282);
      if(win&&e>1.25)bubble(600,146,'¡Y PÁSALE LLAVE!',19,650,202);
      ctx.restore();line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('llave',{name:'¡LA LLAVE!',mk:mkLlave,card:'EL CANDADO',num:'9'});
})();
