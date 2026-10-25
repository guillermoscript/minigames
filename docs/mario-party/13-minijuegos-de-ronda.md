# 13 · Minijuegos de ronda en Margarita: revisión y propuesta

Objetivo: que después de cada ronda venga un minijuego que se sienta **Mario Party** (equipos por color, ruleta, reglas,
cuenta regresiva, podio con monedas) pero con **humor y estilo venezolano**, y que esté **amarrado al tablero**
(la hora, el clima, el carnaval, las noticias).

---

## 1 · Qué hay hoy (revisado el 2026-10-25)

18 minijuegos de 4 jugadores (`docs/style-lab/fiesta-juego-*.js`), todos venezolanos de tema:

| Formato | Juegos |
|---|---|
| Todos contra todos (11) | La abuela dice · Agua en carnaval · La cola de la gasolina · Llueven chanclas · Sube el cerro · Capicúa · La última harina · Llueven cotufas · Tequeños · Salta el mecate · Perro caliente con todo |
| 2 vs 2 (4) | Carga la cava · Futbolito de calle · La línea de hallacas · Hala la cuerda *(cargada en la fase 1)* |
| 1 vs 3 (4) | Se le cae el bono · La alcabala de medianoche · La guaya del teleférico · La patilla gigante |
| Duelo 1 vs 1 (4) | La abuela dice · Capicúa · La última harina · Salta el mecate |

Además, 40+ microjuegos de 1 jugador (`jugar.html`) para las casillas M.

**Pruebas hechas:**

- `FIESTA.LIVE.sim`: los 18 juegos en sus 29 combinaciones de formato terminan con puestos válidos.
- Embebidos en el tablero (iframe `?embed=1`): los 22 casos que usa el tablero cargan sin errores.
- Partida real: ronda → minijuego → resultado (+10 a los ganadores) → siguiente ronda → minijuego. **El ciclo funciona.**

## 2 · Problemas encontrados (por prioridad)

1. **Sin reglas ni cuenta regresiva.** El juego arranca de una: en la prueba, «TÚ» ya estaba fuera antes de entender qué hacer.
   Cada juego ya trae su `carta` (objetivo, cómo se gana, controles y demos), pero el modo embebido no la usa.
2. **Los nombres no coinciden.** En el tablero son TÚ · MAMÁ · ABUELA · PANA; dentro del juego salen TÚ · PANA · PROFE · CHUO
   (y otros personajes). El tablero dijo «ganan ABUELA y PANA» y en pantalla ganaron PROFE y CHUO.
3. **Dice «PRÁCTICA»** arriba y «¡Bien! otra vez…» al final.
4. **El duelo** pone a «PROFE» de rival, no al jugador retado.
5. **Hala la cuerda** no está cargada, así que el 2 vs 2 tiene solo 3 juegos.
6. **Elección a ciegas:** sale un juego al azar (se puede repetir), sin ruleta ni presentación.
7. **Resultado plano:** solo un texto; no hay podio ni monedas volando a las fichas.

## 3 · Propuesta: el flujo de Mario Party, a la venezolana

Después de la última ficha de la ronda:

1. **«¡EPA! ¡HORA DEL MINIJUEGO!»** — el animador (un presentador de TV de sábado, inventado) lo anuncia. Las fichas
   saltan a dos filas según el color de su casilla (azul/rojo) y se ven los equipos: «¡TÚ y MAMÁ contra ABUELA y PANA!».
2. **Ruleta de 4 juegos** del formato que tocó, con frases del animador («¡Esa no, esa no… ESA!»). Nunca el mismo de la ronda anterior.
3. **Tarjeta de reglas** con lo que ya trae cada juego (`carta.obj`, `carta.gana`, `carta.como`, `carta.demos`),
   botón **PRACTICAR** y botón **¡LISTO!**. Las CPU marcan listo solas.
4. **Cuenta regresiva** «3 · 2 · 1 · ¡DALE!».
5. **El juego**, con los nombres y personajes del tablero (TÚ, MAMÁ, ABUELA, PANA → `tu`, `mama`, `abuela`, `pana`).
6. **Podio** 1.º-4.º y monedas que vuelan a cada ficha (+10 a los ganadores; en carnaval +15).
7. Vuelta al tablero.

