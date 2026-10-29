"""Southern Bolívar / Amazonas hero patches, shared by terrain_v2.py and place_v2.py (design-canvas coordinates).
Families (all share the lowered Guayana floor GS.GR so they stitch seamlessly with the Gran Sabana patches):
  orn0/orn/orn2 : Orinoco bend with Apure wetlands (wide brown river, sandbars, esteros, hacienda) + rocky hills on the east bank
  sab/sab2      : Sur de Bolívar - the Roraima massif with its thin high falls, savanna, Pemón hamlets, a river with cascades
  ama           : Bolívar-Amazonas - savanna turning into jungle, a meandering Orinoco with rapids, big granite domes, a river village"""
import math, os, json
import gsb_data as GS

HERE = os.path.dirname(os.path.abspath(__file__))
_L = json.load(open(os.path.join(HERE, '..', '..', 'assets', 'map', 'v2', 'layout.json')))

# patch rectangles (x0, y0, x1, y1), all multiples of the 7-unit export cell
RECTS = {
    'can': (2198, 959, 2674, 1500), 'can2': (1960, 1120, 2198, 1500),
    'orn0': (1001, 1141, 1260, 1470), 'orn': (1260, 1141, 1645, 1701), 'orn2': (1645, 1120, 1960, 1701),
    'sab': (1960, 1500, 2793, 1701), 'sab2': (2100, 1701, 2793, 1890),
    'ama': (1260, 1701, 2100, 2310), 'ama2': (1260, 2310, 2100, 2541), 'apw': (301, 1134, 1001, 1470),
    'per': (91, 238, 301, 959),          # Sierra de Perijá (west of Zulia); not part of the Guayana family
}
NEW = ['orn0', 'orn', 'orn2', 'sab', 'sab2', 'ama', 'ama2', 'apw']
FAMILY = ['can', 'can2'] + NEW


def pool(t, alpha):
    """plunge-pool centre under the fall of tepui t at wall direction alpha (matches terrain_v2 / place_v2)"""
    (px, py), (nx, ny) = GS.face(t, alpha)
    s = (t['T'] + GS.GR - GS.SEA) / 40.0
    return px + nx * 3.2 * s, py + ny * 3.2 * s


# ── tepuis / domes / mesas (same dict format as GS.TEPUIS) ──
SAB_MASSIF = dict(c=(2590, 1625), a=118, b=70, th=.22, T=108, falls=[1.5, 2.2], chan=[None, None])
SAB_TEPUIS = [
    SAB_MASSIF,
    dict(c=(2150, 1588), a=72, b=40, th=.1, T=68, falls=[1.7], chan=[None]),
    dict(c=(2330, 1560), a=26, b=22, th=.5, T=34, falls=[], chan=[]),
    dict(c=(2225, 1795), a=34, b=26, th=.3, T=30, falls=[], chan=[]),
    dict(c=(2570, 1800), a=30, b=24, th=-.4, T=28, falls=[], chan=[]),
]
ORN_MESAS = [
    dict(c=(1775, 1325), a=62, b=40, th=.4, T=24, falls=[], chan=[]),
    dict(c=(1860, 1465), a=48, b=34, th=-.3, T=19, falls=[], chan=[]),
    dict(c=(1720, 1585), a=46, b=30, th=.2, T=17, falls=[], chan=[]),
    dict(c=(1870, 1200), a=40, b=30, th=.6, T=15, falls=[], chan=[]),
]
AMA_DOMES = [      # granite bells: smooth peaked domes, grey rock with forest on the flanks
    dict(c=(1500, 1808), a=66, b=54, th=.3, T=100, bell=1, falls=[], chan=[]),
    dict(c=(1700, 1850), a=44, b=36, th=-.2, T=52, bell=1, falls=[], chan=[]),
    dict(c=(1890, 1930), a=48, b=40, th=.5, T=64, bell=1, falls=[], chan=[]),
    dict(c=(1995, 1790), a=34, b=28, th=0., T=44, bell=1, falls=[], chan=[]),
    dict(c=(1775, 2212), a=40, b=44, th=.4, T=60, bell=1, falls=[], chan=[]),
    dict(c=(1575, 2150), a=30, b=34, th=-.5, T=44, bell=1, falls=[], chan=[]),
    dict(c=(1905, 2215), a=30, b=34, th=.2, T=46, bell=1, falls=[], chan=[]),
    dict(c=(1380, 2000), a=34, b=40, th=.1, T=48, bell=1, falls=[], chan=[]),
    dict(c=(1640, 2400), a=38, b=42, th=.3, T=58, bell=1, falls=[], chan=[]),
    dict(c=(1470, 2330), a=30, b=34, th=-.3, T=48, bell=1, falls=[], chan=[]),
    dict(c=(1720, 2478), a=26, b=28, th=.2, T=42, bell=1, falls=[], chan=[]),
    dict(c=(1960, 2060), a=28, b=26, th=0., T=40, bell=1, falls=[], chan=[]),
]
SUR_TEPUIS = SAB_TEPUIS + ORN_MESAS + AMA_DOMES
ALL_TEPUIS = GS.TEPUIS + SUR_TEPUIS


