# 07 · LA FIESTA en línea: arquitectura maestra (multijugador en tiempo real)

> **Versión 2 · 2026-10-17.** Reemplaza por completo la versión anterior de este archivo. Aquella proponía, para la v1, minijuegos «en paralelo» donde los rivales se veían como **fantasmas** (`party-ghost.js`). **Esa propuesta queda retirada.**
>
> **Mandato del usuario (2026-10-17):**
> - LA FIESTA es multijugador **real**, cada persona en su propio dispositivo, y **todo en vivo**: el tablero del mapa de Venezuela **y** los minijuegos.
> - Nada de fantasmas, repeticiones ni pantalla compartida.
> - Los minijuegos son interactivos como los cooperativos DUO/SQUAD que ya existen, pero **competitivos**: todos contra todos (supervivencia o puestos), 2v2 y 1v3, lo más parecido a Mario Party que se pueda, y con juegos de verdad.
> - Vive en el mundo Venezuela.
> - Mínimo **2 humanos**; la CPU completa hasta 4.
> - Cada jugador **elige personaje**.
> - Un humano puede entrar a una partida empezada y **tomar el puesto de una CPU**.
>
> Los docs 01-05 siguen valiendo para las reglas, el mapa, la economía y el catálogo, salvo donde este doc dice lo contrario (§2, decisiones D1-D16). El doc 06 queda reemplazado en todo lo que suponía una sola pantalla: hot-seat, pads compartidos y `fiesta-entrada.js`.
>
> Las afirmaciones marcadas **(por verificar)** no se comprobaron en código ni en documentación. Las líneas citadas son del árbol a 2026-10-17.
>
> **Jerarquía de los docs 07-09 (revisión cruzada 2026-10-17).** Este doc es el maestro de la arquitectura. El 08 manda en el catálogo y en el contrato de autor de los minijuegos; el 09 manda en el detalle del netcode (reloj, interpolación, carriles, pruebas). **Si dos de ellos se contradicen en un nombre, un campo o un plazo, gana el glosario de §2.1.** Las referencias que el 08 y el 09 hacían a la «versión 1» de este doc (§2.4, §2.6, §2.7) ya están integradas aquí.

---

## 0. Resumen en 10 líneas

1. **Mismo backend:** un modo nuevo `fiesta` sobre el registro `rooms` de PocketBase. Se reutilizan códigos, invitados, SSE, `sig`/`vsig` y limpieza.
2. **Tablero en vivo y autoritativo:** acciones versionadas (`act {ver, aid, a}`). Un reductor puro, `aplicar(S, a, ctx) → {S, fx}`, corre en el hook (Goja) y en el navegador. El RNG vive **oculto** en `keys._f`.
3. **Cinemática compartida sin desincronizarse:** el servidor emite efectos ya resueltos (`fx`) y cada cliente los reproduce con un **director** que puede acelerar o saltar. Al vaciar la cola, `hash(D) == hash(S)`.
4. **Minijuegos en vivo con el patrón DUO/SQUAD:** misma semilla, cada quien ve a los otros moverse en tiempo real, y un **JUEZ** decide lo disputado, maneja las CPU y firma el resultado.
5. **Tres modelos de red** según el tipo de juego: A (cancha propia), B (dueño + juez) y C (el juez simula, con la variante Ceq por equipo). El lockstep (L) **queda fuera de la v1** (docs 08 y 09): sobre el relé HTTP se traba.
6. **Transporte nuevo `docs/style-lab/fiesta-net.js`:** UMD, con dependencias inyectadas y reloj propio. Es una adaptación de `js/party.js` (capa sig), `js/link.js` y `js/voice.js`, sin tocar los originales. Su `channel()` tiene la forma de `duoCtx`.
7. **Reloj del servidor:** todas las respuestas llevan `now` y todo arranca en tiempos absolutos (`startAt`). El «¡YA!» sale a la vez en las 4 pantallas (±50 ms).
8. **Lobby:** 2+ humanos, elección de personaje única y relleno con CPU. Se toma un asiento de CPU a mitad de partida y se reconecta con la clave guardada en localStorage. Salir no libera el asiento: pasa a `afk` y la CPU cubre.
9. **Por ronda, un minijuego en vivo de 25-60 s**, como Mario Party. El formato sale del color de las casillas. El Relámpago de 5 queda como casilla especial y como opción de configuración (pregunta abierta P1).
10. **`fiesta-vs.js` (misma pantalla) queda obsoleto.** Se conservan `compara()`, `equipos()`, `rngMk` y el contrato `c.held/c.tap/g.ai`.

---

## 1. Lo que ya existe (inventario verificado)

### 1.1 Backend (PocketBase 0.40.4 + hooks JS)

| Pieza | Cómo funciona hoy | Dónde |
|---|---|---|
| Sala | Un registro `rooms` por sala, escrito **solo por el servidor** en una transacción. Asientos a-d (`MAX_PLAYERS=4`). Código de 4 letras. | `pb_hooks/party.js:6`, `party_routes.js:27-70,122-134`, `pb_migrations/1790900600_party_rooms.js` |
| Modos | `MODES = [versus, team, duo, survival, knockout, lantern, cards, balloon]`. **No existe `fiesta`.** | `party.js:8` |
| Acciones | `POST /api/party/<acción>`, cada una en `runInTransaction`. | `claudeware.pb.js:48`, `party_routes.js:121-133` |
| Empuje | El cliente se suscribe por SSE a `rooms/<id>`, `rooms/<id>/sig` y `rooms/<id>/vsig`. Sondeo de respaldo cada 3 s sin SSE y cada 12 s con SSE. | `js/party.js:60-84,328` |
| Relé en vivo `sig` | Autentica y reparte a los suscriptores SSE **sin escribir en la BD**. Topes: `SIG_MAX` 512 B por lote completo y `SIG_COUNT` 10 mensajes. | `party_routes.js:98-120`, `party.js:396,492-555` |
| Puerta del relé | `sigPayload` exige `state==='round'` y `round` exacto (`party.js:493`). DUO pasa todo (`:541`); el resto de modos tiene lista blanca (`:543-552`). | — |
| Voz `vsig` | Se acepta en cualquier estado, hasta 4 KB, tipos `hello/here/bye/offer/answer/ice`. | `party.js:557-569` |
| Rondas | `beginRound` (semilla, `roundAt`), `report` (gana el primer reporte de cada asiento), `finishRound` (versus por `pts`/`t`; DUO: el equipo gana si algún asiento gana) y `tick` con `GRACE_MS=8000`. | `party.js:207-266`, `:12` |
| Reentrada | Requiere id + clave **y** que el asiento esté activo (`party_routes.js:48`). `leave` marca `left=true` con la partida empezada (`party.js:130`), así que **quien sale no puede volver**. | — |
| Unirse | `addPlayer` solo funciona en el lobby (`party.js:102`). | — |
| Invitación | `/r/ABCD` siempre redirige a la app clásica `/?r=` (`party_routes.js:143-151`). | — |
| Temas SSE | **Sin control de acceso:** `relay()` envía a cualquier cliente que tenga la suscripción (`party_routes.js:108-113`). | — |
| Límites por IP | `sig` 7200/60 s y `vsig` 1200/60 s. | `1791150000_party_transport_rate.js:6-9` |
| Límites por sala | Cubeta de fichas en `$app.store()`: `limitRoom` y `reactLimit`. | `party.js:431-483` |
| Tamaños | `players` 4 KB, `keys` 8 KB, `extra` 8 KB. | migraciones `1790900600`, `1791030500`, `1791030000` |
| Temporizador | **No existe en el servidor.** `tick` lo dispara algún cliente; solo hay un cron de limpieza cada 20 min. | `claudeware.pb.js:51` |
| Reloj | **Ninguna respuesta lleva la hora del servidor.** El cliente arranca cuando le llega el SSE. DUO disimula el desfase con la tarjeta de 7,3 s (`PRE_MS_DUO`). | `party.js:10` |

### 1.2 Netcode en vivo del cliente (el estándar que pide el usuario)

- **`duoCtx`** (`js/party.js:207-222`) es la API que consume cada juego en vivo: `{role, roles, partner, seats, byRole, send(t, d, latest), onMsg(fn(t, d, rol, id))}`.
  - Los roles rotan cada ronda con `(asiento + ronda) % n`.
  - `onMsg` reproduce lo que estaba en búfer (hasta 80 mensajes, `:203-204`).
- **Cola `sigFlush`** (`party.js:224-264`):
  - Latido `hb` cada 0,5 s.
  - Los mensajes `latest` (el último gana) se fusionan **por tipo**.
  - Por WebRTC si **todos** los enlaces están abiertos (cada 20 ms). Si no, por relé HTTP: 1 petición en vuelo, `SIG_GAP` 50 ms, 10 mensajes / 500 B.
  - Deduplicación por `from:round:v:(l ? t : n)` (`:189-195`).
- **Techo real del relé:** `min(20, 1/RTT)` peticiones/s por cliente. Eso da unas 10/s a 100 ms y unas 5-7/s a 150-200 ms. **Nunca se llega a 20/s en móvil.**
- **`js/link.js`** (123 líneas):
  - Malla WebRTC de ≤3 pares con dos canales: `f` (desordenado, `maxRetransmits:0`) y `r` (fiable).
  - Ping cada 1 s con RTT suavizado; un enlace se da por muerto tras 5 s.
  - **`linkUsable` es todo o nada** (`:12`): basta un par malo para mandar a toda la sala por el relé.
  - `linkSend` solo hace difusión.
- **`js/voice.js`:** malla de audio, solo STUN (más `window.CLAUDEWARE_ICE_SERVERS` opcional).
- **Juez DUO/SQUAD** (`js/games/du1.js:73-82`, `wire()`):
  - Un rol juez termina `END_SLACK=0,6 s` antes y difunde `end` con el veredicto. Los demás esperan hasta `DUO_WAIT=1,5 s` (`main.js:359`).
  - El nivel se construye con `withSeed(R.seed)` y todo el azar se gasta en el constructor.
  - Los remotos se interpolan 150 ms atrás con `track()` (`du1.js:14,27-38`), con marca de **llegada**, no de envío.
- **Patrones probados:**
  - El dueño publica: `squad/storm.js:15-19`, `squad/pit.js:10-12`.
  - Auto-juicio contra un reloj sembrado: `duo/granny.js:14`, `duo/beat.js:10`.
  - Juez con ventana de gracia: `duo/crane.js:12-14,476-478`.
  - El juez lee lo que **recibió**: `squad/blanket.js:15-17`.
- **Pruebas:**
  - `test/duo.test.js:22-35` y `test/squad.test.js:23-37` montan todos los roles con la misma semilla sobre un relé en memoria con retardo de 50/150/300 ms. Exigen **cero desacuerdos de veredicto**, un único juez (`squad.test.js:52`) y ningún tipo reservado.
  - `test/party-network.test.js:10-30` corre el `link.js` real con un `RTCPeerConnection` falso.

### 1.3 Mundo Venezuela (`docs/style-lab`)

