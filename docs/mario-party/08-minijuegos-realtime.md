# 08 · LA FIESTA: minijuegos EN VIVO (24 + 3 épicos), contrato, flujo y pruebas

> Fecha: 2026-10-17. Autor: diseño/arquitectura. Estado: propuesta para construir.
> Directiva del usuario, que manda sobre cualquier otro documento: **multijugador real**, con cada persona en su dispositivo y **todo en vivo**, tanto el tablero como los minijuegos. **No hay fantasmas, ni repeticiones, ni misma pantalla.** Los modos son todos contra todos (supervivencia o por puestos), 2v2 y 1v3, «lo más parecido a Mario Party que se pueda», con juegos de verdad. El estándar es el que ya existe en DUO/SQUAD: varios jugadores dentro del MISMO juego, en vivo. Se empieza con un mínimo de 2 humanos y la CPU rellena hasta 4. Cada jugador elige personaje. Un humano puede entrar a mitad de partida y quedarse con el asiento de una CPU. Todo vive en el mundo Venezuela (`docs/style-lab/fiesta.html`).
>
> **Revisión cruzada 2026-10-17:** nombres, campos y plazos alineados con el glosario de `07-multijugador-online.md` §2.1, que manda si algo discrepa (rutas `ready`/`juez`/`mjfin`/`mjack`, reloj `now`, `mj.e`, cierre a `startAt + dur + 3 s`, un `o` por emisor, `i` solo en C). Este doc manda en el catálogo y en el contrato de autor.
>
> Las rutas son relativas a la raíz del repo. Las afirmaciones que no se han comprobado en el código ni en una prueba llevan **(por verificar)**. Los «ecos» de Mario Party vienen de memoria y llevan **(por verificar)** salvo los que son evidentes.

---

## 0. Resumen en una pantalla

| Tema | Decisión |
|---|---|
| Unidad de juego | **UN minijuego en vivo de 25-60 s por ronda de tablero**, como en Mario Party. La ronda de 5 rápidos (Relámpago) del doc 04 deja de ser el ciclo principal y queda como casilla o evento especial. |
| Formato | Lo decide el color de las casillas al cerrar la ronda (doc 04 §2.2 / doc 05 §16): 4 iguales → todos contra todos (FFA, por puestos o supervivencia); 2+2 → 2v2; 3+1 → 1v3. |
| Red | El patrón de DUO/SQUAD (`duoCtx` en `js/party.js:207`, `wire()` en `js/games/du1.js:73`), sacado a un módulo propio, `docs/style-lab/fiesta-net.js`, y ampliado con reloj de servidor, juez elegido, migración del juez y asientos de CPU. |
| Modelos de autoridad | **A** cancha propia · **B** dueño + juez · **C** el juez simula. El lockstep (L) queda fuera de la v1 (§2). |
| Juez | Un humano por minijuego. Lo elige el servidor en la carta, por menor RTT. Corre las CPU, arbitra lo disputado y firma el resultado. Si se calla, migra por compare-and-set en el servidor. |
| Resultado | El servidor solo acepta `fin` del juez de la época vigente. Los demás mandan `ack` como testigos. El servidor convierte puestos en monedas dentro de la misma transacción. |
| Contrato | `FIESTA.LIVE.add(id, def)`. Extiende `FIESTA.VS.add`, así que los 5 juegos portados conservan su `update()`. |
| Rebanada vertical | `f_mecate` → `f_domino` → `f_harina` → `f_chancla` → `f_patilla` → `f_futbolito`: los 4 modos y los 3 modelos. |
| Pruebas | Arnés sin pantalla con `memRelay` (latencia, jitter, pérdida, límites de 512 B y 10 mensajes, caída del juez). La prueba exige el mismo veredicto en todas las pantallas a 50, 150 y 300 ms. |

---

## 1. Lo que hay hoy y lo que se reutiliza

### 1.1 El estándar en vivo (DUO/SQUAD), comprobado en el código

- **Contexto del juego.** `duoCtx` (`js/party.js:207-222`) entrega `{role, roles, partner, seats, byRole, send(t, d, latest), onMsg(fn(t, d, rolRemitente, idRemitente))}`. Los roles rotan con `(asiento + ronda) % n` (`:211`). `onMsg` reproduce el búfer de mensajes que llegaron antes de construir el juego (`:203-204`, hasta 80).
- **Mismo nivel en todos.** `main.js:294` construye el juego dentro de `withSeed(R.seed, …)`. Todo el azar se saca en el constructor (`du1.js:2-8`).
- **Remotos interpolados.** `track()` (`du1.js:27-38`) dibuja al remoto `LAG = .15` s en el pasado. Ojo: estampa con la hora de **llegada**, no con la del emisor. Lo corregimos en §4.3.
- **Veredicto.** `DUO.wire(g, D, rolJuez)` (`du1.js:73-82`): el juez termina `END_SLACK = .6` s antes y manda `end`; los demás lo esperan hasta `DUO_WAIT = 1.5` s (`main.js:359`).
- **Patrones probados** que copiamos:
  - El dueño publica su estado: `squad/storm.js:15-19`, `squad/pit.js:10-12`.
  - Cada uno se juzga contra el reloj sembrado: `duo/granny.js:14`, `duo/beat.js:10`.
  - Ventana de gracia para pulsaciones que vienen en camino: `duo/crane.js:12-14, 476-478`.
  - El juez juzga «lo que RECIBIÓ», para que el lag no cueste un atrape: `squad/blanket.js:15-17`.
- **Transporte.**
  - **WebRTC.** Malla de hasta 3 pares (`js/link.js`). Canal `f` sin orden y sin reintentos, para lo «último gana»; canal `r` fiable (`link.js:66`). Envía cada 20 ms (`js/party.js:242`).
  - **Respaldo HTTP** `/api/party/sig`: una petición en vuelo, `SIG_GAP = .05` s, ≤10 mensajes y ≤512 B por lote completo, sobre incluido (`pb_hooks/party.js:396, 552`).
  - **El techo real del respaldo es min(20, 1/RTT) peticiones por segundo**: unas 5-7/s a 150-200 ms. Se diseña para ese techo aunque haya P2P.
  - **Dedupe.** Por `(de, ronda, época, n)`; los mensajes «último gana» se deduplican **por tipo** (`js/party.js:189-195`).
  - **Problema.** `linkUsable()` es todo o nada (`link.js:12`): si falla un solo par, toda la sala cae al HTTP.
- **Pruebas que ya sirven de molde.** `test/duo.test.js:22-35` y `test/squad.test.js:23-37` montan relevo en memoria con retardo y bots por rol. Exigen cero discrepancias de veredicto a 50, 150 y 300 ms, y exactamente un juez (`squad.test.js:52`). `test/party-network.test.js:10-30` falsea `RTCPeerConnection` y `fetch` alrededor del `link.js` real.

### 1.2 Lo que ya existe en el lab para LA FIESTA (de momento solo misma pantalla)

- **Juegos.** `juego-f-machaca.js`, `juego-f-f_cola.js`, `juego-f-f_domino.js`, `juego-f-f_harina.js` y `juego-f-f_tequeno.js`, sobre `FIESTA.VS` (`docs/style-lab/fiesta-vs.js`).
- **El contrato ya es por asiento**: `c.held(p, b)`, `c.tap(p, b)`, `c.rng`, `c.cpu[]`, `c.skill[]` y `g.ai(p, dt, api)`. Pasar a red solo cambia **de dónde llega la entrada** del asiento `p`. Se descartan los pads compartidos (`padRect`/`hitPad`/`drawPads`) y el mapeo de teclas por jugador (`KEYS`).
- **Se conservan** `compara(modo, eq, sc)`, `equipos()` y `rngMk()`. Son UMD-friendly y el servidor también los usa.
- **Reparto.** `BUS.AP.CAST` (`juegos-bus.js:385-393`: mama, vecina, abuela, tio, chuo, pana), `BUS.TU` y `FACES[0..11]` (`engine.js:1024-1036`).

### 1.3 Bloqueos conocidos (detalle en el doc 07 y en el futuro doc de red)

1. **Choque de nombres.** `engine.js` redeclara nombres de nivel superior de `core.js` (`W`, `H`, `ctx`, `now`, `txt`…). Por eso `js/party.js`, `link.js` y `voice.js` **no se pueden cargar** en `fiesta.html`.
2. **Reloj congelado.** El `now` del lab se congela fuera de los juegos (`engine.js:1496-1499`). La red necesita su propio reloj.
3. **Servidor.**
   - No existe el modo `fiesta` en `MODES` (`party.js:8`).
   - `sigPayload` solo deja pasar mensajes en `state === 'round'` (`:493`) y rechaza entradas que no son de DUO (`:543`).
   - No hay reloj de servidor en las respuestas.
   - `addPlayer` solo funciona en el lobby (`:102`), y para volver a entrar se exige no haber salido (`left`) (`party_routes.js:48`).

---

## 2. Conciliación de los análisis (conflictos y cómo se resuelven)

Cuatro análisis llegaron con nombres y decisiones distintas. Esto es lo que queda **vinculante**:

| # | Conflicto | Opciones que aparecieron | **Decisión** y por qué |
|---|---|---|---|
| 1 | Nombres de los modelos de red | El análisis 2 usaba A (dueño), B (el juez simula), C (lockstep) y D (paralelo cronometrado). El análisis 3 usaba A (cancha propia), B (dueño + juez) y C (el juez simula). | **A / B / C del análisis 3.** El «D» del análisis 2 (reacción, memoria) se integra en **A**: también es cancha propia con reloj compartido. El lockstep pasa a llamarse **L** y **no entra en la v1**: en el HTTP se atasca, y los juegos de ritmo funcionan igual de bien en A con reloj sincronizado. Tabla de equivalencias en §4.1. |
| 2 | ¿Un juego o cinco por ronda? | El análisis 4 mantenía `mj` con 5 rápidos (doc 04). El análisis 3 proponía uno largo. | **Uno de 25-60 s por ronda** (Mario Party). Se conserva el mecanismo de cola con horas absolutas del análisis 4, pero con `cola.length = 1`. El **¡RELÁMPAGO!** queda como casilla especial: 3 microjuegos FFA de 10 s, con la misma cola. |
| 3 | Elección del juez | El humano de id más bajo (análisis 1), el de mejor RTT con rotación (2), el de menor RTT que no sea el solo del 1v3 (3), o el humano presente más bajo (4). | **Lo elige el servidor al abrir la carta**: el humano conectado con menor RTT mediano, que llega en los `hb`. Excepciones: en 1v3 no puede ser el solo si algún miembro del trío está a ≤40 ms. Los empates (±15 ms) rotan con `(k + ronda) % n`. Si no hay datos de RTT, el asiento humano más bajo. |
| 4 | Migración del juez | Que se promueva solo a los 2 s (análisis 1, 3) o compare-and-set en el servidor a los 1,2 s (análisis 2). | **CAS en el servidor**: `POST /api/party/juez {k, e, tick}` (`e` = la época que el aspirante ve; el servidor exige `mj.e === e` y pone `mj.e = e+1`). El primer vivo de `mj.suc` lo intenta cuando lleva **1,2 s** sin `s`/`hb` del juez, porque el juez manda `hb` cada 0,5 s y eso equivale a 2 latidos perdidos. Sin CAS podrían quedar dos jueces. |
| 5 | Resultado | Autorreporte en el modelo A (`report`, primero gana) contra `mjfin` del juez con testigos. | **El juez firma `fin` en TODOS los modelos.** En A, el juez arma `fin` con lo que observó de cada asiento y cada cliente manda además su `ack` con autorreporte. El servidor toma el `fin`. Si un autorreporte de A supera lo observado por el juez + margen, gana el valor del juez (análisis 3). Se abandona la regla de «primer reporte gana» (`party.js:226`) para el modo fiesta. |
| 6 | Entrar a mitad de minijuego | Tomar el asiento en caliente (análisis 1) o esperar al siguiente límite (2, 3, 4). | **En el siguiente límite** (carta del próximo minijuego o siguiente aviso del tablero). Mientras tanto se mira EN VIVO, gratis, porque los snapshots se difunden. Lo que sí es en caliente es la **desconexión → CPU** y el **regreso → humano** del dueño original del asiento (§7). |
| 7 | Gracia del cierre | `GRACE_MS = 8000` actual, 2 s (análisis 4) o 1,5 s (`DUO_WAIT`). | El juez termina a `dur` y difunde `end`. Los no jueces esperan `end` hasta `dur + 1,5 s`. El **servidor** cierra a `mj.cierre = startAt + dur + 3 s` (1,5 s de espera + error de reloj + viaje de `mjfin`; doc 09 §5.2). 8 s dejaría a 3 personas mirando un congelado. |
| 8 | Nombre del módulo de red | `fiesta-net.js` con dependencias inyectadas (análisis 1) contra `fiesta-red.js` como adaptador de `link.js`/`voice.js` sin cambios (análisis 4). | **`fiesta-net.js`.** El adaptador no resuelve el `now` congelado ni el `linkUsable` todo-o-nada, y las globales de `party`/`pcall`/`t` chocan con el lab. `voice.js` se porta sin la interfaz en una fase posterior. |
| 9 | Contrato de autor | Simulación pura `{init, step, pack, unpack, draw(S)}` (análisis 2) contra cierre al estilo VS con `c.yo`, `c.claim`… (análisis 3). | **Un solo contrato con dos niveles** (§5): el estilo VS (`update`/`draw`/`scores`/`fin`) para A y B, y **además** `pack`/`unpack` (y `restore`) obligatorios en C y en cualquier juego con `migra: true`. Los ports quedan casi intactos. |
| 10 | Nombres de los mensajes | `i/o/s/s2/ev/end/jg/L/rdy` contra `in/st/sn/cl/ok/hit/out/fin/pass`. | **Tabla única** en §4.4. `i` es entrada, `o` estado del dueño, `s`/`s2` snapshot del juez, `cl`/`ok` reclamo y concesión, `ev` eventos, `end` veredicto. `hit`, `out` y `pass` pasan a ser subtipos de `ev`. |
| 11 | 1v3: ¿media o binario? | `compara()` (solo contra la media del trío) o `win1v3(S)` propio de cada juego. | Cada 1v3 del catálogo declara **meta binaria** (`ganaSolo(S)`). `compara` queda como respaldo cuando un juego no la declara. |
| 12 | RNG en el estado público | `fiesta-reglas.js:20, 27` guarda `semilla` y `rng` en S. | Fuera de este documento, pero obligatorio. El RNG del tablero vive en `keys._f`. La **semilla del minijuego sí es pública**: todos tienen que construir el mismo nivel. No es secreta porque el minijuego no se puede «predecir» con ventaja más allá de lo que se ve en pantalla. |

**Qué se retiró del doc 07** (ya integrado en la versión 2 de 07; las secciones citadas eran de la versión 1):

- §2.6 «Paralelo v1 + fantasmas (party-ghost.js)»: **retirado**. Todos los minijuegos son en vivo.
- §2.7 «Ronda de 5 rápidos»: **sustituida** por un minijuego por ronda (decisión 2).
- §2.8 «`fiesta-vs.js` deja de usarse»: **matizado**. Se dejan de usar sus pads de misma pantalla; su contrato y `compara` se conservan.
- Hitos M2 y M5: los minijuegos en vivo pasan a ser **M2** y no hay respaldo de paralelo con fantasmas.

---

## 3. Flujo de un minijuego para 4 clientes

### 3.1 Línea de tiempo (horas del SERVIDOR)

```
fin de ronda del tablero
 │  servidor: formato por colores → bolsa filtrada por formato y nº de humanos → juego, semilla, equipos, juez
 ├─ RULETA         4,5 s   todos animan la ruleta que cae en el resultado ya decidido
 ├─ CARTA          ≤15 s   instrucciones + PRÁCTICA + ¡LISTO!; por debajo: juez, malla, reloj, precarga
 │                         todos los humanos listos (o cartaHasta) → servidor fija startAt = now + 3500
 ├─ CUENTA         3,5 s   «3-2-1-¡YA!» atado a startAt (los 4 gritan ¡YA! con ≈30 ms de diferencia)
 ├─ JUEGO          dur     25-60 s (épicos 60-120 s); el juez cierra a dur, o antes si el juego tiene finTemprano
 ├─ ¡SE ACABÓ!     ≤1,5 s  llega `end` del juez (o se agota la espera) → congelado con la marca final
 ├─ RESULTADOS     5 s     el podio SALE DEL REGISTRO del servidor (los 4 ven lo mismo); se salta a los 2 s si todos tocan
 └─ vuelta al tablero: lote de efectos de pago (monedas volando a cada HUD) → turno del primero en el orden
```

### 3.2 Estado en el registro (`board.mj`, público)

```js
// forma canónica: doc 07 §3.2 (aquí, comentada)
mj: {
  k: 17,                      // nº de minijuego en la partida (alimenta room.round y el alcance 'm:17')
  tipo: 'ffa'|'2v2'|'1v3'|'1v1',   // formato ('1v1' = duelo)
  clase: 'rank'|'survival'|'binary',
  eq: [['a','c'],['b','d']],  // equipos por letra de asiento (en el contexto c se traducen a índices)
  solo: null|'a'..'d',
  cola: [{ g: 'f_chancla', seed: 2958113, dur: 45, lv: 2, modelo: 'B', reto: false }], i: 0,
                              // seed pública: todos construyen el mismo nivel; lv = día/atardecer/noche (window.NIVEL)
  juez: 'b', suc: ['c','a'], e: 0,
  cartaHasta: 1792000000000,  // ms servidor; la fase visible (ruleta/carta/cuenta/juego) se DERIVA de board.f + startAt + serverNow()
  listos: {a:1, c:0},         // solo humanos; las CPU siempre están listas
  startAt: null|ms, cierre: null|ms, watch: 0,
  res: null | { puestos:[..], scores:[..], ganadores:[..], monedas:[..], cpu:['d'], disputado:false, destacado:'aguantó 41 s' }
}
```

### 3.3 La carta (≤15 s)

- **Qué muestra:**
  - El nombre del juego en grande.
  - Un **banner del formato**: FFA con 4 bustos; 2v2 con marcos de color por equipo; 1v3 con el solo en el centro y el texto «¡TÚ CONTRA TODOS!».
  - El objetivo en una línea.
  - Un cuadro **«¡CÓMO SE GANA!»**.
- **Tarjeta de controles.** La ilustración táctil y la de teclado, lado a lado, con un **demo animado por rol** (el patrón `DEMOS`, `du1.js:43`). En 1v3, el solo ve primero su propio rol.
- **PRÁCTICA.** Mientras se espera, la persona puede probar sus controles en un arenero del juego. Lo corre el juego mismo con `c.practica = true`: semilla local, sin red y sin puntaje. **Nunca usa la semilla real**, para que nadie se aprenda el nivel.
- **Botón ¡LISTO!** Envía `POST /api/party/ready {on:true}` (no `act`: `act` solo lo acepta el asiento del aviso del tablero) y, por cortesía, un `rdy` por el relé para que el ✓ salga antes que el SSE. El retrato de cada asiento muestra ✓ al quedar listo.
- **Trabajo invisible durante la carta:**
  1. Ráfaga de 5 pings de reloj (§4.2).
  2. Calentar la malla WebRTC.
  3. Los clientes mandan su RTT en el `hb` y el servidor elige al juez (decisión 3) y lo escribe **antes** de fijar `startAt`.
  4. Precargar el arte.
- **Quien toma un asiento de CPU a mitad de partida** espera en esta carta y entra al juego con todos.

### 3.4 Cuenta, juego y fin

- **Bloqueo de entrada.** No se acepta entrada mientras `gt < 0`, donde `gt = (serverNow() − startAt) / 1000`.
- **HUD.** Fila superior de 4 fichas: retrato, puntaje o corazones en vivo, y marco de equipo. Se respeta la franja de 64 px de arriba del lab. El juez **no** lleva marca visible.
- **Fin.** El juez cierra cuando `gt ≥ dur`, o cuando `done(S)` es cierto en juegos con `finTemprano` (por ejemplo, ya hay un único sobreviviente).
  1. Difunde `end {e, k, sc, pl, h}`.
  2. Llama a `POST /api/party/mjfin`.
  3. Los demás congelan al recibir `end`, o a `dur + 1,5 s` con su último snapshot.
  4. Mandan `mjack`.
- **El podio sale del registro**, nunca del `end`: el `end` solo congela la pantalla y muestra «¡SE ACABÓ!».

### 3.5 Resultados

- **Podio con los personajes.** El ganador baila con su `bust` de ánimo `grin`; los perdedores, `sad`.
- **Monedas.** Vuelan a cada contador. **Solo el servidor las escribe**, en la misma transacción que aplica `MJ_RESULT` con el reductor de `fiesta-reglas.js`.
- **Cifra destacada.** «¡12 cotufas!», «aguantó 41 s», «¡3 patillazos!».
- **Línea de humor según el resultado.** «El que no llora no mama… y tú lloraste», «¡Mi paaana, te barriste!».

---

## 4. Red en vivo para minijuegos

### 4.1 Los tres modelos (y su equivalencia con los análisis)

