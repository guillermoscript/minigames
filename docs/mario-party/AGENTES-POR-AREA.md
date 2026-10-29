# LA FIESTA · one agent per area (rewritten 2026-10-17, evidence-based)

Goal: a Mario Party-style game, ONLINE and REALTIME, 2-4 friends each on their own phone, on a giant Venezuela map with Venezuelan minigames. Target now = a BETA a person can share by link and play a full 15-turn game. AAA polish comes later.

## 0. Measured state (every number has a command; re-run before trusting)

| Evidence | Command | Result on 2026-10-17 |
|---|---|---|
| Unit/integration suite | `node --test --test-reporter=tap test/fiesta-*.test.js test/party-mj.test.js` | **554 tests: 551 pass, 2 fail, 1 todo** |
| Failing 1 | `fiesta-personajes.test.js:141` "draw ... < 1 ms" | 2.118 ms per draw (perf threshold; check if machine noise or real) |
| Failing 2 | `fiesta-live-cerro.test.js` ghost-trajectory test (median < 20 px, max < 90 px) | fails at 150 ms / 5% loss |
| Todo (known) | `fiesta-live-futbolito.test.js` block I | judge advantage in model C above 1/2 + 8 pp, 14 seeds |
| Server hooks | `node pocketbase/pb_hooks/party.test.js` | "fiesta OK", "fiesta M2 server OK" |
| e2e (real PocketBase + Chrome) | `node test/fiesta.e2e.js`, `node test/fiesta-mj.e2e.js` | **NOT RUN in this pass** (unmeasured) |
| Catalog | `CATALOGO` in `fiesta-reglas.js` | 24 cards; **11 live**: ffa/survival 9 (cola, domino, tequeno, harina, cerro, perro, mecate, chancla, abuela), 2v2 1 (futbolito), 1v3 1 (patilla); 13 not built |
| Authoring guide | `ls docs/mario-party/GUIA-DE-JUEGOS.md` | missing |
| Balance simulator | `ls docs/style-lab/pruebas/sim-balance.js` | missing |
| Audio / art notes | `fiesta-audio.js`, `ARTE.md` | both missing (`MAPA-ARTE.md` exists) |
| Load harness / deploy doc | `test/load/`, `DEPLOY.md` | both missing |
| Fiesta art assets | `du -sh docs/style-lab/assets/fiesta` | 2.4 MB of the 3 MB budget |

Stale claims removed from the old version: "about 35% / 50% progress" (no basis, dropped), "Area 5 ~15%" (9 of the 12 FFA games already live), "HANDOFF: 100/100 passes" (now 551/554). Per-area percentages below are deliverable counts, not feelings; where nothing can be counted the cell says **unmeasured**.

| # | Area | Weight | Measured deliverables |
|---|---|---|---|
| 1 | Foundations | 12% | Reducer, net, director, PocketBase fiesta + M2 server exist and pass. Missing: 1000-game soak, 4-director chaos test (**unmeasured**: check `fiesta-sim.test.js` and `fiesta-net.test.js` for them first) |
| 2 | Lobby and live board | 12% | Files + `fiesta-ui.test.js` exist and pass; 380 `fiesta-*` PNGs in `pruebas/out`; readability gates (below) **unmeasured**; e2e not run |
| 3 | Minigame engine | 10% | `fiesta-live.js` + 9 `fiesta-live-*.test.js` exist. Missing: `GUIA-DE-JUEGOS.md`, template; 1 failing test (cerro ghosts); latency matrix 50/150/300 ms **unmeasured** |
| 4 | Team formats | 6% | Wave 1: 2 of 2 live (futbolito, patilla). Wave 2: 0 of 6. Open: futbolito judge advantage (todo) |
| 5 | FFA catalog | 25% | 9 of the ≥12 target live (75%). Missing in card list: cotufas, bolas, bombita, bombillo (+ 3 epic challenges, later) |
| 6 | Economy and board | 12% | Design phase: `sim-balance.js` missing (0 of 1). Code phase: **unmeasured** (check `fiesta-reglas.js` for items/shops/tolls first) |
| 7 | Art, sound, characters | 15% | 8 characters file + 2.4 MB assets exist; `ARTE.md` and `fiesta-audio.js` missing |
| 8 | Final, load, release | 8% | 0 of 3 (`test/load/`, `DEPLOY.md`, telemetry) |

