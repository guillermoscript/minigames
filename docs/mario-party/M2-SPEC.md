# M2 · Minijuegos EN VIVO: contrato congelado (2026-10-17)

> Hito M2 de `07-multijugador-online.md` §10. Este documento es el **contrato congelado** para 5 ingenieros que trabajan en paralelo sobre archivos disjuntos. Si algo choca con 07/08/09, **gana este doc para M2** y el glosario de 07 §2.1 para todo lo que este doc no toca. Cada decisión que se aparta de 07/08/09 está marcada **DM2-n** (§0.2) con su motivo.
>
> Reglas duras (de la tarea): no romper `node --test test/fiesta-*.test.js` (106 pruebas hoy), `test/duo.test.js`, `test/squad.test.js`, `test/party*.test.js`, `node pocketbase/pb_hooks/party.test.js`, `node test/fiesta.e2e.js`; no tocar `fiesta-lobby.js` ni `fiesta-ui.js` (si hiciera falta un enchufe, se reporta, ver §5.8); no usar `fiesta-vs.js`, `vs.html`, `juegos-vs-lista.js`, `juego-f-*.js`, `mapa-ilustrado*`, `mapa-referencias*`, `mapa-tablero*`, `assets/venezuela-board/`; **sin `Math.random` en lógica de juego** (se usa `c.rng`); sin commits; todo código compartido con el servidor en **ES2015 compatible con Goja** (sin `?.`, `??`, spread de objetos, `async`, clases con campos privados); mensajes ≤420 B, cuentas acumulativas para los toques, **un `o` por emisor**; dibujo solo con primitivas del laboratorio.

---

## 0. Resumen

### 0.1 Qué se entrega

| Pieza | Qué es | Dueño |
|---|---|---|
| `fiesta-live.js` | Registro `FIESTA.LIVE`, sesión de minijuego (modelos A/B/C/Ceq), juez, CAS, reloj, interpolación, veredicto, práctica. Núcleo **sin DOM** | E1 |
| `fiesta-carta.js` + `fiesta-main.js` | Flujo de pantalla: ruleta de formato, tarjeta, PRÁCTICA, ¡LISTO!, cuenta 3-2-1, HUD, controles, podio, regreso al tablero | E2 |
| Servidor | Rama `fiesta` de `sigPayload`, `mjfin`/`mjack` reales, caché del relé, presencia, elección de juez, validación de topes, migración | E3 |
| `f_mecate` (A), `f_domino` (B), `f_harina` (C) | Los 3 juegos de la rebanada | E4 (mecate, domino), E5 (harina) |
| Pruebas | Arnés de N clientes sobre `memRelay`, lista de verificación por juego, e2e con 3 contextos | E1 (arnés), E5 (lista), E2 (e2e) |

### 0.2 Decisiones (DM2)

| # | Decisión | Por qué / dónde se aparta |
|---|---|---|
| **DM2-1** | **Modelos de los 3 juegos: `f_mecate` = A, `f_domino` = B, `f_harina` = C.** | Lo pide la tarea («uno por modelo de red»). 08/09 los dan como domino = A y harina = B. Para que domino sea B de verdad se le añade un objeto compartido (el **TRANQUE**, §6.3) y para que harina sea C de verdad se le añade movimiento con contacto (§6.4). `CATALOGO[f_domino].mo` pasa a `'B'` y `[f_harina].mo` a `'C'`. |
| **DM2-2** | **Archivos de juego: `docs/style-lab/fiesta-juego-<nombre>.js`** (`fiesta-juego-mecate.js`, `fiesta-juego-domino.js`, `fiesta-juego-harina.js`). Ids de registro: `f_mecate`, `f_domino`, `f_harina`. | `juego-f-f_domino.js` y `juego-f-f_harina.js` ya existen (borradores obsoletos de misma pantalla), y los globs `juego-*.js` de `public.html`/`probar.js` los recogerían. El prefijo `fiesta-` encaja en los globs ya existentes `fiesta-*.js` de `sync-world-assets.sh` y `COPY docs/style-lab/*.js` del Dockerfile: **cero cambios de despliegue**. |
| **DM2-3** | **Catálogo del servidor = `FIESTA.reglas.CATALOGO`** (en `fiesta-reglas.js`, que ya viaja a `pb_hooks/` por `sync-fiesta-rules.sh`). Cada entrada gana `live:1` y `lim:{scoreMax,scoreRate,minT,finTemprano}`. `FIESTA.LIVE.add` exige que `limites`, `clase`, `modelo` y `modos` coincidan con ella (prueba de paridad). | Una sola fuente para cliente y servidor; `party_catalog.js` es de los microjuegos clásicos y no se toca. |
| **DM2-4** | **La duración real es `mj.cola[i].dur`** (`c.dur`), nunca la constante del juego. `def.dur` es solo el valor por defecto del catálogo. | `test/fiesta.e2e.js` parchea `dur:\d+` a 4 en el reductor; los juegos deben aguantar `dur` ≥ 3 sin fallar. |
| **DM2-5** | **Contrato de autor de dos niveles de 08 §5, forma de cierre** (`g.update/draw/ai/scores/...`). C usa `g.step/pack/unpack/restore/predict` sobre el mismo `g` (no la forma pura `step(S,…)` de 09 §10.1, que queda como recomendación). | Un solo estilo para A, B y C. |
| **DM2-6** | `c.claim(id, cb)` es **por callback** (`cb('ok'|'no')`), no Promise. | Determinista en el arnés; sin microtareas. |
| **DM2-7** | **Todo mensaje de sesión lleva `q` = índice del juego dentro de la cola (`mj.i`)** (salvo `hb`, `rdy`, `react`, `_net_*`); los del juez llevan además `e`. Los `x*` se envuelven `{q, d}`. | Con cola > 1 (Relámpago) el alcance `m:<k>` es el mismo para todos los juegos; `q` evita que un mensaje de un juego se cuele en el siguiente. |
| **DM2-8** | El relé **descarta en silencio** (no falla el lote) los mensajes de tipo-juez (`s s2 w ok jg end`, `ev cpu/hum`) que no vengan del juez de la época y `q` vigentes. Se responde 200 con lo que quede. | Con 403 un `s` rezagado del juez viejo mataba el `hb` y el `ev` legítimos del mismo lote. |
| **DM2-9** | **Elección del juez**: lo escribe el reductor con la acción nueva `$ JUEZ_ELEGIR` que el hook dispara justo después de que se fija `startAt` (tras el último `LISTO` o en el `tick` de `cartaHasta`). Usa la presencia `fp:<code>:<asiento>` del `$app.store()` (RTT). Marca `mj.jz=1`. | 07 D8. El reductor no ve la presencia (vive en el store), así que la decisión se inyecta como acción. |
| **DM2-10** | `mjfin` **recorta** (no rechaza) los puntajes fuera de `[0, min(scoreMax, scoreRate·(t+1,5 s))]`; rechaza solo forma inválida, juez/época/`q` equivocados, fase equivocada o fin antes de `startAt + min(minT, dur−1)`. **El servidor nunca confía en `pl`**: recalcula los puestos con `compara` (y normaliza `survival`). | 07 §6.7 / 08 §4.7. |
| **DM2-11** | `mjack` se guarda en `room.extra.mjw` (≤4 entradas). En `tick` de `cierre`, si hay testigos, el servidor sintetiza `MJ_RESULTADO` con el de mayor `kk` (`por:'testigo'`); sin testigos queda el empate sin monedas ya existente. | 07 D10. |
| **DM2-12** | **Relé con caché**: `$app.store()` clave `fr:<code>` con una «sala delgada» (`slimRoom`), TTL 1 s, **invalidada después del commit** de toda acción de escritura. | 07 §4.2. |
| **DM2-13** | **Migración nueva `1792100000_party_fiesta_mj.js`**: sube `/api/party/sig` a 14 400/60 s (dos salas tras el mismo NAT, 09 §12.3) y añade tope a `back`, `leave`, `start`, que no tenían. Las rutas de M2 (`ready`, `juez`, `mjfin`, `mjack`, `time`) **ya** tienen regla en `1792000000`. | La tarea pide «límites de tasa en una migración nueva». |
| **DM2-14** | Pedazos que **no** entran en M2 (se declaran, no se simulan): mirones en vivo (`w`, D18; quien toma un asiento a mitad de juego y los espectadores ven una tarjeta «mirando»), saltar el podio tocando (el reductor no tiene la acción), 2v2/1v3 (los 3 juegos son ffa/1v1), voz, AFK rápido por presencia. | Alcance de M2 (07 §10). El Relámpago (cola de 5) **sigue funcionando** en el reductor pero no es criterio de aceptación. |
| **DM2-15** | Mientras no haya juegos vivos de 2v2/1v3 en el catálogo, `formarMJ` **degrada** el formato a `ffa` (eq individuales, `solo:null`) y filtra la bolsa por `live:1`. La regla es «si ninguna entrada `live` admite ese formato»: cuando M3 registre `f_futbolito` no hay que tocar nada. | Evita `pick([])` y mantiene los tests actuales (`tipo ∈ ffa/2v2/1v3`). |
| **DM2-16** | `fiesta-net.js` gana **una** función: `N.silence(id)` (segundos desde el último mensaje, de cualquier tipo, del asiento `id`). | El `hb` lo consume el transporte (`NUCLEO`) y nunca llega al juego; sin esto no se puede medir el silencio del juez (1,2 s). |

### 0.3 Convenciones

- Asientos: en `board`/`room`/mensajes del servidor, letras `'a'..'d'`. En `c` (contexto de juego) y en `o.b`, **índices** `0..n-1` sobre `mj.as` (ya ordenado `a<b<c<d`); `c.seats[i].id` es la letra. Espectador: `c.yo = -1`.
- Tiempos: `gt` = `(serverNow() − mj.startAt)/1000` (s, puede ser negativo). Tick de juego `kk = Math.floor(gt·30)`.
- Reservados (los usa el runtime; un juego que los envíe **falla la prueba**): `i o s s2 w cl ok ev end hb rdy jg aim react frame _net_ping _net_pong`. Tipos propios: `/^x[a-z0-9]{1,11}$/`, ≤200 B.
- Constantes del reductor que se usan tal cual: `FIESTA.reglas.T = {cpu:400, carta:4500+15000, cuenta:3500, cierre:3000, res:5000, relCarta:1400, relRes:1200}`.

---

## 1. Propiedad de archivos, pruebas y comandos

