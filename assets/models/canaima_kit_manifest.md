# canaima_kit manifest

GLB: `assets/models/canaima_kit.glb` (build: `tools/blender/prop_canaima_kit.py`). Gran Sabana / Canaima rainforest, tepui and Pemon village kit. 1 unit = 1 map unit. Each node = one instanceable piece, origin = base centre, z=0 = ground (bases buried ~0.3-0.8 where they meet terrain). Front faces -Y. Fauna (guacamaya_*, tucan) face +X locally; `guacamaya_vuelo_*` are already lifted so the body centre is at z=2 (min z ~1.1, max ~3.9; wingspan ~6.8, tail trails to x=-3.5) so the baked AO is not sunk into the ground: place them at the desired flight height minus 2.

Orientation / placement notes:
- `cascada_alta`, `cascada_media`: origin = centre of the foam pool (disc r=7 / r=5 at z=0.1). The fall climbs along +Y: sheet top at y=+2.85 (the cliff face should be the plane y=+3), bulging toward -Y by ~2.6 / 2.0 at the bottom (bottom edge at y~0.25). Top z = 40 / 18. Lip rocks at the top sit at y=+3.5 (inside/on the cliff edge). Water sheets are single faces facing -Y (material is double sided).
- `cascada_ancha`: 30 wide (x) x ~12.5 deep (y -5.8..+7.4) x 10 high. Back (+Y) is the highest tier (z=10), then ledges at z=6 and z=2.6 stepping toward -Y, 3 white sheets at x=-9.5, 0, +9.5, foam patches at y~-5.9, z=0.3. Sits on the river: front (-Y) is the downstream side. Rock tiers include their own dark rock.
- `rapido_*`, `espuma_pozo`: flat at z~0.3 (rapids 14x8, 10x6; foam disc r=6). Place at the water surface level (shift z so the foam is just above the water).
- `muelle_selva`: runs along +Y from the origin (shore end at y=0, tip at y=16), 4 wide (x -2..2). Deck top z~1.25, posts reach down to z=-1.6 (into the water).
- `canoa_curiara` (11 long) / `canoa_b` (8 long): long axis = +X, origin = hull centre, keel at z~0 (hull height ~0.75-1.3). Bow/stern are symmetric.
- `puente_cuerdas`: spans x -12..+12 (deck 24 long x 4 wide, y -2..2), deck top z=6 at the ends (x=+-12) and 4.8 at the middle (sag), rails ~2.3 above the deck. End abutments are mud blocks (x +-12.4..+14.4, y +-2.3, z -0.3..5.7) plus end posts up to z~8.5; origin z=0 = ground under the end blocks, so it needs terrain/cliffs at z~0..6 on both ends and the middle is open air.
- `cima_roca_*`: tepui basalt-like column outcrops, 10-14 wide x ~6 deep x 17-20 tall; the tall columns are on +Y (cliff side), shorter ones toward -Y. Moss-topped.
- `liana_*`: flat vine ribbons in the XZ plane (hang flat against a cliff facing -Y), bottom at z~0..3, top attach at z=10 (strands 6.5-10 long).
- `choza_*`: door on -Y. `choza_c` ridge along X. `choza_grande` has a ridge tip pole at z~11.8.


