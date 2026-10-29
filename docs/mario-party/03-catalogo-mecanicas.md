# 03 · Catálogo de mecánicas de tablero

> Modo fiesta para 2 a 4 jugadores en un mapa gigante de Venezuela, en la línea de Mario Party.
> Este documento recoge las mecánicas de tablero de toda la serie (MP1 a Jamboree, más DS, Island Tour, Star Rush y Top 100). Para cada una indica la regla, cuándo funciona, qué riesgo tiene, cuánto cuesta implementarla en el canvas 2D del style-lab y si entra en la v1.
> Base: la investigación por juego y por tema del flujo `docs/mario-party/`. Lo que no se pudo confirmar va marcado **(por verificar)**.

---

## 0. Cómo leer este catálogo

### 0.1 Etiquetas

| Etiqueta | Significado |
|---|---|
| **MUST** | Sin esto no es un Mario Party. Entra en la v1. |
| **SHOULD** | Le da la identidad y la interactividad que pidió el usuario. Entra en la v1 si el calendario aguanta, y si no, en la v1.1. |
| **COULD** | Es un buen extra, pero puede esperar a v2 o a otros mapas. |
| **NO** | Es un antipatrón documentado. No se implementa, o solo con cambios grandes. |

### 0.2 Dificultad de implementación (canvas 2D, motor style-lab, hot-seat)

Las estimaciones suponen el motor actual: `engine.js` + `campana.js`, un lienzo lógico de 800×600, entrada global de un solo jugador y sin cámara.

| Nivel | Esfuerzo aproximado | Qué suele implicar |
|---|---|---|
| **S** | Menos de 1 día | Datos y una regla de estado. Se resuelve con un `if` en el resolvedor de casillas y un texto o animación genérica (popup, monedas que vuelan). |
| **M** | 1 a 3 días | UI propia (ruleta, selector de objetivo, tienda), animación específica en el mapa, estado persistente entre turnos o lógica de IA para la CPU. |
| **L** | Más de 3 días | Sistema nuevo: cámara o pan del mapa, entrada simultánea por jugador, un minijuego nuevo, reglas que cambian el grafo del tablero o mucha IA. |

Supuestos técnicos (ver el scout del repo):

- La v1 es **hot-seat en una sola pantalla**. Los minijuegos simultáneos requieren un enrutador de entrada por jugador, que hoy no existe. Eso convierte en **L** cualquier mecánica que dependa de jugar a la vez.
- El tablero es un **grafo de nodos** (casillas) con aristas dirigidas y bifurcaciones. Casi todas las mecánicas de mapa se reducen a: (a) un efecto al **caer**, (b) un efecto al **pasar**, (c) un cambio en el grafo (abrir o cerrar aristas, mover nodos especiales).
- Cada mecánica debería **alimentar al menos un contador de estadísticas** para las estrellas bonus (§14).

### 0.3 Números ancla de la economía (propuesta)

Estos valores vienen de la serie y sirven de referencia en todo el catálogo. Son una propuesta para balancear con pruebas; no son definitivos.

| Parámetro | Serie | Propuesta v1 | Nota |
|---|---|---|---|
| Monedas iniciales | 10 (MP4–MP7, convención de la serie) | **10** | |
| Casilla azul | +3 | **+3** | Se duplica en los últimos 5 turnos. |
| Casilla roja | −3 | **−3** | Se duplica en los últimos 5 turnos. Nunca baja de 0. |
| Precio de la estrella | 20 (clásico) / 10 (SMP) | **20** | 10 en promociones o en los últimos turnos. |
| Dado | 1–10 (clásico) / 1–6 (SMP, Island Tour) | **1–10** | Un mapa enorme necesita avance rápido. |
| Ganar un minijuego normal | 10 | Ronda rápida: **4/2/1/0** por microjuego (5 seguidos, máximo 20). Minijuego largo: **10/6/3/0**. | Propuesta propia: el pedido de "5 rápidos seguidos" no existe en la serie. |
| Duración | 10–50 turnos | **12 (Pro) / 20 (Normal)** | Objetivo: 30 a 45 minutos. |
| Objetos en mano | 1 (MP2) / 3 (MP3+) | **3** | |

Regla práctica: con +3 por casilla azul, una estrella de 20 equivale a unas 7 casillas azules o una buena ronda de minijuegos más un poco de suerte. Si se cambia el precio de la estrella, hay que reajustar el resto.

---

## 1. Casillas (spaces)

### 1.1 Casillas base