# ── rivers ──
def _run(pred):
    return [tuple(p) for p in _L['rivers']['orinoco'] if pred(p)]


ORINOCO = _run(lambda p: 1190 < p[0] < 2260 and 1050 < p[1] < 2300)          # one run from the north of the Orinoco bend down to the Amazonas coast


def meander(pts, amp, wl, y0, y1):
    """perpendicular sine offset along a polyline, ramped in between y0..y1 (no change north of y0)"""
    out = []
    acc = 0.0
    for i, (x, y) in enumerate(pts):
        if i:
            acc += math.hypot(x - pts[i - 1][0], y - pts[i - 1][1])
        j0, j1 = max(i - 1, 0), min(i + 1, len(pts) - 1)
        tx, ty = pts[j1][0] - pts[j0][0], pts[j1][1] - pts[j0][1]
        n = math.hypot(tx, ty) or 1
        k = min(1, max(0, (y - y0) / (y1 - y0)))
        k = k * k * (3 - 2 * k)
        o = amp * k * (math.sin(acc / wl * 6.2832) + .45 * math.sin(acc / wl * 15.7 + 1.3))
        out.append((x - ty / n * o, y + tx / n * o))
    return out


def thin(pts, step):
    out = [pts[0]]
    for p in pts[1:]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) >= step:
            out.append(p)
    return out


ORINOCO_M = thin(meander(thin(ORINOCO, 10), 56, 270, 1760, 1900), 8)


def orn_hw(Y):
    """Orinoco half-width as a function of the northing (numpy-friendly): broad at the Apure confluence, narrower toward Amazonas"""
    t = (Y - 1450.0) / 400.0
    t = t * 0 + (t < 0) * 0 + ((t >= 0) & (t <= 1)) * t * t * (3 - 2 * t) + (t > 1) * 1.0
    return 50.0 - 19.0 * t


SAB_RIVER = None


def _sab_river():
    p0 = pool(SAB_MASSIF, 1.5)
    return [p0, (p0[0] - 12, p0[1] + 28), (2545, 1752), (2492, 1768), (2430, 1786), (2380, 1812), (2352, 1850), (2362, 1895), (2390, 1932)]


SAB_RIVER = _sab_river()
SAB_RIVER2 = [pool(SAB_MASSIF, 2.2), (2515, 1745), (2490, 1766)]     # second fall joins the main stream

# ── sandbars: (cx, cy, rx, ry, th, top-above-sea) elongated along the river ──


def _at(pts, f):
    n = len(pts) - 1
    i = min(int(f * n), n - 1)
    u = f * n - i
    x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u
    y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u
    return x, y, math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0])


def _bars(pts, specs):
    out = []
    for f, off, rx, ry, top in specs:
        x, y, a = _at(pts, f)
        out.append((x - math.sin(a) * off, y + math.cos(a) * off, rx, ry, a, top))
    return out


ORN_N = [p for p in ORINOCO_M if p[1] < 1780]
ORN_N = ORN_N[::-1] if ORN_N and ORN_N[0][1] < ORN_N[-1][1] else ORN_N       # north -> south
BARS = _bars(ORN_N, [(.10, 6, 54, 14, 2.5), (.22, -14, 70, 17, 2.8), (.36, 10, 62, 14, 2.5), (.50, -8, 46, 12, 2.3), (.63, 14, 72, 16, 2.7),
                     (.76, -10, 56, 13, 2.4), (.88, 8, 48, 12, 2.3)])
AMA_RUN = [p for p in ORINOCO_M if p[1] > 1740]
AMA_RUN = AMA_RUN[::-1] if AMA_RUN and AMA_RUN[0][1] > AMA_RUN[-1][1] else AMA_RUN       # west -> east
BARS += _bars(AMA_RUN, [(.06, 4, 30, 9, 2.3), (.17, -8, 38, 10, 2.5), (.29, 6, 34, 9, 2.3), (.43, -6, 40, 10, 2.5), (.56, 8, 32, 9, 2.3), (.70, -5, 36, 9, 2.4), (.84, 5, 30, 8, 2.3)])

