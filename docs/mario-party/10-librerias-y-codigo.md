# 10 · Librerías y código ajeno: qué adoptar, qué copiar y qué saltar

> **Nota (2026-10-17):** este documento recomienda minijuegos «en paralelo con fantasmas» como v1. Esa parte queda **retirada** por decisión del usuario: los minijuegos son en vivo e interactivos desde el inicio (ver docs 07-09). Siguen vigentes los veredictos de librerías: no adoptar servidor nuevo, reductor propio, TURN, interpolación de snapshots, mapa Natural Earth y activos CC0.


Fecha: 2026-10-17. Complementa `07-multijugador-online.md` (arquitectura) y `06-plan-implementacion.md` (hitos). Pregunta del usuario: *«revisa librerías y código en línea para hacer esto más fácil»*.

**Respuesta corta:** no hay ningún «Mario Party web» de código abierto que se pueda reutilizar, y ninguna librería de red encaja en PocketBase sin añadir un segundo servidor. La ruta con menos trabajo propio es **seguir con PocketBase y lo que ya hay** (salas, SSE, `sig`, `link.js`), **copiar el diseño de boardgame.io** para el tablero, **añadir TURN**, **adoptar solo una librería pequeña** (snapshot-interpolation) cuando lleguen los minijuegos interactivos, y **dejar Colyseus como plan B medido** con una prueba de un día. Lo que de verdad ahorra trabajo no es una librería: es jugar los minijuegos **en paralelo con la misma semilla** (doc 07, §2.6), porque así casi ninguno necesita netcode en tiempo real.

Los datos marcados *(por verificar)* no se comprobaron en esta investigación.

---

## 0. Punto de partida (lo que ya resuelve el repo)

| Necesidad | Ya existe | Archivo |
|---|---|---|
| Salas, código de 4 letras, invitados sin cuenta, enlace `/r/ABCD` | Sí | `pocketbase/pb_hooks/party.js`, `party_routes.js` |
| Autoridad del servidor, semilla, mazo oculto en `rooms.keys` | Sí | `party.js:157-180,309-324` |
| Empuje en vivo | SSE de PocketBase + temas propios vía `$app.subscriptionsBroker()` (`rooms/<id>/sig`, `/vsig`) | `party_routes.js:98-120` |
| Relé efímero | `sig`: ≤10 msg por llamada, 512 B (64 KB en modos por turnos) | `party.js:396,552` |
| P2P | `link.js` (123 líneas): malla de hasta 3 pares por jugador (4 jugadores), canal `f` no ordenado `maxRetransmits:0` + canal `r` fiable, ofertante determinista, búfer de ICE temprano, reintentos, ping/RTT, caída a relé | `js/link.js` |
| ICE configurable | `rtcIceServers()` lee `window.CLAUDEWARE_ICE_SERVERS`; hoy solo STUN de Google, **sin TURN** | `js/voice.js:7-9` |
| Reglas puras y RNG sembrado | `fiesta-reglas.js` (UMD, `aplicar(S,accion)`), `fiesta-rng.js`, mapa de 114 casillas | `docs/style-lab/fiesta-*.js` |
| Motor y ~70 microjuegos | Motor canvas propio, BUS, 6 estilos, banco de pruebas sin navegador | `docs/style-lab/engine.js`, `pruebas/probar.js` |

Conclusión: el «framework» que ofrecen las librerías ya está a medio construir aquí. Faltan tres cosas: **reductor por acciones con vista privada por jugador**, **TURN**, y **suavizado/predicción** para los pocos minijuegos interactivos.

---

## 1. Tabla comparativa

Leyenda: ✅ encaja · ⚠️ encaja con costo · ❌ no encaja.

