'use strict';
/* WII wave — WarioWare: Smooth Moves inspired microgames (browser adaptations). All names prefixed wii / wii_ */
const wiiMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const wiiBang = (x = W / 2, y = 300) => { sfx.thud(); sfx.miss(); shake(10, .3); burst(x, y, '#FF4D6D', 16, 300); ring(x, y, '#FF4D6D', 110, .45); };
const wiiHat = (x, y, u, col = '#5a3b22') => { box(x - 5 * u, y - 3 * u, 10 * u, 3 * u, col, 3); box(x - 8 * u, y - .2 * u, 16 * u, 1.4 * u, col, 3); };

/* 1 ── SAVE ME!: slide the trampoline under the jumper, twice */
function wiiSave(sp) {
  const grav = 760 * (sp > 1.5 ? 1.15 : 1), BY = 490;
  let tw = mouse.x, tx = mouse.x, caught = 0, stretch = 0, splat = 0, t = 0;
  const P = { x: 170 + Math.random() * 460, y: 80, vx: 0, vy: 0, rot: 0 };
  const g = {
    cmd: 'SAVE ME!', hint: 'MOUSE / ← → SLIDES THE TRAMPOLINE', thint: 'DRAG LEFT AND RIGHT', dur: 6.2,
    move(p) { tx = p.x; },
    update(dt) {
      t += dt; stretch = Math.max(0, stretch - dt * 3);
      if (g.result === 'lose') { splat += dt; return; }
      if (keys.ArrowLeft || keys.KeyA) tx -= 700 * dt; if (keys.ArrowRight || keys.KeyD) tx += 700 * dt;
      tx = Math.max(90, Math.min(710, tx)); tw += (tx - tw) * Math.min(1, 16 * dt);
      if (g.result) return;
      if (t < .6) { P.rot = Math.sin(t * 30) * .15; return; }
      P.vy += grav * dt; P.x += P.vx * dt; P.y += P.vy * dt; P.rot += (P.vx / 60 + .5) * dt * 2;
      if (P.vy > 0 && P.y >= BY - 22 && P.y < BY + 30 && Math.abs(P.x - tw) < 78) {
        P.y = BY - 22; P.vy = -690; stretch = 1; caught++; sfx.boing(); sfx.blip(caught * 4); shake(4, .15); burst(P.x, BY, '#FFE14D', 10, 220); ring(P.x, BY, '#fff', 80, .35); floatText(caught >= 2 ? 'SAVED!' : 'BOING!', P.x, BY - 50, '#fff', 34);
        if (caught >= 2) { g.result = 'win'; P.vx = 0; sfx.sparkle(); confetti(P.x, BY - 40, 24); }
        else { const tg = 150 + Math.random() * 500; P.vx = (tg - P.x) / (2 * 690 / grav); }
      }
      if (P.x < 40 || P.x > 760) P.vx *= -1;
      if (P.y > 560) { g.result = 'lose'; sfx.splat(); wiiBang(P.x, 540); confetti(P.x, 540, 10); }
    },
    draw(tt) {
      bg('#9BD8FF', '#8ccdf5', tt);
      box(40, 40, 720, 460, '#e7b08a', 6);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) box(70 + c * 85, 70 + r * 85, 44, 56, (r * 3 + c * 5) % 7 === 0 ? '#FFE14D' : '#6fb7e8', 3);
      ctx.fillStyle = INK; ctx.fillRect(0, 524, W, 80); ctx.fillStyle = '#8a8f99'; ctx.fillRect(0, 530, W, 80);
      const fy = BY + stretch * 22;
      // helpers holding the net
      shadow(tw - 105, 568, 28); shadow(tw + 105, 568, 28); if (g.result !== 'lose') shadow(P.x, 532, Math.max(14, 44 - (BY - P.y) / 9), 7, .22);
      claude(tw - 105, 566, 5, { mood: wiiMood(g) }); claude(tw + 105, 566, 5, { mood: wiiMood(g) });
      ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tw - 85, BY + 4); ctx.quadraticCurveTo(tw, fy + 12, tw + 85, BY + 4); ctx.stroke();
      ctx.strokeStyle = '#FF4D6D'; ctx.lineWidth = 8; ctx.stroke(); ctx.lineCap = 'butt';
      if (g.result !== 'lose') { ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.rot); const sq = Math.min(.22, Math.abs(P.vy) / 3200) - stretch * .12; ctx.scale(1 - sq * .6, 1 + sq); claude(0, 22, 4.4, { mood: g.result === 'win' ? 'happy' : null }); ctx.restore(); }
      else { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(P.x, 532, 40 + splat * 60, 9, 0, 0, 7); ctx.fill(); txt('SPLAT!', P.x, 480, 44, '#FF4D6D'); }
      txt(caught + ' / 2', W / 2, 560, 30, '#fff');
    }
  };
  return g;
}

