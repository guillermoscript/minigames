'use strict';
/* fiesta-director.js (M1, doc 07 §5.3/§7, doc 09 §9.3): director del tablero en vivo.
   Partidas REALES del reductor (fiesta-reglas + fiesta-cpu) generan la secuencia de boards por `ver`; el director los recibe
   en orden, con pérdidas, duplicados y desorden, y debe converger a hash(D) === hash(S) en reposo.
   node --test test/fiesta-director.test.js */
const test = require('node:test'), assert = require('node:assert/strict');
const R = require('../docs/style-lab/fiesta-reglas.js');
const CPU = require('../docs/style-lab/fiesta-cpu.js');
const RNG = require('../docs/style-lab/fiesta-rng.js');
const DIR = require('../docs/style-lab/fiesta-director.js');
const T0 = 1e12;
const J = x => JSON.parse(JSON.stringify(x));

/* Juega una partida con el reductor y devuelve TODOS los boards (uno por ver, como los guardaría el servidor).
   esc: {humanos, dormido, toma, volver, cfg} — los humanos juegan con la política de CPU (como fiesta-sim.test.js). */
function partida(seed, esc = {}) {
  const as = []; for (let i = 0; i < (esc.humanos || 0); i++) as.push({ name: 'H' + i });
  let now = T0, { S, priv } = R.crear(seed, esc.cfg || {}, as, now), pasos = 0, tomado = false, volvio = false;
  const lr = RNG.crear(seed * 31 + 7), boards = [J(S)];
  function paso(r) {
    if (r.error) throw new Error('reductor: ' + r.error + ' f=' + S.f);
    if (r.nada || r.dup) return;
    assert.equal(r.S.ver, S.ver + 1);
    S = r.S; priv = r.priv; boards.push(J(S));
  }
  while (S.f !== 'fin') {
    if (++pasos > 8000) throw new Error('bucle');
    if (esc.toma && !tomado && S.r >= 2 && S.f === 'turno') { tomado = true; paso(R.aplicar(S, priv, '$', { t: 'TOMAR_ASIENTO', s: esc.toma, name: 'NUEVO' }, now)); continue; }
    if (esc.volver && !volvio && S.r >= 3 && S.pj[esc.dormido].cpu === 'afk') { volvio = true; paso(R.aplicar(S, priv, esc.dormido, { t: 'VOLVER', aid: 'v1' }, now)); continue; }
    let hizo = false;
    for (const s of Object.keys(S.pj)) {
      if (S.pj[s].cpu !== null || s === esc.dormido) continue;
      const v = R.vista(S, s); if (!v.mio && !v.listo) continue;
      const a = CPU.decide(S, v, s, lr); if (!a) continue; a.aid = s + ':' + pasos;
      paso(R.aplicar(S, priv, s, a, now)); hizo = true; break;
    }
    if (hizo) continue;
    if (S.f === 'mj') { paso(R.aplicar(S, priv, '$', { t: 'MJ_RESULTADO', k: S.mj.k, i: S.mj.i, sc: S.mj.as.map(() => lr.int(0, 20)) }, now)); continue; }
    now = Math.max(now, S.nextAt != null ? S.nextAt : now);
    const r = R.tick(S, priv, now); if (r.nada) { now += 250; continue; } paso(r);
  }
  return boards;
}
const room = b => ({ code: 'ABCD', mode: 'fiesta', ver: b.ver, board: J(b) });   // como llega por SSE/sondeo
function hastaReposo(d, dt = 50, tope = 200000) {
  let g = 0; d.update(0);
  while (!d.isIdle()) { d.update(dt); if (++g > tope) throw new Error('el director no llega al reposo (ver ' + d.ver() + '/' + d.target() + ')'); }
  d.update(0);
  return g;
}
function kindsDe(boards) { const k = new Set(); for (const b of boards.slice(1)) for (const f of b.fx[b.fx.length - 1].fx) k.add(f.k); return k; }

