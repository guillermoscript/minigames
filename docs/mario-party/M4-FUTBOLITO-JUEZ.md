# M4 · Ventaja del juez en `f_futbolito` (modelo C) — medición y causa (2026-10-17)

Alcance: todo lo de abajo sale de ejecuciones reales (no de lectura). Scripts de medición en el scratchpad (`juez.js`, `juez2.js`, `dbgj*.js`); no se tocó `fiesta-live.js` ni `fiesta-juego-futbolito.js`.
Único cambio de repo: un test `todo` al final de `test/fiesta-live-futbolito.test.js`.

## 1. Veredicto corto
- La ventaja existe y **no pasa la puerta**: el equipo del juez gana **≈ 60-73 %** (puerta: ≤ 58 % = 1/2 + 8 pp), con 5 % de pérdida.
- La causa **no está en el juego**: está en el runtime (compensación de lag del juez insuficiente). No hay arreglo claro dentro de `fiesta-juego-futbolito.js`, así que **no se editó**. Por eso no hay "antes/después" del juego.
- Se deja el test como `todo` (no tumba la suite). Se vuelve aserción real cuando el runtime baje la cuota a ≲ 58 % con margen.

## 2. Hallazgo importante sobre la medición (el "todo" medía otra cosa)
`H.mj().juez` leído **antes** de `cerrar()` es el juez *provisional* del arranque. En 177/180 partidas el juez migra (época > 0) al asiento de mejor RTT. El provisional gana ≈ 49 % (40-49 %); el juez **final** (el que simuló casi todo el partido) es el que da la ventaja. Cualquier test de "ventaja del juez" que lea el juez antes de cerrar (p. ej. el de `test/fiesta-live-abuela.test.js`, y el `--red` del banco, que lee `mj().juez` después, ese sí es el final) mide ruido. El test nuevo lee el juez final. **Para Área 3: revisar el test de abuela (y otros live-*) con este mismo defecto.**

## 3. Números (stack real, 4 bots skill .6 iguales, 2v2, dur 50 s, lv = 1 + seed%3, 5 % pérdida; cuota = victorias + ½ empates del equipo del juez final)
Comando: `node juez.js <delay> <N> 0.05 50 <seedBase>` (arnés `test/fiesta-live.test.js`).

| delay | semillas | cuota juez | W/L/E (juez/otro/empate) |
|---|---|---|---|
| 50 ms | 200 (5001-5200) | **73,5 %** | 133 / 39 / 28 |
| 150 ms | 200 | **68,2 %** | 124 / 51 / 25 |
| 300 ms | 200 | **60,5 %** | 102 / 60 / 38 |
| 50 / 150 / 300 | 100 c/u (1001-1100) | 65,5 / 65,0 / 65,5 % | — |
| 50 / 150 / 300 | 60 c/u (juez2, 1001-1060) | 72,5 / 59,2 / 61,7 % | — |

Ruido a N=200: ±3,3 pp (1 σ). A N=14 por celda el ruido es ±13 pp: la puerta "14 semillas" **no puede** decidir nada (da 38 %…71 % según qué juez se lea).
Test nuevo (42 partidas = 14 × 3 delays): 71,4 % (diagnóstico, `todo`).

Sin pérdida: 150 ms, 60 semillas: 85-90 % (hasta 3 000 y 1 000). Con 5 % de pérdida baja a 59-68 %: la pérdida estropea también al juez (su compañero/entradas), no es un alivio real.

Control sin red (banco local `node docs/style-lab/pruebas/fiesta-futbolito-bench.js`, 120 semillas): eq0 49 % / eq1 43 % / empate 8 % (lv1; lv2 51/43/6; lv3 48/43/8). Hay un sesgo de lado de ~3-6 pp a favor del equipo 0 (dentro de la puerta ±10), que explica algo del 59 % observado a 1 ms (donde el juez cae siempre en a/b = equipo 0; 60 semillas, 0 % pérdida: 59,2 %). El resto es ventaja de vista.

