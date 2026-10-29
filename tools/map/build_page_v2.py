"""Assemble docs/style-lab/mapa3d-v2.html from mapa3d-isla.html: keeps the tiles / paths / characters / turn / camera code and swaps the
geography, terrain, vegetation and landmarks for the v2 data pack (assets/map/v2/*). Run: python3 tools/map/build_page_v2.py"""
import os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'docs', 'style-lab', 'mapa3d-isla.html')
DST = os.path.join(ROOT, 'docs', 'style-lab', 'mapa3d-v2.html')
s = open(SRC, encoding='utf-8').read()
s = s.replace("if(h<SEA+.2){t=SEA+4;puente=1;}", "if(h<SEA+.2){t=Math.max(SEA+4,Math.min(Math.max(altura(A.x,A.y),altura(B.x,B.y)),TOPE+3)+1.4);puente=1;}")


def cut(text, a, b, repl):
    i = text.index(a)
    j = text.index(b, i)
    return text[:i] + repl + text[j:]


NEW_DATA = r'''/* ── datos del mapa v2: posiciones de casillas, ríos y alturas salen de assets/map/v2 (layout_v2.py + terrain_v2.py) ── */
const V2='../../assets/map/v2/',fj=async n=>(await fetch(V2+n,{cache:'no-cache'})).json();
const GEO=await fj('layout.json'),META=await fj('terrain_meta.json');
const HGT=new Float32Array(await(await fetch(V2+'heights.f32',{cache:'no-cache'})).arrayBuffer());
const HEROES=META.heroes||[];for(const h of HEROES)h.g=new Float32Array(await(await fetch(V2+'heights_hero_'+h.name+'.f32',{cache:'no-cache'})).arrayBuffer());
const TREES=await fj('trees.json'),PLC=await fj('placements.json').catch(()=>({props:[],treeSets:{}}));
const CW=GEO.canvas[0],CH=GEO.canvas[1],NXG=META.nx,NYG=META.ny,CELLG=META.cell,TILE_R=8,SEA=1.5,TOPE=10,TOK=.42;
const POS={};IDS.forEach(i=>{POS[i]={x:GEO.nodes[i][0],y:GEO.nodes[i][1]};NOD[i].x=POS[i].x;NOD[i].y=POS[i].y;});
const MODOS={};(MAPA.rutas||[]).forEach(r=>{MODOS[r.de+'|'+r.a]=r.modo;});
const TIPOM=m=>({avion:'air',avioneta:'air',ferry:'sea',lancha:'sea',penero:'sea',teleferico:'cable'})[m]||'road';

/* ── caminos: tramos con su tipo (a pie / aire / mar / cable) y cruces ── */
const EDGES=[];
(function(){const vistos={};
  Object.keys(ADY).forEach(a=>ADY[a].forEach(b=>{if(!NOD[a]||!NOD[b])return;const k=a<b?a+'|'+b:b+'|'+a;if(vistos[k])return;vistos[k]=1;
    const m=MODOS[a+'|'+b]||MODOS[b+'|'+a];EDGES.push({a:a,b:b,modo:m,tipo:TIPOM(m)});}));
})();
EDGES.forEach(e=>{const A=POS[e.a],B=POS[e.b];e.L=Math.hypot(B.x-A.x,B.y-A.y);});
(function(){
  const inter=(p,q,r,s)=>{const d=(q.x-p.x)*(s.y-r.y)-(q.y-p.y)*(s.x-r.x);if(Math.abs(d)<1e-6)return null;
    const t=((r.x-p.x)*(s.y-r.y)-(r.y-p.y)*(s.x-r.x))/d,u=((r.x-p.x)*(q.y-p.y)-(r.y-p.y)*(q.x-p.x))/d;return(t>.02&&t<.98&&u>.02&&u<.98)?{t:t,u:u}:null;};
  EDGES.forEach(e=>{e.sobre=[];});
  for(let i=0;i<EDGES.length;i++)for(let j=i+1;j<EDGES.length;j++){const e=EDGES[i],f=EDGES[j];
    if(e.tipo!=='road'||f.tipo!=='road')continue;
    if(e.a===f.a||e.a===f.b||e.b===f.a||e.b===f.b)continue;
    const h=inter(POS[e.a],POS[e.b],POS[f.a],POS[f.b]);if(h)f.sobre.push(h.u*f.L);}
})();

/* ── alturas: rejilla exportada del terreno Blender (misma superficie que se ve) ── */
function altura(x,y){
  for(let q=0;q<HEROES.length;q++){const H=HEROES[q];if(x>=H.x0&&y>=H.y0&&x<H.x0+(H.nx-1)*H.cell-.01&&y<H.y0+(H.ny-1)*H.cell-.01){const fx=(x-H.x0)/H.cell,fy=(y-H.y0)/H.cell,ix=fx|0,iy=fy|0,u=fx-ix,v=fy-iy,k=iy*H.nx+ix,g=H.g;
    return lerp(lerp(g[k],g[k+1],u),lerp(g[k+H.nx],g[k+H.nx+1],u),v);}}
  const fx=clamp(x/CELLG,0,NXG-1.001),fy=clamp(y/CELLG,0,NYG-1.001),ix=fx|0,iy=fy|0,u=fx-ix,v=fy-iy,k=iy*NXG+ix;
  return lerp(lerp(HGT[k],HGT[k+1],u),lerp(HGT[k+NXG],HGT[k+NXG+1],u),v);}
/* ── ríos (curvas ya suavizadas por layout_v2.py) ── */
const RW={orinoco:2.2,caroni:1.2,apure:1.5,caura:1.0,meta_arauca:1.1,guarico:.9,portuguesa:.9,catatumbo:.9,unare:.8,tuy:.7};
const RIOS=Object.keys(GEO.rivers).map(k=>({k:k,p:GEO.rivers[k],w:RW[k]||.9}));
function distRio(x,y){let m=1e9;for(let r=0;r<RIOS.length;r++){const p=RIOS[r].p,w=RIOS[r].w;for(let i=0;i<p.length-1;i++){
  if(Math.abs(p[i][0]-x)>60||Math.abs(p[i][1]-y)>60)continue;const d=segDist(x,y,p[i][0],p[i][1],p[i+1][0],p[i+1][1])/w;if(d<m)m=d;}}return m;}

'''

