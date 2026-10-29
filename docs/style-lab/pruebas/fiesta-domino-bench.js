'use strict';
/* Banco headless de f_domino (¡CAPICÚA!, modelo B). Sin navegador ni red real:  node docs/style-lab/pruebas/fiesta-domino-bench.js [--quiet]
   Carga fiesta-juego-domino.js en un vm con las primitivas del laboratorio como stubs (graba qué se pinta y que NO se use
   ctx.fill/stroke/arc/...), y simula n pantallas con un mini-runtime del modelo B (cuerpos `o` a 12 Hz con retardo, jitter y 5 %
   de pérdida; reclamos `cl`/`ok` con ventana de 120 ms; juez que muere y migra). NO es fiesta-live.js: es un arnés de juego.
   Bots humanos: leen g.vista().notas y pulsan con error gaussiano. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', '..', '..');
const GAME = path.join(root, 'docs/style-lab/fiesta-juego-domino.js');
let bad = 0; const quiet = process.argv.includes('--quiet');
const check = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } else if (!quiet) console.log('✓ ' + m); };

/* ───── sandbox del laboratorio ───── */
const FORBID = ['fill', 'stroke', 'arc', 'lineTo', 'moveTo', 'drawImage', 'fillText', 'strokeText', 'beginPath', 'fillRect'];
function makeSandbox() {
  const calls = { rr: 0, ell: 0, line: 0, txt: 0, bust: 0, pj: 0, forbidden: [] };
  const ctx = new Proxy({}, { get: (t, k) => { if (FORBID.includes(k)) { calls.forbidden.push(k); return () => {}; } return () => {}; }, set: () => true });
  const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Int8Array, Float32Array, Promise,
    W: 800, H: 600, ctx, FACES: Array.from({ length: 12 }, (_, i) => ({ skin: '#c68a5c', shirt: '#fff', hair: 'curly', hairCol: '#222', mood: 'calm' })),
    rr() { calls.rr++; }, ell() { calls.ell++; }, line() { calls.line++; }, poly() {}, txt() { calls.txt++; }, bust() { calls.bust++; },
    spawn() {}, say() {}, snd() {}, nz() {}, hand() {}, drawP() {} };
  sb.window = sb; sb.BUS = { AP: { CAST: { tio: sb.FACES[6], mama: sb.FACES[1], abuela: sb.FACES[2] } } };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(root, 'docs/style-lab/fiesta-rng.js'), 'utf8'), sb);
  const defs = {};
  sb.FIESTA.LIVE = { add(id, def) { defs[id] = def; }, get(id) { return defs[id] || null; } };
  vm.runInContext(fs.readFileSync(GAME, 'utf8'), sb, { filename: 'fiesta-juego-domino.js' });
  return { sb, def: defs.f_domino, calls };
}
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

