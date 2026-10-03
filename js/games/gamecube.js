'use strict';
/* GameCube wave — WarioWare Mega Party Game$ inspired microgames.
   Timelines run on "game seconds" (dt * sqrt(sp)) so they always fit inside dur (the engine uses dur / sqrt(sp)). */
const gcClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gcMood = g => g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null;
const gcLose = g => { if (!g.result) { g.result = 'lose'; sfx.buzz(); shake(7, .25); } };
const gcWin = g => { if (!g.result) { g.result = 'win'; sfx.coin(); } };

/* ───────── 1 ── SOLE MAN: dodge the giant stomping foot ───────── */
function gcSole(sp) {
  const k = Math.sqrt(sp), n = sp > 1.5 ? 3 : 2, gap = n === 2 ? 1.9 : 1.5;
  const me = { x: 400, y: 450 }; let tx = 400, ty = 450, c = 0, squash = 0;
  const stomps = [], rings = [];
  for (let i = 0; i < n; i++) stomps.push({ s: .5 + i * gap, x: 0, y: 0, init: false, hit: false, thoom: 0, w: false });
  const g = {
    wide: true,
    cmd: 'MOVE!', hint: 'DODGE THE FOOT: MOUSE OR ARROWS', thint: 'DRAG TO DODGE THE FOOT', dur: 5, timeWin: true,
    move(p) { tx = p.x; ty = p.y; },
    update(dt) {
      const ts = dt * k; squash = g.result === 'lose' ? Math.min(1, squash + dt * 6) : 0;
      for (let i = rings.length - 1; i >= 0; i--) { rings[i].r += 380 * dt; rings[i].a -= dt * 1.6; if (rings[i].a <= 0) rings.splice(i, 1); }
      if (g.result) { for (const s of stomps) s.thoom = Math.max(0, s.thoom - dt); return; }
      c += ts;
      const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
      if (kx || ky) { tx = me.x += kx * 340 * ts; ty = me.y += ky * 340 * ts; }
      else { const dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 430 * ts); me.x += dx / d * m; me.y += dy / d * m; }
      me.x = gcClamp(me.x, 40 - OX, W - 40 + OX); me.y = gcClamp(me.y, 360, 535);
      for (const s of stomps) {
        const u = c - s.s; s.thoom = Math.max(0, s.thoom - dt);
        if (u < 0) continue;
        if (!s.init) { s.init = true; s.x = gcClamp(me.x + (me.x < 400 ? 160 : -160), 80 - OX, W - 80 + OX); s.y = gcClamp(me.y - 70, 380, 520); }
        if (u < 1.1) { s.x += (me.x - s.x) * Math.min(1, 3.4 * ts); s.y += (me.y - s.y) * Math.min(1, 3.4 * ts); }
        if (u >= 1.1 && !s.w) { s.w = true; sfx.whoosh(false); }
        if (u >= 1.55 && !s.hit) {
          s.hit = true; shake(12, .35); s.thoom = .7; rings.push({ x: s.x, y: s.y, r: 20, a: 1 }); sfx.thud(); burst(s.x, s.y, '#f6ead0', 12, 220);
          const dx = (me.x - s.x) / 66, dy = (me.y - s.y) / 40;
          if (dx * dx + dy * dy < 1) { gcLose(g); sfx.splat(); floatText('SQUISH!', me.x, me.y - 60, '#ff4d6d', 40); }
        }
      }
    },
    draw(t) {
      bg('#9BE7FF', '#8bdcf5', t);
      ctx.save();
      ctx.fillStyle = INK; ctx.fillRect(-OX, 326, VW, H); ctx.fillStyle = '#8fd36a'; ctx.fillRect(-OX, 332, VW, H);
      for (let i = -Math.ceil(OX / 70); i < 12 + Math.ceil(OX / 70); i++) { ctx.fillStyle = '#7bc45a'; ctx.fillRect(30 + i * 70, 350 + ((i + 20) * 37) % 180, 26, 8); }
      for (const s of stomps) {
        const u = c - s.s; if (!s.init || u > 2) continue;
        const flash = u > 1.1 && u < 1.55 && Math.floor(u * 16) % 2 === 0;
        ctx.fillStyle = flash ? '#ff3b3b' : 'rgba(20,16,28,.4)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 70, 40, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
      }
      for (const r of rings) { ctx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, r.a) + ')'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * .55, 0, 0, 7); ctx.stroke(); }
      shadow(me.x, me.y + 6, 30 * (1 + squash * .5), 9, .3);
      ctx.save(); ctx.translate(me.x, me.y); ctx.scale(1 + squash * .5, 1 - squash * .75); claude(0, 0, 4.5, { mood: gcMood(g) }); ctx.restore();
      for (const s of stomps) {
        const u = c - s.s; if (!s.init) continue;
        let h;
        if (u < 0) continue; else if (u < 1.1) h = 330 - 110 * (u / 1.1); else if (u < 1.55) h = 220 * (1 - gcClamp((u - 1.43) / .12, 0, 1)); else if (u < 1.95) h = 0; else h = (u - 1.95) * 1000;
        if (h > 700) continue;
        let wob = u > 1.1 && u < 1.43 ? Math.sin(now * 60) * 3 : 0;
        const x = s.x + wob, y = s.y - h + 28;
        box(x - 46, -30, 92, y - 100 + 30, '#fff', 5);
        for (let j = 0; j < 8; j++) { ctx.fillStyle = '#ff4d6d'; ctx.fillRect(x - 46, 10 + j * 40 + (y > 200 ? 0 : 0), 92, 14); if (y - 100 < j * 40 + 30) break; }
        box(x - 82, y - 26, 176, 26, '#fff', 5);
        box(x - 82, y - 84, 112, 62, '#4DB8FF', 5); box(x + 20, y - 58, 74, 36, '#4DB8FF', 5);
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath();
        for (let j = 0; j < 3; j++) { ctx.moveTo(x - 10 + j * 22, y - 84); ctx.lineTo(x - 2 + j * 22, y - 62); }
        ctx.stroke();
        ctx.strokeStyle = '#7bd35a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let q = 0; q <= 8; q++) ctx.lineTo(x - 80 + j * 90 + Math.sin(now * 8 + q + j) * 6, y - 100 - q * 9); ctx.stroke(); }
        ctx.lineCap = 'butt';
        if (s.thoom > 0) txt('THOOM!', s.x, s.y - 70, 54 + (s.thoom * 20), '#FFE14D');
      }
      ctx.restore();
    }
  };
  return g;
}

/* ───────── 2 ── RAGING RHINO: whip the cape at the last moment ───────── */
function gcRhino(sp) {
  const k = Math.sqrt(sp), two = sp > 1.5, CX = 590, GY = 470;
  const starts = [.7, 3.1], vs = [240, 320], N = two ? 2 : 1, ZONE = 160; // ZONE: how far out (px) the cape still counts
  let c = 0, idx = 0, sw = 0, cd = 0, fling = 0, hopT = 0; const rh = { x: -190 - OX, swiped: false, gone: false }; const dust = [];
  const gapOf = () => (CX - 40) - (rh.x + 95);
  const g = {
    wide: true,
    cmd: 'OLE!', hint: 'CLICK/SPACE WHEN THE RHINO IS IN THE ZONE', thint: 'TAP WHEN THE RHINO IS IN THE ZONE', dur: two ? 5.8 : 5,
    key(e) { if (e.code === 'Space') g.cape(); }, down() { g.cape(); },
    cape() {
      if (g.result || cd > 0 || idx >= N || c < starts[idx] || rh.swiped) return;
      cd = .3; sw = .001; sfx.whoosh();
      const gp = gapOf();
      if (gp > ZONE) { sfx.miss(); floatText('TOO EARLY!', CX - 60, GY - 170, '#fff', 30); }   // early swish is free: just wait and try again
      else { rh.swiped = true; hopT = .001; sfx.hit(); burst(CX - 60, GY - 60, '#e8232f', 12); ring(CX - 60, GY - 60, '#fff', 70); floatText(idx === N - 1 ? 'OLE!' : 'NICE!', CX, GY - 170, '#FFE14D', 38); if (idx === N - 1) gcWin(g); }
    },
    update(dt) {
      const ts = dt * k; c += ts; cd = Math.max(0, cd - ts);
      if (sw > 0) { sw += dt * 4; if (sw > 1) sw = 0; } if (hopT > 0) { hopT += dt * 1.6; if (hopT > 1) hopT = 0; }
      for (let i = dust.length - 1; i >= 0; i--) { dust[i].r += dt * 40; dust[i].a -= dt * 2; dust[i].y -= dt * 20; if (dust[i].a <= 0) dust.splice(i, 1); }
      if (idx < N && c >= starts[idx]) {
        rh.x += vs[idx] * ts * (645 + OX) / 645;   // wider run-up, scaled so it still reaches the cape in the same time
        if (Math.random() < .5) dust.push({ x: rh.x - 70, y: GY - 6, r: 10, a: .9 });
        if (!rh.swiped && !g.result && gapOf() <= -8) gcLose(g);
        if (g.result === 'lose' && rh.x + 95 >= CX - 40 && !fling) { fling = .001; sfx.thud(); sfx.boing(); shake(12, .35); burst(CX, GY - 40, '#fff', 16); }
        if (rh.x > W + OX + 200) { idx++; rh.x = -190 - OX; rh.swiped = false; }
      }
      if (fling) fling += dt;
    },
    draw(t) {
      bg('#FFD36B', '#ffc94d', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, GY - 4, VW, 140); ctx.fillStyle = '#e8b866'; ctx.fillRect(-OX, GY, VW, 140);
      const run = idx < N && c >= starts[idx], warn = idx < N && !run && c > starts[idx] - .55;
      const inZone = run && !rh.swiped && !g.result && gapOf() <= ZONE;
      ctx.globalAlpha = inZone ? .75 + Math.sin(now * 30) * .2 : .35; ctx.fillStyle = inZone ? '#FFE14D' : '#fff';
      ctx.fillRect(CX - 40 - ZONE, GY + 8, ZONE, 26); ctx.globalAlpha = 1;
      if (inZone) txt('NOW!', CX - 40 - ZONE / 2, GY + 80, 44, '#e8232f');
      if (warn) { txt('!', 70 - OX / 2, 330 + Math.sin(now * 40) * 4, 90, '#ff3b3b'); }
      for (const d of dust) { ctx.globalAlpha = Math.max(0, d.a); circ(d.x, d.y, d.r, '#f6ead0', 3); } ctx.globalAlpha = 1;
      if (run) {
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 6;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(rh.x - 120 - i * 10, GY - 150 + i * 36); ctx.lineTo(rh.x - 200 - i * 10, GY - 150 + i * 36); ctx.stroke(); }
        shadow(rh.x + 20, GY + 4, 110, 14, .3);
        const x = rh.x, y = GY - 8 + Math.sin(now * 30) * 3, lg = Math.sin(now * 30);
        for (let i = 0; i < 4; i++) { const lx = x - 60 + i * 38 + (i % 2 ? lg : -lg) * 12; box(lx, y - 40, 24, 40, '#6c7a96', 4); }
        box(x - 80, y - 118, 160, 84, '#8d99ae', 5);
        box(x + 56, y - 108, 68, 64, '#8d99ae', 5);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(x + 100, y - 108); ctx.lineTo(x + 138, y - 140); ctx.lineTo(x + 122, y - 100); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 102, y - 108); ctx.lineTo(x + 132, y - 134); ctx.lineTo(x + 118, y - 104); ctx.fill();
        box(x + 56, y - 126, 22, 22, '#6c7a96', 3);
        ctx.fillStyle = '#fff'; ctx.fillRect(x + 92, y - 96, 14, 14); ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x + 98, y - 92, 7, 8);
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 86, y - 104); ctx.lineTo(x + 108, y - 96); ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 80, y - 90); ctx.lineTo(x - 98, y - 100 + lg * 6); ctx.stroke();
      }
      if (!fling) shadow(CX, GY + 6, 46 - (hopT ? Math.sin(hopT * Math.PI) * 14 : 0), 10, .3);
      let cx = CX, cy = GY, rot = 0;
      if (fling) { cx += fling * 420; cy -= Math.sin(Math.min(1, fling * 1.1) * Math.PI) * 220 - 0; rot = fling * 9; }
      if (hopT) cy -= Math.sin(hopT * Math.PI) * 60;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); claude(0, 0, 7, { mood: gcMood(g) }); ctx.restore();
      // cape
      const hx = cx - 52, hy = cy - 50;
      if (!fling) {
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(-Math.sin(sw * Math.PI) * 1.0 + .1);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-100, -14); ctx.lineTo(-104, 66); ctx.lineTo(-6, 58); ctx.closePath(); ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = '#e8232f'; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-100, -14 + Math.sin(now * 9) * 4); ctx.lineTo(-104, 66); ctx.lineTo(-6, 58); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      if (g.result === 'win') txt('OLE!', 300, 180, 70, '#FFE14D');
      if (g.result === 'lose') txt('OUCH!', 300, 180, 70, '#ff4d4d');
    }
  };
  return g;
}