## 4 · Amarrar los minijuegos al tablero

Que lo que pasa en la isla decida qué se juega (esto es lo que más lo hace «nuestro»):

| Estado de la isla | Minijuego |
|---|---|
| 🎉 Carnaval | Siempre **¡Agua en carnaval!** (todos contra todos, premio 15) |
| 🌙 Noche | Prioridad a **La alcabala de medianoche** (1 vs 3) |
| 🌧️ Aguacero | Prioridad a **Sube el cerro** (con los tobos de agua) |
| ⚡ Apagón | Nuevo: **¡Se fue la luz!** (ver abajo) |
| 🔥 Últimas 3 rondas | Juegos «de plata» (cotufas, tequeños) y premio doble |
| ⚔️ Casilla ¡BRONCA! | Duelo 1 vs 1 con el rival elegido, con su nombre |

**Minijuego de batalla** (como el *Battle* de Mario Party), para una noticia nueva «¡BRONCA GENERAL!»: todos ponen 5-20 Bs en
un pote, el 1.º se lleva el 70% y el 2.º el 30%.

## 5 · Minijuegos nuevos de Margarita (ideas)

Para tapar huecos (pocos 2 vs 2, nada de batalla) y conectar con lo que ya pasa en el mapa:

| Juego | Formato | Idea |
|---|---|---|
| ¡SE FUE LA LUZ! | Todos | Pantalla a oscuras con linterna; encuentra la vela y el breaker antes que los demás |
| ¡HUYE DEL SILBÓN! | 1 vs 3 | El solo es El Silbón en la oscuridad; el trío se esconde. «Si lo oyes cerca, está lejos» |
| ¡EL KRAKEN! | 1 vs 3 | El solo mueve los tentáculos; el trío rema la lancha hasta la orilla |
| ¡ABORDAJE! | 2 vs 2 | Uno carga el cañón del castillo y el otro apunta al barco de Lope de Aguirre |
| ¡EMPANADAS DE CAZÓN! | 2 vs 2 | Línea de cocina en la playa: uno rellena y el otro cierra y fríe |
| ¡CARRERA DE PEÑEROS! | Todos | Rema al ritmo de las olas hasta Coche |
| ¡PESCA EN BOCA DE RÍO! | Todos (de plata) | Tira la atarraya a tiempo; te quedas con lo que pescas, como los juegos de monedas de MP |
| ¡ESCALERAS DEL SAMBIL! | Todos | Sube la escalera mecánica que va en sentido contrario, esquivando bolsas de compras |

## 6 · Plan por fases

| Fase | Qué | Resultado |
|---|---|---|
| **1 · Que se juegue bien** ✅ | Reglas + cuenta regresiva, nombres y personajes reales, quitar «PRÁCTICA», cargar Hala la cuerda, no repetir, ruleta, podio, duelo con el rival real | Cada ronda termina en un minijuego que se entiende y se siente MP |
| **2 · Que sea de la isla** | Elección según el estado (tabla §4), animador con frases, minijuego de batalla | Lo que pasa en el tablero cambia lo que se juega |
| **3 · Juegos nuevos** | Uno por sesión de la tabla §5, empezando por ¡Se fue la luz! y ¡Huye del Silbón! | Más variedad, sobre todo en 2 vs 2 y 1 vs 3 |

La fase 1 toca `docs/margarita/margarita.js` y la capa de práctica de LA FIESTA (`fiesta-live.js`, `fiesta-main.js`,
`fiesta-carta.js`), que hoy no están en git.

---

## 7 · Fase 1: hecha (2026-10-25)

