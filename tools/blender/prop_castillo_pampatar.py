"""castillo_pampatar: Castillo San Carlos Borromeo (Pampatar). 8-point star fort, white walls with crenellations, four corner
watchtowers, central keep with Venezuelan flag, cannons, on a rocky base in the sea. Origin = centre; sea z=0; entrance faces south."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from prop_palmas_coco import C, scale_parts

NAME = 'castillo_pampatar'
GROUND = 0x2f9fcc
PREVIEW = dict(az=0, pitch=66, fit=0.95)
AO_DIST = 10.0
V = lib.Vector
STONE = 0xc8bda2
WALL = 0xf3eddd
ROOF = 0xb8553a


def build(L):
    out = []
    N = 8
    RO, RI = 16.0, 11.2
    ZB, Z0, Z1, ZF = 3.2, 2.8, 6.4, 3.8          # rock top, wall base, wall top, courtyard floor
    # star with 8 tips -> 16 vertices
    M = 16
    outer = []
    for i in range(M):
        r = RO if i % 2 == 0 else RI
        a = -math.pi / 2 + 2 * math.pi * i / M
        outer.append((r * math.cos(a), r * math.sin(a)))
    k_in = 0.78
    inner = [(x * k_in, y * k_in) for x, y in outer]

    # --- rocky sea base ---
    rk = L.Part('rock_base', ao=0.0)
    rng = random.Random(7)
    ks = [1 + (rng.random() - .5) * .16 for _ in range(M)]
    def rring(rad, z, sc=1.0):
        res = []
        for i in range(M):
            a = -math.pi / 2 + 2 * math.pi * (i + .5) / M
            r = rad * ks[i] * sc
            res.append((r * math.cos(a), r * math.sin(a), z))
        return res
    rings = [rring(21.0, 0.0), rring(19.5, 1.5, .98), rring(17.8, ZB)]
    rk.loft(rings, C['rock'], colors=[C['rock'], C['rockD'], C['rock'], C['rockD']], caps=(False, True), ref=V((0, 0, 1.5)))
    for i in range(10):
        a = 2 * math.pi * i / 10 + .2
        rr = 22.0 + (i % 3) * 1.1
        rk.ico((rr * math.cos(a), rr * math.sin(a), .5), 1.6 + (i % 2) * .8, C['rock'], sub=0, sc=(1, 1, .8), jitter=.15, seed=i + 2, tcolor=C['rockD'])
    # entrance steps (south)
    rk.cbox((0, -19.0, 0), (4.0, 3.0, 2.2), STONE, ch=.3, tcolor=C['sand'])
    out.append(rk)

    # --- curtain wall (star ring) ---
    w = L.Part('walls', ao=0.0)
    cen = V((0, 0, (Z0 + Z1) / 2))
    for i in range(M):
        j = (i + 1) % M
        a, b, ai, bi = outer[i], outer[j], inner[i], inner[j]
        w.face([(a[0], a[1], Z0), (b[0], b[1], Z0), (b[0], b[1], Z1), (a[0], a[1], Z1)], WALL if i % 2 == 0 else STONE, flip_ref=cen)
        w.face([(a[0], a[1], Z1), (b[0], b[1], Z1), (bi[0], bi[1], Z1), (ai[0], ai[1], Z1)], C['sand'], up=True)
        far = V(((a[0] + b[0]) * 1.5, (a[1] + b[1]) * 1.5, ZF))
        w.face([(ai[0], ai[1], Z1), (bi[0], bi[1], Z1), (bi[0], bi[1], ZF), (ai[0], ai[1], ZF)], STONE, flip_ref=far, shade=.78)
        w.face([(0, 0, ZF), (ai[0], ai[1], ZF), (bi[0], bi[1], ZF)], 0xf0e4bc if i % 2 else 0xf6ecc8, up=True, shade=.9)
    # crenellations: 2 merlons per outer edge
    for i in range(M):
        j = (i + 1) % M
        a, b = outer[i], outer[j]
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        for t in (.3, .7):
            px, py = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            # nudge inward so merlons sit on the wall top
            w.box((px * .965, py * .965, Z1), (1.5, .8, .95), WALL, rz=ang, bottom=False, tcolor=C['white'])
    # gate in the south wall
    w.box((0, -RI * .985 - 0.0, Z0), (2.2, .6, 2.6), C['woodD'], bottom=False, top=False)
    out.append(w)

    # --- corner watchtowers on four star tips (N,E,S,W-ish) ---
    tw = L.Part('towers', ao=0.0)
    for i in (0, 4, 8, 12):
        x, y = outer[i]
        x, y = x * .93, y * .93
        tw.frustum((x, y, Z0), 1.9, 1.6, 5.6, 8, WALL, ring_colors=[WALL, 0xe8e0c8], tcolor=STONE)
        tw.frustum((x, y, Z0 + 5.6), 2.25, 2.0, .7, 8, STONE, tcolor=STONE)
        for k in range(4):
            a = math.pi / 4 * k * 2 + .39
            tw.box((x + 1.75 * math.cos(a), y + 1.75 * math.sin(a), Z0 + 6.3), (.7, .7, .75), WALL, rz=a, bottom=False)
        tw.frustum((x, y, Z0 + 6.3), 1.2, 0, 1.7, 8, ROOF, bottom=False, ring_colors=[ROOF, 0xd06c4a])
    out.append(tw)

    # --- central keep + flag ---
    kp = L.Part('keep', ao=0.0)
    kp.cbox((0, 0, ZF), (8.0, 8.0, 5.8), WALL, ch=.3, tcolor=STONE, colors=[WALL, 0xe8e0c8, WALL, 0xe8e0c8])
    for sx in (-1, 1):
        for sy in (-1, 1):
            kp.box((sx * 3.3, sy * 3.3, ZF + 5.8), (1.4, 1.4, 1.0), WALL, bottom=False, tcolor=C['white'])
    for (x, y) in ((0, -3.3), (0, 3.3), (-3.3, 0), (3.3, 0)):
        kp.box((x, y, ZF + 5.8), (1.4, 1.4, 1.0), WALL, bottom=False, tcolor=C['white'])
    kp.box((0, -4.02, ZF), (2.0, .3, 3.0), C['woodD'], bottom=False, top=False)
    for x in (-2.4, 2.4):
        kp.box((x, -4.02, ZF + 2.5), (1.1, .3, 1.6), C['glass'], bottom=False, top=False)
    kp.beam((0, 0, ZF + 5.8), (0, 0, ZF + 11.5), .16, C['white'], sides=4)
    fz = ZF + 11.5
    for k, c in enumerate((C['yellow'], 0x2f5fb0, C['red'])):
        z1, z0 = fz - k * .75, fz - (k + 1) * .75
        kp.face([(.1, -.08, z0), (2.9, -.08 - .25, z0 + .05), (2.9, -.33, z1 + .05), (.1, -.08, z1)], c, flip_ref=V((0, 8, z0)))
    out.append(kp)

    # --- cannons on the bastion tips ---
    cn = L.Part('cannons', ao=0.0)
    for i in (2, 6, 10, 14, 1, 9):
        x, y = outer[i]
        a = math.atan2(y, x)
        cx, cy = x * .9, y * .9
        d = (math.cos(a), math.sin(a))
        cn.beam((cx - d[0] * .6, cy - d[1] * .6, Z1 + .6), (cx + d[0] * 1.4, cy + d[1] * 1.4, Z1 + .85), .3, C['steel'], sides=5)
        cn.box((cx - .5, cy - .45, Z1), (1.0, .9, .5), C['woodL'], rz=a, bottom=False)
    out.append(cn)
    return scale_parts(out, 0.84)


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
