// LA FIESTA · cámara del tablero (fiesta-camara.js) y geometría pura del tablero (fiesta-tablero.js). node --test
const test=require('node:test'),assert=require('node:assert');
const CAM=require('../docs/style-lab/fiesta-camara.js');
const TAB=require('../docs/style-lab/fiesta-tablero.js');
const M=require('../docs/style-lab/fiesta-mapa-venezuela.js');
const near=(a,b,e,m)=>assert.ok(Math.abs(a-b)<=(e===undefined?1e-6:e),(m||'')+' '+a+' ≉ '+b);
const run=(C,seg,dt)=>{dt=dt||1/60;for(let t=0;t<seg;t+=dt)C.update(dt);return C;};

test('arranca en vista general centrada (800×600 → z 0,2)',()=>{
  const C=CAM.crear();near(C.zMin,.2);near(C.z,.2);near(C.x,2000);near(C.y,1500);
  const r=C.rect();near(r.x0,0);near(r.y0,0);near(r.x1,4000);near(r.y1,3000);});

test('aPantalla y aMundo son inversas y coinciden con matriz()',()=>{
  const C=CAM.crear({vista:{x:-150,y:0,w:1100,h:600}});C.seguir(1234,876,.9);C.saltar();
  for(const [x,y] of [[0,0],[1234,876],[3999,2999],[500,2500]]){
    const s=C.aPantalla(x,y),w=C.aMundo(s.x,s.y);near(w.x,x,1e-9);near(w.y,y,1e-9);
    const m=C.matriz();near(m[0]*x+m[4],s.x,1e-9);near(m[3]*y+m[5],s.y,1e-9);}
  const c=C.aPantalla(C.x,C.y);near(c.x,-150+550);near(c.y,300);});

test('limitar: la vista no se sale del mundo y centra el eje que sobra',()=>{
  const v={x:0,y:0,w:800,h:600},m={w:4000,h:3000};
  let p=CAM.limitar(-500,-500,1,v,m,.2,1.6);near(p.x,400);near(p.y,300);
  p=CAM.limitar(9999,9999,1,v,m,.2,1.6);near(p.x,3600);near(p.y,2700);
  p=CAM.limitar(100,100,.01,v,m,.2,1.6);near(p.z,.2);near(p.x,2000);near(p.y,1500);
  p=CAM.limitar(0,0,99,v,m,.2,1.6);near(p.z,1.6);
  // vista ancha (teléfono acostado): con z mínimo el mundo no llena el ancho → x centrado
  const w={x:-250,y:0,w:1300,h:600};near(CAM.fit(w,m),.2);p=CAM.limitar(100,1500,.2,w,m,.2,1.6);near(p.x,2000);
  // con margen se puede asomar un poco al mar
  p=CAM.limitar(-500,1500,1,v,m,.2,1.6,100);near(p.x,300);});

test('culling: ve() y veRect() con el rectángulo visible',()=>{
  const C=CAM.crear();C.seguir(1000,1000,1);C.saltar();
  const r=C.rect();near(r.x0,600);near(r.x1,1400);near(r.y0,700);near(r.y1,1300);
  assert.ok(C.ve(1000,1000,0));assert.ok(C.ve(590,1000,20));assert.ok(!C.ve(560,1000,20));
  assert.ok(C.veRect(1390,1290,2000,2000));assert.ok(!C.veRect(1401,0,2000,2000));
  const p=C.rect(50);near(p.x0,550);near(p.y1,1350);});

test('seguir: resorte críticamente amortiguado (tasa 8), independiente del paso; el zoom es exponencial',()=>{
  const A=CAM.crear({adelanto:0}),B=CAM.crear({adelanto:0});A.seguir(2400,1600,.7);B.seguir(2400,1600,.7);
  // desde z=.2 el centro está limitado; primero llegamos al zoom y luego comparamos el tramo libre
  run(A,3);run(B,3);near(A.z,.7,1e-4);near(A.x,2400,.01);near(A.y,1600,.01);
  A.seguir(2800,1700);B.seguir(2800,1700);
  A.update(.1);B.update(.05);B.update(.05);
  near(A.x,B.x,1e-6);near(A.y,B.y,1e-6);
  const w=8,tt=.1;near(A.x,2800-400*(1+w*tt)*Math.exp(-w*tt),1e-3,'x (críticamente amortiguado, sin sobreimpulso)');
  A.seguir(2800,1700,1.2);run(A,3);near(A.z,1.2,1e-4);});