| Ing. | Crea / modifica | Pruebas que escribe |
|---|---|---|
| **E1 · runtime** | **crea** `docs/style-lab/fiesta-live.js`; **modifica** `docs/style-lab/fiesta-net.js` (solo `N.silence`, DM2-16); **crea** `test/helpers/live-harness.js`, `test/helpers/live-fakes.js` | `test/fiesta-live.test.js`; una prueba añadida a `test/fiesta-net.test.js` (`silence`) |
| **E2 · flujo de cliente** | **crea** `docs/style-lab/fiesta-carta.js`; **modifica** `docs/style-lab/fiesta-main.js`, `docs/style-lab/fiesta.html`; `fiesta-ui.js`/`fiesta-lobby.js`: **ninguna** modificación prevista (§5.8) | `test/fiesta-carta.test.js`, `test/fiesta-mj.e2e.js` |
| **E3 · servidor y reglas** | **modifica** `pocketbase/pb_hooks/party.js`, `party_routes.js`, `docs/style-lab/fiesta-reglas.js`; **crea** `pocketbase/pb_hooks/party_mj.js`, `pocketbase/pb_migrations/1792100000_party_fiesta_mj.js` | `pocketbase/pb_hooks/party.test.js` (ampliar), `test/party-mj.test.js`, `test/fiesta-reglas.test.js` (ampliar) |
| **E4 · juegos A y B** | **crea** `docs/style-lab/fiesta-juego-mecate.js`, `docs/style-lab/fiesta-juego-domino.js` | casos de `test/fiesta-juegos.test.js` los pone E5; E4 aporta **solo** el juego y su `g.vista()` |
| **E5 · juego C y lista de verificación** | **crea** `docs/style-lab/fiesta-juego-harina.js`, `test/fiesta-juegos.test.js`, `test/helpers/lab-vm.js`, `docs/style-lab/pruebas/fiesta-live-probar.js` | `test/fiesta-juegos.test.js` |

Sin solapes: nadie edita un archivo de otro. Si alguien necesita un cambio ajeno, lo **reporta** (no lo hace). Excepción acordada: E2 añade en `fiesta-main.js` el parámetro `?practica=<id>` (§5.7) que E5 usa para capturas.

**Comandos de aceptación (todos deben pasar al final):**

```
node --test test/fiesta-*.test.js          # incluye fiesta-live, fiesta-juegos, fiesta-carta
node --test test/party*.test.js            # incluye party-mj
node test/duo.test.js && node test/squad.test.js
node pocketbase/pb_hooks/party.test.js
node test/fiesta.e2e.js                    # M1, debe seguir verde
node test/fiesta-mj.e2e.js                 # M2 (PocketBase real vía test/helpers/pb-harness.js)
```

**Orden de entrega (puertas):**

1. **G0** (E3, primeras horas): `CATALOGO` con `live/lim`, `JUEZ_ELEGIR`, `hashRes`, `normSurvival`, `puestos`, degradación de formato (§3.2). Desbloquea a todos.
2. **G1** (E1): `LIVE.add/get/ids/util/practice` y `c` completo en modo práctica (sin red). **G1b** (E2): `fiesta.html` con la lista de scripts de §5.6, `fiesta-carta` mínimo (pads + HUD) y `?practica=<id>` (§5.7). Con G1+G1b, E4/E5 corren y miran sus juegos solos.
3. **G2** (E1+E3): sesión sobre red + `live-harness`. Desbloquea la lista de verificación de E5.
4. **G3** (E2): flujo completo en `fiesta.html` (ruleta, tarjeta, cuenta, podio, regreso). Desbloquea el e2e.

---

## 2. Formato en el cable

### 2.1 Petición de relé (`POST /api/party/sig`)

```json
{"code":"ABCD","id":"b","key":"…","sc":"m:7","m":[{"t":"o","d":{…},"n":41,"l":true,"v":"x9k2ab3c"}]}
```

`sc ∈ "b" | "m:<k>"`. Lo arma `fiesta-net.js` (ya existe). Respuesta: `{ok:true, n:<suscriptores>, now}` o `{ok:true, n:0, dropped:<m>, now}` si todo se descartó (DM2-8).
Mensaje relevado a los demás (tema `rooms/<id>/sig`): `{from:"b", sc:"m:7", at:1792345678901, m:[…]}` (`at` lo pone el servidor; `fiesta-net.js` ya lo ignora salvo para dedupe).

### 2.2 Mensajes de sesión (`d` de cada mensaje; `q` = `mj.i`)

| `t` | Canal | Emisor | `d` | Tamaño |
|---|---|---|---|---|
| `i` | latest | humano, **solo** C/Ceq o `def.entradas:true` | `{"q":0,"b":3,"a":[12,4],"x":-40,"y":100}` `b` bit0=A sostenido, bit1=B; `a=[ta,tb]` **cuentas acumulativas** de toques; `x,y` ∈ −100..100 enteros | ≤45 B |
| `o` | latest | cada dueño (A/B); el juez mete además a las CPU y caídos | `{"q":0,"t":12340,"b":[[1,24,0,3],[2,0,1,412]]}` `t`=ms de juego del emisor; cada cuerpo = `[idxAsiento, ...valores en el orden de def.cuerpo]`, **enteros** | ≤70 B por cuerpo |
| `s` | latest | **juez** (C) | `{"q":0,"e":0,"t":12333,"p":[…ints]}` `p=g.pack()`; `t = round(k·1000/30)` | ≤300 B (tope 420) |
| `s2` | latest | juez | desborde, mismo `{q,e,t}`; solo si `pack` > ~60 ints; las dos mitades se unen por `t` | ≤420 B |
| `w` | latest | juez | **reservado**, no se emite en M2 (DM2-14) | — |
| `ev` | fiable | cualquiera (`cpu`/`hum`: solo juez) | `{"q":0,"e":0,"ty":"out","p":2,"d":{"kk":412}}`; `ty:"cpu"` → `{"q","e","ty":"cpu","p":1}`; `ty:"hum"` → `{"q","e","ty":"hum","p":1,"d":[…cuerpo]}` | ≤80 B |
| `cl` | fiable | humano (B) | `{"q":0,"id":"tr1","t":12340}` `t`=ms de juego del que reclama | ≤30 B |
| `ok` | fiable | juez | `{"q":0,"e":0,"id":"tr1","p":2}` `p`=índice ganador o −1 | ≤30 B |
| `jg` | fiable | juez nuevo (tras el CAS) | `{"q":0,"e":1}` | ≤20 B |
| `end` | fiable | juez | `{"q":0,"e":0,"kk":1350,"sc":[1351,300,412,380],"pl":[1,4,2,3],"h":2891736401,"cpu":["c"]}` | ≤130 B |
| `rdy` | fiable | cualquiera, en la tarjeta | `{}` (cortesía: el ✓ sale antes que el SSE) | 5 B |
| `x*` | libre | juego | `{"q":0,"d":<lo del juego>}` | ≤200 B |
| `hb`, `aim`, `react`, `_net_*` | — | transporte / tablero | sin cambios (los emite `fiesta-net.js`) | — |

- `h = FIESTA.reglas.hashRes(sc, pl, kk)` (FNV-1a de 32 bits de `sc.join(',')+'|'+pl.join(',')+'|'+kk`, §3.2). `kk` = tick del fin (`Math.round(min(gt,dur)·30)`).
- **El juez reenvía `end`** (mismo contenido) a +1,0 s y +2,5 s mientras `board.f==='mj'`; el manejador es idempotente.
- Cadencias: `o` 12 Hz (`def.bodyHz`), `s` 10 Hz (`def.snapHz`), `i` al cambiar ≤20 Hz + keepalive 4 Hz.

### 2.3 Peticiones HTTP nuevas o completadas

**`POST /api/party/mjfin`** (solo el juez):

```json
{"code":"ABCD","id":"c","key":"…","q":0,"e":0,"kk":1350,"sc":[1351,300,412,380],"h":2891736401,"cpu":["d"]}
```

Respuesta 200 `{"room":{…},"ok":true,"aj":false,"now":…}` (`aj:true` = el servidor tuvo que recortar). Errores (todos con `room` en el cuerpo en los 409):

| Estado | Mensaje | Cuándo |
|---|---|---|
| 400 | `Bad result` | `sc` no es arreglo de `n` números finitos, `cpu` mal formado |
| 403 | `Not your seat` | `id` no está en `mj.as` |
| 409 | `Not now` | `board.f!=='mj'`, o `q` ≠ `mj.i` |
| 409 | `Judge changed` | `id` ≠ `mj.juez` o `e` ≠ `mj.e` |
| 409 | `Too early` | `now < startAt + min(lim.minT, dur−1)·1000 − 400` |

**`POST /api/party/mjack`** (cualquier humano de `mj.as`, también el juez no hace falta): `{code,id,key,q,e,kk,h,sc}` → 200 `{ok:true,now}`; 409 `Not now` si el juego ya cerró (el cliente lo ignora).

**`POST /api/party/juez`** `{code,id,key,k,e}` → ya existe (CAS en el reductor, acción `JUEZ`). Cambio: añadir comprobación `N.mj.as.indexOf(s) >= 0` (→ `asiento`), reiniciar nada más.

**`POST /api/party/ready`** `{code,id,key,on:true}` → ya existe (`LISTO`).

---

## 3. Servidor (E3)

### 3.1 Estructura

- **`pocketbase/pb_hooks/party_mj.js` (nuevo, ES2015/Goja, sin DOM):** `module.exports = function make(D) {…}` con `D = {fail, PartyError, player, reglas, SIG_MAX, SIG_COUNT, reactLimit}`; devuelve `{ fiestaSig, slimRoom, relayCache, elegirJuez, validarFin, mejorTestigo, K }`. `party.js` lo carga perezoso: `const MJ = () => MJm || (MJm = require(typeof __hooks === "string" ? `${__hooks}/party_mj.js` : "./party_mj.js")({…}))`.
- `party.js` cambios mínimos:
  1. `sigPayload(room, id, round, m, now, limiter, sc)`: **primera línea** `if (room && room.mode === FIESTA) return MJ().fiestaSig(room, id, sc, m, now, limiter);` (antes del chequeo `MODES.includes … state!=='round'`).
  2. `fiesta(room, action, body, now, rand, info, store)` gana el parámetro `store` (`{get,set,update}`) y las ramas `mjfin`, `mjack`, y el paso `fiestaElegir` tras `ready`/`tick`; la rama `juez` pasa `{t:'JUEZ', k, e, q: body.q}` al reductor.
  3. `fiestaTick`: antes del `reglas().tick`, si `due==='cierre'` aplica el testigo (§3.6).
  4. Exportar `fiestaSig`, `slimRoom`, `elegirJuez` para las pruebas.
- `party_routes.js`: `relay(e, body)` usa la caché (§3.4) y pasa `body.sc`; `exec` pasa `ghostLimiter` como `store`; `handle` invalida la caché tras el commit (§3.4); `mjfin`/`mjack` ya enrutan a `P.fiesta`.

### 3.2 Reductor `fiesta-reglas.js` (E3) — cambios exactos

1. **`CATALOGO`** (conservar el literal `dur:NN` para que el parche del e2e siga funcionando):

   ```js
   {g:'f_mecate', m:['ffa','1v1'],cl:'survival',dur:45,mo:'A',live:1,lim:{scoreMax:1351,scoreRate:31,minT:3, finTemprano:1}},
   {g:'f_domino', m:['ffa','1v1'],cl:'rank',    dur:30,mo:'B',live:1,lim:{scoreMax:1000,scoreRate:40,minT:27,finTemprano:0}},
   {g:'f_harina', m:['ffa','1v1'],cl:'rank',    dur:30,mo:'C',live:1,lim:{scoreMax:800, scoreRate:25,minT:27,finTemprano:0}},
   ```

   Las demás 21 entradas quedan sin `live` (sin `lim`). `minT` efectivo = `min(lim.minT, dur−1)` (así `dur=4` del e2e no rechaza el fin).