NEW_TERRAIN = r'''/* terreno: lo carga el bloque del mundo (glb); aquí el agua estilizada con máscaras de costa sacadas de la rejilla de alturas */
(function(){
  const nx=NXG,ny=NYG;let m0=new Float32Array(nx*ny);for(let i=0;i<nx*ny;i++)m0[i]=clamp((HGT[i]-SEA)/7+.5,0,1);
  const blur=(src,r,pasadas)=>{let a=Float32Array.from(src),b=new Float32Array(nx*ny);
    for(let p=0;p<pasadas;p++){
      for(let y=0;y<ny;y++){let s=0;for(let x=-r;x<=r;x++)s+=a[y*nx+clamp(x,0,nx-1)];for(let x=0;x<nx;x++){b[y*nx+x]=s/(2*r+1);s+=a[y*nx+clamp(x+r+1,0,nx-1)]-a[y*nx+clamp(x-r,0,nx-1)];}}
      for(let x=0;x<nx;x++){let s=0;for(let y=-r;y<=r;y++)s+=b[clamp(y,0,ny-1)*nx+x];for(let y=0;y<ny;y++){a[y*nx+x]=s/(2*r+1);s+=b[clamp(y+r+1,0,ny-1)*nx+x]-b[clamp(y-r,0,ny-1)*nx+x];}}}
    return a;};
  const M1=blur(m0,1,1),M3=blur(m0,4,3),M2=blur(m0,11,2);
  const md=new Uint8Array(nx*ny*4);for(let i=0;i<nx*ny;i++){md[i*4]=M1[i]*255;md[i*4+1]=M3[i]*255;md[i*4+2]=M2[i]*255;const gx=i%nx,gy=(i/nx)|0,nz=fbm(gx*.38,gy*.38)*.65+fbm(gx*1.1,gy*1.1)*.35,lkw=((gx*CELLG>300&&gx*CELLG<700&&gy*CELLG>330&&gy*CELLG<800)||(gx*CELLG>1960&&gx*CELLG<2674&&gy*CELLG>959&&gy*CELLG<1500)||(gx*CELLG>1001&&gx*CELLG<2793&&gy*CELLG>1120&&gy*CELLG<2541)||(gx*CELLG>301&&gx*CELLG<1001&&gy*CELLG>1134&&gy*CELLG<1470))?0:1,sh=sstep(.02,.2,M3[i])*(HGT[i]<SEA-.3&&HGT[i]>-9?1:0)*lkw;md[i*4+3]=Math.max(0,Math.min(255,sstep(.5,.66,nz)*sh*255));}
  const dd=new Uint8Array(nx*ny*4);for(let i=0;i<nx*ny;i++){const v=Math.max(0,Math.min(1,(HGT[i]+14)/14));dd[i*4]=v*255;let dm=1e9;const gx=i%nx*CELLG,gy=((i/nx)|0)*CELLG;for(let q=0;q<IDS.length;q++){if(NOD[IDS[q]].r!=='del')continue;const ex=POS[IDS[q]].x-gx,ey=POS[IDS[q]].y-gy,e=ex*ex+ey*ey;if(e<dm)dm=e;}const inl=Math.max(0,Math.min(1,(M2[i]-.35)*4)),mud=(gx>1001&&gx<1960&&gy>1141&&gy<1701)?Math.min(1,Math.min(gx-1001,1960-gx,gy-1141,1701-gy)/70)*.85*inl:0;dd[i*4+1]=Math.max(Math.exp(-dm/(175*175)),mud)*255;{const q=POS.gua_pordaz,ex=q.x-gx,ey=q.y-gy;dd[i*4+2]=Math.exp(-(ex*ex+ey*ey)/(420*420))*255;}dd[i*4+3]=inl*((gx>1260&&gx<2100&&gy>1701&&gy<2541)?Math.min(1,Math.min(gx-1260,2100-gx,gy-1701,2541-gy)/60)*230:(gx>1001&&gx<1960&&gy>1141&&gy<1701)?Math.min(1,Math.min(gx-1001,1960-gx,gy-1141,1701-gy)/70)*120:0);}
  const tt=new Uint8Array(nx*ny*4);
  const stamp=(x,y,r,cl,k,lk)=>{const i0=Math.max(0,Math.floor((x-r)/CELLG)),i1=Math.min(nx-1,Math.ceil((x+r)/CELLG)),j0=Math.max(0,Math.floor((y-r)/CELLG)),j1=Math.min(ny-1,Math.ceil((y+r)/CELLG));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=Math.hypot(i*CELLG-x,j*CELLG-y)/r;if(d>=1||(!lk&&M2[j*nx+i]<.38))continue;const a=Math.min(1,(1-d)*2.2)*k*255,o=(j*nx+i)*4;if(a>tt[o+3]){tt[o]=cl[0]*255;tt[o+1]=cl[1]*255;tt[o+2]=cl[2]*255;tt[o+3]=a;}}};
  const RTINT={orinoco:[.58,.44,.22],caroni:[.26,.16,.09],caura:[.28,.18,.10],apure:[.56,.46,.28],meta_arauca:[.60,.48,.30],guarico:[.50,.42,.26],portuguesa:[.50,.42,.26],catatumbo:[.14,.34,.30],unare:[.20,.46,.36],tuy:[.20,.46,.38]};
  Object.keys(GEO.rivers).forEach(k=>{const c=RTINT[k]||[.22,.50,.42],p=GEO.rivers[k],r=Math.max(CELLG*1.6,k==='orinoco'?340:k==='apure'?170:(k==='caroni'||k==='meta_arauca')?130:95);
    for(let i=0;i<p.length-1;i++){const L=Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1]),n=Math.max(1,Math.ceil(L/(CELLG*.6)));for(let q=0;q<=n;q++)stamp(lerp(p[i][0],p[i+1][0],q/n),lerp(p[i][1],p[i+1][1],q/n),r,c,.92);}});
  [GEO.lake,GEO.canal].forEach(poly=>{if(!poly)return;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;poly.forEach(q=>{x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);});
    for(let j=Math.max(0,Math.floor(y0/CELLG));j<=Math.min(ny-1,Math.ceil(y1/CELLG));j++)for(let i=Math.max(0,Math.floor(x0/CELLG));i<=Math.min(nx-1,Math.ceil(x1/CELLG));i++){const x=i*CELLG,y=j*CELLG;let ins=false;for(let a=0,b=poly.length-1;a<poly.length;b=a++){const A=poly[a],B=poly[b];if((A[1]>y)!==(B[1]>y)&&x<(B[0]-A[0])*(y-A[1])/(B[1]-A[1])+A[0])ins=!ins;}
      if(ins){const o=(j*nx+i)*4;tt[o]=.17*255;tt[o+1]=.47*255;tt[o+2]=.43*255;tt[o+3]=255;}}});
  const ttx=new THREE.DataTexture(tt,nx,ny,THREE.RGBAFormat);ttx.magFilter=ttx.minFilter=THREE.LinearFilter;ttx.needsUpdate=true;
  const dtx=new THREE.DataTexture(dd,nx,ny,THREE.RGBAFormat);dtx.magFilter=dtx.minFilter=THREE.LinearFilter;dtx.needsUpdate=true;
  const mt=new THREE.DataTexture(md,nx,ny,THREE.RGBAFormat);mt.magFilter=mt.minFilter=THREE.LinearFilter;mt.needsUpdate=true;
  W2=new THREE.ShaderMaterial({uniforms:{mask:{value:mt},depthT:{value:dtx},tintT:{value:ttx},t:{value:0},hlf:{value:new THREE.Vector2(CW/2,CH/2)},span:{value:new THREE.Vector2((nx-1)*CELLG,(ny-1)*CELLG)}},
    vertexShader:'uniform vec2 hlf;uniform vec2 span;varying vec2 vUv;varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vUv=(w.xz+hlf)/span;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`precision highp float;uniform sampler2D mask;uniform sampler2D depthT;uniform sampler2D tintT;uniform float t;varying vec2 vUv;varying vec3 vW;
      float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1.,0.)),f.x),mix(hs(i+vec2(0.,1.)),hs(i+vec2(1.,1.)),f.x),f.y);}
      void main(){vec4 m=texture2D(mask,vUv);float land=m.r,near=m.g,far=m.b;
        float dep=texture2D(depthT,vUv).r;                       // 0 = 14 deep ... 1 = surface
        vec3 deep=vec3(.05,.30,.72),mid=vec3(.08,.52,.90),shal=vec3(.12,.84,.88),flt=vec3(.55,.95,.90);
        vec3 c=mix(deep,mid,smoothstep(.0,.32,far));c=mix(c,shal,smoothstep(.03,.5,near));
        c=mix(c,mix(shal,flt,smoothstep(.82,.97,dep)),smoothstep(.62,.84,dep));          // classic bright turquoise over shallow reef flats
        c=mix(c,mid,smoothstep(.70,.50,dep)*.0);
        float dl=texture2D(depthT,vUv).g;
        c=mix(c,vec3(.03,.27,.72),smoothstep(.56,.40,dep)*texture2D(depthT,vUv).b);
        c=mix(c,vec3(.30,.62,.58),dl*smoothstep(.5,.78,dep)*.62);c=mix(c,vec3(.50,.52,.30),dl*smoothstep(.5,.78,dep)*.35*smoothstep(.6,1.1,ns(vW.xz*.03)));c=mix(c,vec3(.28,.40,.30),dl*(1.-smoothstep(.5,.78,dep))*.4);vec4 tn=texture2D(tintT,vUv);float tk=max(max(smoothstep(.5,.75,far),smoothstep(.15,.55,tn.a)),step(.97,tn.a));tn.rgb=mix(vec3(.30,.54,.44),tn.rgb,smoothstep(.0,.3,tn.a));c=mix(c,tn.rgb,tk*smoothstep(.25,.62,dep)*.92);c=mix(c,tn.rgb*.72,tk*(1.-smoothstep(.25,.62,dep))*.8);float gd=texture2D(depthT,vUv).a;c=mix(c,vec3(.68,.50,.22),gd*smoothstep(.3,.7,dep)*.95);c=mix(c,vec3(.50,.35,.16),gd*(1.-smoothstep(.3,.7,dep))*.9);
        float cor=smoothstep(.45,.7,m.a)*smoothstep(.55,.75,dep)*(1.-dl);c=mix(c,vec3(.11,.45,.40),cor*.75);c=mix(c,vec3(.45,.30,.42),smoothstep(.85,1.,m.a)*.3*cor);
        float sb=smoothstep(.78,.94,dep)*(1.-smoothstep(.5,.62,m.a))*(1.-dl);c=mix(c,vec3(.95,.93,.78),sb*.45);
        float w=ns(vW.xz*.05+vec2(t*.06,t*.03))+.5*ns(vW.xz*.15-vec2(t*.09,t*.05));
        c+=vec3(.05,.07,.06)*smoothstep(.95,1.35,w);
        c=mix(c,c*.78,dl*smoothstep(.7,1.2,w));
        float a=.5+.05*sin(t*1.3+vW.x*.1+vW.z*.07),b2=.3+.05*sin(t*1.1+vW.x*.07-vW.z*.11);
        float f1=1.-smoothstep(.0,.08,abs(land-a)),f2=(1.-smoothstep(.0,.05,abs(land-b2)))*.55;
        c=mix(c,vec3(.97,.99,1.),clamp(f1+f2*step(land,.46),0.,1.)*step(.02,land)*(1.-dl*.85));
        gl_FragColor=vec4(c,1.);}`});
  // diorama: el mar vive dentro de una losa con paredes de tierra por estratos (como una maqueta)
  const mar=new THREE.Mesh(new THREE.PlaneGeometry(CW,CH).rotateX(-Math.PI/2),W2);mar.position.y=SEA+.45;S.add(mar);
  const WALLB=-130,TOPY=SEA+.45,SEG=34,wp=[],wc=[],wi=[],bandas=['#9a6438','#b0773f','#80502c','#a86d3c','#8f5a33'];
  const pared=(x0,z0,x1,z1)=>{const Ln=Math.hypot(x1-x0,z1-z0),n=Math.ceil(Ln/SEG);for(let i=0;i<n;i++){const a=i/n,b=(i+1)/n,xa=lerp(x0,x1,a),za=lerp(z0,z1,a),xb=lerp(x0,x1,b),zb=lerp(z0,z1,b);
    for(let k=0;k<8;k++){const ya=k===0?TOPY:lerp(TOPY-6,WALLB,(k-1)/7),yb=k===0?TOPY-6:lerp(TOPY-6,WALLB,k/7),base=wp.length/3;wp.push(xa,ya,za,xb,ya,zb,xb,yb,zb,xa,yb,za);
      const c=col(k===0?['#6aa83a','#7cb844','#5f9a34'][(i+k)%3]:bandas[(i*3+k*2+Math.floor(hash(i,k)*3))%bandas.length]);c.multiplyScalar(.86+.22*hash(i+9,k));for(let q=0;q<4;q++)wc.push(c.r,c.g,c.b);wi.push(base,base+2,base+1,base,base+3,base+2);}}};
  const hx=CW/2,hz=CH/2;pared(-hx,-hz,hx,-hz);pared(hx,-hz,hx,hz);pared(hx,hz,-hx,hz);pared(-hx,hz,-hx,-hz);
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(wp),3));wg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(wc),3));wg.setIndex(wi);wg.computeVertexNormals();
  S.add(new THREE.Mesh(wg,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
  const fondo=new THREE.Mesh(new THREE.PlaneGeometry(CW,CH).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x5a3a22}));fondo.position.y=WALLB;S.add(fondo);
})();
const W3=(x,y)=>new THREE.Vector3(x-CW/2,altura(x,y),y-CH/2);   // lienzo → mundo
'''

