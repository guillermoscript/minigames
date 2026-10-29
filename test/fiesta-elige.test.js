'use strict';
/* LA FIESTA · R2 de mecánicas regionales (doc 12): aviso ELIGE y los eventos con elección (Galipán, Morrocoy, Catatumbo, Pampatar, Guri, Noronquí,
   Isla, Salto Ángel, Mochima, San Antonio), más su CPU.  node --test test/fiesta-elige.test.js
   Método: el jugador en turno arranca 1 paso antes de la casilla con un Dado a la Medida; se juega con el reductor real hasta el primer aviso ELIGE. */
const test = require('node:test'), assert = require('node:assert/strict');
const R = require('../docs/style-lab/fiesta-reglas.js'), CPU = require('../docs/style-lab/fiesta-cpu.js'), RNG = require('../docs/style-lab/fiesta-rng.js');
const M = R.mapa, NOD = M.nodos, ADY = M.ady;
const REV = {}; Object.keys(NOD).forEach(k => { REV[k] = []; }); Object.keys(NOD).forEach(k => ADY[k].forEach(b => REV[b].push(k)));
const T0 = 1e12;

function inicio(seed) {
  let { S, priv } = R.crear(seed, {}, ['A', 'B', 'C', 'D'].map(name => ({ name })), T0);
  S.esp.quien.slice().forEach(s => { const r = R.aplicar(S, priv, s, { t: 'COMMIT', k: 'orden', eid: S.esp.id }, T0); S = r.S; priv = r.priv; });
  return { S, priv };
}
const sal0 = inicio(1).S; sal0.r = 2;          // ronda par: la Isla es visible
const previo = nodo => REV[nodo].filter(p => R.salidas(sal0, 'a', p, 1).some(x => x.a === nodo && x.ok))[0];

// Juega hasta que `quien` tenga un aviso ELIGE (o termine). Devuelve el estado y un `resp(id)` que contesta y sigue hasta el siguiente aviso ELIGE / fin del turno.
function llegar(nodo, seed, prep, n) {
  const x = inicio(seed || 1); let S = x.S, priv = x.priv; const s = S.esp.s, fx = [];
  S.pj[s].obj = ['medida', null, null]; S.pj[s].nodo = previo(nodo); if (nodo === 'del_isla') S.r = 2; if (prep) prep(S, s);
  const ctx = { s, fx, get S() { return S; }, get priv() { return priv; }, antes: JSON.parse(JSON.stringify(S)) };
  function ap(a, quien) { const r = R.aplicar(S, priv, quien || s, Object.assign({ eid: S.esp && S.esp.id }, a), T0); if (r.error) return r.error; S = r.S; priv = r.priv; fx.push.apply(fx, r.fx); return null; }
  function avanza() {
    for (let g = 0; g < 40 && S.f === 'turno' && S.esp && S.esp.s === s; g++) {
      const e = S.esp;
      if (e.k === 'ELIGE') return e;
      if (e.k === 'RUTA') { const ok = e.opc.filter(o => o.ok); assert.equal(ap({ t: 'RUTA', a: (ok.filter(o => o.a === nodo)[0] || ok[0]).a }), null); }
      else if (e.k === 'ESTRELLA') assert.equal(ap({ t: 'ESTRELLA', si: false }), null);
      else if (e.k === 'TIENDA') assert.equal(ap({ t: 'COMPRAR', item: null }), null);
      else if (e.k === 'OBJETIVO') assert.equal(ap({ t: 'OBJETIVO', a: e.opc[0] }), null);
      else break;
    }
    return null;
  }
  assert.equal(ap({ t: 'USAR', slot: 0, n: n || 1 }), null); assert.equal(ap({ t: 'TIRAR' }), null);
  ctx.ap = ap; ctx.avanza = avanza; ctx.e = avanza(); ctx.m0 = ctx.e ? S.pj[s].mon : ctx.antes.pj[s].mon;   // monedas al llegar al aviso (el pasaje del camino ya se cobró)
  ctx.resp = id => { const er = ap({ t: 'ELIGE', id }); assert.equal(er, null, 'ELIGE ' + id + ' -> ' + er); ctx.e = avanza(); return ctx.e; };
  return ctx;
}
const op = (e, id) => e.opc.filter(o => o.id === id)[0];
const mon = (c, s) => c.S.pj[s || c.s].mon - (s && s !== c.s ? c.antes.pj[s].mon : c.m0);

