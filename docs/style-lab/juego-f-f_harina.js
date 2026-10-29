'use strict';
/* LA FIESTA · versus: ¡LA ÚLTIMA HARINA! Bodegón vacío, UN paquete de harina de maíz y cuatro compradores con carrito.
   1 botón. Quien lo tiene suma 10 pts/s; cuando brilla («¡SE TE RESBALA!») el primero en tocar se lo quita al que lo tiene
   (o el que lo tiene —y en 2v2 su pana— lo agarra duro y gana +5). Tocar fuera de turno = tropiezo (parado 0,8 s).
   Caos: ¡LLEGÓ EL CAMIÓN! (2º paquete 4 s), ¡SE ROMPIÓ EL PAQUETE! (lv2+: cae en un jugador al azar), ¡LA SEÑORA DEL CARRITO!
   (lv3: se lo lleva 2 s y lo suelta para una carrera nueva). */
(function(){
if(!window.FIESTA||!FIESTA.VS||FIESTA.VS.games.f_harina)return;
FIESTA.VS.add('f_harina',{name:'¡LA ÚLTIMA HARINA!',modos:['ffa','2v2','1v3'],dur:20,botones:1,hint:'TOCA CUANDO BRILLE: ¡QUÍTALE LA HARINA AL QUE LA TIENE!',
mk(c){
  const n=c.n,lv=c.lv,TC=['#ff9f43','#6c5ce7'];
  const WIN=[.45,.40,.35][Math.min(2,Math.max(0,lv-1))],GLO=[1.5,1.35,1.2][Math.min(2,Math.max(0,lv-1))],GHI=[3.0,2.8,2.6][Math.min(2,Math.max(0,lv-1))];
  const cxf=()=>(gameLeft()+gameRight())/2,SHY=290;
  const pos=p=>{const L=gameLeft(),R=gameRight(),left=p%2===0;return{x:left?L+95:R-95,y:p<2?225:455,d:left?1:-1};};
  const cart=p=>{const q=pos(p);return{x:q.x+q.d*66,y:q.y-14};};
  const mate=(a,b)=>c.modo==='2v2'&&a!==b&&c.equipos[a]===c.equipos[b];
  const FC=[0,1,4,3];
  let T=0,mode='free',freeLeft=2.4,freeNum=true,opened=false,holder=-1,winCd=1.5,win=null,grace=0;
  let cam=null,camDone=false,romT=0,senT=0,rom=null,sen=null,flash=0,bann=null;
  const tCam=3.5+c.rng.next()*4,tRom=lv>=2?9+c.rng.next()*3:1e9,tSen=lv>=3?13.5+c.rng.next()*2:1e9;
  let doneRom=false,doneSen=false;
  const stun=new Array(n).fill(0),plan=new Array(n).fill(null),fals=new Array(n).fill(null),shk=new Array(n).fill(0),joy=new Array(n).fill(0);
  const pk={x:cxf(),y:SHY,rot:0,sq:0};
  const g={scores:new Array(n).fill(0),fin:false};
  const say=(s,x,y,col)=>{if(window.BUS&&BUS.say)BUS.say(s,x,y,col);};
  const banner=(s,col,life=1.5)=>{bann={s,col,t:0,life};};
  const sn=(f,d,ty,v,sl)=>{try{snd(f,d,ty||'square',v||.06,sl||0);}catch(e){}};
  const puff=(x,y,k=14)=>{try{spawn(x,y,k,'bit',['#ffffff','#fff6c9','#f2e4a8'],260,260,.8);}catch(e){}};
  const cueCpu=()=>{for(let p=0;p<n;p++){plan[p]=null;if(!c.cpu[p])continue;const s=c.skill[p];
      if(c.rng.next()<.5+.45*s)plan[p]=T+.12+(1-s)*.3+c.rng.next()*.06;}};
  const falseCpu=(span)=>{for(let p=0;p<n;p++){fals[p]=null;if(!c.cpu[p])continue;
      if(c.rng.next()<.25*(1-c.skill[p]))fals[p]=T+.15+c.rng.next()*Math.max(.2,span-.35);}};
  const trip=(p,len,msg)=>{stun[p]=len;shk[p]=len;const q=pos(p);say(msg,q.x,q.y-130,'#ffe14d');sn(180,.12,'square',.07,-80);};
  const take=(p,from)=>{holder=p;joy[p]=1;const t=cart(p);pk.sq=1;puff(t.x,t.y-20,10);sn(500,.08,'square',.07,600);
      try{sfx.whoosh();}catch(e){}say(from?'¡ES MÍA!':'¡LA AGARRÓ!',t.x,t.y-70,c.col[p]);};
  const openWin=()=>{win={t:0,len:WIN};cueCpu();say('¡SE TE RESBALA!',cxf(),SHY-90,'#fff');sn(1200,.1,'square',.06,300);};
  const startFree=(wait,num)=>{mode='free';freeLeft=wait;freeNum=num;opened=false;holder=-1;win=null;cueCpu();for(let p=0;p<n;p++)plan[p]=null;falseCpu(wait);};
  g.update=function(dt){
    T+=dt;flash=Math.max(0,flash-dt);grace=Math.max(0,grace-dt);if(bann){bann.t+=dt;if(bann.t>bann.life)bann=null;}
    for(let p=0;p<n;p++){stun[p]=Math.max(0,stun[p]-dt);shk[p]=Math.max(0,shk[p]-dt);joy[p]=Math.max(0,joy[p]-dt*1.5);}
    pk.sq=Math.max(0,pk.sq-dt*4);
    let tp=[];for(let p=0;p<n;p++){const k=c.tap(p,'a');if(k>0)tp.push(p);}
    tp=c.rng.shuffle(tp);
    /* puntos por tener el paquete */
    if(mode==='play'&&holder>=0)g.scores[holder]+=10*dt;
    if(cam&&cam.holder>=0)g.scores[cam.holder]+=10*dt;
    /* ── cuenta atrás / carrera libre ── */
    if(mode==='free'){
      freeLeft-=dt;
      if(!opened&&freeLeft<=0){opened=true;cueCpu();banner('¡YA!','#ffe14d',.7);sn(900,.15,'square',.08,500);}
      for(const p of tp){if(stun[p]>0)continue;
        if(!opened){trip(p,1,'¡ADELANTADO!');}
        else{take(p,false);mode='play';winCd=GLO+c.rng.next()*(GHI-GLO);falseCpu(winCd);grace=.15;break;}}
    }
    else if(mode==='play'){
      /* eventos */
      const calm=!win&&!cam&&holder>=0;
      if(calm&&!camDone&&T>=tCam){camDone=true;cam={t:0,holder:-1};banner('¡LLEGÓ EL CAMIÓN!','#ffd23f',1.6);sn(150,.4,'sawtooth',.07,-30);for(let p=0;p<n;p++)plan[p]=null;
        for(let p=0;p<n;p++)if(c.cpu[p]&&c.rng.next()<.55+.4*c.skill[p])plan[p]=T+.35+(1-c.skill[p])*.5+c.rng.next()*.2;}
      else if(calm&&!doneRom&&T>=tRom){doneRom=true;mode='rompe';romT=1;flash=1;banner('¡SE ROMPIÓ EL PAQUETE!','#fff',1.6);puff(pk.x,pk.y,40);sn(120,.4,'sawtooth',.1,-40);holder=-1;}
      else if(calm&&!doneSen&&T>=tSen){doneSen=true;mode='sen';senT=2;banner('¡LA SEÑORA DEL CARRITO!','#ff7ab0',1.8);holder=-1;sn(220,.5,'sawtooth',.07,-60);}
      if(mode==='play'){
        if(cam){
          cam.t+=dt;
          for(const p of tp){if(stun[p]>0||p===holder||p===cam.holder||cam.holder>=0)continue;cam.holder=p;joy[p]=1;puff(cxf(),430,10);say('¡OTRO PAQUETE!',pos(p).x,pos(p).y-130,c.col[p]);sn(600,.08,'square',.07,500);break;}
          if(cam.t>=4){if(cam.holder>=0)say('SE FUE EL CAMIÓN',cxf(),400,'#fff');cam=null;winCd=Math.max(winCd,.9+c.rng.next()*.8);falseCpu(winCd);}
        }else if(win){
          win.t+=dt;let done=false;
          for(const p of tp){if(stun[p]>0)continue;
            const defend=p===holder||mate(p,holder);
            if(defend){g.scores[p]+=5;joy[p]=1;say('¡AGARRADA DURO! +5',cart(holder).x,cart(holder).y-90,'#7dff9a');sn(300,.1,'square',.08,-50);pk.sq=1;done=true;break;}
            take(p,true);done=true;break;}
          if(!done&&win.t>=win.len)done=true;
          if(done){win=null;grace=.15;winCd=GLO+c.rng.next()*(GHI-GLO);falseCpu(winCd);for(let p=0;p<n;p++)plan[p]=null;}
        }else{
          winCd-=dt;
          for(const p of tp){if(stun[p]>0||grace>0)continue;trip(p,.8,'¡TROPEZÓ!');}
          if(winCd<=0)openWin();
        }
      }
    }
    else if(mode==='rompe'){romT-=dt;if(romT<=0){const p=c.rng.int(0,n-1);holder=p;mode='play';joy[p]=1;const t=cart(p);pk.x=cxf();pk.y=SHY;puff(t.x,t.y,16);
        say('¡LE CAYÓ A P'+(p+1)+'!',t.x,t.y-90,c.col[p]);winCd=1.2+c.rng.next()*.8;falseCpu(winCd);grace=.2;}}
    else if(mode==='sen'){senT-=dt;if(senT<=0){startFree(.8,false);say('¡LA SOLTÓ!',cxf(),SHY-80,'#fff');}}
    /* paquete: vuela hacia su sitio */
    let tx=cxf(),ty=SHY-12;
    if(mode==='play'&&holder>=0){const t=cart(holder);tx=t.x;ty=t.y-24;}
    if(mode==='sen'){const k=Math.min(1,(2-senT)/.5);tx=cxf();ty=SHY+20;pk.x=pk.x+(tx-pk.x)*Math.min(1,dt*10);pk.y=pk.y+(ty-pk.y)*Math.min(1,dt*10);}
    else{const k=Math.min(1,dt*13);pk.x+=(tx-pk.x)*k;pk.y+=(ty-pk.y)*k;}
    pk.rot=win?Math.sin(T*45)*.3:Math.sin(T*3)*.03;
  };
  g.ai=function(p,dt,api){
    if(plan[p]!==null&&T>=plan[p]){plan[p]=null;api.press('a');}
    if(fals[p]!==null&&T>=fals[p]){fals[p]=null;if(mode!=='sen'&&mode!=='rompe')api.press('a');}
  };
  g.finish=function(){g.fin=true;};
  /* ───── dibujo ───── */
  function pack(x,y,rot,s,glow){
    ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
    if(glow){for(let i=3;i>=1;i--){ctx.globalAlpha=glow*.16;ell(0,0,26+i*13,34+i*13,'#fff6a0',0);}ctx.globalAlpha=1;}
    rr(-18,-27,36,54,8,'#ffd84a',3.5);rr(-18,-31,36,9,3,'#f0b800',3);rr(-18,-5,36,18,0,'#fff3c4',2);
    ell(0,-14,5,7,'#f2a900',2);txt('HARINA',0,4,9,'#7a4a10',0,true);ctx.restore();}
  function carrito(p,hold){
    const q=cart(p);ctx.save();ctx.translate(q.x,q.y);
    rr(-28,-4,56,26,6,'#c9ccd6',3.5);for(let i=-1;i<=1;i++)line([[i*14,-2],[i*14,20]],1.6,'#8d92a3');
    line([[-28,-4],[-38,-24]],4,'#8d92a3');line([[-38,-24],[-22,-24]],4,'#8d92a3');
    ell(-16,28,6,6,'#33323c',2);ell(16,28,6,6,'#33323c',2);ctx.restore();}
  function drawPlayer(p,lowest){
    const q=pos(p),st=stun[p]>0,h=holder===p||(cam&&cam.holder===p),o=Math.sin(T*10+p)*(shk[p]>0?5:0);
    ell(q.x,q.y+12,52,13,c.col[p],3);
    carrito(p,h);
    const fc=FACES[FC[p]];
    const mood=st?'angry':h?'grin':(win?'yell':'calm');
    ctx.save();
    const hop=joy[p]>0?-Math.abs(Math.sin(joy[p]*9))*12:0;
    bust(Object.assign({},fc,{x:q.x+o,y:q.y-18+hop+(st?6:0),s:.5,flip:q.d<0,mood,th:70,hair:(p===0||p===3)?'rolos':fc.hair,hairCol:(p===0||p===3)?'#3b2a22':fc.hairCol,rot:st?Math.sin(T*14)*.12:0}));
    ctx.restore();
    if(lowest){for(let i=0;i<5;i++)ell(q.x-14+i*7,q.y-72+(i%2)*10,8+(i%3)*2,5,'rgba(255,255,255,.85)',0);}
    if(st){for(let i=0;i<3;i++){const a=T*6+i*2.1;txt('★',q.x+Math.cos(a)*24,q.y-84+Math.sin(a)*6,16,'#ffe14d',0,true);}}
    /* etiqueta + equipo */
    const solo=c.modo==='1v3'&&c.solo===p,tcol=c.modo==='2v2'?TC[c.equipos[p]]:c.modo==='1v3'?(solo?'#ffd23f':'#8fa3b8'):c.col[p];
    const ly=p<2?q.y-170:q.y+34,lab='P'+(p+1)+(c.cpu[p]?' CPU':'')+(solo?' ★SOLO':c.modo==='1v3'?' TRÍO':'');
    rr(q.x-52,ly-12,104,24,8,c.col[p],2.5);if(c.modo!=='ffa')rr(q.x-52,ly+8,104,6,3,tcol,0);
    txt(lab,q.x,ly-1,15,'#14101c',0,true);
    /* arepas que suma */
    const na=Math.min(10,Math.floor(g.scores[p]/12)),ay=p<2?q.y-146:q.y-110-0;
    for(let i=0;i<na;i++)ell(q.x-48+(i%5)*24,(p<2?ly+26:ly-44)-Math.floor(i/5)*14,10,7,'#e9c46a',2);
    txt(String(Math.round(g.scores[p])),q.x+q.d*0,p<2?ly+(na?58:30):ly+(na?-40:-34)-(na>5?14:0)-(na?0:0),22,'#fff',0,false);
  }
  g.draw=function(){
    const L=gameLeft(),R=gameRight(),Wd=R-L,cx=cxf(),B=c.campoAbajo;
    rr(L,0,Wd,B,0,'#e8dfc8',0);
    for(let x=L;x<R;x+=64)line([[x,64],[x,B]],1.2,'#d6ccb0');for(let y=64;y<B;y+=64)line([[L,y],[R,y]],1.2,'#d6ccb0');
    if(c.modo==='2v2'){ctx.save();ctx.globalAlpha=.18;ctx.fillStyle=TC[0];ctx.fillRect(L,64,Wd,SHY+10-64);ctx.fillStyle=TC[1];ctx.fillRect(L,SHY+10,Wd,B-SHY-10);ctx.restore();}
    /* estantería vacía al fondo */
    rr(L+20,66,Wd-40,52,6,'#9c6b3f',3);for(let i=0;i<2;i++)line([[L+26,86+i*22],[R-26,86+i*22]],4,'#7a5230');
    for(let i=0;i<6;i++)ell(L+80+i*((Wd-160)/5),110,14,3,'rgba(0,0,0,.12)',0);
    txt('VACÍO',L+Wd*.25,98,14,'#7a5230',0,true);txt('SE ACABÓ',L+Wd*.75,98,14,'#7a5230',0,true);
    /* góndola central */
    rr(cx-62,SHY+12,124,46,8,'#b98a56',3.5);rr(cx-62,SHY+8,124,12,5,'#d9aa72',3);
    if(c.modo!=='ffa')txt(c.modo==='1v3'?'1 CONTRA 3 · SUMA LA MEDIA DEL TRÍO':'2 CONTRA 2 · SUMAN LOS DOS',cx,B-14,14,'#4a3a2a',0,true);
    const mn=Math.min.apply(null,g.scores);
    const lowest=p=>(T>16||g.fin)&&g.scores[p]===mn&&g.scores.filter(v=>v===mn).length===1;
    for(let p=0;p<n;p++)drawPlayer(p,lowest(p));
    /* señora con su carrito enorme */
    if(mode==='sen'){const k=Math.min(1,(2-senT)/.35),k2=senT<.35?senT/.35:1,x=cx+(1-Math.min(k,k2))*(senT<.35?260:-340),y=SHY+60;
      ctx.save();ctx.translate(x,y);rr(-80,-4,160,70,10,'#ff7ab0',4);for(let i=-3;i<=3;i++)line([[i*22,0],[i*22,62]],2,'#b8447c');
      line([[-80,-4],[-104,-60]],7,'#8d92a3');ell(-50,76,12,12,'#33323c',3);ell(50,76,12,12,'#33323c',3);ctx.restore();
      bust(Object.assign({},FACES[2],{x:x-6,y:y-30,s:.62,mood:'angry',th:80,hair:'rolos'}));
      pack(x,y-4,Math.sin(T*20)*.1,1,0);}
    /* paquete 2 y camión */
    if(cam){const hy=cam.holder>=0;ctx.save();rr(cx-60,B-72,120,40,8,'#4fa3d1',3.5);rr(cx+20,B-92,40,30,6,'#3b86b0',3);ell(cx-30,B-30,11,11,'#33323c',3);ell(cx+30,B-30,11,11,'#33323c',3);ctx.restore();
      if(!hy){pack(cx-10,B-90+Math.sin(T*8)*3,Math.sin(T*30)*.12,.85,.9);txt('¡TOCA!',cx-10,B-124,18,'#fff',0,false);}
      else{const q=cart(cam.holder);pack(q.x+(pos(cam.holder).d>0?-26:26),q.y-28,0,.8,0);}
      txt((4-cam.t).toFixed(1),cx+60,B-100,16,'#fff',0,true);}
    if(mode!=='rompe'&&mode!=='sen')pack(pk.x,pk.y,pk.rot,1+(win?.12+Math.sin(T*30)*.05:0)+pk.sq*.2,win?1:0);
    if(mode==='rompe'){for(let i=0;i<7;i++)pack(cx+Math.cos(i*1.1+T*3)*(1-romT)*120,SHY-10+Math.sin(i*1.1+T*3)*(1-romT)*60,i+T*5,.5,0);}
    if(win){const f=1-win.t/win.len;rr(cx-50,SHY-62,100*f,7,3,'#fff',2);txt('¡TOCA YA!',cx,SHY+86,22,'#ff3b6a',0,false);}
    if(mode==='free'){
      if(freeNum&&!opened){const num=Math.max(1,Math.min(3,Math.ceil(freeLeft/.8)));txt(String(num),cx,SHY-6,70,'#fff',0,false);
        txt('TOCA CUANDO BRILLE · ¡NO ANTES!',cx,SHY+84,17,'#4a3a2a',0,true);}
      else if(!freeNum&&!opened){txt('…',cx,SHY-6,60,'#fff',0,false);}
      else txt('¡YA!',cx,SHY-6,64,'#ffe14d',0,false);}
    if(mode==='play'&&!win&&!cam&&T<9)txt('TOCA CUANDO BRILLE',cx,SHY+86,15,'#4a3a2a',0,true);
    if(bann){const a=Math.min(1,(bann.life-bann.t)*3,bann.t*8);ctx.save();ctx.globalAlpha=a;rr(cx-230,84,460,36,12,'#14101c',3);ctx.globalAlpha=a;txt(bann.s,cx,103,24,bann.col,0,true);ctx.restore();}
    if(flash>0){ctx.save();ctx.globalAlpha=Math.min(1,flash*1.4);ctx.fillStyle='#fff';ctx.fillRect(L,64,Wd,B-64);ctx.restore();}
  };
  return g;
}});
})();
