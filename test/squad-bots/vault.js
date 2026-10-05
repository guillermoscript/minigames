'use strict';
/* bots for sq_vault (VAULT RING). Every seat is both an owner and a watcher; each part reads only what its screen shows (g.dbg.view()).
   - OWNER: drags the pointer in circles round its dial. It never sees its goal: it reacts (after ~150 ms) to the live ping feedback on its own rim:
     chevrons say which way to turn (far = fast, near = a crawl), a DING means stop. With no pings it does nothing.
   - WATCHER: taps the ping (Space) five times a second. The game turns what that screen shows (the gold goal and the neighbour's needle) into the chevrons. */
const SPEED = [0, 26, 95, 190, 260];                              // deg/s by ping bucket 0 (ding) .. 4 (far)
module.exports = {
  sq_vault: n => Array.from({ length: n }, () => (g, role, { every }) => {
    let pressed = false, pa = 0, cmd = { sp: 0, dir: 0, t: 0 }, pend = null, lastKey = ''; const st = { n: -1 };
    return {
      tick(T, dt) {
        const v = g.dbg.view(); if (T < .3) return;
        if (!pressed) { pressed = true; pa = 0; g.down({ x: v.cx + 90, y: v.cy }); }
        const key = v.pul ? v.pul.id + ',' + v.pul.b + ',' + v.pul.s : ''; if (v.pul && key !== lastKey) { lastKey = key; pend = { at: T + .15, b: v.pul.b, s: v.pul.s }; }
        if (pend && T >= pend.at) { cmd = pend.b === 0 ? { sp: 0, dir: 0, t: T } : { sp: SPEED[pend.b], dir: pend.s, t: T }; pend = null; }
        if (cmd.sp && !v.pul) cmd = { sp: 0, dir: 0, t: T };
        if (cmd.sp) { pa += cmd.dir * cmd.sp * dt * Math.PI / 180; g.move({ x: v.cx + 90 * Math.cos(pa), y: v.cy + 90 * Math.sin(pa) }); }
        if (every(T, st, .2)) g.key({ code: 'Space', repeat: false });
      },
    };
  }),
};
