# 14 · Isla de Margarita en línea: reductor puro sobre las salas de LA FIESTA

Estado: **borrador para aprobar**. No hay código todavía. Cuando lo apruebes (con tus respuestas a §12) empiezo por el hito M0 de §10.

**Objetivo.** Jugar Margarita con panas, cada quien en su teléfono, con el mismo tablero, las mismas reglas y la misma
cinemática que hoy. Los asientos vacíos los juega la CPU; si alguien se cae, la CPU lo cubre hasta que vuelva.
El modo local (tú contra 3 CPU) sigue existiendo y usa **las mismas reglas**: una sola implementación, no dos.

**Lo que no se toca.** Las reglas del tablero de Margarita (doc 12), los minijuegos y su netcode (docs 08, 09, M2, M3),
el reductor de LA FIESTA (`fiesta-reglas.js`) y su tablero de Venezuela. Margarita se monta **al lado**, sobre la misma sala.

---

## 0. Resumen en 10 líneas

1. **Reglas puras nuevas:** `docs/margarita/margarita-reglas.js`, con la misma API que `fiesta-reglas.js`: `crear`, `aplicar`, `tick`, `vista`, `proyectar`, `hash`.
2. **El servidor es el que manda.** El hook de PocketBase corre ese reductor. El RNG va oculto en `keys._f` y ningún cliente tira dados.
3. **Misma sala que LA FIESTA:** `rooms.mode = 'fiesta'` con `board.tab = 'margarita'`. Códigos, lobby, invitados, SSE, `act`, `tick`, juez, relé, toma de asiento, AFK y reconexión se reutilizan sin cambios de protocolo.
4. **El servidor despacha por tablero:** `reglas(room)` devuelve el reductor de Venezuela o el de Margarita según `board.tab`. Es el único cambio de fondo en los hooks.
5. **`margarita.js` pasa a ser director:** ya no decide nada. Reproduce los efectos (`fx`) que llegan con las animaciones de hoy: dado, saltos, peñero, Fiscal, noticias, monedas, podio.
6. **El modo local corre el mismo reductor en el navegador** con un `tick` local. Así el modo de un jugador también valida las reglas que se juegan en línea.
7. **Minijuego de ronda:** el reductor llena `board.mj` con el mismo contrato que LA FIESTA. Los 4 juegan en vivo con `FIESTA.LIVE` y el juez firma el resultado, como hoy en Venezuela.
8. **¡BRONCA!** usa el formato `1v1` en vivo que ya existe (LA FIESTA tiene el duelo en `formarMJ(Z, duelo)`).
9. **Toda decisión es del jugador del turno** (peaje, desvío, compra, Pícaro, cañón...). Si vence el plazo, decide la política de la CPU y se cuenta un aviso de AFK. No hay decisiones que interrumpan el turno de otro.
10. **Las casillas M** (microjuego de campaña, de un solo jugador) son lo único sin equivalente en vivo. Ver la pregunta P3.

---

## 1. Lo que ya existe (verificado en el código)

| Pieza | Dónde | Qué sirve para Margarita |
|---|---|---|
| Reductor puro con RNG oculto | `docs/style-lab/fiesta-reglas.js` (`crear/aplicar/tick/vista/proyectar/hash`, UMD, Goja-safe) | Es el **molde**: misma firma, mismo contrato de `fx`, mismo anillo `S.fx` |
| Capa de sala | `pocketbase/pb_hooks/party.js:573-822` (`fiestaNew`, `fiestaStep`, `fiestaSave`, `fiestaTick`, `fiestaJoin`, `fiestaStart`, `fiesta()`) | Casi todo vale tal cual. Hoy llama a `reglas()` fijo (`party.js:583`) |
| Rutas | `pb_hooks/party_routes.js` (`create/join/pick/cfg/ready/start/act/tick/juez/mjfin/mjack/back/leave/sig`) | Sin cambios de forma |
| Relé, juez, validación de minijuegos | `pb_hooks/party_mj.js` (`fiestaSig`, `elegirJuez`, `LIM_DEFECTO`, `clampSc`) | Lee solo `board.mj.*` (`k, i, as, tipo, eq, solo, juez, suc, e, startAt, cierre, cartaHasta, cola, clase, rel`) y el `CATALOGO`. Si Margarita llena `board.mj` igual, todo esto funciona sin tocarlo |
| Transporte del cliente | `docs/style-lab/fiesta-net.js` (SSE + sondeo por `ver`, `act`, `tick`, sesión en localStorage, reentrada) | Se carga tal cual en la página de Margarita |
| Minijuegos en vivo | `fiesta-live.js` + `fiesta-juego-*.js` (los de Margarita: 14 ffa, 4 2v2, 5 1v3) | Ya los usa Margarita local en iframe (`margarita.js:887`, `?practica=…&embed=1`) |
| CPU de tablero | `fiesta-cpu.js` (`decide(S, v, asiento, rng)`) | Molde para `margarita-cpu.js` |
| Ruta del código | `GET /api/party/kind/{code}` (`claudeware.pb.js:50`) | Se amplía para decir qué tablero es (§7.3) |

