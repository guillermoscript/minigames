'use strict';
/* MiniCaos · laboratorio de estilos: ¡TÚMBALO! (bajar el mango de la mata con la vara).
   El patio: la mata de mango arriba y TÚ abajo con la vara larga, que en la punta tiene medio pote de refresco amarrado.
   La vara se pasea sola de lado a lado bajo la copa. Hay UN mango de hilacha maduro (amarillo, brilla): un toque (o ESPACIO)
   justo cuando la boca del pote le quede debajo = jalón, y el mango cae adentro. Jalar debajo de un avispero = ¡AVISPAS!
   Jalar al aire (o a un mango verde) no mata, pero la vara se queda pegada un ratico y el tiempo corre.
   Si se acaba el reloj (5 s / raíz de la velocidad) el mango se cae solo y se espachurra.
   Nivel 1: un avispero lejos, vara lenta, y el mango se enciende cuando estás alineado. Nivel 2: dos avisperos, uno a cada lado.
   Nivel 3: los avisperos más pegados, vara rápida y la rama se mece con la brisa.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.mango)return;
const LV=BUS.LV,CONF=BUS.CONF,TU=BUS.TU,say=BUS.say,tag=BUS.tag,FY=540,X0=140,X1=660,TY=300,MY=226,NY=224,S=.7,HOJAS=['#3f9a4a','#4fae58','#2f7f3c'];
/* el sello del laboratorio dura 0.7 s (no 1.6) para que no tape el chiste; el final completo dura 2.6 s */
const sello=f=>f<.7?f*1.6/.7:1.6+(f-.7)*.7/1.9;

function mango(x,y,s=1,rot=0,mordido=false){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
  ell(0,0,22,28,'#ffc02e',4);ell(-6,8,12,15,'#ff7a3d',0);ell(8,-13,4,6,'#fff3a8',0);
  if(mordido){ell(16,-13,13,12,'#ffe9a0',3);for(let i=0;i<3;i++)line([[10+i*5,-19+i*3],[14+i*5,-9+i*3]],1.5,'#e0a030');}   /* la hilacha */
  ctx.restore();}
function avispero(x,y,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  poly([[-18,-34],[18,-34],[30,-6],[22,26],[0,40],[-22,26],[-30,-6]],'#c9b08a',4);
  for(const yy of[-18,-2,14])line([[-24+Math.abs(yy)*.3,yy],[24-Math.abs(yy)*.3,yy]],2.5,'#9a8060');
  ell(0,24,8,7,'#3b2a22',2.5);ctx.restore();}
function avispa(x,y,s=1){const f=Math.sin(now*60+x)>0?1:.4;
  ell(x-4*s,y-6*s,5*s,3*s*f+1,'#ffffff',1.5);ell(x+4*s,y-6*s,5*s,3*s*f+1,'#ffffff',1.5);
  ell(x,y,8*s,5.5*s,'#ffd23f',2.5);line([[x-2*s,y-4*s],[x-2*s,y+4*s]],2*s,INK);line([[x+3*s,y-3.5*s],[x+3*s,y+3.5*s]],2*s,INK);}
/* medio pote de refresco amarrado a la punta: (x, y) = la punta de la vara; la boca queda 40 más arriba */
function pote(x,y,rot){ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  poly([[-24,-40],[-16,-46],[-8,-40],[0,-46],[8,-40],[16,-46],[24,-40],[19,8],[-19,8]],'#7fd9a0',4);
  rr(-21,-24,42,13,0,'#e8293f',0);rr(-21,-19,42,3,0,'#ffffff',0);
  line([[-18,0],[18,-7]],4,'#fff8e0');line([[-18,-7],[18,0]],4,'#fff8e0');ctx.restore();}
