# LA FIESTA · prompts de traspaso (2026-10-17)

Tres prompts para tres agentes. Se pueden correr en paralelo salvo lo indicado en la sección «Orden y archivos».

## Estado actual (para los tres)

Hecho y probado: M0 (RNG, mapa de 114 nodos), M0.5 (reductor puro `fiesta-reglas.js` + CPU, `fiesta-net.js`, modo `fiesta` en el servidor PocketBase), M1 (director, cámara, tablero, lobby, UI, `fiesta-main.js`, e2e con 2 navegadores reales). `node --test test/fiesta-*.test.js` pasa 100/100; `node test/fiesta.e2e.js` pasa.
Pendiente: M2 (minijuegos en vivo), M3-M6. Los archivos `docs/style-lab/fiesta-vs.js`, `vs.html`, `juegos-vs-lista.js`, `juego-f-*.js` y `pruebas/vs-probar.js` son borradores OBSOLETOS de «misma pantalla»: no usarlos como contrato.
Los archivos `mapa-ilustrado.html`, `mapa-referencias.html`, `mapa-tablero.*` y `assets/venezuela-board/` son experimentos de OTRA sesión que al usuario no le gustaron: no tocar.
No hacer commits salvo que el usuario lo pida. La rama actual es `codex/mobile-controls-easter-eggs` con muchos cambios previos sin commitear.

---

## PROMPT 1 · Continuar el núcleo: M2, minijuegos en vivo (runtime + 3 primeros juegos)

```
Eres el ingeniero principal de LA FIESTA, un modo tipo Mario Party para 2-4 jugadores EN LÍNEA y EN TIEMPO REAL (cada quien en su dispositivo; sin pantalla compartida, sin fantasmas) sobre un mapa gigante de Venezuela, dentro del mundo Venezuela del repo /Users/guillermomarin/Documents/GitHub/minigames (carpeta docs/style-lab, backend PocketBase en pocketbase/pb_hooks, mismo origen).

LEE PRIMERO, en este orden: docs/mario-party/HANDOFF.md (estado), 07-multijugador-online.md (arquitectura maestra; §2.1 glosario canónico manda en cualquier conflicto), 09-netcode-realtime.md (netcode), 08-minijuegos-realtime.md (contrato y catálogo), y los archivos docs/style-lab/fiesta-reglas.js, fiesta-net.js, fiesta-main.js, fiesta-director.js, pocketbase/pb_hooks/party.js y party_routes.js.

TU TAREA = hito M2 del doc 07 §10:
1. Runtime de minijuegos en vivo: docs/style-lab/fiesta-live.js con FIESTA.LIVE.add(id, def) según el contrato del doc 08 (ctx c: yo, ahora, rng/rngFor/fx, held/tap/eje, esJuez, send/on, remoto, claim, out; g: update/draw/scores/fin/ai y pack/unpack/restore/predict para el modelo C). Modelos de red A (cancha propia), B (dueño+juez), C (el juez simula) y Ceq. NO lockstep. Mensajes ≤420 B, cuentas acumulativas para los toques, un `o` por emisor.
2. Flujo completo en cliente: ruleta de formato (4P/2v2/1v3 por color de casillas), tarjeta de instrucciones con controles + PRÁCTICA + ¡LISTO!, elección de juez, sincronía de reloj (startAt del servidor), cuenta 3-2-1, juego, podio, pago de monedas (FIESTA.reglas.pagosMJ) y regreso al tablero sin desincronizar el director.
3. Servidor: rama `fiesta` en sigPayload (antes del chequeo state!=='round'; scopes 'b' y 'm:<k>'; tipos x* permitidos en 'm'), rutas mjfin y mjack reales (hoy devuelven 501), validación de topes por juego (scoreMax/scoreRate/minT), caché de relay con invalidación tras commit, presencia por heartbeat HTTP en $app.store(), migración del juez por CAS (ya existe la ruta `juez`), límites de tasa en una migración nueva. Mantén el código compartido compatible con Goja (ES2015, sin ?. ?? spread de objetos async clases privadas).
4. Tres juegos de la rebanada vertical, uno por modelo de red: f_mecate (A), f_domino (B), f_harina (C o Ceq), siguiendo sus fichas del doc 08 (reglas, puntaje, CPU, niveles 1-3, gag venezolano). Dibujar SOLO con las primitivas del laboratorio (rr, ell, line, poly, txt, bust, BUS.AP.CAST) para que salgan en los 6 estilos.
5. Pruebas (todas automatizadas, estilo test/squad.test.js con un memRelay con retardo, jitter y 5% de pérdida; ya existe test/helpers/mem-relay.js): mismos puestos en todas las pantallas a 50/150/300 ms; exactamente un juez; juez muerto en un k aleatorio ⇒ un solo veredicto; asiento caído ⇒ CPU; ningún tipo reservado reutilizado; presupuesto req/s; resultados dentro de bounds; humanos inactivos no ganan a CPU activas. Más un e2e Playwright con 2-3 contextos (extiende test/fiesta.e2e.js o crea test/fiesta-mj.e2e.js): el «¡YA!» con <100 ms de diferencia entre pantallas y el mismo podio. Para correr PocketBase real usa test/helpers/pb-harness.js.

REGLAS: no rompas lo que ya pasa (node --test test/fiesta-*.test.js, test/duo.test.js, test/squad.test.js, test/party*.test.js, node pocketbase/pb_hooks/party.test.js, node test/fiesta.e2e.js). No toques los archivos de UI de pulido (fiesta-lobby.js, fiesta-ui.js) salvo lo estrictamente necesario para enchufar la tarjeta/podio, y si lo haces anótalo. No uses los borradores obsoletos fiesta-vs.js / vs.html / juego-f-*.js (puedes portar ideas). Sin Math.random en lógica de juego (usa c.rng). Sin commits. Mira capturas con Read y corrige problemas visuales. Informa con honestidad qué corre, qué no y qué decisiones quedan abiertas (pregunta al usuario solo lo que no se pueda decidir con los docs).
```

