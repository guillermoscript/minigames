// LA FIESTA · rendimiento del tablero (headless, sin PocketBase). Mide ms/cuadro (CPU de escritorio: relativo), teselas pintadas por
// cuadro, fichas dibujadas y que dos cuadros en reposo (mismo t) sean idénticos bit a bit. Uso: node docs/style-lab/pruebas/fiesta-tablero-perf.js [estilo]
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cache = path.join(os.homedir(), '.npm/_npx');
const { chromium } = require(fs.readdirSync(cache).map((d) => path.join(cache, d, 'node_modules/playwright')).find(fs.existsSync));
const LAB = path.join(__dirname, '..');
function chromePath() {
  const shells = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  try { const d = fs.readdirSync(shells).filter((x) => x.startsWith('chromium_headless_shell-')).sort().pop();
    if (d) { const f = path.join(shells, d), sub = fs.readdirSync(f).find((x) => x.startsWith('chrome')); const p = path.join(f, sub, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; } } catch (_) {}
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; return fs.existsSync(mac) ? mac : undefined;
}
(async () => {
  const browser = await chromium.launch({ executablePath: chromePath() });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.route('**/fiesta-main.js*', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  if (process.env.FIESTA_CPU) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: +process.env.FIESTA_CPU });   // móvil emulado: FIESTA_CPU=4
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('file://' + path.join(LAB, 'fiesta.html'));
  const r = await page.evaluate((est) => {
    setStyle(est);
    const F = FIESTA, T = F.tablero.crear({}), cam = F.cam.crear({ mundo: F.tablero.MUNDO, vista: { x: 0, y: 0, w: 800, h: 600 } });
    const mk = (n, ch, nodo) => ({ ch, nodo, name: n, cpu: null });
    const D = { f: 'turno', pj: { a: mk('Ana', 'mama', 'ccs_start'), b: mk('Beto', 'tio', 'ccs_start'), c: mk('Cris', 'pana', 'ccs_start'), d: mk('Dani', 'abuela', 'ccs_sabana') },
      t: { s: 'a', paso: 'dado' }, esp: null, estrella: { nodo: 'ccs_galipan', precio: 20 }, tab: {} };
    const out = {};
    const frame = (t) => { ctx = vctx; sceneTransform(vctx, 1); const a = performance.now(); const st = T.dibujar(vctx, cam, D, { yo: 'a', t, presupuesto: 1 }); return { ms: performance.now() - a, st }; };
    const medir = (nombre, z, mueve) => {
      const f = T.foco(D);cam.seguir(f.x, f.y, z); for (let i = 0; i < 240; i++) cam.update(1 / 60);
      for (let i = 0; i < 20; i++) frame(5 + i / 60);                  // calentamiento: crea teselas
      let ms = 0, cre = 0, fi = 0, tes = 0, n = 120;
      for (let i = 0; i < n; i++) { if (mueve) { cam.seguir(f.x + 300 * Math.sin(i / 20), f.y + 200 * Math.cos(i / 25), z); cam.update(1 / 60); }
        const q = frame(7 + i / 60); ms += q.ms; cre += q.st.creadas; fi += q.st.fichas; tes += q.st.teselas; }
      out[nombre] = { msPorCuadro: +(ms / n).toFixed(2), teselasCreadasPorCuadro: +(cre / n).toFixed(3), teselasUsadasPorCuadro: +(tes / n).toFixed(2), fichas: +(fi / n).toFixed(1) };
    };
    medir('seguimiento_reposo', cam.zSeguir, false);
    medir('seguimiento_movimiento', cam.zSeguir, true);
    medir('general', cam.zFit(), false);
    // zoom suave seguimiento -> general: sin repintar teselas durante la transición una vez calientes
    cam.seguir(2000, 1500, cam.zSeguir); for (let i = 0; i < 240; i++) cam.update(1 / 60); for (let i = 0; i < 30; i++) frame(9 + i / 60);
    cam.seguir(2000, 1500, cam.zFit()); let cre = 0; for (let i = 0; i < 120; i++) { cam.update(1 / 60); cre += frame(10 + i / 60).st.creadas; }
    out.transicion_zoom_teselasCreadas = cre;
    // reposo: dos cuadros con el mismo t son idénticos bit a bit
    cam.seguir(f0(), 0, 0); function f0() { return 2000; }
    cam.seguir(T.foco(D).x, T.foco(D).y, cam.zSeguir); for (let i = 0; i < 240; i++) cam.update(1 / 60); for (let i = 0; i < 20; i++) frame(20);
    for (let i = 0; i < 30; i++) frame(21);
    const A = vctx.getImageData(0, 0, 800, 600).data.slice(); frame(21); const B = vctx.getImageData(0, 0, 800, 600).data; let n = 0;
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) { n++; const q = (i / 4) | 0, x = q % 800, y = (q / 800) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } out.caja = [x0, y0, x1, y1];
    out.reposo_identico_bit_a_bit = n === 0; out.bytes_distintos = n;
    return out;
  }, process.argv[2] || 'snes');
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
