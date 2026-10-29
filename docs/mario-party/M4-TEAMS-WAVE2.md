# M4 · Equipos, ola 2: diseño (2026-10-17)

> Addendum de `M3-TEAMS-SPEC.md` (gana M3 en lo que toca). Es un **diseño**, no código: sale de dos informes de subagentes que leyeron 08, M3 y el catálogo, **sin leer** `fiesta-juego-cava.js` ni `fiesta-juego-alcabala.js` (otra sesión los está escribiendo). Los números de `lim` y las perillas son valores de partida: los confirma el banco de 200 semillas.

## Ola 2

| Formato | Juego | Modelo | Verbo de cooperación | Perilla de balance | Tamaño | Dueño |
|---|---|---|---|---|---|---|
| 2v2 | `f_cuerda` ¡HALA LA CUERDA! | C | sincronizar el tirón al compás | `DOBLE_MS` 120-160 | S | Área 4 |
| 2v2 | `f_hallacas` LÍNEA DE HALLACAS | B | pedir/pasar hoja por la cinta; B ayuda al pana | `TOL_MASA` | M | Área 4 |
| 2v2 | `f_cava` | B | (en curso en otra sesión) | por confirmar | ? | otra sesión |
| 1v3 | `f_guaya` ¡LA GUAYA DEL TELEFÉRICO! | B | agarrarse juntos durante el aviso | `AVISO` 0,35-0,90 s | S-M | Área 4 |
| 1v3 | `f_bono` ¡SE LE CAE EL BONO! | B | sándwich: dos periodicazos en 0,6 s | `SPD` 1,03-1,25 | M | Área 4 |
| 1v3 | `f_alcabala` | B | (en curso en otra sesión) | por confirmar | ? | otra sesión |

Fuera de la ola 2: `f_carrucha` (L, necesita el modelo Ceq que el runtime no tiene) y `f_silbon` (L, se solapa con alcabala; candidato de Halloween si sobra tiempo). Respaldos por si una falla: palo ensebado (cuerda), arepera (hallacas), polea del pozo (carrucha), la grúa (guaya), la cola del banco (bono), el cuatro del Silbón.

Con esto: 2v2 pasa de 1 a 4 juegos vivos y 1v3 de 1 a 4, así que `P.recientes` por fin rota.

## Reglas comunes (M3 §2)
- Veredicto solo por `compara`; `sc` entero ≥0 por asiento; `res.aj===false`.
- 1v3 de umbral: `sc[solo]=U·v`, `sc[trío]=U·H−U/2` (U par, sin empates). Cada juego da `hudChip` y `destacado()`.
- Sin `Math.random` (`c.rng`), ES2015 compatible con Goja, solo primitivas de dibujo, mensajes ≤420 B (`x*` ≤200 B).

## 2v2

### f_cuerda
Tira y afloja de playa con mecate: 3 tandas de 6 s, un tambor marca el compás. Se hala con A **al compás**; si los dos panas pulsan dentro de `DOBLE_MS`, el tirón vale doble; pulsar fuera de compás aturde 0,4 s. Un solo botón.
- **Modelo C**: el juez integra la posición de la cuerda a 30 Hz; cada pulsación viaja como `xtir{t}` con el reloj de quien pulsa y el juez ordena por `t`.
- **Puntaje**: `sc[seat] = 10·tandasGanadas + min(9, ventaja acumulada)`, igual para los dos del equipo. `lim` de partida `{scoreMax:39, scoreRate:1.4, minT:29, finTemprano:0}`. Empate de tandas lo decide la ventaja; si iguala, empate real.
- **Niveles**: 1 compás fijo 90 BPM; 2 charco de barro y compás 110; 3 síncopa de joropo sembrada y un falso tambor.
- **Gag**: «¡Halen, halen, que el compadre se está quedando!»
- **CPU**: pulsa al compás con jitter según skill; si su pana es humano intenta acompañarlo (prob. 0,5-0,85); nunca machaca.
- **Riesgo**: ventaja del juez en C. Mitigación: sello de tiempo del emisor + `DOBLE_MS` ancho + `fairDelay`.
- **Duda a resolver**: con `sc` igual en los dos del equipo, la suma duplica el valor; vale mientras `compara` sume por equipo (es simétrico), pero hay que probarlo con `clampSc`.