| Pieza | Estado |
|---|---|
| `fiesta-rng.js` | mulberry32 sembrado, UMD. **Se queda.** |
| `fiesta-mapa-venezuela.js` | 114 nodos (azul 43, roja 11, evento 13, especial 15, delta 7, transporte 7, duelo 4, villano 4, banco 3, alcabala 2, ahorita 2, vaina 2, salida 1), 15 candidatos a estrella, 9 tiendas, 26 bifurcaciones, unos 16,4 KB. Estático, **nunca va en el registro**. |
| `fiesta-reglas.js` | Esqueleto M0 con 17 pruebas. **Fallo de seguridad:** guarda `semilla` y `rng` dentro de `S` (`fiesta-reglas.js:20,27`). Si `S` pasa a ser el tablero público, cualquier cliente puede predecir dados y eventos. Además baraja el orden cada ronda (`:11,24`). |
| `fiesta-vs.js` | Versus **en una misma pantalla**: pads compartidos y teclas por jugador (`:24-27,55-84`). Contrato útil: `c.held(p,b)`, `c.tap(p,b)`, `c.rng`, `c.cpu[]`, `c.skill[]`, `g.ai(p,dt,api)`, `g.scores`, `g.fin`; además `compara()` (`:45-52`) y `equipos()` (`:37`). |
| Juegos versus | `juego-f-machaca.js`, `juego-f-f_cola.js`, `juego-f-f_domino.js`, `juego-f-f_harina.js` y `juego-f-f_tequeno.js` solo leen `held/tap/rng`, así que se pueden portar cambiando **de dónde viene la entrada**. |
| `fiesta.html` | Hace `fetch('index.html')` y le suma bus, juegos, `eggs.js` y `fiesta-*.js` (`fiesta.html:10-17`). **No carga la pila de red.** |
| Elenco | `BUS.TU` (`juegos-bus.js:16`), `MAMA` (`:387`), `ABU` (`:388`), `AP.CAST` (`:392`), `FACES[0..11]` (`engine.js:1024-1036`) y `bust()` con estados de ánimo. |
| Despliegue | `scripts/sync-world-assets.sh` copia `public.html` como `worlds/venezuela/index.html` (`:9`) y copia `fiesta-*.js` (`:13`), así que `fiesta-net.js` se publica solo. **Mismo origen que `/api/party/*`.** |

### 1.4 Por qué el mundo Venezuela no puede cargar `js/party.js` tal como está

1. **Choque de nombres globales.** `engine.js` y `js/core.js` declaran en el nivel superior `W`, `H`, `INK`, `ctx`, `now`, `snd`, `sfx` y `txt` (`engine.js:2,17,371` frente a `core.js:3-22`). `txt` además tiene otra firma. Cargar `core.js` en el lab lanza un SyntaxError por redeclaración.
2. **Acoplamiento con `main.js`:**
   - `party.js` escribe `state`, `st`, `mode` y `parts`.
   - Llama a `beginGame`, `REGMAP`, `STAGES`, `loadThree`, `goTitle`, …
   - Lee `tt` y `cur` (`party.js:87-133,275-314`).
3. **Reloj congelado.** La capa sig usa `now`, y el lab solo avanza `now` durante un juego o la campaña (`engine.js:1496-1499`). En el tablero, los temporizadores del relé se detendrían.
4. **Globales en `link.js` y `voice.js`:** `party`, `pcall`, `auth`, `onSig`, `vsend`, `t`, `say`, `track`, `PARTY_UI`.
5. **Doble pedido de micrófono.** El lab ya abre el micrófono para sus juegos de mic (`engine.js:1019`); la voz haría un segundo `getUserMedia`.

### 1.5 Fallo de despliegue que conviene arreglar ya

En producción, `fiesta.html` descarga `index.html`, que en realidad es `public.html` (`sync-world-assets.sh:9`). `public.html` **ya** carga todos los `juego-*.js` y `campana.js` (`public.html:14-58`). Resultado: en producción los juegos se cargan **dos veces** y entra `campana.js`, al contrario de lo que dice el comentario de `fiesta.html`. **Arreglo (M0.5):** `fiesta.html` con su propia lista estática de scripts (D16).

---

## 2. Decisiones (con los conflictos entre análisis resueltos)

| # | Decisión | Conflicto que resuelve |
|---|---|---|
| **D1** | **Todo en vivo.** Se retiran los fantasmas, `party-ghost.js` en LA FIESTA, el «Paralelo v1» y la pantalla compartida. Los rivales siempre se ven por su estado transmitido en directo. | Doc 07 v1 §2.6 y doc 06 §5. |
| **D2** | **Un modo `fiesta` sobre `rooms`**, no un sistema aparte. Campos nuevos: `board`, `ver` y `keys._f` (privado). | Coinciden los 4 análisis. |
| **D3** | **Reductor puro con RNG oculto:** `aplicar(S, a, ctx) → {S, fx}`, con `ctx = {rng, now, priv}`. La semilla, el estado del RNG, el orden del mazo, los compromisos sin revelar y los `aid` van en `keys._f`. `board` **nunca** contiene `rng` ni `semilla` (hay prueba que lo exige). | Fallo de `fiesta-reglas.js:20,27`. |
| **D4** | **Casi todo es público:** objetos en mano, monedas, estrellas y posición (como Superstars y Jamboree, **(por verificar)** que el HUD muestre los objetos de todos). Lo privado se reduce a RNG, mazo, la estrella bonus oculta y compromisos. **Sin tema SSE privado por asiento**: los temas no tienen control de acceso (`party_routes.js:108-113`). Lo privado se pide por la ruta `mine`. | Doc 07 v1 §2.4 proponía `rooms/<id>/p/<asiento>`, que **filtra datos**. |
| **D5** | **El orden de turnos se tira una sola vez** al empezar (dado en vivo con `commit`, valores 1-10 distintos) y queda fijo toda la partida, como en Mario Party. | `fiesta-reglas.js` barajaba en cada ronda. |
| **D6** | **Un minijuego en vivo de 25-60 s por ronda** (el ciclo de Mario Party). El formato (4P / 2v2 / 1v3) sale del color de las casillas (doc 06 §6.3). El **Relámpago de 5** pasa a ser (a) una casilla o evento especial y (b) una opción de configuración `cfg.ronda = 'clasica' \| 'relampago'`. El planificador es el mismo (`mj.cola` con N juegos), así que soportar ambos no cuesta nada extra. **La opción por defecto está pendiente (P1)**, porque el Relámpago fue un pedido explícito anterior del usuario. | Análisis 3 (lo quita del ciclo) frente al 4 (lo mantiene). |
| **D7** | **Tres modelos de red** (§6.2): **A** cancha propia, **B** dueño + juez, **C** el juez simula (y **Ceq**, C por equipo). El lockstep (**L**) queda **fuera de la v1**; los juegos discretos (piedra-papel-tijera, «elige la puerta») se hacen con `commit` en A. | El análisis 2 usaba A/B/C/D con otros significados y el 3 usaba A/B/C. Los docs 08 y 09 ya habían sacado el lockstep; esta tabla los alinea. |
| **D8** | **Juez:** lo elige el **servidor** al abrir la tarjeta (provisional) y lo **confirma al fijar `startAt`**: si el elegido ya no tiene presencia (D20), pasa el primero vivo de `mj.suc`. Es el humano en línea con menor RTT mediano (lo reporta el `hb` de presencia por HTTP, D20, y se guarda en `$app.store()`, nunca en el registro). Empates (±15 ms): rotación con `(índice + mj.k) % n`. En 1v3 nunca es el solitario si hay alternativa (umbral: ≤40 ms de diferencia). | El análisis 1 proponía el id más bajo, el 4 el asiento presente más bajo, el 2 y el 3 el mejor RTT. Se adopta el RTT porque reduce la ventaja del juez. |
| **D9** | **Migración del juez por CAS en el servidor:** tras 1,2 s de silencio (sin ningún mensaje del juez), el primer humano vivo de `mj.suc` pide `POST /api/party/juez {k, e}`, donde `e` es la época que **ve**. Solo se acepta si `mj.e === e`; entonces `mj.juez = quien llama` y `mj.e = e + 1`. Gana el primero. Los mensajes con `e` viejo se ignoran. | El análisis 3 proponía autopromoción tras 2 s, que con particiones produce dos jueces. |
| **D10** | **El veredicto lo firma el juez** (`mjfin`) y los demás humanos mandan testigos (`mjack` con hash). Sin juez al vencer el plazo, vale el testigo con mayor `k`; sin ninguno, empate sin monedas. El servidor valida topes por juego. Esto reemplaza «el primer reporte gana» (`party.js:226`) para `fiesta`. | El análisis 3 usaba autorreportes en el modelo A más `fin` del juez; el 2 usaba `vsfin` + `vsack`. Se unifica: **siempre firma el juez**, porque en el modelo A también ve los estados `o` de todos. |
| **D11** | **`fiesta-net.js` es una adaptación autónoma (UMD)** de la capa sig de `js/party.js` (`:43-84,143-274`), de `link.js` completo y de `voice.js:1-127` sin interfaz. Dependencias inyectadas y reloj propio (`performance.now`). **No** se cargan `link.js` ni `voice.js` con un adaptador global. `js/party.js` no se toca; unificar después es opcional. | El análisis 4 proponía `fiesta-red.js` como adaptador global para cargar `link.js` y `voice.js` tal cual. Se descarta por los choques de §1.4, el reloj congelado y el riesgo de contaminar globales del motor. |
| **D12** | **Enrutamiento por par:** P2P hacia los pares abiertos y relé solo para los demás. Los duplicados ya se descartan con la deduplicación `n/v`. | `linkUsable` todo o nada (`link.js:12`). |
| **D13** | **Salir no es irse:** en partida, `leave`, AFK y desconexión ponen `cpu:'afk'` y **se conserva la clave**. `left` no se usa en `fiesta`. La reanudación se guarda en **localStorage** (`minicaos-fiesta-v1`). | `party_routes.js:48` + `party.js:130`, y la sesión en sessionStorage (`party.js:57,113`). |
| **D14** | **Toma de asiento de CPU (humano NUEVO):** el reclamo es inmediato en el servidor y el control pasa en el próximo límite seguro. En el tablero, en el siguiente aviso de ese asiento. En un minijuego, se mira en vivo (D18) y se juega desde el siguiente (si entra durante la tarjeta, juega este). **El dueño ORIGINAL que se cae y vuelve** sí recupera el control en caliente dentro del mismo minijuego (`ev hum`, docs 08 §4.6 y 09 §7.2): un parpadeo de 3 s de la red no puede costarle el juego entero. | El análisis 1 permitía tomarlo a mitad de minijuego; el 2 y el 4, en el límite. Para el humano nuevo se elige el límite (determinista y fácil de probar). Esta tabla antes dejaba también el regreso del dueño para v2, lo que contradecía a 08/09 y a su prueba (5); se alinea con ellos. |
| **D15** | **Reloj del servidor:** `now: Date.now()` en **todas** las respuestas y en cada mensaje del relé (`at`). El desfase se estima con la muestra de menor RTT de las últimas 10. `startAt` es absoluto. | Ningún análisis discrepaba; hoy no existe. |
| **D16** | **`fiesta.html` con lista estática propia** y sin `campana.js`. | Fallo de §1.5. |
| **D17** | **`act` se valida contra el aviso, no contra la versión global.** Cada `esp` lleva `id` (= el `ver` que lo creó) y `act` manda `{eid, aid, a}`. Hay 409 solo si `esp.id !== eid` (el aviso cambió o venció). | Con `ver` estricto, cualquier escritura ajena (un `ready`, un `back`, la llegada de alguien, un `commit`) rechazaba el dado del actor y le obligaba a tocar otra vez. |
| **D18** | **Mirones en vivo (espectadores y quien acaba de tomar un asiento).** No están en la malla P2P, así que solo reciben lo que pasa por el relé. Si `mj.watch > 0` (lo cuenta el servidor: tomas de asiento pendientes más espectadores que hicieron `join` en los últimos 10 min; los espectadores no tienen clave ni `hb`, así que se cuenta de más, y eso solo cuesta ≤5 req/s), el juez manda además por HTTP, a ≤5 Hz, un paquete latest `w` con todos los cuerpos (o el `s` en C), y cada cliente con todos sus pares en P2P deja de tener que duplicar al relé. | Sin esto, con todo en P2P un mirón no ve nada, lo que contradice «todo en vivo» y la toma de asiento (D14). |
| **D19** | **Un solo `o` por emisor, con todos los cuerpos que simula** (`o.b = [[asiento, x, y, vx, vy, st, sc], …]`): el juez mete su cuerpo y los de las CPU. **`i` solo viaja en los juegos C/Ceq** (o en A/B que declaren `entradas: true`). | La fusión latest es **por tipo y emisor** (`js/party.js:216-219` y la dedupe de `:189-195`): varios `o` del juez se pisaban y solo llegaba el último. Y `i` + `o` + `hb` en A/B pasaba de 25 msg/s por emisor en el relé. |
| **D20** | **Presencia por HTTP:** cada cliente manda al servidor, **siempre por el relé y aunque tenga P2P**, un `hb` cada 2 s con `{rtt, vis}`. `relay()` guarda `fp:<code>:<asiento> = {at, rtt, vis}` en `$app.store()`. Con eso se elige el juez (D8), se aplica el AFK rápido (§7.3) y se cuenta quién está. | Con P2P, el `hb` de 0,5 s nunca llega al servidor, así que no podía elegir juez por RTT ni saber quién estaba. Sustituye el tema `rooms/<id>/h/<asiento>` del doc 09 §7.5. |
| **D21** | **El alcance va en el cuerpo de la petición, no en cada mensaje:** `POST sig {code, id, key, sc: 'b' \| 'm:<k>', m: [...]}`, igual que hoy `round`. El cliente tiene una cola por alcance. `e` va dentro de `d` en los tipos del juez. | `sigPayload` hoy copia solo `t, d, n, l, v` de cada mensaje (`party.js:498-503`): un `sc` o `e` por mensaje se perdería, y además gastaría bytes de los 512. |
| **D22** | **Tipos propios del juego con prefijo `x`** (`xtiro`, `xpasa`…, ≤200 B) pasan la lista blanca de `sigPayload` en el alcance `m`. | El doc 08 los usa en varios juegos y la lista blanca de §4.3 los rechazaba. |

