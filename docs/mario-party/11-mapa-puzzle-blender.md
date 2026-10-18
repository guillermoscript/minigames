# Mapa puzzle en Blender (secciones que se pegan)

Experimento en paralelo al mapa v2. Cada sección es una «loseta» de diorama (suelo con acantilado, agua, árboles, pueblos, hitos, casillas) hecha con Blender por script (bpy + numpy, sin add-ons). Todas salen de la misma geografía global (`assets/map/v2/layout.json`, marco de coordenadas del layout), así que dos losetas vecinas **encajan solas** por el borde compartido.

## Cómo se corre
```bash
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b -P tools/map/puzzle/run_section.py -- falcon      # → assets/map/puzzle/falcon.blend + falcon_preview.png + falcon_landmarks.json
$B -b -P tools/map/puzzle/run_section.py -- zulia
$B -b -P tools/map/puzzle/assemble.py -- zulia falcon   # → assembled.blend + assembled_preview.png
```
Cada sección tarda ~7 s. (No usar el Blender abierto vía MCP para esto: se agota el tiempo.)

## Geografía fijada
`tools/map/puzzle/pinned/` guarda una copia congelada de `layout.json`, `regions.json` y `geo_v2.py` (2026-10-18). El mapa v2 se regeneró mientras trabajábamos y movió todo; las losetas leen esta copia para no depender de él. Si se quiere seguir el v2 nuevo hay que volver a copiar y reajustar `SECTIONS`.

## Piezas
- `pz_lib.py`: ruido, máscaras tierra/lago/mar, `build_slab` (malla de suelo + paredes de roca + agua), escena/cámara/render.
- `pz_terrain.py`: `SECTIONS` (rectángulo + manchas de desierto/montaña por sección), alturas, dunas, colores de bioma.
- `pz_props.py`: árboles, palmas, cactus, rocas, casas, iglesia, torres, taladros, tanques, barcos, nube de tormenta, palafitos.
- `pz_populate.py`: bosques, desierto, islotes con espuma, pueblos.
- `pz_sections.py`: hitos por casilla (`BUILD`), puente atirantado, campo petrolero, ciudad, casillas (disco + pin) y caminos entre casillas.

## Añadir otra sección
1. Añadir entrada en `SECTIONS` (rect compartiendo un borde con la vecina, manchas de bioma, `seed`).
2. Si tiene hitos propios: añadir su nodo en `BUILD` de `pz_sections.py`.
3. Correr `run_section.py -- <nombre>` y luego `assemble.py`.

## Estado (2026-10-18)
Tercera loseta: `andes` (Mérida): picos con nieve, río con cascada y puente de piedra, pueblo con plaza, teleférico de 3 estaciones, vacas, pinos por altitud. Comparte el borde y=820 con `zulia`.

Hechas: `falcon` (Paraguaná, médanos de Coro, Dabajuro, Barquisimeto, San Felipe, cayo Morrocoy) y `zulia` (lago, puente, Maracaibo, costa petrolera, palafitos, tormenta del Catatumbo).
Cada `*_landmarks.json` trae las casillas (id, nombre, tipo, x, y, z) y los caminos (pares de ids) para enganchar al juego.
Pendiente: resto de secciones, pulido del look (comparar con las referencias), exportar a GLB por loseta para la web, y reconciliar las posiciones de casillas con el `layout.json` del juego.

## Paquetes de arte (CC0) en `assets/map/puzzle/packs/`
- `polyhaven/`: coast_sand_01, aerial_grass_rock y rock_face (difuso, normal y rugosidad a 1k) → material `terrain_material` en `pz_lib.py`.
- `kenney/`: `kenney_nature-kit.zip` (10,5 MB, descomprimido en `kit/`) → árboles, palmeras, cactus, arbustos y rocas vía `pz_assets.py`.
- `quaternius/`: 6 modelos de la Ultimate Nature Pack (Google Drive limita las descargas; `/tmp/qdl.py` reintenta).
Render con Cycles en GPU Metal (~20-40 s por loseta). `rerender.py -- <sec>` solo re-renderiza.
