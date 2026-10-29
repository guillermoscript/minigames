# caribe_kit manifest

GLB: `assets/models/caribe_kit.glb` (build: `tools/blender/prop_caribe_kit.py`). 1 unit = 1 map unit. Land pieces: origin = base centre, bases buried 0.5 (z=-0.5). Marine pieces: waterline z=0 (foam skirts at z~0.07). Front faces -Y. Boats: bow +X, keel z=0.

Special origins: `malecon_curvo` is a 90 deg arc, sea on the INNER (concave) side, arc circle centre at local (-9, 9), centreline radius 16, width 4; it runs from the south end (tangent +X) to the east end (tangent +Y); origin is the bbox centre of the arc. `muelle_*`: deck top z=1.3, pier runs along X, tile pieces end to end (`muelle_pieza` 14 long); `muelle_cabana` hut at +X end. `malecon_recto` walkway top z=1.1, sea wall on the -Y side.

| Part | tris | footprint (x y) | height |
|---|---|---|---|
| casa_car_01 | 216 | 11.1 x 9.7 | 13.6 |
| casa_car_02 | 140 | 10.0 x 9.0 | 10.6 |
| casa_car_03 | 214 | 11.5 x 9.2 | 12.4 |
| casa_car_04 | 170 | 11.1 x 9.7 | 11.0 |
| casa_car_05 | 191 | 9.0 x 9.5 | 13.2 |
| casa_car_06 | 161 | 9.5 x 9.3 | 10.0 |
| casa_car_07 | 210 | 13.1 x 9.7 | 15.4 |
| casa_car_08 | 143 | 11.0 x 9.0 | 11.4 |
| casa_car_09 | 210 | 9.5 x 9.3 | 12.4 |
| casa_car_10 | 182 | 12.1 x 9.1 | 11.9 |
| casa_car_11 | 191 | 11.0 x 9.5 | 13.2 |
| casa_car_12 | 168 | 12.5 x 9.3 | 9.7 |
| casa_playa_01 | 95 | 9.2 x 8.7 | 6.9 |
| casa_playa_02 | 151 | 8.3 x 7.4 | 8.2 |
| casa_playa_03 | 126 | 9.7 x 6.7 | 7.7 |
| casa_playa_04 | 85 | 10.1 x 7.8 | 8.3 |
| casa_playa_05 | 68 | 9.2 x 9.8 | 7.0 |
| casa_playa_06 | 85 | 8.9 x 8.3 | 7.1 |
| iglesia_car | 700 | 14.9 x 22.7 | 23.8 |
| capilla_car | 164 | 6.8 x 9.0 | 10.9 |
| faro | 349 | 12.5 x 10.9 | 24.2 |
| fuerte_estrella | 615 | 34.4 x 38.3 | 13.1 |
| malecon_recto | 209 | 18.3 x 4.2 | 5.6 |
| malecon_curvo | 162 | 18.0 x 18.0 | 5.6 |
| muelle_pieza | 156 | 14.0 x 3.3 | 2.3 |
| muelle_cabana | 237 | 11.1 x 5.0 | 6.8 |
| islote_01 | 178 | 12.5 x 12.9 | 10.5 |
| islote_02 | 257 | 19.4 x 11.7 | 11.8 |
| islote_03 | 133 | 11.4 x 11.0 | 13.8 |
| islote_04 | 374 | 22.9 x 18.4 | 13.1 |
| islote_05 | 121 | 9.7 x 8.7 | 7.6 |
| islote_06 | 189 | 18.1 x 12.3 | 9.5 |
| roca_mar_01 | 46 | 3.9 x 3.8 | 1.9 |
| roca_mar_02 | 51 | 5.7 x 5.3 | 3.0 |
| roca_mar_03 | 71 | 6.9 x 6.2 | 4.1 |
| roca_mar_04 | 78 | 7.8 x 8.0 | 4.9 |
| roca_mar_05 | 46 | 5.3 x 4.7 | 5.4 |
| roca_mar_06 | 78 | 8.3 x 8.0 | 4.2 |
| roca_mar_07 | 81 | 6.9 x 5.4 | 2.5 |
| roca_mar_08 | 78 | 8.6 x 8.5 | 6.9 |
| cayo_arena_01 | 246 | 22.3 x 15.7 | 8.4 |
| cayo_arena_02 | 275 | 27.5 x 14.5 | 8.0 |
| cayo_arena_03 | 276 | 29.2 x 14.5 | 8.7 |
| cayo_arena_04 | 183 | 17.3 x 16.3 | 7.7 |
| arbusto_costa_a | 66 | 4.3 x 2.7 | 1.2 |
| arbusto_costa_b | 54 | 4.6 x 4.4 | 2.8 |
| arbusto_costa_c | 26 | 3.1 x 3.1 | 3.5 |
| cactus_costa_a | 57 | 4.2 x 1.4 | 6.0 |
| cactus_costa_b | 71 | 3.1 x 3.0 | 2.5 |
| uva_playa | 75 | 5.7 x 4.0 | 4.7 |
| velero_b | 94 | 8.6 x 2.6 | 9.0 |
| penero_azul | 146 | 9.3 x 2.3 | 3.3 |
| penero_rojo | 143 | 9.4 x 3.2 | 4.6 |
| yate | 161 | 12.2 x 3.6 | 5.7 |

**Total: 9052 tris** (54 parts).