/* ───────── 3 ── HOGAN'S ALLEY: shoot bandits, spare civilians ───────── */
function gcAlley(sp) {
  const k = Math.sqrt(sp), CXS = [160, 400, 640], WTOP = 190, WBOT = 400;
  const roles = shuffle(['B', 'B', 'B', 'C', 'C']);
  const T = roles.map((r, i) => ({ r, s: .5 + i * .85, slot: -1, u: -1, hit: 0, shot: false }));
  let c = 0, kills = 0, boom = 0, boomX = 0; const flashes = [];
  const g = {
    wide: true,
    cmd: 'SHOOT!', hint: 'CLICK BANDITS, NOT CIVILIANS', thint: 'TAP BANDITS, NOT CIVILIANS', dur: 5.6,
    down(p) {
      if (g.result) return; flashes.push({ x: p.x, y: p.y, a: 1 }); sfx.pop(); ring(p.x, p.y, '#fff', 30, .25);
      for (const q of T) {
        if (q.slot < 0 || q.hit || q.u < 0) continue;
        const pop = Math.min(1, q.u / .25), off = (1 - pop) * 170, lat = (q.r === 'C' && q.u > 1.5) ? Math.min(1, (q.u - 1.5) / .2) * 170 : 0;
        const cx = CXS[q.slot];
        if (Math.abs(p.x - cx) < 52 && p.y > WBOT - 150 + off + lat && p.y < WBOT && p.y > WTOP) {
          q.hit = .001; burst(p.x, p.y, q.r === 'B' ? '#FFE14D' : '#ff9fcd', 12);
          if (q.r === 'C') { sfx.miss(); shake(8, .25); floatText('OOPS!', cx, 250, '#ff4d6d'); gcLose(g); } else { sfx.hit(); floatText('+1', cx, 250, '#FFE14D', 44); if (++kills === 3) gcWin(g); }
          return;
        }
      }
    },
    update(dt) {
      const ts = dt * k; for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].a -= dt * 5; if (flashes[i].a <= 0) flashes.splice(i, 1); }
      boom = Math.max(0, boom - dt);
      for (const q of T) if (q.hit) q.hit += dt * 2.5;
      if (g.result) return;
      c += ts;
      for (const q of T) {
        if (q.slot < 0) {
          if (c >= q.s) {
            const free = [0, 1, 2].filter(s => !T.some(o => o.slot === s && o.u >= 0 && !o.hit && !o.gone));
            if (free.length) { q.slot = free[Math.random() * free.length | 0]; q.u = 0; sfx.blip(q.r === 'B' ? 0 : 7); }
          }
          continue;
        }
        if (q.hit) continue;
        q.u += ts;
        if (q.r === 'B' && q.u >= 1.1) { boom = .6; boomX = CXS[q.slot]; gcLose(g); sfx.zap(); shake(10, .3); burst(boomX, 300, '#FFE14D', 14); }
        if (q.r === 'C' && q.u > 1.75) { q.gone = true; q.u = -1; q.slot = 9; }
      }
    },
    draw(t) {
      bg('#E3B77A', '#d9a96a', t);
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-OX, 140, VW, 300); ctx.fillStyle = INK; ctx.fillRect(-OX, 130, VW, 12);
      for (let i = 0; i < 24; i++) { ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(-OX, 150 + i * 13, VW, 3); }
      txt('SALOON', 400, 90, 56, '#FFE14D'); ctx.fillStyle = INK; ctx.fillRect(190, 118, 420, 8);
      for (let s = 0; s < 3; s++) {
        const cx = CXS[s];
        box(cx - 95, WTOP, 190, WBOT - WTOP, '#2b1f35', 6);
        ctx.save(); ctx.beginPath(); ctx.rect(cx - 95, WTOP, 190, WBOT - WTOP); ctx.clip();
        for (const q of T) {
          if (q.slot !== s || q.u < 0) continue;
          const pop = Math.min(1, q.u / .25), lat = (q.r === 'C' && q.u > 1.5) ? Math.min(1, (q.u - 1.5) / .2) * 170 : 0;
          const hitK = q.hit ? Math.min(1, q.hit) : 0;
          const off = (1 - pop) * 170 + lat + hitK * 170, by = WBOT + off, bob = q.hit ? 0 : Math.sin(now * 6 + s) * 2;
          ctx.save(); ctx.translate(cx, by + 4); ctx.rotate(hitK * .9 * (s - 1 || 1));
          box(-6, -60, 12, 80, '#c89a5a', 3);
          box(-44, -150 + bob, 88, 100, q.r === 'B' ? '#6b6b7a' : '#ff9fcd', 5);
          circ(0, -150 + bob, 30, '#f5c9a0', 4);
          if (q.r === 'B') {
            box(-40, -192 + bob, 80, 14, '#222', 4); box(-24, -212 + bob, 48, 24, '#222', 3);
            box(-30, -146 + bob, 60, 22, '#e8232f', 3);
            ctx.fillStyle = INK; ctx.fillRect(-14, -164 + bob, 8, 8); ctx.fillRect(8, -164 + bob, 8, 8);
            box(30, -118 + bob, 48, 14, '#444', 3);
            const fl = q.u > .3 && Math.floor(q.u * 18) % 2 === 0; if (fl) { ctx.fillStyle = 'rgba(255,59,59,.55)'; ctx.fillRect(-50, -220 + bob, 100, 130); }
          } else {
            box(-38, -196 + bob, 76, 12, '#e8c15a', 4); box(-22, -218 + bob, 44, 26, '#e8c15a', 3);
            circ(-26, -118 + bob, 10, '#ff4d9e', 2); circ(-10, -112 + bob, 10, '#ffd23f', 2); circ(-18, -126 + bob, 8, '#fff', 2);
            ctx.fillStyle = INK; ctx.fillRect(-14, -160 + bob, 8, 8); ctx.fillRect(8, -160 + bob, 8, 8);
            ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -148 + bob, 9, .2, Math.PI - .2); ctx.stroke();
          }
          ctx.restore();
        }
        ctx.restore();
        box(cx - 110, WBOT, 220, 16, '#5a3418', 5);
        box(cx - 110, WTOP - 22, 220, 16, '#5a3418', 5);
      }
      if (boom > 0) { star(boomX + 30, 300, 70, 30, 8, now * 3, '#FFE14D', 5); txt('BANG!', boomX, 250, 56, '#ff3b3b'); }
      ctx.fillStyle = INK; ctx.fillRect(-OX, 462, VW, 140); ctx.fillStyle = '#9b6a3a'; ctx.fillRect(-OX, 468, VW, 140);
      claude(400, 556, 5, { mood: gcMood(g) });
      box(412, 520, 34, 10, '#444', 3);
      for (let i = 0; i < 3; i++) star(60 - OX / 2 + i * 44, 500, 16, 7, 5, -Math.PI / 2, i < kills ? '#FFE14D' : '#4a4558', 3);
      for (const f of flashes) { ctx.globalAlpha = f.a; circ(f.x, f.y, 14, '#fff', 0); } ctx.globalAlpha = 1;
      const m = TOUCH ? null : mouse;
      const mx = flashes.length ? flashes[flashes.length - 1].x : mouse.x, my = flashes.length ? flashes[flashes.length - 1].y : mouse.y;
      const cp = m || { x: mx, y: my };
      ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(cp.x, cp.y, 22, 0, 7); ctx.moveTo(cp.x - 36, cp.y); ctx.lineTo(cp.x + 36, cp.y); ctx.moveTo(cp.x, cp.y - 36); ctx.lineTo(cp.x, cp.y + 36); ctx.stroke();
      ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 4; ctx.stroke();
    }
  };
  return g;
}

