# M3 · Compensación de lag del modelo C (diseño) — 2026-10-17

Alcance: jugabilidad de los juegos **modelo C / Ceq** (el juez simula) en `fiesta-live.js`; caso de prueba `f_futbolito` 2v2; solo estilo `snes`.
Todo número de este documento sale de **ejecuciones reales** del arnés de red (`test/helpers/live-arnes.js`, 4 bots `skill .6`, semillas 9001…, `lv = 1 + s%3`, cuota = victorias del bando del **juez final**). Los oráculos se hicieron **sin tocar el repo** (envolviendo canales y `c` desde un script; ver §9).

---

## 0. Veredicto corto

1. **Por qué gana el juez:** el lazo de un no-juez («veo → pulso → el juez lo aplica») mide **L = V + A ≈ 0,39 / 0,90 / 1,60 s** (mediana, 50/150/300 ms, sin pérdida). V es la edad de la vista y A el tránsito de la entrada. El juez ve el mundo en vivo y su entrada solo se retrasa `fairDelayEq` ≤ 0,28 s, y ese retraso **cae a 0** el 5-23 % del tiempo. Además, la predicción del cuerpo propio del no-juez se reconcilia contra un cuerpo con V de atraso, así que el no-juez «se ve» donde estaba hace V (§1).
2. **La compensación de lag sola (rebobinar la entrada remota a la hora en que se pulsó) NO alcanza la meta**, ni siquiera ideal y sin tope: **34 / 59 / 81 %**. Sobrecompensa a 50 ms y falla a 300 ms. Rebobinar la entrada borra A, pero no V, y a ≥150 ms V domina (§2).
3. **Diseño propuesto (runtime, reutilizable por todo C):**
   - (a) **entradas selladas + rebobinado acotado** en el juez (lo decidido);
   - (b) **vista justa del juez**: su pantalla y su jugador ven el mundo con la misma edad V que sus rivales. Sustituye a `fairDelay`;
   - (c) **`c.lag()`** exacto;
   - (d) en el juego, **reconciliar la predicción propia contra el mismo tick del snapshot**.

   Oráculo de (a)+(b)+(c)+(d), 200 semillas: **55,5 / 60,0 / 61,5 %** sin pérdida y **42,0 / 57,5 / 44,5 %** con 5 %. El oráculo favorece al juez a propósito (le da su cuerpo exacto, §2). Queda en la raya: la puerta de 200 semillas lo decide.
4. **Respaldo** si la puerta falla o si se rechaza la vista justa: F calibrado con predicción propia en el juez, «empujón» de patada predicho (solo sensación), quitar los C de la bolsa con relé lento y los arreglos de transporte (§7).

---

## 1. Causa raíz (medida)

### 1.1 Componentes del lazo
Edad de la vista V = `k_juez − k_vista`. Tránsito de la entrada A = desde que el emisor encola `i` hasta que llega al juez. Seis partidas por celda, unas 110 muestras por partida.

| retardo | pérdida | V med | V p90 | A med | A p90 | **L med** | RTT relé (`net.rtt`) |
|---|---|---|---|---|---|---|---|
| 50 | 0 | 233 | 333 | 155 | 255 | **388** | — |
| 50 | 5 % | 867 | 2800 | 180 | 1288 | **1047** | — |
| 150 | 0 | 567 | 733 | 331 | 455 | **897** | 643-750 |
| 150 | 5 % | 667 | 2633 | 372 | 1080 | **1038** | — |
| 300 | 0 | 967 | 1300 | 636 | 1056 | **1603** | — |
| 300 | 5 % | 1033 | 1967 | 660 | 1382 | **1693** | — |

Mientras tanto, el juez retrasa su entrada `fairDelayEq` = min(0,5; 2·min(0,12; RTT/2) + 0,04) = **0,28 s como máximo práctico**. Y `fair()` vale **0 en el 5-23 %** de las muestras.

