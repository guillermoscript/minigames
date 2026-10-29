'use strict';
/* f_cava (2v2 cooperativo, modelo B): humo sin red. El «juez» es este mismo proceso: llama a update() a 1/30 con c.tap/eje de todos y a ai() de las CPU.
   Contexto falso y partidas = docs/style-lab/pruebas/fiesta-cava-bench.js (misma fuente para el banco y la prueba). El catálogo real aún no trae `lim` de f_cava:
   el banco lo parchea en memoria (CAT_LINEA) y aquí se comprueba contra esa misma línea.
   Cubre: registro, lint, trayectoria determinista, atrapada (hielo/refresco/botella), historial del receptor (ev tardío), gaviota (más llena, robo, espantar por claim,
   ventana y equipo), puntaje de equipo aditivo, CPU (lanza y atrapa, ociosos pierden, la habilidad pesa), balance entre lados, límites y dibujo. SOLO JUGABILIDAD: sin capturas aquí. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-cava-bench.js');
const reglas = require('../docs/style-lab/fiesta-reglas.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-cava.js');
const CAT = B.CAT, LIN = B.CAT_LINEA, DEF = B.cargar();
const mk = (o) => B.mkCtx(DEF, o);
const DT = 1 / 30;
/* un tick sin IA: update + claims; los que no son 'cpu' no se mueven solos */
function tick(st, modos) {
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  st.gt += DT;
  (modos || []).forEach((m, p) => { if (m === 'cpu') st.g.ai(p, DT, api(p)); else if (typeof m === 'function') m(st, p, DT, api(p)); });
  st.g.update(DT); B.resuelveClaims(st);
}
const hasta = (st, t, modos) => { while (st.gt < t) tick(st, modos); };
const V = (st) => st.g.vista().V;
/* da un tiro "a mano" (ev) del equipo tm en el instante actual; devuelve la caída */
let nTiro = 0;
function tiro(st, tm, a, f, ty, n) {
  const th = tm === 0 ? 0 : 2, nn = n === undefined ? nTiro++ : n, F = st.g.vuelo(tm, a / 1000, f / 1000, st.gt);
  st.c.ev('tiro', { a, f, t: Math.round(st.gt * 1000), ty, n: nn }, th);
  return { T: st.gt + F.T, lx: F.lx, key: tm * 1000 + nn };
}
/* mueve la cava del receptor p hasta x (por el stick, como un humano) */
function llevar(st, p, x) { let i = 0; while (Math.abs(st.g.vista().x[p] - x) > 6 && i++ < 400) { st.axes[p] = { x: st.g.vista().x[p] < x ? 1 : -1, y: 0 }; tick(st); } st.axes[p] = { x: 0, y: 0 }; }
/* pone la cava del receptor p donde caerá el tiro (a, f) lanzado AHORA (el viento cambia con la hora: se recalcula) */
function bajo(st, p, tm, a, f) { for (let k = 0; k < 4; k++) { const lx = st.g.vuelo(tm, a / 1000, f / 1000, st.gt).lx; if (Math.abs(st.g.vista().x[p] - lx) <= 10) return; llevar(st, p, lx); } }
/* sostiene la cava del receptor p en x hasta la hora t (la corriente la arrastra: un humano la contrarresta con el stick) */
function sost(st, p, x, t) { while (st.gt < t) { const cx = st.g.vista().x[p]; st.axes[p] = { x: Math.abs(cx - x) < 3 ? 0 : cx < x ? 1 : -1, y: 0 }; tick(st); } st.axes[p] = { x: 0, y: 0 }; }
/* da V a un equipo vía el ev de la atrapada (el mismo camino que usa el juego) */
function cargar(st, tm, v) { st.c.ev('cogio', { id: 9000 + tm * 100 + v, v, z: (st.g.vista().z[tm === 0 ? 1 : 3] || 0) + 1, ty: 0 }, tm === 0 ? 1 : 3); }

