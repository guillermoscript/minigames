"""zulia_kit: Zulia / Lake Maracaibo oil-country kit for LA FIESTA (land derricks, pumpjacks, crude tanks, sheds, refinery unit,
pipes, industrial pier + fishing jetties, boats, colonial coloured houses, church, stilt houses, small props, lake bridge pieces).
Each Part = one instanceable piece, origin = base centre (z=0 ground; water line z=0 for marine pieces), front = -Y.
Boats: bow +X, waterline z=0. Bridge pieces follow ordaz_kit (run along X, x -12..12, deck top z=10, pillars to z=-14)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
import prop_barcos as BB
import prop_ccs_city as CC
from mathutils import Vector

NAME = 'zulia_kit'
GROUND = 0xd2b27a
PREVIEW = dict(az=0, pitch=62, fit=0.95, size=3000)
AO_DIST = 10

V = Vector
PI = math.pi
cos, sin = math.cos, math.sin
LIFT = 1.1

Z = dict(
    steel=0x30343c, steelL=0x5a606c, steelM=0x444a54, black=0x22252b, yellow=0xf2c230, yellowD=0xc99a18, orange=0xec8a3c,
    white=0xf2f4f8, band=0xcfd6e2, grey=0x9aa0ab, greyL=0xc4c9d2, greyD=0x666d79, greyLL=0xdde0e6,
    conc=0xb9bfc9, concD=0x8a93a3, concL=0xd3d7de, red=0xd92a2a, redD=0xa01f1f, rust=0x9a5438, rustL=0xb96d48,
    blueG=0x6f8aa8, blueGD=0x4d6786, blueGL=0x93aac4, blue=0x2f6fd0, navy=0x2a4a8a,
    wood=0x7a5230, woodL=0xa57a4a, woodD=0x5a3a20, plank=0x9c7448, plankL=0xb88a58,
    glass=0x4a7ea8, glassD=0x2f5478, dark=0x3b2e28, door=0x7a4a2a,
    flame=0xff7a2a, flameY=0xffd23a,
    Y=0xf2c744, R=0xd9473b, O=0xec8a3c, B=0x8cc4e8, T=0x3fb0a8, P=0xf0a0b8, cream=0xf6edd6, wh=0xf6f1e4,
    tile=0xd2663a, tileD=0xb24a2c, tileL=0xe58552, tin=0xa8afb8, tinD=0x868e9a, tinR=0xb5603f, tinRL=0xc97a52,
    stone=0x9a9484, stoneL=0xc2baa4, gold=0xf0b830, goldD=0xc8901c, green=0x2f7f6a, teal=0x2f6a6a,
)


# ───────────────────────── generic helpers ─────────────────────────
def cyl_x(p, c, r, ln, n, c1, c2=None, caps=True):
    cx, cy, cz = c
    ring = lambda x: [(x, cy + r * cos(2 * PI * i / n), cz + r * sin(2 * PI * i / n)) for i in range(n)]
    p.loft([ring(cx - ln / 2), ring(cx + ln / 2)], c1, colors=[c1, c2 or c1], caps=(caps, caps), ref=V(c))


def cyl_y(p, c, r, wd, n, c1, c2=None, caps=(True, True)):
    cx, cy, cz = c
    ring = lambda y: [(cx + r * cos(2 * PI * i / n), y, cz + r * sin(2 * PI * i / n)) for i in range(n)]
    p.loft([ring(cy - wd / 2), ring(cy + wd / 2)], c1, colors=[c1, c2 or c1], caps=caps, ref=V(c))


def bar(p, a, b, w, h, col, tcol=None, caps=False):
    a, b = V(a), V(b)
    d = b - a
    if d.length < 1e-6:
        return
    d.normalize()
    up = V((0, 0, 1)) if abs(d.z) < 0.95 else V((1, 0, 0))
    u = d.cross(up).normalized()
    v = u.cross(d).normalized()
    if v.z < 0:
        v = -v

    def ring(c):
        return [tuple(c + u * sx * w / 2 + v * sy * h / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    p.loft([ring(a), ring(b)], col, colors=[col, col, tcol or col, col], caps=(caps, caps))


def sq(p, side, cx, cy, w, d, a0, a1, z0, z1, col, off=.04):
    CC.sq(p, side, cx, cy, w, d, a0, a1, z0, z1, col, off)


def wq(p, B, side, u0, u1, za, zb, col, off=0.04, arch=0.0):
    cx, cy, w, d = B
    if side == 's':
        f = lambda u, z: (cx + u, cy - d / 2 - off, z)
    elif side == 'n':
        f = lambda u, z: (cx + u, cy + d / 2 + off, z)
    elif side == 'e':
        f = lambda u, z: (cx + w / 2 + off, cy + u, z)
    else:
        f = lambda u, z: (cx - w / 2 - off, cy + u, z)
    pts = [f(u0, za), f(u1, za), f(u1, zb)]
    if arch > 0:
        pts.append(f((u0 + u1) / 2, zb + arch))
    pts.append(f(u0, zb))
    p.face(pts, col, flip_ref=V((cx, cy, (za + zb) / 2)))


def band(p, cx, cy, w, d, z, h, col, ov=.2):
    p.box((cx, cy, z), (w + 2 * ov, d + 2 * ov, h), col, bottom=False, top=False)


def hip(p, cx, cy, w, d, z, rh, c1, c2, ov=.45, top_scale=.3, bands=2, topc=None):
    rings = []
    for k in range(bands + 1):
        t = k / bands
        sc = 1 - (1 - top_scale) * t
        ww, dd = (w + 2 * ov) * sc, (d + 2 * ov) * sc
        zz = z + rh * t
        rings.append([(cx - ww / 2, cy - dd / 2, zz), (cx + ww / 2, cy - dd / 2, zz), (cx + ww / 2, cy + dd / 2, zz), (cx - ww / 2, cy + dd / 2, zz)])
    ref = V((cx, cy, z + rh * .3))
    for k in range(bands):
        p.loft([rings[k], rings[k + 1]], c1 if k % 2 == 0 else c2, ref=ref)
    p.face(rings[-1], topc if topc is not None else c2, flip_ref=ref)


def gable_x(p, cx, cy, w, d, z, rh, c1, c2, wallc, ov=.45, strips=2):
    hw, hd = w / 2 + ov, d / 2 + ov
    ref = V((cx, cy, z + rh / 2))
    for sg in (-1, 1):
        for k in range(strips):
            t0, t1 = k / strips, (k + 1) / strips
            p.face([(cx - hw, cy + sg * hd * (1 - t0), z + rh * t0), (cx + hw, cy + sg * hd * (1 - t0), z + rh * t0),
                    (cx + hw, cy + sg * hd * (1 - t1), z + rh * t1), (cx - hw, cy + sg * hd * (1 - t1), z + rh * t1)],
                   c1 if k % 2 == 0 else c2, flip_ref=ref)
    for sx in (-1, 1):
        x = cx + sx * (w / 2 + .02)
        p.face([(x, cy - d / 2, z), (x, cy + d / 2, z), (x, cy, z + rh * (d / 2) / hd)], wallc, flip_ref=ref)


def gable_y(p, cx, cy, w, d, z, rh, c1, c2, wallc, ov=.45, strips=2, front=True):
    hw, hd = w / 2 + ov, d / 2 + ov
    ref = V((cx, cy, z + rh / 2))
    for sg in (-1, 1):
        for k in range(strips):
            t0, t1 = k / strips, (k + 1) / strips
            p.face([(cx + sg * hw * (1 - t0), cy - hd, z + rh * t0), (cx + sg * hw * (1 - t0), cy + hd, z + rh * t0),
                    (cx + sg * hw * (1 - t1), cy + hd, z + rh * t1), (cx + sg * hw * (1 - t1), cy - hd, z + rh * t1)],
                   c1 if k % 2 == 0 else c2, flip_ref=ref)
    ys = [cy + d / 2 + .02] + ([cy - d / 2 - .02] if front else [])
    for y in ys:
        p.face([(cx - w / 2, y, z), (cx + w / 2, y, z), (cx, y, z + rh * (w / 2) / hw)], wallc, flip_ref=ref)


def parapet(p, cx, cy, w, d, z, hgt, thk, topc, wallc, floorc, ov=.15):
    ow, od = w + 2 * ov, d + 2 * ov
    iw, idp = ow - 2 * thk, od - 2 * thk
    R = lambda ww, dd, zz: [(cx - ww / 2, cy - dd / 2, zz), (cx + ww / 2, cy - dd / 2, zz), (cx + ww / 2, cy + dd / 2, zz), (cx - ww / 2, cy + dd / 2, zz)]
    ref = V((cx, cy, z + hgt / 2))
    p.loft([R(ow, od, z), R(ow, od, z + hgt)], wallc, ref=ref)
    top = [R(ow, od, z + hgt), R(iw, idp, z + hgt)]
    for i in range(4):
        j = (i + 1) % 4
        p.face([top[0][i], top[0][j], top[1][j], top[1][i]], topc, up=True)
    p.loft([R(iw, idp, z + hgt), R(iw, idp, z + .1)], wallc, ref=V((cx + 99, cy + 99, z + hgt)))
    p.grid((cx, cy, z + .1), (iw, idp), 3, 3, floorc)


def dome(p, c, r, hz, n, rings, c1, c2, rz=0.0, ref_dz=-1.0):
    cx, cy, cz = c
    rs = []
    for k in range(rings):
        a = (PI / 2) * k / rings
        rr, zz = r * cos(a), cz + hz * sin(a)
        rs.append([(cx + rr * cos(rz + 2 * PI * i / n), cy + rr * sin(rz + 2 * PI * i / n), zz) for i in range(n)])
    ref = V((cx, cy, cz + ref_dz))
    p.loft(rs, c1, closed=True, colors=[c1, c2], ref=ref)
    apex = (cx, cy, cz + hz)
    for i in range(n):
        p.face([rs[-1][i], rs[-1][(i + 1) % n], apex], c1 if i % 2 == 0 else c2, flip_ref=ref)


def cross(p, x, y, z, hh=1.8, col=None):
    col = col if col is not None else Z['goldD']
    p.box((x - .12, y - .12, z), (.24, .24, hh), col, bottom=False)
    p.box((x - .5, y - .12, z + hh * .55), (1.0, .24, .24), col, bottom=False)


def plank(p, pts, y0, y1, col):
    n = len(pts)
    ref = V((sum(q[0] for q in pts) / n, (y0 + y1) / 2, sum(q[1] for q in pts) / n))
    p.face([(u, y0, z) for u, z in pts], col, flip_ref=ref)
    p.face([(u, y1, z) for u, z in pts], col, flip_ref=ref)
    for i in range(n):
        j = (i + 1) % n
        p.face([(pts[i][0], y0, pts[i][1]), (pts[j][0], y0, pts[j][1]), (pts[j][0], y1, pts[j][1]), (pts[i][0], y1, pts[i][1])], col, flip_ref=ref)


def valve_wheel(p, c, r, col):
    p.frustum(c, r, r, .12, 6, col, bottom=False)


# ═════════════════════════════ OIL FIELD ═════════════════════════════
def lattice(p, x, y, z0, z1, r0, r1, panels, col, colL, leg=.26, brace=.12, xpan=1, shape=.9):
    zs = [z0 + (z1 - z0) * i / panels for i in range(panels + 1)]
    rs = [r0 + (r1 - r0) * ((i / panels) ** shape) for i in range(panels + 1)]
    C = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for i in range(panels):
        for (sx, sy) in C:
            p.beam((x + sx * rs[i], y + sy * rs[i], zs[i]), (x + sx * rs[i + 1], y + sy * rs[i + 1], zs[i + 1]), leg, col, sides=3)
    for i in range(panels):
        for k in range(4):
            a, b = C[k], C[(k + 1) % 4]
            p.beam((x + a[0] * rs[i], y + a[1] * rs[i], zs[i]), (x + b[0] * rs[i], y + b[1] * rs[i], zs[i]), brace, colL, sides=3)
    for i in range(panels):
        for k in range(4):
            a, b = C[k], C[(k + 1) % 4]
            A0 = (x + a[0] * rs[i], y + a[1] * rs[i], zs[i])
            B0 = (x + b[0] * rs[i], y + b[1] * rs[i], zs[i])
            A1 = (x + a[0] * rs[i + 1], y + a[1] * rs[i + 1], zs[i + 1])
            B1 = (x + b[0] * rs[i + 1], y + b[1] * rs[i + 1], zs[i + 1])
            p.beam(A0, B1, brace, colL, sides=3)
            if i < xpan:
                p.beam(B0, A1, brace, colL, sides=3)

    def rat(z):
        t = max(0, min(1, (z - z0) / (z1 - z0)))
        return r0 + (r1 - r0) * t ** shape
    return rat


def derrick(p, H=36.0, B=8.0, panels=4, xpan=2, plat=(.38, .68), top_r=.95):
    r0 = B / 2
    p.cbox((0, 0, -.4), (B + 2.6, B + 2.6, .9), Z['conc'], ch=.28, tcolor=Z['concL'])
    zt = H - 3.7
    rat = lattice(p, 0, 0, .5, zt, r0, top_r, panels, Z['steel'], Z['steelM'], xpan=xpan)
    for f in plat:
        z = .5 + (zt - .5) * f
        r = rat(z)
        p.cbox((0, 0, z), (2 * r + .7, 2 * r + .7, .32), Z['steelM'], ch=.08, tcolor=Z['steelL'])
    p.cbox((0, 0, zt), (top_r * 2 + 1.0, top_r * 2 + 1.0, .35), Z['steelM'], ch=.08, tcolor=Z['steelL'])
    p.cbox((0, 0, zt + .35), (2.2, 2.2, 2.1), Z['yellow'], ch=.3, tcolor=Z['yellowD'])
    p.frustum((0, 0, zt + 2.45), 1.5, .0, H - zt - 2.45 + .1, 4, Z['yellow'], rz=PI / 4, bottom=False)
    cyl_y(p, (0, 0, zt + 1.4), .7, 2.6, 6, Z['steelM'], Z['steelL'], caps=(True, True))
    p.cbox((0, -B / 2 - .9, .5), (3.4, 1.5, 1.8), Z['greyL'], ch=.15, tcolor=Z['yellowD'])
    p.beam((2.0, -B / 2 - .9, 1.0), (B / 2 + .6, -B / 2 - .9, 1.0), .2, Z['steelL'], sides=4)


def balancin(p, body, beam_c, base_c, cw_c):
    S, SL = Z['steel'], Z['steelL']
    p.cbox((0, 0, 0), (11.5, 3.2, .7), base_c, ch=.15, tcolor=Z['concL'])
    p.cbox((-3.9, 0, .7), (2.8, 2.0, 2.0), body, ch=.25, tcolor=beam_c)
    for sy in (-1, 1):
        cyl_y(p, (-3.9, sy * 1.5, 2.7), 1.5, .45, 8, cw_c, SL, caps=(sy == -1, sy == 1))
    for sy in (-.85, .85):
        p.beam((-1.2, sy, .7), (0, sy * .35, 6.4), .16, body, sides=3)
        p.beam((1.2, sy, .7), (0, sy * .35, 6.4), .16, body, sides=3)
    p.box((-.3, -.7, 6.2), (.6, 1.4, .5), S, bottom=False)
    a = math.radians(-9)
    px, pz = 0.0, 6.9

    def Pt(t, y=0.0):
        return (px + t * cos(a), y, pz + t * sin(a))
    bar(p, Pt(-4.6), Pt(3.4), .55, .75, beam_c, caps=True)
    hx, hz = Pt(3.4)[0], Pt(3.4)[2]
    pts = [(hx - .6, hz + .4), (hx + .4, hz + .4), (hx + 1.15, hz - .6), (hx + 1.5, hz - 2.3), (hx + .6, hz - 2.9), (hx - .2, hz - 1.4), (hx - .6, hz - .2)]
    plank(p, pts, -.28, .28, beam_c)
    for sy in (-1, 1):
        p.beam((-3.9 + .5, sy * 1.2, 3.3), Pt(-4.4, sy * .3), .09, SL, sides=3)
    p.beam((hx + 1.35, 0, hz - 2.4), (hx + 1.35, 0, 1.5), .06, S, sides=3)
    p.cbox((hx + 1.35 - .5, -.55, .7), (1.0, 1.1, 1.0), S, ch=.12, tcolor=SL)
    p.beam((hx + 1.35, 0, 1.7), (hx + 1.35, 0, 2.5), .12, SL, sides=4)
    p.beam((hx + 1.85, 0, 1.0), (hx + 3.8, 0, 1.0), .15, SL, sides=4)


def cabezal_pozo(p):
    S, SL = Z['steel'], Z['steelL']
    p.cbox((0, 0, -.2), (4.2, 4.2, .6), Z['conc'], ch=.15, tcolor=Z['concL'])
    p.frustum((0, 0, .4), .75, .75, .3, 6, S, tcolor=SL, bottom=False)
    p.frustum((0, 0, .7), .45, .38, 2.4, 6, Z['steelM'], tcolor=SL, bottom=False)
    p.frustum((0, 0, 1.4), .75, .75, .22, 6, SL, tcolor=S, bottom=False)
    p.frustum((0, 0, 3.1), .55, .1, .5, 6, Z['yellow'], bottom=False)
    p.beam((0, 0, 3.55), (0, 0, 4.1), .08, SL, sides=3)
    p.frustum((.0, -.55, 3.1), .3, .3, .12, 6, Z['white'], bottom=False)
    for sx in (-1, 1):
        p.beam((sx * .4, 0, 1.6), (sx * 2.5, 0, 1.6), .22, SL, sides=5)
        p.box((sx * 1.5 - .35, -.35, 1.25), (.7, .7, .7), Z['yellow'], bottom=False)
        valve_wheel(p, (sx * 1.5, 0, 2.0), .45, Z['red'])
        p.beam((sx * 2.5, 0, 1.6), (sx * 2.5, 0, .5), .22, SL, sides=5)


def tanque_a(p):
    R, H = 6.0, 9.6
    n = 10
    p.frustum((0, 0, -.2), R + .2, R + .2, .8, n, Z['concD'], tcolor=Z['conc'], bottom=False)
    p.frustum((0, 0, .6), R, R, 4.5, n, Z['white'], bottom=False, top=False, ring_colors=[Z['white'], Z['greyLL']])
    p.frustum((0, 0, 5.1), R + .06, R + .06, .3, n, Z['band'], bottom=False, top=False)
    p.frustum((0, 0, 5.4), R, R, 4.2, n, Z['white'], bottom=False, top=False, ring_colors=[Z['white'], Z['greyLL']])
    p.frustum((0, 0, H), R + .25, R + .25, .35, n, Z['steelL'], tcolor=Z['greyL'], bottom=False)
    p.frustum((0, 0, H + .35), R + .05, 2.4, 1.4, n, Z['greyLL'], tcolor=Z['band'], bottom=False, ring_colors=[Z['greyLL'], Z['white']])
    p.frustum((.0, 0, H + 1.75), 1.0, .8, .6, 6, Z['grey'], tcolor=Z['greyD'], bottom=False)
    a = -PI / 2 - .7
    lx, ly = (R + .1) * cos(a), (R + .1) * sin(a)
    for dx in (-.35, .35):
        p.beam((lx + dx, ly - .05, .5), (lx + dx, ly - .05, H), .06, Z['steel'], sides=3)
    for z in (2.5, 5.0, 7.5):
        p.beam((lx - .35, ly - .05, z), (lx + .35, ly - .05, z), .05, Z['steel'], sides=3)


def tanque_b(p):
    R, H = 5.2, 12.6
    n = 10
    p.frustum((0, 0, -.2), R + .2, R + .2, .8, n, Z['concD'], tcolor=Z['conc'], bottom=False)
    for k, z in enumerate((.6, 6.7)):
        p.frustum((0, 0, z), R, R, 5.9, n, Z['white'], bottom=False, top=False, ring_colors=[Z['white'], Z['greyLL']])
    p.frustum((0, 0, 12.4 - 5.9 + .6 + 5.9 - .0), R, R, .0001, n, Z['white'], bottom=False, top=False) if False else None
    p.frustum((0, 0, H - .1), R + .2, R + .2, .3, n, Z['steelL'], tcolor=Z['greyL'], bottom=False)
    p.frustum((0, 0, H + .2), R, R * .55, 1.1, n, Z['greyLL'], bottom=False, ring_colors=[Z['greyLL'], Z['white']])
    p.frustum((0, 0, H + 1.3), R * .55, .9, .9, n, Z['white'], tcolor=Z['band'], bottom=False)
    x0 = R + .6
    p.beam((x0, -1.0, .2), (x0, -1.0, H + .6), .28, Z['steelL'], sides=4)
    p.beam((x0, -1.0, H + .6), (R - 1.2, -1.0, H + 1.2), .28, Z['steelL'], sides=4)
    p.frustum((x0, -1.0, 3.0), .5, .5, .3, 6, Z['red'], tcolor=Z['redD'], bottom=False)
    a = -PI / 2 - .8
    lx, ly = (R + .1) * cos(a), (R + .1) * sin(a)
    for dx in (-.3, .3):
        p.beam((lx + dx, ly - .05, .5), (lx + dx, ly - .05, H), .05, Z['steel'], sides=3)


def tanque_esfera(p):
    R, cz = 4.3, 5.9
    n = 10
    lat = [-60, -30, 0, 30, 60]
    rings = []
    for k, l in enumerate(lat):
        a = math.radians(l)
        ph = (k % 2) * PI / n
        rings.append([(R * cos(a) * cos(2 * PI * i / n + ph), R * cos(a) * sin(2 * PI * i / n + ph), cz + R * sin(a)) for i in range(n)])
    p.loft(rings, Z['white'], colors=[Z['white'], Z['greyLL']], ref=V((0, 0, cz)))
    p.face(rings[0], Z['band'], flip_ref=V((0, 0, cz)))
    p.face(rings[-1], Z['white'], flip_ref=V((0, 0, cz)))
    p.frustum((0, 0, cz - .25), R + .15, R + .15, .5, n, Z['band'], bottom=False, top=False)
    for i in range(6):
        a = 2 * PI * i / 6 + .2
        p.beam((3.9 * cos(a), 3.9 * sin(a), -.2), (R * cos(a) * .98, R * sin(a) * .98, cz - .1), .26, Z['steelL'], sides=3)
    p.cbox((0, 0, -.3), (9.6, 9.6, .45), Z['conc'], ch=.1, tcolor=Z['concL'])
    p.frustum((0, 0, cz + R - .1), .6, .5, .5, 6, Z['greyD'], tcolor=Z['grey'], bottom=False)
    p.beam((R * .9, -1.5, cz + .2), (0, -R * .5, cz + R + .3), .09, Z['steel'], sides=3)


def caseta(p, k):
    W, D, H = ((7.0, 5.0, 3.8), (9.0, 5.0, 3.4), (5.2, 5.2, 4.6))[k]
    body = (Z['grey'], Z['white'], Z['greyL'])[k]
    roof = (Z['greyD'], Z['greyL'], Z['steelL'])[k]
    p.cbox((0, 0, -.2), (W + .6, D + .6, .5), Z['conc'], ch=.1, tcolor=Z['concL'])
    p.cbox((0, 0, .3), (W, D, H - .3), body, ch=.2, tcolor=roof)
    p.box((0, 0, H), (W + .6, D + .6, .3), roof, bottom=False, tcolor=Z['greyD'])
    if k == 0:
        sq(p, 's', 0, 0, W, D, -.9, .9, .3, 2.6, Z['steel'])
        for x in (-2.4, 2.4):
            sq(p, 's', 0, 0, W, D, x - .6, x + .6, 1.7, 2.7, Z['glassD'])
        for x, y in ((-2.0, 0), (1.5, .8)):
            p.frustum((x, y, H + .3), .5, .55, .35, 6, Z['grey'], tcolor=Z['greyL'], bottom=False)
            p.frustum((x, y, H + .65), .8, .6, .2, 6, Z['greyD'], tcolor=Z['steelL'], bottom=False)
        p.beam((W / 2, .8, 2.2), (W / 2 + 1.6, .8, 2.2), .25, Z['steelL'], sides=5)
        p.beam((W / 2 + 1.6, .8, 2.2), (W / 2 + 1.6, .8, 1.0), .25, Z['steelL'], sides=5)
    elif k == 1:
        sq(p, 's', 0, 0, W, D, -3.8, -1.6, .5, 2.6, Z['steelM'])
        sq(p, 's', 0, 0, W, D, 1.0, 3.8, 1.5, 2.6, Z['glassD'])
        for x in (-2.8, 0, 2.8):
            p.box((x - .4, 0, H + .3), (.8, 1.8, .55), Z['greyD'], bottom=False, tcolor=Z['grey'])
        for x in (-3.2, -2.4):
            sq(p, 's', 0, 0, W, D, x, x + .35, .4, 1.4, Z['greyD'])
        p.beam((-W / 2, 1.2, 2.4), (-W / 2 - 1.4, 1.2, 2.4), .22, Z['steelL'], sides=5)
        p.beam((-W / 2 - 1.4, 1.2, 2.4), (-W / 2 - 1.4, 1.2, 4.4), .22, Z['steelL'], sides=5)
    else:
        sq(p, 's', 0, 0, W, D, -.8, .8, .3, 2.5, Z['steel'])
        sq(p, 's', 0, 0, W, D, 1.4, 2.2, 2.6, 3.6, Z['glassD'])
        p.frustum((1.0, 1.0, H + .3), .6, .5, 2.6, 6, Z['grey'], tcolor=Z['greyD'], bottom=False)
        p.frustum((1.0, 1.0, H + 2.9), .8, .8, .25, 6, Z['red'], tcolor=Z['redD'], bottom=False)
        p.beam((-1.6, 0, H + .3), (-1.6, 0, H + 1.6), .22, Z['steelL'], sides=5)
        p.beam((-1.6, 0, H + 1.6), (-.2, 0, H + 1.6), .22, Z['steelL'], sides=5)
        p.beam((W / 2, -.9, 2.0), (W / 2 + 1.3, -.9, 2.0), .22, Z['steelL'], sides=5)


def planta(p):
    S, SL = Z['steel'], Z['steelL']
    p.cbox((0, 0, -.3), (20.4, 8.4, .6), Z['conc'], ch=.12, tcolor=Z['concL'])
    for x, h in ((-8.0, 19.0), (-5.6, 16.0), (-3.2, 13.0)):
        p.frustum((x, 2.2, .3), .85, .55, h * .5, 6, Z['white'], bottom=False, top=False)
        p.frustum((x, 2.2, .3 + h * .5), .55, .45, h * .5, 6, Z['red'], tcolor=Z['redD'], bottom=False, top=True)
    for x, r, h in ((3.2, 1.9, 12.0), (7.8, 1.5, 9.5)):
        p.frustum((x, 1.6, .3), r, r, h, 8, Z['grey'], bottom=False, top=False, ring_colors=[Z['grey'], Z['greyL']])
        dome(p, (x, 1.6, .3 + h), r, r * .9, 8, 2, Z['greyL'], Z['grey'])
        for z in (h * .33, h * .66):
            p.frustum((x, 1.6, z), r + .12, r + .12, .25, 8, Z['steelL'], bottom=False, top=False)
        p.beam((x + r + .05, 1.0, .5), (x + r + .05, 1.0, h), .07, S, sides=3)
    cyl_x(p, (-1.8, -1.6, 1.6), 1.0, 5.5, 8, Z['greyL'], Z['white'])
    for x in (-3.4, 0.0):
        p.box((x - .3, -2.2, 0.3), (.6, 1.2, .8), Z['conc'], bottom=False)
    for x in (-9.0, -3.0, 3.0, 9.0):
        p.box((x - .15, -3.1, 0.3), (.3, .3, 3.6), Z['steelM'], bottom=False)
    p.box((0, -3.25, 3.6), (18.4, .3, .3), Z['steelM'], bottom=False)
    for y, c in ((-3.1, Z['red']), (-2.8, Z['yellow']), (-3.4, Z['steelL'])):
        p.beam((-9.2, y, 3.7), (9.2, y, 3.7), .24, c, sides=5)
    p.beam((3.2, -.4, .5), (3.2, -2.8, 3.5), .2, SL, sides=4)
    p.beam((7.8, -.4, .5), (7.8, -2.8, 3.5), .2, SL, sides=4)
    p.cbox((8.0, -2.4, .3), (3.2, 2.2, 2.4), Z['white'], ch=.15, tcolor=Z['greyD'])
    sq(p, 's', 8.0, -2.4, 3.2, 2.2, -.5, .5, .4, 1.9, Z['steelM'])


def antorcha(p):
    S, SL = Z['steel'], Z['steelL']
    p.cbox((0, 0, -.3), (4.6, 4.6, .6), Z['conc'], ch=.1, tcolor=Z['concL'])
    p.frustum((0, 0, .3), .75, .6, 5, 6, S, bottom=False, top=False)
    p.frustum((0, 0, 5.3), .6, .45, 12.5, 6, Z['steelM'], bottom=False, top=False, ring_colors=[Z['steelM'], S])
    p.frustum((0, 0, 17.8), .45, .35, 10, 6, S, bottom=False, top=False, ring_colors=[S, Z['steelM']])
    for z in (5.3, 17.8):
        p.frustum((0, 0, z - .1), 1.4, 1.4, .3, 6, SL, tcolor=Z['steelM'], bottom=False)
    p.frustum((0, 0, 27.8), .6, .7, 1.4, 6, Z['red'], tcolor=Z['redD'], bottom=False, top=False)
    for i in range(3):
        a = 2 * PI * i / 3 + .5
        p.beam((2.0 * cos(a), 2.0 * sin(a), -.1), (0, 0, 17.8), .06, SL, sides=3)
    p.frustum((0, 0, 29.2), .8, .0, 1.8, 6, Z['flame'], bottom=False)
    p.frustum((.1, 0, 29.3), .45, .0, 1.0, 5, Z['flameY'], bottom=False)
    p.beam((0, 0, 11.0), (1.8, 0, 11.0), .1, SL, sides=3)


def tuberia_recta(p):
    S, SL = Z['steel'], Z['steelL']
    z = 1.35
    p.beam((-3, 0, z), (3, 0, z), .5, Z['grey'], sides=8)
    for x in (-2.88, 2.88):
        cyl_x(p, (x, 0, z), .66, .24, 8, SL, S, caps=True)
    cyl_x(p, (0, 0, z), .6, .22, 8, Z['red'], Z['redD'], caps=True)
    for x in (-1.5, 1.5):
        p.cbox((x - .5, -.5, 0), (1.0, 1.0, z - .45), Z['conc'], ch=.1, tcolor=Z['concL'])
        p.box((x - .6, -.6, z - .5), (1.2, 1.2, .18), S, bottom=False)


def tuberia_codo(p):
    S, SL = Z['steel'], Z['steelL']
    z = 1.35
    p.beam((-3, 0, z), (-1.0, 0, z), .5, Z['grey'], sides=8)
    c = (-1.0, 1.0)
    prev = (-1.0, 0.0)
    for k in range(1, 4):
        a = -PI / 2 + (PI / 2) * k / 3
        pt = (c[0] + cos(a) * 1.0, c[1] + sin(a) * 1.0)
        p.beam((prev[0], prev[1], z), (pt[0], pt[1], z), .5, Z['grey'], sides=8)
        prev = pt
    p.beam((0.0, 1.0, z), (0.0, 3, z), .5, Z['grey'], sides=8)
    cyl_x(p, (-2.88, 0, z), .66, .24, 8, SL, S)
    cyl_y(p, (0, 2.88, z), .66, .24, 8, SL, S)
    cyl_y(p, (0, 1.9, z), .6, .22, 8, Z['red'], Z['redD'])
    for (x, y) in ((-2, 0), (0, 2.1)):
        p.cbox((x - .5, y - .5, 0), (1.0, 1.0, z - .45), Z['conc'], ch=.1, tcolor=Z['concL'])


def tuberia_pared(p):
    S, SL = Z['steel'], Z['steelL']
    for x in (-5.4, 0, 5.4):
        for y in (-1.2, 1.2):
            p.box((x - .15, y - .15, 0), (.3, .3, 2.9), Z['steelM'], bottom=False)
        p.box((x - .15, -1.4, 1.35), (.3, 2.8, .25), Z['steelM'], bottom=False)
        p.box((x - .15, -1.4, 2.65), (.3, 2.8, .25), Z['steelM'], bottom=False)
    cols = (Z['grey'], Z['red'], Z['yellow'], Z['greyL'])
    for (y, z), c in zip(((-.9, 1.95), (.9, 1.95), (-.5, 3.15), (.5, 3.15)), cols):
        p.beam((-6, y, z), (6, y, z), .36, c, sides=6)
        for x in (-5.9, 5.9):
            pass
    p.beam((-5.4, -1.2, .3), (-1.8, -1.2, 2.7), .07, S, sides=3)
    p.beam((1.8, 1.2, .3), (5.4, 1.2, 2.7), .07, S, sides=3)


def tablero(p):
    S, SL = Z['steel'], Z['steelL']
    p.cbox((0, 0, -.3), (15, 7, .5), Z['conc'], ch=.1, tcolor=Z['concL'])
    for sx in (-1, 1):
        x = sx * 6.2
        p.frustum((x, 0, .2), .75, .3, 11.0, 4, Z['concD'], rz=PI / 4, bottom=False, top=True)
        p.box((x - 2.3, -.2, 8.8), (4.6, .4, .35), S, bottom=False)
        p.beam((x - .5, 0, 7.6), (x - 2.2, 0, 8.8), .08, SL, sides=3)
        p.beam((x + .5, 0, 7.6), (x + 2.2, 0, 8.8), .08, SL, sides=3)
        for dx in (-2.0, 0, 2.0):
            p.frustum((x + dx, 0, 9.15), .22, .16, .8, 4, Z['white'], rz=PI / 4, bottom=False)
    for dx in (-2.0, 0, 2.0):
        p.beam((-6.2 + dx, 0, 9.9), (6.2 + dx, 0, 9.9), .05, S, sides=3)
    p.cbox((0, 0, .2), (3.6, 2.8, 2.9), Z['blueG'], ch=.2, tcolor=Z['blueGL'])
    for x in (-1.1, 0, 1.1):
        p.frustum((x, 0, 3.1), .24, .2, 1.1, 4, Z['white'], rz=PI / 4, bottom=False)
    for x in (-1.2, -.4, .4, 1.2):
        sq(p, 's', 0, 0, 3.6, 2.8, x - .12, x + .12, .5, 2.5, Z['blueGD'])
    p.cbox((4.0, -1.4, .2), (1.4, 1.4, 1.8), Z['greyL'], ch=.1, tcolor=Z['grey'])


# ═════════════════════════════ PIERS ═════════════════════════════
def muelle_petrolero(p):
    S, SL = Z['steel'], Z['steelL']
    L, Wd = 32.0, 7.0
    p.cbox((-L / 2, -Wd / 2, 1.2), (L, Wd, .8), Z['conc'], ch=.2, tcolor=Z['concL']) if False else p.cbox((0, 0, 1.2), (L, Wd, .8), Z['conc'], ch=.2, tcolor=Z['concL'])
    for ix in range(9):
        x = -L / 2 + 1.5 + ix * (L - 3) / 8
        for sy in (-2.6, 2.6):
            p.frustum((x, sy, -4), .55, .5, 5.3, 4, Z['concD'], rz=PI / 4, bottom=False, top=False)
    for sy in (-1, 1):
        p.box((0, sy * 3.2 - .17, 2.0), (L, .35, .35), Z['concD'], bottom=False, tcolor=Z['concL'])
    for y, c in ((-1.5, Z['grey']), (-.5, Z['red']), (.5, Z['yellow'])):
        p.beam((-L / 2 + 1, y, 2.9), (L / 2 - 6, y, 2.9), .38, c, sides=6)
    for x in (-13, -7, -1, 5, 10):
        p.box((x - .2, -2.0, 2.0), (.4, 3.0, 1.0), Z['steelM'], bottom=False)
    p.cbox((L / 2 - 4.5 - 1.0, -2.0, 2.0), (2.0, 2.0, 1.0), Z['yellow'], ch=.15, tcolor=Z['yellowD'])
    p.beam((L / 2 - 4.5, -1.0, 3.0), (L / 2 - 4.5, -1.0, 6.4), .22, Z['yellowD'], sides=4)
    p.beam((L / 2 - 4.5, -1.0, 6.4), (L / 2 - 1.0, -2.6, 7.2), .17, Z['yellow'], sides=4)
    p.beam((L / 2 - 1.0, -2.6, 7.2), (L / 2 - 0.6, -3.2, 4.2), .14, SL, sides=4)
    p.beam((L / 2 - 4.5, -1.0, 6.4), (L / 2 - 6.2, -.2, 4.6), .15, S, sides=3)
    hx = -L / 2 + 3.5
    p.cbox((hx, 1.5, 2.0), (4.0, 3.0, 2.6), Z['white'], ch=.2, tcolor=Z['greyD'])
    sq(p, 's', hx, 1.5, 4.0, 3.0, -1.4, 1.4, 3.0, 4.0, Z['glassD'])
    for x in (-8, -1, 6, 13.5):
        p.frustum((x, 3.1, 2.0), .35, .28, .8, 6, Z['red'], tcolor=Z['redD'], bottom=False)
    for x in (-12, 8):
        p.beam((x, -3.0, 2.0), (x, -3.0, 6.0), .1, S, sides=3)
        p.cbox((x - .35, -3.0 - .35, 6.0), (.7, .7, .5), Z['yellow'], ch=.1, tcolor=Z['yellowD'])
    for x in (-10, 0, 10):
        p.frustum((x, -3.7, 0.6), .35, .35, 1.2, 5, Z['black'], bottom=False)


def muelle_madera(p, k):
    Wd = (3.0, 3.8)[k]
    z = 1.4
    wood = Z['woodL'] if k == 0 else Z['plankL']
    p.grid((0, 0, 0), (16, Wd), 16, 1, wood, colorfn=lambda x, y: Z['plank'] if int(x + 8) % 2 == 0 else wood, z=z)
    for sy in (-1, 1):
        p.box((0, sy * Wd / 2, z - .45), (16, .3, .45), Z['woodD'], bottom=False, top=False)
    xs = [-7.5 + i * 3.0 for i in range(6)]
    for x in xs:
        for sy in (-1, 1):
            tall = (x in (xs[0], xs[-1]))
            p.box((x - .17, sy * (Wd / 2 - .05) - .17, -3.0), (.34, .34, 5.7 if tall else 4.4), Z['woodD'], bottom=False, tcolor=Z['wood'])
    for sy in (-1, 1):
        y = sy * (Wd / 2 - .05)
        pts = [(-7.5, y, 2.7), (-3.0, y, 2.1), (1.5, y, 2.1), (7.5, y, 2.7)]
        for a, b in zip(pts, pts[1:]):
            p.beam(a, b, .05, Z['cream'], sides=3)
    if k == 1:
        p.box((6.3, 0, z), (2.2, 2.0, 1.6), Z['woodL'], bottom=False, tcolor=Z['wood'])
        gable_x(p, 6.3, 0, 2.2, 2.0, z + 1.6, .9, Z['tinR'], Z['tinRL'], Z['woodL'], ov=.3, strips=2)
        sq(p, 's', 6.3, 0, 2.2, 2.0, -.5, .5, z + .3, z + 1.3, Z['glassD'])
    else:
        p.box((6.4, -.6, z), (1.2, 1.2, .55), Z['wood'], bottom=False, tcolor=Z['woodL'])
        cyl_x(p, (-6.4, .2, z + .4), .45, 1.2, 6, Z['rustL'], Z['rust'])


# ═════════════════════════════ BOATS ═════════════════════════════
def tanquero(p):
    BB.hull(p, 16.0, 4.6, 2.0, Z['black'], Z['red'], Z['redD'], Z['grey'], z0=-.6, bow_rise=.55, stern_w=.85, bow_pt=.1, ns=6, flat=.55)
    zd = 1.4
    p.beam((-1.4, 0, zd + .2), (6.4, 0, zd + .2), .22, Z['red'], sides=5)
    p.beam((-1.4, .7, zd + .2), (6.4, .7, zd + .2), .18, Z['steelL'], sides=5)
    for x in (1.2, 3.6):
        p.cbox((x, -1.2, zd), (1.2, .9, .4), Z['greyD'], ch=.1, tcolor=Z['grey'])
    p.cbox((6.8, 0, zd), (1.6, 1.6, .9), Z['yellow'], ch=.15, tcolor=Z['yellowD'])
    p.cbox((-5.2, 0, zd), (5.4, 3.6, 2.3), Z['white'], ch=.2, tcolor=Z['greyLL'])
    p.cbox((-5.0, 0, zd + 2.3), (4.4, 3.2, 1.9), Z['white'], ch=.2, tcolor=Z['greyLL'])
    p.cbox((-4.8, 0, zd + 4.2), (3.4, 3.4, 1.5), Z['yellow'], ch=.2, tcolor=Z['yellowD'])
    for lv, z0, z1, wd in ((0, zd + .6, zd + 1.7, 5.4), (1, zd + 2.9, zd + 3.9, 4.4)):
        dd = 3.6 - lv * .4
        bx = -5.2 + lv * .2
        sq(p, 'e', bx, 0, wd, dd, -1.3, 1.3, z0, z1, Z['glassD'], off=.04)
        sq(p, 's', bx, 0, wd, dd, -1.8, 1.8, z0, z1, Z['glassD'], off=.04)
    sq(p, 'e', -4.8, 0, 3.4, 3.4, -1.3, 1.3, zd + 4.55, zd + 5.4, Z['glassD'], off=.04)
    sq(p, 's', -4.8, 0, 3.4, 3.4, -1.3, 1.3, zd + 4.55, zd + 5.4, Z['glassD'], off=.04)
    p.frustum((-6.3, 0, zd + 5.7), .9, .75, 1.5, 6, Z['black'], bottom=False, top=False)
    p.frustum((-6.3, 0, zd + 6.7), .85, .8, .5, 6, Z['red'], tcolor=Z['black'], bottom=False, top=True)
    p.beam((-4.4, 0, zd + 5.7), (-4.4, 0, zd + 8.0), .06, Z['steel'], sides=3)
    p.beam((-5.0, 0, zd + 7.2), (-3.8, 0, zd + 7.2), .05, Z['steel'], sides=3)
    for sy in (-1, 1):
        p.beam((-2.6, sy * 2.0, zd + .6), (7.2, sy * 1.55, zd + .6), .04, Z['steelL'], sides=3)
    p.beam((7.6, 0, zd + 1.0), (7.6, 0, zd + 2.6), .05, Z['steel'], sides=3)


def lancha(p, k):
    cA, cB = (Z['red'], Z['white']) if k == 0 else (Z['red'], Z['cream'])
    BB.hull(p, 9.0, 2.7, 1.5, cA, cB, Z['blueGD'], Z['woodL'], z0=-.45, bow_rise=.5, stern_w=.85, bow_pt=.1, ns=5, flat=.5)
    zd = 1.05
    if k == 0:
        cab = [[(.2, -.95, zd), (2.4, -.9, zd), (2.4, .9, zd), (.2, .95, zd)], [(.45, -.8, zd + 1.7), (2.1, -.75, zd + 1.7), (2.1, .75, zd + 1.7), (.45, .8, zd + 1.7)]]
        p.loft(cab, Z['white'], caps=(False, True), ref=V((1.3, 0, zd + .8)))
        p.face([(2.43, -.7, zd + .6), (2.43, .7, zd + .6), (2.15, .65, zd + 1.45), (2.15, -.65, zd + 1.45)], Z['glass'], flip_ref=V((0, 0, zd + 1)))
        for sy in (-1, 1):
            p.face([(.8, sy * .93, zd + .6), (1.9, sy * .9, zd + .6), (1.9, sy * .85, zd + 1.4), (.8, sy * .85, zd + 1.4)], Z['glassD'], flip_ref=V((1.3, 0, zd + 1)))
        p.box((1.3, -1.1, zd + 1.7), (2.8, 2.2, .15), Z['red'], bottom=False) if False else p.box((1.3, 0, zd + 1.7), (2.8, 2.2, .15), Z['red'], bottom=False)
        p.beam((1.0, 0, zd + 1.85), (1.0, 0, zd + 3.4), .05, Z['steel'], sides=3)
        p.box((-3.9, 0, zd - .2), (.9, .8, .8), Z['steel'], bottom=False)
        p.box((-4.15, 0, -.2), (.28, .28, 1.2), Z['steel'], bottom=False, top=False)
    else:
        cab = [[(-2.2, -.9, zd), (-.2, -.9, zd), (-.2, .9, zd), (-2.2, .9, zd)], [(-2.0, -.75, zd + 1.5), (-.4, -.75, zd + 1.5), (-.4, .75, zd + 1.5), (-2.0, .75, zd + 1.5)]]
        p.loft(cab, Z['cream'], caps=(False, True), ref=V((-1.2, 0, zd + .7)))
        p.face([(-.18, -.6, zd + .5), (-.18, .6, zd + .5), (-.4, .55, zd + 1.3), (-.4, -.55, zd + 1.3)], Z['glass'], flip_ref=V((-3, 0, zd + 1)))
        p.box((-1.2, 0, zd + 1.5), (2.6, 2.2, .15), Z['red'], bottom=False)
        for sy in (-1, 1):
            p.beam((-2.4, sy, zd + .1), (-2.4, sy, zd + 1.5), .05, Z['white'], sides=3)
            p.beam((-.3, sy, zd + .1), (-.3, sy, zd + 1.5), .05, Z['white'], sides=3)
        p.ico((2.4, 0, zd + .3), .85, 0xd98a3a, sub=0, sc=(1.4, 1, .6), seed=2)
        p.box((-4.1, 0, zd - .1), (.8, .8, .9), Z['steel'], bottom=False)
        p.beam((2.8, 0, zd), (2.8, 0, zd + 2.4), .05, Z['white'], sides=3)
        p.face([(2.8, 0, zd + 2.4), (3.6, 0, zd + 2.2), (2.8, 0, zd + 2.0)], Z['yellow'], flip_ref=V((2.8, 5, zd + 2.2)))


def penero(p):
    BB.hull(p, 11.0, 2.4, 1.3, Z['yellow'], Z['blue'], Z['navy'], 0xe3c47e, z0=-.4, bow_rise=1.1, stern_w=.85, bow_pt=.1, ns=6, flat=.45)
    for x in (-2.6, -.2, 2.2):
        p.box((x, 0, .55), (.4, 2.0, .16), Z['woodL'], bottom=False)
    p.box((-5.0, 0, .6), (1.0, .8, .8), Z['steel'], bottom=False)
    p.box((-5.3, 0, -.3), (.3, .3, 1.3), Z['steel'], bottom=False, top=False)
    p.beam((-4.7, 0, 1.2), (-5.9, 0, 1.4), .05, Z['steelL'], sides=3)
    p.box((3.6, 0, .55), (1.6, 1.0, .12), Z['woodL'], bottom=False)
    p.box((.9, .3, .65), (.9, .7, .4), Z['red'], bottom=False)
    p.beam((4.0, -.7, .75), (4.8, -.7, 1.2), .04, Z['cream'], sides=3)
    p.beam((-1.5, .8, .65), (1.5, 1.5, .9), .05, Z['woodD'], sides=3)


# ═════════════════════════════ HOUSES ═════════════════════════════
def casa(p, w=9.0, d=8.0, nfl=2, wall=Z['Y'], trim=Z['wh'], shut=Z['green'], roof='flat', tile=Z['tile'], arcade=False,
         balc=(1,), awn=None, tank=False, fh0=3.5, fh=3.2, rh=1.9, glassc=Z['glassD'], door=Z['door'], pedi=False):
    z0 = -.4
    Ht = fh0 + fh * (nfl - 1)
    B = (0, 0, w, d)
    p.box((0, 0, z0), (w, d, Ht - z0), wall, bottom=False, tcolor=wall)
    p.box((0, 0, z0), (w + .3, d + .3, 1.2 - z0), Z['stone'], bottom=False, tcolor=Z['stoneL'])
    nb = 3
    bw = (w - 1.0) / nb
    cu = [-w / 2 + .5 + bw * (i + .5) for i in range(nb)]
    if arcade:
        aw = bw - 1.3
        for i, u in enumerate(cu):
            wq(p, B, 's', u - aw / 2 - .22, u + aw / 2 + .22, 1.25, fh0 - 1.25, trim, off=.04, arch=.85)
            wq(p, B, 's', u - aw / 2, u + aw / 2, 1.25, fh0 - 1.25, Z['dark'], off=.07, arch=.65)
        for u in (-w / 2 + .3, cu[0] + bw / 2, cu[1] + bw / 2, w / 2 - .3):
            wq(p, B, 's', u - .22, u + .22, 1.25, fh0 - .4, trim, off=.09)
    else:
        for i, u in enumerate(cu):
            if i == 1:
                wq(p, B, 's', u - .7, u + .7, 1.2, 2.9, trim, off=.04, arch=.35)
                wq(p, B, 's', u - .55, u + .55, 1.2, 2.8, door, off=.07, arch=.25)
            else:
                wq(p, B, 's', u - 1.0, u + 1.0, 1.5, 2.9, shut, off=.04)
                wq(p, B, 's', u - .62, u + .62, 1.7, 2.8, glassc, off=.07)
            if awn and i != 1:
                aa = awn[i % len(awn)]
                p.face([(u - bw / 2 + .3, -d / 2, 3.2), (u + bw / 2 - .3, -d / 2, 3.2), (u + bw / 2 - .3, -d / 2 - 1.0, 2.8), (u - bw / 2 + .3, -d / 2 - 1.0, 2.8)], aa, flip_ref=V((0, 0, 3)))
    band(p, 0, 0, w, d, fh0 - .5, .3, trim, ov=.18)
    for k in range(1, nfl):
        zf = fh0 + (k - 1) * fh
        bal = k in balc
        for i, u in enumerate(cu):
            if bal and i == 1:
                wq(p, B, 's', u - .8, u + .8, zf + .1, zf + 2.7, shut, off=.04, arch=.3)
                wq(p, B, 's', u - .5, u + .5, zf + .15, zf + 2.6, glassc, off=.07, arch=.2)
            else:
                wq(p, B, 's', u - .9, u + .9, zf + .7, zf + 2.6, shut, off=.04)
                wq(p, B, 's', u - .55, u + .55, zf + .85, zf + 2.45, glassc, off=.07)
        if bal:
            p.box((0, -d / 2 - .55, zf - .25), (w - 1.2, 1.1, .3), trim, bottom=False)
            wq(p, (0, -.55, w - 1.2, d), 's', -(w - 1.2) / 2 + .1, (w - 1.2) / 2 - .1, zf + .05, zf + .95, shut, off=.57)
        if k < nfl - 1:
            band(p, 0, 0, w, d, zf + fh - .5, .3, trim, ov=.18)
        for sd in 'ew':
            wq(p, B, sd, -d * .22 - .45, -d * .22 + .45, zf + .9, zf + 2.4, glassc, off=.04)
            wq(p, B, sd, d * .22 - .45, d * .22 + .45, zf + .9, zf + 2.4, glassc, off=.04)
    for sd in 'ew':
        wq(p, B, sd, -d * .22 - .45, -d * .22 + .45, 1.5, 2.8, glassc, off=.04)
        wq(p, B, sd, d * .22 - .45, d * .22 + .45, 1.5, 2.8, glassc, off=.04)
    for sx in (-1, 1):
        p.box((sx * (w / 2 - .05), -d / 2 + .05, z0), (.45, .45, Ht - z0), trim, bottom=False, top=False)
    if roof == 'hip':
        band(p, 0, 0, w, d, Ht - .3, .3, trim, ov=.2)
        hip(p, 0, 0, w, d, Ht, rh, tile, Z['tileL'], ov=.55, topc=Z['tileD'], bands=2)
    elif roof == 'gable':
        band(p, 0, 0, w, d, Ht - .3, .3, trim, ov=.2)
        gable_x(p, 0, 0, w, d, Ht, rh, tile, Z['tileL'], wall, ov=.5, strips=3)
    else:
        parapet(p, 0, 0, w, d, Ht, .5, .3, trim, wall, 0xfff2d0)
        if tank:
            p.frustum((w * .2, d * .1, Ht + .1), .9, .8, 1.4, 6, Z['blueGD'], tcolor=Z['blueGL'], bottom=False)
            p.box((-w * .3, d * .1, Ht + .1), (1.6, 1.6, 1.5), wall, bottom=False, tcolor=trim)
    if pedi:
        zt = Ht - .3
        p.face([(-w * .22, -d / 2 - .22, zt), (w * .22, -d / 2 - .22, zt), (0, -d / 2 - .22, zt + 1.7)], trim, flip_ref=V((0, 0, zt)))
    return Ht


def casa_baja(p, wall, trim, shut, tile, roof='hip', w=8.6, d=7.4, porch=True):
    z0 = -.4
    H = 3.4
    B = (0, 0, w, d)
    p.box((0, 0, z0), (w, d, H - z0), wall, bottom=False, tcolor=wall)
    p.box((0, 0, z0), (w + .25, d + .25, 1.0 - z0), Z['stone'], bottom=False, tcolor=Z['stoneL'])
    for u in (-2.8, 2.8):
        wq(p, B, 's', u - 1.0, u + 1.0, 1.4, 2.9, shut, off=.04)
        wq(p, B, 's', u - .6, u + .6, 1.6, 2.8, Z['glassD'], off=.07)
    wq(p, B, 's', -.7, .7, 1.0, 2.8, trim, off=.04, arch=.4)
    wq(p, B, 's', -.55, .55, 1.0, 2.7, Z['door'], off=.07, arch=.3)
    for sd in 'ew':
        wq(p, B, sd, -1.8, -.6, 1.6, 2.8, Z['glassD'], off=.04)
        wq(p, B, sd, 1.0, 2.2, 1.6, 2.8, Z['glassD'], off=.04)
    band(p, 0, 0, w, d, H - .3, .3, trim, ov=.15)
    for sx in (-1, 1):
        p.box((sx * (w / 2 - .05), -d / 2 + .05, z0), (.4, .4, H - z0), trim, bottom=False, top=False)
    if porch:
        p.box((0, -d / 2 - .9, 0), (w - .6, 1.6, .25), Z['stoneL'], bottom=False)
        for sx in (-1, 1):
            p.box((sx * (w / 2 - .5), -d / 2 - 1.55, .25), (.24, .24, 2.4), trim, bottom=False)
        p.box((0, -d / 2 - .95, 2.65), (w - .3, 1.7, .22), trim, bottom=False, tcolor=Z['tileD'])
    if roof == 'hip':
        hip(p, 0, 0, w, d, H, 2.0, tile, Z['tileL'], ov=.5, topc=Z['tileD'], bands=2)
    else:
        gable_x(p, 0, 0, w, d, H, 2.0, tile, Z['tileL'], wall, ov=.5, strips=3)
    p.box((w * .25, d * .1, H + .6), (.8, .8, 1.5), Z['stoneL'], bottom=False)


def iglesia(p):
    WH, WT = Z['wh'], Z['cream']
    z0 = -.4
    nx, nw, nd, nyc = 2.3, 9.4, 13.0, 1.5
    NB = (nx, nyc, nw, nd)
    NH = 9.2
    p.box((nx, nyc, z0), (nw, nd, NH - z0), WH, bottom=False, tcolor=WH)
    p.box((nx, nyc, z0), (nw + .3, nd + .3, 1.2 - z0), Z['stone'], bottom=False, tcolor=Z['stoneL'])
    band(p, nx, nyc, nw, nd, NH - .45, .45, WT, ov=.2)
    p.box((nx, -6.4, z0), (6.0, 2.0, .5 - z0), Z['stoneL'], bottom=False)
    p.box((nx, -5.9, z0), (4.4, 1.0, .9 - z0), Z['stoneL'], bottom=False)
    wq(p, NB, 's', -1.3, 1.3, 0, 4.2, WT, off=.05, arch=1.3)
    wq(p, NB, 's', -1.0, 1.0, 0, 4.0, Z['door'], off=.08, arch=1.0)
    for sx in (-1, 1):
        wq(p, NB, 's', sx * 3.1 - .6, sx * 3.1 + .6, 2.6, 5.2, WT, off=.04, arch=.5)
        wq(p, NB, 's', sx * 3.1 - .42, sx * 3.1 + .42, 2.8, 5.1, Z['glassD'], off=.07, arch=.4)
    p.face([(nx + cos(2 * PI * i / 8) * 1.0, nyc - nd / 2 - .08, 7.1 + sin(2 * PI * i / 8) * 1.0) for i in range(8)], Z['glass'], flip_ref=V((nx, nyc, 7)))
    py = nyc - nd / 2 - .22
    p.face([(nx - nw / 2 - .1, py, NH), (nx + nw / 2 + .1, py, NH), (nx, py, NH + 3.0)], WT, flip_ref=V((nx, nyc, NH)))
    p.face([(nx - nw / 2 + .6, py - .05, NH + .3), (nx + nw / 2 - .6, py - .05, NH + .3), (nx, py - .05, NH + 2.5)], WH, flip_ref=V((nx, nyc, NH)))
    cross(p, nx, py - .1, NH + 2.8, 1.5)
    for u in (-4.0, -1.4, 1.2, 3.8):
        wq(p, NB, 'e', u - .55, u + .55, 2.6, 5.4, WT, off=.04, arch=.55)
        wq(p, NB, 'e', u - .38, u + .38, 2.8, 5.3, Z['glassD'], off=.07, arch=.4)
    for u in (-5.3, -2.7, 0, 2.5, 5.1):
        wq(p, NB, 'e', u - .22, u + .22, 0, NH - .3, WT, off=.12)
    gable_y(p, nx, nyc, nw, nd, NH, 3.3, Z['tile'], Z['tileL'], WH, ov=.45, strips=3, front=False)
    cx0, cy0 = nx, nyc + 1.5
    p.frustum((cx0, cy0, NH + 2.7), 1.5, 1.4, 1.1, 8, WH, rz=.39, top=False, bottom=False, ring_colors=[WH, WT])
    dome(p, (cx0, cy0, NH + 3.8), 1.65, 1.6, 8, 2, Z['R'], Z['tileD'], rz=.39, ref_dz=-2)
    cross(p, cx0, cy0, NH + 5.3, 1.1)
    tx, ty, tw = -4.7, -2.7, 4.6
    TB = (tx, ty, tw, tw)
    sh = 14.4
    p.box((tx, ty, z0), (tw, tw, sh - z0), WH, bottom=False, tcolor=WH)
    p.box((tx, ty, z0), (tw + .3, tw + .3, 1.2 - z0), Z['stone'], bottom=False, tcolor=Z['stoneL'])
    wq(p, TB, 's', -.8, .8, 1.2, 3.8, WT, off=.05, arch=.8)
    wq(p, TB, 's', -.6, .6, 1.2, 3.7, Z['door'], off=.08, arch=.6)
    for z in (6.0, 10.0):
        band(p, tx, ty, tw, tw, z, .4, WT, ov=.18)
    for sd in 'sw':
        wq(p, TB, sd, -.5, .5, 7.0, 9.0, WT, off=.04, arch=.5)
        wq(p, TB, sd, -.35, .35, 7.2, 8.9, Z['glassD'], off=.07, arch=.35)
    p.face([(tx + cos(2 * PI * i / 8) * .75, ty - tw / 2 - .1, 11.9 + sin(2 * PI * i / 8) * .75) for i in range(8)], Z['cream'], flip_ref=V((tx, ty, 12)))
    p.face([(tx + cos(2 * PI * i / 8) * .6, ty - tw / 2 - .13, 11.9 + sin(2 * PI * i / 8) * .6) for i in range(8)], WH, flip_ref=V((tx, ty, 12)))
    band(p, tx, ty, tw, tw, sh - .6, .6, WT, ov=.25)
    bz = sh
    bw_ = 3.6
    BF = (tx, ty, bw_, bw_)
    p.box((tx, ty, bz), (bw_, bw_, 3.8), WT, bottom=False, top=False)
    for sd in 'sewn':
        wq(p, BF, sd, -.85, .85, bz + .5, bz + 2.5, Z['dark'], off=.05, arch=.85)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((tx + sx * (bw_ / 2 - .05), ty + sy * (bw_ / 2 - .05), bz), (.44, .44, 3.8), WH, bottom=False, top=False)
    p.ico((tx, ty, bz + 1.6), .45, Z['goldD'], sub=0, seed=3)
    band(p, tx, ty, bw_, bw_, bz + 3.8, .5, WH, ov=.25)
    dz = bz + 4.3
    p.frustum((tx, ty, dz), 1.9, 1.7, 1.0, 8, WT, rz=.39, top=False, bottom=False)
    dome(p, (tx, ty, dz + 1.0), 2.2, 3.0, 8, 3, Z['R'], Z['redD'], rz=.39, ref_dz=-3)
    p.beam((tx, ty, dz + 4.0), (tx, ty, dz + 4.9), .12, Z['goldD'], sides=3)
    cross(p, tx, ty, dz + 4.5, 2.0)


def palafito(p, k):
    wood = (0x6fa8b8, 0xd08a4a)[k]
    woodL_ = (0x8fc4d0, 0xe4a566)[k]
    roof1, roof2 = ((Z['tin'], Z['tinD']), (Z['tinR'], Z['tinRL']))[k]
    W, D = 6.2, 4.6
    zf = 1.2
    for x in (-W / 2 + .4, 0, W / 2 - .4):
        for y in (-D / 2 + .4, D / 2 - .4):
            p.box((x, y, -3.0), (.34, .34, zf + 3.0), Z['woodD'], bottom=False, tcolor=Z['wood'])
    for sy in (-1, 1):
        p.beam((-W / 2 + .4, sy * (D / 2 - .4), -2.2), (0, sy * (D / 2 - .4), -.2), .06, Z['wood'], sides=3)
        p.beam((W / 2 - .4, sy * (D / 2 - .4), -2.2), (0, sy * (D / 2 - .4), -.2), .06, Z['wood'], sides=3)
    p.grid((0, 0, 0), (W + .8, D + 1.0), 6, 1, Z['plank'], colorfn=lambda x, y: Z['plank'] if int(x + 4) % 2 == 0 else Z['plankL'], z=zf)
    p.box((0, 0, zf - .35), (W + .8, D + 1.0, .35), Z['woodD'], bottom=False, top=False)
    hw, hd, hh = 4.4, 3.4, 2.7
    hx = 0.4 if k == 0 else -.4
    B = (hx, .2, hw, hd)
    p.box((hx, .2, zf), (hw, hd, hh), wood, bottom=False, tcolor=wood)
    for i in range(6):
        if i % 2 == 0:
            u = -hw / 2 + .37 + i * hw / 6
            wq(p, B, 's', u - .22, u + .22, zf + .05, zf + hh - .05, woodL_, off=.03)
    sg = -1 if k else 1
    wq(p, B, 's', -.4 - sg, .4 - sg, zf, zf + 1.9, Z['door'], off=.05)
    wq(p, B, 's', sg - .55, sg + .55, zf + .8, zf + 1.9, Z['glassD'], off=.05)
    for sd in 'ew':
        wq(p, B, sd, -.5, .5, zf + .8, zf + 1.9, Z['glassD'], off=.04)
    gable_x(p, hx, .2, hw, hd, zf + hh, 1.4, roof1, roof2, wood, ov=.5, strips=3)
    zr = zf + .9
    p.beam((-W / 2 - .3, -D / 2 - .4, zr), (W / 2 + .3, -D / 2 - .4, zr), .05, Z['woodL'], sides=3)
    for x in (-W / 2 - .3, 0, W / 2 + .3):
        p.beam((x, -D / 2 - .4, zf), (x, -D / 2 - .4, zr), .07, Z['woodL'], sides=3)
    if k == 1:
        p.frustum((-2.2, 1.6, zf), .5, .45, 1.0, 6, Z['blueGD'], tcolor=Z['blueGL'], bottom=False)
    wl = 6.0
    x0 = W / 2 + .4
    p.grid((x0 + wl / 2, -D / 4, 0), (wl, 1.2), 6, 1, Z['plank'], colorfn=lambda x, y: Z['plank'] if int(x + 3) % 2 == 0 else Z['plankL'], z=zf)
    for x in (x0 + 1.0, x0 + 3.0, x0 + 5.0):
        for sy in (-.55, .55):
            p.box((x, -D / 4 + sy, -3.0), (.24, .24, zf + 3.0 + .8), Z['woodD'], bottom=False, tcolor=Z['wood'])
    p.beam((x0, -D / 4 + .55, zf + .8), (x0 + wl, -D / 4 + .55, zf + .8), .04, Z['woodL'], sides=3)
    p.beam((x0, -D / 4 - .55, zf + .8), (x0 + wl, -D / 4 - .55, zf + .8), .04, Z['woodL'], sides=3)


# ═════════════════════════════ SMALL PROPS ═════════════════════════════
def farola(p):
    S = Z['steel']
    p.frustum((0, 0, -.2), .5, .4, .7, 6, Z['concD'], tcolor=Z['conc'], bottom=False)
    p.frustum((0, 0, .5), .3, .17, 6.0, 6, Z['steelM'], tcolor=S, bottom=False, top=False)
    p.beam((0, 0, 6.4), (.9, 0, 7.0), .1, S, sides=4)
    p.beam((.9, 0, 7.0), (1.7, 0, 7.0), .1, S, sides=4)
    p.frustum((1.7, 0, 6.7), .45, .3, .25, 6, S, tcolor=Z['steelL'], bottom=False, top=False)
    p.frustum((1.7, 0, 6.8), .5, .3, .35, 6, Z['yellow'], tcolor=Z['yellow'], bottom=True)
    p.frustum((1.7, 0, 7.1), .62, .5, .25, 6, S, tcolor=Z['steelL'], bottom=False)
    p.box((-.2, -.5, 2.6), (.4, .2, .4), Z['greyL'], bottom=False)


def cartel(p):
    S = Z['steel']
    for sx in (-1, 1):
        p.frustum((sx * 3.3, 0, -.2), .28, .22, 5.6, 4, Z['steelM'], rz=PI / 4, tcolor=S, bottom=False)
    p.cbox((0, -.2, 3.0), (7.6, .5, 2.6), Z['yellow'], ch=.12, tcolor=Z['yellowD'])
    p.box((0, -.5, 3.3), (6.6, .1, .55), Z['black'], bottom=False)
    for x in (-2.8, -1.2, 0.4, 2.0):
        p.box((x, -.55, 4.1), (1.2, .1, .6), Z['red'], bottom=False)
    p.face([(2.6, -.52, 3.5), (3.0, -.52, 3.5), (3.2, -.52, 4.2), (2.8, -.52, 4.8), (2.4, -.52, 4.2)], Z['steel'], flip_ref=V((2.8, 3, 4)))
    p.beam((-2.4, -.3, 5.6), (-2.4, -1.0, 6.0), .06, S, sides=3)
    p.beam((2.4, -.3, 5.6), (2.4, -1.0, 6.0), .06, S, sides=3)
    p.frustum((-2.4, -1.0, 6.0), .35, .25, .3, 5, Z['white'], bottom=False)
    p.frustum((2.4, -1.0, 6.0), .35, .25, .3, 5, Z['white'], bottom=False)


def barril_set(p):
    cols = (Z['blue'], Z['red'], Z['black'])
    pos = [(-.95, 0, 0, cols[0]), (.95, 0, 0, cols[1]), (0, .1, 1.95, cols[2])]
    for x, y, z, c in pos:
        p.frustum((x, y, z), .85, .92, .7, 8, c, tcolor=c, bottom=False, top=False)
        p.frustum((x, y, z + .7), .92, .92, .55, 8, Z['steelL'], bottom=False, top=False)
        p.frustum((x, y, z + 1.25), .92, .85, .7, 8, c, tcolor=Z['greyL'], bottom=False)


def camion(p):
    S = Z['steel']
    p.box((0, 0, .9), (9.8, 2.0, .5), S, bottom=False)
    p.cbox((3.0, 0, .9), (2.4, 2.5, 1.5), Z['red'], ch=.2, tcolor=Z['redD'])
    p.cbox((3.1, 0, 2.4), (2.0, 2.4, 1.5), Z['red'], ch=.25, tcolor=Z['redD'])
    p.face([(4.15, -1.0, 2.5), (4.15, 1.0, 2.5), (4.05, .95, 3.65), (4.05, -.95, 3.65)], Z['glass'], flip_ref=V((0, 0, 3)))
    for sy in (-1, 1):
        p.face([(2.4, sy * 1.23, 2.6), (3.8, sy * 1.23, 2.6), (3.8, sy * 1.2, 3.5), (2.4, sy * 1.2, 3.5)], Z['glassD'], flip_ref=V((3, 0, 3)))
    p.box((4.0, 0, .9), (.5, 2.2, .55), Z['steelL'], bottom=False)
    cyl_x(p, (-1.4, 0, 2.55), 1.35, 7.4, 10, Z['greyL'], Z['white'])
    p.frustum((-1.4, 0, 3.8), .5, .4, .35, 6, Z['greyD'], tcolor=Z['grey'], bottom=False)
    cyl_x(p, (-1.4, 0, 2.55), 1.4, 1.0, 10, Z['red'], Z['redD'], caps=False)
    p.beam((-5.2, 1.0, 1.3), (-5.2, 1.0, 2.0), .06, S, sides=3)
    for x, wd in ((3.2, .5), (-2.4, 1.0), (-4.0, 1.0)):
        for sy in (-1, 1):
            cyl_y(p, (x, sy * (1.0 + wd / 2 - .1), .95), .95, wd, 6, Z['black'], Z['steelM'], caps=(sy == -1, sy == 1))


def chorro(p):
    S, SL = Z['steel'], Z['steelL']
    p.cbox((0, 0, -.2), (3.0, 3.0, .5), Z['conc'], ch=.1, tcolor=Z['concL'])
    p.beam((0, 0, .3), (0, 0, 2.6), .3, SL, sides=6)
    p.frustum((0, 0, .3), .6, .6, .3, 6, S, tcolor=SL, bottom=False)
    p.frustum((0, 0, 1.4), .6, .6, .2, 6, Z['yellow'], bottom=False)
    valve_wheel(p, (.0, -.4, 1.0), .38, Z['red'])
    p.frustum((0, 0, 2.6), .5, .2, .5, 6, S, bottom=False)
    rings = []
    for (r, z, ox) in ((.55, 3.0, 0), (.8, 3.9, .1), (.5, 5.0, .3), (.06, 6.0, .5)):
        rings.append([(ox + r * cos(2 * PI * i / 5), r * sin(2 * PI * i / 5), z) for i in range(5)])
    p.loft(rings, Z['flame'], colors=[Z['flame'], Z['flameY']], caps=(True, True), ref=V((.2, 0, 4.2)))
    p.frustum((.1, 0, 3.0), .3, .0, 2.2, 5, Z['flameY'], bottom=False)


# ═════════════════════════════ LAKE BRIDGE ═════════════════════════════
def puente_deck(p):
    z = 10.0
    C = Z
    ring = lambda x: [(x, -3.5, z), (x, 3.5, z), (x, 3.5, z - 1.0), (x, 2.2, z - 1.7), (x, -2.2, z - 1.7), (x, -3.5, z - 1.0)]
    p.loft([ring(-12), ring(12)], C['concL'], colors=[C['concL'], C['conc'], C['concD'], C['concD'], C['concD'], C['conc']], caps=(True, True))
    p.grid((0, 0, z + .02), (24, 5.4), 6, 2, 0x959ba8)
    for sy in (-1, 1):
        p.box((0, sy * 3.1, z), (24, .8, .8), C['conc'], bottom=False, tcolor=C['concL'])
    for x in (-9.6, -4.8, 0, 4.8, 9.6):
        p.face([(x - .8, -.12, z + .05), (x + .8, -.12, z + .05), (x + .8, .12, z + .05), (x - .8, .12, z + .05)], 0xf0eee4, up=True)
    for sy in (-1, 1):
        y = sy * 3.3
        for x in (-12, -6, 0, 6, 12):
            p.beam((x, y, z + .8), (x, y, z + 1.9), .08, C['steelL'], sides=3)
        p.beam((-12, y, z + 1.9), (12, y, z + 1.9), .08, C['steelL'], sides=3)
    for x in (-8, 0, 8):
        p.cbox((x, 0, -14), (1.8, 3.6, 22.4), C['conc'], ch=.25, tcolor=C['concD'])
        p.cbox((x, 0, 6.9), (3.0, 5.2, 1.4), C['concL'], ch=.3, tcolor=C['conc'])


def puente_recto(p):
    puente_deck(p)


def puente_torre(p):
    puente_deck(p)
    C = Z
    z = 10.0
    top = z + 34.0
    for sy in (-1, 1):
        p.cbox((0, sy * 3.6, z - .3), (2.2, 2.0, top - z + .3), C['concL'], ch=.3, tcolor=C['conc'])
    for zc, hh in ((z + 12.0, 1.8), (top - 3.0, 2.2)):
        p.cbox((0, 0, zc), (2.0, 5.2, hh), C['conc'], ch=.2, tcolor=C['concL'])
    for sy in (-1, 1):
        for sx in (-1, 1):
            for i in range(10):
                tz = top - 1.0 - i * 1.55
                dx = sx * (2.0 + i * 1.0)
                p.beam((sx * 1.1, sy * 3.4, tz), (dx, sy * 3.3, z + .8), .07, C['white'], sides=3)


# ═════════════════════════════ BUILD ═════════════════════════════
BUDGET = {}


def build(L):
    P = {}

    def mk(name, fn, budget, fixed=False):
        p = L.Part(name, ao=0.0)
        _f = p.face
        lh = V((-.5, -.6, 0)).normalized()

        def lit_face(pts, color, *aa, **k):
            c = int(color)
            f = _f(pts, c, *aa, **k)
            if f is None:
                return f
            f.normal_update()
            n = f.normal
            if c in (0x959ba8, 0xfff2d0):
                f[p.fsh] = .93
                return f
            if fixed and abs(n.z) < .35:
                f[p.fsh] = max(.62, min(1.0, .82 + .28 * (n.x * lh.x + n.y * lh.y)))
                return f
            r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
            f[p.fcol] = (min(255, int(r * LIFT)) << 16) | (min(255, int(g * LIFT)) << 8) | min(255, int(b * LIFT))
            return f
        p.face = lit_face
        fn(p)
        P[name] = p
        BUDGET[name] = budget
        return p

    mk('torre_petroleo_a', derrick, 500)
    mk('torre_petroleo_b', lambda p: derrick(p, H=28.0, B=7.0, panels=3, xpan=2, plat=(.5,), top_r=.85), 500)
    mk('torre_petroleo_c', lambda p: derrick(p, H=40.0, B=8.0, panels=5, xpan=0, plat=(.5,), top_r=.9), 500)
    mk('balancin_a', lambda p: balancin(p, Z['yellow'], Z['yellow'], Z['conc'], Z['redD']), 300)
    mk('balancin_b', lambda p: balancin(p, Z['blueG'], Z['blueGL'], Z['conc'], Z['navy']), 300)
    mk('cabezal_pozo', cabezal_pozo, 200)
    mk('antorcha', antorcha, 200)
    mk('tanque_crudo_a', tanque_a, 200)
    mk('tanque_crudo_b', tanque_b, 200)
    mk('tanque_esfera', tanque_esfera, 200)
    for k, c in enumerate('abc'):
        mk('caseta_gris_' + c, lambda p, k=k: caseta(p, k), 200)
    mk('planta_destilacion', planta, 450)
    mk('tablero_electrico', tablero, 250)
    mk('tuberia_recta', tuberia_recta, 200)
    mk('tuberia_codo', tuberia_codo, 200)
    mk('tuberia_pared', tuberia_pared, 200)
    mk('farola_lago', farola, 200)
    mk('cartel_petroleo', cartel, 200)
    mk('barril_set', barril_set, 200)
    mk('chorro_gas', chorro, 200)
    mk('camion_cisterna', camion, 250)
    mk('muelle_petrolero', muelle_petrolero, 600)
    mk('muelle_madera_a', lambda p: muelle_madera(p, 0), 300)
    mk('muelle_madera_b', lambda p: muelle_madera(p, 1), 300)
    mk('tanquero_chico', tanquero, 350)
    mk('lancha_pesca_a', lambda p: lancha(p, 0), 350)
    mk('lancha_pesca_b', lambda p: lancha(p, 1), 350)
    mk('peñero', penero, 350)
    mk('palafito_lago_a', lambda p: palafito(p, 0), 300, True)
    mk('palafito_lago_b', lambda p: palafito(p, 1), 300, True)
    specs = [
        dict(w=9, d=8, nfl=2, wall=Z['Y'], trim=Z['wh'], shut=Z['green'], roof='flat', balc=(1,), tank=True),
        dict(w=9, d=8, nfl=2, wall=Z['R'], trim=Z['wh'], shut=Z['wh'], roof='hip', tile=Z['tile'], arcade=True, balc=(1,), fh0=3.8),
        dict(w=9.5, d=8, nfl=2, wall=Z['O'], trim=Z['wh'], shut=Z['teal'], roof='flat', awn=(0xf4efe4, 0xd9473b), balc=(), tank=True),
        dict(w=9, d=8, nfl=2, wall=Z['B'], trim=Z['wh'], shut=Z['navy'], roof='gable', tile=Z['tileD'], balc=(1,)),
        dict(w=9.5, d=8, nfl=2, wall=Z['T'], trim=Z['cream'], shut=Z['R'], roof='hip', tile=Z['tile'], arcade=True, balc=(), fh0=3.8),
        dict(w=9, d=8, nfl=2, wall=Z['P'], trim=Z['wh'], shut=Z['teal'], roof='flat', balc=(1,), pedi=True),
    ]
    for i, s in enumerate(specs):
        mk('casa_zulia_' + 'abcdef'[i], lambda p, s=s: casa(p, **s), 250, True)
    mk('casa_zulia_baja_a', lambda p: casa_baja(p, Z['Y'], Z['wh'], Z['teal'], Z['tile'], 'hip'), 250, True)
    mk('casa_zulia_baja_b', lambda p: casa_baja(p, Z['B'], Z['wh'], Z['R'], Z['tileD'], 'gable'), 250, True)
    mk('iglesia_zulia', iglesia, 700, True)
    mk('puente_lago_recto', puente_recto, 350)
    mk('puente_lago_torre', puente_torre, 600)

    rows = [
        ['torre_petroleo_a', 'torre_petroleo_b', 'torre_petroleo_c', 'balancin_a', 'balancin_b', 'cabezal_pozo', 'antorcha'],
        ['tanque_crudo_a', 'tanque_crudo_b', 'tanque_esfera', 'caseta_gris_a', 'caseta_gris_b', 'caseta_gris_c'],
        ['planta_destilacion', 'tablero_electrico', 'camion_cisterna'],
        ['tuberia_recta', 'tuberia_codo', 'tuberia_pared', 'farola_lago', 'cartel_petroleo', 'barril_set', 'chorro_gas'],
        ['muelle_petrolero', 'muelle_madera_a', 'muelle_madera_b'],
        ['tanquero_chico', 'lancha_pesca_a', 'lancha_pesca_b', 'peñero', 'palafito_lago_a', 'palafito_lago_b'],
        ['casa_zulia_' + c for c in 'abcdef'] + ['casa_zulia_baja_a', 'casa_zulia_baja_b'],
        ['iglesia_zulia', 'puente_lago_recto', 'puente_lago_torre'],
    ]
    ycur = 0.0
    out = []
    for names in rows:
        bbs = {}
        for n in names:
            vs = [v.co for v in P[n].bm.verts]
            bbs[n] = (min(v.x for v in vs), max(v.x for v in vs), min(v.y for v in vs), max(v.y for v in vs))
        depth = max(b[3] - b[2] for b in bbs.values())
        xc = 0.0
        for n in names:
            b = bbs[n]
            P[n].loc = (xc - b[0], -ycur - depth / 2 - (b[2] + b[3]) / 2, 0)
            xc += (b[1] - b[0]) + 6
            out.append(P[n])
        ycur += depth + 8
    return out


def write_manifest(info):
    import bpy
    rows = []
    over = []
    for nm, t in info['per_mesh'].items():
        o = bpy.data.objects[nm]
        xs = [v.co.x for v in o.data.vertices]
        ys = [v.co.y for v in o.data.vertices]
        zs = [v.co.z for v in o.data.vertices]
        bud = BUDGET.get(nm, 0)
        if t > bud:
            over.append(nm)
        rows.append((nm, t, bud, '%.1f x %.1f' % (max(xs) - min(xs), max(ys) - min(ys)), '%.1f' % max(zs), '%.1f' % min(zs)))
    path = os.path.join(lib.MODEL_DIR, 'zulia_kit_manifest.md')
    with open(path, 'w') as f:
        f.write('# zulia_kit manifest\n\nGLB: `assets/models/zulia_kit.glb` (build: `tools/blender/prop_zulia_kit.py`). Zulia / Lake Maracaibo kit. 1 unit = 1 map unit. '
                'Each node = one instanceable piece, origin = base centre, z=0 = ground (or water line for marine pieces), front faces -Y. Total tris: %d.\n\n'
                'Notes: boats have bow +X and keel below the z=0 waterline (draft ~0.5-0.9). `tuberia_recta` is exactly 6 long (x -3..3, flanged ends, chains end to end); '
                '`tuberia_codo` arrives from -X (end at x=-3) and leaves toward +Y (end at y=+3), pipe centre z=1.35; `tuberia_pared` is 12 long (x -6..6) with 4 pipes in two tiers. '
                '`muelle_petrolero` runs along X (x -16..16, deck top z=2, piles to z=-4, loading arm at +X end, hut at -X end). `muelle_madera_*` run along X (x -8..8, deck z=1.4, posts to z=-3). '
                '`palafito_lago_*`: house centred on the stilt deck (z=1.2), plank walkway extends toward +X; stilts down to z=-3. '
                '`iglesia_zulia`: bell tower front-left (x=-4.7), nave front toward -Y, cross on tower ~z 26. '
                'Bridge pieces follow ordaz_kit: run along X, x -12..12 (chain every 24), deck top z=10, deck 7 wide with kerbs, pillars on x=-8,0,8 down to z=-14; '
                '`puente_lago_torre` adds an H-shaped concrete pylon (legs at y=+-3.6, x=0) rising ~34 above the deck with 10 stay cables per side per plane (fans toward +X and -X).\n\n' % info['tris'])
        f.write('| Part | tris | budget | footprint (x by y) | height (z max) | z min |\n|---|---|---|---|---|---|\n')
        for r in rows:
            f.write('| %s | %d | %d | %s | %s | %s |\n' % r)
    print('OVER_BUDGET', over)
    for r in rows:
        print('PART %-22s tris=%4d bud=%4d  %s  h=%s zmin=%s' % r)


if __name__ == '__main__':
    info = lib.run(sys.modules[__name__])
    write_manifest(info)