# ── Apure wetlands (esteros): (cx, cy, rx, ry, th) + the narrow channels joining them ──
PONDS = [(1075, 1205, 34, 15, .25), (1150, 1250, 40, 17, -.3), (1255, 1218, 30, 13, .6), (1325, 1268, 34, 15, .1), (1112, 1322, 44, 19, .4),
         (1218, 1352, 34, 16, -.5), (1288, 1402, 36, 15, .3), (1095, 1428, 30, 14, -.2), (1195, 1440, 34, 15, .5), (1380, 1190, 26, 12, .2)]
ESTERO_CH = [[(1075, 1205), (1112, 1228), (1150, 1250), (1205, 1236), (1255, 1218), (1300, 1242), (1325, 1268)],
             [(1112, 1322), (1165, 1338), (1218, 1352), (1255, 1380), (1288, 1402)],
             [(1325, 1268), (1368, 1292), (1420, 1300)]]
HACIENDA = (1196, 1292)

# ── roads (colour only) ──
SAB_VILLAGE = (2318, 1722)
SAB_ROADS = [[(2040, 1655), (2110, 1690), (2210, 1708), (2318, 1722), (2400, 1740), (2480, 1730)],
             [(2318, 1722), (2330, 1790), (2370, 1850)], [(2110, 1690), (2060, 1740), (2040, 1800)]]
AMA_VILLAGE = (1632, 2032)
AMA_ROADS = [[(1632, 2032), (1700, 2100), (1790, 2150)], [(1632, 2032), (1560, 2075), (1500, 2110)]]
ROADS = SAB_ROADS + AMA_ROADS

# circles kept clear of trees: (x, y, r)
NOVEG = [(HACIENDA[0], HACIENDA[1], 62), (SAB_VILLAGE[0], SAB_VILLAGE[1], 50), (AMA_VILLAGE[0], AMA_VILLAGE[1], 62)]

# jungle-vs-savanna controls (used by both colour and vegetation)
AMA_LINE = (1284.0, 1844.0, .36)      # the Orinoco's general line in the Amazonas patch: y = 1844 + .36 (x - 1284)

# ── Amazonas south: a winding tributary down to the southern tip; Apure west: esteros, hacienda and the Meta/Arauca river ──
AMA_TRIB = [(1655, 2536), (1700, 2465), (1655, 2395), (1705, 2320), (1660, 2245), (1705, 2160), (1688, 2085), (1705, 2038)]
META = thin([tuple(p) for p in _L['rivers']['meta_arauca'] if 880 < p[0] < 1345], 14)
PONDS_W = [(480, 1176, 30, 14, .2), (562, 1194, 34, 15, -.3), (662, 1246, 38, 16, .4), (735, 1268, 30, 13, .1), (800, 1322, 40, 17, -.4),
           (882, 1376, 34, 15, .3), (948, 1324, 30, 14, .5), (852, 1262, 30, 13, -.2), (930, 1232, 28, 12, .3), (610, 1150, 26, 11, .2)]
ESTERO_W = [[(480, 1176), (520, 1186), (562, 1194), (612, 1220), (662, 1246), (700, 1258), (735, 1268)],
            [(800, 1322), (835, 1290), (852, 1262), (890, 1245), (930, 1232)], [(882, 1376), (915, 1352), (948, 1324)]]
HACIENDA2 = (690, 1172)
NOVEG.append((HACIENDA2[0], HACIENDA2[1], 62))

PERIJA_SPINE = [(150, 330), (128, 470), (148, 620), (188, 780), (240, 930)]
PERIJA_HAMLETS = [(262, 520), (256, 690), (268, 820)]


# ── Apure headwaters (foreground river of the Andes/Barinas view): same meander formula as the Llanos patch so the river is continuous ──
APURE_W = [(p[0], p[1] + 14 * math.sin(p[0] * .012 + 1.0) + 7 * math.sin(p[0] * .036)) for p in _L['rivers']['apure'] if 330 < p[0] < 1060]
BARS_APURE = _bars(thin(APURE_W, 8), [(.12, 3, 34, 7, 2.4), (.26, -4, 40, 8, 2.5), (.41, 3, 30, 7, 2.3), (.55, -3, 38, 8, 2.5), (.70, 4, 34, 7, 2.4), (.84, -3, 30, 7, 2.3)])


# ── Barinas / Táchira farmland: a lattice of paddocks shared by the colour pass (terrain) and the fence/cattle pass (place) ──
def fld(ix, iy):
    return ((ix * 73856093) ^ (iy * 19349663) ^ 0x5bd1e995) % 100


FIELD_W, FIELD_H = 56.0, 40.0


def field_region(x, y):
    return ((y > 1000) & (x > 330) & (x < 1000)) | ((x > 780) & (y > 800) & (x < 1000))
