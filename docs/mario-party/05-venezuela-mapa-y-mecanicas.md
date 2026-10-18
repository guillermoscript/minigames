# 05 · El Gran Mapa de Venezuela: tablero, regiones y mecánicas

> Documento de diseño del **tablero principal** del modo tipo Mario Party (nombre de trabajo **LA FIESTA**, ver `06-plan-implementacion.md`).
> Se apoya en la fórmula (`01`), la evolución de la serie (`02`) y el catálogo de mecánicas (`03`).
> Lo que no se pudo verificar va marcado **(por verificar)**. Los números son **propuestas de balance**. El simulador de `06` (`simular.js`) es quien decide si se quedan.
> Coordenadas: lienzo de 1000 × 1000, con **x de oeste a este** e **y de norte a sur**. Son coordenadas **de diseño, no cartográficas**: deforman el país para que se lea bien en pantalla.

---

## 0. Resumen en 10 líneas

1. **Un solo mapa gigante y conectado**: **114 casillas**, **11 regiones** de 7 a 12 casillas cada una y **148 conexiones**. **Caracas** es el hub y allí está la **Salida** (Plaza Bolívar).
2. **La vuelta grande a pie** (Caracas → Centro → Andes → Llanos → Guayana → Deltamacura → Oriente → Caracas) mide **45 pasos**. Con un dado de 1 a 10 (media 5,5) eso son unas **8 tiradas**: en una partida de 15 turnos se dan casi 2 vueltas, y los atajos y transportes cambian la cuenta.
3. **Islas y zonas premium** a las que **solo se llega pagando**: Margarita (ferry o avión), Los Roques (avioneta) y Canaima por aire. Maracaibo queda detrás del **peaje del Puente sobre el Lago**.
4. **Cinco estados globales** que los jugadores pueden manipular: **Luz/Apagón** (interruptor de Guri), **La Crecida** del llano, **Neblina** del tepuy, **La Isla que Aparece** y la **Camionetica** que recorre la troncal.
5. **Estrella**: la vende **la Abuela** (reparto existente de `BUS.AP`) por **10 monedas** al **pasar o caer**. Hay **dos estrellas simultáneas desde el inicio**; al comprar una, **solo esa se muda en camionetica** a un lugar candidato (las **15 marcadas + todas las azules**), con reglas anti-runaway.
6. **Villano recomendado: Don Corte, el Señor Apagón.** Alternativas: **Don Inflación** y **El Silbón**. Hay ruleta de villano, tope de daño y red de seguridad si tienes 0 monedas.
7. **Interactividad**: 2 teleféricos, metro, ferry, avión y avioneta, lancha, chalana, curiara, camionetica, 2 peajes, **2 alcabalas móviles**, **2 portones con llave**, **2 saltos con paracaídas**, **2 pozos petroleros comprables** y **Spa en Los Roques**, que te deja **mover la estrella** pagando.
8. **10 tiendas** con personalidad (Bodegón, Farmacia de guardia, Zona Libre, Mercadito Paralelo, buhonero ambulante…) y **15 objetos** venezolanos. Se pueden llevar **3 como máximo**.
9. **Deltamacura**: la región que «no sale en el mapa». Su GPS recalcula, tiene una isla intermitente y **28 cartas** de eventos raros con pesos definidos.
10. Al final hay un **JSON completo** (nodos con coordenadas, tipo, región y adyacencia dirigida) y una **guía de SVG** (silueta estilizada, lago, ríos y estilo de cada tipo de arista).

---

## 1. Principios que guían el mapa (y de qué juego salen)

| Principio | Por qué (lección de la serie) | Cómo se aplica aquí |
|---|---|---|
| Ramas, bucles y atajos, nunca un tablero lineal | MP9/MP10 fueron criticados por tableros lineales («una vez visto, ya lo conoces») | 26 cruces con decisión. Hay rutas largas gratis y rutas cortas que se pagan |
| El mapa es la estrategia, no el dado | MP3 (flechas que cambian, estrella falsa) y MP6 (reglas propias de cada tablero) | Cada región tiene **una mecánica firma** (§4) |
| Un estado global que se paga para manipular | Día/noche de Horror Land (lámpara de 10), Tide Shell de Jamboree | **Luz/Apagón** con interruptor en Guri por 10 monedas (§7) |
| Peajes escalantes y guardias que se mueven | Thwomp de Yoshi's Tropical Island, MP1 (1, +1 por pago), Whomp de Horror Land | Puente sobre el Lago (1 → 10) y **alcabalas móviles** (§6) |
| Estrella que se muda tras cada compra | MP1-Jamboree | La Abuela se muda en camionetica (§8) |
| Nada de mapas vacíos | Star Rush fue criticado por mapas vacíos | Solo el 38 % de las casillas son azules. El resto hace algo |
| Retrocesos rápidos y cómicos, no pérdida de turno completa | Space Land (Superstars) fue el peor valorado por los «speeders» que te devuelven | Los envíos a la Salida dan **consuelo** (+5) y nunca quitan monedas además |
| Ayudas para remontar visibles y programadas | Chump Charity (MP8), ruleta del último (MP4-MP7), Homestretch | Recta Final (§14) y reglas de aparición de la estrella que favorecen a los últimos |
| Turnos ágiles | Queja n.º 1: esperar | Los viajes **consumen pasos** en vez de turnos, y la CPU usa animaciones ×2 (ver `06`) |

---

## 2. Escala, ritmo y tamaños de partida

| Medida | Valor | Nota |
|---|---|---|
| Casillas | 114 | Entre 7 (Los Roques) y 12 (Caracas, Zulia, Andes) por región |
| Aristas (salidas dirigidas) | 148 | 26 de ellas son especiales: con costo, con requisito o de transporte. Hay 26 cruces |
| Vuelta grande a pie | 45 pasos | Unas 8 tiradas de 1d10 |
| Distancia máxima a pie desde la Salida | 44 pasos | Petare, Chacao, Altamira y Ávila: el regreso a Caracas |
| Casillas solo alcanzables pagando | 29 | Margarita, Los Roques, el lado oeste del Lago (incluye Catatumbo), El Vigía, Galipán, Pico Espejo, Los Nevados, San Juan, Caicara y la Isla del Delta (verificado con script sobre el JSON de §19) |
| Candidatas a estrella | 15 marcadas + todas las azules | Más Salto Ángel como estrella premium. Hay 2 estrellas activas a la vez desde la ronda 1 |

**Tamaños de partida** (la regla de turnos vive en `06`; aquí está lo que cambia en el mapa):

| Modo | Turnos | Regiones activas | Ajuste de mapa |
|---|---|---|---|
| **Exprés** | 10 | Caracas, Centro-Occidente, Oriente y Mochima, Margarita, Los Roques y Llanos | Las demás regiones se ven «en obras» (conos naranja, se pueden atravesar pero la estrella no aparece allí). Los vuelos cuestan la mitad |
| **Estándar** (por defecto) | 15 | Todas | Las estrellas aparecen a 4 pasos o más de cualquier jugador y pegadas a la acción (§8) |
| **La Gran Vuelta** | 25-30 | Todas | Una 3.ª estrella bonus. Bowser Time de Don Corte cada 5 rondas (§12) |

**Ritmo visual:** las rondas se reparten en tercios **día / atardecer / noche** y reutilizan el tinte `NIV` de `campana.js`. Los últimos 5 turnos siempre van en «noche de feria».

---

## 3. Leyenda de casillas

Regla general: **todas las casillas cuentan como paso**. Las tiendas y los vendedores (la Abuela, el buhonero) se ofrecen **al pasar o al caer**, como en MP2.

| Tipo (`t`) | Cant. | Color en el SVG | Al caer | Al pasar | Color para el reparto del minijuego |
|---|---|---|---|---|---|
| `salida` | 1 | dorado | +3 | **+5 «el cafecito de la Abuela»**, una vez por vuelta | verde (sorteo) |
| `azul` | 43 | azul | **+4** (+8 en la Recta Final) | — | azul |
| `roja` | 11 | rojo | **−3** (−6 en la Recta Final) | Te pueden **colear** (§10) | rojo |
| `evento` | 13 | verde «?» | Efecto propio del lugar (§4) | — | verde |
| `especial` | 15 | morado con ícono | Regla única del lugar (§4 y §6) | Algunas también al pasar | verde |
| `vaina` («¡Qué Vaina!», el Chance Time) | 2 | arcoíris | Ruleta de 3 tambores (§11) | — | verde |
| `villano` | 4 | negro con enchufe | Ruleta de Don Corte (§12) | — | rojo |
| `duelo` | 4 | naranja con espadas | Retas a un jugador (apuesta por ruleta) | — | verde |
| `banco` («La Vaca») | 3 | rosado | Cobras todo el pote | **Pagas 3** al pote (5 en la Recta Final) | verde |
| `ahorita` | 2 | gris con reloj | Carta boca abajo que se resuelve en 1-4 turnos (§11) | — | verde |
| `alcabala` | 2 | naranja con cono | Paso obligado con cobro (§6) | Igual que al caer | rojo |
| `transporte` | 7 | celeste con ícono | Bono pequeño (+2) y ofrece viaje | Ofrece viaje | verde |
| `delta` | 7 | violeta con remolino | **Carta del Delta** (§13) | — | verde |

> Proporción: 38 % azules, 13 % «malas» (roja, villano o alcabala) y 49 % con decisión o evento. Es un mapa a propósito **más vivo que un tablero N64** (que rondaba 60 % azul). Si el simulador muestra turnos demasiado lentos o caóticos, la palanca es convertir `evento` en `azul`.

---

## 4. Las 11 regiones, casilla por casilla

Formato: **id** · nombre · tipo · regla. ★ = candidata a estrella.

### 4.1 Caracas (hub) · `ccs` · 12 casillas · color dorado

**Identidad:** la capital, el tráfico, el Ávila, el metro y el aeropuerto. Todo el mundo vuelve aquí al final de cada vuelta.
**Mecánica firma: «Hora Pico».** El metro te mueve rápido dentro de la ciudad, pero a veces te escupe donde le da la gana.

| id | Lugar | Tipo | Regla |
|---|---|---|---|
| `ccs_start` | Plaza Bolívar (SALIDA) | salida | Todos arrancan aquí con 10 monedas. Al pasar: +5 (una vez por vuelta). Destino de los «vuelve a la Salida» |
| `ccs_sabana` | Bulevar de Sabana Grande | banco | **La Vaca de Sabana Grande**: al pasar pagas 3, al caer cobras el pote |
| `ccs_parquecentral` | Torres de Parque Central | azul ★ | +4 |
| `ccs_metro` | Metro de Caracas | transporte | Al pasar o caer: pagas **2** y vas a cualquier casilla `ccs_*` (consume 1 paso). Tira 1d6: con **1, «Hora pico»**, la multitud te deja en una casilla `ccs_*` al azar. **Cerrado en Apagón** |
| `ccs_arana` | Distribuidor La Araña | roja | −3. **Cruce**: al oeste (Centro) o al norte (La Guaira) |
| `ccs_guaira` | La Guaira | azul | +4 |
| `ccs_maiquetia` | Aeropuerto de Maiquetía | transporte | **Hub aéreo**: Los Roques (avioneta, 10), Porlamar (avión, 8), Canaima (avioneta, 15) y Maracaibo (avión, 10). Gratis por carretera de vuelta a La Araña |
| `ccs_petare` | Redoma de Petare | roja | −3. Entrada a Caracas desde el Oriente |
| `ccs_chacao` | Chacao | azul | +4 |
| `ccs_altamira` | Plaza Altamira | azul | +4. **Tienda: Bodegón** (§9) |
| `ccs_avila` | Teleférico Warairarepano | transporte | **Cruce**: gratis a la Salida o **teleférico por 5** a Galipán (consume 1 paso). Cerrado en Apagón |
| `ccs_galipan` | Galipán (fresas con crema) | evento ★ | «Fresas con crema»: eliges entre +4 monedas o comprar 1 objeto con 2 de descuento. Baja directo a La Guaira, un atajo hacia el aeropuerto |

### 4.2 Centro-Occidente · `coc` · 10 casillas · verde lima

**Identidad:** Maracay, Valencia, Choroní, Morrocoy, Coro y Barquisimeto. Playa de fin de semana y carretera.
**Mecánica firma: «Fin de semana largo».** La costa está llena de atajos en lancha, y el Pittier marea.

| id | Lugar | Tipo | Regla |
|---|---|---|---|
| `coc_tejerias` | Las Tejerías (la cola de la ARC) | roja | −3 |
| `coc_maracay` | Maracay, Ciudad Jardín | azul | +4. **Cruce de 3**: Valencia, Choroní o **camionetica a San Juan de los Morros (3)** |
| `coc_choroni` | Curvas del Pittier | evento | **«¡Cuántas curvas!»**: tira 1d6. Con 1-2 te mareas y tu próxima tirada es 1-5. Con 3-6, «compraste cacao en la vía», +3 |
| `coc_puertocolombia` | Puerto Colombia (Choroní) | azul ★ | +4. **Cruce**: lancha a Morrocoy (3) o vuelta gratis a Maracay |
| `coc_valencia` | Valencia | azul | +4. **Tienda: Farmacia de guardia**. **Portón con llave** directo a Barquisimeto (§6) |
| `coc_puertocabello` | Puerto Cabello | azul | +4 |
| `coc_morrocoy` | Cayo Sombrero (Morrocoy) | especial ★ | **«Alquila la lancha»**: pagas 3 y saltas a Puerto Colombia, Puerto Cabello o Coro (consume 1 paso). Si no pagas: «día de playa», +2 |
| `coc_coro` | Médanos de Coro | especial | **«Sandboard»**: al caer avanzas 1d4 casillas más (sin volver a resolver la de destino si es otra especial) |
| `coc_sanfelipe` | San Felipe | vaina | ¡Qué Vaina! (§11) |
| `coc_barquisimeto` | Barquisimeto, Capital Musical | duelo | Duelo («Duelo de tamunangue»). **Cruce** hacia los Andes o los Llanos, con **alcabala móvil A** (§6) |

### 4.3 Zulia y Lago de Maracaibo · `zul` · 12 casillas · turquesa

**Identidad:** el calor, la gaita, el puente, los balancines petroleros y el Relámpago del Catatumbo.
**Mecánica firma: «El Puente y el Rayo».** Para llegar a Maracaibo, a su tienda y a su estrella hay que pagar el peaje escalante. Si no, toca la ruta de la costa oriental. El Catatumbo te deja dirigir el rayo contra alguien.