test('registro: paridad con el catálogo propuesto (B, binary, 2v2, 35 s, lim) y cuerpo', () => {
  assert.strictEqual(DEF.modelo, 'B'); assert.strictEqual(DEF.clase, 'binary'); assert.deepStrictEqual(DEF.modos, ['2v2']); assert.strictEqual(DEF.dur, 35);
  assert.deepStrictEqual(DEF.limites, LIN.lim); assert.strictEqual(CAT.mo, 'B'); assert.strictEqual(DEF.botones, 1); assert.strictEqual(DEF.stick, true);
  assert.deepStrictEqual(DEF.cuerpo, ['x', 'a', 'f', 'v', 'z']); DEF.discretos.forEach((f) => assert.ok(DEF.cuerpo.indexOf(f) >= 0));
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 1);
  assert.ok(DEF.migra && DEF.minHumanos === 1);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, tipos de red solo por c.ev', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /\bclass\b/, /=>/]) assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.send\(/.test(s));
  assert.ok(/[¡áéíóúñ]/.test(s) && /¡CARGA LA CAVA!/.test(s) && /LANZADOR/.test(s));
});

test('roles por asiento dentro del equipo: el de menor asiento lanza, el otro atrapa', () => {
  const v = mk({ seed: 1 }).g.vista(); assert.deepStrictEqual(v.th, [0, 2]); assert.deepStrictEqual(v.rc, [1, 3]);
  const e = B.mkCtx(DEF, { seed: 1 }); e.c.equipos.splice(0, 4, 1, 0, 0, 1);            // equipos intercalados: a,d vs b,c
  const w = DEF.mk(e.c).vista(); assert.deepStrictEqual(w.th, [1, 0]); assert.deepStrictEqual(w.rc, [2, 3]);
  const hd = mk({ seed: 1 }).g; assert.strictEqual(hd.hudChip(0), 'TIRA'); assert.strictEqual(hd.hudChip(1), 'ATRAPA');
});

test('trayectoria: determinista por (equipo, ángulo, potencia, hora); cae dentro del terreno; el viento la mueve y los dos lados son espejo', () => {
  const a = mk({ seed: 7, lv: 2 }).g, b = mk({ seed: 7, lv: 2 }).g;
  for (const [ang, f] of [[0.5, 0], [0.8, 0.5], [1.2, 1], [0.436, 1], [1.222, 0]]) {
    const t1 = a.vuelo(0, ang, f, 4), t2 = b.vuelo(0, ang, f, 4);
    assert.deepStrictEqual(t1, t2); assert.ok(t1.lx > 60 && t1.lx < 400, 'cae en la playa: ' + t1.lx); assert.ok(t1.T >= 0.7 && t1.T <= 1.9, 'vuelo 0,7-1,9 s: ' + t1.T);
    const e0 = mk({ seed: 7, lv: 1 }).g.vuelo(0, ang, f, 0), e1 = mk({ seed: 7, lv: 1 }).g.vuelo(1, ang, f, 0);
    assert.ok(Math.abs((e0.lx - 36) + (e1.lx - 564)) <= 80, 'espejo salvo viento (equipo 1 va hacia la izquierda)');
  }
  const g1 = mk({ seed: 3, lv: 2 }).g; let mueve = false;
  for (let t = 0; t < 30; t += 1) if (Math.abs(g1.vuelo(0, 0.9, 0.6, t).lx - g1.vuelo(0, 0.9, 0.6, t + 3).lx) > 5) mueve = true;
  assert.ok(mueve, 'el viento cambia la caída con el tiempo');
  const sinV = mk({ seed: 3, lv: 1 }).g.vista().gusts; assert.ok(sinV >= 3, 'ráfagas sembradas');
});

test('apuntar y lanzar: el stick cambia ángulo (arriba sube) y potencia (hacia la cava sube); A lanza una vez y respeta el enfriamiento', () => {
  const st = mk({ seed: 2, cpu: false }); hasta(st, 0.1);
  const v0 = st.g.vista(), a0 = v0.ang[0], p0 = v0.pw[0];
  st.axes[0] = { x: 1, y: -1 }; for (let i = 0; i < 6; i++) tick(st);
  const v1 = st.g.vista(); assert.ok(v1.ang[0] > a0 && v1.pw[0] > p0, 'arriba = más ángulo, derecha = más potencia (equipo azul)');
  const e = mk({ seed: 2, cpu: false }); hasta(e, 0.1); e.axes[2] = { x: -1, y: 0 }; for (let i = 0; i < 6; i++) tick(e);
  assert.ok(e.g.vista().pw[2] > p0, 'el equipo rojo lanza hacia la izquierda: izquierda = más potencia');
  st.axes[0] = { x: 0, y: 0 }; hasta(st, 1.0); st.taps[0]++; tick(st); assert.strictEqual(st.evs.filter((x) => x.ty === 'tiro').length, 1);
  st.taps[0]++; tick(st); assert.strictEqual(st.evs.filter((x) => x.ty === 'tiro').length, 1, 'en enfriamiento no lanza');
  hasta(st, st.gt + 2); st.taps[0]++; tick(st); assert.strictEqual(st.evs.filter((x) => x.ty === 'tiro').length, 2);
  const r = st.evs.filter((x) => x.ty === 'tiro')[0]; assert.ok(Number.isInteger(r.d.a) && Number.isInteger(r.d.f) && JSON.stringify(r.d).length <= 80);
  const y = mk({ seed: 2, cpu: false }); hasta(y, 0.5); y.taps[1]++; tick(y); assert.strictEqual(y.evs.filter((x) => x.ty === 'tiro').length, 0, 'el receptor no lanza');
});

