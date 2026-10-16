'use strict';
/* bots for sq_diablos (DIABLOS DE YARE). Role-honest: each reads only what its own screen shows (g.dbg.view()) and drives the public handlers.
   - MAESTRO (0): sees the two shapes of the template; presses 1 / 2 (public key) to dictate them to the painter.
   - PINTOR (1): sees only what the master dictated (hints). Knows the WORD ("rayas", "circle"...) and traces that shape on its slot with the public
               down / move / up, a little wobbly, ~300 px/s.
   - TAMBOR (2): sees the notes sliding to the drum; taps (public down) ~10 ms after each note reaches it.
   - CAMPANERO (3): sees the bells sliding to the ring; taps (public down / key) ~10 ms after each one reaches it. */
const SH = [                                   // what a human draws for each word: polylines relative to a slot centre (mask coords)
  cy => [[[-60, cy - 32], [-60, cy + 32]], [[0, cy - 34], [0, cy + 34]], [[60, cy - 32], [60, cy + 32]]],               // rayas
  cy => [[[0, cy - 26], [13, cy - 23], [23, cy - 16], [29, cy - 6], [29, cy + 6], [23, cy + 16], [13, cy + 23], [0, cy + 26], [-13, cy + 23], [-23, cy + 16], [-29, cy + 6], [-29, cy - 6], [-23, cy - 16], [-13, cy - 23], [0, cy - 26]]],   // circulo
  cy => [[[-56, cy - 14]], [[0, cy + 16]], [[56, cy - 14]]],                                                            // lunares
  cy => [[[-54, cy - 33], [54, cy + 33]], [[54, cy - 33], [-54, cy + 33]]],                                             // cruz
];
const SLOT = [-66, 66], CX = 400, CY = 268;
const wob = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 3;
const maestro = (g, role) => {
  const sent = [false, false];
  return {
    tick(T) {
      const v = g.dbg.view();
      for (let k = 0; k < 2; k++) if (!v.said[k] && !sent[k] && T > 1.2 + k * .5) { sent[k] = true; const e = { code: 'Digit' + (k + 1) }; g.key(e); g.keyup(e); }
    },
  };
};
const pintor = (g, role) => {
  const done = new Set(); let q = [], nz = 0;
  return {
    tick(T, dt) {
      const v = g.dbg.view();
      for (let k = 0; k < 2; k++) if (v.hints[k] >= 0 && !done.has(k)) {
        done.add(k);
        for (const l of SH[v.hints[k]](SLOT[k])) {
          const pts = l.map(([x, y], i) => [CX + x + wob(++nz, 1), CY + y + wob(nz, 2)]);
          q.push({ a: 'down', x: pts[0][0], y: pts[0][1] });
          if (pts.length > 1) for (let i = 0; i + 1 < pts.length; i++) { const A = pts[i], B = pts[i + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]), m = Math.max(1, Math.ceil(L / 5)); for (let j = 1; j <= m; j++) q.push({ a: 'move', x: A[0] + (B[0] - A[0]) * j / m, y: A[1] + (B[1] - A[1]) * j / m }); }
          else q.push({ a: 'move', x: pts[0][0], y: pts[0][1] });
          q.push({ a: 'up', x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] });
        }
      }
      for (let c = 0; c < 5 && q.length; c++) { const s = q.shift(); g[s.a]({ x: s.x, y: s.y }); }
    },
  };
};
const lane = key => (g, role) => {
  const done = new Set();
  return {
    tick() {
      const v = g.dbg.view();
      for (const t of v[key]) {
        if (done.has(t)) continue;
        if (t < v.S - .05) { done.add(t); continue; }
        if (v.S >= t + .01) { done.add(t); g.down({ x: 400, y: 540 }); g.up({ x: 400, y: 540 }); }
      }
    },
  };
};
module.exports = { sq_diablos: n => Array.from({ length: n }, (_, r) => r === 0 ? maestro : r === 1 ? pintor : r === 2 ? lane('notes') : lane('giros')) };
