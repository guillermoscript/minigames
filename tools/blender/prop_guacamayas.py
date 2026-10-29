"""guacamayas: two scarlet macaws perched on a log with forked stumps. Parts: macaw_1, macaw_2 (loc on the log, face +X locally), branch (log + stumps + leaves). Origin = ground centre."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'guacamayas'
GROUND = 0x2c6f32
PREVIEW = dict(az=0, pitch=70, fit=0.95)
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


RED, REDD, YEL, BLU, BLUD, WHT, BEAK, BLK = 0xd92a24, 0xa81e1e, 0xf0c63a, 0x2f6fc8, 0x214f9a, 0xf2eee4, 0xe8dcc0, 0x2a2420


def macaw(p, flip=1.0):
    """Perched at origin (feet on z=0), facing +X, tail hangs below the perch."""
    tube(p, [(-.2, 0, .45), (0, 0, 1.1), (.2, 0, 1.9)], [(.42, .42), (.55, .6), (.42, .42)],
         lambda j, k, up: RED, n=6, caps=(True, False))
    tube(p, [(.2, 0, 1.85), (.3, 0, 2.45)], [(.42, .4), (.38, .38)],
         lambda j, k, up: (WHT if (up > -.2 and k in (2, 3)) else RED), n=6, caps=(False, True))     # head (white face patch on the front-left faces)
    # beak: pale hooked upper, dark lower
    tube(p, [(.5, 0, 2.5), (.95, 0, 2.38), (1.05, 0, 1.95)], [(.2, .24), (.15, .17), (.05, .05)], BEAK, n=4, caps=(False, True))
    tube(p, [(.5, 0, 2.28), (.85, 0, 2.2)], [(.12, .1), (.07, .06)], BLK, n=4, caps=(False, True))
    for sy in (-1, 1):
        p.frustum((.52, sy * .36, 2.5), .1, .06, .06, 4, BLK)             # eyes
        # folded wing: red shoulder, yellow band, blue tip
        tube(p, [(.15, sy * .5, 1.75), (-.15, sy * .52, 1.0), (-.6, sy * .45, .2)], [(.14, .34), (.14, .32), (.1, .22)],
             [RED, YEL, BLU], n=4, caps=(False, True))
        p.box((.05, sy * .22, -.08), (.3, .12, .1), BLK, bottom=False)       # feet
    # tail: long, red then blue
    tube(p, [(-.35, 0, .6), (-1.3, 0, -.2), (-2.2, 0, -1.1), (-2.9, 0, -1.8)], [(.32, .1), (.4, .1), (.32, .08), (.2, .06)],
         [RED, BLU, BLUD], n=4, caps=(False, True))
    for v in p.bm.verts:
        v.co *= 1.5


def build(L):
    P = L.P
    out = []
    br = L.Part('branch', ao=0.0)
    LOGZ = 3.6
    # forked stumps
    for sx in (-4.2, 4.2):
        tube(br, [(sx, 0, 0), (sx + .1, 0, 1.8), (sx, 0, LOGZ - .3)], [.62, .5, .45], [P['woodD'], P['wood']], n=5, caps=(False, False))
        br.beam((sx + .1, 0, 1.8), (sx + 1.1, .9, 3.2), .22, P['woodD'], sides=4)
    # log with knots
    tube(br, [(-6.4, 0, LOGZ), (-3, 0, LOGZ + .05), (3, 0, LOGZ - .05), (6.6, 0, LOGZ + .1)], [.7, .85, .85, .65], [P['wood'], P['woodD'], P['wood']], n=6)
    tube(br, [(5.8, .2, LOGZ + .1), (7.4, 1.0, LOGZ + 1.4)], [.25, .14], P['wood'], n=4, caps=(False, True))
    for (x, y, z, r, sd) in ((7.4, 1.0, LOGZ + 1.9, 1.3, 3), (-5.5, 0.8, LOGZ + .9, 1.0, 5)):
        br.ico((x, y, z), r, P['selva'], sub=1, sc=(1.1, 1, .7), jitter=.1, seed=sd, tcolor=P['selvaL'])
    out.append(br)
    m1 = L.Part('macaw_1', loc=(-2.2, 0, LOGZ + .9), rot=-1.35, ao=0.0)
    macaw(m1)
    m2 = L.Part('macaw_2', loc=(2.3, .1, LOGZ + .9), rot=-1.8, ao=0.0)
    macaw(m2)
    # second bird: blue-and-yellow tint swap is not needed; keep scarlet pair
    out += [m1, m2]
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
