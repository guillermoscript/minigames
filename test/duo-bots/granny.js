'use strict';
/* bots for du_granny (GRANNY'S WATCHING). Role-honest: a kid only uses what its own screen shows -
   its own early warning (g.dbg.tell(): needles stopped / eyes in the kettle, false alarms included), grandma's head (g.dbg.phase():
   whipping round or staring = both screens) and the friend's kid as drawn (g.dbg.friend(): moving or stiff, as received).
   Same strategy for both kids: tiptoe, freeze on my warning or when she turns, and also freeze when the friend suddenly stops while
   I am walking (it saw something I did not) until she has looked and turned back, or the friend walks on. Reacts a human-ish .3 s late both ways (slower than a whip, so a kid that ignores its friend gets caught: the test checks the relay). */
const kid = () => (g) => {
  const st = { want: false, flip: -9, alarm: -9, frM: false };
  return {
    tick(T) {
      const d = g.dbg, me = d.me(), fr = d.friend(), ph = d.phase();
      if (me.in || d.caught()) return;
      if (st.frM && !fr.m && !fr.in && st.want) st.alarm = T;           // my friend just froze while I was walking
      st.frM = fr.m;
      if (ph === 'back') st.alarm = -9;                                  // she looked and is turning away again: that was it
      const alarm = st.alarm > 0 && !fr.m && T - st.alarm < 2.6;
      const want = !(d.tell() || ph === 'whip' || ph === 'look' || alarm);
      if (want !== st.want) { if (st.flip < 0) st.flip = T; if (T - st.flip >= .3) { st.want = want; st.flip = -1; want ? g.down({ x: 400, y: 300 }) : g.up({ x: 400, y: 300 }); } }
      else st.flip = -1;
    },
  };
};
module.exports = { du_granny: [kid(), kid()] };