| Part | tris | budget | footprint (x y) | height (z max) | z min |
|---|---|---|---|---|---|
| arbol_selva_a | 311 | 520 | 12.6 x 10.4 | 13.5 | -0.6 |
| arbol_selva_b | 316 | 520 | 12.5 x 9.8 | 15.3 | -0.6 |
| arbol_selva_c | 313 | 520 | 13.1 x 11.0 | 14.2 | -0.6 |
| arbol_selva_alto | 344 | 520 | 18.7 x 17.2 | 22.2 | -0.7 |
| palma_selva_a | 132 | 200 | 10.2 x 11.3 | 16.3 | -0.4 |
| palma_selva_b | 156 | 200 | 11.4 x 10.2 | 19.9 | -0.4 |
| platanillo_a | 69 | 150 | 8.6 x 9.4 | 6.2 | -0.2 |
| platanillo_b | 77 | 150 | 9.8 x 10.3 | 6.1 | -0.2 |
| helecho_a | 44 | 150 | 5.4 x 5.9 | 1.6 | 0.1 |
| helecho_b | 52 | 150 | 5.4 x 5.0 | 1.6 | 0.1 |
| arbusto_selva_a | 202 | 250 | 6.0 x 3.9 | 3.5 | 0.2 |
| arbusto_selva_b | 199 | 250 | 5.5 x 4.8 | 3.3 | 0.2 |
| arbolito_cima_a | 119 | 150 | 4.3 x 3.3 | 4.1 | -0.4 |
| arbolito_cima_b | 119 | 150 | 4.0 x 3.3 | 3.9 | -0.4 |
| arbusto_cima_a | 77 | 250 | 2.8 x 2.5 | 1.3 | -0.1 |
| arbusto_cima_b | 81 | 250 | 2.9 x 2.6 | 1.4 | -0.1 |
| roca_cima_a | 74 | 350 | 4.1 x 2.8 | 2.5 | -0.4 |
| roca_cima_b | 74 | 350 | 3.7 x 3.3 | 2.9 | -0.4 |
| roca_selva_01 | 112 | 350 | 9.8 x 6.6 | 4.6 | -0.6 |
| roca_selva_02 | 103 | 350 | 10.8 x 7.9 | 5.4 | -0.6 |
| roca_selva_03 | 112 | 350 | 8.3 x 6.1 | 6.7 | -0.6 |
| roca_selva_04 | 121 | 350 | 10.3 x 7.5 | 5.0 | -0.6 |
| roca_rio_a | 72 | 350 | 6.7 x 5.7 | 3.2 | -0.8 |
| roca_rio_b | 126 | 350 | 7.4 x 5.2 | 2.7 | -0.8 |
| roca_rio_c | 126 | 350 | 9.2 x 5.5 | 3.6 | -0.8 |
| cima_roca_a | 262 | 400 | 12.1 x 6.9 | 20.0 | -0.4 |
| cima_roca_b | 272 | 400 | 11.8 x 8.6 | 20.0 | -0.4 |
| cima_roca_c | 262 | 400 | 13.5 x 7.8 | 20.0 | -0.4 |
| cascada_alta | 400 | 450 | 15.5 x 14.6 | 41.2 | -0.2 |
| cascada_media | 329 | 400 | 11.1 x 10.4 | 19.2 | -0.2 |
| cascada_ancha | 503 | 500 | 30.9 x 14.8 | 10.1 | -0.5 |
| rapido_a | 165 | 250 | 12.5 x 6.5 | 1.4 | 0.0 |
| rapido_b | 155 | 250 | 9.5 x 6.3 | 1.7 | 0.1 |
| espuma_pozo | 201 | 250 | 12.3 x 12.5 | 1.7 | -0.1 |
| choza_a | 140 | 300 | 8.5 x 8.2 | 7.4 | -0.3 |
| choza_b | 140 | 300 | 8.3 x 7.9 | 7.3 | -0.3 |
| choza_c | 138 | 300 | 13.4 x 7.0 | 6.3 | -0.3 |
| choza_grande | 169 | 300 | 14.4 x 14.4 | 12.1 | -0.3 |
| cobertizo | 78 | 250 | 7.0 x 6.0 | 5.6 | -0.1 |
| canoa_curiara | 144 | 250 | 11.0 x 1.8 | 1.3 | 0.0 |
| canoa_b | 190 | 250 | 8.0 x 1.7 | 1.5 | 0.0 |
| fogata | 190 | 250 | 3.8 x 3.8 | 2.2 | -0.2 |
| tendedero | 152 | 200 | 5.4 x 2.3 | 3.5 | -0.3 |
| pila_lena | 184 | 200 | 3.6 x 2.8 | 2.8 | -0.1 |
| cesta_yuca | 250 | 200 | 5.0 x 3.1 | 1.9 | -0.1 |
| liana_a | 60 | 150 | 3.6 x 0.1 | 10.0 | 0.0 |
| liana_b | 75 | 150 | 5.1 x 0.1 | 10.0 | 0.0 |
| muelle_selva | 330 | 400 | 4.2 x 16.0 | 2.0 | -1.6 |
| puente_cuerdas | 480 | 500 | 28.8 x 4.8 | 8.5 | -0.3 |
| guacamaya_vuelo_a | 68 | 150 | 5.5 x 6.8 | 3.9 | 1.7 |
| guacamaya_vuelo_b | 68 | 150 | 5.5 x 6.8 | 2.6 | 1.6 |
| guacamaya_vuelo_c | 68 | 150 | 5.5 x 6.8 | 2.6 | 1.1 |
| guacamaya_posada | 91 | 150 | 2.8 x 2.6 | 3.9 | -0.3 |
| tucan | 166 | 200 | 3.2 x 2.0 | 2.9 | -0.3 |

**Total: 9261 tris** (54 parts).