| ID | Mecánica | Regla (números) | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| C01 | **Azul** ("¡Chévere!") | Al caer: +3 monedas (+6 en los últimos 5 turnos). Define el "color" del jugador para formar equipos. | Siempre. Es el ingreso estable y la casilla más común (≈60–70 % del tablero). | Si hay demasiadas, el tablero se vuelve plano. | S | **MUST** | MP1→Jamboree |
| C02 | **Roja** ("¡Qué molleja!") | Al caer: −3 (−6 al final). Mínimo 0. | ≈10–15 % del tablero, cerca de atajos y estrellas, para que haya riesgo. | Si se concentran en un solo camino, ese camino nadie lo toma. | S | **MUST** | MP1→ |
| C03 | **Evento / ? / Happening** | Dispara un evento propio de la región (ver §13). Cuenta para la estrella bonus "Evento". | Es lo que conecta el mapa con el humor local. Unas 1 o 2 por región. | Si el evento es largo o de puro azar, frena el ritmo. Tope: 6–8 s de animación con opción de saltar. | M (cada evento suma) | **MUST** | MP1→ |
| C04 | **Casilla de estrella** (estática) | Al **pasar**, si tienes ≥20, te ofrece comprar. No consume paso (MP1). | Junto con C05 es la tensión central del juego. | Ninguno. | S | **MUST** | MP1→ |
| C05 | **Estrella que se muda** | Tras cada compra, la estrella salta a otra ubicación candidata, casi siempre azul, nunca a ≤10 casillas del comprador. | Obliga a decidir rutas todo el tiempo. | Si cae siempre lejos del último jugador, refuerza al líder. Conviene sesgar hacia el centro de masa de los jugadores (§8). | M (incluye cámara o zoom-out para mostrarla) | **MUST** | MP3→ |
| C06 | **Bowser / Villano** ("La Alcabala del Tigre", "El Bachaquero") | Ruleta de castigos: −10 a −20 monedas, −1 estrella (solo en modo Caos), "Revolución" (reparte las monedas por igual entre todos) o minijuego de castigo. Si el jugador tiene 0 monedas, recibe 10 de lástima. | Dramatismo y vía de remontada. 1 o 2 por región. | Quitar media fortuna o una estrella por pura suerte se siente injusto (crítica a MP9, Jamboree). Topar el daño y mostrar la ruleta. | M | **MUST** | MP1→ |
| C07 | **Chance Time** ("¡Se fue el dólar!") | Tres bloques (quién da, quién recibe, qué): 10/20/30 monedas, 1 estrella, intercambio de monedas, intercambio de estrellas. Los intercambios solo se habilitan después del turno 5. | Remontadas espectaculares que la mesa recuerda. | Puede borrar 15 turnos de buen juego. Se desactiva en modo Pro (como Jamboree Pro Rules). | M | **SHOULD** | MP1→, sin Pro |
| C08 | **Objeto** | Da un objeto aleatorio (ponderado por posición) o lanza un mini-minijuego de 1 jugador por un objeto (MP2). | Mantiene vivo el inventario sin obligar a ir a la tienda. | Si los objetos son muy fuertes, es otra fuente de suerte. | S (aleatorio) / M (con minijuego) | **MUST** (versión S) | MP2→ |
| C09 | **Suerte** | Ruleta positiva: monedas, un objeto o "próxima estrella a mitad de precio". En Pro: eliges entre 10 monedas o Doble Dado. | Da elección (agencia) al jugador, sobre todo en modo Pro. | Poco. | S | **SHOULD** | Superstars, Jamboree |
| C10 | **Mala suerte** ("Pelao") | Ruleta negativa: perder monedas, darle 7 monedas al último lugar, recibir un objeto maldito (Loadstone). | Contrapeso de C09; puede ayudar al último. | Acumular castigos aburre. | S | **SHOULD** | SMP, Jamboree |
| C11 | **VS / Batalla** | Todos ponen monedas en un pote (ruleta: 5/10/20). Minijuego de 4. Reparto 70/20/10/0. La casilla se vuelve azul después. | Interacción directa y transferencia de riqueza decidida con habilidad. | Si el pote es muy grande, se pierde el colchón del último. Tope: el pote no supera la mitad de las monedas de nadie. | M | **SHOULD** | MP2 (Battle), SMP/Superstars (VS) |
| C12 | **Duelo** | El que cae elige rival, apuesta (monedas o 1 estrella si ambos tienen) y juegan un minijuego 1v1. Apuesta limitada por el más pobre. | Rivalidades directas ("te vi venir, pana"). | Elegir siempre al líder es lo óptimo, y eso está bien: es una remontada. | M | **MUST** (el usuario pidió minijuegos de 2) | MP2→ |
| C13 | **Banco** ("La Vaca", "Caja de ahorro") | Al pasar se pagan 3 (5 al final) al banco. Quien cae se lleva todo el pote. 2 o 3 por mapa. | Crea pozos visibles que generan tensión con cada tirada. | Puede dar un premio de 40+ monedas sin mérito; aun así es simple y divertido. | S | **SHOULD** | MP2, MP3, Superstars |
| C14 | **Adelante / Atrás** | +2..+4 casillas, o retroceder 1..4. | Muy barato para agitar el ritmo. | Retroceder un turno completo se siente injusto (Space Land). Se usa poco y con mucho humor. | S | **COULD** | MP9, MP10, Island Tour |
| C15 | **Casilla de jefe / mini-jefe** | Al caer en la casilla del jefe regional, se lanza el **minijuego largo** de 4 (cooperativo con puntuación individual). | Cumple el pedido de "minijuego más largo y difícil" ligado al mapa. | Si se lanza demasiado seguido, satura. Máximo 1 vez por región por partida. | L (minijuego nuevo) | **MUST** (al menos 1 jefe) | MP9, MP10, Jamboree |
| C16 | **Casilla de personaje** (propia) | Un objeto convierte una casilla azul en tuya: cuando un rival cae, te paga 5. Tú cobras 5 al caer. | Interactividad persistente en el mapa. | Hay que mostrarla con el color del dueño. Ojo con el desorden visual en mapa grande. | M | **COULD** | MP6, MP7 |
| C17 | **Trampa / Hex** | Trampa colocada (por objeto o en un "Hex Area"): −10 o −20 monedas, robo de 1 estrella, intercambio de monedas o de posición con quien la puso. Se consume al activarse. | Ataque asíncrono: atacas sin esperar tu turno. | Una trampa de 1 estrella invisible frustra. Las trampas siempre se ven. | M | **SHOULD** | MP5, MP6, DS, Jamboree |
| C18 | **Casilla oculta / Bloque escondido** | Al caer en una azul hay ~1/40 de probabilidad de un bloque con monedas o una estrella. | Sorpresa y algo para contar. | Suerte pura. En modo Pro se apaga. | S | **COULD** | MP2→ |
| C19 | **Aliado / Pana** | Da un pana aleatorio (§15). | Si el sistema de panas está implementado. | Depende de §15. | S | **COULD** | SMP |
| C20 | **Inicio** | Al pasar se cobra +10 (Koopa de MP1, que da la vuelta). | Hace que valga la pena completar vueltas en mapas con circuito. | El mapa de Venezuela no es un circuito único. Ver G05 para la versión "regreso a Caracas". | S | **SHOULD** | MP1, Superstars |
| C21 | **Casilla verde (neutra/aleatoria)** | No hace nada, pero se convierte al azar en azul o roja para formar los equipos del minijuego. | Llena espacios de tránsito (carreteras largas). | Si hay muchas, el mapa se vuelve vacío (crítica a Star Rush). | S | **COULD** | SMP |
| C22 | **Casilla de transporte** (parada) | Entrada a un sistema de transporte (§6). | Hace el mapa enorme navegable. | Ver §6. | M | **MUST** (al menos 1 tipo) | MP2 Western Land, Horror Land |

**Proporción sugerida por región (unas 30 casillas):** 18 azules · 4 rojas · 2 evento · 1 objeto · 1 suerte/mala suerte · 1 villano · 1 duelo o VS · 1 banco o especial · 1 parada de transporte.
Referencia: Grand Canal (MP7) tiene 70 casillas: 48 azules, 9 rojas, 7 verdes, 2 de micrófono, 2 de duelo y 2 de DK.

---

## 2. Objetos (items)

**Reglas generales propuestas:** un máximo de **3 en mano**. Se usan **antes de tirar** (1 por turno, como en Island Tour). Con la mano llena hay que descartar uno. Los objetos de la tienda tienen **stock limitado por partida** (Jamboree: 2 por objeto para todos), salvo los básicos.

### 2.1 Dados y movimiento (sobre uno mismo)

| ID | Objeto (nombre VE) | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| O01 | **Doble Dado** ("Dos por uno") | Tiras 2 dados. Si salen iguales, +10 monedas (dos 7: +30). | Llegar a la estrella o a un atajo lejano. | Ninguno; es el objeto ancla. Precio 5. | S | **MUST** | MP2 Mushroom, MP4, DS, Jamboree |
| O02 | **Triple Dado** ("Pabellón") | 3 dados. Si salen iguales: +20 o +30 (triple 7: +50). | Para cruzar regiones enteras. | Avance de 3 a 30. Precio 10–15. | S | **MUST** | MP2 Golden Mushroom→ |
| O03 | **Champiñón +N** ("Malta con leche") | +3 o +5 al resultado. | Ajuste fino para no pasarse de la estrella. | Ninguno. Precio 3. | S | **SHOULD** | Superstars, SMP |
| O04 | **Dado personalizado** ("Dato del vecino") | Eliges el número del 1 al 10. | Caer exacto en una estrella, un banco o un duelo. | Muy fuerte. Precio 12 con stock de 2. | S (UI de elegir número) | **MUST** | MP Superstars, Jamboree |
| O05 | **Dado lento** ("Camionetica sin frenos" al revés) | Dado del 1 al 3, o tirada lenta que se puede detener a mano. | Detenerse antes de una roja o en una casilla buena. | Ninguno. | S | **COULD** | MP3, MP9 Slow, Jamboree Creepy |
| O06 | **Tubo / Avioneta dorada** ("Pasaje a Los Roques") | Te teletransporta junto a la estrella. **Igual pagas la estrella.** | Es la jugada épica cuando la estrella está lejos. | Precio alto (25–30) y stock de 1. Si no, se vuelve dominante. | M (animación de viaje + cámara) | **SHOULD** | MP2 Magic Lamp, MP6 Flutter, Superstars Golden Pipe |
| O07 | **Warp / intercambio de lugar** ("Cola colada") | Cambias de lugar con un rival al azar (Warp Block) o elegido (versión Super, sin venta). | Remontada barata: llegar a la zona de la estrella. | Si el objetivo se elige, castiga siempre al líder. Así está bien, pero conviene que la versión elegida sea rara. | M | **MUST** | MP1→ |
| O08 | **Llave** ("Pase de la Guardia") | Abre una puerta cerrada o un atajo (§5). No se descarta (MP2). | Hace atractivo un atajo de llave. | Si no hay puertas cerca, ocupa espacio en la mano. Que la puerta se vea desde lejos. | S (con puertas ya hechas) | **SHOULD** | MP2, MP3, Superstars |
| O09 | **Saltar casillas** ("Paracaídas del Salto Ángel") | Durante el movimiento puedes **saltarte** hasta N casillas sin activarlas (ni rojas ni trampas), o saltar un hueco del mapa. | Responde al pedido literal de "saltar espacios con objetos". | Puede evitar todo castigo. Limitar a 1 uso y a ≤5 casillas. | M | **MUST** (lo pidió el usuario) | Variante propia; afín a MP4 Mini (tubos pequeños) |
| O10 | **Ticket de transporte** ("Boleto del Metro") | Llama al tren o metro a tu estación o te da un viaje gratis. El precio sube con cada compra. | Si el sistema de transporte de §6 existe. | Depende de §6. | S | **COULD** | MP2 Steamer Ticket, Jamboree |

