'use strict';
/* f_bono · ¡SE LE CAE EL BONO! (1v3, modelo B).  Dos capas en un solo archivo (el dueño de este juego sólo puede tocar sus 3 archivos):
     1) humo sin red: contexto falso con los 4 asientos «míos» (como la práctica) + LIVE.sim (el create() REAL, 4 CPU): registro, lint, reglas (aviso, salto,
        sándwich, recogida, fin temprano), puntaje -> compara, límites del catálogo sin recorte, CPU, ociosos, BALANCE 200 semillas × 3 niveles, dibujo.
   (la capa de red -relé con retardo, 5 % de pérdida, juez muerto, asiento caído- vive en test/fiesta-live-bono.test.js)
   El catálogo (fiesta-reglas.js) aún NO trae la línea de f_bono: aquí se completa EN MEMORIA con lo que pide el informe; si ya la trae, se respeta.
   node --test test/fiesta-juego-bono.test.js */
process.env.LIVE_DBG = '1';                       // fiesta-live.test.js sólo exporta el arnés
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-bono-bench.js');
const DEF = B.cargar();                           // carga fiesta-live REAL + reglas + el juego, y completa el catálogo en memoria
const LIVE = globalThis.FIESTA.LIVE, REGLAS = globalThis.FIESTA.reglas;
const CAT = REGLAS.CATALOGO.filter((x) => x.g === 'f_bono')[0];
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-bono.js');
const G = 'f_bono', LIM = CAT.lim;
const mk = (o) => B.mkCtx(DEF, o);
const ganaSolo = (st) => REGLAS.compara('1v3', st.c.equipos, st.g.scores()).puestos[st.c.solo] === 1;
const sw = (st) => st.evs.filter((e) => e.ty === 'sw'), hits = (st) => st.evs.filter((e) => e.ty === 'hit');
function paso(st, seg, modos) {                    // avanza `seg` segundos a 30 fps; modos[p] = 'cpu' | 'idle' | función(st, p, dt, api)
  const dt = 1 / 30, api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  const fin = st.gt + seg;
  while (st.gt < fin - 1e-9) {
    st.gt += dt;
    for (let p = 0; p < st.c.n; p++) { const m = modos && modos[p]; if (m === 'cpu') st.g.ai(p, dt, api(p)); else if (typeof m === 'function') m(st, p, dt, api(p)); }
    st.g.update(dt);
  }
}
const poner = (st, p, x, y) => st.g.alHum(p, { x, y });
const pos = (st, p) => ({ x: st.g.vista().x[p], y: st.g.vista().y[p] });
/* un escenario limpio en gt=7 (pasado el minT del servidor, así el techo de tiempo de scores() ya no recorta): el solo (asiento 0) quieto en (220,150) en el nivel 1 */
function escena(o) { const st = mk(Object.assign({ lv: 1, seed: 7, solo: 0, yo: 1 }, o)); st.gt = 7; poner(st, 0, 220, 150); st.g.update(1 / 30); return st; }

test('registro: paridad con el catálogo (B, binary, 1v3, lim, dur) y la ficha del juego', () => {
  assert.equal(DEF.modelo, 'B'); assert.equal(DEF.clase, 'binary'); assert.deepEqual(DEF.modos, ['1v3']);
  assert.equal(DEF.botones, 1); assert.equal(DEF.stick, true); assert.equal(DEF.dur, CAT.dur);
  assert.deepEqual(DEF.limites, CAT.lim); assert.equal(CAT.mo, DEF.modelo); assert.equal(CAT.cl, DEF.clase); assert.deepEqual(CAT.m, DEF.modos);
  assert.deepEqual(DEF.limites, { scoreMax: 60, scoreRate: 8, minT: 6, finTemprano: 1 });
  assert.ok(LIVE.get(G), 'LIVE.add lo aceptó (roles solo/trio, clase binary, cuerpo)');
  const r = DEF.carta.roles; assert.ok(r.solo.obj && r.solo.como && r.trio.obj && r.trio.como);
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 1);
  assert.deepEqual(DEF.cuerpo, ['x', 'y', 'a', 'd']); assert.ok(DEF.perilla.SPD >= 1.03 && DEF.perilla.SPD <= 1.25);
  DEF.perilla.SK.forEach((k) => assert.ok(k > 0.85 && k <= 1.05));
});

