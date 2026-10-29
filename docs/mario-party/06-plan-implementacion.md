# 06 · Plan de implementación: «LA FIESTA» (modo tipo Mario Party en el mapa de Venezuela)

> Documento de ingeniería. Traduce el manual de diseño (docs 01 a 05 de esta carpeta) a archivos, módulos, estados, formatos de datos, pruebas e hitos concretos dentro de **este** repo.
> Nombre de trabajo del modo: **LA FIESTA** (provisional, ver preguntas abiertas). Moneda: **monedas** (o «lochas» o «bolos», por decidir). Meta: **estrellas** (se usa «star» o «estrella», el término estándar de la serie).
> Todo lo que no se pudo comprobar en el código o en una fuente lleva **(por verificar)**. Las estimaciones de tiempo son de una persona trabajando con el ritmo actual del laboratorio (construcción rápida, revisión manual del usuario; ver memoria «lab builds fast»).

---

## 0. Resumen ejecutivo

| Decisión | Recomendación | Por qué |
|---|---|---|
| Motor | Motor del laboratorio (`docs/style-lab/engine.js` + `juegos-bus.js`), **no** el motor clásico (`js/core.js`) | Ahí están el mundo Venezuela, el reparto (mamá, abuela, TÚ), las 6 estéticas y los 40 microjuegos |
| Entrada al modo | Página nueva `docs/style-lab/fiesta.html` + archivos `fiesta-*.js`, enlazada desde el menú de `campana.js` | Evita chocar con la máquina de estados de `campana.js` (hay 48 archivos modificados sin commit en la rama `codex/mobile-controls-easter-eggs`) |
| Jugadores | 1 a 4 humanos en el mismo dispositivo; huecos vacíos los llena la CPU | El usuario pidió máximo 4; la versión online se deja para después |
| Tablero | Hot-seat: solo juega el que tiene el turno; los demás miran la misma pantalla | Es como funciona Mario Party en la tele; no requiere multi-input |
| Minijuegos rápidos (ronda de 5) | Fase 1: **secuenciales** (cada jugador juega el mismo microjuego sembrado, uno tras otro) reutilizando los 40 existentes. Fase 2: **simultáneos** nuevos con enrutador de entrada por jugador | Los 40 juegos actuales asumen un solo jugador y un `G` global |
| Minijuego largo exclusivo | Plantilla de los jefes multifase (`juego-jefe-alcabala.js`, FASES) con puntuación por jugador | Ya existe el patrón de 40-60 s por fases |
| Lógica del juego | Módulo **puro** sin canvas (`fiesta-reglas.js`) que se puede correr en Node | Permite simular 10.000 partidas para balancear la economía y probar sin navegador |
| Mapa | Grafo de nodos en JSON (coordenadas de mundo 4000×3000), cámara propia con pan/zoom, capa estática pre-renderizada | El motor no tiene cámara y los estilos «pixel» pintan a buffers pequeños |
| Guardado | `localStorage` clave `minicaos-fiesta-v1`, autosave al final de cada turno, estado 100 % serializable + semilla del RNG | Las partidas duran 25-45 min; hay que poder retomarlas |
| Pruebas | (1) tests de Node para reglas y simulador, (2) `probar.js` para cada minijuego nuevo, (3) Playwright e2e de partida completa y de viewport | Reutiliza la infraestructura que ya existe |
| Hitos | M0 a M6, de «fundaciones» a «lanzamiento en `worlds/venezuela`» | Cada hito deja algo jugable y probado |

---

## 1. Lo que ya existe y se reutiliza (inventario de repo)

Datos sacados del scout del repo. Las líneas pueden moverse porque el árbol de trabajo está sucio.

| Pieza existente | Dónde | Uso en LA FIESTA |
|---|---|---|
| Primitivas de dibujo con estilo (`rr`, `ell`, `limb`, `poly`, `line`, `txt`, `wash`, `bubble`, `spawn`/`PT`) | `engine.js` | Todo el tablero y la UI se dibujan con ellas para heredar las 6 estéticas gratis |
| Estilos `STY`, `setStyle()` | `engine.js:95+`, `:1262` | Selector de estilo en la configuración de la partida |
| Estilos permitidos `ESTILOS` (snes, felt, ww, anime, tinta, garabato + MEZCLA) | `campana.js:42` | Mismo conjunto en LA FIESTA |
| Personaje `bust(o)` | `engine.js:410` | 4 avatares cambiando `shirt`, `skin`, `hair`, `hairCol` |
| Reparto compartido `BUS.TU`, `AP.CAST` (mamá, vecina, abuela, tío, chuo, pana), escenarios `sala`, `cocina`, `barrio`, `oscuro` | `juegos-bus.js:385-393` | Anfitriones del tablero (la abuela vende estrellas, la mamá lanza la chancla), fondos de casillas especiales (ver memoria «Venezuela world shared cast») |
| Registro de microjuegos `BUS.add(id,{name,mk,card,num})` y `GAMES[id]` | `juegos-bus.js:331`, `engine.js:1260` | Fuente de la ronda de 5 microjuegos; los juegos exclusivos se registran igual con una marca `fiesta` |
| Contrato de microjuego (`t`, `dur`, `result`, `why`, `endT`, `cmd`, `hint`, `update`, `draw`, `press`, `down/move/up`, `probe`) | `juegos-bus.js`, `campana.js:334-349` | Base del contrato extendido multi-jugador (sección 6) |
| Jefes multifase (FASES con `cmd`/`hint`/`dur` por fase) | `juego-jefe-alcabala.js:60-64` | Plantilla del minijuego largo exclusivo |
| Dificultad `window.NIVEL` + `BUS.LV()`; velocidad `SP` | `campana.js:306`, `juegos-bus.js:15` | La ronda rápida sube de NIVEL con los turnos |
| Tinte día/atardecer/noche (`NIV`, override de `paint()`/`wash()`) | `campana.js:241-244`, `:546-551` | Ciclo **luz/apagón** del tablero y look de los últimos 5 turnos |
| Música procedural de salsa (`startMusic`, `TONOS`) | `campana.js:141-165` | Música del tablero, una tonalidad por región (por verificar si se puede extraer sin tocar `campana.js`) |
| Ayudas de UI (`button()`, `hoverBox`, `star()`, `caos()`, confeti, `floatText`, `ring`, `burst`, `shake`, `vignette`, `rays`) | `campana.js` (dentro de su cierre, por verificar) | Copiar o extraer a `fiesta-ui.js` |
| Huevos de pascua `EGGS.begin/outcome/stage/clear` | `js/eggs.js` | Llamarlos en cada microjuego y al final de la partida |
| Banco sin ventana `probar.js` + bots | `docs/style-lab/pruebas/` | Pruebas de cada minijuego nuevo |
| e2e de viewport y gameplay | `test/world-viewport.e2e.js`, `test/world-gameplay.e2e.js` (sin commit) | Plantillas de `test/fiesta-*.e2e.js` |
| RNG sembrado `withSeed`/`mulberry32` | `js/core.js` (motor clásico) | Copiar la idea (no el archivo: `core.js` choca con los globales del laboratorio, `campana.js:30`) |
| Fiesta online 2-4 (PocketBase, `MAX_PLAYERS=4`) | `js/party*.js`, `pocketbase/pb_hooks/party*.js` | Solo referencia para una fase online posterior (fuera de M0-M6) |
| Despliegue | `scripts/sync-world-assets.sh` copia `public.html`, `engine.js`, `campana.js`, `juegos-bus.js`, `juego-*.js` a `worlds/venezuela/` | Hay que añadir `fiesta.html` y `fiesta-*.js` al script (M0) |