### f_hallacas
Cocina de diciembre: el masero extiende la masa (A sostenido/soltar, barra verde-rojo), el amarrador coloca el guiso (stick) y amarra (A al ritmo). Una cinta de 3 puestos los une; el amarrador **pide** el tamaño de hoja y el masero lo ve. **B** deja ayudar en la estación del pana por 0,5 s.
- **Modelo B**: cada línea es independiente (no hay objeto compartido entre equipos ⇒ sin ventaja de juez); la hallaca pasa por `xpasa`, la estación 2 reporta el puntaje de su equipo.
- **Puntaje**: `sc[masero]` = hallacas buenas que permitió su masa; `sc[amarrador]` = bien amarradas (la mal amarrada resta 1, mínimo 0). `lim` de partida `{scoreMax:16, scoreRate:0.45, minT:44, finTemprano:0}`. Desempate: menos hallacas malas.
- **Niveles**: 1 un tamaño, cinta lenta; 2 dos tamaños; 3 «¡LA TÍA PIDE 20 MÁS!» (+25 % de ritmo y nudo extra).
- **Gag**: «¡Esa hallaca quedó como regalo sin cinta!»
- **CPU**: masero 70-95 % del tamaño pedido con retraso 0,3-0,6 s; amarrador con error gaussiano; usa B si la cinta se vacía.
- **Riesgo**: que el amarrador cargue todo. Perilla `TOL_MASA`.

## 1v3

### f_guaya
El solo es el operario del teleférico del Ávila y sacude el cable; el trío cruza 3-5 tramos de ~140 px. A del trío = **agarrarse** (1,2 s, enfriamiento 3 s, mitad de velocidad): protege a quien agarra y a los panas a ≤40 px en el mismo tramo. El solo elige tramo con el stick y sacude con A (enfriamiento 1,5 s); la guaya tiembla `AVISO` s antes de soltar a los no agarrados, que vuelven a la torre.
- **Modelo B**: `xs{i,tr,tl}` (el solo; el juez si es CPU), `ev cae`/`ev cruzo` los manda la víctima, que juzga contra su propio agarre y el de sus panas (`remote()`, agarre <150 ms cuenta).
- **Puntaje (U=10, H=2)**: con `c` = cruzaron, `sc[solo]=10·(3−c)`, `sc[trío]=15`; el solo gana con `c ≤ 1`. `lim` de partida `{scoreMax:30, scoreRate:4, minT:6, finTemprano:1}`.
- **Perilla**: `AVISO` (base 0,6 s, piso 0,5 s con 300 ms de latencia); objetivo solo gana 38-52 %.
- **Niveles**: 3 / 4 / 5 tramos; el 3 con niebla del Ávila que oculta al trío lejano.
- **Gag**: «¡Agárrate, mi vida, que la guaya no tiene seguro de vida!»

### f_bono
El solo acaba de cobrar el bono (30 monedas) y tres bachaqueros lo persiguen con un periódico. El solo corre 12 % más rápido y salta con A (0,5 s invulnerable); el trío golpea con A (aviso visible 0,35 s, enfriamiento 2 s). Un golpe quita 2 monedas; **dos golpes en ≤0,6 s = sándwich**, 6 monedas. El solo recoge monedas caídas (máx. la mitad de lo perdido).
- **Modelo B**: el solo es la víctima y juzga todos los golpes con `remote()`; `ev sw` del trío, `ev hit{k,pc,lost}` y `ev rec` del solo.
- **Puntaje (U=2, H=15)**: `sc[solo]=2·(30−lost)`, `sc[trío]=29`; el solo gana con ≥15 monedas. `lim` de partida `{scoreMax:60, scoreRate:8, minT:6, finTemprano:1}`; cierra con `lost ≥ 16`.
- **Perilla**: `SPD` (base 1,12×).
- **Niveles**: plaza abierta; pilares de puestos; callejones y turbo «¡ME PAGARON!».
- **Gag**: «¡Cobré el bono y ya debo la mitad!»

## Pendientes antes de construir
1. Leer `fiesta-juego-cava.js` y `fiesta-juego-alcabala.js` y su prueba: si la otra sesión los termina, la ola 2 de código del Área 4 es cuerda + hallacas + guaya + bono.
2. Resolver la nota de futbolito (ventaja del juez en C, 14 semillas): ejecutar el bloque I y documentar los números.
3. Confirmar con el banco de 200 semillas cada `lim` y cada perilla (nada de lo anterior está medido).
4. `f_guaya` y `f_bono` asumen `remote()` y `claim` del runtime: verificar que existen en `fiesta-live.js` (no lo editamos; si falta algo, se pide al Área 3).
