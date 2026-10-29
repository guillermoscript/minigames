# 09 · LA FIESTA: especificación del netcode en tiempo real

**Estado:** propuesta de arquitectura, 2026-10-17. Detalla el netcode de `07-multijugador-online.md` (versión 2, que ya integró las correcciones de §2 de este doc; las «§2.4, §2.6 y §2.7 de 07» citadas aquí eran de la versión 1). **Si este doc y el 07 discrepan en un nombre, un campo o un plazo, gana el glosario de 07 §2.1.** El orden de construcción de §16 se cruza con los hitos de 07 §10.

**Mandato del usuario (2026-10-17), que manda sobre todo lo demás:**

- Es multijugador **real y en línea**: cada jugador en su dispositivo.
- **Todo es en vivo**: el tablero y los minijuegos. No hay fantasmas, no hay repeticiones, no hay misma pantalla.
- Los minijuegos son competitivos y en vivo, como DUO/SQUAD pero contra los demás: todos contra todos (supervivencia o por puestos), 2v2 y 1v3, lo más parecido a Mario Party.
- La partida vive en el mundo Venezuela (`docs/style-lab/fiesta.html`, desplegado en `/worlds/venezuela/`).
- Se empieza con un mínimo de 2 humanos y los CPU rellenan hasta 4. Cada jugador elige personaje.
- Un humano puede entrar a una partida empezada y quedarse con el asiento de un CPU.

**Convenciones:**

- Las referencias `archivo:línea` vienen de cuatro análisis de solo lectura hechos el 2026-10-17. Revisé a mano `pb_hooks/party.js:6-12,396,493`, `party_routes.js:98-120`, `js/party.js:147-151` y `js/link.js:8-14`. El resto se da por bueno, pero puede haberse movido unas líneas.
- **(por verificar)** marca lo que nadie ha comprobado en código o midiendo.
- En los esquemas, `l` significa «latest-wins»: el mensaje nuevo reemplaza al viejo del mismo tipo y solo vale el último.

---

## 0. Resumen en una página

| Capa | Qué viaja | Autoridad | Transporte | Cadencia |
|---|---|---|---|---|
| **Sala / tablero** | Acciones (`act`, `commit`, `tick`…) y el registro `rooms` con `board` + `ver` | **Servidor** (reductor puro `fiesta-reglas.js`, RNG oculto en `keys._f`) | `POST /api/party/*` y empuje SSE `rooms/<id>` | Por evento (≈4-6 empujes por turno) |
| **Efímero del tablero** | `aim` (la duda en vivo), `react` (emotes, tipo existente de `party-react.js`), `hb` | Nadie (cosmético) | `sig` con alcance `b` (malla P2P o relevo HTTP) | ≤5 Hz |
| **Minijuego en vivo** | `i` entradas, `o` cuerpo propio, `s` instantánea del juez, `ev`, `cl/ok`, `end` | **Juez** (un cliente humano elegido por el servidor) + dueños de cuerpo, según el modelo A/B/C | `sig` con alcance `m:<k>` (malla P2P por par, relevo HTTP para el resto) | 10-20 Hz |
| **Veredicto del minijuego** | `mjfin` (juez), `mjack` (testigos) | Servidor: valida límites, convierte puestos en monedas | `POST /api/party/*` | 1 vez por minijuego |
| **Reloj** | `now` en cada respuesta y `at` en cada mensaje relevado | Reloj del servidor | Respuestas HTTP | Muestras continuas + ráfaga de 5 en la tarjeta |
| **Voz** | Señalización `vsig` | — | Sin cambios (`voice.js`) | — |

Decisiones clave:

1. **Tres modelos de autoridad** (§3): **A** «cancha propia», **B** «dueño + juez» y **C** «el juez simula». No hay lockstep en v1.
2. **El servidor elige un juez por minijuego** (§6): el humano con mejor RTT, nunca el solo en un 1v3 si hay alternativa, y rotando en caso de empate. Si el juez desaparece, la migración pasa por un compare-and-set en el servidor con `epoch`.
3. **Un minijuego en vivo por ronda de tablero**, como Mario Party, de 25 a 60 s. El «Relámpago» de 3 microjuegos de 10 s queda como casilla especial. Las fases salen de la lista `mj.cola`, que normalmente tiene longitud 1.
4. **Nuevo módulo `docs/style-lab/fiesta-net.js`**: UMD, sin variables globales, con dependencias inyectadas y su propio reloj. Incluye `link.js` portado con envío por par y el núcleo de `voice.js`. `js/party.js` no se toca en v1.
5. **Se prueba sin navegador** (§14) con un relevo en memoria que inyecta latencia, jitter, pérdida, reordenamiento, duplicados y los límites reales de 512 B y 10 mensajes, sobre reloj virtual.

---

## 1. Lo que ya existe y es el estándar

DUO y SQUAD ya meten a 2-4 personas en **el mismo microjuego en vivo**. Ese es el patrón base.

| Pieza | Comportamiento actual | Referencia |
|---|---|---|
| Plano de control | Una acción es un `POST /api/party/<acción>` dentro de `runInTransaction`. El registro lo escribe solo el servidor. | `party_routes.js:27-70,121-134` |
| Empuje | SSE con los temas `rooms/<id>`, `rooms/<id>/sig` y `rooms/<id>/vsig`. Sondeo cada 3 s sin SSE y cada 12 s con SSE. | `js/party.js:60-84,328` |
| Relevo `sig` | Autentica, pasa por `P.sigPayload` y reparte a cada cliente SSE suscrito **sin escribir en BD**. Pero cada llamada hace `findByCode` + `load`. | `party_routes.js:98-120` |
| Límites del relevo | `SIG_MAX=512` B para **todo el lote serializado**; `SIG_COUNT=10`; `t` de ≤12 caracteres; solo con `state==='round'` y la misma ronda. | `pb_hooks/party.js:396,493,498,552` |
| Cola del cliente | `{t,d,l}`: con `l`, el último del mismo tipo reemplaza al que está en cola. Lleva sello `n` (secuencia) y `v` (época por carga de página). Deduplica por `from:round:v:(l?t:n)`, así que **latest-wins es por tipo**. | `js/party.js:147-151,189-195,216-219` |
| `sigFlush` | `hb` cada 0,5 s. Por WebRTC cada 20 ms si **todos** los pares están abiertos; si no, HTTP con una petición en vuelo, `SIG_GAP=.05` s, ≤10 msg y ≤500 B. | `js/party.js:224-264` |
| Malla WebRTC | Un `RTCPeerConnection` por par (≤3). Canal `f` sin orden y `maxRetransmits:0`; canal `r` fiable. Ping cada 1 s con RTT EWMA. `linkUsable` es **todo o nada**. | `js/link.js:8-14,66,110-114` |
| Contexto de juego | `duoCtx = {role, roles, seats, byRole, send(t,d,latest), onMsg}`. Roles rotan con `(k+round)%n`. `withSeed(R.seed)` hace que todos construyan el mismo nivel. | `js/party.js:207-222`, `js/main.js:294` |
| Juez | `DUO.wire`: un rol decide, termina `END_SLACK=.6` s antes y manda `end`. Los demás esperan `DUO_WAIT=1.5` s. | `js/games/du1.js:73-82`, `js/main.js:359` |
| Interpolación | `track()` con `LAG=.15`, pero **sella con la hora de llegada**, no con la del emisor. | `js/games/du1.js:14,27-38` |
| Pruebas | Relevo en memoria con retraso fijo; bots por rol a 50/150/300 ms; cero discrepancias de veredicto; exactamente un juez. | `test/duo.test.js:22-35`, `test/squad.test.js:23-37,52` |
| Contrato VS del lab | `c.held(p,b)`, `c.tap(p,b)`, `c.rng`, `c.cpu[]`, `c.skill[]`, `g.ai(p,dt,api)`, `compara()`, `equipos()`. Hoy es **solo misma pantalla**. | `docs/style-lab/fiesta-vs.js:6-12,37-52,99-125` |

---

## 2. Correcciones a la propuesta de 07 (conflictos resueltos)

