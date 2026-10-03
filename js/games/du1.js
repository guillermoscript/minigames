'use strict';
/* DUO microgames (scope 'du'): two players inside ONE microgame, each with a different role, one shared verdict (see js/party.js duoCtx).
   fn(sp, D): D = { role: 0|1, partner, send(type, data, latest), onMsg(fn(type, data)) }. Both clients build the same level from the room seed
   (all randomness is drawn in the constructor from `R`, the same number of draws whatever the role), then each role owns its own variables and
   publishes them; the partner renders them ~150 ms behind (track()). Nothing ever blocks local input.
   One role is the JUDGE: it decides win/lose and tells the partner with an 'end' message (the server accepts a team win if either player reports one).
   The judge finishes `END_SLACK` seconds before the shared time limit so its verdict arrives before the partner's own timer runs out.
   Each game: {cmd, hint, thint, roleLabel, dur, update(dt), draw(t), down/move/up/key/keyup}; g.result = 'win'|'lose' */
(function () {

const PUR = '#7C4DFF', PUR2 = '#6a3de8', YEL = '#FFE14D', GRN = '#5CFF7A', RED = '#ff4d4d', BLU = '#4DB8FF', PNK = '#FF4D9E', ORG = '#FF9A4D', LIL = '#B49CFF';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mkR = () => mulberry32(Math.floor(Math.random() * 4294967296));   // Math.random is seeded while the constructor runs
const END_SLACK = .6, LAG = .15;
const SOLO = { role: 0, roles: 2, partner: null, send() {}, onMsg() {} };   // only used if a DUO game is ever built without a partner
const duBg = t => { bg(PUR, PUR2, t); ctx.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 6; i++) ctx.fillRect(-OX, 60 + i * 100, VW, 40); };
const duWin = (x, y) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 30); ring(x, y, '#fff', 110); };
const duLose = (x, y) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, RED, 14); ring(x, y, RED, 80); };
const duMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
function duBar(k, label) {                 // progress bar toward the goal
  const x = 200, y = 74, w = 400; k = clamp(k, 0, 1);
  box(x, y, w, 22, '#3a3550', 3); ctx.fillStyle = k >= 1 ? GRN : YEL; ctx.fillRect(x, y, w * k, 22);
  star(x + w, y + 11, 20, 9, 5, now * 2, k >= 1 ? GRN : '#4a4558', 3);
  if (label) txt(label, 400, 126, 40, '#fff');
}
/* a number that arrives in snapshots; at() reads it LAG seconds in the past, interpolated (remote entities never jump) */
function track() {
  const a = [];
  return {
    push(v) { a.push({ t: now, v }); if (a.length > 40) a.shift(); },
    at(lag) {
      if (!a.length) return null; const T = now - (lag === undefined ? LAG : lag);
      if (T <= a[0].t) return a[0].v;
      for (let i = 1; i < a.length; i++) if (a[i].t >= T) { const p = a[i - 1], q = a[i]; return p.v + (q.v - p.v) * (T - p.t) / Math.max(1e-6, q.t - p.t); }
      return a[a.length - 1].v;
    },
  };
}
/* shared wiring: partner messages go to g.msg(), 'end' from the judge is the verdict for the other role */
function wire(g, D, judge, sp) {
  g.role = D.role; g.judge = D.role === judge; g.limit = g.dur / Math.sqrt(sp) - END_SLACK;
  D.onMsg((t, d) => {
    if (t === 'end') { if (!g.judge && !g.result) { g.result = d === 'win' ? 'win' : 'lose'; (g.result === 'win' ? duWin : duLose)(400, 330); } }
    else if (g.msg) g.msg(t, d);
  });
  g.finish = res => { if (g.result) return; g.result = res; D.send('end', res); (res === 'win' ? duWin : duLose)(400, 330); };
}
const rolePick = (D, a, b) => D.role === 0 ? a : b;

