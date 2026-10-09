# MiniCaos: content plan, Oct 13–26, 2026

Companion to `PLAN.md` (decisions, budget, audience). Results go in `RESULTS.md`.
Structure is in English; everything that goes on screen, gets spoken or goes in a caption is in Spanish (Venezuelan/LATAM, natural, no Spain-Spanish: *celular*, not *móvil*; *computadora*, not *ordenador*; *ustedes*, never *vosotros*).

**Every post needs Guille's explicit ok before it goes out** (PLAN.md, Approvals).

---

## 0. What the research says (brief)

| Finding | What we do with it | Source |
|---|---|---|
| Completion rate and watch time are the top ranking signals; shares, saves and comments come next. Exact thresholds are unpublished; observers guess ~30–40% completion to get pushed to a wider pool. | Short cuts (F4 < 10 s, F1 ≤ 25 s), a loop-friendly ending, and a question that earns comments. | [Hootsuite](https://blog.hootsuite.com/tikTok-algorithm/), [Eklipse (gaming creators)](https://blog.eklipse.gg/beginner-guide-2/tiktok-algorithm-gaming-creators.html), [eClincher 2026](https://www.eclincher.com/articles/how-the-tiktok-algorithm-works-in-2026) |
| Gaming clips are first shown to people who already watch similar gaming content. | Consistent niche (fast microgames, LATAM humour); don't jump to unrelated trends. | [Eklipse](https://blog.eklipse.gg/beginner-guide-2/tiktok-algorithm-gaming-creators.html) |
| Vendor data: clips under 10 s get more completions; rewatch rate is a strong signal. Indicative only. | F4 is our completion/rewatch test. | [Eklipse](https://blog.eklipse.gg/beginner-guide-2/tiktok-algorithm-gaming-creators.html) |
| Indie consensus for 2026: show the result in the first 2 s, burn-in captions (most watch muted), post 3–5×/week, and a funny premise is the best hook. The game must "work as TikTok footage first". | Hook band text on every clip; Guille's videos open on the punchline, not the intro. | [Generalist Programmer](https://generalistprogrammer.com/tutorials/how-to-market-your-indie-game-with-no-budget), [Fungies 2026 guide](https://fungies.io/indie-game-marketing/), [StraySpark devlog marketing](https://www.strayspark.studio/blog/devlog-marketing-build-wishlists) |
| LATAM gamers are mostly on mobile and discover games via online video (39%), social (38%) and influencers (35%). | Every CTA says "desde el celular, sin descargar nada". | [Konvoy LATAM report](https://www.konvoy.vc/content/latam-gaming-market) |
| Venezuela: ~14.6 M gamers (ad-tech estimate); the most common device is a Xiaomi Redmi 9. Roblox and Free Fire dominate Android actives. | Show the game running on a cheap Android; pitch "corre hasta en el celular de tu tía". | [Start.io VE](https://www.start.io/audience/gamers-in-venezuela), [Sensor Tower VE Q4 2025](https://sensortower.com/blog/2025-q4-android-top-5-pvp-games-revenue-ve-655e3bfee1714cfff123f75f) |
| Venezuelan top humour creators lean on everyday life, family and sketches (e.g. pranks with mom). Power cuts are still frequent and are part of everyday speech ("por si se va la luz"). | Our sharpest local asset is the **¡SE FUE LA LUZ!** stage (arepa, zancudo, nevera, celular al 3%). Family/pana reactions for F3. | [Favikon VE TikTokers](https://www.favikon.com/es/blog/top-venezuela-tiktokers), [Público (apagones)](https://www.publico.es/internacional/caracas-del-luz.html), [La Patilla 2024](https://lapatilla.com/2024/08/30/venezuela-a-oscuras-los-residentes-de-caracas-lidian-con-el-apagon-mientras-maduro-envia-a-la-gnb-a-la-calle/) |
| Capybaras have been a major meme since 2021; orange-on-head is a known capybara behaviour (I found no specific 2025–26 "orange" trend). LATAM has had capybara merch booms. | Chigüi is the recurring "unbothered" punchline. Treat it as evergreen, not a trend to ride. | [Know Your Meme](https://knowyourmeme.com/memes/37615), [Middlebury Campus](https://www.middleburycampus.com/article/2023/04/the-capybara-craze-why-are-they-everywhere), [El Comercio](https://www.elcomercio.com/tendencias/curiosidades/capibara-viral-redes-sociales-tiktok/) |

Caveat: almost all algorithm figures above come from marketing blogs, not the platforms. Our own `RESULTS.md` beats any of them after week 1.

---

## 1. Assets we push

**Cast.** Caos (the bomb; the fuse is the timer, so every fail is an explosion, which is our built-in punchline) · Sapito (Caza de Bugs) · Pulpi (Reino del Teclado) · Zumbi (Fiebre de Reflejos) · **Chigüi** (Locura de Mouse; sleepy eyes, orange on the head, never stressed: our recurring meme) · Profe Lechuza (Descanso Mental).

**Stages, by local hook strength** (always capture in **Spanish mode**, see §6):

| Priority | Stage (ES) | Why | Best microgames |
|---|---|---|---|
| ★★★ | **¡SE FUE LA LUZ!** | Pure Venezuelan everyday humour | `ap_arepa` (¡VOLTEA! dorada / ¡CARBÓN!), `ap_mosquito` (¡MATA ESE ZANCUDO! con la chancleta), `ap_fridge` (¡CIERRA LA NEVERA!), `ap_battery` (Celular al 3%), `ap_grita` (¡Llegó la luz!), `ap_switch`, boss `blackout` (el transformador) |
| ★★★ | LOCURA DE MOUSE (Chigüi) | Capybara host | `steady`, `drag`, `scrub`, `crank`, `wires`, `mash`, boss `fan` |
| ★★ | DÍA DE DEPORTES | Baseball: boss `batter` shouts ¡JONRÓN! / ¡RECTA! (LVBP season opens mid-October; verify the date) | `sd_hammer`, `sd_hoops`, `sd_volley`, boss `batter` |
| ★★ | Bosses (19, each with its own mechanic) | "Impossible" montage | `bug`, `type` (REFACTOR), `stomp`, `fan`, `simon`, `burger`, `samurai`, `road`, `blackout`, `batter` |
| ★★ | DIMENSIÓN 3D | Looks more "real game" than people expect from a browser | `td_stack`, `td_hoop`, `td_bowl`, `td_crane`, boss `road` |
| ★ | CAZA DE BUGS, FIEBRE DE REFLEJOS, CEREBRITOS, SUPER MEZCLA | Clear, readable 5-s rules for F1 | `swat`, `whack`, `jump`, `stop`, `flap`, `dont`, `bb_scale`, `bb_numbers` |
| ★ | PARTY: VERSUS / ELIMINACIÓN | F3 raw material | any (rounds come from all 156) |

---

## 2. Calendar, Oct 13–26

Every row goes to **TikTok + IG Reels (cross-posted to FB) + YouTube Shorts** from the same account. Brand clips are auto-produced by the pipeline (9:16, top hook band). "G#" = Guille's face scripts in §4. Codes follow §5.

**Cadence:** Guille's personal account posts 10 times in 14 days. @minicaos posts daily. Two brand posts per format in week 1 so every format has data before the ads.

**Filming blocks (~4 h/week):**
- **Mon Oct 12, 90 min:** G1, G2, F2 (all 3 hooks).
- **Wed Oct 14, 60 min:** a VERSUS/ELIMINACIÓN room with 2–3 friends or family (F3 footage for two posts).
- **Sat Oct 18, 90 min:** G3, G4, G5, and F2 re-cut pickups.
- **Wed Oct 22, 60 min:** a second room session (F3-H3) plus G6.

| Date | Guille (personal) | @minicaos (brand) | Ads / notes |
|---|---|---|---|
| **Tue 13** | **G1** "Hice 156 microjuegos yo solo" | **F1-H1-v1**: 5 of CAZA DE BUGS (`swat`, `whack`, `count`, `dodge`, fail on `slice`) | Day 1. Pin a comment with the link on every platform. |
| **Wed 14** | (no post; answer comments, Story with the link) | **F4-H1-v1**: ¡SE FUE LA LUZ! montage (8 s) | Film F3 in the evening. |
| **Thu 15** | **F2-H1-v1** "¿Cuál es el peor?" (`ap_fridge`, `mm_toast`, `cc_pig`) | **F1-H2-v1**: 5 of LOCURA DE MOUSE, Chigüi intro, fail on `wires` | |
| **Fri 16** | **G2** "Hice un nivel de cuando se va la luz" | **F4-H2-v1**: ¡SE FUE LA LUZ! montage, same body, hook 2 | **ABO starts**: 4 ad sets × $5/day, VE + 1 test country. Creatives: F1-H1, F2-H1 (Guille's cut, run from the brand page), F3-H1, F4-H1. |
| **Sat 17** | **F3-H1-v1** split-screen versus with friends | **F1-H3-v1**: 5 of FIEBRE DE REFLEJOS (`jump`, `stop`, `flap`, `reflex`, fail on `dont`) | Weekend: highest casual traffic. |
| **Sun 18** | (no post) | **F4-H3-v1**: ¡SE FUE LA LUZ! montage, hook 3 | Film block (Sat). End of week 1: fill in RESULTS 72 h columns. |
| **Mon 19** | **G3** "Mi capibara no se estresa por nada" | **F1-Hbest-v2**: re-cut of week 1's best F1 hook on a new body: DIMENSIÓN 3D (`td_stack`, `td_hoop`, `td_bowl`, `td_crane`, fail on `td_tunnel`) | |
| **Tue 20** | **F2-H2-v1** "Mi peor juego (sé sincero)" | **F3-H2-v1**: brand cut of the same room footage, gameplay-led | |
| **Wed 21** | (no post) | **F4-Hbest-v2**: new body, "8 jefes en 8 segundos" (bosses) | Film block (G6 + second room). |
| **Thu 22** | **G4** "Lo probé en un celular viejo" | **F1-Hbest-v1** (new body): DÍA DE DEPORTES, fail on boss `batter` ("¡RECTA!") | ABO day 7: read results Thu night. |
| **Fri 23** | **F3-H3-v1** ELIMINACIÓN, second session | **F4-H?-v1**: Chigüi montage "Chigüi no se inmuta" (Locura de Mouse fails, Chigüi's face unchanged) | **Winner → CBO** (~$20–30/day). Pause losers. |
| **Sat 24** | **G5** "Nadie pasa este jefe" (boss `blackout` or `fan`) | **F1 winner-v3**: SUPER MEZCLA (12 random) | |
| **Sun 25** | (no post) | Winning format, re-cut v2/v3 (shortest version) | Week 2 72 h review. |
| **Mon 26** | **G6** "Ustedes eligen el próximo microjuego" (video reply to a comment) | Repost of week 2's best brand clip with a fresh hook (H from the winning F) | Decide the week 3 split (PLAN: double down). |

Rules for the calendar:
- Personal posts go out **18:00–21:00 Venezuela time (UTC−4)**, brand posts **12:00–13:00** (lunch scroll). These are starting guesses: move them after week 1 data.
- F1 week 1 tests its 3 hooks on 3 different stages (variety helps organic reach), so the hook read is soft. F4 week 1 keeps one body for all 3 hooks: that is the clean hook test. If F1 hooks need a clean read, run them as 3 ads on one body in week 3.
- "Hbest" = the hook with the highest 3-s hold among that format's posts so far. If there's a tie, use the one with more link clicks.
- If one post breaks out (>5× the median), the next day's brand slot becomes its v2 re-cut on a different stage.

---

## 3. The 4 formats

Shared rules: 9:16, **hook band burned in** at the top (white bold text, black outline), captions burned in for every spoken line, the game's own SFX always on, music only from the platform library (§6). End card: **Caos + "Juega gratis · sin descargar · minicaos.guille.tech"**, 1.5 s, and the last frame loops into the first.

### F1: "¿Pasas estos 5 en 25 segundos?" (brand, automated)

**Hooks (0–2 s; the body is identical across all three):**

| Code | On-screen text | Spoken line (Guille VO, recorded once, reused) |
|---|---|---|
| H1 | **¿PASAS LOS 5? TIENES 25 SEGUNDOS** | "Cinco microjuegos, cinco segundos cada uno. Dale." |
| H2 | **EL #5 NO LO PASA NADIE** | "Chamo, el quinto no lo pasa nadie. Nadie." |
| H3 | **SI FALLAS UNO, LE DEBES UNA AREPA A QUIEN TE MANDÓ ESTO** | "Si fallas uno, le debes una arepa al que te pasó este video." |

**Beat-by-beat (≈24 s):**
| Time | Picture | Audio / text |
|---|---|---|
| 0.0–2.0 | Hook band over the stage's title card with its host (e.g. Sapito) | Hook VO |
| 2.0–6.0 | Game 1 · counter **1/5** top right, the command word big (¡APLÁSTALO!) | Game SFX, win jingle |
| 6.0–10.0 | Game 2 · **2/5** | — |
| 10.0–14.0 | Game 3 · **3/5** | — |
| 14.0–18.0 | Game 4 · **4/5**, the speed-up visibly kicks in | Music swells |
| 18.0–21.5 | Game 5 · **5/5**: the fail. Caos's fuse runs out → explosion, 0.3 s freeze + screen shake | Explosion SFX, music cuts |
| 21.5–23.0 | Text: **¿TÚ LO PASABAS? 👇** | VO: "¿Tú lo pasabas? Dime en los comentarios." |
| 23.0–24.5 | End card | — |

**Caption:** `El quinto me tiene loco 😤 ¿Cuántos pasaste tú? Juégalo gratis desde el celular, sin descargar nada (link en el perfil).`
**Hashtags:** `#juegosgratis #microjuegos #retoviral #venezuela #juegosdecelular`
**CTA:** comment your score (comments signal) + "link en el perfil". Pinned comment: `Juega aquí 👉 minicaos.guille.tech · si pasas el 5to, mándame captura`.

### F2: "Hice más de 100 microjuegos yo solo. ¿Cuál es el peor?" (Guille on camera)

**Hooks:**
| Code | On-screen text | Spoken line (to camera, close-up) |
|---|---|---|
| H1 | **HICE 156 JUEGOS YO SOLO. ¿CUÁL ES EL PEOR?** | "Hice 156 microjuegos yo solo y necesito que alguien me diga cuál es el peor." |
| H2 | **MI PEOR JUEGO (sé sincero)** | "Este es, sin duda, el peor juego que he hecho en mi vida…" *(cut to `ap_fridge`)* |
| H3 | **PROGRAMADOR VENEZOLANO vs. 156 MICROJUEGOS** | "Pasé meses haciendo esto en vez de dormir. Ahora ustedes me juzgan." |

**Beat-by-beat (≈22 s):**
| Time | Picture | Audio / text |
|---|---|---|
| 0–2 | Guille close-up, phone or laptop in hand | Hook |
| 2–6 | Candidate **#1** full screen (e.g. `ap_fridge`, ¡CIERRA LA NEVERA!), Guille in a corner bubble | "El uno: cerrar la nevera antes de que se dañe todo. Lo hice en una tarde." |
| 6–10 | Candidate **#2** (e.g. `mm_toast`) | "El dos: una tostada. Literalmente una tostada." |
| 10–15 | Candidate **#3** (e.g. `cc_pig`, a pig to herd), Guille fails it live | "Y el tres… no, ni yo lo paso." *(Caos explodes)* |
| 15–19 | Guille back on camera, holds up 1–2–3 fingers | "Uno, dos o tres. Comenta el número. El que pierda lo saco del juego." |
| 19–22 | End card + Guille points down | "Todos se juegan gratis, link en mi perfil." |

**Caption:** `Hice 156 microjuegos yo solo y ya no sé cuál es peor 😅 Vota 1, 2 o 3. El más votado se va (o lo arreglo, depende de ustedes). Se juega gratis desde el navegador.`
**Hashtags:** `#gamedev #devlatino #indiedev #programador #venezuela`
**CTA:** vote with a number (comments) → it feeds G6 ("ustedes eligen"). Link in bio.

### F3: Split-screen friend reactions, VERSUS / ELIMINACIÓN (Guille's account; brand gets a gameplay-led cut)

Setup: 2–4 people, phones, a party room (4-letter code). Film faces with a second phone on a tripod (wide, everyone in frame) and screen-record the host phone. Layout: **game top 55%, faces bottom 45%**.

**Hooks:**
| Code | On-screen text | Spoken line (from the footage) |
|---|---|---|
| H1 | **MI PANA DIJO QUE ERA FACILITO** | Friend: "¿Cinco segundos? Eso es facilito, vale." |
| H2 | **EL QUE PIERDA LAVA LOS PLATOS** | Guille: "El que pierda lava los platos. ¿Trato? …Trato." |
| H3 | **MODO ELIMINACIÓN: UN ERROR Y PA' FUERA** | Guille: "Un solo error y estás fuera. Sin llorar." |

**Beat-by-beat (≈25 s):**
| Time | Picture | Audio / text |
|---|---|---|
| 0–2 | Faces, the bet / the trash talk | Hook line |
| 2–4 | Phone shows the room code (blur or use a dead room) and the mode | Text: **SALA PRIVADA · CÓDIGO DE 4 LETRAS** |
| 4–9 | Round 1: everyone wins, cocky | Laughter |
| 9–15 | Rounds 2–3: speed goes up, someone fails, Caos explodes on their screen | Reaction scream, zoom punch on the face |
| 15–21 | Final round: 1v1, slow-mo on the last half second | Silence → explosion |
| 21–23 | The loser's face, frozen frame | Text: **¿A QUIÉN DE TU GRUPO RETARÍAS?** |
| 23–25 | End card | "Crea una sala y mándale el código a tu grupo." |

**Caption:** `Le dije a mis panas que eran 5 segundos por juego. Se pusieron serios 💀 Arma tu sala gratis y pásale el código al grupo (link en el perfil).`
**Hashtags:** `#juegosconamigos #retoentreamigos #juegosgratis #venezuela #partygames`
**CTA:** **tag the friend you'd challenge** (shares + tags are F3's job). Pinned comment: `Cómo jugar: entra al link → PARTY → crea sala → pasa el código`.
Consent: everyone on camera says ok before it's posted; no minors.

### F4: Ultra-fast themed montage, under 10 s (brand)

The A/B body is the **¡SE FUE LA LUZ!** montage: 6 microgames × ~1.1 s each, cut on the beat, ending on the win frame "¡LLEGÓ!" that loops back to the dark first frame.

**Hooks:**
| Code | On-screen text | Spoken line |
|---|---|---|
| H1 | **POV: SE FUE LA LUZ (OTRA VEZ)** | "Y se fue la luz… otra vez." |
| H2 | **TODO VENEZOLANO HA HECHO ESTAS 6** | (no VO, just a beat drop: tests whether text alone holds) |
| H3 | **¿CUÁNTAS HAS HECHO TÚ?** | "Cuenta cuántas has hecho tú." |

**Beat-by-beat (≈8.5 s):**
| Time | Picture |
|---|---|
| 0.0–1.5 | Black screen, the switch clicks off, hook band |
| 1.5–2.6 | `ap_switch`: ¡PRENDE! |
| 2.6–3.7 | `ap_fridge`: ¡CIERRA LA NEVERA! |
| 3.7–4.8 | `ap_mosquito`: the slipper hits the zancudo, ¡PLAF! |
| 4.8–5.9 | `ap_battery`: celular al 3% → ¡CARGANDO! |
| 5.9–7.0 | `ap_arepa`: ¡DORADITA! (or ¡CARBÓN!, whichever is funnier) |
| 7.0–8.5 | `ap_grita`: the light comes back → **¡LLEGÓ!** + text "minicaos.guille.tech" → loop |

**Caption:** `Si te pasó las 6 eres venezolano certificado 🇻🇪⚡ Es un juego, se juega gratis desde el celular (link en el perfil).`
**Hashtags:** `#sefuelaluz #venezuela #humorvenezolano #juegosgratis #microjuegos`
**CTA:** "¿cuántas te han pasado?" in the comments + link in bio. Replays matter most here.

**Other F4 bodies (reuse the hook pattern):**
- **Bosses:** "8 JEFES EN 8 SEGUNDOS" / "¿CUÁL TE GANA PRIMERO?" (`bug`, `type`, `stomp`, `fan`, `simon`, `samurai`, `road`, `batter`).
- **Chigüi:** "CHIGÜI NO SE INMUTA" / "SÉ COMO CHIGÜI": 6 fast LOCURA DE MOUSE fails, every one cutting to Chigüi's unchanged sleepy face and the orange. Music: something calm and lazy, played against the chaos.
- **3D:** "ESTO CORRE EN EL NAVEGADOR" / "SIN DESCARGAR NADA": DIMENSIÓN 3D.

---

## 4. Guille face-to-camera scripts (devlog style, < 30 s, phone at home)

General kit: phone at eye level on books or a tripod, window light in front (never behind), a shirt with no logos, the lavalier or the phone mic within 50 cm, and a second take where he says the first line faster. Screen inserts are recorded on the phone (screen recording) or with OBS on the laptop. Burn in captions.

### G1: "Hice 156 microjuegos yo solo" (≈25 s)
> **Hook text:** HICE 156 JUEGOS DE 5 SEGUNDOS. YO SOLO.
> "Hice 156 microjuegos de cinco segundos cada uno. Yo solo. *(beat)* ¿Por qué? Ni idea. Tienes cinco segundos para entender qué hacer… y hacerlo. Si no, explota Caos. *(Caos explodes on screen)* Hay jefes, hay un nivel en 3D y uno de cuando se va la luz. Es gratis, se juega en el navegador. Link en mi perfil. Dime cuál es tu favorito."

Shot list: 1) close-up, the line delivered fast · 2) screen insert: a 6-clip burst at 0.5 s each · 3) medium shot: Guille plays on the phone and loses, flinches · 4) insert: Caos explosion · 5) close-up pointing down for the CTA.

### G2: "Hice un nivel de cuando se va la luz" (≈28 s)
> **Hook text:** METÍ LOS APAGONES EN MI JUEGO
> "Le hice un nivel a mi juego que se llama *Se fue la luz*. *(lights go out in the room)* Tienes que cerrar la nevera para que no se dañe nada, matar el zancudo con la chancleta, cargar el celular que está en 3%… y voltear la arepa antes de que se queme. Y el jefe final es el transformador. *(beat)* Si eres venezolano ya sabes. Link en el perfil."

Shot list: 1) medium shot, a lamp on · 2) Guille switches it off (practical gag) · 3) the phone's light on his face, screen inserts for each game as he names it · 4) insert: the boss `blackout` · 5) the light comes back, "¡LLEGÓ!" overlay, he celebrates · 6) CTA.

