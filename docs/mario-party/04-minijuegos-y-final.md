# 04 · Minijuegos y cierre: el Relámpago de 5, los Épicos y las Estrellas del Cierre

> Modo fiesta tipo Mario Party, de 1 a 4 jugadores, sobre el mapa gigante de Venezuela.
> Este documento cubre tres sistemas:
> **(A)** la ronda de **5 microjuegos rápidos seguidos** («¡RELÁMPAGO!»),
> **(B)** el **minijuego épico**, exclusivo del modo, largo y difícil (3 diseños concretos), y
> **(C)** las **estrellas extra del final**, calculadas con estadísticas de la partida («Estrellas del Cierre»).
>
> Todos los números son **valores iniciales para probar en mesa**, no definitivos. Lo que no se pudo confirmar en fuentes va marcado **(por verificar)**.
> Las cifras de economía dependen del precio de la estrella `P`. Aquí se asume `P = 20` monedas, el estándar clásico de la serie. Si el documento de economía cambia `P`, todas las tablas escalan con los porcentajes que se indican.

---

## 0. Resumen en una pantalla

| Sistema | Qué es | Duración | Cuándo |
|---|---|---|---|
| **¡RELÁMPAGO!** | 5 microjuegos del repo seguidos, de 6 a 12 s cada uno. Por la ronda se reparten monedas. | De 70 s (simultáneo) a 3,5 min (por turnos, 4 jugadores) | Al final de **cada** ronda del tablero |
| **Formato** | Todos contra todos (4), 2v2, 1v3 o duelo 1v1. Lo decide el color de la casilla donde cayó cada uno. | — | Se fija antes de cada Relámpago |
| **ÉPICO** | Minijuego nuevo de 60 a 120 s con 3 fases, más difícil, con corazones y jefe o carrera | 90 a 120 s | Rondas 4, 8 y la última (configurable), **después** del Relámpago |
| **Estrellas del Cierre** | 15 estrellas posibles calculadas con estadísticas. Se anuncian 2 al empezar y 1 queda oculta. | Ceremonia de unos 60 s | Después del último turno |

Principios de diseño, sacados de la investigación de toda la serie:

1. **El tablero decide el minijuego.** El color de la casilla define el formato (MP1→Jamboree). Así la posición en el tablero importa más allá de mover la ficha.
2. **El premio tiene que separar a los puestos.** MP9 fracasó porque pagaba casi lo mismo al 1.º que al 4.º. Aquí el 1.º cobra al menos 3 veces lo del 3.º.
3. **Turnos cortos.** El ritmo lento es la queja n.º 1 de MP4, MP8 y Jamboree. Por eso los microjuegos duran de 6 a 12 s, las tarjetas se pueden saltar y solo hay un Épico cada 4 rondas.
4. **Estrellas extra visibles.** Las estrellas ocultas y al azar se sienten injustas (Kotaku, Pro Rules de Jamboree). Se anuncian 2 al empezar y solo 1 oculta para el drama.
5. **Sin movimientos que lastimen la mano.** El giro de palanca de MP1 causó ampollas y una demanda. Los juegos de girar el dedo van como máximo 1 por ronda y nunca en el Épico.
6. **El Épico es nuestra novedad.** Ningún Mario Party de tablero tiene una «ronda de 5 rápidos + jefe largo» en el ciclo principal (Superstars, SMP y MP6 no tienen jefe en el ciclo; MP9 y MP10 sí tienen jefes cooperativos, pero en un tablero lineal). Tomamos la idea de MP9 (cooperar contra el jefe, puntuar cada uno por separado y premiar el golpe final) y la ponemos en un tablero libre.

---

## 1. Lo que ya tenemos en el repo (y lo que falta)

### 1.1 Contrato actual de un microjuego (motor del laboratorio, `docs/style-lab`)

- Un juego se define como una fábrica `mk()` que devuelve un objeto `g` con estos campos: `t`, `dur`, `result` (`null|'win'|'lose'`), `why`, `endT`, `cmd`, `hint`, `update(dt)`, `draw()` y, de forma opcional, `press(k)`, `down/move/up(p)`, `lr` y `probe()`.
- La campaña puntúa así: `100 + round((1 − fuseF) · 50)` si gana y pierde una vida si pierde (`campana.js:308`).
- La dificultad sale de `window.NIVEL` (1 a 3) a través de `BUS.LV()`, y la velocidad del global `SP`.
- Los jefes de varias fases (`juego-jefe-*.js`, con un arreglo `FASES` que tiene `cmd/hint/dur`) sirven de plantilla para el Épico.
- Todo asume **un solo jugador**: hay un único `G`, un solo puntero, el teclado es global y `Math.random` no tiene semilla.

### 1.2 Lo que hay que añadir (mínimo viable)

| Pieza | Para qué | Costo |
|---|---|---|
| `PARTY.semilla(n)`: envolver `Math.random` con mulberry32 durante `mk()` y `update()` | Que todos jueguen la **misma vaina** (o una variante controlada) | Bajo. Ya existe `withSeed/mulberry32` en `js/core.js` como referencia. |
| `PARTY.medir(g)`: leer `G.t` al ganar y `G.t/G.dur` al perder | Medir velocidad y aguante para ordenar a los jugadores (los juegos solo dan ganar o perder) | Bajo: no toca los juegos |
| Capa de entrada por jugador `PARTY.input` (slot ↔ tecla, `pointerId` ↔ esquina, gamepad opcional) | Épicos simultáneos y, en la fase 2, Relámpago simultáneo | Medio |
| Pantalla «pásale el teléfono» | Relevo por turnos (fase 1) | Bajo |
| Bots de CPU que reusan `pruebas/bots/<id>.js` (`gana/pierde`) | Rellenar con CPU los puestos vacíos | Bajo |
| Llamadas `EGGS.begin/outcome` en cada microjuego | Mantener los huevos de pascua | Trivial |

**Decisión de arquitectura:** la manda el doc `06` (§0 y §2): el modo vive en el motor del laboratorio, en una página propia `docs/style-lab/fiesta.html` con módulos `fiesta-*.js` bajo un único global `FIESTA`, y los minijuegos exclusivos en `juego-f-*.js`. **No** es un estado de `campana.js` (solo se añade un botón en su menú en M6). Donde este doc dice `PARTY.*`, léase `FIESTA.*`. El juego en línea con las salas de PocketBase queda para más adelante.

---

## 2. ¡RELÁMPAGO! La ronda de 5 microjuegos

### 2.1 Flujo de la ronda

```
Fin de la ronda del tablero (los 4 se movieron)
 └─ 1. RULETA DE FORMATO (≈3 s): colores de las casillas → 4 / 2v2 / 1v3 / duelo
 └─ 2. TARJETA DE EQUIPOS (≈2 s, se salta tocando)
 └─ 3. SORTEO DE LOS 5 (≈2 s): se muestran las 5 cartas boca abajo y se voltean una por una
 └─ 4. Microjuego 1 · 2 · 3 · 4 · 5 («EL REMATE», vale ×2)
 │     cada uno: tarjeta de orden 1,2 s → juego 6-12 s → sello de resultado 1,0 s
 └─ 5. PODIO (≈4 s): puntos de ronda → monedas, con animación de lluvia de monedas
 └─ 6. (solo en rondas de Épico) → ÉPICO
```

### 2.2 Cómo se elige el formato (regla de colores)

Los colores se mapean así:

- Casilla **CHÉVERE** (azul, +3) = **azul**.
- Casilla **LADILLA** (roja, −3) = **rojo**.
- Casillas de evento, tienda, peaje o especiales: su color se sortea con 50/50 antes de la ruleta, igual que el «verde» de SMP y la casilla Happening de MP1.

| Colores al final de la ronda | Formato | Ejemplo |
|---|---|---|
| 4 iguales (4A o 4R) | **TODOS CONTRA TODOS (4)** | — |
| 2A + 2R | **2v2**: el equipo es el color | Azules contra rojos |
| 3 + 1 | **1v3**: el solitario es el color minoritario | El único rojo contra 3 azules |
| Caso especial: dos jugadores en la **misma casilla** en los últimos 5 turnos | **DUELO 1v1** inmediato (Relámpago de 3, aparte) | Jamboree, Superstars y MP3 |
| Casilla **«¡PLEITO!»** (duelo) | Duelo 1v1 con apuesta (ver 2.8) | MP2 y MP3 |
| Casilla **«LA VACA»** (batalla de pozo) | Todos pagan al pozo y se reparte 70/20/10/0 | MP2 y Superstars |

Con 2 o 3 jugadores:

- **3 jugadores:** si los 3 son del mismo color, todos contra todos. Si el reparto es 2 + 1, se juega 1v2 con las reglas del 1v3 (sección 2.6) y el solitario necesita ganar 3 de 5 duelos.
- **2 jugadores:** siempre se juega duelo 1v1 al mejor de 5.

