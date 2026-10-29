'use strict';
/* Banco headless de f_harina (modelo C): node docs/style-lab/pruebas/fiesta-harina-bench.js
   Carga fiesta-juego-harina.js con un FIESTA.LIVE falso (captura la def) y un contexto c falso solo-juez.
   Comprueba: lint, determinismo, pack <=300 B, restore exacto, reglas (robo solo con brillo, tropiezo), bots CPU, ociosos,
   resultados dentro de limites, y que draw() solo usa primitivas (en un viewer reconstruido con unpack/lerp/predict). */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const DIR = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(DIR, 'fiesta-juego-harina.js'), 'utf8');
let fails = 0;
function ok(name, cond, extra) { if (cond) console.log('  ok   ' + name); else { fails++; console.log('  FAIL ' + name + (extra ? ' -> ' + extra : '')); } }

/* ── lint ── */
ok('sin Math.random', !/Math\.random/.test(src));
ok('sin Date.now / performance.now', !/Date\.now|performance\.now/.test(src));
ok('sin ctx.fill/stroke/arc/lineTo/drawImage/fillText/beginPath', !/ctx\.(fill|stroke|arc|lineTo|moveTo|drawImage|fillText|fillRect|beginPath|ellipse)\b/.test(src));
ok('sin ?. ?? ni spread de objetos ni async', !/\?\.|\?\?|\.\.\.[a-zA-Z{]|\basync\b/.test(src));
ok('tipos x* no usados (modelo C: sin send)', !/\.send\(/.test(src));

/* ── entorno falso ── */
const calls = {}, banned = [];
const ALLOWED_CTX = new Set(['save', 'restore', 'translate', 'rotate', 'scale']);
const ctxStub = new Proxy({}, {
  get(t, k) { if (k in t) return t[k]; return (...a) => { if (!ALLOWED_CTX.has(k)) banned.push(String(k)); }; },
  set(t, k, v) { if (k !== 'globalAlpha') banned.push('set:' + String(k)); t[k] = v; return true; }
});
function prim(name) { return function () { calls[name] = (calls[name] || 0) + 1; }; }
const sandbox = {
  console, Math, JSON, Object, Array, Number, String, Error,
  ctx: ctxStub, rr: prim('rr'), ell: prim('ell'), line: prim('line'), poly: prim('poly'), txt: prim('txt'), bust: prim('bust'),
  spawn() {}, BUS: { AP: { CAST: { abuela: { x: 0 } } } }
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(DIR, 'fiesta-rng.js'), 'utf8'), sandbox);
let DEF = null;
sandbox.FIESTA.LIVE = { get: () => DEF, add: (id, d) => { assert.strictEqual(id, 'f_harina'); DEF = d; } };
vm.runInContext(src, sandbox, { filename: 'fiesta-juego-harina.js' });
ok('registra f_harina', !!DEF);
ok('def: modelo C, 1 botón + stick, minT 27', DEF.modelo === 'C' && DEF.botones === 1 && DEF.stick && DEF.limites.minT === 27 && DEF.limites.scoreMax === 800 && DEF.limites.scoreRate === 25 && DEF.limites.finTemprano === 0);
ok('def: carta completa', DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 2);
const RNG = sandbox.FIESTA.rng;

function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mkC(o) {
  const n = o.n, ins = { a: new Array(n).fill(0), ex: new Array(n).fill(0), ey: new Array(n).fill(0) };
  const c = {
    n, yo: o.yo || 0, lv: o.lv || 1, dur: o.dur || 30, modo: n === 2 ? '1v1' : 'ffa', practica: false, modelo: 'C', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + (i + 1), ch: 'mama', color: ['#ff6b6b', '#4dd0e1', '#ffd23f', '#9b6bff'][i], cpu: false, human: true, team: i })),
    equipos: Array.from({ length: n }, (_, i) => i), solo: -1,
    campo: () => ({ x0: o.x0 === undefined ? 0 : o.x0, x1: o.x1 === undefined ? 800 : o.x1, y0: 70, y1: 470 }),
    ahora: () => (o.gt || 0), rng: RNG.crear(o.seed), rngFor: (t) => RNG.crear(fnv(o.seed + ':' + t)), fx: () => 0.5,
    held: () => false, tap: (p) => { const v = ins.a[p]; ins.a[p] = 0; return v; }, eje: (p) => ({ x: ins.ex[p], y: ins.ey[p] }),
    cpu: new Array(n).fill(false), skill: Array.from({ length: n }, () => o.skill === undefined ? 0.6 : o.skill),
    juez: () => o.juez !== false, util: {}
  };
  return { c, ins };
}
function api(ins, p) { return { press: (b) => { ins.a[p]++; }, hold() {}, eje: (x, y) => { ins.ex[p] = x; ins.ey[p] = y; } }; }