### G3: "Mi capibara no se estresa por nada" (≈22 s)
> **Hook text:** DISEÑÉ UN CAPIBARA QUE NO SE INMUTA
> "Este es Chigüi. Es un chigüire con una naranja en la cabeza. Su nivel es puro caos con el mouse… y él nunca, nunca cambia la cara. *(fails montage, Chigüi's face)* Yo quiero ser Chigüi. ¿Quién de tus panas es Chigüi? Etiquétalo."

Shot list: 1) close-up holding a real orange on his head (deadpan) · 2) screen insert: Chigüi's idle animation on the stage card · 3) fast fail montage, cutting to Chigüi's face every time · 4) back to Guille, still deadpan, the orange falls · 5) CTA text: ETIQUETA A TU CHIGÜI.

### G4: "Lo probé en un celular viejo" (≈25 s)
> **Hook text:** ¿CORRE EN UN CELULAR DE 2020?
> "Me dijeron: 'eso no corre en mi celular'. Así que agarré el celular más viejo de la casa… *(shows an old Android)* …abrí el link… y ahí está. 3D y todo. Sin descargar nada, sin registrarte. Si corre aquí, corre en el tuyo. Link en el perfil."

Shot list: 1) close-up, the line · 2) hands taking out an old Android from a drawer (B-roll) · 3) over-the-shoulder: opening the browser, the game loading (real time, cut to ~3 s) · 4) playing a DIMENSIÓN 3D game on it · 5) close-up CTA. *(Only post if it really runs smoothly on that phone; record the real load time.)*