### 1.2 Las cinco causas
- **C1 · Acción (A).** La entrada remota llega A tarde y se aplica al llegar. El carril `l` de `fiesta-net` admite **un solo lote en vuelo**, y `i` es *latest*: espera de media un ciclo HTTP completo. Así A ≈ 2,9·retardo.
- **C2 · Percepción (V).** El no-juez dibuja el último snapshot, no `gt − D`: la edad del snapshot (≈ 2,9·retardo) supera siempre a `D_MAX` (0,25 s). En el relé, el snapshot `s` (*latest*) sale **uno por ciclo del carril**, unas 2-3 veces por segundo a 150 ms. Además, una petición perdida bloquea el carril hasta 2,5 s: es la cola p90 de 2-3 s con pérdida. `extrapolaPelota` corrige la pelota que rueda libre, no los toques recientes.
- **C3 · Cuerpo propio mal reconciliado (juego).** `predict()` compara la posición predicha **de ahora** (`mp`) con el cuerpo del snapshot, que tiene **V de atraso**. Corriendo a 150 px/s con V = 0,57 s el error es de 85 px, mayor que 60, y salta al cuerpo viejo. Entre 26 y 60 px tira 8 px por cuadro hacia atrás. Resultado: el no-juez se ve donde estaba hace V.
- **C4 · `fairDelay` frágil.** El tope `FAIR_MAX` se aplica *antes* de doblar. `net.rtt(id)` depende de `_net_pong`, que es *latest* y del mismo tipo para todos los que preguntan: en el carril ocupado, el pong a un asiento sustituye al pong a otro, la muestra caduca (4 s) y `fair()` vale 0. Ese rato el juez juega **sin retraso**.
- **C5 · Bytes perdidos.** En C, el juez envía su propio `i` (`envioI`) aunque nadie lo consume. Ocupa el mismo carril que sus `s`.

### 1.3 Línea base, 200 semillas, árbol actual

| pérdida | 50 ms | 150 ms | 300 ms |
|---|---|---|---|
| 0 | 59,0 % | **87,0 %** | **90,5 %** |
| 5 % | **72,5 %** | **67,5 %** | 59,0 % |

Los 82,5 / 95,5 / 98,5 % del encargo salen de otra corrida, pero el orden es el mismo. Con pérdida la cuota «baja» por dos motivos. Casi todas esas partidas migran de juez (M4 §2), así que el juez final solo lo fue una parte del partido. Y la pérdida estropea también al juez. **Ningún arreglo se valida solo con las celdas con pérdida.**

---

## 2. Oráculos: qué mueve la aguja

80 semillas, sin pérdida (σ ≈ 5,5 pp), salvo la última fila.

- «A = 0»: la entrada llega al juez al instante, que equivale a un **rebobinado ideal, sin tope, a la hora de pulsar**.
- «c.lag»: `c.lag()` exacto para `extrapolaPelota`.
- «F»: retraso fijo de la entrada del juez.
- «VP» (vista justa): el bot del juez decide sobre el **estado que ve un no-juez**. Se copia con `pack/restore` y se le pone el cuerpo propio vivo.
- «pred»: `predict()` reconciliado contra la historia propia en el tick del snapshot (§4).

| configuración | 50 | 150 | 300 |
|---|---|---|---|
| base (F real ≈ 0,28, con caídas a 0) | 60,0 | 85,0 | 92,5 |
| base, F = 0 | — | **100** | — |
| c.lag | 58,8 | 83,8 | 92,5 |
| **A = 0** (lag-comp ideal) | 42,5 | 65,0 | 78,8 |
| **A = 0 + c.lag** | 33,8 | 58,8 | **81,3** |
| A = 0 + c.lag, F = 0 | 90,0 | 95,0 | — |
| A = 0 + c.lag, F fijo | F .10 → 61,3 | F .20 → 71,3 · .35 → 58,8 · .40 → 51,2 | F .30 → 75,0 · .60 → 53,8 · .90 → 51,2 |
| A = 0 + c.lag + pred (F real) | 28,7 | 50,0 | 71,3 |
| sin compensar entrada, c.lag, F .40 | — | 63,7 | — |
| VP (cuerpo propio viejo, como hoy los no-juez), A = 0, F = 0 | 68,8 | 50,0 | 46,3 |
| **VP + pred + A = 0, F = 0** | 60,0 | 55,0 | 55,0 |
| **propuesta, 200 semillas, 0 % pérdida** (VP + pred + c.lag + A = 0; a 300 ms un residuo fijo de 150 ms = A − tope) | **55,5** | **60,0** | **61,5** |
| propuesta, 200 semillas, 5 % pérdida | 42,0 | 57,5 | 44,5 |