**Lo que NO existe y hay que construir:** cámara/pan/zoom, grafo de tablero, economía, objetos, turnos por jugador, entrada por jugador (multi-touch por `pointerId`, grupos de teclas, Gamepad API), resultado por jugador en minijuegos, RNG sembrado en el laboratorio, CPU, guardado de partida.

---

## 2. Arquitectura

### 2.1 Árbol de archivos propuesto

```
docs/style-lab/
  fiesta.html                 # página del modo (carga motor + bus + juegos + fiesta-*)
  fiesta-rng.js               # mulberry32 + withSeed para el laboratorio (sin dependencias)
  fiesta-reglas.js            # LÓGICA PURA: estado, turnos, economía, casillas, objetos, bonus. Sin canvas. Corre en Node.
  fiesta-mapa-venezuela.js    # DATOS: grafo del tablero (nodos, aristas, regiones, rutas, eventos)
  fiesta-cpu.js               # políticas de la CPU (rutas, compras, objetos). Puro, corre en Node.
  fiesta-camara.js            # cámara: mundo→pantalla, pan, zoom, seguir ficha, vista general, culling
  fiesta-tablero.js           # dibujo del mapa (capa estática cacheada + capa dinámica: fichas, estrella, trampas)
  fiesta-entrada.js           # enrutador de entrada por jugador (slots): teclado, touch por pointerId, gamepad
  fiesta-ui.js                # HUD, menús, tarjetas, ruleta, tienda, podio (copiado/extraído de campana.js)
  fiesta-minijuegos.js        # orquestador: ronda de 5, asignación 4P/1v3/2v2, ranking, pagos, minijuego largo
  fiesta-guardar.js           # serializar/restaurar en localStorage, versión de esquema
  fiesta-main.js              # máquina de estados principal (tick/render), une todo
  juego-f-*.js                # minijuegos EXCLUSIVOS del modo (multi-jugador); prefijo f- para no mezclarlos
  juego-jefe-f-*.js           # minijuegos largos exclusivos
  pruebas/bots/f-*.js         # bots de probar.js para los exclusivos
  pruebas/simular.js          # simulador headless de partidas completas (Node puro)
test/
  fiesta-reglas.test.js       # node:test sobre fiesta-reglas.js
  fiesta-mapa.test.js         # validación del grafo (conexo, sin callejones, distancias)
  fiesta-guardar.test.js      # ida y vuelta del guardado
  fiesta.e2e.js               # Playwright: partida 4 CPU completa a velocidad x, sin errores
  fiesta-viewport.e2e.js      # Playwright: cámara, toques y HUD en 4 tamaños de pantalla
docs/mario-party/
  mapa-venezuela.svg          # draft del mapa (ver doc 05, por verificar el nombre)
```

**Por qué `fiesta-*.js` y no `juego-*.js`:** el glob de `sync-world-assets.sh` (`juego-*.js`) se usa también como «lista de microjuegos» mental; mezclar el núcleo del modo con los juegos confunde. En M0 se añade una línea al script:

```sh
cp "$source_dir"/fiesta-*.js "$source_dir/fiesta.html" "$target_dir/"
```

Los minijuegos exclusivos sí usan `juego-f-*.js` para que el glob existente los copie y para que `probar.js --todos` los cargue al cazar interferencias.

### 2.2 Orden de carga en `fiesta.html`

```
engine.js → juegos-bus.js → juego-*.js (los 40 + juego-f-*) → ../../js/eggs.js
→ fiesta-rng.js → fiesta-reglas.js → fiesta-mapa-venezuela.js → fiesta-cpu.js
→ fiesta-camara.js → fiesta-tablero.js → fiesta-entrada.js → fiesta-ui.js
→ fiesta-minijuegos.js → fiesta-guardar.js → fiesta-main.js
```

- Igual que `campana.js` (`:541-554`), `fiesta-main.js` reemplaza `tick`, `hud` y `paintFrame` del motor. **No** se carga `campana.js` en esta página: así no hay dos máquinas de estado peleando por el mismo `tick`.
- La lista de `juego-*.js` hoy está duplicada a mano en `jugar.html` (línea 14) y `public.html` (41 scripts). Propuesta M0: generar un `juegos-lista.js` con `window.JUEGOS_LISTA=[...]` desde un script, y que las tres páginas lo usen. Si el usuario prefiere no tocar esas páginas, `fiesta.html` mantiene su propia lista (riesgo: olvidarse de añadir un juego).
- Todos los módulos de la fiesta se cuelgan de **un solo global** `window.FIESTA = {rng, reglas, mapa, cpu, cam, tablero, entrada, ui, mj, guardar}` para no sumar nombres sueltos al espacio global (riesgo ya señalado en `campana.js:30`).
- `fiesta-reglas.js`, `fiesta-rng.js`, `fiesta-mapa-venezuela.js` y `fiesta-cpu.js` terminan con `if(typeof module!=='undefined')module.exports=...` para correr en Node sin navegador.

### 2.3 Enlace con la campaña y el mundo Venezuela

- **Desde el menú del mundo Venezuela:** botón nuevo «LA FIESTA (1-4)» en el menú de `campana.js` que hace `location.assign('fiesta.html'+location.search)`. Es un cambio de 3-5 líneas en `campana.js`, se hace **después** de que la rama actual esté comiteada (riesgo R1).
- **En producción:** `worlds/venezuela/fiesta.html`. `campana.js:36` detecta `PUBLIC` por la ruta; `fiesta-main.js` usa la misma prueba para el botón «volver».
- **Persistencia compartida:** la campaña guarda en `minicaos-lab-niveles-v1`. LA FIESTA usa su propia clave y solo **lee** las estrellas de campaña para desbloqueos opcionales (por ejemplo, un avatar extra). No escribe en la clave de la campaña.

---

## 3. Máquina de estados

### 3.1 Estados de nivel superior (`fiesta-main.js`)

```
TITULO → CONFIG → INTRO → [ BUCLE DE RONDA ] → FINAL → PODIO → (TITULO | REVANCHA)
                       ↘ (si hay guardado) REANUDAR ↗
```

### 3.2 Bucle de ronda (una ronda = los 4 jugadores mueven una vez)