/* ───────── 4 ── PINBALL: keep a ball in play ───────── */
function gcSegHit(b, ax, ay, bx, by, th, e, pv) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const kk = gcClamp(((b.x - ax) * dx + (b.y - ay) * dy) / l2, 0, 1), cx = ax + kk * dx, cy = ay + kk * dy;
  let nx = b.x - cx, ny = b.y - cy; const d = Math.hypot(nx, ny), R = b.r + th;
  if (d >= R) return false;
  if (d < 1e-6) { nx = 0; ny = -1; } else { nx /= d; ny /= d; }
  b.x = cx + nx * R; b.y = cy + ny * R;
  const sv = pv ? pv(cx, cy) : [0, 0], vn = (b.vx - sv[0]) * nx + (b.vy - sv[1]) * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
  return true;
}
function gcPinball(sp) {
  const k = Math.sqrt(sp), LX = 140, RX = 660, TOPY = 85, L = 118;
  const fl = [{ px: 272, py: 500, a: .5, dir: 1, on: false }, { px: 528, py: 500, a: .5, dir: -1, on: false }];
  const bumps = [{ x: 340, y: 230, r: 30, f: 0 }, { x: 460, y: 230, r: 30, f: 0 }, { x: 400, y: 330, r: 26, f: 0 }];
  const balls = []; let c = 0, spawned = 0, score = 0;
  const spawn = () => { balls.push({ x: 380 + Math.random() * 40, y: 112, vx: (Math.random() - .5) * 260, vy: 80, r: 12, alive: true }); spawned++; sfx.whoosh(); };
  const tipOf = f => [f.px + f.dir * L * Math.cos(f.a), f.py + L * Math.sin(f.a)];
  const setF = (i, v) => { if (v && !fl[i].on) sfx.click(); fl[i].on = v; };
  const g = {
    wide: true,
    cmd: 'BOUNCE!', hint: '← → (OR A D) FLIP: KEEP A BALL IN PLAY', thint: 'TAP LEFT / RIGHT HALF', dur: 5, timeWin: true,
    key(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') setF(0, true); if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Slash') setF(1, true); if (e.code === 'Space') { setF(0, true); setF(1, true); } },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') setF(0, false); if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Slash') setF(1, false); if (e.code === 'Space') { setF(0, false); setF(1, false); } },
    down(p) { setF(p.x < W / 2 ? 0 : 1, true); }, up() { setF(0, false); setF(1, false); },
    update(dt) {
      const ts = dt * k; if (!g.result) c += ts;
      if (c > .05 && spawned === 0) spawn(); if (c > .7 && spawned === 1) spawn();
      const om = [0, 0];
      fl.forEach((f, i) => {
        const tgt = f.on ? -.5 : .5, old = f.a, step = 17 * ts; f.a += gcClamp(tgt - f.a, -step, step);
        om[i] = ts > 0 ? (f.a - old) / ts * (f.dir === 1 ? 1 : -1) : 0;
      });
      for (const b of bumps) b.f = Math.max(0, b.f - dt * 4);
      const N = 5, h = ts / N;
      for (const b of balls) {
        if (!b.alive) continue;
        for (let s = 0; s < N; s++) {
          b.vy += 820 * h; b.x += b.vx * h; b.y += b.vy * h;
          if (b.x < LX + b.r) { b.x = LX + b.r; b.vx = Math.abs(b.vx) * .8; } if (b.x > RX - b.r) { b.x = RX - b.r; b.vx = -Math.abs(b.vx) * .8; }
          if (b.y < TOPY + b.r) { b.y = TOPY + b.r; b.vy = Math.abs(b.vy) * .8; }
          gcSegHit(b, LX, 395, 262, 495, 4, .5); gcSegHit(b, RX, 395, 538, 495, 4, .5);
          fl.forEach((f, i) => { const t2 = tipOf(f); gcSegHit(b, f.px, f.py, t2[0], t2[1], 10, .35, (cx, cy) => [-om[i] * (cy - f.py), om[i] * (cx - f.px)]); });
          for (const bp of bumps) {
            const dx = b.x - bp.x, dy = b.y - bp.y, d = Math.hypot(dx, dy), R = b.r + bp.r;
            if (d < R) { const nx = dx / (d || 1), ny = dy / (d || 1); b.x = bp.x + nx * R; b.y = bp.y + ny * R; const sp2 = Math.max(430, Math.hypot(b.vx, b.vy)); b.vx = nx * sp2; b.vy = ny * sp2; bp.f = 1; score++; sfx.blip(5 + score % 5 * 2); burst(bp.x + nx * bp.r, bp.y + ny * bp.r, '#FFE14D', 6, 180); if (score % 5 === 0) floatText('+5', bp.x, bp.y - 40, '#fff', 30); }
          }
          const v = Math.hypot(b.vx, b.vy); if (v > 1000) { b.vx *= 1000 / v; b.vy *= 1000 / v; }
        }
        if (b.y > 585) { b.alive = false; sfx.miss(); shake(4, .15); }
      }
      if (!g.result && spawned >= 2 && !balls.some(b => b.alive)) gcLose(g);
    },
    draw(t) {
      bg('#B58CFF', '#a97bf5', t);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(LX - 6, TOPY - 6); ctx.lineTo(RX + 6, TOPY - 6); ctx.lineTo(RX + 6, 395); ctx.lineTo(540, 500); ctx.lineTo(262, 500); ctx.lineTo(LX - 6, 395); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2d1f5c'; ctx.beginPath(); ctx.moveTo(LX, TOPY); ctx.lineTo(RX, TOPY); ctx.lineTo(RX, 395); ctx.lineTo(538, 495); ctx.lineTo(262, 495); ctx.lineTo(LX, 395); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(160 + (i * 97) % 480, 100 + (i * 53) % 280, 6, 6); }
      ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(LX, 395); ctx.lineTo(262, 495); ctx.moveTo(RX, 395); ctx.lineTo(538, 495); ctx.stroke();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6; ctx.stroke(); ctx.lineCap = 'butt';
      circ(400, 100, 14, INK, 0);
      for (const bp of bumps) { circ(bp.x, bp.y, bp.r + bp.f * 6, bp.f > .3 ? '#FFE14D' : '#ff4d9e', 5); circ(bp.x, bp.y, bp.r * .4, '#fff', 0); }
      fl.forEach(f => {
        const t2 = tipOf(f); ctx.lineCap = 'round';
        ctx.strokeStyle = INK; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(t2[0], t2[1]); ctx.stroke();
        ctx.strokeStyle = OR; ctx.lineWidth = 18; ctx.stroke(); ctx.lineCap = 'butt'; circ(f.px, f.py, 7, '#fff', 3);
      });
      for (const b of balls) if (b.alive) { shadow(b.x + 5, b.y + 9, b.r, b.r * .4, .3); circ(b.x, b.y, b.r, '#e6eefc', 4); ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 6, b.y - 7, 5, 5); }
      claude(70, 330, 6, { mood: gcMood(g) });
      txt('LEFT', 60, 470, 22, '#fff'); txt('RIGHT', 740, 470, 22, '#fff');
      box(30, 395, 80, 50, '#fff', 4); txt('' + score, 70, 421, 30, INK);
    }
  };
  return g;
}