| # | Tema | 07 decía | Se decide | Por qué |
|---|---|---|---|---|
| C1 | Minijuegos | «Paralelo v1 + fantasmas» (§2.6) | **Retirado.** Todo es en vivo con los modelos A/B/C. `party-ghost.js` no se usa en LA FIESTA. | Mandato del usuario. |
| C2 | Formato de ronda | Ronda de 5 rápidos (§2.7) | **Un minijuego de 25-60 s por ronda**, con formato según el color de casilla: igual = FFA, 2+2 = 2v2, 3+1 = 1v3. «¡RELÁMPAGO!» (3×10 s FFA) queda como casilla o evento. Los retos épicos van en las rondas 4, 8 y la final. | «Lo más parecido a Mario Party». El análisis de tablero proponía 5 por ronda y el de minijuegos 1. Gana el de 1, pero `mj.cola` sigue siendo una lista para que el Relámpago use la misma tubería. |
| C3 | RNG del tablero | `aplicar(S,a,ctx)` con RNG en `keys` | Se confirma, y además **hoy no se cumple**: `fiesta-reglas.js:20,27` guarda `semilla` y `rng` dentro de S. Hay que moverlos a `keys._f` antes de publicar `board`. | Si no, cualquier cliente predice dados y eventos. |
| C4 | Tema privado | `rooms/<id>/p/<asiento>` | **No.** Los temas personalizados de PocketBase no tienen control de acceso (`relay()` manda a quien tenga `hasSubscription(name)`). v1 usa solo la ruta `mine`. Si hiciera falta empujar, el tema llevaría un secreto: `rooms/<id>/p/<sha256(id+key)[0:16]>`. | Fuga de datos. |
| C5 | Objetos en mano | Privados | **Públicos**, como en Superstars/Jamboree, donde el HUD los muestra. Lo privado se reduce a RNG, mazo, la bonus oculta, compromisos sin revelar y `aid` por asiento. | Menos rutas y menos estado. |
| C6 | Salir | `left` | En fiesta, `leave` en partida ⇒ `cpu:'afk'` **y se conserva la clave**. `left` no se usa. | Hoy rejoin exige asiento activo (`party_routes.js:48`) y `leave` pone `left=true` (`party.js:130`): quien se cae no puede volver. |
| C7 | Sesión | sessionStorage | localStorage `minicaos-fiesta-v1` con `{code,id,key,ts}` y reanudación automática al arrancar (válida <6 h). | 40 min en móvil. |
| C8 | Orden de registros | `updated` | **`ver`** (entero monótono). | Dos escrituras pueden caer en el mismo milisegundo. |
| C9 | Invitación | `/r/ABCD` → app clásica | Si la sala es `mode:'fiesta'`, redirige a `/worlds/venezuela/fiesta.html?r=CODE`. | `party_routes.js:143-151` siempre manda a `/?r=`. |
| C10 | Carga de scripts | — | `fiesta.html` necesita su propia lista estática de scripts. En producción descarga `index.html`, que es `public.html`, y ese ya incluye todos los `juego-*.js` + `campana.js`: **juegos cargados dos veces**. | `scripts/sync-world-assets.sh:9`, `public.html:14-58`. |

---

## 3. Modelos de autoridad

Los cuatro análisis usaban letras distintas. Esta es la nomenclatura canónica y su equivalencia:

| Canónico (este doc) | Análisis «extracción» | Análisis «versus» | Análisis «roster» | Idea |
|---|---|---|---|---|
| **A · Cancha propia** | — | A (cuerpos del dueño) + D (paralelo cronometrado) | A | Cada cliente simula y **juzga lo suyo** contra amenazas que son función pura de `(semilla, tiempo de servidor)`. Los rivales se ven en vivo. |
| **B · Dueño + juez** | reenvío de entradas parcial | híbrido A+B | B | Cada cliente es dueño de su cuerpo. **Los objetos compartidos son del juez** (reclamo y concesión). Los golpes los juzga **la víctima**. |
| **C · El juez simula** | reenvío de entradas + `snap` | B / B+P | C | El juez corre toda la física con las entradas reenviadas y publica instantáneas. Los demás interpolan y predicen su propio cuerpo. |
| *(descartado v1)* lockstep | — | C | — | Paso fijo determinista con intercambio de entradas. **No se usa**: los atascos sobre HTTP son peores que lo que aporta. Ritmo y «Simón dice» van con A. |

Conflicto resuelto: el análisis «extracción» proponía que **todos** los juegos usaran reenvío de entradas con retardo para todos. Se rechaza como regla general. Con 200 ms de RTT por relevo, mover tu propio personaje tendría ≈500 ms de latencia de entrada a pantalla (ver la cuenta en §3.3). Ese esquema queda limitado al modelo C, y con predicción del cuerpo propio.

### 3.1 Modelo A: cancha propia

- **Para:** carreras por carril, ritmo, «la abuela dice», saltar el mecate, reacción, memoria, plataformas sin contacto.
- **Sincronía:**
  - El nivel sale de `rng(seed)`, con el mismo número de extracciones en todos los clientes.
  - Las amenazas son `f(seed, gt)`, donde `gt = (serverNow() - T_go)/1000`.
- **Cada cliente:**
  - Simula su cuerpo sin ninguna latencia.
  - Decide su propia eliminación o sus puntos y la publica como `ev{ty:'out'}` (fiable).
  - Envía su estado como `o` (latest, 12 Hz).
- **El juez además:**
  - Simula los cuerpos CPU y los publica como `o`, como si fueran humanos.
  - Verifica lo que dicen los dueños: velocidad ≤ vmax·1,2, sin teletransportes (>2·vmax·dt) y puntos ≤ `scoreRate`·t.
  - Arma el veredicto con los `ev out` y los últimos `o` recibidos.
- **Equidad:** perfecta. Todos ven la amenaza en el mismo `gt`, con un error de reloj <30 ms (§5).

### 3.2 Modelo B: dueño + juez

- **Para:** recoger en arena, keep-away (`f_harina`), papa caliente, esquivar proyectiles de otro jugador y la mayoría de los 1v3.
- **Cuerpos:** igual que en A (`o` a 12-15 Hz).
- **Objetos compartidos** (monedas, la bolsa de harina, la bombita):
  - Pertenecen al juez.
  - El cliente predice de forma optimista y envía `cl{id, t:gtMs}`.
  - El juez **concede el `t` más temprano dentro de una ventana de 120 ms**, con el patrón de `duo/crane.js:12-14`, y anuncia `ok{id, s}`.
  - El que pierde el reclamo deshace con la animación «¡te lo quitaron!».
- **Golpes** (chancla, patilla, empujón con dash):
  - El atacante emite `ev{ty:'shot', x, y, dir, t}`, o una trayectoria determinista a partir de sus parámetros de lanzamiento.
  - **La víctima decide** contra su propia posición en ese `t` («a favor del que esquiva», patrón de `duo/granny.js:14`) y anuncia `ev hit/out`.
- **Regla de diseño:** toda amenaza entre jugadores se **telegrafía ≥0,5 s** en pantalla. Ese telegrafiado es la compensación de lag: dura más que el RTT.

### 3.3 Modelo C: el juez simula

- **Para:** contacto físico y pelota compartida. Sumo y vagón (Bumper Balls), futbolito, bolas criollas, la cuerda y los jefes de los retos.
- **No jueces:** envían `i` (entradas acumulativas, §4.2) y dibujan la instantánea `s` interpolada a `gt - D`.
- **Juez:**
  - Simula a 30 Hz con paso fijo (el análisis de roster decía 60 Hz; se elige 30 Hz por batería y porque el relevo no da más de 10 Hz de instantáneas).
  - Publica `s` a `snapHz` (10 por defecto; 15 si todos los pares son P2P).
- **Latencia sin compensar por relevo a 200 ms de RTT:**

  ```
  entrada → servidor → juez      ≈ RTT/2 + espera de lote (≤50 ms)  ≈ 150 ms
  tick del juez                   ≈ 33 ms
  juez → servidor → tú            ≈ RTT/2 + lote                     ≈ 150 ms
  interpolación D                 ≈ 120-150 ms
  total                           ≈ 450-500 ms   ⇒ inutilizable para tu propio cuerpo
  ```

- **Por eso C exige uno de estos dos:**
  - **C+P (predicción propia):** el juego expone `predict(S, yo, inp, dt)`. Tu cuerpo se mueve localmente y se reconcilia de forma suave: mezcla en 150 ms si el error es >6 px, salto directo si es >60 px, y como máximo 8 px por cuadro en la corrección suave.
  - **C por equipo:** en carreras 2v2 sin contacto entre equipos (`f_carrucha`, `R3 delta`), el delantero de cada equipo simula su vehículo. Equivale a dos DUO lado a lado.
- **`fairDelay` del juez:**
  - El juez aplica a sus **propias** entradas un retardo igual a la mediana de la latencia de ida de los otros humanos, con tope de 120 ms.
  - Así resuelve las disputas con la misma desventaja que los demás.
  - Conflicto resuelto: el análisis «extracción» quería retardo de entrada para todos. Se aplica solo al juez, porque los demás ya llegan tarde por la red.

### 3.4 Qué modelo usa cada juego (corte vertical y catálogo)

| Juego | Modo | Modelo | Estado crítico |
|---|---|---|---|
| `f_mecate` | supervivencia | A | fase de la cuerda = f(gt); `out` propio |
| `f_domino` (port) | FFA ritmo | A | partitura = f(seed); ventana PERFECTO ±60 ms ≫ error de reloj |
| `f_cola`, `f_tequeno`, `f_cerro`, `f_perro`, `f_abuela` | FFA / superv. | A | — |
| `f_harina` (port) | FFA keep-away | B | `dueño`, `brilloHasta` del juez; robos por `cl` |
| `f_chancla` | supervivencia | B | chanclas sembradas; tías eliminadas lanzan → víctima juzga |
| `f_cotufas`, `f_bombita`, `f_bombillo`, `f_cava`, `f_hallacas` | varios | B | — |
| `f_patilla` | 1v3 | B | lanzamientos deterministas `{x,ang,t}`; cada uno del trío juzga su golpe |
| `f_bono`, `f_guaya`, `f_alcabala`, `f_silbon` | 1v3 | B | — |
| `f_futbolito` | 2v2 | C+P | pelota y 4 cuerpos |
| `f_vagon`, `f_bolas`, `f_cuerda` | superv. / FFA / 2v2 | C | — |
| `f_carrucha`, `R3 delta` | 2v2 | C por equipo | — |
| `R1 catatumbo` | 4 vs jefe | C (jefe) + A (rayos) | — |
| `R2 salto ángel` | FFA | A | — |

