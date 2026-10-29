# MAPA DE VENEZUELA · ARTE (meta, rúbrica y contrato)

Objetivo (2026-10-17): que el mapa de LA FIESTA pase de «gris jugable» a un mapa **pixel-art ilustrado, memorable y venezolano**, como las dos
referencias (`/private/tmp/claude-501/-Users-guillermomarin-Documents-GitHub-minigames/c18fd1c1-7307-4a61-958c-15bfe36fe90d/images/1.png` y `2.png`):
costa con aguas turquesa, lago de Maracaibo con puente, torres de petróleo y tormenta del Catatumbo, desierto con dunas y cactus al NO, Andes nevados con
teleférico, Caracas con el Ávila y torres gemelas, Llanos amarillo-verdes con palmas, vacas y chigüires, delta con manglar morado y palafitos (+ puerta y arepa
flotando), tepuyes con el Salto Ángel y selva, zona industrial de Guayana en el Orinoco, islas (Margarita con volcán, Los Roques), barcos y bancos de nubes.

## Meta de «terminado»
**85 / 100** en la rúbrica. 100 = paridad con una ilustración de IA (inalcanzable con arte procedural); 85 = mismos hitos, misma composición y paleta, y a zoom de juego
(0,5–1 px/u) se lee como la referencia. Lo que queda fuera de ese 15 %: resolución/detalle fino y variedad de sprites hechos a mano.

| # | Criterio | Pts | 0 pts es… | Pts completos es… |
|---|---|---|---|---|
| 1 | Composición y geografía | 15 | mapa gris en un mar liso | tierra casi a sangre con costa orgánica, islas al NE, nubes enmarcando sur y oeste, regiones en el lugar de la referencia |
| 2 | Mar y costa | 10 | mar plano | profundo→turquesa por distancia a la costa, bajíos, playas de arena, espuma, arrecifes/atolones de Los Roques |
| 3 | Terreno y biomas | 15 | un solo color de tierra | desierto con dunas, llanos con manchas de pasto, selva de copas con luz/sombra, Andes con nieve y pinos, manglar morado, sin zonas planas grandes |
| 4 | Agua interior | 10 | sin ríos | lago de Maracaibo con orilla, Orinoco y red de ríos con sombra, cascadas con bruma, agua morada del delta, Catatumbo (rayos) |
| 5 | Hitos venezolanos | 20 | ninguno | Caracas+Ávila+teleférico+torres, puente y torres petroleras, tepuyes+Salto Ángel, industria Guayana, volcán de Margarita, fincas/vacas/chigüires, palafitos+puerta+arepa, faro, barcos |
| 6 | Nubes y atmósfera | 5 | sin nubes | bancos de nubes con volumen y sombra azulada, brumas en cascadas |
| 7 | Oficio pixel-art | 10 | ruido sin criterio | paleta coherente (`F.arte.PAL`), luz desde arriba-izquierda, contornos/dithering consistentes, sin banding ni basura de ruido |
| 8 | Legibilidad de juego | 10 | arte tapa casillas/caminos | casillas, caminos y rótulos nítidos sobre el arte, minimapa legible, coste de arranque y de cuadro dentro de presupuesto |

(+ animación ligera —olas, barcos, rayos, brillos, nubes— cuenta dentro de 5 y 7.)

## Arquitectura
- `fiesta-mapa-arte.js` (núcleo, NO tocar): búfer 2000×1500 (1 px = 2 u de mundo), máscaras `tierra/extra/dist/bioma/reg/ocupado`, paleta, ruido, sprites ASCII, registro de capas.
- Una capa = un archivo `fiesta-arte-<capa>.js` que llama `FIESTA.arte.capa(id, orden, fn(A))`. Orden: 10 mar · 20 terreno · 30 relieve · 40 agua · 50 vegetación · 60 hitos · 70 nubes · 90 acabado.
- `fiesta-tablero.js` estampa el arte como capa estática (sin suavizado) y dibuja encima caminos, casillas, fichas, rótulos.
- Volcado sin navegador: `node docs/style-lab/pruebas/fiesta-arte-png.js <salida.png> x0,y0,x1,y1 <zoom> [bioma|dist|reg|ocupado]` (coords en DISEÑO 0..1000). `T=1.5` pinta las animaciones.
- Producción: el arte se hornea a `assets/fiesta/mapa-venezuela.png` + `.dyn.json` (cero coste de generación en el cliente).

## Reglas de las capas
1. Sin `Math.random`/`Date`: usa `A.hash`, `A.rng(seed)`, `A.vn/fbm/campo`. Mismo resultado siempre.
2. Presupuesto: cada capa ≤ 700 ms en Node (carga normal); total de la construcción ≤ 6 s.
3. Evita pintar sobre `A.ocupado` los adornos grandes (árboles, casas); los caminos/casillas se dibujan encima en el tablero, pero deben seguir leyéndose.
4. Luz desde arriba-izquierda (sombras abajo-derecha). Paleta `A.PAL`; mezcla/sombrea/aclara con `A.mezcla/A.sombrea/A.aclara`.
5. Animaciones: `A.dyn.push({k,x,y,...})` (px de arte) + `F.arte.din[k]=(c,e,t)=>{c.fillStyle='#..';c.fillRect(x,y,1,1)}`. ≤ 150 entidades en total; nada de arrays nuevos por cuadro.
