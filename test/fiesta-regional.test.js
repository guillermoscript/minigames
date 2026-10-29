'use strict';
/* LA FIESTA · R1 de mecánicas regionales (doc 12): eventos propios de cada casilla que se resuelven solos, tirada limitada (lim3/lim5/bonus2),
   «A oscuras», Colearse y el tope de 20 monedas de daño ajeno por ronda.  node --test test/fiesta-regional.test.js
   Método: se coloca al jugador en turno 1 paso antes de la casilla, se le da un Dado a la Medida (n pasos exactos) y se juega el turno entero con el reductor real. */
const test = require('node:test'), assert = require('node:assert/strict');
const R = require('../docs/style-lab/fiesta-reglas.js');
const M = R.mapa, NOD = M.nodos, ADY = M.ady;
const REV = {}; Object.keys(NOD).forEach(k => { REV[k] = []; }); Object.keys(NOD).forEach(k => ADY[k].forEach(b => REV[b].push(k)));
const T0 = 1e12;

function inicio(seed) {
  let { S, priv } = R.crear(seed, {}, ['A', 'B', 'C', 'D'].map(name => ({ name })), T0);
  S.esp.quien.slice().forEach(s => { const r = R.aplicar(S, priv, s, { t: 'COMMIT', k: 'orden', eid: S.esp.id }, T0); assert.equal(r.error, null); S = r.S; priv = r.priv; });
  assert.equal(S.f, 'turno');
  return { S, priv };
}
// Juega el turno completo de quien tiene el dado. prep(S, s) deja el tablero a gusto; n = pasos exactos (Dado a la Medida).
function turno(seed, prep, n, destino, elige) {
  const st = inicio(seed); let S = st.S, priv = st.priv; const s = S.esp.s, fx = []; let rutas = 0;
  S.pj[s].obj = ['medida', null, null]; if (prep) prep(S, s);
  const s0 = JSON.parse(JSON.stringify(S));
  function ap(a) { const r = R.aplicar(S, priv, s, Object.assign({ eid: S.esp.id }, a), T0); assert.equal(r.error, null, JSON.stringify(a) + ' -> ' + r.error); S = r.S; priv = r.priv; fx.push.apply(fx, r.fx); }
  ap({ t: 'USAR', slot: 0, n }); ap({ t: 'TIRAR' });
  for (let g = 0; g < 40 && S.f === 'turno' && S.esp && S.esp.s === s; g++) {
    const e = S.esp;
    if (e.k === 'RUTA') { rutas++; const ok = e.opc.filter(o => o.ok); ap({ t: 'RUTA', a: (ok.filter(o => o.a === destino)[0] || ok[0]).a }); }
    else if (e.k === 'ESTRELLA') ap({ t: 'ESTRELLA', si: false });
    else if (e.k === 'TIENDA') ap({ t: 'COMPRAR', item: null });
    else if (e.k === 'OBJETIVO') ap({ t: 'OBJETIVO', a: e.opc[0] });
    else if (e.k === 'ELIGE') ap({ t: 'ELIGE', id: (elige && elige(e)) || e.def });
    else break;
  }
  return { S, s0, s, fx, rutas, st: S.pj[s], antes: s0.pj[s], pend: S.esp && S.esp.s === s ? S.esp : null };
}
const previo = nodo => REV[nodo].filter(p => { const sal = R.salidas(inicio(1).S, 'a', p, 1); return sal.some(x => x.a === nodo && x.ok); })[0];
function sobre(nodo, n, prep, pre) { const p = pre || previo(nodo); assert.ok(p, 'hay un nodo previo a ' + nodo); return seed => turno(seed, (S, s) => { S.pj[s].nodo = p; if (prep) prep(S, s); }, n || 1, nodo); }
function deltaMon(r) { return r.st.mon - r.antes.mon; }
function recorre(f, n) { const out = []; for (let sd = 1; sd <= (n || 60); sd++) out.push(f(sd)); return out; }
function hayEvento(r, id) { return r.fx.some(x => x.k === 'evento' && x.id === id); }

test('R1/ cada casilla regional dispara su evento propio y no el de la tabla genérica', () => {
  const nodos = ['coc_choroni', 'coc_coro', 'zul_gaita', 'and_picoespejo', 'and_aguila', 'and_sancristobal', 'lla_hato', 'lla_calabozo', 'gua_elcallao',
    'can_roraima', 'can_carrao', 'moc_caripe', 'moc_higuerote', 'mar_restinga', 'roq_madrisqui'];
  const genericos = ['billete', 'cola', 'regalo', 'fresas', 'propina', 'relampago'];
  nodos.forEach(n => {
    const rs = recorre(sobre(n), 12);
    rs.forEach((r, i) => {
      assert.ok(r.fx.some(x => x.k === 'pasa' && x.nodo === n), n + ': el jugador cae en la casilla');
      assert.ok(!r.fx.some(x => x.k === 'evento' && genericos.indexOf(x.id) >= 0 && x.s === r.s), n + ': usa un evento propio (seed ' + (i + 1) + ')');
    });
  });
});

