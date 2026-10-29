/* f_mudanza (2v2 cooperativo, modelo C): registro, reglas, CPU, balance y límites del servidor. Sin red.
   Contexto falso con control por asiento (docs/style-lab/pruebas/fiesta-mudanza-bench.js: mkCtx/tick/jugar) y LIVE.sim (la sesión REAL con 4 CPU).
   El catálogo compartido aún no trae f_mudanza: la entrada que debe llevar (CAT/LIM del banco) se usa EN MEMORIA (nada compartido se modifica).
   SOLO JUGABILIDAD: estilo snes/primitivas, sin capturas.   node --test test/fiesta-juego-mudanza.test.js */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-mudanza-bench.js');
const reglas = require('../docs/style-lab/fiesta-reglas.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-mudanza.js');
const DEF = B.cargar(), CAT = B.CAT, LIM = B.LIM, LIVE = B.LIVE, CPU4 = B.CPU4;
const IDLE4 = ['idle', 'idle', 'idle', 'idle'];
const mk = (o) => B.mkCtx(DEF, Object.assign({ modos: IDLE4 }, o || {}));
const V = (st) => st.g.vista();
/* índices de pack(): [k, kr] + equipo q en 2+10q: ax, ay, bx, by (×4), stop, imm, ray, arr, mhit, fz + asiento p en 22+3p: drop, dimm, up */
const TI = (q) => 2 + 10 * q, PI = (p) => 22 + 3 * p;
function edita(st, f) { const a = st.g.pack(); f(a); st.g.restore(a); }
function pon(st, q, ax, ay, bx, by) { edita(st, (a) => { const o = TI(q); a[o] = Math.round(ax * 4); a[o + 1] = Math.round(ay * 4); a[o + 2] = Math.round(bx * 4); a[o + 3] = Math.round(by * 4); }); }
/* guion: st.in[p] = {x, y, a} fijo en cada tick */
const fijo = (x, y, a) => (st, p, api) => { api.eje(x, y); api.hold('a', !!a); };
const quieto = fijo(0, 0, false);
function corre(st, modos, t) { for (let i = 0; i < t; i++) B.tick(st, modos); }
const cap = (t) => Math.floor(Math.min(LIM.scoreMax, LIM.scoreRate * (t + 1.5)));
/* una semilla por variante de escalera de cada nivel */
function semillasPorVariante(lv) { const m = {}; for (let s = 1; s < 200 && Object.keys(m).length < 3; s++) { const v = V(mk({ lv, seed: s })).variante; if (m[v] === undefined) m[v] = s; } return m; }

test('registro: paridad con la entrada de catálogo que debe llevar (C, binary, 2v2, dur 45, lim) · stick + 1 botón · packN 34 · carta con demo propia', () => {
  assert.equal(DEF.modelo, 'C'); assert.equal(DEF.clase, 'binary'); assert.deepEqual(DEF.modos, ['2v2']); assert.equal(DEF.dur, CAT.dur); assert.equal(DEF.dur, 45);
  assert.equal(CAT.mo, 'C'); assert.equal(CAT.cl, 'binary'); assert.deepEqual(CAT.m, ['2v2']); assert.equal(CAT.live, 1);
  assert.deepEqual(DEF.limites, CAT.lim); assert.deepEqual(DEF.limites, { scoreMax: 100, scoreRate: 7, minT: 15, finTemprano: 1 });
  assert.equal(DEF.botones, 1); assert.equal(DEF.stick, true); assert.equal(DEF.packN, 34); assert.equal(DEF.migra, true);
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && typeof DEF.carta.demos[0].dibuja === 'function');
  for (const j of DEF.packDiscretos) assert.ok(Number.isInteger(j) && j >= 0 && j < DEF.packN);
  for (const j of [2, 3, 4, 5, 12, 13, 14, 15]) assert.ok(!DEF.packDiscretos.includes(j), 'las posiciones del sofá se interpolan');
  assert.equal(LIVE.get('f_mudanza'), DEF);
  /* el tope del servidor (binary: todo asiento contra el tiempo real) nunca recorta un fin posible: el más temprano es minT */
  assert.ok(cap(LIM.minT) >= LIM.scoreMax, 'a minT el tope ya cubre SMAX');
});

