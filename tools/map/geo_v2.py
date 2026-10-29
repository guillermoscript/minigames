"""Geography of the v2 board map (real lon/lat, simplified) + magnification bubbles + node anchors.
All coordinates here are (lon, lat) unless noted. Project with proj(); warp() magnifies the zones that carry many tiles."""
import math

U = 215.0                         # base units per degree (bigger board: more room between tiles)
SC = U / 130.0
LON0, LAT0 = -73.4, 12.5          # top-left of the canvas

COAST = [  # clockwise from Castilletes
    (-71.33, 11.85), (-71.50, 11.60), (-71.60, 11.25), (-71.62, 10.95), (-71.55, 10.78), (-71.30, 10.98), (-71.10, 11.20), (-70.85, 11.40),
    (-70.62, 11.42), (-70.45, 11.55), (-70.28, 11.85), (-70.20, 12.10), (-70.00, 12.22), (-69.80, 12.10), (-69.70, 11.85), (-69.78, 11.58),
    (-69.60, 11.43), (-69.20, 11.48), (-68.80, 11.45), (-68.35, 11.05), (-68.15, 10.68), (-68.00, 10.50), (-67.60, 10.50), (-67.20, 10.55),
    (-66.95, 10.62), (-66.50, 10.60), (-66.20, 10.57), (-65.80, 10.30), (-65.40, 10.15), (-65.00, 10.20), (-64.60, 10.20), (-64.30, 10.38),
    (-64.00, 10.55), (-63.60, 10.67), (-63.25, 10.67), (-62.60, 10.68), (-62.00, 10.75), (-61.90, 10.70), (-62.30, 10.55), (-62.65, 10.25),
    (-62.75, 9.95), (-62.40, 9.80), (-61.9, 9.45), (-61.5, 9.05), (-61.0, 8.72), (-60.7, 8.5), (-61.0, 8.0), (-60.75, 7.3), (-60.65, 6.5),
    (-60.75, 5.6), (-60.74, 5.2), (-61.15, 4.7), (-61.35, 4.2), (-62.2, 3.85), (-63.0, 3.8), (-63.9, 4.2), (-64.5, 3.8), (-64.0, 2.8),
    (-64.4, 2.2), (-65.0, 1.4), (-66.0, 0.75), (-66.9, 1.4), (-67.3, 2.1), (-67.1, 3.0), (-67.8, 3.6), (-67.8, 4.4), (-67.7, 5.4),
    (-67.5, 6.2), (-68.5, 6.2), (-69.4, 6.1), (-70.2, 6.9), (-71.0, 7.0), (-72.0, 7.1), (-72.4, 7.4), (-72.2, 7.9), (-72.2, 8.6),
    (-72.6, 9.0), (-73.25, 9.7), (-73.25, 10.5), (-72.8, 11.15), (-72.1, 11.55),
]
LAKE = [(-71.60, 10.78), (-71.45, 10.78), (-71.38, 10.60), (-71.40, 10.40), (-71.25, 10.15), (-71.12, 9.90), (-71.18, 9.60), (-71.35, 9.30),
        (-71.55, 9.05), (-71.75, 9.10), (-71.85, 9.50), (-71.8, 9.8), (-71.75, 10.2), (-71.68, 10.45), (-71.62, 10.65)]