## 4. Causa raíz (medida)
1. El juez ve el mundo vivo; los demás lo ven **0,45 s** atrás a delay=150 sin pérdida (`kj − k_vista` = 0,45 s; 0,81 s con 5 % de pérdida; 1,24 s a 300 ms+5 %; 0,057 s a 1 ms). Es D_MIN/D_MAX (0,10-0,25) + latencia + periodo de snapshot (10 Hz) + reintentos.
2. El runtime compensa solo **la acción** del juez (`fairDelayEq` = 2·min(RTT/2, FAIR_MAX 0,12) + FAIR_TEAM_BASE 0,04 ⇒ **tope práctico 0,28 s**), nunca su percepción. 0,28 s < 0,45-0,8 s de ventaja de vista. Además `fair()` cae a 0,000 de forma intermitente con pérdida (el RTT medido se vacía), dejando al juez sin retraso en esos tramos.
3. En el juego, la pelota **sí** se extrapola ya en los no-juez (`extrapolaPelota`): su estimación `lag` (0,40 s) coincide con el retraso medido (0,45 s) sin pérdida; con pérdida se topa en LAG_MAX = 0,6 s (subestima los 0,8 s reales). Los cuerpos rivales no se predicen (correcto: no se puede). `c.lag` no existe en el runtime (`lag=-1` en el juez, estimado en el resto).

Prueba causal (mutando `LIVE.K` en proceso desde el script, sin tocar archivos; 150 ms, 60 semillas 3001-3060):

| K | sin pérdida | 5 % pérdida |
|---|---|---|
| actual (FAIR_MAX .12, TEAM_MAX .5, BASE .04) | 85,0 % (y 90 % en 1001-1060) | 59,2 % (68,3 % en 1001-1060) |
| FAIR_MAX .25, FAIR_TEAM_MAX .8 | 73,3 % | 53,3 % |
| FAIR_MAX .4, FAIR_TEAM_MAX 1.2, FAIR_TEAM_BASE .10 | **56,7 %** | **55,0 %** |

Es decir: subir el retraso de la entrada del juez hasta ≈ el retraso de vista iguala la partida. Costo: el juez humano vería a su propio cuerpo reaccionar 0,5-1 s tarde (injugable si no se predice su cuerpo), así que esa receta, tal cual, no es aceptable para humanos; los bots no sufren la sensación.

## 5. Por qué no hay arreglo del lado del juego
- Fuera del control de `fiesta-juego-futbolito.js`: tiempo de vista de los demás, retardo de entrada del juez, `c.lag`.
- Lo que sí podría el juego (no hecho, no es "claro"): (a) hacer el campo/pelota más lentos para que 0,45 s pese menos (cambia el balance 2-3 goles, simetría y ritmo ya validados; requiere re-correr el banco y probar en móviles); (b) que el juez dibuje/ejecute su cuerpo con predicción y solo retrase la *pelota que le toca*… requiere API del runtime. Ambos son decisiones de diseño, no un arreglo mínimo.

## 6. Qué queda / para Área 3 (`fiesta-live.js`)
1. Compensación de lag del juez **acotada por la vista real**, no por RTT/2: subir/retirar los topes FAIR_MAX / FAIR_TEAM_MAX, o mejor, retrasar la *percepción* del juez (dibujar su vista del mundo 0,3-0,45 s atrás de su propia simulación en 2v2) en vez de su entrada; así el cuerpo propio sigue respondiendo.
2. Exponer `c.lag()` (medido: `ahora − t_snapshot_mostrado`) para que `extrapolaPelota` no dependa de la heurística ×0,5 ni se tope en 0,6 s con pérdida.
3. `fairDelay` cae a 0 con pérdida (`net.rtt` sin muestras): conservar el último RTT válido.
4. Arreglar el test de ventaja de abuela (y revisar los otros live-*): leer el juez FINAL (`mj().juez` después de `cerrar`), no el provisional.
5. Criterio para convertir el `todo` de `test/fiesta-live-futbolito.test.js` en aserción: cuota del juez ≤ 58 % a 50/150/300 con N ≥ 200 por celda (con N=14 el ruido ±13 pp lo hace inservible; la aserción con N pequeño solo vale como guardia gruesa, p. ej. ≤ 80 %). Hoy: 60,5-73,5 % ⇒ no pasa ⇒ sigue `todo`.
6. Pendiente de la puerta 08: 1/n+8 pp sobre 200 semillas por *banco* para ffa; para 2v2 el equivalente es 58 %. El `--red` actual del banco usa pérdida 0 y delays 1/150/300 y no refleja la puerta con 5 % de pérdida.

## 7. Comandos
```
node --test test/fiesta-juego-futbolito.test.js      # 18/18 (sin cambios)
node --test test/fiesta-live-futbolito.test.js       # 8 pass + 1 todo (el nuevo; 71,4 % en 42 partidas)
node docs/style-lab/pruebas/fiesta-futbolito-bench.js   # simetría local OK
node <scratch>/juez.js 150 200 0.05 50 5000          # cuota del juez final
KOV='{"FAIR_MAX":0.4,"FAIR_TEAM_MAX":1.2,"FAIR_TEAM_BASE":0.1}' node <scratch>/juez.js 150 60 0.05 50 3000
```
