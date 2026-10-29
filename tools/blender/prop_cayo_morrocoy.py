"""cayo_morrocoy: Cayo Sombrero-style cay (smaller than los_roques): sand, 5 palms, a palapa, a striped hammock between two palms,
two sunbeds, a small speedboat in the shallows, turquoise shallows ring (Part 'shallows'). Origin = island centre; water z=0."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from prop_palmas_coco import C, palm, palapa, lounger, sand_blob, scale_parts
from prop_barcos import lancha

NAME = 'cayo_morrocoy'
GROUND = 0x2f9fcc
PREVIEW = dict(az=0, pitch=66, fit=0.95)
AO_DIST = 7.0
V = lib.Vector


def build(L):
    out = []
    sh = L.Part('shallows', ao=0.0)
    sh.disc((0, 0, .03), 15.0, C['seaL'], rings=1, segs=18)
    sh.disc((0, 0, .06), 11.4, C['seaLL'], rings=1, segs=18)
    out.append(sh)
    isl = L.Part('island', ao=0.0)
    sand_blob(isl, 0, 0, 8.2, h=1.1, n=12, seed=3, jit=.12)
    out.append(isl)

    pl = L.Part('palms', ao=0.0)
    for (x, y, h, lean, sd) in ((-5.2, -1.2, 6.0, (-1.4, 0.0), 1), (-5.2, 3.2, 6.4, (-1.4, .6), 2), (4.8, 4.2, 5.8, (1.2, .9), 3),
                                (6.2, -2.4, 5.4, (1.5, -.6), 4), (0.8, 6.0, 5.8, (0.0, 1.5), 5)):
        palm(pl, x, y, h=h, lean=lean, s=.72, seed=sd, nfr=6, fl=3.3, coconuts=1, rings=4)
    pl.loc = (0, 0, 1.0)
    out.append(pl)

    pa = L.Part('palapa', ao=0.0)
    palapa(pa, 2.0, 1.4, r=2.2, h=3.0, tilt=.2)
    pa.loc = (0, 0, 1.0)
    out.append(pa)

    # hammock between the two first palms
    hm = L.Part('hammock', ao=0.0)
    a, b = (-5.1, -1.0, 2.3), (-5.1, 3.0, 2.3)
    ns = 6
    pts = []
    d = V((b[0] - a[0], b[1] - a[1], 0)); ln = d.length; d.normalize()
    nrm = V((-d.y, d.x, 0))
    for i in range(ns + 1):
        t = i / ns
        c = V((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] - 1.1 * math.sin(math.pi * t)))
        w = .75 * (.55 + .45 * math.sin(math.pi * t))
        pts.append((tuple(c + nrm * w), tuple(c - nrm * w)))
    for i in range(ns):
        hm.face([pts[i][0], pts[i][1], pts[i + 1][1], pts[i + 1][0]], C['coral'] if i % 2 == 0 else C['white'], up=True)
    hm.beam(a, pts[0][0], .05, C['white'], sides=3) if False else None
    hm.beam(a, (a[0] + d.x * .6, a[1] + d.y * .6, a[2] - .3), .05, C['white'], sides=3)
    hm.beam(b, (b[0] - d.x * .6, b[1] - d.y * .6, b[2] - .3), .05, C['white'], sides=3)
    hm.loc = (0, 0, 1.0)
    out.append(hm)

    lo = L.Part('sunbeds', ao=0.0)
    lounger(lo, -1.6, -3.6, .15, C['yellow'], C['white'])
    lounger(lo, .9, -4.0, -.1, C['coral'], C['white'])
    lo.loc = (0, 0, 1.0)
    out.append(lo)

    bt = L.Part('boat', loc=(8.8, -7.2, .15), ao=0.0)
    lancha(bt, 0, 0, math.pi * .8, s=.55)
    out.append(bt)
    return scale_parts(out, .95)


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
