#!/usr/bin/env node
/* LA FIESTA · capturas del lobby SIN PocketBase: monta engine.js + fiesta-ui.js + fiesta-lobby.js en una página, arma salas sintéticas
   (room/board a mano, igual que las que entrega fiesta-net) y saca PNG de cada pantalla en varios tamaños y estilos.
   node docs/style-lab/pruebas/fiesta-lobby-capturas.js [--estilos=snes,felt,tinta] [--tam=800x600,360x640p,932x430]  (sufijo p = vertical con el lienzo estrecho que llena el teléfono; sin p = como hoy: 4:3 centrado) [--escenas=menu,sala,...] [--out=dir]
   Escenas: menu · codigo · sala (anfitrión, ya con personaje) · sala-pj (invitado sin personaje, pestaña PERSONAJE) · sala-entrada (cae un jugador)
            sala-emotes (panel abierto) · sala-admin (flags de expulsar/ceder) · sala-foco (foco de teclado) · mira (espectador)
   Dos PNG por captura: «<nombre>.png» = la pantalla como la ve el jugador (CSS) y «<nombre>-logico.png» = el lienzo lógico 600 de alto. */
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
const estilos = (flags.estilos || 'snes,felt,tinta').split(','), tams = (flags.tam || '800x600,360x640,932x430').split(','),
  escenas = (flags.escenas || 'menu,sala,sala-pj,sala-entrada,sala-emotes').split(','), out = path.resolve(flags.out || path.join(LAB, 'pruebas/out'));
fs.mkdirSync(out, { recursive: true });

const SCRIPTS = ['engine.js', 'juegos-bus.js', 'fiesta-personajes.js', 'fiesta-ui.js', 'fiesta-lobby.js'];
const html = '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden;background:#0b0b14;display:flex;align-items:center;justify-content:center}canvas{display:block}</style>'
  + '<canvas id="c" width="800" height="600"></canvas>' + SCRIPTS.map((s) => '<script src="file://' + path.join(LAB, s) + '"' + (s === 'juegos-bus.js' ? ' data-juego="-"' : '') + '></script>').join('');
const htmlPath = path.join(os.tmpdir(), 'fiesta-lobby-harness.html'); fs.writeFileSync(htmlPath, html);