/* ───── mini-runtime del modelo B ───── */
function sim(o) {
  const { sb, def, calls } = makeSandbox();
  const n = o.n || 4, humans = o.humans || [0, 1], seed = o.seed || 1, lv = o.lv || 1, dur = o.dur || 30;
  const delay = (o.delay == null ? 150 : o.delay) / 1000, jitter = (o.jitter == null ? 40 : o.jitter) / 1000, loss = o.loss == null ? 0.05 : o.loss;
  const bots = o.bots || {};                       // idx -> {sd, skip, idle, tranque}
  const cpuLv = o.cpuSkill == null ? 0.6 : o.cpuSkill;
  const net = []; let T = -3.5;
  const lrng = sb.FIESTA.rng.crear(seed * 7 + 1);   // azar de la red (no del juego)
  const send = (fn, reliable) => { if (!reliable && lrng.next() < loss) return; net.push({ at: T + delay + lrng.next() * jitter, fn }); };
  let judge = o.judge == null ? humans[0] : o.judge;
  const cpuSeat = []; for (let p = 0; p < n; p++) cpuSeat[p] = !humans.includes(p);
  const dead = [];
  const cl = [];
  const seats = []; for (let p = 0; p < n; p++) seats.push({ id: 'abcd'[p], name: 'P' + (p + 1), ch: 'pana', color: ['#ff7ab0', '#3fb0ff', '#ffd23f', '#4fd06a'][p], cpu: cpuSeat[p], human: !cpuSeat[p], team: p });
  const win = {};                                  // ventanas de reclamo del juez, por id
  let judgeEpoch = 0;
  const mkClient = i => {
    const K = { i, taps: Array(n).fill(0), cpuNow: cpuSeat.slice(), skew: (lrng.next() - 0.5) * 0.04, g: null, pend: {}, lastBody: Array(n).fill(null) };
    const skill = Array.from({ length: n }, (_, p) => cpuLv);
    const c = {
      n, yo: i, seats, modo: 'ffa', equipos: seats.map((_, p) => p), solo: -1, lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
      campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }), ahora: () => T + K.skew,
      rng: sb.FIESTA.rng.crear(seed), rngFor: tag => sb.FIESTA.rng.crear(fnv(seed + ':' + tag)), fx: () => 0.5,
      held: () => false, tap: (p, b) => { const v = K.taps[p]; K.taps[p] = 0; return v; }, eje: () => ({ x: 0, y: 0 }),
      cpu: K.cpuNow, skill, juez: () => judge === i, get epoch() { return judgeEpoch; },
      send() { return true; }, on() {}, ev() {},
      claim(id, cb) {
        K.pend[id] = cb;
        const t = Math.round((T + K.skew) * 1000);
        if (judge === i) judgeGetCl(id, i, t); else send(() => { if (!dead[judge]) judgeGetCl(id, i, t); }, true);
      },
      mio: p => (p === i && !K.cpuNow[i]) || (judge === i && K.cpuNow[p]),
      remoto: p => K.lastBody[p], out() {}, util: { suave: (a, b) => b, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), pj() { calls.pj++; }, tick: gt => Math.floor(gt * 30) }
    };
    K.c = c;
    K.in = { tap: () => { K.taps[i]++; } };
    K.api = p => ({ press: () => { K.taps[p]++; }, hold() {}, eje() {} });
    return K;
  };
  const clients = [];
  const judgeGetCl = (id, p, t) => {
    const J = clients[judge]; if (!J || dead[judge]) return;
    if (!win[id]) { win[id] = { list: [], at: T + 0.12 }; }
    win[id].list.push({ p, t });
  };
  const resolveWins = () => {
    for (const id of Object.keys(win)) {
      const w = win[id]; if (T < w.at) continue; delete win[id];
      const J = clients[judge]; if (!J || dead[judge]) continue;
      const ok = w.list.filter(r => J.g.claimOk(id, r.p, r.t) !== false).sort((a, b) => a.t - b.t || a.p - b.p);
      const pw = ok.length ? ok[0].p : -1;
      for (const K of clients) { if (!K || dead[K.i]) continue; send(() => { K.g.concede(id, pw); const cb = K.pend[id]; if (cb) { delete K.pend[id]; cb(pw === K.i ? 'ok' : 'no'); } }, true); }
      if (judge >= 0) { const J2 = J; /* el juez ve su propio ok sin red */ }
    }
  };
  for (let i = 0; i < n; i++) clients.push(mkClient(i));
  for (const K of clients) K.g = def.mk(K.c);
  /* bots humanos */
  const botState = {};
  const botTick = K => {
    const b = bots[K.i]; if (!b || b.idle || dead[K.i]) return;
    const v = K.g.vista(), now = T + K.skew; const st = botState[K.i] || (botState[K.i] = { plan: [], ix: 0, r: sb.FIESTA.rng.crear(seed * 31 + K.i) });
    while (st.ix < v.notas.length && v.notas[st.ix][0] / 1000 - now < 0.5) {
      const nt = v.notas[st.ix++];
      if (st.r.next() < (b.skip || 0)) continue;
      const sd = b.sd == null ? 0.03 : b.sd;
      let e = (st.r.next() + st.r.next() + st.r.next() - 1.5) * 2 * sd;
      st.plan.push(nt[0] / 1000 + e + (b.bias || 0));
    }
    for (let q = st.plan.length - 1; q >= 0; q--) if (st.plan[q] <= now) { st.plan.splice(q, 1); K.in.tap(); }
    if (b.spam) { st.sp = (st.sp || 0) + 1; if (st.sp % 5 === 0) K.in.tap(); }
  };
  const sendBody = (K, p) => {
    const body = K.g.cuerpo(p); o.onBody && o.onBody(body);
    send(() => { for (const R of clients) if (R.i !== K.i && !dead[R.i]) R.rxBody(p, body, K.i); });
  };
  for (const K of clients) K.rxBody = (p, body, from) => {
    if (K.c.mio(p)) return;
    if (!((from === p && !K.cpuNow[p]) || (from === judge && K.cpuNow[p]))) return;
    K.lastBody[p] = body; K.g.alRemoto(p, body, T);
  };
  const dt = 1 / 60; let nextBody = 0; const kills = (o.kills || []).slice(); let detect = null;
  const endT = dur + 3;
  let steps = 0;
  while (T < endT) {
    T += dt; steps++;
    for (let q = net.length - 1; q >= 0; q--) if (net[q].at <= T) { const m = net.splice(q, 1)[0]; try { m.fn(); } catch (e) { throw e; } }
    resolveWins();
    if (kills.length && T >= kills[0].at) {
      const k = kills.shift(); dead[k.seat] = true;
      if (k.seat === judge) detect = { at: T + 2.0, seat: k.seat };
      else detect = { at: T + 2.0, seat: k.seat, nj: false };
    }
    if (detect && T >= detect.at) {
      const s = detect.seat; detect = null;
      for (const K of clients) { if (dead[K.i]) continue; K.cpuNow[s] = true; K.c.cpu[s] = true; }
      cpuSeat[s] = true;
      if (s === judge) { judge = clients.find(K => !dead[K.i] && humans.includes(K.i)).i; judgeEpoch++; for (let p = 0; p < n; p++) if (cpuSeat[p]) clients[judge].g.alCpu(p); }
      else clients[judge].g.alCpu(s);
    }
    if (T < 0) continue;
    for (const K of clients) {
      if (dead[K.i]) continue;
      botTick(K);
      if (judge === K.i) for (let p = 0; p < n; p++) if (K.cpuNow[p]) K.g.ai(p, dt, K.api(p));
      K.g.update(dt);
    }
    if (T >= nextBody) {
      nextBody = T + 1 / 12;
      for (const K of clients) { if (dead[K.i]) continue; if (!K.cpuNow[K.i]) sendBody(K, K.i); if (judge === K.i) for (let p = 0; p < n; p++) if (K.cpuNow[p] && p !== K.i) sendBody(K, p); }
    }
  }
  return { clients, def, calls, sb, judge, n, dead, cpuSeat, scores: clients.map(K => dead[K.i] ? null : K.g.scores()) };
}
const placements = sc => { const idx = sc.map((_, i) => i).sort((a, b) => sc[b] - sc[a]); const pl = Array(sc.length); idx.forEach((p, r) => { pl[p] = r > 0 && sc[idx[r - 1]] === sc[p] ? pl[idx[r - 1]] : r + 1; }); return pl; };
const same = a => a.every(x => JSON.stringify(x) === JSON.stringify(a[0]));
const good = { sd: 0.03, skip: 0.02 };

