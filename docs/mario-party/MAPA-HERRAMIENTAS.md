# MAPA DE LA FIESTA: herramientas, método y plan para un mapa con vida

Documento del director del estudio, basado en los informes de 9 especialistas y en el debate entre ellos.
Para: el dueño del proyecto (sin experiencia en arte ni mapas). Fecha: 2026-10-17.

Aviso de honestidad: nadie del equipo probó un móvil real ni instaló Blender. Todas las cifras de fps en móvil son hipótesis hasta la Fase 0. Las licencias que dicen "no verificado" deben leerse en la página oficial antes de pagar o publicar.

---

## 1) Veredicto en 5 líneas

1. El PNG estático no es el camino, porque todo lo que se mueve (olas, nubes, luz) está pintado dentro de una sola imagen. La vida viene de separar el mapa en capas y animar cada capa por código.
2. No hay que cambiar de motor ni de estilo. Se mantiene el Canvas 2D actual y el 16-bit. Se añade una capa viva, un reloj de mapa (hora y clima) y eventos del juego (apagón, tormenta del Catatumbo, estrella).
3. El salto de "oficio profesional" viene de la dirección de arte, no de la tecnología: vista oblicua tipo Mario Party, paleta fija, luz arriba-izquierda y entre 12 y 60 hitos grandes (Ávila, Salto Ángel, torres, puente) hechos como sprites.
4. WebGL, Blender en tiempo real, SVG vivo, Pixi, Phaser y Three.js quedan fuera por ahora. WebGL solo entra en una fase condicional, si una medición en un móvil real lo justifica.
5. Orden obligatorio: primero medir en un Android de gama media real y fijar presupuesto, luego dar vida, luego mejorar el arte, y solo al final los extras. Nadie compra nada hasta leer las licencias oficiales.

---

## 2) Qué usaría un estudio real

Un estudio repartiría el trabajo así. Aquí cada rol lo cubre un agente de IA y tú decides.

| Rol de estudio | Qué hace | Herramientas típicas | Quién lo hace aquí |
|---|---|---|---|
| Director de arte | Guía de estilo, paleta, referencias, aprueba cada entrega | Aseprite (editor de pixel art), Krita (pintura gratis) | Agente director de arte + tú aprobando capturas |
| Artista de entorno | Terreno, hitos, vegetación | Generador procedural propio, Blender (3D gratis) o Retro Diffusion/FLUX (IA de imágenes) | Agente de arte |
| Artista técnico | Convierte arte en capas, atlas (una hoja con muchos sprites) y máscaras | Node, Python con Pillow, cwebp (compresor de imágenes) | Agente técnico |
| Animador | Olas, nubes, humo, relámpagos | Hojas de sprites de 4 cuadros, partículas en Canvas 2D | Agente de animación |
| Ingeniero gráfico | Capas, cámara, rendimiento en móvil | Canvas 2D propio; WebGL2 solo si hace falta | Agente de ingeniería |
| Ingeniero de datos geográficos (opcional) | Silueta, relieve, ríos | Natural Earth (datos públicos de países), d3-geo (librería que proyecta mapas) | Agente de datos |
| Diseñador de mundo vivo | Qué ocurre y cuándo | Catálogo de la sección 5 | Agente de diseño + tú eligiendo prioridades |
| Sonido | Ambientes por región | Howler.js (librería de audio web), Freesound filtrado por CC0 | Agente de sonido (fase ambiciosa) |
| QA y rendimiento | fps, peso, regresión visual | fiesta-tablero-perf.js (ya existe), Playwright, chrome://inspect en un Android real | Agente QA + tú con un teléfono |
| Productor | Alcance, licencias, hitos | Tabla de origen y licencia por asset | Agente productor |

Glosario rápido de lo que aparecerá: Canvas 2D es el lienzo del navegador que ya usa el juego. WebGL es dibujo con la tarjeta gráfica, más potente y más delicado. Shader es un programa pequeño que corre en la tarjeta gráfica. Tesela (tile) es un trozo de mapa que se carga solo si se ve. LDtk es un editor gratis que guarda posiciones de objetos en un archivo JSON.

---

## 3) Comparativa de enfoques candidatos