Lectura:
1. **Rebobinar la entrada es necesario pero no suficiente.** Vale unos 12 pp a igual F, pero deja la ventaja de percepción, que a 300 ms es casi toda.
2. El arreglo de percepción funciona igualándola, no con un retraso «a ojo». F tendría que ser ≈ 0,12 / 0,40 / 0,60 s. Con pérdida el número cambia (las detenciones de 2,5 s), así que una F fija sobrecompensa a 50 ms (34 %) y se queda corta a 300 ms. VP iguala **por construcción**, a cualquier retardo y pérdida.
3. **El oráculo de la propuesta está sesgado a favor del juez:** le da su cuerpo exacto, mientras los rivales usan `predict`. En el diseño real, el juez ve con el **mismo** `predict` que ellos. Se espera ≈ 50 %, pero solo lo confirma la puerta de §6.
4. Con pérdida aparece **sobrecompensación** (42 / 44,5 %): la puerta necesita también un **piso**.

---

## 3. Mecanismo en el runtime (`fiesta-live.js`, solo `esC`)

Dialecto ES5 (cabecera del archivo). Sin `Math.random` ni `Date.now` en la lógica. Solo se toca la rama `esC`: A y B no cambian. No se tocan `fiesta-lobby.js` ni `fiesta-ui.js`.

### 3.1 Entradas selladas (sustituye el `i` actual en C)
- **Cuadro de entrada.** `S.in.down/up/tap/axis` generan un cuadro **en el momento del evento**, no a la cadencia de envío: `[n, t, b, x, y, ta, tb]`.
  - `n`: número de cuadro del asiento, creciente.
  - `t`: `gt` en ms de reloj de servidor **al pulsar**.
  - `b, x, y, ta, tb`: el estado como hoy (`ta`/`tb` acumulados).
  - Hay un cuadro nuevo solo si cambian `b`/`ta`/`tb` o el eje en ≥ 0,1, y como máximo uno por tick de 1/30 s.
- **Mensaje `i` en C:** `{q, f: [cuadros], v}`.
  - `f`: los **últimos ≤ 8 cuadros** cuyo `t` esté dentro de los últimos `REW_MAX` (redundancia), codificados en delta (`n0` y luego `Δt`).
  - `v`: la vista propia, `c.lag()` en ms (lo usa §3.3).
  - Tamaño: ≤ 300 B (8 × ~30 B + sobre). Cabe en `MSG_MAX` 420 y en el lote de 512 B.
  - Se sigue enviando *latest* a `I_HZ`, con latido a `I_KEEP_HZ`.
- **Arreglos de paso.**
  - Con cuadros, «mantener y soltar dentro de un ciclo del carril» ya no se convierte en un toque (hoy el tiro cargado degenera en pase a 300 ms).
  - El juez **no envía `i`** en C (C5).

### 3.2 Rebobinado acotado en el juez
- **Estado guardado.**
  - Anillo `hist[k]` = `{pack: g.pack(), cons: [[ca, cb]…]}` **antes** de cada `step` vivo, `REW_MAX/FIJO + 1` entradas.
  - Bitácora de entrada `log[p][k]` = lo que vale `c.held/c.tap/c.eje` del asiento p en el tick k: humanos remotos, el juez y **las CPU**, que se graban, no se recalculan.
- **Tick de aplicación** de un cuadro con hora `t`:
  `ka = max( tick(t), kAhora − REW_T, kFirme, kUltimo[p] )`, con `REW_T = REW_MAX·30`.
  - `kUltimo[p]` lo hace monótono por asiento: un cuadro tardío nunca queda antes que uno ya aplicado del mismo asiento.
  - `t` mayor que `gt` del juez se recorta a `kAhora` (no hay entradas del futuro).
