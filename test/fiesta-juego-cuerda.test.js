/* f_cuerda (2v2, modelo C): reglas, CPU, balance, límites del servidor y red.
   Parte 1 (sin red): contexto falso con control por asiento (docs/style-lab/pruebas/fiesta-cuerda-bench.js: mkCtx/tick/jugar) y LIVE.sim (la sesión REAL con 4 CPU).
   Parte 2 (red): el arnés test/helpers/live-arnes.js (fiesta-net + fiesta-live + party.js detrás de memRelay con retardo, jitter y 5 % de pérdida): mismos puestos en todas las pantallas a 50/150/300 ms,
   un solo juez, juez muerto ⇒ un solo veredicto, asiento caído ⇒ CPU, presupuesto de mensajes, topes del servidor sin recorte (res.aj===false) y ventaja del juez.
   El catálogo compartido aún no trae `lim` para f_cuerda: este archivo lo inyecta EN MEMORIA (nada compartido se modifica).  SOLO JUGABILIDAD: estilo snes/primitivas, sin capturas.
   node --test test/fiesta-juego-cuerda.test.js     (LIVE_FULL=1: ventaja del juez con 200 partidas por retardo) */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-cuerda-bench.js');
const reglas = require('../docs/style-lab/fiesta-reglas.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-cuerda.js');
const DEF = B.cargar(), CAT = B.CAT, LIM = B.LIM, LIVE = B.LIVE, CPU4 = B.CPU4;
const mk = (o) => B.mkCtx(DEF, o), tick = (st, m) => B.tick(st, m || [null, null, null, null]);
const msOf = (k) => Math.round(k * 1000 / 30);
/* avanza hasta ms (hora de la partida) y pulsa A del asiento p en ese tick (el sello es el del tick: ±17 ms) */
function hasta(st, ms) { while (st.gt * 1000 < ms - 1) tick(st); }
function pulsa(st, p, ms) { hasta(st, ms); st.in[p].tap++; tick(st); }
const V = (st) => st.g.vista();
const IDX = { k: 0, pos: 1, res: 2, s: (p) => 5 + 8 * p };
function edita(st, f) { const a = st.g.pack(); f(a); st.g.restore(a); }
/* tope del servidor para un asiento a tiempo real t (party_mj.clampSc, binary) */
const cap = (t) => Math.floor(Math.min(LIM.scoreMax, LIM.scoreRate * (t + 1.5)));

test('registro: paridad con el catálogo (C, binary, 2v2, dur) y con los límites que debe llevar; un solo botón; packN 53', () => {
  assert.equal(DEF.modelo, 'C'); assert.equal(DEF.clase, 'binary'); assert.deepEqual(DEF.modos, ['2v2']); assert.equal(DEF.dur, CAT.dur);
  assert.equal(CAT.mo, 'C'); assert.equal(CAT.cl, 'binary'); assert.deepEqual(CAT.m, ['2v2']);
  assert.deepEqual(DEF.limites, CAT.lim); assert.deepEqual(DEF.limites, { scoreMax: 39, scoreRate: 1.4, minT: 29, finTemprano: 0 });
  assert.equal(DEF.botones, 1); assert.equal(DEF.stick, false); assert.equal(DEF.packN, 53);
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 1 && typeof DEF.carta.demos[0].dibuja === 'function');
  for (const j of DEF.packDiscretos) assert.ok(Number.isInteger(j) && j >= 0 && j < DEF.packN);
  assert.ok(!DEF.packDiscretos.includes(1), 'la posición de la cuerda se interpola');
  assert.equal(LIVE.get('f_cuerda'), DEF);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, el único tipo de red es xtir (≤200 B)', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\./, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /\bclass\b/, /=>/, /\blet\b/, /\bconst\b/, /`/]) assert.ok(!re.test(s), String(re));
  const envios = s.match(/c\.(send|on)\(\s*'[^']*'/g) || []; assert.ok(envios.length >= 2);
  envios.forEach((x) => assert.match(x, /'xtir'$/));
});

test('calendario: 3 tandas de 6 s (escala con dur/30), golpes dentro de la tanda, sembrados (misma semilla = mismo tambor), Nv3 sincopa y trae falsos tambores', () => {
  const v = V(mk({ seed: 5 }));
  assert.deepEqual(v.TS, [30, 318, 606]); assert.deepEqual(v.TE, [210, 498, 786]); assert.deepEqual(v.FIN.map((f, i) => f - v.TE[i]), [30, 30, 30]);
  assert.equal(v.beats[0].length, 8); assert.equal(v.beats[0][0], 1533);
  for (const lv of [1, 2, 3]) for (let seed = 1; seed <= 20; seed++) {
    const w = V(mk({ lv, seed }));
    for (let r = 0; r < 3; r++) {
      const b = w.beats[r], f = w.fakes[r];
      assert.ok(b.length >= 6); b.forEach((x, i) => { assert.ok(x > msOf(w.TS[r]) && x < msOf(w.TE[r]) - 250, `lv${lv} s${seed} r${r} golpe ${x}`); if (i) assert.ok(x - b[i - 1] >= 280, `golpes pegados lv${lv}: ${x - b[i - 1]}`); });
      if (lv < 3) assert.equal(f.length, 0);
      f.forEach((x) => b.forEach((y) => assert.ok(Math.abs(x - y) >= w.winMs + 110, 'el falso tambor nunca cae en la ventana de un golpe real')));
    }
  }
  assert.deepEqual(V(mk({ lv: 3, seed: 7 })).beats, V(mk({ lv: 3, seed: 7 })).beats, 'determinista por semilla');
  assert.notDeepEqual(V(mk({ lv: 3, seed: 7 })).beats, V(mk({ lv: 3, seed: 8 })).beats);
  assert.ok([1, 2, 3, 4, 5, 6].some((s) => V(mk({ lv: 3, seed: s })).fakes.some((f) => f.length > 0)), 'el Nv3 trae falso tambor');
  const periodo = (lv) => { const b = V(mk({ lv })).beats[0]; return (b[b.length - 1] - b[0]) / (b.length - 1); };
  assert.ok(Math.abs(periodo(1) - 666.7) < 3 && Math.abs(periodo(2) - 545.5) < 4, '90 y 110 BPM');
  const c12 = V(mk({ dur: 12 })); assert.ok(c12.TE[2] + 30 * 0.4 * 2 < 12 * 30, 'con dur 12 todo cabe antes del final'); assert.ok(c12.beats[0].length >= 3);
  for (const dur of [3, 8, 12]) { const x = V(mk({ dur })); assert.ok(x.FIN[2] < dur * 30, `dur ${dur}: la tanda 3 se cierra antes del final`); }
});