Puntaje de 1 (malo) a 5 (excelente). En riesgo, 5 significa riesgo bajo. Total sobre 30.

| Enfoque | Look | Vida | Esfuerzo (5 = poco) | Peso/móvil | Licencia | Riesgo | Total |
|---|---|---|---|---|---|---|---|
| A. Capas vivas en Canvas 2D sobre el suelo actual (sin cambiar arte) | 2 | 4 | 5 | 5 | 5 | 5 | 26 |
| B. A + dirección A: oblicuo 16-bit con hitos-sprite (RECOMENDADO) | 4 | 4 | 3 | 4 | 4 | 4 | 23 |
| C. Ilustración pintada de IA cortada en teselas WebP | 4 | 2 | 3 | 3 | 2 | 2 | 16 |
| D. WebGL2 propio con shaders y mapas de normales | 4 | 5 | 2 | 3 | 4 | 2 | 20 |
| E. Mapa SVG vivo en el DOM | 2 | 3 | 3 | 1 | 5 | 1 | 15 |
| F. Diorama 3D en tiempo real (Three.js o Blender a glTF) | 4 | 4 | 1 | 2 | 4 | 1 | 16 |
| G. Pixi o Phaser (cambio de motor) | 3 | 4 | 1 | 3 | 4 | 2 | 17 |
| H. Herramientas de mapas de fantasía (Inkarnate, Wonderdraft, Azgaar) | 3 | 1 | 4 | 4 | 2 | 3 | 17 |

Notas sobre las cifras que sostienen estos puntajes:

- A y B: el motor actual mide 0,93 a 1,11 ms por cuadro en escritorio y 3,4 a 4,1 ms con CPU frenada 4 veces. Hay margen de unas 4 veces. Medido en escritorio, no en móvil real.
- E: 3.000 nodos SVG animados dieron 4,7 fps (CPU frenada 6x) y 632 ms por cuadro en otra prueba. Canvas con Path2D hizo lo mismo en 8,3 ms. Medido en Chrome headless de escritorio. Se descarta como render en vivo; sirve como fuente de arte.
- D: el único número de shader (21 ms) usó render por software y no vale. La opción D no está demostrada ni a favor ni en contra.
- C: 3,7 MB el PNG de referencia, 469 KB en WebP q80. El problema no es el peso sino el estilo: se pixela mal con zoom, no se anima por partes y la licencia y el copyright son dudosos.
- F: bitmap único 4000x3000 son 48 MB de GPU, 50 MB a 4096x3072. Nunca un bitmap así en móvil: siempre teselas.

---

## 4) La recomendación detallada

Decisión: enfoque B, entregado por fases con puertas de decisión (las puertas están en la sección 6).

### Principios

- El suelo sigue siendo pixel art, pero se genera una sola vez offline y se parte en teselas WebP (de 1,64 MB a unos 1,05 MB en q85, medido con cwebp). Se exportan además mapas de datos pequeños (500x375, 8 bits): máscara de agua, máscara de luces y mapa de altura.
- Cuatro capas, de abajo hacia arriba: suelo; capa viva (sprites y partículas, tope de 150 entidades); capa de luz y clima (un lightmap de baja resolución, 1/4, no un velo a pantalla completa cada cuadro); casillas, caminos, fichas y rótulos siempre encima.
- Reloj de mapa: hora 0 a 24 y clima por región. Los eventos que cambian la partida (apagón, estrella) vienen del servidor. Lo decorativo se calcula en local con semilla fija, sin red.
- Reglas de legibilidad: la noche nunca baja el suelo de las casillas por debajo de 55 % de luminosidad; el arte bajo los caminos se atenúa 15 %; nada vivo sobre la máscara A.ocupado ni a menos de 60 u de una casilla; los elementos vivos son pequeños o de baja saturación.
- Presupuesto de partida (se fija en la Fase 0): descarga total hasta 3 MB, memoria de textura hasta 100 MB (nunca por encima de 150 MB), 50 fps medianos en Android de gama media, p95 de cuadro bajo 16 ms, no más de 4 capas a pantalla completa, 30 fps en vista general y en reposo. Nunca un bitmap de 4000x3000.

