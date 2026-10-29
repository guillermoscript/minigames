"""cueva_guacharo: green hillside with a dark arched cave mouth (rock facade, black tunnel), stone path with steps, tropical trees and 5 oilbirds 'guacharos' above the entrance. Cave faces -Y."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'cueva_guacharo'
GROUND = 0x7fae58
GROUND_Z = -0.5
PREVIEW = dict(az=0, pitch=70, fit=1.0)
AO_DIST = 14.0
ROCK, ROCKD, ROCKL = 0x8d877c, 0x6a655c, 0xa8a193
FY = -4.0          # facade front plane y
BLACK = 0x15110f
AX, ZS, AR = 5.5, 2.5, 5.5   # arch half-width, spring height, radius


def arch_pts(n=7, r=AR, y=FY, cz=ZS):
    return [(r * math.cos(math.pi * k / n), y, cz + r * math.sin(math.pi * k / n)) for k in range(n + 1)]   # theta 0..pi : right -> left


def build(L):
    P = L.P
    V = lib.Vector
    rng = random.Random(4)
    # hillside
    h = L.Part('colina', ao=0.0)
    N = 16
    def hr(sx, sy, z, ph):
        out = []
        for i in range(N):
            a = 2 * math.pi * i / N
            k = 1 + .08 * math.sin(3 * a + ph)
            out.append((sx * k * math.cos(a), 28 + sy * k * math.sin(a), z))
        return out
    rings = [hr(40, 24, -1, 0), hr(35, 20, 6, .6), hr(27, 15, 14, 1.2), hr(16, 9, 20, 1.8), hr(6, 4, 23, 2.4)]
    cols = [P['selva'], P['selvaL'], P['selva2'], P['selva']]
    for k in range(4):
        cc = [[P['selva2'], P['selva']], [P['selva'], P['selvaL']], [P['selvaL'], P['selva']], [0x57a04a, P['selvaL']]][k]
        h.loft([rings[k], rings[k + 1]], P['selva'], colors=cc, ref=V((0, 28, 8)))
    h.face(rings[-1], 0x57a04a, up=True)
    # rock facade with arch opening
    f = L.Part('fachada_cueva', ao=0.0)
    D = 8.0
    FW, FH = 17.0, 13.0
    for sx in (-1, 1):
        f.cbox((sx * (AX + (FW - AX) / 2), FY + D / 2, 0), (FW - AX, D, FH - 2), ROCK if sx < 0 else ROCKL, ch=.7, tcolor=ROCKL)
    top_h = FH - 2 - (ZS + AR)
    f.cbox((0, FY + D / 2, ZS + AR), (2 * AX + .2, D, top_h + 0.5), ROCKD, ch=.5, tcolor=ROCKL)
    # spandrels (front face) closing the corner between the rect top block and the arc
    for sx in (-1, 1):
        pts = [(sx * AX, FY - .02, ZS), (sx * AX, FY - .02, ZS + AR), (0, FY - .02, ZS + AR)]
        for k in range(4, 0, -1):
            th = math.pi / 2 * k / 4
            pts.append((sx * AR * math.cos(th), FY - .02, ZS + AR * math.sin(th)))
        f.face(pts, ROCKD, flip_ref=V((0, FY + 40, ZS)))
    # arch frame (thick lip)
    fr = L.Part('boca_marco', ao=0.0)
    out = [(1.22 * x, y - .6, ZS + (z - ZS) * 1.22) for (x, y, z) in arch_pts()]
    inn = arch_pts()
    fr.loft([out, inn], ROCKL, closed=False, ref=V((0, FY + 30, ZS)))
    # tunnel interior (black)
    t = L.Part('tunel', ao=0.0)
    y_back = FY + 7.5
    ring_f = arch_pts(y=FY) + [(-AR, FY, 0.0), (AR, FY, 0.0)][:2]
    ring_b = arch_pts(y=y_back) + [(-AR, y_back, 0.0), (AR, y_back, 0.0)][:2]
    for i in range(len(ring_f)):
        j = (i + 1) % len(ring_f)
        c = V(ring_f[i]) + V(ring_f[j]) + V(ring_b[i]) + V(ring_b[j])
        c /= 4
        axis = V((0, c.y, ZS))
        t.face([ring_f[i], ring_f[j], ring_b[j], ring_b[i]], BLACK, shade=.35, flip_ref=c + (c - axis) * 3)
    t.face([(AR, y_back, 0), (-AR, y_back, 0)] + list(reversed(arch_pts(y=y_back))), BLACK, shade=.25, flip_ref=V((0, y_back - 30, 3)))
    t.face([(AR, FY, .02), (-AR, FY, .02), (-AR, y_back, .02), (AR, y_back, .02)], 0x2a231d, shade=.4, up=True)
    # stone path: 3 steps + winding slabs
    pa = L.Part('camino_piedra', ao=0.0)
    for k in range(2):
        pa.cbox((0, FY - 2.6 - k * 2.0, 0), (13 - k * 1.8, 2.0, 1.0 - k * .5), 0xb8b0a0, ch=.25, tcolor=0xd0c8b6)
    for k in range(7):
        y = FY - 7.5 - k * 3.3
        x = 4.5 * math.sin(k * .9)
        pa.cbox((x, y, 0), (5.2 - k * .2, 3.0, .45), 0xc2baa8 if k % 2 else 0xb0a898, ch=.12, tcolor=0xd8d0be, rz=.25 * math.sin(k))
    # trees
    tr = L.Part('arboles', ao=0.0)
    spots = [(-24, 8, 1.2), (-21, 22, 1.1), (23, 10, 1.3), (26, 25, 1.0), (-9, 36, .9), (10, 37, 1.0), (-29, -4, 1.0), (30, -6, 1.1), (-17, -12, .9), (19, -14, 1.0)]
    for (x, y, s) in spots:
        z0 = 0.0
        # lift trees that stand on the hill flank
        d = ((x / 34.0) ** 2 + ((y - 28) / 22.0) ** 2) ** .5
        if d < 1:
            z0 = 9 * (1 - d) ** .8
        hh = 6.0 * s
        tr.frustum((x, y, z0), .8 * s, .55 * s, hh, 5, 0x6e4a2a, bottom=False, top=False)
        tr.ico((x, y, z0 + hh + 1.8 * s), 3.5 * s, P['selva2'] if (x + y) % 2 else P['selva'], sub=0, sc=(1.1, 1.1, 1.0), jitter=.15, seed=int(x * 3 + y), tcolor=P['selvaL'])
        tr.ico((x + 1.4 * s, y + .8, z0 + hh + 3.6 * s), 2.4 * s, P['selvaL'], sub=0, sc=(1, 1, .9), jitter=.15, seed=int(x + y * 3), tcolor=0x5fae50)
    # birds
    g = L.Part('guacharos', ao=0.0)
    BR = 0x7a5238
    for (x, y, z, ph) in ((-9.0, FY - 2.0, 21.0, 0), (-4.5, FY - 3.0, 25.0, 1), (0.5, FY - 2.0, 27.5, 2), (5.5, FY - 3.0, 24.5, 3), (10.0, FY - 2.0, 21.0, 1)):
        g.ico((x, y, z), 1.3, BR, sub=0, sc=(1.0, 1.7, .8), jitter=.05, seed=ph, tcolor=0xa07a54)
        up = 1.2 if ph % 2 else -.3
        for sx in (-1, 1):
            g.face([(x + sx * .5, y + 1.0, z), (x + sx * .5, y - 1.2, z), (x + sx * 4.6, y - .2, z + up)], 0x5a3a28 if sx < 0 else 0x6b472f, flip_ref=V((x, y, z - 5)) if False else V((x + sx * 2, y, z - 3)))
            g.face([(x + sx * .5, y + 1.0, z), (x + sx * .5, y - 1.2, z), (x + sx * 4.6, y - .2, z + up)], 0x5a3a28 if sx < 0 else 0x6b472f, flip_ref=V((x + sx * 2, y, z + 3)))
        g.face([(x - .35, y + 1.6, z), (x + .35, y + 1.6, z), (x, y + 2.9, z + .1)], 0x5a3a28, up=True)
    return [h, f, fr, t, pa, tr, g]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