test('tirón válido: a ±140 ms de un golpe suma 7 hacia el lado del equipo; cada golpe se usa una vez; los dos lados se restan', () => {
  const st = mk({ seed: 1 }); const b = V(st).beats[0];
  pulsa(st, 0, b[0]); assert.equal(V(st).pos, 7); assert.deepEqual([V(st).pulls[0], V(st).fouls[0]], [1, 0]);
  pulsa(st, 2, b[1] - 100); assert.equal(V(st).pos, 0, 'el lado 1 resta (100 ms antes aún vale)'); pulsa(st, 3, b[1] + 100);
  assert.equal(V(st).pos, -7, 'otro rival 100 ms tarde (a 200 ms del pana: sin doble)');
  pulsa(st, 0, b[2] - 130); assert.equal(V(st).fouls[0], 0, '130 ms antes aún cuenta'); assert.equal(V(st).pulls[0], 2);
  const e = mk({ seed: 1 }); pulsa(e, 1, b[0] + 150); assert.deepEqual([V(e).pulls[1], V(e).fouls[1], V(e).pos], [0, 1, 0], '150 ms tarde es fuera de compás');
});

test('fuera de compás o repetir el golpe aturde 0,4 s (0,8 s en el barro): mientras tanto no hala ni se castiga de nuevo; luego vuelve', () => {
  const st = mk({ seed: 1 }); const b = V(st).beats[0];
  pulsa(st, 1, (b[0] + b[1]) / 2); const v = V(st); assert.deepEqual([v.fouls[1], v.pulls[1], v.pos], [1, 0, 0]);
  assert.ok(Math.abs(v.stun[1] - (v.last[1] + 400)) <= 1, 'aturdido 400 ms');
  pulsa(st, 1, b[1]); assert.deepEqual([V(st).pulls[1], V(st).fouls[1]], [0, 1], 'aturdido: no hala ni suma otro foul (el golpe está dentro del aturdimiento)');
  pulsa(st, 1, b[2]); assert.deepEqual([V(st).pulls[1], V(st).fouls[1], V(st).pos], [1, 1, 7], 'pasado el aturdimiento hala de nuevo');
  const rep = mk({ seed: 1 }); pulsa(rep, 0, b[0]); pulsa(rep, 0, b[0] + 60); assert.deepEqual([V(rep).pulls[0], V(rep).fouls[0], V(rep).pos], [1, 1, 7], 'machacar el mismo golpe es foul');
  const barro = mk({ seed: 1, lv: 2 }); const bb = V(barro).beats[0];
  pulsa(barro, 0, (bb[0] + bb[1]) / 2); assert.ok(Math.abs(V(barro).stun[0] - (V(barro).last[0] + 800)) <= 1, 'charco: 800 ms con la cuerda en el centro');
  const lejos = mk({ seed: 1, lv: 2 }); hasta(lejos, 1100); edita(lejos, (a) => { a[IDX.pos] = 60; }); pulsa(lejos, 0, (bb[0] + bb[1]) / 2); assert.ok(Math.abs(V(lejos).stun[0] - (V(lejos).last[0] + 400)) <= 1, 'fuera del charco: 400 ms');
  const l1 = mk({ seed: 1, lv: 1 }); pulsa(l1, 0, (b[0] + b[1]) / 2); assert.ok(Math.abs(V(l1).stun[0] - (V(l1).last[0] + 400)) <= 1, 'sin barro en el Nv1');
});