/* ───────── 5 ── BATTER UP: one swing ───────── */
function gcBatter(sp) {
  const k = Math.sqrt(sp), T = 1.35 + Math.random() * .4, S = .8, curve = sp > 1.3 ? (Math.random() < .5 ? -1 : 1) * Math.min(120, 40 + sp * 30) : 0;
  let c = 0, swung = false, swT = 0, hit = false, flyT = 0, crowd = 0, miss = false;
  const zOf = () => (c - S) / T;
  const swing = () => {
    if (swung || g.result || c < .15) return; swung = true; swT = .001; sfx.whoosh();
    const z = zOf();
    if (z >= .88 && z <= 1.02) { hit = true; crowd = 1; gcWin(g); sfx.hit(); sfx.stamp(); sfx.sparkle(); shake(14, .35); burst(400, 470, '#FFE14D', 22, 340); ring(400, 470, '#fff', 120); floatText('NICE!', 400, 400, '#FFE14D', 50); } else { miss = true; gcLose(g); sfx.miss(); floatText('WHIFF', 330, 420, '#fff', 36); }
  };
  const g = {
    wide: true,
    cmd: 'SWING!', hint: 'CLICK/SPACE WHEN THE BALL REACHES THE BAT', thint: 'TAP WHEN THE BALL HITS THE ZONE', dur: 4.2,
    key(e) { if (e.code === 'Space') swing(); }, down() { swing(); },
    update(dt) {
      c += dt * k; if (swT) { swT += dt * 5; if (swT > 1) swT = 1; } if (hit) flyT += dt; crowd = Math.max(0, crowd - dt * 1.3);
      if (!swung && !g.result && zOf() > 1.04) { gcLose(g); }
    },
    draw(t) {
      bg('#7FC8FF', '#74bcf2', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, 160, VW, 90);
      for (let i = -Math.ceil(OX / 20); i < 40 + Math.ceil(OX / 20); i++) { const j = i + 100; ctx.fillStyle = crowd > 0 && j % 2 ? '#fff' : ['#ff4d6d', '#ffd23f', '#5CFF7A', '#4DB8FF'][j % 4]; circ(10 + i * 20, 190 + (j % 3) * 14 - (crowd > 0 ? Math.abs(Math.sin(now * 14 + i)) * 12 : 0), 8, ctx.fillStyle, 2); }
      ctx.fillStyle = INK; ctx.fillRect(-OX, 246, VW, 380); ctx.fillStyle = '#58c24a'; ctx.fillRect(-OX, 252, VW, 380);
      ctx.fillStyle = '#d9a066'; ctx.beginPath(); ctx.ellipse(400, 480, 180, 70, 0, 0, 7); ctx.fill();
      // machine
      box(350, 160, 100, 90, '#7a8599', 5); box(380, 230, 40, 40, '#4a5568', 5); circ(400, 212, 16, INK, 0); circ(400, 212, 10, crowd > 0 ? '#ffd23f' : '#ff3b3b', 0);
      ctx.fillStyle = INK; ctx.fillRect(393, 160, 14, 8);
      // plate + zone
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(360, 490); ctx.lineTo(440, 490); ctx.lineTo(440, 510); ctx.lineTo(400, 530); ctx.lineTo(360, 510); ctx.closePath(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.fill();
      const z = zOf();
      if (c >= S && !hit) {
        const zz = Math.max(0, z), by = 212 + (470 - 212) * zz * zz * .4 + (470 - 212) * zz * .6 * 0 + 0;
        const yy = 215 + 255 * Math.pow(zz, 1.4), xx = 400 + curve * Math.sin(Math.min(1, zz) * Math.PI) * (1 - Math.min(1, zz) * .2), r = 5 + 30 * zz;
        if (zz < 1.1) { ctx.fillStyle = 'rgba(20,16,28,.25)'; ctx.beginPath(); ctx.ellipse(xx, 505 - 45 * (1 - zz) , r * 1.2, r * .4, 0, 0, 7); ctx.fill(); }
        if (zz < 1.12) circ(xx, yy, r, '#fff', Math.max(2, r / 7)), (ctx.strokeStyle = '#e8232f', ctx.lineWidth = 2, ctx.beginPath(), ctx.arc(xx, yy, r * .6, .4, 2.4), ctx.stroke());
      }
      if (hit) {
        const f = Math.min(1, flyT / 1.1), bx = 400 + f * 200, by = 470 - Math.sin(f * Math.PI * .8) * 320 - f * 60, r = Math.max(4, 36 * (1 - f * .85));
        circ(bx, by, r, '#fff', 3); txt('HOME RUN!', 400, 120, 56, '#FFE14D');
      }
      if (miss) txt('STRIKE!', 400, 120, 56, '#ff4d4d');
      // batter
      shadow(250, 546, 60, 14, .3); claude(250, 540, 8, { mood: gcMood(g) });
      const sw = swT ? swT : 0, ang = swung ? -2.1 + sw * 3.2 : -2.1 + Math.sin(now * 3) * .08;
      ctx.save(); ctx.translate(290, 470); ctx.rotate(ang); ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(140, 0); ctx.stroke();
      ctx.strokeStyle = '#d9a066'; ctx.lineWidth = 14; ctx.stroke(); ctx.lineCap = 'butt'; ctx.restore();
      if (swT && swT < 1) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(290, 470, 130, -2.1, ang); ctx.stroke(); }
    }
  };
  return g;
}

/* ───────── 6 ── PICTURE PERFECT: frame the UFO ───────── */
function gcSnap(sp) {
  const k = Math.sqrt(sp), dir = Math.random() < .5 ? 1 : -1, FW = 230, FH = 170;
  let c = 0, fx = 400, fy = 280, tx = 400, ty = 280, flash = 0, pol = 0, shot = 0;
  const ufo = { x: dir > 0 ? -80 - OX : 880 + OX, y: 260, base: 190 + Math.random() * 130 };
  const birds = [], clouds = [], vk = 1 + (VW - W) / 960 * .6;   // vk: faster UFO to cross the wider sky
  for (let i = 0; i < Math.round(4 * VW / W); i++) birds.push({ x: -OX + Math.random() * VW, y: 90 + Math.random() * 360, v: (Math.random() < .5 ? -1 : 1) * (120 + Math.random() * 120) * (sp > 1 ? 1.1 : 1), ph: Math.random() * 6 });
  for (let i = 0; i < Math.round(5 * VW / W); i++) clouds.push({ x: -OX + Math.random() * VW, y: 70 + Math.random() * 380, s: 36 + Math.random() * 30, v: 12 + Math.random() * 14 });
  const snap = () => {
    if (shot || g.result) return; shot = 1; flash = 1; pol = .001; sfx.click(); noise(.12, .05, 3000, 800, 'highpass', .02);
    if (c >= .15 && Math.abs(ufo.x - fx) < FW * .38 && Math.abs(ufo.y - fy) < FH * .38) { gcWin(g); sfx.sparkle(); burst(ufo.x, ufo.y, '#7cf7d4', 18); ring(ufo.x, ufo.y, '#fff', 100); floatText('PERFECT!', ufo.x, ufo.y - 50, '#7cf7d4', 40); } else { gcLose(g); sfx.miss(); }
  };
  const g = {
    wide: true,
    cmd: 'SNAP!', hint: 'FRAME THE UFO, THEN CLICK', thint: 'DRAG THE FRAME, LIFT TO SNAP', dur: 5,
    // touch: dragging moves the frame and lifting the finger snaps; mouse: click snaps
    move(p) { tx = p.x; ty = p.y; }, down(p) { tx = p.x; ty = p.y; if (!p.touch) snap(); }, up(p) { if (p.touch) snap(); },
    key(e) { if (e.code === 'Space') snap(); },
    update(dt) {
      const ts = dt * k; if (!shot) c += ts;
      const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
      if (kx || ky) { tx = fx + kx * 40; ty = fy + ky * 40; }
      fx += (gcClamp(tx, 115 - OX, 685 + OX) - fx) * Math.min(1, 14 * dt); fy += (gcClamp(ty, 95, 455) - fy) * Math.min(1, 14 * dt);
      flash = Math.max(0, flash - dt * 4); if (pol) pol = Math.min(1.5, pol + dt);
      for (const b of birds) { b.x += b.v * ts; if (b.x < -OX - 60) b.x = W + OX + 60; if (b.x > W + OX + 60) b.x = -OX - 60; }
      for (const cl of clouds) { cl.x += cl.v * dt; if (cl.x > W + OX + 100) cl.x = -OX - 100; }
      if (!shot) {
        if (c > .3) { ufo.x += dir * 255 * vk * ts; ufo.y = ufo.base + Math.sin(c * 2.4) * 55; }
        if ((dir > 0 && ufo.x > W + OX + 90) || (dir < 0 && ufo.x < -OX - 90)) gcLose(g);
      }
    },
    draw(t) {
      bg('#8FD3FF', '#7fc7f7', t);
      for (const cl of clouds) { circ(cl.x, cl.y, cl.s, '#fff', 4); circ(cl.x + cl.s, cl.y + 8, cl.s * .75, '#fff', 4); circ(cl.x - cl.s, cl.y + 10, cl.s * .7, '#fff', 4); circ(cl.x, cl.y + 6, cl.s * .8, '#fff', 0); circ(cl.x + cl.s, cl.y + 12, cl.s * .6, '#fff', 0); }
      for (const b of birds) {
        const fl = Math.sin(now * 12 + b.ph) * 10; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x - 24, b.y - fl); ctx.lineTo(b.x, b.y + 6); ctx.lineTo(b.x + 24, b.y - fl); ctx.stroke(); ctx.lineCap = 'butt';
      }
      if (!shot || g.result) if (ufo.x > -OX - 100 && ufo.x < W + OX + 100) {
        shadow(ufo.x, ufo.y + 40, 40, 8, .12);
        ctx.save(); ctx.translate(ufo.x, ufo.y); ctx.rotate(Math.sin(now * 5) * .08);
        circ(0, -16, 22, '#7cf7d4', 4);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 4, 56, 18, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#b8c0d0'; ctx.beginPath(); ctx.ellipse(0, 4, 52, 14, 0, 0, 7); ctx.fill();
        for (let i = -2; i <= 2; i++) circ(i * 18, 6, 4, Math.floor(now * 6 + i) % 2 ? '#ffd23f' : '#ff4d6d', 1);
        ctx.restore();
      }
      // viewfinder
      ctx.fillStyle = 'rgba(20,16,28,.28)';
      ctx.fillRect(-OX, 0, VW, fy - FH / 2); ctx.fillRect(-OX, fy + FH / 2, VW, H); ctx.fillRect(-OX, fy - FH / 2, fx - FW / 2 + OX, FH); ctx.fillRect(fx + FW / 2, fy - FH / 2, W + OX - (fx + FW / 2), FH);
      const L = 34;
      for (const col of [INK, '#fff']) {
        ctx.strokeStyle = col; ctx.lineWidth = col === INK ? 12 : 5; ctx.lineCap = col === INK ? 'square' : 'butt'; ctx.beginPath();
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const x = fx + sx * FW / 2, y = fy + sy * FH / 2; ctx.moveTo(x - sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * L); }
        ctx.moveTo(fx - 14, fy); ctx.lineTo(fx + 14, fy); ctx.moveTo(fx, fy - 14); ctx.lineTo(fx, fy + 14); ctx.stroke();
      }
      ctx.lineCap = 'butt';
      if (Math.floor(now * 2) % 2 === 0) { circ(fx - FW / 2 + 18, fy - FH / 2 - 22, 7, '#ff3b3b', 2); }
      if (pol) {
        const k2 = Math.min(1, pol / .5), py = 640 - k2 * 270;
        ctx.save(); ctx.translate(690 + OX * .6, py); ctx.rotate(.12);
        box(-80, -100, 160, 200, '#fff', 5); box(-68, -88, 136, 130, g.result === 'win' ? '#8FD3FF' : '#6fb8e8', 3);
        if (g.result === 'win') { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, -30, 38, 12, 0, 0, 7); ctx.fill(); circ(0, -42, 14, '#7cf7d4', 3); }
        else txt('?', 0, -22, 70, '#fff');
        txt(g.result === 'win' ? 'PERFECT' : 'OOPS', 0, 74, 26, g.result === 'win' ? '#2bb24c' : '#ff4d4d', 'center', 130);
        ctx.restore();
      }
      if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, flash * 1.4) + ')'; ctx.fillRect(-OX, 0, VW, H); }
    }
  };
  return g;
}

