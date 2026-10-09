#!/usr/bin/env node
/* Vertical 1080x1920 short-form clips (TikTok / Reels / Shorts) from real, bot-played gameplay. See scripts/marketing/README.md.

   node scripts/marketing/clip.js --games ap_switch,ap_arepa,ap_mosquito,ap_battery,ap_grita --fail-last --hook "¿Puedes con estos 5?" --out marketing-out
   node scripts/marketing/clip.js --intros 1,2,3,4,5 --each 1.6 --hook "Conoce a la pandilla" --out marketing-out

   Sequence:  --games a,b,c   microgame ids, played back to back in the real game (index.html) in Spanish
              --fail-last     the last one is lost on purpose   --fail a,b   lose these ids   (everything else is won)
              --intro         start with the host stage's intro card     --host N   stage whose HUD/intro is used (default: the
                              stage whose pool holds all the ids, else 1)    --speed X   override that stage's starting speed
              --inter S (0.7) seconds of the GET READY / NICE! screen between games   --pre S (1.0) instruction-card seconds
              --tail S (0.8)  freeze on the last NICE!/FAIL! stamp for S seconds
   Montage:   --intros 1,2,3  stage intro cards with their hosts, --each S (1.6) seconds of each
   Frame:     --hook "text"   top band (Fredoka, wraps to 3 lines)   --cta-top "JUEGA GRATIS EN"   --cta "minicaos.guille.tech"
   Output:    --out DIR (marketing-out)  --name file (no extension)  --fps 30|60  --seed N  --lang es|en
              --silent (no audio track content) / --no-music (sfx only)   --stills (4 review JPEGs next to the mp4)   --hd 2 (render scale)
   Needs: Playwright under ~/.npm/_npx + its chrome-headless-shell (same discovery as scripts/art/shoot.js) and ffmpeg on PATH. */
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), { spawn, execFileSync } = require('child_process');
const pwDir = (() => { const base = path.join(os.homedir(), '.npm/_npx'); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'node_modules/playwright'); if (fs.existsSync(p)) return p; } throw new Error('playwright not found under ~/.npm/_npx'); })();
const exe = (() => { const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');                // Playwright's own browser, never the owner's Chrome
  for (const v of fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse()) for (const d of fs.readdirSync(path.join(cache, v))) { const p = path.join(cache, v, d, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  throw new Error('chrome-headless-shell not found under ' + cache); })();
const { chromium } = require(pwDir);
const ROOT = path.join(__dirname, '../..');

/* ── args ── */
const flags = {};
for (let i = 2; i < process.argv.length; i++) {
  const m = /^--([a-z-]+)(?:=(.*))?$/s.exec(process.argv[i]); if (!m) { console.error('unexpected argument: ' + process.argv[i]); process.exit(1); }
  if (m[2] !== undefined) flags[m[1]] = m[2];
  else if (process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--')) flags[m[1]] = process.argv[++i];
  else flags[m[1]] = true;
}
if (!flags.games && !flags.intros) { console.error('usage: clip.js --games id,id,... [--fail-last] | --intros 1,2,3  [--hook "..."] [--out dir]  (see the header of this file)'); process.exit(1); }
const num = (k, d) => flags[k] == null ? d : +flags[k];
const fps = num('fps', 30), seed = num('seed', 7), hd = num('hd', 2), lang = flags.lang || 'es';
const outDir = path.resolve(flags.out || path.join(ROOT, 'marketing-out'));
const sound = !flags.silent, music = sound && !flags['no-music'];
const hook = flags.hook === true ? '' : (flags.hook || '');
const ctaTop = flags['cta-top'] || (lang === 'es' ? 'JUEGA GRATIS EN' : 'PLAY FREE AT'), cta = flags.cta || 'minicaos.guille.tech';

/* Stage names that must never be on screen (Nintendo-derived titles, may be renamed). Intros and HUD hosts refuse these stages. */
const BANNED = ['WII WAGGLE', 'CUBE PARTY', 'MEGA MICROGAME$', 'TWISTED!', 'MOVE IT!', 'GET TOGETHER'];
const STAGES = (() => { const src = fs.readFileSync(path.join(ROOT, 'js/stages.js'), 'utf8'); return new Function(src + '\nreturn STAGES;')(); })();
const stageOk = i => STAGES[i] && !BANNED.includes(STAGES[i].name);

let plan, estSecs;
if (flags.games) {
  const ids = flags.games.split(',').map(s => s.trim()).filter(Boolean);
  const fail = new Set(flags.fail && flags.fail !== true ? flags.fail.split(',') : []);
  const items = ids.map((id, i) => ({ id, want: fail.has(id) || (flags['fail-last'] && i === ids.length - 1) ? 'lose' : 'win' }));
  let host = flags.host != null ? +flags.host - 1 : STAGES.findIndex((s, i) => stageOk(i) && s.pool && ids.every(id => s.pool.includes(id)));
  if (host < 0) host = 0;
  if (!stageOk(host)) { console.error(`stage ${host + 1} (${STAGES[host] && STAGES[host].name}) is off limits for clips`); process.exit(1); }
  plan = { kind: 'seq', items, host, intro: !!flags.intro, sp0: flags.speed != null ? +flags.speed : null, inter: num('inter', .7), pre: num('pre', 1), tail: num('tail', .8) };
  estSecs = (plan.intro ? 5 : 0) + items.length * (plan.inter + plan.pre + 6.5 + 1) + plan.tail + 3;
} else {
  const stages = String(flags.intros).split(',').map(Number);
  for (const n of stages) if (!stageOk(n - 1)) { console.error(`stage ${n} (${STAGES[n - 1] && STAGES[n - 1].name}) is off limits for clips`); process.exit(1); }
  plan = { kind: 'intros', stages, each: num('each', 1.6) };
  estSecs = stages.length * plan.each + 3;
}
const name = flags.name || (plan.kind === 'seq' ? 'seq_' + plan.items.map(i => i.id + (i.want === 'lose' ? '-L' : '')).join('_') : 'intros_' + plan.stages.join('-')).slice(0, 120);

/* ── 9:16 layout (1080x1920). TikTok covers ~the top 150 px (tabs), a right rail (~x > 960, mid-low) and the bottom ~15% (caption). ── */
const OUT = { w: 1080, h: 1920 };
const GAME = { x: 36, y: 640, w: 960, h: 720 };          // 4:3 gameplay, nudged left of center so the right rail covers as little as possible
const HOOK = { x: 516, y: 175, w: 900, h: 430 };         // hook text box (center x, top y)
const CTA = { y: 1395 };                                 // CTA band; everything under y = 1632 is decoration only

/* ── tiny static server for the repo (the game fetches its own files) ── */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
function serve() {
  return new Promise(ok => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname), f = path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
    }).listen(0, '127.0.0.1', () => ok(srv));
  });
}