- **Por cuadro de pantalla:**
  1. Se ingieren los `i` llegados. Se deduplican por `n`, se aplica el balde de `TOQUES_MAX` según el `Δt` sellado y se escriben en `log` desde `ka`. Se anota `kMin`.
  2. Si `kMin < kAhora`: `g.restore(hist[kMin].pack)`, se restauran `cons` y se re-ejecuta `step` de `kMin` a `kAhora − 1` leyendo **solo** de `log`. Se hace **un único rebobinado por cuadro**, al menor `kMin`.
  3. Siguen los ticks vivos de siempre: CPU `ai` → se graba en `log` → `step` → `hist`. `envioS` solo en ticks vivos, nunca en el re-paso.
- **Puntos firmes** (`kFirme`): el veredicto (`terminar`/`S.over`), la restauración tras migrar (`promover`) y el cambio humano↔CPU de un asiento (solo para ese asiento). No hace falta un gancho del juego para los goles, porque el rebobinado es invisible (ver abajo). Gancho opcional `g.firme()` para juegos con efectos externos irreversibles.
- **Tope `REW_MAX` = 0,5 s (15 ticks).** Cubre A mediana en las tres celdas y A p90 hasta 150 ms. Lo que exceda se aplica en `kAhora − REW_T`: es un residuo, y §3.3 lo compensa.
- **El rebobinado es invisible** mientras `A ≤ V`: las correcciones caen en ticks que **nadie ha visto todavía**, porque todos, el juez incluido (§3.3), ven el mundo V atrás. Medido: V/A ≈ 1,5-1,7 en todas las celdas. Esto incluye goles «deshechos» por un despeje que llegó tarde: nadie los había visto.
- **Coste.** Re-paso de ≤ 15 `step` por cuadro en el peor caso. Las llegadas vienen por lotes, unas 2-9 al segundo según el retardo. Para futbolito son microsegundos. Un juego pesado puede declarar `rebobina: false` y queda solo con §3.3.

### 3.3 Vista justa del juez (sustituye a `fairDelay` en C)
- **Dos instancias en el juez:**
  - `gs = def.mk(c)`: la simulación. Solo `step/pack/restore/ai/scores/done`. Nunca dibuja.
  - `gv = def.mk(cv)`: la vista. Es exactamente lo que corre un no-juez: `unpack` + `predict` + `update/draw`.
  - `cv` = `c` con `juez() → false`, `lag() → Vref` y `rng` propio (`rngFor('vista')`), para no consumir `c.rng`.
  - `S.g` apunta a `gv`, que es lo que dibujan la UI y los bots del arnés. `terminar/scores/done/pack` usan `gs`.
- **Qué ve el juez.** El juez guarda en `snaps` sus **propios** `s` enviados: el búfer sube a 32. `gv` los interpola en `gt − Vref` con el `vistaSnap()` de siempre.
  - `Vref` = mediana, en los últimos 3 s, de los `v` informados por los **rivales humanos**. Es la misma selección que `fairDelay` (DM3-16: el compañero y las CPU no cuentan).
  - Sin rivales humanos, `Vref = 0` y `gv` se omite (`S.g = gs`): **práctica y `LIVE.sim` quedan bit a bit iguales**.
- **Tiempo de vista monótono.** `Vref` cambia como máximo 0,5 s por segundo. La vista corre entre 0,5× y 1,5×: nunca va hacia atrás.
- **La entrada propia del juez** se aplica a `gs` en su hora, como la de cualquiera. Solo se retrasa el **residuo** `Fres` = mediana entre rivales de `max(0, A_p − REW_MAX)`, con `A_p = llegada − t` medido en los sellos. Se usa la línea `ownHist/refreshOwnView` que ya existe. Hoy `Fres` ≈ 0-0,15 s.
- **`net.rtt` deja de intervenir en C.** Eso arregla C4.
  - `fairDelay()` y `S.fair()` **se conservan** como función de selección de rivales: `test/fiesta-teams.test.js:303-309` sigue en verde.
  - Se añade `S.justo() → {vref, fres}` para las pruebas.
