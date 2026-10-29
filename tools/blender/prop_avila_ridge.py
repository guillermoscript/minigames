"""avila_ridge: lush green ridge with ravines and rocky crest. Long axis +X, crest slightly north of centre; base sunk 1 unit."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'avila_ridge'
GROUND = 0xc2c48a
GROUND_Z = -1.0
PREVIEW = dict(az=0, pitch=70, fit=0.9)
AO_DIST = 12.0
LEN, DEP, HGT = 160.0, 44.0, 26.0
NX, NY = 56, 12


def sst(a, b, v):
    t = max(0.0, min(1.0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)


def n2(x, y):
    return (math.sin(x * .21 + y * .13) + math.sin(x * .53 - y * .31 + 1.7) * .6 + math.sin(x * 1.1 + y * .7 + 3.1) * .25) / 1.85


def hfun(x, y):
    u = max(-1.0, min(1.0, (y + 3) / (DEP / 2)))
    env = sst(0.0, 0.2, 1 - abs(x) / (LEN / 2))
    prof = max(0.0, 1 - abs(u) ** 1.5)
    ravine = 0.14 * math.sin(x * .62 + u * 2) * prof
    return HGT * env * (prof * (0.82 + 0.2 * n2(x, 0)) - ravine)


def hexmix(a, b, t):
    t = max(0.0, min(1.0, t))
    ca = [(a >> 16) & 255, (a >> 8) & 255, a & 255]
    cb = [(b >> 16) & 255, (b >> 8) & 255, b & 255]
    return (int(ca[0] + (cb[0] - ca[0]) * t) << 16) | (int(ca[1] + (cb[1] - ca[1]) * t) << 8) | int(ca[2] + (cb[2] - ca[2]) * t)


def build(L):
    P = L.P
    p = L.Part('avila_ridge', ao=0.0)

    def vc(x, y, z):
        f = (z + 1) / HGT
        nz = n2(x * 1.7, y * 1.7)
        c = hexmix(P['ccs'], P['selva'], f * 2.2 - 0.3 + nz * .35)
        c = hexmix(c, P['selvaL'], (f - .45) * 2.5 * (0.5 + nz * .5))
        c = hexmix(c, P['rocaL'] if nz > 0.3 else P['roca'], (f - .82) * 5)
        c = hexmix(c, P['selva2'], max(0.0, -nz) * 0.9 * min(1.0, f * 2))
        return c
    p.vcolfn = vc
    pts = {}
    for i in range(NX + 1):
        for j in range(NY + 1):
            x = -LEN / 2 + LEN * i / NX
            y = -DEP / 2 + DEP * j / NY
            pts[(i, j)] = (x, y, hfun(x, y) - 1.0)
    for i in range(NX):
        for j in range(NY):
            q = [pts[(i, j)], pts[(i + 1, j)], pts[(i + 1, j + 1)], pts[(i, j + 1)]]
            p.face(q, P['selva'], up=True, smooth=True)
    return [p]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