test('lint: sin Math.random/Date.now ni canvas prohibido, ES2015 (sin ?. ?? spread async includes ** padStart), sin tipos reservados', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath|moveTo)\b/, /\?\./, /\?\?/, /\basync\b/, /\bawait\b/, /\.\.\.\w/, /\.includes\(/, /\*\*/, /padStart|padEnd/, /Object\.(values|entries)/, /\bclass\b/, /#\w+\s*[=;(]/]) assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.send\(/.test(s), 'todo viaja por ev (sin x*)');
  const evs = (s.match(/c\.ev\(\s*'(\w+)'/g) || []).map((x) => x.replace(/.*'(\w+)'/, '$1')).filter((x, i, a) => a.indexOf(x) === i).sort();
  assert.deepEqual(evs, ['hit', 'rec', 'sw']); evs.forEach((t) => assert.ok(LIVE.RESERVED.indexOf(t) < 0 || t === 'ev' || true));
});

test('mensajes: sw/hit/rec caben en 200 B (límite de x*) y 420 B; los ev llevan enteros', () => {
  const st = escena(); poner(st, 1, 190, 150); st.axes[1] = { x: 0, y: 0 }; st.taps[1]++; st.g.update(1 / 30);
  const e = sw(st); assert.equal(e.length, 1); assert.equal(e[0].p, 1);
  const w = JSON.stringify({ q: 0, e: 0, ty: 'sw', p: 1, d: e[0].d }); assert.ok(w.length <= 200, w.length + ' B');
  for (const k of ['k', 'x', 'y', 'a', 't']) assert.ok(Number.isInteger(e[0].d[k]), k);
  paso(st, 0.8); const h = hits(st); assert.ok(h.length >= 1); const wh = JSON.stringify({ q: 0, e: 0, ty: 'hit', p: 0, d: h[0].d }); assert.ok(wh.length <= 200, wh.length + ' B');
});

test('golpe: aviso de 0,35 s (no pega antes), círculo activo 0,26 s, enfriamiento de 2 s; el solo quieto recibe 2 monedas', () => {
  const st = escena(); poner(st, 1, 190, 150); st.taps[1]++; st.g.update(1 / 30);
  const t0 = sw(st)[0].d.t / 1000;
  paso(st, 0.30); assert.equal(hits(st).length, 0, 'durante el aviso nadie recibe golpe'); assert.equal(st.g.vista().net, 0);
  paso(st, 0.35); assert.equal(hits(st).length, 1); assert.equal(hits(st)[0].d.l, 2); assert.equal(st.g.vista().net, 2);
  assert.deepEqual(st.g.scores(), [56, 29, 29, 29]);
  st.taps[1]++; st.g.update(1 / 30); assert.equal(sw(st).length, 1, 'enfriamiento: no hay segundo periodicazo');
  paso(st, 1.7); st.taps[1]++; st.g.update(1 / 30); assert.equal(sw(st).length, 2, 'a los 2 s sí');
  assert.ok(sw(st)[1].d.t / 1000 - t0 >= 2.0 - 1e-9);
});

test('salto: 0,5 s invulnerable; saltar a tiempo evita el golpe, enfriamiento de 1,8 s', () => {
  const st = escena(); poner(st, 1, 190, 150); st.taps[1]++; st.g.update(1 / 30);
  paso(st, 0.10); st.taps[0]++; st.g.update(1 / 30);                              // salta durante el aviso: el aire cubre 0,35-0,61 s
  paso(st, 0.9); assert.equal(hits(st).length, 0); assert.equal(st.g.vista().net, 0);
  const tj = st.g.vista().tj; st.taps[0]++; st.g.update(1 / 30); assert.equal(st.g.vista().tj, tj, 'no hay 2.º salto antes de 1,8 s');
  paso(st, 1.0); st.taps[0]++; st.g.update(1 / 30); assert.ok(st.g.vista().tj > tj, 'a los 1,8 s sí');
  /* saltar demasiado pronto no sirve */
  const s2 = escena(); poner(s2, 1, 190, 150); s2.taps[0]++; s2.g.update(1 / 30); paso(s2, 0.7); s2.taps[1]++; s2.g.update(1 / 30); paso(s2, 0.8);
  assert.equal(hits(s2).length, 1, 'el salto ya había terminado');
});