// Cache de partidas (son deterministas).
let _A = null, _B = null;
const juegoA = () => _A || (_A = partida(11, {}));                                                  // 4 CPU, 15 rondas
const juegoB = () => _B || (_B = partida(5, { humanos: 2, dormido: 'b', volver: true, toma: 'd', cfg: { tot: 8 } }));

function reproducirEnOrden(boards, opts = {}) {
  const pasos = new Set(), d = DIR.create(Object.assign({ onStep: p => pasos.add(p.k) }, opts));
  let idles = 0;
  for (const b of boards) {
    d.push(room(b));
    hastaReposo(d);
    assert.equal(d.ver(), b.ver);
    assert.equal(d.hash(), R.hash(b), 'hash(D) == hash(S) en reposo, ver ' + b.ver);
    // mientras anima, el estado es legible y finito
    idles++;
  }
  return { d, pasos, idles };
}

test('partida real 4 CPU: cada lote se anima en orden, sin saltos ni desync, y en reposo hash(D) == hash(S)', () => {
  const boards = juegoA();
  assert.equal(boards[boards.length - 1].f, 'fin');
  const kinds = kindsDe(boards);
  for (const k of ['dado', 'hop', 'mon', 'est', 'obj', 'pasa', 'estrellaMueve', 'turno', 'ronda', 'mjIni', 'mjRes', 'fin', 'bonus', 'set', 'ver'])
    assert.ok(kinds.has(k), 'la partida produce ' + k);
  const { d, pasos } = reproducirEnOrden(boards);
  for (const k of kinds) assert.ok(pasos.has(k), 'el director animó ' + k);
  const st = d.stats();
  assert.equal(st.desync, 0); assert.equal(st.saltos, 0); assert.equal(st.lotes, boards.length - 1);
  assert.equal(d.D.board.f, 'fin');
});

test('partida con humanos, AFK, VOLVER y toma de asiento: afk/vuelve/llega también se animan y convergen', () => {
  const boards = juegoB();
  const kinds = kindsDe(boards);
  for (const k of ['afk', 'vuelve', 'llega', 'ruleta']) assert.ok(kinds.has(k), 'la partida produce ' + k);
  const { d, pasos } = reproducirEnOrden(boards, { yo: 'a' });
  for (const k of kinds) assert.ok(pasos.has(k), 'el director animó ' + k);
  assert.equal(d.stats().desync, 0); assert.equal(d.stats().saltos, 0);
});

test('todos los tipos de fx (las dos partidas) recorren el estado de animación sin errores y con valores finitos', () => {
  const boards = juegoA().slice(0, 400);
  const d = DIR.create({ yo: 'a' }); const vistos = new Set();
  for (const b of boards) {
    d.push(room(b)); let g = 0;
    do {
      const D = d.update(37);
      for (const s of Object.keys(D.board.pj)) {
        const p = D.fichas[s]; assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.salto >= 0 && p.salto <= 1, 'ficha ' + s);
        assert.ok(Number.isFinite(D.mon[s]) && Number.isFinite(D.est[s]));
      }
      if (D.paso) { vistos.add(D.paso.k); assert.ok(D.paso.t >= 0 && D.paso.t <= 1); }
      if (D.paso && D.paso.k === 'hop') { const s = D.paso.f.s; assert.ok(D.fichas[s].hop); }
      if (D.paso && D.paso.k === 'mon') { const f = D.paso.f; const v = D.mon[f.s]; assert.ok(v >= Math.min(f.tot - f.d, f.tot) - 1 && v <= Math.max(f.tot - f.d, f.tot) + 1, 'conteo de monedas entre inicio y fin'); }
      if (D.paso && D.paso.k === 'dado') assert.ok(D.dados[D.paso.f.s] && D.dados[D.paso.f.s].cara >= 1);
      if (D.paso && D.paso.k === 'estrellaMueve' && D.paso.t < 0.9) assert.ok(D.estrellas[D.paso.f.i | 0].moving && D.estrellas[D.paso.f.i | 0].i === (D.paso.f.i | 0));
      if (D.estrellas.length) assert.equal(D.estrella, D.estrellas[0].i === 0 ? D.estrellas[0] : null);
      assert.ok(D.toasts.length <= d.K.TOASTS);
      if (++g > 100000) throw new Error('sin reposo');
    } while (!d.isIdle());
    assert.equal(d.hash(), R.hash(b));
  }
  for (const k of ['dado', 'hop', 'mon', 'turno', 'ronda']) assert.ok(vistos.has(k), 'se vio el paso ' + k);
});