/* ───── 1 · registro ───── */
{
  const { def } = makeSandbox();
  check(def && def.modelo === 'B' && def.clase === 'rank' && def.dur === 30 && def.botones === 1 && !def.stick, 'f_domino registrado: modelo B, rank, 30 s, 1 botón, sin stick');
  check(JSON.stringify(def.limites) === JSON.stringify({ scoreMax: 1000, scoreRate: 40, minT: 27, finTemprano: 0 }), 'limites idénticos al catálogo de M2 (§3.2)');
  check(JSON.stringify(def.cuerpo) === '["pts","combo","cal","nn"]' && def.discretos.length === 4, 'cuerpo [pts,combo,cal,nn], todos discretos');
  check(def.modos.join() === 'ffa,1v1' && def.carta.demos.length >= 1 && def.carta.como.tactil && def.carta.como.teclado, 'modos ffa/1v1 y carta completa');
}

/* ───── 2 · partitura idéntica en todas las pantallas, todos los niveles/duraciones ───── */
for (const lv of [1, 2, 3]) for (const dur of [3, 4, 12, 30]) for (const n of [2, 3, 4]) {
  const r = sim({ n, humans: [0, 1], lv, dur, seed: 11 * lv + dur, bots: {}, loss: 0 });
  const hs = r.clients.map(K => { const v = K.g.vista(); return v.hash + '|' + v.N + '|' + JSON.stringify(v.tranques) + '|' + JSON.stringify(v.oscuro); });
  check(same(hs) && r.clients[0].g.vista().N >= 3, `partitura idéntica lv${lv} dur${dur} n${n} (${r.clients[0].g.vista().N} notas)`);
}