## 1. Rules for every session

- Model roles: **Sonnet** = main worker (design, code, tests, bots). **Haiku** = mechanical, well-specified tasks only (run suites, capture screenshots, bench tables, renaming, size checks); never a decision. **Opus** = only for a hard root cause, a contract/economy design others depend on, or a contract-change review.
- Review policy (owner preference: build fast, the owner reviews; see open question Q1): agents run the AUTOMATED checks of their area. Adversarial agent review is OFF by default. Turn it on only if the owner asks.
- Shared rules: no git commits unless asked; no `Math.random` in game logic (seeded RNG, `c.rng`); server-shared code is Goja-compatible (ES2015: no `?.`, `??`, object spread, async, private fields); draw only with lab primitives; do not break existing suites; gameplay first, only snes/16-bit looks matter; report honestly what ran and what did not (paste the command and its last lines).
- Read first, always: `HANDOFF.md`, `07-multijugador-online.md` (§2.1 glossary wins), `M2-SPEC.md` and the docs named in the area. Docs are Spanish, code comments mostly Spanish.
- Obsolete, never use or touch: `fiesta-vs.js`, `vs.html`, `juegos-vs-lista.js`, `juego-f-*.js` (old same-screen drafts), `mapa-ilustrado.html`, `mapa-referencias.html`, `mapa-tablero.*`, `assets/venezuela-board/`. Real minigames are `fiesta-juego-*.js`.
- Delete-candidate noted, not touched: `docs/style-lab/fiesta-main.js-E` (stray sed backup).

## 2. File ownership (check against `git status` before editing)

| File / path | Owner | Others may |
|---|---|---|
| `fiesta-reglas.js` (core reducer) | Area 1 | areas 4/5 edit only their own `CATALOGO` lines; area 6/8 add actions through area 1 |
| `fiesta-net.js`, `fiesta-director.js`, `pb_hooks/party*.js`, `pb_migrations/*party*` | Area 1 | none |
| `fiesta-live.js`, `test/fiesta-live*.test.js`, `test/helpers/live-*.js`, `GUIA-DE-JUEGOS.md` | Area 3 | area 4 team-specific parts only |
| `fiesta-carta.js`, `M3-TEAMS-SPEC.md`, team games | Area 4 | none |
| `fiesta-juego-<id>.js` (+ test, bench) | Area 5 (FFA) / Area 4 (team) | none |
| `fiesta-lobby.js`, `fiesta-ui.js`, `fiesta-tablero.js` (look), `fiesta-camara.js` (feel), `test/fiesta-ui.test.js` | Area 2 | area 7 gives integration points in reports |
| `fiesta-main.js` | Area 1 (plugs), Area 2 requests changes via report | none |
| `assets/fiesta/`, `fiesta-audio.js`, `ARTE.md` | Area 7 | none |
| `pruebas/sim-balance.js`, `05` balance appendix | Area 6 | none |
| `test/load/`, `Dockerfile`, `scripts/`, `DEPLOY.md` | Area 8 | none |

Gate: the old "wait for the team-games workflow" note is replaced by a check. Before editing any file owned by areas 1/3/4, run `git status --short -- docs/style-lab/fiesta-reglas.js docs/style-lab/fiesta-live.js docs/style-lab/fiesta-carta.js docs/style-lab/fiesta-main.js` and read the workflow's report; if the report is missing, stop and ask the owner.

## 3. Critical path to the friends beta