| Modelo | Quién manda | Para qué | Equivalencias |
|---|---|---|---|
| **A · CANCHA PROPIA** | Cada cliente simula y juzga **a sí mismo**. Los peligros, el ritmo y el «fiscal» son función pura de `(seed, gt)`. Los rivales se ven EN VIVO por `o`. | Carreras por carril, ritmo, «Simón dice», mecate, reacción, memoria, armado. | A del análisis 3; A sin contacto y D del análisis 2. |
| **B · DUEÑO + JUEZ** | Cada uno es dueño de su cuerpo (como en A). Los **objetos compartidos** (cotufas, la harina, la bombita, los mangos) son del JUEZ: `cl` → `ok`, y gana el `t` más temprano dentro de **120 ms** (`crane.js:12-14`). **Los golpes los juzga la víctima** contra su propia posición. Toda amenaza se telegrafía **≥0,5 s**. | Recolectar, quitársela al otro, esquivar proyectiles, papa caliente, casi todos los 1v3. | B del análisis 3; híbrido A+B del análisis 2. |
| **C · EL JUEZ SIMULA** | El juez corre la física completa a 30 Hz con las entradas `i` reenviadas y difunde `s`. Cada cliente **predice su propio avatar** (`predict`) y corrige suave: mezcla en 150 ms si el error es mayor de 8 px y salta si es mayor de 64 px. **`fairDelay`**: al juez se le aplican sus propias entradas con la mediana de la latencia de ida de los demás (tope 120 ms). | Contacto entre cuerpos, balón o bola compartida, cuerda. | C del análisis 3; B+P del análisis 2. |
| **C·equipo** | Variante de C en la que el «juez» de un vehículo de equipo es **un miembro de ese equipo**: el humano del equipo con menor RTT. Es como dos DUO uno al lado del otro. El juez global solo firma el resultado. | Carrucha, curiara del Delta. | C por equipo del análisis 3. |
| *(L · lockstep)* | — | **Fuera de la v1.** | C del análisis 2. |

**Latencia esperada, objetivo 200 ms de RTT** (estimaciones, por verificar con el arnés):

- **A.** Tu personaje: 0 ms. Los rivales: unos 220 ms atrás, sin importancia porque no hay contacto.
- **B.** Tu personaje: 0 ms. Los objetos disputados se confirman en unos RTT + 120 ms, con animación optimista y «¡te lo quitaron!» si pierdes.
- **C.** Tu personaje: 0 ms, porque se predice. La pelota y los empujones: unos RTT + D (≈300-450 ms en el HTTP), aceptable solo con telegrafía. **Por eso en el catálogo C se reserva para 4 juegos.**

### 4.2 Reloj compartido

- **Marca de hora del servidor.** Cada respuesta de `/api/party/*` lleva `now: Date.now()`, y cada mensaje que pasa por el relevo lleva `at`.
- **Desfase.** El cliente guarda las últimas 10 muestras de `off = st − (t0 + t1) / 2` y usa la de menor RTT. Con eso, `serverNow() = Date.now() + off`. Error esperado: menos de 30 ms (por verificar).
- **Hora de juego.** `gt = (serverNow() − mj.startAt) / 1000`. Inicio, fin y peligros se programan con `gt`, igual en todas las pantallas.
- **Reloj propio.** `fiesta-net.js` usa `performance.now()` y **nunca el `now` del lab**, que está congelado fuera de los juegos.

### 4.3 Interpolación de remotos (arreglo de `track()`)

- **Estampa del emisor.** Cada `o`/`s` lleva `t` = gt del emisor en ms. El remoto se dibuja en `gt − D`, interpolando entre los dos estados del búfer que rodean ese instante. Se interpola con la hora del **emisor**, no la de llegada.
- **Retardo D adaptativo.** `D = clamp(1.5 × intervaloObservado + 2 × σ_jitter, 100, 250 ms)`, recalculado cada segundo.
- **Búfer vacío.** Se extrapola con la velocidad hasta 100 ms y luego se congela.
- **Campos discretos** (vidas, dueño, estado): se toma el más nuevo, sin interpolar.
- **API para el autor:** `c.remoto(p)` devuelve `{x, y, vx, vy, st, sc, …}` ya interpolado.

### 4.4 Mensajes (tipo `t` ≤12 caracteres; *l* = último gana)

| Tipo | Canal | Emisor → | Carga | Frecuencia | Tamaño típico |
|---|---|---|---|---|---|
| `i` | *l* | humano → todos | `{k, b: bitmask, a: [ta, tb], x?, y?}`: taps **acumulados** (perderlos no pierde toques), eje de -100 a 100 | al cambiar, ≤20 Hz, más 4 Hz de keepalive | ≤40 B |
| `o` | *l* | dueño (A/B) | `{k, t, b: [[asiento, x, y, vx, vy, st, sc], …]}`: **un solo `o` por emisor**; el juez mete su cuerpo y los de las CPU (la fusión latest es por tipo y emisor: varios `o` se pisarían) | 10-15 Hz | ≤60 B por cuerpo |
| `s` | *l* | **solo el juez** (C) o estado de objetos del juez en B | `{e, k, t, p: [[x, y, st, sc] × n], w: [...]}` | `snapHz`: 10 por defecto (15-20 en P2P) | ≤300 B recomendado, 420 máx. (con 420 no cabe nada más en el lote de 512) |
| `w` | *l* | solo el juez, por HTTP | paquete para mirones sin P2P (doc 07 D18) | ≤5 Hz, solo si `mj.watch > 0` | ≤420 B |
| `s2` | *l* | solo el juez | desbordamiento de `s` (el dedupe es por tipo) | igual | ≤420 B |
| `cl` | fiable | dueño → juez | `{id, t}` reclamo de un objeto | por evento | ≤30 B |
| `ok` | fiable | **solo el juez** | `{e, id, p}` concesión (`p = -1` si nadie) | por evento | ≤30 B |
| `ev` | fiable | juez / víctima / dueño | `{e, k, ty: 'out'\|'hit'\|'pass'\|'shot'\|'cpu'\|'hum'\|…, p?, d?}` | por evento | ≤80 B |
| `end` | fiable | **solo el juez** | `{e, k, sc: [...], pl: [...], h}` | 1 | ≤120 B |
| `hb` | *l* | todos | `{rtt, vis}`; además, cada 2 s va **siempre por HTTP** como presencia (doc 07 D20) | 2 Hz | ≤20 B |
| `jg` | fiable | juez nuevo | `{e, k}` tras ganar el CAS | 1 | ≤20 B |
| `x*` | libre | juego | **tipos propios del juego, con prefijo `x`** (`xtiro`, `xpasa`…) | — | ≤200 B |

- **`i` solo en C/Ceq** (o en un A/B que declare `entradas: true`). En A/B el dueño simula su cuerpo y manda `o`; mandar también `i` a 20 Hz pasaba el tope de 25 msg/s por emisor en el relé.
- **Reservados.** El runtime reserva `i o s s2 w cl ok ev end hb rdy jg aim react _net_ping _net_pong frame`. Un juego que mande uno de esos tipos **falla la prueba** (§9).
- **Validación en el servidor** (`sigPayload`, rama `fiesta`):
  - Lista blanca de tipos, más el patrón `x[a-z0-9]{1,11}` para los tipos propios del juego (sin esto, el servidor los rechazaba).
  - `s`, `s2`, `ok` y `end` solo se aceptan de `mj.juez`.
  - Unos 25 mensajes/s por emisor, con el `limitRoom` existente (`party.js:431-445`).
  - El alcance `m:<k>` vale con `board.f ∈ {carta, mj}` (en la carta hacen falta `rdy`, `hb` y los pings de la malla). El alcance `b` (tablero) acepta `hb`, `react` y `aim` en cualquier fase. El alcance va en el cuerpo de la petición (doc 07 D21).

### 4.5 Presupuesto y transporte

- **Tamaño por carga.** Cada carga ≤420 B, para caber en los 512 B junto con el sobre (unos 30 B por mensaje). Se diseña para el respaldo HTTP **siempre**, porque se puede caer a él en cualquier momento.
- **Dos carriles HTTP por cliente**, cada uno con una petición en vuelo, como el carril de `frame` (`js/party.js:229-238`): uno para «último gana» (`i`, `o`, `s`) y otro fiable (`cl`, `ok`, `ev`, `end`). Así un snapshot no espera detrás de un evento.
- **Ruta por par** en vez de todo o nada: P2P a los pares abiertos y relevo solo hacia los que no. El dedupe por `(de, ronda, v, n)` hace segura la duplicación.
- **Carga en el servidor** (por verificar con prueba de carga): unas 40 peticiones/s por sala en el peor caso, todo por HTTP. Se cachea `{code → id, keys, juez, ronda}` en `$app.store()` con TTL de 1 s, para que `relay()` no lea ni parsee el registro en cada mensaje.

### 4.6 El juez: tareas, migración y desconexión

- **Tareas:**
  1. Corre `g.ai(p, …)` de cada CPU, y de cada humano que se haya vuelto CPU por desconexión.
  2. Difunde el estado de esas CPU como si fueran humanos: dentro de **su propio** `o` en A/B (un solo `o` con varios cuerpos), dentro de `s` en C.
  3. Concede reclamos.
  4. En C, simula.
  5. Verifica lo que reportan los dueños: velocidad ≤ vmax × 1,2; un salto mayor que 2 × vmax·dt se rechaza y se mantiene el último estado bueno; taps ≤16/s; reacción ≥120 ms.
  6. Firma `end` / `mjfin`.
- **RNG separados:**
  - `c.rng` es el mundo: igual en todos y consumido **solo en el constructor**, o solo por el juez en C.
  - `c.rngFor('cpu' + p)` es exclusivo de las CPU.
  - `c.fx` es cosmético, local y sin semilla compartida (el patrón de `storm.js:24`).
  - Si se mezclan, el mundo diverge entre pantallas.
- **Migración:**
  1. Disparo: 1,2 s sin `s`/`hb` del juez.
  2. El primer humano vivo de `mj.suc` llama al CAS `juez {k, e}` con la época que ve.
  3. El servidor sube `mj.e` y el SSE avisa a todos.
  4. El nuevo juez llama a `g.restore(últimoSnapshot)` y sigue desde `k`.
  5. Los juegos con `migra: false` terminan ahí, con los puntajes del último snapshot como veredicto.
  6. Los mensajes con `e` menor que la época vigente se ignoran.
- **Desconexión:**
  - **Caída.** Un humano sin `i`/`o`/`hb` durante 2 s (`SIG_AWAY`) se vuelve CPU: el juez difunde `ev {ty: 'cpu', p}` y retoma su cuerpo desde el último estado. El HUD lo marca como «(se le fue el internet)».
  - **Regreso del mismo dueño.** Tras 0,5 s de entradas de vuelta: `ev {ty: 'hum', p, d: estadoCuerpo}` y el dueño retoma desde ahí (doc 07 D14). Un humano **nuevo** que toma el asiento juega desde el siguiente minijuego.
  - **El resultado sigue siendo del asiento**, con la marca `cpu: [p]`, que es solo para estadística.
- **Pestaña en segundo plano.** Al volver se re-sincroniza al estado en vivo, sin repetición. Si el minijuego ya cerró, se ve directamente el podio.

### 4.7 Validación del resultado (servidor)

Cada entrada del catálogo declara `limites: {scoreMax, scoreRate, minT, finTemprano}`. Ante `mjfin` el servidor:

1. Rechaza si `e ≠ mj.e`, si el emisor no es `mj.juez` o si `scores.length ≠ n`.
2. Topa cada score a `[0, scoreMax]` y a `scoreRate × transcurrido` medido con el reloj del servidor.
3. Rechaza un fin anterior a `startAt + minT` salvo que el juego tenga `finTemprano`.
4. Recalcula los puestos con `compara()` / `ganaSolo`. **No confía en `pl` del cliente.**
5. Si el hash `h` del juez no coincide con el de ≥2 testigos `mjack`, marca `disputado: true`. Se registra, pero el veredicto se mantiene: es un juego entre panas.
6. Sin `mjfin` en `mj.cierre = startAt + dur + 3 s` (doc 09 §5.2: 1,5 s de espera + error de reloj + viaje), usa el `mjack` de mayor `k`. Sin ninguno, la ronda queda **empatada sin monedas**: «Se fue la luz en todo el país».

---

## 5. Contrato de autor: `FIESTA.LIVE.add`

### 5.1 Definición

```js
FIESTA.LIVE.add('f_chancla', {
  name: '¡LLUEVEN CHANCLAS!',
  modos: ['ffa'],                       // formatos donde puede salir: 'ffa' | '2v2' | '1v3' | '1v1' (duelo, n = 2)
  clase: 'survival',                    // 'rank' | 'survival' | 'binary'
  modelo: 'B',                          // 'A' | 'B' | 'C' | 'Ceq'
  dur: 45, stick: true, botones: 1,     // botones: 0-2 (A, B)
  snapHz: 10, migra: true,
  minHumanos: 1,                        // cuántos humanos necesita para tener sentido (bolsa del servidor)
  limites: { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: true },
  carta: {
    obj: 'Esquiva las chanclas de mamá. Al segundo chancletazo, ¡fuera!',
    gana: 'El último en pie. Si quedan varios, empatan arriba.',
    como: { tactil: 'Joystick para moverte · A para meterte bajo la mesa', teclado: 'WASD/flechas · Espacio' },
    roles: null,                        // en 1v3: { solo:{obj,como}, trio:{obj,como} }
    demos: [ /* pasos del demo animado, patrón DEMOS de du1.js:43 */ ]
  },
  mk(c){ /* ... */ return g; }
});
```

### 5.2 El contexto `c`

```js
c = {
  // identidad y formato
  n, yo /* asiento propio 0..3, o -1 si es espectador */, seats: [{id, name, ch, color, cpu, human, team}],
  modo, equipos, solo, lv, practica /* bool */,
  // tiempo y azar
  ahora() /* gt en s, compartido */, dt /* paso fijo 1/30 en C */,
  rng /* mundo: SOLO en el constructor (o en el juez en C) */, rngFor(tag), fx /* cosmético local */,
  // entrada: igual para local, remoto y CPU
  held(p, 'a'|'b'), tap(p, 'a'|'b') /* consume los toques nuevos */, eje(p) /* {x,y} de -1 a 1 */,
  cpu: [bool vivo por asiento], skill: [0..1],
  // red
  esJuez(), juez, e, send(t, d, {latest}), on(t, fn(d, p)),
  mio(p) /* ¿este cuerpo lo simulo yo? (A/B: p === yo; el juez también para las CPU) */,
  remoto(p) /* estado interpolado de p */,
  claim(id) /* Promise<'ok'|'no'>; optimista */, out(p) /* yo me caí (víctima o dueño) */,
  // pantalla
  campoAbajo: 600 /* sin pads compartidos; los controles del dispositivo van superpuestos (§6) */
};
```

### 5.3 El objeto `g` que devuelve `mk`

```js
g = {
  update(dt), draw(),                 // como en FIESTA.VS: draw solo con las primitivas del lab (rr, ell, txt, bust, FACES, BUS.AP)
  scores: [], fin: false,
  ai(p, dt, api),                     // OBLIGATORIO: api.press('a'|'b'), api.hold(b, bool), api.eje(x, y); usa c.rngFor('cpu'+p)
  // A/B: estado del dueño (si se omite, el runtime publica {x,y,st,sc} de g.cuerpos[yo])
  mio?() -> [ints],  deRemoto?(p, arr, t),
  // C y migra:true: OBLIGATORIOS
  pack?() -> [ints] (≤420 B al serializar),  unpack?(arr),  restore?(arr),  predict?(dt),
  done?(),                            // finTemprano
  ganaSolo?(), ganaEquipo?(),         // binary / 1v3 / 2v2
  destacado?() -> 'aguantó 41 s'
};
```

### 5.4 Ciclo del runtime (pseudo)

```
arranque: mk(c) dentro de withSeed(mj.seed); esperar a que serverNow() >= startAt
cada frame(dt_real):
  si modelo C/Ceq (o entradas:true): enviarEntradaLocal()   // 'i' al cambiar (≤20 Hz) con taps acumulados
  según modelo:
   A:  g.update(dt) con la entrada local; mio() → 'o' a 12 Hz; los rivales vienen de remoto(p)
       si esJuez: además corre ai/update de los cuerpos de CPU y verifica a los dueños
   B:  igual que A; los objetos con claim(); los golpes con ev 'hit' del atacante → la víctima decide
       si esJuez: atiende 'cl' (ventana 120 ms, gana el t más temprano) → 'ok'
   C:  si esJuez: acc += dt; mientras acc ≥ 1/30:
                     entradas = asientos.map(p => cpu[p] ? ai(p) : p===yo ? retrasada(local, fairDelay) : remoto_i[p])
                     paso de simulación; k++
                     cada 30/snapHz ticks: send('s', {e,k,t,p: pack()}, latest)
       si no:      vista = interp(búferSnapshots, gt − D); si predict: fusionarPropio(vista, predict(dt))
                   si 1,2 s sin nada del juez y soy el primer vivo de mj.suc: pedir CAS juez {k, e}
  g.draw()
  si esJuez y (gt ≥ dur o (finTemprano y done())):
       r = resultado(); send('end', r); POST mjfin r
  si no esJuez y (llegó 'end' o gt > dur + 1,5): congelar; POST mjack {h, k, scores}
```

### 5.5 Cómo se adaptan los 5 juegos existentes

- **Envoltorio `legacy`.** Mantiene su `update()` y `draw()`. `c.held/tap(p)` de un asiento remoto se alimenta de su `i`.
- **Por modelo:**
  - **A** (`f_cola`, `f_domino`, `f_tequeno`): cada cliente corre **solo su asiento** con su entrada local, y los otros carriles se dibujan desde `remoto(p)`. Hay que añadir `mio()` (unas 10 líneas).
  - **B** (`f_harina`): `dueño` y `brilloHasta` pasan al juez. El robo se hace con `claim('bolsa')`.
- **Se borra** el uso de `padRect`, `hitPad`, `drawPads` y `KEYS` por jugador.

---

## 6. Controles universales

- **Táctil apaisado.**
  - Joystick flotante: aparece donde aterriza el pulgar izquierdo, dentro del 45 % izquierdo de la pantalla.
  - **A** grande abajo a la derecha. **B** arriba a la izquierda de A, solo si el juego lo usa.
  - **Cada dispositivo muestra SOLO su pad, del color de su personaje.**
- **Teclado.** Stick = WASD o flechas, A = Espacio o J, B = Shift o K.
- **Retrato.** El 800×600 va con franjas, y los controles van en la franja de abajo.
- **Reglas:**
  - Se desactiva el gesto de deslizar → flechas durante el juego.
  - No se gira el dedo en círculos.
  - El machaque dura **como máximo 6 s seguidos**, con pausas (doc 04 §3.2). El tope de 5 pasos/s aplica donde se indique.

---

## 7. Asientos de CPU

| Tema | Regla |
|---|---|
| Relleno | El servidor rellena hasta 4 con CPU al empezar. Sus personajes salen de los no elegidos y se llaman «CPU · LA ABUELA», etc. |
| Habilidad | `cfg.cpuNivel` 1/2/3 → `skill` base 0,35 / 0,6 / 0,85, ±0,1 por asiento con `rngFor('cpu'+p)` (valores por verificar con el simulador). |
| Quién la corre | **Siempre el juez** (A, B y C). Sus entradas o cuerpos se difunden como los de un humano. **Nadie más llama a `ai()`.** |
| Humanización | Reacción mínima de 180 ms, más error gaussiano según `skill`. Nunca más de 12 taps/s. Las CPU **no se coordinan** entre sí en 2v2 salvo lo que diga su `ai` (p. ej. «uno defiende, el otro va a la pelota»). |
| Toma por humano | Solo en el siguiente límite (decisión 6). Se hereda el asiento con monedas, estrellas y personaje. El efecto «¡LLEGÓ <nombre>!» se ve en todas las pantallas. |
| Desconexión | Humano callado 2 s → CPU en caliente → `ev cpu`. El resultado sigue siendo del asiento. |
| Bolsa de juegos | Se excluyen los juegos con `minHumanos` mayor que los humanos presentes. **Los lados no se sortean:** salen de los colores de las casillas (el que cayó en el color distinto es el solo). Con 2 humanos en el trío y el solo CPU, el juego vale igual: la bolsa filtra juegos, no cambia equipos. |
| Ganador | Una CPU puede ganar el minijuego y cobrar. No hay trato especial: así es Mario Party. |

---

## 8. Puntaje → puestos → monedas

### 8.1 Puestos por clase

| Clase | Puestos |
|---|---|
| `rank` | Orden por score. Los empates comparten puesto (`compara`). |
| `survival` | Score = tick de eliminación; quien sigue vivo al final recibe `dur·30 + 1`. Los vivos empatan en el 1.º. Las eliminaciones a ≤100 ms una de otra empatan. |
| `binary` (2v2 / 1v3) | `ganaEquipo()` / `ganaSolo()`. Todos los del lado ganador son 1.º; los del perdedor, 2.º (2v2) o 2.º-4.º compartido (1v3). |

### 8.2 Pago (doc 04, P = 20)

| Formato | Pago |
|---|---|
| FFA `rank` / `survival` | **14 / 9 / 5 / 2** por puesto. Los empates se reparten el promedio, redondeado hacia arriba. |
| 2v2 | Ganadores **7 c/u**, perdedores **2 c/u**. Empate: **4 c/u**. |
| 1v3 gana el solo | Solo **12**, trío 0. |
| 1v3 gana el trío | Trío **4 c/u**, solo 0. |
| 1v3 empate (si el juego lo permite) | Solo 5, trío 2 c/u (doc 04). |
| Bono de recolección | +1 moneda por cada 5 objetos recogidos, tope +3 (juegos marcados ⓡ). |
| Rondas múltiplo de 5 (excepto la última) | Pagos **×2** («Relámpago en dólares», doc 04). |
| Épicos | Por Puntos Épicos: **15 / 9 / 5 / 2**, y **×1,5** en la final. Si gana el jefe (solo en los cooperativos): −3 a cada uno y pago a la mitad. |
| Estadísticas | `minijuegosGanados` y `epicosGanados` alimentan las estrellas de bonificación. |

```js
// pura, compartida por el servidor (Goja) y fiesta-reglas.js: MJ_RESULT
function monedasMJ({tipo, clase, puestos, eq, ganador, recogidos, ronda, tot}) {
  const x2 = ronda % 5 === 0 && ronda !== tot ? 2 : 1;
  let m;
  if (tipo === 'ffa') m = puestos.map(p => promedioRedondeadoArriba([10,6,3,1], p, puestos));
  else if (tipo === '2v2') m = ganador == null ? eq.map(() => 4) : eq.map(t => t === ganador ? 7 : 2);
  else m = eq.map(t => ganador === 0 ? (t === 0 ? 12 : 0) : ganador === 1 ? (t === 0 ? 0 : 4) : (t === 0 ? 5 : 2));
  return m.map((v, i) => (v + Math.min(3, Math.floor((recogidos?.[i] || 0) / 5))) * x2);
}
```