test('tirón DOBLE: los dos panas a ≤ DOBLE_MS (140) en el mismo golpe suman 7+7+6; a más distancia, solo 14; no cuenta con un golpe distinto ni con el rival', () => {
  const doble = (d, quien) => { const st = mk({ seed: 1 }); const b = V(st).beats[0][0]; pulsa(st, 0, b - 70); pulsa(st, quien === undefined ? 1 : quien, b - 70 + d); return V(st); };
  assert.equal(doble(60).pos, 20); assert.equal(doble(60).dobles[0], 1);
  assert.equal(doble(130).pos, 20); assert.equal(doble(141).pos, 14, 'a 141+ ms no hay doble (el segundo sigue siendo válido: ±140 del golpe)');
  assert.equal(doble(60, 2).pos, 0, 'un rival no hace doble contigo: 7 − 7');
  const dos = mk({ seed: 1 }); const b = V(dos).beats[0]; pulsa(dos, 0, b[0]); pulsa(dos, 1, b[1]); assert.equal(V(dos).pos, 14, 'cada uno en un golpe distinto: sin doble');
  const tres = mk({ seed: 1 }); pulsa(tres, 0, b[0]); pulsa(tres, 1, b[0] + 40); pulsa(tres, 0, b[1]); pulsa(tres, 1, b[1] + 40);
  assert.equal(V(tres).pos, 40, 'dos golpes dobles seguidos: 20 + 20'); assert.equal(V(tres).dobles[0], 2);
  const v = doble(60); assert.equal(v.mt[0], 1); assert.equal(v.mt[1], 1);
});

test('el sello manda, no la llegada: el tirón de un humano remoto cuenta igual llegue antes o después del de su pana, y el doble sale simétrico; sello viejo o repetido no cuenta', () => {
  const rem = (orden) => {
    const st = mk({ seed: 1, humanos: [1] }); const b = V(st).beats[0][0];
    const xt = (t) => st.handlers.xtir({ t: [t] }, 1);
    if (orden === 'remotoPrimero') { hasta(st, b - 50); xt(b + 60); pulsa(st, 0, b - 40); }       // llega primero el sello del pana (60 ms tarde), luego mi tirón
    else if (orden === 'localPrimero') { pulsa(st, 0, b - 40); hasta(st, b + 600); xt(b + 60); }  // el sello del pana llega 660 ms tarde (red lenta) pero cuenta
    hasta(st, b + 400); tick(st); tick(st); return V(st);
  };
  assert.equal(rem('remotoPrimero').pos, 20, 'doble aunque llegue antes'); assert.equal(rem('localPrimero').pos, 20, 'doble aunque llegue 600 ms después de pasar el golpe siguiente');
  const st = mk({ seed: 1, humanos: [1] }); const b = V(st).beats[0];
  hasta(st, b[0] + 200); st.handlers.xtir({ t: [b[0], b[0]] }, 1); tick(st); tick(st); assert.deepEqual([V(st).pulls[1], V(st).fouls[1], V(st).pos], [1, 0, 7], 'sello repetido: una sola vez');
  st.handlers.xtir({ t: [b[0] - 100] }, 1); tick(st); assert.equal(V(st).fouls[1], 0, 'sello anterior al último: se ignora (reenvío)');
  hasta(st, b[1] + 100); st.handlers.xtir({ t: [b[1], b[1] + 5] }, 1); tick(st); tick(st); assert.deepEqual([V(st).pulls[1], V(st).fouls[1]], [2, 1], 'dos sellos juntos: el 2º es el mismo golpe ⇒ foul');
  const cpuSeat = mk({ seed: 1 }); cpuSeat.handlers.xtir({ t: [1533] }, 1); hasta(cpuSeat, 1700); assert.equal(V(cpuSeat).pulls[1], 0, 'un asiento CPU (o caído) ignora los xtir de ese humano');
  const yoSeat = mk({ seed: 1, humanos: [1] }); yoSeat.handlers.xtir({ t: [1533] }, 0); hasta(yoSeat, 1700); assert.equal(V(yoSeat).pulls[0], 0, 'nadie manda por el asiento del juez');
  const malos = mk({ seed: 1, humanos: [1] }); for (const d of [null, {}, { t: 5 }, { t: [-4, 'x', NaN, 99999999] }, { t: [] }]) malos.handlers.xtir(d, 1); hasta(malos, 1700); assert.deepEqual([V(malos).pulls[1], V(malos).fouls[1]], [0, 0], 'basura no rompe ni cuenta');
  const fut = mk({ seed: 1, humanos: [1] }); hasta(fut, 1000); fut.handlers.xtir({ t: [1533] }, 1); tick(fut); assert.equal(V(fut).pulls[1], 0, 'un sello del futuro (> +400 ms) se descarta'); void fut;
});

test('fin de tanda: cuenta lo que llega hasta 1 s tarde con sello previo al final; después no; entre tandas no se tira; la cuerda vuelve al centro en la tanda siguiente', () => {
  const st = mk({ seed: 1, humanos: [2] }); const v0 = V(st), b = v0.beats[0], ult = b[b.length - 1], TEms = msOf(v0.TE[0]);
  pulsa(st, 0, b[0]); pulsa(st, 0, b[1]); hasta(st, TEms + 700); assert.equal(V(st).res[0], 9999, 'aún en la gracia');
  st.handlers.xtir({ t: [ult] }, 2); hasta(st, msOf(v0.FIN[0]) + 100); assert.equal(V(st).res[0], 14 - 7, 'el tirón sellado en la tanda y llegado en la gracia (−7 del lado 1) entra: 14 − 7 = 7');
  const tarde = mk({ seed: 1, humanos: [2] }); pulsa(tarde, 0, b[0]); pulsa(tarde, 0, b[1]); hasta(tarde, msOf(v0.FIN[0]) + 100); tarde.handlers.xtir({ t: [ult] }, 2); hasta(tarde, msOf(v0.FIN[0]) + 400);
  assert.equal(V(tarde).res[0], 14, 'llegado después de cerrar: no cuenta'); assert.equal(V(tarde).pulls[2], 0);
  const pasada = mk({ seed: 1, humanos: [1] }); hasta(pasada, TEms + 300); pasada.handlers.xtir({ t: [TEms + 120] }, 1); tick(pasada); tick(pasada); assert.deepEqual([V(pasada).pulls[1], V(pasada).fouls[1]], [0, 0], 'un sello posterior al final de la tanda no cuenta ni castiga');
  const gap = mk({ seed: 1 }); pulsa(gap, 0, msOf(v0.FIN[0]) + 800); assert.deepEqual([V(gap).pulls[0], V(gap).fouls[0], V(gap).stun[0]], [0, 0, 0], 'entre tandas la A no hace nada');
  const sig = mk({ seed: 1 }); const w = V(sig); pulsa(sig, 0, w.beats[0][0]); assert.equal(V(sig).pos, 7);
  hasta(sig, msOf(w.TS[1]) + 30); assert.equal(V(sig).pos, 0, 'tanda 2: cuerda al centro'); assert.equal(V(sig).res[0], 7, 'tanda 1 quedó anotada con 7 al cierre');
  pulsa(sig, 0, w.beats[1][0]); assert.deepEqual([V(sig).pos, V(sig).used[0]], [7, 0], 'los golpes se reinician por tanda');
});

