"""Gran Sabana / Canaima hero zone data shared by terrain_v2.py and place_v2.py (design-canvas coordinates).
Two seamless hero patches ('can' east of x=2198, 'can2' west of it, below the Ordaz patch) share one set of tepuis, rivers and a lagoon."""
import math

GR = 7.8                                    # jungle floor height (the Guayana plateau is lowered inside the patches so the tepuis tower over it)
SEA = 1.5

# tepui: centre, half-axes (a along rot th, b across), height above the floor, falls = (world direction alpha, scale-height) on its walls
TEPUIS = [
    dict(c=(2510, 1110), a=74, b=56, th=.35, T=98, falls=[1.75, 2.55], chan=[[(2440, 1150), (2415, 1150), (2392, 1150), (2345, 1152), (2302, 1154)], None]),
    dict(c=(2418, 1268), a=30, b=24, th=-.4, T=46, falls=[2.7], chan=[[(2368, 1270), (2330, 1272), (2294, 1274)]]),
    dict(c=(2170, 1400), a=46, b=36, th=.2, T=44, falls=[-.15], chan=[[(2228, 1398), (2262, 1398), (2285, 1398)]]),
    dict(c=(2592, 1350), a=27, b=31, th=.8, T=42, falls=[1.9], chan=[None]),
    dict(c=(2064, 1300), a=36, b=28, th=-.3, T=38, falls=[1.3], chan=[None]),
]

CARONI = [(2385, 957), (2363, 1001), (2342, 1044), (2320, 1081), (2307, 1108), (2303, 1127), (2298, 1159), (2295, 1194), (2293, 1235), (2292, 1278),
          (2290, 1302), (2288, 1328), (2296, 1356), (2314, 1380), (2337, 1406), (2363, 1437), (2388, 1464), (2400, 1510)]

LAGOON = dict(c=(2312, 1396), rx=62, ry=34, th=.6)
ISLETS = [(2300, 1388, 9), (2330, 1404, 7), (2285, 1410, 6)]
VILLAGE = (2258, 1388)                       # Pemón huts + dock on the lagoon's west shore


def face(t, alpha):
    """point on a tepui wall in world direction alpha + inward unit normal"""
    cx, cy = t['c']
    a, b, th = t['a'], t['b'], t['th']
    wx, wy = math.cos(alpha), math.sin(alpha)
    e1 = (math.cos(th), math.sin(th))
    e2 = (-math.sin(th), math.cos(th))
    k = 1.0 / math.hypot((wx * e1[0] + wy * e1[1]) / a, (wx * e2[0] + wy * e2[1]) / b)
    px, py = cx + wx * k, cy + wy * k
    qx, qy = px - cx, py - cy
    gx = e1[0] * (qx * e1[0] + qy * e1[1]) / a ** 2 + e2[0] * (qx * e2[0] + qy * e2[1]) / b ** 2
    gy = e1[1] * (qx * e1[0] + qy * e1[1]) / a ** 2 + e2[1] * (qx * e2[0] + qy * e2[1]) / b ** 2
    n = math.hypot(gx, gy)
    return (px, py), (-gx / n, -gy / n)


# Salto Ángel: a tall escarpment behind (north of) the Canaima / Guri tiles, falls on its south face (ground is not lowered here, falls land on the plateau floor)
TEPUIS_X = []
GROUND_X = 16.8
