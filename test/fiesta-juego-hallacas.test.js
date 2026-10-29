'use strict';
/* LA FIESTA · f_hallacas (2v2, modelo B, masero + amarrador): reglas, CPU, balance, dibujo, dos pantallas sin red y SOBRE EL STACK REAL
   (fiesta-net + fiesta-live + party.js/party_mj.js detrás de memRelay con retardo, jitter y 5 % de pérdida; arnés test/helpers/live-arnes.js, `tipo:'2v2'`).
   El catálogo compartido aún no trae `live:1` ni `lim` para f_hallacas: ESTA prueba los pone EN MEMORIA (no toca el archivo) antes de registrar el juego.
   node --test test/fiesta-juego-hallacas.test.js        (LIVE_FULL=1: 200 semillas también en la red) */
process.env.LIVE_DBG = '1';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const A = require('./helpers/live-arnes.js');
const { arnes, LIVE, CAT, R0 } = A;
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-hallacas.js');
const REGLAS = require('../docs/style-lab/fiesta-reglas.js');
const LIM = { scoreMax: 16, scoreRate: 0.45, minT: 44, finTemprano: 0 };
for (const C of [CAT, REGLAS.CATALOGO.reduce((o, x) => { o[x.g] = x; return o; }, {}), R0.CATALOGO.reduce((o, x) => { o[x.g] = x; return o; }, {})]) { C.f_hallacas.live = 1; C.f_hallacas.lim = Object.assign({}, LIM); }   // el stub del catálogo (la línea real la pone quien edita fiesta-reglas.js)
require(SRC);
const B = require('../docs/style-lab/pruebas/fiesta-hallacas-bench.js');
const G = 'f_hallacas', DEF = LIVE.get(G), unico = (a) => a.filter((x, i) => a.indexOf(x) === i);
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED;
const { mkCtx, cuadro, jugar, gana } = B;
const clampSrv = (v, dur) => Math.min(LIM.scoreMax, Math.floor(LIM.scoreRate * (dur + 1.5)), v);     // lo que party_mj.clampSc deja pasar a tiempo completo

/* ───────── jugadores «humanos» guionados (leen vista(); usan hold/press/eje como el runtime) ───────── */
const DV = [[-1, 0], [1, 0], [0, -1], [0, 1]], PH6 = {};   // PH6: el guion suelta el stick un cuadro al entrar a la 2.ª acción (el juego pide stick neutro antes del empujón)
const empuja = (key, p, v, api, d) => { if (PH6[key] !== v.ph[p]) { PH6[key] = v.ph[p]; api.eje(0, 0); } else api.eje(DV[d][0], DV[d][1]); };
const masero = (opt) => (st, p, dt, api) => {
  opt = opt || {}; const v = st.g.vista(), ph = v.ph[p], tg = v.ord[v.n[p]];
  if (ph === 1) { if (v.v[p] / 100 >= tg + (opt.off || 0) - 0.008) api.hold('a', false); else api.hold('a', true); }
  else if (ph === 6) { api.hold('a', false); empuja('m' + p, p, v, api, v.dir[v.n[p]]); }
  else { PH6['m' + p] = ph; api.eje(0, 0); if (ph === 0) api.hold('a', Math.floor(st.gt * 30) % 2 === 0); else api.hold('a', false); }
};
const amarrador = (opt) => (st, p, dt, api) => {
  opt = opt || {}; const v = st.g.vista(), ph = v.ph[p]; if (ph !== 6 && ph !== 1) PH6['a' + p] = ph;
  if (ph === 1) {
    const s = v.spot(v.n[p]), dx = s[0] + (opt.dx || 0) - v.x[p], dy = s[1] - v.y[p];
    api.eje(Math.max(-1, Math.min(1, dx / 10)), Math.max(-1, Math.min(1, dy / 10)));
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) { api.eje(0, 0); api.press('a'); }
  } else if (ph === 2) {
    api.eje(0, 0);
    const k = v.v[p], mal = opt.falla && v.knN[p] < opt.falla;
    if (v.gt >= v.lock[p] && (mal ? (k < 8 || k > 92) : Math.abs(k - 50) <= (opt.tol || 4))) api.press('a');
  } else if (ph === 6) empuja('a' + p, p, v, api, v.dirA[v.n[p]]);
  else api.eje(0, 0);
};
const idle = 'idle';