/* ───────── 7 ── MOUSE TRAP: drop the trap on the mouse ───────── */
function gcTrap(sp) {
  const k = Math.sqrt(sp), FY = 500, TY0 = 140;
  const om = 2.0 + sp * .5, ph = Math.random() * 6;
  const mouse2 = { x: 120 - OX + Math.random() * (560 + 2 * OX), dir: Math.random() < .5 ? -1 : 1, v: 170, t: 0, pause: 0 };
  const cheese = { x: 140 - OX + Math.random() * (520 + 2 * OX) };
  let c = 0, tx = 400, ty = TY0, vy = 0, fall = false, landed = false, snapT = 0, wig = 0;
  const drop = () => { if (fall || g.result) return; fall = true; vy = 0; sfx.whoosh(false); };
  const g = {
    wide: true,
    cmd: 'DROP!', hint: 'CLICK/SPACE TO DROP THE TRAP ON THE MOUSE', thint: 'TAP TO DROP THE TRAP', dur: 5.2,
    key(e) { if (e.code === 'Space') drop(); }, down() { drop(); },
    update(dt) {
      const ts = dt * k; c += ts; wig += dt;
      if (!landed) {
        const m = mouse2; m.t -= ts;
        if (m.t <= 0) { m.t = .4 + Math.random() * .8; const r = Math.random(); if (r < .25) m.pause = .35; else m.pause = 0; if (Math.random() < .5) m.dir *= -1; m.v = (130 + Math.random() * 150) * Math.sqrt(sp * .8 + .2); }
        if (m.x < 60 - OX) m.dir = 1; if (m.x > 740 + OX) m.dir = -1;
        if (!m.pause || m.t > .4) m.x += m.dir * m.v * ts * (m.pause ? 0 : 1);
        if (!fall) tx = 400 + (290 + OX) * Math.sin(c * om + ph);
        else {
          vy += 2600 * ts; ty += vy * ts;
          if (ty >= FY - 38) { ty = FY - 38; landed = true; snapT = .001; sfx.thud(); shake(11, .3); burst(tx, FY, '#f6ead0', 12, 240); if (Math.abs(tx - m.x) < 66) { gcWin(g); sfx.stamp(); floatText('GOTCHA!', tx, ty - 120, '#FFE14D', 40); } else { gcLose(g); sfx.boing(); floatText('MISSED', m.x, FY - 90, '#fff', 34); } }
        }
      }
      if (snapT) snapT += dt;
    },
    draw(t) {
      bg('#C9A27A', '#bf9669', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, FY - 4, VW, 120); ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-OX, FY, VW, 120);
      for (let i = -Math.ceil(OX / 110); i < 8 + Math.ceil(OX / 110); i++) { ctx.fillStyle = 'rgba(0,0,0,.13)'; ctx.fillRect(i * 110, FY, 6, 120); }
      box(-OX - 6, 52, VW + 12, 14, '#555', 4); for (let i = -Math.ceil(OX / 40); i < 20 + Math.ceil(OX / 40); i++) { ctx.fillStyle = INK; ctx.fillRect(10 + i * 40, 70, 4, 6); }
      // cheese
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(cheese.x - 34, FY - 2); ctx.lineTo(cheese.x + 34, FY - 2); ctx.lineTo(cheese.x - 34, FY - 38); ctx.closePath(); ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = '#FFD23F'; ctx.fill(); circ(cheese.x - 14, FY - 10, 5, '#f0b400', 1); circ(cheese.x + 8, FY - 8, 4, '#f0b400', 1);
      // mouse
      const m = mouse2, f = m.dir, fk = gcClamp((ty - TY0) / (FY - TY0), 0, 1);
      shadow(m.x, FY + 4, 34, 8, .25); shadow(cheese.x, FY + 2, 38, 8, .25); shadow(tx, FY + 6, 30 + 30 * fk, 6 + 6 * fk, .12 + .2 * fk);
      if (!(g.result === 'win' && snapT > 0)) {
        ctx.save(); ctx.translate(m.x, FY - 2); ctx.scale(f, 1);
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-26, -12); ctx.quadraticCurveTo(-50, -14 + Math.sin(wig * 9) * 8, -58, -34); ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, -18, 31, 21, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#b8bcc8'; ctx.beginPath(); ctx.ellipse(0, -18, 27, 17, 0, 0, 7); ctx.fill();
        circ(14, -36, 11, '#ffb3c7', 3); circ(28, -20, 4, '#ff4d9e', 1); ctx.fillStyle = INK; ctx.fillRect(18, -30, 5, 6);
        ctx.fillRect(-12 + Math.sin(wig * 18) * 3, -4, 6, 6); ctx.fillRect(10 - Math.sin(wig * 18) * 3, -4, 6, 6);
        ctx.restore();
      }
      // trap
      const ropeTop = 70;
      if (!fall) { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(tx, ropeTop); ctx.lineTo(tx, ty - 34); ctx.stroke(); box(tx - 14, ropeTop - 10, 28, 16, '#999', 3); }
      else if (!landed) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(tx + i * 30, ty - 140); ctx.lineTo(tx + i * 30, ty - 50); ctx.stroke(); } }
      box(tx - 50, ty - 34, 100, 72, '#c9772e', 5);
      ctx.fillStyle = INK; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(tx - 46 + i * 16, ty + 38); ctx.lineTo(tx - 38 + i * 16, ty + 54); ctx.lineTo(tx - 30 + i * 16, ty + 38); ctx.fill(); }
      ctx.fillStyle = '#7a4a1a'; ctx.fillRect(tx - 44, ty - 20, 88, 8); ctx.fillRect(tx - 44, ty, 88, 8);
      if (landed) { txt('SNAP!', tx, ty - 80, 60 + Math.max(0, 20 - snapT * 40), '#FFE14D'); star(tx, ty + 10, 70, 40, 9, snapT * 3, 'rgba(255,255,255,.35)', 0); }
      if (g.result === 'lose' && landed) { ctx.save(); ctx.translate(m.x, FY - 80); txt('HA!', 0, 0, 30, '#fff'); ctx.restore(); }
      claude(70, 440, 5, { mood: gcMood(g) });
    }
  };
  return g;
}

