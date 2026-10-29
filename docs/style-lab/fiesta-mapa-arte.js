// LA FIESTA · ARTE DEL MAPA (pixel art procedural). Núcleo: lienzo de píxeles, máscaras, bioma, utilidades y registro de capas.
// El mapa ilustrado de Venezuela se pinta UNA vez en un búfer 2000×1500 (1 píxel de arte = 2 u de mundo en x y en y;
// el mundo mide 4000×3000) y fiesta-tablero.js lo estampa como capa estática (con imageSmoothing apagado: píxeles gordos).
// Todo es determinista (sin Math.random) y puro: corre en Node (pruebas, volcado a PNG) y en el navegador.
//
// COORDENADAS: «diseño» = el lienzo 1000×1000 del mapa (x → ×2, y → ×1.5 píxeles de arte).  A.dx(x)/A.dy(y) convierten.
// ORDEN DE CAPAS (F.arte.capa(id, orden, fn(A))): 10 mar · 20 terreno · 30 relieve · 40 agua interior · 50 vegetación · 60 hitos ·
// 70 nubes · 90 acabado. Cada capa pinta SOBRE lo anterior; un fallo en una capa se anota en A.errores y no detiene el resto.
// ANIMACIÓN: una capa puede dejar A.dyn.push({k:'barco',x,y,...}) (x,y en píxeles de arte) y registrar
// F.arte.din.barco=function(c,e,t){...} que pinta con fillRect 1×1 sobre un ctx YA escalado a píxeles de arte (c.fillStyle='#...').
(function(root){
'use strict';
const F=root.FIESTA=root.FIESTA||{};
const NODE=typeof module!=='undefined'&&typeof require!=='undefined';
const W=2000,H=1500,SX=2,SY=1.5,U=2;           // píxeles de arte, píxeles de arte por unidad de diseño (x,y), u de mundo por píxel
const BIO={mar:0,desierto:1,llano:2,selva:3,andes:4,manglar:5,costa:6,urbano:7,sabana:8};
const BIO_NOMBRE=Object.keys(BIO);
// región del mapa → bioma base (las regiones vienen de fiesta-mapa-venezuela.js)
const BIO_REG={ccs:BIO.costa,coc:BIO.llano,zul:BIO.desierto,and:BIO.andes,lla:BIO.llano,gua:BIO.sabana,can:BIO.selva,del:BIO.manglar,
  moc:BIO.costa,mar:BIO.costa,roq:BIO.costa};

/* ── paleta maestra (tomada de las imágenes de referencia): todas las capas la usan para que el conjunto case ── */
const PAL={
  marProfundo:'#0a3a8c',mar:'#1459b8',marMedio:'#1f78d1',somero:'#2fb4e0',turquesa:'#4fd6e6',espuma:'#e6fbff',
  arena:'#ecd28a',arenaSombra:'#cfae5e',duna:'#e0aa44',dunaSombra:'#b87e2c',desierto:'#e3b45a',roca:'#9a7a52',rocaSombra:'#6e5236',
  pasto:'#b9c63a',pastoClaro:'#d4d85a',pastoSombra:'#8da92a',pastoOscuro:'#5f8a22',
  selva:'#2d8a2a',selvaMedia:'#1f6f22',selvaOscura:'#154d1a',selvaLuz:'#4aa83a',
  acantilado:'#b8662a',acantiladoSombra:'#7e3f1a',acantiladoLuz:'#d98a46',
  nieve:'#f6f9ff',nieveSombra:'#c4d2ea',pizarra:'#8a90a0',pizarraSombra:'#5c6274',pino:'#1c5a2c',
  manglarAgua:'#6a4fc0',manglarClaro:'#8e72e0',manglarOscuro:'#3d2a78',manglar:'#2f7a3a',
  rio:'#3aa0e8',rioClaro:'#8cd4f6',lago:'#1a5cc8',
  tejas:'#d9482e',pared1:'#f0d060',pared2:'#e8854a',pared3:'#6aa8e0',pared4:'#e8e0d0',hormigon:'#9aa0a8',
  sombra:'#102030',contorno:'#0c2a22',nube:'#ffffff',nubeSombra:'#c8d8ee',nubeBorde:'#a8bedc'};

/* ── color empaquetado: Uint32 little-endian 0xAABBGGRR ── */
function hx(c){if(typeof c==='number')return[c&255,(c>>8)&255,(c>>16)&255];if(Array.isArray(c))return c;
  c=c.replace('#','');if(c.length===3)c=c.split('').map(x=>x+x).join('');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
function rgb(c){if(typeof c==='number')return c;const a=hx(c);return((255<<24)|(a[2]<<16)|(a[1]<<8)|a[0])>>>0;}
function mezcla(a,b,k){a=rgb(a);b=rgb(b);k=k<0?0:k>1?1:k;const r=(a&255)+((b&255)-(a&255))*k,g=((a>>8)&255)+(((b>>8)&255)-((a>>8)&255))*k,
  bl=((a>>16)&255)+(((b>>16)&255)-((a>>16)&255))*k;return((255<<24)|((bl|0)<<16)|((g|0)<<8)|(r|0))>>>0;}
function sombrea(c,k){return mezcla(c,0xff000000|0x101828,k);}          // k>0 oscurece hacia azul noche
function aclara(c,k){return mezcla(c,0xffffffff,k);}
function hex(c){c=rgb(c);return'#'+[c&255,(c>>8)&255,(c>>16)&255].map(v=>v.toString(16).padStart(2,'0')).join('');}

/* ── ruido y azar deterministas ── */
function hash(x,y,s){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,2147483647))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295;}
function suave(t){return t*t*(3-2*t);}
function vn(x,y,s){const ix=Math.floor(x),iy=Math.floor(y),fx=suave(x-ix),fy=suave(y-iy);
  const a=hash(ix,iy,s),b=hash(ix+1,iy,s),c=hash(ix,iy+1,s),d=hash(ix+1,iy+1,s);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;}
function fbm(x,y,s,oct){oct=oct||3;let v=0,a=.5,f=1,t=0;for(let i=0;i<oct;i++){v+=vn(x*f,y*f,s+i*101)*a;t+=a;a*=.5;f*=2;}return v/t;}
// Campo de ruido PRECOMPUTADO en una rejilla gruesa (paso px) con muestreo bilineal: ~paso² veces más barato que fbm() por píxel.
// campo(freq, seed, oct, paso) → function(x,y) en píxeles de arte, valores 0..1. freq = longitud de onda en píxeles de la 1.ª octava.
function campo(freq,seed,oct,paso){paso=paso||4;oct=oct||3;const gw=Math.ceil(W/paso)+2,gh=Math.ceil(H/paso)+2,g=new Float32Array(gw*gh);
  for(let j=0;j<gh;j++)for(let i=0;i<gw;i++)g[j*gw+i]=fbm(i*paso/freq,j*paso/freq,seed,oct);
  return function(x,y){const fx=x/paso,fy=y/paso,ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy;
    const i0=Math.max(0,Math.min(gw-2,ix)),j0=Math.max(0,Math.min(gh-2,iy)),a=g[j0*gw+i0],b=g[j0*gw+i0+1],c=g[(j0+1)*gw+i0],d=g[(j0+1)*gw+i0+1];
    return a+(b-a)*tx+(c-a)*ty+(a-b-c+d)*tx*ty;};}
function rng(seed){let s=(seed|0)||1;return function(){s=(Math.imul(s,1664525)+1013904223)|0;return((s>>>0)/4294967296);};}

/* ── registro de capas ── */
const CAPAS=[],DIN={};
function capa(id,orden,fn){const i=CAPAS.findIndex(c=>c.id===id);const c={id:id,orden:orden,fn:fn};if(i>=0)CAPAS[i]=c;else CAPAS.push(c);CAPAS.sort((a,b)=>a.orden-b.orden);}

/* ── el lienzo ── */
function nuevo(mapa,silueta){
  const A={W:W,H:H,SX:SX,SY:SY,U:U,BIO:BIO,PAL:PAL,mapa:mapa,errores:[],dyn:[],tiempos:{}};
  const buf=A.buf=new Uint32Array(W*H);
  A.dx=x=>x*SX;A.dy=y=>y*SY;A.ddx=x=>x/SX;A.ddy=y=>y/SY;      // diseño↔arte
  A.campo=campo;A.rgb=rgb;A.mezcla=mezcla;A.sombrea=sombrea;A.aclara=aclara;A.hex=hex;A.hash=hash;A.vn=vn;A.fbm=fbm;A.rng=rng;
  A.px=function(x,y,c){x=x|0;y=y|0;if(x>=0&&y>=0&&x<W&&y<H)buf[y*W+x]=rgb(c);};
  A.get=function(x,y){x=x|0;y=y|0;return x>=0&&y>=0&&x<W&&y<H?buf[y*W+x]:0;};
  A.pxa=function(x,y,c,a){x=x|0;y=y|0;if(x<0||y<0||x>=W||y>=H)return;buf[y*W+x]=mezcla(buf[y*W+x],c,a);};     // mezcla con lo que hay (a 0..1)
  A.rect=function(x,y,w,h,c){c=rgb(c);const x0=Math.max(0,x|0),y0=Math.max(0,y|0),x1=Math.min(W,(x+w)|0),y1=Math.min(H,(y+h)|0);
    for(let j=y0;j<y1;j++)for(let i=x0;i<x1;i++)buf[j*W+i]=c;};
  A.ell=function(cx,cy,rx,ry,c,a){c=rgb(c);for(let j=Math.max(0,Math.floor(cy-ry));j<=Math.min(H-1,Math.ceil(cy+ry));j++)for(let i=Math.max(0,Math.floor(cx-rx));i<=Math.min(W-1,Math.ceil(cx+rx));i++){
    const u=(i-cx)/rx,v=(j-cy)/ry;if(u*u+v*v<=1)buf[j*W+i]=a===undefined||a>=1?c:mezcla(buf[j*W+i],c,a);}};
  A.disc=(cx,cy,r,c,a)=>A.ell(cx,cy,r,r,c,a);
  A.linea=function(x0,y0,x1,y1,c,g){g=g||1;c=rgb(c);x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
    const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;
    for(;;){if(g<=1)A.px(x0,y0,c);else A.rect(x0-(g>>1),y0-(g>>1),g,g,c);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}};
  A.polilinea=function(pts,c,g){for(let i=1;i<pts.length;i++)A.linea(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],c,g);};
  // relleno de polígono (even-odd) en píxeles de arte; pts = [[x,y],...]; c puede ser función (x,y)=>color para texturizar
  A.poli=function(pts,c){let y0=Infinity,y1=-Infinity;pts.forEach(p=>{y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);});
    y0=Math.max(0,Math.floor(y0));y1=Math.min(H-1,Math.ceil(y1));const f=typeof c==='function'?c:null,cc=f?0:rgb(c);
    for(let y=y0;y<=y1;y++){const xs=[];for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];
      if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
      xs.sort((p,q)=>p-q);for(let k=0;k+1<xs.length;k+=2){for(let x=Math.max(0,Math.ceil(xs[k]));x<=Math.min(W-1,Math.floor(xs[k+1]));x++)buf[y*W+x]=f?rgb(f(x,y)):cc;}}};
  // sprite ASCII: filas de texto; pal {car:color}; '.' y ' ' transparentes. opt {flip, x2 (doble tamaño), sombra (color del sprite oscurecido k)}
  A.spr=function(filas,pal,x,y,opt){opt=opt||{};const e=opt.x2?2:1,h=filas.length;
    for(let j=0;j<h;j++){const f=filas[j],w=f.length;for(let i=0;i<w;i++){const ch=f[opt.flip?w-1-i:i];if(ch==='.'||ch===' ')continue;const c=pal[ch];if(c===undefined)continue;
      if(e===1)A.px(x+i,y+j,c);else A.rect(x+i*2,y+j*2,2,2,c);}}};
  // máscaras y campos (los llena construirBase)
  A.tierra=new Uint8Array(W*H);   // 0 mar · 1 tierra · 2 agua interior (lago de Maracaibo)
  A.extra=new Uint8Array(W*H);    // 1 = tierra de fondo decorativa (Colombia / Brasil): no es jugable, solo arte
  A.dist=new Int16Array(W*H);     // distancia con signo a la costa, en píxeles×3: tierra > 0, mar < 0 (÷3 ≈ píxeles)
  A.bioma=new Uint8Array(W*H);    // BIO.* por píxel (0 en el mar)
  A.reg=new Uint8Array(W*H);      // índice de región+1 de la casilla más cercana (0 en el mar)
  A.ocupado=new Uint8Array(W*H);  // 1 donde irán casillas o caminos (evita poner adornos encima)
  A.nodos=[];A.regiones=[];
  A.esTierra=(x,y)=>{x=x|0;y=y|0;return x>=0&&y>=0&&x<W&&y<H&&A.tierra[y*W+x]===1;};
  A.esMar=(x,y)=>{x=x|0;y=y|0;return x<0||y<0||x>=W||y>=H||A.tierra[y*W+x]===0;};
  A.esLago=(x,y)=>{x=x|0;y=y|0;return x>=0&&y>=0&&x<W&&y<H&&A.tierra[y*W+x]===2;};
  A.d=(x,y)=>{x=x|0;y=y|0;return x>=0&&y>=0&&x<W&&y<H?A.dist[y*W+x]/3:-99;};
  A.bio=(x,y)=>{x=x|0;y=y|0;return x>=0&&y>=0&&x<W&&y<H?A.bioma[y*W+x]:0;};
  A.libre=(x,y)=>{x=x|0;y=y|0;return x>=0&&y>=0&&x<W&&y<H&&A.ocupado[y*W+x]===0;};
  A.nodo=id=>{for(let i=0;i<A.nodos.length;i++)if(A.nodos[i].id===id)return A.nodos[i];return null;};
  return A;
}