### 2.1 Glosario canónico (gana sobre 08 y 09 si discrepan)

| Tema | Nombre canónico | Alias retirados |
|---|---|---|
| Rutas del minijuego | `ready`, `juez` (CAS), `mjfin` (veredicto del juez), `mjack` (testigo), `time` (ráfaga de reloj) | `listo`, `act LISTO`, `vsjudge`, `vsjuez`, `vsfin`, `vsack` |
| Reloj | `now: Date.now()` en toda respuesta; `at` en cada mensaje relevado | `st` (choca con el global `st` de `main.js` y con el campo `st` de los cuerpos) |
| Asientos | En el registro y en `board`: letras `'a'..'d'`. En el contexto `c` del juego: índice `0..n-1`, con `c.seats[i].id` = la letra. Espectador: `c.yo = -1` | `c.yo = null` |
| Formato | `mj.tipo ∈ 'ffa' \| '2v2' \| '1v3' \| '1v1'` (`1v1` = duelos) | `'4P'` |
| Clase | `clase ∈ 'rank' \| 'survival' \| 'binary'` | `kind` |
| Modelo | `modelo ∈ 'A' \| 'B' \| 'C' \| 'Ceq'` | `D`, `L` |
| Límites | `limites: {scoreMax, scoreRate, minT, finTemprano}`; `migra: bool`; `minHumanos` | `bounds`, `earlyFin`, `migrate` |
| Metas binarias | `ganaSolo()`, `ganaEquipo()` | `win1v3`, `teamWin` |
| Época del juez | `mj.e` (en mensajes: `e`) y sucesión `mj.suc` | `epoca`, `epoch` |
| Fases del tablero | `board.f ∈ lobby, orden, turno, carta, mj, res, final, fin`. Un reto épico es un `mj` con `cola[0].reto = true` | `f: 'reto'`, `mj.fase` |
| Alcances del relé | `sc = 'b'` (tablero) o `'m:<k>'` (minijuego `k`), en el cuerpo de la petición (D21) | `scope: 'm'`, `'mg:<k>'` |
| Emotes | `react` (tipo existente, `REACT_KINDS`) | `rx` |
| Plazos del minijuego | `cartaHasta = now + fxMs + 4500 + 15000`; `startAt = now + 3500`; no jueces esperan `end` hasta `dur + 1,5 s`; `cierre = startAt + dur·1000 + 3000` | `+2000`, `GRACE_MS` |
| Contrato de autor | Dos niveles (doc 08 §5): estilo VS con cierre (`update/draw/scores/fin/ai`) para A/B; `pack/unpack/restore` obligatorios en C/Ceq y en todo juego con `migra: true`; `predict` en C. La simulación pura del doc 09 §10.1 es la forma **recomendada** para C nuevos, no obligatoria | — |

---

## 3. Modelo de estado (un registro, versionado)

### 3.1 Migración `pb_migrations/17920xxxxx_party_fiesta.js`

| Campo | Tipo | Tope | Uso |
|---|---|---|---|
| `rooms.board` | json | 32 KB (objetivo < 12 KB) | Estado público `S` |
| `rooms.ver` | number | — | +1 en cada mutación de `fiesta`. Los clientes ordenan por `ver`, no por `updated` (dos escrituras pueden caer en el mismo milisegundo) |
| `rooms.keys` | json | subir a 16 KB | Claves de asiento + `_f` privado |
| `rooms.mode` | select/text | — | Agregar `fiesta` (**(por verificar)** si `mode` es select en la migración o texto libre) |

Además: reglas de límite por IP para las rutas nuevas (§9.3), al estilo de `1791150000_party_transport_rate.js`.

### 3.2 `board` público

```js
{
  f: 'lobby'|'orden'|'turno'|'carta'|'mj'|'res'|'final'|'fin',
  r: 3, tot: 15,
  cfg: { tot: 15, ronda: 'clasica'|'relampago', reglas: 'caos'|'clasico', dadosPj: false, cpuNivel: 2 },
  orden: ['b','a','d','c'],
  t:   { s: 'b', paso: 'pre'|'dado'|'mover'|'decide'|'casilla', resto: 4, camino: [12,13,14], hasta: 1792345678901 },
  esp: { id: 118 /* ver que lo creó, D17 */, s: 'b', k: 'DADO'|'RUTA'|'TIENDA'|'ESTRELLA'|'OBJETIVO'|'PEAJE'|'TRANSPORTE'|'COMMIT', opc: [...], hasta } | null,
  pj: { a: { ch: 'mama', nodo: 41, mon: 22, est: 1, obj: ['dado2', null, null], st: {}, cpu: null|'auto'|'afk',
             afk: 0, on: true, stats: {...} }, b: {...}, c: {...}, d: {...} },
  estrella: { nodo: 77, b: 91 /* 2.ª estrella; null si cfg.estrellas===1 */, precio: 10 },
  tab: { peajes: {...}, banco: 14, trampas: [...públicas], ciclo: 0, villano: null },
  mj: { k: 7, tipo: 'ffa'|'2v2'|'1v3'|'1v1', clase: 'survival', eq: [['a','c'],['b','d']], solo: null,
        cola: [{ g: 'f_mecate', seed: 912374, dur: 45, lv: 2, modelo: 'A', reto: false }], i: 0,
        juez: 'c', suc: ['a','b'], e: 0, cartaHasta, startAt, cierre, listos: { a: true },
        watch: 0 /* mirones sin P2P, D18 */, res: null } | null,
  nextAt: 1792345680000,               // próximo vencimiento que `tick` debe atender
  fx:  [ { v: 118, s: 'b', fx: [...] }, ... ],   // anillo de las últimas 16 versiones
  log: [ 'Mamá compró una estrella', ... ]       // últimas 30 líneas (reemplaza historial:200)
}
```

### 3.3 `keys._f` privado (nunca sale del servidor)

```js
{ rng: <estado mulberry32>, semilla, deck: [...], bonusOculta: 'pasos',
  c:   { orden: { a: 7 }, duelo3: { b: 10 } },   // compromisos sin revelar
  aid: { a: 'x9f2', b: 'k1aa' },                  // última acción por asiento (idempotencia)
  cpuAt: 1792345679300 }
```

La presencia y el RTT **no** van aquí: cambian cada 2 s y escribirlos sería una escritura en BD por latido. Viven en `$app.store()` (`fp:<code>:<asiento>`, D20).

Las claves de asiento siguen en `keys[a..d]`, como hoy. `publicRoom` ya quita `keys` (hay prueba de que ni el SSE ni las respuestas la incluyen).

### 3.4 Efectos (`fx`): el contrato entre el servidor y el director

Cada paso del reductor emite efectos **totalmente resueltos**, de modo que ningún cliente necesita el RNG:

```js
{k:'dado', s, v:7, de:'d10'}          {k:'hop', s, de:12, a:13}           {k:'pasa', s, nodo, que:'banco', d:-3}
{k:'mon', s, d:+3, tot:25}            {k:'est', s, d:+1, tot:2}           {k:'compra', s, item}
{k:'ataque', s, a:'c', item, d}       {k:'estrellaMueve', de:77, a:80, i:0 /* 0=nodo, 1=b */}           {k:'evento', id, txt}
{k:'turno', s}                        {k:'mjIni', tipo, eq, g}            {k:'mjRes', puestos, pagos}
{k:'llega', s, name}                  {k:'afk', s}                        {k:'vuelve', s}
```

Hay una tabla de duraciones compartida en `fiesta-reglas.js` (`FX_MS`): salto 160 ms, conteo de monedas 500 ms, dado 900 ms, fanfarria de estrella 2200 ms, vista de reubicación de la estrella 1600 ms, tarjeta de evento 1800 ms. El servidor suma `fxMs(lote)` a cada plazo, así que el tiempo de la cinemática **no cuenta** contra el jugador.

---

## 4. Protocolo del servidor

### 4.1 Rutas (todas `POST /api/party/<acción>`; toda respuesta lleva `{room, now}`)