test('puntaje: sc = U·tandas + min(U−1, ventaja/12), igual para los dos del equipo; compara suma por equipo (duplica ambos lados) y no inventa empates; empate real solo si todo coincide', () => {
  const st = mk({ seed: 1 }); const sc = (res) => { edita(st, (a) => { a[2] = res[0]; a[3] = res[1]; a[4] = res[2]; }); return st.g.scores(); };
  assert.equal(V(st).U, 8);
  assert.deepEqual(sc([9999, 9999, 9999]), [0, 0, 0, 0]);
  assert.deepEqual(sc([50, -30, 10]), [29, 29, 10, 10], '3 tandas-peso (1+2; la 3ª vale doble) + ventaja 60/12=5 contra 1 + 30/12=2');
  assert.deepEqual(sc([140, 140, 140]), [39, 39, 0, 0], 'tope: 3 tandas y ventaja saturada = 39 = scoreMax');
  assert.deepEqual(sc([-20, 20, 0]), [9, 9, 9, 9], '1-1 con una empatada y la misma ventaja: empate real');
  assert.deepEqual(sc([-40, 20, 0]), [9, 9, 11, 11], '1-1 con una empatada: decide la ventaja (40/12=3 contra 1)');
  for (let i = 0; i < 400; i++) {
    const rs = [0, 1, 2].map((q) => { const x = (i * 7 + q * 13) % 9; return x === 8 ? 9999 : ((i >> q) & 1 ? 1 : -1) * ((i * 31 + q * 17) % 141); });
    const s = sc(rs), ve = reglas.compara('2v2', [0, 0, 1, 1], s);
    assert.ok(s.every((x) => Number.isInteger(x) && x >= 0 && x <= LIM.scoreMax)); assert.equal(s[0], s[1]); assert.equal(s[2], s[3]);
    assert.equal(ve.puestos[0] === ve.puestos[2], s[0] === s[2], 'empate ⇔ mismo sc: ' + JSON.stringify([rs, s]));
    if (s[0] > s[2]) assert.deepEqual(ve.puestos, [1, 1, 2, 2]); if (s[0] < s[2]) assert.deepEqual(ve.puestos, [2, 2, 1, 1]);
  }
  sc([-20, 20, 0]); assert.equal(st.g.hudChip(0), '1-1'); assert.equal(st.g.hudChip(2), '1-1');
  sc([50, 30, 9999]); assert.equal(st.g.hudChip(0), '2-0'); assert.equal(st.g.hudChip(2), '0-2'); sc([50, 30, 10]); assert.equal(st.g.hudChip(0), '4-0'); assert.equal(st.g.hudChip(3), '0-4');
  assert.match(st.g.destacado(), /4 – 0 en tandas/);
});

test('lados por ÍNDICE de equipo: el equipo de menor índice tira a la izquierda (azul) aunque ocupe otros asientos; el puntaje y compara siguen al equipo', () => {
  for (const eq of [[0, 0, 1, 1], [1, 0, 0, 1], [1, 1, 0, 0], [0, 1, 1, 0]]) {
    const st = mk({ seed: 1, equipos: eq }); assert.deepEqual(V(st).side, eq, JSON.stringify(eq));
    const b = V(st).beats[0]; const quien = eq.indexOf(0);
    pulsa(st, quien, b[0]); assert.equal(V(st).pos, 7, 'el equipo 0 suma hacia la izquierda (+)');
    edita(st, (a) => { a[2] = 20; a[3] = 20; a[4] = 20; }); const sc = st.g.scores(), ve = reglas.compara('2v2', eq, sc);
    assert.deepEqual(ve.puestos, eq.map((t) => (t === 0 ? 1 : 2)), 'gana el equipo 0 (3 tandas) sea cual sea su asiento');
  }
});