/* 2 ── ZAP!: monsters peek out of doors, zap the eye */
function wiiZap(sp) {
  const vis = 1.2 / Math.pow(sp, .55), gap = .65 / Math.sqrt(sp), need = 4;
  const doors = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) doors.push({ x: 135 + c * 200, y: 100 + r * 235, op: 0, life: 0, z: 0, col: '#C77DFF', t: 0 });
  const cols = ['#C77DFF', '#5CFF7A', '#FF8FAB', '#FFE14D'];
  let sp0 = .5, zaps = 0, laser = 0, lx = 0, ly = 0, esc = null;
  const g = {
    cmd: 'ZAP!', hint: 'CLICK THE EYES BEFORE THEY ESCAPE', thint: 'TAP THE EYES', dur: 6,
    down(p) {
      if (g.result) return; laser = .12; lx = p.x; ly = p.y;
      const d = doors.find(d => d.op > 0 && !d.z && p.x > d.x - 10 && p.x < d.x + 150 && p.y > d.y && p.y < d.y + 190);
      if (d) { d.z = .35; zaps++; sfx.zap(); sfx.blip(zaps * 3); shake(5, .15); burst(d.x + 70, d.y + 100, d.col, 14, 300); ring(d.x + 70, d.y + 100, '#FFE14D', 90, .35); floatText('ZAP!', d.x + 70, d.y + 30, '#FFE14D', 32); confetti(d.x + 70, d.y + 100, 10); if (zaps >= need) { g.result = 'win'; sfx.sparkle(); } }
      else sfx.click();
    },
    update(dt) {
      laser = Math.max(0, laser - dt);
      for (const d of doors) {
        d.t += dt;
        if (d.z > 0) { d.z -= dt; if (d.z <= 0) { d.op = 0; d.life = 0; } continue; }
        if (d.op > 0) { d.life += dt; if (d.life > vis && !g.result) { esc = d; g.result = 'lose'; wiiBang(d.x + 70, d.y + 100); } }
      }
      if (g.result) return;
      sp0 -= dt;
      if (sp0 <= 0 && zaps < need) {
        const free = doors.filter(d => !d.op), open = doors.length - free.length;
        if (open < 2 && free.length) { const d = free[Math.floor(Math.random() * free.length)]; d.op = 1; d.life = 0; d.t = 0; d.col = cols[Math.floor(Math.random() * 4)]; sfx.whoosh(true); }
        sp0 = gap;
      }
    },
    draw(t) {
      bg('#FFE5F1', '#ffd9ea', t);
      for (const d of doors) {
        box(d.x, d.y, 140, 190, '#2b1a3f', 6);
        if (d.op > 0) {
          const k = Math.min(1, d.t / .15), peek = d.z > 0 ? 1 : k, hurry = d.life > vis * .65;
          const ex = d.x + 70, ey = d.y + 110 - (1 - peek) * 40 + Math.sin(d.t * 8) * 3;
          shadow(ex, d.y + 176, 46, 10, .35); circ(ex, ey, 52, d.col, 5);
          ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(ex - 30, ey - 34, 10, 6, -.6, 0, 7); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 34, 0, 7); ctx.fill();
          ctx.fillStyle = d.z > 0 ? '#FF4D6D' : INK; ctx.beginPath(); ctx.arc(ex + Math.sin(d.t * 5) * 8, ey, d.z > 0 ? 8 : 15, 0, 7); ctx.fill();
          if (hurry && d.z <= 0) txt('!', ex + 52, ey - 52, 40, '#FF4D6D');
          if (d.z > 0) star(ex, ey, 70, 30, 8, d.t * 8, '#FFE14D', 4);
          ctx.fillStyle = '#FFB3D1'; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 40 * (1 - Math.cos(k * 1.2)) - 10, d.y + 12); ctx.lineTo(d.x - 40 * (1 - Math.cos(k * 1.2)) - 10, d.y + 180); ctx.lineTo(d.x, d.y + 190); ctx.closePath(); ctx.fill(); ctx.stroke();
        } else { box(d.x, d.y, 140, 190, '#FFB3D1', 6); circ(d.x + 112, d.y + 100, 7, '#FFE14D', 3); }
      }
      if (esc) { const ex = esc.x + 70, ey = esc.y + 100, k = Math.min(1, (esc.life - vis) * 8 + .2); circ(ex, ey, 52 + k * 170, esc.col, 6); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 34 + k * 110, 0, 7); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex, ey, 15 + k * 50, 0, 7); ctx.fill(); }
      if (laser > 0) { ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(W / 2, H); ctx.lineTo(lx, ly); ctx.stroke(); ctx.strokeStyle = '#FF2E4D'; ctx.lineWidth = 6; ctx.stroke(); circ(lx, ly, 14, '#fff', 3); }
      for (let i = 0; i < need; i++) circ(40 + i * 30, 570, 10 + (i === zaps - 1 && laser > 0 ? 3 : 0), i < zaps ? '#FF2E4D' : '#fff', 3);
    }
  };
  return g;
}

/* 3 ── DRAW!: quick-draw duel; fire only after the "!" (not before, not too late) */
function wiiDraw(sp) {
  const lim = .55 / Math.pow(sp, .5), delay = 1.3 + Math.random() * 1.4;
  let tm = 0, tg = 0, st = 0, react = 0, endT = 0;
  const fire = () => {
    if (g.result || tm < .2) return;
    if (!st) { st = 3; g.result = 'lose'; wiiBang(170, 330); }
    else if (st === 1) { react = tg; if (tg <= lim) { st = 2; g.result = 'win'; sfx.stamp(); sfx.zap(); shake(12, .3); burst(630, 330, '#FFE14D', 18, 340); ring(630, 330, '#fff', 120, .4); sfx.sparkle(); } else { st = 3; g.result = 'lose'; wiiBang(630, 330); } }
  };
  const g = {
    cmd: 'DRAW!', hint: 'WAIT FOR THE "!" THEN CLICK / SPACE', thint: 'WAIT FOR "!", THEN TAP', dur: 4.6,
    key(e) { if (e.code === 'Space') fire(); }, down() { fire(); },
    update(dt) {
      tm += dt; if (g.result) { endT += dt; return; }
      if (st === 0 && tm > delay) { st = 1; tg = 0; sfx.coin(); sfx.hit(); shake(3, .12); ring(W / 2, 170, '#FFE14D', 100, .35); }
      if (st === 1) { tg += dt; if (tg > lim) { st = 3; g.result = 'lose'; wiiBang(170, 330); } }
    },
    draw(tt) {
      bg('#FF9A5C', '#ff8a45', tt);
      ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.arc(W / 2, 330, 120, 0, 7); ctx.fill();
      ctx.fillStyle = INK; ctx.fillRect(0, 440, W, 170); ctx.fillStyle = '#d99a52'; ctx.fillRect(0, 448, W, 170);
      for (let i = 0; i < 4; i++) { const x = ((tt * 90 + i * 260) % 1000) - 100; circ(x, 520 + Math.sin(tt * 6 + i) * 4, 18, '#8a5a2b', 4); }
      shadow(170, 444, 90, 18); shadow(630, 444, 90, 18);
      ctx.save(); ctx.translate(170, 440); if (g.result === 'lose') ctx.rotate(-1.2 * Math.min(1, endT * 4)); claude(0, 0, 12, { mood: wiiMood(g) }); wiiHat(0, -108, 12); ctx.restore();
      ctx.save(); ctx.translate(630, 440); if (g.result === 'win') ctx.rotate(1.2 * Math.min(1, endT * 4)); claude(0, 0, 12, { col: '#8a6ad6', mood: g.result === 'win' ? 'sad' : g.result === 'lose' ? 'happy' : null }); wiiHat(0, -108, 12, '#2b2b3a'); ctx.restore();
      if (st === 1) { const pu = 1 + Math.max(0, .25 - tg * 2.5); txt('!', W / 2, 170, 150 * pu, '#FFE14D'); }
      if (st === 0) txt('...', W / 2, 190, 70, '#fff');
      if (g.result === 'win') { txt('BANG!', 400, 290, 70, '#FFE14D'); txt(t('{n} MS', { n: Math.round(react * 1000) }), W / 2, 520, 36, '#fff'); }
      if (g.result === 'lose' && endT < .5) txt(tg > 0 ? 'TOO SLOW!' : 'TOO EARLY!', W / 2, 190, 56, '#FF4D6D');
    }
  };
  return g;
}

