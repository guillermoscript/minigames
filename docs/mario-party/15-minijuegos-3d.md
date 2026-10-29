# 15 · Minijuegos en 3D low poly: guía para agentes y plan de qué rehacer

Estado: 27 de octubre de 2026. Piloto hecho y aprobado: **¡AGUA EN CARNAVAL!** (`f_bombita`). Personajes 3D reutilizables hechos y aprobados.

Por qué existe esto: el dueño jugó los 25 minijuegos en la galería y los encontró aburridos y «cutres». No tienen música, no tienen efectos, y los personajes son bloques quietos («se sienten slides»). La decisión fue rehacer los minijuegos en 3D low poly con three.js, **uno a la vez**: se hace uno, él lo juega y decide. Esto reemplaza la regla «solo 16 bits» para el arte de los minijuegos.

---

## 1. Archivos

| Archivo | Qué es |
|---|---|
| `docs/style-lab/fiesta-3d.js` | El kit (`FIESTA.V3`): escena, cámara, luces, materiales de caricatura con contorno, partículas, música y efectos de sonido. |
| `docs/style-lab/fiesta-3d-pj.js` | Los personajes (`FIESTA.V3.PJ`): el elenco de 8, con su ropa, caras, animaciones y la regla de que nada atraviesa el cuerpo. |
| `docs/style-lab/personajes-3d.html` | Visor del elenco: un botón por animación, gesto y cara. Úsalo para revisar un personaje o una animación nueva. |
| `docs/margarita/galeria.html` | Galería para jugar cualquier minijuego en la PC. Los que ya tienen 3D se marcan en `TRES_D`, y su tarjeta trae el botón «2D (ANTES)». |
| `docs/style-lab/fiesta-juego-bombita.js` | **La plantilla**: el primer juego portado. Copia su estructura. |
| `docs/style-lab/engine.js` (`postSNES`) | Enganche de una línea: si hubo 3D en el cuadro, el lienzo pixelado va encima, sin trama y con transparencia. |
| `docs/style-lab/fiesta.html` | Carga `../../js/vendor/three.min.js`, `fiesta-3d.js` y `fiesta-3d-pj.js` antes de los juegos. |
| `test/fiesta-3d-pj.test.js` | Prueba los personajes: nada atraviesa el cuerpo en ninguna pose o gesto, y en reposo no tiemblan. |

three.js es la **r128** y ya está en el repo (`js/vendor/three.min.js`). No hay `GLTFLoader` ni modelos externos: todo se construye con primitivas en código.

## 2. Cómo funciona (lo que hay que entender antes de tocar)

- **Solo cambia el dibujo.** La simulación, la red, los eventos, los puntajes, la CPU y `vista()` del juego no se tocan. El juego en línea sigue igual porque los otros jugadores solo reciben estado, no dibujo.
- **Un canvas WebGL detrás del lienzo del motor (`#c`).** `esc.render()` dibuja el 3D a la resolución real de la pantalla y deja transparente la zona del juego en el lienzo pixelado. Encima va lo 2D de siempre: textos, HUD, la cuenta 3·2·1 y las tarjetas. Si en un cuadro no hubo 3D, el canvas WebGL se esconde.
- **El 2D viejo queda de respaldo.** Si no hay WebGL o la URL trae `?plano=1`, el juego dibuja como antes. Así se compara, y así corren las pruebas en node.
- **La música se apaga sola** cuando el juego deja de dibujar 3D (más de 300 ms sin cuadro).

## 3. Reglas que rompen cosas si no se siguen

1. **El lint del juego.** Lo vigila `test/fiesta-juego-<id>.test.js`. En `fiesta-juego-*.js` no puede haber:
   - `Math.random`, `Date.now` ni `performance.now`;
   - `=>`, `let`, `const`, `?.`, `??`, `...` ni `async`;
   - `ctx.drawImage`, `ctx.fill…` ni `ctx.stroke…` sueltos (usa las primitivas del laboratorio: `txt`, `rr`, `ell`…).

   Por eso:
   - el azar cosmético sale de `c.fx()`;
   - el reloj cosmético es `absT`, que avanza en `update`;
   - todo es `var`/`function`.

   Los archivos del kit (`fiesta-3d*.js`) **no** tienen esta regla.
2. **El `dt` del dibujo sale de `absT`.** Si no hubo `update` entre dos cuadros, `dt = 0`: en ese cuadro no muevas nada (`if (dt > 0) actualizar3D(dt, now)`). Si no, la velocidad sale 0 y las animaciones parpadean entre correr y quieto.
3. **`visible` tiene que ser un booleano.** three.js solo esconde un objeto si `visible === false`, así que `obj.visible = 0` lo deja visible. Usa `!!cond`.
4. **Colores tal cual (r128).** No actives `outputEncoding = sRGBEncoding`: three trata los hex como lineales y todo sale lavado. El kit ya lo deja bien.
5. **InstancedMesh:** llama a `setColorAt` **antes** de poner `count = 0`. El búfer de color se crea con el `count` de ese momento; si es 0, queda vacío y no se dibuja nada. `V3.particulas` ya lo hace bien: úsala.
6. **Luces:** hemisferio + sol no deben pasar de ~1.3 en total, o el piso se quema a blanco. Valores probados para día, atardecer y noche: `PAL3` en bombita.
7. **Los textos 2D sobre el 3D** se dibujan en `draw()` **después** de `esc.render()`, con `txt(...)`, en la posición que da `esc.proyectar(x, y, z)`. Para los avisos del juego (`S()`/`say`), usa una función como `sobre(p, alto)` de bombita, que proyecta desde el 3D o cae al 2D.
8. **No apagues la regla de que nada atraviesa el cuerpo** (`crear(id, {choques:false})` solo existe para pruebas). Si agregas una animación, tiene que pasar `test/fiesta-3d-pj.test.js`.

## 4. Receta: portar un juego a 3D