/* el patio: el cielo, la pared de bloques, el piso de tierra, el pipote y la mata */
function patio(){
  wash(0,0,800,360,'#8fd8ff','#dff4ff');
  rr(0,330,800,FY-330,0,'#e3b98a',0);line([[0,330],[800,330]],4,INK);
  for(let j=0;j<5;j++){line([[0,372+j*42],[800,372+j*42]],2,'#c99a6a');for(let i=0;i<9;i++)line([[i*96+(j%2)*48,330+j*42],[i*96+(j%2)*48,372+j*42]],2,'#c99a6a');}
  rr(0,FY,800,60,0,'#b97a46',0);line([[0,FY],[800,FY]],4,INK);
  for(let i=0;i<7;i++)line([[150+i*96,FY+8],[158+i*96,FY-6],[166+i*96,FY+8]],3,'#4fae58');
  rr(700,430,80,112,10,'#2f7fe0',4);line([[700,462],[780,462]],3,'#1f5fb0');line([[700,508],[780,508]],3,'#1f5fb0');
  poly([[26,FY],[48,300],[38,150],[98,150],[104,300],[122,FY]],'#8a5a30',4.5);line([[66,480],[72,360]],3,'#6a4020');line([[90,440],[86,330]],3,'#6a4020');
  limb(70,168,770,126,28,'#8a5a30',4);
  for(let i=0;i<9;i++)ell(40+i*92,72+(i%2)*26,88,74,HOJAS[i%2],4);
  for(let i=0;i<8;i++)ell(92+i*92,152+(i%3)*9,58,32,HOJAS[2],0);}

