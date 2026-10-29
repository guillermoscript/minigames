const test=require('node:test'),assert=require('node:assert');
const rng=require('../docs/style-lab/fiesta-rng.js');
test('misma semilla, misma secuencia',()=>{
  const a=rng.crear(42),b=rng.crear(42);
  for(let i=0;i<50;i++)assert.strictEqual(a.next(),b.next());
});
test('semillas distintas divergen',()=>{assert.notStrictEqual(rng.crear(1).next(),rng.crear(2).next());});
test('int dentro de rango',()=>{const r=rng.crear(7);for(let i=0;i<500;i++){const v=r.int(1,10);assert.ok(v>=1&&v<=10);}});
test('estado se puede guardar y restaurar',()=>{
  const r=rng.crear(9);r.next();const e=r.estado;const x=r.next();r.estado=e;assert.strictEqual(r.next(),x);
});
test('withSeed restaura Math.random, incluso con excepción',()=>{
  const orig=Math.random;
  rng.withSeed(5,()=>assert.notStrictEqual(Math.random,orig));
  assert.strictEqual(Math.random,orig);
  assert.throws(()=>rng.withSeed(5,()=>{throw new Error('x');}));
  assert.strictEqual(Math.random,orig);
});
test('withSeed es determinista',()=>{
  assert.strictEqual(rng.withSeed(3,()=>Math.random()),rng.withSeed(3,()=>Math.random()));
});
