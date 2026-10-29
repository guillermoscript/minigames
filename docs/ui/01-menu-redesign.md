# 01 · Rediseño de menús: un solo juego de consola

Estado: **borrador para aprobar**. Todavía no hay código. Cuando lo apruebes empiezo por el paso 1 de §8.

**Objetivo.** Hoy MiniCaos se siente como varias páginas pegadas: la portada y los menús de `index.html`, el mundo
Venezuela (`worlds/venezuela/`), LA FIESTA (`fiesta.html`) y Margarita (`docs/margarita/`). Cada una tiene sus
propios botones, su propia letra, su propio botón de volver y sus propias teclas. La idea es que se sienta como un party game
de Nintendo: una portada, un menú principal y la misma carcasa dentro de cada mundo.

**Lo que no se toca.** La lógica de juego queda igual: microjuegos, jefes, netcode de las salas, reglas del tablero, CPU.
Solo cambian los menús, la navegación y la capa que dibuja los botones.

---

## 0. Decisiones de base (leer primero)

1. **El kit se dibuja en canvas, no en DOM.** El 2026-10-10 se probó un menú de mundos en HTML/CSS (`86ac2f7`, con
   `css/worlds.css` y `public-ui.js`) y se revirtió 13 minutos después (`e773c87`, *Keep world navigation in the original
   MiniCaos canvas UI*). Además `test/worlds.e2e.js` exige que no exista `.world-menu`. Por eso el kit es una librería de
   dibujo en canvas, de modo inmediato, como `button()` y `pui()` de hoy. Hay dos excepciones, que ya existen y se quedan: los `<input>`
   superpuestos (nombre, código, pana) y el HUD DOM del tablero de Margarita. Esos se reestilizan con las mismas fichas (§3).
2. **Un solo archivo, en ES5.** `js/ui/mcui.js` expone el global `MCUI`. Va en ES5 (`var`, `function`, sin `?.`, `??`, *spread*
   ni `async`) para que lo puedan cargar las cuatro páginas, también las de `fiesta-*.js`. Recibe el `ctx` donde dibuja,
   así funciona sobre el canvas de `main.js`, el overlay `#camp-ov` de `campana.js`, el canvas de fiesta y uno nuevo en Margarita.
   La ruta `../../js/ui/mcui.js` sirve igual desde `docs/style-lab/` y desde `worlds/venezuela/`, que es lo que ya hace `public.html` con
   `../../js/eggs.js`.
3. **Solo 16-bit.** Letra pixel (§3.2), placas rectas con esquinas mordidas, contornos de 2 a 4 px y fondos de patrón
   *dither*. Los personajes salen del elenco que ya existe (`CAST.host`, `caos()`, `BUS.AP.CAST`, los sprites de `pixel.js`).
   No hay estilo nuevo.
4. **En el teléfono vertical los menús se ven en «modo alto».** Hoy un teléfono en vertical muestra el canvas de 800×600 a
   ~0,47× y el aviso «gira el teléfono». En los estados de menú el canvas pasa a medir 400 de ancho lógico y el alto que dé la pantalla
   (≈ 400×866 a 375×812). Los microjuegos siguen en horizontal y no cambian. Ver §2.3.
5. **Marca.** Todo lo visible dice MiniCaos. Las claves internas `claudeware-save-v2`, `claudeware-lang` y la caché
   `claudeware-v4` **no se renombran**: hacerlo borraría el progreso de los jugadores. No se ven en la interfaz.

---

## 1. Mapa de pantallas

```
                       ┌────────────────────┐
  /  ?lang  ?r=CODE  ─►│ T0 PORTADA         │  START: ?r → unirse a la sala · ?c (reto) → aceptar · si no → M0
  ?c=… (reto)          └─────────┬──────────┘
                                 │ START / tocar
                       ┌─────────▼──────────┐
                       │ M0 MENÚ PRINCIPAL  │◄──────────── VOLVER desde J0, P0, R0, K0, O0
                       └┬───┬────┬────┬───┬─┘
         ┌──────────────┘   │    │    │   └───────────────┐
 ┌───────▼──────┐  ┌────────▼──┐ │  ┌─▼──────────┐ ┌──────▼──────┐
 │ J0 JUGAR     │  │ P0 PANAS  │ │  │ K0 RÉCORDS │ │ O0 OPCIONES │
 │ (mundos)     │  └─┬──┬──┬───┘ │  └─┬──────────┘ └─┬───────────┘
 └┬───┬───┬───┬─┘    │  │  │   ┌─▼───────────┐     O1 CONTROLES (ayuda)
  │   │   │   │      │  │  │   │ R0 MI PERFIL│
  │   │   │   │      │  │  │   └─┬───────────┘
  │   │   │   │      │  │  └► P3 MIS PANAS (friends) ─► R1 perfil de otro (pview)
  │   │   │   │      │  └───► P2 INVITAR (enlace + QR)
  │   │   │   │      └──────► P1 SALA (lobby de la fiesta de microjuegos: party.view lobby/between/end/wait)
  │   │   │   │
  │   │   │   └─ MARGARITA ─► W4 carcasa Margarita ─► tablero (docs/margarita) ─► final ─► W4
  │   │   └─── LA FIESTA ──► W3 carcasa FIESTA (fiesta.html: menú/nombre/código) ─► SALA ─► tablero
  │   └─────── VENEZUELA ──► W2 carcasa Venezuela (worlds/venezuela/: etapas · práctica · opciones) ─► juego
  └─────────── CLÁSICO ────► W1 carcasa Clásico (etapas · práctica) ─► stagein ─► … ─► clear/over ─► W1
```

### 1.1 Cómo se llega y cómo se vuelve