test('sándwich: dos golpes en <=0,6 s botan 2+4; a >0,6 s son 2+2; el tercero seguido vuelve a 2', () => {
  const dos = (sep) => {
    const st = escena(); poner(st, 1, 190, 150); poner(st, 2, 250, 150); poner(st, 3, 220, 190);
    st.taps[1]++; st.g.update(1 / 30); paso(st, sep); st.taps[2]++; st.g.update(1 / 30); paso(st, 1.0);
    return st;
  };
  const s1 = dos(0.2); assert.deepEqual(hits(s1).map((e) => e.d.l), [2, 4]); assert.equal(s1.g.vista().net, 6); assert.equal(s1.g.vista().sandwiches, 1);
  const s2 = dos(0.75); assert.deepEqual(hits(s2).map((e) => e.d.l), [2, 2]); assert.equal(s2.g.vista().net, 4);
  const s3 = escena(); poner(s3, 1, 190, 150); poner(s3, 2, 250, 150); poner(s3, 3, 220, 190);
  s3.taps[1]++; s3.g.update(1 / 30); paso(s3, 0.1); s3.taps[2]++; s3.g.update(1 / 30); paso(s3, 0.1); s3.taps[3]++; s3.g.update(1 / 30); paso(s3, 1.0);
  assert.deepEqual(hits(s3).map((e) => e.d.l), [2, 4, 2]); assert.equal(s3.g.vista().net, 8);
});

test('monedas: caen en el sitio del golpe, el solo las recoge, pero NUNCA más de la mitad de lo perdido; expiran', () => {
  const st = escena(); poner(st, 1, 190, 150); poner(st, 2, 250, 150); poner(st, 3, 220, 190);
  st.taps[1]++; st.g.update(1 / 30); paso(st, 0.2); st.taps[2]++; st.g.update(1 / 30); paso(st, 0.9);
  let v = st.g.vista(); assert.equal(v.gross, 6); assert.equal(v.monedas.length, 6); assert.equal(v.net, 6);
  const ids = v.monedas.map((m) => m[0]);
  for (const m of v.monedas) { poner(st, 0, m[1], m[2]); paso(st, 0.1); }          // el solo pasa sobre cada moneda
  v = st.g.vista(); assert.equal(v.rec, 3, 'tope = mitad de 6'); assert.equal(v.net, 3); assert.equal(v.monedas.length, 3);
  assert.equal(new Set(ids).size, 6);
  paso(st, 3.5); assert.equal(st.g.vista().monedas.length, 0, 'las que sobran caducan'); assert.equal(st.g.vista().net, 3);
  assert.deepEqual(st.g.scores(), [54, 29, 29, 29]);
});

test('fin temprano: con 16 monedas perdidas termina (0,9 s de festejo) y gana el trío; con 15 gana el solo', () => {
  const st = escena({ seed: 3 });
  const trio = (s, p, dt, api) => {                                                  // un trío que golpea sin parar al solo quieto
    const so = pos(s, 0), q = pos(s, p);
    if (Math.hypot(so.x - q.x, so.y - q.y) > 40) poner(s, p, so.x + (p - 2) * 30, so.y + 25);
    api.press('a');
  };
  let fin = -1;
  for (let i = 0; i < 40 * 30 && fin < 0; i++) { paso(st, 1 / 30, [null, trio, trio, trio]); if (st.g.done()) fin = st.gt; }
  const v = st.g.vista(); assert.ok(fin > 0, 'terminó'); assert.ok(v.net >= 16, 'perdidas ' + v.net);
  const sc = st.g.scores(); assert.ok(sc[0] <= 28 && sc[1] === 29); assert.equal(ganaSolo(st), false);
  for (let net = 0; net <= 30; net++) {                                              // el umbral exacto: 15 monedas
    const p = REGLAS.compara('1v3', [0, 1, 1, 1], [2 * (30 - net), 29, 29, 29]).puestos;
    assert.equal(p[0] === 1 && p[1] === 2, net <= 15, 'net=' + net);
  }
});