**Balance del 1v3.** El objetivo es que el solo gane **≈45 %** de las veces con bots de igual habilidad. Cada 1v3 declara **una perilla** que se ajusta con el arnés de 200 semillas (§9).

---

## 9. Catálogo: 24 minijuegos en vivo + 3 épicos

**Leyenda:**

- Controles: **T** = táctil, **K** = teclado.
- Estado sincronizado: lo que viaja por la red.
- ⓡ = juego de recolección (bono de monedas).
- Todos usan el reparto compartido (`BUS.AP`, `TU`, `FACES`) y dibujan con primitivas del lab, así que funcionan en los 6 estilos.
- Los niveles 1/2/3 corresponden a día / atardecer / noche (`window.NIVEL`).

**Duelos (1v1).** El tablero tiene duelos en vivo (doc 07 §7.4), pero este catálogo no trae juegos 1v1 propios. Regla: los duelos sacan de la bolsa los juegos que declaran `'1v1'` en `modos` y funcionan con `n = 2`. Primeros candidatos: `f_mecate`, `f_domino`, `f_harina` y `f_abuela`. Juegos 1v1 dedicados quedan como tarea abierta.

### 9.0 Tabla resumen

| # | id | Nombre | Formato | Clase | Modelo | dur | Botones | Port |
|---|---|---|---|---|---|---|---|---|
| 1 | `f_cola` | ¡LA COLA DE LA GASOLINA! | FFA | rank | A | 20 | A | sí |
| 2 | `f_domino` | ¡CAPICÚA! | FFA | rank | A | 30 | A | sí |
| 3 | `f_tequeno` | ¡TEQUEÑOS! | FFA | rank | A | 30 | A (mantener) | sí |
| 4 | `f_harina` | ¡LA ÚLTIMA HARINA! | FFA | rank | B | 30 | A | sí |
| 5 | `f_cotufas` | ¡LLUEVEN COTUFAS! ⓡ | FFA | rank | B | 30 | stick + A | — |
| 6 | `f_cerro` | ¡SUBE EL CERRO! | FFA | rank | A | 35 | stick + A | — |
| 7 | `f_bolas` | ¡BOLAS CRIOLLAS! | FFA | rank | C | 35 | stick + A | — |
| 8 | `f_perro` | ¡PERRO CALIENTE CON TODO! | FFA | rank | A | 35 | stick + A + B | — |
| 9 | `f_mecate` | ¡SALTA EL MECATE! | FFA | survival | A | ≤45 | A | — |
| 10 | `f_chancla` | ¡LLUEVEN CHANCLAS! | FFA | survival | B | 45 | stick + A | — |
| 11 | `f_vagon` | ¡EL VAGÓN! | FFA | survival | C | 50 | stick + A | — |
| 12 | `f_bombita` | ¡AGUA EN CARNAVAL! | FFA | survival | B | ≈40 | stick | — |
| 13 | `f_abuela` | ¡LA ABUELA DICE! | FFA | survival | A | 45 | A + B | — |
| 14 | `f_bombillo` | ¡SE VA LA LUZ! | FFA | survival | B | 50 | stick + A | — |
| 15 | `f_futbolito` | ¡FUTBOLITO DE CALLE! | 2v2 | binary | C | 45 | stick + A + B | — |
| 16 | `f_carrucha` | ¡LA CARRUCHA! | 2v2 | binary | Ceq | 40 | por rol | — |
| 17 | `f_hallacas` | ¡LA LÍNEA DE HALLACAS! | 2v2 | binary | B por equipo | 45 | por rol | — |
| 18 | `f_cava` | ¡CARGA LA CAVA! ⓡ | 2v2 | binary | B | 35 | por rol | — |
| 19 | `f_cuerda` | ¡HALA LA CUERDA! | 2v2 | binary | C | 30 | A | — |
| 20 | `f_patilla` | ¡LA PATILLA GIGANTE! | 1v3 | binary | B | 35 | por rol | — |
| 21 | `f_bono` | ¡SE LE CAE EL BONO! | 1v3 | binary | B | 35 | stick + A | — |
| 22 | `f_guaya` | ¡LA GUAYA DEL TELEFÉRICO! | 1v3 | binary | B | 40 | por rol | — |
| 23 | `f_alcabala` | ¡LA ALCABALA DE MEDIANOCHE! | 1v3 | binary | B | 40 | stick + A | — |
| 24 | `f_silbon` | ¡EL SILBÓN EN EL LLANO! | 1v3 | binary | B | 45 | stick + A | — |
| R1 | `f_reto_catatumbo` | ¡EL CORRIENTAZO DEL CATATUMBO! | 4 vs jefe | rank (PE) | C | 100 | stick + A + B | reutiliza `juego-jefe-transformador.js` |
| R2 | `f_reto_saltoangel` | ¡BÁJATE DEL SALTO ÁNGEL! | FFA | rank (PE) | A | ≈100 | A + B | — |
| R3 | `f_reto_delta` | DELTAMACURA: EL CAÑO QUE NO EXISTE | 2v2 / 1v3 | rank (PE) | Ceq | ≈110 | por rol | — |

**Reparto por modelo:**

- **A (8):** cola, domino, tequeño, cerro, perro, mecate, abuela, Salto Ángel.
- **B (14):** harina, cotufas, chancla, bombita, bombillo, hallacas, cava, patilla, bono, guaya, alcabala, silbón, y además la parte de objetos de Catatumbo y del Delta.
- **C / Ceq (6):** bolas, vagón, futbolito, cuerda, carrucha, y los retos Catatumbo y Delta.

Hay pocos C a propósito: son los más sensibles a la latencia.

### 9.1 Todos contra todos, por puestos (8)

#### 1. `f_cola` · ¡LA COLA DE LA GASOLINA! (port de `juego-f-f_cola.js`)

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · rank · 20 s |
| Controles | T: botón A para avanzar · K: Espacio |
| Modelo | **A**. El horario del fiscal sale de `(seed, gt)`. Cada uno juzga si se movió con el fiscal mirando («¡COLEADO!» → retrocede). |
| Estado sincronizado | `o [pos×100, congelado]` a 12 Hz; `ev out` no aplica |
| Puntaje / ganador | % del recorrido, +25 a quien llega primero. Desempate: `t` de llegada. |
| Niveles | Nv1: el fiscal avisa 0,6 s antes. Nv2: giros falsos. Nv3: giros dobles y aviso de 0,35 s. |
| CPU | Ritmo de toques 3 + 5·skill por segundo; reacciona al giro en 450-250 ms. |
| Escena / gag | Cola de carros de cartón con los 4 carros EN VIVO en sus carriles; fiscal con chaleco. «¿Y su terminal de placa, ciudadano?» |
| Eco MP | Sneak 'n' Snore, MP2 (por verificar) |
| Límites | scoreMax 125, minT 4 |

#### 2. `f_domino` · ¡CAPICÚA! (port)

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · rank · 30 s |
| Controles | A al compás (T: botón A · K: Espacio) |
| Modelo | **A**. La partitura sale de `(seed, gt)`. Ventana PERFECTO ±60 ms; el error del reloj (<30 ms, por verificar) cabe. |
| Estado sincronizado | `o [pts, combo]` y `ev {ty: 'nota', d: calidad}`, para que el «¡PERFECTO!» del rival salte EN VIVO sobre su abuelo |
| Puntaje / ganador | Suma de puntos |
| Niveles | Tempo 90 / 110 / 130. Desde Nv2, apagón: se juega de oído. |
| CPU | Error gaussiano con σ = 120 − 70·skill ms |
| Escena / gag | Mesa de dominó bajo la mata de mango. «¡TRANCAOOO!» y el abuelo tirando la piedra. |
| Eco MP | Mario Bandstand, MP1 (por verificar) |

#### 3. `f_tequeno` · ¡TEQUEÑOS! (port)

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · rank · 30 s |
| Controles | Mantener A para freír, soltar para sacar |
| Modelo | **A**. Las sorpresas salen de la semilla. |
| Estado sincronizado | `o [barra, pts]`: se ve si al rival se le quemó |
| Puntaje / ganador | Suma de puntos por tequeño (dorado > pálido > quemado) |
| Niveles | Desde Nv2 «¡MAMÁ SUBIÓ EL FUEGO!». En Nv3, apagón y tequeño gordo. |
| CPU | Suelta en DORADO ± (1 − skill)·0,15 |
| Escena / gag | 4 sartenes en un cumpleaños. «¿Quién se comió el de bodegón?» |
| Eco MP | Familia de «para la barra» (por verificar) |

#### 4. `f_harina` · ¡LA ÚLTIMA HARINA! (port, disputado)

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · rank · 30 s |
| Controles | A para agarrar o robar cuando brilla |
| Modelo | **B**. El juez es dueño de `dueño` y `brilloHasta`. El robo es `claim('bolsa')` y gana el `t` más temprano dentro de 120 ms. Tocar fuera de tiempo hace tropezar, y eso se juzga localmente. |
| Estado sincronizado | `cl` / `ok`; el juez manda `s [dueño, brilloHasta, pts×4]` a 10 Hz; `o [pose]` de cada uno |
| Puntaje / ganador | 10 pts/s con la bolsa, +5 por aguantarla |
| Niveles | Segunda bolsa («¡LLEGÓ EL CAMIÓN!») en todos los niveles. Desde Nv2, la bolsa rota. En Nv3, la señora del carrito. |
| CPU | Toca 300 − 150·skill ms después del brillo |
| Escena / gag | Supermercado vacío. «¡Señora, ese es MÍO, yo hice la cola desde las 4!» |
| Eco MP | Grab Bag, MP1 (por verificar) |

#### 5. `f_cotufas` · ¡LLUEVEN COTUFAS! ⓡ

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · rank · 30 s |
| Controles | Stick para moverse; A = embestida (enfriamiento 1,2 s) que le tumba 3 cotufas al que golpeas |
| Modelo | **B**. Las apariciones `(x, y, t)` salen de la semilla. Recoger es `claim`. La embestida es `ev shot {x, y, dir, t}` y **la víctima decide** el contacto. Las cotufas tumbadas son objetos nuevos del juez. |
| Estado sincronizado | `o [x, y, n]` a 15 Hz; `ok {id, p}`; `ev hit {de, a}` |
| Puntaje / ganador | Número de cotufas. La cotufa dorada de mantequilla (×5) sale a los 15 s. |
| Niveles | Densidad 1 / 0,8 / 0,6 s. En Nv3 la máquina «explota» y dispara cotufas en arco. |
| CPU | Va a la cotufa más cercana con 250-450 ms de reacción; embiste a quien lleve más si está a menos de 70 px |
| Escena / gag | Sala de cine con butacas rojas. «Mi mamá metió las cotufas en la cartera.» |
| Eco MP | Coin Shower Flower, MP1 (por verificar) |