### 2.2 Ataques (sobre otros)

| ID | Objeto | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| A01 | **Dado maldito** ("Señal caída") | El rival que elijas tira del 1 al 3 en su próximo turno. | Frenar al que está a punto de llegar a la estrella. | Bajo. Precio 3–5. | S | **MUST** | MP3 Poison, Superstars Cursed |
| A02 | **Super dado maldito** | Todos los rivales tiran del 1 al 3. | Último turno antes de la estrella. | Fuerte. Precio 15 con stock de 1. | S | **COULD** | Jamboree |
| A03 | **Robo de objeto** ("Bachaquero") | Robas un objeto al azar a un rival elegido. | Cuando alguien guarda un Dado Personalizado o un Pasaje. | Bajo. Precio 10–20. | S | **SHOULD** | MP2 Plunder Chest→ |
| A04 | **Robo de monedas al pasar** ("Waluigi"/"Malandro de caricatura") | Durante tu movimiento, a cada rival que pases le quitas 3–8 monedas (o 10). | Atravesar una zona llena de jugadores. | Contra un grupo junto puede ser enorme. Tope de 20 por turno. | M (detectar a los que pasas) | **SHOULD** | MP2 Bowser Suit, MP8 Bowlo, Jamboree |
| A05 | **Boo / robo pagado** ("El vivo") | Pagas 5 por robar hasta 15 monedas (fijo en Pro), o 50 por robar 1 estrella. | Remontada cara pero clara. | Robar estrellas es lo más polémico. En Pro se cobra 50 y no hay ruleta de cuánto. | M | **MUST** (el robo de estrella con precio alto) | MP2→Jamboree |
| A06 | **Duelo con guante** ("Te reto, pana") | Inicias un duelo desde cualquier lugar. Versión Super: apuesta 1 estrella. | Rivalidades; complementa C12. | La versión Super es para el final o con stock de 1. | S (si C12 existe) | **SHOULD** | MP2, MP3, Jamboree |
| A07 | **Trampa colocable** ("Hueco en la vía") | Pones una trampa hasta 2–5 casillas adelante o atrás: −10 monedas, −mitad, o robo de estrella. **Quien la pone es inmune.** | Interacción asíncrona que hace "vivo" el mapa. | Evitar el robo de estrella invisible: la trampa siempre se ve. Rango de 5 (MP6 corrigió los 10 de MP5). | M | **SHOULD** | MP5 Capsule, MP6 Orb, Jamboree Trap |
| A08 | **Mitad de monedas** ("Inflación", "Cashzap") | El objetivo pierde la mitad de sus monedas (se destruyen, no se roban). | Frenar a un líder muy rico. | El 50 % es de los castigos que más frustran (crítica a MP9). Tope de 20 monedas. | S | **COULD** | MP8 Cashzap, Thwomp |
| A09 | **Mandar al inicio** ("Bloway", "Chancla de mamá") | Quien sea tocado vuelve a la casilla de inicio de su región (no del mapa entero). | Momento de comedia. | Volver al inicio de un mapa enorme es demasiado. Siempre al inicio de la **región**. | M | **SHOULD** (el usuario pidió "mover al inicio") | MP6 Klepto, MP8 Bloway, MP2 trenes |
| A10 | **Subir precios** ("Markup / Dólar paralelo") | Duplica los precios de la tienda y de la estrella para un rival hasta el final de su próximo turno. | Bloquear a quien llega a la estrella con 20 justas. | Bajo. Es muy temático. | S | **SHOULD** | Jamboree Markup Sticker |
| A11 | **Objeto maldito no descartable** ("Loadstone", "Tobo vacío") | Ocupa una casilla de la mano y no se puede descartar por 3 turnos. Se le puede regalar a otro. | Gag y "papa caliente". | Poco. | S | **COULD** | Jamboree Loadstone, Island Tour Bowser Card |
| A12 | **Mover la estrella** ("Chomp Call", "Remolino del Catatumbo") | La estrella cambia de lugar (al azar o a un sitio elegido). | Cuando un rival está a 2 casillas de ella. | Que la versión elegida sea cara (15–20). | M | **SHOULD** | MP4 Chomp Call, MP5 Tweester, Superstars |
| A13 | **Mover a un rival** ("Tweester", "Peñero") | Empuja a un rival 1 a 5 casillas o a otra casilla elegida. | Sacar a alguien de la ruta de la estrella. | Medio. | M | **COULD** | MP6 Tweester, Island Tour Setback Shell |

### 2.3 Defensa y utilidad

| ID | Objeto | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| D01 | **Repelente** ("Vela/Linterna" contra el apagón, "Ajo" contra el vivo) | Bloquea un robo (Boo) o un ataque específico. Se consume automáticamente. | Si los robos de §2.2 aparecen a menudo. | Si el counter es muy fuerte, invalida los ataques. Que sea específico para un solo ataque. | S | **SHOULD** | MP3 Boo Repellant, MP6 Snack/Boo-Away |
| D02 | **Metal / inmune** ("Ruana") | Durante 1 turno las trampas y rojas no te afectan. | Atravesar zonas minadas. | Poco. | S | **COULD** | MP6 Metal Mushroom |
| D03 | **Bolsa sorpresa** ("Caja misteriosa") | Da 1 a 3 objetos al azar. | Gag. Vale la pena con la mano vacía. | Precio 25–30. | S | **SHOULD** | MP3/4 Item Bag, DS Grab Bag |
| D04 | **Teléfono de tienda** ("Delivery", "Cellular Shopper") | Compras en la tienda sin estar ahí. | Mapa enorme con pocas tiendas. | Le quita valor a la posición de las tiendas. Precio 5 con stock limitado. | M | **COULD** | MP3, Jamboree |
| D05 | **Tarjeta de bloque oculto** | La próxima casilla donde caigas tiene un bloque oculto (monedas o estrella). | Agrega suerte pagada. | Medio. Precio 20–40. | S | **COULD** | DS Block Sensor, Superstars |
| D06 | **Doble estrella** ("Cachito doble") | La próxima compra de estrella te da 2. No se vende; solo sale de eventos raros. | Remontada épica. | Muy fuerte. Solo como premio de un jefe o de un evento final. | S | **COULD** | Superstars, Star Rush |