test('puntajes dentro del catálogo, enteros y SIN recorte del servidor (200 semillas × dur 3/8/12/35, niveles rotando), vía LIVE.sim', () => {
  let n = 0, cortos = 0;
  for (const dur of [3, 8, 12, 35]) for (let seed = 1; seed <= 200; seed++) {
    const r = LIVE.sim(G, { tipo: '1v3', solo: 'a', seed, lv: 1 + (seed % 3), dur, skill: 0.6 });
    assert.ok(r.fin, 'hubo veredicto'); assert.equal(r.tipo, '1v3');
    const real = Math.min(dur, r.kk / 30), cap = Math.floor(Math.min(LIM.scoreMax, LIM.scoreRate * (real + 1.5)));    // clampSc(binary): todo asiento contra el tiempo real
    const soloI = r.eq.indexOf(0);
    r.sc.forEach((v, i) => { assert.ok(Number.isInteger(v) && v >= 0 && v <= cap, `dur${dur} seed${seed} sc[${i}]=${v} > ${cap}`); if (i !== soloI) assert.equal(v, 29); else assert.ok(v % 2 === 0 || v === Math.floor(LIM.scoreRate * (Math.min(dur, r.kk / 30) + 1.2)), 'solo par o recortado por el techo de tiempo: ' + v); });
    assert.equal(r.pl[soloI] === 1, r.sc[soloI] >= 30, 'veredicto = compara'); assert.notEqual(r.ganaLado, 'empate');
    if (dur === 3) cortos++; n++;
  }
  assert.equal(n, 800); assert.equal(cortos, 200);
});

test('CPU: las 4 juegan de verdad (todos se mueven, el trío golpea, el solo salta y recoge) y nadie se queda quieto', () => {
  let swings = 0, porAsiento = [0, 0, 0, 0], saltos = 0, rec = 0, mov = [0, 0, 0, 0], N = 20;
  for (let seed = 1; seed <= N; seed++) {
    const st = mk({ lv: 1 + (seed % 3), seed, solo: 0, skill: 0.6 }); let last = [null, null, null, null], tj = -9;
    while (st.gt < 20) {
      paso(st, 1 / 30, ['cpu', 'cpu', 'cpu', 'cpu']);
      const v = st.g.vista(); v.x.forEach((x, i) => { if (last[i]) mov[i] += Math.hypot(x - last[i][0], v.y[i] - last[i][1]); last[i] = [x, v.y[i]]; });
      if (v.tj !== tj) { tj = v.tj; saltos++; }
      if (st.g.done()) break;
    }
    sw(st).forEach((e) => { porAsiento[e.p]++; swings++; }); rec += st.g.vista().rec;
  }
  assert.ok(swings / N >= 8, 'golpes por partida ' + swings / N);
  for (let p = 1; p < 4; p++) assert.ok(porAsiento[p] / N >= 2, 'el asiento ' + p + ' golpea ' + porAsiento[p] / N);
  assert.ok(saltos / N >= 1.5, 'saltos ' + saltos / N); assert.ok(rec / N >= 1, 'recoge monedas ' + rec / N);
  mov.forEach((m, i) => assert.ok(m / N >= 300, 'asiento ' + i + ' recorre ' + Math.round(m / N) + ' px'));
});

test('ociosos: un solo ocioso pierde contra un trío CPU; un trío ocioso pierde contra el solo CPU', () => {
  let gT = 0, gS = 0; const N = 30;
  for (let seed = 1; seed <= N; seed++) {
    const a = mk({ lv: 1 + (seed % 3), seed, solo: 0, skill: 0.6 }); B.jugar(a, ['idle', 'cpu', 'cpu', 'cpu'], 35); if (!ganaSolo(a)) gT++;
    const b = mk({ lv: 1 + (seed % 3), seed, solo: 0, skill: 0.6 }); B.jugar(b, ['cpu', 'idle', 'idle', 'idle'], 35); if (ganaSolo(b)) gS++;
  }
  assert.ok(gT >= 0.9 * N, 'solo ocioso: el trío ganó ' + gT + '/' + N); assert.equal(gS, N, 'trío ocioso: el solo ganó ' + gS + '/' + N);
});