2. **`elegir(Z, modo)`**: filtra `m.indexOf(modo)>=0 && live`; **si no queda ninguno** devuelve `null` y `formarMJ` degrada (DM2-15): `tipo='ffa'; eq=as.map(s=>[s]); solo=null` y reelige con `'ffa'`. En duelos (`'1v1'`) siempre hay (los tres).
3. **Relámpago:** `mic` = `RELAMPAGO ∩ live` (`f_domino`, `f_harina`, `f_mecate`), repetido cíclicamente hasta 5 (con semillas nuevas), `dur:10`, `modelo` tomado del catálogo (no `'A'` fijo). Test existente: `cola.length===5`, `dur===10`, `tipo==='ffa'`.
4. **Cola > 1**: al avanzar `mj.i` (rama `rel` de `resultadoMJ`) además de lo que ya hace: `mj.e=0; mj.jz=0; mj.suc=<humanos de as menos mj.juez, en el orden original>`.
5. **Acción nueva `$ JUEZ_ELEGIR {k, juez, suc}`** (solo servidor `'$'`):
   válida si `(N.f==='carta'||N.f==='mj') && N.mj && a.k===N.mj.k && N.mj.e===0 && (N.mj.startAt==null || Z.now < N.mj.startAt)`, `juez ∈ humanos(N, mj.as)` y `suc ⊂ humanos` sin repetir y sin `juez`; efecto `mj.juez=juez; mj.suc=suc; mj.jz=1` (sin `fx`; el `set mj` sale solo por `cerrar`). Errores: `'cas'`.
6. **`JUEZ`** (CAS existente): añadir `if(N.mj.as.indexOf(s)<0)return'asiento'` y exigir además `a.q==null||a.q===N.mj.i`. Resto igual (`mj.juez=s; mj.e++; suc` sin `s`).
7. **`MJ_RESULTADO`** (`$`): `resultadoMJ` acepta además `a.cpu`, `a.h`, `a.por` (`'juez'|'testigo'`), `a.disputado`, `a.aj` y los guarda en `mj.res` junto a lo existente: `mj.res = {sc, puestos, pagos, empate, cpu, h, por, disputado, aj}`. **Nunca** se pasa `pl` desde el servidor (el reductor lo recalcula con `compara`).
8. **Utilidades nuevas exportadas** (puras, ES5):
   - `hashRes(sc, pl, kk) -> uint32` (FNV-1a, mismo bucle que `hash`).
   - `normSurvival(sc) -> sc'`: ordena de mayor a menor y une en un racimo los valores consecutivos que difieren ≤3 ticks (100 ms); cada racimo toma el valor **máximo** del racimo. Idempotente.
   - `puestos(tipo, eq, sc, clase) -> pl`: `tipo==='1v1'→'ffa'`; si `clase==='survival'` aplica `normSurvival` antes; luego `compara(tipo, eq, sc).puestos`. `eq` = índice de equipo por asiento (`R.equipos`).
9. `F.reglas` exporta además `T` (ya), `normSurvival`, `hashRes`, `puestos`.

### 3.3 `fiestaSig` (rama `fiesta` de `sigPayload`) — `party_mj.js`

Firma: `fiestaSig(room, id, sc, m, now, store) -> null | {from, sc, at, m}` (lanza `PartyError`). `room` puede ser la sala real o la delgada (§3.4).

```
1  p = player(room, id); if (!p || p.left) fail("Not in this room", 403)       // CPU sin clave: nunca llega aquí (auth ya falló)
2  if (typeof sc !== 'string' || !/^(b|m:\d{1,6})$/.test(sc)) fail("Bad scope", 400)
3  if (!Array.isArray(m) || !m.length || m.length > SIG_COUNT) fail("Bad message", 400)
4  b = room.board; mj = b && b.mj
   sc==='b'  → permitidos: hb aim react _net_ping _net_pong          (cualquier fase)
   sc==='m:K'→ exige mj && K === mj.k && (b.f==='carta' || b.f==='mj')  si no: fail("Round is over", 409)
              permitidos: hb i o s s2 w ev end cl ok jg rdy react _net_ping _net_pong  + /^x[a-z0-9]{1,11}$/
              y el emisor debe estar en mj.as (si no: fail("Not in this round", 403))
5  cada x de m → o = {t: String(x.t).slice(0,12), d: x.d !== undefined ? x.d : null}; copia n,l,v como hoy
   tipo no permitido → fail("Bad message", 400)
   tipo-juez (s s2 w ok jg end) o (ev con d.ty ∈ {cpu,hum}):
        se queda solo si id === mj.juez && d.e === mj.e && d.q === mj.i; si no se DESCARTA (DM2-8)
   tipo con q (i o ev cl x*): se descarta si d.q !== mj.i
   aim: se descarta si JSON(d) > 64 B o si hay otro aim del mismo asiento hace < 200 ms (store 'fa:<code>:<id>')
   react: reactLimit(room, id, now, store) (429 si excede); d.id string ≤24
6  hb en cualquier alcance: store.set('fp:'+code+':'+id, JSON.stringify({at: now, rtt: clamp(0,5000,int(d.rtt)), vis: d.vis===0 ? 0 : 1}))
7  tope por emisor: cubeta 'fl:<code>:<id>' = [fichas, ms] JSON, recarga 25/s, ráfaga 40, coste = nº de mensajes del lote;
   sin fichas → fail("Too many messages", 429). Una clave por asiento (NO usar limitRoom: serializa toda la sala).
8  si no queda ningún mensaje → return null
9  out = lo que queda; if (JSON.stringify(out).length > SIG_MAX) fail("Message too big", 413)
10 return {from: id, sc: sc, at: now, m: out}
```

Notas: `store` es el `ghostLimiter` de `party_routes.js` (`get/set/update`); en pruebas, un `Map` con la misma forma. `at` = `now` del servidor.

### 3.4 Caché del relé y presencia (`party_routes.js` + `party_mj.js`)

```js
// party_mj.js
slimRoom(o) → { code, mode:'fiesta', ver, players:[{id,left,cpu}], keys:{a:'…',…} /* solo asientos humanos, sin "u:" */,
                board:{ f, pj:{a:{cpu}}, mj: o.board.mj ? {k,i,juez,e,as,startAt,cierre,cartaHasta,rel,jz} : null } }
relayCache(store) → { get(code, loader, now), invalidate(code) }
   // get: lee 'fr:<code>' = JSON {at, v:<slim>}; vale si now - at < 1000; si no, v = loader() (findByCode+load+slimRoom), set, devuelve v
   // invalidate: store.remove('fr:'+code) (si el store no tiene remove: set(key, ''))
```

`relay(e, body)` en `party_routes.js`:

1. `code` limpio. `cached = cache.get(code, () => { rec=findByCode; return rec && rec.getString('mode')===P.FIESTA ? P.slimRoom(load(rec)) : (rec ? {classic:true} : null) })`. Si `null` → 404. Si es clásica → camino de hoy (findByCode + load, sin caché).
2. `P.auth(slim, id, key)`; `msg = voice ? vsigPayload… : P.sigPayload(slim, id, body.round|0, body.m, Date.now(), ghostLimiter, body.sc)`.
3. `msg === null` → `e.json(200, {ok:true, n:0, dropped:1, now})` sin difundir.

**Invalidación (obligatoria, DM2-12):** en `handle()`, **después** de que `runInTransaction` retorne (commit hecho), si `action` no es `sig|vsig|time|mine` → `$app.store().remove("fr:" + code)` (el `code` sale de `body.code`; en `create` de `out.room.code`). El TTL de 1 s es solo red de seguridad. Prueba: tras un `juez` (CAS), el siguiente `s` del juez nuevo **no** se descarta.

**Presencia (D20):** `fp:<code>:<asiento>` escrita por `fiestaSig` (paso 6). Se borra en `leave`/borrado de sala (mejor esfuerzo); si no, caduca por `at`.

### 3.5 Elección del juez (DM2-9)

`elegirJuez(mj, pj, pres, now) -> {juez, suc}` (pura, en `party_mj.js`). `pres[seat] = {at, rtt, vis}`.

```
humanos   = mj.as.filter(s => pj[s].cpu === null)
candidatos= humanos.filter(s => pres[s] && now - pres[s].at <= 4000 && pres[s].vis !== 0)
si candidatos vacío → {juez: mj.juez, suc: mj.suc}              // sin datos: se queda el provisional
si mj.tipo==='1v3' y existe c ∈ candidatos\{solo} con rtt(c) ≤ rtt(solo)+40 → quitar al solo de candidatos
rtt ausente = 9999. ordenar por rtt asc; G = {c : rtt(c) ≤ rtt(mejor) + 15}  (orden por letra)
juez = G[mj.k % G.length]
suc  = (candidatos \ juez ordenados por rtt) ++ (humanos \ candidatos \ juez, por letra)
```

`fiestaElegir(room, now, store)` (en `party.js`): si `b.mj && !b.mj.jz && b.mj.startAt != null && now < b.mj.startAt` → `fiestaStep(room,'$',{t:'JUEZ_ELEGIR',k,juez,suc},now)`. Se llama **después** de `fiestaStep(LISTO)` en la rama `ready` y **después de cada** `reglas().tick` en `fiestaTick`.

### 3.6 `mjfin` / `mjack` / cierre (E3)

`mjfin` (en `fiesta()`): ver §2.3 para los errores. Pasos tras validar forma, juez, época, `q`, fase, mínimo:

```
cat = reglas().CATALOGO.find(g === cola[mj.i].g); lim = cat.lim; dur = cola[i].dur
el  = clamp(0, dur, (now - mj.startAt)/1000)
cap = min(lim.scoreMax, lim.scoreRate * (el + 1.5))
sc' = sc.map(v => clamp(0, cap, round(v)))           aj = sc'.some((v,j)=>v!==round(sc[j]))
si cat.cl==='survival': sc' = normSurvival(sc')
h'  = hashRes(sc', puestos(tipo, eqIdx, sc', cl), kk)   // solo para comparar con testigos
witnesses = extra.mjw.w (mismo k,i); disputado = (≥2 testigos con h ≠ h')
fiestaStep(room,'$',{t:'MJ_RESULTADO', k, i, sc: sc', cpu: cpu∩as, recogidos: undefined, h: h', por:'juez', disputado, aj}, now)
```