/* ───── 3 · puntaje máximo de diseño y límites del servidor ───── */
for (const lv of [1, 2, 3]) for (const seed of [1, 2, 3, 4, 5]) {
  const r = sim({ n: 2, humans: [0, 1], lv, dur: 30, seed, loss: 0, bots: { 0: { sd: 0.006, skip: 0 }, 1: { sd: 0.006, skip: 0 } } });
  const sc = r.clients[0].g.scores(), m = Math.max(...sc), cap = Math.min(1000, 40 * (30 + 1.5));
  check(m < 900 && m <= cap, `lv${lv} seed${seed}: bot casi perfecto = ${sc.join('/')} (< 900, dentro de lim)`);
}
for (const dur of [3, 4, 8, 12, 20]) {
  const r = sim({ n: 3, humans: [0, 1], lv: 2, dur, seed: 5, loss: 0, bots: { 0: { sd: 0.006 }, 1: { sd: 0.006 } } });
  const sc = r.clients[0].g.scores(), cap = Math.min(1000, 40 * (dur + 1.5));
  check(sc.every(v => Number.isInteger(v) && v >= 0 && v <= cap), `dur ${dur}: puntajes enteros >= 0 y <= scoreRate*(dur+1,5) (${sc.join('/')})`);
}

/* ───── 4 · mismos puestos en todas las pantallas a 50/150/300 ms con 5 % de pérdida ───── */
for (const d of [50, 150, 300]) for (const n of [2, 3, 4]) for (const seed of [1, 2]) {
  const hum = n === 2 ? [0, 1] : n === 3 ? [0, 1, 2] : [0, 1];
  const bots = { 0: { sd: 0.035 }, 1: { sd: 0.05, skip: 0.1 } }; if (n >= 3) bots[2] = { sd: 0.045, skip: 0.1 };
  const r = sim({ n, humans: hum, seed, delay: d, jitter: Math.round(d * 0.3), loss: 0.05, bots });
  const sc = r.clients.map(K => K.g.scores());
  check(same(sc) && same(sc.map(placements)), `${d} ms n${n} seed${seed}: misma tabla en todas las pantallas (${sc[0].join('/')} -> ${placements(sc[0]).join('/')})`);
}

