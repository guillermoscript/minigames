# Venezuela board prototype

The map is original editable SVG geometry rendered by mapa-tablero.js on a 1000 × 1000 design canvas. No generated raster artwork is used in the board. The previous images are retained in mapa-referencias.html.

Geography is intentionally approximate. The silhouette emphasizes the Gulf of Venezuela, Lake Maracaibo, Paraguaná, the northern coast, Paria, the broad Guayana interior and the southern Amazonas extension. This is game art, not a boundary or navigation reference.

Solid routes follow simplified city sequences along the central and western highways, Falcón–Zulia, Trasandina, the Llanos corridor, the center–Apure corridor, Troncal 9, the Oriente–Guayana corridor and Troncal 10. Straight segments represent corridors, not exact road alignments. Several intermediate towns and junctions are omitted for readability.

Dashed connections are distinct: ferry to Margarita, air access to Los Roques and Canaima, and a fictional game river connection toward Puerto Ayacucho. They do not imply road access or scheduled transport services. Southern jungle is deliberately not covered with invented highways.

References consulted:
- https://commons.wikimedia.org/wiki/File:Vías_troncales_de_Venezuela.webp
- https://es.wikipedia.org/wiki/Carreteras_de_Venezuela
- https://es.wikipedia.org/wiki/Troncal_9
- https://bibliofep.fundacionempresaspolar.org/media/16836/geo_u1_l48_centro_norte_costero_sist_ciudades.pdf

Implementation: independent visual/navigation prototype. Does not replace or modify fiesta-mapa-venezuela.js or the existing game rules. City positions and routes are editable in mapa-tablero.js. Clicking a city explores it; the player's marker remains in Caracas. Connecting this view to turn state and validating final gameplay routes is a separate integration step.