/* ── máscara de tierra, distancias, bioma y ocupación (deterministas) ── */
const SIL=[[60,110],[95,75],[120,120],[135,170],[175,160],[215,130],[240,95],[255,60],[285,80],[270,115],[300,140],[350,170],
  [400,140],[450,140],[520,145],[600,165],[660,170],[720,160],[780,170],[850,168],[925,172],[955,190],[926,212],[944,238],[968,270],[976,300],[972,335],
  [948,362],[914,384],[922,414],[946,440],[928,478],[934,520],[952,562],[966,610],[973,660],[970,708],[950,738],[930,764],[860,760],[800,730],[760,780],[700,800],[650,880],[600,960],[540,940],
  [520,860],[560,780],[500,700],[470,620],[420,580],[330,560],[230,540],[150,520],[100,490],[70,450],[90,400],[60,340],[40,280],
  [55,220],[45,160]];
const ISLAS=[[775,105,70,30],[790,155,14,8],[592,62,50,30]];
const LAGO=[[125,205],[160,200],[178,230],[183,280],[165,325],[125,335],[105,300],[118,250]];
// tierra de fondo (decorativa): franja oeste (Colombia) y todo el suroeste (Brasil / Amazonas) hasta el borde del mundo
const EXTRA=[[0,95],[45,160],[55,220],[40,280],[60,340],[90,400],[70,450],[100,490],[150,520],[230,540],[330,560],[420,580],[470,620],[500,700],
  [560,780],[520,860],[540,940],[600,960],[640,1000],[0,1000]];