test('ELIGE/ el aviso: forma, errores y plazo por defecto', () => {
  const c = llegar('ccs_galipan'); const e = c.e;
  assert.equal(e.k, 'ELIGE'); assert.equal(e.s, c.s); assert.equal(e.que, 'galipan'); assert.ok(e.tit && e.def && e.opc.length === 3);
  assert.ok(!op(e, e.def).off, 'la opción por defecto nunca está deshabilitada');
  assert.equal(c.ap({ t: 'ELIGE', id: 'nada' }), 'opcion'); assert.equal(c.ap({ t: 'TIRAR' }), 'accion');
  const otro = Object.keys(c.S.pj).filter(x => x !== c.s)[0];
  assert.equal(c.ap({ t: 'ELIGE', id: e.def }, otro), 'turno', 'solo contesta quien tiene el aviso');
  // plazo vencido: tick aplica la opción por defecto y el turno sigue
  const r = R.tick(c.S, c.priv, c.S.esp.hasta + 1); assert.equal(r.error, null); assert.ok(!r.nada); assert.ok(!r.S.esp || r.S.esp.k !== 'ELIGE' || r.S.esp.s !== c.s);
  assert.equal(R.vista(c.S, c.s).mio, true); assert.equal(R.vista(c.S, otro).mio, false);
});

test('ELIGE/ Galipán: +4 monedas o un objeto con 2 de descuento (si hay lugar y alcanza)', () => {
  const m4 = llegar('ccs_galipan', 3); m4.resp('m4'); assert.equal(mon(m4), 4);
  const c = llegar('ccs_galipan', 3), it = c.e.opc.filter(o => o.id.indexOf('o:') === 0)[0], item = it.id.slice(2);
  c.resp(it.id); assert.equal(mon(c), -Math.max(1, R.OBJ[item].p - 2)); assert.ok(c.S.pj[c.s].obj.indexOf(item) >= 0);
  const lleno = llegar('ccs_galipan', 3, (S, s) => { S.pj[s].obj = ['medida', 'malta', 'malta']; });   // la Medida se gasta: queda 1 lugar
  const pobre = llegar('ccs_galipan', 3, (S, s) => { S.pj[s].mon = 5; });      // el teleférico cuesta 5: llega con 0
  pobre.e.opc.filter(o => o.id.indexOf('o:') === 0).forEach(o => assert.equal(o.off, true, 'sin monedas no se puede comprar'));
  assert.ok(lleno.e);
});

test('ELIGE/ Morrocoy: día de playa +2 o lancha (−3) a Puerto Colombia, Puerto Cabello o Coro', () => {
  const pl = llegar('coc_morrocoy', 2); pl.resp('playa'); assert.equal(mon(pl), 2); assert.equal(pl.S.pj[pl.s].nodo, 'coc_morrocoy');
  const la = llegar('coc_morrocoy', 2); la.resp('l:coc_puertocabello'); assert.equal(mon(la), -3); assert.equal(la.S.pj[la.s].nodo, 'coc_puertocabello');
  const sin = llegar('coc_morrocoy', 2, (S, s) => { S.pj[s].mon = 5; });      // la lancha de llegada cuesta 3: queda con 2 ['coc_puertocolombia', 'coc_puertocabello', 'coc_coro'].forEach(d => assert.equal(op(sin.e, 'l:' + d).off, true));
  assert.equal(sin.ap({ t: 'ELIGE', id: 'l:coc_coro' }), 'opcion');
});

test('ELIGE/ Catatumbo: rayo a quien quieras (−5), después elige el daño; el Recibo lo frena', () => {
  const c = llegar('zul_catatumbo', 4); const v = Object.keys(c.S.pj).filter(x => x !== c.s)[0];
  assert.deepEqual(c.e.opc.map(o => o.id), ['azar', 'r:' + Object.keys(c.S.pj).filter(x => x !== c.s)[0], 'r:' + Object.keys(c.S.pj).filter(x => x !== c.s)[1], 'r:' + Object.keys(c.S.pj).filter(x => x !== c.s)[2]]);
  const e2 = c.resp('r:' + v); assert.equal(e2.que, 'catatumbo2'); assert.equal(c.S.pj[c.s].mon, c.antes.pj[c.s].mon - 5);
  const banco0 = Object.values(c.S.tab.bancos).reduce((a, b) => a + b, 0);
  c.resp('mon'); assert.equal(c.S.pj[v].mon, c.antes.pj[v].mon - 8); assert.equal(Object.values(c.S.tab.bancos).reduce((a, b) => a + b, 0), banco0 + 8, 'las 8 monedas van a un banco');
  const l = llegar('zul_catatumbo', 4); l.resp('r:' + v); l.resp('lim'); assert.equal(l.S.pj[v].st.lim5, 1);
  const rc = llegar('zul_catatumbo', 4, (S, s) => { S.pj[Object.keys(S.pj).filter(x => x !== s)[0]].obj = ['recibo', null, null]; });
  const vv = Object.keys(rc.S.pj).filter(x => x !== rc.s)[0]; const f = rc.resp('r:' + vv); assert.ok(!f || f.k !== 'ELIGE', 'sin segunda elección'); assert.deepEqual(rc.S.pj[vv].obj, [null, null, null]); assert.equal(rc.S.pj[vv].mon, rc.antes.pj[vv].mon);
  const az = Array.from({ length: 30 }, (_, i) => { const a = llegar('zul_catatumbo', 40 + i); a.resp('azar'); return mon(a); }); assert.deepEqual([...new Set(az)].sort((a, b) => a - b), [-5, 5]);
  const pobre = llegar('zul_catatumbo', 4, (S, s) => { S.pj[s].mon = 4; }); pobre.e.opc.filter(o => o.id[0] === 'r').forEach(o => assert.equal(o.off, true));
});