`mjack`: `extra.mjw = {k,i,w:{<asiento>:{e,kk,h,sc:[≤4 números]}}}` (se reinicia si cambian `k`/`i`); solo si `b.f==='mj'`, `id ∈ mj.as`.
**Cierre por plazo** (`fiestaTick`, justo antes de `reglas().tick` cuando `b.f==='mj' && now >= b.mj.cierre`): si hay testigos del mismo `k,i` → `MJ_RESULTADO` con el de mayor `kk` (empate: asiento menor), mismos recortes, `por:'testigo'`, `disputado:true`; si no, el reductor cae al empate sin monedas ya existente. `mejorTestigo(mjw, k, i) -> {sc,kk}|null`.

### 3.7 Migración `pocketbase/pb_migrations/1792100000_party_fiesta_mj.js`

```js
const RULES = [
  { label: '/api/party/sig',   maxRequests: 14400, duration: 60 },   // era 7200 (1791150000)
  { label: '/api/party/back',  maxRequests: 120,   duration: 60 },
  { label: '/api/party/leave', maxRequests: 120,   duration: 60 },
  { label: '/api/party/start', maxRequests: 60,    duration: 60 },
];
// up: quita las reglas con esos label y añade RULES. down: deja sig en 7200 y quita back/leave/start.
```

### 3.8 Pruebas del servidor (E3)

`test/party-mj.test.js` (node:test, sin PocketBase) + ampliar `pocketbase/pb_hooks/party.test.js` + `test/fiesta-reglas.test.js`:

1. `fiestaSig`: alcance `b` vs `m:K` (409 si `K≠mj.k` o fase `turno`); lista blanca; tipo `xtiro` pasa y `xTiro`/`x`/13 caracteres no; juez-solo descartado si lo manda otro, con `e` viejo o `q` viejo (200 con lo restante, o `null` si no queda nada); tope 512 B/10 mensajes; cubeta 25/s (ráfaga 40 → 429); `aim` >64 B o >5 Hz se descarta; `hb` escribe `fp:`; `from` lo fija el servidor; clásicos intactos.
2. `elegirJuez`: menor RTT; empate ±15 ms rota con `mj.k`; 1v3 saca al solo si hay alternativa a ≤40 ms; sin presencia conserva el provisional; humano `vis:0` no es candidato.
3. `mjfin`: solo el juez; `e` viejo → 409; fin temprano → 409 (y con `dur=4` el mínimo efectivo es 3); recorte (`aj:true`) por `scoreMax` y por `scoreRate`; forma mala → 400; `pl` ignorado; `survival` normalizado; paga con `pagosMJ` (10/6/3/1) y `board.f==='res'`.
4. `mjack` y cierre: sin `mjfin` en `cierre` gana el testigo de mayor `kk`; sin testigos, empate sin monedas; `disputado` con ≥2 hashes distintos.
5. CAS `juez`: dos aspirantes con la misma `e` → gana uno, el otro 409; el nuevo `mjfin` con `e+1` pasa y con `e` viejo no.
6. Caché: `relayCache.get` sirve ≤1 s; `invalidate` fuerza recarga; simulación «commit de `juez` → `invalidate` → el `s` del juez nuevo pasa».
7. `fiesta-reglas.test.js`: `JUEZ_ELEGIR` (válida solo antes de `startAt`, solo `$`), `hashRes` estable, `normSurvival` idempotente y con racimos de 3 ticks, `puestos`, degradación a `ffa` con catálogo solo-ffa, relámpago con 3 juegos vivos (`cola.length===5`), `board` < 16 KB y sin `rng/semilla`.

---

## 4. Runtime `fiesta-live.js` (E1)

### 4.1 API pública (UMD: `window.FIESTA.LIVE` / `module.exports`)

```js
FIESTA.LIVE = {
  add(id, def),            // valida y registra; lanza Error si falta algo o no coincide con reglas.CATALOGO[id] (si F.reglas existe)
  get(id) -> def|null, ids() -> string[], defs,        // defs: {id: def}
  create(opts) -> Session, // sesión en red (§4.4)
  practice(id, opts) -> Practice,   // §4.8
  RESERVED: [...],         // lista de §0.3
  K: {…},                  // constantes de §4.9 (tests las leen)
  util: { fnv, hashRes, puestos, normSurvival, tick(gt), clamp, interp, suave, rngFrom, pj, cara }
};
```

`opts` de `create`:

```js
{ net,                 // instancia de fiesta-net (o compatible); lee net.board, net.you, net.room, net.serverNow(), net.channel, net.silence,
                       //   net.rtt, net.ready/juez/mjfin/mjack/sync
  yo,                  // letra del asiento propio (net.you.id)
  strict: false,       // true en pruebas: un c.send con tipo reservado/mal formado LANZA (en producción: se ignora y se avisa por log)
  log: fn(s)|undefined, onGo: fn({k,i,gt,wall})|undefined }
```

`def` (campos; * = obligatorio):

```js
{ name*, modos*:['ffa','1v1'], clase*:'rank'|'survival'|'binary', modelo*:'A'|'B'|'C'|'Ceq',
  dur*:number,                       // valor por defecto; el real es c.dur
  stick:bool, botones*:0|1|2, bodyHz:12, snapHz:10, entradas:false, migra*:true, minHumanos:1,
  limites*:{scoreMax,scoreRate,minT,finTemprano},   // deep-equal a CATALOGO[id].lim (finTemprano 0/1 ≙ false/true)
  cuerpo:['y','st','sc'], discretos:['st','sc'],     // A/B: nombres de los campos del cuerpo y cuáles no se interpolan
  packN:n, packDiscretos:[idx],                      // C: ints de pack() (≤70) e índices sin interpolar
  carta*:{ obj*, gana*, como*:{tactil,teclado}, demos*:[{id,txt}], roles:null },
  mk*(c) -> g }
```

`g` (lo que devuelve `mk`):

```js
// obligatorios en todo juego
update(dt), draw(), ai(p, dt, api), scores() -> number[n]
// A/B obligatorios
cuerpo(p) -> {…nombres de def.cuerpo…}        // solo se llama para p con c.mio(p)
// opcionales (hooks)
done() -> bool                                 // finTemprano
vivo(p) -> bool                                // survival: para el HUD
alRemoto(p, cuerpoObj, t)                      // llegó el cuerpo de p
alCpu(p), alHum(p, cuerpoObj)                  // p pasó a CPU / volvió a humano (alHum: adopta el cuerpo que manda el juez)
onEv(ty, p, d, t)                              // evento fiable (de c.ev) llegó, también el propio
claimOk(id, p, tMs) -> bool                    // B, solo el juez: ¿vale el reclamo de p en ese instante?
concede(id, p)                                 // B, en todos: el juez concedió id a p (−1 = nadie)
destacado() -> 'aguantó 41 s'                  // línea del podio
vista() -> object                              // observable para bots/pruebas
// C obligatorios
step(dt)                                       // SOLO el juez, a 1/30: lee c.held/tap/eje de todos y avanza la simulación autoritativa
pack() -> int[], unpack(arr), restore(arr)     // snapshot; restore = el juez nuevo retoma la simulación
// C opcionales
predict(dt, auth), lerp(a, b, u) -> arr, ganaSolo(), ganaEquipo()
```

`update(dt)` en C se llama en **todos** (animación y avatar predicho, sin tocar el estado autoritativo); `step` solo en el juez.

### 4.2 El contexto `c`

```js
c = {
  n, yo, seats:[{id,name,ch,color,cpu,human,team}], modo, equipos:[teamIdx por asiento], solo:idx|-1, lv:1..3, dur, practica:bool,
  modelo, dt: 1/30,
  campo(): {x0, x1, y0:70, y1:470},              // gameLeft(), gameRight() en cada llamada; lo interactivo va dentro; el HUD ocupa y<64
  ahora(): gt en segundos (negativo en la cuenta; en práctica, reloj local desde 0),
  rng, rngFor(tag), fx,                          // rng: SOLO en mk (o en step del juez); rngFor('cpu'+p)/(tag): flujo propio sembrado; fx(): [0,1) cosmético SIN semilla compartida
  held(p,'a'|'b') -> bool,  tap(p,b) -> int (consume los toques nuevos desde la última llamada),  eje(p) -> {x,y} en −1..1,
  cpu: [bool vivo-CPU por asiento (dinámico)], skill: [0..1],
  juez() -> bool, epoch (getter),
  send(t, d, latest) -> bool, on(t, fn(d, p)),   // solo tipos x* (§0.3); p = índice del emisor
  ev(ty, d, p?) , claim(id, cb), mio(p), remoto(p), out(p?) ,
  util: { suave(cur, target, dt), clamp, pj(ch,cx,cy,h,op), tick(gt) }
}
```

Reglas de cada miembro:

- `rng`: `FIESTA.rng.crear(cola[i].seed)`. `rngFor(tag)`: `crear(fnv(seed+':'+tag))`. Todo lo aleatorio que afecta al juego se saca **en `mk`** (o por `rngFor`/`rng` solo en el juez durante `step`); lo cosmético usa `c.fx()`.
- `held/tap/eje(p)`: para el asiento propio vienen de `sess.in`; para una CPU (o un humano caído), de lo que escribe `ai` por su `api`; para un humano remoto, de sus `i` (**solo** C o `entradas:true`; en A/B devuelven `false/0/{0,0}`). Mientras `gt<0` o `over`, todo da `false/0`.
- `skill[p]` = `{1:.35,2:.6,3:.85}[board.cfg.cpuNivel] + 0,1·(rngFor('skill'+p).next()·2−1)`, recortado a [.2,.95].
- `mio(p)`: A/B → `p===yo && !cpuAhora[yo]`, o soy juez y `cpuAhora[p]`. C → soy juez (simula todo). Espectador: nunca.
- `remoto(p)`: A/B → objeto con los nombres de `def.cuerpo` interpolado a `gt − D` (`null` si aún no hay dato; extrapola ≤100 ms y luego congela; los `discretos` toman el más nuevo). En C devuelve `null` (se dibuja desde `unpack`).
- `ev(ty, d, p)`: manda `ev` fiable `{q,e,ty,p,d}` (`p` por defecto `yo`; si `p≠yo` exige `mio(p)`), y entrega **también localmente** a `g.onEv`. `ty` `'cpu'|'hum'` reservados.
- `out(p)` = `ev('out', {kk: tick(ahora())}, p)`.
- `claim(id, cb)`: ver §4.6. `send` valida y ajusta `q`.

### 4.3 Reloj y fases

```
startAt==null → fase 'carta'      gt<0 → 'cuenta'      gt≥0 && !over → 'juego'      over → 'fin'      board.f==='res' → 'res'
gt()      = (net.serverNow() − mj.startAt)/1000
cuenta()  = null | {n:3|2|1|0, frac}   n=3 en gt∈[−3,−2), 2 en [−2,−1), 1 en [−1,0), 0 («¡YA!») en [0,0.8); frac = avance dentro del número
```

`onGo` se dispara una vez al cruzar `gt≥0` con `{k,i,gt,wall:Date.now()}` (el e2e mide `wall`).
**Construcción:** la sesión abre el canal y los manejadores al crearse (en la tarjeta); `g = def.mk(c)` se construye cuando aparece `startAt` (hay ≥3,5 s de margen) o, si la sesión nace tarde (recarga), de inmediato. Con `startAt` ya pasado, A/B reconstruyen el estado como función de `ahora()`; C sin snapshot arranca del `mk` (el siguiente `s` lo corrige).