/* partida completa; modes[p] = 'cpu' | 'idle' | 'script' ; opts.pre = (k, ins, g) para intervenir */
function run(o) {
  const { c, ins } = mkC(o), g = DEF.mk(c), n = c.n, ticks = Math.round(c.dur * 30), A = [];
  for (let p = 0; p < n; p++) A.push(api(ins, p));
  const sr = RNG.crear(fnv('script' + o.seed));
  let maxB = 0; const frames = [];
  for (let k = o.from || 0; k < ticks; k++) {
    for (let p = 0; p < n; p++) {
      const m = o.modes[p];
      if (m === 'cpu') g.ai(p, 1 / 30, A[p]);
      else if (m === 'script') { if (k % 15 === 0) { const a = sr.next() * 6.28; ins.ex[p] = Math.cos(a); ins.ey[p] = Math.sin(a); } if (sr.next() < 0.06) ins.a[p]++; }
    }
    if (o.pre) o.pre(k, ins, g);
    g.step(1 / 30); g.update(1 / 30);
    const pk = g.pack(); maxB = Math.max(maxB, JSON.stringify(pk).length);
    if (o.frames && k % 10 === 0) frames.push(pk);
  }
  return { g, c, ins, maxB, frames, sc: g.scores(), pk: g.pack() };
}

console.log('determinismo / pack / restore');
let r1 = run({ n: 4, seed: 11, lv: 2, modes: ['script', 'script', 'cpu', 'cpu'] });
let r2 = run({ n: 4, seed: 11, lv: 2, modes: ['script', 'script', 'cpu', 'cpu'] });
ok('misma semilla => mismo pack final', JSON.stringify(r1.pk) === JSON.stringify(r2.pk));
ok('pack <= 300 B (max ' + r1.maxB + ')', r1.maxB <= 300);
ok('pack tiene packN enteros', r1.pk.length === DEF.packN && r1.pk.every(Number.isInteger), 'len ' + r1.pk.length);
ok('pack es solo enteros finitos', r1.pk.every((v) => Number.isInteger(v) && isFinite(v)));
/* restore exacto: juez A corre todo; juez B arranca de pack(k=400) con las mismas entradas guiones */
{
  const modes = ['script', 'script', 'script', 'script'], T = 400;
  const full = run({ n: 4, seed: 5, lv: 3, modes });
  /* segunda corrida con entradas idénticas: cortar y restaurar en un g nuevo */
  const a = mkC({ n: 4, seed: 5, lv: 3 }), ga = DEF.mk(a.c);
  const sr = RNG.crear(fnv('script5'));
  const feed = (ins, p) => { const k = 0; };
  let snap = null; const inputs = [];
  for (let k = 0; k < 900; k++) {
    const row = [];
    for (let p = 0; p < 4; p++) { let ex = null, a2 = 0; if (k % 15 === 0) { const an = sr.next() * 6.28; ex = [Math.cos(an), Math.sin(an)]; } if (sr.next() < 0.06) a2 = 1; row.push([ex, a2]); }
    inputs.push(row);
  }
  function play(g, ins, from, to) { for (let k = from; k < to; k++) { for (let p = 0; p < 4; p++) { const [ex, a2] = inputs[k][p]; if (ex) { ins.ex[p] = ex[0]; ins.ey[p] = ex[1]; } ins.a[p] += a2; } g.step(1 / 30); } }
  play(ga, a.ins, 0, T); snap = JSON.parse(JSON.stringify(ga.pack())); play(ga, a.ins, T, 900);
  const b = mkC({ n: 4, seed: 5, lv: 3 }), gb = DEF.mk(b.c);
  gb.restore(snap);
  for (let p = 0; p < 4; p++) { b.ins.ex[p] = a.ins.ex[p]; }
  /* ejes vigentes en T: reconstruir hasta T (solo ins, sin simular) */
  for (let p = 0; p < 4; p++) { b.ins.ex[p] = 0; b.ins.ey[p] = 0; }
  for (let k = 0; k < T; k++) for (let p = 0; p < 4; p++) { const ex = inputs[k][p][0]; if (ex) { b.ins.ex[p] = ex[0]; b.ins.ey[p] = ex[1]; } }
  play(gb, b.ins, T, 900);
  ok('restore a mitad => estado final EXACTO igual (juez nuevo sigue idéntico)', JSON.stringify(ga.pack()) === JSON.stringify(gb.pack()));
  /* unpack tambien idempotente */
  const rt = gb.pack(); gb.unpack(rt); ok('unpack(pack()) es identidad', JSON.stringify(gb.pack()) === JSON.stringify(rt));
}

