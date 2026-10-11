'use strict';
/* MiniCaos · laboratorio de estilos: ¡DUÉRMETE! (el asiento preferencial).
   Vas sentado sabroso en el puesto preferencial. Se monta una doña con dos bolsas de mercado y un bastón, buscando a quién
   clavarle la mirada para que le den el puesto. La regla: cuando su mirada (el cono) esté sobre ti, tienes que tener los
   ojos cerrados. MANTENER = dormido; los ojos tardan un pelo en cerrarse, así que hay que reaccionar a su amague.
   No se puede mantener todo el juego: dormido se llena el RONQUIDO y, si se llena, te despiertas solo de un ronquido
   (¡JRRRC!) y ella te agarra. Soltar cuando NO mira lo vacía: duerme cuando mira, espía cuando se voltea.
   Nivel 1: pasa una vez, despacio, y como mucho se voltea una vez. Nivel 2: se te para enfrente, tose (¡EJEM!), dice
   "bueno, me voy..." y se voltea de golpe. Nivel 3: lo mismo más rápido y se voltea dos veces.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.duermete)return;
const{LV,CONF,TU,say,tag,phone}=window.BUS,PI=Math.PI;
const pop=(s,x,y,col,r=8,life=.8)=>PT.push({x,y,vx:0,vy:-60,g:0,t:0,life,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});

/* ───────── mantener presionado ─────────
   El puntero llega por BUS (down/up). El teclado del laboratorio solo avisa del keydown (press), así que el keyup y el
   blur son de este archivo. Estas dos banderas solo las lee este juego. */
let kH=false,pH=false;
addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'||e.code==='ArrowDown'||e.code==='KeyS')kH=false;});
addEventListener('blur',()=>{kH=pH=false;});
view.addEventListener('lostpointercapture',()=>{if(gameId==='duermete')pH=false;});

/* la doña: la abuela de ¡PARADA! con bata de flores y cara de pocos amigos */
const DN={skin:'#d99a6c',shirt:'#8e5bd0',pat:'floral',sh2:'#ffe08a',hair:'bun',hairCol:'#d8d8e0',glasses:'round',wrinkles:1,cheeks:1,brow:'thick',browCol:'#8a8494',earring:1,bw:56,hw:38,hh:38};
/* bolsa de mercado de rayas, con el cebollín y el plátano asomados. (x, y) = las asas */
function bolsa(x,y,s,c1,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
  line([[-9,0],[-15,18]],3.5,'#3b3550');line([[9,0],[15,18]],3.5,'#3b3550');
  limb(-12,22,-20,-2,6,'#3aa86a',2.5);limb(-5,22,-7,-8,5,'#5cd06a',2.5);limb(6,24,20,4,9,'#ffd23f',2.5);ell(-1,14,8,7,'#ff4d5e',2.5);
  rr(-24,16,48,44,8,c1,3.5);for(let i=0;i<3;i++)rr(-16+i*14,18,5,40,0,'#ffffff',0);
  ctx.restore();}
const bebe=(x,y,mood,look)=>bust({x,y,s:.34,skin:'#f0b995',shirt:'#fff3a8',hw:46,hh:46,hr:40,bw:40,th:60,hair:'curly',hairCol:'#3a2a20',mood,look,eyeS:19,eyeR:11,nose:'button',cheeks:1,brow:'none',
  over(){ell(0,HY+26,10,10,'#ff4d6d',3);ell(0,HY+26,5,5,'#ffd0d8',0);}});

