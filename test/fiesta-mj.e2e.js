// LA FIESTA M2 end to end (M2-SPEC §5.9): a real PocketBase (test/helpers/pb-harness.js) + three real browsers.
// A = desktop (keyboard), B = phone landscape (touch), C = desktop that stays idle. They create / join a room, pick characters, get ready,
// start (3 humans + 1 CPU) and play board turns until the first 4-player minigame. Then: format wheel, instruction card (screenshots),
// everybody taps LISTO, 3-2-1, the game (A types SPACE, B taps pad_a, C does nothing), podium, back to the board.
// Asserts: (1) the «¡YA!» wall-clock moments differ < 100 ms across the three screens (and so do the goWall() estimates), (2) the same
// podium on the three screens and equal to the room record on the server (board.mj.res), (3) the idle human does not beat the CPU,
// (4) coins on the board moved by exactly `pagos`, (5) back on the board hash(D)==hash(S) at rest on all three and one more turn played,
// (6) no pageerror and no console error (409s tolerated like fiesta.e2e.js).
// M3 team games (f_futbolito 2v2 model C, f_patilla 1v3 model B): same flow, but the round is forced to the team format by patching the colour
// resolution of formarMJ (every 4-seat round then has the teams below), the keyboard / touch players REALLY play (stick via CDP touch, WASD, SPACE,
// reading g.vista()), the game keeps its real catalog duration (SHORT=1 shrinks it to 12 s), and the checks add: team podium (same place inside a team),
// coins = FIESTA.reglas.pagosMJ for 2v2 / 1v3 (and the literal table 7/2/4, 12/0, 4/0, 5/2), the playing side beats the idle one, screenshots in snes at 932x430.
//   TIMEOUT_X=2 doubles every wait (the box is shared: with a load average > 60 the first minigame takes 4x longer and a judge can miss its deadline: result by «plazo», sc null);
//   VIEWPORT=WxH overrides the 932x430 of the team games; TRACE=1 logs the scripted players. The outcome of a futbolito match is NOT asserted (see verificarEquipo).
//   JUEZ=a|b|c forces the judge seat (pins the judge-side advantage of model C so a run is comparable); unset = the real rule.
//   2v2: BLUE=a,b (default) vs the rest · 1v3: SOLO=a (default; SOLO=d makes the solo a CPU played by the judge).  GAME=f_futbolito | f_patilla
// Lobby/seat steps use the net layer (FIESTA_DEBUG.net) instead of lobby buttons, so UI polish of the lobby cannot break this test.
// The copy of the reducer is patched (server hooks AND served world): short prompts, carta 14 s, every minigame lasts 12 s, and only the
// game under test stays `live:1`.  Run: node test/fiesta-mj.e2e.js   (GAME=f_mecate (default) | f_domino | f_harina | f_futbolito | f_patilla | all; HEADED=1, PB_BIN=...; ~4 min per game)
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { start, ROOT } = require('./helpers/pb-harness.js');
const cache = path.join(os.homedir(), '.npm/_npx');
const { chromium } = require(fs.readdirSync(cache).map((d) => path.join(cache, d, 'node_modules/playwright')).find(fs.existsSync));
const OUT = path.join(ROOT, 'docs/style-lab/pruebas/out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now(), log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(1) + 's]', ...a);
const JUEGOS = ['f_mecate', 'f_domino', 'f_harina', 'f_futbolito', 'f_patilla'];
const DEFS = { f_futbolito: { tipo: '2v2', equipo: true }, f_patilla: { tipo: '1v3', equipo: true } };
const BLUE = (process.env.BLUE || 'a,b').split(','), SOLO = process.env.SOLO || 'a', SHORT = !!process.env.SHORT;
const TX = +process.env.TIMEOUT_X || 1;       // multiplies every hasta() wait: the box is shared and a load average of 100+ slows the first minigame by 4x
const JUEZ = process.env.JUEZ || '';          // optional: force the judge seat (test-only patch of elegirJuez; unset = the real RTT / rotation rule)
const VIEW = process.env.VIEWPORT ? { width: +process.env.VIEWPORT.split('x')[0], height: +process.env.VIEWPORT.split('x')[1] } : { width: 932, height: 430 };      // the only size that is photographed (phone landscape); the style is always snes (?estilo=snes)
const GAMES = process.env.GAME === 'all' ? JUEGOS : process.env.GAME ? process.env.GAME.split(',') : ['f_mecate'];

function chromePath() {
  const shells = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  try {
    const d = fs.readdirSync(shells).filter((x) => x.startsWith('chromium_headless_shell-')).sort().pop();
    if (d) { const f = path.join(shells, d), sub = fs.readdirSync(f).find((x) => x.startsWith('chrome')); const p = path.join(f, sub, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  } catch (_) {}
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return fs.existsSync(mac) ? mac : undefined;
}
const patches = (game) => {
  const def = DEFS[game] || {};
  const p = [
    [/var PLAZO=\{[^}]*\}/, 'var PLAZO={DADO:6000,DADO1:7000,RUTA:5000,TIENDA:5000,ESTRELLA:5000,OBJETIVO:5000,COMMIT:8000}'],
    [/carta:4500\+15000/, 'carta:4500+14000'],
    // every minigame lasts 12 s, except the team game under test (it keeps its catalog duration: gameplay is what is being judged) unless SHORT=1
    [/dur:(\d+)/g, (m, d, off, str) => {
      if (!def.equipo || SHORT) return 'dur:12';
      const h = str.lastIndexOf("{g:'", off), id = h >= 0 && /^\{g:'([^']+)'/.exec(str.slice(h, h + 40));
      return id && id[1] === game && str.indexOf('}', h) > off ? m : 'dur:12';
    }],
    // Only the game under test stays `live:1`: every other live game is switched off, so the round the 3 humans + 1 CPU land on is always the one being driven.
    // Written as one pattern with a callback so a game added to the catalog later is switched off without touching this file.
    [/(g:'(f_[a-z0-9_]+)'[^}]*?),live:1/g, (m, pre, id) => (id === game ? m : pre)]
  ];
  // team games: the colour of each seat is fixed (the real game gets it from the tiles / a coin flip, which is random) so the 4-seat round has the wanted teams
  if (game === 'f_futbolito') p.push([/var c=N\.pj\[s\]\.col;/, "var c=" + JSON.stringify(BLUE) + ".indexOf(s)>=0?'a':'r';"]);
  if (game === 'f_patilla') p.push([/var c=N\.pj\[s\]\.col;/, "var c=s==='" + SOLO + "'?'a':'r';"]);
  return p;
};

