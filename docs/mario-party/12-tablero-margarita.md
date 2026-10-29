# 12 · Tablero nuevo desde cero: «ISLA DE MARGARITA» (calco de Yoshi's Tropical Island, MP1)

Idea: no inventar un tablero. Tomamos uno de Mario Party que ya está probado (Yoshi's Tropical Island, Mario Party 1,
el más sencillo de la serie), copiamos su **estructura y reglas** y solo cambiamos la **temática** a Venezuela.
Nada de arte ni nombres de Nintendo: todo se redibuja y se renombra.

Prototipo: 2D, 16-bit, tú vs 3 CPU en la misma máquina, carpeta nueva (`docs/margarita/`), sin tocar LA FIESTA ni el mapa 3D.
Jugar: `docs/margarita/index.html` · `?turnos=N` · `?sinmj=1` (minijuegos simulados) · `?cpu=1` (los 4 son CPU, para ver una partida sola).

---

## 1 · Cómo funciona el original (lo que copiamos)

**Forma.** Dos islas con forma de Yoshi (izquierda y derecha) unidas por **dos puentes de un solo sentido**.
En el medio hay un islote con un Yoshi rosado rodeado de remolinos (decorado + escena final).
Cada isla es un **circuito cerrado sin bifurcaciones**: la única decisión de ruta es si cruzas el puente o no.

**Puentes con Thwomp (peaje).** Cada puente tiene su Thwomp con su propio precio.
Empieza en 1 moneda; para pasar pagas **lo que tú quieras, como mínimo el precio actual**
(máx. 50). Lo que pagas pasa a ser el nuevo precio, así que puedes encarecerle el paso a los demás.
Si no te alcanza, te quedas en tu isla.

**La estrella.** Toad vende la estrella (20 monedas) en una isla y **Bowser está en la otra**.
Al pasar por Bowser te obliga a comprarle un objeto inútil por 30 monedas.
Cuando alguien cae en una casilla de **Evento**, el pez Bubba carga a Toad a la otra isla
y Bowser se va al sitio que Toad dejó: la estrella cambia de isla y todos recalculan.

**Casillas (55 en total):**

| Tipo | Cant. | Efecto |
|---|---|---|
| Azul | 34 | +3 monedas |
| Roja | 3 | −3 monedas |
| Evento (Happening) | 7 | Toad y Bowser cambian de isla |
| Chance Time (?) | 2 | Ruleta: dos jugadores intercambian monedas/estrellas |
| Minijuego | 4 | Minijuego de 1 jugador para ganar monedas |
| Hongo | 3 | Hongo rojo = tiras otra vez · hongo venenoso = pierdes el próximo turno |
| Bowser | 2 | Bowser te hace algo malo (quita monedas, etc.) |

**Turno (estándar MP1):** los 4 tiran el dado (1–10) uno tras otro → al terminar la ronda, **minijuego de 4**.
El formato sale del color de la casilla donde quedó cada uno: 4 iguales = todos contra todos;
3 vs 1 = 1v3; 2 y 2 = 2v2 (casillas verdes/especiales sortean color). Ganar da +10 monedas.
MP1 no tiene objetos: más sencillo todavía.

**Final:** 20 turnos (en el prototipo 10–15). Estrellas extra: más minijuegos ganados, más monedas en un momento,
más casillas de Evento pisadas. Gana quien tenga más estrellas; desempate por monedas.

---

## 2 · Lo mismo, en Margarita

Margarita real ya tiene esta forma: **la isla oriental** (Porlamar, Pampatar, Juan Griego) y la **Península de Macanao**,
unidas por el istmo de **La Restinga**. El islote del medio es **Coche**.