| id | Lugar | Tipo | Regla |
|---|---|---|---|
| `zul_dabajuro` | Carretera de Dabajuro | roja | −3 («sin aire acondicionado») |
| `zul_altagracia` | Los Puertos de Altagracia | azul | +4. **Cruce**: Puente (peaje) o costa oriental (gratis) |
| `zul_puente` | Puente sobre el Lago | alcabala | **Peaje escalante**: 1 moneda el primero y +1 por cada pago de cualquier jugador, con tope de 10. Se resetea a 1 con cada Apagón («se cayó el sistema del peaje: pase gratis»). Si no puedes pagar, no se habilita esa salida |
| `zul_maracaibo` | Maracaibo | azul ★ | +4. **Tienda: Bodega El Saladillo**. Avión a Maiquetía (10) |
| `zul_gaita` | Feria de la Gaita | evento | **«¡Gaitazo!»**: todos ganan +2 y quien cae +5. En diciembre (opción de temporada) el triple |
| `zul_sanfrancisco` | San Francisco (40 °C a la sombra) | roja | −3. En Apagón, −6 («sin aire, sin luz, sin paciencia») |
| `zul_machiques` | Machiques (queso y ganado) | azul | +4 |
| `zul_catatumbo` | Relámpago del Catatumbo | especial ★ | **«Dirige el rayo»**: pagas 5 y eliges a un jugador **en cualquier parte del mapa**: pierde 8 monedas (van al banco más cercano) **o** su próxima tirada es 1-5, a tu elección. Si no pagas: rayo al azar, 50 % +5 («te cargó el celular») y 50 % −5 |
| `zul_encontrados` | Encontrados | azul | +4. Sale a El Vigía (Andes) |
| `zul_cabimas` | Cabimas (los balancines) | azul | +4 |
| `zul_ojeda` | Ciudad Ojeda: Pozo en el Lago | especial | **Pozo comprable A** (§6) |
| `zul_lagunillas` | Lagunillas | villano | Ruleta de Don Corte. Sale a Valera (Andes) |

### 4.4 Los Andes · `and` · 12 casillas · azul acero

**Identidad:** frío, páramo, teleférico Mukumbarí, helados de mil sabores y la frontera.
**Mecánica firma: «El Páramo».** El frío limita tu dado a menos que comas. El teleférico es un atajo caro a la estrella de Pico Espejo y a la bajada hacia los Llanos.

| id | Lugar | Tipo | Regla |
|---|---|---|---|
| `and_carora` | Carora (cocuy y uvas) | azul | +4 |
| `and_valera` | Valera | azul | +4. Aquí llega la ruta de la costa oriental del Lago |
| `and_timotes` | Timotes | roja | −3 |
| `and_aguila` | Pico El Águila | especial | **«Te pegó el páramo»**: tu próxima tirada se limita a 1-5, **salvo que** uses un objeto de comida (Arepa, Malta o Guayoyo). **Salto con Paracaídas** a Barinas («bajada en parapente por la Trasandina») |
| `and_mucuchies` | Mucuchíes | azul | +4 (un perro mucuchíes te acompaña un rato) |
| `and_merida` | Mérida | azul | +4. **Tienda: Heladería de los Mil Sabores**. **Cruce**: Ejido (gratis) o **Teleférico Mukumbarí (8)** a Pico Espejo |
| `and_picoespejo` | Pico Espejo (Mukumbarí) | especial ★ | **«Selfie a 4.765 m»**: +4, y cuenta doble para la estadística de «Mochilero». Cerrado si hay Neblina andina (carta de evento) |
| `and_losnevados` | Los Nevados | azul | +4. Baja a Barinas |
| `and_ejido` | Ejido | duelo | Duelo |
| `and_sancristobal` | San Cristóbal (Feria de San Sebastián) | evento | **«La Feria»**: ruleta de 3: +6 monedas, objeto gratis al azar o «te pisaron en la multitud», −3 |
| `and_sanantonio` | San Antonio (Casa de Cambio) | alcabala | **Paso obligado**: pagas 3 de «sellado» **o** juegas **«Cambio de monedas»**: 1d6 → 1: pierdes 30 %, 2-3: igual, 4-5: +20 %, 6: +50 % (tope +15) |
| `and_elvigia` | El Vigía | azul | +4. Aquí llega la ruta del sur del Lago |

### 4.5 Llanos y Apure · `lla` · 11 casillas · ocre

**Identidad:** joropo, coleo, chigüires, sabanas que se inundan, el Silbón de leyenda y el río Apure.
**Mecánica firma: «La Crecida».** Cada 4 rondas el agua sube y el llano se vuelve lento. La chalana del Apure es el atajo fluvial a Guayana.

| id | Lugar | Tipo | Regla |
|---|---|---|---|
| `lla_acarigua` | Acarigua (el granero) | azul | +4 |
| `lla_guanare` | Guanare | ahorita | Carta «Ahorita» (§11) |
| `lla_barinas` | Barinas | villano | Ruleta de Don Corte. Aquí llegan Los Nevados y el parapente |
| `lla_hato` | Hato El Cariño (coleo) | especial | **«¡Colea el toro!»**: microjuego individual de tiempo (tocar en el momento justo, unos 5 s). Si ganas: +8. Si pierdes: 0, «te revolcó el polvero». **Portón con llave** directo a San Fernando |
| `lla_guasdualito` | Guasdualito | azul | +4. Llega desde la frontera andina |
| `lla_mantecal` | Mantecal (la crecida) | especial | **Indicador de La Crecida** (§7). Al caer en Crecida: «pescaste un coporo», +4 |
| `lla_achaguas` | Achaguas (chigüires) | azul ★ | +4. En Crecida aparece el **chigüire taxi**: pagas 2 y avanzas 3 sin costo de agua |
| `lla_sanfernando` | San Fernando de Apure | azul | +4. **Tienda: Bodega Llanera**. **Cruce**: Calabozo o **chalana por el Apure (4)** a Caicara del Orinoco |
| `lla_sanjuan` | San Juan de los Morros | azul | +4. Solo se llega en camionetica desde Maracay |
| `lla_calabozo` | Calabozo (las anguilas) | evento | **«Anguila eléctrica»**: 1d6 → 1-3: «corrientazo», pierdes 1 objeto al azar. 4-6: «cargaste la batería», tu próxima tirada +2 |
| `lla_pascua` | Valle de la Pascua | duelo | Duelo («contrapunteo de joropo»). Sale a El Tigre (Guayana) |

### 4.6 Guayana · `gua` · 11 casillas · marrón

**Identidad:** el Orinoco y el Caroní que no se mezclan, el Puente Angostura, la represa de Guri, el oro de El Callao y la faja petrolera.
**Mecánica firma: «El Interruptor de Guri».** Quien pasa por Guri puede **apagar o prender el país entero**.

| id | Lugar | Tipo | Regla |
|---|---|---|---|
| `gua_eltigre` | El Tigre: Pozo de la Faja | especial | **Pozo comprable B** (§6). Llega desde los Llanos y desde Barcelona |
| `gua_angostura` | Puente Angostura | azul | +4 |
| `gua_caicara` | Caicara del Orinoco | azul | +4. Llegada de la chalana |
| `gua_cbolivar` | Ciudad Bolívar | azul | +4. **Tienda: Mercado del Orinoco**. **Cruce**: autopista, Guri o **avioneta a Canaima (8)** |
| `gua_autopista` | Autopista Cdad. Bolívar–Pto. Ordaz | roja | −3 |
| `gua_guri` | Represa de Guri | especial | **INTERRUPTOR GLOBAL** (§7): al pasar o caer, pagas **10** para cambiar Luz ↔ Apagón. Al caer sin pagar: «turno de vigilante», +3 |
| `gua_llovizna` | Parque La Llovizna | azul ★ | +4 |
| `gua_pordaz` | Puerto Ordaz (Caroní + Orinoco) | banco | **La Vaca del Caroní**. **Cruce** a Deltamacura o a la Gran Sabana, con **alcabala móvil B** |
| `gua_sanfelix` | San Félix | vaina | ¡Qué Vaina! Sale a Deltamacura |
| `gua_upata` | Upata | villano | Ruleta de Don Corte |
| `gua_elcallao` | El Callao (calipso) | evento | **«Comparsa de calipso»**: todos los jugadores a ≤ 6 pasos de ti avanzan 2 hacia ti (§11) y tú ganas +2 por cada uno que «se unió a la fiesta» |

### 4.7 Canaima y Gran Sabana · `can` · 10 casillas · verde selva

**Identidad:** tepuyes, Salto Ángel, Roraima y «El Mundo Perdido».
**Mecánica firma: «El Mundo Perdido».** Hay estrella premium en Salto Ángel, neblina que encoge el dado y un salto en paracaídas que te deja en Guri.

| id | Lugar | Tipo | Regla |
|---|---|---|---|
| `can_km88` | Km 88 (La Escalera) | roja | −3 («se recalentó el carro en la subida») |
| `can_jaspe` | Quebrada de Jaspe | azul | +4 |
| `can_kama` | Salto Kamá | azul | +4 |
| `can_santaelena` | Santa Elena de Uairén | azul | +4. **Tienda: Bodega de la Frontera** |
| `can_roraima` | Roraima: El Mundo Perdido | especial ★ | **«¿Eso fue un dinosaurio?»**: 1d6 → 1: te persigue «algo», retrocedes 3. 2-5: +4. 6: encuentras un huevo raro, objeto gratis al azar |
| `can_sabana` | Sabana de los Tepuyes | evento | **Activa la Neblina** (§7) durante 2 rondas. Quien cae gana +3 |
| `can_kavac` | Cueva de Kavac | ahorita | Carta «Ahorita» |
| `can_saltoangel` | Salto Ángel (Kerepakupai Merú) | especial | **ESTRELLA PREMIUM**: compras 1 estrella por **35**, una vez por jugador y partida. **Salto con Paracaídas** directo a Guri |
| `can_laguna` | Laguna de Canaima | transporte | +2. **Avioneta a Maiquetía (10)** o curiara |
| `can_carrao` | Curiara por el Carrao | evento | **«Rápidos»**: avanzas 1d4 adicionales, siempre por el río (sale a Guri) |

### 4.8 Deltamacura · `del` · 9 casillas · violeta

**Identidad:** «el lugar que no existe». El GPS dice «recalculando», el peñero no tiene motor y nadie sabe si hoy es ayer.
**Mecánica firma: CAOS CONTROLADO.** Todas las casillas `delta` sacan carta (§13), el cruce del GPS cambia solo, la isla aparece y desaparece y la salida no siempre lleva a Maturín.

> **Tono**: Deltamacura es un lugar **ficticio y surreal** inspirado en la idea de un delta laberíntico. **No representa ni caricaturiza** al estado Delta Amacuro real ni al pueblo warao. Sin vestimenta, idioma ni rasgos de pueblos indígenas como chiste. El humor está en la **geografía imposible**, no en las personas.

| id | Lugar | Tipo | Regla |
|---|---|---|---|
| `del_entrada` | El Puente que Ayer No Estaba | delta | Carta del Delta. Al entrar a la región por primera vez en la partida: +3 «bienvenido a donde sea esto» |
| `del_gps` | «Recalculando…» | delta | Carta. **Cruce que cambia solo**: la flecha alterna entre Neblina y Reloj cada ronda. Con **Vela** ves a dónde apunta antes de tirar |
| `del_niebla` | Neblina de los Caños | delta | Carta |
| `del_reloj` | Caño Donde Es Ayer | delta | Carta |
| `del_espejo` | Caño Espejo | delta | Carta. **Cruce**: Isla (solo si es visible) o Mercadito |
| `del_isla` | La Isla que Aparece | especial ★ | Solo existe en rondas **pares** (o siempre, si tiene la estrella). Al caer: «encontraste el tesoro del peñero»: +10 o 1 objeto a elegir |
| `del_mercado` | Mercadito Paralelo | delta | Carta. **Tienda: Mercadito Paralelo** (precios locos, §9) |
| `del_penero` | Peñero Fantasma | transporte | Al pasar o caer: gratis, el peñero te lleva a **una casilla `transporte` al azar del mapa** (1d6 → 1-2 te lo ofrece, 3-6 te obliga «porque ya te montaste»). Se puede rechazar con Vela |
| `del_salida` | ¿Salida? | delta | Carta. Al salir de la región: 1d6 → 1-4 Maturín, 5 Puerto Ordaz, 6 «saliste por Petare» (Caracas) |

### 4.9 Oriente y Mochima · `moc` · 11 casillas · coral

**Identidad:** la Cueva del Guácharo, Carúpano y su carnaval, Paria y su cacao, Cumaná la primogénita, los peñeros de Mochima, el Paseo Colón y Barlovento.
**Mecánica firma: «Los Puertos».** Desde Cumaná y Puerto La Cruz salen ferris a Margarita, y Barcelona tiene una carretera secreta a El Tigre.

| id | Lugar | Tipo | Regla |
|---|---|---|---|
| `moc_maturin` | Maturín | azul | +4. Salida normal de Deltamacura |
| `moc_caripe` | Cueva del Guácharo | evento | **«A oscuras»**: hasta tu próximo turno, en cada cruce la ruta se elige **al azar**, salvo que tengas Vela. +3 por el susto |
| `moc_carupano` | Carúpano (Carnaval) | azul | +4. **Cruce**: Paria o Cumaná |
| `moc_paria` | Península de Paria (cacao) | azul ★ | +4. Sube a 5 si tienes Arepa («arepa con chocolate, no preguntes») |
| `moc_cumana` | Cumaná, la Primogénita | azul | +4. **Cruce**: Mochima o **ferry a Margarita (4)** |
| `moc_mochima` | Mochima: Playa Blanca | especial ★ | **«Échate en la playa»**: eliges **+8 monedas pero tu próxima tirada es 1-3**, o el **peñero a las islas**: pagas 2 y tiras 1d6 de pesca (+1d6 ×2 monedas) |
| `moc_plc` | Puerto La Cruz (Paseo Colón) | banco | **La Vaca del Paseo**. **Cruce**: Barcelona o **ferry a Margarita (5)** |
| `moc_barcelona` | Barcelona | roja | −3. **Cruce**: Barlovento (a Caracas) o **carretera a El Tigre** (Guayana) |
| `moc_uchire` | Boca de Uchire | villano | Ruleta de Don Corte |
| `moc_higuerote` | Higuerote (Barlovento) | evento | **«Tambores»**: microjuego de ritmo de 3 golpes. Si aciertas: +6. Si fallas: +1 por bailar igual |
| `moc_guarenas` | Cola Guarenas–Guatire | roja | −3. La «cola» más famosa: aquí se puede **colear** (§10) |