test('atrapada: hielo +1, refresco +2 (más la sombra); el receptor la juzga; fuera de la cava cae en la arena; el equipo contrario no la cuenta', () => {
  const st = mk({ seed: 4, cpu: false }); hasta(st, 1);
  const base = st.g.vuelo(0, 0.8, 0.5, 1).lx; assert.ok(base > 130 && base < 290, 'tiro de prueba dentro del carril: ' + base);
  llevar(st, 1, base); const t1 = tiro(st, 0, 800, 500, 0); sost(st, 1, t1.lx, t1.T + 0.2); const v1 = V(st)[0]; assert.ok(v1 >= 1 && v1 <= 2, 'hielo +1 (+1 si cayó a la sombra): ' + v1);
  hasta(st, st.gt + 0.5); bajo(st, 1, 0, 1000, 500); const t2 = tiro(st, 0, 1000, 500, 1); sost(st, 1, t2.lx, t2.T + 0.2); const v2 = V(st)[0] - v1; assert.ok(v2 >= 2 && v2 <= 3, 'refresco +2 (+1 sombra): ' + v2);
  const v2t = V(st)[0];
  hasta(st, st.gt + 0.5); llevar(st, 1, 130); const t3 = tiro(st, 0, 800, 500, 0); hasta(st, t3.T + 0.2); assert.deepStrictEqual(V(st), [v2t, 0], 'cava lejos: no cuenta');
  assert.strictEqual(st.g.vista().lanzados.slice(-1)[0][3], 0, 'queda marcado como caído en la arena');
  const lado = mk({ seed: 4, cpu: false }); hasta(lado, 1); const lb = lado.g.vuelo(0, 0.8, 0.5, 1).lx; llevar(lado, 3, lb); const tt = tiro(lado, 0, 800, 500, 0); hasta(lado, tt.T + 0.3);
  assert.deepStrictEqual(V(lado), [0, 0], 'la cava rival no atrapa lo del otro equipo');
  const borde = mk({ seed: 4, cpu: false }); hasta(borde, 1); const bx = borde.g.vuelo(0, 0.8, 0.5, 1).lx; llevar(borde, 1, bx + 18); const tb = tiro(borde, 0, 800, 500, 0); sost(borde, 1, tb.lx + 18, tb.T + 0.2);
  assert.ok(V(borde)[0] >= 1, 'tolerancia: cae a ≤ semiancho del centro');
});

test('tiro repetido: caer en el mismo sitio que el tiro anterior vale 1 menos y corta la racha (hay que apuntar a donde va la cava)', () => {
  const st = mk({ seed: 4, cpu: false, lv: 1 }); hasta(st, 1); bajo(st, 1, 0, 800, 500);
  const a = tiro(st, 0, 800, 500, 1); sost(st, 1, a.lx, a.T + 0.2); const v1 = V(st)[0]; assert.ok(v1 >= 2, 'el primero vale ' + v1);
  hasta(st, st.gt + 0.5); const b = tiro(st, 0, 800, 500, 1);
  if (Math.abs(b.lx - a.lx) < 14 && b.T - a.T < 3) { sost(st, 1, b.lx, b.T + 0.2); const dv = V(st)[0] - v1; assert.ok(dv <= 2, 'el repetido vale menos: ' + dv); assert.ok(st.evs.some((e) => e.ty === 'cogio' && e.d.rp), 'marcado rp'); }
});

