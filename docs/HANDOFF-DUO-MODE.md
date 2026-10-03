# Handoff: DUO mode (asymmetric co-op inside ONE microgame)

> **STATUS: built (uncommitted).** Everything below the line was implemented: `sig` relay via the realtime broker (verified on PB v0.40.4, no fallback needed), roles derived as `(index + round) % 2` (`roleOf` in party.js, `duoCtx` in js/party.js), shared verdict = team wins if any player reports a win, DUO lobby mode, 4 games in `js/games/du1.js`, tests `party.test.js` + `test/duo.test.js` + `party.e2e.js`. Two headless browsers (Playwright's own Chromium, not the owner's Chrome) played 8 DUO rounds over the real server. Still not tried: touch emulation on a real phone and DevTools throttling by a human.

Audience: the next agent. Read this top to bottom before touching code. Language of UI strings: English source + Spanish in `js/i18n/es/`.

## Goal
Add a room mode where **two (or more) players act inside the same microgame with different roles** (WarioWare: Get It Together! style): e.g. P1 steers a basket while P2 throws coins; P2 sees a code, P1 must type it; P1 holds a lever while P2 spins a crank. Win/lose is shared by the whole team.

Chosen with the owner: ship a first slice = a new room mode **DUO** (next to VERSUS and TEAM) + **3-4 role games**, then judge how the network lag feels before building more.

## What exists today (do not rebuild)
PARTY mode, rooms with friends, VERSUS/TEAM. Every player plays **their own copy** of a microgame built from a shared seed; only results are exchanged.

| Piece | File |
|---|---|
| Pure room logic (create/join/leave/start/report/advance/tick/again, scoring) + unit tests | `pocketbase/pb_hooks/party.js`, `party.test.js` |
| PocketBase glue: one route `POST /api/party/{action}`, transaction, `rooms` record <-> room object, `/r/{code}` invite page, GC cron | `pocketbase/pb_hooks/party_routes.js`, registered in `claudeware.pb.js` |
| `rooms` collection (public view by id, no list, no client writes, hidden `keys` field) | `pocketbase/pb_migrations/1790900600_party_rooms.js` |
| Client: network, SSE + poll, room state machine, lobby/wait/results/end screens, in-game HUD | `js/party.js` |
| Integration in the game loop (`mode === 'party'`, `state === 'party'`) | `js/main.js` (search `party`) |
| Seeded construction (`withSeed`, `mulberry32`) | `js/core.js` |
| The 4 current party microgames (`pt_mash/sync/memo/grab`) | `js/games/pt1.js`, `js/i18n/es/pt1.js` |
| E2E against a live PocketBase | `test/party.e2e.js` |

### How a round works now
1. Host `POST /api/party/start` -> server picks `game` (from `GAMES` in `party.js`) + `seed`, sets `state:'round'`.
2. Realtime pushes the room record (topic `rooms/<id>`); `js/party.js onRoom()` -> `startLocalRound()` -> `beginGame()` in main.js builds `REGMAP[game].fn(sp)` inside `withSeed(seed, ...)`.
3. Each client plays locally, then `partyLocalDone()` -> `POST report {round, r:'win'|'lose', t, pts}`.
4. When everyone reported (or `tick` after timeout + 8 s grace) the server scores the round and sets `state:'between'`; any client calls `advance` after 4.2 s.
Server never runs gameplay; it trusts reported results (clamped). Friendly game, not anti-cheat.

## What to build
### 1. Server: live input relay (new)
Players must see each other's actions during a round. Do NOT put inputs in the `rooms` record (each save re-broadcasts the whole record and rewrites SQLite).
- Add action `sig` (or a dedicated realtime topic) that relays small messages `{from, seq, type, data}` to the other players of the room with low latency. Options, in order of preference:
  1. PocketBase **custom realtime broadcast** from the hook: in `party_routes.js`, `$app.subscriptionsBroker()` -> `clients()` and `client.send(new SubscriptionMessage({name: "rooms/<id>/sig", data: JSON.stringify(msg)}))` for clients subscribed to that topic. Client subscribes with `subscriptions: ['rooms/'+id, 'rooms/'+id+'/sig']` (see `partyConnect`). Verify in goja against PB v0.40.4: **I did not test this**, check `types.d.ts` after first server start.
  2. Fallback: write a tiny `signals` collection record per player (overwrite one record, ~8 writes/s) and subscribe to it. Heavier, but only uses documented APIs.
- Validate sender with the existing `P.auth(room,id,key)`; drop messages when `room.state !== 'round'`; cap size (< 512 B) and rate (~12/s per player).
- Rate limits are configured in `1760000000_claudeware_schema.js`: `/api/` = 600 req/min per IP. 8 msgs/s x 60 = 480/min per player, so players behind the same NAT may hit it. Raise or add a specific rule for `/api/party/sig` (`label` is matched as path prefix), and batch inputs (send at most every 100-150 ms, coalesce positions).
- Roles: extend the room with `roles` assigned at round start (`room.roles = {a:0,b:1}`, rotate every round so everyone plays each role). Reports: in DUO the team result is shared; accept the first `report` as the team verdict or require all to agree (simplest: any player's `lose` and any `win` reconcile via the host's report; decide and write tests).
- `party.js`: add `duo` to `ROUNDS`/mode validation (`setMode`, `cleanMode`), scoring for DUO (team score + shared lives like TEAM), `GAMES` entries for the new games with a `roles` count. Extend `party.test.js`.