test('R1/ Curvas del Pittier: 1-2 mareo (próxima tirada 1-5), 3-6 +3', () => {
  const rs = recorre(sobre('coc_choroni'));
  const marea = rs.filter(r => r.st.st.lim5), cacao = rs.filter(r => !r.st.st.lim5);
  assert.ok(marea.length > 5 && cacao.length > 20, 'salen las dos ramas: ' + marea.length + '/' + cacao.length);
  cacao.forEach(r => assert.equal(deltaMon(r), 3)); marea.forEach(r => assert.equal(deltaMon(r), 0));
});

test('R1/ Gaitazo: quien cae +7, los demás +2', () => {
  const r = sobre('zul_gaita')(3);
  assert.equal(deltaMon(r), 7);
  Object.keys(r.S.pj).filter(x => x !== r.s).forEach(x => assert.equal(r.S.pj[x].mon - r.s0.pj[x].mon, 2));
});

test('R1/ Pico El Águila: el páramo limita la tirada a 1-5 salvo que comas (Arepa, Malta o Guayoyo)', () => {
  const sin = sobre('and_aguila')(2); assert.equal(sin.st.st.lim5, 1);
  const con = sobre('and_aguila', 1, (S, s) => { S.pj[s].obj = ['medida', 'arepa', null]; })(2);
  assert.ok(!con.st.st.lim5, 'sin límite'); assert.deepEqual(con.st.obj, [null, null, null], 'se gastó la Medida y la Arepa');
});

test('R1/ Hato y Higuerote en 1d6: ramas +8/0 y +6/+1', () => {
  const h = recorre(sobre('lla_hato')).map(deltaMon); assert.deepEqual([...new Set(h)].sort((a, b) => a - b), [0, 8]);
  const t = recorre(sobre('moc_higuerote')).map(deltaMon); assert.deepEqual([...new Set(t)].sort((a, b) => a - b), [1, 6]);
});

test('R1/ Calabozo: corrientazo (pierdes un objeto o 3 monedas) o batería cargada (+2 a la próxima tirada)', () => {
  const rs = recorre(sobre('lla_calabozo', 1, (S, s) => { S.pj[s].obj = ['medida', 'malta', null]; }));
  const bat = rs.filter(r => r.st.st.bonus2), co = rs.filter(r => !r.st.st.bonus2);
  assert.ok(bat.length > 5 && co.length > 5);
  co.forEach(r => assert.deepEqual(r.st.obj, [null, null, null], 'perdió la Malta'));
  bat.forEach(r => assert.deepEqual(r.st.obj, [null, 'malta', null]));
  const sin = recorre(sobre('lla_calabozo')).filter(r => !r.st.st.bonus2); sin.forEach(r => assert.equal(deltaMon(r), -3, 'sin objetos: -3'));
});

test('R1/ Roraima: 1 retrocede 3, 2-5 +4, 6 objeto', () => {
  const rs = recorre(sobre('can_roraima'), 90);
  const atras = rs.filter(r => hayEvento(r, 'dino') && r.fx.some(x => x.k === 'hop' && x.modo === 'atras'));
  assert.ok(atras.length > 4); atras.forEach(r => assert.equal(r.fx.filter(x => x.k === 'hop' && x.modo === 'atras').length, 3));
  assert.ok(rs.some(r => deltaMon(r) === 4)); assert.ok(rs.some(r => r.st.obj.some(o => o && o !== 'medida')));
});

test('R1/ Sandboard, Rápidos y Manglares: avanzas 1d4 más, una sola vez por turno', () => {
  ['coc_coro', 'can_carrao', 'mar_restinga'].forEach(n => recorre(sobre(n), 20).forEach(r => {
    const hops = r.fx.filter(x => x.k === 'hop' && x.modo !== 'atras' && x.modo !== 'tele');
    assert.ok(hops.length >= 2 && hops.length <= 5, n + ': avanzó ' + hops.length);
    assert.notEqual(r.st.nodo, n, n + ': salió de la casilla');
    assert.ok(r.fx.filter(x => x.k === 'evento' && x.id === 'avanza').length <= 1, 'solo una extensión por turno');
  }));
});