1. Fix the 2 failing tests (Area 3 for cerro, Area 2 for the character draw perf).
2. Area 3 ships `GUIA-DE-JUEGOS.md` + template (unblocks Area 5 waves 2-3 and Area 4 wave 2).
3. Area 5 reaches 12 FFA games (3 more) while Area 4 builds wave 2.
4. Area 6 design (simulator) in parallel, then its reducer actions serialized through Area 1.
5. Area 8 load + deploy; first real 4-phone game.
Waves: **A now** = Areas 2, 6 (design), 7, 8 (harness). **B** = Areas 3, 4, 5, 6 (code), 1 after step 2 gate checks above.

---

## AREA 1 · Foundations (rules, net, server) · 12%

Why: everything rests on this. If the reducer, transport or PocketBase fiesta mode drift or desync, nothing above matters.
Outcome: 4 players on different networks always see the same state; reconnect/sleep/reload/seat takeover recover; the server alone decides money, stars and results.
Scope: stale-version, long-sleep reconnect, AFK to CPU and back, action idempotency, board size growth, Goja clone cost; randomized soak; chaos test; keep the reducer API stable (document changes in 07 §2.1).
Acceptance (all by command):
- `node --test test/fiesta-*.test.js test/party-mj.test.js` and `node pocketbase/pb_hooks/party.test.js`: zero failures, zero new todo.
- Soak: 1000 seeded games, mixed human/CPU: no negative coins/stars, valid nodes, monotonic `ver`, game ends at `tot`, serialized `board` < 16384 bytes at round 20, no seed in the board.
- Chaos: 4 directors over a 5%-loss relay at 50/150/300 ms end with identical `hash(D)` in 20 of 20 runs.
Subagents: Sonnet (hardening, tests); Haiku (run suites, tabulate); Opus only for a protocol/reducer-contract change.

```
You are the lead engineer of the FOUNDATIONS of LA FIESTA (online realtime Mario Party on a Venezuela map; repo /Users/guillermomarin/Documents/GitHub/minigames). Read docs/mario-party/HANDOFF.md, 07 (§2.1 glossary wins), 09, M2-SPEC.md, then fiesta-reglas.js, fiesta-net.js, fiesta-director.js, pocketbase/pb_hooks/party*.js and test/fiesta-sim.test.js, test/fiesta-net.test.js (see what soak/chaos coverage already exists before writing any). WHY: every area builds on this; it must be deterministic and boring. OUTCOME: 4 players on different networks converge on the same state and recover from sleep/reload/seat takeover; the server alone decides money/stars/results. Do: harden stale-version/reconnect/AFK/idempotency, add (if absent) a 1000-game seeded soak and a 4-director lossy-relay chaos test, measure board bytes at round 20 and Goja reducer clone time. Pass criteria, each with its command output pasted: all existing suites green; soak invariants hold over 1000 games (nothing negative, valid nodes, monotonic ver, ends at tot, board < 16384 B, no seed in board); chaos ends with identical hash(D) in 20/20 runs. Keep reducer semantics stable (log changes in 07 §2.1). Own only fiesta-reglas.js (not CATALOGO lines of other areas), fiesta-net.js, fiesta-director.js, pb_hooks/party*.js, migrations and their tests; check git status first for files other sessions are editing. No commits, ES2015 for server-shared code, no Math.random in logic. Sonnet subagents do the work, Haiku subagents run suites and summarize, Opus only for a contract-change review. Report what passes and what does not.
```

---

## AREA 2 · Lobby and live board · 12%

Why: friends spend most of the 45 minutes here; a gray, confusing board kills the party even with great minigames.
Outcome: open the link, create/join by code, pick a character, and always know whose turn it is, where you are, what each tile does and what just happened, without a tutorial, on a phone in portrait and landscape.
Scope: lobby (code, share, ready, host tools, connection indicator, emotes), 8-character select (phrase + poses celebrate/lose/wait/talk), board readability (tile icons, legend, region labels not colliding with tokens/dice, token fans, camera follow + full map), HUD, end-screen podium, 60 fps. Snes only.
Acceptance (by measurement):
- `node --test test/fiesta-*.test.js` green (includes `fiesta-ui`, `fiesta-tablero`, `fiesta-camara`), `node test/fiesta.e2e.js` green.
- Screenshots at 360x640 and 932x430 via `pruebas/fiesta-ui-capturas.js` / `fiesta-lobby-capturas.js`: touch targets ≥ 44 px (assert in the UI test, not by eye), no overlaps between region labels, tokens, dice and HUD (assert bounding boxes), frame time p95 ≤ 16.7 ms on `pruebas/fiesta-tablero-perf.js`.
- Each screenshot read with the Read tool; list found problems and fixes.
Subagents: Sonnet (layout, implementation); Haiku (captures, overlap lists, test updates).