El **corte vertical**, con 6 juegos, cubre los 4 modos y los 3 modelos: `f_mecate` (A), `f_domino` (A), `f_harina` (B), `f_chancla` (B), `f_futbolito` (C+P) y `f_patilla` (B 1v3).

---

## 4. Mensajes

### 4.1 Sobre (envelope) y alcances

Todo mensaje `sig` de fiesta lleva:

```
petición:  POST sig { code, id, key, sc: 'b' | 'm:<k>', m: [ ... ] }   // el alcance va UNA vez por petición, como hoy `round`
mensaje:   { t: tipo(≤12), d: datos, l?: 1, n: seq, v: época }       // como hoy (js/party.js:149-151)
           // `e` (época del juez) va DENTRO de `d` en los tipos del juez (s, s2, w, ok, jg, end, ev cpu/hum)
```

- Por qué no un `sc`/`e` por mensaje: `sigPayload` copia solo `t, d, n, l, v` de cada mensaje (`pb_hooks/party.js:498-503`), así que se perderían, y además cada byte cuenta contra los 512. El cliente lleva **una cola por alcance**.
- El servidor añade `from` (ya lo hace, y no se puede falsificar) y **`at: Date.now()`**, que sirve como muestra extra de reloj.
- La deduplicación pasa a la clave `from:sc:v:(l ? t : n)`. Hoy es `from:round:…`.
- **Reservados** (lista única con el doc 08 §4.4): `i o s s2 w cl ok ev end hb rdy jg aim react frame _net_ping _net_pong`. Los tipos propios de un juego llevan prefijo `x` (`xtiro`, `xpasa`, ≤200 B) y el servidor los deja pasar en el alcance `m`.

### 4.2 Tabla de esquemas