### G5: "Nadie pasa este jefe" (≈25 s)
> **Hook text:** HICE UN JEFE Y NI YO LO PASO
> "Programé este jefe… y no lo puedo pasar. *(fails)* Lo hice yo. Conozco el código. *(fails again)* …Bueno. Si tú lo pasas, mándame la captura y te pongo en el próximo video."

Shot list: 1) close-up · 2) screen record of the boss (`fan` or `blackout`), fail #1 · 3) reaction close-up · 4) fail #2, fast · 5) Guille shrugs, the share card on screen (the Wordle-style grid) · 6) CTA: "mándame tu captura".

### G6: "Ustedes eligen el próximo microjuego" (≈25 s, a video reply to a comment)
> **Hook:** the reply sticker of a real comment (e.g. "haz uno de la cola del banco") + text **USTEDES ME PIDIERON ESTO**
> "Me pidieron un microjuego de *[idea from the comments]*. Así que lo voy a hacer. *(laptop, code on screen, blurred)* Cinco segundos, una sola orden. Déjame en los comentarios cómo debería ser la orden: ¿una palabra? Lo subo la semana que viene."

Shot list: 1) the comment sticker over a close-up · 2) laptop over the shoulder (no readable code, no AI tool UI on screen) · 3) a whiteboard or paper sketch of the idea · 4) close-up CTA. The follow-up (the finished game) becomes a week 3 post.

