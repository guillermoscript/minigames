# delta_kit manifest

File: `assets/models/delta_kit.glb` (source `tools/blender/prop_delta_kit.py`). 1 unit = 1 map unit. Origin = base centre, z=0 = water level; front faces -Y; canoes/birds bow/head +X.
Grid in the file: one row per category, x spacing 28 (36 islands, 32 sand bars), y spacing -34. `pasarela_esquina` origin = the corner square centre (arms go -X and +Y).
Stilt houses: stilt feet z=-1.5, deck top z=2.4. Boardwalks: deck top z=2.3. Mangrove roots end z=-0.8. Islands/sand bars: mud/sand bank z=-0.5..~1.

| Part | tris | footprint (x by y) | height (z min..max) |
|---|---|---|---|
| banco_arena_01 | 220 | 16.8 x 9.7 | 11.5 (-0.4..11.1) |
| banco_arena_02 | 250 | 22.1 x 9.4 | 12.4 (-0.4..12.0) |
| banco_arena_03 | 188 | 26.2 x 10.6 | 12.2 (-0.4..11.8) |
| banco_arena_04 | 272 | 29.9 x 10.9 | 11.5 (-0.4..11.1) |
| canoa_a | 98 | 8.0 x 1.6 | 1.5 (-0.3..1.1) |
| canoa_b | 128 | 8.0 x 2.1 | 4.8 (-1.0..3.8) |
| canoa_c | 228 | 8.4 x 2.3 | 3.2 (-0.3..2.8) |
| canoa_motor | 176 | 10.8 x 2.0 | 3.5 (-1.2..2.3) |
| garza_a | 96 | 5.8 x 1.5 | 5.9 (-0.0..5.9) |
| garza_b | 95 | 5.6 x 1.5 | 3.5 (-0.0..3.5) |
| garza_c | 95 | 5.1 x 1.5 | 5.8 (-0.0..5.8) |
| ibis_roja | 101 | 5.9 x 1.5 | 4.5 (-0.0..4.5) |
| isla_manglar_01 | 330 | 19.4 x 18.5 | 17.0 (-0.8..16.2) |
| isla_manglar_02 | 398 | 23.9 x 17.8 | 16.4 (-0.8..15.6) |
| isla_manglar_03 | 408 | 27.4 x 23.3 | 16.0 (-0.8..15.1) |
| isla_manglar_04 | 462 | 30.6 x 22.7 | 16.9 (-0.8..16.1) |
| isla_manglar_05 | 440 | 30.2 x 30.3 | 16.9 (-0.8..16.1) |
| isla_manglar_06 | 482 | 33.9 x 24.3 | 16.0 (-0.8..15.2) |
| mangle_clump_01 | 176 | 6.6 x 7.6 | 9.5 (-0.9..8.6) |
| mangle_clump_02 | 220 | 9.2 x 9.6 | 12.8 (-0.9..11.9) |
| mangle_clump_03 | 278 | 11.2 x 9.9 | 12.5 (-0.9..11.5) |
| mangle_clump_04 | 278 | 10.6 x 10.9 | 12.0 (-0.9..11.1) |
| mangle_clump_05 | 290 | 11.5 x 13.1 | 13.0 (-0.9..12.0) |
| mangle_clump_06 | 290 | 12.3 x 14.2 | 13.2 (-0.9..12.3) |
| mangle_clump_07 | 290 | 14.9 x 13.5 | 13.7 (-0.9..12.7) |
| mangle_clump_08 | 302 | 14.9 x 14.8 | 13.3 (-0.9..12.4) |
| mangle_raices_a | 122 | 5.2 x 4.5 | 6.0 (-0.9..5.1) |
| mangle_raices_b | 148 | 6.4 x 4.5 | 6.2 (-0.9..5.4) |
| muelle_delta | 184 | 10.9 x 4.8 | 5.7 (-1.5..4.2) |
| palafito_01 | 202 | 8.4 x 8.0 | 9.1 (-1.5..7.6) |
| palafito_02 | 198 | 9.4 x 8.4 | 8.7 (-1.5..7.2) |
| palafito_03 | 214 | 9.0 x 9.4 | 8.7 (-1.5..7.2) |
| palafito_04 | 210 | 10.6 x 8.8 | 8.7 (-1.5..7.2) |
| palafito_05 | 256 | 8.0 x 7.6 | 9.1 (-1.5..7.6) |
| palafito_06 | 166 | 8.4 x 9.2 | 8.8 (-1.5..7.3) |
| pasarela_esquina | 156 | 5.0 x 5.0 | 4.9 (-1.5..3.4) |
| pasarela_recta | 88 | 8.0 x 2.0 | 4.9 (-1.5..3.4) |
| red_pesca | 124 | 7.4 x 3.6 | 5.1 (-0.5..4.6) |
| roca_delta_01 | 60 | 5.9 x 3.5 | 4.2 (-0.8..3.4) |
| roca_delta_02 | 60 | 7.7 x 4.8 | 4.9 (-0.6..4.3) |
| roca_delta_03 | 40 | 4.8 x 2.8 | 2.5 (-0.4..2.1) |
| roca_delta_04 | 60 | 8.8 x 6.4 | 6.5 (-1.3..5.2) |
| tronco_flotante | 84 | 6.0 x 2.3 | 2.2 (-0.6..1.6) |

Total: **8963 tris** in 43 parts.
