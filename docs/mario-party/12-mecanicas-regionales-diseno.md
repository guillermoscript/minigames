# 12 · Mecánicas por región y objetos que faltan (diseño para aprobar)

Estado (2026-10-25): `fiesta-reglas.js` resuelve las 28 casillas `evento`/`especial` con la tabla genérica `EVENTOS` (billete, cola, regalo, fresas, propina, relámpago). Catatumbo, Mochima, Galipán, el Salto Ángel, etc. juegan igual. Este doc baja a reglas ejecutables lo que ya dicen `05` §4, §6, §7, §9.3 y §10, con los números ajustados para que la economía medida (apéndice A del 05) no se mueva más de ±10 %.

Nada de esto está programado todavía.

## 0. Principios

1. **Cada región se siente distinta en una frase.** Si no cabe en una frase, se recorta.
2. **Valor esperado cercano a una casilla azul (+4)**, con más varianza o más decisión. Lo que sube el valor, cuesta algo (monedas, dado limitado, riesgo).
3. **Decisión > azar.** Donde el 05 da una tirada pura, se añade una elección cuando se pueda sin un aviso nuevo en la UI.
4. **Ataques con tope**: nadie pierde más de 20 monedas por ataques ajenos en una ronda (05 §10).
5. **Tono**: caricatura geográfica, sin ofender; Deltamacura sigue sin tocar a pueblos reales.

## 1. Cambios de motor (una vez, sirven a todo)

| Pieza | Qué es | Por qué |
|---|---|---|
| Aviso `ELIGE` | Nuevo `esp.k` con `opc:[{id,txt,costo?}]` y respuesta `{t:'ELIGE', id}`; plazo 12 s; por defecto = la opción segura | Galipán, Morrocoy, Mochima, Catatumbo, Guri, Noronquí, Nido, Dato del Vecino. Un solo aviso genérico en lugar de uno por casilla |
| Estados del jugador `p.st` nuevos | `lim5` (próxima tirada 1-5), `lim3` (1-3), `oscuro` (cruces al azar), `bonus2` (+2 a la próxima tirada) | Reutiliza el patrón de `senal` en `tirar()` |
| Estados del tablero `tab` nuevos | `crecida` (rondas restantes), `neblina`, `pozos{nodo:dueño}`, `nidos[]`, `planta{s:nodo}`, `guriRonda` | Crecida/Neblina/Guri/Pozos |
| Tope de ataques | `tab.danoRonda{s}` que se reinicia en `iniRonda`; los ataques cobran `min(daño, 20 - ya recibido)` | 05 §10 |
| Fx nuevos | `estado` (para animar banners: crecida/neblina/luz) y `colea` | Que el director anime; los demás usan `mon`/`hop` ya existentes |
| CPU | `fiesta-cpu.js` aprende a contestar `ELIGE` con una función de utilidad por opción | Sin esto la CPU se queda en el plazo |

## 2. Eventos regionales (28 casillas)

Leyenda: **A** = se resuelve sola (cero UI nueva), **E** = usa `ELIGE`, **S** = crea/usa un estado global.

### Caracas
| Casilla | Regla (v1 implementable) | Tipo | EV |
|---|---|---|---|
| `ccs_galipan` ★ | «Fresas con crema»: eliges +4 monedas **o** 1 objeto aleatorio de la venta con descuento (te lo regalan si cabe) | E | ≈ +4 |
| Metro (`ccs_metro`, `transporte`) | Hora pico: tira 1d6; con 1 vas a una casilla `ccs_*` al azar en vez de elegir | A | pasaje −2 se mantiene |

### Centro-Occidente
| `coc_choroni` | «¡Cuántas curvas!» 1d6: 1-2 mareo (`lim5` siguiente turno), 3-6 +3 | A | ≈ +1,6 (riesgo de dado) |
| `coc_morrocoy` ★ | «Alquila la lancha»: pagas 3 y saltas a Puerto Colombia, Puerto Cabello o Coro **o** día de playa +2 | E | ≈ +2 y atajo |
| `coc_coro` | «Sandboard»: avanzas 1d4 casillas más sin resolver especiales de destino | A | movimiento |