// dentro de la página
const EN_PAGINA = () => {
  const F = window.FIESTA, RATIO_MAX = 2.17;
  // portrait='p': el lienzo lógico se estrecha (ancho 600·iw/ih) y llena el teléfono, ~1.07 px por unidad (lo que pide el doc como «vertical bueno»)
  const encaje = (iw, ih, p) => { if (p && ih > iw) { const vw = 600 * iw / ih; return { vw, ox: (vw - 800) / 2, k: ih / 600, cssW: iw, cssH: ih }; }
    return encaje0(iw, ih); };
  const encaje0 = (iw, ih) => { const ratio = Math.max(4 / 3, Math.min(RATIO_MAX, iw / Math.max(1, ih))), vw = 600 * ratio, k = Math.min(iw / vw, ih / 600); return { vw, ox: (vw - 800) / 2, k, cssW: vw * k, cssH: 600 * k }; };
  const salaDe = (o) => {
    o = o || {}; const pl = [{ id: 'a', name: 'PANA 4859', color: '#D97757' }, { id: 'b', name: 'PANA 5712', color: '#6EA8FE' }, { id: 'c', name: 'LUCHO', color: '#7BD88F' }].slice(0, o.n || 2);
    const pj = { a: { ch: o.cha === undefined ? 'mama' : o.cha, listo: false }, b: { ch: o.chb === undefined ? 'abuela' : o.chb, listo: !!o.listob }, c: { ch: o.chc || null, listo: false } };
    return { code: '7RGP', host: 'a', players: pl, board: { f: 'lobby', pj, cfg: { tot: 15, ronda: 'clasica', reglas: 'caos', cpuNivel: 2 } } };
  };
  window.__escena = function (c) {
    window.requestAnimationFrame = () => 0; hud = function () {}; frameWW = function () {};      // como fiesta-main: sin el HUD del laboratorio
    setStyle(c.estilo);
    const e = encaje(c.w, c.h, c.p); GAME_VIEW.width = e.vw; GAME_VIEW.offsetX = e.ox; resizeGameBuffers(); view.height = 600;
    view.style.width = e.cssW + 'px'; view.style.height = e.cssH + 'px';
    const compacto = c.h > c.w || e.k < .72;
    let T = 10; const emit = (it) => (window.__emitidos = window.__emitidos || []).push(it);
    const L = F.lobby.crear({ emit, storage: null, reloj: () => T, origin: 'https://minicaos.app', rnd: () => .31 });
    const vmBase = () => ({ izq: gameLeft(), der: gameRight(), compacto, t: T, k: e.k, net: { estado: 'ok' }, sesion: null });
    let room = null, vm = null, yo = 'a';
    const sala = (o) => { room = salaDe(o); vm = Object.assign(vmBase(), { room, S: room.board, yo, serverNow: 0, seats: [{ id: 'b', rtt: 82, online: true }, { id: 'c', rtt: 240, online: true }] }); };
    const pintar = (dt) => { T += dt; now = T; vm.t = T; Object.assign(vm, { izq: gameLeft(), der: gameRight() }); G = { draw: () => L.dibujar(vm), impact: 0, cmd: '', hint: '', t: 0, dur: 1e9, result: null }; paintFrame(); };
    const quien = c.escena;
    if (quien === 'menu') { vm = Object.assign(vmBase(), { sesion: { code: 'QWER', id: 'a', key: 'k' } }); }
    else if (quien === 'codigo') { vm = vmBase(); L.ir('codigo'); L.codigo = 'K7'; }
    else if (quien === 'mira') { sala({ n: 3 }); room.board.f = 'turno'; room.board.pj.a.cpu = 'auto'; vm.espectador = true; vm.yo = null; vm.S = room.board; }
    else {
      yo = quien === 'sala-pj' ? 'b' : 'a';
      sala(quien === 'sala-pj' ? { chb: null, n: 2 } : quien === 'sala-entrada' ? { n: 1, chb: null } : quien === 'sala-admin' ? { n: 3, chc: 'tio' } : { n: 2, listob: true });
      if (quien === 'sala-pj') { L.tab = 'pj'; L.tabAuto = true; }
      if (quien === 'sala-admin') { vm.puedeExpulsar = true; vm.puedeCeder = true; }
    }
    for (let i = 0; i < 6; i++) pintar(1 / 30);
    if (quien === 'sala-entrada') { sala({ n: 3, chb: 'abuela', chc: 'tio' }); room.board.pj.b.listo = true; pintar(.18); pintar(.1); }
    if (quien === 'sala-emotes') { pintar(.1); L.tap(...centro(L, 'lemo')); pintar(.1); L.tap(...centro(L, 'lemo:fire')); pintar(.1); }
    if (quien === 'sala-pj') { if (L.B.porId('tab:pj')) { L.tap(...centro(L, 'tab:pj')); pintar(.05); } L.tap(...centro(L, 'pj:pana')); pintar(.3); }
    if (quien === 'sala-foco') { L.tecla('ArrowRight'); L.tecla('ArrowDown'); L.tecla('ArrowRight'); pintar(.1); }
    pintar(.2);
    const t0 = performance.now(); for (let i = 0; i < 40; i++) pintar(1 / 60); const ms = (performance.now() - t0) / 40;     // coste por cuadro (CPU de esta máquina, solo orientativo)
    return { ms, compacto, k: e.k, vw: e.vw, botones: L.B.lista.map((b) => b.id), solapes: window.__solapes(L) };
  };
  const centro = (L, id) => { const b = L.B.porId(id); if (!b) throw new Error('sin botón ' + id); return [b.x + b.w / 2, b.y + b.h / 2]; };
  window.__solapes = (L) => F.lobby.solapes(L.B.lista.filter((b) => b.id && !b.off && !/^key:/.test(b.id)));
  window.__logico = () => view.toDataURL('image/png');
};

(async () => {
  const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  const errores = []; let n = 0;
  for (const tam of tams) {
    const [w, h] = tam.replace('p', '').split('x').map(Number), pv = /p$/.test(tam);
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', (e) => errores.push(tam + ' pageerror: ' + String(e.stack || e).slice(0, 500)));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(tam + ' console: ' + m.text().slice(0, 300)); });
    await p.addInitScript(() => { window.requestAnimationFrame = () => 0; window.snd = function () {}; });
    await p.goto('file://' + htmlPath);
    await p.waitForFunction(() => typeof window.FIESTA !== 'undefined' && !!window.FIESTA.lobby);
    await p.evaluate('(' + EN_PAGINA.toString() + ')()');
    for (const estilo of estilos) for (const escena of escenas) {
      let r; try { r = await p.evaluate((c) => window.__escena(c), { w, h, estilo, escena, p: pv }); } catch (e) { errores.push(`${tam} ${estilo} ${escena}: ${String(e.message).slice(0, 300)}`); continue; }
      const nombre = `fiesta-lobby-${escena}-${tam}-${estilo}`;
      await p.screenshot({ path: path.join(out, nombre + '.png') });
      const d = await p.evaluate(() => window.__logico()); fs.writeFileSync(path.join(out, nombre + '-logico.png'), Buffer.from(d.split(',')[1], 'base64'));
      n++; if (r.solapes.length) errores.push(`${nombre}: botones que se pisan ${JSON.stringify(r.solapes)}`);
      console.log('✓ ' + nombre + (r.compacto ? ' (compacto)' : '') + ' k=' + r.k.toFixed(2) + ' ' + r.ms.toFixed(1) + ' ms/cuadro');
    }
    await p.close();
  }
  await b.close();
  console.log(n + ' capturas en ' + out);
  if (errores.length) { console.error('PROBLEMAS:\n' + errores.join('\n')); process.exit(1); }
})();