### 4.10 Margarita · `mar` · 9 casillas · rosado

**Identidad:** la Perla del Caribe: zona libre, playas, castillos y atardeceres.
**Mecánica firma: «Zona Libre».** La tienda más barata del mapa y una de las estrellas candidatas más codiciadas, pero el ferry o el avión cuestan.

| id | Lugar | Tipo | Regla |
|---|---|---|---|
| `mar_puntapiedras` | Punta de Piedras (ferry) | transporte | +2. **Cruce**: La Restinga o **ferry de vuelta** a Puerto La Cruz (5) o Cumaná (4). **Ferry retrasado**: al subir, 1d6 = 1 → te quedas en el muelle este turno pero +3 («empanada de cazón mientras esperas») |
| `mar_restinga` | Laguna de La Restinga | evento | **«Paseo por los manglares»**: avanzas 1d4 más |
| `mar_macanao` | Península de Macanao | azul | +4 |
| `mar_juangriego` | Juan Griego (el atardecer) | azul | +4. Entre las rondas 2/3 y 3/3 de la partida (atardecer): +6 |
| `mar_elagua` | Playa El Agua | azul ★ | +4 |
| `mar_asuncion` | La Asunción | duelo | Duelo |
| `mar_pampatar` | Castillo de Pampatar | evento | **«¡Cañonazo!»**: eliges a un jugador en Margarita u Oriente: retrocede 4 |
| `mar_porlamar` | Porlamar (Zona Libre) | azul | +4. **Tienda: Zona Libre** (−30 %). **Avión a Maiquetía (8)**. Cruce a Coche o a Punta de Piedras |
| `mar_coche` | Isla de Coche | azul | +4. Peñero gratis a Punta de Piedras |

### 4.11 Los Roques · `roq` · 7 casillas · celeste

**Identidad:** el paraíso caro. Solo se llega en avioneta y todo cuesta el doble, pero el Spa de Noronquí deja **mover la estrella**.
**Mecánica firma: «Lujo».** Bucle corto de 7 casillas con una estrella candidata y una casilla pay-to-win **acotada**.

| id | Lugar | Tipo | Regla |
|---|---|---|---|
| `roq_pista` | Gran Roque (la pista) | transporte | +2. **Avioneta a Maiquetía (10)** |
| `roq_faro` | Faro Holandés | azul | +4 |
| `roq_francisqui` | Cayo Francisquí | azul | +4 |
| `roq_cayoagua` | Cayo de Agua | azul ★ | +4 |
| `roq_crasqui` | Crasquí (langosta carísima) | roja | **−5** («la langosta estaba a precio de dólar») |
| `roq_madrisqui` | Madrisquí | evento | **«Snorkel»**: 1d6 → 1-2 te picó un erizo (−2), 3-5 +4, 6 encuentras una botella con un Dato del Vecino (objeto gratis) |
| `roq_noronqui` | Noronquí: Spa del Caribe | especial | **«Servicio VIP»**: pagas **20** y la Abuela **muda la estrella a Cayo de Agua** (si no estaba). Una vez por jugador y partida. **No disponible en la Recta Final** |

---

## 5. Conexiones y transporte

Regla única de transporte: **un viaje consume pasos de tu tirada, no tu turno.** Si te quedan pasos al llegar, sigues caminando desde el destino. Si la tirada no alcanza para el costo en pasos, no puedes tomar ese transporte en este turno (te quedas en la casilla de embarque).

| Modo | Aristas | Costo en monedas | Costo en pasos | Riesgo o regla especial | Cerrado en Apagón |
|---|---|---|---|---|---|
| **Camino** | 123 | 0 | 1 por casilla | — | No |
| **Teleférico** | Ávila → Galipán, Mérida → Pico Espejo | 5 / 8 | 1 | Neblina andina cierra Mukumbarí | **Sí** |
| **Metro** | Dentro de Caracas (regla de casilla) | 2 | 1 | Hora pico 1/6 | **Sí** |
| **Camionetica** | Maracay → San Juan de los Morros | 3 | 2 | Con «Pasaje de Por Puesto», gratis | No |
| **Lancha** | Puerto Colombia → Morrocoy (y la regla de Morrocoy) | 3 | 1 | — | No |
| **Ferry** | Cumaná ↔ Punta de Piedras (4), PLC ↔ Punta de Piedras (5) | 4 / 5 | 2 | Retraso 1/6 (pierdes el resto de pasos y ganas +3) | No |
| **Avión** | Maiquetía ↔ Porlamar (8), Maiquetía ↔ Maracaibo (10) | 8 / 10 | 3 | — | No («el aeropuerto tiene planta») |
| **Avioneta** | Maiquetía ↔ Los Roques (10), Maiquetía → Canaima (15), Canaima → Maiquetía (10), Cdad. Bolívar → Canaima (8) | 8-15 | 3 | Con Ticket de Avioneta, gratis | No |
| **Chalana** | San Fernando → Caicara | 4 | 2 | En La Crecida cuesta 2 | No |
| **Curiara** | Carrao → Guri | 0 | 1 | Es la salida natural de Canaima | No |
| **Peñero** | Coche → Punta de Piedras | 0 | 1 | — | No |
| **Peaje** | Puente sobre el Lago | 1 → 10 | 1 | Escalante | Se resetea a 1 |
| **Portón** | Hato → San Fernando, Valencia → Barquisimeto | 0 | 1 | **Requiere Llave** (se consume) | No |
| **Salto** | Pico El Águila → Barinas, Salto Ángel → Guri | 0 | 1 | **Requiere Paracaídas** (se consume) | No |

**Esquema macro** (flechas = sentido de circulación principal):

```
                 ROQUES ✈              MARGARITA ⛴
                    ↑↓                    ↑↓
  ZULIA ← CENTRO-OCC ← CARACAS(★salida) ← ORIENTE ← DELTAMACURA
   ↓  ↘(peaje)  ↓            ✈↓              ↑ (Barcelona→El Tigre)
  ANDES ──────→ LLANOS ──────────────→ GUAYANA ──→ (San Félix) ──↗
   (teleférico,     (chalana ⛵)         ↓↑ (Guri ⇄ curiara)
    parapente ↘)                       CANAIMA ✈ (avioneta a Caracas)
```

---

## 6. Elementos interactivos del mapa (reglas exactas)

### 6.1 Interruptores y estados que se pagan

| Elemento | Dónde | Costo | Efecto |
|---|---|---|---|
| **Interruptor de Guri** | `gua_guri` (al pasar o caer) | 10 | Cambia **Luz ↔ Apagón** en todo el mapa (§7.1). Máximo 1 cambio por ronda entre todos los jugadores |
| **Planta Eléctrica** (objeto) | Cualquier casilla tuya | 15 | Esa casilla y las 2 vecinas quedan con luz aunque haya Apagón. Quien caiga en ella **te paga 3** |
| **Dirigir el rayo** | `zul_catatumbo` | 5 | Ataque a distancia (§4.3) |
| **Spa VIP** | `roq_noronqui` | 20 | Muda la estrella a Cayo de Agua |
| **Pozo comprable A / B** | `zul_ojeda`, `gua_eltigre` | 15 si no tiene dueño, **25 para quitárselo** al dueño (el dueño anterior recibe 15) | Dueño: cada vez que **otro** cae ahí te paga 5. Si caes tú: regalías, +5 del banco. Un jugador puede tener los 2. En Apagón los pozos no pagan («se paró el balancín») |
| **Chigüire taxi** | `lla_achaguas` (solo en Crecida) | 2 | Avanzas 3 sin costo de agua |
| **Lancha de Morrocoy** | `coc_morrocoy` | 3 | Saltas a otra casilla costera de Centro-Occidente |

### 6.2 Peajes y alcabalas

- **Puente sobre el Lago (peaje escalante):** el precio arranca en **1** y sube **+1 con cada pago** de cualquier jugador, con **tope de 10**. El dinero se destruye: es un sumidero de monedas. Se resetea a 1 con cada Apagón. Así el primero en pasar lo hace casi gratis, y quien llega tarde paga la «cola». Es el patrón del Thwomp de Yoshi's Tropical Island (MP1).
- **Casa de Cambio de San Antonio:** se paga 3 o se juega la ruleta del cambio (§4.4). Es la única alcabala que **puede darte dinero**.
- **Alcabalas móviles A y B («la alcabala de conos» y su Señor del Chaleco)**. Es una caricatura de un controlador de tráfico con conos y pito: nada de policía real ni armas. Sigue el patrón del Whomp de Horror Land:
  - **A** vigila **una** de las dos salidas de `coc_barquisimeto` (Andes o Llanos). **B** vigila **una** de las dos salidas de `gua_pordaz` (Deltamacura o Gran Sabana).
  - Tomar la salida vigilada cuesta **5** monedas («la colaboración»). La salida libre no cuesta, pero **el Señor del Chaleco se muda a esa salida** después de que pases: las rutas populares se bloquean solas.
  - Con **Recibo de Luz Pagado** pasas gratis («tengo todos los papeles en regla»).
  - En la Recta Final la colaboración sube a 8.

### 6.3 Saltar casillas con objetos

- **Paracaídas del Salto** (objeto, 8): (a) usa una arista de **salto** (Águila → Barinas, Salto Ángel → Guri); (b) **o** en cualquier momento de tu movimiento **saltas por encima de 1 casilla** sin pisarla. Así esquivas una roja, un villano, un nido de zancudos o una alcabala de paso obligado. El salto cuenta como 1 paso.
- **Llave de la Finca** (objeto, 4): abre los **portones** (Hato → San Fernando, Valencia → Barquisimeto).
- **Ticket de Avioneta** (objeto, 18): desde **cualquier casilla** vuelas a cualquier casilla `transporte` con aeropuerto (Maiquetía, Porlamar, Maracaibo, Laguna de Canaima, Gran Roque). Gasta 3 pasos.

### 6.4 NPCs que se mueven por el mapa

| NPC | Movimiento | Interacción |
|---|---|---|
| **La Abuela** (vende la estrella) | Se muda tras cada venta (§8) | Pasar o caer → comprar estrella |
| **La Camionetica** (ruta «Troncal») | Al final de cada ronda avanza **2d6** por la vuelta grande | Si **pasa por encima de un jugador**, este grita «¡AGÁRRATE!» y **viaja con ella** hasta donde se detenga. Paga 2 de pasaje (si no puede, «te bajaron en la próxima» y avanza 1). Con el objeto Pasaje viajas gratis o te teletransportas a ella |
| **El Buhonero** | Cada ronda aparece en una casilla azul al azar de Caracas, Centro u Oriente | Tienda ambulante (§9) |
| **Don Corte** | Solo durante el Apagón: avanza 1d6 por ronda desde Guri | Quien comparta casilla con él al final de la ronda pierde 5 (con Recibo, 0) |
| **Alcabalas A y B** | Se mudan a la ruta libre que tome alguien | Ver §6.2 |

---

## 7. Estados globales del tablero

### 7.1 Luz / Apagón (estado firma de todo el mapa)

- **Inicio**: Luz.
- **Pasa a Apagón** por: el interruptor de Guri (10), la ruleta de Don Corte («¡Se fue la luz!») o una carta del Delta.
- **Duración**: hasta que alguien lo cambie en Guri, o **3 rondas** como máximo («volvió la luz… por ahora»).
- **Efectos del Apagón**:
  - Visual: tinte de noche (`NIV` 3) y capa `oscuro(luces)` con un radio de luz alrededor de cada ficha y de cada casilla con Planta.
  - **Cerrados**: metro, los 2 teleféricos y todas las tiendas **salvo el Bodegón** (tiene planta) y el Mercadito Paralelo (que funciona «con velas»).
  - Los pozos no pagan. El peaje del Puente se resetea a 1.
  - **Don Corte** sale a pasear (§6.4).
  - Las casillas azules **siguen dando +3** (no castigamos doble). San Francisco da −6.
  - La **Vela** anula para quien la usa: ve los cruces del Delta, la Cueva y los efectos de oscuridad.
- **Reutilización**: el `oscuro()`, la `vela` y el `bombillo` de `BUS.AP`, y el jefe `transformador` como minijuego largo opcional («¡Reactiva Guri!»).

### 7.2 La Crecida (Llanos)

- Se activa en las rondas **4, 8, 12…** y dura **2 rondas**.
- `lla_guasdualito`, `lla_mantecal` y `lla_achaguas` quedan **inundadas**: cada una cuesta **2 pasos** al cruzarla.
- La chalana baja a 2 monedas y aparece el chigüire taxi en Achaguas.
- En el SVG estas casillas llevan un overlay de agua con olas.

### 7.3 Neblina del Tepuy (Canaima)

- La activa `can_sabana` o una carta. Dura **2 rondas**.
- Quien empiece su turno en una casilla `can_*` tira **1d6** en lugar de 1d10. Los objetos de dado lo superan: Malta, Guayoyo y Dado a la Medida.

### 7.4 La Isla que Aparece (Deltamacura)

- `del_isla` es visible en rondas pares. Si la estrella está ahí, es visible **siempre**.
- Un jugador que esté **sobre** la isla cuando desaparece «amanece» en `del_mercado`.

### 7.5 GPS de Deltamacura

- La flecha de `del_gps` alterna cada ronda entre Neblina y Reloj. El jugador **no elige**: va a donde apunte.
- Con Vela ves la flecha **antes** de tirar y puedes decidir no gastar dados (por ejemplo, usar un objeto).

### 7.6 Tasa del Día (solo en el **Modo Caos**)

- Al inicio de cada ronda se gira una ruleta: la estrella cuesta **15 / 20 / 20 / 25** (valores sin reescalar al precio base 10; `cfg.tasa` está apagada por defecto, pendiente de decidir). Se ve en un letrero de casa de cambio arriba a la derecha.
- En el modo Normal/Pro está **apagada** (precio fijo 10), siguiendo la lección de Jamboree Pro Rules: menos azar escondido.

---

## 8. La Estrella: quién la vende, cuánto cuesta y dónde aparece

