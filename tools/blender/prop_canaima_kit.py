"""canaima_kit: instanceable prop kit for the Gran Sabana / Canaima rainforest + tepui + Pemon village of LA FIESTA.
Rainforest trees (round blobby crowns), emergent tree, feather/fan palms, platanillo, ferns, bushes, tepui-top stunted trees / heath / rocks,
forest + river rocks, tepui cliff outcrops (basalt-like columns), waterfalls (alta/media/ancha), rapids, foam pool,
Pemon huts, dock, canoes, fire, drying rack, firewood, cassava basket, macaws / toucan, rope footbridge, hanging vines.
Each Part = one instanceable piece, origin = base centre (z=0 ground), front = -Y. Fauna faces +X locally.
Writes assets/models/canaima_kit_manifest.md as a side effect of build()."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
import prop_falcon_kit as F
from mathutils import Vector

NAME = 'canaima_kit'
GROUND = 0x5a8a38
PREVIEW = dict(az=0, pitch=62, fit=0.97, size=3200)
AO_DIST = 10

V = Vector
PI = math.pi
cos, sin = math.cos, math.sin
LIFT = 1.10
ctube, at, mass, stats = F.ctube, F.at, F.mass, F.stats

C = dict(
    L1=0x2f7d2a, L2=0x3f9a2f, L3=0x1f6a2a, L4=0x6aa83a, L5=0x88b840, L6=0x2a5f2a,
    T1=0x7a5a3a, T2=0x5a3e28,
    th=0xc9a45a, thD=0xa88638, thL=0xe0c07a,
    wood=0x7a5230, woodL=0xa57a4a, woodD=0x5a3a20, mud=0x9a7048, mudD=0x7e5a38, door=0x2e1e14,
    cl1=0xc9733a, cl2=0xa65a30, cl3=0xdc8a4a, cl4=0x7a4a3a, cl5=0x6a5560,
    moss=0x6a9a30, mossL=0x88b840,
    rk=0x7a7468, rkD=0x5e584e, rkL=0x948d7e, rv=0xb8b2a2, rvD=0x8a8478, wet=0x4a463e,
    w1=0xf6fcff, w2=0xdff1fb, w3=0xbfe3f4, w4=0x8fcfe8,
    olive=0x8c9a48, oliveL=0xaab45c, yel=0xb4b84a,
    red=0xd9202a, redD=0xa01820, yellow=0xf2c230, blue=0x2a62c8, blueD=0x1f4a9a, ivory=0xe8e0c8, blk=0x241e20,
    orange=0xf08a22, fire1=0xff7a2a, fire2=0xffc03a, fire3=0xd9382a,
    cream=0xe8d8b0, cassava=0xb89066, hamA=0xd9483a, hamB=0xf0e0b0, hamC=0x3a6ea8,
)
WATER = {C['w1'], C['w2'], C['w3'], C['w4']}


# ───────────────────────── helpers ─────────────────────────
def blob(p, c, r, pal, seed, sc=(1, 1, .85), sub=2, jit=.13):
    rng = random.Random(seed + 91)

    def b(zc, rn):
        if zc < -.25:
            return pal[0]
        if zc < .3:
            return pal[1] if rn < .6 else pal[0]
        if len(pal) > 3 and rn > .82:
            return pal[3]
        return pal[2] if rn < .6 else pal[1]
    p.ico(c, r, pal[0], sub=sub, sc=sc, jitter=jit, seed=seed, bands=b, cut_below=c[2] - .62 * r * sc[2])


def tree(p, pts, rads, blobs, pal, seed, tcols=None, sub=2, branches=()):
    ctube(p, pts, rads, n=5, cols=tcols or (C['T1'], C['T2'], C['T1'], C['T2'], C['T1']), cap_end=False)
    for (a, b, w) in branches:
        p.beam(a, b, w, C['T2'], 3)
    for i, (c, r, sc) in enumerate(blobs):
        blob(p, c, r, pal, seed + i * 3, sc=sc, sub=sub if i < 4 else 1)


def frond(p, top, a, L, wd, cA, cB, rise=.3, droop=.18, lift=.35):
    d = (cos(a), sin(a))
    nn = (-d[1], d[0])
    b = (top[0], top[1], top[2] + .1)
    m1 = (top[0] + d[0] * L * .4, top[1] + d[1] * L * .4, top[2] + L * rise + lift)
    m2 = (top[0] + d[0] * L * .75, top[1] + d[1] * L * .75, top[2] + L * rise * .65)
    tip = (top[0] + d[0] * L, top[1] + d[1] * L, top[2] - L * droop)
    l1 = (m1[0] + nn[0] * wd, m1[1] + nn[1] * wd, m1[2] - .2)
    r1 = (m1[0] - nn[0] * wd, m1[1] - nn[1] * wd, m1[2] - .2)
    l2 = (m2[0] + nn[0] * wd * .65, m2[1] + nn[1] * wd * .65, m2[2] - .5)
    r2 = (m2[0] - nn[0] * wd * .65, m2[1] - nn[1] * wd * .65, m2[2] - .5)
    p.face([b, l1, m1], cA, up=True)
    p.face([b, m1, r1], cB, up=True)
    p.face([l1, l2, m2, m1], cB, up=True)
    p.face([m1, m2, r2, r1], cA, up=True)
    p.face([l2, tip, m2], cA, up=True)
    p.face([m2, tip, r2], cB, up=True)


def palma(p, h, lean, nfr, fl, seed, wd=1.0, droop=.2, cols=None):
    rng = random.Random(seed)
    pts = [(lean[0] * t ** 1.8, lean[1] * t ** 1.8, -.4 + (h + .4) * t) for t in (0, .22, .45, .7, 1.0)]
    ctube(p, pts, (.55, .42, .36, .3, .27), n=5, cols=(C['T1'], C['T2'], C['T1'], C['T2'], C['T1']), cap_end=False)
    top = pts[-1]
    a0 = rng.random() * 6.28
    cc = cols or ((C['L1'], C['L2']), (C['L3'], C['L4']))
    for i in range(nfr):
        a = a0 + 2 * PI * i / nfr + rng.uniform(-.2, .2)
        L = fl * (.85 + .3 * rng.random())
        cA, cB = cc[i % 2]
        frond(p, top, a, L, wd, cA, cB, droop=droop)
    p.ico((top[0], top[1], top[2] - .25), .42, C['T2'], sub=0, seed=seed, tcolor=C['T1'])


def rock_set(p, spec):
    for kw in spec:
        mass(p, **kw)


def moss_cap(p, c, r, seed=1):
    p.ico(c, r, C['moss'], sub=0, sc=(1, 1, .32), jitter=.15, seed=seed, tcolor=C['mossL'], cut_below=c[2] - .02)


# ───────────────────────── trees ─────────────────────────
def arbol_selva_a(p):
    tree(p, [(0, 0, -.5), (.3, .1, 3.2), (.1, 0, 6.6)], (.85, .6, .45),
         [((0, 0, 9.2), 4.0, (1, 1, .85)), ((-3.0, 1.0, 7.6), 3.2, (1, 1, .85)), ((3.1, -.8, 8.0), 3.3, (1, 1, .85)),
          ((.6, 2.6, 10.8), 2.8, (1, 1, .85)), ((-1.0, -2.4, 10.3), 2.6, (1, 1, .85))],
         (C['L3'], C['L1'], C['L2'], C['L4']), 11,
         branches=[((0, 0, 4.8), (-2.2, .8, 7.0), .2), ((0, 0, 5.2), (2.4, -.6, 7.4), .2)])


def arbol_selva_b(p):
    tree(p, [(0, 0, -.5), (-.3, 0, 3.5), (-.1, .2, 7.2)], (.8, .55, .42),
         [((0, 0, 10.6), 4.3, (1, 1, .9)), ((3.0, .8, 8.7), 3.0, (1, 1, .85)), ((-3.0, -.5, 9.0), 3.2, (1, 1, .85)),
          ((.5, -2.8, 9.6), 2.8, (1, 1, .85)), ((-.4, .8, 13.0), 2.8, (1, 1, .85))],
         (C['L6'], C['L2'], C['L4'], C['L5']), 23,
         branches=[((-.2, 0, 5.4), (-2.4, 0, 8.0), .2), ((-.2, 0, 5.6), (2.3, .7, 7.6), .2)])


def arbol_selva_c(p):
    tree(p, [(0, 0, -.5), (.4, -.2, 3.0), (.6, 0, 6.0)], (.9, .62, .46),
         [((-2.5, 0, 9.0), 3.6, (1.1, 1, .72)), ((2.6, .5, 9.6), 3.6, (1.1, 1, .72)), ((0, 0, 11.4), 3.2, (1, 1, .8)),
          ((0, -3.0, 8.6), 2.6, (1, 1, .8)), ((0, 3.0, 8.8), 2.5, (1, 1, .8))],
         (C['L1'], C['L2'], C['L5'], C['L4']), 37,
         branches=[((.5, 0, 5.0), (-2.2, 0, 8.2), .22), ((.5, 0, 5.2), (2.4, .4, 8.6), .22)])


def arbol_selva_alto(p):
    tree(p, [(0, 0, -.6), (.2, 0, 4.0), (-.1, .2, 9.0), (.2, 0, 15.5)], (1.3, .85, .6, .45),
         [((0, 0, 18.6), 6.0, (1, 1, .55)), ((-5.0, 1.0, 17.4), 4.5, (1, 1, .55)), ((5.0, -1.0, 17.6), 4.7, (1, 1, .55)),
          ((1.0, 4.5, 17.4), 4.0, (1, 1, .55)), ((-.5, -4.5, 17.8), 4.0, (1, 1, .55)), ((0, 0, 20.4), 3.4, (1, 1, .6))],
         (C['L3'], C['L1'], C['L2'], C['L5']), 51,
         branches=[((0, 0, 14.5), (-4.0, .8, 17.0), .3), ((0, 0, 14.8), (4.0, -.8, 17.2), .3), ((0, 0, 15), (.8, 3.4, 17), .25)])


# ───────────────────────── palms / plants ─────────────────────────
def palma_selva_a(p):
    palma(p, 14.0, (1.8, .6), 9, 5.6, 3, wd=.95)


def palma_selva_b(p):
    palma(p, 17.5, (-2.6, 1.4), 12, 5.8, 8, wd=1.3, droop=.32, cols=((C['L6'], C['L1']), (C['L3'], C['L2'])))


def platanillo(p, k):
    rng = random.Random(70 + k)
    n = 7 if k == 0 else 8
    cols = [(C['L4'], C['L2']), (C['L5'], C['L4']), (C['L2'], C['L4'])] if k == 0 else [(C['L2'], C['L1']), (C['L4'], C['L2']), (C['L3'], C['L2'])]
    for i in range(n):
        a = 2 * PI * i / n + rng.uniform(-.2, .2)
        L = (4.0 + 1.2 * rng.random()) * (1.0 if k == 0 else 1.1)
        d = (cos(a), sin(a))
        nn = (-d[1], d[0])
        wd = 1.35
        base = (d[0] * .25, d[1] * .25, .1)
        m1 = (d[0] * L * .35, d[1] * L * .35, 2.3 + rng.random() * .6)
        m2 = (d[0] * L * .72, d[1] * L * .72, 3.4 + rng.random() * .8 + (1.6 if i == 0 else 0))
        tip = (d[0] * L, d[1] * L, 3.9 + rng.random() * .7 + (1.6 if i == 0 else 0))
        l1 = (m1[0] + nn[0] * wd * .55, m1[1] + nn[1] * wd * .55, m1[2] - .15)
        r1 = (m1[0] - nn[0] * wd * .55, m1[1] - nn[1] * wd * .55, m1[2] - .15)
        l2 = (m2[0] + nn[0] * wd, m2[1] + nn[1] * wd, m2[2] - .35)
        r2 = (m2[0] - nn[0] * wd, m2[1] - nn[1] * wd, m2[2] - .35)
        cA, cB = cols[i % 3]
        p.face([base, l1, m1], cA, up=True)
        p.face([base, m1, r1], cB, up=True)
        p.face([l1, l2, m2, m1], cB, up=True)
        p.face([m1, m2, r2, r1], cA, up=True)
        p.face([l2, tip, r2, m2], cB, up=True) if False else (p.face([l2, tip, m2], cA, up=True), p.face([m2, tip, r2], cB, up=True))
    p.frustum((0, 0, -.2), .35, .25, 1.2, 5, C['L5'], bottom=False)


def platanillo_a(p):
    platanillo(p, 0)


def platanillo_b(p):
    platanillo(p, 1)


def helecho(p, k):
    rng = random.Random(80 + k)
    n = 11 if k == 0 else 13
    for i in range(n):
        a = 2 * PI * i / n + rng.uniform(-.15, .15)
        L = (2.5 + rng.random() * .8) * (1.0 if k == 0 else .9)
        d = (cos(a), sin(a))
        nn = (-d[1], d[0])
        wd = .38
        b = (d[0] * .1, d[1] * .1, .1)
        m = (d[0] * L * .55, d[1] * L * .55, 1.2 + rng.random() * .5)
        tip = (d[0] * L, d[1] * L, .25 + rng.random() * .4)
        l = (m[0] + nn[0] * wd, m[1] + nn[1] * wd, m[2] - .1)
        r = (m[0] - nn[0] * wd, m[1] - nn[1] * wd, m[2] - .1)
        cA, cB = (C['L5'], C['L4']) if (i + k) % 2 else (C['L4'], C['L2'])
        p.face([b, l, tip, r], cA, up=True)
        p.face([b, r, tip, l], cB, up=True)


def helecho_a(p):
    helecho(p, 0)


def helecho_b(p):
    helecho(p, 1)


def arbusto_selva(p, k):
    pal = (C['L6'], C['L1'], C['L4'], C['L5']) if k == 0 else (C['L3'], C['L2'], C['L5'], C['L4'])
    spec = [((0, 0, 1.7), 1.9, (1, 1, .85)), ((1.7, .6, 1.3), 1.4, (1, 1, .85)), ((-1.5, -.5, 1.4), 1.5, (1, 1, .85))] if k == 0 else \
        [((0, 0, 1.6), 1.8, (1, 1, .85)), ((-1.6, .7, 1.2), 1.3, (1, 1, .85)), ((1.2, -1.2, 1.3), 1.4, (1, 1, .85))]
    for i, (c, r, sc) in enumerate(spec):
        blob(p, c, r, pal, 100 + k * 9 + i, sc=sc, sub=2)


def arbusto_selva_a(p):
    arbusto_selva(p, 0)


def arbusto_selva_b(p):
    arbusto_selva(p, 1)


def arbolito_cima(p, k):
    pal = (C['olive'], C['oliveL'], C['mossL'], C['yel']) if k == 0 else (C['yel'], C['olive'], C['oliveL'], C['mossL'])
    if k == 0:
        ctube(p, [(0, 0, -.3), (.3, .1, 1.4), (.9, 0, 2.5)], (.3, .22, .15), n=4, cols=(C['T2'], C['T1']), cap_end=False)
        spec = [((.9, 0, 3.0), 1.7, (1, 1, .6)), ((-.4, .6, 2.5), 1.2, (1, 1, .6)), ((1.7, -.4, 2.5), 1.1, (1, 1, .6))]
    else:
        ctube(p, [(0, 0, -.3), (-.4, 0, 1.2), (-.2, .3, 2.4)], (.28, .2, .14), n=4, cols=(C['T2'], C['T1']), cap_end=False)
        spec = [((-.2, .3, 3.0), 1.6, (1.1, 1, .55)), ((.9, -.3, 2.4), 1.1, (1, 1, .6)), ((-1.3, .6, 2.3), 1.0, (1, 1, .6))]
    for i, (c, r, sc) in enumerate(spec):
        blob(p, c, r, pal, 120 + k * 5 + i, sc=sc, sub=2 if i == 0 else 1)


def arbolito_cima_a(p):
    arbolito_cima(p, 0)


def arbolito_cima_b(p):
    arbolito_cima(p, 1)


def arbusto_cima(p, k):
    pal = (C['moss'], C['mossL'], C['mossL'], C['yel']) if k == 0 else (C['olive'], C['oliveL'], C['oliveL'], C['mossL'])
    spec = [((0, 0, .55), .9), ((.9, .4, .4), .65), ((-.8, .2, .4), .6), ((.1, -.8, .35), .55), ((-.2, .8, .38), .5)]
    for i, (c, r) in enumerate(spec):
        blob(p, (c[0], c[1], c[2] * (1.0 if k == 0 else 1.15)), r * (1.15 if k else 1), pal, 140 + k * 7 + i, sc=(1, 1, .7), sub=0)


def arbusto_cima_a(p):
    arbusto_cima(p, 0)


def arbusto_cima_b(p):
    arbusto_cima(p, 1)


def roca_cima(p, k):
    bands = [(C['rkD'], C['rk']), (C['rk'], C['rkL'], C['cl5']), (C['rkL'], C['rk'])]
    if k == 0:
        mass(p, 0, 0, 1.6, 1.3, 2.4, n=7, seed=201, z0=-.4, bands=bands, topcol=(C['moss'], C['rkL']), prof=((0, 1.1), (.5, 1.0), (.85, .8), (1.0, .6)))
        mass(p, 1.5, -.5, .8, .7, 1.2, n=5, seed=202, z0=-.3, bands=bands[:2], topcol=(C['rkL'],), prof=((0, 1.1), (.6, 1.0), (1.0, .6)))
    else:
        mass(p, 0, 0, 1.3, 1.5, 2.8, n=7, seed=203, z0=-.4, bands=bands, topcol=(C['rkL'], C['moss']), prof=((0, 1.1), (.5, 1.0), (.85, .75), (1.0, .55)), lean=(.3, 0))
        mass(p, -1.4, .6, .9, .8, 1.3, n=5, seed=204, z0=-.3, bands=bands[:2], topcol=(C['moss'],), prof=((0, 1.1), (.6, 1.0), (1.0, .6)))


def roca_cima_a(p):
    roca_cima(p, 0)


def roca_cima_b(p):
    roca_cima(p, 1)


# ───────────────────────── rocks ─────────────────────────
def roca_selva(p, k):
    dk = [(C['rkD'], C['wet']), (C['rk'], C['rkD'], C['rkD']), (C['rk'], C['rkL'], C['moss']), (C['rkL'], C['rk'])]
    spec = [
        dict(cx=0, cy=0, rx=3.6, ry=3.0, h=4.2, n=8, seed=211, z0=-.6, bands=dk, topcol=(C['moss'], C['mossL'], C['rkL']), prof=((0, 1.1), (.3, 1.0), (.62, .88), (.85, .7), (1.0, .55))),
        dict(cx=0, cy=0, rx=4.5, ry=3.4, h=5.0, n=9, seed=212, z0=-.6, bands=dk, topcol=(C['moss'], C['mossL']), prof=((0, 1.1), (.35, 1.0), (.7, .85), (1.0, .6)), lean=(.6, 0)),
        dict(cx=0, cy=0, rx=3.2, ry=2.8, h=6.4, n=8, seed=213, z0=-.6, bands=dk, topcol=(C['mossL'], C['moss']), prof=((0, 1.15), (.3, 1.0), (.6, .84), (.85, .68), (1.0, .55)), lean=(-.5, .3)),
        dict(cx=0, cy=0, rx=4.2, ry=3.4, h=4.6, n=8, seed=214, z0=-.6, bands=dk, topcol=(C['moss'], C['rkL']), prof=((0, 1.1), (.4, 1.0), (.75, .84), (1.0, .6))),
    ][k]
    mass(p, **spec)
    if k == 0:
        mass(p, 3.9, -1.2, 1.8, 1.5, 2.4, n=6, seed=221, z0=-.6, bands=dk[:3], topcol=(C['moss'],), prof=((0, 1.1), (.5, 1.0), (1.0, .6)))
        moss_cap(p, (-.4, .2, 4.1), 1.5, 1)
    elif k == 1:
        mass(p, -4.2, 1.4, 1.9, 1.6, 2.6, n=6, seed=222, z0=-.6, bands=dk[:3], topcol=(C['rkL'], C['moss']), prof=((0, 1.1), (.5, 1.0), (1.0, .6)))
        moss_cap(p, (.6, -.3, 4.9), 1.7, 2)
    elif k == 2:
        mass(p, 2.8, 1.2, 1.7, 1.5, 2.9, n=6, seed=223, z0=-.6, bands=dk[:3], topcol=(C['moss'],), prof=((0, 1.1), (.5, 1.0), (1.0, .6)))
        moss_cap(p, (-.3, .2, 6.2), 1.2, 3)
    else:
        mass(p, -3.4, -2.0, 2.0, 1.7, 2.8, n=6, seed=224, z0=-.6, bands=dk[:3], topcol=(C['rkL'],), prof=((0, 1.1), (.5, 1.0), (1.0, .6)))
        mass(p, 2.6, 2.4, 1.5, 1.4, 2.2, n=5, seed=225, z0=-.6, bands=dk[:3], topcol=(C['moss'],), prof=((0, 1.1), (.5, 1.0), (1.0, .6)))
        moss_cap(p, (0, 0, 4.5), 1.6, 4)


def roca_selva_01(p):
    roca_selva(p, 0)


def roca_selva_02(p):
    roca_selva(p, 1)


def roca_selva_03(p):
    roca_selva(p, 2)


def roca_selva_04(p):
    roca_selva(p, 3)


def roca_rio(p, k):
    bands = [(C['wet'], C['rvD']), (C['rvD'], C['rv']), (C['rv'], C['rv'], C['rvD']), (C['rv'],)]
    prof = ((0, 1.0), (.25, 1.12), (.6, 1.0), (.85, .7), (1.0, .38))
    if k == 0:
        mass(p, 0, 0, 3.0, 2.6, 3.0, n=8, seed=231, z0=-.8, bands=bands, prof=prof, jit=.08, topcol=(C['rv'], C['rv'], C['moss']))
    elif k == 1:
        mass(p, 0, 0, 2.6, 2.1, 2.6, n=8, seed=232, z0=-.8, bands=bands, prof=prof, jit=.08, topcol=(C['rv'],))
        mass(p, 2.8, 1.4, 1.5, 1.3, 1.5, n=6, seed=233, z0=-.8, bands=bands, prof=prof, jit=.08, topcol=(C['rv'],))
    else:
        mass(p, 0, 0, 3.4, 2.6, 3.4, n=8, seed=234, z0=-.8, bands=bands, prof=prof, jit=.08, topcol=(C['rv'], C['rvD']), lean=(.4, 0))
        mass(p, -3.4, -1.0, 1.7, 1.5, 1.7, n=6, seed=235, z0=-.8, bands=bands, prof=prof, jit=.08, topcol=(C['rv'],))


def roca_rio_a(p):
    roca_rio(p, 0)


def roca_rio_b(p):
    roca_rio(p, 1)


def roca_rio_c(p):
    roca_rio(p, 2)


def cima_roca(p, k):
    """Tepui outcrop: ragged cluster of stacked hex columns. Tall rows at +Y (cliff side)."""
    rng = random.Random(300 + k)
    spec = [
        # (x, y, r, h)
        [(-3.6, 1.5, 2.1, 17), (-1.2, 2.0, 2.2, 20), (1.4, 1.8, 2.1, 18), (3.9, 1.4, 2.0, 15),
         (-2.6, -1.0, 1.9, 13), (.2, -.6, 2.0, 15), (2.7, -1.0, 1.8, 11), (-4.6, -1.4, 1.4, 9), (4.8, -1.1, 1.3, 8)],
        [(-3.0, 1.0, 2.2, 19), (-.4, 1.7, 2.3, 18), (2.3, 1.2, 2.0, 20), (4.2, .6, 1.7, 14),
         (-4.5, -.4, 1.6, 12), (-1.6, -1.2, 2.0, 14), (1.2, -1.4, 1.9, 12), (3.4, -1.8, 1.6, 9), (-.2, -3.2, 1.4, 6)],
        [(-4.6, 1.0, 2.0, 15), (-2.1, 1.7, 2.2, 18), (.5, 2.1, 2.3, 20), (3.0, 1.6, 2.1, 17), (5.2, .8, 1.7, 14),
         (-3.2, -1.4, 1.9, 11), (-.6, -1.0, 2.1, 13), (2.0, -1.6, 1.9, 10), (4.4, -1.8, 1.5, 8)],
    ][k]
    cols_a = [C['cl1'], C['cl2'], C['cl3'], C['cl1'], C['cl2'], C['cl4'], C['cl5']]
    for i, (x, y, r, h) in enumerate(spec):
        z0 = -.4
        seg = [(z0, h * .55), (h * .55 - .05, h)]
        for s, (za, zb) in enumerate(seg):
            rc = [rng.choice(cols_a if s == 0 else [C['cl3'], C['cl1'], C['cl2'], C['cl5'], C['cl1']]) for _ in range(6)]
            sh = (rng.uniform(-.25, .25), rng.uniform(-.25, .25)) if s else (0, 0)
            r0 = r * (1.0 if s == 0 else .93)
            r1 = r * (.95 if s == 0 else .86)
            p.frustum((x + sh[0], y + sh[1], za), r0, r1, zb - za, 6, rc[0], rz=rng.uniform(0, 1), top=(s == 1), bottom=False,
                      tcolor=C['moss'] if i % 2 == 0 else C['mossL'], ring_colors=rc)
        if h < 15 and i % 3 == 0:
            moss_cap(p, (x, y, h + .05), r * .6, i)


def cima_roca_a(p):
    cima_roca(p, 0)


def cima_roca_b(p):
    cima_roca(p, 1)


def cima_roca_c(p):
    cima_roca(p, 2)


# ───────────────────────── water ─────────────────────────
def sheet(p, cx, path, widths, ncol, seed=0, streak=(1, 4), wave=.12, ytop=None):
    """Water sheet along a (y,z) path (bottom -> top). widths[i] = full width at path point i."""
    rng = random.Random(seed)
    m = len(path)
    rows = []
    for k, ((y, z), w) in enumerate(zip(path, widths)):
        rows.append([(cx + (i / ncol - .5) * w + wave * sin(k * 1.7 + i * 2.1), y, z) for i in range(ncol + 1)])
    for k in range(m - 1):
        for i in range(ncol):
            if i in streak:
                col = C['w3'] if rng.random() < .55 else (C['w4'] if rng.random() < .4 else C['w2'])
            else:
                col = C['w1'] if rng.random() < .55 else C['w2']
            if k == 0:
                col = C['w1'] if rng.random() < .7 else C['w2']
            zc = (rows[k][i][2] + rows[k + 1][i][2]) / 2
            yc = (rows[k][i][1] + rows[k + 1][i][1]) / 2
            p.face([rows[k][i], rows[k][i + 1], rows[k + 1][i + 1], rows[k + 1][i]], col, flip_ref=V((cx, yc + 80, zc)))


def foam_blobs(p, cx, cy, r, n, bs, seed, z=.35, rot0=0.0, ry=1.0):
    rng = random.Random(seed)
    for i in range(n):
        a = rot0 + 2 * PI * i / n + rng.uniform(-.2, .2)
        rr = r * rng.uniform(.9, 1.1)
        c = (cx + cos(a) * rr, cy + sin(a) * rr * ry, z)
        col = C['w1'] if i % 2 == 0 else C['w2']
        p.ico(c, bs * rng.uniform(.8, 1.2), col, sub=0, sc=(1.1, 1, .55), jitter=.12, seed=seed + i, cut_below=z - .02)


def pool_disc(p, r, z=.1, segs=12):
    p.disc((0, 0, z), r, C['w3'], rings=2, segs=segs,
           colorfn=lambda x, y: C['w1'] if math.hypot(x, y) > r * .62 else (C['w3'] if (x + y) > 0 else C['w2']))


def cascada(p, H, W, seed, rows, bulge, pool, nrim, lip):
    path, widths = [], []
    for k in range(rows + 1):
        t = k / rows
        path.append((2.85 - bulge * (1 - t) ** 2.4, H * t))
        widths.append(W * (1.15 - .3 * t))
    sheet(p, 0, path, widths, 6, seed=seed, streak=(1, 4))
    path2 = [(y - .45, z) for (y, z) in path[: rows - 1]]
    sheet(p, W * .06, path2, [w * .55 for w in widths[: rows - 1]], 4, seed=seed + 5, streak=(0, 3), wave=.1)
    pool_disc(p, pool)
    foam_blobs(p, 0, 0, pool * .92, nrim, 1.1, seed + 11, z=.15)
    foam_blobs(p, 0, .9, 1.5, 4, 1.2, seed + 21, z=.35, ry=.7)
    for i, x in enumerate(lip):
        r = 1.6 - .1 * (i % 2)
        p.ico((x * W / 10, 3.5, H - .1), r, C['rk'], sub=0, sc=(1.1, 1, .7), jitter=.2, seed=seed + 30 + i, bands=lambda zc, rn: C['rkL'] if zc > .3 else (C['rk'] if rn < .5 else C['rkD']), cut_below=H - .9)
        if i % 2 == 0:
            moss_cap(p, (x * W / 10, 3.5, H + .45), r * .5, i)


def cascada_alta(p):
    cascada(p, 40, 10, 61, 8, 2.6, 7.0, 8, (-4.2, -1.6, 1.8, 4.4))


def cascada_media(p):
    cascada(p, 18, 7, 71, 6, 2.0, 5.0, 7, (-2.6, 0, 2.8))


def cascada_ancha(p):
    dk = [(C['rkD'], C['cl4']), (C['rk'], C['rkD'], C['cl4']), (C['rk'], C['rkL'], C['moss'])]
    pr = ((0, 1.02), (.5, 1.0), (.92, .98), (1.0, .96))
    mass(p, 0, 4.9, 15.0, 2.5, 10.0, n=10, seed=401, z0=-.5, bands=dk, prof=pr, jit=.05, top_apex=0.0, topcol=(C['moss'], C['rk'], C['mossL']), twist=.0)
    mass(p, 0, 1.0, 14.4, 2.3, 6.0, n=10, seed=402, z0=-.5, bands=dk, prof=pr, jit=.05, top_apex=0.0, topcol=(C['rk'], C['rkL']), twist=.0)
    mass(p, 0, -2.4, 13.6, 1.9, 2.6, n=9, seed=403, z0=-.5, bands=dk, prof=pr, jit=.05, top_apex=0.0, topcol=(C['rk'], C['rkL']), twist=.0)
    path = [(-5.8, .15), (-5.1, .9), (-4.55, 2.25), (-3.6, 2.72), (-2.3, 2.72), (-1.85, 3.4), (-1.5, 4.8), (-1.38, 6.05),
            (0.0, 6.12), (1.6, 6.12), (2.0, 7.4), (2.28, 8.9), (2.45, 10.1)]
    for i, x in enumerate((-9.5, 0.0, 9.5)):
        w = 7.0 if i != 1 else 8.0
        sheet(p, x, path, [w * (1.1 if k < 3 else 1.0) for k in range(len(path))], 3 if i != 1 else 4, seed=410 + i, streak=(1,), wave=.1)
        foam_blobs(p, x, -5.9, 2.6, 2, 1.3, 420 + i, z=.3, ry=.6)


def rapido(p, W, D, seed, nf, nr):
    rng = random.Random(seed)
    for i in range(nf):
        x = rng.uniform(-W * .42, W * .42)
        y = rng.uniform(-D * .38, D * .38)
        r = rng.uniform(1.0, 1.7)
        col = C['w1'] if i % 3 else C['w2']
        p.ico((x, y, .3), r, col, sub=0, sc=(1.3, 1.0, .35), jitter=.15, seed=seed + i, cut_below=.28)
    for i in range(3):
        x = rng.uniform(-W * .3, W * .3)
        y = rng.uniform(-D * .25, D * .25)
        p.ico((x, y, .55), rng.uniform(.9, 1.4), C['rkD'], sub=0, sc=(1, 1, .8), jitter=.2, seed=seed + 50 + i, bands=lambda zc, rn: C['wet'] if zc < .1 else (C['rkD'] if rn < .5 else C['rk']), cut_below=.25)
        p.ico((x, y, .33), 1.9, C['w1'], sub=0, sc=(1.2, 1, .25), jitter=.1, seed=seed + 70 + i, cut_below=.3)
    for i in range(3):
        p.ico((rng.uniform(-W * .35, W * .35), rng.uniform(-D * .3, D * .3), .31), 1.5, C['w4'], sub=0, sc=(1.4, .8, .2), jitter=.1, seed=seed + 90 + i, cut_below=.3)


def rapido_a(p):
    rapido(p, 14, 8, 501, 6, 3)


def rapido_b(p):
    rapido(p, 10, 6, 511, 5, 2)


def espuma_pozo(p):
    p.disc((0, 0, .3), 6, C['w3'], rings=2, segs=12,
           colorfn=lambda x, y: C['w1'] if math.hypot(x, y) > 3.5 else (C['w2'] if (x + y) > 0 else C['w3']))
    foam_blobs(p, 0, 0, 5.0, 8, 1.2, 521, z=.32)
    foam_blobs(p, 0, 0, 2.0, 4, 1.4, 531, z=.34, rot0=.5)
    for i, (x, y, r) in enumerate(((2.2, 1.4, 1.1), (-2.4, -1.2, 1.3), (.3, -2.8, .9))):
        p.ico((x, y, .5), r, C['rkD'], sub=0, sc=(1, 1, .8), jitter=.2, seed=541 + i, bands=lambda zc, rn: C['wet'] if zc < .1 else (C['rkD'] if rn < .5 else C['rk']), cut_below=.25)


# ───────────────────────── village ─────────────────────────
def hut(p, rx, ry, wh, rh, n=12, ridge=False, tip=0.0, door_w=1.3):
    sy = ry / rx
    p.frustum((0, 0, -.3), rx * .97, rx * .93, wh + .3, n, C['mud'], sy=sy, top=False, bottom=False,
              ring_colors=[C['mud'], C['mudD'], C['wood'], C['mud']])
    ea = 1.22
    stg = [(ea, wh + .05), (.86, wh + rh * .38), (.52, wh + rh * .7), (.22, wh + rh * .92)]
    rings = []
    for k, (s, z) in enumerate(stg):
        rr = []
        for i in range(n):
            a = 2 * PI * i / n + .1
            ss = s * ((1.0 if i % 2 == 0 else .95) if k == 0 else 1.0)
            if ridge and k == 3:
                rr.append((rx * .45 * cos(a) * s * 2, ry * .04 * sin(a), z))
            else:
                rr.append((rx * ss * cos(a), ry * ss * sin(a), z))
        rings.append(rr)
    ref = V((0, 0, wh + rh * .45))
    cc = [(C['th'], C['thD'], C['th'], C['thL']), (C['thD'], C['th'], C['thL'], C['th']), (C['th'], C['thL'], C['th'], C['thD'])]
    for k in range(3):
        p.loft(rings[k:k + 2], cc[k][0], colors=[cc[k][i % 4] for i in range(n)], ref=ref)
    top = (0, 0, wh + rh)
    if ridge:
        p.face(rings[3], C['thD'], flip_ref=ref)
    else:
        for i in range(n):
            p.face([rings[3][i], rings[3][(i + 1) % n], top], C['thD'] if i % 2 else C['th'], flip_ref=ref)
    for i in range(n):
        j = (i + 1) % n
        a, b = rings[0][i], rings[0][j]
        mid = ((a[0] + b[0]) / 2 * 1.03, (a[1] + b[1]) / 2 * 1.03, wh - .75 - (.15 if i % 2 else 0))
        p.face([a, b, mid], C['thD'] if i % 2 else C['th'], flip_ref=ref)
    if tip:
        p.beam((0, 0, wh + rh - .3), (.2, 0, wh + rh + tip), .12, C['woodD'], 3)
        p.frustum((.2, 0, wh + rh + tip - .2), .26, 0, .5, 3, C['woodD'], bottom=False)
    p.box((0, -ry * .96, 0), (door_w, .35, wh * .75), C['door'], bottom=False)
    p.box((0, -ry * .97, wh * .75), (door_w + .5, .4, .22), C['woodD'], bottom=False)


def choza_a(p):
    hut(p, 3.5, 3.5, 1.9, 5.5, n=12)


def choza_b(p):
    hut(p, 3.4, 3.4, 2.1, 5.2, n=12, door_w=1.2)


def choza_c(p):
    hut(p, 5.5, 3.0, 1.9, 4.8, n=12, ridge=True, door_w=1.3)


def choza_grande(p):
    hut(p, 6.0, 6.0, 2.4, 7.6, n=14, tip=1.8, door_w=1.8)
    p.box((0, -5.7, 0), (3.0, .3, .12), C['woodL'], bottom=False) if False else None


def cobertizo(p):
    p.box((0, 0, -.1), (6.0, 5.0, .3), C['woodL'], bottom=False, colors={'t': C['wood']})
    for sx in (-2.7, 2.7):
        for sy in (-2.2, 2.2):
            p.box((sx, sy, 0), (.4, .4, 3.4), C['woodD'], bottom=False)
    p.beam((-2.7, 0, 3.3), (2.7, 0, 3.3), .15, C['woodD'], 4)
    p.gable((0, 0, 3.2), 6.0, 5.0, 2.4, C['th'], C['thD'], strips=2, overhang=.5)
    p.box((1.2, 1.2, .2), (1.2, .8, .6), C['woodL'], bottom=False)


def muelle_selva(p):
    for i in range(16):
        p.box((0, i + .48, 1.1), (4.0, .86, .16), C['woodL'] if i % 2 else C['wood'], bottom=False)
    for yy in (.6, 4.1, 7.6, 11.1, 14.6):
        for sx in (-1.9, 1.9):
            p.frustum((sx, yy, -1.6), .24, .2, 3.2, 5, C['woodD'], bottom=False, tcolor=C['wood'])
    for sx in (-1.5, 1.5):
        p.box((sx, 8, .92), (.25, 16, .2), C['woodD'], bottom=False)
    for sx in (-1.9, 1.9):
        p.box((sx, 15.9, 1.25), (.22, .22, .7), C['woodD'], bottom=False)


def canoa_curiara(p, L=11.0, W=1.8, cargo=False, seed=0):
    ns = 7
    st = [-L / 2 + L * i / (ns - 1) for i in range(ns)]
    rings = []
    for x in st:
        u = x / (L / 2)
        w = W / 2 * max(.12, (1 - abs(u) ** 2.6) ** .6)
        h = .75 + .55 * abs(u) ** 2.2
        rings.append((x, w, h))
    cols = [C['woodD'], C['woodD'], C['wood'], C['wood'], C['woodL'], C['wood'], C['woodD'], C['woodD']]
    for k in range(ns - 1):
        a, b = rings[k], rings[k + 1]

        def sec(x, w, h):
            return [(x, -w, h), (x, -w * .94, h * .45), (x, 0, .02), (x, w * .94, h * .45), (x, w, h), (x, w * .72, h * .98), (x, 0, .3), (x, -w * .72, h * .98)]
        sa, sb = sec(*a), sec(*b)
        xm = (a[0] + b[0]) / 2
        for i in range(8):
            j = (i + 1) % 8
            ref = V((xm, 0, a[2] * .45)) if i < 4 else V((xm, 0, -4.0))
            p.face([sa[i], sa[j], sb[j], sb[i]], C['woodD'] if i in (0, 3) else (C['wood'] if i < 4 else C['woodL']), flip_ref=ref)
    for sgn in (-1, 1):
        x, w, h = rings[0] if sgn < 0 else rings[-1]
        p.face([(x, -w, h), (x, -w * .72, h * .98), (x, w * .72, h * .98), (x, w, h), (x, w * .6, h * .5), (x, -w * .6, h * .5)], C['wood'], flip_ref=V((x - sgn * 2, 0, h * .5)))
    for tx in (-1.2, 2.2) if not cargo else (-.8, 2.0):
        p.box((tx, 0, .75), (.3, W * .75, .1), C['woodL'], bottom=False)
    if not cargo:
        for (px, ang, pc) in ((.8, .25, C['woodL']), (-2.2, -.2, C['wood'])):
            p.beam((px - 1.3, -.2, .5), (px + 1.2, .25, .45), .07, C['woodD'], 3)
            p.face([(px + 1.2, .05, .47), (px + 1.9, .1, .46), (px + 1.9, .5, .44), (px + 1.2, .5, .46)], pc, up=True)
            p.face([(px + 1.2, .05, .43), (px + 1.2, .5, .43), (px + 1.9, .5, .41), (px + 1.9, .1, .43)], C['woodD'], flip_ref=V((px + 1.5, .3, 5)))
    else:
        for i, (x, y, r, c) in enumerate(((-1.8, .0, .75, C['cream']), (0.1, .05, .7, C['cassava']), (1.7, -.05, .6, C['th']))):
            p.ico((x, y, .55 + r * .5), r, c, sub=0, sc=(1.1, .8, .8), jitter=.15, seed=seed + i, tcolor=C['thL'], cut_below=.5)
        p.beam((-2.6, 0, 1.0), (2.6, 0, 1.0), .05, C['woodD'], 3)


def canoa_b(p):
    canoa_curiara(p, L=8.0, W=1.7, cargo=True, seed=7)


def fogata(p):
    rng = random.Random(9)
    for i in range(7):
        a = 2 * PI * i / 7
        p.ico((cos(a) * 1.5, sin(a) * 1.5, .25), .42 + .08 * rng.random(), C['rk'], sub=0, sc=(1, 1, .8), jitter=.18, seed=i, tcolor=C['rkL'])
    p.disc((0, 0, .08), 1.2, C['blk'], rings=1, segs=6)
    for i in range(4):
        a = 2 * PI * i / 4 + .4
        p.beam((cos(a) * 1.4, sin(a) * 1.4, .3), (cos(a) * .15, sin(a) * .15, .75), .14, C['woodD'] if i % 2 else C['wood'], 4)
    p.frustum((0, 0, .5), .6, 0, 1.7, 5, C['fire1'], bottom=False, ring_colors=[C['fire1'], C['fire3'], C['fire1']])
    p.frustum((.1, 0, .6), .38, 0, 1.3, 4, C['fire2'], bottom=False)
    p.frustum((-.4, .2, .5), .25, 0, .9, 3, C['fire2'], bottom=False)


def tendedero(p):
    for sy in (-.9, .9):
        for sx in (-2.5, 2.5):
            p.frustum((sx, sy, -.3), .24, .2, 3.7, 5, C['woodD'], bottom=False, tcolor=C['wood'])
        p.beam((-2.5, sy, 3.3), (2.5, sy, 3.3), .12, C['wood'], 4)
    p.beam((-2.5, -.9, 3.0), (-2.5, .9, 3.0), .1, C['woodD'], 3)
    p.beam((2.5, -.9, 3.0), (2.5, .9, 3.0), .1, C['woodD'], 3)
    for hi, (y, ca, cb) in enumerate(((-.0, C['hamA'], C['hamB']), (.0, C['hamC'], C['hamB']))):
        pass
    for y, ca, cb, zoff in ((-.45, C['hamA'], C['hamB'], 0), (.45, C['hamC'], C['hamB'], -.15)):
        xs = [-2.3 + 4.6 * i / 6 for i in range(7)]
        zs = [3.1 + zoff - 1.4 * (1 - (x / 2.3) ** 2) * 1.0 for x in xs]
        rows = [[(x, y - .5, z + .45), (x, y, z), (x, y + .5, z + .45)] for x, z in zip(xs, zs)]
        for k in range(6):
            for i in range(2):
                p.face([rows[k][i], rows[k][i + 1], rows[k + 1][i + 1], rows[k + 1][i]], ca if (k + i) % 2 == 0 else cb, flip_ref=V((0, y, -5)))
        p.beam((-2.5, y, 3.3), (-2.3, y, rows[0][1][2]), .03, C['woodD'], 3)
        p.beam((2.5, y, 3.3), (2.3, y, rows[-1][1][2]), .03, C['woodD'], 3)


def pila_lena(p):
    rng = random.Random(5)
    L = 2.8
    layout = [(-1.14, .38), (-.38, .38), (.38, .38), (1.14, .38), (-.76, 1.05), (0, 1.05), (.76, 1.05), (-.38, 1.72), (.38, 1.72), (0, 2.38)]
    for x, z in layout:
        r = .38
        ring0 = [(x + r * cos(2 * PI * i / 5 + .3), -L / 2, z + r * sin(2 * PI * i / 5 + .3)) for i in range(5)]
        ring1 = [(q[0], L / 2, q[2]) for q in ring0]
        bc = [C['woodD'], C['wood'], C['woodL'], C['wood'], C['woodD']]
        p.loft([ring0, ring1], C['cream'], colors=bc, caps=(True, True), ref=V((x, 0, z)))
    for sx in (-1.7, 1.7):
        p.beam((sx, -1.2, -.1), (sx, -1.2, 1.9), .1, C['woodD'], 3)
        p.beam((sx, 1.2, -.1), (sx, 1.2, 1.9), .1, C['woodD'], 3)


def cesta_yuca(p):
    p.frustum((0, 0, -.1), 1.2, 1.55, 1.6, 8, C['woodL'], top=False, bottom=True, ring_colors=[C['woodL'], C['wood']])
    p.disc((0, 0, 1.45), 1.45, C['woodD'], rings=1, segs=8)
    rng = random.Random(3)
    for i in range(6):
        a = 2 * PI * i / 6 + rng.random()
        rr = rng.uniform(.0, .7)
        c = (cos(a) * rr, sin(a) * rr, 1.55 + (i % 3) * .1)
        p.ico(c, .75, C['cassava'] if i % 2 else C['cream'], sub=0, sc=(1.0, .25, .25), jitter=.1, seed=i, tcolor=C['cream'])
    for i in range(5):
        a = 2.7 + i * .55
        p.ico((2.6 + cos(a) * .8, sin(a) * .8 - .2, .25), .75, C['cassava'] if i % 2 else C['cream'], sub=0, sc=(1.0, .26, .26), jitter=.1, seed=20 + i, tcolor=C['cream'])


# ───────────────────────── fauna ─────────────────────────
def macaw_fly(p, wing, tail_up, k):
    R, Y, B = C['red'], C['yellow'], C['blue']
    ctube(p, [(-.9, 0, -.05), (0, 0, 0), (.85, 0, .12)], (.2, .36, .28), n=5, cols=(R, R, C['redD'], R, R), cap_end=True, tip=.5)
    p.ico((1.2, 0, .32), .32, R, sub=0, seed=k, tcolor=R)
    p.face([(1.45, -.12, .46), (1.45, .12, .46), (1.95, 0, .22)], C['ivory'], flip_ref=V((1.5, 0, 5)))
    p.face([(1.45, -.12, .4), (1.45, .12, .4), (1.8, 0, .12)], C['blk'], flip_ref=V((1.5, 0, -5)))
    # tail
    tz = -.3 + tail_up
    p.face([(-.8, -.22, 0), (-.8, .22, 0), (-3.2, .1, tz), (-3.2, -.1, tz)], B, up=True)
    p.face([(-.8, -.22, 0), (-3.0, -.1, tz), (-2.7, -.5, tz - .05), (-.7, -.34, -.02)], R, up=True)
    p.face([(-.8, .22, 0), (-.7, .34, -.02), (-2.7, .5, tz - .05), (-3.0, .1, tz)], R, up=True)
    p.face([(-3.2, .1, tz), (-3.0, -.1, tz), (-3.5, 0, tz + .02)], Y, up=True)
    for sy in (-1, 1):
        def W(s, f):
            lead = .55 - .15 * s if f == 0 else -.45 - .3 * s
            return (lead, sy * s, .1 + s * wing * .6)
        p.face([W(.28, 0), W(.28, 1), W(1.4, 1), W(1.4, 0)], R, up=True)
        p.face([W(1.4, 0), W(1.4, 1), W(2.3, 1), W(2.3, 0)], Y, up=True)
        p.face([W(2.3, 0), W(2.3, 1), W(3.1, 1), W(3.1, 0)], B, up=True)
        p.face([W(3.1, 0), W(3.1, 1), (-1.1, sy * 3.4, .1 + 3.4 * wing * .6)], C['blueD'], up=True)


def guacamaya_vuelo_a(p):
    at(p, macaw_fly, (0, 0, 2.0), 0.0, .9, .15, 1)


def guacamaya_vuelo_b(p):
    at(p, macaw_fly, (0, 0, 2.0), 0.0, .25, 0.0, 2)


def guacamaya_vuelo_c(p):
    at(p, macaw_fly, (0, 0, 2.0), 0.0, -.5, -.1, 3)


def guacamaya_posada(p):
    R, Y, B = C['red'], C['yellow'], C['blue']
    ctube(p, [(0, 0, -.3), (0, 0, 1.0), (.1, 0, 1.4)], (.38, .3, .24), n=5, cols=(C['T2'], C['T1']), cap_end=False)
    p.beam((0, -1.3, 1.45), (0, 1.3, 1.45), .2, C['T1'], 5)
    ctube(p, [(-.3, 0, 1.9), (-.05, 0, 2.5), (.3, 0, 3.2)], (.3, .45, .38), n=6, cols=(R, R, C['redD'], R, R, R), cap_end=True, tip=.4)
    p.ico((.55, 0, 3.55), .38, R, sub=0, seed=3, tcolor=R)
    p.face([(.78, -.13, 3.68), (.78, .13, 3.68), (1.2, 0, 3.4)], C['ivory'], flip_ref=V((1, 0, 9)))
    p.face([(.78, -.13, 3.5), (.78, .13, 3.5), (1.05, 0, 3.22)], C['blk'], flip_ref=V((1, 0, -9)))
    for sy in (-1, 1):
        p.face([(.15, sy * .42, 3.0), (-.2, sy * .44, 3.0), (-.9, sy * .3, 1.9), (-.5, sy * .34, 1.8)], B, flip_ref=V((0, sy * -4, 2.5)))
        p.face([(.0, sy * .43, 2.7), (-.55, sy * .35, 2.35), (-.35, sy * .36, 2.1)], Y, flip_ref=V((0, sy * -4, 2.5)))
    p.face([(-.4, -.2, 2.0), (-.4, .2, 2.0), (-1.4, .12, .2), (-1.4, -.12, .2)], R, up=True)
    p.face([(-1.4, .12, .2), (-1.4, -.12, .2), (-1.55, 0, -.1)], B, up=True)


def tucan(p):
    ctube(p, [(0, 0, -.3), (0, 0, .7), (.2, 0, 1.0)], (.34, .28, .22), n=5, cols=(C['T2'], C['T1']), cap_end=False)
    p.beam((0, -1.0, .95), (0, 1.0, .95), .17, C['T1'], 5)
    ctube(p, [(-.2, 0, 1.3), (0, 0, 1.8), (.25, 0, 2.3)], (.28, .42, .34), n=6, cols=(C['blk'],), cap_end=True, tip=.4)
    p.ico((.35, 0, 2.05), .34, C['yellow'], sub=0, sc=(.7, 1.1, .8), jitter=.05, seed=2, tcolor=C['w1'])
    p.ico((.5, 0, 2.55), .33, C['blk'], sub=0, seed=3, tcolor=C['blk'])
    p.ico((1.05, 0, 2.45), 1.0, C['orange'], sub=0, sc=(1.0, .28, .36), jitter=.04, seed=5, bands=lambda zc, rn: C['yellow'] if zc > .2 else C['orange'])
    p.ico((1.9, 0, 2.38), .3, C['blk'], sub=0, sc=(1.0, .7, .8), seed=6, tcolor=C['blk'])
    p.face([(-.3, -.2, 1.5), (-.3, .2, 1.5), (-1.0, .14, .2), (-1.0, -.14, .2)], C['blk'], up=True)
    p.ico((-.45, 0, 1.4), .24, C['red'], sub=0, seed=8, tcolor=C['red'])
    for sy in (-1, 1):
        p.face([(.1, sy * .38, 2.0), (-.25, sy * .4, 2.0), (-.7, sy * .28, 1.2), (-.4, sy * .3, 1.1)], C['blk'], flip_ref=V((0, sy * -4, 1.6)))


# ───────────────────────── extras ─────────────────────────
def puente_cuerdas(p):
    Lh = 12.0

    def zd(x):
        return 6.0 - 1.2 * (1 - (x / Lh) ** 2)
    n = 24
    for i in range(n):
        x0 = -Lh + i + .06
        x1 = -Lh + i + .94
        z0, z1 = zd(x0), zd(x1)
        col = C['woodL'] if i % 2 else C['wood']
        for sy, ex in ((-2.0, 0), ):
            pass
        top = [(x0, -2.0, z0), (x1, -2.0, z1), (x1, 2.0, z1), (x0, 2.0, z0)]
        p.face(top, col, up=True)
        p.face([(x0, -2.0, z0), (x1, -2.0, z1), (x1, -2.0, z1 - .16), (x0, -2.0, z0 - .16)], C['woodD'], flip_ref=V((0, 5, 0)) and V((0.5 * (x0 + x1), 5, z0)))
        p.face([(x0, 2.0, z0), (x1, 2.0, z1), (x1, 2.0, z1 - .16), (x0, 2.0, z0 - .16)], C['woodD'], flip_ref=V((0.5 * (x0 + x1), -5, z0)))
    for sy in (-1.95, 1.95):
        pts = [(-Lh + 3 * k, sy, zd(-Lh + 3 * k) + 2.3) for k in range(9)]
        for a, b in zip(pts[:-1], pts[1:]):
            p.beam(a, b, .08, C['T1'], 3)
        for k in range(1, 8):
            x = -Lh + 3 * k
            p.beam((x, sy, zd(x) - .1), (x, sy, zd(x) + 2.3), .06, C['woodD'], 3)
        low = [(-Lh + 4 * k, sy * .8, zd(-Lh + 4 * k) - .35) for k in range(7)]
        for a, b in zip(low[:-1], low[1:]):
            p.beam(a, b, .07, C['woodD'], 3)
    for sx in (-1, 1):
        x = sx * (Lh + .55)
        p.box((sx * (Lh + 1.4), 0, -.3), (2.0, 4.6, 6.0), C['mud'], colors={'t': C['woodD']}, bottom=False)
        for sy in (-2.1, 2.1):
            p.frustum((x, sy, -.3), .3, .26, 8.8, 5, C['woodD'], bottom=False, tcolor=C['wood'])
        p.beam((x, -2.1, 8.0), (x, 2.1, 8.0), .12, C['wood'], 3)


def liana(p, k):
    rng = random.Random(600 + k)
    strands = [(-1.0, 10.0, .2), (-.1, 9.0, .0), (.9, 10.0, .35), (1.8, 7.6, .1)] if k == 0 else [(-1.4, 8.0, .0), (-.4, 10.0, .3), (.6, 9.2, .1), (1.6, 10.0, .2), (2.3, 6.5, .3)]
    for si, (x0, zt, ph) in enumerate(strands):
        pts = [(x0 + .35 * sin(i * 1.1 + ph * 9), .05 * sin(i + si), 10.0 - i * (zt / 6)) for i in range(7)]
        for a, b in zip(pts[:-1], pts[1:]):
            p.face([(a[0] - .09, a[1], a[2]), (a[0] + .09, a[1], a[2]), (b[0] + .09, b[1], b[2]), (b[0] - .09, b[1], b[2])], C['L3'] if si % 2 else C['L6'], flip_ref=V((a[0], 60, a[2])))
        for i in (1, 3, 5):
            s = 1 if (i + si) % 2 else -1
            a = pts[i]
            lc = C['L4'] if i % 2 else C['L2']
            p.face([(a[0], a[1], a[2]), (a[0] + s * .6, a[1], a[2] - .15), (a[0] + s * .3, a[1], a[2] - .6)], lc, flip_ref=V((a[0], 60, a[2])))


def liana_a(p):
    liana(p, 0)


def liana_b(p):
    liana(p, 1)


# ───────────────────────── build ─────────────────────────
ROWS = [
    ('arboles', 17, 20, [('arbol_selva_a', arbol_selva_a, False), ('arbol_selva_b', arbol_selva_b, False), ('arbol_selva_c', arbol_selva_c, False), ('arbol_selva_alto', arbol_selva_alto, False)]),
    ('palmas', 10, 16, [('palma_selva_a', palma_selva_a, False), ('palma_selva_b', palma_selva_b, False), ('platanillo_a', platanillo_a, False), ('platanillo_b', platanillo_b, False),
                        ('helecho_a', helecho_a, False), ('helecho_b', helecho_b, False), ('arbusto_selva_a', arbusto_selva_a, False), ('arbusto_selva_b', arbusto_selva_b, False)]),
    ('cima', 8, 8, [('arbolito_cima_a', arbolito_cima_a, False), ('arbolito_cima_b', arbolito_cima_b, False), ('arbusto_cima_a', arbusto_cima_a, False), ('arbusto_cima_b', arbusto_cima_b, False),
                    ('roca_cima_a', roca_cima_a, False), ('roca_cima_b', roca_cima_b, False)]),
    ('rocas', 11, 14, [('roca_selva_01', roca_selva_01, False), ('roca_selva_02', roca_selva_02, False), ('roca_selva_03', roca_selva_03, False), ('roca_selva_04', roca_selva_04, False),
                       ('roca_rio_a', roca_rio_a, False), ('roca_rio_b', roca_rio_b, False), ('roca_rio_c', roca_rio_c, False)]),
    ('cliffs', 20, 14, [('cima_roca_a', cima_roca_a, False), ('cima_roca_b', cima_roca_b, False), ('cima_roca_c', cima_roca_c, False)]),
    ('cascadas', 26, 32, [('cascada_alta', cascada_alta, False), ('cascada_media', cascada_media, False), ('cascada_ancha', cascada_ancha, False)]),
    ('agua', 18, 14, [('rapido_a', rapido_a, False), ('rapido_b', rapido_b, False), ('espuma_pozo', espuma_pozo, False)]),
    ('aldea', 14, 16, [('choza_a', choza_a, True), ('choza_b', choza_b, True), ('choza_c', choza_c, True), ('choza_grande', choza_grande, True), ('cobertizo', cobertizo, True)]),
    ('varios', 12, 30, [('canoa_curiara', canoa_curiara, False), ('canoa_b', canoa_b, False), ('fogata', fogata, False), ('tendedero', tendedero, False), ('pila_lena', pila_lena, False),
                        ('cesta_yuca', cesta_yuca, False), ('liana_a', liana_a, False), ('liana_b', liana_b, False)]),
    ('muelle', 22, 22, [('muelle_selva', muelle_selva, False), ('puente_cuerdas', puente_cuerdas, False)]),
    ('fauna', 12, 12, [('guacamaya_vuelo_a', guacamaya_vuelo_a, False), ('guacamaya_vuelo_b', guacamaya_vuelo_b, False), ('guacamaya_vuelo_c', guacamaya_vuelo_c, False),
                       ('guacamaya_posada', guacamaya_posada, False), ('tucan', tucan, False)]),
]
BUDGET = {'arbol': 520, 'palma': 200, 'platanillo': 150, 'helecho': 150, 'arbusto': 250, 'arbolito': 150, 'roca': 350, 'cima_roca': 400, 'cascada_alta': 450,
          'cascada_media': 400, 'cascada_ancha': 500, 'rapido': 250, 'espuma': 250, 'choza': 300, 'cobertizo': 250, 'muelle': 400, 'canoa': 250, 'fogata': 250,
          'tendedero': 200, 'pila': 200, 'cesta': 200, 'guacamaya': 150, 'tucan': 200, 'puente': 500, 'liana': 150}


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
            if c in WATER:
                f[p.fsh] = .98
            elif fixed and abs(n.z) < .35:
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
    best = None
    for k, v in BUDGET.items():
        if nm.startswith(k) and (best is None or len(k) > len(best[0])):
            best = (k, v)
    return best[1] if best else 250


NOTES = (
    'GLB: `assets/models/canaima_kit.glb` (build: `tools/blender/prop_canaima_kit.py`). Gran Sabana / Canaima rainforest, tepui and Pemon village kit. '
    '1 unit = 1 map unit. Each node = one instanceable piece, origin = base centre, z=0 = ground (bases buried ~0.3-0.8 where they meet terrain). Front faces -Y. '
    'Fauna (guacamaya_*, tucan) face +X locally; `guacamaya_vuelo_*` are already lifted so the body centre is at z=2 (min z ~1.1, max ~3.9; wingspan ~6.8, tail trails to x=-3.5) so the baked AO is not sunk into the ground: place them at the desired flight height minus 2.\n\n'
    'Orientation / placement notes:\n'
    '- `cascada_alta`, `cascada_media`: origin = centre of the foam pool (disc r=7 / r=5 at z=0.1). The fall climbs along +Y: sheet top at y=+2.85 (the cliff face should be the plane y=+3), '
    'bulging toward -Y by ~2.6 / 2.0 at the bottom (bottom edge at y~0.25). Top z = 40 / 18. Lip rocks at the top sit at y=+3.5 (inside/on the cliff edge). Water sheets are single faces facing -Y (material is double sided).\n'
    '- `cascada_ancha`: 30 wide (x) x ~12.5 deep (y -5.8..+7.4) x 10 high. Back (+Y) is the highest tier (z=10), then ledges at z=6 and z=2.6 stepping toward -Y, 3 white sheets at x=-9.5, 0, +9.5, '
    'foam patches at y~-5.9, z=0.3. Sits on the river: front (-Y) is the downstream side. Rock tiers include their own dark rock.\n'
    '- `rapido_*`, `espuma_pozo`: flat at z~0.3 (rapids 14x8, 10x6; foam disc r=6). Place at the water surface level (shift z so the foam is just above the water).\n'
    '- `muelle_selva`: runs along +Y from the origin (shore end at y=0, tip at y=16), 4 wide (x -2..2). Deck top z~1.25, posts reach down to z=-1.6 (into the water).\n'
    '- `canoa_curiara` (11 long) / `canoa_b` (8 long): long axis = +X, origin = hull centre, keel at z~0 (hull height ~0.75-1.3). Bow/stern are symmetric.\n'
    '- `puente_cuerdas`: spans x -12..+12 (deck 24 long x 4 wide, y -2..2), deck top z=6 at the ends (x=+-12) and 4.8 at the middle (sag), rails ~2.3 above the deck. '
    'End abutments are mud blocks (x +-12.4..+14.4, y +-2.3, z -0.3..5.7) plus end posts up to z~8.5; origin z=0 = ground under the end blocks, so it needs terrain/cliffs at z~0..6 on both ends and the middle is open air.\n'
    '- `cima_roca_*`: tepui basalt-like column outcrops, 10-14 wide x ~6 deep x 17-20 tall; the tall columns are on +Y (cliff side), shorter ones toward -Y. Moss-topped.\n'
    '- `liana_*`: flat vine ribbons in the XZ plane (hang flat against a cliff facing -Y), bottom at z~0..3, top attach at z=10 (strands 6.5-10 long).\n'
    '- `choza_*`: door on -Y. `choza_c` ridge along X. `choza_grande` has a ridge tip pole at z~11.8.\n'
)


def write_manifest(parts):
    lines = ['# canaima_kit manifest', '', NOTES, '', '| Part | tris | budget | footprint (x y) | height (z max) | z min |', '|---|---|---|---|---|---|']
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
    path = os.path.join(lib.MODEL_DIR, 'canaima_kit_manifest.md')
    os.makedirs(lib.MODEL_DIR, exist_ok=True)
    with open(path, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('CANAIMA_TOTAL', tot, 'OVER', over)
    for nm, p in parts.items():
        t, w, d, h, zmin = stats(p)
        print('PART %-18s tris=%4d  %5.1f x %5.1f  h=%5.1f zmin=%5.1f' % (nm, t, w, d, h, zmin))


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