| `t` | Alcance | l / fiable | Quién envía | Esquema (`d`) | Tamaño típico |
|---|---|---|---|---|---|
| `hb` | b, m | l | todos | `{rtt, vis:0/1}` (RTT suavizado; `vis` = pestaña visible). Cada 2 s va **siempre por HTTP** aunque haya P2P: es la presencia que usa el servidor (07 D20) | 25 B |
| `aim` | b | l, ≤5 Hz | actor del turno | `{k:'ruta'\|'obj'\|'tienda'\|'blanco', v}` | ≤64 B |
| `react` | b, m | fiable | todos | `{k}` ∈ `REACT_KINDS` (¡NA'GUARÁ!, ¡QUÉ LADILLA!…) | 20 B |
| `rdy` | m | fiable | todos | `{}` (terminó la tarjeta) | 10 B |
| `i` | m | l, ≤20 Hz al cambiar + 4 Hz de keepalive | humanos, **solo en C/Ceq** (o A/B con `entradas: true`) | `{k, b:bitmask, a:[ta,tb], x?:-100..100, y?:-100..100}`: `ta/tb` son **contadores acumulativos** de toques | 35-50 B |
| `o` | m | l, 12-15 Hz | dueño (A/B); el juez incluye las CPU | `{k, t:gtMs, b:[[asiento,x,y,vx,vy,st,sc], …]}`. **Un solo `o` por emisor:** la fusión latest es por (emisor, tipo), así que un `o` aparte por cada CPU se pisaría y solo llegaría el último | 50-70 B por cuerpo |
| `w` | m | l, ≤5 Hz, solo por HTTP | juez | paquete para mirones sin P2P (espectadores, quien acaba de tomar un asiento): todos los cuerpos o el `s`. Solo si `mj.watch > 0` (07 D18) | ≤420 B |
| `s` | m | l, `snapHz` | juez (C) | `{e, k, t:gtMs, p:[[x,y,st,sc]×n], w:[…compacto del juego], h?}` (`h` = hash cada 30 ticks) | 120-400 B |
| `s2` | m | l | juez | desborde de `s`, mismo `{e,k,t}` | ≤400 B |
| `ev` | m | fiable | juez / dueño / víctima | `{e?, k, ty:'out'\|'hit'\|'shot'\|'pasa'\|'cpu'\|'hum'\|'gol'…, p?, d?}` | 30-80 B |
| `cl` | m | fiable | humano | `{id, t:gtMs}` | 25 B |
| `ok` | m | fiable | juez | `{e, id, p}` (`p` = índice ganador, o `-1` si nadie) | 25 B |
| `jg` | m | fiable | juez nuevo | `{e, k}` (eco tras el CAS del servidor) | 20 B |
| `end` | m | fiable | juez | `{e, k, sc:[…], pl:[…], cpu:[…], h}` | 60-100 B |

Reglas de tamaño:

- **Cada payload debe medir ≤420 B**, para que entre en `SIG_MAX=512` con el sobre (≈40-45 B por mensaje: `{"t":..,"d":..,"n":..,"l":true,"v":"xxxxxxxx"}`). Pero el tope es por **lote**: un `s` de 420 B viaja solo y empuja `hb`/`ev` a otra petición. Para el `s` del juez, apuntar a ≤300 B.
- Se diseña para los límites del relevo **incluso en P2P**, porque la caída a relevo puede pasar en cualquier momento.
- Si un juego necesita más, parte el estado en `s`/`s2`. Como latest-wins va por tipo, cada parte se coalesce por separado.

### 4.3 Toques que no se pierden

- `c.tap(p,'a')` en el juez se calcula como `nuevos = ta - ultimoTa[p]` y se limita a 16/s por botón. Un humano llega a unos 12-15.
- Coalescer o perder un `i` **nunca** quita toques: el siguiente `i` trae el contador acumulado.
- `held` es el bit actual. Una pulsación corta que nace y muere entre dos envíos llega como contador y no como `held`. Los juegos que dependen de pulsaciones cortas leen `tap`, nunca `held`.

---

## 5. Reloj compartido

### 5.1 Estimación del desfase

- **Toda** respuesta `/api/party/*` incluye `now: Date.now()`. Todo mensaje relevado incluye `at`, aunque como muestra es peor, porque no se conoce el retraso de subida.
- El cliente guarda las últimas 10 muestras `{off = now - (t0+t1)/2, rtt = t1 - t0}`, donde `t0`/`t1` son el envío y la respuesta en `Date.now()` local.
- `off` es el de la muestra con **menor rtt**:

  ```
  serverNow() = Date.now() + off
  error ≤ rtt_min / 2   (cota por asimetría de ida y vuelta)
  ```

- **Ráfaga en la tarjeta:** 5 llamadas a una ruta nueva y barata `POST /api/party/time` (sin BD, responde `{now}`), separadas 150 ms. Con RTT mínimo de 60 ms la cota queda en ±30 ms (por verificar en redes móviles reales).
- Se usa `Date.now()` para casar con el servidor y `performance.now()` para medir intervalos. Si el `Date.now()` local salta (NTP del sistema, cambio de hora), un salto de más de 1 s entre muestras consecutivas invalida las muestras viejas.

Conflicto resuelto: un análisis llamaba a ese campo `st` y otros dos `now`. Se usa **`now`**.

### 5.2 Tiempos absolutos de un minijuego

| Marca | Quién la fija | Valor |
|---|---|---|
| `mj.cartaHasta` | servidor al abrir la tarjeta | `now + fxMs(backlog) + 4500 (ruleta y equipos) + 15000` |
| `mj.startAt` (= `T_go`) | servidor al recibir el último `ready` humano, o en `cartaHasta` | `now + 3500` (cuenta 3-2-1-¡YA!) |
| fin de juego | todos | `gt ≥ dur`, o el `end` del juez si `finTemprano` |
| `mj.cierre` | servidor | `T_go + dur·1000 + 3000` de gracia |

- Todos los clientes arrancan, terminan y programan amenazas sobre `gt`. **Nunca** se arranca porque llegó un empuje SSE; hoy DUO lo disimula con la tarjeta de 7,3 s.
- **Gracia:** el análisis de tablero proponía 2 s, el servidor clásico usa `GRACE_MS=8000` y DUO usa `DUO_WAIT=1,5` s. Se decide así:
  - Los clientes no jueces esperan `end` hasta 1,5 s después de `dur`.
  - El servidor cierra a los 3 s: 1,5 s de espera, más el error de reloj, más el viaje de `mjfin`.

### 5.3 Interpolación de entidades remotas

- Cada `o` y cada `s` lleva `t` = tiempo de juego del **emisor**, en ms.
- El receptor guarda un búfer de 8 estados por entidad y dibuja en `gt - D`, interpolando linealmente entre los dos que rodean ese instante. Esto corrige `track()` de `du1.js:27`, que sella con la hora de llegada y por eso mete el jitter de la red en el dibujo.

```
D = clamp(1.5 · intervaloObservado + 2 · σ_jitter, 100 ms, 250 ms)   // se recalcula cada 1 s, cambia ≤20 ms por recálculo
si el búfer se vacía:  extrapolar con v hasta 100 ms, luego congelar
campos no interpolables (st, sc, dueño):  tomar el estado más nuevo con t ≤ gt - D
```

`track2(id)` sustituye a `track()` en la API de fiesta. `du1.js` no se toca.

### 5.4 Presupuesto de latencia percibida (objetivo: jugable con RTT 200 ms)

| Modelo | Tu cuerpo | Rivales | Objetos compartidos | Amenazas sembradas |
|---|---|---|---|---|
| A | 0 | RTT/2 + D ≈ 220 ms | — | 0 (función de gt) |
| B | 0 | ≈ 220 ms | reclamo: optimista; confirmación ≈ RTT + 120 ms | 0 |
| C+P | 0 (predicho) | RTT + D ≈ 350 ms | RTT + D | — |

---

## 6. El juez

### 6.1 Elección

- La hace el **servidor** al abrir la tarjeta (`mj.juez`, `mj.suc`, `mj.e = 0`) y la **confirma al fijar `startAt`**: si el juez provisional perdió la presencia durante la carta, pasa el primero vivo de `mj.suc`.
- Datos de entrada: el RTT que cada cliente manda en el `hb` de presencia **por HTTP** (07 D20; con P2P el `hb` de 0,5 s no pasa por el servidor), guardado en `$app.store()` (`fp:<code>:<asiento>`) con TTL de 10 s (no se escribe en el registro).
- Regla:

  ```
  candidatos = humanos conectados (presencia y hb < 2 s) y no afk
  si 1v3 y existe candidato del trío con rtt ≤ rtt(solo) + 40 ms: quitar al solo
  orden = por rtt ascendente; empates (±15 ms) por (índice + mj.k) % n   // rota entre partidas
  juez = orden[0]; sucesión = orden[1..]  (se publica en mj.suc)
  ```

- Conflicto resuelto: un análisis proponía «el humano de id menor» y otro «el de menor RTT elegido en el cliente». Se elige que el servidor decida por RTT y con rotación, porque así se evita que dos clientes se proclamen juez a la vez y se reparte la ventaja.

### 6.2 Responsabilidades

1. Correr `ai(S,p,dt,api)` para cada asiento CPU y cada humano que pasó a CPU por desconexión.
2. Modelo A: verificar a los dueños y armar el veredicto. Modelo B: conceder reclamos. Modelo C: simular y publicar `s`.
3. Enviar `end` y llamar a `POST /api/party/mjfin`.
4. Emitir `ev cpu` y `ev hum` cuando un asiento entra o sale de CPU.
5. Mandar `hb` cada 0,5 s aunque no tenga nada más que enviar.

### 6.3 Migración

```
// en cada no-juez, cada cuadro:
silencio = ahora - ultimoMensajeDelJuez   // cualquier s, o, ev, hb con e == epoch actual
si silencio > 1.2 s:
   cand = primer asiento de mj.suc con presencia viva (no el juez actual)
   si cand == yo y no he reclamado en esta epoch:
       POST /api/party/juez {k: mj.k, e: epochQueVeo, tick: miUltimoK}
// servidor (transacción, compare-and-set):
   exige mj.k vigente, mj.e == e, llamante activo y humano, y no cerrado
   mj.juez = llamante; mj.e = e + 1; ver++   → empuje SSE a todos; invalidar la caché del relé (si no, rechaza al juez nuevo hasta 1 s)
// nuevo juez:
   si el juego tiene restore: S = restore(ultimaInstantanea); seguir desde su k
   si no (migra:false): terminar ya con los puntos de la última instantánea (end con finTemprano)
   send('jg', {e, k})
// todos: descartar mensajes de juez con e < epoch vigente
```

- **Umbrales:** el juez manda algo al menos cada 0,5 s (`hb`), así que 1,2 s son más de dos `hb` perdidos. La ausencia de un *humano* se declara a los 2 s (`SIG_AWAY`), porque los humanos callados son normales en algunos juegos.
- Conflicto resuelto: hubo propuestas de «el siguiente se autopromueve a los 2 s» y de «CAS en el servidor a los 1,2 s». Se elige el CAS en el servidor: sin árbitro, una partición de red produce dos jueces con veredictos distintos.
- Un juez que vuelve de una partición ve un `e` mayor en el registro y se degrada solo.

### 6.4 CPU y flujos de aleatoriedad

| Flujo | Quién lo consume | Uso |
|---|---|---|
| `c.rng` | todos, en `init()` (nivel). En C, solo el juez durante `step` | mundo |
| `c.rngFor('cpu'+p)` | quien corra el CPU p (el juez) | decisiones de la IA |
| `c.rngFor('haz')` | todos | amenazas de A/B en función de gt (pre-extraídas en `init` o indexadas por tick) |
| `c.fx` | local, sin semilla | partículas y cosmética |

Regla heredada de `du1.js:2-8`: **toda** la aleatoriedad que afecta al juego se extrae en `init()` o se indexa por `(tick, etiqueta)`. Una IA que corre en otro cliente nunca consume `c.rng`.

---

## 7. Asientos: CPU, desconexión, reconexión y toma de asiento

### 7.1 Estados de un asiento

```
humano ──(sin i/o/hb 2 s en mj)──▶ humano·cpu-temporal ──(0,5 s de i de nuevo)──▶ humano
humano ──(2 timeouts de dado en tablero, o leave)──▶ cpu:'afk' (clave conservada) ──(back / acción con su clave)──▶ humano
cpu:'auto' (relleno al start) ──(join de un humano nuevo)──▶ humano (clave nueva)
cpu:'afk' con >180 s sin su dueño ──(join de un humano nuevo)──▶ humano (clave nueva; la vieja se invalida)
```

### 7.2 En el minijuego

- **Caída de 2 s:** el juez emite `ev{ty:'cpu', p}`.
  - En A/B el juez toma el cuerpo congelado desde su último `o`.
  - En C ya lo simulaba; solo cambia la fuente de las entradas.
  - El HUD muestra «(se le fue el internet)».
- **Vuelta:** tras 0,5 s de `i` frescos, el juez emite `ev{ty:'hum', p, d:estadoCuerpo}` y el dueño retoma desde ese estado.
- **Resultado:** cuenta para el asiento, aunque lo haya jugado la CPU. El campo `cpu:[asientos]` de `end` queda solo para estadísticas.
- **Pestaña en segundo plano:** al volver no se reproduce nada. Se cae al estado en vivo (último `o`/`s`) y aplica la regla anterior.

### 7.3 Toma de asiento a mitad de partida

- El servidor **acepta** el `join` con toma de asiento en cualquier fase y emite la clave nueva y el efecto `fx{k:'llega', s, name}`.
- El control efectivo empieza en la **siguiente frontera**:
  - en el tablero, en el siguiente `esp` (prompt) de ese asiento;
  - en un minijuego, el recién llegado **mira en vivo** como espectador (el alcance `m:<k>` le llega igual) y el asiento sigue como CPU del juez hasta el cierre. El resultado de la CPU se queda.
- Conflicto resuelto:
  - Un análisis proponía meter al recién llegado a mitad de minijuego. Se rechaza: cambiar de dueño de un cuerpo en pleno juego es complejo y otro análisis lo descartó.
  - Otro análisis proponía que puntúe último. También se rechaza: el asiento ya tenía un desempeño jugado por la CPU y castigarlo no tiene sentido.
- **Espectadores:** con 4 humanos sentados, quien entra recibe `{spectate:true}`, sin clave. Puede suscribirse a `rooms/<id>` y `rooms/<id>/sig` pero no enviar. Si un asiento pasa a CPU, ve el aviso «📢 Hay puesto libre».

### 7.4 Reconexión

**Al arrancar:**

1. Leer `localStorage['minicaos-fiesta-v1']`. Si tiene menos de 6 h, hacer `join` con id y clave.
2. Si responde 403/404, borrar la entrada e ir al menú. Si responde 200, reconstruir todo desde el registro y `mine`, con el director en modo salto (§9) y la tarjeta «Mientras no estabas…».
3. Reabrir SSE y la malla. La voz se queda apagada hasta que el jugador toque el botón, porque es un permiso del navegador.

**Al volver a primer plano (`visibilitychange` → visible):**

1. Cerrar y reabrir el EventSource. iOS lo mata en segundo plano (por verificar en iOS 18/19).
2. Sondeo inmediato y `mine`.
3. Ráfaga de reloj.
4. `tick` si toca.

**Al pasar a segundo plano (oculto):**

- Se dejan de enviar `aim` y `hb`.
- **Nunca** se envía `leave`, con el mismo razonamiento que `party.js:135-139`.

### 7.5 AFK en el tablero

- Cada prompt tiene un plazo: dado 20 s (30 s en el primer turno), objeto 12 s, ruta 12 s, tienda/peaje/transporte 15 s, estrella 10 s, `commit` 12 s. Ese plazo se suma al tiempo de la cinemática, `fxMs`.
- Valores por defecto al vencer: tirar el dado, ruta principal (`ady[nodo][0]`), no comprar, **comprar la estrella si alcanza** y rechazar rutas de pago.
- Dos vencimientos del dado convierten el asiento en `cpu:'afk'`, con hamaca 💤.
- **Presencia rápida** (07 D20, sustituye el tema `rooms/<id>/h/<seat>` que se proponía aquí):
  - Cada cliente manda un `hb {rtt, vis}` por HTTP cada 2 s, aunque tenga P2P. `relay()` lo anota en `$app.store()` (`fp:<code>:<asiento>`).
  - En `tick`, si el actor lleva >20 s sin `hb` de presencia, o con `vis: 0`, el valor por defecto se aplica de inmediato.
  - Motivo del cambio: el tema por asiento no tiene control de acceso, así que cualquiera podía suscribirse en nombre de otro y «mantenerlo presente»; y el SSE sigue abierto un buen rato con la pestaña oculta en Android, así que no detecta el segundo plano. El `hb` sí se detiene cuando el navegador congela la pestaña.

---

## 8. Transporte

### 8.1 `fiesta-net.js`: por qué un módulo nuevo y no cargar `js/party.js`

- `engine.js` y `core.js` declaran en el nivel superior los mismos nombres (`W`, `H`, `INK`, `ctx`, `now`, `snd`, `sfx`, `txt`). `txt` tiene además otra firma. Cargar `core.js` en la página del lab lanza un SyntaxError.
- `js/party.js` está atado a los globales de `main.js` (`state`, `st`, `mode`, `parts`, `beginGame`, `REGMAP`…) y al reloj de juego `now`. El lab congela ese reloj fuera de los juegos (`engine.js:1496-1499`), así que los temporizadores del relevo se pararían en el tablero.
- `link.js` y `voice.js` leen los globales `party`, `pcall`, `auth`, `onSig`, `vsend`, `t`, `say`, `track` y `PARTY_UI`.

Conflicto resuelto: un análisis proponía un adaptador `fiesta-red.js` que creara esos globales y cargara `link.js`/`voice.js` tal cual. Se elige **portar**, por dos motivos:

1. El envío por par (§8.2) exige cambiar `link.js` de todos modos.
2. Un adaptador de globales en la misma página que `engine.js` es frágil. Ya hay riesgo de colisión con `t` (por verificar: `engine.js` no parece declarar un `t` global, pero los juegos del lab sí podrían).

El adaptador queda como plan B si el port se atrasa.

```js
const N = FIESTA.net.create({
  api: '', fetch, EventSource, RTC: window.RTCPeerConnection,
  ice: () => window.CLAUDEWARE_ICE_SERVERS || STUN,
  clock: () => performance.now() / 1000,   // nunca el `now` del motor
  wall:  () => Date.now(),
  storage: localStorage, log, track
});
await N.create({ name, color, ch }) / N.join(code, { name, color, ch })   // rejoin automático con {id,key} guardados
await N.takeover(code, seat, { name, ch })     // equivale a join cuando hay asiento CPU libre
await N.act(a) / N.commit(k, v) / N.mine() / N.tick() / N.back() / N.leave()
N.room; N.board; N.ver; N.you; N.seats()       // [{id, name, ch, color, cpu, online, rtt, via:'p2p'|'relay'}]
N.onRoom(fn(room, prev)); N.onGone(fn)
N.serverNow(); N.rtt(id); N.label()            // '42 MS · DIRECTO' / 'RELEVO'
const ch = N.channel('b' | 'm:'+k)             // con forma de duoCtx: send(t,d,latest), onMsg(fn(t,d,fromSeat,fromId)), seats, away(id), close()
N.voice.toggle(); N.voice.talking(id); N.voice.stream   // el mismo stream lo usan los juegos de micrófono (engine.js:1019)
```

- `js/party.js` y `js/link.js` no cambian en v1, y `test/party-network.test.js` sigue igual.
- En una fase 2 opcional, ambos pasan a ser adaptadores finos sobre `FIESTA.net`.
- `channel()` tiene la forma de `duoCtx`, así que los bots de DUO/SQUAD pueden correr sobre él como prueba de conformidad.

### 8.2 Envío por par (sustituye el «todo o nada»)

```
enviar(lote):
  abiertos = pares con linkReady (canal abierto y rx < 2.5 s)
  para cada p en abiertos: linkRaw(l ? 'f' : 'r', lote, p)
  si existe algún par humano NO abierto: encolar en el carril HTTP correspondiente
// el receptor deduplica por (from, sc, v, n|t), así que los duplicados P2P+relevo no hacen daño
```

- Hoy `linkUsable()` (`link.js:12`) exige que **todos** los pares estén abiertos: un solo par con NAT difícil manda la sala entera al relevo.
- Con el cambio, solo el tráfico hacia ese par usa el relevo. Pero ojo: el relevo HTTP es broadcast, así que los que sí tienen P2P lo reciben dos veces. Es aceptable, porque la deduplicación lo absorbe.

### 8.3 Dos carriles HTTP

| Carril | Tipos | Política |
|---|---|---|
| **rápido** (latest) | `i`, `o`, `s`, `s2`, `hb`, `aim` | 1 petición en vuelo; `SIG_GAP` 50 ms; al armar el lote se toma solo la versión más nueva de cada tipo |
| **fiable** | `ev`, `cl`, `ok`, `end`, `jg`, `rdy`, `react` | 1 en vuelo; FIFO; reintento con `sigRestore` (`party.js:152-157`); se descarta tras 5 s |

Así un `s` no espera detrás de un `ev`. Hay como mucho 2 peticiones en vuelo por cliente, más el carril `frame`, que fiesta no usa. El modelo es el carril de `frame` de `js/party.js:229-238`.

### 8.4 Cambios en el servidor (hooks)

| Cambio | Archivo | Detalle |
|---|---|---|
| Modo | `pb_hooks/party.js:8` | `fiesta` en `MODES` |
| `sigPayload` rama fiesta | `pb_hooks/party.js:492-555` | Va **antes** de la puerta `state !== 'round'` (`:493`). `sc` viene en el cuerpo de la petición. `sc==='b'`: cualquier estado; tipos `hb`, `aim`, `react`. `sc==='m:'+k`: solo con `board.f in {carta, mj}`, `k===board.mj.k` y sin cierre; whitelist §4.2 más `x*`; `s`, `s2`, `w`, `ok`, `end`, `jg` **solo desde `mj.juez`**, con `d.e===mj.e`; `ev` con `ty in {cpu,hum}` solo del juez. Los límites de 512 B y 10 se mantienen. |
| Limitador | clave propia por asiento `fl:<code>:<asiento>` en `$app.store()` | 25 msg/s por emisor (ráfaga 40); `aim` 5 Hz; `react` vía `reactLimit`. **No** se usa `limitRoom` para esto: guarda un solo JSON por sala bajo candado y serializaría todo el relé de la sala |
| Caché del relevo | `party_routes.js:98-120` | `$app.store()` `code → {id, keys, mode, f, mjK, juez, e}`, para evitar `findByCode`+`load` en cada `sig`. **Invalidación obligatoria** tras cada escritura confirmada; el TTL de 1 s es solo red de seguridad |
| Rutas nuevas | `party_routes.js:55-66` | `act`, `commit`, `mine`, `pick`, `cfg`, `ready`, `back`, `time`, `juez`, `mjfin`, `mjack` (el «listo» de la carta es `ready`) |
| `now` | todas las respuestas | `{…, now: Date.now()}`; `at` en cada mensaje relevado |
| Rejoin | `party_routes.js:47-53` | En fiesta, cualquier asiento con id y clave válidos (incluidos los `cpu:'afk'`) |
| Invitación | `party_routes.js:143-151` | redirección según el modo (C9) |
| Reglas de tasa PB (por IP) | migración nueva | `act` 600, `commit` 300, `mine` 300, `tick` 600, `report`/`mjfin`/`mjack` 300, `pick`/`ready`/`cfg` 240, `join` 60, `time` 300 /60 s. `sig` sigue en 7200/60 s |

---

## 9. Tablero en vivo: director, cola de efectos y sincronía

### 9.1 Estado

- `rooms.ver`: entero. `rooms.board`: JSON público con objetivo <12 KB y tope de 32 KB. `rooms.keys`: tope de 16 KB.

  ```
  board = { f:'lobby'|'orden'|'turno'|'carta'|'mj'|'res'|'final'|'fin', r, tot, cfg, orden:[…],   // reto = mj con cola[0].reto
            t:{s, paso, resto, camino, hasta}, esp:{id, s, k, opc, hasta}|null,
            pj:{a:{ch, nodo, mon, est, obj:[…], cpu:null|'auto'|'afk', afk, stats}, …},
            estrella:{nodo, precio}, tab:{…},
            mj:{k, tipo:'ffa'|'2v2'|'1v3'|'1v1', clase, eq, solo, cola:[{g, seed, dur, lv, modelo, reto}], i,
                juez, suc, e, cartaHasta, startAt, listos:{…}, cierre, watch, res}|null,   // forma canónica: 07 §3.2
            fx:[{v, s, fx:[…]}]  // anillo de las últimas 16 versiones
            log:[…30 líneas] }
  keys._f = { rng, semilla, deck, bonusOculta, c:{k:{seat:val}}, aid:{seat:n}, cpuAt }   // presencia y RTT: $app.store(), no aquí
  ```

- El mapa de 114 nodos (16,4 KB) es estático en ambos lados y **nunca** entra en el registro.

### 9.2 Contrato servidor → director

- Cada paso del reductor `aplicar(S, a, ctx) → {S, fx}` emite **efectos completamente resueltos**, de modo que el cliente nunca necesita el RNG:

  ```
  {k:'dado', s, v:7}  {k:'hop', s, de, a}  {k:'pasa', s, nodo, que, d}  {k:'mon', s, d, tot}
  {k:'est', s, d, tot}  {k:'compra', s, item}  {k:'ataque', s, a, item, d}  {k:'estrellaMueve', a}
  {k:'evento', id}  {k:'turno', s}  {k:'mjIni', tipo, eq, juego}  {k:'mjRes', pl, mon}  {k:'llega', s, name}
  ```

- Hay una tabla **compartida** de duraciones: hop 0,16 s, moneda 0,5 s, dado 0,9 s, fanfarria de estrella 2,2 s, vista general 1,6 s, carta de evento 1,8 s. El servidor la usa para calcular `fxMs`, y los plazos se suman **después** de la cinemática.

### 9.3 El director (`fiesta-director.js`, sin DOM)

```
S = último board por ver mayor     D = estado mostrado     shownV
alRecibir(room): si room.ver <= S.ver: ignorar; S = room.board
cada cuadro:
  pend = S.fx.filter(b => b.v > shownV)
  si pend vacío o primer pendiente.v > shownV+1 (el anillo nos pasó):
       si shownV < S.ver: D = S; shownV = S.ver; mostrar "Mientras no estabas…" desde log
  velocidad = pend.length<=1 ? 1 : pend.length<=3 ? 2 : SALTO   // tocar pantalla = 3× local
  reproducir el siguiente efecto a esa velocidad; al terminar el lote: shownV = lote.v
  invariante: cola vacía ⇒ hash(D) === hash(S); si falla: D = S, log 'fiesta_desync'
  prompt visible solo si shownV >= versión que creó esp y esp.s === yo
```

- **Ocultar la latencia del actor:**
  - El dado gira en local. Al tocar, se envía `act TIRAR` y suena un golpe con bamboleo de 300 ms. El valor llega en la **respuesta** de `act`, antes que el SSE.
  - La flecha de ruta se resalta de forma optimista y un 409 la revierte.
- **Espectadores del turno:**
  - Reciben los mismos efectos en el mismo orden, entre 100 y 300 ms más tarde. No hace falta lockstep.
  - La duda en vivo llega por `aim` (latest, ≤5 Hz): la flecha que el actor tiene resaltada, el objeto bajo el dedo, el blanco de un ataque.
- **Turnos de CPU:**
  - `cpuAt = now + fxMs + 400 ms`.
  - El primer cliente que llama a `tick` con `serverNow() ≥ board.nextAt` (más un jitter de 0-400 ms) los aplica. `tick` es idempotente, y si `now < nextAt` lee sin abrir una transacción de escritura.
  - Si todos los humanos están en segundo plano, nadie llama a `tick` y la partida se pausa. Se acepta, porque no hay temporizador en el servidor.

### 9.4 `act` versionado e idempotente

```
POST /api/party/act {code,id,key, eid, aid, a:{t:'TIRAR'|'USAR'|'RUTA'|'COMPRAR'|'ESTRELLA'|'PAGAR'|'SUBIR'|'OBJETIVO', …}}
  403 si esp.s ≠ asiento
  aid == keys._f.aid[seat]         → 200 {room, now}  (reintento, no se reaplica)
  eid ≠ esp.id                     → 409 {room, now}  (07 D17: solo si el AVISO cambió; un ready/back/llega ajeno ya no rechaza tu dado)
  si no: {S,fx} = aplicar(S, a, ctx); ver++; board.fx.push({v:ver, s, fx}); guardar → SSE
```

`commit` se usa para las decisiones simultáneas: dados de orden, apuestas de duelo, votos de «últimos 5». El valor se guarda en `keys._f.c[k][seat]` y se revela en un efecto cuando han llegado todos los humanos o vence el plazo. Los valores de las CPU los saca el servidor.

### 9.5 Del tablero al minijuego y de vuelta

```
fin de los turnos de la ronda → servidor: tipo según colores; bolsa filtrada por modo; mj = {k:++, juego, seed, …}
   fx: ruleta de formato + "¡2 CONTRA 2!" (4,5 s)
tarjeta (≤15 s): objetivo, controles táctil y teclado, demo, PRÁCTICA local sin la semilla real, botón ¡LISTO!
   (en segundo plano: elección del juez por rtt, calentar la malla, ráfaga de reloj, precargar arte)
ready de todos los humanos o cartaHasta → startAt = now+3500 → 3-2-1-¡YA! sobre serverNow()
juego (dur) → end del juez → mjfin → servidor: puestos → monedas (tablas del doc 04) → fx mjRes
podio 5 s (se puede saltar a los 2 s si todos tocan) → f:'turno' con el primero del orden
```

- A `startAt - 3000`, cualquier cliente que siga reproduciendo efectos del tablero hace salto. Nadie empieza un minijuego con el tablero viejo.
- `room.state` y `room.round` se mantienen solo por compatibilidad con los limitadores existentes. El cliente de fiesta se guía únicamente por `board.f` y `mj.k`.

---

## 10. API del runtime VS en vivo (`fiesta-live.js`)

### 10.1 Definición de un juego

Conflicto resuelto: había dos propuestas.

- El análisis «versus» quería un **sim puro**: `init`/`step`/`pack`/`unpack`/`draw`.
- El análisis de roster quería **extender `FIESTA.VS.add`** con una clausura `update` y `g.scores`.

**Contrato canónico: el de dos niveles del doc 08 §5** (07 §2.1). El estilo de cierre (`update`/`draw`/`scores`/`fin`/`ai`) basta para A y B; `pack`/`unpack`/`restore` son obligatorios en C/Ceq y en todo juego con `migra: true`, y `predict` en C. La forma de sim puro de abajo es la **recomendada para los C nuevos** (permite migrar, instantáneas y pruebas sin navegador), pero no se le exige a los A/B. Los 5 ports existentes entran con el envoltorio `legacy`.

```js
FIESTA.LIVE.add('f_harina', {
  name: '¡LA ÚLTIMA HARINA!', modos: ['ffa', '1v1'], dur: 30, stick: false, botones: 1,
  modelo: 'B', snapHz: 10, clase: 'rank',              // 'rank' | 'survival' | 'binary'
  limites: { scoreMax: 400, scoreRate: 15, minT: 3, finTemprano: false },
  migra: true, minHumanos: 1,
  carta: { obj: '¡Agarra la harina y no la sueltes!', como: { tactil: 'A', teclado: 'ESPACIO' }, demos: [...] },
  mk(c) {
    return {
      init()               { return S0 },                  // usa c.rng; misma cantidad de extracciones en todos
      step(S, inp, dt)     { /* inp[p] = {held:{a,b}, tap:{a,b}, x, y} */ return S },   // juez (C) o cada dueño (A/B) sobre lo suyo
      own(S, yo, inp, dt)  { },                             // A/B: avanza solo mi cuerpo
      ai(S, p, dt, api)    { api.hold('a', bool); api.tap('a'); api.axis(x, y) },
      pack(S)  { return [/* enteros, ≤420 B */] },  unpack(a) { return S },
      lerp(S0, S1, u)      { },                             // opcional
      predict(S, yo, inp, dt) { },                          // C+P
      restore(snap)        { return S },                    // si migra
      claim(S, id, s, t)   { return true },                 // B: el juez decide cuando hay varios reclamos en 120 ms
      victim(S, ev)        { return 'hit' | null },         // B: lo juzga el receptor
      draw(S, c)           { },                             // dibuja SOLO desde S (juez, jugador o espectador)
      score(S)             { return [...] },  done(S) { return bool },
      ganaSolo(S)          { return bool },  ganaEquipo(S) { return 0 | 1 | -1 }
    };
  }
});
```

### 10.2 El contexto `c`

| Campo | Significado |
|---|---|
| `n`, `seats[{id,name,color,ch,cpu,team,human}]`, `mode`, `teams`, `solo`, `lv` | Configuración (de `mj`) |
| `yo` | Mi asiento, o `-1` si soy espectador |
| `juez()`, `epoch` | ¿Soy el juez ahora?, y la época vigente |
| `rng`, `rngFor(tag)`, `fx` | Flujos de aleatoriedad (§6.4) |
| `ahora()` | `gt` en segundos, del reloj sincronizado |
| `held(p,b)`, `tap(p,b)`, `axis(p)` | Entrada unificada: local, remota (desde `i`) o CPU |
| `send(t, d, {latest})`, `on(t, fn(d, seat))` | Mensajes del juego (los tipos reservados están prohibidos) |
| `remoto(p)` | Vista interpolada de `p` (`track2`) |
| `reclama(id)` | Promesa que resuelve `ok` o `perdido` (modelo B) |
| `out(p?)` | Anuncia mi eliminación (A/B) |
| `dueno(p)` | ¿Es mío este cuerpo? |

### 10.3 Bucle del runtime (pseudocódigo)

```
arranque: construir g = def.mk(c); S = g.init()        // todos
esperar serverNow() >= startAt; acc = 0; k = 0
cada cuadro(dt):
  si modelo C/Ceq: enviarEntradaLocal()                 // 'i' al cambiar (≤20 Hz) + keepalive 4 Hz; toques acumulados
  gt = c.ahora(); si gt < 0: return
  modelo A/B:
     S = g.own(S, yo, entradaLocal, dt)                 // cero lag
     si c.juez(): para cada CPU p: S = g.own(S, p, aiInput(p), dt)
     cada 1/12 s: send('o', {k, t:gt·1000, b:[mi cuerpo, + las CPU si soy juez]}, latest)   // UN solo o por emisor
                  validar o's recibidos; resolver reclamos (ventana 120 ms) → send('ok')
     vista = mezclar(S propio, remotos interpolados a gt - D)
  modelo C:
     si c.juez():
        acc += dt
        mientras acc >= 1/30:
           inp = seats.map(p => cpu[p] ? aiInput(p)
                                : p == yo ? retrasada(local, fairDelay)
                                : entradaRemota[p])
           S = g.step(S, inp, 1/30); k++; acc -= 1/30
           si k % (30/snapHz) == 0: send('s', {e, k, t:k·33, p:g.pack(S)}, latest)
     si no:
        vista = interp(bufS, gt - D); si g.predict: vista = fusionarPropio(vista, predecirPropio())
        si silencioJuez > 1.2 s y soy siguiente en mj.suc: reclamarJuez()
  si c.juez() y (g.done(S) o gt >= dur): terminarJuez()
  si no juez y gt > dur + 1.5 y sin 'end': mjack con mi última vista; mostrar "esperando al juez…"
  g.draw(vista, c)

terminarJuez():
  r = resultado(S)        // §11
  send('end', r)          // fiable
  POST mjfin {k, e, tick:k, sc, pl, cpu, h}
alRecibir('end') (no juez): mostrar r; POST mjack {k, e, h, tick, sc}
```

---

## 11. Resultado, puntuación y validación

### 11.1 Objeto resultado

```
{ k, juego, e, tick, modo:'ffa'|'2v2'|'1v3', clase:'rank'|'survival'|'binary',
  teams:[t por asiento], sc:[...], pl:[1..n], win:[asientos], cpu:[asientos], h: FNV(sc, pl, tick) }
```

| Tipo | Regla |
|---|---|
| `rank` | Puestos según puntos con `compara()` (`fiesta-vs.js:45-52`). Los empates comparten puesto. |
| `survival` | Puntos = tick de eliminación. Quien llega vivo al final recibe `dur·30+1`, así que los supervivientes empatan en 1.º. Las eliminaciones con menos de 100 ms de diferencia empatan y reparten la media de sus puestos. |
| 2v2 | Suma de puntos o `ganaEquipo(S)`. Los dos miembros del equipo comparten puesto. |
| 1v3 | `ganaSolo(S)`, o la regla de la media de `compara()`. Todo el lado ganador queda 1.º. El solo gana ≈45 % de las veces con una perilla por juego. |
| Monedas | Función pura compartida con `fiesta-reglas.js` (`MJ_RESULT`). Tablas del doc 04: FFA 10/6/3/1; 2v2 7/2 (4 en empate); 1v3 solo 12 o trío 4 cada uno; ×2 cada 5 rondas; +1 moneda por cada 5 objetos recogidos, con tope +3. **Solo el servidor escribe monedas.** |

### 11.2 Envío del veredicto

- `mjfin` se acepta solo si el emisor es `mj.juez` y `e===mj.e`. **Sustituye** al «el primer reporte de cada jugador gana» (`party.js:226`) para fiesta.
- Los demás humanos mandan `mjack {h, tick, sc}` como testigos.
- **Plazo:** `mj.cierre`. Si para entonces no hay `mjfin`, el servidor toma el testigo con mayor `tick`. Si tampoco hay testigos, la ronda queda en empate y nadie cobra.
- **Disputa:** si el hash del juez difiere del de ≥2 testigos, la ronda queda marcada `disputa` en el log y **el veredicto del juez se mantiene**: es una partida entre amigos. La marca queda disponible para endurecer esto más adelante.

Conflicto resuelto: un análisis quería que en el modelo A cada jugador reportara por su cuenta (`report{r,t,pts}`) y el juez solo cruzara datos. Se unifica: el juez **siempre** emite el veredicto, construido con los `ev out` y los `o` que recibió, y los autorreportes pasan a ser testigos. Así hay una sola ruta en el servidor.

### 11.3 Límites en el servidor (entrada de catálogo por juego)

`{dur, modelo, modos, scoreMax, scoreRate, minT, finTemprano, clase}` se replica en `pb_hooks/fiesta/catalogo.js`. Se rechaza o se recorta cuando:

- `sc.length ≠ n`, o algún puntaje queda fuera de `[0, scoreMax]`;
- algún puntaje supera `scoreRate × (serverNow - T_go)/1000`;
- el cierre llega antes de `T_go + minT` sin `finTemprano`;
- los puestos no son coherentes con los puntos según `clase`.

**El juez verifica en el cliente:**

- velocidad del dueño ≤ vmax·1,2;
- teletransporte >2·vmax·dt ⇒ se rechaza y se mantiene el último estado bueno;
- toques ≤16/s;
- reacción ≥120 ms en los juegos de reflejos (A).

**Contra un juez tramposo:**

- rotación del juez;
- hashes de testigos;
- `fairDelay`;
- y que toda instantánea es pública: una trampa se ve en todas las pantallas.

---

## 12. Presupuesto de ancho de banda

### 12.1 Tasa real del relevo HTTP

Con una petición en vuelo y `SIG_GAP` = 50 ms por carril:

```
req/s por carril = 1 / max(0.05, RTT_http)
RTT 100 ms → 10/s · RTT 150 ms → 6,7/s · RTT 200 ms → 5/s   ⇒ los 20/s nominales no se alcanzan en móvil
```

Con dos carriles (rápido y fiable) son como mucho ≈2× eso, y el carril fiable va casi vacío.

### 12.2 Minijuego C con 4 jugadores (peor caso: todo por relevo, RTT 150 ms)

| Flujo | Subida por cliente | Cálculo |
|---|---|---|
| No juez, `i` | ≈6,7 req/s × (50 B + sobre 40 B + HTTP ≈350 B) ≈ **3 KB/s** | el lote coalesce: 1 `i` + 1 `hb` |
| Juez, `s` + `i` + `o` CPU | ≈6,7 req/s × (≈400 B + 350 B) ≈ **5 KB/s** | `s` de 4 cuerpos ≈ 80 B + mundo ≈ 240 B |
| **Bajada SSE por cliente** | ≈(6,7 × 3 otros) mensajes/s × ≈150 B + `s` 6,7 × 450 B ≈ **6 KB/s** | SSE añade ≈40 B por evento |
| **Servidor, por sala** | entrada ≈4 × 6,7 ≈ **27 req/s** (+ fiable ≈2) → ≈30 req/s; salida 30 × 4 suscriptores = **120 eventos SSE/s** | cada `sig` es una lectura de caché (§8.4), sin BD |
| 50 salas a la vez | ≈1500 req/s y 6000 eventos SSE/s | **por verificar**: capacidad de PocketBase/Goja en la máquina de producción; el objetivo de la prueba de carga es p95 <50 ms en `sig` |

Con P2P completo, el servidor solo ve `hb` de presencia y señalización. La malla envía cada 20 ms, unas 50 tramas/s por par, de ≈100-450 B, es decir ≈20 KB/s de subida por par en el peor caso (juez con 3 pares ≈ 60 KB/s). Eso es aceptable en WiFi y 4G, y por eso P2P es el camino preferido. La malla se calienta durante la tarjeta.

### 12.3 Límites por IP

- `sig` 7200/60 s = 120 req/s por IP. Cuatro móviles en la misma WiFi (misma IP pública) a ≈15 req/s ⇒ 60 req/s, que cabe.
- **Riesgo:** 2 salas detrás del mismo NAT (un colegio, una oficina) ⇒ 120 req/s, al límite. Mitigación: subir la regla a 14 400/60 s solo para `sig`, ya que el relevo no escribe en BD (por verificar el coste).

### 12.4 Tablero

- Cada empuje SSE del registro pesa ≈12 KB y hay 4-6 por turno.
- Con 4 jugadores y 15 rondas son ≈60 turnos × 5 × 12 KB × 4 clientes ≈ **14 MB por partida** de bajada en total, ≈3,6 MB por cliente.
- Es aceptable, pero se deja una optimización para v2: empujar `{ver, fx}` en un tema `rooms/<id>/fx` y el registro completo solo cada N versiones.

---

## 13. Validación en el relevo (resumen)

| Comprobación | Dónde |
|---|---|
| Autenticación de `id`+`key`; `from` puesto por el servidor | `relay()` (ya existe) |
| Alcance `b`/`m:<k>` válido para la fase | `sigPayload` rama fiesta |
| Lista de tipos permitidos por alcance; tipos solo del juez con `e` vigente | `sigPayload` |
| ≤512 B por lote, ≤10 mensajes, `t` ≤12 caracteres | ya existe |
| ≤25 msg/s por emisor, `aim` ≤5 Hz, `react` con `reactLimit` | `limitRoom` |
| Los espectadores no envían | `auth` falla sin clave |

---

## 14. Arnés de pruebas

### 14.1 Relevo en memoria (`test/helpers/mem-relay.js`)

```js
const net = memRelay({
  clock,                              // reloj virtual: avanza con tick(ms); todos los timers lo usan
  peers: 4,
  http: { rtt: [80, 300], jitter: 40, loss: .02, oneInFlight: true, gap: 50, maxBytes: 512, maxMsgs: 10 },
  p2p:  { pairs: { 'a-b': 'open', 'a-c': 'fail', ... }, f: { delay: 30, jitter: 15, loss: .05, reorder: .1 },
          r: { delay: 35, ordered: true } },
  sse:  { delay: [20, 120], dup: .01 },
  server: realSigPayload,             // P.sigPayload / P.auth reales de pb_hooks/party.js
  events: [ { at: 12000, kill: 'judge' }, { at: 15000, drop: 'c', for: 4000 }, { at: 20000, join: 'e→seat d' } ]
});
```

- Modela las dos rutas: relevo HTTP (una petición en vuelo, lotes, límites reales que **rechazan** igual que el servidor) y P2P por par (`f` con pérdida y reordenamiento, `r` fiable).
- El servidor de juguete reutiliza las funciones puras reales de `pb_hooks/party.js` y el reductor real.
- Se extiende el `Peer` falso de `test/party-network.test.js:10-18`.

### 14.2 Suites

| Suite | Qué afirma |
|---|---|
| `test/fiesta-net.test.js` | Coalescencia latest-wins por tipo; dedupe con P2P y relevo solapados; mezcla por par; los mensajes llegados antes de `onMsg` se entregan al registrarse; detección de ausencia a los 2 s; convergencia del desfase de reloj a ±20 ms con 150 ms de jitter; rejoin con la misma clave tras `leave`; toma de asiento. |
| `test/fiesta-live.test.js` (patrón de `squad.test.js:23-37`) | Para cada juego del corte y n ∈ {2,3,4}, con bots humanos más CPU y RTT de 50/150/300 ms y 5 % de pérdida: **(1)** `end.h` idéntico en todas las pantallas; **(2)** resultados dentro de los límites del catálogo; **(3)** todos los lotes ≤512 B y ≤10 mensajes, y req/s dentro del presupuesto de §12; **(4)** matar al juez en un k aleatorio (40 %) sigue dando un único veredicto; **(5)** que un humano se caiga lo convierte en CPU y al volver se le devuelve el asiento; **(6)** que un CPU pase a humano al 50 % no rompe el veredicto; **(7)** ventaja del juez: con 200 semillas y bots de igual habilidad, su tasa de victoria es ≤ 1/n + 8 pp; **(8)** los humanos inactivos nunca ganan a CPU activas; **(9)** los puestos de 2v2 y 1v3 son coherentes con `compara()`; **(10)** ningún juego usa tipos reservados. |
| `test/fiesta-director.test.js` | `proyectar(D, fx) deepEquals S` para toda acción; `hash(D)===hash(S)` con la cola vacía, incluso tras dormir 45 s, recargar o tener el anillo desbordado; `board` no contiene `rng` ni `semilla`. |
| `test/fiesta-sim.test.js` | 4 directores sin cabeza sobre un broker con pérdida de 50-400 ms, 15 % de pérdida, reordenamiento y duplicados. Escenarios: siesta del móvil, recarga, quinto cliente que toma un CPU, todos AFK (la partida debe terminar con CPU). Afirma un `hash(D)` igual en todos y desfase de inicio del minijuego <250 ms. |
| `pocketbase/pb_hooks/party.test.js` (ampliado) | `sig` de fiesta en los alcances `b` y `m`; tipos de juez rechazados si los envía otro; `juez` CAS (dos candidatos simultáneos ⇒ solo uno gana); `mjfin` solo del juez; reserva por testigos; límites del catálogo; `act` 409, `aid` idempotente, 403 por turno ajeno; `start` con 2 humanos rellena con CPU; redirección de invitaciones. |
| e2e Playwright (junto a `test/worlds.e2e.js`) | 2 contextos (uno móvil) más un tercero que entra después: orden, 3 turnos, 1 minijuego en vivo; `window.FIESTA.hash()` igual en todos; el tercero toma un CPU; recarga de B a mitad de minijuego. |
| Conformidad | Los bots de DUO/SQUAD sobre `N.channel()` pasan las mismas afirmaciones que en `duo.test.js`/`squad.test.js`. |
| Carga | 50 salas × 4 bots (`act`, `tick`, `sig`) durante 10 min: p95 de escritura SQLite <50 ms y `sig` p95 <50 ms. |

`duo.test.js` y `squad.test.js` deben seguir en verde: no se toca su código.

---

## 15. Modos de fallo

| Fallo | Síntoma | Detección | Respuesta |
|---|---|---|---|
| Un par sin P2P (NAT simétrico, sin TURN) | Más latencia solo con ese par | `linkReady` falso | Envío por par: ese tráfico va por relevo (§8.2) |
| Todo por relevo en 4G lenta (RTT >300 ms) | Rivales a ≈400 ms; C se siente pesado | `N.label()`; RTT medio | D sube a 250 ms; la bolsa de juegos **excluye C** si la mediana de RTT de la sala supera 250 ms (filtro en el servidor) |
| El juez se va o se cuelga | Instantáneas congeladas | 1,2 s de silencio | CAS `juez`, `restore` o fin temprano (§6.3) |
| Partición: dos jueces | Veredictos distintos | `e` en el registro | Gana el `e` mayor; el viejo se degrada solo; `mjfin` con `e` viejo ⇒ 409 |
| Nadie envía `mjfin` | El minijuego no cierra | `mj.cierre` | Testigo con mayor `tick`, si no hay, empate (§11.2) |
| Humano cae a mitad de minijuego | Cuerpo quieto | 2 s sin `i`/`o`/`hb` | El juez lo pasa a CPU; al volver, `ev hum` |
| Pestaña en segundo plano (iOS) | SSE muerto; sin `hb` | `visibilitychange` | Reconexión §7.4; en el tablero, AFK por presencia a los 20 s |
| Salto del reloj local | Amenazas fuera de tiempo | salto >1 s entre muestras | Invalidar las muestras y lanzar una ráfaga de reloj |
| Desfase de reloj grande (RTT mínimo alto) | Inicio desfasado | `rtt_min/2 > 80 ms` | Aviso «conexión inestable»; el juego sigue; en A la equidad se resiente (aceptado) |
| Anillo de efectos desbordado | Huecos en la cinemática | `pend[0].v > shownV+1` | Salto con la tarjeta «Mientras no estabas…» |
| 409 por `ver` | Acción rechazada | Respuesta | El cliente aplica el `room` del cuerpo y vuelve a mostrar el prompt si sigue siendo suyo |
| Reintento duplicado de `act` | Doble aplicación | `aid` | Idempotente |
| Todos los humanos AFK o en segundo plano | Nadie llama a `tick` | — | La partida se pausa (aceptado); al volver, `tick` aplica lo vencido |
| Lote >512 B | 400 del relevo | Prueba (3) de §14 | Partir en `s`/`s2`; el lint del catálogo mide `pack()` |
| Juez tramposo | Puntajes raros | Testigos `h` | Marca `disputa`; el veredicto se mantiene en v1 |
| Desync del director | Tablero distinto | `hash(D)≠hash(S)` | Salto a S y `log fiesta_desync` |
| Dos salas detrás del mismo NAT | 429 en `sig` | Contador por IP | Subir la regla de `sig` (§12.3) |
| `require` relativo en Goja | El hook no carga el reductor | Arranque de PB | Resolver la ruta con `__hooks` (por verificar: `fiesta-reglas.js:5-6` usa `require('./fiesta-rng.js')`) |
| Juegos cargados dos veces en producción | Redeclaraciones o dobles `BUS.add` | Consola | Lista estática de scripts en `fiesta.html` (C10) |

---

## 16. Orden de implementación (equivalencias con los hitos de 07 en 07 §10)

| Paso | Entrega | Criterio de hecho |
|---|---|---|
| N0 | `fiesta-net.js` (transporte, reloj, envío por par, canales) + `mem-relay` + `fiesta-net.test.js` | Pruebas verdes; conformidad DUO/SQUAD sobre `channel()` |
| N1 | Rama fiesta en `sigPayload`, `now`/`time`, caché del relevo, `juez`/`mjfin`/`mjack`, catálogo con límites | `party.test.js` ampliado en verde |
| N2 | `fiesta-live.js` (A/B/C, juez, migración, `track2`) + `f_mecate` y `f_harina` | `fiesta-live.test.js` en 2-4 asientos a 50/150/300 ms |
| N3 | Director y `act` versionado (C3-C8 de §2), lobby con selección de personaje, reanudación | `fiesta-sim.test.js` + e2e con 2 contextos |
| N4 | Resto del corte: `f_domino`, `f_chancla`, `f_futbolito` (C+P), `f_patilla` (1v3) | Prueba de ventaja del juez ≤ 1/n + 8 pp; revisión del usuario jugando |
| N5 | Prueba de carga y ajuste de reglas de tasa | p95 <50 ms con 50 salas |

---

## 17. Preguntas abiertas

1. **TURN.** Sin servidor TURN, las redes estrictas caen al relevo. ¿Vale la pena contratar uno (≈coturn propio) para mejorar el modelo C? La recomendación es medir primero con el e2e en 4G real.
2. **Filtro de juegos C por latencia** (§15): se propone filtrar de forma automática y en silencio. Otra opción es avisar «tu sala está lenta: hoy no hay futbolito».
3. **`disputa`**: en v1 solo se registra. ¿Endurecer después, por ejemplo rotando al juez a mitad del juego?