### Pipeline paso a paso

1. Medición base (agente QA, tú con un teléfono). Se mide el motor actual en un Android de gama media real vía chrome://inspect. Se arregla el defecto de reposo: 12 bytes cambian entre cuadros en la caja (372,267 a 433,282), lo que impide ahorrar batería.
2. Teselas y caché (agente técnico). El PNG se convierte a teselas WebP q85, se decodifican con createImageBitmap en un worker y se añade un service worker con caché versionada. Entregable: mapa idéntico en pantalla, menos peso, segunda visita sin descarga.
3. Capa viva y reloj de mapa (agente de animación + ingeniería). Olas en bucle de 4 cuadros, nubes con deriva y sombra, humo, barcos, tinte día/noche, luces de ciudad, Catatumbo, apagón. Entregable: módulo de capas con tope de 150 entidades y culling por cámara.
4. Piloto de arte de 3 días (agente director de arte + agente de arte). Una sola zona, Caracas + Ávila + costa. El Ávila se hace de tres maneras: (a) Blender sin interfaz (bpy) con compositor y paleta fija, (b) IA de pixel art (Retro Diffusion con Aseprite, o FLUX.2 klein 4B local), (c) generador procedural mejorado con vista oblicua. Se elige por consistencia y horas de trabajo, no por gusto. Entregable: tres capturas a zoom 0,3, 0,8 y 1,5.
5. Producción de hitos (agente de arte). Solo si el piloto pasa: de 12 a 15 hitos primero (Ávila, Torres de Parque Central, puente sobre el lago, torres petroleras, tepuyes, Salto Ángel, palafitos, refinería, Margarita...), hasta 40 a 60 después. Una sola vía de producción, la ganadora del piloto. Cada sprite se cuantiza a la paleta fija (48 a 64 colores), se retoca en Aseprite por línea de comandos y entra en un atlas único. Entregable: atlas más tabla de origen y licencia.
6. Integración y estampado (agente de ingeniería). Los hitos se colocan por JSON (opcional LDtk, editor gratis, licencia MIT según informes no verificados en esta sesión). Se reservan zonas libres para casillas.
7. QA (agente QA). Capturas a tres zooms contra las referencias, medición de fps, p95, MB, temperatura y batería a los 10 minutos en un móvil real. Si falla, degradación automática a 30 fps o menos capas.

### Qué hace el dueño

- Poner un teléfono Android de gama media en manos del proceso y abrir chrome://inspect cuando se lo pidan.
- Responder qué herramienta y qué plan se usó para las dos imágenes de referencia (decide si se pueden usar como algo más que inspiración).
- Elegir las 10 prioridades del catálogo de la sección 5.
- Aprobar o rechazar capturas. No dibuja y no programa.
- Aprobar cualquier compra solo después de que el agente productor traiga el texto oficial de la licencia.

---

## 5) Catálogo de "mundo vivo", top 15

El diseñador propuso 35 ideas; el debate lo recortó, porque un equipo de una persona no las completa y a 3 px por píxel la fauna pequeña se lee como ruido. Se priorizan las que comunican estado de partida. Costo: S pequeño, M mediano, L grande.