| Acción | Cuerpo | Quién | Reglas |
|---|---|---|---|
| `create` | `{mode:'fiesta', name, color, ch?}` | cualquiera | `board.f='lobby'` |
| `join` | `{code, id?, key?, name, color}` | cualquiera | (1) Con id + clave válidos (incluidos asientos `afk`/`cpu`): **reentrada**. (2) En el lobby: asiento nuevo. (3) En partida, si hay un asiento `cpu:'auto'`, o `cpu:'afk'` cuyo dueño lleva >180 s fuera: **toma de asiento** (D14), con clave nueva, hereda monedas, estrellas y personaje, y emite el fx `llega`. (4) Si no: `200 {spectate:true, room}`, sin clave. |
| `pick` | `{ch}` | asiento, en el lobby | El personaje es único; gana el primero y el resto recibe 409 |
| `cfg` | `{tot, ronda, reglas, dadosPj, cpuNivel}` | anfitrión, en el lobby | |
| `ready` | `{on}` | asiento | Lobby **y** tarjeta de minijuego (`board.f==='carta'`) |
| `start` | `{}` | anfitrión | Exige ≥2 humanos, todos listos, o que el anfitrión fuerce 20 s después de que el segundo humano marcó listo. Rellena hasta 4 con `cpu:'auto'` y personajes no elegidos. Pasa a `f:'orden'` |
| `act` | `{eid, aid, a:{t,...}}` | el asiento de `esp.s` | 409 `{room}` solo si `esp.id !== eid` (D17; el cliente se resincroniza con el cuerpo, sin sondeo extra). `aid` repetido: 200 sin reaplicar. Turno ajeno: 403. Jugadas: `TIRAR`, `USAR {slot, obj?}`, `RUTA {a}`, `COMPRAR {item\|null}`, `ESTRELLA {si}`, `PAGAR {si}`, `SUBIR {si}`, `OBJETIVO {s}` |
| `commit` | `{k, aid, v}` | asientos nombrados en `esp` | Decisiones simultáneas: dado de orden, apuestas de duelo, votos de «últimos 5», Cambiazo. Se revela en `fx` cuando todos los humanos comprometieron o al vencer el plazo. Las CPU sacan su valor del RNG oculto |
| `mine` | `{}` | asiento | `{priv, now}`: tu compromiso pendiente y tus trampas secretas |
| `tick` | `{code}` | cualquiera | Idempotente y barato: si `now < board.nextAt`, lee **sin** abrir transacción de escritura. Aplica (a) vencimientos de avisos (acción por defecto + strike AFK), (b) turnos de CPU cuando `now ≥ cpuAt`, (c) el calendario del minijuego (carta → mj → res → tablero). Reemplaza `advance` en `fiesta` |
| `juez` | `{k, e}` | humano activo del minijuego `k` | CAS (D9): si `mj.e===e`, entonces `mj.juez = quien llama`, `mj.e = e+1` |
| `time` | `{}` | cualquiera | `{now}` sin tocar la BD. Ráfaga de 5 en la tarjeta (doc 09 §5.1) |
| `mjfin` | `{k, e, kk, sc[], pl[], h, cpu[]}` | **solo** `mj.juez` con `e` vigente | Valida topes (§6.7), calcula pagos con una función pura compartida con `fiesta-reglas.js` y aplica `MJ_RESULT` |
| `mjack` | `{k, e, kk, h, sc[]}` | otros humanos | Testigo. Si hay desacuerdo de hash con ≥2 testigos, la ronda queda marcada `disputada` (se registra y vale el veredicto del juez) |
| `back` | `{}` | clave de un asiento `afk` | Quita `afk`; recupera el control en el próximo límite (D14) |
| `leave` | `{}` | asiento | En el lobby: libera el asiento. En partida: `cpu:'afk'`, se conserva la clave. La sala se borra cuando no queda ningún humano y nadie hizo `back` en 10 min |
| `sig` / `vsig` | como hoy | | Rama `fiesta` en `sigPayload` (§4.3) |

### 4.2 Cambios en los hooks

| Archivo | Cambio |
|---|---|
| `pb_hooks/party.js` | `MODES += 'fiesta'`. `PRE_MS_FIESTA` (tarjeta: hasta 15 s + 3,5 s de cuenta atrás). Rama `fiesta` en `sigPayload`. Funciones puras `fiestaJoin`, `fiestaTick`, `fiestaJuez`, `fiestaFin` (testeables con `now` y `rand` inyectados, como el resto del archivo). `room.round` sube con cada minijuego, así siguen valiendo la puerta y los límites existentes. |
| `pb_hooks/party_routes.js` | Rutas nuevas en `exec` (`:55-66`). `board` y `ver` en `JSN`/`NUM` (`:4-6`). `now` en cada respuesta (`:70,114,133`). **Caché en `$app.store()`** de `{code → id, claves, f, mj.k, juez, e}` para que `relay()` no haga `findByCode + load` en cada mensaje. **La invalidación al guardar es obligatoria** (después del commit de la transacción), con TTL de 1 s solo como red de seguridad: con TTL a secas, tras un CAS de `juez` el relé rechazaría hasta 1 s los `s`/`end` del juez nuevo, y tras una toma de asiento la clave nueva fallaría. Redirección `/r/CODE` → `/worlds/venezuela/fiesta.html?r=CODE` si `mode==='fiesta'` (`:143-151`). |
| `pb_hooks/fiesta/` | `fiesta-rng.js`, `fiesta-reglas.js` y `fiesta-mapa-venezuela.js`, copiados por `sync-world-assets.sh` (una sola fuente de verdad). `require(`${__hooks}/fiesta/fiesta-reglas.js`)`. **(por verificar)** que Goja resuelva el `require('./fiesta-rng.js')` relativo (`fiesta-reglas.js:5-6`); si no, ruta explícita con `__hooks`. |

### 4.3 Rama `fiesta` de `sigPayload`

```js
// va ANTES de la puerta actual `state !== 'round'` (party.js:493), que en fiesta no aplica
if (room.mode === 'fiesta') {
  const b = room.board, sc = body.sc;                  // D21: un alcance por petición
  if (sc === 'b') allow(['hb','aim','react','_net_ping','_net_pong']);  // cualquier fase
  else if (sc === 'm:' + b.mj.k && (b.f === 'carta' || b.f === 'mj'))
       allow(['hb','i','o','s','s2','w','ev','end','cl','ok','jg','rdy','react','_net_ping','_net_pong'], /^x[a-z0-9]{1,11}$/);  // D22
  else fail('Round is over', 409);
  judgeOnly(['s','s2','w','end','ok','jg'], d.e === mj.e); // y 'ev' con ty ∈ {cpu, hum}
  if (t === 'hb') store.set('fp:'+code+':'+seat, {at: now, rtt: d.rtt, vis: d.vis});  // D20
  rateLimit(seat, 25 /*msg/s*/, clave propia 'fl:<code>:<asiento>');  // aim: 5 Hz y ≤64 B
  // SIG_MAX 512 B / SIG_COUNT 10 sin cambios; 'from' lo fija el servidor (no se puede suplantar)
}
```

Nota de costo: `limitRoom` guarda **un solo string JSON por sala** bajo el candado de `setFunc` (`party.js:431-445`). Pasar por ahí unas 30 peticiones/s de una sala serializa todo el relé de esa sala. El tope de 25 msg/s usa una clave por asiento (`fl:<code>:<asiento>`), sin JSON compartido.

`vsig` no cambia: ya se acepta en cualquier estado y modo.

---

## 5. Cliente: módulos y responsabilidades

### 5.1 Árbol de archivos

| Archivo | Rol | Sin DOM |
|---|---|---|
| `fiesta-net.js` | Transporte: `pcall`, SSE + sondeo, cola sig, malla WebRTC, voz, reloj, sesión y reentrada. UMD | sí (dependencias inyectadas) |
| `fiesta-reglas.js` | Reductor puro `aplicar(S, a, ctx) → {S, fx}`, política de CPU, `FX_MS`, pagos (`pagosMJ`), `compara` | sí |
| `fiesta-director.js` | Cola de `fx`, `D` frente a `S`, velocidades de alcance, `hash()` | sí |
| `fiesta-live.js` | Ejecución de minijuegos en vivo: `FIESTA.LIVE.add`, contexto `c`, modelos A-D, juez, migración, resultado | sí (salvo `draw`) |
| `fiesta-lobby.js` | Crear / unirse / reanudar, tarjetas de asiento, rejilla de personajes, configuración, voz y latencia | no |
| `fiesta-tablero.js` | Dibujo del mapa, fichas, avisos del actor, burbujas de espectador | no |
| `fiesta-camara.js` | seguir / libre / fijo, momentos forzados, minimapa | no |
| `fiesta-hud.js` | 4 paneles, anillo de tiempo, emotes, anillo de voz | no |
| `fiesta-carta.js` | Tarjeta del minijuego, práctica, ¡LISTO!, 3-2-1-¡YA!, podio | no |
| `fiesta-main.js` | Máquina de estados de la página: `board.f` → pantalla | no |
| `juego-fl-*.js` | Minijuegos en vivo (`FIESTA.LIVE.add`) | `draw` aparte |
| `fiesta-vs.js` | **Obsoleto** (§5.5) | — |

Orden de carga en `fiesta.html` (estático, D16): `engine.js` → `juegos-bus.js` → `fiesta-rng` → `fiesta-mapa-venezuela` → `fiesta-reglas` → `fiesta-net` → `fiesta-director` → `fiesta-live` → `juego-fl-*.js` → UI (`lobby`, `tablero`, `camara`, `hud`, `carta`) → `fiesta-main`. Los `juego-*.js` del bus solo se cargan si un minijuego los reutiliza para su arte.

### 5.2 API de `fiesta-net.js`

```js
const N = FIESTA.net.create({
  api: window.CLAUDEWARE_API || '', fetch, EventSource,
  RTC: window.RTCPeerConnection, ice: () => window.CLAUDEWARE_ICE_SERVERS || STUN,
  clock: () => performance.now() / 1000,     // nunca el `now` del motor (se congela fuera de juego)
  storage: localStorage, token: () => null, log, track
});

// sala y asientos
await N.create({ name, color, ch, cfg });    // → {code, you:{id,key}}
await N.join(code, { name, color });         // reentrada automática con {id,key} guardados; toma de CPU; espectador
await N.resume();                            // al arrancar: lee 'minicaos-fiesta-v1' (<6 h)
await N.leave();                             // en partida = afk (D13)
N.room; N.board; N.ver; N.you; N.seats();    // [{id,name,ch,color,cpu,online,rtt}]
N.onRoom(fn(room, old)); N.onGone(fn);

// tablero autoritativo
await N.act(a);                              // {eid: esp.id, aid}; ante 409 adopta el room del cuerpo y, si el aviso sigue siendo mío con otro id, lo vuelve a mostrar
await N.commit(k, v); await N.mine(); N.tickIfDue();

// canal en vivo: forma de duoCtx, así DUO.wire y los bots de duo/squad funcionan sin cambios
const ch = N.channel(scope);                 // 'b' | 'm'
ch.role; ch.roles; ch.seats; ch.byRole; ch.judge; ch.isJudge(); ch.epoch;
ch.send(type, data, latest);                 // latest → canal 'f' / reemplazo en la cola
ch.onMsg(fn(type, data, fromRole, fromId));  // reproduce el búfer
ch.away(id); ch.close();

// tiempo
N.serverNow();                               // ms; desfase = muestra de menor RTT de las últimas 10
N.at(epochMs);                               // → segundos locales
N.rtt(id); N.label();                        // '42 MS · DIRECTO|RELÉ'

// voz (sin UI)
N.voice.toggle(); N.voice.state(id); N.voice.talking(id); N.voice.mute(id);
N.voice.stream;                              // se comparte con los juegos de micrófono del motor (un solo getUserMedia)
```

