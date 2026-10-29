"""puente_angostura: suspension bridge (Ciudad Bolivar). Origin at deck centre, spans +X, water at z=0. Two tall H pylons, catenary main cables, hangers, road deck."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'puente_angostura'
GROUND = 0x2f78d0
GROUND_Z = 0.0
PREVIEW = dict(az=18, pitch=70, fit=0.8)
AO_DIST = 14.0
LEN = 100.0
ZD = 8.0
TX = 24.0       # tower x
TOP = 38.0
CABLE = 0xe8ebf0
TOWER = 0xd7d3c8
TOWERD = 0xb0aa9a


def cab_z(x):
    """main cable height: parabola in the main span, straight-ish dip in side spans"""
    ax = abs(x)
    if ax <= TX:
        u = ax / TX
        return ZD + 5.0 + (TOP - 1.5 - ZD - 5.0) * u * u
    u = (ax - TX) / (LEN / 2 - TX)
    return (TOP - 1.5) + (ZD + 3.0 - (TOP - 1.5)) * (u ** 1.15)


def build(L):
    P = L.P
    V = lib.Vector
    h = LEN / 2
    NS = 20
    xs = [-h + LEN * i / NS for i in range(NS + 1)]
    dk = L.Part('puente_tablero', ao=0.0)
    sec = [(-4.2, 1.4), (4.2, 1.4), (2.6, -.6), (-2.6, -.6)]
    rings = [[(x, y, ZD + z) for (y, z) in sec] for x in xs]
    dk.loft(rings, P['concrete'], colors=[P['concrete'], 0xa9b0bc, P['concD'], 0xa9b0bc], caps=(True, True))
    for i in range(NS):
        x0, x1 = xs[i], xs[i + 1]
        z = ZD + 1.42
        dk.face([(x0, -3.0, z), (x1, -3.0, z), (x1, 3.0, z), (x0, 3.0, z)], P['asphalt'], up=True)
        if i % 2 == 0:
            dk.face([(x0 + .7, -.2, z + .02), (x1 - .7, -.2, z + .02), (x1 - .7, .2, z + .02), (x0 + .7, .2, z + .02)], P['road'], up=True)
        for sy in (-1, 1):
            dk.face([(x0, sy * 3.0, z), (x1, sy * 3.0, z), (x1, sy * 4.2, z), (x0, sy * 4.2, z)], P['white'], up=True)
    for sx in (-1, 1):   # approach ramps / abutments
        dk.cbox((sx * (h + 3), 0, -3), (9, 10, ZD + 4.4), P['concD'], ch=.4, tcolor=P['concrete'])
    pr = L.Part('pilas', ao=0.0)
    for sx in (-1, 1):
        px = sx * TX
        pr.cbox((px, 0, -3), (6.5, 13, ZD + 1.2), TOWERD, ch=.6, tcolor=TOWER)
    for k in (-1, 0, 1):   # approach piers
        for sx in (-1, 1):
            if k == 0:
                continue
            x = sx * (TX + (h - TX) / 2)
            pr.cbox((x, 0, -3), (2.6, 5.4, ZD - .4 + 3), TOWERD, ch=.3, tcolor=TOWER)
    py = L.Part('pilonos', ao=0.0)
    for sx in (-1, 1):
        px = sx * TX
        for sy in (-1, 1):
            ys = sy * 5.0
            r0 = [(px + a * 1.7, ys + b * 1.5, ZD) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            rm = [(px + a * 1.35, sy * 4.3 + b * 1.25, ZD + 15) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            r1 = [(px + a * 1.0, sy * 3.6 + b * 1.0, TOP) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            py.loft([r0, rm, r1], TOWER, colors=[TOWER, 0xe6e2d8, TOWERD, 0xc3bdae], caps=(False, True), ref=V((px, ys, (ZD + TOP) / 2)))
        py.cbox((px, 0, TOP - 3.2), (2.6, 8.8, 3.2), TOWER, ch=.5, tcolor=0xe6e2d8)
        py.cbox((px, 0, ZD + 15), (2.2, 8.6, 2.0), TOWER, ch=.4)
        py.cbox((px, 0, ZD + 26), (2.0, 8.4, 1.6), TOWERD, ch=.3)
    cb = L.Part('cables', ao=0.0)
    for sy in (-1, 1):
        n = 40
        pts = []
        for i in range(n + 1):
            x = -h + LEN * i / n
            pts.append((x, sy * 4.0 - sy * 0.2 * (0 if abs(x) < TX else 1) * 0, cab_z(x) + 0.0))
        # snap tower tops: pylon saddle at x=+-TX
        for i in range(n):
            cb.beam(pts[i], pts[i + 1], .42, CABLE, sides=3)
        # hangers
        for i in range(2, n - 1):
            x, y, z = pts[i]
            if abs(abs(x) - TX) < 1.6:
                continue
            zt = ZD + 1.6
            if z - zt > 1.0:
                cb.beam((x, y, z), (x, y, zt), .11, 0xc7ccd6, sides=3)
    return [dk, pr, py, cb]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