### 4.4 Sesión (`Session`)

```js
sess.key            // 'k:i'      sess.k  sess.i  sess.id (juego)  sess.def  sess.g (null hasta construir)  sess.c (el contexto)
sess.phase          // 'carta'|'cuenta'|'juego'|'fin'|'res'|'cerrada'
sess.gt()           sess.cuenta()   sess.esJuez()   sess.epoch()   sess.over  sess.go (true tras cruzar gt≥0)
sess.update(dt)     // UNA vez por cuadro (dt s reales, se recorta a 0.1). Todo el trabajo de red, modelo, juez, veredicto
sess.draw()         // g.draw() si hay g (sin HUD ni controles; los dibuja fiesta-carta)
sess.hud()          // {gt, dur, quedan, over, fase, juez:'b', items:[{i,id,name,ch,color,team,yo,cpu,caido,vivo,sc}]}
sess.in             // {down(b), up(b), tap(b), axis(x,y)}  b ∈ 'a'|'b'. Se ignora si phase!=='juego'. tap = down+up en el mismo cuadro
sess.ready()        // net.ready({on:true}) + send('rdy',{}) en el alcance m (solo en 'carta')
sess.listos         // {letra:true} de los rdy recibidos (cortesía visual; manda board.mj.listos)
sess.verdict        // null | {e,kk,sc,pl,h,cpu,fuente:'end'|'propio'}  lo que esta pantalla muestra congelado; un `end` válido tardío lo REEMPLAZA
sess.result()       // board.mj.res si board.f==='res', si no null  (el podio sale de aquí, nunca del end)
sess.stats          // {sent:{tipo:n}, maxCarga:B, req:n, jueces:[{e,seat}], mjfin:[{status,at}], eventos:[{at,ty,…}]}  (pruebas)
sess.close()        // cierra canal y manejadores; idempotente
```

**Ciclo por cuadro (`update`)** — orden fijo:

```
1 sincroniza con board: juez/e/startAt/f/cpu de asientos. Si f==='res' → phase='res'. Si cambió `q`/`i` → la sesión pasa a `'cerrada'` (main abre otra).
2 si juez nuevo (antes no lo era) → promover() (§4.7)
3 gt<0 → return (solo mantiene presencia e interpolación). Construye g si falta.
4 sin over:
   A/B:  para cada CPU/caído p con mio(p): g.ai(p, dt, api(p))
         g.update(dt)                                   // simula cada p con mio(p) leyendo c.held/tap/eje
         cada 1/bodyHz: send('o', {q, t:round(gt·1000), b:[[p,…cuerpo(p) en orden def.cuerpo]…]}, latest)   // UN o: mío + (si soy juez) CPU/caídos
         juez: atiende cl (§4.6), detecta caídas/regresos (§4.5), verifica cuerpos (g.valida?, vmax)
   C:    juez:  mientras k < floor(gt·30) (máx 5 por cuadro; si el atraso es mayor se salta):
                    entradas → held/tap/eje de cada p (humano remoto: sus i; yo: retrasado fairDelay; CPU: ai)
                    g.step(1/30); k++;   cada 30/snapHz ticks: send('s', {q,e,t:round(k·1000/30),p:g.pack()}, latest)
                g.update(dt)
          resto: vista = interp(buffer de s, gt − D) → g.unpack(vista); g.predict?.(dt, authPropio); g.update(dt)
         todos los humanos: send('i', …) si cambió (≤20 Hz) + keepalive 4 Hz  (solo C/Ceq/entradas)
5 fin: juez → si gt ≥ dur || (finTemprano && g.done() && gt ≥ minTEf) → terminar() (§4.7)
       no juez → si llegó `end` válido → congelar; si gt > dur + 1,5 sin end → congelar con vista propia + mjack
6 migración: no juez, humano, gt ≥ 0, !over y net.silence(juez) > 1.2 y soy el primero vivo de board.mj.suc (vivo = humano y net.silence < 2) → `net.juez({k, e, q})` una vez por época (la ruta `juez` pasa también `q` al reductor)
```

`api(p)` (para `ai` y para los bots humanos del arnés): `{press(b), hold(b, bool), eje(x,y)}`; `press` suma un toque; `hold` fija el bit; `eje` fija el vector.

### 4.5 Caídas y regresos (A/B/C)

- **Juez:** un humano `p` (no CPU de origen, `!cpuAhora[p]`, p≠yo) con `net.silence(id) > K.CAIDA (2,0 s)` durante `phase==='juego'` → `cpuAhora[p]=true`, `send('ev',{q,e,ty:'cpu',p})`, `g.alCpu?.(p)`. Desde entonces el juez corre `ai(p)` y publica el cuerpo de `p` en **su** `o` (A/B) / simula con `ai` (C), partiendo del último cuerpo recibido (`remoto(p)` crudo).
- **Regreso:** mientras `cpuAhora[p]` y el juez recibe mensajes frescos de `p` (`net.silence(id) < 0,5`) de forma continua durante `K.FRESCO (0,5 s)` → `cpuAhora[p]=false`, `send('ev',{q,e,ty:'hum',p,d:cuerpo(p) en orden})`. En A/B, el dueño al recibir `ev hum` de sí mismo llama `g.alHum(yo, obj)` (adopta el cuerpo del juez) y vuelve a publicar el suyo.
- **Los demás** aplican `ev cpu/hum` a su `cpuAhora` (para el HUD «(se le fue el internet)» y para no tomar `o` de ese dueño mientras es CPU, salvo para detectar el regreso).
- **Dueño sin saber** que cayó (estuvo offline): al volver sigue mandando `o`; el juez lo ve «fresco» y le manda `ev hum`.
- Aceptación de cuerpos (`o`): se toma el de un emisor `s` para el asiento `p` solo si `s===p && !cpuAhora[p]`, o `s===juez && cpuAhora[p]`.

### 4.6 Modelo B: reclamos

`c.claim(id, cb)`:

1. Registra `pend[id] = {cb, t: round(gt·1000), at: clock}` y manda `cl {q,id,t}` (fiable). Si soy el juez, lo mete directamente a su cola.
2. El juego hace su **animación optimista** al llamar.
3. Juez: al llegar el primer `cl` para `id` abre una ventana de `K.VENTANA = 0,12 s`; al vencer, entre los reclamos recibidos (incluido el propio) con `g.claimOk?(id,p,t) !== false` concede el de menor `t` (empate: menor índice); `send('ok',{q,e,id,p})` (fiable) con `p=−1` si nadie; los que lleguen después abren otra ventana.
4. Todos los clientes, al recibir `ok`: `g.concede?.(id, p)`; el que reclamó y tiene `pend[id]` → `cb(p===yo?'ok':'no')`.
5. `cb('no')` automático a los `K.CLAIM_TTL = 2,5 s` sin `ok`. En un cambio de época, los `pend` vivos se **reenvían** al juez nuevo.

### 4.7 Juez: elección, promoción, migración, veredicto

- **Quién es el juez:** `board.mj.juez` (lo escribe el servidor; el cliente nunca se autoproclama). `esJuez() = board.mj.juez === yo`.
- **Promoción** (al volverme juez por CAS, `e` sube): C → `g.restore(últimoSnapshotCrudo)` y `k = round(t_snapshot·30/1000)`; A/B → el estado de las CPU/caídos sale de los últimos cuerpos recibidos (`g.alCpu` de nuevo para cada `cpuAhora`); reenvía lo pendiente; `send('jg',{q,e})`. Si `!def.migra` → `terminar()` inmediato con el último snapshot.
- **Degradación:** si veo un `e` mayor y `juez≠yo`, dejo de ejecutar `ai`/`step`/`ok` de inmediato (la fuente es solo `board`).
- **Mensajes de tipo-juez** se aceptan si `from===board.mj.juez && d.e===board.mj.e && d.q===board.mj.i`. Si `d.e > board.mj.e` se guardan (≤8, 3 s) y se reevalúan en el siguiente cambio de `board`.
- **`terminar()`** (solo juez, una vez por época):

```
raw = g.scores().map(v => max(0, round(v)));  sc = clase==='survival' ? normSurvival(raw) : raw
pl  = puestos(modo, equiposIdx, sc, clase);     kk = round(min(gt, dur)·30);   h = hashRes(sc, pl, kk)
cpu = letras de asientos con cpuAhora
send('end', {q,e,kk,sc,pl,h,cpu}, fiable)  ·  reenvíos a +1,0 s y +2,5 s mientras board.f==='mj'
net.mjfin({q,e,kk,sc,h,cpu})   // reintenta cada 1 s si status 0/5xx hasta recibir 200 o 409; en 409 «Judge changed» se detiene
```

  Antes de enviar espera a `gt ≥ minTEf = min(lim.minT, dur−1)` (aunque `done()` ya sea cierto).
- **No jueces:** al recibir `end` válido → `over=true`, `verdict={…,fuente:'end'}`, `net.mjack({q,e,kk,h,sc})`. Si `gt > dur+1,5` sin `end` → `over=true`, `verdict` con su vista (`scores()` normalizado, `pl`, `kk`, `fuente:'propio'`) y `mjack`. Un `end` válido posterior reemplaza el `verdict`.

### 4.8 Práctica

`LIVE.practice(id, {lv:1, yo:'a'}) -> P`: n=2 (yo + una CPU «profe» skill .5), `c.practica=true`, semilla local (`Date.now()`-derivada; es el único sitio donde se permite), `c.dur = min(def.dur, 20)`, `c.juez()=true`, `c.mio(p)=true` para todos, `send/on/claim` locales (el juez soy yo; `claim` concede enseguida), C: `step` local a 1/30. API: `P.update(dt)`, `P.draw()`, `P.in`, `P.hud()`, `P.gt()`, `P.fin` (bool), `P.reiniciar()`, `P.close()`. No usa red ni la semilla real.

### 4.9 Constantes (`LIVE.K`)

```
CAIDA 2.0 · FRESCO 0.5 · SIL_JUEZ 1.2 · ESPERA_END 1.5 · REENVIO_END [1.0, 2.5] · BODY_HZ 12 · SNAP_HZ 10 · I_HZ 20 · I_KEEP_HZ 4
VENTANA 0.12 · CLAIM_TTL 2.5 · D_MIN 0.10 · D_MAX 0.25 · FIJO 1/30 · TOQUES_MAX 16 · MAX_CATCHUP 5 · FAIR_MAX 0.12 · PENDIENTES_E 8
```

Interpolación: búfer de 8 estados por emisor/asiento con la **marca del emisor** (`t`); `D = clamp(1,5·intervaloMedio + 2·sigma, D_MIN, D_MAX)`, recalculado cada 1 s con cambio ≤20 ms. Los cuerpos de un `o` usan `t` del emisor. `LIVE.util.suave(cur, target, dt)`: error ≤6 px no corrige; entre 6 y 60 px corrige ≤8 px por cuadro; >60 px salta.
`fairDelay` (C, solo en el juez, solo para `held/tap/eje` de **su propio** asiento): retardo = `min(FAIR_MAX, mediana de net.rtt(id)/2000 de los otros humanos)`.
`i`: el juez toma `tap(p,b) = acumulado − últimoAcumulado`, limitado a `TOQUES_MAX` por segundo y botón.

