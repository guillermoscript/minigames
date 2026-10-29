# 02 · Evolución de la serie Mario Party (MP1 → Jamboree)

> **Para qué sirve este documento.** Es el segundo capítulo del manual de diseño del modo "fiesta" (tablero de 4 jugadores sobre el mapa gigante de Venezuela). Recorre todas las entregas, una por una. Para cada una dice qué trajo, qué mejoró, qué salió mal y cómo lo arregló la entrega siguiente. Después junta las tendencias de fondo y termina con una **lista de "lo mejor de cada juego"**: qué copiar y de dónde.
>
> **Fuentes.** Super Mario Wiki (páginas de cada juego, Bonus Star, Last Five Turns, Chance Time, Orb, tableros), Wikipedia, resúmenes de Metacritic/GameRankings y reseñas (IGN, GameSpot, Kotaku, Slant, The Sixth Axis, Destructoid, Nintendo World Report). No se pudo acceder a Reddit, Fandom ni a YouTube.
>
> **Convención.** **(por verificar)** marca todo dato que no se pudo confirmar o que choca entre fuentes. **(inferido)** marca una conclusión de diseño nuestra, que no viene de una fuente. Los nombres de juego usan la jerga de los fans ("star", "Chance Time", "Bonus Star", "Last Five Turns", "orbs", "Buddies").

---

## Índice