console.log('reglas');
const G = 1, PS = 10, BOFF = G + PS * 4;
function setP(a, p, o) { const b = G + PS * p; if ('x' in o) a[b] = o.x * 4; if ('y' in o) a[b + 1] = o.y * 4; ['stun', 'nb', 'ng', 'pts', 'dsh', 'cd', 'inv', 'fa'].forEach((k, i) => { if (k in o) a[b + 2 + i] = o[k]; }); }
function setB(a, j, x, y, kd) { a[BOFF + 3 * j] = x; a[BOFF + 3 * j + 1] = y; a[BOFF + 3 * j + 2] = kd; }
function clearB(a) { for (let j = 0; j < 10; j++) setB(a, j, 0, 0, 0); }
{
  const { c, ins } = mkC({ n: 2, seed: 3, lv: 1 }), g = DEF.mk(c);
  const s0 = g.pack(); clearB(s0);
  setP(s0, 0, { x: 400, y: 330, nb: 0, ng: 0, pts: 0, cd: 0, inv: 0, stun: 0 }); setP(s0, 1, { x: 520, y: 400, nb: 0, cd: 0, inv: 0, stun: 0 });
  setB(s0, 0, 410, 330, 1); setB(s0, 1, 380, 340, 2);
  g.restore(s0); ins.a[0] = 1; g.step(1 / 30);
  let v = g.vista(); ok('A junto a bolsa libre => la agarra (+2)', v.nb[0] === 1 && v.pts[0] === 2 && v.bags.filter(b => b.act).length === 1);
  ins.a[0] = 1; g.step(1 / 30); v = g.vista(); ok('agarrar la dorada cuenta ng', v.nb[0] === 2 && v.ng[0] === 1 && v.pts[0] === 4);
  /* robo: P1 pegado a P0 */
  let a = g.pack(); setP(a, 1, { x: 440, y: 330, cd: 0, stun: 0, inv: 0 }); setP(a, 0, { inv: 0, stun: 0 }); g.restore(a);
  ins.a[1] = 1; g.step(1 / 30); v = g.vista();
  ok('A pegado al que carga => le roba la DORADA primero', v.nb[1] === 1 && v.ng[1] === 1 && v.nb[0] === 1 && v.ng[0] === 0 && v.inv[0] > 0 && v.stun[0] > 0);
  ins.a[1] = 1; g.step(1 / 30); v = g.vista(); ok('víctima intocable + ladrón en recarga => no hay segundo robo', v.nb[0] === 1 && v.nb[1] === 1);
  /* empujón: A sin nada cerca */
  a = g.pack(); clearB(a); setP(a, 0, { x: 300, y: 300, nb: 0, ng: 0, cd: 0, inv: 0, stun: 0, fa: 0 }); setP(a, 1, { x: 360, y: 300, nb: 2, ng: 0, cd: 0, inv: 0, stun: 0 }); g.restore(a);
  ins.ex[0] = 1; ins.ey[0] = 0; ins.ex[1] = 0; ins.ey[1] = 0; ins.a[0] = 1;
  for (let k = 0; k < 6; k++) g.step(1 / 30);
  v = g.vista(); ok('empujón: choca, aturde y se le cae una bolsa al piso', v.stun[1] > 0 && v.nb[1] === 1 && v.bags.filter(b => b.act).length >= 1 && v.cd[0] > 0, JSON.stringify({ nb: v.nb, st: v.stun }));
  ins.ex[0] = 0;
  /* cobrar en la caja abierta */
  for (let k = 0; k < 120; k++) g.step(1 / 30); v = g.vista();
  const caja = v.caja, CJ = [[185, 198], [615, 198]][caja];
  a = g.pack(); setP(a, 0, { x: CJ[0], y: CJ[1] + 30, nb: 3, ng: 1, pts: 0, stun: 0, inv: 0 }); g.restore(a); g.step(1 / 30); v = g.vista();
  const esp = (2 * 12 + 30 + 24) * (v.fase === 2 ? 2 : 1);
  ok('cobro en la caja: 2×12 + dorada 30 + combo 24 = ' + esp, v.nb[0] === 0 && v.pts[0] === esp, 'pts=' + v.pts[0]);
  const otra = [[185, 198], [615, 198]][1 - caja];
  a = g.pack(); setP(a, 0, { x: otra[0], y: otra[1] + 30, nb: 2, ng: 0, pts: 0, stun: 0, inv: 0 }); g.restore(a); g.step(1 / 30); v = g.vista();
  ok('la caja cerrada no cobra', v.nb[0] === 2 && v.pts[0] === 0);
}
{
  /* calendario: escalada, camión, eventos, doble en el final */
  for (const dur of [30, 10]) {
    const { c } = mkC({ n: 2, seed: 4, lv: 2, dur }), g = DEF.mk(c), v0 = g.vista(), T = dur * 30;
    const tipos = {}; v0.ev.forEach(e => { tipos[e.tipo] = (tipos[e.tipo] || 0) + 1; });
    ok('dur ' + dur + ': hay eventos sembrados ' + JSON.stringify(tipos), v0.ev.length >= (dur === 30 ? 8 : 3) && tipos.camion >= 1 && tipos.carro >= 1);
    const rnd = v0.ev.filter(e => e.tipo !== 'camion'), enFinal = rnd.filter(e => e.t >= v0.F2).length / Math.max(1, T - v0.F2), alInicio = rnd.filter(e => e.t < v0.F1).length / v0.F1;
    ok('dur ' + dur + ': más eventos por segundo al final que al inicio', enFinal > alInicio, enFinal + ' vs ' + alInicio);
    let drop = false; for (let k = 0; k < T; k++) { const a = g.pack(); clearB(a); g.restore(a); g.step(1 / 30); if (g.vista().bags.filter(x => x.act).length >= 3) drop = true; }
    ok('dur ' + dur + ': el camión tira 3+ bolsas de una', drop);
  }
  const { c, ins } = mkC({ n: 2, seed: 4, lv: 1, dur: 30 }), g = DEF.mk(c);
  const v0 = g.vista(); for (let k = 0; k < v0.F2 + 2; k++) g.step(1 / 30);
  const CJ = [[185, 198], [615, 198]][g.vista().caja];
  const a = g.pack(); setP(a, 0, { x: CJ[0], y: CJ[1], nb: 1, ng: 0, pts: 0, stun: 0, inv: 0 }); g.restore(a); g.step(1 / 30);
  ok('¡ÚLTIMOS SEGUNDOS!: la caja paga doble (1 bolsa = 24)', g.vista().pts[0] === 24, 'pts=' + g.vista().pts[0]);
  /* carrito: tumba y riega todo */
  const { c: c2 } = mkC({ n: 2, seed: 8, lv: 1, dur: 30 }), g2 = DEF.mk(c2), E = g2.vista().ev.find(e => e.tipo === 'carro');
  for (let k = 0; k < E.t + E.w + 1; k++) g2.step(1 / 30);
  const b2 = g2.pack(); setP(b2, 0, { x: 400, y: E.ly, nb: 3, ng: 0, stun: 0, inv: 0 }); clearB(b2); g2.restore(b2);
  let hit = false; for (let k = 0; k < E.d; k++) { g2.step(1 / 30); const v = g2.vista(); if (v.nb[0] === 0 && v.stun[0] > 0) { hit = true; break; } const r = g2.pack(); setP(r, 0, { x: 400, y: E.ly }); g2.restore(r); }
  ok('el carrito te tumba y se te caen las 3 bolsas', hit && g2.vista().bags.filter(b => b.act).length === 3);
}