**Lo que hoy impide jugarlo en línea** (`docs/margarita/margarita.js`, 1142 líneas):

- **Reglas, animación y espera van mezcladas** en funciones `async` (`turnoJugador`, `mover`, `caer`, `pagarPeaje`, `noticias`...). El estado vive en globales mutables (`JUG`, `S`, `E`, `VIS`). No hay una foto que se pueda mandar ni repetir.
- **El azar es `Math.random`** (`pixel.js:9`, `const R = Math.random`), con 62 llamadas a `R()`, `ri()` y `pick()` entre reglas y cosmética.
- **Las decisiones son `await preguntar(...)`** con botones del DOM. Hay unos 20 puntos de decisión humana (§4.2).
- **El grafo del tablero** (`nodos, J, PEAJES, PUESTOS, ISLAS, COCHE, NPCS`) sale de `mapa.js`, que también dibuja el terreno. El servidor necesita solo el grafo.

---

## 2. Decisiones (con lo que recomiendo)

| # | Decisión | Recomiendo | Alternativa descartada y por qué |
|---|---|---|---|
| D1 | ¿Quién tiene la verdad? | **El servidor**, con el reductor puro (como LA FIESTA) | *Anfitrión autoritativo* (un teléfono corre `margarita.js` y los demás mandan botones): más rápido de hacer, pero si el anfitrión se cae se pierde la partida, el anfitrión puede hacer trampa y no encaja con la arquitectura de doc 07 |
| D2 | ¿Sala nueva o la de LA FIESTA? | **La misma** (`mode:'fiesta'`, `board.tab:'margarita'`) | *Modo nuevo `margarita`*: duplicaría `fiestaSig`, el juez, la caché del relé, la toma de asiento y la limpieza. Todo eso ya tiene pruebas en `fiesta` |
| D3 | ¿Cómo comparte el minijuego? | **El reductor de Margarita llena `board.mj` con el mismo contrato** y reutiliza las funciones puras que `fiesta-reglas.js` ya exporta (`compara`, `equipos`, `eqIdx`, `pagosMJ`, `puestos`, `normSurvival`, `hashRes`, `CATALOGO`) | *Sacar la submáquina del minijuego a un módulo compartido* (`fiesta-mj.js`): más limpio, pero obliga a reescribir parte de `fiesta-reglas.js`, que es trabajo tuyo sin commit. Lo propongo como paso posterior (P5) |
| D4 | ¿Modo local? | **El mismo reductor corriendo en el navegador** (`margarita-local.js`: `tick` cada 100 ms, CPU con `margarita-cpu.js`) | *Dejar `margarita.js` local como está y hacer otra versión en línea*: dos reglas que se separan con el tiempo |
| D5 | ¿Dialecto del reductor? | **ES5 de `fiesta-*.js`** (sin `?.`, `??`, spread, async ni clases). Tiene que correr en Goja | El ES2020 de `margarita.js` no corre en el hook |
| D6 | ¿Plazos? | Los de `fiesta-reglas.js` (`PLAZO`): dado 20 s (30 s en la ronda 1), ruta 12 s, tienda 15 s. Al vencer, **decide la CPU** con el RNG oculto y se suma un aviso de AFK; con 2 avisos seguidos el asiento pasa a `cpu:'afk'` | *Acción "segura" fija al vencer* (no cruzar, no comprar): castiga de más al que se le cayó la señal |
| D7 | ¿Personajes? | Los 8 de `PERSONAJES` de LA FIESTA, elegidos en el lobby. En local siguen TÚ, MAMÁ, ABUELA y PANA | Fijar los 4 de hoy: en línea todos querrían ser TÚ |

