/* f_chocones (2v2, modelo C): registro, reglas del choque, apagón sembrado, muerte súbita, snapshot, CPU, balance y límites del servidor.
   Contexto falso con control por asiento (docs/style-lab/pruebas/fiesta-chocones-bench.js: mkCtx/tick/jugar) y LIVE.sim (la sesión REAL con 4 CPU).
   El catálogo compartido aún no trae f_chocones: el banco lo inyecta EN MEMORIA (nada compartido se modifica).  SOLO JUGABILIDAD: estilo snes/primitivas, sin capturas.
   node --test test/fiesta-juego-chocones.test.js */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-chocones-bench.js');
const reglas = require('../docs/style-lab/fiesta-reglas.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-chocones.js');
const DEF = B.cargar(), CAT = B.CAT, LIM = B.LIM, LIVE = B.LIVE, CPU4 = B.CPU4;
const mk = (o) => B.mkCtx(DEF, o), tick = (st, m) => B.tick(st, m || [null, null, null, null]);
const V = (st) => st.g.vista();
const G = 7, PS = 8, I = (p) => G + PS * p;                       // pack: [k, golpes, ev, lx, ly, lvx, lvy] + [x4, y4, vx64, vy64, h, tm, sc, hits] por carrito
function edita(st, f) { const a = st.g.pack(); f(a); st.g.restore(a); }
function pon(a, p, o) {                                            // coloca el carrito p (px, px/tick, rumbo en 1/1024 de vuelta)
  const b = I(p);
  if (o.x !== undefined) a[b] = Math.round(o.x * 4); if (o.y !== undefined) a[b + 1] = Math.round(o.y * 4);
  a[b + 2] = Math.round((o.vx || 0) * 64); a[b + 3] = Math.round((o.vy || 0) * 64);
  if (o.h !== undefined) a[b + 4] = o.h; if (o.tm !== undefined) a[b + 5] = o.tm; if (o.sc !== undefined) a[b + 6] = o.sc;
}
const LEJOS = [{ x: 40, y: 40 }, { x: 40, y: 300 }, { x: 560, y: 40 }, { x: 560, y: 300 }];
/* choque de prueba: el atacante a (en 200,170 con vx) contra la víctima v (en 236,170 con rumbo hv); los demás en las esquinas */
function choque(o) {
  const st = mk({ seed: 1, lv: o.lv || 1 }), a = o.a === undefined ? 0 : o.a, v = o.v === undefined ? 2 : o.v;
  edita(st, (pk) => {
    if (o.k !== undefined) pk[0] = o.k;
    for (let p = 0; p < 4; p++) pon(pk, p, Object.assign({ h: 0, tm: 0 }, LEJOS[p]));
    pon(pk, a, { x: o.ax || 200, y: o.ay || 170, vx: o.vx === undefined ? 5 : o.vx, vy: o.vy || 0, h: o.ha || 0, tm: o.atm || 0, sc: o.asc || 0 });
    pon(pk, v, { x: o.bx || 236, y: o.by || 170, h: o.hv || 0, tm: o.vtm || 0 });
  });
  const ha = o.ha || 0; st.in[a].x = o.ain ? o.ain[0] : Math.cos(ha * Math.PI / 512); st.in[a].y = o.ain ? o.ain[1] : Math.sin(ha * Math.PI / 512);   // va con motor hacia su frente
  tick(st, o.modos);
  return st;
}
const cap = (t) => Math.floor(Math.min(LIM.scoreMax, LIM.scoreRate * (t + 1.5)));

test('registro: paridad con el catálogo inyectado (C, binary, 2v2, dur 40) y con sus límites; stick + 1 botón; packN 39', () => {
  assert.equal(DEF.modelo, 'C'); assert.equal(DEF.clase, 'binary'); assert.deepEqual(DEF.modos, ['2v2']); assert.equal(DEF.dur, CAT.dur); assert.equal(DEF.dur, 40);
  assert.equal(CAT.mo, 'C'); assert.equal(CAT.cl, 'binary'); assert.deepEqual(CAT.m, ['2v2']); assert.equal(CAT.live, 1);
  assert.deepEqual(DEF.limites, CAT.lim); assert.deepEqual(DEF.limites, { scoreMax: 30, scoreRate: 1.5, minT: 33, finTemprano: 1 });
  assert.ok(reglas.CATALOGO.some((x) => x.g === 'f_chocones'), 'el banco inyectó la entrada antes de cargar: LIVE.add validó la paridad');
  assert.equal(DEF.botones, 1); assert.equal(DEF.stick, true); assert.equal(DEF.packN, 39); assert.equal(DEF.migra, true);
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 1 && typeof DEF.carta.demos[0].dibuja === 'function');
  for (const j of DEF.packDiscretos) assert.ok(Number.isInteger(j) && j >= 0 && j < DEF.packN);
  for (let p = 0; p < 4; p++) { assert.ok(!DEF.packDiscretos.includes(I(p)) && !DEF.packDiscretos.includes(I(p) + 1), 'las posiciones se interpolan'); }
  assert.equal(LIVE.get('f_chocones'), DEF);
});