### Zulia
| `zul_gaita` | «¡Gaitazo!»: todos +2, quien cae +5 (total +7 para él) | A | +7 / +2 resto |
| `zul_catatumbo` ★ | «Dirige el rayo»: pagas 5 y eliges un jugador **en cualquier parte**: −8 monedas (van al banco más cercano) **o** `lim5`. Sin pagar: rayo al azar 50 % +5 / 50 % −5. Recibo lo bloquea | E | ataque a distancia |
| `zul_ojeda` | **Pozo A**: 15 si no tiene dueño, 25 para quitárselo (el dueño recibe 15). Dueño cobra 5 cuando otro cae. En Apagón no paga | E+S | inversión |

### Andes
| `and_aguila` | «Te pegó el páramo»: `lim5` salvo que tengas Arepa, Malta o Guayoyo (se consume al usarlo). Tiene salto con Paracaídas a Barinas (ya existe la ruta) | S | −dado |
| `and_picoespejo` ★ | «Selfie a 4.765 m»: +4; cerrado con Neblina andina (ver abajo) | A | +4 |
| `and_sancristobal` | «La Feria»: ruleta de 3: +6 / objeto al azar / −3 | A | ≈ +3 y objeto |
| `and_sanantonio` (alcabala) | Paso obligado: pagas 3 **o** juegas «Cambio»: 1d6 → 1 pierdes 30 %, 2-3 igual, 4-5 +20 %, 6 +50 % (tope +15) | E | ≈ +0,6 |

### Llanos
| `lla_hato` | «¡Colea el toro!»: v1 = 1d6 (4-6 gana +8, 1-3 revolcón 0); v2 = microjuego de 5 s (queda para el catálogo) | A | ≈ +4 |
| `lla_mantecal` | Indicador de la Crecida; en Crecida «pescaste un coporo» +4, si no +1 | S | — |
| `lla_calabozo` | «Anguila eléctrica» 1d6: 1-3 corrientazo (pierdes 1 objeto al azar, o −3 si no tienes), 4-6 `bonus2` | A | ≈ +0 con riesgo |
| **La Crecida** | Rondas 4, 8, 12…: 2 rondas. Mantecal, Achaguas y Guasdualito cuestan 2 pasos. Chigüire taxi en Achaguas (pagas 2, avanzas 3 sin costo de agua) | S | ritmo |

### Guayana
| `gua_eltigre` | **Pozo B** (igual que A) | E+S | inversión |
| `gua_guri` | **Interruptor**: al pasar o caer pagas 10 para cambiar Luz↔Apagón (máx. 1 cambio por ronda). Al caer sin pagar: +3 | E | control global |
| `gua_elcallao` | «Comparsa de calipso»: quien esté a ≤ 6 pasos avanza 2 hacia ti; tú +2 por cada uno que se une (máx. +6) | A | ≈ +2 |

### Canaima
| `can_roraima` ★ | «¿Eso fue un dinosaurio?» 1d6: 1 retrocedes 3, 2-5 +4, 6 objeto al azar | A | ≈ +3,5 |
| `can_sabana` | Activa la **Neblina** 2 rondas (en `can_*` el dado es 1d6; Malta/Guayoyo/Medida la saltan); quien cae +3 | S | — |
| `can_saltoangel` | **Estrella premium**: 1 por jugador y partida a 35 monedas (no mueve la Abuela). Salto con Paracaídas a Guri (ya existe la ruta) | E | objetivo |
| `can_carrao` | «Rápidos»: avanzas 1d4 más, siempre por el río | A | movimiento |

### Deltamacura
| `del_isla` ★ | «Tesoro del peñero»: eliges +10 o 1 objeto a elegir de la venta | E | ≈ +10 (es estrella candidata y solo en rondas pares) |

### Oriente y Margarita y Roques
| `moc_caripe` | «A oscuras»: `oscuro` hasta tu próximo turno (en cada cruce la ruta es al azar, salvo Vela) + 3 | S | ≈ +3 |
| `moc_mochima` ★ | Eliges: **+8 pero `lim3`** o **peñero a las islas**: pagas 2 y pescas 1d6×2 | E | ≈ +6/+5 |
| `moc_higuerote` | «Tambores»: v1 1d6: 4-6 +6, 1-3 +1 | A | ≈ +3,5 |
| `mar_restinga` | «Manglares»: avanzas 1d4 más | A | movimiento |
| `mar_pampatar` | «¡Cañonazo!»: eliges a un jugador en Margarita u Oriente: retrocede 4. Si no hay candidatos: +2 | E | ataque |
| `roq_madrisqui` | «Snorkel» 1d6: 1-2 erizo −2, 3-5 +4, 6 objeto Dato del Vecino | A | ≈ +2 |
| `roq_noronqui` | «Servicio VIP»: pagas 20 y la Abuela muda **una** estrella a Cayo de Agua. Una vez por jugador, no en la Recta Final | E | control |