test('pack: 53 enteros, el mensaje s cabe en 420 B; restore deja al juez nuevo en estado EXACTO (misma continuación con las mismas entradas) mitad de tanda y entre tandas', () => {
  const guion = (st, p, api) => { const t = Math.round(st.gt * 1000), b = [].concat.apply([], V(st).beats), cerca = b.some((x) => Math.abs(x - t) < 17); if ((cerca && (t * 7 + p * 13) % 5 !== 0) || (t * 3 + p * 11) % 97 === 0) api.press(); };
  for (const corte of [400, 520]) {
    const A = mk({ seed: 3, lv: 3 });
    for (let i = 0; i < corte; i++) tick(A, [guion, guion, guion, guion]);
    const snap = A.g.pack(); assert.equal(snap.length, 53); assert.ok(snap.every(Number.isInteger));
    assert.ok(JSON.stringify({ q: 0, e: 12, t: 29967, p: snap }).length <= 420, JSON.stringify(snap).length + ' B');
    const C = mk({ seed: 3, lv: 3 }); C.g.restore(snap); C.gt = A.gt; C.in = JSON.parse(JSON.stringify(A.in));
    for (let i = 0; i < 500; i++) { tick(A, [guion, guion, guion, guion]); tick(C, [guion, guion, guion, guion]); if (i % 15 === 0) assert.deepEqual(C.g.pack(), A.g.pack(), `corte ${corte}: diverge en el tick ${i}`); }
    assert.deepEqual(C.g.pack(), A.g.pack()); assert.deepEqual(C.g.scores(), A.g.scores());
  }
});

test('lerp: interpola solo la cuerda, deja los discretos del snapshot nuevo y no cruza el reinicio de tanda', () => {
  const st = mk({ seed: 1 }); const a = st.g.pack(), b = a.slice();
  b[0] = a[0] + 3; b[1] = a[1] + 40; b[IDX.s(0)] = 777;
  const m = st.g.lerp(a, b, 0.5); assert.equal(m[1], a[1] + 20); assert.equal(m[0], b[0]); assert.equal(m[IDX.s(0)], 777);
  const c2 = a.slice(); c2[1] = a[1] + 130; assert.equal(st.g.lerp(a, c2, 0.5)[1], c2[1], 'salto > 120 (reinicio): sin interpolar');
});

test('CPU: 4 CPU tiran al compás en los 3 niveles (nadie queda quieto), las ociosas pierden contra la CPU, la habilidad pesa, el falso tambor engaña más a las malas', () => {
  for (const lv of [1, 2, 3]) {
    const r = B.medirCtx(DEF, { N: 24, lv, skill: 0.6, modos: CPU4 });
    r.pulls.forEach((x, j) => assert.ok(x / 24 >= 8, `lv${lv} asiento ${j}: ${(x / 24).toFixed(1)} tirones/partido`)); r.fouls.forEach((x, j) => assert.ok(x / 24 <= 14, `lv${lv} asiento ${j}: ${(x / 24).toFixed(1)} fueras/partido`));
  }
  const ocio = B.medirCtx(DEF, { N: 60, modos: ['idle', 'idle', 'cpu', 'cpu'] }); assert.equal(ocio.w0, 0, 'dos ociosos nunca ganan'); assert.equal(ocio.emp, 0);
  const uno = B.medirCtx(DEF, { N: 60, modos: ['cpu', 'idle', 'cpu', 'cpu'] }); assert.equal(uno.w0, 0, 'una CPU sola no basta contra dos');
  const fuerte = B.medirCtx(DEF, { N: 60, skill: [0.9, 0.9, 0.3, 0.3], modos: CPU4 }); assert.ok(fuerte.w0 / 60 >= 0.7, '.9+.9 vence a .3+.3: ' + fuerte.w0 + '/60');
  const f3 = (sk) => { const r = B.medirCtx(DEF, { N: 40, lv: 3, skill: sk, modos: CPU4 }); return r.fouls.reduce((a, b) => a + b, 0) / 40; };
  assert.ok(f3(0.3) > f3(0.9) + 3, 'el falso tambor y el pulso tiemblan más con poca habilidad');
});

test('CPU con pana humano: lo acompaña (copia su desfase medio) para que el tirón sea doble; sin humano a su lado, no', () => {
  const dif = (humano) => {
    let s = 0, n = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const st = mk({ seed, skill: 0.9, yo: 3, humanos: humano ? [0] : [] });
      /* el humano 0 tira siempre 70 ms tarde (sello real) con 100 ms de red */
      const modos = [humano ? (s2, p) => { const t = Math.round(s2.gt * 1000), bs = [].concat.apply([], V(s2).beats); if (bs.some((x) => Math.abs(t - (x + 70)) < 17)) s2.handlers.xtir({ t: [t] }, 0); } : 'cpu', 'cpu', 'cpu', 'cpu'];
      B.jugar(st, modos, 12);
      const e = V(st).offEma[1]; if (e !== null) { s += e; n++; }
    }
    return s / n;
  };
  const con = dif(true), sin = dif(false);
  assert.ok(con > 0.03 && con > sin + 0.025, `desfase medio de la CPU con pana tardío: ${(con * 1000).toFixed(0)} ms (control ${(sin * 1000).toFixed(0)} ms)`);
});

test('el juez humano no pierde su pulsación: c.tap() llega retrasada por c.fair() y el juego la sella con la hora real (misma hora de pulsar que un remoto)', () => {
  for (const fair of [0, 0.12, 0.28]) {
    const st = mk({ seed: 1, yoHumano: true, yo: 0, fair }); const b = V(st).beats[0][0];
    hasta(st, b + Math.round(fair * 1000)); st.in[0].tap++; tick(st);                 // el runtime entrega la pulsación (hecha en b) fair s después
    assert.deepEqual([V(st).pulls[0], V(st).fouls[0]], [1, 0], `fair ${fair}: la pulsación del juez cuenta en su golpe`);
    assert.ok(Math.abs(V(st).last[0] - b) <= 34, `sello ${V(st).last[0]} ≈ hora real ${b}`);
  }
  const sin = mk({ seed: 1, yoHumano: true, yo: 0 }); const b = V(sin).beats[0][0]; hasta(sin, b); sin.in[0].tap++; tick(sin); assert.equal(V(sin).pulls[0], 1, 'sin c.fair (runtime actual) y sin rivales medidos: sin corrección');
});