#### 6. `f_cerro` · ¡SUBE EL CERRO!

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · rank · 35 s |
| Controles | Stick izquierda/derecha, A = saltar |
| Modelo | **A**, sin contacto. Los otros se ven EN VIVO semitransparentes y no estorban. Los tobos de agua desde las ventanas salen de la semilla y se juzgan localmente: caes 1 piso. |
| Estado sincronizado | `o [x, y, piso]` a 12 Hz |
| Puntaje / ganador | Primero en llegar a la platabanda; el resto por altura alcanzada y luego `t` |
| Niveles | Huecos, y tendederos que rebotan. En Nv3, el perro de la vecina persigue. |
| CPU | Ruta precalculada con 3-12 % de error de salto según skill |
| Escena / gag | Escaleras del barrio, tanques de agua, antenas de DirecTV. «¡Cuidado con el perro de la señora Carmen!» |
| Eco MP | Platform Peril, MP1 (por verificar) |

#### 7. `f_bolas` · ¡BOLAS CRIOLLAS!

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · rank · ≈35 s, 3 lanzamientos simultáneos |
| Controles | Stick para apuntar; mantener A para fuerza y soltar para lanzar |
| Modelo | **C**: el juez simula TODAS las bolas, que chocan entre sí. El lanzamiento es `xtiro {ang, f, t}` fiable. |
| Estado sincronizado | `s [bolas × 12 (x, y, dueño), mingo]`, ≈150 B, a 10 Hz mientras ruedan |
| Puntaje / ganador | Por lanzamiento 4 / 2 / 1 / 0 según la distancia al mingo, sumados |
| Niveles | Viento desde Nv2. En Nv3 al mingo le dan una patada y se mueve. |
| CPU | Apunta al mingo con ruido σ = (1 − skill)·12°; en Nv3 busca sacar la bola del líder |
| Escena / gag | Cancha de tierra en el llano, el tío de árbitro. «¡Esa bola está más cerca que el bono!» |
| Eco MP | Bowl Over, MP1, por apuntar y dar fuerza (por verificar) |
| Nota | Es el C más tolerante: no hay avatar que predecir, solo bolas, y el lag se nota poco |

#### 8. `f_perro` · ¡PERRO CALIENTE CON TODO!

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · rank · 35 s |
| Controles | Stick para elegir en un anillo de 6 ingredientes; A añade; B empieza de nuevo |
| Modelo | **A**. Los 5 pedidos salen de la semilla y son iguales para todos. |
| Estado sincronizado | `o [orden, paso, errores]`: los perros de los rivales crecen EN VIVO en sus miniventanas |
| Puntaje / ganador | Pedidos completos y luego `t`; cada error cuesta −1 s |
| Niveles | 3 / 4 / 6 ingredientes por pedido. En Nv3 el cliente cambia de idea a mitad («¡sin repollo!»). |
| CPU | 0,5-0,9 s por ingrediente, 2-8 % de error |
| Escena / gag | Carrito de perros en la noche. «¿Papitas? ¿Salsa de ajo? ¿TODO TODO?» |
| Eco MP | Juegos de pedidos y memoria (por verificar) |

### 9.2 Todos contra todos, supervivencia (6)

Para los 6: el puesto se decide por orden de eliminación, y las eliminaciones a ≤100 ms empatan. **Los eliminados siguen mirando EN VIVO** y pueden mandar reacciones (`react`). Donde se indica, juegan una «venganza» suave.

#### 9. `f_mecate` · ¡SALTA EL MECATE!

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · survival · ≤45 s, con fin temprano |
| Controles | A = saltar |
| Modelo | **A**. La fase de la cuerda es función pura de `gt`: los 4 ven la misma cuerda. Cada uno juzga su fallo y manda `ev out`. |
| Estado sincronizado | `o [y, out]` a 12 Hz; `ev out` |
| Puntaje / ganador | El último en pie. Si llegan 2 o más al final, empatan en el 1.º. |
| Niveles | Velocidad que sube de 0,9 a 1,6 Hz / con golpes irregulares / con doble cuerda |
| CPU | Error de salto con σ de 25 a 90 ms |
| Escena / gag | Dos vecinas dándole a la cuerda en la calle del barrio. «¡Pisó el mecate, PISÓ!» |
| Eco MP | Hot Rope Jump, MP1 (por verificar) |

#### 10. `f_chancla` · ¡LLUEVEN CHANCLAS!

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · survival · 45 s |
| Controles | Stick; A = meterse bajo la mesa (0,6 s, enfriamiento 2 s) |
| Modelo | **B**. Las chanclas de mamá salen de la semilla y una sombra avisa 0,7 s antes. Desde Nv2, los eliminados se vuelven «tías chismosas» que lanzan chancletas: `ev shot` con 1 s de aviso, y la víctima juzga. |
| Estado sincronizado | `o [x, y, vidas, bajoMesa]`; `ev hit`; `ev out` |
| Puntaje / ganador | 2 golpes y fuera; el último en pie |
| Niveles | Ritmo 1,2 / 0,9 / 0,6 s. En Nv3, «¡LA CHANCLA TELEDIRIGIDA!» que persigue al líder. |
| CPU | Sale de la sombra más cercana con 200-400 ms de reacción |
| Escena / gag | La sala de mamá (`BUS.AP.CAST.mama`, la chancla de ¡CHANCLA!). «¿¡QUIÉN DEJÓ LA NEVERA ABIERTA!?» |
| Eco MP | Bombs Away, MP2 (por verificar) |

#### 11. `f_vagon` · ¡EL VAGÓN!

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · survival · 50 s |
| Controles | Stick; A = empujón (con enfriamiento) |
| Modelo | **C**: el juez simula los cuerpos y los empujones. Las puertas se abren en lados alternos (de la semilla, con luz de aviso 1 s antes). Quien sale empujado en la estación queda fuera. |
| Estado sincronizado | `s [x, y, vx, vy] × 4 + puertas`, ≈90 B |
| Puntaje / ganador | El último dentro del vagón |
| Niveles | Frenazo desde Nv2. En Nv3, el vendedor de caramelos recorre el pasillo empujando. |
| CPU | Empuja al más cercano hacia la puerta abierta y vuelve al centro |
| Escena / gag | Vagón del Metro en hora pico. «Señores pasajeros, disculpen que los moleste…» |
| Eco MP | Bumper Balls, MP1 |
| Riesgo | Es el C más sensible. Necesita `predict` y telegrafía generosa: el empujón tiene 0,3 s de carga visible. |

#### 12. `f_bombita` · ¡AGUA EN CARNAVAL!

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · survival · ≈40 s, en 3 estallidos |
| Controles | Stick; tocar a alguien le pasa la bombita |
| Modelo | **B**. El portador es dueño de la bombita. Cuando su cliente ve contacto con la posición `remoto()` del otro, manda `xpasa {a, t}`; el juez confirma con `ok` y da 0,4 s de inmunidad. La mecha sale de la semilla y está oculta; la bombita tiembla 1 s antes. |
| Estado sincronizado | `o [x, y]`; `s [portador, inmuneHasta]` del juez; `ev out` al estallar |
| Puntaje / ganador | Quien la tiene cuando estalla queda fuera. La siguiente arranca en un portador elegido por la semilla. |
| Niveles | Mecha de 8-14 s / 5-10 s / con 2 bombitas |
| CPU | Si la lleva, corre hacia el más cercano; si no, huye |
| Escena / gag | Plaza en Carnaval. «¡En carnaval todo se vale!» y pelo mojado. |
| Eco MP | Hot Bob-omb, MP1 |

#### 13. `f_abuela` · ¡LA ABUELA DICE!

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · survival · 45 s |
| Controles | A = arriba, B = abajo (T: dos botones, o deslizar) |
| Modelo | **A**. Las órdenes salen de `(seed, gt)` y cada uno juzga su respuesta dentro de la ventana. |
| Estado sincronizado | `o [pose]`; `ev out`: se ve EN VIVO cómo se equivocan los demás |
| Puntaje / ganador | El último en pie |
| Niveles | Ventanas de 1,2 / 0,9 / 0,6 s. Trampas del tipo «la abuela NO dijo». En Nv3 cambia a la voz del abuelo. |
| CPU | 3-15 % de error |
| Escena / gag | La cocina de la abuela (`AP.CAST.abuela`). «¡Arriba la arepa! ¡Abajo la chancla!» |
| Eco MP | Shy Guy Says, MP1 |

#### 14. `f_bombillo` · ¡SE VA LA LUZ!

| Campo | Valor |
|---|---|
| Formato / clase / dur | FFA · survival · 50 s |
| Controles | Stick; A = saltico |
| Modelo | **B**. El piso es de 7×5 baldosas, cada una un bombillo. El color o el sonido indica cuáles quedan prendidas, y el resto se apaga y cae 1,5 s después, todo desde `(seed, gt)`. Cada uno juzga su propia caída. Los empujones los juzga la víctima. |
| Estado sincronizado | `o [x, y]`; `ev out` |
| Puntaje / ganador | El último en pie |
| Niveles | Menos baldosas seguras. En Nv3, Don Corte apaga en espiral. |
| CPU | Va a la baldosa segura más cercana con 250-500 ms de retraso |
| Escena / gag | Una cuadra de noche, en pleno apagón. «Se fue en toda la cuadra menos donde el vecino de la planta.» |
| Eco MP | Hexagon Heat (MP2) y Mushroom Mix-up (MP1) |

### 9.3 2v2: los compañeros se coordinan (5)

En los 5, los dos del equipo ganador ganan.

#### 15. `f_futbolito` · ¡FUTBOLITO DE CALLE!

| Campo | Valor |
|---|---|
| Formato / clase / dur | 2v2 · binary · 45 s |
| Controles | Stick; A = patear (mantener para más fuerza); B = sprint |
| Modelo | **C**: el juez simula la pelota de goma y los cuerpos. Cada uno predice su propio cuerpo. |
| Estado sincronizado | `s [pelota x, y, vx, vy; 4 × (x, y, st); marcador]`, ≈110 B, a 10-15 Hz; `ev gol` |
| Puntaje / ganador | Más goles. Si hay empate, 15 s de gol de oro; si sigue empatado, empate (4 monedas c/u). |
| Niveles | Arcos de chancletas / arcos más estrechos / un carro que cruza («¡CARRO!»: todos congelados 2 s) |
| CPU | Una defiende y la otra va a la pelota |
| Escena / gag | Calle de asfalto. «¡CARRO!» y «el dueño de la pelota se va pa' su casa». |
| Eco MP | Speed Hockey, MP2 (por verificar) |

#### 16. `f_carrucha` · ¡LA CARRUCHA!

