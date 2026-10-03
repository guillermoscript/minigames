'use strict';
/* Twisted! wave 1 — inspired by WarioWare: Twisted! (tilt the whole console).
   The whole room rotates with the tilt: mouse/pointer X (centre = level, edges = +-35deg) or Left/Right / A/D.
   Games: tw_tilt (marble), tw_spin (balance stack), tw_pour (pitcher), tw_dial (safe dial). */
(function () {

const MAXT = 35 * Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const lerp = (a, b, k) => a + (b - a) * k;
const mood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;

/* world -> screen (room is rotated by th around the screen centre) */
const w2s = (x, y, th) => ({ x: W / 2 + x * Math.cos(th) - y * Math.sin(th), y: H / 2 + x * Math.sin(th) + y * Math.cos(th) });

/* tilt controller: pointer X, or keys (ramp while held, spring back when released) */
function twCtl(rate) {
  let ang = 0, tgt = 0, mode = 0, px = W / 2;
  return {
    get ang() { return ang; },
    move(p) { px = p.x; if (!(keys.ArrowLeft || keys.ArrowRight || keys.KeyA || keys.KeyD)) mode = 1; },
    update(dt) {
      const l = keys.ArrowLeft || keys.KeyA, r = keys.ArrowRight || keys.KeyD;
      if (l || r) { mode = 2; tgt = clamp(tgt + ((r ? 1 : 0) - (l ? 1 : 0)) * 2.2 * dt, -MAXT, MAXT); }
      else if (mode === 2) { tgt += clamp(-tgt, -1.6 * dt, 1.6 * dt); }
      else if (mode === 1) tgt = clamp((px - W / 2) / 320, -1, 1) * MAXT;
      ang += (tgt - ang) * (1 - Math.exp(-rate * dt));
    }
  };
}

/* the rotating cream/orange room. call inside ctx.save(); translate(W/2,H/2); rotate(th) */
function twRoom(floorY, windowX) {
  ctx.fillStyle = '#FFF0D2'; ctx.fillRect(-900, -900, 1800, 1800);
  ctx.fillStyle = '#FFDDA6'; for (let x = -900; x < 900; x += 100) ctx.fillRect(x, -900, 50, 1800);
  ctx.fillStyle = INK; ctx.fillRect(-900, floorY - 5, 1800, 1300);
  ctx.fillStyle = '#E9873C'; ctx.fillRect(-900, floorY, 1800, 1300);
  ctx.fillStyle = 'rgba(20,16,28,.18)'; for (let x = -900; x < 900; x += 130) ctx.fillRect(x, floorY, 6, 1300);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-900, floorY, 1800, 10);
  // window + sun so the rotation reads clearly
  const wx = windowX, wy = -215;
  box(wx - 55, wy - 60, 110, 120, '#BFEFFF', 5);
  ctx.fillStyle = INK; ctx.fillRect(wx - 3, wy - 60, 6, 120); ctx.fillRect(wx - 55, wy - 3, 110, 6);
  circ(wx - 26, wy - 30, 11, '#FFE14D', 3);
}
function twMeter(th) {
  const mx = W + OX - 55;
  circ(mx, 52, 28, '#fff', 4);
  ctx.save(); ctx.translate(mx, 52); ctx.rotate(th * 1.6);
  ctx.fillStyle = INK; ctx.fillRect(-21, -5, 42, 10); ctx.fillStyle = OR; ctx.fillRect(-18, -3, 36, 6);
  ctx.fillStyle = '#FFE14D'; ctx.beginPath(); ctx.arc(0, -7, 5, 0, 7); ctx.fill();
  ctx.restore();
}
function twPoly(pts, fill, o = 4) {
  ctx.beginPath(); pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.closePath(); ctx.lineJoin = 'round';
  if (o) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}

/* ───────────── 1 TILT: roll the marble to the flag, don't fall in a pit ───────────── */
reg('tw_tilt', sp => {
  const ctl = twCtl(7);
  const FY = 60, R = 17, HW = 34 + (sp - 1) * 9, PX = [-120, 70], VC = 235 + 35 * (sp - 1), G = 1250 + 250 * (sp - 1);
  let x = -285, vx = 0, y = FY - R, vy = 0, rot = 0, c = 0, mode = 0, rollT = 0, pit = -1, th = 0, crossed = [false, false], flagT = 0;
  const g = {
    wide: true, cmd: 'TILT!', hint: 'MOUSE X / ← → : TILT THE ROOM, ROLL TO THE FLAG', thint: 'DRAG LEFT / RIGHT TO TILT', dur: 5,
    move(p) { ctl.move(p); }, down(p) { ctl.move(p); },
    update(dt) {
      c += dt; flagT += dt; ctl.update(dt); th = ctl.ang;
      if (mode === 0 && !g.result) {
        vx += G * Math.sin(th) * dt; vx *= Math.exp(-.3 * dt); x += vx * dt; rot += vx / R * dt;
        if (x < -300 + R) { if (vx < -80) { sfx.tick(); } x = -300 + R; vx *= -.3; }
        if (x > 300 - R) { x = 300 - R; vx = 0; }
        let hop = 0;
        PX.forEach((p, i) => {
          const dx = Math.abs(x - p);
          if (dx < HW * .8 && Math.abs(vx) < VC) {
            mode = 1; pit = i; vy = 0; g.result = 'lose';
            sfx.miss(); sfx.thud(); shake(8, .25);
            const s = w2s(x, FY, th); burst(s.x, s.y, '#ff4d4d', 12); ring(s.x, s.y, '#ff4d4d', 70); floatText('OOPS!', s.x, s.y - 70, '#ff4d4d', 40);
          } else if (dx < HW + R * .6) {
            hop = Math.max(hop, 14 * (1 - (dx / (HW + R * .6)) ** 2));
            if (!crossed[i] && Math.abs(vx) >= VC) { crossed[i] = true; sfx.whoosh(true); sfx.boing(); const s = w2s(x, FY, th); floatText('HOP!', s.x, s.y - 50, '#5CFF7A', 28); ring(s.x, s.y, '#fff', 40, .3); }
          }
        });
        y = FY - R - hop;
        rollT -= dt;
        if (rollT <= 0 && Math.abs(vx) > 40) { rollT = .14; noise(.06, Math.min(.03, Math.abs(vx) / 12000), 180, 320, 'lowpass'); }
        if (x >= 268) {
          g.result = 'win'; vx = 0; sfx.coin(); sfx.sparkle();
          const s = w2s(268, FY - 60, th); confetti(s.x, s.y, 30); burst(s.x, s.y, '#FFE14D', 14); ring(s.x, s.y, '#fff', 90); floatText('GOAL!', s.x, s.y - 40, '#5CFF7A', 44); shake(6, .2);
        }
      } else if (mode === 1) {
        vy += 2200 * dt; y += vy * dt; vx *= .9;
        const p = PX[pit]; x = clamp(x + (p - x) * .1, p - (HW - R * .6), p + (HW - R * .6));
      }
    },
    draw() {
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(th);
      twRoom(235, -250);
      // table legs + shadow
      shadow(0, 238, 320, 18, .28);
      box(-285, 100, 30, 130, '#B85C2A', 4); box(255, 100, 30, 130, '#B85C2A', 4);
      // marble falling in a pit is drawn before the slab so it drops "inside"
      const drawMarble = () => {
        if (mode === 1 && y > 150) ctx.globalAlpha = clamp(1 - (y - 150) / 80, 0, 1);
        const cx = x, cy = y;
        circ(cx, cy, R, OR, 4);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
        ctx.fillStyle = '#FFC27A'; ctx.beginPath(); ctx.arc(0, 0, R * .62, -.5, 1.1); ctx.lineTo(0, 0); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(R * .45, -R * .45, 3, 0, 7); ctx.fill();
        ctx.restore();
        // eyes (stay upright)
        const sad = g.result === 'lose', hap = g.result === 'win', lk = clamp(vx / 300, -1, 1) * 2;
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (const ex of [-5, 5]) {
          if (sad) { ctx.beginPath(); ctx.moveTo(cx + ex - 3, cy - 6); ctx.lineTo(cx + ex + 3, cy); ctx.moveTo(cx + ex + 3, cy - 6); ctx.lineTo(cx + ex - 3, cy); ctx.stroke(); }
          else if (hap) { ctx.beginPath(); ctx.moveTo(cx + ex - 3, cy - 1); ctx.lineTo(cx + ex, cy - 5); ctx.lineTo(cx + ex + 3, cy - 1); ctx.stroke(); }
          else { circ(cx + ex, cy - 3, 4, '#fff', 2); ctx.fillStyle = INK; ctx.fillRect(cx + ex + lk - 1.5, cy - 4.5, 3, 3); }
        }
        ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
      };
      if (mode === 1) drawMarble();
      // tray: slab segments between pits
      const segs = [[-300, PX[0] - HW], [PX[0] + HW, PX[1] - HW], [PX[1] + HW, 300]];
      for (const s of segs) { box(s[0], FY, s[1] - s[0], 40, '#F2B15C', 4); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(s[0], FY, s[1] - s[0], 6); }
      for (const p of PX) {
        ctx.fillStyle = INK; ctx.fillRect(p - HW, FY - 2, 2 * HW, 44);
        ctx.fillStyle = '#FFE14D'; for (const sx of [p - HW - 12, p + HW + 2]) { ctx.fillRect(sx, FY - 6, 10, 6); }
      }
      // end walls
      box(-312, FY - 34, 12, 74, '#E9873C', 4); box(300, FY - 34, 12, 74, '#E9873C', 4);
      // goal flag
      box(268, FY - 78, 6, 78, '#fff', 3);
      ctx.beginPath(); for (let i = 0; i <= 8; i++) ctx.lineTo(274 + i * 4.5, FY - 78 + Math.sin(flagT * 8 + i * .7) * 3); for (let i = 8; i >= 0; i--) ctx.lineTo(274 + i * 4.5, FY - 50 + Math.sin(flagT * 8 + i * .7) * 3);
      ctx.closePath(); ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#5CFF7A'; ctx.fill();
      star(283, FY - 64, 7, 3, 5, flagT * 2, '#fff', 1);
      ctx.fillStyle = 'rgba(92,255,122,.35)'; ctx.fillRect(252, FY - 3, 34, 4);
      // marble shadow + marble
      if (mode === 0) { shadow(x, FY + 2, 17, 5, .3); drawMarble(); }
      ctx.restore();
      twMeter(th); vignette(.18);
    }
  };
  return g;
}, 'Tilt');

/* ───────────── 2 SPIN: keep the stack balanced by rotating against its lean ───────────── */
reg('tw_spin', sp => {
  const ctl = twCtl(9);
  const D = 4.5 / Math.sqrt(sp), K = 6.5 + 2 * (sp - 1), FLOOR = 215, PY = 95;
  let r = (Math.random() < .5 ? -1 : 1) * .12, rv = 0, c = 0, th = 0, gust = .6 + Math.random() * .3, creak = 0, fallen = false, spinT = 0;
  const cols = ['#FFF6E0', OR, '#4DB8FF', '#FF8FC8', '#FFE14D'];
  const plates = cols.map((col, i) => ({ col, i, x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0 }));
  const lean = () => r + th;     // absolute lean as seen on screen
  const plateLocal = (i) => ({ x: Math.sin(c * 3 + i) * 1.5 + r * i * 6, y: -(i * 24 + 12), w: 118 - i * 8 });
  const g = {
    wide: true, cmd: 'SPIN!', hint: 'MOUSE X / ← → : ROTATE AGAINST ITS LEAN', thint: 'DRAG LEFT / RIGHT TO COUNTER THE LEAN', dur: 4.5, timeWin: true,
    move(p) { ctl.move(p); }, down(p) { ctl.move(p); },
    update(dt) {
      c += dt; spinT += dt; ctl.update(dt); th = ctl.ang;
      if (!fallen) {
        const a = lean();
        rv += (K * Math.sin(a) - 3 * r + Math.sin(c * 2.3 + 1) * .8) * dt;
        gust -= dt;
        if (gust <= 0) { gust = .7 + Math.random() * .6; rv += (Math.random() < .5 ? -1 : 1) * (1.1 + .4 * sp); sfx.whoosh(Math.random() < .5); }
        rv *= Math.exp(-2.5 * dt); r += rv * dt;
        creak -= dt;
        if (Math.abs(a) > .28 && creak <= 0) { creak = .14; sfx.blip(Math.round(Math.abs(a) * 14)); }
        if (Math.abs(a) > .58 && !g.result) {
          fallen = true; g.result = 'lose';
          const cs = Math.cos(r), sn = Math.sin(r);
          plates.forEach((p, i) => {
            const l = plateLocal(i);
            p.x = l.x * cs + l.y * sn; p.y = PY - l.x * sn + l.y * cs; p.a = r;
            const dir = a > 0 ? 1 : -1; p.vx = dir * (90 + i * 45); p.vy = -140 - i * 30; p.va = dir * (2 + i * 1.3);
          });
          sfx.miss(); sfx.thud(); sfx.splat(); shake(10, .35);
          const s = w2s(0, FLOOR - 40, th); burst(s.x, s.y, '#FFE14D', 18); ring(s.x, s.y, '#ff4d4d', 100); floatText('CRASH!', s.x, s.y - 120, '#ff4d4d', 48);
        }
      } else {
        const gx = Math.sin(th) * 1800, gy = Math.cos(th) * 1800;
        for (const p of plates) { p.vx += gx * dt; p.vy += gy * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; if (p.y > FLOOR - 10 && p.vy > 0) { p.y = FLOOR - 10; p.vy *= -.35; p.vx *= .7; p.va *= .6; } }
      }
    },
    draw() {
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(th);
      twRoom(FLOOR, 260);
      shadow(0, FLOOR + 6, 130, 18, .3);
      // pedestal with spinning stripes
      box(-70, PY, 140, FLOOR - PY, '#FFB35C', 5);
      ctx.save(); ctx.beginPath(); ctx.rect(-70, PY, 140, FLOOR - PY); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.4)'; for (let i = -2; i < 8; i++) { const yy = PY + ((i * 30 + spinT * 60) % 210); ctx.fillRect(-70, yy, 140, 10); }
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(0, PY, 90, 16, 0, 0, 7); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#FFE0A8'; ctx.fill();
      ctx.fillStyle = OR; for (let i = 0; i < 6; i++) { const a = spinT * 3 + i * Math.PI / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * 65, PY + Math.sin(a) * 9, 4, 0, 7); ctx.fill(); }
      // stack
      if (!fallen) {
        ctx.save(); ctx.translate(0, PY); ctx.rotate(r);
        for (let i = 0; i < plates.length; i++) {
          const l = plateLocal(i); box(l.x - l.w / 2, l.y - 11, l.w, 22, plates[i].col, 4);
          ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(l.x - l.w / 2, l.y - 11, l.w, 5);
        }
        const top = plateLocal(plates.length - 1);
        claude(top.x, top.y - 24 + 0, 4.2, { mood: Math.abs(lean()) > .3 ? 'sad' : null });
        ctx.restore();
      } else {
        for (const p of plates) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); const w = 118 - p.i * 8; box(-w / 2, -11, w, 22, p.col, 4); ctx.restore(); }
      }
      ctx.restore();
      // absolute vertical reference (screen space) + progress bar
      ctx.save(); ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgba(20,16,28,.35)'; ctx.lineWidth = 4;
      const piv = w2s(0, PY, th); ctx.beginPath(); ctx.moveTo(piv.x, piv.y); ctx.lineTo(piv.x, piv.y - 260); ctx.stroke(); ctx.restore();
      const a = lean(), warn = clamp(Math.abs(a) / .58, 0, 1);
      box3(20 - OX, 20, 200, 24, '#fff', 4, 4); ctx.fillStyle = warn > .6 ? '#ff4d4d' : '#5CFF7A'; ctx.fillRect(20 - OX, 20, 200 * clamp(1 - warn, 0, 1), 24);
      txt('BALANCE', 120 - OX, 32, 16, '#fff');
      box3(20 - OX, 62, 200, 14, '#fff', 3, 3); ctx.fillStyle = '#4DB8FF'; ctx.fillRect(20 - OX, 62, 200 * clamp(c / D, 0, 1), 14);
      twMeter(th); vignette(.18 + warn * .15);
    }
  };
  return g;
}, 'Spin');