| Pantalla | Se llega desde | VOLVER (botón, Esc, Retroceso, B) va a | Estado/URL |
|---|---|---|---|
| T0 Portada | carga de `/` | — (Esc no hace nada) | `state='title'` |
| M0 Menú principal | T0 START | T0 | `state='main'` **(nuevo)** |
| J0 Jugar | M0 · `?worlds` · volver de cualquier mundo | M0 | `state='worlds'` (se queda el nombre, los tests lo usan) |
| W1 Clásico | J0 · `?world=classic` | J0 | `state='menu'` / `'practice'` |
| W2 Venezuela | J0 → `worlds/venezuela/?lang=` | J0 (`../../?worlds=1&lang=`), como hoy | `CAMP.state='menu'` |
| W3 LA FIESTA | J0 → `worlds/venezuela/fiesta.html` · `/r/CODE` de fiesta | J0 (`../../?worlds=1&lang=`). **Hoy va a `./`** (Venezuela) | `pantallaDe()` |
| W4 Margarita | J0 (en producción: tarjeta PRÓXIMAMENTE) | J0 (`../../?worlds=1&lang=`). **Hoy no tiene salida** | pantalla de entrada nueva |
| P0 Fiesta con panas | M0 · tecla F en T0 | M0 | `state='party'`, `party.view='menu'` |
| P1 Sala | P0 CREAR/UNIRSE · `?r=CODE` | sale de la sala → P0 (con diálogo «¿SEGURO?») | `party.view` lobby… |
| P2 Invitar | P0 | P0 | `state='invite'` **(nuevo)** |
| P3 Mis panas | P0 · R0 | de donde vino (`from.friends`) | `state='friends'` |
| R0 Mi perfil | M0 · chip de jugador (arriba a la derecha) en cualquier pantalla | de donde vino | `'profile'` (invitado) / `'pview'` (tuyo) |
| K0 Récords | M0 · W1 | de donde vino (`from.board`) | `state='board'` |
| O0 Opciones | M0 · tecla O en cualquier menú | de donde vino | `state='options'` **(nuevo)** |

Reglas de VOLVER:

- **Siempre se vuelve a la pantalla de donde viniste y con el foco en el botón que usaste para salir.** El kit guarda una pila de
  `{pantalla, idDelFoco}`. Las variables `from.*` de hoy se quedan como respaldo para las entradas por URL.
- **Al cambiar de página se lleva el contexto en la URL**, no en la memoria: `?worlds=1&lang=es&from=venezuela`. J0 lee `from` y pone el foco en
  esa tarjeta.
- **Durante una partida online, Esc no saca a nadie.** Igual que hoy en `main.js:850`: se abre el diálogo «¿TE VAS DE LA SALA?».

### 1.2 Enlaces que tienen que seguir funcionando

| Enlace | Comportamiento después del cambio |
|---|---|
| `/?worlds` · `/?worlds=1` | entra directo a J0 (y M0 queda debajo en la pila, así VOLVER va a M0) |
| `/?world=classic` | entra directo a W1 |
| `/?r=CODE` (`/r/CODE` de la fiesta de microjuegos) | T0 con el cartel «TU PANA TE INVITA A LA SALA CODE»; START = UNIRSE; botón secundario IR AL MENÚ |
| `/?c=…` (reto) | T0 con el cartel del reto; START = ACEPTAR (`acceptChallenge`) |
| `/r/CODE` de LA FIESTA | va a `worlds/venezuela/fiesta.html?r=CODE`, sin cambios (`party_routes.js:183`) |
| `?lang=es|en` | lo respetan las cuatro páginas; Venezuela y Margarita lo pasan al volver |
| `?unlock`, `?i18n-debug`, `?nivel`, `?etapa`, `?juego`, `?estilo`, `?embed=1`, `?practica` | sin cambios |
| `fiesta.html?embed=1` (minijuegos de ronda de Margarita) | **sin carcasa**: con `embed=1` no se dibujan el encabezado ni VOLVER |

---

## 2. Wireframes

Coordenadas en píxeles lógicos. **Ancho** = 800×600 (más `OX` a los lados en pantallas anchas: los fondos llenan
`-OX..W+OX` y el contenido se queda en el centro). **Alto** = 400×(alto de la pantalla en lógicos); a 375×812 da ≈ 400×866.

### 2.1 Elementos fijos (en todas las pantallas de menú)

```
 ANCHO 800×600                                              ALTO 400×866
 ┌────────────────────────────────────────────────┐         ┌──────────────────────────┐
 │[◄ VOLVER]       TÍTULO DE PANTALLA   [● NOMBRE]│ 0–88    │[◄]   TÍTULO      [●]     │ 0–88
 │ 16,16 136×56                       648,16 136×56│         │16,16 56×56    328,16 56×56│
 ├────────────────────────────────────────────────┤         ├──────────────────────────┤
 │                                                │         │                          │
 │                 CONTENIDO                      │ 104–536 │       CONTENIDO          │ 104–(H-80)
 │                                                │         │   (se desplaza si no     │
 │                                                │         │    cabe: arrastre/rueda) │
 ├────────────────────────────────────────────────┤         ├──────────────────────────┤
 │ [ESC] VOLVER · [ENTER] ELEGIR · [◄►▲▼] MOVER   │ 552–584 │  (sin barra de teclas    │
 └────────────────────────────────────────────────┘         │   en táctil)             │
                                                            └──────────────────────────┘
```

- **VOLVER** siempre en el mismo sitio: `x=16-OX, y=16, 136×56` en ancho y `56×56` (solo `◄`) en alto. El test pulsa en
  `(80-OX, 32)`, que sigue cayendo dentro.
- **El chip del jugador** (Caos del color del perfil + nombre, o INVITADO) siempre arriba a la derecha y abre R0. Es el
  `profileBtn()` de hoy con el estilo del kit.
- **La barra de teclas** solo se ve con teclado o mando, y cambia los iconos según lo último que se usó (teclado → `[ESC]`,
  mando → `(B)`). En táctil desaparece.

### 2.2 Pantallas en ancho (800×600)

