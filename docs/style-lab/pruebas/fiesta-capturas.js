#!/usr/bin/env node
/* LA FIESTA · capturas de la página REAL (fiesta.html) con PocketBase de verdad (test/helpers/pb-harness.js), para los 6 estilos del laboratorio.
   node docs/style-lab/pruebas/fiesta-capturas.js [--estilos=snes,felt,...] [--vp=1280x720,932x430,360x640,390x844] [--out=dir] [--max=seg]
   Un humano (el que captura) juega una partida corta (2 rondas, 60 monedas, plazos largos) y, cuando aparece cada pantalla, cambia de estilo con
   setStyle() (el mismo mecanismo que usa el laboratorio) y fotografía. Los viewports corren en paralelo, cada uno con su sala.
   Pantallas: menu lobby seleccion dado(+tablero apilado y etiquetas) ruta tienda estrella turno salto carta podio.
   Salida: out/fiesta-cap/<estilo>-<WxH>-<pantalla>.png (se leen con Read). Las que el azar de la partida no ofrece se listan al final. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { start, ROOT } = require('../../../test/helpers/pb-harness.js');
const cache = path.join(os.homedir(), '.npm/_npx');
const { chromium } = require(fs.readdirSync(cache).map((d) => path.join(cache, d, 'node_modules/playwright')).find(fs.existsSync));
const flags = {}; for (const a of process.argv.slice(2)) { const m = /^--([a-z]+)=(.*)$/.exec(a); if (m) flags[m[1]] = m[2]; }
const OUT = flags.out ? path.resolve(flags.out) : path.join(__dirname, 'out', 'fiesta-cap');
const ESTILOS = (flags.estilos || 'snes,felt,ww,anime,tinta,garabato').split(',');
const VPS = (flags.vp || '1280x720,932x430,360x640,390x844').split(',').map((s) => { const [w, h] = s.split('x').map(Number); return { w, h, id: s, movil: w < 1000 }; });
const MAX_MS = (+flags.max || 420) * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hechas = [], errores = [];

function chromePath() {
  const shells = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  try {
    const d = fs.readdirSync(shells).filter((x) => x.startsWith('chromium_headless_shell-')).sort().pop();
    if (d) { const f = path.join(shells, d), sub = fs.readdirSync(f).find((x) => x.startsWith('chrome')); const p = path.join(f, sub, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  } catch (_) {}
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return fs.existsSync(mac) ? mac : undefined;
}
// partida corta, con dinero (tienda y estrella salen) y plazos largos para que el cambio de estilo no agote el aviso
const PATCHES = [
  [/var PLAZO=\{[^}]*\}/, 'var PLAZO={DADO:60000,DADO1:60000,RUTA:60000,TIENDA:60000,ESTRELLA:60000,OBJETIVO:20000,COMMIT:20000}'],
  [/var CFG0=\{tot:15,[^}]*mon0:10,/, (m) => m.replace('tot:15', 'tot:2').replace('mon0:10', 'mon0:60')],
  [/carta:4500\+15000/, 'carta:4500+6000'],
  [/dur:\d+/g, 'dur:4']
];

const est = (p) => p.evaluate(() => FIESTA_DEBUG.estado());
const botones = (p) => p.evaluate(() => FIESTA_DEBUG.botones());
async function boton(p, id) { return p.evaluate((i) => FIESTA_DEBUG.boton(i), id); }
async function tocar(p, id, ms) {
  const t0 = Date.now(); let b = null;
  while (Date.now() - t0 < (ms || 6000)) { b = await boton(p, id); if (b && !b.off) break; await sleep(100); }
  if (!b || b.off) return false;
  if (p.__touch) await p.touchscreen.tap(b.x, b.y); else await p.mouse.click(b.x, b.y);
  return true;
}
async function hasta(p, fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = await est(p); if (fn(e)) return e; await sleep(150); } return null; }

// fotografía la pantalla actual en los 6 estilos (o solo en 'unos'); deja el estilo en snes
async function fotos(p, vp, pantalla, unos) {
  const lista = unos || ESTILOS;
  for (const s of lista) {
    await p.evaluate((x) => { setStyle(x); }, s); await sleep(450);
    const f = s + '-' + vp.id + '-' + pantalla + '.png';
    try { await p.screenshot({ path: path.join(OUT, f), timeout: 60000 }); hechas.push(f); }
    catch (e) { try { await sleep(1000); await p.screenshot({ path: path.join(OUT, f), timeout: 60000 }); hechas.push(f); } catch (e2) { errores.push(vp.id + ' captura fallida ' + f + ': ' + String(e2.message).split('\n')[0]); } }
  }
  await p.evaluate(() => { setStyle('snes'); });
}

// responde mi aviso como una persona (mismo criterio que test/fiesta.e2e.js)
async function jugar(p) {
  const e = await est(p);
  if (!e.prompt || e.pantalla !== 'juego') return null;
  const ids = await botones(p), has = (id) => ids.indexOf(id) >= 0;
  let id = null;
  if (e.prompt === 'COMMIT') id = 'orden';
  else if (e.prompt === 'LISTO') id = 'listo';
  else if (e.afk) id = 'volvi';
  else if (e.prompt === 'DADO') id = 'tirar';
  else if (e.prompt === 'TIENDA') id = 'nada';
  else if (e.prompt === 'ESTRELLA') id = has('si') ? 'si' : 'no';
  else if (e.prompt === 'OBJETIVO') id = ids.find((x) => /^obj:/.test(x));
  else if (e.prompt === 'RUTA') id = ids.find((x) => /^ruta:/.test(x));
  if (!id || !has(id)) return null;
  await tocar(p, id, 1500); await sleep(250);
  return e.prompt;
}

async function correr(browser, pb, vp, i) {
  const ctx = await browser.newContext(vp.movil ? { viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: vp.w, height: vp.h } });
  const p = await ctx.newPage(); p.__touch = vp.movil;
  const tag = vp.id;
  p.on('pageerror', (e) => errores.push(tag + ' pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 409/.test(m.text())) errores.push(tag + ' console: ' + m.text()); });
  const vistas = {}, rot = { turno: i, salto: i + 2 };   // pantallas ya fotografiadas; rotación de estilo para las fugaces
  await p.goto(pb.page());
  if (!await hasta(p, (e) => e.pantalla === 'menu', 12000)) { errores.push(tag + ' no llegó al menú'); return; }
  await fotos(p, vp, 'menu', ['snes', 'garabato']);
  let sala = null;
  for (let n = 0; n < 4 && !sala; n++) {                 // en el teléfono el primer toque tras cambiar de estilo a veces no llega: se repite
    if (!await tocar(p, 'crear')) { await sleep(500); continue; }
    sala = await hasta(p, (e) => e.pantalla === 'sala' && e.code, 20000);
  }
  if (!sala) { errores.push(tag + ' sin sala: ' + JSON.stringify(await est(p)).slice(0, 200)); return; }
  await sleep(1400);                                   // que terminen las animaciones de llegada
  // selección: en pantallas chicas es otra pestaña; sin personaje elegido todavía
  if (await boton(p, 'tab:pj')) { await tocar(p, 'tab:pj'); await sleep(500); }
  await fotos(p, vp, 'seleccion');
  const ids = (await botones(p)).filter((x) => /^pj:/.test(x) && !/\(off\)/.test(x));
  const elegido = ids.indexOf('pj:mama') >= 0 ? 'pj:mama' : ids[0];
  if (elegido) { await tocar(p, elegido); await sleep(1200); }
  await fotos(p, vp, 'lobby');
  // el reductor pide 2 humanos: una segunda página (teléfono) entra con ?r=CODE, elige otro personaje y queda lista
  const code = (await est(p)).code;
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const B = await ctxB.newPage(); B.__touch = true;
  B.on('pageerror', (e) => errores.push(tag + ' B pageerror: ' + e.message));
  await B.goto(pb.page() + '?r=' + code);
  if (!await hasta(B, (e) => e.pantalla === 'sala' && e.seat, 12000)) { errores.push(tag + ' B no entró'); return; }
  if (await boton(B, 'tab:pj')) { await tocar(B, 'tab:pj'); await sleep(300); }
  await tocar(B, 'pj:abuela'); await sleep(500);
  for (let n = 0; n < 5; n++) {                          // «listo» hasta que el anfitrión pueda empezar (el primer toque a veces no llega)
    await tocar(B, 'listo', 3000); await sleep(900);
    const b = await boton(p, 'empezar'); if (b && !b.off) break;
  }
  await sleep(500);
  await fotos(p, vp, 'lobby-2');
  if (!await tocar(p, 'empezar', 5000)) { errores.push(tag + ' no se pudo empezar: ' + (await botones(p)).join(' ')); return; }
  const t0 = Date.now(); let turnos = 0, juego = false;
  for (;;) {
    if (Date.now() - t0 > MAX_MS) break;
    const e = await est(p);
    if (e.pantalla === 'juego') juego = true;
    if (Date.now() - (vistas.ult || 0) > 60000) { vistas.ult = Date.now(); const eb = await est(B); console.log(tag, Math.round((Date.now() - t0) / 1000) + 's', e.f, 'ronda', e.r, 'turnos', e.turnos, 'A:' + (e.prompt || '-'), 'B:' + (eb.prompt || '-'), eb.afk ? 'B-afk' : '', eb.pantalla, (await botones(B)).join(',')); }
    if (e.f === 'fin') {
      if (!vistas.podio) { vistas.podio = 1; await sleep(4500); await fotos(p, vp, 'podio'); }
      break;
    }
    if (e.pantalla === 'juego' && e.turnos > turnos) { turnos = e.turnos; if (!vistas.t_ || vistas.t_ < 2) { vistas.t_ = (vistas.t_ || 0) + 1; const s = ESTILOS[rot.turno++ % ESTILOS.length]; await fotos(p, vp, 'turno' + vistas.t_, [s]); } }
    if (e.paso === 'hop' && (vistas.hop || 0) < 2) { vistas.hop = (vistas.hop || 0) + 1; const s = ESTILOS[rot.salto++ % ESTILOS.length]; await fotos(p, vp, 'salto' + vistas.hop, [s]); }
    if ((e.f === 'carta' || e.f === 'mj' || e.f === 'res') && !vistas.carta) { vistas.carta = 1; await sleep(600); await fotos(p, vp, 'carta', ['snes', 'felt']); }
    if (e.prompt && e.pantalla === 'juego' && !e.afk) {
      const k = e.prompt;
      if (k === 'DADO' && e.turnos >= 2 && !vistas.dado) { vistas.dado = 1; await sleep(800); await fotos(p, vp, 'dado'); }
      else if (k === 'DADO' && !vistas.dado0) { vistas.dado0 = 1; await sleep(800); await fotos(p, vp, 'dado-apilado'); }
      if ((k === 'RUTA' || k === 'TIENDA' || k === 'ESTRELLA') && !vistas[k]) { vistas[k] = 1; await sleep(700); await fotos(p, vp, k.toLowerCase()); }
    }
    await jugar(p); await jugar(B);
    await sleep(150);
  }
  if (!juego) errores.push(tag + ' nunca pasó a juego');
  const falta = ['dado', 'dado0', 'RUTA', 'TIENDA', 'ESTRELLA', 'carta', 'podio', 'hop'].filter((k) => !vistas[k]);
  if (falta.length) errores.push(tag + ' NO capturado (el azar no lo ofreció): ' + falta.join(', '));
  await ctxB.close(); await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pb = await start({ patches: PATCHES, verbose: !!process.env.PB_VERBOSE });
  console.log('pocketbase', pb.url);
  const browser = await chromium.launch({ executablePath: chromePath(), headless: !process.env.HEADED });
  try {   // de a CONC viewports a la vez: más páginas en paralelo ahogan el render y las capturas se agotan
    const CONC = +flags.conc || 2;
    for (let i = 0; i < VPS.length; i += CONC) await Promise.all(VPS.slice(i, i + CONC).map((vp, j) => correr(browser, pb, vp, i + j).catch((e) => errores.push(vp.id + ' excepción: ' + e.message))));
  }
  finally { await browser.close().catch(() => {}); await pb.stop(); }
  console.log(hechas.length + ' capturas en ' + OUT);
  if (errores.length) console.log('avisos:\n' + errores.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
