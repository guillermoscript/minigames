# M3-TEAMS · Primeros juegos de equipo en vivo: `f_futbolito` (2v2) y `f_patilla` (1v3) (2026-10-17)

> Addendum de `M2-SPEC.md`. **Para todo lo que este doc toca, gana este doc; para lo demás, gana M2-SPEC; para lo que ninguno toca, 07/08/09** (glosario canónico: 07 §2.1). Cada decisión que se aparta de 07/08/09/M2 lleva etiqueta **DM3-n** (§0.2) con su motivo.
>
> Reglas duras heredadas: no romper `node --test test/fiesta-*.test.js test/duo.test.js test/squad.test.js test/party*.test.js`, `node pocketbase/pb_hooks/party.test.js`, `node test/fiesta.e2e.js`, `node test/fiesta-mj.e2e.js`; **no tocar `fiesta-lobby.js` ni `fiesta-ui.js`** (aquí no hace falta, §1.7); sin `Math.random` en lógica de juego (`c.rng`/`c.rngFor`); sin commits; código compartido con el servidor en ES2015 compatible con Goja (sin `?.`, `??`, spread de objetos, `async`, campos privados); mensajes ≤420 B (`x*` ≤200 B); dibujo solo con `rr, ell, line, poly, txt, bust` + `c.util.pj` + `BUS.AP.CAST` (+ `say/spawn/snd` protegidos con `typeof`) para que salga en cualquier estilo.
>
> **PRIORIDAD DEL USUARIO (manda sobre todo lo demás en este doc): SOLO JUGABILIDAD.** Los estilos de arte no importan: se apunta únicamente al look 16-bit (`snes`). **No** se prueban, capturan ni afinan los otros 5 estilos; donde este doc diga «6 estilos» o pida capturas en `tinta`/`felt`, léase «solo `snes`». Lo que sí es obligatorio: que el juego sea correcto, legible y divertido (balance, controles, tarjeta, marcador).
> **Honestidad sobre lo verificado.** Esta spec sale de LEER el código y de correr UNA cosa: `node --test test/fiesta-*.test.js` (282/282 en verde a las 18:46, incluida `test/fiesta-juego-patilla.test.js`). No se corrió ningún e2e ni ningún juego de equipo en red; los números de balance son **valores de partida** que el banco de §3.9/§4.8 debe confirmar. Lo que digo que "falla" o "falta" lo vi en el código, no en una ejecución (cada punto trae su prueba para confirmarlo).

---

## 0. Resumen

### 0.1 Hallazgo que condiciona el reparto (leer primero)

Mientras se escribía esta spec **ya existen, sin commitear y editados minutos antes (18:39-18:46), `docs/style-lab/fiesta-juego-patilla.js` y `test/fiesta-juego-patilla.test.js`, y la línea de catálogo de `f_patilla` ya trae `live:1` y `lim:{scoreMax:90,scoreRate:12,minT:6,finTemprano:1}`** (`fiesta-reglas.js:70`). Autor desconocido (hay otras sesiones de Claude abiertas sobre el repo y un `node test/fiesta.e2e.js` corriendo). Decisión (DM3-2): **E3 adopta ese archivo como base** y lo reconcilia con §4 (la mayor parte de §4 *ratifica* lo que ya hace; las diferencias están en §4.9 con su prueba). `f_futbolito` **no existe** todavía (`ls` vacío): E2 debe volver a mirar antes de crear el archivo, para no pisar a nadie.

**Estado a las 19:03 (nota posterior a la redacción; verificado solo con `stat`/`grep`, sin correr nada):** los tres ingenieros ya trabajan en paralelo sobre esta spec. Existen `fiesta-juego-futbolito.js` y `fiesta-juego-patilla.js` (editados 19:00-19:01), `test/fiesta-juego-futbolito.test.js`, `test/fiesta-live-futbolito.test.js`, `test/fiesta-teams.test.js`, `fiesta.html` y `fiesta-reglas.js` fueron tocados a las 19:02 (la etiqueta de patilla ya está; `f_futbolito` sigue **sin** `live:1`, correcto hasta G3, DM3-15). Hay un `tune.js` de balance de patilla corriendo en el scratchpad. Leer §0.1/§1 como «foto de las 18:43»; no re-auditar lo que E1-E3 ya movieron sin releer el archivo.

Defecto abierto HOY por ese `live:1`: `fiesta.html` no carga `fiesta-juego-patilla.js` (§1.6), así que cualquier ronda 1v3 del servidor elige un juego sin runtime en el cliente (`fiesta-main.js:abrirSesion` → `sesionMala` → la tarjeta vieja y nadie puede jugar). Primer trabajo de E1 (G0).

### 0.2 Decisiones (DM3)