---

## 3. Modelo de estado

### 3.1 `board` público (`S`)

Mismo registro `rooms`. `board` lleva todo lo que hoy está en `JUG`, `S` y `E`, sin RNG. Tamaño estimado: menos de 6 KB (el tope de doc 07 §3.1 es 32 KB).

```js
{
  tab: 'margarita', f: 'lobby'|'turno'|'carta'|'mj'|'res'|'final'|'fin', ver: 118,
  r: 3, tot: 10, cfg: { tot: 10|15|20, cpuNivel: 1|2|3 },
  orden: ['a','b','c','d'],                                 // MP1: orden fijo de asiento (hoy JUG en orden)
  t:   { s: 'b', paso: 'pre'|'dado'|'mover'|'decide'|'casilla', resto: 4, dados: [3,7], hasta },
  esp: { id: 118, s: 'b', k: 'DADO'|'CRUCE'|'PEAJE'|'DESVIO'|'FERRY'|'EMPANADA'|'BODEGA'|'PICARO'|'VICTIMA'
                          |'BRONCA'|'CALABOZO'|'MATASIETE'|'RIFA'|'CANON'|'TRUCADO'|'OK', opc: [...], hasta } | null,
  pj: { a: { ch:'tu', name, en: 'por_01', bs: 10, emp: 0, items: ['cafe'], color: 'azul', pierde: false,
             pimpinas: 0, bono: { mj: 0, max: 10, ev: 0 }, cpu: null|'auto'|'afk', afk: 0, on: true }, ... },
  isla: { puesto: 53 /* nodo del puesto de la Empanadera: uno de G.PUESTOS_EMP */, senora: 'O' /* isla de ese puesto (derivada) */, bacha: 'W' /* isla opuesta: el Bachaquero cobra en el puesto fijo de esa isla */, peajes: { restinga: 3, lancha: 1 }, san: 14, bolsas: [{ en, bs }],
          hora: 'dia'|'tarde'|'noche', lluvia: 0, leva: 0, turistas: 0, apagon: false, obras: { O: false, W: false },
          carnaval: false, final: false, sinAgua: null, kraken: 0, sirena: null, oferta: 0, silbon: null },
  mj: { ...el mismo objeto que LA FIESTA, doc 07 §3.2 y M2-SPEC §3.2... } | null,
  nextAt, fx: [ { v, s, fx: [...] }, ... ], log: [ ... ]
}
```

### 3.2 `keys._f` privado

`{ rng, semilla, aid: {a,b,c,d}, cpuAt }`, igual que LA FIESTA. Margarita no tiene información oculta aparte del azar: los objetos, los reales y las empanadas son públicos, como en MP1.

### 3.3 La parte cosmética se queda en el cliente

Las cabras, los NPC que dicen cosas, el agua, las nubes y el giro del dado mientras rueda no son reglas. Siguen con `Math.random` local, porque no cambian el resultado. Las criaturas de las noticias (Kraken, sirena, Silbón, barco pirata) **sí** son estado: su posición y su víctima van en `fx`.

---

## 4. Acciones y efectos

### 4.1 Contrato

`aplicar(S, priv, asiento, a, ahora) → { S, priv, fx, error, dup? }`, con `a = { t, eid, aid, ...}`. Las reglas son las de doc 07 §4.1: `eid` viejo da 409 con la sala, `aid` repetido se acepta sin volver a aplicarse y el turno ajeno da 403.

`tick(S, priv, ahora)` atiende **un** vencimiento: el turno de la CPU, un plazo vencido, la tarjeta del minijuego, el cierre, el resultado o el final.