/* ═════════ 1 CATCH & THROW: P1 slides the basket, P2 drops coins (and bombs) from a swinging hand ═════════ */
function duCatch(sp, D) {
  D = D || SOLO; const R = mkR();
  const need = Math.round(5 + (sp - 1) * 5), vy = 400 + (sp - 1) * 120, FLOOR = 520, DY = 215, COOL = .42;
  const bombs = Array.from({ length: 80 }, () => R() < .24), dsp = 1.2 + R() * .4, dph = R() * 6.28;
  const handX = c => 400 + 300 * Math.sin(dsp * (.9 + sp * .1) * c + dph);
  const items = [], bxT = track();
  let bx = 400, kx = 0, caught = 0, flash = 0, nid = 0, nIdx = 0, cool = 0, lastBx = -1;
  const catcher = D.role === 0, yOf = it => DY + (g.c - it.t0) * vy;
  const g = {
    c: 0, dur: 11, pts: 0,
    cmd: catcher ? 'CATCH!' : 'THROW!', roleLabel: catcher ? 'CATCHER' : 'THROWER',
    hint: catcher ? 'MOVE THE MOUSE (OR ◄ ►) TO CATCH YOUR PARTNER\'S COINS - AVOID THE BOMBS' : 'CLICK / SPACE TO DROP THE COINS ONTO THE BASKET - NOT THE BOMBS!',
    thint: catcher ? 'DRAG TO CATCH YOUR PARTNER\'S COINS - AVOID THE BOMBS' : 'TAP TO DROP THE COINS ONTO THE BASKET - NOT THE BOMBS!',
    update(dt) {
      g.c += dt; flash = Math.max(0, flash - dt * 4); cool = Math.max(0, cool - dt);
      if (catcher) {
        if (!g.result) bx = clamp(bx + kx * 560 * dt, 60, 740);
        const r = Math.round(bx); if (r !== lastBx) { lastBx = r; D.send('bx', r, true); }
        for (const it of items) {
          if (it.got || g.result) continue; const y = yOf(it);
          if (y > FLOOR - 24 && y < FLOOR + 30 && Math.abs(it.x - bx) < 62) {
            it.got = true;
            if (it.b) { caught = Math.max(0, caught - 1); flash = 1; sfx.buzz(); shake(5, .15); burst(it.x, FLOOR, RED, 10); floatText('-1', it.x, FLOOR - 50, RED, 36); }
            else { caught++; sfx.coin(); burst(it.x, FLOOR, YEL, 8); }
            D.send('got', { id: it.id, b: it.b ? 1 : 0, n: caught });
          }
        }
        if (!g.result) { if (caught >= need) g.finish('win'); else if (g.c >= g.limit) g.finish('lose'); }
      }
      for (let i = items.length - 1; i >= 0; i--) if (yOf(items[i]) > FLOOR + 90 || (items[i].got && g.c - items[i].gt > .3)) items.splice(i, 1);
    },
    msg(t, d) {
      if (t === 'drop') items.push({ id: d.id, x: d.x, b: !!d.b, t0: g.c, got: false });
      else if (t === 'bx') bxT.push(d);
      else if (t === 'got') {
        caught = d.n; const it = items.find(q => q.id === d.id);
        if (it) { it.got = true; it.gt = g.c; }
        const x = it ? it.x : 400;
        if (d.b) { sfx.buzz(); flash = 1; burst(x, FLOOR, RED, 10); floatText('-1', x, FLOOR - 50, RED, 36); } else { sfx.coin(); burst(x, FLOOR, YEL, 8); }
      }
    },
    drop() {
      if (catcher || g.result || cool > 0 || g.c < .1) return;
      cool = COOL; const b = bombs[nIdx++ % bombs.length], it = { id: nid++, x: Math.round(handX(g.c)), b, t0: g.c, got: false };
      items.push(it); D.send('drop', { id: it.id, x: it.x, b: b ? 1 : 0 }); sfx.blip(8);
    },
    draw(t) {
      duBg(t); duBar(caught / need, `${caught} / ${need}`);
      const hX = handX(g.c), hb = bombs[nIdx % bombs.length];
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-OX, DY - 36, VW, 6);
      box(hX - 26, DY - 62, 52, 26, '#d9d4ee', 3);
      if (!catcher) { if (hb) ptBombAt(hX, DY - 12, 14); else token(hX, DY - 12, 16); }   // only the thrower sees what is in the hand
      for (const it of items) { if (it.got) continue; const y = yOf(it); if (y < -30 || y > H + 30) continue; it.b ? ptBombAt(it.x, y, 20) : token(it.x, y, 22); }
      ctx.fillStyle = INK; ctx.fillRect(-OX, FLOOR + 40, VW, H);
      const x = catcher ? bx : (bxT.at() === null ? 400 : bxT.at());
      box(x - 60, FLOOR - 6, 120, 44, flash > 0 ? RED : ORG, 4); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x - 60, FLOOR - 6, 120, 10);
      if (!catcher && !g.result) txt(TOUCH ? 'TAP!' : 'SPACE!', 400, 300, 56, 'rgba(255,255,255,.55)');
      claude(66 - OX, 590, 4.5, { mood: duMood(g) }); vignette(.22);
    },
    move(p) { if (catcher && !g.result) bx = clamp(p.x, 60, 740); },
    down(p) { catcher ? g.move(p) : g.drop(); },
    key(e) {
      if (catcher) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1; }
      else if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown')) g.drop();
    },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (kx < 0) kx = 0; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (kx > 0) kx = 0; } },
  };
  g.dbg = { caught: () => caught, bx: () => bx, items };
  wire(g, D, 0, sp);
  return g;
}
function ptBombAt(x, y, r) {
  circ(x, y, r, '#2b2b3a', 4); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 8, y - r); ctx.lineTo(x + 16, y - r - 12); ctx.stroke();
  star(x + 17, y - r - 14, 8 + Math.sin(now * 30) * 2, 3, 6, now * 8, '#FFB020', 2); ctx.fillStyle = '#fff'; ctx.fillRect(x - 9, y - 9, 6, 6);
}
reg('du_catch', duCatch, 'CATCH & THROW'); REGMAP.du_catch.duo = true;