test('balance (200 semillas × Nv1-3, LIVE.sim con 4 CPU skill .6): |P(gana eq0) − P(gana eq1)| ≤ 10 pp y empates ≤ 30 %; el ganador sale de compara', () => {
  for (const lv of [1, 2, 3]) {
    const r = B.medir(DEF, { N: 600, lv, skill: 0.6 });
    assert.ok(Math.abs(r.w0 - r.w1) / r.N <= 0.10, `lv${lv}: eq0 ${r.w0} vs eq1 ${r.w1}`); assert.ok(r.emp / r.N <= 0.30, `lv${lv}: empates ${r.emp}`);
    for (const s of r.sc) { const ve = reglas.compara('2v2', [0, 0, 1, 1], s); assert.deepEqual(ve.puestos[0] === ve.puestos[2], s[0] === s[2]); }
  }
});

test('puntajes: enteros ≥0 dentro de lim sin recorte del servidor (200 semillas × dur 3/8/12/30 × 3 niveles); mismo sc para los dos del equipo', () => {
  let maxv = 0;
  for (const dur of [3, 8, 12, 30]) for (let seed = 1; seed <= 50; seed++) {
    const lv = 1 + (seed % 3), x = LIVE.sim('f_cuerda', { tipo: '2v2', seed: seed * 7 + dur, lv, dur, skill: 0.6 });
    assert.ok(x.fin, 'termina por veredicto'); assert.equal(x.sc.length, 4);
    x.sc.forEach((v) => { assert.ok(Number.isInteger(v) && v >= 0 && v <= LIM.scoreMax, `dur${dur} v=${v}`); maxv = Math.max(maxv, v); assert.ok(v <= cap(dur), `dur${dur} lv${lv} seed${seed}: sc ${v} > tope ${cap(dur)} (el servidor recortaría)`); });
    assert.equal(x.sc[0], x.sc[1]); assert.equal(x.sc[2], x.sc[3]);
    assert.ok(x.kk <= dur * 30 + 1, 'el juez cierra a dur (finTemprano 0)');
  }
  assert.ok(maxv > 0 && maxv <= LIM.scoreMax);
  const largo = LIVE.sim('f_cuerda', { tipo: '2v2', seed: 3, lv: 1, dur: 30, skill: [0.9, 0.9, 0.3, 0.3] }); assert.ok(largo.sc[0] >= 20 && largo.sc[0] <= 39, 'el dominador llega a 2-3 tandas: ' + largo.sc[0]);
});

test('dibujo: draw() no revienta (gt −2, 0, 5, entre tandas, final; borrar; falso tambor; n=4) en los 3 niveles y solo con primitivas del lab', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  for (const lv of [1, 2, 3]) for (const yo of [0, 3, -1]) {
    const st = mk({ lv, seed: 3, yo }); const v = V(st);
    for (const gt of [-2, 0, 1.2, 3]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    B.jugar(st, CPU4, 8, null, (s) => { if (Math.round(s.gt * 30) % 17 === 0) s.g.draw(); });
    for (const k of [v.TS[0] - 5, v.TS[0] + 5, v.TE[0] + 5, v.FIN[0] + 5, v.TS[1] + 40, v.FIN[2] + 5]) { edita(st, (a) => { a[0] = k; a[1] = (k % 7) * 20 - 60; a[2] = 30; a[3] = -20; }); st.gt = k / 30; st.g.update(1 / 30); st.g.draw(); }
    edita(st, (a) => { a[2] = 30; a[3] = -20; a[4] = 15; }); st.g.update(1 / 30); st.g.draw();
    const solo = mk({ lv, seed: 2, yo }); B.jugar(solo, CPU4, 30, null, (s) => { if (Math.round(s.gt * 30) % 60 === 0) s.g.draw(); });
  }
  assert.ok(calls.length > 600); assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
  const demo = []; for (const nm of ['rr', 'ell', 'txt']) globalThis[nm] = () => { demo.push(nm); };
  DEF.carta.demos[0].dibuja(100, 100, 1, 0.3, false); DEF.carta.demos[0].dibuja(100, 100, 1, 0.5, true); assert.ok(demo.length > 6);
});

