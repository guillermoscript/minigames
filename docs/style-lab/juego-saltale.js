'use strict';
/* MiniCaos · laboratorio de estilos: ¡SÁLTALE! (montarse con el autobús rodando).
   Vista de lado desde la calle, como ¡PARADA!: tú estás parado en la acera y la camionetica viene apurada; el chofer no frena,
   "medio aguanta la chola". Un solo toque = un solo salto, y el salto tarda lo suyo: hay que tocar cuando el estribo (la diana
   roja) pasa por la zona amarilla, que está un poquito ANTES de donde estás tú.
   Nivel 1: velocidad pareja. Niveles 2 y 3: más rápido, zona más angosta y el chofer cambia el paso una vez justo antes de
   llegar (viene embalado y clava el freno, o viene suave y mete la chola).
   Muy pronto (o nunca) = te estrellas / saltas al vacío y quedas de espaldas en la parada. Muy tarde = agarras la escalerita
   de atrás y te llevan arrastrado como un trapo.
   Se carga DESPUÉS de index.html y juegos-bus.js: dibuja con las primitivas del laboratorio y se registra con BUS.add. */
(function(){
if(!window.BUS||GAMES.saltale)return;
const{LV,CONF,TU,tag}=window.BUS,PI=Math.PI,SOOT='#1c1822';
/* el bus se dibuja en las coordenadas de ¡PARADA! y se achica a S; (RX,RY) = el punto del estribo donde caes, a ras de piso */
const S=.9,GY=500,RX=482,RY=508,NOSE=(786-RX)*S,TAIL=(RX-40)*S,JT=.3,SL=.3,PX=470,SX0=PX+16,FEET=566,PS=.72,LS=.62,Y0=FEET-170*PS,YL=GY+(452-RY)*S-170*LS,LX=PX+30,LY=538;
const PAS=[4,0,1,7,2,8,6,5];
const ME=Object.assign({},TU,{th:110,legs:['#2f3a7a','#ffffff',60]});
/* el colector y el chofer de ¡PARADA! */
const COL={skin:'#c98a5a',shirt:'#ffd23f',pat:'jersey',sh2:'#e8553d',cap:'#2b2b3a',capBack:1,hair:'curly',hairCol:'#14101c',earring:1,gold:1,th:120,legs:['#2b2b3a','#ffffff',60],bw:46,hw:36,hh:40};
const CHO={skin:'#b87b50',shirt:'#fffdf2',pat:'tank',hair:'slick',hairCol:'#14101c',stache:1,chain:1,glasses:'shades',earring:1,gold:1,bw:58,hw:44,hh:43};
const pop=(s,x,y,col,r=14)=>PT.push({x,y,vx:0,vy:-70,g:0,t:0,life:.8,kind:s,col,r,rot:(Math.random()-.5)*.2,vr:0});
const toot=(f,d)=>{snd(f,d*1.6,'sawtooth',.05);snd(f*1.26,d*1.6,'sawtooth',.04);};
const billetes=(x,y)=>{for(let i=0;i<3;i++){ctx.save();ctx.translate(x,y-8);ctx.rotate(-.4+i*.35);rr(-3,-30,26,38,3,['#5cd06a','#7be48a','#48b85a'][i],2.5);ctx.restore();}};
const alreves=(x,y,f)=>{ctx.save();ctx.translate(x,y);ctx.scale(-1,1);f();ctx.restore();};

/* la camionetica de ¡PARADA! entera y rodando. x = dónde está el estribo en pantalla.
   o: {L: cabeceo (+ frena, - acelera), dy, wa: giro de las ruedas, tgt: 0 sin diana / 1 roja / 2 verde, brk, clap, pm(i,k,cara)→ajustes, co: colector, ch: chofer} */
function encava(x,o){const L=o.L||0;
  ctx.save();ctx.translate(x,GY);ctx.scale(S,S);ctx.translate(-RX,-RY);
  ctx.translate(650,470);ctx.rotate(.03*L);ctx.translate(-650,-470+Math.sin(now*34)*1.4+(o.dy||0));
  /* atrás: la escalerita del techo y el escape */
  pole(26,196,442);for(let i=0;i<5;i++)line([[26,224+i*46],[44,224+i*46]],5,'#c4cad6');rr(6,438,38,11,4,'#8f8fa8',3);
  /* techo: sacos y la cabra que va de pasajera */
  for(const[cx,r]of[[104,26],[268,30],[350,26],[430,32]]){ell(cx+L*24,142,r,r*.62,'#e8d7a8',4);line([[cx+L*24-r*.5,138],[cx+L*24+r*.5,138]],2.5,'#a98a4a');}
  goat(186+L*12,152,.7);
  /* carrocería */
  rr(40,150,720,302,38,'#ff6b3d',5);rr(40,150,720,34,26,'#fff3c4',4);
  rr(40,366,720,40,0,'#ffd23f',0);rr(40,406,720,14,0,'#2f7fe0',0);line([[40,366],[760,366]],4,INK);line([[40,420],[760,420]],4,INK);
  for(let i=0;i<7;i++)poly([[560+i*30,452],[574+i*30,396],[588+i*30,452]],i%2?'#ffd23f':'#ff3b4e',2.5);
  txt('VOY TARDE  ·  CATIA - PETARE',240,388,17,INK,0,true);txt('EL APURADO',250,167,15,'#c4283a',0,true);
  for(let i=0;i<12;i++)poly([[56+i*60,184],[86+i*60,184],[71+i*60,200]],['#ff3b4e','#ffd23f','#3fa0ff','#5cff7a'][i%4],2);
  ell(54,336,7,12,o.brk?'#ff3b4e':'#a8283a',3);
  /* ventanas con gente */
  [62,154,246,338].forEach((wx,i)=>{const wy=206,ww=82,wh=124;
    ctx.save();path(rrP(wx,wy,ww,wh,10));ctx.clip();ctx.fillStyle=STY[style].col('#5a4a78');ctx.fillRect(wx,wy,ww,wh);
    for(let k=0;k<2;k++){const f=FACES[PAS[i*2+k]];bust(Object.assign({},f,{x:wx+(k?54:22)+L*14,y:wy+wh*(k?.88:.97),s:k?.6:.5,th:50,bw:50,rot:L*.3,look:1,cheeks:1},o.pm(i,k,f)));}
    if(o.clap){const d=6+Math.abs(Math.sin(now*15+i*1.3))*15,sk=FACES[PAS[i*2+1]].skin;hand(wx+ww/2-d,wy+wh-3,.35,.8,sk);hand(wx+ww/2+d,wy+wh-3,-.35,.8,sk);}
    ctx.restore();line(closeP(rrP(wx,wy,ww,wh,10)),6,'#c9ced6');});
  /* la puerta abierta y el estribo */
  rr(436,176,148,276,12,'#2d2640',4.5);
  ctx.save();path(rrP(442,182,136,264,8));ctx.clip();bust(Object.assign({},FACES[10],{x:466+L*14,y:366,s:.56,th:60,rot:L*.3,look:1},o.pm(9,0,FACES[10])));ctx.restore();
  pole(446,176,452);pole(574,176,452);rr(436,452,148,14,4,'#ffd23f',3.5);for(let i=0;i<7;i++)poly([[440+i*21,454],[450+i*21,454],[440+i*21,464],[430+i*21,464]],INK,0);
  /* el colector, guindado de la puerta */
  bust(Object.assign({x:540,y:318,s:.8},COL,o.co));
  /* la diana: lo que hay que mirar */
  if(o.tgt){const pz=Math.sin(now*14)*.5+.5,c=o.tgt>1?'#5cff7a':'#ff3b4e';
    line(closeP(ellP(RX,442,28+pz*9,28+pz*9,18)),5,'#ffe14d');ell(RX,442,25,25,'#ffffff',4);ell(RX,442,16,16,c,0);ell(RX,442,6,6,'#ffffff',0);
    poly([[RX-22,472],[RX+22,472],[RX,506]],c,4);}
  /* el chofer */
  rr(592,176,152,160,14,'#5a4a78',4.5);
  ctx.save();path(rrP(596,180,144,152,10));ctx.clip();wash(596,180,144,152,'#7fd0ff','#cfeeff');
  bust(Object.assign({x:668+L*10,y:340,s:.66,rot:Math.sin(now*4.4)*.05+L*.2,arms:[{side:-1,a:.5,len:70,w:22},{side:1,a:-.5,len:70,w:22}]},CHO,o.ch));
  ctx.save();ctx.translate(668,330);line(closeP(ellP(0,0,52,18,20)),9,'#3b3550');ctx.restore();
  ctx.restore();line(closeP(rrP(596,180,144,152,10)),6,'#c9ced6');
  /* retrovisor, parachoques, ruedas */
  rr(752,230,30,44,6,'#c9ced6',3.5);rr(730,408,56,26,8,'#c9ced6',3.5);
  for(const wx of[160,650]){ell(wx,454,62,52,'#ff6b3d',4.5);ell(wx,462,46,46,INK,3);ell(wx,462,19,19,'#c9ced6',3);
    for(let i=0;i<5;i++){const a=o.wa+i*TAU/5;line([[wx+Math.cos(a)*6,462+Math.sin(a)*6],[wx+Math.cos(a)*16,462+Math.sin(a)*16]],3,'#7a7f92');}}
  ctx.restore();}

/* ═════════ ¡SÁLTALE! (el estribo): un toque, un salto, justo cuando la diana pasa por la zona ═════════ */
function mkSaltale(){
  const rs=Math.sqrt(SP),lv=LV(),V=[400,520,640][lv-1],WIN=[.14,.1,.07][lv-1],ZW=V*WIN,ZX=PX-V*JT;
  /* el engaño: +1 viene embalado y frena, -1 viene suave y acelera. Siempre cruza la zona a V, así la ventana no cambia */
  const fake=lv===1?0:Math.random()<.5?1:-1,v0=V*(fake>0?[1,1.45,1.6][lv-1]:fake<0?[1,.66,.58][lv-1]:1),LEAD=[0,.6,.52][lv-1],DC=.16;
  const tA=(2+Math.random()*.6)/rs,tC=fake?tA-LEAD:1e9;
  const vel=t=>t<tC?v0:t<tC+DC?lerp(v0,V,(t-tC)/DC):V;
  const dist=t=>t<tC?v0*t:t<tC+DC?v0*t+(V-v0)*(t-tC)**2/(2*DC):v0*tC+(v0+V)/2*DC+V*(t-tC-DC);
  const bx0=ZX-dist(tA),smk=[],puff=(x,y,vx,vy,r,life,gr,col,fg)=>smk.push({x,y,vx,vy,r,life,gr,col,fg,t:0});
  let bx=bx0,sx=bx0,cam=0,follow=false,svx=0,sw=6,HOLD=652,mode='wait',vd='',jT=0,err=0,lp=null,loff=0,told=false,horn=false,wa=0,eng=0,exh=0,emit=0,spk=0,shake=0,ev1=false,ev2=false,dgx=PX+276,jumps=0;
  /* el salto: de la acera al estribo (o a donde debería estar) */
  const fly=u=>{const tx=vd==='win'?sx:vd==='late'?Math.max(PX+16,sx-TAIL+44):PX+34;
    return{x:lerp(SX0,tx,ease(u)),y:lerp(Y0,vd==='win'?YL:YL-8,u)-Math.sin(u*PI)*44,s:lerp(PS,LS,u)};};
  /* de trapo: las manos fijas en la escalerita, el resto estirado hasta el asfalto y rebotando */
  const hang=()=>{const sy=1.1+clamp((g.endT-SL)*.5,0,.2)+Math.sin(now*11)*.05,s=.56,Lt=346*s*sy,hx=sx+(26-RX)*S,hy=GY+(404-RY)*S,
      sag=clamp(GY-8-hy-Math.abs(Math.sin(now*13))*26,10,Lt*.8),r=PI/2-Math.asin(sag/Lt)+Math.sin(now*17)*.05,a=141*s*sy;
    return{x:hx-a*Math.sin(r),y:hy+a*Math.cos(r),r,s,sy,hx,hy,fx:hx-Lt*Math.sin(r),fy:hy+Lt*Math.cos(r)};};
  const D0=()=>g.kind==='bonk'?0:g.kind==='aire'?.2:.28,FT=()=>g.kind==='bonk'?.42:g.kind==='aire'?.3:.45;
  /* la cámara se va con el bus: el estribo se acomoda en `hold` y lo que corre es la calle */
  function chase(hold){follow=true;svx=vel(g.t);HOLD=hold;sw=clamp(2*svx/Math.max(60,Math.abs(hold-sx)),7,9);}
  function land(){lp=fly(1);loff=lp.x-sx;shake=.5;
    if(vd==='win'){g.result='win';g.kind='win';g.why='¡MONTADO!';chase(652);sfx.thud();sfx.win();spawn(sx,330,26,'conf',CONF);if(Math.abs(err)<.03)pop('¡LIMPIECITO!',sx-20,228,'#ffe14d',8);}
    else if(vd==='late'){g.result='lose';g.kind='trapo';g.why='¡RASPADO!';chase(730);sfx.thud();sfx.lose();snd(1300,.3,'sawtooth',.03,-800);pop('¡PLAF!',lp.x,lp.y-70,'#ffffff');}
    else{g.result='lose';g.why='¡PELASTE!';sfx.lose();
      if(sx+NOSE>=PX-10){g.kind='bonk';sfx.crash();pop('¡PAF!',lp.x,lp.y-80,'#ffe14d',20);spawn(lp.x,lp.y-30,9,'★',['#ffe14d'],240,400,.8);}
      else{g.kind='aire';shake=0;sfx.whoosh();pop('¿?',lp.x+44,lp.y-86,'#ffffff',16);}}}
  const g={get impact(){return Math.max(this.result?clamp(1-this.endT/.5,0,1):0,told?clamp(1-(this.t-tC)/.4,0,1)*.6:0);},
    probe:()=>({x:sx,zx:ZX,zw:ZW,v:vel(g.t),eta:tA-g.t,win:WIN,jt:JT,lv,fake,tA,tC,mode,vd,err,kind:g.kind,jumps,cam}),
    t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,cmd:'¡SÁLTALE!',
    hint:'TOCA (o ESPACIO) cuando la diana pase por la zona: ¡un solo salto!',
    /* un toque, un salto: el veredicto se decide aquí y se ve cuando aterrizas */
    press(){if(g.result||mode!=='wait'||g.t<.25/rs)return;mode='fly';jT=g.t;jumps++;err=(sx-ZX)/V;vd=Math.abs(sx-ZX)<=ZW?'win':sx<ZX?'early':'late';sfx.boing();},
    down(){g.press('any');},
    update(dt){g.t+=dt;shake=Math.max(0,shake-dt*2.5);
      const v=vel(g.t),flat=g.result==='lose'&&g.kind!=='trapo';
      bx=bx0+dist(g.t)+(flat?280*g.endT*g.endT:0);wa+=v*dt/40;
      if(follow){svx+=(-sw*sw*(sx-HOLD)-2*sw*svx)*dt;sx+=svx*dt;cam=bx-sx;}else sx=bx-cam;
      if(!horn&&g.t>=.12){horn=true;toot(392,.1);setTimeout(()=>toot(392,.32),160);}
      if((eng-=dt)<=0&&sx>-700&&sx<1300){eng=.08;snd(52+v/8,.09,'sawtooth',.014);}
      if((exh-=dt)<=0){exh=.1;puff(bx+(8-RX)*S,GY+(444-RY)*S,-30-Math.random()*40,-20-Math.random()*30,5,.5,24,'#6f6790');}
      /* el aviso del engaño: cabeceo + humo de caucho, o trompa arriba + humo negro del capó (nunca tapa la diana) */
      if(fake&&!told&&g.t>=tC){told=true;const nx=clamp(sx+215,110,690);
        if(fake>0){sfx.screech();pop('¡ÑIIIC!',nx,384,'#ff4d5e',16);for(let i=0;i<7;i++)puff(bx+150+Math.random()*50,GY-8,80+Math.random()*160,-(20+Math.random()*70),9,.6,44,'#f1ece2');}
        else{nz(.35,.14);snd(70,.5,'sawtooth',.09,150);pop('¡BRUUUM!',nx,384,'#ffe14d',16);for(let i=0;i<9;i++)puff(bx+NOSE-30+Math.random()*40,GY-150,-(40+Math.random()*200),-(110+Math.random()*190),10,.7,56,SOOT);}}
      if(!g.result){
        if(mode==='fly'){if(g.t-jT>=JT)land();}
        else if(sx-TAIL>PX+40||g.t>=g.dur){g.result='lose';g.kind='ido';g.why='¡TE DEJÓ!';sfx.lose();nz(.3,.1);}}
      else{g.endT+=dt;const e=g.endT,k=g.kind;
        if(k==='win'){if(!ev1&&e>=.3){ev1=true;nz(.05,.2);snd(900,.06,'square',.06);spawn(sx+22,292,6,'★',['#ffe14d','#ffffff'],200,300,.5);}
          if(!ev2&&e>=.8){ev2=true;sfx.ding();}}
        else if(k==='trapo'){if(!ev1&&e>=SL){ev1=true;shake=.4;snd(700,.1,'square',.06);}
          if(ev1&&(emit-=dt)<=0){emit=.028;const B=hang();spk++;
            PT.push({x:B.fx,y:B.fy,vx:-(40+Math.random()*240),vy:-(90+Math.random()*260),g:900,t:0,life:.3+Math.random()*.25,kind:'bit',col:['#ffe14d','#ff8a3d','#fff3a8'][spk%3],r:4+Math.random()*4,rot:Math.random()*6,vr:9});
            if(spk%3===0){puff(B.fx+cam,GY-6,-60,-30,7,.5,30,'#d8d2c4');nz(.05,.04);}}}
        else{if(k==='ido'&&e<.3&&(emit-=dt)<=0){emit=.04;puff(PX+(Math.random()-.5)*100,Y0-30+(Math.random()-.5)*130,60*Math.random(),-30,16,.9,50,SOOT,1);}
          if(!ev1&&e>=D0()+FT()){ev1=true;shake=.5;sfx.thud();spawn(LX+40,LY-30,8,'★',['#ffe14d'],200,400,.8);for(let i=0;i<6;i++)puff(LX+(Math.random()-.5)*170,LY+18,(Math.random()-.5)*180,-40,8,.5,30,'#f1ece2',1);}
          /* el perro viene a ver qué pasó */
          if(ev1){if(dgx>PX+172)dgx-=170*dt;else if(!ev2){ev2=true;snd(320,.08,'square',.05,-90);setTimeout(()=>snd(300,.1,'square',.05,-90),140);}}}}
      for(let i=smk.length-1;i>=0;i--){const s=smk[i];s.t+=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.vx*=Math.exp(-1.2*dt);if(s.t>s.life)smk.splice(i,1);}},
    draw(){
      const win=g.result==='win',lose=g.result==='lose',e=g.endT,k=g.kind,flat=lose&&k!=='trapo',fly1=mode==='fly'&&!g.result,hot=!g.result&&Math.abs(sx-ZX)<=ZW;
      const tb=told?g.t-tC:9,L=(told?fake*(1-Math.exp(-tb*25))*Math.exp(-2.6*tb)*Math.cos(tb*6):0),gone=sx>PX+50,cxs=x=>sx+(x-RX)*S;
      const humo=fg=>{for(const s of smk)if(!s.fg===!fg){const r=s.r+s.gr*s.t;ctx.save();ctx.globalAlpha=clamp((1-s.t/s.life)*1.5,0,.85);ell(s.x-cam,s.y,r,r*.85,s.col,0);ctx.restore();}};
      ctx.save();if(shake>0)ctx.translate(Math.sin(now*61)*5*shake,Math.cos(now*53)*4*shake);
      /* cielo, edificios y calle */
      wash(0,0,800,400,'#8fd8ff','#e8f8ff');ell(90,112,30,30,'#ffe14d',0);
      const bo=-(cam*.25%1000);
      for(let n=0;n<2;n++){const o=bo+n*1000;[[0,190,150,'#ffb36b'],[160,150,130,'#a9a0ff'],[300,200,170,'#ff9ec7'],[480,170,140,'#6ecf8f'],[630,210,160,'#ffd23f'],[800,180,150,'#8aa0ff']].forEach(([x,y,w,c])=>{if(o+x>800||o+x+w<0)return;
        rr(o+x,y,w,400-y,6,c,3.5);for(let i=0;i<3;i++)rr(o+x+14+i*(w/3.4),y+20,w/5,26,4,'#ffffff',2.5);});}
      rr(0,402,800,112,0,'#4d4a6e',0);rr(0,394,800,10,0,'#d8d2c4',0);
      for(let i=0;i<6;i++)rr(((i*180-cam)%1080+1080)%1080-60,440,90,8,4,'#ffe14d',0);
      for(let i=0;i<5;i++)rr(((i*190-cam*1.3)%950+950)%950-80,[414,426,470,484,494][i],60,4,2,'#6f6790',0);
      /* la camionetica */
      const hi=win&&e>.15&&e<.78,ask=win&&e>=.8,wv=Math.sin(now*16);
      const co=win?{x:548,look:-1,mood:ask?'grin':'happy',lids:ask?1:0,talk:ask?Math.abs(Math.sin(now*12)):0,
          arms:[{side:1,a:PI,len:64,w:20},ask?{side:-1,a:-1.5,len:70,w:20,hand:(x,y)=>hand(x-6,y,-PI/2,1.15,COL.skin)}:{side:-1,a:-lerp(1.2,PI-.1,clamp((e-.15)/.12,0,1)),len:70,w:20}]}
        :k==='trapo'?{x:500,rot:-.12,look:-1,mood:e<1.15?'o':'grin',talk:e>1.15?Math.abs(Math.sin(now*12)):0,arms:[{side:-1,a:-2.75,len:64,w:20},{side:1,a:2+wv*.25,len:76,w:20,hand:billetes}]}
        :{x:gone?524:544,rot:gone?-.1:.14+wv*.04,look:gone?-1:1,mood:lose?'grin':'yell',talk:Math.abs(Math.sin(now*14)),sweat:lose?0:1,
          arms:[{side:1,a:PI,len:64,w:20},{side:-1,a:(gone?-2.2:-1.9)+wv*.6,len:84,w:20,hand:billetes}]};
      encava(sx,{L,wa,tgt:g.result?0:hot?2:1,brk:fake>0&&tb<.5,clap:win,dy:win?Math.exp(-e*7)*Math.sin(e*22)*7:0,co,
        pm:(i,n,f)=>f.mood==='sleep'&&k!=='bonk'?null:win?{mood:'happy'}:k==='trapo'?{mood:n?'o':'panic',look:-1}:lose?{look:-1,mood:k==='bonk'&&e<.6?'o':f.mood}:tb<.7?{mood:fake>0?(n?'yell':'panic'):'o',sweat:1}:{look:gone?-1:1},
        ch:{mood:tb<.6?(fake>0?'yell':'grin'):k==='bonk'&&e<.7?'panic':'grin',talk:tb<.6?1:0}});
      humo(0);
      /* la acera, la parada y la gallina */
      rr(0,506,800,100,0,'#d8d2c4',0);line([[0,506],[800,506]],5,INK);
      for(let i=0;i<6;i++)rr(((i*160-cam)%960+960)%960-80,560,70,6,3,'#c4bba8',0);
      const sgx=700-cam;if(sgx>-80){pole(sgx,392,600);rr(sgx-42,348,84,48,8,'#2f7fe0',4.5);txt('PARADA',sgx,372,15,'#ffffff',0,true);alreves(sgx+6,330,()=>hen(0,0,.5,1));}
      /* la zona de salto, un poquito antes de donde estás */
      if(!g.result){const c=hot?(Math.sin(now*40)>0?'#ffffff':'#5cff7a'):'#ffd23f';
        rr(ZX-ZW,510,ZW*2,20,5,c,3.5);for(let i=-2;i<=2;i++){const x=ZX+i*ZW*.36;poly([[x-7,513],[x+1,513],[x+8,520],[x+1,527],[x-7,527],[x,520]],INK,0);}
        for(const sg of[-1,1])line([[ZX+sg*(ZW-14),410],[ZX+sg*ZW,410],[ZX+sg*ZW,510]],5,hot?'#5cff7a':'#ffe14d');
        txt('SALTA AQUÍ',ZX,545,14,INK,0,true);
        if(sx+NOSE<0){const b=Math.sin(now*10)*5;txt('◀',36+b,452,40,'#ffe14d');txt('¡AHÍ VIENE!',124+b,452,18,'#ffffff');}}
      /* tú */
      if(!g.result){
        if(!fly1){const on=sx+NOSE>0,near=clamp(1-(ZX-sx)/300,0,1),hop=near>.3?Math.abs(Math.sin(now*19))*5:0,sw2=Math.sin(now*12)*.12*near;
          bust(Object.assign({},ME,{x:SX0,y:Y0-hop,s:PS,look:gone?1:-1,mood:!on?'calm':near>.3?'panic':'worry',sweat:on?(near>.3?2:1):0,rot:-.06*near,
            arms:[{side:-1,a:-.3-near*.5+sw2,len:80,w:20},{side:1,a:.3+near*.5-sw2,len:80,w:20}]}));
          tag(SX0,Y0-PS*110-20-hop);}
        else{const u=clamp((g.t-jT)/JT,0,1),q=fly(u);
          bust(Object.assign({},ME,{x:q.x,y:q.y,s:q.s,look:1,mood:'yell',talk:1,rot:.22*Math.sin(u*PI),arms:[{side:-1,a:-2.5,len:80,w:20},{side:1,a:2.5,len:80,w:20}]}));}}
      else if(win){
        /* pose de héroe → chócala → y de una: el pasaje */
        const j=Math.exp(-e*7)*Math.sin(e*22)*6,shr=e>=1.15,x=sx-10,y=YL+j;
        bust(Object.assign({},ME,{x,y,s:LS,look:1,mood:ask?(shr?'worry':'o'):e<.2?'grin':'happy',sweat:ask?2:0,talk:ask?0:1,rot:ask?-.04:Math.sin(now*10)*.04,
          arms:shr?[{side:-1,a:-1.9,len:66,w:20},{side:1,a:1.9,len:66,w:20}]:ask?[{side:-1,a:-.2,len:80,w:20},{side:1,a:.2,len:80,w:20}]
            :hi?[{side:-1,a:-2.6,len:80,w:20},{side:1,a:PI-.1,len:84,w:20}]:[{side:-1,a:-2.5,len:80,w:20},{side:1,a:2.5,len:80,w:20}]}));
        /* los bolsillos por fuera: limpio */
        if(shr)for(const sg of[-1,1])poly([[x+sg*27,y+LS*72],[x+sg*48,y+LS*80],[x+sg*30,y+LS*100]],'#ffffff',2.5);}
      else if(k==='trapo'){const q=ease(clamp(e/SL,0,1)),B=hang(),a=lerp(2.4,PI+.263,q),al=lerp(80,150,q);
        bust(Object.assign({},ME,{x:lerp(sx+loff,B.x,q),y:lerp(lp.y,B.y,q),s:lerp(LS,B.s,q),sy:lerp(1,B.sy,q),rot:lerp(.15,B.r,q),th:lerp(110,150,q),legs:['#2f3a7a','#ffffff',lerp(60,100,q)],look:1,
          mood:q<1?'panic':'yell',talk:Math.abs(Math.sin(now*19)),sweat:2,arms:[{side:-1,a:-a,len:al,w:18},{side:1,a,len:al,w:18}]}));
        if(q>=1){ell(B.hx,B.hy,11,11,TU.skin,3.5);txt('¡AGUANTAAA!',170+Math.sin(now*47)*3,370+Math.cos(now*41)*2,30,'#ffe14d',-.06);}}
      else{
        /* de espaldas en la parada: contra el bus, al vacío, o tumbado por el humo */
        const d0=D0(),u=clamp((e-d0)/FT(),0,1),st=k==='ido'?{x:SX0,y:Y0,s:PS}:lp,rE=PI/2+(k==='bonk'?-TAU:k==='ido'?TAU:0),dn=u>=1,eh=e-d0-FT(),pre=u<=0,fl=Math.sin(now*40)*.5;
        bust(Object.assign({},ME,{x:lerp(st.x,LX,ease(u)),y:lerp(st.y,LY,u*u)-Math.sin(u*PI)*(k==='bonk'?70:k==='ido'?46:8),s:lerp(st.s,PS,u),rot:u*rE+(pre?Math.sin(now*30)*.06:0),
          sy:dn?1-.14*Math.exp(-eh*9)*Math.cos(eh*26):1,skin:k==='ido'?mix(TU.skin,SOOT,clamp(e/.3,0,1)*.62):TU.skin,look:pre&&k==='aire'?-1:0,down:pre&&k==='aire'?1:0,mood:dn?'dizzy':pre?(k==='ido'?'worry':'o'):'yell',talk:1,sweat:pre?2:0,
          arms:dn?[{side:-1,a:-2.1,len:80,w:20},{side:1,a:.55,len:70,w:20}]:[{side:-1,a:-2.2+fl,len:80,w:20},{side:1,a:2.2-fl,len:80,w:20}]}));
        if(dn)for(let i=0;i<3;i++){const a=now*5+i*TAU/3;txt('★',LX+46+Math.cos(a)*40,LY-54+Math.sin(a)*9,22,'#ffe14d');}}
      /* el perro de la parada */
      const dx=dgx-cam,arr=flat&&ev2;if(dx>-70){alreves(dx,578-(flat&&ev1&&!ev2?Math.abs(Math.sin(now*18))*5:0),()=>dog(0,0,.9));if(arr)txt('?',dx-40,494+Math.sin(now*6)*3,30,'#ffffff',.15);}
      if(flat&&e>.9){const bx2=860-(e-.9)*300,by2=438+Math.sin(now*5)*12;ctx.save();ctx.translate(bx2,by2);ctx.rotate(Math.sin(now*3)*.5);ell(0,0,17,20,'#ffffff',3);line([[-9,-16],[-13,-30],[-3,-19]],3,'#ffffff');line([[9,-16],[13,-30],[3,-19]],3,'#ffffff');ctx.restore();}
      humo(1);
      ctx.restore();
      /* lo que se gritan */
      const hx=cxs(co.x),hy=GY+(238-RY)*S;
      if(!g.result&&sx>-110&&sx<880)bubble(clamp(sx+40,205,595),128,gone?'¡MOSCA, QUE TE QUEDAS!':'¡DALE, DALE, QUE VOY TARDE!',19,clamp(hx,20,780),hy);
      if(ask)bubble(556,138,'¡PASAJE!',30,hx,hy);
      if(k==='trapo'&&e>1.15)bubble(540,132,'¡ARRASTRADO PAGA IGUAL!',19,Math.min(hx,770),hy);
      if(flat&&k!=='ido'&&e>.12&&sx>-40&&sx<840)bubble(clamp(sx+30,170,630),128,'¡AGARRA EL OTRO!',22,clamp(hx,20,780),hy);
      if(k==='ido'&&e>.3&&e<1.3)txt('¡COF! ¡COF!',PX-150+Math.sin(now*40)*2,430,24,'#ffffff',-.08);
      drawP();
    }};
  return g;
}
BUS.add('saltale',{name:'¡SÁLTALE!',mk:mkSaltale,card:'EL ESTRIBO',num:'14'});
})();