**T0 · Portada**

```
┌──────────────────────────────────────────────────────────────┐
│ [ES ▸ EN]  [♪]                                   [● GUILLE ] │
│                                                              │
│                    ███ M I N I ███                           │  logo pixel, cae con rebote
│                    ███ C A O S ███                           │
│                                                              │
│              sapito   ( CAOS saltando )   mamá               │  elenco en fila, 16-bit
│                                                              │
│               ▶  PULSA START  ◀                              │  parpadeo 2 Hz, en pasos
│        ENTER · ESPACIO · TOCA LA PANTALLA · (A)              │
│ ┌──────────────────────────────────────────────────────────┐ │  solo con ?r o ?c:
│ │  TU PANA TE INVITA A LA SALA  ABCD     [UNIRME] [MENÚ ►] │ │  cartel de invitación/reto
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**M0 · Menú principal**

```
┌──────────────────────────────────────────────────────────────┐
│[◄ VOLVER]          MENÚ PRINCIPAL               [● GUILLE ]  │
├──────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────┐  ┌───────────────────────────┐ │
│ │► JUGAR                  ▸ │  │                           │ │  izquierda: 5 placas 352×68,
│ └───────────────────────────┘  │   (escena del elenco      │ │  separación 12, y=112…512
│ ┌───────────────────────────┐  │    según la opción        │ │
│ │  FIESTA CON PANAS   (2) ▸ │  │    con el foco)           │ │  (2) = solicitudes de panas
│ └───────────────────────────┘  │                           │ │
│ ┌───────────────────────────┐  ├───────────────────────────┤ │
│ │  MI PERFIL              ▸ │  │ JUGAR                     │ │  derecha: panel 352×400,
│ └───────────────────────────┘  │ Cuatro mundos: Clásico,   │ │  descripción de 2-3 líneas
│ ┌───────────────────────────┐  │ Venezuela, LA FIESTA y    │ │
│ │  RÉCORDS                ▸ │  │ Margarita.                │ │
│ └───────────────────────────┘  │                           │ │
│ ┌───────────────────────────┐  │                           │ │
│ │  OPCIONES               ▸ │  └───────────────────────────┘ │
│ └───────────────────────────┘                                │
│  [ESC] VOLVER · [ENTER] ELEGIR · [▲▼] MOVER                  │
└──────────────────────────────────────────────────────────────┘
```

**J0 · Jugar (elige mundo)**

```
┌──────────────────────────────────────────────────────────────┐
│[◄ VOLVER]             ¿A QUÉ JUGAMOS?            [● GUILLE ] │
├──────────────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐      │  4 tarjetas 176×384,
│ │░░ azul ░░░│ │░ amarillo░│ │░░ rosa ░░░│ │░ turquesa░│      │  separación 16, y=112
│ │  sapito   │ │  bandera  │ │  tablero  │ │   isla    │      │  arte 112 px, banda de color
│ │           │ │  pixel    │ │  + dado   │ │  pixel    │      │  del mundo
│ │ CLÁSICO   │ │ VENEZUELA │ │ LA FIESTA │ │ MARGARITA │      │
│ │ 100+ micro│ │ Camionetica│ │ Tablero  │ │ Tú contra │      │  descripción, 2 líneas
│ │ juegos    │ │ casa, rumba│ │ en línea │ │ 3 CPU     │      │
│ │[1 JUG]    │ │[1 JUG]    │ │[2-4 JUG]  │ │[1 + 3 CPU]│      │  insignia de jugadores
│ │[SIN RED]  │ │[SIN RED]  │ │[EN LÍNEA] │ │[SIN RED]  │      │  insignia offline/online
│ │ ★ 23/54   │ │ ★ 6/15    │ │ SALA ABCD │ │PRÓXIMAMENTE│     │  progreso, sala guardada o sello
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘      │
│  [ESC] VOLVER · [ENTER] JUGAR · [◄►] ELEGIR · [1-4]          │
└──────────────────────────────────────────────────────────────┘
```

La tarjeta con el foco sube 4 px, se le marca el contorno dorado y su arte se anima. Las demás están quietas.
Una tarjeta PRÓXIMAMENTE sale gris y con sello. Al pulsarla aparece el aviso «¡YA CASI! TODAVÍA LA ESTAMOS ARMANDO».

**W\* · Carcasa de mundo (igual en los cuatro)**

```
┌──────────────────────────────────────────────────────────────┐
│[◄ VOLVER]  ▓▓ CLÁSICO ▓▓  ★ 23/54                [● GUILLE ] │  encabezado: banda del color
├──────────────────────────────────────────────────────────────┤  del mundo + nombre + progreso
│  [ ETAPAS ]  [ PRÁCTICA ]  [ RÉCORDS ]                       │  barra de pestañas, y=104, alto 48
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│ │ETAPA 1  ★★☆  │ │ETAPA 2  ★☆☆  │ │ETAPA 3   🔒  │           │  cuadrícula de 3×2 tarjetas 240×150
│ │  (anfitrión) │ │              │ │              │           │  (lista de 2 columnas en Venezuela)
│ │ OFICINA      │ │ COCINA       │ │ BLOQUEADA    │           │
│ └──────────────┘ └──────────────┘ └──────────────┘           │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│ │ …            │ │ …            │ │ …            │           │
│ └──────────────┘ └──────────────┘ └──────────────┘           │
│          [◄]        PÁGINA 1/3        [►]                    │  paginador del kit
│  [ESC] VOLVER · [ENTER] JUGAR · [◄►▲▼] MOVER · [Q/E] PESTAÑA │
└──────────────────────────────────────────────────────────────┘
```

| Mundo | Pestañas | Contenido |
|---|---|---|
| Clásico | ETAPAS · PRÁCTICA · RÉCORDS | las 18 etapas de `STAGES`, la práctica de `PREG`, y K0 filtrado |
| Venezuela | ETAPAS · PRÁCTICA · OPCIONES | las 5 etapas de `CAMP.ETAPAS`, la práctica, y NIVEL 1-3 + música (el estilo queda fijo en SNES en público) |
| LA FIESTA | CREAR · UNIRSE · SEGUIR (solo si hay sesión guardada) | el lobby actual de `fiesta-lobby.js` con los controles del kit |
| Margarita | JUGAR · REGLAS | JUGAR: turnos (10/15/20), dificultad de CPU, ¡ARRANCAR!; REGLAS: casillas y estrellas en 3 tarjetas |

**P0 · Fiesta con panas**

```
┌──────────────────────────────────────────────────────────────┐
│[◄ VOLVER]           FIESTA CON PANAS             [● GUILLE ] │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────┐ ┌───────────────────────────┐ │
│ │ CREAR SALA                 │ │ UNIRSE CON CÓDIGO         │ │
│ │ ( ) MICROJUEGOS  2-4 JUG   │ │  ┌──┬──┬──┬──┐            │ │  4 casillas; en táctil abre
│ │ ( ) LA FIESTA    2-4 JUG   │ │  │A │B │C │D │  [ENTRAR]  │ │  el <input> superpuesto actual
│ │          [ CREAR ►]        │ │  └──┴──┴──┴──┘            │ │
│ └────────────────────────────┘ └───────────────────────────┘ │
│ ┌────────────────────────────┐ ┌───────────────────────────┐ │
│ │ INVITAR                    │ │ MIS PANAS   (2 nuevos)    │ │
│ │ enlace + QR · COPIAR       │ │ ● ana  ● luis  ● peto … ▸ │ │
│ └────────────────────────────┘ └───────────────────────────┘ │
│  ● JUEGAS COMO GUILLE · sin cuenta también se puede          │
└──────────────────────────────────────────────────────────────┘
```

**R0 · Mi perfil**, **K0 · Récords** y **O0 · Opciones** usan la misma plantilla: encabezado, pestañas y un panel.

```
R0  [◄] MI PERFIL                     K0  [◄] RÉCORDS                 O0  [◄] OPCIONES
 ┌────────┐ GUILLE  #12 · 4.210       [CLÁSICO][VENEZUELA]            IDIOMA      [◄ ESPAÑOL ►]
 │ avatar │ [CAMBIAR NOMBRE]          [1][2][3]…[18][TOTAL]           MÚSICA      ▮▮▮▮▮▯▯▯ 60%
 └────────┘ PERSONAJE: [◄ CAOS ►]     #1 ● ana        9.880           EFECTOS     ▮▮▮▮▮▮▮▯ 90%
 COLOR ● ● ● ● ● ● ● ●                #2 ● luis       9.120           CONTROLES   [VER ►]
 [ESTADÍSTICAS][DESBLOQUEOS]          …                               INSTALAR    [INSTALAR APP]
 ★ 23/54 · etapas 9/18 · VE ★ 6/15    TÚ: #34 DE 812 · 2.100          PRIVACIDAD · TÉRMINOS
 [MIS PANAS]          [CERRAR SESIÓN]