test('momento forzado: le gana a seguir y a libre; en fijo queda pendiente hasta VER',()=>{
  const C=CAM.crear();C.seguir(1000,1000,.8);run(C,3);
  assert.ok(C.forzar(3000,2000,1,1.6));run(C,1);near(C.x,3000,15);near(C.y,2000,15);
  run(C,1);assert.strictEqual(C.forzado,null);run(C,3);near(C.x,1000,1);
  // libre: arrastrar y luego forzar
  C.bajar(1,400,300);C.mover(1,300,300);C.subir(1);assert.strictEqual(C.modo,'libre');
  assert.ok(C.forzar(3000,2000,1,1));run(C,.9);near(C.x,3000,30);
  // fijo
  C.fijar(true);const x=C.x,y=C.y;assert.strictEqual(C.forzar(500,500,1,1),false);assert.ok(C.pendiente);
  run(C,2);near(C.x,x);near(C.y,y);
  assert.ok(C.ver());assert.strictEqual(C.pendiente,null);run(C,.9);near(C.x,500,30);
  assert.strictEqual(C.ver(),false);});

test('vista general y fijo: general() lleva a zMin; fijo ignora seguir',()=>{
  const C=CAM.crear();C.seguir(1000,1000,1);run(C,3);C.general(1);run(C,.95);near(C.z,.2,.01);
  run(C,3);near(C.z,1,.001);
  C.fijar(true);C.seguir(3000,2500,1);run(C,2);near(C.x,1000,1);C.fijar(false);assert.strictEqual(C.modo,'seguir');
  run(C,3);near(C.x,3000,1);});

test('arrastre: el punto bajo el dedo se queda bajo el dedo; pasa a libre y vuelve a seguir a los 3 s',()=>{
  const C=CAM.crear();C.seguir(2000,1500,1);run(C,3);
  const w0=C.aMundo(400,300);
  C.bajar(7,400,300);C.mover(7,405,300);near(C.x,2000,1e-9,'bajo el umbral no mueve');
  C.mover(7,350,260);C.update(1/60);C.mover(7,300,240);
  const w1=C.aMundo(300,240);near(w1.x,w0.x,1e-6);near(w1.y,w0.y,1e-6);
  assert.strictEqual(C.modo,'libre');assert.ok(C.arrastrando());
  C.update(.5);const x=C.x;assert.strictEqual(C.subir(7),null,'un arrastre no es toque');
  run(C,2.5);assert.strictEqual(C.modo,'libre');near(C.x,x,1e-6,'quieto al soltar: sin inercia');
  run(C,.6);assert.strictEqual(C.modo,'seguir');run(C,3);near(C.x,2000,1);});

test('inercia: un lanzamiento sigue un poco y se detiene',()=>{
  const C=CAM.crear();C.seguir(2000,1500,1);run(C,3);
  C.bajar(1,600,300);let x=600;for(let i=0;i<6;i++){x-=30;C.mover(1,x,300);C.update(1/60);}
  const x0=C.x;C.subir(1);run(C,.2);assert.ok(C.x>x0+5,'siguió moviéndose '+(C.x-x0));
  const x1=C.x;run(C,1.5);const x2=C.x;run(C,.5);near(C.x,x2,.5,'se detuvo');assert.ok(x2>=x1);});

test('toque: corto y quieto devuelve tap con coordenadas de pantalla; en fijo también',()=>{
  const C=CAM.crear();C.bajar(1,100,200);C.mover(1,104,203);const r=C.subir(1,104,203);
  assert.deepStrictEqual(r,{tap:{x:104,y:203}});assert.strictEqual(C.modo,'seguir');
  C.bajar(2,100,200);run(C,.6);assert.strictEqual(C.subir(2),null,'toque largo no es tap');
  C.fijar(true);C.bajar(3,10,10);assert.ok(C.subir(3).tap);
  const x=C.x;C.bajar(4,400,300);C.mover(4,200,100);C.subir(4);near(C.x,x,1e-9,'fijo: no se arrastra');});