| Candidato | Licencia | Mantenimiento | ¿Corre en PocketBase/Goja? | Servidor extra | Cliente sin build | Tablero por turnos + info oculta | Minijuegos 20-30 Hz | Reconexión / CPU que toma un humano | Invitados | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|
| **boardgame.io** 0.50.2 | MIT | ⚠️ última versión 2022-11-10; commits recientes = bumps de dependencias | ❌ (Master necesita Node: Koa + socket.io) | Contenedor Node | ✅ UMD en cdnjs (155 KB min) *(funcionamiento en móvil por verificar)* | ✅ fases, turnos, `playerView`, bots MCTS | ❌ sin bucle de tick | ✅ credenciales + resync / cambiar `playerID` | ✅ | **Copiar ideas** |
| **Colyseus** 0.18.x (`@colyseus/sdk` 0.18.5) | MIT | ✅ muy activo (0.18.19 el 2026-10-16), pre-1.0 con cambios incompatibles en cada menor | ❌ (Node) | Contenedor Node + ruta WS en Traefik | ⚠️ `dist/colyseus.js` ~222 KB sin minificar; nombre global/ESM *(por verificar)* | ✅ Room + vistas por cliente *(API 0.18 por verificar)* | ✅ tick fijo, `patchRate` 50 ms, delta binario | ✅ `allowReconnection`, `onDrop/onReconnect` | ✅ `onAuth` opcional | **Plan B (prueba de 1 día)** |
| **PartyServer / PartySocket** (Cloudflare Durable Objects) | ISC / MIT | ✅ Cloudflare; partyserver 0.5.10 (pre-1.0) | ❌ | Cloudflare Workers (o celld, experimental + S3) | ✅ partysocket UMD/ESM | ✅ | ✅ | ✅ | ✅ | **Saltar** (no autoalojable hoy, pago por uso, segundo despliegue con wrangler) |
| **Nakama** 3.41.0 | Apache-2.0 | ✅ | ❌ (Go + Postgres) | Binario Go + Postgres | ⚠️ `nakama-js` ~1 MB | ✅ | ✅ | ✅ | ✅ device-id | **Saltar** (duplica PocketBase, pesado para VPS chico) |
| **Playroom Kit** 0.0.97 | ❓ sin licencia en npm, código cerrado | ⚠️ 0.0.x | ❌ | Su nube (pago) | ⚠️ ESM 3,8 MB con React | ⚠️ host autoritativo | ⚠️ sin garantías | ⚠️ | ✅ | **Saltar** |
| **Trystero** 0.26.0 | MIT | ✅ | n/a (solo cliente) | Relés públicos Nostr/torrent/MQTT | ⚠️ solo ESM | ❌ sin autoridad | ⚠️ canales fiables por defecto, sin canal «último gana» | ❌ | ✅ | **Saltar** (`link.js` ya lo hace mejor) |
| **PeerJS** 1.5.5 / **simple-peer** 9.11.1 | MIT | ❌ estancados (2025-06 / 2022) | n/a | PeerJS necesita peerjs-server | ⚠️ | ❌ | ⚠️ | ❌ | ✅ | **Saltar** |
| **geckos.io** 3.1.0 | BSD-3 | ⚠️ | ❌ (Node) | Node + rango de puertos UDP (Traefik no lo enruta) | ✅ | ❌ | ✅ UDP real | ❌ | ✅ | **Saltar** (copiar ajustes de canal no fiable, ya copiados en `link.js`) |
| **@geckos.io/snapshot-interpolation** 1.1.1 | BSD-3 | ⚠️ estable, última 2025-02 | n/a (cliente, sin transporte) | Ninguno | ✅ `bundle/…js`, global `Snap` *(por verificar)* | n/a | ✅ interpolación de instantáneas | n/a | n/a | **Adoptar en M5** |
| **netplayjs** 0.4.1 | ISC | ❌ sin mantenimiento (2023) | n/a | PeerJS | ❌ necesita build | ❌ | ⚠️ rollback 2 jugadores | ❌ | ✅ | **Copiar ideas** (rollback para duelos) |
| **Lance.gg** | Apache-2.0 | ❓ frescura dudosa | ❌ (Node) | Node | ⚠️ | ❌ | ✅ predicción/interpolación | ⚠️ | ✅ | **Leer como referencia** |
| **Yjs / Automerge** (CRDT) | MIT | ✅ | n/a | — | ✅ | ⚠️ sin autoridad ni secretos | ❌ | ⚠️ | ✅ | **Saltar** |
| **Rapier** (`@dimforge/rapier2d-compat`) | Apache-2.0 | ✅ *(fecha por verificar)* | n/a | — | ✅ archivo único con WASM en base64 | n/a | ✅ física determinista (lockstep/rollback) | n/a | n/a | **Saltar por ahora** (solo si un minijuego físico lo exige) |
| **Phaser 4 / KAPLAY / PixiJS** | MIT | ✅ | n/a | — | ✅ | n/a | ❌ no aportan red | n/a | n/a | **Saltar** (reescribir ~70 microjuegos) |
| **Matter.js / Planck.js** | MIT / MIT *(por verificar)* | ✅ *(por verificar)* | n/a | — | ✅ | n/a | ⚠️ Matter no es determinista | n/a | n/a | **Saltar** |
| **coturn** (TURN propio) | BSD-3 *(por verificar)* | ✅ | n/a (servicio aparte, sin HTTP) | Contenedor con UDP 3478 + rango de relé, TCP/TLS 443 o 5349 | n/a | n/a | ✅ hace que la malla funcione en CGNAT | n/a | ✅ credenciales HMAC efímeras | **Adoptar (o Cloudflare TURN)** |
| **Cloudflare Realtime TURN** | Servicio | ✅ | n/a | Ninguno propio; 1000 GB/mes gratis, luego 0,05 USD/GB *(por verificar)* | n/a | n/a | ✅ | n/a | ✅ | **Alternativa a coturn** |
| **Natural Earth admin-1** (10m) | Dominio público | ✅ | n/a | — | Se convierte a SVG/JSON fuera de línea | n/a | n/a | n/a | n/a | **Adoptar** |
| **geoBoundaries ADM1** | CC BY 4.0 | ✅ | — | — | — | — | — | — | — | **Respaldo** (que incluya VEN *por verificar*) |
| **Wikimedia Commons** (mapas de Venezuela) | CC BY-SA 3.0/4.0 | — | — | — | — | — | — | — | — | **Solo referencia** (share-alike) |
| **Freesound** (cuatro, maracas, joropo, gaita) | Por sonido: CC0 / CC-BY / CC-BY-NC | — | — | — | — | — | — | — | — | **Adoptar solo CC0 (o CC-BY con crédito)** |
| **Kenney** (UI, iconos, banderas) | CC0 *(por verificar en cada paquete)* | — | — | — | — | — | — | — | — | **Relleno genérico** |
| **R. Mocci «pixel special»** (bandera pixel) | Sin licencia escrita *(por verificar)* | — | — | — | — | — | — | — | — | **No usar sin licencia escrita** |
| **SuperTuxParty** (Godot) | GPL probable *(por verificar)* | — | — | — | — | — | — | — | — | **Solo referencia de diseño** |
| **Super Mario Wiki** | CC BY-SA (texto) | — | — | — | — | — | — | — | — | **Referencia de reglas**; no copiar nombres, arte ni prosa |
| **Decomps mariopartyrd** | Derivado de Nintendo | — | — | — | — | — | — | — | — | **Evitar** |