### 8.1 Vendedora: la Abuela

- Usa el personaje `ABU` / `AP.CAST.abuela` ya existente.
- Frase: «Mijo, la estrella vale 10. Y no me regatees, que esto no es Quinta Crespo.»
- **Precio**: 10 monedas (`cfg.precio`; Tasa del Día en el Modo Caos). Cada jugador empieza con **20 monedas** (`cfg.mon0`). El **Bono de la Abuela** deja la estrella a la **mitad** (`ceil(precio/2)` = 5). Se compra **al pasar o al caer**, como en MP2, lo que premia elegir bien la ruta.
- **Dos estrellas activas a la vez** (`S.estrella = {nodo, b, precio}`; `b` es null si `cfg.estrellas===1`; la UI y las CPU leen `estrellasEn(S)`). **1 estrella por pasada**. No se puede comprar si te quedarías con menos de 0 monedas.
- Tras vender, **se monta en una camionetica** (animación de 1 s con la cámara alejada mostrando el destino, como en Superstars).

### 8.2 Candidatas (15 marcadas + todas las azules)

Las 15 marcadas ★ de la tabla **más todas las casillas azules** (viajes más cortos). Las marcadas:

| Región | Candidatas |
|---|---|
| Caracas | `ccs_parquecentral`, `ccs_galipan` |
| Centro-Occidente | `coc_puertocolombia`, `coc_morrocoy` |
| Zulia | `zul_maracaibo` (tras el peaje), `zul_catatumbo` |
| Andes | `and_picoespejo` (teleférico o rodeo largo) |
| Llanos | `lla_achaguas` |
| Guayana | `gua_llovizna` |
| Canaima | `can_roraima` |
| Deltamacura | `del_isla` |
| Oriente | `moc_paria`, `moc_mochima` |
| Margarita | `mar_elagua` |
| Los Roques | `roq_cayoagua` |

### 8.3 Algoritmo de aparición (anti-runaway, explicable)

1. **Primeras estrellas** (ronda 1): la 1.ª al azar entre `ccs_galipan`, `coc_puertocolombia` y `moc_mochima` (a 8-15 pasos de la Salida); la 2.ª es la siguiente de esa lista circular. Con `cfg.estrellas===1` solo hay la 1.ª.
2. **Tras cada compra** se muda **solo la estrella comprada** (`estrellaMueve{i}`: `i` 0 = `nodo`, 1 = `b`). Se descartan
   - la región del comprador,
   - la candidata anterior y la posición de la otra estrella,
   - cualquier candidata a **menos de 4 pasos de cualquier jugador** (contando el costo en pasos de los transportes),
   - en **Exprés**, las regiones inactivas.
3. Entre las que quedan, **peso base 2** y:
   - **×4** si queda a **≤ 10 pasos del último** de la clasificación (remontada);
   - **×0,5** si solo se llega pagando (Margarita, Los Roques, `zul_maracaibo`, `zul_catatumbo`, `ccs_galipan`, `and_picoespejo`, `del_isla`), para no castigar a quien va sin monedas;
   - **×1/8** si queda a **más de 8 pasos del jugador más cercano** (la estrella se queda pegada a la acción);
   - **×0** si la distancia desde **el líder** es ≤ 10 pasos.
4. Si después de esto no queda ninguna, se ignora la regla del paso 3 (×0 por el líder) y se sortea entre todas las no descartadas.
5. **El Dato del Vecino** (sin comprador) muda la estrella **más cercana al líder**.
6. **Recta Final**: ya no hay un cambio de número; las 2 estrellas están activas desde el inicio.

### 8.4 Otras formas de conseguir o perder estrellas

| Vía | Costo | Límite |
|---|---|---|
| **Estrella premium de Salto Ángel** | 35 | 1 por jugador y partida |
| **Spa de Noronquí** (mueve la estrella, no la regala) | 20 | 1 por jugador y partida. No disponible en la Recta Final |
| **El Dato del Vecino** (objeto: muda la estrella más cercana al líder a otra candidata) | 12 | Sujeto al stock |
| **¡Qué Vaina!**: dar o intercambiar estrellas | — | Solo a partir del **turno 6** |
| **Duelo con Guante de Dominó** (apuesta 1 estrella) | Ver `06` | — |
| **Cartas del Delta** «Estrella prestada» y «La Isla Rica» | — | 1 de cada una en el mazo |
| **Don Corte** | **Nunca quita estrellas** en el modo Normal | Solo en Modo Caos, ver §12 |

---

## 9. Tiendas y objetos

### 9.1 Reglas generales

- Se pueden **llevar 3 objetos como máximo**. Si estás lleno, para comprar tienes que tirar uno.
- **Stock**: cada tienda tiene **2 unidades de cada objeto** que vende, compartidas entre todos los jugadores. Se **reponen cada 5 rondas**. Es la lección de Jamboree: limita el snowball y hace que las visitas a la tienda se disputen.
- Puedes comprar **varios objetos** en una misma visita (como en MP DS).
- Se compra **al pasar o al caer**.

### 9.2 Las 10 tiendas

| Tienda | Casilla | Personalidad | Vende | Precio |
|---|---|---|---|---|
| **Bodegón** | `ccs_altamira` | «Se aceptan dólares y cariño». Tiene planta | **Los 15 objetos** | **+20 %** (redondeo hacia arriba) |
| **Farmacia de guardia** | `coc_valencia` | Abierta 24 h… salvo en Apagón | Vela, Recibo de Luz, Arepa, Malta, Llave | Normal |
| **Bodega El Saladillo** | `zul_maracaibo` | «Aquí todo es más caro por el calor» | Malta, Guayoyo, Chancla, Nido de Zancudos, Planta | Normal |
| **Heladería de los Mil Sabores** | `and_merida` | Sabores absurdos («pabellón», «aguacate con cerveza») | Arepa, Malta, Guayoyo, Paracaídas + **Helado Misterioso** (3: objeto al azar) | Normal |
| **Bodega Llanera** | `lla_sanfernando` | «Fiado no, mijo» | Llave, Pasaje, Chancla, Dado a la Medida | Normal |
| **Mercado del Orinoco** | `gua_cbolivar` | Puestos y sombreros | Ticket de Avioneta, Planta, Tequeño, Dato del Vecino | Normal |
| **Bodega de la Frontera** | `can_santaelena` | «Aquí se cambia de todo» | Paracaídas, Ticket, Vela, Recibo | Normal |
| **Zona Libre** | `mar_porlamar` | «¡Todo en oferta!» | Los 15 objetos | **−30 %** (redondeo hacia arriba). **Stock 1** de cada uno |
| **Mercadito Paralelo** | `del_mercado` | Nadie sabe quién atiende | 3 objetos al azar | **Precio al azar de 1 a 30**. 1 de cada 4 es **«chimbo»**: no funciona al usarlo y se marca como «Chimbo» |
| **El Buhonero** (ambulante) | Se mueve (§6.4) | «¡Dos por uno, dos por uno!» | 2 objetos al azar | **−2** monedas |

> Nombres de marcas: se usan nombres **genéricos o paródicos** (no marcas registradas reales) para no imitar empresas existentes.

### 9.3 Los 15 objetos

| # | Objeto | Precio base | Categoría | Efecto exacto |
|---|---|---|---|---|
| 1 | **Malta con Leche Condensada** | 5 | Dado | Tiras **2 dados** de 1 a 10 y sumas. Con dobles: +10 monedas |
| 2 | **Guayoyo Triple** | 12 | Dado | Tiras **3 dados**. Con un trío: +30 (tres 7: +50) |
| 3 | **Arepa Reina Pepiada** | 4 | Dado o cura | +4 a tu tirada **y** quitas un estado negativo (páramo, mareo, oscuridad o «tirada 1-5») |
| 4 | **Dado a la Medida** | 12 | Dado | Eliges el número del 1 al 10 |
| 5 | **Pasaje de Por Puesto** | 8 | Movimiento | Antes de tirar, te teletransportas a **la Camionetica** o a cualquier casilla `transporte` **a pie del mapa continental** (no islas). Luego tiras normal |
| 6 | **Llave de la Finca** | 4 | Movimiento | Abre un portón (se consume) |
| 7 | **Paracaídas del Salto** | 8 | Movimiento | Usa una arista de salto o salta por encima de 1 casilla (se consume) |
| 8 | **Ticket de Avioneta** | 18 | Movimiento | Vuelo gratis desde cualquier casilla a cualquier aeropuerto (3 pasos) |
| 9 | **Vela** | 3 | Defensa | Anula efectos de oscuridad y Apagón **para ti** durante 1 turno. Ves el GPS del Delta. Rechazas el Peñero Fantasma |
| 10 | **Recibo de Luz Pagado** | 8 | Defensa | Bloquea **1** efecto de Don Corte, **1** robo (Tequeño o Zancudos) o **1** alcabala móvil. Se activa solo |
| 11 | **Planta Eléctrica** | 15 | Trampa o economía | Se coloca en tu casilla (§6.1). Hay 1 por jugador en el mapa, y si colocas otra se mueve |
| 12 | **Chancla de Mamá** | 10 | **Ataque** | Elige a un jugador a ≤ **10 pasos**: **retrocede 2** y suelta **5 monedas** que quedan en su casilla («monedas sueltas»: las recoge el primero que pase). Animación con `MAMA` lanzando la chancla (reusa CHANCLA) |
| 13 | **Nido de Zancudos** | 7 | **Trampa** | Lo pones hasta **3 casillas adelante o atrás** de ti. El primero que **pase o caiga** pierde 5 monedas, que van para ti. Eres inmune a tu propia trampa (lección de MP6). Máximo 2 nidos tuyos activos |
| 14 | **Tequeño Teledirigido** | 15 | **Ataque** | Le robas **1 objeto al azar** a cualquier jugador. Si no tiene objetos: 3 monedas |
| 15 | **El Dato del Vecino** | 12 | Estrella | Eliges: **(a)** la estrella más cercana al líder se muda a otra candidata (algoritmo §8.3), o **(b)** ves en secreto las 2 próximas candidatas más probables |

**Objetos especiales** (no se venden, solo salen de eventos): **Guante de Dominó** (duelo apostando 1 estrella; casillas de duelo y el Delta), **Brújula Chimba** (Delta: invierte la flecha del GPS), **Bono de la Abuela** (estrella a mitad de precio; Recta Final).

---

## 10. Ataques (resumen de toda la capa ofensiva)

| Ataque | Fuente | Alcance | Daño | Contraataque |
|---|---|---|---|---|
| Chancla de Mamá | Objeto | ≤ 10 pasos | Retrocede 2 y suelta 5 monedas | Recibo no lo bloquea (es mamá) |
| Nido de Zancudos | Objeto (trampa) | Se coloca a ±3 | −5 que van al dueño | Recibo, Paracaídas (saltarlo) |
| Tequeño Teledirigido | Objeto | Global | Roba 1 objeto | Recibo |
| Dirigir el rayo | `zul_catatumbo` | Global | −8 o tirada 1-5 | Recibo |
| ¡Cañonazo! | `mar_pampatar` | Margarita u Oriente | Retrocede 4 | Paracaídas no; es inevitable |
| **Colearse** | Regla de mapa | Al **pasar** por un jugador que está en una casilla **roja** | Le quitas **2** monedas («te coleaste») | Ninguno. Máximo 1 coleada por turno |
| Pozo y Planta | Propiedades | Quien caiga | −5 / −3 al dueño | Saltar con Paracaídas |
| Alcabalas móviles | Mapa | Rutas | −5 | Recibo |
| Duelo | Casillas `duelo` y el Guante | 1 rival elegido | Apuesta (ruleta 5/10/20 o estrella con Guante) | Ganar el duelo |
| Spa VIP y Dato del Vecino | Pago u objeto | Global | Mueven la estrella lejos del rival | — |

**Tope de daño**: ningún jugador puede perder más de **20 monedas por ataques** de otros jugadores en una misma ronda. El exceso no se cobra. Es la lección de MP8: un ataque no debe llevarte de primero a último en un turno.

---

## 11. Eventos que cambian de puesto, envían a la Salida o mueven a todos

### 11.1 ¡Qué Vaina! (Chance Time) · `coc_sanfelipe`, `gua_sanfelix`

Tres tambores: **quién da**, **qué** y **quién recibe**. Si sale el mismo jugador en los dos tambores de personas, se repite ese tambor.

| Resultado del tambor «qué» | Disponible |
|---|---|
| 5 monedas | Siempre |
| 10 monedas | Siempre |
| 20 monedas | Desde el turno 6 |
| **Intercambio de posiciones en el mapa** | Siempre |
| **Intercambio de todas las monedas** | Desde el turno 6 |
| **1 estrella** | Desde el turno 6 |

Presentación: un **telemaratón** con presentador gritón. El tambor se frena tocando la pantalla, pero el resultado está **predeterminado**, como en MP3: «el tocar es teatro».

### 11.2 Ahorita · `lla_guanare`, `can_kavac`

- Al caer recibes una **carta boca abajo** que se resuelve **«ahorita»**, es decir, al inicio de tu turno dentro de **1d4 turnos** (tú no sabes cuándo).
- Contenido: **50 %** «llegó la transferencia», +10 monedas. **25 %** objeto al azar. **25 %** «ahorita era nunca»: nada, y suma 1 a la estadística «Pelao».

### 11.3 Tabla de eventos de cambio de puesto

| Evento | Dónde | Efecto | Salvaguarda |
|---|---|---|---|
| **¡Qué Vaina! → intercambio de posiciones** | Casillas vaina | 2 jugadores intercambian casillas | — |
| **La Telenovela** | Carta del Delta y ruleta de Don Corte (Caos) | 2 jugadores al azar intercambian posiciones con diálogo melodramático: «¡Tú no eres mi hermano, eres mi primo segundo!» | Nunca dos veces seguidas los mismos dos |
| **Caño Espejo** | Carta del Delta | Intercambias posición con el jugador **más lejano** | — |
| **«Se te quedó la cédula»** (vuelta a la Salida) | Carta del Delta, ruleta de Don Corte | **Vuelves a la Plaza Bolívar** | **+5 de consuelo** («la Abuela te recibe con un cafecito»), nunca quita monedas. Máximo 1 vez por jugador cada 5 turnos |
| **«Saliste por Petare»** | `del_salida` (1/6) | Apareces en Caracas | — |
| **La Camionetica** | NPC | Te arrastra hacia adelante | Pagas 2 |
| **Comparsa de calipso** | `gua_elcallao` | Todos a ≤ 6 pasos avanzan 2 hacia ti | Solo hacia adelante en su ruta. Si «hacia ti» es hacia atrás, no se mueven |
| **¡Cañonazo!** | `mar_pampatar` | 1 jugador retrocede 4 | — |
| **Hora Pico** | `ccs_metro` | Te deja en una casilla al azar de Caracas | — |
| **Peñero Fantasma** | `del_penero` | Te lleva a una casilla `transporte` al azar | Vela |
| **Último Autobús** | Recta Final (§14) | El último lugar salta a 3 pasos de una estrella | 1 vez por partida |