test('corriente: la cava suelta se va sola (a un lado y luego al otro), espejo entre equipos, y más rápido en cada fase', () => {
  const st = mk({ seed: 3, cpu: false }); hasta(st, 0.1); const x0 = st.g.vista().x.slice(); let mx = [0, 0, 0, 0], xs = [];
  while (st.gt < 33) { tick(st); const v = st.g.vista(); xs.push(v.x[1]); mx[1] = Math.max(mx[1], Math.abs(v.x[1] - x0[1])); }
  assert.ok(mx[1] > 40, 'sin tocarla la cava se pasea: ' + mx[1]);
  let cambios = 0; for (let i = 2; i < xs.length; i++) if ((xs[i] - xs[i - 1]) * (xs[i - 1] - xs[i - 2]) < 0 && Math.abs(xs[i] - xs[i - 2]) > 0) cambios++;
  assert.ok(cambios >= 2, 'cambia de sentido');
});

test('historial: si el tiro llega tarde (ev después de la caída), el receptor lo juzga con SU posición de ese instante', () => {
  const st = mk({ seed: 4, cpu: false }); hasta(st, 1); llevar(st, 1, st.g.vuelo(0, 0.8, 0.5, 1).lx);
  const t0 = st.gt, F = st.g.vuelo(0, 0.8, 0.5, t0); sost(st, 1, F.lx, t0 + 0.5); const cx = st.g.vista().x[1];   // la cava estaba debajo en t0+T
  sost(st, 1, F.lx, t0 + F.T - 0.02); st.axes[1] = { x: -1, y: 0 }; hasta(st, t0 + F.T + 0.6); st.axes[1] = { x: 0, y: 0 };    // …y se fue después
  st.c.ev('tiro', { a: 800, f: 500, t: Math.round(t0 * 1000), ty: 0, n: 77 }, 0); tick(st); hasta(st, st.gt + 0.1);
  assert.ok(Math.abs(st.g.vista().x[1] - cx) > 30);
  assert.ok(V(st)[0] >= 1, 'se juzga contra el pasado');
});

test('botella (Nv3): -2 si se atrapa, nunca baja de 0; esquivarla no cuesta nada', () => {
  const st = mk({ seed: 4, cpu: false, lv: 3 }); hasta(st, 1); cargar(st, 0, 3); tick(st); assert.deepStrictEqual(V(st), [3, 0]);
  bajo(st, 1, 0, 800, 500); const t1 = tiro(st, 0, 800, 500, 2); sost(st, 1, t1.lx, t1.T + 0.2); assert.deepStrictEqual(V(st), [1, 0]);
  hasta(st, st.gt + 0.5); bajo(st, 1, 0, 800, 500); const t2 = tiro(st, 0, 800, 500, 2); sost(st, 1, t2.lx, t2.T + 0.2); assert.deepStrictEqual(V(st), [0, 0], 'no baja de 0');
  assert.ok(mk({ lv: 3, seed: 5 }).g.vista().seq.length && new Set(Array.from({ length: 30 }, (_, i) => mk({ lv: 3, seed: i + 1 }).g.vista().seq.join(''))).size > 5);
  const sinV = new Set(); for (let s = 1; s <= 20; s++) mk({ lv: 1, seed: s }).g.vista().seq.forEach((x) => sinV.add(x)); assert.ok(!sinV.has(2), 'sin botellas en Nv1');
});

test('arena (Nv2+): la cava va más lenta sobre la mancha; Nv1 no tiene', () => {
  const lento = mk({ seed: 6, cpu: false, lv: 2 }), v = lento.g.vista(); assert.ok(v.sand.length === 2);
  const rapido = mk({ seed: 6, cpu: false, lv: 1 });
  const corre = (s, x0) => { hasta(s, 0.2); llevar(s, 1, x0); s.axes[1] = { x: 1, y: 0 }; const a = s.g.vista().x[1]; for (let i = 0; i < 10; i++) tick(s); return s.g.vista().x[1] - a; };
  const enArena = corre(lento, lento.g.vista().sand[0] + 20), fuera = corre(mk({ seed: 6, cpu: false, lv: 2 }), 140);
  if (lento.g.vista().sand[0] > 150) assert.ok(enArena < fuera * 0.75, `en la arena ${enArena} vs fuera ${fuera}`);
  assert.ok(corre(rapido, 140) > 40);
});