/* ═════════ 2 DECODE: P1 reads a numeric code and points at the matching symbols, P2 presses what flashes ═════════ */
const SYMC = [BLU, YEL, GRN, PNK, ORG, LIL];
const SLOTS = [[190, 322], [400, 322], [610, 322], [190, 482], [400, 482], [610, 482]];
function drawSym(i, x, y, r) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.beginPath();
  if (i === 0) ctx.arc(0, 0, r, 0, 7);
  else if (i === 1) ctx.rect(-r * .9, -r * .9, r * 1.8, r * 1.8);
  else if (i === 2) { ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 1.05, r * .8); ctx.lineTo(-r * 1.05, r * .8); ctx.closePath(); }
  else if (i === 3) { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * .45 : r * 1.1; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
  else if (i === 4) { ctx.moveTo(0, -r * 1.15); ctx.lineTo(r * .85, 0); ctx.lineTo(0, r * 1.15); ctx.lineTo(-r * .85, 0); ctx.closePath(); }
  else { const q = r * .38, s = r * 1.05; ctx.moveTo(-q, -s); ctx.lineTo(q, -s); ctx.lineTo(q, -q); ctx.lineTo(s, -q); ctx.lineTo(s, q); ctx.lineTo(q, q); ctx.lineTo(q, s); ctx.lineTo(-q, s); ctx.lineTo(-q, q); ctx.lineTo(-s, q); ctx.lineTo(-s, -q); ctx.lineTo(-q, -q); ctx.closePath(); }
  ctx.stroke(); ctx.fill(); ctx.restore();
}
function duDecode(sp, D) {
  D = D || SOLO; const R = mkR(), reader = D.role === 0, n = 4 + (sp > 1.3 ? 1 : 0);
  const code = Array.from({ length: n }, () => Math.floor(R() * 6)), shuf = () => { const a = [0, 1, 2, 3, 4, 5]; for (let i = 5; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const permT = shuf(), permR = shuf(), perm = reader ? permR : permT;            // pad slot -> symbol; each role gets its own layout
  const pings = [];                                                              // typist: { s, c } flashes sent by the reader
  let at = 0, wrong = -1, wrongT = 0, lastPing = -9, pingGlow = -1, pingT = 0;
  const g = {
    c: 0, dur: 12, pts: 0,
    cmd: reader ? 'READ!' : 'TYPE!', roleLabel: reader ? 'READER' : 'TYPIST',
    hint: reader ? 'FIND EACH NUMBER OF THE CODE ON THE PADS AND TAP THEM IN ORDER - YOUR PARTNER SEES THEM FLASH' : 'PRESS THE PADS THAT FLASH, IN ORDER (CLICK OR KEYS 1-6) - IF YOU SLIP, THE CODE STARTS OVER',
    thint: reader ? 'TAP THE PADS FOR EACH NUMBER, IN ORDER - YOUR PARTNER SEES THEM FLASH' : 'TAP THE PADS THAT FLASH, IN ORDER - IF YOU SLIP, THE CODE STARTS OVER',
    update(dt) {
      g.c += dt; wrongT = Math.max(0, wrongT - dt); pingT = Math.max(0, pingT - dt);
      if (!reader && !g.result && g.c >= g.limit) g.finish('lose');
    },
    msg(t, d) {
      if (t === 'ping' && !reader) { pings.push({ s: d, c: g.c }); snd(330 + d * 90, .2, 'triangle', .07); }
      else if (t === 'press' && reader) { at = d.at; if (!d.ok) { wrongT = .5; sfx.miss(); } else snd(330 + d.s * 90, .15, 'triangle', .06); }
    },
    ping(s) {
      if (!reader || g.result || g.c - lastPing < .22) return; lastPing = g.c; pingGlow = s; pingT = .2; D.send('ping', s); snd(330 + s * 90, .15, 'triangle', .06);
    },
    press(s) {
      if (reader || g.result || g.c < .15) return;
      if (s === code[at]) { at++; snd(330 + s * 90, .2, 'triangle', .08); D.send('press', { at, ok: 1, s }); if (at === n) { g.finish('win'); floatText('DECODED!', 400, 190, YEL, 50); } }
      else { at = 0; wrong = s; wrongT = .5; sfx.miss(); shake(4, .1); D.send('press', { at: 0, ok: 0, s }); }
    },
    draw(t) {
      duBg(t);
      for (let i = 0; i < n; i++) {
        const x = 400 + (i - (n - 1) / 2) * 92, done = i < at;
        if (reader) { box(x - 36, 100, 72, 72, done ? GRN : '#fff', 4); txt(String(code[i] + 1), x, 138, 52, done ? '#fff' : INK); }
        else circ(x, 138, 30, done ? GRN : wrongT > 0 ? RED : '#3a3550', 4);
      }
      txt(reader ? 'YOUR PARTNER ENTERS WHAT YOU POINT AT' : g.result ? '' : 'WAIT FOR THE FLASHES', 400, 206, 24, '#fff', 'center', 700);
      if (!reader && !g.result) { while (pings.length && g.c - pings[0].c > 1.4) pings.shift(); }
      perm.forEach((s, k) => {
        const [x, y] = SLOTS[k], glow = reader ? (pingGlow === s && pingT > 0) : pings.some(p => p.s === s && g.c - p.c < .7), bad = !reader && wrong === s && wrongT > 0;
        circ(x, y + (glow ? 6 : 0), 62, bad ? RED : glow ? '#fff' : SYMC[s], 5);
        if (glow) { ctx.fillStyle = SYMC[s]; ctx.beginPath(); ctx.arc(x, y + 6, 44, 0, 7); ctx.fill(); }
        drawSym(s, x, y + (glow ? 6 : 0), 26);
        if (reader) txt(String(s + 1), x + 46, y - 46, 26, YEL);
        else if (!TOUCH) txt(String(k + 1), x - 46, y - 46, 22, '#fff');
      });
      claude(66 - OX, 590, 4.5, { mood: duMood(g) }); vignette(.22);
    },
    down(p) {
      let b = -1, bd = 1e9; SLOTS.forEach((q, k) => { const d = Math.hypot(p.x - q[0], p.y - q[1]); if (d < 76 && d < bd) { bd = d; b = k; } });
      if (b >= 0) reader ? g.ping(perm[b]) : g.press(perm[b]);
    },
    key(e) {
      if (e.repeat) return; const m = /^(?:Digit|Numpad)([1-6])$/.exec(e.code); if (!m) return; const k = +m[1] - 1;
      reader ? g.ping(k) : g.press(perm[k]);        // reader: the key IS the number on the code; typist: the key is the pad position
    },
  };
  g.dbg = { code };                                                              // read by test/duo.test.js (bots)
  wire(g, D, 1, sp);
  return g;
}
reg('du_decode', duDecode, 'DECODE'); REGMAP.du_decode.duo = true;

/* ═════════ 3 LEVER & CRANK: P1 holds the gate open (but must let go when it sparks), P2 cranks to fill the bar ═════════ */
function duCrank(sp, D) {
  D = D || SOLO; const R = mkR(), lever = D.role === 0, TURNS = 3 + Math.round((sp - 1) * 2), CX = 400, CY = 380;
  const k = 1 / Math.sqrt(sp), sparks = Array.from({ length: 4 }, (_, i) => ({ a: (2.2 + i * 2.4 + R() * .4) * k, b: 0 })); sparks.forEach(s => { s.b = s.a + .7; });   // the schedule speeds up with the round
  const sparkAt = c => { for (const s of sparks) { if (c >= s.a && c < s.b) return 1; if (c >= s.a - .5 && c < s.a) return 2; } return 0; };   // 2 = warning, 1 = live
  let on = false, prog = 0, gate = 0, lvOn = false, sparkV = 0, sparkAge = 0, shocked = false, shockT = 0, lastLv = -1, lastSp = -1, lastPg = -1;
  let holding = false, lastAng = null, ang = 0, keyAlt = 0; const pgT = track();
  const g = {
    c: 0, dur: 11, pts: 0,
    cmd: lever ? 'HOLD!' : 'CRANK!', roleLabel: lever ? 'LEVER' : 'CRANKER',
    hint: lever ? 'HOLD CLICK / SPACE TO KEEP THE GATE OPEN - LET GO WHEN IT SPARKS!' : 'DRAG IN CIRCLES (OR MASH SPACE) TO FILL THE BAR - IT ONLY WORKS WHILE THE GATE IS OPEN',
    thint: lever ? 'HOLD YOUR FINGER TO KEEP THE GATE OPEN - LET GO WHEN IT SPARKS!' : 'DRAG IN CIRCLES TO FILL THE BAR - IT ONLY WORKS WHILE THE GATE IS OPEN',
    update(dt) {
      g.c += dt; shockT = Math.max(0, shockT - dt);
      if (lever) {
        const s = g.c < 1.2 ? 0 : sparkAt(g.c); if (s !== lastSp) { lastSp = s; D.send('sp', s, true); if (s === 1) sfx.buzz(); else if (s === 2) snd(880, .08, 'square', .04); }
        const v = on ? 1 : 0; if (v !== lastLv) { lastLv = v; D.send('lv', v, true); }
        sparkV = s; gate += ((on ? 1 : 0) - gate) * Math.min(1, dt * 12);
        const p = pgT.at(.05); if (p !== null) prog = p;
      } else {
        gate += ((lvOn ? 1 : 0) - gate) * Math.min(1, dt * 12);
        if (sparkV === 1) sparkAge += dt; else { sparkAge = 0; shocked = false; }
        if (!g.result) {
          if (!lvOn) prog = Math.max(0, prog - .12 * dt);
          if (sparkV === 1 && lvOn && sparkAge > .3 && !shocked) { shocked = true; prog = Math.max(0, prog - .3); shockT = .5; D.send('shock', 1); sfx.buzz(); shake(7, .2); burst(CX, 250, YEL, 14); }
          const r = Math.round(prog * 100); if (r !== lastPg) { lastPg = r; D.send('pg', r / 100, true); }
          if (prog >= 1) g.finish('win'); else if (g.c >= g.limit) g.finish('lose');
        }
      }
    },
    msg(t, d) {
      if (t === 'lv') lvOn = d === 1;
      else if (t === 'sp') { sparkV = d; if (d === 1) sfx.buzz(); else if (d === 2) snd(880, .08, 'square', .04); }
      else if (t === 'pg') pgT.push(d);
      else if (t === 'shock') { shockT = .5; sfx.buzz(); shake(7, .2); burst(CX, 250, YEL, 14); }
    },
    turn(f) {                                       // f = fraction of a full turn, only counts while the gate is open
      if (g.result) return; if (lvOn) { prog = Math.min(1, prog + f / TURNS); sfx.blip(Math.min(14, Math.round(prog * 14))); } else { sfx.miss(); shockT = .15; }
    },
    draw(t) {
      duBg(t); duBar(prog);
      const open = gate > .5, warn = sparkV === 2, live = sparkV === 1;
      // gate: two doors that slide apart when the lever is held
      const gx = 120 * gate;
      box(CX - 200 - gx, 170, 200, 70, live ? '#ffe14d' : warn ? ORG : '#8d89a8', 4); box(CX + gx, 170, 200, 70, live ? '#ffe14d' : warn ? ORG : '#8d89a8', 4);
      if (live) for (let i = 0; i < 5; i++) { ctx.strokeStyle = YEL; ctx.lineWidth = 4; ctx.beginPath(); const x = CX - 100 + i * 50; ctx.moveTo(x, 150); ctx.lineTo(x + (Math.random() - .5) * 40, 180); ctx.lineTo(x + (Math.random() - .5) * 40, 215); ctx.stroke(); }
      txt(live ? 'SPARK!' : warn ? 'GET READY...' : open ? 'GATE OPEN' : 'GATE CLOSED', CX, 275, live ? 44 : 30, live ? YEL : warn ? ORG : open ? GRN : '#fff', 'center', 600);
      // crank wheel (the lever player sees the partner's wheel turn from the shared progress)
      const a = lever ? prog * TURNS * 6.2832 : ang;
      ctx.save(); ctx.translate(CX, CY + 40); if (shockT > 0) ctx.translate((Math.random() - .5) * 8, 0);
      circ(0, 0, 100, open ? '#e8e4f7' : '#8d89a8', 6); ctx.rotate(a);
      ctx.fillStyle = INK; ctx.fillRect(-10, -92, 20, 92); circ(0, -92, 20, open ? PNK : '#6b6880', 5); ctx.restore();
      circ(CX, CY + 40, 14, INK, 0);
      if (lever) {
        const k = on ? 1 : 0; box(CX - 90, 530, 180, 56, on ? GRN : '#e8e4f7', 4); txt(on ? 'HOLDING' : TOUCH ? 'HOLD!' : 'HOLD (SPACE)', CX, 558 + k * 2, 26, INK, 'center', 160);
      } else if (!g.result && !holding && prog < .05) txt(TOUCH ? 'DRAG IN CIRCLES' : 'DRAG IN CIRCLES / MASH SPACE', CX, 560, 24, 'rgba(255,255,255,.7)', 'center', 700);
      claude(66 - OX, 590, 4.5, { mood: duMood(g) }); vignette(.22);
    },
    down(p) { if (lever) { on = true; sfx.blip(6); } else { holding = true; lastAng = null; g.drag(p); } },
    move(p) { if (!lever && holding) g.drag(p); },
    up() { if (lever) on = false; else { holding = false; lastAng = null; } },
    drag(p) {
      const dx = p.x - CX, dy = p.y - (CY + 40); if (Math.hypot(dx, dy) < 34) { lastAng = null; return; }
      const a = Math.atan2(dy, dx); if (lastAng !== null) { let d = a - lastAng; if (d > Math.PI) d -= 6.2832; else if (d < -Math.PI) d += 6.2832; if (Math.abs(d) < 1.2) { ang += d; g.turn(Math.abs(d) / 6.2832); } } lastAng = a;
    },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (lever) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'ArrowUp') { on = true; } }
      else if (!e.repeat) { ang += .8; g.turn(1 / 8); }
    },
    keyup(e) { if (lever && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'ArrowUp')) on = false; },
  };
  g.dbg = { sparks };
  wire(g, D, 1, sp);
  return g;
}
reg('du_crank', duCrank, 'LEVER & CRANK'); REGMAP.du_crank.duo = true;