CANAL = [(-71.62, 10.70), (-71.46, 10.70), (-71.40, 11.08), (-71.64, 11.08)]
ISLANDS = [  # lon, lat, rx_deg, ry_deg, name
    (-63.78, 11.04, 0.30, 0.10, 'margarita_e'), (-64.32, 11.03, 0.17, 0.10, 'macanao'), (-63.95, 10.78, 0.10, 0.04, 'coche'),
    (-64.17, 10.83, 0.06, 0.03, 'cubagua'), (-65.30, 10.95, 0.16, 0.04, 'tortuga'), (-64.6, 11.85, 0.07, 0.03, 'blanquilla'),
    (-63.1, 11.4, 0.05, 0.03, 'testigos'), (-66.25, 11.8, 0.07, 0.03, 'orchila'),
]
RIVERS = {  # lon, lat waypoints, source -> mouth
    'orinoco': [(-63.35, 2.35), (-64.4, 2.9), (-65.55, 3.2), (-66.5, 3.6), (-67.7, 4.05), (-67.65, 5.0), (-67.6, 5.66), (-67.45, 6.2), (-66.6, 6.6),
                (-66.17, 7.63), (-65.2, 8.0), (-64.1, 8.2), (-63.55, 8.13), (-62.73, 8.3), (-62.2, 8.5), (-61.5, 8.6), (-60.9, 8.55)],
    'caroni': [(-62.54, 5.9), (-62.9, 6.3), (-62.99, 7.0), (-62.99, 7.77), (-62.85, 8.1), (-62.73, 8.3)],
    'apure': [(-72.0, 7.5), (-71.2, 7.35), (-70.73, 7.24), (-69.9, 7.5), (-68.8, 7.8), (-67.47, 7.89), (-66.7, 7.7), (-66.35, 7.55)],
    'caura': [(-64.6, 5.5), (-64.7, 6.5), (-64.8, 7.3), (-64.9, 7.65)],
    'meta_arauca': [(-69.4, 6.1), (-68.5, 6.25), (-67.8, 6.3), (-67.45, 6.2)],
    'guarico': [(-67.4, 9.8), (-67.45, 9.0), (-67.1, 8.4), (-66.6, 7.9), (-66.35, 7.6)],
    'portuguesa': [(-69.7, 9.3), (-69.0, 8.7), (-68.2, 8.2), (-67.5, 7.9)],
    'catatumbo': [(-72.4, 8.9), (-72.0, 9.0), (-71.7, 9.05)],
    'unare': [(-65.7, 9.0), (-65.4, 9.5), (-65.2, 9.9)],
}
BUBBLES = [  # lon, lat, magnification, sigma(units)
    (-66.88, 10.50, 2.7, 50), (-63.9, 11.0, 2.6, 55), (-64.4, 10.3, 2.1, 55), (-66.75, 11.85, 2.2, 35), (-67.8, 10.25, 1.9, 55),
    (-71.6, 10.55, 1.9, 55), (-71.1, 8.6, 1.9, 60), (-69.7, 11.45, 1.9, 40), (-63.1, 8.2, 1.9, 55), (-61.6, 9.1, 1.7, 55),
    (-62.5, 6.0, 1.6, 60), (-68.3, 10.9, 1.7, 35), (-68.4, 8.0, 1.25, 140), (-69.6, 9.3, 1.4, 70), (-71.7, 9.4, 1.4, 60),
]


def base(lon, lat):
    return ((lon - LON0) * U, (LAT0 - lat) * U)


def warp_pt(x, y):
    for (lo, la, m, s) in BUBBLES:
        cx, cy = base(lo, la)
        dx, dy = x - cx, y - cy
        d2 = dx * dx + dy * dy
        s = s * SC
        k = 1.0 + (m - 1.0) * math.exp(-d2 / (2 * s * s))
        x, y = cx + dx * k, cy + dy * k
    return x, y


def proj(lon, lat):
    return warp_pt(*base(lon, lat))


