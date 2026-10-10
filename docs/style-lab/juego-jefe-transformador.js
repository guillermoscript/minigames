'use strict';
/* MiniCaos · laboratorio de estilos: JEFE «EL TRANSFORMADOR» (el jefe de SE FUE LA LUZ; viene de window.apBoss en js/games/ap1.js).
   El transformador del poste amaneció bravo y no quiere devolver la luz. Todo el barrio jala un mecate amarrado a la palanca
   del breaker: hay que TOCAR RÁPIDO (o ESPACIO) para subirla hasta arriba antes de que se acabe el tiempo (8 s, una sola fase).
   La palanca se baja sola (más rápido mientras más arriba está), y cada ~2 s el transformador se alebresta: 0.45 s de aviso
   (un «!» grande, ojos rojos, chispas) y después ~0.6 s en que la palanca se resbala 2.6 veces más rápido y le cae un rayo.
   Cada toque sube 9 %. Las ventanas del barrio se van prendiendo con la palanca y la noche se va aclarando.
   Ganas: ¡LLEGÓ! (todas las ventanas prendidas, el transformador queda mareado y todo el mundo brinca).
   Pierdes: se acaba el tiempo = ¡SIN LUZ!
   El estado no depende del color: la palanca SUBE, la barra se llena, el aviso es un «!» y la furia trae chispas y rayo.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.transformador)return;
const CONF=BUS.CONF,TU=BUS.TU,tag=BUS.tag,AP=BUS.AP,C=AP.CAST,PI=Math.PI,PX=250,TY=318,BY=440,FY=548,GRIS='#9aa3b2',PALO='#6b4a32',CABLE='#14101c';

/* los cables que salen de la cruceta para los dos lados, y el poste de madera */
function poste(){
  for(const sd of[-1,1])for(let i=0;i<3;i++){const p=[];
    for(let j=0;j<=8;j++){const u=j/8,a=(1-u)*(1-u),b=2*u*(1-u),c=u*u;p.push([PX+sd*(b*300+c*700),(164+i*9)*a+(196+i*14)*b+(156+i*9)*c]);}
    line(p,2.5,CABLE);}
  rr(PX-13,-8,26,568,3,PALO,4);line([[PX-6,6],[PX-6,554]],3,'#8a6444');
  rr(PX-92,156,184,14,3,PALO,4);for(const x of[-78,-30,30,78])rr(PX+x-5,142,10,16,3,'#e8e8ee',3);}
/* el transformador: un pote gris con cara. mood: 'angry' (bravo), 'zap' (alebrestado: ojos rojos, dientes y chispas), 'dizzy' (mareado) */
function trafo(mood,hurt){const zap=mood==='zap',diz=mood==='dizzy';
  ctx.save();ctx.translate(PX+(zap?Math.sin(now*61)*3:0),TY+(diz?14:0));if(diz)ctx.rotate(Math.sin(now*3)*.07);
  for(const x of[-30,0,30]){line([[x,-92],[x*1.7,-154]],3,CABLE);rr(x-7,-96,14,28,3,'#e8e8ee',3);ell(x,-96,10,5,'#c9ced6',2.5);}
  for(const sd of[-1,1])for(let i=0;i<4;i++)rr(sd*62-8,-44+i*24,16,16,3,'#7f8897',3);
  rr(-58,-72,116,148,18,zap&&Math.sin(now*40)>0?'#c9d2e2':GRIS,5);rr(-58,-72,116,16,8,'#b9c1cf',3.5);line([[-56,38],[56,38]],3,'#6f7887');
  rr(-32,46,64,18,3,'#ffd23f',3);txt('PELIGRO',0,56,11,INK,0,true);
  const ey=-22+hurt*5;
  for(const sd of[-1,1]){const ex=sd*24;
    if(diz){line([[ex-10,ey-10],[ex+10,ey+10]],5);line([[ex+10,ey-10],[ex-10,ey+10]],5);continue;}
    ell(ex,ey,15,hurt>.15?6:zap?16:13,zap?'#ff3b4e':'#ffffff',3.5);ell(ex+(zap?0:4),ey+(zap?0:3),zap?4:6,zap||hurt>.15?4:6,zap?'#ffffff':INK,0);
    line([[sd*42,ey-(zap?34:24)],[sd*8,ey-(zap?9:12)]],7);}
  if(diz)line([[-22,16],[-11,9],[0,16],[11,9],[22,16]],5);
  else if(zap){rr(-26,2,52,28,6,INK,3);line([[-20,10],[-12,22],[-4,10],[4,22],[12,10],[20,22]],3.5,'#ffffff');}
  else if(hurt>.15)ell(0,16,9,10,INK,0);
  else line(arcPts(0,34,24,PI*1.18,PI*1.82,8),6);
  if(zap){const fr=Math.floor(now*14);for(let i=0;i<6;i++){const a=hash(i,fr,1)*TAU,r=80+hash(i,fr,2)*24,x=Math.cos(a)*r,y=Math.sin(a)*r*1.1;line([[x,y],[x+9,y-10],[x-2,y-14],[x+8,y-26]],3.5,'#9fe8ff');}}
  if(diz)for(let i=0;i<3;i++){const a=now*4+i*2.1;txt('★',Math.cos(a)*56,-104+Math.sin(a)*12,20,'#ffe14d');}
  ctx.restore();}
