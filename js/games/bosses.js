'use strict';
/* Boss games: longer, tougher, end a stage. Each takes (speed, stageDef) and returns a microgame
   object with boss:true (dur is NOT scaled by speed for bosses). */
const BOSSES = {
  /* a giant bug: click it until its health bar is empty */
  bug(sp, s) {
    const max = s.bossHp || 10; let hp = max, flash = 0;
    const b = { x: 400, y: 300, a: Math.random() * 6.28, turn: 0 };
    const g = {
      cmd: 'BOSS!', hint: 'SQUASH THE GIANT BUG', thint: 'TAP THE GIANT BUG', dur: 8, boss: true,
      down(p) {
        if (Math.hypot(p.x - b.x, p.y - b.y) < 100) {
          hp--; flash = .12; confetti(p.x, p.y, 6); snd(300 + (max - hp) * 40, .09, 'square', .08, 0, 900);
          if (hp <= 0) { g.result = 'win'; confetti(b.x, b.y, 50); }
        } else snd(170, .08, 'sawtooth');
      },
      update(dt) {
        flash = Math.max(0, flash - dt);
        if (g.result) return;
        const v = (130 + (max - hp) * 24) * sp;
        b.turn -= dt; if (b.turn < 0) { b.a += (Math.random() - .5) * 2.6; b.turn = .3 + Math.random() * .5; }
        b.x += Math.cos(b.a) * v * dt; b.y += Math.sin(b.a) * v * dt;
        if (b.x < 130) { b.x = 130; b.a = Math.PI - b.a } if (b.x > 670) { b.x = 670; b.a = Math.PI - b.a }
        if (b.y < 170) { b.y = 170; b.a = -b.a } if (b.y > 450) { b.y = 450; b.a = -b.a }
      },
      draw(t) {
        bg('#5b1d2b', '#6d2335', t);
        box(200, 78, 400, 26, '#2b0d14', 5); ctx.fillStyle = '#ff4d4d'; ctx.fillRect(200, 78, 400 * hp / max, 26);
        txt('MEGA BUG', W / 2, 128, 22);
        if (!g.result) {
          drawBug(b.x, b.y, b.a + Math.PI / 2, 2.6, now * 1.5);
          if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 56, 72, b.a + Math.PI / 2, 0, 7); ctx.fill(); }
        } else txt('SPLAT!', W / 2, 300, 120, '#FFE14D');
      }
    };
    return g;
  },
  /* a long word to type */
  type(sp, s) {
    const g = gType(sp, s.bossWord || 'REFACTOR');
    g.cmd = 'BOSS!'; g.hint = 'TYPE THE WORD!'; g.thint = 'TAP THE LETTERS'; g.dur = 9; g.boss = true;
    return g;
  },
  /* a bigger swarm of bouncing bugs */
  dodge(sp, s) {
    const g = gDodge(sp + .2, s.bossBalls || 3);
    g.cmd = 'BOSS!'; g.hint = 'SURVIVE THE SWARM!'; g.thint = 'DRAG TO DODGE'; g.dur = 9; g.boss = true;
    return g;
  }
};