/* ── the backdrop: bands, hook, CTA and the cast, drawn with the game's own Fredoka, caos() and CAST (like scripts/art/og.js) ── */
const core = fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8');
const caosSrc = core.slice(core.indexOf('function caos('), core.indexOf('/* ───────────── particles'));
const castSrc = fs.readFileSync(path.join(ROOT, 'js/art/cast.js'), 'utf8');
function paintBackdrop(L) {                              // runs in the page
  const c = document.getElementById('c'), g = c.getContext('2d'), { OUT, GAME, HOOK, CTA } = L;
  const sky = g.createLinearGradient(0, 0, 0, OUT.h); sky.addColorStop(0, '#8a5cff'); sky.addColorStop(.55, '#6a3ae6'); sky.addColorStop(1, '#3d1fa8');
  g.fillStyle = sky; g.fillRect(0, 0, OUT.w, OUT.h);
  g.save(); g.translate(OUT.w / 2, 400); g.fillStyle = 'rgba(255,255,255,.06)';
  for (let i = 0; i < 18; i++) { g.rotate(Math.PI / 9); g.beginPath(); g.moveTo(0, 0); g.lineTo(2400, -170); g.lineTo(2400, 170); g.fill(); }
  g.restore();
  g.fillStyle = 'rgba(20,16,28,.10)'; for (let y = 14; y < OUT.h; y += 34) for (let x = (y / 34 & 1) * 17; x < OUT.w; x += 34) { g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }
  const stroked = (s, x, y, size, fill, lw, align) => {
    g.font = `700 ${size}px Fredoka`; g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = lw; g.strokeStyle = '#14101c'; g.fillStyle = '#14101c'; g.strokeText(s, x + size * .05, y + size * .07); g.fillText(s, x + size * .05, y + size * .07);
    g.strokeText(s, x, y); g.fillStyle = fill; g.fillText(s, x, y);
  };
  /* hook: biggest size that fits in 3 lines */
  if (L.hook) {
    let size = 128, lines;
    const wrap = sz => { g.font = `700 ${sz}px Fredoka`; const out = []; for (const para of L.hook.split('\\n')) { let line = ''; for (const w of para.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > HOOK.w && line) { out.push(line); line = w; } else line = t; } out.push(line); } return out; };
    for (; size > 54; size -= 4) { lines = wrap(size); if (lines.length <= 3 && lines.every(l => g.measureText(l).width <= HOOK.w) && lines.length * size * 1.12 <= HOOK.h) break; }
    const lh = size * 1.12, y0 = HOOK.y + (HOOK.h - lines.length * lh) / 2 + lh / 2;
    lines.forEach((l, i) => stroked(l, HOOK.x, y0 + i * lh, size, i === lines.length - 1 && lines.length > 1 ? '#FFE14D' : '#fff', size * .22));
  }
  /* game frame: ink border + offset shadow (the video goes inside) */
  g.fillStyle = 'rgba(20,16,28,.55)'; g.fillRect(GAME.x + 14, GAME.y + 18, GAME.w, GAME.h);
  g.fillStyle = '#14101c'; g.fillRect(GAME.x - 10, GAME.y - 10, GAME.w + 20, GAME.h + 20);
  /* CTA pill */
  stroked(L.ctaTop, HOOK.x, CTA.y + 28, 50, '#fff', 12);
  g.font = '700 74px Fredoka'; const tw = g.measureText(L.cta).width, pw = Math.min(980, tw + 90), px = HOOK.x - pw / 2, py = CTA.y + 70, ph = 120;
  const pill = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.fillStyle = '#14101c'; pill(px + 8, py + 10, pw, ph, 60); g.fill();
  pill(px, py, pw, ph, 60); g.fillStyle = '#FFE14D'; g.fill(); g.lineWidth = 8; g.strokeStyle = '#14101c'; g.stroke();
  g.fillStyle = '#14101c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${Math.min(74, 74 * (pw - 90) / tw)}px Fredoka`; g.fillText(L.cta, HOOK.x, py + ph / 2 + 4);
  /* the cast along the bottom (decoration: the caption may cover it) */
  window.ctx = g; window.now = .35;
  const shadow = (x, y, w) => { g.fillStyle = 'rgba(20,16,28,.3)'; g.beginPath(); g.ellipse(x, y, w, w * .16, 0, 0, 7); g.fill(); };
  const gy = 1860;
  for (const [id, x, u] of [['sapito', 120, 6.5], ['pulpi', 290, 6.5], ['zumbi', 790, 6], ['chigui', 960, 6]]) { shadow(x, gy, u * 8); CAST[id](x, gy - 2, u, { mood: 'happy' }); }
  shadow(540, gy + 4, 100); caos(540, gy, 12, { mood: 'happy' });
  return c.toDataURL('image/png');
}

