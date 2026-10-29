'use strict';
/* LA FIESTA · versus: ¡LA COLA DE LA GASOLINA! Luz roja / luz verde en la cola de la bomba: cada TOQUE adelanta tu carrito un paso,
   pero SOLO mientras el fiscal está de espaldas. Si se voltea y tocas: ¡COLEADO! (3 pasos atrás y 0.6 s congelado).
   1 botón. ffa, 2v2 (suma del equipo) y 1v3 (media del trío). Score = % recorrido (0..100) + 25 al primero que llega. */
(function(){
if(!window.FIESTA||!FIESTA.VS||FIESTA.VS.games.f_cola)return;
const TEAMCOL=['#ffd23f','#3fb0ff','#ff5c8a','#5cff7a'],TEAMNAME=['AMARILLO','AZUL','ROSA','VERDE'];
const say=(s,x,y,col)=>PT.push({x,y,vx:0,vy:-60,g:0,t:0,life:.9,kind:s,col,r:-2,rot:0,vr:0});
const beep=(f,d,ty,v,sl)=>{if(typeof snd==='function')snd(f,d,ty||'square',v||.05,sl||0);};
FIESTA.VS.add('f_cola',{name:'¡LA COLA DE LA GASOLINA!',modos:['ffa','2v2','1v3'],dur:18,botones:1,
hint:'TOCA CUANDO NO MIRE: ¡SI SE VOLTEA, QUIETO!',
mk(c){
  const n=c.n,STEP=100/(40+6*c.lv),DUR=18;
  const pos=new Array(n).fill(0),frz=new Array(n).fill(0),stk=new Array(n).fill(0),bnc=new Array(n).fill(0);
  const cs=[...Array(n).keys()].map(()=>({id:-1,sees:false,delay:.3,stopped:false,wait:0}));
  let t=0,phase='green',el=0,pd=rngGreen(true),tellId=0,lastFake=false,fakePending=false;
  let gAt=DUR*(.4+.3*c.rng.next()),gDone=false,gT=0;
  let sgAt=c.lv>=3?DUR*(.28+.2*c.rng.next()):1e9,sgDone=false,sgT=0;
  let banner=null,vend={x:gameLeft()+120,dir:1,said:0},bonusDone=false;
  function rngGreen(first){const a=first?1.4:1.2,b=first?2.4:3.2;let d=a+c.rng.next()*(b-a);if(c.lv>=3)d*=.8;return d;}
  function ban(s,col,life){banner={s,col,t:life||1,max:life||1};}
  function geo(){const x0=gameLeft(),x1=gameRight(),top=160,bot=c.campoAbajo-30,lh=Math.min(90,(bot-top)/n),t0=top+((bot-top)-lh*n)/2;
    return{x0,x1,L:x0+84,R:x1-124,lh,t0,cx:(x0+x1)/2};}
  function carX(G,p){return G.L+pos[p]/100*(G.R-G.L);}
  function setPhase(ph,d){phase=ph;el=0;pd=d;}
  const g={scores:new Array(n).fill(0),fin:false,
    update(dt){
      t+=dt;el+=dt;
      /* eventos compartidos */
      if(!gDone&&t>=gAt){gDone=true;gT=3;ban('¡LLEGÓ LA GANDOLA!',TEAMCOL[0],1.4);beep(120,.5,'sawtooth',.07,-40);}
      if(!sgDone&&t>=sgAt){sgDone=true;sgT=3;
        let b=0;for(let p=1;p<n;p++)if(pos[p]>pos[b])b=p;
        if(pos[b]>5){pos[b]=Math.max(0,pos[b]-15);const G=geo();say('¡A LA OTRA BOMBA!',carX(G,b),G.t0+b*G.lh-8,'#ff4d5e');beep(220,.4,'sawtooth',.07,-120);}
        ban('¡SE ACABÓ LA GASOLINA!','#ff4d5e',1.5);}
      if(gT>0)gT-=dt;if(sgT>0)sgT-=dt;
      if(banner){banner.t-=dt;if(banner.t<=0)banner=null;}
      /* máquina del fiscal */
      if(phase==='green'&&el>=pd){tellId++;fakePending=c.lv>=2&&c.rng.next()<(c.lv>=3?.45:.3);setPhase('tell',.25);}
      else if(phase==='tell'&&el>=pd){
        if(fakePending){setPhase('fake',.55);}
        else{setPhase('red',.8+c.rng.next()*1.2);ban('¡QUIETO TODO EL MUNDO!','#ff4d5e',.9);beep(1900,.3,'square',.05);beep(1500,.25,'square',.04);}
      }
      else if(phase==='fake'&&el>=pd){lastFake=true;setPhase('green',rngGreen(false));if(c.rng.next()<.5)say('ah no, nada',geo().cx+30,108,'#fff');}
      else if(phase==='red'&&el>=pd){lastFake=false;setPhase('green',rngGreen(false));}
      /* toques */
      const mult=gT>0?2:1,G=geo(),reached=[];
      for(let p=0;p<n;p++){
        frz[p]=Math.max(0,frz[p]-dt);stk[p]=Math.max(0,stk[p]-dt);bnc[p]=Math.max(0,bnc[p]-dt*6);
        const k=c.tap(p,'a');
        if(k&&frz[p]<=0){
          if(phase==='red'){pos[p]=Math.max(0,pos[p]-3*STEP);frz[p]=.6;stk[p]=1.1;beep(180,.25,'square',.07,-60);
            say('¡COLEADO!',carX(G,p),G.t0+p*G.lh-6,'#ff4d5e');
            for(let i=0;i<4;i++)PT.push({x:carX(G,p),y:G.t0+p*G.lh+G.lh/2,vx:(c.rng.next()-.5)*160,vy:-60-c.rng.next()*80,g:300,t:0,life:.6,kind:'bit',col:'#999',r:6,rot:0,vr:3});}
          else{pos[p]=Math.min(100,pos[p]+k*STEP*mult);bnc[p]=1;
            if(c.rng.next()<.5)PT.push({x:carX(G,p)-30,y:G.t0+p*G.lh+G.lh/2+8,vx:-60,vy:-20,g:0,t:0,life:.5,kind:'bit',col:'#aaa',r:4,rot:0,vr:2});}
        }
        g.scores[p]=pos[p];
        if(pos[p]>=100)reached.push(p);
      }
      if(reached.length&&!bonusDone){bonusDone=true;const w=reached.length>1?c.rng.pick(reached):reached[0];g.scores[w]+=25;
        for(let i=0;i<14;i++)PT.push({x:carX(G,w),y:G.t0+w*G.lh+G.lh/2,vx:(c.rng.next()-.5)*400,vy:-200-c.rng.next()*200,g:700,t:0,life:.9,kind:'conf',col:TEAMCOL[i%4],r:6,rot:0,vr:5});
        say('¡LLENÓ EL TANQUE!',carX(G,w),G.t0+w*G.lh-10,'#fff');beep(660,.3,'square',.06,300);g.fin=true;}
      /* vendedor de cafecito */
      vend.x+=vend.dir*40*dt;if(vend.x>G.x1-140)vend.dir=-1;if(vend.x<G.x0+60)vend.dir=1;
      vend.said-=dt;if(vend.said<=0){vend.said=4+c.rng.next()*3;say('¡CAFECITO!',vend.x,c.campoAbajo-48,'#ffe14d');}
    },
    ai(p,dt,api){
      const s=c.skill[p],I=cs[p];
      if(I.id!==tellId){I.id=tellId;I.sees=c.rng.next()<.55+.4*s;I.delay=(.35-.2*s)*(.8+.4*c.rng.next());I.stopped=false;}
      const since=phase==='tell'?el:phase==='green'?0:.25+el;
      let stop=false;
      if(phase==='tell'||phase==='fake'||phase==='red'){
        const need=I.sees?I.delay:I.delay+.35;
        if(phase==='fake'){if(I.sees&&since>=I.delay)stop=true;}
        else if(since>=need)stop=true;
        if(stop)I.stopped=true;
        if(!I.stopped)stop=false;else stop=true;
      }else{
        if(I.stopped){I.stopped=false;I.wait=lastFake?(1-s)*.9*(.6+.8*c.rng.next()):.12+.2*c.rng.next();}
        if(I.wait>0){I.wait-=dt;stop=true;}
      }
      if(!stop&&c.rng.next()<(3+s*5)*dt)api.press('a');
    },
    draw(){
      const G=geo(),x0=G.x0,x1=G.x1,w=x1-x0,cx=G.cx,top=G.t0;
      /* fondo: acera arriba, asfalto, bodegón */
      rr(x0,0,w,c.campoAbajo,0,'#2f3a46',0);
      rr(x0,64,w,98,0,'#9a9484',0);
      for(let i=0;i<8;i++)rr(x0+i*(w/8),152,w/16,8,0,'#b8b2a0',0);
      /* lanes */
      for(let p=0;p<n;p++){
        const y=top+p*G.lh,yy=y+G.lh/2,team=c.equipos[p];
        rr(x0+12,y+3,w-24,G.lh-6,10,p%2?'#4a5260':'#434b58',3);
        for(let i=0;i<12;i++)rr(G.L-20+i*((G.R-G.L+40)/12),yy+G.lh*.3,22,3,1,'#6a7384',0);
        if(c.modo!=='ffa')rr(x0+12,y+3,10,G.lh-6,4,TEAMCOL[team%4],2.5);
        txt('P'+(p+1),x0+40,yy-8,17,c.col[p],0,true);
        txt(c.cpu[p]?'cpu':(c.modo==='1v3'&&c.solo===p?'★ solo':''),x0+40,yy+12,11,'#fff',0,true);
        /* bomba */
        const bx=G.R+54;
        rr(bx,yy-24,30,46,6,'#d63a3a',3);rr(bx+5,yy-18,20,14,3,'#bfe6ff',2);rr(bx+3,yy+8,24,6,2,'#ffd23f',0);
        line([[bx+30,yy-8],[bx+40,yy-2],[bx+38,yy+14]],3,'#222');
      }
      rr(G.R+8,top,10,G.lh*n,0,'#fff3c4',3);
      for(let i=0;i<n*2;i++)rr(G.R+8,top+i*G.lh/2,10,G.lh/4,0,'#222',0);
      /* coches */
      for(let p=0;p<n;p++){
        const y=top+p*G.lh,yy=y+G.lh/2,x=carX(G,p),b=Math.sin(t*28+p)*(frz[p]>0?2.5:0)+(bnc[p]>0?-3*bnc[p]:0),cy=yy+b-2;
        ell(x,cy+16,34,7,'rgba(0,0,0,.3)',0);
        ell(x-17,cy+11,8,8,'#16141c',3);ell(x+17,cy+11,8,8,'#16141c',3);
        rr(x-28,cy-8,56,22,8,frz[p]>0?'#8c8c96':c.col[p],3.5);
        rr(x-13,cy-20,28,15,6,'#bfe6ff',3);ell(x+27,cy+1,4,4,'#fff6a0',0);
        txt(Math.round(pos[p])+'%',x,y+11,13,'#fff',0,true);
        if(stk[p]>0){ctx.save();ctx.globalAlpha=Math.min(1,stk[p]*3);rr(x-38,cy-34,76,18,5,'#ff4d5e',3);txt('COLEADO',x,cy-25,13,'#fff',-.08,true);ctx.restore();}
      }
      /* fiscal */
      this.fiscal(cx,128);
      /* semáforo + texto */
      const green=phase==='green'||phase==='fake',tell=phase==='tell',lx=x0+60,ly=118;
      rr(lx-4,ly+20,8,26,2,'#222',2);
      ell(lx,ly,28,28,tell?'#ffd23f':green?'#3fe06a':'#ff3b3b',4);ell(lx-8,ly-9,9,6,'#fff6',0);
      txt(green?'VAMOS':tell?'¡OJO!':'ALTO',lx,ly,14,'#14101c',0,true);
      const tx=(x0+100+cx-60)/2;
      txt(phase==='red'?'¡QUIETO TODO EL MUNDO!':'TOCA CUANDO NO MIRE',tx,104,15,phase==='red'?'#ff4d5e':'#14101c',0,true);
      txt(phase==='red'?'(no toques)':gT>0?'¡DOBLE PASO!':'toca, toca, toca',tx,128,12,'#3a3a3a',0,true);
      /* equipos / marcador */
      if(c.modo==='2v2'){
        const s=[0,0];c.equipos.forEach((e,i)=>{s[e]+=g.scores[i];});
        for(let e=0;e<2;e++)txt('EQ '+TEAMNAME[e]+' '+Math.round(s[e]),cx+58,96+e*20,13,e?'#1f6fb0':'#8a6a00',0,true);
      }else if(c.modo==='1v3'){
        let a=0,m=0,k=0;for(let i=0;i<n;i++){if(i===c.solo)a=g.scores[i];else{m+=g.scores[i];k++;}}
        txt('★ SOLO '+Math.round(a),cx+58,96,13,'#8a6a00',0,true);txt('TRÍO (media) '+Math.round(m/Math.max(1,k)),cx+58,116,13,'#1f6fb0',0,true);
      }
      /* gandola */
      if(gT>0){const u=Math.min(1,(3-gT)*3,gT*3),tx2=cx+190+(1-u)*200;
        rr(tx2-34,110,58,26,5,'#e8e8f0',3);rr(tx2+22,118,22,18,4,'#d63a3a',3);ell(tx2-18,138,7,7,'#16141c',3);ell(tx2+26,138,7,7,'#16141c',3);txt('GAS',tx2-5,123,12,'#14101c',0,true);}
      /* letrero de la bomba */
      const flip=sgT>0;rr(x1-92,100,76,26,5,flip?'#ff4d5e':'#3fe06a',3);txt(flip?'SIN GAS':'GASOLINA',x1-54,113,12,'#14101c',0,true);
      /* vendedor */
      const vy=c.campoAbajo-22;ell(vend.x,vy-20,7,7,'#c98a5a',2.5);rr(vend.x-8,vy-14,16,22,5,'#f2e6c8',2.5);rr(vend.x+8,vy-12,6,14,2,'#d63a3a',2);line([[vend.x-5,vy+8],[vend.x-5,vy+16]],3,'#14101c');line([[vend.x+5,vy+8],[vend.x+5,vy+16]],3,'#14101c');
      if(banner){ctx.save();ctx.globalAlpha=Math.min(.9,banner.t/banner.max*2);txt(banner.s,cx,300,40,banner.col,0,true);ctx.restore();}
      drawP();
    },
    fiscal(x,y){
      const tell=phase==='tell',red=phase==='red',fake=phase==='fake';
      const face=red?1:fake?.5:0,tw=tell?Math.sin(t*70)*3:0,raise=(tell||red)?1:0;
      rr(x-24,y-10,48,46,14,'#3c7a4a',4);rr(x-24,y+20,48,7,2,'#14101c',0);ell(x-10,y+4,4,4,'#ffd23f',2);
      /* clipboard */
      line([[x+22,y+6],[x+34,y+(raise?-4:18)]],8,'#3c7a4a');
      ctx.save();ctx.translate(x+38,y+(raise?-10:22));ctx.rotate(raise?-.25:.1);rr(-9,-13,18,26,3,'#f0e6c8',2.5);rr(-4,-16,8,6,2,'#888',2);ctx.restore();
      line([[x-22,y+6],[x-30,y+26]],8,'#3c7a4a');
      ell(x+tw,y-30,22,24,'#d9a07a',4);
      if(face>0){const ex=fake?5:0;ell(x-8+tw+ex,y-32,5,6,'#fff',2);ell(x+8+tw+ex,y-32,5,6,'#fff',2);ell(x-8+tw+ex*1.4,y-31,2.5,3,'#14101c',0);ell(x+8+tw+ex*1.4,y-31,2.5,3,'#14101c',0);
        if(red){ell(x+tw,y-17,6,5,'#14101c',2);ell(x+14+tw,y-15,4,4,'#ffd23f',2);line([[x+8+tw,y-17],[x+13+tw,y-15]],1.5,'#888');}
        else ell(x+tw+ex,y-17,5,2.5,'#14101c',0);}
      else{ell(x+tw,y-26,18,14,'#2a1a14',3);}
      rr(x-25+tw,y-58,50,18,8,'#2c5a3a',4);ell(x+tw+(fake?8:red?0:-4),y-40,24,5,'#1d3d27',3);
    }
  };
  return g;
}});
})();
