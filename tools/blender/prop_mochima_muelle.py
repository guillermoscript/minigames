"""mochima_muelle: Mochima bay. Wooden pier into the sea, 3 stilt fishermen huts with tin roofs, two moored boats (penero + sailboat),
small sandy shore with rocks, a palm and green hills behind. Origin = pier root at the shore centre; water z=0; shore to the north (+Y)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from prop_palmas_coco import C, palm, scale_parts
from prop_barcos import penero, sailboat

NAME = 'mochima_muelle'
GROUND = 0x2f9fcc
PREVIEW = dict(az=0, pitch=66, fit=0.95)
AO_DIST = 8.0
V = lib.Vector
TIN = [0x8fa0b0, 0xb8553a, 0xc9d3dc]


def hut(p, x, y, wall, roof, roof2, door=0x3a5a6a, sx=1.0):
    for dx in (-1.9, 1.9):
        for dy in (-1.5, 1.5):
            p.beam((x + dx, y + dy, -.9), (x + dx, y + dy, 1.4), .13, C['woodD'], sides=3)
    p.cbox((x, y, 1.25), (5.4, 4.4, .35), C['woodL'], ch=.12)
    p.box((x, y, 1.6), (4.3, 3.4, 2.2), wall, bottom=False, tcolor=wall)
    p.gable((x, y, 3.8), 4.3, 3.4, 1.55, roof, roof2, strips=3, overhang=.55)
    yf = y - 1.72
    p.face([(x - .5, yf, 1.6), (x + .5, yf, 1.6), (x + .5, yf, 3.4), (x - .5, yf, 3.4)], door, flip_ref=V((x, y + 8, 2.5)))
    for wx in (-1.45, 1.45):
        p.face([(x + wx - .4, yf, 2.3), (x + wx + .4, yf, 2.3), (x + wx + .4, yf, 3.1), (x + wx - .4, yf, 3.1)], C['glass'], flip_ref=V((x, y + 8, 2.5)))
    p.box((x + 2.3, y - 1.3, 1.6), (.5, .5, .6), C['coral'], bottom=False)       # fish crate / buoy box


def build(L):
    out = []
    # --- shore, rocks, hills ---
    sh = L.Part('shore', ao=0.0)
    sh.cbox((0, 14.5, 0), (46, 8.5, 1.3), C['sand'], ch=.7, tcolor=C['sand'])
    sh.cbox((0, 10.2, 0), (34, 2.0, .55), C['sandW'], ch=.35)
    for i, (x, y, r) in enumerate(((-17, 9.6, 1.9), (-14.2, 10.5, 1.2), (16, 9.5, 2.2), (19, 11, 1.4), (7.5, 9.8, 1.0), (-6.8, 9.9, 1.1))):
        sh.ico((x, y, .6), r, C['rock'], sub=0, sc=(1.2, 1, .8), jitter=.15, seed=i + 1, tcolor=C['rockD'])
    out.append(sh)
    hl = L.Part('hills', ao=0.0)
    hl.ico((-11, 21, 0), 11.5, 0x2c6f32, sub=1, sc=(1.25, 1, .7), jitter=.1, seed=3, tcolor=0x3f8a40, cut_below=-.2)
    hl.ico((11, 22, 0), 10.0, 0x2c6f32, sub=1, sc=(1.3, 1, .85), jitter=.1, seed=4, tcolor=0x3f8a40, cut_below=-.2)
    out.append(hl)
    pl = L.Part('palms', loc=(0, 0, 1.2), ao=0.0)
    palm(pl, -13, 13.2, h=7.0, lean=(1.4, -2.2), s=.95, seed=2, nfr=6, fl=4.0, coconuts=1)
    palm(pl, 14, 12.6, h=6.4, lean=(-1.2, -2.0), s=.9, seed=5, nfr=6, fl=3.8, coconuts=1)
    out.append(pl)

    # --- pier ---
    pr = L.Part('pier', ao=0.0)
    y0, y1 = 10.5, -15.0
    ln = y0 - y1
    pr.box((0, (y0 + y1) / 2, .95), (2.6, ln, .4), C['woodD'], bottom=False, top=False)
    n = int(ln / 1.1)
    for k in range(n):
        yy = y0 - 1.1 * k
        pr.face([(-1.5, yy, 1.38), (1.5, yy, 1.38), (1.5, yy - 1.0, 1.38), (-1.5, yy - 1.0, 1.38)], C['woodL'] if k % 2 == 0 else 0x93693f, up=True)
    for i in range(8):
        yy = y0 - 1.0 - i * 3.4
        for sx in (-1.15, 1.15):
            pr.beam((sx, yy, -.9), (sx, yy, 1.7), .15, C['woodD'], sides=3)
    pr.cbox((0, y1 - 1.1, 1.38), (4.2, 2.2, .3), C['woodL'], ch=.1)
    # walkways to the huts
    for (hx, hy) in ((-8.0, 1.5), (8.4, -3.2), (-8.4, -9.2)):
        sgn = -1 if hx < 0 else 1
        x_in, x_out = sgn * 1.4, hx - sgn * 2.4
        pr.box(((x_in + x_out) / 2, hy - 1.0, 1.25), (abs(x_out - x_in), 1.1, .25), C['woodL'], bottom=False)
    out.append(pr)

    hs = L.Part('huts', ao=0.0)
    hut(hs, -8.0, 1.5, 0x5fb8b0, TIN[1], 0xc9604a)
    hut(hs, 8.4, -3.2, 0xe8c25a, TIN[0], TIN[2])
    hut(hs, -8.4, -9.2, 0xe8725a, TIN[0], TIN[2])
    out.append(hs)

    b1 = L.Part('boat_penero', loc=(4.0, -7.0, .12), ao=0.0)
    penero(b1, 0, 0, math.pi / 2 - .06, s=.95)
    b2 = L.Part('boat_sailboat', loc=(-4.6, -4.6, .12), ao=0.0)
    sailboat(b2, 0, 0, math.pi / 2 + .1, s=.85)
    out += [b1, b2]
    return scale_parts(out, .85)


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
