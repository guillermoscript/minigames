// LA FIESTA · arte del mapa: capas «nubes» (orden 70) y «acabado» (orden 90).
// nubes: bancos esponjosos (unión de domos con luz arriba-izquierda) al sur/suroeste/oeste, nubes sueltas, neblinas y jirones animados.
// acabado: sombras de nubes sobre la tierra, tinte atmosférico, viñeta, contorno de costa y relleno de huecos.
(function(root){'use strict';const F=root.FIESTA=root.FIESTA||{};
if(typeof module!=='undefined'&&typeof require!=='undefined'&&!F.arte)require('./fiesta-mapa-arte.js');
if(!F.arte)return;

const MASK=new WeakMap();           // A → Uint8Array de cobertura de nubes opacas (la usa «acabado»)

/* ── distancia (en px de arte) a la casilla/camino más cercano, en rejilla de 4 px con bilinear ── */
function rejillaLibre(A){
  const W=A.W,H=A.H,C=4,gw=Math.ceil(W/C),gh=Math.ceil(H/C),g=new Float32Array(gw*gh),INF=9999;
  g.fill(INF);const oc=A.ocupado;
  for(let y=0;y<H;y++){const row=y*W,gy=(y/C)|0;for(let x=0;x<W;x++)if(oc[row+x])g[gy*gw+((x/C)|0)]=0;}
  for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){let v=g[j*gw+i];if(!v)continue;
    if(i>0&&g[j*gw+i-1]+1<v)v=g[j*gw+i-1]+1;if(j>0){if(g[(j-1)*gw+i]+1<v)v=g[(j-1)*gw+i]+1;if(i>0&&g[(j-1)*gw+i-1]+1.4<v)v=g[(j-1)*gw+i-1]+1.4;if(i<gw-1&&g[(j-1)*gw+i+1]+1.4<v)v=g[(j-1)*gw+i+1]+1.4;}g[j*gw+i]=v;}
  for(let j=gh-1;j>=0;j--)for(let i=gw-1;i>=0;i--){let v=g[j*gw+i];if(!v)continue;
    if(i<gw-1&&g[j*gw+i+1]+1<v)v=g[j*gw+i+1]+1;if(j<gh-1){if(g[(j+1)*gw+i]+1<v)v=g[(j+1)*gw+i]+1;if(i<gw-1&&g[(j+1)*gw+i+1]+1.4<v)v=g[(j+1)*gw+i+1]+1.4;if(i>0&&g[(j+1)*gw+i-1]+1.4<v)v=g[(j+1)*gw+i-1]+1.4;}g[j*gw+i]=v;}
  // → factor 0..1: 0 pegado a casilla/camino, 1 a partir de ~80 px
  for(let k=0;k<g.length;k++){const d=g[k]*C;g[k]=Math.max(0,Math.min(1,(d-26)/50));}
  return function(x,y){const fx=Math.max(0,Math.min(gw-1.001,x/C-.5)),fy=Math.max(0,Math.min(gh-1.001,y/C-.5)),i=fx|0,j=fy|0,tx=fx-i,ty=fy-j,
    a=g[j*gw+i],b=g[j*gw+i+1],c=g[(j+1)*gw+i],d=g[(j+1)*gw+i+1];return a+(b-a)*tx+(c-a)*ty+(a-b-c+d)*tx*ty;};
}

/* ── cúmulos: lóbulos esféricos → campo de alturas (unión por máximo) → luz arriba-izquierda por normal; sin dithering ── */
const LX=-.52,LY=-.6,LZ=.6;
function pintaNube(A,circ,o){
  const W=A.W,H=A.H,P=A.PAL;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(let i=0;i<circ.length;i++){const c=circ[i];x0=Math.min(x0,c[0]-c[2]);x1=Math.max(x1,c[0]+c[2]);y0=Math.min(y0,c[1]-c[2]);y1=Math.max(y1,c[1]+c[2]);}
  x0=Math.max(-4,Math.floor(x0)-3);y0=Math.max(-4,Math.floor(y0)-3);x1=Math.min(W+3,Math.ceil(x1)+3);y1=Math.min(H+3,Math.ceil(y1)+3);
  const bw=x1-x0+1,bh=y1-y0+1;if(bw<8||bh<8)return;
  const h=new Float32Array(bw*bh).fill(-1);
  for(let k=0;k<circ.length;k++){const c=circ[k],cx=c[0],cy=c[1],r=c[2],dk=c[3]?.3:1;
    const ja=Math.max(y0,Math.floor(cy-r)),jb=Math.min(y1,Math.ceil(cy+r)),ia=Math.max(x0,Math.floor(cx-r)),ib=Math.min(x1,Math.ceil(cx+r));
    for(let j=ja;j<=jb;j++){const dy=(j-cy)/r,row=(j-y0)*bw-x0;for(let i=ia;i<=ib;i++){const dx=(i-cx)/r,d2=dx*dx+dy*dy;if(d2>=1)continue;
      const z=dk===1?r*Math.sqrt(1-d2)+.01:4;if(z>h[row+i])h[row+i]=z;}}}
  const gd=o.gd||64,libre=o.libre,ff=o.ff===undefined?0:o.ff,op=o.op===undefined?1:o.op,mk=o.mask;
  const cW=P.nube,cA=A.mezcla(P.nube,P.nubeSombra,.55),cM=P.nubeSombra,cS=A.mezcla(P.nubeSombra,P.nubeBorde,.7),bB=A.mezcla(P.nubeBorde,P.nubeSombra,.25),bR=A.mezcla(P.nubeSombra,P.nubeBorde,.5);
  const top=new Int32Array(bw).fill(-1);
  for(let j=0;j<bh;j++)for(let i=0;i<bw;i++)if(top[i]<0&&h[j*bw+i]>0)top[i]=j;
  const nl=Math.hypot(LX,LY,LZ),lx=LX/nl,ly=LY/nl,lz=LZ/nl;
  for(let j=1;j<bh-1;j++){const py=j+y0;if(py<0||py>=H)continue;
    for(let i=1;i<bw-1;i++){const q=j*bw+i,v=h[q];if(v<=0)continue;const px=i+x0;if(px<0||px>=W)continue;
      const f=libre(px,py);let a=op*(ff+(1-ff)*f);
      if(o.encoge){if(f<.3)continue;a=op*Math.min(1,f*1.6);}
      const eT=h[q-bw]<=0,eB=h[q+bw]<=0,eL=h[q-1]<=0,eR=h[q+1]<=0;
      if(o.dith&&v<2.6&&!(eB&&v<1.2)){const bx=px&3,by=py&3,bm=((bx*5+by*3)^(by*7+bx))&15;if(v/2.6*16<bm+1)continue;}
      let col;
      if(eB)col=bB;else if(eT)col=cW;else if(eR)col=bR;else if(eL)col=cW;
      else{
        let gx=(h[q+1]-h[q-1])*.5,gy=(h[q+bw]-h[q-bw])*.5;
        if(h[q+1]<=0)gx=-gx;if(h[q-1]<=0)gx=-gx;
        const g=Math.hypot(gx,gy),s=g>2.2?2.2/g:1;gx*=s;gy*=s;
        const nn=Math.sqrt(gx*gx+gy*gy+1),l=(-gx*lx-gy*ly+lz)/nn;
        const dep=Math.min(1,(j-top[i])/gd);
        const L=l+.06-dep*.3+(A.vn(px/4,py/4,9)-.5)*.4*(1-dep*.85);
        col=L>.5?cW:L>.32?cA:L>.1?cM:cS;}
      if(a>=.97)A.px(px,py,col);else if(a>.04)A.pxa(px,py,col,a);
      if(mk&&a>=.9)mk[py*W+px]=1;}}
}
// esponja: sub-lóbulos pequeños en el borde superior/lateral de cada lóbulo grande (aspecto coliflor)
function esponja(circ,R,min,mx){const n=circ.length;
  for(let i=0;i<n;i++){const c=circ[i],r=c[2];if(c[3]||r<min)continue;const k=Math.min(mx,2+((r/4)|0));
    for(let j=0;j<k;j++){const a=-Math.PI*(.05+.9*R())-(R()<.25?.0:0),rr=r*(.26+.22*R());circ.push([c[0]+Math.cos(a)*r*.82,c[1]+Math.sin(a)*r*.82,rr]);}}
  return circ;}
// nube suelta: base plana de lóbulos pequeños + 2-3 lóbulos grandes encima, tamaños muy distintos
function nubeSuelta(R,cx,cy,rx,ry,n){const c=[],yb=cy+ry*.5;
  for(let i=0;i<n;i++){const u=-1+2*(i+.5)/n,r=ry*(.3+.55*R()*R()+.15)*(1-.45*u*u);c.push([cx+u*rx,yb-r*.8,r]);}
  const m=2+((R()*2)|0);
  for(let i=0;i<m;i++){const u=(i/(m-1||1)-.5)*1.1+(R()-.5)*.25,r=ry*(.6+.6*R())*(1-.5*Math.abs(u));c.push([cx+u*rx,yb-ry*.55-r*.35,r]);}
  return c;}
// niebla de cascada/tepuy/manglar: campo suave de lóbulos pequeños y medianos agrupados, alfa cuantizada, más densa abajo
function brumaLobes(A,R,libre,cx,cy,rx,ry,op,mn){
  const W=A.W,H=A.H,P=A.PAL,L=[],n=Math.max(10,mn*2);
  for(let i=0;i<n;i++){const a=R()*6.283,d=Math.sqrt(R()),r=2.5+R()*R()*8+(R()<.12?4:0),yy=cy+Math.sin(a)*d*ry*.7+ry*.35*(R()-.1);
    L.push([cx+Math.cos(a)*d*rx,yy,r,.6+.4*(yy-(cy-ry))/(2*ry+1)]);}
  for(let i=0;i<4;i++)L.push([cx+(R()-.5)*rx*.5,cy-ry*(.2+R()*.7),4+R()*4,.5]);   // jirones que suben
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const c of L){x0=Math.min(x0,c[0]-c[2]*1.5);x1=Math.max(x1,c[0]+c[2]*1.5);y0=Math.min(y0,c[1]-c[2]*1.5);y1=Math.max(y1,c[1]+c[2]*1.5);}
  x0=Math.max(2,Math.floor(x0));y0=Math.max(2,Math.floor(y0));x1=Math.min(W-3,Math.ceil(x1));y1=Math.min(H-3,Math.ceil(y1));
  const bw=x1-x0+1,bh=y1-y0+1;if(bw<8||bh<8)return;
  const f=new Float32Array(bw*bh);
  for(const c of L){const r=c[2]*1.5,k=c[3];
    for(let j=Math.max(y0,Math.floor(c[1]-r));j<=Math.min(y1,Math.ceil(c[1]+r));j++)for(let i=Math.max(x0,Math.floor(c[0]-r));i<=Math.min(x1,Math.ceil(c[0]+r));i++){
      const d=Math.hypot(i-c[0],j-c[1])/r;if(d>=1)continue;const t=1-d*d;f[(j-y0)*bw+i-x0]+=t*t*k*1.15;}}
  const cW=P.nube,cA=A.mezcla(P.nube,P.nubeSombra,.22),cS=A.mezcla(P.nube,P.nubeBorde,.55);
  for(let j=2;j<bh-2;j++)for(let i=2;i<bw-2;i++){const q=j*bw+i,v=f[q];if(v<.3)continue;
    const px=i+x0,py=j+y0,lb=.6+.4*libre(px,py);let a=Math.min(1,(v-.25)*2.4)*Math.min(.95,.7+op*.3)*lb;
    a=Math.round(a*5)/5;if(a<.15)continue;
    const sh=(f[q+2*bw+2]-f[q-2*bw-2])*-1+(A.vn(px/3,py/3,13)-.5)*.35-(v>1.1?.0:.15);
    const col=sh<-.25?cS:sh<.05?cA:cW;
    if(a>=.97)A.px(px,py,col);else A.pxa(px,py,col,a);}
}