```
You are the lead UI/UX engineer of LA FIESTA's lobby and live board (repo /Users/guillermomarin/Documents/GitHub/minigames, docs/style-lab). Read docs/mario-party/HANDOFF.md, 07 §5, §7, §8, then fiesta-lobby.js, fiesta-ui.js, fiesta-tablero.js, fiesta-camara.js, fiesta-main.js, fiesta-reglas.js (PERSONAJES, FX_MS), and look at the current screenshots in docs/style-lab/pruebas/out/fiesta-*.png first. WHY: friends spend most of a game on the board; if it is confusing the party dies. OUTCOME: a person opens the link, creates/joins by code, picks a character and understands whose turn it is, where they are, what each tile does and what just happened, without a tutorial, in portrait and landscape. Build: lobby polish (share/invite, ready, host tools, connection indicator, emotes), 8-character select with phrase and poses, board readability (tile icons, legend, non-colliding labels, token fans, camera follow + full map), HUD (banner, timer, cards, prompts), end-screen podium. 16-bit (snes) only; gameplay clarity over style. Pass criteria, each measured: `node --test test/fiesta-*.test.js` and `node test/fiesta.e2e.js` green; UI test asserts every touch target ≥ 44 px and no bounding-box overlap between labels/tokens/dice/HUD at 360x640 and 932x430; frame-time p95 ≤ 16.7 ms in pruebas/fiesta-tablero-perf.js; every screenshot opened with Read and the problems you found listed with how each was fixed. Own only fiesta-lobby.js, fiesta-ui.js, fiesta-tablero.js (look), fiesta-camara.js (feel), assets/fiesta/, test/fiesta-ui.test.js. Never change reducer/net/director/server: report needed data instead. Check git status for files other sessions edit. Sonnet subagents for UX/implementation, Haiku for captures and overlap lists. No commits.
```

---

## AREA 3 · Minigame engine · 10%

Why: it is the realtime promise. One bug here breaks every minigame.
Outcome: a new game plugs in with one `FIESTA.LIVE.add` and gets synced "YA!", 3-2-1, one judge, judge migration, CPU takeover, bounded results. Design rule: solo = model A, contested/cooperative = model C, B for light contested moments.
State: runtime and 9 live test files exist. Open: failing cerro-ghost test, futbolito judge-advantage todo, f_harina e2e flake (once in 4 runs), no authoring guide.
Acceptance:
- `node --test test/fiesta-live*.test.js`: 0 failures, 0 todo, at 50/150/300 ms with 5% loss.
- Cerro ghost test passes (median < 20 px, max < 90 px) with the cause explained; harina e2e passes 10 of 10 consecutive runs.
- `GUIA-DE-JUEGOS.md` plus a template game: validated by a fresh Haiku subagent that builds a trivial new game from the guide alone and gets it to pass the live checklist (08 §11.2) with no other help.
Subagents: Sonnet (netcode, guide); Haiku (latency matrix runs, doc tables, the guide validation); Opus only for a flake root cause Sonnet cannot find, or a contract change.