---

## 5. Testing protocol

### Naming
`F{format}-H{hook}-v{cut}-{account}-{platform}`
- format: `F1`…`F4` · hook: `H1`…`H3` (use `H0` for G-scripts, which have one hook) · cut: `v1` first edit, `v2`+ re-cuts · account: `P` (Guille) or `B` (@minicaos) · platform: `TT` TikTok, `IG` Reels, `FB`, `YT` Shorts.
- G-scripts: `G{n}-H0-v1-P-TT`.
- Ads: prefix `AD-`: `AD-F1-H1-v1-B-META`.
- The body/stage goes in its own column of RESULTS.md (e.g. `luz`, `mouse`, `3d`, `jefes`), not in the code.
- Rendered file names use the same code: `F1-H2-v1.mp4` (stays out of git).

### Link tracking
- Bio links carry UTMs: `https://minicaos.guille.tech/?utm_source=tiktok&utm_medium=social&utm_content=bio-P` (and `bio-B`, `ig`, `yt`…). Ads use `utm_content=<ad code>`.
- **Players** = OpenPanel `game_start` from that utm_source in the 48 h after the post, minus that source's baseline. It's approximate for organic posts and exact for ads.

### What counts as a win (new accounts, first 2 weeks)
Record at **24 h and 72 h**. Never judge before 72 h (PLAN.md).

