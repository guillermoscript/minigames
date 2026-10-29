# Elenco de panas — exploración de personajes

Objetivo: que cada jugador encuentre un «ese soy yo» o «esa es mi tía». Humor de costumbres, contradicciones y reacciones. Personajes originales inspirados en la comedia cotidiana y el melodrama venezolano. Las frases son propuestas originales, no citas de programas.

## Primera lámina

| Personaje | Silueta / accesorio | Contradicción divertida | Frase | Reacción al perder |
|---|---|---|---|---|
| La Sifrina | Lentes sobre el pelo, rosado, cafecito | Dice que no es competitiva y cuenta cada punto | «O sea, ¿eso sí vale?» | Se baja los lentes para revisar el resultado |
| El Maracucho | Camisa tropical, bigote, abanico | Todo lo suyo es más grande, hasta la mala suerte | «¡Vos sí tenéis suerte!» | Se abanica como si el tablero diera calor |
| El Llanero | Sombrero ancho, pañuelo, cuatro | Tranquilo hasta que le tocan una ficha | «Todavía queda sabana.» | Se acomoda el sombrero y mira de reojo |
| La Chismosa | Rulos, bata, teléfono | No quiere problemas, pero tiene toda la información | «Yo no dije nada… todavía.» | Se acerca al teléfono para contarlo |
| La Mamá | Moño, turquesa, ceja levantada | Organiza hasta la partida donde es invitada | «Cuando termines, recoges.» | Mira al jugador sin pestañear |
| La Alternativa | Mechón lila, lentes redondos, plantita | Habla de soltar, pero no suelta el primer lugar | «Esta partida tiene una energía…» | Abraza su planta y respira profundo |
| El Resuelve | Camisa de trabajo, lápiz, cinta aislante | Siempre tiene una solución, casi nunca la original | «Eso tiene arreglo.» | Saca un cable que no conecta con nada |
| La Novelera | Pelo voluminoso, pendientes, pañuelo | Una casilla perdida es una traición familiar | «¡Y yo que confié en ti!» | Pañuelo al pecho y mirada al horizonte |
| El Mototaxista | Casco azul, chaqueta roja | Conoce un atajo incluso dentro de una casa | «Por aquí salimos.» | Levanta la visera, incrédulo |
| La Tía del Audio | Lentes, pañuelo, teléfono | Dice «rapidito» antes de hablar cinco minutos | «Te lo resumo en un audio.» | Empieza a grabar una explicación |
| El Gaitero | Bigote canoso, camisa vino, furro | Convierte cualquier fecha en diciembre | «¡Eso se celebra!» | Redoble triste y recuperación inmediata |
| La Emprendedora | Trenzas, delantal, caja de pedidos | Entra a jugar y termina ofreciendo un combo | «Te tengo una promoción.» | Calcula la pérdida en su libretica |

## Segunda tanda

| Personaje | Idea visual y personalidad | Frase original |
|---|---|---|
| El Galán de Quinta | Camisa abierta, peinado impecable, rosa; seduce hasta al dado | «Esa victoria te la dedico.» |
| La Villana de Urbanización | Traje violeta, joya enorme, sonrisa mínima; llama estrategia a toda maldad | «Ay, ¿esa ficha era tuya?» |
| La Reina del Condominio | Carpeta, lentes con cadena; exige acta de cada jugada | «Eso va para el grupo.» |
| El Tío de la Parrilla | Delantal, pinzas, bigote; nunca acepta que algo se quemó | «Eso es el sabor.» |
| La Prima Recién Llegada | Maletica, lentes de viaje; compara todo, pero extrañaba jugar con sus panas | «Allá esto es distinto… reparte.» |
| El Pana Fitness | Franela sin mangas, termo; convierte tirar dados en ejercicio | «Una más y descansamos.» |
| La Estudiante de Diseño | Pelo recogido con lápiz, ojeras, carpeta; quiere corregir el tablero | «Ese amarillo está peleando.» |
| El Técnico | Linterna, destornillador, lentes; diagnostica la suerte como falla eléctrica | «Apágalo y vuelve a tirar.» |
| El Guachimán | Gorra, llavero gigante, termo; sabe quién llegó y quién hizo trampa | «Yo vi ese movimiento.» |
| La Reina del Karaoke | Micrófono brillante, flequillo; responde todo cantando | «Esta va dedicada.» |
| El Coleccionista de Promos | Riñonera y tarjetas; guarda cada objeto por si acaso | «No lo gastes todavía.» |
| El Panita de la Playa | Sombrero, lentes, cava pequeña; siempre está de vacaciones mentalmente | «Relájate, que falta tarde.» |

## Dirección visual para el selector actual

- Cabeza cuadrada de esquinas suaves, ojos y boca grandes, busto corto.
- Una silueta, un color dominante y un accesorio protagonista por avatar.
- Misma escala de ojos y misma perspectiva; sombreros y peinados distinguen incluso en silueta.
- Probar primero a 48 y 96 píxeles: si un accesorio no se entiende, simplificarlo.
- Boceto de contacto primero; después sprites individuales transparentes, redibujados sobre una cuadrícula común. La lámina generada no es un spritesheet listo para producción.
- Estados sugeridos: normal, listo, victoria, derrota y sorpresa. Animaciones cortas de 2–4 cuadros, con opción de reducir movimiento.
- Mantener las capacidades de juego iguales en la primera versión: el humor vive en frases y animaciones, para que elegir personalidad no penalice al jugador.
- Tonos de piel variados en todas las personalidades. «El Negro» puede ser un apodo personal configurable, con carácter y vestuario propios en vez de ser toda la definición del personaje.
- No sustituir el elenco existente: La Abuela, El Portu, El Cobrador y los demás pueden compartir esta misma guía visual.

Generación: herramienta integrada image_gen. Prompt completo en prompt.txt. Estos son conceptos originales; no se han integrado al selector del juego.
