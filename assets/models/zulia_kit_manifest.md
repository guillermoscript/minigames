# zulia_kit manifest

GLB: `assets/models/zulia_kit.glb` (build: `tools/blender/prop_zulia_kit.py`). Zulia / Lake Maracaibo kit. 1 unit = 1 map unit. Each node = one instanceable piece, origin = base centre, z=0 = ground (or water line for marine pieces), front faces -Y. Total tris: 9465.

Notes: boats have bow +X and keel below the z=0 waterline (draft ~0.5-0.9). `tuberia_recta` is exactly 6 long (x -3..3, flanged ends, chains end to end); `tuberia_codo` arrives from -X (end at x=-3) and leaves toward +Y (end at y=+3), pipe centre z=1.35; `tuberia_pared` is 12 long (x -6..6) with 4 pipes in two tiers. `muelle_petrolero` runs along X (x -16..16, deck top z=2, piles to z=-4, loading arm at +X end, hut at -X end). `muelle_madera_*` run along X (x -8..8, deck z=1.4, posts to z=-3). `palafito_lago_*`: house centred on the stilt deck (z=1.2), plank walkway extends toward +X; stilts down to z=-3. `iglesia_zulia`: bell tower front-left (x=-4.7), nave front toward -Y, cross on tower ~z 26. Bridge pieces follow ordaz_kit: run along X, x -12..12 (chain every 24), deck top z=10, deck 7 wide with kerbs, pillars on x=-8,0,8 down to z=-14; `puente_lago_torre` adds an H-shaped concrete pylon (legs at y=+-3.6, x=0) rising ~34 above the deck with 10 stay cables per side per plane (fans toward +X and -X).

| Part | tris | budget | footprint (x by y) | height (z max) | z min |
|---|---|---|---|---|---|
| torre_petroleo_a | 476 | 500 | 10.6 x 11.0 | 36.1 | -0.4 |
| torre_petroleo_b | 386 | 500 | 9.6 x 10.0 | 28.1 | -0.4 |
| torre_petroleo_c | 482 | 500 | 10.6 x 11.0 | 40.1 | -0.4 |
| balancin_a | 202 | 300 | 12.9 x 3.5 | 8.0 | 0.0 |
| balancin_b | 202 | 300 | 12.9 x 3.5 | 8.0 | 0.0 |
| cabezal_pozo | 196 | 200 | 5.4 x 4.2 | 4.1 | -0.2 |
| antorcha | 133 | 200 | 4.6 x 4.6 | 31.0 | -0.3 |
| tanque_crudo_a | 190 | 200 | 12.5 x 11.9 | 11.9 | -0.2 |
| tanque_crudo_b | 196 | 200 | 11.7 x 10.3 | 14.8 | -0.2 |
| tanque_esfera | 192 | 200 | 9.6 x 9.6 | 10.6 | -0.3 |
| caseta_gris_a | 136 | 200 | 9.1 x 5.6 | 4.7 | -0.2 |
| caseta_gris_b | 104 | 200 | 10.9 x 5.6 | 4.4 | -0.2 |
| caseta_gris_c | 112 | 200 | 6.8 x 5.8 | 7.8 | -0.2 |
| planta_destilacion | 422 | 450 | 20.4 x 8.4 | 19.3 | -0.3 |
| tablero_electrico | 234 | 250 | 19.2 x 7.0 | 11.2 | -0.3 |
| camion_cisterna | 236 | 250 | 10.2 x 3.8 | 4.2 | 0.1 |
| tuberia_recta | 156 | 200 | 6.0 x 1.9 | 2.0 | 0.0 |
| tuberia_codo | 200 | 200 | 3.7 x 4.0 | 2.0 | 0.0 |
| tuberia_pared | 180 | 200 | 12.0 x 4.1 | 3.5 | 0.0 |
| farola_lago | 102 | 200 | 2.8 x 1.1 | 7.3 | -0.2 |
| cartel_petroleo | 129 | 200 | 7.6 x 1.5 | 6.3 | -0.2 |
| barril_set | 162 | 200 | 3.7 x 1.9 | 3.9 | 0.0 |
| chorro_gas | 135 | 200 | 3.0 x 3.0 | 6.0 | -0.2 |
| muelle_petrolero | 487 | 600 | 32.0 x 7.5 | 7.4 | -4.0 |
| muelle_madera_a | 234 | 300 | 16.0 x 3.4 | 2.7 | -3.0 |
| muelle_madera_b | 226 | 300 | 16.0 x 4.2 | 3.9 | -3.0 |
| tanquero_chico | 266 | 350 | 16.0 x 4.5 | 9.4 | -0.6 |
| lancha_pesca_a | 106 | 350 | 9.0 x 2.7 | 4.4 | -0.4 |
| lancha_pesca_b | 139 | 350 | 9.0 x 2.7 | 3.5 | -0.4 |
| peñero | 154 | 350 | 11.4 x 2.7 | 2.3 | -0.4 |
| palafito_lago_a | 250 | 300 | 13.0 x 5.6 | 5.3 | -3.0 |
| palafito_lago_b | 266 | 300 | 13.0 x 5.6 | 5.3 | -3.0 |
| casa_zulia_a | 168 | 250 | 9.4 x 9.3 | 8.3 | -0.4 |
| casa_zulia_b | 138 | 250 | 10.1 x 9.7 | 8.9 | -0.4 |
| casa_zulia_c | 158 | 250 | 9.9 x 9.2 | 8.3 | -0.4 |
| casa_zulia_d | 122 | 250 | 10.0 x 9.6 | 8.6 | -0.4 |
| casa_zulia_e | 124 | 250 | 10.6 x 9.1 | 8.9 | -0.4 |
| casa_zulia_f | 143 | 250 | 9.4 x 9.3 | 8.1 | -0.4 |
| casa_zulia_baja_a | 134 | 250 | 9.6 x 9.7 | 5.5 | -0.4 |
| casa_zulia_baja_b | 130 | 250 | 9.6 x 9.7 | 5.5 | -0.4 |
| iglesia_zulia | 437 | 700 | 14.7 x 15.8 | 25.2 | -0.4 |
| puente_lago_recto | 254 | 350 | 24.1 x 7.0 | 12.0 | -14.0 |
| puente_lago_torre | 566 | 600 | 24.1 x 9.2 | 44.0 | -14.0 |
