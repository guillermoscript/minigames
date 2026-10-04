'use strict';
/* Shared 2–4 player challenges inspired by Twisted's tilt, rotation and everyday tasks.
   Each seat owns one station. Absolute progress survives duplicate/reordered relay packets;
   role zero alone decides and publishes the shared verdict. */
(function () {
const colors = ['#4DB8FF', '#FF4D9E', '#FFE14D', '#5CFF7A'];
const backdrops = Array(7).fill(['#36b0ea', '#d6f7ff']);
function scene(kind,role,progress,value,target,c,charge,flash,result,n,end=0) {
  CrewArt.draw({kind,role,progress,value,target,c,charge,flash,result,n,colors,end});
}

function build(kind, sp, D) {
  D = D || { role: 0, roles: 2, send() {}, onMsg() {} };
  const n = D.roles, role = D.role, players = D.players || [];
  const targets = Array.from({ length: n }, () => .25 + Math.random() * .5);
  const progress = Array(n).fill(0);
  let artEndAt = null;
  let interacted = false, charge = 0, flash = 0, lastHit = -10, lastEgg = -1;
  let c = 0, value = .5, previous = null, angle = null, direction = 0, holding = false, keyboardSpin = false, broadcast = 0;
  const names = ['WIPE TOGETHER!', 'SPIN TOGETHER!', 'BALANCE TOGETHER!', 'FEED THE FROGS!', 'PUMP THE DRAGON!', 'FIX THE BRIDGE!', 'CATCH THE EGGS!'];
  const hints = ['SWEEP LEFT AND RIGHT · CLEAR YOUR WINDOW', 'DRAG IN CIRCLES · TURN YOUR WHEEL', 'MOVE LEFT / RIGHT · KEEP THE BALL IN THE GREEN ZONE', 'TAP / SPACE WHEN THE FLY REACHES THE MOUTH', 'HOLD THEN RELEASE IN GREEN · DO NOT OVERFILL', 'TAP / SPACE WHEN THE HAMMER IS IN GREEN', 'MOVE LEFT / RIGHT · CATCH YOUR FALLING EGGS'];
  const g = { crew: true, palette: backdrops[kind], role, dur: 14, pts: 0, cmd: names[kind], hint: hints[kind], thint: hints[kind], roleLabel: 'STATION ' + (role + 1),
    roles: Array.from({ length: n }, (_, i) => ({ label: 'STATION ' + (i + 1), short: names[kind], how: hints[kind], demo: time => {
      const pos = kind === 2 ? targets[i] + .2 * Math.sin(time * 3) : kind === 6 ? .18 + ((Math.floor(time / 1.2) * .37 + targets[i]) % .64) : .5 + .3 * Math.sin(time * 3);
      const success = kind === 3 ? Math.abs(Math.sin(time * 3)) < .38 : kind === 5 ? Math.abs(Math.sin(time * 3.5)) < .35 : time % 1 > .7;
      ctx.save(); ctx.scale(.65,.65); ctx.translate(0,-170);
      scene(kind,i,Array(n).fill((time*.22) % 1),pos,targets[i],time,time%1,success?1:0,null,n);
      ctx.restore();
    } })),
    update(dt) {
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
      scene(kind, role, progress, value, targets[role], c, charge, flash, g.result, n, artEndAt === null ? 0 : Math.max(0, now - artEndAt));
    },
  };
  function eggX(cycle) { return .18 + ((cycle * .37 + targets[role]) % .64); }
  function reward() { progress[role] = Math.min(1, progress[role] + 1 / (3 + (sp > 1.5 ? 1 : 0))); flash = 1; sfx.coin(); burst(400, 330, colors[role], 8); }
  function release() { if (kind === 4 && !g.result) { if (charge >= .55 && charge <= .95) reward(); else if (charge > .05) { flash = -1; sfx.miss(); } charge = 0; } }
  g.dbg = { target: () => targets[role], clock: () => c, charge: () => charge, eggX: () => eggX(Math.floor(c / 1.2)) };
  function finish(result) { if (g.result) return; g.result = result; D.send('crew_end', result); if (result === 'win') { sfx.sparkle(); confetti(400, 330, 30); } else sfx.miss(); }
  D.onMsg((type, data, from) => {
    const sender = players.find(p => p.id === from);
    if (players.length && !sender) return;
    if (type === 'crew_progress' && data && Number.isInteger(data.role) && data.role >= 0 && data.role < n && data.role !== role && (!sender || sender.role === data.role) && Number.isFinite(data.p) && data.p >= 0 && data.p <= 1) {
      progress[data.role] = Math.max(progress[data.role], data.p);
    }
    if (type === 'crew_end' && role !== 0 && (!sender || sender.role === 0) && ['win', 'lose'].includes(data)) g.result = data;
  });
  return g;
}
for (const [id, name, kind] of [['du_wipers', 'WINDOW CREW', 0], ['du_spincrew', 'WHEEL CREW', 1], ['du_balancecrew', 'BALANCE CREW', 2], ['du_frogcrew', 'FROG FEAST', 3], ['du_dragoncrew', 'DRAGON BALLOON', 4], ['du_bridgecrew', 'BRIDGE BUILDERS', 5], ['du_eggcrew', 'EGG RESCUE', 6]]) {
  reg(id, (sp, D) => build(kind, sp, D), name); REGMAP[id].duo = true;
}
})();
function drawCrewIntro(left) {
  const R = party.room, act = R.players.filter(p => !p.left), elapsed = DUO_PRE - left;
  const own = act.find(p => p.id === party.you.id), r = cur.roles[cur.role];
  bg(cur.palette[0],cur.palette[1],elapsed*.08);
  txt('DUO / CREW',400,62,40,'#FFE14D');
  if (elapsed < 3.1) {
    box(100,90,600,58,own.color,4); txt('YOU DO THIS',400,129,32,INK);
    txt(r.short,400,187,32,'#fff');
    box(140,210,520,240,'#2b2845',4);
    ctx.save();ctx.beginPath();ctx.rect(142,212,516,236);ctx.clip();ctx.translate(140,210);r.demo(elapsed);ctx.restore();
    txt(r.how,400,495,23,'#fff','center',740);
    txt('EVERY STATION MUST FINISH',400,555,25,'#5CFF7A');
  } else {
    txt('GET READY!',400,133,42,'#fff');
    act.forEach((p,i) => {
      const role=(i+R.round)%act.length, x=40+i%2*380, y=180+Math.floor(i/2)*140;
      box(x,y,340,116,p.color,4);claude(x+47,y+90,3,{col:p.color,mood:'happy'});
      txt(p.id===party.you.id?'YOU':p.name.toUpperCase(),x+210,y+40,25,INK,'center',230);
      txt(cur.roles[role].label,x+210,y+83,24,INK,'center',230);
    });
    txt('GO!',400,540,72,'#5CFF7A');
  }
}