| Metric | Where | Pass | Win |
|---|---|---|---|
| Views at 24 h | native analytics | ≥ 300 | ≥ 1,500 |
| Views at 72 h | native analytics | ≥ 800 | ≥ 5,000 |
| 3-s hold (TT "retention at 0:03"; IG "skip rate" inverted) | native | ≥ 60% | ≥ 75% |
| Avg % watched: F4 (< 10 s) | native | ≥ 80% | ≥ 110% (rewatches) |
| Avg % watched: F1/F2/F3/G (20–30 s) | native | ≥ 40% | ≥ 60% |
| Profile visits / views | native | ≥ 0.5% | ≥ 1.5% |
| Link clicks (bio + pinned) | OpenPanel UTMs | ≥ 5 | ≥ 30 |
| Players (game_start) | OpenPanel | ≥ 3 | ≥ 20 |
| Shares / views | native | ≥ 0.5% | ≥ 2% |

**Verdict per post:** WIN = at least 2 "Win" cells including Players or Link clicks · PASS = most cells pass · FAIL = otherwise. The north star is **players**; views without clicks are a re-cut, not a win. These thresholds are starting points: after week 1, reset them to the median of our own posts (pass = median, win = 3× median).

### Re-cut or drop
| Symptom (at 72 h) | Diagnosis | Action |
|---|---|---|
| 3-s hold < 50% | The hook fails | **Re-cut with a different H** on the same body (v+1) |
| Good hold, avg watched below pass | The middle drags | Trim 20–30% (drop a game, tighten the cuts), same hook |
| Good watch time, profile visits < 0.5% | No reason to go further | Stronger CTA, end card earlier, pinned comment |
| Profile visits ok, link clicks ≈ 0 | The bio or the link is the problem | Fix the bio copy and the link, not the video |
| Views < 300 at 72 h on all 3 hooks | Probably the format or the account is still cold | Post v2 once more on a new body; if still under → **drop the format** |
| A format failed its v1 **and** two re-cuts | — | **Drop** (PLAN.md rule: at least 2 re-cuts before dropping) |
| WIN | — | Make v2 on a new stage within 48 h, and offer it as an ad creative |