---

## 3. Tiendas

| ID | Mecánica | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| T01 | **Tienda fija al pasar** ("Bodega", "Farmacia de guardia") | Al pasar por ella (sin caer) puedes comprar. Se pueden comprar varios objetos por visita (DS). Exige ≥3 monedas para entrar. | Siempre. Es el centro de la capa de decisiones. 1 por región. | Una UI lenta frena el turno. Máximo 6 objetos visibles y compra con 1 toque. | M | **MUST** | MP2→ |
| T02 | **Stock limitado por objeto** | Cada objeto se vende como máximo 2 veces en toda la partida, sumando a todos los jugadores. | Evita el efecto bola de nieve y crea carreras por los objetos buenos. | Hay que mostrar "quedan 1". | S | **SHOULD** | Jamboree Pro |
| T03 | **Stock según posición** | La tienda ofrece objetos distintos según tu puesto (al último le salen ataques o Pasaje). | Remontada discreta. | Si es invisible, nadie lo nota. | S | **COULD** | MP2 (por turno y rango) |
| T04 | **Tienda del villano** ("Bachaquero", tienda de Baby Bowser) | Vende solo ataques y objetos malos, más caros, y a veces obliga a comprar. | Separa visualmente lo bueno de lo malo; es un acierto de UX (MP3). | Las compras forzadas frustran. Que sean un evento raro. | M | **SHOULD** | MP3 Baby Bowser, MP7 Bowser Time |
| T05 | **Tienda con regateo** ("Mercado de Quinta Crespo") | Un microjuego de 5 s fija el descuento (0–50 %). | Mezcla habilidad y economía. Es muy local. | Alarga el turno. Que sea opcional. | M | **COULD** | Propio |
| T06 | **Ofertas relámpago** ("Rebaja del bodegón") | Cada 3 turnos, una tienda al azar tiene un objeto a mitad de precio. | Da motivos para desviarse. | Poco. | S | **COULD** | Jamboree Flash Sale (Rainbow Galleria) |
| T07 | **Precio inflado global** ("Dólar paralelo") | Cada ronda, una ruleta fija un multiplicador de precios (0,75× / 1× / 1,25×) para estrella y tienda. | Gag central del humor venezolano, que además cambia decisiones. | Puede sentirse arbitrario. Que se anuncie **antes** de los turnos. | S | **SHOULD** | MP6 Faire Square (precio con dado), propio |
| T08 | **Buhonero ambulante** | Un NPC que se mueve por el mapa vende 1 objeto al azar a quien pase a su lado. | Llena las carreteras largas. | Poco. | M (NPC móvil) | **COULD** | SMP Toadette móvil (análogo) |

**Precios de referencia (Superstars / Jamboree):** Champiñón 3 · Dado maldito 3 · Llave 3 · Doble Dado 5 · Warp 7 · Triple Dado 10 · Dado Personalizado 12 · Robo de objeto 20 · Tubo dorado 25 · Tarjeta de bloque oculto 40 · Guante Super 40.

---

## 4. La estrella: precio y ubicación

| ID | Mecánica | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| E01 | **Precio fijo de 20** | Una sola cifra que todos entienden. | Siempre. | Ninguno. | S | **MUST** | MP1→Superstars |
| E02 | **Reubicación tras compra** | La estrella salta a una de N ubicaciones candidatas (MP7 Grand Canal: 9). | Siempre. | Sesgo. Ver E03. | M | **MUST** | MP3→ |
| E03 | **Ubicación justa** | Al reubicar, se excluyen las ubicaciones a ≤10 casillas de cualquier jugador y se prefieren las que equilibran la distancia promedio. Variante Pro: la estrella aparece solo en los "Star Stop Signs" marcados. | Evita que caiga al lado del líder. | Más código, pero sin sorpresas. | M | **SHOULD** | Jamboree Pro, propio |
| E04 | **Vendedor móvil** ("La señora de las empanadas" como Toadette) | La estrella la vende un NPC que se mueve, y se compra al pasarle. | Mapas abiertos. | Ninguno. | M | **COULD** | SMP |
| E05 | **Precio por región** | Cada región vende la estrella a su manera: Caracas 20, Los Roques 30 con regalo, Salto Ángel gratis tras un desafío, etc. | **La identidad de cada región.** MP6 y MP8 lo hicieron por tablero; aquí sería dentro de un solo mapa. | Si es complejo, nadie lo entiende. Un cartel por región con el precio. | M (por cada variante) | **SHOULD** | MP6, MP7, MP8 |
| E06 | **Estrella por inversión** ("Pozo petrolero" en la Faja / hoteles) | Pagas monedas a un pozo (o "hotel"). Al subir de nivel (20 → 2 estrellas, 50 → 3) cobras estrellas, y otros pueden superar tu inversión y quitártelo. | Estrategia de largo plazo; muy local. | Necesita UI clara de quién manda en el pozo. | L | **COULD** | MP7 Windmillville, MP8 Tycoon Town |
| E07 | **Estrellas múltiples** | Durante un evento hay 2 a 5 estrellas activas a la vez. | Final del juego (MP5) o eventos de región. | Inflación de estrellas. Solo de forma temporal. | M | **SHOULD** (como evento final) | MP5, Jamboree Homestretch |
| E08 | **Estrella falsa** ("Ztar", "El mundo perdido") | Una de dos estrellas es falsa: te cobra y no te da nada, o te quita. Un objeto (lámpara) revela la real. | Gag de región misteriosa (Deltamacura). | Si no hay pista, es pura trampa. Que haya alguna pista visual. | M | **COULD** | MP3 Spiny Desert, MP2 Ztar |
| E09 | **Descuento al final** | La estrella cuesta 10 en los últimos 4–5 turnos. | Remontada. | Ninguno. | S | **SHOULD** | MP7 |
| E10 | **Estrella por desafío** | Pagas 10 y juegas un microjuego de riesgo (Hopscotch: 1/8). Si ganas, estrella; si pierdes, −10. | Salto Ángel: "te lanzas o no". | Suerte pura si no hay habilidad. Que haya habilidad. | M | **SHOULD** | MP7 Enchanted Inferno |
| E11 | **Estrella por colecta** ("20 monedas del Shy Guy") | Un evento verde: juntas 20 monedas en una mini-tarea y te dan una estrella. | Eventos de región. | Poco. | M | **COULD** | MP7 Grand Canal |

---

## 5. Peajes, puertas y atajos

