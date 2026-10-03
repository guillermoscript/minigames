'use strict';
/* POWER OUT! (SE FUE LA LUZ): six microgames and the stage intro, all drawn with the vector art in js/art/ap_art.js.
   FLIP IT!, HOLD IT SHUT!, SWAT!, PLUG IT!, FLIP! (arepa), SHOUT!
   Every game works with mouse + keyboard and with touch (down/move with logical coordinates), keeps its own clock
   D = dur / sqrt(sp) like the other modules, and reports g.result = 'win' | 'lose'. All randomness is drawn in the constructor. */
(function () {

const { stroke, ell, rad } = AP;
const C = AP.CAST, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k;
const RED = '#ff4d4d', YEL = '#FFD23F', GRN = '#5CFF7A';
const mkR = () => mulberry32(Math.floor(Math.random() * 4294967296));
const skipKey = e => e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape' || e.repeat;
const apWin = (x, y, msg) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 34); ring(x, y, '#fff', 110); if (msg) floatText(msg, x, y - 90, YEL, 46); };
const apLose = (x, y, msg) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, RED, 12); if (msg) floatText(msg, x, y - 70, RED, 44); };

/* sounds with a local accent */
const apSnd = {
  click: () => { snd(1500, .03, 'square', .05, 0, 700); noise(.03, .04, 3000, 6000, 'highpass'); },
  zzt: () => { noise(.3, .08, 200, 3500, 'bandpass'); snd(60, .35, 'sawtooth', .06, 0, 28); },
  pum: () => { snd(90, .55, 'sine', .28, 0, 26); noise(.45, .16, 700, 80, 'lowpass'); noise(.12, .08, 4000, 800, 'bandpass'); },
  hum: () => { snd(110, .5, 'sawtooth', .05, 0, 220); snd(55, .5, 'sine', .08); },
  pot: n => { const f = 700 + (n % 5) * 140; snd(f, .5, 'triangle', .05); snd(f * 1.51, .35, 'sine', .035); noise(.05, .05, 3000, 6000, 'highpass'); },
  cheer: () => { noise(.9, .07, 1400, 2600, 'bandpass'); [330, 392, 494, 587].forEach((f, i) => snd(f, .5, 'sawtooth', .02, i * .05, f * 1.1)); },
  sizzle: () => noise(.35, .045, 5000, 8000, 'highpass'),
  bzz: v => snd(480 + v * 220, .09, 'sawtooth', .014 + .03 * v, 0, 430 + v * 260),
  smack: () => { sfx.whoosh(false); setTimeout(() => sfx.thud(), 70); },
};

/* ───────────── shared scene bits ───────────── */
const BULB = { x: 400, y: 150 };
function pose(o) { return Object.assign({ la: [.12, .1], ra: [.12, .1], mouth: 'closed' }, o); }

/* 1 FLIP IT!  The light is out: smash the switch until it comes back. A fake-out teases you half way. */
function apSwitch(sp) {
  const R = mkR(), rs = Math.sqrt(sp), D = 5 / rs, need = Math.round(11 + (sp - 1) * 7 + R() * 2), tease = Math.round(need * (.4 + R() * .15));
  let taps = 0, on = false, hit = 0, flash = 0, lit = 0, slump = 0;
  const g = {
    c: 0, cmd: 'FLIP IT!', wide: true, hint: 'CLICK / SPACE: FLIP THE SWITCH UNTIL THE LIGHT COMES BACK', thint: 'TAP THE SWITCH FAST', dur: 5,
    update(dt) {
      g.c += dt; hit = Math.max(0, hit - dt * 7); flash = Math.max(0, flash - dt); slump = Math.max(0, slump - dt);
      lit += ((g.result === 'win' ? 1 : 0) - lit) * Math.min(1, dt * 9);
    },
    tap() {
      if (g.result) return;
      on = !on; taps++; hit = 1; apSnd.click(); burst(330, 330, '#fff', 3, 120);
      if (taps === tease) { flash = .55; slump = 1.1; apSnd.zzt(); floatText('...', 330, 270, '#fff', 40); }
      if (taps >= need) { g.result = 'win'; apWin(400, 300, '¡LLEGÓ!'); apSnd.cheer(); }
    },
    down() { g.tap(); },
    key(e) { if (!skipKey(e)) g.tap(); },
    draw(tm) {
      AP.sala();
      const fl = flash > 0 ? (Math.sin(now * 38) > -.2 ? .95 : .35) : 0, L = clamp(lit + fl, 0, 1);
      AP.wallSwitch(330, 330, on, 1.4);
      AP.bulb(BULB.x, BULB.y, L);
      const win = g.result === 'win', sl = slump > 0;
      AP.person(C.chamo, pose({ la: [1.38 + hit * .16, -.28], ra: win ? [2.4, .5] : [.15, .2], mouth: win ? 'yell' : sl ? 'worry' : hit > .3 ? 'o' : 'closed', talk: win ? .9 : 0, wide: win ? 0 : .6, raise: sl ? 0 : .6, brow: sl ? -.9 : .3, sweat: win ? 0 : .8, gx: -.8, lean: sl ? .1 : -.04 + hit * -.03, squash: 1 - hit * .03, bob: win ? Math.abs(Math.sin(now * 12)) * -14 : 0 }), 480, 520, 1.22);
      AP.person(C.abuela, pose({ la: [.5, 1.5], lprop: r => AP.at(0, 0, -r, 1, 1, AP.candle), ra: win ? [2.3, .4] : [.18, .1], mouth: win ? 'yell' : 'closed', talk: win ? .8 : 0, eyes: win ? 1 : .6, brow: win ? 0 : .7, bob: win ? Math.abs(Math.sin(now * 11 + 1)) * -10 : 0 }), 650, 520, 1.08);
      AP.darkness(.88 - .86 * L, [{ x: BULB.x, y: BULB.y + 40, r: 230 + 480 * L, glow: '255,222,150', ga: .3 * L }, { x: 604, y: 330, r: 150, glow: '255,170,70', ga: .3 }]);
      txt(`${Math.min(taps, need)} / ${need}`, 400, 84, 28, '#fff');
    },
  };
  return g;
}
reg('ap_switch', apSwitch, 'Light Switch');