```
You are the lead netcode engineer of LA FIESTA's live minigame engine (repo /Users/guillermomarin/Documents/GitHub/minigames). Read 08, 09, M2-SPEC.md, M3-TEAMS-SPEC.md, then fiesta-live.js and every test/fiesta-live*.test.js. WHY: the engine makes friends on separate phones play the same minigame at the same moment; one bug breaks every game. OUTCOME: a new game plugs in with FIESTA.LIVE.add and automatically gets synced YA!, 3-2-1, one judge, judge migration, CPU takeover and bounded results. Rule from the owner: solo = model A, contested/cooperative = model C, B only for light contested moments. Start from failing evidence: reproduce (with the command and seed) the failing f_cerro ghost-trajectory test and the f_harina e2e flake (A scored 0 once in 4 runs) before changing anything, then find the root cause, not a threshold bump. Then close the futbolito judge-advantage todo if it is an engine issue, and write docs/mario-party/GUIA-DE-JUEGOS.md plus a template game and checklist. Pass criteria, with pasted output: node --test test/fiesta-live*.test.js has 0 failures and 0 todo at 50/150/300 ms with 5% loss; harina e2e passes 10 consecutive runs; a fresh Haiku subagent given only the guide and template builds a trivial new game that passes the 08 §11.2 checklist. Own only fiesta-live.js, test/fiesta-live*.test.js, test/helpers/live-*.js, GUIA-DE-JUEGOS.md. Check git status and the team-games report before editing fiesta-live.js. Sonnet for netcode and guide, Haiku for the latency matrix and the guide validation, Opus only for a hard root cause or a contract-change review. No commits, ES2015 server-shared code, no Math.random in logic.
```

---

## AREA 4 · Team formats (2v2, 1v3) · 6%

Why: team rounds make it a party (alliances, one against all). Formats are picked by player color; they fall back to free-for-all only when no live game exists for the format.
State: f_futbolito (2v2, model C) and f_patilla (1v3, model B) are live. 8 more team cards are not built (carrucha, hallacas, cava, cuerda for 2v2; bono, guaya, alcabala, silbon for 1v3, per `CATALOGO`).
Outcome: wave 2 of 3 more 2v2 and 3 more 1v3, team HUD, tie rules, a balance knob per 1v3 game.
Acceptance per game (08 §11.2, all by command): same result on all screens at 50/150/300 ms; one verdict if the judge dies; CPU seat plays for real; judge advantage ≤ 1/n + 8 pp over 200 seeds (bench script); 1v3 solo wins 38-52% with equal bots over 200 seeds. Plus: futbolito judge-advantage todo resolved or documented with numbers.
Subagents: Sonnet (design, code, balance); Haiku (200-seed benches, tables).

```
You are the lead for TEAM FORMATS in LA FIESTA (repo /Users/guillermomarin/Documents/GitHub/minigames). Read 08 (binary scoring, team cards), M3-TEAMS-SPEC.md, GUIA-DE-JUEGOS.md if it exists (if not, use fiesta-juego-futbolito.js and fiesta-juego-patilla.js as templates), the tests test/fiesta-live-futbolito.test.js and test/fiesta-live-patilla.test.js, and the benches pruebas/fiesta-futbolito-bench.js and fiesta-patilla-bench.js. WHY: team and one-vs-all rounds make it a party. OUTCOME: wave 2 = 3 more 2v2 and 3 more 1v3 games from the CATALOGO cards not yet live, one file per game docs/style-lab/fiesta-juego-<id>.js, each with bot, bench, tunable balance knob for 1v3, touch and keyboard controls, levels 1-3, a Venezuelan gag and a CPU that plays for real. First, resolve or document with numbers the open futbolito judge-advantage todo (model C, 14 seeds). Pass criteria per game, with pasted bench output: same result on all screens at 50/150/300 ms with 5% loss; single verdict if the judge dies; CPU seat plays; judge advantage ≤ 1/n + 8 pp over 200 seeds; 1v3 solo win rate 38-52% with equal-skill bots over 200 seeds. Snes 16-bit only; gameplay over visuals. Edit only your own CATALOGO lines (set live:1 and lim only after the game passes) and files you own; do not edit fiesta-live.js (ask Area 3). Sonnet for design/code/balance, Haiku for 200-seed runs and tables. No commits, no Math.random in logic.
```