test('4 directores con entrega con pérdidas, duplicados y desorden convergen al mismo hash en reposo', () => {
  const boards = juegoA().slice(0, 600), final = boards[boards.length - 1];
  const resultados = [];
  for (let c = 0; c < 4; c++) {
    const r = RNG.crear(1000 + c), d = DIR.create({ yo: 'abcd'[c] });
    let t = 0, cola = [];
    for (const b of boards) {
      const lote = b.fx.length ? b.fx[b.fx.length - 1].fx : [];
      t += (c < 2 ? R.fxMs(lote) : 0) + r.int(0, 400);      // 0-1: ritmo real (el servidor suma fxMs a los plazos); 2-3: ráfagas
      if (r.next() < 0.25) continue;                        // perdido (SSE caído)
      const veces = r.next() < 0.2 ? 2 : 1;                 // duplicado (SSE + sondeo)
      for (let i = 0; i < veces; i++) cola.push({ at: t + r.int(0, 900), b });   // desorden: retraso variable
    }
    cola.sort((x, y) => x.at - y.at);
    let reloj = 0, ok = 0;
    for (const m of cola) {
      while (reloj < m.at) { d.update(Math.min(33, m.at - reloj)); reloj += Math.min(33, m.at - reloj);
        if (d.isIdle() && d.board()) { assert.equal(d.hash(), d.hashS(), 'en reposo D == S (dir ' + c + ')'); ok++; } }
      d.push(room(m.b));
    }
    d.push(room(final));                                     // el sondeo garantiza que el último llega
    hastaReposo(d, 33);
    assert.equal(d.ver(), final.ver);
    assert.equal(d.stats().desync, 0, 'nunca hubo desync (los saltos sí se permiten)');
    assert.ok(ok > 0);
    resultados.push({ h: d.hash(), st: d.stats() });
  }
  const h = R.hash(final);
  for (const x of resultados) assert.equal(x.h, h);
  assert.ok(resultados.some(x => x.st.dup + x.st.viejos > 0), 'hubo duplicados/viejos');
  assert.ok(resultados.every(x => x.st.dup + x.st.viejos > 0), 'todos recibieron duplicados/viejos');
  assert.ok(resultados[0].st.pasos > 1000 && resultados[1].st.pasos > 1000, 'a ritmo real casi todo se anima');
  assert.ok(resultados[2].st.saltos > 0, 'en ráfaga hay saltos de atraso');
});

test('orden y deduplicación: un board viejo o repetido no retrocede; uno viejo aporta su anillo si falta un lote', () => {
  const boards = juegoA();
  const d = DIR.create({});
  assert.equal(d.push(room(boards[10])), 'nuevo'); hastaReposo(d);
  assert.equal(d.push(room(boards[10])), 'dup');
  assert.equal(d.push(room(boards[9])), 'viejo');
  assert.equal(d.ver(), boards[10].ver);
  assert.equal(d.push(null), 'nulo'); assert.equal(d.push({ board: null }), 'nulo');
  // llega 13 y luego 12 (desordenados): el anillo de 13 ya trae 11..13, se anima todo sin salto
  d.push(room(boards[13])); d.push(room(boards[12])); hastaReposo(d);
  assert.equal(d.ver(), boards[13].ver); assert.equal(d.stats().saltos, 0); assert.equal(d.hash(), R.hash(boards[13]));
});