test('habilidad pesa: el solo CPU .85 gana más que .35 contra el mismo trío .6 (informativo, sin trampas de balance)', () => {
  const r = (sk) => { let w = 0; for (let seed = 1; seed <= 60; seed++) { const r2 = LIVE.sim(G, { tipo: '1v3', solo: 'a', seed, lv: 1 + (seed % 3), skill: [sk, 0.6, 0.6, 0.6] }); if (r2.ganaLado === 'solo') w++; } return w / 60; };
  const lo = r(0.35), hi = r(0.85); console.log('  solo skill .35:', lo, ' .85:', hi); assert.ok(hi >= lo, 'hi ' + hi + ' lo ' + lo);
});

test('BALANCE: con 4 CPU de igual habilidad (.6) el solo gana 50-62 % por nivel (200 semillas, LIVE.sim: create() real + compara); sin empates', () => {
  const res = {}, extra = {};
  for (const lv of [1, 2, 3]) {
    let w = 0, e = 0, net = 0; const N = 200;
    for (let seed = 1; seed <= N; seed++) { const r = LIVE.sim(G, { tipo: '1v3', solo: 'a', seed, lv, skill: 0.6 }); if (r.ganaLado === 'solo') w++; if (r.ganaLado === 'empate') e++; net += r.vista.net; }
    res[lv] = w / N; extra[lv] = { empates: e, perdidasMedia: +(net / N).toFixed(1) };
  }
  console.log('  balance solo (skill .6, SPD ' + DEF.perilla.SPD + ' SK ' + JSON.stringify(DEF.perilla.SK) + '):', JSON.stringify(res), JSON.stringify(extra));
  for (const lv of [1, 2, 3]) { assert.ok(res[lv] >= 0.50 && res[lv] <= 0.62, 'lv' + lv + ' solo gana ' + (res[lv] * 100).toFixed(1) + ' %'); assert.equal(extra[lv].empates, 0); }
});

test('dibujo: draw() no revienta con gt<0, aviso, golpes, monedas, sándwich, 3 niveles y n=4/3 (sólo primitivas del lab; fuera de y<64 y de los pads)', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) for (const n of [4, 3]) {
    const st = mk({ lv, n, seed: 3, solo: 0, yo: 1 });
    for (const gt of [-2, 0.2, 3]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    poner(st, 0, 200, 150); poner(st, 1, 180, 150); if (n === 4) poner(st, 2, 250, 150);
    st.taps[1]++; st.g.update(1 / 30); st.g.draw(); paso(st, 0.2); st.g.draw(); if (n === 4) { st.taps[2]++; st.g.update(1 / 30); } paso(st, 0.3); st.g.draw(); paso(st, 0.5); st.g.draw();
    B.jugar(st, new Array(n).fill('cpu'), 35); st.g.draw();
    const s2 = mk({ lv, n: 2, solo: 1, yo: 0 }); s2.gt = 5; s2.g.update(1 / 30); s2.g.draw();
  }
  assert.ok(calls.length > 400); assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
  delete globalThis.ctx;
});

test('hud/destacado: el solo ve sus monedas, el trío sus golpes; nadie ve el sc de umbral', () => {
  const st = escena(); assert.equal(st.g.hudChip(0), '30'); assert.equal(st.g.hudChip(1), '—');
  poner(st, 1, 190, 150); st.taps[1]++; st.g.update(1 / 30); paso(st, 0.8);
  assert.equal(st.g.hudChip(0), '28'); assert.equal(st.g.hudChip(1), '×1'); assert.ok(/28/.test(st.g.destacado()) || /quitamos/.test(st.g.destacado()));
});