| # | Decisión | Por qué / dónde se aparta |
|---|---|---|
| **DM3-1** | **Modelos: `f_futbolito` = C; `f_patilla` = B («C ligero»).** | Regla del usuario: solos = A, disputados/cooperativos = C, «B permitido como C ligero». El fútbol comparte una pelota que se disputa → C (08 §9.3 #15). En la patilla no hay objeto compartido mutable: la trayectoria es función pura de `(xtiro, gt)` y **el golpe lo juzga la víctima contra su propio cuerpo** (08 §4.1 B). Con C, el juez juzgaría con la posición *retrasada* de cada víctima (entrada + RTT/2): «esquivé en mi pantalla y me pegó» a 300 ms. B es estrictamente más justo aquí y no gasta el flujo `i`. |
| **DM3-2** | **Catálogo (fuente única, `fiesta-reglas.js`)**: `f_futbolito {m:['2v2'],cl:'binary',dur:60,mo:'C',live:1,lim:{scoreMax:15,scoreRate:0.5,minT:44,finTemprano:1}}`; `f_patilla {m:['1v3'],cl:'binary',dur:35,mo:'B',live:1,lim:{scoreMax:90,scoreRate:12,minT:6,finTemprano:1}}` (esta ya está). `dur` 60 = 45 s reglamentarios + hasta 15 s de gol de oro (08 #15: «45 s + 15 s oro»; el catálogo ya decía 60). Patilla 35 s (08 #20; el catálogo decía 45 y ya se corrigió). El literal `dur:NN` se conserva (el e2e lo parchea con `dur:\d+`). **No** se añade paridad `def.dur === cat.dur` en `LIVE.add` (el e2e sirve un catálogo con `dur:12` y rompería el registro). | DM2-3. |
| **DM3-3** | **Puntaje binario = por asiento, entero ≥0, y el veredicto sale SOLO de `compara()`** (2v2: suma por equipo; 1v3: el solo contra la **media** del trío; empate si `|Δ|<1e-9`). 2v2: `sc[i]` = puntos acreditados a *i*; la suma del equipo ES el marcador. 1v3-**umbral** (patilla): `sc[solo] = U·v`, `sc[trío] = U·H − U/2` constante (U=10, H=3 ⇒ 25): gana el solo ⇔ `v ≥ H`, sin empates por construcción. Lo que el jugador *ve* (HUD, podio) no sale de `sc` sino de `g.hudChip`/`g.destacado` (DM3-7/8). | 08 §8.1 («`ganaEquipo()/ganaSolo()`») queda sustituido: ver DM3-4. HANDOFF: «puntaje comparable y aditivo para 2v2/1v3». |
| **DM3-4** | **Se eliminan `ganaSolo()/ganaEquipo()` del contrato** (M2-SPEC §4.1 los lista como opcionales de C; `fiesta-live.js` no los usa: `grep` vacío). | El servidor recalcula los puestos con `compara` a partir de `sc` (DM2-10); un hook del juego que decidiera el ganador podría contradecir lo que el servidor paga. **Una sola fuente de verdad: `sc` → `compara`.** Las pruebas deben decidir con `FIESTA.reglas.compara`, no con un hook del juego. |
| **DM3-5** | **Orientación fija en el fútbol** (sin espejo): equipo 0 (`mj.eq[0]`, azul) defiende la IZQUIERDA y ataca a la derecha; equipo 1 (rojo) al revés. | El juez lee el eje en crudo; espejar al equipo 1 invertiría `c.eje` en `step`, `predict` y el dibujo en 3 sitios (riesgo alto, valor bajo). Se señala «TU ARCO» con color y flecha. Reabrir tras la prueba en móviles. |
| **DM3-6** | **`LIVE.practice` pasa a entender juegos de equipo** y se añade **`LIVE.sim(id,o)`** (sesión local sin red, todos los asientos CPU, reloj virtual) para bancos y pruebas. | `practice` cablea `tipo:'1v1'`, n=2, `solo:null` (`fiesta-live.js:741-770`): un 2v2/1v3 no tiene rol en la práctica. Hoy cada juego duplica ~40 líneas de contexto falso en su prueba; `sim` ejercita el `create()` real (terminar/puestos/hash). |
| **DM3-7** | **Tarjeta, HUD y práctica con equipos**: `carta.roles` (override por campo), `carta.demos[].dibuja(cx,cy,k,t,teclado)` (demo propio, sin tocar `carta.js` por juego), `g.hudChip(p)` y campos de equipo en `sess.hud()`. | 08 §3.3/§11.2 #13 exigen `roles.solo/trio`, pero `fiesta-carta.js` hoy ignora `roles` y solo conoce 4 ids de demo. |
| **DM3-8** | **Podio con equipos**: título por lado («¡GANÓ EL EQUIPO AZUL!», «¡GANÓ <solo>!», «¡GANÓ EL TRÍO!»), compañeros juntos en la tarima, marcador del lado en vez de «N pts» por jugador. | `dibujarPodio` hoy lee `gan.length>1` como EMPATE: el equipo ganador de un 2v2 saldría «¡EMPATAN A Y B!» y el trío de un 1v3 «¡EMPATE ENTRE 3!». |
| **DM3-9** | **Patilla: la víctima juzga y se confía** (sin auditoría del juez en v1). Un tramposo del trío podría ignorar golpes. | 07 §risk «juez tramposo… se acepta para jugar entre panas». Declarado, no oculto (§7 P2). |
| **DM3-10** | **Fin temprano**: ambos `finTemprano:1`. Fútbol: termina al acabar el reglamentario si hay ganador, o con el primer gol de oro. Patilla: termina cuando se resolvió el último tiro. `minT` efectivo = `min(lim.minT, dur−1)`. | M2 DM2-4/§3.2.1. |
| **DM3-11** | **El arnés de red se extrae a `test/helpers/live-arnes.js`** y aprende `tipo:'2v2'\|'1v3'`, `eq`, `solo`. | `crearSala` (`test/fiesta-live.test.js:54`) fija `mj.tipo='ffa'\|'1v1'`, `eq` individuales y `solo=null`: con él es imposible probar un juego de equipo en red. |
| **DM3-12** | **Puertas de balance**: (a) por simulación local sin red, 200 semillas × 3 niveles, mandatorio; (b) ventaja del juez por red, `LIVE_FULL=1`, se reporta pero no bloquea. | 08 §11.2 #10/#11 · 07 §10 M3 (1). Coste del arnés de red. |
| **DM3-13** | **Fútbol: compañeros no colisionan entre sí, rivales sí; pase asistido** (tap de A hacia el compañero si está en el cono). | «Los compañeros se coordinan» (08 §9.3) necesita un verbo de cooperación y evitar el atasco de dos cuerpos en la pelota. |
| **DM3-14** | **Colores de equipo = índice de equipo** (0 azul `#2f6fdb`, 1 rojo `#d93a3a`, `fiesta-carta.js:K.COL_EQ`). En 1v3 el solo es siempre el equipo 0 (azul), aunque su casilla del tablero fuera roja. | `formarMJ` arma `eq=[[solo],trío]`; reordenar tocaría el reductor y `equipos()`. Cosmético; si molesta, se corrige en `formarMJ` con `eq=[az,ro]` (la lógica 1v3 de `compara`/`pagosMJ` no depende del índice). |
| **DM3-15** | **`live:1` de `f_futbolito` se enciende al final (G3)**, y los e2e fijan el juego bajo prueba (§5.9). | Hasta que existan archivo, etiqueta y pruebas, un `live:1` rompe cualquier ronda 2v2 (§0.1). |

---

## 1. Auditoría: qué soporta ya binario/equipos de punta a punta y qué no

Leyenda: **OK** = funciona tal cual · **FALTA** = hay que cambiarlo (E1 salvo que se diga) · **RIESGO** = funciona pero con una trampa.

### 1.1 Reductor `fiesta-reglas.js`

| Pieza | Estado | Evidencia y consecuencia |
|---|---|---|
| `formarMJ` (`:420-448`) | **OK** | Solo hay formato de equipo con 4 asientos (`as.length<4` ⇒ ffa); `az`/`ro` por color de casilla (`'v'` se sortea con `Z.r`); 2 y 2 ⇒ `2v2`, si no ⇒ `1v3` con `solo` = el único de su color; `eq=[az,ro]` o `[[solo],trío]`; `clase='binary'` (`:443`); juez provisional = humanos con el solo al final (`hs.sort`). **Los juegos nuevos entran solos** por `elegir(Z,tipo)` (filtra `g.live && m∋tipo`) y reemplazan la degradación a ffa (DM2-15). |
| `elegir` / `P.recientes` | **RIESGO** | Con **un solo** juego por formato, `recientes` (últimos 4) no puede rotar: cada ronda 2v2 será futbolito y cada 1v3 patilla. Aceptado en M3; se arregla con los siguientes juegos del catálogo (08 §9.3-9.4). |
| `equipos(modo,n,solo)` (`:517`) | **RIESGO** | Existe pero `formarMJ`, `eqIdx` (reglas `:453`), `party_mj.js:194` y `fiesta-live.js:55` re-implementan el mismo mapa asiento→equipo. Hoy coinciden (`test/fiesta-reglas.test.js:279`). Tarea E1 (barata): exportar `eqIdx(mj)` desde reglas y que live/party_mj lo prefieran (con su copia como respaldo) + una prueba de paridad. |
| `compara` (`:508`) | **OK** | 2v2 suma; 1v3 solo vs **media** del trío; empate `<1e-9`. `test/fiesta-reglas.test.js:272-277`. Esto *impone* DM3-3. |
| `puestos(tipo,eq,sc,clase)` (`:677`) | **OK** | `1v1→ffa`; `survival` normaliza; el resto `compara`. Lo usan cliente (`terminar`) y servidor (`validarFin`). |
| `pagosMJ` (`:493`) | **OK** | 2v2: 7/2, empate 4; 1v3: solo 12/0, trío 4/0, empate 5/2 (`:497-501`, `test:260-265`). Necesita `x.solo` = índice del solo, que `resultadoMJ` pasa (`soloI`). |
| `resultadoMJ` (`:455`) | **OK** | Recalcula `pu` con `compara(mj.tipo…, eqIdx, sc)` ignorando `pl` del servidor. `mj.res` trae `sc,puestos,pagos,empate,h,aj,por,disputado`. |
| `CATALOGO` (`:62-71`) | **FALTA** (futbolito) | `f_patilla` ya tiene `live/lim/dur:35`; `f_futbolito` no tiene `live` ni `lim` (§0.2 DM3-2). |

### 1.2 Servidor (`party.js`, `party_mj.js`, `party_routes.js`)

| Pieza | Estado | Evidencia |
|---|---|---|
| `validarFin` (`party_mj.js:223`) | **OK** | `puestos(mj,sc,cl)` usa `mj.tipo`/`mj.eq` de la sala completa (no la delgada). `cl='binary'` no normaliza. |
| `clampSc` (`:211-222`) | **RIESGO** | Topes **por asiento**, no por equipo. Con `finTemprano:1`, el asiento de **mayor** puntaje se acota con `scoreMax` y el resto con `scoreRate·(t+1,5)` (pensado para `survival`). Para binario sirve, pero obliga a verificar que **todo valor no-máximo** quepa en el tope de ritmo al `minT` (§2.3). Prueba nueva obligatoria con `res.aj===false`. |
| `elegirJuez` (`:158`) | **OK** | En 1v3 saca al solo de candidatos si hay otro a ≤40 ms. En 2v2 no hay trato especial. |
| Relé / `fiestaSig` | **OK** | No distingue formato; permite `i o s s2 ev …` y `x*`. |
| `LIM_DEFECTO` (`party_mj.js:21`) | **RIESGO** (inocuo) | Respaldo sin las 2 entradas nuevas; solo se usa si el catálogo no trae `lim`. E1 las añade por paridad. |
| Migraciones / rutas | **OK** | Sin cambios. |
| Pruebas de servidor binario | **FALTA** | `party-mj.test.js`/`party.test.js` solo cubren ffa/1v1. E1 añade `validarFin` 2v2 y 1v3 (§5.8). |

### 1.3 Runtime `fiesta-live.js`

| Pieza | Estado | Evidencia |
|---|---|---|
| `c.modo/equipos/solo`, `seats[].team` | **OK** | `:521`. `eqIdx(mj)` coincide con el del servidor. |
| `terminar()` / `recibeEnd` | **OK** | `puestos(tipoCo, eqs, sc, def.clase)`; el hash cubre los puestos de equipo. |
| `mio(p)` | **OK** | C ⇒ solo el juez; B ⇒ propio o juez si CPU. Es lo que necesitan fútbol (C) y patilla (B). |
| `practice(id,o)` (`:741`) | **FALTA** | `tipo:'1v1'`, `as:[yo,otro]`, `solo:null`. Un juego de equipo no sabe qué rol/equipo es. Además la tarjeta lo llama con `yo:'a'` y sin rol (`fiesta-carta.js:C.practica`). |
| `S.hud()` (`:576`) | **FALTA** | Cada ficha lleva `sc` individual y `team`; no hay marcador de equipo, ni «compañero», ni texto del juego (`hudChip`). Con `sc` constantes (patilla: 25) el HUD mostraría «25» a los tres. |
| `add()` (`:81`) | **FALTA** | No valida `carta.roles` (08 §11.2 #13 lo exige en 1v3) ni coherencia modos↔clase. |
| `ganaSolo/ganaEquipo` | **FALTA** (no existen) | Listados en M2-SPEC §4.1, ignorados por el runtime ⇒ DM3-4. |
| `skillFix` | **RIESGO** | Solo admite un número; `LIVE.sim` quiere un arreglo por asiento. |
| `practicaHumano(j)` | **RIESGO** | En práctica el asiento propio nunca ejecuta `ai`; para `sim` (todos CPU) hay que apagarlo. |

### 1.4 Pantallas `fiesta-carta.js` y `fiesta-main.js`

| Pieza | Estado | Evidencia |
|---|---|---|
| Ruleta de formato / banner 2v2 y 1v3 | **OK** | `dibujarRuleta`, `dibujarFormatoBanner`, `textoFormato` («¡TÚ CONTRA TODOS!» solo para el solo). Probado en `fiesta-carta.test.js:135-147,189`. |
| Retratos de la tarjeta con marco de equipo | **OK** | `dibujarTarjeta` usa `mj.eq[0].indexOf(s)` ⇒ 0/1. |
| Tarjeta por **rol** | **FALTA** | Ignora `carta.roles`; el solo y el trío verían el mismo texto. |
| Demos de controles | **RIESGO** | Solo `saltar/compas/mover/robar`; un id desconocido cae al pad «A» genérico. Cada juego nuevo obligaría a editar `carta.js` ⇒ DM3-7 (`dibuja`). |
| HUD (`dibujarHudFicha`) | **FALTA** | Franja de color por equipo sí (`!prc` y `modo 2v2/1v3`), pero no en práctica, ni marcador de equipo, ni orden por equipo. |
| `podioModelo` / `dibujarPodio` | **FALTA** | Ver DM3-8. El orden de la tarima es por `rank` y asiento (los compañeros no quedan juntos); «N pts» por jugador. |
| `fiesta-main.js` | **OK / mínimo** | `reconciliarSesion/abrirSesion` son genéricos. Solo el bloque `?practica=` (`:246`) debe pasar `rol`. |

### 1.5 Director, UI, lobby

`fiesta-director.js` (`mjIni`/`mjRes` ya traducen 2v2/1v3, `fiesta-ui.js:68,146`) **OK**. **No hace falta tocar `fiesta-ui.js` ni `fiesta-lobby.js`.**

### 1.6 Despliegue

`fiesta.html:30-33` lista a mano los juegos. `Dockerfile:24` copia `docs/style-lab/*.js` y `sync-world-assets.sh:13` copia `fiesta-*.js` ⇒ **cero cambios de despliegue**, solo las etiquetas `<script>` (orden: después de `fiesta-juego-harina.js`). **FALTA hoy** la de patilla (§0.1).

### 1.7 Pruebas

| Pieza | Estado |
|---|---|
| `test/fiesta-live.test.js` `arnes/crearSala` | **FALTA** equipos (DM3-11). |
| `test/fiesta-mj.e2e.js` `JUEGOS` | **RIESGO**: apaga `live:1` solo de los 3 juegos de M2 (`:19,35`). Con 3 humanos + 1 CPU el formato depende de los colores de casilla: sin cambios, rondas 2v2/1v3 caerían en juegos que el e2e (solo Espacio / `pad_a`) no sabe jugar y la aserción «el ocioso no gana a la CPU» se vuelve aleatoria. |
| `test/fiesta.e2e.js` (M1) | Parchea `dur:\d+→4`; no depende de `live`. E1 lo corre y reporta. |
| Banco de balance | **FALTA** para 2v2; para 1v3 ya hay uno en la prueba de patilla (contexto falso). |

---

## 2. Convenciones comunes de los juegos de equipo (valen para los 10 siguientes)

### 2.1 Asientos, equipos y roles
- Los juegos de equipo **siempre** reciben `c.n === 4`. Defensa obligatoria: si `c.n !== 4` o `c.equipos` no es válido, el juego usa formas por defecto (2v2: `[0,0,1,1]`; 1v3: solo = 0) y **no lanza**. `n=2` (duelo 1v1) es una degradación aceptable en el fútbol (la práctica anterior a G1 lo usa); la patilla ya admite n genérico.
- `c.equipos[p]` ∈ {0,1}: **2v2** equipo 0 = `mj.eq[0]` = azules (casilla `a`), 1 = rojos; **1v3** equipo 0 = el solo. `c.solo` = índice del solo o −1.
- E1 añade al contexto (G1): `c.mate(p)` → índice del compañero en 2v2, si no −1; `c.rol(p)` → `'solo'|'trio'` (1v3), `'eq0'|'eq1'` (2v2), `'ffa'`. Los juegos **pueden** derivarlos de `c.equipos/c.solo` (E2/E3 no esperan a E1).

### 2.2 Puntaje y veredicto (DM3-3, DM3-4)
1. `scores()` devuelve enteros ≥0 por asiento. El ganador lo decide únicamente `FIESTA.reglas.compara(c.modo, c.equipos, scores())`.
2. **2v2**: `sc[i]` = puntos que *i* aporta; el marcador de un equipo es la suma de sus dos asientos. Empate permitido (4 monedas c/u).
3. **1v3 de umbral** (patilla y cualquier juego «el solo gana si consigue ≥H»): `sc[solo] = U·v`, `sc[trío_j] = U·H − U/2` constante, con `U` par ⇒ ningún empate. Un 1v3 donde el trío sí puntúa de verdad (carreras, recolección) usa la media del trío tal cual lo hace `compara`.
4. `g.hudChip(p)` (opcional, string ≤8 car.) manda sobre `sc` en la ficha del HUD; `g.destacado()` manda sobre «N pts» en el podio. **Nadie debe enseñar al jugador el `sc` de un 1v3 de umbral.**
5. Resultado dentro de `lim` y **sin recorte del servidor** (`res.aj === false`).

### 2.3 Topes por asiento (cómo elegir `lim`)
- `scoreMax` ≥ el mayor valor posible de un asiento. El asiento de mayor puntaje usa `scoreMax` (regla `top` de `clampSc` con `finTemprano`).
- `scoreRate·(minTefectivo + 1,5)` (sin `−0,4`, es holgura) ≥ el mayor valor que pueda tener un asiento **que no es el máximo** en el instante más temprano en que el juez puede cerrar. Si falla, el servidor recorta y `h` del juez ≠ `h` del servidor (queda `disputado` sin ser trampa).
- Verificación: prueba con 200 semillas y `res.aj===false`, y con `dur ∈ {3, 8, 12, def}` (el e2e usa 12).

### 2.4 Tarjeta (DM3-7)
- `carta` conserva `obj, gana, como, demos` (válidos para espectadores y como base). **`carta.roles = {solo:{…}, trio:{…}}`** (1v3) se funde **campo a campo** sobre la base (`obj`, `gana`, `como` entero, `demos` entero) según el rol de quien mira: `roles[mj.solo===yo?'solo':'trio']`. Espectador ⇒ base.
- 2v2: la línea del formato pasa a «¡2 CONTRA 2! · Tu pana: NOMBRE» (E1, `dibujarTarjeta`, variable `sm`).
- `demos[i].dibuja(cx, cy, k, t, teclado)` opcional: si existe, `fiesta-carta.js:demo()` lo llama dentro de `try/catch` en vez del id; sigue siendo `rr/ell/line/poly/txt`. Los ids antiguos no cambian.
- `LIVE.add` valida: si `modos` contiene `'1v3'` ⇒ `clase==='binary'` y `carta.roles.solo/trio` con al menos `obj` y `como`; si contiene `'2v2'` ⇒ `clase==='binary'`.

### 2.5 HUD (DM3-7)
`sess.hud()` añade: `tipo` (= `mj.tipo`), `solo` (índice o −1) y por ficha `{team, mate:bool, rol, tsc, txt}`: `tsc` = suma del equipo en 2v2 (en el resto, el `sc` propio); `txt` = `String(g.hudChip(j))` o `null`. Valor mostrado en la ficha: `txt ?? (tipo==='2v2' ? tsc : sc)`. `dibujarHudFicha` (a) dibuja la franja de equipo también en práctica (usa `h.tipo`, ya no `sess`), (b) ordena las fichas por (equipo, asiento) cuando hay equipos, (c) rotula `mate` con «PANA». El juego dibuja *su* marcador grande dentro de `c.campo()` (y≥70).

### 2.6 Podio (DM3-8)
`podioModelo(res,mj)` añade `tipo`, `lados` (`[{eq, miembros, rank, pago, sc}]`: 2v2 dos lados; 1v3 solo y trío) y `ganLado` (`null` si empate real = todos los puestos iguales). Título puro `tituloPodio(M,mj,S,yo)`: 2v2 «¡GANÓ EL EQUIPO AZUL!» + «<A> y <B>»; 1v3 «¡GANÓ <solo>!»/«¡GANÓ EL TRÍO!»; empate «EMPATE». La tarima ordena por (rank, equipo, asiento); la línea inferior por jugador pasa a la del lado (`g.destacado()` si la sesión sigue viva; si no, marcador `3 – 2`).

### 2.7 Práctica y simulación (DM3-6)
- `LIVE.practice(id,{lv,ch,rol,seed,…})`: si `def.modos` contiene `'ffa'` o `'1v1'` ⇒ **comportamiento actual intacto**. Si no (juego solo de equipo): n=4, asientos `a..d`, yo = `'a'`, `tipo = def.modos[0]`. 2v2: `eq=[[a,b],[c,d]]` (tú + pana CPU contra 2 CPU). 1v3: `rol:'solo'` (por defecto) ⇒ solo=`a`; `rol:'trio'` ⇒ solo=`b` (CPU) y tú del trío. Todos los demás asientos `cpu:'auto'`, `skillFix` .5, `dur=min(def.dur,20)`.
- La tarjeta pasa `rol` = rol real de quien mira (`sess.c.solo`); `?practica=<id>&rol=solo|trio` en `fiesta-main.js`.
- `LIVE.sim(id, {tipo, eq?, solo?, seed, lv, dur?, skill:número|arreglo, cpuNivel?}) → {sc, pl, h, kk, ganaLado, vista, eventos}`: misma sesión local que `practice`, **cuatro asientos CPU**, flag interno `opts.sim` (apaga `practicaHumano`), reloj virtual a 1/30 hasta `over` o `gt>dur+2`. No dibuja. `ganaLado ∈ 'eq0'|'eq1'|'solo'|'trio'|'empate'` calculado con `pl`. `skillFix` acepta arreglo.

### 2.8 CPU
Solo `ai(p,dt,api)` con `c.skill[p]` y `c.rngFor('cpu'+p)`; reacción ≥180 ms; ≤12 toques/s; las CPU de un mismo equipo se coordinan **solo** por el reparto de roles de su `ai`. Un humano caído pasa a CPU (runtime) y su juego debe retomar desde el último estado (`alCpu`).

---

## 3. `f_futbolito` · ¡FUTBOLITO DE CALLE! (2v2, binary, **C**) — dueño: E2

Archivo: `docs/style-lab/fiesta-juego-futbolito.js` (IIFE como `fiesta-juego-harina.js`: `if(!window.FIESTA||!FIESTA.LIVE||FIESTA.LIVE.get('f_futbolito'))return;`). Id de registro `f_futbolito`. Registro:

```js
FIESTA.LIVE.add('f_futbolito', {
  name:'¡FUTBOLITO DE CALLE!', modos:['2v2'], clase:'binary', modelo:'C', dur:60,
  stick:true, botones:2, snapHz:10, migra:true, minHumanos:1,
  limites:{scoreMax:15, scoreRate:0.5, minT:44, finTemprano:1},      // = CATALOGO
  packN:42, packDiscretos:[…§3.4],
  carta:{ obj:'Mete más goles que el otro equipo',
          gana:'El equipo con más goles gana. Si empatan, ¡gol de oro!: el primero que anota se lleva todo.',
          como:{tactil:'Joystick · A = patear (mantén para más fuerza) · B = correr', teclado:'WASD o flechas · ESPACIO patear · SHIFT correr'},
          demos:[{id:'mover',txt:'Corre detrás de la pelota'},{id:'patear',dibuja:fn,txt:'Toca A para pasarle a tu pana; mantén A para un tiro fuerte'}], roles:null },
  mk(c){…}
});
```

### 3.1 Reglas
- **Campo** (unidades lógicas, paso fijo 1/30): arena `AX0=100…AX1=700` × `AY0=150…AY1=440`, centro `(400,295)`. Marcador a la vista en `y 76-130`. Arcos en los lados cortos: boca de medio alto `GH=[60,44,44][lv−1]` centrada en `CY`; palos circulares r=5; fondo del arco 24 px (dibujo). Equipo 0 (azul) defiende el arco **izquierdo** (DM3-5).
- **Cuerpos**: jugador r=20; pelota r=11. Velocidad 5 px/tick (150 px/s); **B** = correr 7 px/tick con aguante 90 (gasto 1/tick, recarga 0,6/tick, bloqueado hasta 30). Cargar A frena al 70 %. **Compañeros se atraviesan; rivales se empujan** (separación simple, 2 pasadas, como harina) (DM3-13). Pared: rebote 0,78.
- **Pelota**: fricción `v*=0,98`/tick, tope 20 px/tick, para por debajo de 0,15. Contacto con un jugador: si la velocidad del jugador a lo largo de la normal supera la de la pelota, `v_b += n·(1,3·vn_p − vn_b)` (se «lleva» regateando).
- **Patada (A)**: *frente* = último eje no nulo (por defecto, hacia el arco rival). Alcance 41 px del centro del jugador y pelota dentro de ±100° del frente; si no, falla (enfriamiento 6 ticks). Se patea al **soltar** A, o con un toque sin sostener: carga `ch` = ticks sostenidos (0..18). `ch<6` ⇒ **pase**: si el compañero está a ±30° del frente y a 80-350 px, la dirección es hacia él con potencia `clamp(d/20+6, 8, 14)`; si no, 8 px/tick hacia el frente. `ch≥6` ⇒ tiro de 8 → 18 px/tick lineal en `ch`. Enfriamiento 10 ticks. (`c.tap` + `c.held` + flanco de soltado; un toque que sube y baja entre dos mensajes `i` llega como `tap>0` con `held` falso ⇒ pase.)
- **Gol**: el centro de la pelota cruza `AX0`/`AX1` dentro de la boca ⇒ punto para el equipo contrario al arco. **Autor**: el último jugador del equipo anotador que tocó la pelota en los últimos 90 ticks; si no hay (autogol, rebote del rival) ⇒ el asiento de menor índice del equipo anotador. `sc[i]` = goles de *i* (la suma del equipo es el marcador exacto, DM3-3).
- **Pausa tras gol** 60 ticks («¡GOOOL!»), luego saque: posiciones fijas simétricas (equipo 0: x=250, y=230/360 por orden de asiento; equipo 1: x=550), pelota al centro, 15 ticks de cuenta con todo congelado.
- **Reloj**: reglamentario `reg = max(2, round(0,75·dur))` s (45 s con dur 60). Al llegar a `reg`: si hay ganador ⇒ `done()`. Si empatan ⇒ **gol de oro** hasta `dur` (15 s): el primer gol ⇒ `done()`. Si sigue empate a `dur` ⇒ empate (4 monedas c/u). Con `dur` parcheado a 12 (e2e): `reg=9`, el juez espera a `minTEf=min(44,11)=11` (el runtime ya lo impone).
- **Niveles**: 1 día, arcos de chancletas (boca 120); 2 atardecer, boca 84; 3 noche, boca 84 y **«¡CARRO!»**: 2 eventos con tiempos sembrados en `mk` desde `c.rng` (`t1∈[0,25;0,45]·reg`, `t2∈[0,6;0,85]·reg`, separación ≥8 s, fuera de los últimos 6 s del reglamentario): aviso de 24 ticks (burbuja «¡CARRO!»), luego **pausa de 60 ticks con jugadores y pelota congelados** mientras un carro cruza la calle (2 s, 08 #15).
- **Aleatoriedad**: solo `rng` en `mk` (tiempos del carro); `step` es determinista. Cosmético con `c.fx()`.
- **Gag**: burbuja «¡CARRO!»; al ir un equipo perdiendo por ≥3: «¡El dueño de la pelota se va pa' su casa!» (solo burbuja, sin efecto); gol de oro: «¡Gol de oro, el que meta se queda con la pelota!».

### 3.2 Controles
Stick + A + B (`stick:true, botones:2`). Teclado WASD/flechas + Espacio/J (A) + Shift/K (B) (`F.carta.KEYS`). La zona del pulgar y el círculo B ya los resuelve `layoutPads`.

### 3.3 Modelo C (cómo encaja en el runtime)
`step(dt)` solo en el juez a 1/30: lee `c.held/tap/eje` de **los 4 asientos** (humanos remotos por `i`; CPU por `ai`; el propio con `fairDelay`), avanza físicas y reglas. `pack()/unpack()/restore()` ya llevan todo lo dinámico; lo único sembrado (carros) sale de `mk`. `update(dt)` en todos (animación, burbujas, sonidos por diferencia de estado). **Sin tipos `x*`.**

### 3.4 `pack()` (42 enteros, ≤300 B de JSON, ≤420 B el mensaje con `{q,e,t,p}`)
```
0 k · 1 frz (ticks de pausa) · 2 bits (1=oro, 2=fin) · 3 s0 · 4 s1 · 5 últimoToque+1 · 6 edadToque(≤99) · 7 carN · 8 carT(−1 ninguno) · 9 autor del último gol+1
10-13  pelota: x·4, y·4, vx·16, vy·16
14-37  4 × {x·4, y·4, frente° (0-359), bits (1=cargando, 2=corriendo, 4=pateando), carga 0-18, aguante 0-90}
38-41  goles por asiento (sc)
packDiscretos: 0-9, 12-13, y de cada jugador frente/bits/carga/aguante, y 38-41.
```
`lerp(a,b,u)`: interpola solo posiciones; **si un salto de posición supera 150 px (saque tras gol) toma el nuevo sin interpolar**. `predict(dt,auth)`: mueve *mi* avatar con el eje propio y las mismas constantes (pared incluida, ignora a los rivales) y se reconcilia con `c.util.suave(pred, auth)`. **La pelota no se predice** en v1 (decisión de M3: solo se anima un «pie» local al pulsar A, sin mover la pelota). Es el riesgo principal de jugabilidad a 300 ms (§7 P1).

### 3.5 Mensajes
| Tipo | Quién | Carga | Notas |
|---|---|---|---|
| `i` | humano | ≤45 B | runtime |
| `s` | juez | ≤300 B | runtime, 10 Hz |
| `ev gol` | juez (`c.ev('gol',{t,a,kk})`) | ≤80 B | cosmético (sonido/burbuja); el marcador sale del `pack` |
| `ev oro` | juez | ≤30 B | arranca el gol de oro |
| `ev carro` | juez | ≤30 B | lv3 |

### 3.6 CPU (`ai(p,dt,api)`)
Reparto dinámico por equipo en cada decisión: **atacante** = el miembro más cercano a la pelota (empate ⇒ menor índice); **defensor** = el otro. Decide cada `rt = max(0,18, 0,30 − 0,15·skill)` s (no lee más rápido). Atacante: va al punto *detrás* de la pelota (a `R+RB+14` px sobre la línea pelota→arco rival), gira el frente con el stick hacia el arco, y cuando el ángulo frente–arco ≤25° y la pelota está en alcance mantiene A `6 + round(12·skill·dist/500)` ticks y suelta; corre si está a >140 px. Defensor: se coloca a 110 px de su arco sobre `y = lerp(CY, bola.y, 0,6)`; si la pelota cruza su mitad y él está más cerca que el atacante, intercambian roles. Error de apuntado `σ = 0,35·(1−skill)` rad. Si un humano es más cercano, la CPU compañera pasa a defensora (no le «roba» la pelota).

### 3.7 `destacado()` y `vista()`
`destacado()` → «¡3 – 2! Goleador: NOMBRE» / «0 – 0: ni la pelota se quiso mover». `vista()` → `{k, s:[s0,s1], pelota:{x,y,vx,vy}, jug:[{x,y,frente,carga,aguante}], oro, frz, goles:[…], reg, equipos}` (observable para pruebas).

### 3.8 Dibujo
Calle de asfalto vista desde arriba con rayas de «cancha», aceras y público en el borde alto; arcos de chancletas (lv1) / porterías de cartón (lv2-3); jugadores con `c.util.pj(seat.ch, x, y, h, op)` más aro del color del equipo bajo los pies y **flecha/aro «TU ARCO»** para quien mira; compañero con anillo punteado y «PANA». Nada importante en `y<64` ni en la franja de los pads. Solo primitivas (el estilo objetivo es `snes`; los otros no se prueban); `drawP/say/spawn/snd` con `typeof`.

### 3.9 Pruebas de E2 (`test/fiesta-juego-futbolito.test.js` + `docs/style-lab/pruebas/fiesta-futbolito-bench.js`)
Contexto falso con `modo:'2v2'`, `equipos`, `ahora()` manual (molde: `test/fiesta-juego-patilla.test.js:mkCtx`; cuando exista, `LIVE.sim`). Obligatorias: registro y paridad con `CATALOGO` (`lim`, `mo`, `cl`, `m`); lint (sin `Math.random/Date.now`, sin `ctx.fill/stroke/arc/lineTo/drawImage/fillText/beginPath`, sin sintaxis fuera de ES2015, sin `send/on` x*); `pack` ≤300 B y `restore(pack)` ⇒ la partida continúa **idéntica** a la continua (hash del estado cada 30 ticks); `lerp` no cruza saques; reglas (autoría del gol y autogol, pase asistido, compañeros no colisionan, gol de oro, empate a `dur`, `done()`); puntajes **enteros dentro de `lim` con `dur ∈ {3, 8, 12, 60}`** y suma por equipo = marcador; CPU (los 4 CPU producen ≥2 y ≤8 goles de media, nadie se queda quieto); ociosos (2 humanos ociosos pierden ≥90 % contra 2 CPU nivel 2); **balance** (200 semillas × lv1-3, 4 CPU skill .6): `|P(gana eq0) − P(gana eq1)| ≤ 10 pp` y empates ≤30 %, ganador decidido con `compara`; `draw()` sin excepciones en `gt∈{−2,0,5,reg,reg+1}`, 3 niveles y n=2/4 (solo primitivas). Con E1/G2: matriz de red 50/150/300 ms (mismo `h` en las 4 pantallas), juez muerto en 3 instantes (un solo veredicto), un humano caído (`ev cpu` en [2;3,5] s), presupuesto de mensajes. Con `LIVE_FULL=1`: ventaja del juez (60 semillas a 150 ms; el equipo del juez gana ≤ 58 %, se **reporta**).

---

## 4. `f_patilla` · ¡LA PATILLA GIGANTE! (1v3, binary, **B**) — dueño: E3

Archivo: `docs/style-lab/fiesta-juego-patilla.js` (**ya existe; E3 lo adopta**, §0.1). Esta sección es el contrato; §4.9 lista lo que el prototipo leído a las 18:43 debe cambiar.

### 4.1 Reglas
- **Roles** (`c.solo`): el **solo** («el señor del camión») está arriba de la calle; el **trío** esquiva abajo. Con 1-2 humanos el resto son CPU (el solo puede ser CPU; vale igual, 08 §7).
- **Calle** lógica `SW=560 × SH=300` centrada en `c.campo()`; el solo vive sobre el camión (fila `Y0`), el trío se mueve en la calle (`y∈[70,SH−14]`).
- **Solo**: stick **X** lo mueve a lo largo del camión (230 px/s); stick **Y** inclina el tiro (±0,45 rad, se fija al pulsar); **A** suelta. **3 tiros** (`nShots = 3` si `dur≥24`, 2 si `≥12`, 1 si menos), el primero tras `lead = min(2,5; 0,12·dur)` s, enfriamiento `CD = 7 s` (si `dur<24`, `max(3; 0,25·dur)`). Al pulsar, **amago de 0,8 s** (`WIND`): el tiro queda fijado y se avisa YA a todos con `xtiro`; la patilla sale a `tl`. Mientras dura el amago el solo no se mueve.
- **Patilla**: función **pura** `pieces(tiro, gt)`; radio `R = 36·WIDTH·RK[lv]` (`RK=[1;1,1;0,62]`), avance `y(τ)=Y0+(150·τ+90·τ²)·VK[lv]` con `VK=[1;1,2;1]`. lv1 recta; lv2 rebota en las aceras (`fold`); lv3 además se **parte en dos mitades** a `SPLIT_T=0,5 s` (±0,45 rad, radio ×0,72).
- **Trío**: stick 172 px/s; **A = salto** (0,55 s en el aire; invulnerable entre 0,08 y 0,47 s; enfriamiento 1,7 s). **Golpe**: lo juzga *la propia víctima* en cada cuadro contra su posición (`dist(elíptica 1,15) < r + BODY(13)`, no en el aire); un golpe aturde 1,1 s (70 px/s). **Un golpe se cuenta una vez por (tiro, víctima)** (§4.9 D1).
- **Resultado**: `hits` = golpes totales. **Gana el solo con `hits ≥ 3`** (repetidos cuentan, 08 #20); si no, el trío. El juego termina cuando se resolvió el último tiro (`done()`), o a `dur`.
- **Gag/escena**: calle de mercado en bajada con puestos de toldos; «¡SE LE SOLTÓ LA PATILLA AL SEÑOR DEL CAMIÓN!» (el solo ve «¡SUÉLTALA!»), «¡PLAF!» al golpe, «¡CUIDADO!» en el amago; la sombra roja del trayecto durante el amago es la **telegrafía** (≥0,5 s también a 300 ms de latencia: 0,8 s de amago).

### 4.2 Controles
`stick:true, botones:1`. Solo: izq/der mover, arriba/abajo inclinar, A soltar. Trío: stick mover, A saltar. Teclado WASD/flechas + Espacio. La tarjeta muestra primero el rol propio (`carta.roles`, DM3-7).

### 4.3 Modelo B: cuerpo y mensajes
| Tipo | Quién | Contenido | Tamaño |
|---|---|---|---|
| `o` | dueño; el juez las CPU | cuerpo `['x','y','j','st']` (enteros; discretos `j`,`st`) | ≤70 B/cuerpo |
| `xtiro` | el solo (o el **juez por la CPU solo**) | `{i, x, a, tl}`: nº de tiro, `x` de salida, ángulo×100, `tl` = ms de `gt` en que sale | ≈55 B (tope 200) |
| `ev hit` | la víctima (el juez por una CPU) | `c.ev('hit',{i,pc},p)`; `p` = víctima | ≤80 B |
`c.send` **no se devuelve a sí mismo**: quien manda aplica el tiro localmente además de enviarlo. `ev` sí llama a `g.onEv` localmente (runtime).

### 4.4 Puntaje y topes (DM3-3, DM3-2)
`scores()`: solo `= 10·hits`; cada miembro del trío `= 25`. `compara('1v3', …)`: gana el solo ⇔ `10·hits > 25` ⇔ `hits ≥ 3`; sin empate posible. `lim:{scoreMax:90, scoreRate:12, minT:6, finTemprano:1}`: máximo de diseño 9 golpes (3 tiros × 3 víctimas) = 90; el trío (25) cabe en `12·(6−0,4+1,5)=85` y en `12·(3+1,5)=54` con `dur=4`. HUD: `hudChip` — solo `hits+'/3'`, trío `'LIMPIO'` o `'×'+golpesRecibidos`. `destacado()`: «¡N patillazos!» / «esquivaste todas las patillas».

### 4.5 Balance del solo (perilla única: ancho de la patilla)
Objetivo: **el solo gana 38-52 %** con 4 CPU de igual habilidad (skill .6 = `cpuNivel` 2), **por nivel**. La perilla es `WIDTH` (multiplica `R`); por nivel se ajusta con `RK[lv]`. Rango válido de `R` efectivo: 26-70 px. Orden de ajuste: (1) `WIDTH`/`RK`; (2) si no alcanza, `VK` (velocidad); **nunca** se toca el modelo de la CPU (lapsos `0,01·(1−skill)`, error de apuntado `ERR0−ERR1·skill`, reacción `0,4−0,2·skill`) una vez medido: esos números *definen* «igual habilidad». Informativo (no bloquea): skill .35 y .85 en [30, 60] %.

### 4.6 CPU
Solo CPU: elige el racimo más denso del trío (con error según skill), se mueve en X, inclina y suelta. Trío CPU: reacciona `rt = 0,4 − 0,2·skill` s después de ver el tiro, simula riesgo futuro 0,8 s sobre 9 direcciones, salta si no hay salida, a veces se descuida. (Ya implementado; se conserva.)

### 4.7 Niveles
1 rectas (día) · 2 rebotes en las aceras (atardecer) · 3 se parte en dos (noche, farolas). Paletas por nivel en `PAL`.

### 4.8 Pruebas de E3 (`test/fiesta-juego-patilla.test.js`, ya hay 9)
Se conservan. **Cambios** (D6-D7 de §4.9): decidir al ganador con `FIESTA.reglas.compara('1v3', c.equipos, scores())` y no con `g.ganaSolo()`; añadir (a) `res.aj===false` y `sc` dentro de `lim` en 200 semillas con `dur ∈ {3,8,12,35}`; (b) prueba de red con el arnés del G2: solo **CPU** + 3 humanos, 50/150/300 ms, los tres tiros llegan a las 4 pantallas y mismo `h` (esto confirma/desmiente D2-D3); (c) juez muerto con un tiro en vuelo; (d) solo humano caído en pleno amago; (e) `LIVE_FULL`: ventaja del juez (el asiento juez gana ≤ 1/n + 8 pp).

### 4.9 Diferencias del prototipo (leído a las 18:43) con este contrato
Ninguna se corrió en red; cada una trae la prueba que la confirma.
| # | Qué | Por qué | Arreglo |
|---|---|---|---|
| **D1** | La clave de golpe es `i*100 + pc*10 + p` (por *pieza*): en lv3 una víctima puede recibir ambas mitades de un mismo tiro ⇒ hasta 18 golpes = 180 > `scoreMax` 90 ⇒ el servidor recortaría (`aj`). | `res.aj` debe ser falso (M2 §6). | Clave `i*10 + p` (una vez por tiro y víctima); `pc` solo cosmético. |
| **D2** | `c.on('xtiro', …)` acepta solo si `p === soloI \|\| p === undefined \|\| p < 0`. Cuando el **solo es CPU**, quien manda `xtiro` es el **juez** (un miembro del trío): `p` = índice del juez ≠ `soloI` ⇒ **las otras 3 pantallas descartan todos los tiros de un solo CPU** y no ven ni esquivan nada. | Es el caso normal con 1-3 humanos. | Aceptar si `p === soloI \|\| c.cpu[soloI]` (la sesión ya mantiene `c.cpu[]` con `ev cpu/hum`). Validar `d.i === nThrown()` y `d.x/d.a` acotados. |
| **D3** | `addShot` no actualiza `P[soloI].nextShot`; solo `tirar()` (en quien dispara). Tras una **migración de juez** o un solo **caído**, el nuevo controlador tiene `nextShot=lead` y puede soltar otro tiro sin respetar el enfriamiento de 7 s. | Cooldown y 3 tiros deben sobrevivir al relevo. | En `addShot`: `P[soloI].nextShot = max(P[soloI].nextShot, tl/1000 + CD)`; `nThrown()` ya cuenta los recibidos. |
| **D4** | Sin `hudChip`: la ficha de cada miembro del trío mostraría 25. | §2.2 punto 4 y §2.5. | `hudChip(p)` §4.4. |
| **D5** | `ganaSolo/claimOk/concede` presentes. | DM3-4: sin efecto. | Pueden quedar como ayudas de prueba (`vista().gana`), no son contrato; `claimOk/concede` se quitan (no es modelo B con `claim`). |
| **D6** | La prueba de balance decide con `g.ganaSolo()`. | Debe probar el camino real. | `compara` (§4.8). |
| **D7** | `roles.solo/trio` tienen solo `obj`+`como` (suficiente: se funden sobre la base). | — | Sin cambio; `LIVE.add` lo valida (§2.4). |
| **D8** | `done()` solo cierra tras el último tiro; con 3 golpes ya ganó el solo y el resto es teatro. | Duración, no corrección. | Opcional: `hits≥3 ⇒ done()` (el catálogo ya permite `minT:6`). Decisión de E3. |

---

## 5. Cambios exactos de infraestructura (E1)

### 5.1 `docs/style-lab/fiesta-reglas.js`
- `CATALOGO:68`: `f_futbolito` ⇒ `…dur:60,mo:'C',lim:{scoreMax:15,scoreRate:0.5,minT:44,finTemprano:1}` (**sin** `live:1` hasta G3). `:70` `f_patilla` ya está.
- (Opcional G2) exportar `eqIdx(mj)` y reutilizarlo en `resultadoMJ`.
- El servidor recibe este mismo archivo (`scripts/sync-fiesta-rules.sh` en el Dockerfile y en `pocketbase/dev.sh` → `pb_hooks/fiesta-reglas.js`, copia generada e ignorada por git). Las pruebas de Node leen la fuente de `docs/style-lab`; para el PocketBase real del e2e basta re-sincronizar (`pb-harness.js` ya lo hace). No hay un segundo catálogo en `party_catalog.js` (es de los microjuegos clásicos).

### 5.2 `docs/style-lab/fiesta-live.js`
- `add()` (`:81`): validaciones de §2.4 (roles en 1v3; `clase==='binary'` para 2v2/1v3). **Sin** paridad de `dur`.
- `create()` contexto `c` (`:520`): añadir `mate(p)` y `rol(p)` (§2.1).
- `S.hud()` (`:576`): campos de §2.5 (`tipo, solo, items[].{mate,rol,tsc,txt}`); `txt` = `g.hudChip` protegido con `try`.
- `practicaHumano` (`:735`): `return practica && !opts.sim && j === yo`; `skill[i]` (`:146`): `opts.skillFix` admite arreglo.
- `practice(id,o)` (`:741`): rama de equipo (§2.7); rama actual **intacta** para `ffa/1v1`. Extraer `localSession(id,o)` y construir `practice` y `sim` sobre ella.
- Nueva `LIVE.sim` (§2.7) y exportarla en `F.LIVE`.
- Quitar `ganaSolo/ganaEquipo` de la documentación del contrato (no hay código).

### 5.3 `docs/style-lab/fiesta-carta.js`
- `dibujarTarjeta` (`:353`): fundir `roles` (§2.4); `sm` con «Tu pana: NOMBRE» en 2v2.
- `demo()` (`:408`): rama `dibuja` con `try/catch`; `dibujarTarjeta` pasa `dm.dibuja`.
- `dibujarHudFicha` (`:492`): §2.5 (valor, orden, franja, «PANA»); `layoutHud` sin cambios.
- `podioModelo` (`:98`) y `dibujarPodio` (`:535`): §2.6; nueva `tituloPodio` pura exportada en `F.carta`.
- `C.practica` (`:180`): pasa `rol` calculado de `sess.c.solo/yo`.

### 5.4 `docs/style-lab/fiesta-main.js` y `fiesta.html`
- `main:246`: leer `rol` (`q.get('rol')`) y pasarlo a `F.LIVE.practice`.
- `fiesta.html`: tras la etiqueta de `fiesta-juego-harina.js` añadir `fiesta-juego-patilla.js` (**ya**, G0) y `fiesta-juego-futbolito.js` (G3), mismo `?v=1792000000`.

### 5.5 `pocketbase/pb_hooks/party_mj.js`
Solo `LIM_DEFECTO` (+2 entradas, igual al catálogo). Sin cambios de lógica.

### 5.6 Pruebas
- `test/helpers/live-arnes.js`: extraer `memStore, crearSala, arnes` de `test/fiesta-live.test.js` y generalizar `crearSala`: opciones `tipo ('ffa'|'1v1'|'2v2'|'1v3')`, `eq`, `solo`; `mj.tipo/eq/solo/clase` coherentes; `mj.juez/suc` con el solo al final si 1v3; `humans` ≤4 y el resto CPU. `test/fiesta-live.test.js` pasa a usar el helper **sin cambiar sus aserciones**.
- `test/fiesta-teams.test.js` (nuevo): `formarMJ` 2v2/1v3 con catálogo vivo (elige los juegos; degrada si se apaga `live`); `puestos`/`pagosMJ`/`resultadoMJ` en las 4 formas de §2.2; `clampSc`/`validarFin` binario con `res.aj===false`; `add()` (roles); `practice` 2v2/1v3 (formas, rol); `sim` (determinismo: mismo seed ⇒ mismo `h`); `hud()` de equipo; `podioModelo`/`tituloPodio`; paridad de las 3 copias de `eqIdx`.
- `test/fiesta-carta.test.js`: tarjeta con `roles`, `demos.dibuja`, HUD por equipos, podio 2v2/1v3 en 800×600, 1000×460, 360×640.
- `test/fiesta-equipos.test.js` (nuevo, depende de E2/E3): matriz de red de ambos juegos (§3.9/§4.8).
- `pocketbase/pb_hooks/party.test.js` / `test/party-mj.test.js`: `validarFin` 2v2 y 1v3.

### 5.7 e2e
`test/fiesta-mj.e2e.js:19,35`: separar `JUEGOS` (los que se pueden elegir con `GAME=`) de `APAGAR_SIEMPRE=['f_futbolito','f_patilla']`, y que el parche del catálogo apague siempre estos (`(g:'f_x'[^}]*?),live:1` ya funciona con la línea nueva). No se escriben e2e de equipos en M3 (§7 P3). Correr `fiesta.e2e.js` y `fiesta-mj.e2e.js` al final de G3 y reportar.

---

## 6. Propiedad de archivos, puertas y aceptación

### 6.1 Propiedad (sin solapes; quien necesite un cambio ajeno lo **reporta**)
| Ing. | Crea / modifica | Pruebas propias |
|---|---|---|
| **E1 · runtime + servidor + catálogo + plumbing** | `fiesta-reglas.js`, `fiesta-live.js`, `fiesta-carta.js`, `fiesta-main.js`, `fiesta.html`, `party_mj.js` (solo `LIM_DEFECTO`), `test/helpers/live-arnes.js`, `test/fiesta-mj.e2e.js` | `fiesta-teams`, `fiesta-carta`, `fiesta-live` (refactor), `fiesta-equipos`, `party-mj`, `party.test.js` |
| **E2 · futbolito** | **crea** `docs/style-lab/fiesta-juego-futbolito.js` (antes: `ls` por si alguien ya lo hizo) | `test/fiesta-juego-futbolito.test.js`, `docs/style-lab/pruebas/fiesta-futbolito-bench.js` |
| **E3 · patilla** | **adopta y modifica** `docs/style-lab/fiesta-juego-patilla.js` | `test/fiesta-juego-patilla.test.js`, `docs/style-lab/pruebas/fiesta-patilla-bench.js` |

Ni E2 ni E3 tocan `fiesta-reglas.js`/`fiesta.html`: piden a E1. `fiesta-lobby.js`, `fiesta-ui.js`, `fiesta-director.js`, `fiesta-net.js`: nadie.

### 6.2 Puertas
1. **G0 (E1, primeras horas)**: `lim`/`dur` de futbolito; etiqueta de patilla en `fiesta.html`; e2e fija los juegos; correr toda la lista de §6.3 (debe seguir en verde).
2. **G1 (E1)**: `add()` + `c.mate/rol` + `hud()` + `practice` de equipo + carta/podio/HUD + `?practica=…&rol=`. Con G1, E2/E3 ven su juego en `fiesta.html?practica=<id>&rol=…` y en capturas (`pruebas/fiesta-juegos-capturas.js f_futbolito,f_patilla`). *Hasta G1, E2/E3 prueban con contexto falso.*
3. **G2 (E1)**: `live-arnes` con equipos + `LIVE.sim`. Desbloquea las matrices de red.
4. **G3 (todos)**: E2 entrega futbolito verde; E1 enciende `live:1` y la etiqueta de futbolito; corren los e2e; capturas con **Read** solo en `snes` a 360×640 y 932×430 (sin solapes con el HUD de 64 px ni con los controles).

### 6.3 Comandos de aceptación (todos en verde al final)
```
node --test test/fiesta-*.test.js test/duo.test.js test/squad.test.js test/party*.test.js
node pocketbase/pb_hooks/party.test.js
node test/fiesta.e2e.js
node test/fiesta-mj.e2e.js
LIVE_FULL=1 node --test test/fiesta-equipos.test.js        # ventaja del juez: se reporta
```

### 6.4 Criterios por juego (resumen de 08 §11.2)
Mismo `h` y mismos puestos a 50/150/300 ms con 5 % de pérdida; un solo juez por época; juez muerto ⇒ un solo veredicto; caído ⇒ CPU en [2; 3,5] s; tipos solo `x*` propios + reservados; mensajes ≤420 B y lote ≤512 B/10; ≤20 req/s por cliente; resultado dentro de `lim` sin `aj`; ociosos no ganan; **balance** (patilla 38-52 % por nivel; fútbol simétrico ±10 pp); `draw()` sin excepciones en `snes` (otros estilos fuera de alcance); carta con `obj/gana/como/demos` y, en 1v3, `roles`; práctica sin red ni semilla real.

---

## 7. Preguntas abiertas (solo lo que no se decide con los docs)

1. **P1 · Fútbol por relé HTTP a ≥200 ms.** La pelota no se predice (§3.4): el pateador la ve moverse tras RTT + D (~300-450 ms). Solo se sabe en 2 teléfonos reales con datos. Si es injugable, la salida ya documentada (08 §12) es excluir los juegos C de la bolsa cuando el transporte sea RELAY, o añadir un «empujón» predicho solo al pateador. ¿Se prueba antes de G3 o se acepta el riesgo hasta M3b?
2. **P2 · Patilla confía en la víctima (DM3-9).** Un tramposo del trío puede ignorar golpes. ¿Se acepta para jugar entre panas (como el resto del diseño) o se pide una auditoría del juez (el juez ve el cuerpo `o` de la víctima y la trayectoria y acusa un golpe que no llegó)? Sigo asumiendo «se acepta».
3. **P3 · Sin e2e de equipos en M3.** Los e2e de 3 contextos eligen formato por color de casilla; forzar 2v2/1v3 exige o parchear `formarMJ` o jugar muchas rondas. Propongo cubrirlo con el arnés de red (G2) y dejar el e2e para M3b. ¿Ok?
4. **P4 · Autoría de `fiesta-juego-patilla.js`.** Existe y cambia mientras se escribe esto (§0.1). Confirmar quién la escribe y que E3 sea el único dueño a partir de ahora; si no, hay dos autores sobre el mismo archivo.
5. **P5 · Orientación y color (DM3-5, DM3-14).** Orientación fija y «el solo siempre azul» son atajos de coste; se revisan tras ver el juego en pantalla, no antes.

---

## 8. Estado de E1 (plumbing) · 2026-10-17 19:2x

Hecho y verificado (corrido, no solo leído): `f_futbolito` con `live:1` en `fiesta-reglas.js` (G3, DM3-15) y su `<script>` en `fiesta.html`; `LIM_DEFECTO` con las 2 entradas; `add()` valida roles/clase; `c.mate/rol`, `hud()` de equipo, `practice` 2v2/1v3 y `LIVE.sim`; tarjeta por rol, `demos[].dibuja`, HUD por equipos, podio por lados; `?practica=<id>&rol=`.
Cambios de esta pasada: (1) `layoutPads` en vertical con stick + 2 botones (futbolito) encoge los tres pads proporcionalmente: antes B y stick se pisaban a 360×640; (2) rótulo del HUD («PANA·CPU» → «PANA», letra menor si no cabe) para fichas angostas de móvil; (3) `test/helpers/live-arnes.js` extraído (DM3-11; `fiesta-live.test.js` lo reexporta, así que las pruebas de E2/E3 siguen funcionando sin cambios); (4) `test/fiesta-mj.e2e.js` apaga todo juego `live:1` que no sea el probado con un solo patrón con callback (antes solo los 3 de M2: `f_chancla`, `f_patilla` y `f_futbolito` podían colarse), y espera `FIESTA_YA` por sondeo (leerlo en crudo fallaba con ReferenceError si la fase pasaba a `juego` un cuadro antes).
Fragilidad conocida (no es de equipos): `fiesta-mj.e2e.js` aserta «el humano que jugó supera al ocioso» y en `f_mecate` con `dur:12` esa diferencia es de un solo salto (120 vs 90); una corrida de tres falló por temporización (90 = 90), las demás pasaron.
