'use strict';
/* bots for du_rails (SWITCH PANIC). Role-honest:
   - the TUNNEL SIDE bot reads only what its screen shows (g.dbg.view(): the trains from the lamp to its switch, their colour, the flag it
     raised and the friend's call ▲ 0 / ▼ 1 once it is back). It flags each train's colour with keys 1-4 after a human-ish reaction time,
     then sets its switch with the arrow keys the way the friend called. It never sees the sheds, so without a call it does nothing.
   - the STATION SIDE bot reads only the flag that is up (a colour) and the sheds (top to bottom); it never sees a train's colour. It taps
     the shed of the flag's colour. Without a flag it has nothing to go on. */
function tunnelBot(g) {
  const seen = new Map(), called = new Map();
  return {
    tick() {
      const v = g.dbg.view();
      for (const tr of v.trains) if (!seen.has(tr.i)) seen.set(tr.i, g.c);
      const nf = v.trains.find(tr => tr.fl === null);                         // flag the first train without one
      if (nf && g.c - seen.get(nf.i) > .22) { g.key({ code: 'Digit' + (nf.c + 1), repeat: false }); return; }
      const nx = v.trains[0]; if (!nx || nx.call === null) return;             // the next train at my switch: wait for the call
      if (!called.has(nx.i)) called.set(nx.i, g.c);
      if (g.c - called.get(nx.i) < .18) return;                               // reaction time
      if (v.sw !== nx.call) g.key({ code: nx.call ? 'ArrowDown' : 'ArrowUp', repeat: false });
    },
  };
}
function stationBot(g) {
  const seen = new Map(); let lastTap = -9;
  return {
    tick() {
      const v = g.dbg.view(); if (!v.flag) return;
      if (!seen.has(v.flag.i)) seen.set(v.flag.i, g.c);
      if (g.c - seen.get(v.flag.i) < .25 || g.c - lastTap < .2) return;       // read the flag, find the shed
      const k = v.sheds.indexOf(v.flag.c); lastTap = g.c;
      g.down({ x: 740, y: v.rows[k] - 40 });                                    // tap the shed itself
    },
  };
}
module.exports = { du_rails: [tunnelBot, stationBot] };