Ads (Meta ABO) follow PLAN.md: 4 creatives × $5/day × 7 days, no decision before days 5–7, judged on **cost per game_start**. Pausing a losing ad is the only action taken without Guille's ok.

### Weekly review (Sunday, 20 min)
1. Fill the 72 h columns in `RESULTS.md`. 2. Rank the hooks by 3-s hold and the formats by players. 3. Choose next week's "Hbest" and which format doubles. 4. Write 3 lines under "Learnings" in RESULTS.md.

---

## 6. Content safety (check every post before asking Guille's ok)

- **No "Claude", "Anthropic", "ClaudeWare"** in on-screen text, spoken lines, captions, hashtags, file names that get uploaded, or the URL bar. Only `minicaos.guille.tech` appears on screen (never the old `claudeware` domain). No AI tool windows in laptop shots.
- **No Nintendo trademarks:** not WarioWare, Nintendo, Wii, GameCube, DS or Switch in captions, hashtags, hook text or VO. Always **capture in Spanish mode** so stage names read AGITA Y GANA / FIESTA CUBO / PANTALLA TÁCTIL; the English stage titles "WII WAGGLE" and "CUBE PARTY" must not appear in any frame (flag for the video pipeline). If a commenter compares us to it, reply without repeating the name ("¡jaja sí, ese estilo de juego!").
- **Music only from the platform's own library.** Brand/business accounts on TikTok may only use the **Commercial Music Library**. Meta: **Sound Collection**. YouTube: **Audio Library**. Guille's personal account can use trending sounds organically, but **any cut that becomes an ad gets re-scored with commercially licensed audio**. The game's own SFX are always fine.
- **Ad-safe language:** no profanity in hooks or captions. The Power-Out stage has a "¡COÑO!" exclamation: avoid that frame in ad cuts. No "arrecho" (it reads very differently outside Venezuela).
- **Power-cut humour stays about everyday life:** no politicians, parties, government or ministries, and no flags used politically. Joke about the fridge, not about who is to blame.
- **No fake claims:** no invented stats ("el 99% falla"), no "the last one is impossible" if it isn't beatable. "Nadie de mi casa lo pasó" is fine if it's true.
- **People on camera:** a verbal ok from everyone filmed, no minors, and no real room codes that are still open.
- **No engagement bait that platforms penalise** ("dale like si…"). Asking for a comment with a concrete question is fine.
