# Mapa v2 de Venezuela (3D)

Visor: `docs/style-lab/mapa3d-v2.html` (servido por `python3 -m http.server`, p. ej. el preview "game" en el puerto 8765).
La página es un ensamblado generado: `python3 tools/map/build_page_v2.py` (a partir de `mapa3d-isla.html`); no se edita a mano.

## Pipeline (todo reproducible)
1. `python3 tools/map/layout_v2.py` — geografía real simplificada (`tools/map/geo_v2.py`: costa, lago, ríos, burbujas de ampliación), coloca las 114 casillas
   con separación mínima ~45, dentro de tierra, sin cruces de caminos a pie (6 residuales). Escribe `assets/map/v2/layout.json`, `regions.json`, `layout_debug.png`.
2. `python3 tools/map/place_v2.py` — resolutor de colocación: hitos, fauna, barcos y relleno urbano (`urbs`) evitando casillas, caminos y ríos → `placements.json`.
3. `blender -b --python tools/map/terrain_v2.py` — relieve, colores por región, árboles (`trees.json`), rejilla `heights.f32`, y malla `assets/models/venezuela_v2_terrain.glb`
   con AO + sombras horneadas (incluye las de los hitos y edificios). Correr `place_v2.py` antes y después si cambian los hitos (las sombras salen de `placements.json`).
4. `python3 tools/map/build_page_v2.py` — regenera la página.

## Assets (tools/blender/prop_*.py → assets/models/*.glb)
Hitos y fauna por zona; manifiestos en `assets/models/*_manifest.md` (fauna, caribe, delta, guayana, urbano).