/* ═════════ ¡DUÉRMETE! ═════════ */
function mkDuermete(){
  const rs=Math.sqrt(SP),lv=LV(),T=5/rs,R=(a,b)=>a+Math.random()*(b-a);
  const CLOSE=.15/rs,OPEN=.12,FILL=[3,2.4,1.85][lv-1],DRAIN=1.5/rs,PASS=[.9,.7,.5][lv-1],TB=.32/rs;
  const AY=452,PX=282,PY=322,PS=1.2,RS=468,LS=140,WS=150,DOOR=752,DS=.78,XA=lv===1?648:612,EYE=PY+PS*(HY-6),SL=62,S2=568,S3=666,PY2=AY-83;
  /* guion: cada mirada es {a: empieza el amague, b: te clava los ojos, c: se voltea}; kf = por dónde camina */
  const looks=[],kf=[[0,840],[TB,DOOR]];
  {let a=[R(1,1.2),R(.7,.82),R(.5,.6)][lv-1],w=[.6,.5,.4][lv-1],d=[R(.85,.95),R(.75,.85),R(.5,.6)][lv-1],t=a+w+d,x=LS;
    looks.push({a,b:a+w,c:t,ejem:lv>1});kf.push([a,XA]);
    if(lv===1)kf.push([a+w,XA-14],[t,RS]);else kf.push([a+w+.2*d,RS],[t,RS]);
    t+=PASS;kf.push([t,LS]);
    const n=lv===1?+(Math.random()<.75):lv-1;
    for(let i=0;i<n;i++){a=t+(i?R(.26,.36):R(0,.08));w=lv===1?.55:lv===2?R(.42,.5):R(.35,.45);d=lv===1?R(.7,.85):lv===2?R(.5,.6):R(.34,.42);
      t=a+w+d;looks.push({a,b:a+w,c:t});kf.push([t,x],[t+.22,x-=24]);}
    if(!n)kf.push([T,LS-30]);}
  const c1=looks[0].c;
  let eye=0,shut=false,snore=0,acted=false,dx=840,walk=0,cough=0,st0='off',cue=false,snT=0,inh=false,sd=1,fx=0,hit=false,poked=false,yawned=false,tsk=false,scroll=0,bx=0,byy=0;
  const gaze=t=>{for(const L of looks)if(t>=L.a&&t<L.c)return t<L.b?{st:'tell',k:(t-L.a)/(L.b-L.a),L}:{st:'on',k:1,L};return{st:'off',k:0};};
  const eta=t=>{for(const L of looks)if(t<L.c)return Math.max(0,L.b-t);return 1e9;};
  const xAt=t=>{for(let i=1;i<kf.length;i++)if(t<kf[i][0]){const p=kf[i-1],q=kf[i];return lerp(p[1],q[1],ease(clamp((t-p[0])/(q[0]-p[0]||1),0,1)));}return kf[kf.length-1][1];};
  const KN=()=>[PX+sd*48,500];
  function fail(kind){g.result='lose';g.kind=kind;g.why=kind==='ronco'?'¡AJÁ!':'¡TE VI!';sd=dx>PX?1:-1;fx=sd>0?RS:LS-8;sfx.lose();snd(980,.1,'square',.06);
    if(kind==='ronco'){nz(.3,.25);snd(90,.35,'sawtooth',.12,60);pop('¡JRRRC!',PX+104,172,'#ff4d5e',14,.9);}}
  /* seated: los pasajeros del fondo */
  const pas=(F,x,o)=>bust(Object.assign({},F,{x,y:PY2,s:.62,th:96,bw:50,legs:['#3b3550','#ffffff',30],vein:0,sweat:0},o));
  const seat=x=>{rr(x-50,300,100,150,16,'#3fa0ff',4);rr(x-40,286,80,36,12,'#6fbcff',3.5);};
  const cone=(ox,oy,tx,ty,col,al)=>{const L=Math.hypot(tx-ox,ty-oy)||1,nx=-(ty-oy)/L,ny=(tx-ox)/L,sp=Math.max(13,L*.15);
    ctx.save();ctx.globalAlpha=al;poly([[ox,oy],[tx+nx*sp,ty+ny*sp],[tx-nx*sp,ty-ny*sp]],col,0);ctx.restore();};

  const g={get impact(){return Math.max(cough*.6,this.result==='lose'?clamp(1-this.endT/.5,0,1):0);},
    probe:()=>{const z=g.result?{st:'off'}:gaze(g.t);return{lv,st:z.st,eta:eta(g.t),eye,shut,snore,hold:kH||pH,dx,close:CLOSE,fill:FILL,drain:DRAIN,looks:looks.map(L=>[L.a,L.b,L.c]),kind:g.kind};},
    t:0,dur:T,result:null,why:'',kind:'',endT:0,cmd:'¡DUÉRMETE!',
    hint:'MANTÉN (o ESPACIO) = dormido cuando te mire. Si no te ve, ¡suelta!',
    press(k){if(k==='up')kH=false;else kH=true;},
    down(){pH=true;},up(){pH=false;},
    update(dt){g.t+=dt;scroll+=dt*150;cough=Math.max(0,cough-dt*2.2);
      const h=!g.result&&(kH||pH);if(h)acted=true;
      eye=clamp(eye+(h?dt/CLOSE:-dt/OPEN),0,1);if(eye>=1)shut=true;else if(eye<.6)shut=false;
      if(!g.result){const x0=dx;dx=xAt(g.t);walk=clamp(Math.abs(dx-x0)/dt/120,0,1);
        snore=clamp(snore+(h?dt/FILL:-dt/DRAIN),0,1);
        const gz=gaze(g.t);
        if(!cue&&g.t>=TB){cue=true;sfx.thud();snd(196,.2,'triangle',.07);}
        if(gz.st!==st0){st0=gz.st;if(gz.st==='tell')snd(440,.16,'triangle',.07,420);else if(gz.st==='on')snd(1040,.07,'square',.05);}
        if(gz.st==='on'&&gz.L.ejem&&g.t>=gz.L.b+.3*(gz.L.c-gz.L.b)){gz.L.ejem=false;cough=1;nz(.13,.24);snd(170,.12,'sawtooth',.09,-50);setTimeout(()=>{nz(.1,.2);snd(150,.1,'sawtooth',.08,-40);},170);}
        /* el ronquido suena más duro mientras más lleno */
        if(shut&&(snT-=dt)<=0){inh=!inh;snT=inh?.36:.3;if(inh)snd(58+snore*46,.32,'sawtooth',.02+snore*.07,22);else snd(520+snore*500,.24,'sine',.012+snore*.03,260);}
        if(snore>=1)fail('ronco');else if(gz.st==='on'&&!shut)fail('visto');
        else if(g.t>=g.dur){g.result='win';g.why='¡FINGE DEMENCIA!';sfx.win();spawn(PX,PY-150,24,'conf',CONF);}}
      else{g.endT+=dt;const e=g.endT;
        if(g.result==='lose'){dx=lerp(dx,fx,Math.min(1,dt*12));walk=e<.3?1:0;
          if(!hit&&e>=.58){hit=true;sfx.thud();sfx.crash();const K=KN();pop('¡PAF!',K[0]+sd*46,K[1]-64,'#ffe14d',16);spawn(K[0],K[1]-14,12,'bit',['#ff4d5e','#5cd06a','#ffd23f'],300,800,1);}
          if(!tsk&&e>=.95){tsk=true;say('¡QUÉ PENA!',S2+50,236,'#ffe14d');sfx.cluck();}}
        else{dx=lerp(dx,e<.75?WS:SL,Math.min(1,dt*(e<.75?10:16)));walk=e<.3?1:0;
          if(!yawned&&e>=.12){yawned=true;pop('¡UAAAH!',PX+118,168,'#ffffff',10,1);snd(300,.7,'sine',.06,-140);}
          if(!poked&&e>=.42){poked=true;sfx.boing();pop('¡TOC!',SL+20,236,'#ffe14d',8);}}}},
    draw(){
      const e=g.endT,win=g.result==='win',lose=g.result==='lose',gz=g.result?{st:lose&&e<.58?'on':'off',k:1}:gaze(g.t);
      const left=dx<PX,f=win?1:lose?(left?1:-1):left?(gz.st==='on'||(gz.st==='tell'&&gz.k>.5)?1:-1):-1;
      const aboard=g.t>=TB*.3,seated=win&&e>.75,stare=lose&&hit,bob=Math.abs(Math.sin(now*13))*5*walk,hop=lose?84*ease(clamp(e/.12,0,1))*(1-ease(clamp((e-.38)/.16,0,1))):0,by=AY-126-bob-hop,ox=dx+f*10,oy=by-DS*70,ME=[PX+(left?-36:36),EYE+4];
      /* a dónde apunta la mirada: primero repasa a los del fondo, y antes de clavártela hace el amague */
      let tg=null;
      if(lose&&e<.58)tg=ME;
      else if(!g.result&&g.t>=TB){const L0=looks[0],k=ease(gz.k);let base=null;
        if(g.t<L0.b)base=[lerp(S3,S2,ease(clamp(((g.t-TB)/(L0.a-TB)-.4)/.2,0,1))),PY2-26];
        else if(dx<PX-110)base=[dx-92,PY2-14];
        if(gz.st==='on')tg=ME;
        else if(gz.st==='tell'){
          if(left){const an=lerp(PI,TAU+Math.atan2(ME[1]-oy,ME[0]-ox),k),rd=lerp(92,Math.hypot(ME[0]-ox,ME[1]-oy),k);tg=[ox+Math.cos(an)*rd,oy+Math.sin(an)*rd];}
          else{const b0=base||[dx-90,PY2-20];tg=[lerp(b0[0],ME[0],k),lerp(b0[1],ME[1],k)];}}
        else tg=base;}
      const fake=x=>!g.result&&tg&&gz.st==='off'&&g.t<looks[0].a&&Math.abs(tg[0]-x)<44;
      ctx.save();if(cough>.1||(stare&&e<.8))ctx.translate(Math.sin(now*70)*2.5,Math.sin(now*53)*1.5);
      /* el bus por dentro */
      wash(gameLeft(),0,GAME_VIEW.width,600,'#f6e3b4','#ecd29a');
      rr(gameLeft(),92,GAME_VIEW.width,36,0,'#d9dce6',0);line([[gameLeft(),128],[gameRight(),128]],4,INK);txt('ASIENTO PREFERENCIAL ▼',PX,110,14,INK,0,true);
      line([[0,150],[578,150]],8,'#c4cad6');
      for(let i=0;i<5;i++){const x=64+i*112,sw=Math.sin(now*2+i)*2;line([[x,150],[x+sw,172]],4,'#3b3550');line(closeP(ellP(x+sw,183,9,11,10)),4,'#ffd23f');}
      /* ventanas: por la calle pasa un chivo en moto */
      const gx=980-(now*190)%1700;
      for(let i=0;i<5;i++){const wx=6+i*138;rr(wx,190,122,104,12,'#5a4a78',4.5);
        ctx.save();path(rrP(wx+6,196,110,92,8));ctx.clip();wash(wx,190,122,104,'#8fd8ff','#e8f8ff');
        for(let j=0;j<6;j++){const x=((j*170+scroll)%1020+1020)%1020-140;rr(x,222+(j%3)*14,120,90,4,['#ffb36b','#a9a0ff','#ff9ec7','#6ecf8f','#ffd23f','#8aa0ff'][j],3);}
        if(gx>wx-60&&gx<wx+180){goat(gx,284,.5);ell(gx-18,286,9,9,'#14101c',2.5);ell(gx+20,286,9,9,'#14101c',2.5);}
        ctx.restore();}
      /* el retrovisor del chofer */
      rr(590,134,88,36,8,'#2d2640',3.5);rr(596,139,76,26,5,'#9fdcff',0);
      for(const sg of[-1,1]){const mx=634+sg*16;ell(mx,152,8,7,'#ffffff',2.5);ell(mx+(stare?-3.5:1),152+(stare?2:0),3.2,3.6,INK,0);if(stare)line([[mx+sg*9,141],[mx-sg*7,146]],3.5,INK);}
      /* la puerta por donde se monta */
      rr(706,140,94,AY-132,10,'#2d2640',4.5);
      ctx.save();path(rrP(714,150,80,AY-150,6));ctx.clip();wash(714,150,80,260,'#8fd8ff','#e8f8ff');rr(714,392,80,AY-392,0,'#d8d2c4',0);line([[714,392],[794,392]],4,INK);ctx.restore();
      rr(708,96,90,30,8,'#c4283a',3.5);txt('SUBIDA',753,112,15,'#ffffff',0,true);
      rr(gameLeft(),AY,GAME_VIEW.width,148,0,'#5a5274',0);line([[gameLeft(),AY],[gameRight(),AY]],5,INK);for(let i=0;i<9;i++)rr(i*95-30,AY+22,56,6,3,'#6f6790',0);
      rr(706,AY-6,94,14,4,'#ffd23f',3.5);
      /* los puestos del fondo: todos ocupados (uno, por una bombona con su cinturón) */
      for(const x of[SL,176,454,S2,S3])seat(x);
      rr(430,340,48,100,20,'#ff8a3d',4);rr(445,322,18,22,5,'#8f8fa8',3);ell(454,320,13,7,'#c9ced6',3);txt('GAS',454,388,14,'#ffffff',0,true);line([[416,330],[492,420]],6,'#14101c');
      /* el dormido de verdad: ni se entera */
      if(!poked){pas(FACES[6],SL,{mood:'sleep',rot:.16,hair:'bald'});
        for(let i=0;i<2;i++){const u=(now*.7+i/2)%1;ctx.save();ctx.globalAlpha=1-u;txt('z',SL+34+u*22,PY2-56-u*40,13+u*9,'#ffffff');ctx.restore();}}
      else{const q=clamp((e-.42)/.4,0,1),x=lerp(SL,104,q),y=lerp(PY2,218,ease(q))-50*Math.sin(q*PI);
        /* brinca del susto y queda guindado del pasamanos */
        bust(Object.assign({},FACES[6],{x,y,s:.62,th:110,bw:50,legs:['#3b3550','#ffffff',60],mood:q<1?'panic':e>1.5?'worry':'dizzy',rot:q<1?-q*.3:Math.sin(now*5)*.07,vein:0,sweat:1,
          arms:[{side:1,a:lerp(2.5,3.05,q),len:lerp(70,100,q),w:19},{side:-1,a:-lerp(2.5,3.05,q),len:lerp(70,100,q),w:19}]}));
        if(q>=1&&e<1.5)for(let i=0;i<3;i++){const an=now*5+i*TAU/3;txt('★',x+Math.cos(an)*30,y-74+Math.sin(an)*7,16,'#ffe14d');}}
      /* los demás: cuando ella los mira se hacen los dormidos; si te agarran, todos te juzgan */
      const f2=fake(S2),f3=fake(S3),lk=stare?-1:aboard&&!win?(dx>S2?1:-1):0;
      pas(FACES[7],S2,{mood:stare?'angry':f2?'sleep':win?'smile':aboard?'worry':'smile',look:stare?-1:lk,brow:stare?'thick':null});
      pas(FACES[0],S3,{mood:stare?'frown':f3?'sleep':win?'grin':aboard?'worry':'grin',look:stare?-1:lk});
      bebe(S3+18,PY2+46,stare?'o':f3?'sleep':'calm',stare?-1:0);
      for(const[x,on]of[[S2,f2],[S3,f3]])if(on)txt('z',x+34,PY2-66+Math.sin(now*8)*3,16,'#ffffff');
      ctx.save();ctx.translate(617,290);if(stare)ctx.scale(-1,1);hen(0,0,.5,stare?1:-.5);ctx.restore();
      /* la doña */
      if(aboard){
        if(seated){bust(Object.assign({},DN,{x:dx,y:PY2-4,s:.7,th:96,legs:[DN.skin,'#2b2b3a',26],look:1,mood:e>1.3?'grin':'happy',teeth:1,arms:[{side:1,a:.5,len:50,w:20},{side:-1,a:-.5,len:50,w:20}]}));
          bolsa(dx-26,PY2+34,.62,'#ff5ca8');bolsa(dx+26,PY2+34,.62,'#5cd0c0');line([[dx+52,PY2-8],[dx+60,AY-2]],5,'#8a5a30');}
        else{const k=gz.k,sw=Math.sin(now*13)*.12*walk,tell=gz.st==='tell',on=gz.st==='on';
          const thr=lose?clamp((e-.3)/.15,0,1):0,fa=lose?(e<.45?lerp(.14,2.6,ease(thr)):stare?1.5:lerp(2.6,1,clamp((e-.45)/.13,0,1))):.14+sw;
          const pk=win?ease(clamp((e-.25)/.17,0,1)):0,ba=-.14-sw-pk*1.36;
          bust(Object.assign({},DN,{x:dx,y:by,s:DS,flip:f<0,look:1,th:112,legs:[DN.skin,'#2b2b3a',62],
            rot:on?f*.07:tell?(left?Math.sin(k*PI*3)*.06:-.09*Math.sin(k*PI)):lose?f*.1:Math.sin(now*13)*.03*walk,sy:tell&&left?1-.1*Math.sin(k*PI):1,
            mood:cough>.1?'yell':lose?(e<.3?'o':'yell'):win?'angry':on?'angry':tell?'o':'frown',talk:cough>.1||lose?1:0,teeth:1,lids:on&&!lose&&cough<=.1?1:0,vein:on||stare?1:0,
            arms:[{side:1,a:fa,len:70,w:20,hand:lose&&e>=.45?null:(hx,hy)=>bolsa(hx,hy+2,1,'#ff5ca8')},
              {side:-1,a:ba,len:70,w:20,hand:(hx,hy)=>{const L=pk>0?lerp(86,62,pk):86,sn=Math.sin(ba*pk),cs=Math.cos(ba*pk);
                if(pk<.5)bolsa(hx-35*Math.sin(ba),hy-33*Math.cos(ba),.9,'#5cd0c0');
                line([[hx-sn*16,hy-cs*16],[hx+sn*L,hy+cs*L]],6,'#8a5a30');line([[hx-sn*16,hy-cs*16],[hx-sn*16+cs*11,hy-cs*16-sn*11+4]],6,'#8a5a30');}}]}));}}
      /* tu puesto: el preferencial, amarillo y con su calcomanía */
      rr(PX-100,300,200,196,26,'#ffd23f',4.5);rr(PX-66,284,132,50,18,'#ffe27a',3.5);
      for(const sg of[-1,1]){const sx=PX+sg*80;rr(sx-14,318,28,30,6,'#2f7fe0',3);ell(sx-3,326,3.5,3.5,'#ffffff',0);line([[sx-3,330],[sx-3,342]],3,'#ffffff');line([[sx-3,333],[sx+6,338],[sx+6,343]],2.5,'#ffffff');}
      rr(PX-112,486,224,36,14,'#e0a81e',4.5);rr(PX-98,522,196,50,0,'#2d2640',0);rr(PX-92,522,14,50,0,'#8f8fa8',3);rr(PX+78,522,14,50,0,'#8f8fa8',3);
      /* tú */
      const onMe=gz.st==='on'&&!g.result,kk=stare?Math.exp(-(e-.58)*3.5)*Math.abs(Math.sin((e-.58)*13)):0,yawn=win&&e<1,ph=(!acted&&!g.result)||(win&&!yawn);
      const rot=shut&&!g.result?.1+Math.sin(now*3)*.02:yawn?-.06:0,px=PX+(onMe&&shut?Math.sin(now*46)*1.6:0),py=PY-kk*16;
      bust(Object.assign({},TU,{x:px,y:py,s:PS,hw:44,hh:44,bw:56,th:150,eyeR:12,eyeS:19,rot,
        mood:lose?(hit?(e<1.15?'yell':'frown'):'panic'):win?(yawn?'sleep':'grin'):shut?'sleep':!acted&&gz.st==='off'?'calm':gz.st==='tell'?'panic':'worry',
        lids:!g.result&&!shut&&eye>.05?1:0,look:lose?(left?-1:1):win?-1:aboard?(left?-1:1):0,down:ph&&!win&&gz.st==='off'?1:0,talk:stare?1:0,
        sweat:lose?2:win?0:gz.st==='on'?2:aboard&&Math.abs(dx-PX)<340?1:0,
        arms:yawn?[{side:1,a:2.5+Math.sin(now*9)*.08,len:88,w:22},{side:-1,a:-2.5-Math.sin(now*9)*.08,len:88,w:22}]
          :stare&&e<1.15?[{side:1,a:2.3,len:84,w:22},{side:-1,a:-2.3,len:84,w:22}]
          :ph?[{side:1,a:-.75,len:54,w:22,hand:(hx,hy)=>phone(hx,hy-14,0,1.15)},{side:-1,a:.25,len:82,w:22}]:[{side:1,a:.12,len:86,w:22},{side:-1,a:-.12,len:86,w:22}]}));
      tag(PX,150);
      /* piernas: la rodilla es donde cae la bolsa */
      const pants='#2f3a7a';
      for(const sg of[-1,1]){const kc=stare&&sg===sd?kk:0,kx=PX+sg*48,ex=kx+sg*(22+52*kc),ey=542-58*kc;
        ell(PX+sg*42,500,38,22,pants,4);limb(kx,506,ex,ey,27,pants,4);limb(ex,ey-4,ex+sg*2,ey+8,24,'#ffffff',3);ell(ex+sg*12,ey+18,28,11,'#e8553d',4);}
      if(!ph&&!lose)phone(PX+4,490,1.35,1);
      /* dormido: baba y Zzz que crecen con el ronquido */
      if(shut&&!g.result){const c=Math.cos(rot),s=Math.sin(rot),lx=PS*18,ly=PS*(HY+44*.56+12),jx=snore>.75?Math.sin(now*50)*2.5:0;
        ell(px+lx*c-ly*s,py+lx*s+ly*c+Math.sin(now*4)*2,4.5,8,'#9fe3ff',2.5);
        for(let i=0;i<3;i++){const u=(now*.8+i/3)%1;ctx.save();ctx.globalAlpha=clamp((1-u)*1.6,0,1);txt('Z',PX+64+u*74+jx,204-u*52,(15+snore*30)*(.55+u*.6),snore>.75?'#ff4d5e':'#ffffff',.12);ctx.restore();}}
      /* la mirada */
      if(tg&&aboard&&!seated){const on=gz.st==='on',tell=gz.st==='tell';
        cone(ox,oy,tg[0],tg[1],on?'#ff4d5e':tell?mix('#ffe14d','#ff8a3d',gz.k):'#ffe14d',on?.5:tell?.44+.1*gz.k:.4);
        if(on)line([[ox,oy],tg],4,'#ff4d5e');}
      if(gz.st==='tell')txt('¡!',dx+(left?26:-26),by-DS*130+Math.sin(now*30)*2,30+gz.k*12,'#ffe14d',left?.12:-.12);
      if(onMe&&cough<=.1)txt('¿...?',dx,by-DS*132,24,'#ffffff');
      if(lose&&e<.58)txt('¡!',PX+(left?70:-70),EYE-64,46,'#ff4d5e',left?.12:-.12);
      /* la bolsa sale volando hasta tu rodilla */
      if(lose&&e>=.45){const K=KN(),u=clamp((e-.45)/.13,0,1),v=clamp((e-.58)/.16,0,1),hx0=dx-sd*56,hy0=by-44;
        if(u<1)bolsa(lerp(hx0,K[0],u),lerp(hy0,K[1]-40,u)-70*Math.sin(u*PI),1.15,'#ff5ca8',-sd*u*2.4);
        else bolsa(lerp(K[0],K[0]+sd*74,v),lerp(K[1]-40,516,v)-30*Math.sin(v*PI),1.15,'#ff5ca8',sd*(1.2*v-2.4*(1-v)));}
      /* todo el bus te mira */
      if(stare&&e>.75){ctx.save();ctx.globalAlpha=.3*clamp((e-.75)*4,0,1);for(const[x,y]of[[S2-22,PY2-42],[S3-22,PY2-42],[S3+8,PY2+26],[594,274],[620,154]])line([[x,y],[PX+50,EYE+2]],2.5,'#ffffff');ctx.restore();}
      ctx.restore();
      /* lo que dice */
      if(!g.result){
        if(g.t>=TB&&g.t<looks[0].a)bubble(clamp(dx-96,430,580),198,'¿NADIE SE PARA?',19,dx-10,by-DS*104);
        if(cough>.1)txt('¡EJEM!',dx+8+Math.sin(now*60)*3,196,42,'#ff4d5e',-.06);
        if(lv>1&&g.t>=c1&&g.t<c1+PASS*.85)bubble(PX+244,198,'BUENO, ME VOY...',18,Math.max(dx,PX+76),by-DS*100);}
      if(lose&&e>.95)bubble(clamp(dx,138,600),178,g.kind==='ronco'?'¡Y RONCANDO, PUES!':'¡PÁRESE, MIJO!',21,dx,by-DS*106);
      if(win&&e>1.05)bubble(PX+190,186,'¿YA LLEGAMOS?',20,PX+56,PY-PS*58);
      /* medidor del ronquido */
      if(!g.result){const hot=snore>.75,bl=hot&&Math.sin(now*28)>0;
        rr(452,506,318,60,16,'#2d2640',4);txt('RONQUIDO',520,524,14,'#fff3c4',0,true);txt(shut?'OJOS CERRADOS':'OJOS ABIERTOS',668,524,13,shut?'#9fe3ff':'#ffe14d',0,true);
        rr(468,538,286,16,8,'#14101c',0);if(snore>.01)rr(471,541,280*snore,10,5,bl?'#ffffff':hot?'#ff4d5e':snore>.5?'#ffd23f':'#5cff7a',0);
        if(hot)txt('¡SUELTA!',611,490+Math.sin(now*24)*2,22,'#ff4d5e');}
      drawP();
    }};
  return g;
}

BUS.add('duermete',{name:'¡DUÉRMETE!',mk:mkDuermete,card:'EL DORMIDO',num:'40'});
})();