function rasteriza(pts,out,val){let y0=Infinity,y1=-Infinity;const P=pts.map(p=>[p[0]*SX,p[1]*SY]);P.forEach(p=>{y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);});
  for(let y=Math.max(0,Math.floor(y0));y<=Math.min(H-1,Math.ceil(y1));y++){const xs=[];
    for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
    xs.sort((p,q)=>p-q);for(let k=0;k+1<xs.length;k+=2)for(let x=Math.max(0,Math.ceil(xs[k]));x<=Math.min(W-1,Math.floor(xs[k+1]));x++)out[y*W+x]=val;}}

function baseMapa(A){
  const mapa=A.mapa,N=mapa.nodos,ids=Object.keys(N);
  A.regiones=(mapa.regiones||[]).map(r=>r.id);
  ids.forEach(id=>{const n=N[id];A.nodos.push({id:id,r:n.r,t:n.t,x:n.x*SX,y:n.y*SY,dx:n.x,dy:n.y,star:!!n.star,tienda:!!n.tienda});});
  // 1) silueta cruda + tierra de fondo + islas
  const raw=new Uint8Array(W*H),ex=new Uint8Array(W*H);
  rasteriza(EXTRA,ex,1);rasteriza(SIL,raw,1);
  ISLAS.forEach(i=>{const cx=i[0]*SX,cy=i[1]*SY,rx=i[2]*SX,ry=i[3]*SY;for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(H-1,Math.ceil(cy+ry));y++)
    for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(W-1,Math.ceil(cx+rx));x++){const u=(x-cx)/rx,v=(y-cy)/ry;if(u*u+v*v<=1)raw[y*W+x]=1;}});
  // las casillas siempre en tierra: un disco alrededor de cada una (las «lenguas» del borrador)
  A.nodos.forEach(n=>{const r=30;for(let y=Math.max(0,Math.floor(n.y-r));y<=Math.min(H-1,Math.ceil(n.y+r));y++)for(let x=Math.max(0,Math.floor(n.x-r));x<=Math.min(W-1,Math.ceil(n.x+r));x++)
    if((x-n.x)*(x-n.x)+(y-n.y)*(y-n.y)<=r*r)raw[y*W+x]=1;});
  // 2) costa orgánica: deformación por ruido (sin romper la forma) + limpieza de píxeles sueltos
  const tmp=new Uint8Array(W*H);
  const w5g=campo(70,31,2,4);
  const w1=campo(46,11,3,4),w2=campo(46,13,3,4),w3=campo(14,12,2,4),w4=campo(14,14,2,4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const dx_=x/SX,dy_=y/SY;
    // más recorte en la costa norte (y<260) y la costa sur/sureste; el borde oeste queda liso
    const zn=dy_<260&&dx_>110?1:0,zs=dx_>760&&dy_>520&&dy_<800?1:0,zk=Math.min(1,Math.max(zn,zs)*Math.min(1,(dx_-100)/60));
    const amp=34+zk*(w5g(x,y)*46),amf=9+zk*16;
    const wx=(w1(x,y)-.5)*amp+(w3(x,y)-.5)*amf,wy=(w2(x,y)-.5)*amp+(w4(x,y)-.5)*amf;
    const sx=Math.max(0,Math.min(W-1,Math.round(x+wx))),sy=Math.max(0,Math.min(H-1,Math.round(y+wy)));
    tmp[y*W+x]=(raw[sy*W+sx]||ex[sy*W+sx])?1:0;}
  for(let pasada=0;pasada<2;pasada++){const o=tmp.slice();
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){let s=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)s+=o[(y+j)*W+x+i];
      tmp[y*W+x]=s>=5?1:0;}}
  // bahías (restan), cabos y penínsulas (suman): [x,y,rx,ry] en coordenadas de diseño
  const BAHIAS=[[330,168,26,14],[400,150,14,10],[500,152,30,14],[585,140,26,12],[690,165,20,11],[760,180,26,14],[855,178,20,12],[935,205,14,14],[905,250,16,18],[945,390,18,16],[940,505,14,20],[968,590,18,24],[958,665,16,22],[905,745,24,16],[772,752,10,8]];
  const CABOS=[[255,62,16,30],[240,95,26,20],[170,130,14,12],[435,130,14,10],[545,128,18,10],[640,155,14,10],[720,150,18,8],[880,165,22,12],[950,195,12,10],[960,545,10,12],[975,640,10,14],[955,725,12,10],[870,765,14,8]];
  const elip=(L,v)=>L.forEach(e=>{const cx=e[0]*SX,cy=e[1]*SY,rx=e[2]*SX,ry=e[3]*SY;for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(H-1,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(W-1,Math.ceil(cx+rx));x++){
    const u=(x-cx)/rx,vv=(y-cy)/ry,q=u*u+vv*vv+(w5g(x,y)-.5)*.5;if(q<=1)tmp[y*W+x]=v;}});
  elip(BAHIAS,0);elip(CABOS,1);
  // las casillas y su entorno inmediato se garantizan tras la deformación
  A.nodos.forEach(n=>{const r=26;for(let y=Math.max(0,Math.floor(n.y-r));y<=Math.min(H-1,Math.ceil(n.y+r));y++)for(let x=Math.max(0,Math.floor(n.x-r));x<=Math.min(W-1,Math.ceil(n.x+r));x++)
    if((x-n.x)*(x-n.x)+(y-n.y)*(y-n.y)<=r*r)tmp[y*W+x]=1;});
  A.tierra.set(tmp);
  // extra = tierra de fondo (no jugable): la que no está en la silueta ni en las casillas
  for(let i=0;i<W*H;i++)A.extra[i]=A.tierra[i]&&!raw[i]?1:0;
  // 3) lago de Maracaibo (agua interior)
  const lg=new Uint8Array(W*H);rasteriza(LAGO,lg,1);
  const w5=campo(22,21,3,2);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!lg[y*W+x])continue;
    const wx=(w5(x,y)-.5)*14;const sx=Math.max(0,Math.min(W-1,Math.round(x+wx)));if(lg[y*W+sx]&&A.tierra[y*W+x])A.tierra[y*W+x]=2;}
  // el lago nunca se come una casilla
  A.nodos.forEach(n=>{const r=18;for(let y=Math.max(0,Math.floor(n.y-r));y<=Math.min(H-1,Math.ceil(n.y+r));y++)for(let x=Math.max(0,Math.floor(n.x-r));x<=Math.min(W-1,Math.ceil(n.x+r));x++)
    if((x-n.x)*(x-n.x)+(y-n.y)*(y-n.y)<=r*r&&A.tierra[y*W+x]===2)A.tierra[y*W+x]=1;});
  // 4) distancia con signo a la costa (chamfer 3-4): la «costa» separa mar (0) de lo demás
  const INF=30000,d=A.dist;
  const pasa=(sel,sig)=>{const g=new Int16Array(W*H);for(let i=0;i<W*H;i++)g[i]=sel(A.tierra[i])?0:INF;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;let v=g[i];if(!v)continue;
      if(x>0&&g[i-1]+3<v)v=g[i-1]+3;if(y>0){if(g[i-W]+3<v)v=g[i-W]+3;if(x>0&&g[i-W-1]+4<v)v=g[i-W-1]+4;if(x<W-1&&g[i-W+1]+4<v)v=g[i-W+1]+4;}g[i]=v;}
    for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const i=y*W+x;let v=g[i];if(!v)continue;
      if(x<W-1&&g[i+1]+3<v)v=g[i+1]+3;if(y<H-1){if(g[i+W]+3<v)v=g[i+W]+3;if(x<W-1&&g[i+W+1]+4<v)v=g[i+W+1]+4;if(x>0&&g[i+W-1]+4<v)v=g[i+W-1]+4;}g[i]=v;}
    return g;};
  const aMar=pasa(t=>t===0),aTierra=pasa(t=>t!==0);       // aMar[i] = dist. al mar (tierra) · aTierra[i] = dist. a la tierra (mar)
  for(let i=0;i<W*H;i++)d[i]=A.tierra[i]===0?-Math.min(aTierra[i],32000):Math.min(aMar[i],32000);
  // 5) región más cercana (rejilla de 4 px, vecino más próximo entre las casillas) → bioma con bordes deformados
  const CW=W/4,CH=H/4,cell=new Uint8Array(CW*CH),ri={};A.regiones.forEach((r,i)=>{ri[r]=i+1;});
  for(let cy=0;cy<CH;cy++)for(let cx=0;cx<CW;cx++){let best=1e12,b=0;const px=cx*4+2,py=cy*4+2;
    for(let k=0;k<A.nodos.length;k++){const n=A.nodos[k],dd=(n.x-px)*(n.x-px)+(n.y-py)*(n.y-py);if(dd<best){best=dd;b=ri[n.r]||0;}}cell[cy*CW+cx]=b;}
  const w6=campo(60,31,3,4),w7=campo(60,32,3,4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(A.tierra[i]===0)continue;
    const wx=(w6(x,y)-.5)*70,wy=(w7(x,y)-.5)*70;
    const cx=Math.max(0,Math.min(CW-1,((x+wx)/4)|0)),cy=Math.max(0,Math.min(CH-1,((y+wy)/4)|0));
    const r=cell[cy*CW+cx];A.reg[i]=r;
    let b=BIO_REG[A.regiones[r-1]];if(b===undefined)b=BIO.llano;
    const xw=(x+wx)/SX,yw=(y+wy)/SY;                                   // posición deformada en diseño: los bordes de bioma no son rectos
    if(A.extra[i]){b=(yw<270&&xw<300)?BIO.desierto:(xw<250+ (yw-300)*.15&&yw<575?BIO.andes:BIO.selva);}
    else{
      // geografía por encima de la región: el sur (Amazonas y Gran Sabana) y el sur de los Llanos / Guayana son selva
      if(b===BIO.llano&&yw>515)b=BIO.selva;
      if(b===BIO.sabana&&yw>545)b=BIO.selva;
      if(yw>610&&xw>400)b=BIO.selva;}
    A.bioma[i]=b;if(A.tierra[i]===2)A.bioma[i]=BIO.mar;}
  // 6) ocupación: discos de casilla (r 16 px) y caminos rectos entre casillas conectadas (±7 px)
  const oc=A.ocupado,marca=(cx,cy,r)=>{for(let y=Math.max(0,Math.floor(cy-r));y<=Math.min(H-1,Math.ceil(cy+r));y++)for(let x=Math.max(0,Math.floor(cx-r));x<=Math.min(W-1,Math.ceil(cx+r));x++)
    if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=r*r)oc[y*W+x]=1;};
  A.nodos.forEach(n=>marca(n.x,n.y,16));
  const ady=mapa.ady||{};Object.keys(ady).forEach(a=>{const na=N[a];if(!na)return;(ady[a]||[]).forEach(b=>{const nb=N[b];if(!nb)return;
    const rt=(mapa.rutas||[]).find(r=>(r.de===a&&r.a===b)||(r.de===b&&r.a===a));if(rt&&/aire|avion|salto|ferry|lancha|chalana|curiara|penero|teleferico|metro/.test(rt.modo||''))return;
    const x0=na.x*SX,y0=na.y*SY,x1=nb.x*SX,y1=nb.y*SY,L=Math.max(1,Math.hypot(x1-x0,y1-y0)),n=Math.ceil(L/3);
    for(let k=0;k<=n;k++)marca(x0+(x1-x0)*k/n,y0+(y1-y0)*k/n,6);});});
  return A;
}

