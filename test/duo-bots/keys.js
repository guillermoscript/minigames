'use strict';
/* bots for du_keys (SPLIT KEYBOARD). Role-honest: a bot reads only the print point of its own screen (g.dbg.next(): the letter
   to type and whether it is underlined in its colour or the friend's, and whether its own half is jammed) and its own 4 keys
   (g.dbg.keys). When the letter turns into its own it "finds" the key after a human-ish reaction time and presses it; now and
   then it fumbles a neighbouring key (a typo, which jams its half for a moment). */
function bot(g, role) {
  const st = { i: -1, at: 0, n: 0 };
  return {
    tick(T) {
      const nx = g.dbg.next(); if (!nx || !nx.mine || nx.jam) { st.i = -1; return; }
      if (nx.i !== st.i) { st.i = nx.i; st.at = T; st.wait = .18 + ((nx.i * 7 + role * 3) % 5) * .035; }   // 0.18 .. 0.32 s to find the key
      if (T - st.at < st.wait) return;
      const keys = g.dbg.keys; let ch = nx.ch;
      if (++st.n % 17 === 0) ch = keys[(keys.indexOf(ch) + 1) % keys.length];                           // a fumble every ~17 presses
      g.key({ code: 'Key' + ch, repeat: false });
      st.i = -1;                                                                                          // look again (after a typo: wait for the jam)
    },
  };
}
module.exports = { du_keys: [bot, bot] };