NEW_WORLD = r'''/* ── mundo: terreno Blender, árboles instanciados, hitos, fauna, niebla y nubes (todo desde assets/map/v2 + assets/models) ── */
const MD='../../assets/models/',MAT=new THREE.MeshLambertMaterial({vertexColors:true}),GCACHE={};
const cargaGLB=n=>GCACHE[n]||(GCACHE[n]=GLBLite.load(MD+n+'.glb').catch(e=>{console.warn('glb',n,e);return null;}));
const mk=(nodes,pick,zero)=>{const g=new THREE.Group();for(const k in nodes){if(pick&&!pick(k))continue;const n=nodes[k],m=new THREE.Mesh(n.geo,MAT);m.name=k;
  if(!zero){m.position.copy(n.pos);m.quaternion.copy(n.quat);m.scale.copy(n.sc);}g.add(m);}return g;};
const CHK=[],CSZ=360,FR=new THREE.Frustum(),PM=new THREE.Matrix4(),IV=new THREE.Matrix4();
function instChunks(geo,L,fill,lod){ // L: [[kind,x,y,rot,scale,...]] → InstancedMesh por cuadrante, con recorte por frustum y LOD por distancia
  const bk={};L.forEach(t=>{const k=Math.floor(t[1]/CSZ)+','+Math.floor(t[2]/CSZ);(bk[k]=bk[k]||[]).push(t);});
  geo.computeBoundingSphere();const gr=geo.boundingSphere?geo.boundingSphere.radius:10;
  for(const k in bk){const arr=bk[k];for(let i=arr.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const tmp=arr[i];arr[i]=arr[j];arr[j]=tmp;}
    const im=new THREE.InstancedMesh(geo,MAT,arr.length),m4=new THREE.Matrix4();let sx=0,sz=0,sy=0;
    arr.forEach((t,i)=>{fill(t,m4);im.setMatrixAt(i,m4);sx+=m4.elements[12];sy+=m4.elements[13];sz+=m4.elements[14];});
    im.instanceMatrix.needsUpdate=true;im.frustumCulled=false;S.add(im);
    CHK.push({im:im,n:arr.length,lod:lod==null?1:lod,s:new THREE.Sphere(new THREE.Vector3(sx/arr.length,sy/arr.length,sz/arr.length),CSZ*.78+gr)});}
}
window.__cull=function(){cam.updateMatrixWorld();IV.copy(cam.matrixWorld).invert();PM.multiplyMatrices(cam.projectionMatrix,IV);FR.setFromProjectionMatrix(PM);
  const cp=cam.position;for(let i=0;i<CHK.length;i++){const c=CHK[i],vis=FR.intersectsSphere(c.s);c.im.visible=vis;if(!vis)continue;const d=cp.distanceTo(c.s.center);if(c.lod>=1&&d>3000){c.im.visible=false;continue;}const f0=d<520?1:d<820?.62:d<1250?.36:d<2100?.18:.07,f=d>4200?.2:1+(f0-1)*c.lod;c.im.count=Math.max(1,Math.floor(c.n*f));}};
const CAB=[],TELEC=window.__telec=[];
const ANIM=window.__anim=[];
(async()=>{try{
  // terreno
  const te=await cargaGLB('venezuela_v2_terrain');
  if(te){const tg=Object.values(te)[0].geo.toNonIndexed();tg.computeVertexNormals();
    const P=tg.attributes.position.array,N=tg.attributes.normal.array,C=tg.attributes.color.array,TS=320,bk={};
    for(let t=0;t<P.length/9;t++){const cx=(P[t*9]+P[t*9+3]+P[t*9+6])/3,cz=(P[t*9+2]+P[t*9+5]+P[t*9+8])/3,k=Math.floor(cx/TS)+','+Math.floor(cz/TS);(bk[k]=bk[k]||[]).push(t);}
    const tm=new THREE.MeshLambertMaterial({vertexColors:true});
    for(const k in bk){const T=bk[k],p=new Float32Array(T.length*9),n=new Float32Array(T.length*9),c=new Float32Array(T.length*9);
      T.forEach((t,i)=>{for(let q=0;q<9;q++){p[i*9+q]=P[t*9+q];n[i*9+q]=N[t*9+q];c[i*9+q]=C[t*9+q];}});
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(n,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));g.computeBoundingSphere();S.add(new THREE.Mesh(g,tm));}}
  // árboles y plantas (kind → modelo)
  const SETS=Object.assign({round:{glb:'trees',node:'tree_m_round',s:1.15},flat:{glb:'trees',node:'tree_m_flat',s:1.2},cone:{glb:'trees',node:'tree_m_cone',s:.75}},PLC.treeSets||{});
  const porKind={};TREES.forEach(t=>{(porKind[t[0]]=porKind[t[0]]||[]).push(t);});
  for(const k in porKind){let st=SETS[k];if(!st)continue;let nd=await cargaGLB(st.glb);if(!nd){st=SETS.round;nd=await cargaGLB(st.glb);}
    const names=(Array.isArray(st.node)?st.node:[st.node]).filter(n=>nd[n]);if(!names.length)continue;
    const lista=porKind[k],buckets=names.map(()=>[]);lista.forEach((t,i)=>buckets[i%names.length].push(t));
    names.forEach((nn,bi)=>{const L=buckets[bi];if(!L.length)return;
      instChunks(nd[nn].geo,L,(t,m4)=>{const p=W3(t[1],t[2]),sc=t[4]*(st.s||1),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),t[3]);m4.compose(new THREE.Vector3(p.x,p.y-.2,p.z),q,new THREE.Vector3(sc,sc,sc));});
      const _ = 0;});}
  // hitos y fauna
  for(const it of PLC.props||[]){const nd=await cargaGLB(it.glb);if(!nd)continue;
    const g=mk(nd,it.only?k=>it.only.indexOf(k)>=0:null,it.zero);const p=W3(it.x,it.y);
    g.position.set(p.x,it.z!=null?it.z:Math.max(p.y,SEA)+(it.dy||0),p.z);g.rotation.y=it.rot||0;g.scale.set((it.sx||1)*(it.s||1),it.s||1,it.s||1);S.add(g);
    if(it.anim==='vaga'){const o={g:g,x:p.x,z:p.z,r:it.radio||10,t:Math.random()*6,v:.12+Math.random()*.1,y0:g.position.y};ANIM.push(dt=>{o.t+=dt*o.v;g.position.x=o.x+Math.cos(o.t)*o.r;g.position.z=o.z+Math.sin(o.t)*o.r*.7;g.rotation.y=-o.t-Math.PI/2;});}}
  // ciudades: edificios, casas y barrios instanciados alrededor de cada población
  if(PLC.urbs){const por={};PLC.urbs.forEach(t=>{const k=(t[5]||'urbano')+'|'+t[0];(por[k]=por[k]||[]).push(t);});
    for(const k in por){const [gn,nn]=k.split('|'),ub=await cargaGLB(gn);if(!ub||!ub[nn])continue;
      instChunks(ub[nn].geo,por[k],(t,m4)=>{const p=W3(t[1],t[2]),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),t[3]);m4.compose(new THREE.Vector3(p.x,t[6]!=null?t[6]:Math.max(p.y,SEA),p.z),q,new THREE.Vector3(t[4]*(t[7]||1),t[4],t[4]));},/^(puente|autopista|buque|muelle|alto_horno|chimenea|grua|torre|iglesia|fuerte|faro|estadio|capitolio|teatro|centro|hotel|estacion|cascada|rapidos|puente_llano|isla_rocosa|casa_hacienda|molino|anexo|caney|cartel|tanque_agua|tanquero|antorcha|planta_|tanque_|balancin|islote|cascada|choza|muelle_selva|canoa_|rapido_|guacamaya_vuelo|cima_roca|cobertizo|puente_cuerdas)/.test(nn)?0:.5);}}
  // barcos
  if(PLC.boats){const por={};PLC.boats.forEach(t=>{const k=(t[5]||'barcos')+'|'+t[0];(por[k]=por[k]||[]).push(t);});
    for(const k in por){const [gn,nn]=k.split('|'),bb=await cargaGLB(gn);if(!bb||!bb[nn])continue;
      instChunks(bb[nn].geo,por[k],(t,m4)=>{const p=W3(t[1],t[2]),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),t[3]);m4.compose(new THREE.Vector3(p.x,SEA-.1,p.z),q,new THREE.Vector3(t[4],t[4],t[4]));});}}
  // puente del lago entre dos casillas
  if(PLC.puente){const A=POS[PLC.puente[0]],B=POS[PLC.puente[1]],nd=await cargaGLB('maracaibo_bridge');if(nd){const g=mk(nd),len=Math.hypot(B.x-A.x,B.y-A.y);
    const p=W3((A.x+B.x)/2,(A.y+B.y)/2);g.position.set(p.x,SEA,p.z);g.rotation.y=-Math.atan2(B.y-A.y,B.x-A.x);g.scale.x=(len+24)/96;S.add(g);}}
  // teleféricos
  const tl=await cargaGLB('teleferico');
  if(tl){const cabina=(P,Q)=>{const a=W3(P.x,P.y),b=W3(Q.x,Q.y),dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),g=mk(tl);
      g.rotation.order='YZX';g.rotation.y=-Math.atan2(dz,dx);g.rotation.z=Math.atan2(b.y-a.y,d);g.scale.set(d/32,1.25,1.25);g.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);S.add(g);
      const ca=g.getObjectByName('cabin_a'),cb=g.getObjectByName('cabin_b');let t=rnd();
      TELEC.push(dt=>{t=(t+dt*.07)%2;const u=t<1?t:2-t;ca.position.x=lerp(-16,16,u);cb.position.x=-ca.position.x;});};
    EDGES.filter(e=>e.tipo==='cable').forEach(e=>{const A=POS[e.a],B=POS[e.b];let best=0,bm=.5;
      for(let i=1;i<24;i++){const t=i/24,x=lerp(A.x,B.x,t),y=lerp(A.y,B.y,t),h=altura(x,y),lh=lerp(altura(A.x,A.y),altura(B.x,B.y),t);if(h-lh>best){best=h-lh;bm=t;}}
      if(best>9){const M={x:lerp(A.x,B.x,bm),y:lerp(A.y,B.y,bm)};cabina(A,M);cabina(M,B);}else cabina(A,B);});}
  // rutas aéreas y marítimas: arcos / trazos punteados sobre el mapa
  (function(){const pos=[],cl=[],idx=[];const quad=(a,b,hw,c,dy)=>{const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1,nx=-dz/l*hw,nz=dx/l*hw,k=pos.length/3;
      pos.push(a.x+nx,a.y,a.z+nz,a.x-nx,a.y,a.z-nz,b.x+nx,b.y,b.z+nz,b.x-nx,b.y,b.z-nz);for(let i=0;i<4;i++)cl.push(c.r,c.g,c.b);idx.push(k,k+2,k+1,k+1,k+2,k+3);};
    EDGES.filter(e=>e.tipo==='air'||e.tipo==='sea').forEach(e=>{const a=W3p(e.a),b=W3p(e.b),aire=e.tipo==='air',n=Math.max(8,Math.floor(e.L/9)),cc=aire?col('#ffffff'):col('#bff4ff'),pk=aire?Math.min(60,e.L*.22):0;
      for(let i=0;i<n;i+=2){const t0=i/n,t1=(i+1)/n,f=t=>({x:lerp(a.x,b.x,t),y:(aire?Math.max(a.y,b.y)+8+4*Math.sin(Math.PI*t)*pk/4:SEA+.5),z:lerp(a.z,b.z,t)});quad(f(t0),f(t1),aire?1.3:1.6,cc);}});
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(cl),3));g.setIndex(idx);
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));m.renderOrder=3;m.visible=false;S.add(m);window.__rutasEsp=m;})();
  // niebla: puffs suaves (sprites con degradado) en el Delta, Canaima y los páramos; nubes bajas muy ralas sobre el mar
  (function(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,4,64,64,62);
    gr.addColorStop(0,'rgba(255,255,255,.75)');gr.addColorStop(.5,'rgba(240,248,255,.35)');gr.addColorStop(1,'rgba(240,248,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
    const tx=new THREE.CanvasTexture(c);
    const bruma=(x,y,n,rad,alt,op,tam)=>{for(let i=0;i<n;i++){const a=rnd()*6.28,d=Math.sqrt(rnd())*rad,sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,opacity:op*(.6+rnd()*.5),depthWrite:false,fog:false}));
      const p=W3(x+Math.cos(a)*d,y+Math.sin(a)*d);sp.position.set(p.x,Math.max(p.y,SEA)+alt+rnd()*6,p.z);const k=tam*(.7+rnd()*.6);sp.scale.set(k,k*.55,1);sp.renderOrder=4;S.add(sp);}};
    seed=33;IDS.filter(i=>NOD[i].r==='del').forEach(i=>bruma(POS[i].x,POS[i].y,5,46,8,.55,64));
    ['can_saltoangel','can_roraima','can_kavac','and_picoespejo','and_losnevados','coc_choroni','ccs_galipan'].forEach(i=>{if(POS[i])bruma(POS[i].x,POS[i].y,6,56,18,.6,70);});
    seed=47;(PLC.brumas||[]).forEach(b=>bruma(b[0],b[1],b[2],b[3],b[4],b[5],b[6]));
  })();
  // tormenta del Catatumbo: nube oscura sobre el lago con relámpagos que parpadean
  (function(){const g=new THREE.Group(),mat=new THREE.MeshLambertMaterial({color:0x59586c}),mat2=new THREE.MeshLambertMaterial({color:0x8b8aa0}),c0=W3(500,205);
    for(let i=0;i<14;i++){const r=7+Math.random()*8,m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),i%3?mat:mat2);m.position.set((Math.random()-.5)*60,(Math.random()-.5)*6,(Math.random()-.5)*34);m.scale.y=.55;g.add(m);}
    g.position.set(c0.x,62,c0.z);S.add(g);
    const bolts=[];for(let k=0;k<3;k++){const pts=[],bx=(Math.random()-.5)*50,bz=(Math.random()-.5)*22;let x=bx,y=0,z=bz;for(let i=0;i<9;i++){pts.push(new THREE.Vector3(x,y,z));x+=(Math.random()-.5)*10;z+=(Math.random()-.5)*8;y-=6+Math.random()*2;}
      const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xeee6ff}));l.visible=false;g.add(l);bolts.push(l);}
    let tm=2,fl=0;ANIM.push(dt=>{tm-=dt;if(tm<0){tm=1.2+Math.random()*3.5;fl=.18;const b=bolts[(Math.random()*3)|0];b.userData.on=1;b.visible=true;setTimeout(()=>{b.visible=false;},120+Math.random()*120);}
      g.children.forEach(m=>{if(m.isMesh)m.material.emissive&&m.material.emissive.setScalar(fl>0?.35:0);});fl=Math.max(0,fl-dt);});})();
  window.__modelos='ok';
}catch(e){console.error('mundo',e);window.__modelos='error: '+e;}})();

'''

