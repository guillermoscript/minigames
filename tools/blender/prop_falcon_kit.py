"""falcon_kit: instanceable prop kit for the Coro / Falcon desert + Caribbean rocky coast of LA FIESTA.
Colonial church and whitewashed houses with orange tile roofs, stone wall, cistern, beach bar, wind turbine, stone cross,
cardon / tuna / agave / dry scrub, cuji + round-crowned trees, coconut palms, sandstone rocks, rocky mounds, sea stacks
(foam ring at z=0, bottoms down to -3), sea rocks, burro / goats / flamingos / iguana / pelican, dune crests, dry trunk, cow skull.
Each Part = one instanceable piece, origin = base centre (z=0 ground; z=0 = water line for islets / sea rocks), front = -Y.
Fauna faces +X locally. Writes assets/models/falcon_kit_manifest.md as a side effect of build()."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
import prop_caribe_kit as K          # dome / cross helpers
import prop_flamingos as FL          # tube helper
from mathutils import Vector

NAME = 'falcon_kit'
GROUND = 0xe3d3a0
PREVIEW = dict(az=0, pitch=62, fit=0.97, size=3200)
AO_DIST = 10

V = Vector
PI = math.pi
cos, sin = math.cos, math.sin
LIFT = 1.10
INFO = {}

# ───────────────────────── palette ─────────────────────────
C = dict(
    wall=0xf8f2e2, wallD=0xe6dabc, trim=0xdccfa6, tile=0xd8683c, tileD=0xbd5232, tileL=0xea8450, ridge=0xa8432a,
    door=0x6e4a2a, glass=0x35506f, teal=0x3f8a94, blue=0x3a6ea8, wood=0x7a5230, woodL=0xa57a4a, woodD=0x5a3a20,
    adobe=0xe0b682, adobeD=0xc89a62, adobeL=0xeccb98, stone=0xa8a08a, stoneL=0xc8bfa4, stoneD=0x857d6a,
    cream=0xf4e2a2, yellow=0xebcf7a, yellowD=0xd6b45c, gold=0xe8b840, goldD=0xc08c24, plaza=0xe4d6b0, plazaD=0xcdbb8e,
    thatch=0xd8b25e, thatchD=0xb08c3e, thatchL=0xe8c878, white=0xf4f6fa, steel=0x30343c, steelL=0x8d96a4,
    sand=0xe8c474, sandL=0xf2d68e, sandD=0xcf9f58, sandDD=0xb98445, sandW=0xdcb468,
    cacL=0x62a455, cacD=0x2f6b3a, cacT=0x86bf62, tunaG=0x4f9a4c, tunaL=0x6fb55a, tunaD=0x3a7c40, red=0xd9384a, pink=0xe86a8c,
    agave=0x6aa088, agaveL=0x8cc0a0, agaveD=0x4a8068, olive=0x8c9a48, oliveL=0xaab45c, oliveD=0x6c7a38, khaki=0xb8a860, khakiL=0xd0c07a, khakiD=0x8a7c46,
    cuji=0x7f9040, cujiL=0xa0b050, cujiD=0x5e6e30,
    g1=0x3d8a3a, g2=0x2e7434, g3=0x58a448, g4=0x7ab852, palm=0x58a040, palmL=0x7cc050, palmD=0x3e8238,
    trunk=0x8a6a45, trunkD=0x6a4e30, trunkL=0xa88a62, dead=0xa49a84, deadL=0xc4baa0, deadD=0x7c735e,
    rO=0xc8804a, rOL=0xdc9a5c, rOD=0xa8643a, tan=0xd9b27a, tanL=0xe8c690, tanD=0xb8905a, pb=0x8a5a4a, pbD=0x6e4638, pbL=0xa06c56,
    foam=0xf6fcff, foamB=0xcfe8f8, wet=0x7a5240,
    donk=0xa0907c, donkD=0x6e6050, donkL=0xd8ccb8, goatA=0xc9a878, goatB=0x4a3a30, bone=0xf0e8d2, boneD=0xcfc6aa,
    pink_f=0xf08ca2, pinkL=0xf8bccb, pinkD=0xe0607c, blk=0x2a2024, ig=0x86a050, igD=0x5e7a3a, igL=0xa8c070,
    peli=0x8e8678, peliL=0xf2ecd8, peliB=0xe8b05a, shal=0x9fe0d6, shal2=0x7fd0d0,
)


def stats(p):
    xs = [v.co.x for v in p.bm.verts]
    ys = [v.co.y for v in p.bm.verts]
    zs = [v.co.z for v in p.bm.verts]
    tris = sum(len(f.verts) - 2 for f in p.bm.faces)
    return tris, max(xs) - min(xs), max(ys) - min(ys), max(zs), min(zs)


# ───────────────────────── generic helpers ─────────────────────────
def at(p, fn, loc=(0, 0, 0), rot=0.0, *a, **k):
    """Run a builder into p, then rotate (z) and move only the vertices it added."""
    n0 = len(p.bm.verts)
    fn(p, *a, **k)
    co, si = cos(rot), sin(rot)
    for v in list(p.bm.verts)[n0:]:
        x, y = v.co.x, v.co.y
        v.co.x = loc[0] + x * co - y * si
        v.co.y = loc[1] + x * si + y * co
        v.co.z += loc[2]


def ctube(p, pts, rads, n=6, cols=(0,), star=0.0, phase=0.0, cap_end=True, cap_start=False, topcol=None, tip=.55):
    """Tapered tube along a polyline. star>0 makes alternate ring vertices shrink (ribs). cols indexed by flank k."""
    pts = [V(q) for q in pts]
    m = len(pts)
    rings = []
    for j, c in enumerate(pts):
        t = (pts[min(j + 1, m - 1)] - pts[max(j - 1, 0)]).normalized()
        ref = V((0, 0, 1)) if abs(t.z) < .9 else V((1, 0, 0))
        u = t.cross(ref).normalized()
        v = u.cross(t).normalized()
        r = rads[j]
        ring = []
        for k in range(n):
            a = 2 * PI * k / n + phase
            rr = r * (1 - star) if (star and k % 2) else r
            ring.append(c + u * (rr * cos(a)) + v * (rr * sin(a)))
        rings.append(ring)
    for j in range(m - 1):
        ref = (pts[j] + pts[j + 1]) / 2
        for k in range(n):
            k2 = (k + 1) % n
            p.face([rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k]], cols[k % len(cols)], flip_ref=ref)
    tc = topcol if topcol is not None else cols[0]
    if cap_end:
        t = (pts[-1] - pts[-2]).normalized()
        apex = pts[-1] + t * (rads[-1] * tip)
        for k in range(n):
            p.face([rings[-1][k], rings[-1][(k + 1) % n], apex], tc, flip_ref=pts[-2])
    if cap_start:
        p.face(rings[0], cols[0], flip_ref=pts[1])
    return rings


def lobe(p, c, rx, ry, rz, n=8, seed=1, pal=None, jit=.12, rot=0.0):
    """Squat faceted foliage lobe (48 tris at n=8)."""
    pal = pal or (C['g2'], C['g1'], C['g3'], C['g4'])
    rng = random.Random(seed)
    cx, cy, cz = c
    lv = [(-.6, .6), (0.0, 1.0), (.62, .72)]
    rings = []
    for k, (zf, rf) in enumerate(lv):
        ring = []
        for i in range(n):
            a = 2 * PI * i / n + k * .3 + rot
            m = rf * (1 + rng.uniform(-jit, jit))
            ring.append((cx + rx * m * cos(a), cy + ry * m * sin(a), cz + rz * zf * (1 + rng.uniform(-jit, jit) * .5)))
        rings.append(ring)
    ref = V(c)
    lowc = [pal[0] if rng.random() < .7 else pal[1] for _ in range(n)]
    midc = [rng.choice(pal[:3]) for _ in range(n)]
    upc = [rng.choice(pal[1:]) for _ in range(n)]
    p.loft([rings[0], rings[1]], pal[0], colors=lowc, ref=ref)
    p.loft([rings[1], rings[2]], pal[1], colors=midc, ref=ref)
    top = (cx, cy, cz + rz * 1.0)
    bot = (cx, cy, cz - rz * .75)
    for i in range(n):
        j = (i + 1) % n
        p.face([rings[2][i], rings[2][j], top], upc[i], flip_ref=ref)
        p.face([rings[0][i], rings[0][j], bot], pal[0], flip_ref=ref)


def tuft(p, c, r, col, colt, seed=1, sz=.7):
    p.ico(c, r, col, sub=0, sc=(1, 1, sz), jitter=.18, seed=seed, tcolor=colt)


def cross(p, x, y, z, hh=1.8, col=None):
    col = col if col is not None else C['goldD']
    p.box((x - .12, y - .12, z), (.24, .24, hh), col, bottom=False)
    p.box((x - .5, y - .12, z + hh * .55), (1.0, .24, .24), col, bottom=False)


# ───────────────────────── cacti ─────────────────────────
def cardon(p, h, arms, r=1.0, ribs=5, lean=(0, 0), arm_n=6, fruit=True):
    """Columnar cactus. arms = [(height_fraction, angle, reach, rise, radius_scale)]."""
    n = ribs * 2
    cols = (C['cacL'], C['cacD'])
    pts = [(lean[0] * t * t, lean[1] * t * t, -.4 + (h + .4) * t) for t in (0, .38, .72, 1.0)]
    ctube(p, pts, (r * 1.08, r, r * .94, r * .72), n=n, cols=cols, star=.2, topcol=C['cacT'], tip=.5)
    for (tf, ang, reach, rise, rs) in arms:
        zb = -.4 + (h + .4) * tf
        cx0 = lean[0] * tf * tf
        cy0 = lean[1] * tf * tf
        d = (cos(ang), sin(ang))
        ar = r * .55 * rs
        a0 = (cx0 + d[0] * r * .35, cy0 + d[1] * r * .35, zb)
        a1 = (cx0 + d[0] * (reach * .75), cy0 + d[1] * (reach * .75), zb + .25)
        a2 = (cx0 + d[0] * reach, cy0 + d[1] * reach, zb + rise * .55)
        a3 = (cx0 + d[0] * (reach * 1.04), cy0 + d[1] * (reach * 1.04), zb + rise)
        ctube(p, [a0, a1, a2, a3], (ar * 1.1, ar, ar * .95, ar * .7), n=arm_n, cols=cols, star=.2, topcol=C['cacT'], tip=.5)
        if fruit:
            p.face([(a3[0] - .22, a3[1], a3[2] + ar * .3), (a3[0] + .22, a3[1], a3[2] + ar * .3), (a3[0], a3[1] - .1, a3[2] + ar * .3 + .5)], C['pink'], flip_ref=V(a3))


def cardon_a(p):
    cardon(p, 17.5, [(.50, .2, 3.2, 5.6, 1.0), (.38, PI + .4, 3.0, 4.2, .95), (.70, PI * .5 + .3, 2.6, 3.6, .8)], r=1.0, ribs=5)


def cardon_b(p):
    cardon(p, 14.0, [(.46, PI - .3, 2.8, 4.8, 1.0), (.62, -.5, 2.6, 3.4, .85)], r=.88, ribs=5, lean=(.5, .2))


def cardon_c(p):
    cardon(p, 19.5, [(.42, .5, 3.2, 5.8, 1.0), (.55, PI + .1, 3.4, 6.0, 1.0), (.30, PI * 1.5, 2.6, 3.6, .8), (.72, PI * .5, 2.2, 3.0, .7)],
           r=1.05, ribs=5, arm_n=6, lean=(-.4, .3))


def cardon_pequeno_a(p):
    for (x, y, h, r) in ((0, 0, 8.4, .62), (1.3, -.6, 6.2, .52), (-1.1, .8, 7.0, .55)):
        pts = [(x, y, -.3), (x + .1, y, h * .5), (x, y + .1, h)]
        ctube(p, pts, (r * 1.05, r, r * .7), n=10, cols=(C['cacL'], C['cacD']), star=.2, topcol=C['cacT'], tip=.5)
    p.face([(.3, -.3, 8.4 * .9), (-.3, -.3, 8.4 * .9), (0, -.7, 8.4 * .9 + .4)], C['pink'], flip_ref=V((0, 0, 7)))


def cardon_pequeno_b(p):
    cardon(p, 8.6, [(.5, .2, 1.9, 2.6, .9)], r=.7, ribs=5, arm_n=6)


def pad(p, base, yaw, lean, w, h, th, col, edge, seed=0):
    """Prickly-pear pad: thin 8-gon lens. base = bottom point; lean = tilt from vertical (rad); yaw = facing direction."""
    rng = random.Random(seed)
    dvec = V((sin(lean) * cos(yaw), sin(lean) * sin(yaw), cos(lean)))
    uvec = V((-sin(yaw), cos(yaw), 0))
    nvec = dvec.cross(uvec).normalized()
    b = V(base)
    n = 8
    outline = []
    for i in range(n):
        a = 2 * PI * i / n
        outline.append((cos(a) * w * .5 * (1 + rng.uniform(-.08, .08)), (sin(a) * .5 + .5) * h * (1 + rng.uniform(-.06, .06))))
    ref = b + dvec * (h * .5)
    f = [b + uvec * u + dvec * v + nvec * th for u, v in outline]
    g = [b + uvec * u + dvec * v - nvec * th for u, v in outline]
    p.face(f, col, flip_ref=ref)
    p.face(g, col, flip_ref=ref)
    for i in range(n):
        j = (i + 1) % n
        p.face([f[i], f[j], g[j], g[i]], edge, flip_ref=ref)


def tuna(p, k):
    rng = random.Random(40 + k)
    cols = (C['tunaG'], C['tunaL'], C['tunaD'])
    pads = []
    if k == 0:
        spec = [((0, 0, -.2), 0.3, .05, 2.6, 3.0), ((-.5, 0, 2.4), 2.6, .5, 2.2, 2.6), ((.8, .2, 2.5), -.4, -.5, 2.0, 2.4), ((1.2, -.3, 4.4), 0.5, -.2, 1.7, 2.0),
                ((-1.4, .2, 4.4), 3.0, .4, 1.6, 2.0)]
    else:
        spec = [((0, 0, -.2), 1.0, .1, 2.8, 3.2), ((.5, .3, 2.6), 0.2, .45, 2.2, 2.6), ((-.9, -.2, 2.5), 2.8, -.5, 2.0, 2.4), ((1.8, .6, 4.6), 0.6, .3, 1.7, 2.0),
                ((-.4, -.3, 5.1), 3.6, .15, 1.6, 1.9)]
    for i, (b, yaw, lean, w, h) in enumerate(spec):
        pad(p, b, yaw, lean, w, h, .17, cols[i % 3], C['tunaD'], seed=i + k * 5)
        pads.append((b, yaw, lean, w, h))
    for (b, yaw, lean, w, h) in pads[3:]:
        tip = (b[0] + sin(lean) * cos(yaw) * h, b[1] + sin(lean) * sin(yaw) * h, b[2] + cos(lean) * h)
        for dx in (-.35, .35):
            p.ico((tip[0] + dx * (-sin(yaw)), tip[1] + dx * cos(yaw), tip[2] + .05), .3, C['red'], sub=0, sc=(1, 1, 1.2), seed=3)


def tuna_a(p):
    tuna(p, 0)


def tuna_b(p):
    tuna(p, 1)


def agave(p, k):
    rng = random.Random(50 + k)
    nl = 9 if k == 0 else 11
    for ring_i, (cnt, L0, rise0, cc) in enumerate(((nl, 2.6, .8, (C['agave'], C['agaveL'], C['agaveD'])), (6, 1.8, 1.9, (C['agaveL'], C['agave'], C['agaveL'])))):
        for i in range(cnt):
            a = 2 * PI * i / cnt + ring_i * .4 + rng.uniform(-.1, .1)
            d = (cos(a), sin(a))
            nn = (-d[1], d[0])
            L2 = L0 * (.9 + .2 * rng.random())
            wd = .55
            base = (d[0] * .2, d[1] * .2, .25 + ring_i * .4)
            mid = (d[0] * L2 * .55, d[1] * L2 * .55, base[2] + rise0 * .7 + .3)
            tip = (d[0] * L2, d[1] * L2, base[2] + rise0 + (.7 if ring_i else -.1))
            ml = (mid[0] + nn[0] * wd, mid[1] + nn[1] * wd, mid[2] - .05)
            mr = (mid[0] - nn[0] * wd, mid[1] - nn[1] * wd, mid[2] - .05)
            col = cc[i % 3]
            p.face([base, ml, tip, mr], col, up=True)
            p.face([base, mr, tip, ml], C['agaveD'], up=True)
    if k == 1:   # flowering stalk
        ctube(p, [(0, 0, .6), (.15, 0, 4.0), (.3, 0, 7.6)], (.2, .15, .1), n=4, cols=(C['woodL'], C['trunkD']), cap_end=False)
        for i, z in enumerate((5.2, 6.1, 7.0)):
            for s in (-1, 1):
                p.beam((.2, 0, z), (.2 + s * .8, .1, z + .5), .08, C['woodL'], 3)
                p.frustum((.2 + s * .9, .1, z + .4), .26, .0, .5, 3, C['yellowD'], bottom=False)
        p.frustum((.3, 0, 7.6), .3, .0, .6, 3, C['yellowD'], bottom=False)
    else:
        p.frustum((0, 0, .2), .5, .1, .9, 4, C['agaveD'], bottom=False)


def agave_a(p):
    agave(p, 0)


def agave_b(p):
    agave(p, 1)


def arbusto(p, k):
    pal = [(C['olive'], C['oliveL']), (C['khaki'], C['khakiL']), (C['oliveD'], C['khaki'])][k]
    if k == 0:
        spec = [(0, 0, 1.5, 1.7), (1.9, .6, 1.1, 1.2), (-1.5, .9, 1.0, 1.1), (.5, -1.4, .9, 1.0), (-.6, 1.8, .8, 1.0)]
    elif k == 1:
        spec = [(0, 0, 1.2, 1.4), (1.5, -.4, 1.0, 1.0), (-1.3, -.5, 1.0, 1.0), (.2, 1.5, 1.1, 1.2), (-.2, -1.7, .8, .9), (2.4, 1.2, .7, .8)]
    else:
        spec = [(0, 0, 1.0, 1.3), (1.2, .6, .9, 1.0), (-1.1, .5, .8, 1.0), (.3, -1.0, .8, .9), (0, 1.4, .7, .7), (-1.9, -.7, .6, .6)]
    for i, (x, y, r, zr) in enumerate(spec):
        tuft(p, (x, y, r * .45), r, pal[0] if i % 2 else C['khakiD'] if k == 1 else C['oliveD'], pal[1], seed=k * 10 + i, sz=.75)
    for i in range(3):
        a = i * 2.1 + k
        p.beam((cos(a) * .4, sin(a) * .4, 0), (cos(a) * 1.3, sin(a) * 1.3, .9 + .2 * i), .045, C['deadD'], 3)


def arbusto_seco_a(p):
    arbusto(p, 0)


def arbusto_seco_b(p):
    arbusto(p, 1)


def arbusto_seco_c(p):
    arbusto(p, 2)


# ───────────────────────── trees ─────────────────────────
def cuji(p, k):
    sp = [dict(h=7.2, w=5.4, lean=(.8, .3), tw=2), dict(h=9.4, w=6.4, lean=(-.7, .5), tw=3), dict(h=8.2, w=5.8, lean=(.2, -.8), tw=2)][k]
    h, w, ln = sp['h'], sp['w'], sp['lean']
    pts = [(0, 0, -.4), (ln[0] * .3, ln[1] * .3, h * .45), (ln[0], ln[1], h * .82)]
    ctube(p, pts, (.42, .3, .24), n=5, cols=(C['trunkD'], C['trunk']), cap_end=False)
    top = pts[-1]
    # forked limbs into the crown
    for i, a in enumerate((.3, 2.4, 4.4)):
        p.beam((top[0], top[1], top[2] - .5), (top[0] + cos(a) * w * .32, top[1] + sin(a) * w * .32, top[2] + .9), .13, C['trunkD'], 3)
    # flat umbrella crown: stacked faceted discs
    zc = top[2] + .8
    p.frustum((top[0], top[1], zc), w * .5, w * .42, .55, 8, C['cujiD'], rz=.2, tcolor=C['cuji'], bottom=True, ring_colors=[C['cujiD'], C['cuji']])
    p.frustum((top[0], top[1], zc + .5), w * .42, w * .26, .7, 8, C['cuji'], rz=.4, tcolor=C['cujiL'], bottom=False, ring_colors=[C['cuji'], C['cujiL'], C['cuji']])
    for i, (dx, dy, r) in enumerate(((w * .3, .5, w * .22), (-w * .28, -.4, w * .2), (.2, -w * .3, w * .18))[:sp['tw']]):
        p.frustum((top[0] + dx, top[1] + dy, zc + .25), r, r * .65, .6, 6, C['cuji'], rz=i, tcolor=C['cujiL'], bottom=False)
    tuft(p, (top[0] + .3, top[1], zc + 1.3), w * .16, C['cujiL'], C['oliveL'], seed=k, sz=.6)


def cuji_a(p):
    cuji(p, 0)


def cuji_b(p):
    cuji(p, 1)


def cuji_c(p):
    cuji(p, 2)


def arbol(p, k):
    if k == 0:
        ctube(p, [(0, 0, -.4), (.3, .1, 2.4), (.2, 0, 4.4)], (.55, .42, .3), n=5, cols=(C['trunkD'], C['trunk']), cap_end=False)
        specs = [((0, 0, 6.6), 3.2, 3.0, 2.6), ((-2.6, 1.0, 5.2), 2.3, 2.2, 2.0), ((2.4, -.9, 5.4), 2.4, 2.3, 2.1), ((.8, 2.0, 8.0), 2.0, 2.0, 1.8)]
    else:
        ctube(p, [(0, 0, -.4), (-.3, 0, 2.2), (-.1, .2, 4.0)], (.5, .4, .28), n=5, cols=(C['trunkD'], C['trunk']), cap_end=False)
        specs = [((0, 0, 6.2), 3.0, 2.8, 2.5), ((2.5, .6, 5.0), 2.3, 2.1, 2.0), ((-2.2, -1.0, 5.4), 2.4, 2.3, 2.2), ((-.4, 1.6, 7.8), 2.1, 2.0, 1.8)]
    pal = (C['g2'], C['g1'], C['g3'], C['g4']) if k == 0 else (C['g1'], C['g3'], C['g4'], C['g2'])
    for i, (c, rx, ry, rz) in enumerate(specs):
        lobe(p, c, rx, ry, rz, n=8, seed=k * 7 + i, pal=pal)
    for s in (-1, 1):
        p.beam((0, 0, 3.4), (s * 1.6, .3 * s, 5.0), .16, C['trunkD'], 3)


def arbol_falcon_a(p):
    arbol(p, 0)


def arbol_falcon_b(p):
    arbol(p, 1)


def palma(p, h, lean, nfr, fl, seed):
    rng = random.Random(seed)
    cols = (C['trunk'], C['trunkL'], C['trunkD'], C['trunk'], C['trunkL'], C['trunkD'])
    pts = []
    for t in (0, .2, .4, .6, .8, 1.0):
        pts.append((lean[0] * t ** 1.8, lean[1] * t ** 1.8, -.4 + (h + .4) * t))
    rad = (.62, .5, .42, .36, .32, .3)
    ctube(p, pts, rad, n=5, cols=(C['trunk'], C['trunkL'], C['trunkD'], C['trunkL'], C['trunk']), cap_end=False)
    top = pts[-1]
    a0 = rng.random() * 6.28
    for i in range(nfr):
        a = a0 + 2 * PI * i / nfr + rng.uniform(-.2, .2)
        L2 = fl * (.85 + .3 * rng.random())
        d = (cos(a), sin(a))
        nn = (-d[1], d[0])
        wd = .95
        b = (top[0], top[1], top[2] + .1)
        m1 = (top[0] + d[0] * L2 * .4, top[1] + d[1] * L2 * .4, top[2] + L2 * .3 + .35)
        m2 = (top[0] + d[0] * L2 * .75, top[1] + d[1] * L2 * .75, top[2] + L2 * .2)
        tip = (top[0] + d[0] * L2, top[1] + d[1] * L2, top[2] - L2 * .18)
        l1 = (m1[0] + nn[0] * wd, m1[1] + nn[1] * wd, m1[2] - .25)
        r1 = (m1[0] - nn[0] * wd, m1[1] - nn[1] * wd, m1[2] - .25)
        l2 = (m2[0] + nn[0] * wd * .6, m2[1] + nn[1] * wd * .6, m2[2] - .55)
        r2 = (m2[0] - nn[0] * wd * .6, m2[1] - nn[1] * wd * .6, m2[2] - .55)
        cA, cB = (C['palm'], C['palmL']) if i % 2 == 0 else (C['palmD'], C['palm'])
        p.face([b, l1, m1], cA, up=True)
        p.face([b, m1, r1], cB, up=True)
        p.face([l1, l2, m2, m1], cB, up=True)
        p.face([m1, m2, r2, r1], cA, up=True)
        p.face([l2, tip, m2], cA, up=True)
        p.face([m2, tip, r2], cB, up=True)
    for i in range(3):
        a = i * 2.1 + seed
        p.ico((top[0] + cos(a) * .35, top[1] + sin(a) * .35, top[2] - .35), .3, C['trunkD'], sub=0, seed=i, tcolor=C['trunkL'])


def palma_falcon_a(p):
    palma(p, 14.5, (2.6, .8), 8, 6.0, 3)


def palma_falcon_b(p):
    palma(p, 19.0, (-3.6, 1.8), 9, 6.4, 5)


# ───────────────────────── rocks ─────────────────────────
def mass(p, cx, cy, rx, ry, h, n=8, seed=1, z0=-.5, prof=None, bands=None, topcol=None, jit=.14, rot=0.0, lean=(0, 0), alt=0.0,
         twist=.28, top_apex=.05):
    """Faceted rock mass: loft of irregular rings. bands[k] = palette tuple for ring segment k; topcol cap palette."""
    rng = random.Random(seed)
    prof = prof or ((0, 1.12), (.3, 1.0), (.62, .86), (.86, .68), (1.0, .5))
    bands = bands or [(C['rOD'] if 'rOD' in C else C['rO'],)] * (len(prof) - 1)
    rings = []
    for k, (t, rf) in enumerate(prof):
        z = z0 + (h - z0) * t
        ring = []
        for i in range(n):
            a = 2 * PI * i / n + rot + k * twist
            m = rf * (1 + rng.uniform(-jit, jit)) * (1 + (alt if i % 2 else -alt))
            x = cx + rx * m * cos(a) + lean[0] * t
            y = cy + ry * m * sin(a) + lean[1] * t
            zz = z + (rng.uniform(-.05, .05) * h if 0 < k < len(prof) - 1 else 0)
            ring.append((x, y, zz))
        rings.append(ring)
    ref = V((cx + lean[0] * .5, cy + lean[1] * .5, (z0 + h) * .4))
    for k in range(len(prof) - 1):
        bk = bands[min(len(bands) - 1, k * len(bands) // (len(prof) - 1))]
        cols = [rng.choice(bk) for _ in range(n)]
        p.loft(rings[k:k + 2], cols[0], colors=cols, ref=ref)
    top = rings[-1]
    tc = topcol or bands[-1]
    ctr = (sum(q[0] for q in top) / n, sum(q[1] for q in top) / n, sum(q[2] for q in top) / n + top_apex * h)
    for i in range(n):
        p.face([top[i], top[(i + 1) % n], ctr], tc[i % len(tc)], up=True)
    return rings


def skirt(p, cx, cy, rx, ry, w=1.6, n=10, z1=.3, seed=2):
    """Sand apron hugging the rock base: ring from the rock (z1) down to the ground (z=.02)."""
    rng = random.Random(seed)
    ks = [rng.uniform(.9, 1.15) for _ in range(n)]
    for i in range(n):
        j = (i + 1) % n
        pts = []
        for ii, ro in ((i, 0), (j, 0)):
            a = 2 * PI * ii / n
            pts.append((cx + rx * .92 * cos(a), cy + ry * .92 * sin(a), z1))
        for ii in (j, i):
            a = 2 * PI * ii / n
            pts.append((cx + (rx * .92 + w * ks[ii]) * cos(a), cy + (ry * .92 + w * ks[ii]) * sin(a), .02))
        p.face(pts, C['sand'] if i % 2 else C['sandL'], up=True)


def foam_ring(p, ring, cx, cy, w=1.8, z=.07, seed=3):
    """Foam disc around the base: from the waterline ring of a rock mass outward (two tones)."""
    rng = random.Random(seed)
    n = len(ring)
    ks = [rng.uniform(.85, 1.2) for _ in range(n)]

    def pt(i, f):
        x, y = ring[i][0] - cx, ring[i][1] - cy
        r = math.hypot(x, y) or 1
        return (cx + x * (1 - .1) + x / r * w * f * ks[i], cy + y * (1 - .1) + y / r * w * f * ks[i], z)
    for i in range(n):
        j = (i + 1) % n
        p.face([pt(i, 0), pt(i, .55), pt(j, .55), pt(j, 0)], C['foam'], up=True)
        p.face([pt(i, .55), pt(i, 1.0), pt(j, 1.0), pt(j, .55)], C['foamB'], up=True)


A_ROCK = [(C['rOD'] if False else C['rO'], C['rOD'], C['rO']), (C['rO'], C['rOL'], C['rO']), (C['rOL'], C['tan'], C['rO']), (C['tan'], C['tanL'])]
BANDS_O = [(C['rOD'], C['rO'], C['rOD']), (C['rO'], C['rOL'], C['rO']), (C['rOL'], C['rO'], C['tan']), (C['tan'], C['tanL'], C['rOL'])]
BANDS_T = [(C['tanD'], C['tan'], C['tanD']), (C['tan'], C['tanL'], C['tan']), (C['tanL'], C['tan'], C['rOL']), (C['tanL'], C['sandL'])]
BANDS_P = [(C['pbD'], C['pb'], C['pbD']), (C['pb'], C['pbL'], C['pb']), (C['pbL'], C['rO'], C['pb']), (C['tan'], C['rOL'], C['tanL'])]


def roca_arida(p, k):
    if k == 0:
        mass(p, 0, 0, 3.4, 3.0, 3.2, n=7, seed=61, bands=BANDS_O)
        skirt(p, 0, 0, 3.4, 3.0, 1.2, n=7, seed=1)
    elif k == 1:
        mass(p, 0, 0, 2.4, 2.0, 6.0, n=6, seed=62, bands=BANDS_T, prof=((0, 1.15), (.25, 1.0), (.55, .9), (.8, .78), (1.0, .66)), lean=(.4, .2))
        mass(p, 2.2, -1.0, 1.3, 1.2, 2.2, n=6, seed=63, bands=BANDS_O, prof=((0, 1.1), (.4, 1.0), (.8, .8), (1.0, .6)))
    elif k == 2:
        mass(p, 0, 0, 5.0, 3.6, 3.2, n=9, seed=64, bands=BANDS_O, prof=((0, 1.1), (.35, 1.0), (.7, .92), (1.0, .8)), jit=.1)
        skirt(p, 0, 0, 5.0, 3.6, 1.8, n=9, seed=2)
        mass(p, -5.2, -1.4, 1.3, 1.1, 1.4, n=5, seed=65, bands=BANDS_T, prof=((0, 1.1), (.5, 1.0), (1.0, .7)))
    elif k == 3:
        mass(p, -1.6, .4, 2.6, 2.3, 4.2, n=7, seed=66, bands=BANDS_O)
        mass(p, 2.2, -.6, 2.3, 2.0, 3.0, n=7, seed=67, bands=BANDS_T)
        mass(p, .2, 2.6, 1.7, 1.5, 2.2, n=6, seed=68, bands=BANDS_O, prof=((0, 1.1), (.5, 1.0), (1.0, .7)))
        skirt(p, 0, 0, 4.0, 3.0, 1.6, n=9, seed=3, z1=.2)
    elif k == 4:
        mass(p, 0, 0, 5.2, 2.0, 4.8, n=8, seed=69, bands=BANDS_T, prof=((0, 1.1), (.3, 1.0), (.6, .9), (.85, .76), (1.0, .6)), lean=(.8, 0))
        skirt(p, 0, 0, 5.2, 2.0, 1.4, n=8, seed=4)
    else:   # hoodoo: wide cap on a narrow stem
        mass(p, 0, 0, 2.0, 1.8, 5.2, n=7, seed=70, bands=BANDS_O, prof=((0, 1.5), (.3, 1.0), (.62, .72), (.76, 1.12), (.9, 1.2), (1.0, .8)),
             z0=-.5, jit=.1)
        skirt(p, 0, 0, 3.0, 2.7, 1.0, n=7, seed=5)


def cactus_mini(p, x, y, z, h=1.4, r=.2):
    p.frustum((x, y, z), r, r * .75, h, 5, C['cacL'], bottom=False, tcolor=C['cacT'])


def cerro(p, k):
    s = 1 if k == 0 else -1
    if k == 0:
        mass(p, 0, 0, 10.0, 6.6, 12.5, n=14, seed=81, z0=-.6, bands=BANDS_P, alt=.06, jit=.12, lean=(-1.2, -.8),
             prof=((0, 1.1), (.28, 1.0), (.55, .86), (.8, .62), (1.0, .4)), topcol=(C['tan'], C['tanL']))
        mass(p, 6.8, 2.4, 5.2, 4.0, 7.0, n=10, seed=82, z0=-.6, bands=BANDS_P, alt=.05, jit=.12, prof=((0, 1.1), (.4, 1.0), (.75, .76), (1.0, .5)),
             topcol=(C['tan'], C['sandL']))
        mass(p, -6.8, -3.2, 3.2, 2.6, 4.2, n=8, seed=83, z0=-.6, bands=BANDS_O, prof=((0, 1.1), (.5, 1.0), (1.0, .6)))
        skirt(p, 0, 0, 10.0, 6.6, 1.8, n=12, seed=1, z1=.4)
        cactus_mini(p, -2.5, -1.5, 8.2, 1.8, .25)
        cactus_mini(p, 6.5, 2.0, 5.6, 1.4, .2)
        tuft(p, (1.5, 1.2, 12.0), .9, C['olive'], C['oliveL'], seed=3)
        tuft(p, (-6.8, -3.0, 4.2), .7, C['khaki'], C['khakiL'], seed=4)
    else:
        mass(p, 0, 0, 11.0, 6.0, 11.0, n=14, seed=91, z0=-.6, bands=BANDS_P, alt=.07, jit=.12, rot=.2, lean=(1.6, -.6),
             prof=((0, 1.1), (.3, 1.0), (.58, .88), (.82, .66), (1.0, .46)), topcol=(C['tanL'], C['tan']))
        mass(p, -6.8, 2.2, 5.0, 3.6, 6.0, n=10, seed=92, z0=-.6, bands=BANDS_P, alt=.05, jit=.12, prof=((0, 1.1), (.4, 1.0), (.75, .76), (1.0, .5)),
             topcol=(C['tan'], C['tanL']))
        mass(p, 5.2, -3.4, 3.0, 2.4, 3.6, n=8, seed=93, z0=-.6, bands=BANDS_O, prof=((0, 1.1), (.5, 1.0), (1.0, .6)))
        skirt(p, 0, 0, 11.0, 6.0, 1.8, n=12, seed=2, z1=.4)
        cactus_mini(p, 2.0, 0, 10.2, 1.6, .22)
        cactus_mini(p, -6.8, 2.0, 5.8, 1.3, .2)
        tuft(p, (-1.0, 1.0, 10.5), .9, C['olive'], C['oliveL'], seed=5)
        tuft(p, (5.0, -3.2, 3.6), .7, C['khaki'], C['khakiL'], seed=6)


def cerro_rocoso_a(p):
    cerro(p, 0)


def cerro_rocoso_b(p):
    cerro(p, 1)


def islote(p, k):
    """Sea stack: bottoms at z=-3, waterline ring at z=0, foam disc at z=.07."""
    prof = ((0, 1.0), (.2, 1.0), (.5, .84), (.8, .64), (1.0, .46))   # 4 segments; ring 1 sits at z=0 (z0=-3 → t=.2*(h+3)=3)
    bands = [(C['rOL'], C['rO']), (C['tan'], C['rOL'], C['tan']), (C['tanL'], C['tan'], C['tanL']), (C['tanL'], C['tan'])]
    if k == 0:
        h = 11.0
        t0 = 3.0 / (h + 3.0)
        pr = ((0, 1.0), (t0, 1.05), (.45, .9), (.75, .7), (1.0, .5))
        r1 = mass(p, 0, 0, 7.0, 6.0, h, n=11, seed=101, z0=-3, prof=pr, bands=bands, alt=.05, topcol=(C['tan'], C['tanL']), lean=(.8, 0))
        r2 = mass(p, 7.2, 2.4, 3.6, 3.0, 6.0, n=8, seed=102, z0=-3, prof=((0, 1.0), (3 / 9, 1.0), (.62, .82), (1.0, .5)),
                  bands=[bands[0], bands[1], bands[2]], topcol=(C['tan'],))
        foam_ring(p, r1[1], 0, 0, 2.0, seed=1)
        foam_ring(p, r2[1], 7.2, 2.4, 1.6, seed=2)
        tuft(p, (.5, 0, h + .3), 1.1, C['olive'], C['oliveL'], seed=1)
        tuft(p, (-1.6, 1.2, h - 1.0), .8, C['g2'], C['g3'], seed=2)
        tuft(p, (7.2, 2.4, 6.2), .8, C['olive'], C['oliveL'], seed=3)
    elif k == 1:
        h = 13.0
        t0 = 3.0 / (h + 3.0)
        pr = ((0, 1.0), (t0, 1.05), (.45, .88), (.75, .64), (1.0, .42))
        r1 = mass(p, 0, 0, 5.4, 5.0, h, n=10, seed=111, z0=-3, prof=pr, bands=bands, alt=.06, topcol=(C['tan'], C['tanL']), lean=(-.6, .6))
        r2 = mass(p, -7.2, -1.6, 4.4, 3.6, 7.6, n=9, seed=112, z0=-3, prof=((0, 1.0), (3 / 10.6, 1.05), (.55, .84), (1.0, .5)),
                  bands=[bands[0], bands[1], bands[2]], topcol=(C['tan'], C['tanL']))
        r3 = mass(p, 5.4, -3.4, 2.4, 2.2, 4.0, n=7, seed=113, z0=-3, prof=((0, 1.0), (3 / 7, 1.05), (.7, .8), (1.0, .55)),
                  bands=[bands[0], bands[1], bands[2]], topcol=(C['tan'],))
        foam_ring(p, r1[1], 0, 0, 2.0, seed=3)
        foam_ring(p, r2[1], -7.2, -1.6, 1.8, seed=4)
        foam_ring(p, r3[1], 5.4, -3.4, 1.4, seed=5)
        tuft(p, (.4, 0, h + .2), 1.0, C['olive'], C['oliveL'], seed=4)
        tuft(p, (-7.2, -1.6, 7.7), .9, C['g2'], C['g3'], seed=5)
        cactus_mini(p, -1.0, .8, h - .3, 1.5, .22)
    else:
        h = 9.0
        t0 = 3.0 / (h + 3.0)
        pr = ((0, 1.0), (t0, 1.05), (.5, .9), (.78, .74), (1.0, .55))
        r1 = mass(p, -3.6, 0, 6.8, 4.6, h, n=11, seed=121, z0=-3, prof=pr, bands=bands, alt=.04, topcol=(C['tan'], C['tanL']), lean=(1.0, 0))
        r2 = mass(p, 6.8, 1.6, 4.4, 3.4, 5.2, n=8, seed=122, z0=-3, prof=((0, 1.0), (3 / 8.2, 1.05), (.65, .8), (1.0, .5)),
                  bands=[bands[0], bands[1], bands[2]], topcol=(C['tan'],))
        foam_ring(p, r1[1], -3.6, 0, 2.0, seed=6)
        foam_ring(p, r2[1], 6.8, 1.6, 1.6, seed=7)
        tuft(p, (-3.8, .4, h + .2), 1.0, C['olive'], C['oliveL'], seed=6)
        tuft(p, (-1.0, -.4, h - .6), .7, C['g2'], C['g3'], seed=7)
        tuft(p, (6.8, 1.6, 5.3), .8, C['khaki'], C['khakiL'], seed=8)


def islote_a(p):
    islote(p, 0)


def islote_b(p):
    islote(p, 1)


def islote_c(p):
    islote(p, 2)


def roca_mar(p, k):
    spec = [(2.0, 1.8, 3.0, 7, 131), (2.6, 2.2, 4.2, 7, 132), (3.4, 2.8, 5.0, 8, 133), (3.8, 3.0, 3.4, 8, 134)][k]
    rx, ry, h, n, seed = spec
    t0 = 1.5 / (h + 1.5)
    bands = [(C['wet'], C['pbD']), (C['rOD'], C['pb']), (C['rO'], C['rOL'], C['tan'])]
    r = mass(p, 0, 0, rx, ry, h, n=n, seed=seed, z0=-1.5, prof=((0, 1.05), (t0, 1.1), (.6, .85), (1.0, .55)), bands=bands, topcol=(C['tan'], C['tanL']))
    foam_ring(p, r[1], 0, 0, 1.3 + rx * .15, seed=seed)
    if k == 3:
        r2 = mass(p, 2.8, -1.6, 1.4, 1.2, 1.8, n=6, seed=140, z0=-1.5, prof=((0, 1.0), (.45, 1.1), (1.0, .6)), bands=[bands[0], bands[1]], topcol=(C['tan'],))
        foam_ring(p, r2[1], 2.8, -1.6, 1.0, seed=9)
    if k == 2:
        tuft(p, (0, 0, h + .1), .8, C['olive'], C['oliveL'], seed=3)


def roca_mar_01(p):
    roca_mar(p, 0)


def roca_mar_02(p):
    roca_mar(p, 1)


def roca_mar_03(p):
    roca_mar(p, 2)


def roca_mar_04(p):
    roca_mar(p, 3)


# ───────────────────────── terrain bits ─────────────────────────
def duna(p, k):
    nx, ny = 12, 12
    L, W = 24.0, 10.0
    H = 3.0 if k == 0 else 2.6
    ph = 0.4 if k == 0 else 2.2
    sgn = 1 if k == 0 else -1

    def yc(x):
        return sgn * (.9 * sin(x * .30 + ph) + .35 * sin(x * .75 + ph * 2))

    def zf(x, y, row):
        u = x / (L / 2)
        env = max(0.0, cos(min(1.0, abs(u)) * PI / 2)) ** .85
        yp = (y - yc(x)) / (W / 2)
        if sgn < 0:
            yp = -yp
        s = 1.0 if yp < 0 else .62
        g = max(0.0, cos(min(1.0, abs(yp) / s) * PI / 2)) ** 1.25
        z = H * env * g
        if yp < 0 and z > .15:
            z += .05 * (1 if row % 2 else -1) * min(1.0, z)
        return z - .22
    xs = [-L / 2 + L * i / nx for i in range(nx + 1)]
    ys = []
    for j in range(ny + 1):
        t = j / ny
        ys.append(-W / 2 + W * (t + .08 * sin(2 * PI * t) * 0))
    grid = [[(x, y, zf(x, y, j)) for x in xs] for j, y in enumerate(ys)]
    ref = V((0, 0, -3))
    for j in range(ny):
        for i in range(nx):
            q = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
            zc = sum(v[2] for v in q) / 4
            yy = (q[0][1] + q[2][1]) / 2
            yp = (yy - yc((q[0][0] + q[1][0]) / 2)) / (W / 2)
            if sgn < 0:
                yp = -yp
            if zc < .15:
                col = C['sandW'] if (i + j) % 2 else C['sand']
            elif yp > 0:
                col = C['sandD'] if j % 2 else C['sandDD']
            elif abs(yp) < .18:
                col = C['sandL']
            else:
                col = C['sand'] if j % 2 else C['sandL']
            if sgn < 0:
                q = q[::-1]
            p.face(q, col, up=True)


def duna_cresta_a(p):
    duna(p, 0)


def duna_cresta_b(p):
    duna(p, 1)


def tronco_seco(p):
    pts = [(0, 0, -.3), (.5, .1, 1.6), (.2, .3, 3.2), (-.5, .2, 4.6), (-.4, 0, 5.8)]
    ctube(p, pts, (.58, .5, .42, .34, .26), n=6, cols=(C['dead'], C['deadL'], C['deadD'], C['dead'], C['deadL'], C['dead']), cap_end=False)
    # broken, jagged top
    t = pts[-1]
    jag = [(t[0] + cos(a) * .26, t[1] + sin(a) * .26) for a in [i * PI / 3 for i in range(6)]]
    for i in range(6):
        zt = t[2] + (.5 if i % 2 == 0 else .15)
        p.face([(jag[i][0], jag[i][1], t[2]), (jag[(i + 1) % 6][0], jag[(i + 1) % 6][1], t[2]), (t[0] + .1, t[1], zt + .2)], C['deadL'], flip_ref=V((t[0], t[1], t[2] - 1)))
    for (z, a, ln) in ((2.2, .6, 2.2), (3.8, 3.4, 1.8)):
        b0 = (pts[2][0] + cos(a) * .2, pts[2][1] + sin(a) * .2, z) if z < 3 else (pts[3][0], pts[3][1], z + .2)
        ctube(p, [b0, (b0[0] + cos(a) * ln * .5, b0[1] + sin(a) * ln * .5, b0[2] + ln * .35), (b0[0] + cos(a) * ln, b0[1] + sin(a) * ln, b0[2] + ln * .7)],
              (.2, .15, .09), n=4, cols=(C['dead'], C['deadD']), tip=.6)
    p.ico((.5, .1, .25), .9, C['sandL'], sub=0, sc=(1.3, 1.3, .3), seed=4, tcolor=C['sandL'])


def calavera_vaca(p):
    mass(p, 0, 0, 1.5, 1.2, 1.1, n=6, seed=151, z0=-.3, bands=[(C['tanD'], C['tan']), (C['tan'], C['tanL'])], prof=((0, 1.1), (.5, 1.0), (1.0, .7)))
    z = 1.5
    ctube(p, [(-.7, 0, z + .05), (.3, 0, z + .1), (1.2, 0, z - .02), (1.7, 0, z - .1)], (.5, .5, .32, .2), n=6, cols=(C['bone'], C['boneD']), tip=.3, cap_end=True)
    for s in (-1, 1):
        p.face([(.3, s * .4, z + .22), (.7, s * .36, z + .28), (.7, s * .36, z - .05), (.3, s * .4, z - .05)], C['blk'], flip_ref=V((.4, s * 3, z)))
        ctube(p, [(-.5, s * .35, z + .25), (-.7, s * .9, z + .45), (-.55, s * 1.5, z + .9), (-.3, s * 1.8, z + 1.5)], (.14, .12, .09, .06), n=3,
              cols=(C['bone'], C['boneD']), tip=1.2)
    p.face([(1.65, -.12, z - .1), (1.65, .12, z - .1), (1.75, 0, z - .15)], C['blk'], flip_ref=V((0, 0, z)))


# ───────────────────────── buildings ─────────────────────────
def side_pt(side, B, u, z, off):
    cx, cy, w, d = B
    if side == 's':
        return (cx + u, cy - d / 2 - off, z)
    if side == 'n':
        return (cx - u, cy + d / 2 + off, z)
    if side == 'e':
        return (cx + w / 2 + off, cy + u, z)
    return (cx - w / 2 - off, cy - u, z)


def fq(p, side, B, u0, u1, z0, z1, col, off=.04):
    pts = [side_pt(side, B, u, z, off) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))]
    p.face(pts, col, flip_ref=V((B[0], B[1], (z0 + z1) / 2)))


def fa(p, side, B, u0, u1, z0, z1, col, off=.05, seg=2):
    """Arched opening: rectangle with semicircular head (seg intermediate arc points)."""
    r = (u1 - u0) / 2
    uc = (u0 + u1) / 2
    zs = z1 - r
    pts = [(u0, z0), (u1, z0), (u1, zs)]
    for kk in range(1, seg + 1):
        th = PI * kk / (seg + 1)
        pts.append((uc + r * cos(th), zs + r * sin(th)))
    pts.append((u0, zs))
    p.face([side_pt(side, B, u, z, off) for u, z in pts], col, flip_ref=V((B[0], B[1], (z0 + z1) / 2)))


def window(p, side, B, u, z0=1.5, z1=3.0, ww=.45, shut=None, frame=None):
    frame = frame if frame is not None else C['trim']
    shut = shut if shut is not None else C['teal']
    fq(p, side, B, u - ww - .62, u + ww + .62, z0 - .12, z1 + .12, frame, off=.03)
    fq(p, side, B, u - ww, u + ww, z0, z1, C['glass'], off=.05)
    fq(p, side, B, u - ww - .6, u - ww - .02, z0, z1, shut, off=.06)
    fq(p, side, B, u + ww + .02, u + ww + .6, z0, z1, shut, off=.06)


def door(p, side, B, u, w=1.5, h=2.8, col=None):
    col = col if col is not None else C['door']
    fa(p, side, B, u - w / 2 - .22, u + w / 2 + .22, 0, h + .22, C['trim'], off=.03)
    fa(p, side, B, u - w / 2, u + w / 2, 0, h, col, off=.06)


def wallbox(p, cx, cy, w, d, h, col, zoc=None, ch=.18, zh=.6):
    p.cbox((cx, cy, 0), (w, d, h), col, ch=ch, tcolor=col)
    zoc = zoc if zoc is not None else C['wallD']
    B = (cx, cy, w, d)
    for sd in 'sn':
        fq(p, sd, B, -w / 2, w / 2, 0, zh, zoc, off=.02)
    for sd in 'ew':
        fq(p, sd, B, -d / 2, d / 2, 0, zh, zoc, off=.02)


def roof_gable(p, cx, cy, z, w, d, h, c1, c2, strips=3, ov=.45, ovx=.35, rz=0.0, endcol=None, ridge=True):
    """Tile gable roof; w = length along the ridge (local X), d = span. Tile bands alternate c1/c2."""
    co, si = cos(rz), sin(rz)

    def T(x, y, zz):
        return (cx + x * co - y * si, cy + x * si + y * co, z + zz)
    hw, hd = w / 2 + ovx, d / 2 + ov
    ref = V(T(0, 0, -4))
    for sg in (-1, 1):
        for k in range(strips):
            y0, y1 = sg * hd * (1 - k / strips), sg * hd * (1 - (k + 1) / strips)
            z0, z1 = h * (1 - abs(y0) / (d / 2 + ov)) - ov * .05, h * (1 - abs(y1) / (d / 2 + ov)) - ov * .05
            p.face([T(-hw, y0, z0), T(hw, y0, z0), T(hw, y1, z1), T(-hw, y1, z1)], c1 if k % 2 == 0 else c2, flip_ref=ref)
    if endcol is not None:
        for sx in (-1, 1):
            p.face([T(sx * w / 2, -d / 2, 0), T(sx * w / 2, d / 2, 0), T(sx * w / 2, 0, h * (1 - ov / (d / 2 + ov)) + .02)], endcol, flip_ref=ref)
    if ridge:
        p.beam(T(-hw, 0, h - .02), T(hw, 0, h - .02), .22, C['ridge'], 3)


def roof_hip(p, cx, cy, z, w, d, h, c1, c2, ov=.45, strips=2):
    hw, hd = w / 2 + ov, d / 2 + ov
    rw = max(.01, (w - d) / 2)
    ref = V((cx, cy, z - 3))
    for sg in (-1, 1):
        for k in range(strips):
            t0, t1 = k / strips, (k + 1) / strips
            xa0, xa1 = hw - (hw - rw) * t0, hw - (hw - rw) * t1
            p.face([(cx - xa0, cy + sg * hd * (1 - t0), z + h * t0), (cx + xa0, cy + sg * hd * (1 - t0), z + h * t0),
                    (cx + xa1, cy + sg * hd * (1 - t1), z + h * t1), (cx - xa1, cy + sg * hd * (1 - t1), z + h * t1)], c1 if k % 2 == 0 else c2, flip_ref=ref)
    for sg in (-1, 1):
        p.face([(cx + sg * hw, cy - hd, z), (cx + sg * hw, cy + hd, z), (cx + sg * rw, cy, z + h)], c2, flip_ref=ref)


def band(p, cx, cy, w, d, z, hgt, col, ov=.2):
    p.box((cx, cy, z), (w + 2 * ov, d + 2 * ov, hgt), col, bottom=False)


def lean_roof(p, x0, x1, ya, za, yb, zb, c1, c2, strips=3):
    ref = V(((x0 + x1) / 2, (ya + yb) / 2, min(za, zb) - 4))
    for k in range(strips):
        t0, t1 = k / strips, (k + 1) / strips
        p.face([(x0, ya + (yb - ya) * t0, za + (zb - za) * t0), (x1, ya + (yb - ya) * t0, za + (zb - za) * t0),
                (x1, ya + (yb - ya) * t1, za + (zb - za) * t1), (x0, ya + (yb - ya) * t1, za + (zb - za) * t1)],
               c1 if k % 2 == 0 else c2, flip_ref=ref)


def lean_roof_x(p, y0, y1, xa, za, xb, zb, c1, c2, strips=3):
    """Single-slope roof sloping along X (from xa at za down/up to xb at zb), spanning y0..y1."""
    ref = V(((xa + xb) / 2, (y0 + y1) / 2, min(za, zb) - 4))
    for k in range(strips):
        t0, t1 = k / strips, (k + 1) / strips
        p.face([(xa + (xb - xa) * t0, y0, za + (zb - za) * t0), (xa + (xb - xa) * t1, y0, za + (zb - za) * t1),
                (xa + (xb - xa) * t1, y1, za + (zb - za) * t1), (xa + (xb - xa) * t0, y1, za + (zb - za) * t0)],
               c1 if k % 2 == 0 else c2, flip_ref=ref)


def casa_a(p):
    """Gable cottage 10 x 7: centre door, 2 shuttered windows, chimney."""
    W, D, H = 10.0, 7.0, 3.6
    B = (0, 0, W, D)
    wallbox(p, 0, 0, W, D, H, C['wall'])
    door(p, 's', B, 0, 1.5, 2.8)
    window(p, 's', B, -3.2, shut=C['teal'])
    window(p, 's', B, 3.2, shut=C['teal'])
    window(p, 'e', B, 0, shut=C['blue'])
    fq(p, 's', B, -.9, .9, .35, .0 + .35, C['stoneL'], off=.1)
    p.box((-.9, -D / 2 - .5, 0), (1.8, .8, .3), C['stoneL'], bottom=False)
    roof_gable(p, 0, 0, H, W, D, 2.6, C['tile'], C['tileD'], strips=3, ov=.5, ovx=.4, endcol=C['wall'])
    p.cbox((-3.0, 1.2, H + 1.0), (.9, .9, 1.9), C['wallD'], ch=.1, tcolor=C['trim'])


def casa_b(p):
    """Arcade-porch house: main block behind a 4-bay colonnade."""
    W, D, H = 10.0, 5.0, 3.8
    B = (0, 1.8, W, D)
    wallbox(p, 0, 1.8, W, D, H, C['wall'])
    door(p, 's', B, 0, 1.5, 2.8)
    window(p, 's', B, -3.4, shut=C['blue'])
    window(p, 's', B, 3.4, shut=C['blue'])
    window(p, 'w', B, 0, shut=C['teal'])
    # porch: slab, 5 square columns, round arches (flat bands), beam, lean-to tile roof
    py0, py1 = -.7, -3.4
    p.box((0, (py0 + py1) / 2, 0), (W + .4, py0 - py1 + .3, .35), C['stoneL'], bottom=False, tcolor=C['plaza'])
    xs = [-W / 2 + .35 + i * (W - .7) / 4 for i in range(5)]
    for x in xs:
        p.cbox((x, py1 + .3, .35), (.55, .55, 2.9), C['wall'], ch=.08, tcolor=C['trim'])
    for a, b in zip(xs, xs[1:]):
        uc, r = (a + b) / 2, (b - a) / 2 - .28
        for k in range(3):
            t0, t1 = PI * k / 3, PI * (k + 1) / 3
            ro = r + .34
            p.face([(uc + r * cos(t0), py1 + .02, 3.25 + r * sin(t0)), (uc + r * cos(t1), py1 + .02, 3.25 + r * sin(t1)),
                    (uc + ro * cos(t1), py1 + .02, 3.25 + ro * sin(t1)), (uc + ro * cos(t0), py1 + .02, 3.25 + ro * sin(t0))],
                   C['wall'], flip_ref=V((uc, 5, 3)))
        p.box((uc - r, py1 - .05, 3.18), (2 * r, .5, .12), C['trim'], bottom=False) if False else None
    p.box((0, py1 + .3, 3.2), (W + .3, .6, .5) if False else (W + .3, .6, .42), C['trim'], bottom=False)
    lean_roof(p, -W / 2 - .3, W / 2 + .3, py0 + .1, 4.1, py1 - .5, 3.1, C['tile'], C['tileD'], strips=3)
    roof_gable(p, 0, 1.8, H, W, D, 2.5, C['tile'], C['tileD'], strips=3, ov=.5, ovx=.4, endcol=C['wall'])


def casa_c(p):
    """L-shaped house: long wing along X plus a front wing on the east end."""
    H = 3.5
    B1 = (0, 2.4, 10.0, 4.4)
    B2 = (3.7, -2.0, 4.6, 5.8)
    wallbox(p, 0, 2.4, 10.0, 4.4, H, C['wall'])
    wallbox(p, 3.7, -2.0, 4.6, 5.8, H, C['wall'])
    door(p, 's', B1, -2.2, 1.4, 2.7)
    window(p, 's', B1, -4.2 + 0, shut=C['teal']) if False else None
    window(p, 's', B1, 0.0, shut=C['teal'])
    window(p, 's', B2, 0, shut=C['blue'], z0=1.4, z1=2.9)
    window(p, 'e', B2, -.4, shut=C['teal'])
    window(p, 'w', B2, -.4, shut=C['teal'])
    window(p, 'n', B1, 0, shut=C['blue'])
    roof_gable(p, 0, 2.4, H, 10.0, 4.4, 2.2, C['tile'], C['tileD'], strips=3, ov=.45, ovx=.4, endcol=C['wall'])
    roof_gable(p, 3.7, -2.0, H, 5.8, 4.6, 2.2, C['tileD'], C['tile'], strips=3, ov=.45, ovx=.4, rz=PI / 2, endcol=C['wall'])
    p.box((-3.2, 4.2, 0), (1.0, 1.0, .9), C['stoneL'], bottom=False, tcolor=C['plaza'])
    p.cbox((-3.4, 3.2, H + 1.2), (.9, .9, 1.7), C['wallD'], ch=.1, tcolor=C['trim'])


def casa_d(p):
    """Low flat-roof adobe: parapet, protruding vigas, ochre walls."""
    W, D, H = 9.4, 6.8, 2.9
    B = (0, 0, W, D)
    wallbox(p, 0, 0, W, D, H, C['adobe'], zoc=C['adobeD'], ch=.3, zh=.5)
    door(p, 's', B, 1.6, 1.4, 2.3, col=C['woodD'])
    window(p, 's', B, -2.4, z0=1.3, z1=2.3, ww=.4, shut=C['blue'], frame=C['adobeL'])
    window(p, 'e', B, 0, z0=1.3, z1=2.3, ww=.4, shut=C['teal'], frame=C['adobeL'])
    t = .45
    for (cx, cy, w, d) in ((0, -D / 2 + t / 2, W + .1, t), (0, D / 2 - t / 2, W + .1, t), (-W / 2 + t / 2, 0, t, D - 2 * t), (W / 2 - t / 2, 0, t, D - 2 * t)):
        p.cbox((cx, cy, H - .1), (w, d, .7), C['adobeL'], ch=.1, tcolor=C['adobeL'])
    for i in range(4):
        x = -3.3 + i * 2.2
        p.box((x, -D / 2 - .5, H - .55), (.28, .9, .28), C['woodL'], bottom=False)
    p.grid((0, 0, H), (W - .9, D - .9), 5, 4, C['adobeL'], z=.03)
    p.box((2.2, 1.0, H - .1), (1.4, 1.4, .8), C['adobeD'], bottom=False, tcolor=C['adobeL'])     # roof access block
    p.box((-3.0, 1.2, H - .1), (.7, .7, 1.4), C['adobeD'], bottom=False, tcolor=C['adobeL'])
    p.box((-W / 2 - .6, -1.2, 0), (1.2, 1.0, .5), C['adobeD'], bottom=False, tcolor=C['adobeL'])   # bench


def muro_piedra(p):
    """Dry-stone wall, exactly x -3..3, 1.0 thick, 1.9 high."""
    t0, t1 = .56, .42
    rings = []
    for z, tt in ((-.3, t0), (1.5, t1 + .02), (1.9, t1)):
        rings.append([(-3, -tt, z), (3, -tt, z), (3, tt, z), (-3, tt, z)])
    p.loft(rings, C['stone'], colors=[C['stone']] * 4, ref=V((0, 0, .8)))
    p.face(rings[-1], C['stoneL'], up=True)
    rows = [(0.0, [-3, -1.6, -.3, 1.2, 2.5, 3]), (.55, [-3, -2.2, -.9, .5, 1.9, 3]), (1.1, [-3, -1.8, -.4, 1.0, 2.2, 3])]
    for ri, (z, xs) in enumerate(rows):
        for sd, y in ((-1, -(t0 - (t0 - t1) * z / 1.9) - .02), (1, (t0 - (t0 - t1) * z / 1.9) + .02)):
            for i in range(len(xs) - 1):
                a, b = xs[i] + .05, xs[i + 1] - .05
                col = (C['stoneL'], C['stone'], C['stoneD'], C['stoneL'])[(i + ri) % 4]
                p.face([(a, y, z + .04), (b, y, z + .04), (b, y, z + .5), (a, y, z + .5)], col, flip_ref=V((0, 0, z)) + V((0, sd * -5, 0)) * -1 if False else V((0, -sd * 5, z)))
    for i, (a, b) in enumerate(((-3, -1.7), (-1.65, -.2), (-.15, 1.3), (1.35, 2.7), (2.75, 3))):
        p.box(((a + b) / 2, 0, 1.86), (b - a - .06, .78 - (.0), .22 + (i % 2) * .08), C['stoneL'] if i % 2 else C['stone'], bottom=False, tcolor=C['stoneL'])


def aljibe(p):
    """Cistern: whitewashed drum with small dome, lantern, door, buttresses."""
    n = 8
    p.frustum((0, 0, -.3), 3.5, 3.3, .8, n, C['stone'], bottom=False, tcolor=C['stoneL'], ring_colors=[C['stone'], C['stoneD']])
    p.frustum((0, 0, .5), 3.0, 2.8, 2.5, n, C['wall'], bottom=False, top=False, ring_colors=[C['wall'], C['wallD']])
    p.frustum((0, 0, 3.0), 3.15, 3.15, .3, n, C['trim'], bottom=False, tcolor=C['trim'])
    K.dome(p, (0, 0, 3.3), 2.8, 1.9, n, 3, C['wall'], C['wallD'], ref_dz=-3)
    p.frustum((0, 0, 5.2), .6, .45, .6, 6, C['wall'], bottom=False, tcolor=C['trim'])
    K.dome(p, (0, 0, 5.8), .5, .45, 6, 2, C['tile'], C['tileD'])
    cross(p, 0, 0, 6.2, 1.0, C['wallD'])
    B = (0, -3.0, 2.0, 0.4)
    # arched door on the front
    for (u0, u1, z1, col, off) in ((-.95, .95, 2.2, C['trim'], .0), (-.7, .7, 2.0, C['door'], .05)):
        r = (u1 - u0) / 2
        zs = z1 - r
        pts = [(u0, .4, 0), (u1, .4, 0), (u1, .4, zs), (r * cos(PI / 3) * 1.0 * 1, .4, zs + r * sin(PI / 3)), (0, .4, z1), (-r * cos(PI / 3), .4, zs + r * sin(PI / 3)), (u0, .4, zs)]
        p.face([(x * 1.0, -3.12 - off + .0, z) for x, _, z in pts], col, flip_ref=V((0, 0, 1)))
    for a in (-PI * .5 + .9, -PI * .5 - .9):
        p.frustum((cos(a) * 3.25, sin(a) * 3.25, -.3), .55, .3, 3.0, 4, C['wall'], rz=a, bottom=False, tcolor=C['wallD'])
    p.box((-1.6, -4.1, 0), (3.2, 1.3, .35), C['stoneL'], bottom=False, tcolor=C['plaza'])


def kiosco_playa(p):
    """Thatched beach bar: four posts, counter, hip thatch roof with shaggy rim, sign, stools."""
    p.cbox((0, 0, -.1), (7.6, 6.2, .4), C['sandL'], ch=.15, tcolor=C['plaza'])
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.beam((sx * 3.1, sy * 2.4, .3), (sx * 3.1, sy * 2.4, 3.6), .2, C['wood'], 4)
    p.cbox((0, -1.6, .3), (5.6, 1.4, 1.5), C['woodL'], ch=.12, tcolor=C['wood'], colors=[C['woodL'], C['wood'], C['woodD'], C['wood']])
    fq(p, 's', (0, -1.6, 5.6, 1.4), -2.7, 2.7, .55, 1.0, C['teal'], off=.05)
    for x in (-1.6, 0, 1.6):
        p.frustum((x, -3.3, .3), .35, .3, .65, 5, C['woodD'], tcolor=C['woodL'], bottom=False)
    p.box((-2.4, 2.35, .3), (4.8, .4, 1.6), C['woodD'], bottom=False, tcolor=C['wood'])
    # thatch: rim skirt, body, crown
    ring = lambda r, z, rot=0: [(r * 1.28 * cos(rot + 2 * PI * i / 8), r * 1.1 * sin(rot + 2 * PI * i / 8), z) for i in range(8)]
    r0, r1, r2 = ring(4.7, 3.4), ring(4.2, 3.9, .2), ring(2.5, 5.3, .1)
    cols = [C['thatch'], C['thatchD'], C['thatchL'], C['thatch'], C['thatchD'], C['thatch'], C['thatchL'], C['thatchD']]
    ref = V((0, 0, 3.0))
    p.loft([r0, r1], C['thatchD'], colors=cols, ref=ref)
    p.loft([r1, r2], C['thatch'], colors=cols[::-1], ref=ref)
    for i in range(8):
        p.face([r2[i], r2[(i + 1) % 8], (0, 0, 6.4)], C['thatchL'] if i % 2 else C['thatch'], flip_ref=ref)
    p.beam((0, 0, 6.3), (0, 0, 7.0), .12, C['woodD'], 3)
    # sign
    p.box((-1.4, -3.0, 2.5), (2.8, .12, .7), C['red'], bottom=False)
    p.face([(-1.2, -3.1, 2.72), (1.2, -3.1, 2.72), (1.2, -3.1, 3.0), (-1.2, -3.1, 3.0)], C['wall'], flip_ref=V((0, 0, 2.8)))


def molino_aeolico(p):
    """3-blade modern turbine ~22 tall, rotor faces -Y (front)."""
    p.cbox((0, 0, -.3), (3.0, 3.0, .9), C['concD'] if 'concD' in C else C['stone'], ch=.2, tcolor=C['stoneL'])
    H = 16.2
    p.frustum((0, 0, .6), .95, .45, H - .6, 8, C['white'], bottom=False, tcolor=C['steelL'], ring_colors=[C['white'], 0xdfe4ee, C['white'], 0xd0d6e2, C['white'], 0xdfe4ee, C['white'], 0xd0d6e2])
    for z in (8.5,):
        p.frustum((0, 0, z), .8 - (z - 4) * .033, .8 - (z - 4) * .033, .1, 8, 0xc2c8d4, bottom=False, tcolor=0xc2c8d4)
    p.cbox((0, .3, H), (1.4, 3.0, 1.1), C['white'], ch=.25, tcolor=0xe9edf4)
    p.box((.0, 1.6, H + .15), (.8, .35, .5), 0xc2c8d4, bottom=False)
    hub = (0, -1.65, H + .55)
    p.frustum((0, -1.2, H + .55) if False else (0, -1.15, H + .55), .62, .62, .0001, 6, C['white']) if False else None
    for i in range(6):
        a0, a1 = 2 * PI * i / 6, 2 * PI * (i + 1) / 6
        p.face([(.5 * cos(a0), -1.35, H + .55 + .5 * sin(a0)), (.5 * cos(a1), -1.35, H + .55 + .5 * sin(a1)), (0, -2.1, H + .55)], C['white'] if i % 2 else 0xe4e8f0, flip_ref=V((0, 0, H + .55)))
    for b in range(3):
        a = PI / 2 + 2 * PI * b / 3 + .2
        d = (cos(a), sin(a))      # in the XZ plane (x, z)
        nrm = (-d[1], d[0])
        stations = [(0.5, .38, 0), (1.3, .4, .05), (3.0, .26, .1), (5.2, .07, .04)]
        rings = []
        for (r, w, tw) in stations:
            cx_, cz_ = hub[0] + d[0] * r, hub[2] + d[1] * r
            rings.append([(cx_ + nrm[0] * w, hub[1] - .14 - tw, cz_ + nrm[1] * w), (cx_ - nrm[0] * w, hub[1] - .05, cz_ - nrm[1] * w),
                          (cx_ - nrm[0] * w * .8, hub[1] + .12, cz_ - nrm[1] * w * .8), (cx_ + nrm[0] * w * .8, hub[1] + .10, cz_ + nrm[1] * w * .8)])
        p.loft(rings, C['white'], colors=[C['white'], 0xd6dce8, 0xcfd6e2, 0xe9edf4], caps=(False, True), ref=V((hub[0], hub[1], hub[2])) * 0 + V(rings[1][0]) * .25 + V(rings[1][2]) * .25 + V(rings[1][1]) * .25 + V(rings[1][3]) * .25)


def cruz_camino(p):
    """Stone wayside cross on a three-step plinth."""
    p.cbox((0, 0, -.3), (3.4, 3.4, .9), C['stone'], ch=.15, tcolor=C['stoneL'])
    p.cbox((0, 0, .6), (2.4, 2.4, .8), C['stoneL'], ch=.12, tcolor=C['wall'])
    p.cbox((0, 0, 1.4), (1.5, 1.5, 1.2), C['wall'], ch=.12, tcolor=C['trim'])
    p.frustum((0, 0, 2.6), .6, .4, .5, 4, C['trim'], rz=PI / 4, bottom=False, tcolor=C['wall'])
    p.cbox((0, 0, 3.1), (.7, .7, 4.2), C['stoneL'], ch=.08, tcolor=C['wall'], colors=[C['stoneL'], C['stone'], C['stoneD'], C['stone']])
    p.cbox((0, 0, 5.6), (3.0, .7, .7), C['stoneL'], ch=.08, tcolor=C['wall'], colors=[C['stoneL'], C['stoneL'], C['stoneL'], C['stoneL']])
    p.box((-.3, -.37, 6.9), (.6, .1, .6), C['stone'], bottom=False) if False else None
    p.face([(-.25, -.36, 3.4), (.25, -.36, 3.4), (.25, -.36, 3.7), (-.25, -.36, 3.7)], C['stoneD'], flip_ref=V((0, 5, 3.5)))


def iglesia_coro(p):
    """Cream-yellow colonial church: nave with red-tile gable roof, facade with arched door, bell tower with dome and cross."""
    WH, WT, YE = C['cream'], C['yellow'], C['yellowD']
    z0 = -.4
    # plaza apron: two steps, paved in alternating bands
    p.box((0, -9.6, z0), (22.0, 9.6, .75), C['plazaD'], bottom=False, top=False)
    p.grid((0, -9.6, 0), (22, 9.6), 8, 3, None, z=.35, colorfn=lambda x, y: C['plaza'] if (int((x + 11) / 2.75) + int((y + 4.8) / 3.2)) % 2 == 0 else C['plazaD'])
    for i in range(3):
        p.box((0, -5.8 - i * .62 + .0, .35 - 0.1 * (i + 1) + .1 + 0) if False else (0, -5.6 - i * .6, .35), (5.6 - i * .2, .6, .0001 + .35 - i * .12), C['stoneL'], bottom=False, tcolor=C['wall'])
    # nave
    NB = (0, 4.2, 12.0, 16.0)
    wallbox(p, 0, 4.2, 12.0, 16.0, 9.8, WH, zoc=C['trim'], zh=.9)
    # roof (ridge along Y)
    roof_gable(p, 0, 4.2, 9.8, 16.0, 12.0, 4.0, C['tile'], C['tileD'], strips=4, ov=.55, ovx=.6, rz=PI / 2, endcol=WH)
    # side aisles / wings with lean-to roofs
    wallbox(p, 8.6, 2.6, 5.2, 7.4, 6.0, WH, zoc=C['trim'], zh=.8, ch=.12)
    lean_roof_x(p, -1.4 + 0, 6.6 + 0, 6.0 + 0, 6.2, 11.4, 5.2, C['tile'], C['tileD'], strips=3) if False else None
    lean_roof_x(p, -1.8, 7.0, 6.0, 8.0, 11.7, 6.3, C['tile'], C['tileD'], strips=3)
    wallbox(p, -8.6, 5.6, 5.2, 9.2, 6.0, WH, zoc=C['trim'], zh=.8, ch=.12)
    lean_roof_x(p, .6, 10.6, -6.0, 8.0, -11.7, 6.3, C['tile'], C['tileD'], strips=3)
    # arched windows on aisles and nave
    for B, sd, us in (((8.6, 2.6, 5.2, 7.4), 'e', (-1.8, 1.8)), ((-8.6, 5.6, 5.2, 9.2), 'w', (-2.2, 2.2))):
        for u in us:
            fa(p, sd, B, u - .55, u + .55, 2.4, 4.6, C['glass'], off=.04)
    for u in (-3.5, 0.5, 4.5):
        fa(p, 'e', NB, u - .5, u + .5, 6.4, 8.8, C['glass'], off=.04)
        fa(p, 'w', NB, u - .5, u + .5, 6.4, 8.8, C['glass'], off=.04)
    # buttresses along the nave sides (tapered, sloped top)
    for sx in (-1, 1):
        for y in (9.6, 12.2):
            x0 = sx * 6.0
            pr = [(0, 0), (1.0, 0), (1.0, 6.4), (.5, 7.8), (0, 7.8)] if False else [(0, z0), (1.1, z0), (.45, 6.2), (0, 7.4)]
            p.poly_prism([(x0 + sx * px, y - .4) for px, _ in pr[:0]] or [(x0, y - .4), (x0 + sx * 1.1, y - .4), (x0 + sx * 1.1, y + .4), (x0, y + .4)], z0, 6.4, WT, tcolor=WT, bottom=False)
            p.frustum((x0 + sx * .55, y, 6.3), .8, .15, 1.2, 4, WT, rz=PI / 4, bottom=False, tcolor=WH) if False else None
            p.box((x0 + sx * .35 - .0, y - .4, 6.4), (.7, .8, .0001), WT) if False else None
            p.face([(x0, y - .4, 6.4), (x0 + sx * 1.1, y - .4, 6.4), (x0 + sx * 1.1, y + .4, 6.4), (x0, y + .4, 6.4)], WT, up=True) if False else None
            p.face([(x0, y - .4, 7.8), (x0 + sx * 1.1, y - .4, 6.4), (x0 + sx * 1.1, y + .4, 6.4), (x0, y + .4, 7.8)], WH, flip_ref=V((x0, y, 4)))
    # facade
    FB = (0, -4.6, 12.6, 1.0)
    p.cbox((0, -4.6, 0), (12.6, 1.0, 13.8), WH, ch=.3, tcolor=WH)
    fq(p, 's', FB, -6.3, 6.3, 0, 1.0, C['trim'], off=.02)
    # pediment, cornice, gable cross
    p.box((0, -4.6, 13.6), (13.4, 1.4, .45), WT, bottom=False)
    p.face([(-6.4, -5.3, 14.0), (6.4, -5.3, 14.0), (0, -5.3, 17.2)], WT, flip_ref=V((0, -2, 13)))
    p.face([(-5.4, -5.34, 14.3), (5.4, -5.34, 14.3), (0, -5.34, 16.4)], WH, flip_ref=V((0, -2, 13)))
    p.face([(-6.4, -3.9, 14.0), (6.4, -3.9, 14.0), (0, -3.9, 17.2)], WT, flip_ref=V((0, -2, 13)))
    cross(p, 0, -4.6, 17.0, 1.7, C['goldD'])
    for sx in (-1, 1):
        p.cbox((sx * 6.0, -4.6, 0), (.9, 1.4, 14.2), WT, ch=.12, tcolor=WT)
        p.ico((sx * 6.0, -4.6, 14.6), .4, C['gold'], sub=0, seed=3)
    # door (arched, double leaf), round window, niches
    fa(p, 's', FB, -1.9, 1.9, 0, 6.0, C['trim'], off=.03, seg=3)
    fa(p, 's', FB, -1.5, 1.5, 0, 5.6, C['door'], off=.06, seg=3)
    fq(p, 's', FB, -.04, .04, 0, 4.0, C['woodD'], off=.08)
    ring = [(cos(2 * PI * i / 8) * 1.2, -5.14, 9.8 + sin(2 * PI * i / 8) * 1.2) for i in range(8)]
    p.face([(x * 1.18, y - .02, 9.8 + (z - 9.8) * 1.18) for x, y, z in ring], C['trim'], flip_ref=V((0, 0, 9.8)))
    p.face(ring, C['glass'], flip_ref=V((0, 0, 9.8)))
    for sx in (-1, 1):
        fa(p, 's', FB, sx * 3.9 - .6, sx * 3.9 + .6, 3.6, 6.6, C['glass'], off=.04)
    p.box((-.9, -6.2, 0), (1.8, 1.0, .0001) if False else (1.8, 1.2, .3), C['stoneL'], bottom=False, tcolor=C['wall']) if False else None
    # bell tower (left, in front)
    tx, ty = -8.6, -3.4
    TB = (tx, ty, 5.6, 5.6)
    p.cbox((tx, ty, 0), (5.6, 5.6, 16.4), WH, ch=.3, tcolor=WH)
    p.cbox((tx, ty, 0), (5.9, 5.9, 1.2), C['stone'], ch=.1, tcolor=C['stoneL'])
    fa(p, 's', TB, -.8, .8, 1.2, 4.0, C['door'], off=.05)
    fa(p, 's', TB, -.55, .55, 8.0, 11.0, C['glass'], off=.05)
    fa(p, 'w', TB, -.55, .55, 8.0, 11.0, C['glass'], off=.05)
    fa(p, 'e', TB, -.55, .55, 8.0, 11.0, C['glass'], off=.05)
    band(p, tx, ty, 5.6, 5.6, 6.4, .45, WT, ov=.18)
    band(p, tx, ty, 5.6, 5.6, 16.0, .7, WT, ov=.26)
    # belfry
    p.cbox((tx, ty, 16.7), (4.6, 4.6, 5.0), WH, ch=.25, tcolor=WH)
    BB = (tx, ty, 4.6, 4.6)
    for sd in 'sewn':
        fa(p, sd, BB, -.95, .95, 17.4, 20.6, C['pbD'], off=.05, seg=3)
    p.ico((tx, ty, 18.8), .55, C['goldD'], sub=0, seed=3)
    for a in (PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4):
        p.box((tx + cos(a) * 2.35 - .22, ty + sin(a) * 2.35 - .22, 16.7), (.44, .44, 5.0), WT, bottom=False)
    band(p, tx, ty, 4.6, 4.6, 21.7, .5, WT, ov=.28)
    K.dome(p, (tx, ty, 22.2), 2.9, 3.2, 8, 3, C['gold'] if False else C['tile'], C['tileD'], rz=.39, ref_dz=-3)
    p.frustum((tx, ty, 25.3), .55, .42, 1.1, 6, WH, bottom=False, tcolor=WT)
    K.dome(p, (tx, ty, 26.4), .5, .5, 6, 2, C['gold'], C['goldD'])
    p.beam((tx, ty, 26.8), (tx, ty, 27.5), .12, C['goldD'], 3)
    cross(p, tx, ty, 27.3, 2.7, C['goldD'])
    # small dome over the apse end of the nave
    p.cbox((0, 10.6, 9.8), (3.4, 3.4, 1.5), WH, ch=.2, tcolor=WH)
    K.dome(p, (0, 10.6, 11.3), 1.7, 1.5, 8, 2, C['tile'], C['tileD'], rz=.39, ref_dz=-2)


# ───────────────────────── fauna ─────────────────────────
def leg(p, hip, knee, ank, r, cols, n=4):
    FL.tube(p, [hip, knee, ank, (ank[0], ank[1], 0.0)], [r, r * .66, r * .55, r * .7], cols, n=n, caps=(False, True))


def burro(p):
    s = 1.0
    coat, belly, mane = C['donk'], C['donkL'], C['donkD']
    st = [(-1.8, 2.85, .6, .7), (-.8, 3.1, .66, .78), (.5, 3.05, .66, .78), (1.7, 3.0, .54, .66)]
    FL.tube(p, [(x, 0, z) for x, z, _, _ in st], [(a, b) for _, _, a, b in st],
            lambda j, k, up: belly if up < -.35 else (mane if (up > .75 and j == 1) else coat), n=6, caps=(True, False))
    FL.tube(p, [(1.5, 0, 3.15), (2.25, 0, 3.95)], [(.46, .5), (.34, .4)], coat, n=5, caps=(False, False))
    FL.tube(p, [(2.25, 0, 3.95), (3.15, 0, 3.55), (3.6, 0, 3.2)], [(.34, .34), (.32, .3), (.2, .2)],
            lambda j, k, up: belly if j == 1 else coat, n=5, caps=(False, True))
    for sy in (-1, 1):
        FL.tube(p, [(2.25, sy * .2, 4.15), (2.1, sy * .38, 5.0), (2.0, sy * .46, 5.5)], [(.14, .1), (.12, .08), (.05, .04)], (coat, mane), n=3, caps=(False, True))
    FL.tube(p, [(1.5, 0, 3.5), (1.9, 0, 4.3), (2.1, 0, 4.5)], [(.1, .2), (.1, .2), (.06, .1)], mane, n=3, caps=(False, False))
    FL.tube(p, [(-1.85, 0, 2.85), (-2.2, 0, 2.2), (-2.35, 0, 1.2)], [(.12, .16), (.1, .12), (.1, .14)], (mane, coat), n=3, caps=(False, True))
    for hx, hy, front in ((1.25, .4, True), (1.25, -.4, True), (-1.3, .4, False), (-1.3, -.4, False)):
        leg(p, (hx, hy, 2.5), (hx + (.1 if front else -.2), hy, 1.3), (hx, hy, .5), .3, (coat, belly, mane))


def cabra(p, k):
    coat, patch = (C['goatA'], C['wall']) if k == 0 else (C['goatB'], C['wall'])
    beard = C['wall'] if k == 0 else C['donkL']
    st = [(-1.0, 2.0, .42, .5), (-.2, 2.15, .48, .55), (.7, 2.1, .46, .52), (1.15, 2.1, .38, .45)]

    def bc(j, kk, up):
        if up < -.3:
            return patch
        if k == 0:
            return patch if (j == 1 and kk in (1, 2)) else coat
        return patch if (j == 0 and kk in (2, 3)) else coat
    FL.tube(p, [(x, 0, z) for x, z, _, _ in st], [(a, b) for _, _, a, b in st], bc, n=6, caps=(True, False))
    FL.tube(p, [(.95, 0, 2.2), (1.45, 0, 2.85)], [(.28, .32), (.22, .26)], coat, n=5, caps=(False, False))
    FL.tube(p, [(1.45, 0, 2.85), (1.9, 0, 2.7), (2.2, 0, 2.45)], [(.22, .22), (.2, .2), (.12, .12)], lambda j, kk, up: patch if j == 1 and k == 0 else coat, n=5, caps=(False, True))
    for sy in (-1, 1):
        FL.tube(p, [(1.45, sy * .13, 3.05), (1.15, sy * .2, 3.55), (.8, sy * .22, 3.7)], [(.07, .07), (.06, .06), (.03, .03)], C['donkD'], n=3, caps=(False, True))
        FL.tube(p, [(1.5, sy * .24, 2.85), (1.75, sy * .45, 2.8)], [(.08, .05), (.05, .03)], coat, n=3, caps=(False, True))
    FL.tube(p, [(2.1, 0, 2.35), (2.15, 0, 1.95)], [(.07, .1), (.04, .06)], beard, n=3, caps=(False, True))
    FL.tube(p, [(-1.05, 0, 2.1), (-1.3, 0, 2.5)], [(.1, .14), (.06, .08)], coat, n=3, caps=(False, True))
    for hx, hy, front in ((.8, .28, True), (.8, -.28, True), (-.8, .28, False), (-.8, -.28, False)):
        leg(p, (hx, hy, 1.6), (hx + (.05 if front else -.12), hy, .85), (hx, hy, .38), .17, (coat, C['donkD'], C['goatB']))


def cabra_a(p):
    cabra(p, 0)


def cabra_b(p):
    cabra(p, 1)


def flamenco(p, pose):
    s = 1.0
    PK, PL, PD, LG = C['pink_f'], C['pinkL'], C['pinkD'], 0xe0708a
    bz = 2.7
    FL.tube(p, [(-.9, 0, bz + .1), (0, 0, bz), (.9, 0, bz + .25)], [(.45, .5), (.52, .58), (.34, .4)],
            lambda j, k, up: PL if up < -.3 else PK, n=5, caps=(True, False))
    if pose == 'down':
        nk = [(.8, bz + .2), (1.5, bz + .55), (1.6, 1.4), (1.9, .55)]
        hd = (2.0, .3)
    else:
        nk = [(.8, bz + .2), (1.4, bz + 1.1), (.95, bz + 2.0), (1.35, bz + 2.7)]
        hd = (1.65, bz + 2.7)
    FL.tube(p, [(x, 0, z) for x, z in nk], [(.2, .2), (.17, .17), (.15, .15), (.17, .17)], PK, n=3, caps=(False, False))
    ex, ez = nk[-1]
    FL.tube(p, [(ex, 0, ez), (ex + .35, 0, ez - .05), (ex + .6, 0, ez - .32)], [(.17, .17), (.13, .13), (.06, .06)], [0xfbdcd0, C['blk']], n=3, caps=(False, True))
    p.face([(-.8, -.1, bz + .35), (-1.8, 0, bz - .05), (-.8, .1, bz + .15)], C['blk'], flip_ref=V((-1, 0, bz)))
    for sy in (-1, 1):
        if pose == 'one' and sy == 1:
            continue
        p.beam((.1, sy * .22, bz - .3), (.1, sy * .22, .0), .08, LG, 3)
        p.face([(.0, sy * .22 - .15, .03), (.45, sy * .22, .03), (.0, sy * .22 + .15, .03)], PD, up=True)


def flamenco_grupo(p):
    p.disc((0, 0, .05), 7.8, C['shal'], rings=1, segs=12, colorfn=lambda x, y: C['shal'] if (x > 0) == (y > 0) else C['shal2'])
    specs = [((-2.8, -.8, .05), -1.2, 'stand'), ((.6, -3.0, .05), -.3, 'down'), ((2.8, .8, .05), -2.4, 'stand'), ((-.6, 2.6, .05), -1.0, 'down')]
    for loc, rot, pose in specs:
        at(p, flamenco, loc, rot, pose)


def lagarto(p):
    mass(p, 0, 0, 3.0, 2.4, 1.6, n=7, seed=161, z0=-.4, bands=[(C['tanD'], C['tan']), (C['rO'], C['tan'])], prof=((0, 1.1), (.5, 1.0), (1.0, .72)), topcol=(C['tan'], C['tanL']))
    z = 1.7
    FL.tube(p, [(-.2, 0, z + .3), (.5, 0, z + .38), (1.0, 0, z + .3)], [(.34, .3), (.38, .34), (.3, .28)], lambda j, k, up: C['igL'] if up < -.3 else C['ig'], n=4, caps=(False, False))
    FL.tube(p, [(1.0, 0, z + .3), (1.5, 0, z + .38), (1.85, 0, z + .3)], [(.24, .22), (.2, .2), (.12, .1)], C['ig'], n=4, caps=(False, True))
    FL.tube(p, [(-.2, 0, z + .3), (-.9, .1, z + .22), (-1.6, -.2, z + .2), (-2.2, -.4, z + .15), (-2.6, -.3, z + .12)],
            [(.3, .26), (.2, .17), (.14, .1), (.09, .06), (.04, .03)], lambda j, k, up: C['igD'] if (j + k) % 2 else C['ig'], n=4, caps=(False, True))
    for sx in (.55, -.05):
        for sy in (-1, 1):
            FL.tube(p, [(sx, sy * .3, z + .3), (sx + .1, sy * .6, z + .1), (sx + .3, sy * .7, z + .03)], [.09, .07, .08], C['igD'], n=3, caps=(False, True))
    for i in range(6):
        x = .9 - i * .35
        p.face([(x + .1, -.05, z + .62), (x - .1, -.05, z + .62), (x, 0, z + .95)], C['igL'], flip_ref=V((x, -1, z + .6))) if False else p.face([(x + .1, -.05, z + .55), (x - .1, -.05, z + .55), (x, 0, z + .88)], C['igL'], flip_ref=V((x, -3, z + .6)))
    p.face([(1.5, .2, z + .42), (1.5, .3, z + .45), (1.5, .25, z + .52)], C['blk'], flip_ref=V((1.5, 0, z)))


def pelicano_a(p):
    ctube(p, [(0, 0, -.4), (0, 0, 1.6), (0, 0, 3.0)], (.42, .34, .3), n=5, cols=(C['wood'], C['woodD'], C['woodL'], C['woodD'], C['wood']), cap_end=False)
    p.frustum((0, 0, 3.0), .36, .36, .15, 5, C['woodL'], bottom=False, tcolor=C['woodL'])
    p.cbox((0, 0, -.3), (1.7, 1.7, .5), C['sandL'], ch=.1, tcolor=C['sandL']) if False else None
    z = 3.2
    FL.tube(p, [(-.9, 0, z + 1.0), (0, 0, z + .95), (.9, 0, z + 1.35)], [(.55, .65), (.7, .82), (.45, .55)],
            lambda j, k, up: C['peliL'] if up < -.4 else C['peli'], n=6, caps=(True, False))
    for sy in (-1, 1):
        p.face([(.6, sy * .72, z + 1.7), (-.5, sy * .74, z + 1.4), (-1.7, sy * .5, z + .85), (-.4, sy * .72, z + .6)], C['peli'], flip_ref=V((0, sy * -3, z + 1.1)))
    FL.tube(p, [(.9, 0, z + 1.5), (1.4, 0, z + 2.2), (1.0, 0, z + 3.0), (1.55, 0, z + 3.5)], [(.26, .26), (.22, .24), (.22, .22), (.26, .26)], C['peliL'], n=4, caps=(False, False))
    FL.tube(p, [(1.55, 0, z + 3.5), (2.5, 0, z + 3.3), (3.5, 0, z + 2.95)], [(.2, .2), (.17, .16), (.1, .06)], [C['peliB'], C['peliB']], n=4, caps=(False, True))
    p.face([(1.9, -.2, z + 3.2), (3.3, -.12, z + 2.85), (2.9, 0, z + 2.6), (3.3, .12, z + 2.85), (1.9, .2, z + 3.2)], C['peliB'], flip_ref=V((2, 0, z + 5)))
    p.face([(-.9, -.15, z + 1.1), (-1.9, 0, z + .75), (-.9, .15, z + .9)], C['peli'], flip_ref=V((-1, 0, z + 5)))
    for sy in (-1, 1):
        p.beam((.1, sy * .3, z + .45), (.1, sy * .3, z - .02), .07, C['peliB'], 3)
        p.face([(.0, sy * .3 - .2, z + .0), (.55, sy * .3, z + .0), (.0, sy * .3 + .2, z + .0)], C['peliB'], up=True)


# ───────────────────────── build ─────────────────────────
ROWS = [
    ('edificios', 34, 36, [('iglesia_coro', iglesia_coro, True), ('casa_falcon_a', casa_a, True), ('casa_falcon_b', casa_b, True), ('casa_falcon_c', casa_c, True),
                         ('casa_falcon_d', casa_d, True)]),
    ('varios', 22, 22, [('muro_piedra', muro_piedra, True), ('aljibe', aljibe, True), ('kiosco_playa', kiosco_playa, True), ('molino_aeolico', molino_aeolico, False),
                      ('cruz_camino', cruz_camino, True), ('tronco_seco', tronco_seco, False), ('calavera_vaca', calavera_vaca, False)]),
    ('cardones', 14, 24, [('cardon_a', cardon_a, False), ('cardon_b', cardon_b, False), ('cardon_c', cardon_c, False), ('cardon_pequeno_a', cardon_pequeno_a, False),
                        ('cardon_pequeno_b', cardon_pequeno_b, False), ('tuna_a', tuna_a, False), ('tuna_b', tuna_b, False), ('agave_a', agave_a, False), ('agave_b', agave_b, False),
                        ('arbusto_seco_a', arbusto_seco_a, False), ('arbusto_seco_b', arbusto_seco_b, False), ('arbusto_seco_c', arbusto_seco_c, False)]),
    ('arboles', 16, 26, [('cuji_a', cuji_a, False), ('cuji_b', cuji_b, False), ('cuji_c', cuji_c, False), ('arbol_falcon_a', arbol_falcon_a, False), ('arbol_falcon_b', arbol_falcon_b, False),
                       ('palma_falcon_a', palma_falcon_a, False), ('palma_falcon_b', palma_falcon_b, False)]),
    ('rocas', 16, 18, [('roca_arida_%02d' % (i + 1), (lambda p, k=i: roca_arida(p, k)), False) for i in range(6)]),
    ('cerros', 34, 34, [('cerro_rocoso_a', cerro_rocoso_a, False), ('cerro_rocoso_b', cerro_rocoso_b, False), ('duna_cresta_a', duna_cresta_a, False), ('duna_cresta_b', duna_cresta_b, False)]),
    ('islotes', 34, 26, [('islote_a', islote_a, False), ('islote_b', islote_b, False), ('islote_c', islote_c, False)]),
    ('rocas_mar', 14, 18, [('roca_mar_%02d' % (i + 1), (lambda p, k=i: roca_mar(p, k)), False) for i in range(4)]),
    ('fauna', 12, 14, [('burro', burro, False), ('cabra_a', cabra_a, False), ('cabra_b', cabra_b, False), ('flamenco_grupo', flamenco_grupo, False),
                     ('lagarto', lagarto, False), ('pelicano_a', pelicano_a, False)]),
]
BUDGET = {'iglesia_coro': 900, 'casa': 300, 'cardon': 250, 'cuji': 250, 'arbol': 250, 'palma': 250, 'tuna': 250, 'agave': 250, 'arbusto': 250,
          'roca': 400, 'cerro': 400, 'islote': 400, 'burro': 300, 'cabra': 300, 'flamenco': 300, 'lagarto': 300, 'pelicano': 300}


def build(L):
    out = []
    parts = {}

    def mk(name, fn, fixed):
        p = L.Part(name, ao=0.0)
        _f = p.face
        lh = V((-.5, -.6, 0)).normalized()

        def lit_face(pts, color, *a, **k):
            c = int(color)
            f = _f(pts, c, *a, **k)
            if f is None:
                return f
            f.normal_update()
            n = f.normal
            if fixed and abs(n.z) < .35:
                f[p.fsh] = max(.60, min(1.0, .82 + .28 * (n.x * lh.x + n.y * lh.y)))
            r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
            f[p.fcol] = (min(255, int(r * LIFT)) << 16) | (min(255, int(g * LIFT)) << 8) | min(255, int(b * LIFT))
            return f
        p.face = lit_face
        fn(p)
        out.append(p)
        parts[name] = p
        return p

    y = 0.0
    for rname, dx, dy, items in ROWS:
        x0 = -dx * (len(items) - 1) / 2
        for i, (nm, fn, fixed) in enumerate(items):
            mk(nm, fn, fixed)
            parts[nm].loc = (x0 + i * dx, -y, 0)
        y += dy
    write_manifest(parts)
    return out


def budget_of(nm):
    for k, v in BUDGET.items():
        if nm.startswith(k):
            return v
    return 200


def write_manifest(parts):
    lines = ['# falcon_kit manifest', '',
             'GLB: `assets/models/falcon_kit.glb` (build: `tools/blender/prop_falcon_kit.py`). Falcon / Coro desert and Caribbean rocky coast kit. 1 unit = 1 map unit. '
             'Each node = one instanceable piece, origin = base centre, z=0 = ground (bases buried ~0.3-0.5 where they meet terrain). Front faces -Y. '
             'Fauna (burro, cabra_*, lagarto, pelicano_a) face +X locally; `flamenco_grupo` is a shallows disc with 4 flamingos already arranged (disc r=7.8 at z=0.05). '
             'Marine pieces (`islote_*`, `roca_mar_*`): z=0 = water line, white foam ring disc at z=0.07 around each stack, rock bottoms go down to -3 (islets) / -1.5 (sea rocks). '
             '`muro_piedra` is exactly 6 long (x -3..3, 1 thick, 1.9 high) and chains end to end every 6. `molino_aeolico`: rotor faces -Y. '
             '`duna_cresta_*`: 24 long (x) x 10 wide (y) x 3 tall, soft tapered ends buried -0.22 so it sits on the terrain; steep slip face on +Y (a) / -Y (b). '
             '`iglesia_coro`: plaza apron in front (-Y), bell tower front-left (x=-8.6), cross on the tower reaches z~30; church footprint 22 wide.', '',
             '| Part | tris | budget | footprint (x y) | height (z max) | z min |', '|---|---|---|---|---|---|']
    tot = 0
    over = []
    for nm, p in parts.items():
        t, w, d, h, zmin = stats(p)
        tot += t
        b = budget_of(nm)
        if t > b:
            over.append((nm, t, b))
        lines.append('| %s | %d | %d | %.1f x %.1f | %.1f | %.1f |' % (nm, t, b, w, d, h, zmin))
    lines += ['', '**Total: %d tris** (%d parts).' % (tot, len(parts))]
    path = os.path.join(lib.MODEL_DIR, 'falcon_kit_manifest.md')
    os.makedirs(lib.MODEL_DIR, exist_ok=True)
    with open(path, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('FALCON_TOTAL', tot, 'OVER', over)
    for nm, p in parts.items():
        t, w, d, h, zmin = stats(p)
        print('PART %-18s tris=%4d  %5.1f x %5.1f  h=%5.1f zmin=%5.1f' % (nm, t, w, d, h, zmin))


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