---

## 12. El villano: 3 propuestas

### 12.1 RECOMENDADO: **Don Corte, el Señor Apagón**

- **Quién es**: una nube negra con cara de bombillo quemado, un cable de extensión por cola y un enchufe por nariz. Se ríe con chispazos: «¡Pa' que aprendan a ahorrar!». No representa a ninguna persona ni institución: es **la situación** hecha personaje.
- **Por qué**: reutiliza todo lo que ya existe (la etapa «¡SE FUE LA LUZ!», `oscuro()`, `vela`, `bombillo` y `juego-jefe-transformador`), y su mecánica (el Apagón) **ya es el estado global del mapa**. Villano y tablero cuentan la misma historia.

**Ruleta de la casilla `villano`** (6 casillas):

| Casilla de la ruleta | Efecto |
|---|---|
| **«Pague la planta»** (×2) | Pierdes **10 monedas** (o todas si tienes menos) |
| **«¡Se fue la luz!»** | Apagón global (§7.1) |
| **«Bombillo quemado»** | Pierdes 1 objeto al azar (si no tienes, −5) |
| **«Repartición a oscuras»** | **Desde el turno 6** y **1 vez por partida**: se juntan las monedas de todos y se reparten en partes iguales (el Bowser Revolution) |
| **«Don Corte tiene un buen día»** | +5 «pa' la vela» |

- **Red de seguridad**: con **0 monedas**, Don Corte te da **10** y no gira la ruleta (MP7).
- **Recibo de Luz Pagado** anula una casilla de la ruleta.
- **«La Hora de Don Corte»** (solo en La Gran Vuelta, cada 5 rondas, a lo Bowser Time de MP7): Don Corte **apaga la región donde está la estrella**. Los jugadores en esa región pierden la mitad de sus monedas (**tope 15**) y la estrella se muda. No se hace en la Recta Final.

### 12.2 Alternativa: **Don Inflación**

- Un **globo con sombrero de copa** que se infla cada vez que alguien cae en una casilla `villano`. Va del tamaño 1 al 5.
- **Efecto pasivo**: todos los precios de tiendas y transportes se multiplican por **1 + 0,1 × tamaño** (hasta +50 %).
- **Al llegar al tamaño 5: «¡LE QUITARON TRES CEROS!»**: todas las monedas se dividen entre 2 (redondeo hacia arriba), la estrella cuesta 15 durante 3 rondas y el globo vuelve al tamaño 1.
- **Pro**: sátira económica muy reconocible (como el runner «Venezuela The Game», donde el enemigo es la inflación). **Contra**: es más abstracto y no reutiliza arte. Se recomienda como **regla del Modo Caos**, no como villano principal.

### 12.3 Alternativa: **El Silbón** (leyenda llanera)

- Un espanto alto y flaco con sombrero, que se reconoce **por el silbido**. Regla de la leyenda: **«cuando lo oyes cerca, está lejos; cuando lo oyes lejos, está cerca»**.
- **Mecánica**: el HUD muestra un indicador de silbido **invertido** (volumen alto = lejos). Si al final de la ronda estás a ≤ 3 pasos de él, «te asustó»: pierdes 1 objeto y retrocedes 3.
- Casilla `villano`: invocas al Silbón junto a otro jugador.
- **Pro**: folclor puro y gran atmósfera nocturna. **Contra**: el tono de terror choca con el humor ligero, y es una leyenda con raíces de tragedia familiar. Se recomienda como **NPC local de los Llanos en el Apagón**, no como villano principal. **(Por verificar** con el usuario si el tono le parece bien.)

---

## 13. Deltamacura: reglas y mazo de cartas

### 13.1 Reglas de región

1. Cada casilla `delta` saca **1 Carta del Delta** al caer.
2. **Al pasar** por una casilla `delta`, tira 1d6: con **6** también sacas carta («el Delta te vio»).
3. El mazo tiene **28 cartas con pesos**. Las cartas usadas se descartan, y cuando el mazo se acaba se baraja otra vez.
4. **Nada del Delta quita estrellas** salvo una carta, la n.º 26, que solo **presta** la estrella.
5. Música: la salsa procedural de `campana.js` con el tono bajado y en reversa cada 8 compases (efecto «está raro esto»).

### 13.2 Mazo (28 cartas)

| # | Carta | Peso | Efecto |
|---|---|---|---|
| 1 | **«Recalculando…»** | 3 | Tu ficha se teletransporta a una casilla `del_*` al azar |
| 2 | **Hoy es Ayer** | 2 | Vuelves a la casilla donde empezaste tu turno **pasado** y recuperas las monedas que perdiste en el turno anterior (tope 10) |
| 3 | **Mañana es Hoy** | 2 | Tiras otra vez inmediatamente |
| 4 | **Caño Espejo** | 2 | Intercambias posición con el jugador más lejano |
| 5 | **El Peñero sin Motor** | 2 | Retrocedes 1d4 «porque la corriente» |
| 6 | **La Telenovela** | 2 | Dos jugadores al azar intercambian posiciones |
| 7 | **Moneda que Flota** | 3 | +1d10 monedas |
| 8 | **Moneda que se Hunde** | 2 | −1d6 monedas |
| 9 | **El Bachaco Mensajero** | 1 | Le pasas 1 objeto tuyo a otro jugador **y** él te pasa 1 suyo, ambos al azar |
| 10 | **Ruleta del Mercadito** | 2 | Cambias tus monedas por objetos: 5 monedas = 1 objeto al azar, hasta 3 |
| 11 | **Niebla Total** | 1 | Durante 1 ronda nadie ve el mapa (solo su radio de 2 casillas) |
| 12 | **«Se te quedó la cédula»** | 1 | Vuelves a la Salida (+5 de consuelo) |
| 13 | **Brújula Chimba** | 2 | Obtienes la Brújula Chimba (invierte el GPS a tu favor una vez) |
| 14 | **El Que No Existe** | 1 | Un jugador al azar queda **invisible** 1 ronda: los ataques no lo pueden elegir |
| 15 | **La Isla Rica** | 1 | La isla aparece ya. Si llegas a ella este turno: +15 |
| 16 | **Pescado Parlante** | 2 | Te cuenta un chisme: ves las 2 próximas candidatas a estrella |
| 17 | **«Aquí todo cuesta 1»** | 1 | Durante esta ronda todos los objetos del Mercadito cuestan 1 |
| 18 | **Apagón Delteño** | 1 | Apagón global inmediato |
| 19 | **Luz Delteña** | 1 | Se acaba el Apagón (si lo hay). Si no: +5 |
| 20 | **El Mapa al Revés** | 1 | Esta ronda, las flechas de **todos los cruces del mapa** se eligen al azar |
| 21 | **La Hamaca** | 2 | Pierdes tu próxima tirada, pero recibes +8 «por descansar» |
| 22 | **Guante de Dominó** | 1 | Obtienes el Guante (duelo apostando estrella) |
| 23 | **Reloj Derretido** | 1 | Se suma o se resta 1 turno a la partida (50/50; tope ±2 por partida; nunca en la Recta Final) |
| 24 | **La Vaca Perdida** | 1 | Te llevas el pote del banco más lleno del mapa |
| 25 | **La Garza Taxista** | 2 | Vuelas a cualquier casilla de Oriente o Guayana |
| 26 | **Estrella Prestada** | 1 | Si eres el **último** en estrellas: el líder te **presta** 1 estrella **hasta el final de tu próximo turno**. Si en ese turno compras otra estrella, la prestada **se queda contigo** |
| 27 | **El Delta te Aprecia** | 2 | Todos los jugadores que están en Deltamacura ganan +5 |
| 28 | **Salida Express** | 2 | Sales ya de Deltamacura a Maturín, Puerto Ordaz o Caracas (a tu elección) |

Suma de pesos = 45. La probabilidad de cada carta es su peso entre 45.

### 13.3 Minijuego largo exclusivo propuesto: **«Salir de Deltamacura»**

- Formato 4P cooperativo-competitivo, de 2-3 min, al estilo de los jefes de MP9.
- Un laberinto de caños que **se reordena cada 20 s**. Cada jugador busca la salida y recoge monedas. El primero en salir se lleva un bono, y si **nadie** sale, «el Delta se queda con todos» (−5 cada uno).
- Se puede montar sobre la estructura de fases de `juego-jefe-alcabala.js` (`FASES` con `cmd/hint/dur`).

---

## 14. La Recta Final (últimos 5 turnos) en el mapa

Presentado por **«Chamo FM 99.9»**, un locutor de radio que **predice al ganador y siempre se equivoca a propósito** (en MP1-3 la predicción era inofensiva).

**Cambios automáticos:**
- Las azules dan +8 y las rojas −6. Los bancos cobran 5 al pasar.
- **2 estrellas activas** (ya lo están desde el inicio).
- Las alcabalas móviles cobran 8. El Spa VIP se bloquea.
- Duelo automático si dos jugadores **caen en la misma casilla**.
- 3 casillas rojas al azar se vuelven `villano` («Don Corte hace horas extra»).

**La ruleta del último lugar** (gira el jugador en 4.º puesto; en un empate gira el que tenga menos monedas):

| Opción | Efecto |
|---|---|
| **«Último Autobús»** | El último salta a **3 pasos** antes de la estrella más cercana |
| **«Bono de la Abuela»** | El último recibe el objeto **Bono de la Abuela** (estrella a la mitad del precio) |
| **«Cola en todas partes»** | Todas las rojas pasan a **−9**, pero el último es inmune |
| **«Rumba en el Delta»** | Durante 2 rondas, salir de Deltamacura lleva a la región de una estrella |
| **«+20 por la vaca»** | El último recibe 20 monedas del pote de los bancos (si no alcanza, el banco «pone la diferencia») |

Variante **Pro**: en lugar de la ruleta, la mesa **vota** entre 3 opciones y el último tiene **2 votos** (la lección del Homestretch de Jamboree: comeback visible, no oculto).

---

## 15. Estadísticas del mapa para las estrellas bonus

Las categorías finales se definen en `04` (§5, «Estrellas del Cierre»). Estas son las **propias del mapa** que conviene registrar desde el turno 1. Todas tienen **un umbral mínimo** (con 0 nunca se gana estrella) y en un empate gana la estrella todo el que empate.

| Estrella bonus (propuesta) | Estadística | Cómo se cuenta | Mínimo |
|---|---|---|---|
| **Estrella Mochilera** | `regionesVisitadas` | Regiones distintas en las que **caíste** al menos una vez (Pico Espejo cuenta doble) | 4 |
| **Estrella Viajera** | `pasosEnTransporte` | Suma de los costos en pasos de los transportes usados | 6 |
| **Estrella del Peaje** | `monedasEnPeajes` | Monedas pagadas en peajes, alcabalas, teleféricos, ferris y vuelos | 10 |
| **Estrella Deltamacurera** | `cartasDelta` | Cartas del Delta robadas | 3 |
| **Estrella Pelao** | `casillasMalas` | Rojas, villano y alcabalas en las que caíste, más las cartas «ahorita era nunca» | 3 |
| **Estrella Petrolera** | `regaliasCobradas` | Monedas recibidas por pozos y plantas | 10 |
| **Estrella Chancletera** | `ataquesAcertados` | Ataques que llegaron a afectar a alguien (no cuenta si los bloqueó un Recibo) | 2 |
| **Estrella del Apagón** (oculta y graciosa) | `turnosEnApagon` | Turnos que empezaste a oscuras | 3 |

---

## 16. Cómo conecta el mapa con los minijuegos

- **Color para formar equipos** al final de la ronda de tablero, según la tabla de §3: `azul` = azul; `roja`, `villano` y `alcabala` = rojo; todo lo demás = **verde**, que se sortea a azul o rojo como en Super Mario Party. El reparto 4P / 1v3 / 2v2 decide la **ronda rápida de 5 microjuegos** (pagos en `06`).
- **Tema regional**: la ronda rápida puede sesgar el sorteo de microjuegos hacia la región donde están más jugadores. Sugerencias de pool, a confirmar **por el contenido real** de cada `juego-*.js` **(por verificar)**:
  - Caracas: `jefe-metro`, `tranca`, `trancalo`, `paga`, PARADA y BAJA/ENCALETA/AGÁRRATE.
  - Zulia (calor): `hielo`, `cava`, `nevera`.
  - Llanos: `baile`, `mango`, `zancudo`.
  - Guayana (Guri): `enchufa`, `switch`, `jefe-transformador`.
  - Oriente y Margarita: `tequenos`, `torta`.
  - Casa y Andes: `sopa`, `queso`, `hallaca`, `cucaracha`.
- **Minijuegos largos exclusivos** (uno por región «grande», 2-3 min, con fases):
  - **Zulia**: «¡Esquiva el Catatumbo!»
  - **Guayana**: «¡Reactiva Guri!» (cooperativo contra Don Corte; reutiliza el transformador)
  - **Deltamacura**: «Salir de Deltamacura»
  - **Caracas**: «Hora Pico» (empujar para llegar a la puerta del vagón; reutiliza el jefe metro)
  - **Llanos**: «Coleo de Campeonato»
  - **Andes**: «Bajada en Parapente»
- **Duelos con sabor**: dominó (fichas, memoria), contrapunteo de joropo (ritmo), bolas criollas (puntería) y tamunangue (secuencia).

---

## 17. Tono: qué sí y qué no

**Sí**: el humor de **situación** (la cola, el apagón, el calor, la langosta carísima, el GPS que recalcula), la comida como objeto, el cariño por los lugares, la jerga (chamo, pana, vaina, ladilla, colearse, ahorita, pelao), la mamá con la chancla y la Abuela vendiendo la estrella.

