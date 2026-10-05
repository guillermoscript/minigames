'use strict';
/* Shared 2–4 player challenges inspired by Twisted's tilt, rotation and everyday tasks.
   Each seat owns one station. Absolute progress survives duplicate/reordered relay packets;
   role zero alone decides and publishes the shared verdict. */
(function () {
const DEF = ['#4DB8FF', '#FF4D9E', '#FFE14D', '#5CFF7A'];                      // seat colours when the table gives none (screenshot harness)
const backdrops = [['#9fd0e6', '#e3f6fb'], ['#d9a86a', '#ffe0a8'], ['#c93a4a', '#ffd9b0'], ['#36b0ea', '#d6f7ff'], ['#f6c98a', '#ffe9c6'], ['#6fc2e8', '#cdeefb'], ['#a8503c', '#f2c184']];
function scene(v) { CrewArt.draw(v); }

function build(kind, sp, D) {
  D = D || { role: 0, roles: 2, seats: [], byRole: [], send() {}, onMsg() {} };
  const n = D.roles, role = D.role;
  const seat = r => { const b = (D.byRole || [])[r] || {}; return { color: b.color || DEF[r], name: b.name || 'P' + (r + 1) }; };
  const seatList = () => Array.from({ length: n }, (_, r) => seat(r));
  const targets = Array.from({ length: n }, () => .25 + Math.random() * .5);
  const progress = Array(n).fill(0);
  let artEndAt = null;
  const disp = Array(n).fill(0), act = Array(n).fill(0), xs = Array(n).fill(.5), txs = Array(n).fill(.5), seen = Array(n).fill(0);   // art only: smoothed progress, 'just scored' pulses, teammates' cursor x
  let interacted = false, charge = 0, flash = 0, lastHit = -10, lastEgg = -1;
  let c = 0, value = .5, previous = null, angle = null, direction = 0, holding = false, keyboardSpin = false, broadcast = 0;
  const names = ['WIPE TOGETHER!', 'SPIN TOGETHER!', 'BALANCE TOGETHER!', 'FEED THE FROGS!', 'PUMP THE DRAGON!', 'FIX THE BRIDGE!', 'CATCH THE EGGS!'];
  const hints = ['SWEEP LEFT AND RIGHT · CLEAR YOUR WINDOW', 'DRAG IN CIRCLES · TURN YOUR WHEEL', 'MOVE LEFT / RIGHT · KEEP THE BALL IN THE GREEN ZONE', 'TAP / SPACE WHEN THE FLY REACHES THE MOUTH', 'HOLD THEN RELEASE IN GREEN · DO NOT OVERFILL', 'TAP / SPACE WHEN THE HAMMER IS IN GREEN', 'MOVE LEFT / RIGHT · CATCH YOUR FALLING EGGS'];
  const g = { crew: true, palette: backdrops[kind], role, dur: 14, pts: 0, cmd: names[kind], hint: hints[kind], thint: hints[kind], roleLabel: 'STATION ' + (role + 1),
    roles: Array.from({ length: n }, (_, i) => ({ label: 'STATION ' + (i + 1), short: names[kind], how: hints[kind], demo: time => {
      const pos = kind === 2 ? targets[i] + .2 * Math.sin(time * 3) : kind === 6 ? .18 + ((Math.floor(time / 1.2) * .37 + targets[i]) % .64) : .5 + .3 * Math.sin(time * 3);
      const success = kind === 3 ? Math.abs(Math.sin(time * 3)) < .38 : kind === 5 ? Math.abs(Math.sin(time * 3.5)) < .35 : time % 1 > .7;
      const prog = Array.from({ length: n }, (_, r) => (time * .2 + r * .13) % 1), pulse = Array.from({ length: n }, (_, r) => Math.max(0, 1 - ((time + r * .31) % 1) * 2.4));
      ctx.save(); ctx.scale(.65,.65); ctx.translate(0, kind === 0 ? -60 : kind === 6 ? -56 : -70);
      scene({ kind, role: i, progress: prog, value: pos, target: targets[i], c: time, charge: time % 1, flash: success ? 1 : 0, result: null, n, seats: seatList(), act: pulse,
        xs: Array.from({ length: n }, (_, r) => .5 + .3 * Math.sin(time * 2.6 + r * 1.7)), end: 0, demo: true });
      ctx.restore();
    } })),
    update(dt) {
      if (g.result && artEndAt === null) artEndAt = now;                // the outro clock starts on the verdict (also when only update() runs, as in the art harness)
      for (let r = 0; r < n; r++) {                                       // art only: teammates glide to their reported progress, pulses mark every point scored
        if (progress[r] > seen[r] + 1e-6) act[r] = 1; seen[r] = progress[r]; act[r] = Math.max(0, act[r] - dt * 2.2);
        disp[r] = r === role ? progress[r] : disp[r] + (progress[r] - disp[r]) * Math.min(1, dt * 9);
        if (r === role) txs[r] = value; xs[r] += (txs[r] - xs[r]) * Math.min(1, dt * 12);
      }
      if (g.result) return;
      c += dt; flash = flash > 0 ? Math.max(0, flash - dt * 3) : Math.min(0, flash + dt * 3);
      if (kind === 4) {
        if (holding || keyboardSpin) charge += dt;
        if (charge > 1.05) { charge = 0; holding = keyboardSpin = false; flash = -1; sfx.buzz(); }
      }
      if (kind === 6) {
        const cycle = Math.floor(c / 1.2), phase = c % 1.2 / 1.2;
        if (phase > .83 && cycle !== lastEgg) {
          lastEgg = cycle;
          if (interacted && Math.abs(value - eggX(cycle)) < .13) reward(); else { flash = -1; sfx.miss(); }
        }
      }
      if (direction) g.move({ x: 110 + Math.max(0, Math.min(1, value + direction * dt)) * 580, y: 330 });
      if (kind === 1 && keyboardSpin) progress[role] = Math.min(1, progress[role] + dt / (2.5 + sp));
      if (kind === 2 && interacted && Math.abs(value - targets[role]) < .08) progress[role] = Math.min(1, progress[role] + dt / (1.7 + sp * .4));
      if (c >= broadcast) { broadcast = c + .12; D.send('crew_progress', { role, p: progress[role], x: value }, true); }
      if (role === 0) {
        if (progress.every(p => p >= 1)) finish('win');
        else if (c >= g.dur / Math.sqrt(sp) - .8) finish('lose');
      }
    },
    move(p) {
      if (g.result) return;
      interacted = true;
      value = Math.max(0, Math.min(1, (p.x - 110) / 580));
      if (kind === 0 && previous !== null) progress[role] = Math.min(1, progress[role] + Math.abs(value - previous) / (4 + sp));
      previous = value;
      if (kind === 1) {
        const a = Math.atan2(p.y - 334, p.x - 310);
        if (holding && angle !== null && Math.hypot(p.x - 310, p.y - 334) > 40) {
          const delta = Math.atan2(Math.sin(a - angle), Math.cos(a - angle));
          progress[role] = Math.min(1, progress[role] + Math.abs(delta) / (Math.PI * 2 * (2 + sp)));
        }
        angle = a;
      }
    },
    down(p) { g.act(); holding = true; angle = null; g.move(p); },
    up() { release(); holding = false; angle = null; },
    act() {
      if (g.result || c - lastHit < .3) return;
      if ((kind === 3 && Math.abs(Math.sin(c * 3)) < .38) || (kind === 5 && Math.abs(Math.sin(c * 3.5)) < .35)) { lastHit = c; reward(); }
      else if (kind === 3 || kind === 5) { lastHit = c; flash = -1; sfx.buzz(); }
    },
    key(e) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter')) g.act(); if (e.code === 'ArrowLeft' || e.code === 'KeyA') direction = -1; if (e.code === 'ArrowRight' || e.code === 'KeyD') direction = 1; if (e.code === 'Space' || e.code === 'Enter') keyboardSpin = true; },
    keyup(e) { if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) direction = 0; if (e.code === 'Space' || e.code === 'Enter') { release(); keyboardSpin = false; } },
    draw(phase) {
      if (g.result && artEndAt === null) artEndAt = now;
      scene({ kind, role, progress: disp, value, target: targets[role], c, charge, flash, result: g.result, n, seats: seatList(), act, xs, end: artEndAt === null ? 0 : Math.max(0, now - artEndAt), touch: TOUCH });
    },
  };
  function eggX(cycle) { return .18 + ((cycle * .37 + targets[role]) % .64); }
  function reward() { progress[role] = Math.min(1, progress[role] + 1 / (3 + (sp > 1.5 ? 1 : 0))); flash = 1; sfx.coin(); burst(400, 330, seat(role).color, 8); }
  function release() { if (kind === 4 && !g.result) { if (charge >= .55 && charge <= .95) reward(); else if (charge > .05) { flash = -1; sfx.miss(); } charge = 0; } }
  g.dbg = { prog: progress, act, target: () => targets[role], clock: () => c, charge: () => charge, eggX: () => eggX(Math.floor(c / 1.2)) };
  function finish(result) { if (g.result) return; g.result = result; D.send('crew_end', result); if (result === 'win') { sfx.sparkle(); confetti(400, 330, 30); } else sfx.miss(); }
  D.onMsg((type, data, from) => {   // from = the sender's role (party.js duoCtx), so a seat can only report its own station
    if (type === 'crew_progress' && data && Number.isInteger(data.role) && data.role >= 0 && data.role < n && data.role !== role && data.role === from && Number.isFinite(data.p) && data.p >= 0 && data.p <= 1) {
      progress[data.role] = Math.max(progress[data.role], data.p);
      if (Number.isFinite(data.x)) txs[data.role] = Math.max(0, Math.min(1, data.x));
    }
    if (type === 'crew_end' && role !== 0 && from === 0 && ['win', 'lose'].includes(data)) g.result = data;
  });
  return g;
}
for (const [id, name, kind] of [['du_wipers', 'WINDOW CREW', 0], ['du_spincrew', 'WHEEL CREW', 1], ['du_balancecrew', 'BALANCE CREW', 2], ['du_frogcrew', 'FROG FEAST', 3], ['du_dragoncrew', 'DRAGON BALLOON', 4], ['du_bridgecrew', 'BRIDGE BUILDERS', 5], ['du_eggcrew', 'EGG RESCUE', 6]]) {
  reg(id, (sp, D) => build(kind, sp, D), name); REGMAP[id].duo = true;
}
})();