### 2. Client: two players, one game state
- Choose a **host-authoritative-lite** model to avoid desync: the game's *state* is derived from seed + the stream of inputs. Easiest for the 3-4 games below: each role owns its own variables and only publishes them (positions, events); the other role renders them. Do not try lockstep.
- Game constructor gets role info: `REGMAP[id].fn(sp, ctx)` where `ctx = {role, roles, send(type,data), onMsg(fn)}`; keep the old single-arg call working (all other games ignore it). Wire it in `beginGame()` for `mode === 'party'` when `party.room.mode === 'duo'`.
- Instruction card (`PRE`) must show the player's **own role** ("YOU: THE CATCHER") - add a per-role `cmd`/`hint` (`g.cmd` and `g.hint` can be set from `ctx.role`; main.js already reads `cur.cmd`, `hintOf(cur)`).
- Latency policy: remote entities are interpolated (render ~150 ms behind), never block local input. Pick games where 100-200 ms lag is invisible.
- Disconnect: if the partner leaves, the round is lost for the team (server already marks `left`).

### 3. Games (first slice, 3-4, file `js/games/du1.js`, ids `du_*`, es file `js/i18n/es/du1.js`, scope `du`)
Ideas (all inputs must work with mouse, keyboard AND touch, like every game here):
- **CATCH & THROW**: P1 slides a basket (pointer x / arrows), P2 times coin drops from the top (tap/space to release at the shown x). Goal N coins.
- **DECODE**: P1 sees a 3-4 symbol code, P2 has the keypad and taps it (P1 can see P2's pressed sequence and says nothing else: no chat).
- **LEVER & CRANK**: P1 holds a button to keep a gate open, P2 cranks (drag in circles/mash) to fill a bar; releasing resets.
- **STEER & BOOST**: P1 steers left/right, P2 taps to boost; dodge obstacles from the seed.
Keep each game's randomness inside the constructor via `mkR()` (see `pt1.js`) so both clients build the same level.

### 4. Lobby/UI
Add DUO to the host's mode toggle in `drawLobby` (`partyMode()` currently flips versus<->team; make it cycle three modes), blurb + es strings, HUD (`drawPartyHud`) shows the partner and their role icon. 2+ players only; with 3-4 players decide pairing (simplest: allow DUO only with exactly 2 and disable START otherwise, say so in the blurb).

## Gotchas learned the hard way
- **goja handler isolation**: PocketBase JS handlers are serialised and run in a fresh scope. They CANNOT capture variables from the file (e.g. a `for` loop variable); `require` inside the handler and read inputs from the request (that is why there is one route `/api/party/{action}`). Errors thrown inside `$app.runInTransaction` lose their class (`instanceof` fails): catch inside the callback, as `handle()` does.
- Hidden field: `keys` is `hidden: true` so neither GET nor realtime leaks it. Keep any new secret there.
- Migration fields must be plain objects (`{type:'text',...}`), not `new TextField(...)`, when passed to `new Collection({fields})`.
- SSE payload format is `id:`/`event:`/`data:` (no space after the colon). `test/party.e2e.js` has a working parser.
- Background tabs: Chrome pauses `requestAnimationFrame` and throttles timers to 1/s, so a player who alt-tabs freezes their game. The server's 8 s grace closes the round; consider showing "PARTNER AWAY" in DUO.
- Reload/close = `pagehide` sends `leave` (sendBeacon), so there is no seat reclaim in lobby. Reconnect mid-game is not supported.
- i18n: English text is the key; `node test/i18n.test.js` fails on missing Spanish for game name/cmd/hint/thint and on conflicting keys in the same scope. Strings only drawn at runtime are not checked: open `?i18n-debug`.
- `main.js` globals are shared with `js/party.js` (classic scripts). `js/party.js` must stay loaded before `main.js`.
- `index.html` script tags carry `?v=` cache busters: bump them (all) when releasing.

## How to run/test
```
node pocketbase/pb_hooks/party.test.js       # pure logic
node test/i18n.test.js && node pocketbase/pb_hooks/lib.test.js && node test/auth.test.js
# live server (binary is gitignored; see docs/SELF-HOSTING.md for the download line, pinned v0.40.4):
pocketbase/dev.sh                             # serves the game + API on 127.0.0.1:8090
PB=http://127.0.0.1:8090 node test/party.e2e.js
```
Manual two-player test: open the game in two windows (or one normal + one private), create a room in A, open `/r/CODE` in B, host presses START. Do the browser work in **visible, foreground windows**; the owner asked agents not to drive their Chrome, so ask before using browser automation.

## Definition of done
- `party.test.js` covers DUO (roles rotate, shared verdict, partner leave) and `party.e2e.js` covers `sig` relay + hidden keys + rate limit.
- Two real browsers play each new game with mouse AND touch emulation; lag feels fine at ~150 ms (use DevTools network throttling).
- Spanish strings complete (`node test/i18n.test.js` ok); README/docs mention DUO; SELF-HOSTING notes the redeploy (new migration runs on start).
