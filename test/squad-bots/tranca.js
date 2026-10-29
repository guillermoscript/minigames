'use strict';
/* bots for sq_tranca (TRANCA). Role-honest: each reads only what its own screen shows (g.dbg.view()) and drives the public handlers.
   - MESA (0): sees the two open ends and which hands refused them. Calls an end that not every active hand has refused (key 1-6), calls the other end when the
               first one was refused by everybody. With 3 seats it also draws (key A / B) for a stuck hand when the table is blocked.
   - MANO (1, 2): sees only its own tiles and the called number. Taps (public down) a tile that has the number, ~150 ms after the call showed up. No such tile = nothing
               (the game sends the "no tengo" by itself).
   - POZO (3): sees the pile count and the stuck flags. When the table is blocked it draws (key 1 / 2) for the stuck hand with fewer tiles. */
const REACT = { mesa: .12, hand: .15, pozo: .2 };
const mesa = (g, role) => {
  let key = '', since = 0, lastDraw = -9;
  return {
    tick(T, dt) {
      const v = g.dbg.view(), act = [1, 2].filter(h => v.cnt[h] > 0);
      const sig = [v.ver, v.call.join(), v.callV, v.refused[1].join(), v.refused[2].join(), v.blocked, v.pile].join('|');
      if (sig !== key) { key = sig; since = T; }
      if (T - since < REACT.mesa) return;
      if (v.blocked && v.n === 3 && v.pile > 0 && T - lastDraw > .8) {
        const hs = act.filter(h => v.stuck[h - 1]).sort((a, b) => v.cnt[a] - v.cnt[b]);
        if (hs.length) { lastDraw = T; const e = { code: hs[0] === 1 ? 'KeyA' : 'KeyB' }; g.key(e); g.keyup(e); return; }
      }
      const ends = v.l === v.r ? [v.l] : [v.l, v.r], dead = e => act.length > 0 && act.every(h => v.refused[h].includes(e));
      const called = v.callV === v.ver ? v.call : [];            // numbers already asked at this line version
      const next = ends.find(e => !dead(e) && !called.includes(e));
      if (next === undefined) return;                          // everything asked: wait for the hands to answer
      const e = { code: 'Digit' + next }; g.key(e); g.keyup(e);
    },
  };
};
const mano = (g, role) => {
  const first = new Map(), done = new Set();
  return {
    tick(T, dt) {
      const v = g.dbg.view(); if (!v.call.length || v.callV !== v.ver || v.inflight) return;
      const k = v.ver + ':' + v.call.join() + ':' + v.tiles.length; if (done.has(k)) return; if (!first.has(k)) first.set(k, T);
      if (T - first.get(k) < REACT.hand) return;
      const q = v.tiles.find(x => v.call.includes(x.a) || v.call.includes(x.b)); done.add(k);
      if (q) { g.down({ x: q.x, y: q.y }); g.up({ x: q.x, y: q.y }); }
    },
  };
};
const pozo = (g, role) => {
  let since = -9, key = '', last = -9;
  return {
    tick(T, dt) {
      const v = g.dbg.view(), sig = [v.blocked, v.pile, v.stuck.join(), v.cnt.join(), v.lock].join('|');
      if (sig !== key) { key = sig; since = T; }
      if (!v.blocked || v.pile <= 0 || v.lock || T - since < REACT.pozo || T - last < .8) return;
      const hs = [1, 2].filter(h => v.stuck[h - 1] && v.cnt[h] > 0).sort((a, b) => v.cnt[a] - v.cnt[b]);
      if (hs.length) { last = T; const e = { code: 'Digit' + hs[0] }; g.key(e); g.keyup(e); }
    },
  };
};
module.exports = { sq_tranca: n => Array.from({ length: n }, (_, r) => r === 0 ? mesa : r === 3 ? pozo : mano) };
