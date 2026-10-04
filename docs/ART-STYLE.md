# Art style rules (the DUO look)

Goal: every microgame looks like a frame from the same cartoon. The reference is the DUO co-op set in
`js/games/duo/` (hippo, shield, panic, legs, rails, crane, granny, hose, keys, barber). Those games are a *place*
with a *character* doing a *dumb specific thing*, drawn in thick ink, flat cel shading and soft daylight colours.
The older solo games (`bg()` spinning rays + floating sprites) are the "before" picture. Don't copy them for new work.

All numbers below come from the code. Canvas is 800×600. `INK = '#14101c'` and `OR = '#D97757'` are in `js/core.js`.

## 1. The ten rules

1. **Build a place, not a backdrop.** Every game has a setting: a zoo pond, a living room at night, a barber shop, a river crossing, an arcade cabinet.
   Use spinning rays (`bg()`) only on menus and intro cards. Never use them as the play field.
2. **Everything in the foreground is inked.** Draw the outline first as an `INK` stroke at **2× the outline width**, then fill on top, with round joins and caps (`ink()` / `inkP()`).
   The outline shows outside the fill. Use outline `o` = 5 for hero characters, 4 for props, UI plates and badges, 3–3.5 for small props, pills and clouds, and 2–2.5 for tiny details and key caps.