console.log('bots');
function stats(label, o, f) { const r = run(o); const res = f(r); ok(label + ' [' + r.sc.join(',') + ']', res, 'sc=' + r.sc); return r; }
for (const lv of [1, 2, 3]) {
  stats('4 CPU nv' + lv + ': puntajes en bounds y reparto con vida', { n: 4, seed: 20 + lv, lv, modes: ['cpu', 'cpu', 'cpu', 'cpu'] },
    r => r.sc.every(v => v >= 0 && v <= 787) && r.sc.reduce((a, b) => a + b, 0) >= 250 && Math.max(...r.sc) <= 500 && r.sc.filter(v => v > 20).length >= 3);
}
{
  let wins = 0, bad = 0, tot = 0;
  for (let s = 1; s <= 12; s++) {
    for (const lv of [1, 2, 3]) {
      const r = run({ n: 4, seed: 100 + s, lv, modes: ['idle', 'idle', 'cpu', 'cpu'] }); tot++;
      const top = Math.max(...r.sc);
      if (r.sc[0] >= top && top > 0) bad++; if (r.sc[1] >= top && top > 0) bad++;
      if (Math.max(r.sc[0], r.sc[1]) > Math.min(r.sc[2], r.sc[3])) wins++;
    }
  }
  ok('2 ociosos + 2 CPU (36 partidas): ningún ocioso en 1.º', bad === 0, 'bad=' + bad);
  ok('2 ociosos + 2 CPU: ocioso nunca supera a la peor CPU', wins === 0, 'wins=' + wins);
}
{
  /* la habilidad cuenta: CPU 0.9 vs tres CPU 0.3 */
  let sumHi = 0, sumLo = 0;
  for (let s = 1; s <= 10; s++) {
    const o = { n: 4, seed: 300 + s, lv: 1 + (s % 3), modes: ['cpu', 'cpu', 'cpu', 'cpu'] };
    const { c, ins } = mkC(o); c.skill = [0.9, 0.3, 0.3, 0.3];
    const g = DEF.mk(c), A = [0, 1, 2, 3].map(p => api(ins, p));
    for (let k = 0; k < 900; k++) { for (let p = 0; p < 4; p++) g.ai(p, 1 / 30, A[p]); g.step(1 / 30); }
    const sc = g.scores(); sumHi += sc[0]; sumLo += (sc[1] + sc[2] + sc[3]) / 3;
  }
  ok('CPU hábil saca más que las torpes (' + Math.round(sumHi / 10) + ' vs ' + Math.round(sumLo / 10) + ')', sumHi > sumLo * 1.1);
}
{
  const r = run({ n: 2, seed: 9, lv: 1, modes: ['cpu', 'cpu'] });
  ok('1v1 con 2 CPU suma puntos', r.sc[0] + r.sc[1] > 100, r.sc.join(','));
  const r3 = run({ n: 3, seed: 9, lv: 2, modes: ['cpu', 'idle', 'cpu'] });
  ok('n=3 corre y respeta bounds', r3.sc.every(v => v >= 0 && v <= 800));
  const rs = run({ n: 4, seed: 9, lv: 3, dur: 3, modes: ['cpu', 'cpu', 'cpu', 'cpu'] });
  ok('dur=3 no rompe', rs.sc.every(v => Number.isFinite(v)));
  const rl = run({ n: 4, seed: 9, lv: 3, dur: 10, modes: ['cpu', 'cpu', 'cpu', 'cpu'] });
  ok('relámpago dur=10: <= scoreRate*(10+1.5) [' + rl.sc + ']', rl.sc.every(v => v <= 25 * 11.5) && Math.max(...rl.sc) > 0);
  const rt = run({ n: 4, seed: 2, lv: 3, modes: ['script', 'script', 'script', 'script'] });
  ok('4 humanos al azar (script): puntaje <= scoreRate*(dur+1.5)', rt.sc.every(v => v <= 25 * 31.5));
}
{
  /* tope duro: un jugador que cobra 3 doradas cada tick no pasa de scoreRate*(t+1.5) */
  const { c } = mkC({ n: 2, seed: 1, lv: 1 }), g = DEF.mk(c);
  let okk = true;
  for (let k = 0; k < 900; k++) { const v = g.vista(), CJ = [[185, 198], [615, 198]][v.caja]; const a = g.pack(); setP(a, 0, { x: CJ[0], y: CJ[1], nb: 3, ng: 3, stun: 0 }); g.restore(a); g.step(1 / 30); if (g.vista().pts[0] > Math.floor(25 * ((k + 1) / 30 + 1.5))) okk = false; }
  ok('tope por tiempo respetado aun con trampa (' + g.vista().pts[0] + ')', okk && g.vista().pts[0] <= 787);
}