| Original | Margarita | Detalle |
|---|---|---|
| Isla izquierda / derecha | **Oriente** (Porlamar) / **Macanao** | Oriente más urbano (playa El Agua, el Castillo de Pampatar, el Sambil); Macanao más árido (cardones, salinas, pescadores) |
| 2 puentes de un sentido | **Puente de La Restinga** (ida) y **la lancha de la laguna** (vuelta) | Uno va, el otro viene, igual que el original |
| Thwomp (peaje que sube) | **El Fiscal** del peaje: «¿Cuánto es la colaboración?» | Pagas lo que quieras, como mínimo el peaje actual |
| Monedas | **Reales** | |
| Toad vende estrella (20) | **La señora de las empanadas de cazón** vende **la Empanada de Oro** (20 reales) | |
| Bowser y su tubo de 30 | **El Bachaquero**: te vende una pimpina de gasolina «buenísima» por 30 que no sirve | |
| Bubba (pez) carga a Toad | **Un peñero** se lleva a la señora de las empanadas a la otra punta | |
| Remolinos alrededor del islote | Olas y lanchas alrededor de Coche | Escena final: las empanadas que ganaste forman el muelle a Coche |
| Azul / Roja | +3 / −3 reales | «Te encontraste un billete» / «Se te cayó en la arena» |
| Evento (7) | **«¡Zarpó el peñero!»** | La señora y el Bachaquero cambian de isla |
| Chance Time (2) | **«¡El Triple!»** (la lotería) | Misma ruleta de intercambio |
| Minijuego 1 jugador (4) | Uno de tus **microjuegos de campaña** (chancla, parada, etc.) | Ganas reales según lo que hagas |
| Hongo / Hongo venenoso (3) | **Malta** (tiras otra vez) / **Pescado pasado** (pierdes turno) | |
| Bowser (2) | **¡APAGÓN!** | Corpoelec te cobra: pierdes reales (cantidad al azar) |
| Minijuego de 4 al final de ronda | Tus **`fiesta-juego-*`** ya hechos (19 juegos, formatos ffa/1v3/2v2) | Corren offline con `FIESTA.LIVE.practice`, igual que en práctica |
| Estrellas extra | **Minijuegos**, **Más reales**, **Más peñeros** | |

---

## 3 · Esquema del tablero (borrador)

```
        ORIENTE (≈26 casillas, circuito)              MACANAO (≈25 casillas, circuito)
     ┌───────────────────────────┐               ┌──────────────────────────┐
     │  Pampatar · El Agua ·      │ ── Puente de ─▶│  cardones · salinas ·     │
     │  Porlamar · Sambil         │   La Restinga │  pescadores · Boca de Río │
     │  [Empanadas ★]             │◀── lancha ────│  [Bachaquero]             │
     └───────────────────────────┘   (peaje)     └──────────────────────────┘
                              ~ ~ ~ COCHE ~ ~ ~  (decorado + final)
```

Reparto por isla (55 total): ~17 azules por isla, roja 1–2, 3–4 peñeros, 1 Triple, 2 microjuegos, 1–2 Malta/Pescado, 1 Apagón,
\+ casillas de peaje en cada puente. Inicio en Porlamar.

---

## 4 · Qué hace el prototipo (v0)

1. Tablero 2D 16-bit en un canvas: las dos islas, el mar animado, Coche en el centro.
2. 4 fichas (TÚ + 3 CPU, el elenco de siempre: mamá, abuela…), dado 1–10, la ficha **salta casilla por casilla** con animación.
3. Todas las casillas de la tabla funcionando, más el peaje del Fiscal y el peñero que mueve la estrella.
4. Fin de ronda → minijuego de 4 con el formato según colores (un `fiesta-juego-*` corriendo con `LIVE.practice`).
5. Casilla de microjuego → un microjuego de campaña de 1 jugador.
6. 10 turnos, estrellas extra, pantalla de ganador.
7. CPU simple: compra estrella si le alcanza, decide si paga el peaje según dónde está la estrella, paga lo mínimo.

Fuera del v0: online, objetos, tienda, más tableros.

Fuente de las reglas del original: https://www.mariowiki.com/Yoshi%27s_Tropical_Island

---

## 5 · v1: mapa con rutas reales y estado de la isla

**Mapa (docs/margarita/mapa.js).** Silueta real (Macanao alargada, Oriente con la bahía de Juan Griego, Manzanillo y Pampatar),
La Restinga como carretera sobre el istmo y la lancha por la laguna con manglares. Rutas por pueblos de verdad, con bifurcaciones:

- Oriente: Juan Griego → **la costa** (Playa El Agua, donde está la venta, Manzanillo, Pampatar) o **el atajo por La Asunción**
  (más corto, más rojas y apagones) → Porlamar → Punta de Piedras (sale la lancha por la laguna hacia Boca de Río).
- Macanao: Boca de Río → **la costa** (Punta Arenas, la venta) o **el atajo por el cerro** → El Robledal (peaje de La Restinga: la carretera sobre la barra norte hasta La Guardia).
- Unas 90 casillas. Terreno pixel a pixel con cerros, salinas, laguna; torres de Porlamar, castillo, iglesia, fortín, sombrillas,
  peñeros, ferry, veleros, gaviotas, delfines y nubes.