1. [Tabla maestra de la serie](#1-tabla-maestra-de-la-serie)
2. [Fichas por juego](#2-fichas-por-juego)
   - [Mario Party (N64, 1998)](#21-mario-party-n64-1998)
   - [Mario Party 2 (N64, 1999/2000)](#22-mario-party-2-n64-19992000)
   - [Mario Party 3 (N64, 2000/2001)](#23-mario-party-3-n64-20002001)
   - [Mario Party 4 (GameCube, 2002)](#24-mario-party-4-gamecube-2002)
   - [Mario Party 5 (GameCube, 2003)](#25-mario-party-5-gamecube-2003)
   - [Mario Party 6 (GameCube, 2004)](#26-mario-party-6-gamecube-2004)
   - [Mario Party 7 (GameCube, 2005)](#27-mario-party-7-gamecube-2005)
   - [Mario Party 8 (Wii, 2007)](#28-mario-party-8-wii-2007)
   - [Mario Party 9 (Wii, 2012)](#29-mario-party-9-wii-2012)
   - [Mario Party 10 (Wii U, 2015)](#210-mario-party-10-wii-u-2015)
   - [Super Mario Party (Switch, 2018)](#211-super-mario-party-switch-2018)
   - [Mario Party Superstars (Switch, 2021)](#212-mario-party-superstars-switch-2021)
   - [Super Mario Party Jamboree (Switch, 2024)](#213-super-mario-party-jamboree-switch-2024)
   - [Portátiles: DS, Island Tour, Star Rush, The Top 100](#214-portátiles-ds-2007-island-tour-2013-star-rush-2016-the-top-100-2017)
3. [Las cinco eras de la serie](#3-las-cinco-eras-de-la-serie)
4. [Tendencias transversales](#4-tendencias-transversales)
5. [Errores que la serie corrigió (y los que nunca corrigió)](#5-errores-que-la-serie-corrigió-y-los-que-nunca-corrigió)
6. [Recepción vs. decisiones de diseño](#6-recepción-vs-decisiones-de-diseño)
7. [Best-of: qué copiar de cada entrega](#7-best-of-qué-copiar-de-cada-entrega)
8. [Lo que NO hay que copiar](#8-lo-que-no-hay-que-copiar)
9. [Pendientes de verificación](#9-pendientes-de-verificación)

---

## 1. Tabla maestra de la serie

| # | Juego | Año | Dado | Precio de la star | Sistema de objetos | Bonus Stars | Minijuegos | Metacritic | Ventas |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Mario Party | 1998 | 1-10 | 20 | Ninguno en el tablero (solo hongo de casilla) | 3 fijas (Minigame, Coin, Happening) | ~50 (por verificar) | 79 | ~2,7 M |
| 2 | Mario Party 2 | 1999/2000 | 1-10 | 20 | **1 slot**, tienda + casilla Item | 3 fijas | ~64 (fuentes dicen 50-65) | — (GR 76,16 %) | ~2,5 M (por verificar) |
| 3 | Mario Party 3 | 2000/2001 | 1-10 | 20 | **3 slots**, objetos baratos, tienda villana | 3 fijas (opcionales en Party) | 71 (todos nuevos) | 74 | ~1,9 M |
| 4 | Mario Party 4 | 2002 | 1-10 | 20 | 3 slots, hongos Mega/Mini | 3 opcionales | ~60 | 70 | ~2,45 M |
| 5 | Mario Party 5 | 2003 | 1-10 | 20 | **Cápsulas** gratis, lanzables como trampa | 3 (opcionales) | 77 | 69 | por verificar |
| 6 | Mario Party 6 | 2004 | 1-10 | **Variable por tablero** (5-40) | **Orbs** (23), trampas sin auto-daño | 3, **Orb Star sustituye Coin Star** | por verificar | 71 | el más bajo de GameCube |
| 7 | Mario Party 7 | 2005 | 1-10 (equipos 1-5 ×2) | 20 → 10 en los últimos 4 turnos (Grand Canal) | Orbs (~30, 5 clases) | **3 al azar de 6** | 88 | 64 | por verificar |
| 8 | Mario Party 8 | 2007 | 1-10 | Variable por tablero (gratis, 10, 20, hoteles) | **Caramelos** (14), no se colocan en el tablero | 3 al azar de 6 (opcionales) | 73 | ~62 | ~8,85 M |
| 9 | Mario Party 9 | 2012 | dados especiales | **No hay compra**: Mini Stars | Solo dados especiales | Bonus Mini Stars (5 c/u) | 78-82 | 73 | 3,11 M |
| 10 | Mario Party 10 | 2015 | dados especiales | No hay compra (salvo amiibo Party: 20) | Solo dados especiales | **2** Bonus Mini Stars (10 c/u) | 75 | 66 | por verificar |
| 11 | Super Mario Party | 2018 | 1-6 + **dado de personaje** | **10** (Toadette itinerante) | Objetos simples + **aliados** | **2-3 de un pool de 11** | 84 | 76 | 14,79 M (2021); 21,36 M (por verificar) |
| 12 | Mario Party Superstars | 2021 | 1-10 | 20 | Tienda clásica (3-25 monedas) | 2-3 de 9, modo **On/Classic/Off** | 100 + 5 | 80 | 14 M |
| 13 | Super Mario Party Jamboree | 2024 | 1-10 | 20 (por verificar) | **37 objetos**, stock de 2 por objeto, **Buddies** | 2-3 de 9; **Pro Rules: 1 anunciada** | 112 (132 Switch 2) | 82 | 8,64 M |
| P | Mario Party DS | 2007 | 1-10 | 20 | 3 slots + **Hexes** (trampas) | 3 (por verificar el número) | 73 | 72 | por verificar |
| P | Island Tour | 2013 | 1-6 | Carrera, sin estrellas | Dados/cartas | ninguna verificada | 81 | 57 | por verificar |
| P | Star Rush | 2016 | 1-6 simultáneo | 10 (Balloon Bash) | Aliados + ? Blocks | 3 al azar de 10 | 53 | 68 | por verificar |
| P | The Top 100 | 2017 | — | 10 (Minigame Match) | ninguno | 3 (criterios por verificar) | 100 remaster | 59 | por verificar |

**Cómo leer la tabla (inferido).** Las mejores notas se agrupan en dos bloques. Están el **inicio (MP1-3)** y el **regreso a la fórmula clásica (SMP, Superstars, Jamboree)**. El valle va de MP5 a MP10. Las dos entregas que quitaron la compra de estrellas con monedas (MP9 y MP10) y la que convirtió el tablero en carrera (Island Tour) están entre las peores. La lección número uno de toda la serie es: **monedas → estrellas con movimiento individual es el núcleo. No se toca.**

---

## 2. Fichas por juego

Cada ficha tiene el mismo orden: **Reglas base · Economía · Lo nuevo · Lo refinado · Errores · Recepción · Qué nos llevamos.**

### 2.1 Mario Party (N64, 1998)

**Reglas base.** Hasta 4 jugadores (humanos o CPU) y 6 personajes idénticos en estadísticas. Partidas de **20, 35 o 50 turnos**. Cada uno tira un dado de **1-10** y avanza por un tablero ramificado. Cuando los cuatro se han movido, se juega **un minijuego**. Su tipo sale del **color de la casilla** donde quedó cada uno:

| Colores al final de la ronda | Tipo de minijuego |
|---|---|
| 4 azules o 4 rojas | 4 jugadores, todos contra todos |
| 2 azules + 2 rojas | 2 vs 2 |
| 3 de un color + 1 del otro | 1 vs 3 |
| Casilla Happening | Se le asigna color al azar antes de la ruleta |

Gana quien tenga más estrellas. Los empates se rompen por monedas y luego con un dado. Hay 8 tableros, cada uno con su gimmick.

**Economía.**

| Fuente / sumidero | Valor |
|---|---|
| Casilla azul | +3 (×2 en los últimos 5 turnos) |
| Casilla roja | −3 (×2 en los últimos 5 turnos) |
| Star (Toad) | 20 monedas |
| Casilla de minijuego en solitario | gana monedas / pierde 5 |
| Peajes: Whomps (DK's Jungle) | 10 cada uno |
| Peajes: Thwomps (Yoshi's Tropical Island) | empieza en 1 y sube +1 por pago, hasta 50 |
| Atajos de Magma Mountain | 10 |
| Lotería de flor (Peach) | 10 por semilla |
| Semilla de Piranha (roba estrellas) | 30 |
| Chance Time | mueve 10-30 monedas o estrellas entre jugadores |

Exclusivo de MP1: **algunos minijuegos les quitan monedas a los perdedores**. Además, las monedas ganadas se guardan en el perfil y se gastan en la tienda de Mushroom Village (desbloqueables de 50 a 980 monedas).

**Lo nuevo (todo).** La fórmula completa: tablero + minijuego por color, estrellas compradas con monedas, dado 1-10, reparto 4P/2v2/1v3, Chance Time, eventos de Bowser, duplicación en los últimos 5 turnos, 3 Bonus Stars, gimmick por tablero y modo de un jugador (Mini-Game Island).

**Errores.**
- **Minijuegos de girar la palanca** (Tug o' War, Paddle Battle, Pedal Power) que causaban **ampollas en la palma**. Nintendo regaló guantes y hubo una demanda. La mecánica no volvió hasta Island Tour.
- **No hay objetos en el tablero**: las decisiones son pocas y el dado manda.
- **Ritmo lento** y un modo de un jugador flojo.
- Mucho azar: la crítica lo marcó desde el primer día. Game Informer le puso 2,25 y 5,5.

**Recepción.** Metacritic 79, GR 78,02 %, IGN 7,9, GameSpot 7,2. Unos 2,7 M vendidos.

**Qué nos llevamos.**
- El **color de casilla decide el tipo de minijuego**. Es la idea más elegante de toda la serie, porque la posición en el tablero importa más allá de moverse.
- **Peaje que escala** (el Thwomp de 1 → 50) como base para la alcabala venezolana.
- **Nunca** pedir gestos que cansen la mano. En el móvil, toques y deslizamientos cortos.

---

### 2.2 Mario Party 2 (N64, 1999/2000)

**Reglas base.** Iguales a MP1: 20/35/50 turnos, dado 1-10 (heredado; por verificar que no cambió), minijuego al final de cada ronda según el color. La estrella se compra **al pasar**, no hace falta caer en ella. Hay 6 tableros temáticos (Pirate, Western, Space, Mystery, Horror, Bowser Land) más un tutorial. Cada uno tiene **su propia forma de Bowser**.

**Economía.**

| Elemento | Valor |
|---|---|
| Star | 20 (se compra al pasar) |
| Banco | 5 al pasar; quien cae se lleva todo el pozo |
| Minijuego de Batalla (Goomba) | cada jugador pone 10/20/30/50; **1.º se lleva 70 %, 2.º 30 %** |
| Duelo | apuesta limitada a lo que tenga el más pobre |
| Coin Potluck de Bowser | 10/20/30 por jugador según fase de la partida |
| Boo Bell | robar 5 monedas o **una estrella por 50** |
| Chance Time | 3 (solo en los 5 primeros turnos), 20, 30, 1 estrella, intercambio total (solo después del turno 5) |

**Lo nuevo.**
- **Objetos reales**: se lleva **1** a la vez. Salen de la tienda, de la casilla Item y de los minijuegos de objeto. Precios: Mushroom 10, Skeleton Key 10, Plunder Chest 15, Dueling Glove 15, Warp Block 15, Golden Mushroom 20, Magic Lamp 30. El stock de la tienda **depende del turno y del puesto**.
- **Minijuegos de Batalla** (pozo 70/30) y **Duelos** (al caer en la misma casilla o con el Dueling Glove).
- **Banco**, casilla **Item**, casilla de **Batalla**.
- **Ciclo día/noche** en Horror Land, que cambia cada 2 turnos o al caer en Happening. Es el antepasado del de MP6.
- Ruleta de Bowser ampliada: **Bowser Revolution** (junta y reparte todas las monedas por igual), Potluck, "Multiplying Toads" (estrella falsa = Ztar).
- **Primera interacción jugador contra jugador con objetos**: Warp Block (intercambiar posición) y Plunder Chest (robar objeto).
- Modo práctica para cada minijuego.

**Lo refinado.** Se eliminan los minijuegos de girar la palanca, la casilla de minijuego en solitario y la de hongo: los objetos las sustituyen. Los tableros pasan de 8 abiertos a 6 mucho más temáticos.

**Errores.**
- La crítica lo vio como **"más de lo mismo"**: unos 20 minijuegos reciclados de MP1. IGN: "not enough new here to warrant another purchase".
- Mucho azar y CPUs lentas.
- Bugs (bloqueo en Coffin Congestion, congelamiento al saltar 1.000 veces en Hot Rope Jump).

**Recepción.** GR 76,16 %, IGN 7,9, GameSpot 7,8, EGM ~8,25. ~2,5 M (por verificar).

**Qué nos llevamos.**
- **Un sistema de objetos desde el día 1** (fue la mejora más valorada).
- **Pozo de batalla 70/30**: modelo limpio de apuesta.
- **Comprar la estrella al pasar**: premia elegir la ruta y le da valor a los objetos de dado.
- **Bloquear las peores sorpresas** del Chance Time en los primeros turnos.

---

### 2.3 Mario Party 3 (N64, 2000/2001)

**Reglas base.** Turnos 20/35/50 o **personalizado de 10 a 50 en pasos de 5**. Dado 1-10. La star cuesta 20 y **cambia de sitio después de cada compra**. Spiny Desert tiene una **estrella falsa**. Últimos 5 turnos: azul y rojo ×2, y caer en la casilla de un rival provoca un duelo (lo del duelo, por verificar).

**Economía.**

| Elemento | Valor |
|---|---|
| Inicio | 10 monedas (por verificar en Party) |
| Ganar minijuego | 10 |
| Star | 20 |
| Banco Koopa | 5 al pasar, el pozo para quien cae |
| Game Guy | apuestas **todas** tus monedas: doblas o lo pierdes todo |
| Chance Time | pools de monedas 1/10/20/30/todas y estrellas 1/2/3/todas, **resultado predeterminado** y **limitado por fase** |

**Lo nuevo.**
- **Inventario de 3 objetos** con precios **más bajos** (5-30).
- **Dos tiendas**: Toad (objetos que te ayudan) y **Baby Bowser (objetos para atacar)**: Reverse Mushroom 5, Poison Mushroom 5 (el rival saca 1-3), Lucky Lamp 10 (mueve la estrella), Plunder Chest 10, Boo Bell 15, Bowser Suit 10.
- **Cellular Shopper** (5): pides a la tienda a distancia.
- **Duel Mode** con compañeros, salarios, corazones y renta por casilla reclamada. **No volvió nunca.**
- **Primer modo historia en solitario** y **primer minijuego jefe** (Stardust Battle).
- Filtro de **"solo minijuegos fáciles"**, handicaps, Daisy y Waluigi.
- Gimmicks de tablero más profundos: flechas que cambian cada turno (Woody Woods), estrella falsa (Spiny Desert), atajos con llave.

**Desglose de minijuegos (71, todos originales):** 20 de 4P, 10 de 1v3, 10 de 2v2, 8 de Batalla, 10 Duelos, 6 de objeto, 3 raros, 4 de Game Guy.

**Errores.**
- **Game Guy**: la queja más grande (todo o nada, puro azar).
- El sistema de compañeros de Duel Mode era demasiado complejo y se abandonó.
- CPUs lentas, gráficos anticuados, la fórmula sin cambios.

**Recepción.** Metacritic 74, IGN 6,4 en su momento. **IGN 2015 lo puso #1 de la serie**, y muchos fans lo consideran la cumbre. ~1,9 M.

**Qué nos llevamos.**
- **3 slots y objetos baratos**: hay una decisión de compra en cada turno.
- **Separar la tienda "buena" de la "villana"** (UX clara para la capa de ataques). En Venezuela: **bodega** contra **bachaquero**.
- **Chance Time con resultados limitados por fase**: impide que el turno 2 decida la partida.
- La **estrella falsa** es un gag perfecto para Deltamacura (inferido).
- **Lección de alcance**: recortar los modos débiles (Game Guy, compañeros) en vez de inflar el juego.

---

### 2.4 Mario Party 4 (GameCube, 2002)

**Reglas base.** 10-50 turnos en pasos de 5 (Historia: 15 fijos). Dado 1-10. Star a 20, que se mueve. Empates: estrellas → monedas → dado. 6 tableros (nombres de memoria, por verificar).

**Últimos 5 turnos (MP4):** lotería de **Lucky Party Tickets** (una estrella gratis, rara) y **el último lugar gira una ruleta** con cuatro reglas: multiplicar monedas, rojas que pasan a Bowser, rojas que pasan a Fortune, o estrella regalada. Se quitan los duelos.

**Economía.** Inicio 10, azul +3, roja −3, ganar minijuego 10 (a veces ×2 o ×3), star 20, objetos 5-30.

**Lo nuevo.**
- **Sistema de tamaño Mega/Mini** atado al dado. Mega = 2 dados (2-20) y le roba 10 a quien pasa. Mini = dado 1-5 y acceso a **tuberías pequeñas** y **Mini Mini-Games**.
- **Boo House** (robar 5 monedas por 5, o una estrella por 50).
- **Contraobjetos**: Gaddlight (espanta a Boo) y Chomp Call (mueve la estrella).
- **Fortune Space** ("Reversal of Fortune", estilo pinball, intercambia monedas y estrellas). Parcialmente por verificar.
- **Primer "evento del último lugar"** en los últimos turnos. Este patrón se repite en casi todas las entregas posteriores.

**Lo refinado.** Desaparece el Duel Mode de compañeros de MP3. La investigación de MP4 dice que "reemplazó el sistema de orbes de MP3", pero los orbes son de MP6: **error de la fuente**.

**Errores.**
- **Tableros más grandes y lentos**, con mucho tiempo mirando turnos de la CPU.
- **Restricciones del hongo Mini**: no podías comprar en tiendas ni estrellas en ciertos estados de tamaño, y nada en la UI lo dejaba claro. Frustró a los jugadores.
- "Más de lo mismo", minijuegos simplistas.
- Confusión en la definición de la Coin Star ("más monedas en un turno" o "en cualquier momento").

**Recepción.** Metacritic 70, IGN 6,9, Eurogamer 5. ~2,45 M.

**Qué nos llevamos.**
- **Evento de catch-up para el último lugar, anunciado** (la ruleta). Es la base de nuestros "últimos 5 turnos".
- **Contraobjetos**: cada ataque necesita una defensa comprable.
- Una lista mínima de minijuegos por formato: el paquete personalizado de MP4 pedía **4 de 4P, 3 de 2v2, 3 de 1v3 y 2 de batalla**. Es un buen mínimo para el MVP.
- **No esconder restricciones** detrás de estados que no se ven.

---

### 2.5 Mario Party 5 (GameCube, 2003)

**Reglas base.** 10-50 turnos. Dado 1-10. Inicio 10 monedas. Handicap: hasta 9 estrellas iniciales. Star a 20, una sola activa, se mueve al azar. **Tableros 3D** con **atajos de pago**.

**Últimos 5 turnos (MP5):** azul y rojo **×3 (±9)**. El último lugar gira: monedas ×3, rojas → Bowser, casillas → cápsula, o **cinco casillas de estrella activas**. Duelo si dos coinciden en la misma casilla.

**Lo nuevo.**
- **Cápsulas** (sustituyen la tienda). Se sacan **gratis** de máquinas y se **lanzan hasta 10 casillas adelante** como trampa sobre una casilla, o se usan en uno mismo **pagando** (5-20). Otra cápsula puede tapar la anterior.
- Ejemplos: Mushroom 5, Super Mushroom 10, Cursed Mushroom 5 (dado 1-5), Warp Pipe 10, Klepto 10, Bubble 10, **Wiggler 20 (directo a la estrella)**, Coin Block 5 (+10), Spiny 5 (roba 10), Bullet Bill 10 (roba 30), Goomba 5 (intercambia monedas), Piranha 5 (pierdes la mitad), Bob-omb (−20 a la tercera activación), Chain Chomp 15 (roba estrellas o monedas) con su defensa **Bone**, Chance 20, Tweester 15 (mueve la estrella).
- **Miracle Capsule**: con 3 de ellas, **todas las estrellas del 1.º pasan al último**.
- Casilla **DK** (bananas por monedas, posibilidad de estrella).
- Modos extra: Super Duel (construir máquinas), Mini-Game Wars (19 hexágonos), Decathlon, Card Party.

**Errores.**
- **La redistribución de monedas permite que quien gana todos los minijuegos y tiene más monedas termine último** (Game Informer). Es la crítica más concreta de la serie al azar.
- La Miracle Capsule era un "botón de injusticia".
- Las cápsulas que te usabas tú mismo **costaban monedas**, y las que lanzabas **podían dañarte a ti**.
- GameSpot: "si compraste MP4 el año pasado, MP5 es difícil de recomendar".

**Recepción.** Metacritic 69. Ganó un premio en los Interactive Achievement Awards 2004.

**Qué nos llevamos.**
- **Trampas colocables en el tablero**: es el salto de interactividad que pidió el usuario ("que el mapa sea interactivo").
- **Atajos de pago de 5-10 monedas** en un tablero 3D. Barato y efectivo.
- **Varias estrellas activas al final** como evento de cierre.
- **Ataque y defensa por pares** (Chain Chomp ↔ Bone).
- Lo que **no**: transferencias totales de estrellas del primero al último.

---

### 2.6 Mario Party 6 (GameCube, 2004)

**Reglas base.** 10-50 turnos, dado 1-10. **Ciclo día/noche cada 3 turnos** (Brighton de día, Twila de noche) que **cambia el tablero**: tiendas, casillas activas, enemigos y precio de la star. Primer **micrófono**.

**Precio de la estrella por tablero** (la gran idea de MP6):

| Tablero | Cómo se consigue la estrella |
|---|---|
| Towering Treetop / E. Gadd's Garage | 20 monedas, clásico (por verificar cuáles son exactamente los dos) |
| Faire Square | de noche, **Twila tira un dado**: 5, 10, 30 o 40. Hasta 5 estrellas en sitios fijos |
| Snowflake Lake | todos **empiezan con 5 estrellas** y los Chain Chomps las roban |
| Castaway Bay | llegar hasta DK al final del tablero |
| Clockwork Castle | casillas Shadow Star: un Ztar te quita estrella o monedas |

**Lo nuevo.**
- **Orbs (23)**, en cuatro colores:
  - **Verdes** (para ti): Mushroom 5, Super 'Shroom 15, Sluggish 10, Metal 10 (inmune a trampas), Bullet Bill 20, Warp Pipe 10, **Flutter 30 (vuelas a la estrella)**.
  - **Rojos** (bloqueo de camino, afectan a quien pasa): Podoboo 5 (−10), Zap 15 (−5 por casilla recorrida), Tweester 5, Thwomp 10 (te para), Bob-omb 10 (mitad del movimiento), Koopa Troopa 10 (cambio de lugar).
  - **Amarillos** (crean una **Character Space** que **le paga +5 al dueño** al caer): Spiny 5, Goomba 10, Piranha 15 (la víctima da la mitad), Klepto 5 (te manda al inicio), Toady 5, Kamek 10, Mr. Blizzard 10.
  - **Azules** (protección pasiva): Snack 10 (contra Chomp), Boo-Away 10 (contra Boo).
- **Alcance reducido a 5 casillas** (las cápsulas llegaban a 10). **El que lanza es inmune a su propia trampa.**
- **Orb Star** reemplaza a la **Coin Star**: premia **usar** objetos, no acumular monedas.
- Modo Solo con Koopa Kids. Los jugadores **votan** el minijuego de Batalla.

**Últimos 5 turnos (MP6):** el 4.º gira una ruleta: monedas ×3, +40 monedas, cinco Character Spaces o **Bowser Revolution** (todas las monedas repartidas por igual).

**Errores.**
- Micrófono anecdótico, con reconocimiento de voz poco fiable.
- **Motor y assets reciclados** (se veía igual que MP5).
- Las diferencias de día y noche en los minijuegos eran casi solo cosméticas.
- Eurogamer: "demasiado tedio". Fue el MP de GameCube que menos vendió.

**Recepción.** Metacritic 71, IGN 7, GameSpot 6,9. 483 k en EE. UU. + 469 k en Japón en sus primeros meses. **Retrospectivamente, sus tableros y los orbs están entre lo mejor de GameCube** (Mario Party Legacy: "MP6 hizo divertidos los cambios de MP5").

**Qué nos llevamos.**
- **Cada región con su propia regla para conseguir la estrella.** Es la lección más poderosa de toda la serie para un mapa enorme.
- **Ciclo global visible** que cambia reglas, no solo la piel. En Venezuela: **luz/apagón**.
- **Inmunidad del dueño a su propia trampa** + **casilla propia que le paga al dueño** = territorio.
- **Bonus star por usar objetos**, en lugar de premiar el ahorro.

---

### 2.7 Mario Party 7 (GameCube, 2005)

**Reglas base.** Party Cruise: Battle Royale (4), Tag Battle (2v2, **hasta 8 jugadores con mandos compartidos**), 4-Team. 10-50 turnos. Dado 1-10. En Tag, cada compañero tira un dado de 1-5 y el equipo se mueve junto.

**Bowser Time.** Una barra **sube un 20 % por cada minijuego** y Bowser actúa **cada 5 turnos** (de 1 a 9 veces según la duración). No se activa en los últimos 4 turnos. Hace un desastre en el tablero: rompe puentes, roba la estrella del 1.º, destruye molinos, hunde la isla que tiene la estrella (Enchanted Inferno: mitad de monedas y de vuelta al inicio), cobra fotos (10-20) o te obliga a comprar la estatua de Bowser (20).

**Últimos 4 turnos (MP7):** el último lugar o equipo gira: casillas ×3, +40 monedas, **estrella a mitad de precio**, rojas → Bowser, 10 casillas Koopa Kid.

**Lo nuevo.**
- **Bonus Stars: 3 al azar de un pool de 6** (Minigame, Happening, Orb, **Red** = más casillas rojas, **Running** = más casillas recorridas, **Shopping** = más gastado en tiendas). Por primera vez existe la **"pity star"**: la Red Star premia la mala suerte.
- **Primeros minijuegos de 8 jugadores** (12).
- Bowser roba **estrellas** en vez de objetos.
- Orbs en **5 clases** (para ti, lanzado, bloqueo de camino, de personaje, automático).
- **Estrella con mecánica propia por tablero**: Windmillville (**invertir en molinos**), Pyramid Park (alquilar Chain Chomps para robar), Neon Heights (cofres con estrella o Dark Star).
- **Chance Time desaparece.**

**Grand Canal (desglose de casillas, 70 en total):** 48 azules, 9 rojas, 7 verdes, 2 Mic, 2 Duel, 2 DK. Tras el Bowser Time quedan 39 azules y 9 de Bowser. **Proporción útil: unas 2/3 de casillas "neutras/positivas".**

**Errores.**
- **Poca originalidad** ("aparte de los 8 jugadores, poco es nuevo", GamesRadar).
- Solo y CPUs aburridos, **mucho tiempo muerto entre turnos**.
- Los 8 jugadores con mandos compartidos como gimmick.
- Bonus stars ocultas hasta el final: **los jugadores no pueden apuntar a ellas**.

**Recepción.** Metacritic 64, GR ~65,4 %.

**Qué nos llevamos.**
- **Reloj villano visible** (barra que sube con cada minijuego + desastre cada 5 turnos) que **ataca al líder**. Drama y catch-up en una sola mecánica. En Venezuela: **"¡Se va la luz!"** o **"La crecida del Orinoco"**.
- **Estrella a mitad de precio** como premio de catch-up al final.
- **Invertir en un edificio** para cobrar estrellas (los molinos) = pozo petrolero en Anzoátegui.
- **Pity star** (Red Star) para que el que tuvo mala suerte tenga algo que perseguir.
- **Red de seguridad de 0 monedas**: si no tienes nada, Bowser te da 10 y no hay minijuego. Nadie queda eliminado.

---

### 2.8 Mario Party 8 (Wii, 2007)

**Reglas base.** Battle Royale, Tag Battle (2v2 con todo compartido, máximo 5 caramelos por equipo), Duel Battle (tableros con objetivo: 2 estrellas, 50 monedas en un punto, dejar al rival en 0; empate a los 30 turnos). Dado 1-10, con **control por movimiento**. La ruleta del minijuego muestra **todos** los minijuegos desbloqueados de ese tipo.

**Estrella por tablero:**

| Tablero | Regla |
|---|---|
| DK's Treetop Temple | clásica: 20 y se mueve |
| Goomba's Booty Boardwalk | el Capitán Goomba la **regala** (50 en duelos) |
| King Boo's Haunted Hideaway | **10 monedas**; la mansión **se reordena** tras cada compra |
| Shy Guy's Perplex Express | 20 al revisor (50 en duelos); Kamek reordena los vagones |
| Koopa's Tycoon Town | **sin tienda**: inviertes en **hoteles** (mejora a 20 → 2 estrellas, a 50 → 3) |
| Bowser's Warped Orbit | sin compra: todos empiezan con 5 y se las **roban** |

**Lo nuevo.**
- **Caramelos (14)**, que sustituyen a los orbs. Máximo **3**. **No se colocan en el tablero**, se usan antes de tirar.
  - Rojos (dado): Twice 5, Thrice 15-20, Slowgo 10-15.
  - Verdes (transformación + diana): Springo, Vampire (robo), Cashzap (destruye la mitad de las monedas del rival).
  - Amarillos (transformación temporal): Bowlo (roba 10 a cada uno que pasas), Bloway (manda al inicio), Bitsize, Weeglee (roba caramelos).
  - Azules (ofensivos): Thwomp (mitad de monedas a quien pasas), Duelo, **Bowser y Bullet: 15-20, pero 10 para el último**.
- **Chump Charity** a 5 turnos del final: el último lugar recibe un Duelo Candy (o 30 monedas). Se ponen **bolsas de monedas en las rojas** y monedas sueltas en las demás, para el primero que llegue.
- **Las casillas de Bowser ya no lanzan minijuego** (castigo directo).
- Casillas **DK que pasan a Bowser** tras usarse.
- Carnival Cards y Fun Bazaar (metaprogresión).

**Errores.**
- **Tablero lento y dominado por el azar**: "una mala tirada puede llevarte del 1.º al último".
- Interfaz pobre, assets reciclados de MP4-7, imagen 4:3 con franjas.
- **Sin juego en línea**.
- Minijuegos de movimiento "pegados".
- Retirada en el Reino Unido por una frase ofensiva.
- NWR: la serie "pide a gritos reinventarse".

**Recepción.** Metacritic ~62. Pero **~8,85 M** vendidos (la consola Wii lo empujó).

**Qué nos llevamos.**
- **Catch-up programado y explícito** (Chump Charity) en lugar de aleatorio.
- **Precio de ataque reducido para el último lugar**: catch-up sutil que no regala nada.
- **Objetos simples, máximo 3** = turnos rápidos.
- **Inversión en edificios** (hoteles) como vía alternativa a la estrella.
- Lo que **no**: un castigo de Bowser sin minijuego quitó un momento memorable. Mejor un "jefe" corto que un castigo seco.

---

### 2.9 Mario Party 9 (Wii, 2012)

**La ruptura.** Los 2-4 jugadores van en **un solo vehículo compartido**. El "Capitán" tira y mueve a todos, y **solo el Capitán** recibe el efecto de la casilla. Los minijuegos **no se juegan cada ronda**: solo al caer en casillas de minijuego. Cada tablero tiene **dos jefes obligatorios** (a la mitad y al final). **Se eliminan las monedas y la compra de estrellas**: solo hay **Mini Stars** (+1/+2/+3/+5) y **Mini Ztars** (−1/−2/−3/−5). Varios peligros te **quitan la MITAD** de tus Mini Stars.

**Lo nuevo.**
- **Jefes cooperativos con puntuación individual**: todos atacan al jefe y cada uno suma puntos. El golpe final da 3/5/10 extra. **14 minijuegos de jefe.**
- Minijuegos de Bowser Jr. (2 jugadores contra él).
- 21 tipos de casilla (el récord), **sin casillas rojas**.
- **Reparto de minijuegos para todos** (5/3/1 en 3 jugadores, según el modo Solo).
- Party Points + Museo (metaprogresión).

**Lo eliminado.** Monedas, compra de estrellas, estrella móvil, rojas, movimiento individual, tienda, objetos de ataque, **2v2 y 1v3**, minijuego por ronda.

**Errores (los más documentados de la serie).**
- **El vehículo compartido quita la agencia**: sin rutas propias ni sabotaje.
- "La suerte es el árbitro final" (GameSpot).
- Tableros **lineales y predecibles**: "una vez visto, se acabó la sorpresa".
- **Peligros que te quitan la mitad** borran las victorias en minijuegos.
- Premios de minijuego **demasiado planos** (el último casi gana lo mismo que el primero).
- Los dados especiales como único objeto: "terminas con el dado equivocado".
- Se pierden los formatos 2v2 y 1v3.

**Recepción.** Metacritic 73 (dividido), Famitsu 34/40, IGN 7, GameSpot 6. 3,11 M a 2020. Elogiados: los minijuegos y los gráficos.

**Qué nos llevamos.**
- **Los jefes cooperativos con puntuación individual**: son **el molde exacto** para el "minijuego largo y difícil, exclusivo del modo" que pidió el usuario.
- **Ritmo con hitos obligatorios** (jefe a la mitad + final).
- Un **viaje compartido como segmento especial**, nunca como juego completo. En Venezuela: **la camionetica** o el **ferry a Margarita**, unos turnos y luego cada uno sigue por su cuenta (inferido).
- Lo que **no**: moneda única, pérdida de "la mitad", premios planos, quitar 2v2/1v3.

---

### 2.10 Mario Party 10 (Wii U, 2015)

**Reglas base.** Igual que MP9 (vehículo, Capitán, Mini Stars, 2 jefes por tablero). Se empieza con 5 Mini Stars. Partidas de **~30 minutos**. Casilla **Steal** (roba 5, 10 o la mitad), que sustituye a Chance Time. **Gate Spaces**: hay que vencer a un Whomp para pasar.

**El candado de Bowser.** Bowser está encerrado en el GamePad con **6 candados, uno por cara del dado**. Cada tirada abre el candado de su número. **Quien abre el último pierde la mitad** de sus Mini Stars y Bowser queda suelto (aparecen casillas de Bowser).

**Lo nuevo.**
- **Bowser Party (1 vs 4 asimétrico)**: un jugador es Bowser con el GamePad y tira **4 dados con un reroll**. El equipo Mario (6 corazones cada uno) intenta llegar a la estrella. Si Bowser los alcanza, se juega un minijuego de Bowser Battle.
- **amiibo Party**: 10 turnos, tablero circular pequeño, **20 monedas = estrella** (la fórmula clásica escondida en un modo secundario).
- **Toad Road**: cruzar un hueco exige sumar 16 (con 4 jugadores), 12 (3) u 8 (2).
- Handicap pagado con Mini Stars (5/10/20).

**Bonus.** Solo **2 Bonus Mini Stars de 10** cada una (MP9 daba más, de 5). Criterios: por verificar.

**Errores.** Lo mismo que MP9 multiplicado: "el vehículo quita la estrategia y la puñalada" (Slant), azar, GamePad desaprovechado, Bowser Party con pocos minijuegos. Den of Geek pidió "enterrar la serie".

**Recepción.** Metacritic 66, **solo el 16 % de los críticos lo recomiendan** (OpenCritic). Lo más elogiado: la duración corta (~30 min), Bowser Party y amiibo Party.

**Qué nos llevamos.**
- **Reloj villano en forma de candados**: cada tirada lo acerca. Es una cuenta atrás visible y graciosa (inferido: "6 bombillos del apagón").
- Un **modo asimétrico 1 vs 3** como variante (Bowser Party) para el futuro.
- **Duración objetivo de 20-30 minutos.**
- **Puertas que exigen una suma de dados** (Toad Road) = **cruce cooperativo** del puente sobre el Lago (inferido).

---

### 2.11 Super Mario Party (Switch, 2018)

**El regreso.** Movimiento individual, monedas y estrellas de vuelta. Partidas de **10/15/20 turnos** (Kamek's Tantalizing Tower: 30). Solo 4 tableros + 1. Minijuego al final de cada ronda según el color.

**Lo nuevo.**
- **Dados de personaje**: cada personaje tiene un dado propio con riesgo y recompensa. Daisy (3,3,3,3,4,4), DK (0+5 monedas, 0,0,0,10,10), Bowser (0−3, 0−3, 1, 8, 9, 10). El dado normal es 1-6 (media 3,5).
- **Aliados**: casilla Ally y Ally Phone. **Cada aliado suma 1 o 2 a la tirada** (50 %) y **participa en los minijuegos por equipos**.
- **Estrella a 10 monedas**, vendida por **Toadette, que se va en globo a otro sitio** después de cada compra. Ruta alternativa: **Lakitu te vende una estrella por 30**.
- **Bonus Stars: pool de 11**, se dan 2 (10-15 turnos) o 3 (20+). Hay nuevas como **Slowpoke** (tirada total más baja), **Sightseer** (más casillas), **Unlucky**, **Ally**, **Buddy** (un aliado "de la suerte" elegido al empezar), **Rich** (todas las monedas ganadas, también las gastadas).
- **Casilla VS**: todos apuestan (cantidad por ruleta), se juega un minijuego y el ganador se lleva la mayor parte.
- **Últimos 3 turnos**: se sustituye el clásico "Last Five Turns" por predicciones de personajes y **Kamek, que convierte Bad Luck en Extra Bad Luck** (que puede quitar estrellas).
- **Partner Party** (2v2 en cuadrícula de movimiento libre, todo compartido, **pisar al rival roba 3-5 monedas**, high-five da bonus; payout ganadores 8 / perdedores 2).
- River Survival (co-op), Sound Stage (ritmo), Challenge Road, en línea desde 2021.

**Lo eliminado.** Last Five Turns clásico, jefes en el tablero, 50 turnos (máximo 30), Pro Controller y modo portátil.

**Errores.**
- **Pocos tableros** (4 + 1) y diseño de tablero flojo.
- IA débil, poco contenido para un jugador.
- Solo Joy-Con, en línea muy tarde y limitado.
- "Demasiado seguro".

**Recepción.** Metacritic 76. **El más vendido de la serie** (14,79 M a 2021; 21,36 M según la wiki, por verificar).

**Qué nos llevamos.**
- **Vendedor de estrellas itinerante** (Toadette en globo): obliga a decidir la ruta cada pocos turnos y se lee de un vistazo en el mapa.
- **Estrella barata respecto a los ingresos** (10 frente a +3 por casilla = 3-4 azules por estrella): decisiones frecuentes.
- **Ruta de estrella "cara"** (Lakitu por 30) como alternativa: atajo de pago = **avioneta a Los Roques** (inferido).
- **Dados de personaje** (o de región): asimetría sin sistemas extra.
- **Aliados** como incremento pequeño que no hace bola de nieve.
- **Pool grande de Bonus Stars con estadísticas variadas**: es literalmente lo que pidió el usuario.

---

### 2.12 Mario Party Superstars (Switch, 2021)

**Recopilación-remake.** 5 tableros de N64 (Yoshi's Tropical Island, Space Land, Peach's Birthday Cake, Woody Woods, Horror Land) y **100 minijuegos** clásicos + 5 de objeto. Dado 1-10 (sin dados de personaje), sin aliados. Star a 20, que se mueve, y **la cámara se aleja para mostrar el nuevo sitio**.

**Lo nuevo (calidad de vida).**
- **Añadir turnos** una vez por partida desde el menú (máximo 30).
- **Avance rápido** de los eventos del tablero.
- **Cada 5.º turno, el minijuego paga el doble.**
- **Bonus Stars en tres modos: On / Classic / Off.** "Classic" = el trío Rich, Minigame, Eventful. Normalmente 2, o 3 a 30 turnos. Nueva: **Bowser Space Star**.
- Banco: 3 al pasar (5 en los últimos 5 turnos).
- Tienda en cada tablero, con precios: Mushroom 3 (+5 a la tirada), Cursed Dice 3, Double Dice 5, Warp Block 7, Chomp Call 7, Triple Dice 10, **Custom Dice 12 (eliges 1-10)**, Plunder Chest 20, Golden Pipe 25 (a la estrella), Hidden-Block Card 40.
- **Boo**: robar monedas gratis o una estrella por 50. **King Boo's Stone** (de noche, 150 monedas) le roba una estrella a **cada** jugador.
- En línea completo, stickers, Mt. Minigames (Survival, Daily Challenge, etc.).

**Desglose de minijuegos:** 53 de 4P, 18 de 1v3, 18 de 2v2, 5 Duelos, 5 de objeto. **MP3 (27) y MP2 (21) son los que más aportan.**

**Errores.** Solo 5 tableros, **ninguna mecánica nueva** de tablero, azar (Chance Time, bonus stars), precio completo sin DLC.

**Recepción.** Metacritic **80** (el récord hasta Jamboree). 14 M vendidos. Elogio unánime: "volver a lo esencial sin gimmicks".

**Qué nos llevamos.**
- **Lo esencial es el producto**: tirar → mover → monedas → estrella → minijuego. La novedad va **encima**, no en lugar de.
- **Bonus Stars configurables** (On / Classic / Off).
- **Calidad de vida obligatoria**: avance rápido, cámara que enseña la estrella nueva, añadir turnos.
- **Ritmo de "cada 5.º minijuego vale el doble"**. Encaja con nuestra **ronda de 5 minijuegos rápidos** (inferido: el 5.º de la ronda paga ×2).
- **Precios de tienda bajos y legibles** (3-25).

---

### 2.13 Super Mario Party Jamboree (Switch, 2024)

**Reglas base.** Dado 1-10, monedas → estrellas, 7 tableros (5 nuevos). La estrella aparece en **Star Stop Signs** (sitios posibles marcados). Interacciones **al pasar** (Boo, tiendas, Star Exchange, Buddies). Duelos al coincidir en Homestretch.

**Lo nuevo.**
- **Jamboree Buddies.** Al pasar junto a un Buddy libre se juega un **Showdown** (el que pasa tiene una pequeña ventaja) y **el ganador lo recluta durante 3 turnos**. **Duplica el efecto de la casilla** donde caes (azul +6, roja −6) y tiene una pasiva:

| Buddy | Efecto |
|---|---|
| Mario | +3-8 a la tirada |
| Luigi | más probabilidad de tirada máxima |
| Peach | **estrellas a mitad de precio** |
| Daisy | objetos a mitad de precio |
| Wario | +3-8 monedas antes de tirar |
| Waluigi | roba 3-8 monedas a quien adelanta |
| Yoshi | copia un objeto |
| Rosalina | objeto barato gratis |
| DK | teletransporte al azar |
| Bowser Jr. | trampa de robar la mitad de las monedas |

  **Un rival que te pase te lo puede robar.**
- **37 objetos** (récord): Mushroom 3, Double Dice 5, Triple Dice 10 (pagan 20/50 si salen iguales), Payday Triple Dice 15, Custom Dice 12, Plunder Chest 20, Golden Pipe 25, Super Dueling Glove 40, Star Steal Trap, objetos exclusivos de cada tablero (Tide Shell, Tower Turner, Markup Sticker = **dobla los precios del rival**).
- **Stock de la tienda limitado: cada objeto solo se puede comprar 2 veces entre todos.** Frena la bola de nieve.
- **Homestretch.** Al final hay un evento especial (al azar o elegido): Mushroom gratis, +1 Star Exchange, Star Steal Trap para todos, Double Dice para todos, azul y rojo ×2, **monedas de todos ×2**, más casillas de Bowser, más Chance Time.
- **Pro Rules.** **12 turnos fijos**, minijuegos **votados**, **1 Bonus Star anunciada al empezar** (Sightseer, Slowpoke o Happening), sin Hidden Blocks, sin Chance Time, stock de 2 por objeto, Boo roba siempre 15, Lucky = **elegir** 10 monedas o Double Dice, Bowser cuesta siempre una estrella, apuesta VS siempre 20, Unlucky = 7 monedas al último.
- **Minijefes por tablero** (uno por cada tablero nuevo, con tiempo límite, gana la mayor puntuación), Kaboom-Squad (8 contra el Impostor Bowser), Koopathlon (20 en línea), Rhythm Kitchen.
- **9 Bonus Stars**: Minigame, Eventful, Misfortune, Sightseer, Item, Rich, Shopping, Slowpoke, Bowser Space. Se dan 2, o 3 a 30+ turnos.

**Errores.**
- **El modo estándar es lento** (GameSpot).
- Robos de estrellas tardíos y bonus stars de suerte que deciden partidas.
- Minijuegos de movimiento.
- **El Buddy puede consolidar al líder** (el que lo activa gana mucho).
- Con Pro Rules, según Slant, la partida a veces se decide temprano y se vuelve "una marcha predecible".

**Recepción.** Metacritic **82**, el máximo desde el original. IGN 9, Nintendo Life 9, GameSpot 6, Eurogamer 2/5. 8,64 M.

**Qué nos llevamos.**
- **Dos reglamentos**: "Caos" (todo el azar) y "Pro/Pana serio" (12 turnos, bonus anunciada, menos azar).
- **Bonus Star anunciada al principio**: convierte la suerte en objetivo visible.
- **Stock limitado por objeto**: la visita a la tienda se vuelve disputada.
- **Paradas "al pasar"**: todos tienen interés en los movimientos de los demás.
- **Buddies = panas venezolanos** (duplican la casilla, pasiva única, se pueden robar).
- **Homestretch con menú de eventos**: un cierre telegrafiado, no un golpe escondido.
- **Objetos exclusivos de cada tablero que reescriben el mapa** (Tide Shell = marea en Mochima).

---

### 2.14 Portátiles: DS (2007), Island Tour (2013), Star Rush (2016), The Top 100 (2017)

| | Mario Party DS | Island Tour | Star Rush | The Top 100 |
|---|---|---|---|---|
| Bucle | **Clásico** (monedas → estrella 20) | **Carrera** a la meta, sin monedas | **Tiempo real, todos a la vez** | Colección + Minigame Match |
| Dado | 1-10 | 1-6 | 1-6 simultáneo | — |
| Objetos | 3 + **Hexes** (trampas que pagan al que las pone) | dados/cartas, 1 por ronda | aliados + ? Blocks | ninguno |
| Novedad clave | Hexes, Star Pipe, varias compras por visita | Bowser's Tower (30 pisos, jefe cada 5) | Toad Scramble, aliados, **jefes en el tablero** | 100 remasters |
| Últimos 5 | **Final 5 Frenzy**: ruleta del último + Friend → Duel | — | — | — |
| Bonus | 3 (lista parcial: Minigame por **victorias**, Friendship, Hex, Running) | ninguna verificada | 3 de 10 (pagan monedas) | 3 (por verificar) |
| Metacritic | **72** | 57 | 68 | 59 |
| Crítica | sin juego en línea, parecido a los anteriores | "grind" repetitivo, sin 2v2 ni 1v3 | **mapas vacíos**, pocos minijuegos | contenido escaso |

**Detalles útiles.**
- **DS · Bowser**: Gimme Coins (−20), Gimme Stars (−1), Gimme Charity (das 10 a cada rival), **Gimme Equality (iguala las monedas de todos)**.
- **DS · Hexes**: trampas de 10 o 20 monedas, intercambio de monedas, 1 o 2 estrellas, intercambio de posición. **Pagan al que las pone.** Se lleva hasta 3.
- **Island Tour · dados por puesto**: oro (1-6) para el 1.º, plata (1-3), bronce (1-2), y **dados Bowser para el último**. Premia al líder: **error de diseño**.
- **Star Rush · fin de Toad Scramble**: 10 monedas = 1 estrella, más 3 categorías de bonus al azar que pagan monedas.
- **Star Rush · movimiento simultáneo**: elimina el tiempo muerto, pero con mapas vacíos aburre.

**Qué nos llevamos.**
- **La única portátil que mantuvo el bucle clásico (DS) es la mejor valorada.** Otra confirmación del núcleo.
- **Trampas asíncronas que pagan al que las coloca** (Hexes): interacción sin esperar.
- **Bowser "Equality"**: un evento igualador fácil de explicar.
- **"Mapa vacío" = muerte**: cada pocas casillas tiene que pasar algo.
- **Movimiento simultáneo** como idea para reducir la espera en el móvil (fase posterior).
- La **Battle Cup de DS (torneo de 5 minijuegos)** es el precedente más cercano a nuestra "ronda de 5 minijuegos seguidos".

---

## 3. Las cinco eras de la serie

| Era | Juegos | Rasgo dominante | Lo mejor | Lo peor |
|---|---|---|---|---|
| **I. Fundación (N64)** | MP1-3 | Se construye la fórmula y se le añaden objetos | Color de casilla → minijuego; 3 slots baratos (MP3) | Azar puro; palanca que lastima (MP1); Game Guy |
| **II. Experimentación con objetos (GameCube)** | MP4-7 | Cada juego reinventa los objetos: tamaño → cápsulas → orbs | Trampas en el tablero; estrella distinta por tablero (MP6); reloj de Bowser (MP7) | Motor reciclado; "más de lo mismo"; injusticias tipo Miracle Capsule |
| **III. Simplificación con movimiento (Wii)** | MP8 | Caramelos no colocables, control por movimiento | Catch-up programado (Chump Charity); hoteles | Lento, azaroso, presentación pobre |
| **IV. Ruptura (Wii/Wii U/3DS)** | MP9, MP10, Island Tour, Star Rush, Top 100 | Vehículo compartido, sin monedas, carreras | Jefes cooperativos; partidas cortas; Bowser Party | Pérdida de agencia; moneda única; tableros lineales; las peores notas |
| **V. Regreso y pulido (Switch)** | SMP, Superstars, Jamboree | Vuelve el núcleo y se añade una capa de "aliados" + calidad de vida | Estrella itinerante; Bonus configurables; Pro Rules; Buddies; stock limitado | Ritmo lento en estándar; azar final; pocos tableros (SMP, Superstars) |

**Patrón de fondo (inferido):** la serie **oscila** entre "añadir capas al núcleo" (éxito) y "reemplazar el núcleo" (fracaso). Cada vez que se tocó el bucle monedas → estrella individual, las notas cayeron. Cada vez que se añadió interactividad **encima** del bucle (objetos, trampas, aliados, reglas por tablero), las notas subieron o se mantuvieron.

---

## 4. Tendencias transversales

### 4.1 Objetos: de nada a 37

| Juego | Sistema | Máximo | Cómo se consiguen | Se colocan en el tablero | Clave |
|---|---|---|---|---|---|
| MP1 | — | — | — | no | Solo hongo de casilla |
| MP2 | Objetos | **1** | tienda (stock según turno y puesto), casilla Item | no | Primeros robos (Plunder, Boo) |
| MP3 | Objetos | **3** | tienda Toad + tienda Baby Bowser | no | Tienda buena contra tienda villana |
| MP4 | Objetos + tamaño | 3 | tienda | no (Sparky Sticker sí es trampa) | Mega/Mini |
| MP5 | **Cápsulas** | 3 (por verificar) | máquinas gratis | **sí, hasta 10 casillas** | Te podías dañar a ti mismo; usarla en ti costaba |
| MP6 | **Orbs** | por verificar | Orb Huts + casillas | **sí, hasta 5; inmunidad propia** | Character Space paga al dueño |
| MP7 | Orbs (5 clases) | por verificar | huts (mínimo 5 monedas para entrar) | sí, ±5 | Bowser Time te obliga a malas compras |
| MP8 | **Caramelos** | 3 (equipo 5) | tienda + ? Candy | **no** | Precio reducido para el último |
| MP9-10 | **Dados especiales** | por verificar | casillas, Toad House | no | Sin estrategia ("dado equivocado") |
| SMP | Objetos + **aliados** + dado de personaje | por verificar | casillas Item/Ally/Lucky | no | Aliado = +1/+2 y compañero de minijuego |
| Superstars | Clásico | 3 (convención) | tienda + Item minigame | no | Precios 3-40 |
| Jamboree | **37 objetos** + **Buddies** | por verificar | tienda (**stock 2 por objeto**), Lucky | trampas a ±2 | Objetos exclusivos de cada tablero |

**Lectura (inferido):**
1. El **máximo de 3** es el punto óptimo (MP3, MP4, MP8, DS, Superstars).
2. **Las trampas colocadas en el tablero** (MP5-7, DS Hexes, Star Steal Trap de Jamboree) son lo que hace "interactivo" el mapa, pero hacen falta **inmunidad del que lanza** y **alcance corto (≤5)**.
3. **Los objetos pasaron de "comprar" a "ganar"** (cápsulas gratis, orbs de casilla) y luego volvieron a "comprar con stock limitado". El precio bajo (3-15) hace que se usen. **El stock limitado** les da sentido.
4. **Los objetos tienen que generar decisiones**, no solo números. Los dados especiales de MP9 fallaron porque no había elección real.

### 4.2 La estrella: precio y ubicación

| Juego | Precio | Ubicación | Alternativas |
|---|---|---|---|
| MP1-5 | 20 | fija por tablero → se mueve tras cada compra (MP3 en adelante) | Boo Bell (50), Magic Lamp, Wiggler |
| MP6 | **5-40 según tablero/noche** | varía por tablero | robo con Chomp, Ztar, inicio con 5 |
| MP7 | 20, **10 en los últimos 4 turnos** | 9 sitios en Grand Canal | invertir en molinos, alquiler de Chomp, cofres |
| MP8 | gratis / 10 / 20 / hoteles | por tablero | hoteles, robo en Orbit |
| MP9-10 | **no hay compra** | — | Mini Stars por casilla |
| SMP | **10** | **Toadette itinerante** (globo) | Lakitu por 30 |
| Superstars | 20 | se mueve + la cámara lo muestra | Boo 50, King Boo 150, Golden Pipe 25 |
| Jamboree | 20 (por verificar) | Star Stop Signs | Peach Buddy = mitad; Super Dueling Glove 40 |

**Relación ingreso/precio (inferido):** con +3 por azul y ~10 por minijuego ganado, una estrella a 20 equivale a **~2 rondas buenas**. A 10 (SMP) equivale a **1 ronda buena**. Recomendación: **precio base 20 con descuentos y alternativas por región**. Como nuestra ronda de minijuegos es de 5 seguidos y paga más, el precio podría subir (lo veremos en el capítulo de economía).

### 4.3 Bonus Stars: de 3 fijas a 1 anunciada

| Juego | Pool | Se otorgan | Visibilidad | Empates |
|---|---|---|---|---|
| MP1-6 | 3 | 3 siempre | conocidas (siempre las mismas) | todos los empatados |
| MP7, MP8, (MP9, DS) | 6 | **3 al azar** | **ocultas hasta el final** | todos (excepto modos de equipo) |
| MP10 | 5 (por verificar) | 2 × 10 Mini Stars | por verificar | — |
| Star Rush | 10 | 3 al azar | ocultas | — |
| SMP | 11 | 2 (3 a 20+ turnos) | por verificar si se anuncian | todos |
| Superstars | 9 | 2 (3 a 30 turnos) | **On / Classic / Off** | todos |
| Jamboree | 9 | 2 (3 a 30+) | **Pro: 1 anunciada al empezar** | todos |

**Evolución de los criterios:**
- **Coin Star** (más monedas en cualquier momento) → **Orb Star** en MP6 (premiar usar, no acumular) → **Rich Star** (todas las monedas ganadas, también las gastadas) desde SMP.
- **Minigame Star**: primero por **monedas** de minijuegos, después (DS, MP9, Superstars, Jamboree) por **victorias**.
- Aparecen las **pity stars** (MP7 en adelante): Red/Unlucky/Misfortune, Slowpoke.
- Aparecen estrellas de **estilo de juego**: Running/Sightseer, Shopping, Item, Bowser Space.

**Debate de la comunidad (Kotaku):** un bando dice que "el drama es la gracia" y otro que "mi esfuerzo se borró". **La respuesta de la serie** fue dar control: Classic/Off en Superstars y la estrella anunciada de Pro Rules.

### 4.4 Eventos de los últimos turnos

| Juego | Nombre | Qué pasa |
|---|---|---|
| MP1 | Last Five Turns | azul/roja ×2, Koopa predice el ganador y da 20 al pasar |
| MP2 | Last Five Turns | ×2, predicción (+10 al predicho), duelo en la misma casilla |
| MP3 | Last Five Turns | ×2, predicción de la Millennium Star, duelos |
| MP4 | Last Five Turns | **el último gira ruleta** (×monedas, rojas→Bowser, rojas→Fortune, estrella regalo), lotería de tickets |
| MP5 | Last Five Turns | ruleta del último: ×3, rojas→Bowser, casillas→cápsula, **5 estrellas activas** |
| MP6 | Last Five Turns | ruleta del 4.º: ×3, +40, Character Spaces, **Bowser Revolution** |
| MP7 | Last Four Turns | ruleta del último equipo: ×3, +40, **estrella a mitad**, rojas→Bowser, Koopa Kids |
| MP8 | Chump Charity | Duelo Candy o 30 para el último + monedas sobre las rojas |
| DS | Final 5 Frenzy | ruleta del último (monedas o estrellas), Friend → Duel |
| MP9 | Almost There! | Slow Dice para el último y **elige el próximo minijuego** |
| MP10 | Homestretch | Slow Dice para el último |
| SMP | Últimos 3 | predicción (premio: objeto), azul/roja ±6, Extra Bad Luck |
| Superstars | Last Five Turns | ×2, predicción (+objeto y 10-20), banco 5, duelos |
| Jamboree | Homestretch | azul/roja ×2 (la wiki dice 12: por verificar), duelos, **un evento elegido o al azar de una lista** |

**Tres herramientas que se repiten:** (a) duplicar o triplicar las casillas, (b) **ruleta o regalo para el último lugar**, (c) **predicción del ganador** (inofensiva o con premio). Las entregas recientes **dejan elegir el evento**.

### 4.5 Catch-up / rubber-banding y la "frustración del 2.º lugar"

**Inventario de herramientas de catch-up en la serie:**

| Tipo | Ejemplos | Riesgo |
|---|---|---|
| Igualar monedas | Bowser Revolution (MP2, MP6), Gimme Equality (DS) | anula la habilidad en minijuegos (Game Informer, MP5) |
| Intercambios al azar | Chance Time (MP1-6, Superstars, Jamboree estándar) | "me robaron la partida" |
| Transferir estrellas | **Miracle Capsule** (MP5) | extremo: se retiró |
| Atacar al líder | Bowser Time (MP7), Koopa Kid roba al 1.º | puede ser divertido si es visible |
| Ayuda al último | ruletas de los últimos turnos, Chump Charity, Slow Dice, Bowser/Bullet Candy más barato, Unlucky da 7 al último (Pro) | la recibe solo el 4.º |
| Pity stars | Red/Unlucky/Slowpoke Star | se perciben como "premio a perder" |
| Estrella más barata al final | MP7 (10), DS (5 en algunos tableros) | razonable |
| Duplicar casillas al final | casi todas | neutral (ayuda al que tiene suerte) |

**La "frustración del 2.º lugar" (inferido; no aparece con ese nombre en las fuentes).** Casi toda la ayuda de la serie va **solo al último lugar** (la ruleta de MP4-7, Chump Charity, Slow Dice, el descuento de MP8), y casi todo el castigo va **al líder** (Bowser Time, Koopa Kid). Los jugadores **2.º y 3.º no reciben nada**, pese a ser los que tienen posibilidades reales de ganar. Además:
- Un evento igualador (Revolution) sube al 4.º y **pasa al 2.º por encima**.
- Las pity stars le dan una estrella al último y **empatan o adelantan al 2.º** en el recuento final.
- Las Bonus Stars al azar suelen decidir **entre el 1.º y el 2.º**, que es exactamente donde más duele.

**Respuesta de la serie:** pocas soluciones directas. Lo más cercano: Superstars "Classic/Off", la estrella anunciada de Pro Rules y el stock limitado de Jamboree (que frena la bola de nieve del líder sin regalarle nada a nadie).

**Recomendación (inferido):**
1. **Ayuda escalonada por distancia, no por puesto**: catch-up proporcional a "cuántas estrellas te faltan para el 1.º", para que el 2.º también reciba algo.
2. **Nunca transferencias totales** de estrellas.
3. **Bonus Stars visibles** (2 anunciadas + 1 graciosa oculta), para que el 2.º pueda **perseguir** una.
4. Las herramientas de catch-up deben ser **elecciones** (comprar, desviarse, apostar), no regalos al azar.

### 4.6 Duración de la partida

| Juego | Opciones de turnos | Notas |
|---|---|---|
| MP1-2 | 20/35/50 | partidas de más de 2 h a 50 turnos (inferido) |
| MP3-8 | 10-50 en pasos de 5 | MP4 Historia: 15 |
| MP9-10 | por longitud del tablero | MP10: **~30 min** (elogiado) |
| SMP | **10/15/20** (30 en la torre) | se eliminan los 50 turnos |
| Superstars | 10-30 + "añadir turnos" | máximo 30 |
| Jamboree | estándar (por verificar) / **Pro: 12** | "lento" en estándar |
| Star Rush / Top 100 | 10/20/30 | partidas cortas elogiadas |

**Tendencia:** de **50 turnos** a **10-20**, con un "Pro" de **12**. La queja de ritmo ("lento", "CPUs lentas", "mucho tiempo muerto") aparece en **MP1, MP2, MP3, MP4, MP7, MP8, Jamboree**. Es la queja más persistente de la serie. **Objetivo para nosotros: 20-30 minutos por partida y 60-90 segundos por turno de jugador.**

### 4.7 Aliados, compañeros y equipos

| Juego | Sistema | Efecto |
|---|---|---|
| MP3 | Duel Mode, compañeros (Toad, Koopa, Boo, Chomp) | salario, corazones; **demasiado complejo, no volvió** |
| MP5, MP7 | Team Match / Tag Battle | monedas compartidas; Tag: 2 dados de 1-5 |
| MP8 | Tag Battle | todo compartido, 5 caramelos por equipo |
| SMP | **Aliados** + Partner Party | +1/+2 a la tirada, compañero en minijuegos por equipos |
| Star Rush | Aliados (hasta 4) | dados extra + habilidades de campo |
| Jamboree | **Buddies** | 3 turnos, duplican la casilla, pasiva única, **se pueden robar** |

**Tendencia:** de sistemas complejos y permanentes (MP3) a **aliados temporales, robables y con efecto simple** (Jamboree). Eso es lo que funciona.

### 4.8 Minijuegos: formatos y asignación

- **Asignación por color de casilla** desde MP1. Se mantiene en casi todo. MP9-10, Island Tour y Star Rush la quitaron, y **perdieron 2v2/1v3**, cosa que la crítica señaló.
- **Formatos que aparecen y desaparecen:**

| Formato | Aparece | Estado |
|---|---|---|
| 4P / 2v2 / 1v3 | MP1 | núcleo permanente (salvo MP9-10, portátiles) |
| Batalla (pozo) | MP2 | 70/30 (MP2), 70/25/5/0 (MP6), 70/20/10/0 (Superstars) |
| Duelo | MP2 | apuesta; ruleta desde MP7 |
| Objeto | MP2 | vuelve en Superstars |
| Jefe | MP3 (Historia) | **cooperativo con puntuación individual en MP9-10**; minijefes en Jamboree |
| Bowser/DK | MP5-7 | MP8 los quita del tablero |
| 8 jugadores | MP7 | gimmick |
| Micrófono | MP6-7 | descartado |
| Movimiento | MP8 | opcional en Jamboree |
| Ritmo / co-op | SMP | Rhythm Kitchen en Jamboree |
| Votación del minijuego | MP6 (Batalla), Pro Rules | "control al jugador" |

- **Recuentos:** 50 → 64 → 71 → 60 → 77 → ? → 88 → 73 → 78 → 75 → 84 → 100 → 112. La crítica **castiga el reciclaje** (MP2, MP5, MP8) y **premia la variedad**.
- **Lo que nadie hizo:** una **ronda de 5 minijuegos rápidos seguidos** dentro del tablero (el más cercano es la Battle Cup de DS, fuera del tablero) y un **minijuego largo exclusivo** integrado como hito del tablero (el más cercano: los jefes de MP9-10 y los minijefes de Jamboree). **Ese es nuestro espacio de innovación.**

### 4.9 Interactividad del tablero

| Mecanismo | Primera aparición | Ejemplos |
|---|---|---|
| Peaje fijo | MP1 | Whomp 10 |
| **Peaje que escala** | MP1 | Thwomp 1→50 |
| Atajo de pago | MP1/MP5 | Magma Mountain, puentes de MP5 |
| Banco | MP2 | 5 al pasar, el pozo al que cae |
| Ciclo global | MP2 / MP6 | día/noche |
| Puerta con llave | MP2 | Skeleton Key |
| Flechas cambiantes | MP3 | Woody Woods |
| Estrella falsa | MP3 | Spiny Desert |
| Trampas colocables | MP5 | cápsulas, orbs, Hexes, Star Steal Trap |
| Reloj/desastre | MP7 | Bowser Time |
| Inversión | MP7/MP8 | molinos, hoteles |
| Reordenar el tablero | MP8 | mansión de King Boo, vagones de Kamek |
| Puerta por suma de dados | MP10 | Toad Road |
| Vendedor itinerante | SMP | Toadette |
| Objeto que reescribe el tablero | Jamboree | Tide Shell, Byway Lever, Tower Turner |
| Paradas al pasar | MP2 → Jamboree | tienda, Boo, Buddies |

**Patrón (de la investigación de interactividad):** cada buen tablero tiene **un estado global característico** que los jugadores **pagan por manipular**.

---

## 5. Errores que la serie corrigió (y los que nunca corrigió)

### 5.1 Errores corregidos

| Error | Dónde | Corrección | Dónde |
|---|---|---|---|
| Minijuegos de girar la palanca que lastimaban | MP1 | eliminados | MP2 |
| No había objetos | MP1 | 1 slot + tienda | MP2 |
| 1 slot, objetos caros | MP2 | 3 slots, 5-30 monedas | MP3 |
| Chance Time arbitrario temprano | MP1 | resultados limitados por fase | MP2/MP3 |
| Game Guy (todo o nada) | MP3 | desaparece | MP4 |
| Duel Mode de compañeros complejo | MP3 | desaparece | MP4 |
| Usar la cápsula en ti mismo costaba; podías dañarte | MP5 | orbs gratis para ti, inmunidad del que lanza, alcance 5 | MP6 |
| Miracle Capsule (todas las estrellas al último) | MP5 | eliminada | MP6 |
| Coin Star premiaba acumular | MP1-5 | Orb Star (premia usar) → Rich Star (total ganado) | MP6 / SMP |
| Estrella siempre a 20 → monótono | MP1-5 | precio/regla por tablero | MP6-8 |
| Bonus Stars siempre iguales | MP1-6 | pool al azar | MP7 |
| Bonus Stars al azar y ocultas | MP7-8 | On/Classic/Off; 1 anunciada (Pro) | Superstars / Jamboree |
| Vehículo compartido sin agencia | MP9-10 | movimiento individual | SMP |
| Sin monedas ni compra | MP9-10 | vuelve monedas → estrella | SMP |
| Sin 2v2/1v3 | MP9-10 | vuelven | SMP |
| Premios de minijuego planos | MP9 | 10 al ganador | SMP en adelante |
| Partidas de 50 turnos | MP1-8 | máximo 30; Pro 12 | SMP / Jamboree |
| Pocos tableros | SMP/Superstars | 7 tableros | Jamboree |
| Bola de nieve en la tienda | todos | stock de 2 por objeto | Jamboree |
| Sin juego en línea | MP1-10 | en línea | SMP (2021), Superstars |
| Animaciones lentas | todos | avance rápido | Superstars |

### 5.2 Errores que nunca se resolvieron del todo

1. **El ritmo.** Se repite de MP1 a Jamboree. Ni Pro Rules lo resuelve del todo (inferido: la espera **mientras otros juegan su turno** es el problema estructural).
2. **El azar al final decide partidas** (bonus stars, robos tardíos). Solo se mitiga con opciones.
3. **La ayuda va solo al último** (frustración del 2.º, ver 4.5).
4. **CPUs flojas o lentas.** Se critica en MP3, MP4, MP7, SMP.
5. **Reciclaje** de motor y minijuegos: MP2, MP5, MP6, MP8, MP10.

---

## 6. Recepción vs. decisiones de diseño

| Decisión | Juegos | Metacritic medio (aprox.) |
|---|---|---|
| Fórmula clásica (monedas → estrella individual) | MP1-8, DS, SMP, Superstars, Jamboree | ~72 |
| Vehículo compartido / sin monedas | MP9, MP10 | ~70 (con caída clara de MP9 a MP10) |
| Carrera / tiempo real sin bucle clásico | Island Tour, Star Rush, Top 100 | ~61 |
| Regreso con calidad de vida (era Switch) | SMP, Superstars, Jamboree | **~79** |

(Medias calculadas a mano con los datos de la tabla 1; MP2 sin Metacritic, se omite.)

**Ventas:** el mayor éxito comercial (SMP, ~15-21 M) y los récords de crítica (Superstars 80, Jamboree 82) son **todos de la era de regreso**. Los mínimos de crítica (Island Tour 57, Top 100 59, MP8 ~62, MP7 64) son entregas que **quitaron profundidad al tablero o no innovaron nada**.

---

## 7. Best-of: qué copiar de cada entrega

Lista de lo que entra en el diseño del modo fiesta, con el juego de origen y su versión venezolana propuesta (todas las versiones venezolanas son **inferidas**, propuestas de diseño).

### 7.1 Núcleo (obligatorio)

| # | Qué copiar | De dónde | Versión Venezuela |
|---|---|---|---|
| 1 | Bucle monedas → estrella, movimiento individual, dado 1-10 | MP1 / Superstars | "Reales" o "lochas" → estrella; cada pana con su ficha |
| 2 | Color de casilla decide 4P / 2v2 / 1v3 | MP1 | adaptado a la ronda de 5 (ver capítulo de minijuegos) |
| 3 | Estrella que **se mueve** tras cada compra + cámara que la muestra | MP3 / Superstars | la estrella "se muda" de ciudad |
| 4 | **Vendedor itinerante** | SMP (Toadette) | un personaje que va en **camionetica** de ciudad en ciudad |
| 5 | Comprar la estrella **al pasar** | MP2 | no hace falta caer exacto |
| 6 | Turnos 10/15/20 + modo corto de 12 | SMP / Jamboree Pro | partidas de 20-30 minutos |
| 7 | Avance rápido de eventos | Superstars | obligatorio en el móvil |
| 8 | Red de seguridad de 0 monedas | MP7 | "el banco te da 10 por lástima" (estado *Pelao*) |

### 7.2 Objetos y ataques

| # | Qué copiar | De dónde | Versión Venezuela |
|---|---|---|---|
| 9 | **3 slots**, objetos baratos (3-25) | MP3 / Superstars | — |
| 10 | Tienda buena + tienda villana | MP3 (Toad/Baby Bowser) | **Bodega** (ayuda) / **Bachaquero** (ataques) |
| 11 | **Stock limitado por objeto** (2 en total) | Jamboree | "se acabó, mi pana" |
| 12 | Trampas colocables a ≤5 casillas, **inmunidad del que lanza** | MP6 | conos, huecos, "alcabala portátil" |
| 13 | Casilla propia que paga al dueño | MP6 (Character Space) / DS (Hexes) | "kiosko" del jugador que cobra 5 |
| 14 | Pares ataque ↔ defensa | MP4 / MP5 (Gaddlight, Bone) | Zancudo ↔ Repelente; Apagón ↔ Planta eléctrica |
| 15 | Precio de ataque reducido para quien va atrás | MP8 | descuento escalonado por distancia (ver 4.5) |
| 16 | Objetos exclusivos de región que reescriben el mapa | Jamboree (Tide Shell, Byway Lever) | marea en Mochima, palanca del Puente sobre el Lago |
| 17 | Custom Dice (eliges la tirada) | Superstars | "Dado arreglado" caro |

### 7.3 Interactividad del mapa

| # | Qué copiar | De dónde | Versión Venezuela |
|---|---|---|---|
| 18 | **Regla de estrella distinta por región** | MP6 / MP7 / MP8 | Caracas clásica, Anzoátegui = pozo petrolero (invertir), Canaima = estrella cara en el Salto Ángel, Delta = estrella falsa |
| 19 | **Peaje que escala** | MP1 (Thwomp) | **alcabala**: la "colaboración" sube con cada pago |
| 20 | Guardia que se mueve a la ruta popular | Superstars (Whomp de Horror Land) | guardia que cambia de alcabala |
| 21 | Ciclo global que cambia reglas | MP2 / MP6 | **luz / apagón** cada 3 turnos; pagar para "prender la planta" |
| 22 | Transporte con dirección por dado que arrolla | MP2 (Steamer) | **Metro de Caracas** / Ferrocarril |
| 23 | Teletransporte pagado | Superstars (Mr. I) | avioneta a Los Roques, ferry a Margarita, teleférico de Mérida |
| 24 | Banco | MP2 | "la vaca" |
| 25 | Inversión que paga estrellas | MP7 / MP8 | pozo petrolero, posada en Margarita |
| 26 | Puerta por suma de dados | MP10 (Toad Road) | cruce cooperativo |
| 27 | Reordenar parte del tablero | MP8 (King Boo) | **Deltamacura**: "el GPS dice recalculando" |
| 28 | Mini-evento de apuesta (1 en 8) | MP7 (Hopscotch) | rayo del Catatumbo |
| 29 | Paradas "al pasar" (tienda, robo, reclutamiento) | MP2 → Jamboree | buhonero que te vende al pasar |

### 7.4 Aliados

| # | Qué copiar | De dónde | Versión Venezuela |
|---|---|---|---|
| 30 | Aliado temporal (3 turnos), robable, duplica la casilla, pasiva única | Jamboree Buddies | **Panas**: la abuela (estrella a mitad), el tío que sabe de todo, el bachaquero… |
| 31 | Reclutamiento por **Showdown** | Jamboree | minijuego corto al pasar junto al pana |
| 32 | Aliado = +1/+2 en dado y compañero en 2v2 | SMP | — |

### 7.5 Minijuegos

| # | Qué copiar | De dónde | Versión Venezuela |
|---|---|---|---|
| 33 | Pozo de batalla 70/20/10/0 | Superstars (MP2: 70/30) | "la vaca del minijuego" |
| 34 | Duelo con apuesta | MP2 / MP7 | "¡echa pa'cá!" |
| 35 | Cada 5.º minijuego paga ×2 | Superstars | **el 5.º de la ronda paga doble** |
| 36 | **Jefe cooperativo con puntuación individual + bonus por el golpe final** | MP9 | el minijuego largo exclusivo: jefes de región (reutilizar los jefes alcabala/metro/arepa como plantilla) |
| 37 | Minijefe con tiempo límite, gana la mayor puntuación | Jamboree | — |
| 38 | Votación del minijuego (modo Pro) | MP6 / Pro Rules | — |
| 39 | Mínimo de pool por formato (4/3/3/2) | MP4 | lista mínima del MVP |
| 40 | Filtro de "solo fáciles" | MP3 | para jugar en familia |

### 7.6 Final y balance

| # | Qué copiar | De dónde | Versión Venezuela |
|---|---|---|---|
| 41 | Pool grande de Bonus Stars por estadística | SMP / Jamboree | Estrella del Bachaquero, del Apagón, de la Cola, del Pana… |
| 42 | **Bonus Stars visibles** (anunciadas al empezar) + **On/Classic/Off** | Jamboree Pro / Superstars | 2 anunciadas + 1 graciosa oculta (*Metida de Pata*) |
| 43 | Rich Star = total ganado (no saldo) | SMP | — |
| 44 | Empates: todos se la llevan | MP1 en adelante | — |
| 45 | **Homestretch con menú de eventos** | Jamboree | "¡Último autobús!": el último elige 1 de 3 eventos |
| 46 | Duplicar casillas al final | MP1 en adelante | — |
| 47 | Predicción del ganador (se equivoca adrede) | MP1-3 / SMP | el narrador "echa el cuento" y falla |
| 48 | Reloj villano visible | MP7 (Bowser Time) / MP10 (candados) | barra del apagón que sube con cada minijuego |
| 49 | Estrella más barata al final | MP7 | "remate de fin de mes" |
| 50 | Dos reglamentos (Caos / Pro) | Jamboree | "Modo Rumba" / "Modo Serio" |

---

## 8. Lo que NO hay que copiar

| No copiar | Juego | Por qué |
|---|---|---|
| Vehículo compartido como modo principal | MP9-10 | quita la agencia (crítica unánime) |
| Moneda única sin compra de estrella | MP9-10, Island Tour | todo se vuelve azar |
| Perder **la mitad** de tus recursos por una casilla | MP9-10 | borra las victorias en minijuegos |
| Transferencia total de estrellas | MP5 (Miracle Capsule) | injusto |
| Game Guy (apostar todo) | MP3 | la queja más grande de su juego |
| Premios de minijuego planos | MP9 | el rendimiento deja de importar |
| Dados especiales como único objeto | MP9-10 | no hay decisiones |
| Recompensar por puesto con dados mejores (premia al líder) | Island Tour | bola de nieve |
| Control que cansa la mano | MP1 | lesiones |
| Gimmicks de hardware (micrófono, 8 jugadores con mandos compartidos) | MP6-7 | descartados; en web no aplica |
| Restricciones que no se ven en la UI | MP4 (Mini) | frustración |
| Partidas de 50 turnos | MP1-8 | ritmo |
| Mapas vacíos | Star Rush | aburrimiento |
| Bonus Stars ocultas y al azar como única opción | MP7-8 | "me robaron" |
| Reciclar sin un gancho nuevo | MP2, MP5, MP8, MP10 | "más de lo mismo" |
| Modos complejos permanentes (compañeros con salario) | MP3 Duel Mode | nunca volvió |

---

## 9. Pendientes de verificación

Datos marcados **(por verificar)** antes de copiar números exactos:

1. MP1: número total de minijuegos (~50) y cómo se usaban en partida los dados comprados en la tienda de Mushroom Village.
2. MP2: dado 1-10 confirmado para MP2; premios exactos por minijuego; si la estrella se mueve; ventas (~2,5 M).
3. MP3: duelo al caer en la casilla de un rival en los últimos 5 turnos; regla de empate de las Bonus Stars (la wiki dice "compartida", Wikipedia dice "dado"); coste del Boo Bell para robar una estrella.
4. MP4: nombres de los tableros; importes de la casilla de Bowser; Green Space; mecánica de regalos del modo Historia. **Corrección**: la investigación decía que MP4 "reemplazó los orbs de MP3"; los orbs son de MP6.
5. MP5: tope de cápsulas; reparto de monedas en 2v2/1v3; si las Bonus Stars eran fijas o al azar.
6. MP6: qué dos tableros mantienen la estrella a 20; contenido exacto de la ruleta de los últimos 5 turnos; tope de orbs; recuento de minijuegos.
7. MP7: precios de los orbs; tope; premios por minijuego; ventas.
8. MP8: opciones de turnos; monedas iniciales; sexta Bonus Star (Happening o Green); correspondencia exacta de precios de los caramelos con cada tablero.
9. MP9: número de turnos; criterios y número de Bonus Mini Stars; reparto en 4 jugadores.
10. MP10: criterios de las 2 Bonus Mini Stars; reglas de selección de minijuegos; desempate.
11. SMP: tope de inventario y precios; 11.º criterio de Bonus Star (la wiki listaba un "Orb Star" que parece un error); si las bonus se anuncian; cifra de 21,36 M.
12. Superstars: lista exacta de turnos; monedas iniciales; si "On" sortea al azar; comportamiento del Item Bag.
13. Jamboree: precio de la estrella (se supone 20); opciones de turnos en el modo estándar; **valor de las casillas en Homestretch (la wiki dice 12, en contra de 3×2 = 6)**; premios por puesto en los minijuegos; desempate.
14. DS: número de Bonus Stars por partida y las dos categorías que faltan; los "100/300 estrellas" del Final 5 Frenzy.
15. Star Rush: precios de la tienda Shy Guy; reglas de Rhythm Recital y Challenge Tower.
16. General: **no se consultaron Reddit, Fandom ni YouTube** (GMTK, retrospectivas). Conviene hacer una segunda pasada antes de fijar los números de balance.

---

*Siguiente capítulo sugerido: economía y números del modo fiesta (precio de la estrella frente a los ingresos de la ronda de 5 minijuegos), usando la tabla 4.2 y el best-of 7.1-7.6 como punto de partida.*