test('ELIGE/ el daño del rayo respeta el tope de 20 por ronda', () => {
  const c = llegar('zul_catatumbo', 4, (S, s) => { const v = Object.keys(S.pj).filter(x => x !== s)[0]; S.tab.danoRonda = { [v]: 16 }; }); const v = Object.keys(c.S.pj).filter(x => x !== c.s)[0];
  c.resp('r:' + v); c.resp('mon'); assert.equal(c.S.pj[v].mon, c.antes.pj[v].mon - 4, 'solo caben 4 más');
});

test('ELIGE/ Cañonazo de Pampatar: solo apunta a quien está en Margarita u Oriente; sin blancos da +2', () => {
  const sin = llegar('mar_pampatar', 5); assert.ok(!sin.e, 'no hay aviso'); assert.equal(mon(sin), 2);
  const c = llegar('mar_pampatar', 5, (S, s) => { const v = Object.keys(S.pj).filter(x => x !== s); S.pj[v[0]].nodo = 'moc_cumana'; S.pj[v[1]].nodo = 'mar_porlamar'; });
  assert.deepEqual(c.e.opc.map(o => o.id).sort(), ['n:' + Object.keys(c.S.pj).filter(x => x !== c.s)[0], 'n:' + Object.keys(c.S.pj).filter(x => x !== c.s)[1], 'no'].sort());
  const x = c.e.opc[0].id.slice(2), antes = c.S.pj[x].nodo; c.resp(c.e.opc[0].id);
  assert.equal(c.fx.filter(f => f.k === 'hop' && f.s === x && f.modo === 'atras').length, 4); assert.notEqual(c.S.pj[x].nodo, antes);
});

test('ELIGE/ Interruptor de Guri: −10 alterna la luz, una vez por ronda, y solo si te alcanza', () => {
  const c = llegar('gua_guri', 6, (S, s) => { S.pj[s].mon = 30; }); assert.equal(c.e.que, 'guri');
  c.resp('si'); assert.equal(c.S.tab.apagon, 3); assert.equal(mon(c), -10); assert.equal(c.S.tab.guriRonda, c.S.r);
  const caer = llegar('gua_guri', 6, (S, s) => { S.pj[s].mon = 30; }); caer.resp('no'); assert.equal(mon(caer), 3, 'al caer sin pagar: +3 de vigilante');
  const ya = llegar('gua_guri', 6, (S, s) => { S.pj[s].mon = 30; S.tab.guriRonda = S.r; }); assert.ok(!ya.e, 'ya se cambió esta ronda');
  const apag = llegar('gua_guri', 6, (S, s) => { S.pj[s].mon = 30; S.tab.apagon = 2; }); assert.match(op(apag.e, 'si').txt, /Prender/); apag.resp('si'); assert.equal(apag.S.tab.apagon, 0);
  const pobre = llegar('gua_guri', 6, (S, s) => { S.pj[s].mon = 9; }); assert.ok(!pobre.e, 'con menos de 10 no hay interruptor');
});

test('ELIGE/ Noronquí VIP: −20 muda una estrella a Cayo de Agua; una vez por jugador; no en la Recta Final', () => {
  const c = llegar('roq_noronqui', 7, (S, s) => { S.pj[s].mon = 40; });
  c.resp('si'); assert.equal(mon(c), -20); assert.ok(R.estrellasEn(c.S).indexOf('roq_cayoagua') >= 0); assert.equal(c.S.pj[c.s].st.vip, 1);
  assert.ok(!llegar('roq_noronqui', 7, (S, s) => { S.pj[s].mon = 40; S.pj[s].st.vip = 1; }).e, 'ya usó el VIP');
  assert.ok(!llegar('roq_noronqui', 7, (S, s) => { S.pj[s].mon = 40; S.r = S.tot - 1; }).e, 'no en la Recta Final');
  assert.equal(op(llegar('roq_noronqui', 7, (S, s) => { S.pj[s].mon = 10; }).e, 'si').off, true);
});

