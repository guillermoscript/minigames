const test=require('node:test'),assert=require('node:assert');
const M=require('../docs/style-lab/fiesta-mapa-venezuela.js');
const ids=Object.keys(M.nodos);
function alcanza(desde,ady){const v=new Set([desde]),q=[desde];while(q.length){const c=q.shift();for(const n of ady[c]||[])if(!v.has(n)){v.add(n);q.push(n);}}return v;}
test('todas las salidas existen',()=>{for(const [a,o] of Object.entries(M.ady)){assert.ok(M.nodos[a],a);for(const b of o)assert.ok(M.nodos[b],a+'->'+b);}});
test('rutas especiales apuntan a nodos reales',()=>{for(const r of M.rutas){assert.ok(M.nodos[r.de],r.de);assert.ok(M.nodos[r.a],r.a);}});
test('no hay callejones',()=>{for(const id of ids)assert.ok((M.ady[id]||[]).length>=1,'callejón '+id);});
test('todo alcanzable desde la salida',()=>{assert.strictEqual(alcanza(M.inicio,M.ady).size,ids.length);});
test('desde cualquier nodo se vuelve a la salida',()=>{
  const rev={};for(const [a,o] of Object.entries(M.ady))for(const b of o)(rev[b]=rev[b]||[]).push(a);
  assert.strictEqual(alcanza(M.inicio,rev).size,ids.length);
});
test('hay candidatos de estrella en varias regiones',()=>{
  const reg=new Set(ids.filter(i=>M.nodos[i].star).map(i=>M.nodos[i].r));assert.ok(reg.size>=5,[...reg].join());
});