| ID | Mecánica | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| P01 | **Peaje fijo** ("Peaje de la Autopista") | Pagas 5 (o 10) para tomar el camino corto. Si no pagas, tomas el largo. | **La base de "pagar por interactividad"**. Una decisión clara. | Ninguno. | S | **MUST** | MP1 Whomp, MP5 puentes |
| P02 | **Peaje escalonado** ("Alcabala con mordida") | El primer pago es 1. Cada pago sube el precio en +1 (o según lo que pagó el anterior), con tope de 50. | Se vuelve más caro según se usa; muy local. | Hay que mostrar el precio en el mapa. | S | **SHOULD** | MP1 Yoshi's Tropical Island (Thwomp) |
| P03 | **Guardia que se mueve** ("Guardia de la alcabala") | Bloquea una de dos ramas. Si tomas la libre, el guardia se mueve a esa rama. Pagar 5 lo hace a un lado. | Rutas que cambian solas según la mesa. | Poco. | M | **SHOULD** | Horror Land Whomp |
| P04 | **Puerta con llave** | Solo se abre con O08. | Combina tienda y mapa. | Que no bloquee un atajo vital: que haya alternativa. | S | **SHOULD** | MP2, MP3, Superstars |
| P05 | **Teleférico / viaje pagado** ("Mukumbarí", "Teleférico del Ávila") | Pagas 10 de día o 5 de noche y saltas al otro extremo. **Arrastra a quien esté en la casilla destino.** | Movilidad en un mapa enorme y "saltar espacios" pagando. | Poco. | M | **MUST** | Horror Land Mr. I |
| P06 | **Ferry / lancha** ("Ferry a Margarita") | 5 monedas, o todo lo que tengas si te quedan ≤5, para ir de muelle a muelle. | Para las islas. | Ninguno. | S | **MUST** (Margarita/Los Roques) | MP2 Pirate Land |
| P07 | **Atajo arriesgado** ("Carretera del Pittier", "Montaña rusa") | Atajo gratis pero lleno de rojas o de un evento de riesgo (50 %: llegas, o te mareas y pierdes el turno). | Decisión de riesgo frente a seguridad. | Poco. | S | **SHOULD** | MP7 roller coaster, Peach's Cake |
| P08 | **Puente que se cae** | Un puente se destruye por evento y lo cierra durante N turnos, y la gente tiene que rodear. | Mapa vivo. | Hay que recalcular rutas y que la IA lo sepa. | M | **COULD** | MP7 Bowser Time |
| P09 | **Requisito de tirada colectiva** ("Toad Road") | Un hueco solo se cruza si la tirada (o la suma) llega a 8/12/16. | Interacción entre jugadores. | Confuso en hot-seat. | M | **COULD** | MP10 |
| P10 | **Tubería / cañón** ("Cañón del Morro") | Teletransporte fijo entre dos casillas, gratis o pagado. | Conectar regiones lejanas. | Ninguno. | S | **SHOULD** | Watermelon Walkabout, Inferno cannons |
| P11 | **Frontera / cambio de moneda** ("Paso a Cúcuta") | Peaje en el que cambias monedas por un objeto o pagas para pasar. | Gag local. | Ojo con el tono. | S | **COULD** | Propio |

---

## 6. Transporte compartido (sistemas que mueven a varios)

| ID | Mecánica | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| R01 | **Tren con dirección al azar** ("Metro de Caracas", "Ferrocarril") | Pagas 3–5. Un bloque decide la dirección (adelante o atrás). Se detiene en la próxima estación. **Atropella a quien esté en la vía y lo manda al inicio de la región.** | Momento de risa y "mover al inicio". | Hay que mostrar la ruta antes. | M | **SHOULD** | MP2 Western Land, Jamboree |
| R02 | **Camionetica por puesto** | Una parada que te lleva a otra ciudad, pero el chofer "improvisa" (ruleta de 3 destinos). | Reutiliza el reparto de BUS (BAJA, ENCALETA, AGÁRRATE). | Poco. | M | **SHOULD** | Propio (afín a R01) |
| R03 | **Vehículo compartido** (todos en el mismo vehículo, solo tira el capitán) | Todos avanzan juntos y la casilla solo afecta al capitán. | **Solo** como segmento especial y breve (por ejemplo, una ruta en camionetica). | MP9 y MP10 fueron muy criticados por quitarle agencia al jugador. **No como sistema principal.** | L | **NO** como base / COULD como segmento | MP9, MP10 |
| R04 | **Avioneta** ("Maiquetía → Los Roques/Canaima") | Viaje pagado (15–20) entre aeropuertos. | Atajos entre extremos del mapa. | Poco. | S | **SHOULD** | Variante de P05 |

---

## 7. Cambios de ruta y relojes globales

| ID | Mecánica | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| G01 | **Flechas que cambian** ("Rotonda de Altamira") | En una bifurcación, la flecha cambia cada turno o se cambia pagando 5. | Rutas dinámicas. | Poco. | S | **SHOULD** | MP3 Woody Woods, Superstars |
| G02 | **Palanca de dirección** | Invierte el sentido de un tramo. | Sabotaje de ruta. | Hay que recalcular el grafo. | M | **COULD** | Jamboree Bowser Byway |
| G03 | **Ciclo global día/noche → "Luz / Apagón"** | Cada 3 turnos cambia. En apagón: robos más baratos, tiendas cerradas, otros eventos y tinte de noche (el NIVEL del style-lab ya tiene día/atardecer/noche). Se puede pagar 10 para "prender la planta". | **La firma del mapa.** Cambia reglas, no solo la apariencia. | Si solo es cosmético, no aporta. Tiene que cambiar al menos 2 reglas. | M | **SHOULD** | MP2 Horror Land, MP6 |
| G04 | **Marea / creciente** ("Creciente del Apure", "Marea de Mochima") | Un objeto o evento sube o baja el agua, lo que abre o cierra caminos. | Cambia el grafo según el momento. | IA y rutas. | M | **COULD** | Jamboree Goomba Lagoon |
| G05 | **Hundimiento periódico** ("Inundación del Delta") | Cada 5 turnos, la isla o región donde está la estrella se inunda: quien esté ahí pierde la mitad de sus monedas (tope 20) y vuelve al inicio de la región, y la estrella se reubica. | Reloj de villano visible; arma contra el líder. | Castigo fuerte; anunciarlo con 1 turno de anticipación. | M | **SHOULD** | MP7 Bowser Time |
| G06 | **Barra de villano** ("Medidor de apagón", "Candados de Bowser") | Cada minijuego o tirada llena una barra (20 % o un candado por cara de dado). Al llenarse, el villano actúa (contra el líder o contra quien la completó). | Convierte el azar en una cuenta regresiva que se ve. | Poco. | M | **SHOULD** | MP7 gauge, MP10 6 candados |
| G07 | **Reordenar el mapa** ("Deltamacura: el GPS dice recalculando") | Una región cuyas casillas se barajan (posición de eventos, flechas y estrella) cada vez que alguien compra o cada N turnos. | Una región "rara" con reglas propias. | Confunde si afecta a todo el mapa. **Solo una región.** | M | **SHOULD** (identidad de Deltamacura) | MP8 King Boo, MP8 Perplex Express |
| G08 | **Torre / rotador** | Un objeto gira una torre o intercambia NPCs y cambia qué sale. | Gag local. | Poco. | M | **COULD** | Jamboree Tower Turner |

---

## 8. Intercambio de lugares y "mover a alguien al inicio"

