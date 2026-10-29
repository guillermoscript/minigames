"""tokens: three 3D chibi player tokens (token_tu, token_mama, token_abuela), ~16 units tall, feet at z=0, facing -Y (south, toward the camera)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'tokens'
GROUND = 0xf1e6c4
PREVIEW = dict(az=0, pitch=62, fit=0.8)
AO_DIST = 5.0


def person(p, skin, shirt, pants, shoes, hair, acc):
    # legs + shoes
    for sx in (-1.15, 1.15):
        p.frustum((sx, 0, .9), .95, .85, 3.2, 8, pants, bottom=False)
        p.cbox((sx, -.5, 0), (2.1, 3.0, 1.1), shoes, ch=.35)
    # torso (rounded barrel) + arms
    p.frustum((0, 0, 3.9), 2.7, 2.35, 4.4, 10, shirt, tcolor=shirt, bottom=True)
    p.ico((0, 0, 8.2), 2.4, shirt, sub=1, sc=(1, .85, .45), cut_below=8.2)
    for sx in (-1, 1):
        p.beam((sx * 2.6, 0, 7.6), (sx * 3.6, -.4, 4.9), .55, shirt, sides=5)
        p.ico((sx * 3.7, -.45, 4.6), .75, skin, sub=0)
    # head
    p.ico((0, 0, 11.6), 3.9, skin, sub=2, sc=(1, .96, .94), jitter=.0)
    # face (front = -Y): eyes, cheeks, mouth
    for sx in (-1.35, 1.35):
        p.ico((sx, -3.55, 11.9), .5, 0x1c1410, sub=0, sc=(.8, .5, 1.1))
        p.ico((sx * 1.55, -3.3, 10.9), .5, 0xf08a7a, sub=0, sc=(1, .4, .7))
    p.box((0, -3.72, 10.7), (1.0, .2, .3), 0x8a3a2a, bottom=False)
    acc(p)


def acc_tu(p):
    H = 0x5a3a22
    p.ico((0, .4, 13.2), 3.9, H, sub=2, sc=(1.02, .98, .62), cut_below=12.3)
    for sx in (-1, 1):
        p.ico((sx * 2.7, .5, 15.0), 1.45, H, sub=1)                              # buns
        p.cbox((sx * 4.1, -.2, 10.6), (1.3, 2.4, 2.4), 0xffffff, ch=.3)           # headphone cups
        p.cbox((sx * 4.2, -.2, 10.9), (.5, 1.6, 1.6), 0xf2c230, ch=.15)
    p.beam((-4.0, 0, 12.4), (-1.5, 0, 15.1), .4, 0xffffff, sides=4)
    p.beam((4.0, 0, 12.4), (1.5, 0, 15.1), .4, 0xffffff, sides=4)
    p.beam((-1.5, 0, 15.1), (1.5, 0, 15.1), .4, 0xffffff, sides=4)
    p.ico((0, -2.7, 6.9), .8, 0xf2c230, sub=0, sc=(1, .4, 1))                    # star on the hoodie


def acc_mama(p):
    H = 0x1c1612
    p.ico((0, .5, 13.0), 4.2, H, sub=2, sc=(1.06, 1.0, .75), cut_below=11.9, jitter=.08, seed=3)
    for (x, y, z) in ((-3.3, .2, 12.0), (3.3, .2, 12.0), (-2.2, 1.7, 14.3), (2.2, 1.7, 14.3), (0, 2.0, 14.8)):
        p.ico((x, y, z), 1.35, H, sub=1, jitter=.1, seed=int(abs(x) * 7 + z))   # curls
    p.cbox((0, -2.5, 6.4), (3.2, .5, .5), 0xf2c230, ch=.1)                      # necklace


def acc_abuela(p):
    H = 0xd7d7e0
    p.ico((0, .5, 13.0), 4.0, H, sub=2, sc=(1.0, .98, .6), cut_below=12.2)
    p.ico((0, 1.8, 15.0), 1.9, H, sub=1)                                         # bun
    for sx in (-1.4, 1.4):
        p.frustum((sx, -3.65, 11.9), .95, .95, .3, 10, 0xe8b6cf, rz=0, bottom=False, top=False)
    p.beam((-1.4, -3.7, 11.9), (1.4, -3.7, 11.9), .15, 0xe8b6cf, sides=3)
    p.cbox((0, -2.4, 6.2), (5.4, .5, 1.0), 0xfff2c8, ch=.15)                     # cardigan trim


def build(L):
    out = []
    for i, (nm, args) in enumerate((('token_tu', (0xf1c9a0, 0x3f78e0, 0x2a3a8a, 0xffffff, 0x5a3a22, acc_tu)),
                                   ('token_mama', (0xc98a5e, 0x2fb8a8, 0x2a2a3a, 0xf2f2f2, 0x1c1612, acc_mama)),
                                   ('token_abuela', (0xf1c9a0, 0xf08ab0, 0xe6dcc0, 0x7a5a4a, 0xd7d7e0, acc_abuela)))):
        p = L.Part(nm, loc=(i * 12 - 12, 0, 0), ao=0.0)
        person(p, *args)
        out.append(p)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