const errores = [], r409 = [], r403 = [], r404 = [], win = { t0: 0, t1: 0 };
function vigilar(page, who) {
  page.on('response', (r) => {
    const st = r.status(); if (st < 400 || st === 409) return;
    const u = r.url().replace(/^https?:\/\/[^/]+/, ''), t = Date.now();
    // the baked map art of the board (M4, being produced by someone else) is optional: the board paints its own fallback when the png is missing
    if (st === 404 && /assets\/fiesta\/mapa-venezuela\.png/.test(u)) { r404.push(who); return; }
    r.text().catch(() => '').then((body) => {
      // 403 «Not your turn» / «CPU seat» on a BOARD action = the human answered a prompt the clock had just closed (a loaded box): tolerated, but never inside the minigame window
      if (st === 403 && /Not your turn|played by the CPU/.test(body)) { r403.push({ who, t, u: u.slice(0, 80), body: body.slice(0, 60) }); return; }
      errores.push(who + ' HTTP ' + st + ' ' + r.request().method() + ' ' + u.slice(0, 120) + ' ' + body.slice(0, 80) + ' @' + ((t - T0) / 1000).toFixed(1) + 's');
    });
  });
  page.on('pageerror', (e) => errores.push(who + ' pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/status of 409/.test(t)) { r409.push(who); return; }
    if (/Failed to load resource/.test(t)) return;       // every HTTP failure is classified (with its URL and body) by the response handler above
    errores.push(who + ' console: ' + t);
  });
}
const est = (p) => p.evaluate(() => FIESTA_DEBUG.estado());
const S = (p) => p.evaluate(() => JSON.parse(JSON.stringify(FIESTA_DEBUG.S)));
async function hasta(p, fn, ms, que) {
  const t0 = Date.now(); let e = null;
  while (Date.now() - t0 < (ms || 15000) * TX) { e = await est(p); if (fn(e)) return e; await sleep(100); }
  throw new Error('timeout: ' + (que || fn.toString()) + '\n' + JSON.stringify(e));
}
const boton = (p, id) => p.evaluate((i) => FIESTA_DEBUG.boton(i), id);
async function tocar(p, id, ms) {
  const t0 = Date.now(); let b = null;
  while (Date.now() - t0 < (ms || 8000)) { b = await boton(p, id); if (b && !b.off) break; await sleep(80); }
  if (!b || b.off) throw new Error('button not available: ' + id + ' ' + JSON.stringify(b) + ' in ' + JSON.stringify(await p.evaluate(() => FIESTA_DEBUG.botones())));
  if (p.__touch) await p.touchscreen.tap(b.x, b.y); else await p.mouse.click(b.x, b.y);
  return b;
}
async function foto(p, name) { fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: path.join(OUT, 'fiesta-mj-' + name + '.png') }); log('screenshot', name); }

// answer my current board prompt the way a person would (the buttons the HUD drew)
async function jugar(p, who, st) {
  const e = await est(p);
  if (!e.prompt || e.pantalla !== 'juego' || e.mj && e.mj.sess && /^(ruleta|tarjeta|cuenta|juego|fin|podio)$/.test(e.mj.fase || '')) return null;
  const ids = await p.evaluate(() => FIESTA_DEBUG.botones());
  const has = (id) => ids.indexOf(id) >= 0;
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
  try { await tocar(p, id, 1200); } catch (_) { return null; }
  st.acciones[who] = (st.acciones[who] || 0) + 1;
  await sleep(150);
  return e.prompt;
}

// f_harina: a keyboard player who actually plays: walk to the free bag (WASD), tap SPACE when close, otherwise stand still.
// Reads the shared view of the judge's simulation (g.vista()); a blind key-masher only stumbles in that game.
async function conducirHarina(p, idx, keys) {
  const v = await p.evaluate((i) => { const g = FIESTA_DEBUG.live && FIESTA_DEBUG.live.g; if (!g || !g.vista) return null; const o = g.vista(); return { x: o.x[i], y: o.y[i], has: o.has[i], stun: o.stun[i], bags: o.bags }; }, idx);
  const want = { KeyW: false, KeyS: false, KeyA: false, KeyD: false };
  let tap = false;
  if (v && v.stun <= 0) {
    let obj = null;
    if (v.has < 0) {
      let best = 1e9;
      v.bags.forEach((b) => { if (b.h >= 0 || b.act === 0 || b.act === false) return; const d = Math.hypot(b.x - v.x, b.y - v.y); if (d < best) { best = d; obj = b; } });
      if (obj && best < 36) tap = true;
    }
    if (obj && !tap) { const dx = obj.x - v.x, dy = obj.y - v.y; if (Math.abs(dx) > 6) want[dx > 0 ? 'KeyD' : 'KeyA'] = true; if (Math.abs(dy) > 6) want[dy > 0 ? 'KeyS' : 'KeyW'] = true; }
  }
  for (const k of Object.keys(want)) { if (want[k] && !keys[k]) { await p.keyboard.down(k); keys[k] = true; } else if (!want[k] && keys[k]) { await p.keyboard.up(k); keys[k] = false; } }
  if (tap) await p.keyboard.press('Space');
}


