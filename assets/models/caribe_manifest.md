# Caribbean Venezuela props (tools/blender/prop_*.py -> assets/models/*.glb)

Vertex colours only, lighting baked, origin = base centre, +Z up (glTF Y-up), front = -Y (south). Water level z=0.
`prop_palmas_coco.py` doubles as the shared kit (palm, palapa, umbrella, lounger, sand_blob, scale_parts, palette C); `prop_barcos.py` provides hull()/boats.

| file | Parts (tris) | total tris | footprint (x,y,h) | anchor zone |
|---|---|---|---|---|
| margarita_playa.glb | shallows 64, sand 166, palapas 176, loungers 192, umbrellas 42, bar 148, palms 440, pier 154 | 1382 | 42 x 24 x 8 (sea to the south, pier runs south) | Margarita (Playa El Agua) |
| castillo_pampatar.glb | rock_base 296, walls 440, towers 416, keep 136, cannons 120 | 1408 | 41 x 42 x 14 (gate/steps face south) | Pampatar |
| barcos.glb | sailboat 84, penero 152, ferry 212, lancha 122, velero_catamaran 138 | 708 | Parts at loc (0,0), (20,0), (40,0), (0,-20), (20,-20); bow = +X; keel z=0; ferry ~16 long, penero 8, sailboat 7, lancha 6.4, catamaran 8 | any sea tile (Margarita/Pampatar/Roques/Mochima, Conferry route) |
| los_roques.glb | shallows 40, island 128, lighthouse 150, palapas 132, loungers 72, palms 330, dock 70, boat 152 | 1074 | 38 x 38 x 16 (lighthouse tallest) | Los Roques |
| cayo_morrocoy.glb | shallows 36, island 58, palms 550, palapa 44, hammock 24, sunbeds 48, boat 122 | 882 | 28 x 28 x 8 | Morrocoy |
| palmas_coco.glb | palm_s 100, palm_m 140, palm_l 150, palm_lean 170 | 560 | Parts at x = 0/14/28/42 (origin = trunk base); heights 4.6/7/10/8 | instance anywhere on sand/jungle |
| mochima_muelle.glb | shore 156, hills 20, palms 220, pier 198, huts 246, boat_penero 152, boat_sailboat 84 | 1076 | 40 x 41 x 11 (shore/hills north, pier runs south) | Mochima |
| cacao_paria.glb | soil 188, cacao_trees 592, shade_trees 72, patio 104, hut 52, sacks 90 | ~1100 | 40 x 28 x 12 | Paria |

Notes
- Animatable/instanceable: each boat in barcos, `boat` Parts (los_roques/cayo_morrocoy/mochima), `shallows`, `palms`, `pier`, `bar` are separate Parts. Palm Parts in sets are merged per set (palms), use palmas_coco for individually instanced palms.
- Sets are scaled (0.66-0.95) so they stay <=42 units; shallows rings/sand have z slightly above 0 (0.03-0.06) so they need polygonOffset if the sea plane is also at z=0.
- Not done / compromises: no sails/flags animation; the ferry bow visor and rigging are omitted; pods on cacao trees are exaggerated and sit on the canopy rim for readability; hills in mochima are 2 plain low-poly blobs (no detail); sets exceed 300 tris per Part for merged groups (palms/palapas) but each stays well under the 1500 total except none.
- Props that include boats reuse `penero`/`lancha`/`sailboat` geometry (152/122/84 tris, within the 300 per-instance limit).
