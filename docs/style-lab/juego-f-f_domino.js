'use strict';
/* LA FIESTA · versus: ¡CAPICÚA! Ritmo en la mesa de dominó bajo el mango. Cada abuelo tiene su pista: las fichas vienen con el
   compás (la MISMA partitura para todos, sembrada con c.rng) y hay que PEGAR el botón justo cuando llegan a la raya.
   Perfecto ±60 ms = 10, bueno ±130 ms = 6, regular ±200 ms = 3, toque sin ficha = -2, 8 seguidas buenas = +10 (¡TRANCADO!).
   Caos: ¡EL DOBLE SEIS! (ficha dorada, 30 si es perfecta), ¡SE FUE LA LUZ! (nivel 2+, a oído) y ¡CAMBIO DE RITMO! (+20 % 4 s).
   1 botón. Sirve en ffa, 2v2 (suma del equipo) y 1v3 (el solo contra la media del trío). */
(function(){
if(!window.FIESTA||!FIESTA.VS||FIESTA.VS.games.f_domino)return;
const PIP=[[],[[0,0]],[[-1,-1],[1,1]],[[-1,-1],[0,0],[1,1]],[[-1,-1],[1,-1],[-1,1],[1,1]],[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],[[-1,-1],[0,-1],[1,-1],[-1,1],[0,1],[1,1]]];
const TCOL=['#ff9a3d','#9a7bff'],TNAME={'2v2':['NARANJA','MORADO'],'1v3':['SOLO','TRÍO']};
const WIN_P=.06,WIN_G=.13,WIN_O=.2,SPD=330;
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
/* ficha acostada centrada en x,y; a|b son los puntos de cada mitad (hasta 6) */
function ficha(x,y,w,a,b,o,gold){
  const h=w/2,d=h*.27,r=Math.max(2,h*.1);
  rr(x-w/2,y-h/2,w,h,h*.2,gold?'#ffd23f':'#fffdf2',o);
  line([[x,y-h*.36],[x,y+h*.36]],Math.max(1.6,h*.06),gold?'#a8741a':'#14101c');
  [a,b].forEach((n,i)=>{const cx=x+(i?1:-1)*w/4;for(const q of PIP[n])ell(cx+q[0]*d,y+q[1]*d,r,r,gold?'#7a2a14':'#14101c',0);});
}
FIESTA.VS.add('f_domino',{name:'¡CAPICÚA!',modos:['ffa','2v2','1v3'],dur:20,botones:1,hint:'TOCA CUANDO LA FICHA LLEGUE A LA RAYA',
mk(c){
  const n=c.n,lv=cl(c.lv||1,1,3),rng=c.rng,say=(window.BUS&&BUS.say)||function(){};
  const L=gameLeft(),R=gameRight(),MX=L+210,TOP=100,BOT=c.campoAbajo-34;
  const LH=Math.min(94,(BOT-TOP)/n),Y0=TOP+((BOT-TOP)-LH*n)/2,FW=LH>80?64:54;
  const cyOf=p=>Y0+p*LH+LH/2;
  /* ───── partitura (idéntica para todos) ───── */
  const b0=60/[100,120,140][lv-1],T0=2.2,TEND=17.6;
  const tcS=8+rng.next()*3,tcE=tcS+4;
  const bl=t=>(t>=tcS&&t<tcE)?b0/1.2:b0;
  const pD=[.05,.14,.2][lv-1],pO=[.1,.18,.24][lv-1],pR=[.14,.14,.12][lv-1];
  const beats=[],notes=[];
  for(let t=T0,i=0;t<TEND;i++){
    const B=bl(t);beats.push({t,acc:i%4===0});
    const mk1=o=>notes.push({t:t+o*B,a:rng.int(0,6),b:rng.int(0,6),gold:false,dark:false,on:o===0});
    if(i<3)mk1(0);
    else{const r=rng.next();
      if(r<pD){mk1(0);mk1(.5);}else if(r<pD+pO)mk1(.5);else if(r<pD+pO+pR){}else mk1(0);}
    t+=B;
  }
  let dk0=-1,dk1=-1;
  if(lv>=2){const i0=Math.floor(beats.length*(.55+rng.next()*.1));dk0=beats[i0].t;dk1=dk0+2*bl(dk0);}
  const okG=notes.filter((q,i)=>q.on&&i>notes.length*.3&&i<notes.length*.8&&(dk0<0||q.t<dk0-.5||q.t>dk1+.5));
  const gold=okG.length?rng.pick(okG):notes[Math.floor(notes.length/2)];gold.gold=true;gold.a=6;gold.b=6;
  for(const q of notes)q.dark=dk0>=0&&q.t>=dk0-.15&&q.t<=dk1+.1;
  const LAST=notes[notes.length-1].t,N=notes.length;
  /* ───── estado ───── */
  const st=[],hitT=[],pts=[],combo=[],perf=[],ph=[],mood=[],say0=[],tr=[],aiI=[],plan=[];
  for(let p=0;p<n;p++){st.push(new Int8Array(N));hitT.push(new Float32Array(N));pts[p]=0;combo[p]=0;perf[p]=0;ph[p]=0;mood[p]=0;say0[p]=0;tr[p]=0;aiI[p]=0;plan[p]=[];}
  let t=0,bi=0,shake=0,bnc=0,slams=0,dogJ=0,dogSay=0,ban=null,banT=0,warn=[false,false,false],lastBeatT=-9;
  const fx=[],FI=[1,6,9,4];
  const darkA=()=>{if(dk0<0)return 0;if(t<dk0-.6||t>dk1+.5)return 0;return t<dk0-.2?(t-(dk0-.6))/.4:t>dk1+.1?1-(t-dk1-.1)/.4:1;};
  const banner=(s,col)=>{ban={s,col};banT=1.7;};
  const g={scores:new Array(n).fill(0),fin:false,
    update(dt){
      /* avisos del caos */
      if(!warn[0]&&t>=gold.t-1.5){warn[0]=true;banner('¡EL DOBLE SEIS! 30 SI ES PERFECTA','#ffd23f');}
      if(!warn[1]&&t>=tcS-.3){warn[1]=true;banner('¡CAMBIO DE RITMO!','#ff5c8a');}
      if(!warn[2]&&dk0>=0&&t>=dk0-.9){warn[2]=true;banner('¡SE FUE LA LUZ! JUEGA A OÍDO','#9ad0ff');}
      /* el compás suena */
      while(bi<beats.length&&beats[bi].t<=t){const bt=beats[bi];lastBeatT=t;snd(bt.acc?180:130,.07,'sine',.07);if(darkA()>.5||bt.acc)snd(bt.acc?900:700,.03,'square',.02);bi++;}
      for(let p=0;p<n;p++){
        ph[p]=Math.max(0,ph[p]-dt*5);mood[p]=Math.max(0,mood[p]-dt);say0[p]=Math.max(0,say0[p]-dt);
        const cy=cyOf(p);
        /* fichas que se pasaron */
        for(let i=0;i<N;i++)if(st[p][i]===0&&t>notes[i].t+WIN_O){st[p][i]=2;combo[p]=0;perf[p]=0;mood[p]=.9;
          if(say0[p]<=0){say0[p]=.7;say('¡PASO!',MX-6,cy-34,'#ffe14d');}}
        /* toques */
        const k=c.tap(p,'a');
        for(let j=0;j<k;j++){
          let bi2=-1,bd=9;
          for(let i=0;i<N;i++){if(st[p][i]!==0)continue;const d=Math.abs(notes[i].t-t);if(d<bd){bd=d;bi2=i;}if(notes[i].t>t+.5)break;}
          ph[p]=1;slams++;bnc=Math.min(1,bnc+.25);tr[p]=.35;
          if(bi2<0||bd>WIN_O){pts[p]-=2;combo[p]=0;perf[p]=0;mood[p]=.9;snd(110,.1,'square',.05,-50);
            if(say0[p]<=0){say0[p]=.9;say('SE TE CAYÓ LA FICHA',MX+30,cy-34,'#ff8a8a');}continue;}
          const q=notes[bi2];st[p][bi2]=1;hitT[p][bi2]=t;
          let v=0,lab='';
          if(bd<=WIN_P){v=10;lab='¡CAPICÚA!';}else if(bd<=WIN_G){v=6;lab='¡PLA!';}else{v=3;lab='pla';}
          if(q.gold){if(bd<=WIN_P){v=30;lab='¡DOBLE SEIS!';shake=1;spawn(MX,cy,16,'conf',['#ffd23f','#fff3c4','#ff9a3d'],320,500,.9);snd(1500,.18,'square',.1,600);}
            else{v=0;lab='¡SE ROMPIÓ!';}}
          pts[p]+=v;
          const good=q.gold?bd<=WIN_P:bd<=WIN_G;
          if(good){combo[p]++;if(bd<=WIN_P)perf[p]++;else perf[p]=0;
            if(combo[p]%8===0){pts[p]+=10;say('¡TRANCADO! +10',MX+70,cy-48,'#5cff7a');spawn(MX,cy,8,'conf',['#5cff7a','#fff'],260,500,.8);}}
          else{combo[p]=0;perf[p]=0;if(v<=3)mood[p]=.5;}
          if(perf[p]>0&&perf[p]%3===0){dogJ=1;dogSay=1;}
          say(lab,MX+(v>=10?44:34),cy-30,v>=10?'#ffd23f':v>=6?'#fff':'#c9c0b0');
          spawn(MX,cy+4,v>=10?7:4,'bit',['#ffffff','#ffe14d','#d8d2c4'],200,500,.45);
          shake=Math.max(shake,bd<=WIN_P?.45:.2);
          snd(v>=10?420:300,.06,'square',.07,-150);nz(.05,.22);
        }
        g.scores[p]=pts[p];
      }
      shake=Math.max(0,shake-dt*3);bnc=Math.max(0,bnc-dt*3);dogJ=Math.max(0,dogJ-dt*1.6);dogSay=Math.max(0,dogSay-dt*2);banT=Math.max(0,banT-dt);
      for(let p=0;p<n;p++)tr[p]=Math.max(0,tr[p]-dt);
      if(dogSay>.9)say('¡GUAU!',L+90,470,'#ffe14d');
      t+=dt;
      if(t>=LAST+.8){g.fin=true;}
    },
    finish(){g.fin=true;},
    ai(p,dt,api){
      const sk=c.skill[p],sg=.03+(1-sk)*.12;
      while(aiI[p]<N&&notes[aiI[p]].t-t<.6){const q=notes[aiI[p]++];
        if(rng.next()<.12*(1-sk))continue;
        const e=(rng.next()+rng.next()+rng.next()-1.5)*2*sg*(q.dark?2:1);plan[p].push(q.t+e);}
      for(let i=plan[p].length-1;i>=0;i--)if(plan[p][i]<=t){plan[p].splice(i,1);api.press('a');}
    },
    draw(){
      const sx=Math.sin(t*95)*shake*3.5,sy=Math.cos(t*83)*shake*3.5,beatP=Math.max(0,1-(t-lastBeatT)/.18);
      /* fondo: tarde bajo el mango */
      rr(L,0,R-L,c.campoAbajo,0,'#31294d',0);rr(L,c.campoAbajo-80,R-L,80,0,'#5c4a35',0);
      /* copas del mango y mangos colgados */
      ell(L+110,66,130,36,'#3f8a4a',0);ell(L+300,60,110,30,'#4a9a54',0);ell(R-120,66,150,38,'#3f8a4a',0);ell(R-330,62,120,30,'#4a9a54',0);
      for(const mx of [L+60,L+190,L+340,R-80,R-230,R-380]){line([[mx,80],[mx,90]],2,'#14101c');ell(mx,98,8,11,'#ffb02e',2.5);ell(mx-2,95,3,4,'#ffe08a',0);}
      /* la mesa de plástico (rebota más con cada golpe) */
      const amp=1.5+Math.min(5,slams/12),by=Math.sin(t*60)*bnc*amp+sy;
      ctx.save();ctx.translate(sx,by);
      rr(L+8,TOP-8,R-L-16,LH*n+(Y0-TOP)*2+16,18,'#ece6d6',3.5);
      for(let p=0;p<n;p++){
        const y=Y0+p*LH,cy=y+LH/2,team=c.equipos[p],tc=c.modo==='ffa'?c.col[p]:TCOL[team];
        rr(L+16,y+3,R-L-32,LH-6,12,p%2?'#2c6a4c':'#2f7452',3);
        rr(L+16,y+3,10,LH-6,4,tc,2.5);
        /* abuelo y marcador */
        const fc=FACES[FI[p%4]];
        bust(Object.assign({},fc,{x:L+70,y:cy+24,s:.34,th:24,bw:50,look:1,shirt:c.col[p],mood:mood[p]>0?'yell':(perf[p]>=2?'grin':fc.mood==='sleep'?'calm':fc.mood),talk:mood[p]>0?1:0}));
        txt('P'+(p+1)+(c.cpu[p]?' CPU':''),L+138,cy-16,15,c.col[p],0,true);
        txt(String(Math.round(pts[p])),L+138,cy+8,26,'#fff',0,true);
        if(combo[p]>=3)txt('x'+combo[p],L+138,cy+30,13,'#ffd23f',0,true);
        /* fichas */
        const dA=darkA();
        for(let i=0;i<N;i++){const q=notes[i];
          if(st[p][i]===1){const a=t-hitT[p][i];if(a<.3){ctx.save();ctx.globalAlpha=1-a/.3;ficha(MX,cy+3,FW*1.12,q.a,q.b,3,q.gold);ctx.restore();}continue;}
          if(st[p][i]===2&&t-q.t>.5)continue;
          const x=MX+(q.t-t)*SPD;if(x>R-40||x<MX-100)continue;
          const al=Math.min(1,(R-30-x)/70)*(x<MX-30?Math.max(0,(x-(MX-100))/70):1);
          if(q.dark&&st[p][i]===0)continue;
          ctx.save();ctx.globalAlpha=Math.max(0,al)*(st[p][i]===2?.5:1);ficha(x,cy,FW,q.a,q.b,3.5,q.gold);ctx.restore();}
        if(dA>0){ctx.save();ctx.globalAlpha=dA*.9;rr(L+30,y+4,R-L-60,LH-8,10,'#0a0818',0);ctx.restore();
          const pe=Math.max(beatP,0);ell(MX,cy,5+pe*10,5+pe*10,'#ff7a2a',0);ell(MX,cy,2.5,2.5,'#ffe08a',0);}
        /* la raya */
        ctx.save();ctx.globalAlpha=1;rr(MX-3,y+5,6,LH-10,3,'#ffd23f',2);ctx.restore();
        /* la mano que pega */
        const hy=cy-34+ph[p]*26;
        hand(MX+4,hy-6,Math.PI,.9,fc.skin||'#e8b48a');
      }
      ctx.restore();
      /* marcador de equipos arriba */
      if(c.modo!=='ffa'){
        const sum=[0,0],cnt=[0,0];for(let p=0;p<n;p++){sum[c.equipos[p]]+=pts[p];cnt[c.equipos[p]]++;}
        const lbl=TNAME[c.modo],v=c.modo==='1v3'?[sum[0],cnt[1]?sum[1]/cnt[1]:0]:sum;
        txt(lbl[0]+' '+Math.round(v[0]),W/2-130,80,18,TCOL[0],0,true);
        txt(lbl[1]+' '+Math.round(v[1])+(c.modo==='1v3'?' (media)':''),W/2+130,80,18,TCOL[1],0,true);
        txt('·',W/2,80,18,'#fff',0,true);
      }else txt('♪  CADA QUIEN A SU COMPÁS  ♪',W/2,80,16,'#fff',0,true);
      /* franja de abajo: consigna, aviso o perro dormilón */
      const dy=-Math.sin((1-dogJ)*Math.PI)*(dogJ>0?34:0);
      ell(L+66,498,36,6,'rgba(0,0,0,.25)',0);
      ell(L+60,486+dy,30,13,'#b98a5a',3);ell(L+90,480+dy,13,11,'#c99a6a',3);ell(L+98,474+dy,5,9,'#8a5a32',2.5);
      if(dogJ>0){ell(L+92,478+dy,2,2,'#14101c',0);ell(L+104,478+dy,2,2,'#14101c',0);}
      else{line([[L+88,479],[L+95,479]],2,'#14101c');txt('z',L+112,468,14,'#cfe2ff',0,true);}
      if(t<4)txt('TOCA CUANDO LA FICHA LLEGUE A LA RAYA',W/2,484,22,'#fff',0,true);
      else if(banT>0&&ban){const pu=1+Math.sin(t*16)*.06;txt(ban.s,W/2,484,24*pu,ban.col,0,true);}
      drawP();
    }};
  return g;
}});
})();