---

## 2. Recomendación

### Principio

**Una sola autoridad: el hook de PocketBase. Un solo origen. Cero servidores nuevos hasta que una prueba medida diga lo contrario.** Las librerías grandes (boardgame.io, Colyseus, Nakama, PartyKit) resuelven bien el problema, pero todas exigen otro proceso (Node, Go o Cloudflare) y portar la lógica que ya existe en `party.js`. Para 2-4 amigos en una partida de 30-60 min, el costo de ese segundo backend (despliegue, autenticación puente, dos fuentes de verdad) es mayor que lo que ahorra.

### Construir o comprar, por área

| Área | Veredicto | Qué se hace | Por qué |
|---|---|---|---|
| **(a) Estado del tablero y lógica de turnos** | **Construir, copiando el diseño de boardgame.io** | `fiesta-reglas.js` como reductor puro `aplicar(S, accion, ctx)` con `moves`, fases y orden de turno al estilo bgio; `vista(S, asiento)` como `playerView` que quita objetos ajenos, mazo y «Chance»; número `ver` para resync (409 si no coincide). Corre en el hook (Goja), en el navegador (animar/predecir) y en Node (simulador). | bgio no puede correr su Master en Goja y lleva 4 años sin versión. Su idea central son ~300 líneas, y el repo ya tiene el esqueleto UMD y el RNG sembrado. |
| **(b) Lobby, elegir personaje, CPU que toma un humano** | **Construir sobre el lobby existente** | Reutilizar salas/códigos/invitados de `party.js`. Asiento = `{id, cpu:bool, personaje}`; tomar un asiento CPU = acción `TOMAR_ASIENTO` validada en el hook. La CPU decide con funciones heurísticas escritas a mano (no MCTS). Ideas de API copiadas de Playroom (traspaso de host, `addBot`, estado por jugador). | El 80 % ya existe (código, enlace, invitados, límite de 4). Falta reentrada y asientos CPU, que son lógica de dominio que ninguna librería trae hecha. |
| **(c) Netcode de minijuegos en tiempo real** | **Construir poco + adoptar una librería pequeña; Colyseus como plan B** | **v1:** minijuegos en paralelo con misma semilla, resultado por `report`, rivales como fantasmas (`party-ghost.js`). Sin netcode nuevo. **v2 (M5):** el anfitrión (o un rol «juez») simula; entradas a 20-30 Hz por `link.js` canal `f`, instantáneas a 20 Hz, cliente con `@geckos.io/snapshot-interpolation` (búfer 100-150 ms) y predicción local escrita a mano (~30 líneas). Caída a `sig` si un par no conecta. **Plan B:** si la prueba en móviles reales falla (ver §3 paso 6), un contenedor Colyseus solo para minijuegos interactivos. | La mayoría de los formatos (FFA, 2v2 por suma, 1v3 contra la media) se resuelven comparando resultados, sin red en vivo. Para los pocos interactivos, `link.js` ya tiene la forma correcta de canal; le falta TURN y suavizado, no un framework. |
| **(d) Física / motor** | **Mantener el motor propio** | Seguir con `engine.js` + BUS. Rapier solo si un minijuego interactivo necesita física idéntica en todos (lockstep). | Phaser/KAPLAY obligan a reescribir ~70 microjuegos y el sistema de estilos, y no aportan red. Con autoridad del anfitrión no hace falta determinismo de física. |
| **(e) TURN / NAT** | **Comprar o autoalojar, sin tocar código de librerías** | Ruta `GET /api/party/ice` en `pb_hooks` que emite credenciales efímeras (coturn: `usuario = <expira>:<id>`, `clave = base64(HMAC-SHA1(secreto, usuario))`). El cliente asigna `window.CLAUDEWARE_ICE_SERVERS` antes del primer `link`/voz. Orden: `stun`, `turn:…:3478?transport=udp`, `turns:…:443?transport=tcp`. | Es el cambio de mayor valor. En datos móviles (CGNAT) entre 10 y 25 % de conexiones necesitan TURN (cifras de blogs de proveedores, no medidas aquí). `rtcIceServers()` ya está preparado. |
| **(f) Mapa SVG de Venezuela** | **Adoptar datos (Natural Earth), construir el SVG** | Descargar admin-1 10m de Natural Earth, filtrar `adm0_a3 = VEN`, simplificar con mapshaper (herramienta local, no se publica) y exportar SVG/GeoJSON proyectado. Guardar los `path` por estado junto al grafo de casillas en `fiesta-mapa-venezuela.js` (JSON propio; no hace falta Tiled ni parser). | Dominio público, sin obligación de atribución. Sustituye la silueta dibujada a mano por una precisa y con estados. |
| **(g) Arte y audio** | **Construir el arte; audio CC0 seleccionado a mano** | Arte original en los 6 estilos ya elegidos. Audio: Freesound con filtro CC0 (cuatro, maracas, tambor, llanera, gaita); CC-BY solo con crédito en `/terms`. Kenney (CC0) para iconos/UI de relleno. Guardar licencia y URL de cada archivo en un `CREDITOS.md`. | No existe un paquete de arte venezolano con licencia clara. Nada de nombres, arte ni audio de Nintendo. |