// ───────────────────────── team games: real players ─────────────────────────
const hyp = Math.hypot;
const snap = (p) => p.evaluate(() => { const L = FIESTA_DEBUG.live, g = L && L.g, B = FIESTA_DEBUG.S; return { f: B && B.f, v: g && g.vista ? g.vista() : null }; });
// touch through CDP so a finger can hold the stick while another taps A (page.touchscreen can only tap one finger at a time)
async function dedos(p) {
  const cdp = await p.context().newCDPSession(p), pts = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts.values()].map((q) => ({ x: q.x, y: q.y, id: q.id })) });
  return {
    async down(id, x, y) { pts.set(id, { x, y, id }); await send('touchStart'); },
    async move(id, x, y) { if (!pts.has(id)) return; pts.set(id, { x, y, id }); await send('touchMove'); },
    async up(id) { if (!pts.has(id)) return; pts.delete(id); await send('touchEnd'); },
    has: (id) => pts.has(id), async soltarTodo() { pts.clear(); await send('touchEnd').catch(() => {}); }
  };
}
const SK = { stick: 1, a: 2, b: 3 };
// the virtual stick: first contact inside the stick zone is the origin; push (ux,uy) in [-1,1] (|u|<=1) → offset of 70 client px
async function palo(p, T, ux, uy) {
  const mag = hyp(ux, uy);
  if (mag < 0.15) { if (T.has(SK.stick)) await T.up(SK.stick); return; }
  if (!T.has(SK.stick)) { const b = await boton(p, 'stick'); if (!b) return; p.__sx = b.x; p.__sy = b.y; await T.down(SK.stick, b.x, b.y); }
  await T.move(SK.stick, p.__sx + ux / mag * 70 * Math.min(1, mag), p.__sy + uy / mag * 70 * Math.min(1, mag));
}
async function pulsarA(p, T, ms) {
  const b = await boton(p, 'pad_a'); if (!b) return false;
  await T.down(SK.a, b.x, b.y); await sleep(ms || 45); await T.up(SK.a); return true;
}
async function teclas(p, keys, ux, uy) {
  const want = { KeyW: uy < -0.35, KeyS: uy > 0.35, KeyA: ux < -0.35, KeyD: ux > 0.35 };
  for (const k of Object.keys(want)) { if (want[k] && !keys[k]) { await p.keyboard.down(k); keys[k] = true; } else if (!want[k] && keys[k]) { await p.keyboard.up(k); keys[k] = false; } }
}
// f_futbolito brain for a human who plays like a person: the lower seat attacks, the other guards the own goal (roles 'ata' / 'def').
// Attacker: goes round the ball and runs into it toward the rival goal, tapping A to kick (pass or assisted shot); defender: stands between the ball
// and the own goal while the ball is in his half and kicks it away when it arrives. Both lead the ball a few ticks and sprint when far away.
function planFut(v, me, mate, rol) {
  const out = { ux: 0, uy: 0, tap: false, sprint: false };
  if (!v || v.pause > 0 || v.carT >= 24 || v.stun[me] > 0) return out;
  const sd = v.side[me], dir = sd === 0 ? 1 : -1, own = sd === 0 ? 0 : 640, foe = sd === 0 ? 640 : 0, b = v.ball, px = v.x[me], py = v.y[me];
  const bx = Math.max(9, Math.min(631, b.x + b.vx * 5)), by = Math.max(9, Math.min(251, b.y + b.vy * 5));
  const dme = hyp(bx - px, by - py), dm = mate >= 0 ? hyp(bx - v.x[mate], by - v.y[mate]) : 1e9, mia = (b.x - 320) * dir < 0;
  let tx, ty;
  const rodea = () => {                               // behind the ball (rival goal in front): run into it and kick; otherwise go round it
    let gx = foe - bx, gy = 130 - by; const gd = hyp(gx, gy) || 1; gx /= gd; gy /= gd;
    const rx = px - bx, ry = py - by, along = rx * gx + ry * gy, perp = rx * -gy + ry * gx;
    if (along < -6 && Math.abs(perp) < 60) { tx = bx; ty = by; out.tap = dme < 34; }
    else { const sg = perp >= 0 ? 1 : -1; tx = bx - gx * 53 - gy * sg * 46; ty = by - gy * 53 + gx * sg * 46; }
  };
  if (rol === 'def') {
    const cerca = dme < 120 || (mia && Math.abs(b.x - own) < 230);
    if (cerca) {                                       // guard point: on the segment ball -> own goal, 38 px from the ball; kick when it is on us
      let gx = own - bx, gy = 130 - by; const gd = hyp(gx, gy) || 1; gx /= gd; gy /= gd;
      tx = bx + gx * 38; ty = by + gy * 38; if (dme < 36) out.tap = true;
      if (dme < 36) { tx = bx; ty = by; }
    } else { tx = own + dir * 75; ty = Math.max(95, Math.min(165, b.y)); }
  } else {
    if (mia && dm < dme - 20) { tx = 320 + dir * 40; ty = by; }           // the guard is closer to a ball in our half: wait at midfield
    else rodea();
  }
  const dx = tx - px, dy = ty - py, d = hyp(dx, dy);
  if (d > 6) { out.ux = dx / d; out.uy = dy / d; }
  out.sprint = d > 90;
  return out;
}
// f_patilla: the solo moves its aim over the idle trio member and throws a water balloon (WASD to aim, SPACE); everybody else in the trio dodges and shuffles
function planPatilla(v, me, objetivo, t) {
  const out = { ux: 0, uy: 0, tap: false };
  if (!v) return out;
  if (me === v.soloI) {
    if (v.amago || v.gt < 0 || v.tiros.length >= v.nShots || v.gt < v.nextShot) return out;
    const dx = v.x[objetivo] - v.x[me], dy = v.y[objetivo] - v.y[me];
    if (Math.abs(dx) > 7) out.ux = dx > 0 ? 1 : -1;
    if (Math.abs(dy) > 7) out.uy = dy > 0 ? 1 : -1;
    if (Math.abs(dx) <= 7 && Math.abs(dy) <= 7) out.tap = true;
    return out;
  }
  out.ux = Math.sin(t / 700) > 0 ? 1 : -1; out.tap = Math.floor(t / 900) % 2 === 0;
  return out;
}