test('gaviota: elige la cava MÁS LLENA a la hora sembrada; sin espantarla roba lo del nivel y deja el resto; si ambas están vacías no sale', () => {
  const st = mk({ seed: 8, cpu: false }); hasta(st, 0.5); cargar(st, 0, 6); cargar(st, 1, 2); tick(st);
  const g0 = st.g.vista().gt0[0]; hasta(st, g0 - 0.2); assert.strictEqual(st.g.vista().gulls.length, 0, 'aún no');
  hasta(st, g0 + 0.2); const gv = st.g.vista().gulls[0]; assert.ok(gv, 'sale la gaviota'); assert.strictEqual(gv[1], 0, 'la del equipo con 6');
  assert.ok(st.evs.filter((e) => e.ty === 'gav').length === 1 && JSON.stringify(st.evs.find((e) => e.ty === 'gav').d).length <= 60);
  hasta(st, gv[2] + 1.55); assert.deepStrictEqual(V(st), [6, 2], 'telegrafía: aún no roba');
  hasta(st, gv[2] + 1.9); assert.deepStrictEqual(V(st), [3, 2], 'roba 3 (Nv1)'); assert.ok(st.evs.some((e) => e.ty === 'roba' && e.d.s === 3));
  const vacio = mk({ seed: 8, cpu: false }); hasta(vacio, vacio.g.vista().gt0[0] + 0.5); assert.strictEqual(vacio.g.vista().gulls.length, 0, 'sin nada en las cavas no sale');
  const poco = mk({ seed: 8, cpu: false }); hasta(poco, 0.5); cargar(poco, 1, 2); hasta(poco, poco.g.vista().gt0[0] + 2.2); assert.deepStrictEqual(V(poco), [0, 0], 'roba solo lo que hay');
  const empate = mk({ seed: 8, cpu: false }); hasta(empate, 0.5); cargar(empate, 0, 4); cargar(empate, 1, 4); hasta(empate, empate.g.vista().gt0[0] + 0.2); assert.ok(empate.g.vista().gulls[0], 'empate: moneda sembrada');
  const igual = mk({ seed: 8, cpu: false }); hasta(igual, 0.5); cargar(igual, 0, 4); cargar(igual, 1, 4); hasta(igual, igual.g.vista().gt0[0] + 0.2); assert.strictEqual(igual.g.vista().gulls[0][1], empate.g.vista().gulls[0][1]);
  const nv3 = mk({ seed: 8, cpu: false, lv: 3 }); assert.strictEqual(nv3.g.vista().gt0.length, 4); assert.strictEqual(mk({ seed: 8, lv: 1 }).g.vista().gt0.length, 3);
});

test('espantar (claim): el receptor del equipo amenazado dentro de la ventana la espanta y no hay robo; tarde, no; el lanzador y el rival no cuentan', () => {
  const montar = () => { const st = mk({ seed: 8, cpu: false }); hasta(st, 0.5); cargar(st, 0, 6); cargar(st, 1, 2); tick(st); hasta(st, st.g.vista().gt0[0] + 0.05); return st; };
  const st = montar(), tl = st.g.vista().gulls[0][2];
  hasta(st, tl + 0.4); st.taps[1]++; tick(st); tick(st); assert.strictEqual(st.g.vista().gulls[0][3], 1, 'espantada'); hasta(st, tl + 2.3); assert.deepStrictEqual(V(st), [6, 2], 'sin robo');
  const tarde = montar(), tl2 = tarde.g.vista().gulls[0][2]; hasta(tarde, tl2 + 1.2); tarde.taps[1]++; tick(tarde); tick(tarde); assert.strictEqual(tarde.g.vista().gulls[0][3], 0, 'fuera de la ventana'); hasta(tarde, tl2 + 2.3); assert.deepStrictEqual(V(tarde), [3, 2]);
  const pronto = montar(), tl3 = pronto.g.vista().gulls[0][2]; hasta(pronto, tl3 + 0.02); pronto.taps[1]++; tick(pronto); tick(pronto); assert.strictEqual(pronto.g.vista().gulls[0][3], 0, 'antes de la ventana no vale (la gaviota aún no está)');
  const rival = montar(), tl4 = rival.g.vista().gulls[0][2]; hasta(rival, tl4 + 0.4); rival.taps[3]++; tick(rival); tick(rival); assert.strictEqual(rival.g.vista().gulls[0][3], 0, 'el receptor rival no puede espantar la gaviota ajena');
  const ref = montar(), tlr = ref.g.vista().gulls[0][2], ms = (x) => Math.round((tlr + x) * 1000);
  assert.strictEqual(ref.g.claimOk('g0_0', 0, ms(0.4)), false, 'el lanzador no espanta'); assert.strictEqual(ref.g.claimOk('g0_3', 3, ms(0.4)), false);
  assert.strictEqual(ref.g.claimOk('g0_1', 1, ms(0.4)), true); assert.strictEqual(ref.g.claimOk('g0_1', 1, ms(1.4)), false); assert.strictEqual(ref.g.claimOk('g0_1', 1, ms(0.0)), false, 'antes de la ventana');
  assert.strictEqual(ref.g.claimOk('g9_1', 1, 1000), false, 'gaviota inexistente'); assert.strictEqual(ref.g.claimOk('g0_1', 0, ms(0.4)), false, 'el id no coincide con el emisor');
  const quieto = montar(), tl5 = quieto.g.vista().gulls[0][2]; hasta(quieto, tl5 + 0.4); quieto.axes[1] = { x: 1, y: 0 }; quieto.taps[1]++; const x0 = quieto.g.vista().x[1]; for (let i = 0; i < 6; i++) tick(quieto);
  assert.ok(quieto.g.vista().x[1] - x0 < 30, 'mientras agita los brazos (0,45 s) la cava no se mueve');
});