/* 4 ── SNEAK!: hold to creep, freeze when the dog looks */
function wiiSneak(sp) {
  const k = Math.sqrt(sp), BX = 610, X0 = 80;
  let p = 0, hold = false, st = 'sleep', stT = 0, stD = 1.3, lookT = 0, t = 0;
  const hxp0 = () => X0 + p * (BX - 55 - X0);
  const press = () => { if (!g.result) hold = true; }, rel = () => { hold = false; };
  const g = {
    cmd: 'SNEAK!', hint: 'HOLD TO CREEP · RELEASE WHEN HE LOOKS', thint: 'HOLD TO CREEP, LET GO WHEN HE LOOKS', dur: 6.2,
    key(e) { if (e.code === 'Space' && !e.repeat) press(); }, keyup(e) { if (e.code === 'Space') rel(); },
    down() { press(); }, up() { rel(); },
    update(dt) {
      t += dt; if (g.result) return;
      stT += dt;
      if (stT >= stD) {
        stT = 0;
        if (st === 'sleep') { st = 'warn'; stD = .42 / k; sfx.blip(-5); }
        else if (st === 'warn') { st = 'look'; stD = (.55 + Math.random() * .35) / k; lookT = 0; sfx.buzz(); }
        else { st = 'sleep'; stD = (.9 + Math.random() * .7) / k; }
      }
      if (st === 'look') { lookT += dt; if (hold && lookT > .13) { g.result = 'lose'; sfx.miss(); sfx.buzz(); shake(10, .3); burst(hxp0(), 494, '#FF4D6D', 14); floatText('CAUGHT!', hxp0(), 440, '#FF4D6D', 36); return; } }
      if (hold) { p = Math.min(1, p + .36 * Math.pow(sp, .7) * dt); if (Math.random() < .15) snd(150 + p * 100, .04, 'triangle', .03); if (p >= 1) { g.result = 'win'; sfx.coin(); sfx.sparkle(); burst(BX, 470, '#FFE14D', 16); ring(BX, 470, '#fff', 90, .4); floatText('GOT IT!', BX, 410, '#fff', 36); } }
    },
    draw(tt) {
      bg('#B8E0C8', '#a9d6bb', tt);
      ctx.fillStyle = INK; ctx.fillRect(0, 440, W, 170); ctx.fillStyle = '#6fc27a'; ctx.fillRect(0, 448, W, 170);
      const look = st === 'look', warn = st === 'warn';
      shadow(655, 446, 110, 14); shadow(BX, 484, 44, 8, .2);
      // dog
      box(560, 330, 190, 110, '#B5651D', 6); box(710, 410, 30, 40, '#B5651D', 5); box(570, 410, 30, 40, '#B5651D', 5);
      const hx = look ? 520 : 540, hy = 335 + Math.sin(tt * 2) * (look ? 0 : 4);
      circ(hx + 40, hy, 62, '#C97A2B', 6);
      box(hx - 8, hy - 60, 30, 50, '#8a4b12', 4); box(hx + 70, hy - 66, 30, 50, '#8a4b12', 4);
      circ(hx - 6, hy + 14, 26, '#E8C9A0', 5); circ(hx - 14, hy + 4, 9, INK, 0);
      for (const ex of [hx + 12, hx + 64]) {
        if (look) { circ(ex, hy - 14, 17, '#fff', 4); ctx.fillStyle = '#FF2E4D'; ctx.beginPath(); ctx.arc(ex - 6, hy - 14, 7, 0, 7); ctx.fill(); }
        else if (warn && ex > hx + 40) { circ(ex, hy - 14, 12, '#fff', 4); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex - 3, hy - 12, 5, 0, 7); ctx.fill(); }
        else { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex - 10, hy - 12); ctx.lineTo(ex + 10, hy - 12); ctx.stroke(); ctx.lineCap = 'butt'; }
      }
      if (st === 'sleep') { txt('Z', hx + 90, hy - 80 - ((tt * 30) % 30), 30, '#fff'); txt('z', hx + 125, hy - 100 - ((tt * 30) % 30), 22, '#fff'); }
      if (warn) txt('!', hx + 40, hy - 96 + Math.sin(tt * 30) * 3, 56, '#FFE14D');
      if (look) { ctx.strokeStyle = INK; ctx.lineWidth = 5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hx + 20 + i * 24, hy - 60); ctx.lineTo(hx + 14 + i * 24, hy - 78); ctx.stroke(); } txt('HMM?', hx + 40, hy - 100, 34, '#FF4D6D'); }
      // bone
      ctx.save(); ctx.translate(BX, 470); ctx.rotate(-.3); box(-34, -6, 68, 12, '#fff', 3); circ(-36, -8, 11, '#fff', 3); circ(-36, 8, 11, '#fff', 3); circ(36, -8, 11, '#fff', 3); circ(36, 8, 11, '#fff', 3); ctx.restore();
      // hand
      const hxp = X0 + p * (BX - 55 - X0) + (g.result === 'lose' ? Math.sin(tt * 40) * 4 : 0);
      box(0, 482, hxp, 24, '#FFCF9F', 4);
      circ(hxp, 494, 26, '#FFCF9F', 5);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hxp + 4, 484 + i * 10); ctx.lineTo(hxp + 22, 484 + i * 10); ctx.stroke(); }
      claude(70, 440, 5, { mood: wiiMood(g) });
      if (g.result === 'lose') txt('CAUGHT!', W / 2, 150, 60, '#FF4D6D');
      if (!g.result && hold) txt(look ? 'FREEZE!' : '', W / 2, 150, 54, '#FF4D6D');
    }
  };
  return g;
}