/* ── construcción completa ── */
function construir(opt){
  opt=opt||{};
  const mapa=opt.mapa||(F.MAPAS&&F.MAPAS.venezuela)||(NODE?require('./fiesta-mapa-venezuela.js'):null);
  if(!mapa)throw new Error('fiesta-mapa-arte: falta el mapa');
  const ahora=()=>typeof performance!=='undefined'?performance.now():Date.now();
  const A=nuevo(mapa);const t0=ahora();baseMapa(A);A.tiempos.base=Math.round(ahora()-t0);
  for(let i=0;i<CAPAS.length;i++){const c=CAPAS[i];if(opt.solo&&opt.solo.indexOf(c.id)<0&&c.orden<90&&opt.soloEstricto)continue;const t=ahora();
    try{c.fn(A);}catch(e){A.errores.push(c.id+': '+(e&&e.stack?String(e.stack).split('\n').slice(0,3).join(' | '):e));}
    A.tiempos[c.id]=Math.round(ahora()-t);}
  A.tiempos.total=Math.round(ahora()-t0);
  return A;
}

/* ── navegador: arte horneado (PNG + JSON de animaciones) o, si falta, construcción procedural ── */
// Producción: assets/fiesta/mapa-venezuela.png + .dyn.json (los hornea pruebas/fiesta-arte-hornear.js): cero coste de generación en el cliente.
// Desarrollo: si el PNG no existe, se construye el búfer procedural al primer uso (unos segundos).
const ASSET='assets/fiesta/mapa-venezuela';
let CACHE=null,LIENZO=null,HORNEADO=null,DYNJ=null,CARGA=0;const ESPERA=[];
function arte(opt){if(!CACHE)CACHE=construir(opt);return CACHE;}
function procedural(opt){
  if(typeof document==='undefined')return null;
  const A=arte(opt),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),im=x.createImageData(W,H);
  new Uint32Array(im.data.buffer).set(A.buf);x.putImageData(im,0,0);DYNJ=A.dyn;return LIENZO=c;}