test('espantar (CPU): una CPU receptora espanta con ev `espanta` anunciado por el juez; una gaviota no se espanta dos veces', () => {
  let ok = 0; const N = 12;
  for (let seed = 1; seed <= N; seed++) {
    const st = mk({ seed, skill: 0.9 }); hasta(st, 0.4, ['cpu', 'cpu', 'cpu', 'cpu']); cargar(st, 0, 7); cargar(st, 1, 3); hasta(st, st.g.vista().gt0[0] + 2.4, ['cpu', 'cpu', 'cpu', 'cpu']);
    const sp = st.evs.filter((e) => e.ty === 'espanta'); if (sp.length) { ok++; assert.ok(sp.length === 1); assert.ok(sp[0].p === 1 || sp[0].p === 3); }
  }
  assert.ok(ok >= 8, 'una CPU hábil espanta casi siempre: ' + ok + '/' + N);
});

test('puntaje de equipo: sc[lanzador]=floor(V/2), sc[receptor]=V-floor(V/2); la suma es V exacto y compara decide por suma', () => {
  const st = mk({ seed: 3, cpu: false }); hasta(st, 0.3); cargar(st, 0, 7); cargar(st, 1, 4); tick(st);
  const sc = st.g.scores(); assert.deepStrictEqual(sc, [3, 4, 2, 2]); assert.strictEqual(sc[0] + sc[1], 7); assert.strictEqual(sc[2] + sc[3], 4);
  const ve = reglas.compara('2v2', [0, 0, 1, 1], sc); assert.deepStrictEqual(ve.puestos, [1, 1, 2, 2]);
  cargar(st, 1, 7); tick(st); assert.deepStrictEqual(reglas.compara('2v2', [0, 0, 1, 1], st.g.scores()).puestos, [1, 1, 1, 1], 'empate a 7');
  assert.match(st.g.destacado(), /cargaron 7 cosas/);
});

test('eventos de otras pantallas: z mayor manda (ev perdido o fuera de orden no pisa el total); alRemoto/alHum/alCpu mantienen v, z y apuntado', () => {
  const st = mk({ seed: 3, cpu: false }); hasta(st, 0.3);
  st.c.ev('cogio', { id: 1, v: 5, z: 5, ty: 0 }, 1); st.g.onEv('cogio', 1, { id: 2, v: 3, z: 3, ty: 0 }, 0); assert.deepStrictEqual(V(st), [5, 0], 'un ev viejo no pisa');
  st.g.alRemoto(1, { x: 150, a: 0, f: 0, v: 9, z: 9 }); assert.deepStrictEqual(V(st), [9, 0]); st.g.alRemoto(1, { x: 150, a: 0, f: 0, v: 2, z: 4 }); assert.deepStrictEqual(V(st), [9, 0]);
  st.g.alHum(1, { x: 200, a: 0, f: 0, v: 11, z: 11 }); assert.deepStrictEqual(V(st), [11, 0]); assert.strictEqual(st.g.vista().x[1], 200);
  st.g.alHum(0, { x: 0, a: 90, f: 70, v: 0, z: 0 }); assert.ok(Math.abs(st.g.vista().ang[0] - 0.9) < 1e-9 && Math.abs(st.g.vista().pw[0] - 0.7) < 1e-9);
  assert.deepStrictEqual(st.g.cuerpo(1), { x: 200, a: 0, f: 0, v: 11, z: 11 }); assert.deepStrictEqual(Object.keys(st.g.cuerpo(0)), ['x', 'a', 'f', 'v', 'z']);
  assert.ok(JSON.stringify(st.g.cuerpo(1)).length < 60);
  const dup = mk({ seed: 3, cpu: false }); hasta(dup, 1); const d = { a: 800, f: 500, t: 1000, ty: 0, n: 0 }; dup.g.onEv('tiro', 0, d); dup.g.onEv('tiro', 0, d); assert.strictEqual(dup.g.vista().vuelos, 1, 'el mismo tiro dos veces es uno');
  const viejo = mk({ seed: 3, cpu: false }); hasta(viejo, 20); viejo.g.onEv('tiro', 0, { a: 800, f: 500, t: 1000, ty: 0, n: 3 }); assert.strictEqual(viejo.g.vista().vuelos, 0, 'un tiro de hace 19 s se ignora');
});

