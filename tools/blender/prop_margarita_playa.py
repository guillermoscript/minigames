"""margarita_playa: Playa El Agua beach set. Curved white-sand strip (sea to the south), 4 palapas + loungers, 3 umbrellas,
beach bar hut with striped awning, 4 leaning palms, wooden pier. Origin = centre of the beach; water z=0."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from prop_palmas_coco import C, palm, palapa, umbrella, lounger, xf, scale_parts

NAME = 'margarita_playa'
GROUND = 0x2f9fcc
PREVIEW = dict(az=0, pitch=66, fit=0.95)
AO_DIST = 8.0
V = lib.Vector
XS = [-32 + 64 * i / 16 for i in range(17)]


def yc(x):          # centre line of the sand strip (bay bows toward the north)
    return 0.0105 * x * x - 3.0


def hw(x):          # half width of the sand strip
    u = min(1.0, abs(x) / 33.0)
    return 6.3 * (1 - u ** 3) ** .7 + .4


def build(L):
    out = []
    # --- shallows ribbon (light turquoise water over the sand shelf) ---
    sh = L.Part('shallows', ao=0.0)
    for i in range(len(XS) - 1):
        x0, x1 = XS[i], XS[i + 1]
        y0s, y1s = yc(x0) - hw(x0), yc(x1) - hw(x1)
        y0n, y1n = yc(x0) + hw(x0), yc(x1) + hw(x1)
        sh.face([(x0, y0s - 9.5, .03), (x1, y1s - 9.5, .03), (x1, y1n, .03), (x0, y0n, .03)], C['seaL'], up=True)
        sh.face([(x0, y0s - 4.5, .06), (x1, y1s - 4.5, .06), (x1, y1n, .06), (x0, y0n, .06)], C['seaLL'], up=True)
    out.append(sh)

    # --- sand strip ---
    sd = L.Part('sand', ao=0.0)
    rings = []
    for x in XS:
        ys, yn, w = yc(x) - hw(x), yc(x) + hw(x), hw(x)
        rings.append([(x, ys, 0), (x, ys + .9, .35), (x, ys + 2.0, .5), (x, yn - 1.0, .55), (x, yn, 0)])
    sd.loft(rings, C['sand'], colors=[C['sandW'], C['sand'], C['sand'], C['sandD'], C['sandD']], caps=(True, True), ref=V((0, 0, .2)))
    out.append(sd)

    # --- palapas (thatched parasols) + loungers ---
    pa = L.Part('palapas', ao=0.0)
    lo = L.Part('loungers', ao=0.0)
    for k, (x, off) in enumerate(((-21, 1.2), (-10, -.5), (-1.5, -1.2), (22, .6))):
        y = yc(x) + off
        palapa(pa, x, y, r=2.7, h=3.5, rz=k * .4, tilt=.25)
        lounger(lo, x - 1.5, y - 1.8, 0.1 * (k - 1.5), C['coral'] if k % 2 == 0 else C['teal'], C['white'])
        lounger(lo, x + 1.6, y - 1.6, -0.12 * (k - 1.5), C['yellow'] if k % 2 == 0 else C['coral'], C['white'])
    for q in (pa, lo):
        q.loc = (0, 0, .5)
    out += [pa, lo]

    # --- umbrellas ---
    um = L.Part('umbrellas', ao=0.0)
    umbrella(um, -16, yc(-16) - 1.8, C['coral'], C['white'])
    umbrella(um, -6, yc(-6) - 3.2, C['yellow'], C['white'])
    umbrella(um, 17, yc(17) + 1.0, C['teal'], C['white'], r=2.0)
    um.loc = (0, 0, .5)
    out.append(um)

    # --- beach bar hut (behind the sand, striped awning toward the sea) ---
    bx, by = 4.5, yc(4.5) + 8.6
    bar = L.Part('bar', loc=(bx, by, .3), ao=0.0)
    bar.cbox((0, 0, 0), (8.4, 5.6, .5), C['woodL'], ch=.15, tcolor=C['woodL'])
    bar.box((0, .4, .5), (7.4, 4.4, 2.7), C['cream'], bottom=False, top=False, colors={'n': C['teal'], 's': C['teal']})
    bar.gable((0, .4, 3.2), 7.4, 4.4, 2.2, C['thatch'], C['thatchD'], strips=4, overhang=.7)
    # open serving window + counter
    bar.face([(-2.7, -1.81, 1.1), (2.7, -1.81, 1.1), (2.7, -1.81, 2.7), (-2.7, -1.81, 2.7)], C['woodD'], flip_ref=V((0, 5, 1.8)))
    bar.box((0, -2.6, .5), (6.2, .9, 1.0), C['woodL'], bottom=False)
    # striped awning
    n = 8
    for i in range(n):
        x0, x1 = -4.0 + 8.0 * i / n, -4.0 + 8.0 * (i + 1) / n
        bar.face([(x0, -1.8, 3.0), (x1, -1.8, 3.0), (x1, -4.7, 2.2), (x0, -4.7, 2.2)], C['coral'] if i % 2 == 0 else C['white'], up=True)
    for sx in (-3.8, 3.8):
        bar.beam((sx, -4.5, .5), (sx, -4.5, 2.25), .11, C['pole'], sides=4)
    for sx in (-2, 0, 2):
        bar.frustum((sx, -3.9, .5), .45, .4, .6, 6, C['coral'], tcolor=C['white'])
    out.append(bar)

    # --- coconut palms (lean toward the sea) ---
    pl = L.Part('palms', ao=0.0)
    for (x, off, h, sd_) in ((-28, 2.5, 8.5, 1), (-9, 4.2, 9.5, 2), (14, 5.5, 8.0, 3), (28, 2.4, 9.0, 4)):
        y = yc(x) + off
        palm(pl, x, y, h=h, lean=(1.2 if x < 0 else -1.0, -3.4), s=1.1, seed=sd_, nfr=6, fl=5.0, coconuts=1, rings=4)
    pl.loc = (0, 0, .5)
    out.append(pl)

    # --- wooden pier (into the sea, along -Y) ---
    px = 11.5
    y_end = yc(px) - hw(px) - 17.5
    y_start = yc(px) - hw(px) + 2.0
    pr = L.Part('pier', ao=0.0)
    ln = y_start - y_end
    nb = int(ln / 1.2)
    ym = (y_start + y_end) / 2
    pr.box((px, ym, 1.1), (2.8, ln, .5), C['woodD'], bottom=False, top=False)
    for k in range(nb):
        yy = y_start - 1.2 * (k + .5)
        pr.face([(px - 1.6, yy, 1.62), (px + 1.6, yy, 1.62), (px + 1.6, yy - 1.1, 1.62), (px - 1.6, yy - 1.1, 1.62)], C['woodL'] if k % 2 == 0 else 0x93693f, up=True)
    for yy in [y_start - 1.5 - i * 4.0 for i in range(5)]:
        if yy < y_end - .5:
            continue
        for sx in (-1.25, 1.25):
            pr.beam((px + sx, yy, -.8), (px + sx, yy, 2.1), .16, C['woodD'], sides=4)
    pr.cbox((px - .3, y_end - .8, 1.55), (3.6, 1.6, .35), C['woodL'], ch=.1)
    pr.beam((px - 1.4, y_end + .2, 1.6), (px - 1.4, y_end + .2, 2.6), .12, C['white'], sides=4)
    pr.beam((px + 1.4, y_end + .2, 1.6), (px + 1.4, y_end + .2, 2.6), .12, C['white'], sides=4)
    out.append(pr)
    return scale_parts(out, 0.66)


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
