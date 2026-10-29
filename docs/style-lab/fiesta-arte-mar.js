// LA FIESTA · arte del mapa: capas «mar» (orden 10: agua, bajíos, olas, espuma) y «mar-hitos» (orden 60: Margarita, Coche, Los Roques,
// islotes de Mochima, faro de Paraguaná, barcos y brillos animados). Pixel art procedural determinista (sin Math.random).
(function(root){'use strict';const F=root.FIESTA=root.FIESTA||{};
if(typeof module!=='undefined'&&typeof require!=='undefined'&&!F.arte)require('./fiesta-mapa-arte.js');
const AR=F.arte;if(!AR)return;
const cl=(v,a,b)=>v<a?a:v>b?b:v;
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const bay=(x,y)=>(BAYER[(y&3)*4+(x&3)]+.5)/16;

/* ─────────── MAR (orden 10) ─────────── */
AR.capa('mar',10,function(A){
  const P=A.PAL,W=A.W,H=A.H,buf=A.buf,dist=A.dist,tierra=A.tierra,M=A.mezcla;
  // 6 tonos = 5 pasos suaves, un solo dither Bayer fino de banda completa (sin curvas de nivel duras)
  const TON=[M(P.turquesa,P.espuma,.38),P.turquesa,P.somero,P.marMedio,P.mar,M(P.mar,P.marProfundo,.7)].map(A.rgb);
  const TH=[0,6,17,38,85,185];
  const cn=A.campo(170,501,3,8),cw=A.campo(34,502,2,4),cb=A.campo(70,503,2,8),cr=A.campo(24,504,2,4);
  const sm=t=>{t=t<0?0:t>1?1:t;return t*t*(3-2*t);};
  const ISL=AR.ISLAS.map(i=>({x:i[0]*2,y:i[1]*1.5,rx:i[2]*2,ry:i[3]*1.5,ex:i[2]*2*1.9+30,ey:i[3]*1.5*1.9+30}));
  const base=A.rgb(P.desierto),lago=A.rgb(P.lago),espuma=A.rgb(P.espuma),eclaro=A.rgb(M(P.somero,P.espuma,.35));
  const rifN=A.rgb(A.sombrea(M(P.turquesa,P.mar,.25),.1)),rifC=A.rgb(M(P.turquesa,P.espuma,.55));
  const sw=[1.1,1.1,1.9];                                                          // fuerza del bajío de cada isla
  for(let y=0;y<H;y++){
    const top=sm((110-y)/110)*.75,cyn=(y-750)/750,gy=y/1.5,rampY=sm((250-gy)/60);
    for(let x=0;x<W;x++){
      const i=y*W+x,t=tierra[i],dd=dist[i]/3;
      if(t===2){buf[i]=lago;continue;}
      if(t===1&&dd>2){buf[i]=base;continue;}
      const dm=t===1?0:-dd;
      let m=.9+.26*cn(x,y);
      const gx=x/2,qx=(gx-215)/150,qy=(gy-120)/95,q=1-(qx*qx+qy*qy);          // golfo de Venezuela: bajío amplio
      if(q>0)m*=1+1.2*q;
      if(rampY>0)m*=1+2.5*rampY*sm((gx-300)/140)*(.8+.4*cb(x,y));                // costa central y oriental: bajíos de 40-60 px
      for(let k=0;k<3;k++){const o=ISL[k],u=(x-o.x)/o.ex,v=(y-o.y)/o.ey,r=u*u+v*v;if(r<1)m*=1+sm(1-r)*sw[k]*2.1;}
      const cxn=(x-1000)/1000,rr=cxn*cxn+cyn*cyn,corner=sm((rr-.85)/1.1)*1.5;
      let s=5,dn=dm/m;
      for(let k=1;k<6;k++)if(dn<TH[k]){s=k-1+(dn-TH[k-1])/(TH[k]-TH[k-1]);break;}
      s+=corner+top;
      const fi=Math.floor(s),ff=cl((s-fi-.5)*2.6+.5,0,1);let idx=fi+(ff>bay(x,y)?1:0);if(idx>5)idx=5;
      let c=TON[idx];
      if(dm<=5.5){                                                               // espuma de orilla
        const wob=cw(x,y),ft=1.1+2.1*wob;
        if(dm<=ft)c=espuma;
        else if(dm<=ft+1.1&&bay(x,y)<.55)c=espuma;
        else if(dm>ft+3.2&&dm<ft+4.3&&cb(x,y)>.52&&bay(x,y)<.5)c=eclaro;
      }else if(dm>8&&dm<46&&dn<30){                                              // arrecifes: formas definidas (sin trama), borde claro de espuma
        const v=cr(x,y);
        if(v>.7){const e=v-.7;c=e<.014?rifC:(e<.05?eclaro:rifN);}
      }
      buf[i]=c;
    }
  }
  // texturas de olas: rayitas claras de 2-4 px agrupadas por ruido
  for(let cy=0;cy<H/6;cy++)for(let cx=0;cx<W/14;cx++){
    const h=A.hash(cx,cy,71);if(h>.4)continue;
    const px0=cx*14+((A.hash(cx,cy,72)*10)|0),py0=cy*6+((A.hash(cx,cy,73)*5)|0);
    if(px0<0||px0+5>=W||py0+1>=H)continue;
    const i0=py0*W+px0,dd=-dist[i0]/3;if(tierra[i0]!==0||dd<6)continue;
    const p=(.1+.26*cl(dd/45,0,1))*(.3+1.5*cw(px0,py0));if(h>p)continue;
    const len=2+((A.hash(cx,cy,74)*3)|0);let ok=true;for(let k=0;k<len+1;k++)if(tierra[i0+k]!==0||tierra[i0+k+W]!==0){ok=false;break;}
    if(!ok)continue;
    for(let k=0;k<len;k++){A.pxa(px0+k,py0,P.espuma,.3);A.pxa(px0+k+1,py0+1,A.sombrea(P.mar,.1),.22);}
  }
});

/* ─────────── HITOS DEL MAR (orden 60) ─────────── */
const PAL2={arenaClara:'#f6e8b4',trunco:'#8a5a2a',truncoSombra:'#5e3a1a'};
const PALMA=['..gg.gg...','.gGGgGGg..','gGGgGgGGg.','.GgGBGgG..','..G.gB.G..','.....B....','.....B....','....bB....','....bB....','...bB.....'];
const PALMA_P={g:'#5fc04a',G:'#2d8a2a',B:PAL2.trunco,b:PAL2.truncoSombra};
// sprites de barcos: filas ASCII mirando a la derecha
const BARCO_P={w:'#f4f6fa',g:'#b8c0cc',r:'#d9482e',b:'#2a4a8c',k:'#2a3040',y:'#f0d060',n:'#8a5a2a',d:'#7a2a24',c:'#3a7a5a'};
const BARCOS={
  ferry:['.........rr.............','......wwwwwwwwww........','....wwwbwbwbwbwwww......','..wwwwwwwwwwwwwwwwww....','.wwbwbwbwbwbwbwbwwwwwk..','wwwwwwwwwwwwwwwwwwwwwwwk','.rrrrrrrrrrrrrrrrrrrrrk.','..kkkkkkkkkkkkkkkkkkkk..'],
  velero:['.....k......','.....kw.....','....kwww....','....kwwwg...','...kwwwwgg..','...kwwwwwgg.','..kwwwwwwgg.','..kwwwwwwggg','.kwwwwwwwggg','.kwwwwwwwwgg','kwwwwwwwwwww','............','rrrrrrrrrrrr','.rwwwwwwwwr.','..rrrrrrrr..'],
  carguero:['...........w..................','.....rrbbyyrrcbbyyrr.w.......','.....rrbbyyrrcbbyyrr.k.......','.....rrbbyyrrcbbyyrr.........','wwwwwwwwwwwwwwwwwwwwwwwwwwwk.','kkkkkkkkkkkkkkkkkkkkkkkkkkkkk','.dddddddddddddddddddddddddd..','..kkkkkkkkkkkkkkkkkkkkkkkk...'],
  lancha:['...w....','..www.k.','.wwwwww.','wwwwwwwk','.rrrrrr.']};
const BARCO_PRE={};Object.keys(BARCOS).forEach(k=>{const f=BARCOS[k],o=[];f.forEach((r,j)=>{for(let i=0;i<r.length;i++){const c=BARCO_P[r[i]];if(c&&r[i]!=='.')o.push([i,j,c]);}});
  BARCO_PRE[k]={w:Math.max.apply(null,f.map(r=>r.length)),h:f.length,px:o};});

AR.din.barco=function(c,e,t){
  const L=e.L,ph=(((t*e.v+e.f)%(2*L))+2*L)%(2*L),fw=ph<L,pos=fw?ph:2*L-ph,sp=BARCO_PRE[e.tipo];if(!sp)return;
  const E=e.esc||1,dir=fw?1:-1,ox=Math.round(e.x-L/2+pos-sp.w*E/2),oy=Math.round(e.y-sp.h*E),sw=sp.w*E,sh=sp.h*E;
  for(let k=1;k<=9+4*(E-1);k++){const wx=dir>0?ox-k*1.6*E:ox+sw+k*1.6*E-1;c.fillStyle='rgba(235,251,255,'+(0.8-k*.06/E).toFixed(2)+')';c.fillRect(Math.round(wx),oy+sh-E+(k&1),E,1);
    if(E>1&&k<8){c.fillRect(Math.round(wx),oy+sh+1+(k&1)*2,E-1,1);c.fillRect(Math.round(wx),oy+sh-E-2-(k&1),E-1,1);}}
  c.fillStyle='rgba(10,40,100,.35)';c.fillRect(ox+E,oy+sh,sw-E,E);
  for(let n=0;n<sp.px.length;n++){const p=sp.px[n];c.fillStyle=p[2];c.fillRect(dir>0?ox+p[0]*E:ox+sw-(p[0]+1)*E,oy+p[1]*E,E,E);}
};
AR.din.brillo=function(c,e,t){
  const a=.5+.5*Math.sin(t*2.1+e.f);if(a<.62)return;const al=((a-.62)/.38*.85).toFixed(2);
  c.fillStyle='rgba(255,255,255,'+al+')';c.fillRect(e.x,e.y,1,1);
  if(a>.82){c.fillStyle='rgba(255,255,255,'+(al*.5).toFixed(2)+')';c.fillRect(e.x-1,e.y,1,1);c.fillRect(e.x+1,e.y,1,1);c.fillRect(e.x,e.y-1,1,1);c.fillRect(e.x,e.y+1,1,1);}
};
AR.din.faro=function(c,e,t){
  if(((t*1.1)|0)%2)return;
  c.fillStyle='rgba(255,240,150,.85)';c.fillRect(e.x-1,e.y,3,2);
  c.fillStyle='rgba(255,245,190,.5)';c.fillRect(e.x-4,e.y,3,1);c.fillRect(e.x+2,e.y,3,1);c.fillRect(e.x-1,e.y-1,3,1);
};

AR.capa('mar-hitos',60,function(A){
  const P=A.PAL,W=A.W,H=A.H,buf=A.buf,tierra=A.tierra,dist=A.dist,M=A.mezcla,hash=A.hash;
  const cn=A.campo(18,601,3,2),cw=A.campo(30,602,2,2);
  const ISL=AR.ISLAS.map(i=>({x:i[0]*2,y:i[1]*1.5,rx:i[2]*2,ry:i[3]*1.5}));
  const palma=(x,y)=>{x|=0;y|=0;A.spr(PALMA,PALMA_P,x-5,y-9);for(let k=0;k<4;k++)A.pxa(x+k,y+1,P.sombra,.3);};
  const arbol=(x,y,r)=>{A.disc(x+1,y+1,r,A.sombrea(P.selvaOscura,.2));A.disc(x,y,r,P.selvaMedia);A.disc(x-.5,y-.8,r*.62,P.selvaLuz);A.px(x-1,y-1,A.aclara(P.selvaLuz,.3));};
  const casa=(x,y,k)=>{const pared=[P.pared1,P.pared2,P.pared3,P.pared4][k&3];A.rect(x,y,7,3,'#c8402c');A.rect(x,y,7,1,'#e8614a');A.rect(x,y+3,7,3,pared);A.px(x+2,y+4,P.sombra);A.px(x+2,y+5,P.sombra);A.px(x+5,y+4,'#8ec8f0');A.rect(x,y+6,7,1,A.sombrea(pared,.4));A.rect(x+7,y+1,1,6,P.sombra);};
  const ocup=(x,y)=>x<0||y<0||x>=W||y>=H||A.ocupado[(y|0)*W+(x|0)];
  const esMarLejos=(x,y,d)=>{x|=0;y|=0;return x>=0&&y>=0&&x<W&&y<H&&tierra[y*W+x]===0&&-dist[y*W+x]/3>=d;};

  /* — Margarita y Coche (isla desde la máscara: playa, colinas, volcán, bosque, pueblitos) — */
  function isla(k,o){
    const I=ISL[k],bx0=Math.floor(I.x-I.rx-40),bx1=Math.ceil(I.x+I.rx+40),by0=Math.floor(I.y-I.ry-40),by1=Math.ceil(I.y+I.ry+40);
    const picos=o.picos;
    const Hh=(x,y)=>{const d=dist[y*W+x]/3;let h=cl(d/20,0,1)*.45;
      for(let n=0;n<picos.length;n++){const p=picos[n],qx=(x-(I.x+p.dx))/p.rx,qy=(y-(I.y+p.dy))/p.ry,q=Math.sqrt(qx*qx+qy*qy);h+=Math.pow(cl(1-q,0,1),1.25)*p.h;}
      return h+(cn(x,y)-.5)*.14;};
    const cpx=I.x+(picos[0]?picos[0].dx:0),cpy=I.y+(picos[0]?picos[0].dy:0);
    for(let y=Math.max(1,by0);y<Math.min(H-1,by1);y++)for(let x=Math.max(1,bx0);x<Math.min(W-1,bx1);x++){
      const i=y*W+x;if(tierra[i]!==1)continue;
      let best=1e9,bk=-1;for(let n=0;n<2;n++){const J=ISL[n],u=(x-J.x)/J.rx,v=(y-J.y)/J.ry,r=u*u+v*v;if(r<best){best=r;bk=n;}}
      if(bk!==k||best>2.4)continue;
      const dd=dist[i]/3,sur=cl((y-I.y)/I.ry,-1,1),bw=o.playa+2.4*cl(sur,0,1)+1.8*cn(x+400,y)-.6*cl(-sur,0,1);
      let c;
      if(dd<=1.6)c=PAL2.arenaClara;
      else if(dd<=bw)c=(x+y)&1&&dd>bw-1.2?P.arena:(dd<bw-1.5?P.arena:P.arenaSombra);
      else if(dd<=bw+1.2)c=bay(x,y)<.5?P.arenaSombra:P.pastoClaro;
      else{
        const h=Hh(x,y),l=Hh(x-1,y-1)-Hh(x+1,y+1);let sh=l>.008?0:l<-.008?2:1;
        let t=h;
        if(k===0&&t>=.3){const fa=Math.sin(Math.atan2(y-cpy,x-cpx)*7+cn(x,y)*2);if(fa>.45&&sh>0)sh=sh-1+(fa>.8?0:0);else if(fa<-.45&&sh<2)sh=sh+1;}
        if(t<.3)c=[P.pastoSombra,P.pasto,P.pastoClaro][sh];
        else if(t<.8)c=[P.selvaOscura,P.selvaMedia,P.selvaLuz][sh];
        else if(t<1.02)c=[P.rocaSombra,P.roca,'#b99a6c'][sh];
        else c=[P.rocaSombra,'#b99a6c','#d8c090'][sh];
        if(t>=.3&&t<.8&&sh===1&&bay(x,y)<.12)c=P.selva;
        const q=Math.sqrt(((x-cpx)/(picos[0]?picos[0].rx*.2:9))**2+((y-cpy)/(picos[0]?picos[0].ry*.34:5))**2);
        if(o.crater&&q<1)c=q<.62?(((x-cpx)+(y-cpy))>2?'#d8c090':P.rocaSombra):(((x-cpx)+(y-cpy))<0?'#d8c090':P.roca);
      }
      buf[i]=A.rgb(c);
    }
    // contorno oscuro suave en la orilla del mar (1 px de espuma fina ya la pone la capa mar)
    const r=A.rng(k*77+5);
    // árboles y palmeras
    let nt=0,np=0;
    for(let y=by0;y<by1&&nt<o.arboles;y+=2)for(let x=bx0;x<bx1&&nt<o.arboles;x+=2){
      const i=y*W+x;if(x<0||y<0||x>=W||y>=H||tierra[i]!==1||A.ocupado[i])continue;
      const dd=dist[i]/3;let bk=-1,bs=1e9;for(let n=0;n<2;n++){const J=ISL[n],u=(x-J.x)/J.rx,v=(y-J.y)/J.ry,rr=u*u+v*v;if(rr<bs){bs=rr;bk=n;}}
      if(bk!==k||dd<4)continue;
      const h=Hh(x,y);
      if(dd<10&&h<.5&&hash(x,y,5)<.22&&np<o.palmas){palma(x+(r()*2|0),y);np++;}
      else if(h>=.28&&h<.66&&dd>=8&&hash(x,y,6)<.2){arbol(x,y,1.8+r()*1.2);nt++;}
    }
    // pueblitos de techos rojos junto a cada casilla de la isla
    A.nodos.filter(n=>n.r==='mar').forEach(n=>{
      let bk=-1,bs=1e9;for(let q=0;q<2;q++){const J=ISL[q],u=(n.x-J.x)/J.rx,v=(n.y-J.y)/J.ry,rr=u*u+v*v;if(rr<bs){bs=rr;bk=q;}}
      if(bk!==k)return;
      const rr=A.rng((n.x*7+n.y)|0);let put=0;
      for(let t=0;t<40&&put<(o.casas|0);t++){const a=rr()*6.283,d=19+rr()*14,x=Math.round(n.x+Math.cos(a)*d*1.3),y=Math.round(n.y+Math.sin(a)*d*.8);
        if(x<2||y<2||x>=W-6||y>=H-6||ocup(x,y)||ocup(x+8,y+8)||tierra[y*W+x]!==1||tierra[(y+6)*W+x+7]!==1||dist[y*W+x]/3<7)continue;
        casa(x,y,(rr()*4)|0);put++;}});
  }
  isla(0,{playa:8,picos:[{dx:34,dy:-6,rx:58,ry:30,h:1.5},{dx:-92,dy:4,rx:48,ry:22,h:.62},{dx:-45,dy:2,rx:30,ry:12,h:.6},{dx:-12,dy:12,rx:30,ry:11,h:.5},{dx:80,dy:2,rx:22,ry:10,h:.45}],crater:true,arboles:260,palmas:40,casas:6});
  isla(1,{playa:3.6,picos:[{dx:0,dy:-1,rx:20,ry:7,h:.25}],arboles:6,palmas:5,casas:3});

  /* — halo turquesa y estela de arrecife en torno a un punto (sólo sobre mar) — */
  const halo=(cx,cy,rx,ry,col,fuerza)=>{for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(H-1,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(W-1,Math.ceil(cx+rx));x++){
    if(tierra[y*W+x]!==0)continue;const u=(x-cx)/rx,v=(y-cy)/ry,r=u*u+v*v;if(r>=1)continue;const q=(1-r)*fuerza;if(q>.55||(q>.3&&((x+y)&1)===0))buf[y*W+x]=A.rgb(col);}};

  /* — Los Roques: atolón de anillos turquesa con cayos de arena y palmitas — */
  (function(){
    const O=ISL[2],cx=O.x,cy=O.y,rx=O.rx,ry=O.ry;
    halo(cx,cy,rx*1.5,ry*1.6,P.turquesa,.7);
    const DEEP=A.rgb(M(P.mar,P.somero,.3)),DEEP2=A.rgb(M(P.marMedio,P.mar,.5)),ANI=[M(P.somero,P.turquesa,.3),P.turquesa,M(P.turquesa,P.espuma,.35),M(P.turquesa,'#bff7f0',.65)].map(A.rgb);
    const SAND=A.rgb(M(PAL2.arenaClara,P.turquesa,.45)),CORN=A.rgb(A.sombrea(M(P.turquesa,P.mar,.45),.1)),CORC=A.rgb(M(P.turquesa,P.espuma,.7));
    const cr2=A.campo(10,611,2,2),ROQ=a=>1.22*(1+.16*Math.sin(a*3+1.2)+.09*Math.sin(a*7+.4));
    for(let y=Math.floor(cy-ry*1.35);y<=Math.ceil(cy+ry*1.35);y++)for(let x=Math.floor(cx-rx*1.35);x<=Math.ceil(cx+rx*1.35);x++){
      if(x<0||y<0||x>=W||y>=H)continue;
      const u=(x-cx)/rx,v=(y-cy)/ry,ang=Math.atan2(v,u),q2=Math.sqrt(u*u+v*v),was=tierra[y*W+x]===1;
      if(q2>1.7||(was&&A.ocupado[y*W+x]&&q2>1.4))continue;
      // anillo irregular: radio exterior e interior modulados por ángulo y ruido; huecos de paso (bajíos más finos)
      const wob=ROQ(ang)*(1+.1*(cw(x,y)-.5)),r=q2/wob;
      const gap=Math.sin(ang*2.3+.8)>.82;
      const ri=gap?.78:.6+.06*Math.sin(ang*5);
      let c=0;
      if(r>1.0){if(((x+y)&1)===0&&r<1.06)c=ANI[0];else if(was)c=q2<1.5?ANI[0]:(((x+y)&1)?ANI[0]:ANI[1]);else continue;}
      else if(r>.93)c=ANI[2];                                                    // rompiente exterior
      else if(r>ri+.08){const n=cn(x*1.4,y*1.4);c=n>.55?ANI[3]:(n>.4?ANI[2]:ANI[1]);   // meseta de bajío claro
        const k=cr2(x,y);if(k>.62&&r<.9&&r>ri+.12)c=k>.655?CORN:CORC;}                // manchas de coral
      else if(r>ri)c=ANI[0];                                                      // talud
      else c=r<ri*.7?DEEP2:DEEP;                                                  // aguas profundas dentro
      buf[y*W+x]=c;if(was)tierra[y*W+x]=0;
    }
    const cayo=(x,y,rxx,ryy,s)=>{
      halo(x,y,rxx*1.7+3,ryy*1.8+3,P.turquesa,.85);
      for(let j=-ryy-2;j<=ryy+2;j++)for(let i=-rxx-2;i<=rxx+2;i++){const u=i/rxx,v=j/ryy,q=Math.sqrt(u*u+v*v)*(1+.25*(hash(x+i,y+j,s)-.5));
        if(q>1.0)continue;const px=Math.round(x+i),py=Math.round(y+j);
        let c=PAL2.arenaClara;if(q>.78)c=P.arena;if(v>.45&&q>.55)c=P.arenaSombra;if(q<.42&&rxx>6)c=(i+j)&1?P.pastoClaro:P.pasto;
        A.px(px,py,c);}
      A.ell(x+rxx*.15,y+ryy*.5,rxx*.7,ryy*.3,P.somero,.35);
    };
    const cayos=[];
    A.nodos.filter(n=>n.r==='roq').forEach(n=>cayos.push([n.x,n.y+2,15,8,n.x|0]));
    for(let k=0;k<13;k++){const a=k*Math.PI*2/13+.3+.2*Math.sin(k*2.1),rr=ROQ(a)*(.77+.08*(hash(k,5,9)-.5)),x=cx+Math.cos(a)*rx*rr,y=cy+Math.sin(a)*ry*rr;
      if(cayos.some(c=>Math.abs(c[0]-x)<26&&Math.abs(c[1]-y)<16))continue;cayos.push([x,y,4+((hash(k,1,9)*4)|0),3+((hash(k,2,9)*2)|0),k+50]);}
    cayos.forEach(c=>cayo(c[0],c[1],c[2],c[3],c[4]));
    A.nodos.filter(n=>n.r==='roq').forEach(n=>{for(let j=-8;j<=10;j++)for(let i=-16;i<=16;i++){const x=Math.round(n.x)+i,y=Math.round(n.y)+j;if(x>=0&&y>=0&&x<W&&y<H&&(i*i)/256+(j*j)/81<=1)tierra[y*W+x]=1;}});
    cayos.forEach(c=>{if(c[2]>=7){palma(c[0]-c[2]*.55,c[1]-1);palma(c[0]+c[2]*.5,c[1]);if(c[2]>=14&&hash(c[4],3,3)<.8)palma(c[0]+2,c[1]-2);}
      else if(c[2]>=4&&hash(c[4],4,3)<.7)palma(c[0],c[1]);});
  })();

  /* — islotes de roca con cima verde y palmas (bahía de Mochima y costa de Oriente) — */
  // archipiélagos: [x diseño, y diseño, nº de rocas] (varían picos, anchura y altura; se agrupan como en la referencia)
  const ARCH=[[655,146,4],[888,145,5],[552,124,3],[400,112,3],[470,106,2],[225,100,2],[760,104,2]];
  const ISLOTES=[];ARCH.forEach((g,gi)=>{for(let n=0;n<g[2];n++){const h1=hash(gi,n,31),h2=hash(gi,n,32),h3=hash(gi,n,33),a=n*2.3999+gi,d=n?14+26*h1:0;
    const big=n===0||h1>.7;ISLOTES.push([g[0]+Math.cos(a)*d*.5+(h3-.5)*8,g[1]+Math.sin(a)*d*.35,big?7+5*h2:4+3.5*h2,big?18+14*h3:10+8*h3,1+((hash(gi,n,34)*3)|0)]);}});
  const colocados=[];
  function islote(cx,cy,w,hm,s,npk){
    halo(cx,cy,w*2.4+8,hm*.35+12,P.turquesa,.85);halo(cx,cy,w*1.7+6,hm*.22+7,'#7fe6ea',.9);
    const pk=[];
    for(let k=0;k<npk;k++)pk.push({c:Math.round(-w+(k+.5)*2*w/npk+(hash(s,k,2)-.5)*w*.4),h:hm*(k===0?1:.55+.4*hash(s,k,3)),w:2*w/npk*.95+2});
    const cols=[],lo=-w-2,hi=w+2;
    for(let i=lo;i<=hi;i++){let best=0,bk=0;for(let k=0;k<npk;k++){const q=1-Math.abs(i-pk[k].c)/pk[k].w;if(q>0){const h=pk[k].h*Math.pow(q,npk===1?1:.62);if(h>best){best=h;bk=k;}}}
      const ht=Math.round(best*(.9+.2*hash(i,s,4)));if(ht>1)cols.push([i,ht,bk]);}
    cols.forEach(c=>{for(let k=1;k<=Math.min(9,c[1]*.35);k++){const sx=cx+c[0]+k,sy=cy+(k*.6|0);if(esMarLejos(sx,sy,0)&&bay(sx,sy)<.6)A.pxa(sx,sy,P.marProfundo,.3);}});
    // reflejo/sombra oscura en el agua (abajo-derecha) y espuma ancha en toda la base
    for(let i=-w-2;i<=w+16;i++)for(let j=0;j<=8;j++){const q=((i-w*.35)/(w*1.1+9))**2+((j-3)/5)**2;if(q<1){const x=cx+i,y=cy+j;if(esMarLejos(x,y,0)&&(q<.6||bay(x,y)<(1-q)*2.2))A.pxa(x,y,P.marProfundo,.5-.2*q);}}
    const fw=w+9;
    for(let i=-fw;i<=fw;i++)for(let j=-3;j<=6;j++){const q=(i/fw)**2+((j-1.5)/5)**2;if(q<1){const x=cx+i,y=cy+j;if(esMarLejos(x,y,0)){
      const nz=hash(x>>1,y>>1,s+5);if(q>.62-.2*nz||bay(x,y)<(1-q)*1.8)A.px(x,y,(q>.8&&bay(x+1,y)<.45)?A.rgb(M(P.turquesa,P.espuma,.5)):P.espuma);}}}
    cols.forEach(c=>{const i=c[0],ht=c[1],rel=i-pk[c[2]].c,cap=Math.max(3,Math.round(ht*.3));
      for(let j=0;j<ht;j++){const y=cy-j,top=ht-j;let col;
        if(top<=cap-(hash(i,s,9)<.45?1:0)){col=rel<-1?P.selvaLuz:(rel>1?P.selvaOscura:P.selvaMedia);if(top===1)col=A.aclara(col,.2);if(top>2&&hash(i,j,s)<.12)col=P.selvaOscura;}
        else{col=rel<-1?P.acantiladoLuz:(rel>1?P.acantiladoSombra:P.acantilado);
          if(Math.abs(rel)<=1&&top>cap+1)col=P.acantiladoLuz;                   // arista iluminada
          if(hash(i>>1,(j/3)|0,s)<.16)col=A.sombrea(col,.18);                    // estratos
          if(j<3)col=A.sombrea(col,.3);}
        A.px(cx+i,y,col);}
      A.px(cx+i,cy-ht,P.sombra);});
    for(let j=0;j<hm+2;j++){let l=null,r=null;cols.forEach(c=>{if(c[1]>j){if(l===null||c[0]<l)l=c[0];if(r===null||c[0]>r)r=c[0];}});
      if(l!==null){A.px(cx+l-1,cy-j,P.sombra);A.px(cx+r+1,cy-j,P.sombra);}}
    pk.forEach((p,k)=>{const col=cols.find(c=>c[0]===p.c);if(col&&p.h>9){const ty=cy-col[1];A.disc(p.c+cx,ty-1,2.2,P.selvaMedia);A.px(p.c+cx-1,ty-2,P.selvaLuz);if(k===0&&hm>=18)palma(cx+p.c+1,ty+1);}});
  }
  ISLOTES.forEach((o,k)=>{
    let x=o[0]*2,y=o[1]*1.5,ok=false;
    for(let q=0;q<60&&!ok;q++){const a=q*2.4,d=q*2.2,xx=Math.round(x+Math.cos(a)*d),yy=Math.round(y+Math.sin(a)*d*.7);
      if(esMarLejos(xx,yy,18)&&esMarLejos(xx-o[2]*2,yy,10)&&esMarLejos(xx+o[2]*2,yy,10)&&!colocados.some(c=>Math.hypot(c[0]-xx,(c[1]-yy)*1.4)<46)&&!ocup(xx,yy)){x=xx;y=yy;ok=true;}}
    if(!ok)return;colocados.push([x,y]);islote(x,y,Math.round(o[2]*1.5),Math.round(o[3]*1.5),k*13+4,o[4]);
  });

  /* — faro de Paraguaná — */
  (function(){
    const fx=255*2,fy=62*1.5;let bx=-1,by=-1,bd=1e9;
    for(let y=Math.floor(fy-45);y<=fy+45;y++)for(let x=Math.floor(fx-60);x<=fx+60;x++){if(x<2||y<2||x>=W-2||y>=H-2)continue;
      const i=y*W+x;if(tierra[i]!==1||A.extra[i])continue;const d=dist[i]/3;if(d<4||d>9||A.ocupado[i])continue;const dd=Math.hypot(x-fx,(y-fy)*1.2);if(dd<bd){bd=dd;bx=x;by=y;}}
    if(bx<0)return;
    A.ell(bx+1,by+1,9,4,A.sombrea(P.roca,.2));A.ell(bx,by,8,3.4,P.roca);A.ell(bx-1,by-1,5,2,A.aclara(P.roca,.3));
    A.linea(bx+4,by,bx+14,by+3,P.sombra,1);for(let k=0;k<12;k++)A.pxa(bx+3+k,by+(k*.25|0),P.sombra,.28);
    const F2=['..rrr..','..yyy..','.wwwwk.','..wwwk.','..rrrk.','..rrrk.','..wwwk.','..wwwk.','..rrrk.','.rrrrkk','.wwwwwk','.wwwwwk','.rrrrrk','wwwwwwk'];
    A.spr(F2,{r:'#d9482e',w:'#f4f6fa',y:'#fff2a0',k:'#8a94a8'},bx-3,by-F2.length+1);
    A.dyn.push({k:'faro',x:bx,y:by-F2.length+2});
  })();

  /* — bajíos turquesa luminosos y playa ancha en la bahía central — */
  (function(){
    const BR=A.rgb('#8af0ee'),BR2=A.rgb(M(P.turquesa,P.espuma,.5));
    for(let y=120*1.5|0;y<215*1.5;y++)for(let x=340*2;x<660*2;x++){const i=y*W+x;
      if(tierra[i]!==0)continue;const dd=-dist[i]/3;if(dd<2||dd>18)continue;
      const k=1-(dd-2)/16;if(bay(x,y)<k*.8)buf[i]=bay(x+1,y+2)<.4?BR2:BR;}
    for(let y=130*1.5|0;y<200*1.5;y++)for(let x=350*2;x<650*2;x++){const i=y*W+x;
      if(tierra[i]!==1||A.extra[i]||A.ocupado[i])continue;const dd=dist[i]/3;if(dd>9)continue;
      const bw=5+4*cn(x*1.7,y*1.7);if(dd>bw)continue;
      const c=dd<=bw-1.6?P.arena:(bay(x,y)<.5?P.arena:P.arenaSombra);
      buf[i]=A.rgb(dd>bw-1.6&&dd>bw-.6?M(buf[i],P.arena,.5):(dd<2.4?PAL2.arenaClara:c));}
  })();

  /* — barcos animados y estáticos, brillos de sol — */
  (function(){
    const busca=(dx,dy,L,E)=>{E=E||1;const x0=dx*2,y0=dy*1.5;
      for(let q=0;q<400;q++){const a=q*2.4,d=q*1.6,xx=Math.round(x0+Math.cos(a)*d),yy=Math.round(y0+Math.sin(a)*d*.7);
        let ok=true;for(let k=-1;k<=1&&ok;k++)if(!esMarLejos(xx+k*L/2,yy,12)||!esMarLejos(xx+k*L/2,yy-8*E,8))ok=false;if(ok&&!ocup(xx,yy))return[xx,yy];}
      return null;};
    const LISTA=[['ferry',740,150,70,5],['velero',670,118,60,3.4],['carguero',400,90,80,2.6],['carguero',520,102,70,2.3],['velero',612,130,50,3],
      ['velero',880,120,60,3.2],['lancha',900,200,50,5.5],['ferry',850,88,60,4.2],['carguero',330,100,80,2.4],['velero',185,92,50,3.1],
      ['velero',720,70,70,2.8],['velero',560,100,60,3.3],['velero',830,175,50,2.9],['velero',440,60,80,3.6],['ferry',640,95,70,3.8]];
    LISTA.forEach((b,k)=>{const E=b[0]==='lancha'?2:2,p=busca(b[1],b[2],b[3],E);if(!p)return;A.dyn.push({k:'barco',x:p[0],y:p[1],L:b[3],v:b[4],f:k*37,tipo:b[0],esc:E});});
    // veleros fondeados en la bahía de Mochima
    [[690,165],[610,150]].forEach((b,k)=>{const x0=b[0]*2,y0=b[1]*1.5;
      for(let q=0;q<200;q++){const xx=Math.round(x0+Math.cos(q*2.4)*q*1.1),yy=Math.round(y0+Math.sin(q*2.4)*q*.8);
        if(esMarLejos(xx,yy,9)&&esMarLejos(xx,yy-9,6)&&!ocup(xx,yy)){BARCO_PRE.velero.px.forEach(p=>{A.rect(xx-12+p[0]*2,yy-30+p[1]*2,2,2,p[2]);});A.rect(xx-12,yy+1,25,2,P.marProfundo);for(let k=1;k<7;k++)A.pxa(xx-9-k*2,yy+(k&1),P.espuma,.7-k*.08);break;}}});
    // brillos de sol
    const r=A.rng(4242);let n=0;
    for(let t=0;t<900&&n<36;t++){const x=(r()*W)|0,y=(r()*H*.45)|0;if(!esMarLejos(x,y,12)||(x<500&&r()<.6))continue;
      A.dyn.push({k:'brillo',x:x,y:y,f:r()*6.28});n++;}
  })();
});
})(typeof window!=='undefined'?window:globalThis);
