// LA FIESTA · arte del mapa: capa «vegetacion» (orden 50). Selva de copas, llanos con palmas y bosque de galería, cactus, pinos y frailejones,
// cocoteras, manglar con raíces zancudas, sabana, y fauna (vacas, chigüires, caballos, garzas y flamencos). Pintor: todo ordenado por y.
(function(root){'use strict';const F=root.FIESTA=root.FIESTA||{};
if(typeof module!=='undefined'&&typeof require!=='undefined'&&!F.arte)require('./fiesta-mapa-arte.js');
if(!F.arte)return;
F.arte.capa('vegetacion',50,function(A){
  const W=A.W,H=A.H,B=A.BIO,PAL=A.PAL,buf=A.buf,tierra=A.tierra,bioma=A.bioma,ocu=A.ocupado,hash=A.hash,rgb=A.rgb;
  const C={};Object.keys(PAL).forEach(k=>{C[k]=rgb(PAL[k]);});
  const sh=(c,k)=>A.sombrea(c,k),lt=(c,k)=>A.aclara(c,k);
  const put=(x,y,c)=>{if(x>=0&&y>=0&&x<W&&y<H)buf[y*W+x]=typeof c==='number'?c:rgb(c);};
  // píxel ya pintado que NO admite vegetación: agua azul, nieve, roca gris, acantilado
  function malo(x,y){x=x|0;y=y|0;if(x<0||y<0||x>=W||y>=H)return true;const c=buf[y*W+x];if(!c)return false;
    const r=c&255,g=(c>>8)&255,b=(c>>16)&255,mx=Math.max(r,g,b),mn=Math.min(r,g,b);
    if(b>r+25&&b>=g-12)return true;                 // agua
    if(mn>196)return true;                          // nieve / nube / espuma
    if(mx-mn<30&&mx>70)return true;                 // roca gris
    if(r-g>=60&&g-b>=28)return true;                // acantilado
    if(r<175&&r-b>40&&r-b<100&&r-g>18&&r-g<46)return true; // roca parda
    return false;}
  const azul=(x,y)=>{x=x|0;y=y|0;if(x<0||y<0||x>=W||y>=H)return false;const c=buf[y*W+x];if(!c)return false;const r=c&255,g=(c>>8)&255,b=(c>>16)&255;return b>r+40&&b>g-6;};
  function anillo(x,y,r){const q=(r*.7)|0;return azul(x+r,y)||azul(x-r,y)||azul(x,y+r)||azul(x,y-r)||azul(x+q,y+q)||azul(x-q,y-q)||azul(x+q,y-q)||azul(x-q,y+q)||azul(x+(r>>1),y)||azul(x-(r>>1),y)||azul(x,y+(r>>1))||azul(x,y-(r>>1));}
  function ajusta(x,y,r){while(r>=3&&anillo(x,y,r+1))r--;return r;}
  function aire(x,y,r){if(ocu[(y|0)*W+(x|0)])return false;const q=r*.8|0;
    return !(ocu[((y-q)|0)*W+x|0]||ocu[((y+q)|0)*W+x|0]||ocu[(y|0)*W+(x-q)|0]||ocu[(y|0)*W+(x+q)|0]);}
  function sobreTierra(x,y,r){x=x|0;y=y|0;if(x<r||y<r||x>=W-r||y>=H-r)return false;
    return tierra[y*W+x]===1&&tierra[y*W+x-r]===1&&tierra[y*W+x+r]===1&&tierra[(y+r)*W+x]===1&&tierra[(y-r)*W+x]===1;}
  const items=[];
  const add=(y,x,k,s,r)=>items.push({y:y,x:x,k:k,s:s,r:r});

  /* ── sprites ── */
  // copa redonda con 3 tonos: luz arriba-izquierda, sombra abajo-derecha, contorno oscuro
  function copa(cx,cy,r,base,luz,som,con,seed,rim){
    const r2=r*r;
    for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){const d=i*i+j*j;if(d>r2+r*.4)continue;
      let c;
      if(d>(r-1)*(r-1)+1)c=(i+j>0.2*r||j>r*.55)?con:(rim&&i+j<-0.3*r)?rim:sh(base,.45);
      else{const dl=(i+r*.35)*(i+r*.35)+(j+r*.4)*(j+r*.4);
        if(dl<r2*.14)c=luz;else if(i+j>r*.45)c=som;else if(dl<r2*.5&&hash(cx+i,cy+j,seed)<.28)c=luz;else if(hash(cx+i,cy+j,seed+7)<.12)c=som;else c=base;}
      put(cx+i,cy+j,c);}}
  function sombraSuelo(cx,cy,rx,ry,c,a){for(let j=-ry;j<=ry;j++)for(let i=-rx;i<=rx;i++){if((i*i)/(rx*rx)+(j*j)/(ry*ry)>1)continue;
    const x=cx+i,y=cy+j;if(x<0||y<0||x>=W||y>=H||tierra[y*W+x]!==1)continue;if(!malo(x,y))buf[y*W+x]=A.mezcla(buf[y*W+x],c,a);}}
  function palma(x,y,h,seed,real){
    const lean=hash(x,y,seed)<.5?-1:1;
    for(let i=0;i<h;i++){const tx=x+((i*lean/(h*.6))|0);put(tx,y-i,i%2?PAL.roca:PAL.rocaSombra);}
    const tx=x+((h*lean/(h*.6))|0),ty=y-h;
    const D=[[-3,0],[-3,1],[-2,-1],[0,-2],[2,-1],[3,0],[3,1],[-1,1],[1,1]],n=real?9:7;
    for(let k=0;k<n;k++){const d=D[k],c=k%2?PAL.selva:PAL.selvaLuz;
      put(tx+(d[0]/3|0),ty+(d[1]/3|0)*1,c);put(tx+Math.round(d[0]*.66),ty+Math.round(d[1]*.66),c);put(tx+d[0],ty+d[1]+(Math.abs(d[0])>=3?1:0),k%2?PAL.selvaOscura:PAL.selva);}
    put(tx,ty,PAL.selvaOscura);put(tx,ty-1,PAL.selvaLuz);}
  function pino(x,y,h){
    const cL=lt(PAL.pino,.28),cM=PAL.pino,cD=sh(PAL.pino,.38),cO=sh(PAL.pino,.7);
    put(x,y,PAL.rocaSombra);put(x,y-1,PAL.rocaSombra);put(x+1,y-1,cO);
    for(let i=0;i<h;i++){const hw=1+((i/4)|0)+(i%4===3?1:0),yy=y-2-(h-1-i);
      for(let k=-hw;k<=hw;k++){let c=k<0?cL:k>0?cD:cM;if(k===hw||k===-hw)c=(k>0)?cO:cD;if(i%4===3&&Math.abs(k)===hw-0)c=cO;put(x+k,yy,c);}
      if(i%4===3){put(x-hw+1,yy,cM);put(x-hw+2,yy,cL);}}
    put(x,y-2-h,cL);put(x,y-3-h,cO);}
  function fraile(x,y){put(x,y,PAL.rocaSombra);put(x,y-1,'#8a7a4a'.length?A.rgb('#8a7a4a'):0);put(x,y-2,A.rgb('#8a7a4a'));
    put(x-1,y-3,A.rgb('#b8c890'));put(x,y-3,A.rgb('#d4dca8'));put(x+1,y-3,A.rgb('#9aae70'));put(x,y-4,A.rgb('#b8c890'));}
  // columnar con 2 brazos, 3 tonos y contorno; h ≈ 12-16
  function cactus(x,y,h,seed){const L=A.rgb('#78d860'),M=A.rgb('#3fa83c'),G=A.rgb('#22702a'),O=A.rgb('#10381a');
    const col=(cx,y0,len,w)=>{for(let i=0;i<len;i++){const yy=y0-i;put(cx-1,yy,O);put(cx+w,yy,O);for(let k=0;k<w;k++)put(cx+k,yy,k===0?L:(k===w-1?G:M));}
      for(let k=0;k<w;k++)put(cx+k,y0-len,O);};
    const l=((hash(x,y,seed)<.5)?1:0);
    // brazos (debajo del tronco: se pintan antes)
    const a1=y-((h*.38)|0),a2=y-((h*.62)|0);
    // brazo izquierdo
    for(let k=1;k<=4;k++){put(x-k,a1,k===4?G:M);put(x-k,a1-1,L);put(x-k,a1+1,O);}
    col(x-5,a1+1,l?7:5,2);
    // brazo derecho
    for(let k=1;k<=4;k++){put(x+2+k,a2,k===4?G:M);put(x+2+k,a2-1,L);put(x+2+k,a2+1,O);}
    col(x+6,a2+1,l?5:7,2);
    col(x,y,h,3);
    put(x+1,y-h-1,A.rgb('#e8486a'));put(x-5,a1-6,A.rgb('#f0c030'));
    put(x,y+1,A.rgb('#7a5030'));put(x+1,y+1,A.rgb('#7a5030'));put(x+2,y+1,A.rgb('#5a3a20'));}
  // roca rojiza del desierto (facetas)
  function rocaR(x,y,rx,ry,seed){const c1=A.rgb('#c8744a'),c2=A.rgb('#9a4e34'),c3=A.rgb('#6a3226'),cl=A.rgb('#e09a64'),o=A.rgb('#3e1c18');
    for(let j=-ry;j<=0;j++){const w=(rx*Math.sqrt(1-(j*j)/(ry*ry+.01)))|0;for(let i=-w;i<=w;i++){
      let c=(i===-w||i===w||j===-ry)?o:(i+j*1.4<-rx*.3)?cl:(i>rx*.2||(i+j)>rx*.5)?c3:(hash(x+i,y+j,seed)<.25?c2:c1);put(x+i,y+j,c);}}
    for(let i=-rx;i<=rx;i++)put(x+i,y+1,A.rgb('#8a5a3a'));}
  function seco(x,y,seed){const a=A.rgb('#d8aa50'),b=A.rgb('#a07a34'),d=A.rgb('#5e4420'),l=A.rgb('#f0d078');
    for(let i=-3;i<=3;i++)put(x+i,y,d);for(let i=-3;i<=3;i++)put(x+i,y-1,i<0?a:b);for(let i=-2;i<=2;i++)put(x+i,y-2,i<0?l:a);put(x-1,y-3,l);put(x,y-3,a);put(x+1,y-3,a);put(x+2,y-1,d);}
  function chumbera(x,y,seed){const L=A.rgb('#5db84a'),G=A.rgb('#2f7f2a');
    const pad=(cx,cy)=>{put(cx,cy,L);put(cx+1,cy,L);put(cx,cy-1,L);put(cx+1,cy-1,G);put(cx-1,cy,G);put(cx+2,cy,G);put(cx,cy+1,G);put(cx+1,cy+1,G);};
    pad(x,y);pad(x+2,y-3);if(hash(x,y,seed)<.6)pad(x-2,y-3);put(x+2,y-5,A.rgb('#e0446a'));}
  function arbusto(x,y,c1,c2){put(x,y,c2);put(x+1,y,c2);put(x-1,y,c2);put(x,y-1,c1);put(x-1,y-1,c2);put(x+1,y-1,c1);put(x,y-2,c1);}
  function mangle(x,y,r,seed){
    const RO=A.rgb('#d0684a'),RL=A.rgb('#e88a62'),RD=A.rgb('#7a2e2e'),RF=A.rgb('#4a2a7a');
    const base=y+r-2,L=r+4;
    // reflejo sobre el agua morada
    for(let j=0;j<=4;j++)for(let i=-r;i<=r;i++){if(i*i/(r*r)+j*j/16>1)continue;const px=x+i,py=base+L+j;if(px>=0&&py<H&&azulMor(px,py))buf[py*W+px]=A.mezcla(buf[py*W+px],'#1a1048',.5);}
    // raíces zancudas: arcos rojizos de 2 px de ancho, bien separados
    const n=3;
    for(let k=-n;k<=n;k++){if(k===0)continue;const ex=x+Math.round(k*(r+4)/n*.9)+((hash(x+k,y,seed)*3)|0)-1;
      for(let t=0;t<=L;t++){const u=t/L,px=x+Math.round((ex-x)*Math.sin(u*1.5)),py=base+t;
        put(px,py,t<2||k<0?RL:RO);if(t>1)put(px+1,py,RD);}
      put(ex,base+L+1,RF);}
    put(x,base,RD);for(let t=0;t<L;t++){put(x,base+t,RO);put(x+1,base+t,RD);}
    copa(x,y,r,PAL.manglar,A.rgb('#58b04c'),sh(PAL.manglar,.4),A.rgb('#10301a'),seed,A.rgb('#7acc62'));
    if(r>=7){const l2=A.rgb('#7acc62');put(x-2,y-r+3,l2);put(x-3,y-r+4,l2);put(x-1,y-r+3,l2);put(x+r*.3|0,y-r*.2|0,sh(PAL.manglar,.5));}}
  function azulMor(x,y){const c=buf[y*W+x];if(!c)return false;const r=c&255,g=(c>>8)&255,b=(c>>16)&255;return b>g+30&&r>g+10;}
  function bmp(x,y,rows,pal,flip){const w=rows[0].length;for(let j=0;j<rows.length;j++)for(let i=0;i<w;i++){const ch=rows[j][i];if(ch==='.')continue;const c=pal[ch];if(c)put(flip?x+w-1-i:x+i,y+j,c);}}
  const VW={w:A.rgb('#f6f4ec'),s:A.rgb('#b8bcc8'),n:A.rgb('#2a1c16'),p:A.rgb('#e8a0a0')},VB={w:A.rgb('#a85c30'),s:A.rgb('#6e3a1c'),n:A.rgb('#2a1c16'),p:A.rgb('#d89080')};
  const VR=['.nnnnn...','nwnwwwwnn','nwwwwwwwn','nsssssswp','.n.n..n.n'];
  function vaca(x,y,marron,flip){bmp(x,y,VR,marron?VB:VW,flip);}
  const CH={c:A.rgb('#a8784a'),l:A.rgb('#c89a64'),s:A.rgb('#6a4426'),n:A.rgb('#2e1c10')},CR=['.nnnnn..','nlllccnn','nccccccn','nssssssn','.n.n.n.n'];
  function chiguire(x,y,flip){bmp(x,y,CR,CH,flip);}
  function caballo(x,y,flip){const k=flip?-1:1,c=A.rgb('#5a3418'),l=A.rgb('#7a4a24'),n=A.rgb('#1c120c');
    for(let i=0;i<6;i++){put(x+i*k,y,l);put(x+i*k,y+1,c);}put(x+6*k,y-1,c);put(x+7*k,y-1,c);put(x+6*k,y,c);put(x+7*k,y,n);put(x+6*k,y-2,n);
    put(x-1*k,y,n);put(x-1*k,y+1,n);put(x,y+2,n);put(x+1*k,y+2,n);put(x+4*k,y+2,n);put(x+5*k,y+2,n);}
  function ave(x,y,rosa){const c=rosa?A.rgb('#f08aa8'):A.rgb('#f6f8fa'),d=rosa?A.rgb('#c8587a'):A.rgb('#b8c0cc'),p=rosa?A.rgb('#d8788a'):A.rgb('#2a2a30');
    put(x,y,c);put(x+1,y,c);put(x,y-1,c);put(x,y-2,c);put(x+1,y-3,rosa?A.rgb('#e8688a'):c);put(x+2,y-3,A.rgb('#e8a040'));put(x,y+1,p);put(x+1,y+1,d);}

  // sombra proyectada de una copa grande sobre el dosel vecino (abajo-derecha)
  function sombraCopa(cx,cy,r,a){const ox=Math.max(2,(r*.38)|0),oy=Math.max(2,(r*.34)|0),dk=A.rgb('#06240f'),r2=r*r;
    for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){if(i*i+j*j>r2)continue;if(i*i+j*j<(r-ox)*(r-ox)*.6&&(i<0||j<0))continue;
      const x=cx+i+ox,y=cy+j+oy;if(x<0||y<0||x>=W||y>=H||tierra[y*W+x]!==1)continue;const o=buf[y*W+x];if(!o||malo(x,y))continue;buf[y*W+x]=A.mezcla(o,dk,a);}}
  // palma emergente: tronco alto y corona de frondas largas con luz arriba-izquierda
  function palmaGrande(x,y,h,seed,sc,nt){sc=sc||1;nt=nt||11;
    const lean=hash(x,y,seed)<.5?-1:1,tr=A.rgb('#6a4a2a'),tl=A.rgb('#9a7448'),td=A.rgb('#3e2a18');
    for(let i=0;i<h;i++){const tx=x+((i*lean/(h*.55))|0);put(tx,y-i,tr);put(tx+1,y-i,td);if(i%3===0)put(tx,y-i,tl);}
    const tx=x+((h*lean/(h*.55))|0),ty=y-h,L=A.rgb('#b4f060'),M=A.rgb('#5cc040'),D=A.rgb('#1c7a2a'),O=A.rgb('#06240f');
    const fr=[[-9,2],[-8,-3],[-5,-6],[0,-7],[5,-6],[8,-3],[9,2],[-6,5],[6,5]];
    const pos=(f,t,n)=>{const u=t/n;return [Math.round(tx+f[0]*sc*u),Math.round(ty+f[1]*sc*u+u*u*sc*(f[1]>-4?4:3))];};
    fr.forEach(function(f){for(let t=1;t<=nt;t++){const q=pos(f,t,nt);for(let a=-1;a<=1;a++)for(let b=-1;b<=2;b++)put(q[0]+a,q[1]+b,O);}});   // contorno oscuro
    fr.forEach(function(f,k){for(let t=1;t<=nt;t++){const q=pos(f,t,nt);
      put(q[0],q[1],k<4?(t>nt*.75?M:L):k>4?M:D);put(q[0],q[1]-1,k<4?L:M);if(t>2&&t<nt-1)put(q[0],q[1]+1,k<4?M:D);}});
    put(tx,ty,O);put(tx-1,ty,D);put(tx,ty-1,L);
    return [tx,ty];}
  // laguna de selva: orilla de arena irregular (armónicos angulares), agua deformada
  function laguna(c){const sav=A.rgb('#b9b04a'),sav2=A.rgb('#d2c45c'),sd=A.rgb('#8f9a38'),ph=c.s%97*.1,ph2=c.s%53*.13;
    const R=Math.max(c.rx,c.ry)+4,warp=a=>1+.3*Math.sin(a*3+ph)+.18*Math.sin(a*5+ph2)+.1*Math.sin(a*7+ph*2);
    for(let j=-R;j<=R;j++)for(let i=-R;i<=R;i++){const a=Math.atan2(j/(c.ry/c.rx),i),d=Math.hypot(i,j/(c.ry/c.rx)),lim=c.rx*warp(a)*.8;
      if(d>lim)continue;const x=c.x+i,y=c.y+j;if(malo(x,y)&&!azul(x,y))continue;
      const e=d/lim,wl=lim*(.62+.1*Math.sin(a*4+ph2)),agua=d<wl;
      if(agua){put(x,y,(j<-1&&i<2)?A.rgb('#5fb0e0'):A.rgb('#3a86c4'));if(d>wl-1.3)put(x,y,A.rgb('#e8e0a0'));}
      else put(x,y,e>.86?sd:(hash(x,y,c.s+3)<.2?sav2:(i+j<0?sav2:sav)));}}
  // árbol de llano: samán (copa plana ancha) / araguaney florido
  function saman(x,y,r,seed){const rx=r+3,ry=Math.max(3,(r*.62)|0);
    const b=A.rgb('#3e9a34'),l=A.rgb('#8ad04a'),m=A.rgb('#226e28'),o=A.rgb('#0f3a16');
    put(x,y+ry,A.rgb('#4a2e18'));put(x,y+ry+1,A.rgb('#4a2e18'));put(x+1,y+ry+1,A.rgb('#2a1a0c'));
    for(let j=-ry;j<=ry;j++)for(let i=-rx;i<=rx;i++){const e=i*i/(rx*rx)+j*j/(ry*ry);if(e>1)continue;
      let c;if(e>.76)c=(i+j>0)?o:m;else if(j<-ry*.3&&i<rx*.2)c=hash(x+i,y+j,seed)<.6?l:b;else if(j>ry*.2||i>rx*.45)c=m;else c=hash(x+i,y+j,seed+3)<.2?l:b;put(x+i,y+j,c);}}
  function araguaney(x,y,r,seed){const f1=A.rgb('#f4d030'),f2=A.rgb('#e0a818');copa(x,y,r,A.rgb('#6e9a30'),A.rgb('#b8c840'),A.rgb('#3e6a22'),A.rgb('#1f3e14'),seed,A.rgb('#8ab038'));
    for(let k=0;k<r*3;k++){const i=((hash(x,y,seed+k)-.5)*r*1.7)|0,j=((hash(x,y,seed+k+50)-.5)*r*1.5)|0;if(i*i+j*j<r*r*.8)put(x+i,y+j,k%3?f1:f2);}}
  function moriche(x,y,h,seed){const lean=hash(x,y,seed)<.5?-1:1,tr=A.rgb('#8a7048'),td=A.rgb('#4e3c24'),L=A.rgb('#8ad04a'),M=A.rgb('#3c9a34'),D=A.rgb('#1c5e26');
    for(let i=0;i<h;i++){const tx=x+((i*lean/(h*.7))|0);put(tx,y-i,tr);put(tx+1,y-i,td);}
    const tx=x+((h*lean/(h*.7))|0),ty=y-h;
    [[-5,1],[-4,-3],[0,-4],[4,-3],[5,1],[-3,3],[3,3]].forEach(function(f,k){for(let t=1;t<=6;t++){const u=t/6,px=Math.round(tx+f[0]*u),py=Math.round(ty+f[1]*u+u*u*2.5);put(px,py,k<3?(t>4?M:L):(t>4?D:M));}});
    put(tx,ty,D);put(tx,ty-1,L);put(tx+1,ty+1,A.rgb('#c8883a'));}
  function sombraPlana(cx,cy,rx,ry,c,a){sombraSuelo(cx,cy,rx,ry,c,a);}
  function caiman(x,y,flip){const k=flip?-1:1,v=A.rgb('#4a6a2a'),l=A.rgb('#7a9a3a'),d=A.rgb('#243a18'),o=A.rgb('#e8d060');
    for(let i=0;i<9;i++){put(x+i*k,y,i%3===1?l:v);put(x+i*k,y+1,d);}
    for(let i=9;i<12;i++)put(x+i*k,y+(i>10?1:0),d);put(x-1*k,y,v);put(x-2*k,y,v);put(x-1*k,y-1,v);put(x-2*k,y-1,o);put(x+2*k,y+2,d);put(x+6*k,y+2,d);}
  function guacamaya(x,y){const R=A.rgb('#e8281c'),Y=A.rgb('#f4c820'),Bl=A.rgb('#2a62d8');put(x,y,R);put(x+1,y,R);put(x,y+1,Y);put(x+1,y+1,Bl);put(x-1,y+1,Bl);put(x+2,y+1,Bl);put(x-2,y,R);put(x-3,y,Y);}
  function venado(x,y,flip){const k=flip?-1:1,c=A.rgb('#b07a42'),l=A.rgb('#d09a5c'),d=A.rgb('#6a4424'),w=A.rgb('#f0e8d0');
    for(let i=0;i<5;i++){put(x+i*k,y,i<3?l:c);put(x+i*k,y+1,c);}put(x+5*k,y-1,c);put(x+5*k,y-2,l);put(x+6*k,y-2,d);put(x+5*k,y-3,w);put(x+4*k,y-3,w);
    put(x-1*k,y,w);put(x,y+2,d);put(x+1*k,y+2,d);put(x+3*k,y+2,d);put(x+4*k,y+2,d);}
  function burro(x,y,flip){const k=flip?-1:1,c=A.rgb('#8a8a90'),l=A.rgb('#b0b0b6'),d=A.rgb('#4a4a50');
    for(let i=0;i<5;i++){put(x+i*k,y,l);put(x+i*k,y+1,i>2?d:c);}put(x+5*k,y-1,c);put(x+5*k,y,c);put(x+6*k,y,d);put(x+5*k,y-2,d);put(x+4*k,y-2,c);put(x,y+2,d);put(x+1*k,y+2,d);put(x+3*k,y+2,d);put(x+4*k,y+2,d);}
  function mono(x,y){const c=A.rgb('#8a3a1c'),d=A.rgb('#4a1e10');put(x,y,c);put(x+1,y,c);put(x,y-1,c);put(x,y-2,d);put(x+1,y-1,d);put(x-1,y+1,d);put(x+2,y+1,d);put(x+3,y,c);put(x+3,y-1,c);}

  // copa cónica (abeto tropical / cecropia): punta arriba, escalones y contorno
  function copaCono(cx,cy,r,base,luz,som,con,seed){const R=r+1;
    for(let j=-R;j<=R;j++){const u=(j+R)/(2*R),hw=Math.max(0,Math.round(r*.18+r*.82*Math.pow(u,.85))+(hash(cx,cy+j,seed)<.25?1:0));
      for(let i=-hw;i<=hw;i++){let c;
        if(i===hw||i===-hw||j===-R)c=(i>=0||j>R*.6)?con:sh(base,.45);
        else if(j===R)c=con;
        else if(i<-hw*.25&&((j+R)%4!==3))c=hash(cx+i,cy+j,seed+5)<.35?base:luz;
        else if(i>hw*.2||(j+R)%4===3)c=som;else c=hash(cx+i,cy+j,seed+9)<.2?luz:base;
        put(cx+i,cy+j,c);}}}
  // copa lobulada (brócoli): 3-4 copas solapadas con contorno propio
  function copaLob(cx,cy,r,base,luz,som,con,seed,rim){const q=Math.max(3,(r*.62)|0),o=(r*.5)|0;
    copa(cx+o,cy+((r*.3)|0),q,base,luz,som,con,seed+1,0);
    copa(cx-o,cy+((r*.25)|0),q,base,luz,som,con,seed+2,0);
    copa(cx,cy-((r*.25)|0),q+1,base,luz,som,con,seed+3,rim);}
  function flores(cx,cy,r,seed,tipo){const f=tipo===0?['#f6d632','#e8a818']:tipo===1?['#ee3a3a','#c42a34']:['#f070b0','#c84890'];
    const n=3+((r*.9)|0);for(let k=0;k<n;k++){const i=((hash(cx,cy,seed+k)-.5)*r*1.5)|0,j=((hash(cx,cy,seed+k+40)-.5)*r*1.3)|0-((r*.15)|0);
      if(i*i+j*j<r*r*.6&&!malo(cx+i,cy+j)){put(cx+i,cy+j,A.rgb(f[k&1]));if(r>=8&&(k%3===0))put(cx+i,cy+j+1,A.rgb(f[1]));}}}
  // sombra proyectada larga (abajo-derecha) de un árbol emergente
  function sombraLarga(cx,cy,r,len,a){const dk=A.rgb('#052a2c'),seen=new Set();
    for(let t=0;t<=len;t++){const u=t/len,px=cx+Math.round(t*.86)+((r*.25)|0),py=cy+((r*.4)|0)+Math.round(t*.5),rr=Math.max(2,Math.round(r*(.95-.4*u)));
      for(let j=-rr;j<=rr;j++)for(let i=-rr;i<=rr;i++){if(i*i+j*j>rr*rr)continue;const x=px+i,y=py+j;if(x<0||y<0||x>=W||y>=H)continue;const k=y*W+x;if(seen.has(k))continue;seen.add(k);
        if(tierra[k]!==1||ocu[k])continue;const o=buf[k];if(!o||malo(x,y))continue;buf[k]=A.mezcla(o,dk,a*(1-.3*u));}}}
  function copaEmerg(cx,cy,r,seed){const k=seed%4,base=k===1?A.rgb('#44a038'):k===2?A.rgb('#2e8c3c'):A.rgb('#5eb83a'),luz=A.rgb('#b0e456'),som=A.rgb('#2e8a30'),con=A.rgb('#0a3a18');
    sombraSuelo(cx+4,cy+r-2,r+4,(r>>1)-1,A.rgb('#06240f'),.6);
    const o=(r*.62)|0;
    copa(cx+o,cy+((r*.3)|0),(r*.7)|0,base,luz,som,con,seed+1,0);
    copa(cx-o,cy+((r*.25)|0),(r*.7)|0,base,luz,som,con,seed+2,0);
    copa(cx+1,cy-((r*.28)|0),(r*.74)|0,base,luz,som,con,seed+3,lt(luz,.25));
    for(let q=0;q<5;q++){const i=-((r*.35)|0)+q,j=-((r*.5)|0)+(q>>1);put(cx+i,cy+j,lt(luz,.3));}
    if(seed%3===0)flores(cx,cy,r,seed,seed%2);}
  // mancha irregular genérica (armónicos angulares)
  const warp=(a,ph,ph2)=>1+.3*Math.sin(a*3+ph)+.18*Math.sin(a*5+ph2)+.1*Math.sin(a*7+ph*2);
  function claro(c){const ph=c.s%97*.1,ph2=c.s%53*.13,R=Math.max(c.rx,c.ry)*1.45+2,K=c.ry/c.rx;
    for(let j=-R|0;j<=R;j++)for(let i=-R|0;i<=R;i++){const a=Math.atan2(j/K,i),d=Math.hypot(i,j/K),lim=c.rx*warp(a,ph,ph2)*.82;if(d>lim)continue;
      const x=c.x+i,y=c.y+j;if(malo(x,y))continue;const e=d/lim;let col;
      if(e>.92)col='#2c7a2c';else if(e>.8)col='#4c9a34';else if(hash(x,y,c.s+5)<.07)col='#58a838';else if(i+j<-c.rx*.25||hash(x,y,c.s+6)<.14)col='#a2dc52';else col='#78c442';
      put(x,y,A.rgb(col));}}
  function calva(c){const ph=c.s%97*.1,ph2=c.s%53*.13,R=Math.max(c.rx,c.ry)*1.45+2,K=c.ry/c.rx,o=A.rgb('#242430'),cl=A.rgb('#c8c8d0'),c1=A.rgb('#9c9ca8'),c2=A.rgb('#6e6e7c'),c3=A.rgb('#464654');
    for(let j=-R|0;j<=R;j++)for(let i=-R|0;i<=R;i++){const a=Math.atan2(j/K,i),d=Math.hypot(i,j/K),lim=c.rx*(1+.2*Math.sin(a*3+ph)+.14*Math.sin(a*6+ph2))*.82;if(d>lim)continue;
      const x=c.x+i,y=c.y+j;if(azul(x,y))continue;const e=d/lim;let col;
      if(e>.9)col=(i+j>0)?o:c3;else{const l=-(i/c.rx*.6+j/c.ry*.8)+(hash(x>>1,y>>1,c.s)-.5)*.5;col=l>.4?cl:l>.0?c1:l>-.45?c2:c3;if(hash(x,y,c.s+8)<.04)col=o;}
      put(x,y,col);}}

  /* ── campos de ruido baratos (rejilla gruesa) ── */
  const ncla=A.campo(46,71,2,8),nclu=A.campo(34,72,3,8),nllano=A.campo(70,73,2,8);

  /* ── barrido por rejillas de candidatos ── */
  const nbig=A.campo(150,91,2,8),nton=A.campo(80,74,2,8),ntam=A.campo(55,75,2,8),npal=A.campo(40,76,2,8);
  const paso=7;
  const nlow=A.campo(120,92,3,8),nban=A.campo(70,93,2,8);
  // tabla de tonos de la selva: verde azulado oscuro → verde medio → verde amarillento
  const T0=['#0b4640','#2a8068','#062c2c','#031c1e'],T1=['#2c8e32','#5cbc48','#18682c','#0a3a18'],T2=['#88ca3c','#c4ea5a','#4a9c30','#1c5a1c'];
  const LUT=[];for(let q=0;q<=16;q++){const v=q/16,a=v<.5?T0:T1,b=v<.5?T1:T2,u=v<.5?v*2:(v-.5)*2;LUT.push(a.map((c,k)=>A.mezcla(c,b[k],u)));}
  const CL=[];const nolv=A.campo(60,77,2,8),nmac=A.campo(26,78,2,8);
  (function(){const g=64;for(let gy=g;gy<H-g;gy+=g)for(let gx=g;gx<W-g;gx+=g){
    const x=(gx+(hash(gx,gy,81)-.5)*g*.7)|0,y=(gy+(hash(gx,gy,82)-.5)*g*.7)|0,i=y*W+x;
    if(bioma[i]!==B.selva||hash(gx,gy,83)>.17||A.dist[i]/3<9)continue;
    const rx=(13+hash(gx,gy,84)*14)|0,ry=(rx*.62)|0;
    if(!sobreTierra(x,y,ry+2)||malo(x,y)||malo(x+rx,y)||malo(x-rx,y)||malo(x,y+ry)||malo(x,y-ry))continue;
    let bad=false;for(let a=0;a<8&&!bad;a++){const ex=x+Math.cos(a*.785)*rx*1.1|0,ey=y+Math.sin(a*.785)*ry*1.1|0;if(ocu[ey*W+ex]||malo(ex,ey)||bioma[ey*W+ex]!==B.selva)bad=true;}
    if(bad||ocu[i])continue;
    CL.push({x:x,y:y,rx:rx,ry:ry,lag:hash(gx,gy,85)<.6,s:(hash(gx,gy,86)*1000)|0});}})();
  const enCl=(x,y,m)=>{for(let k=0;k<CL.length;k++){const c=CL[k],u=(x-c.x)/(c.rx*m),v=(y-c.y)/(c.ry*m);if(u*u+v*v<1)return c;}return null;};
  CL.forEach(laguna);
  // claros irregulares con pasto y calvas de roca en la selva sur/suroeste (rejilla de candidatos)
  const CLA=[],ROC=[],NEG=CL.slice();
  const lejos=(x,y,m)=>!NEG.some(c=>Math.abs(c.x-x)<(c.rx+m)&&Math.abs(c.y-y)<(c.ry+m));
  function apto(x,y,rx,ry){const i=y*W+x;if(bioma[i]!==B.selva||ocu[i]||A.dist[i]/3<10)return false;
    if(!sobreTierra(x,y,ry+2)||malo(x,y)||malo(x+rx,y)||malo(x-rx,y)||malo(x,y+ry)||malo(x,y-ry))return false;
    for(let a=0;a<12;a++){const ex=(x+Math.cos(a*.5236)*rx*1.45)|0,ey=(y+Math.sin(a*.5236)*ry*1.45)|0;if(ex<2||ey<2||ex>=W-2||ey>=H-2||ocu[ey*W+ex]||malo(ex,ey)||bioma[ey*W+ex]!==B.selva||tierra[ey*W+ex]!==1)return false;}
    return lejos(x,y,22);}
  (function(){const x0=A.dx(60),x1=A.dx(660),y0=A.dy(610),y1=A.dy(945),g=72;let nr=0;
    for(let gy=y0;gy<y1;gy+=g)for(let gx=x0;gx<x1;gx+=g){
      const x=(gx+(hash(gx,gy,201)-.5)*g*.8)|0,y=(gy+(hash(gx,gy,202)-.5)*g*.8)|0;
      if(hash(gx,gy,203)>.52)continue;
      const rock=nr<4&&hash(gx,gy,204)<.3&&CLA.length>3,rx=rock?(9+hash(gx,gy,205)*7)|0:(15+hash(gx,gy,206)*12)|0,ry=(rx*(rock?.7:.62))|0;
      if(!apto(x,y,rx,ry))continue;
      const c={x:x,y:y,rx:rx,ry:ry,s:(hash(gx,gy,207)*1000)|0};
      if(rock){ROC.push(c);nr++;}else CLA.push(c);NEG.push(c);}
    CLA.forEach(claro);ROC.forEach(calva);
    CLA.forEach(function(c){const n=1+(c.s%2);for(let k=0;k<n;k++){const px=c.x+((hash(c.x,c.y,210+k)-.5)*c.rx*.9)|0,py=c.y+((hash(c.x,c.y,220+k)-.5)*c.ry*.8)|0;
      if(!malo(px,py)&&!azul(px,py))add(py,px,'palma',c.s+k,8+(k&1));}
      for(let k=0;k<6;k++){const px=c.x+((hash(c.x,c.y,230+k)-.5)*c.rx*1.5)|0,py=c.y+((hash(c.x,c.y,240+k)-.5)*c.ry*1.3)|0;if(!malo(px,py))add(py,px,'mata',c.s+k,0);}});
    ROC.forEach(function(c){for(let k=0;k<3;k++){const px=c.x+((hash(c.x,c.y,250+k)-.5)*c.rx*2.3)|0,py=c.y+c.ry+2;if(!malo(px,py)&&tierra[py*W+px]===1&&hash(c.x,c.y,260+k)<.7)add(py,px,'mata',c.s+k,0);}});
  })();
  const enZona=(x,y,m)=>{for(let k=0;k<CLA.length;k++){const c=CLA[k],u=(x-c.x)/(c.rx*m),v=(y-c.y)/(c.ry*m);if(u*u+v*v<1)return true;}
    for(let k=0;k<ROC.length;k++){const c=ROC[k],u=(x-c.x)/(c.rx*m),v=(y-c.y)/(c.ry*m);if(u*u+v*v<1)return true;}return false;};
  for(let gy=3;gy<H-3;gy+=paso)for(let gx=3;gx<W-3;gx+=paso){
    const jx=(hash(gx,gy,1)*9-4.5)|0,jy=(hash(gx,gy,2)*9-4.5)|0,x=gx+jx,y=gy+jy,i=y*W+x;
    if(tierra[i]!==1)continue;
    const b=bioma[i],d=A.dist[i]/3;
    if(b===B.selva){
      if(d<2)continue;
      const cl=ncla(x,y);
      const tm=ntam(x,y),h=hash(x,y,3);
      const nb=nbig(x,y);let r=tm>.6?(8+(h*4|0)):tm>.42?(5+(h*3|0)):(3+(h*2|0));
      if(r>=8&&hash(x,y,9)<.35)continue;                 // masas grandes: menos pero más gordas
      if(r<=4&&nb<.4&&hash(x,y,10)<.4)continue;          // huecos entre masas
      if(!sobreTierra(x,y,Math.min(r-1,4))||!aire(x,y,r))continue;
      if(malo(x,y)||malo(x-3,y+2))continue;
      r=ajusta(x,y,r);if(r<3)continue;
      const s=(hash(x,y,5)*1000)|0;
      if(enZona(x,y,1.12))continue;
      const cc=enCl(x,y,1.12);
      if(cc){if(h<.18&&!enCl(x,y,.8)===false)add(y,x,'palma',s,7+(s&1));else if(h<.3)add(y,x,'mata',s,0);continue;}
      if(cl>.84){                                   // claro: matas y alguna palma, el suelo se ve
        if(h<.5)add(y,x,'palma',s,6+(s&1));else if(h<.8)add(y,x,'mata',s,0);continue;}
      if(npal(x,y)>.8&&h<.45){add(y,x,'palma',s,7);add(y+3,x+5,'palma',s+1,6);add(y+2,x-5,'palma',s+2,6);continue;}
      const rio=azul(x+7,y)||azul(x-7,y)||azul(x,y+7)||azul(x,y-7)||azul(x+5,y+5)||azul(x-5,y-5);
      if(h>.975&&r>=6){r=11+(s&3);if(sobreTierra(x,y,6)&&aire(x,y,r))add(y,x,'selva',s,r);continue;}
      add(y,x,'selva',s,r);}
  }
  // llano / sabana / costa / desierto / andes / manglar: rejilla más suelta
  for(let gy=5;gy<H-5;gy+=8)for(let gx=5;gx<W-5;gx+=8){
    const x=gx+((hash(gx,gy,11)*6-3)|0),y=gy+((hash(gx,gy,12)*6-3)|0),i=y*W+x,t=tierra[i];
    if(t!==1&&!(t===0&&bioma[i]===B.manglar))continue;
    const b=bioma[i],d=A.dist[i]/3,p=hash(x,y,13),s=(hash(x,y,14)*1000)|0;
    if(b===B.manglar){continue;}
    if(d<1||!aire(x,y,5)||malo(x,y))continue;
    if(b===B.llano){
      const gal=(azul(x+9,y)||azul(x-9,y)||azul(x,y+8)||azul(x,y-8)||azul(x+6,y+6)||azul(x-6,y-6))?1:0;
      if(gal){
        if(p<.62){                                   // bosquete de galería: núcleo grande + corona de árboles menores a lo largo del río
          const n=6+(s%5),cx0=x,cy0=y;for(let k=0;k<n;k++){const a=hash(x,y,31+k)*6.283,rr=(k?2+hash(x,y,41+k)*11:0),ox=(Math.cos(a)*rr)|0,oy=(Math.sin(a)*rr*.6)|0,rs=k===0?7:k<3?5+(k&1):4;
            if(aire(x+ox,y+oy,rs)&&!malo(x+ox,y+oy))add(y+oy,x+ox,k===0||k===3?'copaLlano':(k%4===1?'saman':'copaLlano'),s+k,rs);}
          if(p<.3&&aire(x+6,y+5,5))add(y+5,x+6,'moriche',s,8);}
        else if(p<.92){const n=3+(s%3);for(let k=0;k<n;k++){const ox=((hash(x,y,51+k)-.5)*14)|0,oy=((hash(x,y,61+k)-.5)*8)|0;if(aire(x+ox,y+oy,4)&&!malo(x+ox,y+oy))add(y+oy,x+ox,'moriche',s+k,7+(k&1));}}  // morichal junto al agua
      }else{const q=nllano(x,y);
        if(p<.016+(q>.5?.012:0))add(y,x,hash(x,y,16)<.4?'saman':(hash(x,y,17)<.4?'araguaney':'copaLlano'),s,8+(s&3));   // árbol grande aislado
        else if(p<.032)add(y,x,'copaLlano',s,5+(s&1));
        else if(p<.046+(q>.5?.026:0)){                  // palmar: 3-5 palmas reales agrupadas
          const n=3+(s%3);for(let k=0;k<n;k++){const ox=((hash(x,y,71+k)-.5)*22)|0,oy=((hash(x,y,81+k)-.5)*10)|0;if(aire(x+ox,y+oy,5)&&!malo(x+ox,y+oy)&&!azul(x+ox,y+oy))add(y+oy,x+ox,'palmaL',s+k,10+((hash(x,y,91+k)*4)|0));}}
        else if(p<.066+(q>.55?.02:0)){                 // bosquete redondo con sombra
          const n=3+(s%3);for(let k=0;k<n;k++){const a=hash(x,y,101+k)*6.283,rr=k?5+hash(x,y,111+k)*7:0,ox=(Math.cos(a)*rr)|0,oy=(Math.sin(a)*rr*.6)|0,rs=k===0?8:6+(k&1);
            if(aire(x+ox,y+oy,rs)&&!malo(x+ox,y+oy)&&!azul(x+ox,y+oy))add(y+oy,x+ox,k%3===1?'saman':'copaLlano',s+k,rs);}}
        else if(p<.19)add(y,x,'mata',s,0);}
    }else if(b===B.sabana){
      if(p<.16)add(y,x,'copaLlano',s,3+(s&1));else if(p<.34)add(y,x,'mata',s,0);else if(p<.40){add(y,x,'palmaL',s,10);if(aire(x+6,y+2,5))add(y+2,x+6,'palmaL',s+1,9);}
    }else if(b===B.desierto){
      if(d<4)continue;
      if(p<.034&&aire(x,y,7))add(y,x,'cactus',s,12+((hash(x,y,18)*5)|0));
      else if(p<.056&&aire(x,y,8)){const rr=6+(s%4);add(y,x,'rocaR',s,rr);
        if(aire(x+rr+6,y+3,6))add(y+3,x+rr+6,'cactus',s+1,12+(s%3));if(hash(x,y,19)<.5)add(y+5,x-rr-3,'seco',s+2,0);}
      else if(p<.062)add(y,x,'chumbera',s,0);else if(p<.15)add(y,x,'seco',s,0);
    }else if(b===B.andes){
      if(p<.5&&nclu(x,y)>.32)add(y,x,'pino',s,10+(s&3));else if(p<.62)add(y,x,'fraile',s,0);
    }else if(b===B.costa||b===B.urbano){
      if(d>=2&&d<=9&&p<.42)add(y,x,'cocotera',s,6+(s&1));
      else if(d>9&&p<.38&&nclu(x,y)>.42)add(y,x,'copaTrop',s,3+(s&1));
      else if(d>=0&&d<3&&p<.55&&nclu(x+99,y)>.5)add(y,x,'manglarCosta',s,3);
    }
  }
  // manglar del delta: islotes (núcleo grande + satélites) sobre tierra y agua morada
  (function(){const pl=[];
  for(let gy=4;gy<H-4;gy+=14)for(let gx=4;gx<W-4;gx+=14){
    const x=gx+((hash(gx,gy,21)*8-4)|0),y=gy+((hash(gx,gy,22)*8-4)|0),i=y*W+x;
    if(bioma[i]!==B.manglar||tierra[i]===0&&A.dist[i]<-18)continue;
    const q=nclu(x,y);if(q<.46||hash(x,y,25)<.3||ocu[i])continue;
    if(!aire(x,y,8)||pl.some(p=>Math.abs(p[0]-x)<15&&Math.abs(p[1]-y)<12))continue;
    const ms=(hash(x,y,23)*1000)|0,r0=7+((hash(x,y,24)*3)|0);pl.push([x,y]);add(y,x,'mangle',ms,r0);
    const ns=1+((hash(x,y,26)*3)|0);
    for(let k=0;k<ns;k++){const a=hash(x,y,27+k)*6.283,sx=(x+Math.cos(a)*(r0+7))|0,sy=(y+Math.sin(a)*(r0*.6+5))|0,j=sy*W+sx;
      if(sx<10||sy<10||sx>=W-10||sy>=H-10||bioma[j]!==B.manglar||ocu[j]||!aire(sx,sy,6)||pl.some(p=>Math.abs(p[0]-sx)<12&&Math.abs(p[1]-sy)<9))continue;
      pl.push([sx,sy]);add(sy,sx,'mangle',ms+k+1,6+k%2);}}})();

  // palmas emergentes sobre el dosel del sur (6-10)
  (function(){const rp=A.rng(777),pts=[];let t=0;
    while(pts.length<9&&t++<4000){const x=(A.dx(100)+rp()*(A.dx(900)-A.dx(100)))|0,y=(A.dy(660)+rp()*(A.dy(940)-A.dy(660)))|0,i=y*W+x;
      if(bioma[i]!==B.selva||tierra[i]!==1||A.dist[i]/3<12||ocu[i]||!sobreTierra(x,y,8)||!aire(x,y,9)||malo(x,y)||azul(x+10,y)||azul(x-10,y)||azul(x,y+10))continue;
      if(CL.some(c=>Math.abs(c.x-x)<c.rx+12&&Math.abs(c.y-y)<c.ry+12))continue;
      if(pts.some(q=>Math.abs(q[0]-x)<110&&Math.abs(q[1]-y)<80))continue;
      pts.push([x,y]);add(y,x,'palmaG',(rp()*1000)|0,16+((rp()*5)|0));}})();

  const galeria=(x,y)=>azul(x+11,y)||azul(x-11,y)||azul(x,y+11)||azul(x,y-11)||azul(x+16,y+4)||azul(x-16,y-4)||azul(x+8,y+8)||azul(x-8,y-8)||azul(x+14,y-9)||azul(x-14,y+9);
  // árboles emergentes aislados en la selva sur/suroeste, con sombra larga
  (function(){const pts=[],x0=A.dx(50),x1=A.dx(680),y0=A.dy(600),y1=A.dy(955),g=60;
    for(let gy=y0;gy<y1;gy+=g)for(let gx=x0;gx<x1;gx+=g){
      const x=(gx+(hash(gx,gy,301)-.5)*g*.9)|0,y=(gy+(hash(gx,gy,302)-.5)*g*.9)|0,i=y*W+x;
      if(hash(gx,gy,303)>.5)continue;
      if(bioma[i]!==B.selva||tierra[i]!==1||A.dist[i]/3<12||ocu[i]||!sobreTierra(x,y,9)||!aire(x,y,10)||malo(x,y)||azul(x+12,y)||azul(x-12,y)||azul(x,y+12)||azul(x+16,y+8))continue;
      if(enZona(x,y,1.5)||CL.some(c=>Math.abs(c.x-x)<c.rx+14&&Math.abs(c.y-y)<c.ry+14))continue;
      if(pts.some(q=>Math.abs(q[0]-x)<48&&Math.abs(q[1]-y)<36))continue;
      pts.push([x,y]);const hs=(hash(gx,gy,304)*1000)|0;add(y,x,'emerg',hs,11+(hs%4));}})();
  let banded=false;
  // sombras cruzando el dosel: bandas diagonales de nube, tramadas
  function banda(){banded=true;const x0=A.dx(30),x1=A.dx(700),y0=A.dy(560),y1=A.dy(975),dk=A.rgb('#05303a');
    for(let y=y0|0;y<y1;y++)for(let x=x0|0;x<x1;x++){const k=y*W+x;if(tierra[k]!==1||bioma[k]!==B.selva||ocu[k])continue;
      const f=nban(x*.5+y*.36,y*.95);if(f<.58)continue;const q=Math.min(1,(f-.58)*7);if(hash(x,y,99)>q)continue;
      const o=buf[k];if(!o||malo(x,y))continue;buf[k]=A.mezcla(o,dk,.3);}}

  /* ── pintar ordenado por y (pintor) ── */
  const oy=o=>o.y+(o.k==='palmaG'||o.k==='emerg'?5000:0);items.sort((a,b)=>oy(a)-oy(b)||a.x-b.x);
  const SEL=[C.selva,C.selvaLuz,C.selvaOscura,C.selvaMedia];
  for(let n=0;n<items.length;n++){const o=items[n],x=o.x,y=o.y,s=o.s;let r=o.r;if(!banded&&oy(o)>=5000)banda();if(r>=4&&o.k!=='emerg'&&o.k!=='palma'&&o.k!=='cocotera'&&o.k!=='pino'&&o.k!=='cactus'&&o.k!=='palmaL'&&o.k!=='rocaR'&&o.k!=='mangle')r=ajusta(x,y,r);
    switch(o.k){
      case 'selva':{
        const rio=azul(x+7,y)||azul(x-7,y)||azul(x,y+7)||azul(x,y-7);
        let v=(nlow(x,y)-.5)*2.5+.43+(nmac(x,y)-.5)*.4;v=v<0?0:v>1?1:v;
        if(r>=8)v+=.1;else if(r<=4)v-=.08;
        const T=LUT[Math.max(0,Math.min(16,Math.round(v*16)))];let base=T[0],luz=T[1],som=T[2],con=T[3];
        const ol=nolv(x,y);
        if(ol>.74){const k=Math.min(1,(ol-.74)*4);base=A.mezcla(base,'#9aa83a',k*.5);luz=A.mezcla(luz,'#d8d860',k*.5);}
        {const nb=nbig(x,y);if(nb<.36){base=sh(base,.14);som=sh(som,.16);}else if(nb>.66){base=lt(base,.08);luz=lt(luz,.1);}}
        // bosque de galería: más claro y amarillento a lo largo de los ríos
        if(galeria(x,y)){base=A.mezcla(base,'#a0d44c',.5);luz=A.mezcla(luz,'#dcf470',.5);som=A.mezcla(som,'#58a232',.45);}
        if(s%7===0)base=lt(base,.08);
        if(rio){som=sh(som,.2);con=A.rgb('#0a3014');}
        if(r>=5)sombraSuelo(x+3,y+r-2,r+(r>9?3:0),Math.max(2,r>>1),A.rgb('#06240f'),r>9?.75:.6);
        if(r>=6)sombraCopa(x,y,r,r>=9?.5:.38);
        const va=(s>>3)%8,rim=r>=6?lt(luz,.22):0;
        if(va===4&&r>=6)copaLob(x,y,r,base,luz,som,con,s,rim);
        else if(va===5&&r>=5)copaCono(x,y,r,base,luz,som,con,s);
        else{copa(x,y,r,base,luz,som,con,s,rim);if(va===6&&r>=5)flores(x,y,r,s,s%3);else if(va===7&&r>=7)flores(x,y,r,s+9,0);}
        if(r>=7){const l2=lt(luz,.12);put(x-2,y-r+3,l2);put(x-3,y-r+4,l2);put(x-1,y-r+3,l2);}
        break;}
      case 'saman':sombraSuelo(x+3,y+r-2,r+4,Math.max(2,r>>1),PAL.pastoOscuro,.55);saman(x,y,r,s);break;
      case 'araguaney':sombraSuelo(x+2,y+r-1,r+2,Math.max(2,r>>1),PAL.pastoOscuro,.55);araguaney(x,y,r,s);break;
      case 'moriche':sombraSuelo(x+2,y+1,4,1,PAL.pastoOscuro,.55);moriche(x,y,r,s);break;
      case 'emerg':sombraLarga(x,y,r,15+(s%6),.6);copaEmerg(x,y,r,s);break;
      case 'palmaG':sombraCopa(x,y-6,8,.45);palmaGrande(x,y,r,s);break;
      case 'copaLlano':
        sombraSuelo(x+2,y+r-1,r+2,Math.max(2,r>>1),PAL.pastoOscuro,.6);
        {const v=s%3;copa(x,y,r,v===0?A.rgb('#4a9a34'):v===1?A.rgb('#2e8a3a'):A.rgb('#7aa838'),v===0?A.rgb('#98d44a'):v===1?A.rgb('#6ac052'):A.rgb('#c0d858'),v===0?A.rgb('#226a24'):v===1?A.rgb('#145a2a'):A.rgb('#4a7a24'),A.rgb('#0f3a16'),s,A.rgb('#b8e060'));}
        if(r>5){put(x-2,y-r+3,A.rgb('#b8e060'));put(x-1,y-r+3,A.rgb('#b8e060'));put(x,y+r,A.rgb('#4a2e18'));}break;
      case 'palmaL':sombraSuelo(x+3,y+1,5,1,PAL.pastoOscuro,.6);palmaGrande(x,y,r,s,.62,7);break;
      case 'palma':sombraSuelo(x+2,y+1,4,1,PAL.pastoOscuro,.55);palma(x,y,r,s,r>6);break;
      case 'mata':arbusto(x,y,PAL.pastoClaro,PAL.pastoOscuro);break;
      case 'seco':seco(x,y,s);break;
      case 'cactus':sombraSuelo(x+3,y+1,6,1,PAL.dunaSombra,.55);cactus(x,y,r,s);break;
      case 'rocaR':sombraSuelo(x+2,y+1,r+2,1,PAL.dunaSombra,.5);rocaR(x,y,r,Math.max(4,(r*.75)|0),s);break;
      case 'chumbera':chumbera(x,y,s);break;
      case 'pino':sombraSuelo(x+2,y,3,1,PAL.pizarraSombra,.4);pino(x,y,r);break;
      case 'fraile':fraile(x,y);break;
      case 'cocotera':sombraSuelo(x+2,y+1,3,1,PAL.arenaSombra,.5);palma(x,y,r,s,true);break;
      case 'copaTrop':copa(x,y,r,PAL.selva,PAL.selvaLuz,PAL.selvaMedia,PAL.selvaOscura,s);break;
      case 'manglarCosta':copa(x,y,r,PAL.manglar,A.rgb('#4f9a48'),sh(PAL.manglar,.3),A.rgb('#173a1e'),s);break;
      case 'mangle':mangle(x,y,r,s);break;
    }
  }

  if(!banded)banda();
  /* ── fauna (después de los árboles) ── */
  const dx=A.dx,dy=A.dy;
  function libreAnimal(x,y,w){if(x<4||y<4||x>=W-8||y>=H-4)return false;for(let k=0;k<=w;k+=2){const j=y*W+x+k;if(tierra[j]!==1||ocu[j]||ocu[j+W]||malo(x+k,y)||malo(x+k,y+2))return false;
      const c=buf[j];if(c&&((c&255)<70&&((c>>8)&255)<95&&(c&255)<=((c>>8)&255)))return false;}return true;}   // no sobre copas oscuras
  const rg=A.rng(4242);
  // vacas: manadas de 3-6 en el Llano
  const ZONAS=[[300,350],[345,362],[385,350],[330,410],[375,425],[290,440],[400,455],[260,400],[430,400],[350,330]];
  ZONAS.forEach(function(z,zi){const cx=dx(z[0]),cy=dy(z[1]),n=3+((rg()*4)|0),pts=[];
    let intentos=0;while(pts.length<n&&intentos++<60){const x=(cx+(rg()-.5)*34)|0,y=(cy+(rg()-.5)*22)|0;
      if(pts.some(p=>Math.abs(p[0]-x)<11&&Math.abs(p[1]-y)<6))continue;if(libreAnimal(x,y,9))pts.push([x,y,rg()<.35,rg()<.5]);}
    pts.sort((a,b)=>a[1]-b[1]).forEach(p=>vaca(p[0],p[1],p[2],p[3]));});
  // caballos
  [[350,380],[320,430],[395,395]].forEach(function(z){const cx=dx(z[0]),cy=dy(z[1]);for(let k=0;k<3;k++){let t=0;while(t++<40){const x=(cx+(rg()-.5)*30)|0,y=(cy+(rg()-.5)*16)|0;
    if(libreAnimal(x,y,7)){caballo(x,y,rg()<.5);break;}}}});
  // chigüires junto al agua en Mantecal (320,490): prefiere píxeles cercanos al agua
  (function(){const cx=dx(320),cy=dy(490);let n=0,t=0;const ps=[];
    while(n<10&&t++<900){const x=(cx+(rg()-.5)*80)|0,y=(cy+(rg()-.5)*50)|0;
      if(!libreAnimal(x,y,6))continue;
      const ag=azul(x+8,y)||azul(x-8,y)||azul(x,y+6)||azul(x,y-6)||azul(x+10,y+6)||azul(x-10,y-6)||(t>300);
      if(!ag||ps.some(p=>Math.abs(p[0]-x)<10&&Math.abs(p[1]-y)<5))continue;ps.push([x,y,rg()<.5]);n++;}
    ps.sort((a,b)=>a[1]-b[1]).forEach(p=>chiguire(p[0],p[1],p[2]));})();
  // garzas y flamencos en las lagunas de la costa (Morrocoy ≈ 330-420,150-175 · Falcón ≈ 240-300,95-130)
  (function(){let nr=0,nb=0,t=0;const cajas=[[330,420,135,185],[235,305,85,135]];
    while((nr<7||nb<7)&&t++<4000){const cj=cajas[t%2],x=(dx(cj[0])+hash(t,1,91)*(dx(cj[1])-dx(cj[0])))|0,y=(dy(cj[2])+hash(t,2,92)*(dy(cj[3])-dy(cj[2])))|0;
      if(tierra[y*W+x]!==1||A.dist[y*W+x]/3<1||A.dist[y*W+x]/3>9||ocu[y*W+x]||!(bioma[y*W+x]===B.costa||bioma[y*W+x]===B.llano||bioma[y*W+x]===B.desierto))continue;
      if(malo(x,y)||malo(x+1,y-3)||buf[y*W+x]&&(buf[y*W+x]&255)<80)continue;
      const rosa=nr<nb||nb>=7;if(rosa&&nr>=7)continue;if(!rosa&&nb>=7)continue;
      ave(x,y,rosa);if(rosa)nr++;else nb++;}})();
  // chigüires en grupos junto a los ríos del Llano (cuadros 230-520 x 330-560)
  (function(){const rc=A.rng(515);let g=0,t=0;const done=[];
    while(g<5&&t++<3000){const cx=(dx(230)+rc()*(dx(520)-dx(230)))|0,cy=(dy(330)+rc()*(dy(560)-dy(330)))|0;
      if(!libreAnimal(cx,cy,6)||!(azul(cx+8,cy)||azul(cx-8,cy)||azul(cx,cy+6)||azul(cx,cy-6)))continue;
      if(done.some(d=>Math.abs(d[0]-cx)<60&&Math.abs(d[1]-cy)<40))continue;done.push([cx,cy]);
      const n=3+((rc()*3)|0),ps=[[cx,cy,rc()<.5]];for(let k=0,u=0;k<n&&u<40;u++){const x=(cx+(rc()-.5)*26)|0,y=(cy+(rc()-.5)*12)|0;if(libreAnimal(x,y,6)&&!ps.some(p=>Math.abs(p[0]-x)<8&&Math.abs(p[1]-y)<4)){ps.push([x,y,rc()<.5]);k++;}}
      ps.sort((a,b)=>a[1]-b[1]).forEach(p=>chiguire(p[0],p[1],p[2]));g++;}})();
  // caimanes en los ríos llaneros, garzas en las orillas, burros, venados en sabana, guacamayas y monos sobre el dosel
  (function(){const rf=A.rng(31337);let nc=0,ng=0,nbu=0,nv=0,ngu=0,nm=0,t=0;
    while(t++<9000&&(nc<5||ng<8||nbu<4||nv<6||ngu<10||nm<5)){
      const x=(rf()*(W-20)+8)|0,y=(rf()*(H-20)+8)|0,i=y*W+x,b=bioma[i];
      if(b===B.llano&&nc<5&&azul(x,y)&&azul(x+10,y)&&!ocu[i]&&A.dist[i]!==0){let ok=true;for(let k=0;k<=10;k+=2)if(!azul(x+k,y)||!azul(x+k,y+1))ok=false;if(ok){caiman(x,y,rf()<.5);nc++;continue;}}
      if(b===B.llano&&ng<8&&tierra[i]===1&&(azul(x+5,y)||azul(x-5,y)||azul(x,y+5))&&libreAnimal(x,y,3)){ave(x,y,false);ng++;continue;}
      if(b===B.llano&&nbu<4&&libreAnimal(x,y,7)&&hash(x,y,5)<.5){burro(x,y,rf()<.5);if(libreAnimal(x+10,y+3,7))burro(x+10,y+3,rf()<.5);nbu++;continue;}
      if(b===B.sabana&&nv<6&&libreAnimal(x,y,7)){venado(x,y,rf()<.5);if(libreAnimal(x+9,y+2,7))venado(x+9,y+2,rf()<.5);nv++;continue;}
      if(b===B.selva&&tierra[i]===1&&A.dist[i]/3>10&&!ocu[i]&&!malo(x,y)){
        if(ngu<10&&rf()<.5){guacamaya(x,y);guacamaya(x+6,y+2);ngu++;continue;}
        if(nm<5){mono(x,y);nm++;}}}
  })();
});
})(typeof window!=='undefined'?window:globalThis);
