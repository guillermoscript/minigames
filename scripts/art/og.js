#!/usr/bin/env node
/* Renders the 1200x630 link-preview card (img/og.png): the MINICAOS! logo over Caos and the cast.
   node scripts/art/og.js
   Draws with the game's own caos() (js/core.js) and CAST (js/art/cast.js), so the card always matches the game. */
const fs = require('fs'), path = require('path'), os = require('os');
const pwDir = (() => { const base = path.join(os.homedir(), '.npm/_npx'); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'node_modules/playwright'); if (fs.existsSync(p)) return p; } throw new Error('playwright not found under ~/.npm/_npx'); })();
const exe = (() => { const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  for (const v of fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse()) for (const d of fs.readdirSync(path.join(cache, v))) { const p = path.join(cache, v, d, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  throw new Error('chrome-headless-shell not found under ' + cache); })();
const { chromium } = require(pwDir);
const root = path.join(__dirname, '../..');

const core = fs.readFileSync(path.join(root, 'js/core.js'), 'utf8');
const caosSrc = core.slice(core.indexOf('function caos('), core.indexOf('/* ───────────── particles'));
const castSrc = fs.readFileSync(path.join(root, 'js/art/cast.js'), 'utf8');

function paint() {                                     // runs in the page, after the fonts load
  const c = document.getElementById('c'), g = c.getContext('2d'), W = 1200, H = 630;
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#8a5cff'); sky.addColorStop(1, '#5a2fd6');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, 250); g.fillStyle = 'rgba(255,255,255,.07)';
  for (let i = 0; i < 18; i++) { g.rotate(Math.PI / 9); g.beginPath(); g.moveTo(0, 0); g.lineTo(1400, -110); g.lineTo(1400, 110); g.fill(); }
  g.restore();
  g.fillStyle = 'rgba(20,16,28,.08)'; for (let y = 14; y < H; y += 30) for (let x = (y / 30 & 1) * 15; x < W; x += 30) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  const word = (s, x, y, size, fill, rot) => {
    g.save(); g.translate(x, y); g.rotate(rot); g.font = `700 ${size}px Fredoka`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = size * .2; g.strokeStyle = '#14101c'; g.fillStyle = '#14101c'; g.strokeText(s, 7, 9); g.fillText(s, 7, 9);
    g.strokeText(s, 0, 0); g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
  };
  g.font = '700 150px Fredoka'; const wm = g.measureText('MINI').width, wc = g.measureText('CAOS!').width, gap = 24, x0 = (W - wm - wc - gap) / 2;
  word('MINI', x0 + wm / 2, 125, 150, '#FFE14D', -.04);
  word('CAOS!', x0 + wm + gap + wc / 2, 140, 150, '#fff', .04);
  /* ground strip + cast */
  g.fillStyle = 'rgba(20,16,28,.25)'; g.fillRect(0, 548, W, 82);
  window.ctx = g; window.now = .35;
  const shadow = (x, y, w) => { g.fillStyle = 'rgba(20,16,28,.28)'; g.beginPath(); g.ellipse(x, y, w, w * .16, 0, 0, 7); g.fill(); };
  const row = [['sapito', 120, 7.5], ['pulpi', 275, 7.5], ['zumbi', 860, 7], ['chigui', 1050, 7]];
  for (const [id, x, u] of row) { shadow(x, 548, u * 8); CAST[id](x, 546, u, { mood: 'happy' }); }
  shadow(600, 552, 120); caos(600, 548, 15, { mood: 'happy' });
  shadow(405, 552, 50); CAST.lechuza(405, 548, 6.5, {});
  g.font = '700 34px Fredoka'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.lineWidth = 8; g.strokeStyle = '#14101c'; g.lineJoin = 'round';
  const tag = '156 MICROGAMES · 5 SECONDS · PLAY FREE';
  g.strokeText(tag, W / 2, 600); g.fillText(tag, W / 2, 600);
  return c.toDataURL('image/png');
}

(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@700&display=block"></head>
    <body style="margin:0"><canvas id="c" width="1200" height="630"></canvas>
    <script>const INK = '#14101c', OR = '#FF6B3D'; var ctx, now = 0;\n${caosSrc}\n${castSrc}\nwindow.CAST = CAST; window.caos = caos;</script></body></html>`);
  await p.evaluate(() => document.fonts.load('700 40px Fredoka'));
  const url = await p.evaluate(`(${paint.toString()})()`);
  fs.writeFileSync(path.join(root, 'img/og.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote img/og.png');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