**Estado de la isla (margarita.js · E).** Inspirado en el día/noche de Superstars, los eventos de Super MP y los «últimos 5 turnos»:

| Estado | Cuándo | Efecto |
|---|---|---|
| ☀️ Día / 🌅 Atardecer / 🌙 Noche | Ciclo de 4 rondas (día, día, atardecer, noche) | De noche la lancha no sale y el peaje de La Restinga es doble. Mapa oscuro con luces |
| 🎡 «¡QUÉ VAINA!» (casilla V) | Al caer en ella | Ruleta de la isla: |
| · 🌧️ Aguacero | 2 rondas | Dado 1–6, las rojas quitan 6. Lluvia y rayos |
| · 🚧 Obras | Hasta otra vaina | Cierra o abre el atajo de esa isla |
| · 🌊 Mar de leva | 2 rondas | La lancha no sale |
| · 📸 Turistas | 2 rondas | Las azules dan +2 de propina |
| · ⚡ Apagón general | 1 ronda | Es de noche sin luces (solo velas) |
| 🎉 Carnaval | Ronda de la mitad | Azules al doble, minijuego todos contra todos por 15. Comparsa, papelillo y fuegos artificiales |
| 🔥 Últimas 3 rondas | Al final | Azules y rojas valen el doble |

---

## 6 · v2: lo que trae un Mario Party normal

| Mario Party | Margarita | Detalle |
|---|---|---|
| Cámara que sigue al jugador | 🎥 AUTO / 🗺️ MAPA / ✋ LIBRE | Zoom 2x al que juega, vista general en los anuncios. Rueda/pellizco = zoom, arrastrar = mover |
| Objetos (máx. 3) | ☕ Cafecito (2 dados), 🥤 Guarapo (3 dados), 🎯 Dado trucado (1–10), 🤝 Palanca (peaje gratis), 🔀 Colearse (cambias de puesto), 🛵 Mototaxi (directo a las empanadas) | Se usan antes de tirar |
| Tienda | 🏪 La Bodega del Portu (Porlamar y Boca de Río) | Se activa al pasar |
| Banco de Koopa | 🏦 El San (Santa Ana) | Al pasar pagas 5 Bs al pote; si caes justo, te lo llevas |
| Boo (robar) | 🦹 El Pícaro del Puerto | 5 Bs: roba 5–15 Bs a un rival · 30 Bs: roba una empanada |
| Casilla de objeto / suerte | 🎁 ¡QUÉ SUERTE! | Objeto gratis (o 5 Bs con los bolsillos llenos) |
| Casilla de duelo | ⚔️ ¡BRONCA! | Duelo 1 vs 1 con apuesta (hasta 10 Bs), minijuego 1v1 |
| Bloques escondidos | ✨ Cofre escondido | 6% al caer en azul/roja: 15 Bs, un objeto o (raro) una empanada |
| Monedas en el tablero | 💼 Carteras de turistas | Aparecen al empezar la ronda; las agarra el primero que pase |
| Zona extra | ⛴️ Ferry a Coche desde El Muelle (5 Bs) | Isla de la suerte con 🦪 El Perlero (regala objetos), sale en Punta de Piedras |
| Ayuda al último (últimos 5 turnos) | ✈️ La tía de Miami | Al empezar las 3 últimas rondas: +10 Bs y un objeto al último |

**Mapa vivo:** carros y camionetica por La Restinga, gente caminando por los caminos, avión que aterriza en el aeropuerto,
crucero, pelícanos en picada, papagayo sobre Macanao, flamencos en la laguna, burros, y los personajes gritan cosas
(«¡FIADO NO!», «¿COLABORA?», «¡EMPANADAS!»).

---

## 7 · v3: noticias, folclor, trucos del tablero y mapa que se toca

**📺 ¡ÚLTIMA HORA EN MARGARITA!** (como las cartas de Suerte del Monopoly o los eventos de tablero de MP). Al empezar
cada ronda, con 45% de probabilidad sale una noticia. La cámara va al sitio y la criatura aparece en el mapa (criaturas.js):