### 4.2 Las decisiones de hoy, una por una

| Hoy (`margarita.js`) | Aviso `esp.k` | Acción | Validación en el reductor | Si vence el plazo |
|---|---|---|---|---|
| Tirar o usar objeto (`:331`) | `DADO` | `TIRAR` / `USAR {item}` | El objeto está en `items` y no es `palanca` | CPU |
| Dado trucado (`:340`) | `TRUCADO` | `PASOS {n}` | 1 ≤ n ≤ 6 | CPU (`distVenta`) |
| Llegar a un cruce (`:198`) | `CRUCE` | `CRUZAR {si}` | Le alcanza el peaje mínimo; la lancha está abierta (de noche, con mar de leva o con Kraken no sale) | CPU |
| Palanca en el peaje (`:242`) | `PEAJE` | `PALANCA` | Tiene `palanca` | CPU |
| «¿Cuánto es la colaboración?» (`:252`) | `PEAJE` | `PAGAR {bs}` / `NO` | `fee ≤ bs ≤ min(50, reales)`. Lo pagado pasa a ser el nuevo peaje (de noche, en La Restinga, la mitad) | CPU (paga el mínimo; a veces un poco más, como hoy) |
| Ferry a Coche (`:213`) | `FERRY` | `FERRY {si}` | Le alcanza | CPU |
| Desvío costa / atajo (`:233`) | `DESVIO` | `RUTA {a}` | `a` es una salida válida y el atajo no está cerrado por obras | CPU |
| Empanada de Oro (`:266`) | `EMPANADA` | `COMPRAR {si}` | reales ≥ 20 | CPU (compra si puede) |
| Bodega del Portu (`:390`) | `BODEGA` | `COMPRAR {item\|null}` | Hay espacio en el bolsillo y le alcanza | CPU |
| El Pícaro (`:420`, `:423`) | `PICARO`, luego `VICTIMA` | `NEGOCIO {op\|null}`, `VICTIMA {s}` | La víctima tiene lo que se le quiere sacar | CPU |
| ¡BRONCA! (`:439`) | `BRONCA` | `RETAR {s}` | `s` es otro jugador | CPU |
| Calabozo (`:474`) | `CALABOZO` | `FIANZA {si}` | reales ≥ 10 | CPU |
| Cerro Matasiete (`:484`) | `MATASIETE` | `PIEDRA {s\|null}` | `s` no está en un cruce | CPU |
| Rifa del Sambil (`:499`) | `RIFA` | `RIFA {si}` | Le alcanza | CPU |
| Cañón de Pampatar (`:513`) | `CANON` | `CANON {si}` | — | CPU |
| Tarjetas de solo leer: carnaval, recta final, noticias, «¡A JUGAR!», final (`:614`, `:693`, `:695`, `:878`, `:916`) | ninguno | — | **No esperan a nadie.** Son `fx` con duración (`FX_MS`), y el servidor suma `fxMs(lote)` al siguiente plazo. En local se pueden adelantar con un toque, como hoy | — |

Nadie decide durante el turno de otro: el que retan en una BRONCA no acepta ni rechaza (como en MP1), y la víctima del Pícaro tampoco elige. Eso evita el problema más difícil del doc 07 (decisiones simultáneas con compromiso), salvo en los minijuegos.

### 4.3 Efectos (`fx`)

Son los de doc 07 §3.4 donde ya existen (`dado`, `hop`, `mon`, `turno`, `evento`, `mjIni`, `mjRes`, `llega`, `afk`, `vuelve`, `set`) más los propios de Margarita:

```js
{k:'emp', s, d:+1, tot, por:'senora'|'tesoro'|'rifa'|'picaro'|'bonus'}   {k:'item', s, items:[...], item, que:'compra'|'suerte'|'perlero'|'mono'|'usa'}
{k:'peaje', id:'restinga', s, pago, fee}       {k:'cruza', s, por:'restinga'|'lancha'|'ferry'|'canon'|'mototaxi', de, a}
{k:'penero', de:'O', a:'W', desde:53, puesto:96, lugar}   // casilla E: el peñero lleva a la señora a un puesto de la OTRA isla (de/a = islas; desde/puesto = nodos)
{k:'mudanza', s, de:53, a:96, isla:'W', lugar:'CERRO MACANAO', por:'compra'}   // al COMPRARLE una empanada se muda a otro puesto (nodo `a`); s = el comprador. Aplica: isla.puesto=a, isla.senora=isla, isla.bacha=opuesta
{k:'isla', campo:'lluvia', v:2}       // cambios de E (hora, lluvia, obras...)
{k:'vaina', id:'aguacero'}                     {k:'noticia', id:'kraken', p:{...}}    // p = lo que necesita la animación (víctima, isla, punto)
{k:'san', s, d, pote}                          {k:'bolsa', en, bs}                    {k:'colearse', s, con}
{k:'equipos', tipo:'2v2', lados:[...]}         {k:'podio', puestos, premio}           {k:'bonusFin', id:'mj', ganan:[...], top}
```

Cada efecto llega **ya resuelto**: el cliente no tira nada. La animación de hoy de cada función `async` se convierte en una función `jugar(fx)` del director, con el mismo `decir()`, `tween()` y los mismos sonidos.

**Prueba obligatoria**, como en LA FIESTA: después de reproducir la cola, `hash(D) == hash(S)`.

---

## 5. Minijuegos

### 5.1 De ronda (los 4)

- **Formato:** igual que hoy (`formato()`, `margarita.js:762`), por el color de la última casilla: 2+2 es `2v2`, 1+3 es `1v3`, los 4 iguales o carnaval es `ffa`.
- **Juego:** el reductor sortea entre los del `CATALOGO` con `live:1` y ese formato, como `elegir()` de LA FIESTA. Lo hace con el RNG oculto, así que la ruleta ya no sale de la lista `MJ` de `margarita.js`.
- **El juego en sí:**
  - El reductor arma `board.mj` (`k, i, tipo, as, eq, solo, cola:[{g, seed, dur, lv, modelo}], juez, suc, e`).
  - De ahí en adelante, todo pasa como en Venezuela: la tarjeta, LISTO, la cuenta atrás y el juego en vivo. El juez manda `mjfin`, el servidor recorta los puntajes (`clampSc` con `LIM_DEFECTO` y `lim` del catálogo) y aplica `MJ_RESULTADO`.
  - Con eso el reductor paga +10 Bs (+15 en carnaval) a los ganadores y suma `bono.mj`.
- **Nivel:** `lv` sale de la ronda (1/3, 2/3, final), como `nivel()` de LA FIESTA.
- **Cómo se ve:** la página de Margarita abre el minijuego en un iframe (§7.2). El tablero queda debajo y el director sigue su curso.

### 5.2 ¡BRONCA! (duelo 1v1 con apuesta)

- El reductor abre `board.mj` con `tipo:'1v1'`, `as:[retador, retado]`, y elige entre los juegos con `'1v1'` en `m`.
- La apuesta (`ap`) se fija al retar, con la misma regla de hoy, y queda en `mj.apuesta`.
- Los otros dos miran como espectadores, con la vista que ya tiene LA FIESTA para mirones (`watch`).

### 5.3 Casillas M (microjuego de campaña, de un solo jugador)

Hoy abre `jugar.html?juego=…` en un iframe y el resultado lo cuenta el propio jugador. En línea nadie más puede verificarlo. Ver P3.

---

## 6. CPU

`docs/margarita/margarita-cpu.js`: `decide(S, v, asiento, rng) → acción`. Reúne las reglas que hoy están repartidas en las ramas `j.cpu ? … : …`:

- **Cruces:** cruza si quiere y le alcanza, o si tiene el peaje más 25 Bs (con 25 % de azar).
- **Peaje:** paga de más el 30 % de las veces.
- **Empanada:** compra si le alcanza.
- **Desvío:** toma la costa si la señora está ahí (o con 30 % de azar).
- **Cañón:** se monta el 10 % o el 30 % de las veces, según la isla de la señora.
- **Dado trucado:** saca la distancia a la venta.

`cpuNivel` 1 a 3 escala el error, como `ERR` en `fiesta-cpu.js`. En el servidor usa el RNG oculto, así que una partida con la misma semilla y las mismas jugadas es idéntica.