### Qué saltar y por qué (resumen)

- **boardgame.io como dependencia:** su servidor es Node y está sin versiones desde 2022. Se copian las ideas.
- **PartyKit / Durable Objects:** no se puede autoalojar hoy (celld es experimental y pide S3), tiene costo por uso y un segundo despliegue con wrangler.
- **Nakama:** trae su propio Postgres, cuentas y tablas de puntaje, lo que duplica PocketBase.
- **Playroom Kit:** código cerrado, licencia desconocida y depende de su nube.
- **Trystero, PeerJS, simple-peer:** `link.js` ya hace lo mismo con señalización propia y un canal no fiable. Ninguna de ellas resuelve NAT.
- **geckos.io (servidor):** necesita un rango de puertos UDP que Traefik/Dokploy no enruta.
- **CRDT (Yjs, Automerge):** no tienen autoridad ni secretos.
- **Phaser, KAPLAY, Pixi:** obligarían a reescribirlo todo sin aportar red.
- **Decomps de Mario Party, SuperTuxParty (código) y repos «Mario Party clone» sin licencia:** riesgo legal.

---

## 3. Plan de integración (orden)

| # | Paso | Hito | Esfuerzo |
|---|---|---|---|
| 1 | **Reductor por acciones** en `fiesta-reglas.js` (`TIRAR`, `ELEGIR_RUTA`, `COMPRAR`, `USAR`, `PASAR`, `TOMAR_ASIENTO`) + `vista(S, asiento)` + `ver`. Pruebas: 1000 partidas de 4 CPU sin estado inválido. | M0.5 | 2-3 días |
| 2 | **Cargarlo en Goja.** Copiar `fiesta-rng.js`, `fiesta-reglas.js` y `fiesta-mapa-venezuela.js` a `pocketbase/pb_hooks/` en el Dockerfile o en `sync-world-assets.sh`, y cargarlos con `require(\`${__hooks}/…\`)`. Que Goja acepte el UMD tal cual está *(por verificar)*: hacer una prueba con `party.test.js`. | M1 | 0,5 días |
| 3 | **Modo `fiesta`** en el servidor: rutas `act`, `mine` y `commit`, reentrada con id+clave en cualquier estado y reanudación al recargar (localStorage). Para lo privado, preferir la ruta `mine` (pull autenticado) antes que un tema SSE `rooms/<id>/p/<asiento>`: cualquiera que conozca el nombre de un tema puede suscribirse, salvo que el hook filtre por cliente o que el nombre lleve un hash secreto *(por verificar)*. | M1 | 3-4 días |
| 4 | **TURN.** Ruta `/api/party/ice` más coturn o Cloudflare TURN, y probar con `iceTransportPolicy:'relay'` en una compilación de prueba y con un hotspot móvil. Mostrar `DIRECT`/`RELAY` (ya existe `linkLabel()`) y añadir `getStats()` para detectar `candidateType:'relay'`. | M1-M2 | 1 día |
| 5 | **Minijuegos en paralelo** (misma semilla, agrupación 2v2/1v3 en `finishRound`). Sin dependencias nuevas. | M2 | según juegos |
| 6 | **Prueba de netcode interactivo** con un FFA de recoger monedas a 30 Hz sobre `link.js` + snapshot-interpolation, con 4 teléfonos reales (uno en datos móviles). Criterio: jugable con 150 ms y menos de 5 % de caídas a relé. **Si falla**, una prueba de 1 día con Colyseus en `wss://minicaos.guille.tech/ws` (contenedor aparte, `PathPrefix(/ws)` en Traefik) antes de decidir. | M5 | 2 días (+1 si hay plan B) |
| 7 | **Mapa** desde Natural Earth y **audio** CC0 con `CREDITOS.md`. | M4 | 1-2 días |