/* ───────── 9 ── DOUSE THE HOUSE: spray the flames ───────── */
function gcDouse(sp) {
  const k = Math.sqrt(sp), GRAV = 700, TF = .5;
  const wins = [{ x: 290, y: 200 }, { x: 510, y: 200 }, { x: 290, y: 350 }, { x: 510, y: 350 }];
  const fires = wins.map(w => ({ x: w.x, y: w.y + 20, hp: 1, steam: 0, sx: 0 }));
  const ps = [], steam = []; let spray = false, c = 0; const NZ = { x: 400, y: 520 };
  const g = {
    wide: true,
    cmd: 'EXTINGUISH!', hint: 'HOLD CLICK/SPACE + AIM AT THE FLAMES', thint: 'HOLD + DRAG ON THE FLAMES', dur: 6.2,
    down(p) { spray = true; }, up() { spray = false; },
    key(e) { if (e.code === 'Space') spray = true; }, keyup(e) { if (e.code === 'Space') spray = false; },
    update(dt) {
      const ts = dt * k; if (!g.result) c += ts;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]; p.vy += GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt;
        let dead = p.l <= 0;
        for (const f of fires) if (f.hp > 0 && Math.hypot(p.x - f.x, p.y - f.y) < 46) { f.hp -= .045; f.steam += 1; dead = true; if (f.hp <= 0) { f.hp = 0; sfx.pop(); sfx.splat(); floatText('+1', f.x, f.y - 40, '#fff', 40); burst(f.x, f.y, '#4DB8FF', 12, 220); for (let j = 0; j < 8; j++) steam.push({ x: f.x + (Math.random() - .5) * 40, y: f.y, vy: -60 - Math.random() * 60, r: 14, a: 1 }); } break; }
        if (dead) { ps.splice(i, 1); }
      }
      for (let i = steam.length - 1; i >= 0; i--) { const s = steam[i]; s.y += s.vy * dt; s.r += dt * 30; s.a -= dt * 1.1; if (s.a <= 0) steam.splice(i, 1); }
      if (g.result) return;
      if (spray) {
        const tx = gcClamp(mouse.x, 120 - OX, 700 + OX), ty = gcClamp(mouse.y, 100, 450);
        for (let i = 0; i < Math.max(1, Math.round(ts * 120)); i++) {
          const jx = (Math.random() - .5) * 30, jy = (Math.random() - .5) * 30, dx = tx + jx - NZ.x, dy = ty + jy - NZ.y;
          const T2 = TF * (.8 + Math.random() * .4);
          ps.push({ x: NZ.x, y: NZ.y, vx: dx / T2, vy: dy / T2 - .5 * GRAV * T2, l: T2 + .15 });
        }
        if (Math.random() < .25) noise(.06, .025, 2500, 5000, 'bandpass');
      }
      let alive = 0;
      for (const f of fires) { if (f.hp > 0) { alive++; f.hp = Math.min(1, f.hp + dt * .035 * Math.sqrt(sp)); } }
      if (!alive) gcWin(g);
    },
    draw(t) {
      bg('#8D9BFF', '#8190f2', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, 500, VW, 110); ctx.fillStyle = '#6c7a8a'; ctx.fillRect(-OX, 506, VW, 110);
      box(200, 90, 400, 410, '#c5513a', 6);
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(206 + (i + j % 2 * .5) * 58, 96 + j * 58, 46, 4); }
      box(180, 70, 440, 30, '#7a2f22', 6);
      box(355, 420, 90, 80, '#7a4a2a', 5); circ(430, 462, 5, '#ffd23f', 1);
      wins.forEach((w, i) => {
        box(w.x - 56, w.y - 56, 112, 112, '#2b1f35', 5);
        claude(w.x, w.y + 50, 4.2, { mood: fires[i].hp <= 0 ? 'happy' : 'sad' });
        box(w.x - 66, w.y + 56, 132, 12, '#e8e0c8', 4);
      });
      for (const f of fires) {
        if (f.hp <= 0) continue;
        const s = .35 + f.hp * .75, fl = Math.sin(now * 14 + f.x) * .08;
        ctx.save(); ctx.translate(f.x, f.y + 34); ctx.scale(s * (1 + fl), s * (1 - fl));
        ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(0, -92); ctx.bezierCurveTo(26, -50, 56, -30, 50, 4); ctx.bezierCurveTo(46, 30, -46, 30, -50, 4); ctx.bezierCurveTo(-56, -30, -22, -50, 0, -92); ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = '#ff7a1a'; ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, 4, 28, 20, 0, 0, 7); ctx.fill();
        ctx.fillStyle = INK; ctx.fillRect(-16, -12, 8, 14); ctx.fillRect(8, -12, 8, 14);
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-12, -16); ctx.lineTo(-4, -12); ctx.moveTo(12, -16); ctx.lineTo(4, -12); ctx.stroke();
        ctx.restore();
      }
      for (const s of steam) { ctx.globalAlpha = Math.max(0, s.a * .8); circ(s.x, s.y, s.r, '#fff', 0); } ctx.globalAlpha = 1;
      for (const p of ps) circ(p.x, p.y, 6, '#4DB8FF', 2);
      for (const f of fires) if (f.hp > 0 && f.hp < 1 && Math.floor(now * 12) % 3 === 0) circ(f.x + Math.sin(now * 20 + f.x) * 30, f.y - 20 - (now * 90 + f.x) % 60, 4, '#fff', 0);
      shadow(400, 546, 34, 8, .3); box(380, 510, 40, 30, '#e8232f', 5); circ(400, 506, 12, '#9aa', 3);
      claude(120, 500, 5, { mood: gcMood(g) });
      const cx = gcClamp(mouse.x, 120 - OX, 700 + OX), cy = gcClamp(mouse.y, 100, 450);
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    }
  };
  return g;
}

/* ───────── 10 ── PUTT FOR DOUGH: drag back and release ───────── */
function gcPutt(sp) {
  const k = Math.sqrt(sp), GX0 = 70 - OX, GX1 = 730 + OX, GY0 = 110, GY1 = 500;   // wider green; tee and hole move out only a bit so the shot stays reachable
  const ball = { x: 150 - OX * .3, y: 250 + Math.random() * 100, vx: 0, vy: 0, sunk: 0, rolling: false };
  const hole = { x: 600 + OX * .3 + Math.random() * 100, y: 190 + Math.random() * 220, r: 17 };
  const dxh = hole.x - ball.x, dyh = hole.y - ball.y, mid = .5;
  const bunk = { x: ball.x + dxh * mid + (Math.random() - .5) * 20, y: ball.y + dyh * mid + (Math.random() < .5 ? -1 : 1) * 10, rx: 62, ry: 48 };
  let drag = false, px = 0, py = 0, shot = false, still = 0, c = 0;
  const pullVec = () => { let dx = ball.x - px, dy = ball.y - py; const d = Math.hypot(dx, dy); if (d > 200) { dx *= 200 / d; dy *= 200 / d; } return [dx, dy, Math.min(200, d)]; };
  const g = {
    wide: true,
    cmd: 'PUTT!', hint: 'DRAG BACK FROM THE BALL, RELEASE', thint: 'DRAG BACK, LET GO', dur: 6.5,
    down(p) { if (shot || g.result) return; drag = true; px = p.x; py = p.y; },
    move(p) { px = p.x; py = p.y; },
    up(p) {
      if (!drag || shot || g.result) return; drag = false; px = p.x; py = p.y;
      const [dx, dy, d] = pullVec(); if (d < 22) return;
      shot = true; ball.rolling = true; ball.vx = dx / d * d * 3.5; ball.vy = dy / d * d * 3.5; sfx.hit(); burst(ball.x, ball.y, '#fff', 6, 140);
    },
    update(dt) {
      const ts = dt * k; c += ts;
      if (ball.sunk) { ball.sunk += dt * 2.2; ball.x += (hole.x - ball.x) * Math.min(1, 12 * dt); ball.y += (hole.y - ball.y) * Math.min(1, 12 * dt); return; }
      if (!ball.rolling) return;
      const inB = ((ball.x - bunk.x) / bunk.rx) ** 2 + ((ball.y - bunk.y) / bunk.ry) ** 2 < 1;
      const v = Math.hypot(ball.vx, ball.vy), dec = (230 + (inB ? 700 : 0)) * ts;
      if (v > 0) { const nv = Math.max(0, v - dec); ball.vx *= nv / v; ball.vy *= nv / v; }
      ball.x += ball.vx * ts; ball.y += ball.vy * ts;
      if (ball.x < GX0 + 8) { ball.x = GX0 + 8; ball.vx = Math.abs(ball.vx) * .7; sfx.click(); } if (ball.x > GX1 - 8) { ball.x = GX1 - 8; ball.vx = -Math.abs(ball.vx) * .7; sfx.click(); }
      if (ball.y < GY0 + 8) { ball.y = GY0 + 8; ball.vy = Math.abs(ball.vy) * .7; sfx.click(); } if (ball.y > GY1 - 8) { ball.y = GY1 - 8; ball.vy = -Math.abs(ball.vy) * .7; sfx.click(); }
      const hd = Math.hypot(ball.x - hole.x, ball.y - hole.y), sp2 = Math.hypot(ball.vx, ball.vy);
      if (hd < hole.r && sp2 < 330) { ball.sunk = .001; ball.rolling = false; gcWin(g); sfx.sparkle(); burst(hole.x, hole.y, '#FFE14D', 20, 300); ring(hole.x, hole.y, '#fff', 80); floatText('HOLE!', hole.x, hole.y - 50, '#FFE14D', 44); }
      else if (sp2 < 6) { still += ts; if (still > .25) { ball.rolling = false; gcLose(g); } } else still = 0;
    },
    draw(t) {
      bg('#4FD65C', '#47c954', t);
      box(GX0, GY0, GX1 - GX0, GY1 - GY0, '#5de36a', 6);
      for (let i = 0; i < Math.ceil((GX1 - GX0) / 66); i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'; ctx.fillRect(GX0 + i * 66, GY0, Math.min(33, GX1 - GX0 - i * 66), GY1 - GY0); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(bunk.x, bunk.y, bunk.rx + 5, bunk.ry + 5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f1d98a'; ctx.beginPath(); ctx.ellipse(bunk.x, bunk.y, bunk.rx, bunk.ry, 0, 0, 7); ctx.fill();
      for (let i = 0; i < 10; i++) { ctx.fillStyle = '#d9bd62'; ctx.fillRect(bunk.x - 40 + (i * 37) % 80, bunk.y - 30 + (i * 23) % 60, 4, 4); }
      circ(hole.x, hole.y, hole.r, INK, 3);
      ctx.fillStyle = INK; ctx.fillRect(hole.x + 2, hole.y - 90, 5, 90); ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.moveTo(hole.x + 7, hole.y - 90); ctx.lineTo(hole.x + 50, hole.y - 74 + Math.sin(now * 6) * 3); ctx.lineTo(hole.x + 7, hole.y - 58); ctx.closePath(); ctx.fill(); ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke();
      if (drag && !shot) {
        const [dx, dy, d] = pullVec();
        ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x - dx, ball.y - dy); ctx.stroke(); ctx.strokeStyle = '#ff4d9e'; ctx.lineWidth = 4; ctx.stroke();
        ctx.setLineDash([2, 14]); ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x + dx / (d || 1) * 130, ball.y + dy / (d || 1) * 130); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'butt';
        ctx.setLineDash([2, 14]); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
        ctx.fillStyle = INK; ctx.fillRect(40, 520 - 3, 164, 24); ctx.fillStyle = '#fff'; ctx.fillRect(44, 520, 156, 18); ctx.fillStyle = d > 160 ? '#ff4d4d' : '#FFE14D'; ctx.fillRect(44, 520, 156 * d / 200, 18);
      }
      const sk = ball.sunk ? Math.max(.2, 1 - ball.sunk) : 1;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(ball.x + 3, ball.y + 7, 12 * sk, 5 * sk, 0, 0, 7); ctx.fill();
      circ(ball.x, ball.y, 10 * sk, '#fff', 3);
      if (ball.sunk) { star(hole.x, hole.y - 20, 30, 12, 6, now * 5, '#FFE14D', 2); txt('PLINK!', hole.x, hole.y - 120, 40, '#fff'); }
      for (let i = 0; i < 4; i++) star(GX0 + OX + 40 + i * 180 + Math.sin(now * 3 + i) * 10, 68, 8, 3, 4, now * 2 + i, '#fff', 2);
      claude(70, 585 - 40, 4, { mood: gcMood(g) });
    }
  };
  return g;
}