---

## 7. Servidor y páginas

### 7.1 Hooks (`pocketbase/pb_hooks/`)

| Archivo | Cambio |
|---|---|
| `party.js` | `reglas()` pasa a ser `reglas(room)`: si `room.board.tab === 'margarita'` carga `margarita-reglas.js`; si no, `fiesta-reglas.js`. Lo mismo para `FIESTA_ACT` y `FIESTA_CFG`, que salen del reductor (`R.ACCIONES`, `R.CFG_VALIDA`). `fiestaNew(code, now, cfg)` acepta `cfg.tab` |
| `party_routes.js` | `create` acepta `{mode:'fiesta', tab:'margarita'}`. `/r/CODE` redirige a `/docs/margarita/?r=CODE` si `board.tab === 'margarita'` (hoy Margarita no está publicada, `shipped:false` en `js/worlds.js:31`; cuando se publique, la ruta sigue a donde viva) |
| `party_mj.js` | Nada, si D3 se cumple. Solo `reglas` llega con la sala |
| `claudeware.pb.js` | `GET /api/party/kind/{code}` devuelve también `tab`, para que el JOIN del menú mande el código a su página |
| `scripts/sync-fiesta-rules.sh` | Copia también `margarita-reglas.js`, `margarita-cpu.js` y `margarita-grafo.js` |

### 7.2 Páginas

- **`docs/margarita/margarita-grafo.js` (nuevo, puro):** los nodos, las aristas, los cruces, los puestos y los NPC con posición. Se saca de `mapa.js`, que se queda con el dibujo y lo importa.
- **`docs/margarita/margarita.js`:** queda como director más HUD. Las funciones `async` de reglas se vuelven `jugar(fx)`, y el `preguntar()` de un aviso manda `act` (en línea) o llama a `aplicar` (en local).
- **`docs/margarita/margarita-local.js` (nuevo):** el "servidor" del modo local, con `crear`, `aplicar`, `tick` y la CPU en el navegador.
- **`docs/margarita/shell.js`:** JUGAR → **SOLO** (lo de hoy) o **CON PANAS** (crear sala o unirse con código). El lobby es el kit de menús, el mismo paso 8 pendiente del doc de menús para LA FIESTA. Se hace una sola vez para los dos tableros.
- **El minijuego en línea:** un iframe de `fiesta.html?r=CODE&mj=1`, que solo muestra la tarjeta, el juego y el podio, con la sesión de la sala que ya está en localStorage (mismo origen). Mientras tanto, la página de Margarita pausa su SSE para no tener dos conexiones. Alternativa: cargar `fiesta-live.js` y los juegos en la página de Margarita (P4).

---

## 8. Plazos, AFK, toma de asiento y reconexión

Todo como doc 07 §7.3 y §8, sin cambios:

- Al vencer un plazo decide la CPU y se suma un aviso; con 2 avisos seguidos el asiento pasa a `cpu:'afk'`.
- `back` devuelve el control en el próximo límite.
- Un asiento `afk` de más de 180 s se puede tomar desde `join`, y el que entra hereda reales, empanadas, objetos y personaje.
- La sesión en localStorage (`minicaos-fiesta-v1`) permite volver a entrar.

En Margarita los turnos son más largos que en Venezuela, por la cantidad de tarjetas y animaciones. El plazo cuenta **desde que termina la cinemática** (`fxMs(lote)` sumado), así que la animación no le come tiempo al jugador.

---

## 9. Pruebas

