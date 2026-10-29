#!/usr/bin/env node
/* LA FIESTA · hojas de contacto de los personajes SIN PocketBase: monta engine.js + juegos-bus.js + fiesta-personajes.js en una página y dibuja con el motor real
   (así salen los 6 estilos de verdad). Por estilo e id: «<estilo>-<id>.png» = 4 ánimos (esperar, hablar, celebrar, perder) × 3 tamaños (cuerpo entero de 300 px,
   busto de 90 px, cara de 40 px); y por estilo «<estilo>-todos.png» = los 8 activos en reposo, de cuerpo entero.
   node docs/style-lab/pruebas/fiesta-personajes-hoja.js [--ids=mama,tio|all] [--estilos=snes,ww,garabato] [--t=0.8] [--todos=0] [--out=dir]
   Un solo personaje en los 6 estilos:  node docs/style-lab/pruebas/fiesta-personajes-hoja.js --ids=mama --todos=0
   Salida por defecto: docs/style-lab/pruebas/out/personajes/ (ids = los 8 activos, estilos = los 6, t = 0.8 s). Los PNG son el lienzo lógico 800×600. */
const fs = require('fs'), path = require('path'), os = require('os');
const LAB = path.resolve(__dirname, '..');
const pwDir = (() => { const base = path.join(os.homedir(), '.npm/_npx'); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'node_modules/playwright'); if (fs.existsSync(p)) return p; } throw new Error('playwright no está en ' + base); })();
const exe = (() => {                                              // chrome-headless-shell de Playwright o, si no, el Chrome de macOS
  try { const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
    for (const v of fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()) for (const d of fs.readdirSync(path.join(cache, v))) { const p = path.join(cache, v, d, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; } } catch (e) { /* sin caché */ }
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; if (fs.existsSync(mac)) return mac;
  throw new Error('no encontré chrome-headless-shell ni Google Chrome'); })();
const { chromium } = require(pwDir);
const flags = {}; for (const a of process.argv.slice(2)) { const m = /^--([a-z]+)=(.*)$/s.exec(a); if (m) flags[m[1]] = m[2]; }
const ESTILOS6 = ['snes', 'felt', 'ww', 'anime', 'tinta', 'garabato'];
const estilos = (flags.estilos || ESTILOS6.join(',')).split(',').filter(Boolean), out = path.resolve(flags.out || path.join(LAB, 'pruebas/out/personajes')),
  t = flags.t === undefined ? .8 : +flags.t, conTodos = flags.todos !== '0';
fs.mkdirSync(out, { recursive: true });

const SCRIPTS = ['engine.js', 'juegos-bus.js', 'fiesta-personajes.js'];
const html = '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden;background:#0b0b14}canvas{display:block}</style>'
  + '<canvas id="c" width="800" height="600"></canvas>' + SCRIPTS.map((s) => '<script src="file://' + path.join(LAB, s) + '"' + (s === 'juegos-bus.js' ? ' data-juego="-"' : '') + '></script>').join('');
const htmlPath = path.join(os.tmpdir(), 'fiesta-personajes-harness.html'); fs.writeFileSync(htmlPath, html);

// dentro de la página
const EN_PAGINA = () => {
  const PJ = window.FIESTA.PJ, MOODS = PJ.ANIMOS, COL = 200;
  const escala = (id) => 300 / (216 + (PJ.CHARS[id] ? PJ.CHARS[id].legs[2] : 58));      // cuerpo entero ≈ 300 px
  const fondo = () => { rr(0, 0, 800, 600, 0, '#ddd9f2', 0); for (let i = 1; i < 4; i++) line([[i * COL, 0], [i * COL, 600]], 2, '#c5c0e0'); };
  window.__pintar = (c) => {
    window.requestAnimationFrame = () => 0; hud = function () {}; frameWW = function () {};      // como fiesta-main: sin el HUD del laboratorio
    setStyle(c.estilo); GAME_VIEW.width = 800; GAME_VIEW.offsetX = 0; resizeGameBuffers(); view.height = 600;
    let ms = 0;
    const pintar = () => { now = c.t; const t0 = performance.now(); G = { draw: c.fn === 'hoja' ? hoja : todos, impact: 0, cmd: '', hint: '', t: 0, dur: 1e9, result: null }; paintFrame(); ms = performance.now() - t0; };
    const hoja = () => {
      fondo(); const id = c.id, sp = PJ.CHARS[id], s = escala(id);
      MOODS.forEach((m, i) => { const x = COL * i + COL / 2, tt = c.t + i * .13;
        PJ.draw(ctx, id, x, 340, s, m, tt, { modo: 'cuerpo', ancla: 'pies', sombra: true, semilla: 1 });
        PJ.draw(ctx, id, x, 415, 90 / 110, m, tt, { modo: 'busto', clip: { x: COL * i + 6, y: 352, w: COL - 12, h: 118 }, semilla: 1 });
        PJ.draw(ctx, id, x, 525, 40 / 110, m, tt, { modo: 'cara', clip: { x: x - 30, y: 500, w: 60, h: 50 }, semilla: 1 });
        PJ.token(id, x + 62, 525, 20, m, tt, {});
        txt(m.toUpperCase(), x, 578, 15, '#14101c', 0, true); });
      PJ.placa(110, 16, (sp ? sp.n : id) + ' · ' + c.estilo, id, { w: 210 }); txt('«' + PJ.frase(id, 'hablar', 0) + '»', 560, 16, 15, '#14101c', 0, true);
    };
    const todos = () => {
      rr(0, 0, 800, 600, 0, '#ddd9f2', 0); const ids = PJ.lista().slice(0, 8);
      ids.forEach((id, i) => { const x = COL * (i % 4) + COL / 2, fy = i < 4 ? 262 : 556, s = .88 * 58 / 58 * (270 / (216 + 58)) * 1;
        PJ.draw(ctx, id, x, fy, s, 'esperar', c.t + i * .2, { modo: 'cuerpo', ancla: 'pies', sombra: true, semilla: 1 });
        PJ.placa(x, fy + 18, PJ.CHARS[id].n, id, { w: 150 }); });
    };
    pintar(); for (let i = 0; i < 30; i++) pintar();            // el último cuadro queda en el lienzo; el promedio es solo orientativo
    const t0 = performance.now(); for (let i = 0; i < 20; i++) pintar(); ms = (performance.now() - t0) / 20;
    return { ms };
  };
  window.__logico = () => view.toDataURL('image/png');
};

(async () => {
  const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  const errores = []; let n = 0; const t0 = Date.now();
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('pageerror', (e) => errores.push('pageerror: ' + String(e.stack || e).slice(0, 500)));
  p.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text().slice(0, 300)); });
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; window.snd = function () {}; });
  await p.goto('file://' + htmlPath);
  await p.waitForFunction(() => typeof window.FIESTA !== 'undefined' && !!window.FIESTA.PJ);
  await p.evaluate('(' + EN_PAGINA.toString() + ')()');
  const todosIds = await p.evaluate(() => window.FIESTA.PJ.lista(true)), activos = await p.evaluate(() => window.FIESTA.PJ.lista());
  const ids = !flags.ids ? activos : flags.ids === 'all' ? todosIds : flags.ids.split(',').filter(Boolean);
  for (const id of ids) if (todosIds.indexOf(id) < 0) { console.error('id desconocido: ' + id + ' (hay: ' + todosIds.join(', ') + ')'); process.exit(2); }
  const guarda = async (nombre, cfg) => {
    let r; try { r = await p.evaluate((c) => window.__pintar(c), cfg); } catch (e) { errores.push(nombre + ': ' + String(e.message).slice(0, 400)); return; }
    const d = await p.evaluate(() => window.__logico()); fs.writeFileSync(path.join(out, nombre + '.png'), Buffer.from(d.split(',')[1], 'base64'));
    n++; console.log('✓ ' + nombre + '  ' + r.ms.toFixed(1) + ' ms/cuadro');
  };
  for (const estilo of estilos) {
    for (const id of ids) await guarda(estilo + '-' + id, { estilo, id, t, fn: 'hoja' });
    if (conTodos) await guarda(estilo + '-todos', { estilo, t, fn: 'todos' });
  }
  await b.close();
  console.log(n + ' hojas en ' + out + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  if (errores.length) { console.error('PROBLEMAS:\n' + errores.join('\n')); process.exit(1); }
})();