test('pellizco: escala por la razón de distancias y el punto medio queda fijo',()=>{
  const C=CAM.crear();C.seguir(2000,1500,.5);run(C,4);
  const w=C.aMundo(400,300);
  C.bajar('a',300,300);C.bajar('b',500,300);C.mover('a',250,300);C.mover('b',550,300);
  near(C.z,.75,1e-9);const w2=C.aMundo(400,300);near(w2.x,w.x,1e-6);near(w2.y,w.y,1e-6);
  // pellizco desplazado: el punto del mundo sigue al punto medio
  C.mover('a',150,350);C.mover('b',450,350);const w3=C.aMundo(300,350);near(w3.x,w.x,1e-6);near(w3.y,w.y,1e-6);
  assert.strictEqual(C.subir('a'),null);assert.strictEqual(C.subir('b'),null);assert.strictEqual(C.modo,'libre');
  C.bajar('a',0,0);C.bajar('b',10,0);C.mover('b',2000,0);near(C.z,C.zMax,1e-9,'tope zMax');});

test('rueda: zoom anclado al cursor y acotado',()=>{
  const C=CAM.crear();C.seguir(2000,1500,.6);run(C,4);
  const w=C.aMundo(200,150);C.rueda(-200,200,150);assert.ok(C.z>.6);
  const w2=C.aMundo(200,150);near(w2.x,w.x,1e-6);near(w2.y,w.y,1e-6);
  for(let i=0;i<50;i++)C.rueda(500,200,150);near(C.z,C.zMin);
  C.zoomEn(2,400,300);near(C.z,.4,1e-9);});

test('vista(): cambiar el tamaño conserva centro y zoom relativo',()=>{
  const C=CAM.crear();C.seguir(2000,1500,.6);run(C,4);const r=C.z/C.zMin;
  C.vista(-200,0,1200,600);near(C.zMin,.2);near(C.z/C.zMin,r,1e-9);near(C.x,2000,1e-6);
  C.vista(0,0,800,1000);near(C.zMin,.2);});

test('minimapa: mapeo ida y vuelta con letterbox',()=>{
  const m=CAM.mini({x:10,y:20,w:120,h:120});near(m.s,.03);near(m.w,120);near(m.h,90);near(m.y,35);
  const p=m.aMini(1000,2000),q=m.aMundo(p.x,p.y);near(q.x,1000,1e-9);near(q.y,2000,1e-9);
  assert.ok(m.dentro(70,80));assert.ok(!m.dentro(70,25));});

/* ── tablero: geometría pura ── */
const T=TAB.crear({mapa:M}),ids=Object.keys(M.nodos);

test('tablero: 114 nodos escalados ×4/×3 y una arista por par conectado',()=>{
  assert.strictEqual(Object.keys(T.nodos).length,114);
  for(const i of ids){near(T.pos(i).x,M.nodos[i].x*4);near(T.pos(i).y,M.nodos[i].y*3);}
  const pares=new Set();for(const a of ids)for(const b of M.ady[a])pares.add([a,b].sort().join('|'));
  assert.strictEqual(T.aristas.length,pares.size);
  for(const e of T.aristas){assert.ok(e.ida||e.vuelta);assert.ok(e.pts.length>=2);}
  const av=T.aristas.find(e=>e.modo==='avion');assert.ok(av.pts.length>2,'las rutas aéreas se curvan');
  for(const r of M.rutas){const c=T.camino(r.de,r.a);near(c[0].x,T.pos(r.de).x);near(c[c.length-1].y,T.pos(r.a).y);}});

test('tablero: silueta del borrador: las casillas caen en tierra y el mar no',()=>{
  const fuera=ids.filter(i=>!TAB.enTierra(T.pos(i).x,T.pos(i).y));
  assert.ok(fuera.length<=6,'casillas en el agua: '+fuera.join());
  assert.deepStrictEqual(T.costa,fuera,'las casillas fuera de la silueta llevan su lengua de tierra');
  assert.ok(!TAB.enTierra(40,40));assert.ok(!TAB.enTierra(140*4,260*3),'Lago de Maracaibo es agua');assert.ok(TAB.enTierra(2000,1200));});