Detalles internos que se adaptan:
- **Dos carriles HTTP por cliente**, cada uno con 1 petición en vuelo: «latest» (`i`, `o`, `s`, `aim`) y «fiable» (`ev`, `end`, `cl`, `ok`). Así un snapshot no espera detrás de un evento. Total ≤20 req/s.
- **Envío por par** (D12).
- `sigFlush` se ejecuta en `requestAnimationFrame` **y** en un `setInterval` de 100 ms. Este último mantiene vivos el latido y la cola cuando la pestaña está oculta o el motor no avanza `now`.
- El latido `hb` lleva `{rtt}` (la mediana hacia los pares), que el servidor usa para elegir juez (D8).

### 5.3 Director (`fiesta-director.js`)

```text
estado: S (último board por ver), D (estado mostrado), shownV, cola de lotes fx con v ∈ (shownV, S.ver]
cada cuadro:
  si shownV < board.fx[0].v - 1:   // el anillo nos dejó atrás (pestaña en segundo plano)
       D = S; tarjeta "Mientras no estabas…" armada con log; shownV = S.ver
  velocidad = backlog<=1 ? 1 : backlog<=3 ? 2 : SNAP;   tocar la pantalla = ×3 (solo local)
  reproducir el siguiente fx con FX_MS[k]/velocidad; aplicarlo a D con proyectar(D, fx)
  cola vacía ⇒ assert hash(D) === hash(S); si falla: snap, D = S, log 'fiesta_desync'
avisos: se muestran solo cuando shownV ≥ versión que creó esp y esp.s === yo
```

Disimular la latencia del actor:
- **Dado:** el bloque gira en local; el toque envía `TIRAR` y reproduce 300 ms de golpe y bamboleo. El valor llega en la **respuesta** de `act`, antes que el SSE.
- **Flechas de ruta:** se resaltan al instante (optimista); si llega un 409, el director vuelve a reproducir.
- **Espectadores:** ven los mismos `fx` en el mismo orden, unos 100-300 ms después. No hace falta lockstep en el tablero.

### 5.4 Contrato de minijuego en vivo (`FIESTA.LIVE.add`)

Une la propuesta de simulación pura del análisis 2 con la de contexto de cierre del análisis 3. Los modelos A y B pueden usar estilo de cierre; **el modelo C exige `step/pack/unpack`**, porque el juez debe poder migrar.

```js
FIESTA.LIVE.add('f_mecate', {
  name: '¡SALTA EL MECATE!', modos: ['ffa', '1v1'], modelo: 'A', dur: 45, clase: 'survival',
  stick: false, botones: 1, snapHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: true },
  carta: { obj: 'Brinca cuando pase el mecate', como: 'A = saltar', demos: [...] },
  mk(c) {
    // todo el azar del mundo se saca aquí de c.rng (regla de du1.js); lo cosmético usa c.fx
    return {
      update(dt) {...}, draw() {...},
      ai(p, dt, api) {...},                        // CPU: la corre el juez (A/B/C) o todos (D)
      scores() {...}, done() {...},
      // solo C (opcional en B):
      init() {...}, step(S, inp, dt) {...}, pack(S) {...}, unpack(a) {...}, restore(S) {...},
      predict(S, me, inp, dt) {...},               // C+P: predicción del avatar propio
      ganaSolo(S) {...}, ganaEquipo(S) {...}       // opcionales (binary)
    };
  }
});
```

**Contexto `c`:**

```js
{ n: 4, yo: 1 /* índice; -1 si es espectador */, seats: [{id: 'b', name, ch, color, cpu, team, human}],
  modo: 'ffa'|'2v2'|'1v3'|'1v1', equipos, solo, lv, modelo, rng, rngFor(tag), fx,
  juez: () => bool, epoch, ahora: () => segundosDeJuego /* (serverNow - startAt)/1000 */,
  held(p, b), tap(p, b), axis(p),                // la entrada propia es local; la remota llega por 'i'
  send(t, d, latest), on(t, fn(d, seat)),        // canal 'm' de fiesta-net
  remoto(p),                                     // objeto track() del asiento p (interpolado por marca de envío)
  propio(p),                                     // ¿este cuerpo lo simulo yo? (A/B)
  claim(id) → Promise<'ok'|'no'>,                // B: objetos del juez
  out(), fin(scores) }
```

**Compatibilidad:** los 5 juegos `juego-f-*.js` se adaptan con un envoltorio `legacy`. `c.held/c.tap` de los asientos remotos se alimenta de los mensajes `i`, y en el modelo C solo hay que agregar `pack/unpack` (unas 10 líneas por juego).

### 5.5 `fiesta-vs.js`: qué queda y qué se va

| Se va (obsoleto) | Se queda (se mueve a `fiesta-live.js` o `fiesta-reglas.js`) |
|---|---|
| Pads táctiles compartidos (`padRect`, `hitPad`, `drawPads`, `:55-84`) | `compara(modo, eq, sc)` (`:45-52`): puestos con empates, 2v2 por suma y 1v3 por la media del trío. También corre en el servidor (UMD) |
| Mapa de teclas por jugador (`:24-27,60-68`) | `equipos()` (`:37`) y `rngMk` |
| El bucle «4 jugadores en un dispositivo» | El contrato por asiento `c.held/c.tap/g.ai` (`:6-12,99-125`), que pasa a ser la API de entrada de `FIESTA.LIVE` |

El archivo se borra cuando el último juego `juego-f-*.js` esté portado a `FIESTA.LIVE` (al cierre de M3).

---

## 6. Minijuegos en vivo

### 6.1 Flujo de un minijuego para los 4 clientes

```text
fin de la última jugada de la ronda ─► servidor (en la misma transacción):
  formato por colores de casilla (doc 06 §6.3) → tipo, eq, solo
  bolsa filtrada por modo y nº de humanos → g, seed, dur, lv
  juez provisional y suc (D8), e=0, f='carta', cartaHasta = now + fxMs + 4500 (ruleta) + 15000
TARJETA (≤15 s): ruleta de formato (ya decidida, solo se anima) → banner 4P / 2v2 / 1v3 → objetivo
  → controles (táctil + teclado + demo animada por rol; en 1v3 primero el tuyo) → retratos con ✓
  → PRÁCTICA local opcional (sin la semilla real) → ¡LISTO! (ready). Las CPU siempre están listas.
  En segundo plano: calentar la malla WebRTC, 5 pings de sincronía de reloj, precarga de arte, hb con rtt.
todos listos o cartaHasta ─► servidor: confirma juez (D8), startAt = now + 3500, cierre, f='mj'
CUENTA ATRÁS 3-2-1-¡YA! sobre serverNow() ─► entrada bloqueada hasta ahora() ≥ 0
JUEGO (25-60 s): HUD con 4 fichas (retrato, puntaje o corazones, marco de equipo); el juez no lleva marca
ahora() ≥ dur o done() ─► el juez manda 'end' + mjfin; los demás muestran 'end' (o su último snapshot
  si pasa ahora() > dur + 1,5) y mandan mjack
servidor: veredicto → pagos (fx mjRes) → f='res' (5 s; se puede saltar a los 2 s si todos tocan) → f='turno'
plazo duro: mj.cierre = startAt + dur·1000 + 3000 (no los 8 s de GRACE_MS) → tick cierra con un testigo o con empate
```

**Relámpago** (casilla especial o `cfg.ronda='relampago'`): `cola` lleva N juegos cortos de 8-12 s. Cada uno tiene una tarjeta de 1,4 s y un resultado de 1,2 s, y el siguiente arranca en `max(cierre + 1200, planeado)`. Es el mismo código con N > 1.

### 6.2 Los cuatro modelos de red

| Modelo | Quién manda | Para qué | Equivale a |
|---|---|---|---|
| **A · Cancha propia** | Cada cliente simula **su** avatar y se juzga solo contra peligros que son una función pura de `(seed, ahora())`. Publica `o` (estado, 10-15 Hz) y `ev out`. El juez simula las CPU, revisa la verosimilitud de lo que publica cada dueño y firma | Carreras por carril, ritmo, «Simón dice», saltar la cuerda, reacción y memoria con rivales visibles | Análisis 2: A + D; análisis 3: A |
| **B · Dueño + juez** | Cada cliente es dueño de su cuerpo. Los **objetos compartidos** (monedas, la harina, el globo) son del juez: el cliente predice, envía `cl{id, t}` y el juez concede el `t` más temprano dentro de 120 ms (`ok{id, seat}`). Los **golpes** los juzga la **víctima** (`ev shot{x, y, dir, t}`). Toda amenaza se telegrafía ≥0,5 s, y ese telegrafiado es la compensación de lag | Recolectar, quitarse un objeto, esquivar con proyectiles, papa caliente, la mayoría de los 1v3 | Análisis 2: A+B híbrido; análisis 3: B |
| **C · El juez simula** | Los no-jueces mandan `i` (entradas) y el juez simula a 30 Hz y difunde `s` (10 Hz por relé, 15-20 por P2P). Los clientes interpolan y **predicen su propio avatar** (C+P), reconciliando con un ajuste suave de ≤8 px por cuadro. Variante «C por equipo»: el delantero simula el vehículo del equipo | Contacto físico (sumo, vagón), pelota compartida (futbolito), cuerda, jefes | Análisis 2: B / B+P; análisis 3: C |
| ~~D · Lockstep~~ (**L**, fuera de v1) | — | Los juegos discretos se hacen con `commit` (decisión oculta y revelada por el servidor) o en A | Análisis 2: C |

**Comunes a todos:**
- Reloj compartido `ahora()`.
- Nivel sembrado, con el mismo número de extracciones en todos los clientes.
- Avatar propio con cero lag.
- Remotos dibujados en `ahora() - Dint` interpolando con la **marca del emisor** (corrige `du1.js:27`), con `Dint = clamp(1,5 × intervalo + 2 × jitter, 100, 250 ms)` adaptativo. Si el búfer se vacía, se extrapolan ≤100 ms y luego se congela.

**Latencia objetivo a 200 ms de RTT:**

| Modelo | Avatar propio | Rivales u objetos compartidos |
|---|---|---|
| A | 0 | unos 220 ms |
| B | 0 | concesión de objeto ≈ RTT + 120 ms (se tapa con la animación de «¡te lo quitaron!») |
| C+P | 0 (predicho) | pelota ≈ RTT + Dint |
| C sin predicción | unos 500 ms: **no sirve para moverse** | — |

### 6.3 Mensajes (`t` ≤12 caracteres; `l` = el último gana; deben caber en 512 B con el sobre, así que el contenido va ≤420 B)

```text
i   (l, humano→todos)   {k, b: máscara, a: [ta, tb] contadores acumulados de toques, x?, y?: -100..100}   // SOLO en C/Ceq o con entradas:true (D19)
o   (l, dueño A/B)      {k, t: msJuego, b: [[asiento, x, y, vx, vy, st, sc], …]}   // UN o por emisor: el juez mete su cuerpo + las CPU (D19)
w   (l, juez, HTTP)     {e, k, t, b: [...]}   // solo con mirones (D18), ≤5 Hz
s   (l, juez C)         {e, k, t, p: [[x, y, st, sc]×n], w: [...compacto], h?: hash cada 30 k}
s2  (l, juez)           desborde del snapshot (la deduplicación latest es por tipo)
ev  (fiable)            {e, k, ty: 'out'|'hit'|'shot'|'pick'|'pasa'|'cpu'|'hum'|..., p?, d?}
cl  (fiable, B)         {id, t}                  ok (fiable, juez) {e, id, p}   // p = índice ganador, -1 si nadie
jg  (fiable, juez nuevo) {e, k}
end (fiable, juez)      {e, k, sc: [...], pl: [...], h}
rdy (fiable)            {}                       aim (l, tablero) {k: 'ruta'|'obj'|'tienda'|'blanco', v}
hb  (l)                 {rtt, vis}               x*  (juego) tipos propios con prefijo x, ≤200 B (D22)
```