**No**:
- Política partidista ni nombres de políticos.
- Policía, militares o armas reales: la alcabala es de **conos**.
- Narcotráfico, violencia real ni «malandro» glorificado.
- Burla de regiones, acentos, pueblos indígenas o migrantes.
- Tragedias reales (por ejemplo, la tragedia de Vargas de 1999: **no** usar «lluvias de Vargas» como evento).
- Peleas de gallos.
- Fiestas religiosas como chiste: se pueden **ambientar** con respeto, nunca parodiar (la Chinita, la Divina Pastora, los Diablos de Yare).
- Marcas registradas reales.

Deltamacura es **un lugar inventado**: el chiste es que «no sale en el mapa», nunca la gente.

---

## 18. Datos por verificar

| Dato | Uso en el doc | Estado |
|---|---|---|
| Salto Ángel ~979 m, Kerepakupai Merú | Nombre y texto de casilla | Confirmado por la investigación (fuentes turísticas) |
| Mukumbarí llega a Pico Espejo, 4.765 m | Texto de selfie | Confirmado por la investigación |
| Pico El Águila, 4.118 m | Nombre de casilla | **(por verificar)** |
| Puente Rafael Urdaneta, ~8,7 km, 1962 | Peaje | Confirmado por la investigación |
| Relámpago del Catatumbo «casi todas las noches» | Casilla | Confirmado, aunque las cifras exactas varían según la fuente |
| Ferris desde Puerto La Cruz y Cumaná a Punta de Piedras | Rutas de ferry | **(por verificar)**: operadores y puertos actuales |
| Vuelos o avionetas Maiquetía ↔ Canaima y Ciudad Bolívar ↔ Canaima | Rutas aéreas | **(por verificar)** |
| Heladería de Mérida con récord de sabores | Tienda (nombre genérico, sin marca) | **(por verificar)** |
| Calabozo y las anguilas eléctricas (Humboldt, 1800) | Evento | **(por verificar)** |
| El Callao y su carnaval de calipso | Evento | **(por verificar)** |
| Carretera Barcelona → El Tigre | Arista | **(por verificar)**: se usa como ruta de juego |
| «Venoba» = Pokémon Venova (fangame venezolano) | Referencia de estilo | **(por verificar con el usuario)** |
| Nombres de los microjuegos existentes por región | §16 | **(por verificar)**: depende del contenido real de cada archivo |
| Todos los números de economía | Todo el doc | Propuestas: los valida `simular.js` (ver `06`) |

---

## 19. Grafo completo (JSON)

- `nodos[].t` es el tipo de casilla (§3). `star: true` marca las candidatas a estrella, `premium: true` el Salto Ángel y `tienda` el id de la tienda (§9.2).
- `ady` es la **lista de adyacencia dirigida**: las salidas permitidas desde cada casilla. Un cruce es cualquier nodo con más de 1 salida.
- `aristas_especiales` detalla las salidas que tienen `modo` distinto de `camino`, `costo` (monedas; `"1+"` es el peaje escalante) o `req` (objeto u condición requerida: `llave`, `paracaidas`, `isla_visible`).
- Validado con un script: 114 nodos y 148 aristas. Todos los nodos son alcanzables desde `ccs_start` y todos pueden volver a `ccs_start`.