F.arte.capa('nubes',70,function(A){
  const W=A.W,H=A.H,P=A.PAL,R=A.rng(7071),dx=A.dx,dy=A.dy;
  const libre=rejillaLibre(A),mask=new Uint8Array(W*H);MASK.set(A,mask);
  const base={libre:libre,encoge:true,ff:0,mask:mask};
  const sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);

  /* 1) banco sur: cresta irregular, lóbulos grandes y pequeños mezclados, jirones que suben sobre la selva */
  const Rr=A.rng(101),circ=[];
  const yTop=x=>{const xd=x/2;return H-84-26*sm((xd-560)/260)+(A.vn(x/60,3,5)-.5)*46+(A.vn(x/23,7,6)-.5)*22;};
  const rsz=(Rz)=>{const q=Rz();return q<.12?30+Rz()*18:q<.4?15+Rz()*12:q<.75?8+Rz()*7:3+Rz()*5;};
  for(let x=-30;x<=W+30;){const tp=yTop(x),r=rsz(Rr);circ.push([x,tp+r*.55,r]);x+=r*(.45+.45*Rr());}
  // segunda hilera de lóbulos medianos más abajo (volumen interior)
  for(let x=-30;x<=W+30;){const tp=yTop(x)+14+Rr()*20,r=9+Rr()*16;circ.push([x,tp+r*.6,r]);x+=r*(.7+.5*Rr());}
  // jirones sueltos que suben sobre la selva
  for(let i=0;i<46;i++){const x=Rr()*W,tp=yTop(x),r=4+Rr()*Rr()*12,up=10+Rr()*26;circ.push([x,tp-up+r*.4,r]);
    if(Rr()<.6)circ.push([x+r*(.8+Rr()),tp-up*.6+r*.5,r*.7]);}
  const rb=54;
  for(let x=-30;x<=W+30;x+=rb*.95){const tp=yTop(x);for(let y=tp+rb*.9;y<H+rb;y+=rb*.85)circ.push([x+(Rr()-.5)*rb*.5,y+(Rr()-.5)*rb*.3,rb*(.8+.4*Rr()),1]);}
  /* banco oeste (x diseño < 135): ≤ 88 px de arte hacia dentro, lóbulos de tamaños muy distintos */
  const Rc=A.rng(303),y0w=dy(290),y1w=dy(830);
  const exO=y=>{const t=(y-y0w)/(y1w-y0w),tp=Math.min(sm(t/.14),sm((1-t)/.12));const g=sm((A.vn(y/55,9,8)-.38)/.2);return Math.max(0,(14+40*sm(t))*(.25+.75*tp)*(.15+.85*g)+(A.vn(y/40,4,8)-.5)*14);};
  for(let y=y0w;y<y1w;){const e=exO(y),r=Math.min(rsz(Rc),e>3?99:3);if(e<4){y+=10;continue;}circ.push([e-r*.45,y,r]);y+=r*(.45+.45*Rc());}
  for(let y=y0w;y<y1w;){const e=exO(y),r=8+Rc()*14;circ.push([e-r-6-Rc()*12,y,r]);y+=r*(.8+.6*Rc());}
  for(let i=0;i<30;i++){const y=y0w+Rc()*(y1w-y0w),e=exO(y),r=3+Rc()*Rc()*9;circ.push([e+r*.3+Rc()*8,y,r]);}
  for(let y=y0w+10;y<y1w+40;y+=22){const e=exO(y);for(let x=-16;x<e-26;x+=36)circ.push([x+Rc()*10,y+Rc()*8,26+Rc()*14,1]);}
  esponja(circ,A.rng(77),10,6);
  pintaNube(A,circ,Object.assign({gd:56,dith:true},base));

  /* 2) nubes sueltas en mar exterior (solo estas dos) */
  // bancos finos pegados al borde este
  [[150,34,0],[520,40,0]].forEach((s,k)=>{const Re=A.rng(900+k),cy=dy(s[0]),c=[],len=s[1]*2.4;
    for(let y=cy-len;y<=cy+len;){const u=(y-cy)/len,e=(1-u*u)*(10+10*Re());const r=5+Re()*Re()*9;c.push([W-3-e*.4,y,r]);y+=r*(.35+.35*Re());}
    for(let i=0;i<8;i++){const y=cy+(Re()-.5)*len*1.6,r=3+Re()*5;c.push([W-4-14-Re()*10,y,r]);}
    pintaNube(A,c,base);});
  // masas ligeras sobre Andes y Ávila (semitransparentes)
  const aereas=[[150,330,56,15],[215,455,66,17],[120,410,46,13],[540,142,52,13],[300,240,48,12]];
  aereas.forEach(s=>pintaNube(A,nubeSuelta(R,dx(s[0]),dy(s[1]),s[2]*1.6,s[3]*1.3,6),{libre:libre,ff:.25,op:.5,encoge:false,mask:null,gd:30}));

  /* 3) brumas con lóbulos: cascada del Salto Ángel, tepuyes y Gran Sabana, delta */
  const Rm=A.rng(555);
  [[735,640,42,22,.8,26],[708,596,40,18,.7,20],[770,610,36,18,.65,18],[845,664,34,17,.65,16],[895,620,30,15,.6,14],
   [790,690,44,14,.6,18],[905,690,34,12,.55,14],[905,305,48,20,.55,22],[935,340,36,16,.5,16],[870,275,34,14,.5,14]]
   .concat([[925,360,40,16,.7,22],[955,430,34,14,.7,18],[880,400,32,13,.65,16],[940,300,30,12,.6,14]])
   .forEach(m=>brumaLobes(A,Rm,libre,dx(m[0]),dy(m[1]),m[2]*1.6,m[3]*1.3,m[4]*1.2,m[5]*1.3|0));
  // brumas finas sobre la zona jugable (nunca sobre casillas)
  const c1=A.campo(150,77,3,8);
  for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){if(A.tierra[y*W+x]!==1)continue;const v=c1(x,y);if(v<.62)continue;
    const a=Math.min(.2,.08+(v-.62)*.7)*libre(x,y);const q=Math.round(a*12)/12;if(q>.05){A.pxa(x,y,P.nube,q);A.pxa(x+1,y,P.nube,q);A.pxa(x,y+1,P.nube,q);A.pxa(x+1,y+1,P.nube,q);}}

  /* 4) jirones animados que derivan a la derecha y vuelven (≤ 20) */
  const pos=[[60,75],[330,50],[440,30],[880,50],[960,130],[740,205],[610,220],[975,430],[40,430],[130,300],[210,370],[540,110],[320,205],[800,45],[510,50],[975,640],[80,640],[250,620]];
  for(let i=0;i<pos.length&&i<18;i++){const f=A.hash(i,3,99);
    A.dyn.push({k:'nube',x:Math.round(dx(pos[i][0])),y:Math.round(dy(pos[i][1])),w:14+Math.round(f*14),vel:2+f*2.5,span:70+Math.round(f*40),f:Math.round(f*100)/100});}
});

