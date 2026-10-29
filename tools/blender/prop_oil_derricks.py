"""oil_derricks: three lattice rigs on stilts with quarters, helipad, tank, crane and flare, joined by railed walkways. Origin = water line; legs reach z=-5."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'oil_derricks'
GROUND = 0x2f78d0
PREVIEW = dict(az=0, pitch=70, fit=1.0)
AO_DIST = 10.0


def rig(p, x, y, P, h=19.0, heli=False):
    S, SL, CD = P['steel'], P['steelL'], P['concD']
    p.cbox((x, y, 3.4), (9, 9, 1.0), CD, ch=.18, tcolor=0xb4bac4)
    for (ox, oy) in ((-3.4, -3.4), (3.4, -3.4), (-3.4, 3.4), (3.4, 3.4)):
        p.frustum((x + ox, y + oy, -5), .85, .7, 8.4, 4, S, rz=math.pi / 4, top=False, bottom=False)
    for z in (0.2, 2.2):                      # underdeck bracing
        for (a, b) in (((-3.4, -3.4), (3.4, -3.4)), ((3.4, -3.4), (3.4, 3.4)), ((3.4, 3.4), (-3.4, 3.4)), ((-3.4, 3.4), (-3.4, -3.4))):
            p.beam((x + a[0], y + a[1], z), (x + b[0], y + b[1], z + 2.0), .14, SL, sides=3)
    # lattice derrick: four corner legs, square belts, diagonals
    zb = 4.4
    levels = [(zb, 2.7), (9.0, 1.9), (13.4, 1.3), (h, .75)]
    for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        for k in range(len(levels) - 1):
            (za, ra), (zc, rc) = levels[k], levels[k + 1]
            p.beam((x + sx * ra, y + sy * ra, za), (x + sx * rc, y + sy * rc, zc), .3, S, sides=4)
    for (za, ra) in levels[1:]:
        for (a, b) in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
            p.beam((x + a[0] * ra, y + a[1] * ra, za), (x + b[0] * ra, y + b[1] * ra, za), .16, SL, sides=3)
    for k in range(len(levels) - 1):          # X-braces on the two camera-facing sides
        (za, ra), (zc, rc) = levels[k], levels[k + 1]
        p.beam((x - ra, y - ra, za), (x + rc, y - rc, zc), .12, SL, sides=3)
        p.beam((x + ra, y - ra, za), (x - rc, y - rc, zc), .12, SL, sides=3)
    p.cbox((x, y, h), (2.0, 2.0, 1.5), S, ch=.25, tcolor=SL)
    # deck equipment
    p.cbox((x + 2.2, y - 2.6, 4.4), (4.0, 3.0, 2.8), P['white'], ch=.3, tcolor=P['band'])        # quarters
    p.box((x + 2.2, y - 4.15, 5.2), (2.4, .1, .9), P['glassL'], bottom=False, top=False)
    p.frustum((x - 2.8, y + 2.6, 4.4), 1.3, 1.3, 2.4, 8, P['red'], tcolor=P['redD'], bottom=False)  # tank
    if heli:
        p.beam((x - 3.3, y - 3.3, 4.4), (x - 5.6, y - 5.6, 6.0), .22, S, sides=3)
        p.disc((x - 6.0, y - 6.0, 6.1), 3.0, P['asphalt'], rings=1, segs=10)
        p.frustum((x - 6.0, y - 6.0, 5.8), 3.1, 3.1, .3, 10, CD, top=False, bottom=False)
        p.disc((x - 6.0, y - 6.0, 6.14), 1.5, P['road'], rings=1, segs=8)
    else:
        p.beam((x - 1.5, y + 2.0, 4.4), (x - 1.5, y + 2.0, 10.4), .3, P['redD'], sides=4)         # crane
        p.beam((x - 1.5, y + 2.0, 10.4), (x + 5.2, y + 4.8, 7.4), .2, P['redD'], sides=3)
    p.beam((x + 1.0, y + 1.0, h + .6), (x + 6.8, y + 6.8, h - 2.2), .2, SL, sides=3)               # flare boom
    p.frustum((x + 6.8, y + 6.8, h - 2.2), 1.0, 0, 3.0, 5, P['flame'], bottom=False)


def build(L):
    P = L.P
    p = L.Part('rigs', ao=0.0)
    spots = ((-14, 4), (3, -7), (16, 8))
    for k, (x, y) in enumerate(spots):
        rig(p, x, y, P, heli=(k == 1))
    for (a, b) in ((spots[0], spots[1]), (spots[1], spots[2])):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        ln = math.hypot(b[0] - a[0], b[1] - a[1]) - 9
        p.box((mx, my, 3.6), (ln, 2.0, .35), P['concD'], rz=ang, bottom=False)
        for sy in (-.95, .95):
            ox, oy = -math.sin(ang) * sy, math.cos(ang) * sy
            p.beam((mx - math.cos(ang) * ln / 2 + ox, my - math.sin(ang) * ln / 2 + oy, 4.6), (mx + math.cos(ang) * ln / 2 + ox, my + math.sin(ang) * ln / 2 + oy, 4.6), .1, P['steelL'], sides=3)
    return [p]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