Mira `fiesta-juego-bombita.js`, desde `/* ───── 3D low poly` hasta `dibujar3D`. El esqueleto, dentro de `mk(c)` y antes de `var g = {`:

```js
var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;      // v3: null = sin probar, false = sin 3D (2D de siempre)
var ESX = 1 / 18, ESZ = 1.15 / 18;                             // px de la simulación -> metros (z con el factor de distancia que use el juego)
function WX(x) { return (x - AW / 2) * ESX; }
function WZ(y) { return (y - AH / 2) * ESZ; }
function montar3D() {
  var T = THREE, esc = V3.escena({ fondo: V3.cielo('#5ab8ff', '#cfeeff'), niebla: ['#cfeeff', 70, 160], fov: 32 });
  if (!esc) return null;
  // escenario: V3.malla(geometría, color, {recibe, g (grosor del contorno), borde:false, em (emisivo)})
  // personajes: un V3.PJ.crear(asiento(k).ch, {prop:false, escala:1.35}) por jugador; esc.scene.add(pj.g)
  // efectos: var part = V3.particulas(esc, 500)
  esc.encuadrar(anchoMundo, altoMundo, new T.Vector3(0, .8, 2), .74);   // la cámara encuadra ese rectángulo (inclinación en rad)
  return { esc: esc, pjs: [], part: part };
}
function actualizar3D(dt, now) {
  // por jugador: posición desde la simulación (P[p]), velocidad = delta/dt, y luego
  //   pj.anim('correr'|'quieto'|…, {vel}).cara('normal'|'susto'|…).rumbo(Math.atan2(vx, vz)).update(dt)
  // gestos de una vez desde onEv: pj.uno('saltar'|'lanzar'|'golpe'|'caer'|'festejo')
  v3.part.update(dt);
}
function dibujar3D(f) {
  var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(); v3T = absT;
  if (dt > 0) actualizar3D(dt, now);
  if (now >= 0) V3.musica('carnaval');                         // o la pista del juego (ver §5, PISTAS)
  v3.esc.render(dt);
  // textos encima: txt(nombre, pt.x, pt.y, …) con pt = v3.esc.proyectar(x, 0, z + 1.1)
}
```

En `draw()`, al principio:

```js
if (v3 === null && V3 && V3.listo()) v3 = montar3D() || false;
if (v3) return dibujar3D(cp());
// … aquí sigue el dibujo 2D de siempre, sin cambios
```

En `onEv`:
- cada efecto 3D va detrás de `if (v3) … else` con el efecto 2D viejo;
- dispara los gestos del personaje: `lanzar` al pasar, `saltar` al recibir, `golpe` al ser alcanzado;
- dispara los sonidos: `V3.sfx('pop'|'splash'|'whoosh'|'tic'|'latido')`.

Al final:
1. Marca el juego en `galeria.html`: `const TRES_D = { f_bombita: 1, f_<id>: 1 }`.
2. Corre las pruebas del juego y de los personajes.
3. Juégalo en los 3 niveles en la galería.

### Escenario: lo que funcionó en el piloto

- **Una por nivel:** día, atardecer y noche, cada una con su paleta (`PAL3`). De noche: ventanas y bombillos emisivos más 2 `PointLight`.
- **Fondo con contexto** (casas, iglesia, palmeras, faroles) y objetos que se mueven solos (banderines que ondean, hojas, confeti cayendo).
- **Un lugar para los eliminados** (el banco), donde siguen animados.
- **Cámara que sigue a los vivos**, con un mínimo y un máximo de encuadre, suavizada (ver bombita, `/* cámara:`).
- **Cada evento con efecto 3D, sonido y sacudida de cámara** (`esc.sacudir(1)` para lo fuerte).

## 5. Referencia del kit (`FIESTA.V3`)

| Llamada | Qué hace |
|---|---|
| `V3.listo()` | `true` si hay three.js y WebGL y la URL no trae `?plano=1`. |
| `V3.escena({fondo, niebla:[col, cerca, lejos], fov})` | Devuelve `esc = {scene, camera, luces:{hemi, sol}, encuadrar(w, h, mira, incl), sacudir(k), proyectar(x, y, z) → {x, y}, render(dt)}`. El sol ya proyecta sombras. |
| `V3.malla(geo, color, op)` | Malla con material de caricatura y contorno de tinta. `op`: `recibe` (recibe sombra), `sombra:false`, `borde:false`, `g` (grosor del contorno, 0.02–0.1), `em`/`emI` (emisivo), `op` (opacidad), `mat` (material propio). |
| `V3.toon(color, op)` | Material de 3 tonos, compartido por color. `{nuevo:true}` da uno propio, para cambiarle el color en vivo. |
| `V3.borde(mesh, g)` | Le pone contorno a una malla tuya. |
| `V3.particulas(esc, max)` | Devuelve `{soltar(x, y, z, n, {k:'gota'\|'confeti'\|'chispa', cols, vel, arriba, g, vida, esc}), update(dt)}`. |
| `V3.musica(id)` / `V3.callar()` | Música procedural. Respeta el volumen de OPCIONES (`minicaos-opts-v1`). |
| `V3.pista(id, {bpm, acordes, mel})` | Registra la pista del juego **desde el archivo del juego** (no edites `PISTAS` del kit): `acordes` = 4 acordes de 3 notas MIDI, `mel` = 32 pasos (MIDI o 0). Llámala dentro de `montar3D()`. |
| `V3.sfx(k)` | `splash` `pop` `tic` `whoosh` `latido` `silbido` `resbalon` `golpe` `choque` `salto` `caida` `ding` `moneda` `error` `bocina` `motor` `chispa` `tambor` `trueno` `viento` `silbato` `aplauso`. |
| `V3.cielo(arriba, abajo)` · `V3.texturaCanvas(w, h, pinta, [rx, ry])` | Fondo en degradado, y texturas pintadas con canvas (adoquines, baldosas…). |
| `V3.oscurecer(hex, k)` | Aclara u oscurece un color: menor que 1 oscurece, mayor que 1 aclara. |

