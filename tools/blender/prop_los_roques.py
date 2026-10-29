"""los_roques: tiny Caribbean cay. White-sand island, Faro Holandes lighthouse (white tower, red band), 3 palapas, 3 palms,
short wooden dock with a small moored boat, turquoise shallows ring (separate Part 'shallows'). Origin = island centre; water z=0."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from prop_palmas_coco import C, palm, palapa, lounger, sand_blob, scale_parts
from prop_barcos import penero

NAME = 'los_roques'
GROUND = 0x2f9fcc
PREVIEW = dict(az=0, pitch=66, fit=0.95)
AO_DIST = 8.0
V = lib.Vector


def build(L):
    out = []
    sh = L.Part('shallows', ao=0.0)
    sh.disc((0, 0, .03), 21.0, C['seaL'], rings=1, segs=20)
    sh.disc((0, 0, .06), 15.5, C['seaLL'], rings=1, segs=20)
    out.append(sh)

    isl = L.Part('island', ao=0.0)
    sand_blob(isl, 0, 0, 11.2, h=1.3, n=14, seed=5, jit=.1)
    # a few scrub patches
    for (x, y, r) in ((-6.5, -2.5, 1.6), (4.5, 6.0, 1.3), (7.0, -3.0, 1.0)):
        isl.ico((x, y, 1.15), r, C['palmD'], sub=0, sc=(1, 1, .45), jitter=.12, seed=int(x + 9), tcolor=C['palm'])
    out.append(isl)

    # lighthouse (Faro Holandes)
    lh = L.Part('lighthouse', loc=(-2.0, 4.2, 1.2), ao=0.0)
    K = 1.3
    stack = [(a * K, b * K, c * K, d * K, e) for (a, b, c, d, e) in ((0.0, 3.2, 1.95, 1.6, C['white']), (3.2, 6.6, 1.6, 1.3, C['red']), (6.6, 9.9, 1.3, 1.1, C['white']))]
    for (z0, z1, r0, r1, c) in stack:
        lh.frustum((0, 0, z0), r0, r1, z1 - z0, 8, c, ring_colors=[c, 0xe4e0d4 if c == C['white'] else 0xb8352c], bottom=(z0 == 0))
    lh.frustum((0, 0, 9.9 * K), 1.75 * K, 1.6 * K, .45 * K, 8, C['steel'], tcolor=0x5a606c)
    lh.frustum((0, 0, 10.35 * K), .85 * K, .8 * K, 1.25 * K, 8, 0xf2d98a, ring_colors=[0xf2d98a, 0xe8c66a])
    lh.frustum((0, 0, 11.6 * K), 1.35 * K, 0, 1.2 * K, 8, C['red'], bottom=True, ring_colors=[C['red'], 0xb8352c])
    lh.box((-.6, -2.4, 0), (1.2, .3, 1.8), C['woodD'], bottom=False, top=False)
    out.append(lh)

    pa = L.Part('palapas', ao=0.0)
    lo = L.Part('loungers', ao=0.0)
    for k, (x, y) in enumerate(((3.6, -1.0), (6.2, 3.4), (-5.8, -3.2))):
        palapa(pa, x, y, r=2.3, h=3.2, rz=k * .5, tilt=.2)
        lounger(lo, x - 1.2, y - 1.4, .15 * k, C['coral'] if k % 2 == 0 else C['yellow'], C['white'])
    for q in (pa, lo):
        q.loc = (0, 0, 1.15)
    out += [pa, lo]

    pl = L.Part('palms', ao=0.0)
    for (x, y, h, lean, sd) in ((-8.4, 0.0, 6.6, (-1.0, 1.0), 1), (3.4, 8.2, 7.0, (.8, 1.8), 2), (8.6, -1.6, 6.2, (1.6, -.8), 3)):
        palm(pl, x, y, h=h, lean=lean, s=.82, seed=sd, nfr=6, fl=4.0, coconuts=1, rings=4)
    pl.loc = (0, 0, 1.15)
    out.append(pl)

    dk = L.Part('dock', ao=0.0)
    x0, y0, y1 = 1.8, -7.8, -16.5
    ln = y0 - y1
    dk.box((x0, (y0 + y1) / 2, .85), (2.2, ln, .4), C['woodD'], bottom=False, top=False)
    n = int(ln / 1.1)
    for k in range(n):
        yy = y0 - 1.1 * k
        dk.face([(x0 - 1.35, yy, 1.28), (x0 + 1.35, yy, 1.28), (x0 + 1.35, yy - 1.0, 1.28), (x0 - 1.35, yy - 1.0, 1.28)], C['woodL'] if k % 2 == 0 else 0x93693f, up=True)
    for yy in (y0 - 1.0, y0 - 4.0, y0 - 7.0):
        for sx in (-1.0, 1.0):
            dk.beam((x0 + sx, yy, -.5), (x0 + sx, yy, 1.6), .14, C['woodD'], sides=4)
    out.append(dk)

    bt = L.Part('boat', loc=(4.9, -12.2, .15), ao=0.0)
    penero(bt, 0, 0, math.pi / 2 + .12, s=.42)
    out.append(bt)
    return scale_parts(out, .9)


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
