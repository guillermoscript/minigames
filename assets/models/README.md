# LA FIESTA landmark pack (.glb)

Low-poly landmarks for `docs/style-lab/mapa3d.html` (three r128, `js/vendor/three.min.js`). Built with Blender 5.2 + bpy:
`blender -b -P tools/blender/build_all.py` rebuilds everything (one script per prop in `tools/blender/prop_*.py`, shared helpers + lighting bake in `lib.py`).
Sources: `assets/blender/*.blend`. Previews (game camera: fov 24, pitch 70°, on a ground plane): `assets/blender/previews/*.png`.
`python3 tools/blender/inspect_glb.py assets/models/*.glb` prints mesh names and triangle counts.

Total folder size: ~756 KB. No textures, cameras or lights. Every file re-imports in Blender with no errors.

## How the look is made

- Geometry is modelled with chamfers, lofted tapers, gable/lean-to roofs with tile bands, stepped crowns, fluted cliffs, hexagonal-ring cows, etc. (no plain stacked boxes).
- **Lighting is ray-traced and baked into vertex colours** (`lib.bake_lighting`): 26-ray cosine ambient occlusion + 7-ray soft sun shadow (sun from the page's `(-300,600,300)`) per face corner, contact shadows against a ground plane (preview/occluder only, not exported), and a slight cool shadow tint. Runtime lighting stays one directional + hemisphere light; the baked shading carries the depth.
- Muted facade palette (sand, warm white, terracotta, mustard, dusty blue, sage); terrain colours from `mapa3d` for the nature props.

## Conventions (read before wiring the loader)

- **Units:** 1 unit = 1 design-canvas unit. Origin = base centre, +Y up (glTF). Tile radius is 8.
- **World mapping (as in mapa3d):** `world.x = design.x - 500`, `world.z = design.y - 500`. Authored so that **+Z (glTF) = south = toward the game camera**; anything with a "front" (falls, veranda) faces +Z.
- **Rotation:** to point a prop's +X axis along a design-space direction `(dx, dy)` use `rotation.y = -Math.atan2(dy, dx)`.
- **Vertex colours — important.** `COLOR_0` follows the glTF spec (linear). The board renders with three's default linear output, so palette hexes only match the terrain if the loader converts them. Use this on load (r128):
  ```js
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const c = o.geometry.attributes.color, k = 1 / 2.2;
    for (let i = 0; i < c.count; i++) c.setXYZ(i, Math.pow(c.getX(i), k), Math.pow(c.getY(i), k), Math.pow(c.getZ(i), k));
    c.needsUpdate = true;
    o.material = new THREE.MeshLambertMaterial({ vertexColors: true });
  });
  ```
  (Skip the loop if the page ever switches to `outputEncoding = sRGBEncoding`.) `COLOR_0` is a normalized `vec4`, alpha 1. The previews were gamma-corrected the same way, so they show what the page will show.
  Because lighting is baked, you can lower the page's hemisphere/directional intensity slightly for these meshes if they look too contrasty next to the terrain.
- **GLTFLoader is not vendored.** `js/vendor` only has `three.min.js`; add the matching r128 `examples/js/loaders/GLTFLoader.js`.
- One shared material `palette_vc` (replace as above). No UVs, no textures.
- Nodes with a `translation` (marked **T**) sit on a grid or at a hanging point. For instancing, clone the mesh and reset `position` to 0 (rocks, trees); cows/cabins keep theirs (see below).
- Anchors use the *raw* node coordinates from `fiesta-mapa-venezuela.js`; `mapa3d` relaxes tile positions (`POS`), so prefer `POS[id]`.

## Files

Triangle counts are from the exported .glb. Budgets: ≤1500 per hero prop, ≤300 per instanced tree/rock, ≤3000 per scene piece. Every file is within budget.

| File | Tris | Size (x × z × y) |
|---|---|---|
| maracaibo_bridge | 910 | 96 × 10 × 36 |
| caracas | 1318 | 93 × 70 × 63 |
| caracas_hillside | 988 | 96 × 34 × 15 |
| avila_ridge | 1344 | 160 × 44 × 29 |
| angel_falls_tepui | 616 | 56 × 56 × 44 |
| hato_llanos | 1382 | 72 × 34 × 12 |
| teleferico | 452 | 39 × 6 × 14 |
| mochima_rocks | 1057 (9 × 93–158) | grid |
| oil_derricks | 1253 | 42 × 32 × 25 |
| trees | 603 (9 × 46–79) | grid |

### maracaibo_bridge.glb
- Meshes: `bridge_deck` (box-girder deck with an arched navigation span, road, dashes, kerbs, parapets, abutments), `piers`, `pylons` (two leaning H-pylons with chamfered crossbeams), `cable_fan` (40 stays).
- Anchor: midpoint of `zul_maracaibo` (115,195) and `zul_cabimas` (185,215) = **(150, 205)**, node distance 72.8. Rotation `-atan2(dy, dx)` (≈ -0.278 rad). Length 96 = node distance + 12 overhang per shore (what the page draws today); for other distances `scale.x = (dist + 24) / 96`.
- Y: origin = water line (`SEA` = 1.5). Deck top ≈ +9.5 at the shores, +13 mid-span; piers go to -3.

### caracas.glb (downtown) + caracas_hillside.glb (barrio)
- `caracas`: `plaza` (paved rings, fountain), `streets`, `towers` (Parque Central-style twin towers on a shared podium, window bands, setback crowns, pilasters, antennas), `midrise` (19 blocks on a street lattice, rooftop units).
- Anchor: **`ccs_start` (520, 200)** = plaza centre; rotation 0, scale 1; Y = terrain height. Towers at ≈ (534,183)/(554,183) design space; blocks south of the plaza (design y 211-245).
- `caracas_hillside`: `slope` (green hillside with dirt paths) + `houses` (4 terraced rows of muted houses with gable/flat roofs, water tanks). Origin = foot of the slope (south edge, centre); the slope rises toward the north (-design y) by 11 units over 34. Anchor: **(520, 168)** so it climbs toward the Ávila at design y 134. Scale X ×1.2 if the city needs more cover.
- Both overlap the terrain; hide terrain tiles' decor underneath. Blocks/houses are merged per mesh (no per-building nodes).

### avila_ridge.glb
- Mesh `avila_ridge`: smooth vertex-coloured ridge (lush slopes, darker ravines, rocky crest), 160 × 44 × 28.
- Anchor: **(530, 150)**, rotation 0. Base is 1 below origin so edges sink into the terrain. Lower the Ávila bump in `relieve()` (`24*exp(-((y-158)^2)...)`) when this is loaded.

### angel_falls_tepui.glb
- Meshes: `tepuy` (fluted cliff with overhanging strata, forested talus, jungle plateau, scree), `falls` (white ribbon down the south face + plunge pool — tint/animate it), `mist` (5 blobs).
- Anchor: **(735, 612)** so the falls base lands on `can_saltoangel` (735, 630). Rotation 0, scale 1. Plateau top = 40 above the origin. Replace terrain mesa `MESAS[0]` when loading; base Y ≈ `TOPE` (10).

### hato_llanos.glb
- Meshes: `ground` (irregular dirt yard), `house` (whitewashed walls, tiled gable roof, veranda, shutters, chimney), `corral` (posts, three rails, gate gap, trough, hay bales), `cow_1…cow_5` (`cow_5` the bull), `trees` (two shade trees).
- Each `cow_N` node carries its own translation + yaw (origin at its feet); animate by moving/rotating it. Cows face local +X.
- Anchor: mapa3d's hato (352,452) → origin at **(369, 452)** (house at local x = -17, corral at +15). Rotation 0, scale 1. Node `lla_hato` is at (300,445).

### teleferico.glb
- Meshes: `towers` (two A-frame towers with sheaves + station blocks and sheds at x = ±16), `cable` (two parallel ropes), `cabin_a`, `cabin_b` (origin = rope grip point; the cabin hangs below it).
- Animate: `cabin_a.position.x = lerp(-16, 16, t)`, `cabin_b.position.x = -cabin_a.position.x`; keep `position.y = 13.7`, `position.z = 0`.
- Routes: `ccs_avila` (545,182) → `ccs_galipan` (530,155), 30.9; `and_merida` (185,380) → `and_picoespejo` (205,410), 36.1. Anchor: midpoint, `rotation.y = -atan2(dy, dx)`, uniform `scale = dist / 32`. Base Y = terrain height of the lower station.

### mochima_rocks.glb
- Meshes `rock_{s,m,l}_{1,2,3}`: stacked dome with jungle crown (1), fluted spire (2), twin spires on a mound (3); each with a foam ring. Radius/height: s 6.5/12, m 9/18, l 12/25.
- Nodes are on a 3×3 grid: reset `position` to 0. Suggested placement (mapa3d `ISLOTES`): (690,152) `rock_l_2`, (722,146) `rock_m_2` ×1.1, (646,140) `rock_s_1` ×1.3, (852,142) `rock_m_1` ×1.1; `moc_mochima` is at (745,180). Y = water line; bottoms reach -4.4.

### oil_derricks.glb
- Mesh `rigs`: three lattice rigs on stilts (corner legs, belts, X-braces, crown block), quarters, tank, crane (rigs 1 and 3), helipad (rig 2), flare boom with flame, railed walkways.
- Anchor: **(150, 298)**, rotation 0, scale 1. Origin = water line; stilts reach -5. Check the footprint (x ≈ 132…174, y ≈ 282…314) is water.

### trees.glb (optional)
- `tree_{s,m,l}_{round,flat,cone}`: clustered-ball crown, umbrella (samán/acacia), three-tier cone. Trunk height / crown radius: s 2.6/2.2, m 4.2/3.2, l 6.0/4.6. Reset `position` to 0 and use as shared-geometry instances.

## Decisions / not done

- Colours are stored linear per glTF; conversion snippet above (the page uses default linear output).
- The bridge is 96 long including the 12-unit overhangs mapa3d adds.
- Caracas is split into two files so each stays under 1500 tris; the city itself is not per-building addressable.
- No LODs, animation clips or shadow meshes; `falls`, `mist`, `cabin_*`, `cow_*` are separate nodes for scripting.

## Island terrain (venezuela_terrain.glb)

- Built by `tools/blender/terrain_venezuela.py` from the page's own height/colour grid (`assets/blender/terrain_src/`: `heights.f32`, `colors.u8`, `pos.json`, exported from `docs/style-lab/mapa3d-modelos.html`), so tiles, paths and rivers still sit on the same surface. 50k tris, 0.8 MB, one `terrain` mesh, vertex colours only (AO + sun shadows, including shadows cast by the landmark props, are baked in).
- Mesh is indexed with no normals: load it with `docs/style-lab/glb-loader.js`, then `toNonIndexed()` + `computeVertexNormals()` for the faceted look (r128 Lambert has no `flatShading`).
- Viewer: `docs/style-lab/mapa3d-isla.html` (terrain glb + landmarks + Blender trees + shader water, smooth look). Add `?proc` to the URL to fall back to the old procedural terrain.
- If the page changes `altura()`, re-export the grid (see the header of the script) and rerun the script.