# --- assemble ---
s = s.replace("(function(){\n'use strict';", "(async function(){\n'use strict';", 1)
s = cut(s, "/* ── casillas: separar los centros", "/* ── escena ── */", NEW_DATA)
s = cut(s, "/* terreno */", "const W3p=", NEW_TERRAIN)
s = cut(s, "/* ── vegetación:", "/* ── fichas:", NEW_WORLD)
# paths: only walkable edges become road ribbons; offsets use the canvas centre
s = s.replace("  EDGES.forEach(e=>{\n    const A=POS[e.a],B=POS[e.b],n=Math.max(3,", "  EDGES.forEach(e=>{\n    if(e.tipo!=='road')return;\n    const A=POS[e.a],B=POS[e.b],n=Math.max(3,")
s = s.replace("x:p[0]-500,y:hc[i],z:p[1]-500", "x:p[0]-CW/2,y:hc[i],z:p[1]-CH/2")
s = re.sub(r"RIOS\.forEach\(r=>\{const hs=suave\(r\.map\(p=>altura\(p\[0\],p\[1\]\)\),4,3\),P=r\.map\(\(p,i\)=>\(\{x:p\[0\]-500,y:hs\[i\],z:p\[1\]-500\}\)\);\n\s*rc\.push\(\{P:P,hw:4\.6,dy:\.5,col:\(\)=>col\('#9ad8f2'\)\},\{P:P,hw:3\.3,dy:\.62,col:\(\)=>col\('#3aa0e8'\)\}\);\}\);",
           "const RIOSV=[];RIOS.forEach(r=>{if(!/^(apure|guarico|portuguesa|meta_arauca|caroni|orinoco|caura)$/.test(r.k)){RIOSV.push(r);return}let run=[];r.p.forEach(p=>{const inb=[[1001,784,1645,1141],[2198,959,2674,1500],[1960,1120,2198,1500],[1001,1141,1260,1470],[1260,1141,1645,1701],[1645,1120,1960,1701],[1960,1500,2793,1701],[2100,1701,2793,1890],[1260,1701,2100,2310],[1260,2310,2100,2541],[301,1134,1001,1470],[301,1020,1001,1134]].some(q=>p[0]>q[0]&&p[0]<q[2]&&p[1]>q[1]&&p[1]<q[3]);if(inb){if(run.length>1)RIOSV.push({k:r.k,w:r.w,p:run});run=[]}else run.push(p)});if(run.length>1)RIOSV.push({k:r.k,w:r.w,p:run});});\n    RIOSV.forEach(r=>{const hs=suave(r.p.map(p=>Math.max(altura(p[0],p[1]),SEA+.2)),4,3),P=r.p.map((p,i)=>({x:p[0]-CW/2,y:hs[i],z:p[1]-CH/2}));\n    const dl_=r.k.indexOf('delta')===0,RCL={orinoco:['#d6b878','#a9843f'],caroni:['#6b4a2c','#3a2412'],caura:['#6b4a2c','#3a2412'],apure:['#d2bb86','#a58a52'],meta_arauca:['#d8c08c','#b09258'],guarico:['#c9b684','#9d8a54'],portuguesa:['#c9b684','#9d8a54'],catatumbo:['#4f8a7a','#245c4e'],unare:['#7cc2a0','#3a9a76'],tuy:['#7cc2a0','#3a9a76']},rcl=RCL[r.k]||['#8fd2b4','#3a9f86'];rc.push({P:P,hw:4.6*r.w,dy:.5,col:()=>col(dl_?'#c9cf9a':rcl[0])},{P:P,hw:3.3*r.w,dy:.62,col:()=>col(dl_?'#8c9a5c':rcl[1])});});", s)