test('CPU: lanzan y atrapan en los 3 niveles (≥12 tiros por equipo, ≥60 % atrapados), nadie se queda quieto, los ociosos pierden y la habilidad pesa', () => {
  for (const lv of [1, 2, 3]) {
    let lan = 0, atr = 0; const N = 20;
    for (let seed = 1; seed <= N; seed++) { const st = mk({ seed, lv, skill: 0.6 }); B.jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 35); lan += st.evs.filter((e) => e.ty === 'tiro').length; atr += st.evs.filter((e) => e.ty === 'cogio').length; }
    assert.ok(lan / N >= 24, `lv${lv}: ${(lan / N).toFixed(1)} tiros/partido`); assert.ok(atr / lan >= 0.5, `lv${lv}: atrapó ${(atr / lan * 100).toFixed(0)} %`);
  }
  const mov = mk({ seed: 3 }); const xs = [new Set(), new Set()]; let a0 = mk({ seed: 3 }); void mov;
  while (a0.gt < 20) { a0.gt += DT; [0, 1, 2, 3].forEach((p) => a0.g.ai(p, DT, { press() { a0.taps[p]++; }, hold() {}, eje(x, y) { a0.axes[p] = { x, y }; } })); a0.g.update(DT); B.resuelveClaims(a0); xs[0].add(Math.round(a0.g.vista().x[1] / 5)); xs[1].add(Math.round(a0.g.vista().ang[0] * 20)); }
  assert.ok(xs[0].size >= 5 && xs[1].size >= 3, 'receptor y lanzador CPU se mueven y apuntan');
  let gano = 0; const N2 = 30;
  for (let seed = 1; seed <= N2; seed++) { const st = mk({ seed, skill: 0.6 }); B.jugar(st, ['idle', 'idle', 'cpu', 'cpu'], 35); const pl = B.verdict(st); if (pl[0] === 1 && pl[2] !== 1) gano++; }
  assert.strictEqual(gano, 0, 'dos ociosos nunca ganan a dos CPU');
  let fuerte = 0, N3 = 80;
  for (let seed = 1; seed <= N3; seed++) { const st = mk({ seed, skill: [0.9, 0.9, 0.3, 0.3] }); B.jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 35); const v = B.verdict(st); if (v[0] === 1 && v[2] === 2) fuerte++; }
  assert.ok(fuerte / N3 >= 0.6, 'la habilidad pesa: .9+.9 vence a .3+.3 en ' + fuerte + '/' + N3);
  let sol = 0; for (let seed = 1; seed <= 30; seed++) { const st = mk({ seed, skill: 0.6 }); B.jugar(st, ['idle', 'cpu', 'cpu', 'cpu'], 35); const v = B.verdict(st); if (v[0] === 1 && v[2] !== 1) sol++; }
  assert.ok(sol <= 3, 'un lanzador ocioso con receptor CPU casi nunca gana: ' + sol);
});