```

**Diálogo, aviso y pantalla de carga**

```
 DIÁLOGO (modal, cortina INK al 80%)        AVISO (abajo, 2,6 s)         CARGA (entre páginas o 3D)
 ┌──────────────────────────────┐          ┌──────────────────────┐     ░░░░░░░░░░░░░░░░░░░░░░░░
 │  ¿TE VAS DE LA SALA?         │          │ ✓ ¡ENLACE COPIADO!   │     ░░  CARGANDO…  Caos ░░
 │  Tus panas siguen jugando.   │          └──────────────────────┘     ░░  ▮▮▮▮▮▮▯▯▯▯ (en pasos)
 │   [ME QUEDO]   [ME VOY]      │                                      ░░  tip: «Esc = volver»
 └──────────────────────────────┘                                      ░░░░░░░░░░░░░░░░░░░░░░░░
```

### 2.3 Pantallas en alto (375×812 → 400×866 lógicos)

**Cómo se pasa a modo alto.** `fitScreen()` (`js/core.js:9`) gana una segunda forma. Si el estado es de menú y la pantalla
está en vertical, el ancho lógico queda en `W=400` y `H=round(400·alto/ancho)`. Si no, se mantiene lo de hoy: 800×600 más `OX`. Cada
pantalla del kit se describe una sola vez como una **columna de bloques** (encabezado, pestañas, lista, pie), y el kit los
reparte en ancho (rejilla) o en alto (columna con desplazamiento). Los microjuegos nunca ven el modo alto. Si se entra a
jugar en vertical, sale la tarjeta pixel «GIRA EL TELÉFONO» con un botón JUGAR ASÍ, que deja el juego en el formato
actual con bandas.

```
 T0 PORTADA            M0 MENÚ               J0 JUGAR              W1 CLÁSICO