// plays the team game with the two humans that are not idle: A keyboard, B touch (stick + A through CDP). Returns what was observed.
async function jugarEquipo(game, { A, B, C, as, b0, keys }) {
  const iA = as.indexOf('a'), iB = as.indexOf('b'), iC = as.indexOf('c'), TB = await dedos(B);
  const fut = game === 'f_futbolito', limite = Date.now() + (fut ? 150000 : 90000), t0 = Date.now();
  const info = { game, goles: [], maxHits: 0, tiros: 0, bMov: 0, bx0: null, lag: [], ticks: 0, fotos: 0, pads: null, lastA: null, lastB: null };
  let sumPrev = 0, fotoMitad = false, tLog = 0, golFoto = false;
  const mate = (v, i) => { if (!v || !v.equipos) return -1; for (let j = 0; j < v.equipos.length; j++) if (j !== i && v.equipos[j] === v.equipos[i]) return j; return -1; };
  try {
    for (;;) {
      if (Date.now() > limite) throw new Error('team minigame did not end: ' + JSON.stringify({ A: info.lastA && { k: info.lastA.k, gt: info.lastA.gt, sc: info.lastA.sc } }));
      const [a, b] = await Promise.all([snap(A), snap(B)]);
      if (a.f === 'res' || b.f === 'res') break;
      const vA = a.v, vB = b.v; info.lastA = vA || info.lastA; info.lastB = vB || info.lastB; info.ticks++;
      if (!vA || !vB) { await sleep(60); continue; }
      const t = Date.now() - t0;
      let pa, pb;
      if (fut) { pa = planFut(vA, iA, mate(vA, iA), iA < iB ? 'ata' : 'def'); pb = planFut(vB, iB, mate(vB, iB), iA < iB ? 'def' : 'ata'); }
      else { pa = planPatilla(vA, iA, iC, t); pb = planPatilla(vB, iB, iC, t + 400); }
      if (process.env.TRACE && fut && t - (info.tt || 0) > 400) { info.tt = t; log('TR', 't=' + t, 'ball', Math.round(vA.ball.x), Math.round(vA.ball.y), Math.round(vA.ball.vx * 10) / 10, Math.round(vA.ball.vy * 10) / 10, '| A', Math.round(vA.x[iA]), Math.round(vA.y[iA]), 'plan', pa.ux.toFixed(1), pa.uy.toFixed(1), pa.tap ? 'TAP' : '', '| B', Math.round(vB.x[iB]), Math.round(vB.y[iB]), 'pb', pb.ux.toFixed(1), pb.uy.toFixed(1), pb.tap ? 'TAP' : '', '| mates', mate(vA, iA), 'pause', vA.pause, 'k', vA.k); }
      // A: keyboard
      await teclas(A, keys, pa.ux, pa.uy);
      if (!!pa.sprint !== !!keys.Shift) { if (pa.sprint) await A.keyboard.down('ShiftLeft'); else await A.keyboard.up('ShiftLeft'); keys.Shift = !!pa.sprint; }
      if (pa.tap) await A.keyboard.press('Space');
      // B: touch stick + A
      await palo(B, TB, pb.ux, pb.uy);
      if (!!pb.sprint !== TB.has(SK.b)) { if (pb.sprint) { const bb2 = await boton(B, 'pad_b'); if (bb2) await TB.down(SK.b, bb2.x, bb2.y); } else await TB.up(SK.b); }
      if (pb.tap) await pulsarA(B, TB, 40);
      // observation
      if (fut) {
        const sum = vA.sc[0] + vA.sc[1];
        if (sum !== sumPrev) { info.goles.push({ t, sc: vA.sc.slice(), k: vA.k }); sumPrev = sum; golFoto = false; }
        if (!golFoto && sum > 0 && info.goles.length === 1 && Date.now() - t0 > 1000) { golFoto = true; await sleep(250); await Promise.all([foto(A, game + '-gol-A'), foto(B, game + '-gol-B')]); }
        const lt = vA.lt[vA.side[iA]]; if (lt === iA + 1 || lt === iB + 1) info.touch = true;
        if (lt === iA + 1) info.touchA = true; if (lt === iB + 1) info.touchB = true;
      } else {
        info.maxHits = Math.max(info.maxHits, vA.hits || 0, vB.hits || 0); info.tiros = Math.max(info.tiros, vA.tiros.length, vB.tiros.length);
      }
      if (info.bx0 === null) info.bx0 = [vB.x[iB], vB.y[iB]];
      info.bMov = Math.max(info.bMov, hyp(vB.x[iB] - info.bx0[0], vB.y[iB] - info.bx0[1]));
      if (info.ax0 === undefined) info.ax0 = [vA.x[iA], vA.y[iA]]; info.aMov = Math.max(info.aMov || 0, hyp(vA.x[iA] - info.ax0[0], vA.y[iA] - info.ax0[1]));
      if (!fotoMitad && t > (fut ? 9000 : 6500)) {
        fotoMitad = true;
        info.pads = await B.evaluate(() => { const o = {}; ['stick', 'pad_a', 'pad_b'].forEach((id) => { const r = FIESTA_DEBUG.carta.B.porId(id); if (r) o[id] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }; }); return o; });
        await Promise.all([foto(A, game + '-juego-A'), foto(B, game + '-juego-B')]);
      }
      if (t - tLog > 5000) { tLog = t; log(game, 'play t=' + (t / 1000).toFixed(0) + 's', fut ? 'goals ' + vA.sc.join('-') + ' k=' + vA.k + ' gold=' + vA.gold : 'hits ' + vA.hits + ' shots ' + vA.tiros.length, 'B moved', Math.round(info.bMov)); }
      await sleep(fut ? 25 : 40);
    }
  } finally { await TB.soltarTodo(); }
  return info;
}