### 4.10 `fiesta-net.js` (E1, un cambio)

```js
N.silence = function (id) { var P = pares[id]; return P && P.rx > -90 ? clk() - P.rx : Infinity; };
```
más una prueba en `test/fiesta-net.test.js` (silencio tras un mensaje y tras `R.offline`).

### 4.11 Arnés `test/helpers/live-harness.js` (E1)

Aloja una **sala real** (`P.fiestaNew/fiestaJoin/fiesta(...)` de `party.js`, con el reductor real) detrás de `memRelay`: `R.handlers[action]` llama a las funciones reales (`P.fiesta`, `P.sigPayload` con `slimRoom` y un `store` = `Map`) y, tras cada escritura, copia `room.board/ver/players` al `R.room` del relé y hace `R.push()`; `sig` difunde con `R.broadcast`.

```js
const { liveHarness } = require('./helpers/live-harness.js');
const H = await liveHarness({
  game:'f_mecate', humans:['a','b'], n:4,              // asientos que juegan sesiones; el resto (hasta n) son CPU 'auto'
  tipo:'ffa'|'1v1', seed:1, lv:1, dur:undefined,       // dur: sobrescribe mj.cola[0].dur (p. ej. 12)
  cpuNivel:2, delay:150, jitter:40, loss:0.05,         // relé HTTP (cada tramo); sse={delay:delay/2}
  p2p:'none'|'all'|{pairs}, relampago:false, strict:true });
await H.arrancar();    // crea sala, une humanos, start, fuerza game/seed/dur/lv en mj.cola[0], abre sesiones, espera ~2,5 s (presencia), LISTO de todos, hasta phase 'cuenta'
await H.correr(seg, { paso:1/30, bots:{a:{skill:.6}, b:null}, eventos:[{en:12, matar:'juez'}, {en:8, caer:'b', hasta:11}] })
                       // tiempo virtual (R.advance); por paso: sess.update(paso) de cada humano vivo; bot activo = game.ai(p,dt,sess.in-api) con c.skill[p]=skill; null = ocioso;
                       // «matar» = R.offline[juez]=true para siempre; «caer» = offline entre dos gt
await H.cerrar();      // avanza hasta board.f==='res' (máx 20 s virtuales) y 3 s más
H.sess[s]  H.net[s]  H.R  H.room  H.P
H.veredictos() -> {a:{h,sc,pl,fuente}, …}      H.res() -> room.board.mj.res      H.cobros() -> monedas por asiento
H.jueces()     -> [{e, seat}] quién envió `end` por época       H.mjfin() -> [{seat, e, status}]
H.tipos()      -> Set de tipos enviados por los clientes      H.stats() -> {reqMaxPorSeg:{a,b}, loteMax, cargaMax, rechazos:[…]}
```

### 4.12 Pruebas de E1 (`test/fiesta-live.test.js`)

Con **juegos de mentira** en `test/helpers/live-fakes.js` (uno por modelo: A = contador con cuerpo, B = objeto reclamable, C = «bumper» con movimiento, `step/pack/unpack/restore/predict`) y el arnés: (1) `add` valida y rechaza (falta campo, catálogo distinto, tipo reservado con `strict`); (2) mismos `h` en todas las pantallas a 50/150/300 ms con 5 % de pérdida, n=2,3,4; (3) exactamente un juez por época; (4) juez muerto en un `gt` aleatorio (semillas) ⇒ un solo `mjfin` aceptado, `e` sube 1, mismo `h`; (5) asiento caído ⇒ `ev cpu` en [2,0; 3,5] s, la CPU juega, regreso ⇒ `ev hum`; (6) tipos: solo `x*` + reservados; (7) presupuesto: carga ≤420 B, lote ≤512 B/≤10, ≤20 req/s por cliente; (8) `claim`: gana el `t` menor dentro de 120 ms, el otro recibe `'no'`; (9) interpolación por marca del emisor (jitter no sacude el cuerpo remoto); (10) fairDelay y predicción (C); (11) `verdict` se reemplaza por un `end` tardío; (12) práctica no abre red.

---

## 5. Flujo de cliente (E2)

### 5.1 Máquina de estados (`fiesta-main.js`)

`board.f` manda; el director no se toca. Pantalla de minijuego = `mjPantalla`:

```
mjPantalla = enJuego() && yo && D.board && (D.board.f==='carta' || D.board.f==='mj' || D.board.f==='res') && D.board.mj
```

(`D.board` = tablero MOSTRADO por el director. El director ya salta a `S` en `startAt − 3000` (`skip('mj')`), así que la cuenta siempre se ve.)

```js
// por cuadro, ANTES de dibujar (nombres exactos)
function reconciliarSesion() {
  const B = net.board;
  if (!yo || !B || !B.mj || !(B.f === 'carta' || B.f === 'mj' || B.f === 'res')) { cerrarSesion(); return; }
  const key = B.mj.k + ':' + B.mj.i;
  if (sesion && sesion.key !== key) cerrarSesion();
  const D = director.D.board;
  if (!sesion && (B.f === 'carta' || B.f === 'mj') && D && (D.f === 'carta' || D.f === 'mj' || net.serverNow() >= (B.mj.startAt || 1e18) - 3000))
    abrirSesion();            // F.LIVE.create({net, yo, onGo: alYa, strict:false}); carta.abrir(sesion); net.sync(5, 150)
}
function abrirSesion()  { sesion = F.LIVE.create({ net, yo, onGo: alYa }); carta.abrir(sesion); net.sync(5, 150); }
function cerrarSesion() { if (sesion) { sesion.close(); sesion = null; } carta.cerrar(); }
function alYa(x) { root.FIESTA_YA = { k: x.k, i: x.i, wall: x.wall, perf: performance.now() }; }
```

- `tick(dt)` (reemplazo de main): `reconciliarSesion(); if (sesion) sesion.update(Math.min(.1, dt));` después de `director.update()`.
- `dibujar()`: si `mjPantalla` y hay sesión → `carta.dibujar(vmCarta())` y **no** se llama a `ui.dibujar` ni a `dibujarMapa`; si el que mira es **espectador** (`pantalla==='mira'`, sin asiento) → la tarjeta «Mirando el minijuego» de hoy (`dibujarMJ`, texto nuevo; DM2-14). Un asiento propio **siempre** crea sesión, aunque esté `cpu:'afk'` o en toma (`toma:1`): entonces `c.mio(yo)` es falso, no se acepta entrada y la pantalla muestra el botón `volvi` (`net.back`); al volver, el juez lo devuelve a humano con `ev hum` (§4.5). Fuera de mj, todo como hoy.
- Al volver `D.board.f` a `'turno'`/`'final'`: `reconciliarSesion` cierra la sesión (el director ya tiene el lote de `mjRes` y los `mon` reproducidos o los reproduce ahora; no se hace `director.skip`, así que **`hash(D)===hash(S)` en reposo** sigue valiendo).
- `intencionCarta(it)`: `{k:'ready'}` → `sesion.ready()`; `{k:'back'}` → `net.back({})`; `{k:'practica', on}` → `carta.practica(on)`; `{k:'react', id}` → canal `b`.
- Teclado/puntero: ver §5.5.
- `FIESTA_DEBUG` gana: `live` (getter de `sesion`), `carta`, `goWall()` (= `Date.now() + (S.mj.startAt − net.serverNow())` si hay `startAt`, si no `null`), `ya` (= `FIESTA_YA`), y `estado()` añade `{mj:{k,i,phase,gt,juez,e,listos}, podio:{puestos,pagos,sc,h}|null, ya}`. `botones()`/`boton(id)` incluyen el registro de `carta` (`listo`, `practica`, `volvi`, `pad_a`, `pad_b`, `stick`).

### 5.2 Tiempos de pantalla (puro, probado) — `F.carta.fase(S, ahora, sess)`

```
f==='carta':  t0 = mj.cartaHasta − (mj.rel ? T.relCarta : T.carta)
              ahora < t0              → 'espera'   (el director aún reproduce el lote: se sigue viendo el tablero)
              ahora < t0 + (rel?0:4500) → 'ruleta'
              si no                   → 'tarjeta'
f==='mj':     startAt==null → 'tarjeta';  gt<0 → 'cuenta';  over → 'fin';  si no 'juego'
f==='res':    'podio'
```

### 5.3 Pantallas (`fiesta-carta.js`)

`F.carta.crear({emit}) -> C`: `C.abrir(sess)`, `C.cerrar()`, `C.dibujar(vm)`, `C.B` (registro de botones como `F.ui.registro()`), `C.mover(x,y,abajo)`, `C.down(id,x,y)`, `C.move(id,x,y)`, `C.up(id,x,y)` (multitáctil por `pointerId`), `C.tecla(code, abajo) -> bool`, `C.practica(on)`. `vm = {S, D, yo, serverNow, izq, der, compacto, seats, sess, net}`. Usa `F.ui.d` (`T`, `caja`, `boton`, `dibujaPj`, `retrato`) y `F.ui.registro` **solo para leer**; dibuja con rr/ell/line/poly/txt.

| Pantalla | Contenido |
|---|---|
| **Ruleta de formato** (4,5 s) | Ruleta con las etiquetas `F.ui.TIPO` (4P / 2v2 / 1v3 / duelo) que gira y cae en `mj.tipo` (ya decidido; solo animación, determinista por `mj.k`), luego banner: ffa = 4 bustos; 2v2 = marcos de color por equipo; 1v3 = el solo al centro «¡TÚ CONTRA TODOS!». El texto de equipo sale de `mj.eq`. |
| **Tarjeta** (≤15 s) | Nombre del juego; `carta.obj`; cuadro «¡CÓMO SE GANA!» (`carta.gana`); controles táctil y teclado lado a lado con demo animado por `carta.demos[].id` (`saltar`, `compas`, `mover`, `robar`); retratos con ✓ (`board.mj.listos` ∪ `sess.listos`); anillo de tiempo a `cartaHasta`; botones **PRÁCTICA** (id `practica`) y **¡LISTO!** (id `listo`, tecla Espacio/Enter, intent `ready`); tras LISTO: «¡Listo! esperando…». Si mi asiento está `cpu:'afk'`: botón `volvi`. Las CPU nunca bloquean (`listosTodos` solo cuenta humanos). |
| **Práctica** | `LIVE.practice(id)` dentro de un recuadro (o a pantalla completa en vertical) con los mismos controles; se detiene al aparecer `startAt` (`gt ≥ −3`). |
| **Cuenta** | El juego se ve debajo; números 3-2-1 grandes y «¡YA!» desde `sess.cuenta()`; entrada bloqueada hasta `gt≥0` (lo hace `sess.in`). |
| **Juego** | `sess.draw()`; HUD superior (franja de 64 px): 4 fichas con retrato, nombre, `sc`/«vivo»/«fuera», marco de color, «(se le fue el internet)» si `caido`; barra de tiempo `quedan`; **el juez no lleva marca**; controles superpuestos (§5.5). |
| **Fin** | «¡SE ACABÓ!» sobre el último cuadro congelado hasta que llega el podio. |
| **Podio** | Sale de `board.mj.res` (`puestos`, `pagos`, `sc`, `cpu`): ganador con `animo` `celebrar`, el resto `perder`; `+N` monedas por asiento con animación que termina en el contador real; `g.destacado()` si la sesión aún lo tiene; una línea de humor por resultado; 5 s fijos (DM2-14). `empate` → «Se fue la luz en todo el país». |

