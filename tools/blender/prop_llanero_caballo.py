"""llanero_caballo: llanero (straw hat, white shirt, sash, boots) on a walking horse. Two variants: llanero_a (bay horse, red sash), llanero_b (grey horse, blue sash, raised arm).
Mesh origin = hooves centre; horse faces +X locally (loc/rot place them, facing roughly south)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'llanero_caballo'
GROUND = 0xa8b65a
PREVIEW = dict(az=0, pitch=52, fit=0.85)
AO_DIST = 7.0

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
             [.3 * s, .2 * s, .14 * s, .17 * s], [coat, legc, hoof], n=4, caps=(False, True))



def llanero(L, name, loc, rot, coat, mane, legc, sash, shirt, raised, blaze=None):
    P = L.P
    p = L.Part(name, loc=loc, rot=rot, ao=0.0)
    horse(p, coat, mane, legc, pose='walk', blaze=blaze)
    skin, pants, boot = 0xc98d66, 0xd9cfae, 0x4a2f1c
    # saddle blanket
    p.box((-.1, 0, 3.12), (1.6, 1.5, .22), sash, bottom=False)
    # torso: pants -> sash -> shirt
    tube(p, [(-.1, 0, 3.3), (-.1, 0, 3.7), (-.05, 0, 4.45)], [(.5, .4), (.5, .4), (.52, .38)], [sash, shirt], n=6)
    # head + hat
    tube(p, [(-.03, 0, 4.4), (-.03, 0, 4.7), (0, 0, 5.1)], [.26, .3, .3], skin, n=6)
    p.frustum((0, 0, 4.95), 1.1, .95, .16, 8, P['hay'], tcolor=P['hayD'])
    p.frustum((0, 0, 5.08), .56, .44, .5, 8, P['hay'], tcolor=P['hayD'])
    p.frustum((0, 0, 5.1), .58, .56, .16, 8, P['woodD'], bottom=False, top=False)
    # legs (thigh pants, boot) both sides
    for sy in (-1, 1):
        tube(p, [(-.1, sy * .42, 3.3), (.65, sy * .9, 2.8), (.5, sy * .95, 1.95), (.58, sy * .95, 1.5)],
             [.24, .22, .18, .21], [pants, boot, boot], n=4, caps=(False, True))
    # arms
    for sy in (-1, 1):
        if raised and sy == 1:
            pts = [(-.05, sy * .55, 4.2), (.25, sy * .85, 4.7), (.5, sy * .8, 5.5)]
        else:
            pts = [(-.05, sy * .55, 4.2), (.4, sy * .7, 3.75), (.9, sy * .35, 3.5)]
        tube(p, pts, [.17, .15, .14], [shirt, skin], n=4, caps=(False, True))
    if raised:   # lasso loop
        p.beam((.5, .8, 5.5), (.6, 1.0, 6.2), .12, P['hayD'], sides=3)
    p.beam((.9, 0, 3.5), (3.55, 0, 3.15), .035, P['woodD'], sides=3)   # reins
    return p


def build(L):
    P = L.P
    a = llanero(L, 'llanero_a', (-5.5, 0, 0), -0.5, 0x7a4a2a, 0x2a2018, 0x3a2a20, P['red'], P['white'], False, blaze=0xf0e8d8)
    b = llanero(L, 'llanero_b', (5.5, 0, 0), 0.5, 0xc9c6bc, 0x7a7466, 0xb0ada2, P['glassL'], 0xf6f2e6, True)
    return [a, b]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