## 6. Referencia de personajes (`FIESTA.V3.PJ`)

```js
var pj = V3.PJ.crear('mama', { escala: 1.35, prop: false, camisa: null });   // pies en y = 0, mira hacia +z
scene.add(pj.g);
// cada cuadro (mueve pj.g.position TÚ; el kit lee de ahí la velocidad real):
pj.anim('correr', { vel: 0.8 }).cara('susto').rumbo(angulo).update(dt);
pj.uno('patear');                          // gesto de una vez
pj.impacto(dx, dz, 1.4);                   // golpe con dirección (mundo): cede y vuelve con resorte
pj.volar(dx, dz, 2.5);                     // sale volando como muñeco, rebota, se acuesta y se levanta
pj.mirarA(objetivo.position);              // ojos, luego cabeza, luego torso
```

**Solo se agrega: la API vieja no cambió** (`crear`, `anim`, `uno`, `cara`, `rumbo`, `mirar`, `prop`, `mano`, `color`, `update`, `{vel}`). Un nombre desconocido cae en `quieto`. Total: **74 animaciones en bucle, 64 gestos, 25 caras, 8 efectos** (las nuevas están en las tablas marcadas «NUEVA»; revisión completa en `docs/style-lab/ANIMACION-AUDITORIA.md`).

### Cómo está hecho (las 6 capas)

1. **Pose en bucle** (`anim`) con cross-fade **según de dónde a dónde va** (susto/tambaleo 0.09 s, arrancar 0.13, caminar↔correr 0.24, parar 0.24, tumbarse/dormir 0.42, sentarse 0.3, el resto 0.18) y **llegada escalonada**: cadera y piernas primero, luego torso, brazos y al final la cabeza con un poquito de sobreimpulso (follow-through). Al arrancar se echa atrás, se agacha y se lanza (anticipación); al pasar de correr a caminar se asienta. Cada personaje tiene fase y cadencia propias y **personalidad** (`V3.PJ.PERS`).
2. **Gesto de una vez** (`uno`): fotogramas clave por tecla (anticipación, acción, sobreimpulso, recuperación) con entrada y salida suaves sobre la pose. Cada gesto ya trae su cara (y parpadea al empezar). Los de siempre siguen siendo funciones.
3. **Locomoción real:** el kit mide cuánto mueves `pj.g.position` (velocidad y aceleración) y de ahí sale la **cadencia**: el pie apoyado va hacia atrás a la velocidad del cuerpo (no patina; el paso se acorta si vas lento y se estira si vas rápido), la cadera baja al abrir las piernas, la pelvis y el torso giran en contra, se inclina al acelerar y hacia adentro en las curvas. Sin velocidad real (el juego no mueve `g`) usa `vel` como antes. **Arranque** (inclinación), **frenazo** (al dejar de correr se echa atrás, derrapa y rebota) y **giro brusco** (la cabeza se adelanta al cuerpo).
4. **Mirada:** ojos primero (las pupilas saltan), luego la cabeza (resorte, límite ≈ ±55°) y luego el torso, en total ≈ ±66° con `mirar(±1)` y hasta ±90° con `mirarA(punto)`. Parpadea con la acción: al cambiar de mirada, al aterrizar, al recibir un golpe; a veces doble.
5. **Física secundaria por resortes amortiguados** (cabeza, pelo, cola de caballo, rizos, flequillo, aretes, el objeto de la mano, hombros, codos, columna): el overlap y el follow-through salen solos de la aceleración real del grupo, de la aceleración angular de la pose y de la gravedad al saltar. Un hombro nunca pasa de la horizontal.
6. **Impacto y ragdoll ligero** (abajo).


### Personalidad y vida en espera (nuevo)

- **Personalidad por personaje** (`V3.PJ.PERS`, no cambia dónde pisan los pies, así que el paso sigue sin patinar): `tempo` (ritmo), `rebote` (cuánto sube y baja al andar), `ancho` (pasos y brazos abiertos), `brazos` (cuánto bracea), `bal` (balanceo de cadera), `cad` (giro de cadera), `nervio` (inquietud), `peso` (cuánto aplasta al caer, cuánto cuesta frenar, gestos un poco más lentos), `lado` (lado dominante: un brazo suelto más que el otro) y `cab` (cabeza ladeada habitual). **El tío** es pesado (lento, pasos anchos, se hunde en cada paso, vuela poco al correr); **la abuela** lenta y firme (poco rebote, brazos quietos); **el pana** nervioso y rebotón (rápido, brazos sueltos, tics); **la prima** mueve la cadera; **el cobrador** ágil y suelto; **el portu** pesado y calmado; **mamá** enérgica; **TÚ** neutro.
- **Espera con vida:** cada tanto cambia el peso de un pie al otro (irregular, no un seno), mira a un lado con los **ojos primero**, parpadea y la **cabeza los alcanza** con un resorte (si la mirada es chica solo se mueven los ojos); el nervioso tiene tics. Se apaga solo cuando el juego manda mirar (`mirar`/`mirarA`) o hace un gesto.
- **Parpadeo con intención:** perfil suave (cierra rápido, abre más despacio); lento con sueño o aburrimiento, casi no parpadea con miedo, concentración o esfuerzo, el nervioso parpadea más.
- **`aire`** ahora reacciona a la velocidad vertical real: subiendo recoge las piernas, bajando abre los brazos y extiende un pie hacia el piso. **`V3.PJ.reloj = () => segundos`** sincroniza `grupo_salta` entre todos los personajes (por defecto usa el reloj del navegador).

### Física: `impacto` y `volar`

