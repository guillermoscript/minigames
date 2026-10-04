#!/usr/bin/env node
/* SOLO microgame screenshot harness (art work: docs/ART-STYLE.md, skill .claude/skills/restyle-stage).
   node scripts/art/shoot.js <outdir> <file.js,...> <id> <times...> [--sp=1] [--seed=77] [--inputs=<file.js | inline fn>]
        [--stamp] [--hint] [--vig] [--fuse] [--sheet] [--tag=name] [--rev=HEAD]
   - --fuse draws main.js's bottom fuse band/bomb/countdown and --hint the top hint line: use both to check the HUD zones
   - --rev=<git rev> renders the game files as they are in that revision (the 'before' of a restyle)
   - files are repo-relative (js/games/wave1.js) or absolute; js/i18n.js + js/core.js are always loaded first
   - id: a REGMAP id ('swat') or a boss 'boss:bug' (then include js/games/bosses.js and js/stages.js)
   - inputs: a function source  (g, T, dt, api) => { ... }  called every 1/60 s step before update;
     api.down(x,y) / move / up / key(code) / keyup(code) / once(tag). Each time is a fresh deterministic run (same seed).
   - writes <outdir>/<tag|id>_<t>.png, and with --sheet a 2-column contact sheet <tag|id>_sheet.png */
const fs = require('fs'), path = require('path'), os = require('os');
const pwDir = (() => { const base = path.join(os.homedir(), '.npm/_npx'); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'node_modules/playwright'); if (fs.existsSync(p)) return p; } throw new Error('playwright not found under ~/.npm/_npx'); })();
const exe = (() => { const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');                // Playwright's own browser, never the owner's Chrome
  for (const v of fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse()) for (const d of fs.readdirSync(path.join(cache, v))) { const p = path.join(cache, v, d, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  throw new Error('chrome-headless-shell not found under ' + cache); })();
const { chromium } = require(pwDir);

const args = process.argv.slice(2), flags = {}, pos = [];
for (const a of args) { const m = /^--([a-z]+)(?:=(.*))?$/s.exec(a); if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; else pos.push(a); }
if (pos.length < 4) { console.error('usage: node scripts/art/shoot.js <outdir> <file.js,...> <id> <times...> [--sp=1] [--seed=77] [--inputs=..] [--stamp] [--hint] [--vig] [--sheet] [--tag=name]'); process.exit(1); }
const [outdir, files, id, ...times] = pos;
const sp = +(flags.sp || 1), seed = flags.seed == null ? 77 : +flags.seed, tag = (flags.tag || id).replace(/[^a-z0-9_-]/gi, '_');
let inputs = '';
if (flags.inputs) inputs = fs.existsSync(flags.inputs) ? fs.readFileSync(flags.inputs, 'utf8') : flags.inputs;
fs.mkdirSync(outdir, { recursive: true });

(async () => {
  const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.goto('file://' + path.join(__dirname, 'harness.html'));
  let list = files.split(',').filter(Boolean);
  if (flags.rev) {                                                         // --rev: load the files from git (core.js and i18n.js stay as they are now)
    const repo = path.join(__dirname, '../..'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'art-rev-'));
    list = list.map(f => { const rel = path.isAbsolute(f) ? path.relative(repo, f) : f, out = path.join(tmp, rel.replace(/\//g, '_'));
      fs.writeFileSync(out, require('child_process').execFileSync('git', ['show', flags.rev + ':' + rel], { cwd: repo })); return out; });
  }
  await p.evaluate(list => loadScripts(list), list);
  const shots = [];
  for (const tm of times) {
    const info = await p.evaluate(([id, sp, at, inputs, o]) => shot(id, sp, at, inputs, o), [id, sp, +tm, inputs, { seed, stamp: !!flags.stamp, hint: !!flags.hint, vig: !!flags.vig, fuse: !!flags.fuse }]);
    const file = path.join(outdir, `${tag}_${tm}.png`);
    await p.locator('#c').screenshot({ path: file });
    shots.push(file); console.log(file, JSON.stringify(info));
  }
  if (flags.sheet && shots.length) {
    const imgs = shots.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
    const sheet = await b.newPage({ viewport: { width: 800, height: 300 * Math.ceil(imgs.length / 2) } });
    await sheet.setContent(`<body style="margin:0;display:grid;grid-template-columns:400px 400px;background:#000">${imgs.map(s => `<img src="${s}" width="400" height="300">`).join('')}</body>`);
    const f = path.join(outdir, `${tag}_sheet.png`); await sheet.screenshot({ path: f, fullPage: true }); console.log(f);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
