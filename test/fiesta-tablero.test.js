// LA FIESTA · tablero (fiesta-tablero.js): rótulos con reservados, apilado y humo de dibujo con primitivas falsas. node --test
const test=require('node:test'),assert=require('node:assert');
const TAB=require('../docs/style-lab/fiesta-tablero.js');
const CAM=require('../docs/style-lab/fiesta-camara.js');
const M=require('../docs/style-lab/fiesta-mapa-venezuela.js');
const lcg=s=>()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
const choca=(a,b)=>a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;

test('ordenarEtiquetas con reservados: 200 configuraciones, ningún rótulo libre solapa un reservado ni otro rótulo',()=>{
  const r=lcg(7),vista={x:0,y:0,w:800,h:600};
  for(let c=0;c<200;c++){
    const proh=[{x:300,y:196,w:200,h:150}];                          // el dado
    for(let i=0,n=Math.floor(r()*5);i<n;i++)proh.push({x:r()*700,y:r()*500,w:40+r()*60,h:40+r()*80});   // fichas y placas
    const it=[];for(let i=0,n=1+Math.floor(r()*6);i<n;i++)it.push({x:r()*800,y:r()*600,w:90+r()*80,h:18+r()*6});
    const out=TAB.ordenarEtiquetas(it,proh,vista,[]);assert.strictEqual(out.length,it.length);
    out.forEach((o,i)=>{if(!o.libre){assert.strictEqual(o.alfa,.6);return;}
      const R={x:o.x-o.w/2,y:o.y-o.h/2,w:o.w,h:o.h};
      proh.forEach(p=>assert.ok(!choca(R,p),'cfg '+c+' rótulo '+i+' solapa un reservado'));
      for(let j=0;j<i;j++)if(out[j].libre)assert.ok(!choca(R,{x:out[j].x-out[j].w/2,y:out[j].y-out[j].h/2,w:out[j].w,h:out[j].h}),'entre rótulos');
      assert.ok(R.x>=-1e-9&&R.y>=-1e-9&&R.x+R.w<=800+1e-9&&R.y+R.h<=600+1e-9,'dentro de la vista');});}});

test('ordenarEtiquetas: el anclaje previo (pe/pk) se prueba primero y se informa en e/k',()=>{
  const vista={x:0,y:0,w:800,h:600},it=[{x:400,y:300,w:100,h:20}];
  const a=TAB.ordenarEtiquetas(it,[],vista,[]);assert.strictEqual(a[0].k,0);
  it[0].pe=0;it[0].pk=2;const b=TAB.ordenarEtiquetas(it,[],vista,[]);assert.strictEqual(b[0].k,2,'conserva el anclaje elegido');
  const c=TAB.ordenarEtiquetas(it,[{x:350,y:320,w:100,h:60}],vista,[]);assert.notStrictEqual(c[0].k,2,'si choca, se reubica');assert.ok(c[0].libre);});

test('apilar 1..4: cabezas sin solape >10 % (≥ 44 u), simétrico, estable por asiento',()=>{
  for(let n=1;n<=4;n++){let sx=0;
    for(let i=0;i<n;i++){const d=TAB.apilar(n,i),d2=TAB.apilar(n,i);assert.deepStrictEqual(d,d2);sx+=d.dx;
      for(let j=i+1;j<n;j++){const e=TAB.apilar(n,j);assert.ok(Math.hypot(d.dx-e.dx,d.dy-e.dy)>=44-1e-9,'n='+n);}}
    assert.ok(Math.abs(sx)<1e-9,'simétrico n='+n);}
  assert.ok(TAB.apilar(4,0).dx<TAB.apilar(4,3).dx,'orden de izquierda a derecha por asiento');});

/* ── humo de dibujo: primitivas y lienzo falsos ── */
function proxy(){const f=function(){return p;},p=new Proxy(f,{get:(t,k)=>k==='canvas'?p:k===Symbol.toPrimitive?()=>0:k==='getTransform'?()=>({a:1,b:0}):k==='width'||k==='height'?512:p,set:()=>true,apply:()=>p});return p;}
test('humo: T.dibujar con 4 fichas, todos los ánimos y 3 zooms no lanza',()=>{
  const g=globalThis,keep={};const nombres=['rr','ell','line','poly','txt','bust','tw','ctx','style','sid','ellP','STY','document','now'];
  nombres.forEach(n=>{keep[n]=g[n];});
  let llamadas=0;const fn=()=>{llamadas++;};
  g.rr=g.ell=g.line=g.poly=g.txt=g.bust=fn;g.ellP=()=>[[0,0]];g.tw=s=>String(s).length*7;g.ctx=proxy();g.style='snes';g.sid=0;g.now=1;
  g.STY={snes:{col:c=>c}};g.document={createElement:()=>proxy()};
  try{
    require('../docs/style-lab/fiesta-personajes.js');           // F.PJ presente: las fichas y placas usan al personaje
    const T=TAB.crear({mapa:M}),cam=CAM.crear({mundo:TAB.MUNDO,vista:{x:0,y:0,w:800,h:600}});
    const mk=(n,ch,nodo,cpu)=>({ch,nodo,name:n,cpu:cpu||null});
    for(const ch of ['tu','mama','abuela','tio','pana','prima','cobrador','portu']){
      const D={f:'turno',pj:{a:mk('A',ch,'ccs_start'),b:mk('B','mama','ccs_start','afk'),c:mk('C','tio','ccs_start','auto'),d:mk('D','pana','ccs_start')},t:{s:'a'},esp:null,estrella:{nodo:'ccs_galipan',b:ch==='tu'?null:'moc_mochima',precio:10},tab:{}};   // 'tu': una estrella; el resto: dos
      for(const z of [cam.zFit(),.7,1.4]){cam.seguir(2000,1500,z);for(let i=0;i<120;i++)cam.update(1/60);
        for(let k=0;k<3;k++)T.dibujar(proxy(),cam,D,{yo:'a',t:1+k*.4,presupuesto:1,reservados:[{x:300,y:196,w:200,h:150}],animo:k===2?{a:'happy'}:null});}}
    assert.ok(llamadas>0);
  }finally{nombres.forEach(n=>{if(keep[n]===undefined)delete g[n];else g[n]=keep[n];});}});