test('lint: sin Math.random/Date.now ni dibujo de canvas crudo, sin sintaxis fuera de ES5, sin tipos x* (todo viaja en el snapshot)', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|moveTo|drawImage|fillText|beginPath|clip)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /\bclass\b/, /=>/, /\blet\b/, /\bconst\b/, /`/]) assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.(send|on)\(/.test(s));
});

test('escaleras: 2/3/4 curvas, 1/2/2 tendederos, perro y moto desde el Nv2, sofá más largo en el Nv3; sembrado (misma semilla = misma escalera); las 9 guías llegan', () => {
  const curvas = { 1: 2, 2: 3, 3: 4 }, tend = { 1: 1, 2: 2, 3: 2 };
  for (const lv of [1, 2, 3]) {
    for (let seed = 1; seed <= 12; seed++) {
      const v = V(mk({ lv, seed }));
      assert.equal(v.pts.length - 2, curvas[lv]); assert.equal(v.cuerdas.length, tend[lv]);
      assert.equal(!!v.perro, lv >= 2); assert.equal(v.motos.length > 0, lv >= 2);
      v.cuerdas.forEach((c) => assert.ok(c.s > v.Ls + 20 && c.s < v.L - v.Ls / 2, 'tendedero lejos de la salida y de la puerta'));
      v.motos.forEach((m, i) => { assert.ok(m.sd === 1 || m.sd === -1); if (i) assert.ok(m.t - v.motos[i - 1].t >= 11 * 30); });
      assert.ok(v.T.every((T) => Math.abs(T.len - v.Ls) < 0.01));
    }
    const vs = semillasPorVariante(lv); assert.equal(Object.keys(vs).length, 3, 'las 3 variantes salen');
    for (const k of Object.keys(vs)) { const g = V(mk({ lv, seed: vs[k] })).guia; assert.ok(g.ok, `lv${lv} variante ${k}: la guía llega a la puerta`); assert.ok(g.n < 30 * 20, 'la guía tarda < 20 s a toda velocidad'); }
  }
  assert.equal(V(mk({ lv: 3 })).Ls, 124); assert.equal(V(mk({ lv: 1 })).Ls, 100);
  assert.deepEqual(V(mk({ lv: 3, seed: 7 })).cuerdas, V(mk({ lv: 3, seed: 7 })).cuerdas, 'determinista');
  assert.deepEqual(V(mk({ lv: 2, seed: 7 })).motos, V(mk({ lv: 2, seed: 7 })).motos);
  assert.ok([1, 2, 3, 4, 5].some((s) => JSON.stringify(V(mk({ lv: 2, seed: s })).motos) !== JSON.stringify(V(mk({ lv: 2, seed: 7 })).motos)));
});

test('sofá rígido: el largo NO cambia (±0,75 px, cuantizado a 1/4) con 900 ticks de entradas cualesquiera en los 3 niveles', () => {
  const loco = (st, p, api) => { const t = st.gt * (1 + p * 0.37); api.eje(Math.sin(t * 2.3 + p), Math.cos(t * 1.7 + p * 2)); api.hold('a', Math.sin(t * 0.9 + p) > 0.3); };
  for (const lv of [1, 2, 3]) {
    const st = mk({ lv, seed: 4 }), Ls = V(st).Ls;
    for (let i = 0; i < 900; i++) { B.tick(st, [loco, loco, loco, loco]); for (const T of V(st).T) assert.ok(Math.abs(T.len - Ls) <= 0.75, `lv${lv} tick ${i}: largo ${T.len}`); }
    const p = st.g.pack(); assert.ok(p.every(Number.isInteger));
  }
  const cpu = mk({ lv: 3, seed: 2, modos: CPU4 }), Ls3 = V(cpu).Ls;
  for (let i = 0; i < 900; i++) { B.tick(cpu, CPU4); for (const T of V(cpu).T) assert.ok(Math.abs(T.len - Ls3) <= 0.75); }
});

test('tirar para lados contrarios NO avanza (forcejeo); juntos sube a la velocidad de una punta; una punta sola arrastra a ~1/3', () => {
  const s0 = V(mk()).T[0].s;
  const opu = mk(); corre(opu, [fijo(0, -1), fijo(0, 1), quieto, quieto], 60);
  assert.ok(Math.abs(V(opu).T[0].s - s0) < 0.6, 'adelante contra atrás: el centro no se mueve ' + V(opu).T[0].s);
  assert.ok(V(opu).T[0].fz > 18, 'se ve forcejear (contador de forcejeo)'); assert.equal(V(opu).T[0].ray, 0, 'forcejear no es rayón');
  const lado = mk(); corre(lado, [fijo(1, 0), fijo(-1, 0), quieto, quieto], 10); assert.ok(Math.abs(V(lado).T[0].s - s0) < 1, 'de lado y contrarios: gira en el sitio');
  const juntos = mk(); corre(juntos, [fijo(0, -1), fijo(0, -1), quieto, quieto], 60); const dj = V(juntos).T[0].s - s0;
  assert.ok(Math.abs(dj - 60 * 84 / 30) < 4, 'los dos juntos: 84 px/s ' + dj);
  const solo = mk(); corre(solo, [fijo(0, -1), quieto, quieto, quieto], 60); const ds = V(solo).T[0].s - s0;
  assert.ok(ds / dj > 0.28 && ds / dj < 0.4, 'una punta sola: ~1/3 ' + (ds / dj).toFixed(2));
  const atras = mk(); corre(atras, [quieto, fijo(0, -1), quieto, quieto], 60); assert.ok(Math.abs((V(atras).T[0].s - s0) - ds) < 1, 'empujar desde atrás vale lo mismo');
  const alto = mk(); corre(alto, [fijo(0, -1, true), fijo(0, -1, true), quieto, quieto], 60); assert.ok(Math.abs((V(alto).T[0].s - s0) / dj - 0.5) < 0.06, '¡ARRIBA! a la mitad de velocidad');
  assert.equal(V(alto).P[0].up, 1); assert.equal(V(alto).P[1].up, 1);
  assert.equal(V(juntos).T[1].s, s0, 'el otro equipo (quieto) no se entera: sin contacto entre carriles');
});

test('tendedero: pasa solo si los DOS mantienen A; con uno solo es pared (rayón); bajarlo a mitad de cruce lo traba', () => {
  const prep = () => { const st = mk({ lv: 1, seed: 3 }), v = V(st), c = v.cuerdas[0], cx = (c.x0 + c.x1) / 2; pon(st, 0, cx, c.y + 6, cx, c.y + 6 + v.Ls); return { st, c, Ls: v.Ls }; };
  const dos = prep(); corre(dos.st, [fijo(0, -1, true), fijo(0, -1, true), quieto, quieto], 120);
  assert.ok(V(dos.st).T[0].by < dos.c.y - 2, 'los dos con A: el sofá entero cruzó'); assert.equal(V(dos.st).T[0].ray, 0);
  for (const quien of [0, 1]) {
    const uno = prep(); const m = [fijo(0, -1, quien === 0), fijo(0, -1, quien === 1), quieto, quieto]; corre(uno.st, m, 120);
    assert.ok(V(uno.st).T[0].ay > uno.c.y, `solo ${quien} con A: no cruza`); assert.ok(V(uno.st).T[0].ray >= 1, '¡RAYÓN! contra la cuerda');
  }
  const nadie = prep(); corre(nadie.st, [fijo(0, -1), fijo(0, -1), quieto, quieto], 60); assert.ok(V(nadie.st).T[0].ay > nadie.c.y && V(nadie.st).T[0].ray >= 1);
  const traba = prep(); corre(traba.st, [fijo(0, -1, true), fijo(0, -1, true), quieto, quieto], 30);
  const v1 = V(traba.st).T[0]; assert.ok(v1.ay < traba.c.y && v1.by > traba.c.y, 'a mitad de cruce');
  corre(traba.st, [fijo(0, -1, false), fijo(0, -1, true), quieto, quieto], 45); const v2 = V(traba.st).T[0];
  assert.deepEqual([v2.ax, v2.ay, v2.bx, v2.by], [v1.ax, v1.ay, v1.bx, v1.by], 'bajado bajo la cuerda: no se mueve'); assert.ok(v2.ray >= 1);
  corre(traba.st, [fijo(0, -1, true), fijo(0, -1, true), quieto, quieto], 90); assert.ok(V(traba.st).T[0].by < traba.c.y, 'levantándolo otra vez sigue');
});

test('pared = ¡RAYÓN!: 0,4 s quieto (aunque empujen), 0,6 s de gracia, y vuelve a contar; rozar en diagonal resbala sin rayón', () => {
  const st = mk(), s0 = V(st).T[0];
  let primero = -1;
  for (let i = 0; i < 40 && primero < 0; i++) { B.tick(st, [fijo(-1, 0), fijo(-1, 0), quieto, quieto]); if (V(st).T[0].ray) primero = i; }
  assert.ok(primero > 0, 'llega a la pared y raya'); const v = V(st).T[0]; assert.equal(v.stop, 12); assert.ok(v.ax < s0.ax);
  const pos = [v.ax, v.ay, v.bx, v.by];
  for (let i = 0; i < 11; i++) { B.tick(st, [fijo(0, -1), fijo(0, -1), quieto, quieto]); const w = V(st).T[0]; assert.deepEqual([w.ax, w.ay, w.bx, w.by], pos, 'detenido aunque empujen'); }
  B.tick(st, [fijo(0, -1), fijo(0, -1), quieto, quieto]); B.tick(st, [fijo(0, -1), fijo(0, -1), quieto, quieto]); assert.ok(V(st).T[0].ay < pos[1], 'pasados 0,4 s sigue');
  const rep = mk(); corre(rep, [fijo(-1, 0), fijo(-1, 0), quieto, quieto], 120); const r = V(rep).T[0].ray;
  assert.ok(r >= 3 && r <= 5, 'empujando contra la pared: un rayón cada ~1 s (' + r + ')');
  const diag = mk(); corre(diag, [fijo(-0.6, -0.8), fijo(-0.6, -0.8), quieto, quieto], 90); assert.equal(V(diag).T[0].ray, 0, 'en diagonal resbala'); assert.ok(V(diag).T[0].s > s0.s + 100);
  const e2 = mk(); corre(e2, [fijo(1, 0), fijo(1, 0), fijo(1, 0), fijo(1, 0)], 40); assert.deepEqual(V(e2).T.map((T) => T.ray), [1, 1], 'espejado: el stick a la derecha es pared de afuera en un carril y de adentro en el otro, pero los dos rayan igual');
});

test('el perro de la vecina: si toca a uno, suelta su punta 0,6 s (su stick no cuenta, el sofá se arrastra) y luego 1 s sin volver a caer', () => {
  const st = mk({ lv: 2, seed: 5 }), v0 = V(st);
  let k = 0; while (k++ < 600) { const d = V(st).perroAt; if (d && d.mov && Math.abs(d.x - v0.perro.x) < 6) break; B.tick(st, IDLE4); }
  const d = V(st).perroAt; assert.ok(d && d.mov, 'el perro cruza');
  pon(st, 0, d.x, d.y, d.x, d.y + v0.Ls); B.tick(st, IDLE4);
  assert.equal(V(st).P[0].drop, 17, 'soltó la punta de adelante'); assert.equal(V(st).P[1].drop, 0, 'el de atrás no');
  const a0 = V(st).T[0]; corre(st, [fijo(0, -1), quieto, quieto, quieto], 10); const a1 = V(st).T[0];
  assert.deepEqual([a1.ax, a1.ay], [a0.ax, a0.ay], 'con la punta en el piso su stick no la mueve');
  const m = mk({ lv: 2, seed: 5 }); while (true) { const dd = V(m).perroAt; if (dd && dd.mov && Math.abs(dd.x - v0.perro.x) < 6) break; B.tick(m, IDLE4); }
  const d2 = V(m).perroAt; pon(m, 0, d2.x, d2.y, d2.x, d2.y + v0.Ls); B.tick(m, IDLE4); assert.ok(V(m).P[0].drop > 0); corre(m, [quieto, fijo(0, -1), quieto, quieto], 15);
  assert.ok(V(m).T[0].s > a0.s + 3, 'el pana arrastra el sofá con la punta en el piso');
  assert.ok(V(m).P[0].dimm > 0, 'gracia: no vuelve a caer enseguida');
  assert.equal(V(mk({ lv: 1 })).perroAt, null, 'sin perro en el Nv1');
});

test('la moto (Nv2+): avisa 1,5 s, baja por media escalera; si pasa por el sofá ¡RAYÓN! de 0,9 s una sola vez; pegado a la otra pared no le pasa nada', () => {
  const busca = (lado) => {
    const st = mk({ lv: 2, seed: 3 }), Ls = V(st).Ls;
    let ok = false;
    for (let i = 0; i < 1350 && !ok; i++) {
      const m = V(st).moto;
      if (m && m.ph === 1) assert.equal(m.s, V(st).L);
      if (m && m.ph === 2 && m.s > 200 && m.s < V(st).L - 200) {
        const pts = V(st).pts, x0 = pts[2][0];
        if (Math.abs(m.x - x0) > 15 && m.y < pts[2][1] - Ls && m.y > pts[3][1] + Ls) {      // en el tramo largo vertical
          const ox = lado === 'misma' ? m.x : x0 - (m.x - x0) * 1.1;
          pon(st, 0, ox, m.y - Ls / 2, ox, m.y + Ls / 2); B.tick(st, IDLE4); ok = true;
        }
      }
      if (!ok) B.tick(st, IDLE4);
    }
    assert.ok(ok, 'la moto bajó por el tramo largo');
    return st;
  };
  const pega = busca('misma'), T = V(pega).T[0]; assert.equal(T.ray, 1); assert.ok(T.stop >= 25, 'rayón largo: ' + T.stop); assert.ok(T.mhit > 0);
  corre(pega, IDLE4, 20); assert.equal(V(pega).T[0].ray, 1, 'una sola vez por pasada');
  const libra = busca('otra'); assert.equal(V(libra).T[0].ray, 0, 'del otro lado del pasillo no la toca');
  assert.equal(V(mk({ lv: 1 })).motos.length, 0);
});

test('llegada: el primero a la puerta gana (SMAX vs SMAX−1, iguales los dos panas); llegar en el mismo tick empata; si nadie llega gana el que subió más; fin 2 s después', () => {
  const prep = () => { const st = mk({ lv: 1, seed: 2 }), v = V(st), pe = v.pts[v.pts.length - 1], cy = pe[1] + v.Ls / 2 + 16; for (const q of [0, 1]) pon(st, q, pe[0], cy - v.Ls / 2, pe[0], cy + v.Ls / 2); return st; };
  const up = fijo(0, -1);
  const emp = prep(); corre(emp, [up, up, up, up], 20); let v = V(emp);
  assert.ok(v.T[0].arr > 0 && v.T[0].arr === v.T[1].arr, 'mismo tick'); assert.deepEqual(v.sc, [100, 100, 100, 100]);
  assert.equal(reglas.compara('2v2', [0, 0, 1, 1], v.sc).puestos[0], reglas.compara('2v2', [0, 0, 1, 1], v.sc).puestos[2], 'empate');
  const pri = prep(); corre(pri, [up, up, quieto, quieto], 10); corre(pri, [up, up, up, up], 20); v = V(pri);
  assert.ok(v.T[0].arr > 0 && v.T[1].arr > v.T[0].arr); assert.deepEqual(v.sc, [100, 100, 99, 99]);
  assert.deepEqual(reglas.compara('2v2', [0, 0, 1, 1], v.sc).puestos, [1, 1, 2, 2]);
  const solo = prep(); corre(solo, [up, up, quieto, quieto], 20); v = V(solo); assert.ok(v.T[0].arr && !v.T[1].arr); assert.equal(v.sc[0], 100); assert.ok(v.sc[2] <= 98);
  assert.equal(solo.g.done(), false); const a = v.T[0].arr; while (V(solo).k < a + 59) B.tick(solo, IDLE4); assert.equal(solo.g.done(), false); B.tick(solo, IDLE4); B.tick(solo, IDLE4); assert.equal(solo.g.done(), true, '2 s después de la primera llegada');
  const frozen = V(solo).T[0]; corre(solo, [fijo(1, 1), fijo(1, 1), quieto, quieto], 10); assert.deepEqual([V(solo).T[0].ax, V(solo).T[0].ay], [frozen.ax, frozen.ay], 'el sofá entregado ya no se mueve');
  const nadie = mk({ lv: 1 }); corre(nadie, [up, up, fijo(0, -0.5), fijo(0, -0.5)], 120); v = V(nadie);
  assert.ok(!v.T[0].arr && !v.T[1].arr && v.sc[0] > v.sc[2] && v.sc[2] > 0, 'progreso: ' + v.sc); assert.equal(v.sc[0], v.sc[1]); assert.equal(nadie.g.done(), false);
  assert.deepEqual(reglas.compara('2v2', [0, 0, 1, 1], v.sc).puestos, [1, 1, 2, 2]);
  assert.deepEqual(V(mk()).sc, [0, 0, 0, 0], 'al salir, 0 escalones');
});

test('carriles: la MISMA escalera espejada (x → 300 − x); entradas espejadas ⇒ estados canónicos idénticos tick a tick y empate; también con la CPU', () => {
  const st = mk({ lv: 3, seed: 6 }), v = V(st);
  assert.deepEqual(v.T[0].mundo.ax, v.LW - v.T[1].mundo.ax); assert.equal(v.T[0].mundo.ay, v.T[1].mundo.ay);
  const g = (sg) => (s, p, api) => { const t = s.gt + (p % 2) * 0.7; api.eje(sg * Math.sin(t * 1.9), -0.6 + 0.4 * Math.cos(t * 1.3)); api.hold('a', Math.sin(t * 2.1) > 0); };
  for (let i = 0; i < 1200; i++) { B.tick(st, [g(1), g(1), g(-1), g(-1)]); const p = st.g.pack(); for (let z = 2; z < 12; z++) assert.equal(p[z], p[z + 10], `tick ${i} índice ${z}`); }
  const ve = B.veredicto(st); assert.equal(ve.puestos[0], ve.puestos[2]);
  for (const lv of [1, 2, 3]) { const e = B.espejo(DEF, { lv, N: 6 }); assert.equal(e.dif, 0, `lv${lv}: CPU con la misma suerte en los dos carriles divergen`); assert.equal(e.emp, 6); }
});

test('pack/restore: 34 enteros (≤300 B); el juez nuevo sigue EXACTO con las mismas entradas; lerp solo interpola posiciones', () => {
  const gu = (s, p, api) => { const t = s.gt * (1 + p * 0.21); api.eje(Math.sin(t * 1.3 + p), -Math.abs(Math.cos(t * 0.7 + p))); api.hold('a', Math.sin(t * 1.7 + p) > 0.4); };
  const M = [gu, gu, gu, gu];
  for (const lv of [1, 2, 3]) {
    const A = mk({ lv, seed: 9 }); corre(A, M, 400);
    const snap = A.g.pack(); assert.equal(snap.length, 34); assert.ok(snap.every(Number.isInteger)); assert.ok(JSON.stringify(snap).length <= 300, JSON.stringify(snap).length + ' B');
    const Bc = mk({ lv, seed: 9 }); Bc.g.restore(snap); Bc.gt = A.gt; assert.deepEqual(Bc.g.pack(), snap);
    for (let i = 0; i < 600; i++) { B.tick(A, M); B.tick(Bc, M); if (i % 25 === 0) assert.deepEqual(Bc.g.pack(), A.g.pack(), `lv${lv} diverge en ${i}`); }
    assert.deepEqual(Bc.g.scores(), A.g.scores());
  }
  const a = mk().g.pack(), b = a.slice(); b[0] += 3; b[2] += 40; b[6] = 5; b[24] = 9;
  const L = mk().g.lerp(a, b, 0.5); assert.equal(L[2], a[2] + 20); assert.equal(L[6], 5); assert.equal(L[24], 9); assert.equal(L[0], b[0]);
  const salto = b.slice(); salto[2] = a[2] + 900; assert.equal(mk().g.lerp(a, salto, 0.5)[2], salto[2], 'un salto grande no se interpola');
});

test('LIVE.sim (sesión real, 4 CPU): termina con veredicto, puestos válidos en 2v2, panas con el mismo puntaje y nunca por encima del tope del servidor (dur 45 y cortas)', () => {
  for (const dur of [45, 20, 8]) for (let seed = 1; seed <= 24; seed++) {
    const lv = 1 + (seed % 3), x = LIVE.sim('f_mudanza', { tipo: '2v2', seed: seed * 13 + dur, lv, dur, skill: 0.3 + (seed % 4) * 0.2 });
    assert.ok(x.fin, 'termina por veredicto'); assert.equal(x.sc.length, 4); assert.equal(x.pl.length, 4);
    assert.equal(x.sc[0], x.sc[1]); assert.equal(x.sc[2], x.sc[3]); assert.equal(x.pl[0], x.pl[1]); assert.equal(x.pl[2], x.pl[3]);
    assert.ok(x.pl.every((p) => p === 1 || p === 2)); assert.deepEqual(x.pl, reglas.compara('2v2', x.eq, x.sc).puestos);
    const t = x.kk / 30; assert.ok(t >= Math.min(LIM.minT, dur - 1) - 0.05 && t <= dur + 0.05, 'fin entre minT y dur: ' + t);
    x.sc.forEach((v) => { assert.ok(Number.isInteger(v) && v >= 0 && v <= LIM.scoreMax); assert.ok(v <= cap(t), `dur${dur} seed${seed}: ${v} > tope ${cap(t)} a ${t.toFixed(1)} s (el servidor recortaría)`); });
    if (x.ganaLado !== 'empate') assert.ok(x.sc[0] !== x.sc[2]);
  }
});

test('balance (doc 15 §2): lados simétricos, fuerte .9+.9 gana ≥85 %, en el Nv1 la CPU .6 termina la escalera, un ocioso con una CPU tarda claramente más, dos ociosos nunca ganan', () => {
  /* el espejo exacto (prueba de carriles) descarta sesgo de lado; aquí, el ruido estadístico: 600 semillas por nivel (±12 pp ≈ 3 σ) y 1800 juntas (±6 pp ≈ 2,5 σ).
     (3000 semillas del Nv3 dan 49,7 % / 49,8 %: no hay sesgo; un bloque de 300 puede salir 58/42 por azar.) */
  let w0 = 0, w1 = 0, n = 0;
  for (const lv of [1, 2, 3]) {
    const r = B.medir(DEF, { lv, N: lv === 3 ? 1200 : 600, skill: 0.6 }); w0 += r.w0; w1 += r.w1; n += r.N;
    assert.ok(Math.abs(r.w0 - r.w1) / r.N <= 0.12, `lv${lv}: eq0 ${r.w0} eq1 ${r.w1}`); assert.ok(r.emp / r.N <= 0.1, `lv${lv} empates ${r.emp}`);
    if (lv === 1) { assert.ok(r.alguno / r.N >= 0.9, 'Nv1: alguien llega en ≥90 % (' + r.alguno + ')'); assert.ok(r.tLl[0] / r.llega[0] < 35, 'y antes de 35 s'); }
    if (lv > 1) assert.ok(r.alguno / r.N >= 0.6, `lv${lv}: la carrera suele acabar (${r.alguno})`);
  }
  assert.ok(Math.abs(w0 - w1) / n <= 0.06, `juntos: ${w0} vs ${w1}`);
  let fw = 0, fn = 0;
  for (const lv of [1, 2, 3]) {
    const a = B.medir(DEF, { lv, N: 30, skill: [0.9, 0.9, 0.3, 0.3] }), b = B.medir(DEF, { lv, N: 30, skill: [0.3, 0.3, 0.9, 0.9], seedBase: 500 });
    fw += a.w0 + b.w1; fn += a.N + b.N;
  }
  assert.ok(fw / fn >= 0.85, 'fuerte gana ' + fw + '/' + fn);
  const uno = B.medirCtx(DEF, { N: 30, modos: ['cpu', 'idle', 'cpu', 'cpu'] }), uno2 = B.medirCtx(DEF, { N: 30, modos: ['idle', 'cpu', 'cpu', 'cpu'] });
  for (const r of [uno, uno2]) { assert.ok(r.w0 / r.N <= 0.1, 'un ocioso pierde: ' + r.w0); assert.ok(r.prog[0] / r.N < 0.6 * (r.prog[1] / r.N), 'y sube mucho menos'); assert.ok(r.prog[0] / r.N > 0.1, 'pero la CPU sí lo arrastra'); }
  const dos = B.medirCtx(DEF, { N: 30, modos: ['idle', 'idle', 'cpu', 'cpu'] }); assert.equal(dos.w0, 0); assert.equal(dos.emp, 0);
});

test('CPU con pana humano: se alinea a la punta del humano y la acompaña (no la arrastra como peso muerto); con pana CPU lo mismo', () => {
  const s0 = V(mk()).T[0].s, base = 90 * 84 / 30;
  for (const hum of [0, 1]) {
    const modos = hum === 0 ? ['hum', 'cpu', 'cpu', 'cpu'] : ['cpu', 'hum', 'cpu', 'cpu'], st = mk({ lv: 1, seed: 4, modos, skill: 0.6 });
    const m = modos.slice(); m[hum] = fijo(0, -1);
    corre(st, m, 90); const d = V(st).T[0].s - s0;
    assert.ok(d > 0.75 * base, `humano ${hum === 0 ? 'adelante' : 'atrás'} sube derecho: su CPU lo acompaña (${d.toFixed(0)} de ${base})`);
    const solo = mk({ lv: 1, seed: 4, modos: hum === 0 ? ['hum', 'idle', 'idle', 'idle'] : ['idle', 'hum', 'idle', 'idle'] }); const m2 = ['idle', 'idle', 'idle', 'idle']; m2[hum] = fijo(0, -1);
    corre(solo, m2, 90); assert.ok(d > 2 * (V(solo).T[0].s - s0), 'mucho más que arrastrando a un ocioso');
  }
  const cc = mk({ lv: 1, seed: 4, modos: CPU4, skill: 0.9 }); corre(cc, CPU4, 90); assert.ok(V(cc).T[0].s - s0 > 0.75 * base, 'dos CPU buenas suben a buen ritmo');
});

test('destacado, hudChip y dibujo: draw() no revienta (antes de empezar, en juego, rayón, perro, moto, llegada) en los 3 niveles y solo con primitivas del lab', () => {
  const st0 = mk(); assert.match(st0.g.destacado(), /tía sigue esperando/); assert.equal(st0.g.hudChip(0), '0%');
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) for (const yo of [0, 3, -1]) {
    const st = mk({ lv, seed: 3, yo, modos: CPU4 });
    for (const gt of [-2, 0, 1]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    B.jugar(st, CPU4, 45, (s) => { if (Math.round(s.gt * 30) % 23 === 0) s.g.draw(); });
    st.g.draw(); assert.ok(/entregado|esperando/.test(st.g.destacado()));
    const nj = mk({ lv, seed: 3, yo, juez: false, modos: CPU4 }); nj.g.restore(st.g.pack()); nj.gt = st.gt + 0.2; nj.g.predict(1 / 30); nj.g.update(1 / 30); nj.g.draw();
  }
  assert.ok(calls.length > 2000); assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
  const demo = []; for (const nm of ['rr', 'ell', 'line', 'txt']) globalThis[nm] = () => { demo.push(nm); };
  DEF.carta.demos[0].dibuja(100, 100, 1, 0.3, false); DEF.carta.demos[0].dibuja(100, 100, 1, 1.9, true); assert.ok(demo.length > 6);
});