- **Por qué es correcto.** Todo humano reacciona a un mundo de edad ≈ V y su acción cuenta desde que la pulsó. Eso es igualdad por construcción, sin coeficientes ajustados. El precio es que **el juez juega con el retraso de sus rivales**: con relé a 150 ms ve el mundo ~0,57 s atrás, con su cuerpo predicho como cualquiera. En P2P o con 50 ms, V ≈ 0,1-0,25 s.

### 3.4 `c.lag()`
- En un no-juez: `gt − t(snapshot dibujado)/1000`, exacto.
- En `gv` del juez: `Vref`.
- En `gs`: 0.

Sustituye la estimación ×0,5 de `lagVista` (el juego ya lo prefiere si existe).

### 3.5 Orden y pérdida
- **Desorden:** cada cuadro trae `n` y `t` propios; el juez inserta por tick. Un `i` viejo que llega después de uno nuevo solo aporta cuadros que faltaban.
- **Pérdida:** cada `i` repite los ≤ 8 cuadros recientes, así que el siguiente `i` (≤ 0,25 s por latido) recupera lo perdido. Si llega pasado `REW_MAX`, entra recortado y es residuo. Los toques nunca se pierden (`ta`/`tb` acumulados).
- **Detención del carril** (2,5 s por petición perdida): todo llega tarde. Se recorta, y `Fres` y `Vref` lo absorben porque se miden de los sellos. El arreglo de verdad es de transporte (§7.4).
- **Trampa:** un emisor puede antedatar `t` hasta `REW_MAX`. Está acotado y se acepta «entre panas», igual que DM3-9. Se puede comprobar `t ≤ gt_juez`.

### 3.6 Determinismo
- **CPU:** `ai` corre una sola vez por tick vivo en `gs` y su salida se graba en `log`; el re-paso **no** la vuelve a llamar. Los flujos `rngFor('cpu'+p)` se consumen igual con o sin rebobinados, y la decisión de una CPU es función de la corrida viva.
- **`step` debe ser puro respecto del runtime:** sin `c.send/ev/claim/out` ni sonido. Los efectos salen de diferencias de estado en `update()`, y futbolito ya cumple. El re-paso es exacto porque `pack/restore` ya debe ser exacto por contrato (migración).
- **Resultado de las demás pantallas:** no cambia nada. El veredicto lo emite solo el juez (`end` + `h`), los demás lo adoptan, y el servidor no ve nada nuevo.
- **Migración:** el juez nuevo crea `gs` desde `lastSnapRaw` (`kFirme = k` restaurado) con `hist` y `log` vacíos. Su `gv` es la instancia que ya tenía como no-juez.
- **Práctica y `LIVE.sim`:** sin entradas remotas y con `Vref = 0`, se comportan igual que hoy, con los mismos `h`. Es una puerta (§6).

### 3.7 Constantes nuevas en `K`
- `REW_MAX: 0.5`
- `FRAMES_I: 8`
- `VREF_VEL: 0.5`
- `SNAPS_MAX: 32`

`FAIR_MAX`, `FAIR_TEAM_MAX` y `FAIR_TEAM_BASE` siguen solo para la selección y las pruebas de `S.fair()`.

---

## 4. Cambios mínimos del juego (`fiesta-juego-futbolito.js`)

1. **`predict()` reconcilia contra la historia propia** (C3).
   - Se guarda `mh` = `{t: c.ahora(), x, y}` de `mp` por cuadro, unos 4 s.
   - Se compara el cuerpo del snapshot con `mh` en `t ≤ st.k/30`, **el mismo tick**, en vez de con `mp` de ahora.
   - El error se aplica en suave: > 90 px salta y entre 10 y 90 px mueve ≤ 4 px por cuadro, desplazando también `mh`.
   - Ya probado en el oráculo: es la diferencia entre 58,8 y 50 % a 150 ms.
