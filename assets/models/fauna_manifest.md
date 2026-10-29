# Fauna props (LA FIESTA)

Built by tools/blender/prop_<name>.py (headless Blender, lib.py). Animals are separate Parts facing +X locally (three.js: +X east); `loc`/`rot` place them, so JS can re-yaw / animate each. Hooves/feet on z=0.

| file | Parts (tris) | footprint (x*y*h) | zone |
|---|---|---|---|
| llanero_caballo.glb (982) | llanero_a (488: bay horse, red sash, both hands on reins), llanero_b (494: grey horse, blue sash, right arm raised with lasso) | 17 x 4 x 6.2 (each ~5 x 2 x 6) | llanos |
| caballos_manada.glb (992) | horse_1 brown standing (248), horse_2 black grazing (248), horse_3 grey trotting (248), horse_4 chestnut foal (248) | 19 x 16 x 4.7 | llanos |
| chiguiros.glb (1020) | capybara_1..3 (140/120/140), capybara_baby_1..2 (140/120), pond (144, water 20x14 + mud bank 25x18), reeds (216) | 25 x 23 x 3.4 | llanos (also amazonia marsh) |
| jaguar.glb (398) | jaguar (308, rosette decals), rock (90, mossy boulders) | 13 x 9 x 9 | amazonia |
| guacamayas.glb (506) | macaw_1 (178), macaw_2 (178), branch (150: log, forked stumps, leaves) | 15 x 6 x 8.6 | amazonia |
| flamingos.glb (958) | flamingo_1 stand, _2 head-down, _3 one-legged, _4 walking, _5 juvenile (~160 each), lagoon (144, turquoise 21x15 + sand rim 25x18) | 25 x 18 x 7.5 | coro / roques |

Notes / not done
- jaguar mesh is 308 tris (budget 300 per instance mesh): marginal overshoot.
- llanero_a/b are 488/494 (<=500) but the hat brim hides the rider from a pitch-70 camera; silhouette reads best at medium pitch.
- Spots on the jaguar are small raised decal quads (dark ring + gold centre), not texture; at phone size they read as rosettes.
- Capybara babies are not a separate scale of the same mesh (own Parts, scale .7 and bigger head).
- Previews are at pitch 52-70 in assets/blender/previews/<name>.png. lib.py and existing files untouched; build_all.py not run.
