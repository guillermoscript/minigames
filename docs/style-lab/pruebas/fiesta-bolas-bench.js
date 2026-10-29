'use strict';
/* Banco headless de f_bolas (FFA, modelo C: el juez simula todas las bolas).
     node docs/style-lab/pruebas/fiesta-bolas-bench.js           lint, determinismo, pack/restore EXACTOS, reglas, CPU, ociosos, límites, dibujo y resumen de balance
     N=300 node …                                                semillas por celda del resumen (por defecto 200)
     node docs/style-lab/pruebas/fiesta-bolas-bench.js --red     sobre el stack REAL (4 humanos-bot iguales, 50/150/300 ms, 5 % de pérdida): ventaja del juez (informativo)
   Un contexto falso con este proceso de juez: llama a ai() de las CPU, step() a 1/30 y update(). Los humanos remotos se simulan con c.cpu[p] = false y el handler de `xtiro`.
   El ganador sale de FIESTA.reglas.compara('ffa'). Exporta cargar/mkCtx/tick/jugar/medir para test/fiesta-juego-bolas.test.js. */
const path = require('path'), fs = require('fs');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-bolas.js');
const rng = require(path.join(SL, 'fiesta-rng.js'));
const reglas = require(path.join(SL, 'fiesta-reglas.js'));
const LIM = { scoreMax: 12, scoreRate: 1, minT: 26, finTemprano: 1 };          // propuesta de catálogo (fiesta-reglas aún no trae lim de f_bolas)

/* primitivas del lab contadas y un ctx que solo admite transformaciones y globalAlpha */
const CALLS = {}, BANNED = [];
const ALLOWED_CTX = new Set(['save', 'restore', 'translate', 'rotate', 'scale']);
function stubs() {
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = function () { CALLS[nm] = (CALLS[nm] || 0) + 1; };
  globalThis.ctx = new Proxy({}, {
    get(t, k) { if (k in t) return t[k]; return () => { if (!ALLOWED_CTX.has(k)) BANNED.push(String(k)); }; },
    set(t, k, v) { if (k !== 'globalAlpha') BANNED.push('set:' + String(k)); t[k] = v; return true; }
  });
  globalThis.BUS = { AP: { CAST: { tio: { x: 0 } } } };
}
function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng, reglas, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } });
  stubs();
  delete require.cache[SRC];
  require(SRC);
  return defs.f_bolas;
}

