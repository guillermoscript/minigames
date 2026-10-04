/* node scripts/art/sheet.js out.png a.png b.png ... -> 2-column contact sheet at half size (put before/after pairs side by side) */
const fs = require('fs'), path = require('path'), os = require('os');
const base = path.join(os.homedir(), '.npm/_npx'); let pw; for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'node_modules/playwright'); if (fs.existsSync(p)) { pw = p; break; } }
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright'), eb = path.join(cache, fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort().pop()); const exe = path.join(eb, fs.readdirSync(eb).find(d => d.startsWith('chrome')), 'chrome-headless-shell');
const [out, ...ims] = process.argv.slice(2);
(async () => { const b = await require(pw).chromium.launch({ executablePath: exe }); const p = await b.newPage({ viewport: { width: 800, height: 300 } });
  await p.setContent(`<body style="margin:0;display:grid;grid-template-columns:400px 400px;background:#000">${ims.map(f => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" width="400" height="300">`).join('')}</body>`);
  await p.screenshot({ path: out, fullPage: true }); await b.close(); })();