| ID | Mecánica | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| X01 | **Swap al azar** | Cambias de posición con un rival al azar. | Remontada barata. | Bajo. | S | **MUST** (ya está en O07) | MP1→ |
| X02 | **Swap elegido** ("Telenovela": dos jugadores cambian de lugar con diálogo dramático) | Eliges con quién cambiar. | Evento de Chance o premio. | Siempre lleva al líder. Que no se venda. | S | **SHOULD** | Jamboree Swap Mirror |
| X03 | **Volver al inicio de la región** | Efecto de tren, cañón, inundación, chancla. | Comedia. | No al inicio del mapa entero. | S | **MUST** (pedido) | MP2 Pirate Land cannons, Steamer, MP7 |
| X04 | **Procesión** ("Divina Pastora") | Todos los jugadores se juntan en una casilla elegida al azar o en la del que activó el evento. | Caos y duelos en el final. | Con respeto religioso. Aleatoriza mucho. | M | **COULD** | Propio (análogo a MP4 Warp Space) |
| X05 | **Ir a donde está otro** ("Klepto", "Springo") | Te mueves a la posición de un rival elegido. | Llegar a la estrella aprovechando a otro. | Poco. | S | **COULD** | MP5, MP8 |
| X06 | **Reordenar la clasificación** (Island Tour Switch-Place) | El primero pasa al último de la carrera. | Solo en un modo carrera. | No aplica a la economía de estrellas. | — | **NO** | Island Tour |

---

## 9. Redistribución (catch-up) y robos de estrellas

| ID | Mecánica | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| K01 | **Revolución / reparto parejo** ("Gas por bombona", "Reparto") | Las monedas de todos se suman y se reparten por igual. | Evento raro del villano o del final. | Borra la ventaja; es polémico. Una vez por partida como máximo. | S | **SHOULD** | MP2 Bowser Revolution, MP6, DS Gimme Equality |
| K02 | **Potluck escalonado** | El villano cobra 10/20/30 a todos según la fase (inicio, medio, final). Si todos están en 0, reparte 10. | Sumidero de monedas que se ve. | Poco. | S | **COULD** | MP2 |
| K03 | **Caridad al último** ("Último autobús", "Chump Charity") | A 5 turnos del final, el último recibe un objeto o 30 monedas, más bolsas de monedas en las rojas. | Remontada clara. | Poco. | S | **MUST** | MP8, DS, MP9/10 |
| K04 | **Ataques baratos para el último** | Los objetos de ataque le cuestan la mitad al último lugar. | Remontada discreta. | Poco. | S | **SHOULD** | MP8 Bowser/Bullet Candy |
| K05 | **Miracle: estrellas del primero al último** | Tres cápsulas iguales pasan todas las estrellas del líder al último. | — | Antipatrón: borra el juego. | — | **NO** | MP5 (eliminado en MP6) |
| K06 | **Mitad de todo por peligro** | Peligros que quitan la mitad de la moneda principal. | — | Crítica fuerte a MP9. Si se usa, con tope fijo (máximo 20). | — | **NO** (sin tope) | MP9 |
| K07 | **Handicap inicial** | Estrellas iniciales opcionales (0–3) por jugador. | Grupos con niveles de habilidad muy distintos (niños y adultos). | Ninguno. | S | **SHOULD** | MP5, MP10 |

---

## 10. Duelos, batallas y tipo de minijuego

| ID | Mecánica | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| M01 | **Tipo por color de casilla** | Al cerrar la ronda: todos del mismo color → 4P. 3+1 → 1v3. 2+2 → 2v2. Verde/evento → color al azar. | Conecta el tablero con el minijuego. Es elegante y emergente. | Con la "ronda rápida de 5", hay que decidir si el color define las 5 o solo la primera. Propuesta: define el **formato del bloque**. | S | **MUST** | MP1→SMP |
| M02 | **Ronda rápida de 5** (pedido del usuario) | Al final de cada ronda de turnos, 5 microjuegos seguidos de 5–15 s (reutilizando los 40 del lab). Puntos por puesto: 4/2/1/0 cada uno. | Encaja con el ADN del repo (microjuegos estilo WarioWare). | Los microjuegos actuales son de 1 jugador y binarios (win/lose). En hot-seat: cada jugador hace el mismo juego con semilla y gana el más rápido. Necesita RNG con semilla y una métrica de tiempo. | L | **MUST** | Propio (afín a MP DS Battle Cup y Superstars x2 cada 5) |
| M03 | **Minijuego largo y difícil** (pedido) | Cada 5 turnos (o en la casilla de jefe), un minijuego de 60–120 s con fases, cooperativo contra un jefe regional y con puntuación individual (bonus por el golpe final: +3/+5/+10). | Ritmo y momento épico. Se basa en los jefes multifase del lab (alcabala, metro, arepa). | Alto costo de contenido. Que haya 1 por región como máximo. | L | **MUST** | MP9/MP10 jefes, Jamboree, DS Boss Bash |
| M04 | **Duelo 1v1** | Desde una casilla (C12), un guante (A06) o al coincidir 2 en una casilla en los últimos 5 turnos. | El usuario pidió "minijuegos de 2". | En hot-seat, por turnos con semilla. | M | **MUST** | MP2→ |
| M05 | **Batalla con pote** | Todos aportan (5–20), el pote se reparte 70/20/10/0 (o 70/30/0/0). | Transfiere monedas con habilidad. | Tope en el aporte. | M | **SHOULD** | MP2, MP6, Superstars |
| M06 | **Minijuego de villano** | El que cae en el villano juega solo. Si pierde, pierde 10 o un objeto. | Agrega suspenso al castigo. | Poco. | M | **COULD** | MP3–MP7 |
| M07 | **1v3 asimétrico** | El solitario contra un equipo de 3. El premio del solitario es mayor (por ejemplo 10 frente a 3 cada uno). | Variedad. | Necesita minijuegos asimétricos nuevos. | L | **SHOULD** | MP1→ |
| M08 | **2v2 por equipos** | Equipos por color. | Cooperación. | Necesita minijuegos nuevos o reglas de suma de tiempos. | M (con semilla y suma) / L (simultáneo) | **SHOULD** | MP1→ |
| M09 | **Votar el minijuego** | La mesa vota entre 2 o 3 opciones, o elige el último. | Agencia, sobre todo en modo Pro. | Poco. | S | **COULD** | MP6 Battle, Jamboree Pro |
| M10 | **Doble pago cada 5º turno** | El minijuego del turno múltiplo de 5 paga el doble. | Ritmo y ráfagas de impulso. | Poco. | S | **SHOULD** | Superstars |
| M11 | **Micrófono / giroscopio** | — | — | No funciona bien en web; MP6/MP7 lo usaron como truco. | — | **NO** | MP6, MP7 |
| M12 | **Giro de stick** | — | — | Lesiones (ampollas en MP1). En táctil, reemplazar por tap o deslizar. | — | **NO** | MP1 |

---

## 11. Jefes y villanos en el mapa

| ID | Mecánica | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| J01 | **Jefe regional en casilla** | Uno por región (por ejemplo "El Tigre de la Alcabala", "Mega Zancudo del Delta", "El Guardián de Guri"). Al caer, se lanza M03. Premios: 1º 10 monedas + objeto, 2º 6, 3º 3. Si el grupo pierde, todos −5. | Momento épico ligado a un lugar. | Contenido caro. | L | **MUST** (1 jefe en v1) | Jamboree mini-bosses, MP9 |
| J02 | **Jefe a mitad y al final** | Jefe en la mitad del juego (turno 6/10) y jefe final antes de la ceremonia. | Picos de ritmo. | Puede alargar la partida. | M (con J01 listo) | **SHOULD** | MP9, MP10 |
| J03 | **Villano itinerante** ("El bachaquero") | Un NPC que se mueve N casillas por ronda y roba al que alcanza. | Peligro que se ve en el mapa. | IA simple. | M | **COULD** | MP10 Bowser liberado, Jamboree Impostor Bowser |
| J04 | **Modo asimétrico 1 contra 3** | Un jugador es el villano durante toda la partida. | Otro modo de juego. | Es un modo completo. | L | **COULD** (v2) | MP10 Bowser Party |
| J05 | **Kaboom / co-op masivo** | — | — | Fuera de alcance (8 jugadores). | — | **NO** | Jamboree |

