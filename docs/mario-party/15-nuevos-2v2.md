# 15 · Dos 2v2 nuevos: carritos chocones y la mudanza

Fecha: 2026-10-27. Objetivo: el 2v2 tenía solo 3 juegos en vivo (futbolito, cava, hallacas). Con `f_cuerda` ya en vivo son 4;
estos dos llenan los arquetipos que faltaban: **arena de vehículos** y **cooperativo con objeto compartido**.
Son arquetipos de género, no copias: reglas, escenario y giro son nuestros.

---

## 1 · `f_chocones` · ¡CARRITOS CHOCONES!

| Campo | Valor |
|---|---|
| Formato / clase / dur | 2v2 · binary · 40 s |
| Modelo | **C** (como `f_vagon`): el juez simula los 4 carritos y los choques; los demás interpolan y predicen su propio carrito |
| Controles | Stick = dirigir (el carrito gira hacia el stick y acelera solo, con inercia). A = **¡ACELERÓN!** (0,5 s de empuje fuerte, enfriamiento 2 s, carga visible) |
| Escena | Los carritos chocones de la feria (la de la Chinita en Maracaibo o una feria de pueblo): pista con baranda de goma, techo de rejilla con chispas, luces de colores, el señor de la taquilla con micrófono |

**Cómo se puntúa.** Pegarle a un carrito RIVAL de frente contra su costado o su cola, con velocidad relativa por encima de un umbral,
es un **¡TOMA!** = 1 punto para tu equipo. Por la cola (golpe en el tercio trasero del rival) = **¡POR DETRÁS!** = 2.
Al que le pegan queda aturdido 0,5 s (gira y no responde) e inmune 0,8 s (no se pueden encadenar puntos contra el mismo).
Chocar con tu pana no da ni quita puntos (sí rebota). Más puntos al final gana; empate ⇒ 6 s de **¡MUERTE SÚBITA!** (el primer punto gana).

**El giro venezolano: ¡SE VA LA LUZ!** Cada 6-8 s (calendario sembrado en `mk`, idéntico en todas las pantallas) un **sector** de la
pista (un cuarto, marcado 1,2 s antes con la rejilla titilando) se queda sin corriente durante 2 s: los carritos que estén ahí se apagan
(no aceleran ni giran, solo se deslizan con la inercia). Pegarle a un carrito apagado vale **+1 extra**. O sea: hay que salir del sector
a tiempo, o empujar al rival para dentro.

**Niveles.** 1 día, 1 sector se apaga. 2 atardecer, conos de goma fijos en la pista y apagón más seguido. 3 noche, **dos sectores** a la vez
y el **carrito loco** (un carrito sin conductor, de la feria, que se mueve en línea recta y rebota: obstáculo sembrado, no puntúa).

**CPU.** Persigue al rival más cercano que le dé la espalda o al que esté apagado; huye del sector que titila; acelerón cuando está alineado
(con error según skill). Con pana humano, ataca al rival que NO persigue su pana.

**Gag.** El de la taquilla: «¡Se acabó la ficha, mi amor!» al final. Burbuja al apagón: «¡Corpoelec, otra vez!».

**Lo que pide el balance.** Simetría de lados ±10 pp con skill igual; empates ≤ 10 % (la muerte súbita los resuelve); el equipo fuerte
(.9+.9 contra .3+.3) gana ≥ 85 %; dos ociosos pierden siempre.

---

## 2 · `f_mudanza` · ¡LA MUDANZA!

| Campo | Valor |
|---|---|
| Formato / clase / dur | 2v2 · binary · 45 s, carrera en carriles paralelos sin contacto entre equipos |
| Modelo | **C**: el juez integra el sofá de cada equipo con las entradas de los dos que lo cargan |
| Controles | Stick = caminar (cada uno carga un extremo del sofá). A = **¡ARRIBA!** (levantar el sofá por encima de la cabeza) |
| Escena | Una escalera del cerro (las escaleras pintadas de un barrio de Caracas), de abajo hacia arriba. Cada equipo sube SU escalera, una al lado de la otra; arriba espera la tía en la puerta: «¡Cuidado con mi sofá!» |

**Cómo se juega.** El sofá es una barra rígida entre los dos panas, de largo fijo. Cada jugador mueve SU extremo con el stick; el sofá
avanza, gira y se traba según lo que hagan los dos. Si tiran para lados contrarios, el sofá no avanza (y se ve forcejear).
La escalera tiene **curvas cerradas** (callejones en L) donde el sofá solo pasa si uno se adelanta y el otro gira detrás: hay que coordinar.

**Obstáculos (sembrados, iguales para los dos equipos):**
- **Tendederos** cruzados a media altura: el sofá pasa solo si los DOS mantienen A (¡ARRIBA!) al cruzarlo. Levantado, el sofá va a la mitad de velocidad.
- **El perro de la vecina** que cruza el escalón: si toca a uno, ese suelta su extremo 0,6 s (el sofá se arrastra).
- **Una moto que baja** (nivel 2-3) por un carril marcado con aviso: hay que pegarse a la pared.

**Choques.** Si el sofá golpea una pared o un tendedero sin levantar: **¡RAYÓN!** (se detiene 0,4 s y la tía grita). Tres rayones
no te sacan, solo te demoran.

**Puntaje / ganador.** Gana el equipo que llega primero con el sofá a la puerta de arriba. Si nadie llega, gana el que subió más.
Puntaje del asiento = progreso (escalones subidos) + bono por llegar, igual para los dos panas.

**El giro venezolano.** Es la mudanza de verdad del barrio: no hay camión que suba, todo va a pulso. El letrero de la tía:
«SE VENDE NEVERA, PREGUNTE».

**Niveles.** 1 día, escalera con 2 curvas y 1 tendedero. 2 atardecer, 3 curvas, 2 tendederos y el perro. 3 noche, 4 curvas,
tendederos y moto; el sofá es más largo («ahora es el juego de comedor»).

**CPU.** Sigue una línea guía precalculada por escalera (el centro del pasillo, con los puntos de giro). Cada extremo CPU sigue su
punto de la guía; con pana humano, se adapta al extremo del humano (lo acompaña con retraso según skill). Levanta en tendederos con
acierto 70-95 %.

**Gag.** «¡Pa' tu lado! ¡No, pa' TU lado!» cuando forcejean. La tía al ganar: «¡Ay, llegó mi sofá!».

**Lo que pide el balance.** Simetría de lados ±10 pp (los dos carriles son la misma escalera, espejada); el equipo fuerte gana ≥ 85 %;
un ocioso con una CPU tarda claramente más (el sofá se arrastra solo con un extremo, a 1/3 de la velocidad).

---

## 3 · Integración

- Catálogo (`docs/style-lab/fiesta-reglas.js`): `f_chocones` y `f_mudanza` con `m:['2v2']`, `cl:'binary'`, `mo:'C'`, `live:1` y los `lim` que salgan del banco.
- `fiesta.html` carga los dos archivos; Margarita los añade a su ruleta de 2v2 y a los nombres.
- Pruebas: `test/fiesta-juego-<id>.test.js` (reglas, CPU, balance, límites) y el banco `docs/style-lab/pruebas/fiesta-<id>-bench.js`.