test('resync: si el anillo ya no trae el lote siguiente, espera gapMs y salta a S con «Mientras no estabas…»', () => {
  const boards = juegoA();
  const skips = []; const d = DIR.create({ gapMs: 300, maxV: 1000, maxMs: 1e9, onSkip: x => skips.push(x) });
  d.push(room(boards[20])); hastaReposo(d);
  const b = J(boards[40]); b.fx = b.fx.filter(x => x.v >= 38);   // el anillo perdió 22..37
  d.push(room(b));
  d.update(100); assert.ok(!d.isIdle()); assert.equal(d.ver(), boards[20].ver, 'todavía espera el hueco');
  d.update(250);
  assert.equal(d.stats().saltos, 1); assert.equal(skips[0].why, 'hueco');
  assert.equal(d.ver(), boards[40].ver); assert.equal(d.hash(), R.hash(boards[40]));
  assert.ok(d.skipping()); assert.ok(d.D.resumen && d.D.resumen.lines.length > 0);
  assert.ok(d.isIdle());
  d.update(5000); assert.ok(!d.skipping()); assert.equal(d.D.resumen, null);
  // si el lote faltante llega desordenado dentro de gapMs, no hay salto
  const d2 = DIR.create({ gapMs: 300 });
  d2.push(room(boards[50])); hastaReposo(d2);
  const c = J(boards[53]); c.fx = c.fx.filter(x => x.v >= boards[53].ver);
  d2.push(room(c)); d2.update(100);
  d2.push(room(boards[52])); hastaReposo(d2);
  assert.equal(d2.stats().saltos, 0); assert.equal(d2.ver(), boards[53].ver); assert.equal(d2.hash(), R.hash(boards[53]));
});

test('atraso: más de maxV versiones o más de maxMs de cola ⇒ salto sin animación; la velocidad sube con la cola', () => {
  const boards = juegoA();
  const d = DIR.create({ maxV: 6 });
  d.push(room(boards[30])); hastaReposo(d);
  d.push(room(boards[38]));                                   // 8 pendientes > 6
  assert.equal(d.stats().saltos, 1); assert.equal(d.ver(), boards[38].ver); assert.ok(d.skipping());
  hastaReposo(d); assert.equal(d.hash(), R.hash(boards[38]));
  // velocidad: 1 pendiente ×1, 2-3 ×2, más ×3; tocar ×3
  const v = DIR.create({ maxV: 100, maxMs: 1e9 });
  v.push(room(boards[60])); hastaReposo(v);
  v.push(room(boards[61])); assert.equal(v.speed(), 1);
  v.push(room(boards[63])); assert.equal(v.speed(), 2);
  v.push(room(boards[66])); assert.equal(v.speed(), 3);
  v.tap(); assert.equal(v.speed(), 9);
  hastaReposo(v); assert.equal(v.stats().saltos, 0); assert.equal(v.hash(), R.hash(boards[66]));
  // por tiempo: con maxMs chico, la cola detrás del lote en curso dispara el salto
  let i = 70; while (R.fxMs(boards[i + 1].fx[boards[i + 1].fx.length - 1].fx) + R.fxMs(boards[i + 2].fx[boards[i + 2].fx.length - 1].fx) < 1500) i++;
  const w = DIR.create({ maxMs: 400, maxV: 100 });
  w.push(room(boards[i - 1])); hastaReposo(w);
  w.push(room(boards[i + 2])); w.update(16);
  assert.equal(w.stats().saltos, 1); assert.equal(w.ver(), boards[i + 2].ver); assert.equal(w.hash(), R.hash(boards[i + 2]));
  // skip manual (startAt-3000 del minijuego) y serverNow inyectado
  const m = DIR.create({ maxV: 100, maxMs: 1e9, serverNow: () => 5000 });
  const mb = boards.findIndex((b, j) => j > 0 && b.f === 'mj' && b.mj && b.mj.startAt);
  m.push(room(boards[mb - 3])); hastaReposo(m);
  const fake = J(boards[mb]); fake.mj.startAt = 7000;          // serverNow 5000 ≥ 7000-3000
  m.push(room(fake)); m.update(16);
  assert.equal(m.ver(), boards[mb].ver); assert.equal(m.stats().saltos, 1);
});