// team checks (assertions on the podium, coins and who should win); `eq` = what jugarEquipo observed
async function verificarEquipo(game, { A, as, b0, bRes, pods, eq }) {
  const mj = bRes.mj, tipo = mj.tipo, pu = pods[0].puestos, pg = pods[0].pagos, sc = pods[0].sc, n = as.length;
  const tid = as.map((s) => mj.eq.findIndex((t) => t.indexOf(s) >= 0));
  tid.forEach((t, i) => tid.forEach((u, j) => { if (t === u) assert.equal(pu[i], pu[j], 'teammates ' + as[i] + '/' + as[j] + ' share the place: ' + JSON.stringify(pods[0])); }));
  const soloI = mj.solo ? as.indexOf(mj.solo) : -1, mult = (bRes.r % 5 === 0 && bRes.r !== bRes.tot) ? 2 : 1;
  const exp = await A.evaluate(([mjx, sc2, ronda, tot]) => {
    const R = FIESTA_DEBUG.reglas, e = R.eqIdx(mjx), p = R.compara(mjx.tipo, e, sc2).puestos, so = mjx.solo ? mjx.as.indexOf(mjx.solo) : -1;
    return { pu: p, pg: R.pagosMJ(mjx.tipo, p, ronda, { tot: tot, eq: e, solo: so, relampago: 0 }) };
  }, [mj, sc, bRes.r, bRes.tot]);
  assert.deepEqual(pu, exp.pu, 'places = compara(' + tipo + ') of the scores');
  assert.deepEqual(pg, exp.pg, 'pagos = FIESTA.reglas.pagosMJ');
  // the literal table of doc 08 §8.2 (independent of the code under test)
  if (tipo === '2v2') {
    const tie = new Set(pu).size === 1;
    pg.forEach((v, i) => assert.equal(v, mult * (tie ? 4 : pu[i] === 1 ? 7 : 2), '2v2 pay of ' + as[i]));
  } else {
    const wins = pu[soloI] === 1 && new Set(pu).size > 1, tie = new Set(pu).size === 1;
    pg.forEach((v, i) => assert.equal(v, mult * (tie ? (i === soloI ? 5 : 2) : wins ? (i === soloI ? 12 : 0) : (i === soloI ? 0 : 4)), '1v3 pay of ' + as[i]));
  }
  log('team podium', tipo, JSON.stringify({ pu, pg, sc, mult }), 'coin check ok');
  const last = eq.lastA;
  if (game === 'f_futbolito') {
    log('futbolito', 'score blue/red', JSON.stringify(last && last.sc), 'goals timeline', JSON.stringify(eq.goles.map((g) => g.t + 'ms ' + g.sc.join('-'))), 'ball touched by A/B', !!eq.touchA, !!eq.touchB);
    assert.ok(eq.bMov > 30, 'the touch stick moved B on the field (' + Math.round(eq.bMov) + ' px)');
    const dg = sc.reduce((x, y) => x + y, 0) - (last.sc[0] + last.sc[1]);      // the last sampled view can precede the final (golden) goal by one
    assert.ok(dg >= 0 && dg <= 1, 'sum of seat goals = on-field score (+ the goal after the last sample): ' + dg);
    // the outcome of the match is NOT asserted (it depends on the skill of the scripted players and on who judges; it is logged above and reported):
    // what is asserted is that the real input of both humans reached the game
    assert.ok(eq.touch, 'the blue humans (keyboard A / touch B) touched the ball at least once');
    assert.ok(eq.aMov > 30, 'the keyboard moved A on the field (' + Math.round(eq.aMov) + ' px)');
  } else {
    const idxC = as.indexOf('c');
    log('patilla', 'hits', eq.maxHits, 'shots', eq.tiros, 'B moved', Math.round(eq.bMov), 'golpes', JSON.stringify(last && last.golpes));
    assert.ok(eq.tiros >= 1 && eq.tiros <= 3, 'between 1 and 3 shots were seen: ' + eq.tiros);
    assert.equal(sc[soloI] % 10, 0, 'solo score = 10 per hit'); assert.ok(sc.every((v, i) => i === soloI || v === 25), 'every trio member holds 25');
    assert.ok(sc[soloI] >= 10 * eq.maxHits, 'solo score >= 10 × hits seen on the field (' + sc[soloI] + ' vs ' + eq.maxHits + ')');
    if (mj.solo === 'a' || mj.solo === 'b') { assert.ok(eq.maxHits >= 3 && pu[soloI] === 1, 'a human solo that aims at the idle player wins with >= 3 hits: ' + JSON.stringify(pods[0])) }
    else assert.ok(last && last.golpes[idxC] >= 1, 'the CPU solo hit the idle player at least once');
    if (mj.solo !== 'b') assert.ok(eq.bMov > 20, 'the touch stick moved B (' + Math.round(eq.bMov) + ' px)');
  }
}