- `pj.impacto(dx, dz, fuerza)`: `(dx, dz)` es hacia dónde empuja el golpe en el mundo (se normaliza; da igual el rumbo del personaje). `fuerza` ≈ 0.3 roce, 1 golpe normal, 2 fuerte. El cuerpo se inclina como un palo desde los tobillos en esa dirección (a más fuerza, más ángulo), se aplasta, flexiona las rodillas, la cabeza y el pelo hacen látigo, los brazos se van al lado contrario, pone cara de dolor, y todo vuelve con **resorte** (rebota 1-2 veces). Con `fuerza ≥ 2.4` (o `{ tumbar: n }`) en vez de eso llama a `volar`. Se puede encadenar (ráfagas).
- `pj.volar(dx, dz, fuerza, { giro, alcance, suelo, mover })`: ragdoll. Parábola con giro libre (por el eje del empuje), brazos y piernas **sueltas** que cuelgan de resortes poco amortiguados con aleteo, rebota (hasta 2 veces), se acuesta boca arriba o boca abajo según cómo giró (sin hundirse en el piso), se queda `suelo` segundos (con estrellitas si fue fuerte) y **se levanta** con anticipación (junta las piernas, se apoya, se sienta o hace flexión, se pone en cuclillas y se para) hasta volver a la pose en bucle. `fuerza` ≈ 0.5 caída, 1 tumbo, 3 vuelo largo. Por defecto el kit **nunca escribe `pj.g.position`** (los juegos lo reescriben cada cuadro): el desplazamiento es solo visual, vive en la raíz del personaje y se limita a ~1 m × `alcance`; se queda donde cayó mientras rueda y se levanta, y al final vuelve a su sitio con un saltito corto. Solo con `{ mover: true }` mueve `pj.g.position` de verdad (al empezar a levantarse). `giro` (0 = sin vueltas), `alcance` (distancia y tope del desplazamiento visual), `suelo` (segundos en el piso).
- Estado: `pj.volando` (true hasta que termina de levantarse), `pj.fase` (`aire`, `suelo`, `sube`), `pj.desplazamiento`. Mientras vuela se ignoran los `uno()`.
- Atajos: los gestos `caer_atras`, `caer_adelante` y `resbalon` son `volar` con poca fuerza.

### Animaciones en bucle (`anim`)

**Base**

| Nombre | Qué hace |
|---|---|
| `quieto` | respira, carga el peso a un pie, mira alrededor; cada tanto una variante de espera al azar (bostezo, reloj, estirarse, rascarse, miradas) |

**Locomoción**

| Nombre | Qué hace |
|---|---|
| `caminar` | paso con cadera que baja al abrir, contragiro de pelvis y torso y cadencia atada a la velocidad real (el pie apoyado no patina) |
| `correr` | zancada con vuelo, brazos que bombean, inclinación según la velocidad; al frenar derrapa y rebota |
| `cargar` | algo sobre la cabeza, pasos medidos |
| `aire` | en el aire: piernas recogidas, brazos arriba |
| `agacharse` | en cuclillas |
| `cansado` | camina cansado: arrastra los pies, cabeza caída, jadea |
| `pesado` | camina cargando peso en los brazos: echa el cuerpo atrás, pasos anchos y cortos |
| `asustado` | corre asustado: manotea, mira atrás a cada rato |
| `sigilo` | camina agachado y de puntitas, escaneando |
| `preparado` | en guardia: agachado, rebotando sobre las puntas |
| `equilibrio` | en un pie con los brazos abiertos corrigiendo |
| `jadeo` | manos en las rodillas, resoplando (tras correr) |
| `retroceder` | **NUEVA** · camina o trota de espaldas: el pie apoyado va hacia adelante y mira por encima del hombro (GAIT: usa la velocidad real) |

**Victoria**

| Nombre | Qué hace |
|---|---|
| `celebrar` | salta y bombea los puños alternos |
| `bailar` | baile de caderas y brazos |
| `victoria` | saltos de alegría: se agacha, despega con los puños en alto y cae amortiguando |
| `campeon` | pecho afuera, bíceps al aire, mentón arriba |
| `ganador` | baile del ganador estilo disco: dedo al cielo y caderas en shimmy |
| `rodillas` | de rodillas con los brazos al cielo, agradecido |
| `animar` | hincha de la barra: brazos alternos arriba, saltitos |
| `grupo_salta` | **NUEVA** · saltos de alegría de todos al unísono (reloj compartido), brazos en alto |

**Baile** (nuevo)

| Nombre | Qué hace |
|---|---|
| `salsa` | **NUEVA** · paso básico: peso de pie a pie, caderas en ocho, brazos doblados que se turnan, notas musicales |
| `robot` | **NUEVA** · poses duras que saltan de golpe, cabeza que se traba |
| `twist` | **NUEVA** · bajito, caderas contra hombros |
| `brincos` | **NUEVA** · saltos de tijera |

**Derrota**

| Nombre | Qué hace |
|---|---|
| `triste` | hombros caídos, suspiros y de a ratos un sollozo |
| `derrota` | de rodillas con las manos en la cabeza, negando |
| `rabieta` | pataleta: patea el piso alterno y golpea el aire |
| `desplome` | tirado boca abajo, golpea el piso y patalea sollozando |
| `lloron` | manos tapando la cara, llora a hipidos |

**Reacción**

| Nombre | Qué hace |
|---|---|
| `mojado` | tirita abrazado |
| `mareado` | se bambolea en círculo |
| `aturdido` | en las nubes: cabeza en círculos, rodillas que fallan, estrellitas |
| `cubrirse` | agachado con los antebrazos sobre la cabeza |

**Reposo**

| Nombre | Qué hace |
|---|---|
| `sentado` | sentado |
| `dormitar` | de pie cabeceando: cae la cabeza y pega el brinco |
| `dormir` | acostado boca arriba, roncando, con zetas |
| `sentado_celebra` | sentado celebrando: puños arriba y rebotes |
| `sentado_miedo` | sentado encogido con las manos en la cara |
| `sentado_aburrido` | sentado derrumbado, barbilla en la mano, pie columpiando |
| `sentado_enojado` | sentado con los puños en las rodillas, taconeando |

**Esfuerzo**