| Campo | Valor |
|---|---|
| Formato / clase / dur | 2v2 · binary · 40 s, carrera cerro abajo |
| Controles | Delantero: stick para dirigir. Trasero: A para empujar en las rectas, B para frenar en las curvas. |
| Modelo | **Ceq**. El juez del vehículo es el humano del equipo con menor RTT (o el delantero si empatan). El compañero manda `i`. El otro equipo ve la carrucha por `s`. |
| Estado sincronizado | Por equipo: `s [x, y, ang, v, progreso]` a 15 Hz |
| Puntaje / ganador | Primero en llegar abajo. Sinergia: empujar en recta da +20 %; frenar en curva evita el choque, que cuesta −2 s. |
| Niveles | Curvas, policías acostados, un matero en plena vía |
| CPU | Línea ideal con ruido; frena con 80-95 % de acierto |
| Escena / gag | Carrucha de rolineras en el cerro. «¡Sin frenos, mamá!» |
| Eco MP | Bobsled Run, MP1 |

#### 17. `f_hallacas` · ¡LA LÍNEA DE HALLACAS!

| Campo | Valor |
|---|---|
| Formato / clase / dur | 2v2 · binary · 45 s |
| Controles | Estación 1: mantener y soltar A para extender la masa del tamaño justo. Estación 2: stick para el guiso y A para amarrar (3 nudos al ritmo). |
| Modelo | **B por equipo**. Cada compañero es dueño de su estación. La hallaca pasa con `xpasa`. La estación 2 juzga el puntaje de su equipo. |
| Estado sincronizado | `o [cola, listas]` por equipo; la línea rival se ve EN VIVO |
| Puntaje / ganador | Más hallacas bien amarradas; una mal amarrada cuenta −1 |
| Niveles | Más adornos. En Nv3, «¡LA TÍA PIDE 20 MÁS!» a mitad de tiempo. |
| CPU | Perfecta el 70-95 % de las veces |
| Escena / gag | La cocina de diciembre (reutiliza el arte de `juego-hallaca.js`). «¡Esa hallaca quedó como regalo sin cinta!» |
| Eco MP | Cake Factory, MP2 (por verificar) |

#### 18. `f_cava` · ¡CARGA LA CAVA! ⓡ

| Campo | Valor |
|---|---|
| Formato / clase / dur | 2v2 · binary · 35 s |
| Controles | Lanzador: stick para apuntar, A para lanzar hielo o refresco. Receptor: stick para mover la cava. |
| Modelo | **B**. El lanzamiento es una trayectoria determinista `xtiro {ang, f, t}` y el receptor juzga su atrapada. La gaviota la maneja el juez global: le roba a la cava más llena, y espantarla es un `claim`. |
| Estado sincronizado | `o` por rol; `ev cogio`; `s [gaviota]` |
| Puntaje / ganador | Más cosas en la cava |
| Niveles | Viento; arena que frena; botella de vidrio que vale −2 si se atrapa |
| CPU | El receptor va al punto de caída previsto, con error |
| Escena / gag | La playa de Choroní. «¡Agarra las frías que se calientan!» |
| Eco MP | Juegos de lanzar y atrapar (por verificar) |

#### 19. `f_cuerda` · ¡HALA LA CUERDA!

| Campo | Valor |
|---|---|
| Formato / clase / dur | 2v2 · binary · 30 s, en 3 tandas de 6 s con pausas (regla de machaque) |
| Controles | A = halar. El tirón DOBLE ocurre si los dos compañeros pulsan con ≤120 ms de diferencia. |
| Modelo | **C**. El juez integra la posición de la cuerda con eventos `xtir {t}` estampados con la hora del emisor, así que el tirón doble se decide en el reloj de quien pulsa. |
| Estado sincronizado | `s [pos, sincro_eq0, sincro_eq1]`, ≈20 B |
| Puntaje / ganador | Arrastrar al otro equipo más allá de la raya; si no, la posición de la cuerda al final |
| Niveles | Un compás marca el ritmo óptimo; un charco de barro aturde a quien machaca fuera del compás |
| CPU | Hala al compás con jitter; se sincroniza con su compañero humano el 50-85 % de las veces |
| Escena / gag | Playa en día feriado. «¡Halen, halen, que el compadre se está quedando!» |
| Eco MP | Tug o' War, MP1 (por verificar) |

### 9.4 1v3 asimétricos (5)

Para los 5: el objetivo es ≈45 % de victorias del solo, con **una perilla** por juego. El solo no es juez si hay alternativa (decisión 3). La carta muestra primero el rol propio.

#### 20. `f_patilla` · ¡LA PATILLA GIGANTE!

| Campo | Valor |
|---|---|
| Formato / clase / dur | 1v3 · binary · 35 s |
| Controles | Solo: stick para apuntar desde arriba de la calle, A para soltar la patilla (3 tiros, enfriamiento 8 s). Trío: stick para esquivar, A = saltar. |
| Modelo | **B**. El tiro es determinista: `xtiro {x, ang, t}`, y todos simulan el mismo rodar. Cada miembro del trío juzga su propio golpe. El amago de 0,8 s cubre la latencia. |
| Estado sincronizado | `o [x, y, st]`; `ev hit` |
| Puntaje / ganador | El solo gana con ≥3 golpes (repetidos cuentan); si no, gana el trío |
| **Perilla** | Ancho de la patilla |
| Niveles | 3 tiros rectos / rebote en las aceras / se parte en 2 mitades |
| CPU | Solo: apunta al grupo más denso del trío. Trío: esquiva con 200-400 ms de retraso. |
| Escena / gag | Calle de mercado en bajada. «¡Se le soltó la patilla al señor del camión!» |
| Eco MP | Bowl Over, MP1 |

#### 21. `f_bono` · ¡SE LE CAE EL BONO!

| Campo | Valor |
|---|---|
| Formato / clase / dur | 1v3 · binary · 35 s |
| Controles | Solo: stick para correr, A = saltar (esquivar). Trío: stick, A = periodicazo. |
| Modelo | **B**. El periodicazo es `ev shot {x, y, dir, t}` y el cliente del SOLO juzga si le dieron, porque es la víctima. Cada golpe suelta 3 monedas, que pasan a ser objetos del juez y el trío las reclama. |
| Estado sincronizado | `o [x, y]`; `s [monedasSueltas]`; `ok` |
| Puntaje / ganador | El solo gana si conserva ≥50 % de sus 30 monedas |
| **Perilla** | Velocidad del solo |
| Niveles | Más obstáculos. En Nv3 el solo tiene un turbo de 2 s, «¡ME PAGARON!». |
| CPU | Solo: huye del centro del trío y salta si uno se acerca a menos de 50 px |
| Escena / gag | Afuera del banco. «¡Cobré el bono y ya debo la mitad!» |
| Eco MP | Bash 'n' Cash, MP1 |

#### 22. `f_guaya` · ¡LA GUAYA DEL TELEFÉRICO!

| Campo | Valor |
|---|---|
| Formato / clase / dur | 1v3 · binary · 40 s |
| Controles | Solo: stick para elegir uno de 4 tramos y A para sacudirlo (enfriamiento 1,5 s). Trío: stick para avanzar por la guaya, A en el momento justo para equilibrarse. |
| Modelo | **B**. La sacudida es `ev` fiable con 0,6 s de aviso (la guaya tiembla). Cada miembro del trío juzga su propia caída, que lo devuelve al inicio del tramo. |
| Estado sincronizado | `o [tramo, pos, equilibrio]` |
| Puntaje / ganador | El trío gana si cruzan ≥2 |
| **Perilla** | Duración del aviso |
| Niveles | Guaya de 3 / 4 / 5 tramos; en Nv3, neblina en el Ávila |
| CPU | Solo: sacude donde hay más gente del trío. Trío: reacciona con 70-95 % de acierto. |
| Escena / gag | El teleférico del Ávila, solo la guaya. «¡Dios mío, esto no estaba en el plan del paseo!» |
| Eco MP | Tightrope Treachery, MP1 (por verificar) |

#### 23. `f_alcabala` · ¡LA ALCABALA DE MEDIANOCHE!

| Campo | Valor |
|---|---|
| Formato / clase / dur | 1v3 · binary · 40 s |
| Controles | Solo: stick para mover la linterna; A = «¡ALTO!», un destello ancho de 0,4 s con enfriamiento de 4 s. Trío: stick para cruzar la calle con un bulto; A = esconderse tras un matorral, avanzando lento. |
| Modelo | **B**. La linterna la difunde el solo con `o [x, y]`. Cada miembro del trío juzga si lo iluminan contra la posición `remoto()` de la luz («favorecer al que se esconde»). Si está iluminado 0,5 s seguidos, lo agarran y vuelve al inicio. |
| Estado sincronizado | `o`; `ev cruzo` |
| Puntaje / ganador | El trío gana si pasan ≥2 bultos |
| **Perilla** | Radio de la luz |
| Niveles | Terreno más abierto; en Nv3, perro rastreador |
| CPU | Solo: barre y luego persigue el movimiento. Trío: avanza cuando la luz está lejos. |
| Escena / gag | Alcabala de conos con linterna, de noche (la alcabala de `juego-jefe-alcabala.js`). «¿Y qué lleva en ese bulto, ciudadano?» «…Hallacas, oficial.» |
| Eco MP | Juegos de reflector y escondite (por verificar) |

#### 24. `f_silbon` · ¡EL SILBÓN EN EL LLANO!

| Campo | Valor |
|---|---|
| Formato / clase / dur | 1v3 · binary · 45 s |
| Controles | Solo (el Silbón, en tono cómico): stick; A = silbido que revela al trío 1 s (enfriamiento 3 s); atrapa por contacto. Trío: stick para recoger 8 mangos a oscuras; A = linterna de 2 s que muestra al Silbón. |
| Modelo | **B**. El cliente del atrapado confirma el toque contra su propia posición, con un radio de toque +20 px de tolerancia al lag. Los mangos son objetos del juez (`claim`). **Resuelto:** el atrapado reaparece a los 4 s sin el mango que llevaba. Nada de «espantos» que frenen a los demás: tiene que seguir siendo amistoso. |
| Estado sincronizado | `o [x, y]`; `ok`; `ev atrapado` |
| Puntaje / ganador | El trío gana si junta 8 mangos antes de 45 s |
| **Perilla** | Número de mangos |
| Niveles | Más oscuro, más árboles |
| CPU | Solo: va al último ruido. Trío: recoge con codicia y huye cuando está dentro del radio del silbido. |
| Escena / gag | El llano de noche, luna y palmas. «Cuando se oye cerca está lejos…», y una CPU del trío que corre HACIA el silbido. |
| Eco MP | Juegos de persecución (por verificar) |

### 9.5 Tres épicos (60-120 s), del doc 04 §3.3-3.5 adaptados a red