Las casillas `evento` que **no** están en esta lista (si hubiera alguna sin regla propia) siguen con la tabla genérica.

## 3. Objetos que faltan

| Objeto | Precio | Efecto v1 | Contraataque |
|---|---|---|---|
| **Nido de Zancudos** | 7 | Eliges una casilla a ≤ 3 pasos (delante o detrás). Primero que **pase o caiga** (no tú) pierde 5, que van a ti. Máx. 2 nidos tuyos | Recibo; saltarlo con Paracaídas |
| **Vela** | 3 | Pasivo: 1 turno de inmunidad a `oscuro` y Apagón; rechazas el Peñero Fantasma; ves el GPS | — |
| **Pasaje de Por Puesto** | 8 | Antes de tirar: te teletransportas a una casilla `transporte` continental; luego tiras normal | — |
| **Ticket de Avioneta** | 18 | Desde cualquier casilla vuelas a cualquier aeropuerto (3 pasos) | — |
| **Planta Eléctrica** | 15 | Se coloca en tu casilla; ella y las 2 vecinas tienen luz en Apagón; quien cae te paga 3. 1 por jugador | — |
| **Dato del Vecino** (ampliar) | 12 | Hoy solo muda la estrella; se añade la opción **(b)** ver en secreto las 2 próximas candidatas | — |

Reglas de mapa que también faltan:
- **Colearse**: al **pasar** (sin caer) por un jugador en una casilla roja le quitas 2; máx. 1 coleada por turno.
- **Tope de 20** de daño ajeno por ronda por jugador (§1).
- **Camionetica** (NPC): se difiere a la fase 3 (cambia mucho la animación).
- **Don Corte caminante** en el Apagón: se difiere a la fase 3.

## 4. Fases de entrega

| Fase | Contenido | Pruebas |
|---|---|---|
| **R1** | Aviso `ELIGE` + estados `lim5/lim3/oscuro/bonus2` + tope de 20 + eventos **A** (sin UI nueva) + CPU básica | Unit en `fiesta-reglas.test.js` por casilla con RNG sembrado; `fiesta-sim` sigue verde (invariantes, proyectar == S); sim de balance |
| **R2** | Eventos **E** (Galipán, Morrocoy, Mochima, Catatumbo, Pampatar, Guri, Noronquí, Isla, Saltoángel, San Antonio) + UI del aviso en `fiesta-ui.js` | Test de UI + e2e de un turno con elección; CPU con utilidades |
| **R3** | Objetos nuevos (Nido, Vela, Pasaje, Ticket, Planta), Colearse, Pozos, Crecida, Neblina, `oscuro` completo | Unit por objeto; sim de balance completo |
| **R4** | Camionetica, Don Corte caminante, microjuegos Hato/Higuerote | Diferido |

Meta de balance al terminar R3 (mismas métricas de 05 A.2, 10 000 partidas): estrellas por partida 8-14; ganador 3-6 estrellas; monedas medias finales 10-40; turnos sin decisión < 35 % (hoy 11 %, debe bajar a < 8 %); duración simulada no más de +2 min; Pana vs 3 Chamo 40-55 %; 4 × azar ≈ 25 % por asiento.

## 5. Decisiones que necesito de ti

1. ¿**Hato (coleo) y Higuerote (tambores)** como 1d6 en v1 y minijuego después? (Recomendado: sí.)
2. ¿**Pozos** (Ojeda y El Tigre) entran en R2 o esperan a R3 con los demás estados? (Recomendado: R3, necesitan estado persistente y UI de propiedad.)
3. ¿**Salto Ángel premium** a 35 monedas una vez por jugador? Es una segunda forma de ganar estrellas; con 20 monedas iniciales y pagos 14/9/5/2 puede acelerar el final. (Recomendado: sí, pero medir en el sim y, si el ganador pasa de 6 estrellas, subir a 40.)
4. ¿El **Catatumbo** puede apuntar a **cualquiera** (mi recomendación, el dueño de la partida decide) o solo a quien va ganando? Cualquiera da más drama pero castiga al líder en grupo.
5. ¿Empiezo por **R1 + R2** juntas (lo que se nota desde la primera partida) o solo R1 para revisar el balance antes de tocar la UI?