| Nombre | Qué hace |
|---|---|
| `empujar` | empuja algo con el cuerpo inclinado |
| `empujado` | manotea para no caerse de espaldas |
| `forcejear` | forcejea contra otro (se ponen dos así de frente): gruñe, tiembla, clava los pies |
| `halar` | tira de una cuerda: se echa atrás y de a tirones recoge los brazos |
| `trepar` | trepa abrazado a la pared, mano y pie contrarios alternados |
| `colgar` | colgado de las manos; péndulo, patalea si hay esfuerzo (vel) |
| `resbalar` | patina sin control: brazos de molino, piernas abiertas |
| `nadar` | crol boca abajo: brazadas de molino, patada, gira la cabeza a respirar |
| `chapotear` | flota en vertical: bracea y pedalea bajo el agua |
| `montar` | a horcajadas, rebotando al trote, agarrado de las riendas |
| `carretilla` | **NUEVA** · empuja una carretilla: manos a la cadera, cuerpo inclinado, sudando |
| `carga_tiro` | **NUEVA** · arma un tiro: con `vel` sube la torsión y el temblor (suéltalo con `uno("lanzar_arriba")`) |
| `halar_fuerte` | **NUEVA** · tirón a muerte de la cuerda: pierna de atrás recta, la de adelante flexionada, se hunde en cada tirón |
| `gatear` | **NUEVA** · a gatas: mano y rodilla contrarias avanzan |
| `remar` | **NUEVA** · sentado remando: palada rápida, vuelta lenta y estirada |
| `pescar` | **NUEVA** · caña en la mano: espera, picotazo, tirón y recoge |
| `borde` | **NUEVA** · agarrado de un borde: piernas buscando apoyo, la mano derecha se resbala de a ratos |
| `pared` | **NUEVA** · pegado a la pared resbalando y reagarrándose |
| `tambalear` | **NUEVA** · al filo de caer: torso que va y viene, brazos en molino |

**Actitud**

| Nombre | Qué hace |
|---|---|
| `saludar` | saluda con la mano |
| `gritar` | puños arriba, cabeza atrás, tembloroso |
| `aplaudir` | aplaude |
| `provocar` | "ven, ven" con una mano, la otra en la cadera, caderas desafiantes |
| `burla` | "nananá": manos aleteando junto a las orejas, cabeza bamboleando |
| `reirse` | doblado de la risa con la mano en la panza |
| `senalar` | señala con el brazo estirado dando un empujoncito |
| `asentir` | "sí, sí" con la cabeza |
| `negar` | "no, no" con la cabeza y los hombros |
| `impaciente` | brazos cruzados, taconea, resopla y mira de lado |
| `pensar` | mano al mentón, cabeza ladeada |
| `revolver` | revuelve la olla en círculos con la otra mano en la cintura |
| `asombrado` | boquiabierto, brazos medio abiertos |

Con `quieto`, cada 6–15 s (si nadie le dice nada ni lo mueve) hace al azar una espera: `bostezo`, `reloj`, `estirarse`, `rascarse` o `miradas`. Se apaga con `anim('quieto', { idle: false })`. Las que tienen cara propia la usan si el juego deja `cara('normal')`; si el juego pone otra, gana la del juego.

### Gestos de una vez (`uno`)

**Salto**

| Nombre | Qué hace |
|---|---|
| `saltar` | agacha, estira al despegar, recoge y aplasta al caer |
| `festejo` | salto con giro de torso y puños arriba |
| `giro` | pirueta rápida con salto |

**Lanzar y golpear**

| Nombre | Qué hace |
|---|---|
| `lanzar` | lanzamiento clásico con anticipación |
| `pegar` | puñetazo con anticipación |
| `lanzar_arriba` | lanzamiento por encima (pesado): arma el brazo atrás y suelta con paso adelante |
| `lanzar_abajo` | lanzamiento por debajo (bolos, lob): zancada y barrido hacia arriba |
| `lanzar_lado` | lanzamiento lateral (frisbee): cruza el brazo y lo abre de latigazo |
| `empujon` | empujón con las dos manos: carga, arremete y sostiene |
| `patear` | patada: pierna atrás, golpe, continúa y salta en el otro pie |
| `cabecear` | cabezazo: se agacha, salta, arquea y cabecea |
| `atrapar` | atrapar: manos abiertas, contacto y amortigua al pecho |

**Caídas**

| Nombre | Qué hace |
|---|---|
| `golpe` | lo golpean: se dobla de golpe y rebota con resorte |
| `caer` | cae de espaldas con rebote |
| `susto` | salta de la impresión (signo de exclamación) |
| `tropezar` | tropieza hacia adelante y se recompone |
| `caer_atras` | cae de espaldas con ragdoll suave y se levanta |
| `caer_adelante` | cae de bruces con ragdoll suave y se levanta |
| `resbalon` | resbalón: los pies vuelan, cae de espaldas con ragdoll y se levanta |
| `tiron` | **NUEVO** · lo jalan de golpe: pierna adelante y cuerpo volcado (perder el tira y afloja) |
| `heroe` | **NUEVO** · aterrizaje de superhéroe: rodilla y puño al piso, se levanta con pose |

**Esquivar**

| Nombre | Qué hace |
|---|---|
| `esquivar` | esquiva echándose atrás |
| `esquivar_izq` | esquiva con un paso lateral a un lado |
| `esquivar_der` | esquiva con un paso lateral al otro lado |
| `esquivar_abajo` | se agacha para esquivar |
| `esquivar_salto` | salta por encima con las piernas recogidas |
| `cubrir` | se cubre la cabeza de golpe y aguanta |
| `voltereta` | **NUEVO** · voltereta hacia adelante: el cuerpo gira entero 360° encogido (la verdadera rodada pegada al piso necesita bajar el pivote del cuerpo: ver pendientes) |

**Gestos**

