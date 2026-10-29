"""flamingos: flock of 5 (flamingo_1..5) wading on a shallow turquoise lagoon ('lagoon', with sand rim). For Coro / Los Roques.
Each flamingo faces +X locally, feet on z=0 (scaled by s); loc/rot place it. Origin = lagoon centre."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'flamingos'
GROUND = 0xd9b878
PREVIEW = dict(az=0, pitch=62, fit=1.0)
AO_DIST = 6.0

# ---- shared helpers (duplicated per prop file on purpose; lib.py is untouched) ----
def tube(p, pts, rad, cols, n=6, caps=(True, True), phase=0.0, dec=None):
    """Tapered tube along a polyline. rad[j] = r or (lateral, vertical). cols = int | per-segment list | f(seg, k, up)."""
    V = lib.Vector
    pts = [V(q) for q in pts]
    m = len(pts)
    rings = []
    for j, c in enumerate(pts):
        t = (pts[min(j + 1, m - 1)] - pts[max(j - 1, 0)]).normalized()
        ref = V((0, 0, 1)) if abs(t.z) < .9 else V((1, 0, 0))
        u = t.cross(ref).normalized()
        v = u.cross(t).normalized()
        r = rad[j]
        ru, rv = (r, r) if not isinstance(r, (tuple, list)) else r
        rings.append([c + u * (ru * math.cos(2 * math.pi * k / n + phase)) + v * (rv * math.sin(2 * math.pi * k / n + phase)) for k in range(n)])
    for j in range(m - 1):
        ref = (pts[j] + pts[j + 1]) / 2
        for k in range(n):
            k2 = (k + 1) % n
            up = math.sin(2 * math.pi * (k + .5) / n + phase)
            col = cols(j, k, up) if callable(cols) else (cols[j] if isinstance(cols, (list, tuple)) else cols)
            quad = [rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k]]
            p.face(quad, col, flip_ref=ref)
            d = dec(j, k, up) if dec else None
            if d:
                cen = sum(quad, V((0, 0, 0))) / 4
                nrm = (cen - ref).normalized()
                for sc_, cc_, lift in ((.62, d[0], .035), (.3, d[1], .05)):
                    p.face([cen + (q - cen) * sc_ + nrm * lift for q in quad], cc_, flip_ref=ref)
    c0 = cols(0, 0, 0) if callable(cols) else (cols[0] if isinstance(cols, (list, tuple)) else cols)
    c1 = cols(m - 2, 0, 0) if callable(cols) else (cols[-1] if isinstance(cols, (list, tuple)) else cols)
    if caps[0]:
        p.face(rings[0], c0, flip_ref=pts[1])
    if caps[1]:
        p.face(rings[-1], c1, flip_ref=pts[-2])


def ellipse(p, c, a, b, colorfn, rings=3, segs=16):
    cx, cy, cz = c
    prev = None
    for k in range(rings + 1):
        f = k / rings
        ring = [(cx + a * f * math.cos(2 * math.pi * i / segs), cy + b * f * math.sin(2 * math.pi * i / segs), cz) for i in range(segs)]
        if k == 0:
            prev = [(cx, cy, cz)]
            continue
        for i in range(segs):
            j = (i + 1) % segs
            col = colorfn(ring[i][0] - cx, ring[i][1] - cy, f, i)
            if len(prev) == 1:
                p.face([prev[0], ring[i], ring[j]], col, up=True)
            else:
                p.face([prev[i], ring[i], ring[j], prev[j]], col, up=True)
        prev = ring


def hsh(*a):
    h = 2166136261
    for x in a:
        h = ((h ^ (int(x) + 101)) * 16777619) & 0xffffffff
        h ^= h >> 13
    return h % 9973


def horse(p, coat, mane, legc, pose='stand', s=1.0, zb=0.0, blaze=None, muzzle=0x4a3a34, hoof=0x2a2420):
    """Horse facing +X, hooves on z=0 (scaled by s). pose: stand | graze | trot | walk."""
    def T(x, y, z):
        return (x * s, y * s, (z + zb) * s)
    bob = .12 if pose == 'trot' else 0.0
    st = [(-2.0, 2.35, .55, .7), (-1.1, 2.4, .72, .85), (.1, 2.35, .74, .85), (1.2, 2.45, .66, .8), (1.9, 2.6, .5, .62)]
    tube(p, [T(x, 0, z + bob) for x, z, _, _ in st], [(a * 1.2 * s, b * s) for _, _, a, b in st], coat, n=6, caps=(True, False))
    if pose == 'graze':
        neck = [(1.5, 2.75), (2.3, 2.35)]
        head = [(2.3, 2.35), (2.85, 1.55), (3.1, .75)]
    elif pose == 'trot':
        neck = [(1.5, 2.85), (2.35, 3.85)]
        head = [(2.35, 3.9), (3.2, 3.6), (3.75, 3.1)]
    else:
        neck = [(1.5, 2.8), (2.4, 3.95)]
        head = [(2.4, 4.0), (3.2, 3.7), (3.8, 3.25)]
    tube(p, [T(x, 0, z + bob) for x, z in neck], [(.58 * s, .58 * s), (.4 * s, .44 * s)], coat, n=6, caps=(False, False))
    hr = [(.3 * s, .42 * s), (.28 * s, .34 * s), (.19 * s, .2 * s)]
    tube(p, [T(x, 0, z + bob) for x, z in head], hr,
         lambda j, k, up: muzzle if j == 1 else (blaze if (blaze and up > .6) else coat), n=6, caps=(False, True))
    hx, hz = head[0]
    for sy in (-1, 1):
        p.frustum(T(hx + .02, sy * .2, hz + bob + (.3 if pose != 'graze' else .22)), .14 * s, .04 * s, .4 * s, 3, coat)
    a, b = neck
    p.face  # noqa
    tube(p, [T(a[0] - .15, 0, a[1] + .4 + bob), T((a[0] + b[0]) / 2 - .2, 0, (a[1] + b[1]) / 2 + .42 + bob), T(b[0] - .15, 0, b[1] + .36 + bob)],
         [(.09 * s, .28 * s), (.1 * s, .3 * s), (.09 * s, .26 * s)], mane, n=4, caps=(False, False))
    if pose == 'trot':
        tp = [T(-1.95, 0, 2.85 + bob), T(-2.6, 0, 3.05 + bob), T(-3.15, 0, 2.55 + bob)]
    else:
        tp = [T(-1.95, 0, 2.75 + bob), T(-2.5, 0, 2.1 + bob), T(-2.65, 0, 1.0 + bob)]
    tube(p, tp, [(.14 * s, .2 * s), (.2 * s, .15 * s), (.1 * s, .07 * s)], mane, n=4)
    legs = {
        'stand': dict(fl=(0, 0), fr=(0, 0), hl=(0, 0), hr=(0, 0)),
        'graze': dict(fl=(.65, 0), fr=(-.1, 0), hl=(-.1, 0), hr=(.1, 0)),
        'walk': dict(fl=(-.4, 0), fr=(.55, .5), hl=(.5, .45), hr=(-.35, 0)),
        'trot': dict(fl=(.55, .65), fr=(-.35, 0), hl=(-.35, 0), hr=(.5, .6)),
    }[pose]
    for name, (hx_, front) in dict(fl=(1.25, True), fr=(1.25, True), hl=(-1.35, False), hr=(-1.35, False)).items():
        dx, lift = legs[name]
        hy = .42 if name[1] == 'l' else -.42
        hip = (hx_, hy, 1.9 + zb + bob)
        ank = (hx_ + dx, hy, lift + .5)
        kz = (hip[2] + ank[2]) / 2
        kx = hx_ + dx * .5 + (.12 + .35 * lift if front else -.3 - .2 * lift)
        S = lambda q: (q[0] * s, q[1] * s, q[2] * s)
        tube(p, [S(hip), S((kx, hy, kz)), S(ank), S((hx_ + dx, hy, lift))],
             [.27 * s, .17 * s, .12 * s, .15 * s], [coat, legc, hoof], n=4, caps=(False, True))


PINK, PINKL, PINKD, LEG, BLK = 0xf08ca2, 0xf8bccb, 0xe0607c, 0xe0708a, 0x2a2024


def flamingo(p, pose='stand', s=1.0):
    """pose: stand | down (head in the water) | one (one-legged) | walk | look (juvenile, paler)"""
    pk, pl = (PINKL, 0xfbd2dc) if pose == 'look' else (PINK, PINKL)
    T = lambda x, y, z: (x * s, y * s, z * s)
    bz = 3.0
    # body: egg shape, pale belly, darker wing edge
    st = [(-1.1, bz + .1, .35, .45), (-.4, bz, .6, .7), (.5, bz + .05, .58, .66), (1.1, bz + .3, .4, .5)]
    tube(p, [T(x, 0, z) for x, z, _, _ in st], [(a * s, b * s) for _, _, a, b in st],
         lambda j, k, up: pl if up < -.3 else (PINKD if (j == 0 and up > .2) else pk), n=6, caps=(True, True))
    # tail tip / wing feathers (black flight feathers at the rear)
    tube(p, [T(-.9, 0, bz + .3), T(-1.9, 0, bz - .15)], [(.3 * s, .08 * s), (.22 * s, .05 * s)], BLK, n=4, caps=(False, True))
    # neck + head
    if pose == 'down':
        npts = [(.9, bz + .3), (1.5, bz + .7), (2.0, bz - .2), (1.9, 1.3), (2.3, .5)]
        head = [(2.3, .5), (2.7, .25)]
    elif pose == 'one':
        npts = [(.9, bz + .3), (1.0, bz + 1.3), (1.5, bz + 2.2), (1.1, bz + 3.0), (1.4, bz + 3.6)]
        head = [(1.4, bz + 3.6), (1.8, bz + 3.5)]
    elif pose == 'look':
        npts = [(.9, bz + .3), (1.2, bz + 1.2), (1.4, bz + 2.2), (1.6, bz + 3.1)]
        head = [(1.6, bz + 3.1), (2.0, bz + 3.15)]
    else:
        npts = [(.9, bz + .3), (1.5, bz + 1.0), (1.0, bz + 2.0), (1.5, bz + 2.8), (1.4, bz + 3.5)]
        head = [(1.4, bz + 3.5), (1.9, bz + 3.4)]
    tube(p, [T(x, 0, z) for x, z in npts], [(.3 * s, .3 * s)] * (len(npts) - 1) + [(.2 * s, .2 * s)], pk, n=4, caps=(False, False))
    hx, hz = head[0]
    # head blob + bent beak (white-pink base, black tip)
    p.ico(T(hx + .1, 0, hz), .22 * s, pk, sub=0)
    bx, bzz = head[1]
    tube(p, [T(hx + .05, 0, hz), T(bx + .2, 0, bzz - .02), T(bx + .45, 0, bzz - .3)], [(.15 * s, .16 * s), (.12 * s, .12 * s), (.07 * s, .07 * s)],
         [0xfbdcd0, BLK], n=4, caps=(False, True))
    # legs: long thin, reverse knee
    leg = {'stand': ((.2, 0, 0), (.2, 0, 0)), 'down': ((.1, 0, 0), (.4, 0, 0)), 'one': ((.2, 0, 0), None),
           'walk': ((.9, 0, 0), (-.7, .4, 0)), 'look': ((.2, 0, 0), (.2, 0, 0))}[pose]
    for sy, lg in ((-1, leg[0]), (1, leg[1])):
        if lg is None:      # tucked leg: folded under the belly
            tube(p, [T(.1, sy * .25, bz - .3), T(.7, sy * .3, bz - 1.0), T(.1, sy * .3, bz - 1.4)], [.12 * s] * 3, LEG, n=3, caps=(False, True))
            continue
        dx, _, lift = lg
        hx_ = .1
        fz = lift
        tube(p, [T(hx_, sy * .25, bz - .3), T(hx_ + dx * .4 - .3, sy * .27, bz * .5 + fz / 2), T(hx_ + dx, sy * .27, .0 + fz)],
             [.12 * s, .1 * s, .1 * s], LEG, n=3, caps=(False, True))
        p.frustum(T(hx_ + dx + .25, sy * .27, .0), .35 * s, .2 * s, .05 * s, 3, PINKD, rz=0)   # webbed foot


def build(L):
    P = L.P
    out = []
    lg = L.Part('lagoon', ao=0.0)
    ellipse(lg, (0, 0, .04), 12.5, 9.2, lambda x, y, f, i: 0xe6cf98 if i % 2 else 0xdcc58c, rings=2, segs=18)

    def water(x, y, f, i):
        h = hsh(int(f * 10), i) % 4
        if f < .45:
            return (0x7fd6cf, 0x86dacf, 0x78d0cc, 0x8ddcd2)[h]
        if f < .8:
            return (0x9fe0d2, 0xa6e2d2, 0x98dccf, 0xa9e4d6)[h]
        return (0xc8ecd4, 0xd0efd6, 0xc2e8d2, 0xd4f0d8)[h]
    ellipse(lg, (0, 0, .12), 10.5, 7.4, water, rings=3, segs=18)
    out.append(lg)
    specs = [
        ('flamingo_1', (-5.0, -1.5, 0), -1.4, 'stand', 1.0),
        ('flamingo_2', (-.5, -4.2, 0), -0.4, 'down', 1.0),
        ('flamingo_3', (3.0, -.6, 0), -2.0, 'one', 1.08),
        ('flamingo_4', (-1.6, 2.6, 0), -1.0, 'walk', 1.0),
        ('flamingo_5', (5.2, 2.6, 0), -2.7, 'look', .85),
    ]
    for (n, loc, rot, pose, s) in specs:
        f = L.Part(n, loc=(loc[0], loc[1], .1), rot=rot, ao=0.0)
        flamingo(f, pose, s)
        out.append(f)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