/* in[p] = {x,y,a}; c.cpu: por defecto todos «locales» (este proceso mueve sus lanzadores en step); o.remotos = [p...] simula humanos remotos (solo xtiro) */
function mkCtx(DEF, o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1;
  const st = { gt: 0, in: Array.from({ length: n }, () => ({ x: 0, y: 0, a: false, tap: 0 })), g: null, sent: [], h: {} };
  const cpu = Array.from({ length: n }, (_, p) => !(o.remotos && o.remotos.indexOf(p) >= 0));
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: n === 2 ? '1v1' : 'ffa', solo: -1, equipos: Array.from({ length: n }, (_, i) => i), lv, dur, practica: !!o.practica, modelo: 'C', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: ['#ff6b6b', '#4dd0e1', '#ffd23f', '#9b6bff'][i], cpu: false, human: true, team: i })),
    campo: () => ({ x0: o.x0 === undefined ? 0 : o.x0, x1: o.x1 === undefined ? 800 : o.x1, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: (p, b) => (b === 'b' ? false : st.in[p].a), tap: (p) => { const v = st.in[p].tap; st.in[p].tap = 0; return v; },
    eje: (p) => ({ x: st.in[p].x, y: st.in[p].y }), cpu,
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => o.juez !== false, mio: () => true, remoto: () => null, ev() {}, out() {}, claim() {},
    send: (t, d) => { st.sent.push({ t, d, gt: st.gt }); return true; }, on: (t, fn) => { st.h[t] = fn; },
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
const api = (st, p) => ({ press: () => { st.in[p].tap++; }, hold: (b, v) => { if (b !== 'b') st.in[p].a = !!v; }, eje: (x, y) => { st.in[p].x = x; st.in[p].y = y; } });
/* un tick del juez: ai de las CPU -> step -> update. modos[p] = 'cpu' | 'idle' | función(st,p,api) */
function tick(st, modos, m) {
  const n = st.c.n;
  for (let p = 0; p < n; p++) { const f = modos[p]; if (f === 'cpu') st.g.ai(p, 1 / 30, api(st, p)); else if (typeof f === 'function') f(st, p, api(st, p)); }
  st.g.step(1 / 30); st.gt += 1 / 30; st.g.update(1 / 30);
  if (m) m(st);
}
/* hasta done() tras minT, o hasta dur (como el runtime con finTemprano) */
function jugar(st, modos, segs, m) {
  const t = Math.round((segs == null ? st.c.dur : segs) * 30), minT = Math.min(LIM.minT, st.c.dur - 1);
  for (let i = 0; i < t; i++) { tick(st, modos, m); if (st.gt >= minT && st.g.done()) break; }
  return st.g.scores();
}
const veredicto = (st) => reglas.compara('ffa', st.c.equipos, st.g.scores());
const CPU4 = ['cpu', 'cpu', 'cpu', 'cpu'];

/* N partidas: cuota de victorias por asiento (empate en 1.º = reparto), puntos medios, choques, patadas, «más cerca que el bono» */
function medir(DEF, o) {
  o = o || {};
  const N = o.N || +process.env.N || 200, n = o.n || 4, modos = o.modos || CPU4.slice(0, n), dur = o.dur || DEF.dur;
  const r = { N, win: new Array(n).fill(0), pts: new Array(n).fill(0), fin: 0, choques: 0, patadas: 0, bono: 0, rondas: 0, sinBola: 0, maxSc: 0, tMin: 1e9, tMax: 0, done: 0, sumas: [] };
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx(DEF, { n, lv: o.lv || 1, seed: (o.seed0 || 0) + seed, dur, skill: o.skill == null ? 0.6 : o.skill });
    let ch = st.g.vista().choqN, pat = 0, lastF = -1;
    jugar(st, modos, dur, (s) => {
      const v = s.g.vista();
      if (v.choqN !== ch) { r.choques++; ch = v.choqN; }
      if (v.pat && !pat) r.patadas++; pat = v.pat;
      if (v.fase === 2 && lastF !== 2) { r.rondas++; const best = v.rank.filter((x) => x.d >= 0).map((x) => x.d); if (best.length && Math.min.apply(null, best) < 19.5) r.bono++; r.sinBola += v.rank.filter((x) => x.d < 0).length; }
      lastF = v.fase;
    });
    const sc = st.g.scores(), ve = veredicto(st), firsts = ve.puestos.filter((x) => x === 1).length;
    ve.puestos.forEach((x, i) => { if (x === 1) r.win[i] += 1 / firsts; });
    sc.forEach((x, i) => { r.pts[i] += x; r.maxSc = Math.max(r.maxSc, x); });
    r.sumas.push(sc.reduce((a, b) => a + b, 0));
    r.fin += st.gt; r.tMin = Math.min(r.tMin, st.gt); r.tMax = Math.max(r.tMax, st.gt); if (st.g.done()) r.done++;
  }
  r.finM = r.fin / N;
  return r;
}
const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';

/* ───────────── comprobaciones ───────────── */
let fails = 0;
function ok(name, cond, extra) { if (cond) console.log('  ok   ' + name); else { fails++; console.log('  FAIL ' + name + (extra ? ' -> ' + extra : '')); } }
const I = { k: 0, r: 1, fase: 2, ft: 3, choqN: 4, mx: 8, my: 9, mvx: 10, mvy: 11, pat: 12, u: (p) => 13 + 2 * p, lp: (p) => 14 + 2 * p, b: (j) => 21 + 5 * j };
function edita(st, f) { const a = st.g.pack(); f(a); st.g.restore(a); }
function ponBola(a, j, x, y, vx, vy) { const o = I.b(j); a[o] = Math.round(x * 4); a[o + 1] = Math.round(y * 4); a[o + 2] = Math.round((vx || 0) * 64); a[o + 3] = Math.round((vy || 0) * 64); a[o + 4] = 1; }

function bench() {
  const src = fs.readFileSync(SRC, 'utf8'), code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  console.log('lint');
  ok('sin Math.random', !/Math\.random/.test(code));
  ok('sin Date.now / performance.now', !/Date\.now|performance\.now/.test(code));
  ok('sin ctx.fill/stroke/arc/lineTo/drawImage/fillText/beginPath', !/ctx\.(fill|stroke|arc|lineTo|moveTo|drawImage|fillText|fillRect|beginPath|ellipse)\b/.test(code));
  ok('sin ?. ?? spread async => class (dialecto ES5 de fiesta-*.js)', !/\?\.|\?\?|\.\.\.[a-zA-Z{]|\basync\b|=>|\bclass\b|\blet\b|\bconst\b/.test(code));
  ok('solo envía el tipo propio xtiro', (code.match(/c\.send\('([a-z0-9]+)'/g) || []).every((s) => /xtiro/.test(s)));

  const DEF = cargar();
  ok('registra f_bolas: C, rank, ffa, 1 botón + stick, packN 81', DEF && DEF.modelo === 'C' && DEF.clase === 'rank' && JSON.stringify(DEF.modos) === '["ffa"]' && DEF.botones === 1 && DEF.stick && DEF.packN === 81);
  ok('limites = propuesta ' + JSON.stringify(LIM), JSON.stringify(DEF.limites) === JSON.stringify(LIM));
  ok('carta completa', DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 2);

  console.log('determinismo / pack / restore');
  {
    const a = mkCtx(DEF, { seed: 11, lv: 3 }), b = mkCtx(DEF, { seed: 11, lv: 3 });
    let maxS = 0, maxS2 = 0;
    for (let i = 0; i < 1100; i++) {
      tick(a, CPU4); tick(b, CPU4);
      const p = a.g.pack();
      maxS = Math.max(maxS, JSON.stringify({ q: 0, e: 3, t: 34500, p: p.slice(0, 60) }).length);
      maxS2 = Math.max(maxS2, JSON.stringify({ q: 0, e: 3, t: 34500, p: p.slice(60) }).length);
    }
    ok('misma semilla => mismo pack final', JSON.stringify(a.g.pack()) === JSON.stringify(b.g.pack()));
    const pk = a.g.pack();
    ok('pack = 81 enteros finitos', pk.length === 81 && pk.every((v) => Number.isInteger(v) && isFinite(v)));
    ok('mensajes s ≤420 B (máx ' + maxS + ') y s2 (máx ' + maxS2 + ')', maxS <= 420 && maxS2 <= 420);
  }
  {
    /* restore a mitad de una rodada con bolas en movimiento; luego ambos reciben los MISMOS xtiro remotos en los mismos ticks */
    const rem = [1, 2, 3], A = mkCtx(DEF, { seed: 5, lv: 3, remotos: rem });
    /* guion remoto relativo al estado (igual en A y B): cada remoto lanza a una hora fija de la ventana */
    const remoto = (st) => { const v = st.g.vista(); if (v.fase !== 0) return; for (const p of rem) if (v.ft === 20 + p * 31 + v.r * 9) st.h.xtiro({ r: v.r, a: -300 + p * 150 + v.r * 40, f: 480 + p * 60 }, p); };
    let T = 0, moving = false;
    for (; T < 1000; T++) { remoto(A); tick(A, ['idle', 'idle', 'idle', 'idle']); if (T > 120 && A.g.vista().b.filter((b) => b.act && (b.vx || b.vy)).length >= 2) { moving = true; T++; break; } }
    const snap = A.g.pack();
    const B2 = mkCtx(DEF, { seed: 5, lv: 3, remotos: rem }); B2.g.restore(snap); B2.gt = A.gt;
    let igual = true, enMov = moving;
    for (let k = T; k < 1050; k++) {
      remoto(A); remoto(B2);
      tick(A, ['idle', 'idle', 'idle', 'idle']); tick(B2, ['idle', 'idle', 'idle', 'idle']);
      if (JSON.stringify(A.g.pack()) !== JSON.stringify(B2.g.pack())) { igual = false; break; }
    }
    ok('restore a mitad (tick ' + T + ', 2+ bolas rodando: ' + enMov + ') => mismo pack tick a tick hasta el final', igual && enMov);
    const rt = B2.g.pack(); B2.g.unpack(rt); ok('unpack(pack()) es identidad', JSON.stringify(B2.g.pack()) === JSON.stringify(rt));
    ok('los xtiro remotos entraron (9 bolas de P1..P3)', A.g.vista().b.filter((b, j) => b.act && j >= 3).length === 9);
  }

  console.log('reglas');
  {
    const st = mkCtx(DEF, { seed: 2, remotos: [1, 2, 3] }), v = st.g.vista();
    ok('Nv1 sin viento; Nv2/3 con viento ±0,012-0,032', v.WX.every((w) => w === 0) && mkCtx(DEF, { seed: 2, lv: 2 }).g.vista().WX.every((w) => Math.abs(w) >= 0.012 && Math.abs(w) <= 0.033));
    ok('ventana 6,2 s, rodada ≤3 s, medición 2 s con dur 35', v.AIMT === 186 && v.ROLLK === 90 && v.MEDK === 60);
    st.h.xtiro({ r: 0, a: 0, f: 600 }, 1); tick(st, ['idle', 'idle', 'idle', 'idle']);
    ok('xtiro del lanzamiento vigente => bola de P1 activa y rodando', st.g.vista().b[3].act === 1 && st.g.vista().b[3].vy < 0);
    const y0 = st.g.vista().b[3].vy; st.h.xtiro({ r: 0, a: 300, f: 999 }, 1); tick(st, ['idle', 'idle', 'idle', 'idle']);
    ok('xtiro repetido no cambia nada (dedup por bola)', Math.abs(st.g.vista().b[3].vx) < 0.5 && st.g.vista().b[3].vy > y0 - 0.01);
    st.h.xtiro({ r: 1, a: 0, f: 600 }, 2); tick(st, ['idle', 'idle', 'idle', 'idle']);
    ok('xtiro de otro lanzamiento se ignora', st.g.vista().b[2 * 3 + 1].act === 0 && st.g.vista().b[2 * 3].act === 0);
    for (let i = 0; i < 120; i++) tick(st, ['idle', 'idle', 'idle', 'idle']);
    const bb = st.g.vista().b[3], alc = 400 - bb.y;
    ok('fuerza 0,6 rueda ~' + alc.toFixed(0) + ' px recto (≈180-240)', bb.vx === 0 && bb.vy === 0 && alc > 180 && alc < 240 && Math.abs(bb.x - v.XS[1]) < 1);
    /* gracia: tras cerrar la ventana se acepta ≤0,8 s */
    const g2 = mkCtx(DEF, { seed: 2, remotos: [1, 2, 3] });
    for (let i = 0; i < 186 + 60; i++) tick(g2, ['idle', 'idle', 'idle', 'idle']);
    g2.h.xtiro({ r: 0, a: 0, f: 500 }, 2); tick(g2, ['idle', 'idle', 'idle', 'idle']);
    ok('falta gente: la rodada espera y un xtiro 2 s tras cerrar se acepta', g2.g.vista().b[6].act === 1 && g2.g.vista().fase === 1);
    for (let i = 0; i < 100; i++) tick(g2, ['idle', 'idle', 'idle', 'idle']);
    g2.h.xtiro({ r: 0, a: 0, f: 500 }, 3); tick(g2, ['idle', 'idle', 'idle', 'idle']);
    ok('xtiro después de la gracia se pierde', g2.g.vista().b[9].act === 0);
  }
  {
    /* medidor del asiento local: mantener A 1,1 s = fuerza 1; soltar lanza */
    const st = mkCtx(DEF, { seed: 3, remotos: [1, 2, 3] }); st.in[0].a = true;
    for (let i = 0; i < 25; i++) tick(st, ['idle', 'idle', 'idle', 'idle']);
    const th = st.g.vista().th[0]; ok('mantener A carga el medidor (m=' + th.m.toFixed(2) + ')', th.carg === 1 && Math.abs(th.m - 24 / 30) < 1e-6);
    st.in[0].a = false; tick(st, ['idle', 'idle', 'idle', 'idle']);
    const b = st.g.vista().b[0], sp = Math.hypot(b.vx, b.vy);
    const esp = 3 + (24 / 30) / 1.1 * 6.6 - 0.12;
    ok('soltar A lanza con la fuerza del medidor (v=' + sp.toFixed(2) + ' ≈ ' + esp.toFixed(2) + ')', b.act === 1 && Math.abs(sp - esp) < 0.05);
    const g3 = mkCtx(DEF, { seed: 3, remotos: [1, 2, 3] }); g3.in[0].x = 1; for (let i = 0; i < 70; i++) tick(g3, ['idle', 'idle', 'idle', 'idle']);
    const a1 = g3.g.vista().th[0].ang; ok('el stick gira la puntería (60°/s, tope 60°): ' + a1.toFixed(1), a1 === 60);
    const g4 = mkCtx(DEF, { seed: 3, remotos: [1, 2, 3] }); g4.in[0].a = true; for (let i = 0; i < 200; i++) tick(g4, ['idle', 'idle', 'idle', 'idle']);
    ok('al cerrarse la ventana cargando, lanza solo', g4.g.vista().b[0].act === 1);
  }
  {
    /* choque: bola rodando contra una quieta => la quieta sale disparada y cuenta un choque */
    const st = mkCtx(DEF, { seed: 4, remotos: [1, 2, 3] });
    edita(st, (a) => { ponBola(a, 3, 400, 250, 0, 0); ponBola(a, 0, 400, 330, 0, -6); a[I.mx] = 300 * 4; a[I.my] = 150 * 4; });
    const c0 = st.g.vista().choqN; for (let i = 0; i < 20; i++) tick(st, ['idle', 'idle', 'idle', 'idle']);
    const v = st.g.vista();
    ok('¡clac!: la quieta sale (vy=' + v.b[3].vy.toFixed(2) + ') y la que pega casi se para; choqN sube', v.b[3].y < 245 && v.choqN === c0 + 1 && Math.abs(v.b[0].vy) < Math.abs(v.b[3].vy));
    const s2 = mkCtx(DEF, { seed: 4, remotos: [1, 2, 3] }); edita(s2, (a) => { a[I.mx] = 400 * 4; a[I.my] = 250 * 4; ponBola(a, 0, 400, 330, 0, -6); });
    for (let i = 0; i < 40; i++) tick(s2, ['idle', 'idle', 'idle', 'idle']);
    ok('la bola empuja al mingo (más liviano): sale más lejos', s2.g.vista().m.y < 230);
  }
  {
    /* medición: 4/2/1/0 por la mejor bola de cada uno; sin bola = 0 */
    const st = mkCtx(DEF, { seed: 6, remotos: [1, 2, 3] });
    edita(st, (a) => { a[I.fase] = 1; a[I.ft] = 80; a[I.mx] = 400 * 4; a[I.my] = 200 * 4; ponBola(a, 0, 400, 260); ponBola(a, 3, 430, 200); ponBola(a, 4, 400, 215); ponBola(a, 6, 300, 300); });
    tick(st, ['idle', 'idle', 'idle', 'idle']);
    const v = st.g.vista();
    ok('mide 4/2/1/0 por la mejor bola (P1 a 15 px, P0 a 60, P2 a 141, P3 sin bola) => ' + JSON.stringify(v.lp), JSON.stringify(v.lp) === JSON.stringify([2, 4, 1, 0]) && JSON.stringify(v.u) === JSON.stringify([2, 4, 1, 0]) && v.fase === 2);
    for (let i = 0; i < 60; i++) tick(st, ['idle', 'idle', 'idle', 'idle']);
    ok('tras la medición empieza el lanzamiento 2', st.g.vista().r === 1 && st.g.vista().fase === 0);
  }
  {
    const st = mkCtx(DEF, { seed: 7, lv: 3, remotos: [1, 2, 3] }), K = st.g.vista().KICK, m0 = st.g.vista().m;
    ok('Nv3: patadas sembradas dentro de la ventana con aviso: ' + K.join(','), K.every((k) => k >= 34 && k <= 165));
    for (let i = 0; i < K[0] + 40; i++) tick(st, ['idle', 'idle', 'idle', 'idle']);
    const m1 = st.g.vista().m; ok('el carajito patea el mingo y se mueve ' + Math.hypot(m1.x - m0.x, m1.y - m0.y).toFixed(0) + ' px', st.g.vista().pat === 1 && Math.hypot(m1.x - m0.x, m1.y - m0.y) > 25);
    ok('Nv1-2 sin patada', (() => { const s = mkCtx(DEF, { seed: 7, lv: 2 }); for (let i = 0; i < 200; i++) tick(s, ['idle', 'idle', 'idle', 'idle']); return s.g.vista().pat === 0; })());
  }
  {
    const st = mkCtx(DEF, { seed: 8 }); jugar(st, CPU4);
    ok('partida de 4 CPU termina (done) en ' + st.gt.toFixed(1) + ' s (≥ minT 26, ≤ 35)', st.g.done() && st.gt >= 26 && st.gt <= 35);
    const p20 = mkCtx(DEF, { seed: 8, dur: 20 }); jugar(p20, CPU4, 20);
    ok('dur 20 (práctica): los 3 lanzamientos caben (' + p20.gt.toFixed(1) + ' s)', p20.g.done());
  }

  console.log('CPU y balance (' + (+process.env.N || 200) + ' semillas por celda)');
  for (const lv of [1, 2, 3]) {
    const r = medir(DEF, { lv });
    const w = r.win.map((x) => x / r.N), sp = Math.max.apply(null, w) - Math.min.apply(null, w);
    console.log('   lv' + lv + ' 4 CPU .6: gana por asiento ' + w.map(pct).join(' ') + ' · pts medios ' + r.pts.map((x) => (x / r.N).toFixed(1)).join('/') + ' · choques/partida ' + (r.choques / r.N).toFixed(1) +
      ' · «más cerca que el bono» ' + pct(r.bono / Math.max(1, r.rondas)) + ' de los lanzamientos · patadas/partida ' + (r.patadas / r.N).toFixed(1) + ' · fin ' + r.tMin.toFixed(1) + '-' + r.tMax.toFixed(1) + ' s');
    ok('lv' + lv + ': todos terminan antes de dur y después de minT', r.done === r.N && r.tMin >= 26 && r.tMax <= 35);
    ok('lv' + lv + ': cada asiento gana entre 15 y 35 % (dispersión ' + pct(sp) + ')', w.every((x) => x >= 0.15 && x <= 0.35));
    ok('lv' + lv + ': puntajes en [0, 12], todos lanzan siempre y la suma es 21 (más si hay empate exacto)', r.maxSc <= 12 && r.sumas.every((s) => s >= 21 && s <= 36) && r.sinBola === 0);
    ok('lv' + lv + ': hay choques (≥2 por partida)', r.choques / r.N >= 2);
  }
  {
    const r = medir(DEF, { lv: 1, N: 120, skill: [0.9, 0.3, 0.3, 0.3] });
    console.log('   .9 vs tres .3 (lv1): gana el .9 ' + pct(r.win[0] / r.N));
    ok('la habilidad pesa: skill .9 gana ≥36 % contra tres .3 (azar 25 %)', r.win[0] / r.N >= 0.36);
    let bad = 0, tot = 0;
    for (const lv of [1, 2, 3]) { const o = medir(DEF, { lv, N: 40, modos: ['idle', 'idle', 'cpu', 'cpu'] }); bad += o.win[0] + o.win[1]; tot += o.N; }
    ok('2 ociosos + 2 CPU (120 partidas): los ociosos nunca ganan', bad === 0, 'ganó un ocioso ' + bad);
    const d2 = medir(DEF, { lv: 2, n: 2, N: 60 }); ok('n=2 (1v1 de práctica) corre: ' + d2.win.map((x) => pct(x / d2.N)).join(' '), d2.done === d2.N && d2.maxSc <= 12);
    const d3 = medir(DEF, { lv: 3, n: 3, N: 60 }); ok('n=3 corre y respeta límites', d3.done === d3.N && d3.maxSc <= 12);
  }

  console.log('viewer (no juez): unpack + lerp + update + draw en 3 niveles');
  for (const lv of [1, 2, 3]) {
    const J = mkCtx(DEF, { seed: 40 + lv, lv, remotos: [1] }), frames = [];
    for (let k = 0; k < 1050 && !J.g.done(); k++) { tick(J, ['cpu', 'idle', 'cpu', 'cpu']); if (k % 3 === 0) frames.push(J.g.pack()); }
    const V = mkCtx(DEF, { seed: 40 + lv, lv, juez: false, yo: 1, x0: -60, x1: 860 });
    let err = null;
    try {
      for (let i = 0; i + 1 < frames.length; i++) {
        const mid = V.g.lerp(frames[i], frames[i + 1], 0.5); if (mid.length !== 81) throw new Error('lerp len');
        V.g.unpack(mid); V.in[1].a = (i % 50) < 30; V.in[1].x = Math.sin(i / 7);
        V.g.update(1 / 10); V.g.draw();
      }
      V.g.vista(); V.g.destacado(); V.g.hudChip(0);
      const P = mkCtx(DEF, { seed: 1, lv, practica: true, n: 2 }); P.g.update(0.016); P.g.draw();
    } catch (e) { err = e; }
    ok('lv' + lv + ' draw/lerp/update del no-juez sin excepción', !err, err && err.stack);
    ok('lv' + lv + ' el no-juez lanzó por xtiro (' + V.sent.filter((x) => x.t === 'xtiro').length + ' envíos, ≤200 B)', V.sent.some((x) => x.t === 'xtiro') && V.sent.every((x) => JSON.stringify({ q: 0, d: x.d }).length <= 200));
  }
  ok('draw usa rr/ell/line/poly/txt (' + JSON.stringify(CALLS) + ')', CALLS.rr && CALLS.ell && CALLS.line && CALLS.poly && CALLS.txt);
  ok('ningún ctx.* prohibido (' + [...new Set(BANNED)].join(',') + ')', BANNED.length === 0);
  console.log(fails ? '\n' + fails + ' FALLAS' : '\nTODO OK');
  return fails === 0;
}

/* sobre el stack REAL: 4 humanos-bot skill .6, ventaja del asiento juez FINAL (informativo) */
async function red() {
  process.env.LIVE_DBG = '1';
  const { arnes } = require(path.join(__dirname, '../../../test/fiesta-live.test.js'));
  require(SRC);
  const N = +(process.env.N || 40), DUR = 35;
  console.log('f_bolas · stack REAL, ' + N + ' partidas por celda, 4 bots skill .6, 5 % de pérdida, dur ' + DUR + ' s (n=4 => techo 1/4 + 8 pp = 33 %)');
  for (const delay of [50, 150, 300]) {
    let jw = 0, tot = 0;
    for (let seed = 1; seed <= N; seed++) {
      const H = await arnes({ game: 'f_bolas', tipo: 'ffa', dur: DUR, humans: 4, loss: 0.05, delay, seed: 500 + seed, lv: 1 + (seed % 3) });
      H.bot = {}; H.ids.forEach((sid) => { H.bot[sid] = { skill: 0.6 }; });
      await H.arrancar(); await H.cerrar(80);
      const res = H.res(); if (!res) { H.cerrarTodo(); continue; }
      const ji = H.mj().as.indexOf(H.mj().juez), p = res.puestos, firsts = p.filter((x) => x === 1).length;
      if (p[ji] === 1) jw += 1 / firsts; tot++; H.cerrarTodo();
    }
    console.log('  retardo ' + String(delay).padStart(3) + ' ms: gana el asiento juez ' + pct(jw / Math.max(1, tot)) + ' (' + tot + ' partidas, ruido ±' + (100 * Math.sqrt(0.1875 / Math.max(1, tot))).toFixed(0) + ' pp)');
  }
}

module.exports = { cargar, mkCtx, tick, jugar, medir, veredicto, CPU4, LIM, I, edita, ponBola, CALLS, BANNED };
if (require.main === module) {
  if (process.argv.includes('--red')) red().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
  else process.exit(bench() ? 0 : 1);
}
