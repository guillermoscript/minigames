// LA FIESTA · arte del mapa: capa «hitos» (orden 60): Caracas + Ávila, puente y torres petroleras del Lago, teleféricos, Guayana,
// fincas con vacas y chigüires, palafitos del delta y detalles venezolanos. Pixel-art oblicuo, luz arriba-izquierda, determinista.
// Ronda 2: todo a ~2x (legible a escala de mapa), ciudades en cuadrícula densa de terrazas sobre una base urbana, puertos y barcos.
(function(root){'use strict';const F=root.FIESTA=root.FIESTA||{};
if(typeof module!=='undefined'&&typeof require!=='undefined'&&!F.arte)require('./fiesta-mapa-arte.js');
const AR=F.arte;

AR.din.llama=function(c,e,t){const s=e.s||1,f=Math.sin(t*13+e.x*.7)+Math.sin(t*7.3+e.y),h=Math.round((2+((f+2)*.9|0))*s);
  c.fillStyle='#ff7a1a';c.fillRect(e.x-1*s,e.y-h,2*s,h);c.fillStyle='#ffd23a';c.fillRect(e.x-(f>0?0:1),e.y-h+1,1*s,Math.max(1,h-1));
  c.fillStyle='#fff6b0';c.fillRect(e.x-(f>0?0:1),e.y-1,1,1);};
AR.din.humo=function(c,e,t){const s=e.s||1;for(let i=0;i<4;i++){const p=((t*.45+i*.25+e.x*.013)%1),a=(1-p)*.55;
  c.globalAlpha=a;c.fillStyle=e.c||'#e8eef4';const r=(1+(p*2|0))*s;c.fillRect(e.x+Math.sin(p*5+i)*2*s+p*5*s-r/2,e.y-p*22*s,r+1,r);}
  c.globalAlpha=1;};

AR.capa('hitos',60,function(A){
  const PAL=A.PAL,W=A.W,H=A.H,rg=A.rng(6001);
  const usado=new Uint8Array(W*H),res=new Uint8Array(W*H),cola=[];
  const OUT='#26181c';
  const ent=(y,f)=>cola.push({y:y,f:f});
  const sh=(x,y,c,a)=>A.pxa(x,y,c,a);
  const ctr=(c,k)=>A.sombrea(c,k),cl=(c,k)=>A.aclara(c,k);

  /* ── reservado: discos de casilla (r 15) y caminos (±6): lo único que NO se pisa ── */
  (function(){
    const marc=(cx,cy,r)=>{for(let y=Math.max(0,Math.floor(cy-r));y<=Math.min(H-1,Math.ceil(cy+r));y++)for(let x=Math.max(0,Math.floor(cx-r));x<=Math.min(W-1,Math.ceil(cx+r));x++)
      if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=r*r)res[y*W+x]=1;};
    try{const mapa=A.mapa,N=mapa.nodos,SX=A.SX||2,SY=A.SY||1.5;A.nodos.forEach(n=>marc(n.x,n.y,11));
      const ady=mapa.ady||{};Object.keys(ady).forEach(a=>{const na=N[a];if(!na)return;(ady[a]||[]).forEach(b=>{const nb=N[b];if(!nb)return;
        const rt=(mapa.rutas||[]).find(r=>(r.de===a&&r.a===b)||(r.de===b&&r.a===a));if(rt&&/aire|avion|salto|ferry|lancha|chalana|curiara|penero|teleferico|metro/.test(rt.modo||''))return;
        const x0=na.x*SX,y0=na.y*SY,x1=nb.x*SX,y1=nb.y*SY,L=Math.max(1,Math.hypot(x1-x0,y1-y0)),n=Math.ceil(L/3);
        for(let k=0;k<=n;k++)marc(x0+(x1-x0)*k/n,y0+(y1-y0)*k/n,3);});});
    }catch(e){for(let i=0;i<W*H;i++)res[i]=A.ocupado[i];}
  })();

  /* ── huecos libres ── */
  const reservaPuente=()=>mk(A.dx(100)-6,A.dy(213)-50,A.dx(186)+6,A.dy(213)+16);
  const libreR=(x0,y0,x1,y1,modo)=>{if(x0<1||y0<1||x1>=W-1||y1>=H-1)return false;
    for(let j=y0;j<=y1;j++){const o=j*W;for(let i=x0;i<=x1;i++){const k=o+i;if(usado[k]||res[k])return false;
      if(modo==='agua'){if(A.tierra[k]!==2)return false;}else if(modo!=='any'&&A.tierra[k]!==1)return false;}}return true;};
  const mk=(x0,y0,x1,y1)=>{x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);for(let j=Math.max(0,y0);j<=Math.min(H-1,y1);j++)for(let i=Math.max(0,x0);i<=Math.min(W-1,x1);i++)usado[j*W+i]=1;};
  const ok=(x,y,w,h,m,modo)=>libreR(x-(m||0),y-h-(m||0),x+w+(m||0),y+(m||0),modo);
  const marca=(x,y,w,h)=>mk(x-1,y-h-1,x+w+1,y+1);
  const busca=(x,y,w,h,rad,modo,m)=>{x=Math.round(x);y=Math.round(y);if(ok(x,y,w,h,m,modo))return[x,y];
    for(let r=2;r<=rad;r+=2)for(let a=0;a<12;a++){const an=a*Math.PI/6+r*.37,i=Math.round(x+Math.cos(an)*r),j=Math.round(y+Math.sin(an)*r*.8);if(ok(i,j,w,h,m,modo))return[i,j];}
    return null;};
  const esAgua=(x,y)=>{const c=A.get(x,y),r=c&255,g=(c>>8)&255,b=(c>>16)&255;return b>190&&r<150&&b>r+60&&b>=g;};
  const esPurpura=(x,y)=>{const c=A.get(x,y),r=c&255,g=(c>>8)&255,b=(c>>16)&255;return b>=110&&b>g+40&&r>g+10&&b>=r+10;};
  const ratio=(f,x,y,w,h)=>{let n=0,t=0;for(let j=0;j<h;j+=2)for(let i=0;i<w;i+=2){t++;if(f(x+i,y+j))n++;}return n/t;};

  reservaPuente();
  /* ── edificios ── */
  const BARRIO=[PAL.pared1,PAL.pared2,PAL.pared3,PAL.pared4,'#e86a8a','#7ac870','#f0a830','#c868c8','#58c8c0','#f4b0a0','#f2ece0','#e8c070'];
  const TECHO=[PAL.tejas,PAL.tejas,PAL.tejas,'#b83a2a','#d8683a','#8a6a58','#a8b0b8','#3a78b8'];
  const RANCHO=['#e86a8a','#f0a830','#58c8c0','#6aa8e0','#e8854a','#c868c8','#f0d060','#9ad870'];
  const LATA=['#8a8f98','#a8aeb8','#b8644a','#7a6a5a'];
  const ALTO=['#b8c0d0','#d8dce4','#9ab0cc','#e8d8c0','#a8b4a8','#8fb0c8'];

  function casa(x,y,w,h,rh,pared,techo){
    for(let i=1;i<=w+1;i++)sh(x+i,y+1,PAL.sombra,.3);for(let j=-h;j<=0;j++)sh(x+w+1,y+j+1,PAL.sombra,.22);
    A.rect(x,y-h,w,h,pared);A.rect(x+w-2,y-h,2,h,ctr(pared,.2));A.rect(x,y-1,w,1,ctr(pared,.14));A.rect(x,y-h,1,h,cl(pared,.2));
    A.rect(x-1,y-h-rh,w+2,rh,techo);A.rect(x-1,y-h-rh,w+2,1,cl(techo,.32));A.rect(x-1,y-h-1,w+2,1,ctr(techo,.3));
    if(h>=4){A.rect(x+1,y-h+1,2,2,'#2a2030');A.px(x+1,y-h+1,'#9ad0f0');if(w>=7){A.rect(x+w-4,y-3,2,3,'#4a2e22');}else A.px(x+w-3,y-2,'#4a2e22');}
    const o=ctr(pared,.62),ot=ctr(techo,.62);
    A.rect(x-1,y-h-rh-1,w+2,1,ot);A.rect(x-1,y,w+2,1,o);
    for(let j=-h-rh;j<=-1;j++){A.px(x-1,y+j,j<-h?ot:o);A.px(x+w,y+j,j<-h?ot:o);}}

  function torre(x,y,w,h,col){
    for(let i=1;i<=h*.28;i++)for(let j=-1;j<=2;j++)sh(x+w+i,y+j+(i>>2),PAL.sombra,.26);
    A.rect(x,y-h,w,h,col);A.rect(x,y-h,2,h,cl(col,.3));A.rect(x+w-3,y-h,3,h,ctr(col,.26));
    A.rect(x-1,y-h-2,w+2,2,cl(col,.5));A.rect(x-1,y-h,w+2,1,ctr(col,.4));
    for(let j=y-h+3;j<y-4;j+=3)for(let i=x+2;i<x+w-3;i+=2){A.rect(i,j,1,2,(i*7+j*3)%11===0?'#ffe9a0':'#3a4c78');}
    A.rect(x+(w>>1)-1,y-3,3,3,'#2a2a38');
    const o=ctr(col,.66);A.rect(x-1,y-h-3,w+2,1,o);A.rect(x-1,y,w+2,1,o);A.rect(x-1,y-h-3,1,h+4,o);A.rect(x+w,y-h-3,1,h+4,o);
    if(h>30){A.rect(x+(w>>1),y-h-8,1,5,'#d8d8e0');A.px(x+(w>>1),y-h-9,'#ff3030');}}
  function gemela(x,y,w,h,k){
    const c=k?'#8fa2c4':'#9aaccc';
    for(let i=1;i<=h*.3;i++)for(let j=-1;j<=3;j++)sh(x+w+i,y+j+(i>>2),PAL.sombra,.28);
    A.rect(x,y-h,w,h,c);A.rect(x,y-h,2,h,'#c8d8f0');A.rect(x+w-3,y-h,3,h,'#6c7ea4');
    for(let j=y-h+3;j<y-3;j+=3){A.rect(x+2,j,w-5,1,'#3a5282');A.rect(x+2,j+1,w-5,1,(j*5+k)%9===0?'#ffe9a0':'#5a78aa');}
    A.poli([[x-1,y-h],[x+w,y-h],[x+w-2,y-h-5],[x+1,y-h-5]],'#d8e4f8');A.rect(x-1,y-h-5,w+2,1,'#26304a');
    A.rect(x+(w>>1),y-h-13,1,8,'#d8d8e0');A.px(x+(w>>1),y-h-14,'#ff3030');
    const o='#26304a';A.rect(x-1,y-h-5,1,h+6,o);A.rect(x+w,y-h-5,1,h+6,o);A.rect(x-1,y,w+2,1,o);A.rect(x+2,y-4,w-4,4,'#2a2a38');}

  /* ── ciudad: base urbana + filas contiguas de casas en terrazas (sin separación) ── */
  function ciudad(cx,cy,rx,ry,seed,o){o=o||{};const r=A.rng(seed);
    ent(-1,()=>{for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){
      const d=Math.hypot((x-cx)/rx,(y-cy)/ry);if(d>=1)continue;const k=y*W+x;if(x<0||y<0||x>=W||y>=H||A.tierra[k]!==1||res[k])continue;
      const hh=A.hash(x>>1,y>>1,seed);if(d>.8&&(hh%100)/100<(d-.8)*5)continue;
      A.px(x,y,((x+y)&1)&&hh%9<2?'#a48e72':'#b6a488');}});
    let row=0;
    for(let y=Math.round(cy-ry+7);y<=cy+ry;row++){
      const alta=o.yr&&y<o.yr,h=alta?3+(r()*2|0):(o.h||4)+(r()*3|0),rh=alta?2:3;
      for(let x=Math.round(cx-rx);x<cx+rx;){
        const w=alta?5+(r()*2|0):6+(r()*4|0),d=Math.hypot((x+w/2-cx)/rx,(y-cy)/ry);
        if(d<.97&&!(d>.78&&r()>(1-d)*4.5)){
          if(libreR(x-1,y-h-rh-1,x+w,y)){mk(x-1,y-h-rh-1,x+w,y-1);
            const hv=(r()*3|0)-1;const px=x,py=y,pc=alta?RANCHO[(r()*RANCHO.length)|0]:BARRIO[(r()*BARRIO.length)|0],tc=alta?LATA[(r()*LATA.length)|0]:TECHO[(r()*TECHO.length)|0],hh=Math.max(3,h+hv),rr=rh,ww=w;
            ent(py,()=>casa(px,py,ww,hh,rr,pc,tc));x+=w+1+(r()<.1?2:0);continue;}}
        x+=3;}
      y+=h+rh+1;}}

  /* ── edificio de frente (ventanas, techo, contorno): casas, bloques y torres de Caracas ── */
  const VENT='#27324f',VENTL='#ffe9a0',VIDRIO='#9ad0f0';
  function edif(x,y,w,h,pared,tipo,sd,techo){
    x=Math.round(x);y=Math.round(y);const o=ctr(pared,.66);
    for(let i=1;i<=w+3;i++)sh(x+i,y+1,PAL.sombra,.34);
    for(let j=0;j<Math.min(h,16);j++){sh(x+w+1,y-j+2,PAL.sombra,.2);sh(x+w+2,y-j+3,PAL.sombra,.13);}
    A.rect(x,y-h,w,h,pared);A.rect(x,y-h,1,h,cl(pared,.24));A.rect(x+w-2,y-h,2,h,ctr(pared,.2));A.rect(x,y-1,w,1,ctr(pared,.16));
    const nf=tipo===0?1:2;
    for(let j=y-h+3,f=0;j<=y-4;j+=(tipo===2?4:(tipo===0?4:5)),f++)for(let i=x+2;i<=x+w-4;i+=3){const hv=A.hash(i,j,sd);const lit=hv%6===0;
      A.rect(i,j,2,2,lit?VENTL:VENT);A.px(i,j,lit?'#fff6c8':VIDRIO);if(tipo===1&&f%2===0)A.rect(i-1,j+2,4,1,ctr(pared,.12));}
    let rt=0;
    if(tipo===0||tipo===3){ // techo de tejas rojas (hip) o de lata (rancho)
      const rh=tipo===3?2:(w>=9?4:3),tc=techo||PAL.tejas;rt=rh;
      for(let j=0;j<rh;j++){const ins=rh-1-j;A.rect(x-1+ins,y-h-rh+j,w+2-ins*2,1,j===0?cl(tc,.3):j===rh-1?ctr(tc,.22):tc);}
      A.rect(x+w-3,y-h-rh+1,2,rh-1,ctr(tc,.18));
      A.rect(x-1,y-h-rh-1,w+2,1,ctr(tc,.62));
    }else if(tipo===1){ // azotea con antepecho, tanque o aire
      rt=2;A.rect(x-1,y-h-2,w+2,2,cl(pared,.4));A.rect(x-1,y-h-2,w+2,1,cl(pared,.62));A.rect(x-1,y-h-3,w+2,1,o);
      const hv=A.hash(x,y,sd);if(hv%3===0){A.rect(x+2,y-h-5,3,3,'#a8b0b8');A.rect(x+2,y-h-5,3,1,'#e0e4ea');A.rect(x+2,y-h-6,3,1,o);}
      else if(hv%3===1){A.rect(x+w-5,y-h-4,3,2,'#c8ccd4');A.rect(x+w-5,y-h-5,3,1,o);}
    }else{ // torre: remate escalonado y antena
      rt=2;A.rect(x-1,y-h-2,w+2,2,cl(pared,.5));A.rect(x-1,y-h-3,w+2,1,o);
      const sw=Math.max(3,(w*.55)|0),sx=x+((w-sw)>>1);A.rect(sx,y-h-6,sw,3,ctr(pared,.1));A.rect(sx,y-h-6,1,3,cl(pared,.3));A.rect(sx-1,y-h-7,sw+2,1,o);A.rect(sx-1,y-h-6,1,3,o);A.rect(sx+sw,y-h-6,1,3,o);
      A.rect(x+(w>>1),y-h-12,1,5,'#d8d8e0');A.px(x+(w>>1),y-h-13,'#ff3030');}
    A.rect(x-1,y,w+2,1,o);A.rect(x-1,y-h-rt-(tipo===0||tipo===3?1:0),1,h+rt+1+(tipo===0||tipo===3?1:0),o);A.rect(x+w,y-h-rt,1,h+rt+1,o);
    if(tipo===1){A.rect(x+(w>>1)-1,y-3,3,3,'#2a1c16');if(tipo===1&&A.hash(x,y,sd+1)%3===0)A.rect(x+1,y-4,w-2,1,'#d8382a');}}
  function arbol(x,y,r){r=r||3;for(let i=-r;i<=r+1;i++)sh(x+i+1,y+1,PAL.sombra,.3);A.rect(x,y-2,1,3,'#4a3220');
    A.disc(x,y-r-2,r+1,'#1c4a22');A.disc(x,y-r-2,r,'#2f7a32');A.disc(x-1,y-r-3,r-1,'#4ea64a');A.px(x-r+1,y-r-4,'#9ad870');A.px(x+1,y-r-1,'#215a28');}
  function metroPortal(x,y){ // portal de hormigón con arco, letrero M y rieles al sur
    for(let i=1;i<=37;i++)sh(x+i,y+1,PAL.sombra,.32);
    A.rect(x,y-22,36,22,'#c8ccd4');A.rect(x+31,y-22,5,22,'#9ca2b0');A.rect(x,y-22,36,3,'#e8eaf0');A.rect(x,y-1,36,1,'#8a90a0');A.rect(x,y-22,1,22,'#f0f2f6');
    A.ell(x+16,y-10,9,9,'#10101a');A.rect(x+7,y-10,19,10,'#10101a');A.ell(x+16,y-10,9,9,'#1c1c2a');A.rect(x+7,y-10,19,10,'#1c1c2a');A.rect(x+9,y-2,15,2,'#3a3a46');
    for(let i=-9;i<=9;i++){const yy=Math.round(y-10-Math.sqrt(Math.max(0,81-i*i)));A.px(x+16+i,yy-1,'#8a90a0');A.px(x+16+i,yy,'#e8eaf0');}
    A.disc(x+5,y-15,4,'#e0383a');A.disc(x+5,y-15,3,'#ff5a4a');A.rect(x+3,y-17,1,4,'#fff');A.rect(x+7,y-17,1,4,'#fff');A.px(x+4,y-16,'#fff');A.px(x+6,y-15,'#fff');
    A.rect(x+26,y-14,3,3,'#9ad0f0');A.rect(x+26,y-9,3,3,'#9ad0f0');
    const o='#3a3e4a';A.rect(x-1,y,38,1,o);A.rect(x-1,y-23,38,1,o);A.rect(x-1,y-23,1,23,o);A.rect(x+36,y-23,1,24,o);
    for(let k=1;k<=7;k++){A.rect(x+10+(k>>1)*0,y+k,13,1,'#5a5a68');if(k%2)for(let i=0;i<13;i+=3)A.rect(x+10+i,y+k,1,1,'#4a3a2a');A.rect(x+9,y+k,1,1,'#8a8a98');A.rect(x+23,y+k,1,1,'#8a8a98');}}
  function estadio(x,y){ // x izq, y base: óvalo de 28 px con graderío rojo, césped y torres de luz
    const cx=x+14;A.ell(cx+2,y-1,15,5,PAL.sombra,.3);
    A.ell(cx,y-3,14,6,OUT);A.ell(cx,y-4,13,6,'#4e5a74');A.ell(cx,y-8,14,7,OUT);A.ell(cx,y-9,13,6,'#d8dfec');A.ell(cx-1,y-10,11,5,'#f0f4fa');
    A.ell(cx,y-9,10,5,'#c83a3a');A.ell(cx,y-9,8,4,'#e85a4a');A.ell(cx,y-9,6.5,3.2,'#8894ac');A.ell(cx,y-9,5.5,2.6,'#4fa84a');A.ell(cx-1,y-10,4,1.6,'#7ac870');A.rect(cx-5,y-9,11,1,'#a8e090');
    for(let i=-10;i<=10;i+=2)A.px(cx+i,y-9-((10*Math.sqrt(Math.max(0,1-i*i/100))*.5)|0),(i&2)?'#fff':'#ffd8c8');
    A.rect(cx-3,y-3,7,3,'#1a1a28');A.rect(cx-3,y-3,7,1,'#8a90a0');
    [[-14,-14],[14,-14],[-12,-3],[13,-3]].forEach(p=>{A.rect(cx+p[0],y+p[1]-11,1,12,'#c8ccd4');A.rect(cx+p[0]-1,y+p[1]-13,3,2,'#fff6b0');A.px(cx+p[0],y+p[1]-14,'#fff');});}
  function gemelas(x,y){ // Parque Central: dos torres de 44 y 48 px sobre un podio ancho con plaza
    for(let i=1;i<=36;i++)sh(x+i,y+1,PAL.sombra,.34);
    A.rect(x-2,y-7,36,8,'#8a8f9c');A.rect(x-2,y-7,36,2,'#d8dce8');A.rect(x-2,y,36,1,OUT);A.rect(x-2,y-7,1,8,OUT);A.rect(x+33,y-7,1,8,OUT);
    for(let i=1;i<35;i+=5)A.rect(x+i,y-4,2,3,'#3a4a68');
    gemela(x+2,y-6,12,44,0);gemela(x+19,y-6,12,48,1);A.rect(x+14,y-30,5,4,'#6c7ea4');A.rect(x+14,y-30,5,1,'#c8d8f0');A.rect(x+14,y-27,5,1,'#26304a');
    arbol(x-5,y,3);arbol(x+36,y,3);}

  /* ── CARACAS: núcleo denso (3 alturas), torres gemelas, estadio, metro, teleférico y árboles; las casillas quedan como calles ── */
  (function(){
    const par=A.nodo('ccs_parquecentral')||{x:970,y:307},sta=A.nodo('ccs_start')||{x:1040,y:300},pet=A.nodo('ccs_petare')||{x:1170,y:322},mt=A.nodo('ccs_metro')||{x:940,y:322};
    const PALC=['#f2ece0','#e8dcc4','#d8d0c0','#e6b8a0','#d8a890','#c8d4c0','#e8d8a0','#b8c8d8','#f0e4d0','#e0a8a0','#a8c0b0','#e8c070'];
    const cxm=(par.x+pet.x)/2+6,cym=sta.y+42,RX=205,RY=82,X0=Math.round(par.x-60),X1=Math.round(pet.x+85);
    // suelo urbano: asfalto cálido con parches
    ent(-2,()=>{for(let y=Math.floor(cym-RY);y<=cym+RY;y++)for(let x=Math.floor(cxm-RX);x<=cxm+RX;x++){
      const d=Math.hypot((x-cxm)/RX,(y-cym)/RY);if(d>=1||x<0||y<0||x>=W||y>=H)continue;const k=y*W+x;if(A.tierra[k]!==1||res[k])continue;
      const hh=A.hash(x>>1,y>>1,4242);if(d>.82&&(hh%100)/100<(d-.82)*5.5)continue;A.px(x,y,((x+y)&1)&&hh%9<2?'#9a8c76':'#aa9c84');}});
    const cuerpo=(x0,y0,x1,y1)=>{if(x0<1||y0<1||x1>=W-1||y1>=H-1)return false;for(let j=y0;j<=y1;j++){const o=j*W;for(let i=x0;i<=x1;i++){const k=o+i;if(res[k]||A.tierra[k]!==1)return false;}}return true;};
    // hitos primero (marcan todo su rectángulo)
    const g=busca(par.x+50,sta.y+62,34,58,60,'tierra',2);
    if(g){marca(g[0],g[1],34,58);ent(g[1]+2,()=>gemelas(g[0],g[1]));}
    const e=busca(sta.x-10,sta.y+90,30,17,60,'tierra',2);
    if(e){marca(e[0],e[1],30,17);mk(e[0]-3,e[1]+1,e[0]+33,e[1]+9);ent(e[1],()=>estadio(e[0],e[1]));}
    const m=busca(mt.x-14,mt.y+52,38,22,60,'tierra',2);
    if(m){marca(m[0],m[1],38,22);ent(m[1]+8,()=>metroPortal(m[0],m[1]));}
    // manzanas: filas de frente; sólo el pie del edificio ocupa sitio, así los de atrás asoman por encima
    const rl=A.rng(7001);let nB=0;
    for(let y=284;y<=cym+RY-4;y+=7+(rl()*4|0)){
      const alta=y<302;
      for(let x=X0;x<X1;){
        const w=alta?6+(rl()*3|0):8+(rl()*6|0),d=Math.hypot((x+w/2-cxm)/RX,(y-cym)/RY);
        if(d>=.98||(d>.62&&rl()<(d-.62)*1.7)){x+=4;continue;}
        let h,tipo,col,tc=null;
        if(alta){h=5+(rl()*3|0);tipo=3;col=RANCHO[(rl()*RANCHO.length)|0];tc=LATA[(rl()*LATA.length)|0];}
        else if(d<.34){h=18+(rl()*13|0);tipo=h>=24?2:1;col=ALTO[(rl()*ALTO.length)|0];}
        else if(d<.66){h=12+(rl()*9|0);tipo=rl()<.65?1:0;col=PALC[(rl()*PALC.length)|0];}
        else{h=8+(rl()*5|0);tipo=0;col=PALC[(rl()*PALC.length)|0];}
        const rt=tipo===0?(w>=9?4:3):tipo===3?2:tipo===1?3:13;
        if(cuerpo(x-1,y-h-rt-1,x+w+1,y)&&libreR(x-1,y-4,x+w+1,y)){
          mk(x-1,y-4,x+w+1,y+1);nB++;const px=x,py=y,pw=w,ph=h,pt=tipo,pc=col,ptc=tc,sd=(nB*31)|0;ent(py,()=>edif(px,py,pw,ph,pc,pt,sd,ptc));x+=w+2+(rl()*3|0);continue;}
        x+=3;}}
    // árboles en las calles y plazas
    let nT=0;for(let k=0;k<420&&nT<60;k++){const hh=A.hash(k,77,9),x=Math.round(cxm-RX+hh%(2*RX)),y=Math.round(cym-RY+((hh>>10)%(2*RY)));
      if(Math.hypot((x-cxm)/RX,(y-cym)/RY)>.95)continue;if(!cuerpo(x-4,y-8,x+4,y)||!libreR(x-3,y-3,x+3,y))continue;mk(x-3,y-3,x+3,y+1);nT++;ent(y,()=>arbol(x,y,2+(hh%3===0?1:0)));}
    // antena en el Ávila
    const an=busca(par.x+60,par.y-76,6,22,60,'tierra',2);
    if(an)ent(an[1],()=>{const x=an[0],y=an[1];A.linea(x,y,x+2,y-22,'#d8d8e0');A.linea(x+6,y,x+3,y-22,'#d8d8e0');for(let j=4;j<22;j+=5)A.linea(x+(j<10?0:1),y-j,x+5-(j/7|0),y-j+3,'#b8283a');A.rect(x+1,y-25,3,3,'#e8e8f0');A.px(x+2,y-26,'#ff3030');});
  })();

  /* ── Teleféricos (Ávila y Mérida) ── */
  function cabina(x,y){ // cabina roja grande colgada del cable (16x12)
    A.rect(x-1,y-1,2,4,'#222230');A.rect(x-4,y+2,9,1,'#3a3a48');
    A.rect(x-8,y+3,16,12,'#c8201e');A.rect(x-8,y+3,16,2,'#ff8a6a');A.rect(x-8,y+3,1,12,'#ff6a5a');A.rect(x+5,y+3,3,12,'#8a1418');
    A.rect(x-6,y+6,12,5,'#9ad8ff');A.rect(x-6,y+6,12,1,'#e8f8ff');A.rect(x-1,y+6,1,5,'#c8201e');A.rect(x-6,y+11,12,1,'#5a98c0');A.rect(x-8,y+14,16,1,'#5a0e10');
    A.rect(x-9,y+2,18,1,OUT);A.rect(x-9,y+15,18,1,OUT);A.rect(x-9,y+2,1,14,OUT);A.rect(x+8,y+2,1,14,OUT);
    for(let i=-8;i<=9;i++)sh(x+i+3,y+19,PAL.sombra,.28);}
  function estacion(x,y,w,h){A.rect(x-w/2,y-h,w,h,'#d8dce4');A.rect(x-w/2+w-4,y-h,4,h,'#9ca2b0');A.rect(x-w/2,y-h,1,h,'#fff');A.rect(x-w/2-2,y-h-5,w+4,5,PAL.tejas);A.rect(x-w/2-2,y-h-5,w+4,1,'#ff8a5a');
    A.rect(x-w/2+3,y-5,5,5,'#14141c');A.rect(x-w/2+3,y-h+3,w-10,3,'#9ad0f0');A.rect(x-w/2-2,y,w+4,1,OUT);A.rect(x-w/2-2,y-h-6,w+4,1,OUT);A.rect(x-w/2-2,y-h-6,1,h+7,OUT);A.rect(x+w/2+1,y-h-6,1,h+7,OUT);for(let i=1;i<=w+3;i++)sh(x-w/2+i,y+1,PAL.sombra,.3);}
  function telef(x0,y0,x1,y1,ks,sag){sag=sag||5;x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
    const dx=x1-x0,dy=y1-y0,n=Math.max(Math.abs(dx),Math.abs(dy)),py=t=>y0+dy*t+Math.sin(t*Math.PI)*sag;
    // cabinas donde no pisen casillas
    const cab=[];ks.forEach(k=>{for(let d=0;d<=.25;d+=.02)for(const sg of[0,-1,1]){const t=k+sg*d,cx=Math.round(x0+dx*t),cy=Math.round(py(t));
      let bad=false;for(let j=cy;j<=cy+16&&!bad;j++)for(let i=cx-9;i<=cx+9;i++)if(res[j*W+i]){bad=true;break;}if(!bad&&cab.every(c=>Math.hypot(c[0]-cx,c[1]-cy)>26)){cab.push([cx,cy]);return;}}});
    mk(Math.min(x0,x1)-10,Math.min(y0,y1)-16,Math.max(x0,x1)+10,Math.max(y0,y1)+4);
    ent(Math.max(y0,y1)+14,()=>{
      for(let t=.28;t<.9;t+=.3){const px=Math.round(x0+dx*t),pp=Math.round(py(t));A.rect(px-1,pp-12,3,14,'#4a4a56');A.rect(px-1,pp-12,1,14,'#8a8a98');A.rect(px-5,pp-12,11,2,'#4a4a56');A.rect(px-5,pp-12,11,1,'#9a9aa8');A.linea(px-3,pp+1,px,pp-10,'#34343e');A.linea(px+3,pp+1,px,pp-10,'#34343e');A.rect(px-2,pp+2,5,1,OUT);}
      for(let i=0;i<=n;i++){const t=i/n,x=Math.round(x0+dx*t),y=Math.round(py(t));A.px(x,y,'#14141c');A.px(x,y+1,'#34343e');A.pxa(x+2,y+4,PAL.sombra,.22);}
      estacion(x0,y0,18,12);estacion(x1,y1,14,9);
      cab.forEach(c=>cabina(c[0],c[1]));});}
  (function(){const av=A.nodo('ccs_avila'),mer=A.nodo('and_merida'),pico=A.nodo('and_picoespejo');
    if(av)telef(av.x+26,av.y-4,av.x-40,av.y-72,[.3,.7],4);
    if(mer&&pico)telef(mer.x-2,mer.y-14,pico.x+12,pico.y-12,[.38,.74],4);})();

  /* ── pueblos menores: cada uno una manzana de color con su base urbana ── */
  [['coc_valencia',54,28,0,0,31],['coc_maracay',46,26,0,0,32],['coc_barquisimeto',52,28,0,0,33],['and_merida',34,20,-8,8,34],['zul_maracaibo',50,26,0,0,35],
   ['moc_barcelona',42,24,0,0,36],['moc_plc',36,22,0,-4,37],['moc_cumana',38,22,0,0,38],['moc_maturin',42,24,0,0,39],['gua_cbolivar',42,24,0,0,40],
   ['coc_coro',36,20,0,0,41],['coc_puertocabello',30,18,0,0,42],['lla_barinas',34,20,0,0,43]
  ].forEach(a=>{const nd=A.nodo(a[0]);if(nd)ciudad(nd.x+a[3],nd.y+a[4]+6,a[1],a[2],a[5]*977,{yr:0,h:4});});
  ciudad(A.dx(530),A.dy(925),34,16,6006,{h:4});            // Puerto Ayacucho a la orilla del Orinoco
  // antena de pueblo y torre de iglesia en Valencia
  /* ── LAGO DE MARACAIBO: puente atirantado + torres petroleras ── */
  (function(){
    // fila de agua cerca del norte del lago con ancho suficiente: el puente va de orilla a orilla
    let yd=-1,xa=0,xb=0;
    for(let y=Math.round(A.dy(205));y<A.dy(260);y+=2){let a=-1,b=-1;for(let x=Math.round(A.dx(88));x<A.dx(205);x++)if(A.tierra[y*W+x]===2||esAgua(x,y)){if(a<0)a=x;b=x;}
      if(a>=0&&b-a>=125&&A.tierra[(y+4)*W+((a+b)>>1)]===2){yd=y+14;const q=[a,b];xa=q[0];xb=q[1];break;}}
    if(yd<0){xa=A.dx(110);xb=A.dx(180);yd=A.dy(222);}
    const x0=xa-12,x1=xb+12,L=x1-x0,xs=[x0+Math.round(L*.2),x0+(L>>1),x0+Math.round(L*.8)];
    mk(x0-4,yd-52,x1+4,yd+16);
    ent(yd+14,()=>{
      for(let x=x0;x<=x1;x++)for(let i=0;i<6;i++)sh(x+4,yd+6+i,PAL.sombra,.34);
      for(let x=x0+6;x<x1-4;x+=10){if(!esAgua(x,yd+8)&&x>xa+2&&x<xb-2)continue;A.rect(x,yd+2,4,10,'#7a808c');A.rect(x,yd+2,1,10,'#b0b8c4');A.rect(x-1,yd+12,6,1,'#a8b4cc');sh(x,yd+13,'#fff',.4);sh(x+3,yd+13,'#fff',.3);}
      A.rect(x0,yd-5,L,7,PAL.hormigon);A.rect(x0,yd-5,L,1,'#e8ecf2');A.rect(x0,yd-4,L,1,'#c8ccd6');A.rect(x0,yd+1,L,1,'#6a707c');A.rect(x0,yd-6,L,1,OUT);A.rect(x0,yd+2,L,1,OUT);
      for(let x=x0;x<x1;x+=5)A.px(x,yd-2,'#f0e070');
      xs.forEach((px,k)=>{const h=k===1?32:26,top=yd-5-h;
        for(let side=-1;side<=1;side+=2)for(let c=1;c<=7;c++){const d=c*7+3,ty=top+3+c*2;A.linea(px,ty,px+side*d,yd-6,'#e4e8f2');A.linea(px+side*1,ty,px+side*(d+1),yd-6,'#9aa4b8');}
        A.rect(px-2,top,5,h+13,PAL.hormigon);A.rect(px+1,top,2,h+13,'#6a707c');A.rect(px-2,top,1,h+13,'#e8ecf2');A.rect(px-3,top-2,7,3,'#e8ecf2');A.rect(px-3,top-3,7,1,OUT);A.rect(px-3,top-2,1,3,OUT);A.rect(px+3,top-2,1,3,OUT);
        A.rect(px-3,yd+12,7,2,'#8a90a0');A.px(px,top-5,'#ff3030');A.rect(px,top-4,1,2,'#d8d8e0');});});
  })();
  function derrick(x,y){for(let i=-7;i<=9;i++)sh(x+i+3,y+3,PAL.sombra,.3);
    A.rect(x-8,y-1,17,3,'#3a3a40');A.rect(x-8,y-1,17,1,'#9a9aa6');A.rect(x-8,y+2,17,1,OUT);A.rect(x-7,y+2,2,5,'#5a4636');A.rect(x+6,y+2,2,5,'#5a4636');A.rect(x,y+2,2,5,'#5a4636');
    A.rect(x-8,y+7,4,1,'#a8a0f0');A.rect(x+5,y+7,4,1,'#a8a0f0');
    A.linea(x-6,y-1,x,y-22,'#14141c');A.linea(x+6,y-1,x,y-22,'#14141c');A.linea(x-5,y-1,x+1,y-22,'#3a3a48');A.linea(x+5,y-1,x+1,y-22,'#22222c');
    for(let j=3;j<20;j+=4){const a=(1-j/22)*5;A.linea(x-a,y-j,x+a+1,y-j-3,'#2e2e38');A.linea(x+a+1,y-j,x-a,y-j-3,'#2e2e38');A.rect(x-a,y-j,a*2+2,1,'#1a1a24');}
    A.rect(x-2,y-26,5,4,'#e0383a');A.rect(x-1,y-28,3,2,'#ffd23a');A.px(x,y-29,'#fff');A.rect(x+4,y-8,7,5,'#c8c8d0');A.rect(x+4,y-9,7,2,'#e0383a');A.rect(x+5,y-6,2,2,'#2a2a38');}
  function balancin(x,y){for(let i=-7;i<=10;i++)sh(x+i+2,y+2,PAL.sombra,.3);
    A.rect(x-6,y-2,15,3,'#3a3a40');A.rect(x-6,y-2,15,1,'#8a8a94');A.rect(x-6,y+1,15,1,OUT);
    A.linea(x+1,y-2,x-2,y-13,'#d8a82a',2);A.linea(x+3,y-2,x+6,y-13,'#d8a82a',2);
    A.linea(x-10,y-15,x+10,y-10,'#e0383a',3);A.linea(x-10,y-16,x+10,y-11,'#ff8a6a');A.rect(x-12,y-16,4,8,'#222230');A.rect(x+9,y-15,4,4,'#222230');A.rect(x+10,y-11,1,10,'#8a8a94');
    A.rect(x-9,y-3,5,2,'#c8c8d0');}
  function tanque(x,y,w,h){for(let i=0;i<w+3;i++)sh(x+i+2,y+2,PAL.sombra,.3);A.rect(x,y-h,w,h,'#eef2f6');A.rect(x+w-4,y-h,4,h,'#b8c4d4');A.rect(x,y-h,2,h,'#fff');
    for(let j=3;j<h-1;j+=4)A.rect(x,y-h+j,w,1,'#c8d2e0');
    A.ell(x+w/2,y-h,w/2,3.4,'#dfe6ee');A.ell(x+w/2-1,y-h,w/2-2,2,'#fff');A.rect(x,y-1,w,1,'#98a4b8');A.rect(x-1,y-h,1,h+1,OUT);A.rect(x+w,y-h,1,h+1,OUT);A.rect(x-1,y,w+2,1,OUT);
    A.rect(x+(w>>1),y-h-8,1,5,OUT);A.rect(x+(w>>1)-2,y-h-3,5,1,'#8a8a94');}
  const sinAndes=(x,y,w,h)=>[[x,y],[x+w,y],[x,y-h],[x+w,y-h]].every(p=>A.bio(p[0],p[1])!==A.BIO.andes&&((A.get(p[0],p[1])&255)-((A.get(p[0],p[1])>>16)&255))>22);
  (function(){
    let nd=0;
    [[118,246],[152,252],[128,290],[160,296],[120,322],[150,320]].forEach(p=>{const q=busca(A.dx(p[0]),A.dy(p[1]),28,8,44,'agua',3);if(q){marca(q[0],q[1],28,8);ent(q[1],()=>derrick(q[0]+13,q[1]));nd++;}});
    let nt=0;
    [[100,262],[96,300],[104,330],[188,226],[196,246],[192,268],[198,286],[204,300],[186,206],[176,330]].forEach((p,i)=>{const q=busca(A.dx(p[0]),A.dy(p[1]),26,12,40,'tierra',1);if(q&&sinAndes(q[0],q[1],26,12)){marca(q[0],q[1],26,12);nt++;
      ent(q[1],i%2?()=>derrick(q[0]+12,q[1]):()=>balancin(q[0]+12,q[1]));}});
    [[196,240,16,12],[198,262,18,13],[196,284,15,11]].forEach(p=>{const q=busca(A.dx(p[0]),A.dy(p[1]),p[2],p[3],40,'tierra',2);if(q&&sinAndes(q[0],q[1],p[2],p[3])){marca(q[0],q[1],p[2],p[3]);ent(q[1],()=>tanque(q[0],q[1],p[2],p[3]));}});
    const mc=busca(A.dx(204),A.dy(222),8,34,30,'tierra',2);
    if(mc&&sinAndes(mc[0],mc[1],8,34)){marca(mc[0],mc[1],8,34);ent(mc[1],()=>{const x=mc[0],y=mc[1];A.rect(x+2,y-30,4,30,'#8a8a94');A.rect(x+2,y-30,1,30,'#d0d0d8');A.rect(x+5,y-30,1,30,'#5a5a66');for(let j=4;j<30;j+=7)A.rect(x+2,y-j,4,1,'#d8382a');A.rect(x,y,8,2,OUT);});
      A.dyn.push({k:'llama',x:mc[0]+4,y:mc[1]-31,s:1.6});A.dyn.push({k:'humo',x:mc[0]+4,y:mc[1]-36,c:'#6a6a74',s:1.4});}
    const q2=busca(A.dx(106),A.dy(272),24,8,50,'agua',2);
    if(q2)A.dyn.push({k:'llama',x:q2[0]+12,y:q2[1]-38,s:1.4});
  })();

  /* ── GUAYANA: complejo siderúrgico con puerto, barcos, puentes y presa de Guri ── */
  function chimenea(x,y,h){A.rect(x,y-h,9,h,'#f0f0f4');A.rect(x+6,y-h,3,h,'#c8c8d4');A.rect(x,y-h,1,h,'#fff');for(let j=0;j<h;j+=10)if((j/10|0)%2===0)A.rect(x,y-h+j+1,9,5,'#d8382a');
    A.rect(x-1,y-h-2,11,2,'#3a3a44');A.rect(x-1,y-h-2,1,h+3,OUT);A.rect(x+9,y-h-2,1,h+3,OUT);A.rect(x-1,y+1,11,1,OUT);}
  function nave(x,y,w,h,c){for(let i=1;i<=w+3;i++)sh(x+i,y+1,PAL.sombra,.35);for(let j=1;j<=h;j++)sh(x+w+1,y-j+2,PAL.sombra,.2);
    A.rect(x,y-h,w,h,c);A.rect(x+w-3,y-h,3,h,ctr(c,.2));A.rect(x,y-h,1,h,cl(c,.3));A.rect(x,y-h-3,w,3,'#b86a4a');A.rect(x,y-h-3,w,1,'#e8987a');
    for(let i=0;i<w;i+=5)A.rect(x+i,y-h-3,1,3,'#8a4a34');
    for(let i=3;i<w-3;i+=4)A.rect(x+i,y-4,3,2,'#2a2a38');A.rect(x+w-9,y-7,6,7,'#3a3a48');
    A.rect(x-1,y-h-4,w+2,1,OUT);A.rect(x-1,y,w+2,1,OUT);A.rect(x-1,y-h-4,1,h+5,OUT);A.rect(x+w,y-h-4,1,h+5,OUT);}
  function silo(x,y,h){A.rect(x,y-h,10,h,'#a8b4c8');A.rect(x,y-h,2,h,'#e0e8f4');A.rect(x+7,y-h,3,h,'#6a788e');A.ell(x+5,y-h,5,2.4,'#d8e0ee');A.rect(x-1,y-h,1,h+1,OUT);A.rect(x+10,y-h,1,h+1,OUT);A.rect(x-1,y,12,1,OUT);}
  function grua(x,y){A.rect(x,y-30,3,30,'#d8a82a');A.rect(x+2,y-30,1,30,'#9a7418');A.rect(x-1,y-8,5,8,'#9a7418');
    A.rect(x-16,y-32,34,3,'#e0383a');A.rect(x-16,y-32,34,1,'#ff8a6a');A.rect(x-16,y-29,34,1,'#8a1a1a');A.linea(x-14,y-29,x-14,y-14,'#222230');A.rect(x-18,y-14,6,5,'#6a7a90');A.rect(x-18,y-14,6,1,'#9ab0cc');
    A.linea(x+1,y-31,x+16,y-32,'#222230');A.linea(x+1,y-34,x-14,y-30,'#222230');A.rect(x-2,y,7,1,OUT);}
  function barco(x,y,len){for(let i=0;i<len+4;i++)sh(x+i+1,y+3,'#0a2a5a',.4);
    A.rect(x,y-3,len,5,'#2a3040');A.rect(x,y-3,len,1,'#5a6478');A.rect(x,y+1,len,1,'#a8281e');A.poli([[x+len,y-3],[x+len+5,y-3],[x+len,y+2]],'#2a3040');
    const cc=['#d8382a','#3a78b8','#e8b030','#58a858','#c8c8d0'];for(let k=0;k<(len-12)/5;k++)for(let r=0;r<2;r++){A.rect(x+2+k*5,y-7-r*4,4,4,cc[(k*2+r)%5]);A.rect(x+2+k*5,y-7-r*4,4,1,cl(cc[(k*2+r)%5],.3));}
    A.rect(x+len-9,y-10,7,7,'#f4f4f8');A.rect(x+len-9,y-11,7,1,'#c0c8d8');A.rect(x+len-8,y-9,5,2,'#1a2a4a');A.rect(x+len-6,y-15,2,5,'#d8382a');A.rect(x,y-4,len,1,OUT);}
  (function(){
    const base=A.nodo('gua_llovizna')||{x:A.dx(770),y:A.dy(435)};
    const gu0=A.nodo('gua_guri');if(gu0)mk(gu0.x+2,gu0.y-22,gu0.x+110,gu0.y+70);
    const q=busca(A.dx(803),A.dy(446),128,34,50,'any',0)||[Math.round(A.dx(803)),Math.round(A.dy(446))];const bx=q[0],by=q[1];mk(bx-2,by-84,bx+130,by+14);
    // trasera: naves bajas y chimeneas
    ent(by-30,()=>{[[bx+8,by-30,36,12,'#b8bcc8'],[bx+60,by-32,40,12,'#c8b8a0']].forEach(n=>nave(n[0],n[1],n[2],n[3],n[4]));});
    ent(by-16,()=>{chimenea(bx+8,by-26,72);chimenea(bx+24,by-24,56);chimenea(bx+62,by-28,82);chimenea(bx+104,by-24,64);chimenea(bx+84,by-26,50);});
    [[bx+13,by-88,'#d8d8dc'],[bx+27,by-74,'#caced6'],[bx+65,by-98,'#d8d8dc'],[bx+107,by-80,'#caced6'],[bx+40,by-60,'#e0e0e4']].forEach(p=>A.dyn.push({k:'humo',x:p[0],y:p[1],c:p[2],s:1.5}));
    A.dyn.push({k:'llama',x:bx+65,y:by-98,s:1.4});
    [[0,0,40,18,'#c0c4cc'],[44,-2,32,24,'#a8b0c0'],[80,0,36,16,'#d0b8a0']].forEach(n=>{const x=bx+n[0],y=by+n[1];ent(y,()=>nave(x,y,n[2],n[3],n[4]));});
    ent(by+6,()=>{silo(bx+118,by,24);silo(bx+118,by-14,20);});
    // cinta transportadora y muelle hacia el río (al oeste)
    let xw=bx;for(let k=0;k<70&&!esAgua(xw,by+10);k++)xw--;
    if(!esAgua(xw,by+10))xw=bx-16;
    ent(by+14,()=>{const x0=xw-8,x1=bx+6;
      A.rect(x0,by+8,x1-x0,4,'#6a5238');A.rect(x0,by+8,x1-x0,1,'#b08e5e');A.rect(x0,by+12,x1-x0,1,OUT);for(let i=0;i<x1-x0;i+=6)A.rect(x0+i+1,by+12,2,6,'#4a3828');
      grua(x0+14,by+8);A.rect(x0+24,by+2,10,6,'#3a6a98');A.rect(x0+24,by+2,10,1,'#6aa0d0');A.rect(x0+36,by+3,8,5,'#d8382a');});
    // muelle norte sobre el Orinoco con grúa y barcaza
    (function(){let yw=null;const xp=bx+84;for(let y=by-40;y>by-140;y--){if(esAgua(xp,y)&&esAgua(xp+14,y)){yw=y;break;}}
      if(yw===null)return;const ya=yw+4;mk(xp-46,ya-34,xp+24,ya+30);
      ent(ya+10,()=>{A.rect(xp,ya,16,26,'#6a5238');A.rect(xp,ya,2,26,'#b08e5e');A.rect(xp+14,ya,2,26,'#3a2a1c');
        A.rect(xp-8,ya-2,30,5,'#7a6040');A.rect(xp-8,ya-2,30,1,'#c8a470');A.rect(xp-8,ya+3,30,1,OUT);for(let i=-6;i<22;i+=6)A.rect(xp+i,ya+4,2,6,'#4a3828');
        grua(xp+4,ya+24);
        const bz=xp-42,bzy=ya+2;for(let i=0;i<30;i++)sh(bz+i+1,bzy+3,'#0a2a5a',.4);A.rect(bz,bzy-3,30,5,'#2a3040');A.rect(bz,bzy-3,30,1,'#5a6478');A.rect(bz,bzy+1,30,1,'#a8281e');
        A.rect(bz+2,bzy-8,26,5,'#6a4a30');A.rect(bz+2,bzy-8,26,1,'#a8785a');A.rect(bz,bzy-4,30,1,OUT);});})();
    // barcos en el Orinoco ancho
    const rr=(f,cx,cy,w,h,rad)=>{for(let r=0;r<=rad;r+=3)for(let a=0;a<12;a++){const an=a*Math.PI/6+r*.5,x=Math.round(cx+Math.cos(an)*r),y=Math.round(cy+Math.sin(an)*r*.6);if(ratio(f,x,y-h,w,h+2)>.72)return[x,y];}return null;};
    const s2=rr(esAgua,A.dx(640),A.dy(412),26,10,40);if(s2){mk(s2[0]-2,s2[1]-18,s2[0]+36,s2[1]+4);ent(s2[1]+4,()=>barco(s2[0],s2[1],22));}
    const s3=rr(esAgua,A.dx(712),A.dy(401),26,10,30);if(s3){ent(s3[1]+4,()=>barco(s3[0],s3[1],22));}
    // puente sobre el Orinoco
    const bp=A.nodo('gua_autopista'),pr=A.nodo('gua_pordaz');
    if(bp&&pr){const xa=Math.round(bp.x+18),xb=Math.round(pr.x-18),ya=Math.round(bp.y+4),yb=Math.round(pr.y+4);
      ent(Math.max(ya,yb)+8,()=>{for(let x=xa;x<=xb;x++){const y=Math.round(ya+(yb-ya)*(x-xa)/(xb-xa));A.rect(x,y-1,1,5,PAL.hormigon);A.px(x,y-1,'#e4e8ee');A.px(x,y,'#c8ccd6');A.px(x,y+4,OUT);A.px(x,y-2,OUT);sh(x+2,y+6,PAL.sombra,.4);sh(x+2,y+7,PAL.sombra,.3);
        if((x-xa)%10===5){A.rect(x,y+4,3,6,'#7a808c');sh(x,y+10,'#fff',.35);}
        const ar=((x-xa)%20)/20;if(ar>0&&ar<1){A.px(x,y-2-Math.round(Math.sin(ar*Math.PI)*15),'#d8dce4');A.px(x,y-3-Math.round(Math.sin(ar*Math.PI)*15),'#8a90a0');if((x-xa)%4===0)A.linea(x,y-3-Math.round(Math.sin(ar*Math.PI)*15),x,y-2,'#b8bcc8');}}});}
    // puente colgante de Angostura, cruzando el Orinoco
    const an=A.nodo('gua_angostura');
    if(an){let ya=null,yb=null;for(let y=Math.round(an.y)-6;y<an.y+90;y++){if(esAgua(an.x,y)&&esAgua(an.x+3,y)){if(ya===null)ya=y;yb=y;}else if(ya!==null&&y-yb>3)break;}
      if(ya===null){ya=an.y+4;yb=an.y+16;}
      const P0=[Math.round(an.x-4),ya-18],P1=[Math.round(an.x+30),yb+18],L=Math.hypot(P1[0]-P0[0],P1[1]-P0[1]);
      ent(Math.max(P0[1],P1[1])+6,()=>{const N=Math.ceil(L),pt=t=>[P0[0]+(P1[0]-P0[0])*t,P0[1]+(P1[1]-P0[1])*t],t0=.22,t1=.78;
        for(let i=0;i<=N;i++){const p=pt(i/N);A.rect(p[0],p[1],2,3,'#8a6a48');A.px(p[0],p[1],'#c8a878');A.px(p[0],p[1]+3,OUT);sh(p[0]+4,p[1]+6,PAL.sombra,.3);}
        [t0,t1].forEach(t=>{const p=pt(t),px=Math.round(p[0]),py=Math.round(p[1]);A.rect(px-2,py-26,5,29,'#d8dce4');A.rect(px+1,py-26,2,29,'#8a90a0');A.px(px,py-28,'#ff3030');A.rect(px-3,py-27,7,2,'#e8ecf2');});
        [t0,t1].forEach(t=>{const p=pt(t),px=Math.round(p[0]),py=Math.round(p[1])-26;for(let d=.05;d<=.26;d+=.04)[-1,1].forEach(sg=>{const q=pt(Math.max(0,Math.min(1,t+sg*d)));A.linea(px,py,q[0],q[1],'#d8dce8');});});});}
    // presa de Guri: muro curvo de hormigón con contrafuertes, vertederos y casa de máquinas
    const gu=A.nodo('gua_guri');
    if(gu){const gx=Math.round(gu.x+44),gy=Math.round(gu.y-8),R=34,RY=28;
      ent(gy-30,()=>{A.ell(gx,gy-8,R+10,RY-6,'#2a78c0',.95);A.ell(gx-2,gy-10,R+6,RY-9,'#4a9ae0');A.ell(gx-6,gy-14,R-8,RY-16,'#7ac0f0',.7);for(let i=0;i<8;i++)A.px(gx-24+i*6,gy-12+(i&1)*3,'#d8f0ff');});
      ent(gy+RY+8,()=>{for(let a=-1.2;a<=1.2;a+=.01){const px=Math.round(gx+Math.sin(a)*R),py=Math.round(gy+RY-Math.cos(a)*RY);
          A.rect(px,py,3,8,'#c4c8d0');A.rect(px,py,3,1,'#f0f2f6');A.rect(px,py,1,8,'#e0e4ea');A.rect(px+2,py,1,8,'#8a909c');A.px(px+1,py+8,OUT);A.px(px+1,py-1,OUT);
          if(Math.round(a*100)%12===0)A.rect(px,py+8,3,5,'#9aa0ac');sh(px+4,py+10,PAL.sombra,.32);}
        for(let a=-.75;a<=.75;a+=.375){const px=Math.round(gx+Math.sin(a)*R),py=Math.round(gy+RY-Math.cos(a)*RY);A.rect(px-1,py+8,4,12,'#e8f4ff');A.rect(px,py+8,1,12,'#fff');A.rect(px-3,py+20,8,3,'#cfe8fa');sh(px,py+23,'#fff',.5);}
        A.rect(gx-5,gy-4,11,6,'#a8b0c0');A.rect(gx-5,gy-6,11,2,'#e0e4ec');A.rect(gx-5,gy+2,11,1,OUT);A.rect(gx-3,gy-1,2,2,'#2a2a38');A.rect(gx+2,gy-1,2,2,'#2a2a38');
        A.rect(gx+30,gy+RY+8,16,8,'#b8bcc8');A.rect(gx+30,gy+RY+6,16,2,PAL.tejas);A.rect(gx+30,gy+RY+16,16,1,OUT);});}
  })();

  /* ── fincas de techo rojo, corral, vacas y chigüires en la charca ── */
  function vaca(x,y,t){for(let i=0;i<8;i++)sh(x+i+1,y+4,PAL.sombra,.28);
    const pelo=t===0?'#f4f0e8':t===1?'#8a5a34':'#2a2420';A.rect(x,y,7,4,pelo);A.rect(x,y,7,1,cl(pelo,.25));A.rect(x+7,y-1,3,3,t===1?'#6a4426':pelo);A.rect(x+9,y,1,1,'#222');A.px(x+7,y-2,'#e8d8b8');A.px(x+9,y-2,'#e8d8b8');
    A.rect(x+1,y+4,1,2,'#3a2a22');A.rect(x+5,y+4,1,2,'#3a2a22');if(t===0){A.rect(x+2,y,2,2,'#2a2420');A.rect(x+5,y+2,2,2,'#2a2420');A.px(x+8,y,'#2a2420');}
    if(t===2){A.rect(x+2,y+1,3,2,'#f4f0e8');}A.px(x-1,y+1,pelo);A.px(x-1,y+2,ctr(pelo,.4));}
  function chiguire(x,y){for(let i=0;i<8;i++)sh(x+i+1,y+3,PAL.sombra,.25);A.rect(x,y,7,3,'#8a5a30');A.rect(x,y,7,1,'#b07840');A.rect(x+6,y-1,3,3,'#6a4424');A.px(x+8,y,'#111');A.px(x+7,y-2,'#6a4424');A.rect(x+1,y+3,1,1,'#4a3020');A.rect(x+5,y+3,1,1,'#4a3020');A.rect(x+1,y+2,5,1,'#c89860');}
  function finca(x,y,flip){const dir=flip?-1:1;
    for(let i=0;i<34;i++)sh(x+i+2,y+2,PAL.sombra,.22);
    // casa principal: paredes claras, techo rojo a dos aguas, porche
    A.rect(x,y-12,26,12,'#f6f0e0');A.rect(x+22,y-12,4,12,'#c8c0a8');A.rect(x,y-12,1,12,'#fff');
    A.poli([[x-3,y-11],[x+29,y-11],[x+23,y-20],[x+3,y-20]],'#c83a26');A.poli([[x-3,y-11],[x+29,y-11],[x+27,y-13],[x-1,y-13]],'#a02a1a');A.rect(x+3,y-20,20,1,'#ff9a7a');A.rect(x+4,y-18,18,1,'#e0583a');A.rect(x+19,y-24,3,5,'#8a6a58');
    A.rect(x+3,y-7,4,4,'#6aa8e0');A.rect(x+10,y-9,5,9,'#6a4a28');A.rect(x+18,y-7,4,4,'#6aa8e0');A.rect(x+2,y-3,22,3,'#a67a46');A.rect(x+2,y-3,22,1,'#d8a468');
    for(let i=2;i<26;i+=7)A.rect(x+i,y-3,1,4,'#6a4a28');
    A.rect(x-1,y-12,1,12,OUT);A.rect(x+26,y-12,1,12,OUT);A.rect(x-1,y,28,1,OUT);
    // establo
    const bx=x+(flip?-26:34),by=y-8;
    A.rect(bx,by-12,20,12,'#c89a68');A.rect(bx+16,by-12,4,12,'#9a6a3e');A.poli([[bx-2,by-11],[bx+22,by-11],[bx+17,by-19],[bx+3,by-19]],'#a82a1e');A.rect(bx+3,by-19,14,1,'#e0583a');
    A.rect(bx+5,by-9,9,9,'#8a5a30');A.linea(bx+5,by-9,bx+13,by,'#f0e0c0');A.linea(bx+13,by-9,bx+5,by,'#f0e0c0');A.rect(bx-3,by-12,1,12,OUT);A.rect(bx+20,by-12,1,12,OUT);A.rect(bx-3,by,24,1,OUT);
    // corral con cerca y pacas
    const cx=x-8,cy=y+36,cw=66,ch=24;A.rect(cx,cy-ch,cw,ch,'#a89a52');for(let k=0;k<90;k++){const hx=A.hash(k,cx,cy);A.px(cx+1+hx%(cw-2),cy-ch+1+((hx>>8)%(ch-2)),'#8a7a3a');}
    for(let i=0;i<=cw;i++){A.px(cx+i,cy,'#8a6234');A.px(cx+i,cy-ch,'#8a6234');A.px(cx+i,cy-1,'#6a4a28');A.px(cx+i,cy-ch+1,'#b08850');if(i%6===0){A.rect(cx+i,cy-ch-2,1,3,'#6a4a28');A.rect(cx+i,cy-1,1,3,'#6a4a28');}}
    for(let j=0;j<=ch;j++){A.px(cx,cy-j,'#8a6234');A.px(cx+cw,cy-j,'#8a6234');if(j%6===0){A.rect(cx-1,cy-j-1,2,3,'#6a4a28');A.rect(cx+cw,cy-j-1,2,3,'#6a4a28');}}
    A.ell(cx+cw-9,cy-6,5,3,'#e0c050');A.ell(cx+cw-9,cy-7,4,2,'#f4dc78');A.ell(cx+cw-18,cy-5,4,2.4,'#d8b440');
    const r=A.rng(A.hash(x,y,7));for(let k=0;k<7;k++){const vx=cx+4+((r()*(cw-18))|0),vy=cy-4-((r()*(ch-8))|0);vaca(vx,vy,k%3);}}
  (function(){const FINCAS=[[300,445,0,-8,-30],[400,330,1,0,-10],[330,500,0,10,-10]];
    FINCAS.forEach(f=>{const nd=A.nodo(f[0]===300?'lla_hato':f[0]===330?'lla_mantecal':'lla_calabozo'),cx=nd?nd.x:A.dx(f[0]),cy=nd?nd.y:A.dy(f[1]);
      const q0=busca(cx+(f[2]?-58:44),cy+f[4]+54,100,64,90,'tierra',2),q=q0&&[q0[0],q0[1]-34];
      if(q){mk(q[0]-24,q[1]-26,q[0]+90,q[1]+40);ent(q[1]+2,()=>finca(q[0],q[1],0));
        // vacas sueltas en el pasto cercano
        const r=A.rng(A.hash(q[0],q[1],3));for(let k=0;k<5;k++){const vx=q[0]+((r()*100)|0)-10,vy=q[1]+46+((r()*10)|0);if(libreR(vx,vy-3,vx+10,vy+5)){mk(vx-1,vy-3,vx+11,vy+6);const t=k%3;ent(vy,()=>vaca(vx,vy,t));}}}});
    // charca con chigüires
    [['lla_sanfernando',-50,-26],['lla_achaguas',-60,30]].forEach(p=>{const nd=A.nodo(p[0]);if(!nd)return;const q=busca(nd.x+p[1],nd.y+p[2],44,18,70,'tierra',1);
      if(q){marca(q[0],q[1],44,18);ent(q[1],()=>{const x=q[0],y=q[1];
        A.ell(x+22,y-8,22,9,'#2a6a40');A.ell(x+22,y-8,20,8,'#3a8ad0');A.ell(x+20,y-9,16,5,'#5aaae8');A.ell(x+16,y-10,6,2,'#a8dcf8');for(let i=0;i<10;i++)A.px(x+8+i*3,y-5+(i&1),'#d8f0ff');
        for(let i=0;i<6;i++){const hx=A.hash(i,x,5);A.rect(x+2+hx%40,y-1-(hx>>6)%4,1,4,'#4a7a2a');A.px(x+2+hx%40,y-2-(hx>>6)%4,'#8a6a2a');}
        chiguire(x+4,y-5);chiguire(x+14,y+1);chiguire(x+32,y-3);});}});
  })();


  /* ── llanos: manadas de vacas y caballos, casas sueltas con cerca ── */
  function caballo(x,y,t){for(let i=0;i<10;i++)sh(x+i+1,y+5,PAL.sombra,.28);const p=t?'#6a3e22':'#2e2420';
    A.rect(x,y,8,4,p);A.rect(x,y,8,1,cl(p,.28));A.rect(x+7,y-3,3,5,p);A.rect(x+9,y-2,2,2,ctr(p,.2));A.px(x+9,y-2,'#111');A.rect(x+7,y-4,1,2,ctr(p,.4));
    A.rect(x+1,y+4,1,3,'#2a1c16');A.rect(x+3,y+4,1,3,'#2a1c16');A.rect(x+6,y+4,1,3,'#2a1c16');A.rect(x-2,y+1,2,3,ctr(p,.4));if(t)A.rect(x+3,y,3,1,'#e8d8b8');}
  function casaSuelta(x,y){for(let i=0;i<24;i++)sh(x+i+2,y+2,PAL.sombra,.22);
    A.rect(x+4,y-9,14,9,'#f6f0e0');A.rect(x+15,y-9,3,9,'#c8c0a8');A.rect(x+4,y-9,1,9,'#fff');
    A.poli([[x+1,y-8],[x+21,y-8],[x+17,y-14],[x+5,y-14]],'#c83a26');A.rect(x+5,y-14,12,1,'#ff9a7a');A.rect(x+1,y-9,20,1,'#8a2a1a');
    A.rect(x+6,y-6,3,3,'#6aa8e0');A.rect(x+11,y-6,3,6,'#6a4a28');A.rect(x+3,y-9,1,9,OUT);A.rect(x+18,y-9,1,9,OUT);A.rect(x+3,y,16,1,OUT);
    for(let i=-2;i<=22;i++){A.px(x+i,y+5,'#8a6234');A.px(x+i,y-1+0,'#00000000'===0?'#000':'#8a6234');if(i%4===0)A.rect(x+i,y+3,1,4,'#6a4a28');}
    for(let j=0;j<=5;j++){A.px(x-2,y+j,'#8a6234');A.px(x+22,y+j,'#8a6234');}arbol(x-6,y+2,3);}
  (function(){const r=A.rng(8101);
    ['lla_hato','lla_mantecal','lla_calabozo','lla_guanare','lla_barinas','lla_pascua','lla_acarigua','lla_sanjuan','lla_guasdualito'].forEach((id,ix)=>{const nd=A.nodo(id);if(!nd)return;
      const q=busca(nd.x+30+(ix%2)*-70,nd.y+34,60,16,90,'tierra',1);
      if(q){marca(q[0],q[1],60,16);const q0=q[0],q1=q[1],n=6+(ix%3);
        ent(q1,()=>{for(let k=0;k<n;k++){const vx=q0+((k%4)*13)+((r()*4)|0),vy=q1-12+((k>>2)*9)+((r()*3)|0);if(ix%3===1&&k>n-3)caballo(vx,vy,k&1);else vaca(vx,vy,k%3);}});}
      const c=busca(nd.x-60,nd.y-8,26,16,90,'tierra',2);if(c&&ix%2===0){marca(c[0],c[1],26,16);ent(c[1],()=>casaSuelta(c[0],c[1]));}});
  })();

  /* ── PALAFITOS del delta: chozas de palma sobre pilotes, muelle y curiara, sobre el agua morada ── */
  function palafito(x,y,w){
    const T1='#f0d880',T2='#c8a04a',T3='#8a6a2a';
    for(let i=0;i<w+8;i++)sh(x+i+2,y+12,'#201060',.35);
    [1,(w>>1),w-3].forEach(k=>{A.rect(x+k,y,3,11,'#4a3220');A.rect(x+k,y,1,11,'#6a4a30');A.rect(x+k-1,y+11,5,1,'#b8b0f8');});
    A.rect(x-3,y-1,w+6,3,'#9a6a3a');A.rect(x-3,y-1,w+6,1,'#d8a468');A.rect(x-3,y+2,w+6,1,OUT);
    A.rect(x,y-14,w,13,'#c89a58');for(let i=4;i<w;i+=4)A.rect(x+i,y-12,1,11,'#a87e3e');A.rect(x+w-4,y-12,4,11,'#8a6234');A.rect(x,y-12,1,11,'#e0b878');
    A.rect(x+3,y-10,4,4,'#2a1a14');A.rect(x+3,y-10,4,1,'#6a4a2a');A.rect(x+w-8,y-11,4,10,'#3a2418');
    A.rect(x-1,y-15,1,15,OUT);A.rect(x+w,y-15,1,15,OUT);
    const RH=17,hx=(w+8)/2;
    for(let j=0;j<RH;j++){const hw=Math.round(1+j*(hx-1)/(RH-1)),x0=Math.round(x+w/2-hw),ww=hw*2+1,y0=y-14-RH+j;
      A.rect(x0,y0,ww,1,j<3?T1:j<8?'#dcb85a':T2);A.rect(x0+ww-Math.max(3,hw*.55|0),y0,Math.max(3,hw*.55|0),1,T3);
      A.px(x0-1,y0,OUT);A.px(x0+ww,y0,OUT);if(j%4===3)for(let i=0;i<ww;i+=3)A.px(x0+i,y0,T3);}
    A.rect(x-hx+w/2-1,y-15,w+10,1,OUT);A.px(Math.round(x+w/2),y-14-RH-1,OUT);A.px(Math.round(x+w/2),y-14-RH,T1);
    const px=x+w+3;A.rect(px,y-1,15,2,'#a67a46');A.rect(px,y-1,15,1,'#d8a468');A.rect(px,y+1,15,1,OUT);for(let i=0;i<15;i+=4)A.rect(px+i,y-1,1,2,'#7a5430');
    for(let i=2;i<15;i+=7)A.rect(px+i,y+2,2,8,'#4a3220');
    A.ell(px+9,y+10,8,2.6,OUT);A.ell(px+9,y+9,7,2,'#5a3a20');A.ell(px+8,y+8,6,1.4,'#b8783c');A.rect(px+13,y+7,2,1,'#e0383a');}
  (function(){const cand=[],W2=22,FW=W2+22,esAguaP=(x,y)=>esPurpura(x,y)||esAgua(x,y);
    for(let y=A.dy(262);y<A.dy(365);y+=3)for(let x=A.dx(850);x<A.dx(990);x+=3){if(!libreR(x-4,y-34,x+FW,y+14,'any'))continue;
      const q=ratio(esAguaP,x-2,y-1,FW,14);if(q>.55){const pp=ratio(esPurpura,x-2,y-1,FW,14);if(pp>.3)cand.push([q+pp,x,y]);}}
    cand.sort((a,b)=>b[0]-a[0]||a[1]-b[1]);const sel=[];
    cand.forEach(c=>{if(sel.length>=3)return;if(sel.some(s=>Math.abs(s[1]-c[1])<FW+6&&Math.abs(s[2]-c[2])<44))return;sel.push(c);});
    sel.forEach(c=>{mk(c[1]-4,c[2]-34,c[1]+FW+2,c[2]+14);ent(c[2]+8,()=>palafito(c[1],c[2],W2));});
  })();

  /* ── SALTO ÁNGEL: caída alta y ancha con bruma, sobre la que ya pinta la capa de agua ── */
  (function(){
    let bx=-1,bn=0,top=0,bot=0;
    for(let x=A.dx(740);x<A.dx(800);x++){let n=0,t=-1,b=-1;for(let y=A.dy(560);y<A.dy(640);y++){const c=A.get(x,y),r=c&255,g=(c>>8)&255,bl=(c>>16)&255;
      if(bl>200&&g>170&&r>120&&bl>=r){n++;if(t<0)t=y;b=y;}}
      if(n>bn){bn=n;bx=x;top=t;bot=b;}}
    if(bn<18)return;
    ent(bot+14,()=>{const hh=bot-top;
      for(let y=top-6;y<=bot+2;y++){const k=Math.max(0,(y-top)/Math.max(1,hh)),w=3+Math.round(k*4)+((A.hash(y,bx,3)%5)===0?1:0),ox=Math.round(Math.sin(y*.21)*1.2);
        A.rect(bx+ox-w-1,y,1,1,'#3a8ad0');A.rect(bx+ox-w,y,2*w+1,1,'#e8f6ff');A.rect(bx+ox-w,y,2,1,'#9ad0f4');A.rect(bx+ox+w-2,y,2,1,'#8ac8f0');A.rect(bx+ox+w,y,1,1,'#3a8ad0');
        for(let i=-w+3;i<w-2;i+=3)if((y+i*2+bx)%5<2)A.px(bx+ox+i,y,'#ffffff');else if((y+i)%7===0)A.px(bx+ox+i,y,'#b8dcf4');}
      A.ell(bx,bot+4,22,8,'#2a78c0',.9);A.ell(bx,bot+3,19,6,'#5ab4ec');A.ell(bx-3,bot+2,13,4,'#a8dcf8');A.ell(bx,bot+2,9,3,'#e8f8ff');
      for(let i=0;i<22;i++){const hx=A.hash(i,bx,bot),ox=((hx%50)-25),oy=((hx>>5)%16);A.ell(bx+ox,bot-oy,9,4,'#ffffff',.5);A.ell(bx+ox-1,bot-oy+4,12,4,'#e8f4ff',.32);}
      for(let j=0;j<hh+8;j+=3)A.pxa(bx+7,top+j,'#ffffff',.3);});
  })();

  /* ── detalles simpáticos ── */
  (function(){
    const m=busca(A.dx(268),A.dy(88),12,28,60,'tierra',2);
    if(m)ent(m[1],()=>{const x=m[0]+6,y=m[1];A.poli([[x-4,y],[x+5,y],[x+3,y-20],[x-2,y-20]],'#e8e0d0');A.poli([[x+1,y],[x+5,y],[x+3,y-20],[x+1,y-20]],'#b8b0a0');A.rect(x-1,y-6,3,4,'#4a3a2a');A.rect(x-4,y,10,1,OUT);
      A.rect(x-1,y-22,3,3,'#b8283a');const b=[[-12,-30],[12,-14],[6,-36],[-6,-8]];b.forEach(p=>{A.linea(x,y-21,x+p[0],y-21+(p[1]+21),'#e8e0d0',2);});A.px(x,y-21,OUT);});
    const cr=busca(A.dx(262),A.dy(140),12,30,50,'tierra',2);
    if(cr)ent(cr[1],()=>{const x=cr[0]+5,y=cr[1];for(let i=0;i<9;i++)sh(x+i,y+1,PAL.sombra,.3);A.rect(x,y-26,4,26,'#f0ece0');A.rect(x-6,y-20,16,4,'#f0ece0');A.rect(x+3,y-26,1,26,'#b8b4a8');A.rect(x-6,y-17,16,1,'#b8b4a8');A.rect(x-4,y,12,2,'#8a8478');A.rect(x-5,y+2,14,1,OUT);
      A.rect(x-1,y-27,6,1,OUT);A.rect(x-1,y-27,1,28,OUT);A.rect(x+4,y-27,1,28,OUT);A.rect(x-7,y-21,1,6,OUT);A.rect(x+10,y-21,1,6,OUT);});
    const av=A.nodo('can_laguna');if(av){const q=busca(av.x+16,av.y+34,28,12,60,'any',0);
      if(q)ent(q[1],()=>{const x=q[0],y=q[1];for(let i=0;i<28;i++)sh(x+i+2,y+3,PAL.sombra,.3);A.rect(x+5,y-5,16,5,'#f4f4f8');A.rect(x+5,y-1,16,1,'#c4c8d4');A.rect(x+21,y-5,5,3,'#d8282a');A.rect(x+3,y-5,3,5,'#d8282a');
        A.rect(x+9,y-10,8,1,'#222230');A.rect(x+6,y-13,14,2,'#d8282a');A.rect(x+9,y-9,1,4,'#6a6a78');A.rect(x+16,y-9,1,4,'#6a6a78');A.rect(x+1,y-9,1,9,'#8a8a94');A.rect(x+8,y-5,7,2,'#7ac8f0');
        A.rect(x+8,y,3,3,'#222230');A.rect(x+18,y,3,3,'#222230');A.rect(x+5,y-6,16,1,OUT);A.rect(x+5,y,16,0,OUT);});}
  })();

  // pinta todo por orden de y (más al norte primero; lo del sur tapa al del norte)
  cola.sort((a,b)=>a.y-b.y);cola.forEach(e=>e.f());
});
})(typeof window!=='undefined'?window:globalThis);