---

## PROMPT 2 · Pulir UI, lobby y personajes

```
Eres diseñador/ingeniero de interfaz de LA FIESTA (modo tipo Mario Party en línea, mundo Venezuela del repo /Users/guillermomarin/Documents/GitHub/minigames, docs/style-lab). El hito M1 ya funciona (lobby, selección de personaje, tablero en vivo, HUD, prompts) pero es la versión «gris jugable». Tu trabajo es llevarla a una experiencia pulida y divertida, lo más cercana posible a Mario Party, sin romper la sincronía en tiempo real.

LEE PRIMERO: docs/mario-party/HANDOFF.md, 07-multijugador-online.md §5, §7 y §8 (UX en vivo, lobby, personajes, toma de asiento, reconexión), y los archivos docs/style-lab/fiesta-lobby.js, fiesta-ui.js, fiesta-tablero.js, fiesta-camara.js, fiesta-main.js, fiesta-director.js, fiesta-reglas.js (PERSONAJES, FX_MS). Mira las capturas existentes en docs/style-lab/pruebas/out/fiesta-*.png (lobby, lobby-movil, tablero-salto, prompt-B, vertical, afk, estilos).

ARCHIVOS TUYOS: fiesta-lobby.js, fiesta-ui.js, fiesta-tablero.js (solo apariencia), fiesta-camara.js (solo sensación de cámara), test/fiesta-ui.test.js, y nuevos assets/archivos de arte bajo docs/style-lab/assets/fiesta/. NO modifiques fiesta-reglas.js, fiesta-net.js, fiesta-director.js, el servidor ni los minijuegos (otros agentes trabajan ahí). Si necesitas un dato nuevo del estado, pídelo en tu informe en vez de cambiar el reductor.

QUÉ MEJORAR (prioriza y pregunta solo lo imprescindible):
1. Lobby: más fiesta (animaciones de entrada de jugadores, sonidos, avatares que reaccionan, código de sala y botón de invitar claros, estados de «listo», expulsar/ceder anfitrión, chat rápido/emotes, indicador de conexión), versión móvil vertical y horizontal impecable (zonas táctiles ≥44 px, sin solapes), teclado y mando.
2. Personajes: los 8 de PERSONAJES (tu, mama, abuela, tio, pana, prima, cobrador, portu) con poses/estados de ánimo (celebrar, perder, esperar, hablar), una frase corta distinta por personaje (tono venezolano, ligero y sin ofender), pantalla de selección tipo Mario Party (grande, con previsualización animada, rasgo/gimmick visible si el reductor lo define, orden de elección claro) y consistencia entre lobby, tokens del tablero, tarjetas del HUD y podio.
3. Tablero y HUD: legibilidad de casillas (iconos por tipo, leyenda), etiquetas de región que no choquen con fichas ni dados (hoy «CARACAS (HUB)» queda detrás del dado), fichas apiladas en una casilla con abanico claro, cámara con seguimiento suave y vistas «mapa completo», animaciones de dado/monedas/estrella más jugosas con partículas, banner de turno, temporizador visible, panel de prompts consistente (dado, ruta, tienda, estrella, objetivo, usar objeto), toasts y log, pantalla final con estrellas bonus y podio.
4. Los 6 estilos de arte del laboratorio (snes, felt, ww, anime, tinta, garabato) deben verse bien en todas las pantallas; comprueba al menos 3 y revisa también modo vertical y móvil pequeño (360x640 y 932x430).
5. Rendimiento: 60 fps en un móvil medio (capa estática en caché, culling), sin parpadeos.

CÓMO VERIFICAR: node --test test/fiesta-*.test.js (debe seguir 100/100), node test/fiesta.e2e.js (levanta PocketBase real y dos navegadores Chrome; genera capturas en docs/style-lab/pruebas/out/). Lee las capturas con Read y corrige lo que se vea mal; no declares terminado sin haberlas mirado. Sin commits. Sin Math.random para lógica (solo cosmético). Informa qué cambió, con capturas antes/después, y qué queda.
```