**Opción «Pro» (sin azar de formato):** el formato rota fijo. La ronda 1 es 4, la 2 es 2v2, la 3 es 1v3 y vuelve a empezar. En 1v3 el solitario es el jugador en **1.er lugar**: el líder contra el mundo, como el 3v1 invertido de la serie. Viene de las Pro Rules de Jamboree, que bajan el azar.

**Frecuencia esperada.** Si la probabilidad de caer en una casilla azul es `a ≈ 0,70` (por verificar con el diseño del mapa):

- Todos contra todos: `a⁴ + (1−a)⁴ ≈ 0,25`.
- 1v3: `4a³(1−a) + 4a(1−a)³ ≈ 0,49`.
- 2v2: `6a²(1−a)² ≈ 0,26`.

Este reparto conviene, porque los formatos por equipos son **más cortos** en relevo (ver 2.4).

### 2.3 Puntos de Ronda (PR) de cada microjuego

Los juegos del repo solo dicen ganó o perdió. El modo fiesta convierte ese resultado en un número **sin tocar los juegos**:

```
Si GANA:   PR = 100 + round(50 · (1 − t_gano / dur))      → 100 a 150
Si PIERDE: PR = round(40 · min(1, t_perdio / dur))         → 0 a 40  (el «aguante»)
EL REMATE (5.º microjuego): PR × 2
Racha perfecta (5/5 ganados): +50 PR
```

- El que pierde nunca supera al que gana, porque el máximo al perder es 40 y el mínimo al ganar es 100.
- El aguante premia aguantar más antes de fallar. Así un mal reflejo temprano vale menos que caer en el último segundo.
- En los juegos que **solo se ganan al agotar el tiempo** (aguantar hasta el final, como `nevera`, `duermete`, `torta`, `trencito` o `tapala`), el bono de tiempo es siempre 0. Para que haya desempate se usa la `margen` del juego si expone `probe()`, por ejemplo la distancia al borde. Si no, gana con 125 PR fijos y se marca la etiqueta `AGUANTE` en el catálogo (sección 4). Los juegos `AGUANTE` cuentan como empate en los duelos de 1 contra 1 si ambos ganan.

Máximo por recorrido: 4 × 150 + 300 + 50 = **950 PR**.

### 2.4 Dos maneras de jugarlo: relevo (fase 1) y simultáneo (fase 2)

| | **Fase 1 · RELEVO** («pásale el teléfono») | **Fase 2 · SIMULTÁNEO** («pantalla partida») |
|---|---|---|
| Qué hace falta | Nada nuevo en los juegos. Solo semilla, medición y pantalla de traspaso. | Capa `PARTY.input` y versiones de los juegos que corran varias instancias (o juegos nuevos para 4) |
| Todos contra todos | Cada jugador juega los 5. Son 20 jugadas, unos **3,5 min** | Los 4 juegan a la vez. Unos **70 s** |
| 2v2 | Cada equipo reparte los 5 juegos: 3 para uno y 2 para el otro. Se juega cara a cara contra el rival de ese turno. Son 10 jugadas, unos **1,8 min** | Unos 70 s |
| 1v3 | El solitario juega los 5 y el trío se los reparte 2+2+1. Son 10 jugadas, unos **1,8 min** | Unos 70 s |
| Duelo 1v1 | Al mejor de 5, 10 jugadas, unos **1,8 min** | Unos 70 s |
| Promedio por ronda con el reparto de la sección 2.2 | `0,25·3,5 + 0,75·1,8 ≈` **2,2 min** | ≈ **1,2 min** |

Cálculo de tiempo por jugada: tarjeta 1,2 s + juego unos 7,5 s (la mayoría usa `dur ≈ 5–8 s / √SP`) + sello 1,0 s, más 2,5 s de traspaso cuando cambia la mano. Total, unos 10,5 s.

**Equidad en el relevo:**

- **El orden rota.** En el microjuego k empieza el jugador `(k + ronda) mod n`. Así nadie juega siempre de último, viendo cómo jugaron los demás.
- **«Misma vaina, distinto chamo».** Todos juegan el mismo juego, con el mismo `NIVEL` y la misma `SP`, pero **cada uno con su semilla**. Ver la jugada del otro te enseña el juego, pero no te dice la posición exacta de las cosas.
- En el cara a cara (2v2, 1v3 y duelo), los dos rivales de ese juego usan **la misma semilla**, porque es un mano a mano directo. El que juega segundo **no ve** la jugada del primero: la pantalla de traspaso se pone en negro con «¡NO MIRES, CHAMO!» y el primer resultado se oculta hasta que juega el segundo.

### 2.5 Todos contra todos: cómo se ordena y cuánto se paga

Se ordena por **PR total**. Si hay empate se mira, en este orden:

1. Más microjuegos ganados.
2. Mejor PR en EL REMATE.
3. Si sigue el empate, se reparte el promedio de los puestos empatados, redondeado hacia arriba.

| Puesto | % del pozo base | Monedas (P = 20) |
|---|---|---|
| 1.º | 50 % | **10** |
| 2.º | 30 % | **6** |
| 3.º | 15 % | **3** |
| 4.º | 5 % | **1** |
| Racha perfecta 5/5 | — | +3 |

El total que entra es 20 monedas, o sea `1 · P`. Se compara con el clásico, donde el ganador de un minijuego para 4 cobra 10. Aquí entra más porque la ronda **sustituye** a un minijuego y dura 5 veces más. El 1.º sigue cobrando lo mismo que en la serie, y el 4.º cobra casi nada, que es la lección de MP9.

### 2.6 2v2, 1v3 y duelo: mano a mano

Cada uno de los 5 microjuegos es un **mano a mano** (H2H) entre los dos jugadores de turno:

```
Gana el H2H:
  ganó vs perdió                    → el que ganó
  ambos ganaron  → |ΔPR| ≥ 5        → el de mayor PR (más rápido); si no, EMPATE
  ambos perdieron→ |Δaguante| ≥ 0,10 → el que aguantó más; si no, EMPATE
EMPATE = ½ punto para cada lado.  EL REMATE vale 2 puntos de H2H.
```

El marcador va sobre 6 puntos (4 + 2 del remate). Para ganar la ronda hay que llegar a **≥ 3,5**. Con 3 contra 3 hay empate de ronda.

**Asignación de jugadores:**

- **2v2:** el equipo A juega en el orden A1, A2, A1, A2, A1. Por simetría, el B juega B2, B1, B2, B1, B2. Cada jugador enfrenta a los dos rivales y nadie esquiva al mejor del otro equipo.
- **1v3:** el solitario S juega los 5. El trío juega T1, T2, T3, T1, T2, y el que juega el remate rota cada vez que vuelve a salir 1v3.
- **Duelo:** cada uno juega los 5.

| Formato | Gana | Pierde | Empate de ronda | Total que entra |
|---|---|---|---|---|
| **2v2** | 7 c/u | 2 c/u | 4 c/u | 18 (≈ 0,9 P) |
| **1v3, gana el solitario** | Solitario **12** | trío 0 | — | 12 |
| **1v3, gana el trío** | trío **4 c/u** | solitario 0 | — | 12 |
| **1v3, empate** | solitario 5 | trío 2 c/u | — | 11 |
| **Duelo (casilla/últimos 5)** | ver 2.8 | | | |

**Equilibrio del 1v3.** Cada mano a mano es 1 contra 1, así que si todos juegan igual de bien el solitario gana la ronda alrededor del 50 % de las veces. En promedio el solitario cobra unas 6 monedas y cada miembro del trío unas 2. El solitario tiene ventaja de valor esperado, a cambio de jugar 5 seguidos mientras los otros se reparten la carga. Así funciona la serie: el 1v3 es el momento de «lucirse».

En modo **Pro** el solitario es el líder, y con eso el 1v3 se vuelve un **freno suave**: el trío solo necesita ganarle al líder.

### 2.7 Cómo se eligen los 5 microjuegos (reglas del sorteo)

Cada juego del catálogo lleva etiquetas: `verbo`, `entrada` (toque, mantener, arrastrar, deslizar, 2 botones, girar), `región` y `AGUANTE`.