```
RONDA_INICIO
  ├─ si ronda == total-4  → EVENTO_ULTIMAS5 (anuncio + ruleta del último lugar / voto)
  ├─ si ciclo de región    → EVENTO_GLOBAL (apagón/luz, marea, Bowser-equivalente cada N rondas)
  └─ para cada jugador en orden:
       TURNO_INICIO   (pantalla «pásale el teléfono a X» si hay >1 humano y el modo es pasar-el-teléfono)
       PRE_DADO       (usar objeto: 0..1 por turno; tienda remota si tiene el objeto)
       TIRAR          (dado 1-10 o dados de objeto; toque/tecla para parar)
       MOVER          (paso a paso; en cada nodo: PASO_POR → eventos «al pasar»: estrella, banco, peaje, tienda, buhonero)
         └─ CRUCE     (elegir rama; la CPU decide por política)
         └─ DECISION  (comprar estrella / pagar peaje / comprar en tienda / subir al ferry)
       CASILLA        (efecto de la casilla donde cayó; puede lanzar duelo o minijuego de 1 jugador)
       TURNO_FIN      (autosave)
RONDA_MINIJUEGOS
  ├─ ASIGNAR_TIPO     (por color de casilla: 4P / 1v3 / 2v2; duelo si lo disparó una casilla)
  ├─ RONDA_RAPIDA x5  (TARJETA → JUGAR (secuencial o simultáneo) → RESULTADO) 
  ├─ PAGOS            (monedas por puesto + bono de la ronda)
  └─ si toca          → MINIJUEGO_LARGO (jefe/reto exclusivo, ver 7.3)
RONDA_FIN → si ronda < total → RONDA_INICIO, si no → FINAL
FINAL: BONUS_ESTRELLAS (revelación una por una) → DESEMPATE → PODIO
```

### 3.3 Implementación

- Estado = objeto plano `S` (sección 4.3). La máquina guarda `S.fase` (string) y `S.sub` (datos de la fase). Ninguna función vive en `S`.
- Las transiciones están en `fiesta-reglas.js` como funciones puras: `aplicar(S, accion) → {S2, efectos[]}`. `efectos` son descripciones de animaciones/sonidos (`{tipo:'monedas', jugador:2, delta:-3}`) que `fiesta-main.js` reproduce en orden. Esto separa reglas y presentación y permite:
  - simular sin animaciones (Node),
  - acelerar (botón «adelantar» que salta animaciones, pedido recurrente de la crítica a MP4/MP8/Jamboree),
  - repetir una partida desde la semilla y la lista de acciones (depuración).
- Acciones del jugador: `{tipo:'tirar'}`, `{tipo:'elegirRama', a:'n123'}`, `{tipo:'comprarEstrella', si:true}`, `{tipo:'usarObjeto', slot:0, objetivo:2}`, `{tipo:'comprar', item:'arepa'}`, `{tipo:'resultadoMJ', ranking:[...]}`.
- La aleatoriedad del tablero sale **solo** de `S.rng` (estado de mulberry32 guardado en `S`), nunca de `Math.random`.

---

## 4. Formato de datos

### 4.1 Mapa (`fiesta-mapa-venezuela.js`)

Coordenadas de **mundo** en un lienzo de 4000×3000 unidades (Norte arriba). El doc de geografía usa x,y 0-100: se escalan ×40 en x y ×30 en y.

```js
FIESTA.MAPAS.venezuela = {
  id: 'venezuela', nombre: 'VENEZUELA ENTERA', version: 1,
  mundo: { w: 4000, h: 3000 },
  inicio: 'ccs-00',                          // nodo de salida (Caracas)
  estrellaCandidatos: ['mcbo-07','mer-04','coro-03','mch-05','apu-06','gua-09','roq-02'],
  regiones: {
    centro:   { nombre:'EL CENTRO',       col:'#f2b134', musica:'salsa',  nodos:['ccs-00','...'] },
    zulia:    { nombre:'EL ZULIA',        col:'#e4572e', musica:'gaita' },
    andes:    { nombre:'LOS ANDES',       col:'#76b041', musica:'bambuco'},
    llanos:   { nombre:'EL LLANO',        col:'#d9a441', musica:'joropo' },
    oriente:  { nombre:'ORIENTE',         col:'#17bebb', musica:'calipso'},
    guayana:  { nombre:'GUAYANA',         col:'#2e8b57', musica:'calipso'},
    delta:    { nombre:'DELTAMACURA',     col:'#7b2cbf', musica:'raro',  reglas:'caos' }
  },
  nodos: {
    'ccs-00': { x:2080, y:660, tipo:'inicio', region:'centro', sig:['ccs-01'] },
    'ccs-01': { x:2120, y:690, tipo:'azul',   region:'centro', sig:['ccs-02'] },
    'ccs-02': { x:2160, y:700, tipo:'cruce',  region:'centro', sig:['lgu-00','vla-00','bar-00'] },
    'mer-03': { x: 820, y:1080, tipo:'evento', region:'andes', evento:'frio', sig:['mer-04'] },
    'mer-tf': { x: 860, y:1050, tipo:'teleferico', region:'andes', sig:['mer-05'],
                ruta:{ a:'mer-pe', costo:10, salta:6 } },          // atajo pago
    'pza-01': { x:2950, y:1320, tipo:'peaje', region:'guayana', sig:['pza-02'],
                peaje:{ base:1, sube:1, tope:15 } },               // tipo Thwomp de Yoshi's Tropical Island (MP1)
    'dlt-00': { x:3600, y: 900, tipo:'deltamacura', region:'delta', sig:['dlt-01'] }
    // ...
  },
  rutas: [ // conexiones especiales que no son pasos normales
    { id:'avioneta-roques', de:'lgu-03', a:'roq-00', costo:15, tipo:'avion' },
    { id:'ferry-margarita', de:'plc-02', a:'mgt-00', costo:5,  tipo:'ferry', ida_vuelta:true },
    { id:'metro-ccs',       de:'ccs-05', a:'ccs-12', costo:3,  tipo:'tren', direccion:'dado' }
  ],
  ciclos: [ { id:'luz', cada:3, estados:['luz','apagon'], afecta:['zulia','guayana'] } ],
  decor: [ { tipo:'tepuy', x:3300, y:2300, s:1.4 }, { tipo:'lago', x:520, y:700, poly:[...] } ]
};
```

Reglas del formato (validadas por `test/fiesta-mapa.test.js`):

| Regla | Valor |
|---|---|
| Ids | `<región3>-<nn>`; únicos |
| `sig` | 1 a 3 salidas; >1 implica `tipo:'cruce'` o un cruce implícito |
| Grafo | fuertemente conexo (desde cualquier nodo se vuelve a cualquier otro) |
| Callejones | ninguno; el sentido es de una vía salvo `ida_vuelta` |
| Distancia entre nodos | 70-140 unidades de mundo (legibilidad con zoom 1) |
| Tamaño objetivo | MVP M1: 60 nodos; M4: 160-220 nodos (por verificar con playtest; un MP clásico tiene unos 60-80 por tablero) |
| Proporción de casillas (M4, inicial) | azul 45 %, roja 12 %, evento 12 %, objeto 6 %, duelo/VS 4 %, «Alcabala» (equivalente a Bowser) 4 %, «¡Cambio!» (Chance Time) 2 %, banco 2 %, especiales/peajes/rutas 13 % |
| Candidatos de estrella | ≥ 1 por región, siempre en casilla azul, a ≥ 15 pasos del inicio |

### 4.2 Catálogos (en `fiesta-reglas.js`, datos, no lógica)

