'use strict';
/* bots for TWO-CLAW CRANE (js/games/duo/crane.js). Role-honest: a bot only uses what its own screen shows - the two marked grips
   (g.dbg.grips(), empty while the prize is falling / being lifted), its own claw (g.dbg.me()) and its friend's claw as drawn
   (g.dbg.friend(): interpolated x, state, the grip it hangs on). The deal two friends would shout: pink takes the left mark, blue
   the right one (if the friend already hangs on one, take the other).
   Pairs play in turns, three styles, like real pairs do (a counter picks the style per round, so the stress runs cover all of them):
   - 'together': drop once over your mark and the friend is over theirs (or already dropping / holding), after a human-ish reaction;
   - 'lead pink' / 'lead blue': the leader drops as soon as it is lined up and sees its friend nearby; the follower waits for the
     prize to TIP (its friend's claw holding on screen) and only then reacts, 0.3-0.45 s later - the "it screams, GO!" path.
   Alone, a bot gets bored and drops anyway after a while. */
let ROUND = 0;
function bot(g, role) {
  if (role === 0) ROUND++;
  const style = ROUND % 3, lead = style === 1 ? 0 : style === 2 ? 1 : -1, RT = ROUND % 2 ? .3 : .45;
  const st = { at: null, seen: null };
  return {
    tick() {
      const d = g.dbg, gr = d.grips(), me = d.me(), fr = d.friend();
      if (!gr.length || me.st !== 'top') { st.at = null; st.seen = null; return; }
      const sorted = gr.slice().sort((a, b) => a.x - b.x);
      const mine = fr.hold >= 0 ? gr.find(q => q.i !== fr.hold) : sorted[role], other = gr.find(q => q.i !== mine.i);
      g.move({ x: mine.x, y: 300 });
      if (Math.abs(me.x - mine.x) > 6) { st.at = null; return; }
      if (st.at === null) st.at = g.c;
      if (g.c - st.at > 2.5) { g.drop(); return; }                                         // bored: drops alone
      if (lead === role) { if (g.c - st.at > .2 && Math.abs(fr.x - other.x) < 60) g.drop(); return; }
      if (lead >= 0) {                                                                    // follower: react to the tip
        if (fr.hold === other.i) { if (st.seen === null) st.seen = g.c; if (g.c - st.seen >= RT) g.drop(); } else st.seen = null;
        return;
      }
      const ready = fr.hold === other.i || (fr.st === 'down' && Math.abs(fr.x - other.x) < 30) || (fr.st === 'top' && Math.abs(fr.x - other.x) < 14);
      if (ready && g.c - st.at > .15) g.drop();
    },
  };
}
module.exports = { du_crane: [bot, bot] };
