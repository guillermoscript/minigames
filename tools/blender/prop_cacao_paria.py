"""cacao_paria: Paria peninsula cacao farm. 8 cacao trees (round canopy, orange pods on the trunk) in two rows, a cacao drying patio
(brown/ivory grid), a thatched farm hut, burlap sacks, two tall shade trees. Origin = farm centre; ground = jungle green."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from prop_palmas_coco import C, scale_parts

NAME = 'cacao_paria'
GROUND = 0x5f9a48
PREVIEW = dict(az=0, pitch=66, fit=0.95)
AO_DIST = 7.0
V = lib.Vector
BURLAP = 0xcfae72


def build(L):
    out = []
    # --- worn soil under the orchard + path ---
    sl = L.Part('soil', ao=0.0)
    def soil(x, y):
        if -19 <= x <= 1 and 2 <= y <= 17:
            return 0x9b7b4e
        if 0 < y < 4.5 and -2 <= x <= 14:
            return 0xb9965f
        return None
    sl.grid((-3, 8, .03), (40, 30), 20, 15, 0x9b7b4e, colorfn=lambda x, y: soil(x - 3, y + 8))
    out.append(sl)

    # --- cacao trees ---
    tr = L.Part('cacao_trees', ao=0.0)
    seed = 0
    for row, y in enumerate((5.5, 12.5)):
        for i in range(4):
            seed += 1
            x = -16.0 + i * 5.0 + (1.0 if row else 0.0)
            tr.frustum((x, y, 0), .42, .3, 2.2, 6, 0x7a5230, bottom=False, ring_colors=[0x7a5230, 0x6a4628])
            tr.ico((x, y, 3.3), 2.5, 0x2f7a3a, sub=0, sc=(1, 1, .62), jitter=.1, seed=seed, tcolor=0x4a9a48)
            tr.ico((x + .9, y - .6, 2.8), 1.7, 0x2f7a3a, sub=0, sc=(1, 1, .6), jitter=.1, seed=seed + 20, tcolor=0x4a9a48)
            for k in range(3):
                a = seed * 1.3 + k * 2.1
                tr.beam((x + 2.1 * math.cos(a), y + 2.1 * math.sin(a), 3.0), (x + 2.35 * math.cos(a), y + 2.35 * math.sin(a), 2.15), .46, 0xe8832a if k != 1 else 0xe8c040, sides=3)
    out.append(tr)

    # --- tall shade trees ---
    sh = L.Part('shade_trees', ao=0.0)
    for (x, y, k) in ((-20.5, 9.0, 1.15), (3.2, 15.0, 1.0)):
        sh.frustum((x, y, 0), .9 * k, .6 * k, 5.2 * k, 6, C['trunk'], bottom=False)
        sh.ico((x + .5, y, 7.4 * k), 3.8 * k, 0x2c6f32, sub=1, sc=(1.05, 1.05, .8), jitter=.1, seed=int(x) + 40, tcolor=0x3f8a40)
    out.append(sh)

    # --- drying patio ---
    pt = L.Part('patio', ao=0.0)
    cx, cy = 10.0, -5.5
    pt.cbox((cx, cy, 0), (15.0, 10.0, .3), 0xc7b99a, ch=.1, tcolor=0xc7b99a)
    nx, ny = 7, 5
    cols = [0x6b4326, 0xe9dcc0, 0x8a5c36, 0xd8c9a4]
    pt.grid((cx, cy, .31), (14.0, 9.0), nx, ny, 0x6b4326, colorfn=lambda x, y: cols[(int((x + 7) / 2) * 2 + int((y + 4.5) / 1.8)) % 4])
    # rake
    pt.beam((cx - 4.5, cy - 4.0, .6), (cx - 2.0, cy - 2.0, 1.9), .07, C['woodL'], sides=3)
    pt.box((cx - 5.1, cy - 4.5, .31), (1.4, .2, .2), C['woodD'], rz=.6, bottom=False)
    out.append(pt)

    # --- thatched hut ---
    hb = L.Part('hut', ao=0.0)
    hx, hy = 12.0, 10.5
    hb.box((hx, hy, 0), (7.0, 5.4, .45), 0xb0a58c, bottom=False)
    hb.box((hx, hy, .45), (6.0, 4.6, 2.5), 0xf0e0b8, bottom=False, tcolor=0xf0e0b8, colors={'n': 0xe8d8a8, 's': 0xf0e0b8, 'e': 0xe8d8a8, 'w': 0xf0e0b8})
    hb.gable((hx, hy, 2.95), 6.0, 4.6, 2.6, C['thatch'], C['thatchD'], strips=3, overhang=1.0)
    yf = hy - 2.32
    hb.face([(hx - .6, yf, .45), (hx + .6, yf, .45), (hx + .6, yf, 2.4), (hx - .6, yf, 2.4)], C['woodD'], flip_ref=V((hx, hy + 9, 1.5)))
    for wx in (-2.0, 2.0):
        hb.face([(hx + wx - .5, yf, 1.2), (hx + wx + .5, yf, 1.2), (hx + wx + .5, yf, 2.1), (hx + wx - .5, yf, 2.1)], C['teal'], flip_ref=V((hx, hy + 9, 1.5)))
    for dx in (-3.2, 3.2):
        hb.beam((hx + dx, yf - 1.4, .45), (hx + dx, yf - 1.4, 2.9), .12, C['pole'], sides=3)
    out.append(hb)

    # --- sacks ---
    sk = L.Part('sacks', ao=0.0)
    for (x, y, z, rz) in ((6.0, 5.8, 0, .2), (7.4, 6.1, 0, -.15), (6.6, 5.9, 1.2, .1), (9.4, 6.4, 0, .5), (3.2, 2.0, 0, 0.0)):
        sk.cbox((x, y, z), (1.2, .95, 1.2), BURLAP, ch=.28, rz=rz, tcolor=0xe0c48c)
    out.append(sk)
    return scale_parts(out, .95)


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