/* ═════════ 4 STEER & BOOST: P1 steers the ship around rocks, P2 mashes to boost it to the finish ═════════ */
function duSteer(sp, D) {
  D = D || SOLO; const R = mkR(), steer = D.role === 0, LEN = 2500, TS = Math.sqrt(sp), BASE = 115, YS = 470, ROCK = [];
  for (let p0 = 380; p0 < LEN - 160;) {
    const x = 100 + R() * 600, w = 110 + R() * 50, two = R() < .4, off = 300 + R() * 130, side = x < 400 ? 1 : -1, gap = 170 + R() * 80;
    ROCK.push({ p: p0, x, w }); if (two) ROCK.push({ p: p0 + 8, x: clamp(x + side * off, 90, 710), w: 100 }); p0 += gap;
  }
  const pT = track(), xT = track(), eT = track();
  let x = 400, p = 0, extra = 0, kx = 0, inv = 0, stun = 0, pend = 0, sendAt = 0, tapFx = 0, lastSh = '';
  const g = {
    c: 0, dur: 12, pts: 0,
    cmd: steer ? 'STEER!' : 'BOOST!', roleLabel: steer ? 'STEERER' : 'BOOSTER',
    hint: steer ? 'MOVE THE MOUSE (OR ◄ ►) TO DODGE THE ROCKS - YOUR PARTNER MAKES YOU GO FAST' : 'CLICK / TAP / SPACE AS FAST AS YOU CAN TO BOOST YOUR PARTNER\'S SHIP',
    thint: steer ? 'DRAG TO DODGE THE ROCKS - YOUR PARTNER MAKES YOU GO FAST' : 'TAP AS FAST AS YOU CAN TO BOOST YOUR PARTNER\'S SHIP',
    update(dt) {
      g.c += dt; inv = Math.max(0, inv - dt); stun = Math.max(0, stun - dt); tapFx = Math.max(0, tapFx - dt * 5);
      if (steer) {
        if (g.result) return;
        x = clamp(x + kx * 520 * dt, 50, 750);
        extra *= Math.exp(-2.2 * dt);
        if (stun <= 0) p += (BASE + extra) * dt * TS;           // the whole course runs faster in later rounds (same number of taps, less time)
        for (const o of ROCK) if (inv <= 0 && Math.abs(o.p - p) < 26 && Math.abs(o.x - x) < o.w / 2 + 22) { extra = 0; stun = .5; inv = .9; p = Math.max(0, p - 140); shake(7, .2); sfx.thud(); burst(x, YS, RED, 12); D.send('hit', o.x); break; }
        const sh = [Math.round(p), Math.round(x), Math.round(extra)]; if (g.c - sendAt >= .05 && sh.join() !== lastSh) { lastSh = sh.join(); sendAt = g.c; D.send('sh', sh, true); }
        if (p >= LEN) g.finish('win'); else if (g.c >= g.limit) g.finish('lose');
      } else {
        if (pend && g.c - sendAt >= .1) { sendAt = g.c; D.send('b', pend); pend = 0; }
      }
    },
    msg(t, d) {
      if (t === 'sh' && !steer) { pT.push(d[0]); xT.push(d[1]); eT.push(d[2]); }
      else if (t === 'b' && steer) { extra = Math.min(340, extra + 70 * Math.min(d, 3)); sfx.blip(6); }
      else if (t === 'hit' && !steer) { shake(5, .15); sfx.thud(); burst(xT.at() || 400, YS, RED, 10); }
    },
    boost() { if (steer || g.result) return; pend++; tapFx = 1; sfx.blip(Math.min(14, 4 + pend)); },
    draw(t) {
      duBg(t);
      const P = steer ? p : (pT.at() === null ? 0 : pT.at()), X = steer ? x : (xT.at() === null ? 400 : xT.at()), E = steer ? extra : (eT.at() || 0);
      duBar(P / LEN);
      const off = P % 80; ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -1; i < 9; i++) ctx.fillRect(396, 40 + i * 80 + off, 8, 40);
      const fy = YS - (LEN - P); if (fy > -40) { for (let i = -Math.ceil(OX / 40); i < 20 + Math.ceil(OX / 40); i++) { ctx.fillStyle = i % 2 ? INK : '#fff'; ctx.fillRect(i * 40, fy, 40, 24); } }
      for (const o of ROCK) {
        const y = YS - (o.p - P); if (y < -50 || y > H + 50) continue;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(o.x, y, o.w / 2 + 5, 30, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#8a86a3'; ctx.beginPath(); ctx.ellipse(o.x, y - 2, o.w / 2, 25, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(o.x - o.w * .15, y - 10, o.w * .22, 8, 0, 0, 7); ctx.fill();
      }
      const fl = Math.min(1, E / 200); if (fl > .05) { ctx.fillStyle = YEL; ctx.beginPath(); ctx.moveTo(X - 16, YS + 26); ctx.lineTo(X, YS + 26 + 30 + fl * 90 + Math.random() * 14); ctx.lineTo(X + 16, YS + 26); ctx.fill(); }
      ctx.save(); if (steer && inv > 0 && Math.floor(now * 20) % 2) ctx.globalAlpha = .45; claude(X, YS, 3.4, { mood: duMood(g) }); ctx.restore();
      if (!steer) { box(250, 560, 300, 22, '#3a3550', 3); ctx.fillStyle = tapFx > 0 ? '#fff' : ORG; ctx.fillRect(250, 560, 300 * Math.min(1, E / 300), 22); if (!g.result) txt(TOUCH ? 'TAP! TAP! TAP!' : 'MASH SPACE!', 400, 520, 36, '#fff'); }
      vignette(.22);
    },
    move(p) { if (steer && !g.result) x = clamp(p.x, 50, 750); },
    down(p) { steer ? g.move(p) : g.boost(); },
    key(e) {
      if (steer) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1; }
      else if (!e.repeat && e.code !== 'KeyP' && e.code !== 'KeyM' && e.code !== 'Escape') g.boost();
    },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (kx < 0) kx = 0; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (kx > 0) kx = 0; } },
  };
  g.dbg = { ROCK, pos: () => ({ p, x }) };
  wire(g, D, 0, sp);
  return g;
}
reg('du_steer', duSteer, 'STEER & BOOST'); REGMAP.du_steer.duo = true;

})();
