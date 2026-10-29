#!/usr/bin/env node
/* LA FIESTA · capturas del HUD (fiesta-ui.js) sin PocketBase: estado sintético del reductor + HUD dibujado sobre el lienzo del laboratorio.
   node docs/style-lab/pruebas/fiesta-ui-capturas.js [--estilos=snes,felt,tinta] [--tamanos=800x600,360x640,932x430] [--escenas=dado,tienda,...] [--out=dir]
   Escenas: dado banner rodando ruta tienda estrella espera log final. Guarda out/ui/<escena>-<estilo>-<WxH>.png (se leen con Read). */
const fs = require('fs'), path = require('path'), os = require('os');
const LAB = path.resolve(__dirname, '..');
const flags = {}; for (const a of process.argv.slice(2)) { const m = /^--([a-z]+)=(.*)$/.exec(a); if (m) flags[m[1]] = m[2]; }
const pwDir = (() => { const base = path.join(os.homedir(), '.npm/_npx'); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'node_modules/playwright'); if (fs.existsSync(p)) return p; } throw new Error('playwright no está en ' + base); })();
const exe = (() => { const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  try { for (const v of fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()) for (const d of fs.readdirSync(path.join(cache, v))) { const p = path.join(cache, v, d, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; } } catch (e) { /* sin caché */ }
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; if (fs.existsSync(mac)) return mac; throw new Error('no hay Chrome'); })();
const { chromium } = require(pwDir);
const out = flags.out ? path.resolve(flags.out) : path.join(__dirname, 'out', 'ui');
const estilos = (flags.estilos || 'snes,felt,tinta').split(','), tamanos = (flags.tamanos || '800x600,360x640,932x430').split(',');
const escenas = (flags.escenas || 'dado,banner,rodando,ruta,tienda,estrella,espera,log,final').split(',');

const EN_PAGINA = `(function(){
  window.snd = function(){}; hud = function(){};
  const NOW = 1e12;
  function crearEstado(){
    const R = FIESTA.reglas;
    let r = R.crear(7, {}, [{ name: 'ANA', ch: 'mama' }, { name: 'BETO', ch: 'tio' }], NOW), S = r.S, priv = r.priv;
    r = R.aplicar(S, priv, 'a', { t: 'COMMIT', k: 'orden', eid: S.esp.id, aid: 'o1' }, NOW); r = R.aplicar(r.S, r.priv, 'b', { t: 'COMMIT', k: 'orden', eid: r.S.esp.id, aid: 'o2' }, NOW);
    return JSON.parse(JSON.stringify(r.S));
  }
  function turnoDe(S, s, esp) { S.f = 'turno'; S.mj = null; S.t = { s, paso: 'pre', resto: 0, usado: 0, mod: null, pend: [], cas: 0, compro: 0, compras: 0, desde: S.pj[s].nodo };
    S.esp = Object.assign({ id: S.ver, s, k: 'DADO', opc: ['TIRAR'], hasta: NOW + 17000 }, esp || {}); return S; }
  window.__escena = function(o){
    setStyle(o.estilo); const e = o.w / o.h, ratio = Math.max(4/3, Math.min(2.17, e)), vw = 600 * ratio;
    GAME_VIEW.width = vw; GAME_VIEW.offsetX = (vw - 800) / 2; resizeGameBuffers(); if (view.height !== 600) view.height = 600;
    const k = Math.min(o.w / vw, o.h / 600), compacto = o.h > o.w || k < .72;
    let clk = 100; const ui = FIESTA.ui.crear({ reloj: () => clk, emit: () => {} });
    const S = turnoDe(crearEstado(), 'a');
    S.pj.a.mon = 31; S.pj.a.est = 1; S.pj.b.mon = 12; S.pj.a.obj = ['malta', 'chancla', null]; S.r = 3; S.tot = 15; S.log = ['ANA cayó en un billete', 'BETO compró una malta', 'ANA sacó 7'];
    let yo = 'a', fx = [], extra = {};
    if (o.escena === 'tienda') { S.pj.a.mon = 30; S.esp = { id: S.ver, s: 'a', k: 'TIENDA', opc: [{ item: 'malta', precio: 5, quedan: 2 }, { item: 'guayoyo', precio: 12, quedan: 2 }, { item: 'arepa', precio: 8, quedan: 1 }], hasta: NOW + 12000 }; }
    if (o.escena === 'ruta') { const R = FIESTA.reglas; S.esp = { id: S.ver, s: 'a', k: 'RUTA', opc: R.salidas(S, 'a', S.pj.a.nodo, 5), hasta: NOW + 9000 }; }
    if (o.escena === 'estrella') { S.pj.a.mon = 40; S.esp = { id: S.ver, s: 'a', k: 'ESTRELLA', opc: [{ precio: 20 }], hasta: NOW + 4000 }; fx = [{ k: 'est', s: 'a', d: 1, tot: 2 }]; }
    if (o.escena === 'dado') S.esp.hasta = NOW + 3000;
    if (o.escena === 'espera') yo = 'b';
    if (o.escena === 'banner') fx = [{ k: 'turno', s: 'a' }];
    if (o.escena === 'rodando') { S.t.paso = 'mover'; S.esp = null; fx = [{ k: 'turno', s: 'a' }, { k: 'dado', s: 'a', v: 7, dados: [7], de: 'd6' }, { k: 'mon', s: 'a', d: 3, tot: 34 }, { k: 'hop', s: 'a', pasos: 2 }]; }
    if (o.escena === 'final') {
      S.f = 'fin'; S.esp = null; S.pj.a.est = 3; S.pj.a.mon = 44; S.pj.b.est = 2; S.pj.b.mon = 20;
      const pc = Object.keys(S.pj); pc.forEach((s) => { if (S.pj[s].cpu) { S.pj[s].est = 1; S.pj[s].mon = 9 + s.charCodeAt(0) % 5; } });
      S.podio = FIESTA.reglas.rango(S).map((s, i) => ({ s, est: S.pj[s].est, mon: S.pj[s].mon, p: i + 1 }));
      fx = [{ k: 'bonus', s: 'a', id: 'ricachon', v: 40 }, { k: 'bonus', s: 'b', id: 'minijuegos', v: 3 }, { k: 'fin', gan: ['a'] }];
    }
    G = { t: 0, dur: 1, result: null, impact: 0, cmd: '', hint: '', update(){}, press(){}, draw(){ ui.dibujar({ S, yo, serverNow: NOW, izq: gameLeft(), der: gameRight(), compacto, k, net: { estado: 'ok' }, seats: [], backlog: 0 }); } };
    now = 0; paintFrame(); fx.forEach((f) => ui.efecto(f, S, yo));
    if (o.escena === 'log') ui.logAbierto = true;
    const frames = { banner: 14, rodando: 30, estrella: 55, final: 130, dado: 20, tienda: 10 }[o.escena] || 20;
    for (let i = 0; i < frames; i++) { clk += 1 / 30; now += 1 / 30; FRJ = Math.floor(now * 10); paintFrame(); }
    if (o.escena === 'dado' || o.escena === 'tienda') { ui.mover(400, 520, false); }
    return { png: view.toDataURL('image/png'), w: view.width, h: view.height, botones: ui.B.lista.map((b) => b.id + ':' + Math.round(b.w) + 'x' + Math.round(b.h)) };
  };
})();`;

(async () => {
  const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 500))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await p.goto('file://' + path.join(LAB, 'index.html')); await p.waitForFunction(() => !!window.__lab);
  for (const f of ['juegos-bus.js', 'fiesta-rng.js', 'fiesta-mapa-venezuela.js', 'fiesta-reglas.js', 'fiesta-personajes.js', 'fiesta-ui.js']) await p.addScriptTag({ path: path.join(LAB, f) });
  await p.addScriptTag({ content: EN_PAGINA });
  fs.mkdirSync(out, { recursive: true });
  let n = 0;
  for (const estilo of estilos) for (const tam of tamanos) for (const escena of escenas) {
    const [w, h] = tam.split('x').map(Number);
    let r; try { r = await p.evaluate((o) => window.__escena(o), { estilo, w, h, escena }); } catch (e) { console.error('✗', escena, estilo, tam, String(e).slice(0, 400)); continue; }
    const f = path.join(out, escena + '-' + estilo + '-' + tam + '.png'); fs.writeFileSync(f, Buffer.from(r.png.split(',')[1], 'base64'));
    const chicos = r.botones.filter((x) => { const [bw, bh] = x.split(':')[1].split('x').map(Number); return Math.min(bw, bh) * k(w, h) < 44; });
    if (chicos.length) console.log('  botón <44px reales en', escena, tam, chicos.join(' '));
    n++;
  }
  console.log('listo: ' + n + ' capturas en ' + out); if (errs.length) console.log('errores de página:\n' + errs.slice(0, 6).join('\n'));
  await b.close();
  function k(w, h) { const ratio = Math.max(4 / 3, Math.min(2.17, w / h)), vw = 600 * ratio; return Math.min(w / vw, h / 600); }
})();