test('apilar y arco: offsets distintos por ficha; arco sale, sube y llega',()=>{
  for(let n=1;n<=4;n++){const s=new Set();for(let i=0;i<n;i++){const d=TAB.apilar(n,i);s.add(d.dx+','+d.dy);assert.ok(Math.hypot(d.dx,d.dy)<=75);}
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=TAB.apilar(n,i),b=TAB.apilar(n,j);assert.ok(Math.hypot(a.dx-b.dx,a.dy-b.dy)>=44,'abanico: ≥44 u entre centros (n='+n+')');}
    assert.strictEqual(s.size,n);}
  const a={x:0,y:100},b={x:100,y:100};
  assert.deepStrictEqual(TAB.arco(a,b,0,50),a);const m=TAB.arco(a,b,.5,50);near(m.x,50);near(m.y,50);
  const e=TAB.arco(a,b,1,50);near(e.x,100);near(e.y,100);});

function D0(){return{f:'turno',pj:{a:{ch:'mama',nodo:'ccs_start',name:'Ana',cpu:null},b:{ch:'tio',nodo:'ccs_start',name:'Beto',cpu:'auto'},
  c:{ch:'pana',nodo:'ccs_sabana',name:'Cris',cpu:null}},t:{s:'a',paso:'decide'},esp:null,estrella:{nodo:'ccs_galipan',precio:20},tab:{}};}

test('nodoEn: cada casilla se toca en su centro; el mar no',()=>{
  const C=CAM.crear();for(const i of ids.slice(0,40)){C.seguir(T.pos(i).x,T.pos(i).y,1.2);C.saltar();
    const s=C.aPantalla(T.pos(i).x,T.pos(i).y);assert.strictEqual(T.nodoEn(s.x,s.y,C),i);}
  C.seguir(200,2900,1);C.saltar();const s=C.aPantalla(200,2900);assert.strictEqual(T.nodoEn(s.x,s.y,C),null);
  // vista general: tolerancia en pantalla
  const G=CAM.crear(),p=G.aPantalla(T.pos('ccs_start').x+40,T.pos('ccs_start').y);assert.strictEqual(T.nodoEn(p.x,p.y,G),'ccs_start');});

test('fichas: apiladas si comparten casilla; fichaEn y ancla',()=>{
  const C=CAM.crear(),D=D0();C.seguir(T.pos('ccs_start').x,T.pos('ccs_start').y,1);C.saltar();
  const a=T.posFicha('a',D),b=T.posFicha('b',D),c=T.posFicha('c',D);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>30,'a y b separadas');near(c.x,T.pos('ccs_sabana').x);
  const sa=C.aPantalla(a.x,a.y-30);assert.strictEqual(T.fichaEn(sa.x,sa.y,C,D),'a');
  const an=T.ancla('a',C,D);assert.ok(an.ve);assert.ok(an.y<C.aPantalla(a.x,a.y).y);
  const nn=T.ancla('ccs_galipan',C,D);assert.ok(nn&&typeof nn.x==='number');assert.strictEqual(T.ancla('nada',C,D),null);
  const f=T.foco(D);near(f.x,a.x);});

test('rutaEn: toca la casilla destino o la flecha de una opción válida',()=>{
  const de=ids.find(i=>M.ady[i].length>=2),[x,y]=M.ady[de];
  const D=D0();D.pj.a.nodo=de;D.esp={id:9,s:'a',k:'RUTA',opc:[{a:x,modo:'camino',ok:true},{a:y,modo:'camino',ok:false,req:'llave'}]};
  const C=CAM.crear();C.seguir(T.pos(de).x,T.pos(de).y,1);C.saltar();
  const R=T.rutas(D);assert.strictEqual(R.de,de);assert.strictEqual(R.opc.length,2);
  let s=C.aPantalla(T.pos(x).x,T.pos(x).y);assert.strictEqual(T.rutaEn(s.x,s.y,C,D),x);
  s=C.aPantalla(R.opc[0].flecha.x,R.opc[0].flecha.y);assert.strictEqual(T.rutaEn(s.x,s.y,C,D),x);
  s=C.aPantalla(T.pos(y).x,T.pos(y).y);assert.notStrictEqual(T.rutaEn(s.x,s.y,C,D),y,'opción cerrada no se toca');
  D.esp.k='DADO';assert.strictEqual(T.rutas(D),null);});