---

## AREA 5 · FFA minigame catalog · 25%

Why: variety is replay value; Venezuelan humor is the identity.
State: 9 FFA games live (cola, domino, tequeno, harina, cerro, perro, mecate, chancla, abuela). Target is ≥ 12 FFA, so 3 more are needed from: cotufas (rank, B), bolas (rank, C), bombita (survival, B), bombillo (survival). The 3 epic challenges are a later wave.
Outcome: wave 2 = 4 new FFA games (cotufas, bolas, bombita, bombillo), each 25-60 s, understood from the card in 15 s, 1-2 buttons or a stick, levels 1-3, CPU plays for real, Venezuelan gag.
Acceptance per game (by command): `node --test test/fiesta-juego-<id>.test.js test/fiesta-live-<id>.test.js` green; same result on all screens at 50/150/300 ms with 5% loss; single verdict if the judge dies; seat down becomes CPU; result inside `lim` bounds; judge advantage ≤ 1/n + 8 pp over 200 seeds (bench); drawn correctly in snes (one screenshot read with Read, no overlap with clock/controls). The owner plays each wave and approves before the next (human gate).
Subagents: one Sonnet per game (design, code, bot); one Haiku per game (bench, test, result row). No automatic Opus review (see Q1).

```
You are the lead for the FFA MINIGAME CATALOG of LA FIESTA (repo /Users/guillermomarin/Documents/GitHub/minigames). Read 08 (cards, §10 order, §11.2 checklist), 09 models, GUIA-DE-JUEGOS.md if it exists, and the finished games docs/style-lab/fiesta-juego-mecate.js, fiesta-juego-domino.js, fiesta-juego-harina.js, fiesta-juego-cola.js as templates with their tests test/fiesta-juego-*.test.js and test/fiesta-live-*.test.js and benches in docs/style-lab/pruebas/fiesta-*-bench.js. Nine FFA games are already live; do NOT rebuild them. WHY: variety is replay value and Venezuelan humor is the identity. OUTCOME: wave 2 = four new FFA games f_cotufas, f_bolas, f_bombita, f_bombillo (use the model written in their CATALOGO line: A solo, C contested/cooperative, B light contested), 25-60 s, understood from the card in 15 s, 1-2 buttons or a stick, levels 1-3, a CPU that plays for real, a Venezuelan gag. Spawn one Sonnet subagent per game (design, code, bot, test, bench) and one Haiku subagent per game to run the 08 §11.2 checklist. Pass criteria per game, with pasted output: its fiesta-juego and fiesta-live tests green; same result on all screens at 50/150/300 ms with 5% loss; one verdict if judge dies; seat down becomes CPU; result inside lim bounds; judge advantage ≤ 1/n + 8 pp over 200 seeds; one snes screenshot read with Read, no overlap with clock or controls. Then mark the game live:1 with lim in your own CATALOGO line only. Present a table (game, model, test counts, bench numbers, screenshot path) and WAIT for the owner's approval before any next wave. Do not edit runtime or server (stop and ask if the contract must change). Snes 16-bit only; gameplay over visuals. Owner prefers fast builds and reviews them himself: no adversarial agent review unless asked. No commits, no Math.random in logic.
```

---

## AREA 6 · Economy and full board · 12%