**Toques como contadores acumulados:** fusionar mensajes o perder paquetes nunca borra un toque. El juez calcula `nuevos = ta - últimoTa` y lo limita a 16 toques/s por botón (un humano llega a unos 12-15).

**Ojo con el lote del juez en C:** el tope de 512 B es para **todo el lote** (sobre de unos 45 B por mensaje incluido). Un `s` de 420 B no deja sitio para el `hb` ni para nada más, y un `s2` obliga a una segunda petición, que a 200 ms de RTT **parte a la mitad** la tasa de instantáneas. Regla práctica: `s` ≤300 B; `s2` solo como excepción.

**Presupuesto de envío:**
- `i` (solo C/Ceq) cuando cambia la entrada, como máximo a 20 Hz, más 4 Hz de mantenimiento.
- `o` a 10-15 Hz.
- `s` a 10 Hz (en relé, unos 5-7 Hz reales).
- Peor caso de servidor por sala: unas 40 req/s, que la caché de `relay()` vuelve baratas.

### 6.4 Juez: elección, CPU, migración y desconexión

- **Elección:** D8. El servidor la escribe en `mj.juez`.
- **CPU:** el juez corre `ai(p)` para cada CPU y cada humano caído (modelos A, B y C) y difunde sus estados dentro de **su** `o` (A/B, D19) o de `s` (C).
- **Flujos de RNG separados:**
  - `c.rng` para el mundo (solo el juez en C, todos en A/B/D para generar el nivel).
  - `rngFor('cpu'+p)` para cada CPU.
  - `c.fx` para lo cosmético, local y sin semilla.
- **Migración** (D9):
  - Disparo: 1,2 s sin `s`/`hb` del juez.
  - El primer vivo de `mj.suc` llama `juez {k, e}`.
  - El SSE del room avisa a todos.
  - El nuevo juez hace `restore(último snapshot)` y continúa desde `k`.
  - Los juegos sin `restore` (`migra:false`) terminan antes, usando el último snapshot como veredicto.
- **Desconexión:**
  - Un humano sin `i`/`o`/`hb` durante 2 s (`SIG_AWAY`) pasa a CPU: el juez difunde `ev{ty:'cpu', p}` y en A/B toma el cuerpo congelado. Etiqueta: «(se le fue el internet)».
  - El resultado sigue siendo del asiento y se marca `cpu:[asientos]` solo para estadísticas.
  - Si **el mismo dueño** vuelve a mitad de juego (misma clave), tras 0,5 s de entradas frescas el juez emite `ev{ty:'hum', p, d: estadoCuerpo}` y el dueño retoma desde ahí (D14). Si recargó la página, reconstruye el juego con `mk(c)` + la semilla y entra en vivo con el último `o`/`s`.
- **Pestaña en segundo plano:** al volver se ve el estado vivo, nunca una repetición.

### 6.5 Resultado y monedas

```js
// el juez construye; los testigos calculan h con su propia vista
{ k, e, kk: tick, g, modo: 'ffa'|'2v2'|'1v3'|'1v1', clase: 'rank'|'survival'|'binary',
  equipos, sc: [...], pl: [1, 2, 2, 4], ganadores: [...], cpu: [...], h: fnv(sc, pl, kk) }
```

| Tipo | Regla |
|---|---|
| `rank` | Puestos por puntaje con `compara`; los empates comparten puesto |
| `survival` | El puntaje es el tick de eliminación; quien sigue vivo al final recibe `dur·30+1`, así que los sobrevivientes empatan en 1.º. Las eliminaciones con <100 ms de diferencia empatan |
| `2v2` | Suma del equipo, o `ganaEquipo(S)` para metas binarias; ambos miembros comparten el puesto |
| `1v3` | `ganaSolo(S) → true\|false`. Por defecto, la regla de la media de `compara`. El solitario debería ganar alrededor del **45 %**, con una perilla de ajuste por juego |

**Pagos** (función pura `pagosMJ` en `fiesta-reglas.js`, la usa el servidor; **valores iniciales por calibrar con el simulador**):

| Modo | Pago |
|---|---|
| 4P y supervivencia | 14 / 9 / 5 / 2 por puesto; empates: promedio redondeado hacia arriba |
| 2v2 | ganadores 7 cada uno, perdedores 2; empate: 4 cada uno |
| 1v3 | solitario gana: 12; trío gana: 4 cada uno |
| Bono de colección | +1 por cada 5 objetos, tope +3 |
| Rondas múltiplo de 5 | ×2 («RELÁMPAGO EN DÓLARES», doc 04) |
| Relámpago (N juegos) | la tabla por microjuego de doc 06 §6.4 (3/2/1/0…) + bono «¡El rey de la rumba!» |
| Épicos | 15 / 9 / 5 / 2 (×1,5 en la final) |

Las monedas **solo las escribe el servidor**, en la misma transacción de `mjfin`/`tick`, y alimentan las estadísticas de las estrellas bonus (`minijuegosGanados`, `epicosGanados`).

### 6.6 Controles universales (en el dispositivo de cada uno)

- **Táctil, horizontal:**
  - Joystick flotante en el 45 % izquierdo de la pantalla.
  - **A** grande abajo a la derecha.
  - **B** arriba a la izquierda de A, solo si el juego lo usa.
- **Teclado:** stick con WASD o flechas, A con Espacio o J, B con Shift o K.
- **Vertical:** el 800×600 va en caja y los controles en la franja de abajo, con el color del personaje.
- **Reglas:** en el juego se desactiva la conversión de deslizar a flechas, y no hay más de 6 s de machaque sin pausa (doc 04 §3.2).

### 6.7 Validación en el servidor y trampas

- Cada juego del catálogo declara `limites: {scoreMax, scoreRate, minT, finTemprano}`. `mjfin` se rechaza o se recorta si:
  - el largo de `sc` no es n, o algún valor cae fuera de `[0, scoreMax]`;
  - algún puntaje supera `scoreRate × transcurrido` según el reloj del servidor;
  - el final llega antes de `startAt + minT` sin `finTemprano`;
  - los puestos no son coherentes con los puntajes.
- **Controles del juez sobre los clientes:**
  - Velocidad de un dueño en A ≤ vmax × 1,2.
  - Un salto mayor que 2 × vmax·dt se rechaza y se conserva el último estado bueno.
  - Toques ≤16/s.
  - Reacción ≥120 ms en los juegos de reflejos (A).
- **Contra un juez tramposo:**
  - Rotación del juez.
  - Hashes de los testigos.
  - `fairDelay`: el juez aplica a sus propias entradas la mediana de latencia de ida de los demás, con tope de 120 ms.
  - Cada snapshot es público: la trampa se ve en todas las pantallas.
- Se acepta la confianza en el juez para partidas entre amigos, como en DUO/SQUAD hoy. **La economía del tablero sí es 100 % autoritativa.**

### 6.8 Catálogo (24 + 3 retos) y rebanada vertical

Cada juego sigue esta ficha: id, nombre, modo, controles, modelo, estado sincronizado, regla de ganador, niveles 1-3, CPU, escena, chiste y eco de Mario Party. Los ecos van todos marcados **(por verificar)**, salvo los evidentes.

| Modo | Juegos (modelo) |
|---|---|
| 4P puestos (8) | `f_cola` «¡LA COLA DE LA GASOLINA!» (A, port) · `f_domino` «¡CAPICÚA!» (A, port, ritmo) · `f_tequeno` «¡TEQUEÑOS!» (A, port) · `f_harina` «¡LA ÚLTIMA HARINA!» (B, port) · `f_cotufas` «¡LLUEVEN COTUFAS!» (B) · `f_cerro` «¡SUBE EL CERRO!» (A) · `f_bolas` «¡BOLAS CRIOLLAS!» (C) · `f_perro` «¡PERRO CALIENTE CON TODO!» (A) |
| Supervivencia (6) | `f_mecate` «¡SALTA EL MECATE!» (A) · `f_chancla` «¡LLUEVEN CHANCLAS!» (B, mamá del elenco) · `f_vagon` «¡EL VAGÓN!» (C, tipo Bumper Balls) · `f_bombita` «¡AGUA EN CARNAVAL!» (B, tipo Hot Bob-omb) · `f_abuela` «¡LA ABUELA DICE!» (A, tipo Shy Guy Says) · `f_bombillo` «¡SE VA LA LUZ!» (B, con Don Corte) |
| 2v2 (5) | `f_futbolito` «¡FUTBOLITO DE CALLE!» (C) · `f_carrucha` «¡LA CARRUCHA!» (C por equipo) · `f_hallacas` «¡LA LÍNEA DE HALLACAS!» (B por equipo) · `f_cava` «¡CARGA LA CAVA!» (B) · `f_cuerda` «¡HALA LA CUERDA!» (C, doble jalón sincronizado) |
| 1v3 (5) | `f_patilla` «¡LA PATILLA GIGANTE!» (B) · `f_bono` «¡SE LE CAE EL BONO!» (B) · `f_guaya` «¡LA GUAYA DEL TELEFÉRICO!» (B) · `f_alcabala` «¡LA ALCABALA DE MEDIANOCHE!» (B) · `f_silbon` «¡EL SILBÓN EN EL LLANO!» (B) |
| Retos épicos (3) | `f_reto_catatumbo` (4 contra jefe, C, reusa `juego-jefe-transformador.js`) · `f_reto_saltoangel` (carrera 4P, A) · `f_reto_delta` (2v2 en curiara, C por equipo) |

**Rebanada vertical (los 6 primeros):** cubre los 4 modos y los modelos A/B/C sin transporte nuevo.

| # | id | Modo | Modelo | Qué valida |
|---|---|---|---|---|
| 1 | `f_mecate` | supervivencia | A | Reloj compartido, `out`, ranking de supervivencia |
| 2 | `f_domino` | 4P | A | Port existente; reloj dentro de ±60 ms |
| 3 | `f_harina` | 4P | B | Port; reclamo/concesión y arbitraje del juez |
| 4 | `f_chancla` | supervivencia | B | Golpes juzgados por la víctima; los eliminados siguen jugando como «tías chismosas» |
| 5 | `f_futbolito` | 2v2 | C | Física autoritativa, snapshots, predicción y reconciliación |
| 6 | `f_patilla` | 1v3 | B | Roles asimétricos, lanzamientos deterministas, perilla del solitario |

---

## 7. Tablero en vivo: experiencia, tiempos y CPU

### 7.1 Cómo se ve cada momento (en todas las pantallas)

- **Inicio de turno:** banner «¡LE TOCA A MAMÁ!» con el busto en estado 'grin' y la cámara volando hacia la ficha. El móvil del actor vibra (`navigator.vibrate(80)`) y muestra «¡TE TOCA, PANA!».
- **Antes del dado:** la bandeja de objetos solo la ve el actor. Los demás ven la burbuja «🎒 eligiendo objeto…» y el icono que el actor tiene señalado (`aim`).
- **Dado y saltos:**
  - Todos ven girar el bloque.
  - El valor cae con el fx `dado`, y luego un contador de pasos.
  - Lo que se atraviesa (banco, peaje, tienda, estrella) pausa la marcha con un aviso.
  - Las monedas vuelan hacia el panel del jugador que corresponde.
