# Guayana / Andes / Falcon props (tools/blender/prop_<name>.py -> assets/models/<name>.glb)

Conventions: origin = base centre, front faces -Y, Z up in Blender (Y-up in glTF), vertex colours only, lighting baked. Previews in assets/blender/previews/.

| file | tris | Parts (mesh names) | footprint (x, y, h) | anchor zone |
|---|---|---|---|---|
| sidor_puerto_ordaz | 1614 | alto_horno, chimeneas, humo, naves, bobinas, planchones, grua, cinta | 57 x 42 x 56 | Puerto Ordaz |
| represa_guri | 932 | muro, penstocks, casa_de_maquinas, vertedero_cauce, vertedero, lago, estribos | ~108 x 56 x 31 (wall itself ~66 wide) | Guri |
| puente_angostura | 1504 | puente_tablero, pilas, pilonos, cables | 115 x 13 x 41 (origin deck centre, along +X, water z=0) | Cdad. Bolivar |
| andes_merida | 1052 | paramo, pico_bolivar, pico_humboldt, pico_bonpland, capilla, frailejones | 97 x 78 x 71 | Merida |
| coro_medanos | 1187 | duna_1, duna_2, duna_3, cardones, cactus_redondo, arbustos_secos, iglesia_coro | 85 x 64 x 17 | Coro |
| roraima_tepui | 975 | tepuy, bosque_nuboso, cascada, mist | 89 x 53 x 59 (plateau ~60 x 30, cliffs 55 tall) | Canaima |
| cueva_guacharo | 1037 | colina, fachada_cueva, boca_marco, tunel, camino_piedra, arboles, guacharos | 80 x 83 x 29 | Monagas |
| caroni_llovizna | 1491 | roca_cascada, cascada, estanque, islotes, puente_madera, arboles | 82 x 71 x 31 | Llovizna |

Notes
- Animatable/instanced Parts: humo (smoke), vertedero (spillway water), cascada (white falls, in roraima and llovizna), mist, guacharos (5 birds merged in one mesh), frailejones (12 merged), capilla, iglesia_coro.
- Cave mouth, falls and chapel/church all face -Y (south, toward camera).
- Preview GROUND colours are only for the preview render (ground_occ is not exported); sinks below z=0 are only the buried feet of rocks/abutments.

Not done / caveats
- sidor_puerto_ordaz is 1614 tris (slightly over the 1500 hero budget, under 3000).
- caroni_llovizna's tree set, roraima's skirt trees and the coro cacti are merged meshes (no per-instance meshes); frailejones are one merged mesh, not frailejon_1..3.
- cueva_guacharo preview is rendered at pitch 70: the vertical cave facade is foreshortened there, the arch reads best at lower camera pitch (verified at pitch 8 and 35). The 5 guacharos hover above the facade roof line.
- represa_guri: ~108 units wide including lake and rocky abutments; the dam wall alone is ~66. Rocky abutments dip to z=-8 (buried), so place at ground level with the base sunk.
- puente_angostura cables are triangular-section beams (3 sides) to stay within budget.
