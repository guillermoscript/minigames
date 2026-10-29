"""manglares: three mangrove clusters mangle_1..3 (<=300 tris each) with arching stilt roots plunging into the water,
dense dark-green canopy blobs and small red/purple accents, plus 'agua_oscura' (dark tannin water patch).
Origin = cluster base centre, water z=0, roots dip to z=-0.8."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'manglares'
GROUND = 0x3c6d58
PREVIEW = dict(az=0, pitch=float(os.environ.get('PITCH', '70')), fit=float(os.environ.get('FIT', '0.7')))
AO_DIST = 6.0

ROOT = 0x6a4a34
ROOTL = 0x8a6444
LEAF = 0x2a6a38
LEAFD = 0x1c4f2c
LEAFL = 0x4a8a3c
FLOWER = 0xb8508a
PROP = 0xa84a3a


def root(p, x0, y0, z0, x1, y1, w, segs=3):
    """Arching prop root from the trunk (x0,y0,z0) bowing outward and down to the water at (x1,y1,-0.8)."""
    pts = []
    for i in range(segs + 1):
        t = i / segs
        # bow: rises above the straight line then falls
        x = x0 + (x1 - x0) * (1 - (1 - t) ** 1.5)
        y = y0 + (y1 - y0) * (1 - (1 - t) ** 1.5)
        z = z0 + (-0.8 - z0) * t ** 1.6 + math.sin(t * math.pi) * .5
        pts.append((x, y, z))
    for i in range(segs):
        p.beam(pts[i], pts[i + 1], w * (1.0 - .35 * i / segs), ROOT if i % 2 else ROOTL, sides=3) if False else None
    return pts


def cluster(p, seed, spread, trunks):
    rng = random.Random(seed)
    for idx, (tx, ty, th, canopy_r) in enumerate(trunks):
        # slim trunk leaning slightly
        p.beam((tx, ty, 1.5), (tx + rng.uniform(-.4, .4), ty + rng.uniform(-.4, .4), th), .6, ROOT, sides=3)
        # arching stilt roots
        nroot = 6 if idx == 0 else 4
        for k in range(nroot):
            a = 2 * math.pi * k / nroot + rng.uniform(-.3, .3)
            rr = rng.uniform(4.4, 6.4)
            x1, y1 = tx + rr * math.cos(a), ty + rr * math.sin(a)
            z0 = 3.2
            pts = []
            for i in range(3):
                t = i / 2
                x = tx + (x1 - tx) * (1 - (1 - t) ** 1.6)
                y = ty + (y1 - ty) * (1 - (1 - t) ** 1.6)
                z = z0 + (-0.8 - z0) * t ** 1.5 + math.sin(t * math.pi) * .9
                pts.append((x, y, z))
            for i in range(2):
                p.beam(pts[i], pts[i + 1], .4 - .1 * i, ROOT if k % 2 else ROOTL, sides=3)
        # dense canopy: lumpy cluster of blobs (dark base, lighter tops)
        r = canopy_r
        p.ico((tx, ty, th + r * .4), r, LEAF, sub=0, sc=(1.2, 1.15, .8), jitter=.1, seed=seed + int(tx * 3), tcolor=LEAF)
        p.ico((tx + r * .75, ty + r * .35, th + r * .1), r * .72, LEAFD, sub=0, sc=(1.2, 1.1, .8), jitter=.12, seed=seed + 5, tcolor=LEAF)
        p.ico((tx - r * .7, ty - r * .3, th + r * .2), r * .68, LEAFD, sub=0, sc=(1.2, 1.1, .8), jitter=.12, seed=seed + 6, tcolor=LEAFL)
        if idx == 0:
            p.ico((tx + r * .1, ty - r * .6, th + r * .75), r * .5, LEAF, sub=0, sc=(1.1, 1.1, .8), jitter=.12, seed=seed + 7, tcolor=LEAFL)
        # flower / propagule accents
        if rng.random() < .8:
            p.frustum((tx - canopy_r * .35, ty - canopy_r * .75, th + canopy_r * .55), .38, 0, .6, 4, FLOWER, bottom=False)
        p.beam((tx + canopy_r * .7, ty - canopy_r * .1, th - canopy_r * .1), (tx + canopy_r * .75, ty - canopy_r * .1, th - canopy_r * .1 - 1.4), .08, PROP, sides=3)


def build(L):
    out = []
    # 1: three-trunk grove, dense
    m = L.Part('mangle_1', loc=(-24, 0, 0), ao=0.0)
    cluster(m, 1, 5, [(0, 0, 7.0, 5.0), (-5.0, 3.0, 5.0, 3.0)])
    out.append(m)
    m = L.Part('mangle_2', loc=(0, 0, 0), ao=0.0)
    cluster(m, 2, 5, [(0, 0, 6.4, 4.5), (-5.0, -2.5, 4.6, 2.8)])
    out.append(m)
    m = L.Part('mangle_3', loc=(24, 0, 0), ao=0.0)
    cluster(m, 3, 5, [(0, 0, 8.0, 4.4), (5.0, 3.0, 4.8, 3.0)])
    out.append(m)
    a = L.Part('agua_oscura', loc=(0, 0, 0), ao=0.0)
    n = 18
    for cx in (-24, 0, 24):
        a.disc((cx, 0, .08), 13, 0x2a5648, rings=1, segs=n, colorfn=lambda x, y: 0x2a5648)
    out.append(a)
    only = os.environ.get('ONLY')
    return [o for o in out if not only or o.name in only.split(',')]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
