#!/usr/bin/env node
/* Capturas de f_domino con el runtime real (LIVE.practice) en el laboratorio: node pruebas/fiesta-domino-capturas.js [estilos=tinta,snes,felt] [niveles=1,2,3]
   Guarda PNG en pruebas/out/fiesta-domino-<estilo>-lv<n>-<momento>.png. Un bot pulsa en el compás con el reloj de práctica. */
const fs = require('fs'), path = require('path'), os = require('os');
const LAB = path.resolve(__dirname, '..');
const pwDir = (() => { const base = path.join(os.homedir(), '.npm/_npx'); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'node_modules/playwright'); if (fs.existsSync(p)) return p; } throw new Error('playwright no está en ~/.npm/_npx'); })();
const exe = (() => { const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  try { for (const v of fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse()) for (const d of fs.readdirSync(path.join(cache, v))) { const p = path.join(cache, v, d, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; } } catch (_) {}
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; return fs.existsSync(mac) ? mac : undefined; })();
const { chromium } = require(pwDir);
const estilos = (process.argv[2] || 'tinta,snes,felt').split(','), niveles = (process.argv[3] || '1,2,3').split(',').map(Number);
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  const err = [];
  p.on('pageerror', e => err.push('pageerror: ' + String(e.stack || e).slice(0, 400)));
  p.on('console', m => { if (m.type() === 'error') err.push('console.error: ' + m.text().slice(0, 300)); });
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await p.goto('file://' + path.join(LAB, 'index.html'));
  await p.waitForFunction(() => !!window.__lab);
  for (const f of ['juegos-bus.js', 'fiesta-rng.js', 'fiesta-mapa-venezuela.js', 'fiesta-reglas.js', 'fiesta-live.js']) await p.addScriptTag({ path: path.join(LAB, f) });
  // el catálogo del servidor (E3, DM2-3) aún puede traer el f_domino viejo: se alinea SOLO en esta página para que LIVE.add pase la paridad
  await p.evaluate(() => { const e = FIESTA.reglas.CATALOGO.filter(x => x.g === 'f_domino')[0]; if (e && e.mo !== 'B') { e.mo = 'B'; e.dur = 30; e.live = 1; e.lim = { scoreMax: 1000, scoreRate: 40, minT: 27, finTemprano: 0 }; window.__catalogoParcheado = true; } });
  await p.addScriptTag({ path: path.join(LAB, 'fiesta-juego-domino.js') });
  await p.evaluate(() => { window.snd = () => {}; window.nz = () => {}; });
  let n = 0;
  for (const lv of niveles) for (const st of estilos) {
    const r = await p.evaluate(async ({ lv, st }) => {
      __lab.setStyle(st);
      const P = FIESTA.LIVE.practice('f_domino', { lv, seed: 12345 });
      const shots = {}, g = () => P.sess.g, shot = k => { P.draw(); drawP && 0; shots[k] = document.getElementById('c').toDataURL('image/png'); };
      const dt = 1 / 60; let t = 0, taps = 0; const pl = [];
      const step = () => { P.update(dt); t += dt; };
      // cuenta
      for (let i = 0; i < 10; i++) step();
      shot('0-cuenta');
      let sh = { '1-ya': 3.2, '2-medio': 9.5, '3-apagon': 0, '4-fin': 19 };
      const v = () => g() && g().vista && g().vista();
      let done = {}, ix = 0, bot = [];
      for (let i = 0; i < 60 * 24; i++) {
        const G = g(); const gt = P.gt();
        if (G && gt >= 0) {
          const vv = G.vista(); while (ix < vv.notas.length && vv.notas[ix][0] / 1000 - gt < 0.4) bot.push(vv.notas[ix++][0] / 1000 + ((ix * 37) % 11 - 5) * 0.006);
          for (let q = bot.length - 1; q >= 0; q--) if (bot[q] <= gt) { bot.splice(q, 1); P.in.tap('a'); taps++; }
          if (vv.oscuro && !done.o && gt > vv.oscuro[0] / 1000 + 0.8) { done.o = 1; shot('3-apagon'); }
        }
        step();
        for (const k of ['1-ya', '2-medio', '4-fin']) if (!done[k] && gt >= sh[k]) { done[k] = 1; shot(k); }
        if (P.fin) break;
      }
      const vv = g() && g().vista();
      return { shots, taps, pts: vv && vv.pts, N: vv && vv.N, fin: P.fin, owner: vv && vv.owner };
    }, { lv, st });
    for (const [k, d] of Object.entries(r.shots)) { fs.writeFileSync(path.join(out, `fiesta-domino-${st}-lv${lv}-${k}.png`), Buffer.from(d.split(',')[1], 'base64')); n++; }
    console.log(`lv${lv} ${st}: taps ${r.taps} pts ${JSON.stringify(r.pts)} notas ${r.N} fin ${r.fin} tranques ${JSON.stringify(r.owner)} fotos ${Object.keys(r.shots).join(',')}`);
  }
  // 4 pistas (estado fijo, sin red): mismo mk con un contexto de mentira
  for (const st of estilos) {
    const d = await p.evaluate(({ st }) => {
      __lab.setStyle(st);
      const def = FIESTA.LIVE.get('f_domino'), n = 4, now = { t: 9.2 };
      const seats = ['mama', 'abuela', 'pana', 'tio'].map((ch, i) => ({ id: 'abcd'[i], name: ['TÚ', 'ANA', 'LUIS', 'CPU'][i], ch, color: ['#ff7ab0', '#3fb0ff', '#ffd23f', '#4fd06a'][i], cpu: i === 3 }));
      const c = { n, yo: 0, seats, modo: 'ffa', equipos: [0, 1, 2, 3], lv: 2, dur: 30, campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }), ahora: () => now.t, rng: FIESTA.rng.crear(77), rngFor: t => FIESTA.rng.crear(5),
        fx: () => 0.5, tap: () => 0, held: () => false, eje: () => ({ x: 0, y: 0 }), cpu: [false, false, false, true], skill: [.5, .5, .5, .5], mio: p => p === 0 || p === 3, claim() {}, remoto: () => null, util: FIESTA.LIVE.util };
      const g = def.mk(c); g.alRemoto(1, { pts: 120, combo: 3, cal: 4, nn: 9 }); g.alRemoto(2, { pts: 80, combo: 0, cal: 1, nn: 6 });
      for (let t = 0; t < 9.2; t += 1 / 30) { now.t = t; g.update(1 / 30); }
      now.t = 9.2; g.draw(); return document.getElementById('c').toDataURL('image/png');
    }, { st });
    fs.writeFileSync(path.join(out, `fiesta-domino-${st}-n4.png`), Buffer.from(d.split(',')[1], 'base64')); n++;
  }
  console.log(n + ' capturas en ' + out + (err.length ? '\nERRORES:\n' + err.join('\n') : '\nsin errores de consola'));
  await b.close(); process.exit(err.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