---

## PROMPT 3 · Continuar con el catálogo de minijuegos

> Empezar cuando el Prompt 1 haya entregado `fiesta-live.js` y los 3 primeros juegos (o trabajar en paralelo solo la parte de diseño y los modelos A, que dependen del mismo contrato).

```
Eres el diseñador-programador de minijuegos en vivo de LA FIESTA (modo tipo Mario Party en línea, mundo Venezuela del repo /Users/guillermomarin/Documents/GitHub/minigames, docs/style-lab). Tu trabajo es construir el catálogo de minijuegos multijugador en tiempo real, con calidad de Mario Party, humor venezolano ligero y sin ofender.

LEE PRIMERO: docs/mario-party/HANDOFF.md, 08-minijuegos-realtime.md (roster de 24 juegos + 3 retos épicos, contrato FIESTA.LIVE.add, flujo de tarjeta/cuenta atrás/podio, tabla de monedas, checklist por juego), 09-netcode-realtime.md (modelos A/B/C, mensajes, presupuesto), 04-minijuegos-y-final.md, y el código del runtime: docs/style-lab/fiesta-live.js y los tres juegos de la rebanada (f_mecate, f_domino, f_harina) como plantillas. Para el estilo de dibujo mira docs/style-lab/juego-tranca.js, juegos-bus.js (BUS.AP.CAST, FACES, bust(), hand(), limb(), PT/say) y engine.js. Si fiesta-live.js aún no existe, espera o coordina: NO inventes otro contrato.

TAREA: construir en oleadas, cada juego como UN archivo docs/style-lab/juego-f-<id>.js (más su bot/prueba), en el orden de 08 §10: primero los juegos 4-6 de la rebanada (f_chancla, f_patilla, f_futbolito), luego las oleadas siguientes del catálogo: 8 de ranking 4 jugadores, 6 de supervivencia, 5 de 2v2, 5 de 1v3 (con perilla de balance del solitario, objetivo 38-52% de victorias del solo) y los 3 retos épicos (Catatumbo, Salto Ángel, Deltamacura; 60-120 s con fases). Cada juego: controles táctiles y de teclado de 1-2 botones o joystick virtual, niveles 1-3, CPU que juega de verdad (el juez simula a las CPU), escena y gag venezolano, duración 25-60 s (retos más largos), puntaje comparable y aditivo para 2v2/1v3, resultado dentro de bounds (scoreMax/scoreRate/minT) y registro en el catálogo del servidor (dur, modelo, tipo, bounds) tal como indica el doc 07/08 (si el catálogo es un archivo compartido, edítalo solo en tus líneas y avisa).

POR CADA JUEGO, antes de darlo por hecho (checklist de 16 puntos del doc 08): mismos puestos en todas las pantallas a 50/150/300 ms con 5% de pérdida (memRelay), juez muerto a mitad ⇒ un solo veredicto, asiento caído ⇒ CPU, presupuesto de bytes y mensajes, tipos reservados respetados, ventaja del juez ≤ 1/n + 8 pp con bots de igual habilidad en 200 semillas, 1v3: solo 38-52%, se dibuja en al menos 3 estilos, captura revisada con Read (sin solapes con el reloj ni los controles). Prueba rápido con un banco headless por juego y pasa luego la suite de fiesta-live.

REGLAS: un archivo por juego, no edites el runtime ni el servidor salvo para registrar el catálogo (si necesitas cambiar el contrato, detente y pregúntalo). Dibuja SOLO con las primitivas del laboratorio para que salga en los 6 estilos. Sin Math.random en lógica (usa c.rng). No uses los borradores obsoletos juego-f-*.js de «misma pantalla» como base (puedes reciclar ideas de arte). No commits. Ritmo: construye de a una oleada, informa con tabla (juego, modelo, modos, resultado de pruebas, captura) y espera visto bueno del usuario antes de la siguiente oleada. El usuario prefiere construir rápido y revisar él mismo: no hagas revisión adversarial extensa, pero sí corre las pruebas automáticas.
```