| Prueba | Qué comprueba |
|---|---|
| `test/margarita-reglas.test.js` | Determinismo (misma semilla y mismas jugadas dan el mismo `hash`); cada aviso de §4.2 acepta lo válido y rechaza lo inválido con el error correcto; `eid` y `aid`; peaje (lo pagado pasa a ser el nuevo peaje, la mitad de noche en La Restinga, tope 50); el peñero cambia la señora y el Bachaquero; la lancha cerrada de noche, con mar de leva o con Kraken; carnaval y recta final (doble); la tía de Miami al último; las empanadas extra del final; `proyectar(D, fx)` igual a `S`; `board` sin RNG |
| `test/margarita-sim.test.js` | 300 partidas de 4 CPU en el reductor, sin errores ni bloqueos. Las cifras (empanadas por partida, Bs, cruces, minijuegos, duración) caen en la misma franja que el juego de hoy con `?cpu=1&sinmj=1`. Se mide el de hoy primero y se guarda como referencia |
| `pocketbase/pb_hooks/party.test.js` (ampliar) | `create` con `tab:'margarita'`; `act`, `tick`, AFK y toma de asiento en Margarita; `reglas(room)` elige bien; Venezuela sigue igual |
| `test/margarita-live.test.js` | 4 clientes sobre `mem-relay`: partida completa de 3 turnos con un minijuego de ronda y una BRONCA; un cliente se cae y vuelve; el resultado es el mismo en las 4 pantallas |
| `test/menus.e2e.js` (ampliar) | SOLO sigue como hoy; CON PANAS crea sala y el código del JOIN lleva a Margarita |

---

## 10. Hitos

| Hito | Qué | Se acepta cuando |
|---|---|---|
| **M0** | `margarita-grafo.js` + `margarita-reglas.js` + `margarita-cpu.js`, sin página | `margarita-reglas.test.js` y `margarita-sim.test.js` pasan |
| **M1** | Modo local sobre el reductor: `margarita.js` como director más `margarita-local.js` | SOLO se juega igual que hoy (mismas tarjetas, misma cinemática) y `menus.e2e.js` pasa. Es el hito más largo: cada función `async` de hoy se parte en regla (M0) y animación (M1) |
| **M2** | Servidor: `reglas(room)`, `create` con `tab`, `/r/CODE`, `kind` | `party.test.js` pasa con los dos tableros |
| **M3** | En línea: lobby del kit de menús, `fiesta-net` en la página, avisos por `act`, iframe del minijuego, BRONCA 1v1 | `margarita-live.test.js` pasa y se juega una partida real con 2 teléfonos en localhost |
| **M4** | Pulido: espectadores, toma de asiento a mitad de partida, invitación con imagen, emotes | Lo que pidas después de jugar M3 |

**Dependencia:** M2 y M3 tocan `party.js` y `party_routes.js` (tus cambios sin commit) y usan `party_mj.js` y `fiesta-net.js` (archivos sin seguimiento). M0 y M1 viven solo en `docs/margarita/` y se pueden subir antes, aparte de LA FIESTA.

### 10.1 Estado (27 de octubre de 2026) y cómo probarlo

M0 a M3 están hechos (sin commit). `margarita-live.test.js` pasa. Falta la otra mitad de la aceptación de M3: la partida con 2 teléfonos sobre un PocketBase real.

- **Pruebas:** `node pocketbase/pb_hooks/party.test.js` y `node --test test/margarita-*.test.js`.
- **Sin PocketBase:** `node test/helpers/dev-fiesta-server.js 8874` corre el `party.js` real detrás del mismo protocolo (también es la configuración `margarita-online` de `.claude/launch.json`). En `http://localhost:8874/dev/dos` juegan dos jugadores lado a lado, cada uno en su origen (`localhost` y `127.0.0.1`).
- **Con PocketBase y teléfonos:**
  1. Pon el binario en `pocketbase/pocketbase` y corre `scripts/margarita-online-dev.sh` (o la configuración `pb-margarita`). Imprime la dirección para los teléfonos. Los datos van en `pocketbase/pb_dev/`, ignorado por git, y `pb_data` no se toca.
  2. Si macOS pregunta si `pocketbase` puede recibir conexiones, acéptalo.
  3. Teléfono 1: `http://<IP>:8090/docs/margarita/` → CON PANAS → CREAR SALA → INVITAR.
  4. Teléfono 2: el enlace, o el código en la caja.
  5. Escojan personaje, ESTOY LISTO en el teléfono 2 y ¡EMPEZAR! en el anfitrión.
- **Pendiente para M4:** espectadores sin asiento; al saltar (llegar tarde o recargar) no vuelven las criaturas del mapa (Kraken, sirena…); la página del tablero hace un ping por segundo al relé, como la de LA FIESTA.