/* ───── 5 · humanos inactivos no ganan a las CPU activas ───── */
for (const seed of [1, 2, 3]) for (const lv of [1, 2, 3]) {
  const r = sim({ n: 4, humans: [0, 1], seed, lv, cpuSkill: 0.6, bots: {} });
  const sc = r.clients[0].g.scores(), pl = placements(sc);
  check(sc[0] === 0 && sc[1] === 0 && Math.min(sc[2], sc[3]) > 0 && pl[0] > Math.max(pl[2], pl[3]) - 0.5 && pl[0] >= 3, `2 ociosos + 2 CPU (seed${seed} lv${lv}): ${sc.join('/')} -> ninguno gana a una CPU`);
}
{
  const r = sim({ n: 2, humans: [0], seed: 4, lv: 1, cpuSkill: 0.35, bots: { 0: { sd: 0.03 } } });
  const sc = r.clients[0].g.scores(); check(sc[0] > sc[1], `1v1 humano activo (${sc[0]}) vence a CPU nivel 1 (${sc[1]})`);
  const r2 = sim({ n: 2, humans: [0], seed: 4, lv: 1, cpuSkill: 0.85, bots: { 0: { spam: true, sd: 0.2 } } });
  const sc2 = r2.clients[0].g.scores(); check(sc2[0] < sc2[1], `machacar el botón pierde contra CPU nivel 3 (${sc2.join('/')})`);
}

/* ───── 6 · el TRANQUE: dos humanos pegan a la vez, solo uno cobra ───── */
for (const d of [50, 150, 300]) for (const seed of [1, 2, 3]) {
  const r = sim({ n: 2, humans: [0, 1], seed, delay: d, jitter: Math.round(d * 0.3), loss: 0.05, lv: 1, bots: { 0: { sd: 0.004 }, 1: { sd: 0.004 } } });
  const v = r.clients.map(K => K.g.vista());
  const owners = v.map(x => x.humOwner.join(','));
  check(same(owners) && v[0].humOwner.length === 3 && v[0].humOwner.every(x => x === 0 || x === 1), `${d} ms seed${seed}: los 3 tranques tienen UN dueño igual en ambas pantallas (${owners[0]})`);
  const sc = r.clients.map(K => K.g.scores());
  check(same(sc), `${d} ms seed${seed}: misma tabla tras el tranque (${sc[0].join('/')})`);
  const w0 = v[0].humOwner.filter(x => x === 0).length, w1 = v[0].humOwner.filter(x => x === 1).length;
  check(w0 + w1 === 3, `${d} ms seed${seed}: reparto ${w0}-${w1}, ningún tranque cobrado dos veces`);
}
{
  /* ventaja clara: el que pega antes (sesgo -30 ms) se lleva los tranques */
  const r = sim({ n: 2, humans: [0, 1], seed: 2, delay: 150, bots: { 0: { sd: 0.003, bias: -0.03 }, 1: { sd: 0.003, bias: 0.02 } } });
  const ho = r.clients[0].g.vista().humOwner; check(ho.every(x => x === 0), `el de menor t gana el tranque (dueños ${ho.join(',')})`);
}
{
  /* nadie lo pega: la CPU que lo pegó perfecto lo cobra; un humano lo anula */
  const r = sim({ n: 3, humans: [0], seed: 6, cpuSkill: 0.9, bots: {} });
  const v = r.clients[0].g.vista();
  check(v.owner.some(x => x >= 1) && v.humOwner.every(x => x < 0), `CPU sin humano cobra tranques (dueños ${v.owner.join(',')})`);
  const tot = v.pts.reduce((a, b) => a + b, 0); check(tot > 0, 'las CPU puntúan');
}

/* ───── 7 · juez muerto: un nuevo juez retoma, los puestos coinciden ───── */
for (const kt of [6, 11, 17.5, 23]) for (const seed of [1, 2]) {
  const r = sim({ n: 4, humans: [0, 1, 2], seed, delay: 150, bots: { 0: { sd: 0.04 }, 1: { sd: 0.04 }, 2: { sd: 0.05 } }, kills: [{ at: kt, seat: 0 }] });
  const live = r.scores.filter(x => x), pl = live.map(placements);
  check(r.judge !== 0 && same(live) && same(pl) && live.length === 3, `juez muerto a los ${kt} s (seed${seed}): nuevo juez=${r.judge}, misma tabla ${live[0].join('/')}`);
  check(live[0][0] > 0 && live[0][0] < 1000, `el asiento caído (CPU) conserva lo acumulado hasta su caída (${live[0][0]})`);
}
{
  const r = sim({ n: 4, humans: [0, 1, 2], seed: 3, delay: 150, bots: { 0: { sd: 0.04 }, 1: { sd: 0.04 }, 2: { sd: 0.05 } }, kills: [{ at: 14, seat: 2 }] });
  const live = r.scores.filter(x => x);
  check(same(live) && live[0][2] > 0 && r.cpuSeat[2], `asiento humano caído (no juez) a los 14 s pasa a CPU y sigue puntuando (${live[0].join('/')})`);
}