/* 5 ── UMBRELLA!: pop the umbrella when the meter is in the green */
function wiiUmbrella(sp) {
  const zw = .2 / Math.pow(sp, .35), zc = .3 + Math.random() * .45, per = 1.7 / sp;
  let t = 0, cur = 0, open = 0, wet = 0; const drops = [];
  const g = {
    cmd: 'UMBRELLA!', hint: 'CLICK / SPACE WHEN THE BAR IS GREEN', thint: 'TAP WHEN THE BAR IS GREEN', dur: 4.8,
    key(e) { if (e.code === 'Space') go(); }, down() { go(); },
    update(dt) {
      t += dt;
      const ph = Math.max(0, t - .5) / per; cur = ph ? 1 - Math.abs(((ph + .25) % 1) * 2 - 1) : 0;
      const inten = g.result === 'win' ? 1 : Math.min(1, .25 + t * .22);
      if (Math.random() < dt * (10 + inten * 60)) drops.push({ x: 120 + Math.random() * 560, y: 130, v: 500 + Math.random() * 200 });
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.y += d.v * dt;
        if (open > .8 && Math.abs(d.x - 400) < 95 && d.y > 330 - 40 * Math.sin(Math.abs(d.x - 400) / 95)) { drops.splice(i, 1); continue; }
        if (d.y > 520) drops.splice(i, 1);
      }
      if (g.result === 'win') open = Math.min(1, open + dt * 7);
      if (open > .8) for (const d of drops) if (d.sp !== 1 && Math.abs(d.x - 400) < 95 && d.y > 280 && d.y < 340) { d.sp = 1; if (Math.random() < .3) { sfx.click(); burst(d.x, 335, '#cfe6ff', 2, 120); } }
      if (g.result === 'lose') wet = Math.min(1, wet + dt * 2);
    },
    draw(tt) {
      bg('#5A6B8C', '#536383', tt);
      ctx.fillStyle = INK; ctx.fillRect(0, 500, W, 110); ctx.fillStyle = '#3e4a63'; ctx.fillRect(0, 508, W, 110);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#7e93b8'; ctx.beginPath(); ctx.ellipse(200 + i * 200, 530 + (i % 2) * 20, 50, 8, 0, 0, 7); ctx.fill(); }
      for (const [cx, cy, r] of [[180, 90, 60], [260, 70, 75], [340, 95, 60], [470, 80, 70], [560, 70, 75], [640, 95, 58]]) circ(cx, cy, r, '#4a4f66', 4);
      ctx.strokeStyle = '#cfe6ff'; ctx.lineWidth = 3; for (const d of drops) { ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y - 16); ctx.stroke(); }
      shadow(400, 504, 70, 10, .3);
      // spy
      claude(400, 500, 9, { col: '#8a8f9e', mood: wiiMood(g) });
      box(340, 410, 120, 22, '#5b5f6e', 4); wiiHat(400, 405, 9, '#2b2b3a');
      if (wet > 0) { ctx.fillStyle = 'rgba(77,184,255,.5)'; ctx.fillRect(320, 410, 160, 90); }
      if (open > 0) {
        const s = open; ctx.save(); ctx.translate(400, 430 - 80 * s);
        ctx.fillStyle = INK; ctx.fillRect(-4, 0, 8, 80 * s + 10);
        ctx.beginPath(); ctx.arc(0, 0, 100 * s + 4, Math.PI, 0); ctx.closePath(); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#FF4D6D'; ctx.fill();
        ctx.fillStyle = '#FFE14D'; for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 100 * s, Math.PI + (i > 0 ? .6 : 1.6), Math.PI + (i > 0 ? 1.57 : 2.55)); ctx.fill(); }
        ctx.restore();
      }
      // meter
      box(80, 140, 54, 340, '#fff', 6);
      ctx.fillStyle = '#5CFF7A'; ctx.fillRect(80, 480 - (zc + zw / 2) * 340, 54, zw * 340);
      const cy = 480 - cur * 340; ctx.fillStyle = INK; ctx.fillRect(66, cy - 5, 82, 10); ctx.fillStyle = '#FFE14D'; ctx.fillRect(70, cy - 3, 74, 6);
      if (t < .5) txt('RAIN!', W / 2, 250, 54, '#fff');
    }
  };
  function go() {
    if (g.result || t < .35) return;
    if (cur >= zc - zw / 2 && cur <= zc + zw / 2) { g.result = 'win'; sfx.pop(); sfx.sparkle(); ring(400, 350, '#fff', 130, .45); burst(400, 340, '#FF4D6D', 16); floatText('PERFECT!', 400, 250, '#5CFF7A', 38); }
    else { g.result = 'lose'; sfx.splat(); wiiBang(400, 450); }
  }
  return g;
}

/* 6 ── POP IT!: pump the balloon (press = push, release = pull) until it bursts */
function wiiPop(sp) {
  const n = 9 + Math.floor(sp * 1.4), inc = 1 / n;
  let s = 0, up = true, hy = 0, pop = 0, wob = 0;
  const push = e => { if (g.result || !up || (e && e.repeat)) return; up = false; s = Math.min(1, s + inc); wob = .25; snd(220 + s * 700, .09, 'triangle', .08, 0, 260 + s * 800); noise(.06, .03, 1500, 3000, 'highpass'); burst(430, 395, '#fff', 3, 120); if (s >= 1) { g.result = 'win'; pop = .001; sfx.stamp(); sfx.pop(); sfx.sparkle(); shake(14, .35); ring(520, 300, '#FF4D6D', 200, .5); burst(520, 300, '#FF4D6D', 22, 380); confetti(400, 250, 60); } };
  const pull = () => { up = true; };
  const g = {
    cmd: 'POP IT!', hint: 'PUMP: PRESS AND RELEASE SPACE / CLICK', thint: 'TAP TAP TAP TO PUMP', dur: 5.8,
    key(e) { if (e.code === 'Space') push(e); }, keyup(e) { if (e.code === 'Space') pull(); }, down() { push(); }, up() { pull(); },
    update(dt) {
      wob = Math.max(0, wob - dt); hy += ((up ? 0 : 1) - hy) * Math.min(1, 22 * dt);
      if (pop) pop += dt; else if (s > 0) s = Math.max(0, s - .05 * dt);
    },
    draw(tt) {
      bg('#FFE066', '#ffd93d', tt);
      ctx.fillStyle = INK; ctx.fillRect(0, 540, W, 70); ctx.fillStyle = '#7bd389'; ctx.fillRect(0, 546, W, 70);
      shadow(410, 546, 60, 9, .25); shadow(520, 548, 30 + s * 60, 8, .2); shadow(150, 544, 44, 8);
      // hose + pump
      ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(400, 490); ctx.quadraticCurveTo(500, 520, 520, 420); ctx.stroke(); ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 5; ctx.stroke();
      box(380, 480, 60, 60, '#4DB8FF', 5); box(406, 400 + hy * 70, 8, 90 - hy * 70 + 4, '#ccc', 3); box(370, 388 + hy * 70, 80, 18, '#FF4D6D', 4);
      // balloon
      const r = pop ? 0 : 40 + s * 120 + Math.sin(tt * 40) * wob * 14, bx = 520, by = 420 - r - 18;
      if (!pop) {
        const red = Math.floor(255), gg = Math.floor(120 * (1 - s)), col = `rgb(${red},${60 + gg},${150 - s * 100})`;
        ctx.save(); ctx.translate(bx, by); ctx.scale(.9, 1.05);
        circ(0, 0, r, col, 5); ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(bx - r * .35, by - r * .4, r * .12, r * .22, -.6, 0, 7); ctx.fill();
        const e = r * .3; for (const sx of [-1, 1]) { circ(bx + sx * e, by - r * .08, r * .13, '#fff', 3); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(bx + sx * e, by - r * .08, r * .06, 0, 7); ctx.fill(); }
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bx, by + r * .35, r * .16, s > .5 ? 0 : Math.PI, s > .5 ? Math.PI : 0); ctx.stroke();
        if (s > .6) for (let i = 0; i < 5; i++) { const a = -2.3 + i * .5; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * r * .8, by + Math.sin(a) * r * .8); ctx.lineTo(bx + Math.cos(a) * r * 1.05, by + Math.sin(a) * r * 1.05); ctx.stroke(); }
      } else { star(bx, by + 40, 150, 70, 12, tt, '#fff', 5); txt('BANG!', bx, by + 40, 70, '#FF4D6D'); }
      claude(150, 540, 8, { mood: wiiMood(g) });
      box(80, 580, 140, 14, '#fff', 3); ctx.fillStyle = '#FF4D6D'; ctx.fillRect(80, 580, 140 * s, 14);
    }
  };
  return g;
}