2. `lagVista` ya usa `c.lag()` si existe. Hay que subir `LAG_MAX` de 0,6 a 1,0 s: con pérdida, V p90 pasa de 2 s y hoy se topa.
3. Nada más es obligatorio:
   - `mk` ya se puede llamar dos veces (sin estado de módulo mutable);
   - `step` ya es puro;
   - `pack/restore` ya son exactos;
   - `c.juez()` falso en `gv` hace que `posOf/predict` usen el camino de no-juez.

   Hay que quitar el «LÍMITE CONOCIDO» de la cabecera cuando pase la puerta.
4. Opcional, solo sensación: un **«empujón» predicho** al patear (§7.2).

## 5. Cómo se generaliza a otros C (`f_vagon`, `f_bolas`, `f_cuerda`, jefes, `Ceq`)

El mecanismo vive entero en el runtime. Un juego C lo obtiene gratis si cumple el **contrato C**, que `LIVE.add` comprueba donde pueda:
- `pack/restore` exactos y completos.
- `step` determinista y puro, que lee la entrada solo con `c.held/c.tap/c.eje`.
- `mk(c)` reentrante, con el estado solo en el cierre.
- La lógica de juez solo dentro de `step`.
- `predict` que reconcilia contra el tick del snapshot. Se puede ofrecer `c.util.historiaPropia()` para no copiar el patrón.

Opciones de salida:
- `rebobina: false`: solo vista justa, para juegos de `step` caro.
- `vistaJusta: false`: no recomendado, deja el juez con ventaja.

---

## 6. Plan de pruebas

### 6.1 Núcleo, con el `net` falso de `test/fiesta-live-core.test.js`
- **Equivalencia:** la misma línea de entradas entregada a tiempo o tarde (A ≤ `REW_MAX`) da la **misma secuencia de `pack()`** tick a tick.
- **Recorte:** pasado el tope, el cuadro entra en `kAhora − REW_T`. La aplicación es monótona por asiento. Un `t` futuro se recorta a `kAhora`.
- **Duplicados, desorden y un `i` perdido** dan el mismo resultado, porque la redundancia recupera los cuadros.
- **Sin efectos en el re-paso:** ningún `c.send/ev/claim` (espía) y ningún `s` con `t` pasado.
- **Toques:** `cons` se restaura bien, incluso con un juego que lee `tap` de forma irregular. «Mantener y soltar» en un solo lote sigue siendo un tiro.
- **CPU:** mismo número de extracciones de `rngFor('cpu'+p)` con y sin rebobinados.
- **Firmes:** no hay rebobinado tras `terminar`. Tras migrar, `hist` y `log` empiezan vacíos y los cuadros previos se recortan.
- **Vista justa:** `gt − Vref` monótono cuando `Vref` salta. `Vref` ignora compañeros y CPU. Sin rivales humanos, `S.g === gs`.
- **Tamaños:** un `i` con 8 cuadros ocupa ≤ 300 B y el lote ≤ 512 B.
- **Golden:** `LIVE.sim(f_futbolito/f_patilla/…)` y `practice` dan **los mismos `h`** que antes del cambio. Se graban 50 semillas **antes** de implementar.

### 6.2 Banco de red de 200 semillas (bloque I de `test/fiesta-equipos.test.js`, `LIVE_FULL=1`)
- **Celdas:** futbolito, 50/150/300 ms × pérdida 0 y 5 %, 200 semillas por celda, bots iguales, juez **final**.
- **Puerta:** bando del juez **≤ 58 %** (1/2 + 8 pp) en las 6 celdas.
  - **Piso ≥ 42 %** (sobrecompensación), que se informa siempre y se exige en las celdas sin pérdida.
  - Se informa también la cuota con empates a medias y el subconjunto **sin migración** (`mj.e = 0`), porque las celdas con pérdida están diluidas por las migraciones (§1.3).