test('registro: paridad con el catálogo (2v2, B, binary, lim) y ficha de controles', () => {
  assert.ok(DEF); assert.equal(DEF.modelo, CAT[G].mo); assert.equal(DEF.clase, CAT[G].cl); assert.deepEqual(DEF.modos, CAT[G].m); assert.equal(DEF.dur, CAT[G].dur);
  ['scoreMax', 'scoreRate', 'minT'].forEach((k) => assert.equal(DEF.limites[k], CAT[G].lim[k])); assert.equal(!!DEF.limites.finTemprano, !!CAT[G].lim.finTemprano);
  assert.equal(DEF.stick, true); assert.equal(DEF.botones, 2); assert.ok(DEF.cuerpo.length >= 8 && DEF.discretos.every((f) => DEF.cuerpo.indexOf(f) >= 0));
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 1);
  assert.equal(typeof DEF.perilla.TOL_MASA, 'number');
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, sin tipos x* (todo viaja en el cuerpo), una sola perilla', () => {
  const raw = fs.readFileSync(SRC, 'utf8'), s = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath|rect)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /\bclass\b/, /=>/, /`/, /#\w+\s*[=;(]/])
    assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.(send|on)\(/.test(s), 'sin mensajes x*'); assert.deepEqual(Object.keys(DEF.perilla), ['TOL_MASA']);
  const prim = (s.match(/\b(rr|ell|line|poly|txt|bust)\(/g) || []);
  assert.ok(prim.length > 30);
  const ext = (s.match(/\b(fillRect|strokeRect|drawImage|fillText|createLinearGradient|beginPath|arcTo|quadraticCurveTo|bezierCurveTo)\b/g) || []); assert.equal(ext.length, 0);
});

test('determinismo: misma semilla => mismo resultado y mismo hash; los dos equipos reciben los MISMOS pedidos y marcas (sin ventaja de suerte)', () => {
  const a = LIVE.sim(G, { tipo: '2v2', seed: 7, lv: 2, skill: 0.6 }), b = LIVE.sim(G, { tipo: '2v2', seed: 7, lv: 2, skill: 0.6 }), c2 = LIVE.sim(G, { tipo: '2v2', seed: 8, lv: 2, skill: 0.6 });
  assert.deepEqual(a.sc, b.sc); assert.equal(a.h, b.h); assert.notEqual(a.h, c2.h);
  const st = mkCtx(DEF, { lv: 2, seed: 4 }), v = st.g.vista(); assert.ok(unico(v.ord).length === 2, 'lv2: dos tamaños'); assert.equal(v.mas[0], 0); assert.equal(v.amar[0], 1); assert.equal(v.mas[1], 2); assert.equal(v.amar[1], 3);
  const s1 = mkCtx(DEF, { lv: 1, seed: 9 }).g.vista(); assert.deepEqual(unico(s1.ord), [0.6], 'lv1: un solo tamaño');
});

test('masero: soltar en la franja verde da masa buena (+1), fuera da mala (0); un toque corto no cuenta; la cinta se llena a 3', () => {
  let st = mkCtx(DEF, { lv: 1, seed: 1 }); jugar(st, [masero(), idle, idle, idle], 14);
  let v = st.g.vista(); assert.equal(v.n[0], 3, 'cinta de 3 puestos: se detiene'); assert.equal(v.sc[0], 3, 'tres masas perfectas'); assert.equal(v.ph[0], 4, 'estación bloqueada: cinta llena'); assert.equal(v.sc[1], 0);
  st = mkCtx(DEF, { lv: 1, seed: 1 }); jugar(st, [masero({ off: 0.2 }), idle, idle, idle], 14);   // se pasa 0,2: fuera de ±0,10
  v = st.g.vista(); assert.ok(v.n[0] >= 3); assert.equal(v.sc[0], 0, 'masas malas no puntúan (la cinta se vacía sola: el amarrador las tira)'); assert.equal(v.sc[1], 0);
  st = mkCtx(DEF, { lv: 1, seed: 1 }); st.gt = 1;
  const api = B.apiDe(st, 0); api.hold('a', true); cuadro(st, []); api.hold('a', false); cuadro(st, []); cuadro(st, []);
  assert.equal(st.g.vista().n[0], 0, 'un toque corto (<0,1 de masa) se cancela'); assert.equal(st.g.vista().ph[0], 0);
});

test('amarrador: guiso + nudos al ritmo = +1; con 2 errores = -1 pero el marcador nunca baja de 0; la masa mala se tira sin puntuar', () => {
  let st = mkCtx(DEF, { lv: 1, seed: 2 }); jugar(st, [masero(), amarrador(), idle, idle], 40);
  let v = st.g.vista(); assert.ok(v.sc[1] >= 6, 'amarra casi todo: ' + v.sc[1]); assert.ok(v.st[1][1] >= 6 && v.st[1][2] === 0, JSON.stringify(v.st[1])); assert.equal(v.sc[0], v.st[0][0]);
  st = mkCtx(DEF, { lv: 1, seed: 2 }); jugar(st, [masero(), amarrador({ falla: 2 }), idle, idle], 40);   // falla los dos primeros nudos de cada hoja => 2 errores => mal amarrada
  v = st.g.vista(); assert.ok(v.st[1][2] >= 3, 'hay mal amarradas: ' + JSON.stringify(v.st[1])); assert.ok(v.pts[1] < 0 || v.sc[1] === 0); assert.equal(v.sc[1], Math.max(0, v.pts[1]), 'mínimo 0');
  st = mkCtx(DEF, { lv: 1, seed: 2 }); jugar(st, [masero({ off: 0.25 }), amarrador(), idle, idle], 30);   // todas las masas malas
  v = st.g.vista(); assert.equal(v.sc[0], 0); assert.equal(v.sc[1], 0, 'masa mala: se tira, no suma ni resta'); assert.ok(v.st[1][3] >= 5, 'tiró varias: ' + JSON.stringify(v.st[1]));
});

test('NINGUNO CARGA SOLO CON EL EQUIPO: masero ocioso => equipo en 0; amarrador ocioso => el masero se frena en 3; el equipo completo gana a ambos', () => {
  for (const lv of [1, 2, 3]) for (let seed = 1; seed <= 20; seed++) {
    let st = mkCtx(DEF, { lv, seed }); let sc = jugar(st, [idle, amarrador(), 'cpu', 'cpu']);
    assert.deepEqual(sc.slice(0, 2), [0, 0], `lv${lv} s${seed}: masero ocioso => nada para amarrar`); assert.ok(gana(st).puestos[0] === 2 && sc[2] + sc[3] >= 8, `lv${lv} s${seed}: gana el rival ${sc}`);
    st = mkCtx(DEF, { lv, seed }); sc = jugar(st, ['cpu', idle, 'cpu', 'cpu']);
    assert.ok(sc[0] <= 3 && sc[1] === 0, `lv${lv} s${seed}: amarrador ocioso => masero <=3 (${sc})`); assert.equal(gana(st).puestos[0], 2, `lv${lv} s${seed}: pierde`);
    st = mkCtx(DEF, { lv, seed }); sc = jugar(st, [idle, idle, 'cpu', 'cpu']); assert.deepEqual(sc.slice(0, 2), [0, 0]);
  }
});

test('B = ayuda: el ayudante queda congelado 0,5 s, el pana gana +70 % de tolerancia 0,5 s, enfriamiento 2,2 s, y solo si el pana existe', () => {
  const st = mkCtx(DEF, { lv: 1, seed: 3 }); st.gt = 1; const a1 = B.apiDe(st, 1);
  a1.press('b'); cuadro(st, []); assert.equal(st.g.vista().hb[1], 1); assert.equal(st.g.vista().ph[1], 7, 'ayudando');
  a1.press('b'); cuadro(st, []); assert.equal(st.g.vista().hb[1], 1, 'enfriamiento: la 2.ª se ignora');
  for (let i = 0; i < 17; i++) cuadro(st, []); assert.equal(st.g.vista().ph[1], 0, 'tras 0,5 s vuelve a su estación');
  for (let i = 0; i < 90; i++) cuadro(st, []); a1.press('b'); cuadro(st, []); assert.equal(st.g.vista().hb[1], 2, 'tras el enfriamiento vuelve a ayudar');
  // masa a +0,14 del pedido: fuera de ±0,10 pero dentro de ±0,17 => buena SOLO si el pana ayuda en esa ventana
  const prueba = (ayuda) => {
    const S = mkCtx(DEF, { lv: 1, seed: 3 }); S.gt = 1; const m = B.apiDe(S, 0), a = B.apiDe(S, 1), tg = S.g.vista().ord[0]; let guard = 0;
    m.hold('a', true);
    while (S.g.vista().v[0] / 100 < tg - 0.05 && guard++ < 400) cuadro(S, []);
    if (ayuda) a.press('b');
    while (S.g.vista().v[0] / 100 < tg + 0.14 && guard++ < 800) cuadro(S, []);
    m.hold('a', false); cuadro(S, []); cuadro(S, []); const d = DV[S.g.vista().dir[0]]; m.eje(d[0], d[1]); for (let i = 0; i < 15; i++) cuadro(S, []); return S.g.vista().sc[0];   // luego el empujón del stick (2.ª acción)
  };
  assert.equal(prueba(false), 0, 'sin ayuda, +0,14 es mala'); assert.equal(prueba(true), 1, 'con ayuda, +0,14 cuenta como buena');
  // sin pana (equipo de un solo asiento) la B no hace nada ni lanza
  const solo = mkCtx(DEF, { n: 2, lv: 1, seed: 3, equipos: [0, 1] }); solo.gt = 1; B.apiDe(solo, 0).press('b'); cuadro(solo, []); assert.equal(solo.g.vista().hb[0], 0);
});

test('fin: los últimos 0,9 s no se acepta nada (FREEZE) y los puntajes quedan fijos', () => {
  const st = mkCtx(DEF, { lv: 1, seed: 5 }); const modos = ['cpu', 'cpu', 'cpu', 'cpu'];
  jugar(st, modos, 44.0); const s0 = st.g.scores().join(), n0 = st.g.vista().n.join();
  jugar(st, modos, 46); assert.equal(st.g.scores().join(), s0); assert.equal(st.g.vista().n.join(), n0); assert.ok(st.g.vista().ph.every((x) => x === 8));
});

test('CPU: las 4 juegan de verdad (ningún asiento ocioso), entregan y amarran, y ayudan con B a veces', () => {
  let ayudas = 0;
  for (const lv of [1, 2, 3]) for (let seed = 1; seed <= 30; seed++) {
    const r = LIVE.sim(G, { tipo: '2v2', seed, lv, skill: 0.6 }), v = r.vista;
    for (let p = 0; p < 4; p++) assert.ok(v.n[p] >= 6, `lv${lv} s${seed} asiento ${p} procesó ${v.n[p]}`);
    assert.ok(v.sc[0] >= 4 && v.sc[2] >= 4, 'masero con masa buena'); assert.ok(v.sc[1] + v.sc[3] >= 4, 'se amarra');
    ayudas += v.hb.reduce((a, b) => a + b, 0);
  }
  assert.ok(ayudas > 30, 'la CPU usa B (' + ayudas + ' ayudas en 90 partidas)');
});

test('límites: enteros >=0, dentro de scoreMax y scoreRate·(t+1,5), sin recorte del servidor, con dur 3 / 8 / 12 / defecto, 200 semillas, 3 niveles', () => {
  for (const dur of [3, 8, 12, undefined]) for (const lv of [1, 2, 3]) {
    const D = dur || DEF.dur, tope = Math.floor(Math.min(LIM.scoreMax, LIM.scoreRate * (D + 1.5))); let mx = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = LIVE.sim(G, { tipo: '2v2', seed, lv, dur, skill: 0.4 + (seed % 5) * 0.12 });
      assert.ok(r.fin, 'hubo veredicto');
      r.sc.forEach((v) => { assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `dur${D} lv${lv} s${seed}: ${v} > ${tope}`); if (v > mx) mx = v; });
      assert.deepEqual(r.sc.map((v) => clampSrv(v, D)), r.sc, 'el servidor no recortaría nada (aj=false)');
    }
    if (D === DEF.dur) assert.ok(mx <= 16);
  }
});

test('veredicto SOLO por compara: 2v2 suma por equipo, empate real posible, y la ventaja no depende del asiento', () => {
  assert.deepEqual(REGLAS.compara('2v2', [0, 0, 1, 1], [9, 4, 6, 6]).puestos, [1, 1, 2, 2]); assert.deepEqual(REGLAS.compara('2v2', [0, 0, 1, 1], [9, 3, 6, 6]).puestos, [1, 1, 1, 1]);
  const src = fs.readFileSync(SRC, 'utf8'); assert.ok(!/ganaEquipo|ganaSolo|puestos\s*\(/.test(src), 'el juego no decide al ganador');
});

test('BALANCE 2v2 (LIVE.sim, create() real, 4 CPU skill .6): |P(eq0)-P(eq1)| <= 10 pp y empates <= 30 % en 200 semillas por nivel', () => {
  const out = {};
  for (const lv of [1, 2, 3]) {
    const r = B.medir(DEF, { lv, skill: 0.6, N: 200 }); out[lv] = { eq0: r.p0, eq1: r.p1, emp: r.tie, masero: +r.mean[0].toFixed(1), amarrador: +r.mean[1].toFixed(1) };
    assert.ok(Math.abs(r.p0 - r.p1) <= 0.1, `lv${lv} |${r.p0}-${r.p1}|`); assert.ok(r.tie <= 0.3, `lv${lv} empates ${r.tie}`);
  }
  console.log('  balance 2v2 (skill .6):', JSON.stringify(out));
});

test('habilidad pesa: dos humanos buenos (skill .9) le ganan a dos malos (.3) y un equipo sin masero no existe', () => {
  let f = 0, N = 60;
  for (let seed = 1; seed <= N; seed++) { const st = mkCtx(DEF, { lv: 1 + (seed % 3), seed, skill: [0.9, 0.9, 0.3, 0.3] }); jugar(st, ['cpu', 'cpu', 'cpu', 'cpu']); if (gana(st).puestos[0] === 1 && gana(st).puestos[2] === 2) f++; }
  assert.ok(f / N >= 0.85, 'gana el fuerte ' + f + '/' + N);
});

test('un humano con entradas humanas (guionado) contra CPU de skill .6: el guion perfecto gana casi siempre', () => {
  let w = 0, N = 30;
  for (let seed = 1; seed <= N; seed++) { const st = mkCtx(DEF, { lv: 1, seed }); jugar(st, [masero(), amarrador(), 'cpu', 'cpu']); if (gana(st).puestos[0] === 1) w++; }
  assert.ok(w / N >= 0.8, 'guion perfecto gana ' + w + '/' + N);
});

test('tamaño del cuerpo: 4 cuerpos con los valores máximos caben en un mensaje de 420 B (el juez manda hasta 3)', () => {
  const body = [3, 8, 100, 56, 56, 16, 48, 16777215, 16777215, 99, 511, 400];
  const msg = { q: 0, t: 45000, b: [body, body, body, body] }; assert.ok(JSON.stringify(msg).length <= 420, JSON.stringify(msg).length);
  assert.equal(body.length - 1, DEF.cuerpo.length);
});

test('dibujo: draw() no revienta (gt<0, en juego, fin; 3 niveles; yo = 0..3 y espectador; n=4) y solo usa primitivas del laboratorio', () => {
  const calls = {}; let pjN = 0;
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls[nm] = (calls[nm] || 0) + 1; };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) for (const yo of [-1, 0, 1, 2, 3]) {
    const st = mkCtx(DEF, { lv, seed: 3, yo }); st.c.util.pj = () => { pjN++; };
    for (const gt of [-2, 0.2, 3]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    const modos = ['cpu', 'cpu', 'cpu', 'cpu']; for (const hasta of [9, 22.5, 30, 44.5, 46]) { jugar(st, modos, hasta); st.g.draw(); }
  }
  assert.ok(Object.keys(calls).every((k) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(k))); assert.ok(calls.rr > 500 && calls.txt > 300 && pjN > 50);
  const st2 = mkCtx(DEF, { n: 2, lv: 1 }); st2.gt = 5; st2.g.update(1 / 30); st2.g.draw();      // defensa: n != 4 no lanza
  const st3 = mkCtx(DEF, { n: 4, equipos: [0, 1, 0, 1], lv: 3 }); jugar(st3, ['cpu', 'cpu', 'cpu', 'cpu'], 30); st3.g.draw(); assert.deepEqual(st3.g.vista().mas, [0, 1]);
});

/* ───────── dos pantallas SIN red (modelo B puro): cada una es dueña de sus 2 asientos y ve el cuerpo del otro con retraso y pérdida ───────── */
function dosPantallas(o) {
  const own = o.own || [true, true, false, false], buf = [[], [], [], []], R = require('../docs/style-lab/fiesta-rng.js').crear(o.seed * 7 + 1);
  const mio = (X) => (p) => (X === 0 ? own[p] : !own[p]);
  let X = null, Y = null;
  const rem = (p) => { const b = buf[p]; let r = null; for (const e of b) if (e.t <= X.gt - (o.delay || 0.2)) r = e.v; return r; };
  const mk = (who) => {
    const st = mkCtx(DEF, { lv: o.lv || 1, seed: o.seed, mio: (p) => mio(who)(p), remoto: (p) => (mio(who)(p) ? null : (() => { const b = buf[p]; let r = null; for (const e of b) if (e.t <= (who === 0 ? X : Y).gt - (o.delay || 0.2)) r = e.v; return r; })()) });
    return st;
  };
  X = mk(0); Y = mk(1);
  const t0 = { x: 0, y: 0 }; void t0; void rem;
  let acc = 0, snaps = 0;
  const modos = ['cpu', 'cpu', 'cpu', 'cpu'];
  const paso = (until, evento) => {
    while (X.gt < until) {
      for (const st of [X, Y]) {
        const who = st === X ? 0 : 1;
        for (let p = 0; p < 4; p++) if (mio(who)(p)) { const m = modos[p]; if (m === 'cpu') st.g.ai(p, 1 / 30, B.apiDe(st, p)); }
        st.g.update(1 / 30); st.gt += 1 / 30;
      }
      acc += 1 / 30;
      if (acc >= 1 / 12) {                         // cuerpo a 12 Hz, 5 % de pérdida
        acc = 0; snaps++;
        for (let p = 0; p < 4; p++) { const st = X.c.mio(p) ? X : Y; if (R.next() < (o.loss == null ? 0.05 : o.loss)) continue; buf[p].push({ t: X.gt, v: st.g.cuerpo(p) }); if (buf[p].length > 8) buf[p].shift(); }
      }
      if (evento) evento(X, Y);
    }
  };
  return { X, Y, paso, own, buf };
}
test('dos pantallas (cuerpos con 200 ms de retraso y 5 % de pérdida): al cierre las dos calculan los MISMOS puntajes, en 3 niveles y 8 semillas', () => {
  for (const lv of [1, 2, 3]) for (let seed = 1; seed <= 8; seed++) {
    const D = dosPantallas({ lv, seed }); D.X.gt = D.Y.gt = 0; D.paso(46);
    assert.deepEqual(D.X.g.scores(), D.Y.g.scores(), `lv${lv} s${seed}: ${D.X.g.scores()} vs ${D.Y.g.scores()}`);
    assert.ok(D.X.g.scores()[0] > 0 && D.X.g.scores()[2] > 0 && D.X.g.scores().reduce((a, b) => a + b, 0) >= 12, 'puntúan: ' + D.X.g.scores() + ' lv' + lv + ' s' + seed);
  }
});
test('un humano cae a mitad y el juez lo toma como CPU (alCpu) retomando desde sus contadores: puntajes monótonos y las dos pantallas coinciden', () => {
  for (const [k, seed] of [[9, 1], [20, 2], [33, 3]]) {
    const D = dosPantallas({ lv: 2, seed, own: [true, true, false, false] }); D.X.gt = D.Y.gt = 0;
    let antes = null, hecho = false;
    D.paso(46, (X, Y) => {
      if (!hecho && X.gt >= k) {
        hecho = true; antes = X.g.scores();
        D.own[2] = true;                                    // la pantalla X (el juez) toma el asiento 2
        X.c.mio = (p) => D.own[p]; Y.c.mio = (p) => !D.own[p];
        X.g.alCpu(2);
      }
    });
    assert.ok(hecho); const f = D.X.g.scores();
    f.forEach((v, i) => assert.ok(v >= antes[i], `seed${seed}: sc[${i}] bajó ${antes[i]} -> ${v}`)); assert.ok(f[2] >= antes[2]);
    assert.deepEqual(f, D.Y.g.scores(), 'seed' + seed + ' mismas pantallas');
  }
});