test('pantalla que no es el juez: pulsar A sella con c.ahora(), manda xtir (≤200 B) una vez y la repite 0,2 s después; el juez no manda nada; un asiento CPU no manda', () => {
  const noJuez = mk({ seed: 1, juez: false, yo: 2, humanos: [2] }); const b = V(noJuez).beats[0];
  hasta(noJuez, b[0] - 30); noJuez.in[2].tap++; noJuez.g.update(1 / 30);
  assert.equal(noJuez.sent.length, 1); const m = noJuez.sent[0]; assert.equal(m.t, 'xtir'); assert.ok(JSON.stringify({ q: 0, d: m.d }).length <= 200);
  assert.deepEqual(m.d.t.length, 1); assert.ok(Math.abs(m.d.t[0] - (b[0] - 30)) <= 34, 'sello = hora de la partida al pulsar');
  for (let i = 0; i < 12; i++) { noJuez.gt += 1 / 30; noJuez.g.update(1 / 30); }
  assert.equal(noJuez.sent.length, 2, 'un reenvío por si se perdió'); assert.deepEqual(noJuez.sent[1].d, m.d);
  for (let i = 0; i < 40; i++) { noJuez.gt += 1 / 30; noJuez.g.update(1 / 30); } assert.equal(noJuez.sent.length, 2, 'y nada más');
  for (let r = 0; r < 4; r++) { noJuez.gt = (b[r % b.length]) / 1000 - 0.02 + r * 0.7; noJuez.in[2].tap++; noJuez.g.update(1 / 30); }
  const ult = noJuez.sent[noJuez.sent.length - 1].d.t; assert.ok(ult.length <= 3, 'a lo sumo los últimos 3 sellos');
  const juez = mk({ seed: 1, yo: 0, yoHumano: true }); hasta(juez, b[0]); juez.in[0].tap++; juez.g.update(1 / 30); assert.equal(juez.sent.length, 0, 'el juez suma su pulsación en step(), no la manda');
  const cpuSeat = mk({ seed: 1, juez: false, yo: 2 }); cpuSeat.in[2].tap++; cpuSeat.g.update(1 / 30); assert.equal(cpuSeat.sent.length, 0, 'un humano caído (CPU) no manda');
});

/* ───────────────────────── red: stack REAL ───────────────────────── */
process.env.LIVE_DBG = '1';
const A = require('./helpers/live-arnes.js');
const { mulberry32 } = require('./helpers/mem-relay.js');
const R0 = A.R0.CATALOGO.filter((x) => x.g === 'f_cuerda')[0]; if (!R0.lim) R0.lim = Object.assign({}, LIM);           // lo que el catálogo compartido debe llevar (informe: SHARED_CHANGES_NEEDED)
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = A.LIVE.RESERVED, G = 'f_cuerda', unico = (a) => a.filter((x, i) => a.indexOf(x) === i);
const DUR = 30;

async function partida(o, bots) {
  const H = await A.arnes(Object.assign({ game: G, tipo: '2v2', dur: DUR, humans: 4, loss: 0.05, lv: 1 }, o));
  H.bot = bots || {}; H.ids.forEach((s, i) => { if (!(s in H.bot)) H.bot[s] = { skill: [0.7, 0.5, 0.6, 0.4][i] }; });
  await H.arrancar();
  return H;
}
function unVeredicto(H, et) {
  const res = H.res(); assert.ok(res, et + ': hay resultado'); assert.equal(H.srv.board.f, 'res');
  const vs = H.veredictos(), vivos = H.ids.filter((s) => !H.dead[s]);
  assert.deepEqual(Object.keys(vs).sort(), vivos.slice().sort(), et + ': todas las pantallas vivas tienen veredicto');
  assert.deepEqual(unico(Object.values(vs).map((v) => v.h)), [res.h], et + ': mismo h');
  assert.deepEqual(unico(Object.values(vs).map((v) => JSON.stringify(v.pl))), [JSON.stringify(res.puestos)], et + ': mismos puestos');
  assert.deepEqual(unico(Object.values(vs).map((v) => JSON.stringify(v.sc))), [JSON.stringify(res.sc)], et + ': mismos puntajes');
  assert.equal(H.mjfin().filter((c) => c.status === 200).length, 1, et + ': un mjfin aceptado');
  const eps = H.jueces().map((j) => j.e); assert.equal(unico(eps).length, eps.length, et + ': un solo juez por época');
  return res;
}
function topes(H, et) {
  const res = H.res(), lim = A.CAT[G].lim, tope = Math.floor(Math.min(lim.scoreMax, lim.scoreRate * (H.o.dur + 1.5)));
  res.sc.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `${et}: sc[${i}]=${v} > ${tope}`)); assert.equal(res.aj, false, et + ': sin recorte del servidor');
  assert.equal(res.sc[0], res.sc[1], et + ': mismo sc para los dos panas'); assert.equal(res.sc[2], res.sc[3]);
  const rps = H.reqPorSeg(); Object.keys(rps).forEach((k) => { if (k !== 'sala') assert.ok(rps[k] <= 20, `${et}: ${k} ${rps[k]} req/s`); }); assert.ok(rps.sala <= 45, et + ': sala ' + rps.sala);
  H.sigLog.forEach((r) => { assert.ok(r.n <= 10 && r.bytes <= 512, et + ': lote ' + r.n + '/' + r.bytes); r.lens.forEach((l, j) => assert.ok(l <= (X_RE.test(r.types[j]) ? 200 : 420), et + ': ' + r.types[j] + ' ' + l + ' B')); });
  assert.deepEqual(H.rechazos.filter((r) => H.resAt === undefined || r.at < H.resAt), [], et + ': sin rechazos del relé');
  H.tipos.forEach((t) => assert.ok(RESERVED.indexOf(t) >= 0 || X_RE.test(t) || t === 'hb', et + ': tipo ' + t));
}

test('red: f_cuerda coincide con el catálogo del servidor (2v2, C, lim inyectado)', () => {
  const d = A.LIVE.get(G); assert.ok(d); assert.equal(d.modelo, A.CAT[G].mo); assert.equal(d.clase, A.CAT[G].cl); assert.deepEqual(d.modos, A.CAT[G].m);
  ['scoreMax', 'scoreRate', 'minT'].forEach((k) => assert.equal(d.limites[k], A.CAT[G].lim[k])); assert.equal(!!d.limites.finTemprano, !!A.CAT[G].lim.finTemprano); assert.equal(A.CAT[G].dur, DUR);
});

