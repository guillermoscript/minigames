// LA FIESTA · capturas del tablero SIN PocketBase: carga fiesta.html con fiesta-main.js vacío y dibuja estados sintéticos con
// FIESTA.tablero/FIESTA.cam en 3 tamaños x estilos. Uso: node docs/style-lab/pruebas/fiesta-tablero-capturas.js [estilos,coma] [tamaños]
// Salida: pruebas/out/fiesta-tablero-<estilo>-<tam>-<escena>.png (+ prefijo antes_ si FIESTA_ANTES=1)
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cache = path.join(os.homedir(), '.npm/_npx');
const { chromium } = require(fs.readdirSync(cache).map((d) => path.join(cache, d, 'node_modules/playwright')).find(fs.existsSync));
const LAB = path.join(__dirname, '..'), OUT = process.env.FIESTA_OUT ? path.resolve(process.env.FIESTA_OUT) : path.join(__dirname, 'out');
function chromePath() {
  const shells = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  try { const d = fs.readdirSync(shells).filter((x) => x.startsWith('chromium_headless_shell-')).sort().pop();
    if (d) { const f = path.join(shells, d), sub = fs.readdirSync(f).find((x) => x.startsWith('chrome')); const p = path.join(f, sub, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; } } catch (_) {}
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; return fs.existsSync(mac) ? mac : undefined;
}
const ESTILOS = (process.argv[2] || 'snes,felt,tinta').split(',');
const TAMS = { '800x600': [800, 600], '360x640': [360, 640], '932x430': [932, 430] };
const TAM = (process.argv[3] || '800x600,360x640,932x430').split(',');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromePath() });
  for (const tn of TAM) {
    const [W, H] = TAMS[tn];
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.route('**/fiesta-main.js*', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto('file://' + path.join(LAB, 'fiesta.html'));
    await page.waitForFunction(() => window.FIESTA.arte && window.FIESTA.arte.lienzo(), null, { timeout: 120000 });
    for (const est of ESTILOS) {
      const escenas = await page.evaluate(({ est, W, H }) => {
        setStyle(est);
        const ratio = Math.max(4 / 3, Math.min(2.17, W / H)), vw = 600 * ratio, k = Math.min(W / vw, H / 600);
        GAME_VIEW.width = vw; GAME_VIEW.offsetX = (vw - 800) / 2; resizeGameBuffers(); view.height = 600;
        view.style.width = vw * k + 'px'; view.style.height = 600 * k + 'px';
        const F = FIESTA, T = F.tablero.crear({}), cam = F.cam.crear({ mundo: F.tablero.MUNDO, vista: { x: gameLeft(), y: 0, w: vw, h: 600 } });
        const mk = (n, ch, nodo) => ({ ch, nodo, name: n, cpu: null });
        const D = (pj) => ({ f: 'turno', pj, t: { s: 'a', paso: 'dado' }, esp: null, estrella: { nodo: 'ccs_galipan', precio: 20 }, tab: {} });
        const uno = D({ a: mk('Ana', 'mama', 'ccs_start') });
        const cuatro = D({ a: mk('Ana', 'mama', 'ccs_start'), b: mk('Beto', 'tio', 'ccs_start'), c: mk('Cris', 'pana', 'ccs_start'), d: mk('Dani', 'abuela', 'ccs_start') });
        const sal = D({ a: mk('Ana', 'mama', 'ccs_sabana'), b: mk('Beto', 'tio', 'ccs_start') });
        const out = [];
        const cuadro = (nombre, Db, zoom, op, dibujo, frames, foco) => {
          cam.general(0); cam.soltarForzado(); cam.modo = 'seguir';
          const f = foco || T.foco(Db) || { x: 2000, y: 1500 };
          cam.seguir(f.x, f.y, zoom); for (let i = 0; i < 200; i++) cam.update(1 / 60); cam.saltar();
          for (let i = 0; i < (frames || 40); i++) { now = 10 + i / 60; ctx = vctx; sceneTransform(vctx, 1); vctx.fillStyle = '#0b0b14'; vctx.fillRect(-2000, 0, 6000, 600);
            T.dibujar(vctx, cam, Db, Object.assign({ yo: 'a', t: now, presupuesto: 8 }, op)); }
          if (dibujo) dibujo(vctx);
          out.push(nombre);
          return nombre;
        };
        // dado grande de ejemplo en el hueco reservado (HUD real: fiesta-ui)
        const dado = (c) => { const cx = gameLeft() + vw / 2; c.save(); rr(cx - 45, 160, 90, 90, 16, '#ffffff', 4); txt('2', cx, 205, 56, '#14101c', 0, true); txt('QUEDAN 1', cx, 280, 28, '#ffffff'); c.restore(); };
        window.__esc = {};
        const res = [];
        const hacer = (n, fn) => { fn(); res.push(n); window.__esc[n] = true; };
        window.__paso = (n) => { };
        window.__dibujos = [
          ['caracas', () => cuadro('caracas', uno, .7, {}, dado)],
          ['pila4', () => cuadro('pila4', cuatro, 1.0, {})],
          ['pila4z', () => cuadro('pila4z', cuatro, .7, {}, dado)],
          ['salto', () => cuadro('salto', sal, .7, { saltos: { a: { de: 'ccs_start', a: 'ccs_sabana', k: .5 } } }, null, 2)],
          ['general', () => cuadro('general', cuatro, cam.zFit(), {}, null, 20, { x: 2000, y: 1500 })]
        ];
        window.__cam = cam; window.__T = T;
        return window.__dibujos.map((d) => d[0]);
      }, { est, W, H });
      for (let i = 0; i < escenas.length; i++) {
        await page.evaluate((i) => window.__dibujos[i][1](), i);
        const file = path.join(OUT, (process.env.FIESTA_ANTES ? 'antes_' : '') + 'fiesta-tablero-' + est + '-' + tn + '-' + escenas[i] + '.png');
        await (await page.$('#c')).screenshot({ path: file });
      }
      console.log('ok', est, tn, await page.evaluate(() => JSON.stringify(window.__T.stats)));
    }
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
