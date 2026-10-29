"""toninas: pink Orinoco river dolphins. tonina_1 (leaping arc), tonina_2 (surfacing, beak up), tonina_3 (mother + calf pair),
splash (white ring). Water z=0; each part origin at its own waterline centre; head points +X."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'toninas'
GROUND = 0x3f8fb8
PREVIEW = dict(az=0, pitch=float(os.environ.get('PITCH', '70')), fit=float(os.environ.get('FIT', '0.8')))
AO_DIST = 5.0

PINK = 0xee9fae
PINKL = 0xf7cbd0
PINKD = 0xc27d8e
EYE = 0x2a2420


def bez(p0, p1, p2, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])


# body profile along the length from tail (0) to beak tip (1): (t, half-width, half-height)
PROF = [(0.00, .05, .10), (.10, .15, .22), (.25, .5, .55), (.45, .9, .9), (.62, .8, .8), (.74, .5, .56), (.80, .22, .26), (.89, .15, .15), (1.0, .06, .06)]


def dolphin(p, path, length, sides=5, prof=PROF):
    """Loft a dolphin body along a centreline path (list of (x,z) points tail->nose), `length` = body length scale."""
    n = len(path)
    rings = []
    for (t, hw, hh) in prof:
        i = min(n - 1, max(0, int(round(t * (n - 1)))))
        # interpolate along the path
        ft = t * (n - 1)
        i0 = min(n - 2, int(ft))
        fr = ft - i0
        x = path[i0][0] * (1 - fr) + path[i0 + 1][0] * fr
        z = path[i0][1] * (1 - fr) + path[i0 + 1][1] * fr
        tx, tz = path[i0 + 1][0] - path[i0][0], path[i0 + 1][1] - path[i0][1]
        tl = math.hypot(tx, tz) or 1
        nx, nz = -tz / tl, tx / tl          # normal in the XZ plane (up-ish)
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides + math.pi / 2
            ry = math.cos(a) * hw * length * .24
            rz = math.sin(a) * hh * length * .24
            ring.append((x + nx * rz, ry, z + nz * rz))
        rings.append((ring, (x, z), (nx, nz), (tx / tl, tz / tl)))
    cols = [PINK, PINKD, PINKL, PINKL, PINKD][:sides]
    # per-column colours: column 0 = up (back, darker), lower columns lighter belly
    ccol = [PINKD if k == 0 else (PINK if k in (1, sides - 1) else PINKL) for k in range(sides)]
    p.loft([r[0] for r in rings], PINK, colors=ccol, ref=lib.Vector((rings[3][1][0], 0, rings[3][1][1])))
    p.face(list(reversed(rings[0][0])), PINKD, flip_ref=lib.Vector((rings[3][1][0], 0, rings[3][1][1])))
    p.face(rings[-1][0], PINKL, flip_ref=lib.Vector((rings[3][1][0], 0, rings[3][1][1])))
    return rings


def fins(p, rings, length, melon=True):
    """dorsal fin, two pectoral flippers, tail fluke, eye dots, using the body rings for placement."""
    s = length / 7.0
    (r3, c3, n3, t3) = rings[3]
    (r4, c4, n4, t4) = rings[4]
    (r1, c1, n1, t1) = rings[1]
    (r0, c0, n0, t0) = rings[0]
    # dorsal: small triangular fin on the back
    def P3(cc, nn, tt, fwd, up, y=0.0):
        return (cc[0] + tt[0] * fwd + nn[0] * up, y, cc[1] + tt[1] * fwd + nn[1] * up)
    base = .85 * s
    p.face([P3(c3, n3, t3, -base, .6 * s, .09 * s), P3(c3, n3, t3, base * .6, .6 * s, .09 * s), P3(c3, n3, t3, -base * .1, 2.3 * s, 0)], PINKD)
    p.face([P3(c3, n3, t3, -base, .6 * s, -.09 * s), P3(c3, n3, t3, -base * .1, 2.3 * s, 0), P3(c3, n3, t3, base * .6, .6 * s, -.09 * s)], PINKD)
    # pectoral flippers
    for sg in (-1, 1):
        a = P3(c4, n4, t4, .3 * s, -.55 * s, sg * .6 * s)
        b = P3(c4, n4, t4, -.5 * s, -1.0 * s, sg * 1.5 * s)
        c = P3(c4, n4, t4, -1.4 * s, -.55 * s, sg * .6 * s)
        p.face([a, b, c], PINK, flip_ref=lib.Vector(P3(c4, n4, t4, 0, 3 * s, 0)))
        p.face([a, c, b], PINK, flip_ref=lib.Vector(P3(c4, n4, t4, 0, -3 * s, 0)))
    # tail fluke: horizontal wedge in the body plane
    for sg in (-1, 1):
        a = P3(c0, n0, t0, 0.2 * s, 0, sg * .1 * s)
        b = P3(c0, n0, t0, -1.0 * s, 0, sg * 2.5 * s)
        c = P3(c0, n0, t0, -.5 * s, 0, sg * .1 * s)
        p.face([a, b, c], PINKD, flip_ref=lib.Vector(P3(c0, n0, t0, 0, 3 * s, 0)))
        p.face([a, c, b], PINKD, flip_ref=lib.Vector(P3(c0, n0, t0, 0, -3 * s, 0)))
    # eyes
    (r6, c6, n6, t6) = rings[5]
    for sg in (-1, 1):
        p.ico(P3(c6, n6, t6, -.2 * s, .15 * s, sg * .82 * s), .13 * s, EYE, sub=0)
    # melon bump
    (r5, c5, n5, t5) = rings[5]
    if melon:
        p.ico(P3(c5, n5, t5, .3 * s, .35 * s, 0), .42 * s, PINK, sub=0, sc=(1, .9, .8))


def build(L):
    out = []
    # 1: leaping arc, nose down at the right
    a = L.Part('tonina_1', loc=(-20, 0, 0), ao=0.0)
    path = [bez((-5.5, .8), (-1.8, 7.4), (5.5, 1.2), i / 7) for i in range(8)]
    rings = dolphin(a, path, 9.0)
    fins(a, rings, 9.0)
    out.append(a)
    # 2: surfacing, head pitched up, back arched
    b = L.Part('tonina_2', loc=(0, 0, 0), ao=0.0)
    path = [bez((-5, -1.5), (0.0, .2), (4.3, 3.2), i / 7) for i in range(8)]
    rings = dolphin(b, path, 9.0)
    fins(b, rings, 9.0)
    out.append(b)
    # 3: pair (adult and calf) swimming side by side, backs arched
    c = L.Part('tonina_3', loc=(20, 0, 0), ao=0.0)
    for (oy, sc, bz, sd) in ((-3.2, 1.0, .7, 1), (3.4, .62, .3, 2)):
        path = [bez((-4.2 * sc, -.5), (0.0, 1.9 + bz * .5), (4.2 * sc, -.1), i / 6) for i in range(7)]
        # shift the pair in y by moving every ring after creation: build into a temp offset by translating y later
        before = set(c.bm.verts)
        rings = dolphin(c, path, 8.0 * sc, sides=4)
        fins(c, rings, 8.0 * sc, melon=False)
        for v in [v for v in c.bm.verts if v not in before]:
            v.co.y += oy
    out.append(c)
    # splash ring under tonina_1's landing spot
    s = L.Part('splash', loc=(-14.5, 0, 0), ao=0.0)
    n = 14
    ringo = [(2.9 * math.cos(2 * math.pi * i / n), 2.9 * math.sin(2 * math.pi * i / n), .25) for i in range(n)]
    ringi = [(1.7 * math.cos(2 * math.pi * i / n), 1.7 * math.sin(2 * math.pi * i / n), .55) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        s.face([ringo[i], ringo[j], ringi[j], ringi[i]], 0xffffff, up=True)
    for k in range(6):                      # droplets / splash crown
        ang = 2 * math.pi * k / 6 + .3
        s.frustum((1.8 * math.cos(ang), 1.8 * math.sin(ang), .4), .45, 0, 1.4 + (k % 2) * .5, 4, 0xf2f8ff, bottom=False)
    out.append(s)
    only = os.environ.get('ONLY')
    return [o for o in out if not only or o.name in only.split(',')]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
