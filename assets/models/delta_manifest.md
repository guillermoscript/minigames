# Delta / Orinoco / Amazonas props

Conventions: origin = base centre, Z up in Blender (glTF Y-up), front faces south, water surface z=0, vertex colours only.
Build: `Blender -b --python tools/blender/prop_<name>.py` (optional env for previews: `PITCH`, `FIT`, `ONLY=part1,part2`).

| File | Parts (tris) | Footprint (x,y,z units) | Anchor zone |
|---|---|---|---|
| palafitos_warao.glb (1386) | casa_1..4 (142 each), pasarelas (184), muelle (80), curiara_1 (94), redes (204), manglar (256) | 74 x 47 x 10 (decks at z=2.4, stilts to z=-1) | Delta |
| curiaras.glb (952) | curiara_a (140), curiara_b (214, paddler + hat), curiara_c (294, fisherman + thrown net), penero_motor (304, outboard) | 61 x 7 x 5, parts at x=-24/-8/8/24 (spaced 16), length 12 / 15 for the penero | Delta / Orinoco (rivers) |
| manglares.glb (926) | mangle_1 (292), mangle_2 (288), mangle_3 (292), agua_oscura (54, three dark water patches r=13 under them) | 74 x 26 x 14, clusters at x=-24/0/24, ~12 wide each | Delta |
| palmas_moriche.glb (1144) | palm_moriche_s (179, h4.5), _m (193, h7.5), _l (221, h11), palm_cluster (551, three palms, loc y=-26) | 40 x 39 x 13 | Delta / Llanos |
| toninas.glb (600) | tonina_1 (156, leaping arc), tonina_2 (156, surfacing), tonina_3 (236, mother + calf), splash (52, white ring + droplets at x=-14.5, next to tonina_1's nose) | 50 x 11 x 9, ~9 long each | Orinoco / Delta |
| garzas_corocoras.glb (1043) | ibis_1..5 (145-151: standing, wading, wings spread, curled neck, walking), garza_1..2 (157/151, egrets) | 60 x 23 x 10; ibis ~5 tall, garza ~8 | Llanos / Delta (wetlands) |
| autana_tepui.glb (703) | tepuy (423, sandstone streaks + forest skirt + dark green top), mist (280, ring of white blobs) | 38 x 37 x 58.6 (cliff r~9, height 55) | Amazonas |
| puerto_ayacucho.glb (1212) | tierra (bank), rio (water), churuata (134, round thatched house r~7, h14.6), casa_1..5 (34 each, tin roofs), iglesia (88, bell tower), muelle (68), raudales (149, ~30 wide rapids), arboles (265) | 84 x 69 x 18; river south, town north | Orinoco / Amazonas |

Notes
- Part origins: most parts keep world-absolute geometry (loc 0,0,0) inside the prop; separately animated/instanced ones (curiaras, toninas, ibis/garza, mangle_*, palm_*, churuata, casa_*, iglesia, muelle, raudales) carry their own `loc`/`rot`, so instance them by reading the node translation.
- Preview ground colours are not exported (ground_occ is excluded).
- Not done / deviations: per-mesh limits of 300 tris are met except palm_cluster (551, three palms), `pasarelas` (184) ok, `curiara_c`/`penero_motor` at ~300. puerto_ayacucho `arboles` is 265. No separate animated parts for flapping birds or canoe paddles (single mesh each). palafitos_warao has no hanging laundry/hammocks and the thatch has no individual strands (flat strip bands only). toninas have no tail/fin separate animation parts. Hero tri budget (<=1500) holds for every file.
- Water props (curiaras, toninas, manglares, palafitos, puerto_ayacucho 'rio') expect the board's own water plane at z=0; `rio` and `agua_oscura` are optional.