assert "r.p.map" in s, 'river patch failed'
# labels: hide overlapping labels in the country view (regions first, then landmarks)
s = s.replace("  TEXTOS.forEach(s=>{if(!s.visible)return;const k=cam.position.distanceTo(s.position)*.016*(s.userData.k||1);s.scale.set(k*5.33,k,1);});\n}",
"""  TEXTOS.forEach(s=>{if(!s.visible)return;const k=cam.position.distanceTo(s.position)*.016*(s.userData.k||1);s.scale.set(k*5.33,k,1);});
  if(v){const rects=[],pxu=innerHeight/(2*Math.tan(cam.fov*Math.PI/360));
    [ETQ_REG,ETQ_HITO].forEach(Lst=>Lst.forEach(e=>{const t=e.s;if(!t.visible)return;const sp=pantalla(t.position),d=cam.position.distanceTo(t.position),w=t.scale.x*pxu/d*.86,h=t.scale.y*pxu/d*.7;
      const r=[sp[0]-w/2,sp[1]-h/2,sp[0]+w/2,sp[1]+h/2];if(rects.some(q=>r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1]))t.visible=false;else rects.push(r);}));}
}""",1)
# tiles: Mario-Party style (darker side, white rim, light inner plate)
# roads: no raised crossings (all lanes stay level and equal)
s = s.replace("for(let q=0;q<e.sobre.length;q++){const d=Math.abs(s-e.sobre[q]);if(d<16){t+=7*(1-sstep(5,16,d));puente=1;}}","")
# tokens: Mario-Party scale (about one tile tall) so the characters stop being the size of the skyscrapers
s = s.replace("const baseG=new THREE.CylinderGeometry(5.8,6.4,1.8,18),sombraG=new THREE.CircleGeometry(9,16).rotateX(-Math.PI/2)", "const baseG=new THREE.CylinderGeometry(3.6,4,1.6,18),sombraG=new THREE.CircleGeometry(5.6,16).rotateX(-Math.PI/2)")
s = s.replace("const anilloG=new THREE.RingGeometry(9.6,12.4,32).rotateX(-Math.PI/2)", "const anilloG=new THREE.RingGeometry(5.8,7.6,32).rotateX(-Math.PI/2)")
s = s.replace("const flechaG=new THREE.ConeGeometry(3.4,7,4).rotateX(Math.PI);", "const flechaG=new THREE.ConeGeometry(2.2,4.4,4).rotateX(Math.PI);")
s = s.replace("const s=new THREE.Sprite(t.m);s.scale.set(t.w,t.h,1);s.center.set(.5,0);S.add(s);", "const s=new THREE.Sprite(t.m);s.scale.set(t.w*TOK,t.h*TOK,1);s.center.set(.5,0);S.add(s);")
s = s.replace("dx:[-8,0,8][i],dz:[5,8,5][i]", "dx:[-4.6,0,4.6][i],dz:[2.6,4.6,2.6][i]")
s = s.replace("j.s.scale.set(FICHAS[i].w*k,FICHAS[i].h*k,1);", "j.s.scale.set(FICHAS[i].w*k*TOK,FICHAS[i].h*k*TOK,1);")
s = s.replace("j.s.scale.y+7+Math.sin(s*4)*1.8", "j.s.scale.y+4+Math.sin(s*4)*1.2")
s = s.replace("j.s.scale.y+14,0)),.9)", "j.s.scale.y+9,0)),.9)")
# camera / labels
s = s.replace("const C3={yaw:0,pitch:1.18,dist:300,", "const C3={yaw:0,pitch:1.18,dist:450,").replace("pitchAct:1.18,distAct:300}", "pitchAct:1.18,distAct:450}")
s = s.replace("v?new THREE.Vector3(0,0,12)", "v?new THREE.Vector3(0,-40,CH*.115)")
s = s.replace("vy=960*Math.sin(1.3)+80*Math.cos(1.3),vx=1000", "vy=CH*Math.sin(.92)+260*Math.cos(.92),vx=CW").replace("v?1.3:C3.pitch","v?.92:C3.pitch").replace("vx/(2*t*cam.aspect))*1.03","vx/(2*t*cam.aspect))*1.14")
s = s.replace("clamp(C3.dist*(1+e.deltaY*.001),120,900)", "clamp(C3.dist*(1+e.deltaY*.001),120,2600)")
s = s.replace("new THREE.PerspectiveCamera(24,1,40,7000)", "new THREE.PerspectiveCamera(24,1,40,16000)")
s = cut(s, "const REG_TXT=", "let ETQ_ACT=null;", r'''const REG_TXT={ccs:'CARACAS',coc:'CENTRO-OCCIDENTE',zul:'ZULIA',and:'LOS ANDES',lla:'LOS LLANOS',gua:'GUAYANA',can:'CANAIMA',del:'DELTA DEL ORINOCO',moc:'MOCHIMA',mar:'MARGARITA',roq:'LOS ROQUES'};
const ctr=r=>{const L=IDS.filter(i=>NOD[i].r===r);return[L.reduce((a,i)=>a+POS[i].x,0)/L.length,L.reduce((a,i)=>a+POS[i].y,0)/L.length];};
const OFS={mar:[0,-70],moc:[30,85],coc:[-30,100],roq:[0,-40],ccs:[0,-14],lla:[0,40],and:[-14,56]};
const ETQ_REG=Object.keys(REG_TXT).map(r=>{const c0=ctr(r),o=OFS[r]||[0,0],c=[c0[0]+o[0],c0[1]+o[1]],p=W3(c[0],c[1]);return{s:etiqueta(REG_TXT[r],true),p:new THREE.Vector3(p.x,p.y+34,p.z)};});
const HITOS=[['Puente sobre el Lago',POS.zul_puente.x,POS.zul_puente.y],['Salto Ángel',2498,1204],['Teleférico de Mérida',POS.and_picoespejo.x,POS.and_picoespejo.y],['El Ávila',POS.ccs_galipan.x,POS.ccs_galipan.y],['Médanos de Coro',POS.coc_coro.x,POS.coc_coro.y],['Río Orinoco',GEO.rivers.orinoco[Math.floor(GEO.rivers.orinoco.length*.55)][0],GEO.rivers.orinoco[Math.floor(GEO.rivers.orinoco.length*.55)][1]]];
[['Puerto Ayacucho','puerto_ayacucho'],['Cerro Autana','autana_tepui'],['Roraima','roraima_tepui'],['Represa de Guri','represa_guri'],['Castillo de Pampatar','castillo_pampatar'],['Cueva del Guácharo','cueva_guacharo'],['SIDOR','sidor_puerto_ordaz'],['Puente Angostura','puente_angostura'],['Pico Bolívar','andes_merida']].forEach(d=>{const it=(PLC.props||[]).find(p=>p.glb===d[1]);if(it)HITOS.push([d[0],it.x,it.y]);});
const ETQ_HITO=HITOS.map(h=>{const p=W3(h[1],h[2]);return{s:etiqueta(h[0]),p:new THREE.Vector3(p.x,p.y+40,p.z)};});
''')
s = s.replace("(window.__telec||[]).forEach(f=>f(dt));", "(window.__telec||[]).forEach(f=>f(dt));(window.__anim||[]).forEach(f=>f(dt));if(window.__rutasEsp)window.__rutasEsp.visible=C3.vista;")
# 3D tokens, tile bounce / pop, option arrows
s = s.replace("window.__mapa3d={S:S,cam:cam,C3:C3,J:J,POS:POS};\n})();", r"""const TKG=[],PREV=J.map(()=>({p:new THREE.Vector3(),yaw:0,nodo:null}));
const FLECH=[0,1,2].map(()=>{const g=new THREE.Group(),a=new THREE.Mesh(new THREE.ConeGeometry(5.2,10,4).rotateX(Math.PI),new THREE.MeshBasicMaterial({color:0xffd23f})),b=new THREE.Mesh(new THREE.ConeGeometry(6.6,12.4,4).rotateX(Math.PI),new THREE.MeshBasicMaterial({color:0x14101c,side:THREE.BackSide}));g.add(b);g.add(a);g.visible=false;S.add(g);return g;});
window.__tkready=true;
(async()=>{const nd=await GLBLite.load(MD+'tokens.glb',{cache:'no-cache'}).catch(()=>null);if(!nd)return;
  ['token_tu','token_mama','token_abuela'].forEach((k,i)=>{if(!nd[k])return;const g=new THREE.Group(),m=new THREE.Mesh(nd[k].geo,MAT);g.add(m);S.add(g);TKG[i]=g;J[i].s.visible=false;});})();
function syncTk(dt,t){
  J.forEach((j,i)=>{const g=TKG[i];if(!g)return;const pv=PREV[i],act=i===activo,pos=j.s.position;
    const dx=pos.x-pv.p.x,dz=pos.z-pv.p.z,mv=Math.hypot(dx,dz);
    if(mv>.04){let ty=Math.atan2(dx,dz),d=ty-pv.yaw;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;pv.yaw+=d*Math.min(1,dt*12);}
    else{let d=0-pv.yaw;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;pv.yaw+=d*Math.min(1,dt*3);}
    pv.p.copy(pos);
    const bob=(mv<.04&&act)?Math.abs(Math.sin(t*4+i))*.9:0,sq=1+bob*.04;
    g.position.set(pos.x,pos.y+bob,pos.z);g.rotation.y=pv.yaw;const k=(act?1.08:.94)*1.35;g.scale.set(k/sq,k*sq,k/sq);
    if(pv.nodo!==j.nodo){pv.nodo=j.nodo;const G=window.__tileg[j.nodo];if(G)G.userData.pop=1;}});
  const op=opciones||[];
  Object.keys(window.__tileg).forEach(id=>{const G=window.__tileg[id],u=G.userData,on=op.indexOf(id)>=0;
    u.pop=(u.pop||0)*Math.pow(.02,dt);const pu=on?Math.abs(Math.sin(t*5)):0,po=Math.sin(u.pop*Math.PI)*1.4;
    G.position.y=u.y0+pu*2.4+po;const sc=1+(on?.06*Math.sin(t*5):0)+u.pop*.12;G.scale.set(sc,1+u.pop*.15,sc);});
  FLECH.forEach((m,k)=>{const id=op[k];if(!id){m.visible=false;return;}const p=W3p(id);m.visible=true;m.position.set(p.x,Math.max(p.y,SEA+.8)+27+Math.sin(t*5+k)*3,p.z);m.rotation.y=t*2.2;});
}
window.__mapa3d={S:S,cam:cam,C3:C3,J:J,POS:POS};
})();""")
s = s.replace("if(W2)W2.uniforms.t.value=performance.now()/1000;", "if(W2)W2.uniforms.t.value=performance.now()/1000;if(window.__tkready)syncTk(dt,s);")
s = s.replace("pasaCam(dt);etiquetas();R.render(S,cam);", "pasaCam(dt);if(window.__cull)window.__cull();etiquetas();R.render(S,cam);")
s = s.replace("window.__mapa3d={S:S,cam:cam,C3:C3,J:J,POS:POS};\n})();", "window.__mapa3d={S:S,cam:cam,C3:C3,J:J,POS:POS};\n})().catch(e=>{console.error(e);window.__err=String(e);});")