1. **Variedad:** nunca hay dos juegos seguidos con el mismo `verbo`, y en cada ronda aparecen al menos 3 verbos distintos.
2. **Sin repetir:** un juego no vuelve a salir hasta pasadas 3 rondas (unos 15 juegos). Excepción: EL REMATE puede repetir uno de la ronda anterior.
3. **Ergonomía:** como máximo **1** juego de `girar` por ronda (`amarrala`). Nunca dos de machacar seguidos.
4. **Curva:** los juegos 1 y 2 van en `NIVEL 1`, el 3 y el 4 en `NIVEL 2` y el remate en `NIVEL 2`, que sube a 3 a partir del turno 10. La `SP` empieza en 1,1 y sube +0,05 por juego, hasta 1,3.
5. **Región:** el 60 % de los juegos se toman del grupo temático de la región donde están más jugadores (ver 4.3) y el 40 % de cualquier grupo. Así el Relámpago «sabe» a la zona del mapa.
6. **Novato:** la primera vez que un juego sale en la partida, su tarjeta dura 2,5 s en vez de 1,2 s y muestra el `hint` completo. Las siguientes veces solo muestra la orden (`cmd`).
7. **Filtro «Juegos tranquis»** (equivale al filtro de juegos fáciles de MP3 y MP5): opción para grupos casuales que deja fuera los juegos marcados ★★★.
8. **Formatos de mano a mano:** se excluyen los juegos con etiqueta `AGUANTE`, que empatan demasiado. También los de más de 10 s.

### 2.8 Variantes que activa el tablero

| Variante | Disparador | Regla | Pago |
|---|---|---|---|
| **¡PLEITO!** (duelo) | Casilla de duelo, objeto «Guante de Pleito» o compartir casilla en los últimos 5 turnos | Relámpago de **3** juegos al mejor de 3, sin remate. Quien lo provoca elige rival; en los últimos 5 turnos el rival es el que está en la casilla. | Apuesta: el retador elige 5, 10 o «todo lo que tenga el más pobre», con tope de 20. El ganador cobra la apuesta del otro. Una variante de estrella (1 ★) solo se permite en los últimos 5 turnos. |
| **LA VACA** (batalla de pozo) | Casilla «La Vaca» | Antes del Relámpago, una ruleta fija el aporte: 5, 10 o 15 monedas por jugador, con tope en lo que tenga cada uno. Luego se juega un todos contra todos normal. | El pozo se reparte **70/20/10/0** (Superstars). Lo que sobre por redondeo va al último. |
| **RELÁMPAGO EN DÓLARES** | Turnos múltiplos de 5, excepto el último (Superstars dobla cada 5.º turno) | El Relámpago normal | Pagos **×2** |
| **ÚLTIMOS 5 TURNOS** | Automático | Se activa la regla del duelo por casilla compartida. | Ver doc de economía; aquí no se toca el pago del Relámpago para no inflar el final. |

---

## 3. ÉPICO: el minijuego largo y difícil exclusivo del modo

### 3.1 Reglas comunes

| Regla | Valor |
|---|---|
| Duración | 90 a 120 s en 3 fases de 25 a 40 s, con un respiro de 3 s entre fases («¡RESPIRA, CHAMO!») |
| Cuándo | Rondas **4, 8 y la última** en una partida de 12 turnos. Fórmula general: cada `⌈turnos/3⌉` rondas y siempre en la última. Configurable: cada 3, cada 4, cada 5 o «solo la final». Se juega **después** del Relámpago de esa ronda. |
| Cuál de los 3 | El de la **región con más jugadores** al final de esa ronda. Si hay empate, elige el jugador en último lugar (le da poder al que va atrás). La final es siempre el Épico de la región con más visitas en la partida. |
| Jugadores | Siempre los 4 a la vez. Los puestos vacíos los juega la CPU. |
| Vida | 3 **corazones** por jugador. Con 0 quedas como **«FANTASMA»**: sigues jugando a la mitad de puntos y no te pueden golpear. Nadie se queda mirando sin jugar (lección de MP7 y MP8). |
| Más difícil que el Relámpago | Fases con señales cada vez más cortas. El jefe tiene vida que **escala con la cantidad de humanos**. `NIVEL` 2 en las rondas 4 y 8, `NIVEL` 3 en la final. |
| Ayuda al que va atrás (opcional, activada por defecto) | **«Ventaja del pelao»:** el último en estrellas y monedas empieza con +1 corazón (4). Ninguna otra ventaja. |
| Pago | Por puesto en **Puntos Épicos (PE)**: **15 / 9 / 5 / 2** monedas (75 / 45 / 25 / 10 % de P). En la final: **×1,5**, o sea 23 / 14 / 8 / 3. |
| Si el jefe gana (solo en los cooperativos) | Todos pierden 3 monedas (nunca bajan de 0) y el reparto por PE se paga a la **mitad**. Así se castiga sin eliminar (lección de MP7: si tienes 0 monedas no pierdes nada). |
| Golpe final | +30 PE para quien da el último golpe al jefe (MP9 daba 3, 5 o 10 puntos extra). |
| Estadística | El ganador de cada Épico suma 1 en `epicosGanados`, y los `PE` se acumulan para la **Estrella Arrecha** (ver sección 5). |

### 3.2 Controles: uno o dos botones por jugador

El Épico es simultáneo, así que **cada jugador tiene 1 botón (A)**, y algunas fases usan un **2.º botón (B)**. Este es el mínimo que se puede repartir entre 4 personas en una sola pantalla.

| Jugador | Teclado A / B | Toque (pantalla horizontal) | Gamepad (fase 2) |
|---|---|---|---|
| J1 (rojo) | `Q` / `W` | Esquina sup. izq. (A abajo, B arriba si hay 2 botones) | A / B |
| J2 (azul) | `P` / `O` | Esquina sup. der. | A / B |
| J3 (amarillo) | `Z` / `X` | Esquina inf. izq. | A / B |
| J4 (verde) | `M` / `N` | Esquina inf. der. | A / B |
| Un solo humano | `ESPACIO` / `←` `→` | Toda la pantalla | A / B |

- **Zonas táctiles:** cada esquina es un círculo de 22 % del lado corto, con el color y la cara (`bust()`) del jugador. Se registran por `pointerId` el primer toque que cae en cada zona (un `Map<pointerId, slot>`). Se desactiva la conversión de deslizar a flechas (`swipe→Arrow`) mientras dure el Épico.
- **Teléfono:** se recomiendan **como máximo 2 humanos simultáneos**. Con 3 o 4 en un teléfono, el Épico pasa a modo **CONTRARRELOJ** (cada uno juega su versión de 60 s, con los fantasmas de los anteriores en pantalla; el repo clásico ya tiene `party-ghost.js` como referencia). En tableta o PC se juega con 4.
- **Teclado:** el efecto *ghosting* limita a unas 6 teclas simultáneas en teclados baratos (por verificar en el hardware de prueba). Por eso las teclas están en las 4 esquinas y las fases de 2 botones no exigen apretar A+B a la vez.
- **Bloqueadas durante el Épico:** `Escape` (pide confirmación 2 veces), los dígitos 1-9 (cambio de estilo) y `M`. `M` es de J4, así que la tecla de silencio pasa a `F9` en el modo fiesta.
- **Prohibido:** girar el dedo o la palanca y machacar más de 8 s seguidos. Donde hay que machacar, se alterna con pausas obligatorias.

---

### 3.3 ÉPICO 1 · «¡EL CORRIENTAZO DEL CATATUMBO!» (Zulia · cooperativo contra jefe con puntaje individual)

> La **Tormenta Arrecha**, una nube con bigote que vive sobre el sur del Lago de Maracaibo, quiere dejar sin luz al Zulia **en pleno calor**. Los 4 están en peñeros y tienen que esquivarle los rayos, embotellar su energía y devolverle el corrientazo por el Puente sobre el Lago.
> (El relámpago del Catatumbo existe y la NASA lo llamó capital mundial de los rayos. La leyenda de Drake es tradición, no un hecho documentado, y no se usa como dato).

**Formato:** 4 contra el jefe. Gana el Épico quien sume más PE. El equipo «gana» si la Tormenta llega a 0 de vida.
**Duración:** de 95 a 105 s.

#### Fase 1 · «¡PÉLATE DE LOS RAYOS!» (30 s, 1 botón)

- Cada jugador tiene un **carril** horizontal en el lago, con 2 posiciones: orilla y centro.
- **A** cambia de posición. Es un toque, no hay que mantener.
- La nube marca dónde va a caer el rayo con una sombra amarilla, **0,9 s** antes en `NIVEL 2` y **0,6 s** en `NIVEL 3`. El último tercio de la fase trae rayos dobles: los dos lados de un carril, con un hueco de 0,3 s entre uno y otro.
- Cadencia por carril: 1 rayo cada 2,2 s, que baja a 1,4 s.

| Evento | PE |
|---|---|
| Esquivar un rayo | +2 |
| Esquivar «de pelo» (cambiar de posición menos de 0,25 s antes del golpe) | +5 |
| Que te caiga | −1 corazón, −5 PE y 1 s aturdido |

#### Fase 2 · «¡EMBOTELLA EL RAYO!» (30 s, 1 botón)