test('R1/ La extensión no vuelve a resolver una casilla especial de destino (Carrao → Guri)', () => {
  // can_carrao sale directo a gua_guri (especial): si la extensión termina ahí, no se dispara su regla (doc 05 §4.2)
  let visto = 0;
  recorre(sobre('can_carrao'), 200).forEach(r => {
    const pasa = r.fx.filter(x => x.k === 'pasa'); if (pasa.length < 2) return;
    const ult = pasa[pasa.length - 1]; if (ult.nodo !== 'gua_guri') return;
    visto++; assert.ok(!r.fx.slice(r.fx.lastIndexOf(ult)).some(x => (x.k === 'evento' || x.k === 'mon') && x.s === r.s), 'sin efecto en el destino de la extensión');
  });
  assert.ok(visto > 0, 'se observó al menos un caso (' + visto + ')');
});

test('R1/ A oscuras: la Cueva da +3 y, en tu siguiente turno, cada cruce se elige al azar', () => {
  const r = sobre('moc_caripe')(4); assert.equal(deltaMon(r), 3); assert.equal(r.st.st.oscuro, 1);
  // cruce con 2 salidas libres
  const st0 = inicio(1).S;
  const cruce = Object.keys(NOD).filter(x => { const sal = R.salidas(st0, 'a', x, 9).filter(o => o.ok && !o.costo && o.pasos === 1); return sal.length >= 2 && REV[x].some(p => R.salidas(st0, 'a', p, 1).some(o => o.a === x && o.ok)); })[0];
  assert.ok(cruce, 'hay un cruce simple');
  const pre = previo(cruce);
  const normal = turno(1, (S, s) => { S.pj[s].nodo = pre; }, 2, null);
  assert.ok(normal.rutas >= 1, 'normalmente el cruce pregunta la ruta');
  const o = turno(1, (S, s) => { S.pj[s].nodo = pre; S.pj[s].st.oscuro = 2; }, 2, null);
  assert.equal(o.rutas, 0, 'a oscuras no pregunta la ruta');
  // y se apaga al terminar el turno
  assert.ok(!o.S.pj[o.s].st.oscuro, 'la oscuridad dura un turno');
});

test('R1/ Tirada limitada: lim3 → 1-3, lim5 → 1-5, bonus2 → +2; la comida (Malta) las supera', () => {
  function tira(st, mod) {
    const x = inicio(7); let S = x.S, priv = x.priv; const s = S.esp.s; Object.assign(S.pj[s].st, st); if (mod) S.pj[s].obj = ['malta', null, null];
    if (mod) { const u = R.aplicar(S, priv, s, { t: 'USAR', slot: 0, eid: S.esp.id }, T0); S = u.S; priv = u.priv; }
    const r = R.aplicar(S, priv, s, { t: 'TIRAR', eid: S.esp.id }, T0); assert.equal(r.error, null);
    return { f: r.fx.filter(f => f.k === 'dado')[0], st: r.S.pj[s].st };
  }
  for (let sd = 0; sd < 40; sd++) {
    const base = inicio(100 + sd); const s = base.S.esp.s;
    const a = base.S; a.pj[s].st.lim3 = 1; const r3 = R.aplicar(a, base.priv, s, { t: 'TIRAR', eid: a.esp.id }, T0).fx.filter(f => f.k === 'dado')[0]; assert.ok(r3.v >= 1 && r3.v <= 3 && r3.de === 'lim');
    const b = inicio(100 + sd).S; b.pj[s].st.lim5 = 1; const r5 = R.aplicar(b, base.priv, s, { t: 'TIRAR', eid: b.esp.id }, T0); const d5 = r5.fx.filter(f => f.k === 'dado')[0];
    assert.ok(d5.v >= 1 && d5.v <= 5); assert.ok(!r5.S.pj[s].st.lim5, 'el límite se gasta');
  }
  const p = tira({ bonus2: 1 }, false); assert.ok(p.f.v >= 3 && p.f.v <= 12 && !p.st.bonus2);
  const m = tira({ lim5: 1 }, true); assert.equal(m.f.de, 'malta'); assert.ok(!m.st.lim5, 'comer supera el límite y lo borra');
});

