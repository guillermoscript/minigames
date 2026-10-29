// LA FIESTA M1 end to end (doc 07 §10 M1 (3)): a real PocketBase (test/helpers/pb-harness.js) + real browsers.
// A (desktop) creates a room, B (phone, landscape, touch) joins with ?r=CODE, both pick characters (uniqueness checked in the UI and
// on the server), B gets ready, A starts; the order die, then ~6 turns where humans roll when prompted and the CPU fills the rest.
// At rest both pages must show the same hash(D), versions, positions and coins. Then: a 3rd context takes a CPU seat, B reloads and
// resumes the same seat, and closing B's context turns that seat AFK (CPU) after its die timeouts (shortened by a reducer patch that
// is applied to BOTH the server hooks and the served world, so client and server still run the same rules).
// Screenshots: docs/style-lab/pruebas/out/fiesta-*.png. Run: node test/fiesta.e2e.js   (PB_BIN=... optional, HEADED=1 to watch)
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { start, ROOT } = require('./helpers/pb-harness.js');
const cache = path.join(os.homedir(), '.npm/_npx');
const { chromium } = require(fs.readdirSync(cache).map((d) => path.join(cache, d, 'node_modules/playwright')).find(fs.existsSync));
const OUT = path.join(ROOT, 'docs/style-lab/pruebas/out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now(), log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(1) + 's]', ...a);

function chromePath() {
  const shells = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  try {
    const d = fs.readdirSync(shells).filter((x) => x.startsWith('chromium_headless_shell-')).sort().pop();
    if (d) { const f = path.join(shells, d), sub = fs.readdirSync(f).find((x) => x.startsWith('chrome')); const p = path.join(f, sub, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  } catch (_) {}
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return fs.existsSync(mac) ? mac : undefined;
}

// faster prompts / minigame timeouts for the test only (same patch on server and client copies)
const PATCHES = [
  [/var PLAZO=\{[^}]*\}/, 'var PLAZO={DADO:6000,DADO1:7000,RUTA:5000,TIENDA:5000,ESTRELLA:5000,OBJETIVO:5000,COMMIT:8000}'],
  [/carta:4500\+15000/, 'carta:4500+6000'],
  [/dur:\d+/g, 'dur:4']
];

const errores = [], r409 = [];
function vigilar(page, who) {
  page.on('pageerror', (e) => errores.push(who + ' pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    try { if (/status of 404/.test(t) && /assets\/fiesta\/mapa-venezuela\.png/.test(m.location().url || '')) return; } catch (e) { /* optional board art (M4): the board paints its own fallback */ }
    if (/status of 409/.test(t)) { r409.push(who); return; }   // stale prompt / deliberate pick clash: reported, not fatal
    errores.push(who + ' console: ' + t);
  });
}
const est = (p) => p.evaluate(() => FIESTA_DEBUG.estado());
async function hasta(p, fn, ms, que) {
  const t0 = Date.now(); let e = null;
  while (Date.now() - t0 < (ms || 15000)) { e = await est(p); if (fn(e)) return e; await sleep(150); }
  throw new Error('timeout: ' + (que || fn.toString()) + '\n' + JSON.stringify(e));
}
async function boton(p, id) { return p.evaluate((i) => FIESTA_DEBUG.boton(i), id); }
async function tocar(p, id, ms) {
  const t0 = Date.now(); let b = null;
  while (Date.now() - t0 < (ms || 8000)) { b = await boton(p, id); if (b && !b.off) break; await sleep(100); }
  if (!b || b.off) throw new Error('button not available: ' + id + ' ' + JSON.stringify(b) + ' in ' + JSON.stringify(await p.evaluate(() => FIESTA_DEBUG.botones())));
  if (p.__touch) await p.touchscreen.tap(b.x, b.y); else await p.mouse.click(b.x, b.y);
  return b;
}
async function foto(p, name) { fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: path.join(OUT, 'fiesta-' + name + '.png') }); log('screenshot', name); }