test('lint: sin Math.random/Date.now, sin dibujo directo de canvas, ES5 (sin => let const class `), sin tipos de red propios', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /\bclass\b/, /=>/, /\blet\b/, /\bconst\b/, /`/]) assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.(send|on)\(/.test(s), 'f_chocones no necesita mensajes x* (el juez simula todo)');
});

test('golpe por la COLA = 2 (¡POR DETRÁS!), por el COSTADO = 1 (¡TOMA!), de frente = 0; el que pega con el frente se lleva los puntos', () => {
  const cola = choque({ hv: 0 }); assert.deepEqual(V(cola).gs, [2, 0, 0, 0]); assert.equal(V(cola).hits[0], 1); assert.equal(V(cola).rear[0], 1);
  assert.equal(V(cola).ev & 7, 1); assert.equal((V(cola).ev >> 3) & 3, 2); assert.equal((V(cola).ev >> 5) & 7, 2); assert.equal((V(cola).ev >> 8) & 1, 1);
  for (const hv of [256, 768]) { const lado = choque({ hv }); assert.deepEqual(V(lado).gs, [1, 0, 0, 0], 'costado ' + hv); assert.equal(V(lado).rear[0], 0); }
  const frente = choque({ hv: 512 }); assert.deepEqual(V(frente).gs, [0, 0, 0, 0], 'de frente no vale'); assert.equal(V(frente).stun[2], 0, 'ni aturde');
  const diag = choque({ hv: 100 }); assert.deepEqual(V(diag).gs, [2, 0, 0, 0], 'cola en diagonal (±60°) sigue siendo por detrás');
  const r2 = choque({ a: 2, v: 0, hv: 0 }); assert.deepEqual(V(r2).gs, [0, 0, 2, 0], 'simétrico: el rojo le pega al azul');
  assert.ok(V(cola).vx[2] > 2, 'la víctima sale empujada'); assert.ok(V(cola).vx[0] < 2, 'el atacante rebota');
});

test('no vale: de costado o de cola propia (no pega con el frente), lento, ni chocando con tu pana (rebota igual)', () => {
  assert.deepEqual(V(choque({ ha: 256 })).gs, [0, 0, 0, 0], 'el atacante va de lado (derrapando): no pega con el frente');
  assert.deepEqual(V(choque({ vx: 2.2 })).gs, [0, 0, 0, 0], 'despacito (< HIT_V) no vale');
  assert.deepEqual(V(choque({ ain: [0, 0] })).gs, [0, 0, 0, 0], 'sin motor (empujado, sin stick ni acelerón) no vale');
  const emp = choque({ ain: [0, 0], atm: 3 << 22 }); assert.deepEqual(V(emp).gs, [2, 0, 0, 0], 'soltó el stick hace menos de 0,2 s: todavía vale');
  const pana = choque({ v: 1, hv: 0 }); assert.deepEqual(V(pana).gs, [0, 0, 0, 0], 'tu pana no da puntos'); assert.equal(V(pana).stun[1], 0); assert.ok(V(pana).vx[1] > 2, 'pero rebota');
  const parado = choque({ a: 2, v: 0, ax: 236, bx: 200, vx: -5, ha: 256, hv: 0 });
  assert.deepEqual(V(parado).gs, [0, 0, 0, 0], 'el que está parado no puntúa aunque le caigan encima a su frente (no va hacia él), y el que llega de lado tampoco');
  const aturdido = choque({ atm: 10 }); assert.deepEqual(V(aturdido).gs, [0, 0, 0, 0], 'un carrito aturdido no puntúa');
});

test('aturdido 0,5 s (gira sin control) e inmune 0,8 s: no se encadenan puntos contra el mismo; pasado eso, vale otra vez', () => {
  const st = choque({ k: 300, hv: 0 }); let v = V(st);
  assert.equal(v.stun[2], 15); assert.equal(v.imm[2], 24); assert.equal(v.bst[2], 0);
  const h0 = v.h[2]; st.in[2].x = -1; st.in[2].y = 0; st.in[2].tap = 1; tick(st);
  assert.equal(V(st).h[2], (h0 + 48) % 1024, 'aturdido: gira solo (SPIN), no hacia el stick'); assert.equal(V(st).bst[2], 0, 'ni acelerón');
  st.in[2].tap = 0; st.in[2].x = 0;
  /* otra vez por la cola dentro de la inmunidad: rebota pero no suma */
  edita(st, (pk) => { pon(pk, 2, { x: 236, y: 170, h: 0 }); pon(pk, 0, { x: 200, y: 170, vx: 5, h: 0 }); });
  tick(st); assert.equal(V(st).gs[0], 2, 'inmune: sin puntos'); assert.ok(V(st).imm[2] > 0 && V(st).imm[2] < 24, 'la inmunidad no se recarga');
  while (V(st).imm[2] > 0) tick(st);
  assert.equal(V(st).stun[2], 0);
  edita(st, (pk) => { pon(pk, 2, { x: 236, y: 170, h: 0 }); pon(pk, 0, { x: 200, y: 170, vx: 5, h: 0 }); for (const p of [1, 3]) pon(pk, p, LEJOS[p]); });
  tick(st); assert.equal(V(st).gs[0], 4, 'pasada la inmunidad, vale de nuevo');
  assert.equal(V(choque({ hv: 0, vtm: 3 << 5 })).gs[0], 0, 'con inmunidad cargada (del snapshot) no vale');
});

test('¡SE VA LA LUZ!: al apagado le vale +1; apagado no gira, no acelera ni da acelerón (solo se desliza)', () => {
  /* la víctima justo dentro del sector sin luz, el atacante afuera (con luz y con motor) entrando por el borde */
  const v0 = V(mk({ seed: 1 })), a = v0.apag[0], s = a.s[0], kOff = a.t + 36 + 5, dir = (s & 1) ? 1 : -1, cy = (s & 2) ? 255 : 85;
  const bx = 300 + dir * 8, ax = bx - dir * 36, ha = dir > 0 ? 0 : 512, hv = ha;
  const st = choque({ k: kOff, ax, ay: cy, bx, by: cy, vx: 5 * dir, ha, hv });
  assert.equal(V(st).gs[0], 3, 'por detrás (2) + apagado (1)'); assert.equal((V(st).ev >> 9) & 1, 1); assert.equal((V(st).ev >> 5) & 7, 3);
  const lado = choque({ k: kOff, ax, ay: cy, bx, by: cy, vx: 5 * dir, ha, hv: 256 }); assert.equal(V(lado).gs[0], 2, 'costado (1) + apagado (1)');
  const aviso = choque({ k: a.t + 5, ax, ay: cy, bx, by: cy, vx: 5 * dir, ha, hv }); assert.equal(V(aviso).gs[0], 2, 'mientras titila todavía hay luz: sin extra');
  const desliza = choque({ k: kOff, ax: bx - dir * 36 + dir * 40, ay: cy, bx: bx + dir * 40, by: cy, vx: 5 * dir, ha, hv }); assert.equal(V(desliza).gs[0], 0, 'el que se desliza apagado (sin motor) no puntúa');
  const cx = (s & 1) ? 450 : 150, cy2 = cy;
  const os = mk({ seed: 1 });
  edita(os, (pk) => { pk[0] = kOff; for (let p = 0; p < 4; p++) pon(pk, p, Object.assign({ h: 0, tm: 0 }, LEJOS[p])); pon(pk, 1, { x: cx, y: cy2, vx: 3, h: 0 }); });
  os.in[1].x = 0; os.in[1].y = 1; os.in[1].tap = 1; tick(os);
  const w = V(os); assert.equal(w.off[1], 1); assert.equal(w.h[1], 0, 'no gira'); assert.equal(w.bst[1], 0, 'no hay acelerón'); assert.equal(w.cd[1], 0, 'ni gasta el enfriamiento');
  assert.ok(w.vx[1] > 2.8 && w.vx[1] < 3, 'se desliza con poca fricción'); assert.ok(Math.abs(w.vy[1]) < 0.01, 'no responde al stick');
  const luz = mk({ seed: 1 }); edita(luz, (pk) => { for (let p = 0; p < 4; p++) pon(pk, p, Object.assign({ h: 0, tm: 0 }, LEJOS[p])); pon(pk, 1, { x: 300, y: 170, h: 0 }); });
  luz.in[1].x = 0; luz.in[1].y = 1; luz.in[1].tap = 1; tick(luz); assert.ok(V(luz).h[1] > 0, 'con luz gira hacia el stick'); assert.ok(V(luz).bst[1] > 0, 'y el acelerón sale');
});

test('calendario del apagón: sembrado (misma semilla = mismo calendario en TODAS las pantallas), aviso 1,2 s + 2 s sin luz, 6-8 s (Nv2 4,5-6 s), Nv3 dos sectores', () => {
  for (const lv of [1, 2, 3]) for (let seed = 1; seed <= 25; seed++) {
    const ref = V(mk({ lv, seed })).apag;
    assert.deepEqual(V(mk({ lv, seed, juez: false, yo: 2 })).apag, ref, 'pantalla que no es el juez'); assert.deepEqual(V(mk({ lv, seed, yo: 3, humanos: [3] })).apag, ref, 'otra pantalla');
    assert.ok(ref.length >= 4, `lv${lv} s${seed}: ${ref.length} apagones`); assert.ok(ref[0].t >= 3.5 * 30 && ref[0].t <= 5 * 30);
    ref.forEach((e, i) => {
      assert.equal(e.s.length, lv === 3 ? 2 : 1); e.s.forEach((x) => assert.ok(x >= 0 && x < 4)); if (lv === 3) assert.notEqual(e.s[0], e.s[1]);
      assert.ok(e.t + 36 < 40 * 30);
      if (i) { const g = (e.t - ref[i - 1].t) / 30; if (lv === 2) assert.ok(g >= 4.5 - 0.02 && g <= 6.02, 'Nv2: ' + g); else assert.ok(g >= 5.98 && g <= 8.02, `lv${lv}: ${g}`); }
    });
  }
  assert.notDeepEqual(V(mk({ seed: 7 })).apag, V(mk({ seed: 8 })).apag);
  const a = V(mk({ seed: 4 })).apag[0], s = a.s[0], cx = (s & 1) ? 450 : 150, cy = (s & 2) ? 255 : 85;
  const fase = (k) => { const st = mk({ seed: 4 }); edita(st, (pk) => { pk[0] = k; pon(pk, 0, { x: cx, y: cy, h: 0 }); }); return V(st).off[0]; };
  assert.deepEqual([fase(a.t - 1), fase(a.t + 35), fase(a.t + 36), fase(a.t + 95), fase(a.t + 96)], [0, 0, 1, 1, 0]);
  const ss = [0, 0, 0, 0]; for (let seed = 1; seed <= 200; seed++) V(mk({ seed })).apag.forEach((e) => { ss[e.s[0]]++; });
  const tot = ss.reduce((x, y) => x + y, 0); ss.forEach((x) => assert.ok(Math.abs(x / tot - 0.25) < 0.04, 'los 4 sectores parejos: ' + ss));
});

test('muerte súbita: reglamentario = dur − 6 s; empate al final ⇒ sigue hasta el primer punto; con ganador termina; el puntaje es por asiento y compara suma por equipo', () => {
  const st = mk({ seed: 1 }); const v = V(st); assert.equal(v.regT, 34 * 30); assert.equal(v.durT, 40 * 30);
  const sc = (k, s) => { edita(st, (pk) => { pk[0] = k; s.forEach((x, p) => { pk[I(p) + 6] = x; }); }); return st.g.done(); };
  assert.equal(sc(500, [3, 0, 0, 0]), false, 'antes del reglamentario nunca termina');
  assert.equal(sc(1020, [3, 1, 2, 2]), false, '4 – 4 al final: ¡MUERTE SÚBITA!');
  assert.equal(sc(1100, [3, 1, 2, 3]), true, 'el primer punto gana');
  assert.equal(sc(1020, [0, 2, 1, 0]), true, '2 – 1: se acabó la ficha');
  const ve = reglas.compara('2v2', [0, 0, 1, 1], st.g.scores()); assert.deepEqual(ve.puestos, [1, 1, 2, 2]);
  assert.match(st.g.destacado(), /2 – 1/);
  const corto = V(mk({ seed: 1, dur: 10 })); assert.equal(corto.durT - corto.regT, Math.round(1.5 * 30), 'con dur corto la muerte súbita es el 15 %');
  /* en una partida real con empate al reglamentario, sigue jugando */
  let visto = false;
  for (let seed = 1; seed <= 60 && !visto; seed++) { const x = LIVE.sim('f_chocones', { tipo: '2v2', seed, lv: 1, skill: 0.6 }); if (x.vista.k > x.vista.regT + 3) { visto = true; const s = x.vista.sc; assert.ok(s[0] !== s[1] || x.kk >= 40 * 30 - 1, 'muerte súbita: termina con el primer punto o al final'); } }
  assert.ok(visto, 'alguna partida llega a muerte súbita');
});

test('tope de puntos: ningún asiento pasa de min(30, 1,5·(t+1,5)) aunque pegue de más (el servidor no recorta)', () => {
  const st = choque({ hv: 0, asc: 1 }); assert.equal(V(st).gs[0], 2, 'en t=0 el tope es 2: suma solo 1'); assert.equal(V(st).hits[0], 1, 'el golpe sí cuenta');
  const tarde = choque({ k: 1000, hv: 0, asc: 29 }); assert.equal(V(tarde).gs[0], 30, 'tope scoreMax 30');
});

test('lados por ÍNDICE de equipo: el equipo 0 (azul) sale a la izquierda mirando a la derecha aunque ocupe otros asientos; espejado exacto', () => {
  for (const eq of [[0, 0, 1, 1], [1, 0, 0, 1], [1, 1, 0, 0], [0, 1, 1, 0]]) {
    const v = V(mk({ seed: 1, equipos: eq }));
    assert.deepEqual(v.side, eq, JSON.stringify(eq));
    for (let p = 0; p < 4; p++) { assert.equal(v.x[p] < 300, eq[p] === 0); assert.equal(v.h[p], eq[p] === 0 ? 0 : 512); }
    const xs0 = v.x.filter((_, p) => eq[p] === 0).sort(), xs1 = v.x.filter((_, p) => eq[p] === 1).map((x) => 600 - x).sort(); assert.deepEqual(xs0, xs1);
  }
});

test('pack: 39 enteros, el mensaje s cabe en 420 B; restore deja al juez nuevo en estado EXACTO (misma continuación) en los 3 niveles (con conos y carrito loco)', () => {
  const guion = (st, p, api) => { const k = Math.round(st.gt * 30), a = (k * (p + 3) * 7) % 360 * Math.PI / 180; if (k % 9 === p) api.eje(Math.cos(a), Math.sin(a)); if ((k * 13 + p * 7) % 47 === 0) api.press(); };
  const G4 = [guion, guion, guion, guion];
  for (const lv of [1, 2, 3]) for (const corte of [150, 640]) {
    const A = mk({ seed: 3, lv });
    for (let i = 0; i < corte; i++) tick(A, G4);
    const snap = A.g.pack(); assert.equal(snap.length, 39); assert.ok(snap.every(Number.isInteger));
    assert.ok(JSON.stringify({ q: 0, e: 12, t: 39967, p: snap }).length <= 420, JSON.stringify(snap).length + ' B');
    const C = mk({ seed: 3, lv }); C.g.restore(snap); C.gt = A.gt; C.in = JSON.parse(JSON.stringify(A.in));
    assert.deepEqual(C.g.pack(), snap, 'ida y vuelta exacta');
    for (let i = 0; i < 400; i++) { tick(A, G4); tick(C, G4); if (i % 20 === 0) assert.deepEqual(C.g.pack(), A.g.pack(), `lv${lv} corte ${corte}: diverge en el tick ${i}`); }
    assert.deepEqual(C.g.pack(), A.g.pack()); assert.deepEqual(C.g.scores(), A.g.scores());
  }
  const l3 = V(mk({ seed: 5, lv: 3 })); assert.ok(Math.abs(Math.hypot(l3.loco.vx, l3.loco.vy) - 3.2) < 0.05, 'el loco va a velocidad fija'); assert.ok(Math.abs(Math.abs(l3.loco.vx) - Math.abs(l3.loco.vy)) < 0.05, 'en diagonal');
  assert.equal(V(mk({ lv: 1 })).cones.length, 0); assert.equal(V(mk({ lv: 2 })).cones.length, 4);
});

test('lerp: interpola posiciones y el rumbo por el camino corto (cruza 0/1024), deja los discretos del snapshot nuevo', () => {
  const st = mk({ seed: 1 }); const a = st.g.pack(), b = a.slice();
  b[0] = a[0] + 3; b[I(0)] = a[I(0)] + 40; b[I(0) + 6] = 5; a[I(1) + 4] = 1000; b[I(1) + 4] = 20;
  const m = st.g.lerp(a, b, 0.5); assert.equal(m[I(0)], a[I(0)] + 20); assert.equal(m[0], b[0]); assert.equal(m[I(0) + 6], 5); assert.equal(m[I(1) + 4], 1022, '1000 → 20 pasa por 0: la mitad es 1022');
  const c2 = a.slice(); c2[I(2)] = a[I(2)] + 900; assert.equal(st.g.lerp(a, c2, 0.5)[I(2)], c2[I(2)], 'salto grande: sin interpolar');
});

test('CPU: las 4 chocan y puntúan en los 3 niveles; huyen del sector que titila (la buena más que la mala); dos ociosos pierden siempre', () => {
  for (const lv of [1, 2, 3]) {
    const r = B.medirCtx(DEF, { N: 20, lv, skill: 0.6 });
    r.hits.forEach((x, j) => assert.ok(x / 20 >= 1.2, `lv${lv} asiento ${j}: ${(x / 20).toFixed(1)} golpes/partido`));
  }
  const oscuro = (sk) => { let t = 0; for (let seed = 1; seed <= 20; seed++) { const st = mk({ seed, skill: sk }); B.jugar(st, CPU4, 34, (s) => { V(s).off.forEach((x) => { t += x; }); }); } return t / 20; };
  const quietos = (() => { let t = 0; for (let seed = 1; seed <= 20; seed++) { const st = mk({ seed }); B.jugar(st, [null, null, null, null], 34, (s) => { V(s).off.forEach((x) => { t += x; }); }); } return t / 20; })();
  const bueno = oscuro(0.9), malo = oscuro(0.3);
  assert.ok(bueno < malo, `en lo oscuro: buena ${bueno.toFixed(0)} < mala ${malo.toFixed(0)} carrito-ticks`); assert.ok(bueno < quietos * 0.75, `y mucho menos que quietos (${quietos.toFixed(0)})`);
  for (const lv of [1, 3]) {
    const o = B.medirCtx(DEF, { N: 40, lv, modos: [null, null, 'cpu', 'cpu'] }); assert.equal(o.w0 + o.emp, 0, `lv${lv}: dos ociosos nunca ganan ni empatan`);
    const o2 = B.medirCtx(DEF, { N: 40, lv, modos: ['cpu', 'cpu', null, null] }); assert.equal(o2.w1 + o2.emp, 0, `lv${lv}: espejado`);
    o.sc.forEach((s) => assert.equal(s[0] + s[1], 0, 'un ocioso no suma nunca'));
  }
});

test('CPU con pana humano: ataca al rival que NO persigue su pana', () => {
  let otro = 0, mismo = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const st = mk({ seed, yo: 0, humanos: [0] });
    const humano = (s, p, api) => { const v = V(s), dx = v.x[2] - v.x[0], dy = v.y[2] - v.y[0]; api.eje(dx, dy); };      // el humano persigue siempre al rival 2
    for (let i = 0; i < 300; i++) {
      tick(st, [humano, 'cpu', 'cpu', 'cpu']);
      if (i > 60 && i % 10 === 0) { const v = V(st), d2 = Math.hypot(v.x[2] - v.x[1], v.y[2] - v.y[1]), d3 = Math.hypot(v.x[3] - v.x[1], v.y[3] - v.y[1]); if (d3 < d2) otro++; else mismo++; }
    }
  }
  assert.ok(otro > mismo * 1.5, `la CPU pana se arrima al otro rival: ${otro} vs ${mismo}`);
});

test('balance (400 semillas × Nv1-3, LIVE.sim con 4 CPU skill .6): |P(eq0) − P(eq1)| ≤ 10 pp, empates ≤ 10 %; .9+.9 contra .3+.3 ≥ 85 %; el ganador sale de compara', () => {
  for (const lv of [1, 2, 3]) {
    const r = B.medir(DEF, { N: 400, lv, skill: 0.6 });
    assert.ok(Math.abs(r.w0 - r.w1) / r.N <= 0.10, `lv${lv}: eq0 ${r.w0} vs eq1 ${r.w1}`); assert.ok(r.emp / r.N <= 0.10, `lv${lv}: empates ${r.emp}`);
    for (const s of r.sc) { const ve = reglas.compara('2v2', [0, 0, 1, 1], s); assert.equal(ve.puestos[0] === ve.puestos[2], s[0] + s[1] === s[2] + s[3]); }
    const f = B.medir(DEF, { N: 100, lv, skill: [0.9, 0.9, 0.3, 0.3] }), g = B.medir(DEF, { N: 100, lv, skill: [0.3, 0.3, 0.9, 0.9] });
    assert.ok((f.w0 + g.w1) / 200 >= 0.85, `lv${lv}: el fuerte ganó ${f.w0 + g.w1}/200`);
  }
});

test('LIVE.sim: termina con puestos válidos de 2v2 y puntajes enteros dentro del tope del servidor (sin recorte) para dur 8/20/40 × 3 niveles', () => {
  const okP = ['1,1,2,2', '2,2,1,1', '1,1,1,1'];
  for (const dur of [8, 20, 40]) for (let seed = 1; seed <= 30; seed++) {
    const lv = 1 + (seed % 3), x = LIVE.sim('f_chocones', { tipo: '2v2', seed: seed * 7 + dur, lv, dur, skill: 0.6 });
    assert.ok(x.fin, 'termina por veredicto'); assert.equal(x.sc.length, 4); assert.ok(okP.includes(x.pl.join(',')), 'puestos ' + x.pl);
    assert.ok(x.kk <= dur * 30 + 1);
    const t = Math.min(dur, x.kk / 30);
    x.sc.forEach((v) => { assert.ok(Number.isInteger(v) && v >= 0 && v <= cap(t), `dur${dur} lv${lv} seed${seed}: sc ${v} > tope ${cap(t)}`); });
    if (dur === 40 && x.pl[0] !== x.pl[2]) assert.ok(x.kk >= 33 * 30, 'no termina antes de minT');
  }
});

test('dibujo: draw() no revienta (antes, durante, apagón, muerte súbita, final; yo jugador/espectador) en los 3 niveles y solo con primitivas del lab', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) for (const yo of [0, 3, -1]) {
    const st = mk({ lv, seed: 3, yo }); const v = V(st);
    for (const gt of [-2, 0, 1.2]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    B.jugar(st, CPU4, 10, (s) => { if (Math.round(s.gt * 30) % 13 === 0) s.g.draw(); });
    for (const k of [v.apag[0].t + 5, v.apag[0].t + 50, 1025, 1199]) { edita(st, (a) => { a[0] = k; }); st.gt = k / 30; st.g.update(1 / 30); st.g.draw(); }
    const nj = mk({ lv, seed: 3, yo: 2, juez: false, humanos: [2] }); nj.in[2].x = 1; nj.in[2].a = true;
    for (let i = 0; i < 40; i++) { nj.gt += 1 / 30; nj.g.predict(1 / 30); nj.g.update(1 / 30); nj.g.draw(); }
  }
  assert.ok(calls.length > 1000); assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
  const demo = []; for (const nm of ['rr', 'ell', 'txt']) globalThis[nm] = () => { demo.push(nm); };
  DEF.carta.demos[0].dibuja(100, 100, 1, 0.3, false); DEF.carta.demos[0].dibuja(100, 100, 1, 0.9, true); assert.ok(demo.length > 6);
});

test('pantalla que no es el juez: predice su carrito con el stick (gira y avanza al instante) y no manda nada', () => {
  const st = mk({ seed: 1, yo: 0, juez: false, humanos: [0] });
  st.in[0].x = 0; st.in[0].y = 1;
  for (let i = 0; i < 6; i++) { st.gt += 1 / 30; st.g.predict(1 / 30); st.g.update(1 / 30); }
  const v = V(st); assert.ok(v.mp, 'hay carrito predicho'); assert.ok(v.mp.h > 110 && v.mp.h <= 200, 'giró hacia abajo: ' + v.mp.h); assert.ok(v.mp.y > v.y[0] + 0.5, 'y avanzó antes que el juez: ' + v.mp.y);
  assert.equal(st.sent.length, 0);
});
