// DATOS del tablero «VENEZUELA ENTERA» (borrador v0.1, exportado de docs/mario-party/05).
// Lienzo de diseño 1000x1000, Norte arriba. Se escala al mundo en el dibujo (M1).
// nodos[id] = {n:nombre, r:región, t:tipo, x, y, star?, premium?, tienda?}; ady[id] = salidas permitidas (grafo dirigido).
// rutas = salidas opcionales con modo/costo/req (teleférico, ferry, avioneta, peaje...).
(function(root){
var F=root.FIESTA=root.FIESTA||{};
F.MAPAS=F.MAPAS||{};
F.MAPAS.venezuela={
"meta": {
"version": "0.1-borrador",
"lienzo": [
1000,
1000
],
"ejes": "x oeste->este, y norte->sur; coordenadas de diseno, no cartograficas",
"salida": "ccs_start",
"grafo": "dirigido: 'ady' son las salidas permitidas; las aristas con costo/req son opcionales"
},
"regiones": [
{
"id": "ccs",
"nombre": "Caracas (hub)",
"color": "#E8B400",
"centro": [
515,
190
]
},
{
"id": "coc",
"nombre": "Centro-Occidente",
"color": "#7FB800",
"centro": [
350,
200
]
},
{
"id": "zul",
"nombre": "Zulia y Lago de Maracaibo",
"color": "#00A6A6",
"centro": [
150,
250
]
},
{
"id": "and",
"nombre": "Los Andes",
"color": "#6C8EBF",
"centro": [
200,
380
]
},
{
"id": "lla",
"nombre": "Llanos y Apure",
"color": "#C9A227",
"centro": [
360,
420
]
},
{
"id": "gua",
"nombre": "Guayana",
"color": "#B5651D",
"centro": [
720,
420
]
},
{
"id": "can",
"nombre": "Canaima y Gran Sabana",
"color": "#2E8B57",
"centro": [
840,
640
]
},
{
"id": "del",
"nombre": "Deltamacura",
"color": "#8A4FFF",
"centro": [
905,
310
]
},
{
"id": "moc",
"nombre": "Oriente y Mochima",
"color": "#FF7F50",
"centro": [
770,
215
]
},
{
"id": "mar",
"nombre": "Margarita",
"color": "#FF4F81",
"centro": [
780,
105
]
},
{
"id": "roq",
"nombre": "Los Roques",
"color": "#00BFFF",
"centro": [
590,
62
]
}
],
"nodos": {
"ccs_start": {
"n": "Plaza Bolívar (SALIDA)",
"r": "ccs",
"t": "salida",
"x": 520,
"y": 200
},
"ccs_sabana": {
"n": "Bulevar de Sabana Grande",
"r": "ccs",
"t": "banco",
"x": 500,
"y": 215
},
"ccs_parquecentral": {
"n": "Torres de Parque Central",
"r": "ccs",
"t": "azul",
"x": 485,
"y": 205,
"star": true
},
"ccs_metro": {
"n": "Metro de Caracas",
"r": "ccs",
"t": "transporte",
"x": 470,
"y": 215
},
"ccs_arana": {
"n": "Distribuidor La Araña",
"r": "ccs",
"t": "roja",
"x": 450,
"y": 205
},
"ccs_guaira": {
"n": "La Guaira",
"r": "ccs",
"t": "azul",
"x": 480,
"y": 150
},
"ccs_maiquetia": {
"n": "Aeropuerto de Maiquetía",
"r": "ccs",
"t": "transporte",
"x": 465,
"y": 130
},
"ccs_petare": {
"n": "Redoma de Petare",
"r": "ccs",
"t": "roja",
"x": 585,
"y": 215
},
"ccs_chacao": {
"n": "Chacao",
"r": "ccs",
"t": "azul",
"x": 565,
"y": 212
},
"ccs_altamira": {
"n": "Plaza Altamira",
"r": "ccs",
"t": "azul",
"x": 555,
"y": 198,
"tienda": "bodegon"
},
"ccs_avila": {
"n": "Teleférico Warairarepano",
"r": "ccs",
"t": "transporte",
"x": 545,
"y": 182
},
"ccs_galipan": {
"n": "Galipán (fresas con crema)",
"r": "ccs",
"t": "evento",
"x": 530,
"y": 155,
"star": true
},
"coc_tejerias": {
"n": "Las Tejerías (la cola de la ARC)",
"r": "coc",
"t": "roja",
"x": 420,
"y": 215
},
"coc_maracay": {
"n": "Maracay, Ciudad Jardín",
"r": "coc",
"t": "azul",
"x": 400,
"y": 228
},
"coc_choroni": {
"n": "Curvas del Pittier",
"r": "coc",
"t": "evento",
"x": 395,
"y": 170
},
"coc_puertocolombia": {
"n": "Puerto Colombia (Choroní)",
"r": "coc",
"t": "azul",
"x": 385,
"y": 145,
"star": true
},
"coc_valencia": {
"n": "Valencia",
"r": "coc",
"t": "azul",
"x": 365,
"y": 240,
"tienda": "farmacia"
},
"coc_puertocabello": {
"n": "Puerto Cabello",
"r": "coc",
"t": "azul",
"x": 355,
"y": 195
},
"coc_morrocoy": {
"n": "Cayo Sombrero (Morrocoy)",
"r": "coc",
"t": "especial",
"x": 325,
"y": 165,
"star": true
},
"coc_coro": {
"n": "Médanos de Coro",
"r": "coc",
"t": "especial",
"x": 265,
"y": 125
},
"coc_sanfelipe": {
"n": "San Felipe",
"r": "coc",
"t": "vaina",
"x": 335,
"y": 255
},
"coc_barquisimeto": {
"n": "Barquisimeto, Capital Musical",
"r": "coc",
"t": "duelo",
"x": 300,
"y": 265
},
"zul_dabajuro": {
"n": "Carretera de Dabajuro",
"r": "zul",
"t": "roja",
"x": 215,
"y": 148
},
"zul_altagracia": {
"n": "Los Puertos de Altagracia",
"r": "zul",
"t": "azul",
"x": 165,
"y": 170
},
"zul_puente": {
"n": "Puente sobre el Lago",
"r": "zul",
"t": "alcabala",
"x": 140,
"y": 190
},
"zul_maracaibo": {
"n": "Maracaibo",
"r": "zul",
"t": "azul",
"x": 115,
"y": 195,
"star": true,
"tienda": "bodega_lago"
},
"zul_gaita": {
"n": "Feria de la Gaita",
"r": "zul",
"t": "evento",
"x": 100,
"y": 220
},
"zul_sanfrancisco": {
"n": "San Francisco (40 °C a la sombra)",
"r": "zul",
"t": "roja",
"x": 110,
"y": 245
},
"zul_machiques": {
"n": "Machiques (queso y ganado)",
"r": "zul",
"t": "azul",
"x": 80,
"y": 285
},
"zul_catatumbo": {
"n": "Relámpago del Catatumbo",
"r": "zul",
"t": "especial",
"x": 95,
"y": 325,
"star": true
},
"zul_encontrados": {
"n": "Encontrados",
"r": "zul",
"t": "azul",
"x": 135,
"y": 345
},
"zul_cabimas": {
"n": "Cabimas (los balancines)",
"r": "zul",
"t": "azul",
"x": 185,
"y": 215
},
"zul_ojeda": {
"n": "Ciudad Ojeda: Pozo en el Lago",
"r": "zul",
"t": "especial",
"x": 195,
"y": 248
},
"zul_lagunillas": {
"n": "Lagunillas",
"r": "zul",
"t": "villano",
"x": 200,
"y": 282
},
"and_carora": {
"n": "Carora (cocuy y uvas)",
"r": "and",
"t": "azul",
"x": 285,
"y": 268
},
"and_valera": {
"n": "Valera",
"r": "and",
"t": "azul",
"x": 245,
"y": 300
},
"and_timotes": {
"n": "Timotes",
"r": "and",
"t": "roja",
"x": 232,
"y": 325
},
"and_aguila": {
"n": "Pico El Águila",
"r": "and",
"t": "especial",
"x": 220,
"y": 345
},
"and_mucuchies": {
"n": "Mucuchíes",
"r": "and",
"t": "azul",
"x": 207,
"y": 362
},
"and_merida": {
"n": "Mérida",
"r": "and",
"t": "azul",
"x": 185,
"y": 380,
"tienda": "heladeria"
},
"and_picoespejo": {
"n": "Pico Espejo (Mukumbarí)",
"r": "and",
"t": "especial",
"x": 205,
"y": 410,
"star": true
},
"and_losnevados": {
"n": "Los Nevados",
"r": "and",
"t": "azul",
"x": 230,
"y": 430
},
"and_ejido": {
"n": "Ejido",
"r": "and",
"t": "duelo",
"x": 165,
"y": 405
},
"and_sancristobal": {
"n": "San Cristóbal (Feria de San Sebastián)",
"r": "and",
"t": "evento",
"x": 120,
"y": 440
},
"and_sanantonio": {
"n": "San Antonio (Casa de Cambio)",
"r": "and",
"t": "alcabala",
"x": 95,
"y": 468
},
"and_elvigia": {
"n": "El Vigía",
"r": "and",
"t": "azul",
"x": 150,
"y": 360
},
"lla_acarigua": {
"n": "Acarigua (el granero)",
"r": "lla",
"t": "azul",
"x": 330,
"y": 320
},
"lla_guanare": {
"n": "Guanare",
"r": "lla",
"t": "ahorita",
"x": 300,
"y": 355
},
"lla_barinas": {
"n": "Barinas",
"r": "lla",
"t": "villano",
"x": 265,
"y": 400
},
"lla_hato": {
"n": "Hato El Cariño (coleo)",
"r": "lla",
"t": "especial",
"x": 300,
"y": 445
},
"lla_guasdualito": {
"n": "Guasdualito",
"r": "lla",
"t": "azul",
"x": 190,
"y": 505
},
"lla_mantecal": {
"n": "Mantecal (la crecida)",
"r": "lla",
"t": "especial",
"x": 320,
"y": 490
},
"lla_achaguas": {
"n": "Achaguas (chigüires)",
"r": "lla",
"t": "azul",
"x": 380,
"y": 490,
"star": true
},
"lla_sanfernando": {
"n": "San Fernando de Apure",
"r": "lla",
"t": "azul",
"x": 430,
"y": 470,
"tienda": "bodega_llanera"
},
"lla_sanjuan": {
"n": "San Juan de los Morros",
"r": "lla",
"t": "azul",
"x": 445,
"y": 300
},
"lla_calabozo": {
"n": "Calabozo (las anguilas)",
"r": "lla",
"t": "evento",
"x": 455,
"y": 370
},
"lla_pascua": {
"n": "Valle de la Pascua",
"r": "lla",
"t": "duelo",
"x": 525,
"y": 370
},
"gua_eltigre": {
"n": "El Tigre: Pozo de la Faja",
"r": "gua",
"t": "especial",
"x": 610,
"y": 335
},
"gua_angostura": {
"n": "Puente Angostura",
"r": "gua",
"t": "azul",
"x": 670,
"y": 385
},
"gua_caicara": {
"n": "Caicara del Orinoco",
"r": "gua",
"t": "azul",
"x": 565,
"y": 430
},
"gua_cbolivar": {
"n": "Ciudad Bolívar",
"r": "gua",
"t": "azul",
"x": 690,
"y": 410,
"tienda": "mercado_orinoco"
},
"gua_autopista": {
"n": "Autopista Cdad. Bolívar–Pto. Ordaz",
"r": "gua",
"t": "roja",
"x": 740,
"y": 400
},
"gua_guri": {
"n": "Represa de Guri",
"r": "gua",
"t": "especial",
"x": 720,
"y": 470
},
"gua_llovizna": {
"n": "Parque La Llovizna",
"r": "gua",
"t": "azul",
"x": 770,
"y": 435,
"star": true
},
"gua_pordaz": {
"n": "Puerto Ordaz (Caroní + Orinoco)",
"r": "gua",
"t": "banco",
"x": 790,
"y": 395
},
"gua_sanfelix": {
"n": "San Félix",
"r": "gua",
"t": "vaina",
"x": 820,
"y": 380
},
"gua_upata": {
"n": "Upata",
"r": "gua",
"t": "villano",
"x": 805,
"y": 460
},
"gua_elcallao": {
"n": "El Callao (calipso)",
"r": "gua",
"t": "evento",
"x": 840,
"y": 510
},
"can_km88": {
"n": "Km 88 (La Escalera)",
"r": "can",
"t": "roja",
"x": 860,
"y": 560
},
"can_jaspe": {
"n": "Quebrada de Jaspe",
"r": "can",
"t": "azul",
"x": 880,
"y": 610
},
"can_kama": {
"n": "Salto Kamá",
"r": "can",
"t": "azul",
"x": 890,
"y": 655
},
"can_santaelena": {
"n": "Santa Elena de Uairén",
"r": "can",
"t": "azul",
"x": 905,
"y": 720,
"tienda": "bodega_frontera"
},
"can_roraima": {
"n": "Roraima: El Mundo Perdido",
"r": "can",
"t": "especial",
"x": 950,
"y": 700,
"star": true
},
"can_sabana": {
"n": "Sabana de los Tepuyes",
"r": "can",
"t": "evento",
"x": 850,
"y": 700
},
"can_kavac": {
"n": "Cueva de Kavac",
"r": "can",
"t": "ahorita",
"x": 790,
"y": 665
},
"can_saltoangel": {
"n": "Cañón del Caroní",
"r": "can",
"t": "especial",
"x": 735,
"y": 630,
"premium": true
},
"can_laguna": {
"n": "Laguna de Canaima",
"r": "can",
"t": "transporte",
"x": 730,
"y": 580
},
"can_carrao": {
"n": "Curiara por el Carrao",
"r": "can",
"t": "evento",
"x": 700,
"y": 540
},
"del_entrada": {
"n": "El Puente que Ayer No Estaba",
"r": "del",
"t": "delta",
"x": 850,
"y": 345
},
"del_gps": {
"n": "«Recalculando…»",
"r": "del",
"t": "delta",
"x": 880,
"y": 325
},
"del_niebla": {
"n": "Neblina de los Caños",
"r": "del",
"t": "delta",
"x": 910,
"y": 350
},
"del_reloj": {
"n": "Caño Donde Es Ayer",
"r": "del",
"t": "delta",
"x": 875,
"y": 295
},
"del_espejo": {
"n": "Caño Espejo",
"r": "del",
"t": "delta",
"x": 935,
"y": 325
},
"del_isla": {
"n": "La Isla que Aparece",
"r": "del",
"t": "especial",
"x": 960,
"y": 295,
"star": true
},
"del_mercado": {
"n": "Mercadito Paralelo",
"r": "del",
"t": "delta",
"x": 925,
"y": 280,
"tienda": "mercadito"
},
"del_penero": {
"n": "Peñero Fantasma",
"r": "del",
"t": "transporte",
"x": 895,
"y": 265
},
"del_salida": {
"n": "¿Salida?",
"r": "del",
"t": "delta",
"x": 860,
"y": 270
},
"moc_maturin": {
"n": "Maturín",
"r": "moc",
"t": "azul",
"x": 820,
"y": 300
},
"moc_caripe": {
"n": "Cueva del Guácharo",
"r": "moc",
"t": "evento",
"x": 835,
"y": 250
},
"moc_carupano": {
"n": "Carúpano (Carnaval)",
"r": "moc",
"t": "azul",
"x": 865,
"y": 205
},
"moc_paria": {
"n": "Península de Paria (cacao)",
"r": "moc",
"t": "azul",
"x": 920,
"y": 190,
"star": true
},
"moc_cumana": {
"n": "Cumaná, la Primogénita",
"r": "moc",
"t": "azul",
"x": 780,
"y": 195
},
"moc_mochima": {
"n": "Mochima: Playa Blanca",
"r": "moc",
"t": "especial",
"x": 745,
"y": 180,
"star": true
},
"moc_plc": {
"n": "Puerto La Cruz (Paseo Colón)",
"r": "moc",
"t": "banco",
"x": 710,
"y": 195
},
"moc_barcelona": {
"n": "Barcelona",
"r": "moc",
"t": "roja",
"x": 690,
"y": 215
},
"moc_uchire": {
"n": "Boca de Uchire",
"r": "moc",
"t": "villano",
"x": 655,
"y": 210
},
"moc_higuerote": {
"n": "Higuerote (Barlovento)",
"r": "moc",
"t": "evento",
"x": 628,
"y": 218
},
"moc_guarenas": {
"n": "Cola Guarenas–Guatire",
"r": "moc",
"t": "roja",
"x": 605,
"y": 222
},
"mar_puntapiedras": {
"n": "Punta de Piedras (ferry)",
"r": "mar",
"t": "transporte",
"x": 765,
"y": 120
},
"mar_restinga": {
"n": "Laguna de La Restinga",
"r": "mar",
"t": "evento",
"x": 745,
"y": 100
},
"mar_macanao": {
"n": "Península de Macanao",
"r": "mar",
"t": "azul",
"x": 715,
"y": 95
},
"mar_juangriego": {
"n": "Juan Griego (el atardecer)",
"r": "mar",
"t": "azul",
"x": 778,
"y": 78
},
"mar_elagua": {
"n": "Playa El Agua",
"r": "mar",
"t": "azul",
"x": 818,
"y": 75,
"star": true
},
"mar_asuncion": {
"n": "La Asunción",
"r": "mar",
"t": "duelo",
"x": 808,
"y": 100
},
"mar_pampatar": {
"n": "Castillo de Pampatar",
"r": "mar",
"t": "evento",
"x": 828,
"y": 122
},
"mar_porlamar": {
"n": "Porlamar (Zona Libre)",
"r": "mar",
"t": "azul",
"x": 805,
"y": 132,
"tienda": "zona_libre"
},
"mar_coche": {
"n": "Isla de Coche",
"r": "mar",
"t": "azul",
"x": 790,
"y": 155
},
"roq_pista": {
"n": "Gran Roque (la pista)",
"r": "roq",
"t": "transporte",
"x": 560,
"y": 62
},
"roq_faro": {
"n": "Faro Holandés",
"r": "roq",
"t": "azul",
"x": 575,
"y": 48
},
"roq_francisqui": {
"n": "Cayo Francisquí",
"r": "roq",
"t": "azul",
"x": 600,
"y": 52
},
"roq_cayoagua": {
"n": "Cayo de Agua",
"r": "roq",
"t": "azul",
"x": 625,
"y": 40,
"star": true
},
"roq_crasqui": {
"n": "Crasquí (langosta carísima)",
"r": "roq",
"t": "roja",
"x": 612,
"y": 75
},
"roq_madrisqui": {
"n": "Madrisquí",
"r": "roq",
"t": "evento",
"x": 585,
"y": 82
},
"roq_noronqui": {
"n": "Noronquí: Spa del Caribe",
"r": "roq",
"t": "especial",
"x": 555,
"y": 85
}
},
"ady": {
"ccs_start": [
"ccs_sabana"
],
"ccs_sabana": [
"ccs_parquecentral"
],
"ccs_parquecentral": [
"ccs_metro"
],
"ccs_metro": [
"ccs_arana"
],
"ccs_arana": [
"coc_tejerias",
"ccs_guaira"
],
"ccs_guaira": [
"ccs_maiquetia"
],
"ccs_maiquetia": [
"ccs_arana",
"roq_pista",
"mar_porlamar",
"can_laguna",
"zul_maracaibo"
],
"ccs_petare": [
"ccs_chacao"
],
"ccs_chacao": [
"ccs_altamira"
],
"ccs_altamira": [
"ccs_avila"
],
"ccs_avila": [
"ccs_start",
"ccs_galipan"
],
"ccs_galipan": [
"ccs_guaira"
],
"coc_tejerias": [
"coc_maracay"
],
"coc_maracay": [
"coc_valencia",
"coc_choroni",
"lla_sanjuan"
],
"coc_choroni": [
"coc_puertocolombia"
],
"coc_puertocolombia": [
"coc_maracay",
"coc_morrocoy"
],
"coc_valencia": [
"coc_puertocabello",
"coc_barquisimeto",
"coc_sanfelipe"
],
"coc_puertocabello": [
"coc_morrocoy"
],
"coc_morrocoy": [
"coc_coro"
],
"coc_coro": [
"zul_dabajuro"
],
"coc_sanfelipe": [
"coc_barquisimeto"
],
"coc_barquisimeto": [
"and_carora",
"lla_acarigua"
],
"zul_dabajuro": [
"zul_altagracia"
],
"zul_altagracia": [
"zul_puente",
"zul_cabimas"
],
"zul_puente": [
"zul_maracaibo"
],
"zul_maracaibo": [
"zul_gaita",
"ccs_maiquetia"
],
"zul_gaita": [
"zul_sanfrancisco"
],
"zul_sanfrancisco": [
"zul_machiques"
],
"zul_machiques": [
"zul_catatumbo"
],
"zul_catatumbo": [
"zul_encontrados"
],
"zul_encontrados": [
"and_elvigia"
],
"zul_cabimas": [
"zul_ojeda"
],
"zul_ojeda": [
"zul_lagunillas"
],
"zul_lagunillas": [
"and_valera"
],
"and_carora": [
"and_valera"
],
"and_valera": [
"and_timotes"
],
"and_timotes": [
"and_aguila"
],
"and_aguila": [
"and_mucuchies",
"lla_barinas"
],
"and_mucuchies": [
"and_merida"
],
"and_merida": [
"and_ejido",
"and_picoespejo"
],
"and_picoespejo": [
"and_losnevados"
],
"and_losnevados": [
"lla_barinas"
],
"and_ejido": [
"and_sancristobal"
],
"and_sancristobal": [
"and_sanantonio"
],
"and_sanantonio": [
"lla_guasdualito"
],
"and_elvigia": [
"and_merida"
],
"lla_acarigua": [
"lla_guanare"
],
"lla_guanare": [
"lla_barinas"
],
"lla_barinas": [
"lla_hato"
],
"lla_hato": [
"lla_mantecal",
"lla_sanfernando"
],
"lla_guasdualito": [
"lla_mantecal"
],
"lla_mantecal": [
"lla_achaguas"
],
"lla_achaguas": [
"lla_sanfernando"
],
"lla_sanfernando": [
"lla_calabozo",
"gua_caicara"
],
"lla_sanjuan": [
"lla_calabozo"
],
"lla_calabozo": [
"lla_pascua"
],
"lla_pascua": [
"gua_eltigre"
],
"gua_eltigre": [
"gua_angostura"
],
"gua_angostura": [
"gua_cbolivar"
],
"gua_caicara": [
"gua_cbolivar"
],
"gua_cbolivar": [
"gua_autopista",
"gua_guri",
"can_laguna"
],
"gua_autopista": [
"gua_pordaz"
],
"gua_guri": [
"gua_llovizna"
],
"gua_llovizna": [
"gua_pordaz"
],
"gua_pordaz": [
"gua_sanfelix",
"gua_upata"
],
"gua_sanfelix": [
"del_entrada"
],
"gua_upata": [
"gua_elcallao"
],
"gua_elcallao": [
"can_km88"
],
"can_km88": [
"can_jaspe"
],
"can_jaspe": [
"can_kama"
],
"can_kama": [
"can_santaelena"
],
"can_santaelena": [
"can_roraima"
],
"can_roraima": [
"can_sabana"
],
"can_sabana": [
"can_kavac"
],
"can_kavac": [
"can_saltoangel"
],
"can_saltoangel": [
"can_laguna",
"gua_guri"
],
"can_laguna": [
"can_carrao",
"ccs_maiquetia"
],
"can_carrao": [
"gua_guri"
],
"del_entrada": [
"del_gps"
],
"del_gps": [
"del_niebla",
"del_reloj"
],
"del_niebla": [
"del_espejo"
],
"del_reloj": [
"del_mercado"
],
"del_espejo": [
"del_isla",
"del_mercado"
],
"del_isla": [
"del_mercado"
],
"del_mercado": [
"del_penero"
],
"del_penero": [
"del_salida"
],
"del_salida": [
"moc_maturin"
],
"moc_maturin": [
"moc_caripe"
],
"moc_caripe": [
"moc_carupano"
],
"moc_carupano": [
"moc_paria",
"moc_cumana"
],
"moc_paria": [
"moc_cumana"
],
"moc_cumana": [
"moc_mochima",
"mar_puntapiedras"
],
"moc_mochima": [
"moc_plc"
],
"moc_plc": [
"moc_barcelona",
"mar_puntapiedras"
],
"moc_barcelona": [
"moc_uchire",
"gua_eltigre"
],
"moc_uchire": [
"moc_higuerote"
],
"moc_higuerote": [
"moc_guarenas"
],
"moc_guarenas": [
"ccs_petare"
],
"mar_puntapiedras": [
"mar_restinga",
"moc_plc",
"moc_cumana"
],
"mar_restinga": [
"mar_macanao"
],
"mar_macanao": [
"mar_juangriego"
],
"mar_juangriego": [
"mar_elagua"
],
"mar_elagua": [
"mar_asuncion"
],
"mar_asuncion": [
"mar_pampatar"
],
"mar_pampatar": [
"mar_porlamar"
],
"mar_porlamar": [
"mar_coche",
"mar_puntapiedras",
"ccs_maiquetia"
],
"mar_coche": [
"mar_puntapiedras"
],
"roq_pista": [
"roq_faro",
"ccs_maiquetia"
],
"roq_faro": [
"roq_francisqui"
],
"roq_francisqui": [
"roq_cayoagua"
],
"roq_cayoagua": [
"roq_crasqui"
],
"roq_crasqui": [
"roq_madrisqui"
],
"roq_madrisqui": [
"roq_noronqui"
],
"roq_noronqui": [
"roq_pista"
]
},
"rutas": [
{
"de": "ccs_avila",
"a": "ccs_galipan",
"modo": "teleferico",
"costo": 5
},
{
"de": "ccs_maiquetia",
"a": "roq_pista",
"modo": "avioneta",
"costo": 10
},
{
"de": "ccs_maiquetia",
"a": "mar_porlamar",
"modo": "avion",
"costo": 8
},
{
"de": "ccs_maiquetia",
"a": "can_laguna",
"modo": "avioneta",
"costo": 15
},
{
"de": "ccs_maiquetia",
"a": "zul_maracaibo",
"modo": "avion",
"costo": 10
},
{
"de": "coc_maracay",
"a": "lla_sanjuan",
"modo": "camionetica",
"costo": 3
},
{
"de": "coc_puertocolombia",
"a": "coc_morrocoy",
"modo": "lancha",
"costo": 3
},
{
"de": "coc_valencia",
"a": "coc_barquisimeto",
"modo": "porton",
"req": "llave"
},
{
"de": "zul_puente",
"a": "zul_maracaibo",
"modo": "peaje",
"costo": "1+"
},
{
"de": "zul_maracaibo",
"a": "ccs_maiquetia",
"modo": "avion",
"costo": 10
},
{
"de": "and_aguila",
"a": "lla_barinas",
"modo": "salto",
"req": "paracaidas"
},
{
"de": "and_merida",
"a": "and_picoespejo",
"modo": "teleferico",
"costo": 8
},
{
"de": "lla_hato",
"a": "lla_sanfernando",
"modo": "porton",
"req": "llave"
},
{
"de": "lla_sanfernando",
"a": "gua_caicara",
"modo": "chalana",
"costo": 4
},
{
"de": "gua_cbolivar",
"a": "can_laguna",
"modo": "avioneta",
"costo": 8
},
{
"de": "can_saltoangel",
"a": "gua_guri",
"modo": "salto",
"req": "paracaidas"
},
{
"de": "can_laguna",
"a": "ccs_maiquetia",
"modo": "avioneta",
"costo": 10
},
{
"de": "can_carrao",
"a": "gua_guri",
"modo": "curiara"
},
{
"de": "del_espejo",
"a": "del_isla",
"modo": "camino",
"req": "isla_visible"
},
{
"de": "moc_cumana",
"a": "mar_puntapiedras",
"modo": "ferry",
"costo": 4
},
{
"de": "moc_plc",
"a": "mar_puntapiedras",
"modo": "ferry",
"costo": 5
},
{
"de": "mar_puntapiedras",
"a": "moc_plc",
"modo": "ferry",
"costo": 5
},
{
"de": "mar_puntapiedras",
"a": "moc_cumana",
"modo": "ferry",
"costo": 4
},
{
"de": "mar_porlamar",
"a": "ccs_maiquetia",
"modo": "avion",
"costo": 8
},
{
"de": "mar_coche",
"a": "mar_puntapiedras",
"modo": "penero"
},
{
"de": "roq_pista",
"a": "ccs_maiquetia",
"modo": "avioneta",
"costo": 10
}
]
};
F.MAPAS.venezuela.id='venezuela';
F.MAPAS.venezuela.inicio='ccs_start';
if(typeof module!=='undefined')module.exports=F.MAPAS.venezuela;
})(typeof window!=='undefined'?window:globalThis);