┌────────────────┐    ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│[ES▸EN][♪]  [●] │    │[◄] MENÚ     [●]│    │[◄] ¿A QUÉ…? [●]│    │[◄]▓CLÁSICO▓[●] │
│                │    ├────────────────┤    ├────────────────┤    ├────────────────┤
│   ██ MINI ██   │    │ (escena elenco │    │┌──────────────┐│    │[ETAPAS][PRÁCT.]│
│   ██ CAOS ██   │    │  alto 160)     │    ││▓ CLÁSICO   ★ ││    │┌──────┐┌──────┐│
│                │    │┌──────────────┐│    ││sapito 1 JUG  ││    ││ET. 1 ││ET. 2 ││ 2 columnas
│  (Caos salta)  │    ││► JUGAR       ││    ││100+ micro…   ││    ││ ★★☆  ││ ★☆☆  ││ 176×150
│                │    ││  4 mundos    ││    │└──────────────┘│    │└──────┘└──────┘│
│                │    │└──────────────┘│    │┌──────────────┐│    │┌──────┐┌──────┐│
│ ▶ TOCA PARA ◀  │    │┌──────────────┐│    ││▓ VENEZUELA ★ ││    ││ET. 3 ││ET. 4 ││
│   EMPEZAR      │    ││ PANAS    (2) ││    │└──────────────┘│    │└──────┘└──────┘│
│                │    │└──────────────┘│    │┌──────────────┐│    │   … desplaza   │
│┌──────────────┐│    │┌──────────────┐│    ││▓ LA FIESTA   ││    │                │
││INVITACIÓN    ││    ││ MI PERFIL    ││    ││2-4 · EN LÍNEA││    │                │
││SALA ABCD     ││    │└──────────────┘│    │└──────────────┘│    │                │
││[UNIRME][MENÚ]││    │ RÉCORDS        │    │┌──────────────┐│    │                │
│└──────────────┘│    │ OPCIONES       │    ││▓ MARGARITA   ││    │                │
└────────────────┘    └────────────────┘    │└──────────────┘│    └────────────────┘
                       placas 368×88         tarjetas 368×150
                                             (horizontales: arte a la izq.)
```

En alto, P0 apila sus 4 paneles, R0/K0/O0 son listas de filas de 64 y los diálogos ocupan 368 de ancho.

---

## 3. Especificación del kit (`MCUI`)

### 3.1 Colores (fichas)

Son los colores que ya usa el juego, con nombre para no repetir hex sueltos.

| Ficha | Hex | Uso |
|---|---|---|
| `ink` | `#14101c` | contornos, sombras duras, texto sobre claro (`INK` de core) |
| `paper` | `#fffdf2` | cara de placas neutras, diálogos (como Margarita) |
| `night` / `night2` | `#2b2757` / `#322d66` | fondo de menús (dither de dos tonos) |
| `panel` / `panelDk` | `#252c4b` / `#171c34` | paneles, ranuras de entrada |
| `gold` | `#FFE14D` | títulos, foco, selección, estrellas |
| `go` | `#5CFF7A` | acción principal (JUGAR, CREAR, ¡LISTO!) |
| `info` | `#4DB8FF` | secundaria (UNIRSE, INVITAR) |
| `lilac` | `#B49CFF` | panas y social |
| `bad` | `#FF4D4D` | error, salir, cerrar sesión |
| `off` | `#8f8b9c` | desactivado, PRÓXIMAMENTE |
| Mundos | Clásico `#4DB8FF` · Venezuela `#FFE14D` · LA FIESTA `#FF4D9E` · Margarita `#3DDC97` | banda del encabezado, tarjeta, cortina de transición |

Cada color de cara lleva un tono oscuro calculado (`mix(c, ink, .3)`) para el borde inferior del bisel y uno claro
(`mix(c, '#fff', .45)`) para la línea de brillo de 2 px. No hay degradados.

### 3.2 Letra

- **Press Start 2P** para todo el texto del kit, que es la letra de Margarita. Se aloja en el propio sitio, en `fonts/press-start-2p.woff2`
  (hoy viene de Google), y se precarga en `sw.js` para que la PWA funcione sin red. Hay que verificar que tenga
  `á é í ó ú ñ ü ¡ ¿`. Si falta algún glifo, se usa la `F3` de `pixel.js` escalada solo para ese carácter.
- Los tamaños van en múltiplos de 8, siempre en enteros, con `imageSmoothingEnabled=false` y posiciones redondeadas:

| Rol | Ancho | Alto |
|---|---|---|
| Logo | sprite, no letra | sprite |
| Título de pantalla | 32 | 24 |
| Placa grande / nombre de tarjeta | 24 | 16 |
| Texto de botón normal | 16 | 16 |
| Cuerpo / descripción | 16 (mínimo) | 16 |
| Insignias / barra de teclas | 8×2 = 16 en insignia, 8 solo para el pie de versión | 16 |

  En un teléfono horizontal de 390 px de alto, 16 lógicos son ≈ 10 px reales, y es el mínimo legible para esta letra.
  Nada de menús baja de 16.
- El texto claro sobre fondo oscuro lleva una sombra INK de 2 px a la derecha y abajo, no contorno redondo. El texto oscuro
  sobre placas claras va sin sombra. Si un texto no cabe en el ancho, se pasa a dos líneas antes que achicarlo
  (hoy `txt()` reduce el tamaño, y en pixel eso da tamaños no enteros).
- Los microjuegos siguen con `txt()` de core. El kit no lo toca.

### 3.3 Tamaños, espacios, contornos

- **Rejilla de 8 px.** Márgenes de pantalla de 16 y separaciones entre placas de 12 a 16.
- **Toques (táctil):** en ancho, el alto mínimo de un objetivo es **64 lógicos**, que a 390 px de alto son ≈ 42 px.
  En alto el mínimo es **56**, que a 375 px de ancho son ≈ 52 px. El área tocable puede ser mayor que la placa
  dibujada (*hit slop* de 8).
- **Contornos:** 4 px en placas, tarjetas, paneles y diálogos; 2 px en insignias, chips, casillas de código y la barra
  de teclas. Esquinas mordidas: se quita un cuadrito de 4×4 (o de 2×2 en lo pequeño) en cada esquina del contorno. Esa es la
  esquina SNES, no un `rr()` redondo.
- **Profundidad:** las placas tienen una base INK desplazada 6 px abajo. Con hover la cara sube 2. Al pulsar baja 4, y la base
  queda visible solo 2.
- **Foco:** marco dorado de 4 px a 4 px de la placa, con una «hormiga» de dos tonos (`gold`/`ink`) que se mueve 2 px cada 0,15 s,
  y un cursor `►` a la izquierda que rebota 2 px. El foco se ve siempre con teclado o mando y nunca en táctil.

### 3.4 Componentes