/* 2 HOLD IT SHUT!  Without power the fridge door wants to swing open and let the cold out: keep shoving it closed. */
function apFridge(sp) {
  const R = mkR(), rs = Math.sqrt(sp), D = 5 / rs, drift = .3 + (sp - 1) * .2, surges = [R() * 1.2 + .8, R() * 1.2 + 2.4];
  let o = .3, shove = 0, tapped = 0;
  const g = {
    probe: () => ({ o }), c: 0, cmd: 'HOLD IT SHUT!', wide: true, hint: 'SPACE / CLICK FAST: KEEP THE FRIDGE CLOSED', thint: 'TAP FAST TO KEEP IT SHUT', dur: 5, timeWin: true, pts: 0,
    update(dt) {
      g.c += dt; shove = Math.max(0, shove - dt * 6);
      if (g.result) return;
      const sg = surges.some(s => g.c > s / rs && g.c < s / rs + .5) ? 1.7 : 1;
      o += drift * rs * sg * dt;
      if (o >= 1) { o = 1; g.result = 'lose'; apLose(560, 330, '¡SE DESCONGELÓ!'); }
      else if (g.c >= D - .02) { g.result = 'win'; apWin(400, 300, '¡SALVADO!'); apSnd.cheer(); }
    },
    tap() { if (g.result) return; o = Math.max(0, o - .13); shove = 1; tapped++; sfx.thud(); burst(500, 380, '#cfeaf0', 3, 140); },
    down() { g.tap(); }, key(e) { if (!skipKey(e)) g.tap(); },
    draw(tm) {
      AP.cocina();
      const fx = 450, fy = 536, op = g.result === 'win' ? 0 : o;
      /* puddle grows with the thaw */
      ctx.fillStyle = 'rgba(150,215,235,.65)'; ctx.beginPath(); ctx.ellipse(fx - 30, fy + 8, 70 + (g.c / D) * 90, 12 + (g.c / D) * 8, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(2 * fx, 0); ctx.scale(-1, 1); AP.fridge(fx, fy, op + Math.sin(now * 40) * .01 * (o > .6 ? 1 : 0)); ctx.restore();
      /* cold air spilling out */
      if (op > .15) { ctx.save(); ctx.globalAlpha = .35 * op; for (let i = 0; i < 6; i++) { const u = (now * .6 + i / 6) % 1; ell(fx - 110 - u * 70 + i * 6, fy - 30 - i * 12, 26 + u * 40, 10 + u * 14, '#d9f6ff'); } ctx.restore(); }
      /* Tío leans his whole weight on the door's free edge */
      const win = g.result === 'win', lose = g.result === 'lose', edge = fx - 95 + 190 * Math.cos(op * 1.05);
      AP.person(C.tio, pose({ la: [1.38 + shove * .08, -.35 - shove * .1], ra: [.15, .1], mouth: lose ? 'yell' : win ? 'grin' : 'o', talk: lose ? .9 : 0, brow: lose ? -.8 : .9, sweat: 1, lean: -.14 - shove * .08 + op * .08, gx: -1, bob: Math.sin(now * 18) * (1 + op * 2), squash: 1 - shove * .03 }), edge + 118 - shove * 10, 548, 1.15);
    },
  };
  return g;
}
reg('ap_fridge', apFridge, 'Fridge');

/* 3 SWAT!  A zancudo in the dark. Light the room with the pointer, find the red eyes, smack it with the chancleta. */
function apMosquito(sp) {
  const R = mkR(), rs = Math.sqrt(sp), D = 5 / rs, seed = R() * 100, spd = .55 + (sp - 1) * .22;
  const M = { x: 400, y: 280, a: 0, vx: 0, vy: 0 };
  let px = 400, py = 330, swing = 0, cool = 0, sx = 0, sy = 0, misses = [], seen = 0, whT = 0;
  const g = {
    probe: () => ({ x: M.x, y: M.y }), c: 0, cmd: 'SWAT!', wide: true, hint: 'MOUSE: LIGHT THE ROOM · CLICK: SMACK THE ZANCUDO', thint: 'DRAG TO LIGHT, LIFT TO SMACK', dur: 5, pts: 0,
    update(dt) {
      g.c += dt; swing = Math.max(0, swing - dt * 4.5); cool = Math.max(0, cool - dt);
      const c = g.c * spd * rs;
      if (g.result !== 'win') {
        const tx = 400 + Math.sin(c * 2.1 + seed) * 270 + Math.sin(c * 5.3) * 40, ty = 290 + Math.cos(c * 1.7 + seed * 1.3) * 130 + Math.sin(c * 6.1) * 30;
        M.vx = (tx - M.x) * 9; M.vy = (ty - M.y) * 9; M.x += M.vx * dt; M.y += M.vy * dt; M.a = Math.atan2(M.vx, -M.vy) * .5;
      } else { M.y += 380 * dt; M.a += dt * 8; }
      whT -= dt;
      if (whT <= 0 && !g.result) { whT = .1; const d = Math.hypot(M.x - px, M.y - py); apSnd.bzz(clamp(1 - d / 360, 0, 1)); }
      for (const m of misses) m.t -= dt; misses = misses.filter(m => m.t > 0);
    },
    move(p) { px = p.x; py = p.y; },
    swat(p) {
      px = p.x; py = p.y;
      if (g.result || cool > 0) return;
      swing = 1; cool = .32; sx = p.x; sy = p.y; apSnd.smack();
      if (Math.hypot(M.x - p.x, M.y - p.y) < 44) { g.result = 'win'; g.pts = 1; apWin(p.x, p.y, '¡PLAF!'); burst(p.x, p.y, '#8a2a3a', 14, 220); sfx.splat(); }
      else { misses.push({ x: p.x, y: p.y, t: .5 }); burst(p.x, p.y, '#fff', 4, 120); }
    },
    down(p) { px = p.x; py = p.y; if (!p.touch) g.swat(p); },       // touch: the finger is the flashlight, lifting it is the smack
    up(p) { if (p.touch) g.swat(p); },
    key(e) {
      if (skipKey(e)) return;
      const d = { ArrowLeft: [-60, 0], ArrowRight: [60, 0], ArrowUp: [0, -60], ArrowDown: [0, 60] }[e.code];
      if (d) { px = clamp(px + d[0], 0, W); py = clamp(py + d[1], 60, 520); } else g.swat({ x: px, y: py });
    },
    draw(tm) {
      AP.sala(); AP.bulb(BULB.x, BULB.y, 0);
      AP.person(C.abuela, pose({ la: [.9, .2], lprop: null, ra: [1.5, .2], mouth: g.result === 'win' ? 'yell' : 'worry', talk: g.result === 'win' ? .8 : 0, eyes: 1, wide: 1, gx: (M.x - 130) / 400, gy: (M.y - 300) / 300, brow: -.7, raise: .5, sweat: .6, lean: .05 }), 130, 520, 1.1);
      /* the zancudo is only seen where the light reaches, but its red eyes always glow */
      const near = Math.hypot(M.x - px, M.y - py) < 150;
      if (g.result === 'win') AP.zancudo(M.x, M.y, 1.8, M.a, now);
      AP.darkness(.93, [{ x: px, y: py, r: 170, glow: '255,245,210', ga: .25 }, { x: 156, y: 340, r: 70, glow: '255,170,70', ga: .12 }]);
      if (g.result !== 'win') {
        if (near) AP.zancudo(M.x, M.y, 1.8, M.a, now);
        else { ctx.globalAlpha = .75; ell(M.x - 4, M.y - 6, 2, 2, '#ff3b3b'); ell(M.x + 4, M.y - 6, 2, 2, '#ff3b3b'); ctx.globalAlpha = 1; }
      }
      for (const m of misses) { ctx.globalAlpha = m.t * 2; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(m.x, m.y, 44 * (1.4 - m.t), 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      /* the chancleta: follows the pointer, whips down on a click */
      const k = 1 - swing, r = swing > 0 ? (-1.1 + (1 - Math.abs(swing * 2 - 1)) * 1.6) : -.45;
      AP.at(px + 18, py + 22, r, 1.25, 1.25, () => AP.chancleta());
    },
  };
  return g;
}
reg('ap_mosquito', apMosquito, 'Zancudo');

/* 4 PLUG IT!  The phone is at 3%. Chase the swinging outlet and plug the charger in when they line up. */
function apBattery(sp) {
  const R = mkR(), rs = Math.sqrt(sp), D = 5 / rs, ph = R() * 6.28, sx = 1.5 + (sp - 1) * .6, sy = 1.1 + (sp - 1) * .4;
  let px = 400, py = 420, penalty = 0, zap = 0, plugged = false, cool = 0;
  const oAt = c => ({ x: 400 + Math.sin(c * sx + ph) * 220, y: 250 + Math.sin(c * sy * 1.3 + ph * 2) * 60 });
  const g = {
    probe: () => oAt(g.c), c: 0, cmd: 'PLUG IT!', wide: true, hint: 'MOUSE: MOVE THE PLUG · CLICK: PLUG IN WHEN IT LINES UP', thint: 'DRAG THE PLUG, TAP TO PLUG IN', dur: 5,
    update(dt) {
      g.c += dt; zap = Math.max(0, zap - dt * 3); cool = Math.max(0, cool - dt);
      if (!g.result && g.c + penalty >= D - .02) { g.result = 'lose'; apLose(150, 380, '¡0%!'); }
    },
    move(p) { px = p.x; py = p.y; },
    tryPlug(p) {
      px = p.x; py = p.y; if (g.result || cool > 0) return;
      const o = oAt(g.c), d = Math.hypot(px - o.x, py - 26 - o.y);
      if (d < 38) { g.result = 'win'; plugged = true; sfx.zap(); apWin(o.x, o.y, '¡CARGANDO!'); }
      else { zap = 1; cool = .3; penalty += .45; sfx.miss(); burst(px, py, '#7ae8ff', 6, 160); }
    },
    down(p) { px = p.x; py = p.y; if (!p.touch) g.tryPlug(p); },     // touch: drag the plug, lift to plug it in
    up(p) { if (p.touch) g.tryPlug(p); },
    key(e) {
      if (skipKey(e)) return;
      const d = { ArrowLeft: [-50, 0], ArrowRight: [50, 0], ArrowUp: [0, -50], ArrowDown: [0, 50] }[e.code];
      if (d) { px = clamp(px + d[0], 0, W); py = clamp(py + d[1], 120, 520); } else g.tryPlug({ x: px, y: py });
    },
    draw(tm) {
      AP.sala(); AP.bulb(BULB.x, BULB.y, 0);
      const o = oAt(g.c), left = Math.max(0, D - g.c - penalty), pct = g.result === 'win' ? 3 : Math.max(0, Math.ceil(left / D * 3));
      /* the outlet sways on a loose extension strip */
      stroke(`M${o.x},0 L${o.x},${o.y - 36}`, '#2a2233', 3);
      AP.outlet(o.x, o.y, 1.15, g.result === 'win');
      const ptx = plugged ? o.x : px, pty = plugged ? o.y - 8 : py;
      AP.person(C.chamo, pose({ la: [.2, .3], ra: [.9, 1.6], rprop: r => AP.at(0, -22, -r + .12, .75, .75, () => AP.phone(pct)), mouth: g.result === 'win' ? 'yell' : 'o', talk: g.result === 'win' ? .8 : 0, wide: 1, raise: .8, brow: -.9, sweat: 1, gx: .9, gy: -.6, hr: Math.sin(now * 14) * .03, bob: g.result === 'win' ? Math.abs(Math.sin(now * 12)) * -14 : 0 }), 150, 548, 1.35);
      /* charger cable from the phone to the plug */
      const hx = 232, hy = 400;
      ctx.strokeStyle = '#14161f'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.bezierCurveTo(hx + 90, hy + 120 + Math.sin(now * 3) * 6, ptx - 120, pty + 140, ptx, pty + 26); ctx.stroke();
      ctx.strokeStyle = '#3a3f55'; ctx.lineWidth = 2; ctx.stroke();
      AP.plug(ptx, pty, 1.15, 0);
      if (zap > 0) { ctx.globalAlpha = zap; stroke(`M${px - 24},${py - 20} L${px - 8},${py - 4} L${px - 18},${py} L${px + 4},${py + 22}`, '#7ae8ff', 4); ctx.globalAlpha = 1; }
      AP.darkness(.86, [{ x: o.x, y: o.y, r: 220, glow: '120,230,255', ga: .18 }, { x: 232, y: 400, r: 150, glow: '140,255,160', ga: .22 }]);
    },
  };
  return g;
}
reg('ap_battery', apBattery, 'Phone 3%');

/* 5 FLIP!  The arepa on the budare: flip it when it is golden. Too soon is raw, too late is charcoal. */
function apArepa(sp) {
  const R = mkR(), rs = Math.sqrt(sp), D = 5 / rs, rate = (.2 + R() * .05) * rs * (.9 + (sp - 1) * .35), lo = .55, hi = .76;
  let cook = 0, flipT = -1, shown = 0;
  const g = {
    probe: () => ({ cook, lo, hi }), c: 0, cmd: 'FLIP!', wide: true, hint: 'SPACE / CLICK WHEN THE AREPA IS GOLDEN', thint: 'TAP WHEN IT IS GOLDEN', dur: 5,
    update(dt) {
      g.c += dt;
      if (!g.result) {
        cook += rate * dt;
        if (Math.floor(g.c * 9) !== Math.floor((g.c - dt) * 9)) apSnd.sizzle();
        if (cook >= 1) { g.result = 'lose'; apLose(400, 300, '¡CARBÓN!'); }
      } else if (flipT >= 0) flipT += dt;
      shown = lerp(shown, cook, Math.min(1, dt * 20));
    },
    tap() {
      if (g.result) return; flipT = 0; sfx.whoosh();
      if (cook >= lo && cook <= hi) { g.result = 'win'; apWin(400, 300, '¡DORADITA!'); apSnd.cheer(); }
      else g.result = 'lose', apLose(400, 300, cook < lo ? '¡CRUDA!' : '¡CARBÓN!');
    },
    down() { g.tap(); }, key(e) { if (!skipKey(e)) g.tap(); },
    draw(tm) {
      AP.cocina();
      const bx = 420, by = 440, win = g.result === 'win', lose = g.result === 'lose';
      AP.budare(bx, by, 300);
      const gas = clamp(1 - cook * .55, .25, 1);
      AP.flame(bx, by + 76, 250, gas, now);
      const f = flipT >= 0 ? clamp(flipT / .7, 0, 1) : 0;
      AP.arepa(bx, by - 16, cook, f, 1.1);
      /* steam and smoke */
      for (let i = 0; i < 6; i++) {
        const u = (now * .5 + i / 6) % 1, burnt = cook > .78; ctx.globalAlpha = (1 - u) * (burnt ? .55 : .28);
        ell(bx - 60 + i * 24 + Math.sin(now * 3 + i) * 8, by - 40 - u * 130, 14 + u * 22, 9 + u * 14, burnt ? '#2b2433' : '#fff'); ctx.globalAlpha = 1;
      }
      AP.person(C.abuela, pose({ la: [.2, .1], ra: f > 0 && f < .5 ? [1.2, -.4 + f * 1.2] : [.9, .9], rprop: AP.spatula, mouth: win ? 'grin' : lose ? 'worry' : 'closed', eyes: win ? .5 : 1, brow: win ? 0 : cook > .7 ? -.8 : .4, wide: cook > .72 && !g.result ? 1 : 0, gx: .8, gy: .5, sweat: cook > .7 ? .8 : 0, bob: win ? Math.abs(Math.sin(now * 11)) * -12 : 0, lean: -.03 }), 150, 548, 1.2);
      /* a golden-meter, so the target is readable */
      const mx = 250, my = 110, mw = 300; box(mx, my, mw, 20, '#3b2a2a', 3);
      ctx.fillStyle = '#4bd36b'; ctx.fillRect(mx + mw * lo, my, mw * (hi - lo), 20);
      ctx.fillStyle = AP.arepaCol(shown); ctx.fillRect(mx, my, mw * clamp(shown, 0, 1), 20 * .35);
      ctx.fillStyle = '#fff'; ctx.fillRect(mx + mw * shown - 3, my - 7, 6, 34);
    },
  };
  return g;
}
reg('ap_arepa', apArepa, 'Arepa');

/* 6 SHOUT!  Dark barrio. Wait for the grid to come back and be the first to scream LLEGÓ. A false flicker is a trap. */
function apGrita(sp) {
  const R = mkR(), rs = Math.sqrt(sp), D = 5 / rs, T = (1.5 + R() * 1.4) / rs, fake = R() < .7 ? T - (.55 + R() * .3) / rs : -9, lateGrace = 1.4 / rs;
  let lit = 0, flick = 0, out = null, popT = -1, shout = 0, lights = 0;
  const g = {
    probe: () => ({ T }), c: 0, cmd: 'SHOUT!', wide: true, hint: 'CLICK / SPACE THE INSTANT THE LIGHT COMES BACK', thint: 'TAP WHEN THE LIGHT COMES ON', dur: 5, pts: 0,
    update(dt) {
      g.c += dt; shout = Math.max(0, shout - dt * 3);
      if (g.c >= T) { if (lit === 0) { apSnd.pum(); apSnd.hum(); shake(5, .3); sfx.sparkle(); } lights = Math.min(1, (g.c - T) / .8); lit = 1; }
      flick = g.c > fake && g.c < fake + .14 ? 1 : 0;
      if (popT >= 0) popT += dt;
      if (!g.result && g.c > T + lateGrace) { g.result = 'lose'; apLose(400, 280, '¡TARDE!'); }
    },
    tap() {
      if (g.result) return; shout = 1;
      if (g.c < T) { g.result = 'lose'; popT = 0; apLose(400, 300, '¡MUY PRONTO!'); }
      else { g.result = 'win'; popT = 0; g.pts = Math.round(1000 * (1 - (g.c - T) / lateGrace)); apWin(400, 300, '¡LLEGÓ!'); apSnd.cheer(); for (let i = 0; i < 5; i++) apSnd.pot(i), setTimeout(() => apSnd.pot(i + 2), 120 * i); }
    },
    down() { g.tap(); }, key(e) { if (!skipKey(e)) g.tap(); },
    draw(tm) {
      AP.barrio(flick ? .18 : lights, 1);
      const win = g.result === 'win', lose = g.result === 'lose', all = win || (lights > .5 && !lose);
      /* the neighbours, down on the street */
      const crowd = [[C.abuela, 95, .8], [C.vecina, 240, .82], [C.chamo, 400, 1.2], [C.tio, 565, .76], [C.chuo, 705, .78]];
      crowd.forEach(([sp2, x, s], i) => {
        const me = i === 2, up = (win || (lights > .3 && !lose)) ? 1 : 0, yell = (me && shout > .1) || (win && popT > i * .08) || (lose && me);
        const arms = yell || up ? [2.5 + Math.sin(now * 12 + i) * .18, .3] : [.15, .1];
        AP.person(sp2, pose({ la: arms, ra: me && !win ? [.15, .1] : arms, mouth: yell ? 'yell' : lose && !me ? 'o' : up ? 'grin' : 'closed', talk: yell ? .9 : 0, wide: lose && !me ? 1 : 0, brow: lose && !me ? .8 : 0, gx: lose && !me ? (400 - x) / 300 : 0, bob: yell ? Math.abs(Math.sin(now * 12 + i)) * -12 : 0, lean: Math.sin(now + i) * .01 }), x, 548, s);
      });
      if (win && popT > .1) ['¡LLEGÓ!', '¡AL FIN!', '¡COÑO!'].forEach((s, i) => { const bx = [140, 560, 700][i]; if (popT > .15 + i * .18) bubble0(s, bx, 160 + (i % 2) * 40, Math.min(1, (popT - .15 - i * .18) * 6)); });
      if (lose && popT > .15) bubble0(g.c < T ? '¿...?' : '...', 245, 250, Math.min(1, (popT - .15) * 6));
      /* the dark, with a lamp glow only on the lit blocks: street light + phone lights */
      if (lights < 1) AP.darkness(lerp(.35, 0, lights), [], '8,6,30');
      if (!all) for (const [x, y] of [[100, 470], [245, 470], [560, 470], [700, 470]]) { ctx.fillStyle = rad(x, y, 2, 70, [[0, 'rgba(255,190,100,.28)'], [1, 'rgba(255,190,100,0)']]); ctx.beginPath(); ctx.arc(x, y, 70, 0, 7); ctx.fill(); }
      if (!g.result && g.c < T && flick === 0 && g.c > .2) { /* hint: a pulsing "..." so the wait feels tense */ ctx.globalAlpha = .6 + Math.sin(now * 5) * .3; txt('...', 400, 130, 46, '#fff'); ctx.globalAlpha = 1; }
    },
  };
  return g;
}
reg('ap_grita', apGrita, 'Light Returns');

function bubble0(s, x, y, k) { ctx.save(); ctx.translate(x, y); const e = 1 + (1 - clamp(k, 0, 1)) * .8; ctx.globalAlpha = clamp(k * 2, 0, 1); AP.bubble(s, 0, 0, 0, 80, 26, e); ctx.restore(); }

/* ───────────── BOSS: El Transformador ─────────────
   The pole transformer has gone grumpy and won't give the light back. The whole barrio hauls on a rope tied to the breaker lever:
   mash to raise it before the meter drains. Every couple of seconds it flares up (red eyes, a bolt hits the lever) and the lever slips back faster. */
window.apBoss = function (sp, s) {
  let v = .28, flash = 0, n = 0, c = 0, lit = 0, hurt = 0, nextRage = 1.6 + Math.random() * .6, rageT = -1;
  const need = 1, FX = 250, FY = 548;
  const g = {
    cmd: 'BOSS!', hint: 'MASH SPACE / CLICK TO RAISE THE BREAKER!', thint: 'TAP FAST TO RAISE THE BREAKER!', dur: 8, boss: true, wide: true,
    hit() {
      if (g.result) return; v = Math.min(need, v + .09); flash = .1; n++; sfx.blip(n % 12); shake(2, .06); hurt = .5;
      if (v >= need) { g.result = 'win'; apWin(400, 260, '¡LLEGÓ!'); apSnd.cheer(); apSnd.pum(); shake(12, .4); for (let i = 0; i < 5; i++) setTimeout(() => apSnd.pot(i), 120 * i); }
    },
    key(e) { if (e.code === 'Space' || e.code === 'Enter') g.hit(); },
    down() { g.hit(); },
    update(dt) {
      c += dt; flash = Math.max(0, flash - dt); hurt = Math.max(0, hurt - dt * 4);
      lit += ((g.result === 'win' ? 1 : Math.pow(v, 1.3) * .85) - lit) * Math.min(1, dt * 6);
      if (g.result) return;
      if (rageT < 0 && c >= nextRage) { rageT = 0; apSnd.zzt(); }
      if (rageT >= 0) { rageT += dt; if (rageT > 1.05) { rageT = -1; nextRage = c + 1.3 + Math.random() * .8; } }
      const rage = rageT > .45 ? 2.6 : 1;
      v = Math.max(0, v - (.3 + v * .25) * Math.min(sp, 1.3) * rage * dt);
    },
    draw(tm) {
      AP.barrio(lit, 1);
      const win = g.result === 'win', warn = rageT >= 0 && rageT <= .45, rage = rageT > .45;
      /* the pole, with its crossarm and the cables going off both ways */
      const PX = FX; for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.strokeStyle = '#14101f'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(PX, 118 + i * 9); ctx.quadraticCurveTo(PX + sd * 300, 150 + i * 14, PX + sd * 700, 110 + i * 9); ctx.stroke(); }
      AP.sh(`M${PX - 12},10 L${PX + 12},10 L${PX + 14},560 L${PX - 14},560Z`, '#5a4636', { sh: `M${PX + 3},10 L${PX + 12},10 L${PX + 14},560 L${PX + 3},560Z`, hl: `M${PX - 12},10 L${PX - 7},10 L${PX - 8},560 L${PX - 14},560Z`, ol: '#241a14', lw: 2.4 });
      AP.sh(`M${PX - 90},112 L${PX + 90},112 L${PX + 90},124 L${PX - 90},124Z`, '#5a4636', { ol: '#241a14', lw: 2.2 });
      const mood = win ? 'dizzy' : (warn || rage) ? 'zap' : 'angry';
      AP.transformer(PX, 318 + (win ? 14 : 0), .95, mood, now, hurt);
      /* the rope from the lever handle to the neighbours' hands, then the breaker itself on top of it */
      const k = clamp((win ? 1 : v), 0, 1), jit = rage ? (Math.random() - .5) * 6 : 0;
      const bxy = { x: PX, y: 440 };
      const hp = AP.breaker(bxy.x + jit, bxy.y, k, win ? 1 : lit * .6);
      const pullers = [[C.chuo, 470, .78], [C.tio, 600, .78], [C.chamo, 735, 1.0]];
      const rope = pullers.map(([sp2, x, s2]) => { const kk = s2 * (sp2.h || 1), sx = x - 40 * kk, sy = FY - 168 * kk, px2 = sx - 125 * kk; const t2 = clamp((px2 - hp.x) / (800 - hp.x), 0, 1); return { sx, sy, px: px2, py: hp.y + (415 - hp.y) * t2 }; });
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hp.x, hp.y); ctx.lineTo(rope[0].px, rope[0].py); ctx.lineTo(rope[1].px, rope[1].py); ctx.lineTo(rope[2].px, rope[2].py); ctx.lineTo(820, 430); ctx.stroke();
      ctx.strokeStyle = '#c9a66a'; ctx.lineWidth = 2.4; ctx.setLineDash([6, 8]); ctx.stroke(); ctx.setLineDash([]);
      pullers.forEach(([sp2, x, s2], i) => {
        const r = rope[i], ang = Math.atan2(r.sx - r.px, r.py - r.sy), tug = win ? 0 : (flash > 0 ? .06 : 0), yell = !win;
        AP.person(sp2, pose({ la: [ang, -.05], ra: win ? [2.5 + Math.sin(now * 12 + i) * .2, .3] : [.3, .5], mouth: win ? 'yell' : 'o', talk: win ? .9 : .5 + Math.sin(now * 14 + i) * .4, brow: win ? 0 : .9, sweat: win ? 0 : 1, lean: win ? 0 : .2 + (1 - v) * .08 + tug, bob: win ? Math.abs(Math.sin(now * 12 + i)) * -14 : Math.sin(now * 16 + i) * 2, step: win ? 0 : Math.sin(now * 14 + i) * .08, gx: -.8, squash: flash > 0 ? .97 : 1 }), x, FY, s2);
      });
      AP.person(C.abuela, pose({ la: [.4, 1.4], lprop: r => AP.at(0, 0, -r, 1, 1, AP.candle), ra: win ? [2.4, .4] : [.2, .1], mouth: win ? 'yell' : 'worry', talk: win ? .8 : 0, brow: win ? 0 : -.6, bob: win ? Math.abs(Math.sin(now * 11)) * -12 : 0 }), 90, FY, .85);
      /* lightning from the transformer to the lever when it flares up */
      if (rage) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.beginPath(); let lx = PX + 40, ly = 250; ctx.moveTo(lx, ly); for (let i = 1; i <= 6; i++) { lx += (hp.x - PX - 40) / 6 + (Math.random() - .5) * 40; ly += (hp.y - 250) / 6 + (Math.random() - .5) * 30; ctx.lineTo(lx, ly); } ctx.stroke(); ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 2; ctx.stroke(); }
      if (warn && Math.sin(now * 40) > 0) { txt('!', PX, 40, 70, '#ff4d4d'); }
      /* meter */
      const mx = 250, my = 78, mw = 300;
      txt(win ? '¡LLEGÓ!' : 'THE TRANSFORMER', mx + mw / 2, 66, 24, win ? YEL : '#fff', 'center', 300);
      box3(mx, my + 4, mw, 24, '#14101f', 4, 4); ctx.fillStyle = v > .8 ? YEL : v > .4 ? '#7BD88F' : RED; ctx.fillRect(mx, my + 4, mw * v, 24); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(mx, my + 4, mw * v, 8);
      if (win) txt('¡LLEGÓ!', 400, 200, 80, YEL, 'center', 700);
      vignette(.3);
    },
  };
  return g;
};

