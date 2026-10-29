"""palmas_coco: instanced coconut palms palm_s / palm_m / palm_l / palm_lean (14 apart, <=200 tris each).
This file is also the shared Caribbean kit (palm, palapa, umbrella, lounger, colours) imported by the other Caribbean props."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'palmas_coco'
GROUND = 0xe3d3a0
PREVIEW = dict(az=0, pitch=60, fit=0.78)
AO_DIST = 8.0

# ── Caribbean palette (muted, shared) ──
C = dict(
    sand=0xf1e6c4, sandD=0xe2d2a4, sandW=0xd8c690, sea=0x2f9fcc, seaL=0x5cc8d2, seaLL=0x9fe6dc, foam=0xf4fbfa,
    palm=0x4a9a48, palmL=0x6bb25a, palmD=0x2f7a3a, trunk=0x8a6a45, trunkD=0x6f5236, coco=0x5a3a20,
    thatch=0xcfa85a, thatchD=0xa88442, pole=0x7a5230, woodL=0xa57a4a, woodD=0x5a3a20,
    coral=0xe8725a, teal=0x2fa8a0, yellow=0xf2c84b, white=0xf4f2ea, navy=0x2a4a8a, red=0xd9453a,
    rock=0xb09a78, rockD=0x7d6a52, steel=0x30343c, glass=0x5f8fc8, cream=0xf6edd6,
)


def xf(ox, oy, rz):
    co, si = math.cos(rz), math.sin(rz)
    return lambda x, y, z=0.0: (ox + x * co - y * si, oy + x * si + y * co, z)


def palm(p, x, y, h=7.0, lean=(0.0, 0.0), s=1.0, seed=0, nfr=7, fl=4.4, coconuts=2, rings=4):
    """Coconut palm at (x,y): curved loft trunk, drooping V-fronds, coconuts. lean = horizontal offset of the crown."""
    rng = random.Random(seed)
    r0, r1 = .5 * s, .3 * s
    path = []
    for k in range(rings):
        t = k / (rings - 1)
        path.append((x + lean[0] * t ** 1.7, y + lean[1] * t ** 1.7, h * t))
    sides = 5
    rr = []
    for k, c in enumerate(path):
        t = k / (rings - 1)
        r = r0 + (r1 - r0) * t
        rr.append([(c[0] + r * math.cos(2 * math.pi * i / sides + .3), c[1] + r * math.sin(2 * math.pi * i / sides + .3), c[2]) for i in range(sides)])
    for k in range(rings - 1):
        mid = tuple((a + b) / 2 for a, b in zip(path[k], path[k + 1]))
        p.loft([rr[k], rr[k + 1]], C['trunk'] if k % 2 == 0 else C['trunkD'], ref=lib.Vector(mid))
    top = path[-1]
    # fronds
    stations = [0.0, .34, .68, 1.0]
    wf = [.3, 1.0, .8, 0.0]
    a0 = rng.random() * 6.28
    for i in range(nfr):
        a = a0 + 2 * math.pi * i / nfr + (rng.random() - .5) * .35
        L2 = fl * s * (0.88 + 0.2 * rng.random())
        fw = .95 * s * (L2 / (fl * s))
        dr = .5 + .35 * rng.random()
        d = (math.cos(a), math.sin(a))
        nn = (-d[1], d[0])
        pts = []
        for t, w in zip(stations, wf):
            hz = L2 * (.55 * t - (.35 + .45 * dr) * t * t) + .35 * s
            cx = top[0] + d[0] * L2 * t * .95
            cy = top[1] + d[1] * L2 * t * .95
            cz = top[2] + hz
            ww = fw * w
            pts.append(((cx + nn[0] * ww, cy + nn[1] * ww, cz - ww * .55), (cx, cy, cz + ww * .12), (cx - nn[0] * ww, cy - nn[1] * ww, cz - ww * .55)))
        cA, cB = (C['palm'], C['palmL']) if i % 2 == 0 else (C['palmD'], C['palm'])
        for k in range(len(stations) - 1):
            Lk, Mk, Rk = pts[k]
            Lk1, Mk1, Rk1 = pts[k + 1]
            if k < len(stations) - 2:
                p.face([Lk, Mk, Mk1, Lk1], cA, up=True)
                p.face([Mk, Rk, Rk1, Mk1], cB, up=True)
            else:
                p.face([Lk, Mk, Mk1], cA, up=True)
                p.face([Mk, Rk, Mk1], cB, up=True)
    for j in range(coconuts):
        a = a0 + j * 3.1 + 1.0
        p.ico((top[0] + .38 * s * math.cos(a), top[1] + .38 * s * math.sin(a), top[2] - .25 * s), .3 * s, C['coco'], sub=0, jitter=.05, seed=j + 3)


def palapa(p, x, y, r=2.6, h=3.4, rz=0.0, tilt=0.0):
    """Thatched beach parasol: pole + two stacked thatch cones."""
    p.beam((x, y, 0), (x + tilt, y, h), .14, C['pole'], sides=4)
    p.frustum((x + tilt, y, h * .62), r, r * .55, h * .24, 8, C['thatch'], rz=rz, bottom=True, ring_colors=[C['thatch'], C['thatchD']], tcolor=C['thatchD'])
    p.frustum((x + tilt, y, h * .84), r * .62, 0, h * .3, 8, C['thatchD'], rz=rz, bottom=False, ring_colors=[C['thatchD'], C['thatch']])


def umbrella(p, x, y, c1, c2=None, h=3.0, r=1.9, tilt=0.35):
    c2 = c2 if c2 is not None else C['white']
    p.beam((x, y, 0), (x + tilt, y, h), .09, C['white'], sides=3)
    p.frustum((x + tilt, y, h - .75), r, 0, 1.0, 8, c1, bottom=False, ring_colors=[c1, c2])


def lounger(p, x, y, rz, c1=None, c2=None):
    """Beach lounger, long axis along local +Y (head end +Y)."""
    c1 = c1 if c1 is not None else C['coral']
    T = xf(x, y, rz)
    seat = [[T(-.55, -.9, .25), T(.55, -.9, .25), T(.55, -.9, .5), T(-.55, -.9, .5)],
            [T(-.55, .5, .25), T(.55, .5, .25), T(.55, .5, .5), T(-.55, .5, .5)]]
    p.loft(seat, c1, caps=(True, True), ref=lib.Vector(T(0, -.2, .38)))
    back = [[T(-.55, .5, .3), T(.55, .5, .3), T(.55, .5, .55), T(-.55, .5, .55)],
            [T(-.55, 1.0, .85), T(.55, 1.0, .85), T(.55, 1.0, 1.1), T(-.55, 1.0, 1.1)]]
    p.loft(back, c2 if c2 is not None else c1, caps=(True, True), ref=lib.Vector(T(0, .75, .7)))


def sand_blob(p, cx, cy, r, h=1.0, n=14, seed=1, color=None, wet=None, jit=.12, slope=.85):
    """Rounded low-poly sand island: 3-ring loft with irregular radius."""
    rng = random.Random(seed)
    ks = [1.0 + (rng.random() - .5) * 2 * jit for _ in range(n)]
    col = color if color is not None else C['sand']

    def ring(rad, z):
        return [(cx + rad * ks[i] * math.cos(2 * math.pi * i / n), cy + rad * ks[i] * math.sin(2 * math.pi * i / n), z) for i in range(n)]
    rings = [ring(r * 1.08, 0.0), ring(r * 1.0, h * .38), ring(r * slope, h)]
    p.loft(rings[:2], wet if wet is not None else C['sandW'], ref=lib.Vector((cx, cy, h * .3)))
    p.loft(rings[1:], col, caps=(False, True), ref=lib.Vector((cx, cy, h * .5)))


def scale_parts(parts, k):
    """Uniformly scale finished-geometry Parts (and their locations) about the prop origin."""
    from mathutils import Matrix
    for p in parts:
        p.bm.transform(Matrix.Scale(k, 4))
        p.loc = tuple(c * k for c in p.loc)
    return parts


def build(L):
    out = []
    specs = [('palm_s', 4.6, (.4, .2), .75, 3, 6, 3.0, 1, 3), ('palm_m', 7.0, (1.3, .5), 1.0, 5, 7, 4.2, 2, 4),
             ('palm_l', 10.0, (1.6, -.8), 1.3, 8, 8, 5.2, 2, 4), ('palm_lean', 8.0, (4.8, 1.2), 1.1, 11, 7, 4.6, 3, 5)]
    for i, (nm, h, lean, s, seed, nfr, fl, nc, rg) in enumerate(specs):
        p = L.Part(nm, loc=(i * 14, 0, 0), ao=0.0)
        palm(p, 0, 0, h=h, lean=lean, s=s, seed=seed, nfr=nfr, fl=fl, coconuts=nc, rings=rg)
        out.append(p)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