---

## 12. Eventos de fin de partida ("Últimos 5 turnos")

| ID | Mecánica | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| F01 | **Anuncio de posiciones** | El narrador (mamá o abuela) muestra la tabla y "predice" al ganador, y se equivoca a propósito. Si acierta, el predicho recibe 10. | Drama y risa. | Ninguno. | S | **MUST** | MP1–3, SMP, Superstars |
| F02 | **Doblar azules y rojas** | +6 / −6. | Siempre en el final. | Poco. | S | **MUST** | MP1→ |
| F03 | **Ruleta del último** | El último gira una ruleta: monedas triples, +40 al último, estrella a mitad de precio, rojas → villano, 5 estrellas activas o Revolución. | Remontada con agencia. | Que cada opción se vea antes. | M | **MUST** | MP4–MP7, DS |
| F04 | **Duelo por coincidencia** | Si dos jugadores caen en la misma casilla, duelo. | Cierre caótico. | Poco. | S (con M04) | **SHOULD** | MP2, MP3, Superstars, Jamboree |
| F05 | **Evento votado** (Homestretch) | La mesa elige 1 de 3 eventos y el último tiene un voto extra. | Agencia colectiva. | Poco. | M | **SHOULD** | Jamboree, propuesta de la investigación |
| F06 | **Agregar turnos** | Una vez por partida, se puede agregar +5 turnos (tope 30). | Calidad de vida. | Ninguno. | S | **COULD** | Superstars |

---

## 13. Eventos de región (casillas "?")

Formato: una tabla de eventos por región con 4–6 resultados ponderados. Cada evento dura ≤8 s y se puede saltar.

| ID | Mecánica | Ejemplo VE | Regla | Dif | v1 |
|---|---|---|---|---|---|
| V01 | **Evento de monedas aleatorio** | Rayo del Catatumbo | 50 %: +10; 30 %: −5; 20 %: el rayo cae sobre otro jugador al azar (−10 para él). | S | **MUST** |
| V02 | **Evento de movimiento** | Metro lleno | Te mueve de 1 a 3 casillas al azar en la red. | S | **MUST** |
| V03 | **Evento de estado** | Frío de Mérida | Pierdes el próximo turno salvo que tengas una Ruana (D02). | S | **SHOULD** |
| V04 | **Evento de inversión** | Pozo de la Faja | Inviertes X; al final recuperas X×1,5 o 0. | M | **COULD** |
| V05 | **Evento retrasado** | "Ahorita" | El efecto ocurre dentro de 1 a 5 turnos (gag de la impuntualidad). | M | **SHOULD** |
| V06 | **Evento de swap** | Deltamacura | Intercambias monedas con un jugador al azar, o el mapa se reordena (G07). | S | **MUST** |
| V07 | **Evento de juntar a todos** | Procesión (X04) | Todos van a una casilla. | M | **COULD** |
| V08 | **Evento global de precio** | Inflación / dólar paralelo (T07) | El precio de la estrella cambia esta ronda. | S | **SHOULD** |
| V09 | **Mini-evento en el mapa** | Sumo con el Koopa (MP7) → "Pelea de almohadas con el primo" | Microjuego de 5 s en el tablero: gana +20, pierde −10. | M | **COULD** |
| V10 | **Evento apuesta** | Ruleta del casino de Margarita | Apuestas 10, 1/3 de triplicar. | S | **COULD** |

---

## 14. Estrellas bonus (por estadísticas)

**Regla propuesta:** 2 estrellas bonus **anunciadas al inicio** (o 3 a partir de 20 turnos), más 1 "chistosa" oculta (máximo 1 por partida, y solo en modo Caos). Cuando hay empate, la estrella se la llevan todos los empatados. Ninguna estadística en 0 gana: piden un mínimo de 1, y la de monedas un mínimo de 3. Existe la opción **Clásica** (Rico, Minijuego, Evento) y la opción **Apagadas**.

| ID | Estrella (VE) | Contador exacto | Origen | Dif | v1 |
|---|---|---|---|---|---|
| B01 | **Estrella del Rico** | Suma de toda moneda ganada (no resta gastos ni pérdidas) | MP1 Coin, SMP Rich | S | **MUST** |
| B02 | **Estrella del Campeón** | Primeros lugares en minijuegos (rápidos + largos; los empates suman a todos) | MP1 Minigame → DS (victorias) | S | **MUST** |
| B03 | **Estrella del Chismoso** (Evento) | Caídas en "?" y "!" | MP1 Happening | S | **MUST** |
| B04 | **Estrella del Caminante** | Casillas avanzadas por dado (sin teletransportes; tope de 12 por objeto) | MP7 Running, Sightseer | S | **SHOULD** |
| B05 | **Estrella del Bachaquero** (Compras) | Objetos comprados (desempate: monedas gastadas) | MP7 Shopping | S | **SHOULD** |
| B06 | **Estrella del Echador de Vaina** (Objetos) | Objetos usados | MP6 Orb | S | **SHOULD** |
| B07 | **Estrella del Pelao** (Mala suerte) | Caídas en rojas, villano y trampas | MP7 Red, Unlucky | S | **SHOULD** |
| B08 | **Estrella de la Tortuga** | Menor suma de dados | Superstars Slowpoke | S | **COULD** |
| B09 | **Estrella del Atacante** | Ataques que acertaron a un rival | Propio (afín a DS Hex) | S | **SHOULD** |
| B10 | **Estrella del Turista** | Regiones distintas visitadas | Propio | S | **SHOULD** |
| B11 | **Estrella de la Cola** | Peajes pagados (monedas o veces) | Propio | S | **COULD** |
| B12 | **Estrella del Apagón** | Turnos terminados en apagón (G03) | Propio | S | **COULD** |
| B13 | **Estrella de Metida de Pata** (oculta, chistosa) | Trampas en las que caíste + minijuegos perdidos por tiempo | Propio | S | **COULD** |

---

## 15. Aliados / "Panas"

| ID | Mecánica | Regla | Brilla cuando | Riesgo | Dif | v1 | Origen |
|---|---|---|---|---|---|---|---|
| L01 | **Pana con pasiva** (Buddy) | Se recluta con un minijuego Showdown al pasar junto a él. Dura 3 turnos. Duplica el efecto de la casilla y da una pasiva: la abuela paga la estrella a mitad, el tío roba 3–8 al pasar, el pana mototaxista suma +3 a +8 al dado, la vecina chismosa revela trampas. Se puede robar al pasar junto a quien lo tiene. | Reutiliza el reparto (mamá, abuela, tío, vecina). | Si quien lo activa queda muy por delante, puede consolidar al líder (crítica a Jamboree). Duración corta. | L | **COULD** (v1.1) | Jamboree |
| L02 | **Aliado de dado extra** | Cada aliado añade +1 o +2 a la tirada con 50 % de probabilidad. Máximo 4. | Progresión suave. | Efecto bola de nieve. | M | **COULD** | SMP |
| L03 | **Dados por personaje** | Cada personaje tiene su dado: abuela (3,3,3,3,4,4), tío (0,0,0,0,10,10 con +5 al sacar 0), TÚ (1–6). | Asimetría barata. | Balance. Mejor hacerlo opcional. | S | **COULD** | SMP |