/* 7 ── STRIKE!: slash the coin only while it is in the glowing band */
function wiiStrike(sp) {
  const GY = 380, band = 52, v = 150 * sp, cx = 250 + Math.random() * 300, ph = Math.random() * 6;
  const T = { x: cx, y: -40 }, trail = []; let t = 0, hit = 0, slash = null, warn = 0, hitDir = 0;
  const g = {
    cmd: 'STRIKE!', hint: 'SWIPE ACROSS THE COIN IN THE GLOW', thint: 'SWIPE THROUGH THE COIN IN THE GLOW', dur: 5,
    move(p) {
      if (g.result) return;
      trail.push({ x: p.x, y: p.y, t }); while (trail.length && t - trail[0].t > .13) trail.shift();
      if (trail.length < 2 || t < .2) return;
      let len = 0, near = false;
      for (let i = 1; i < trail.length; i++) { len += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y); if (segD(T.x, T.y, trail[i - 1].x, trail[i - 1].y, trail[i].x, trail[i].y) < 36) near = true; }
      if (len < 130 || !near) return;
      if (Math.abs(T.y - GY) <= band) { g.result = 'win'; hit = .001; slash = trail.slice(); const a = slash[0], b = slash[slash.length - 1]; hitDir = Math.atan2(b.y - a.y, b.x - a.x); sfx.whoosh(false); sfx.hit(); sfx.coin(); shake(8, .25); burst(T.x, T.y, '#FFE14D', 18, 340); ring(T.x, T.y, '#fff', 100, .4); floatText('SLASH!', T.x, T.y - 50, '#fff', 38); }
      else { warn = .6; sfx.miss(); shake(3, .12); }
    },
    update(dt) {
      t += dt; warn = Math.max(0, warn - dt);
      if (hit) { hit += dt; return; }
      if (g.result) return;
      if (t > .3) T.y += v * dt;
      T.x = cx + Math.sin(t * 2 + ph) * 25;
      if (T.y > 570) { g.result = 'lose'; sfx.thud(); sfx.miss(); shake(8, .25); burst(T.x, 560, '#FF4D6D', 10); }
    },
    draw(tt) {
      bg('#F2E3C6', '#ecd9b4', tt);
      ctx.fillStyle = INK; ctx.fillRect(0, 500, W, 110); ctx.fillStyle = '#a8703a'; ctx.fillRect(0, 508, W, 110);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = INK; ctx.fillRect(i * 100 + 4, 508, 4, 100); }
      for (const x of [110, 690]) { box(x - 18, 60, 36, 440, '#c0392b', 5); }
      const gl = .55 + Math.sin(tt * 8) * .2;
      ctx.fillStyle = `rgba(255,225,77,${gl * .5})`; ctx.fillRect(0, GY - band, W, band * 2);
      ctx.fillStyle = INK; ctx.fillRect(0, GY - band - 3, W, 6); ctx.fillRect(0, GY + band - 3, W, 6);
      ctx.fillStyle = '#FFE14D'; ctx.fillRect(0, GY - band, W, 4); ctx.fillRect(0, GY + band - 4, W, 4);
      if (!hit) { shadow(T.x, 520, 30 - Math.min(14, (520 - T.y) / 30), 6, .2); token(T.x, T.y, 34); }
      else {
        const k = Math.min(1, hit * 3), ca = Math.cos(hitDir), sa = Math.sin(hitDir);
        for (const sg of [-1, 1]) {
          ctx.save(); ctx.translate(T.x - sa * sg * k * 40, T.y + ca * sg * k * 40 + hit * hit * 200); ctx.rotate(hitDir); ctx.beginPath(); ctx.rect(-60, sg < 0 ? -60 : 0, 120, 60); ctx.clip(); ctx.rotate(-hitDir); ctx.translate(0, 0); token(0, 0, 34); ctx.restore();
        }
        if (slash && hit < .35) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 12 * (1 - hit * 2.5); ctx.lineCap = 'round'; ctx.beginPath(); const a = slash[0], b = slash[slash.length - 1]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; ctx.moveTo(T.x - dx / l * 140, T.y - dy / l * 140); ctx.lineTo(T.x + dx / l * 140, T.y + dy / l * 140); ctx.stroke(); ctx.lineCap = 'butt'; }
      }
      if (trail.length > 1 && !g.result) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); trail.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); ctx.lineCap = 'butt'; }
      claude(110, 508, 7, { mood: wiiMood(g) });
      if (warn > 0) txt(T.y < GY ? 'TOO EARLY!' : 'TOO LATE!', W / 2, 140, 48, '#FF4D6D');
      else if (!g.result && Math.abs(T.y - GY) <= band + 40 && Math.abs(T.y - GY) > band) txt('NOW...', W / 2, 140, 44, '#fff');
      if (!g.result && Math.abs(T.y - GY) <= band) txt('NOW!', W / 2, 140, 56, '#FF2E4D');
    }
  };
  return g;
}