---

## 11. Riesgos

| Riesgo | Qué hago |
|---|---|
| M1 cambia el ritmo o el humor de las tarjetas al partir cada función | Antes de partir nada, grabo con Playwright una partida de referencia con `?cpu=1&sinmj=1` (textos de `decir()` en orden, por semilla, con un `Math.random` sembrado solo para la prueba). M1 tiene que producir la misma secuencia de tipos de tarjeta |
| Las noticias animan criaturas con caminos largos (Kraken, piratas, Silbón) | El reductor decide solo la víctima y el resultado; el camino sale del grafo en el cliente. Si una animación necesita algo del estado, va en `p` del `fx` |
| Turnos largos en línea (cada turno de CPU dura varias tarjetas) | `S.ritmo = .6` para las CPU, como hoy, y el botón de acelerar del director (doc 07 §5.3). La duración se mide en `margarita-sim` |
| Dos conexiones (la página y el iframe del minijuego) | La página pausa SSE y sondeo durante `f:'carta'|'mj'` y retoma con `ver`. Si da problemas, P4 |
| `fiesta-reglas.js` cambia la forma de `board.mj` | `margarita-live.test.js` usa el `party_mj.js` real; si LA FIESTA cambia el contrato, la prueba lo dice |

---

## 12. Preguntas abiertas

- **P1. ¿Cuántos humanos como mínimo?** Recomiendo 2, como LA FIESTA. ¿O dejar también 1 humano con 3 CPU en línea (para invitar después)?
- **P2. ¿Orden de turno?** Hoy es fijo (TÚ, MAMÁ, ABUELA, PANA). Recomiendo sortearlo al empezar, con una tarjeta, como `revelarOrden()` de LA FIESTA, sin el minijuego de orden de MP.
- **P3. ¿Casillas M en línea?** Hay tres opciones:
  - (a) **Recomiendo:** se vuelven una «ruleta del microjuego» que decide el reductor, +10 Bs con 50 %.
  - (b) Juega solo el que cayó y su teléfono reporta el resultado, con el riesgo de trampa (son 10 Bs).
  - (c) En línea se convierten en casillas azules.
- **P4. ¿Minijuego en iframe de `fiesta.html` o cargado en la página de Margarita?** Recomiendo el iframe (menos código nuevo, reutiliza `fiesta-main` tal cual).
- **P5. ¿Saco la submáquina del minijuego a `fiesta-mj.js`** después de que subas LA FIESTA? Le quitaría a `margarita-reglas.js` una copia de unas 80 líneas.
- **P6. ¿Margarita y LA FIESTA comparten lobby?** Recomiendo que sí: un solo lobby del kit de menús, con el tablero como primera opción. Así el paso 8 del doc de menús se hace una sola vez.


### La Empanadera móvil (estrella del Mario Party)
- 10 puestos (`G.PUESTOS_EMP` en margarita-grafo.js, casillas azules sin lugar): Oriente = PLAYA EL AGUA, JUAN GRIEGO, LA ASUNCIÓN, PAMPATAR, PORLAMAR, PUNTA DE PIEDRAS (arranca aquí, a 8 pasos de la salida); Macanao = PUNTA ARENAS, SAN FRANCISCO, CERRO MACANAO, BOCA DE RÍO. `PUESTO_POR_NODO[nodo]` -> {k, x, y, nodo, isla, lugar}.
- Tras una compra (`COMPRAR si`) el reductor emite `mudanza` con el RNG sembrado: nunca el puesto actual, a más de 6 pasos del comprador (no se recompra en el mismo turno) y, entre esos, sortea entre los 3 que le quedan más cerca al grupo (distancia media de los 4 jugadores). Misma semilla = mismo destino en cliente y servidor.
- Los clientes reciben `mudanza` por el anillo de fx como cualquier otro efecto: reproducen el spotlight en el puesto viejo, el cartel `¡LA EMPANADERA SE MUDÓ A <LUGAR>!` y siguen la baliza. `distVenta`, la CPU y el mototaxi leen `isla.puesto`.