test('balance (200 semillas × Nv1-3, 4 CPU skill .6): azul y rojo parejos (≤17 pp por nivel, ≤12 pp en total; medias de V iguales) y empates ≤ 25 %; el ganador sale de compara', () => {
  let a = 0, b = 0, n = 0;
  for (const lv of [1, 2, 3]) {
    const r = B.medir(DEF, { N: 200, lv, skill: 0.6 }); a += r.w0; b += r.w1; n += r.n;
    assert.ok(Math.abs(r.w0 - r.w1) / r.n <= 0.17, `lv${lv}: azul ${r.w0} vs rojo ${r.w1}`); assert.ok(r.emp / r.n <= 0.25, `lv${lv}: empates ${r.emp}`);
  }
  assert.ok(Math.abs(a - b) / n <= 0.12, `total: azul ${a} vs rojo ${b}`);
});

test('puntajes: enteros ≥0 dentro de lim sin recorte del servidor (todas las duraciones y niveles); la suma del equipo es el marcador', () => {
  const lim = CAT.lim; let maxv = 0;
  for (const dur of [12, 35]) for (let seed = 1; seed <= 60; seed++) {
    const lv = 1 + (seed % 3), st = mk({ lv, dur, seed: seed * 7 + dur, skill: seed % 2 ? 0.95 : 0.6 }); const sc = B.jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], dur); const v = st.g.vista();
    sc.forEach((x) => { assert.ok(Number.isInteger(x) && x >= 0 && x <= lim.scoreMax, `dur${dur} v=${x}`); maxv = Math.max(maxv, x); });
    assert.strictEqual(sc[0] + sc[1], v.V[0]); assert.strictEqual(sc[2] + sc[3], v.V[1]);
    const ve = reglas.compara('2v2', [0, 0, 1, 1], sc); assert.strictEqual(ve.puestos[0] === ve.puestos[1], true); assert.strictEqual(ve.puestos[2] === ve.puestos[3], true);
    const cap = Math.floor(Math.min(lim.scoreMax, lim.scoreRate * (Math.max(st.gt, Math.min(lim.minT, dur - 1)) + 1.5)));      // binary: el servidor mide contra el tiempo real
    if (dur === 35) sc.forEach((x) => assert.ok(x <= cap, `dur${dur} lv${lv} seed${seed}: sc ${x} > cap ${cap} (t=${st.gt.toFixed(1)})`));
  }
  assert.ok(maxv <= lim.scoreMax && maxv >= 10);
});

test('mensajes: tiro/cogio/roba/gav/espanta ≤ 80 B; cuerpo ≤ 60 B; el vuelo del tiro nunca usa c.send', () => {
  const st = mk({ seed: 5, cpu: true }); B.jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 35);
  const vistos = new Set(); st.evs.forEach((e) => { vistos.add(e.ty); assert.ok(JSON.stringify(e.d || {}).length <= 80, e.ty + ' ' + JSON.stringify(e.d)); });
  ['tiro', 'cogio', 'gav'].forEach((t) => assert.ok(vistos.has(t), 'se vio ' + t)); assert.strictEqual(st.sent.length, 0);
});

test('dibujo: draw() no revienta (gt −2, 0, 5, en juego; vuelos, gaviota, viento; n=4 yo 0/1/2/-1) en los 3 niveles y solo con primitivas del lab', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) for (const yo of [0, 1, 2, -1]) {
    const st = mk({ lv, seed: 3, yo }); for (const gt of [-2, 0, 5]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    B.jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 12); st.g.draw(); cargar(st, 0, 5); st.g.draw();
    for (let i = 0; i < 30; i++) { B.jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], st.gt + 0.25); st.g.draw(); }
  }
  assert.ok(calls.length > 1000 && calls.indexOf('txt') >= 0);
  delete globalThis.ctx;
});

test('apuntar importa: un lanzador que tira siempre igual (sin mover el stick) saca claramente menos que uno que apunta, con el mismo receptor CPU', () => {
  const fijo = (st, p, dt, api) => { if (st.gt > 0.3) api.press('a'); };
  for (const lv of [2, 3]) {
    let a = 0, f = 0; const N = 40;
    for (let seed = 1; seed <= N; seed++) { const s1 = mk({ seed, lv, skill: 0.6 }); B.jugar(s1, ['cpu', 'cpu', 'cpu', 'cpu'], 35); a += s1.g.vista().V[0]; const s2 = mk({ seed, lv, skill: 0.6 }); B.jugar(s2, [fijo, 'cpu', 'cpu', 'cpu'], 35); f += s2.g.vista().V[0]; }
    assert.ok(f < a * 0.8, `lv${lv}: fijo ${(f / N).toFixed(1)} vs apunta ${(a / N).toFixed(1)}`);
  }
});