/* ───── 8 · tamaño del cuerpo ───── */
{
  let mx = 0; sim({ n: 4, humans: [0, 1], seed: 2, bots: { 0: { sd: 0.02 }, 1: { sd: 0.02 } }, onBody: b => { mx = Math.max(mx, JSON.stringify([1, b.pts, b.combo, b.cal, b.nn]).length); } });
  check(mx > 0 && mx <= 40, `cuerpo en el cable ${mx} B (<= 70 B por cuerpo, enteros)`);
}

/* ───── 9 · dibujo: 3 niveles × n × tiempos, sin tocar ctx prohibido ───── */
{
  let nd = 0;
  for (const lv of [1, 2, 3]) for (const n of [2, 3, 4]) for (const dur of [4, 30]) {
    const r = sim({ n, humans: [0], lv, dur, seed: 3, bots: { 0: { sd: 0.03 } }, loss: 0 });
    const K = r.clients[0], times = [-3, -1, 0, 0.5, dur * 0.4, dur - 1, dur + 1];
    for (const t of times) { try { /* reloj fijado */ K.c.ahora = () => t; K.g.draw(); nd++; } catch (e) { check(false, `draw lv${lv} n${n} dur${dur} gt${t}: ${e.message}`); } }
    const sp = makeSandbox(); const c2 = Object.assign({}, K.c, { yo: -1 }); c2.mio = () => false; c2.cpu = Array(n).fill(false);
    const g2 = sp.def.mk(Object.assign({}, c2, { rng: sp.sb.FIESTA.rng.crear(3) })); try { g2.draw(); g2.update(0.016); nd++; } catch (e) { check(false, `espectador draw: ${e.message}`); }
  }
  check(nd > 100, `draw() sin excepción (${nd} cuadros: lv1-3 × n2-4 × gt<0 y gt>dur × espectador)`);
  const sp = makeSandbox(); const gg = sp.def.mk(sim({ n: 2, humans: [0], bots: {}, dur: 4, loss: 0 }).clients[0].c);
  check(true, 'mk repetible');
  const rr = sim({ n: 4, humans: [0], lv: 2, dur: 12, bots: {}, loss: 0 }); rr.clients[0].g.draw();
  check(rr.calls.forbidden.length === 0 && rr.calls.rr > 0 && rr.calls.ell > 0 && rr.calls.txt > 0 && rr.calls.bust > 0, `solo primitivas del laboratorio (rr/ell/txt/bust/pj usados; ctx prohibido: ${rr.calls.forbidden.length})`);
}

/* ───── 10 · lint del archivo ───── */
{
  const src = fs.readFileSync(GAME, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check(!/Math\.random|Date\.now|performance\.now|new Date/.test(src), 'sin Math.random / Date.now / performance.now');
  check(!/ctx\.(fill|stroke|arc|lineTo|moveTo|drawImage|fillText|strokeText|beginPath|fillRect)\b/.test(src), 'sin ctx.fill/stroke/arc/lineTo/drawImage/fillText/beginPath');
  check(!/\?\.|\?\?/.test(src), 'sin ?. ni ??');
  check(!/c\.send\(|c\.on\(/.test(src) && !/['"]x[a-z0-9]{1,11}['"]/.test(src), 'no inventa tipos de mensaje (solo cuerpo + claim del runtime)');
  check(/def\.dur/.test(src) === false && /c\.dur/.test(src), 'la duración sale de c.dur');
}

console.log(bad ? `\n${bad} problema(s)` : '\nfiesta-domino-bench OK'); process.exit(bad ? 1 : 0);