### Qué se pone en `js/vendor/` (y cuándo)

| Archivo | Versión | Origen | Licencia | Cuándo | Nota |
|---|---|---|---|---|---|
| `js/vendor/snapshot-interpolation.js` | 1.1.1 | `https://unpkg.com/@geckos.io/snapshot-interpolation@1.1.1/bundle/snapshot-interpolation.js` | BSD-3-Clause | M5 (paso 6) | Global `Snap` *(por verificar)*. Copiar el archivo LICENSE al lado. |
| `js/vendor/colyseus.js` | `@colyseus/sdk` 0.18.5 | `https://cdn.jsdelivr.net/npm/@colyseus/sdk@0.18.5/dist/colyseus.js` | MIT | **Solo si** el paso 6 activa el plan B | Comprobar si expone `Colyseus` global o si es ESM *(por verificar)*. Fijar la misma versión menor que el servidor (`colyseus` 0.18.x). |
| `js/vendor/rapier2d-compat.js` | *(versión por verificar)* | `https://cdn.jsdelivr.net/npm/@dimforge/rapier2d-compat@<versión>/rapier.js` *(ruta del archivo por verificar)* | Apache-2.0 | **Solo si** un minijuego necesita física en lockstep | No ahora. |
| *(ninguno)* boardgame.io | — | `https://cdnjs.cloudflare.com/ajax/libs/boardgame-io/0.50.2/boardgameio.min.js` | MIT | No | Se leen la documentación y el código para copiar ideas (`secret-state.md`, `multiplayer.md`). |