### 5.4 Pagos y regreso al tablero

Las monedas **solo las escribe el servidor** con `FIESTA.reglas.pagosMJ` dentro de `MJ_RESULTADO` (10/6/3/1; ×2 rondas múltiplo de 5, etc.). El cliente solo las muestra: el lote de `mjRes` + `mon` lo reproduce el director y el podio anima desde `pagos`. No se recalcula nada en el cliente.

### 5.5 Controles

- **Teclado:** stick = WASD o flechas; A = Espacio o KeyJ; B = Shift o KeyK. `keydown` y **`keyup`** (hoy solo hay `keydown`). Con `mjPantalla` y `sesion` el teclado va primero a `carta.tecla` y solo si devuelve `false` a `ui.tecla`.
- **Táctil apaisado:** joystick flotante en el 45 % izquierdo (aparece donde aterriza el pulgar; radio 60 px lógicos; zona muerta 12 %); **A** grande abajo a la derecha (radio 52); **B** arriba-izquierda de A (radio 40) solo si `def.botones===2`. Se dibuja solo lo que el juego usa (`def.stick`, `def.botones`), con el color del personaje. **Vertical:** el 800×600 va en caja y los pads en la franja inferior.
- Puntero: `pointerdown` en `mjPantalla` → si toca un botón de `C.B` o un pad, el `pointerId` queda marcado `'carta'` (multitáctil: stick + A a la vez) y **nunca** va a la cámara. Se desactiva el gesto de deslizar a flechas del motor durante el juego. Sin machaque obligatorio de más de 6 s (los juegos lo respetan).
- Funciones puras exportadas y probadas: `F.carta.layoutPads(vw, vh, compacto, def)`, `F.carta.teclaAInput(code)`, `F.carta.stickDe(dx, dy)`.

### 5.6 `fiesta.html` (lista estática, orden exacto)

```
engine → juegos-bus → fiesta-rng → fiesta-mapa-venezuela → fiesta-reglas → fiesta-cpu → fiesta-net → fiesta-director →
fiesta-live → fiesta-juego-mecate → fiesta-juego-domino → fiesta-juego-harina →
fiesta-camara → fiesta-tablero → fiesta-ui → fiesta-lobby → fiesta-carta → fiesta-main
```

(todas con `?v=1792000000` como el resto; el Dockerfile las reescribe). `fiesta-juego-*.js` se registran con `FIESTA.LIVE.add` al cargarse.

### 5.7 `?practica=<id>` (depuración y capturas)

`fiesta.html?practica=f_mecate&lv=2&estilo=tinta` salta el lobby: crea `LIVE.practice(id,{lv})`, la dibuja a pantalla completa con HUD y controles reales, y expone `FIESTA_DEBUG.practica` (`update(dt)`, `draw()`, `in`, `hud()`, `gt()`). `?step=1` la deja sin avanzar para que el banco la maneje a mano. No toca red. Lo usa `docs/style-lab/pruebas/fiesta-live-probar.js` (E5).

### 5.8 Enchufes en archivos ajenos

Previstos: **ninguno**. `ui.dibujar` simplemente no se llama durante `mjPantalla`, y su prompt `LISTO` queda oculto; el botón `listo` de `carta` emite el mismo intent `ready`. El `ui` conserva sus toasts, y al volver al tablero sigue como estaba. Si E2 descubre que hace falta un cambio mínimo en `fiesta-ui.js`/`fiesta-lobby.js`, lo **reporta** (archivo, función, motivo) en vez de hacerlo.

### 5.9 Pruebas de E2

**`test/fiesta-carta.test.js`** (puro, sin DOM): `fase()` en todos los tiempos (incluido Relámpago); `cuenta()` límites; `layoutPads` en 800×600, 1000×460, 360×640; `teclaAInput`; `stickDe`; orden del podio con empates; que ningún botón de `carta` se solape con la franja de 64 px ni con el reloj; `reconciliarSesion` modelado con un `net` falso (abre/cierra una sola vez por `k:i`).

**`test/fiesta-mj.e2e.js`** (PocketBase real con `test/helpers/pb-harness.js` + Chrome como `fiesta.e2e.js`; parches de la copia del reductor: `carta:4500+6000`, `dur:\d+`→`dur:12`, `PLAZO` cortos): 3 contextos — **A** escritorio (teclado), **B** móvil horizontal táctil, **C** escritorio ocioso — crean/unen sala, eligen personaje, LISTO, `start` (3 humanos + 1 CPU); se juegan turnos hasta el primer `f==='carta'`; capturas de la tarjeta; los tres pulsan `listo`; esperan `cuenta`. Aserciones: (1) `|goWall_A − goWall_B|, |goWall_A − goWall_C| < 100 ms` y `|ya.wall| < 100 ms` entre pantallas; (2) mismo `estado().podio` en las tres y igual a `GET /api/collections/rooms/records/<id>` → `board.mj.res`; (3) A y B jugaron con entrada real (Espacio / toque en `pad_a`) y C ocioso **no** gana a la CPU; (4) monedas del tablero = `pagos`; (5) regreso a `turno` con `hashD===hashS` en reposo en las tres y un turno más jugado; (6) cero `pageerror` y cero errores de consola (salvo 409 esperados como en `fiesta.e2e.js`). El juego que sale es el que elija el reductor; para fijarlo, `PATCHES` puede apagar `live:1` de los otros dos (regex sobre `g:'<id>'`). Capturas en `docs/style-lab/pruebas/out/fiesta-mj-*.png` (**se miran con Read** y se corrigen solapes con reloj/controles).

---

## 6. Los tres juegos

Reglas comunes (todas obligatorias, las verifica `test/fiesta-juegos.test.js`):

- Un archivo IIFE `(function(){ if(!window.FIESTA||!FIESTA.LIVE||FIESTA.LIVE.get('f_x'))return; … FIESTA.LIVE.add('f_x', {…}); })();`. Sin `Math.random` (grep), sin `Date.now`/`performance.now` en la lógica (solo `c.ahora()`); todo el azar en `mk` por `c.rng`/`c.rngFor`; lo cosmético con `c.fx()`.
- Dibujo solo con `rr, ell, line, poly, txt, bust` + `c.util.pj` (personajes), `BUS.AP.CAST`, `FACES`, `hand`, `spawn/drawP/say` del laboratorio; **prohibido** `ctx.fill/stroke/arc/lineTo/drawImage/fillText/beginPath` (solo `ctx.save/restore/translate/rotate/scale/globalAlpha`). Escena dentro de `c.campo()`, lo interactivo en `y∈[70,470]`, nada importante bajo el HUD (y<64) ni en la franja de pads.
- `c.lv`: 1 día, 2 atardecer, 3 noche (paleta propia). Tolera `dur ≥ 3` (cualquier valor), `n ∈ {2,3,4}`, `gt<0` en `draw`, 6 estilos.
- CPU: solo `ai(p,dt,api)`, con `c.skill[p]` y `c.rngFor('cpu'+p)`; reacción mínima 180 ms; ≤12 toques/s.
- Mensajes ≤420 B (`x*` ≤200 B), pack ≤300 B.
- Exponer `g.vista()` y `g.destacado()`.
- Resultado dentro de `lim` (el servidor **no** debe tener que recortar: `res.aj` falso).
- Escalar puntajes a enteros ≥0.

### 6.1 Parámetros del registro

| id | name | modos | clase | modelo | dur | botones/stick | cuerpo / pack | migra |
|---|---|---|---|---|---|---|---|---|
| `f_mecate` | ¡SALTA EL MECATE! | ffa, 1v1 | survival | A | 45 | 1 / no | cuerpo `['y','st','sc']`, discretos `['st','sc']` | sí |
| `f_domino` | ¡CAPICÚA! | ffa, 1v1 | rank | B | 30 | 1 / no | cuerpo `['pts','combo','cal','nn']`, todos discretos | sí |
| `f_harina` | ¡LA ÚLTIMA HARINA! | ffa, 1v1 | rank | C | 30 | 1 / sí | `packN` ≤ 60 (§6.4) | sí |

`limites`: ver §3.2 (idénticos al catálogo). `bodyHz` 12 (A/B), `snapHz` 10 (C).

### 6.2 `f_mecate` (A) — E4

- **Escena:** calle del barrio; dos vecinas dando la cuerda (`BUS.AP.CAST.mama` a la izquierda y `CAST.abuela` a la derecha); los n jugadores en fila entre ellas (`c.util.pj` con su personaje). Gag: al caer, «¡Pisó el mecate, PISÓ!» (burbuja `say`).
- **Mundo (en `mk`, de `c.rng`):** lista `cruces=[{t,doble}]` de instantes de cruce de la cuerda por el suelo, **idéntica en todos**. Entrada: `lead = min(3, 0,35·dur)`. Intervalos: lv1 `1,10→0,70 s` lineal sobre `dur`; lv2 `1,05→0,62` con ±0,12 s de jitter sembrado por intervalo; lv3 pares de cruces separados 0,28 s (cuerda doble) con base `1,20→0,80`. Se generan hasta `t>dur`.
- **Salto:** A estando en el suelo y vivo → vuelo de 0,52 s, altura `h(τ)=4·70·τ(1−τ)`, `τ=(gt−tj)/0,52` (px). Un cruce en `T` se **supera** si en `T` el jugador vuela con `h≥22` (τ∈[0,0855; 0,9145]); en lv3 hay que cubrir ambos cruces del par. Un jugador **falla** si en `T` no lo supera.
- **Eliminación:** cada dueño juzga **su** cuerpo; la hora del fallo es `T` (determinista), así que `kk_out = floor(T·30)` es igual para cualquier observador. Al fallar: `c.out()`; cuerpo `st=1`, `sc=kk_out`. Los eliminados siguen mirando y pueden mandar `react`.
- **Puntaje (`scores`)**: eliminado → `sc`; vivo → `dur·30+1`. `done()` = vivos ≤ 1. Clase `survival`, `finTemprano:1`.
- **CPU (`ai`):** para cada cruce planea la pulsación en `T − 0,26 + N(0, σ)`, `σ = 0,090 − 0,065·skill` s (gaussiana de tres uniformes de `rngFor('cpu'+p)`), con 8 %·(1−skill) de saltarse un cruce.
- **Resultados esperados (verifica la lista):** un humano ocioso muere en el primer cruce (`kk≈90`) y queda último; con CPU nivel 2, rara vez sobrevive alguien a los 45 s.
- **Carta:** `obj` «Brinca cuando pase el mecate» · `gana` «El último en pie. Si quedan varios, empatan arriba.» · `como` táctil «A = saltar», teclado «ESPACIO o J» · demos `[{id:'saltar',txt:'Salta justo cuando la cuerda pasa por el suelo'}]`.
- **Tests de E5 sobre este juego:** cruces idénticos (hash de `cruces` igual en las n instancias), un humano activo-bot sobrevive más que uno ocioso, `scores()` dentro de `lim`.