# tiles: darker side wall, white rim and a lighter inner plate (Mario Party board tile look)
_i = s.index("  IDS.forEach(id=>{\n    const n=NOD[id],p=W3p(id),y0=Math.max(p.y,SEA+.8);")
_j = s.index("  });\n})();", _i) + len("  });\n})();")
s = s[:_i] + r"""  window.__tileg={};
  const rimG=new THREE.RingGeometry(TILE_R-1.4,TILE_R+.15,30).rotateX(-Math.PI/2),plateG=new THREE.CircleGeometry(TILE_R-1.5,26).rotateX(-Math.PI/2);
  const rimM=new THREE.MeshLambertMaterial({color:0xffffff});
  IDS.forEach(id=>{
    const n=NOD[id],p=W3p(id),y0=Math.max(p.y,SEA+.8),c0=new THREE.Color(TIPO[n.t]||'#888888'),cd=c0.clone().multiplyScalar(.6),cl=c0.clone().lerp(new THREE.Color(0xffffff),.28);
    const sh=new THREE.Mesh(sg,sm);sh.position.set(p.x,y0+.35,p.z);S.add(sh);
    const b=new THREE.Mesh(bg,ARO[n.t]?new THREE.MeshLambertMaterial({color:ARO[n.t]}):bm);b.position.set(p.x,y0+.3,p.z);S.add(b);
    const G=new THREE.Group();G.position.set(p.x,y0,p.z);G.userData.y0=y0;S.add(G);window.__tileg[id]=G;
    const t=new THREE.Mesh(tg,[new THREE.MeshLambertMaterial({color:cd}),new THREE.MeshLambertMaterial({color:c0}),new THREE.MeshLambertMaterial({color:cd})]);t.position.set(0,1.2,0);G.add(t);
    t.userData.id=id;MALLAS[id]=t;
    const rim=new THREE.Mesh(rimG,rimM);rim.position.set(0,2.52,0);G.add(rim);
    const pl=new THREE.Mesh(plateG,new THREE.MeshLambertMaterial({color:cl}));pl.position.set(0,2.55,0);G.add(pl);
    if(!ICONOS[n.t])ICONOS[n.t]=icono(n.t);
    const ic=new THREE.Mesh(ig,ICONOS[n.t]);ic.position.set(0,2.62,0);G.add(ic);
    if(SALIDAS[id].length>1){const f=new THREE.Mesh(fg,oro);f.position.set(p.x,y0+.5,p.z);S.add(f);}      // bifurcación: aro dorado
  });
})();"""+ s[_j:]
s = s.replace("S.background=col('#1459b8')", "S.background=col('#a9cff0')").replace("background:#1459b8", "background:#a9cff0")
s = s.replace("<title>Mapa 3D · isla Blender</title>", "<title>Mapa 3D · Venezuela v2</title>")
s = s.replace("window.__S=S;window.__alt=altura;window.__POS=POS;let W2=null;const TEXTOS=[];const TR={round:[],flat:[],cone:[]};", "window.__S=S;window.__R=R;let W2=null;const TEXTOS=[];")
s = s.replace("function poner(t,x,y,k){if(t===TEX.arbol||t===TEX.palma){const q=W3(x,y);(t===TEX.palma?TR.flat:TR.round).push([q.x,q.y-.2,q.z,rnd()*6.28,(k||1)*1.15]);return null;}\n  ", "function poner(t,x,y,k){")