/* 8 ── SHAVE!: clear the stubble, dodge the mole */
function wiiShave(sp) {
  const CS = 15, X0 = 250, Y0 = 290, NC = 20, NR = 14, RR = 24, hard = sp > 1.5;
  const moles = []; const m0 = { x: 0, y: 0 };
  for (let i = 0; i < (hard ? 2 : 1); i++) {
    for (let tries = 0; tries < 30; tries++) {
      const m = { x: 310 + Math.random() * 180, y: 340 + Math.random() * 120 };
      if (Math.hypot(m.x - mouse.x, m.y - mouse.y) > 90 && moles.every(o => Math.hypot(o.x - m.x, o.y - m.y) > 100)) { moles.push(m); break; }
    }
  }
  if (!moles.length) moles.push({ x: 420, y: 420 });
  const cells = []; for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    const cx = X0 + c * CS + CS / 2, cy = Y0 + r * CS + CS / 2;
    cells.push({ x: cx, y: cy, f: 0, skip: moles.some(m => Math.hypot(m.x - cx, m.y - cy) < 42) });
  }
  const need = cells.filter(c => !c.skip).length; let lx = null, ly = 0, cut = 0, mx = W / 2, my = H / 2, cleared = 0, lastC = 0;
  const clearAt = (x, y) => { for (const c of cells) if (!c.f && Math.abs(c.x - x) < RR + 4 && Math.abs(c.y - y) < RR + 4 && Math.hypot(c.x - x, c.y - y) < RR) c.f = .8; };
  const g = {
    cmd: 'SHAVE!', hint: 'MOUSE OVER THE STUBBLE · AVOID THE MOLE', thint: 'DRAG OVER STUBBLE, AVOID MOLE', dur: hard ? 6 : 6.5,
    update(dt) {
      for (const c of cells) if (c.f > 0) c.f = Math.max(.001, c.f - dt * .6);
      cut = Math.max(0, cut - dt);
      if (g.result) return;
      mx = mouse.x; my = mouse.y;
      if (lx === null) { lx = mx; ly = my; }
      for (const m of moles) if (segD(m.x, m.y, lx, ly, mx, my) < 15 + 12) { g.result = 'lose'; cut = 1; sfx.zap(); sfx.miss(); shake(10, .3); burst(mx, my, '#FF4D6D', 16, 300); ring(mx, my, '#FF4D6D', 90, .4); return; }
      const d = Math.hypot(mx - lx, my - ly), st = Math.max(1, Math.ceil(d / 8));
      for (let i = 1; i <= st; i++) clearAt(lx + (mx - lx) * i / st, ly + (my - ly) * i / st);
      if (d > 4 && Math.random() < .3) snd(900 + Math.random() * 300, .02, 'sawtooth', .015);
      if (cleared > lastC + 20) { lastC = cleared; sfx.blip(Math.min(12, cleared / 40 | 0)); }
      lx = mx; ly = my;
      const done = cells.filter(c => !c.skip && c.f).length; cleared = done;
      if (done / need >= .9) { g.result = 'win'; sfx.coin(); sfx.sparkle(); burst(400, 340, '#fff', 20, 320); ring(400, 340, '#5CFF7A', 160, .5); floatText('SMOOTH!', 400, 250, '#5CFF7A', 44); }
    },
    draw(tt) {
      bg('#8EE3EF', '#7fd8e6', tt);
      shadow(400, 520, 190, 18, .25); box(220, 110, 360, 400, '#FFD3A5', 6); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(220, 110, 360, 12);
      for (const ex of [330, 470]) { circ(ex, 205, 26, '#fff', 4); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + (g.result === 'lose' ? 0 : (mx - 400) / 50), 205 + (g.result === 'lose' ? 4 : 0), 10, 0, 7); ctx.fill(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(300, 170); ctx.lineTo(360, 160); ctx.moveTo(440, 160); ctx.lineTo(500, 170); ctx.stroke();
      box(385, 240, 30, 40, '#f5b88a', 4);
      let done = 0;
      for (const c of cells) {
        if (c.skip) { continue; }
        if (!c.f) { ctx.fillStyle = '#3a2a26'; ctx.fillRect(c.x - 5, c.y - 5, 3, 8); ctx.fillRect(c.x + 1, c.y - 3, 3, 8); }
        else { done++; if (c.f > .3) { ctx.fillStyle = '#fff'; ctx.fillRect(c.x - 8, c.y - 8, 16, 16); } }
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(400, 420, 40, .2, Math.PI - .2); ctx.stroke(); ctx.lineCap = 'butt';
      for (const m of moles) { circ(m.x, m.y, 15, '#7a2e2e', 4); ctx.fillStyle = '#FF4D4D'; ctx.beginPath(); ctx.arc(m.x - 4, m.y - 4, 5, 0, 7); ctx.fill(); txt('!', m.x, m.y - 34 + Math.sin(tt * 8) * 3, 26, '#FF4D6D'); }
      // razor
      shadow(mx + 10, my + 8, 22, 6, .2); ctx.save(); ctx.translate(mx, my); ctx.rotate(-.6); box(-6, -80, 16, 70, '#4DB8FF', 4); box(-22, -16, 48, 20, '#ddd', 4); ctx.restore();
      if (cut > 0) { star(mx, my, 50, 20, 8, tt * 3, '#FF4D6D', 4); txt('OUCH!', W / 2, 70, 56, '#FF4D6D'); }
      box(60, 560, 200, 16, '#fff', 3); ctx.fillStyle = '#5CFF7A'; ctx.fillRect(60, 560, 200 * Math.min(1, done / need / .9), 16);
    }
  };
  return g;
}

/* 9 ── FAN IT!: wave the fan below the butterfly to keep it aloft */
function wiiFan(sp) {
  const grav = 320 * Math.pow(sp, .6), B = { x: 300 + Math.random() * 200, y: 250, vx: 0, vy: 0 }; let lx = mouse.x, ly = mouse.y, spd = 0, wind = 0, t = 0, lw = 0, ph = Math.random() * 6;
  const g = {
    cmd: 'FAN IT!', hint: 'WAVE THE MOUSE BELOW THE BUTTERFLY', thint: 'WAVE YOUR FINGER BELOW IT', dur: 5.2, timeWin: true,
    update(dt) {
      t += dt;
      const sx = (Math.abs(mouse.x - lx) + Math.abs(mouse.y - ly) * .5) / Math.max(dt, .001); lx = mouse.x; ly = mouse.y;
      spd += (Math.min(2500, sx) - spd) * Math.min(1, 12 * dt);
      if (g.result) return;
      const dx = mouse.x - B.x, near = Math.abs(dx) < 160 && mouse.y > B.y - 20 && mouse.y < B.y + 270;
      wind = near ? Math.min(1, spd / 1300) : 0;
      B.vy += (grav - wind * 1700) * dt; B.vx += (-dx * (near ? .4 : 0) * wind * .02 * 60 + Math.sin(t * 1.7 + ph) * 60) * dt;
      B.vy = Math.max(-380, Math.min(440, B.vy)); B.vx *= Math.pow(.3, dt);
      B.x += B.vx * dt; B.y += B.vy * dt; B.x = Math.max(60, Math.min(740, B.x));
      if (B.y < 80) { B.y = 80; B.vy = Math.abs(B.vy) * .3; }
      if (B.y > 515) { g.result = 'lose'; sfx.splat(); shake(7, .25); burst(B.x, 520, '#FF8FAB', 12); }
      if (wind > .35 && t - lw > .25) { lw = t; sfx.whoosh(true); }
    },
    draw(tt) {
      bg('#BDF2D0', '#aee8c4', tt);
      ctx.fillStyle = INK; ctx.fillRect(0, 530, W, 80); ctx.fillStyle = '#6fc27a'; ctx.fillRect(0, 538, W, 80);
      for (let i = 0; i < 9; i++) { const x = 40 + i * 90, h = 30 + (i * 37 % 40); ctx.fillStyle = INK; ctx.fillRect(x - 3, 536 - h, 6, h); circ(x, 536 - h, 14, ['#FF8FAB', '#FFE14D', '#C77DFF'][i % 3], 4); circ(x, 536 - h, 5, '#fff', 0); }
      shadow(B.x, 534, Math.max(10, 30 - (534 - B.y) / 14), 6, .2);
      const fl = Math.sin(tt * 22) * .8 + .2, dead = g.result === 'lose';
      ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(dead ? 1.2 : B.vx / 400);
      for (const s of [-1, 1]) { ctx.save(); ctx.scale(s * (dead ? .3 : Math.abs(fl) * .9 + .25), 1); ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(32, -12, 36, 30, -.4, 0, 7); ctx.fill(); ctx.fillStyle = '#FF8FAB'; ctx.beginPath(); ctx.ellipse(32, -12, 30, 24, -.4, 0, 7); ctx.fill(); ctx.fillStyle = '#FFE14D'; ctx.beginPath(); ctx.ellipse(34, 14, 20, 16, .3, 0, 7); ctx.fill(); ctx.restore(); }
      box(-5, -22, 10, 44, '#5b3a8a', 3); circ(0, -26, 8, '#5b3a8a', 3); ctx.restore();
      // fan
      const fx = mouse.x, fy = mouse.y; ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.sin(tt * 30) * wind * .6);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 66, -2.4, -.74); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#FFE14D'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 58, -2.4, -.74); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = -2.1 + i * .37; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 58, Math.sin(a) * 58); ctx.stroke(); }
      ctx.restore();
      if (wind > .1) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const y0 = fy - 70 - i * 30 - ((tt * 300) % 60); ctx.beginPath(); ctx.arc(fx + (i - 1) * 36, y0, 14, 0, 4.5); ctx.stroke(); } ctx.lineCap = 'butt'; }
      if (dead) txt('SPLAT...', W / 2, 300, 50, '#FF4D6D');
    }
  };
  return g;
}