// Devuelve el lienzo del arte si ya está listo (horneado cargado o, sin PNG, procedural); null mientras carga el PNG.
function lienzo(opt){
  if(LIENZO)return LIENZO;if(typeof document==='undefined')return null;
  if(HORNEADO)return LIENZO=HORNEADO;
  if(CARGA===0)cargar();
  if(CARGA===3)return procedural(opt);                 // falló la carga del PNG horneado → procedural
  return null;}
// Inicia la carga (una vez). cb se llama cuando el arte queda listo (o cae al modo procedural).
function cargar(cb,base){
  if(cb)ESPERA.push(cb);if(CARGA!==0){if(CARGA!==1&&cb)cb();return;}
  CARGA=1;if(typeof Image==='undefined'){CARGA=3;return;}
  const fin=()=>{const l=ESPERA.splice(0);l.forEach(f=>{try{f();}catch(_){}});};
  const im=new Image(),pre=base||ASSET;
  im.onload=()=>{HORNEADO=im;CARGA=2;
    const dyn=()=>{fin();};
    if(typeof fetch==='function')fetch(pre+'.dyn.json').then(r=>r.ok?r.json():[]).then(j=>{DYNJ=j;dyn();}).catch(()=>{DYNJ=[];dyn();});else{DYNJ=[];dyn();}};
  im.onerror=()=>{CARGA=3;fin();};
  im.src=pre+'.png?v=1792000000';}