/* ───────────── the stage intro (drawn by main.js while state === 'stagein', 4.9 s) ───────────── */
window.apIntro = function (st, stage, stageIdx) {
  const e = v => clamp(v, 0, 1);
  const cut = 1.35;                                   // the instant the transformer blows
  const lit = st < cut ? 1 : Math.max(0, 1 - (st - cut) * 3.2);
  const night = st < cut ? 0 : e((st - cut) / 1.2);
  const nightDim = night;
  /* camera: slow push-in */
  ctx.save(); const z = 1 + st * .018; ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  AP.barrio(lit, 0);
  if (night > 0) { ctx.globalAlpha = night; AP.barrio(lit * (1 - night) + (st > cut + .6 ? 0 : 0), 1); ctx.globalAlpha = 1; }
  ctx.restore();
  /* the flash when the pole blows */
  if (st > cut && st < cut + .5) { const k = 1 - (st - cut) / .5; ctx.fillStyle = `rgba(190,230,255,${.8 * k})`; ctx.fillRect(-OX, 0, VW, H); }
  if (st > cut - .02 && !apIntro.fired) { apIntro.fired = true; apSnd.pum(); apSnd.zzt(); shake(10, .4); burst(340, 232, '#9fe8ff', 30, 380); burst(340, 232, '#fff', 14, 200); ring(340, 232, '#9fe8ff', 120, .5); }
  if (st < .05) apIntro.fired = false;
  /* the cast, on the street, shouting in the dark */
  const up = e((st - cut - .15) / .5), ys = 600 - up * 56;
  [[C.abuela, 100, .85], [C.vecina, 245, .85], [C.chamo, 400, 1.25], [C.tio, 555, .8], [C.chuo, 700, .82]].forEach(([sp2, x, s], i) => {
    const out = st > cut + .3 + i * .1, shouting = out && st < cut + 2.4 + i * .1;
    AP.person(sp2, pose({ la: shouting ? [2.4 + Math.sin(now * 12 + i) * .2, .3] : [.12, .1], ra: [.12, .1], mouth: shouting ? 'yell' : out ? 'worry' : 'smile', talk: shouting ? .9 : 0, wide: out ? 1 : 0, brow: out ? .6 : 0, bob: shouting ? Math.abs(Math.sin(now * 12 + i)) * -10 : 0 }), x, ys, s);
  });
  /* the night itself, then the lettering on top of it */
  AP.darkness(night * .4, [], '6,4,28');
  vignette(.3 + night * .2);
  if (st > cut + .5 && st < cut + 2.4) { bubble0('¡COÑO!', 150, 440, e((st - cut - .5) / .15)); bubble0('¡OTRA VEZ!', 640, 450, e((st - cut - .8) / .15)); }
  const stn = t('STAGE {n}', { n: stageIdx + 1 }), e1 = e(st / .4), e2 = e((st - cut - .1) / .55);
  txt(stn, W / 2 - (1 - e1) * 500, 70, 38, '#fff', 'center', 500);
  if (st > cut + .1) {
    const k = easeBack(e2), name = t(stage.name), jit = Math.sin(now * 30) > .55 && st < cut + 1.9 ? 1 : 0;      // the neon sign flickers
    ctx.save(); ctx.translate(W / 2, 160); ctx.rotate(-.04); ctx.scale(k, k); ctx.globalAlpha = jit ? .55 : 1;
    txt(name, 0, 0, 92, '#ffd23f', 'center', 720); ctx.restore();
    ctx.globalAlpha = e((st - cut - .7) / .4); txt(t(stage.tag), W / 2, 240, 30, '#fff', 'center', 700); ctx.globalAlpha = 1;
  }
  if (st > cut + 2.6) { ctx.globalAlpha = e((st - cut - 2.6) / .5); txt(t('{n} GAMES + BOSS', { n: stage.n }), W / 2, 566, 24, '#fff'); ctx.globalAlpha = 1; }
};

})();