```js
CASILLAS = { azul:{monedas:+3}, roja:{monedas:-3}, evento:{}, objeto:{}, duelo:{}, alcabala:{}, cambio:{}, banco:{pasar:-3}, ... }
OBJETOS  = { arepa:{precio:5, tipo:'dado', efecto:'+3'}, tequeno:{precio:8, tipo:'ataque', ...}, ... }  // ver doc de mecánicas
BONUS    = { rico:{stat:'monedasGanadas'}, ganador:{stat:'victoriasMJ'}, caminante:{stat:'pasos'}, pelao:{stat:'casillasMalas'}, ... }
CONFIG_DEFECTO = { turnos:15, monedasInicio:10, precioEstrella:20, bonus:'visibles2+1oculta', ultimas:5, reglas:'normal' }
```

Los números son el **punto de partida**; el simulador (sección 8.2) los ajusta.

### 4.3 Estado de partida `S` (serializable)

```js
{
  v: 1,                         // versión de esquema
  semilla: 123456, rng: 987654, // estado mulberry32
  mapa: 'venezuela', config: {...},
  ronda: 7, fase: 'MOVER', sub: { jugador:2, pasosRestantes:4, camino:['ccs-03','ccs-04'] },
  orden: [2,0,3,1],
  jugadores: [
    { id:0, nombre:'PANA 1', humano:true, cpu:null, avatar:{shirt:'#e33',skin:2,hair:1},
      nodo:'mer-04', monedas:23, estrellas:2, objetos:['arepa',null,null],
      estado:{ arrecho:0, pelao:false, maldito:null },
      stats:{ monedasGanadas:61, victoriasMJ:4, pasos:58, casillasMalas:3, eventos:5, objetosUsados:2, compras:3, ataques:1, sumaDados:41 } },
    ...
  ],
  estrella: { nodo:'apu-06', precio:20 },
  tablero: { peajes:{'pza-01':4}, banco:{'ccs-09':12}, trampas:[{nodo:'mcbo-03', de:1, tipo:'tequeno'}], ciclo:{luz:'apagon', resta:2} },
  historial: [ ... ],            // últimas 200 acciones (para depurar y para la ceremonia final)
  mj: { tipoRonda:'1v3', equipos:[[2],[0,1,3]], cola:['tequenos','baile',...], hechos:[...] }
}
```

---

## 5. Entrada: hot-seat y simultáneo, teclado y móvil

### 5.1 Modos de control (se elige en CONFIG)

| Modo | Tablero | Minijuegos rápidos | Minijuego largo | Para qué dispositivo |
|---|---|---|---|---|
| **A. Pasar el teléfono** (por defecto en teléfono) | hot-seat | secuencial: cada humano juega su intento, pantalla «turno de X» entre intentos | secuencial por fases | teléfono 1 dispositivo |
| **B. Tele / laptop** | hot-seat | simultáneo si el juego lo soporta, si no secuencial | simultáneo | laptop + 2 teclados lógicos o gamepads |
| **C. Tablet en la mesa** | hot-seat | simultáneo con 2-4 zonas táctiles (esquinas/lados) | simultáneo | tablet ≥ 9" |

La regla: **un juego viejo (single-player) siempre corre en secuencial**; solo los `juego-f-*` declaran `multi:true` y pueden correr simultáneos.

### 5.2 Enrutador de entrada por jugador (`fiesta-entrada.js`)

Problema (scout): `keys`, `heldK`, `heldP`, `ptr`, `lastP` y `steer()` son únicos y globales (`juegos-bus.js:19-41`), y `pointerId` se ignora.

Diseño:

```js
FIESTA.entrada = {
  modo: 'secuencial' | 'simultaneo',
  slots: [ {jugador:0, fuente:'teclado:A'}, {jugador:1, fuente:'teclado:B'}, {jugador:2, fuente:'touch:zona2'}, {jugador:3, fuente:'pad:0'} ],
  // API hacia los juegos multi:
  press(slot,k), held(slot) -> {l,r,u,d,a}, steer(slot) -> -1..1, punteros(slot) -> [{x,y,down}]
}
```

| Fuente | Mapeo | Límite |
|---|---|---|
| Teclado grupo A | W/A/S/D + Espacio (acción) | 2 jugadores por teclado por *ghosting* |
| Teclado grupo B | Flechas + Enter | idem |
| Teclado C/D (opcional) | I/J/K/L + U ; Numpad 8/4/5/6 + 0 | depende del teclado (por verificar en hardware real) |
| Touch | `Map<pointerId, slot>` asignado por la **zona** donde empezó el toque; zonas = 2 mitades (teléfono horizontal) o 4 cuadrantes (tablet) | teléfono 844×390: máximo 2 zonas recomendables |
| Gamepad | `navigator.getGamepads()` sondeado en `tick`; botón A = acción, stick/cruceta = dirección | el navegador solo los expone tras pulsar un botón: pantalla «pulsa A para unirte» |

Reglas de convivencia con el motor:

- En modo **secuencial** el enrutador no interviene: el juego viejo recibe la entrada global de siempre (`press`, `down/move/up`, `steer`). Así los 40 juegos funcionan **sin cambios**.
- En modo **simultáneo** el enrutador consume los eventos (`stopPropagation` en captura) y los reparte; el `G` multi recibe `G.pressSlot(slot,k)` etc.
- Se desactivan durante la partida: `Digit1-9` (cambian estilo, `engine.js:1009`), `Escape` (sale), `M` (mute) solo funciona desde el menú de pausa. El botón de pausa es un toque largo de 0,6 s en la esquina, para que un jugador no saque a la mesa entera.
- Se desactiva la síntesis «swipe → flecha» en zonas táctiles multi (choca con las zonas).

### 5.3 Turno en el tablero (hot-seat)

- Un solo botón grande «¡TIRA!» (toque o Espacio/Enter/A de **cualquier** fuente; en modo B se acepta solo la fuente del jugador activo).
- Cruces: flechas grandes sobre la pantalla en los nodos siguientes; toque en la flecha o izquierda/derecha.
- Tiempo máximo por decisión (opcional, por defecto apagado): 15 s, luego decide la CPU. Objetivo de pacing: **60-90 s por turno de jugador** incluyendo animaciones (dato de la investigación de diseño).

### 5.4 CPU (`fiesta-cpu.js`)

- 3 niveles: «Chamo» (aleatorio con sesgo), «Pana» (codicioso: va a la estrella, compra si tiene 20+), «Arrecho» (planifica 2 turnos con distancias pre-calculadas, usa ataques contra el líder).
- Distancias: BFS desde cada nodo a cada candidato de estrella, precalculado al cargar el mapa (220 nodos → 48.400 entradas, trivial).
- En minijuegos la CPU **no juega** el microjuego: su resultado se tira con una distribución por nivel (por ejemplo «Pana» gana 55 %) y con tiempo simulado. En juegos `multi` se pueden usar los bots de `probar.js` como IA real más adelante (por verificar viabilidad).
- Los turnos de la CPU se animan a 2× y se pueden saltar (queja n.º 1 de MP4/MP7: esperar a la CPU).

---