Fuera de `js/vendor` (datos o servicios, no código del cliente):

- Natural Earth `ne_10m_admin_1_states_provinces` (dominio público): https://www.naturalearthdata.com/downloads/10m-cultural-vectors/ . Se convierte una vez y se guarda el resultado, no el shapefile.
- coturn, imagen Docker `coturn/coturn` *(etiqueta exacta por verificar)*, o Cloudflare Realtime TURN: https://developers.cloudflare.com/realtime/pricing/ .
- Freesound (solo CC0 / CC-BY): https://freesound.org/ .

Reglas para lo vendorizado: versión exacta en el nombre o en un comentario de cabecera, archivo `LICENSE` al lado, y que entre en el hash de caché del Dockerfile (ya incluye `js/`). El service worker `sw.js` debe precachearlo si la página lo necesita sin conexión.

---

## 4. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Goja no es Node**: el reductor no puede usar APIs de navegador o Node ni sintaxis que Goja no soporte *(por verificar contra PB 0.40.4)*. | Bloquea el paso 2 | Mantener `fiesta-reglas.js` en ES5/ES2015 sencillo, sin `Math.random`, y con pruebas en Node **y** dentro del hook. |
| **Sin TURN**, parte de los jugadores con datos móviles caen al relé HTTP (512 B, ≤10 msg) | Minijuegos interactivos injugables para ellos | Paso 4 antes de cualquier minijuego interactivo. Diseñar v1 en paralelo para que no dependa de la red. |
| **coturn detrás de Dokploy**: Traefik no hace proxy de UDP; hay que publicar puertos del host y abrir un rango de relé en el firewall del VPS | Configuración del despliegue | Contenedor con `network_mode: host` o puertos publicados. Si molesta, usar Cloudflare TURN (sin servidor propio, gratis hasta un límite). |
| **Ancho de banda de TURN** en el VPS | Costo | Solo pasa por TURN el ~10-25 % que lo necesita, y el tráfico es pequeño (entradas de pocos bytes). Medir con `getStats()`. |
| **Autoridad del anfitrión** en minijuegos interactivos: si el anfitrión se va o hace trampa | Ronda rota o injusta | Rotar el anfitrión al jugador con mejor RTT, que el servidor cierre por plazo y valide topes del `report`. Asumido para partidas entre amigos. |
| **Malla de 4** (3 enlaces por teléfono) con batería y CPU limitadas | Lag y calor en gama baja | Estrella hacia el anfitrión en vez de malla completa para minijuegos v2 (cada uno 1 enlace, anfitrión 3). |
| **Tema SSE privado legible** por quien adivine el nombre | Filtración de objetos o mazo | Ruta `mine` autenticada con id+clave, o nombre de tema con hash secreto. |
| **Colyseus pre-1.0** si se activa el plan B | Cambios incompatibles en cada versión menor | Fijar versiones exactas de servidor y SDK y probar antes de actualizar. |
| **Licencias de assets** (bandera pixel sin licencia, audio CC-BY-NC, Wikimedia CC BY-SA) | Riesgo legal en un producto comercial | `CREDITOS.md` con URL y licencia de cada archivo. Solo CC0, CC-BY o dominio público. |
| **Propiedad intelectual de Nintendo** | Riesgo legal | Usar reglas genéricas (casillas azul/roja, estrella por monedas) con nombres y arte venezolanos propios. Nada de decomps. |