# ── free-roam camera: fly anywhere over the map (WASD / arrows, Q-E up-down, Shift fast, drag to look, wheel/pinch to move) ──
def _rep(old, new):
    global s
    assert old in s, old[:60]
    s = s.replace(old, new, 1)

_rep('<button class="sec" id="vista">🗺 País</button>', '<button class="sec" id="vista">🗺 País</button>\n  <button class="sec" id="libre">🧭 Libre</button>')
_rep("function pasaCam(dt){\n  const v=C3.vista;", "function pasaCam(dt){\n  if(C3.libre){libreFrame(dt);return;}\n  const v=C3.vista;")
_rep("if(!drag||C3.vista)return;", "if(!drag||C3.vista||C3.libre)return;")
_rep("function tocar(x,y){if(!opciones||!alElegir)return;", "function tocar(x,y){if(C3.libre||!opciones||!alElegir)return;")
_rep("cv.addEventListener('wheel',e=>{e.preventDefault();", "cv.addEventListener('wheel',e=>{e.preventDefault();if(C3.libre){libreWheel(e);return;}")
_rep("if(!v&&!opciones){const j=J[activo];", "if(!v&&!opciones&&!C3.libre){const j=J[activo];")
_rep("$('vista').onclick=()=>{C3.vista=!C3.vista;", "$('vista').onclick=()=>{if(C3.libre)libreSalir();C3.vista=!C3.vista;")
_rep("let drag=null,t0p=0;", r"""const LB={yaw:0,pitch:-.5,pos:new THREE.Vector3(),keys:{},ptr:new Map(),pinch:0,mid:null},INFO0=document.getElementById('info').textContent;
cam.rotation.order='YXZ';
function libreFwd(){const cp=Math.cos(LB.pitch);return new THREE.Vector3(-Math.sin(LB.yaw)*cp,Math.sin(LB.pitch),-Math.cos(LB.yaw)*cp);}
function libreRight(){return new THREE.Vector3(Math.cos(LB.yaw),0,-Math.sin(LB.yaw));}
function libreEntrar(){const d=new THREE.Vector3();cam.getWorldDirection(d);LB.yaw=Math.atan2(-d.x,-d.z);LB.pitch=Math.asin(clamp(d.y,-1,1));LB.pos.copy(cam.position);C3.libre=true;C3.vista=false;
  $('libre').textContent='🎯 Ficha';$('vista').textContent='🗺 País';$('info').textContent='Libre · Arrastra: mirar · WASD/flechas: volar · Q/E: bajar/subir · Shift: rápido · Rueda o pellizco: avanzar';}
function libreSalir(){C3.libre=false;LB.keys={};LB.ptr.clear();$('libre').textContent='🧭 Libre';$('info').textContent=INFO0;}
function libreFrame(dt){
  const k=LB.keys,sp=(110+LB.pos.y*1.1)*(k.shift?3.2:1)*Math.min(dt,.05),f=libreFwd(),r=libreRight();
  if(k.w||k.arrowup)LB.pos.addScaledVector(f,sp);if(k.s||k.arrowdown)LB.pos.addScaledVector(f,-sp);
  if(k.d||k.arrowright)LB.pos.addScaledVector(r,sp);if(k.a||k.arrowleft)LB.pos.addScaledVector(r,-sp);
  if(k.e)LB.pos.y+=sp;if(k.q)LB.pos.y-=sp;
  LB.pos.x=clamp(LB.pos.x,-CW*.62,CW*.62);LB.pos.z=clamp(LB.pos.z,-CH*.62,CH*.62);
  const gy=Math.max(altura(LB.pos.x+CW/2,LB.pos.z+CH/2),SEA)+5;LB.pos.y=clamp(LB.pos.y,gy,3800);
  cam.position.copy(LB.pos);cam.rotation.set(LB.pitch,LB.yaw,0);C3.pos.copy(LB.pos);
}
function libreWheel(e){LB.pos.addScaledVector(libreFwd(),-e.deltaY*(.5+LB.pos.y*.004));}
addEventListener('keydown',e=>{if(!C3.libre)return;const k=e.key.toLowerCase();if(k.length===1&&'wasdqe'.includes(k)||k.startsWith('arrow')||k==='shift'){LB.keys[k]=true;if(k!=='shift')e.preventDefault();}});
addEventListener('keyup',e=>{delete LB.keys[e.key.toLowerCase()];});
addEventListener('blur',()=>{LB.keys={};});
cv.addEventListener('pointerdown',e=>{if(!C3.libre)return;LB.ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});LB.pinch=0;LB.mid=null;});
cv.addEventListener('pointermove',e=>{if(!C3.libre||!LB.ptr.has(e.pointerId))return;const p=LB.ptr.get(e.pointerId),dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(LB.ptr.size===1){LB.yaw-=dx*.004;LB.pitch=clamp(LB.pitch-dy*.004,-1.5,1.5);}
  else if(LB.ptr.size===2){const [a,b]=[...LB.ptr.values()],d=Math.hypot(a.x-b.x,a.y-b.y),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if(LB.pinch)LB.pos.addScaledVector(libreFwd(),(d-LB.pinch)*(.8+LB.pos.y*.008));
    if(LB.mid){LB.pos.addScaledVector(libreRight(),-(m.x-LB.mid.x)*(.3+LB.pos.y*.003));LB.pos.y+=(m.y-LB.mid.y)*(.3+LB.pos.y*.003);}
    LB.pinch=d;LB.mid=m;}});
const _lbUp=e=>{LB.ptr.delete(e.pointerId);LB.pinch=0;LB.mid=null;};
cv.addEventListener('pointerup',_lbUp);cv.addEventListener('pointercancel',_lbUp);
document.getElementById('libre').onclick=()=>{if(C3.libre)libreSalir();else libreEntrar();};
let drag=null,t0p=0;""")

open(DST, 'w', encoding='utf-8').write(s)
print('written', DST, len(s))