/* 10 ── TWIRL!: circle the mouse to stretch the dough to the plate ring; too fast tears it */
function wiiTwirl(sp) {
  const CX = 400, CY = 330, PR = 165; let r = 62, spin = 0, w = 0, la = null, ang = 0, crack = 0, t = 0, lw = 0, lc = 0; const fl = [];
  const g = {
    cmd: 'TWIRL!', hint: 'MOUSE IN CIRCLES · NOT TOO FAST!', thint: 'DRAG IN CIRCLES, NOT TOO FAST', dur: 6.2,
    update(dt) {
      t += dt;
      if (g.result) { for (const f of fl) { f.x += f.vx * dt; f.y += f.vy * dt; f.l -= dt; } return; }
      const dx = mouse.x - CX, dy = mouse.y - CY, a = Math.atan2(dy, dx);
      let om = 0;
      if (Math.hypot(dx, dy) > 45 && la !== null) { let da = a - la; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; om = Math.max(-30, Math.min(30, da / Math.max(dt, .001))); }
      la = Math.hypot(dx, dy) > 45 ? a : null;
      w += (om - w) * Math.min(1, 9 * dt); spin += (w - spin) * Math.min(1, 4 * dt); ang += spin * dt;
      const as = Math.abs(spin);
      if (as > 1.8) { if (as < 12) r += Math.min(as, 8) * 7.5 * sp * dt; } else r -= 10 * dt;
      r = Math.max(55, r);
      if (as > 12) crack += dt * 1.1; else crack = Math.max(0, crack - dt * .5);
      if (as > 3 && Math.random() < dt * as * 3) fl.push({ x: CX + Math.cos(ang) * r, y: CY + Math.sin(ang) * r, vx: (Math.random() - .5) * 200, vy: -Math.random() * 150, l: .7 });
      for (let i = fl.length - 1; i >= 0; i--) { const f = fl[i]; f.x += f.vx * dt; f.y += f.vy * dt; if ((f.l -= dt) <= 0) fl.splice(i, 1); }
      if (r >= PR) { g.result = 'win'; sfx.pop(); sfx.sparkle(); shake(6, .2); ring(CX, CY, '#fff', 210, .5); burst(CX, CY, '#FFE14D', 20, 340); floatText('PERFECT!', CX, CY - 20, '#fff', 44); }
      else if (crack >= 1) { g.result = 'lose'; sfx.splat(); wiiBang(CX, CY); }
      if (as > 3 && t - lw > .22) { lw = t; sfx.blip(Math.min(12, r / 14 | 0)); }
      if (crack > .3 && t - lc > .3) { lc = t; sfx.buzz(); }
    },
    draw(tt) {
      bg('#FFD6A5', '#ffc891', tt);
      ctx.fillStyle = INK; ctx.fillRect(0, 520, W, 90); ctx.fillStyle = '#b5835a'; ctx.fillRect(0, 528, W, 90);
      ctx.save(); ctx.setLineDash([14, 10]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(CX, CY, PR + 12, 0, 7); ctx.stroke(); ctx.restore();
      txt('PLATE', CX, CY - PR - 34, 22, '#fff');
      shadow(CX, CY + r * .94 + 14, r * .9, r * .16, .25);
      const torn = g.result === 'lose';
      ctx.save(); ctx.translate(CX, CY); ctx.rotate(ang);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, r + 6, r * (.94 + Math.sin(tt * 6) * .02) + 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#F6D58E'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * (.94 + Math.sin(tt * 6) * .02), 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e03a3a'; for (const [a, k] of [[0, .5], [1.3, .6], [2.5, .45], [3.7, .62], [4.8, .5], [5.7, .38]]) { circ(Math.cos(a) * r * k, Math.sin(a) * r * k, r * .1, '#e03a3a', 3); }
      if (crack > .05) { ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * 1.57 + .5; ctx.moveTo(Math.cos(a) * r * .3, Math.sin(a) * r * .3); ctx.lineTo(Math.cos(a + .2) * r * (.3 + crack * .6), Math.sin(a + .2) * r * (.3 + crack * .6)); } ctx.stroke(); }
      if (torn) { ctx.fillStyle = '#FFD6A5'; ctx.fillRect(-r - 10, -8, 2 * r + 20, 16); }
      ctx.restore();
      ctx.fillStyle = '#fff'; for (const f of fl) ctx.fillRect(f.x, f.y, 6, 6);
      claude(110, 520, 8, { mood: wiiMood(g) }); box(70, 395, 80, 14, '#fff', 3); box(80, 365, 60, 30, '#fff', 3);
      if (crack > .3 && !g.result) txt('TOO FAST!', W / 2, 90, 46, '#FF4D6D');
      if (torn) txt('RIIIP!', W / 2, 90, 56, '#FF4D6D');
      box(600, 560, 160, 14, '#fff', 3); ctx.fillStyle = '#5CFF7A'; ctx.fillRect(600, 560, 160 * Math.min(1, (r - 62) / (PR - 62)), 14);
    }
  };
  return g;
}