3. **Distance gets coloured outlines.** Far layers drop `INK` and use a darker tint of their own colour: mountains `#7b80c6`/`#5b5fa8`, hills `#2f7a49` or `#4f9a6a`, clouds `#3c6fb4` (legs), or no outline at all (hippo's far hills `#a9dfc6`).
   Then draw one hard `INK` horizon line (4 px) where the ground starts.
4. **Flat colour + one shade + one light.** Every material is a triple *base / shade / light*, shaded with `cel()`: fill the shade, then clip and fill the base again shifted by (-sx, -sy).
   The shade is left as a crescent on one side. Add one soft light ellipse (`glint()` or a `rgba(255,255,255,.28–.6)` oval, top-left, rotated about -0.3…-0.6).
   Don't use gradients on characters or props. Use gradients only for sky, ground, water and wallpaper.
5. **Rounded everything.** Use `rr()` rounded rects, never `fillRect` boxes, for anything that is an object or UI. See the radii in section 4.
6. **Faces carry the joke.** The main characters have big eyes with pupils, a white highlight dot and moods (idle, eager, happy, sad, bonk, dizzy, sick, sleepy, panic).
   They blink and look at the action. Cheeks blush. Claude gets arms, goggles, a crate to stand on and a name tag.
7. **Nothing stands still.** Clouds drift, the sun's rays turn, water waves, signs sway, characters breathe and blink. A background gag always moves (birds, a cat, a duck, a telenovela on the TV).
8. **The UI lives in the world.** A score is a wooden sign on strings, a bulb marquee or a row of plates. Controls are chunky plates with a key cap under the label. Tags point at who is who.
9. **Win and lose are drawn, not stamped.** The scene itself plays the ending: the hippo gets hearts, the vomit flows into the pond, the hippo sinks asleep with Zs, the marquee goes rainbow `WINNER!`, `MADE IT!` comes up with light rays.
   The generic `NICE!`/`FAIL!` stamp from `main.js` comes on top of that and never replaces it.
10. **Paint once, blit every frame.** Bake the static scene into an offscreen 800×600 canvas the first time it is drawn. Each frame draws only what moves.

## 2. Palette (exact values in use)

| What | Values |
|---|---|
| Ink / outline | `#14101c` (`INK`). Shadows `rgba(20,16,28,.25–.35)`, vignette at the end of `draw` with `vignette(.14–.22)` |
| Claude | `#D97757` (`OR`), shade `#b4553a`, light `#f3a283` (legs.js) |
| Day sky (gradient 0→~340/480) | hippo `#36b0ea → #86d8fb (.55) → #d6f7ff`; legs `#3fb0ff → #8fdcff → #e6fbff` |
| Sun | disc `#ffe14d` (ink 4, r 32) + highlight `#fff3a0`, rays `rgba(255,240,150,.45)` turning 0.25 rad/s (hippo `sky()`); legs: `#ffd84a`/`#ffe98a`/`#fffbe0` + halo rings `rgba(255,248,200,.1/.14/.2)` |
| Clouds | 4-circle puff: outline pass `ink(null,3)`, body `#e4f5ff`, top-left white copy (r×0.8, offset −3,−5) `#fff` |
| Hills | far `#a9dfc6` (no ink); near `#87d19b` + `#4f9a6a` 3 px. legs: `#9be38a`/`#78cc72`, `#7cd46f`/`#5cbc5e`, outline `#2f7a49` 8 px |
| Mountains | `#c9d0fb`/`#aab3f2` (ol `#7b80c6`), `#a4b1f2`/`#8492e2` (ol `#5b5fa8`), snow `#f6f8ff` |
| Grass ground | gradient `#8fdc5c → #5fb944`, INK horizon 4 px, diagonal light stripes `rgba(255,255,255,.12)`; legs `#6fd660`/`#3fa64a`/`#b2f27f` |
| Trees | trunk `#8a5a34`; leaf blobs `#2f9a55`/`#3fb260`, inner light `#43b366`/`#5bcf72`, glints `rgba(255,255,255,.28)` |
| Water | `#62d3f0 → #2a8fcb` (front band `#4cc4e8`), foam line `rgba(255,255,255,.9)` 5 px, sandy rim `#f4d998`; legs `#5fd2f7`/`#2f9fe3`/`#1f6fc0`, foam `#d9f7ff` |
| Wood | sign face `#d9944f`, sign depth `#a5622c`, grain `#c98443`, strings `#e6c58c`; crate `#d9944f` + slats `#b06d33` + top `#f2b878`; fence `#e3a868`/`#c4874e`; floor `#b97a46 → #8a5530` |
| Paper / kraft | `#e3ac66` / `#b98042` / `#f7d297` |
| Interior wall | `#d9a86a → #ffe0a8` + stripes `rgba(200,120,70,.16)` + flower dots `rgba(255,120,150,.45)` (granny) |
| Night window | `#1d1840 → #3d3480`, moon `#fff3b0` |
| Steel / plastic | `#c9ced6`, `#cfd8e6`/`#8f9cb3`, belt `#3b3550` + treads `#5a5274` |
| Feedback | gold `#FFE14D`/`#ffd23f`, go `#5CFF7A`/`#4fd06a`, danger `#ff4d5e`/`#e8434f`, pink `#ff5c8a` (hearts), sweat/tears `#9fe3ff`, sick `#7fd34a` |
| Control plates (face / base) | green `#4fd06a`/`#24803a`, red `#ff4d5e`/`#b8283a`, yellow `#ffd23f`/`#c99512`, live green `#5CFF7A`/`#23a046`; disabled `#d3cfe0`/`#8f88a6` with label `#f6f4fb` at alpha .8 |
| YOU / FRIEND tags | YOU = the player's colour `me().color`, default `#FFE14D` (granny `#FFC93C`); YOUR FRIEND = `D.partner.color`, default `#6EA8FE`. In solo games use the stage colour or `#FFE14D` |
| Blush | `rgba(255,110,165,.55)` (happy `.8`) on the hippo; `rgba(255,120,140,.5)` on granny |

Night and space scenes (shield, panic) follow the same rules on a dark base (`#0b0726 → #1c0e46 → #151a4c`) and add glows with `'lighter'` compositing.

## 3. How a background is layered (back to front)

The order comes from hippo `buildBg()` + `sky()` + `waterFront()`, and legs `buildSky()` / `buildWorld()`.

1. **Sky gradient**, vertical, darker at the top, almost white at the horizon.
2. **Sun** in a top corner (rays turn slowly, or soft halo rings) and **clouds** drifting at 2–3 speeds (`x = (t*5..9 + off) % 1000 - 140`).
3. **Far range** (mountains, pale lilac with snow caps), coloured outline.
4. **Hills** in 1–2 rows with lollipop trees, coloured outline.
5. **Mid props**: fence, kiosk with a striped awning, trees. Use INK outlines from here forward.
6. **Ground band** with a hard 4 px INK horizon line, then a gradient and light stripes or planks.
7. **Detail props**: pebbles, tufts of grass (3 strokes, `#3f8f35`), flowers, a rug, a pond with a sandy rim.
8. **Live layer** (every frame): sun rays, clouds, birds, the scoreboard, the characters, a water band *in front of* whatever stands in the water, and particles.
9. `vignette(.14–.22)` last.

Leave the HUD zones clear. In party mode that is y < 58, the top-left box (x < 310, y < 150), the top-right corner and y > 552.
In solo stage mode, `main.js` draws the hint at (400, 36), the lives box at (10–186, 36–76) and the counter in the top-right (W−140…W−8, 10–76).

## 4. Shapes, outlines, radii

- Outline widths (`o` in `ink(fill, o)` means a stroke of `2*o`):
  - hero body 5
  - hippo head silhouette 10 px stroke
  - props and plates 4
  - pills, clouds and small food 3
  - key caps 2.5
  - glints none
- Line art uses `line()` / `tube()`: an INK stroke `w + 6..8` under a colour stroke `w`, round caps.
- Radii:
  - control plate 20
  - scoreboard 16
  - badge `h*.46`
  - pill `h/2` (fully round)
  - progress bar 12
  - small panels and windows 6–12
  - key cap 6
  - crates and boxes 4
- Plates and signs have **depth**: draw a darker copy 5–9 px lower first (`plate()`: base at `y+9`, face at `y+9-d` where `d = 9` up and `3` pressed).
- Badges and big signs cast a soft drop shadow `rgba(20,16,28,.3)` offset (4, 7).
- Use `Path2D` for complex silhouettes and memoize it (`P(d)`).

## 5. Characters and faces

- **Claude** is `claude(x, y, u, {col, mood, run})` from core.js (y = feet). A hero in a scene is drawn at `u = 5.4`, small helpers at 2.3–3.4.
  Dress it up with the local helpers:
  - `arms(u, la, ra, k, col)`: blocky arms with square hands and a white gloss, drawn *before* `claude()`
  - goggles (hippo `goggles()`)
  - a crate to stand on
  - a `shadow()` under it
- **Eyes** (crane `eye(x, y, r, mood, look, T, k)` is the reference):
  - sclera: white ellipse `r × 1.08r`, ink `r*.28`
  - pupil: INK, radius `r*.52`, moved toward the action by `look*r*.38`
  - highlight dot: white, `(-.35pr, -.4pr)`, size `.35pr`
  - blink: a line when `sin(T*1.9 + k) > .985`
  - moods: happy = an upturned arc; panic = 1.35× sclera with a small pupil; dizzy = a spiral; bonk = a flat line or `> <`
  - eyelids for a sleepy or sick look are filled with the skin colour and clipped to the sclera
  - brows are INK strokes of 4–4.5 px
- **Faces** have a lighter muzzle or snout patch, nostrils with a tiny highlight, freckles in the shade colour, a blush ellipse and a mouth stroke of 4 px.
  The character reacts at least 3 ways (calm / worried / done), which is the same rule as WARIO-HUMOR-RULES §3.
- **Extras**:
  - `sweat()`: a drop that slides and fades in `#9fe3ff`
  - stars orbiting a bonked head (`star(...,'#FFE14D',3)`)
  - hearts on a win (`heart()`)
  - `zee()` for sleep
  - stink lines in `#7fd34a`
  - `crown()`, `puff()` smoke

## 6. UI conventions

- **Control plate** (hippo `plate(b, col, dk, down, lit)`):
  - a 176–368 × 96 rounded slab at the bottom of the screen, with its icon on the left and its label on the right
  - the label is `txt(label, …, 28–32, '#fff')`
  - **on desktop a `keyCap()` sits under the label**: a white r6 box, Fredoka 700 15 px, INK text, e.g. `SPACE`, `W`
  - on touch (`TOUCH`) there is no key cap and the label is centred
  - pressing drops the face 6 px for 0.12 s; `lit` adds a pulsing white inner ring
  - once the result is in, the plate goes grey (`#d3cfe0`/`#8f88a6`, alpha .8) and the label turns into the gag word (`FULL TUMMY!`, `BLEEEEH!`)
- **Round hold button** (legs `buttons()`):
  - a circle BR 40 on a darker base, with a gloss ellipse and an icon inside
  - the label sits on a ribbon pill below it
  - "YOUR TURN!" bobs above it in `#FFE14D`, and pulse rings show when it is your move
- **Name tag** `pill(x, y, label, col, up)`: Fredoka 700 14–17 px INK text, height 22–28, fully round, ink 3, a gloss strip `rgba(255,255,255,.35)` and a little pointer triangle. Every actor on screen gets one.
- **Feedback word** `badge(s, x, y, size, bg, fg, sc, rot)`: Arial Black 900 on a coloured rounded slab with a gloss and a drop shadow.
  It pops in with `outBack` over 0.25 s at a random tilt of ±0.07 rad, holds, and fades after 0.8 s. Only one is on screen at a time (`pops.length = 0`).
- **Progress**:
  - a themed object at the top centre: wooden sign with plates (hippo `scoreboard()`), bulb marquee (crane `marquee()`), river map bar with stone dots, a mini Claude and an end star (legs `progress()`), or typewriter paper
  - slots fill with an `outBack` pop
  - don't use the old flat `duBar()`
- **Text**: core `txt()` has two faces.
  - A light fill gets Arial Black 900 with an INK stroke of `size/5`. Use it for shouted words.
  - An `INK` fill gets Fredoka 700 with letter-spacing and no stroke. Use it for labels on pills and keys.
  - The big command word (130 px `#FFE14D`) belongs to `main.js`.
  - The in-game headline is ~62 px `#FFE14D`, with light rays behind it and stars at both ends (legs `headline()`).

## 7. Motion feel

- Easing helpers (local in each file): `ease` (smoothstep), `outBack` (overshoot 1.70158), `lerp`, `mix(hexA, hexB, k)`.
- **Squash and stretch**:
  - anticipation `scale(sqx, 2 - sqx)` with `sqx = 1.2 → 1` over 0.22 s
  - breathing `±.025` at 3.1 rad/s
  - a chew squash of 5 %
- **Bob, hop and jump**:
  - idle bob `sin(T*1.6)*3`
  - hop `sin(k*π)*10`
  - win jump `|sin(T*9)|*18`
  - bags hop 8 px when they arrive
- **Shake and wobble**: core `shake(5–8, .15–.25)` on hits; a local wobble `sin(t*30)*.025` that decays over 0.6 s; signs sway `sin(T*1.3)*.012`.
- **Anticipation timers** are drawn as rings that turn red near the end (hippo auto-toss ring: INK 9 px under a 4.5 px white/`#ff6b6b` arc).
- **Particles**: core `burst`, `ring`, `confetti`, plus local bits and debris with gravity 1100. Cosmetic randomness uses its own generator (`cr()`), so it never moves the seeded level.

## 8. Win / lose payoff look

- The scene changes:
  - the hero's mood flips
  - arms go up (win) or recoil (lose)
  - controls turn grey with the gag word
  - the score object reacts (crane marquee rainbow `hsl(i*30+T*600)` / dead red bulbs; plates pop)
- Win: hearts or stars rise, a jump loop, a happy squint. `duWin()` adds `sfx.coin + sparkle`, `confetti(30)` and a white ring of 110.
- Lose is a funny physical gag (vomit arc into the pond, sinking with Zs, faceplant into the water) plus `duLose()`: `miss + thud`, `shake(8,.25)`, a red burst and a red ring.
- The payoff fits inside the ~0.95 s outcome window and reads under the `NICE!`/`FAIL!` stamp, which `main.js` draws centred and rotated −0.1. Keep the gag clear of the screen centre or make it bigger than the stamp.

## 9. Performance

- **Bake static art once**:
  - `let BG = null; … if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0)` (hippo, granny, rails, crane, hose, keys, barber)
  - shield `bakeBg()`
  - legs builds separate layers (`SKY` 800×600, `MTN` 1300 wide, `HILL` 1700 wide) for parallax with `mkC(w, h)` + `onto(canvas, fn)`
  - panic `mkLayer(fn)` and a sprite cache `sprite(k, scale)` / `part(name)` + `blit()`
- **The `X` swap**: the drawing kit draws on `let X = ctx`. A builder sets `X` to the offscreen context, paints, and restores it, so the same `rr/ink/cel` code paints both the baked layer and the live frame.
- Cache what is expensive to rebuild:
  - gradients (`WG`)
  - `Path2D` objects (`P(d)`)
  - glow sprites per colour (shield `glowSprite(col)` + `glow()` with `'lighter'`)
  - `mix()` results (legs `MIXC`)
- A baked background has a fixed 800×600 size. Such games are **not** `wide`; `main.js` frames them on wide screens. A wide game has to bake at `VW` and offset by `OX`.

## 10. Where the helpers live

**Shared (`js/core.js`, global):**
- colours: `INK`, `OR`
- shapes and text: `box`, `circ`, `txt`, `star`
- `claude`
- effects: `shadow`, `vignette`, `shake`/`applyShake`, `burst`, `ring`, `floatText`, `confetti`
- other: `box3`, `drawBug`, `token`, `withSeed`, `mulberry32`, `TOUCH`

**Shared (`js/games/du1.js`, `window.DUO`):**
- `duWin`, `duLose`, `clamp`, `mkR`, `track`, `wire`, `demoFinger`
- `duBg`/`duBar` are the OLD purple look, so avoid them

**Local, copied into each DUO file** (an IIFE, so other files can't call them; they all draw on the file's own `X`):

| Helper | Defined in |
|---|---|
| `rr`, `el`, `ink`, `inkP` | every DUO file (`ink`/`inkP` take an optional outline colour in legs) |
| `cel` | barber, beat, crane, gate, granny, hippo, legs, seesaw |
| `celE`, `tube`, `eye`, `crown` | crane |
| `glint` | hippo, beat, gate, seesaw |
| `pill` | 12 files; signature `(x, y, label, col, up)`, except legs `(x, y, label, col, size, px, up)` and granny, which adds `up = 'left'` |
| `badge`, `keyCap` | 11 / 10 files (identical apart from the max width) |
| `plate` | hippo, beat, gate, guide |
| `arms` | hippo, granny, barber, guide |
| `heart` | hippo, beat, gate, keys, rails, seesaw |
| `sweat` | crane, granny |
| `zee` | hippo, keys, seesaw |
| `puff` | granny, gate |
| `ease`, `outBack`, `lerp`, `mix`, `rgb` | most files |
| `P()` Path2D memo | hippo, crane, granny, legs |
| `mkC`, `onto` | legs |
| `glowSprite`, `glow` | shield |
| `sky`, `cloud`, `tree`, `tuft` | hippo (closures inside `sky()` / `buildBg()`) |
| `buildSky`, `buildWorld` | legs |

To reuse them in a solo game today, copy the drawing-kit block (hippo.js lines ~41–60 plus `badge`/`keyCap`/`plate`), as every DUO file does.
The better fix is to **promote** them into one shared file (e.g. `js/art/kit.js` exposing `ART.{rr, el, ink, inkP, cel, glint, line, pill, badge, keyCap, plate, eye, arms, sweat, heart, zee, crown, ease, outBack, lerp, mix, P, mkC, onto, cloud, sun, tree}` with a settable target context).
After that, new games and restyled old ones use the kit instead of a ninth copy.

## 11. Checklist before shipping a microgame's art

- [ ] There is a place (sky / room / machine). There are no `bg()` rays in the play field.
- [ ] Sky or wall gradient → far layer with coloured outlines → INK horizon line → ground → props → live layer → vignette.
- [ ] Foreground shapes are inked with `ink()` (o 3–5) and rounded with `rr()`. There are no bare `fillRect` objects.
- [ ] Each material has base / shade / light; shading is `cel()` plus one glint, with no gradients on objects.
- [ ] The hero has eyes with a pupil and highlight, blinks, looks at the action and has ≥ 3 moods. Blush where it fits.
- [ ] Claude is ≥ `u = 5` if it is the hero, with arms, a shadow and a name tag.
- [ ] At least one idle animation besides the task (clouds, sway, breathing) and one background gag.
- [ ] Progress is a themed object at the top centre. Feedback words are `badge()` pops.
- [ ] Controls are plates with an icon and a label, with a `keyCap()` under the label on desktop. They press down and go grey after the verdict.
- [ ] Win and lose both change the scene (mood, pose, props), not only the stamp. They fit in ~1 s and read around the centre stamp.
- [ ] The static art is baked once into an offscreen canvas. Paths, gradients and glows are cached.
- [ ] The HUD zones are clear (top hint at y ≈ 36, top-left lives, top-right counter).
- [ ] The palette comes from the table above. Gold `#FFE14D`, go `#5CFF7A` and danger `#ff4d5e` mean the same thing everywhere.

## 12. Restyling an existing game (lessons from stage 1, BUG HUNT)

Use these rules when you re-art an old solo game; the process is the skill `.claude/skills/restyle-stage`.
Every point here was a real review finding.

**Art only, gameplay frozen.**
- Don't change ids, `reg()` calls, `cmd`/hint words, mechanics, timings, `dur`, hitboxes, input handling, `result` logic or public fields.
- Keep **RNG calls identical in count and order**. Party mode builds each game from a shared seed, so one extra `R()` desyncs the players.
  Decorative randomness uses its own source (a hash of the index, or a separate `mulberry32` seeded from a constant), never the game's RNG.
- Some constructors are reused elsewhere (`gDodge(sp, extra)` is also the stage-5 boss). Keep their signatures and check those callers too.
- Never drop functional UI while redrawing. A boss **must** still show its health (bosses.js `bug` lost its bar once).

**Screen zones `main.js` paints on top of you.** Always render with `--fuse --hint` to see them.
- **Bottom band, y > 552:** a 45 % black fuse strip runs the full width, with the bomb at (W+OX−40, 577) and the red countdown digit at about y 540 in the last 2 s.
  Keep characters, their feet and **win/lose gags** above y ≈ 535.
- **Top hint, y ≈ 36:** no ropes, signs or sprites crossing it. Hanging signs start below y ≈ 58.
- **Top-right counter (W−140…W−8, 10–76)** and the floating `+NNN` score at (W−80, 108): keep win gags (jumping mice, hearts, hats) out of it.
- **Centre stamp:** `NICE!`/`FAIL!` covers the centre for ~0.95 s. Stage the win/lose payoff off-centre, or make it big enough to read around the stamp.

**The play field must sit on the ground.**
- If targets can go up to y = 100, the horizon goes above that (≈ 62–70). A splat must never land on the sky or the sun.
- Sky items (sun, clouds) go behind the hills, never in front of a tree or on the horizon line.
- Use perspective scale for depth if the field is a floor seen at an angle, so back-row objects look farther away.

**Never hide the gameplay with decoration.**
- A cursor-following tool (swatter, mallet) must not cover the target the player is aiming at. Offset it or angle it away.
- It also starts at the global `mouse` (W/2, H/2), so hide it until the pointer moves.
- In find-the-odd-one games, no prop may overlap any candidate at any column count (check high `sp`).
- A hat or accessory must not cover a character's eyes. The face carries the joke.
- Don't stack 3+ labels in one spot (game badge + stamp + sign).

**Payoffs that read.**
- A lose gag needs its victim visible: draw the thing being ruined (cake, sandwich) *after* the culprit, or move the culprit beside it.
- Spread a crowd of gloating bugs out so the faces read (not 5 bugs in one clump).
- No full-screen white flash on a win. Use a short local flash or rays (photosensitivity, and it hides the payoff).
- When `update()` stops after the verdict (the old behaviour, keep it), animate the outro from `now` or freeze everything together, so half-frozen objects don't sit next to moving debris.
- The background gag must be on screen during a normal round (most wins happen in 1–4 s), not only late in the timer.
- Repeated characters (a class photo, windows of tenants) get distinct hats or faces. Copy-paste silhouettes kill the joke.
- Faces should react **during** play (hover, danger, last seconds), not only at the verdict.

**Verify.** Render each game at start, mid, a real win and a real loss (scripted `--inputs`), at sp 1 and sp 2, with `--fuse --hint --stamp`.
Put them next to the DUO reference sheets and the `--rev=HEAD` before frames. Then run `node test/party-catalog.test.js`, `node scripts/party-catalog.js --check`, `node test/i18n.test.js` and `node --check` on each file.

## References (best example of each rule)

- Restyled solo games (stage 1): `js/games/wave1.js` (swat picnic, spot class photo), `wave2.js` (count apartment block, slice kitchen), `wave3.js` (whack cheese, dodge bed), `bosses.js` `bug` (picnic boss with a wooden health sign).

- Layered daylight scene and baking: `js/games/duo/hippo.js` `buildBg()`, `sky()`, `waterFront()`. Parallax layers: `js/games/duo/legs.js` `buildSky()`, `buildWorld()`, `mkC()`/`onto()`.
- Interior scene: `js/games/duo/granny.js` `buildBg()` (wallpaper, planks, rug, night window).
- Ink + cel kit: `hippo.js` lines ~41–60 (`rr`, `el`, `ink`, `inkP`, `cel`, `glint`, `pill`). `crane.js` adds `celE`, `tube`.
- Cel-shaded character with moods: `hippo.js` `hippo()`. Faces and eyes: `crane.js` `eye()`, `sweat()`, `crown()`; `granny.js` `grannyHead()` (glasses, blush, ear twitch).
- Claude as a hero: `hippo.js` `draw()` feeder block (squash, `arms()`, `goggles()`, `shadow()`, `pill()`).
- Control plates + key caps: `hippo.js` `plate()`, `keyCap()`, `tossIcon()`, `mouthIcon()`. Round hold buttons: `legs.js` `buttons()`.
- Themed progress: `hippo.js` `scoreboard()`, `crane.js` `marquee()`, `legs.js` `progress()`.
- Feedback words: `hippo.js` `badge()` + `pop()`. Win headline: `legs.js` `headline()`.
- Win/lose gags: `hippo.js` `vomitStream()`/`vomitSlick()`, the sleepy sinking, hearts on a win. `du1.js` `duWin`/`duLose`.
- Dark/space variant + glow cache: `js/games/duo/shield.js` `bakeBg()`, `glowSprite()`/`glow()`. Sprite caching: `js/games/duo/panic.js` `sprite()`, `part()`, `blit()`, `mkLayer()`.
- Core primitives: `js/core.js` `claude()`, `txt()`, `shadow()`, `vignette()`, `burst()`, `ring()`, `shake()`.