## 6. Minijuegos: contrato, ranking y orquestación

### 6.1 Contrato extendido (compatible hacia atrás)

```js
// Juego viejo (sin cambios): result 'win'|'lose', G.t, G.dur
// Juego de fiesta (juego-f-*.js):
BUS.add('f-pipa', { name:'LA PIPA', mk, card, fiesta:{ tipos:['4p','2v2'], multi:true, dur:30, largo:false } });
// mk({jugadores:[0,1,2,3], equipos:[[0,1],[2,3]], semilla, nivel}) devuelve g con:
g.result      // null hasta terminar; luego 'fin'
g.puntos      // [p0,p1,p2,p3] numéricos (más es mejor) o
g.ranking     // [[2],[0,3],[1]] puestos con empates
g.pressSlot(slot,k), g.downSlot(slot,p), g.moveSlot(slot,p), g.upSlot(slot,p)  // entrada por jugador
g.probe()     // como hoy, más probe().porJugador para el banco
```

### 6.2 Cómo rankear un juego viejo (binario) en modo secuencial

Cada jugador juega **el mismo** microjuego con la **misma semilla** (`withSeed(semilla, ()=>GAMES[id].mk())`, parcheando `Math.random` durante `mk()` y durante el juego).

| Resultado | Puntuación |
|---|---|
| Ganó | `1000 + round((1 - G.t/G.dur) * 500)` (premia ganar rápido; misma idea que `campana.js:308`) |
| Perdió | `round(G.t/G.dur * 100)` (aguantó más = mejor perdedor) o `g.probe().avance` si el juego lo expone |
| Empate exacto | puesto compartido |

Riesgo: juegos donde ganar depende de esperar al final de la mecha (todos ganan en el mismo `t`). Se marcan `rankTiempo:false` en `card` y se rankean por `probe()` o quedan como empate. Auditoría de los 40 juegos en M2 (por verificar cuántos caen en este caso).

### 6.3 Asignación del tipo de ronda (por color de casilla, como MP1-SMP)

| Colores al final de la ronda | Tipo |
|---|---|
| 4 iguales | 4P (todos contra todos) |
| 3 + 1 | 1v3 (el distinto es el solitario) |
| 2 + 2 | 2v2 |
| Casilla verde/evento | se vuelve azul o roja al azar antes de asignar |

Con juegos viejos en secuencial: 1v3 = el solitario contra el **mejor** de los tres (o contra la suma normalizada; por decidir en playtest); 2v2 = suma de puntuación por equipo.

### 6.4 La ronda de 5 rápidos (pedido explícito del usuario)

| Parámetro | Valor inicial |
|---|---|
| Microjuegos por ronda | 5 seguidos, sin volver al tablero |
| Duración de cada uno | la de siempre (5-8 s × velocidad) + tarjeta 1,4 s + resultado 1,2 s |
| Duración total, secuencial con 4 humanos | 5 × 4 × ~9 s ≈ **3 min** (demasiado: ver mitigación) |
| Duración total, simultáneo | 5 × ~10 s ≈ **50 s** |
| Mitigación en secuencial | con 3-4 humanos, la ronda baja a **3** microjuegos (configurable) o se juega «relevo»: cada microjuego lo juega solo un representante por equipo |
| Selección | 5 distintos, sin repetir en las últimas 3 rondas (como el `recent` de `beginGame`) |
| NIVEL | 1 en rondas 1-5, 2 en 6-10, 3 en 11+ |
| Pago por microjuego | 1.º 3 monedas, 2.º 2, 3.º 1, 4.º 0 (4P); equipo ganador 3 c/u (2v2); solitario 1v3 gana 6 o los tres ganan 2 c/u |
| Bono de la ronda | quien sume más puntos en los 5: +5 monedas («¡El rey de la rumba!») |
| Máximo teórico por ronda | 15 + 5 = 20 monedas = 1 estrella (por verificar con el simulador: puede ser demasiado) |

### 6.5 El minijuego largo exclusivo («EL RETO»)

- Plantilla: jefe multifase (`FASES`), 60-150 s, 3 fases con dificultad creciente.
- Formato preferido: **cooperativo con puntuación individual** (MP9: todos contra el jefe, el que da el golpe final gana extra) o **1v3 asimétrico** (inspirado en Bowser Party de MP10).
- Cuándo: cada 4 rondas del tablero y siempre en la ronda de mitad de partida (por decidir: ver preguntas abiertas), y como final opcional antes de los bonus.
- Premio: 1.º 15 monedas, 2.º 8, 3.º 4, 4.º 0; si el equipo pierde contra el jefe, nadie cobra y el jefe «se lleva» 5 monedas a cada uno.
- Primeros candidatos (M5): «DELTAMACURA» (el mapa se rearma, reglas cambian cada fase), «SALTO ÁNGEL» (caída libre esquivando, 3 tramos), «LA COLA» (1v3: uno se cuela, tres vigilan). Reusar los jefes existentes (`alcabala`, `metro`, `arepa`, `transformador`) como «EL RETO» en modo secuencial desde M2.

### 6.6 Duelos y casillas de 1 jugador

- Duelo (2 jugadores): lo dispara una casilla de duelo o caer en la misma casilla en los últimos 5 turnos. Apuesta elegida por ruleta (5/10/20 monedas o 1 estrella con el objeto «Guante»).
- Casilla de 1 jugador: un microjuego viejo normal; gana +5, pierde -3 (MP1: -5).

---

## 7. Cámara, mapa enorme y rendimiento

### 7.1 Cámara (`fiesta-camara.js`)

```js
cam = { x, y, zoom, objetivo:{x,y,zoom}, modo:'seguir'|'libre'|'general' }
mundoAPantalla(wx,wy) = { sx:(wx-cam.x)*cam.zoom + GAME_VIEW.width/2 + gameLeft(), sy:(wy-cam.y)*cam.zoom + 300 }
```

- Dibujo: `ctx.save(); ctx.translate(...); ctx.scale(zoom,zoom);` alrededor de las primitivas. **Por verificar:** que las primitivas de cada estilo (sobre todo los que pintan a buffers bajos: snes, gb, ps1, pixel, xstitch) respeten la transformación activa y que `PT`/partículas no asuman coordenadas fijas 800×600. Prueba de humo en M1.
- Zoom: rango 0,35 (vista general de todo el país) a 1,6. Por defecto 1,0 siguiendo la ficha.
- Gestos: un dedo arrastra (pan), dos dedos pellizcan (zoom), doble toque = vista general / volver. Rueda del ratón = zoom; arrastrar con el ratón = pan. Teclas `Z`/`X` zoom.
- Automatismos: seguir la ficha con suavizado (lerp 8/s); al moverse la estrella, **vista general** 1,5 s mostrando el nuevo lugar (Superstars lo hace y se valoró); al usar un ataque, panear a la víctima.
- Vuelve a «seguir» 3 s después de que el jugador suelte el pan.
- Minimapa opcional en la esquina (silueta del país + puntos de colores), 120×90 px.

### 7.2 Rendimiento