async function unJuego(game) {
  const pb = await start({ patches: patches(game), verbose: !!process.env.PB_VERBOSE,
      patchFiles: JUEZ ? { 'pb_hooks/party_mj.js': [[/const juez = G\[\(mj\.k \| 0\) % G\.length\];/, "const juez = G.indexOf('" + JUEZ + "') >= 0 ? '" + JUEZ + "' : G[(mj.k | 0) % G.length];"]] } : undefined });
  log('pocketbase', pb.url, 'game under test', game, '· load', os.loadavg().map((x) => x.toFixed(0)).join('/'));
  const browser = await chromium.launch({ executablePath: chromePath(), headless: !process.env.HEADED });
  const st = { acciones: {} }, def = DEFS[game] || {};
  try {
    const vA = def.equipo ? VIEW : { width: 1100, height: 700 }, vB = def.equipo ? VIEW : { width: 844, height: 390 };      // M2 games keep their original sizes; the team games are photographed at 932x430
    const ctxA = await browser.newContext({ viewport: vA });
    const ctxB = await browser.newContext({ viewport: vB, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const ctxC = await browser.newContext({ viewport: { width: 900, height: 620 } });
    const A = await ctxA.newPage(), B = await ctxB.newPage(), C = await ctxC.newPage(); B.__touch = true;
    vigilar(A, 'A'); vigilar(B, 'B'); vigilar(C, 'C');
    const todos = [['A', A], ['B', B], ['C', C]];

    // ── room: A creates (the real button), B and C join with ?r=CODE ──
    await A.goto(pb.page() + '?estilo=snes'); await hasta(A, (e) => e.pantalla === 'menu', 10000);
    await tocar(A, 'crear');
    const a0 = await hasta(A, (e) => e.pantalla === 'sala' && e.code, 10000, 'A in a room'), CODE = a0.code;
    await B.goto(pb.page() + '?estilo=snes&r=' + CODE); await hasta(B, (e) => e.pantalla === 'sala' && e.seat, 10000, 'B joined');
    await C.goto(pb.page() + '?estilo=snes&r=' + CODE); await hasta(C, (e) => e.pantalla === 'sala' && e.seat, 10000, 'C joined');
    // lobby calls through the net layer; status 0 = the request timed out (the box can be loaded by other runs): retry, they are idempotent
    const net = async (p, fn, arg) => { let s = 0; for (let i = 0; i < 4 && s === 0; i++) s = await p.evaluate(([f, a]) => FIESTA_DEBUG.net[f](a).then((r) => r.status), [fn, arg]); return s; };
    assert.equal(await net(A, 'pick', { ch: 'mama' }), 200); assert.equal(await net(B, 'pick', { ch: 'abuela' }), 200); assert.equal(await net(C, 'pick', { ch: 'tio' }), 200);
    assert.equal(await net(B, 'ready', { on: true }), 200); assert.equal(await net(C, 'ready', { on: true }), 200);
    await sleep(500);
    assert.equal(await net(A, 'start', {}), 200, 'start');
    for (const [w, p] of todos) await hasta(p, (e) => e.pantalla === 'juego', 10000, w + ' in game');
    log('chars', JSON.stringify((await est(A)).ch));
    log('game started, seats', (await est(A)).seat, (await est(B)).seat, (await est(C)).seat);

    // ── board turns until the first 4-player minigame (carta) ──
    const jugarTodos = async () => { await jugar(A, 'A', st); await jugar(B, 'B', st); await jugar(C, 'C', st); };
    let b0 = null; const tA = Date.now();
    for (;;) {
      b0 = await S(A);
      if (b0.f === 'carta' && b0.mj && b0.mj.as.length === 4 && !b0.mj.duelo && !b0.mj.rel) break;     // (with the colour patch a 4-seat round of a team game is always its format)
      if (Date.now() - tA > 360000) throw new Error('no 4-player minigame reached: ' + JSON.stringify({ f: b0.f, r: b0.r }));
      await jugarTodos(); await sleep(120);
    }
    const K = b0.mj.k, gj = b0.mj.cola[b0.mj.i].g, as = b0.mj.as;
    log('minigame', K, gj, b0.mj.tipo, 'seats', as.join(''), 'judge', b0.mj.juez);
    assert.equal(gj, game, 'the reducer picked the only live game');
    if (def.tipo) {
      assert.equal(b0.mj.tipo, def.tipo, 'the round has the team format of the game (not the free-for-all fallback)');
      assert.equal(b0.mj.clase, 'binary');
      if (def.tipo === '2v2') assert.deepEqual(b0.mj.eq.map((t) => t.slice().sort()), [BLUE.slice().sort(), as.filter((x) => BLUE.indexOf(x) < 0)].sort(), '2v2 teams as arranged');
      else { assert.equal(b0.mj.solo, SOLO, 'the arranged solo'); assert.equal(b0.mj.eq[1].length, 3); }
      log('teams', JSON.stringify(b0.mj.eq), 'solo', b0.mj.solo, 'judge', b0.mj.juez);
    }
    const monAntes = {}; as.forEach((s) => { monAntes[s] = b0.pj[s].mon; });
    const turnosAntes = (await est(A)).turnos;
    const humanos = { a: A, b: B, c: C };

    // ── wheel, card ──
    let eA = await hasta(A, (e) => e.mj && e.mj.sess && /^(ruleta|tarjeta)$/.test(e.mj.fase || ''), 30000, 'A sees the wheel or the card');
    if (eA.mj.fase === 'ruleta') { await sleep(1700); await foto(A, 'ruleta-A'); }
    await hasta(A, (e) => e.mj && e.mj.fase === 'tarjeta', 15000, 'card on A');
    await hasta(B, (e) => e.mj && e.mj.fase === 'tarjeta', 15000, 'card on B'); await hasta(C, (e) => e.mj && e.mj.fase === 'tarjeta', 15000, 'card on C');
    await sleep(300);
    // a human who timed out of two board prompts is AFK (played by the CPU): bring everybody back with the card's «¡YA VOLVÍ!» button
    for (const [w, p] of todos) if ((await est(p)).afk) { log(w, 'was AFK: tapping «volvi» on the card'); await tocar(p, 'volvi', 4000); await sleep(300); }
    await Promise.all([foto(A, gj + '-tarjeta-A'), foto(B, gj + '-tarjeta-B')]);
    for (const [w, p] of todos) assert.ok((await p.evaluate(() => FIESTA_DEBUG.botones())).includes('listo'), w + ' has the LISTO button of the card');
    // practice works on the card (A opens it, plays a bit, closes it)
    await tocar(A, 'practica'); await sleep(700);
    assert.ok((await A.evaluate(() => FIESTA_DEBUG.carta.practicando)), 'practice is running on A');
    await A.keyboard.press('Space'); await sleep(500); await foto(A, gj + '-practica-A');
    if (await A.evaluate(() => FIESTA_DEBUG.carta.practicando)) { const ids = await A.evaluate(() => FIESTA_DEBUG.botones()); await tocar(A, ids.indexOf('salir') >= 0 ? 'salir' : 'practica'); } await sleep(200);   // (practice may have ended by itself on a loaded box)
    assert.ok(!(await A.evaluate(() => FIESTA_DEBUG.carta.practicando)), 'practice closed');

    // ── everybody taps LISTO ──
    for (const [, p] of todos) await tocar(p, 'listo', 8000);
    const eCuenta = await Promise.all(todos.map(([, p]) => hasta(p, (e) => e.mj && (e.mj.phase === 'cuenta' || e.mj.phase === 'juego'), 15000, 'countdown')));
    const gw = await Promise.all(todos.map(([, p]) => p.evaluate(() => FIESTA_DEBUG.goWall())));
    log('goWall estimates', gw.map((x) => x - gw[0]).join(' / '), 'ms · judge', eCuenta[0].mj.juez);
    assert.ok(Math.abs(gw[0] - gw[1]) < 100 && Math.abs(gw[0] - gw[2]) < 100, 'goWall differs by < 100 ms: ' + gw);
    await foto(A, gj + '-cuenta-A');
    await Promise.all(todos.map(([, p]) => hasta(p, (e) => e.mj && e.mj.phase === 'juego', 15000, 'game running')));
    const ya = await Promise.all(todos.map(([, p]) => hasta(p, (e) => !!e.ya, 8000, 'the YA fired').then((e) => e.ya.wall)));   // FIESTA_YA is set a frame after phase flips to 'juego': poll, do not read it raw
    log('«¡YA!» wall clocks', ya.map((x) => x - ya[0]).join(' / '), 'ms');
    ya.forEach((x) => assert.ok(x !== null, 'every screen fired the YA'));
    assert.ok(Math.abs(ya[0] - ya[1]) < 100 && Math.abs(ya[0] - ya[2]) < 100, '«¡YA!» differs by < 100 ms: ' + ya);

    // ── play: A types SPACE (and WASD), B taps pad_a, C stays idle ──  (team games: A / B really play, see jugarEquipo)
    let shot = false; const tj = Date.now(), keys = {}; let eq = null; win.t0 = tj;
    if (def.equipo) eq = await jugarEquipo(game, { A, B, C, as, b0, keys });
    else for (;;) {
      const e = await S(A);
      if (e.f === 'res') break;
      if (Date.now() - tj > 60000) throw new Error('minigame did not end: ' + JSON.stringify({ f: e.f }));
      if (game === 'f_harina') { await conducirHarina(A, as.indexOf('a'), keys); if (process.env.TRACE && Date.now() - (st.tt || 0) > 700) { st.tt = Date.now(); log('TRH', JSON.stringify(keys), JSON.stringify(await A.evaluate((i) => { const g = FIESTA_DEBUG.live.g, o = g.vista(); return { x: o.x[i], y: o.y[i], has: o.has[i], stun: o.stun[i], bags: o.bags.map((b) => [b.x | 0, b.y | 0, b.h, b.act]) }; }, as.indexOf('a')))); } } else await A.keyboard.press('Space');
      // f_mecate: B jumps when the next rope crossing is 0.25-0.42 s away (reads g.vista(); a blind tapper fails the first crossing about half of the time)
      let bTap = true;
      if (game === 'f_mecate') { const v = await B.evaluate(() => { const g = FIESTA_DEBUG.live && FIESTA_DEBUG.live.g; if (!g || !g.vista) return null; const o = g.vista(); return { gt: o.gt, sig: o.sig }; }); bTap = !v || !v.sig.length || (v.sig[0] - v.gt >= 0.25 && v.sig[0] - v.gt <= 0.42); }
      const pa = bTap ? await boton(B, 'pad_a') : null; if (pa) await B.touchscreen.tap(pa.x, pa.y);
      if (!shot && Date.now() - tj > 2500) { shot = true; await Promise.all([foto(A, gj + '-juego-A'), foto(B, gj + '-juego-B')]); }
      await sleep(game === 'f_mecate' ? 40 : 220);
    }
    win.t1 = Date.now();
    for (const k of Object.keys(keys)) if (keys[k]) await A.keyboard.up(k === 'Shift' ? 'ShiftLeft' : k).catch(() => {});

    // ── podium: same on all screens and equal to the server record ──
    const pods = await Promise.all(todos.map(([, p]) => hasta(p, (e) => e.podio, 12000, 'podium').then((e) => e.podio)));
    assert.deepEqual(pods[0], pods[1], 'A and B see the same podium'); assert.deepEqual(pods[0], pods[2], 'A and C see the same podium');
    const rid = await A.evaluate(() => FIESTA_DEBUG.room.id);
    const rec = await (await fetch(pb.url + '/api/collections/rooms/records/' + rid)).json();      // viewRule "": readable by id (what the SSE sends)
    const sv = rec && rec.board && rec.board.mj && rec.board.mj.res;
    assert.ok(sv, 'the room record on the server carries board.mj.res: ' + JSON.stringify(rec).slice(0, 200));
    assert.deepEqual({ puestos: pods[0].puestos, pagos: pods[0].pagos, sc: pods[0].sc }, { puestos: sv.puestos, pagos: sv.pagos, sc: sv.sc }, 'podium = server board.mj.res');
    const bRes = await S(A); assert.deepEqual(bRes.mj.res.puestos, pods[0].puestos);
    assert.equal(bRes.mj.res.aj, false, 'the server did not have to clip the result');
    log('podium', JSON.stringify(pods[0]), 'by', bRes.mj.res.por);
    await hasta(A, (e) => e.mj && e.mj.fase === 'podio', 8000, 'podium screen on A'); await sleep(def.equipo ? 2600 : 900);   // (team games: let the coin counters finish) await Promise.all([foto(A, gj + '-podio-A'), foto(B, gj + '-podio-B')]);
    if (def.equipo) await verificarEquipo(game, { A, as, b0, bRes, pods, eq });
    else {
    // (3) the idle human does not beat the CPU
    assert.equal(bRes.pj.c.cpu, null, 'C is a human (not AFK) for the whole minigame');
    const idxC = as.indexOf('c'), cpus = as.filter((s) => bRes.pj[s].cpu === 'auto').map((s) => as.indexOf(s));
    assert.ok(idxC >= 0 && cpus.length >= 1);
    cpus.forEach((j) => assert.ok(pods[0].puestos[idxC] >= pods[0].puestos[j], 'idle C (' + pods[0].puestos[idxC] + ') must not beat the CPU (' + pods[0].puestos[j] + '): ' + JSON.stringify(pods[0])));
    // (3b) real input reached the game: a human who played beats the idle one (harina: the driven keyboard player specifically)
    const scs = pods[0].sc, iA = as.indexOf('a'), iB = as.indexOf('b');
    log('scores', JSON.stringify({ A: scs[iA], B: scs[iB], C: scs[idxC], cpu: cpus.map((j) => scs[j]) }));
    assert.ok(Math.max(scs[iA], scs[iB]) > scs[idxC], 'a human who played must beat the idle human: ' + JSON.stringify(pods[0]));
    if (game === 'f_harina') assert.ok(scs[iA] > 0 && scs[iA] > scs[idxC], 'A walked to the bag and scored: ' + JSON.stringify(pods[0]));
    }
    // (4) coins on the board moved by exactly `pagos`
    as.forEach((s, j) => assert.equal(bRes.pj[s].mon - monAntes[s], pods[0].pagos[j], 'coins of ' + s + ' = pagos'));

    // ── back on the board: same hash(D) == hash(S) at rest on all three and one more turn played ──
    for (const [w, p] of todos) await hasta(p, (e) => e.f === 'turno' && e.mj === null || e.f === 'turno', 30000, w + ' back on the board');
    for (let i = 0; i < 60; i++) {
      await jugarTodos();
      const ee = await Promise.all(todos.map(([, p]) => est(p)));
      if (ee[0].turnos >= turnosAntes + 1 && ee.every((x) => x.idle && x.ver === x.target && x.hash === x.hashNet)) {
        assert.equal(ee[0].hash, ee[1].hash); assert.equal(ee[0].hash, ee[2].hash);
        assert.deepEqual(ee[0].mon, ee[1].mon); assert.deepEqual(ee[0].mon, ee[2].mon);
        log('back on the board, in sync at ver', ee[0].ver, 'turns', ee[0].turnos - turnosAntes, 'later');
        break;
      }
      if (i === 59) throw new Error('did not settle on the board: ' + JSON.stringify(ee));
      await sleep(250);
    }
    // the session of the finished minigame is closed (a team game forces the format of EVERY 4-seat round, so the next round's session may already be open: compare keys)
    for (const [w, p] of todos) { const lk = await p.evaluate(() => FIESTA_DEBUG.live ? FIESTA_DEBUG.live.k : null); assert.ok(lk === null || lk !== K, w + ' closed the session of minigame ' + K + ' (open: ' + lk + ')'); }
    void humanos;
    assert.deepEqual(errores, [], 'console / page errors');
    assert.deepEqual(r403.filter((x) => x.t >= win.t0 - 500 && x.t <= win.t1 + 500), [], '403 inside the minigame window');
    log('OK ·', game, '· tolerated: 409 x' + r409.length + ', board 403 x' + r403.length + ', optional map 404 x' + r404.length, '· actions', JSON.stringify(st.acciones));
  } finally {
    await browser.close().catch(() => {});
    await pb.stop();
  }
}

(async () => {
  for (const g of GAMES) await unJuego(g);
  log('ALL OK', GAMES.join(', '));
})().catch((e) => { console.error(e); if (errores.length) console.error('errors:', errores); process.exit(1); });
