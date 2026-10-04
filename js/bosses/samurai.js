'use strict';
/* SAMURAI boss (GET TOGETHER): a ronin bug winds up a strike from the LEFT, RIGHT or ABOVE and you parry that way.
   After Smooth Moves' "Samurai" form / "Produce Stand-Off". 6 parries shatter his sword; 2 hits and Claude is out. */
(function () {
  const DIRS = ['L', 'R', 'U'], CODE = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp' };
  const KEYS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U' };
  const PAD = { L: [200, 420], R: [600, 420], U: [400, 378] }, RING = { L: 92, R: 92, U: 70 }, ARW = { L: 3, R: 1, U: 0 };   // telegraph arrows
  const CX = 400, CY = 530, CU = 7, BX = 400, FY = 442, BLADE = 150;
  const POSE = { idle: [455, 350, -1.0], L: [282, 248, -2.55], R: [518, 248, -.6], U: [400, 178, -Math.PI / 2],   // rival: hand x, y, blade angle
    sL: [235, 430, .35], sR: [565, 430, Math.PI - .35], sU: [400, 330, Math.PI / 2] };
  const GUARD = { idle: [447, 500, -1], L: [337, 514, -Math.PI / 2], R: [463, 514, -Math.PI / 2], U: [325, 427, 0] };   // Claude's katana
  const HIT = { L: [337, 450], R: [463, 450], U: [400, 427] };
  const angL = (a, b, k) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;
  const lerpP = (p, q, k) => { p[0] += (q[0] - p[0]) * k; p[1] += (q[1] - p[1]) * k; p[2] = angL(p[2], q[2], k); };
  const up = p => Math.max(0, -Math.sin(p[2])) ** 6, bl = p => BLADE * (1 - .3 * up(p));   // overhead blade is foreshortened
  const tipOf = p => [p[0] + Math.cos(p[2]) * bl(p), p[1] + Math.sin(p[2]) * bl(p)];
  const clang = () => { snd(1250, .18, 'square', .05); snd(1870, .25, 'triangle', .06); snd(2630, .12, 'sine', .04, .02); noise(.12, .12, 5000, 7000, 'highpass'); };
  const glint = () => { snd(1400, .06, 'triangle', .05, 0, 2800); snd(3000, .1, 'sine', .04, .05); };

  function katana(x, y, a, len, gl, broken) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.lineJoin = 'round';
    ctx.fillStyle = INK; ctx.fillRect(-32, -8, 38, 16); ctx.fillStyle = '#5b2d86'; ctx.fillRect(-29, -4.5, 32, 9);
    ctx.fillStyle = '#FFE14D'; for (let i = -24; i < 0; i += 8) ctx.fillRect(i, -4.5, 3, 9);
    const L = broken ? 22 : len;
    ctx.beginPath(); ctx.moveTo(8, -5); ctx.lineTo(L - (broken ? 0 : 22), -6); ctx.lineTo(L, broken ? 5 : 3); ctx.lineTo(8, 5); ctx.closePath();
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#e9eef6'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, -1.5); ctx.lineTo(L - 26, -2.5); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(7, 0, 7, 15, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.ellipse(7, 0, 4, 11, 0, 0, 7); ctx.fill();
    if (gl > 0 && !broken) star(L, 0, 26 * gl, 6, 4, now * 5, '#fff', 3);
    ctx.restore();
  }
  function heart(x, y, s, fill) {
    ctx.beginPath(); ctx.moveTo(x, y + s * .9); ctx.bezierCurveTo(x - s * 1.4, y, x - s * .9, y - s * 1.1, x, y - s * .4);
    ctx.bezierCurveTo(x + s * .9, y - s * 1.1, x + s * 1.4, y, x, y + s * .9); ctx.closePath();
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = fill; ctx.fill();
  }

  BOSSES.samurai = function (sp, s) {
    const k = Math.sqrt(Math.min(sp, 1.8)), need = 6;
    let ph = 'intro', pt = .8, tw = 1, dir = null, prev = [], parries = 0, hearts = 2, strikes = 0, clk = 0, stop = 0;
    let fallDir = 1, guard = 'idle', guardT = 0, cflash = 0, knock = 0, sq = 0, lean = 0, smear = 0, fall = 0, slashT = -1, ptr = null, mood = 'idle', hpop = 0;
    const rp = POSE.idle.slice(), gp = GUARD.idle.slice(), smearFrom = [0, 0], shards = [];
    const leaves = Array.from({ length: 12 }, (_, i) => ({ x: Math.random(), y: Math.random() * 600, s: .6 + Math.random() * .6, p: i }));
    const pick = () => { let d; do d = DIRS[Math.random() * 3 | 0]; while (prev[0] === d && prev[1] === d); prev = [d, prev[0]]; return d; };
    const strike = () => { Object.assign(smearFrom, tipOf(rp)); smear = .14; const q = POSE['s' + dir]; rp[0] = q[0]; rp[1] = q[1]; rp[2] = q[2]; sfx.whoosh(false); };
    const hurt = msg => {
      strike(); ph = 'hurt'; pt = .7; hearts--; hpop = .4; cflash = .45; knock = dir === 'R' ? -30 : dir === 'L' ? 30 : 0; mood = 'laugh';
      sfx.thud(); sfx.buzz(); shake(12, .3); burst(CX, CY - 30, '#ff4d4d', 16); ring(CX, CY - 30, '#ff4d4d', 90);
      floatText(msg, CX, CY - 110, '#ff9a9a', 34); floatText('HA HA!', BX + 120, 200, '#fff', 28);
      if (hearts <= 0) { g.result = 'lose'; sfx.miss(); }
    };
    const parry = d => {
      if (g.result) return;
      guard = d; guardT = .3;
      if (ph !== 'wind') { sfx.whoosh(); return; }              // swinging at nothing is harmless
      if (d !== dir) { hurt('WRONG WAY!'); return; }
      strike(); parries++; stop = .08; guardT = .45; ph = 'recoil'; pt = .4; sq = .35; mood = 'dizzy';
      const [hx, hy] = HIT[dir]; clang(); sfx.blip(parries * 2); shake(8, .15); burst(hx, hy, '#FFE14D', 18, 380); burst(hx, hy, '#fff', 8, 260); ring(hx, hy, '#fff', 80, .3);
      floatText('CLANG!', hx, hy - 70, '#FFE14D', 42);
      if (parries >= need) {                                    // the sword shatters, the ronin keels over
        g.result = 'win'; stop = .14; slashT = 0; mood = 'dead'; fallDir = dir === 'L' ? 1 : dir === 'R' ? -1 : Math.random() < .5 ? -1 : 1;
        const [ax, ay] = [rp[0], rp[1]], [tx, ty] = tipOf(rp);
        for (let i = 0; i < 8; i++) { const u = .2 + i * .1; shards.push({ x: ax + (tx - ax) * u, y: ay + (ty - ay) * u, vx: (Math.random() - .5) * 700, vy: -200 - Math.random() * 400, r: Math.random() * 6, vr: (Math.random() - .5) * 20 }); }
        noise(.35, .14, 6000, 3000, 'highpass'); sfx.sparkle(); sfx.splat(); shake(16, .5); confetti(BX, 300, 60); ring(BX, 320, '#FFE14D', 240, .6);
      }
    };
    const zone = x => x < 290 ? 'L' : x > 510 ? 'R' : 'U';   // side thirds = L / R, middle column = UP
    const g = {
      cmd: 'BOSS!', hint: 'PARRY WITH ← ↑ →', thint: 'SWIPE OR TAP TO PARRY', dur: 11, boss: true, wide: true, swipe: true,
      key(e) { if (ptr) ptr.used = true; const d = KEYS[e.code]; if (d) parry(d); },
      down(p) { ptr = { x: p.x, y: p.y, used: false }; },
      up() { if (ptr && !ptr.used) parry(zone(ptr.x)); ptr = null; },
      update(dt) {
        for (const l of leaves) { l.y += 40 * l.s * dt; if (l.y > 620) { l.y = -20; l.x = Math.random(); } }
        for (const q of shards) { q.vy += 1100 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt; }
        if (slashT >= 0) slashT += dt;
        if (stop > 0) { stop -= dt; return; }                     // freeze-frame on CLANG
        clk += dt; cflash = Math.max(0, cflash - dt); smear = Math.max(0, smear - dt); hpop = Math.max(0, hpop - dt);
        knock *= Math.pow(.02, dt); sq *= Math.pow(.004, dt);
        guardT -= dt; if (guardT <= 0 && ph !== 'recoil') guard = 'idle';
        lerpP(gp, GUARD[guard], Math.min(1, 30 * dt));
        if (g.result) { if (g.result === 'win') fall = Math.min(1, fall + dt * 2.2); else lerpP(rp, POSE.U, Math.min(1, 6 * dt)); return; }
        const tgt = ph === 'wind' ? POSE[dir] : POSE.idle;
        lean += ((ph === 'wind' ? (dir === 'L' ? -20 : dir === 'R' ? 20 : 0) : 0) - lean) * Math.min(1, 10 * dt);
        if (!(ph === 'hurt' && pt > .45) && !(ph === 'recoil' && pt > .3)) lerpP(rp, tgt, Math.min(1, (ph === 'wind' ? 16 : 7) * dt));
        pt -= dt; if (pt > 0) return;
        if (ph === 'wind') { hurt('TOO SLOW!'); return; }
        if (ph === 'gap') { ph = 'wind'; dir = pick(); strikes++; tw = pt = Math.max(.5, (.8 - parries * .03) / k); mood = 'angry'; glint(); sfx.tickHi(); return; }
        ph = 'gap'; pt = Math.max(.25, (.6 - parries * .05) / k); mood = 'idle'; guard = 'idle'; if (strikes === 0) { sfx.whoosh(); glint(); }
      },
      draw(t) {
        bg('#191338', '#201a4a', t);
        const gr = ctx.createRadialGradient(BX, 230, 60, BX, 230, 260); gr.addColorStop(0, 'rgba(255,240,190,.35)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = gr; ctx.fillRect(-OX, 0, VW, 500); circ(BX, 230, 118, '#f6e8b4', 0);
        ctx.fillStyle = 'rgba(200,180,120,.35)'; for (const [x, y, r] of [[-40, -30, 18], [30, 20, 26], [-20, 50, 12], [55, -45, 10]]) { ctx.beginPath(); ctx.arc(BX + x, 230 + y, r, 0, 7); ctx.fill(); }
        // bamboo grove (back layer dark, front layer outlined), kept away from the duel
        for (const [col, step, off, w, o] of [['#1e4636', 58, 0, 18, 0], ['#3f8c57', 96, 30, 26, 4]]) for (let x = -OX - 20 + off; x < W + OX + 20; x += step) {
          if (Math.abs(x - BX) < (o ? 300 : 250)) continue;
          if (o) { ctx.fillStyle = INK; ctx.fillRect(x - w / 2 - o, -10, w + 2 * o, 470); }
          ctx.fillStyle = col; ctx.fillRect(x - w / 2, -10, w, 470); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x - w / 2 + 3, -10, 4, 470);
          ctx.fillStyle = INK; for (let y = 60 + (x * 7 % 50); y < 440; y += 90) ctx.fillRect(x - w / 2 - o, y, w + 2 * o, o ? 6 : 4);
          ctx.fillStyle = col; for (let y = 100 + (x * 3 % 60); y < 380; y += 140) { const sw = Math.sin(clk * 2 + x) * .15, sd = x % 2 ? 1 : -1;
            ctx.save(); ctx.translate(x, y); ctx.rotate(sd * (.5 + sw)); ctx.beginPath(); ctx.ellipse(sd * 30, 0, 32, 8, 0, 0, 7); if (o) { ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); } ctx.fill(); ctx.restore(); }
        }
        ctx.fillStyle = '#7a4a26'; ctx.fillRect(-OX, FY, VW, H - FY); ctx.strokeStyle = 'rgba(20,16,28,.4)'; ctx.lineWidth = 3;
        for (let i = -16; i <= 16; i++) { ctx.beginPath(); ctx.moveTo(BX + i * 45, FY); ctx.lineTo(BX + i * 150, H); ctx.stroke(); }
        for (const y of [470, 505, 548]) { ctx.beginPath(); ctx.moveTo(-OX, y); ctx.lineTo(W + OX, y); ctx.stroke(); }
        ctx.fillStyle = INK; ctx.fillRect(-OX, FY - 3, VW, 6);
        ctx.fillStyle = '#5fae6e'; for (const l of leaves) { ctx.save(); ctx.translate(-OX + l.x * VW + Math.sin(clk * 2 + l.p) * 30, l.y); ctx.rotate(Math.sin(clk * 3 + l.p)); ctx.beginPath(); ctx.ellipse(0, 0, 12 * l.s, 4 * l.s, 0, 0, 7); ctx.fill(); ctx.restore(); }
        // telegraph glow on the strike side
        if (ph === 'wind' && !g.result) {
          const fl = (clk * 14 | 0) % 2;
          const sg = dir === 'L' ? ctx.createLinearGradient(-OX, 0, 330, 0) : dir === 'R' ? ctx.createLinearGradient(W + OX, 0, 470, 0) : ctx.createLinearGradient(0, 60, 0, 300);
          sg.addColorStop(0, `rgba(255,77,77,${.35 + .2 * fl})`); sg.addColorStop(1, 'rgba(255,77,77,0)'); ctx.fillStyle = sg; ctx.fillRect(-OX, 0, VW, H);
        } else if (TOUCH && !g.result) { ctx.globalAlpha = .18; for (const d of DIRS) drawArrow(PAD[d][0], PAD[d][1], ARW[d], 40, '#fff'); ctx.globalAlpha = 1; }
        // the ronin bug
        shadow(BX, FY, 110, 16, .35);
        const pv = BX + fallDir * 55;
        ctx.save(); ctx.translate(pv + lean, FY - Math.sin(fall * Math.PI) * 26); ctx.rotate(fallDir * fall * fall * 1.1); ctx.scale(1 + sq * .25, 1 - sq * .2 + Math.sin(clk * 3) * .015); ctx.translate(-pv, -FY);
        const by = 335, hy = by - 100;
        ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round';
        for (const x of [-48, -18, 18, 48]) { ctx.beginPath(); ctx.moveTo(BX + x, by + 70); ctx.lineTo(BX + x * 1.15, FY - 4); ctx.stroke(); }
        ctx.lineWidth = 7; ctx.fillStyle = '#e8433a'; ctx.beginPath(); ctx.ellipse(BX, by, 80, 90, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(BX, by - 85); ctx.lineTo(BX, by + 88); ctx.stroke();
        ctx.fillStyle = INK; for (const [x, y, r] of [[-40, -30, 13], [38, -42, 10], [-30, 40, 11], [44, 30, 14], [-55, 5, 7]]) { ctx.beginPath(); ctx.arc(BX + x, by + y, r, 0, 7); ctx.fill(); }
        box(BX - 74, by + 8, 148, 22, '#3d2a66', 4);                                  // obi sash
        ctx.lineWidth = 6; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(BX + sd * 14, hy - 30); ctx.quadraticCurveTo(BX + sd * 30, hy - 90, BX + sd * 52, hy - 96); ctx.stroke(); circ(BX + sd * 52, hy - 96, 6, '#e8433a', 3); }
        circ(BX, hy, 42, '#2b2140', 5);
        if (mood === 'dead') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; for (const sd of [-1, 1]) { const ex = BX + sd * 17, ey = hy + 4; ctx.beginPath(); ctx.moveTo(ex - 8, ey - 8); ctx.lineTo(ex + 8, ey + 8); ctx.moveTo(ex + 8, ey - 8); ctx.lineTo(ex - 8, ey + 8); ctx.stroke(); } }
        else if (mood === 'laugh') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(BX + sd * 17 - 9, hy + 8); ctx.lineTo(BX + sd * 17, hy); ctx.lineTo(BX + sd * 17 + 9, hy + 8); ctx.stroke(); } }
        else for (const sd of [-1, 1]) {
          const ex = BX + sd * 17, ey = hy + 4, wob = mood === 'dizzy' ? Math.sin(clk * 30 + sd) * 3 : 0;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, 12, mood === 'angry' ? 7 : 10, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(ex + wob + (mood === 'angry' ? (dir === 'L' ? -4 : dir === 'R' ? 4 : 0) : 0), ey + (mood === 'angry' && dir === 'U' ? -2 : 0), 4.5, 0, 7); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ex - sd * 13, ey - (mood === 'angry' ? 18 : 14)); ctx.lineTo(ex + sd * 11, ey - (mood === 'angry' ? 9 : 14)); ctx.stroke();
        }
        ctx.lineCap = 'round'; for (const sd of [-1, 1]) {                             // droopy mustache
          ctx.beginPath(); ctx.moveTo(BX, hy + 22); ctx.quadraticCurveTo(BX + sd * 30, hy + 18, BX + sd * 38, hy + 46 + (mood === 'laugh' ? Math.sin(clk * 40) * 4 : 0));
          ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = '#f4efe4'; ctx.lineWidth = 5; ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(BX - 112, hy - 16); ctx.lineTo(BX, hy - 74); ctx.lineTo(BX + 112, hy - 16); ctx.quadraticCurveTo(BX, hy - 4, BX - 112, hy - 16); ctx.closePath();   // kasa hat
        ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#d9a441'; ctx.fill();
        ctx.strokeStyle = 'rgba(20,16,28,.35)'; ctx.lineWidth = 3; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(BX, hy - 70); ctx.lineTo(BX + i * 30, hy - 14); ctx.stroke(); }
        const [hx, hy2, ha] = rp, bow = 20 + 45 * up(rp);                              // noodle arms + sword
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(BX + sd * 62, by - 40); ctx.quadraticCurveTo((BX + sd * 62 + hx) / 2 + sd * bow, (by - 40 + hy2) / 2 + 20, hx + sd * 8, hy2); ctx.strokeStyle = INK; ctx.lineWidth = 20; ctx.stroke(); ctx.strokeStyle = '#e8433a'; ctx.lineWidth = 11; ctx.stroke(); }
        if (smear > 0) { const [tx, ty] = tipOf(rp); ctx.globalAlpha = smear / .14; ctx.strokeStyle = '#fff'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(smearFrom[0], smearFrom[1]); ctx.quadraticCurveTo((smearFrom[0] + tx) / 2 + (BX - hx) * .3, (smearFrom[1] + ty) / 2 - 40, tx, ty); ctx.stroke(); ctx.globalAlpha = 1; }
        katana(hx, hy2, ha, bl(rp), ph === 'wind' && !g.result ? .7 + .3 * Math.sin(clk * 30) : 0, g.result === 'win');
        circ(hx, hy2, 13, '#2b2140', 4); ctx.lineCap = 'butt';
        ctx.restore();
        if (ph === 'wind' && !g.result) {                                              // ticking ring + big flashing arrow
          const u = 1 - pt / tw, [ax, ay] = PAD[dir], rr = RING[dir];
          ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(ax, ay, rr, -Math.PI / 2, -Math.PI / 2 + (1 - u) * 6.283); ctx.stroke();
          ctx.strokeStyle = u > .6 ? '#ff4d4d' : '#FFE14D'; ctx.lineWidth = 9; ctx.stroke(); ctx.lineCap = 'butt';
          drawArrow(ax, ay, ARW[dir], rr * .7 * (1 + .1 * Math.sin(clk * 40)) * Math.min(1, u * 8 + .4), (clk * 14 | 0) % 2 ? '#fff' : '#FFE14D'); }
        if (ph === 'wind' && !g.result) txt('!', BX + 70 + lean, hy - 70, 64 + Math.sin(clk * 30) * 6, '#ff4d4d');
        for (const q of shards) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.beginPath(); ctx.moveTo(-14, -5); ctx.lineTo(16, 0); ctx.lineTo(-10, 6); ctx.closePath(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#e9eef6'; ctx.fill(); ctx.restore(); }
        // Claude the samurai: headband + katana guard
        const cx = CX + knock + (cflash > 0 ? Math.sin(clk * 90) * 4 : 0), cy = CY - (g.result === 'win' ? Math.abs(Math.sin(clk * 10)) * 16 : 0);
        shadow(CX, CY + 2, 54, 10, .35);
        const blk = guard !== 'idle' && guardT > .2 ? 1.08 : 1; ctx.save(); ctx.translate(cx, cy); ctx.scale(blk, 2 - blk); ctx.translate(-cx, -cy);
        claude(cx, cy, CU, { mood: g.result === 'lose' || cflash > 0 ? 'sad' : g.result === 'win' ? 'happy' : null, col: cflash > 0 && (clk * 20 | 0) % 2 ? '#fff' : OR });
        const bt = cy - 9 * CU; box(cx - 6 * CU, bt + 1, 12 * CU, 8, '#e8433a', 3);
        for (const j of [0, 1]) { const w = Math.sin(clk * 12 + j) * 6; ctx.beginPath(); ctx.moveTo(cx + 6 * CU, bt + 3 + j * 4); ctx.quadraticCurveTo(cx + 6 * CU + 16, bt - 4 + w, cx + 6 * CU + 32, bt + j * 10 + w); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#e8433a'; ctx.stroke(); }
        ctx.lineCap = 'butt';
        katana(gp[0] + (cx - CX), gp[1] + (cy - CY), gp[2], 128, 0, false);
        ctx.restore();
        // HUD: hearts (left) and parries (right)
        for (let i = 0; i < 2; i++) { const pop = i === hearts && hpop > 0 ? 1 + hpop : 1; heart(170 + i * 50, 116, 17 * pop, i < hearts ? '#ff4d6d' : '#3a2a4a'); }
        ctx.font = '900 20px "Arial Black", Impact, sans-serif'; const lw = ctx.measureText(window.t('PARRIES')).width;   // right of the overhead blade, left of the score popup
        txt('PARRIES', 492, 98, 20, '#fff', 'left'); txt(`${parries} / ${need}`, 502 + lw, 98, 20, '#FFE14D', 'left');
        for (let i = 0; i < need; i++) { const on = i < parries, x = 506 + i * 31; circ(x, 130, 11, on ? '#FFE14D' : '#3a2a4a', 4); if (on) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 7, 137); ctx.lineTo(x + 7, 123); ctx.stroke(); } }
        if (slashT >= 0 && slashT < .7) {                                               // the finishing diagonal slash
          const a = 1 - slashT / .7; ctx.lineCap = 'round';
          ctx.strokeStyle = INK; ctx.lineWidth = 60 * a + 10; ctx.beginPath(); ctx.moveTo(-OX - 20, 150); ctx.lineTo(W + OX + 20, 470); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 60 * a; ctx.stroke(); ctx.lineCap = 'butt';
          if (slashT < .1) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-OX, 0, VW, H); }
        }
        vignette(.3);
      },
      probe: () => ({ phase: ph, dir, press: ph === 'wind' ? CODE[dir] : null, tap: ph === 'wind' ? PAD[dir] : null, left: +pt.toFixed(3), windT: +tw.toFixed(3), parries, need, hearts, strikes, result: g.result || null })
    };
    return g;
  };
})();
