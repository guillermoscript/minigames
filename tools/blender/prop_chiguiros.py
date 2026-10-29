"""chiguiros: capybara family (capybara_1..3 adults, capybara_baby_1..2) resting beside a marsh pond ('pond', 20x14 water + mud bank, 'reeds').
Animals face +X locally; loc/rot place them. Origin = pond centre."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'chiguiros'
GROUND = 0xa8b65a
PREVIEW = dict(az=0, pitch=62, fit=0.95)
AO_DIST = 5.0

# ---- shared helpers (duplicated per prop file on purpose; lib.py is untouched) ----
def tube(p, pts, rad, cols, n=6, caps=(True, True), phase=0.0):
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
            p.face([rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k]], col, flip_ref=ref)
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



def capy(p, s=1.0, coat=0x9a6b40, dark=0x6e4a2c, belly=0xc09a68, pose='stand', baby=False):
    """Capybara facing +X: barrel body, blunt square head, tiny ears, stub legs."""
    zb = 0.0 if pose == 'stand' else -.28
    T = lambda x, y, z: (x * s, y * s, (z + zb) * s)
    st = [(-1.5, 1.0, .6, .7), (-.7, 1.15, .85, .92), (.5, 1.15, .85, .92), (1.3, 1.1, .7, .82)]
    tube(p, [T(x, 0, z) for x, z, _, _ in st], [(a * s, b * s) for _, _, a, b in st],
         lambda j, k, up: belly if up < -.6 else (coat if up > .3 else coat), n=6, caps=(True, False))
    hy = .0
    hs = 1.2 if baby else 1.0
    head = [(1.2, 1.2), (1.95, 1.15), (2.45, .98)]
    tube(p, [T(x, hy, z) for x, z in head], [(.62 * hs * s, .62 * hs * s), (.55 * hs * s, .52 * hs * s), (.5 * hs * s, .4 * hs * s)],
         lambda j, k, up: 0x3c2c24 if j == 1 else coat, n=6, caps=(False, True))
    for sy in (-1, 1):
        p.frustum(T(1.45, sy * .42, 1.75), .17 * s, .08 * s, .25 * s, 3, dark)          # ears
        p.frustum(T(2.0, sy * .42, 1.4), .11 * s, .06 * s, .12 * s, 3, 0x1c1410)        # eyes
    if pose == 'stand':
        for hx in (-.95, 1.0):
            for sy in (-1, 1):
                tube(p, [T(hx, sy * .5, .95), T(hx + .05, sy * .52, .1)], [.3 * s, .26 * s], dark, n=4, caps=(False, True))
    else:   # sitting: front paws peek out
        for sy in (-1, 1):
            tube(p, [T(1.1, sy * .5, .7), T(1.5, sy * .5, .38)], [.28 * s, .22 * s], dark, n=4, caps=(False, True))


def build(L):
    P = L.P
    out = []
    # pond: mud bank + marsh water in three tones
    pd = L.Part('pond', ao=0.0)
    ellipse(pd, (0, 0, .04), 12.6, 9.0, lambda x, y, f, i: 0x8a7a4a if (i % 3) else 0x7c6c42, rings=2, segs=18)

    def water(x, y, f, i):
        h = hsh(int(f * 10), i) % 4
        if f < .4:
            return (0x2f8f8a, 0x348f8e, 0x2c8a86, 0x3a9490)[h]
        if f < .75:
            return (0x45a9a2, 0x4db0a6, 0x56b5a4, 0x4aa59f)[h]
        return (0x6fb890, 0x7ab88a, 0x68b08c, 0x84be8a)[h]
    ellipse(pd, (0, 0, .12), 10, 7, water, rings=3, segs=18)
    out.append(pd)
    # reeds: clumps of cattails along the bank
    rd = L.Part('reeds', ao=0.0)
    for (x, y, k) in ((8.8, 5.6, 1), (10.2, 3.4, 2), (-9.6, 4.6, 3), (-4, 8.0, 4), (3.5, 8.2, 5), (-10.5, -2.2, 6)):
        for i in range(4):
            a = hsh(k, i) % 360 * math.pi / 180
            ox, oy = math.cos(a) * .7, math.sin(a) * .7
            h = 2.4 + (hsh(k, i + 9) % 10) * .1
            rd.beam((x + ox, y + oy, .1), (x + ox * 1.6, y + oy * 1.6, h), .09, 0x5f8f3a, sides=3)
            if i % 2 == 0:
                rd.beam((x + ox * 1.6, y + oy * 1.6, h - .6), (x + ox * 1.65, y + oy * 1.65, h), .15, 0x6a4326, sides=3)
    out.append(rd)
    spots = [
        ('capybara_1', (-8, -8.5, 0), -0.2, 1.3, 'stand', 0x9a6b40),
        ('capybara_2', (-1, -10.6, 0), -0.9, 1.35, 'sit', 0x8c6038),
        ('capybara_3', (8, -7.8, 0), -2.7, 1.2, 'stand', 0xa4764a),
    ]
    for (n, loc, rot, s, pose, coat) in spots:
        c = L.Part(n, loc=loc, rot=rot, ao=0.0)
        capy(c, s=s, coat=coat, pose=pose)
        out.append(c)
    for (n, loc, rot, pose) in (('capybara_baby_1', (-4.3, -6.6, 0), 0.7, 'stand'), ('capybara_baby_2', (-4.2, -10, 0), -1.4, 'sit')):
        c = L.Part(n, loc=loc, rot=rot, ao=0.0)
        capy(c, s=.7, coat=0xb08050, dark=0x7e5a38, belly=0xd0ac7a, pose=pose, baby=True)
        out.append(c)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