| Nombre | Qué hace |
|---|---|
| `si` | asiente con la cabeza |
| `no` | niega con la cabeza |
| `encoger` | se encoge de hombros (duda) |
| `facepalm` | se da una palmada en la cara |
| `sorpresa` | salta de sorpresa |
| `saludo` | saludo con la mano, una sola vez |
| `aplauso` | tres aplausos |
| `reverencia` | reverencia con la mano al pecho |
| `senal` | señala con anticipación |
| `pulgar` | pulgar arriba con guiño |
| `guino` | guiño con la cabeza ladeada |
| `eureka` | idea: dedo al cielo y bombillo |
| `duda` | manos abiertas, cabeza ladeada, signo de interrogación |
| `risa` | carcajada sacudiendo el cuerpo |
| `grito` | grito con la cabeza atrás |
| `puno` | puño al cielo |
| `chocala` | choca esos cinco |
| `derrapar` | derrape de freno con brazos abiertos |
| `abrazo` | **NUEVO** · abre los brazos y abraza apretando con balanceo |
| `hombrazo` | **NUEVO** · se echa atrás y choca el hombro contra el de al lado |
| `beso` | **NUEVO** · tira un beso con un guiño y sale un corazoncito |
| `corazon` | **NUEVO** · forma un corazón con los brazos sobre la cabeza y late |
| `paz` | **NUEVO** · signo de paz junto a la cara con guiño |
| `callar` | **NUEVO** · dedo a la boca pidiendo silencio mientras vigila |
| `llamar` | **NUEVO** · llama con la mano: «ven, ven» |
| `saludo_militar` | **NUEVO** · saludo militar firme |
| `flexionar` | **NUEVO** · enseña los bíceps con orgullo |

**Espera**

| Nombre | Qué hace |
|---|---|
| `bostezo` | bosteza estirando |
| `reloj` | mira el reloj de pulsera |
| `estirarse` | se estira con los brazos arriba |
| `rascarse` | se rasca la cabeza |
| `miradas` | mira a un lado y al otro |

**Acción** (nuevo)

| Nombre | Qué hace |
|---|---|
| `sacudirse` | **NUEVO** · se sacude el agua como perro: vibra de cabeza a pies, con gotas |
| `casco` | **NUEVO** · se pone el casco con las dos manos, lo ajusta con golpecitos |
| `recoger` | **NUEVO** · se agacha a recoger algo del piso y se endereza contento |
| `izarse` | **NUEVO** · sube a pulso a un borde: flexiona los brazos, patea y se sube |

### Caras (`cara`)

| Nombre | Se ve |
|---|---|
| `normal` | sonrisa tranquila |
| `feliz` | ojos de arco y boca abierta |
| `susto` | ojos enormes, boca en O |
| `triste` | cejas caídas, lágrimas |
| `enojado` | cejas bravas |
| `concentrado` | ojos entornados, ceño |
| `dormido` | ojos cerrados |
| `mareado` | ojos que giran |
| `dolor` | ojos apretados, dientes |
| `guino` | un ojo cerrado, sonrisa ladeada |
| `burla` | lengua afuera |
| `sorpresa` | ojos muy abiertos, cejas arriba |
| `risa` | boca grande que ríe, ojos de arco |
| `llorando` | llanto con lágrimas cayendo |
| `cansado` | ojos pesados, boca jadeante |
| `aburrido` | párpados caídos, mira de lado |
| `pensando` | mira arriba, boca de lado |
| `orgulloso` | sonrisa ladeada, cejas altas |
| `esfuerzo` | dientes apretados, ojos apretados |
| `miedo` | ojos grandes, boca temblando |
| `asco` | mueca de asco |
| `sueno` | ojos casi cerrados |
| `picaro` | sonrisa traviesa, una ceja alta |
| `gritando` | grita con la boca enorme |
| `bostezo` | bostezo |

El parpadeo va solo. Los gestos y los golpes ponen su cara un rato y luego devuelven la del juego. La mirada puede cambiar las pupilas encima de cualquier cara.

### Efectos sobre la cabeza (`fx(nombre, on)`)

Se crean con el personaje (invisibles, cero mallas por cuadro). Se prenden solos con algunas animaciones y gestos; `pj.fx('gota', true)` los fuerza.

| Nombre | Qué es |
|---|---|
| `estrellas` | estrellitas girando (aturdido) |
| `gota` | gota de sudor |
| `zetas` | zetas que suben (dormir) |
| `interr` | signo de pregunta |
| `excl` | signo de exclamación |
| `bombilla` | bombillo de idea |
| `corazon` | **NUEVO** · corazón que late (beso, abrazo, corazón) |
| `notas` | **NUEVO** · notas musicales que suben (salsa, twist, robot) |

### El resto

- `rumbo(rad)`: gira el cuerpo, suave; si el giro es grande, la cabeza y el torso se adelantan.
- `mirar(x, y)` / `mirarA({x,y,z})`: ver la capa 4.
- `prop(true/false)`: muestra o esconde su objeto (cuelga de un pivote con resorte).
- `mano('der'|'izq')`: devuelve un `Object3D` para colgarle cosas.
- `color(hex|null)`: tiñe la camisa (mojado, equipo).
- `choques()` y `ajuste`: para depurar. `animacion`, `expresion`, `gesto` leen el estado.
- `J.raiz`: pivote del cuerpo entero (centro de masa) con el que se inclina y se tumba.

- **El elenco:** `tu`, `mama`, `abuela`, `tio`, `pana`, `prima`, `cobrador`, `portu`. El id llega en `asiento(p).ch`.
- **Cambiar o agregar un personaje: son datos, no código.** Edita su fila en `ELENCO`:
  - piel, camisa, `sh2`, pantalón, zapatos, `pelo`/`peloC`;
  - `cuerpo {ancho, panza, alto}`, `ropa {arriba, pat, cuello, falda, jean}`, `pierna`;
  - `adornos`, `labios`, `lentesC`/`lentesForma`, `prop`.

  Los adornos que ya existen están listados en el comentario de `ELENCO`. Un adorno nuevo se agrega en el bloque «detalles chicos».

  Los 16 personajes inactivos de `fiesta-personajes.js` ya tienen sus colores ahí, para pasarlos a 3D.
