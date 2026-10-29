'use strict';
/* LA FIESTA · versus: ¡TEQUEÑOS! Cuatro pailas, un tequeño por cabeza colgado del tenedor. MANTÉN tu botón = se fríe (la barra sube);
   SUELTA = lo sacas y puntúa. Pálido da poco, DORADO da 10, DE BODEGÓN (el centro) da 15, pasadito da 3 y quemado da 0 y pierdes un rato.
   Sorpresas iguales para todos: ¡MAMÁ SUBIÓ EL FUEGO! (barras x1,8), ¡APAGÓN! (barras ocultas; dorado a oscuras vale x2) y
   ¡TEQUEÑO GORDO! (el siguiente vale x3 pero se fríe a ritmos raros). Score = suma de puntos, así suma bien en 2v2 y promedia en 1v3. 1 botón. */
(function(){
if(!window.FIESTA||!FIESTA.VS||FIESTA.VS.games.f_tequeno)return;
const TEAMC=['#ffd23f','#3fb0ff','#ff5c8a','#5cff7a'];
function hx(c){return[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));}
function lerpC(a,b,t){t=Math.max(0,Math.min(1,t));const A=hx(a),B=hx(b);return'#'+A.map((v,i)=>('0'+Math.round(v+(B[i]-v)*t).toString(16)).slice(-2)).join('');}
function say(s,x,y,col){PT.push({x,y,vx:0,vy:-60,g:0,t:0,life:.95,kind:s,col,r:-2,rot:0,vr:0});}
function bits(c,x,y,n,cols,sp,kind){for(let i=0;i<n;i++){const a=c.rng.next()*6.283,v=sp*(.3+c.rng.next()*.7);
  PT.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-sp*.5,g:600,t:0,life:.5+c.rng.next()*.5,kind:kind||'bit',col:cols[i%cols.length],r:4+c.rng.next()*5,rot:c.rng.next()*6,vr:(c.rng.next()-.5)*12});}}