| Componente | Función | Notas |
|---|---|---|
| Placa-botón | `MCUI.btn(id, x, y, w, h, label, fn, {tone, icon, sub, key, off})` | `tone`: go/info/lilac/bad/paper/gold. Con `key` dibuja la tecla en escritorio. Con `off`, gris y sin `fn` |
| Tarjeta de menú | `MCUI.card(id, rect, {color, art(cx,cy,t), title, desc, badges[], foot, stamp})` | `art` es una función que dibuja con el elenco existente. `stamp`: 'PRÓXIMAMENTE', 'NUEVO' |
| Barra de pestañas | `MCUI.tabs(id, rect, labels[], sel, fn)` | Q/E, LB/RB o tocar. La activa sube 4 px y se une al panel |
| Panel | `MCUI.panel(rect, {tone, band})` | caja sin interacción, con banda de color opcional arriba |
| Diálogo | `MCUI.dialog({title, body, buttons[]})` | modal. Atrapa el foco; Esc = último botón (cancelar) |
| Aviso | `MCUI.toast(text, tone)` | uno a la vez, 2,6 s, entra desde abajo en 3 pasos |
| Pantalla de carga | `MCUI.loading(text, k)` | dither del mundo + Caos con la mecha corriendo + barra de 10 segmentos |
| Botón volver | `MCUI.back(fn)` | siempre en la misma posición (§2.1). Registra Esc, Retroceso y B |
| Insignia de jugador | `MCUI.player(rect, {name, color, cast, tag})` | avatar pixel + nombre. `tag`: ANFITRIÓN/TÚ/LISTO/CPU. La usan el chip, el lobby y las listas |
| Insignia | `MCUI.badge(x, y, text, tone)` | «2-4 JUG», «EN LÍNEA», «SIN RED» |
| Encabezado | `MCUI.header(title, {world, progress})` | título + banda de mundo + chip del jugador |
| Fondo | `MCUI.bg(theme, t)` | patrón dither de 8 px que se desplaza en diagonal a 8 px/s. Reemplaza los rayos de `bg()` en los menús |
| Lista desplazable | `MCUI.list(id, rect, n, rowH, drawRow)` | arrastre, rueda o flechas. Solo se usa en modo alto y en listas largas |
| Deslizador | `MCUI.slider(id, rect, value, fn)` | volumen. ◄► de 10 en 10. Arrastre en táctil |

Todos registran su rectángulo y su `id` en `MCUI.items` en cada cuadro. De ahí salen el toque, el foco y los tests (§4.4).

### 3.5 Movimiento

| Qué | Cómo | Tiempo |
|---|---|---|
| Cambio de pantalla | la cortina INK inclinada que ya existe (`main.js:823`), con el color del mundo en el borde | 0,30 s |
| Entre páginas (J0 → Venezuela…) | la cortina **entra** antes de `location.assign` y **sale** al cargar la otra página (`sessionStorage['mc-wipe']=color`) | 0,25 s + 0,25 s |
| Entrada de tarjetas | caen 16 px en 4 pasos, escalonadas cada 0,05 s | 0,2 s |
| Foco | marco de hormigas + cursor (§3.3). El cambio de foco hace `sfx.tick` | — |
| Pulsar | sfx.click + baja 4 px durante 2 cuadros, y luego se ejecuta | 0,06 s |
| Volver | `sfx.whoosh(false)` + la cortina sale hacia la izquierda | 0,30 s |
| Elenco | parpadeo, respiración y saltos ya hechos; en menús solo se anima el de la opción con foco | — |

**Todo el movimiento va en pasos de 2 px.** Nada se interpola con subpíxeles. Con `prefers-reduced-motion` las cortinas
pasan a un corte directo y el elenco queda quieto.

---

## 4. Reglas de entrada

### 4.1 Tabla única (todas las páginas)

| Acción | Teclado | Mando | Táctil / ratón |
|---|---|---|---|
| Mover el foco | flechas · WASD | cruceta · palanca izq. | — (hover con ratón mueve el foco) |
| Confirmar | Enter · Espacio | A | tocar / clic |
| Volver | Esc · Retroceso | B | botón ◄ VOLVER |
| Pestaña anterior/siguiente | Q / E | LB / RB | tocar la pestaña |
| Atajo directo | 1-9 (tarjeta n) · letras de la barra de teclas | — | — |
| Abrir opciones | O | Select | menú principal |
| Silencio | M (como hoy) | — | O0 o ♪ en la portada |
| Start | Enter en T0 | Start | tocar en T0 |

- **Retroceso** solo vuelve cuando no hay un `<input>` con foco. Si lo hay, borra, igual que hoy con el bloqueo de
  `main.js:832`.
- **WASD solo mueve el foco en los menús.** En juego, las teclas siguen yendo al microjuego, como ahora.
- **Los atajos de hoy siguen** (P práctica, L récords, A perfil, F panas, G idioma), pero solo se muestran en la barra de
  teclas de la pantalla donde aplican.

### 4.2 Foco

- **Navegación espacial.** Con una flecha, el foco salta al objetivo registrado más cercano en esa dirección, y primero a los
  que se solapan en el eje cruzado. Así sirve el modo inmediato sin declarar una rejilla. En las pestañas, ◄► se mueve dentro de la barra
  y ▼ entra al contenido.
- **Foco inicial** en el primer botón principal de la pantalla, o en el recordado si se vuelve (pila de §1.1).
- **El foco se ve con teclado o mando** y se oculta con el primer toque. Así no hace falta el `!TOUCH` repartido por el código.

### 4.3 Mando

- Gamepad API con sondeo en el bucle del kit (`MCUI.pad()`): genera los mismos eventos que el teclado. Repetición de
  0,35 s y luego 0,12 s en la cruceta y la palanca (zona muerta de 0,5).
