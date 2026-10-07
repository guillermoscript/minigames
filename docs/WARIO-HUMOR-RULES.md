# WarioWare humor + microgame rules (for this app)

Goal: even when two games share a mechanic (stop-in-zone, click-the-bugs...), each one must feel like its own
dumb little joke, and WINNING must pay off with a short, funny "good ending" (the reward).

## 1. What makes WarioWare funny (the rules we copy)

1. **One verb, one second to read.** The command word is the whole tutorial ("SNEAK!", "PICK!"). No instructions.
2. **A mundane act made absurd.** Picking a nose, pumping a balloon, shaving a mole. The premise is dumb and specific, never generic ("click the bugs").
3. **Commit to the bit.** Faces are huge, sweaty, over-expressive. Everything reacts: eyes pop, veins show, sweat flies.
4. **Win and lose are both jokes.** Fail is not a red X: it is the funniest possible bad ending (splat, burnt, caught, fart). Win is a triumphant over-the-top payoff.
5. **The payoff is physical.** The thing you did visibly *happens*: balloon explodes, nose-hair pulled out and held up, cat purrs and melts.
6. **Escalation inside 4 seconds.** Start (calm) -> pressure (shake, zoom, sweat) -> resolution (big, loud, funny).
7. **Ugly-cute on purpose.** Thick outlines, flat colour, wrong proportions, a random extra weird detail in the background (a duck, a stare, a floating head).
8. **Sound = punchline.** Every action has a ridiculous SFX; the win/lose sound lands exactly on the visual hit. Silence for one beat before a big gag is allowed.
9. **Nonsense > logic.** Rules may be arbitrary ("catch the cat with a pizza"). Keep the cause/effect legible even if the premise is not.
10. **Variety of tone inside one stage.** Alternate gross / cute / epic / deadpan / retro-parody. Never 3 similar jokes in a row.
11. **Hidden extras.** Rare variants (1 in 8): a cameo, a different ending, an easter egg. Players tell each other about these.
12. **Respect the clock.** Play 3-6 s. Outcome <= ~1.7 s. Never block the next game with a long cutscene.

## 2. Reward rules (the "good ending")

- Every game has a **WIN PAYOFF** of 0.8-1.4 s: the object of the joke resolves visually (not only the generic confetti).
- Payoff has 3 beats: **hit** (freeze 2-3 frames + zoom/shake) -> **gag** (the funny animation) -> **pose** (Claude proud, sparkle, big text).
- Payoff must differ per game *family* so reused mechanics feel different:
  - same mechanic, different **victim / prop / setting / ending**.
- Fail payoff: also a gag, but shorter (0.6-0.9 s) and never mean.
- Perfect play (fast win, no misses) -> **bonus ending**: bigger version (golden, crown, camera flash, extra score pop `PERFECT!`).
- Streaks: 3 wins in a row -> screen gets a fever look (saturated bg, bigger confetti), a visible reward feel.
- Audio: unique short win sting per payoff (rising arpeggio, trumpet, "ta-da" kazoo, crowd cheer). Reuse the generic jingle only as a layer.

## 3. Checklist before shipping a microgame

- [ ] Command word is 1 word, verb, <= 8 letters.
- [ ] Premise is a *specific absurd scene*, not an abstract mechanic.
- [ ] Character has a face and it reacts at least 3 ways (calm / worried / done).
- [ ] There is one background gag unrelated to the task.
- [ ] Win payoff exists, is unique to this game, 0.8-1.4 s.
- [ ] Fail payoff exists and is funny.
- [ ] Sound hits on the visual hit.
- [ ] Doesn't look like another game with the same mechanic at thumbnail size (different palette, silhouette, setting).
- [ ] Works with mouse and touch, readable in <1 s.

## 4. Diagnosis of the current app (July review)

- Generic outcome is the same for every game: `NICE!`/`FAIL!` stamp + confetti + jingle, 0.95 s (`setOutcome` / update in `js/main.js`).
- Some games already react on win (checks of `result === 'win'` in draw) but most only stop and show the stamp.
- The same mechanic repeats with a similar look (stop-in-zone x ~10, click-things x ~10, alternate L/R x 4).

## 5. Proposed implementation

1. Add an optional hook to each game: `g.payoff(t, win)` drawn during the outcome window (`outT`), and `g.payoffDur` (default 1.2 s).
2. `main.js`: outcome window = `max(.95, g.payoffDur)`; keep the NICE!/FAIL! stamp but smaller and over the gag.
3. Shared helpers in `core.js`: `freeze(frames)`, `zoomPunch(x, y, k)`, `sweat(x, y)`, `proudClaude(x, y)`, `crown/sparkle`, `perfect()`.
4. Roll out by family (so duplicates become distinct): stop-in-zone, click-things, alternate L/R, scrub, catch, dodge.
5. Add `PERFECT!` bonus ending + 3-win streak fever look.