- **Nada atraviesa el cuerpo:** cada cuadro, el codo, el antebrazo, la mano y el objeto se prueban contra el torso y la cabeza. Si algo entra, se abre el hombro (y si no basta, se estira el codo) lo justo, con margen. Abre al instante y cierra despacio, sin oscilar. No pongas poses que crucen los antebrazos sobre el pecho: la prueba las atrapa.
- **Una animación nueva:**
  1. Agrégala en `ANIMS` (o `UNOS`; los gestos nuevos son fotogramas clave con `U(dur, [[u, {tecla: valor}]])`) y descríbela en `DESC` (grupo + una línea): de ahí salen el visor y los botones.
  2. Revísala en `personajes-3d.html` (botones por grupo, FÍSICA, MOVER, EFECTOS) o con `docs/style-lab/pruebas/personajes-3d-capturas.js` (hojas y tiras).
  3. Corre `node --test test/fiesta-3d-pj.test.js` (choques con el cuerpo, NaN, que `impacto` y `volar` se recuperen, cadencia sin patinar, mirada).

## 7. Lista de verificación de cada port

- [ ] `node test/fiesta-juego-<id>.test.js` y `node test/fiesta-live-<id>.test.js` pasan (lint, reglas, red), igual que antes.
- [ ] `node test/fiesta-3d-pj.test.js` pasa, si tocaste personajes.
- [ ] En la galería, se juega completo en los niveles 1, 2 y 3: el resultado vuelve (`mj-fin`) y la consola queda sin errores ni advertencias de WebGL.
- [ ] Con `?plano=1`, el 2D viejo sigue funcionando.
- [ ] Hay música propia y sonidos en cada evento.
- [ ] Los personajes nunca están quietos como bloques: corren, reaccionan, celebran y pierden con cara.
- [ ] Se entiende qué hacer en 3 segundos sin leer: el HUD y los avisos dicen la regla. Si no, el juego no está listo.
- [ ] El dueño lo juega y dice. No se hace el siguiente sin su visto bueno.

Juegos nuevos (no ports), como el toro (§8): siguen además los pasos de registro de `SIGUIENTES-JUEGOS.md` (`CATALOGO`, `sync-fiesta-rules.sh`, `LIM_DEFECTO`, `<script>` en `fiesta.html`, y las pruebas que fijan los conjuntos vivos).

---

## 8. Qué rehacer, de aburrido a bueno (en orden)

Fuentes:
- **Las notas del dueño** tras jugarlos: bombillo, tequeños, capicúa, patilla, bono y teleférico.
- **Una lectura del diseño** de cada juego para el resto. Los de «solo pulsar a tiempo» son los que más se sienten slides; los de moverse ganan casi todo con el 3D.

### Ya hecho
| id | Juego | Estado |
|---|---|---|
| `f_bombita` | ¡AGUA EN CARNAVAL! | 3D completo: plaza, personajes, explosión de agua, cámara que sigue, música carnaval, día/atardecer/noche. Aprobado. |
| `f_patilla` | ¡BOMBAS DESDE EL BALCÓN! (antes ¡LA PATILLA GIGANTE!) | Rehecho (27 oct): el solo apunta con una mira desde el balcón y lanza 9 bombas (1/2/3 por tiro según nivel); aro rojo + sombra de aviso, charcos que resbalan, A del trío = esquivar. Banco 43/41/46 %, partidas de ~23 s. Pista `balcon`, sfx `silbido`/`resbalon`. Puntaje y red iguales (id `f_patilla`). Falta el visto bueno del dueño. |

### Ola del 27 oct (22 juegos portados en paralelo, uno por agente)
Todos en `TRES_D` de la galería, con su pista (`V3.pista` desde el archivo del juego) y su 2D de respaldo (`?plano=1`). Probados en el navegador: cargan en 3D sin errores de consola.
- **Con cambio de jugabilidad** (notas del dueño): `f_bono` (sobre dorado + barra BONO + avisos), `f_guaya` (péndulo: el trío equilibra, el solo sacude a ritmo; perilla `EMPUJE`, banco 47/46/42,5 %), `f_tequeno` (tres sartenes, pedidos de la abuela, chispas, combos), `f_patilla` (bombas desde el balcón).
- **Solo dibujo**: abuela, alcabala, bolas, bombillo (la mecánica ya era «parpadea, se apaga, cae»), cava, cerro, chancla, chocones, cola, cotufas, cuerda, futbolito, hallacas, harina, mecate, mudanza, perro, silbón, vagón.
- **`f_toro` ¡TOROS COLEADOS!** (hecho el 27 oct, reemplaza a capicúa): FFA y BRONCA 1v1, modelo A, 30 s. Cada uno corre su manga: A al compás del galope (machacar hace tropezar), se pega a la cola (stick), A la agarra y el stick sigue al toro que se recuesta (▲/▼): COLEADA DE ORO 100 · REVOLCÓN 70 · MEDIA VUELTA 40 · SE LEVANTÓ 15, más hasta 20 por rapidez. Nv2 el toro zigzaguea, Nv3 además frena (baja la cabeza) y da CORNADA al que va pegado sin frenar. Los toros son los mismos para todos (salen de `c.rng`). Registro: `CATALOGO` (`lim` 700/40/27/0), `RELAMPAGO`, `LIM_DEFECTO` de `party_mj.js`, `DUELOS` y la lista ffa de Margarita, galería, `fiesta.html`. Pruebas: `test/fiesta-juego-toro.test.js`, `test/fiesta-live-toro.test.js`.
- **`f_domino` sigue registrado con `fuera:1`**: las pruebas de red lo usan de base, pero `elegir` (LA FIESTA y Margarita) ya no lo saca en las rondas.
- **Falta**: el visto bueno del dueño juego por juego. Escenas pesadas para revisar en teléfono: perro (~1900 mallas), vagón (~1700), mudanza (~1350), cerro (~1000).
- **Ojo para los siguientes**: en 3D hay que llamar a `drawP()` al final de `dibujar3D`, o los gritos de `say()` no salen.