Why: minigames give laughs; the board gives stakes, choices and comebacks. It also decides who wins.
Outcome: a 15-turn game under 45 minutes where every turn has a real choice, nobody is hopelessly behind, and luck alone does not decide the winner.
State: `sim-balance.js` missing. Before designing, read `fiesta-reglas.js` and list which of items, shops, tolls, shortcuts, attacks, Cambiazo and duels already exist as reducer actions (unmeasured today).
Acceptance: simulator meets the ranges in doc 05 over 10,000 seeded games (record each range, the target and the result in a table in the 05 appendix); catch-up check: the last-place player at round 8 wins ≥ a target share (set in the simulator from doc 05; if doc 05 gives none, propose one to the owner); skill signal: a policy that plays better than random wins significantly more than 1/n; mean game length ≤ 45 min by simulated minutes; reducer property tests stay green after phase 2.
Subagents: Sonnet (reducer actions, simulator); Opus (the economy model design, because it decides every game's winner); Haiku (10,000-game runs and tables).

```
You are the lead game designer-engineer of LA FIESTA's ECONOMY AND BOARD (repo /Users/guillermomarin/Documents/GitHub/minigames). Read 01, 03, 05, 07 §3-4 and fiesta-reglas.js; first list which board features (items, shops, tolls, shortcuts, attacks, Cambiazo, 1v1 duels, catch-up) already exist in the reducer and which do not. WHY: the board gives stakes, choices and comebacks. OUTCOME: a 15-turn game under 45 minutes where every turn has a real decision, nobody is hopelessly behind, and luck alone does not decide the winner. Phase 1 (can start now, design only): write docs/style-lab/pruebas/sim-balance.js, a 10,000-game seeded simulator with at least a random policy and a smarter policy, that outputs a table of each doc-05 target range versus the simulated result; tune the economy until every range is met, and add the table as a balance appendix to doc 05. Pass criteria: all doc-05 ranges met over 10,000 games; the smarter policy beats random with statistical clarity (report win rates and sample size); catch-up measurable (win share of last place at round 8); mean game length ≤ 45 simulated minutes. Phase 2 (only after the Area 1 owner confirms the reducer is stable by a green full suite): implement the missing features as NEW reducer actions without changing existing semantics, coordinating files with Area 1, and keep reducer property tests green. Questions that belong to the owner (e.g. how aggressive attacks feel) go in a short list; decide everything else from the docs. Sonnet for code, an Opus subagent for the economy model design, Haiku for simulation runs and tables. No commits, no Math.random in logic, ES2015 for server-shared code.
```

---

## AREA 7 · Art, sound, characters · 15%

Why: this is what makes it feel like a real game and what makes friends say "send me the link", but it ranks after gameplay.
Outcome: ONE cohesive snes look; short SFX for dice, coins, star, win, lose, countdown plus a simple music loop; 8 characters that read at small size with a signature pose and line; Venezuelan identity without caricature.
State: `assets/fiesta/` is 2.4 MB of a 3 MB budget; `MAPA-ARTE.md` exists; `ARTE.md` and `fiesta-audio.js` do not.
Acceptance: `ARTE.md` (palette, tile icons, character sheet); `du -sh docs/style-lab/assets/fiesta` + audio < 3 MB; audio starts only after the first tap and works on iOS Safari and Android Chrome (test by a real-device check: human gate); mute button persists; each of the 8 characters readable at 32 px (contact sheet via `pruebas/fiesta-personajes-hoja.js`, read with Read); the owner approves screenshots (human gate).
Subagents: Sonnet (art direction, integration); Haiku (asset optimization, names, size checks, captures).

```
You are the art and audio lead of LA FIESTA (repo /Users/guillermomarin/Documents/GitHub/minigames, docs/style-lab). Read 05, MAPA-ARTE.md, the lab primitives in engine.js and juegos-bus.js (BUS.AP.CAST), fiesta-personajes.js, and look at docs/style-lab/pruebas/out/fiesta-*.png and assets/fiesta/ BEFORE producing anything: extend what exists, do not restart it. WHY: polish turns a prototype into "send me the link", but gameplay comes first, so your work must make the game clearer and more fun. OUTCOME: ONE cohesive 16-bit (snes) look for board, characters and UI; short SFX for dice/coins/star/win/lose/countdown plus a simple music loop; 8 characters that read at 32 px, each with a signature pose and a line; Venezuelan identity without caricature. Do: write docs/mario-party/ARTE.md, add or refine assets under docs/style-lab/assets/fiesta/, add fiesta-audio.js (unlock on first tap, mute button that persists). Pass criteria: total assets + audio under 3 MB (paste du output); contact sheet from pruebas/fiesta-personajes-hoja.js opened with Read showing all 8 characters distinguishable at 32 px; audio does not play before a user gesture (assert in code or a test); owner approves screenshots. Other art styles are out of scope. Area 2 owns the UI files: hand over integration points in a report instead of editing fiesta-ui.js / fiesta-lobby.js. Sonnet for art direction and code, Haiku for optimization, naming and size checks. No commits; ask the owner only for taste decisions that block you, with 3 options each.
```

---

## AREA 8 · Final, load, release · 8%

Why: a game that only works on the developer's laptop cannot be shared; the finale is what people remember.
Outcome: a public link; 50 rooms of 4 play at once with the server healthy; a full game ends with bonus stars and a satisfying final; telemetry shows desync, reconnect and drop-off; a one-page `DEPLOY.md`.
State: nothing built (`test/load/`, `DEPLOY.md` missing). `Dockerfile` and `pocketbase/dev.sh` already have uncommitted changes: read them first.
Acceptance: load harness run of 50 rooms x 4 bots for 10 min: SQLite write p95 < 50 ms, sig rate within 7200/60 (paste the harness output table); a 15-turn game with 4 humans (2 on mobile data) finishes with 0 `fiesta_desync` events (human gate: needs real devices); `DEPLOY.md` followed from scratch by a fresh Haiku subagent reproduces a working local container (`docker build` and `/api/health`-style check); no external deploy without the owner's OK.
Subagents: Sonnet (harness, finale, telemetry); Haiku (deploy checklist, harness runs, tables); Opus only if the load test shows a hard bottleneck.

```
You are the release and reliability lead of LA FIESTA (repo /Users/guillermomarin/Documents/GitHub/minigames). Read 07 §10 (M6), §11-13, 09 §12 and §15, the Dockerfile, pocketbase/dev.sh, scripts/ and the pb_hooks, noting that some of these have uncommitted changes. WHY: a game that only works on the developer's laptop cannot be shared, and the finale is what people remember. OUTCOME: a public link; 50 rooms x 4 bots for 10 minutes with SQLite write p95 < 50 ms and sig within 7200/60; a full game ends with bonus stars and a satisfying finale; telemetry records desync, reconnect and drop-off; a one-page DEPLOY.md. Phase 1 (now): the load harness under test/load/ and the deploy checklist. Pass criteria: paste the harness table (rooms, duration, write p95, sig rate, errors); DEPLOY.md verified by a fresh Haiku subagent following it from scratch to a working local container. Phase 2 (only after Area 1 confirms the reducer stable by a green full suite): bonus stars/final as reducer actions (coordinate with Area 1), telemetry, reconnect polish. Do not deploy or publish anything externally without the owner's explicit OK. The 4-human zero-desync game is a human gate: prepare the telemetry and a one-page procedure for the owner to run it. Sonnet for harness/finale/telemetry, Haiku for the checklist, runs and tables, Opus only for a hard bottleneck analysis. No commits, ES2015 server-shared code.
```

---

## Open questions for the owner

- **Q1 (review policy):** the old doc asked for a Haiku checklist plus one Opus review per catalog wave; your standing preference is fast builds that you review yourself. This version keeps the automated checklist and drops the agent review. Say so if you want the Opus review back.
- **Q2:** `HANDOFF.md` is stale (says 100/100 tests, M2 pending, `juego-f-*.js` naming). Update it from section 0, or leave it as history?
- **Q3:** the 2 failing tests and the unrun e2e suites should be checked first (Area 3, Area 2); is anything in `git status` in the fiesta files intentionally half-done?

## Dependencies at a glance

- 2 and 7 depend on nothing: start now. 8 phase 1 and 6 phase 1 also start now.
- 3's guide unblocks 5 (waves 2+) and 4 (wave 2); 4 shares `fiesta-live.js` with 3.
- 6 phase 2 and 8 phase 2 add reducer actions: serialize them through Area 1.
- The owner decides: taste (7), attack aggressiveness (6), approval between catalog waves (4, 5), and real-phone tests (2, 8).