test('aviso: aparece solo cuando D alcanzó la versión que lo creó, nunca uno viejo, y la cola no lo espera', () => {
  const boards = juegoB();
  const evs = []; const d = DIR.create({ yo: 'a', onPrompt: (v, esp) => evs.push({ v, esp, ver: d.ver() }) });
  let vistos = 0;
  for (let i = 0; i < boards.length; i++) {
    const b = boards[i];
    d.push(room(b));
    d.update(0);
    const p = d.prompt();
    if (p && p.esp) { assert.ok(d.ver() >= p.esp.id, 'el aviso no se adelanta a la animación'); assert.equal(p.esp.id, b.esp.id, 'nunca un aviso viejo'); }
    hastaReposo(d);
    const q = d.prompt(), v = R.vista(b, 'a');
    if (v.mio) { assert.ok(q && q.mio, 'en reposo, mi aviso visible (ver ' + b.ver + ')'); vistos++; }
    else if (!v.listo) assert.equal(q, null);
  }
  assert.ok(vistos > 5);
  assert.ok(evs.length > 5 && evs.some(e => e.v === null), 'onPrompt avisa al aparecer y al irse');
  for (const e of evs) if (e.esp) assert.ok(e.ver >= e.esp.id || e.v.listo);
  // un aviso que S ya superó desaparece en cuanto llega el board nuevo, aunque la animación siga
  const i = boards.findIndex((b, j) => j > 5 && b.esp && b.esp.s === 'a' && b.esp.k === 'DADO' && boards[j + 1] && !(boards[j + 1].esp && boards[j + 1].esp.s === 'a'));
  const e = DIR.create({ yo: 'a' }); e.push(room(boards[i])); hastaReposo(e);
  assert.ok(e.prompt()); e.push(room(boards[i + 1])); e.update(0); assert.equal(e.prompt(), null);
});

test('eventos cosméticos locales: se secuencian con la cola, no tocan el tablero y el dado local gira hasta el fx', () => {
  const boards = juegoA();
  const orden = []; const d = DIR.create({ yo: 'a', onStep: p => orden.push(p.local ? 'L:' + p.k : p.v - 1) });
  d.push(room(boards[40])); hastaReposo(d);
  d.push(room(boards[41]));
  d.local({ k: 'banner', ms: 500, txt: '¡TE TOCA, PANA!' });
  d.push(room(boards[42]));
  hastaReposo(d);
  const li = orden.indexOf('L:banner');
  assert.ok(li > 0 && orden.slice(0, li).every(x => x === 41) && orden.slice(li + 1).every(x => x === 42), 'local entre el lote 41 y el 42: ' + orden.join(','));
  assert.equal(d.hash(), R.hash(boards[42]));
  // dado local
  const j = boards.findIndex((b, k) => k > 0 && b.fx[b.fx.length - 1].fx.some(f => f.k === 'dado' && f.s === 'a' && f.de !== 'orden'));
  const e = DIR.create({ yo: 'a' }); e.push(room(boards[j - 1])); hastaReposo(e);
  e.rollLocal(); e.update(16); assert.ok(e.dice('a') && e.dice('a').rolling && e.dice('a').local);
  e.push(room(boards[j])); e.update(16);
  const dd = e.dice('a'); assert.ok(dd && !dd.local, 'el fx dado reemplaza al giro local');
  const vd = boards[j].fx[boards[j].fx.length - 1].fx.find(f => f.k === 'dado').v;
  let cayo = false; for (let g = 0; g < 1000 && !e.isIdle(); g++) { e.update(20); const x = e.dice('a'); if (x && !x.rolling) { assert.equal(x.cara, vd); assert.equal(x.v, vd); cayo = true; } }
  assert.ok(cayo, 'el dado cae en el valor del fx'); hastaReposo(e);
  // sin fx, el giro local se apaga solo
  const g = DIR.create({ yo: 'a' }); g.push(room(boards[5])); hastaReposo(g); g.rollLocal(); g.update(16); assert.ok(g.dice('a'));
  g.update(g.K.ROLL_MS + 10); assert.equal(g.dice('a'), null);
});