/* ───────── 11 ── PARKING PROWESS ───────── */
function gcPark(sp) {
  const k = Math.sqrt(sp), BX = [100, 250, 400, 550, 700], BW = 110, BT = 100, BB = 285, HW = 22, HL = 36;
  const free = Math.random() * 5 | 0, cols = ['#4DB8FF', '#ffd23f', '#5CFF7A', '#ff4d9e', '#b58cff'];
  const car = { x: 400, y: 495, a: -Math.PI / 2, v: 0 }; let ptr = false, px = 400, py = 300, stop = 0, c = 0, honk = 0, evalDone = false;
  const corners = () => { const f = [Math.cos(car.a), Math.sin(car.a)], r = [-f[1], f[0]], o = []; for (const sl of [-1, 0, 1]) for (const sw of [-1, 0, 1]) if (sl || sw) o.push([car.x + f[0] * sl * HL + r[0] * sw * HW, car.y + f[1] * sl * HL + r[1] * sw * HW]); return o; };
  const inRect = (p, x0, y0, x1, y1) => p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1;
  const crash = () => {
    const cs = corners();
    for (let i = 0; i < 5; i++) if (i !== free) { const nx = BX[i]; for (const p of cs) if (inRect(p, nx - 24, BT + 30, nx + 24, BB - 10)) return true; }
    for (const p of cs) if (p[1] < BT - 2 || p[0] < 8 - OX || p[0] > W - 8 + OX) return true;
    return false;
  };
  const inBay = () => corners().every(p => inRect(p, BX[free] - BW / 2 + 2, BT, BX[free] + BW / 2 - 2, BB + 8));
  const g = {
    wide: true,
    cmd: 'PARK!', hint: 'HOLD ↑ + STEER ← →, RELEASE TO STOP IN THE BAY', thint: 'HOLD TO DRIVE TO FINGER, LET GO TO STOP', dur: 6,
    down(p) { ptr = true; px = p.x; py = p.y; }, move(p) { px = p.x; py = p.y; }, up() { ptr = false; },
    update(dt) {
      const ts = dt * k; if (!g.result) c += ts; honk = Math.max(0, honk - dt);
      if (g.result) { car.v *= .9; return; }
      const up = keys.ArrowUp || keys.KeyW, dn = keys.ArrowDown || keys.KeyS; let st = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), drive = up || ptr;
      if (ptr && !st) { const dx = px - car.x, dy = py - car.y; if (Math.hypot(dx, dy) > 24) { let d = Math.atan2(dy, dx) - car.a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; st = gcClamp(d * 2.5, -1, 1); } }
      const tv = drive ? 235 : dn ? -120 : 0; car.v += (tv - car.v) * Math.min(1, (tv ? 6 : 14) * ts);
      car.a += st * 2.3 * ts * (car.v / 235); car.x += Math.cos(car.a) * car.v * ts; car.y += Math.sin(car.a) * car.v * ts;
      car.y = Math.min(car.y, 560);
      if (crash()) { gcLose(g); honk = .8; sfx.thud(); shake(12, .35); burst(car.x, car.y, '#FFE14D', 14); return; }
      if (!drive && !dn && Math.abs(car.v) < 14 && car.y < 330) { stop += ts; if (stop > .25 && !evalDone) { evalDone = true; if (inBay()) { gcWin(g); sfx.sparkle(); burst(car.x, car.y, '#5CFF7A', 18); ring(car.x, car.y, '#fff', 100); floatText('NICE!', car.x, car.y - 70, '#5CFF7A', 44); } else { gcLose(g); sfx.boing(); } } } else stop = 0;
    },
    draw(t) {
      bg('#8E94A8', '#858b9f', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, BT - 18, VW, 18); ctx.fillStyle = '#e8d6a8'; ctx.fillRect(-OX, BT - 14, VW, 10);
      for (let i = 0; i < 5; i++) {
        const x = BX[i];
        ctx.fillStyle = '#fff'; ctx.fillRect(x - BW / 2 - 3, BT, 6, BB - BT); if (i === 4) ctx.fillRect(x + BW / 2 - 3, BT, 6, BB - BT);
        if (i === free) { ctx.fillStyle = 'rgba(92,255,122,' + (.25 + .15 * Math.sin(now * 8)) + ')'; ctx.fillRect(x - BW / 2 + 3, BT, BW - 6, BB - BT); txt('P', x, 195, 56, '#fff'); }
        else {
          box(x - 23, BT + 35, 46, 76 + 0, cols[i], 4); box(x - 17, BT + 46, 34, 14, '#bfe9ff', 2); box(x - 17, BT + 84, 34, 10, '#bfe9ff', 2);
          if (honk > 0 || (Math.abs(car.x - x) < 120 && car.y < 330 && Math.floor(now * 4) % 2 === 0)) { ctx.fillStyle = INK; txt('BEEP!', x, BT + 6, 22, '#FFE14D'); }
        }
      }
      ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.a + Math.PI / 2);
      ctx.fillStyle = 'rgba(20,16,28,.28)'; ctx.fillRect(-HW + 6, -HL + 7, HW * 2, HL * 2);
      box(-HW, -HL, HW * 2, HL * 2, g.result === 'lose' ? '#c14' : OR, 4); box(-HW + 6, -HL + 14, HW * 2 - 12, 16, '#bfe9ff', 2); box(-HW + 6, HL - 18, HW * 2 - 12, 10, '#7a3f2a', 2);
      ctx.fillStyle = '#FFE14D'; ctx.fillRect(-HW + 2, -HL - 2, 8, 6); ctx.fillRect(HW - 10, -HL - 2, 8, 6);
      ctx.restore();
      if (g.result === 'win') txt('PERFECT!', 400, 420, 64, '#FFE14D');
      if (g.result === 'lose') txt('CRUNCH!', 400, 420, 64, '#ff4d4d');
      claude(80, 560, 4, { mood: gcMood(g) });
    }
  };
  return g;
}

/* ───────── 12 ── GIFTED GOALIE: block the shots ───────── */
function gcGoalie(sp) {
  const k = Math.sqrt(sp), GL = 180, GR = 620, GYL = 285, need = sp > 1.5 ? 2 : 3, N = 3;
  const shots = []; for (let i = 0; i < N; i++) shots.push({ s: .35 + i * 1.45, tgt: (i === 0 ? (Math.random() < .5 ? 215 : 585) : 215 + Math.random() * 370), x0: 400, res: 0, ph: 0 });
  let gx = 400, tx = 400, c = 0, blocks = 0, done = 0, lastT = 0, lastR = 0, netRip = 0;
  const g = {
    wide: true,
    cmd: 'BLOCK!', hint: 'MOUSE OR ← → TO MOVE THE GOALIE', thint: 'DRAG LEFT / RIGHT', dur: 5.4,
    move(p) { tx = p.x; }, down(p) { tx = p.x; },
    update(dt) {
      const ts = dt * k; netRip = Math.max(0, netRip - dt * 2); lastT = Math.max(0, lastT - dt);
      const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0); if (kx) tx = gx + kx * 60;
      const mv = gcClamp(gcClamp(tx, 175, 625) - gx, -560 * ts, 560 * ts); gx += mv; g.vx = mv / (ts || 1);
      if (g.result) return; c += ts;
      for (const s of shots) {
        const u = c - s.s; if (u < 0 || s.res) continue;
        if (u >= .45 && !s.k) { s.k = 1; sfx.thud(); }
        if (u >= .45) {
          const f = (u - .45) / .6;
          if (f >= 1) {
            if (Math.abs(gx - s.tgt) < 62) { s.res = 1; blocks++; lastR = 1; sfx.hit(); burst(s.tgt, GYL - 10, '#5CFF7A', 14); ring(s.tgt, GYL - 10, '#fff', 70); floatText('+1', s.tgt, GYL - 60, '#5CFF7A', 40); } else { s.res = 2; netRip = 1; lastR = 2; sfx.miss(); shake(8, .25); burst(s.tgt, GYL - 40, '#fff', 10); }
            lastT = .8; done++; s.fx = s.tgt;
            if (blocks >= need) gcWin(g); else if (done - blocks > N - need) gcLose(g);
          }
        }
      }
    },
    draw(tm) {
      bg('#3b1f6b', '#46257d', tm);
      const cols = ['rgba(255,77,158,.18)', 'rgba(77,184,255,.18)', 'rgba(255,225,77,.18)'];
      for (let i = 0; i < 3; i++) { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(400, 0); ctx.lineTo(120 + i * 280 + Math.sin(now * 2 + i) * 60, 600); ctx.lineTo(260 + i * 280 + Math.sin(now * 2 + i) * 60, 600); ctx.fill(); }
      ctx.fillStyle = INK; ctx.fillRect(-OX, GYL + 22, VW, 400); ctx.fillStyle = '#3fbf5f'; ctx.fillRect(-OX, GYL + 28, VW, 400);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(-OX, GYL + 40 + i * 52, VW, 26); }
      // goal
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(GL, 160, GR - GL, GYL - 160);
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; for (let x = GL; x <= GR; x += 22) { ctx.beginPath(); ctx.moveTo(x, 160); ctx.lineTo(x, GYL); ctx.stroke(); } for (let y = 160; y <= GYL; y += 22) { ctx.beginPath(); ctx.moveTo(GL, y); ctx.lineTo(GR, y); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.lineCap = 'square'; ctx.beginPath(); ctx.moveTo(GL, GYL + 6); ctx.lineTo(GL, 160); ctx.lineTo(GR, 160); ctx.lineTo(GR, GYL + 6); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.stroke(); ctx.lineCap = 'butt';
      // disco ball
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(400, 0); ctx.lineTo(400, 60); ctx.stroke(); circ(400, 84, 24, '#cfd6e6', 4);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(388 + Math.sin(now * 3 + i * 1.3) * 14, 72 + (i * 7) % 24, 6, 6); }
      // goalie
      const lean = gcClamp((g.vx || 0) / 1400, -.5, .5);
      shadow(gx, GYL + 34, 44, 10, .3);
      ctx.save(); ctx.translate(gx, GYL + 30); ctx.rotate(lean); claude(0, 0, 7, { mood: gcMood(g) });
      for (const [cx2, cy2, r, col] of [[-22, -66, 18, '#ff4d9e'], [0, -76, 22, '#b58cff'], [22, -66, 18, '#4DB8FF'], [0, -62, 16, '#ffd23f']]) circ(cx2, cy2, r, col, 3);
      ctx.restore();
      // shots
      for (const s of shots) {
        const u = c - s.s;
        if (u < 0 || s.res === 1 && false) continue;
        let bx, by, r;
        if (u < .45) {
          const sw = u / .45;
          ctx.save(); ctx.translate(400 + (s.tgt - 400) * -.0, 520); claude(0, 40, 6, {}); ctx.restore();
          bx = 400; by = 515; r = 20;
          ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(400 - 20, 520); ctx.lineTo(400 - 20 - 20 + sw * 50, 540 - Math.sin(sw * Math.PI) * 24); ctx.stroke(); ctx.lineCap = 'butt';
          ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(400 + (s.tgt > 400 ? 1 : -1) * 54, 470); ctx.lineTo(400 + (s.tgt > 400 ? 1 : -1) * 80, 490); ctx.lineTo(400 + (s.tgt > 400 ? 1 : -1) * 54, 510); ctx.fill();
        } else {
          const f = gcClamp((u - .45) / .6, 0, 1);
          if (s.res === 1) { const rf = gcClamp((u - 1.05) / .5, 0, 1); bx = s.tgt + (s.tgt > 400 ? 1 : -1) * rf * 90; by = GYL - 5 + rf * 160; r = 12 + rf * 6; if (rf >= 1 && u > 1.7) continue; }
          else { bx = 400 + (s.tgt - 400) * f; by = 510 + (GYL - 5 - 510) * f; r = 20 - 9 * f; }
          if (f < 1 && !s.res) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - (s.tgt - 400) * (f * .25 + .0) * .5, by + 60 * (1 - f * .5)); ctx.stroke(); }
        }
        circ(bx, by, r, '#fff', 3);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(bx, by, r * .4, 0, 7); ctx.fill();
      }
      if (netRip > 0) { ctx.fillStyle = 'rgba(255,77,77,' + netRip * .35 + ')'; ctx.fillRect(GL, 160, GR - GL, GYL - 160); }
      if (lastT > 0) txt(lastR === 1 ? 'SAVE!' : 'GOAL!', 400, 200, 60, lastR === 1 ? '#5CFF7A' : '#ff4d4d');
      for (let i = 0; i < N; i++) circ(40 - OX / 2 + i * 40, 60, 13, shots[i].res === 1 ? '#5CFF7A' : shots[i].res === 2 ? '#ff4d4d' : '#4a4558', 3);
      txt(window.t('NEED {n}', { n: need }), 100 - OX / 2, 100, 20, '#fff');
    }
  };
  return g;
}

