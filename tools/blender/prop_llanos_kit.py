"""llanos_kit: Los Llanos kit for LA FIESTA (haciendas, windmill, corral fences, cattle, horses, capybaras, trees, palms, boulders, river rapids, concrete bridge).
Each Part = one instanceable piece, origin = base centre (z=0 = ground, or water line for river pieces), front = -Y.
Animals face +X locally (rotate to place). Bridge pieces follow ordaz_kit's bridge convention exactly (run along X, deck top z=10, pillars down to z=-10)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
import prop_ordaz_kit as O
import prop_ccs_city as CC
import prop_chiguiros as CH
import prop_llanero_caballo as LL
from mathutils import Vector

NAME = 'llanos_kit'
GROUND = 0xa8b65a
PREVIEW = dict(az=0, pitch=62, fit=0.95, size=2600)
AO_DIST = 9

PI = math.pi
C = dict(wall=0xf6f0e0, wallD=0xddd2b6, tej1=0xd0643c, tej2=0xbc5030, tej3=0xe07848, tejD=0x9a3f26, brick=0xa65a3c,
         wood=0x8a5a30, woodD=0x62401f, woodL=0xab7a46, shut=0x3f7f8a, glass=0x35506f, door=0x6e4a2a,
         hay=0xdcc060, hayD=0xb89a40, thatch=0xc8a850, thatchD=0x9c7e34, mud=0xb99466,
         gray=0x9ca0a8, grayD=0x70747c, grayL=0xbcc0c8, grayLL=0xd0d3da, sand=0xdcc98c, foam=0xf4faff, foamB=0xcfe8f8,
         water=0x56b4e8, waterD=0x3c92cc,
         g1=0x2a6a30, g2=0x1f5a28, g3=0x37803a, g4=0x4a9642, g5=0x5aa24a,
         gl1=0xa4b648, gl2=0x8ea03a, gl3=0xc6ca6a, gl4=0xb8a850, dry=0x8a7a50, dryD=0x6a5c3c,
         conc=0xb9bfc9, concD=0x8a93a3, concL=0xd3d7de, slab=0xaab0ba, steel=0x30343c, steelL=0x5a606c, line=0xf0eee4,
         palm=0x5c8f3a, palmL=0x7fae48, palmD=0x497a30, trunkP=0x9a8a70, trunkPD=0x7a6a52, trunk=0x6e4a2a, trunkL=0x8a6440)
cos, sin = math.cos, math.sin


# ───────────────────────── helpers ─────────────────────────
def at(p, fn, loc=(0, 0, 0), rot=0.0, *a, **k):
    """Run a piece-builder into p, then rotate (z) and move only the vertices it added."""
    n0 = len(p.bm.verts)
    fn(p, *a, **k)
    co, si = cos(rot), sin(rot)
    for v in list(p.bm.verts)[n0:]:
        x, y = v.co.x, v.co.y
        v.co.x = loc[0] + x * co - y * si
        v.co.y = loc[1] + x * si + y * co
        v.co.z += loc[2]


def sq(p, side, cx, cy, w, d, a0, a1, z0, z1, col, off=0.04):
    CC.sq(p, side, cx, cy, w, d, a0, a1, z0, z1, col, off)


def roof(p, cx, cy, z, w, d, h, c1, c2, c3, strips=4, ov=.4, ovx=.35, rz=0.0, endcol=None, ridge=True):
    """Tile gable roof: base at z (wall top), ridge h above, ridge along local X (width w), tile bands alternate c1/c2."""
    co, si = cos(rz), sin(rz)

    def T(x, y, zz):
        return (cx + x * co - y * si, cy + x * si + y * co, z + zz)
    hw, hd = w / 2 + ovx, d / 2 + ov
    ref = Vector(T(0, 0, -4))
    for sg in (-1, 1):
        for k in range(strips):
            y0, y1 = sg * hd * (1 - k / strips), sg * hd * (1 - (k + 1) / strips)
            z0, z1 = h * (1 - abs(y0) / (d / 2)), h * (1 - abs(y1) / (d / 2))
            p.face([T(-hw, y0, z0), T(hw, y0, z0), T(hw, y1, z1), T(-hw, y1, z1)], c1 if k % 2 == 0 else c2, flip_ref=ref)
    if endcol is not None:
        for sx in (-1, 1):
            p.face([T(sx * w / 2, -d / 2, 0), T(sx * w / 2, d / 2, 0), T(sx * w / 2, 0, h)], endcol, flip_ref=ref)
    if ridge:
        O.bar(p, T(-hw, 0, h + .1), T(hw, 0, h + .1), .5, .3, c3, caps=False)


def lean_roof(p, x0, x1, ya, za, yb, zb, c1, c2, strips=3):
    """Single-slope tile roof from edge (ya,za) to edge (yb,zb) across x0..x1."""
    ref = Vector(((x0 + x1) / 2, (ya + yb) / 2, min(za, zb) - 4))
    for k in range(strips):
        t0, t1 = k / strips, (k + 1) / strips
        p.face([(x0, ya + (yb - ya) * t0, za + (zb - za) * t0), (x1, ya + (yb - ya) * t0, za + (zb - za) * t0),
                (x1, ya + (yb - ya) * t1, za + (zb - za) * t1), (x0, ya + (yb - ya) * t1, za + (zb - za) * t1)],
               c1 if k % 2 == 0 else c2, flip_ref=ref)


def cyl_x(p, c, r, ln, n, c1, c2, cap=None):
    """Cylinder lying along X, centre c."""
    cx, cy, cz = c
    ring = lambda x: [(x, cy + r * cos(2 * PI * i / n), cz + r * sin(2 * PI * i / n)) for i in range(n)]
    p.loft([ring(cx - ln / 2), ring(cx + ln / 2)], c1, colors=[c1, c2], caps=(True, True), ref=Vector(c))


def plank(p, pts, y0, y1, col, col2=None):
    """Vertical board: polygon pts=(u,z) in the XZ plane, thickness y0..y1."""
    n = len(pts)
    ref = Vector((sum(q[0] for q in pts) / n, (y0 + y1) / 2, sum(q[1] for q in pts) / n))
    p.face([(u, y0, z) for u, z in pts], col2 or col, flip_ref=ref)
    p.face([(u, y1, z) for u, z in pts], col, flip_ref=ref)
    for i in range(n):
        j = (i + 1) % n
        p.face([(pts[i][0], y0, pts[i][1]), (pts[j][0], y0, pts[j][1]), (pts[j][0], y1, pts[j][1]), (pts[i][0], y1, pts[i][1])], col, flip_ref=ref)


def pbox(p, c, s, col, tcol=None):
    """Plain post/board: open-bottom box."""
    p.box(c, s, col, bottom=False, tcolor=tcol)


def sink(p, d=.35):
    CC.sink(p, d)


def two_sided(p, pts, col):
    p.face(pts, col)
    p.face(pts[::-1], col)


# ───────────────────────── haciendas ─────────────────────────
def window(p, side, cx, cy, w, d, ax, z0=1.0, z1=2.4, ww=.5):
    sq(p, side, cx, cy, w, d, ax - ww - .5, ax + ww + .5, z0 - .12, z1 + .12, C['wall'], off=.03)       # frame / lintel
    sq(p, side, cx, cy, w, d, ax - ww, ax + ww, z0, z1, C['glass'], off=.05)
    sq(p, side, cx, cy, w, d, ax - ww - .5, ax - ww - .02, z0, z1, C['shut'], off=.06)
    sq(p, side, cx, cy, w, d, ax + ww + .02, ax + ww + .5, z0, z1, C['shut'], off=.06)


def veranda(p, cx, w, y_wall, y_front, H, nposts, gap=0.0):
    zf = .3
    p.box((cx, (y_wall + y_front) / 2, 0), (w + .4, y_wall - y_front + .3, zf), C['mud'], bottom=False, tcolor=0xcdb68a)
    xs = [cx - w / 2 + .4 + i * (w - .8) / (nposts - 1) for i in range(nposts)]
    for x in xs:
        pbox(p, (x, y_front + .3, zf), (.34, .34, H - .8 - zf), C['wood'], C['woodL'])
    pbox(p, (cx, y_front + .3, H - 1.1), (w + .3, .42, .32), C['woodD'], C['wood'])         # eave beam
    for i in range(nposts - 1):
        xa, xb = xs[i], xs[i + 1]
        if gap and abs((xa + xb) / 2 - cx) < gap:
            continue
        pbox(p, ((xa + xb) / 2, y_front + .3, zf + .85), (xb - xa - .34, .12, .12), C['woodL'])
    p.box((cx, y_front - .35, 0), (2.0, .8, .15), C['gray'], bottom=False, tcolor=C['grayL'])  # front step


def casa_a(p):
    H = 3.3
    p.cbox((0, 1.2, 0), (10.4, 5.6, H), C['wall'], ch=.15, tcolor=C['wall'])
    for sd, a in (('s', 5.2), ('n', 5.2)):
        sq(p, sd, 0, 1.2, 10.4, 5.6, -a, a, 0, .7, C['wallD'], off=.02)
    for sd in 'ew':
        sq(p, sd, 0, 1.2, 10.4, 5.6, -2.8, 2.8, 0, .7, C['wallD'], off=.02)
    sq(p, 's', 0, 1.2, 10.4, 5.6, -.8, .8, 0, 2.5, C['door'])
    sq(p, 's', 0, 1.2, 10.4, 5.6, -.55, -.05, 1.1, 2.1, C['woodL'], off=.06)
    for x in (-3.0, 3.0):
        window(p, 's', 0, 1.2, 10.4, 5.6, x)
    window(p, 'n', 0, 1.2, 10.4, 5.6, -2.5)
    window(p, 'n', 0, 1.2, 10.4, 5.6, 2.5)
    for sd in 'ew':
        window(p, sd, 0, 1.2, 10.4, 5.6, 0, ww=.55)
    roof(p, 0, 1.2, H - .02, 10.4, 5.6, 2.6, C['tej1'], C['tej2'], C['tejD'], strips=4, endcol=C['wall'])
    veranda(p, 0, 10.6, -1.6, -3.9, H, 5, gap=1.3)
    lean_roof(p, -5.6, 5.6, -1.5, H + .25, -4.0, H - .9, C['tej1'], C['tej2'], strips=3)
    p.cbox((3.3, 2.4, H + .9), (.95, .95, 2.3), C['brick'], ch=.12, tcolor=C['tejD'])
    p.cbox((3.3, 2.4, H + 3.1), (1.25, 1.25, .25), C['grayL'], ch=.06, tcolor=C['grayLL'])


def casa_b(p):
    H = 3.3
    p.cbox((0, 1.2, 0), (8.0, 5.6, H), C['wall'], ch=.15, tcolor=C['wall'])
    for sd, a in (('s', 4.0), ('n', 4.0)):
        sq(p, sd, 0, 1.2, 8.0, 5.6, -a, a, 0, .7, C['wallD'], off=.02)
    sq(p, 's', 0, 1.2, 8.0, 5.6, -.8, .8, 0, 2.5, C['door'])
    sq(p, 's', 0, 1.2, 8.0, 5.6, -.55, -.05, 1.1, 2.1, C['woodL'], off=.06)
    window(p, 's', 0, 1.2, 8.0, 5.6, -2.6)
    window(p, 'n', 0, 1.2, 8.0, 5.6, 0)
    window(p, 'w', 0, 1.2, 8.0, 5.6, 0, ww=.55)
    roof(p, 0, 1.2, H - .02, 8.0, 5.6, 2.6, C['tej1'], C['tej2'], C['tejD'], strips=4, endcol=C['wall'])
    veranda(p, -.4, 7.6, -1.6, -3.9, H, 4, gap=1.3)
    lean_roof(p, -4.2, 3.6, -1.5, H + .25, -4.0, H - .9, C['tej1'], C['tej2'], strips=3)
    # annex wing (east), ridge along Y
    ax, ay, aw, ad, H2 = 6.2, -0.4, 4.2, 6.0, 2.9
    p.cbox((ax, ay, 0), (aw, ad, H2), C['wall'], ch=.15, tcolor=C['wall'])
    sq(p, 's', ax, ay, aw, ad, -aw / 2, aw / 2, 0, .7, C['wallD'], off=.02)
    sq(p, 'e', ax, ay, aw, ad, -ad / 2, ad / 2, 0, .7, C['wallD'], off=.02)
    window(p, 's', ax, ay, aw, ad, 0, z0=.9, z1=2.2, ww=.45)
    window(p, 'e', ax, ay, aw, ad, -1.0, z0=.9, z1=2.2, ww=.45)
    sq(p, 'e', ax, ay, aw, ad, 1.4, 2.4, 0, 2.3, C['door'])
    roof(p, ax, ay, H2 - .02, ad, aw, 2.0, C['tej1'], C['tej2'], C['tejD'], strips=3, ov=.35, ovx=.3, rz=PI / 2, endcol=C['wall'])
    p.cbox((-2.2, 3.0, H + .9), (.95, .95, 2.3), C['brick'], ch=.12, tcolor=C['tejD'])
    p.cbox((-2.2, 3.0, H + 3.1), (1.25, 1.25, .25), C['grayL'], ch=.06, tcolor=C['grayLL'])


def bale(p, c, s, rz=0.0):
    p.cbox(c, s, C['hay'], ch=.1, rz=rz, tcolor=0xe8d070, colors=[C['hay'], C['hayD'], C['hay'], C['hayD']])
    for t in (-.25, .25):
        co, si = cos(rz), sin(rz)
        z = c[2] + s[2] + .005
        hx, hy = s[0] * .5 - .1, s[1] * .5 - .1
        def T(x, y):
            return (c[0] + x * co - y * si, c[1] + x * si + y * co, z)
        p.face([T(t * s[0] - .04, -hy), T(t * s[0] + .04, -hy), T(t * s[0] + .04, hy), T(t * s[0] - .04, hy)], 0x6a5420, up=True)


def cobertizo(p):
    H = 3.2
    p.box((0, 0, 0), (8.4, 5.4, .15), 0xb89f6e, bottom=False, tcolor=0xc8b07c)
    for (x, y) in ((-3.8, -2.3), (3.8, -2.3), (-3.8, 2.3), (3.8, 2.3), (0, 2.3)):
        pbox(p, (x, y, .15), (.4, .4, H - .15), C['wood'], C['woodL'])
    pbox(p, (0, 2.45, .15), (8.0, .18, 2.6), C['woodD'], C['wood'])
    pbox(p, (-3.9, 0, 2.5), (.18, 4.6, .3), C['woodD'])
    pbox(p, (3.9, 0, 2.5), (.18, 4.6, .3), C['woodD'])
    roof(p, 0, 0, H - .02, 8.2, 5.2, 1.5, C['tej1'], C['tej2'], C['tejD'], strips=3, endcol=C['woodD'])
    at(p, bale, (-1.9, 1.3, .15), 0, (0, 0, 0), (1.9, 1.0, .85)) if False else None
    bale(p, (-2.3, 1.3, .15), (1.9, 1.0, .85))
    bale(p, (-.3, 1.3, .15), (1.9, 1.0, .85))
    bale(p, (-1.3, 1.3, 1.0), (1.9, 1.0, .85), rz=.1)
    bale(p, (2.6, 1.4, .15), (1.0, 1.9, .85), rz=.15)


def caney(p):
    n = 8
    p.frustum((0, 0, 0), 3.3, 3.2, 1.7, n, C['mud'], top=False, bottom=False, ring_colors=[C['mud'], 0xc4a274])
    sq(p, 's', 0, 0, 5.0, 5.0, -.7, .7, 0, 1.6, C['door'], off=-2.2 + .04)
    p.frustum((0, 0, 1.6), 4.5, 3.4, .9, n, C['thatch'], top=False, bottom=False, ring_colors=[C['thatch'], C['thatchD']])
    p.frustum((0, 0, 2.5), 3.4, 1.8, 1.2, n, C['thatchD'], top=False, bottom=False, ring_colors=[C['thatchD'], C['thatch']])
    p.frustum((0, 0, 3.7), 1.8, .01, 1.9, n, C['thatch'], ring_colors=[C['thatch'], C['thatchD']])
    p.beam((0, 0, 5.4), (0, 0, 6.4), .1, C['woodD'], sides=3)
    for i in range(4):
        a = i * PI / 2 + PI / 4
        p.beam((3.5 * cos(a), 3.5 * sin(a), 0), (3.6 * cos(a), 3.6 * sin(a), 1.9), .1, C['woodD'], sides=3)


def molino(p):
    base, topw, ztop = 2.3, .95, 18.0
    lv = [ztop * i / 4 for i in range(5)]
    f = lambda z: base + (topw - base) * z / ztop
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    pt = lambda i, z: (corners[i][0] * f(z), corners[i][1] * f(z), z)
    for i in range(4):
        p.beam(pt(i, 0), pt(i, ztop), .19, C['wood'], sides=3)
    for k in range(1, 5):
        for i in range(4):
            p.beam(pt(i, lv[k]), pt((i + 1) % 4, lv[k]), .1, C['woodL'], sides=3)
    for k in range(4):
        for i in range(4):
            a, b = (i, (i + 1) % 4)
            if (k + i) % 2:
                a, b = b, a
            p.beam(pt(a, lv[k]), pt(b, lv[k + 1]), .08, C['woodD'], sides=3)
    p.box((0, 0, ztop), (2.4, 2.4, .3), C['woodD'], bottom=False, tcolor=C['woodL'])
    p.cbox((0, 0, ztop + .3), (1.3, 2.2, 1.2), C['gray'], ch=.15, tcolor=C['grayL'])
    p.beam((0, -1.0, ztop + 1.0), (0, -1.9, ztop + 1.9), .13, C['steel'], sides=4)
    hub = (0, -1.9, ztop + 1.9)
    p.ico(hub, .55, C['steelL'], sub=0)
    n = 8
    for i in range(n):
        th = 2 * PI * i / n + .15
        ux, uz = sin(th), cos(th)       # radial
        vx, vz = cos(th), -sin(th)      # tangent
        for (r0, r1, w0, w1, col) in ((.7, 3.5, .18, .5, C['grayL']),):
            pts = [(hub[0] + ux * r0 - vx * w0, hub[1] + (.1 if i % 2 else -.1), hub[2] + uz * r0 - vz * w0),
                   (hub[0] + ux * r0 + vx * w0, hub[1] - (.1 if i % 2 else -.1), hub[2] + uz * r0 + vz * w0),
                   (hub[0] + ux * r1 + vx * w1, hub[1] - .1, hub[2] + uz * r1 + vz * w1),
                   (hub[0] + ux * r1 - vx * w1, hub[1] + .1, hub[2] + uz * r1 - vz * w1)]
            two_sided(p, pts, C['grayL'] if i % 2 else C['grayLL'])
        a2 = 2 * PI * (i + 1) / n + .15
        p.beam((hub[0] + sin(th) * 3.0, hub[1], hub[2] + cos(th) * 3.0), (hub[0] + sin(a2) * 3.0, hub[1], hub[2] + cos(a2) * 3.0), .06, C['steelL'], sides=3)
    p.beam((0, 0.8, ztop + 1.0), (0, 4.3, ztop + 1.25), .1, C['woodD'], sides=3)
    two_sided(p, [(0, 3.4, ztop + .3), (0, 5.2, ztop + .5), (0, 5.2, ztop + 2.7), (0, 3.4, ztop + 2.5)], 0xb8553a)
    two_sided(p, [(0, 3.4, ztop + 1.4), (0, 5.2, ztop + 1.5), (0, 5.2, ztop + 2.7), (0, 3.4, ztop + 2.5)], C['wall'])
    for (x, y) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        p.box((x * base - .4, y * base - .4, -.2), (.8, .8, .6), C['gray'], bottom=False, tcolor=C['grayL'])


def tanque(p):
    n = 10
    for (x, y) in ((-1.6, -1.6), (1.6, -1.6), (1.6, 1.6), (-1.6, 1.6)):
        p.beam((x * 1.1, y * 1.1, 0), (x * .8, y * .8, 1.7), .15, C['woodD'], sides=4)
    p.frustum((0, 0, 1.6), 2.6, 2.6, .25, n, C['woodD'], tcolor=C['wood'])
    p.frustum((0, 0, 1.85), 2.4, 2.4, 2.6, n, C['gray'], top=False, bottom=False, ring_colors=[C['gray'], C['grayL']])
    p.frustum((0, 0, 2.7), 2.5, 2.5, .22, n, C['steelL'], top=False, bottom=False)
    p.frustum((0, 0, 3.8), 2.5, 2.5, .22, n, C['steelL'], top=False, bottom=False)
    p.frustum((0, 0, 4.45), 2.4, .7, .7, n, C['grayD'], bottom=False, tcolor=C['grayL'])
    p.beam((2.2, 0, 0), (2.2, 0, 4.0), .08, C['steel'], sides=3)
    p.beam((2.5, 0, 0), (2.5, 0, 4.0), .08, C['steel'], sides=3)
    for z in (.7, 1.5, 2.3, 3.1):
        p.beam((2.2, 0, z), (2.5, 0, z), .05, C['steel'], sides=3)
    p.beam((-1.0, -1.0, 1.6), (-1.0, -2.2, 0), .12, C['steel'], sides=4)
    p.box((-1.4, -2.5, 0), (.8, .6, .3), C['gray'], bottom=False, tcolor=C['grayL'])


def abrevadero(p):
    L, W, h = 5.2, 1.6, 1.0
    p.box((0, 0, .2), (L, W, .2), C['woodD'], bottom=False)
    for sy in (-1, 1):
        pbox(p, (0, sy * (W / 2 - .1), .2), (L, .2, h - .2), C['wood'], C['woodL'])
    for sx in (-1, 1):
        pbox(p, (sx * (L / 2 - .1), 0, .2), (.2, W - .4, h - .2), C['woodD'], C['woodL'])
    p.face([(-L / 2 + .2, -W / 2 + .2, h - .25), (L / 2 - .2, -W / 2 + .2, h - .25), (L / 2 - .2, W / 2 - .2, h - .25), (-L / 2 + .2, W / 2 - .2, h - .25)], C['water'], up=True)
    for sx in (-1.7, 1.7):
        pbox(p, (sx, 0, 0), (.32, W + .1, .3), C['woodD'], C['wood'])


def pozo(p):
    n = 8
    p.frustum((0, 0, 0), 1.6, 1.45, 1.1, n, C['gray'], top=False, bottom=False, ring_colors=[C['gray'], C['grayL'], C['grayD']])
    ro = [(1.5 * cos(2 * PI * i / n), 1.5 * sin(2 * PI * i / n), 1.15) for i in range(n)]
    ri = [(1.0 * cos(2 * PI * i / n), 1.0 * sin(2 * PI * i / n), 1.15) for i in range(n)]
    p.loft([ro, ri], C['grayL'], ref=Vector((0, 0, 0)))
    p.face([(1.0 * cos(2 * PI * i / n), 1.0 * sin(2 * PI * i / n), .5) for i in range(n)], 0x2a5a80, up=True)
    for sx in (-1.25, 1.25):
        pbox(p, (sx, 0, 1.1), (.22, .22, 1.9), C['wood'], C['woodL'])
    p.beam((-1.6, 0, 2.5), (1.6, 0, 2.5), .1, C['woodD'], sides=5)
    p.beam((0, 0, 2.4), (0, 0, 1.5), .03, C['steel'], sides=3)
    p.frustum((0, 0, 1.2), .3, .22, .3, 5, C['woodD'], bottom=False)
    roof(p, 0, 0, 3.0, 3.4, 2.2, .9, C['tej1'], C['tej2'], C['tejD'], strips=2, ov=.3, ovx=.25, endcol=C['woodD'])
    for sx in (-1.25, 1.25):
        p.beam((sx, 0, 3.0), (sx, 0, 2.9), .1, C['woodD'], sides=3)


def heno_a(p):
    bale(p, (-.95, 0, 0), (1.8, 1.0, .85))
    bale(p, (1.0, 0, 0), (1.8, 1.0, .85), rz=.05)
    bale(p, (0, .05, .85), (1.8, 1.0, .85), rz=-.06)
    bale(p, (2.4, 1.5, 0), (1.0, 1.8, .85), rz=.1)


def heno_b(p):
    cyl_x(p, (-1.25, 0, 1.0), 1.0, 1.7, 8, C['hay'], C['hayD'])
    cyl_x(p, (1.25, .15, 1.0), 1.0, 1.7, 8, C['hay'], C['hayD'])
    cyl_x(p, (0, 0, 2.55), 1.0, 1.7, 8, C['hayD'], C['hay'])
    p.disc((-1.25 - .86, 0, 1.0), 0, C['hay'], rings=1, segs=3) if False else None
    sink(p, .2)


# ───────────────────────── fences ─────────────────────────
def fence_span(p, x0, x1, y=0.0, rails=(.55, 1.0, 1.45), axis='x'):
    for z in rails:
        p.box(((x0 + x1) / 2, y, z), (abs(x1 - x0), .14, .22), C['woodL'], bottom=False, tcolor=C['wood'], colors={})


def post(p, x, y, w=.34, h=1.9):
    p.cbox((x, y, 0), (w, w, h), C['wood'], ch=.06, tcolor=C['woodL'], colors=[C['wood'], C['woodD'], C['woodD'], C['wood']])


def cerca_recta(p):
    post(p, -3, 0, .36)
    post(p, 0, 0, .36)
    post(p, 3, 0, .30)
    for z in (.5, 1.0, 1.5):
        p.box((0, .17, z), (6.0, .14, .24), C['woodL'], bottom=False, tcolor=C['wood'], colors={'s': C['woodD']})
    sink(p, .15)


def cerca_esquina(p):
    """Corner post at the origin; arms run +X (0..3) and -Y (0..-3)."""
    post(p, 0, 0, .42, 2.1)
    post(p, 3, 0, .30)
    post(p, 0, -3, .30)
    post(p, 1.5, 0, .30)
    post(p, 0, -1.5, .30)
    for z in (.5, 1.0, 1.5):
        p.box((1.5, .17, z), (3.0, .14, .24), C['woodL'], bottom=False, tcolor=C['wood'])
        p.box((.17, -1.5, z), (.14, 3.0, .24), C['woodL'], bottom=False, tcolor=C['wood'])
    sink(p, .15)


def cerca_porton(p):
    for sx in (-1, 1):
        p.cbox((sx * 3.0, 0, 0), (.5, .5, 2.5), C['woodD'], ch=.08, tcolor=C['woodL'])
        for z in (.5, 1.0, 1.5):
            p.box((sx * 2.7, .17, z), (.6, .14, .24), C['woodL'], bottom=False, tcolor=C['wood'])
    gx0, gx1 = -2.4, 2.4
    for z in (.3, 1.0, 1.7):
        p.box((0, 0, z), (gx1 - gx0, .16, .24), C['wood'], bottom=False, tcolor=C['woodL'])
    for x in (gx0 + .1, gx1 - .1, 0):
        p.box((x, 0, .3), (.18, .16, 1.64), C['woodD'], bottom=False, tcolor=C['wood'])
    p.beam((gx0 + .1, -.1, .45), (gx1 - .1, -.1, 1.8), .09, C['woodD'], sides=4)
    p.box((-2.2, -.2, 1.6), (.3, .22, .22), C['steel'], bottom=False)
    p.box((2.1, -.2, 1.1), (.22, .22, .5), C['steelL'], bottom=False)
    sink(p, .15)


# ───────────────────────── animals ─────────────────────────
def cow(p, s=1.0, pat='holstein', graze=False, bull=False):
    W_, K_ = 0xf4efe4, 0x26211e
    B_, T_ = 0x7a4a2a, 0x4a2c1a
    if pat == 'holstein':
        base, patch = W_, K_
        tbl = [[0, 1, 1, 0, 0, 1], [1, 1, 0, 0, 1, 0], [0, 0, 1, 1, 1, 0], [1, 0, 0, 1, 0, 0]]
    elif pat == 'brown':
        base, patch = W_, B_
        tbl = [[0, 0, 1, 1, 0, 1], [1, 1, 1, 0, 0, 0], [0, 1, 0, 0, 1, 1], [1, 0, 0, 0, 1, 1]]
    else:   # toro
        base, patch = T_, 0x2e1c12
        tbl = [[0] * 6 for _ in range(4)]
    T = lambda x, y, z: (x * s, y * s, z * s)
    sg = [(-2.0, 2.0), (-1.0, 2.1), (.2, 2.05), (1.3, 2.15), (2.05, 2.1)]
    rad = [(.55, .6), (.92, .95), (.98, 1.0), (.88, .92), (.58, .62)]
    if bull:
        rad = [(a * 1.05, b * 1.05) for a, b in rad]
        rad[3] = (.98, 1.05)
    CH.tube(p, [T(x, 0, z) for x, z in sg], [(a * s, b * s) for a, b in rad],
            lambda j, k, up: (patch if tbl[j][k] else base) if (up > -.45 or bull) else base, n=6, caps=(True, True))
    if bull:
        p.ico(T(1.2, 0, 2.95), .85 * s, base, sub=0, sc=(1.0, .9, .75))
    lg = base if not bull else T_
    for (lx, ly) in ((-1.3, -.55), (-1.3, .55), (1.3, -.55), (1.3, .55)):
        CH.tube(p, [T(lx, ly, 1.4), T(lx, ly, 0)], [.28 * s, .17 * s], [lg], n=4, caps=(False, True))
    if graze:
        hd = [(1.7, 2.5), (2.4, 2.05), (2.95, 1.2), (3.3, .55), (3.5, .28)]
    else:
        hd = [(1.7, 2.5), (2.5, 2.5), (3.0, 2.25), (3.5, 1.85), (3.8, 1.6)]
    CH.tube(p, [T(x, 0, z) for x, z in hd], [(.55 * s, .6 * s), (.43 * s, .46 * s), (.37 * s, .38 * s), (.3 * s, .3 * s), (.27 * s, .24 * s)],
            [base if pat != 'toro' else T_, base if pat != 'toro' else T_, patch if (pat != 'toro' and pat != 'brown') else base if pat == 'brown' else T_, 0xd8a8a0],
            n=6, caps=(False, True))
    hx, hz = hd[2]
    for sy in (-1, 1):
        p.frustum(T(hx - .15, sy * .38, hz + .22), .12 * s, .05 * s, .38 * s, 3, patch if pat == 'holstein' else base)      # ears
        hl = 0.55 if bull else .3
        p.beam(T(hx - .05, sy * .22, hz + .35), T(hx - .1, sy * (.5 + (.2 if bull else 0)), hz + .35 + hl), .07 * s, 0xe8dcc0, sides=3)
    CH.tube(p, [T(-2.0, 0, 2.7), T(-2.45, 0, 2.0), T(-2.5, 0, 1.0)], [.1 * s, .08 * s, .12 * s], [base, patch if pat == 'holstein' else T_], n=3, caps=(False, True))
    if not bull:
        p.box(T(-.55, 0, .98), (.7 * s, .55 * s, .35 * s), 0xe8b0a8, bottom=False)


def caballo(p, kind):
    if kind == 'a':
        LL.horse(p, 0x7a4a28, 0x2a1c14, 0x6a3e20, pose='graze', s=.85, blaze=0xf4efe4)
    elif kind == 'b':
        LL.horse(p, 0xe8dcc0, 0xcfc0a0, 0xe8dcc0, pose='stand', s=.85)
    else:
        LL.horse(p, 0x4a2a1c, 0x16100c, 0x16100c, pose='stand', s=.85, blaze=None)


def chigui(p, k):
    spec = {1: dict(s=1.5, coat=0x9a6b40, pose='stand'), 2: dict(s=1.4, coat=0x8c6038, pose='sit'), 3: dict(s=1.6, coat=0xa4764a, pose='stand')}[k]
    CH.capy(p, s=spec['s'], coat=spec['coat'], pose=spec['pose'])


def chigui_agua(p):
    R0 = 6.2
    rng = random.Random(7)
    ring_pts = 14
    ripple = [(R0 * (1 + .06 * sin(i * 2.1)) * cos(2 * PI * i / ring_pts), R0 * (1 + .06 * sin(i * 2.1)) * sin(2 * PI * i / ring_pts)) for i in range(ring_pts)]
    for i in range(ring_pts):
        j = (i + 1) % ring_pts
        o0, o1 = ripple[i], ripple[j]
        i0 = (o0[0] * .62, o0[1] * .62)
        i1 = (o1[0] * .62, o1[1] * .62)
        p.face([(i0[0], i0[1], .04), (o0[0], o0[1], .04), (o1[0], o1[1], .04), (i1[0], i1[1], .04)], C['foamB'] if i % 2 else C['foam'], up=True)
        p.face([(0, 0, .04), (i0[0], i0[1], .04), (i1[0], i1[1], .04)], C['waterD'] if i % 2 else C['water'], up=True)
    n0 = len(p.bm.verts)
    for (loc, rot, s, coat) in (((-1.4, -.6, -.55), 0.4, 1.35, 0x9a6b40), ((1.6, .4, -.5), 2.7, 1.2, 0x8c6038), ((.2, 2.0, -.55), -1.7, 1.0, 0xa4764a)):
        n1 = len(p.bm.verts)
        CH.capy(p, s=s, coat=coat, pose='stand')
        co, si = cos(rot), sin(rot)
        for v in list(p.bm.verts)[n1:]:
            x, y = v.co.x, v.co.y
            v.co.x = loc[0] + x * co - y * si
            v.co.y = loc[1] + x * si + y * co
            v.co.z += loc[2]
            if v.co.z < .1:
                v.co.z = .1


# ───────────────────────── vegetation ─────────────────────────
def lobe_cols(pal):
    return lambda zc, rn: pal[2] if (zc > .55 and rn > .25) else (pal[1] if (zc > -.05 or rn > .55) else pal[0])


def crown(p, c, r, pal, sub, sc, seed, cut=-.25, jit=.1):
    p.ico(c, r, pal[1], sub=sub, sc=sc, jitter=jit, seed=seed, cut_below=c[2] + cut * r * sc[2], bands=lobe_cols(pal))


def arbol(p, k):
    PA = [(C['g2'], C['g1'], C['g3']), (C['g1'], C['g3'], C['g4']), (C['g2'], C['g3'], C['g4'])]
    if k == 1:
        th, tr = 3.0, .62
        p.frustum((0, 0, 0), tr * 1.25, tr * .7, th, 5, C['trunk'], top=False, bottom=False, ring_colors=[C['trunk'], C['trunkL']])
        crown(p, (0, 0, th + 3.0), 4.6, PA[0], 2, (1, 1, .88), 3)
        crown(p, (2.9, 1.2, th + 1.9), 3.2, PA[1], 1, (1, 1, .85), 4)
        crown(p, (-2.8, -1.0, th + 2.0), 3.3, PA[2], 1, (1, 1, .85), 5)
        crown(p, (-.4, .5, th + 6.1), 2.2, PA[1], 0, (1, 1, .85), 6, cut=-.3)
    elif k == 2:
        th, tr = 4.2, .7
        p.frustum((0, 0, 0), tr * 1.3, tr * .7, th, 5, C['trunk'], top=False, bottom=False, ring_colors=[C['trunk'], C['trunkL']])
        p.beam((0, 0, th - .3), (1.9, .8, th + 2.2), .26, C['trunk'], sides=4)
        p.beam((0, 0, th - .3), (-1.8, -.6, th + 2.0), .26, C['trunk'], sides=4)
        crown(p, (0, 0, th + 3.8), 5.4, PA[1], 2, (1, 1, .9), 8)
        crown(p, (3.4, 1.0, th + 2.7), 3.6, PA[0], 1, (1, 1, .85), 9)
        crown(p, (-3.3, -.8, th + 2.6), 3.7, PA[2], 1, (1, 1, .85), 10)
    else:
        th, tr = 5.2, .78
        p.frustum((0, 0, 0), tr * 1.3, tr * .7, th, 5, C['trunk'], top=False, bottom=False, ring_colors=[C['trunk'], C['trunkL']])
        crown(p, (0, 0, th + 4.4), 5.6, PA[2], 2, (1, 1, 1.0), 12)
        crown(p, (3.1, -1.2, th + 3.0), 3.4, PA[0], 1, (1, 1, .9), 13)
        crown(p, (-3.0, 1.5, th + 3.3), 3.5, PA[1], 1, (1, 1, .9), 14)
        crown(p, (.3, .8, th + 8.8), 2.8, PA[1], 0, (1, 1, .9), 15, cut=-.3)
    sink(p, .3)


def saman(p, k):
    PA = (C['g2'], C['g1'], C['g3']), (C['g1'], C['g3'], C['g4'])
    big = k == 2
    th = 8.0 if not big else 9.2
    p.frustum((0, 0, 0), 1.5, 1.0, th, 6, C['trunk'], top=False, bottom=False, ring_colors=[C['trunk'], C['trunkL']])
    p.frustum((0, 0, 0), 2.3, 1.5, 1.4, 6, C['trunk'], top=False, bottom=False, ring_colors=[C['trunkL'], C['trunk']])
    zc = th + 2.6
    for (ax, ay) in ((4.2, 1.5), (-3.6, 2.4), (.6, -4.0)):
        p.beam((0, 0, th - .4), (ax, ay, zc), .34, C['trunk'], sides=4)
    R1 = 9.0 if not big else 10.2
    crown(p, (0, 0, zc), R1, PA[0], 2, (1, 1, .34), 20 + k, cut=-.1, jit=.07)
    sides = [(5.2, 2.5), (-5.0, 3.2), (.5, -5.6), (-4.2, -3.6)] if big else [(5.0, 2.2), (-4.6, 3.0), (.4, -5.2)]
    for i, (ax, ay) in enumerate(sides):
        crown(p, (ax, ay, zc + 1.4), 4.6 if big else 4.2, PA[(i + 1) % 2], 0, (1, 1, .55), 30 + k * 5 + i, cut=-.2)
    sink(p, .3)


def ceiba(p):
    th = 17.0
    p.frustum((0, 0, 0), 1.7, .95, th, 6, 0x7d6a58, top=False, bottom=False, ring_colors=[0x7d6a58, 0x8f7c68])
    for i in range(3):
        a = i * 2 * PI / 3 + .4
        ca, sa = cos(a), sin(a)
        ta, tb = (-sa, ca)
        p.face([(1.0 * ca, 1.0 * sa, 4.5), (3.4 * ca, 3.4 * sa, 0), (1.0 * ca + .0, 1.0 * sa + .0, 0)], 0x8f7c68, flip_ref=Vector((ca * 0.6 + ta, sa * .6 + tb, 1.5)))
        p.face([(1.0 * ca, 1.0 * sa, 4.5), (3.4 * ca, 3.4 * sa, 0), (1.0 * ca, 1.0 * sa, 0)], 0x8f7c68)
        p.face([(1.0 * ca, 1.0 * sa, 4.5), (1.0 * ca, 1.0 * sa, 0), (3.4 * ca, 3.4 * sa, 0)], 0x7d6a58)
    for (ax, ay, az) in ((4.0, 1.4, 21.0), (-3.6, 2.0, 21.4), (.6, -3.8, 21.2)):
        p.beam((0, 0, th - .6), (ax, ay, az), .3, C['trunk'], sides=4)
    PA = (C['g2'], C['g1'], C['g3'])
    crown(p, (0, 0, 21.5), 6.0, PA, 2, (1, 1, .55), 40, cut=-.15)
    for i, (ax, ay) in enumerate(((4.8, 1.8), (-4.4, 2.4), (.4, -4.8))):
        crown(p, (ax, ay, 21.8), 3.6, (C['g1'], C['g3'], C['g4']), 0, (1, 1, .6), 41 + i, cut=-.2)
    sink(p, .3)


def palma(p, h, lean, seed, nfr=11, fl=3.7):
    rng = random.Random(seed)
    ts = (0, .22, .5, .78, 1.0)
    pts = [(lean[0] * t * t, lean[1] * t * t, h * t) for t in ts]
    rad = [.95, .62, .52, .46, .4]
    CH.tube(p, pts, [(r, r) for r in rad], [C['trunkP'], C['trunkPD'], C['trunkP'], C['trunkPD']], n=5, caps=(True, False))
    top = pts[-1]
    p.ico((top[0], top[1], top[2] - .1), .7, C['palmD'], sub=0, sc=(1, 1, .8))
    # skirt of dead drooping fronds
    for i in range(5):
        phi = 2 * PI * i / 5 + rng.random() * .5
        c0 = (top[0], top[1], top[2] - .3)
        a, b = phi - .3, phi + .3
        pts_ = [c0, (c0[0] + cos(a) * 1.9, c0[1] + sin(a) * 1.9, c0[2] - 2.2), (c0[0] + cos(phi) * 2.1, c0[1] + sin(phi) * 2.1, c0[2] - 2.9), (c0[0] + cos(b) * 1.9, c0[1] + sin(b) * 1.9, c0[2] - 2.2)]
        p.face(pts_, C['dry'], up=False, flip_ref=Vector((top[0], top[1], top[2] - 1.5)))
    for layer, (n, L, rise, drop, cols) in enumerate(((nfr, fl, .1, 1.5, (C['palm'], C['palmL'])), (7, fl * .75, 1.1, .5, (C['palmL'], C['palm'])))):
        for i in range(n):
            phi = 2 * PI * i / n + layer * .35 + rng.random() * .25
            LL_ = L * (.85 + .3 * rng.random())
            spread = .42

            def P(ang, rr, dz):
                return (top[0] + cos(ang) * LL_ * rr, top[1] + sin(ang) * LL_ * rr, top[2] + rise + dz * (rr ** 1.6) - 0.0)
            tipz = -drop
            fan = [(top[0], top[1], top[2] + .3 * layer),
                   P(phi - spread, .95, tipz * 1.1), P(phi - spread / 2, .8, tipz * .6), P(phi, 1.0, tipz), P(phi + spread / 2, .8, tipz * .6), P(phi + spread, .95, tipz * 1.1)]
            p.face(fan, cols[i % 2], up=True)
    sink(p, .3)


def arbusto(p, k):
    pals = {1: (C['g3'], C['g4'], C['g5']), 2: (C['gl2'], C['gl1'], C['gl3']), 3: (C['g1'], C['g3'], C['g4'])}[k]
    lobes = {1: [(0, 0, 1.2, 2.0), (1.6, .6, .9, 1.3), (-1.5, -.5, .9, 1.4)],
             2: [(0, 0, 1.0, 1.7), (1.4, -.5, .8, 1.2), (-1.4, .6, .8, 1.3), (.2, 1.4, .7, 1.0)],
             3: [(0, 0, 1.3, 1.8), (1.2, .8, .9, 1.2), (-1.2, -.7, .9, 1.3)]}[k]
    for i, (x, y, z, r) in enumerate(lobes):
        p.ico((x, y, z * .6), r, pals[1], sub=0 if k != 1 else 1, sc=(1, 1, .75), jitter=.14, seed=k * 7 + i,
              cut_below=0.15 if k == 1 else None, bands=lobe_cols(pals))
    if k == 3:
        for (x, y, z) in ((.3, -.5, 1.9), (-.8, .4, 1.7), (.9, .6, 1.5), (-.2, 1.0, 1.4)):
            p.face([(x - .18, y - .18, z), (x + .18, y - .18, z), (x + .18, y + .18, z), (x - .18, y + .18, z)], 0xf0c040, up=True)
    sink(p, .2)


def mata(p, nb, seed, h0=3.8):
    rng = random.Random(seed)
    cols = [C['gl3'], C['gl1'], 0xd6d078, C['gl2']]
    for i in range(nb):
        phi = 2 * PI * i / nb + rng.random() * .5
        r0 = .15 + rng.random() * .35
        h = h0 * (.7 + rng.random() * .45)
        out = .7 + rng.random() * 1.1
        bx, by = r0 * cos(phi), r0 * sin(phi)
        tx, ty = -sin(phi), cos(phi)
        w = .2 + rng.random() * .08
        mid = (bx + cos(phi) * out * .3, by + sin(phi) * out * .3, h * .55)
        tip = (bx + cos(phi) * out, by + sin(phi) * out, h)
        two_sided(p, [(bx - tx * w, by - ty * w, 0), (bx + tx * w, by + ty * w, 0), (mid[0] + tx * w * .7, mid[1] + ty * w * .7, mid[2]), tip, (mid[0] - tx * w * .7, mid[1] - ty * w * .7, mid[2])], cols[i % 4])
    sink(p, .1)


def matorral(p):
    rng = random.Random(5)
    for i in range(12):
        phi = 2 * PI * i / 12 + rng.random() * .3
        h = 2.2 + rng.random() * 1.6
        out = .9 + rng.random() * 1.2
        b = (0, 0, 0)
        m = (cos(phi) * out * .5, sin(phi) * out * .5, h * .6)
        t = (cos(phi) * out, sin(phi) * out, h)
        p.beam(b, m, .09, C['dryD'], sides=3)
        p.beam(m, t, .06, C['dry'], sides=3)
        if i % 2 == 0:
            q = (m[0] + cos(phi + .9) * .8, m[1] + sin(phi + .9) * .8, m[2] + .7)
            p.beam(m, q, .05, C['dry'], sides=3)
    for i, (x, y) in enumerate(((.5, .3), (-.6, .4), (.1, -.7))):
        p.ico((x, y, 1.3 + i * .2), .55, 0x7a8a3a, sub=0, sc=(1, 1, .7), jitter=.1, seed=i)
    sink(p, .1)


# ───────────────────────── rocks ─────────────────────────
def boulder(p, c, r, seed, sc=(1, 1, .75), sub=2, pal=None, cut=-.2):
    pal = pal or (C['grayD'], C['gray'], C['grayL'])
    p.ico(c, r, pal[1], sub=sub, sc=sc, jitter=.2, seed=seed, cut_below=c[2] + cut * r * sc[2],
          bands=lambda zc, rn: pal[2] if (zc > .5 and rn > .3) else (pal[1] if (zc > -.05 or rn > .6) else pal[0]))


ROCAS = [(3.2, 1, False), (4.6, 2, True), (6.0, 3, True), (7.4, 4, False), (9.0, 5, True), (5.4, 6, True)]


def roca_llano(p, k):
    w, seed, sand = ROCAS[k - 1]
    r = w / 2
    rng = random.Random(seed)
    if sand:
        p.disc((0, 0, .04), r * 1.55, C['sand'], rings=1, segs=8)
    boulder(p, (0, 0, r * .28), r, seed, sc=(1, .85 + rng.random() * .2, .72 + rng.random() * .15))
    if k >= 3:
        boulder(p, (r * .95, -r * .5, r * .2), r * .5, seed + 7, sc=(1, 1, .8), sub=1 if k < 5 else 2)
    if k in (5, 6):
        boulder(p, (-r * .85, r * .3, r * .15), r * .42, seed + 3, sc=(1, 1, .85), sub=0)
    sink(p, .2)


def roca_rio(p, k):
    w = [3.4, 5.0, 3.0, 6.4][k - 1]
    r = w / 2
    boulder(p, (0, 0, r * .12), r, 90 + k, sc=(1, .85, .7), cut=-.35)
    if k in (2, 4):
        boulder(p, (r * .9, r * .4, 0), r * .45, 95 + k, sc=(1, 1, .8), sub=1, cut=-.35)
    O.foam_ring(p, 0, 0, r * .85, r * .72, wd=.9 + .1 * r, n=9, seed=k, z=.07, inner=.9)


def rapidos(p, k):
    rng = random.Random(60 + k)
    for i in range(11):
        x = -8.8 + (i % 4) * 5.0 + rng.uniform(-1, 1)
        y = -3.0 + (i // 4) * 3.0 + rng.uniform(-.6, .6)
        ln = rng.uniform(2.6, 5.0)
        w = rng.uniform(.35, .8)
        sk = rng.uniform(-.6, .6)
        z = .08 + .03 * (i % 3)
        p.face([(x - ln / 2, y - w, z), (x, y - w + sk * .3, z), (x + ln / 2, y - w * .6, z), (x + ln / 2 - .4, y + w, z), (x, y + w + sk * .3, z), (x - ln / 2 + .3, y + w * .6, z)],
               C['foam'] if i % 2 == 0 else C['foamB'], up=True)
    for i in range(3):
        x = rng.uniform(-7, 7)
        y = rng.uniform(-2.5, 2.5)
        O.bar(p, (x - 1.8, y, .35), (x + 1.8, y + rng.uniform(-.4, .4), .35), .55, .5, C['foam'], tcol=C['foam'], bcol=C['foamB'], caps=False)
    rocks = [(-6.5, 1.8, 1.7, 1.5), (4.6, 2.2, 1.4, 1.2), (-.8, -1.2, 2.0, 1.7), (7.0, -2.0, 1.3, 1.1), (-7.6, -2.6, 1.1, 1.0)]
    if k == 2:
        rocks = [(-5.6, -1.6, 1.5, 1.3), (6.4, 1.0, 1.8, 1.5), (-1.5, 2.2, 1.4, 1.2), (1.4, -2.4, 1.9, 1.6), (-8.2, 2.4, 1.0, .9)]
    for i, (x, y, rx, h) in enumerate(rocks):
        boulder(p, (x, y, h * .15), rx, 120 + k * 10 + i, sc=(1, .9, .6), sub=1, cut=-.4)
        O.foam_ring(p, x, y, rx * .9, rx * .8, wd=.75, n=6, seed=k * 11 + i, z=.07, inner=.9)


def cascada(p):
    p.cbox((0, 3.6, 0), (9.0, 3.2, 3.4), C['gray'], ch=.35, tcolor=C['grayL'], colors=[C['grayL'], C['grayD'], C['grayD'], C['grayD']])
    p.cbox((0, 0.9, 0), (7.4, 2.4, 2.4), C['gray'], ch=.3, tcolor=C['grayL'], colors=[C['gray'], C['grayD'], C['grayD'], C['grayD']])
    p.cbox((0, -0.9, 0), (6.0, 1.9, 1.4), C['gray'], ch=.25, tcolor=C['grayL'], colors=[C['gray'], C['grayD'], C['grayD'], C['grayD']])
    # water: tops of each step and the white falling sheets on the fronts
    for (y0, y1, zt, w) in ((2.4, 5.2, 3.4, 3.4), (-.1, 2.1, 2.4, 3.0), (-1.6, .1, 1.4, 2.4)):
        p.face([(-w / 2, y0, zt + .06), (w / 2, y0, zt + .06), (w / 2, y1, zt + .06), (-w / 2, y1, zt + .06)], C['water'], up=True)
    for (yf, zt, zb, w) in ((2.0, 3.4, 2.4, 3.0), (-.1, 2.4, 1.4, 2.4), (-1.84, 1.4, .06, 2.0)):
        p.face([(-w / 2, yf, zt), (w / 2, yf, zt), (w / 2, yf - .12, zb), (-w / 2, yf - .12, zb)], C['foam'], flip_ref=Vector((0, 8, 1)))
        p.face([(-w / 2 + .35, yf - .01, zt), (w / 2 - .35, yf - .01, zt), (w / 2 - .35, yf - .16, zb), (-w / 2 + .35, yf - .16, zb)], C['foamB'], flip_ref=Vector((0, 8, 1)))
    O.foam_ring(p, 0, -2.6, 2.6, 1.0, wd=1.0, n=9, seed=4, z=.07)
    boulder(p, (-3.2, 1.0, .4), 1.1, 150, sc=(1, 1, .8), sub=1)
    boulder(p, (3.4, 2.2, .4), 1.3, 151, sc=(1, 1, .8), sub=1)
    sink(p, .3)


# ───────────────────────── bridge (ordaz_kit convention) ─────────────────────────
def puente_recto(p):
    z = 10.0
    ring = lambda x: [(x, -3.0, z), (x, 3.0, z), (x, 3.0, z - 1.0), (x, 2.0, z - 1.6), (x, -2.0, z - 1.6), (x, -3.0, z - 1.0)]
    p.loft([ring(-12), ring(12)], C['slab'], colors=[C['slab'], C['conc'], C['concD'], C['concD'], C['concD'], C['conc']], caps=(True, True))
    for sy in (-1, 1):
        p.box((0, sy * 2.65, z), (24, .7, .85), C['conc'], bottom=False, tcolor=C['concL'])
    for x in (-9.6, -4.8, 0, 4.8, 9.6):
        p.face([(x - .8, -.12, z + .03), (x + .8, -.12, z + .03), (x + .8, .12, z + .03), (x - .8, .12, z + .03)], C['line'], up=True)
    for sy in (-1, 1):
        y = sy * 2.75
        for x in (-10, -6, -2, 2, 6, 10):
            p.beam((x, y, z + .8), (x, y, z + 2.2), .08, C['steelL'], sides=3)
        p.beam((-12, y, z + 2.2), (12, y, z + 2.2), .08, C['steelL'], sides=3)
        p.beam((-12, y, z + 1.5), (12, y, z + 1.5), .07, C['steelL'], sides=3)
    for x, sy in ((-8.0, -1), (8.0, 1)):
        p.beam((x, sy * 2.75, z + .8), (x, sy * 2.75, z + 4.4), .11, C['steelL'], sides=3)
        p.box((x, sy * 2.0, z + 4.35), (.4, 1.6, .2), C['steel'], bottom=False)
    for x in (-8, 0, 8):
        p.cbox((x, 0, -10), (1.8, 3.6, 18.4), C['conc'], ch=.25, tcolor=C['concD'], colors=[C['conc'], C['concD'], C['conc'], C['concD']])
        p.cbox((x, 0, 6.9), (3.0, 5.2, 1.5), C['concL'], ch=.3, tcolor=C['conc'])
        O.foam_ring(p, x, 0, .95, 1.9, wd=.55, n=8, seed=x + 20, z=.07, inner=.95)


def puente_pila(p):
    z0 = 10.0
    xs = [-8.0, -2.0, 8.0]
    zt = [z0, z0, 1.4]
    dz = lambda x: z0 if x <= -2 else z0 + (1.4 - z0) * (x + 2) / 10
    ring = lambda x, zt_: [(x, -3.0, zt_), (x, 3.0, zt_), (x, 3.0, -1.2), (x, -3.0, -1.2)]
    p.loft([ring(x, z) for x, z in zip(xs, zt)], C['slab'], colors=[C['slab'], C['conc'], C['concD'], C['conc']], caps=(True, True))
    for sy in (-1, 1):
        O.bar(p, (-8, sy * 2.65, z0 + .43), (-2, sy * 2.65, z0 + .43), .7, .85, C['conc'], tcol=C['concL'])
        O.bar(p, (-2, sy * 2.65, z0 + .43), (8, sy * 2.65, 1.4 + .43), .7, .85, C['conc'], tcol=C['concL'])
    p.cbox((-9.4, 0, -1.2), (2.8, 7.0, 11.6), C['concD'], ch=.3, tcolor=C['concL'])
    for x in (-6.0, -3.0):
        p.face([(x - .7, -.12, z0 + .03), (x + .7, -.12, z0 + .03), (x + .7, .12, z0 + .03), (x - .7, .12, z0 + .03)], C['line'], up=True)
    for x in (2.0, 5.5):
        zz = dz(x)
        p.face([(x - .7, -.12, zz + .03), (x + .7, -.12, zz + .03 - .1), (x + .7, .12, zz + .03 - .1), (x - .7, .12, zz + .03)], C['line'], up=True)
    for sy in (-1, 1):
        y = sy * 2.75
        px = (-6.0, -2.0, 2.0, 6.0)
        for x in px:
            p.beam((x, y, dz(x) + .8), (x, y, dz(x) + 2.2), .08, C['steelL'], sides=3)
        p.beam((-8, y, z0 + 2.2), (-2, y, z0 + 2.2), .08, C['steelL'], sides=3)
        p.beam((-2, y, z0 + 2.2), (8, y, dz(8) + 2.2), .08, C['steelL'], sides=3)
        p.beam((-8, y, z0 + 1.5), (-2, y, z0 + 1.5), .07, C['steelL'], sides=3)
        p.beam((-2, y, z0 + 1.5), (8, y, dz(8) + 1.5), .07, C['steelL'], sides=3)
    p.beam((-6.0, -2.75, z0 + .8), (-6.0, -2.75, z0 + 4.4), .11, C['steelL'], sides=3)
    p.box((-6.0, -2.0, z0 + 4.35), (.4, 1.6, .2), C['steel'], bottom=False)
    for sy in (-1, 1):
        p.box((7.2, sy * 3.7, 0), (2, 1, .5), 0x7d9f50, bottom=False)


# ───────────────────────── signage ─────────────────────────
def camino_poste(p):
    p.cbox((0, 0, 0), (.34, .34, 3.2), C['wood'], ch=.06, tcolor=C['woodL'])
    plank(p, [(-.3, 2.7), (1.6, 2.7), (2.1, 2.3), (1.6, 1.9), (-.3, 1.9)], -.1, .1, C['woodL'], C['wood'])
    plank(p, [(.3, 1.6), (-1.5, 1.6), (-2.0, 1.25), (-1.5, .9), (.3, .9)], .1, .3, C['wood'], C['woodD'])
    for (a, b) in ((0, 1), (1, 2)):
        pass
    p.face([(-.1, -.12, 2.55), (1.3, -.12, 2.55), (1.3, -.12, 2.35), (-.1, -.12, 2.35)], C['woodD'], flip_ref=Vector((0, 8, 2.5)))
    p.box((-.7, 0, 0), (.4, .4, .3), C['gray'], bottom=False, tcolor=C['grayL'])
    sink(p, .2)


def cartel_hato(p):
    for sx in (-1, 1):
        p.cbox((sx * 4.2, 0, 0), (1.5, 1.5, 1.0), C['gray'], ch=.12, tcolor=C['grayL'])
        p.cbox((sx * 4.2, 0, 1.0), (.95, .95, 4.4), C['wood'], ch=.1, tcolor=C['woodL'], colors=[C['wood'], C['woodD'], C['woodD'], C['wood']])
    pts = [(-4.2 + 8.4 * t, 5.4 + 1.5 * sin(PI * t)) for t in [i / 6 for i in range(7)]]
    for a, b in zip(pts, pts[1:]):
        O.bar(p, (a[0], 0, a[1]), (b[0], 0, b[1]), .55, .5, C['wood'], tcol=C['woodL'])
    for x in (-2.5, 2.5):
        p.beam((x, 0, 6.5), (x, 0, 4.9), .05, C['woodD'], sides=3)
    p.box((0, -.15, 3.5), (5.6, .3, 1.4), C['wallD'], bottom=False, tcolor=C['woodL'], colors={'n': C['wall']})
    sq(p, 's', 0, 0, 5.6, .3, -2.4, 2.4, 3.95, 4.45, C['woodD'], off=.18)
    sq(p, 's', 0, 0, 5.6, .3, -1.6, 1.6, 3.7, 3.85, C['tej2'], off=.19)
    for sx in (-1, 1):
        p.cbox((sx * 4.2, 0, 5.4), (1.2, 1.2, .35), C['tej1'], ch=.12, tcolor=C['tej2'])
    # skull-less longhorn silhouette on top
    for sx in (-1, 1):
        p.beam((sx * .3, 0, 7.0), (sx * 1.4, 0, 7.5), .1, C['wall'], sides=3)
    p.box((0, 0, 6.9), (.7, .4, .4), C['wall'], bottom=False)
    sink(p, .2)


# ───────────────────────── build ─────────────────────────
def build(L):
    cats = []
    add = lambda row, name, fn, *a: row.append((name, fn, a))
    bld, fen, ani, chi, veg, shr, roc, riv, brg = [], [], [], [], [], [], [], [], []
    add(bld, 'casa_hacienda_a', casa_a)
    add(bld, 'casa_hacienda_b', casa_b)
    add(bld, 'anexo_cobertizo', cobertizo)
    add(bld, 'caney', caney)
    add(bld, 'molino_viento', molino)
    add(bld, 'tanque_agua', tanque)
    add(bld, 'abrevadero', abrevadero)
    add(bld, 'pozo', pozo)
    add(bld, 'heno_a', heno_a)
    add(bld, 'heno_b', heno_b)
    add(fen, 'cerca_recta', cerca_recta)
    add(fen, 'cerca_esquina', cerca_esquina)
    add(fen, 'cerca_porton', cerca_porton)
    add(fen, 'camino_poste', camino_poste)
    add(fen, 'cartel_hato', cartel_hato)
    add(ani, 'vaca_a', cow, 0.9, 'holstein')
    add(ani, 'vaca_b', cow, 0.9, 'holstein', True)
    add(ani, 'vaca_c', cow, 0.9, 'brown')
    add(ani, 'toro', cow, 1.12, 'toro', False, True)
    add(ani, 'caballo_a', caballo, 'a')
    add(ani, 'caballo_b', caballo, 'b')
    add(ani, 'caballo_c', caballo, 'c')
    add(chi, 'chigui_a', chigui, 1)
    add(chi, 'chigui_b', chigui, 2)
    add(chi, 'chigui_c', chigui, 3)
    add(chi, 'chigui_agua', chigui_agua)
    for i, n in enumerate('abc'):
        add(veg, 'arbol_llano_' + n, arbol, i + 1)
    add(veg, 'saman_a', saman, 1)
    add(veg, 'saman_b', saman, 2)
    add(veg, 'ceiba', ceiba)
    add(veg, 'palma_llanera_a', palma, 15.0, (0.6, 0.2), 3)
    add(veg, 'palma_llanera_b', palma, 18.0, (3.4, 1.2), 5, 12, 3.9)
    add(veg, 'palma_llanera_c', palma, 21.0, (-2.6, 1.6), 8, 12, 3.9)
    for i, n in enumerate('abc'):
        add(shr, 'arbusto_llano_' + n, arbusto, i + 1)
    add(shr, 'mata_hierba_a', mata, 6, 11)
    add(shr, 'mata_hierba_b', mata, 7, 12, 4.4)
    add(shr, 'matorral_espinoso', matorral)
    for i in range(1, 7):
        add(roc, 'roca_llano_%02d' % i, roca_llano, i)
    for i in range(1, 5):
        add(riv, 'roca_rio_%02d' % i, roca_rio, i)
    add(riv, 'rapidos_llano_a', rapidos, 1)
    add(riv, 'rapidos_llano_b', rapidos, 2)
    add(riv, 'cascada_llano', cascada)
    add(brg, 'puente_llano_recto', puente_recto)
    add(brg, 'puente_llano_pila', puente_pila)
    out = []
    y = 0.0
    for row, X, Y in ((bld, 30, 34), (fen, 30, 30), (ani, 28, 20), (chi, 28, 20), (veg, 34, 30), (shr, 24, 20), (roc, 24, 22), (riv, 30, 24), (brg, 44, 30)):
        for c, (name, fn, a) in enumerate(row):
            pt = L.Part(name, loc=(c * X, -y, 0), ao=0.22)
            fn(pt, *a)
            out.append(pt)
        y += Y
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
    path = os.path.join(lib.MODEL_DIR, 'llanos_kit_manifest.md')
    with open(path, 'w') as f:
        f.write('# llanos_kit manifest\n\nLos Llanos kit (hacienda, windmill, corral fences, cattle, horses, capybaras, trees/palms, boulders, river rapids, concrete bridge). '
                'Total tris: %d. Origin = base centre at z=0 (ground, or water line for river pieces), front faces -Y. Animals face +X (rotate to place). '
                'Fences: cerca_recta runs x -3..3 (posts at -3/0/3, chains end to end every 6); cerca_esquina has the corner post at the origin with arms along +X (0..3) and -Y (0..-3); '
                'cerca_porton is 6 long (x -3..3) with its two tall gate posts at x=+-3. '
                'Bridge pieces follow ordaz_kit (recto: x -12..12, pillars on x=-8,0,8 down to z=-10, deck top z=10, 6 wide; pila: deck flush at x=-8 z=10, ramps down to z=1.4 at x=+8). '
                'chigui_agua = 3 capybaras half-submerged in a ripple ring disc (z=0.04) for placing on water.\n\n' % info['tris'])
        f.write('| Part | tris | footprint (x by y) | height (z max) |\n|---|---|---|---|\n')
        for r in rows:
            f.write('| %s | %d | %s | %s |\n' % r)


if __name__ == '__main__':
    info = lib.run(sys.modules[__name__])
    write_manifest(info)
