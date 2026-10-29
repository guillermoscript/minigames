// LA FIESTA · arte del mapa: capa «agua» (orden 40). Lago de Maracaibo + Catatumbo, Orinoco/Apure/Caroní y afluentes, delta morado
// (con puerta y arepa flotando), lagunas del Llano y embalse de Guri. Determinista, sin DOM.
(function(root){'use strict';const F=root.FIESTA=root.FIESTA||{};
if(typeof module!=='undefined'&&typeof require!=='undefined'&&!F.arte)require('./fiesta-mapa-arte.js');
if(!F.arte)return;

F.arte.capa('agua',40,function(A){
  const W=A.W,H=A.H,PAL=A.PAL,T=A.tierra,BIO=A.BIO;
  const mz=A.mezcla,cl=(v,a,b)=>v<a?a:v>b?b:v;
  // casillas: máscara de «cerca de casilla» (no inundar discos con agua ancha)
  const cerca=new Uint8Array(W*H);
  A.nodos.forEach(n=>{const r=14;for(let y=Math.max(0,Math.floor(n.y-r));y<=Math.min(H-1,Math.ceil(n.y+r));y++)for(let x=Math.max(0,Math.floor(n.x-r));x<=Math.min(W-1,Math.ceil(n.x+r));x++)
    if((x-n.x)*(x-n.x)+(y-n.y)*(y-n.y)<=r*r)cerca[y*W+x]=1;});
  let PUERTA=null,AREPA=null;
  const brillos=[];                       // candidatos de centelleo
  const rn=A.rng(4041);

  // chamfer 3-4 sobre una región: distancia (px) de cada celda «dentro» a la celda «fuera» más cercana
  function chamfer(w,h,dentro){const INF=9999,g=new Uint16Array(w*h);for(let i=0;i<w*h;i++)g[i]=dentro[i]?INF:0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;let v=g[i];if(!v)continue;if(x>0&&g[i-1]+3<v)v=g[i-1]+3;
      if(y>0){if(g[i-w]+3<v)v=g[i-w]+3;if(x>0&&g[i-w-1]+4<v)v=g[i-w-1]+4;if(x<w-1&&g[i-w+1]+4<v)v=g[i-w+1]+4;}g[i]=v;}
    for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;let v=g[i];if(!v)continue;if(x<w-1&&g[i+1]+3<v)v=g[i+1]+3;
      if(y<h-1){if(g[i+w]+3<v)v=g[i+w]+3;if(x<w-1&&g[i+w+1]+4<v)v=g[i+w+1]+4;if(x>0&&g[i+w-1]+4<v)v=g[i+w-1]+4;}g[i]=v;}
    return g;}

  /* ═════════ 1. LAGO DE MARACAIBO ═════════ */
  // canal estrecho al norte hasta el golfo (bajo el puente)
  (function canal(){let x=A.dx(146),y=A.dy(204),guard=0;
    while(y>2&&guard++<200){const k=Math.round(y)*W+Math.round(x);
      for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){if(i*i+j*j>5)continue;const xx=Math.round(x)+i,yy=Math.round(y)+j;if(xx<0||yy<0||xx>=W||yy>=H)continue;
        const q=yy*W+xx;if(T[q]===1){T[q]=2;A.bioma[q]=BIO.mar;}}
      if(T[k]===0&&guard>3)break;
      y-=1;x+=(A.vn(y/9,3,91)-.5)*1.6-(x-A.dx(146))*.04;}})();
  let lx0=W,ly0=H,lx1=0,ly1=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(T[y*W+x]===2){if(x<lx0)lx0=x;if(x>lx1)lx1=x;if(y<ly0)ly0=y;if(y>ly1)ly1=y;}
  let ISLA=null;
  if(lx1>lx0){
    const M=46,bx=Math.max(0,lx0-M),by=Math.max(0,ly0-M),bw=Math.min(W,lx1+M+1)-bx,bh=Math.min(H,ly1+M+1)-by;
    const lago=new Uint8Array(bw*bh),noLago=new Uint8Array(bw*bh),cut=new Uint8Array(bw*bh),gro=new Uint8Array(bw*bh);
    const orig=new Uint8Array(bw*bh);
    for(let y=0;y<bh;y++)for(let x=0;x<bw;x++)orig[y*bw+x]=T[(by+y)*W+bx+x]===2?1:0;
    const d0=chamfer(bw,bh,orig),dn0=chamfer(bw,bh,orig.map(v=>v?0:1));
    const cx146=A.dx(146),yTop=A.dy(232),cxL=(lx0+lx1)/2,xMin=A.dx(66),xMax=A.dx(196),yBr=A.dy(213);
    for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const i=y*bw+x,X=bx+x,Y=by+y;let l=orig[i];
      const prot=Math.abs(X-cx146)<9&&Y<yTop;
      if(l&&!prot){const n=A.vn(X/13,Y/13,611)*.7+A.vn(X/5,Y/5,612)*.3;if(d0[i]/3<(n-.52)*30)l=0,cut[i]=1;}
      else if(!l&&T[Y*W+X]===1&&!prot&&X>xMin&&X<xMax&&Y>yBr+4&&!A.ocupado[Y*W+X]&&!cerca[Y*W+X]){
        const n=A.vn(X/26,Y/22,613)*.55+A.vn(X/10,Y/9,614)*.3+A.vn(X/4,Y/4,615)*.15;
        const wf=(X<cxL?1:.55)*Math.min(1,(Y-yBr)/40);
        if(dn0[i]/3<(n-.27)*165*wf){l=1;gro[i]=1;}}
      lago[i]=l;noLago[i]=l?0:1;
      if(l&&!orig[i]){T[Y*W+X]=2;A.bioma[Y*W+X]=BIO.mar;}else if(!l&&orig[i]){T[Y*W+X]=1;A.bioma[Y*W+X]=BIO.desierto;}}
    const dl=chamfer(bw,bh,lago),dt=chamfer(bw,bh,noLago);
    const ripple=A.campo(9,501,2,2),olas=A.campo(22,503,2,3);
    for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const i=y*bw+x,X=bx+x,Y=by+y,q=Y*W+X;
      if(lago[i]){
        const d=dl[i]/3,dz=(A.hash(X,Y,5)-.5)*.5;
        let c;
        if(d<=1.2)c=mz(PAL.somero,PAL.turquesa,.35);
        else if(d<=2.8)c=mz(PAL.somero,PAL.marMedio,.3+dz*.3);
        else{const t=cl((d-2.8)/28+dz*.14,0,1);c=mz(PAL.marMedio,PAL.lago,Math.min(1,t*2.2));if(t>.45)c=mz(c,PAL.marProfundo,Math.min(.8,(t-.45)*1.3));}
        const r=ripple(X,Y);if(d>3&&r>.62&&(X+Y)%2===0)c=A.aclara(c,.13);
        const ow=olas(X,Y);if(d>4&&ow>.6&&A.hash(X>>1,Y,19)>.55&&(Y%3===0))c=A.aclara(c,.2+.2*(ow-.6)*3);      // olitas
        if(d>3&&A.hash(X,Y,9)>.9945){c=A.aclara(c,.55);if(brillos.length<200)brillos.push([X,Y,0]);}
        if(d>1.2&&d<4&&i+bw+1<lago.length&&!lago[i+1]&&!lago[i+bw])c=A.sombrea(c,.15);
        if(d>1.2&&d<=2.4&&!lago[i-1]===false&&!lago[i-bw]===false&&A.hash(X,Y,22)>.55)c=A.aclara(c,.35);          // espuma de orilla
        A.px(X,Y,c);
      }else if(T[q]!==0&&dt[i]<=21){
        const d=dt[i]/3,sw=3.4+3.2*A.vn(X/6,Y/6,616);if(d>sw&&!cut[i]&&!gro[i])continue;
        const des=A.bioma[q]===BIO.desierto||A.bioma[q]===BIO.costa;
        const arena=A.aclara(des?PAL.arena:mz(PAL.arena,PAL.pastoClaro,.3),.12);
        if(cut[i]||T[q]===2){A.px(X,Y,mz(arena,PAL.arenaSombra,.12+A.hash(X,Y,6)*.2));if(d<=1.2)A.px(X,Y,mz(arena,PAL.arenaSombra,.7));continue;}
        if(d<=1.2)A.px(X,Y,mz(A.get(X,Y),PAL.arenaSombra,.7));
        else if(d<=sw*.7)A.px(X,Y,mz(A.get(X,Y),arena,.85));
        else A.px(X,Y,mz(A.get(X,Y),arena,.4));
      }}
    // rocas en la orilla (peñascos de 4-6 px con luz arriba-izquierda)
    {let nr=0;const rr=A.rng(777);
     for(let y=2;y<bh-2&&nr<46;y+=3)for(let x=2;x<bw-2&&nr<46;x+=3){const i=y*bw+x,X=bx+x,Y=by+y,q=Y*W+X,d=dt[i]/3;
       if(lago[i]||T[q]!==1||d<2.4||d>5||A.ocupado[q]||cerca[q]||A.hash(X,Y,88)<.93)continue;nr++;
       const w=2+Math.floor(rr()*3);A.ell(X+1,Y+2,w+1,1.4,PAL.sombra,.4);A.ell(X,Y,w+1,w*.7+1,'#2a2420');A.ell(X,Y,w,w*.7,'#7a6a58');A.ell(X-.7,Y-.8,w*.6,w*.4,'#a89a84');A.px(X-1,Y-1,'#d6cbb8');A.px(X+w-1,Y+1,'#4a3e34');}}
    // isla con palmeras: la zona más honda lejos de la tormenta
    {const stX=A.dx(122),stY=A.dy(272),rigs=[[118,246],[152,252],[128,290],[160,296],[120,322],[150,320]].map(p=>[A.dx(p[0])+13,A.dy(p[1])]);let best=-1,pb=null;
      for(let y=10;y<bh-10;y+=2)for(let x=10;x<bw-10;x+=2){const i=y*bw+x,X=bx+x,Y=by+y,d=dl[i]/3;if(d<9||Y<yBr+44)continue;
        if(X>stX-90&&X<stX+96&&Y>stY-62&&Y<stY+80)continue;
        if(rigs.some(r=>Math.abs(X-r[0])<32&&Y>r[1]-46&&Y<r[1]+14))continue;
        const sc=d;if(sc>best){best=sc;pb=[X,Y];}}
      if(pb){ISLA=pb;const X=pb[0],Y=pb[1];
        for(let j=-12;j<=12;j++)for(let i=-18;i<=18;i++){A.ocupado[(Y+j)*W+X+i]=1;}
        A.ell(X,Y+1,17,10,PAL.somero,.55);A.ell(X,Y,14,8,PAL.turquesa,.6);
        for(let k=0;k<30;k++){const an=k*.2094;if(k%2)A.pxa(Math.round(X+Math.cos(an)*16),Math.round(Y+Math.sin(an)*9),'#e6fbff',.8);}
        A.ell(X+1,Y+2,12,6,PAL.marProfundo,.35);
        A.ell(X,Y,11,6,PAL.arenaSombra);A.ell(X,Y-.5,10,5.4,PAL.arena);A.ell(X-1,Y-1,8,3.6,A.aclara(PAL.arena,.25));
        A.ell(X+1,Y-1,6,3,PAL.pastoSombra);A.ell(X,Y-1.5,5,2.2,PAL.pastoClaro);
        const roca=(rx,ry)=>{A.ell(rx,ry,2.6,2,'#2a2420');A.ell(rx,ry,2,1.4,'#7a6a58');A.px(rx-1,ry-1,'#c4b8a4');};roca(X-9,Y+3);roca(X+10,Y+2);
        const palma=(px,py,h,dir)=>{let tx=px,ty=py;for(let j=0;j<h;j++){ty=py-j;tx=px+Math.round(dir*j*j/(h*2.4));A.px(tx,ty,j%3===0?'#4a2e14':'#7a5028');A.px(tx+1,ty,'#2a1a0c');}
          const fr=[[-5,1],[-4,-2],[-2,-3],[2,-3],[4,-2],[5,1],[0,-4]];fr.forEach(function(f,k){const steps=Math.max(Math.abs(f[0]),Math.abs(f[1]));for(let s=1;s<=steps+1;s++){const fx=tx+Math.round(f[0]*s/(steps+1)),fy=ty+Math.round(f[1]*s/(steps+1))+(s>2?1:0);A.px(fx,fy,k%2?'#2f7a2a':'#58b43e');A.px(fx,fy-1,'#8ad65a');}});
          A.px(tx,ty+1,'#3a2410');A.px(tx+1,ty+1,'#3a2410');};
        palma(X-4,Y,12,-1);palma(X+3,Y+1,14,1);palma(X-1,Y-2,9,0);
        brillos.push([X-15,Y+4,0],[X+15,Y+3,0]);}}
    // islotitos del lago (en aguas hondas)
    [[152,250],[168,300],[130,230]].forEach(function(p,k){let cx=A.dx(p[0]),cy=A.dy(p[1]),best=-1,bxx=cx,byy=cy;
      for(let j=-14;j<=14;j+=2)for(let i=-14;i<=14;i+=2){const xx=Math.round(cx+i)-bx,yy=Math.round(cy+j)-by;if(xx<0||yy<0||xx>=bw||yy>=bh)continue;const dd=dl[yy*bw+xx]/3;if(dd>best){best=dd;bxx=xx+bx;byy=yy+by;}}
      if(best<7||(ISLA&&Math.hypot(bxx-ISLA[0],byy-ISLA[1])<30))return;const rx=5-(k>1?1:0),ry=3;
      A.ell(bxx+1,byy+2,rx+1,ry,PAL.marProfundo,.5);
      A.ell(bxx,byy,rx+1,ry+1,PAL.arenaSombra);A.ell(bxx,byy,rx,ry,PAL.arena);A.ell(bxx-.5,byy-1,rx-1.5,ry-1.2,PAL.pastoSombra);
      A.px(bxx-1,byy-2,PAL.pastoClaro);A.px(bxx,byy-3,PAL.selvaMedia);A.px(bxx+1,byy-2,PAL.selvaMedia);A.px(bxx,byy-2,PAL.selvaLuz);});
  }

  /* ═════════ 2. TORMENTA DEL CATATUMBO: cumulonimbo gris-violeta ═════════ */
  function tormenta(){
    const cx=Math.round(A.dx(122)),base=Math.round(A.dy(272));
    const CW=150,CH=64,ox=cx-CW/2,oy=base-46;
    const hf=new Float32Array(CW*CH);
    // cúmulos apilados (yunque ancho arriba, base plana): [x,y,rx,ry]
    const puffs=[[-52,34,22,10],[-30,36,26,11],[0,37,30,10],[30,36,26,11],[52,34,22,10],
      [-36,22,18,14],[-14,14,20,16],[10,8,22,17],[34,18,19,14],[-4,24,28,14],
      [-24,8,14,11],[22,0,15,12],[0,-2,14,11],[-46,26,13,9],[46,24,13,9],[-8,-8,10,8],[12,-10,9,7]];
    puffs.forEach(function(p){const pcx=CW/2+p[0],pcy=46+p[1]-26;
      for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){const u=(i-pcx)/p[2],v=(j-pcy)/p[3],r2=u*u+v*v;
        if(r2<1){const z=Math.sqrt(1-r2)*p[3]*.9+(1-r2)*2;if(z>hf[j*CW+i])hf[j*CW+i]=z;}}});
    const bordeInf=40;
    const m=new Uint8Array(CW*CH);
    for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){const e=(A.vn(i/5,j/5,31)-.5)*1.6;if(hf[j*CW+i]>.6+e*.5&&j<=bordeInf+Math.round((A.vn(i/6,3,33)-.5)*4))m[j*CW+i]=1;}
    const S=(i,j)=>i<0||j<0||i>=CW||j>=CH?0:m[j*CW+i],Hh=(i,j)=>i<0||j<0||i>=CW||j>=CH?0:hf[j*CW+i];
    for(let j=0;j<18;j++)for(let i=0;i<CW;i++){const u=(i-CW/2)/70,v=(j-8)/14;if(u*u+v*v<=1){const X=ox+i+6,Y=base+10+j;if(X>=0&&Y>=0&&X<W&&Y<H&&T[Y*W+X]!==0)A.pxa(X,Y,PAL.sombra,.3*(1-(u*u+v*v)));}}
    const tonos=['#2b2644','#403a62','#5a5280','#7a72a4','#a49cc8','#d0c8ec'];
    for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){if(!m[j*CW+i])continue;
      const X=ox+i,Y=oy+j;
      let sh=(Hh(i+2,j+2)-Hh(i-2,j-2))*.55+(Hh(i,j)/14)*.6;       // cara a la luz arriba-izquierda
      sh+=(A.vn(i/3,j/3,35)-.5)*.5;
      // la base es más oscura (panza cargada de lluvia)
      sh-=Math.max(0,(j-24))*.075;
      let k=Math.max(0,Math.min(5,Math.floor(sh*1.35+1.6)));
      let c=tonos[k];
      if(!S(i-1,j-1)||!S(i,j-2))c=tonos[5];else if(!S(i-2,j-2))c=A.mezcla(c,tonos[4],.5);
      if(j>=bordeInf-3)c=A.mezcla(c,'#1e1a34',.5+.12*(j-bordeInf+3));
      if(k>=3&&(i+j)%2===0&&A.hash(X,Y,3)>.82)c=A.mezcla(c,'#ffffff',.18);
      A.px(X,Y,c);}
    for(let j=0;j<CH;j++)for(let i=0;i<CW;i++){if(m[j*CW+i])continue;if(S(i+1,j)||S(i-1,j)||S(i,j+1)||S(i,j-1))A.px(ox+i,oy+j,'#1a1630');}
    // velo de lluvia gris azulado bajo la panza
    const R=A.rng(31);
    for(let k=0;k<26;k++){const x=ox+10+Math.floor(R()*(CW-20)),y=oy+bordeInf+2,L=8+Math.floor(R()*14);for(let j=0;j<L;j++)A.pxa(x-(j>>2),y+j,'#a8bef0',.5-.025*j);}
    // 4 rayos grandes: zigzag de 2 px con halo, horquillas y chispazo en el agua
    const rayos=[[cx-34,0.0,50,-1],[cx-8,.28,64,1],[cx+18,.55,56,-1],[cx+44,.8,46,1]];
    rayos.forEach(function(r,k){const rr=A.rng(100+k*17),pts=[];let x=r[0],y=base+2;const L=r[2];
      const add=(x0,y0,x1,y1)=>{const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));for(let s=0;s<=n;s++)pts.push(Math.round(x0+(x1-x0)*s/n),Math.round(y0+(y1-y0)*s/n));};
      let dir=r[3];while(y<base+2+L){const seg=5+Math.floor(rr()*5),dx=dir*(3+Math.floor(rr()*3));add(x,y,x+dx,y+seg);x+=dx;y+=seg;dir=-dir;if(rr()<.3)dir=-dir;}
      const ramas=[];const bi=Math.floor(pts.length/2*.5)*2;let bx2=pts[bi],by2=pts[bi+1];const bd=k%2?1:-1;
      for(let j=0;j<4;j++){const nx=bx2+bd*(3+j%2),ny=by2+5;const n=5;for(let s=0;s<n;s++)ramas.push(Math.round(bx2+(nx-bx2)*s/n),Math.round(by2+(ny-by2)*s/n));bx2=nx;by2=ny;}
      const tipX=x,tipY=y;
      // trazo estático tenue (siempre visible) con halo
      for(let i=0;i<pts.length;i+=2){const px=pts[i],py=pts[i+1];A.pxa(px-2,py,'#7aa8ff',.3);A.pxa(px+3,py,'#7aa8ff',.3);A.pxa(px-1,py,'#a8c8ff',.5);A.pxa(px+2,py,'#a8c8ff',.5);A.px(px,py,'#e8f2ff');A.px(px+1,py,'#ffffff');}
      for(let i=0;i<ramas.length;i+=2){A.pxa(ramas[i]-1,ramas[i+1],'#9ac0ff',.5);A.px(ramas[i],ramas[i+1],'#dfeaff');}
      // reflejo en el agua
      A.ell(tipX,tipY+3,9,3,'#8ab4ff',.3);A.ell(tipX,tipY+3,5,1.6,'#e0eeff',.55);
      for(let s=0;s<7;s++)A.pxa(tipX-9+s*3,tipY+5+(s%2),'#dbe8ff',.55);
      A.dyn.push({k:'rayo',x:tipX,y:base,fase:r[1],p:pts,b:ramas,tx:tipX,ty:tipY,cx:cx,cy:oy+14});});
    // el cielo cargado y los rayos no admiten derricks encima
    for(let j=-2;j<CH+66;j++)for(let i=0;i<CW;i++){const X=ox+i,Y=oy+j;if(X<0||Y<0||X>=W||Y>=H)continue;
      if(j<=bordeInf+4?S(i,Math.min(j,CH-1)):(Math.abs(X-cx)<52&&j<bordeInf+60))A.ocupado[Y*W+X]=1;}
  }
  F.arte.din.rayo=function(c,e,t){
    const T0=5.2,a=((t+e.fase*T0)%T0+T0)%T0;
    const on=(a<.12)||(a>.22&&a<.31)||(a>2.6&&a<2.68)||(a>2.78&&a<2.84)||(a>4.1&&a<4.2)||(a>4.3&&a<4.34);
    if(!on)return;
    const p=e.p;
    c.globalAlpha=.34;c.fillStyle='#e8e4ff';c.fillRect(e.cx-60,e.cy-16,120,34);                       // la nube entera se enciende
    c.globalAlpha=.22;c.fillStyle='#bcd2ff';c.fillRect(e.x-22,e.y+4,44,e.ty-e.y+14);                    // aire cargado alrededor del rayo
    c.globalAlpha=.34;c.fillStyle='#9cc0ff';c.fillRect(e.tx-18,e.ty+1,36,9);                            // destello en el lago
    c.globalAlpha=.5;c.fillStyle='#6a9cff';for(let i=0;i<p.length;i+=2){c.fillRect(p[i]-3,p[i+1],1,1);c.fillRect(p[i]+4,p[i+1],1,1);}
    c.globalAlpha=.85;c.fillStyle='#a8c8ff';for(let i=0;i<p.length;i+=2){c.fillRect(p[i]-2,p[i+1],1,1);c.fillRect(p[i]+3,p[i+1],1,1);}
    c.globalAlpha=1;c.fillStyle='#ffffff';for(let i=0;i<p.length;i+=2)c.fillRect(p[i],p[i+1],2,1);
    c.fillStyle='#cfe0ff';const b=e.b;for(let i=0;i<b.length;i+=2)c.fillRect(b[i],b[i+1],2,1);
    c.globalAlpha=.9;c.fillStyle='#ffffff';c.fillRect(e.tx-6,e.ty+2,14,2);c.fillRect(e.tx-2,e.ty,6,2);
    c.globalAlpha=1;};

  /* ═════════ 3. RÍOS (máscara + pasada de sombreado) ═════════ */
  const cerca2=new Uint8Array(W*H);
  A.nodos.forEach(n=>{const r=11;for(let y=Math.max(0,Math.floor(n.y-r));y<=Math.min(H-1,Math.ceil(n.y+r));y++)for(let x=Math.max(0,Math.floor(n.x-r));x<=Math.min(W-1,Math.ceil(n.x+r));x++)
    if((x-n.x)*(x-n.x)+(y-n.y)*(y-n.y)<=r*r)cerca2[y*W+x]=1;});
  const wide=new Uint8Array(W*H),wm=new Uint8Array(W*H),wd=new Uint8Array(W*H),wh=new Uint8Array(W*H),fm=new Uint8Array(W*H),rf=new Uint8Array(W*H),lista=[];
  let ORI=[];
  function trazado(ptsD,hw0,hw1,amp,lam,seed,snap){
    const P=ptsD.map(p=>[A.dx(p[0]),A.dy(p[1])]);
    if(snap&&ORI.length){let b=1e12,bp=null;const q=P[P.length-1];for(let i=0;i<ORI.length;i++){const d=(ORI[i].x-q[0])*(ORI[i].x-q[0])+(ORI[i].y-q[1])*(ORI[i].y-q[1]);if(d<b){b=d;bp=ORI[i];}}if(bp)P.push([bp.x,bp.y]);}
    const out=[],n=P.length;
    for(let i=0;i<n-1;i++){const p0=P[Math.max(i-1,0)],p1=P[i],p2=P[i+1],p3=P[Math.min(i+2,n-1)],L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),st=Math.max(1,Math.ceil(L/2));
      for(let s=0;s<st;s++){const t=s/st,t2=t*t,t3=t2*t;
        out.push([.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
                  .5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)]);}}
    out.push(P[n-1]);
    let S=0;const ar=[0];for(let i=1;i<out.length;i++){S+=Math.hypot(out[i][0]-out[i-1][0],out[i][1]-out[i-1][1]);ar.push(S);}
    const res=[],ph=seed*1.7;
    for(let i=0;i<out.length;i++){const a=out[Math.max(0,i-3)],b=out[Math.min(out.length-1,i+3)];let tx=b[0]-a[0],ty=b[1]-a[1];const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;
      const nx=-ty,ny=tx,s=ar[i],env=Math.min(1,s/35,(S-s)/(snap?7:35));
      const am=amp*(.65+.7*A.vn(s/230,9,seed));
      const off=(.8*Math.sin(s/lam*6.2832+ph)+(A.vn(s/(lam*.55),0,seed+5)-.5)*1.3)*am*env,u=s/S;
      let hw=hw0+(hw1-hw0)*Math.pow(u,snap===undefined&&hw1>8?.8:1.1);
      if(hw1>=2){const fv=1+(A.vn(s/(hw1>8?55:38),4,seed+9)-.5)*(hw1>8?1.1:1.35);hw*=fv;if(snap!==0)hw*=.5+.5*Math.min(1,s/(hw1>8?90:55));}
      res.push({x:out[i][0]+nx*off,y:out[i][1]+ny*off,hw:Math.max(.5,hw),nx:nx,ny:ny,tx:tx,ty:ty,u:u});}
    return res;}
  function dibuja(pts,rapidos,kind){
    const ok=(X,Y)=>X>=0&&Y>=0&&X<W&&Y<H&&T[Y*W+X]===1;
    const sub=[];
    for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],d=Math.hypot(b.x-a.x,b.y-a.y),st=Math.max(1,Math.ceil(d/Math.max(.5,Math.min(1.1,a.hw*.45))));
      for(let s=0;s<st;s++){const t=s/st;sub.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,hw:a.hw+(b.hw-a.hw)*t});}}
    sub.push(pts[pts.length-1]);
    sub.forEach(p=>{const r=p.hw,x0=Math.floor(p.x-r-1),x1=Math.ceil(p.x+r+1),y0=Math.floor(p.y-r-1),y1=Math.ceil(p.y+r+1);
      for(let Y=y0;Y<=y1;Y++)for(let X=x0;X<=x1;X++){const dx=X-p.x,dy=Y-p.y,d2=dx*dx+dy*dy;if(d2>r*r+.3||!ok(X,Y))continue;if(cerca2[Y*W+X]&&d2>Math.min(r,2.2)*Math.min(r,2.2)*.8)continue;
        const q=Y*W+X,dd=Math.max(0,Math.round(255*(1-Math.sqrt(d2)/Math.max(.6,r))));
        if(!wm[q]){wm[q]=kind?2:1;lista.push(q);}
        if(dd>wd[q])wd[q]=dd;const h=Math.min(255,Math.round(p.hw*20));if(h>wh[q])wh[q]=h;if(p.hw>=3)wide[q]=1;}});
    // espuma en las curvas cerradas (orilla exterior)
    for(let i=8;i<pts.length-8;i+=2){const p=pts[i],a=pts[i-6],b=pts[i+6],cr=a.tx*b.ty-a.ty*b.tx;if(Math.abs(cr)<.42||p.hw<1.4)continue;const sg=cr>0?-1:1;
      for(let k=-2;k<=2;k++){const X=Math.round(p.x+p.nx*sg*(p.hw-.6)+p.tx*k),Y=Math.round(p.y+p.ny*sg*(p.hw-.6)+p.ty*k);if(ok(X,Y)&&wm[Y*W+X]&&(k+i)%2===0)fm[Y*W+X]=1;}}
    // reflejos alargados en el sentido de la corriente
    for(let i=4;i<pts.length-4;i+=3){const p=pts[i];if(p.hw<1.2||A.hash(i,pts.length,7)<.55)continue;
      const o=(A.hash(i,2,8)-.5)*p.hw*1.2,w=p.hw>=3?3:1;
      for(let k=0;k<=w;k++){const X=Math.round(p.x+p.nx*o+p.tx*k),Y=Math.round(p.y+p.ny*o+p.ty*k);if(ok(X,Y))rf[Y*W+X]=1;}
      if(p.hw>3&&brillos.length<260&&A.hash(i,3,2)>.8)brillos.push([Math.round(p.x+p.nx*o),Math.round(p.y+p.ny*o),1]);}
    (rapidos||[]).forEach(function(u){const i=Math.min(pts.length-3,Math.floor(u*pts.length)),p0=pts[i];
      for(let k=0;k<4;k++){const q=pts[Math.min(pts.length-1,i+k*2)],h=q.hw+1;
        for(let s=-h;s<=h;s+=.6){const X=Math.round(q.x+q.nx*s+q.tx*((s*3)%2)),Y=Math.round(q.y+q.ny*s+q.ty*((s*3)%2));if(ok(X,Y)&&wm[Y*W+X])fm[Y*W+X]=1;}}
      if(brillos.length<260)brillos.push([Math.round(p0.x),Math.round(p0.y),2]);});
  }
  function pintaRios(){
    const bk=new Uint8Array(W*H),bk2=new Uint8Array(W*H),bh=new Uint8Array(W*H),bd=new Uint8Array(W*H),bl=[];
    const wmq=q=>wm[q]!==0;
    for(let k=0;k<lista.length;k++){const q=lista[k],X=q%W,Y=(q-X)/W,d=wd[q]/255,delta=wm[q]===2;
      let c=delta?mz(mz(PAL.manglarClaro,'#c4b2ff',(1-d)*.55),PAL.manglarAgua,Math.max(0,d-.55)*.9):mz(PAL.rio,PAL.lago,Math.min(1,d*.55+(wh[q]>60?.2:0)));
      if(wh[q]>60&&d>.55)c=mz(c,PAL.lago,.25);
      const nN=wmq(q-W),nW=wmq(q-1),nS=wmq(q+W),nE=wmq(q+1);
      if(!nN||!nW)c=mz(c,PAL.rioClaro,.38);
      if(!nS||!nE)c=A.sombrea(c,wh[q]>40?.26:.2);
      if(rf[q])c=A.aclara(c,.55);
      else if((wh[q]>60||delta)&&A.hash(X,Y,41)>(delta?.97:.975))c=delta?'#e4d8ff':A.aclara(c,.6);
      if(fm[q])c=(!nS||!nE)?PAL.rioClaro:PAL.espuma;
      A.px(X,Y,c);
      // orillas
      const nb=[[q-W,1],[q-1,2],[q+W,4],[q+1,8]];
      for(let j=0;j<4;j++){const nq=nb[j][0];if(nq<0||nq>=W*H||wm[nq]||T[nq]!==1)continue;if(!bk[nq])bl.push(nq);bk[nq]|=nb[j][1];if(wh[q]>bh[nq])bh[nq]=wh[q];if(wm[q]===2)bd[nq]=1;}}
    // ribera verde: anillo 1 (junto al agua) con luz/sombra, anillos 2 y 3 (ríos anchos) más suaves
    for(let k=0;k<bl.length;k++){const q=bl[k],X=q%W,Y=(q-X)/W,b=bk[q],g=A.get(X,Y);let c;
      if(bd[q])c=(b&12)?mz(g,PAL.manglarOscuro,.62):mz(g,'#5aa04a',.5);
      else if(b&12)c=mz(g,PAL.selvaOscura,.5);
      else{c=mz(g,PAL.selvaLuz,.8);if(A.hash(X,Y,31)>.45)c=mz(c,PAL.pastoClaro,.55);}
      A.px(X,Y,c);}
    let fr=bl;
    for(let ring=2;ring<=3;ring++){const nx2=[];
      for(let k=0;k<fr.length;k++){const q=fr[k];if(bh[q]<(ring===2?26:90))continue;
        [q-W,q-1,q+W,q+1].forEach(function(q2){if(q2<0||q2>=W*H||wm[q2]||bk[q2]||T[q2]!==1||cerca2[q2]||bk2[q2])return;bk2[q2]=(bk[q]&12)?2:1;bh[q2]=bh[q];bd[q2]=bd[q];nx2.push(q2);});}
      for(let k=0;k<nx2.length;k++){const q2=nx2[k],X=q2%W,Y=(q2-X)/W;if(ring===3&&A.hash(X,Y,33)<.4)continue;const g=A.get(X,Y);
        A.px(X,Y,bd[q2]?mz(g,bk2[q2]===2?PAL.manglarOscuro:'#4a9a44',.34):bk2[q2]===2?mz(g,PAL.selvaMedia,ring===2?.5:.3):mz(g,PAL.selva,ring===2?.55:.35));}
      nx2.forEach(q2=>{bk[q2]=bk[q2]||(bk2[q2]===2?4:1);});fr=nx2;}
  }
  function hacerRios(){
  const orinoco=trazado([[560,960],[520,800],[470,620],[480,520],[560,440],[640,420],[700,405],[790,390],[860,360],[905,335]],4,11,22,130,17);
  ORI=orinoco;
  const rios=[
    {p:[[165,470],[230,505],[320,490],[430,470],[520,455]],h:[1.8,4.8],a:20,l:95,s:23,snap:1,r:[.08,.5]},                      // Apure
    {p:[[735,630],[720,560],[720,470],[790,395]],h:[1.6,4.6],a:18,l:85,s:29,snap:1,r:[.1,.45,.7],c:[.22,.4]},                            // Caroní
    {p:[[225,395],[270,415],[330,430],[385,450],[430,470]],h:[1.4,3.6],a:18,l:80,s:41,snap:1,r:[.06]},                       // Portuguesa
    {p:[[390,300],[420,360],[455,400],[490,430],[520,455]],h:[1.4,3.6],a:18,l:85,s:43,snap:1},                              // Guárico
    {p:[[680,605],[650,560],[610,520],[570,470],[560,440]],h:[1.2,3],a:16,l:75,s:47,snap:1,r:[.5],c:[.25,.6]},                        // Caura
    {p:[[900,620],[860,570],[820,520],[790,430]],h:[1.2,3.2],a:16,l:80,s:53,snap:1,c:[.2,.55]},                                         // Cuyuní
    {p:[[650,810],[610,740],[560,680],[500,630],[470,610]],h:[1.2,3],a:16,l:85,s:59,snap:1,c:[.3,.62]},                               // Ventuari
    {p:[[700,760],[690,700],[715,650],[725,600]],h:[.7,1.8],a:12,l:75,s:61,snap:1,c:[.45]},
    {p:[[855,700],[820,650],[780,610],[740,575]],h:[.7,1.8],a:12,l:75,s:67,snap:1,c:[.4]},
    {p:[[430,830],[450,760],[440,700],[470,650]],h:[.7,1.8],a:12,l:80,s:97,snap:1,c:[.5]},
    {p:[[600,830],[560,780],[530,720],[500,640]],h:[.7,1.8],a:12,l:70,s:101,snap:1,c:[.5]},
    {p:[[510,300],[498,255],[490,215]],h:[1.2,3],a:14,l:65,s:71,r:[.1]},                                                      // Tuy
    {p:[[650,330],[640,285],[625,235]],h:[1.2,2.8],a:13,l:60,s:73},
    {p:[[330,350],[305,270],[292,200]],h:[1.2,2.8],a:14,l:65,s:79},                                                              // Yaracuy
    {p:[[120,430],[102,392],[110,362],[100,336]],h:[.7,1.8],a:10,l:60,s:83,r:[.1],c:[.45]},                                          // Andes → lago
    {p:[[170,445],[152,405],[142,368],[136,338]],h:[.7,1.8],a:10,l:60,s:89,r:[.12],c:[.4]}];
  // ramales finos (quebradas) que nacen en los ríos y se afinan hacia su fuente
  const ramales=[];
  [[.30,-1,50,13],[.42,1,56,17],[.52,-1,46,19],[.62,1,60,23],[.72,-1,50,29],[.82,1,44,31],[.9,-1,40,37]].forEach(function(b,k){const p=orinoco[Math.floor(b[0]*(orinoco.length-1))];if(!p)return;
    const sx=p.x/2,sy=p.y/1.5,L=b[2],dx=p.nx*b[1]/2,dy=p.ny*b[1]/1.5,m=Math.hypot(dx,dy)||1;
    ramales.push({p:[[sx+dx/m*L,sy+dy/m*L*.9+8],[sx+dx/m*L*.55,sy+dy/m*L*.5+3],[sx,sy]],h:[.5,1.7],a:9,l:50,s:200+b[3],snap:1});});
  rios.concat(ramales).forEach((r,ri)=>{const pts=trazado(r.p,r.h[0],r.h[1],r.a*(ri>=6&&ri<=10?1.45:1.12),r.l,r.s,r.snap);r.pts=pts;dibuja(pts,r.r,0);});
  dibuja(orinoco,[.2,.5,.62],0);
  // caños del delta: abanico entrelazado desde la desembocadura, con canales de enlace
  [[[905,335],[935,345],[968,365],[1000,395]],[[905,335],[940,325],[975,328],[1005,318]],[[905,335],[925,310],[950,290],[985,268]],
   [[905,335],[920,355],[935,385],[975,420]],[[905,335],[925,330],[945,305],[975,300],[1005,296]],[[900,340],[915,375],[930,420],[950,450]],
   [[925,312],[945,322],[962,345],[980,352]],[[940,327],[955,305],[970,285],[990,262]],[[935,345],[942,372],[958,400],[985,432]],
   [[920,355],[912,395],[920,440],[940,478]],[[915,375],[945,392],[970,396],[1000,405]],[[930,420],[955,432],[975,455],[1000,470]],
   [[945,305],[958,318],[975,320],[1000,330]],[[950,290],[935,275],[925,262],[920,250]]].forEach(function(p,k){
    dibuja(trazado(p,k<6?4.4:3,Math.max(3,k<6?6.4-k*.4:4-(k-6)*.12),9,48,300+k*11,0),null,1);});
  pintaRios();
  cascadas(rios);
  }
  // cascadas pequeñas: lecho de roca, hilo blanco escalonado y bruma de lóbulos al pie
  function cascadas(rios){
    const lobes=(x,y,rx,seed)=>{const r=A.rng(seed);for(let k=0;k<7;k++){const ox=Math.round((r()-.5)*rx*2),oy=-Math.round(r()*rx*.7),rr=rx*(.38+r()*.3);
      A.ell(x+ox,y+oy,rr,rr*.62,'#ffffff',.42);A.ell(x+ox-1,y+oy-1,rr*.7,rr*.42,'#ffffff',.4);}};
    let n=0;
    rios.forEach(function(r){if(!r.c||!r.pts)return;r.c.forEach(function(u){const pts=r.pts,p=pts[Math.min(pts.length-2,Math.floor(u*pts.length))];if(!p||p.hw<1)return;
      const X=Math.round(p.x),Y=Math.round(p.y);if(T[Y*W+X]!==1||cerca[Y*W+X])return;
      const hw=Math.max(2,Math.round(p.hw)),h=6+(n%3)*2,sd=500+n*13;n++;
      for(let i=-hw-2;i<=hw+2;i++){A.px(X+i,Y-1,'#4a4640');A.px(X+i,Y,Math.abs(i)>hw?'#2e2a26':'#6a645c');}      // borde de roca
      for(let j=1;j<=h;j++){const dd=j%4===0?1:0;A.px(X-hw-1+dd,Y+j,'#3a6aa0');A.px(X+hw+1-dd,Y+j,'#3a6aa0');
        for(let i=-hw;i<=hw;i++){const l=(i+j*2+X)%5<2;A.px(X+i,Y+j,l?'#ffffff':(i<0?'#d8f0ff':'#9ad0f4'));}}
      for(let i=-hw-2;i<=hw+2;i++){A.px(X+i,Y+h+1,'#bfe4ff');if(A.hash(X+i,Y,52)>.4)A.px(X+i,Y+h+2,'#ffffff');}
      lobes(X,Y+h+2,hw+7,sd);
      brillos.push([X,Y+h,2]);});});
  }



  /* ═════════ 4. DELTA DEL ORINOCO ═════════ */
  (function delta(){
    let x0=W,x1=0,y0=H,y1=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(A.bioma[y*W+x]===BIO.manglar&&T[y*W+x]===1){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    if(x1<=x0)return;
    const agua=new Uint8Array(W*H),c1=A.campo(34,611,3,4),c2=A.campo(70,613,3,4),c3=A.campo(8,617,2,2);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const q=y*W+x;if(A.bioma[q]!==BIO.manglar||T[q]!==1)continue;
      const dc=1-Math.min(1,Math.max(0,A.dist[q]/3)/70),rid=Math.abs(c1(x,y)-.5);
      if(rid<.12+.12*dc||c2(x,y)>.49-.12*dc)agua[q]=1;
      if(A.ocupado[q]||cerca[q])agua[q]=0;}
    // lagunas despejadas para la puerta (21x33) y la arepa (33x21): busca el mejor sitio de manglar
    function sitio(rx,ry,x0,y0,x1,y1,evita){let best=-1,bp=null;
      for(let y=Math.round(A.dy(y0));y<=A.dy(y1);y+=4)for(let x=Math.round(A.dx(x0));x<=A.dx(x1);x+=4){
        let n=0,m=0,bad=0;for(let j=-ry;j<=ry;j+=3)for(let i=-rx;i<=rx;i+=3){if((i/rx)*(i/rx)+(j/ry)*(j/ry)>1)continue;const q=(y+j)*W+x+i;m++;
          if(T[q]===1&&A.bioma[q]===BIO.manglar)n++;if(cerca[q])bad++;}
        if(!m||bad||n/m<.8)continue;let sc=n/m-.0004*Math.hypot(x-A.dx((x0+x1)/2),y-A.dy((y0+y1)/2));
        if(evita&&Math.hypot((x-evita[0])/1.2,y-evita[1])<rx+ry+10)continue;
        if(sc>best){best=sc;bp=[x,y];}}
      return bp;}
    PUERTA=sitio(28,34,872,372,960,470)||[Math.round(A.dx(930)),Math.round(A.dy(400))];
    AREPA=sitio(40,24,886,385,950,500,PUERTA)||[Math.round(A.dx(900)),Math.round(A.dy(445))];
    [[PUERTA[0],PUERTA[1],28,34],[AREPA[0],AREPA[1],40,24]].forEach(z=>{for(let y=z[1]-z[3]-3;y<=z[1]+z[3]+3;y++)for(let x=z[0]-z[2]-3;x<=z[0]+z[2]+3;x++){const u=(x-z[0])/z[2],v=(y-z[1])/z[3],
      e=u*u+v*v+(A.vn(x/5,y/5,621)-.5)*.35;
      if(e<=1&&T[y*W+x]===1&&!cerca[y*W+x]){agua[y*W+x]=1;}
      if(e<=1.35&&x>=0&&y>=0&&x<W&&y<H)A.ocupado[y*W+x]=1;}});
    const AG=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&agua[y*W+x]===1;
    const bw2=x1-x0+1,bh2=y1-y0+1,dwIn=new Uint8Array(bw2*bh2);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)dwIn[(y-y0)*bw2+x-x0]=agua[y*W+x];
    const dwA=chamfer(bw2,bh2,dwIn);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const q=y*W+x;if(A.bioma[q]!==BIO.manglar||T[q]!==1)continue;
      if(agua[q]){
        const dc=Math.max(0,A.dist[q]/3),dw=dwA[(y-y0)*bw2+(x-x0)]/3,co=1-Math.min(1,dc/70);
        const nn=A.vn(x/23,y/9,631)*.6+A.vn(x/7,y/3,632)*.4;
        // degradado: violeta profundo tierra adentro -> lila claro hacia la costa
        let v=cl(.06+.62*co+(nn-.5)*.6+Math.min(dw,5)*.03,0,1);
        let c=v<.5?mz(PAL.manglarOscuro,PAL.manglarAgua,v*2):mz(PAL.manglarAgua,PAL.manglarClaro,(v-.5)*2*.9);
        // bandas horizontales de reflejo que se rompen con ruido
        const bn=A.vn(x/15,y/1.7,633),bl=A.vn(x/46,y/2.5,634);
        if(dw>1.5){
          if(bl>.6&&y%4===0)c=mz(c,'#d6c8ff',.6);
          else if(bn>.64&&(y&1)===0)c=mz(c,'#b8a2f4',.55);
          else if(bn<.3&&y%3===1&&bl<.4)c=mz(c,PAL.manglarOscuro,.3);}
        // orilla de manglar oscuro en los canales
        if(dw<=1.4)c=mz(c,PAL.manglarOscuro,.7);
        else if(dw<=2.6)c=mz(c,PAL.manglarOscuro,.3);
        if(!AG(x,y-1)||!AG(x,y-2))c=PAL.manglarOscuro;
        // lodo/arena hacia el mar
        if(dc<6)c=mz(c,'#b49cc4',(1-dc/6)*.55);
        if(c!==PAL.manglarOscuro&&AG(x-1,y)&&AG(x+1,y)&&A.hash(x>>1,y>>1,15)>.985){A.px(x,y,'#e6dcff');A.px(x+1,y,'#cdbcff');continue;}
        A.px(x,y,c);
        if(A.hash(x,y,12)>.99&&brillos.length<260)brillos.push([x,y,3]);
      }else{
        let c=c3(x,y)>.55?mz(PAL.manglar,PAL.selvaLuz,.35):mz(PAL.manglar,PAL.selvaMedia,.35);
        if(!AG(x-1,y)&&!AG(x,y-1)&&!AG(x-1,y-1)){}else{
          if(AG(x,y-1)||AG(x-1,y))c=mz(c,PAL.selvaLuz,.5);
          if(AG(x,y+1)||AG(x+1,y))c=mz(c,PAL.manglarOscuro,.45);}
        if(AG(x-1,y)&&AG(x+1,y)&&AG(x,y-1)&&AG(x,y+1))c=PAL.manglarOscuro;
        // raíces: pie de la isla más oscuro
        if(AG(x,y+2)&&!AG(x,y+1))c=A.sombrea(PAL.manglar,.35);
        A.px(x,y,c);}}
    // neblina
    [[880,300,40,12,.4],[935,335,36,11,.38],[955,262,34,11,.4],[895,272,28,8,.32],[915,345,30,9,.34],[965,300,30,10,.36],[900,400,34,10,.34],[960,430,36,11,.36],[925,470,32,9,.32],[985,370,28,9,.34],[990,460,26,9,.3]].forEach(function(b,k){const cx=A.dx(b[0]),cy=A.dy(b[1]),rx=b[2],ry=b[3];
      for(let j=-ry-2;j<=ry+2;j++)for(let i=-rx-2;i<=rx+2;i++){const X=Math.round(cx+i),Y=Math.round(cy+j);if(X<0||Y<0||X>=W||Y>=H||T[Y*W+X]===0||cerca[Y*W+X]||A.ocupado[Y*W+X])continue;
        const u=i/rx,v=j/ry,e=1-(u*u+v*v)+(A.vn(X/5,Y/4,700+k)-.5)*.7;if(e>0)A.pxa(X,Y,'#f4f0ff',Math.min(.5,e*b[4]*2.2));}});
  })();

  hacerRios();
  tormenta();
  /* ═════════ 4b. PUERTA y AREPA flotantes (1.5x) sobre agua morada despejada ═════════ */
  (function flotantes(){
    if(!PUERTA||!AREPA)return;
    const ring=(cx,cy,rx,ry,c,a)=>{for(let k=0;k<=36;k++){const an=k*.1745;if((k&1)&&k%3===0)continue;A.pxa(Math.round(cx+Math.cos(an)*rx),Math.round(cy+Math.sin(an)*ry),c,a);}};
    // puerta 21x33
    const PX=PUERTA[0],PY=PUERTA[1],x=PX-10,y=PY-17;
    A.ell(PX+3,y+33,17,5,PAL.manglarOscuro,.75);ring(PX,y+33,19,6,'#e4d8ff',.8);ring(PX+1,y+34,25,8,'#c9b8ff',.5);
    A.rect(x,y,21,33,'#3d2210');A.rect(x+1,y+1,19,31,'#c89048');A.rect(x+2,y+2,17,30,'#8a5326');
    A.rect(x+2,y+2,3,30,'#b57438');A.rect(x+16,y+2,3,30,'#62371a');A.rect(x+1,y+1,19,1,'#e0b068');
    [[4,5],[4,19]].forEach(function(q){const px=x+q[0],py=y+q[1];A.rect(px,py,13,11,'#6c3f1c');A.rect(px,py,13,1,'#4a2a12');A.rect(px,py,1,11,'#4a2a12');A.rect(px+1,py+10,12,1,'#a56a30');A.rect(px+12,py+1,1,10,'#9a6430');});
    A.rect(x+14,y+16,3,3,'#f0d060');A.px(x+14,y+16,'#fff3a0');A.px(x+16,y+18,'#a8801c');
    for(let j=27;j<33;j++)for(let i=0;i<21;i++)A.pxa(x+i,y+j,PAL.manglarAgua,.3+.12*(j-27));
    for(let i=-4;i<25;i++)A.px(x+i,y+32,(i&1)?'#d8c8ff':PAL.manglarClaro);
    A.rect(x-5,y+34,9,1,'#e4d8ff');A.rect(x+13,y+35,11,1,'#e4d8ff');
    // arepa 33x21
    const AX=AREPA[0],AY=AREPA[1];
    A.ell(AX+4,AY+10,22,6,PAL.manglarOscuro,.75);ring(AX,AY+11,26,8,'#e4d8ff',.8);ring(AX+2,AY+12,34,11,'#c9b8ff',.5);
    A.ell(AX,AY,17,11,'#7a4a18');A.ell(AX,AY,16,10,'#b87a2c');A.ell(AX,AY-.7,14,8.5,'#e8b04a');
    A.ell(AX-3,AY-3,8,3.6,'#f6d57a');A.px(AX-6,AY-3,'#fff0b0');A.px(AX-5,AY-4,'#fff0b0');A.px(AX-4,AY-4,'#fff0b0');
    for(let k=0;k<9;k++)A.px(AX-7+k*2+(k%2),AY+1+(k%3),'#c98a30');
    A.rect(AX-13,AY+6,27,1,'#c98a30');A.rect(AX-11,AY+7,23,1,'#9a5e20');
    for(let i=-17;i<=17;i++)if(i%3===0)A.px(AX+i,AY+12,PAL.manglarClaro);
    A.rect(AX-9,AY+13,15,1,'#e4d8ff');A.rect(AX+9,AY+14,8,1,'#d8c8ff');
    // vaho
    for(let k=0;k<3;k++)for(let j=0;j<7;j++)A.pxa(AX-6+k*6+Math.round(Math.sin(j*.9+k)*1.5),AY-15-j,'#ffffff',.45-j*.05);
    brillos.push([PX-12,PY+18,3],[AX+16,AY+8,3],[PX+14,PY+20,3]);
  })();
  /* ═════════ 5. LAGUNAS DEL LLANO Y EMBALSE DE GURI ═════════ */
  function charco(cx,cy,rx,ry,ang,seed,juncos,grande){
    const ca=Math.cos(ang),sa=Math.sin(ang),R=Math.max(rx,ry)*1.9;
    for(let Y=Math.floor(cy-R);Y<=Math.ceil(cy+R);Y++)for(let X=Math.floor(cx-R);X<=Math.ceil(cx+R);X++){if(X<0||Y<0||X>=W||Y>=H)continue;const q=Y*W+X;if(T[q]!==1)continue;
      const dx=X-cx,dy=Y-cy,u=(dx*ca+dy*sa)/rx,v=(-dx*sa+dy*ca)/ry,r2=u*u+v*v,n=(A.vn(X/5,Y/5,seed)-.5)*.55+(A.vn(X/2,Y/2,seed+2)-.5)*.12;
      if(r2>1.9)continue;const e=r2-n;
      if(e<1){if(cerca[q])continue;
        if(e>.8){A.px(X,Y,mz(PAL.rio,PAL.rioClaro,.8));
          if(juncos&&A.hash(X,Y,seed)<.22&&(dy<0||A.hash(X,Y,5)<.5)){A.px(X,Y-1,'#3f6a1e');A.px(X,Y-2,'#6f9a2a');}
        }else{let c=mz(PAL.rio,PAL.lago,cl((.8-e)*.9,0,.7));if(u+v<-.7)c=mz(c,PAL.rioClaro,.28);if(u+v>.9)c=A.sombrea(c,.15);
          if(A.hash(X,Y,seed+9)>.985){c=A.aclara(c,.55);if(brillos.length<260)brillos.push([X,Y,4]);}A.px(X,Y,c);}
      }else if(e<1.5&&!cerca[q]&&!A.ocupado[q]){const b=A.bioma[q];if(b===BIO.llano||b===BIO.selva||b===BIO.sabana)A.px(X,Y,mz(A.get(X,Y),PAL.pastoOscuro,.4*(1.5-e)*2));}}}
  [[338,462,30,11,.08],[372,505,12,4,-.1],[372,452,11,4,.2],[246,438,10,4,.4],[412,492,13,5,-.2],[355,430,8,3,0],[460,420,9,3,.3],[268,470,8,3,.1]].forEach(function(l,k){
    charco(A.dx(l[0]),A.dy(l[1]),l[2],l[3],l[4],800+k*7,true);});
  // laguna llanera grande + esteros + madreviejas
  charco(A.dx(392),A.dy(398),40,15,.1,950,true);
  charco(A.dx(440),A.dy(372),16,6,-.2,957,true);
  charco(A.dx(350),A.dy(372),14,5,.3,963,true);
  [[220,452,18,5],[270,520,16,5],[450,430,15,5],[330,395,12,4]].forEach(function(l,k){charco(A.dx(l[0]),A.dy(l[1]),l[2],l[3],.05*k,970+k*5,true);});
  [.46,.56,.66,.74].forEach(function(u,k){const p=ORI[Math.floor(u*ORI.length)];if(!p)return;const sg=k%2?1:-1,o=p.hw+9;
    charco(p.x+p.nx*o*sg,p.y+p.ny*o*sg,7+k%2*3,3,Math.atan2(p.ty,p.tx),990+k*3,true);});
  // chigüires (7x4) en la orilla de la laguna grande
  function chiguire(x,y,f){const O='#3a2410',B='#8a5a2c',L='#b07c40',D='#5e3a1a';
    A.rect(x-3,y-1,7,3,O);A.rect(x-2,y-1,5,2,B);A.rect(x-2,y-1,5,1,L);A.rect(x+f*3,y-1,2,2,D);A.px(x+f*3+(f>0?1:0),y-1,'#1a0c04');A.px(x-2,y+2,O);A.px(x+1,y+2,O);A.px(x+3,y+2,O);A.pxa(x,y+3,PAL.sombra,.4);}
  [[-38,11,1],[-14,18,-1],[10,17,1],[30,10,-1]].forEach(function(c){chiguire(Math.round(A.dx(392)+c[0]),Math.round(A.dy(398)+c[1]),c[2]);});
  [[-24,15,1],[-6,19,-1],[12,16,1]].forEach(function(c){chiguire(Math.round(A.dx(338)+c[0]),Math.round(A.dy(462)+c[1]),c[2]);});
  A.px(Math.round(A.dx(392))+4,Math.round(A.dy(398))+1,'#5e3a1a');A.px(Math.round(A.dx(392))+5,Math.round(A.dy(398))+1,'#8a5a2c');   // cabeza asomando
  // Guri
  [[1398,736,34,7,.5,0],[1378,722,12,5,-.6,1],[1418,754,11,4,.2,2],[1366,746,10,4,.9,3],[1432,764,9,3,.1,4],[1392,708,9,3,-.4,5]].forEach(function(g){
    charco(g[0],g[1],g[2],g[3],g[4],900+g[5]*5,false,true);});

  /* ═════════ brillos animados ═════════ */
  const ent=[];for(let i=0;i<brillos.length&&ent.length<40;i+=Math.max(1,Math.floor(brillos.length/40))){const b=brillos[i];ent.push(b);}
  ent.forEach((b,i)=>A.dyn.push({k:'brillo2',x:b[0],y:b[1],f:i*1.7+rn()*6,g:b[2]===1||b[2]===2?1:0}));
  F.arte.din.brillo2=function(c,e,t){const v=Math.sin(t*2.1+e.f);if(v<.86)return;c.fillStyle='#e6fbff';c.fillRect(e.x,e.y,1,1);if(v>.96){c.fillStyle='#ffffff';c.fillRect(e.x+1,e.y,1,1);c.fillRect(e.x-1,e.y,1,1);}};
});
})(typeof window!=='undefined'?window:globalThis);