| Técnica | Detalle |
|---|---|
| Capa estática cacheada | Costa, ríos, lago, tepuyes, caminos y casillas se pintan **una vez** a un canvas fuera de pantalla por (estilo, nivel de zoom en 3 escalones: 0,5 / 1 / 1,5) en teselas de 1024×1024. Se regeneran al cambiar estilo o ciclo de luz |
| Capa dinámica | Fichas, estrella, trampas, carteles de peaje, partículas: cada cuadro |
| Culling | Solo teselas y nodos dentro del rectángulo visible + 1 tesela de margen |
| Presupuesto | ≤ 6 ms por cuadro de dibujo del tablero en un teléfono medio (por verificar con medición real en M1) |
| Estilos de baja resolución | El tablero en snes/gb usa su buffer pequeño como hoy; aceptar el pixelado como parte del look |
| Memoria | 4000×3000 a escala 1,5 → ~12 teselas visibles de 1024² ≈ 50 MB en RGBA en el peor caso: limitar la caché a 24 teselas y descartar las más viejas |

### 7.3 Arte del mapa

- Fuente vectorial: el SVG del draft (doc 05 / `/design`) se convierte a datos de polígonos (`decor`, costa, ríos) en `fiesta-mapa-venezuela.js`, y se dibuja con `poly`/`line` del motor para que herede los estilos. No se usa `<img>` del SVG en el juego (no heredaría las 6 estéticas).
- Herramienta (M4): `scripts/fiesta-svg-a-mapa.js` que lee el SVG (paths con `id` = región / nodo) y escribe el JSON de nodos y decor. **Por verificar** si vale la pena frente a editar a mano.

---

## 8. Guardado, RNG y reproducibilidad

- `fiesta-rng.js`: `mulberry32(seed)` con estado exportable; `withSeed(seed, fn)` sustituye `Math.random` durante `fn` y lo restaura (mismo patrón que `js/core.js`, reescrito sin importar `core.js`).
- Guardado: `localStorage['minicaos-fiesta-v1'] = JSON.stringify(S)` al final de cada turno y de cada ronda de minijuegos. Todo `try/catch`: si falla (modo privado), la partida sigue sin guardado y se muestra un aviso pequeño.
- Tamaño estimado: < 40 KB con historial de 200 acciones.
- Versión de esquema `S.v`; si cambia, se ofrece «empezar de nuevo» (sin migraciones antes de M6).
- REANUDAR en TITULO si hay guardado con `fase !== 'PODIO'`.
- Reproducción: `semilla + lista de acciones` regenera la partida exacta; el botón oculto «copiar partida» en pausa copia ese JSON para reportar bugs.

---

## 9. Integración con BUS, campaña, estilos y huevos

| Punto | Cómo |
|---|---|
| Registro de juegos | `BUS.add` igual que hoy; la fiesta filtra `GAMES` por `card.fiesta` o por una lista blanca `FIESTA.POOL_RAPIDO` (los 40 viejos que rankean bien) |
| Reparto | Avatares: 4 presets `bust()` (camisas roja, azul, verde, amarilla; pelo/piel elegibles). Anfitriones: abuela = vende estrellas; mamá = «La chancla» (castiga al líder o al último, según evento); tío = consejero que miente; pana = tienda (ver memoria del reparto compartido) |
| Escenarios | `AP.sala/cocina/barrio/oscuro` como fondos de tarjetas de evento y de la tienda |
| Estilo | El jugador elige estilo en CONFIG (mismas teclas no; botón). MEZCLA = cambia por región |
| Luz | Ciclo «luz/apagón» del tablero usa el tinte `NIV` de noche; últimos 5 turnos = atardecer |
| `window.NIVEL`, `SP` | Fijados por `fiesta-minijuegos.js` antes de cada `mk()`, restaurados después |
| `hud` | Suprimido como en la campaña; la fiesta pinta su propio HUD |
| EGGS | `EGGS.begin(id)` y `EGGS.outcome(id, 'win'|'lose')` por cada intento de microjuego (en secuencial, por jugador humano); `EGGS.stage()` al empezar la partida; `EGGS.clear()` en el podio |
| Música | Salsa procedural con tonalidad por región. Si `startMusic` no se puede llamar desde fuera de `campana.js`, copiar la función a `fiesta-ui.js` (por verificar) |

---

## 10. Estrategia de pruebas

### 10.1 Pirámide

| Nivel | Herramienta | Qué cubre | Cuándo corre |
|---|---|---|---|
| Unidad (Node) | `node --test test/fiesta-*.test.js` | reglas puras: casillas, compra de estrella, peajes que suben, banco, objetos, ataques, últimas 5, bonus y desempates, guardado ida/vuelta | cada cambio de reglas |
| Datos (Node) | `test/fiesta-mapa.test.js` | grafo conexo, sin callejones, ids únicos, distancias 70-140, candidatos de estrella válidos, proporción de casillas ±5 % | cada cambio del mapa |
| Simulación (Node) | `node docs/style-lab/pruebas/simular.js --partidas=10000 --turnos=15` | balance (ver 10.2) | antes de cerrar cada hito |
| Minijuego (navegador sin ventana) | `probar.js <id>` con bots | cada `juego-f-*` en todos los estilos y niveles; rutas gana/pierde/nada | cada minijuego nuevo |
| Integración (Playwright) | `test/fiesta.e2e.js` | partida de 4 CPU, 15 turnos, adelantada; 0 `pageerror`; termina en PODIO; guardar → recargar → reanudar en el mismo turno | cierre de hito |
| Viewport (Playwright) | `test/fiesta-viewport.e2e.js` (copia de `world-viewport.e2e.js`) | 4 tamaños (844×390, 932×360, 1280×800, 1920×1080), DPR 1 y 3: el HUD no se corta, los toques en flechas de cruce y botón TIRA caen donde se ven, pan/pellizco mueven la cámara | cierre de hito |
| Multi-touch | dentro de `fiesta-viewport.e2e.js` | dos `pointerId` (1 y 2) simultáneos en zonas distintas llegan a slots distintos (`mobile.e2e.js:122` ya usa `pointerId:2`) | M5 |

### 10.2 Simulador de balance (la pieza más valiosa)

`simular.js` carga `fiesta-rng.js`, `fiesta-reglas.js`, `fiesta-mapa-venezuela.js` y `fiesta-cpu.js` en Node y juega partidas completas con 4 CPU; los minijuegos se resuelven con probabilidades por nivel de CPU.

Métricas y metas iniciales (por verificar en playtest humano):

| Métrica | Meta |
|---|---|
| Estrellas compradas por partida de 15 turnos (las 4 CPU juntas) | 8-14 |
| Estrellas del ganador antes de bonus | 3-6 |
| % de partidas donde el bonus cambia al ganador | 15-30 % (más = se siente arbitrario; menos = no hay drama) |
| % de partidas ganadas por el líder de la ronda 10 | 45-65 % |
| % de victorias del CPU «Pana» frente a 3 «Chamo» | 40-55 % (la habilidad pesa pero no decide sola) |
| Monedas medias al final | 10-40 (si sobran >60, la estrella es barata o faltan sumideros) |
| Turnos con 0 decisiones (sin cruce, sin tienda, sin objeto) | < 35 % |
| Veces que un jugador queda en 0 monedas 3 turnos seguidos | < 5 % de jugadores |
| Duración simulada (con tiempos de animación nominales) | 25-40 min a 15 turnos |