- **Bifurcación:** flechas grises más la burbuja «🤔 pensando…» con un anillo de tiempo. Con «ver la duda» activado (por defecto), la flecha que el actor resalta se transmite a ≤5 Hz, como en Mario Party. Las rutas de pago (ferry, teleférico, avioneta) muestran el precio.
- **Tienda:** interfaz completa solo para el actor. Los demás ven la tarjeta «🛒 Abasto de la esquina» con el artículo señalado.
- **Estrella:** momento forzado en todas las pantallas. La abuela entrega la arepa-estrella y luego hay 1,6 s de vista general del nuevo nodo.
- **Ataques:** mientras el actor apunta, la cámara de todos se desplaza a la víctima señalada. Al usarlo, el panel de la víctima tiembla en todas las pantallas y la víctima recibe un atajo de emote «¡NOOO!».
- **Los que esperan nunca solo esperan:** cámara libre, fichas de cualquier jugador, emotes y voz.

### 7.2 Cámara (local, nunca se sincroniza)

- Modos:
  - `seguir` (por defecto, lerp a tasa 8).
  - `libre` (arrastrar o pellizcar; vuelve a `seguir` 3 s después de soltar).
  - `fijo` (candado).
- Los **momentos forzados** (estrella, ataque contra mí, evento de la isla en Deltamacura) le ganan a `seguir` y a `libre`. En `fijo` aparece un aviso con el botón «VER».
- Minimapa de 120×90 siempre visible; tocar una ficha mueve la cámara hasta ella.

### 7.3 Plazos, valores por defecto y AFK

| Aviso | Plazo (se suma a `fxMs`) | Valor por defecto |
|---|---|---|
| Dado | 20 s (30 s en el primer turno) | tirar solo + strike AFK |
| Objeto | 12 s | no usar |
| Ruta | 12 s | `ady[nodo][0]` (camino principal) |
| Tienda, peaje, transporte | 15 s | no comprar / no pagar |
| Estrella | 10 s | **comprarla** si alcanza (por defecto amable) |
| Commit | 12 s | valor de CPU |

- El anillo de tiempo lo ven todos. A los 5 s restantes: tic sonoro y vibración para el actor.
- **AFK:**
  - 2 strikes en el dado ⇒ `cpu:'afk'`, con una hamaca «zzz 💤».
  - Una acción real reinicia los strikes.
  - Se vuelve con «¡VOLVÍ!» (`back`) o con la reentrada.
- **AFK rápido por presencia:** el servidor mira `fp:<code>:<asiento>` (D20). Si el actor lleva >20 s sin `hb` de presencia, o con `vis: 0` (pestaña oculta), el valor por defecto se aplica sin esperar el plazo. Como en segundo plano el navegador frena o mata los temporizadores (iOS los congela), la falta de `hb` es justamente la señal.
- **CPU del tablero:** pura, dentro del reductor, con RNG oculto y niveles 1-3.
  - Compra la estrella si alcanza.
  - En las bifurcaciones toma el camino más corto a la estrella, o a la tienda si le hace falta.
  - Decide en <0,5 s y no «piensa en voz alta».
  - Las jugadas las aplica `tick` cuando `now ≥ cpuAt = now + fxMs + 400 ms`; el primer cliente que hace `tick` la dispara.

### 7.4 Ronda

1. Banner «RONDA r/tot».
2. Si `r === tot - 4`: evento «ÚLTIMOS 5» (ruleta del último lugar).
3. Turnos en el orden fijo (D5).
4. Formato por colores: la ruleta convierte las casillas verdes en azules o rojas.
5. Minijuego en vivo (§6.1), o Relámpago si toca.
6. Pagos.
7. Reto épico en las rondas 4, 8 y la última (doc 04), según la configuración.
8. Siguiente ronda.

Duelos: un `commit` de apuesta y después un minijuego 1v1 en vivo (los 2 humanos o la CPU; los demás miran en vivo). **El catálogo del doc 08 no trae juegos 1v1 propios:** los duelos usan los FFA que declaren `'1v1'` en `modos` (deben funcionar con `n = 2`). Primeros candidatos: `f_mecate`, `f_domino`, `f_harina`, `f_abuela`.

---

## 8. Lobby, personajes, toma de asiento y reconexión

### 8.1 Flujo

Mundo Venezuela → «LA FIESTA» → **[CREAR SALA]**, **[UNIRSE: código]** o reanudación automática.

- **4 tarjetas de asiento:** nombre, color (paleta del servidor, `party.js:19`), personaje, ✓ de listo, ping y anillo de voz.
- **Rejilla de 8 personajes:** tocar uno envía `pick`. El busto pasa a 'happy' si lo conseguiste y a 'yell' si otro lo agarró primero.
- **Configuración del anfitrión:** turnos 10/15/20, formato de ronda, reglas caos/clásico, dados de personaje y nivel de la CPU.
- **Invitación:** código más `/r/CODE`, botón de micrófono y etiqueta de latencia.
- «Faltan N humanos» mientras haya menos de 2. **EMPEZAR** se habilita con ≥2 humanos y todos listos, o para el anfitrión 20 s después.
- **Asientos de CPU:** personajes sobrantes, con nombres tipo «CPU · LA ABUELA».

### 8.2 Personajes (8 jugables, del elenco existente)

| # | Personaje | Fuente | Dado opcional (`cfg.dadosPj`) | Frase |
|---|---|---|---|---|
| 1 | **TÚ** (el chamo del suéter) | `TU`, `juegos-bus.js:16` | 3,4,5,6,7,8 | «¡Ahorita sí!» |
| 2 | **MAMÁ** (rolos, chancla) | `MAMA`, `:387` | 0 «¡CASTIGADO!»,0,8,9,9,10 | «¿Y quién va a recoger esto?» |
| 3 | **LA ABUELA** | `ABU`, `:388` | 1,2,3,4,🪙+3,🪙+3 | «Bendición, mijo.» |
| 4 | **EL TÍO** | `FACES[6]` | −2🪙(0),6,7,8,10,10 | «Yo en mis tiempos…» |
| 5 | **EL PANA** | `FACES[0]` | 2,4,5,6,7,🪙+2 y 5 | «¡Mi paaana!» |
| 6 | **LA PRIMA** | `FACES[7]` | 1,3,5,7,9,🔁 | «Ay no, qué ladilla.» |
| 7 | **EL COBRADOR** | `FACES[3]` | 4,4,5,5,6,🪙 cobra 2 al de atrás | «¡Pasaje, pasaje!» |
| 8 | **EL PORTU** (panadero) | `FACES[1]` | 3,3,5,5,7,🥐 artículo −2 | «¡Olha o pão!» |

- **Desbloqueables más adelante:** EL CHUO (`FACES[11]`) y EL FANÁTICO VINOTINTO (`FACES[9]`).
- Con `dadosPj` apagado (por defecto) todos usan el d10 y el personaje es cosmético: frase de victoria, de derrota y voz del emote.
- El color del personaje es un aro alrededor de la ficha. El color del asiento lo pone el servidor, así no choca con los colores de equipo en 2v2.

### 8.3 Entrar a una partida empezada (toma de asiento de CPU)

- Si hay un asiento `auto`, o `afk` con más de 180 s: «Te montas en el puesto de EL TÍO: 3 ⭐, 22 monedas. ¿Dale?» → `join`. Todos ven el fx «¡LLEGÓ <nombre>!».
- El control pasa en el próximo límite (D14). Si es durante un minijuego, el recién llegado lo mira en vivo por `sig`.
- Con 4 humanos: **espectador**, con suscripción de solo lectura y sin emotes. Ve el tablero por el SSE del registro y los minijuegos por el paquete `w` del relé (D18). **Sin voz en v1:** `vsig` exige asiento (`party.js:557-569`) y la malla de voz es de ≤3 pares, así que un 5.º oyente no cabe. Aparece el aviso «📢 Hay puesto libre» cuando un asiento pasa a CPU.

### 8.4 Reconexión y móvil en segundo plano

```text
arranque:  s = localStorage['minicaos-fiesta-v1']  // {code,id,key,ts}
           si s y ahora-ts < 6 h → join(code,{id,key}); 403/404 → borrar y menú
           200 → reconstruir desde el room + mine(); director en SNAP + tarjeta "Mientras no estabas"
           reabrir SSE y malla; la voz queda apagada hasta tocarla (permiso del navegador)
visible:   cerrar y reabrir EventSource (iOS lo mata), sondeo inmediato, mine(), tickIfDue(), alcanzar
oculto:    dejar de enviar aim/hb; NUNCA enviar leave (mismo criterio que party.js:135-139)
sondeo:    8 s con SSE sano; 2 s en el tablero sin SSE; 1 s en mj sin SSE
pestañas:  varias en el mismo asiento se permiten (ver + aid las vuelven seguras)
```

### 8.5 Emotes y voz

- Agregar `fiesta` a `REACT_MODES` y ampliar `REACT_KINDS`: «¡NA'GUARÁ!», «¡QUÉ LADILLA!», «¡EPA!», «¡CHAO PESCAO!», «¡AY, PAPÁ!», «¡ESO ES TODO!», 😂 🔥 😱 👏. Se replican en `party-react.js`, como exige su prueba.
- Límites de emotes: `reactLimit` y 600 ms de enfriamiento en el cliente.
- **Voz:** apagada por defecto, con anillo de quién habla. Sin TURN (`voice.js:6`), las redes estrictas pueden fallar, y **el juego nunca depende de la voz**.

---

## 9. Tamaños, tasas y carga

### 9.1 Registro

| Pieza | Objetivo | Tope |
|---|---|---|
| `board` (anillo de 16 fx × unos 300 B + 30 líneas de log) | <12 KB | 32 KB |
| `players` | <1 KB (los personajes van en `board.pj`) | 4 KB |
| `keys` (RNG, mazo de 28, compromisos, aid) | <6 KB | 16 KB |
| Push SSE | unos 12 KB × 4-6 por turno | — |

El mapa nunca viaja.

### 9.2 Relé

- `sig` sin cambios: 512 B y 10 mensajes por llamada.
- `aim` ≤64 B; estado de avatar ≤120 B; contenido ≤420 B.

### 9.3 Límites nuevos por IP

Por cada 60 s; pensados para 4 teléfonos en la misma Wi-Fi:

| Ruta | Límite |
|---|---|
| `/api/party/act`, `/tick` | 600 |
| `/api/party/commit`, `/mine`, `/mjfin`, `/mjack` | 300 |
| `/api/party/pick`, `/ready`, `/cfg` | 240 |
| `/api/party/juez` | 120 |
| `/api/party/time` | 300 |
| `/api/party/join` | 60 |

### 9.4 Por asiento (`limitRoom`)

- `act`: ráfaga de 6, recarga de 250 ms.
- `aim`: 5 Hz.
- `sig`: 25 mensajes/s.

---

## 10. Hitos revisados (M0.5-M6) con pruebas de aceptación