def poly(pts, step=0.04):
    """Densify then project (so the warp bends long coast segments smoothly)."""
    out = []
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        k = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / step))
        for s in range(k):
            t = s / k
            out.append(proj(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def line(pts, step=0.04):
    out = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        k = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / step))
        for s in range(k):
            t = s / k
            out.append(proj(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    out.append(proj(*pts[-1]))
    return out


def smooth(pts, passes=3):
    """Chaikin corner cutting for closed polygons."""
    for _ in range(passes):
        out = []
        n = len(pts)
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            out.append((a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25))
            out.append((a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75))
        pts = out
    return pts


def smooth_line(pts, passes=3):
    for _ in range(passes):
        out = [pts[0]]
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            out.append((a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25))
            out.append((a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75))
        out.append(pts[-1])
        pts = out
    return pts


# anchors (lat, lon) of the 114 board nodes; fictional ones get a zone anchor
A = {
 'ccs_start': (10.506, -66.914), 'ccs_sabana': (10.496, -66.935), 'ccs_parquecentral': (10.492, -66.955), 'ccs_metro': (10.488, -66.975), 'ccs_arana': (10.485, -66.995),
 'ccs_guaira': (10.60, -66.98), 'ccs_maiquetia': (10.60, -67.03), 'ccs_petare': (10.47, -66.79), 'ccs_chacao': (10.485, -66.83), 'ccs_altamira': (10.50, -66.86),
 'ccs_avila': (10.535, -66.885), 'ccs_galipan': (10.575, -66.90),
 'coc_tejerias': (10.24, -67.17), 'coc_maracay': (10.25, -67.60), 'coc_choroni': (10.40, -67.68), 'coc_puertocolombia': (10.49, -67.61), 'coc_valencia': (10.18, -68.0),
 'coc_puertocabello': (10.47, -68.01), 'coc_morrocoy': (10.88, -68.22), 'coc_coro': (11.45, -69.68), 'coc_sanfelipe': (10.34, -68.74), 'coc_barquisimeto': (10.07, -69.32),
 'zul_dabajuro': (11.02, -70.66), 'zul_altagracia': (10.72, -71.46), 'zul_puente': (10.70, -71.55), 'zul_maracaibo': (10.66, -71.70), 'zul_gaita': (10.58, -71.72),
 'zul_sanfrancisco': (10.50, -71.74), 'zul_machiques': (10.06, -72.55), 'zul_catatumbo': (9.05, -71.85), 'zul_encontrados': (9.05, -72.3), 'zul_cabimas': (10.4, -71.43),
 'zul_ojeda': (10.2, -71.3), 'zul_lagunillas': (10.1, -71.26),
 'and_carora': (10.18, -70.08), 'and_valera': (9.32, -70.6), 'and_timotes': (9.0, -70.74), 'and_aguila': (8.9, -70.8), 'and_mucuchies': (8.75, -70.9),
 'and_merida': (8.6, -71.15), 'and_picoespejo': (8.54, -71.05), 'and_losnevados': (8.57, -70.97), 'and_ejido': (8.55, -71.24), 'and_sancristobal': (7.77, -72.22),
 'and_sanantonio': (7.82, -72.4), 'and_elvigia': (8.62, -71.65),
 'lla_acarigua': (9.55, -69.2), 'lla_guanare': (9.04, -69.75), 'lla_barinas': (8.62, -70.2), 'lla_hato': (8.1, -68.9), 'lla_guasdualito': (7.24, -70.73),
 'lla_mantecal': (7.57, -69.13), 'lla_achaguas': (7.77, -68.23), 'lla_sanfernando': (7.89, -67.47), 'lla_sanjuan': (9.9, -67.35), 'lla_calabozo': (8.93, -67.43),
 'lla_pascua': (9.2, -66.0),
 'gua_eltigre': (8.9, -64.25), 'gua_angostura': (8.15, -63.55), 'gua_caicara': (7.63, -66.17), 'gua_cbolivar': (8.13, -63.5), 'gua_autopista': (8.22, -63.0),
 'gua_guri': (7.77, -62.99), 'gua_llovizna': (8.31, -62.7), 'gua_pordaz': (8.3, -62.73), 'gua_sanfelix': (8.35, -62.6), 'gua_upata': (8.0, -62.4), 'gua_elcallao': (7.35, -61.83),
 'can_km88': (6.35, -61.3), 'can_jaspe': (5.5, -61.1), 'can_kama': (5.15, -61.1), 'can_santaelena': (4.6, -61.1), 'can_roraima': (5.14, -60.9),
 'can_sabana': (5.4, -61.5), 'can_kavac': (5.9, -62.4), 'can_saltoangel': (5.97, -62.54), 'can_laguna': (6.24, -62.85), 'can_carrao': (6.5, -62.7),
 'del_entrada': (9.15, -62.3), 'del_gps': (9.3, -62.0), 'del_niebla': (9.0, -61.75), 'del_reloj': (9.35, -61.6), 'del_espejo': (9.1, -61.45), 'del_isla': (9.0, -61.2),
 'del_mercado': (9.25, -61.35), 'del_penero': (9.4, -61.8), 'del_salida': (9.5, -62.1),
 'moc_maturin': (9.75, -63.18), 'moc_caripe': (10.17, -63.5), 'moc_carupano': (10.67, -63.25), 'moc_paria': (10.7, -62.4), 'moc_cumana': (10.46, -64.17),
 'moc_mochima': (10.35, -64.33), 'moc_plc': (10.22, -64.63), 'moc_barcelona': (10.13, -64.7), 'moc_uchire': (10.12, -65.5), 'moc_higuerote': (10.48, -66.1), 'moc_guarenas': (10.47, -66.54),
 'mar_puntapiedras': (10.9, -63.9), 'mar_restinga': (11.0, -64.1), 'mar_macanao': (11.0, -64.35), 'mar_juangriego': (11.08, -63.97), 'mar_elagua': (11.15, -63.8),
 'mar_asuncion': (11.03, -63.86), 'mar_pampatar': (10.99, -63.8), 'mar_porlamar': (10.96, -63.85), 'mar_coche': (10.78, -63.95),
 'roq_pista': (11.95, -66.67), 'roq_faro': (12.0, -66.8), 'roq_francisqui': (11.9, -66.6), 'roq_cayoagua': (11.8, -66.6), 'roq_crasqui': (11.78, -66.7),
 'roq_madrisqui': (11.85, -66.9), 'roq_noronqui': (11.95, -66.9),
}
CAY = {'roq_pista', 'roq_faro', 'roq_francisqui', 'roq_cayoagua', 'roq_crasqui', 'roq_madrisqui', 'roq_noronqui', 'coc_morrocoy', 'mar_coche'}