| # | Qué | Estado |
|---|---|---|
| 1 | Tarjeta de reglas en el iframe (`carta.obj/gana/como/demos`) con **PRACTICAR** y **¡LISTO!** (Espacio/Enter = listo, P = practicar, Esc = volver), luego «3 · 2 · 1 · ¡DALE!» y la partida real **una sola vez**. Las CPU no esperan. | ✅ |
| 2 | Nombres y personajes del tablero: el tablero manda `&noms=TÚ,MAMÁ,ABUELA,PANA&chs=tu,mama,abuela,pana` en orden de asiento y `practice()`/`localBoard()` los usan. Los cuatro retratos se dibujan. | ✅ |
| 3 | Sin «PRÁCTICA» ni «¡Bien! otra vez…» ni reinicio solo en la partida embebida. | ✅ |
| 4 | ¡BRONCA! con el rival de verdad: asiento a = tú, b = el otro, con su nombre y su cara; paga en la dirección correcta. | ✅ |
| 5 | ¡HALA LA CUERDA! cargada (`fiesta.html`) y en `MJ['2v2']`: ahora el 2 vs 2 tiene 4 juegos. | ✅ |
| 6 | Ruleta con el animador («¡EPA! ¡HORA DEL MINIJUEGO!», «¡Esa no… esa no… ESA!»), nunca el juego de la ronda anterior (ni el duelo anterior), y los equipos en grande: «MAMÁ VS TÚ + ABUELA + PANA». | ✅ |
| 7 | Podio 1.º-4.º (empates = varios en el mismo escalón) y monedas que vuelan a la ficha de cada ganador; paga al llegar (+10; carnaval +15). | ✅ |

**Pruebas (2026-10-25):**

- `FIESTA.LIVE.sim`: 19 juegos × todos sus formatos (+1v1 para los de todos contra todos; 1v3 con el solo en a y en b), semillas 7/11/99: 102 corridas, todas terminan.
- Desde la página del tablero, en el iframe: los 27 casos que usa (11 todos, 4 de 2 vs 2 con la cuerda, 4 de 1 vs 3 como solo y 4 como trío, 4 duelos):
  todos abren en la tarjeta, pasan a la partida con Espacio, con los nombres y caras del tablero en el asiento que toca y sin errores.
- Ronda real como humano, con teclado de verdad: ruleta → tarjeta → cuenta → juego (¡CAPICÚA! y ¡PERRO CALIENTE!) → `mj-fin` → podio → monedas → ronda 2.
  Los ganadores del tablero son los mismos que los del juego. 1 vs 3 como trío (¡LA ALCABALA!) igual.
- Duelo forzado: ABUELA (CPU) te reta y gana en el juego → ella +10 y tú −10; tú retas a MAMÁ y ganas → al revés. Carnaval forzado con empate → los dos +15.
- `?cpu=1&turnos=6` y `?sinmj=1` llegan al final sin errores.

**Cambios frente al plan:**

- Revelación de equipos: las fichas **saltan en su sitio** y se marcan con una flecha del color del equipo, en vez de ponerse en dos filas.
- En 2 vs 2 y 1 vs 3 la ruleta muestra **3 cartas**, no 4: hay 4 juegos y el de la ronda pasada no puede salir.
- La cara de TÚ: como `juegos-bus.js` no se tocó, `fiesta-live.js` agrega el alias `BUS.AP.CAST.tu = BUS.TU`.
- PRACTICAR desde la tarjeta todavía pone las etiquetas de práctica («PRÁCTICA» arriba); la partida real no.
- En el tablero el foco pasa al iframe al abrirlo y al cargar (si no, Espacio/Enter no llegaban a la tarjeta), y la espera de `mj-fin` no tiene tiempo límite.
- ¡DOMINÓ! en el tablero se llama ahora **¡CAPICÚA!**, como dentro del juego.
- `window.MARGARITA` expone `minijuego`, `bronca`, `urlMJ`, `MJ` y `DUELOS` para forzarlos desde la consola en las pruebas.

**Arreglado:** el botón SALTAR del tablero ya vive en una franja propia fuera del iframe (abajo; a la derecha en el teléfono acostado) y no tapa ningún HUD ni botón del minijuego.

**Pendiente / para la fase 2:** en carnaval todavía sale cualquier juego de todos contra todos (la tabla §4 es fase 2).