- **Diagnóstico por celda:** V y A (mediana y p90), `Vref`, `Fres`, rebobinados por segundo, profundidad máxima, % de cuadros recortados y `step` re-ejecutados por segundo.
- **Al pasar:** se quita el `todo` del bloque I y el de `test/fiesta-live-futbolito.test.js:88`. El modo rápido (14 semillas, σ ≈ 13 pp) queda como guarda gruesa ≤ 75 %.
- **Patilla (B)** debe quedar igual: el bloque I de patilla sigue en verde.
- **Balance local sin cambios:** `node docs/style-lab/pruebas/fiesta-futbolito-bench.js` (simetría ±10 pp, 2-3 goles).

### 6.3 Regresión (todo en verde)
```
node --test test/fiesta-*.test.js test/duo.test.js test/squad.test.js test/party*.test.js
node pocketbase/pb_hooks/party.test.js
LIVE_FULL=1 LIVE_ADV_STRICT=1 node --test test/fiesta-equipos.test.js
```

---

## 7. Honestidad: límites y respaldo

1. **La compensación de lag sola no llega.** Medido con el rebobinado ideal sin tope: 34 / 59 / 81 %. Con `predict` arreglado, 29 / 50 / 71 %. Lo que queda es percepción, y por el relé HTTP V ≈ 2,9·retardo, más 2-3 s de cola con pérdida. Ninguna reescritura de entradas lo quita. Hace falta la **vista justa** (§3.3), y es parte del diseño, no un extra.
2. **Aun con todo, la meta está en la raya** a 150-300 ms: el oráculo sesgado da 60 / 61,5 %. Si la puerta falla, en este orden:
   - (a) **Arreglos de transporte** (reducen V y A para todos):
     - el carril `l` con ≤ 2 lotes en vuelo, dentro del tope de 20 peticiones por segundo;
     - no esperar 2,5 s a una petición perdida de un carril *latest*: reenviar a 1,5×RTT;
     - `_net_pong` sin coalescer entre destinatarios.
   - (b) **F calibrado** en vez de la vista justa: F ≈ 0,12 / 0,40 / 0,60 s, con el cuerpo del juez predicho. Da 51-61 % sin pérdida en el oráculo, pero sobrecompensa con pérdida. Solo si se rechaza que el juez vea atrasado.
   - (c) **Empujón de patada predicho:** el pateador aplica en su pantalla la velocidad de la patada en cuanto la pulsa y se reconcilia con el snapshot. Arregla la **sensación** (hoy la patada se ve L + V después), **no la equidad**, porque el veredicto es del juez.
   - (d) **Quitar los juegos C de la bolsa** cuando el transporte sea relé y el RTT mediano por relé supere unos 400 ms (≈ retardo 100 del banco). Con P2P (L ≈ 0,15-0,25 s) el diseño sobra.
3. **Coste para el humano juez:** juega con el retraso de sus rivales. Es lo justo, pero en relé a 300 ms se sentirá lento para todos. Se valida en 2 teléfonos reales (M3 §7 P1 sigue abierto).

## 8. Riesgos y preguntas
- Con `A > V` (un asiento con subida lenta y bajada rápida) las correcciones se ven: saltos de ≤ `REW_MAX`·velocidad. Mitigación: tope efectivo `min(REW_MAX, Vref)`.
- El oráculo VP copiaba la vista de **un** no-juez; el diseño usa la mediana de los rivales. Equivale en el banco, pero no se ha medido con asientos de latencias distintas.
- Hay que medir el coste del re-paso en móviles de gama baja con juegos C más pesados que futbolito.

## 9. Reproducir (scripts del oráculo; están en el scratchpad de la sesión y no en el repo, copiar a `docs/style-lab/pruebas/` si se quieren conservar)
`lazo.js <retardo> <pérdida> <N>` mide V, A y `fair`. `oraculo.js <modo> <retardo> <pérdida> <N>` acepta los modos base, lag, a0 y a0lag. `oraculoF.js …` añade F fijo (8.º argumento). `oraculoVP3.js` hace VP (`VP=1`, `VPSTALE=1`) y lee `GAME=<copia con predict reconciliado>` (`futbolito-pred.js`). Todos en `/private/tmp/claude-501/-Users-guillermomarin-Documents-GitHub-minigames/c0a60c80-758c-4f75-8473-c9cb9fb14c62/scratchpad/`.