- Reutiliza la idea de `mandoTeclas` (`fiesta-main.js:246`), pero la lleva al kit para que funcione en las cuatro páginas.
- **En juego, el mando no se toca en este trabajo.** Los microjuegos no reciben eventos de mando nuevos, porque eso sería
  cambiar el juego.

### 4.4 Táctil y pruebas

- **Toda opción se puede tocar.** No hay nada que solo se pueda hacer con teclado: el código de sala tiene su casilla, que abre el `<input>` superpuesto de hoy, y el
  nombre, también.
- Toque = `pointerdown` sobre `MCUI.items`, igual que el `btns[]` de hoy. El hover del ratón mueve el foco.
- **Para los tests** el kit expone `MCUI.items` (con `id`, rectángulo y página) y `MCUI.press(id)`. Los e2e dejan de
  depender de coordenadas mágicas como `tap(210,270)`: buscan el rectángulo del `id` y tocan su centro. Así se prueba el
  toque real sin atar el test al diseño.

---

## 5. Qué reemplaza cada pieza

| Pieza nueva | Reemplaza | Archivo(s) |
|---|---|---|
| `js/ui/mcui.js` (kit) | `button()`, `hoverBox()`, `profileBtn()`, `drawToast()` de `js/main.js:374-400`; `box3`/`button`/`chips`/`tabsNivel`/`worldCard`/`say` de `campana.js:170-398`; `boton`/`caja`/`T` de `fiesta-ui.js:412-448`; los botones de `pui().btn` en menús (`js/party.js:386`) | nuevo + llamadas |
| `fonts/press-start-2p.woff2` | la carga de Fredoka y Press Start 2P desde Google en menús | `index.html`, `public.html`, `fiesta.html`, `docs/margarita/index.html`, `sw.js` |
| Modo alto en `fitScreen()` | el letterbox 4:3 en vertical y el aviso `#rot` en menús | `js/core.js:9`, `css/style.css` (`#rot` solo en juego) |
| T0 Portada | rama `state==='title'` de `render()` (`main.js:469-491`): los botones INVITE/FRIENDS/MENÚ pasan a M0 y P0 | `js/main.js` |
| M0 Menú principal | no existe; hoy la portada salta a ELIGE MUNDO (`titleGo`, `main.js:79`) | `js/main.js` o `js/menus.js` nuevo |
| J0 Jugar | `drawWorlds`/`worldList`/`worldKey` (`js/worlds.js`): se queda el arte (`pixelVenezuelaFlag`, `pixelIsland`) y se suma LA FIESTA | `js/worlds.js` |
| W1 Clásico | ramas `menu` y `practice` de `render()` (`main.js:492-544`) y su teclado (`main.js:867-877`) | `js/main.js` |
| Resultado (clear/over) | solo los botones RETRY/SHARE/STAGES y NEXT pasan a placas del kit; la animación y el arte se quedan | `js/main.js:622-660` |
| P0/P1/P2/P3 | `drawPartyMenu` (`party.js:552`), la pantalla `friends` (`main.js:720-775`) y `drawShareMenu` (`main.js:70`) pasan a P2. Lobby y entre rondas: solo los botones y paneles; la lógica de la sala no se toca | `js/party.js`, `js/main.js` |
| R0 | `profile` y `pview` (`main.js:662-682`, `776-820`), diálogo CAMBIAR NOMBRE → `MCUI.dialog` | `js/main.js` |
| K0 | `board` (`main.js:683-719`) | `js/main.js` |
| O0 | `M = MUTE` suelto, el botón de idioma en la portada y `#pwa-install` (el botón DOM pasa a una placa que llama al aviso guardado en `js/pwa.js:15`) | `js/main.js`, `js/pwa.js`, `js/core.js` (buses de volumen) |
| W2 Venezuela | `render()` de `menu`/`options`/`practice` en `campana.js:407-451` y sus teclas (`campana.js:572-582`) | `docs/style-lab/campana.js`, `public.html` |
| W3 LA FIESTA | el lobby `menu`/`nombre`/`codigo` (`fiesta-lobby.js:578-630`): solo dibujo y foco. Las intenciones (`create`, `join`…) y `fiesta-net.js` no cambian | `fiesta-lobby.js`, `fiesta-ui.js`, `fiesta-main.js:192` (VOLVER) |
| W4 Margarita | no existe: pantalla de entrada nueva antes de `partida()`. El CSS de `#msg`, `.bt` y `#toast` pasa a las fichas de §3.1. **No se tocan** las reglas del tablero | `docs/margarita/index.html`, `margarita.js` (solo arranque y salida) |
| Opciones compartidas | `localStorage['minicaos-opts-v1'] = {lang, music, sfx}`, que leen las cuatro páginas | kit |

**Volumen.** Hoy solo existe `muted`. Para MÚSICA y EFECTOS por separado, `core.js` gana dos `GainNode` (`MUSIC`, `SFX`)
colgados de `MASTER`. `musTick()` ya pasa por `snd(..., bus)`, así que la música va al bus `MUSIC` sin tocar ningún
microjuego. Venezuela y LA FIESTA tienen su propio audio en `engine.js`: ahí solo se lee el volumen guardado.

**i18n.** Todo texto del kit pasa por `t()`, con la clave en inglés como hoy y el español en `js/i18n/es/ui.js`.
`campana.js` y `fiesta-*.js` hoy son solo español. Para que tengan inglés, `public.html` y `fiesta.html` cargan
`../../js/i18n.js` + `../../js/i18n/es/ui.js`, y las cadenas de menú de esas páginas pasan a `t('ENGLISH KEY')` con el español en el
diccionario. El texto dentro de los juegos de Venezuela queda como está.

---

## 6. Mundos que no están en producción