/* ═════════ ¡TÚMBALO!: un toque cuando el pote quede debajo del mango maduro ═════════ */
function mkMango(){
  const rs=Math.sqrt(SP),lv=LV(),V=[360,450,540][lv-1],TOL=[46,38,32][lv-1],NT=36,R=X1-X0,bw=TU.bw||50;
  const mx0=330+Math.random()*140,D=[0,125,98][lv-1]+Math.random()*24;
  const nests=lv===1?[mx0+(Math.random()<.5?-1:1)*(150+Math.random()*30)]:[mx0-D,mx0+D];
  const verdes=[150,230,310,390,470,550,630].filter(q=>Math.abs(q-mx0)>74&&nests.every(n=>Math.abs(q-n)>66)).filter((_,i)=>i%2===0);
  let p=mx0>400?0:1,yank=0,miss=0,fin=0,hit=-1,did=0,bz=0;
  const tx=()=>X0+R*(p<1?p:2-p),mx=()=>mx0+(lv>=3?Math.sin(g.t*3.1)*12:0);
  function jala(){if(g.result||yank>0)return;yank=1;snd(300,.12,'sawtooth',.05,-160);nz(.06,.08);
    const x=tx(),m=mx();
    if(Math.abs(x-m)<=TOL){g.result='win';g.why='¡MANGO!';sfx.win();spawn(m,MY-30,10,'bit',HOJAS,200,600,.7);return;}
    const n=nests.findIndex(q=>Math.abs(x-q)<=NT);
    if(n>=0){hit=n;g.result='lose';g.kind='avispas';g.why='¡AVISPAS!';sfx.crash();sfx.lose();spawn(nests[n],NY,8,'bit',['#c9b08a','#9a8060'],240,700,.7);return;}
    miss++;spawn(x,TY-80,6,'bit',HOJAS,180,500,.6);say(verdes.some(q=>Math.abs(x-q)<28)?'¡ESE ESTÁ VERDE!':'¡AIRE!',x,TY-90,'#ffe14d');}
  const g={get impact(){return this.result?clamp(1-fin/.5,0,1):0;},
    probe:()=>({tx:tx(),mx:mx(),nests,tol:TOL,nt:NT,v:V,yank:yank>0,miss,kind:g.kind}),
    t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,cmd:'¡TÚMBALO!',
    hint:'TOCA (o ESPACIO) cuando el pote quede justo DEBAJO del mango amarillo… ¡no del avispero!',
    press(){jala();},
    down(){jala();},
    update(dt){g.t+=dt;yank=Math.max(0,yank-dt*2.6);
      if(!g.result){if(yank<=0)p=(p+V/R*dt)%2;
        if(g.t>=g.dur){g.result='lose';g.kind='tarde';g.why='¡SE CAYÓ SOLO!';sfx.lose();}
        return;}
      fin+=dt;g.endT=sello(fin);
      if(g.result==='win'){if(did<1&&fin>.95){did=1;snd(220,.12,'square',.08,-90);nz(.08,.12);spawn(400,300,22,'conf',CONF);}}
      else if(g.kind==='avispas'){if((bz-=dt)<=0){bz=.07;snd(150+Math.random()*70,.08,'sawtooth',.03);}}
      else if(did<1&&fin>.4){did=1;sfx.thud();spawn(mx(),FY-8,14,'bit',['#ffc02e','#ff7a3d'],260,700,.8);}},
    draw(){
      const win=g.result==='win',av=g.kind==='avispas',tarde=g.kind==='tarde',e=fin,x=tx(),m=mx();
      const suelta=ease(win?clamp((e-.45)/.4,0,1):av?clamp((e-.1)/.4,0,1):0);          /* cuánto se ha caído la vara */
      const bx=400+(x-400)*.85,yk=ease(yank)*46,mordio=win&&e>.95;
      const X=bx-50+(av&&e>.5?Math.sin(now*13)*36:0),Y=FY-160*S+yk*.25-(g.result?0:Math.abs(Math.sin(now*13))*4)-(mordio?Math.abs(Math.sin(now*10))*8:0);
      /* la vara: de la base B a la punta T (cuando la sueltas se va de lado hasta el piso) */
      const a0=Math.atan2(x-bx,470-TY-yk),L=Math.hypot(x-bx,470-TY-yk),a=lerp(a0,1.5,suelta),B=[bx,lerp(470,FY-8,suelta)],T=[B[0]+Math.sin(a)*L,B[1]-Math.cos(a)*L];
      const en=k=>[lerp(B[0],T[0],k),lerp(B[1],T[1],k)],g1=en(.1),g2=en(.3);
      const brazo=(side,w)=>{const dx=(w[0]-X)/S-side*bw*.78,dy=(w[1]-Y)/S-4;return{side,a:Math.atan2(dx,dy),len:clamp(Math.hypot(dx,dy),24,150),w:19};};
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      patio();
      /* lo que cuelga de la mata: los verdes, los avisperos y el maduro */
      for(const q of verdes){line([[q,184],[q,204]],3,'#5a7a2a');ell(q,222,15,20,'#6fbf4a',3.5);}
      nests.forEach((q,i)=>{const cae=av&&i===hit,u=cae?clamp(e/.45,0,1):0;line([[q,180],[q,192]],4,'#5a4030');
        avispero(q,lerp(NY,FY-36,u*u),cae?u*2.2:Math.sin(now*2+i)*.05);
        if(!cae)for(let j=0;j<3;j++)avispa(q+Math.cos(now*3.2+j*2.1+i)*46,NY+Math.sin(now*4.1+j*1.7)*30,.8);});
      line([[m,182],[m,MY-26]],3.5,'#5a7a2a');
      if(!win){const u=tarde?clamp(e/.4,0,1):0;
        if(u<1){mango(m,lerp(MY,FY-18,u*u),1,Math.sin(now*3)*.06+u*2);
          if(!g.result){for(let i=0;i<4;i++){const r=i*TAU/4+now*1.5;line([[m+Math.cos(r)*36,MY+Math.sin(r)*40],[m+Math.cos(r)*46,MY+Math.sin(r)*50]],3.5,'#fff3a8');}
            if(lv===1&&Math.abs(x-m)<=TOL)line(closeP(ellP(m,MY,31,37,16)),5,'#ffffff');}}
        else{ell(m,FY-6,46,12,'#ffc02e',3.5);ell(m+12,FY-8,16,5,'#ff7a3d',0);ell(m-58,FY-2,10,5,'#ffc02e',2.5);ell(m+64,FY-3,8,4,'#ffc02e',2.5);}}
      /* TÚ, con la vara en las dos manos */
      const agarra=suelta<.05,arriba=sg=>({side:sg,a:sg*(2.6+Math.sin(now*24+sg)*.3),len:74,w:19});
      bust(Object.assign({},TU,{x:X,y:Y,s:S,th:110,legs:['#2f3a7a','#ffffff',60],look:g.result?0:Math.sign(x-X-50)||1,
        mood:mordio?'happy':win?'grin':av?(e>.3?'yell':'o'):tarde?'frown':yank>0?'o':'worry',talk:av?.5+.5*Math.sin(now*20):0,sweat:av?2:g.result?0:1,lids:tarde?1:0,
        arms:agarra?[brazo(1,g1),brazo(-1,g2)]:win?[{side:1,a:2.9,len:62,w:19},{side:-1,a:-.3,len:70,w:19}]:[arriba(1),arriba(-1)]}));
      /* el mango ya en el pote, la vara y el pote */
      if(win&&e<.45){const u=clamp(e/.18,0,1);mango(lerp(m,T[0],u),lerp(MY,T[1]-22,u*u),1,u*.4);}
      line([B,T],14,INK);line([B,T],8,'#c9965a');pote(T[0],T[1],a*.6);
      if(agarra)for(const w of[g1,g2])ell(w[0],w[1],9.5,9.5,TU.skin,3);
      /* a la mano, y el mordisco con concha y todo */
      if(win&&e>=.45){const H=[X+(bw*.78+62*Math.sin(2.9))*S,Y+(4+62*Math.cos(2.9))*S-4],u=clamp((e-.45)/.4,0,1);
        mango(lerp(x,H[0],ease(u)),lerp(TY-22,H[1],u)-Math.sin(u*Math.PI)*70,.9,u<1?u*TAU:.2,mordio);
        if(mordio)for(let i=0;i<3;i++){const q=(now*1.6+i/3)%1;ell(H[0]-20+i*6,H[1]+14+q*46,3,5,'#ffc02e',2);}}
      /* las avispas, las picadas y el zumbido */
      if(av){const u=ease(clamp((e-.15)/.45,0,1)),cx=lerp(nests[hit],X,u),cy=lerp(NY,Y-50,u);
        for(let j=0;j<16;j++)avispa(cx+Math.cos(now*9+j*2.1)*(26+hash(j,1,2)*46),cy+Math.sin(now*11+j*1.7)*(22+hash(j,2,2)*36),1);
        for(let i=0;i<26;i++){const k=(e-.55-i*.05)*9;if(k<=0)break;
          const s=Math.min(1,k)*(1+.3*Math.max(0,1-Math.abs(k-1))),px=30+hash(i,1,9)*740,py=50+hash(i,2,9)*480,r=(16+hash(i,3,9)*20)*s;
          ell(px,py,r,r,'#ff4d5e',3.5);ell(px-r*.2,py-r*.25,r*.45,r*.4,'#ff9aa8',0);ell(px,py,r*.16,r*.16,'#8a0f24',0);}
        if(e>.15)txt('¡BZZZ!',400+Math.sin(now*40)*4,128,54,'#ffe14d',Math.sin(now*30)*.04);}
      if(!g.result&&g.t<1/rs)tag(X-44,Y-124);
      if(mordio&&e>1.25)bubble(clamp(X+40,190,610),Y-150,'¡CON CONCHA Y TODO!',20,X+20,Y-76);
      if(win&&e>.95&&e<1.5)txt('¡ÑAM!',X+112,Y-70,30,'#ffffff',-.1);
      if(tarde&&e>.7)bubble(clamp(X+40,200,600),Y-150,'¡TAN BUENO QUE ESTABA!',19,X+20,Y-76);
      ctx.restore();line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('mango',{name:'¡TÚMBALO!',mk:mkMango,card:'EL MANGO',num:'16'});
})();