test('ELIGE/ La Isla: +10 monedas o un objeto gratis (solo si hay lugar)', () => {
  const m = llegar('del_isla', 8); m.resp('mon'); assert.equal(mon(m), 10);
  const o = llegar('del_isla', 8), it = o.e.opc.filter(x => x.id.indexOf('o:') === 0)[0]; o.resp(it.id); assert.ok(o.S.pj[o.s].obj.indexOf(it.id.slice(2)) >= 0);
  const lleno = llegar('del_isla', 8, (S, s) => { S.pj[s].obj = ['medida', 'malta', 'malta']; S.pj[s].obj[0] = 'medida'; });
  assert.ok(lleno.e.opc.some(x => x.id.indexOf('o:') === 0), 'la Medida se gasta y queda un lugar');
});

test('ELIGE/ Salto Ángel: estrella premium por 35, una por jugador y partida', () => {
  const c = llegar('can_saltoangel', 9, (S, s) => { S.pj[s].mon = 50; }); c.resp('si');
  assert.equal(mon(c), -35); assert.equal(c.S.pj[c.s].est, 1); assert.equal(c.S.pj[c.s].st.premium, 1);
  assert.deepEqual(R.estrellasEn(c.S), R.estrellasEn(c.antes), 'no mueve la estrella de la Abuela');
  assert.ok(!llegar('can_saltoangel', 9, (S, s) => { S.pj[s].mon = 50; S.pj[s].st.premium = 1; }).e);
  assert.equal(op(llegar('can_saltoangel', 9, (S, s) => { S.pj[s].mon = 34; }).e, 'si').off, true);
});

test('ELIGE/ Mochima: playa (+8 y tirada 1-3) o peñero a las islas (−2 y 2d6×2… pesca 2-12 ×2)', () => {
  const p = llegar('moc_mochima', 10); p.resp('playa'); assert.equal(mon(p), 8); assert.equal(p.S.pj[p.s].st.lim3, 1);
  const vals = new Set(); for (let i = 0; i < 40; i++) { const c = llegar('moc_mochima', 100 + i); c.resp('islas'); vals.add(mon(c)); assert.ok(!c.S.pj[c.s].st.lim3); }
  const v = [...vals]; assert.ok(Math.min(...v) >= 0 && Math.max(...v) <= 10, 'pesca neta −2 + 2..12: ' + v.join(','));
});

test('ELIGE/ San Antonio: sellado o cambio, al pasar o al caer; sin monedas no hay aviso', () => {
  const pagar = llegar('and_sanantonio', 11, (S, s) => { S.pj[s].mon = 20; }); assert.equal(pagar.e.que, 'sanantonio'); pagar.resp('pagar'); assert.equal(mon(pagar), -3);
  assert.ok(!llegar('and_sanantonio', 11, (S, s) => { S.pj[s].mon = 0; }).e);
  const vals = new Set(); for (let i = 0; i < 80; i++) { const c = llegar('and_sanantonio', 200 + i, (S, s) => { S.pj[s].mon = 30; }); c.resp('cambio'); vals.add(mon(c) - 0); }
  [...vals].forEach(d => assert.ok([-9, 0, 6, 15].indexOf(d) >= 0, 'resultado del cambio: ' + d)); assert.equal(vals.size, 4, 'salen las cuatro ramas');
  // pasando de largo también cobra: 2 pasos desde el nodo previo
  const paso = llegar('and_sanantonio', 11, (S, s) => { S.pj[s].mon = 20; S.pj[s].nodo = REV['and_sanantonio'].filter(p => R.salidas(sal0, 'a', p, 1).some(x => x.a === 'and_sanantonio' && x.ok))[0]; }, 2);
  assert.ok(paso.e && paso.e.que === 'sanantonio', 'al pasar también pregunta');
});

test('ELIGE/ la CPU contesta cada aviso con una opción válida y no se atasca', () => {
  const rng = RNG.crear(5); const nodos = ['ccs_galipan', 'coc_morrocoy', 'zul_catatumbo', 'mar_pampatar', 'gua_guri', 'roq_noronqui', 'del_isla', 'can_saltoangel', 'moc_mochima', 'and_sanantonio'];
  nodos.forEach(n => [0, 25, 60].forEach(mon0 => {
    const c = llegar(n, 12, (S, s) => { S.pj[s].mon = mon0 || 20; if (n === 'mar_pampatar') S.pj[Object.keys(S.pj).filter(x => x !== s)[0]].nodo = 'moc_cumana'; });
    let vueltas = 0; while (c.e && vueltas++ < 4) {
      const v = R.vista(c.S, c.s), a = CPU.decide(c.S, v, c.s, rng); assert.equal(a.t, 'ELIGE', n); const o = op(c.e, a.id); assert.ok(o && !o.off, n + ': opción válida ' + a.id);
      c.resp(a.id);
    }
    assert.ok(!c.e, n + ': terminó');
  }));
});
