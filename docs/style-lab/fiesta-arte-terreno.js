// LA FIESTA · arte del mapa: capa «terreno» (orden 20). Toda la tierra con color y textura por bioma, transiciones con dithering,
// playas, acantilados y contorno de costa. Luz desde arriba-izquierda. Ronda 2: selva con 4 tonos, copas, claros y riberas oscuras;
// llanos con parches de bordes definidos y lagunas; desierto con dunas en media luna; y todo mucho más barato (campos a rejilla de 4 px).
(function(root){'use strict';const F=root.FIESTA=root.FIESTA||{};
if(typeof module!=='undefined'&&typeof require!=='undefined'&&!F.arte)require('./fiesta-mapa-arte.js');
F.arte.capa('terreno',20,function(A){
  const W=A.W,H=A.H,P=A.PAL,B=A.BIO,rgb=A.rgb,mz=A.mezcla,hash=A.hash,campo=A.campo;
  const tierra=A.tierra,extra=A.extra,dist=A.dist,bioma=A.bioma,oc=A.ocupado,buf=A.buf;
  // mezcla rápida de colores empaquetados
  function bl(a,b,k){if(k<=0)return a;if(k>=1)return b;
    const r=(a&255)+((b&255)-(a&255))*k,g=((a>>8)&255)+(((b>>8)&255)-((a>>8)&255))*k,l=((a>>16)&255)+(((b>>16)&255)-((a>>16)&255))*k;
    return((255<<24)|((l|0)<<16)|((g|0)<<8)|(r|0))>>>0;}
  const R=function(a){return a.map(function(c){return rgb(c);});};
  const rDes=R([mz(P.dunaSombra,'#7e4a22',.25),P.dunaSombra,P.duna,P.desierto,mz(P.desierto,P.arena,.55),A.aclara(P.arena,.22)]);
  const rLla=R([P.pastoOscuro,P.pastoSombra,P.pasto,P.pastoClaro,A.aclara(P.pastoClaro,.25)]);
  const rSab=R(['#6a8c22','#94ae2e','#b6c63a','#cdd654','#e0e682']);
  const rSel=R([mz(P.selvaOscura,'#07200c',.5),P.selvaOscura,P.selvaMedia,P.selva,P.selvaLuz,A.aclara(P.selvaLuz,.2)]);
  const rAnd=R(['#3e4252',P.pizarraSombra,'#6e685c',P.pizarra,'#8f8472','#a9a496']);
  const rPin=R([mz(P.pino,'#06180c',.4),P.pino,'#276c36','#30853f','#4aa050']);
  const rMan=R([mz(P.selvaOscura,P.manglarOscuro,.35),mz(P.manglar,P.selvaOscura,.4),P.manglar,mz(P.manglar,P.selvaLuz,.4),mz(P.selvaMedia,'#7a8a40',.3)]);
  const rChar=R([P.manglarOscuro,mz(P.manglarAgua,P.manglarOscuro,.5),P.manglarAgua,P.manglarClaro,A.aclara(P.manglarClaro,.4)]);
  const rCos=R([P.selvaMedia,P.selva,P.selvaLuz,mz(P.selvaLuz,P.pastoClaro,.4),mz(P.pasto,P.selvaLuz,.3)]);
  const rAcan=R([P.acantiladoSombra,P.acantilado,P.acantiladoLuz,A.aclara(P.acantiladoLuz,.25)]);
  const rPlaya=R([P.arenaSombra,mz(P.arenaSombra,P.arena,.5),P.arena,A.aclara(P.arena,.14),A.aclara(P.arena,.28)]);
  const cRoca=rgb('#a8583a'),cRocaS=rgb('#6e3626'),cRocaL=rgb('#c47a52'),cTierra=rgb('#a88c4e'),cTierraS=rgb('#80683a'),cTierraL=rgb('#c0a460'),cPath=rgb('#ecdca0'),cPathS=rgb('#a88e54'),cOcre=rgb('#c8b45a'),cRocaD=rgb('#4e2418'),cRocaH=rgb('#e09a6a'),
    cContorno=rgb(P.contorno),cMud=rgb('#4a3a55'),cMudClaro=rgb('#7a6a78'),gris=rgb('#7f8f86'),
    cAgua=rgb(mz(P.rio,P.marMedio,.35)),cAguaL=rgb(P.rioClaro),cAguaS=rgb(mz(P.rio,P.marProfundo,.45)),
    cArenaClaro=rgb(mz(P.arena,P.pastoClaro,.25)),cArenaSel=rgb(mz(P.arenaSombra,P.selvaMedia,.4));
  const lagoA=rgb(P.lago),lagoB=rgb(mz(P.lago,P.marMedio,.3)),lagoC=rgb(mz(P.lago,P.marProfundo,.3));
  const cTurq=rgb(P.turquesa),cEsp=rgb(P.espuma),cTurqL=rgb(mz(P.turquesa,P.espuma,.45));
  // campos de ruido en rejilla de 4 px (baratos)
  // rejillas propias con muestreo bilineal por enteros; cada muestra deja su gradiente por píxel en gx/gy
  function rej(freq,seed,oct,sft){const p=1<<sft,gw=(W>>sft)+3,gh=(H>>sft)+3,g=new Float32Array(gw*gh);
    for(let j=0;j<gh;j++)for(let i=0;i<gw;i++)g[j*gw+i]=A.fbm(i*p/freq,j*p/freq,seed,oct);
    const m=p-1,ip=1/p;
    const f=function(x,y){const o=(y>>sft)*gw+(x>>sft),tx=(x&m)*ip,ty=(y&m)*ip,a=g[o],b=g[o+1],c=g[o+gw],d=g[o+gw+1];
      f.gx=((b-a)*(1-ty)+(d-c)*ty)*ip;f.gy=((c-a)*(1-tx)+(d-b)*tx)*ip;
      return a+(b-a)*tx+(c-a)*ty+(a-b-c+d)*tx*ty;};
    f.gx=0;f.gy=0;return f;}
  const nA=rej(120,201,3,3),nB=rej(36,202,2,2),nC=rej(14,206,2,2),nD=rej(70,207,2,3),nE=rej(34,209,2,3),nP=rej(26,208,2,2);
  const cl=function(v,a,b){return v<a?a:v>b?b:v;};

  // ── silueta: bahías, golfos, entrantes del delta y islotes (modifican la máscara antes de pintar; las casillas quedan protegidas) ──
  const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5],bay=function(x,y){return(BAYER[(y&3)*4+(x&3)]+.5)/16;};
  const tOld=tierra.slice(),dOld=dist.slice(),prot=new Uint8Array(W*H);
  A.nodos.forEach(function(n){const r=36,y0=Math.max(0,(n.y-r)|0),y1=Math.min(H-1,(n.y+r)|0),x0=Math.max(0,(n.x-r)|0),x1=Math.min(W-1,(n.x+r)|0);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if((x-n.x)*(x-n.x)+(y-n.y)*(y-n.y)<=r*r)prot[y*W+x]=1;});
  function cut(cx,cy,rx,ry,rot){cx*=2;cy*=1.5;rx*=2;ry*=1.5;const R=Math.max(rx,ry)*1.5,co=Math.cos(rot||0),si=Math.sin(rot||0);
    for(let y=Math.max(1,(cy-R)|0);y<Math.min(H-1,cy+R);y++)for(let x=Math.max(1,(cx-R)|0);x<Math.min(W-1,cx+R);x++){
      const i=y*W+x;if(tierra[i]!==1||prot[i])continue;
      const dx=x-cx,dy=y-cy,u=(dx*co+dy*si)/rx,v=(-dx*si+dy*co)/ry,w=1+(nC(x,y)-.5)*.5+(nB(x,y)-.5)*.35;
      if(u*u+v*v<w*w){tierra[i]=0;A.extra[i]=0;}}}
  function canal(x0,y0,x1,y1,r,ph){x0*=2;y0*=1.5;x1*=2;y1*=1.5;const L=Math.hypot(x1-x0,y1-y0),n=Math.ceil(L/2);
    for(let k=0;k<=n;k++){const t=k/n,wob=Math.sin(t*9+ph)*7+Math.sin(t*23+ph*2)*2.5,cx=x0+(x1-x0)*t,cy=y0+(y1-y0)*t+wob,rr=r*(1.25-.7*t);
      for(let y=(cy-rr)|0;y<=cy+rr;y++)for(let x=(cx-rr)|0;x<=cx+rr;x++){if(x<1||y<1||x>=W-1||y>=H-1)continue;const i=y*W+x;
        if(tierra[i]===1&&!prot[i]&&(x-cx)*(x-cx)+(y-cy)*(y-cy)<=rr*rr){tierra[i]=0;A.extra[i]=0;}}}}
  const regDe=function(x,y){let b=1e18,r=0;A.nodos.forEach(function(n){const d=(n.x-x)*(n.x-x)+(n.y-y)*(n.y-y);if(d<b){b=d;r=A.regiones.indexOf(n.r)+1;}});return r;};
  function isla(cx,cy,rx,ry,bio){cx*=2;cy*=1.5;rx*=2;ry*=1.5;const reg=regDe(cx,cy);
    for(let y=(cy-ry*1.4)|0;y<=cy+ry*1.4;y++)for(let x=(cx-rx*1.4)|0;x<=cx+rx*1.4;x++){if(x<2||y<2||x>=W-2||y>=H-2)continue;const i=y*W+x;
      if(tierra[i]!==0)continue;const u=(x-cx)/rx,v=(y-cy)/ry,w=1+(nC(x,y)-.5)*.6;
      if(u*u+v*v<w*w){tierra[i]=1;A.bioma[i]=bio;A.reg[i]=reg;}}}
  // Golfo de Venezuela y la península de Paraguaná con su istmo; bahías de Falcón, Morrocoy y Barlovento; golfos de Cariaco y Paria
  cut(207,150,30,16,.15);cut(238,86,12,24,0);cut(332,176,30,19,0);cut(426,153,20,13,0);cut(512,150,14,9,0);
  cut(690,176,54,28,0);cut(768,168,16,11,0);cut(842,172,30,19,0);cut(956,234,26,22,.3);
  // este: delta en abanico con caños y estuario del Orinoco
  cut(1012,318,44,34,0);cut(1010,402,40,22,0);cut(1018,478,58,34,0);cut(1014,560,40,26,0);cut(1006,640,30,30,0);
  canal(1000,272,892,296,3.4,0);canal(1000,292,905,320,3.4,1.7);canal(1000,318,880,330,4,3.1);canal(1000,342,900,356,3.4,4.4);canal(1000,372,920,380,3,5.2);
  canal(1000,262,930,262,2.6,2.2);
  // islotes rocosos (Mochima) y de manglar (delta)
  [[650,187,7,5,6],[672,196,6,4,6],[712,190,8,5,6],[738,186,5,4,6],[770,196,6,4,6],[806,184,5,3.5,6],[858,190,7,5,6],[324,186,5,4,6],[420,166,5,3.5,6],[196,155,5,3.5,0]].forEach(function(t){isla(t[0],t[1],t[2],t[3],t[4]||6);});
  [[975,300,7,6],[958,324,8,5],[985,346,6,5],[968,372,8,5],[990,392,5,4],[948,288,6,4],[996,420,5,4],[975,460,7,5],[990,500,6,4]].forEach(function(t){isla(t[0],t[1],t[2],t[3],B.manglar);});
  // distancia con signo a la costa (chamfer 3-4), como el núcleo
  (function(){const INF=30000;
    const pasa=function(sel){const g=new Int16Array(W*H);for(let i=0;i<W*H;i++)g[i]=sel(tierra[i])?0:INF;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;let v=g[i];if(!v)continue;
        if(x>0&&g[i-1]+3<v)v=g[i-1]+3;if(y>0){if(g[i-W]+3<v)v=g[i-W]+3;if(x>0&&g[i-W-1]+4<v)v=g[i-W-1]+4;if(x<W-1&&g[i-W+1]+4<v)v=g[i-W+1]+4;}g[i]=v;}
      for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const i=y*W+x;let v=g[i];if(!v)continue;
        if(x<W-1&&g[i+1]+3<v)v=g[i+1]+3;if(y<H-1){if(g[i+W]+3<v)v=g[i+W]+3;if(x<W-1&&g[i+W+1]+4<v)v=g[i+W+1]+4;if(x>0&&g[i+W-1]+4<v)v=g[i+W-1]+4;}g[i]=v;}
      return g;};
    const aMar=pasa(function(t){return t===0;}),aTierra=pasa(function(t){return t!==0;});
    for(let i=0;i<W*H;i++)dist[i]=tierra[i]===0?-Math.min(aTierra[i],32000):Math.min(aMar[i],32000);})();
  // repinta el mar donde cambió (misma escala que la capa mar; en el delta el agua es morada)
  (function(){
    const TON=[mz(P.turquesa,P.espuma,.38),P.turquesa,mz(P.turquesa,P.somero,.5),P.somero,mz(P.somero,P.marMedio,.5),P.marMedio,P.mar,
      mz(P.mar,P.marProfundo,.55),P.marProfundo,A.sombrea(P.marProfundo,.28)].map(rgb),TH=[0,4,9,17,31,54,90,150,260];
    const cn=A.campo(150,501,3,8),cw=A.campo(34,502,2,4),esp=rgb(P.espuma),ecl=rgb(mz(P.somero,P.espuma,.35));
    const pm=[rgb(mz(P.manglarAgua,P.marMedio,.25)),rgb(P.manglarAgua),rgb(mz(P.manglarAgua,P.manglarClaro,.5)),rgb(P.manglarClaro)],pesp=rgb(mz(P.manglarClaro,P.espuma,.5));
    for(let y=0;y<H;y++){const gy=y/1.5,top=cl((90-y)/90,0,1)*.9;
      for(let x=0;x<W;x++){const i=y*W+x;if(tierra[i]!==0||dist[i]===dOld[i])continue;
        const dd=-dist[i]/3,gx=x/2;
        if(gx>770&&gy>225&&gy<470&&dd<12){ // agua morada del delta
          const k=dd<2.2?3:dd<5?(bay(x,y)<.5?2:1):dd<12?1:0;let c=pm[Math.min(3,k+(cw(x,y)>.62&&bay(x,y)<.3?1:0))];
          if(dd<1.6+cw(x,y))c=pesp;buf[i]=c;continue;}
        let m=(gx>770&&gy>225&&gy<470?2.2:1.2)+.3*cn(x,y);if(gy<215&&gx>370)m*=1.55;
        let s=8,dn=dd/m;for(let k=1;k<9;k++)if(dn<TH[k]){s=k-1+(dn-TH[k-1])/(TH[k]-TH[k-1]);break;}
        s+=top;const fi=Math.floor(s),f=cl((s-fi-.5)*3+.5,0,1);let idx=fi+(f>bay(x,y)?1:0);if(idx>9)idx=9;
        let c=TON[idx];
        if(dd<=5.5){const ft=1.1+2.1*cw(x,y);if(dd<=ft)c=esp;else if(dd<=ft+1.1&&bay(x,y)<.55)c=esp;else if(dd>ft+3.2&&dd<ft+4.3&&bay(x,y)<.4)c=ecl;}
        buf[i]=c;}}
  })();
  // el delta se ensancha ~100 u hacia el interior y los Llanos ya no acaban en una línea recta
  (function(){const nD=rej(60,231,2,3),nE=rej(40,232,2,3),ex0=A.BIO.sabana;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(tierra[i]!==1||A.extra[i])continue;
      const gx=x/2,gy=y/1.5,w=(nD(x,y)-.5)*70,w2=(nE(x,y)-.5)*50;
      const u=(gx+w-945)/135,v=(gy+w2-345)/100;
      if(u*u+v*v<1&&bioma[i]!==B.andes)bioma[i]=B.manglar;
      else if(gx>180&&gx<830&&gy>430&&gy<620&&(bioma[i]===B.llano||bioma[i]===B.selva)){
        const yb=520+w*1.3+(nE(x+300,y)-.5)*60-(gx>600?(gx-600)*.14:0);
        bioma[i]=gy>yb?B.selva:B.llano;}}})();

  // pie de monte andino del oeste (zona extra): deja de ser «andes» gris y pasa a selva con manchas de pino; después se deforma la
  // frontera de TODOS los biomas con ruido para que ninguna máscara acabe en recta (la capa relieve lee A.bioma y hereda el borde)
  const pie=new Uint8Array(W*H);
  (function(){
    for(let i=0;i<W*H;i++)if(tierra[i]===1&&extra[i]&&bioma[i]===B.andes){pie[i]=1;bioma[i]=B.selva;}
    const w1=rej(44,241,2,3),w2=rej(44,242,2,3),w3=rej(9,243,1,2),w4=rej(9,244,1,2),bz=bioma.slice(),R=32;
    for(let y=R;y<H-R;y++)for(let x=R;x<W-R;x++){const i=y*W+x;if(tierra[i]!==1)continue;
      const b=bioma[i];if(bioma[i-R]===b&&bioma[i+R]===b&&bioma[i-R*W]===b&&bioma[i+R*W]===b)continue;
      const dx=((w1(x,y)-.5)*64+(w3(x,y)-.5)*14)|0,dy=((w2(x,y)-.5)*64+(w4(x,y)-.5)*14)|0,j=(y+dy)*W+x+dx;
      if(tierra[j]===1&&bioma[j]!==B.mar&&bioma[j]!==0){bz[i]=bioma[j];if(pie[j])pie[i]=1;else if(!extra[j])pie[i]=0;}}
    bioma.set(bz);})();

  // ── riberas: máscara de proximidad a ríos grandes y tepuyes (oscurece la selva junto al agua) ──
  const rib=new Uint8Array(W*H),nRb=rej(18,251,2,2);
  function estampa(cx,cy,r){const R=r*1.3,x0=Math.max(0,(cx-R)|0),x1=Math.min(W-1,(cx+R)|0),y0=Math.max(0,(cy-R)|0),y1=Math.min(H-1,(cy+R)|0);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const d=Math.sqrt((x-cx)*(x-cx)+(y-cy)*(y-cy));const rr=r*(.72+.56*nRb(x,y));if(d<rr){const v=((1-d/rr)*255)|0;if(v>rib[y*W+x])rib[y*W+x]=v;}}}
  function rio(pts,r){for(let s=0;s<pts.length-1;s++){const ax=A.dx(pts[s][0]),ay=A.dy(pts[s][1]),bx=A.dx(pts[s+1][0]),by=A.dy(pts[s+1][1]);
    const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/3));for(let k=0;k<=n;k++)estampa(ax+(bx-ax)*k/n,ay+(by-ay)*k/n,r);}}
  rio([[560,960],[520,800],[470,620],[480,520],[560,440],[640,420],[700,405],[790,390],[860,360],[920,330],[970,300]],20);
  rio([[190,505],[320,490],[430,470],[520,455]],8);
  rio([[735,630],[720,560],[720,470],[790,395]],17);
  [[735,630,34],[950,700,38],[730,580,24],[880,600,26],[820,650,26]].forEach(function(t){estampa(A.dx(t[0]),A.dy(t[1]),t[2]*1.7);});

  // copas (celdas de 7 px) y matas (celdas de 8 px): parámetros precalculados una vez por celda
  const CW=(W/7|0)+2,CH=(H/7|0)+2,cOx=new Float32Array(CW*CH),cOy=new Float32Array(CW*CH);
  for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){cOx[j*CW+i]=i*7+3.5+(hash(i,j,11)-.5)*3;cOy[j*CW+i]=j*7+3.5+(hash(i,j,12)-.5)*3;}
  const TW=(W>>3)+2,tuf=new Uint8Array(TW*((H>>3)+2));
  for(let j=0;j<(H>>3)+2;j++)for(let i=0;i<TW;i++)tuf[j*TW+i]=hash(i,j,3)<.14?1:0;
  // dunas en media luna: celdas de 40×24 px con un barján cada una
  const DW=104,DH=52;
  function duna(x,y,base){
    const row=(y/DH)|0,xo=(row&1)?DW/2:0,cx=((x+xo)/DW)|0,h=hash(cx,row,5);
    if(h<.18)return base;
    const ccx=cx*DW-xo+DW*(.5+(hash(cx,row,6)-.5)*.22),ccy=row*DH+DH*(.5+(hash(cx,row,7)-.5)*.2);
    const a=DW*.36*(.75+h*.5),b=DH*.32*(.75+h*.5),u=x-ccx,v=y-ccy;
    const e=(u*u)/(a*a)+(v*v)/(b*b);
    const u2=u-a*.5,v2=v-b*.6,e2=(u2*u2)/(a*a*.62)+(v2*v2)/(b*b*.55);
    const ue=u-6,ve=v-5,es=(ue*ue)/(a*a)+(ve*ve)/(b*b);
    // barján: cara de barlovento clara con cresta, cuña de sombra abajo-derecha y sombra proyectada
    const ua=u+.2*a,va=v+.3*b,el=(ua*ua)/(a*a*.9)+(va*va)/(b*b*.62);
    if(e<1){
      if(el>=1)return rDes[1];
      const uc=ua-2.4,vc=va-2.4;if((uc*uc)/(a*a*.9)+(vc*vc)/(b*b*.62)>1)return rDes[5];
      return h>.6?rDes[4]:rDes[3];}
    if(es<1)return rDes[2];
    return base;}

  // parcelas de cultivo junto a los pueblos de llano/sabana (2 tonos con surcos y borde oscuro), rasterizadas una vez
  const parc=new Uint8Array(W*H),nT=rej(52,261,2,3),nT2=rej(20,262,2,2);
  A.nodos.forEach(function(n,ni){
    for(let k=0;k<2;k++){if(hash(ni,k,76)<.45)continue;const ang=hash(ni,k,71)*6.283,dd=62+hash(ni,k,72)*52,cx=(n.x+Math.cos(ang)*dd)|0,cy=(n.y+Math.sin(ang)*dd*.75)|0;
      if(cx<30||cy<30||cx>W-30||cy>H-30)continue;
      const ci=cy*W+cx;if(tierra[ci]!==1||extra[ci]||dist[ci]<60||(bioma[ci]!==B.llano&&bioma[ci]!==B.sabana))continue;
      const pw=2+((hash(ni,k,73)*2)|0),ph=2,tono=hash(ni,k,75)<.5?1:2;
      for(let a=0;a<pw;a++)for(let b=0;b<ph;b++){const x0=cx+a*14,y0=cy+b*10,t2=((a+b+tono)&1)?1:2;
        for(let y=y0;y<y0+9;y++)for(let x=x0;x<x0+13;x++){const i=y*W+x;if(i<0||i>=W*H||tierra[i]!==1||oc[i]||rib[i]>40)continue;
          if(bioma[i]!==B.llano&&bioma[i]!==B.sabana)continue;
          parc[i]=(y===y0+8||x===x0+12)?3:(x===x0||y===y0)?4:(((y-y0)&3)<2?t2:t2===1?2:1);}}}});
  const cPa1=rgb('#c9b24a'),cPa2=rgb('#a8a23a'),cPa3=rgb('#7a8a2c'),cPa4=rgb('#dcc864'),cPa5=rgb('#5e7a2a'),cPa6=rgb('#8aa43a');

  // campos suaves a media resolución: se evalúan en x,y pares y se reutilizan en el bloque de 2×2 (4× menos llamadas)
  const HW=(W>>1)+1,cMac=new Float32Array(HW),cMid=new Float32Array(HW),cEmb=new Float32Array(HW),cAg=new Float32Array(HW);
  for(let y=0;y<H;y++){
    if((y&1)===0)for(let xe=0;xe<HW;xe++){const x=xe<<1,i0=y*W+x;
      if(x>=W||(tierra[i0]===0&&(x+1>=W||tierra[i0+1]===0)))continue;
      cMac[xe]=nA(x,y);cAg[xe]=(nA.gx+nA.gy)*2;cMid[xe]=nB(x,y);cEmb[xe]=(nB.gx+nB.gy)*2;}
    for(let x=0;x<W;x++){
      const i=y*W+x,t=tierra[i];
      if(t===0){
        const di=dist[i];
        if(di>-8){const dd=di/3,h=hash(x,y,31);
          if(dd>-1.1)buf[i]=h<.3?bl(buf[i],cEsp,.55):bl(buf[i],cTurq,.5);
          else if(y<340&&dd>-5.5)buf[i]=bl(buf[i],cTurqL,(h<.5?.5:.32)*(1+dd/6.5));
          else buf[i]=bl(buf[i],cTurq,h<.5?.3:.18);}
        continue;}
      if(t===2){const v=nB(x,y);buf[i]=v<.4?lagoC:v>.62?lagoB:lagoA;continue;}
      const ex=extra[i],calma=oc[i]===1;
      let b=bioma[i];
      // transición de bioma con dithering de ~3 px (solo cerca de un borde)
      if(bioma[i-6]!==b||bioma[i+6]!==b||bioma[i-6*W]!==b||bioma[i+6*W]!==b){
        const jx=((hash(x,y,1)-.5)*12)|0,jy=((hash(x,y,2)-.5)*12)|0,xx=cl(x+jx,0,W-1),yy=cl(y+jy,0,H-1),j=yy*W+xx;
        if(bioma[j]!==0&&tierra[j]===1)b=bioma[j];}
      if((b===B.llano||b===B.sabana)&&rib[i]>90+((hash(x>>1,y>>1,4)*70)|0))b=B.selva;
      const xe=x>>1,mac=cMac[xe],mid=cMid[xe],fin=nC(x,y),h1=hash(x,y,7);
      const emb=cEmb[xe],ag=cAg[xe],bg=emb;
      const sh=calma?0:emb>.006?1:emb<-.006?-1:0;
      let col=0;
      if(b===B.desierto){
        const v=mac*.6+mid*.4;
        {const sd=(v-.42)/.16+1,fd=Math.floor(sd),ff=cl((sd-fd-.5)*3+.5,0,1);col=rDes[2+cl(fd+(ff>bay(x,y)?1:0),0,2)];}
        if(!calma){
          col=duna(x,y,col);
          const rk=nE(x,y);if(rk>.715){const g=(nE.gx+nE.gy)*8;col=g>.2?cRocaL:g>.07?cRoca:g>-.07?cRoca:g>-.2?cRocaS:cRocaD;if(g>.2&&g<.3&&h1<.4)col=cRocaH;if(rk<.725)col=cRocaD;else if(g<=-.07&&rk<.74)col=cRocaD;}
          else if(fin<.1&&h1<.5)col=rDes[0];}
      }else if(b===B.llano||b===B.sabana){
        const sab=b===B.sabana&&mid<.8,rp=sab?rSab:rLla;
        // manchas orgánicas de ruido en 3 tonos de pasto: umbrales con dither de ruido (sin cortes rectos) y luz arriba-izquierda
        const v=mac*.34+mid*.36+fin*.3+(nP(x+50,y)-.5)*.1;
        const sv=(v-.40)/.07,fl=Math.floor(sv),ff=cl((sv-fl-.5)*2.2+.5,0,1);
        let kk=cl(fl+(ff>bay(x,y)*.5+h1*.5?1:0),0,3)+1;
        if(!calma&&sh!==0&&ff>.1&&ff<.9)kk=cl(kk+sh,0,4);
        col=rp[kk];
        if(!calma){
          // matas de hierba de 2-3 px (celdas de 6 px), más oscuras con un punto claro arriba
          const cx6=(x/6)|0,cy6=(y/6)|0,hh=hash(cx6,cy6,3);
          if(hh<.2){const lx=x-cx6*6-((hash(cx6,cy6,4)*2)|0),ly=y-cy6*6;
            if((ly===3&&(lx===1||lx===3))||(ly===2&&lx===2))col=rp[cl(kk-1,0,4)];
            else if(ly===1&&lx===2&&hh<.1)col=rp[cl(kk+1,0,4)];
            else if(ly===4&&lx===2&&hh<.06)col=rp[0];}
          // cultivos junto a pueblos
          const pc=parc[i];
          if(pc){col=pc===3?cPa3:pc===4?cPa4:pc===1?cPa1:cPa2;if(pc<3&&(x&3)===0&&((y>>2)&1))col=pc===1?cPa6:cPa5;}
          // ocre sutil en manchas pequeñas
          if(mac>.74&&fin>.62){col=sab?bl(col,cOcre,.55):(sh>0?cTierraL:sh<0?cTierraS:cTierra);}
          // senderos de tierra finos (2 px, arena clara con sombra abajo-derecha); curvas de nivel que serpentean y se bifurcan
          {const vd=nD(x,y),gx=nD.gx,gy=nD.gy,gg=Math.abs(gx)+Math.abs(gy)+1e-5,ad=Math.abs(vd-.5)/gg;
            if(ad<2.1&&nE(x,y)>.27){
              if(ad<.95)col=cPath;
              else if((vd-.5)*(gx+gy)>0&&ad<1.9)col=cPathS;}
            const v2=nT(x,y),g2=Math.abs(nT.gx)+Math.abs(nT.gy)+1e-5,a2=Math.abs(v2-.52)/g2;
            if(a2<2.1&&nT2(x,y)>.3&&!parc[i]){if(a2<1)col=cPath;else if((v2-.52)*(nT.gx+nT.gy)>0&&a2<1.9)col=cPathS;}}
          // esteros: charcas alargadas con orilla de juncos y reflejo del cielo
          if(!sab&&dist[i]>24){const pv=nP(x,y);
            if(pv>.77){
              if(pv>.8){col=cAgua;
                const rf=(x+((nC(x+90,y)*14)|0))&15;
                if((y&3)===0&&rf<6)col=cAguaL;else if((y&3)===2&&rf>9&&rf<13)col=cAguaS;
                if(pv<.815)col=rLla[0]===0?cAguaS:cAguaS;}
              else col=rLla[0];}
            else if(pv>.75&&bay(x,y)<.5)col=rLla[1];}
        }
      }else if(b===B.selva){
        // 4 tonos por fbm de baja frecuencia + copas con luz arriba-izquierda + claros + riberas
        const rb=rib[i]/255;
        let v=mac*.6+mid*.3+fin*.1;
        let k=v<.38?1:v<.47?2:v<.56?3:4;
        // copas: celdas de 7 px
        const ci=((y/7)|0)*CW+((x/7)|0),du=x-cOx[ci],dv=y-cOy[ci],dd=du*du+dv*dv;
        if(dd<9.5){k+=(du+dv<-1.2?1:du+dv>1.4?-1:0);}else k-=1;
        k+=sh;
        // valles oscuros (cauces secos) y riberas
        const rr=Math.abs(mid-.5);
        if(rr<.018)k-=1;
        k-=rb>.2?(rb>.6?2:1):0;
        col=rSel[cl(k,0,5)];
        // pie de monte andino (oeste): manchas de pino con borde marcado, más densas hacia el este
        if(pie[i]){const pm=nA(x+700,y+300)+(x>>1)*0.00012-(fin-.5)*.14;
          if(pm>.44){const pk=cl(k-1+(pm>.62?0:-1),0,4);col=rPin[hash(x>>1,y>>1,9)<.3?cl(pk-1,0,4):pk];if(h1<.07)col=rPin[0];}}
        // claros con pasto o arena, con borde oscuro
        if(!calma&&!pie[i]&&rb<.05&&fin>.8&&mac<.52&&mid>.4){col=fin>.86?(mac<.42?cArenaClaro:rLla[2]):rLla[0];if(fin>.86&&sh>0)col=rLla[3];}
      }else if(b===B.andes){
        const v=mac*.5+mid*.5,k=v<.34?0:v<.44?1:v<.54?2:v<.64?3:v<.76?4:5;
        const pm=nA(x+700,y+300);
        if(pm>.5+(fin-.5)*.2){
          const pk=cl(Math.round((mid-.3)*6)+sh,0,4);
          col=rPin[hash(x>>1,y>>1,9)<.35?cl(pk-1,0,4):pk];
          if(h1<.12)col=rPin[0];
        }else{col=rAnd[cl(k+(calma?0:sh),0,5)];
          if(!calma&&((x+y*2)%7===0)&&fin>.5)col=rAnd[cl(k-1,0,5)];}
      }else if(b===B.manglar){
        const q=mid*.8+mac*.2;
        if(q<.4){
          let k=cl(2+sh+(fin>.7?1:0)+(h1<.04?1:0),0,4);col=rChar[k];
          if(!calma&&sh>0&&(y&1)===0&&h1<.4)col=rChar[4];
        }else if(q<.45){col=rChar[0];}
        else{
          const cx6=(x/6)|0,cy6=(y/6)|0,hh=hash(cx6,cy6,13),du=x-(cx6*6+3),dv=y-(cy6*6+3);
          let k=cl(Math.round(fin*4-.5)+sh+((du*du+dv*dv<7)?(du+dv<0?1:0):-1),0,4);col=rMan[k];
          if(!calma&&hh<.03)col=rChar[1];
        }
      }else{ // costa / urbano / resto
        const v=mac*.5+mid*.5,vu=(mac-ag)*.5+(mid-bg)*.5;
        const dj=(hash(x,y,5)-.5)*.07+(nC(x+9,y)-.5)*.06;let k=v+dj<.42?1:v+dj<.56?2:3;const ku=vu+dj<.42?1:vu+dj<.56?2:3;
        if(!calma){if(ku<k)k++;else if(ku>k)k--;}
        col=rCos[cl(k+(fin>.7?1:0)-(fin<.25?1:0),0,4)];
        if(!calma&&mac>.66&&fin>.5)col=sh>0?cTierraL:sh<0?cTierraS:cTierra;
      }
      // ── costa: playa, acantilado o fango ──
      const d=dist[i]/3;
      if(d<10.5){
        const cn=nC(x+400,y+100);
        const wB=y<340?5.2+3.8*nB(x+400,y+100):3+3*nB(x+400,y+100);
        if(b===B.manglar){
          if(d<4){const f=cl((4-d)/4,0,1)*.5;col=bl(col,h1<.3?cMudClaro:cMud,f);}
        }else if(cn>.66&&d<5.5&&!calma){
          let k=1+sh;
          if(((y+((x/9)|0))&3)===0)k-=1;
          if(d<1.6)k=0;else if(d<2.6&&k>1)k=1;
          if(h1>.93)k+=1;
          col=rAcan[cl(k,0,3)];
        }else if(d<wB&&b!==B.andes||d<wB-1&&b===B.andes){
          const tt=d/wB;let k;
          if(tt<.22)k=0;else if(tt<.4)k=1;else if(tt<.8)k=2+(h1>.75?1:0);else k=3+(h1>.6?1:0);
          if(sh!==0&&tt>.4&&h1>.7)k=cl(k+sh,0,4);
          if(!(tt>.78&&h1<(tt-.78)/.22*.9+.1))col=rPlaya[k];
        }
        if(d<1)col=bl(col,cContorno,.62);
        else if(d<1.7&&cn<=.66)col=bl(col,cContorno,.12);
      }
      buf[i]=col;
    }
  }
  // orilla del lago de Maracaibo: acantilado rojizo facetado (roca en caras con luz arriba-izquierda) y calas de arena
  const bx0=A.dx(80)|0,bx1=A.dx(215)|0,by0=A.dy(180)|0,by1=A.dy(360)|0,BW=bx1-bx0,BH=by1-by0,RC=14;
  const dl=new Uint8Array(BW*BH).fill(99);
  for(let y=0;y<BH;y++)for(let x=0;x<BW;x++)if(tierra[(by0+y)*W+bx0+x]===2)dl[y*BW+x]=0;
  for(let y=0;y<BH;y++)for(let x=0;x<BW;x++){const o=y*BW+x,v=dl[o];if(!v)continue;let m=v;
    if(x>0&&dl[o-1]+1<m)m=dl[o-1]+1;if(y>0){if(dl[o-BW]+1<m)m=dl[o-BW]+1;if(x>0&&dl[o-BW-1]+1<m)m=dl[o-BW-1]+1;if(x<BW-1&&dl[o-BW+1]+1<m)m=dl[o-BW+1]+1;}dl[o]=m;}
  for(let y=BH-1;y>=0;y--)for(let x=BW-1;x>=0;x--){const o=y*BW+x,v=dl[o];if(!v)continue;let m=v;
    if(x<BW-1&&dl[o+1]+1<m)m=dl[o+1]+1;if(y<BH-1){if(dl[o+BW]+1<m)m=dl[o+BW]+1;if(x<BW-1&&dl[o+BW+1]+1<m)m=dl[o+BW+1]+1;if(x>0&&dl[o+BW-1]+1<m)m=dl[o+BW-1]+1;}dl[o]=m;}
  const cRH=rgb('#e09a6a'),cRD=rgb('#4e2418');
  for(let y=by0;y<by1;y++)for(let x=bx0;x<bx1;x++){
    const i=y*W+x;if(tierra[i]!==1||oc[i]===1)continue;
    const m=dl[(y-by0)*BW+x-bx0];if(m>RC)continue;
    const sel=nB(x+400,y+100);
    if(sel>.6){ // cala de arena
      if(m<=1)buf[i]=bl(buf[i],rPlaya[0],.85);
      else if(m<=3)buf[i]=bl(buf[i],rPlaya[2],hash(x,y,41)<.85?.8:.4);
      else if(m<=5&&hash(x,y,41)<.5)buf[i]=bl(buf[i],rPlaya[2],.55);
      continue;}
    const w=RC-3*nC(x,y)-(sel<.25?2:0);if(m>w)continue;
    nB(x,y);const sl=(nB.gx+nB.gy)*2,t=hash(x>>1,y>>1,43);
    let c=sl>.016?cRH:sl>.007?cRocaL:sl>-.007?cRoca:sl>-.016?cRocaS:cRD;
    if(m>w-2&&t<.5)c=bl(buf[i],c,.55); // borde roto hacia la tierra
    else if(m<=1)c=cRD;
    else if(m===2&&sl<=.007)c=cRocaS;
    buf[i]=c;}
});
})(typeof window!=='undefined'?window:globalThis);