F.arte.din.nube=function(c,e,t){
  const span=e.span||80,ph=(((t*e.vel)/span)+(e.f||0))%1,fade=Math.sin(ph*Math.PI);if(fade<=.05)return;
  const x=Math.round(e.x+ph*span),y=e.y,w=e.w,a=.55*Math.min(1,fade*1.6);
  c.fillStyle='rgba(255,255,255,'+a.toFixed(2)+')';
  c.fillRect(x+(w>>2),y-1,w>>1,1);c.fillRect(x,y,w,1);c.fillRect(x+(w>>3),y+1,(w*3)>>2,1);
  c.fillStyle='rgba(168,190,220,'+(a*.7).toFixed(2)+')';c.fillRect(x+(w>>2),y+2,w>>1,1);
};

/* ── acabado ── */
F.arte.capa('acabado',90,function(A){
  const W=A.W,H=A.H,P=A.PAL,buf=A.buf,tierra=A.tierra,mask=MASK.get(A)||new Uint8Array(W*H),oc=A.ocupado;
  // (c) contorno de 1 px en la costa (lado tierra) donde aún no lo haya
  const marco=A.rgb(P.contorno),oscuro=(c)=>{const r=c&255,g=(c>>8)&255,b=(c>>16)&255;return r*.3+g*.59+b*.11<62;};
  const marca=[];
  for(let y=1;y<H-1;y++){const row=y*W;for(let x=1;x<W-1;x++){const i=row+x;if(tierra[i]!==1||mask[i])continue;
    if(tierra[i-1]===1&&tierra[i+1]===1&&tierra[i-W]===1&&tierra[i+W]===1)continue;
    const c=buf[i];if(!oscuro(c))marca.push(i);}}
  for(let k=0;k<marca.length;k++){const i=marca[k];buf[i]=A.mezcla(buf[i],marco,.72);}
  // (a) sombras proyectadas (abajo-derecha) sobre tierra: máscara a 1/4 de resolución, desenfocada, muestreada bilineal
  {const C=4,gw=Math.ceil(W/C),gh=Math.ceil(H/C);let g=new Float32Array(gw*gh),t=new Float32Array(gw*gh);
   for(let y=0;y<H;y++){const row=y*W,gr=((y/C)|0)*gw;for(let x=0;x<W;x++)if(mask[row+x])g[gr+((x/C)|0)]+=1/(C*C);}
   for(let p=0;p<3;p++){
     for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){let s=0,n=0;for(let d=-2;d<=2;d++){const ii=i+d;if(ii>=0&&ii<gw){s+=g[j*gw+ii];n++;}}t[j*gw+i]=s/n;}
     for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){let s=0,n=0;for(let d=-2;d<=2;d++){const jj=j+d;if(jj>=0&&jj<gh){s+=t[jj*gw+i];n++;}}g[j*gw+i]=s/n;}}
   const OX=26,OY=34;
   for(let y=0;y<H;y++){const row=y*W,fy=Math.max(0,Math.min(gh-1.001,(y-OY)/C-.5)),j=fy|0,ty=fy-j;
    for(let x=0;x<W;x++){const i=row+x;if(tierra[i]===0||mask[i])continue;
      const fx=Math.max(0,Math.min(gw-1.001,(x-OX)/C-.5)),ii=fx|0,tx=fx-ii,
        a0=g[j*gw+ii],b0=g[j*gw+ii+1],c0=g[(j+1)*gw+ii],d0=g[(j+1)*gw+ii+1],v=a0+(b0-a0)*tx+(c0-a0)*ty+(a0-b0-c0+d0)*tx*ty;
      if(v>.02){let a=Math.min(1,v*1.2)*.17;if(oc[i])a*=.5;buf[i]=A.mezcla(buf[i],0xff5a3a24,a);}}}}
  // (a) tinte atmosférico suave: azulado y algo más velado hacia los bordes/lejos; (b) viñeta ~10 % en bordes
  const tinte=A.rgb('#8cc0ff');
  for(let y=0;y<H;y++){const ny=(y/H-.5)*2,row=y*W;for(let x=0;x<W;x++){const i=row+x;if(mask[i])continue;const nx=(x/W-.5)*2,r2=nx*nx*.8+ny*ny*.8;
    let c=buf[i];const kt=tierra[i]===0?.02:.025+.03*Math.min(1,r2);c=A.mezcla(c,tinte,kt);
    const vv=(Math.sqrt(r2)-.78)/.5;if(vv>0){const s=vv>=1?1:vv*vv*(3-2*vv);c=A.sombrea(c,.10*s);}
    buf[i]=c;}}
  // nubes: solo viñeta, sin tinte
  for(let y=0;y<H;y++){const ny=(y/H-.5)*2,row=y*W;for(let x=0;x<W;x++){const i=row+x;if(!mask[i])continue;const nx=(x/W-.5)*2,r2=nx*nx*.8+ny*ny*.8;
    const vv=(Math.sqrt(r2)-.78)/.5;if(vv>0){const s=vv>=1?1:vv*vv*(3-2*vv);buf[i]=A.sombrea(buf[i],.07*s);}}}
  // sin huecos: todo píxel transparente → mar profundo
  const fondo=A.rgb(P.marProfundo);for(let i=0;i<W*H;i++)if(buf[i]===0)buf[i]=fondo;
});
})(typeof window!=='undefined'?window:globalThis);