### 6.3 `f_domino` (B) — E4

- **Escena:** mesa de dominó bajo el mango, una pista por jugador (como el borrador, solo ideas); el abuelo (`CAST.tio` o `FACES`) y el perro dormilón. Gags: «¡TRANCAOOO!» al perfecto, «¡CAPICÚA!».
- **Partitura (en `mk`, de `c.rng`, igual en todos):** tempo `[90,110,130][lv−1]` bpm; entrada `T0=min(2,2; 0,25·dur)`, fin de notas `TEND=max(T0+2, dur−1,5)`; patrón de notas como el borrador (dobles/corcheas/silencios); cambio de ritmo ×1,2 durante 4 s; lv≥2 apagón de ~2 compases (se juega de oído); una ficha dorada (30 si perfecta, 0 si no).
- **Puntos por toque (cada dueño juzga el suyo con `c.ahora()`):** PERFECTO ±60 ms = 10; BUENO ±130 ms = 6; REGULAR ±200 ms = 3; toque sin ficha −2; 8 buenas seguidas +10 («¡TRANCADO!»). El total se publica `max(0,pts)`.
- **TRANQUE (la parte B):** 3 «tranques» sembrados (`id` `'t0'..'t2'`, a notas en tiempo fuerte entre el 25 % y el 80 % de `dur`, fuera del apagón; solo si `dur ≥ 20`). El tranque es una ficha central dorada con halo 0,6 s antes (telegrafía). Si un jugador pega **PERFECTO** esa nota, llama `c.claim('t'+j, cb)` (con animación optimista «¡TRANQUE?»). El juez concede con `claimOk(id,p,tMs)` = `|tMs/1000 − tranque.t| ≤ 0,08` y no concedido antes, al **menor `t`**; `concede(id,p)` en todos marca el dueño. En `cb('ok')`: `pts += 25` y «¡TRANCADO!»; en `'no'`: «¡TE LO QUITARON!». Cada tranque vale una vez.
- **Cuerpo (`o`):** `{pts, combo, cal, nn}` (`cal`: 0 nada, 1 mal, 2 regular, 3 bueno, 4 perfecto, 5 dorada; `nn` cuenta toques) → el rival ve saltar su «¡PERFECTO!» en su pista al cambiar `nn`.
- **Puntaje máximo de diseño** < 900 (≤64 notas ×10 + 8 rachas ×10 + 30 + 3×25).
- **CPU:** por nota planifica pulsación en `t + N(0,σ)`, `σ = 0,12 − 0,07·skill` s; omite 12 %·(1−skill) de notas; en un tranque pulsa perfecto con prob. `skill`. Reacción mínima 180 ms no aplica (es sincronía, no reacción).
- **Carta:** `obj` «Pega cuando la ficha llegue a la raya» · `gana` «Más puntos. ¡El primero en pegar el TRANQUE se lo lleva!» · `como` táctil «A al compás» / teclado «ESPACIO o J» · demos `[{id:'compas',…}]`.
- **Verificar:** dos humanos que pegan el mismo tranque a la vez → solo uno cobra; `claim` perdido deshace; `cb('no')` si el juez muere (reenvío al nuevo).

### 6.4 `f_harina` (C) — E5

- **Escena:** supermercado vacío, góndolas; bolsas de harina PAN (`rr/ell/txt`); gag al robar «¡Señora, ese es MÍO, yo hice la cola desde las 4!».
- **Arena:** `c.campo()` recortado a `y∈[150,450]`. Jugadores = círculos r=22 con su personaje encima. Mundo en unidades de pantalla; paso fijo 1/30.
- **Controles:** stick (velocidad 170 px/s; 120 si lleva bolsa) + **A**.
- **Reglas (`step`, solo el juez):**
  1. Una bolsa libre se recoge con A estando a ≤48 px. Una bolsa llevada **brilla** a intervalos sembrados (cada 3,5–5,5 s: 0,6 s de temblor/telegrafía + 0,9 s de brillo). Con la bolsa brillando, A a ≤54 px del portador **se la roba**: el ladrón +5 puntos, el portador pierde la bolsa (y queda aturdido 0,6 s). A fuera de esos casos = tropiezo (aturdido 0,7 s: anti-machaque).
  2. El portador suma **10 pts/s** (14 con bolsa rota).
  3. A `dur/2` aparece una **segunda bolsa** («¡LLEGÓ EL CAMIÓN!»). Nadie lleva más de una.
  4. Contacto: los círculos se empujan (separación simple); sin daño.
  5. Niveles: lv1 como arriba; lv2 «bolsa rota» (deja rastro, portador 100 px/s, 14 pts/s); lv3 además «la señora del carrito» cruza cada ~8 s con aviso de 0,8 s y quien lleve la bolsa la suelta.
- **Aleatoriedad:** calendario de brillos y pasos del carrito **precomputado en `mk`** desde `c.rng` (arreglos indexados por contador), de modo que `restore(arr)` solo necesita los contadores y la simulación sea idéntica tras migrar el juez.
- **Estado y red (modelo C):** `step` lee `c.held/tap/eje` de todos (humanos remotos por `i`, CPU por `ai`, el juez con fairDelay). `pack()` → enteros: por jugador `[x,y,vx?,estado(bits: aturdido/lleva),pts×10]`, por bolsa `[x,y,dueño,faseBrillo]`, carrito, contador de calendario, `k`. ≤ 60 ints y ≤300 B JSON. `unpack` carga el estado; `lerp` interpola posiciones y deja discretos (`packDiscretos`). **`predict(dt, auth)`**: mueve mi avatar con mi stick usando las mismas constantes y se reconcilia con `c.util.suave(pred, auth)`; los demás se dibujan del snapshot interpolado a `gt − D`. La **acción de A** se decide solo en el juez (el cliente muestra el aturdimiento al ver el snapshot); no hay otros tipos `x*`.
- **Puntaje:** `scores() = floor(pts)`; máximo de diseño 14·30 + 20·5 ≈ 520 < 800.
- **CPU (`ai`):** bolsa libre → corre hacia la más cercana y A al llegar; con bolsa → huye del rival más cercano evitando bordes; sin bolsa → persigue al portador y pulsa A solo cuando la bolsa brilla y está a ≤50 px, tras `rt = 0,30 − 0,15·skill` s del inicio del brillo (≥180 ms).
- **Carta:** `obj` «Lleva la harina el mayor tiempo posible» · `gana` «Más puntos: 10 por segundo con la bolsa. Róbala cuando brilla.» · `como` táctil «Joystick · A = agarrar / robar» / teclado «WASD o flechas · ESPACIO» · demos `[{id:'mover',…},{id:'robar',…}]`.
- **Verificar (E5):** con el juez muerto a mitad, el nuevo `restore` sigue y el resultado coincide en todas las pantallas; el estado `pack` ≤300 B; un ocioso no suma.

---

## 7. Aceptación (qué prueba qué)

| Requisito de la tarea | Prueba | Dueño |
|---|---|---|
| Mismos puestos en todas las pantallas a 50/150/300 ms (5 % pérdida) | `fiesta-live.test.js` (fakes) y `fiesta-juegos.test.js` (3 juegos × {50,150,300}); `sess.verdict.h` iguales y = `board.mj.res.h` | E1, E5 |
| Exactamente un juez | `H.jueces()` un `end` por época; `mjfin` aceptado 1 vez | E1, E3 |
| Juez muerto en un `k` aleatorio ⇒ un solo veredicto | arnés `matar:'juez'` en 3 instantes por semilla | E1, E5 |
| Asiento caído ⇒ CPU | `ev cpu` en [2,0; 3,5] s, regreso `ev hum` | E1, E5 |
| Ningún tipo reservado reutilizado | `H.tipos()` ⊂ reservados del runtime ∪ `x*`; grep de los 3 archivos | E1, E5 |
| Presupuesto req/s | ≤20 req/s por cliente, ≤45 req/s por sala, carga ≤420 B, lote ≤512 B/≤10 | E1, E5 |
| Resultados dentro de bounds | `res.sc ∈ [0, min(scoreMax, scoreRate·(dur+1,5))]` y `!res.aj` | E5, E3 |
| Humanos inactivos no ganan a CPU activas | 2 ociosos + 2 CPU nivel 2: ningún ocioso en 1.º; `idle` ≤ puesto de la CPU peor | E5 |
| e2e: «¡YA!» <100 ms de diferencia y mismo podio | `fiesta-mj.e2e.js` | E2 |
| No romper lo existente | comandos de §1 | todos |
| Se ve bien en 3+ estilos | `fiesta-live-probar.js` con `?practica=` en `snes`,`felt`,`tinta` (los 6 si hay tiempo), capturas con Read | E5 |

`test/fiesta-juegos.test.js` (E5) matriz (tiempo total objetivo ≤3 min; `LIVE_FULL=1` añade 200 semillas de ventaja del juez, no exigido en M2): por juego: n=4 × {50,150,300 ms} × 2 semillas; n=2 y n=3 a 150 ms; `matar:'juez'` en 3 instantes; `caer` 1; ociosos 1; paridad `LIVE.get(id)` ↔ `CATALOGO`; lint de archivos (`Math.random`, `ctx.*` prohibidos, nombres `x*`); `draw()` sin excepción en los 6 estilos con `test/helpers/lab-vm.js` (carga `engine.js`+`juegos-bus.js` con stubs de canvas como `squad.test.js`).

---

## 8. Preguntas abiertas (solo lo que no se puede decidir con los docs)

1. **Prueba en teléfonos reales.** El «¡YA!» <100 ms y la jugabilidad de `f_harina` (C sin predicción de los otros) con RTT ≥200 ms solo se confirman en 2 móviles con datos; el e2e usa una sola máquina. Necesita al usuario.
2. **Mirones en vivo y toma de asiento a mitad de juego (DM2-14).** En M2 ven una tarjeta «mirando»; el paquete `w` (07 D18) queda para M5. ¿Se acepta así?
3. **Saltar el podio al tocar** (07 §6.1) requiere una acción nueva en el reductor; queda fuera de M2 (podio fijo de 5 s). ¿Se acepta?
4. **Modelos de `f_domino` (B) y `f_harina` (C)** se apartan de 08/09 por la tarea (DM2-1). Si el usuario prefiere los modelos de los docs, solo cambian `mo` del catálogo y la mitad B/C de cada juego.