console.log('viewer (no juez): unpack + lerp + predict + draw en 3 niveles y escenas');
for (const lv of [1, 2, 3]) {
  const j = run({ n: 4, seed: 40 + lv, lv, modes: ['cpu', 'cpu', 'cpu', 'cpu'], frames: true });
  const v = mkC({ n: 4, seed: 40 + lv, lv, juez: false, yo: 1, x0: -60, x1: 860 }), gv = DEF.mk(v.c);
  let err = null;
  try {
    for (let i = 0; i + 1 < j.frames.length; i++) {
      const mid = gv.lerp(j.frames[i], j.frames[i + 1], 0.5);
      ok_(mid.length === DEF.packN);
      gv.unpack(mid); v.ins.ex[1] = 1; v.ins.ey[1] = 0;
      gv.predict(1 / 30, undefined); gv.update(1 / 30); gv.draw();
    }
    const v0 = mkC({ n: 2, seed: 1, lv, juez: true, gt: -2 }), g0 = DEF.mk(v0.c); g0.update(0.016); g0.draw(); g0.vista(); g0.destacado();
  } catch (e) { err = e; }
  ok('lv' + lv + ' draw/lerp/predict sin excepción', !err, err && err.stack);
}
function ok_(x) { if (!x) { fails++; console.log('  FAIL lerp len'); } }
ok('draw usa rr/ell/line/poly/txt/bust (' + JSON.stringify(calls) + ')', calls.rr && calls.ell && calls.line && calls.poly && calls.txt);
ok('ningún ctx.* prohibido (' + [...new Set(banned)].join(',') + ')', banned.length === 0);
console.log(fails ? '\n' + fails + ' FALLAS' : '\nTODO OK');
process.exit(fails ? 1 : 0);
