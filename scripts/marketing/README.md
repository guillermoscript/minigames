# Marketing clips

`clip.js` turns real, bot-played gameplay into vertical 1080x1920 clips for TikTok, Reels and Shorts. Nobody has to play.

```sh
# "Can you beat these 5?" from the POWER OUT! stage pool (¡SE FUE LA LUZ!), last one lost on purpose
node scripts/marketing/clip.js --games ap_switch,ap_arepa,ap_mosquito,ap_battery,ap_grita --fail-last \
  --hook "¿Puedes con estos 5 en 25 segundos?" --name a_se_fue_la_luz_5 --stills

# under-10 s montage of the five stage hosts (stage intro cards, stages 1-5)
node scripts/marketing/clip.js --intros 1,2,3,4,5 --each 1.7 --hook "5 amigos. 100+ microjuegos.\nUn solo Caos." --name b_hosts_montage --stills
```

Output goes to `marketing-out/`, which is gitignored. Each run writes `<name>.mp4` (H.264 + AAC, 30 fps) and, with `--stills`, four JPEGs for review.

## How it works
- **Capture:** the script serves the repo on 127.0.0.1 and opens the real `index.html?lang=es` in Playwright's chrome-headless-shell. It finds them the same way as `scripts/art/shoot.js`. `requestAnimationFrame` is disabled, and `page-driver.js` calls `main.js`'s `loop()` with a fixed 1/fps step, so playback is smooth and deterministic on any machine. `--seed` seeds `Math.random`. Frames come from the game's own `render()`, so they include the instruction card, HUD, fuse, ¡BIEN!/¡FALLASTE! stamps and the inter screens. The canvas renders at 2x (`--hd`).
- **Inputs:** each supported microgame has a bot in `page-driver.js` (`BOTS`). A bot reads the game state from `g.probe()` (POWER OUT games) or by spying on the art call (`W1A.swat`, `W2STOP.draw`, …). It acts through the same `cur.down`/`move`/`key` entry points that `main.js` uses. Pointer games show the game's glove cursor gliding to targets.
- **Audio:** `AudioContext` is replaced by an `OfflineAudioContext` driven by the virtual clock. The game's real sfx and chiptune music are rendered and muxed in. Use `--no-music` for sfx only or `--silent` for a silent track. A few sounds that the game fires through `setTimeout` can land slightly late.
- **Compose:** the backdrop PNG is drawn in the browser with Fredoka (from Google Fonts at render time, nothing committed) and the game's own `caos()`/`CAST`. It holds the hook, the CTA pill and the cast row. ffmpeg overlays the 4:3 gameplay (960x720 at x=36, y=640) and encodes the result. Spanish accents (¿ á ñ) render correctly. Write `\n` in `--hook` to force a line break. The last line is drawn in yellow.
- **Safe zones:** the hook sits at y 175–605, below TikTok's top tabs. The CTA sits at y 1395–1590, above the bottom 15% (caption area). The gameplay is nudged 24 px left so the right action rail covers less of it. Everything below y≈1630 is decoration only.
- **Analytics are blocked:** only 127.0.0.1 and Google Fonts are reachable, so clips never send OpenPanel or Pixel events.

## Microgame ids with controllable win/lose
Each id is verified to win or lose on demand across seeds 1–3 at speeds 1.4–2.0:

| id | win | scripted lose |
|---|---|---|
| `ap_switch` | flips fast | too slow, light never returns |
| `ap_fridge` | keeps shoving | gives up, ¡SE DESCONGELÓ! |
| `ap_mosquito` | chases the eyes, smacks | whiffs around it |
| `ap_battery` | plugs in on the outlet | misses, zaps, ¡0%! |
| `ap_arepa` | flips when golden | a beat late, ¡CARBÓN! |
| `ap_grita` | shouts after the light | ¡MUY PRONTO! |
| `swat` | squashes all | misses the last bug |
| `jump` | clears both | trips on the 2nd |
| `type` | types the word | fumbles halfway |
| `count` | right number | off by one |
| `stop` | stops in the green | near miss |
| `mash` | mashes | too slow |
| `dont` | hand hovers, never presses | presses |

Any other id still plays, but with no input. The CLI warns about this, and the result is whatever the game decides. Add a bot to `BOTS` to support more ids.

## Options
`--fail-last`, `--fail id,id`, `--intro` (opens with the host stage's intro card), `--host N` (by default, the stage whose pool contains every id; otherwise stage 1), `--speed X`, `--inter 0.7`, `--pre 1.0`, `--tail 0.8` (freeze on the final stamp), `--each 1.6`, `--cta-top`, `--cta`, `--fps 30|60`, `--seed`, `--lang es|en`, `--out`, `--name`, `--stills`.

## Known limits
- Stages named WII WAGGLE, CUBE PARTY, MEGA MICROGAME$, TWISTED!, MOVE IT! and GET TOGETHER are refused as `--host` or `--intros`. Their names must stay off screen. Microgames from those pools are not blocked by id, so keep them out of `--games` too.
- Bosses and 3D (`td_*`) games are not supported yet.
- After the 3rd fail in one clip, the driver gives back one life so the run doesn't hit GAME OVER.
- The game's own HUD is kept as is: the hint line overlaps the lives row, and the MENÚ button is visible.
- ~25 s of render time for a 22 s clip on an M-series Mac. It needs network access for the Fredoka font (the bands fall back to a system font, with a warning, if offline).
