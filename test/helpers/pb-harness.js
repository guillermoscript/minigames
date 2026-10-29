// Temporary PocketBase for end-to-end tests: the repo's hooks + migrations, the LA FIESTA reducer copies (scripts/sync-fiesta-rules.sh)
// and the Venezuela world served like production (scripts/sync-world-assets.sh → pb_public/worlds/venezuela/), on a free port,
// in a fresh temp dir. Only the process it starts is ever killed, and only its own temp dir is removed.
//
//   const {start} = require('./helpers/pb-harness.js');
//   const pb = await start({ patches: [[/var PLAZO=\{[^}]*\}/, 'var PLAZO={...}']] });   // optional: edits to the copied fiesta-reglas.js
//   pb.url  → 'http://127.0.0.1:<port>'   pb.page('fiesta.html') → url of /worlds/venezuela/fiesta.html   await pb.stop()
//
// Binary: $PB_BIN, ./pocketbase/pocketbase, or the session scratchpad copy. `patches` are applied to BOTH copies of fiesta-reglas.js
// (server hooks and the static world), so the browser and the server keep running the same reducer.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const SCRATCH_BIN = '/private/tmp/claude-501/-Users-guillermomarin-Documents-GitHub-minigames/716f7425-b84b-4fca-834e-f1d9026ba775/scratchpad/pbbin/pocketbase';

function findBin() {
  const c = [process.env.PB_BIN, path.join(ROOT, 'pocketbase', 'pocketbase'), SCRATCH_BIN].filter(Boolean);
  for (const p of c) { try { fs.accessSync(p, fs.constants.X_OK); return p; } catch (_) {} }
  throw new Error('pb-harness: PocketBase binary not found (set PB_BIN, or put it at pocketbase/pocketbase)');
}
function freePort() {
  return new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(a, b); else if (e.isFile()) fs.copyFileSync(a, b);
  }
}
function patchFile(file, patches) {
  if (!patches || !patches.length) return;
  let s = fs.readFileSync(file, 'utf8');
  for (const [re, to] of patches) { const n = s.replace(re, to); if (n === s) throw new Error('pb-harness: patch did not match in ' + file + ': ' + re); s = n; }
  fs.writeFileSync(file, s);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function start(o) {
  o = o || {};
  const bin = findBin(), port = o.port || await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiesta-pb-'));
  const hooks = path.join(dir, 'pb_hooks'), mig = path.join(dir, 'pb_migrations'), pub = path.join(dir, 'pb_public'), data = path.join(dir, 'pb_data');
  copyDir(path.join(ROOT, 'pocketbase', 'pb_hooks'), hooks);
  copyDir(path.join(ROOT, 'pocketbase', 'pb_migrations'), mig);
  execFileSync('sh', [path.join(ROOT, 'scripts', 'sync-fiesta-rules.sh'), ROOT, hooks]);
  fs.mkdirSync(pub, { recursive: true });
  execFileSync('sh', [path.join(ROOT, 'scripts', 'sync-world-assets.sh'), ROOT, pub]);
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) { try { fs.copyFileSync(path.join(ROOT, f), path.join(pub, f)); } catch (_) {} }
  patchFile(path.join(hooks, 'fiesta-reglas.js'), o.patches);
  patchFile(path.join(pub, 'worlds', 'venezuela', 'fiesta-reglas.js'), o.patches);
  for (const [file, patches] of Object.entries(o.patchFiles || {})) patchFile(path.join(dir, file), patches);   // e.g. {'pb_hooks/party.js': [[re, to]]}

  const log = [];
  const child = spawn(bin, ['serve', '--http=127.0.0.1:' + port, '--dir=' + data, '--publicDir=' + pub, '--hooksDir=' + hooks,
    '--migrationsDir=' + mig, '--indexFallback=false'], { stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, o.env || {}) });
  const keep = (b) => { log.push(String(b)); if (log.length > 400) log.shift(); if (o.verbose) process.stderr.write('[pb] ' + b); };
  child.stdout.on('data', keep); child.stderr.on('data', keep);
  let exited = null; child.on('exit', (c, s) => { exited = { code: c, signal: s }; });

  const url = 'http://127.0.0.1:' + port;
  const t0 = Date.now();
  for (;;) {
    if (exited) throw new Error('pb-harness: PocketBase exited early ' + JSON.stringify(exited) + '\n' + log.join(''));
    try { const r = await fetch(url + '/api/health'); if (r.ok) break; } catch (_) {}
    if (Date.now() - t0 > 20000) { child.kill('SIGKILL'); throw new Error('pb-harness: PocketBase did not start\n' + log.join('')); }
    await sleep(100);
  }
  let stopped = false;
  async function stop() {
    if (stopped) return; stopped = true;
    if (!exited) {
      child.kill('SIGTERM');
      for (let i = 0; i < 50 && !exited; i++) await sleep(100);
      if (!exited) child.kill('SIGKILL');
    }
    if (dir.startsWith(os.tmpdir()) && path.basename(dir).startsWith('fiesta-pb-')) fs.rmSync(dir, { recursive: true, force: true });   // only our own temp dir
  }
  return { url, port, dir, log, stop, page: (p) => url + '/worlds/venezuela/' + (p || 'fiesta.html') };
}

module.exports = { start, findBin, ROOT };