// answer my current prompt the way a person would (tapping the buttons the HUD drew; RUTA through the map when the spot is free)
async function jugar(p, who, st) {
  const e = await est(p);
  if (!e.prompt || e.pantalla !== 'juego') return null;
  const ids = await p.evaluate(() => FIESTA_DEBUG.botones());
  const has = (id) => ids.indexOf(id) >= 0;
  let id = null;
  if (e.prompt === 'COMMIT') id = 'orden';
  else if (e.prompt === 'LISTO') id = 'listo';
  else if (e.afk) id = 'volvi';
  else if (e.prompt === 'DADO') id = 'tirar';
  else if (e.prompt === 'TIENDA') id = 'nada';
  else if (e.prompt === 'ESTRELLA') id = has('si') ? 'si' : 'no';
  else if (e.prompt === 'OBJETIVO') id = ids.find((x) => /^obj:/.test(x));
  else if (e.prompt === 'RUTA') {
    const viaMapa = await p.evaluate(() => {          // the arrow destination, if it is on screen and not under a HUD button
      const D = FIESTA_DEBUG.D, R = FIESTA_DEBUG.tablero.rutas(D.board); if (!R) return null;
      const o = R.opc.find((x) => x.ok !== false); if (!o) return null;
      const w = FIESTA_DEBUG.tablero.pos(o.a), s = FIESTA_DEBUG.cam.aPantalla(w.x, w.y);
      if (s.x < gameLeft() + 20 || s.x > gameRight() - 20 || s.y < 120 || s.y > 520 || FIESTA_DEBUG.ui.B.hit(s.x, s.y)) return null;
      return Object.assign(FIESTA_DEBUG.aCliente(w.x, w.y), { a: o.a });
    });
    if (viaMapa && !st.rutaMapa) { st.rutaMapa = 1; log(who, 'RUTA by tapping the map →', viaMapa.a); if (p.__touch) await p.touchscreen.tap(viaMapa.x, viaMapa.y); else await p.mouse.click(viaMapa.x, viaMapa.y); await sleep(400); return 'RUTA'; }
    id = ids.find((x) => /^ruta:/.test(x));
  }
  if (!id || !has(id)) return null;
  if (e.prompt === 'DADO' && st.fotoPrompt === who) { await foto(p, 'prompt-' + who); st.fotoPrompt = null; }
  try { await tocar(p, id, 1500); } catch (_) { return null; }
  st.acciones[who] = (st.acciones[who] || 0) + 1;
  await sleep(250);
  return e.prompt;
}

// both pages at rest on the same version → same hash, positions, coins
async function mismaFoto(A, B, ms) {
  const t0 = Date.now(); let a, b;
  while (Date.now() - t0 < (ms || 8000)) {
    [a, b] = await Promise.all([est(A), est(B)]);
    if (a.idle && b.idle && a.ver === b.ver && a.ver === a.target && b.ver === b.target && a.ver > 0) {
      assert.equal(a.hash, b.hash, 'hash(D) differs at ver ' + a.ver);
      assert.equal(a.hash, a.hashNet, 'A: hash(D) != hash(S)'); assert.equal(b.hash, b.hashNet, 'B: hash(D) != hash(S)');
      assert.deepEqual(a.pos, b.pos); assert.deepEqual(a.mon, b.mon);
      return a.ver;
    }
    await sleep(120);
  }
  return null;
}