/* ── ffmpeg ── */
function ff(args, opts) { return spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], Object.assign({ stdio: ['pipe', 'inherit', 'inherit'] }, opts)); }
const wait = p => new Promise((ok, bad) => p.on('close', c => c === 0 ? ok() : bad(new Error('ffmpeg exited ' + c))));

(async () => {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch (e) { console.error('ffmpeg not found on PATH (macOS: brew install ffmpeg)'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'minicaos-clip-'));
  const srv = await serve(), port = srv.address().port;
  const b = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    /* 1. backdrop PNG */
    const bp = await b.newPage({ viewport: { width: OUT.w, height: OUT.h } });
    await bp.setContent(`<html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@700&display=block"></head>
      <body style="margin:0"><canvas id="c" width="${OUT.w}" height="${OUT.h}"></canvas>
      <script>const INK = '#14101c', OR = '#FF6B3D'; var ctx, now = 0;\n${caosSrc}\n${castSrc}\nwindow.CAST = CAST; window.caos = caos;</script></body></html>`);
    await bp.evaluate(() => document.fonts.load('700 40px Fredoka'));
    const fontOk = await bp.evaluate(() => document.fonts.check('700 40px Fredoka'));
    if (!fontOk) console.warn('warning: Fredoka did not load (offline?), the bands fall back to a system font');
    const bgUrl = await bp.evaluate(`(${paintBackdrop.toString()})(${JSON.stringify({ OUT, GAME, HOOK, CTA, hook, ctaTop, cta })})`);
    const bgFile = path.join(tmp, 'bg.png'); fs.writeFileSync(bgFile, Buffer.from(bgUrl.split(',')[1], 'base64'));
    await bp.close();

    /* 2. the game, stepped frame by frame */
    const ctxB = await b.newContext({ viewport: { width: 800, height: 600 }, locale: lang === 'es' ? 'es-VE' : 'en-US', serviceWorkers: 'block' });
    await ctxB.route('**/*', r => {                      // only the local game and Google Fonts; analytics, pixel and API calls never leave the machine
      const h = new URL(r.request().url()).hostname;
      return h === '127.0.0.1' || h === 'fonts.googleapis.com' || h === 'fonts.gstatic.com' ? r.continue() : r.abort();
    });
    await ctxB.addInitScript(([seed, secs]) => {
      window.requestAnimationFrame = () => 0;           // the driver calls loop() itself
      let a = seed >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      window.__vt = 0;                                  // virtual audio clock = frame / fps
      class VAC extends OfflineAudioContext {
        constructor() { super(2, Math.ceil(secs * 44100), 44100); }
        get currentTime() { return window.__vt; }
        get state() { return 'running'; }
        resume() { return Promise.resolve(); }
        suspend() { return Promise.resolve(); }
      }
      window.AudioContext = VAC; window.webkitAudioContext = VAC;
    }, [seed, estSecs]);
    const p = await ctxB.newPage();
    p.on('pageerror', e => console.log('PAGEERR', e.message));
    await ctxB.addInitScript(l => { try { localStorage.setItem('claudeware-lang', l); } catch (e) {} }, lang);
    await p.goto(`http://127.0.0.1:${port}/index.html?lang=${lang}&unlock`);
    await p.waitForFunction(() => typeof loop === 'function' && typeof STAGES !== 'undefined');
    await p.evaluate(async () => { try { await document.fonts.load('700 20px Fredoka'); await document.fonts.ready; } catch (e) {} });
    await p.addScriptTag({ path: path.join(__dirname, 'page-driver.js') });
    const info = await p.evaluate(o => __drv.setup(o), { fps, hd, sound, music, plan });
    if (info.warn.length) console.warn('no bot for: ' + info.warn.join(', ') + ' (played with no input; win/lose is not controlled)');

    const video = path.join(tmp, 'video.mp4');
    const enc = ff(['-loop', '1', '-framerate', String(fps), '-i', bgFile, '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-filter_complex', `[1:v]scale=${GAME.w}:${GAME.h}:flags=lanczos[g];[0:v][g]overlay=${GAME.x}:${GAME.y}:shortest=1,format=yuv420p[v]`,
      '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', String(fps), '-movflags', '+faststart', video]);
    const encDone = wait(enc);
    let frames = 0, res = { done: false }, last = null;
    const put = async buf => { if (!enc.stdin.write(buf)) await new Promise(ok => enc.stdin.once('drain', ok)); frames++; };
    while (!res.done) {
      res = await p.evaluate(n => __drv.run(n, .93), 12);
      for (const f of res.frames) { last = Buffer.from(f.slice(f.indexOf(',') + 1), 'base64'); await put(last); }
      if (frames / fps > estSecs - 1) { console.warn('stopping at the length cap'); break; }
      if (frames % (fps * 5) < 12) process.stdout.write(`\r${(frames / fps).toFixed(1)} s`);
    }
    if (plan.kind === 'seq' && last) for (let i = Math.round(plan.tail * fps); i > 0; i--) await put(last);   // freeze on the final NICE!/FAIL! stamp
    enc.stdin.end(); await encDone;
    const secs = frames / fps; console.log(`\rcaptured ${frames} frames (${secs.toFixed(2)} s)`);
    for (const r of res.results || []) console.log(`  ${r.id.padEnd(12)} want ${r.want.padEnd(4)} got ${r.got}${r.want !== r.got ? '   <-- MISMATCH' : ''}  (t=${r.at}s)`);

    /* 3. audio: render the offline graph and mux it in (silent track when --silent, so every platform gets an audio stream) */
    const out = path.join(outDir, name + '.mp4');
    let wav = null;
    if (sound) { const b64 = await p.evaluate(s => __drv.audioWav(s), secs); if (b64) { wav = path.join(tmp, 'audio.wav'); fs.writeFileSync(wav, Buffer.from(b64, 'base64')); } }
    const aIn = wav ? ['-i', wav] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo'];
    await wait(ff(['-i', video, ...aIn, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-af', 'apad', '-t', secs.toFixed(3), '-movflags', '+faststart', out], { stdio: ['ignore', 'inherit', 'inherit'] }));
    console.log('wrote ' + out);

    if (flags.stills) for (const k of [.12, .38, .62, .9]) {
      const f = path.join(outDir, `${name}_still${Math.round(k * 100)}.jpg`);
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', (secs * k).toFixed(2), '-i', out, '-frames:v', '1', '-q:v', '3', f]); console.log('wrote ' + f);
    }
  } finally { await b.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exit(1); });