/* ───────────── 3 POUR: tilt the pitcher to fill the glass to the line ───────────── */
reg('tw_pour', sp => {
  const ctl = twCtl(7);
  const P = { x: -200, y: -50 }, TABLE = 170, GX = -35, GWT = 110, GWB = 92, GTOP = 30, N = 52, LIM = 22 - 3 * (sp - 1);
  const LINEY = GTOP + 38, FLOORY = TABLE;
  let th = 0, phi = 0, V = 1, acc = 0, fill = 0, spilled = 0, lvl = 0, c = 0, parts = [], splT = 0, sndT = 0, hold = false;
  const half = y => lerp(GWT, GWB, clamp((y - GTOP) / (TABLE - GTOP), 0, 1)) / 2 - 6;
  const spout = () => ({ x: P.x + 84 * Math.cos(phi) + 78 * Math.sin(phi), y: P.y + 84 * Math.sin(phi) - 78 * Math.cos(phi) });
  const g = {
    wide: true, cmd: 'POUR!', hint: 'MOUSE X / → : TILT TO POUR, FILL TO THE LINE', thint: 'DRAG RIGHT TO POUR, LEFT TO STOP', dur: 5,
    move(p) { ctl.move(p); }, down(p) { ctl.move(p); },
    update(dt) {
      c += dt; ctl.update(dt); const u = ctl.ang / MAXT; th = ctl.ang * .4; phi = u > 0 ? u * 1.5 : u * .5;
      if (!g.result) {
        const phi0 = .3 + (1 - V) * .9, k = clamp((phi - phi0) * 5, 0, 1);
        if (k > 0 && V > 0) {
          acc += k * 60 * dt;
          while (acc >= 1 && V > 0) {
            acc -= 1; V -= 1 / 125; const s = spout(), sp0 = 110 + k * 120;
            parts.push({ x: s.x, y: s.y, vx: Math.cos(phi) * sp0 + (Math.random() - .5) * 24, vy: Math.sin(phi) * sp0 + (Math.random() - .5) * 24 });
          }
          sndT -= dt; if (sndT <= 0) { sndT = .09; noise(.1, .025, 900, 1800, 'bandpass', 0, 2); }
        }
      }
      const gx = Math.sin(th) * 1500, gy = Math.cos(th) * 1500;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.vx += gx * dt; p.vy += gy * dt; const py0 = p.y; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y >= GTOP && p.y < TABLE - 4 && Math.abs(p.x - GX) < half(p.y)) {
          parts.splice(i, 1); fill++; sfx.blip(Math.min(14, fill / 4 | 0) - 4);
          if (fill % 6 === 0) { const s = w2s(GX, LINEY + 30, th); burst(s.x, s.y, '#FFC27A', 4, 120); }
          continue;
        }
        if (p.y >= TABLE - 3 || p.y > 420 || Math.abs(p.x) > 520 + OX) {
          parts.splice(i, 1);
          if (!g.result) {
            spilled++; splT -= 1;
            if (spilled % 3 === 1) { sfx.splat(); const s = w2s(p.x, TABLE, th); burst(s.x, s.y, '#FFC27A', 5, 160); }
            if (spilled > LIM) { g.result = 'lose'; sfx.miss(); sfx.thud(); shake(8, .25); const s = w2s(P.x + 120, -80, th); floatText('SPILLED!', s.x, s.y, '#ff4d4d', 44); }
          }
        }
      }
      lvl += (fill / N - lvl) * (1 - Math.exp(-14 * dt));
      if (!g.result) {
        if (fill >= N) {
          g.result = 'win'; sfx.coin(); sfx.sparkle(); const s = w2s(GX, LINEY, th); confetti(s.x, s.y, 30); ring(s.x, s.y, '#fff', 100); burst(s.x, s.y, '#FFC27A', 14);
          floatText(spilled < 4 ? 'PERFECT!' : 'GULP!', s.x, s.y - 80, '#5CFF7A', 44); shake(5, .15);
        } else if (V <= 0 && parts.length === 0) { g.result = 'lose'; sfx.miss(); sfx.thud(); const s = w2s(P.x, -130, th); floatText('EMPTY!', s.x, s.y, '#ff4d4d', 40); }
      }
    },
    draw() {
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(th);
      twRoom(TABLE + 60, 250);
      // table
      shadow(0, TABLE + 66, 330, 18, .25);
      box(-300, TABLE, 600, 24, '#B85C2A', 4); box(-270, TABLE + 24, 28, 36, '#B85C2A', 4); box(242, TABLE + 24, 28, 36, '#B85C2A', 4);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-300, TABLE, 600, 5);
      // puddle
      if (spilled > 0) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-60, TABLE - 1, Math.min(200, 12 + spilled * 7) + 3, 7, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#FF9A3D'; ctx.beginPath(); ctx.ellipse(-60, TABLE - 2, Math.min(200, 12 + spilled * 7), 5, 0, 0, 7); ctx.fill(); }
      // glass
      const gp = [[GX - GWT / 2, GTOP], [GX + GWT / 2, GTOP], [GX + GWB / 2, TABLE], [GX - GWB / 2, TABLE]];
      shadow(GX + 6, TABLE, GWB / 2 + 12, 7, .3);
      twPoly(gp, 'rgba(210,240,255,.7)', 5);
      ctx.save(); ctx.beginPath(); ctx.moveTo(GX - half(GTOP), GTOP); ctx.lineTo(GX + half(GTOP), GTOP); ctx.lineTo(GX + half(TABLE), TABLE - 4); ctx.lineTo(GX - half(TABLE), TABLE - 4); ctx.closePath(); ctx.clip();
      const top = (TABLE - 4) - lvl * ((TABLE - 4) - LINEY);
      ctx.save(); ctx.translate(GX, top); ctx.rotate(-th); ctx.fillStyle = '#FF9A3D'; ctx.fillRect(-200, 0, 400, 400); ctx.fillStyle = '#FFC27A'; ctx.fillRect(-200, 0, 400, 6); ctx.restore();
      ctx.restore();
      // target line
      ctx.save(); ctx.setLineDash([10, 7]); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(GX - GWT / 2 - 14, LINEY); ctx.lineTo(GX + GWT / 2 + 14, LINEY); ctx.stroke(); ctx.restore();
      star(GX + GWT / 2 + 30, LINEY, 11, 5, 5, c * 2, '#FFE14D', 3);
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(GX - GWT / 2 + 9, GTOP + 10, 6, 60);
      // pitcher
      ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(phi);
      ctx.beginPath(); ctx.arc(-58, 0, 34, -1.2, 1.2); ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#FFE0A8'; ctx.stroke();
      const body = [[-48, -62], [30, -62], [84, -78], [52, -40], [56, 62], [-56, 62]];
      twPoly(body, '#FFF6E0', 5);
      ctx.save(); ctx.beginPath(); body.forEach(q => ctx.lineTo(q[0], q[1])); ctx.closePath(); ctx.clip();
      ctx.save(); ctx.rotate(-(phi + th)); const ly = 60 - V * 120; ctx.fillStyle = '#FF9A3D'; ctx.fillRect(-300, ly, 600, 400); ctx.fillStyle = '#FFC27A'; ctx.fillRect(-300, ly, 600, 6); ctx.restore();
      ctx.restore();
      twPoly(body, 'rgba(0,0,0,0)', 5);
      ctx.fillStyle = OR; ctx.fillRect(-56, 40, 112, 10);
      const pour = !g.result && parts.length > 0 && V > 0, hap = g.result === 'win', sad = g.result === 'lose';
      ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = INK;
      for (const ex of [-14, 16]) {
        if (hap) { ctx.beginPath(); ctx.moveTo(ex - 5, -4); ctx.lineTo(ex, -11); ctx.lineTo(ex + 5, -4); ctx.stroke(); }
        else if (sad) { ctx.beginPath(); ctx.moveTo(ex - 4, -12); ctx.lineTo(ex + 4, -4); ctx.moveTo(ex + 4, -12); ctx.lineTo(ex - 4, -4); ctx.stroke(); }
        else { circ(ex, -8, 6, '#fff', 2); ctx.fillStyle = INK; ctx.fillRect(ex + (pour ? 1 : 0) - 2, -9 + (pour ? 1 : 0), 4, 4); }
      }
      ctx.beginPath(); if (pour) ctx.arc(2, 10, 6, 0, 7); else ctx.arc(2, 14, 8, .2, Math.PI - .2); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.restore();
      // droplets
      for (const p of parts) circ(p.x, p.y, 5, '#FF9A3D', 2);
      ctx.restore();
      // spill meter
      const sp0 = clamp(spilled / LIM, 0, 1);
      box3(20 - OX, 20, 200, 24, '#fff', 4, 4); ctx.fillStyle = sp0 > .6 ? '#ff4d4d' : '#FFB35C'; ctx.fillRect(20 - OX, 20, 200 * (1 - sp0), 24); txt('NO SPILL', 120 - OX, 32, 16, '#fff');
      twMeter(th); vignette(.18);
    }
  };
  return g;
}, 'Pour');

