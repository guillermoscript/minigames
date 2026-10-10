# Prompts for the image AI (PARADA + CHANCLA)

How to use: attach the wireframe frame as a *layout* reference, then paste the prompt. Replace `[STYLE]` with one of the
style blocks at the bottom so the same prompt can be run three times and compared.

Why plates are blank: the game draws the words itself (the app is English + Spanish, and image AIs misspell accents
like ¡ and Ó). So every banner, plate and bubble is asked for **empty**.

---

## Prompt A · UI kit (both games)

```
Game UI kit sheet for a fast, funny mobile microgame, 4:3 landscape game screen (800x600), top-down flat layout sheet:
every element isolated on a plain light-grey background with generous spacing, each one drawn once, no scene, no
characters, no text anywhere. Elements must read clearly at 80 px wide on a phone. Style: [STYLE].

ELEMENTS (arrange in a clean grid, label nothing):
1. COMMAND BANNER: a wide rounded plate, about 300x50 units, empty, with a small bolt/fuse detail at each end. Three states
   side by side: calm, tense (slightly squashed, a few sweat drops), exploded (cracked, jagged edges).
2. FUSE TIMER: a long thin bar, about 200x24, shaped like a bomb fuse with a little spark at the burning tip. Three states:
   full, half, almost gone (spark is big and angry).
3. LIVES: three heart plates in a row, states: full, last one cracked, empty outline.
4. SPEECH BUBBLES, empty: (a) round shout bubble with a spiky edge, (b) normal rounded bubble with a tail to the left,
   (c) normal bubble with a tail to the right, (d) a flat "mom's full-name" bubble that is wide and slightly angry-looking.
5. RESULT STAMPS, empty: (a) WIN starburst, 12 points, gold and joyful, with small confetti around it,
   (b) FAIL starburst, jagged and a bit sad, with one small lightning crack. Same size, same silhouette so they can be swapped.
6. CONTROL PLATES (big, thumb-friendly, empty, with a chunky keycap look): (a) microphone plate with a simple
   microphone icon, idle and "listening" states (the listening one has sound waves), (b) wide TAP plate, (c) left arrow plate,
   (d) right arrow plate, each with a pressed state and a disabled state.
7. BUS STOP SIGN: a pole with a small rectangular sign on top (empty plate), a few weathered stickers, a little bent.
8. PULL CORD with a small red button hanging from a bus handrail.
9. FLOATING FX: musical notes (3 kinds), "Zzz" letters (3 sizes), sweat drops, a heart, a star, a motion-lines puff,
   an impact starburst, glass shards (6 shapes), confetti pieces in 6 colours.
10. A small loop icon set (32 px): microphone, hand tap, left arrow, right arrow, heart, bolt.

RULES: consistent line weight across the whole sheet, one light direction (top-left), transparent-friendly clean edges,
no gradients on UI plates (flat colour plus one shade), palette limited to 7 colours plus ink, high contrast, playful,
slightly crooked on purpose, as if drawn by someone fast and confident. Absolutely no text, no letters, no numbers,
no logos, no watermark.
```

## Prompt B · PARADA scene plate (empty)

```
Interior of a crowded Latin American "busito" (small city bus), side view, 4:3 landscape. Empty plate with NO people and NO
animals, no text. Composition, top to bottom: a ceiling band with a long metal handrail and one red pull cord with a
button hanging from it; a big wide window band across the full width showing a flat street scrolling by (low houses,
a few shop blocks, a sidewalk, one flat ground line), with enough clear space for sprites to stand on the ground line;
below the window, a lower interior band with vinyl seats on the left and right and an open standing aisle in the middle
with a floor; in the right foreground a steering wheel and a dashboard with colourful stickers, a rosary hanging from the
mirror and a small radio. The centre of the image has a vertical open door area, drawn as a plain rectangle frame, which is
the gameplay "stop zone" and must stay uncluttered. Funny, lived-in details: stickers, a hanging pine-tree air freshener,
cracked seat, handwritten route sign. Style: [STYLE].
```

## Prompt C · CHANCLA scene plate (empty)

```
First-person view of a small Latin American family living room, one-point perspective, 4:3 landscape, vanishing point
slightly above centre. Empty plate with NO people. Back wall with a framed picture, a window with a curtain and a
cabinet; a rug on a tiled floor with clearly visible perspective lines converging to the back wall; side walls with a
lamp and a plant; on the floor in the bottom-right a cat sitting and staring at the viewer. The centre of the room must
stay open and uncluttered because a character will stand there. Warm afternoon light through the window. Funny,
lived-in details but nothing fragile-looking in the centre. Style: [STYLE].
```

---

## [STYLE] blocks (one per run)

- **TINTA (clean TV cartoon):** bold black ink outlines, flat saturated colours, one cel-shade crescent per object, one soft
  white highlight, smooth vector look, slightly squashy shapes.
- **GARABATO (hand-drawn doodle):** wobbly marker and crayon lines with colour that slips outside the outline, visible
  paper texture, scribble hatching for shadows, naive proportions, looks like a school notebook.
- **RECORTE (paper cutout):** every shape is cut paper with a small white border and a soft drop shadow, visible paper
  fibre, torn edges, flat layered depth like a stop-motion set.
- **PIXEL (16-bit):** 267x200 pixel art upscaled, 32-colour limited palette, hard-edged dithering for shade, 1 px outlines,
  chunky readable silhouettes.