El simulador imprime una tabla por parámetro barrido (`--barrer=precioEstrella:15,20,25`) para elegir números con datos.

### 10.3 Bots de `probar.js` para juegos multi

Hoy `T` maneja un solo jugador (`T.key`, `T.hold`, `T.down` con `pointerId:1`). Extensión propuesta (M5), sin romper los bots existentes:

```js
T.slot(n)              // devuelve una T ligada al slot n: T.slot(2).key('Space'), T.slot(1).hold(0,1), T.slot(3).tap(x,y)
BOTS['f-pipa'] = { gana0(T){...}, gana2(T){...}, empate(T){...}, nada:'fin' }
// rutas 'ganaN' deben terminar con el jugador N en primer puesto
```

Y `probar.js --fiesta` inyecta un `FIESTA.entrada` en modo simultáneo. Riesgo conocido: las rutas de Playwright están fijadas a `~/.npm/_npx` y `~/Library/Caches/ms-playwright` (no corre en CI tal cual); no se arregla en este plan, solo se documenta.

### 10.4 Revisión manual

Según la memoria del proyecto, el usuario revisa él mismo cada construcción del laboratorio: cada hito entrega una URL local (`docs/style-lab/fiesta.html?semilla=…&debug=1`) y una lista corta de «qué mirar».

---

## 11. Hitos M0 a M6

Estimaciones en días de trabajo efectivo (por verificar; dependen de cuánto arte nuevo se quiera).

### M0 · Fundaciones (2-3 días)

| Entregable | Criterio de aceptación |
|---|---|
| Rama nueva `fiesta/m0` creada **después** de comitear o aparcar la rama actual | 0 conflictos con los 48 archivos modificados |
| `fiesta.html` vacía que carga motor, bus, juegos, eggs y los `fiesta-*.js` vacíos | abre sin errores de consola |
| `fiesta-rng.js` + test | misma semilla ⇒ misma secuencia; `withSeed` restaura `Math.random` |
| Esqueleto de `fiesta-reglas.js` con `S` inicial y `aplicar()` | test: crear partida de 4, avanzar fases vacías |
| Línea nueva en `sync-world-assets.sh` | `fiesta.html` y `fiesta-*.js` aparecen en `worlds/venezuela/` |
| Decisiones cerradas de la sección 13 (al menos P1-P5) | anotadas en este doc |

### M1 · Tablero gris jugable (5-7 días)

| Entregable | Criterio |
|---|---|
| Mapa de prueba de 60 nodos con silueta simple de Venezuela y 3 cruces | `fiesta-mapa.test.js` verde |
| Turnos hot-seat 2-4 jugadores, dado 1-10, movimiento paso a paso, cruces | se juega una partida de 10 turnos de principio a fin |
| Casillas azul/roja, compra de estrella al pasar (20), estrella que se muda | test de reglas verde |
| Cámara: seguir, pan, pellizco, vista general al moverse la estrella | prueba manual en teléfono + `fiesta-viewport.e2e.js` básico |
| Guardado/reanudar | recargar a mitad de partida vuelve al mismo turno |
| CPU «Chamo» y «Pana» | partida de 4 CPU termina sola |
| `simular.js` v1 | imprime métricas de 10.2 |
| Medición de rendimiento del tablero en los 6 estilos | ≤ 6 ms o lista de estilos problemáticos |

### M2 · Ronda de minijuegos (4-6 días)

| Entregable | Criterio |
|---|---|
| Orquestador: asignación 4P/1v3/2v2 por color, ronda de 5 (o 3) rápidos en **secuencial** con semilla compartida | 4 humanos juegan una ronda completa |
| Ranking de juegos viejos (6.2) y auditoría de los 40 (`rankTiempo`) | tabla de la auditoría anexa al doc |
| Pagos por puesto + bono de ronda | test de reglas |
| Pantallas «pásale el teléfono a X» | probado en teléfono |
| «EL RETO» v0 usando un jefe existente en secuencial | jugable cada 4 rondas |
| EGGS conectados | `test/eggs.test.js` sigue verde |

### M3 · Economía, objetos e interactividad (7-10 días)

| Entregable | Criterio |
|---|---|
| Tienda (bodega/bodegón/buhonero), 3 ranuras de objeto, 10-14 objetos (movimiento, dado, robo, trampa, defensa) | cada objeto con test de reglas |
| Ataques: trampas colocadas a ±2-5 casillas, robo de monedas, robo de objeto, «Guante» de duelo | el atacante es inmune a su trampa (lección de MP6) |
| Interactividad pagada: peaje que sube (alcabala), teleférico/avioneta/ferry, metro con dado de dirección, banco («la vaca») | cada ruta con test |
| Casillas especiales: evento, «Alcabala» (equivalente a Bowser), «¡Cambio!» (equivalente a Chance Time) con restricciones por turno, duelo | tests + revisión de tono |
| Últimos 5 turnos: dobles, ruleta/voto del último lugar, predicción del narrador | test |
| Bonus finales: 2 visibles anunciados al inicio + 1 oculto «chistoso», reglas de empate y mínimos | test de cada estadística |
| Reglas «Normal» y «Pro» (12 turnos, sin «¡Cambio!», bonus anunciado) | seleccionables en CONFIG |
| Barrido de balance con el simulador | métricas de 10.2 dentro de rango o justificadas |

### M4 · Mapa de Venezuela completo y arte (8-12 días)

| Entregable | Criterio |
|---|---|
| Mapa de 160-220 nodos con 6-7 regiones, rutas de autopista, costa, aire, mar y río | test del mapa verde; partida de 15 turnos visita ≥ 4 regiones en promedio (simulador) |
| Una mecánica firma por región (ej.: Zulia ciclo luz/apagón + Rayo del Catatumbo; Andes teleférico + frío; Llanos crecida del río; Guayana Salto Ángel estrella cara; Oriente ferry + tienda de Porlamar; Centro metro + cola; Deltamacura reglas caóticas) | cada una con test + revisión del usuario |
| Capa estática cacheada por tesela, minimapa | rendimiento ≤ 6 ms |
| Decor desde el SVG del draft | coherente con el doc 05 |
| Textos y humor revisados (sin política partidista, sin burla a grupos, respeto a los Warao en Deltamacura) | checklist de tono firmado por el usuario |

### M5 · Simultáneo y minijuegos exclusivos (8-12 días)

| Entregable | Criterio |
|---|---|
| `fiesta-entrada.js`: grupos de teclado A/B, zonas táctiles por `pointerId`, Gamepad API | e2e multi-touch verde; prueba con 2 gamepads reales (por verificar hardware) |
| Extensión `T.slot(n)` en `probar.js` | bots de los nuevos juegos verdes |
| 6-8 `juego-f-*` simultáneos: al menos 2 de 4P, 2 de 1v3, 2 de 2v2, 1 de duelo (verbos táctiles: parar la barra, pulsar rápido, esquivar, carriles, recolectar, memoria, sumo) | cada uno ≤ 15 s, jugable en teléfono con 2 zonas |
| 2 «EL RETO» exclusivos multifase (p. ej. DELTAMACURA y SALTO ÁNGEL) | 60-150 s, puntuación individual, probados con bots |