| Reto | Formato | Modelo y red | Notas |
|---|---|---|---|
| **R1 `f_reto_catatumbo`** «¡EL CORRIENTAZO DEL CATATUMBO!» | 4 contra un jefe, puntaje individual, 100 s, 3 fases | **C** para la Tormenta: el juez es dueño de `hp` y `fase`, `s [hp, fase]` a 10 Hz. Los rayos salen de la semilla y se juzgan localmente (3 corazones; al llegar a 0 juegas como fantasma a media puntuación). Fase 2 «embotella el rayo»: `claim`. Fase 3: `ev golpe {t, fuerza}` que suma el juez. | +30 PE al golpe final. Reutiliza `juego-jefe-transformador.js`. Si gana el jefe: −3 a cada uno y pago a la mitad. |
| **R2 `f_reto_saltoangel`** «¡BÁJATE DEL SALTO ÁNGEL!» | FFA, carrera de ≈100 s | **A**. Fase 1: subir al ritmo de A/B. Fase 2: neblina, pantalla negra, se juega de oído. Fase 3: caída libre; mantener A, soltar y abrir el paracaídas. | Los otros 3 se ven EN VIVO en la misma pared. El puesto sale de la llegada más la precisión del aterrizaje. |
| **R3 `f_reto_delta`** «DELTAMACURA: EL CAÑO QUE NO EXISTE» | 2v2 en curiaras (variante 1v3), ≈110 s | **Ceq**: el de popa simula la curiara y el de proa manda las remadas. 5 tramos «¡RECALCULANDO!» salen de la semilla. El GPS mentiroso compartido lo maneja el juez global. | En 1v3, el solo es «el guía con motor» contra la curiara del trío. Tope de 4 remadas/s. |

---

## 10. Orden de construcción (rebanada vertical)

### 10.1 Infraestructura primero (sin esto no hay juego)

| Paso | Entrega | Criterio de hecho |
|---|---|---|
| I1 | `docs/style-lab/fiesta-net.js` (UMD): `pcall` con `now`, `serverNow()`, SSE + sondeo, `channel('m:<k>')` con forma de `duoCtx`, dos carriles HTTP, WebRTC por par | `test/fiesta-net.test.js` en verde: coalescencia, dedupe P2P+relevo, desfase de reloj ±20 ms con 150 ms de jitter |
| I2 | Servidor: modo `fiesta`; rama `fiesta` en `sigPayload`; `mjfin` / `mjack` / `juez` (CAS); `now` en las respuestas; `board.mj` con `startAt`; elección del juez en la carta | Pruebas ampliadas en `pocketbase/pb_hooks/party.test.js` |
| I3 | `docs/style-lab/fiesta-live.js`: runtime `FIESTA.LIVE` (§5), envoltorio `legacy`, interpolación por hora del emisor, juez, CPU, migración | Los juegos de DUO/SQUAD con sus bots corren sobre `channel()` (prueba de conformidad) |
| I4 | `docs/style-lab/pruebas/fiesta-live-bench.js` (arnés §11) + modo `probar.js --live` | Corre los 24 por línea de comandos |
| I5 | Flujo ruleta → carta → cuenta → juego → podio en `fiesta.html`, controles universales (§6) | e2e con 2 contextos y un juego tonto de prueba |

### 10.2 Los 6 juegos de la rebanada (en este orden)

| # | id | Formato | Modelo | Qué valida |
|---|---|---|---|---|
| 1 | `f_mecate` | supervivencia | A | Es el más simple: valida el reloj compartido, `ev out`, el ranking por eliminación y el fin temprano. |
| 2 | `f_domino` | FFA | A (port) | El envoltorio `legacy` y la precisión del reloj (ventana de ±60 ms). |
| 3 | `f_harina` | FFA | B (port) | `claim`/`ok`, el arbitraje en 120 ms y la animación «¡te lo quitaron!». |
| 4 | `f_chancla` | supervivencia | B | Golpes que juzga la víctima, telegrafía, eliminados que siguen jugando y mamá del reparto. |
| 5 | `f_patilla` | 1v3 | B | Roles asimétricos en la carta, tiros deterministas, la perilla y que el solo no sea juez. |
| 6 | `f_futbolito` | 2v2 | C | Física autoritativa, `predict`, `fairDelay`, migración con `restore`. Va último porque es el más arriesgado. |

### 10.3 Oleadas siguientes

- **Oleada 2:** los ports que faltan, más A baratos: `f_cola`, `f_tequeno`, `f_abuela`, `f_cerro`, `f_perro`.
- **Oleada 3:** B de objetos: `f_cotufas`, `f_bombita`, `f_bombillo`, `f_cava`, `f_hallacas`.
- **Oleada 4:** 1v3: `f_bono`, `f_guaya`, `f_alcabala`, `f_silbon`.
- **Oleada 5:** C: `f_cuerda`, `f_bolas`, `f_vagon`, `f_carrucha`.
- **Oleada 6:** los retos, en este orden: R2 (A), R1 (reutiliza el jefe), R3.

La regla del usuario sigue vigente (memoria «Lab builds: fast, no agent review»): **un constructor rápido por juego**, y el usuario revisa. Lo que sí es obligatorio es la **lista de verificación sin pantalla (§11)**, porque los fallos de red no se ven jugando a solas.

---

## 11. Arnés sin pantalla y lista de verificación por juego

### 11.1 Arnés (`docs/style-lab/pruebas/fiesta-live-bench.js`, molde `test/squad.test.js:23-37`)

```js
const R = memRelay({
  n: 4, delay: 150, jitter: 40, loss: 0.05,      // ms, ms, fracción
  http: true,                                    // modela 1 petición en vuelo por carril + SIG_GAP
  limits: { bytes: 512, count: 10 },             // los mismos de pb_hooks/party.js:396
  killJudgeAt: 0.4,                              // fracción de dur (opcional)
  dropSeat: { p: 2, at: 0.5, back: 0.7 },        // opcional
});
const out = play('f_chancla', {
  tipo: 'ffa', humanos: [0, 1], cpu: [2, 3],     // los bots humanos usan el MISMO ai() pero entran por c.held/tap
  seed: 12345, lv: 2, relay: R, clock: R.clock,   // reloj virtual: sin esperas reales
});
// out = { verdicts:[por pantalla], end, fin, sent:{bytesMax, perSec}, judges:[...], drawCalls }
```

- Carga el lab con un *stub* de canvas (Proxy) como hacen `duo.test.js` y `probar.js`.
- Construye **n instancias del mismo juego**, una por asiento, cada una con su `channel()` sobre el relevo en memoria.
- Los `draw()` se ejecutan contra el *stub* para detectar excepciones.

### 11.2 Lista de verificación (cada juego, antes de entrar a la bolsa)

| # | Prueba | Cómo | Criterio |
|---|---|---|---|
| 1 | Mismo veredicto | 50 semillas × lag {50, 150, 300} ms × pérdida {0, 5 %} | **0 discrepancias** de `h` entre las 4 pantallas |
| 2 | Un solo juez | Contar `end` por época | Exactamente 1 por época |
| 3 | Migración | `killJudgeAt` en 0,2 / 0,5 / 0,8 | Termina, todos coinciden, `e` sube en 1. Si `migra: false`, termina con el último snapshot. |
| 4 | Caída y regreso | `dropSeat` | El asiento pasa a CPU en ≤2,2 s; vuelve a humano tras 0,5 s de entradas; el resultado se le acredita |
| 5 | Presupuesto | Medir cada envío | Toda carga ≤420 B, todo lote ≤512 B / 10 mensajes; ≤20 req/s por cliente en HTTP |
| 6 | Tipos reservados | Interceptar `send` | El juego solo usa tipos `x*` propios; nunca `i o s s2 cl ok ev end hb rdy jg frame _net_*` |
| 7 | Determinismo del mundo | Hash del estado del constructor | Idéntico en las n instancias; ningún `Math.random` (grep) |
| 8 | Límites | Resultados de 200 semillas | Dentro de `scoreMax` y `scoreRate × t`; `minT` respetado |
| 9 | Ociosos | Humanos sin tocar nada contra CPU de nivel 2 | Los ociosos nunca ganan (salvo empate en supervivencia de 0 eventos) |
| 10 | Ventaja del juez | 200 semillas, bots iguales | Victorias del asiento juez ≤ 1/n + 8 puntos porcentuales |
| 11 | 1v3 y 2v2 | 200 semillas | Solo gana entre 38 y 52 % (perilla ajustada); los puestos son coherentes con `compara` / `ganaSolo` |
| 12 | Telegrafía (B/C) | Revisión del código + arnés a 300 ms | Toda amenaza avisa ≥0,5 s; el golpe se decide en el cliente víctima |
| 13 | Carta | Snapshot | `carta.obj`, `carta.gana`, `como.tactil/teclado`, ≥1 demo; en 1v3, `roles.solo` y `roles.trio` |
| 14 | Práctica | `c.practica = true` | Corre sin red y sin la semilla real |
| 15 | Estilos | `probar.js` en los 6 estilos | Sin excepciones en `draw()`; solo primitivas del lab |
| 16 | Mitad de pantalla | Viewport de 360×640 | Controles superpuestos, sin perder la franja superior de 64 px |

### 11.3 Más arriba en la pirámide

- **Servidor** (`pocketbase/pb_hooks/party.test.js`):
  - `mjfin` solo del juez y de la época vigente.
  - CAS de `juez` con dos aspirantes: gana uno.
  - Topes de `limites`.
  - Cierre por plazo con testigo, y sin testigo (empate sin monedas).
  - `sigPayload` rechaza `s`/`end` de quien no es juez.
- **e2e** (Playwright, junto a `test/party*.e2e.js`):
  - 2 contextos (uno móvil) en `fiesta.html`: carta → ¡LISTO! → `f_mecate` → podio idéntico.
  - Un tercer contexto toma una CPU en la siguiente carta.
  - Recargar a mitad de juego: vuelve al estado en vivo.
- **Siguen en verde** `test/duo.test.js` y `test/squad.test.js`.

---

## 12. Riesgos y puntos abiertos

| Riesgo | Mitigación |
|---|---|
| C en HTTP a 200 ms se siente pastoso (≈300-450 ms para pelota y empujones) | Solo 4 C + 2 Ceq, `predict` obligatorio y telegrafía. Si el arnés muestra que es injugable en HTTP, la bolsa excluye los C cuando `N.label()` dice RELAY. |
| Carga del relevo: ≈40 req/s por sala, cada una con lectura de BD | Caché en `$app.store()` (§4.5) y prueba de carga de 50 salas (por verificar) |
| Juez tramposo | Rotación, testigos con hash, `fairDelay`, snapshots públicos. Se acepta para jugar entre panas; el tablero sí es autoritativo. |
| iOS mata el SSE y el WebRTC en segundo plano | Si vuelves a mitad del juego, sigues EN VIVO; mientras no estás, la CPU juega tu asiento. |
| `require` relativo en Goja para `compara` / `monedasMJ` | (por verificar) Si falla, se copia a `pb_hooks/fiesta/` desde `scripts/sync-world-assets.sh` y se resuelve con `__hooks`. |
| El `fiesta.html` desplegado carga los juegos dos veces (porque `index.html` = `public.html` en prod) | Arreglarlo con una lista estática de scripts antes del primer e2e en producción (doc 07). |
| Precisión del reloj (<30 ms) | (por verificar) en el arnés con jitter y en 2 móviles reales; `f_domino` es la prueba de fuego. |
| Valores de habilidad de las CPU y perillas del 1v3 | (por verificar) con el arnés de 200 semillas; los números de este documento son de partida. |