/* el breaker: la caja en el poste y la palanca, que sube con k (0 abajo .. 1 arriba). Devuelve la punta, donde va amarrado el mecate */
function breaker(x,k,on){rr(x-38,BY-46,76,140,8,'#5a6a7a',4.5);rr(x-10,BY-32,20,112,7,'#14101c',3);
  txt('ON',x-24,BY-24,12,'#ffffff',0,true);txt('OFF',x-24,BY+70,11,'#ffffff',0,true);ell(x+24,BY-30,7,7,on?'#5cff7a':'#3b3550',2.5);
  const hy=lerp(BY+68,BY-20,k);rr(x-7,hy-10,62,20,8,'#e8293f',4);ell(x+56,hy,13,13,'#ffd23f',3.5);return{x:x+56,y:hy};}

/* ═════════ JEFE · EL TRANSFORMADOR: ¡sube el breaker entre todos! ═════════ */
function mkTransformador(){
  const sp=Math.min(SP,1.3);
  let v=.28,flash=0,n=0,c=0,lit=0,hurt=0,nextRage=1.6+Math.random()*.6,rageT=-1;
  const g={get impact(){return this.result?clamp(1-this.endT/.5,0,1):0;},probe:()=>({v,rageT,lit,n}),
    t:0,dur:8,result:null,why:'',endT:0,cmd:'¡SUBE EL BREAKER!',
    hint:'TOCA RÁPIDO (o ESPACIO): entre todos suban el breaker antes de que se acabe el tiempo',
    press(){if(g.result)return;v=Math.min(1,v+.09);flash=.1;n++;hurt=.5;snd(300+(n%12)*45,.05,'square',.045);
      if(v>=1){g.result='win';g.why='¡LLEGÓ!';rageT=-1;sfx.win();nz(.45,.16);snd(90,.55,'sine',.25,-60);spawn(400,260,34,'conf',CONF);}},
    down(){g.press();},move(){},up(){},
    update(dt){g.t+=dt;c+=dt;flash=Math.max(0,flash-dt);hurt=Math.max(0,hurt-dt*4);
      lit+=((g.result==='win'?1:g.result?0:Math.pow(v,1.3)*.85)-lit)*Math.min(1,dt*6);
      if(g.result){g.endT+=dt;if(g.result==='lose')v=Math.max(0,v-dt*1.5);return;}
      if(rageT<0&&c>=nextRage){rageT=0;nz(.3,.08);snd(60,.35,'sawtooth',.06,-30);}
      if(rageT>=0){rageT+=dt;if(rageT>1.05){rageT=-1;nextRage=c+1.3+Math.random()*.8;}}
      v=Math.max(0,v-(.3+v*.25)*sp*(rageT>.45?2.6:1)*dt);
      if(g.t>=g.dur){g.result='lose';g.why='¡SIN LUZ!';rageT=-1;sfx.thud();sfx.lose();}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',warn=rageT>=0&&rageT<=.45,rage=rageT>.45,k=clamp(win?1:v,0,1);
      ctx.save();path([[0,0],[800,0],[800,576],[0,576]]);ctx.clip();
      AP.barrio(lit);poste();
      trafo(win?'dizzy':warn||rage?'zap':'angry',hurt);
      const hp=breaker(PX+(rage?Math.sin(now*70)*3:0),k,win);
      /* mamá y la abuela mirando, con la vela entre las dos */
      const AX=162,AS=.72,AY=FY-160*AS,sube=i=>win?-2.6+Math.sin(now*11+i)*.2:-.15;
      [[C.mama,54,AP.PIES.mama,130],[C.abuela,AX,AP.PIES.abuela,120]].forEach(([f,x,pies,th],i)=>bust(Object.assign({},f,{x,y:AY-(pies[2]-60)*AS-(win?Math.abs(Math.sin(now*11+i*2))*12:0),s:AS,th,legs:pies,look:1,
        mood:win?'happy':lose?(i?'frown':'angry'):'worry',talk:win?Math.abs(Math.sin(now*12+i)):0,
        arms:i?[{side:-1,a:-1.15,len:62,w:19,hand:(ex,ey)=>AP.vela(ex,ey-6,1)},{side:1,a:-sube(i),len:74,w:19}]:[{side:-1,a:sube(i),len:74,w:19},{side:1,a:win?-sube(i):.15,len:74,w:19}]})));
      /* el mecate: de la punta de la palanca a las manos de los tres que jalan (y sigue para afuera) */
      const P=[[C.chuo,456,.74,'#3b3550'],[C.tio,574,.74,'#5a4a3a'],[TU,700,.84,'#2f3a7a']].map(([f,x,s,pc],i)=>{const hx=x-82*s,u=clamp((hx-hp.x)/(800-hp.x),0,1);return{f,x,s,pc,i,hx,hy:lerp(hp.y,415,u)};});
      const soga=g.result?[[hp.x,hp.y],[hp.x+14,FY-30],[hp.x+60,FY-8],[430,FY-4],[820,FY-10]]:[[hp.x,hp.y]].concat(P.map(q=>[q.hx,q.hy]),[[820,415]]);
      line(soga,9,INK);line(soga,5,'#c9a66a');
      for(const q of P){const s=q.s,y=FY-160*s-(win?Math.abs(Math.sin(now*12+q.i))*14:0),rot=g.result?0:.16+(1-v)*.07+(flash>0?.05:0)+Math.sin(now*16+q.i)*.012;
        const cs=Math.cos(rot),sn=Math.sin(rot),dx=q.hx-q.x,dy=q.hy-y,lx=(dx*cs+dy*sn)/s,ly=(-dx*sn+dy*cs)/s;
        const brazo=sd=>win?{side:sd,a:sd*(2.6+Math.sin(now*12+q.i)*.2),len:74,w:19}:lose?{side:sd,a:sd*.12,len:76,w:19}
          :{side:sd,a:Math.atan2(lx-sd*33,ly-4),len:clamp(Math.hypot(lx-sd*33,ly-4),30,165),w:19};
        bust(Object.assign({},q.f,{x:q.x,y,s,th:110,bw:50,legs:[q.pc,'#ffffff',60],rot,look:-1,mood:win?'happy':lose?'frown':'yell',
          talk:win?Math.abs(Math.sin(now*12+q.i)):lose?0:.5+Math.sin(now*14+q.i)*.4,sweat:g.result?0:1,arms:[brazo(1),brazo(-1)]}));
        if(q.f===TU&&!g.result)tag(q.x+16,y-134*s);}
      /* la noche encima: se aclara con la palanca. Alumbran la vela, la punta de la palanca y las chispas del transformador */
      AP.oscuro(.66*(1-lit),[{x:AX-69,y:AY-16,r:124+Math.sin(now*17)*4,c:'#ffb020'},{x:hp.x,y:hp.y,r:66},{x:PX,y:TY,r:warn||rage?190:0,c:'#9fe8ff'}]);
      /* el rayo del transformador a la palanca */
      if(rage){const fr=Math.floor(now*24),b=[[PX+40,TY-64]];
        for(let i=1;i<=6;i++)b.push([lerp(PX+40,hp.x,i/6)+(i<6?(hash(i,fr,1)-.5)*44:0),lerp(TY-64,hp.y,i/6)+(i<6?(hash(i,fr,2)-.5)*30:0)]);
        line(b,10,'#ffffff');line(b,3.5,'#3fb0ff');}
      if(warn&&Math.sin(now*40)>0)txt('!',PX+108,256,72,'#ff4d5e');
      /* la barra: cuánto falta para que llegue la luz */
      const mx=250,my=114,mw=300;txt(win?'¡LLEGÓ!':'EL TRANSFORMADOR',400,100,20,win?'#ffd23f':'#ffffff');
      rr(mx,my,mw,24,6,'#14101c',4);if(k>.03)rr(mx+3,my+3,(mw-6)*k,18,4,k>.8?'#ffd23f':k>.4?'#7bd88f':'#ff4d5e',0);
      line([[mx+mw-4,my-6],[mx+mw-4,my+30]],4,'#ffd23f');
      if(win&&g.endT>.25){bubble(128,280,'¡LLEGÓ!',24,150,332);bubble(566,258,'¡LLEGÓ!',26,578,322);}
      if(lose&&g.endT>.3)bubble(128,280,'¡AY, NO!',22,150,332);
      ctx.restore();line([[0,576],[800,576]],4,INK);
      drawP();
    }};
  return g;
}
BUS.add('transformador',{name:'JEFE · TRANSFORMADOR',mk:mkTransformador,card:'EL TRANSFORMADOR',num:'J4'});
})();
