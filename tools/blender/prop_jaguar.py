"""jaguar: alert jaguar (rosette face-colour pattern) standing on a mossy boulder cluster. Parts: rock (origin ground centre), jaguar (loc at rock top, faces +X locally)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'jaguar'
GROUND = 0x2c6f32
PREVIEW = dict(az=0, pitch=62, fit=0.95)
AO_DIST = 7.0

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


GOLD, GOLD2, CREAM, SPOT, PAW = 0xd9a03c, 0xcf9234, 0xf0dcae, 0x2a1d14, 0xe6c98a


def jag(p):
    def body_col(j, k, up):
        if up < -.55:
            return CREAM
        return GOLD
    st0 = [(-2.0, 2.1, .55, .62), (-1.2, 2.25, .75, .78), (0, 2.2, .72, .74), (1.1, 2.35, .8, .84), (1.7, 2.42, .66, .72)]
    st = st0
    tube(p, [(x, 0, z) for x, z, _, _ in st], [(a, b) for _, _, a, b in st], body_col, n=6, caps=(True, False), dec=lambda j, k, up: (SPOT, GOLD) if up > -.3 and hsh(j, k) % 5 > 2 else None)
    tube(p, [(1.5, 0, 2.5), (2.2, 0, 3.35)], [(.62, .68), (.55, .6)], GOLD, n=6, caps=(False, False), dec=lambda j, k, up: (SPOT, GOLD) if up > 0 else None)
    tube(p, [(2.2, 0, 3.35), (2.9, 0, 3.4), (3.45, 0, 3.15)], [(.55, .55), (.5, .46), (.34, .3)],
         lambda j, k, up: (0xe9a9a0 if j == 1 and up < .3 else (CREAM if j == 1 else GOLD)), n=6, caps=(False, True), dec=lambda j, k, up: (SPOT, GOLD) if j == 0 and up > .2 else None)
    for sy in (-1, 1):
        p.frustum((2.3, sy * .36, 3.75), .22, .12, .25, 4, SPOT)          # ears
        p.frustum((3.0, sy * .38, 3.5), .1, .05, .1, 3, 0x1a120c)        # eyes
    # legs: front straight, hind bent
    for sy in (-1, 1):
        tube(p, [(1.3, sy * .5, 1.95), (1.4, sy * .52, 1.0), (1.45, sy * .52, .12)], [.36, .28, .3], [GOLD, PAW], n=4, caps=(False, True))
        tube(p, [(-1.6, sy * .52, 1.9), (-2.0, sy * .56, 1.0), (-1.7, sy * .56, .12)], [.42, .28, .3], [GOLD, PAW], n=4, caps=(False, True))
    # long curling tail
    tube(p, [(-2.0, 0, 2.2), (-3.0, .2, 1.5), (-3.9, .8, 1.2), (-4.6, 1.6, 1.9), (-4.6, 2.2, 2.9)], [.24, .2, .18, .16, .13],
         lambda j, k, up: SPOT if j == 3 else GOLD, n=4, dec=lambda j, k, up: (SPOT, GOLD) if j < 3 and up > 0 else None)


def build(L):
    P = L.P
    r = L.Part('rock', ao=0.0)
    moss, moss2 = 0x5f9640, 0x4f8238
    mk = lambda z, u: moss if (z > .3 and u > .4) else (0x8a7a62 if u > .2 else 0x6b5a46)
    def bands(zc, rr):
        return moss if zc > .55 else (moss2 if zc > .3 and rr > .5 else (0x8f7d64 if zc > 0 else 0x6e5d48))
    r.ico((0, 0, 1.7), 3.5, 0x8a7a62, sub=2, sc=(1.3, 1.0, 1.0), jitter=.12, seed=4, cut_below=.5, bands=bands)
    r.ico((-5.0, 2.2, .6), 1.9, 0x8a7a62, sub=1, sc=(1.2, 1.0, .85), jitter=.14, seed=7, cut_below=.1, bands=bands)
    r.ico((4.6, -2.2, .5), 1.6, 0x8a7a62, sub=1, sc=(1.1, 1.0, .85), jitter=.14, seed=9, cut_below=.1, bands=bands)
    j = L.Part('jaguar', loc=(0, 0, 4.7), rot=-1.15, ao=0.0)
    jag(j)
    return [r, j]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