test('reloj inyectado: update() sin dt usa opts.clock; sin board no falla', () => {
  let t = 0; const d = DIR.create({ clock: () => t });
  assert.ok(d.isIdle()); d.update(); assert.equal(d.D.board, null);
  const boards = juegoA(); d.push(room(boards[3])); d.update(); d.push(room(boards[4]));
  let g = 0; while (!d.isIdle()) { t += 40; d.update(); if (++g > 10000) throw new Error('sin reposo'); }
  assert.equal(d.hash(), R.hash(boards[4])); assert.ok(d.now() > 0);
  d.reset(); assert.equal(d.board(), null); assert.equal(d.ver(), -1);
});

test('desync defensivo: si el anillo trae un lote inconsistente, en reposo D = S y onDesync', () => {
  const boards = juegoA(), des = [];
  const d = DIR.create({ onDesync: x => des.push(x) });
  d.push(room(boards[100])); hastaReposo(d);
  const b = J(boards[101]); b.fx[b.fx.length - 1].fx = b.fx[b.fx.length - 1].fx.filter(f => f.k === 'ver');   // lote mutilado
  d.push(room(b)); hastaReposo(d);
  assert.equal(des.length, 1); assert.equal(d.hash(), R.hash(boards[101])); assert.equal(d.stats().desync, 1);
});

test('dos estrellas: D.estrellas lista ambas, la mudanza anima SOLO la del índice i y el toast dice de dónde sale', () => {
  const { S } = R.crear(5, {}, [{ name: 'H0' }], T0);
  assert.ok(S.estrella.b && S.estrella.b !== S.estrella.nodo);
  const d = DIR.create({ yo: 'a', clock: () => 0 });
  d.push(room(S)); let D = d.update(10);
  assert.equal(D.estrellas.length, 2); assert.equal(D.estrella, D.estrellas[0]);
  assert.deepEqual(D.estrellas.map(e => e.i), [0, 1]); assert.ok(D.estrellas.every(e => !e.moving && e.precio === S.estrella.precio));
  // partida real: cada mudanza anima SOLO la estrella de su índice i, y con dos estrellas el toast nombra el origen
  const vistos = { 0: 0, 1: 0 }, dr = DIR.create({ yo: 'a' });
  for (const b of juegoA()) {
    dr.push(room(b)); let g = 0;
    do { const X = dr.update(37), p = X.paso;
      if (p && p.k === 'estrellaMueve' && p.t < 0.9) { const i = p.f.i; vistos[i]++;
        assert.ok(X.estrellas[i].moving && X.estrellas[i].de === p.f.de && X.estrellas[i].nodo === p.f.a);
        assert.equal(X.estrellas[1 - i].moving, false, 'la otra estrella no se mueve'); }
      if (++g > 100000) throw new Error('sin reposo'); } while (!dr.isIdle());
  }
  assert.ok(vistos[0] > 0 && vistos[1] > 0, 'se mudaron ambas estrellas: ' + JSON.stringify(vistos));
  // una sola estrella (cfg.estrellas=1): lista de 1 y toast clásico
  const U = R.crear(5, { estrellas: 1 }, [{ name: 'H0' }], T0).S; assert.equal(U.estrella.b, null);
  const d1 = DIR.create({ yo: 'a', clock: () => 0 }); d1.push(room(U)); const D1 = d1.update(10);
  assert.equal(D1.estrellas.length, 1); assert.equal(D1.estrella, D1.estrellas[0]);
});
