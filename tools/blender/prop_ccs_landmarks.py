"""ccs_landmarks: hero Caracas landmark buildings for LA FIESTA. Each Part = one building, origin = base centre (bases buried 0.5), front = -Y."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'ccs_landmarks'
GROUND = 0x7d9f50
PREVIEW = dict(az=0, pitch=62, fit=0.9, size=1600)
AO_DIST = 14

V = lib.Vector
INFO = {}


def reg(name, w, d, h):
    INFO[name] = (w, d, h)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def wall(p, a, b, z0, z1, col, ref):
    p.face([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], col, flip_ref=ref)


def sides_of(cx, cy, w, d):
    h2, d2 = w / 2, d / 2
    return {'s': ((cx - h2, cy - d2), (cx + h2, cy - d2)), 'e': ((cx + h2, cy - d2), (cx + h2, cy + d2)),
            'n': ((cx + h2, cy + d2), (cx - h2, cy + d2)), 'w': ((cx - h2, cy + d2), (cx - h2, cy - d2))}


def roofcap(p, cx, cy, w, d, z, col):
    p.face([(cx - w / 2, cy - d / 2, z), (cx + w / 2, cy - d / 2, z), (cx + w / 2, cy + d / 2, z), (cx - w / 2, cy + d / 2, z)], col, up=True)


def hfacade(p, cx, cy, w, d, z0, z1, fh, slab, glass, sides='sew', gf=0.58, roof=0xa9aeb8, back=None):
    """Horizontal window bands (slab / glass per floor)."""
    ref = V((cx, cy, (z0 + z1) / 2))
    nf = max(1, round((z1 - z0) / fh))
    f = (z1 - z0) / nf
    for sd, (a, b) in sides_of(cx, cy, w, d).items():
        if sd in sides:
            for k in range(nf):
                za = z0 + k * f
                zs = za + f * (1 - gf)
                wall(p, a, b, za, zs, slab, ref)
                wall(p, a, b, zs, za + f, glass(k) if callable(glass) else glass, ref)
        else:
            wall(p, a, b, z0, z1, back if back is not None else slab, ref)
    if roof is not None:
        roofcap(p, cx, cy, w, d, z1, roof)


def vfacade(p, cx, cy, w, d, z0, z1, nw, nd, glass, mull, sides='sew', back=None, roof=0xa9aeb8, mf=0.3):
    """Vertical window stripes (glass columns between mullions)."""
    ref = V((cx, cy, (z0 + z1) / 2))
    for sd, (a, b) in sides_of(cx, cy, w, d).items():
        if sd in sides:
            n = nw if sd in 'sn' else nd
            for k in range(n):
                t0, t1 = k / n, (k + 1) / n
                tm = t0 + (1 - mf) / n
                g = glass(k) if callable(glass) else glass
                wall(p, lerp(a, b, t0), lerp(a, b, tm), z0, z1, g, ref)
                wall(p, lerp(a, b, tm), lerp(a, b, t1), z0, z1, mull, ref)
        else:
            wall(p, a, b, z0, z1, back if back is not None else mull, ref)
    if roof is not None:
        roofcap(p, cx, cy, w, d, z1, roof)


def pilasters(p, cx, cy, w, d, z0, z1, s, col, front_only=True):
    for sx in (-1, 1):
        for sy in ((-1,) if front_only else (-1, 1)):
            p.box((cx + sx * w / 2, cy + sy * d / 2, z0), (s, s, z1 - z0), col, bottom=False)


def antenna(p, x, y, z, h, col=0xd92a2a, w=0.22):
    p.beam((x, y, z), (x, y, z + h), w, 0xf2f4f8, 4)
    p.beam((x, y, z + h * .72), (x, y, z + h), w * 1.05, col, 4)


def tank(p, c, r, h, color=0x3f6aa0, lid=0x8a93a3):
    p.frustum(c, r, r * .92, h, 8, color, tcolor=lid, bottom=False)


def hvac(p, x, y, z, w=2.2, d=1.8, h=1.2, c1=0xb9bfc9, c2=0x5a606c):
    p.cbox((x, y, z), (w, d, h), c1, ch=.2)
    p.box((x + w * .25, y - d * .52, z + h * .25), (w * .4, .12, h * .5), c2, bottom=False, top=False)


def arc_pts(x, y0, y1, z, rise, n):
    return [(x, y0 + (y1 - y0) * i / (n - 1), z + rise * math.sin(math.pi * i / (n - 1))) for i in range(n)]


def vault(p, x0, x1, y0, y1, z, rise, n, nseg, cols, endcol):
    """Barrel vault along X with an arch section in YZ; banded colours along X."""
    xs = [x0 + (x1 - x0) * k / nseg for k in range(nseg + 1)]
    ref = V(((x0 + x1) / 2, (y0 + y1) / 2, z - 6))
    for k in range(nseg):
        p.loft([arc_pts(xs[k], y0, y1, z, rise, n), arc_pts(xs[k + 1], y0, y1, z, rise, n)], cols[k % len(cols)], closed=False, ref=ref)
    for x in (x0, x1):
        p.face(arc_pts(x, y0, y1, z, rise, n), endcol, flip_ref=V(((x0 + x1) / 2, (y0 + y1) / 2, z + rise * .3)))


def dome(p, c, r, hz, n, rings, cols, base_ring=None):
    cx, cy, cz = c
    rs = []
    for k in range(rings + 1):
        a = (math.pi / 2) * k / rings
        rr = max(r * math.cos(a), 0.001)
        zz = cz + hz * math.sin(a)
        rs.append([(cx + rr * math.cos(2 * math.pi * i / n), cy + rr * math.sin(2 * math.pi * i / n), zz) for i in range(n)])
    p.loft(rs, cols[0], closed=True, colors=cols, ref=V((cx, cy, cz - 1)))


def cars(p, x, y, z, n, dx=2.2):
    cc = [0xd92a2a, 0xf2f4f8, 0x3f6aa0, 0xd8b45a, 0x30343c]
    for i in range(n):
        p.cbox((x + i * dx, y, z), (1.5, 0.9, 0.55), cc[i % len(cc)], ch=.15)


def palm(p, x, y, z, h=5.0):
    p.beam((x, y, z), (x + .3, y, z + h), .17, 0x7a5230, 4)
    for k in range(5):
        a = 2 * math.pi * k / 5
        p.face([(x + .3, y, z + h), (x + .3 + 1.9 * math.cos(a) - .35 * math.sin(a), y + 1.9 * math.sin(a) + .35 * math.cos(a), z + h - .8),
                (x + .3 + 1.9 * math.cos(a) + .35 * math.sin(a), y + 1.9 * math.sin(a) - .35 * math.cos(a), z + h - .8)], 0x3f8a40 if k % 2 else 0x2c6f32, up=True)


# ───────────────────────────── Parque Central towers ─────────────────────────────
def pc_tower(p, H, shaft_top, antenna_on, variant):
    P = p
    CH, CHL, CONC, CONCL = 0x353a45, 0x49505e, 0x8a93a3, 0xb4bac4
    # podium + entrance
    p.cbox((0, 0, -0.5), (15, 15, 4.5), 0x8a93a3, ch=.6, tcolor=CONCL)
    p.cbox((0, -7.8, 0.2), (9, 2.6, 1.2), 0xcfd6e2, ch=.25)
    for sx in (-1, 1):
        p.box((sx * 6.6, -6.9, 4.0), (1.6, 1.6, 1.5), CONC, bottom=False)
    # shaft: dark glass stripes + concrete mullions
    vfacade(p, 0, 0, 9, 9, 4, shaft_top, 5, 5, lambda k: CH if k % 2 == 0 else CHL, CONCL, roof=0xa9aeb8, mf=.22)
    pilasters(p, 0, 0, 9, 9, 4, shaft_top, .95, CONC, front_only=False)
    for z in (4 + (shaft_top - 4) * .34, 4 + (shaft_top - 4) * .67):
        p.cbox((0, 0, z), (9.8, 9.8, .9), CONCL, ch=.25)
    p.cbox((0, 0, shaft_top - .4), (9.8, 9.8, .9), CONCL, ch=.25)
    # setbacks
    s2 = shaft_top + 7
    vfacade(p, 0, 0, 7.6, 7.6, shaft_top + .5, s2, 4, 4, lambda k: CH if k % 2 == 0 else CHL, CONCL, roof=0xa9aeb8, mf=.22)
    s3 = s2 + 4
    vfacade(p, 0, 0, 6, 6, s2, s3, 3, 3, lambda k: CHL if k % 2 == 0 else CH, CONCL, roof=0xa9aeb8, mf=.25)
    p.cbox((0, 0, s3 - .2), (7.2, 7.2, 1.3), CONCL, ch=.3)
    top = s3 + 1.1
    if variant == 'a':
        p.cbox((0, 0, top), (4.4, 4.4, 3.2), CONC, ch=.3)
        p.box((0, -2.25, top + .8), (3.4, .1, 1.3), CH, bottom=False)
        tank(p, (1.4, 1.2, top + 3.2), 1.0, 1.2)
        antenna(p, -.9, .8, top + 3.2, H - (top + 3.2), w=.22)
        p.beam((-2.1, .8, top + 5.0), (.3, .8, top + 5.0), .09, CONC, 3)
    else:
        p.cbox((-1.2, 0, top), (3.4, 4.6, 2.4), CONC, ch=.3)
        p.box((-1.2, -2.35, top + .6), (2.6, .1, 1.0), CH, bottom=False)
        tank(p, (2.0, 1.6, top), 1.3, 2.2)
        p.frustum((2.0, -1.4, top), 1.1, 1.1, .3, 8, 0xe9ecf2, tcolor=0xd92a2a)   # helipad-style roundel
        for sx in (-1, 1):
            p.beam((sx * 3.2, -3.2, top), (sx * 3.2, -3.2, top + 1.4), .07, 0xcfd6e2, 3)
    return top


# ───────────────────────────── builders ─────────────────────────────
def build(L):
    P = L.P
    out = []
    X = 70.0

    def part(name, col, row):
        p = L.Part(name, loc=(col * X, -row * X, 0), ao_h=3.0, ao=0.22)
        out.append(p)
        return p

    # ============ torre_pc_a ============
    p = part('torre_pc_a', 0, 0)
    pc_tower(p, 78, 56, True, 'a')
    reg('torre_pc_a', 15, 15, 78)

    # ============ torre_pc_b ============
    p = part('torre_pc_b', 1, 0)
    pc_tower(p, 72, 58, False, 'b')
    reg('torre_pc_b', 15, 15, 72)

    # ============ torre_telefonica ============
    p = part('torre_telefonica', 2, 0)
    CONC, CONCL = 0x8a93a3, 0xcfd6e2
    p.cbox((0, 0, -0.5), (8.4, 8.4, 6.5), 0xd9d4c4, ch=.5, tcolor=CONCL)
    vfacade(p, 0, 0, 8.4, 8.4, 0.4, 5.2, 4, 4, 0x5f8fc8, 0xf2f4f8, roof=None, mf=.3)
    p.box((0, -4.6, 0.2), (3.2, 1.2, 1.4), 0x30343c, bottom=False)
    # slender shaft with vertical stripes
    vfacade(p, 0, 0, 3.6, 3.6, 6, 44, 3, 3, lambda k: 0xcfd6e2 if k % 2 else 0xe9ecf2, 0x8a93a3, roof=None, mf=.35)
    for z in (14, 22, 30, 38):
        p.cbox((0, 0, z), (4.4, 4.4, .6), CONCL, ch=.2)
    # round cabin (saucer) with glass ring
    prof = [(2.2, 44), (3.0, 44.2), (4.1, 45.3), (4.3, 47.4), (4.3, 50.2), (3.7, 51.6), (2.0, 52.4)]
    n = 10
    rings = [[(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), z) for i in range(n)] for r, z in prof]
    p.loft(rings, 0xcfd6e2, closed=True, caps=(False, True), ref=V((0, 0, 47)))
    for k in range(len(prof) - 1):
        pass
    # glass band on the cabin (slightly larger ring of dark quads)
    n2 = 10
    for i in range(n2):
        a0, a1 = 2 * math.pi * i / n2, 2 * math.pi * (i + 1) / n2
        if i % 2 == 0:
            ra = 4.34
            p.face([(ra * math.cos(a0), ra * math.sin(a0), 47.4), (ra * math.cos(a1), ra * math.sin(a1), 47.4),
                    (ra * math.cos(a1), ra * math.sin(a1), 50.0), (ra * math.cos(a0), ra * math.sin(a0), 50.0)], 0x2f4f80, flip_ref=V((0, 0, 48.5)))
    p.cbox((0, 0, 52.2), (2.6, 2.6, .8), CONC, ch=.2)
    vfacade(p, 0, 0, 2.2, 2.2, 53, 59, 2, 2, 0xe9ecf2, 0x8a93a3, roof=0x8a93a3, mf=.3)
    # mast: red/white bands + dishes
    zz = 59.0
    for k in range(5):
        p.beam((0, 0, zz), (0, 0, zz + 2.2), .26 - k * .02, 0xd92a2a if k % 2 == 0 else 0xf2f4f8, 4)
        zz += 2.2
    p.beam((0, 0, zz), (0, 0, 70), .1, 0xf2f4f8, 3)
    p.frustum((1.6, 0, 56.5), 1.1, .2, .6, 8, 0xf2f4f8, rz=0, bottom=False)
    p.frustum((-1.6, 0, 55), 1.1, .2, .6, 8, 0xf2f4f8, rz=0, bottom=False)
    reg('torre_telefonica', 8.4, 8.4, 70)

    # ============ torre_oficina_a : glass-blue stepped ============
    p = part('torre_oficina_a', 3, 0)
    p.cbox((0, 0, -0.5), (16, 16, 4.5), 0xcfd6e2, ch=.5, tcolor=0xe6eaf2)
    p.cbox((0, -8.6, .2), (8, 2.4, 1.3), 0x3f6aa0, ch=.25)
    hfacade(p, 0, 0, 14, 14, 4, 28, 3.4, 0xcfd6e2, 0x4d7fb8, gf=.7, roof=0xa9c0d6)
    hfacade(p, 0, 0, 12, 12, 28, 40, 3.4, 0xcfd6e2, 0x5f8fc8, gf=.7, roof=0xa9c0d6)
    hfacade(p, 0, 0, 9.4, 9.4, 40, 52, 3.4, 0xcfd6e2, 0x6fa0d8, gf=.7, roof=0xa9c0d6)
    hfacade(p, 0, 0, 6.4, 6.4, 52, 58, 3.0, 0xe6eaf2, 0x8fc0e8, gf=.7, roof=0xe6eaf2)
    for z, s in ((27.6, 14.8), (39.6, 12.8), (51.6, 10.2)):
        p.cbox((0, 0, z), (s, s, .8), 0xf2f4f8, ch=.25)
    pilasters(p, 0, 0, 14, 14, 4, 28, .9, 0xf2f4f8, front_only=False)
    pilasters(p, 0, 0, 12, 12, 28, 40, .8, 0xf2f4f8, front_only=False)
    p.cbox((0, 0, 58), (5.2, 5.2, 1.0), 0xcfd6e2, ch=.25)
    antenna(p, 0, 0, 59, 6.5)
    hvac(p, 3.4, 2.5, 28.4, 2.4, 2.0, 1.3)
    hvac(p, -3.2, 2.8, 40.4, 2.2, 1.8, 1.2)
    reg('torre_oficina_a', 16, 16, 65.5)

    # ============ torre_oficina_b : white concrete, horizontal bands ============
    p = part('torre_oficina_b', 0, 1)
    p.cbox((0, 0, -0.5), (18, 14, 3.5), 0x8a93a3, ch=.5, tcolor=0xb9bfc9)
    p.box((0, -7.6, 0.2), (7, 1.6, 1.2), 0xc98560, bottom=False)
    for k in range(10):
        z = 3 + k * 4.2
        bw = 16 if k < 8 else 14
        bd = 12 if k < 8 else 10
        p.cbox((0, 0, z), (bw + .6, bd + .6, 1.4), 0xf2f4f8, ch=.28)                 # deep concrete spandrel slab
        wall(p, (-bw / 2 - .1, -bd / 2 - .32), (bw / 2 + .1, -bd / 2 - .32), z + 1.4, z + 4.2 - .02, 0x4d7098 if k % 2 == 0 else 0x5f8fc8, V((0, -10, z + 3)))
    p.box((0, 0, 3), (14.8, 10.8, 42), 0xcfd6e2, bottom=False)                        # core behind the bands
    p.cbox((0, 0, 45), (17, 13, 1.0), 0xf2f4f8, ch=.3)
    p.box((-4, 1, 46), (5, 5, 3), 0xe6dfd0, bottom=False)
    p.box((3.5, 1, 46), (4.5, 4.5, 2), 0xb9bfc9, bottom=False)
    tank(p, (6, -2.5, 46), 1.3, 1.8)
    antenna(p, -4.5, 1.5, 49, 7)
    p.box((7.5, 0, 3), (1.3, 11, 40), 0xe6eaf2, bottom=False)                          # side fin
    reg('torre_oficina_b', 18, 14, 56)

    # ============ torre_oficina_c : terracotta-brown + rooftop sign block ============
    p = part('torre_oficina_c', 1, 1)
    p.cbox((0, 0, -0.5), (15, 15, 4.5), 0x7a5230, ch=.5, tcolor=0xa88a6a)
    p.box((0, -7.9, .2), (6, 1.4, 1.4), 0xe6dfd0, bottom=False)
    hfacade(p, 0, 0, 13, 13, 4, 36, 3.2, 0xb8553a, 0x2f3a4a, gf=.45, roof=0x96432f)
    hfacade(p, 0, 0, 11, 11, 36, 44, 3.2, 0xa04a30, 0x2f3a4a, gf=.45, roof=0x96432f)
    for z in (3.8, 20, 35.6):
        p.cbox((0, 0, z), (13.8, 13.8, .8), 0x96432f, ch=.25)
    pilasters(p, 0, 0, 13, 13, 4, 36, 1.0, 0xe6dfd0, front_only=False)
    p.cbox((0, 0, 43.6), (12, 12, .8), 0xe6dfd0, ch=.25)
    # rooftop sign block
    p.box((0, -1, 44.4), (11, 2.2, 5.2), 0xf2f4f8, bottom=False)
    wall(p, (-5.2, -2.14), (5.2, -2.14), 45.0, 48.8, 0xd92a2a, V((0, 5, 46)))
    for i in range(5):
        wall(p, (-4.4 + i * 2.0, -2.17), (-3.2 + i * 2.0, -2.17), 45.6, 48.2, 0xf2f4f8, V((0, 5, 46)))
    p.box((-5.6, -1, 44.4), (.5, .5, 5.8), 0x30343c, bottom=False)
    p.box((5.6, -1, 44.4), (.5, .5, 5.8), 0x30343c, bottom=False)
    hvac(p, 2.5, 3.2, 44.4, 2.6, 2.0, 1.4)
    tank(p, (-3.5, 3.5, 44.4), 1.3, 2)
    reg('torre_oficina_c', 15, 15, 50.2)

    # ============ hotel_alba ============
    p = part('hotel_alba', 2, 1)
    p.box((0, 3.2, -0.5), (28, 7.6, 3.5), 0xe6dfd0, bottom=False)                      # podium of the slab
    hfacade(p, 0, 3, 28, 8, 3, 34, 3.1, 0xf6f0e0, 0x3f7f8a, gf=.5, roof=0xe6dfd0)
    for k in range(10):
        z = 3 + k * 3.1
        c = (0xd9654a, 0xf6f0e0, 0x3f7f8a)[k % 3]
        p.box((0, -1.75, z), (26, 1.5, .4), c, bottom=False)                                # balcony strips
        wall(p, (-13, -2.5), (13, -2.5), z + .4, z + 1.2, 0xcfd6e2, V((0, 5, z)))      # balcony glass rail
    for sx in (-1, 1):
        p.box((sx * 14.2, 3, 3), (1.6, 8.4, 31), 0xf6f0e0, bottom=False)               # end fins
    p.cbox((0, 3, 33.8), (29, 9, 1.0), 0xcfd6e2, ch=.3)
    p.box((-6, 4, 34.8), (8, 4, 2.4), 0xe6dfd0, bottom=False)
    wall(p, (-10, 1.9), (-2, 1.9), 35.0, 36.6, 0xd92a2a, V((0, 6, 36)))
    p.box((8, 3, 34.8), (3, 3, 1.5), 0xb9bfc9, bottom=False)
    tank(p, (4, 4.5, 34.8), 1.2, 1.6)
    # pool deck
    p.cbox((0, -4.2, -0.5), (28, 5.6, 2.0), 0xd7cfbb, ch=.35, tcolor=0xe6dfd0)
    p.face([(-8.5, -6.6, 1.52), (8.5, -6.6, 1.52), (8.5, -2.4, 1.52), (-8.5, -2.4, 1.52)], 0x56b4e8, up=True)
    p.face([(-8.5, -6.6, 1.55), (8.5, -6.6, 1.55), (8.5, -6.1, 1.55), (-8.5, -6.1, 1.55)], 0x8fd0f0, up=True)
    for x in (-5, -2, 1, 4):
        p.cbox((x, -6.9, 1.5), (1.6, .6, .35), 0xf2f4f8, ch=.1)
    for x, c in ((-11, 0xd9654a), (11, 0xd8b45a)):
        p.beam((x, -4.2, 1.5), (x, -4.2, 3.5), .09, 0xf2f4f8, 3)
        p.frustum((x, -4.2, 3.4), 1.8, .2, .8, 6, c, bottom=False)
    palm(p, -13, -6.3, 1.5, 5.5)
    palm(p, 12.8, -6.5, 1.5, 4.8)
    reg('hotel_alba', 28, 14, 37)

    # ============ iglesia_catedral ============
    p = part('iglesia_catedral', 3, 1)
    CR, WH, TJ, TJD = 0xeadfc8, 0xf6f0e0, 0xb8553a, 0x96432f
    p.cbox((0, 0, -.5), (22, 28, 1.3), 0xd7cfbb, ch=.25, tcolor=0xe6dfd0)
    # nave
    p.box((0, -.2, .8), (10, 21, 12.2), CR, bottom=False, top=False)
    for sd in (-1, 1):
        for k in range(5):
            y = -7.2 + k * 4.2
            p.face([(sd * 5.03, y - .7, 5.0), (sd * 5.03, y + .7, 5.0), (sd * 5.03, y + .7, 9.6), (sd * 5.03, y, 10.6), (sd * 5.03, y - .7, 9.6)], 0x3f6aa0, flip_ref=V((sd * 12, y, 7)))
            if k % 2 == 0:
                p.box((sd * 5.0, y + 2.1, .8), (.5, .8, 12.2), WH, bottom=False)           # buttresses
    p.gable((0, -.2, 13), 21, 10, 4.6, TJ, TJD, rz=math.pi / 2, strips=3, overhang=.5)
    # side aisles
    for sd in (-1, 1):
        p.box((sd * 7.2, -.2, .8), (4.4, 15, 6.2), CR, bottom=False)
        p.face([(sd * 5.0, -7.7, 7), (sd * 9.5, -7.7, 6.4), (sd * 9.5, 7.3, 6.4), (sd * 5.0, 7.3, 7)], TJ, up=True)
    # front facade between the towers
    p.box((0, -10.5, .8), (10.2, 2.6, 16.5), CR, bottom=False)
    p.gable((0, -10.4, 17.3), 2.7, 10.4, 3.2, WH, TJD, rz=math.pi / 2, strips=1, overhang=.25)
    p.box((0, -12, .8), (9, .5, .5), WH)
    # portal, door, rose window, niches
    p.cbox((0, -11.9, .8), (4.6, .7, 7.6), WH, ch=.3)
    wall(p, (-1.4, -12.28), (1.4, -12.28), .8, 5.4, 0x5a3a20, V((0, 5, 3)))
    p.face([(-1.4, -12.28, 5.4), (1.4, -12.28, 5.4), (.9, -12.28, 6.7), (-.9, -12.28, 6.7)], 0x5a3a20, flip_ref=V((0, 5, 6)))
    rose = [(1.7 * math.cos(2 * math.pi * i / 8 + .39), -11.82, 12.0 + 1.7 * math.sin(2 * math.pi * i / 8 + .39)) for i in range(8)]
    p.face(rose, 0x5f8fc8, flip_ref=V((0, 5, 12)))
    p.box((-3.6, -11.9, 9), (.9, .3, 2.2), 0x3f6aa0, bottom=False)
    p.box((3.6, -11.9, 9), (.9, .3, 2.2), 0x3f6aa0, bottom=False)
    for sx in (-1, 1):
        p.box((sx * 3, -11.9, .8), (.7, .6, 8.2), WH, bottom=False)
    # steps
    p.box((0, -13.3, -.3), (9, 2, 1.1), 0xd7cfbb, bottom=False)
    p.box((0, -13.9, -.3), (7.6, 1.2, .55), 0xe6dfd0, bottom=False)
    # bell towers
    for sx in (-1, 1):
        x = sx * 8.2
        p.box((x, -11.4, .8), (5.8, 5.8, 13.2), CR, bottom=False, top=False)
        pilasters(p, x, -11.4, 5.8, 5.8, .8, 14, .8, WH, front_only=False)
        p.cbox((x, -11.4, 12), (6.8, 6.8, .8), WH, ch=.25)
        wall(p, (x - 1.2, -14.33), (x + 1.2, -14.33), 7, 10, 0x3f6aa0, V((x, 0, 8)))
        p.face([(x - 1.2, -14.34, 10), (x + 1.2, -14.34, 10), (x, -14.34, 11.3)], 0x3f6aa0, flip_ref=V((x, 0, 10)))
        # belfry
        p.box((x, -11.4, 12.8), (5.0, 5.0, 5.4), WH, bottom=False)
        for (a, b) in (((x - 1.1, -13.92), (x + 1.1, -13.92)), ((x + 2.52, -12.5), (x + 2.52, -10.3)), ((x - 2.52, -12.5), (x - 2.52, -10.3))):
            sd = 1
            wall(p, a, b, 13.6, 16.6, 0x30343c, V((x, -11.4, 15)))
        p.cbox((x, -11.4, 18.2), (6.0, 6.0, .8), WH, ch=.25)
        p.frustum((x, -11.4, 19), 4.4, .25, 6.0, 4, TJ, rz=math.pi / 4, bottom=False, ring_colors=[TJ, TJD])
        p.beam((x, -11.4, 24.8), (x, -11.4, 27.6), .1, 0xf2f4f8, 3)
        p.beam((x - .7, -11.4, 26.6), (x + .7, -11.4, 26.6), .08, 0xf2f4f8, 3)
        p.face([(x - .55, -14.34, 8.5), (x + .55, -14.34, 8.5), (x + .55, -14.34, 9.1), (x - .55, -14.34, 9.1)], 0xf2f4f8, flip_ref=V((x, 0, 9)))
    # crossing dome + apse
    p.frustum((0, 2, 17), 4.2, 3.9, 2.6, 8, WH, ring_colors=[WH, 0x5f8fc8], bottom=False, top=False)
    dome(p, (0, 2, 19.6), 4.2, 3.6, 8, 3, [TJ, TJD])
    p.beam((0, 2, 23.2), (0, 2, 25), .1, 0xf2f4f8, 3)
    p.frustum((0, 10.5, .8), 4.2, 4.2, 6.4, 8, CR, bottom=False, top=False)
    p.frustum((0, 10.5, 7.2), 4.8, .3, 3.4, 8, TJ, bottom=False, ring_colors=[TJ, TJD])
    reg('iglesia_catedral', 22, 28.6, 28.4)

    # ============ torre_telefonica done above ============

    # ============ teatro_teresa_carreno ============
    p = part('teatro_teresa_carreno', 0, 2)
    W, T = 0xf2f4f8, 0xcfd6e2
    p.cbox((0, 0, -.5), (45, 32, 1.8), 0xd7cfbb, ch=.4, tcolor=0xe6dfd0)
    # stage house (back)
    hfacade(p, 0, 9, 22, 11, 1.3, 18, 3.4, W, 0xcfd6e2, gf=.3, roof=T, back=W)
    p.cbox((0, 9, 17.8), (23, 12, .8), W, ch=.25)
    # grand hall under the vault
    hfacade(p, 0, -1.5, 30, 20, 1.3, 7, 2.8, W, 0x3f6aa0, gf=.45, roof=None, back=W)
    vault(p, -15, 15, -11.5, 8.5, 7, 7.4, 9, 6, [0xe9edf4, 0xcfd6e2], W)
    p.box((0, 8.6, 7), (30, .3, 6.5), 0xe6eaf2, bottom=False)
    # wings
    for sx in (-1, 1):
        hfacade(p, sx * 19.3, -1, 7.4, 15, 1.3, 6.2, 2.4, W, 0x4d7fb8, gf=.5, roof=T)
        p.cbox((sx * 19.3, -1, 6), (8.2, 16, .6), W, ch=.2)
    # glass foyer with cantilevered roof
    vfacade(p, 0, -11, 36, 6.6, 1.3, 7.4, 14, 2, lambda k: 0x5f8fc8 if k % 3 else 0x8fc0e8, W, sides='sew', roof=None, mf=.18)
    p.cbox((0, -11.5, 7.2), (41, 11.4, .9), W, ch=.3)
    for i in range(9):
        p.frustum((-18 + i * 4.5, -16.6, 1.3), .45, .4, 6.0, 6, W, bottom=False, top=False)
    p.box((0, -17.6, .4), (14, 2.2, 1.2), 0xe6dfd0, bottom=False)
    p.box((0, -18.3, -.1), (10, 1.2, .6), 0xd7cfbb, bottom=False)
    wall(p, (-6, -12.8), (6, -12.8), 7.2, 9.2, 0x3f6aa0, V((0, 5, 8)))
    for sx in (-1, 1):
        palm(p, sx * 21, -15, 1.3, 6)
    reg('teatro_teresa_carreno', 45, 32, 18)

    # ============ capitolio ============
    p = part('capitolio', 1, 2)
    W, CRM = 0xf6f0e0, 0xe8dfc8
    p.cbox((0, 0, -.5), (36, 30, 2.6), 0xd7cfbb, ch=.45, tcolor=0xe6dfd0)
    # main block + wings
    hfacade(p, 0, 3, 22, 20, 2.1, 13, 3.7, CRM, 0x6b7a90, gf=.55, roof=W, back=CRM)
    p.cbox((0, 3, 12.6), (23.4, 21.4, 1.0), W, ch=.3)
    for sx in (-1, 1):
        hfacade(p, sx * 14.5, 3, 7, 16, 2.1, 9.6, 3.8, CRM, 0x6b7a90, gf=.55, roof=W, back=CRM)
        p.cbox((sx * 14.5, 3, 9.2), (7.8, 16.8, .8), W, ch=.25)
        wall(p, (sx * 14.5 - 3.5, -5.04), (sx * 14.5 + 3.5, -5.04), 2.1, 3.0, W, V((0, 8, 3)))
    # colonnade
    for i in range(9):
        x = -10.4 + i * 2.6
        p.frustum((x, -8.2, 2.1), .78, .68, 10.4, 6, W, bottom=False, top=False)
    p.cbox((0, -7.8, 12.9), (24.6, 4.6, 1.4), W, ch=.3)
    p.gable((0, -7.8, 14.3), 4.4, 23.6, 3.1, CRM, W, rz=math.pi / 2, strips=1, overhang=.3)
    wall(p, (-9, -5.04), (9, -5.04), 2.1, 12.4, 0xd9c39a, V((0, 6, 7)))
    for i in range(5):
        x = -7.2 + i * 3.6
        p.face([(x - .8, -5.1, 3.4), (x + .8, -5.1, 3.4), (x + .8, -5.1, 9), (x, -5.1, 10), (x - .8, -5.1, 9)], 0x5f6a80, flip_ref=V((x, 5, 6)))
    p.box((0, -10.8, 1.5), (14, 2.2, .6), 0xe6dfd0, bottom=False)
    p.box((0, -12.4, 1.0), (13, 1.8, .6), 0xe6dfd0, bottom=False)
    p.box((0, -13.8, .5), (12, 1.6, .6), 0xe6dfd0, bottom=False)
    # drum + gold dome
    p.frustum((0, 3, 13.6), 6.6, 6.2, 4.2, 12, W, ring_colors=[W, 0x6b7a90], bottom=False, top=False)
    dome(p, (0, 3, 17.8), 6.4, 5.6, 12, 3, [0xe0b24a, 0xc99a30])
    p.frustum((0, 3, 23.5), 1.4, 1.2, 1.6, 8, W, ring_colors=[W, 0x6b7a90], bottom=False)
    p.frustum((0, 3, 25.1), 1.4, .2, 1.4, 8, 0xe0b24a, bottom=False)
    p.beam((0, 3, 26.4), (0, 3, 28.6), .08, 0xd92a2a, 3)
    for sx in (-1, 1):
        palm(p, sx * 16, -11.5, .8, 6)
    reg('capitolio', 36, 30, 28.6)

    # ============ centro_comercial ============
    p = part('centro_comercial', 2, 2)
    p.cbox((0, 0, -.5), (46, 30, 1.2), 0xb9bfc9, ch=.3, tcolor=0xcfd6e2)
    # parking deck at the back
    hfacade(p, 0, 7.5, 46, 15, .7, 14, 3.4, 0xcfd6e2, 0x4a4f5a, gf=.62, roof=0xa9aeb8, back=0xcfd6e2)
    p.cbox((0, 7.5, 13.7), (47, 16, .6), 0xe6eaf2, ch=.2)
    cars(p, -18, 5, 14.3, 5, 7.0)
    for x in (-6, 14):
        p.box((x, 11, 14.3), (.4, .4, 2.2), 0x30343c, bottom=False)
        p.box((x, 11, 16.4), (1.8, .5, .3), 0xfff0a0, bottom=False)
    # mall body
    vfacade(p, 0, -8, 46, 14, .7, 8.4, 12, 3, lambda k: (0x5f8fc8, 0x8fc0e8, 0x6fa0d8)[k % 3], 0xf2f4f8, sides='sew', roof=0xd7cfbb, mf=.32, back=0xcfd6e2)
    p.cbox((0, -8, 8.2), (47, 15, .7), 0xf6f0e0, ch=.2)
    for i in range(8):
        x = -20 + i * 5.7
        if -8.5 < x < 8.5:
            continue
        p.box((x, -15.7, 3.4), (4.2, 1.7, .35), (0xd92a2a, 0xf2f4f8)[i % 2], bottom=False)  # awnings
    for sx in (-1, 1):
        p.cbox((sx * 18, -8, 8.8), (9, 10, 1.4), 0xcfd6e2, ch=.3)
        hvac(p, sx * 17, -9, 10.2, 2.6, 2.0, 1.2)
    # glass atrium
    vfacade(p, 0, -9, 15, 17, .7, 9.6, 4, 4, 0x6fa0d8, 0xf2f4f8, sides='sew', roof=None, mf=.15)
    p.gable((0, -9, 9.6), 17.5, 15.5, 3.6, 0x8fc0e8, 0xcfe6f6, rz=math.pi / 2, strips=3, overhang=.3)
    p.cbox((0, -16.8, 5.4), (9, 2.2, .45), 0xd92a2a, ch=.12)
    wall(p, (-6, -17.6), (6, -17.6), 3.0, 5.2, 0x30343c, V((0, -5, 4)))
    # pylon sign
    p.box((19.5, -17.4, .7), (.9, .9, 8), 0x30343c, bottom=False)
    p.box((19.5, -17.4, 8.4), (4.4, .7, 3.6), 0xf2f4f8, bottom=False)
    wall(p, (17.5, -17.78), (21.5, -17.78), 8.8, 11.4, 0xd92a2a, V((19.5, -5, 10)))
    # ramp
    p.face([(-23.4, 0, .7), (-23.4, 14, 13.7), (-25.4, 14, 13.7), (-25.4, 0, .7)], 0xa9aeb8, flip_ref=V((-30, 7, 7)))
    for x in (-30, 30):
        pass
    for sx in (-1, 1):
        palm(p, sx * 21, -17.7, .5, 5)
    reg('centro_comercial', 46, 30, 17)

    # ============ estadio ============
    p = part('estadio', 3, 2)
    n = 16
    R0, R1, RP = 22.0, 21.4, 11.0
    zc = (lambda r, z: [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), z) for i in range(n)])
    p.frustum((0, 0, -.5), 22.4, 22.4, 1.2, n, 0xb9bfc9, top=False, bottom=False)
    # outer wall: concrete / white alternating ribs
    p.frustum((0, 0, .7), 22, 21.2, 10.8, n, 0xcfd6e2, bottom=False, top=False, ring_colors=[0xf2f4f8, 0xcfd6e2, 0xf2f4f8, 0x3f6aa0])
    p.frustum((0, 0, 11.5), 21.2, 21.4, 1.0, n, 0x3f6aa0, bottom=False, top=False)
    # tiered seats (treads up, risers inward)
    prof = [(21.0, 11.5), (21.0, 11.5), (19.0, 11.5), (19.0, 10.0), (16.4, 10.0), (16.4, 7.5), (14.2, 7.5), (14.2, 5.0), (12.4, 5.0), (12.4, 1.6), (RP + .5, 1.6)]
    seat = [0xd92a2a, 0xf2f4f8, 0xd8b45a, 0x3f6aa0]
    for k in range(len(prof) - 1):
        (ra, za), (rb, zb) = prof[k], prof[k + 1]
        if abs(ra - rb) < 1e-6 and abs(za - zb) < 1e-6:
            continue
        for i in range(n):
            j = (i + 1) % n
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            tier = 0 if za > 9 else (1 if za > 4 else 2)
            col = seat[(i + tier) % 4]
            pts = [(ra * math.cos(a0), ra * math.sin(a0), za), (ra * math.cos(a1), ra * math.sin(a1), za),
                   (rb * math.cos(a1), rb * math.sin(a1), zb), (rb * math.cos(a0), rb * math.sin(a0), zb)]
            if abs(za - zb) < 1e-6:
                p.face(pts, col, up=True)
            else:
                mid = (ra * math.cos((a0 + a1) / 2) * 3, ra * math.sin((a0 + a1) / 2) * 3, (za + zb) / 2)
                p.face(pts, 0xcfd6e2, flip_ref=V((0, 0, (za + zb) / 2)) if False else V((ra * 3 * math.cos((a0 + a1) / 2), ra * 3 * math.sin((a0 + a1) / 2), (za + zb) / 2)))
    # roof canopy ring
    rc = [zc(21.8, 12.6), zc(15.6, 12.2), zc(15.4, 11.6)]
    p.loft([zc(22, 11.3), zc(21.8, 12.6), zc(16.4, 12.3), zc(16.2, 11.7)], 0xf2f4f8, closed=True, ref=V((0, 0, 4)),
           colors=[0xf2f4f8, 0xe0e5ee])
    # pitch with stripes + lines
    p.disc((0, 0, 1.55), RP + .6, 0x4f9a40, rings=2, segs=n, colorfn=lambda x, y: 0x4f9a40 if int((x + 30) / 3.2) % 2 == 0 else 0x5aa84a)
    p.face([(-8, -4.5, 1.62), (8, -4.5, 1.62), (8, 4.5, 1.62), (-8, 4.5, 1.62)], 0x62b052, up=True)
    p.face([(-.25, -4.5, 1.66), (.25, -4.5, 1.66), (.25, 4.5, 1.66), (-.25, 4.5, 1.66)], 0xf2f4f8, up=True)
    p.disc((0, 0, 1.68), 1.5, 0xf2f4f8, rings=1, segs=8)
    for sx in (-1, 1):
        p.box((sx * 8.3, 0, 1.6), (.3, 2.4, 1.0), 0xf2f4f8, bottom=False)
    # floodlight masts
    for (ax, ay) in ((14, 14), (-14, 14), (14, -14), (-14, -14)):
        p.beam((ax, ay, 11), (ax, ay, 21), .28, 0x8a93a3, 4)
        p.box((ax - 1.4, ay - .4, 20.6), (2.8, .8, 1.6), 0xf2f4f8, bottom=False)
        wall(p, (ax - 1.2, ay - .82), (ax + 1.2, ay - .82), 20.8, 22.0, 0xfff0a0, V((ax, ay + 5, 21)))
    # entrance gate + flags
    p.cbox((0, -22.4, -.2), (7, 2.6, 5.5), 0xe6dfd0, ch=.3)
    wall(p, (-2, -23.75), (2, -23.75), .6, 4, 0x3f6aa0, V((0, 0, 2)))
    reg('estadio', 44.8, 44.8, 22)

    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