### Prioridad 1: los que el dueño marcó (rehacer jugabilidad y 3D)
| # | id | Juego | Qué está mal (dueño) | Propuesta |
|---|---|---|---|---|
| 1 | `f_patilla` | ¡LA PATILLA GIGANTE! → **bombas de agua de carnaval** | Lento, la animación y el estilo son «meh». | Mismo 1v3. El solo, en un balcón de la plaza de bombita, lanza bombas de agua con sombra de aviso en el piso; el trío esquiva por la calle. **Más rápido:** menos espera entre tiros, ráfagas, y los charcos resbalan. Reutiliza la plaza, las bombitas, el splash y la pista carnaval. Es el más barato y el que más se nota. |
| 2 | `f_bono` | ¡SE LE CAE EL BONO! | No se entiende, y los personajes no tienen animaciones. | Que la regla se vea: el bono (un sobre dorado) flotando sobre el solo, una barra de «bono» que baja con cada periodicazo, y un aviso grande. Al trío, `uno('lanzar')` con el periódico; al solo, `golpe` y `caer` al recibir. Cámara cerca. Si con eso no se entiende, simplificar las reglas. |
| 3 | `f_guaya` | ¡LA GUAYA DEL TELEFÉRICO! | Aburrido: no hace nada, solo ves algo moviéndose mal. | Física de verdad. La cabina cuelga y oscila como un péndulo sobre el Ávila en 3D, con niebla y el valle abajo. El trío **equilibra** con el stick contra la oscilación. El solo **sacude** con ritmo para entrar en resonancia. Si se pasa el ángulo, alguien cae colgando. Algo que hacer en cada segundo. |
| 4 | `f_bombillo` | ¡SE VA LA LUZ! | Mejorar el escenario, la física y el estilo; se ve cutre o sin sentido. | Una casa a oscuras de verdad: los bombillos son plataformas en el piso que parpadean antes de apagarse (aviso claro). Al apagarse, la baldosa cae con física y el personaje `caer` al vacío. Luz real: cada bombillo es su propio punto de luz (es lo que el 3D hace mejor). |
| 5 | `f_tequeno` | ¡TEQUEÑOS! | Aburrido. | Más acción: una cocina con varios sartenes a la vez, pedidos que llegan, chispas de aceite que hay que esquivar, voltear en el momento justo, y combos. Hoy es «mantener y soltar»; tiene que ser manejar el caos. |
| 6 ✅ | `f_domino` → **nuevo `f_toro`** | ¡CAPICÚA! → **¡TOROS COLEADOS!** | No es divertido. El dueño pide reemplazarlo por algo tipo el toro de Mario Party. | Diseño **original**, no una copia: los toros coleados del llano venezolano. Carrera por la manga a caballo (pulsar para acelerar), A en el momento justo para agarrar la cola, y el stick para tumbar al toro: puntos por la vuelta que dé. CPU con habilidad, 3D con polvo y tierra. **Ojo:** `f_domino` también está en la BRONCA 1v1 (con `f_harina`, `f_mecate` y `f_abuela`). Al sacarlo, actualizar el `m:` del catálogo y darle al toro un formato 1v1. |

### Prioridad 2: «solo pulsar a tiempo» (los que más se sienten slides)
| id | Juego | Por qué | Propuesta corta |
|---|---|---|---|
| `f_abuela` | ¡LA ABUELA DICE! | El juego de las poses, y los personajes 3D ya tienen poses. | La abuela en 3D hace el gesto, y todos lo imitan con su personaje (`saludar`, `saltar`, `bailar`…). Ideal para lucir las animaciones. |
| `f_cola` | ¡LA COLA DE LA GASOLINA! | Pulsar y parar. | Cola de carros en 3D con el fiscal que voltea (luz roja/verde), bocinazos, y el carro que se cala si te pillan. |
| `f_mecate` | ¡SALTA EL MECATE! | Pulsar a tiempo. | Mecate en 3D con arco real y sombra en el piso para leer el tiempo, `saltar` del personaje, y caídas con `caer`. |
| `f_harina` | ¡LA ÚLTIMA HARINA! | Se mueve, pero el arte es plano. | Supermercado 3D con pasillos, la bolsa que brilla, robos con `golpe`, y la señora del carrito cruzando. |
| `f_perro` | ¡PERRO CALIENTE CON TODO! | Armar pedidos sin juice. | Carrito de perros en 3D: los ingredientes vuelan al pan, la salsa salpica, y el cliente reacciona. |

### Prioridad 3: de moverse (el 3D los mejora casi solo; portar el dibujo)
`f_chocones` (carritos chocones: física y chispas, el más agradecido), `f_chancla`, `f_cotufas`, `f_cerro`, `f_futbolito`, `f_cava`, `f_alcabala`, `f_silbon` (de noche con linterna: la luz 3D lo hace otro juego), `f_hallacas`, `f_cuerda`, `f_mudanza`, `f_bolas` (bolas que ruedan y chocan en 3D), `f_vagon`.

### Orden recomendado
1. `f_patilla` (barato: reutiliza bombita)
2. `f_bono`
3. `f_chocones` (victoria rápida)
4. `f_guaya`
5. `f_bombillo`
6. `f_tequeno`
7. `f_toro` (juego nuevo: registro completo)
8. `f_abuela`
9. el resto de la prioridad 2
10. la prioridad 3

Uno a la vez, con el visto bueno del dueño entre cada uno.

## 9. Pendiente del kit (no bloquea, mejora todos)

- Cada juego necesita su pista: hoy solo existe `carnaval` en `PISTAS`.
- Probar en teléfono: el rendimiento con sombras y contornos en un equipo de gama baja. Si hace falta, apagar el contorno o bajar `shadow.mapSize` según el dispositivo.
- El tablero de Margarita puede usar `V3.PJ` para las fichas de los jugadores más adelante.