const beep=(f,d,w,v)=>{try{if(typeof snd==='function')snd(f,d,w,v);}catch(e){}};
FIESTA.VS.add('f_tequeno',{name:'¡TEQUEÑOS!',modos:['ffa','2v2','1v3'],dur:20,botones:1,
hint:'MANTÉN PARA FREÍR, SUELTA EN LO DORADO',
mk(c){
  const n=c.n,lv=Math.max(1,Math.min(3,c.lv|0||1)),BASE=[.55,.7,.85][lv-1];
  const gLo=lv===3?.74:.70,gHi=lv===3?.86:.88,pLo=gLo+(lv===3?.04:.10),pHi=pLo+.04,TARGET=.79;
  const IV=[5,6,4][lv-1],POOL=lv===1?['fuego','gordo']:['fuego','apag','gordo'];
  const NAME={fuego:'¡MAMÁ SUBIÓ EL FUEGO!',apag:'¡APAGÓN!',gordo:'¡TEQUEÑO GORDO!'};
  const S=[];
  const newTq=(s)=>{const gordo=s.pendG;s.pendG=false;
    s.tq={rate:BASE*(1+(c.rng.next()-.5)*.3),gordo,ph:c.rng.next()*6.28,age:0,
      target:TARGET+(c.rng.next()-.5)*.3*(1-c.skill[s.p]),apN:(c.rng.next()-.5)*.24,react:.1+c.rng.next()*.3*(1.2-c.skill[s.p])};
    s.bar=0;};
  for(let p=0;p<n;p++){S.push({p,st:'cool',t:.5,bar:0,tq:null,needRel:false,plate:[],dip:0,pendG:false,last:null,fx:0,sm:0});}
  const ev={timer:3.5,ann:null,act:null,prev:''};
  let gt=0;
  const g={scores:new Array(n).fill(0),fin:false,dur:20,hint:'MANTÉN PARA FREÍR, SUELTA EN LO DORADO'};
  const apag=()=>ev.act&&ev.act.k==='apag';
  const fuego=()=>ev.act&&ev.act.k==='fuego';
  /* geometría de cada columna */
  const geo=p=>{const L=gameLeft(),R=gameRight(),cw=(R-L)/n,x0=L+p*cw,gw=Math.min(cw-8,200),gx=x0+(cw-gw)/2;
    return{gx,gw,bx:gx+18,cx:gx+gw*.62,prx:Math.min(gw*.3,58),by0:132,by1:408};};
  function geoPos(s){const G=geo(s.p);return G;}
  function release(s,forced){
    const b=s.bar,tq=s.tq,G=geo(s.p),oil=apag();let pts=0,lab,col='#fff';
    if(b<.4){pts=0;lab='¡CRUDO, CHAMO!';col='#e8e0c8';}
    else if(b<gLo){pts=2+4*(b-.4)/(gLo-.4);pts=Math.round(pts);lab='¡AÚN PÁLIDO!';col='#ffe9a8';}
    else if(b<gHi){if(b>=pLo&&b<pHi){pts=15;lab='¡DE BODEGÓN!';col='#ffd23f';}else{pts=10;lab='¡DORADO!';col='#ffd23f';}}
    else{pts=3;lab='¡PASADITO!';col='#c98a4a';}
    const gold=b>=gLo&&b<gHi;
    if(oil&&gold){pts*=2;lab='A OSCURAS Y DORADO';}
    if(tq.gordo&&pts>0){pts*=3;lab=lab+' x3';}
    g.scores[s.p]+=pts;
    s.plate.push(gold?(pts>=15?'#ffe066':'#e0a82e'):b<.4?'#f3e2b0':b<gLo?'#e9c27a':'#8a4f1f');if(s.plate.length>9)s.plate.shift();
    s.last={bar:b,gordo:tq.gordo,t:0,gold,perfect:b>=pLo&&b<pHi&&gold};
    say(lab,G.cx,300,col);if(pts>0)say('+'+pts,G.cx+G.prx*.7,340,'#fff');
    if(gold)bits(c,G.cx,330,gold&&b>=pLo&&b<pHi?14:7,['#ffd23f','#fff3c4','#ffffff'],260,'conf');
    beep(gold?900:300,.08,'square',.05);
    s.st='cool';s.t=.4;s.needRel=false;s.tq=null;}
  function burn(s){const G=geo(s.p);
    s.st='smoke';s.t=1.0;s.fx=1;s.needRel=c.held(s.p,'a');
    say('¡SE TE QUEMÓ!',G.cx,300,'#ff6a4a');bits(c,G.cx,350,10,['#3a3a44','#6a6a76','#222'],160);
    s.plate.push('#1e1a18');if(s.plate.length>9)s.plate.shift();
    s.last={bar:1,gordo:s.tq.gordo,t:0,burnt:true};beep(120,.25,'sawtooth',.06);}
  g.finish=function(){for(const s of S)if(s.st==='fry'){release(s,true);}g.fin=true;};
  g.update=function(dt){
    gt+=dt;
    /* eventos */
    if(ev.ann){ev.ann.t-=dt;if(ev.ann.t<=0){const k=ev.ann.k;ev.ann=null;
      if(k==='gordo'){ev.act={k,t:.4,tot:.4};for(const s of S){if(s.st==='ready'&&s.tq&&s.bar===0&&!s.tq.gordo)s.tq.gordo=true;else s.pendG=true;}say('¡A FREÍR EL GORDO!',(gameLeft()+gameRight())/2,300,'#ffd23f');}
      else{ev.act={k,t:k==='fuego'?3:2,tot:k==='fuego'?3:2};beep(k==='apag'?90:180,.3,'sawtooth',.05);}}}
    else if(ev.act){ev.act.t-=dt;if(ev.act.t<=0){ev.act=null;}}
    else{ev.timer-=dt;if(ev.timer<=0&&gt<g.dur-2.2){let k;do k=c.rng.pick(POOL);while(k===ev.prev&&POOL.length>1);ev.prev=k;ev.ann={k,t:.6};ev.timer=IV+(c.rng.next()-.5)*.8;beep(500,.12,'square',.05);}}
    if(ev.act&&ev.act.k!=='fuego'&&ev.act.k!=='apag'&&ev.act.t<=0)ev.act=null;
    const mult=fuego()?1.8:1;
    for(const s of S){const p=s.p,held=c.held(p,'a');
      if(s.needRel&&!held)s.needRel=false;
      if(s.last)s.last.t+=dt;
      s.fx=Math.max(0,s.fx-dt);
      if(s.st==='cool'||s.st==='smoke'){s.t-=dt;s.dip=Math.max(0,s.dip-dt*3);
        if(s.st==='smoke'&&c.rng.next()<dt*14){const G=geo(p);PT.push({x:G.cx+(c.rng.next()-.5)*30,y:340,vx:(c.rng.next()-.5)*20,vy:-70,g:0,t:0,life:.8,kind:'bit',col:'#5a5a64',r:5+c.rng.next()*4,rot:0,vr:2});}
        if(s.t<=0){newTq(s);s.st='ready';}}
      else if(s.st==='ready'){s.dip=Math.max(0,s.dip-dt*4);if(held&&!s.needRel){s.st='fry';}}
      if(s.st==='fry'){const tq=s.tq;tq.age+=dt;s.dip=Math.min(1,s.dip+dt*6);
        let r=tq.rate*mult;if(tq.gordo)r*=1+.45*Math.sin(tq.ph+tq.age*4.5);
        s.bar+=r*dt;
        if(s.bar>=1){s.bar=1;burn(s);}
        else if(!held)release(s);
        else if(c.rng.next()<dt*8){const G=geo(p);PT.push({x:G.cx+(c.rng.next()-.5)*G.prx,y:366,vx:0,vy:-40,g:0,t:0,life:.5,kind:'bit',col:'#ffe9a8',r:3,rot:0,vr:0});}}
    }
  };
  g.ai=function(p,dt,api){const s=S[p];
    if(s.st==='ready'&&s.tq){s.tq.react-=dt;api.hold('a',s.tq.react<=0);}
    else if(s.st==='fry'){let tg=s.tq.target;if(apag())tg+=s.tq.apN;
      if(fuego()||(ev.ann&&ev.ann.k==='fuego'))tg-=.05*c.skill[p];
      api.hold('a',s.bar<tg);}
    else api.hold('a',false);};
  /* ───────── dibujo ───────── */
  function teq(x,y,w,h,col,rot,gordo){ctx.save();ctx.translate(x,y);ctx.rotate(rot);
    rr(-w/2,-h/2,w,h,w*.5,col,3.5);rr(-w*.28,-h*.4,w*.16,h*.5,w*.08,'rgba(255,255,255,.35)',0);
    if(gordo){line([[-w*.3,-h*.12],[w*.3,-h*.2]],2.5,'rgba(0,0,0,.25)');line([[-w*.3,h*.15],[w*.3,h*.08]],2.5,'rgba(0,0,0,.25)');}
    ctx.restore();}
  function colOf(b){return b<.4?lerpC('#f6e8bd','#f0cf79',b/.4):b<gLo?lerpC('#f0cf79','#e0a82e',(b-.4)/(gLo-.4)):b<gHi?lerpC('#e0a82e','#c7791f',(b-gLo)/(gHi-gLo)):lerpC('#a85a1c','#1e1a18',(b-gHi)/(1-gHi));}
  g.draw=function(){
    const L=gameLeft(),R=gameRight(),cwid=R-L,dark=apag()?Math.min(1,(ev.act.tot-ev.act.t)/.25,ev.act.t/.3)*.88:0;
    rr(L,0,cwid,c.campoAbajo,0,'#6b4a34',0);
    rr(L,64,cwid,c.campoAbajo-64,0,'#7d5a40',0);
    for(let i=0;i<6;i++)rr(L+i*cwid/6+4,70,cwid/6-8,c.campoAbajo-74,6,'#85624a',0);
    const teamTxt=c.modo==='2v2'?'SUMAN LOS TEQUEÑOS DEL EQUIPO':c.modo==='1v3'?'1 CONTRA 3 · SUMAN LOS TEQUEÑOS DEL EQUIPO':'';
    if(teamTxt)txt(teamTxt,(L+R)/2,100,15,'#fff',0,true);
    for(const s of S){const p=s.p,G=geo(p),t=c.equipos[p],tc=c.modo==='ffa'?c.col[p]:TEAMC[t];
      const baseY=372,oilRy=24;
      /* anillo de equipo, paila */
      ell(G.cx,430,G.prx+22,17,tc,3);
      rr(G.cx-G.prx-4,baseY,2*G.prx+8,54,16,'#3a3640',3.5);
      rr(G.cx+G.prx+2,baseY+10,16,8,4,'#2a2630',2.5);rr(G.cx-G.prx-18,baseY+10,16,8,4,'#2a2630',2.5);
      ell(G.cx,baseY,G.prx+7,oilRy+6,'#4a4652',3);
      const hot=fuego()?lerpC('#d99a30','#e8552d',.5):'#d99a30';
      ell(G.cx,baseY,G.prx,oilRy,hot,2.5);
      ell(G.cx-G.prx*.35,baseY-4,G.prx*.35,6,'rgba(255,240,170,.45)',0);
      /* tenedor y tequeño */
      const tq=s.tq,hangY=215;
      if(s.st==='smoke'){const y=348;teq(G.cx,y,24,72,'#1e1a18',.1,s.last&&s.last.gordo);}
      else if(tq){const gor=tq.gordo,w=gor?38:24,h=gor?104:72,dip=s.dip,y=hangY+(348+(gor?10:0)-hangY)*dip-(s.st==='ready'&&s.dip===0?Math.max(0,.4-0)*0:0);
        const sw=Math.sin(gt*3+p)*.06*(1-dip),col=colOf(s.bar);
        const drop=s.st==='ready'?Math.min(1,(1-0)):1;
        rr(G.cx-2.5,112,5,y-h/2-108,2,'#b9b9c6',2.5);rr(G.cx-10,y-h/2-6,20,7,3,'#9a9aa8',2.5);
        teq(G.cx,y,w,h,col,sw,gor);
        if(s.st==='fry'&&s.bar>.88&&s.bar<1){const wob=Math.sin(gt*30)*2;ctx.save();ctx.translate(wob,0);ctx.restore();}}
      else if(s.last&&s.st==='cool'){const u=Math.min(1,s.last.t/.4),gor=s.last.gordo,w=gor?38:24,h=gor?104:72,y=348+(hangY-348)*u;
        rr(G.cx-2.5,112,5,y-h/2-108,2,'#b9b9c6',2.5);
        ctx.save();ctx.globalAlpha=1-u*.6;teq(G.cx,y,w,h,colOf(s.last.bar),0,gor);
        if(s.last.perfect||s.last.gold){/* queso estirado */
          line([[G.cx-4,y+h/2],[G.cx-6+Math.sin(gt*14)*3,y+h/2+22*(1-u)+10],[G.cx-3,y+h/2+34*(1-u)+14]],3,'#ffe066');
          if(s.last.perfect)for(let k=0;k<3;k++)txt('✦',G.cx+(k-1)*26,y-h/2-8-Math.sin(gt*8+k)*4,18,'#fff7c0',0,true);}
        ctx.restore();}
      /* aceite delante del tequeño sumergido */
      ell(G.cx,baseY,G.prx,oilRy,'rgba(217,154,48,.55)',0);
      for(let k=0;k<5;k++){const bx=G.cx+Math.sin(gt*2.1+k*1.7+p)*G.prx*.6,by=baseY+Math.sin(gt*3+k*2.3)*oilRy*.5,r=2.5+((gt*3+k)%1)*(s.st==='fry'?4:2);ell(bx,by,r,r*.7,'rgba(255,240,170,.7)',1.5);}
      /* barra de cocción */
      const bh=G.by1-G.by0,bw=22,bx=G.bx;
      const hide=apag();
      rr(bx-3,G.by0-3,bw+6,bh+6,7,'#2a2230',3);
      if(!hide){
        const zones=[[0,.4,'#f1e4b8'],[.4,gLo,'#e9b95a'],[gLo,gHi,'#ffd23f'],[gHi,.95,'#8a4f1f'],[.95,1,'#1e1a18']];
        for(const[a,b,cl]of zones){
          const ya=G.by1-a*bh,yb=G.by1-b*bh;
          ctx.save();ctx.globalAlpha=.4;rr(bx,yb,bw,ya-yb,0,cl,0);ctx.restore();
          const v=Math.min(s.bar,b);if(v>a)rr(bx,G.by1-v*bh,bw,(v-a)*bh,0,cl,0);}
        const ym=G.by1-(pLo+.02)*bh;line([[bx,ym],[bx+bw,ym]],2,'#fff');
        txt('DORADO',bx-12,(G.by1-(gLo+gHi)/2*bh),12,'#ffd23f',-Math.PI/2,true);
        if(s.st==='fry'||s.st==='smoke'){const yv=G.by1-s.bar*bh;poly([[bx+bw+2,yv],[bx+bw+13,yv-7],[bx+bw+13,yv+7]],'#fff',2.5);line([[bx,yv],[bx+bw,yv]],2.5,'#fff');}
      }else{txt('?',bx+bw/2,(G.by0+G.by1)/2,34,'#8a8498',0,true);}
      /* cocinero */
      const f=FIESTA.VS&&typeof FACES!=='undefined'?FACES[[0,1,5,11][p%4]]:null;
      if(f){const mood=s.st==='smoke'?'panic':(s.last&&s.last.perfect&&s.last.t<1)?'o':f.mood;
        bust(Object.assign({},f,{x:G.gx+G.gw-22,y:122,s:.26,th:10,bw:44,look:0,mood,talk:s.st==='smoke'?1:0}));}
      /* etiqueta y plato */
      const role=c.modo==='1v3'?(c.solo===p?'SOLO':'TRÍO'):c.modo==='2v2'?['AMARILLO','AZUL'][t]||'':'';
      txt('P'+(p+1)+(c.cpu[p]?' CPU':'')+(role?' · '+role:''),G.cx,455,14,tc,0,true);
      ell(G.cx,486,G.prx*.9,9,'#f4f1ea',2.5);
      const nn=s.plate.length;
      for(let k=0;k<nn;k++)rr(G.cx-G.prx*.7+k*(G.prx*1.4/9),474-(k%2)*3,13,8,4,s.plate[k],2);
      txt(String(g.scores[p]),G.cx+G.prx+4,486,18,'#fff',0,true);
    }
    if(fuego()){ctx.save();ctx.globalAlpha=.12+.04*Math.sin(gt*20);ctx.fillStyle='#ff5a1f';ctx.fillRect(L,64,cwid,c.campoAbajo-64);ctx.restore();}
    if(dark>0){ctx.save();ctx.globalAlpha=dark;ctx.fillStyle='#07040c';ctx.fillRect(L,0,cwid,c.campoAbajo);ctx.restore();
      for(const s of S){const G=geo(s.p),y=372;ctx.save();ctx.globalAlpha=Math.min(1,dark*1.2);
        ell(G.cx,y,G.prx,24,'rgba(255,170,50,.30)',0);
        for(let k=0;k<5;k++){const bx=G.cx+Math.sin(gt*2.1+k*1.7+s.p)*G.prx*.6,by=y+Math.sin(gt*3+k*2.3)*12,r=3+((gt*3+k)%1)*(s.st==='fry'?5:2);ell(bx,by,r,r*.7,'rgba(255,214,120,.85)',0);}
        ctx.restore();}
    }
    if(ev.ann){const u=ev.ann.t/.6,pulse=1+.06*Math.sin(gt*40),mx=(L+R)/2;
      ctx.save();ctx.globalAlpha=.92;rr(mx-250,226,500,66,16,ev.ann.k==='apag'?'#3a2a5a':ev.ann.k==='gordo'?'#2d8a4a':'#e8553d',4);ctx.restore();
      txt(NAME[ev.ann.k],mx,259,36*pulse,'#fff',0);}
    else if(ev.act&&ev.act.k==='fuego')txt('¡FUEGO ALTO! BARRAS x1,8',(L+R)/2,106,15,'#ffd7a8',0,true);
    else if(ev.act&&ev.act.k==='apag')txt('FRÍE A OSCURAS: DORADO VALE x2',(L+R)/2,106,15,'#ffd7a8',0,true);
  };
  return g;
}});
})();
