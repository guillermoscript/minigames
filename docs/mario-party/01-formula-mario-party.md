# 01 · La fórmula Mario Party: manual de diseño

> **Documento base** del modo fiesta de 4 jugadores en el mapa de Venezuela («MiniCaos: Fiesta Venezuela», nombre provisional).
> Explica qué hace que un juego sea un Mario Party, qué piezas son obligatorias y cuáles opcionales, y propone un **modelo numérico concreto** para la primera versión.
>
> **Fuentes:** investigación de los 18 juegos principales y portátiles (MP1 a Jamboree, DS, Island Tour, Star Rush, Top 100). La base es Super Mario Wiki, Wikipedia y reseñas de crítica. Lo que no se pudo confirmar está marcado **(por verificar)**. Lo que es diseño propio y no dato de la serie está marcado **[propuesta]**. Los números de la sección 5 y siguientes son **[propuesta]** y hay que validarlos en playtest.
>
> **Términos:** se mantienen los términos de la comunidad: *star* (estrella), *bonus star*, *Chance Time*, *Last 5 Turns*. En la sección 12 hay un glosario que traduce cada término a su versión venezolana.

---

## Índice

1. [El bucle central](#1-el-bucle-central)
2. [Cómo evolucionó la fórmula (1998 → 2024)](#2-cómo-evolucionó-la-fórmula-1998--2024)
3. [Pilares: crucial, opcional y favorito de los fans](#3-pilares-crucial-opcional-y-favorito-de-los-fans)
4. [Ritmo: turnos, minutos y presupuesto de tiempo](#4-ritmo-turnos-minutos-y-presupuesto-de-tiempo)
5. [Economía: monedas y estrellas (modelo numérico recomendado)](#5-economía-monedas-y-estrellas-modelo-numérico-recomendado)
6. [Casillas: distribución y valores](#6-casillas-distribución-y-valores)
7. [Minijuegos: formato, ronda relámpago y gran reto](#7-minijuegos-formato-ronda-relámpago-y-gran-reto)
8. [Remontada (rubber-banding): reglas y topes](#8-remontada-rubber-banding-reglas-y-topes)
9. [Suerte contra habilidad](#9-suerte-contra-habilidad)
10. [Bonus stars y estadísticas](#10-bonus-stars-y-estadísticas)
11. [Escalado por número de jugadores (1 a 4)](#11-escalado-por-número-de-jugadores-1-a-4)
12. [Glosario serie → versión venezolana](#12-glosario-serie--versión-venezolana)
13. [Antipatrones: lo que la serie aprendió a golpes](#13-antipatrones-lo-que-la-serie-aprendió-a-golpes)
14. [Checklist: ¿esto es un Mario Party?](#14-checklist-esto-es-un-mario-party)
15. [Decisiones abiertas y restricciones técnicas](#15-decisiones-abiertas-y-restricciones-técnicas)

---

## 1. El bucle central

### 1.1 Estructura de una partida

```
PREPARACIÓN ─► [ RONDA × N turnos ] ─► ÚLTIMOS 5 TURNOS ─► CIERRE (bonus stars) ─► GANADOR
                   │
                   ├─ Turno de J1: (objeto opcional) → dado → mover → efectos de paso → casilla
                   ├─ Turno de J2: …
                   ├─ Turno de J3: …
                   ├─ Turno de J4: …
                   └─ MINIJUEGO de fin de ronda (formato según los colores donde cayeron)
```

### 1.2 Pasos del turno individual (clásico, MP1-MP8 y Superstars/Jamboree)

| # | Paso | Qué decide el jugador | Fuente / nota |
|---|---|---|---|
| 0 | Orden de turno | Nada: tirada inicial, el más alto empieza | Toda la serie |
| 1 | Usar objeto **antes** de tirar | Dado doble/triple, dado custom, robo, warp | Desde MP2 (objetos) |
| 2 | Tirar dado 1-10 | Timing (cosmético en la práctica) | 1-10 en casi todos; 1-6 en SMP (por personaje), MP9 e Island Tour |
| 3 | Moverse | **Ruta** en cada bifurcación | El paso con más decisión del turno |
| 4 | Efectos **de paso** | Comprar estrella, tienda, banco, peaje, Boo | La estrella se compra *al pasar*, no hace falta caer (MP2 en adelante) |
| 5 | Efecto de la casilla donde cae | Nada (o elegir dentro de un evento) | Azul/roja/evento/Bowser/VS… |
| 6 | (Tras los 4) Minijuego | Habilidad pura | El formato depende de los colores (§7) |

### 1.3 Condición de victoria y desempate (estándar de la serie)

1. Más **estrellas** después de repartir las bonus stars.
2. Si hay empate: más **monedas**.
3. Si sigue el empate: tirada de dado.

> Regla de oro: **una sola meta legible (estrellas)** y **una sola moneda (monedas)** para conseguirla. MP9 y MP10 sustituyeron ambas por *Mini Stars* y es el cambio peor recibido de la serie (§13).

---

## 2. Cómo evolucionó la fórmula (1998 → 2024)

### 2.1 Tabla de refinamientos

| Juego (año) | Qué añadió | Qué quitó o corrigió | Lección para nosotros |
|---|---|---|---|
| **MP1** (1998) | Todo el esqueleto: dado 1-10, azul +3 / roja −3, estrella a 20, colores → 4P/2v2/1v3, Chance Time, Bowser, Últimos 5 turnos (×2), 3 bonus stars | — | El tablero y el minijuego tienen que estar enlazados (por los colores) |
| **MP2** (1999) | **Objetos** (1 hueco), tienda, **Battle** (bote 70/30), **Duelos**, **Banco**, día/noche (Horror Land) | Juegos de girar el stick (ampollas, demanda) y las casillas de minijuego solo | Los objetos son la mayor mejora sobre el bucle básico |
| **MP3** (2000) | **3 huecos de objeto**, objetos baratos (5-30), tienda villana (Baby Bowser), estrella que se mueve, Chance Time con resultados limitados por turno | — (introdujo un Duel Mode con compañeros, demasiado complejo, que no volvió en MP4) | Los objetos de ataque van en una tienda aparte; los cambios extremos se habilitan solo después del turno 5 |
| **MP4** (2002) | Hongos Mega/Mini, Boo House, ruleta del último lugar en los últimos 5 turnos | Ritmo: tableros grandes y lentos (crítica) | **Tablero grande = turnos lentos.** Hace falta transporte y animaciones cortas |
| **MP5** (2003) | **Cápsulas lanzables** (trampas en el mapa), tableros 3D con atajos pagos, varias estrellas en los últimos 5 turnos | Cápsula Milagro (estrellas del 1.º al último): injusta | Las trampas en el mapa crean interacción; las transferencias totales no |
| **MP6** (2004) | **Orbes**: inmunidad a tu propia trampa, alcance 5; **ciclo día/noche cada 3 turnos** que cambia las reglas; **precio de estrella distinto en cada tablero**; Orb Star | Coin Star (premiaba acaparar) | Cada tablero lleva su propia regla para conseguir estrellas, y un ciclo global visible |
| **MP7** (2005) | **Bowser Time** (medidor cada 5 turnos que apunta al líder), **bonus stars al azar: 3 de 6**, Red Star (estrella de consuelo) | Chance Time | Un evento contra el líder con cuenta atrás visible da drama y remontada a la vez |
| **MP8** (2007) | Caramelos (sin colocar en el mapa), estrella con mecánica distinta por tablero (hoteles, mansión), **Chump Charity** (ayuda programada al último) | Minijuegos de Bowser en el tablero | La ayuda al último tiene que ser explícita y programada, no aleatoria |
| **MP9** (2012) | Vehículo compartido, Mini Stars, **jefes cooperativos con puntuación individual** | Monedas, compra de estrella, rojas, movimiento individual, 2v2/1v3 | ❌ Quitar la agencia mata el juego. ✅ El jefe cooperativo es la base de nuestro «minijuego largo» |
| **MP10** (2015) | Bowser Party (1 contra 4 asimétrico), candados de Bowser (reloj villano), partidas de unos 30 min | Chance Time cambiado por Steal Space | Las partidas cortas gustan; el reloj villano visible convierte el azar en tensión |
| **Super Mario Party** (2018) | **Dado por personaje**, aliados, estrella a **10** vendida por una NPC que se mueve, **bonus stars 2-3 de un pool de 11** (se revelan al final, ver §10.1), Partner Party | Últimos 5 turnos, jefes, 50 turnos (máx. 30) | Precio bajo = decisiones frecuentes; el vendedor que se mueve obliga a elegir ruta |
| **Superstars** (2021) | **Añadir turnos**, avance rápido de eventos, bonus stars On/Clásico/Off, minijuego con monedas ×2 cada 5.º turno | Dados por personaje, aliados | La calidad de vida retiene; la fórmula clásica bien pulida basta (Metacritic 80) |
| **Jamboree** (2024) | **Pro Rules** (12 turnos, 1 bonus star anunciada al inicio, menos azar), **Buddies**, existencias limitadas en la tienda, **Homestretch** con menú de eventos, 37 objetos, jefes en casillas VS | — (pulido) | Dos reglamentos: **Caos** y **Tranqui/Pro**. Anunciar la bonus star al inicio. Mejor nota de la serie (82) |
| **MP DS** (2007) | Hexes (trampas asíncronas), compras múltiples, Star Pipe | — | La portátil mejor valorada es la única que mantuvo monedas y estrellas |
| **Island Tour / Star Rush / Top 100** | Carrera lineal, movimiento simultáneo, colección de minijuegos | Monedas y estrellas, 1v3 | ❌ Sin bucle de monedas y estrellas bajan las notas (57-68) |

### 2.2 Las tres eras

| Era | Juegos | Identidad | Recepción |
|---|---|---|---|
| **Clásica** | MP1-MP8, DS | Monedas → estrellas, movimiento individual, objetos crecientes, gimmick por tablero | Buena al inicio y luego fatiga («más de lo mismo», 62-79) |
| **Experimental** | MP9, MP10, Island Tour, Star Rush, Top 100 | Vehículo, carreras, sin monedas | La más baja (57-73) |
| **Retorno** | SMP, Superstars, Jamboree | Clásico + calidad de vida + reglas opcionales | La más alta (76-82), récord de ventas (SMP unos 21M (por verificar)) |

**Conclusión:** el producto **es** el bucle clásico. La novedad se agrega encima, nunca en lugar del bucle. Nuestra novedad: el mapa enorme de Venezuela, el humor, la ronda relámpago de 5 microjuegos y el gran reto.

---

## 3. Pilares: crucial, opcional y favorito de los fans

### 3.1 CRUCIALES (sin esto no es Mario Party)

| # | Pilar | Por qué es imprescindible | Evidencia |
|---|---|---|---|
| C1 | **Ficha individual** que se mueve con un dado | Agencia y rutas propias | El fracaso del vehículo de MP9/MP10 |
| C2 | **Bifurcaciones y atajos** en el mapa | Es el canal de decisión del jugador | La queja por los tableros lineales de MP9 |
| C3 | **Monedas** como única moneda | Fáciles de leer y de transferir | Toda la serie salvo MP9/MP10 |
| C4 | **Estrella comprable** en un sitio que **se mueve** | Es la carrera central y la tensión de rutas | MP1 → Jamboree |
| C5 | Casillas **azul / roja / evento** | Ingreso de fondo + sorpresa | Toda la serie |
| C6 | **Minijuego cada ronda**, conectado al tablero (formato según los colores) | La habilidad entra aquí | MP1 → Jamboree; Star Rush e Island Tour lo perdieron y se notó |
| C7 | Formatos **4P, 1v3, 2v2** (+ duelo) | Variedad y alianzas temporales | MP9 los quitó y se criticó |
| C8 | **Objetos** (2-3 huecos) con **tienda** | Decisión antes de tirar, ataque, remontada | La mayor mejora de MP2 |
| C9 | **Interacción entre jugadores** (robar, duelos, trampas) | El «odio amistoso» es el motor social | Kotaku: «queremos más antagonismo» |
| C10 | **Eventos de vuelco** (Chance Time / Bowser) | Esperanza para el que va atrás y drama | Toda la serie |
| C11 | **Número fijo de turnos** | Duración predecible | Toda la serie |
| C12 | **Últimos 5 turnos** con escalada | Final con clímax | MP1 → Jamboree (salvo SMP: 3 turnos) |
| C13 | **Bonus stars** por estadística | Premian estilos distintos y dan el giro final | MP1 → Jamboree |
| C14 | **Información pública y animada** (robos, estrellas, ranking) | El escándalo compartido es la gracia | Inferido de la crítica (Kotaku) |
| C15 | **Gimmick propio del tablero** (estado global que se paga para cambiar) | Identidad y rejugabilidad | MP2, MP6, Jamboree |

### 3.2 OPCIONALES (dan profundidad; activar por reglamento o por fase)

| Pilar | Qué aporta | Riesgo | Fase sugerida |
|---|---|---|---|
| Banco (los que pasan pagan, el que cae cobra) | Bote emergente y apuesta de ruta | Bajo | MVP |
| Duelo al caer en la misma casilla (últimos 5) | Pique 1v1 | Alarga | MVP (solo en los últimos 5) |
| Battle (bote común repartido por puesto) | Apuesta colectiva | Bajo | v1.1 |
| Ciclo global (día/noche → **luz/apagón**) | Reglas que cambian por turnos | Complejidad de interfaz | MVP (es la firma del mapa) |
| Aliados / Buddies («panas») | Mejoras pasivas | Bola de nieve (Jamboree) | v2 |
| Dado por personaje/región | Asimetría barata | Sensación de dado «arreglado» | v2 |
| Trampas colocables (orbes/hexes) | Interacción asíncrona | Lentitud | v1.1 |
| Handicap (estrellas iniciales) | Grupos de nivel mixto | — | MVP (es solo un menú) |
| Predicción del ganador (anunciador) | Humor | — | MVP |
| Reglamento Pro / Tranqui | Partidas competitivas | — | MVP |
| Jefe cooperativo con puntuación individual | Respiro y set-piece | Coste de producción | MVP (es el «gran reto») |
| Añadir turnos y avance rápido | Calidad de vida | — | MVP |

### 3.3 FAVORITOS DE LOS FANS (los que la gente recuerda)

| Elemento | Origen | Por qué gusta | Versión Venezuela [propuesta] |
|---|---|---|---|
| **Chance Time** (3 bloques: quién da, qué da, a quién) | MP1 | Escándalo puro | «**El Cambiazo**»: tres ruletas con frases |
| **Boo** (robar monedas o estrella por 50) | MP2 | Venganza comprable | «**El Vivo**»: te vende el «dato» para quitarle algo a otro |
| **Bowser Revolution** (reparto igualitario de monedas) | MP2 | Humilla al rico | «**Reparto de la Vaca**» |
| **Thwomp de peaje creciente** | MP1-2 | Cada pago encarece al siguiente | «**Alcabala**»: la colaboración sube +1 cada vez |
| **Whomp que se mueve** a la ruta que tomaste | Horror Land | El mapa reacciona | Guardia que se muda a la ruta más usada |
| **Día/noche** que cambia precios y amenazas | MP2, MP6 | Ritmo del mapa | **Luz / Apagón** cada 3 turnos (Guri) |
| **Tren de Western Land** (sentido aleatorio, atropella) | MP2/Jamboree | Caos de transporte | **Metro de Caracas / camionetica** |
| **Golden Pipe / Magic Lamp** (ir directo a la estrella) | MP2-Superstars | Jugada cara y decisiva | «**Avioneta de Maiquetía**» |
| **Dado custom** | MP DS / SMP | Control | «**Dado de Palabra**» («te lo juro, sale 7») |
| **Casillas ocultas** | MP2+ | Sorpresa | «**Tesoro de la Abuela**» |
| **Bonus star de consuelo** (Red/Unlucky) | MP7+ | Consuela al desafortunado | «**Estrella del Pelao**» |
| **Pro Rules** | Jamboree | Competencia limpia | Reglamento «**Tranqui**» |

---

## 4. Ritmo: turnos, minutos y presupuesto de tiempo

### 4.1 Datos de la serie

| Juego | Opciones de turnos | Duración aproximada |
|---|---|---|
| MP1-MP2 | 20 / 35 / 50 | 1-3 h (crítica: lento) |
| MP3-MP8 | 10-50 en pasos de 5 | 40 min - 3 h |
| MP10 | Sin turnos (tablero) | ~30 min (elogiado) |
| SMP | 10 / 15 / 20 (Torre 30) | 40-80 min (por verificar) |
| Superstars | 10-30 + añadir turnos | — |
| Jamboree Pro | **12 fijos** | Pensado para acortar (por verificar) |

**Queja número 1 de toda la serie: el ritmo** (CPU lentas, animaciones largas, tableros grandes). La duración que la crítica elogia es **30-45 min**.

### 4.2 Presupuesto por turno [propuesta]

| Fase | Objetivo | Cómo se logra |
|---|---|---|
| Turno de un jugador (objeto + dado + mover + casilla) | **20-30 s** | Movimiento de 6-8 casillas/s, eventos con «toca para saltar», CPU sin pausas |
| Turnos de 4 jugadores | 80-120 s | — |
| Ronda relámpago (5 microjuegos, **simultánea**) | 60-75 s | Microjuegos de 6-8 s + tarjeta de 1,4 s + resultado de 1 s |
| Ronda relámpago (**por turnos**, hot-seat) | 150-180 s | 4 × (5 × ~7 s + transiciones). **Es la más cara** (ver §15) |
| Marcador de ronda | 5-8 s | Tabla animada |
| **Total por turno (simultánea)** | **~2,5-3,5 min** | — |
| **Total por turno (hot-seat)** | **~4-5 min** | — |
| Gran reto (cada 5 turnos) | 2-3 min | Jefe multifase (§7.4) |
| Intro + cierre (bonus stars + podio) | 2-3 min | — |

### 4.3 Duraciones de partida resultantes [propuesta]

| Modo | Turnos | Grandes retos | Simultánea | Hot-seat |
|---|---|---|---|---|
| **Exprés** | 10 | 1 (turno 5) + el final | ~32 min | ~48 min |
| **Normal** (por defecto) | 15 | 2 (turnos 5 y 10) + el final | ~48 min | ~72 min |
| **Largo** | 20 | 3 + el final | ~63 min | ~95 min |
| **Tranqui (Pro)** | 12 fijos | 2 | ~38 min | ~57 min |

> **Recomendación:** en el MVP hot-seat, el **Exprés de 10 turnos** debe ser el modo por defecto, o la ronda relámpago debe jugarse «a relevos» (§7.3) para no pasar de 50 min. Con controles simultáneos, el defecto vuelve a ser **Normal de 15**.

### 4.4 Reglas de ritmo (obligatorias)

1. **Todas las animaciones se pueden saltar**: tocar acelera ×3 (Superstars).
2. **Las CPU deciden en menos de 0,5 s** y no «piensan» en voz alta.
3. **Opción de añadir turnos** una vez por partida, con tope de 30 (Superstars).
4. **El mapa enorme necesita transporte** (avioneta, ferry, metro, teleférico) para que la estrella esté a **3-4 turnos** como máximo (§5.5).
5. **No hay casillas vacías**: Star Rush fue criticado por «mapas vacíos». Al menos 1 de cada 4 casillas debe hacer algo distinto de ±3.
6. Un retroceso nunca hace perder un turno entero sin chiste ni compensación (lección de los Snifit de Space Land).

---

## 5. Economía: monedas y estrellas (modelo numérico recomendado)

### 5.1 Referencias de la serie

| Parámetro | MP1-MP8 / Superstars | SMP | MP DS | Nota |
|---|---|---|---|---|
| Monedas iniciales | 10 | 10 (por verificar) | — | Estándar |
| Azul / Roja | +3 / −3 | +3 / −3 | +3 / −3 | Constante en toda la serie |
| Últimos 5 turnos | ×2 (MP1-3, Superstars), ×3 (MP5-7) | +6 | — | Jamboree: 12 (por verificar, el wiki se contradice) |
| Ganar minijuego | +10 | Varía | +10 | MP1 también quitaba al perdedor |
| Estrella | **20** | **10** | 20 | MP6/MP8: precio por tablero |
| Objetos | 5-30 (MP3-4), 3-40 (Superstars) | — | 1-25 | — |
| Robar estrella con Boo | 50 | — | — | MP2-Superstars |
| Battle | Bote 70/30 (MP2), 70/25/5/0 (MP6), 70/20/10/0 (Superstars) | — | — | — |
| Banco | Peaje 5 (MP2-3), 3 (Superstars; 5 en los últimos 5) | — | — | — |

**Ratio clave:** estrella / azul. MP clásico: 20/3 ≈ **7 azules por estrella**. SMP: 10/3 ≈ **3-4**. Cuanto más bajo el ratio, más decisiones de compra y más estrellas en juego (menos escasez).

### 5.2 Modelo recomendado para Venezuela [propuesta]

| Parámetro | Valor Normal | Valor Tranqui (Pro) | Razonamiento |
|---|---|---|---|
| Monedas iniciales | **10** | 10 | Estándar; no alcanza para estrella en el turno 1 |
| Casilla azul | **+3** | +3 | Constante de la serie |
| Casilla roja | **−3** | −3 | Simétrica |
| Últimos 5 turnos | azul/roja **×2** (±6) | ×2 | El ×3 de MP5-7 fue demasiado azaroso |
| **Precio de estrella** | **20** | 20 | Ancla clásica; deja espacio para descuentos (10) y recargos (30) |
| Estrellas por pasada | 1 (2 en los últimos 5 turnos si alcanza) | 1 | Evita comprar 3 de golpe |
| Pago de la ronda relámpago | **1 por microjuego ganado + bono por puesto 5/3/1/0** | Igual | Máximo 10 (= «ganar minijuego» clásico) con diferencias claras |
| Pago del gran reto | **20 / 12 / 6 / 2** | 20/12/6/2 | El 1.º gana el equivalente a una estrella |
| Objetos | 3-25 monedas (§5.6) | Existencias de 2 por objeto (Jamboree) | — |
| Robo de estrella pagado («El Vivo») | **40** monedas | **No existe** | Un poco más barato que el Boo (50), ya que el mapa es más largo |
| Banco («La Vaca») | Peaje 3 al pasar (5 en los últimos 5) | Igual | Superstars |
| Monedas mínimas | 0; con 0 y una pérdida → «**pa' la arepa**»: +5 y sin castigo | Igual | La red de 0 monedas de MP7 (Bowser da 10) |
| Máximo de monedas | 999 | 999 | Interfaz |

### 5.3 Ingresos y gastos esperados por turno (jugador medio) [propuesta]

**Ingresos (por turno y jugador):**

| Fuente | Cálculo | Valor esperado |
|---|---|---|
| Casilla final | 55 % azul (+3) − 12 % roja (−3) + 13 % evento (media +1) + resto (0) | ≈ **+1,4** |
| Ronda relámpago | Media de microjuegos ganados ≈ 3 de 5 → +3; bono medio (5+3+1+0)/4 = 2,25 | ≈ **+5,25** |
| Bonificaciones de paso (vuelta, mercado, «Koopa» de 10 al pasar la salida) | ≈ 1 de cada 10 turnos × 10 | ≈ **+1,0** |
| Gran reto (cada 5 turnos) | Media (20+12+6+2)/4 = 10 / 5 turnos | ≈ **+2,0** |
| **Total ingresos** | | **≈ +9,6 / turno** |

**Gastos (por turno y jugador):**

| Gasto | Valor esperado |
|---|---|
| Objetos (1 compra de ~8 cada 3 turnos) | ≈ **−2,7** |
| Peajes, banco, transporte | ≈ **−1,5** |
| Eventos negativos (alcabala, robos, apagón) | ≈ **−1,2** |
| **Total gastos** | **≈ −5,4 / turno** |

**Neto: ≈ +4,2 monedas por turno → una estrella cada ~4,8 turnos.**

### 5.4 Proyección para una partida Normal de 15 turnos [propuesta]

| Perfil | Neto/turno | Monedas acumuladas (10 + 15×neto) | Estrellas compradas | + Bonus (media) | **Total esperado** |
|---|---|---|---|---|---|
| Líder (bueno en minijuegos y rutas) | ~6,5 | ~107 | **4-5** | 1-2 | **5-7** |
| Medio | ~4,2 | ~73 | **3** | 0-1 | **3-4** |
| Rezagado | ~2,5 | ~48 | **1-2** | 0-1 | **2-3** |
| **Total en la mesa** | | | ~12 | 3 | **~15 estrellas** |

**Objetivos de calibración** (medir en playtest y ajustar el precio o los pagos si se sale del rango):

| Métrica | Rango sano | Si se sale… |
|---|---|---|
| Estrellas del ganador (15 turnos) | 5-8 | Más de 9 → subir el precio a 25. Menos de 4 → bajarlo a 15 o subir los pagos |
| Diferencia ganador − último | 2-5 | Más de 6 → reforzar la remontada (§8) |
| % de partidas en que el líder del turno 10 gana | 45-65 % | Más de 75 % → demasiada bola de nieve; menos de 35 % → demasiado azar |
| Turno de la primera estrella comprada (media) | 3-5 | — |
| Partidas decididas por bonus stars | 20-35 % | Más de 45 % → bajar a 2 bonus o anunciarlas (Pro) |

### 5.5 Geografía de la estrella en un mapa enorme [propuesta]

El problema: con un dado 1-10 (media 5,5) un jugador avanza unas 80 casillas en 15 turnos. Un mapa «enorme» de Venezuela con ~150-180 casillas haría que la estrella quedara inalcanzable.

| Regla | Valor |
|---|---|
| **Puntos de Estrella** candidatos | 12 (uno o dos por región: Caracas, Maracaibo, Mérida, Barquisimeto, Valencia, Margarita, Mochima, Ciudad Bolívar, Canaima, Apure, Delta, Coro) |
| Distancia de la nueva estrella | **12-30 casillas** de la media de los jugadores (no del comprador) |
| Nunca reaparece | En la misma región dos veces seguidas |
| Distancia del líder | Se elige, en lo posible, la candidata más lejana al **líder** de entre 3 sorteadas (suave ayuda a los rezagados; MP no lo hace explícitamente, propuesta) |
| Transporte | Cada región tiene al menos un transporte pago (3-15 monedas) hacia otra región |
| Tiempo medio hasta la estrella | Objetivo **2,5-4 turnos** para el jugador mejor ubicado |
| Revelación | Al moverse la estrella, la cámara hace zoom al mapa completo 2 s (Superstars) |

### 5.6 Tienda y objetos: precios de referencia [propuesta]

Basado en Superstars/Jamboree (3-40) y MP3 (5-30). Máximo **3 huecos** (MP3+). Existencias limitadas a 2 por objeto en Tranqui.

| Categoría | Objeto (nombre provisional) | Efecto | Precio | Equivalente en la serie |
|---|---|---|---|---|
| Movimiento | **Malta** | +3 al dado | 3 | Mushroom (+5 en Superstars) |
| Movimiento | **Doble arepa** | Tira 2 dados (dobles = +10) | 5 | Double Dice |
| Movimiento | **Pabellón** | Tira 3 dados (triple = +20) | 10 | Triple Dice |
| Control | **Dado de Palabra** | Eliges un número del 1 al 10 | 12 | Custom Dice Block |
| Control | **Cola** (ataque) | El dado de un rival queda en 1-3 | 5 | Cursed/Poison Mushroom |
| Transporte | **Pasaje de camionetica** | Llama al transporte de tu región | 5 | Steamer Ticket |
| Transporte | **Avioneta** | Vas al Punto de Estrella (pagas la estrella aparte) | 25 | Golden Pipe |
| Robo | **Bachaquero** | Robas un objeto al azar a un rival | 15 | Plunder Chest |
| Robo | **Zancudo** | Al pasar, quitas 3-8 monedas a cada rival | 10 | Bowser Suit (versión suave) |
| Duelo | **Guante del dominó** | Retas a un duelo apostando monedas | 10 | Dueling Glove |
| Trampa | **Hueco en la vía** | Lo pones a 1-3 casillas: quien caiga pierde 10 | 8 | Coin Trap / Hex |
| Defensa | **Vela** | Inmune al apagón y a una trampa | 5 | Gaddlight / Snack |
| Llave | **Pase de la finca** | Abre portones en atajos | 3 | Skeleton Key |

**Regla de tienda:** dos tiendas por región: una «buena» (bodega) y una «de ataques» (buhonero), como la de Baby Bowser en MP3. Los ataques más fuertes cuestan **10 en vez de 15-20 para el último lugar** (Chump Charity de MP8).

---

## 6. Casillas: distribución y valores

### 6.1 Distribución recomendada del camino principal [propuesta]

Referencia: Grand Canal (MP7): 70 casillas = 48 azules (69 %), 9 rojas (13 %), 7 eventos (10 %), 2 mic, 2 duelo, 2 DK.

| Tipo | % | Ejemplo en 160 casillas | Efecto base | Equivalente |
|---|---|---|---|---|
| **Azul** («¡Qué chévere!») | 52 % | 83 | +3 | Blue |
| **Roja** («¡Qué vaina!») | 12 % | 19 | −3 | Red |
| **Evento** (verde, regional) | 13 % | 21 | Evento propio de la región (§6.2) | Happening |
| **Objeto** | 6 % | 10 | Microjuego solo → ganas un objeto | Item Space |
| **Suerte / Mala suerte** | 4 % | 6 | Ruleta: monedas, objeto, descuento | Lucky/Unlucky |
| **VS / Pique** | 3 % | 5 | Todos apuestan; minijuego; el ganador se lleva el bote | VS Space |
| **El Cambiazo** | 2 por mapa | 2 | Chance Time (§8.3) | Chance Time |
| **El Jefe** (casilla villana) | 3 % | 5 | Castigo grande (§8.4) | Bowser |
| **La Vaca** (banco) | 2-3 por mapa | 3 | Banco | Bank |
| **Transporte** | ~5 % | 8 | Atajo pago | Pipes, ferry, tren |
| **Puntos de Estrella** | 12 (1 activo) | — | Comprar al pasar | Star Space |
| Tiendas (de paso, no son casilla) | 2 por región | — | Comprar al pasar | Shop |

### 6.2 Regla del color para el formato de minijuego

Cada casilla tiene un **color de equipo**: azul o rojo. Los eventos, objetos y demás son «verdes» y **se sortean** azul o rojo al caer (MP1, SMP).

| Colores al final de la ronda | Formato |
|---|---|
| 4 azules o 4 rojos | **4P** todos contra todos |
| 3 + 1 | **1v3** (el solitario contra el equipo) |
| 2 + 2 | **2v2** |
| Últimos 5 turnos: 2 jugadores en la misma casilla | **Duelo** adicional (antes del minijuego de ronda) |

**Frecuencias esperadas** con ~65 % azul al azar: 4P ≈ 20 %, 1v3 ≈ 50 %, 2v2 ≈ 30 % (cálculo binomial aproximado [propuesta]). Esto indica qué cantidad de cada formato hay que producir (§7.5).

### 6.3 Interactividad del mapa (eventos de paso)

Se activan **al pasar**, sin necesidad de caer. Hacen que todo el recorrido importe y no solo la casilla final.

| Mecánica | Valor | Equivalente en la serie |
|---|---|---|
| Comprar estrella | 20 | Star Space / Toadette |
| Tienda | 3-25 | Item Shop |
| La Vaca: pagar al pasar | 3 (5 en los últimos 5) | Koopa Bank |
| Alcabala: peaje creciente | 1, 2, 3… sube +1 por cada pago, máximo 15; no pagar → ruta larga | Thwomp de Yoshi's Tropical Island (MP1; ver doc 02) |
| Guardia que se mueve | Bloquea la ruta que se tomó; cobra 5 por pasar | Whomp de Horror Land |
| Transporte pago | 3-15; sentido aleatorio en el metro y atropella a los que estén en la vía | Steamer / Mr. I / ferry |
| Interruptor global (Luz/Apagón) | Pagar 10 para cambiarlo | Lámpara/pista de baile de Horror Land |
| «El Vivo» (robo) | 5 → robas monedas al azar; 40 → robas una estrella | Boo |

---

## 7. Minijuegos: formato, ronda relámpago y gran reto

### 7.1 Tipos de la serie y cuáles adoptamos

| Tipo | En la serie | ¿Lo adoptamos? | Recompensa [propuesta] |
|---|---|---|---|
| 4P todos contra todos | Toda la serie | ✅ Núcleo | Ronda relámpago (§7.2) |
| 1v3 | MP1+ (quitado en MP9, IT, SR) | ✅ Núcleo | Si gana el solo: 10; si gana el trío: 4 cada uno |
| 2v2 | MP1+ | ✅ Núcleo | 6 a cada ganador |
| Duelo 1v1 | MP2+ | ✅ Últimos 5 turnos + objeto | Apuesta de monedas (ruleta, MP7+) |
| Battle (bote) | MP2+ | ✅ Casilla VS | Bote 70/20/10/0 (Superstars) |
| Objeto (solo) | MP2, Superstars | ✅ Casilla objeto | Objeto gratis |
| Jefe cooperativo con puntuación individual | MP9, MP10, Jamboree, DS | ✅ **Gran reto** | 20/12/6/2 |
| Bowser (castigo a perdedores) | MP5-7 | ⚠ Dentro de «El Jefe» | Perder = −10 |
| Micrófono / girar el stick / movimiento | MP1, MP6-7, MP8 | ❌ | — |
| 8 jugadores | MP7 | ❌ (máximo 4) | — |

### 7.2 Ronda relámpago: 5 microjuegos seguidos (nuestra novedad)

El usuario pidió «rondas de 5 minijuegos seguidos rápidos». Encaja con los microjuegos de 5-8 s que ya existen en el repo (WarioWare). **5 microjuegos ≈ 1 minijuego clásico** (30-60 s).

| Parámetro | Valor [propuesta] |
|---|---|
| Microjuegos por ronda | 5 (sin repetir los de las 3 rondas anteriores) |
| Duración de cada uno | 5-8 s (mismo `dur` actual) |
| Velocidad | Sube ligeramente dentro de la ronda (microjuego 1 = SP base; el 5.º = +0,3) |
| Puntuación | 1 punto por microjuego ganado; desempate por tiempo total hasta ganar |
| Pago | **1 moneda por microjuego ganado + 5/3/1/0 por puesto** (empates comparten el puesto más alto) |
| Formato 1v3 | El solo juega contra el **promedio** del trío; si lo supera gana 10, si no, cada miembro del trío gana 4 |
| Formato 2v2 | Suma de los 2 de cada equipo; 6 por cabeza para el equipo ganador, 1 para el perdedor |
| Cada 5.º turno | Pagos ×2 (Superstars), salvo cuando ese turno trae gran reto |

### 7.3 Ejecución según el hardware (ver la restricción técnica en §15)

| Modo | Cómo se juega | Duración | Cuándo |
|---|---|---|---|
| **Por turnos (hot-seat)** | Cada jugador juega los **mismos 5 microjuegos con la misma semilla**, uno tras otro | ~2,5-3 min | MVP con un solo dispositivo |
| **A relevos** | Cada microjuego lo juega **un jugador distinto** del equipo (en 2v2/1v3), o se reparten 5 microjuegos entre 4 + 1 de desempate | ~60-75 s | Alternativa barata para acortar |
| **Simultáneo** | Pantalla dividida o zonas táctiles; microjuegos nuevos multi-entrada | ~60-75 s | v2 |

### 7.4 «El Gran Reto»: minijuego largo y difícil exclusivo del modo

Pedido del usuario: un tipo nuevo, más largo y difícil, como los de Mario Party. La base es el jefe cooperativo de MP9/Jamboree y los jefes multifase que ya existen en el repo (`juego-jefe-*.js`, con su arreglo `FASES`).

| Parámetro | Valor [propuesta] |
|---|---|
| Frecuencia | Turnos **5, 10 (y 15 en el Largo)** + **jefe final** de cierre antes de las bonus stars |
| Duración | 2-3 min, 3 fases de 40-60 s |
| Estructura | Cooperativo contra un jefe regional (Alcabala, Metro, Arepa, Transformador, «Deltamacura»…), **con puntuación individual** |
| Puntos | Daño o aciertos individuales; **el golpe final suma +5** (MP9: 3/5/10) |
| Pago | 20 / 12 / 6 / 2 monedas por puesto |
| Si el equipo pierde contra el jefe | Todos −5 (MP9: Bowser Jr. quita 5) y la casilla del jefe se queda en el mapa un turno más |
| Dificultad | Escala con el número de turno y con `NIVEL` 1-3 |
| Variante 1 contra 3 | «Bowser Party» (MP10): el último lugar controla al jefe; si gana, cobra 15 de cada uno |

### 7.5 Cantidad de contenido [propuesta]

| Contenido | Mínimo MVP | Meta v1 | Referencia |
|---|---|---|---|
| Microjuegos para la ronda relámpago | 30 (ya hay ~40) | 60 | La ronda consume 5 por turno → 75 por partida de 15; la rotación evita repeticiones cercanas |
| Microjuegos 1v3 / 2v2 dedicados | 6 / 6 | 15 / 15 | Pool mínimo MP4: 4×4P, 3×2v2, 3×1v3, 2 battle |
| Grandes retos (jefes) | 3 | 6 (uno por región) | MP9: 14 jefes |
| Duelos | 4 | 10 | — |

---

## 8. Remontada (rubber-banding): reglas y topes

### 8.1 Catálogo de la serie

| Mecanismo | Juegos | Fuerza | Recepción |
|---|---|---|---|
| Ruleta del último en los últimos 5 turnos | MP4-7, DS | Alta | Buena (el último decide) |
| Monedas ×2/×3 en los últimos 5 turnos | MP1-7, Superstars | Media | Aceptada |
| Chance Time | MP1-6, Superstars, Jamboree | Muy alta | Amada y odiada; Pro la quita |
| Reparto igualitario (Bowser Revolution) | MP2, MP6 | Alta | Perjudica al que juega bien |
| Boo / robo de estrella pagado | MP2-Superstars | Media (cuesta 50) | Buena (es una decisión) |
| Bowser Time contra el líder | MP7 | Media | Buena (anunciado) |
| Objetos más baratos para el último | MP8 | Baja-media | Buena (explícita) |
| Dado lento para el último | MP9-10 | Baja | — |
| Cápsula Milagro (estrellas del 1.º al último) | MP5 | Extrema | ❌ Retirada |
| Peligros que quitan la mitad de la moneda | MP9-10 | Extrema | ❌ «Injusto» |
| Bonus stars (incluidas las de consuelo) | Toda la serie | Media | Polémicas si están ocultas |

### 8.2 Principios [propuesta, derivados de la crítica]

1. **Explícito antes que oculto:** la ayuda al rezagado se anuncia (MP8, Jamboree).
2. **Programado antes que aleatorio:** se activa en momentos conocidos (turno 5, últimos 5).
3. **Con tope:** ningún evento mueve más de **1 estrella** o más del **50 % de las monedas** de un jugador.
4. **Desbloqueado por turnos:** los cambios extremos no existen antes del turno 6 (MP2-3).
5. **El rezagado elige, no recibe un regalo:** una decisión (ruleta, menú) se siente justa y además es divertida.
6. **Que el líder tenga defensa:** objetos como Vela o «Abogado» bloquean un ataque.

### 8.3 «El Cambiazo» (Chance Time) [propuesta]

Tres ruletas: **quién da** → **qué** → **a quién**.

| Resultado | Turnos 1-5 | Turnos 6+ | Últimos 5 |
|---|---|---|---|
| 5 monedas | ✅ | — | — |
| 10 / 20 monedas | ✅ | ✅ | ✅ |
| 30 monedas | — | ✅ | ✅ |
| 1 estrella | — | ✅ | ✅ |
| Intercambiar monedas | — | ✅ | ✅ |
| Intercambiar estrellas | — | — | ✅ (máximo 1 vez por partida) |
| Ponderación | La ruleta de «quién da» pesa ×2 al líder | Igual | Igual |

En **Tranqui**: el Cambiazo no existe y su casilla pasa a ser de Suerte.

### 8.4 «El Jefe» (casilla Bowser) [propuesta]

| Resultado de la ruleta | Peso | Efecto |
|---|---|---|
| «Colaboración» | 35 % | −10 monedas (o la mitad si tienes menos de 20) |
| Reparto de la Vaca | 15 % | Todas las monedas se reparten a partes iguales (**solo turnos 6+**) |
| Impuesto al líder | 20 % | El 1.º paga 15 al último (¡el que cayó no paga!) |
| Microjuego de castigo | 20 % | Si ganas, no pasa nada; si pierdes, −15 |
| Te roba una estrella | 10 % | **Solo en los últimos 5** y solo si tienes 3 o más |
| Con 0 monedas | — | «Pa' la arepa»: +5, sin castigo |

### 8.5 Los últimos 5 turnos: «La Recta Final» [propuesta]

Combina MP1 (×2), MP4-7 (el último decide), Jamboree (menú de eventos) y el predictor de MP1-3.

1. **Anuncio:** el narrador (mamá, abuela o un locutor de radio) muestra la clasificación y **predice al ganador, normalmente mal** (chiste).
2. **Azul/roja ×2.**
3. **Duelos** si dos jugadores caen en la misma casilla.
4. **El último elige 1 de 3 eventos** (o los sortea en Caos):

| Evento | Efecto | Origen |
|---|---|---|
| «Rebaja» | Estrellas a **10** monedas | MP7 |
| «La Remesa» | +30 monedas al último, +15 al penúltimo | MP6 (40 monedas) |
| «Cierre de Alcabala» | Las rojas se convierten en casillas El Jefe | MP4-7 |
| «Dos Estrellas» | Aparece un 2.º Punto de Estrella activo | MP5, Jamboree |
| «Apagón Nacional» | Una ronda de apagón total: robos gratis | Propio (día/noche) |
| «Doble Dado para Todos» | Todos reciben Doble arepa | Jamboree |

### 8.6 Ayudas permanentes y suaves (siempre activas)

| Ayuda | Valor |
|---|---|
| Objetos de ataque más baratos para el último | −5 monedas |
| La nueva estrella se aleja del líder | Elegida entre 3 candidatas (§5.5) |
| Bonus star de consuelo en el pool | «Estrella del Pelao» |
| Red de 0 monedas | +5 |

### 8.7 Lo que NO hay que hacer

- ❌ Transferir **todas** las estrellas de un jugador.
- ❌ Perder la **mitad de las estrellas** por caer en una casilla.
- ❌ Pagos de minijuego **planos** (2.º ≈ 1.º): eso borra la habilidad (MP9).
- ❌ Darle una ventaja grande a quien activa la remontada (los Buddies de Jamboree consolidan al líder).

---

## 9. Suerte contra habilidad

### 9.1 Dónde vive cada cosa

| Canal | Tipo | Peso objetivo [propuesta] | Herramientas de diseño |
|---|---|---|---|
| **Minijuegos** (ronda relámpago y gran reto) | Habilidad de manos | **~40 %** del resultado | Pago 1.º muy por encima de 2.º-4.º |
| **Rutas y economía** (cuándo comprar, qué atajo, qué objeto) | Habilidad de decisión | **~30 %** | Bifurcaciones, peajes, tiendas, transporte |
| **Interacción** (robos, trampas, duelos) | Decisión + lectura social | **~10 %** | Objetos de ataque con defensa |
| **Azar** (dado, eventos, Cambiazo, bonus) | Suerte | **~20 %** (Caos: ~30 %) | Topes, desbloqueo por turnos, anuncio previo |

> Los porcentajes son una **meta de diseño**, no una medición. En playtest se aproximan con «% de partidas que gana el mejor jugador de minijuegos» (objetivo: 45-60 % en una mesa de 4).

### 9.2 Lecciones de la crítica

- «80 % suerte, 15 % crueldad, 5 % habilidad» (sobre Jamboree en modo normal), mientras que Pro Rules se llamó «sorprendentemente táctico».
- El azar es **bienvenido como drama compartido** pero **odiado cuando borra el esfuerzo** sin explicación.
- Sin sorpresas, la partida se vuelve una «marcha hacia un final predecible» (Slant, sobre Pro Rules). **Hacen falta ambos reglamentos.**

### 9.3 Dos reglamentos [propuesta]

| Regla | **Caos** (por defecto) | **Tranqui** (Pro) |
|---|---|---|
| Turnos | 10 / 15 / 20 | **12 fijos** |
| El Cambiazo | ✅ | ❌ (pasa a casilla de Suerte) |
| El Jefe | Ruleta (§8.4) | Siempre −10 (o −1 estrella con más de 30 monedas y 3+ estrellas) |
| El Vivo | 5 monedas / 40 estrella | Roba 10 monedas fijas, sin estrella |
| Suerte | Ruleta | Eliges: 10 monedas **o** Doble arepa |
| Bonus stars | 2 visibles + 1 oculta «de chiste» | **1, anunciada al inicio** |
| Tienda | Ilimitada | 2 existencias por objeto |
| Recta Final | El último elige entre 3 | Solo ×2 y duelos |
| Estrella | Se mueve al azar (ponderada) | Rota entre 6 sitios marcados en orden visible |

---

## 10. Bonus stars y estadísticas

### 10.1 Historia (verificada en el wiki, salvo donde se indica)

| Juego | Pool | Se otorgan | Visibles | Empate |
|---|---|---|---|---|
| MP1-MP6 | 3 fijas (Moneda/Minijuego/Evento; MP6 cambia Moneda por Orbe) | 3 | Siempre las mismas | Todos los empatados |
| MP7, MP8, DS | 6 | 3 al azar | Ocultas hasta el final | Todos (DS: excepciones (por verificar)) |
| MP9 / MP10 | — / 5 | — / 2 (valen 5/10 Mini Stars) | — | — |
| SMP | 11 | 2 (3 si son 20+ turnos) | Se revelan al final | Todos |
| Superstars | 9 | 2 (3 si son 30 turnos), modo Clásico / Off | — | Todos |
| Jamboree | 9 | 2 (3 si son 30+); Pro: **1 anunciada** | Pro: sí | Todos |

### 10.2 Nuestro sistema [propuesta]

- **Normal:** 2 bonus stars **visibles desde el turno 1** (sorteadas al inicio del pool) + **1 oculta «de chiste»** revelada en el cierre. 3 visibles si la partida es de 20 turnos.
- **Tranqui:** 1, anunciada.
- **Clásico:** Rico + Ganador + Evento.
- **Empate:** todos los empatados la reciben.
- **Mínimo:** se necesita un valor de al menos 1 (o 3 en monedas) para recibirla. Un 0 nunca gana.
- **Panel en vivo** con los contadores de las bonus visibles (opcional, se puede ocultar).

### 10.3 Estadísticas a registrar desde el turno 1

| Estadística | Bonus star | Regla exacta de conteo |
|---|---|---|
| `monedasGanadas` | **El Rico** | Suma de **ganancias** (casillas, minijuegos, eventos, robos). Gastos y pérdidas no restan. Excluye las 10 iniciales |
| `microjuegosGanados` | **El Ganador** | +1 por microjuego ganado en la ronda relámpago; +3 por quedar 1.º en un gran reto |
| `casillasMovidas` | **El Viajero** | Casillas recorridas con el dado (incluye dados de objeto; excluye transporte y teletransporte; máximo 12 por tirada) |
| `sumaDados` (la menor) | **La Tortuga** | Suma de tiradas; gana la menor |
| `eventosPisados` | **El Chismoso** | +1 por casilla de evento / Cambiazo |
| `rojasPisadas` | **El Pelao** (consuelo) | +1 por roja, El Jefe o trampa |
| `objetosUsados` | **El Corotero** | +1 por objeto activado (aunque falle) |
| `monedasEnTienda` | **El Bachaquero** | Monedas gastadas en tiendas |
| `ataquesAcertados` | **El Arrecho** | +1 por cada rival afectado por tu ataque (no cuenta si es a ti mismo) |
| `transportesUsados` | **El Turista** | +1 por avioneta, ferry, metro o teleférico |
| `peajesPagados` | **El Colaborador** (oculta) | Monedas pagadas en alcabalas, la vaca y peajes |
| `metidasDePata` | **Metida de Pata** (oculta) | Caer en una trampa ajena, perder un microjuego por no hacer nada, comprar sin poder usar |
| `apagonesSufridos` | **Estrella del Apagón** (oculta) | Turnos que terminaste a oscuras |

---

## 11. Escalado por número de jugadores (1 a 4)

El máximo es **4** (petición del usuario). Las CPU rellenan los huecos. El modo de 8 jugadores de MP7 se descarta.

| Parámetro | 4 jugadores | 3 jugadores | 2 jugadores | 1 jugador + 3 CPU |
|---|---|---|---|---|
| Formatos | 4P / 1v3 / 2v2 por color | 3P todos contra todos / 1v2 | **Duelo** siempre | Como 4 |
| Pago por puesto (ronda relámpago) | 5/3/1/0 | 5/2/0 | 5/0 | 5/3/1/0 |
| Pago del gran reto | 20/12/6/2 | 20/10/3 | 20/5 | 20/12/6/2 |
| Precio de estrella | 20 | 20 | **15** (menos ingresos por ronda) | 20 |
| Puntos de Estrella activos | 1 (2 en la Recta Final) | 1 | 1 | 1 |
| Duración de la ronda relámpago (hot-seat) | ~2,5-3 min | ~2 min | ~1,3 min | ~40 s (CPU instantánea, resultado por simulación) |
| Turnos recomendados | 10-15 | 12-15 | 15 | 10-15 |
| Bonus stars | 2 + 1 | 2 + 1 | 1 + 1 | 2 + 1 |
| Cambiazo | Normal | Normal | Solo monedas | Normal |
| CPU | — | Rellena a 4 (opcional) | Rellena a 4 (opcional) | Dificultad 1-3 = `NIVEL` |

**CPU en los microjuegos** [propuesta]: probabilidad de ganar cada microjuego por dificultad (fácil 40 %, normal 60 %, difícil 80 %), modulada por `NIVEL` y por la velocidad. No se simula visualmente en el modo por turnos: se muestra un resultado rápido. (La serie fue criticada por CPU lentas y tontas: MP4, MP7, SMP.)

---

## 12. Glosario serie → versión venezolana

| Término de la serie | Nombre propuesto | Nota |
|---|---|---|
| Star | **Estrella** (o «la Estrella del Ávila») | Se mantiene «estrella» |
| Coins | **Monedas** / «churupos» | «Bolos» queda como chiste opcional |
| Blue / Red space | Casilla **Chévere** / Casilla **Qué Vaina** | — |
| Happening / Event | Casilla **¡Épale!** | — |
| Chance Time | **El Cambiazo** | — |
| Bowser Space | **El Jefe** / La Alcabala Mayor | Sin política real |
| Bowser Revolution | **Reparto de la Vaca** | — |
| Boo | **El Vivo** | Estafador simpático, nunca violento |
| Koopa Bank | **La Vaca** | — |
| Toad / Toadette (vendedor de estrellas) | Un personaje de reparto (abuela, el pana) | Reutiliza `BUS.AP.CAST` |
| Item Shop | **Bodega** / **Buhonero** | — |
| Last 5 Turns | **La Recta Final** | — |
| Bonus Stars | **Estrellas de Cierre** | — |
| Minigame round | **Ronda Relámpago** (5 microjuegos) | Novedad |
| Boss minigame | **El Gran Reto** | Novedad del modo |
| Duel | **Pique** | — |
| Ally / Buddy | **Pana** | v2 |
| Pro Rules | Reglamento **Tranqui** | — |
| Day/Night | **Luz / Apagón** | Firma del mapa |

---

## 13. Antipatrones: lo que la serie aprendió a golpes

| Error | Juego | Síntoma | Regla para nosotros |
|---|---|---|---|
| Vehículo compartido | MP9, MP10 | «Sin agencia, sin traiciones» | Fichas individuales siempre; un vehículo solo como **evento puntual** (camionetica) |
| Moneda única sin compra | MP9, MP10 | Puro azar | Monedas + estrellas |
| Peligros que quitan la mitad | MP9-10 | «Injusto», borra los minijuegos | Tope del 50 % de monedas, 1 estrella |
| Pagos planos de minijuego | MP9 | La habilidad no importa | 1.º claramente arriba |
| Transferencia total (Cápsula Milagro) | MP5 | Rabia | Prohibida |
| Bonus stars ocultas y aleatorias | MP7-8 | «Amañado» | Visibles + 1 de chiste |
| Tableros grandes y lentos | MP4, MP8 | Aburrimiento | Transporte + saltar animaciones |
| CPU lentas | MP3-7, SMP | Esperas | Menos de 0,5 s y resultados simulados |
| Controles físicos dañinos | MP1 (ampollas) | Demanda | Toques y deslizamientos cortos; nada de frotar la pantalla |
| Micrófono y gimmicks | MP6-7 | Ignorados | Nada de micrófono |
| Mapas vacíos | Star Rush | Monotonía | ≥ 25 % de casillas especiales |
| Reciclar sin novedad | MP5, MP7, MP8 | «Más de lo mismo» | Humor venezolano + mapa enorme + ronda relámpago |
| Tienda restringida por estado poco claro | MP4 (tamaño Mini) | Frustración | Reglas de tienda visibles |
| Quitar 1v3 / 2v2 | MP9, IT, SR | Menos variedad | Mantenerlos |
| Retroceso que hace perder un turno | Space Land | «Injusto» | Retrocesos cortos y con chiste |

---

## 14. Checklist: ¿esto es un Mario Party?

Marca cada punto antes de dar por buena una versión. Los **16 primeros son obligatorios**.

**Bucle y meta**
- [ ] 1. Cada jugador tiene su **ficha** y tira su **dado** (1-10 o equivalente).
- [ ] 2. El mapa tiene **bifurcaciones** y al menos un **atajo pago** por región.
- [ ] 3. Hay **una moneda** (monedas) y **una meta** (estrellas) comprable.
- [ ] 4. La estrella **cambia de sitio** después de cada compra y el cambio se **ve**.
- [ ] 5. **Número de turnos fijo** elegido al inicio.
- [ ] 6. Gana quien tenga más estrellas → monedas → dado.

**Tablero**
- [ ] 7. Existen casillas **azul +3 / roja −3 / evento**.
- [ ] 8. Al menos **1 de cada 4 casillas** hace algo especial.
- [ ] 9. El mapa tiene un **estado global** (luz/apagón) que los jugadores pueden **pagar para cambiar**.
- [ ] 10. Hay efectos **de paso** (tienda, estrella, banco, peaje), no solo de casilla final.

**Minijuegos**
- [ ] 11. **Cada ronda** termina con minijuego(s).
- [ ] 12. El **formato** (4P / 1v3 / 2v2) lo decide **dónde cayeron**.
- [ ] 13. El 1.º gana **claramente más** que el 2.º.

**Interacción y drama**
- [ ] 14. **Objetos** (2-3 huecos) con al menos uno para moverse, uno de ataque y uno de defensa.
- [ ] 15. Hay al menos **un evento de vuelco** (Cambiazo / El Jefe) **con tope**.
- [ ] 16. **La Recta Final** cambia algo y el último tiene voz.
- [ ] 17. **Bonus stars** por estadísticas, con reglas explicables y empate compartido.
- [ ] 18. Robos, compras de estrella y cambios de puesto se **anuncian en pantalla grande**.
- [ ] 19. Un jugador con 0 monedas **sigue en el juego** (red de seguridad).

**Ritmo y accesibilidad**
- [ ] 20. Turno de jugador ≤ 30 s; todas las animaciones se pueden saltar.
- [ ] 21. Partida Exprés ≤ 35-50 min.
- [ ] 22. Las CPU rellenan los huecos sin hacer esperar.
- [ ] 23. Existe un reglamento **Tranqui** con menos azar.

**Identidad (nuestro diferencial)**
- [ ] 24. Cada región tiene un **gimmick propio** y humor reconocible (sin política, sin burlarse de grupos).
- [ ] 25. La **ronda relámpago** de 5 microjuegos y el **gran reto** existen y se sienten distintos entre sí.

> **Prueba rápida de 3 preguntas:** (1) ¿El que va último en el turno 10 **todavía cree** que puede ganar? (2) ¿Alguien **gritó** en los últimos 10 minutos? (3) ¿El mejor en minijuegos gana **más de la mitad** de las veces, pero **no siempre**? Si las tres respuestas son sí, es un Mario Party.

---

## 15. Decisiones abiertas y restricciones técnicas

### 15.1 Restricciones del repo (según el reconocimiento del código)

| Restricción | Impacto en la fórmula | Mitigación [propuesta] |
|---|---|---|
| Microjuegos actuales de **un jugador**, resultado binario `win`/`lose` | La ronda relámpago puntúa **por número de ganados** (encaja bien); el desempate necesita el tiempo hasta ganar (`G.t` al ganar) | Exponer `tGana` en `setOutcome` del nuevo modo |
| Entrada **global y de un solo puntero** | La ronda simultánea no es posible con los juegos actuales | MVP **por turnos** con semilla compartida; simultáneo en v2 con enrutador por `pointerId` |
| `Math.random` sin semilla en el lab | «Todos juegan el mismo microjuego» no sería justo | Parchear con un RNG con semilla (mulberry32, como en `js/core.js`) |
| Lienzo lógico de 800×600 sin cámara | El mapa enorme necesita paneo y zoom propios | Cámara del tablero con `translate/scale` y LOD por región |
| Árbol de trabajo con ~48 archivos modificados | Riesgo de conflictos | Archivos nuevos (`juego-party-*.js` / `fiesta-*.js`) y tocar `campana.js` lo mínimo |

### 15.2 Preguntas para el usuario

1. **¿Un solo dispositivo (hot-seat) para el MVP?** Define si el modo por defecto es Exprés de 10 o Normal de 15 (§4.3).
2. **¿Ronda relámpago en todos los turnos o alternada?** En hot-seat, una ronda por turno lleva la partida Normal a ~70 min. Alternativa: relámpago cada turno en **relevos** y completa cada 5.º.
3. **¿Precio de estrella 20 (clásico) o 10 (SMP)?** Este documento recomienda **20** con descuentos a 10 en la Recta Final.
4. **¿El «dólar paralelo» (precio variable de 15 a 25 por ronda) entra en Caos?** Encaja con el humor, pero añade azar a la meta central. Sugerencia: solo en Caos y solo después del turno 5.
5. **Tono:** confirmar la lista de lo que queda fuera (política, violencia, burla a regiones o etnias; respetar a los Warao en «Deltamacura»).

### 15.3 Próximos documentos sugeridos

Ya escritos: `02-evolucion-serie.md`, `03-catalogo-mecanicas.md`, `04-minijuegos-y-final.md`, `05-venezuela-mapa-y-mecanicas.md` y `06-plan-implementacion.md`.

Pendiente: el **SVG borrador del mapa** (la guía está en el doc 05, §20) y una **tabla única de constantes** que reconcilie los números de los docs 01, 03, 04, 05 y 06 (hoy se contradicen en pagos de minijuegos, frecuencia del gran reto, nombres y duración).

---

*Las cifras de la serie salen de la investigación por juego. Las cifras marcadas [propuesta] son un punto de partida para iterar y no un dato. Antes de fijarlas en código hay que verificar las marcadas «(por verificar)», en especial los pagos exactos de los minijuegos de MP2 y Jamboree, el doble de Homestretch (6 frente a 12) y los detalles de Bowser Revolution y Boo.*