---

## Orden y archivos (para evitar choques)

| Agente | Archivos propios | No tocar |
|---|---|---|
| 1 · Núcleo M2 | `fiesta-live.js`, `fiesta-main.js` (enchufes), `pocketbase/pb_hooks/party*.js`, migración nueva, `juego-f-mecate/domino/harina.js`, tests de live | `fiesta-lobby.js`, `fiesta-ui.js` (salvo enchufe mínimo) |
| 2 · UI | `fiesta-lobby.js`, `fiesta-ui.js`, `fiesta-tablero.js`, `fiesta-camara.js`, `assets/fiesta/` | reductor, red, director, servidor, minijuegos |
| 3 · Juegos | `juego-f-*.js` nuevos (menos los 3 del agente 1), bots/pruebas por juego, líneas de catálogo | runtime, servidor, UI |

Conflictos probables: `fiesta-main.js` (agentes 1 y 2) y el catálogo del servidor (agentes 1 y 3). Regla: el agente 1 es dueño de `fiesta-main.js`; el agente 2 pide cambios de integración en su informe; el agente 3 solo añade líneas al catálogo.

---

## Nota · Área 6, fase 2 (economía v2, 2026-10-17)

`fiesta-reglas.js` ya trae **dos estrellas simultáneas** y la economía v2: `S.estrella={nodo,b,precio}` (`b` null con `cfg.estrellas===1`), helper `estrellasEn(S)`, `vista.estrellas`, y el fx `estrellaMueve` lleva `i` (0 = `nodo`, 1 = `b`). Precio 10, 20 monedas iniciales, azul +4, pago FFA 14/9/5/2, Bono de la Abuela = mitad. El bonus final sigue con 3 categorías (decisión del dueño). UI y CPU deben leer `estrellasEn`/`vista.estrellas` en vez de asumir una sola estrella. Detalle y números en `05` apéndice A.
