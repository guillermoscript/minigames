# falcon_kit manifest

GLB: `assets/models/falcon_kit.glb` (build: `tools/blender/prop_falcon_kit.py`). Falcon / Coro desert and Caribbean rocky coast kit. 1 unit = 1 map unit. Each node = one instanceable piece, origin = base centre, z=0 = ground (bases buried ~0.3-0.5 where they meet terrain). Front faces -Y. Fauna (burro, cabra_*, lagarto, pelicano_a) face +X locally; `flamenco_grupo` is a shallows disc with 4 flamingos already arranged (disc r=7.8 at z=0.05). Marine pieces (`islote_*`, `roca_mar_*`): z=0 = water line, white foam ring disc at z=0.07 around each stack, rock bottoms go down to -3 (islets) / -1.5 (sea rocks). `muro_piedra` is exactly 6 long (x -3..3, 1 thick, 1.9 high) and chains end to end every 6. `molino_aeolico`: rotor faces -Y. `duna_cresta_*`: 24 long (x) x 10 wide (y) x 3 tall, soft tapered ends buried -0.22 so it sits on the terrain; steep slip face on +Y (a) / -Y (b). `iglesia_coro`: plaza apron in front (-Y), bell tower front-left (x=-8.6), cross on the tower reaches z~30; church footprint 22 wide.

| Part | tris | budget | footprint (x y) | height (z max) | z min |
|---|---|---|---|---|---|
| iglesia_coro | 771 | 900 | 23.4 x 27.2 | 30.0 | -0.4 |
| casa_falcon_a | 108 | 300 | 10.8 x 8.4 | 6.5 | 0.0 |
| casa_falcon_b | 218 | 300 | 10.8 x 8.7 | 6.5 | 0.0 |
| casa_falcon_c | 168 | 300 | 11.8 x 10.4 | 6.4 | 0.0 |
| casa_falcon_d | 232 | 300 | 10.7 x 7.8 | 4.2 | 0.0 |
| muro_piedra | 128 | 200 | 6.0 x 1.2 | 2.2 | -0.3 |
| aljibe | 194 | 200 | 7.0 x 8.2 | 7.2 | -0.3 |
| kiosco_playa | 177 | 200 | 12.0 x 10.3 | 7.0 | -0.1 |
| molino_aeolico | 174 | 200 | 8.9 x 3.9 | 21.9 | -0.3 |
| cruz_camino | 102 | 200 | 3.4 x 3.4 | 7.3 | -0.3 |
| tronco_seco | 114 | 200 | 4.5 x 2.6 | 6.5 | -0.4 |
| calavera_vaca | 119 | 200 | 3.5 x 3.7 | 3.1 | -0.3 |
| cardon_a | 199 | 250 | 6.8 x 4.5 | 17.9 | -0.4 |
| cardon_b | 156 | 250 | 5.8 x 2.8 | 14.3 | -0.4 |
| cardon_c | 242 | 250 | 7.2 x 5.7 | 19.9 | -0.4 |
| cardon_pequeno_a | 151 | 250 | 3.5 x 2.4 | 8.6 | -0.3 |
| cardon_pequeno_b | 113 | 250 | 2.9 x 1.4 | 8.9 | -0.4 |
| tuna_a | 220 | 250 | 4.1 x 2.7 | 6.8 | -0.2 |
| tuna_b | 220 | 250 | 4.0 x 2.9 | 7.4 | -0.2 |
| agave_a | 70 | 250 | 5.1 x 5.6 | 3.2 | 0.2 |
| agave_b | 141 | 250 | 5.2 x 5.3 | 8.2 | 0.2 |
| arbusto_seco_a | 118 | 250 | 5.3 x 4.5 | 1.8 | -0.6 |
| arbusto_seco_b | 138 | 250 | 5.1 x 4.8 | 1.6 | -0.4 |
| arbusto_seco_c | 138 | 250 | 4.3 x 3.8 | 1.3 | -0.4 |
| cuji_a | 140 | 250 | 5.5 x 5.3 | 8.5 | -0.4 |
| cuji_b | 156 | 250 | 6.5 x 6.3 | 10.4 | -0.4 |
| cuji_c | 140 | 250 | 5.9 x 5.7 | 9.3 | -0.4 |
| arbol_falcon_a | 224 | 250 | 9.8 x 7.1 | 9.8 | -0.5 |
| arbol_falcon_b | 224 | 250 | 8.8 x 6.8 | 9.6 | -0.5 |
| palma_falcon_a | 174 | 250 | 11.2 x 12.5 | 16.9 | -0.4 |
| palma_falcon_b | 182 | 250 | 12.9 x 13.3 | 21.5 | -0.4 |
| roca_arida_01 | 77 | 400 | 8.2 x 7.8 | 3.4 | -0.5 |
| roca_arida_02 | 96 | 400 | 6.2 x 4.5 | 6.3 | -0.5 |
| roca_arida_03 | 106 | 400 | 13.1 x 9.9 | 3.4 | -0.5 |
| roca_arida_04 | 174 | 400 | 10.3 x 8.7 | 4.4 | -0.5 |
| roca_arida_05 | 88 | 400 | 12.2 x 6.7 | 5.0 | -0.5 |
| roca_arida_06 | 91 | 400 | 7.3 x 7.0 | 5.5 | -0.5 |
| cerro_rocoso_a | 326 | 400 | 24.2 x 15.5 | 13.1 | -0.6 |
| cerro_rocoso_b | 326 | 400 | 27.2 x 14.6 | 11.8 | -0.6 |
| duna_cresta_a | 288 | 200 | 24.0 x 10.0 | 2.8 | -0.2 |
| duna_cresta_b | 288 | 200 | 24.0 x 10.0 | 2.4 | -0.2 |
| islote_a | 291 | 400 | 20.0 x 15.8 | 12.1 | -3.0 |
| islote_b | 359 | 400 | 21.8 x 14.1 | 14.2 | -3.0 |
| islote_c | 291 | 400 | 24.5 x 12.9 | 10.0 | -3.0 |
| roca_mar_01 | 77 | 400 | 6.9 x 6.5 | 3.2 | -1.5 |
| roca_mar_02 | 77 | 400 | 8.9 x 8.1 | 4.4 | -1.5 |
| roca_mar_03 | 108 | 400 | 10.1 x 9.1 | 5.7 | -1.5 |
| roca_mar_04 | 142 | 400 | 11.0 x 9.7 | 3.6 | -1.5 |
| burro | 228 | 300 | 6.2 x 1.4 | 5.5 | 0.0 |
| cabra_a | 231 | 300 | 3.6 x 1.0 | 3.7 | 0.0 |
| cabra_b | 231 | 300 | 3.6 x 1.0 | 3.7 | 0.0 |
| flamenco_grupo | 288 | 300 | 15.6 x 15.6 | 5.6 | 0.1 |
| lagarto | 162 | 300 | 6.6 x 5.0 | 2.6 | -0.4 |
| pelicano_a | 125 | 300 | 5.4 x 1.5 | 6.9 | -0.4 |

**Total: 10121 tris** (54 parts).