/* ───────── 13 ── NAIL CALL: hammer when the thumb is clear ───────── */
function gcNail(sp) {
  const k = Math.sqrt(sp), PY = 440, NX = 400, SEG = 50, om = 3.2 + sp * .8, ph = Math.random() * 6;
  let c = 0, hits = 0, hT = -1, cool = 0, thumbX = 400, ouch = 0, dust = 0, bump = 0;
  const headY = () => PY - (3 - hits) * SEG - 6;
  const tpos = () => NX + 205 * Math.sin(c * om + ph) * (1 + .12 * hits);
  const swing = () => { if (g.result || cool > 0 || hT >= 0) return; hT = 0; sfx.whoosh(false); };
  const g = {
    wide: true,
    cmd: 'HAMMER!', hint: 'CLICK/SPACE WHEN THE THUMB IS CLEAR', thint: 'TAP WHEN THE THUMB IS CLEAR', dur: 6,
    key(e) { if (e.code === 'Space') swing(); }, down() { swing(); },
    update(dt) {
      const ts = dt * k; if (!g.result) c += ts; thumbX = tpos(); cool = Math.max(0, cool - ts); ouch = Math.max(0, ouch - dt); dust = Math.max(0, dust - dt * 3); bump = Math.max(0, bump - dt * 4);
      if (hT >= 0) {
        hT += ts;
        if (hT >= .1 && !g.hitDone) {
          g.hitDone = true;
          if (Math.abs(thumbX - NX) < 78) { ouch = 1; gcLose(g); sfx.thud(); sfx.splat(); shake(12, .35); burst(thumbX, 330, '#ff5a5a', 14); ring(thumbX, 330, '#fff', 80); }
          else { hits++; dust = 1; bump = 1; sfx.hit(); sfx.thud(); sfx.blip(hits * 3); shake(6, .2); burst(NX, headY(), '#FFE14D', 10); floatText('+1', NX + 70, headY() - 40, '#5CFF7A', 38); if (hits >= 3) gcWin(g); }
        }
        if (hT >= .35) { hT = -1; g.hitDone = false; cool = .12; }
      }
    },
    draw(t) {
      bg('#FFB86B', '#f5ab5c', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, PY - 4, VW, 200); ctx.fillStyle = '#b97a3c'; ctx.fillRect(-OX, PY, VW, 200);
      for (let i = 0; i < 6; i++) ctx.fillStyle = 'rgba(0,0,0,.14)', ctx.fillRect(-OX, PY + 20 + i * 30, VW, 3);
      for (let i = -Math.ceil(OX / 130); i < 6 + Math.ceil(OX / 130); i++) ctx.fillRect(100 + i * 130, PY, 3, 30);
      // nail
      const hy = headY();
      box(NX - 8, hy, 16, PY - hy, '#aab', 4);
      box(NX - 34, hy - 14 + bump * 5, 68, 16, '#cfd4de', 4);
      // thumb
      const tx = thumbX, tTop = 220;
      if (!g.result || g.result === 'win' || ouch > 0 || true) {
        const col = ouch > 0 || g.result === 'lose' ? '#ff5a5a' : '#ffbfa0';
        box(tx - 46, tTop + 30, 92, PY - tTop - 30, col, 5); circ(tx, tTop + 30, 46, col, 5); ctx.fillStyle = col; ctx.fillRect(tx - 46, tTop + 30, 92, 40);
        box(tx - 24, tTop + 6, 48, 38, '#fff0e0', 3);
        ctx.fillStyle = INK; ctx.fillRect(tx - 24, tTop + 70, 12, 14); ctx.fillRect(tx + 12, tTop + 70, 12, 14);
        ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(tx - 32, tTop + 62); ctx.lineTo(tx - 8, tTop + 70); ctx.moveTo(tx + 32, tTop + 62); ctx.lineTo(tx + 8, tTop + 70); ctx.stroke();
        if (g.result === 'lose') { ctx.beginPath(); ctx.arc(tx, tTop + 118, 14, 0, 7); ctx.fillStyle = INK; ctx.fill(); box(tx - 40, tTop + 140, 80, 20, '#fff', 3); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tx - 20, tTop + 140); ctx.lineTo(tx - 20, tTop + 160); ctx.moveTo(tx + 20, tTop + 140); ctx.lineTo(tx + 20, tTop + 160); ctx.stroke(); }
        else { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(tx, tTop + 124, 12, Math.PI + .3, -.3); ctx.stroke(); }
      }
      // hammer
      let hh = hy - 190;
      if (hT >= 0) { const f = hT / .1; hh = hT < .1 ? hy - 190 + (190 - 28) * Math.min(1, f * f) : hy - 28 - Math.min(1, (hT - .1) / .25) * 150; }
      const hx = NX;
      ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(hx, hh); ctx.lineTo(hx + 190, hh - 260); ctx.stroke(); ctx.strokeStyle = '#d9a066'; ctx.lineWidth = 16; ctx.stroke(); ctx.lineCap = 'butt';
      box(hx - 62, hh - 36, 124, 56, '#7a8599', 5); ctx.fillStyle = '#aab4c8'; ctx.fillRect(hx - 56, hh - 30, 112, 12);
      if (dust > 0) { star(NX, hy - 20, 50 * dust + 20, 14, 8, now * 4, '#FFE14D', 3); txt('BONK!', NX + 90, hy - 30, 34, '#fff'); }
      if (ouch > 0) txt('AAAH!', tx, 160, 56, '#ff3b3b');
      for (let i = 0; i < 3; i++) box(40 + i * 44, 40, 34, 14, i < hits ? '#5CFF7A' : '#4a4558', 3);
      shadow(110, PY + 4, 50, 10, .3); claude(110, PY - 4, 6, { mood: gcMood(g) });
    }
  };
  return g;
}

reg('gc_sole', gcSole, 'MOVE');
reg('gc_rhino', gcRhino, 'OLE');
reg('gc_alley', gcAlley, 'SHOOT');
reg('gc_pinball', gcPinball, 'BOUNCE');
reg('gc_batter', gcBatter, 'SWING');
reg('gc_snap', gcSnap, 'SNAP');
reg('gc_trap', gcTrap, 'DROP');
reg('gc_douse', gcDouse, 'EXTINGUISH');
reg('gc_putt', gcPutt, 'PUTT');
reg('gc_park', gcPark, 'PARK');
reg('gc_goalie', gcGoalie, 'BLOCK');
reg('gc_nail', gcNail, 'HAMMER');