- Ahora los rayos dejan **bolas de chispa** que bajan por tu carril, con un aro que se encoge (como `saltale` o `pique`).
- **A** en el momento justo la mete en tu frasco de mayonesa.
- Hay una **barra de equipo** («LUZ PA'L PUENTE»), con meta de **60 chispas** × (humanos ÷ 4), con un mínimo de 30.

| Evento | PE | Barra |
|---|---|---|
| Atrapar | +6 | +1 |
| Atrapar perfecto (centro del aro, ±60 ms) | +10 | +1,5 |
| Fallar (tocar fuera de tiempo) | −2 | — |
| **Chispa negra** (trampa, 1 de cada 6, aparece en `NIVEL 3`) | Si la tocas, −1 corazón | — |

- **Si el equipo llena la barra:** la Tormenta empieza la fase 3 con **75 %** de vida.
- **Si no la llena:** empieza con el **100 %** y la fase 3 dura 5 s más. Es más difícil, pero se puede ganar.

#### Fase 3 · «¡DEVUÉLVELE EL CORRIENTAZO!» (35 s, 1 botón, machacar con pausas)

- Cada jugador empuja corriente por su cable hacia el Puente y **machaca A**. Cada toque baja 1 punto de vida a la Tormenta.
- Vida de la Tormenta: `HP = 90 × humanos + 40 × CPU`. Con 4 humanos son 360. Calculado para que el equipo machaque unos 3,5 toques por segundo por cabeza durante unos 25 s útiles (por verificar en pruebas).
- **Ola de apagón:** cada 6 a 9 s la nube se pone **ROJA** durante 1,5 s, con aviso de 0,5 s y un sonido de transformador. Tocar durante la ola da **corrientazo**: −1 corazón y −10 PE. Esta es la pausa obligatoria para la mano (lección de MP1) y además es un juego de inhibición, como `duermete` o `llego`.
- **Golpe final:** +30 PE a quien baja el último punto de vida.

| Evento | PE |
|---|---|
| Cada toque válido | +1 |
| Corrientazo | −10 y −1 corazón |
| Golpe final | +30 |
| Equipo vence a la Tormenta | +20 a todos los que estén vivos (los fantasmas reciben +10) |

**Cierre narrativo:** si el equipo gana, se prende el puente y suena una gaita de 2 compases. Si pierde, aparece el letrero «**SE FUE LA LUZ EN TODO EL ZULIA**», pantalla negra de 1,5 s y el sonido de la nevera apagándose.

**Reutilización:** `juego-jefe-transformador.js` (la fase de subir el breaker entre todos), `oscuro()`/`bombillo` de `BUS.AP`, el aro de `saltale/pique` y la inhibición de `llego/duermete`.

**CPU:**

| Dificultad | Esquiva | Atrapa | Toques por segundo | Respeta la ola roja |
|---|---|---|---|---|
| Fácil | 70 % | 55 % | 2,5 | 80 % de las veces |
| Normal | 85 % | 70 % | 3,2 | 92 % |
| Difícil | 95 % | 85 % | 4,0 | 98 % |

---

### 3.4 ÉPICO 2 · «¡BÁJATE DEL SALTO ÁNGEL!» (Guayana · carrera todos contra todos)

> Carrera: subir el Auyantepui, cruzar la niebla del tepuy y tirarse por los 979 m del Salto Ángel (Kerepakupai Merú) para caer **dentro** de la Laguna de Canaima… o donde se pueda. El guía es «el baquiano», un personaje genérico. No se parodia al pueblo pemón: el humor está en los turistas.

**Formato:** todos contra todos. Gana el Épico quien sume más PE.
**Duración:** de 100 a 110 s.
**Contra la bola de nieve:** **cada fase arranca con todos en la misma línea.** Una mala fase 1 no decide el resultado, solo da menos puntos.

#### Fase 1 · «LA SUBIDA» (35 s, 2 botones, ritmo y no machaque)

- El tepuy es una pared vertical dividida en 4 columnas.
- **Alternar A y B** sube un paso. Repetir el mismo botón **resbala** medio paso (como el palmeo del jefe arepa: «nunca el mismo lado dos veces»).
- Ritmo ideal: hasta 5 pasos por segundo. Machacar más rápido no da más velocidad: hay un **tope de 5 pasos por segundo**, y por encima de 6 toques por segundo resbalas. El ritmo cuenta más que la fuerza bruta, y así se cuidan las manos.
- **Piedras que caen:** una sombra avisa 0,8 s antes. **No tocar nada** durante 0,6 s = agarrado (como `duermete`). Si te pega, te tumba 3 pasos y pierdes 1 corazón.
- Con 1 solo botón (accesibilidad o teléfono): un toque a tiempo con un metrónomo de 3 pasos por segundo.

| Llegada a la cima | 1.º | 2.º | 3.º | 4.º |
|---|---|---|---|---|
| PE | 40 | 28 | 18 | 10 |

Si nadie llega en 35 s, se reparte por altura alcanzada.

#### Fase 2 · «LA NIEBLA DEL TEPUY» (25 s, 1 botón, timing en la oscuridad)

- Cada jugador cruza 8 piedras en su propia fila. La niebla lo tapa todo.
- Un **relámpago** ilumina la pantalla cada 1,2 a 2 s, de forma irregular, durante 0,25 s, y en ese instante se ve si la siguiente piedra está **firme** o es **musgo**.
- **A** salta a la siguiente piedra:
  - Si es firme: +6 PE.
  - Si es musgo: te resbalas, −1 corazón, y vuelves a la piedra anterior.
- En `NIVEL 3`, 1 de cada 4 piedras **cambia** entre un relámpago y el siguiente. Hay que saltar justo durante el destello o arriesgarse.
- Al llegar: +20 PE al 1.º, +12 al 2.º, +6 al 3.º y +0 al 4.º.

#### Fase 3 · «¡CAÍDA LIBRE!» (30-40 s, 1 botón, mantener, soltar y abrir)

- Todos se tiran a la vez. La altura va de 979 m a 0 en unos 30 s de juego, a velocidad comprimida.
- **Mantener A** = picada: bajas más rápido y te mueves al carril de abajo. **Soltar** = planeas y subes de carril. Con eso se recogen **turpiales dorados** (+3 PE cada uno) y se esquivan **zamuros** (−5 PE y 0,5 s de giro).
- **Tocar dos veces A** abre el paracaídas (la sombrilla playera de la tía). Hay que abrirlo dentro de la **franja verde** de altura, de 120 a 60 m, que se achica a 90-70 m en `NIVEL 3`.

| Aterrizaje | PE |
|---|---|
| Dentro de la diana de la Laguna (centro) | +40 |
| Laguna (fuera del centro) | +25 |
| «Chapuzón» (abrió tarde: entre 60 y 20 m) | +10, con el chiste «¡TE ECHASTE UN BAÑO, CHAMO!» |
| No abrió | +0 y −1 corazón: queda colgado de un árbol, ileso y con humor de caricatura |
| Abrió muy temprano (más de 120 m) | +15, pero planea lento y llega último al recuento |
| Golpe final de la carrera: el primero en tocar agua | +15 |

**Reutilización:** `juego-jefe-arepa.js` (alternar lados), `juego-duermete.js` (inhibición), `juego-rayita/marcalo/queso` (mantener y soltar en la franja), `oscuro()` para la niebla.

---

### 3.5 ÉPICO 3 · «DELTAMACURA: EL CAÑO QUE NO EXISTE» (Delta · 2v2, con variante 1v3)

> Deltamacura es el lugar que **no está en ningún mapa**: el GPS dice «recalculando», el muelle de llegada cambia de sitio y pasa un peñero fantasma. **El villano es el GPS**, nunca la gente del Delta. La cultura warao no se usa como chiste: palafitos y curiaras aparecen como escenario con respeto, y lo raro es el lugar.

**Formato por defecto: 2v2.**

- Si el Épico cae en una ronda cuyo Relámpago fue 2v2, se **conservan los equipos**.
- Si no, los equipos son **1.º + 4.º contra 2.º + 3.º**, el emparejamiento que equilibra.

Cada equipo rema **una curiara**, y avanzar exige **coordinarse**.

**Duración:** 5 tramos de 20 s, unos **110 s**.

#### Remo de equipo (la regla base de todo el Épico)

- Cada jugador tiene **A**.
- La curiara avanza **1 remada** cuando los dos compañeros tocan **alternados**: J-a, J-b, J-a…
- Si el mismo jugador toca dos veces seguidas, la curiara **gira** y pierde 0,4 s.
- Si los dos tocan con menos de 80 ms de diferencia, es «remada doble»: avanza ×1,5. Recompensa la sincronía perfecta y es muy de fiesta, porque obliga a gritarse «¡YA! ¡YA!».
- La velocidad tiene un tope de 4 remadas por segundo por curiara.

#### Los 5 tramos («¡RECALCULANDO!»)

Al empezar cada tramo, el GPS saca **1 regla rara** de un mazo de 8, sin repetir:

| Regla | Efecto | Dura |
|---|---|---|
| **«AL REVÉS, CHAMO»** | Hay que **mantener A** para *no* remar. Cada vez que sueltas, rema. | 20 s |
| **«NIEBLA DEL CAÑO»** | Solo se ve 1,5 s del camino. Hay troncos y hay que remar a la par para esquivarlos: el compañero que toca de último decide el lado. | 20 s |
| **«EL PEÑERO FANTASMA»** | Pasa un peñero a los 10 s: toca A justo cuando cruza tu fila para **subirte** (+1 s de turbo), o choca (−1 corazón a cada uno). | 20 s |
| **«SE VOLTEÓ LA CORRIENTE»** | La corriente empuja hacia atrás 0,8 remadas por segundo. Solo avanza quien rema sincronizado. | 20 s |
| **«TEMPORADA DE MORICHE»** | Caen frutos de moriche: el que toca A cuando el fruto está sobre su puesto lo atrapa (+4 PE), pero no rema en ese toque. Hay que decidir entre avanzar y puntuar. | 20 s |
| **«RECALCULANDO…»** | La meta de ese tramo se **mueve** ±30 % a los 10 s. Si tu curiara ya la pasó, cuenta. | 20 s |
| **«GARZA MENSAJERA»** | Una garza se posa en una curiara al azar: ese equipo tiene la remada ×2 durante 5 s. Luego pasa a la otra curiara. | 20 s |
| **«EL MAPA NO CARGA»** | Pantalla en tonos sepia con «cargando…». Los controles funcionan con 150 ms de retraso. | 20 s |

**Puntos por tramo:**

| Resultado | PE |
|---|---|
| Curiara que llega primero | +20 a cada uno |
| Segunda curiara | +8 a cada uno |
| Contribución individual: cada remada válida tuya | +1 (así hay ranking dentro del equipo) |
| Remadas dobles que provocaste (cuenta para los 2) | +2 |

**Final del tramo 5, «¿Y EL MUELLE?»:** hay 3 muelles posibles y solo uno es real. Se revela 2 s antes de llegar. Cada curiara puede **cambiar de muelle una vez** si el equipo toca A+A a la vez. El primero en el muelle real se lleva **+30** («golpe final»).

**Ganador:**

- El **equipo** con más PE sumados gana **7 monedas por cabeza** como «bono de equipo». Esto es **en lugar** de la tabla 15/9/5/2.
- El jugador con más PE individuales gana además **+5** y el `epicosGanados` de la estadística.
- El equipo perdedor cobra 2 monedas por cabeza.
- Total: 7×2 + 2×2 + 5 = **23 monedas** (≈ 1,15 P), comparable con los otros Épicos (31).

**Variante 1v3: «EL GPS»** (si el Relámpago de la ronda fue 1v3)

- El **solitario es EL GPS**. No rema: tiene una mano de 3 reglas del mazo y las juega cuando quiera, con un enfriamiento de 8 s.
  - Con **A** pasa por las cartas.
  - Con **B** (o mantener A 0,6 s) lanza la carta elegida.
- El **trío** rema una curiara grande con alternancia de 3 en rotación: J1, J2, J3, J1…
- **Meta del trío:** llegar al muelle real antes de que se acaben los 100 s.
- **Meta del GPS:** que no lleguen.

| Resultado | Pago |
|---|---|
| Gana el GPS | 12 monedas |
| Gana el trío | 4 monedas cada uno |

Mismo pozo que el 1v3 del Relámpago, por coherencia.

**Reutilización:** `juego-soplalo/sopa` (alternar), la mecánica de pegarse sin chocar de `trancalo`, el agua y el oleaje de `juego-cava.js`, y los fondos de `BUS.AP`.

### 3.6 Comparación de los 3 Épicos

| | Catatumbo | Salto Ángel | Deltamacura |
|---|---|---|---|
| Formato | Cooperativo contra jefe, puntaje individual | Carrera todos contra todos | 2v2 (variante 1v3) |
| Botones | 1 | 2 (fase 1) y 1 | 1 (2 en la variante GPS) |
| Verbos | Esquivar, timing, machacar con inhibición | Ritmo alternado, timing a ciegas, mantener y soltar | Sincronía, decisión, reglas que cambian |
| Riesgo de que gane la suerte | Bajo | Bajo | Medio. Es a propósito: lo raro de Deltamacura es el chiste. |
| Monedas que entran (P = 20) | 31, que bajan a 15 si gana el jefe y −12 por la penalización | 31 | 23 |
| Prioridad de construcción | **1.º** (el transformador ya existe) | 2.º | 3.º (necesita las reglas raras) |

**Épicos futuros, por región (solo la idea):**

- Caracas, «HORA PICO»: 1v3 en el Metro, una extensión del jefe metro.
- Llanos, «¡COLEO!»: carrera de tumbar el toro de peluche, con la vaca inflable cómica, sin maltrato animal.
- Andes, «EL TELEFÉRICO»: sincronía de 4 y frío.
- Margarita, «EL FERRY»: equilibrio de carga.

---

## 4. Catálogo: qué microjuegos del repo van en cada categoría

Inventario real del repo: **42 microjuegos + 4 jefes = 46**. Son 41 `juego-*.js`, los 3 de `juegos-bus.js` (`baja`, `encaleta`, `agarrate`) y los 2 de `engine.js` (`parada`, `chancla`).

### 4.1 Leyenda

- **R** = sirve para el Relámpago todos contra todos (relevo).
- **H** = sirve para el mano a mano (2v2, 1v3 y duelo).
- **S4** = candidato a versión simultánea para 4 en la fase 2 (la mecánica admite 4 instancias en cuadrantes o una arena común).
- **AS** = candidato a versión **asimétrica** 1v3 en la fase 2.
- Dificultad ★ a ★★★ (estimada; **por verificar** con el banco `probar.js`).
- `AGUANTE` = solo se gana al agotar el tiempo.

### 4.2 Tabla completa

| id | Nombre en juego | Verbo | Entrada | R | H | S4 | AS | ★ | Notas |
|---|---|---|---|---|---|---|---|---|---|
| parada | ¡PARADA! | Timing de un toque | Toque | ✔ | ✔ | ✔ | | ★ | Ideal para abrir la ronda |
| baja | (camionetica) | Machacar | Toque rápido | ✔ | ✔ | ✔ | | ★★ | `hint`: «pide permiso y llega a la puerta» |
| encaleta | (camionetica) | Decisión, esconder | Toque y arrastre (por verificar) | ✔ | ✔ | | ✔ | ★★ | Asimétrico posible: un jugador hace de ladrón |
| agarrate | (camionetica) | Equilibrio | Mantener y deslizar | ✔ | ✔ | ✔ | | ★★ | |
| revisa | ¡REVISA! | Decisión rápida | ← → | ✔ | ✔ | ✔ | | ★★ | Billete bueno o chimbo |
| paga | ¡PAGA Y CORRE! | Doblar | Deslizar | ✔ | ✔ | | | ★★ | 2 fases internas |
| pendrive | ¡PENDRIVE! | Timing y arrastre | Arrastrar | ✔ | ✔ | | | ★★ | Gag del pendrive al revés |
| duermete | ¡DUÉRMETE! | Inhibición | Mantener | ✔ | ✘ | ✔ | ✔ | ★★ | `AGUANTE`. AS: 1 = mamá vigilando, 3 = niños |
| saltale | ¡SÁLTALE! | Timing de un toque | Toque | ✔ | ✔ | ✔ | | ★ | |
| amarrala | ¡AMÁRRALA! | **Girar** | Girar el dedo | ✔ (máx. 1) | ✔ | ✘ | | ★★ | **Ergonomía**: nunca en Épico ni dos seguidos |
| chancla | ¡CHANCLA! | Esquivar | ↑ / ↓ | ✔ | ✔ | ✔ | ✔ | ★★ | AS natural: 1 mamá lanza, 3 esquivan |
| llave | ¡LA LLAVE! | Elegir y arrastrar | Arrastrar | ✔ | ✔ | | | ★★ | |
| sopa | ¡SÓPLALE! | Alternar | 2 botones | ✔ | ✔ | ✔ | | ★ | Base del remo de Deltamacura |
| queso | ¡PÉSALO! | Mantener y soltar | Mantener | ✔ | ✔ | ✔ | | ★★★ | Precisión fina: buen REMATE |
| hallaca | ¡AMÁRRALA! (hallaca) | Deslizar ↕ ↔ | Deslizar | ✔ | ✔ | | | ★★ | Mismo `cmd` que `amarrala`: cambiar el texto en el modo fiesta para que no confunda |
| cucaracha | ¡MÁTALA! | Inhibición y reflejo | Toque | ✔ | ✔ | ✔ | ✔ | ★★ | Duelo de reflejos ideal |
| mango | ¡TÚMBALO! | Timing de posición | Toque | ✔ | ✔ | ✔ | | ★★ | |
| tendedero | ¡JÁLALA! | Deslizar hacia abajo varias veces | Deslizar | ✔ | ✔ | | | ★★ | |
| inscribe | ¡INSCRIBE! | Reflejo con salida en falso | Toque | ✔ | ✔ | ✔ | | ★ | El mejor «¡pistola de salida!» para 4 |
| tapala | ¡TÁPALA! | Inhibición | Mantener | ✔ | ✘ | ✔ | ✔ | ★★ | `AGUANTE`. AS: 1 profe, 3 copiones |
| tranca | ¡TRANCA! | Timing | Toque | ✔ | ✔ | ✔ | | ★★ | Dominó |
| acomoda | ¡ACOMODA! | Puzzle de arrastre | Arrastrar | ✔ | ✔ | | | ★★★ | Largo: evitarlo en el REMATE |
| hielo | ¡ESTRÉLLALA! | Deslizar con potencia | Deslizar | ✔ | ✔ | | | ★★ | |
| tequenos | ¡AGARRA! | Timing de captura | Toque | ✔ | ✔ | **✔✔** | | ★ | **Ya es 4P en espíritu** («antes que tus primos»): primer candidato S4 |
| soplalo | ¡SÓPLALO! | Alternar | 2 botones | ✔ | ✔ | ✔ | | ★ | |
| baile | ¡SÍGUELE EL PASO! | Ritmo | ← → | ✔ | ✔ | ✔ | | ★★ | Muy bueno para mirar en la fiesta |
| rayita | ¡HASTA LA RAYITA! | Mantener y soltar | Mantener | ✔ | ✔ | ✔ | | ★★ | |
| marcalo | ¡MÁRCALO! | Mantener y soltar | Mantener | ✔ | ✔ | | | ★★ | |
| anuncio | ¡QUITA EL ANUNCIO! | Buscar y tocar | Toque | ✔ | ✔ | | | ★★ | |
| trencito | ¡AGARRA LA CINTURA! | Esquivar arrastrando | Arrastrar | ✔ | ✘ | ✔ | | ★★ | `AGUANTE` |
| torta | ¡NO TE MANCHES! | Equilibrio | Mantener ← → | ✔ | ✘ | ✔ | | ★★ | `AGUANTE`; la inclinación del teléfono queda fuera en el modo fiesta |
| cava | ¡AGÁRRALA! | Inhibición y arrastre | Arrastrar | ✔ | ✔ | | | ★★ | |
| hueco | ¡ESQUIVA! | Cambiar de carril | ← → | ✔ | ✔ | ✔ | | ★ | Carrera por carriles para 4 |
| pique | ¡MÉTELE! | Timing con aguja | Toque | ✔ | ✔ | ✔ | | ★ | |
| trancalo | ¡TRÁNCALO! | Acelerar y frenar | Mantener | ✔ | ✔ | ✔ | | ★★★ | Buen REMATE |
| cloche | ¡MÉTELE CHOLA PA'…! | Mantener y soltar en verde | Mantener | ✔ | ✔ | ✔ | | ★★ | |
| switch | ¡PRENDE! | Machacar | Toque rápido | ✔ | ✔ | ✔ | | ★ | |
| nevera | ¡CIERRA LA NEVERA! | Machacar | Toque rápido | ✔ | ✘ | ✔ | ✔ | ★ | `AGUANTE`. AS: 1 abre, 3 cierran |
| zancudo | ¡MATA EL ZANCUDO! | Apuntar y soltar | Arrastrar | ✔ | ✔ | | | ★★ | |
| enchufa | ¡ENCHUFA! | Elegir y soltar | Arrastrar | ✔ | ✔ | | | ★★ | |
| voltea | ¡VOLTEA! | Timing (doble en `NIVEL` 3) | Toque o ← → | ✔ | ✔ | ✔ | | ★★ | |
| llego | ¡LLEGÓ LA LUZ! | Reflejo con salida en falso | Toque | ✔ | ✔ | ✔ | | ★ | |
| **Jefes** | | | | | | | | | |
| alcabala | JEFE · ALCABALA | 3 fases: tocar, arrastrar, ritmo | Mixto | ✘ | ✘ | | | ★★★ | Plantilla de fases para el Épico, y Épico futuro «La Alcabala» |
| arepa | JEFE · AREPA | Girar y alternar | Mixto | ✘ | ✘ | | | ★★★ | La fase de amasar es de **girar**: queda fuera del Épico. La de palmear sirve para el Salto Ángel. |
| metro | JEFE · METRO | Deslizar y machacar | Mixto | ✘ | ✘ | | ✔ | ★★★ | Base del Épico futuro «HORA PICO» (1v3) |
| transformador | JEFE · TRANSFORMADOR | Machacar «entre todos» | Toque | ✘ | ✘ | ✔ | | ★★★ | **Base directa del Épico Catatumbo, fase 3** |

**Recuento:**

| Grupo | Cantidad | Cuáles |
|---|---|---|
| R (Relámpago todos contra todos) | **42** | Todos los microjuegos |
| H (mano a mano) | **37** | Todos menos los 5 `AGUANTE`: `duermete`, `tapala`, `trencito`, `torta`, `nevera` |
| S4 (simultáneo para 4) | **27** candidatos | Prioridad: `tequenos`, `inscribe`, `llego`, `hueco`, `chancla`, `baile`, `saltale`, `parada` |
| AS (asimétrico 1v3) | **8** | `duermete`, `tapala`, `chancla`, `cucaracha`, `nevera`, `encaleta`, `metro`, y el modo GPS de Deltamacura |
| Plantillas de Épico | **4** | Los 4 jefes |

### 4.3 Grupos temáticos por región (peso del 60 % en el sorteo)

| Región del mapa | Grupo temático | Juegos |
|---|---|---|
| Caracas y el centro (metro, Cota Mil, camioneticas) | LA CAMIONETICA | parada, baja, encaleta, agarrate, revisa, paga, pendrive, duermete, saltale, amarrala |
| Andes y Llanos (la casa de la abuela, la cocina) | LA CASA | chancla, llave, sopa, queso, hallaca, cucaracha, mango, tendedero, inscribe, tapala, tranca |
| Oriente y costa (Mochima, Margarita, Morrocoy, la rumba de playa) | LA RUMBA | acomoda, hielo, tequenos, soplalo, baile, rayita, marcalo, anuncio, trencito, torta, cava, hueco, pique, trancalo, cloche |
| Zulia, Guayana y Guri (calor y apagones) | ¡SE FUE LA LUZ! | switch, nevera, zancudo, enchufa, voltea, llego |
| Delta («Deltamacura») | TODO EL CAOS | Cualquiera, con `NIVEL` +1 y **orden de la ronda al revés** (el remate primero). Es el chiste del lugar que no tiene lógica. |

Los grupos copian las `ETAPAS` de `campana.js:40-48`, así que no hay que inventar listas nuevas. El reparto de regiones es una propuesta y conviene coordinarlo con el documento del mapa.

### 4.4 Microjuegos nuevos exclusivos de la fiesta (fase 2, simultáneos)

Hacen falta unos **8 nuevos** para que 2v2 y 1v3 se jueguen de verdad en simultáneo:

| Nombre | Formato | Verbo | Gancho |
|---|---|---|---|
| ¡LA COLA DEL PAN! | 4 | Empujar (sumo) | Colarse sin que te vea el vigilante |
| ¡LA PIPA! | 2v2 | Machacar alternando con pausas | Llenar tobos cuando llega la pipa de agua |
| ¡BOLAS CRIOLLAS! | 4 / 2v2 | Apuntar y soltar | Arrimar al mingo |
| ¡LA PIÑATA! | 4 | Timing a ciegas | Golpear con los ojos vendados (el cuadrante se ve oscuro) |
| ¡REGATEO EN QUINTA CRESPO! | 1v1 | Parar la barra de precio | Quien saque la mejor rebaja |
| ¡JONRÓN! (clásico de béisbol con equipos inventados, sin marcas reales) | 1v3 | Lanzar o batear | El solitario lanza y el trío batea |
| ¡ZAPATEO LLANERO! | 4 | Ritmo de joropo | Sin animales: solo arpa, cuatro y maracas |
| ¡LA VACA DE LA FIESTA! | 2v2 | Recolectar | Atrapar billetes y monedas que caen para el pote |

---

## 5. ESTRELLAS DEL CIERRE (estrellas extra por estadísticas)

### 5.1 Cuántas se dan y cómo se anuncian

| Regla de partida | Visibles (anunciadas al empezar) | Oculta «del pueblo» | Total máximo |
|---|---|---|---|
| **Normal** (≤ 14 turnos) | 2 | 0 | 2 |
| **Normal** (≥ 15 turnos) | 2 | 1 | 3 |
| **Pro** | 1 (de un mazo reducido: Mochilera, Morrocoy o Relámpago) | 0 | 1 |
| **Clásica** | 3 fijas: Relámpago, Billetuda, Chismosa | 0 | 3 |
| **Apagadas** | — | — | 0 |

Por qué así: SMP, Superstars y Jamboree dan 2, y 3 en partidas largas. Pro Rules anuncia 1 al empezar y fue muy bien recibida. Las estrellas ocultas y al azar tienen fama de injustas, así que la oculta solo aparece en partidas largas y viene del mazo **«chistoso»**.

- **Panel en vivo («LA TABLA DEL CHISME»):** cada 5 turnos y al pulsar el icono 📊, muestra quién lidera cada estrella visible. La oculta nunca se muestra.
- **Ceremonia final:** primero las visibles, de menor a mayor impacto. Luego la oculta, con redoble y la frase «Y LA QUE NADIE SABÍA…». Al final, el conteo.

### 5.2 El mazo: 15 estrellas con reglas exactas

Cada estrella lleva su **contador** (`stats[jugador].x`), la **regla exacta de conteo**, un **umbral mínimo** (si nadie lo alcanza, no se entrega), el **desempate secundario** y su **grupo de correlación** (ver 5.4).

| # | Estrella | Contador | Regla exacta de conteo | Umbral | Desempate secundario | Grupo |
|---|---|---|---|---|---|---|
| 1 | **Estrella Relámpago** («¡Pelotero!») | `microGanados` | +1 por cada microjuego ganado en un Relámpago, en todos los formatos. En el mano a mano, solo si ganó el H2H; un empate suma ½. **No cuentan** los duelos de ¡PLEITO! ni los Épicos. | ≥ 5 | PR total acumulado | HABILIDAD |
| 2 | **Estrella Arrecha** (Épica) | `pe` | Suma de PE de todos los Épicos, contando el bono de golpe final. | ≥ 1 Épico jugado | Cantidad de golpes finales | HABILIDAD |
| 3 | **Estrella Billetuda** (Rica) | `monedasGanadas` | Suma de **todas las entradas positivas** de monedas: casillas, Relámpago, Épico, robos, eventos e intereses. **No resta** gastos ni pérdidas. Excluye las monedas iniciales y las devoluciones. | ≥ 40 | Máximo de monedas tenidas en un mismo momento | ECONOMÍA |
| 4 | **Estrella Bachaquera** (Compras) | `objetosComprados` | +1 por cada objeto comprado en tiendas: bodegón, buhonero o tienda de Porlamar. Los objetos regalados o robados no cuentan. | ≥ 3 | Monedas gastadas en tiendas | ECONOMÍA |
| 5 | **Estrella Peajera** | `monedasInteraccion` | Monedas pagadas por usar el mapa: peajes, alcabalas, teleférico, ferry, avioneta, Metro, «prender la planta» y saltos de casilla pagados. **No cuenta** las tiendas ni las pérdidas involuntarias. | ≥ 15 | Cantidad de pagos | MAPA |
| 6 | **Estrella Mochilera** | `regionesVisitadas` | Cantidad de **regiones distintas** (de 6) en las que el jugador **cayó** al menos una vez. Pasar por encima no cuenta. Un teletransporte sí cuenta si termina en una casilla. | ≥ 4 | Ciudades o hitos distintos visitados | MAPA |
| 7 | **Estrella Caminante** | `casillasDado` | Suma de casillas recorridas **con el dado**, contando los dados extra de objetos. **Excluye** teletransportes, transporte (camionetica, ferry, teleférico) y empujones de eventos. Un mismo objeto suma como máximo 12 por turno (anti-truco). | ≥ 5 × turnos | Mayor tirada individual | MOVIMIENTO |
| 8 | **Estrella Morrocoy** (la más lenta) | `sumaDados` (menor gana) | Suma de las tiradas del dado base. Los objetos de dado no cuentan para no premiar las trampas. | ≤ 4,5 × turnos | Menos casillas totales recorridas | MOVIMIENTO |
| 9 | **Estrella Ladilla** (Mala suerte) | `casillasMalas` | +1 por caer en LADILLA (roja), apagón, alcabala de castigo o cualquier casilla marcada `mala`. Las trampas puestas por rivales cuentan aparte, en la #14. | ≥ 3 | Monedas perdidas en esas casillas | DESGRACIA |
| 10 | **Estrella Chismosa** (Eventos) | `casillasEvento` | +1 por caer en una casilla de evento (`?`/`!`, Deltamacura, «Ahorita»). | ≥ 3 | Eventos distintos vividos | MAPA |
| 11 | **Estrella Peleona** (Ataques) | `ataquesAcertados` | +1 por cada objeto o acción de ataque que **afecta** a un rival: le quita monedas, lo mueve o le roba. Si un ataque afecta a varios, cuenta una vez por víctima, con un máximo de 3 por uso. Los fallos y los ataques a uno mismo no cuentan. | ≥ 3 | Monedas quitadas en total | INTERACCIÓN |
| 12 | **Estrella Pana** (Equipo) | `victoriasEquipo` | +1 por cada ronda **ganada como parte de un equipo**: 2v2 del Relámpago, trío del 1v3, Épico 2v2 o trío del GPS. | ≥ 2 | Puntos H2H aportados en esas rondas | HABILIDAD |
| 13 | **Estrella del Llanero Solitario** | `victoriasSolo` | +1 por cada 1v3 ganado como solitario o duelo ¡PLEITO! ganado. | ≥ 2 | Rondas jugadas como solitario (más es mejor) | HABILIDAD |
| 14 | **Estrella Remontada** | `remontada` | Al final de **cada** turno se guarda el puesto de cada jugador (por estrellas y luego monedas). `remontada = peorPuesto − puestoAntesDeLaCeremonia`. | ≥ 2 puestos | Turno más tardío en que tocó su peor puesto (el que remontó más tarde gana) | NARRATIVA |
| 15 | **Estrella Metía de Pata** (solo puede ser la oculta) | `metidasDePata` | +1 por cada microjuego perdido **por acción** y no por tiempo (salida en falso, tocar la trampa, tocar en la ola roja), más +1 por caer en una trampa puesta por un rival. Se detecta por `why` del juego o por una etiqueta `falso`. | ≥ 4 | Microjuegos perdidos en total | DESGRACIA |

**Mazo de la oculta («del pueblo»):** solo #15 Metía de Pata, #9 Ladilla, #8 Morrocoy y #14 Remontada. Son las de ayuda al que va atrás y las de chiste, porque si algo va a ser sorpresa tiene que dar risa.

La Remontada no se puede perseguir a propósito, y por eso es la oculta más justa.

### 5.3 Reglas contra empates

Se aplican en este orden, para **cada** estrella:

1. **Umbral:** si el mejor no alcanza el umbral, la estrella **no se entrega** («¡Nadie se la ganó, chamo!»). Un 0 nunca gana.
2. **Desempate secundario:** el de la tabla.
3. **Si sigue el empate entre 2:** **los 2** reciben la estrella, como manda la tradición de la serie.
4. **Si sigue el empate entre 3 o 4:** **nadie** la recibe. Es la excepción de los modos competitivos de la serie (por verificar el detalle por juego); con 3 o 4 empatados, la estrella no distingue a nadie. Se anuncia «**SE REPARTIÓ Y NO ALCANZÓ**».
5. **Empate final de la partida** (mismas estrellas y mismas monedas después de la ceremonia): en vez de tirar el dado, se juega **¡MUERTE SÚBITA!**, un microjuego `H`, mano a mano, con la misma semilla para los dos y orden de tirada al azar. Si vuelven a empatar, se juega otro, hasta un máximo de 3. Si sigue el empate después de eso, se tira el dado clásico.

### 5.4 Reglas contra el premio doble injusto

1. **Grupos de correlación.** Al sortear las estrellas visibles y la oculta, **nunca salen dos del mismo grupo** (HABILIDAD, ECONOMÍA, MOVIMIENTO, MAPA, DESGRACIA, INTERACCIÓN, NARRATIVA). Así se evita que el mismo talento cobre dos veces: Billetuda y Bachaquera miden casi lo mismo; Caminante y Morrocoy son opuestos, y si salieran juntas se cancelarían.
2. **Excepción de MAPA:** el grupo MAPA puede dar 2 estrellas, porque Mochilera y Peajera premian conductas distintas (explorar y pagar por interactuar). Aun así, nunca salen juntas la Peajera y la Chismosa.
3. **Tope por jugador:** nadie recibe más de **2** estrellas extra en una partida. Si alguien tuviera derecho a una 3.ª, esa estrella pasa al **siguiente** en ese contador, siempre que alcance el umbral. Si nadie lo alcanza, no se entrega.
4. **Sin doble conteo entre contadores:**
   - Los Épicos **no cuentan** en `microGanados`, solo en `pe`.
   - Los duelos ¡PLEITO! cuentan en `victoriasSolo`, no en `microGanados`.
   - Las monedas robadas cuentan en `monedasGanadas` del ladrón, pero **no** en `ataquesAcertados` como monedas: ahí suman 1 por víctima.
   - Una trampa de un rival cuenta en `metidasDePata`, nunca en `casillasMalas`.
5. **Protección contra la bola de nieve (opcional, activada en Normal):** al sortear las visibles, el mazo **reduce a la mitad el peso** de las estrellas que, simuladas con las estadísticas del turno 5, irían al líder de ese momento. Es un sesgo suave, no una exclusión, y en Pro está apagado.
6. **No se puede perseguir una estrella con trampas fáciles:** en las que premian «lo malo» (Ladilla, Morrocoy y Metía de Pata) el umbral **y además** el desempate deben ser involuntarios. Nadie puede tirarse a una casilla roja con un objeto de dado exacto para sumar Ladilla: las caídas forzadas con un **dado a elección** no cuentan.

### 5.5 Esquema de estadísticas (para implementar)

```js
// Se crea al empezar la partida, uno por jugador. Nunca se resta nada salvo donde se indica.
stats[i] = {
  microGanados: 0,      // ½ en empates H2H
  prTotal: 0,
  pe: 0, golpesFinales: 0, epicosGanados: 0,
  monedasGanadas: 0, maxMonedas: 0,
  objetosComprados: 0, monedasTienda: 0,
  monedasInteraccion: 0, pagosInteraccion: 0,
  regiones: new Set(), hitos: new Set(),
  casillasDado: 0, maxTirada: 0, sumaDados: 0,
  casillasMalas: 0, monedasPerdidasMalas: 0,
  casillasEvento: 0, eventosDistintos: new Set(),
  ataquesAcertados: 0, monedasQuitadas: 0,
  victoriasEquipo: 0, puntosH2HEquipo: 0,
  victoriasSolo: 0, rondasSolo: 0,
  puestoPorTurno: [],   // para la Remontada
  metidasDePata: 0, microPerdidos: 0,
};
// Ganchos (cada uno es una línea en el código que ya resuelve el evento):
//  onCoins(i, +n, fuente)  → si n>0: monedasGanadas+=n; maxMonedas=max(...)
//  onMicro(i, {result, t, dur, why}) → prTotal, microGanados/microPerdidos, metidasDePata si why∈FALSO
//  onLand(i, casilla)      → regiones, hitos, casillasMalas/Evento
//  onRoll(i, dado, base)   → sumaDados (solo base), casillasDado (con tope de 12 por objeto)
//  onPay(i, n, tipo)       → tienda | interaccion
//  onHit(atacante, victima, monedas) → ataquesAcertados (máx. 3 por uso), monedasQuitadas
//  onTurnEnd()             → puestoPorTurno.push(puesto)
```

Detalle de `metidasDePata`: los juegos del repo ya escriben `why` (el texto del sello). El modo fiesta mantiene una lista `FALSO` de los `why` que significan «actuaste antes de tiempo» o «tocaste lo que no era». En la primera versión se arma a mano para los 42 juegos. Si un juego no está en la lista, sus derrotas cuentan en `microPerdidos` pero no en `metidasDePata`.

---

## 6. Presupuesto de tiempo y de monedas de una partida tipo

**Partida Normal de 12 turnos, 4 humanos, relevo (fase 1):**

| Bloque | Por ronda | × rondas | Total |
|---|---|---|---|
| Turnos del tablero (4 × unos 35 s, con animaciones que se pueden adelantar) | 2,3 min | 12 | 28 min |
| Relámpago (promedio de la sección 2.4) | 2,2 min | 12 | 26 min |
| Épico (unos 110 s + 20 s de intro y podio) | 2,2 min | 3 | 6,5 min |
| Ceremonia final | — | 1 | 1,5 min |
| **Total** | | | **unos 62 min** |

Con simultáneo (fase 2): unos 46 min. **«Partida corta» de 8 turnos:** unos 40 min en relevo, con 2 Épicos (rondas 4 y 8). Para un relevo con 4 en teléfono se recomienda esta como **opción por defecto**.

**Monedas que entran a la mesa por la vía de los minijuegos (P = 20, 12 turnos):**

| Fuente | Valor esperado por ronda | Total |
|---|---|---|
| Relámpago (0,25·20 + 0,26·18 + 0,49·≈12) | ≈ 15,6 | ≈ 187 |
| Relámpago en dólares (turnos 5 y 10, ×2) | +15,6 × 2 | +31 |
| Épicos (≈ 31 + 31 + 46 en la final) | — | ≈ 108 |
| **Total por minijuegos** | | **≈ 326 monedas ≈ 16 P** |

En promedio, unas **4 estrellas compradas por jugador** salen de los minijuegos. A eso se suman las casillas del tablero. Esto está en el rango de la serie: en partidas de 20 turnos el ganador suele terminar con 4 a 8 estrellas (por verificar). Si el documento de economía quiere estrellas más escasas, se baja el pozo base del Relámpago al **75 % de P** y se dejan los porcentajes como están.

**Peso de las estrellas extra:** con 2 o 3 estrellas extra contra unas 4 a 6 estrellas compradas por el ganador, las extra pueden cambiar el 1.º puesto **solo en partidas cerradas**. Es el efecto que se busca: drama sin borrar el esfuerzo.

---

## 7. Plan de construcción por fases

| Fase | Entregable | Depende de |
|---|---|---|
| **0** | `PARTY.semilla`, `PARTY.medir`, la pantalla de traspaso y el cálculo de PR | Nada |
| **1a** | Relámpago en relevo, todos contra todos y mano a mano, con los 42 juegos y etiquetas en un `CATALOGO` | Fase 0 |
| **1b** | Estadísticas y ceremonia de Estrellas del Cierre | Tablero mínimo |
| **1c** | `PARTY.input` (4 esquinas, `pointerId`, teclas Q/P/Z/M) y el Épico **Catatumbo** | Plantilla del transformador |
| **2a** | Épicos Salto Ángel y Deltamacura | 1c |
| **2b** | Versiones S4 de `tequenos`, `inscribe`, `llego`, `hueco`, `chancla` y `baile`, y Relámpago simultáneo | 1c |
| **2c** | 8 microjuegos nuevos simultáneos (sección 4.4) | 2b |
| **3** | Bots de fiesta en `probar.js` (T con slot) y pruebas de la ceremonia | 1b |
| **4** | Juego en línea (salas de PocketBase del motor clásico) | Puente entre los dos motores |

---

## 8. Riesgos y pendientes (por verificar)

1. **La duración del relevo con 4 en teléfono** es la mayor amenaza para el ritmo. Mitigaciones: partida corta de 8 turnos por defecto, formatos de equipo más cortos, y la opción **«Relámpago de 3»** (fuera de lo que pidió el usuario, solo como ajuste de accesibilidad).
2. **`AGUANTE` y empates:** los 5 juegos que solo se ganan al agotar el tiempo necesitan una `margen` en `probe()` para ordenar mejor. Hay que revisar juego por juego.
3. **`baja`, `encaleta` y `agarrate`:** se catalogaron por sus `hint` y por el nombre. Su verbo exacto está **por verificar** abriendo el código.
4. **El ghosting del teclado** con 4 jugadores (8 teclas) hay que probarlo en hardware real. Los Épicos de 1 botón reducen el riesgo.
5. **Los umbrales de las estrellas** (≥ 40 monedas, ≥ 5 microjuegos, etc.) están calculados para 12 turnos. Conviene escalarlos linealmente con los turnos, salvo los umbrales de conteo pequeño (≥ 2 o 3), que no se escalan.
6. **Datos de la serie (por verificar):** el reparto exacto del pozo de batalla de MP6 (70/25/5/0) frente al de Superstars (70/20/10/0); la regla de «empate de 3 o más = nadie» en cada juego, que el wiki solo documenta para Battle Royale, Tag y DS Duel; las estrellas típicas del ganador en partidas de 20 turnos; y la cantidad exacta de estrellas extra en MP DS.
7. **El tono de Deltamacura:** revisarlo con el usuario. El lugar es el chiste («no existe en el mapa»), nunca la comunidad warao.
8. **El árbol de trabajo está sucio** (rama `codex/mobile-controls-easter-eggs`, unos 48 archivos modificados). El modo fiesta debería empezar en archivos nuevos (`fiesta.html`, `fiesta-*.js`, `juego-f-*.js`, ver doc 06) y tocar `campana.js` lo menos posible: solo un botón en el menú del mundo Venezuela.