function olvidar(){CACHE=null;LIENZO=null;HORNEADO=null;DYNJ=null;CARGA=0;}
// pinta las entidades animadas dentro del rectángulo de mundo r={x0,y0,x1,y1}; c ya tiene la transformación del mundo
function dibujarDin(c,t,r){
  const L=DYNJ||(CACHE&&CACHE.dyn);if(!L||!L.length)return 0;let n=0;
  c.save();c.scale(U,U);const smooth=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;
  const x0=r.x0/U-80,y0=r.y0/U-80,x1=r.x1/U+80,y1=r.y1/U+80;
  for(let i=0;i<L.length;i++){const e=L[i];if(e.x<x0||e.x>x1||e.y<y0||e.y>y1)continue;const f=DIN[e.k];if(!f)continue;
    try{f(c,e,t);n++;}catch(_){}}
  c.imageSmoothingEnabled=smooth;c.restore();return n;}

F.arte={cargar:cargar,W:W,H:H,SX:SX,SY:SY,U:U,BIO:BIO,BIO_NOMBRE:BIO_NOMBRE,PAL:PAL,capa:capa,din:DIN,construir:construir,arte:arte,lienzo:lienzo,olvidar:olvidar,dibujarDin:dibujarDin,
  campo:campo,rgb:rgb,hex:hex,mezcla:mezcla,sombrea:sombrea,aclara:aclara,hash:hash,vn:vn,fbm:fbm,rng:rng,SILUETA:SIL,LAGO:LAGO,ISLAS:ISLAS,
  capas:()=>CAPAS.map(c=>c.id+':'+c.orden)};
if(typeof module!=='undefined')module.exports=F.arte;
})(typeof window!=='undefined'?window:globalThis);
