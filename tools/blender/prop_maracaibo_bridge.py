"""maracaibo_bridge: cable-stayed bridge along +X. Box-girder deck with an arched navigation span, leaning H-pylons with chamfers, fan stays."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'maracaibo_bridge'
GROUND = 0x2f78d0
GROUND_Z = 0.0
PREVIEW = dict(az=18, pitch=70, fit=0.8)
AO_DIST = 12.0
LEN = 96.0
ZD = 8.0
NS = 16


def sst(a, b, v):
    t = max(0.0, min(1.0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)


def zdeck(x):
    u = abs(x) / (LEN / 2)
    return ZD + 3.6 * (1 - sst(0.0, 0.62, u))


def build(L):
    P = L.P
    h = LEN / 2
    xs = [-h + LEN * i / NS for i in range(NS + 1)]
    dk = L.Part('bridge_deck', ao=0.0)
    # trapezoid box girder: ring points (y, z) -> wide deck slab on a narrower hull
    sec = [(-3.5, 1.5), (3.5, 1.5), (2.3, .0), (-2.3, .0)]
    rings = [[(x, y, zdeck(x) + z) for (y, z) in sec] for x in xs]
    dk.loft(rings, P['concrete'], colors=[P['concrete'], P['concD'], P['concD'], P['concrete']], caps=(True, True), ref=None)
    for i in range(NS):    # road + dashed centre line + kerbs
        x0, x1 = xs[i], xs[i + 1]
        z0, z1 = zdeck(x0) + 1.52, zdeck(x1) + 1.52
        dk.face([(x0, -2.6, z0), (x1, -2.6, z1), (x1, 2.6, z1), (x0, 2.6, z0)], P['asphalt'], up=True)
        if i % 2 == 0:
            dk.face([(x0 + .6, -.2, z0 + .02), (x1 - .6, -.2, z1 + .02), (x1 - .6, .2, z1 + .02), (x0 + .6, .2, z0 + .02)], P['road'], up=True)
        for sy in (-1, 1):
            dk.face([(x0, sy * 2.6, z0), (x1, sy * 2.6, z1), (x1, sy * 3.4, z1), (x0, sy * 3.4, z0)], P['white'], up=True)
            dk.face([(x0, sy * 3.45, z0), (x1, sy * 3.45, z1), (x1, sy * 3.45, z1 + .9), (x0, sy * 3.45, z0 + .9)], P['white'], flip_ref=lib.Vector((x0, 0, z0)) if False else lib.Vector((x0, sy * 9, z0)))
    for sx in (-1, 1):   # abutments
        dk.cbox((sx * (h - 1.6), 0, -3), (3.2, 8, zdeck(sx * h) + 1.5 + 3), P['concD'], ch=.3, tcolor=P['concrete'])

    pr = L.Part('piers', ao=0.0)
    for i in range(1, NS):
        px = xs[i]
        if i % 2 == 1:
            continue
        top = zdeck(px)
        pr.frustum((px, 0, -3), 1.5, 1.0, top + 3 - 1.4, 4, P['pier'], rz=math.pi / 4, sy=1.5, top=False, bottom=False)
        pr.cbox((px, 0, top - 1.4), (2.6, 5.4, 1.4), P['concD'], ch=.25, tcolor=P['concrete'])

    py = L.Part('pylons', ao=0.0)
    cab = L.Part('cable_fan', ao=0.0)
    top_z = zdeck(0) + 21
    for t in (0.28, 0.72):
        px = -h + LEN * t
        zb = zdeck(px)
        for sy in (-1, 1):
            r0 = [(px + a * 1.3, sy * 4.1 + b * 1.1, zb - 1) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            rm = [(px + a * 1.1, sy * 3.7 + b * 0.95, zb + 9) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            r1 = [(px + a * .8, sy * 3.0 + b * .8, top_z) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            py.loft([r0, rm, r1], P['white'], colors=[P['white'], P['band'], P['concrete'], P['band']], caps=(False, True), ref=lib.Vector((px, sy * 3.5, (zb + top_z) / 2)))
        py.cbox((px, 0, top_z - 1.6), (1.8, 7.0, 1.6), P['white'], ch=.3)
        py.cbox((px, 0, zb + 7.5), (1.5, 7.2, 1.1), P['band'], ch=.2)
        for sy in (-1, 1):
            for d in (-1, 1):
                for k in range(1, 6):
                    ax = px + d * (3.2 + k * 3.7)
                    ax = max(-h + 2, min(h - 2, ax))
                    cab.beam((px, sy * 3.1, top_z - .6), (ax, sy * 3.3, zdeck(ax) + 1.6), .24, P['white'], sides=3)
    return [dk, pr, py, cab]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