| Mundo | Hoy | Propuesta |
|---|---|---|
| LA FIESTA | **ya se publica** en `worlds/venezuela/fiesta.html` (Dockerfile + `sync-world-assets.sh`), pero la portada no la enlaza | tarjeta normal en J0 con la insignia EN LÍNEA. Si el servidor de salas no responde, la carcasa muestra «LAS SALAS ESTÁN DORMIDAS, PRUEBA MÁS TARDE» en vez de fallar |
| Margarita | solo en `docs/margarita/`, sin `?v`, y la tarjeta solo aparece en localhost | **en producción, tarjeta PRÓXIMAMENTE**; en localhost se puede jugar. Para publicarla más adelante (no ahora, y sin desplegar): `sync-world-assets.sh` copia `docs/margarita/*` a `worlds/margarita/`; las rutas `../style-lab/fiesta.html` y `jugar.html` pasan a `../venezuela/fiesta.html` y a `../venezuela/?juego=` (hay que comprobar que la versión pública acepta `?juego`), y el Dockerfile suma `worlds/margarita/index.html` a la reescritura de `?v`. Un solo interruptor, `SHIPPED.margarita`, en `js/worlds.js` |

La detección «localhost = se puede jugar» se queda como está (`MARGARITA_LOCAL`, `js/worlds.js:15`), pero pasa a una tabla
`WORLDS = [{id, shipped, local}]` para que la tarjeta y el sello salgan del mismo dato.

---

## 7. Pruebas (cómo voy a comprobar cada paso)

1. Servidor: la configuración `game` de `.claude/launch.json` (`python3 -m http.server 8765`).
2. `test/worlds.e2e.js` y `test/mobile.e2e.js` con `WORLD_BASE_URL=http://127.0.0.1:8765`. Se actualizan en el mismo
   commit que cambia cada pantalla: los `tap(x,y)` pasan a `tapId('jugar')` vía `MCUI.items`. **Las aserciones de fondo
   se quedan**: nada de menús DOM, nada de UI del laboratorio en público, canvas a pantalla completa en horizontal y cero
   errores de página.
   - `mobile.e2e.js` exige hoy un canvas 4:3 en vertical en `public.html`. Cuando Venezuela pase a modo alto (paso 7), esa
     aserción cambia a «modo alto en menús, 4:3 en juego». Lo marco aquí para que no sea sorpresa.
3. Un e2e nuevo, `test/menus.e2e.js`, recorre el mapa de §1 con solo teclado y con solo toque, a 1280×800, 375×812 y 812×375.
   En cada VOLVER comprueba que se llega a la pantalla de origen con el foco en el botón de salida, y que no hay errores de consola.
4. Capturas de cada pantalla nueva en escritorio y en teléfono, para revisarlas yo y para mostrártelas.
5. `node test/i18n.test.js` para que no queden cadenas del kit sin traducir.

---

## 8. Orden de trabajo (un commit por paso)

| Paso | Contenido | Commit |
|---|---|---|
| 1 | Kit `mcui.js` + letra local + modo alto en `fitScreen` + T0 + M0 + J0 conectados a los mundos actuales (URLs de §1.2), tests actualizados | «Shared pixel UI kit, title, main menu and world select» |
| 2 | W1 Clásico (etapas, práctica, botones de resultado) | uno |
| 3 | P0-P3 Fiesta con panas (crear, unirse, invitar con QR, panas) | uno |
| 4 | R0 Mi perfil | uno |
| 5 | K0 Récords | uno |
| 6 | O0 Opciones + buses de volumen | uno |
| 7 | W2 Venezuela (`campana.js` en ES5, i18n de su menú) | uno |
| 8 | W3 LA FIESTA (lobby con el kit, VOLVER a J0, sin carcasa con `embed=1`) | uno |
| 9 | W4 Margarita (pantalla de entrada, VOLVER, CSS con fichas) | uno |

En cada commit preparo solo los archivos que toqué (`git add <archivo>`): nunca `stash`, `reset`, `checkout --` ni `clean`.
Ojo: varios de esos archivos (`campana.js`, `fiesta-ui.js`, `js/main.js`, `js/eggs.js`…) ya tienen cambios tuyos sin commit.
En esos casos te aviso antes de preparar el archivo entero, para no meter tu trabajo en mis commits.

---

## 9. Preguntas abiertas (necesito tu decisión)

1. **UNIRSE CON CÓDIGO cuando no se sabe de qué tipo es la sala.** Un código puede ser de una sala de microjuegos (`/?r=`) o de LA FIESTA
   (`fiesta.html?r=`). Opciones:
   - (a) **Recomendada:** una ruta de solo lectura `GET /api/party/kind/:code → {mode}` en `party_routes.js`. Usa el `findByCode`
     que ya existe, no toca el netcode y son unas 10 líneas.
   - (b) Sin servidor: dos casillas separadas, «SALA DE MICROJUEGOS» y «SALA DE LA FIESTA».
2. **QR de invitación.** No hay librería de QR en el repo. Opciones:
   - (a) **Recomendada:** copiar en `js/vendor/` un generador pequeño con licencia MIT (unos 10 KB), que dibuja en pixel sin CDN.
   - (b) Usar `/r/CODE/og.png`, que ya existe, y no tener QR.
3. **PERSONAJE en el perfil.** Hoy el perfil solo guarda el color. ¿Se elige personaje del elenco (Caos, TÚ, MAMÁ, ABUELA,
   PANA, sapito)?
   - (a) **Recomendada:** se guarda solo en el dispositivo, y LA FIESTA lo usa como preferido en la rejilla de personajes.
   - (b) Se guarda también en el servidor, lo que necesita un campo nuevo en la colección de usuarios.
4. **Récords de Venezuela.** No hay tabla de récords de Venezuela en el servidor. ¿Pestaña PRÓXIMAMENTE en K0, o récords
   solo locales?
5. **Letra.** ¿Confirmas Press Start 2P para todos los menús? Hoy la portada usa Arial Black y Fredoka, y el cambio se nota
   mucho. La alternativa es una letra pixel más estrecha (p. ej. «Pixelify Sans» o «Silkscreen»), que cabe mejor en español largo.