| # | Elemento | Tecnología | Costo | Por qué |
|---|---|---|---|---|
| 1 | Ciclo día/noche con piso de 55 % de luminosidad en casillas | Lightmap 1/4 de resolución, se actualiza al cambiar la hora | M | Mayor vida por esfuerzo; base de todo lo demás |
| 2 | Apagón por regiones, quedan velas y faros | Lightmap + máscara de luces | M | Evento propio del juego, identidad venezolana |
| 3 | Tormenta del Catatumbo: destellos aleatorios sobre el lago de noche | Degradados radiales con "lighter" (unas 20 luces) + trueno lejano | M | Firma visual de Venezuela; no mostrar cifras de relámpagos por minuto, varían entre medios |
| 4 | Estrella: columna de luz y destellos donde aparece | Partículas | S | Comunica estado de partida; la cámara cinemática ya existe |
| 5 | Olas y brillos de costa en bucle de 4 cuadros | Sprites | S | Movimiento barato en el borde de la atención |
| 6 | Nubes con deriva lenta y sombra proyectada | Canvas 2D | S | Mueve todo el mapa sin tocar la legibilidad |
| 7 | Luces de Caracas y ciudades encendidas de noche | Máscara de luces | S | Refuerza el ciclo de noche |
| 8 | Fuegos artificiales al comprar estrella o ganar | Partículas | M | Premio visual |
| 9 | Barcos pesqueros y petroleros con estela | Sprites sobre rutas JSON | M | Vida lejos de las casillas |
| 10 | Humo de Guayana y refinerías | Partículas | S | Barato y expresivo |
| 11 | Bruma animada en el Salto Ángel | Partículas | S | Refuerza el hito principal |
| 12 | Lluvia local en la región de un evento | Partículas + lightmap | M | Reacción a la partida |
| 13 | Mar picado durante tormenta | Velocidad de olas | S | Solo cambia parámetros |
| 14 | Aviso de evento con pulso en el mapa | UI | S | Guía la mirada |
| 15 | Arepa del delta que flota con vapor | Sprite | S | Humor y marca |

Quedan para después: fauna (aves, chigüires, delfines, guacamayas), teleférico de Mérida, sonido por región con Howler.js y sonidos CC0 de Freesound con archivo de créditos, zonas desbloqueables y variante de Navidad.

---

## 6) Plan en fases con hitos, criterios de aceptación y costes

### Fase 0: medir y fijar presupuesto (2 días, 0 USD)

- Hitos: motor actual medido en un Android medio con 114 casillas y 4 fichas; arreglados los 12 bytes del reposo; presupuesto escrito; tabla origen/licencia creada; una hora leyendo los textos oficiales (Natural Earth, Retro Diffusion, BFL FLUX.2 klein, Copernicus).
- Aceptación: tenemos números reales de fps, p95 y MB en móvil; el reposo es idéntico bit a bit.

### Plan MÍNIMO: vida sin cambiar el arte (1 semana, 0 a 30 USD)

- Hitos: suelo en teselas WebP con service worker; tinte día/noche con piso de 55 %; nubes con sombra; olas de 4 cuadros; apagón y Catatumbo como eventos.
- Aceptación: p95 de cuadro bajo 12 ms en el prototipo y 50 fps o más en el móvil medio; peso total no mayor que el actual más 20 %; casillas legibles de noche; cero assets sin licencia anotada.
- Riesgo: el estilo sigue siendo procedural; mejora la vida, no el oficio.
- Decisión del dueño al cierre: basta con "más vivo", o se pasa al salto de arte.

### Plan RECOMENDADO: salto de arte con dirección A (3 a 4 semanas más, 50 a 300 USD)

- Hitos: piloto de 3 días (Ávila de tres maneras); luego de 12 a 15 hitos, luego hasta 40 a 60 si el piloto pasa; capa de detalle visible solo con zoom mayor a 0,8, dentro del presupuesto de teselas (máximo 40 vivas); QA en 3 dispositivos.
- Aceptación: el dueño elige entre 3 capturas comparadas con las referencias a zoom 0,3 / 0,8 / 1,5; fps estable; carga inicial dentro del límite fijado; todo asset con origen y licencia; retoque humano documentado (selección, retoque y composición).
- Costes: Aseprite (pago único, unos 20 USD según rastreadores, precio actual no confirmado), Retro Diffusion (65 USD o 20 USD Lite, según informes, no confirmado), o Blender gratis; GPU alquilada solo si se usa un modelo grande. Total estimado 50 a 300 USD.

### Plan AMBICIOSO (8 o más semanas, 1.500 a 6.000 USD)

- Hitos: ilustrador humano por contrato para hoja de estilo y 5 piezas maestras; sonido por región; fauna; WebGL2 solo si la Fase 0 y el Plan Mínimo muestran que Canvas 2D no sostiene (spike de un único shader de agua y tinte, piso de 50 fps en Mali o Adreno real, con Canvas 2D de respaldo).
- Aceptación: al menos 10 jugadores prefieren a ciegas el mapa nuevo; contrato con cesión de derechos.
- Condición: solo si el mapa es un activo de marca. Una estimación con humanos de 6.000 a 15.000 USD es del productor, sin fuente publicada; los rangos de RocketBrush (2025) sí tienen fuente.