| Noticia | Efecto |
|---|---|
| 💧 Se fue el agua | 2 rondas: las azules de esa isla no dan nada. Una cisterna recorre la isla |
| 🏴‍☠️ Piratas de Lope de Aguirre | El barco llega a la isla con más jugadores: cada uno pierde 5 Bs. Dejan un cofre pirata de 20 Bs |
| 🐙 El Kraken | 2 rondas en la laguna: no salen ni la lancha ni el ferry. Quien esté en el agua vuelve al muelle |
| 🧜 Sirena en Playa El Agua | 2 rondas: al pasar, perla (+10) o te quedas embobado (−5) |
| 👽 Ovni | Abduce a un jugador y lo suelta en un sitio al azar |
| 🛍️ Oferta en el Sambil | 2 rondas: todo a mitad de precio |
| 👻 El Silbón (solo de noche) | Aparece delante del que va primero: quien pase pierde 10 Bs. Se va al amanecer |
| 🐟 Pesca buena | +5 a todos los que estén en Macanao |
| ⛪ Virgen del Valle | Procesión por Porlamar: +3 a todos y un objeto para el último |
| ⚡ Apagón | Una ronda a oscuras |

**Trucos del tablero:** 🛍️ la rifa del Sambil (5 Bs: nada, objeto, 15, 30 o, raro, una empanada; en el atajo) y
💣 el cañón de Pampatar (en la costa: te dispara a un sitio al azar y ahí acaba tu turno).

**Mapa con más detalle:** el Sambil, la Plaza Bolívar, la catedral, la Basílica del Valle, churuatas y sillas en El Agua,
voleibol, kitesurf en El Yaque, surf en Parguito, el faro, Los Frailes, el chinchorro en Macanao, las ruinas de Nueva Cádiz en
Cubagua, el hotel de Coche, los cerros de María Guevara, tortugas, aguavivas y cardúmenes.

**Todo se toca:** los cocos caen, las iglesias suenan, el castillo dispara, el Sambil echa fuegos artificiales, los burros
rebuznan, los veleros cambian de rumbo, el mar salpica… y hay **8 secretos** escondidos (brillan un poquito):
+3 Bs cada uno, y una empanada si consigues los 8.

**Más rápido:** los turnos de las CPU van al 60%, los saltos son más cortos, y Espacio/Enter/tocar el mensaje lo adelanta.

---

## 8 · v4: el interior de la isla y la ruta histórica

**Menos verde vacío.** La Margarita real es semiárida: ahora las tierras bajas son sabana seca y cardonal (amarillo verdoso,
cardones, tunas, arbustos), y el verde queda en los cerros. El Copey tiene bosque nublado con niebla que se mueve. Además:
el embalse de San Juan y los conucos (maíz, yuca, melón) con espantapájaros, un campesino y vacas.

**Pueblos coloniales** con plaza, iglesia y casas de teja, unidos por caminos de tierra: La Asunción, San Juan Bautista,
Paraguachí, Los Millanes, Tacarigua, San Francisco (Macanao) y Boca de Pozo. También el Castillo de Santa Rosa,
el obelisco del Matasiete, la antena del Copey y ranchos con fogón en Macanao.

**Fauna de la isla:** monos capuchinos y cotorras margariteñas en El Copey, el venado de Margarita, cabras en Macanao.

**La ruta histórica (el atajo por La Asunción):**

| Truco | Efecto |
|---|---|
| 🐒 Los monos del Copey | 50%: te regalan un mango con 3 Bs · 50%: te roban un objeto (o 3 Bs) |
| 🏰 El calabozo de Santa Rosa | Si caes justo ahí: pagas 10 Bs de fianza o pierdes el turno (como Luisa Cáceres de Arismendi) |
| ⚔️ Cerro Matasiete (1817) | Al pasar, le lanzas piedras a un rival: retrocede 4 casillas |

**Tarjetas de historia:** al tocar (o pasar por) el castillo de Pampatar, el fortín de La Galera, Santa Rosa, el Matasiete,
Nueva Cádiz, las iglesias coloniales, la basílica del Valle o El Copey sale un dato corto de historia.

---

## 9 · Ubicaciones revisadas

Corregido contra fuentes (Wikipedia: Laguna de la Restinga; Aeropuerto Santiago Mariño):

- **La Restinga:** la barra de arena que une las dos partes va por el **norte**, de La Guardia a Punta Tigre, y la laguna se abre
  al mar por el **sur**. En el tablero, la carretera con peaje va ahora por la barra norte (Macanao → La Guardia) y la lancha
  cruza la laguna por el sur (Punta de Piedras → Boca de Río).
- **Aeropuerto y El Yaque:** al oeste-suroeste de Porlamar, uno al lado del otro. El muelle del ferry a Coche está en El Yaque,
  y los kitesurfistas también.
- **Costa norte de Macanao, de oeste a este:** Boca de Pozo, San Francisco y El Robledal.
- Nombres que no pude confirmar quedan genéricos: «el faro», «la represa».