for (const delay of [50, 150, 300]) {
  test(`${G}: mismos puestos en todas las pantallas a ${delay} ms (4 humanos, 2v2, 5% de pérdida), tipos x* ≤200 B, sin recorte`, async () => {
    const H = await partida({ delay, seed: delay + 1 });
    await H.cerrar(60); const res = unVeredicto(H, `${G}@${delay}`); assert.equal(res.por, 'juez'); topes(H, `${G}@${delay}`);
    assert.ok(H.tipos.has('xtir'), 'el tirón viaja por xtir'); assert.ok(H.sigLog.some((r) => r.types.indexOf('xtir') >= 0 && r.from !== H.mj().juez));
    H.cerrarTodo();
  });
}

test(`${G}: 2 humanos (a+b) contra 2 CPU (c+d) y los tres niveles: veredicto único y topes`, async () => {
  for (const lv of [1, 2, 3]) {
    const H = await partida({ delay: 150, humans: 2, lv, seed: 30 + lv });
    await H.cerrar(60); unVeredicto(H, `${G} lv${lv}`); topes(H, `${G} lv${lv}`); H.cerrarTodo();
  }
});

test(`${G}: dos humanos activos (a+b) le ganan a dos ociosos (c+d): el sello de cada tirón llega al juez por la red`, async () => {
  for (const delay of [50, 300]) {
    const H = await partida({ delay, seed: 5, loss: 0.05 }, { a: { skill: 0.9 }, b: { skill: 0.9 }, c: 'idle', d: 'idle' });
    await H.cerrar(60); const res = unVeredicto(H, 'activos vs ociosos@' + delay); H.cerrarTodo();
    assert.ok(res.sc[0] > res.sc[2], 'a+b ganan tandas: ' + JSON.stringify(res.sc)); assert.equal(res.puestos[0], 1); assert.equal(res.puestos[2], 2);
  }
});

test(`${G}: un humano ocioso en el equipo del juez y su pana activo contra dos activos: pierde (nadie lo salva sin tirar)`, async () => {
  const H = await partida({ delay: 150, seed: 11, loss: 0.05 }, { a: { skill: 0.7 }, b: 'idle', c: { skill: 0.7 }, d: { skill: 0.7 } });
  await H.cerrar(60); const res = unVeredicto(H, 'uno ocioso'); H.cerrarTodo(); assert.equal(res.puestos[0], 2); assert.equal(res.puestos[2], 1);
});

test(`${G}: juez muerto a mitad => un solo veredicto, restore del snapshot y mismo h en las pantallas vivas`, async () => {
  const rnd = mulberry32(23);
  for (const k of [4 + rnd() * 8, 13 + rnd() * 10]) {
    const H = await partida({ delay: 100, loss: 0.02, seed: Math.round(k * 10) });
    const juez = H.mj().juez; H.eventos.push({ en: k, fn: (h) => h.matar(juez) });
    await H.cerrar(70); unVeredicto(H, 'juez muerto @' + k.toFixed(1));
    assert.ok(H.mj().e >= 1, 'subió la época'); assert.notEqual(H.mj().juez, juez); topes(H, 'juez muerto'); H.cerrarTodo();
  }
});

test(`${G}: un asiento cae a mitad => pasa a CPU (su pana sigue), al volver recupera el asiento; veredicto único`, async () => {
  const H = await partida({ delay: 150, seed: 91, loss: 0.02 });
  H.eventos.push({ en: 6, fn: (h) => { h.R.offline.c = true; } }, { en: 14, fn: (h) => { h.R.offline.c = false; } });
  await H.cerrar(60); unVeredicto(H, 'caída'); topes(H, 'caída');
  assert.ok(H.log.some((x) => x.ev.ty === 'cpu' && x.ev.p === 2), 'se anunció ev cpu del asiento c');
  H.cerrarTodo();
});

test(`${G}: ventaja del juez (modelo C): el equipo del juez gana ≤ 1/2 + 8 pp entre las partidas decididas (LIVE_FULL=1: 200 partidas por retardo; si no, 120 con margen de ruido)`, async () => {
  const N = +process.env.LIVE_N || (process.env.LIVE_FULL ? 200 : 120), lim = process.env.LIVE_FULL ? 0.58 : 0.7;
  for (const delay of [50, 150, 300]) {
    let jw = 0, ow = 0;
    for (let seed = 1; seed <= N; seed++) {
      const H = await partida({ delay, seed: 1000 + seed + delay, lv: 1 + (seed % 3) }, (() => { const b = {}; 'abcd'.split('').forEach((s) => { b[s] = { skill: 0.6 }; }); return b; })());
      await H.cerrar(60); const res = H.res(); if (res) { const jt = H.ids.indexOf(H.mj().juez) < 2 ? 0 : 1, p = res.puestos; if (p[0] !== p[2]) { if ((p[0] === 1 ? 0 : 1) === jt) jw++; else ow++; } }
      H.cerrarTodo();
    }
    const f = jw / Math.max(1, jw + ow); console.log(`  [ventaja del juez] ${delay} ms: ${(f * 100).toFixed(0)} % (${jw}/${jw + ow})`);
    assert.ok(f <= lim, `${delay} ms: el equipo del juez ganó ${(f * 100).toFixed(0)} %`);
  }
});