---

## 7) Riesgos y licencias

Contradicciones entre informes y cómo las resolví:

- Ilustración pintada de IA (informes de IA y rendimiento) contra pixel art (Director de Arte): elijo pixel art. Pixelea mal con zoom, choca con el 16-bit que ya elegiste, no se anima por partes, y el copyright de salida pura de IA es dudoso. La ilustración sirve solo como guía de composición y paleta.
- WebGL primero (Artista técnico, informe inicial) contra WebGL condicional (su propio voto, Rendimiento, Producción): elijo condicional. No hay un solo fps medido en GPU móvil real; sincronizar un canvas WebGL con la cámara de zoom fraccionario tiene costes que se subestimaron.
- Silueta real de Venezuela (Cartógrafo, Blender) contra silueta estilizada: elijo la estilizada. La real no cabe en el tablero 4:3 y las 114 casillas ya están puestas. Natural Earth y relieve real quedan como guía opcional, no como arte ni como Fase 1.
- Blender para todo (informe de Blender) contra descartarlo (Productor): lo uso solo para hitos y solo si gana el piloto. Nadie lo instaló ni midió tiempos de render. Un PNG mejor no da vida; la vida viene de las capas.
- Mapas de normales con Laigter para todo el mapa: descartado. A zoom 0,3 un píxel de arte son 0,6 px de pantalla y no se lee; cuatro texturas del mismo tamaño serían 48 MB a 2000x1500. Los normales solo valdrían para hitos grandes.
- 35 ideas de vida contra 8 a 10: 15 en esta lista, y las primeras 10 son la primera ola.
- Tiempos de horneado (10,3 s, 13,7 s, 18,7 s contra presupuesto de 6 s): es ruido de la máquina y el horneado es offline; no pesa en la arquitectura. Sí conviene cachear por capa para iterar rápido.
- Tres fábricas de arte (Retro Diffusion/Blender, FLUX/Qwen-Layered, ilustración cortada en teselas): se elige UNA, la ganadora del piloto. Qwen-Image-Layered (modelo de unos 20B) queda descartado para este equipo: sin GPU grande y con bordes sucios.

Riesgos que siguen abiertos:

- No hay medición en móvil real (ni batería ni temperatura). Es el primer paso de la Fase 0.
- Memoria: un bitmap 4000x3000 son 48 MB (64 MB con mipmaps); decodificar siempre por teselas.
- Derechos de la salida de IA: la Oficina de Copyright de EE. UU. (Parte 2, enero 2025; es guía, no sentencia) concluye que lo generado solo con prompts no es protegible. Mitigación: base procedural propia más retoque y composición documentados.
- Coherencia de estilo entre sprites: paleta forzada y un solo modelo o semilla de estilo.
- Alcance que crece: se congela por hito, máximo 10 elementos en la primera ola.
- Legibilidad de casillas de noche: piso de 55 % y atenuado de caminos.
- Referencias: se desconoce qué herramienta y plan las produjo (si fue un plan gratuito, podrían ser no comerciales). No publicar recortes directos.

Licencias (estado):

| Herramienta/dato | Estado según los informes | Verificado |
|---|---|---|
| Natural Earth | Dominio público, sin atribución; un registro USDA dice copyright | Parcial; confirmar en naturalearthdata.com |
| Copernicus DEM | Gratis con atribución; cláusula comercial no leída | No; SRTM de NASA como alternativa, tampoco verificada |
| Blender | GPL; lo creado es del autor (blender.org/about/license) | Sí (por un especialista) |
| FLUX.2 klein 4B | Apache 2.0; la 9B y Kontext dev no comerciales | Fuente secundaria (ayuda de BFL), leer texto oficial |
| Retro Diffusion | Modelo no comercial; salida del usuario según el desarrollador | No; leer la licencia incluida antes de pagar |
| Midjourney | Uso comercial en planes de pago; sin indemnización; pruebas gratis CC BY-NC | Solo fuentes secundarias |
| Adobe Firefly | Indemnización más clara; calidad en pixel art desconocida | No probado |
| Aseprite | Permite arte comercial; no se redistribuye el programa | FAQ citada; precio no confirmado |
| Krita | GPL 3; el arte es del usuario | Sí (página oficial) |
| LDtk, Tiled, PixiJS, Phaser, Howler.js, LibreSprite, Kenney, OpenGameArt | MIT/libres de memoria | No verificado |
| Inkarnate | Uso comercial solo en plan Studio; precio actual no confirmado | Parcial |
| d3-geo, world-atlas | ISC | Sí (en node_modules) |
| Freesound | CC0 sin atribución; CC-BY con atribución; CC-BY-NC prohibido | Verificar por cada sonido |