### M6 · Final, pulido y lanzamiento (5-7 días)

| Entregable | Criterio |
|---|---|
| Ceremonia final: revelación de bonus una por una, podio, estadísticas divertidas («el más pelao», «el rey de la cola») | jugada con 4 personas reales |
| CPU «Arrecho» | gana más que «Pana» en el simulador |
| Botón adelantar animaciones, velocidad de CPU, opción de turnos 10/15/20 + añadir turnos una vez | revisado |
| Accesibilidad mínima: textos ≥ 18 px a escala de teléfono, colores de jugador distinguibles con daltonismo (forma + color) | revisión manual |
| Botón en el menú de `campana.js` + `public.html`/`worlds/venezuela` | aparece en producción |
| e2e de partida completa y viewport verdes | CI local verde |
| Playtest con 3 grupos de 4 personas, duración media registrada | 25-45 min |

**Total aproximado:** 39-57 días de trabajo (por verificar). Ruta mínima jugable con amigos: **M0 + M1 + M2 + la mitad de M3** (≈ 15-20 días).

---

## 12. Riesgos

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | Rama actual con 48 archivos modificados (incluye `engine.js`, `juegos-bus.js`, `campana.js`) | Alta | Conflictos | Comitear/aparcar antes de M0; la fiesta vive en archivos nuevos y toca `campana.js` solo en M6 |
| R2 | Globales únicos de entrada y `G` | Alta | Bloquea simultáneo | Secuencial primero (M2), enrutador aislado en M5, juegos viejos intactos |
| R3 | Juegos viejos binarios no rankean bien | Media | Rondas injustas | Métrica de tiempo + auditoría + lista blanca |
| R4 | `Math.random` sin semilla en `mk()` | Alta | Intentos distintos por jugador | `withSeed` durante `mk()` y `update()`; auditar juegos que usen `performance.now()` o tiempos reales |
| R5 | Las primitivas o estilos no respetan `translate/scale` | Media | El mapa se ve mal en algunos estilos | Prueba de humo en M1; si falla, dibujar el tablero a un canvas propio y componerlo |
| R6 | Rendimiento del mapa grande en teléfonos | Media | Tirones | Teselas cacheadas, culling, 3 escalones de zoom |
| R7 | Ronda de 5 secuencial demasiado larga con 4 humanos (≈ 3 min) | Alta | Partidas de 60+ min | 3 microjuegos en secuencial, «relevo», o simultáneo (M5) |
| R8 | Pantalla de teléfono pequeña para 2-4 zonas táctiles | Alta | Mala experiencia | Teléfono = pasar-el-teléfono; simultáneo solo en tablet/laptop |
| R9 | Suerte excesiva (crítica constante a la serie) | Media | Frustración | Reglas «Pro», bonus anunciados, catch-up dirigido al último y no aleatorio |
| R10 | Humor que ofenda (política, Warao, tragedias) | Media | Reputación (hay campaña de marketing activa, ver memoria) | Checklist de tono, revisión del usuario por evento, nada de políticos reales |
| R11 | Alcance enorme (mapa + 20 sistemas) | Alta | No se termina | Hitos con algo jugable cada uno; MVP con 60 nodos |
| R12 | Playwright con rutas fijas locales | Media | Tests no corren en otra máquina | Documentado; fuera de alcance |
| R13 | `localStorage` bloqueado | Baja | Se pierde la partida | try/catch + aviso |
| R14 | Nombres que imitan marcas (Mario, Nintendo, «Chance Time», «Bowser») en textos públicos | Media | Legal/marca | Solo nombres propios venezolanos en el juego («LA FIESTA», «¡Cambio!», «La Alcabala»); «Mario Party» solo en docs internos |

---

## 13. Preguntas abiertas para el usuario

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| P1 | ¿Primera versión solo en un dispositivo (sofá) o online? | sofá / online | Sofá; online reutilizando PocketBase después de M6 |
| P2 | ¿Dónde vive el modo? | página propia `fiesta.html` / estado nuevo dentro de `campana.js` | Página propia |
| P3 | ¿Teléfono como dispositivo principal? | sí (pasar-el-teléfono) / tablet-laptop (simultáneo) | Ambos, con teléfono = secuencial |
| P4 | Ronda de minijuegos: ¿5 rápidos después de **cada** ronda del tablero, o cada 2-3 rondas? | cada ronda / cada 2 / cada 3 | Cada ronda en simultáneo; 3 rápidos en secuencial con 3-4 humanos |
| P5 | «EL RETO» (largo y difícil): ¿cada cuántas rondas y cuánto paga? | cada 4 rondas / mitad y final / al caer en casilla | Mitad de partida + cada 4 rondas, 15/8/4/0 |
| P6 | Nombre del modo y de la moneda | LA FIESTA, LA RUMBA DE VENEZUELA, PARRANDA…; monedas, lochas, bolos, cobres | Decide el usuario |
| P7 | Duración por defecto | 10 / 12 (Pro) / 15 / 20 turnos | 15 normal, 12 Pro |
| P8 | Bonus finales: ¿anunciados al inicio, ocultos o mezcla? | visibles / ocultos / 2+1 | 2 visibles + 1 oculto chistoso |
| P9 | ¿Deltamacura es una región del tablero o un evento/portal que aparece y desaparece? | región / portal | Portal que se mueve + región pequeña |
| P10 | ¿Personajes elegibles o solo 4 colores del «TÚ»? | colores / mamá, abuela, tío, pana jugables | Colores en M1; reparto jugable en M6 |
| P11 | Límites de humor: ¿se permite apagón, cola de gasolina, bachaqueo, dólar paralelo, alcabala? | sí / suavizado / no | Sí, con tono de situación absurda, nunca contra personas |
| P12 | ¿«Venoba» es Pokémon Venova (Roberto Jiménez)? | sí / otro | Confirmar para usarlo de referencia visual |
| P13 | ¿Importa la versión en inglés? | sí / no | No en M0-M6 (el laboratorio es solo español) |
| P14 | ¿Se aceptan gamepads como requisito para 3-4 jugadores simultáneos en laptop? | sí / no | Sí, opcional |

---

## 14. Primeros pasos concretos (la semana 1)

1. Usuario: comitear o aparcar la rama `codex/mobile-controls-easter-eggs` y responder P1-P5.
2. Crear `fiesta/m0`, `fiesta.html`, `fiesta-rng.js` + test, esqueleto de `fiesta-reglas.js` + test.
3. Añadir `fiesta-*.js` y `fiesta.html` a `sync-world-assets.sh`.
4. Mapa de prueba de 60 nodos (a mano, coordenadas del doc de geografía ×40/×30).
5. Cámara + dibujo gris del grafo + ficha que avanza con el dado; prueba de humo de los 6 estilos con `translate/scale` (R5).
6. `simular.js` v0 con casillas azul/roja y estrella para fijar el precio inicial de la estrella con datos.
