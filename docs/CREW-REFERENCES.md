# Cooperative games for 2–4 players

The existing DUO room mode now accepts 2–4 players and is labeled DUO / CREW. Three- and four-player rooms draw only from the crew catalog. Two-player rooms also retain all existing role puzzles. Frontend and PocketBase hooks must be deployed together; restart PocketBase after updating hooks. No schema migration is needed.

Inspiration: WarioWare: Twisted! uses short rotation and tilt challenges. Reference: https://www.mariowiki.com/WarioWare%3A_Twisted%21 . Its Wipeout! microgame moves windshield wipers to clean glass: https://www.mariowiki.com/Wipeout%21 . These adaptations use original canvas art and controls, without Nintendo assets or characters.

- Window Crew: sweep horizontally; mouse movement, touch dragging, or alternating Left/Right (A/D).
- Wheel Crew: hold and drag around the wheel; keyboard alternative is holding Space/Enter.
- Balance Crew: move your ball into its green target and hold there; mouse, touch, or Left/Right (A/D).

- Frog Feast: tap/click/Space when the moving fly is aligned with your frog. Three meals per player.
- Dragon Balloon: hold touch/mouse/Space to pump, release with the gauge in green. Overfilling resets the current pump.
- Bridge Builders: tap/click/Space when the swinging hammer crosses green; each player's planks form part of the shared bridge.
- Egg Rescue: catch moving eggs with mouse/touch/Left/Right (A/D). Three catches per player.

All seven scenes now follow the updated `docs/ART-STYLE.md` from main. `js/art/crew-art.js` provides a shared rounded ink/cel drawing kit, material highlights, expressive eyes, contextual name tags and control plates with keyboard caps. Static environments are cached in offscreen canvases; decorative animation does not consume the room RNG. There are no rotating ray backgrounds during play.

The settings are a bus wash, rescue workshop, circus balance rail, frog pond, balloon shop, river bridge and farm hen perch. A hanging wooden scoreboard shows all players' progress. Every scene has ambient movement and scene-specific success/failure reactions: a dirty windshield, a slipping rescue, a dropped ball, a limp frog tongue, a deflated dragon, a falling bridge plank or a broken egg. Controls grey out after the verdict; instruction demos use the same art and illustrate the actual action. IDs, controls, durations and shared-result mechanics remain unchanged.

The animated art gallery at `docs/crew-preview.html` renders the actual SWAT and TYPE factories alongside all seven crew games, so the style can be compared directly.

Each player owns a station and sends absolute progress to all peers. Role zero checks everyone's progress and broadcasts the verdict. Progress is monotonic to tolerate repeated/out-of-order messages. Sender identity is matched against the role assignment. The existing WebRTC mesh and HTTP relay carry these messages. Roles rotate using active seat index plus round modulo player count.

Validation: `node test/crew.test.js` simulates 150 ms one-way delay, success and missing contributors for all seven games with 2, 3 and 4 players, two speeds and two seeds, exercises keyboard and pointer alternatives, renders each game and instruction demo against canvas stubs, and checks server selection, role uniqueness, input validation, scoring and departure handling. The seven animated scenes were also checked in the in-app browser using the preview gallery, without console errors. This does not replace a live multi-device browser check.