---

## 16. Reglas de sistema y calidad de vida

| ID | Mecánica | Regla | Dif | v1 | Origen |
|---|---|---|---|---|---|
| Q01 | **Orden de turno por dado inicial** | Cada uno tira; el número más alto juega primero. | S | **MUST** | MP1→ |
| Q02 | **Duración elegible** | Pro 12 / Normal 20 / Largo 30. | S | **MUST** | MP1→, Jamboree Pro |
| Q03 | **Dos reglamentos: Caos y Pro** | Pro: 12 turnos, 1 estrella bonus anunciada, sin Chance Time, sin bloques ocultos, Boo fijo en 15 y stock de 2 por objeto. | S (son banderas) | **MUST** | Jamboree Pro Rules |
| Q04 | **Avance rápido / saltar animaciones** | Toque largo para acelerar 2×. CPU con turno de ≤5 s. | M | **MUST** | Superstars |
| Q05 | **Desempate** | Estrellas → monedas → dado. | S | **MUST** | MP1→ |
| Q06 | **Zoom-out del mapa al mover la estrella** | La cámara muestra el mapa entero 1,5 s. | M (necesita cámara) | **MUST** | Superstars |
| Q07 | **Panel de estadísticas en vivo** | Muestra los contadores de §14. | M | **SHOULD** | Propuesta de la investigación |
| Q08 | **CPU para llenar jugadores** | Decide rutas (Dijkstra hacia la estrella con coste de peajes), compras y objetivos de ataque (el líder). | L | **SHOULD** | MP1→ |
| Q09 | **Pantalla "pasa el teléfono"** | Entre turnos en hot-seat. | S | **MUST** | Propio |
| Q10 | **Guardado de partida** | Persistencia en localStorage por ronda. | M | **COULD** | MP9 (guarda al final) |

---

## 17. Selección para la v1 (resumen)

### 17.1 MUST: el núcleo jugable (27 elementos)

| Grupo | IDs |
|---|---|
| Casillas | C01 azul · C02 roja · C03 evento · C04+C05 estrella móvil · C06 villano · C08 objeto · C12 duelo · C15 jefe · C22 parada de transporte |
| Objetos | O01 Doble Dado · O02 Triple Dado · O04 Dado Personalizado · O07 Warp · O09 Saltar casillas · A01 Dado maldito · A05 Robo pagado |
| Tienda | T01 tienda fija |
| Estrella | E01 precio 20 · E02 reubicación |
| Peajes y atajos | P01 peaje fijo · P05 teleférico · P06 ferry |
| Posición | X03 volver al inicio de la región |
| Catch-up | K03 caridad al último |
| Minijuegos | M01 tipo por color · M02 ronda rápida de 5 · M03 minijuego largo · M04 duelo |
| Jefes | J01 jefe regional (1 en v1) |
| Final | F01 anuncio · F02 doblar · F03 ruleta del último |
| Eventos | V01 · V02 · V06 |
| Bonus | B01 Rico · B02 Campeón · B03 Chismoso |
| Sistema | Q01 · Q02 · Q03 · Q04 · Q05 · Q06 · Q09 |

### 17.2 SHOULD: identidad venezolana e interactividad

C07 Chance Time (solo en Caos) · C09/C10 suerte y mala suerte · C11 VS · C13 la vaca · C17 trampas · C20 inicio · O03 · O06 Pasaje · O08 llave · A03 · A04 · A06 · A07 · A09 chancla · A10 dólar paralelo · A12 · D01 · D03 Caja misteriosa · T02 stock · T04 tienda del bachaquero · T07 dólar paralelo · E03 ubicación justa · E05 precio por región · E07 · E09 · E10 desafío del Salto Ángel · P02 alcabala escalonada · P03 guardia móvil · P04 · P07 · P10 · R01 Metro · R02 camionetica · R04 avioneta · G01 · G03 Luz/Apagón · G05 Inundación del Delta · G06 barra de villano · G07 Deltamacura · X02 · K01 Revolución · K04 · K07 handicap · M05 · M07 · M08 · M10 · J02 · F04 · F05 · V03 · V05 · V08 · B04–B07 · B09 · B10 · Q07 · Q08.

### 17.3 Esfuerzo estimado de la v1 (solo los MUST)

| Tipo | Cantidad aprox. | Comentario |
|---|---|---|
| S | ~30 | Datos y reglas en el resolvedor. |
| M | ~14 | Ruletas, tienda, cámara y zoom, selector de objetivo, transporte. |
| L | 3 | **M02** (ronda rápida multijugador con semilla y métrica de tiempo), **M03/J01** (minijuego largo de jefe) y la **cámara del mapa gigante** (pan y zoom, sin equivalente en el motor actual). |

Ruta crítica técnica: (1) grafo del tablero + cámara · (2) bucle de turno hot-seat · (3) adaptador de los 40 microjuegos a resultados por jugador (semilla + tiempo) · (4) jefe largo.

---

## 18. Antipatrones documentados (no copiar)

| Antipatrón | Por qué | Origen |
|---|---|---|
| Vehículo compartido como movimiento base | Quita la agencia y la posibilidad de traicionar a otros; fue la principal crítica a MP9 y MP10. | MP9, MP10 |
| Quitar la mitad de la moneda principal sin tope | Invalida las victorias en minijuegos. | MP9 |
| Transferir todas las estrellas del primero al último | Borra la partida. | MP5 Miracle Capsule |
| Estrellas bonus ocultas y aleatorias como única regla | Se sienten injustas; hay que anunciarlas. | MP7+, crítica Kotaku |
| Mapas vacíos (muchas casillas sin efecto) | Repetitivo. | Star Rush |
| Turnos lentos de CPU y animaciones sin opción de saltar | Es la queja número 1 de toda la serie. | MP4, MP7, MP8, Jamboree |
| Retroceder sin gracia (perder un turno completo) | Se siente injusto. | Superstars Space Land |
| Compras forzadas o restricciones de tienda invisibles | Frustran. | MP4 Mushroom, MP7 Bowser Time |
| Micrófono, giroscopio, girar el stick | No sirven en web o causan lesiones. | MP1, MP6, MP7 |
| Minijuegos solo por ranking, sin 2v2 ni 1v3 | Se pierde la variedad. | MP9 |
| Premios de minijuego casi iguales para todos | El desempeño deja de importar. | MP9 |

---

## 19. Pendientes por verificar

- Montos exactos de la casilla Bowser en MP4 y MP5 **(por verificar)**.
- Contenido exacto de la ruleta de los últimos 5 turnos de MP6 **(por verificar)**.
- Bowser Revolution, swap de Boo y Ztar: los detalles vienen de memoria **(por verificar)**.
- Homestretch de Jamboree: la wiki dice "12 monedas", lo que contradice 3×2 = 6 **(por verificar)**.
- Precio de la estrella en Jamboree en modo normal **(por verificar)**; se asume 20.
- Límite de objetos en mano de Superstars **(por verificar)**; se asume 3.
- Reparto exacto de la batalla con pote: MP6 70/25/5/0 frente a Superstars 70/20/10/0 (las dos versiones aparecen en las fuentes) **(por verificar)**.
- Pagos de minijuegos 2v2 y 1v3 en MP5 **(por verificar)**.
- Todos los números marcados "Propuesta v1" son diseño propio y hay que balancearlos con pruebas, no copiarlos.
