// LA FIESTA · CÁMARA del tablero (M1, doc 07 §7.2). UMD, sin DOM: pura y probada en Node (test/fiesta-camara.test.js).
// Local, nunca se sincroniza. Mundo 4000×3000 (= lienzo de diseño 1000×1000 del mapa escalado ×4 / ×3).
// Pantalla = unidades lógicas del motor (800×600 ampliado: GAME_VIEW); la vista es el rectángulo de pantalla donde se ve el tablero.
//
// API
//   const C = FIESTA.cam.crear({mundo:{w,h}, vista:{x,y,w,h}, zSeguir, zMax, tasa, volver, margen})
//   estado:   C.x, C.y (centro en el mundo), C.z (unidades de pantalla por unidad de mundo), C.modo 'seguir'|'libre'|'fijo',
//             C.forzado (momento forzado activo o null), C.pendiente (momento que llegó en 'fijo': mostrar «VER»), C.t (s)
//   vista:    C.vista(x,y,w,h)  C.zFit() (zoom de vista general)  C.zMin  C.zMax
//   mapeo:    C.aPantalla(wx,wy) → {x,y}   C.aMundo(sx,sy) → {x,y}   C.matriz() → [a,b,c,d,e,f]   C.aplicar(ctx) (ctx.transform)
//   culling:  C.rect(pad) → {x0,y0,x1,y1} mundo visible   C.ve(x,y,r)   C.veRect(x0,y0,x1,y1)
//   control:  C.seguir(x,y,z?)  C.forzar(x,y,z,seg) → bool  C.ver()  C.general(seg?)  C.fijar(on)  C.irA(x,y,z?)
//             C.saltar() (sin transición)  C.update(dt)
//   entrada:  C.bajar(id,sx,sy)  C.mover(id,sx,sy)  C.subir(id,sx,sy) → {tap:{x,y}}|null  C.rueda(dy,sx,sy)  C.cancelar()
//             C.arrastrando() → bool. Toque = <10 u de recorrido y <0,4 s. Arrastre/pellizco/rueda ⇒ 'libre' y a los
//             `volver` s (3) de soltar vuelve a 'seguir'. En 'fijo' (candado) la entrada no mueve la cámara (los toques sí salen).
//   minimapa: FIESTA.cam.mini(rect, mundo) → {s, x, y, w, h, aMini(wx,wy), aMundo(mx,my), dentro(mx,my)}
//   puras:    FIESTA.cam.limitar(x,y,z,vista,mundo,zMin,zMax,margen) → {x,y,z}   FIESTA.cam.suave(tasa,dt) → k
(function(root){
'use strict';
const F=root.FIESTA=root.FIESTA||{};

const DEF={mundo:{w:4000,h:3000},vista:{x:0,y:0,w:800,h:600},zSeguir:.7,zMax:1.6,tasa:8,volver:3,margen:0,
  tapDist:10,tapSeg:.4,inercia:6,
  adelanto:40,       // look-ahead (u de mundo, ≤ 80): la cámara se adelanta en la dirección del salto del objetivo (0 = apagado)
  generalAuto:3,     // general() sin duración vuelve a seguir solo a los 3 s
  sacudidaMax:8};    // tope de la sacudida cosmética (u de pantalla)

const cl=(v,a,b)=>v<a?a:v>b?b:v;
const suave=(tasa,dt)=>1-Math.exp(-tasa*Math.max(0,dt));
function fit(vista,mundo){return Math.min(vista.w/mundo.w,vista.h/mundo.h);}
// Centro y zoom válidos: zoom en [zMin,zMax]; si el mundo no llena la vista en un eje, se centra en ese eje.
function limitar(x,y,z,vista,mundo,zMin,zMax,margen){
  margen=margen||0;z=cl(z,zMin,zMax);
  const hw=vista.w/(2*z),hh=vista.h/(2*z),W=mundo.w,H=mundo.h;
  if(2*hw>=W+2*margen)x=W/2;else x=cl(x,hw-margen,W-hw+margen);
  if(2*hh>=H+2*margen)y=H/2;else y=cl(y,hh-margen,H-hh+margen);
  return{x:x,y:y,z:z};
}
function mini(rect,mundo){
  mundo=mundo||DEF.mundo;const s=Math.min(rect.w/mundo.w,rect.h/mundo.h),w=mundo.w*s,h=mundo.h*s,
    x=rect.x+(rect.w-w)/2,y=rect.y+(rect.h-h)/2;
  return{s:s,x:x,y:y,w:w,h:h,
    aMini:(wx,wy)=>({x:x+wx*s,y:y+wy*s}),
    aMundo:(mx,my)=>({x:cl((mx-x)/s,0,mundo.w),y:cl((my-y)/s,0,mundo.h)}),
    dentro:(mx,my)=>mx>=x&&mx<=x+w&&my>=y&&my<=y+h};
}

function crear(o){
  o=Object.assign({},DEF,o||{});
  const C={mundo:{w:o.mundo.w,h:o.mundo.h},v:{x:o.vista.x,y:o.vista.y,w:o.vista.w,h:o.vista.h},
    zSeguir:o.zSeguir,zMax:o.zMax,zMin:0,tasa:o.tasa,volver:o.volver,margen:o.margen,
    x:o.mundo.w/2,y:o.mundo.h/2,z:0,modo:'seguir',t:0,
    obj:null,        // punto que se sigue {x,y,z}
    glide:null,      // destino suave en 'libre' (irA)
    forzado:null,    // {x,y,z,hasta}
    pendiente:null,  // momento forzado que llegó en 'fijo'
    libreHasta:0,vel:{x:0,y:0},ptr:{},pinch:null,drag:false,
    sv:{x:0,y:0},    // velocidad del resorte críticamente amortiguado del centro (u de mundo / s)
    la:{x:0,y:0},ob0:null,   // look-ahead suavizado y objetivo del cuadro anterior
    sac:null,generalAuto:o.generalAuto};   // sacudida {amp,dur,t0}
  C.zMin=fit(C.v,C.mundo);C.z=C.zMin;

  const lim=(x,y,z)=>limitar(x,y,z,C.v,C.mundo,C.zMin,C.zMax,C.margen);
  function fijaActual(x,y,z){const p=lim(x,y,z);C.x=p.x;C.y=p.y;C.z=p.z;}

  C.vista=function(x,y,w,h){
    if(x===C.v.x&&y===C.v.y&&w===C.v.w&&h===C.v.h)return C;
    // conserva el punto central del mundo y la escala relativa a la vista general
    const r=C.z/C.zMin;C.v={x:x,y:y,w:w,h:h};C.zMin=fit(C.v,C.mundo);fijaActual(C.x,C.y,C.zMin*r);return C;};
  C.zFit=()=>C.zMin;

  /* ── mapeo ── */
  const ox=()=>C.v.x+C.v.w/2-C.x*C.z,oy=()=>C.v.y+C.v.h/2-C.y*C.z;
  C.aPantalla=(wx,wy)=>({x:wx*C.z+ox(),y:wy*C.z+oy()});
  C.aMundo=(sx,sy)=>({x:(sx-ox())/C.z,y:(sy-oy())/C.z});
  // Sacudida cosmética: SOLO desplaza matriz()/aplicar() (el mundo dibujado); aPantalla/aMundo/rect quedan estables. Con amp 0 es 0 exacto.
  C.sacudir=function(amp,seg){amp=Math.min(Math.max(0,+amp||0),o.sacudidaMax);
    if(!(amp>0)){C.sac=null;return C;}
    C.sac={amp:amp,dur:Math.max(.05,seg===undefined?.35:+seg||.35),t0:C.t};return C;};
  C.sacudida=function(){const s=C.sac;if(!s)return{x:0,y:0};const k=(C.t-s.t0)/s.dur;if(k>=1||k<0){C.sac=null;return{x:0,y:0};}
    const a=s.amp*(1-k)*(1-k);return{x:Math.sin(C.t*61)*a,y:Math.cos(C.t*47)*a};};
  C.matriz=function(){const q=C.sac?C.sacudida():null;return[C.z,0,0,C.z,ox()+(q?q.x:0),oy()+(q?q.y:0)];};
  C.aplicar=function(ctx){const m=C.matriz();ctx.transform(m[0],m[1],m[2],m[3],m[4],m[5]);return ctx;};
  C.rect=function(pad){pad=pad||0;const a=C.aMundo(C.v.x,C.v.y),b=C.aMundo(C.v.x+C.v.w,C.v.y+C.v.h);
    return{x0:a.x-pad,y0:a.y-pad,x1:b.x+pad,y1:b.y+pad};};
  C.veRect=function(x0,y0,x1,y1){const r=C.rect(0);return x1>=r.x0&&x0<=r.x1&&y1>=r.y0&&y0<=r.y1;};
  C.ve=(x,y,r)=>C.veRect(x-(r||0),y-(r||0),x+(r||0),y+(r||0));

  /* ── control ── */
  C.seguir=function(x,y,z){C.obj={x:x,y:y,z:z===undefined?(C.obj?C.obj.z:C.zSeguir):z};return C;};
  C.forzar=function(x,y,z,seg){
    const f={x:x,y:y,z:z===undefined||z===null?C.zSeguir:z,dur:seg===undefined?2:seg};
    if(C.modo==='fijo'){C.pendiente=f;return false;}
    f.hasta=C.t+f.dur;C.forzado=f;C.pendiente=null;return true;};
  C.ver=function(){if(!C.pendiente)return false;const f=C.pendiente;C.pendiente=null;f.hasta=C.t+f.dur;C.forzado=f;return true;};
  // Mapa completo: zoom mínimo, centrado; vuelve solo a `seg` s (por defecto C.generalAuto = 3). seg=Infinity se queda hasta soltarForzado().
  C.general=function(seg){C.forzado={x:C.mundo.w/2,y:C.mundo.h/2,z:C.zMin,hasta:C.t+(seg===undefined?C.generalAuto:seg)};C.pendiente=null;return C;};
  C.soltarForzado=function(){C.forzado=null;return C;};
  C.fijar=function(on){
    if(on){C.modo='fijo';C.glide=null;C.forzado=null;C.vel.x=C.vel.y=0;}   // el candado congela ya, incluso un momento en curso
    else if(C.modo==='fijo'){C.modo='seguir';C.pendiente=null;}
    return C;};
  C.irA=function(x,y,z){if(C.modo==='fijo')return C;C.modo='libre';C.forzado=null;
    C.glide={x:x,y:y,z:z===undefined?C.z:z};C.libreHasta=C.t+C.volver+1;return C;};
  C.saltar=function(){const g=destino();if(g)fijaActual(g.x,g.y,g.z);return C;};

  function destino(){
    if(C.forzado)return C.forzado;
    if(C.modo==='libre')return C.glide;
    if(C.modo==='seguir')return C.obj;
    return null;                                    // fijo: se queda donde está
  }
  C.update=function(dt){
    dt=Math.max(0,dt||0);C.t+=dt;
    if(C.forzado&&C.t>=C.forzado.hasta)C.forzado=null;
    const libre=C.modo==='libre',suelta=!Object.keys(C.ptr).length;
    if(libre&&suelta&&!C.forzado&&C.t>=C.libreHasta){C.modo='seguir';C.glide=null;}
    if(C.modo==='libre'&&suelta&&!C.forzado&&(C.vel.x||C.vel.y)){   // inercia del arrastre
      fijaActual(C.x+C.vel.x*dt,C.y+C.vel.y*dt,C.z);
      const d=Math.exp(-o.inercia*dt);C.vel.x*=d;C.vel.y*=d;
      if(Math.abs(C.vel.x)+Math.abs(C.vel.y)<5)C.vel.x=C.vel.y=0;}
    let g=destino();
    if(g&&g===C.obj&&o.adelanto>0&&dt>0)g=conAdelanto(g,dt);else if(g!==C.obj){C.ob0=null;C.la.x=C.la.y=0;}
    if(g&&g===C.obj||g===adel)g=conBanda(g);
    if(g&&!(C.modo==='libre'&&!suelta&&!C.forzado)){
      // zoom: exponencial en log z (monótono, sin sobreimpulso). Centro: resorte críticamente amortiguado (integración exacta: no depende del paso)
      const k=suave(C.tasa,dt),gz=lim(g.x,g.y,g.z).z,z=Math.exp(Math.log(C.z)+(Math.log(gz)-Math.log(C.z))*k);
      const p=lim(g.x,g.y,z);
      amortigua('x',p.x,dt);amortigua('y',p.y,dt);fijaActual(C.x,C.y,z);
      if(C.glide&&C.modo==='libre'&&Math.abs(C.x-p.x)<.5&&Math.abs(C.y-p.y)<.5&&Math.abs(C.z-gz)<1e-4)C.glide=null;
    }else{C.sv.x=C.sv.y=0;fijaActual(C.x,C.y,C.z);}
    return C;};
  function amortigua(e,tg,dt){const w=C.tasa,d=C[e]-tg,v=C.sv[e],a=v+w*d,ex=Math.exp(-w*dt);
    C[e]=tg+(d+a*dt)*ex;C.sv[e]=(v-a*w*dt)*ex;if(Math.abs(C[e]-tg)<.01&&Math.abs(C.sv[e])<.05){C[e]=tg;C.sv[e]=0;}}
  // Franja libre: si la UI declara (F.cam.reserva() -> {y0,y1} en pantalla) que un panel tapa la parte baja, la ficha seguida se centra en la franja que
  // queda entre el HUD y el panel, en vez de en el centro de la vista (tope: ±25 % del alto). Sin franja o fuera de 'seguir' no hace nada.
  const bnd={x:0,y:0,z:0};
  function conBanda(g){
    const fn=F.cam&&F.cam.reserva,b=C.modo==='seguir'&&!C.forzado&&typeof fn==='function'?fn():null;
    if(!b||!(b.y1>b.y0))return g;
    const lim0=C.v.h*.25,dy=cl((b.y0+b.y1)/2-(C.v.y+C.v.h/2),-lim0,lim0),z=lim(g.x,g.y,g.z).z;
    bnd.x=g.x;bnd.y=g.y-dy/z;bnd.z=g.z;return bnd;}
  // Look-ahead: se adelanta hasta `adelanto` u en la dirección en que se mueve el objetivo (suavizado, vuelve a 0 al detenerse).
  const adel={x:0,y:0,z:0};
  function conAdelanto(g,dt){
    const m=Math.min(80,o.adelanto),ob=C.ob0;let vx=0,vy=0;
    if(ob){vx=(g.x-ob.x)/dt;vy=(g.y-ob.y)/dt;}
    C.ob0=C.ob0||{x:0,y:0};C.ob0.x=g.x;C.ob0.y=g.y;
    const sp=Math.hypot(vx,vy),f=sp>1e-6?Math.min(1,sp*.15/m):0,tx=sp>1e-6?vx/sp*m*f:0,ty=sp>1e-6?vy/sp*m*f:0,k=suave(3,dt);
    C.la.x+=(tx-C.la.x)*k;C.la.y+=(ty-C.la.y)*k;adel.x=g.x+C.la.x;adel.y=g.y+C.la.y;adel.z=g.z;return adel;}

  /* ── entrada (coordenadas de pantalla lógicas: canvasPoint) ── */
  function aLibre(){if(C.modo==='fijo')return false;C.modo='libre';C.glide=null;C.forzado=null;return true;}
  function arrancaPinch(){const ids=Object.keys(C.ptr).slice(0,2),a=C.ptr[ids[0]],b=C.ptr[ids[1]];
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,w=C.aMundo(mx,my);
    C.pinch={ids:ids,d0:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),z0:C.z,wx:w.x,wy:w.y};}
  C.bajar=function(id,sx,sy){
    C.ptr[id]={x:sx,y:sy,x0:sx,y0:sy,ax:sx,ay:sy,t0:C.t,lx:sx,ly:sy,lt:C.t,mov:0};
    const n=Object.keys(C.ptr).length;C.vel.x=C.vel.y=0;
    if(n>=2){C.drag=true;Object.keys(C.ptr).forEach(k=>{C.ptr[k].mov=1e9;});if(C.modo!=='fijo')arrancaPinch();}
    return C;};
  C.mover=function(id,sx,sy){
    const p=C.ptr[id];if(!p)return C;
    p.x=sx;p.y=sy;p.mov=Math.max(p.mov,Math.hypot(sx-p.x0,sy-p.y0));
    if(C.pinch&&C.pinch.ids.indexOf(String(id))>=0){
      const a=C.ptr[C.pinch.ids[0]],b=C.ptr[C.pinch.ids[1]];if(!a||!b)return C;
      if(!aLibre())return C;
      const d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      const z=cl(C.pinch.z0*d/C.pinch.d0,C.zMin,C.zMax);
      // el punto del mundo que estaba bajo el centro del pellizco se queda bajo los dedos
      fijaActual(C.pinch.wx-(mx-C.v.x-C.v.w/2)/z,C.pinch.wy-(my-C.v.y-C.v.h/2)/z,z);
      C.libreHasta=C.t+C.volver;return C;}
    if(Object.keys(C.ptr).length===1&&p.mov>=o.tapDist){
      if(!C.drag){C.drag=true;}
      if(!aLibre())return C;
      fijaActual(C.x-(sx-p.ax)/C.z,C.y-(sy-p.ay)/C.z,C.z);p.ax=sx;p.ay=sy;
      const ddt=C.t-p.lt;
      if(ddt>1e-4){const a=Math.min(1,ddt*20);C.vel.x=C.vel.x*(1-a)+(-(sx-p.lx)/C.z/ddt)*a;C.vel.y=C.vel.y*(1-a)+(-(sy-p.ly)/C.z/ddt)*a;
        p.lx=sx;p.ly=sy;p.lt=C.t;}
      C.libreHasta=C.t+C.volver;}
    return C;};
  C.subir=function(id,sx,sy){
    const p=C.ptr[id];if(!p)return null;
    if(sx!==undefined)C.mover(id,sx,sy);
    delete C.ptr[id];
    const quedan=Object.keys(C.ptr).length;
    let r=null;
    if(!quedan){
      if(!C.drag&&p.mov<o.tapDist&&C.t-p.t0<=o.tapSeg)r={tap:{x:p.x,y:p.y}};
      if(C.drag&&C.modo==='libre')C.libreHasta=C.t+C.volver;
      if(C.t-p.lt>.12)C.vel.x=C.vel.y=0;            // soltó quieto: sin inercia
      C.drag=false;C.pinch=null;}
    else if(C.pinch){C.pinch=null;const k=Object.keys(C.ptr)[0];const q=C.ptr[k];q.lx=q.ax=q.x;q.ly=q.ay=q.y;q.lt=C.t;C.vel.x=C.vel.y=0;}
    return r;};
  C.cancelar=function(){C.ptr={};C.pinch=null;C.drag=false;C.vel.x=C.vel.y=0;return C;};
  C.arrastrando=()=>C.drag;
  C.rueda=function(dy,sx,sy){
    if(!aLibre())return C;
    const w=C.aMundo(sx,sy),z=cl(C.z*Math.exp(-dy*.0015),C.zMin,C.zMax);
    fijaActual(w.x-(sx-C.v.x-C.v.w/2)/z,w.y-(sy-C.v.y-C.v.h/2)/z,z);
    C.libreHasta=C.t+C.volver;return C;};
  C.zoomEn=function(f,sx,sy){return C.rueda(-Math.log(f)/.0015,sx,sy);};
  return C;
}

F.cam={crear:crear,limitar:limitar,mini:mini,suave:suave,fit:fit,DEF:DEF};
if(typeof module!=='undefined')module.exports=F.cam;
})(typeof window!=='undefined'?window:globalThis);