Regla: nada entra al juego sin una fila en la tabla de origen y licencia. Atribución en los créditos para ESA/Copernicus y Natural Earth si se usan.

---

## 8) Qué hacer MAÑANA (3 pasos concretos)

1. Consigue un Android de gama media (el que tengas o puedas pedir prestado), conéctalo por cable y abre chrome://inspect. El agente QA corre el motor actual con 114 casillas y 4 fichas y anota fps medios, p95 de cuadro y MB. En paralelo, arregla los 12 bytes no deterministas del reposo.
2. Contesta una pregunta: con qué herramienta y qué plan se hicieron las dos imágenes de referencia (images/1.png y images/2.png). De eso depende si valen solo como inspiración o también como base.
3. Dale una hora al agente productor para traer los textos oficiales de licencia (Natural Earth, Retro Diffusion, BFL FLUX.2 klein, Copernicus) y abrir la tabla origen/licencia. Mientras tanto, otro agente arma la página de prueba de 2 días: nubes con sombra, tinte día/noche con piso de 55 % y apagón sobre el PNG actual.

Si el resultado pasa 50 fps con holgura, WebGL no hace falta. Si no, solo entonces se prueba un shader de tinte.

---

## 9) Fuentes

Los especialistas citaron las páginas siguientes; la mayoría de datos de precios y licencias viene de fuentes secundarias y debe confirmarse en la página oficial.

Verificadas directamente por los especialistas:
- https://rocketbrush.com/blog/2d-environmental-art-rates-costs-tips-things-to-consider (tarifas de arte 2D, 2025)
- https://legendlore.notion.site/Inkarnate-2-0-launches-December-8th-2ae2600493f181cea107c6bfc38d5005 (Inkarnate 2.0, promociones vencidas)
- https://www.aseprite.org/faq (arte comercial; precio dudoso)
- https://esotericsoftware.com/spine-purchase (precios de Spine)
- https://rive.app/blog/new-pricing (precios de Rive)
- https://terms.law/2026/01/15/midjourney-commercial-use-rights-complete-2026-guide/ (Midjourney, fuente secundaria)
- https://docs.protomaps.com/pmtiles/maplibre (PMTiles y MapLibre raster)
- https://www.naturalearthdata.com/about/terms-of-use (términos de Natural Earth)
- https://www.blender.org/about/license (licencia de Blender)
- https://arxiv.org/abs/2512.15603 (Qwen-Image-Layered)
- Datos medidos desde jsDelivr y npm (PixiJS 8.22.0, Phaser 4.2.1, Three r170, regl 2.1.1, Rive canvas 2.31) y PyPI (bpy 5.2.2, GPL-3.0, solo Python 3.13).

Citadas sin URL exacta y por confirmar: página de Retro Diffusion, ayuda de Black Forest Labs sobre FLUX.2 klein, licencia Copernicus DEM (PDF), HydroRIVERS, Gaea (Quadspinner), LDtk, Tiled, Laigter, PixelLab, Howler.js, Freesound, Oficina de Copyright de EE. UU. (Parte 2, enero 2025).

Pruebas internas reproducibles (no tocan el repo): banco SVG en `/private/tmp/claude-501/-Users-guillermomarin-Documents-GitHub-minigames/c18fd1c1-7307-4a61-958c-15bfe36fe90d/scratchpad/estudio/svg/run.mjs`; script de rendimiento del repo `docs/style-lab/pruebas/fiesta-tablero-perf.js`; captura del estado actual con `docs/style-lab/pruebas/fiesta-arte-png.js`.
