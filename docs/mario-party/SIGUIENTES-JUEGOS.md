# LA FIESTA · siguientes minijuegos (2026-10-17)

Estado del catálogo (`docs/style-lab/fiesta-reglas.js`, `CATALOGO`): 17 de 24 juegos ya están en vivo (`live:1`) y faltan 7 más los 3 retos épicos. Las fichas completas (reglas, puntaje, CPU, niveles, gag) están en `08-minijuegos-realtime.md` §9; el orden de oleadas, en §10.3.

Regla de trabajo (memoria «Lab builds: fast, no agent review»): un constructor rápido por juego, sin revisión adversarial, el usuario revisa. Se mantiene obligatoria la lista de verificación de §11 y las pruebas de red (`test/fiesta-live-<id>.test.js`) y el banco de balance (`pruebas/fiesta-<id>-bench.js`). Plantillas recientes: `fiesta-juego-cotufas.js`, `-cava.js`, `-alcabala.js`, `-bombita.js`, `-hallacas.js`, `-bono.js`.

## Ya en vivo (17)

`f_cola`, `f_domino`, `f_tequeno`, `f_harina`, `f_cotufas`, `f_cerro`, `f_perro`, `f_mecate`, `f_chancla`, `f_bombita`, `f_abuela`, `f_futbolito`, `f_hallacas`, `f_cava`, `f_patilla`, `f_bono`, `f_alcabala`.

## Pendientes (7 + 3 retos)

| Oleada | id | Nombre | Formato | Clase | Modelo | dur | Controles | Nota |
|---|---|---|---|---|---|---|---|---|
| 3 | `f_bombillo` | ¡SE VA LA LUZ! | FFA | survival | B | 45-50 | stick + A | Es la que queda de la oleada 3 (objetos B). |
| 4 | `f_guaya` | ¡LA GUAYA DEL TELEFÉRICO! | 1v3 | binary | B | 40-45 | por rol | Perilla de balance del solo: 38-52 %. |
| 4 | `f_silbon` | ¡EL SILBÓN EN EL LLANO! | 1v3 | binary | B | 45 | stick + A | Perilla de balance del solo: 38-52 %. |
| 5 | `f_cuerda` | ¡HALA LA CUERDA! | 2v2 | binary | C | 30 | A | Modelo C: sensible a la latencia, revisar `fairDelay`. |
| 5 | `f_bolas` | ¡BOLAS CRIOLLAS! | FFA | rank | C | 35-50 | stick + A | Modelo C. |
| 5 | `f_vagon` | ¡EL VAGÓN! | FFA | survival | C | 50 | stick + A | Modelo C. |
| 5 | `f_carrucha` | ¡LA CARRUCHA! | 2v2 | binary | Ceq | 40-45 | por rol | Modelo Ceq. |
| 6 | `f_reto_saltoangel` | ¡BÁJATE DEL SALTO ÁNGEL! | FFA | rank (PE) | A | ≈100 | A + B | Reto épico, hacerlo primero. |
| 6 | `f_reto_catatumbo` | ¡EL CORRIENTAZO DEL CATATUMBO! | 4 vs jefe | rank (PE) | C | 100 | stick + A + B | Reutiliza `juego-jefe-transformador.js`. |
| 6 | `f_reto_delta` | DELTAMACURA: EL CAÑO QUE NO EXISTE | 2v2 / 1v3 | rank (PE) | Ceq | ≈110 | por rol | El más complejo; al final. |

Orden sugerido: `f_bombillo` → `f_guaya` + `f_silbon` → `f_cuerda` + `f_bolas` + `f_vagon` + `f_carrucha` (los C, de a pocos) → retos R2, R1, R3.

Al registrar cada juego: entrada en `CATALOGO` con `live:1` y `lim`, correr `scripts/sync-fiesta-rules.sh`, `lim` en `pocketbase/pb_hooks/party_mj.js` (`LIM_DEFECTO`), `<script>` en `docs/style-lab/fiesta.html`, y ajustar las pruebas que fijan los conjuntos vivos (`test/fiesta-equipos.test.js`, `test/fiesta-teams.test.js`).

## Pendientes técnicos arrastrados

- `f_cotufas`: a 300 ms de retardo el juez aún gana ~63 % (límite 33 %). Se mejoró el runtime (la ventana de claims en `fiesta-live.js` se alarga con el tránsito observado) pero falta una solución de fondo.
- `f_futbolito`: ventaja del juez por encima de 1/2 + 8 pp (ver `M4-FUTBOLITO-JUEZ.md`); falla la prueba de red y `fiesta-equipos` bloque I.
- `f_bombita`: la práctica muestra un botón A aunque el juego declara `botones: 0` (probablemente en `fiesta-live.js`). Las mechas son más cortas que las de la ficha (7-10 s / 5-8 s) para que quepan 3 estallidos en 40 s.
- Fallos previos en `f_perro` (1 prueba), `f_mecate`, `f_abuela`, `f_tequeno` (ociosos que deberían perder).
- Ningún juego nuevo se ha probado con joystick o teclado reales, solo con bots y capturas (snes); falta pasar los e2e (`test/fiesta-mj.e2e.js`) y probar contra un PocketBase real.
- Ideas sin construir que salieron al diseñar: ver la lista de alternativas en `08-minijuegos-realtime.md` §9.