(async () => {
  const pb = await start({ patches: PATCHES, verbose: !!process.env.PB_VERBOSE });
  log('pocketbase', pb.url);
  const browser = await chromium.launch({ executablePath: chromePath(), headless: !process.env.HEADED });
  const st = { acciones: {}, fotoPrompt: 'B', rutaMapa: 0, checks: 0 };
  try {
    const ctxA = await browser.newContext({ viewport: { width: 1100, height: 700 } });
    const ctxB = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const A = await ctxA.newPage(), B = await ctxB.newPage(); B.__touch = true;
    vigilar(A, 'A'); vigilar(B, 'B');

    // ── lobby ──
    await A.goto(pb.page()); await hasta(A, (e) => e.pantalla === 'menu', 10000);
    await foto(A, 'menu');
    await tocar(A, 'crear');
    const a0 = await hasta(A, (e) => e.pantalla === 'sala' && e.code, 10000, 'A in a room');
    const CODE = a0.code; log('room', CODE, 'seat', a0.seat);
    assert.equal(a0.seat, 'a');
    await B.goto(pb.page() + '?r=' + CODE);
    const b0 = await hasta(B, (e) => e.pantalla === 'sala' && e.seat, 10000, 'B joined by ?r=');
    assert.equal(b0.seat, 'b'); assert.equal(b0.code, CODE);

    await tocar(A, 'pj:mama');
    await hasta(A, (e) => e.ch.a === 'mama', 5000); await hasta(B, (e) => e.ch.a === 'mama', 5000, 'B sees mama taken');
    await tocar(B, 'tab:pj');
    await sleep(400);
    const mamaB = await boton(B, 'pj:mama'); if (!mamaB) log('B buttons', await B.evaluate(() => FIESTA_DEBUG.botones().join(' ')));
    assert.ok(mamaB && mamaB.off, 'B: a character taken by A is greyed out');
    const clash = await B.evaluate(() => FIESTA_DEBUG.net.pick({ ch: 'mama' }).then((r) => r.status));
    assert.equal(clash, 409, 'server refuses a taken character');
    await tocar(B, 'pj:abuela');
    await hasta(A, (e) => e.ch.b === 'abuela', 5000, 'A sees B as abuela');
    await foto(B, 'lobby-movil');
    await tocar(B, 'listo');
    await sleep(200);
    await A.waitForFunction(() => FIESTA_DEBUG.S && FIESTA_DEBUG.S.pj.b && FIESTA_DEBUG.S.pj.b.listo, null, { timeout: 5000 });
    await foto(A, 'lobby');
    await tocar(A, 'empezar');
    await hasta(A, (e) => e.pantalla === 'juego' && e.f === 'orden', 10000, 'A in game');
    await hasta(B, (e) => e.pantalla === 'juego', 10000, 'B in game');

    // ── order die + ~6 turns ──
    let hopShot = false;
    const t0 = Date.now();
    for (;;) {
      const [ea, eb] = await Promise.all([est(A), est(B)]);
      if (!hopShot && ea.paso === 'hop') { await foto(A, 'tablero-salto'); hopShot = true; }
      if (ea.turnos >= 7 && st.checks >= 2 && hopShot) break;
      if (Date.now() - t0 > 240000) throw new Error('game did not reach 6 turns: ' + JSON.stringify({ ea, eb, st }));
      // before a human rolls the die, both screens must agree (nothing moves while a prompt waits)
      if ((ea.prompt === 'DADO' || eb.prompt === 'DADO')) { const v = await mismaFoto(A, B, 4000); if (v) { st.checks++; log('in sync at ver', v, 'hash', ea.hash.toString(16)); } }
      await jugar(A, 'A', st); await jugar(B, 'B', st);
      await sleep(150);
    }
    log('turns seen by A:', (await est(A)).turnos, 'actions', JSON.stringify(st.acciones), 'sync checks', st.checks);
    assert.ok(st.acciones.A >= 2 && st.acciones.B >= 2, 'both humans acted');

    // ── a 3rd person takes a CPU seat ──
    const ctxC = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const C = await ctxC.newPage(); C.__touch = true; vigilar(C, 'C');
    await C.goto(pb.page() + '?r=' + CODE);
    const c0 = await hasta(C, (e) => e.pantalla === 'juego' && e.seat, 15000, 'C took a CPU seat');
    assert.ok(c0.seat === 'c' || c0.seat === 'd', 'C sits in a CPU seat, got ' + c0.seat);
    await A.waitForFunction((s) => FIESTA_DEBUG.S.pj[s].name !== '' && FIESTA_DEBUG.S.log.some((l) => /LLEGÓ/.test(l)), c0.seat, { timeout: 10000 });
    log('C took seat', c0.seat);
    await foto(C, 'vertical');

    // ── B reloads and resumes the same seat ──
    await B.reload();
    const b1 = await hasta(B, (e) => e.pantalla === 'juego' && e.seat, 15000, 'B resumed');
    assert.equal(b1.seat, 'b', 'reload keeps the seat');
    log('B resumed seat', b1.seat);
    for (let i = 0; i < 40; i++) {                      // a little more play with three humans, then a sync check
      await jugar(A, 'A', st); await jugar(B, 'B', st); await jugar(C, 'C', st);
      const [ea, eb] = await Promise.all([est(A), est(B)]);
      if (ea.prompt === 'DADO' || eb.prompt === 'DADO') { const v = await mismaFoto(A, B, 3000); if (v) { st.checks++; break; } }
      await sleep(200);
    }

    // ── closing B: its die prompts time out → 2 strikes → AFK, the CPU plays for it ──
    await ctxB.close();
    log('B closed; waiting for AFK');
    const t1 = Date.now();
    for (;;) {
      const ea = await est(A);
      if (ea.cpu.b === 'afk') { log('B is AFK after', ((Date.now() - t1) / 1000).toFixed(1) + 's'); break; }
      if (process.env.TRACE && Date.now() - (st.traceAt || 0) > 4000) { st.traceAt = Date.now(); log('trace', JSON.stringify(await A.evaluate(() => { const S = FIESTA_DEBUG.S; return { f: S.f, r: S.r, t: S.t && S.t.s, paso: S.t && S.t.paso, esp: S.esp && [S.esp.k, S.esp.s], afkB: S.pj.b.afk, due: S.nextAt - FIESTA_DEBUG.net.serverNow(), prA: FIESTA_DEBUG.estado().prompt }; })), 'C', (await est(C)).prompt); }
      if (Date.now() - t1 > 300000) throw new Error('B never went AFK: ' + JSON.stringify(ea));
      await jugar(A, 'A', st); await jugar(C, 'C', st);
      await sleep(200);
    }
    // the CPU now plays B's turns: wait for one more of B's turns to pass without anybody acting for it
    const nTurn = (await est(A)).turnos;
    await (async () => { const t2 = Date.now(); while (Date.now() - t2 < 90000) { const e = await est(A); if (e.turnos >= nTurn + 3) return; await jugar(A, 'A', st); await jugar(C, 'C', st); await sleep(200); } throw new Error('game stalled after AFK'); })();
    const fin = await mismaFoto(A, C, 8000);
    log('A and C in sync after AFK at ver', fin);
    await foto(A, 'afk');

    // every chosen art style draws the live board + HUD without errors
    for (const s of ['felt', 'ww', 'anime', 'tinta', 'garabato', 'snes']) {
      await A.evaluate((x) => { setStyle(x); }, s); await sleep(500);
      if (s === 'garabato' || s === 'ww') await foto(A, 'estilo-' + s);
    }

    assert.deepEqual(errores, [], 'console / page errors');
    log('OK · sync checks', st.checks, '· 409 responses (expected: pick clash, maybe a stale prompt):', r409.length, '· actions', JSON.stringify(st.acciones));
  } finally {
    await browser.close().catch(() => {});
    await pb.stop();
  }
})().catch((e) => { console.error(e); if (errores.length) console.error('errors:', errores); process.exit(1); });