test('R1/ Colearse: al pasar por alguien en una casilla roja le quitas 2 (una vez por turno)', () => {
  const roja = Object.keys(NOD).filter(x => NOD[x].t === 'roja' && ADY[x].length && REV[x].length).filter(x => {
    const pre = REV[x].filter(p => R.salidas(inicio(1).S, 'a', p, 1).some(o => o.a === x && o.ok))[0];
    return pre && ADY[x].some(y => R.salidas(inicio(1).S, 'a', x, 1).some(o => o.a === y && o.ok));
  })[0];
  assert.ok(roja, 'hay una roja de paso');
  const pre = previo(roja);
  const r = turno(5, (S, s) => { S.pj[s].nodo = pre; const v = Object.keys(S.pj).filter(x => x !== s)[0]; S.pj[v].nodo = roja; S.pj[v].mon = 30; }, 2, null);
  const v = Object.keys(r.S.pj).filter(x => x !== r.s && r.s0.pj[x].nodo === roja)[0];
  assert.ok(hayEvento(r, 'colea')); assert.equal(r.S.pj[v].mon - r.s0.pj[v].mon, -2);
  const gan = r.fx.filter(x => x.k === 'mon' && x.por === 'colea' && x.s === r.s)[0]; assert.equal(gan.d, 2);
  assert.equal(r.fx.filter(x => x.k === 'evento' && x.id === 'colea').length, 1);
});

test('R1/ Tope de daño ajeno: nadie pierde más de 20 monedas por ataques en una ronda', () => {
  function chancla(previo) {
    const x = inicio(9); let S = x.S, priv = x.priv; const s = S.esp.s, v = Object.keys(S.pj).filter(y => y !== s)[0];
    S.pj[s].obj = ['chancla', null, null]; S.pj[v].mon = 40; S.pj[v].nodo = S.pj[s].nodo; S.tab.danoRonda = previo ? { [v]: previo } : {};
    const r = R.aplicar(S, priv, s, { t: 'USAR', slot: 0, a: v, eid: S.esp.id }, T0); assert.equal(r.error, null);
    return { perdio: S.pj[v].mon - r.S.pj[v].mon, sueltas: r.S.tab.sueltas, S: r.S, v };
  }
  assert.equal(chancla(0).perdio, 5);
  assert.equal(chancla(18).perdio, 2, 'solo caben 2 monedas más');
  assert.equal(chancla(20).perdio, 0, 'tope agotado');
  const c = chancla(18); assert.equal(Object.values(c.sueltas).reduce((a, b) => a + b, 0), 2, 'lo que no se cobra, no se suelta');
});

test('R1/ El tope se reinicia cada ronda', () => {
  let { S, priv } = inicio(11); S.tab.danoRonda = { b: 20 };
  let guard = 0, now = T0;
  while (S.r < 2 && guard++ < 3000) {
    if (S.f === 'turno' && S.esp) { const v = R.vista(S, S.esp.s); const CPU = require('../docs/style-lab/fiesta-cpu.js'); const a = CPU.decide(S, v, S.esp.s, require('../docs/style-lab/fiesta-rng.js').crear(guard)); const r = R.aplicar(S, priv, S.esp.s, Object.assign({ aid: 'x' + guard }, a), now); if (!r.error) { S = r.S; priv = r.priv; continue; } }
    if (S.f === 'mj') { const r = R.aplicar(S, priv, '$', { t: 'MJ_RESULTADO', k: S.mj.k, i: S.mj.i, sc: S.mj.as.map((_, i) => i) }, now); S = r.S; priv = r.priv; continue; }
    if (S.f === 'carta' && S.mj) { now = Math.max(now, S.mj.cartaHasta); }
    else if (S.nextAt != null) now = Math.max(now, S.nextAt);
    const r = R.tick(S, priv, now); if (r.nada) { now += 250; continue; } S = r.S; priv = r.priv;
  }
  assert.ok(S.r >= 2); assert.deepEqual(S.tab.danoRonda, {}, 'la ronda 2 arrancó con el contador limpio');
});

test('R1/ Calipso de El Callao: los jugadores a ≤ 6 pasos avanzan 2 hacia ti y tú cobras 2 por cada uno', () => {
  const callao = 'gua_elcallao', cerca = Object.keys(NOD).filter(x => x !== callao && R.dist(x, callao) >= 3 && R.dist(x, callao) <= 6)[0];
  assert.ok(cerca);
  const r = turno(3, (S, s) => { const v = Object.keys(S.pj).filter(x => x !== s); S.pj[v[0]].nodo = cerca; S.pj[s].nodo = previo(callao); }, 1, callao);
  const v0 = Object.keys(r.S.pj).filter(x => x !== r.s && r.s0.pj[x].nodo === cerca)[0];
  assert.ok(R.dist(r.S.pj[v0].nodo, callao) <= R.dist(cerca, callao) - 2 || r.S.pj[v0].nodo === callao, 'se acercó');
  const gan = r.fx.filter(x => x.k === 'mon' && x.s === r.s).reduce((a, x) => a + x.d, 0);
  assert.ok(gan >= 2, 'cobró por los que se unieron: ' + gan);
});