| Hito | Entrega | Aceptación (todo automatizado salvo lo indicado) |
|---|---|---|
| **M0** (hecho) | RNG, esqueleto de reglas, mapa de 114 nodos, `fiesta.html`, 17 pruebas | verde |
| **M0.5 · Fundaciones de red y reglas** | **Reglas:** reductor `aplicar(S, a, ctx) → {S, fx}` con RNG en `ctx`, orden fijo, `FX_MS`, `proyectar`, `pagosMJ`, `compara` movido desde `fiesta-vs.js`. **Red:** `fiesta-net.js` (transporte, reloj, canal, envío por par) con la suite de fakes. **Servidor:** esqueleto del modo `fiesta`, `now` en las respuestas, `fiesta.html` con lista estática (D16) | (1) 1000 partidas de 4 CPU: nada negativo, nodos válidos, `ver` monótono, fin en `tot`, `board` <16 KB, **sin `rng` ni `semilla` en el board**, `proyectar(D, fx) == S` en cada acción. (2) `test/fiesta-net.test.js`: fusión latest, deduplicación P2P + relé, mezcla por par, reproducción del búfer, ausencia por `hb`, desfase de reloj ±30 ms con 150 ms de jitter. (3) Los bots de DUO y SQUAD corren sobre `channel()` sin cambios (conformidad). (4) `duo.test.js` y `squad.test.js` siguen verdes |
| **M1 · Lobby y tablero en vivo** | `create/join/pick/cfg/ready/start/act/commit/mine/tick/back/leave`, migración, relleno con CPU, AFK, toma de asiento, localStorage, redirección `/r/`, director, `aim`, cámara, HUD, tablero gris con casillas azul, roja y estrella, emotes | (1) `party.test.js` ampliado: `act` 409, idempotencia de `aid`, 403, plazo + strike → `afk` → `back`, ritmo de la CPU con `cpuAt`, toma de asiento (auto, y afk antes y después de 180 s), reentrada tras `leave`, `start` con ≥2 humanos, `commit` oculto hasta revelarse, `keys` jamás en `publicRoom`, redirección. (2) Arnés de N clientes: 4 directores sin DOM sobre un broker con 50-400 ms de retardo, 15 % de pérdida, reordenamiento y duplicados. Escenarios: móvil dormido 45 s, recarga dura, quinto cliente que toma una CPU, todos AFK (la partida termina). Al quedar en reposo, `hash(D)` es idéntico en todos. (3) Playwright con 2 contextos (uno móvil): dado de orden + 5 turnos con `FIESTA.hash()` igual; recargar B ⇒ se reanuda; un 3.er contexto toma una CPU |
| **M2 · Runtime de minijuegos en vivo** | `fiesta-live.js` (modelos A/B/C, juez, CAS `juez`, `mjfin/mjack`, `limites`), tarjeta + práctica + ¡LISTO! + 3-2-1 + podio, rama `fiesta` de `sigPayload` con caché en `relay()`, 3 juegos: `f_mecate`, `f_domino`, `f_harina` | (1) `test/fiesta-live.test.js` (al estilo de `squad.test.js`) con `memRelay` (retardo, jitter, 5 % de pérdida, 512 B / 10 msg, una petición en vuelo): con 2-4 asientos a 50/150/300 ms, **mismos puestos (h) en todas las pantallas**, exactamente un juez, juez muerto en un k al azar ⇒ un solo veredicto, asiento caído ⇒ CPU, ningún tipo reservado, req/s dentro del presupuesto, resultados dentro de `bounds`, humanos inactivos nunca ganan a las CPU activas. (2) Playwright con 2 contextos: el «¡YA!» con <100 ms de diferencia entre pantallas (marca de tiempo en consola) y el mismo podio |
| **M3 · Rebanada completa y formatos** | `f_chancla`, `f_futbolito` (C+P), `f_patilla`; formato por colores 4P/2v2/1v3 en el servidor; voz en el lobby y el HUD; micrófono compartido con el motor; port de `f_cola` y `f_tequeno`; **borrar `fiesta-vs.js`** | (1) Ventaja del juez: en 200 semillas con bots de igual habilidad, la tasa de victoria del juez ≤ 1/n + 8 pp. (2) Solitario de 1v3 con bots: 40-50 % de victorias. (3) Puestos 2v2 y 1v3 coherentes con `compara`. (4) Con 300 ms en el relé, la prueba de humo `f_futbolito` es jugable (revisión del usuario en 2 teléfonos reales) |
| **M4 · Economía y tablero completo** | Objetos, tiendas, peajes, atajos de pago, ataques, Cambiazo, duelos (1v1 en vivo), arte del mapa completo, eventos de Deltamacura, dados de personaje opcionales | Simulador de balance de 10 000 partidas dentro de los rangos del doc 05; revisión visual del usuario |
| **M5 · Catálogo y retos** | 16+ minijuegos en vivo (todos los de la tabla §6.8 que pasen el filtro), los 3 retos épicos, Relámpago (casilla y opción de configuración), espectadores | Cada juego nuevo pasa la suite de `fiesta-live.test.js` y un bot de `probar.js` en 4 instancias con reloj virtual |
| **M6 · Final y publicación** | Estrellas bonus, final, pulido de reconexión, pruebas de carga y publicación | (1) Carga: 50 salas × 4 bots (act, tick, sig) durante 10 min: SQLite p95 <50 ms al escribir y `sig` dentro de 7200/60. (2) Partida de 15 turnos en <45 min con 4 personas reales, 2 de ellas con datos móviles (revisión manual). (3) Cero `fiesta_desync` en la telemetría de esa partida |

**Equivalencia con los planes de 08 §10 y 09 §16** (este cuadro manda en el orden):

| 07 | 08 | 09 | Nota |
|---|---|---|---|
| M0.5 | I1 | N0 | `fiesta-net.js` + reloj + fakes; reglas puras |
| M1 | — | N3 | Lobby, tablero en vivo, director |
| M2 | I2, I3, I4, I5 | N1, N2 | Runtime en vivo + 3 juegos (`f_mecate`, `f_domino`, `f_harina`) |
| M3 | §10.2 juegos 4-6 | N4 | `f_chancla`, `f_patilla`, `f_futbolito` |
| M5 | Oleadas 2-6 | — | Catálogo |
| M6 | — | N5 | Carga |

El 09 ponía el runtime de minijuegos (N2) **antes** que el tablero (N3). Se puede: M1 y M2 solo comparten M0.5, así que pueden ir en paralelo. Si hay un solo constructor, el orden lo decide el usuario (P9).

---

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| **Relé HTTP lento** (5-7 req/s a 200 ms) degrada el modelo C | Predicción del avatar propio, envío por par, malla calentada durante la tarjeta, snapshots ≤420 B. Diseñar para el relé aunque haya P2P |
| **Sin TURN:** NAT simétrico o redes móviles ⇒ todo por relé y voz caída | El juego funciona solo con el relé. Evaluar un TURN gestionado (P2) |
| **Ventaja o trampa del juez** | Elección por RTT, rotación, `fairDelay`, hashes de testigos, `limites` en el servidor y snapshots públicos |
| **Dos jueces durante una partición** | CAS con `epoch` en el servidor (D9) y descarte de mensajes con `e` viejo |
| **Todos en segundo plano** ⇒ nadie hace `tick` y la partida se pausa | Aceptado (no hay temporizador de servidor). Al volver, alcance con SNAP |
| **Carga del servidor** (unas 40 req/s por sala en los minijuegos, con lectura de BD en cada `relay`) | Caché en `$app.store()` y prueba de carga en M6 |
| **Goja:** `require` relativo y el costo de `JSON.parse(JSON.stringify)` por acción (`fiesta-reglas.js:33`) | **(por verificar)** con un benchmark en M0.5; con unos 12 KB debería alcanzar |
| **Tamaño del registro** al crecer el log o los fx | Anillo de 16, log de 30 y prueba de tamaño tras 20 rondas |
| **Choque de globales con el motor** si alguien carga `js/core.js` en la página | D11: `fiesta-net.js` no depende de `core.js`, más una prueba e2e que carga `fiesta.html` sin errores |
| **Ritmo de la partida** (cinemáticas + 4 plazos) | Plazos sumados a `fxMs`, CPU en <0,5 s, alcance ×2/×3 y AFK rápido por presencia. Meta: 15 turnos en <45 min |
| **Doble carga en producción** (§1.5) | D16 en M0.5 |
| **iOS mata SSE/WebRTC** en segundo plano | Reapertura al pasar a visible, sondeo inmediato, `mine` y tarjeta de resumen |

---

## 12. Preguntas abiertas para el usuario

1. **P1 · Formato de la ronda por defecto.** Mario Party usa **1 minijuego de 25-60 s por ronda**. Antes pediste explícitamente el **Relámpago de 5** microjuegos. Recomiendo «clásico» por defecto (más cercano a Mario Party y a «juegos de verdad»), con el Relámpago como casilla especial y como opción en la configuración. ¿Te parece?
2. **P2 · Servidor TURN.** Sin TURN, algunas redes van todo por relé y sin voz. ¿Pagamos un TURN gestionado (unos pocos USD al mes, **(por verificar)**) o seguimos solo con STUN?
3. **P3 · Objetos en mano públicos** (todos ven lo que tiene cada uno, como en Superstars). Simplifica mucho la privacidad. ¿Ok?
4. **P4 · Dados de personaje** (estilo Super Mario Party): ¿apagados por defecto, con los personajes solo cosméticos?
5. **P5 · Volver a mitad de un minijuego** — **resuelta (D14):** el dueño original que se cae y vuelve retoma en caliente; quien toma un asiento de CPU nuevo juega desde el siguiente minijuego.
6. **P6 · Espectadores** (un 5.º en adelante): en v1 se permiten **sin voz** (la malla de voz no admite un 5.º par; D18 y §8.3). ¿Se dejan así, o fuera del todo?
7. **P7 · Roster de 8:** ¿confirmas TÚ, MAMÁ, LA ABUELA, EL TÍO, EL PANA, LA PRIMA, EL COBRADOR y EL PORTU, o cambias alguno?
8. **P8 · Personaje al tomar un asiento de CPU.** Pediste que cada jugador elija personaje. Quien entra a mitad de partida hereda monedas y estrellas del asiento; propongo que **pueda elegir entre los personajes libres** (o quedarse con el de la CPU), siempre que `dadosPj` esté apagado. Con dados de personaje, se hereda el de la CPU para no cambiar el balance. ¿Ok?
9. **P9 · Qué se construye primero:** el tablero en vivo (M1) o los minijuegos en vivo (M2). Recomiendo **M2 primero**: es lo más arriesgado (red en tiempo real) y lo que más se nota como «juegos de verdad».
10. **P10 · Confianza en el juez.** El RTT que decide quién es juez lo declara cada cliente y el juez firma el resultado. Entre panas basta; si se publica la sala para desconocidos, habría que endurecerlo (medir el RTT en el servidor y rotar al juez a mitad de juego). ¿Lo dejamos para después?

---

## 13. Qué cambia en los otros docs

- **Doc 04:**
  - El Relámpago de 5 deja de ser el ciclo obligatorio (D6, pendiente de P1).
  - Los Épicos se mantienen y se juegan en vivo.
  - La tabla de pagos por microjuego aplica solo al Relámpago.
- **Doc 06:**
  - §5 (hot-seat, `fiesta-entrada.js`, pads) queda reemplazado por §5 y §6.6 de este doc.
  - §6.2 («rankear un juego viejo en secuencial») ya no aplica.
  - Los hitos de §11 quedan reemplazados por §10 de este doc.
- **`fiesta-vs.js`:** obsoleto (§5.5); se borra en M3.
- **Este doc no modifica código.** Los cambios de servidor y cliente se hacen en sus hitos.
