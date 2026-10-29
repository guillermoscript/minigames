"""ordaz_kit: Puerto Ordaz / Ciudad Guayana kit for LA FIESTA (Orinoco + Caroni confluence, steel port, Llovizna rapids).
Each Part = one instanceable piece, origin = base centre (z=0 = water level for water pieces; quays deck z=2), front = -Y."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
import prop_palmas_coco as K
import prop_ccs_city as CC
from mathutils import Vector

NAME = 'ordaz_kit'
GROUND = 0x7d9f50
PREVIEW = dict(az=0, pitch=62, fit=0.95, size=2000)
AO_DIST = 10

PI = math.pi
R = dict(rust=0x9a5438, rustD=0x74402c, rustL=0xb96d48, brick=0xa65a3c, brickD=0x8a4630, grey=0x9aa0ab, greyL=0xc4c9d2,
         greyD=0x666d79, white=0xf0eee8, whiteD=0xdcdee4, yellow=0xf2b81c, yellowD=0xc98f10, conc=0xb9bfc9, concD=0x8a93a3,
         concL=0xd3d7de, steel=0x30343c, steelL=0x5a606c, hull=0xb52a2a, hullD=0x8c1f20, hullL=0xd04436, black=0x2a2c32,
         rockD=0x6a4d3c, rock=0x8f6a4c, rockL=0xb5774e, grass=0x5a9a36, grassL=0x7ab444, grassD=0x3f7f2e,
         foam=0xf4faff, foamB=0xcfe8f8, glass=0x5f86b0, glassD=0x35557c, dark=0x3b4452, asph=0x4a4f5a, line=0xf0eee4,
         red=0xd92a2a, teja=0xc4492f, tejaO=0xd9702f, wood=0x7a5230)
CT = [0xc9483c, 0x3f6ea8, 0xe08a2c, 0x4a8a5a, 0xe8c040, 0xe8e8ea, 0x2f8f9a, 0x8a4a8a]


# ───────────────────────── helpers ─────────────────────────
def bar(p, a, b, w, h, col, tcol=None, bcol=None, caps=True):
    """Oriented rectangular bar between two points (w wide, h tall)."""
    a, b = Vector(a), Vector(b)
    d = (b - a)
    if d.length < 1e-6:
        return
    d.normalize()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
    u = d.cross(up).normalized()
    v = u.cross(d).normalized()
    if v.z < 0:
        v = -v

    def ring(c):
        return [tuple(c + u * sx * w / 2 + v * sy * h / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    p.loft([ring(a), ring(b)], col, colors=[bcol or col, col, tcol or col, col], caps=(caps, caps))


def post(p, x, y, z0, z1, w, col, tcol=None):
    p.box((x, y, z0), (w, w, z1 - z0), col, bottom=False, tcolor=tcol)


def sq(p, side, cx, cy, w, d, a0, a1, z0, z1, col):
    CC.sq(p, side, cx, cy, w, d, a0, a1, z0, z1, col)


def foam_ring(p, cx, cy, rx, ry, wd=1.5, n=10, seed=1, z=.07, inner=.9):
    rng = random.Random(seed)
    outer = [(rx + wd * (.55 + .9 * rng.random()), ry + wd * (.55 + .9 * rng.random())) for _ in range(n)]
    for i in range(n):
        j = (i + 1) % n
        a0, a1 = 2 * PI * i / n, 2 * PI * j / n
        pts = [(cx + rx * inner * math.cos(a0), cy + ry * inner * math.sin(a0), z),
               (cx + outer[i][0] * math.cos(a0), cy + outer[i][1] * math.sin(a0), z),
               (cx + outer[j][0] * math.cos(a1), cy + outer[j][1] * math.sin(a1), z),
               (cx + rx * inner * math.cos(a1), cy + ry * inner * math.sin(a1), z)]
        p.face(pts, R['foam'] if i % 2 == 0 else R['foamB'], up=True)


def rock_blob(p, cx, cy, rx, ry, h, seed, n=7, z0=-1.2, green=True, tiers=4):
    """Stratified dark-brown rock mound with a green cap; radii are x/y semi axes at z~0."""
    rng = random.Random(seed)
    jv = [1 + (rng.random() - .5) * .3 for _ in range(n)]
    span = h - z0
    spec = [(1.0, z0), (1.05, z0 + span * .42), (.92, z0 + span * .74), (.68, h)]
    if tiers == 3:
        spec = [(1.0, z0), (1.02, z0 + span * .55), (.7, h)]
    rot = rng.random() * 6.28

    def ring(f, z, k=0):
        return [(cx + rx * f * jv[i] * (1 + .04 * k * (i % 2)) * math.cos(rot + 2 * PI * i / n),
                 cy + ry * f * jv[i] * (1 + .04 * k * (i % 2)) * math.sin(rot + 2 * PI * i / n), z) for i in range(n)]
    rings = [ring(f, z, k) for k, (f, z) in enumerate(spec)]
    cols = [[R['rockD'], R['rock']], [R['rock'], R['rockL']], [R['rockL'], R['rock']]]
    ref = Vector((cx, cy, (z0 + h) / 2))
    for k in range(len(rings) - 1):
        p.loft([rings[k], rings[k + 1]], R['rock'], colors=cols[k % 3] * ((n + 1) // 2), ref=ref)
    if green:
        top = ring(.5, h + .45 + rng.random() * .3)
        p.loft([rings[-1], top], R['grass'], colors=[R['grass'], R['grassD']] * ((n + 1) // 2), ref=ref)
        p.face(top, R['grassL'], up=True)
    else:
        p.face(rings[-1], R['rockL'], up=True)


def palm_at(p, x, y, z, h, seed, lean=(0, 0), s=1.0, nfr=5, fl=3.4, rings=3, nco=0):
    n0 = len(p.bm.verts)
    K.palm(p, x, y, h=h, lean=lean, s=s, seed=seed, nfr=nfr, fl=fl, coconuts=nco, rings=rings)
    p.bm.verts.ensure_lookup_table()
    for v in list(p.bm.verts)[n0:]:
        v.co.z += z


def blob_tree(p, x, y, z, th, blobs, trunk_r, c, tc, seed):
    p.frustum((x, y, z), trunk_r, trunk_r * .65, th, 5, R['wood'], bottom=False)
    for i, (ox, oy, oz, r, sz) in enumerate(blobs):
        p.ico((x + ox, y + oy, z + th + oz), r, c, sub=0, sc=(1, 1, sz), jitter=.1, seed=seed + i, tcolor=tc)


def sink(p, d=.5):
    CC.sink(p, d)


# ───────────────────────── ship hulls ─────────────────────────
def hull(p, Lh, B, zk, zd, ctop, clow, cbot, cdeck, ns=9, bow=1.6, sw=.78, bow_start=.62, bulw=.6, cbulw=None, stern_rake=0.0):
    sts = []
    for i in range(ns):
        t = i / (ns - 1)
        x = -Lh / 2 + Lh * t
        if t < bow_start:
            w = B * (sw + (1 - sw) * lib._sstep(0, .35, t))
            rk = 0.0
        else:
            q = (t - bow_start) / (1 - bow_start)
            w = B * (1 - .93 * q ** 1.7)
            rk = bow * q ** 2
        sts.append((x, w, rk))
    rings = []
    for (x, w, rk) in sts:
        pts = [(x + rk, -w * 1.05, zd), (x + rk * .6, -w, 0.0), (x + rk * .15, -w * .85, zk * .62), (x - rk * .3, -w * .42, zk),
               (x - rk * .3, w * .42, zk), (x + rk * .15, w * .85, zk * .62), (x + rk * .6, w, 0.0), (x + rk, w * 1.05, zd)]
        rings.append(pts)
    cen = Vector((0, 0, (zk + zd) / 2))
    p.loft(rings, ctop, closed=False, colors=[ctop, clow, cbot, cbot, cbot, clow, ctop], caps=(True, True), ref=cen)
    deckpts = [r[0] for r in rings] + [r[-1] for r in reversed(rings)]
    p.face(deckpts, cdeck, up=True)
    if bulw:
        for sg, idx in ((-1, 0), (1, -1)):
            for k in range(len(rings) - 1):
                a, b = rings[k][idx], rings[k + 1][idx]
                p.face([a, b, (b[0], b[1], zd + bulw), (a[0], a[1], zd + bulw)], cbulw if cbulw is not None else ctop, flip_ref=cen)
    return sts


def windows_front(p, cx, cy, w, d, z0, z1, col, mar=.5, n=1, sides='se'):
    for sd in sides:
        L = w if sd in 'sn' else d
        sq(p, sd, cx, cy, w, d, -L / 2 + mar, L / 2 - mar, z0, z1, col)


# ───────────────────────── industrial ─────────────────────────
def alto_horno(p):
    fx = -3.0
    p.cbox((0, 0, 0), (24, 16, 1.6), R['concD'], ch=.4, tcolor=R['concL'])
    p.frustum((fx, 0, 1.6), 5.0, 5.0, 3, 8, R['rustD'], ring_colors=[R['rustD'], R['rust']])
    p.frustum((fx, 0, 4.6), 4.4, 5.7, 7, 8, R['rust'], ring_colors=[R['rust'], R['rustL']])
    p.frustum((fx, 0, 11.6), 5.7, 4.5, 11, 8, R['rustL'], ring_colors=[R['rustL'], R['rust']])
    p.frustum((fx, 0, 22.6), 4.5, 3.6, 5, 8, R['rust'], ring_colors=[R['rust'], R['rustD']])
    p.frustum((fx, 0, 27.6), 3.6, 3.9, 1.0, 8, R['steel'])
    p.frustum((fx, 0, 28.6), 3.9, 2.2, 2.0, 8, R['rustD'], tcolor=R['steel'])
    for z in (9.0, 17.0):
        p.frustum((fx, 0, z), 5.85 - (z - 9) * .05, 5.85 - (z - 9) * .05, .55, 8, R['steel'], top=False, bottom=False)
    p.frustum((fx, 0, 14.0), 5.6, 5.6, .35, 8, R['greyL'], tcolor=R['greyL'])       # catwalk ring
    # headframe tower
    base = [(-3.2, -3.0), (3.2, -3.0), (3.2, 3.0), (-3.2, 3.0)]
    topq = [(-1.3, -1.2), (1.3, -1.2), (1.3, 1.2), (-1.3, 1.2)]
    zb, zt = 30.5, 47.0
    for (bx, by), (tx, ty) in zip(base, topq):
        p.beam((fx + bx, by, zb), (fx + tx, ty, zt - 3), .5, R['rustD'], sides=4)
    levels = (36.0, 42.0)
    zs = [zb] + list(levels) + [zt - 3]
    def at(z, i):
        t = (z - zb) / (zt - 3 - zb)
        bx, by = base[i]
        tx, ty = topq[i]
        return (fx + bx + (tx - bx) * t, by + (ty - by) * t, z)
    for z in levels:
        for i in range(4):
            p.beam(at(z, i), at(z, (i + 1) % 4), .28, R['rust'], sides=3)
    for k in range(3):
        za, zbb = zs[k], zs[k + 1]
        for i in range(4):
            j = (i + 1) % 4
            if k < 1:
                p.beam(at(za, i), at(zbb, j), .2, R['rustL'], sides=3)
    p.cbox((fx, 0, 44.0), (4.6, 3.6, 3.4), R['rustD'], ch=.3, tcolor=R['rustL'])
    p.box((fx, -1.9, 44.6), (3.0, .3, 1.6), R['steel'])
    p.beam((fx, 0, 47.4), (fx, 0, 50.0), .12, R['steel'], sides=3)
    # skip hoist (front incline)
    p.beam((fx - .9, -7.6, 1.7), (fx - .9, -4.4, 29.0), .22, R['steel'], sides=3)
    p.beam((fx + .9, -7.6, 1.7), (fx + .9, -4.4, 29.0), .22, R['steel'], sides=3)
    bar(p, (fx, -7.6, 1.7), (fx, -4.4, 29.0), 1.5, .3, R['rustD'])
    p.cbox((fx, -6.4, 9.0), (1.8, 2.0, 1.6), R['yellow'], ch=.2)
    # conveyor to the top
    a, b = Vector((11.0, 0, 3.4)), Vector((fx + 1.0, 0, 41.0))
    bar(p, a, b, 2.0, 1.7, R['rustL'], tcol=R['rust'], bcol=R['rustD'])
    for t in (.3, .62):
        q = a + (b - a) * t
        post(p, q.x, 0, 1.6, q.z - .8, .6, R['rustD'])
    p.cbox((11.0, 0, 1.6), (3.0, 3.2, 2.6), R['rustD'], ch=.3, tcolor=R['rust'])
    # hot-blast stoves + ducts
    for sy in (-1, 1):
        y = sy * 5.0
        p.frustum((6.8, y, 1.6), 2.4, 2.4, 17, 8, R['rust'], bottom=False, ring_colors=[R['rust'], R['rustL']])
        p.frustum((6.8, y, 18.6), 2.4, .01, 2.4, 8, R['rustD'])
        p.beam((fx + 4.2, sy * 1.5, 13), (6.8, y, 13), .5, R['steel'], sides=5)
    # control house
    p.cbox((-8.5, -5.2, 1.6), (6, 4, 3.0), R['whiteD'], ch=.25, tcolor=R['greyL'])
    sq(p, 's', -8.5, -5.2, 6, 4, -2.3, 2.3, 2.1, 3.5, R['glassD'])
    sq(p, 's', -8.5, -5.2, 6, 4, -1.8, -.6, 1.6, 2.1, R['dark'])


def chimenea(p, h, r0, r1, cols, band, plinth=2.4):
    p.cbox((0, 0, 0), (plinth * 2, plinth * 2, 2.4), R['concD'], ch=.4, tcolor=R['concL'])
    segs = 4
    zs = [2.4]
    hh = (h - 2.4 - 1.4)
    fr = [.34, .28, .22, .16]
    z = 2.4
    for k in range(segs):
        ra = r0 + (r1 - r0) * (z - 2.4) / hh
        z2 = z + hh * fr[k]
        rb = r0 + (r1 - r0) * (z2 - 2.4) / hh
        col = band if k == 2 else cols[k % 2]
        p.frustum((0, 0, z), ra, rb, z2 - z, 6, col, ring_colors=[col, cols[1] if col == cols[0] else col], top=False, bottom=False)
        z = z2
    p.frustum((0, 0, z), r1 * 1.18, r1 * 1.1, 1.4, 6, R['steel'], tcolor=R['black'])
    p.beam((r0 * .95, 0, 3.0), (r1 * 1.1, 0, h - 1.5), .13, R['steelL'], sides=3)
    p.beam((0, 0, h), (0, 0, h + 2.2), .09, R['steel'], sides=3)
    p.cbox((0, -r0 * 1.15, 0), (r0 * 1.1, 1.0, 3.2), R['rustD'], ch=.25)


def tanque(p, variant):
    n = 8
    p.frustum((0, 0, 0), 7.3, 7.3, .6, n, R['concD'], tcolor=R['concL'])
    if variant == 0:
        p.frustum((0, 0, .6), 7, 7, 9.9, n, R['white'], bottom=False, top=False, ring_colors=[R['white'], R['whiteD']])
        p.frustum((0, 0, 10.5), 7, 1.8, 1.5, n, R['whiteD'], bottom=False, tcolor=R['greyL'])
        p.frustum((0, 0, 9.6), 7.3, 7.3, .55, n, R['steelL'], bottom=False, top=False)
        pk = 12.0
    else:
        p.frustum((0, 0, .6), 7, 7, 4.0, n, R['white'], bottom=False, top=False, ring_colors=[R['white'], R['whiteD']])
        p.frustum((0, 0, 4.6), 7, 7, 2.2, n, 0x5f86b0, bottom=False, top=False, ring_colors=[0x5f86b0, 0x4f7aa6])
        p.frustum((0, 0, 6.8), 7, 7, 3.7, n, R['white'], bottom=False, top=False, ring_colors=[R['white'], R['whiteD']])
        p.frustum((0, 0, 10.5), 7, 3.2, 1.3, n, R['greyL'], bottom=False, top=True, tcolor=R['whiteD'])
        p.frustum((0, 0, 11.8), 3.2, 3.2, .35, n, R['steelL'])
        p.cbox((0, 0, 11.8), (1.2, 1.2, 1.1), R['steel'], ch=.15)
        # side pipe + pump
    # stair ring (helical)
    steps = 5
    for k in range(steps):
        a0 = -2.4 + k * (4.4 / steps)
        a1 = a0 + 4.4 / steps
        z0 = .6 + k * (9.4 / steps)
        z1 = z0 + 9.4 / steps
        r = 7.5
        bar(p, (r * math.cos(a0), r * math.sin(a0), z0), (r * math.cos(a1), r * math.sin(a1), z1), .9, .25, R['yellowD'] if variant else R['steelL'], caps=False)
    p.frustum((0, 0, 9.8), 7.45, 7.45, .45, n, R['yellowD'] if variant else R['steelL'], top=False, bottom=False)


def nave(p, k):
    spec = {0: (24, 12, 6.0, 0xaab0ba, 0x8f97a4, 0x7a828f, 0x636a77, 3),
            1: (18, 10, 5.2, 0xe8e6e0, 0xb7bcc6, 0x9a5438, 0x74402c, 2),
            2: (30, 12, 5.6, 0xa7adb8, 0x8a92a0, 0x5f6c80, 0x4a5568, 4)}[k]
    w, d, h, wall, dado, roof, roof2, nd = spec
    p.cbox((0, 0, 0), (w, d, h), wall, ch=.25, tcolor=wall)
    sq(p, 's', 0, 0, w, d, -w / 2 + .3, w / 2 - .3, 0, 1.1, dado)
    sq(p, 's', 0, 0, w, d, -w / 2 + 1.2, w / 2 - 1.2, h - 1.9, h - .9, R['glassD'])
    dw = (w - 2) / nd
    for i in range(nd):
        cx = -w / 2 + 1 + dw * (i + .5)
        sq(p, 's', 0, 0, w, d, cx - dw * .34, cx + dw * .34, 0, h - 2.4, R['dark'] if i % 2 == 0 else R['steelL'])
    sq(p, 'e', 0, 0, w, d, -d / 4, d / 4, h - 2.8, h - 1.4, R['glassD'])
    p.gable((0, 0, h - .1), w, d, 2.6 if k != 1 else 2.2, roof, roof2, strips=2, overhang=.35)
    p.box((0, 0, h + 2.3), (w * .5, .9, .45), R['steelL'], bottom=False)       # ridge vent
    if k == 0:
        p.cbox((w / 2 + 1.5, 0, 0), (3, d - 3, 3.4), R['whiteD'], ch=.2, tcolor=R['greyL'])
        p.frustum((-w / 2 + 3, 1, h + .3), .55, .55, 3.6, 6, R['rustD'], tcolor=R['black'])
    elif k == 1:
        p.cbox((-w / 2 - 1.4, 0, 0), (2.8, d - 2, 3.0), R['greyL'], ch=.2, tcolor=R['concL'])
        p.frustum((w / 2 - 3, 0, h + .3), .6, .6, 4.2, 6, R['rustD'], tcolor=R['black'])
    else:
        for i in (-1, 1):
            p.cbox((i * w * .3, -d / 2 - 1.0, 0), (4.4, 2.0, 2.6), R['greyL'], ch=.2, tcolor=R['concL'])
        p.beam((w / 2 + .3, -d / 2 + 1, 0), (w / 2 + .3, -d / 2 + 1, h + 1.2), .18, R['steelL'], sides=3)


def silo(p):
    p.box((0, 0, 0), (15, 9, 1.4), R['concD'], bottom=False, tcolor=R['concL'])
    for (x, y, h, c) in ((-4.6, 0, 15, R['white']), (0, 0, 12.5, R['whiteD']), (4.6, 0, 10, R['white'])):
        p.frustum((x, y, 1.4), 2.7, 2.7, h - 2.5, 6, c, bottom=False, top=False, ring_colors=[c, R['greyL']])
        p.frustum((x, y, h - 1.1), 2.7, .01, 1.4, 6, R['rustD'])
        p.frustum((x, y, 5.0), 2.85, 2.85, .5, 6, R['steelL'], top=False, bottom=False)
    bar(p, (-4.6, 0, 14.4), (0, 0, 12.4), 1.0, .3, R['yellowD'])
    bar(p, (0, 0, 12.4), (4.6, 0, 10.0), 1.0, .3, R['yellowD'])
    p.beam((-6.9, -2.2, 1.4), (-6.9, -2.2, 14.0), .15, R['steelL'], sides=3)
    p.box((0, -4.3, 1.4), (4.4, 2.0, 2.4), R['rustD'], bottom=False, tcolor=R['rust'])
    p.beam((0, -3.4, 2.5), (0, -3.4, 8.0), .3, R['steel'], sides=4)


def tuberia(p):
    for x in (-6.5, 0.0, 6.5):
        for sg in (-1, 1):
            p.beam((x, sg * 2.3, 0), (x, sg * 2.3, 5.2), .3, R['rustD'], sides=3)
        p.box((x, 0, 5.0), (.6, 5.8, .5), R['rust'], bottom=False)
    for (y, z, r, c) in ((-1.6, 6.0, .75, R['steelL']), (0.1, 6.2, .55, R['rustL']), (1.7, 6.0, .8, R['greyL'])):
        p.beam((-8.2, y, z), (8.2, y, z), r, c, sides=5)
    p.beam((4.0, -1.6, 6.0), (4.0, -1.6, 8.6), .7, R['steelL'], sides=4)
    p.beam((4.0, -1.6, 8.6), (6.8, -1.6, 8.6), .7, R['steelL'], sides=4)
    p.box((1.6, 1.7, 6.8), (.25, .25, .8), R['steel'], bottom=False)
    p.box((1.6, 1.7, 7.5), (.9, .2, .2), R['red'], bottom=False)


def cinta(p):
    for x in (-6.0, 0.0, 6.0):
        for s in (-1, 1):
            p.beam((x, s * 1.1, 0), (x + s * .01, s * 1.1, 4.4), .22, R['rustD'], sides=3)
    p.cbox((0, 0, 4.4), (16.6, 2.6, 1.0), R['rustD'], ch=.2)                  # truss deck
    p.cbox((0, 0, 5.4), (16, 2.2, 2.0), R['greyL'], ch=.45, tcolor=R['whiteD'])  # cover
    sq(p, 's', 0, 0, 16, 2.2, -7, 7, 6.2, 6.8, R['dark'])
    for x in (-5.5, 0, 5.5):
        sq(p, 's', 0, 0, 16, 2.2, x - .5, x + .5, 5.5, 6.9, R['steelL'])
    p.cbox((8.6, 0, 3.4), (3.2, 3.4, 3.6), R['rust'], ch=.3, tcolor=R['rustL'])
    p.cbox((-8.6, 0, 4.0), (2.4, 2.8, 3.4), R['rust'], ch=.3, tcolor=R['rustL'])
    p.beam((8.6, 0, 7.0), (8.6, 0, 9.0), .2, R['steel'], sides=3)


# ───────────────────────── port ─────────────────────────
def grua_muelle(p):
    Y = R['yellow']
    for sx in (-3.4, 3.4):
        for sy in (-7, 7):
            bar(p, (sx, sy, 0.6), (sx, sy * .96, 12.6), 1.1, 1.1, Y, tcol=R['yellowD'], caps=False)
        p.cbox((sx, 0, 0), (1.6, 15.2, .6), R['steel'], ch=.15)
        bar(p, (sx, -7, 12.6), (sx, 7, 12.6), 1.2, 1.0, Y, tcol=Y)
    for sy in (-7, 7):
        bar(p, (-3.4, sy, 12.6), (3.4, sy, 12.6), 1.0, 1.0, R['yellowD'])
    # A-frame and boom
    for sx in (-2.8, 2.8):
        bar(p, (sx, -7, 12.8), (sx * .5, -3.5, 18.6), .8, .8, Y, caps=False)
        bar(p, (sx, 5, 12.8), (sx * .5, -3.5, 18.6), .8, .8, Y, caps=False)
    bar(p, (0, 9.5, 13.4), (0, -15.5, 14.4), 1.8, 1.5, Y, tcol=R['yellowD'])
    bar(p, (0, -15.5, 14.9), (0, -8, 14.9), .5, .3, R['yellowD'])
    p.beam((0, -3.5, 18.6), (0, -15.5, 14.8), .13, R['steel'], sides=3)
    p.beam((0, -3.5, 18.6), (0, 9.5, 13.9), .13, R['steel'], sides=3)
    p.cbox((0, 6.2, 14.9), (3.6, 4.6, 2.4), R['white'], ch=.3, tcolor=R['whiteD'])
    sq(p, 's', 0, 6.2, 3.6, 4.6, -1.2, 1.2, 15.8, 16.8, R['glassD'])
    p.cbox((0, 6.0, 14.9), (1.6, 1.6, .01), R['steel'], ch=.01)
    p.cbox((0, -9.5, 12.4), (2.2, 2.2, 1.4), R['steel'], ch=.2)                   # trolley
    p.beam((0, -9.5, 12.4), (0, -9.5, 6.2), .12, R['steelL'], sides=3)
    p.cbox((0, -9.5, 5.2), (1.6, 3.4, .9), R['steel'], ch=.15)
    p.cbox((0, -9.5, 6.1), (1.0, 1.0, .5), R['dark'], ch=.1)


def container_stack(p, nx, ny, hs, seed, cl=6.0, cw=3.0, ch=2.4, stagger=False):
    rng = random.Random(seed)
    for ix in range(nx):
        for iy in range(ny):
            n = hs if not stagger else max(1, hs - rng.randint(0, 2))
            for k in range(n):
                c = CT[rng.randrange(len(CT))]
                door = R['steelL']
                x = (ix - (nx - 1) / 2) * cl
                y = (iy - (ny - 1) / 2) * cw
                p.box((x, y, k * ch), (cl - .06, cw - .06, ch - .04), c, bottom=False, colors={'e': door, 'w': door, 't': c})


def pila_bobinas(p):
    p.box((0, 0, 0), (14, 8.4, .6), R['concD'], bottom=False, tcolor=R['concL'])
    def coil(x, y, z, c):
        p.frustum((x, y, z), 1.75, 1.75, 2.1, 5, c, tcolor=R['steelL'], bottom=False, ring_colors=[c, R['steelL']])
    for k, x in enumerate((-3.8, 0, 3.8)):
        for iy, y in enumerate((-1.9, 1.9)):
            coil(x, y, .6, (R['grey'], R['greyL'], R['rustL'])[(k + iy) % 3])
    for k, x in enumerate((-1.9, 1.9)):
        coil(x, 0, 2.7, (R['rustL'], R['greyL'])[k])
    coil(0, 0, 4.8, R['grey'])
    p.cbox((6.2, -1.2, .6), (1.6, 1.6, 1.0), R['rustD'], ch=.15)


def muelle(p, L=30, W=10, bollards=4):
    """Concrete pier along X, deck top z=2, front edge (water side) at -Y."""
    p.cbox((0, 0, .8), (L, W, 1.2), R['concD'], ch=.25, tcolor=R['conc'])
    p.face([(-L / 2 + .3, -W / 2 + .1, 2.0), (L / 2 - .3, -W / 2 + .1, 2.0), (L / 2 - .3, -W / 2 + .6, 2.0), (-L / 2 + .3, -W / 2 + .6, 2.0)], R['yellow'], up=True)
    for x in (-L / 2 + 3, L / 2 - 3):
        post(p, x, -W / 2 + 2.5, -3.0, .8, 1.0, R['concD'])
        post(p, x, W / 2 - 2.5, -3.0, .8, 1.0, R['concD'])
    for i in range(bollards):
        x = -L / 2 + 3 + i * (L - 6) / (bollards - 1)
        p.box((x, -W / 2 + 1.2, 2.0), (.8, .8, .6), R['steel'], bottom=False, tcolor=R['steelL'])
        p.box((x, -W / 2 - .45, 0.3), (1.6, .5, 1.6), R['black'], bottom=False, tcolor=R['steelL'])      # fender
    for y in (-W / 2 + 3.0, W / 2 - 3.0):
        p.face([(-L / 2 + .6, y - .14, 2.02), (L / 2 - .6, y - .14, 2.02), (L / 2 - .6, y + .14, 2.02), (-L / 2 + .6, y + .14, 2.02)], R['steelL'], up=True)
    for x in (-L / 2 + 4, L / 2 - 4):
        p.beam((x, W / 2 - 1, 2.0), (x, W / 2 - 1, 7.5), .16, R['steelL'], sides=3)
        p.box((x, W / 2 - 1.6, 7.3), (.6, 1.4, .3), R['yellowD'], bottom=False)


def muelle_esquina(p):
    for (x, y) in ((-4, -4), (4, -4), (-4, 4)):
        p.box((x, y, .8), (8, 8, 1.2), R['concD'], bottom=False, tcolor=R['conc'])
    p.face([(-8, -8, 2.0), (8, -8, 2.0), (8, -7.5, 2.0), (-8, -7.5, 2.0)], R['yellow'], up=True)
    p.face([(-8, -8, 2.0), (-7.5, -8, 2.0), (-7.5, 8, 2.0), (-8, 8, 2.0)], R['yellow'], up=True)
    for (x, y) in ((-4.5, -8.4), (4.5, -8.4)):
        p.box((x, y, .3), (1.6, .5, 1.6), R['black'], bottom=False, tcolor=R['steelL'])
    for (x, y) in ((-8.4, -4.5), (-8.4, 4.5)):
        p.box((x, y, .3), (.5, 1.6, 1.6), R['black'], bottom=False, tcolor=R['steelL'])
    for (x, y) in ((-6.4, -6.4), (0, -6.4), (-6.4, 0), (-6.4, 6.4), (6.4, -6.4)):
        p.box((x, y, 2.0), (.8, .8, .6), R['steel'], bottom=False, tcolor=R['steelL'])
    for (x, y) in ((-6, -6), (6, -6), (-6, 6)):
        post(p, x, y, -3.0, .8, 1.0, R['concD'])
    p.beam((-7, 7, 2.0), (-7, 7, 7.5), .16, R['steelL'], sides=3)
    p.box((-7, 6.4, 7.3), (.6, 1.4, .3), R['yellowD'], bottom=False)
    p.cbox((-3.5, 4, 2.0), (4.6, 3.2, 2.6), R['whiteD'], ch=.2, tcolor=R['greyL'])
    sq(p, 's', -3.5, 4, 4.6, 3.2, -1.6, 1.6, 3.0, 4.0, R['glassD'])


# ───────────────────────── ships ─────────────────────────
def buque(p):
    sts = hull(p, 34, 5.4, -2.4, 3.2, R['hull'], R['hullD'], R['hullD'], R['black'], ns=9, bow=2.0, sw=.78, bulw=0)
    zd = 3.2
    # stern house
    hx = -12.4
    p.cbox((hx, 0, zd), (6.6, 7.6, 2.4), R['white'], ch=.25, tcolor=R['whiteD'])
    p.cbox((hx, 0, zd + 2.4), (5.6, 6.8, 2.2), R['white'], ch=.25, tcolor=R['whiteD'])
    p.cbox((hx + .4, 0, zd + 4.6), (4.6, 8.8, 1.8), R['white'], ch=.25, tcolor=R['whiteD'])   # bridge with wings
    for z0, z1, w, d, cx in ((zd + .6, zd + 1.7, 6.6, 7.6, hx), (zd + 3.0, zd + 4.0, 5.6, 6.8, hx), (zd + 5.0, zd + 6.1, 4.6, 8.8, hx + .4)):
        for sd in 'se':
            L = w if sd == 's' else d
            sq(p, sd, cx, 0, w, d, -L / 2 + .5, L / 2 - .5, z0, z1, R['glassD'])
        sq(p, 'n', cx, 0, w, d, -L / 2 + .5, L / 2 - .5, z0, z1, R['glassD']) if False else None
    p.frustum((hx - 2.4, 0, zd + 4.6), 1.45, 1.2, 3.4, 8, R['hull'], tcolor=R['black'], ring_colors=[R['hull'], R['hullL']])
    p.frustum((hx - 2.4, 0, zd + 8.0), 1.25, 1.35, .7, 8, R['black'], tcolor=R['black'])
    p.beam((hx + .6, 0, zd + 6.4), (hx + .6, 0, zd + 9.8), .12, R['steel'], sides=3)
    p.box((hx + .6, 0, zd + 8.6), (.2, 2.4, .12), R['steel'])
    # hatches
    hxs = (-3.4, 3.2, 9.8)
    for i, x in enumerate(hxs):
        p.box((x, 0, zd), (5.6, 6.2, .8), R['hullD'], bottom=False, tcolor=R['hull'])
        if i == 0:
            p.ico((x, 0, zd + .5), 2.6, 0x8a4a2f, sub=1, sc=(1.0, 1.0, .35), jitter=.12, seed=4, tcolor=0xa75a38)
        else:
            for iy in (-1.5, 1.5):
                for k in range(2):
                    c = CT[(i * 3 + k + (1 if iy > 0 else 0)) % len(CT)]
                    p.box((x, iy, zd + .8 + k * 2.3), (5.4, 2.9, 2.25), c, bottom=False, colors={'e': R['steelL'], 'w': R['steelL']})
    for x in (.1, 6.5):
        post(p, x, 0, zd, zd + 3.6, .8, R['whiteD'])
        bar(p, (x, 0, zd + 3.6), (x + 2.8, 2.8, zd + 6.8), .35, .35, R['yellow'], caps=False)
    p.beam((14.7, 0, zd + 1), (14.7, 0, zd + 5.4), .12, R['steel'], sides=3)


def remolcador(p):
    hull(p, 10, 2.3, -1.2, 1.5, 0x2f3a4a, 0x252f3c, 0x1d242e, 0x6a7482, ns=4, bow=.8, sw=.85, bow_start=.5, bulw=0, cbulw=0xc9483c)
    p.cbox((-.8, 0, 1.5), (4.4, 3.2, 2.0), R['white'], ch=.25, tcolor=R['whiteD'])
    p.cbox((-1.0, 0, 3.5), (2.6, 2.6, 1.3), R['white'], ch=.2, tcolor=R['whiteD'])
    for z0, z1, cx, w in ((1.9, 2.9, -.8, 4.4), (3.7, 4.5, -1.0, 2.6)):
        sq(p, 'e', cx, 0, w, 3.2 if w > 3 else 2.6, -1.0, 1.0, z0, z1, R['glassD'])
        sq(p, 's', cx, 0, w, 3.2 if w > 3 else 2.6, -w / 2 + .5, w / 2 - .5, z0, z1, R['glassD'])
    p.frustum((-2.4, 0, 3.0), .85, .7, 2.2, 8, R['red'], tcolor=R['black'])
    p.beam((-1.0, 0, 4.8), (-1.0, 0, 6.4), .09, R['steel'], sides=3)
    p.box((3.9, 0, .2), (1.2, 3.2, 1.4), R['black'], tcolor=R['steelL'])     # bow fender


def gabarra(p):
    hull(p, 16, 3.5, -1.3, 1.7, 0x3d5a78, 0x2e465f, 0x24384d, 0x57616e, ns=4, bow=1.4, sw=.97, bow_start=.8, bulw=.45, cbulw=0x3d5a78)
    for i, ix in enumerate((-3.3, 3.3)):
        for iy in (-1.55, 1.55):
            for k in range(2):
                c = CT[(i * 2 + k + (1 if iy > 0 else 0) * 3) % len(CT)]
                p.box((ix, iy, 1.7 + k * 2.4), (6.0, 3.0, 2.34), c, bottom=False, colors={'e': R['steelL'], 'w': R['steelL']})
    p.cbox((-7.0, 0, 1.7), (1.6, 2.4, 1.8), R['whiteD'], ch=.15)
    p.box((7.4, 0, 1.7), (.8, 1.0, 1.0), R['steelL'], bottom=False)


# ───────────────────────── city ─────────────────────────
W = CC.W
_vol0 = CC.vol


def _vol(p, cx, cy, w, d, z0, z1, wall, glass, nf, win='ribbon', sides='se', **kw):
    _vol0(p, cx, cy, w, d, z0, z1, wall, glass, nf, win, sides='se', **kw)


CC.vol = _vol


def torre_oscura(p, k):
    wall = (0x3c424e, 0x4a505c)[k]
    glassc = (0x5b7692, 0x66829e)[k]
    h = (55, 50)[k] - (13.6, 5.8)[k]
    nf = (14, 12)[k]
    w = d = 10
    p.cbox((0, 0, 0), (w + 3.0, d + 3.0, 4.2), 0x6f7682, ch=.35, tcolor=0x8a909a)
    sq(p, 's', 0, 0, w + 3, d + 3, -w / 2 - .8, w / 2 + .8, .5, 3.2, W['dark'])
    if k == 0:
        CC.vol(p, 0, 0, w, d, 4.0, h, wall, glassc, nf, 'ribbon', top=0x6f7682, ch=.5, mar=.55, frac=.62)
        p.cbox((0, 0, h - .2), (w * .78, d * .78, 3.0), 0x6f7682, ch=.3, tcolor=0x8a909a)
        p.cbox((0, 0, h + 2.6), (w * .4, d * .4, 2.0), wall, ch=.25, tcolor=0x8a909a)
        CC.ant(p, 0, 0, h + 4.6, 9)
        for sx in (-1, 1):                                           # light vertical fins
            p.box((sx * (w / 2 - .12), -d / 2 - .08, 4.0), (.45, .3, h - 6), 0x8a909a, bottom=False)
    else:
        h1 = h * .62
        CC.vol(p, 0, 0, w, d, 4.0, h1, wall, glassc, nf - 4, 'ribbon', top=0x6f7682, ch=.5, mar=.55, frac=.62)
        CC.vol(p, 1.2, .8, w * .74, d * .74, h1, h, 0x5a606c, glassc, 4, 'ribbon', top=0x8a909a, ch=.4, mar=.5, frac=.62)
        p.cbox((1.2, .8, h - .2), (w * .74 + .5, d * .74 + .5, 1.0), 0x6f7682, ch=.25, tcolor=0x8a909a)
        CC.wedge(p, 1.2, .8, w * .5, d * .5, h + .8, 3.4, 0x2f3a4a, 0x6f7682, False)
        CC.ant(p, -1.5, 0, h + .8, 5)
        p.box((0, -d / 2 - .08, 4.0), (.5, .3, h1 - 4), 0x8a909a, bottom=False)


def edificios(parts):
    G = W
    sh = G['dark']
    gl, gl2, gl3 = 0x5f86b0, 0x7fa6cc, 0x35557c
    out = {}
    out['edif_gris_01'] = lambda p: CC.e_slab(p, 10, 9, 20, 0xc3c7cf, G['white'], gl, 6, 'punched', G['roof'], ['tank', 'unit'], 21, shop=sh)
    out['edif_gris_02'] = lambda p: CC.e_setback(p, 12, 10, 22, 0xaab0ba, 0xdfe2e8, G['white'], gl, 7, ['tank', 'ant'], 22, sh)
    out['edif_gris_03'] = lambda p: CC.e_corner(p, 12, 10, 23, 0xb8bdc6, 0xd6d9df, gl3, 8, G['white'], ['tank', 'unit'], 23, sh)
    out['edif_gris_04'] = lambda p: CC.e_twin(p, 13, 10, 18, 23, 0xd4d7dd, 0xa9afb9, G['white'], gl2, 6, 8, ['tank', 'ant', 'unit'], 24, sh)
    out['edif_gris_05'] = lambda p: CC.e_terrace(p, 12, 11, 22, 0xcfd3da, gl, G['white'], G['sageD'], ['tank', 'dish'], 25)
    out['edif_gris_06'] = lambda p: CC.e_round(p, 5.4, .95, 22, 0xe4e6ea, gl3, 4, 0x8a909a, ['tank', 'ant'], 26)
    out['edif_terracota_01'] = lambda p: CC.e_slab(p, 11, 9, 18, 0xc4724f, G['white'], gl3, 6, 'punched', G['roof'], ['tank', 'unit'], 31, shop=sh)
    out['edif_terracota_02'] = lambda p: CC.e_balcony(p, 10, 9, 20, 0xd4875e, gl2, 6, G['white'], G['terraD'], G['terra'],
                                                      [(5.5, G['mustard']), (8.8, G['mustard']), (12.1, G['mustard']), (15.4, G['mustard'])], ['tank'], 32, sh)
    out['edif_terracota_03'] = lambda p: CC.e_setback(p, 13, 11, 21, 0xc4724f, G['sand'], G['white'], gl, 7, ['unit', 'tank'], 33, sh)
    out['edif_terracota_04'] = lambda p: CC.e_corner(p, 12, 10, 21, 0xb95f43, 0xe8d9bc, gl, 7, G['white'], ['tank', 'dish'], 34, sh)
    return out


def hedge(p, x, y, w, d=1.0, h=.8):
    p.box((x, y, 0), (w, d, h), R['grassD'], bottom=False, tcolor=R['grassL'])


def casa_og(p, k):
    wl = [0xf0e6cf, 0xe8d3a8, 0xd9a98a, 0xf2efe6, 0xdcc9a0, 0xe9c9b0][k - 1]
    path = 0xd9c9a0
    if k == 1:
        w, d = 8.4, 7.0
        p.cbox((0, 0, 0), (w, d, 3.8), wl, ch=.25)
        CC.hip(p, 0, 0, w, d, 3.5, 2.5, R['teja'], 0xa63a26)
        p.box((w * .26, d * .2, 5.0), (.9, .9, 2.0), R['brick'], bottom=False)
        sq(p, 's', 0, 0, w, d, -3.0, -1.4, 1.0, 2.6, W['win'])
        sq(p, 's', 0, 0, w, d, 1.8, 3.4, 1.0, 2.6, W['win'])
        sq(p, 's', 0, 0, w, d, -.6, .6, 0, 2.5, W['door'])
        p.face([(-.9, -d / 2 - 6, .03), (.9, -d / 2 - 6, .03), (.9, -d / 2, .03), (-.9, -d / 2, .03)], path, up=True)
    elif k == 2:
        w, d = 7.4, 8.0
        p.cbox((0, 0, 0), (w, d, 6.4), wl, ch=.25)
        p.gable((0, 0, 6.0), w, d, 2.6, R['tejaO'], R['teja'], strips=2, overhang=.5)
        for sx in (-1, 1):
            sq(p, 's', 0, 0, w, d, sx * 1.9 - .6, sx * 1.9 + .6, 1.0, 2.4, W['win'])
            sq(p, 's', 0, 0, w, d, sx * 1.9 - .6, sx * 1.9 + .6, 4.0, 5.4, W['win'])
        sq(p, 's', 0, 0, w, d, -.5, .5, 0, 2.5, W['door'])
        CC.balc(p, 0, -d / 2, 3.6, 3.4, R['white'], R['wood'], depth=1.1, hh=.45)
        p.cbox((-w / 2 - 2.0, -.5, 0), (3.6, 5.6, 2.6), R['whiteD'], ch=.2)
    elif k == 3:
        p.cbox((0, 0, 0), (8.6, 5.4, 4.0), wl, ch=.25)
        p.cbox((-2.2, 3.4, 0), (4.2, 6.0, 4.0), wl, ch=.25)
        p.gable((0, 0, 3.6), 8.6, 5.4, 2.2, R['teja'], 0xa63a26, strips=2, overhang=.4)
        p.gable((-2.2, 3.4, 3.6), 6.0, 4.2, 2.2, R['tejaO'], R['teja'], rz=PI / 2, strips=2, overhang=.4)
        sq(p, 's', 0, 0, 8.6, 5.4, -3.2, -1.8, 1.0, 2.6, W['win'])
        sq(p, 's', 0, 0, 8.6, 5.4, 2.0, 3.6, 1.0, 2.6, W['win'])
        sq(p, 's', 0, 0, 8.6, 5.4, -.5, .5, 0, 2.5, W['door'])
    elif k == 4:
        p.cbox((0, 0, 0), (7.8, 7.0, 3.8), 0xe9e1cf, ch=.2)
        CC.wedge(p, 0, 0, 7.8, 7.0, 3.6, 2.4, R['tejaO'], 0xb0aea8, True, ov=.5)
        p.cbox((1.0, -3.7, 0), (4.0, 1.6, 3.0), R['white'], ch=.15, tcolor=R['concL'])
        sq(p, 's', 0, 0, 7.8, 7.0, -3.2, -.4, 1.0, 2.7, W['glassD'])
        sq(p, 's', 0, 0, 7.8, 7.0, 1.6, 3.0, 0, 2.5, W['door'])
    elif k == 5:
        w, d = 9.2, 6.4
        p.cbox((0, 0, 0), (w, d, 4.0), wl, ch=.25)
        CC.hip(p, 0, 0, w, d, 3.6, 2.2, R['teja'], 0xa63a26, flat=.35)
        p.gable((0, -d / 2 - .8, 3.0), 3.6, 2.0, 1.6, R['tejaO'], R['teja'], rz=PI / 2, strips=1, overhang=.2)
        p.box((0, -d / 2 - 1.2, 0), (6.4, 2.4, .5), 0xe9e1cf, bottom=False)
        for sx in (-2.6, 2.6):
            p.beam((sx, -d / 2 - 2.0, .5), (sx, -d / 2 - 2.0, 3.0), .22, R['white'], 4)
        for sx in (-3.0, 3.0):
            sq(p, 's', 0, 0, w, d, sx - .6, sx + .6, 1.0, 2.6, W['win'])
        sq(p, 's', 0, 0, w, d, -.55, .55, 0, 2.6, W['door'])
    else:
        p.cbox((0, 0, 0), (7.6, 6.4, 3.6), wl, ch=.25)
        CC.hip(p, 0, 0, 7.6, 6.4, 3.3, 2.0, R['teja'], 0xa63a26)
        p.box((-2.4, 0, 4.6), (1.0, 1.0, 2.0), R['brick'], bottom=False)
        p.cbox((5.4, 0, 0), (3.8, 5.4, 2.6), R['whiteD'], ch=.15)
        for sx in (3.5, 7.3):
            post(p, sx, -2.4, 0, 2.6, .3, R['wood'])
        sq(p, 's', 0, 0, 7.6, 6.4, -2.6, -1.0, 1.0, 2.4, W['win'])
        sq(p, 's', 0, 0, 7.6, 6.4, .6, 2.2, 0, 2.4, W['door'])
    # garden: small tree + flower bed
    tx, ty = (4.8, -5.2) if k in (1, 3, 6) else (-4.8, -5.0)
    blob_tree(p, tx, ty, 0, 1.6, [(0, 0, 1.4, 1.6, .9)], .28, R['grass'], R['grassL'], k * 7)


# ───────────────────────── bridge ─────────────────────────
def puente_recto(p):
    z = 10.0
    ring = lambda x: [(x, -4.5, z), (x, 4.5, z), (x, 4.5, z - 1.1), (x, 3.0, z - 1.7), (x, -3.0, z - 1.7), (x, -4.5, z - 1.1)]
    p.loft([ring(-12), ring(12)], R['asph'], colors=[R['asph'], R['conc'], R['concD'], R['concD'], R['concD'], R['conc']], caps=(True, True))
    # note: loft edge order runs along ring; first ring points are (-x..)
    for sy in (-1, 1):
        p.box((0, sy * 4.15, z), (24, .7, 1.05), R['conc'], bottom=False, tcolor=R['concL'], colors={})
        p.box((0, sy * 3.5, z + .02), (24, .1, .03), R['line'])
    for x in (-9.6, -4.8, 0, 4.8, 9.6):
        p.face([(x - .8, -.12, z + .03), (x + .8, -.12, z + .03), (x + .8, .12, z + .03), (x - .8, .12, z + .03)], R['line'], up=True)
    for x, sy in ((-8.0, -1), (8.0, 1)):
        p.beam((x, sy * 4.15, z), (x, sy * 4.15, z + 4.6), .13, R['steelL'], sides=3)
        p.box((x, sy * 3.0, z + 4.55), (.4, 2.3, .2), R['steel'], bottom=False)
    for x in (-8, 0, 8):
        p.frustum((x, 0, -3), 1.5, 1.2, 10.4, 4, R['conc'], rz=PI / 4, sy=1.7, ring_colors=[R['conc'], R['concD'], R['conc'], R['concD']])
        p.cbox((x, 0, 7.0), (3.4, 8.0, 1.2), R['concL'], ch=.3, tcolor=R['conc'])


def puente_pila(p):
    z0 = 10.0
    xs = [-8.0, -2.0, 8.0]
    zt = [z0, z0, 1.4]
    ring = lambda x, zt_: [(x, -4.5, zt_), (x, 4.5, zt_), (x, 4.5, -1.2), (x, -4.5, -1.2)]
    p.loft([ring(x, z) for x, z in zip(xs, zt)], R['asph'], colors=[R['asph'], R['conc'], R['concD'], R['conc']], caps=(True, True))
    for sy in (-1, 1):
        bar(p, (-8, sy * 4.15, z0 + .5), (-2, sy * 4.15, z0 + .5), .7, 1.05, R['conc'], tcol=R['concL'])
        bar(p, (-2, sy * 4.15, z0 + .5), (8, sy * 4.15, 1.9), .7, 1.05, R['conc'], tcol=R['concL'])
    # abutment block + wing walls
    p.cbox((-9.0, 0, -1.2), (2.4, 10.4, 11.6), R['concD'], ch=.3, tcolor=R['concL'])
    for x, z in ((-5.0, 10.0), (2.0, 7.0)):
        for sy in (-1, 1):
            p.box((x, sy * 4.9, -1.2), (.9, .6, z + 1.2 - (x + 2) * .15 if x > -2 else z + 1.2), R['concL'], bottom=False)
    for x in (-6.0, -3.0):
        p.face([(x - .7, -.12, z0 + .03), (x + .7, -.12, z0 + .03), (x + .7, .12, z0 + .03), (x - .7, .12, z0 + .03)], R['line'], up=True)
    for x in (2.0, 5.5):
        zz = z0 + (1.4 - z0) * (x + 2) / 10
        p.face([(x - .7, -.12, zz + .03), (x + .7, -.12, zz + .03 - .1), (x + .7, .12, zz + .03 - .1), (x - .7, .12, zz + .03)], R['line'], up=True)
    for sy in (-1, 1):
        p.beam((-6.0, sy * 4.15, z0 + .9), (-6.0, sy * 4.15, z0 + 5.2), .13, R['steelL'], sides=3)
        p.box((-6.0, sy * 3.3, z0 + 5.1), (.4, 1.9, .2), R['steel'])
    for sy in (-1, 1):
        p.box((7.2, sy * 5.0, 0), (2, 1, .5), R['grassD'], bottom=False)


# ───────────────────────── water / rock pieces ─────────────────────────
ISLAS = [
    ([(-1, 0, 11, 5, 4.6), (9, -1, 4, 3.2, 3.0)], [(-3, 0, 7, (.8, .3)), (4, -.5, 5.5, (-.5, .6))]),
    ([(0, 0, 5.2, 4.8, 11.0), (4.6, -3.0, 2.6, 2.2, 4.0)], [(-.5, .5, 7, (.8, .5))]),
    ([(-4, 0, 5.2, 4.2, 7.4), (5, 1, 4.4, 3.8, 5.4)], [(-4.5, 0, 6, (1, .4)), (4.8, .8, 5.5, (-.6, .7))]),
    ([(0, 0, 6.2, 4.6, 6.4), (-5.5, -3.5, 2.2, 1.9, 2.4)], [(.5, .3, 6.2, (-.7, .5)), (-1.8, -.8, 5, (.6, .6))]),
    ([(-8, 0, 5, 3.6, 5.4), (0, 1.5, 6.2, 4.2, 6.2), (8.5, -.5, 4.4, 3.2, 4.4)], [(-8, .5, 5, (.7, .2)), (-1, 1.5, 6.6, (.8, -.6)), (8.5, 0, 4.6, (-.5, .3))][:2]),
    ([(0, 0, 3.8, 3.2, 5.0), (-4.0, -2.6, 1.4, 1.2, 1.8)], [(0, 0, 6, (.6, .4))]),
]


def isla(p, k):
    blobs, palms = ISLAS[k - 1]
    for i, (cx, cy, rx, ry, h) in enumerate(blobs):
        big = rx > 2.8
        rock_blob(p, cx, cy, rx, ry, h, seed=k * 10 + i, n=6, tiers=3, green=big)
        foam_ring(p, cx, cy, rx, ry, wd=1.2 + .15 * rx / 3, n=7 if big else 6, seed=k * 5 + i)
    for i, (x, y, h, lean) in enumerate(palms):
        zt = 3.0
        for (cx, cy, rx, ry, hh) in blobs:
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < .6:
                zt = hh + .35
        palm_at(p, x, y, zt - .1, h, seed=k * 3 + i, lean=lean, s=.8 if h < 6 else .9, nfr=4, fl=3.2, rings=2)


def roca_rio(p, k):
    sz = [(3.0, 2.2, 2.2), (4.6, 3.4, 3.2), (2.2, 1.8, 1.8), (6.0, 4.4, 4.0), (3.6, 2.8, 2.6), (2.6, 2.0, 2.0)][k - 1]
    rock_blob(p, 0, 0, sz[0] / 2, sz[1] / 2, sz[2], seed=70 + k, n=6, z0=-.8, green=(k in (2, 4)), tiers=3)
    foam_ring(p, 0, 0, sz[0] / 2, sz[1] / 2, wd=.9, n=8, seed=k)
    if k == 4:
        rock_blob(p, 3.0, 1.5, 1.1, .9, 1.4, seed=99, n=5, z0=-.6, green=False, tiers=3)


def rapidos(p, k):
    rng = random.Random(40 + k)
    for i in range(10):
        x = rng.uniform(-8.5, 8.5)
        y = rng.uniform(-8.5, 8.5)
        ln = rng.uniform(2.4, 5.5)
        w = rng.uniform(.5, 1.3)
        sk = rng.uniform(-.8, .8)
        y0, y1 = max(-9.6, y - ln / 2), min(9.6, y + ln / 2)
        z = .08 + .03 * (i % 3)
        p.face([(x - w, y0, z), (x + w + sk * .3, y0 + .5, z), (x + w * .6 + sk, y1, z), (x - w * .6 + sk, y1 - .4, z)],
               R['foam'] if i % 2 == 0 else R['foamB'], up=True)
    for i in range(2):
        x = rng.uniform(-6.5, 6.5)
        y = rng.uniform(-6.5, 6.5)
        p.frustum((x, y, 0), rng.uniform(1.6, 2.6), rng.uniform(1.0, 1.6), rng.uniform(.5, .9), 6, R['foamB'], tcolor=R['foam'], top=False, bottom=False, sy=.6, rz=rng.uniform(0, 3))
    rocks = [(-5.5, 4.5, 1.6, 1.3, 1.8), (4.8, 5.8, 1.3, 1.1, 1.5), (-.5, -1.0, 2.2, 1.7, 2.4), (5.6, -4.8, 1.5, 1.3, 1.6), (-6.2, -6.0, 1.2, 1.0, 1.3)]
    if k == 2:
        rocks = [(-6.0, -4.0, 1.4, 1.2, 1.6), (6.2, 1.0, 1.9, 1.5, 2.1), (-1.5, 5.0, 1.5, 1.3, 1.5), (2.0, -5.5, 2.0, 1.6, 2.2), (-5.5, 6.0, 1.1, 1.0, 1.2)]
    for i, (x, y, rx, ry, h) in enumerate(rocks):
        rock_blob(p, x, y, rx, ry, min(h, 1.5), seed=k * 17 + i, n=5, z0=-.6, green=False, tiers=3)
        foam_ring(p, x, y, rx, ry, wd=1.0, n=6, seed=k * 11 + i)
    if k == 2:
        bar(p, (-9, 0.8, .55), (9, -.4, .55), 1.1, 1.2, R['foam'], tcol=R['foam'], bcol=R['foamB'], caps=False)     # white weir crest


def cascada(p):
    for i, (x, h, d) in enumerate(((-4.5, 8.0, 3.0), (4.5, 8.4, 3.2), (0, 9.0, 2.6))):
        pass
    p.cbox((0, 4.0, -.8), (14, 4.5, 9.8), R['rock'], ch=.5, tcolor=R['grassD'], colors=[R['rockL'], R['rockD'], R['rockD'], R['rockD']])
    p.cbox((-5.8, 1.2, -.8), (3.4, 3.6, 7.4), R['rockD'], ch=.5, tcolor=R['grass'])
    p.cbox((5.8, 1.2, -.8), (3.4, 3.6, 6.4), R['rockL'], ch=.5, tcolor=R['grass'])
    z_a = 8.6
    for i, (x0, x1) in enumerate(((-3.6, -1.6), (-1.2, 1.2), (1.6, 3.6))):
        y = 1.7 - i * 0.0
        p.face([(x0, y, 6.2), (x1, y, 6.2), (x1, y - .1, 1.0), (x0, y - .1, 1.0)], R['fall'] if False else 0xeaf6ff, flip_ref=Vector((0, 8, 4)))
        p.face([(x0 + .3, y - .02, 6.2), (x1 - .3, y - .02, 6.2), (x1 - .3, y - .15, 1.2), (x0 + .3, y - .15, 1.2)], 0xbfe0f5, flip_ref=Vector((0, 8, 4)))
    p.box((0, 2.2, 6.0), (7.6, 2.4, .3), R['foam'], bottom=False)
    foam_ring(p, 0, -1.0, 4.5, 2.2, wd=1.5, n=10, seed=3)
    palm_at(p, -5.8, 1.2, 6.9, 6, 12, lean=(.8, -.2), s=.8, nfr=4, fl=3.0, rings=2)
    palm_at(p, 5.8, 1.2, 5.9, 5, 13, lean=(-.8, .3), s=.7, nfr=4, fl=2.6, rings=2)


# ───────────────────────── vegetation ─────────────────────────
def palma(p, h, s, nfr, fl, seed, lean, nco):
    K.palm(p, 0, 0, h=h, lean=lean, s=s, seed=seed, nfr=nfr, fl=fl, coconuts=nco, rings=3 if h < 10 else 4)
    sink(p, .4)


def arbol(p, k):
    spec = {1: (2.6, [(0, 0, 2.4, 2.4, .9), (1.9, .7, 1.3, 1.8, .8), (-1.8, -.6, 1.4, 1.8, .8)], .5, 0x3f8a3a, 0x62ad48),
            2: (3.4, [(0, 0, 2.6, 2.9, .65), (2.6, .9, 1.7, 2.1, .6), (-2.6, -.7, 1.8, 2.1, .6)], .68, 0x5d9a3e, 0x86bb52),
            3: (2.4, [(0, 0, 3.6, 2.4, 1.25), (1.4, .4, 1.8, 1.7, 1.1), (-1.5, -.4, 1.9, 1.7, 1.1)], .45, 0x2f7a3a, 0x4f9a46)}[k]
    blob_tree(p, 0, 0, 0, spec[0], spec[1], spec[2], spec[3], spec[4], k * 9)
    sink(p, .4)


def arbusto(p, k):
    c, tc = (0x4f9a46, 0x72b455) if k == 1 else (0x3a8a3e, 0x5aa850)
    for i, (x, y, r) in enumerate(((0, 0, 1.1), (1.1, .5, .8), (-1.0, -.4, .85))):
        p.ico((x, y, .15), r, c, sub=0, sc=(1, 1, .8), jitter=.12, seed=k * 4 + i, tcolor=tc)
    if k == 2:
        for (x, y) in ((.3, -.9),):
            p.box((x, y, .9), (.4, .4, .3), 0xf2b8c6, bottom=False)
    sink(p, .3)


# ───────────────────────── build ─────────────────────────
INFO = {}


def build(L):
    out = []
    X, Y = 36.0, 44.0
    rows = []

    def add(row_list, name, fn, *a):
        row_list.append((name, fn, a))

    ind, port, ships, city, br, water, veg = [], [], [], [], [], [], []
    add(ind, 'alto_horno', alto_horno)
    add(ind, 'chimenea_a', chimenea, 38, 2.6, 1.5, (R['brick'], R['brickD']), R['white'])
    add(ind, 'chimenea_b', chimenea, 30, 2.2, 1.35, (R['brickD'], R['brick']), 0xe8c040)
    add(ind, 'tanque_blanco_a', tanque, 0)
    add(ind, 'tanque_blanco_b', tanque, 1)
    for i, nm in enumerate(('nave_a', 'nave_b', 'nave_c')):
        add(ind, nm, nave, i)
    add(ind, 'silo_a', silo)
    add(ind, 'tuberia_pieza', tuberia)
    add(ind, 'cinta_pieza', cinta)
    add(port, 'grua_muelle', grua_muelle)
    add(port, 'contenedores_a', container_stack, 3, 2, 3, 1)
    add(port, 'contenedores_b', container_stack, 4, 2, 4, 2, 6.0, 3.0, 2.4, True)
    add(port, 'contenedores_c', container_stack, 3, 2, 3, 3, 6.0, 3.0, 2.4, True)
    add(port, 'pila_bobinas', pila_bobinas)
    add(port, 'muelle_largo', muelle)
    add(port, 'muelle_esquina', muelle_esquina)
    add(ships, 'buque_carga', buque)
    add(ships, 'remolcador', remolcador)
    add(ships, 'gabarra', gabarra)
    add(city, 'torre_oscura_a', torre_oscura, 0)
    add(city, 'torre_oscura_b', torre_oscura, 1)
    ed = edificios(None)
    for nm in ('edif_gris_%02d' % i for i in range(1, 7)):
        add(city, nm, ed[nm])
    for nm in ('edif_terracota_%02d' % i for i in range(1, 5)):
        add(city, nm, ed[nm])
    for i in range(1, 7):
        add(city, 'casa_og_%02d' % i, casa_og, i)
    add(br, 'puente_ordaz_recto', puente_recto)
    add(br, 'puente_ordaz_pila', puente_pila)
    for i in range(1, 7):
        add(water, 'isla_rocosa_%02d' % i, isla, i)
    for i in range(1, 7):
        add(water, 'roca_rio_%02d' % i, roca_rio, i)
    add(water, 'rapidos_pieza_a', rapidos, 1)
    add(water, 'rapidos_pieza_b', rapidos, 2)
    add(water, 'cascada_og', cascada)
    add(veg, 'palma_og_a', palma, 7, .85, 6, 3.4, 3, (.7, .3), 0)
    add(veg, 'palma_og_b', palma, 10, 1.0, 7, 4.0, 5, (1.2, .5), 1)
    add(veg, 'palma_og_c', palma, 14, 1.15, 8, 4.8, 8, (1.5, -.7), 0)
    for i in range(1, 4):
        add(veg, 'arbol_og_%s' % 'abc'[i - 1], arbol, i)
    add(veg, 'arbusto_og_a', arbusto, 1)
    add(veg, 'arbusto_og_b', arbusto, 2)
    row = 0
    for cat in (ind, port, ships, city, br, water, veg):
        for i in range(0, len(cat), 10):
            for c, (name, fn, a) in enumerate(cat[i:i + 10]):
                p = L.Part(name, loc=(c * X, -row * Y, 0), ao=0.22)
                fn(p, *a)
                out.append(p)
            row += 1
    return out


def write_manifest(info):
    import bpy
    rows = []
    for nm, t in info['per_mesh'].items():
        o = bpy.data.objects[nm]
        xs = [v.co.x for v in o.data.vertices]
        ys = [v.co.y for v in o.data.vertices]
        zs = [v.co.z for v in o.data.vertices]
        rows.append((nm, t, '%.1f x %.1f' % (max(xs) - min(xs), max(ys) - min(ys)), '%.1f' % max(zs)))
    path = os.path.join(lib.MODEL_DIR, 'ordaz_kit_manifest.md')
    with open(path, 'w') as f:
        f.write('# ordaz_kit manifest\n\nPuerto Ordaz / Ciudad Guayana kit. Total tris: %d. Origin = base centre at z=0 (water level for water pieces; quays deck z=2; bridge deck z=10), front faces -Y. '
                'Ship bow +X. Bridge pieces run along X (recto: x -12..12, pillars on x=-8,0,8 so segments chain every 24; pila: deck flush at x=-8 z=10, ramps down to z=1.4 at x=+8).\n\n' % info['tris'])
        f.write('| Part | tris | footprint (x by y) | height (z max) |\n|---|---|---|---|\n')
        for r in rows:
            f.write('| %s | %d | %s | %s |\n' % r)


if __name__ == '__main__':
    info = lib.run(sys.modules[__name__])
    write_manifest(info)