/* ───────────── 4 TWIST: crack the safe, turn the dial onto the ghost mark and hold ───────────── */
reg('tw_dial', sp => {
  const FLOOR = 228, CY = 0, HOLD = .75 + .15 * (sp - 1), TOL = (7.5 - 2.2 * (sp - 1)) * Math.PI / 180;
  const T = (Math.random() < .5 ? -1 : 1) * (1.1 + Math.random() * 1.2);
  let d = 0, c = 0, mode = 0, pa = 0, hold = 0, tickT = .2, th = 0, det = 0, flash = 0;
  const err = () => Math.abs(wrap(d - T));
  const g = {
    wide: true, cmd: 'TWIST!', hint: 'MOUSE AROUND THE DIAL / ← → : MATCH THE MARK & HOLD', thint: 'DRAG AROUND THE DIAL TO MATCH THE MARK',
    dur: 5,
    move(p) { const dx = p.x - W / 2, dy = p.y - (H / 2 + CY); if (Math.hypot(dx, dy) > 30 && !(keys.ArrowLeft || keys.ArrowRight || keys.KeyA || keys.KeyD)) { pa = Math.atan2(dx, -dy) - th; mode = 1; } },
    down(p) { g.move(p); },
    update(dt) {
      c += dt; flash = Math.max(0, flash - dt);
      th = .06 * Math.sin(c * 1.7) + clamp(d, -2.4, 2.4) * .05;
      if (g.result) return;
      const l = keys.ArrowLeft || keys.KeyA, r = keys.ArrowRight || keys.KeyD;
      if (l || r) { d = wrap(d + ((r ? 1 : 0) - (l ? 1 : 0)) * 2.4 * dt); mode = 2; }
      else if (mode === 1) d = wrap(d + wrap(pa - d) * (1 - Math.exp(-14 * dt)));
      const e = err(), inn = e < TOL;
      const nd = Math.floor(d / (Math.PI / 12)); if (nd !== det) { det = nd; snd(520 + (nd % 3) * 60, .025, 'square', .025); }
      hold = inn ? hold + dt : Math.max(0, hold - dt * 2);
      tickT -= dt;
      if (tickT <= 0) {
        const prox = clamp(1 - e / 1.5, 0, 1); tickT = .4 - .32 * prox;
        if (inn) { sfx.tickHi(); tickT = .08; } else sfx.blip(Math.round(-6 + prox * 20));
      }
      if (hold >= HOLD) {
        g.result = 'win'; flash = .4; sfx.coin(); sfx.sparkle(); sfx.stamp(); shake(6, .2);
        const s = w2s(0, CY, th); confetti(s.x, s.y, 36); ring(s.x, s.y, '#fff', 150); burst(s.x, s.y, '#FFE14D', 16); floatText('CLICK!', s.x, s.y - 190, '#5CFF7A', 52);
      }
    },
    draw() {
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(th);
      twRoom(FLOOR, 330);
      shadow(0, FLOOR + 8, 230, 20, .3);
      claude(-300, FLOOR, 6, { mood: mood(g) });
      // safe door
      box3(-195, -225, 390, 440, g.result === 'win' ? '#8ee59a' : '#FFB35C', 6, 8);
      ctx.fillStyle = 'rgba(20,16,28,.12)'; ctx.fillRect(-175, -205, 350, 400);
      for (const q of [[-180, -210], [180, -210], [-180, 200], [180, 200]]) circ(q[0], q[1], 7, '#FFF6E0', 3);
      box(-215, -150, 20, 40, '#E9873C', 4); box(-215, 100, 20, 40, '#E9873C', 4);
      // fixed ring + ticks
      const RR = 168; circ(0, CY, RR + 14, '#FFF6E0', 5);
      ctx.strokeStyle = INK; ctx.lineCap = 'round';
      for (let i = 0; i < 48; i++) { const a = i * Math.PI / 24, big = i % 4 === 0, r1 = RR - (big ? 14 : 7), r2 = RR + 4; ctx.lineWidth = big ? 4 : 2; ctx.beginPath(); ctx.moveTo(Math.sin(a) * r1, CY - Math.cos(a) * r1); ctx.lineTo(Math.sin(a) * r2, CY - Math.cos(a) * r2); ctx.stroke(); }
      // ghost target mark
      const e = err(), pulse = .55 + .45 * Math.sin(c * 9);
      ctx.save(); ctx.translate(0, CY); ctx.rotate(T);
      ctx.globalAlpha = .35 + .3 * pulse; ctx.setLineDash([8, 8]); ctx.lineWidth = 4; ctx.strokeStyle = '#E9873C'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -RR + 20); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      twPoly([[0, -RR - 6], [-15, -RR - 36], [15, -RR - 36]], e < TOL ? '#5CFF7A' : '#FFE14D', 4);
      ctx.restore();
      // knob
      ctx.save(); ctx.translate(0, CY); ctx.rotate(d);
      circ(0, 0, 120, '#FFE9B8', 5);
      ctx.fillStyle = 'rgba(20,16,28,.1)'; ctx.beginPath(); ctx.arc(0, 0, 100, 0, 7); ctx.fill();
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * Math.PI * 2 / 3); box(-14, -104, 28, 98, '#E9873C', 4); ctx.restore(); }
      circ(0, 0, 30, '#FFF6E0', 5);
      twPoly([[0, -128], [-13, -102], [13, -102]], OR, 4);
      ctx.restore();
      // hold progress arc
      if (hold > 0) { ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(0, CY, RR + 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(hold / HOLD, 0, 1)); ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = '#5CFF7A'; ctx.stroke(); }
      ctx.lineCap = 'butt';
      ctx.restore();
      if (flash > 0) { ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; ctx.fillRect(-OX, 0, VW, H); ctx.globalAlpha = 1; }
      twMeter(th); vignette(.18);
    }
  };
  return g;
}, 'Twist');

})();