---

## 5. Decisiones abiertas para el usuario

1. **¿Aceptas un segundo servicio en el VPS?** La recomendación sale sin él para el juego. Solo coturn sería un contenedor extra, y es evitable si se usa Cloudflare TURN. ¿Prefieres **coturn propio** (gratis y autoalojado, pero con configuración de UDP) o **Cloudflare TURN** (sin servidor y gratis hasta 1000 GB/mes *(por verificar)*, pero con una dependencia externa)?
2. **¿Minijuegos v1 solo en paralelo** (misma semilla y comparar resultados, con fantasmas), dejando los interactivos en vivo para M5? Recomendado: sí. Es lo que más trabajo ahorra.
3. **Plan B para el tiempo real:** si la prueba del paso 6 falla en teléfonos reales, ¿se permite **un contenedor Colyseus** en `/ws` (Node y TypeScript solo en el servidor)? ¿O se prefiere recortar a minijuegos que toleren el relé?
4. **¿Quién es la autoridad en los minijuegos interactivos?** Puede ser el anfitrión (más simple, confía en un jugador) o, más adelante, un servidor (Colyseus). Recomendado para empezar: el anfitrión.
5. **Audio:** ¿solo CC0, o también CC-BY con créditos visibles? ¿Hay presupuesto para una pista de joropo con licencia comercial de pago, o se compone una propia?
6. **Mapa:** ¿mapa con los 23 estados + Distrito Capital (Natural Earth admin-1) o una silueta estilizada que solo use el contorno como guía?

---

## Fuentes principales

- boardgame.io: https://github.com/boardgameio/boardgame.io · https://boardgame.io/documentation/ · https://cdnjs.com/libraries/boardgame-io
- Colyseus: https://github.com/colyseus/colyseus · https://docs.colyseus.io/ · https://docs.colyseus.io/migrating/0.18
- PartyKit/Cloudflare: https://github.com/cloudflare/partykit · https://developers.cloudflare.com/durable-objects/platform/pricing
- Nakama: https://github.com/heroiclabs/nakama
- Trystero: https://github.com/dmotz/trystero · PeerJS: https://github.com/peers/peerjs
- geckos.io: https://github.com/geckosio/geckos.io · snapshot-interpolation: https://github.com/geckosio/snapshot-interpolation
- netplayjs: https://github.com/rameshvarun/netplayjs · Lance: https://github.com/lance-gg/lance
- Rapier (determinismo): https://rapier.rs/docs/user_guides/javascript/determinism
- TURN: https://developers.cloudflare.com/realtime/pricing/ · https://bloggeek.me/webrtcglossary/turn/
- Natural Earth: https://www.naturalearthdata.com/about/terms-of-use/
- Freesound: https://freesound.org/ · Kenney: https://kenney.nl/assets
- Reglas de referencia (CC BY-SA, solo hechos): https://www.mariowiki.com/Bonus_Star · https://www.mariowiki.com/Spaces · https://www.mariowiki.com/Star_Space