/* 11 ── ROLL!: keep the ball under the acrobat */
function wiiRoll(sp) {
  const BY = 470, BR = 48; let tx = Math.max(220, Math.min(580, mouse.x)), bx = tx, gx = bx + (Math.random() < .5 ? -1 : 1) * 10, gv = 0, ang = 0; const ph = Math.random() * 6; let t = 0, lw = 0;
  const g = {
    cmd: 'ROLL!', hint: 'MOUSE / ← → ROLLS THE BALL UNDER HIM', thint: 'DRAG TO ROLL THE BALL', dur: 5, timeWin: true,
    move(p) { tx = p.x; },
    update(dt) {
      t += dt;
      if (keys.ArrowLeft || keys.KeyA) tx -= 600 * dt; if (keys.ArrowRight || keys.KeyD) tx += 600 * dt;
      tx = Math.max(60, Math.min(740, tx));
      const old = bx; bx += Math.max(-520 * dt, Math.min(520 * dt, tx - bx)); ang += (bx - old) / BR;
      if (g.result) return;
      const d = gx - bx; gv += (d * 7 * sp + Math.sin(t * 2.1 + ph) * 45 * sp) * dt; gv *= Math.pow(.5, dt); gx += gv * dt;
      if (Math.abs(d) > 54) { g.result = 'lose'; sfx.thud(); sfx.miss(); shake(9, .3); burst(gx, 440, '#FF4D6D', 14); }
      else if (Math.abs(d) > 40 && t - lw > .35) { lw = t; sfx.blip(-7); }
    },
    draw(tt) {
      bg('#FF9EB5', '#ff8fa9', tt);
      ctx.fillStyle = '#FFE14D'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 100, 0); ctx.lineTo(i * 100 + 50, 0); ctx.lineTo(W / 2 + (i - 4) * 12, 120); ctx.fill(); }
      ctx.fillStyle = INK; ctx.fillRect(0, 516, W, 90); ctx.fillStyle = '#9b6bd1'; ctx.fillRect(0, 524, W, 90);
      shadow(bx, BY + BR + 6, BR * .95, 9, .28);
      ctx.save(); ctx.translate(bx, BY); ctx.rotate(ang);
      circ(0, 0, BR, '#fff', 5); ctx.fillStyle = '#FF4D6D'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, BR, i * 1.57, i * 1.57 + .785); ctx.fill(); }
      ctx.restore(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bx, BY, BR, 0, 7); ctx.stroke();
      const d = gx - bx, fall = g.result === 'lose';
      ctx.save(); ctx.translate(gx, BY - BR + 2 + (fall ? Math.min(60, 200 * Math.max(0, Math.abs(d) - 54) / 10) : 0)); ctx.rotate(fall ? Math.sign(d) * 1.4 : Math.max(-.6, Math.min(.6, d / 70)));
      claude(0, 0, 7, { mood: wiiMood(g) }); ctx.restore();
      ctx.fillStyle = INK; ctx.fillRect(bx - 40, 560, 80, 8); ctx.fillStyle = '#5CFF7A'; ctx.fillRect(gx - 4, 556, 8, 16);
    }
  };
  return g;
}

/* 12 ── CLOSE IT!: pull the shutter down before the customer gets in */
function wiiClose(sp) {
  const SY0 = 150, SY1 = 466, DX = 300; let sy = SY0, grab = false, g0 = 0, s0 = 0, cx = -40, t = 0, bump = 0, lw = 0;
  const v = 175 * Math.sqrt(sp);
  const g = {
    cmd: 'CLOSE IT!', hint: 'DRAG THE SHUTTER DOWN FAST', thint: 'PULL DOWN FAST', dur: 5,
    down(p) { if (g.result) return; grab = true; g0 = p.y; s0 = sy; sfx.click(); },
    move(p) { if (grab && !g.result) { sy = Math.max(SY0, Math.min(SY1, s0 + p.y - g0)); } },
    up() { grab = false; },
    update(dt) {
      t += dt; if (g.result) { bump += dt; return; }
      if (keys.ArrowDown || keys.KeyS || keys.Space) sy = Math.min(SY1, sy + 700 * dt);
      else if (!grab && sy < SY1) sy = Math.max(SY0, sy - 40 * dt);
      if (sy >= SY1 - 2) { sy = SY1; g.result = 'win'; sfx.stamp(); sfx.thud(); shake(12, .3); burst(400, SY1, '#fff', 16, 300); ring(400, SY1, '#FFE14D', 150, .4); floatText('CLOSED!', 400, 120, '#FFE14D', 40); return; }
      if (t > .3) { cx += v * dt; if (t - lw > .28) { lw = t; sfx.tick(); } }
      if (cx >= DX) { g.result = 'lose'; sfx.miss(); wiiBang(DX, 480); }
    },
    draw(tt) {
      bg('#B5D8FF', '#a3ccf7', tt);
      ctx.fillStyle = INK; ctx.fillRect(0, 500, W, 110); ctx.fillStyle = '#9aa0ad'; ctx.fillRect(0, 508, W, 110);
      box(180, 70, 440, 430, '#FFD6A5', 6); box(210, 150, 380, 330, '#3a2a4a', 4);
      // inside shop
      box(250, 400, 120, 70, '#a8703a', 4); circ(520, 390, 40, '#FFE14D', 4); txt('$', 520, 392, 40, INK);
      // shutter
      ctx.fillStyle = INK; ctx.fillRect(206, SY0 - 4, 388, sy - SY0 + 8);
      for (let y = SY0; y < sy; y += 22) { ctx.fillStyle = (((y - SY0) / 22) | 0) % 2 ? '#aab4c4' : '#c3cbd8'; ctx.fillRect(210, y, 380, Math.min(20, sy - y)); }
      box(330, sy - 2, 140, 14, '#7a8497', 4);
      box(180, 70, 440, 70, '#FF4D6D', 6); for (let i = 0; i < 8; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(184 + i * 55, 74, 27, 62); }
      const closed = g.result === 'win'; box(350, 160 + 0, 100, 32, closed ? '#FF4D6D' : '#5CFF7A', 4); txt(closed ? 'CLOSED' : 'OPEN', 400, 177, 22, '#fff');
      // customer
      const lose = g.result === 'lose', x = lose ? DX + 20 + Math.min(1, bump * 3) * 110 : cx, bounce = closed ? Math.min(1, bump * 6) * -30 : 0;
      shadow(Math.min(x, closed ? DX : x) + bounce, 504, 34, 7);
      claude(Math.min(x, closed ? DX : x) + bounce, 500, 6, { col: '#4DB8FF', run: lose || closed ? null : tt, mood: lose ? 'happy' : closed ? 'sad' : null });
      if (!closed && !lose && cx > DX - 160) txt('!', cx, 400, 40, '#FF4D6D');
      if (closed) txt('PHEW!', W / 2, 40, 44, '#fff');
    }
  };
  return g;
}

reg('wii_save', wiiSave, 'SAVE ME!');
reg('wii_zap', wiiZap, 'ZAP!');
reg('wii_draw', wiiDraw, 'DRAW!');
reg('wii_sneak', wiiSneak, 'SNEAK!');
reg('wii_umbrella', wiiUmbrella, 'UMBRELLA!');
reg('wii_pop', wiiPop, 'POP IT!');
reg('wii_strike', wiiStrike, 'STRIKE!');
reg('wii_shave', wiiShave, 'SHAVE!');
reg('wii_fan', wiiFan, 'FAN IT!');
reg('wii_twirl', wiiTwirl, 'TWIRL!');
reg('wii_roll', wiiRoll, 'ROLL!');
reg('wii_close', wiiClose, 'CLOSE IT!');