```json
{
 "meta": {"version": "0.1-borrador", "lienzo": [1000, 1000], "ejes": "x oeste->este, y norte->sur; coordenadas de diseno, no cartograficas", "salida": "ccs_start", "grafo": "dirigido: 'ady' son las salidas permitidas; las aristas con costo/req son opcionales"},
 "regiones": [
  {"id": "ccs", "nombre": "Caracas (hub)", "color": "#E8B400", "centro": [515, 190]},
  {"id": "coc", "nombre": "Centro-Occidente", "color": "#7FB800", "centro": [350, 200]},
  {"id": "zul", "nombre": "Zulia y Lago de Maracaibo", "color": "#00A6A6", "centro": [150, 250]},
  {"id": "and", "nombre": "Los Andes", "color": "#6C8EBF", "centro": [200, 380]},
  {"id": "lla", "nombre": "Llanos y Apure", "color": "#C9A227", "centro": [360, 420]},
  {"id": "gua", "nombre": "Guayana", "color": "#B5651D", "centro": [720, 420]},
  {"id": "can", "nombre": "Canaima y Gran Sabana", "color": "#2E8B57", "centro": [840, 640]},
  {"id": "del", "nombre": "Deltamacura", "color": "#8A4FFF", "centro": [905, 310]},
  {"id": "moc", "nombre": "Oriente y Mochima", "color": "#FF7F50", "centro": [770, 215]},
  {"id": "mar", "nombre": "Margarita", "color": "#FF4F81", "centro": [780, 105]},
  {"id": "roq", "nombre": "Los Roques", "color": "#00BFFF", "centro": [590, 62]}
 ],
 "nodos": [
  {"id": "ccs_start", "n": "Plaza Bolívar (SALIDA)", "r": "ccs", "t": "salida", "x": 520, "y": 200},
  {"id": "ccs_sabana", "n": "Bulevar de Sabana Grande", "r": "ccs", "t": "banco", "x": 500, "y": 215},
  {"id": "ccs_parquecentral", "n": "Torres de Parque Central", "r": "ccs", "t": "azul", "x": 485, "y": 205, "star": true},
  {"id": "ccs_metro", "n": "Metro de Caracas", "r": "ccs", "t": "transporte", "x": 470, "y": 215},
  {"id": "ccs_arana", "n": "Distribuidor La Araña", "r": "ccs", "t": "roja", "x": 450, "y": 205},
  {"id": "ccs_guaira", "n": "La Guaira", "r": "ccs", "t": "azul", "x": 480, "y": 150},
  {"id": "ccs_maiquetia", "n": "Aeropuerto de Maiquetía", "r": "ccs", "t": "transporte", "x": 465, "y": 130},
  {"id": "ccs_petare", "n": "Redoma de Petare", "r": "ccs", "t": "roja", "x": 585, "y": 215},
  {"id": "ccs_chacao", "n": "Chacao", "r": "ccs", "t": "azul", "x": 565, "y": 212},
  {"id": "ccs_altamira", "n": "Plaza Altamira", "r": "ccs", "t": "azul", "x": 555, "y": 198, "tienda": "bodegon"},
  {"id": "ccs_avila", "n": "Teleférico Warairarepano", "r": "ccs", "t": "transporte", "x": 545, "y": 182},
  {"id": "ccs_galipan", "n": "Galipán (fresas con crema)", "r": "ccs", "t": "evento", "x": 530, "y": 155, "star": true},
  {"id": "coc_tejerias", "n": "Las Tejerías (la cola de la ARC)", "r": "coc", "t": "roja", "x": 420, "y": 215},
  {"id": "coc_maracay", "n": "Maracay, Ciudad Jardín", "r": "coc", "t": "azul", "x": 400, "y": 228},
  {"id": "coc_choroni", "n": "Curvas del Pittier", "r": "coc", "t": "evento", "x": 395, "y": 170},
  {"id": "coc_puertocolombia", "n": "Puerto Colombia (Choroní)", "r": "coc", "t": "azul", "x": 385, "y": 145, "star": true},
  {"id": "coc_valencia", "n": "Valencia", "r": "coc", "t": "azul", "x": 365, "y": 240, "tienda": "farmacia"},
  {"id": "coc_puertocabello", "n": "Puerto Cabello", "r": "coc", "t": "azul", "x": 355, "y": 195},
  {"id": "coc_morrocoy", "n": "Cayo Sombrero (Morrocoy)", "r": "coc", "t": "especial", "x": 325, "y": 165, "star": true},
  {"id": "coc_coro", "n": "Médanos de Coro", "r": "coc", "t": "especial", "x": 265, "y": 125},
  {"id": "coc_sanfelipe", "n": "San Felipe", "r": "coc", "t": "vaina", "x": 335, "y": 255},
  {"id": "coc_barquisimeto", "n": "Barquisimeto, Capital Musical", "r": "coc", "t": "duelo", "x": 300, "y": 265},
  {"id": "zul_dabajuro", "n": "Carretera de Dabajuro", "r": "zul", "t": "roja", "x": 215, "y": 148},
  {"id": "zul_altagracia", "n": "Los Puertos de Altagracia", "r": "zul", "t": "azul", "x": 165, "y": 170},
  {"id": "zul_puente", "n": "Puente sobre el Lago", "r": "zul", "t": "alcabala", "x": 140, "y": 190},
  {"id": "zul_maracaibo", "n": "Maracaibo", "r": "zul", "t": "azul", "x": 115, "y": 195, "star": true, "tienda": "bodega_lago"},
  {"id": "zul_gaita", "n": "Feria de la Gaita", "r": "zul", "t": "evento", "x": 100, "y": 220},
  {"id": "zul_sanfrancisco", "n": "San Francisco (40 °C a la sombra)", "r": "zul", "t": "roja", "x": 110, "y": 245},
  {"id": "zul_machiques", "n": "Machiques (queso y ganado)", "r": "zul", "t": "azul", "x": 80, "y": 285},
  {"id": "zul_catatumbo", "n": "Relámpago del Catatumbo", "r": "zul", "t": "especial", "x": 95, "y": 325, "star": true},
  {"id": "zul_encontrados", "n": "Encontrados", "r": "zul", "t": "azul", "x": 135, "y": 345},
  {"id": "zul_cabimas", "n": "Cabimas (los balancines)", "r": "zul", "t": "azul", "x": 185, "y": 215},
  {"id": "zul_ojeda", "n": "Ciudad Ojeda: Pozo en el Lago", "r": "zul", "t": "especial", "x": 195, "y": 248},
  {"id": "zul_lagunillas", "n": "Lagunillas", "r": "zul", "t": "villano", "x": 200, "y": 282},
  {"id": "and_carora", "n": "Carora (cocuy y uvas)", "r": "and", "t": "azul", "x": 285, "y": 268},
  {"id": "and_valera", "n": "Valera", "r": "and", "t": "azul", "x": 245, "y": 300},
  {"id": "and_timotes", "n": "Timotes", "r": "and", "t": "roja", "x": 232, "y": 325},
  {"id": "and_aguila", "n": "Pico El Águila", "r": "and", "t": "especial", "x": 220, "y": 345},
  {"id": "and_mucuchies", "n": "Mucuchíes", "r": "and", "t": "azul", "x": 207, "y": 362},
  {"id": "and_merida", "n": "Mérida", "r": "and", "t": "azul", "x": 185, "y": 380, "tienda": "heladeria"},
  {"id": "and_picoespejo", "n": "Pico Espejo (Mukumbarí)", "r": "and", "t": "especial", "x": 205, "y": 410, "star": true},
  {"id": "and_losnevados", "n": "Los Nevados", "r": "and", "t": "azul", "x": 230, "y": 430},
  {"id": "and_ejido", "n": "Ejido", "r": "and", "t": "duelo", "x": 165, "y": 405},
  {"id": "and_sancristobal", "n": "San Cristóbal (Feria de San Sebastián)", "r": "and", "t": "evento", "x": 120, "y": 440},
  {"id": "and_sanantonio", "n": "San Antonio (Casa de Cambio)", "r": "and", "t": "alcabala", "x": 95, "y": 468},
  {"id": "and_elvigia", "n": "El Vigía", "r": "and", "t": "azul", "x": 150, "y": 360},
  {"id": "lla_acarigua", "n": "Acarigua (el granero)", "r": "lla", "t": "azul", "x": 330, "y": 320},
  {"id": "lla_guanare", "n": "Guanare", "r": "lla", "t": "ahorita", "x": 300, "y": 355},
  {"id": "lla_barinas", "n": "Barinas", "r": "lla", "t": "villano", "x": 265, "y": 400},
  {"id": "lla_hato", "n": "Hato El Cariño (coleo)", "r": "lla", "t": "especial", "x": 300, "y": 445},
  {"id": "lla_guasdualito", "n": "Guasdualito", "r": "lla", "t": "azul", "x": 190, "y": 505},
  {"id": "lla_mantecal", "n": "Mantecal (la crecida)", "r": "lla", "t": "especial", "x": 320, "y": 490},
  {"id": "lla_achaguas", "n": "Achaguas (chigüires)", "r": "lla", "t": "azul", "x": 380, "y": 490, "star": true},
  {"id": "lla_sanfernando", "n": "San Fernando de Apure", "r": "lla", "t": "azul", "x": 430, "y": 470, "tienda": "bodega_llanera"},
  {"id": "lla_sanjuan", "n": "San Juan de los Morros", "r": "lla", "t": "azul", "x": 445, "y": 300},
  {"id": "lla_calabozo", "n": "Calabozo (las anguilas)", "r": "lla", "t": "evento", "x": 455, "y": 370},
  {"id": "lla_pascua", "n": "Valle de la Pascua", "r": "lla", "t": "duelo", "x": 525, "y": 370},
  {"id": "gua_eltigre", "n": "El Tigre: Pozo de la Faja", "r": "gua", "t": "especial", "x": 610, "y": 335},
  {"id": "gua_angostura", "n": "Puente Angostura", "r": "gua", "t": "azul", "x": 670, "y": 385},
  {"id": "gua_caicara", "n": "Caicara del Orinoco", "r": "gua", "t": "azul", "x": 565, "y": 430},
  {"id": "gua_cbolivar", "n": "Ciudad Bolívar", "r": "gua", "t": "azul", "x": 690, "y": 410, "tienda": "mercado_orinoco"},
  {"id": "gua_autopista", "n": "Autopista Cdad. Bolívar–Pto. Ordaz", "r": "gua", "t": "roja", "x": 740, "y": 400},
  {"id": "gua_guri", "n": "Represa de Guri", "r": "gua", "t": "especial", "x": 720, "y": 470},
  {"id": "gua_llovizna", "n": "Parque La Llovizna", "r": "gua", "t": "azul", "x": 770, "y": 435, "star": true},
  {"id": "gua_pordaz", "n": "Puerto Ordaz (Caroní + Orinoco)", "r": "gua", "t": "banco", "x": 790, "y": 395},
  {"id": "gua_sanfelix", "n": "San Félix", "r": "gua", "t": "vaina", "x": 820, "y": 380},
  {"id": "gua_upata", "n": "Upata", "r": "gua", "t": "villano", "x": 805, "y": 460},
  {"id": "gua_elcallao", "n": "El Callao (calipso)", "r": "gua", "t": "evento", "x": 840, "y": 510},
  {"id": "can_km88", "n": "Km 88 (La Escalera)", "r": "can", "t": "roja", "x": 860, "y": 560},
  {"id": "can_jaspe", "n": "Quebrada de Jaspe", "r": "can", "t": "azul", "x": 880, "y": 610},
  {"id": "can_kama", "n": "Salto Kamá", "r": "can", "t": "azul", "x": 890, "y": 655},
  {"id": "can_santaelena", "n": "Santa Elena de Uairén", "r": "can", "t": "azul", "x": 905, "y": 720, "tienda": "bodega_frontera"},
  {"id": "can_roraima", "n": "Roraima: El Mundo Perdido", "r": "can", "t": "especial", "x": 950, "y": 700, "star": true},
  {"id": "can_sabana", "n": "Sabana de los Tepuyes", "r": "can", "t": "evento", "x": 850, "y": 700},
  {"id": "can_kavac", "n": "Cueva de Kavac", "r": "can", "t": "ahorita", "x": 790, "y": 665},
  {"id": "can_saltoangel", "n": "Salto Ángel (Kerepakupai Merú)", "r": "can", "t": "especial", "x": 735, "y": 630, "premium": true},
  {"id": "can_laguna", "n": "Laguna de Canaima", "r": "can", "t": "transporte", "x": 730, "y": 580},
  {"id": "can_carrao", "n": "Curiara por el Carrao", "r": "can", "t": "evento", "x": 700, "y": 540},
  {"id": "del_entrada", "n": "El Puente que Ayer No Estaba", "r": "del", "t": "delta", "x": 850, "y": 345},
  {"id": "del_gps", "n": "«Recalculando…»", "r": "del", "t": "delta", "x": 880, "y": 325},
  {"id": "del_niebla", "n": "Neblina de los Caños", "r": "del", "t": "delta", "x": 910, "y": 350},
  {"id": "del_reloj", "n": "Caño Donde Es Ayer", "r": "del", "t": "delta", "x": 875, "y": 295},
  {"id": "del_espejo", "n": "Caño Espejo", "r": "del", "t": "delta", "x": 935, "y": 325},
  {"id": "del_isla", "n": "La Isla que Aparece", "r": "del", "t": "especial", "x": 960, "y": 295, "star": true},
  {"id": "del_mercado", "n": "Mercadito Paralelo", "r": "del", "t": "delta", "x": 925, "y": 280, "tienda": "mercadito"},
  {"id": "del_penero", "n": "Peñero Fantasma", "r": "del", "t": "transporte", "x": 895, "y": 265},
  {"id": "del_salida", "n": "¿Salida?", "r": "del", "t": "delta", "x": 860, "y": 270},
  {"id": "moc_maturin", "n": "Maturín", "r": "moc", "t": "azul", "x": 820, "y": 300},
  {"id": "moc_caripe", "n": "Cueva del Guácharo", "r": "moc", "t": "evento", "x": 835, "y": 250},
  {"id": "moc_carupano", "n": "Carúpano (Carnaval)", "r": "moc", "t": "azul", "x": 865, "y": 205},
  {"id": "moc_paria", "n": "Península de Paria (cacao)", "r": "moc", "t": "azul", "x": 920, "y": 190, "star": true},
  {"id": "moc_cumana", "n": "Cumaná, la Primogénita", "r": "moc", "t": "azul", "x": 780, "y": 195},
  {"id": "moc_mochima", "n": "Mochima: Playa Blanca", "r": "moc", "t": "especial", "x": 745, "y": 180, "star": true},
  {"id": "moc_plc", "n": "Puerto La Cruz (Paseo Colón)", "r": "moc", "t": "banco", "x": 710, "y": 195},
  {"id": "moc_barcelona", "n": "Barcelona", "r": "moc", "t": "roja", "x": 690, "y": 215},
  {"id": "moc_uchire", "n": "Boca de Uchire", "r": "moc", "t": "villano", "x": 655, "y": 210},
  {"id": "moc_higuerote", "n": "Higuerote (Barlovento)", "r": "moc", "t": "evento", "x": 628, "y": 218},
  {"id": "moc_guarenas", "n": "Cola Guarenas–Guatire", "r": "moc", "t": "roja", "x": 605, "y": 222},
  {"id": "mar_puntapiedras", "n": "Punta de Piedras (ferry)", "r": "mar", "t": "transporte", "x": 765, "y": 120},
  {"id": "mar_restinga", "n": "Laguna de La Restinga", "r": "mar", "t": "evento", "x": 745, "y": 100},
  {"id": "mar_macanao", "n": "Península de Macanao", "r": "mar", "t": "azul", "x": 715, "y": 95},
  {"id": "mar_juangriego", "n": "Juan Griego (el atardecer)", "r": "mar", "t": "azul", "x": 778, "y": 78},
  {"id": "mar_elagua", "n": "Playa El Agua", "r": "mar", "t": "azul", "x": 818, "y": 75, "star": true},
  {"id": "mar_asuncion", "n": "La Asunción", "r": "mar", "t": "duelo", "x": 808, "y": 100},
  {"id": "mar_pampatar", "n": "Castillo de Pampatar", "r": "mar", "t": "evento", "x": 828, "y": 122},
  {"id": "mar_porlamar", "n": "Porlamar (Zona Libre)", "r": "mar", "t": "azul", "x": 805, "y": 132, "tienda": "zona_libre"},
  {"id": "mar_coche", "n": "Isla de Coche", "r": "mar", "t": "azul", "x": 790, "y": 155},
  {"id": "roq_pista", "n": "Gran Roque (la pista)", "r": "roq", "t": "transporte", "x": 560, "y": 62},
  {"id": "roq_faro", "n": "Faro Holandés", "r": "roq", "t": "azul", "x": 575, "y": 48},
  {"id": "roq_francisqui", "n": "Cayo Francisquí", "r": "roq", "t": "azul", "x": 600, "y": 52},
  {"id": "roq_cayoagua", "n": "Cayo de Agua", "r": "roq", "t": "azul", "x": 625, "y": 40, "star": true},
  {"id": "roq_crasqui", "n": "Crasquí (langosta carísima)", "r": "roq", "t": "roja", "x": 612, "y": 75},
  {"id": "roq_madrisqui", "n": "Madrisquí", "r": "roq", "t": "evento", "x": 585, "y": 82},
  {"id": "roq_noronqui", "n": "Noronquí: Spa del Caribe", "r": "roq", "t": "especial", "x": 555, "y": 85}
 ],
 "ady": {
  "ccs_start": ["ccs_sabana"],
  "ccs_sabana": ["ccs_parquecentral"],
  "ccs_parquecentral": ["ccs_metro"],
  "ccs_metro": ["ccs_arana"],
  "ccs_arana": ["coc_tejerias", "ccs_guaira"],
  "ccs_guaira": ["ccs_maiquetia"],
  "ccs_maiquetia": ["ccs_arana", "roq_pista", "mar_porlamar", "can_laguna", "zul_maracaibo"],
  "ccs_petare": ["ccs_chacao"],
  "ccs_chacao": ["ccs_altamira"],
  "ccs_altamira": ["ccs_avila"],
  "ccs_avila": ["ccs_start", "ccs_galipan"],
  "ccs_galipan": ["ccs_guaira"],
  "coc_tejerias": ["coc_maracay"],
  "coc_maracay": ["coc_valencia", "coc_choroni", "lla_sanjuan"],
  "coc_choroni": ["coc_puertocolombia"],
  "coc_puertocolombia": ["coc_maracay", "coc_morrocoy"],
  "coc_valencia": ["coc_puertocabello", "coc_barquisimeto", "coc_sanfelipe"],
  "coc_puertocabello": ["coc_morrocoy"],
  "coc_morrocoy": ["coc_coro"],
  "coc_coro": ["zul_dabajuro"],
  "coc_sanfelipe": ["coc_barquisimeto"],
  "coc_barquisimeto": ["and_carora", "lla_acarigua"],
  "zul_dabajuro": ["zul_altagracia"],
  "zul_altagracia": ["zul_puente", "zul_cabimas"],
  "zul_puente": ["zul_maracaibo"],
  "zul_maracaibo": ["zul_gaita", "ccs_maiquetia"],
  "zul_gaita": ["zul_sanfrancisco"],
  "zul_sanfrancisco": ["zul_machiques"],
  "zul_machiques": ["zul_catatumbo"],
  "zul_catatumbo": ["zul_encontrados"],
  "zul_encontrados": ["and_elvigia"],
  "zul_cabimas": ["zul_ojeda"],
  "zul_ojeda": ["zul_lagunillas"],
  "zul_lagunillas": ["and_valera"],
  "and_carora": ["and_valera"],
  "and_valera": ["and_timotes"],
  "and_timotes": ["and_aguila"],
  "and_aguila": ["and_mucuchies", "lla_barinas"],
  "and_mucuchies": ["and_merida"],
  "and_merida": ["and_ejido", "and_picoespejo"],
  "and_picoespejo": ["and_losnevados"],
  "and_losnevados": ["lla_barinas"],
  "and_ejido": ["and_sancristobal"],
  "and_sancristobal": ["and_sanantonio"],
  "and_sanantonio": ["lla_guasdualito"],
  "and_elvigia": ["and_merida"],
  "lla_acarigua": ["lla_guanare"],
  "lla_guanare": ["lla_barinas"],
  "lla_barinas": ["lla_hato"],
  "lla_hato": ["lla_mantecal", "lla_sanfernando"],
  "lla_guasdualito": ["lla_mantecal"],
  "lla_mantecal": ["lla_achaguas"],
  "lla_achaguas": ["lla_sanfernando"],
  "lla_sanfernando": ["lla_calabozo", "gua_caicara"],
  "lla_sanjuan": ["lla_calabozo"],
  "lla_calabozo": ["lla_pascua"],
  "lla_pascua": ["gua_eltigre"],
  "gua_eltigre": ["gua_angostura"],
  "gua_angostura": ["gua_cbolivar"],
  "gua_caicara": ["gua_cbolivar"],
  "gua_cbolivar": ["gua_autopista", "gua_guri", "can_laguna"],
  "gua_autopista": ["gua_pordaz"],
  "gua_guri": ["gua_llovizna"],
  "gua_llovizna": ["gua_pordaz"],
  "gua_pordaz": ["gua_sanfelix", "gua_upata"],
  "gua_sanfelix": ["del_entrada"],
  "gua_upata": ["gua_elcallao"],
  "gua_elcallao": ["can_km88"],
  "can_km88": ["can_jaspe"],
  "can_jaspe": ["can_kama"],
  "can_kama": ["can_santaelena"],
  "can_santaelena": ["can_roraima"],
  "can_roraima": ["can_sabana"],
  "can_sabana": ["can_kavac"],
  "can_kavac": ["can_saltoangel"],
  "can_saltoangel": ["can_laguna", "gua_guri"],
  "can_laguna": ["can_carrao", "ccs_maiquetia"],
  "can_carrao": ["gua_guri"],
  "del_entrada": ["del_gps"],
  "del_gps": ["del_niebla", "del_reloj"],
  "del_niebla": ["del_espejo"],
  "del_reloj": ["del_mercado"],
  "del_espejo": ["del_isla", "del_mercado"],
  "del_isla": ["del_mercado"],
  "del_mercado": ["del_penero"],
  "del_penero": ["del_salida"],
  "del_salida": ["moc_maturin"],
  "moc_maturin": ["moc_caripe"],
  "moc_caripe": ["moc_carupano"],
  "moc_carupano": ["moc_paria", "moc_cumana"],
  "moc_paria": ["moc_cumana"],
  "moc_cumana": ["moc_mochima", "mar_puntapiedras"],
  "moc_mochima": ["moc_plc"],
  "moc_plc": ["moc_barcelona", "mar_puntapiedras"],
  "moc_barcelona": ["moc_uchire", "gua_eltigre"],
  "moc_uchire": ["moc_higuerote"],
  "moc_higuerote": ["moc_guarenas"],
  "moc_guarenas": ["ccs_petare"],
  "mar_puntapiedras": ["mar_restinga", "moc_plc", "moc_cumana"],
  "mar_restinga": ["mar_macanao"],
  "mar_macanao": ["mar_juangriego"],
  "mar_juangriego": ["mar_elagua"],
  "mar_elagua": ["mar_asuncion"],
  "mar_asuncion": ["mar_pampatar"],
  "mar_pampatar": ["mar_porlamar"],
  "mar_porlamar": ["mar_coche", "mar_puntapiedras", "ccs_maiquetia"],
  "mar_coche": ["mar_puntapiedras"],
  "roq_pista": ["roq_faro", "ccs_maiquetia"],
  "roq_faro": ["roq_francisqui"],
  "roq_francisqui": ["roq_cayoagua"],
  "roq_cayoagua": ["roq_crasqui"],
  "roq_crasqui": ["roq_madrisqui"],
  "roq_madrisqui": ["roq_noronqui"],
  "roq_noronqui": ["roq_pista"]
 },
 "aristas_especiales": [
  {"de": "ccs_avila", "a": "ccs_galipan", "modo": "teleferico", "costo": 5},
  {"de": "ccs_maiquetia", "a": "roq_pista", "modo": "avioneta", "costo": 10},
  {"de": "ccs_maiquetia", "a": "mar_porlamar", "modo": "avion", "costo": 8},
  {"de": "ccs_maiquetia", "a": "can_laguna", "modo": "avioneta", "costo": 15},
  {"de": "ccs_maiquetia", "a": "zul_maracaibo", "modo": "avion", "costo": 10},
  {"de": "coc_maracay", "a": "lla_sanjuan", "modo": "camionetica", "costo": 3},
  {"de": "coc_puertocolombia", "a": "coc_morrocoy", "modo": "lancha", "costo": 3},
  {"de": "coc_valencia", "a": "coc_barquisimeto", "modo": "porton", "req": "llave"},
  {"de": "zul_puente", "a": "zul_maracaibo", "modo": "peaje", "costo": "1+"},
  {"de": "zul_maracaibo", "a": "ccs_maiquetia", "modo": "avion", "costo": 10},
  {"de": "and_aguila", "a": "lla_barinas", "modo": "salto", "req": "paracaidas"},
  {"de": "and_merida", "a": "and_picoespejo", "modo": "teleferico", "costo": 8},
  {"de": "lla_hato", "a": "lla_sanfernando", "modo": "porton", "req": "llave"},
  {"de": "lla_sanfernando", "a": "gua_caicara", "modo": "chalana", "costo": 4},
  {"de": "gua_cbolivar", "a": "can_laguna", "modo": "avioneta", "costo": 8},
  {"de": "can_saltoangel", "a": "gua_guri", "modo": "salto", "req": "paracaidas"},
  {"de": "can_laguna", "a": "ccs_maiquetia", "modo": "avioneta", "costo": 10},
  {"de": "can_carrao", "a": "gua_guri", "modo": "curiara"},
  {"de": "del_espejo", "a": "del_isla", "modo": "camino", "req": "isla_visible"},
  {"de": "moc_cumana", "a": "mar_puntapiedras", "modo": "ferry", "costo": 4},
  {"de": "moc_plc", "a": "mar_puntapiedras", "modo": "ferry", "costo": 5},
  {"de": "mar_puntapiedras", "a": "moc_plc", "modo": "ferry", "costo": 5},
  {"de": "mar_puntapiedras", "a": "moc_cumana", "modo": "ferry", "costo": 4},
  {"de": "mar_porlamar", "a": "ccs_maiquetia", "modo": "avion", "costo": 8},
  {"de": "mar_coche", "a": "mar_puntapiedras", "modo": "penero"},
  {"de": "roq_pista", "a": "ccs_maiquetia", "modo": "avioneta", "costo": 10}
 ]
}
```

