"""palmas_moriche: moriche / pindo fan palms for the delta and llanos. palm_moriche_s/m/l (separate meshes, <=250 tris each)
and palm_cluster (three palms in one mesh). Origin = trunk base."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'palmas_moriche'
GROUND = 0xa8b65a
PREVIEW = dict(az=0, pitch=float(os.environ.get('PITCH', '70')), fit=float(os.environ.get('FIT', '1.0')))
AO_DIST = 6.0

TRK = 0x9a8a62
TRKD = 0x6e5e3e
LEAF = 0x4a9a3e
LEAFD = 0x2c6f32
LEAFL = 0x7fb34a
FRUIT = 0xb85a30


def leaf(p, c, a, R, droop, col_top, col_bot):
    """Fan leaf: a short petiole rising from the crown, then a wide drooping fan."""
    d = (math.cos(a), math.sin(a))
    nx, ny = -d[1], d[0]
    cx, cy, cz = c
    sl = R * .42
    m = (cx + d[0] * sl, cy + d[1] * sl, cz + R * .2)
    p.beam((cx, cy, cz), m, .13, TRKD, sides=3)
    w = R * .52

    def pt(f, s_, dz):
        return (m[0] + d[0] * f * w + nx * s_ * w, m[1] + d[1] * f * w + ny * s_ * w, m[2] + dz)
    ring = [pt(0, 0, 0), pt(.45, .95, -droop * .2), pt(1.15, .62, -droop * .75), pt(1.5, 0, -droop), pt(1.15, -.62, -droop * .75), pt(.45, -.95, -droop * .2)]
    p.face(ring, col_top, up=True)
    f = p.face([(q[0], q[1], q[2] - .2) for q in ring], col_bot)
    f.normal_update()
    if f.normal.z > 0:
        f.normal_flip()


def palm(p, ox, oy, h, lean, nleaf, R, seed=0, tw=.55):
    # curved trunk: 4 rings, hex-ish (5 sides) with ring bands
    n = 5
    rings = []
    for k, (zf, rw) in enumerate(((0, 1.0), (.3, .72), (.65, .6), (1.0, .55))):
        cx = ox + lean * (zf ** 1.6) * h * .25
        z = h * zf
        r = tw * rw
        rings.append([(cx + r * math.cos(2 * math.pi * i / n + k * .35), oy + r * math.sin(2 * math.pi * i / n + k * .35), z) for i in range(n)])
    cols = [TRK, TRKD, TRK, TRK, TRKD]
    p.loft(rings, TRK, colors=cols, ref=lib.Vector((ox, oy, h / 2)))
    top = (ox + lean * h * .25, oy, h)
    p.face(rings[-1], TRKD, up=True)
    # crown: fan leaves in two tiers
    for i in range(nleaf):
        a = 2 * math.pi * i / nleaf + seed
        leaf(p, (top[0], top[1], top[2] + .3), a, R, R * .9, LEAFL if i % 2 else LEAF, LEAFD)
    for i in range(nleaf // 2):
        a = 2 * math.pi * (i + .5) / (nleaf // 2) + seed * 1.7
        leaf(p, (top[0], top[1], top[2] + .9), a, R * .62, R * .3, LEAFL, LEAFD)
    p.ico((top[0], top[1], top[2] - .1), .6, FRUIT, sub=0, sc=(1, 1, .8))     # fruit cluster


def build(L):
    out = []
    cfg = {'s': (-22, 0, 4.5, 6, 3.0), 'm': (-8, 0, 7.5, 7, 4.2), 'l': (8, 0, 11.0, 8, 5.4)}
    for k, (x, y, h, nl, R) in cfg.items():
        p = L.Part('palm_moriche_' + k, loc=(x, y, 0), ao=0.0)
        palm(p, 0, 0, h, .35, nl, R, seed=ord(k), tw=.5 + h * .04)
        out.append(p)
    c = L.Part('palm_cluster', loc=(0, -26, 0), ao=0.0)
    palm(c, -3.8, 1.2, 9.0, -.3, 6, 4.4, 1, tw=.7)
    palm(c, 3.2, -.8, 11.5, .4, 7, 5.0, 2, tw=.8)
    palm(c, .2, 3.8, 6.0, .1, 6, 3.6, 3, tw=.6)
    out.append(c)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