/* ── pulido: cámara (sacudida, look-ahead, general, zoom) ── */
test('sacudir(0) es identidad exacta; la sacudida solo toca matriz(), no aPantalla/aMundo, y decae a 0',()=>{
  const C=CAM.crear();C.seguir(1500,1200,.9);run(C,3);const m0=C.matriz(),p0=C.aPantalla(1500,1200);
  C.sacudir(0);assert.deepStrictEqual(C.matriz(),m0);
  C.sacudir(99,.5);assert.strictEqual(C.sac.amp,8,'tope de 8 u de pantalla');
  C.update(.1);const m1=C.matriz();assert.ok(m1[4]!==m0[4]||m1[5]!==m0[5]);assert.ok(Math.hypot(m1[4]-m0[4],m1[5]-m0[5])<=8*Math.SQRT2+1e-9);
  assert.deepStrictEqual(C.aPantalla(1500,1200),p0,'aPantalla estable');
  run(C,.6);C.matriz().forEach((v,i)=>near(v,m0[i],1e-6));assert.strictEqual(C.sac,null);});

test('look-ahead: 40 u por defecto (anticipa el salto); con 0 apagado; con adelanto se adelanta ≤ 80 u y vuelve al parar',()=>{
  assert.strictEqual(CAM.DEF.adelanto,40);
  const A=CAM.crear({adelanto:0}),B=CAM.crear({adelanto:500});
  for(const C of [A,B]){C.seguir(1000,1500,.9);run(C,3);}
  let x=1000;for(let i=0;i<60;i++){x+=10;A.seguir(x,1500);B.seguir(x,1500);A.update(1/60);B.update(1/60);}
  assert.ok(B.x>A.x+5,'adelanta en la dirección de movimiento');assert.ok(B.x-A.x<=80+1e-6,'tope de 80 u: '+(B.x-A.x));
  for(let i=0;i<300;i++){A.seguir(x,1500);B.seguir(x,1500);A.update(1/60);B.update(1/60);}
  near(B.x,A.x,.5,'al detenerse vuelve');});

test('general(): sin duración vuelve a los generalAuto s (3); con Infinity se queda; zoom monótono sin sobreimpulso',()=>{
  const C=CAM.crear();C.seguir(1000,1000,1);run(C,3);near(C.z,1,1e-3);
  C.general();assert.strictEqual(C.forzado.hasta,C.t+3);
  let prev=C.z;for(let t=0;t<2.9;t+=1/60){C.update(1/60);assert.ok(C.z<=prev+1e-12,'baja sin rebotar');assert.ok(C.z>=C.zMin-1e-12);prev=C.z;}
  near(C.z,C.zMin,.01);run(C,.3);assert.strictEqual(C.forzado,null);prev=C.z;
  for(let t=0;t<3;t+=1/60){C.update(1/60);assert.ok(C.z>=prev-1e-12,'sube sin sobreimpulso');assert.ok(C.z<=1+1e-9);prev=C.z;}
  C.general(Infinity);run(C,30);assert.ok(C.forzado);near(C.z,C.zMin,1e-3);});

test('centro: el resorte crítico no se pasa del objetivo (sin sobreimpulso)',()=>{
  const C=CAM.crear({adelanto:0});C.seguir(1000,1000,.8);run(C,4);C.seguir(2500,1000);let mx=-1;
  for(let t=0;t<4;t+=1/60){C.update(1/60);mx=Math.max(mx,C.x);}
  assert.ok(mx<=2500+1e-6,'x máx '+mx);near(C.x,2500,.5);});

