// LA FIESTA · arte del mapa (fiesta-mapa-arte.js y capas fiesta-arte-*.js): determinismo, máscaras y límites. node --test
const test = require('node:test'), assert = require('node:assert'), fs = require('node:fs'), path = require('node:path');
const LAB = path.join(__dirname, '../docs/style-lab');
const ARTE = require(path.join(LAB, 'fiesta-mapa-arte.js'));
fs.readdirSync(LAB).filter((f) => /^fiesta-arte-.*\.js$/.test(f)).sort().forEach((f) => require(path.join(LAB, f)));
const hashBuf = (b) => { let h = 2166136261; for (let i = 0; i < b.length; i += 7) h = Math.imul(h ^ b[i], 16777619) >>> 0; return h; };
let A1;
test('construye sin errores de capa y dentro del presupuesto', () => {
  A1 = ARTE.construir({});
  assert.deepStrictEqual(A1.errores, [], 'errores de capa: ' + A1.errores.join(' || '));
  assert.ok(A1.tiempos.total < 40000, 'construcción total ' + A1.tiempos.total + ' ms');
});
test('determinista: dos construcciones dan el mismo búfer y las mismas animaciones', () => {
  const A2 = ARTE.construir({});
  assert.strictEqual(hashBuf(A2.buf), hashBuf(A1.buf));
  assert.strictEqual(JSON.stringify(A2.dyn), JSON.stringify(A1.dyn));
});
test('todas las casillas están en tierra firme y el búfer no tiene píxeles vacíos', () => {
  A1.nodos.forEach((n) => assert.ok(A1.esTierra(n.x, n.y), 'casilla en el mar: ' + n.id));
  let vacios = 0; for (let i = 0; i < A1.buf.length; i += 3) if (A1.buf[i] === 0) vacios++;
  assert.strictEqual(vacios, 0, 'píxeles sin pintar (valor 0): ' + vacios);
});
test('animaciones: ≤ 150 entidades y cada tipo tiene su pintor', () => {
  assert.ok(A1.dyn.length <= 150, 'entidades ' + A1.dyn.length);
  A1.dyn.forEach((e) => { assert.strictEqual(typeof ARTE.din[e.k], 'function', 'sin pintor para ' + e.k); assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y)); });
});
test('el lago y el mar existen y la tierra domina el mapa', () => {
  let t = 0, l = 0, m = 0; for (let i = 0; i < A1.tierra.length; i += 11) { if (A1.tierra[i] === 1) t++; else if (A1.tierra[i] === 2) l++; else m++; }
  assert.ok(l > 200, 'lago'); assert.ok(m > 1000, 'mar'); assert.ok(t > m * .4, 'tierra');
});
