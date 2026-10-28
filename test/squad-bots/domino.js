'use strict';
/* bots for sq_domino (DOMINÓ DE ESQUINA). Role-honest: each reads only what its own screen shows (g.dbg.view(): its own tiles, the open end and the signs that are on
   the table right now, which vanish after 2 s, so the bots remember them) and drives the public handlers.
   - MESA (0): sees the plan. At the start of every round signs the size of the new end (keys Q W E). If two or more hands sign "I have it", points (A S D) at the
               hand whose number is the plan's new end.
   - MANO (1-3): sees its tiles and the open end. Waits for the Mesa's size hint; if a tile that fits has the hinted size it signs "I have it + the other side" (digit),
               otherwise "no tengo" (0). A hand that claimed it plays after a short wait when no other hand claimed it too; if another one did, it waits for the Mesa to point. */
const REACT = { mesa: .12, hand: .15, wait: .75, pick: .45 };
const cl = v => v <= 2 ? 0 : v <= 4 ? 1 : 2;
const press = (g, code) => { const e = { code }; g.key(e); g.keyup(e); };
const mesa = (g, role) => {
  let rd = -1, since = 0, hinted = false, firstClaim = -1, pointed = false; const claim = {};
  return {
    tick(T) {
      const v = g.dbg.view(); if (v.target === null) return;
      if (v.rd !== rd) { rd = v.rd; since = T; hinted = false; firstClaim = -1; pointed = false; for (const k in claim) delete claim[k]; }
      if (!hinted && T - since >= REACT.mesa) { hinted = true; press(g, ['KeyQ', 'KeyW', 'KeyE'][cl(v.target.N)]); }
      for (const s of v.signs) if (s.from >= 1 && s.k >= 1 && s.k <= 6) { if (!(s.from in claim)) claim[s.from] = s.k; if (firstClaim < 0) firstClaim = T; }
      const who = Object.keys(claim);
      if (!pointed && who.length >= 2 && T - firstClaim >= REACT.pick) {
        const h = who.find(f => claim[f] === v.target.N);
        if (h !== undefined) { pointed = true; press(g, ['KeyA', 'KeyS', 'KeyD'][h - 1]); }
      }
    },
  };
};
const mano = (g, role) => {
  let rd = -1, since = 0, hint = -1, claimed = -1, answered = false, played = false, ptd = -1; const others = new Set();
  return {
    tick(T) {
      const v = g.dbg.view(); if (v.E === null) return;
      if (v.rd !== rd) { rd = v.rd; since = T; hint = -1; claimed = -1; answered = false; played = false; ptd = -1; others.clear(); }
      for (const s of v.signs) {
        if (s.from === 0 && s.k >= 7 && s.k <= 9) hint = s.k - 7;
        else if (s.from === 0 && s.k >= 10) ptd = s.k - 10;
        else if (s.from >= 1 && s.from !== role && s.k >= 1 && s.k <= 6) others.add(s.from);
      }
      if (T - since < REACT.hand || hint < 0 || played) return;
      const q = v.tiles.find(x => x.fit && !x.dead && cl(x.other) === hint);
      if (!answered) { answered = true; if (q) { claimed = T; press(g, 'Digit' + q.other); } else press(g, 'Digit0'); return; }
      if (!q) return;
      if (ptd === role - 1 || (ptd < 0 && !others.size && T - claimed >= REACT.wait)) { played = true; g.down({ x: q.x, y: q.y }); g.up({ x: q.x, y: q.y }); }
    },
  };
};
module.exports = { sq_domino: n => Array.from({ length: n }, (_, r) => r === 0 ? mesa : mano) };