/* ── pulido: tablero (leyenda, etiquetas, formas) ── */
test('LEYENDA cubre todos los TIPOS con nombre en español y cada tipo tiene forma y glifo',()=>{
  assert.deepStrictEqual(TAB.LEYENDA.map(l=>l.t),Object.keys(TAB.TIPOS));
  for(const l of TAB.LEYENDA){assert.ok(l.n&&l.n!==l.t||l.t==='salida'||l.t==='banco'||l.t==='evento'||l.t==='especial'||l.t==='duelo'||l.t==='alcabala'||l.t==='villano'||l.t==='delta'||l.t==='transporte','nombre '+l.t);
    assert.ok('oqdhk'.indexOf(TAB.TIPOS[l.t].f)>=0,'forma '+l.t);assert.ok(TAB.TIPOS[l.t].g);}
  const formas=new Set(['azul','roja','evento','banco'].map(t=>TAB.TIPOS[t].f));assert.ok(formas.has('o')&&formas.has('q')&&formas.has('d'),'+ círculo, - cuadrado, ! rombo');
  const pares=new Set(Object.values(TAB.TIPOS).map(t=>t.g+'|'+t.f));assert.strictEqual(pares.size,Object.keys(TAB.TIPOS).length,'cada tipo se distingue por forma+glifo');});

test('ordenarEtiquetas: no solapa rectángulos prohibidos ni otros rótulos; sin sitio, se atenúa; el tamaño se acota',()=>{
  const vista={x:0,y:0,w:800,h:600},proh=[{x:350,y:230,w:100,h:130}];   // ficha en el centro
  const it=[{x:400,y:300,w:150,h:20},{x:400,y:310,w:150,h:20},{x:20,y:10,w:150,h:20}];
  const out=TAB.ordenarEtiquetas(it,proh,vista,[]);assert.strictEqual(out.length,3);
  for(const o of out){assert.strictEqual(o.alfa,1);assert.ok(o.libre);
    assert.ok(!(o.x+o.w/2>350&&o.x-o.w/2<450&&o.y+o.h/2>230&&o.y-o.h/2<360),'no cubre la ficha');
    assert.ok(o.x-o.w/2>=-1e-9&&o.x+o.w/2<=800+1e-9&&o.y-o.h/2>=-1e-9&&o.y+o.h/2<=600+1e-9,'dentro de la vista');}
  assert.ok(!(Math.abs(out[0].x-out[1].x)<(out[0].w+out[1].w)/2&&Math.abs(out[0].y-out[1].y)<(out[0].h+out[1].h)/2),'entre rótulos tampoco');
  const tapa=[{x:0,y:0,w:800,h:600}],o2=TAB.ordenarEtiquetas([{x:400,y:300,w:100,h:20}],tapa,vista,[]);
  assert.strictEqual(o2[0].alfa,.6);assert.strictEqual(o2[0].libre,false);assert.ok(o2[0].esc<1);
  near(TAB.tamRotulo(.2),11.2,1e-9);assert.strictEqual(TAB.tamRotulo(.01),11);assert.strictEqual(TAB.tamRotulo(5),22);});

test('franja libre: con un panel abierto la ficha seguida se centra entre el HUD y el panel; sin franja no cambia nada',()=>{
  const C=CAM.crear();C.seguir(2000,1500,.7);run(C,3);
  const base=C.aPantalla(2000,1500);near(base.y,300,1);
  CAM.reserva=()=>({y0:110,y1:340});                       // franja libre 110..340 → centro 225 (75 u sobre el centro de la vista)
  run(C,3);const con=C.aPantalla(2000,1500);near(con.y,225,1,'la ficha sube a la franja');
  CAM.reserva=()=>({y0:0,y1:60});                          // franja absurda: tope ±25 % del alto (150 u)
  run(C,3);near(C.aPantalla(2000,1500).y,150,1.5,'tope');
  CAM.reserva=()=>null;run(C,3);near(C.aPantalla(2000,1500).y,300,1,'vuelve al centro');
  delete CAM.reserva;
  C.forzar(1000,1000,.7,5);CAM.reserva=()=>({y0:110,y1:340});run(C,2);near(C.aPantalla(1000,1000).y,300,1,'un momento forzado no se desvía');
  delete CAM.reserva;});