---

## 20. Guía para generar el SVG (borrador)

Se recomienda `viewBox="0 0 1000 1000"`. La silueta es **estilizada**, no cartográfica. Amazonas (abajo) aparece como **zona sin casillas**, rotulada «Amazonas: próximamente».

```json
{
 "silueta_continental": [[60,110],[95,75],[120,120],[135,170],[175,160],[215,130],[240,95],[255,60],[285,80],[270,115],[300,140],[350,170],[400,140],[450,140],[520,145],[600,165],[660,170],[720,160],[780,170],[860,165],[960,175],[930,215],[985,260],[975,330],[930,390],[960,430],[920,470],[960,520],[990,600],[980,700],[930,760],[860,760],[800,730],[760,780],[700,800],[650,880],[600,960],[540,940],[520,860],[560,780],[500,700],[470,620],[420,580],[330,560],[230,540],[150,520],[100,490],[70,450],[90,400],[60,340],[40,280],[55,220],[45,160]],
 "lago_maracaibo": [[125,205],[160,200],[178,230],[183,280],[165,325],[125,335],[105,300],[118,250]],
 "islas": {
  "margarita": {"tipo":"elipse","cx":775,"cy":105,"rx":70,"ry":30},
  "coche": {"tipo":"elipse","cx":790,"cy":155,"rx":14,"ry":8},
  "los_roques": {"tipo":"elipse","cx":592,"cy":62,"rx":50,"ry":30}
 },
 "rios": {
  "orinoco": [[560,960],[520,800],[470,620],[480,520],[560,440],[640,420],[700,405],[790,390],[860,360],[920,330],[970,300]],
  "apure": [[190,505],[320,490],[430,470],[520,455]],
  "caroni": [[735,630],[720,560],[720,470],[790,395]]
 },
 "estilo_aristas": {
  "camino": {"trazo":"#5b4636","ancho":6,"guiones":null},
  "teleferico": {"trazo":"#333","ancho":2,"guiones":"2 6","icono":"cabina"},
  "camionetica": {"trazo":"#E8B400","ancho":5,"guiones":"10 4","icono":"bus"},
  "lancha": {"trazo":"#0077be","ancho":3,"guiones":"6 6","icono":"lancha"},
  "ferry": {"trazo":"#0077be","ancho":4,"guiones":"12 6","icono":"ferry"},
  "avion": {"trazo":"#888","ancho":2,"guiones":"4 8","curva":true,"icono":"avion"},
  "avioneta": {"trazo":"#888","ancho":2,"guiones":"2 6","curva":true,"icono":"avioneta"},
  "chalana": {"trazo":"#0077be","ancho":4,"guiones":"8 4","icono":"chalana"},
  "curiara": {"trazo":"#0077be","ancho":3,"guiones":"4 4","icono":"curiara"},
  "penero": {"trazo":"#0077be","ancho":3,"guiones":"4 4","icono":"penero"},
  "peaje": {"trazo":"#5b4636","ancho":6,"icono":"cono"},
  "porton": {"trazo":"#5b4636","ancho":6,"guiones":"1 5","icono":"candado"},
  "salto": {"trazo":"#8A4FFF","ancho":3,"guiones":"1 6","curva":true,"icono":"paracaidas"}
 },
 "radio_casilla": 9,
 "rotulos_region": "usar regiones[].centro y regiones[].color; texto en mayúsculas con contorno blanco"
}
```

**Notas para el dibujo:**
- Las casillas `transporte` y `especial` van un 30 % más grandes y con ícono.
- Las candidatas a estrella llevan un halo dorado tenue.
- Deltamacura lleva una textura de remolinos y su contorno **tiembla** (animación CSS de ±2 px).
- En el juego, el mapa necesita **cámara con paneo y zoom** (no existe en el motor, ver `06`). Hay que dibujarlo con `ctx.translate/scale` alrededor de las primitivas para heredar los 6 estilos.

---

## 21. Preguntas abiertas para el usuario

1. ¿Villano principal **Don Corte** (recomendado) o prefieres a **Don Inflación** o a **El Silbón**?
2. ¿La moneda se llama «monedas», «lochas» o «bolos»?
3. ¿Te parece bien que la estrella la venda **la Abuela** del reparto existente?
4. ¿«Venoba» es **Pokémon Venova**? Si no lo es, ¿cuál es?
5. ¿Hacemos el **Exprés de 10 turnos** con regiones «en obras» para la primera versión jugable (MVP con 6 regiones), y el mapa completo después?
6. ¿Agregamos Amazonas (Autana, Puerto Ayacucho, Tobogán de la Selva) como 12.ª región en una expansión?

---

## Apéndice A · Balance de la economía (Área 6, medido 2026-10-17)

> **Estado (fase 2 hecha):** la propuesta v1 pasó a **v2 implementada en el reductor** (`fiesta-reglas.js`). Se **conserva el bonus final de 3 categorías** por decisión del dueño, para más drama (se acepta que el bonus cambie al ganador en ~41 % de las partidas, fuera de la meta 15-30 %). Por eso v2 **no** incluye el parche `bonus-1`.

Reproducir: `node docs/style-lab/pruebas/sim-balance.js` (reductor actual) y `… --preset=v1` (propuesta). Mide partidas completas con el reductor real; los minijuegos se sustituyen por `score = N(habilidad, 1)` (habilidad: azar 0, chamo 0,25, pana 0,5, arrecho 0,9; **supuesto del modelo, no medido en humanos**). Las metas numéricas **no están en este doc 05**: salen de doc 06 §10.2 (la de remontada la propone esta área).

### A.1 Qué existe ya en el reductor (`fiesta-reglas.js`)

| Pieza | Estado |
|---|---|
| Objetos | 11 de los 15 de §9.3 (faltan Pasaje, Ticket de Avioneta, Vela, Planta Eléctrica, Nido de Zancudos) |
| Tiendas | 9 de 10 con stock 2 y reposición cada 5 rondas (falta El Buhonero y el Helado Misterioso) |
| Peajes / alcabalas / atajos | Peaje escalante, cobro de alcabala, Señor del Chaleco, portón con Llave, salto con Paracaídas: sí |
| Ataques | Chancla, Tequeño, Señal Caída: sí. Faltan Nido, Catatumbo, Cañonazo, Colearse y el tope de 20 monedas por ronda |
| Cambiazo | Sí (`vaina`: da / qué / recibe; 20, monedas y estrella desde la ronda 6) |
| Duelo 1v1 | Sí (casilla `duelo`, apuesta 5/10/20; falta el Guante de Dominó con estrella) |
| Remontada | Ruleta del último en Recta Final, Bono de la Abuela, peso de la estrella hacia los últimos (ver A.3: casi no discriminaba) |
| Mecánicas por región | No: `evento`/`especial` usan la tabla genérica `EVENTOS`; Catatumbo, Mochima, Galipán, etc. sin hacer |

### A.2 Resultados (escenario «igual»: 4 × pana; 15 turnos)

| Métrica | Meta | Reductor anterior (3 000) | Propuesta v1 (10 000) | v2 implementada |
|---|---|---|---|---|
| Estrellas compradas por partida | 8 – 14 | 2,9 ✗ | 8,4 ✓ | 9,9 ✓ |
| Estrellas del ganador antes del bonus | 3 – 6 | 1,5 ✗ | 3,0 ✗ (rozando: ~2,97) | 3,4 ✓ |
| % partidas donde el bonus cambia al ganador | 15 – 30 % | 41,0 ✗ | 32,8 ✗ | 42,0 ✗ (aceptado: más drama) |
| % ganadas por el líder tras la ronda 10 | 45 – 65 % | 49,7 ✓ | 46,8 ✓ | 43,9 ✗ (rozando) |
| Monedas medias al final | 10 – 40 | 29,9 ✓ | 33,5 ✓ | 32,4 ✓ |
| Turnos con 0 decisiones | < 35 % | 14,8 ✓ | 10,7 ✓ | 11,0 ✓ |
| Jugadores 3+ turnos seguidos en 0 monedas | < 5 % | 0,1 ✓ | 0,0 ✓ | 0,0 ✓ |
| Duración simulada (media; brief ≤ 45) | 25 – 40 | 39,0 ✓ | 41,0 ✗ en doc 06, ✓ en brief (p90 44,4) | 41,2 ✗ en doc 06, ✓ en brief (p90 44,5) |
| Remontada: el último tras la ronda 8 gana | ≥ 12 % (propuesta) | 11,5 ✗ | 14,0 ✓ | 13,7 ✓ |
| Pana vs 3 Chamo gana el Pana | 40 – 55 % | 43,2 ✓ | 39,8 ✗ (IC95 38,8–40,8) | 44,7 ✓ (IC95 43,7–45,7) |
| Arrecho vs 3 Azar gana el Arrecho (habilidad > azar) | > 25 % | 85,8 ✓ | 91,7 ✓ (IC95 91,2–92,2) | 94,6 ✓ (IC95 94,2–95,1) |
| Línea base 4 × azar, reparto por asiento | ≈ 25 % | 24,5 – 25,9 | 24,6 – 25,6 | 25,0 / 25,3 / 24,7 / 25,0 |

La habilidad pesa con claridad y el azar puro reparte parejo. «Pana vs Chamo» depende del supuesto de habilidad en minijuegos, no de la economía.

### A.3 Hallazgo principal: el cuello de botella es la estrella, no las monedas

Con el reductor actual hay **una sola estrella** que, tras cada compra, reaparece a 15–25 pasos (el mapa mide 45 pasos de vuelta y el dado 5,5 de media): ciclo medio de 3,5 rondas, primera compra en la ronda ~6 y ~3 estrellas por partida. Barrido (`--cfg`): bajar el precio de 20 a 10 solo sube de 2,9 a 3,7; más monedas iniciales o más ingreso tampoco mueven el techo (~5) mientras exista una única estrella. La regla de peso hacia los últimos (`m/ult.length<=25`) casi siempre se cumple, así que no discriminaba.

### A.4 Propuesta v1 → v2 (cambios de la fase 2, probados como parches en `pruebas/sim-balance-parches.js` y ya aplicados al reductor)

| Parche | Cambio |
|---|---|
| `dos-estrellas` | Dos estrellas activas a la vez (hoy solo en la Recta Final). Cada compra muda solo la comprada. Es el que más pesa; **cambia la forma del estado** (UI, CPU y `estrellaMueve` deben conocer la segunda) |
| `estrella-azules`, `estrella-cerca`, `estrella-pegada8` | Candidatas = las 15 marcadas + todas las azules; mínimo 4 pasos de cualquier jugador (antes 8); peso 1/8 si queda a más de 8 pasos del jugador más cercano |
| `estrella-ultimo` | Peso ×4 a las candidatas a ≤ 10 pasos del último (remontada real) |
| `ingreso-alto` | Pago FFA 10/6/3/1 → 14/9/5/2; azul +3 → +4 |
| `bonus-1` | Bonus final: solo la categoría oculta (quita Minijuegos y Ricachón). **NO aplicado en v2**: el dueño pidió conservar las 3 categorías por el drama |
| `bono-mitad`, cfg `precio:10, mon0:20` | Estrella a 10, 20 monedas iniciales; el Bono de la Abuela deja la estrella a la mitad |

### A.5 Qué queda abierto

1. **Bonus (32,8 % en v1; ~41 % esperado con 3 categorías)**: decidido por el dueño: se **conserva** el bonus de 3 categorías para más drama y se acepta el flip alto. Queda como palanca futura quitar categorías.
2. **Estrellas del ganador 3,0 y duración 41 min**: rozan la meta; el tiempo es un modelo (pensar + animaciones + minijuegos), conviene validarlo con humanos.
3. **Fase 2 (hecha)**: v2 aplicada a `fiesta-reglas.js` con el contrato nuevo: `S.estrella={nodo,b,precio}`, `estrellasEn(S)`, `vista.estrellas`, `estrellaMueve{i}`, `cfg.estrellas` (2 por defecto), `precio 10`, `mon0 20`, azul +4 (x2 en últimos 5), pago FFA 14/9/5/2 y Bono = `ceil(precio/2)`. Los números de v2 de A.2 se rellenan con la corrida final. Pendiente: la Tasa del Día sigue con 15/20/20/25.
4. **CPU**: algunos jugadores con muchas monedas no van derecho a la estrella (`ruta` es voraz); las cifras de estrellas son un piso respecto a humanos.


**Corrida final de v2** (reductor real, `node docs/style-lab/pruebas/sim-balance.js --partidas=10000`, 662 s): 3 métricas fuera de meta. Dos reglas añadidas tras la revisión independiente, ya dentro del reductor: una estrella que lleva 6 rondas sin mudarse se muda sola (el 21 % de las partidas dejaba una estrella muerta todo el juego) y las dos estrellas evitan caer en la misma región (peso 1/4). Eso subió las compras de 8,4 a 9,9 por partida. La Tasa del Día se reescala sobre `cfg.precio` (×0,75 / ×1 / ×1,25). Abierto: líder en ronda 10 (43,9 % vs 45–65 %) y duración (41,2 min) rozan la meta; el bonus (42 %) es decisión del dueño.
