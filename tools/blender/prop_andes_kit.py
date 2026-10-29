"""andes_kit: instanceable low-poly kit for the Venezuelan Andes (Merida, paramo) zone of LA FIESTA.
Each Part = one piece; origin = base centre (bases buried 0.5), front faces -Y. Parts sit on a grid, rows by category."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import Vector as V

NAME = 'andes_kit'
GROUND = 0x8fae52
PREVIEW = dict(az=0, pitch=62, fit=0.95, size=2000)
AO_DIST = 10

C = dict(
    white=0xfbf0d6, cream=0xeedfb6, ochre=0xe6bd5a, salmon=0xe8ab8a, sage=0xd2cfa0, sky=0xa9c4d8,
    teja=0xc8603a, tejaL=0xe07e48, tejaD=0x9a4229,
    wood=0x7b5232, woodD=0x573820, woodL=0xb0824e, door=0x6a4429, tan=0xcfa874,
    glass=0x2f4660, sh_teal=0x3f8a8a, sh_green=0x3d7a46, sh_red=0x9a3d2a, sh_blue=0x3d62a0,
    base=0x9d9382, plaza=0xd9cfb6, plazaD=0xc4b896, plazaL=0xe6dfca,
    stone=0xa59d8c, stoneL=0xc4bca8, stoneD=0x857d6d,
    rock=0x8d7f70, rockL=0xa99a88, rockD=0x6d6154, moss=0x7f9a45, mossL=0x9fba52, mossD=0x5f7f3a,
    gold=0xe8b83a, goldL=0xf7d65e,
    pine1=0x1f5030, pine2=0x2a6a38, pine3=0x3a7d41,
    leaf1=0x4a8a38, leaf2=0x66a845, leaf3=0x8cc455, leafD=0x336c30,
    ol1=0x7b9638, ol2=0x9db441, ol3=0xc2c657,
    fr1=0x9fb58a, fr2=0xc1d0a6, fr3=0xe0e9cc, frD=0x7f9a6e, frT=0x6f5638, frS=0xa58c58,
    grass1=0xcdb447, grass2=0xa8a83f, grass3=0x7f9f3e, grass4=0xe2cc62,
    turq=0x36c0d2, turqD=0x2a9bc4, turqL=0x72dde2, foam=0xf3fcff, fall=0xdaf5fa,
    red=0xd02f2f, redD=0x9e2222, steel=0x4a505c, dirt=0xb9976a, dirtD=0x9c7c52,
    hay=0xd9b95a, hayD=0xb08c3c, soil=0x7a5a3c, crop1=0x74b43c, crop2=0x4f9235, crop3=0xdcbc3e, crop4=0xc9a535,
)

INFO = {}
_rng = random.Random(7)


def Pt(name):
    return lib.Part(name, ao=0.0)


def Q(p, pts, col, ref=None, up=False):
    q = []
    for a in pts:
        if not q or (V(a) - V(q[-1])).length > 1e-5:
            q.append(a)
    while len(q) > 1 and (V(q[0]) - V(q[-1])).length <= 1e-5:
        q.pop()
    if len(q) < 3:
        return
    p.face(q, col, flip_ref=V(ref) if ref is not None else None, up=up)


# ───────────────────────── walls, openings ─────────────────────────
def wf(p, g, side, u0, u1, z0, z1, col, off=0.02):
    cx, cy, hw, hd = g
    if side == 'S':
        y = cy - hd - off
        pts = [(cx + u0, y, z0), (cx + u1, y, z0), (cx + u1, y, z1), (cx + u0, y, z1)]
        ref = (cx + (u0 + u1) / 2, y - 6, (z0 + z1) / 2)
    elif side == 'N':
        y = cy + hd + off
        pts = [(cx + u0, y, z0), (cx + u1, y, z0), (cx + u1, y, z1), (cx + u0, y, z1)]
        ref = (cx + (u0 + u1) / 2, y + 6, (z0 + z1) / 2)
    elif side == 'E':
        x = cx + hw + off
        pts = [(x, cy + u0, z0), (x, cy + u1, z0), (x, cy + u1, z1), (x, cy + u0, z1)]
        ref = (x + 6, cy + (u0 + u1) / 2, (z0 + z1) / 2)
    else:
        x = cx - hw - off
        pts = [(x, cy + u0, z0), (x, cy + u1, z0), (x, cy + u1, z1), (x, cy + u0, z1)]
        ref = (x - 6, cy + (u0 + u1) / 2, (z0 + z1) / 2)
    Q(p, pts, col, ref)


def win(p, g, side, u, z, w=1.1, h=1.5, sh='sh_teal', trim='white', shut=True):
    wf(p, g, side, u - w / 2 - .13, u + w / 2 + .13, z - .13, z + h + .13, C[trim], .03)
    wf(p, g, side, u - w / 2, u + w / 2, z, z + h, C['glass'], .06)
    if shut:
        wf(p, g, side, u - w / 2 - .62, u - w / 2 - .12, z - .05, z + h + .05, C[sh], .08)
        wf(p, g, side, u + w / 2 + .12, u + w / 2 + .62, z - .05, z + h + .05, C[sh], .08)


def door(p, g, side, u, z0, w=1.5, h=2.5, trim='stoneL', col='door', step=True):
    wf(p, g, side, u - w / 2 - .2, u + w / 2 + .2, z0, z0 + h + .22, C[trim], .03)
    wf(p, g, side, u - w / 2, u + w / 2, z0, z0 + h, C[col], .06)
    if step and side == 'S':
        cx, cy, hw, hd = g
        p.box((cx + u, cy - hd - .5, z0 - .3), (w + .9, 1.0, .3), C['stone'], bottom=False)


def chimney(p, x, y, z, h=1.8):
    p.box((x, y, z), (1.0, 1.0, h), C['stone'], bottom=False, top=False)
    p.box((x, y, z + h), (1.35, 1.35, .22), C['stoneD'], bottom=False)


# ───────────────────────── roofs ─────────────────────────
def gable2(p, cx, cy, W, D, z, h, wallc, ridge_x=True, strips=3, over=.45, rake=.35, ends=(True, True), t1='teja', t2='tejaL'):
    lu, lv = (W, D) if ridge_x else (D, W)
    hu, hv = lu / 2 + rake, lv / 2 + over

    def T(u, v, zz):
        return (cx + u, cy + v, z + zz) if ridge_x else (cx + v, cy + u, z + zz)
    ref = T(0, 0, -2)
    for s in (-1, 1):
        for k in range(strips):
            t0, t1_ = k / strips, (k + 1) / strips
            v0, v1 = s * hv * (1 - t0), s * hv * (1 - t1_)
            col = C[t1] if k % 2 == 0 else C[t2]
            Q(p, [T(-hu, v0, h * t0), T(hu, v0, h * t0), T(hu, v1, h * t1_), T(-hu, v1, h * t1_)], col, ref)
    zw = h * over / hv
    for i, s in enumerate((-1, 1)):
        if ends[i]:
            u = s * lu / 2
            Q(p, [T(u, -lv / 2, 0), T(u, lv / 2, 0), T(u, lv / 2, zw), T(u, 0, h), T(u, -lv / 2, zw)], wallc, ref)
    p.beam(T(-hu, 0, h + .05), T(hu, 0, h + .05), .2, C['tejaD'], 3)


def hip2(p, cx, cy, W, D, z, h, strips=3, over=.45, t1='teja', t2='tejaL'):
    ridge_x = W >= D
    lu, lv = (W, D) if ridge_x else (D, W)
    hu, hv = lu / 2 + over, lv / 2 + over
    r = max(hu - hv, 0.0)

    def T(u, v, zz):
        return (cx + u, cy + v, z + zz) if ridge_x else (cx + v, cy + u, z + zz)
    ref = T(0, 0, -2)
    for k in range(strips):
        a, b = k / strips, (k + 1) / strips
        ua, ub = hu - (hu - r) * a, hu - (hu - r) * b
        va, vb = hv * (1 - a), hv * (1 - b)
        col = C[t1] if k % 2 == 0 else C[t2]
        for s in (-1, 1):
            Q(p, [T(-ua, s * va, h * a), T(ua, s * va, h * a), T(ub, s * vb, h * b), T(-ub, s * vb, h * b)], col, ref)
            Q(p, [T(s * ua, -va, h * a), T(s * ua, va, h * a), T(s * ub, vb, h * b), T(s * ub, -vb, h * b)], col, ref)
    if r > 0:
        p.beam(T(-r, 0, h + .05), T(r, 0, h + .05), .2, C['tejaD'], 3)


def lean(p, x0, x1, y0, y1, z0, z1, strips=2):
    ref = ((x0 + x1) / 2, (y0 + y1) / 2, min(z0, z1) - 3)
    for k in range(strips):
        a, b = k / strips, (k + 1) / strips
        ya, yb = y0 + (y1 - y0) * a, y0 + (y1 - y0) * b
        za, zb = z0 + (z1 - z0) * a, z0 + (z1 - z0) * b
        Q(p, [(x0, ya, za), (x1, ya, za), (x1, yb, zb), (x0, yb, zb)], C['teja'] if k % 2 == 0 else C['tejaL'], ref)


def balcony(p, g, u0, u1, z, depth=1.5, posts_to=None):
    cx, cy, hw, hd = g
    uc, w = (u0 + u1) / 2, u1 - u0
    y0 = cy - hd
    p.box((cx + uc, y0 - depth / 2 + .1, z - .28), (w, depth, .28), C['wood'], bottom=True)
    yf = y0 - depth + .1
    n = 6
    for i in range(n):
        a, b = u0 + w * i / n, u0 + w * (i + 1) / n
        Q(p, [(cx + a, yf, z), (cx + b, yf, z), (cx + b, yf, z + .95), (cx + a, yf, z + .95)], C['woodL'] if i % 2 == 0 else C['wood'], (cx + uc, yf - 5, z + .5))
    p.beam((cx + u0, yf, z + 1.0), (cx + u1, yf, z + 1.0), .09, C['woodD'], 3)
    for s, u in ((-1, u0), (1, u1)):
        Q(p, [(cx + u, yf, z), (cx + u, y0, z), (cx + u, y0, z + .95), (cx + u, yf, z + .95)], C['wood'], (cx + u + s * 5, yf / 2 + y0 / 2, z + .5))
    if posts_to:
        for u in (u0 + .15, u1 - .15):
            p.beam((cx + u, yf + .1, z), (cx + u, yf + .1, posts_to), .1, C['woodD'], 3)


# ───────────────────────── houses ─────────────────────────
def casa(name, W, D, fl=1, wall='white', roof='gable', sh='sh_teal', balc=False, porch=False, chim=True, upper=None, hs=3.1, attic=False):
    p = Pt(name)
    hw, hd = W / 2, D / 2
    g = (0, 0, hw, hd)
    plh = .7
    p.box((0, 0, -.5), (W + .5, D + .5, plh + .5), C['base'], bottom=False)
    zt = plh + hs * fl
    if fl == 2 and upper:
        p.box((0, 0, plh), (W, D, hs), C[wall], bottom=False, top=False)
        p.box((0, 0, plh + hs), (W, D, hs), C[upper], bottom=False, top=False)
    else:
        p.box((0, 0, plh), (W, D, zt - plh), C[wall], bottom=False, top=False)
    lv = {'gable': D, 'gable_y': W, 'hip': min(W, D)}[roof]
    h = (lv / 2 + .5) * .6
    wallc = C[upper] if (fl == 2 and upper) else C[wall]
    if roof == 'gable':
        gable2(p, 0, 0, W, D, zt, h, wallc, True)
    elif roof == 'gable_y':
        gable2(p, 0, 0, W, D, zt, h, wallc, False)
    else:
        hip2(p, 0, 0, W, D, zt, h)
    xs = [-W * .31, W * .31] if W >= 8 else [-W * .3, W * .3]
    z1 = plh + .85
    door(p, g, 'S', 0, plh, trim='stoneL')
    for u in xs:
        win(p, g, 'S', u, z1, sh=sh)
    if fl == 2:
        z2 = plh + hs + .75
        wf(p, g, 'S', -hw, hw, plh + hs - .12, plh + hs + .12, C['white'], .04)
        for u in (xs[0], xs[1]):
            win(p, g, 'S', u, z2, sh=sh)
        if balc:
            wf(p, g, 'S', -.75, .75, plh + hs, plh + hs + 2.3, C['door'], .06)
            balcony(p, g, -hw * .62, hw * .62, plh + hs, posts_to=zt - .3)
        else:
            win(p, g, 'S', 0, z2, sh=sh)
    for s in ('E', 'W'):
        win(p, g, s, 0, z1, sh=sh, shut=False)
        if fl == 2:
            win(p, g, s, 0, plh + hs + .75, sh=sh, shut=False)
    if attic:
        win(p, g, 'S', 0, zt + .35, w=.9, h=.9, sh=sh, shut=False)
    if porch:
        pd = 2.4
        lean(p, -hw - .2, hw + .2, -hd - .1, -hd - pd - .3, zt - .55, zt - 1.55)
        for u in (-hw + .4, hw - .4):
            p.beam((u, -hd - pd + .1, 0), (u, -hd - pd + .1, zt - 1.55), .13, C['woodD'], 3)
    if chim:
        chimney(p, hw * .45, 0 if roof != 'hip' else 0, zt + h * .55, 1.5)
    INFO[name] = p
    return p


def casa_L(name, wall, sh, mirror=False, porch=False, roofy='gable', wing_fl=1):
    """Main block 12x6 (ridge X) + 6x10 wing at the front (ridge Y). Footprint 12x10."""
    p = Pt(name)
    m = -1 if mirror else 1
    plh, hs = .7, 3.1
    zt = plh + hs
    A = (0, 2, 6, 3)   # cx, cy, hw, hd
    B = (-3 * m, 0, 3, 5)
    p.box((0, 2, -.5), (12.5, 6.5, plh + .5), C['base'], bottom=False)
    p.box((-3 * m, 0, -.5), (6.5, 10.5, plh + .5), C['base'], bottom=False)
    p.box((0, 2, plh), (12, 6, hs), C[wall], bottom=False, top=False)
    p.box((-3 * m, 0, plh), (6, 10, hs), C[wall], bottom=False, top=False)
    h = (3 + .5) * .6
    # main roof: ridge X from the wing ridge to the far end
    x0, x1 = -3 * m, 6 * m
    gable2(p, (x0 + x1) / 2, 2, 9, 6, zt, h, C[wall], True, ends=(False, True) if m == 1 else (True, False))
    gable2(p, -3 * m, 0, 6, 10, zt, h, C[wall], False)
    # openings: wing front (S), main front on the inner side, side walls
    gB = (-3 * m, 0, 3, 5)
    gA = (0, 2, 6, 3)
    door(p, gB, 'S', 0, plh)
    win(p, gB, 'S', -1.9 * m * 0 + (-1.55), plh + .9, w=.9, sh=sh, shut=False) if False else None
    win(p, gB, 'N', 0, plh + .85, sh=sh, shut=False)
    win(p, gB, 'W' if m == 1 else 'E', -1.2, plh + .85, sh=sh)
    win(p, gB, 'W' if m == 1 else 'E', 1.8, plh + .85, sh=sh)
    inner = 'E' if m == 1 else 'W'
    win(p, gB, inner, -3.2, plh + .85, sh=sh)
    # main block, front face beyond the wing (S side at y=-1)
    far = [(3.1, 9.0)]
    for u in (-2.0, 2.0, 4.6):
        uu = u * m
        if 3.6 < abs(uu) + .1 or abs(uu) > 3.6:
            win(p, gA, 'S', uu, plh + .85, sh=sh)
    win(p, gA, 'N', -3.5, plh + .85, sh=sh)
    win(p, gA, 'N', 3.5, plh + .85, sh=sh)
    win(p, gA, 'N', 0, plh + .85, sh=sh)
    win(p, gA, 'E' if m == 1 else 'W', 0, plh + .85, sh=sh, shut=False)
    # porch in the inner corner
    if porch:
        xa, xb = (0, 6) if m == 1 else (-6, 0)
        lean(p, xa, xb, -1.1, -3.4, zt - .5, zt - 1.5)
        for x in (xb - .4 * m, xa + .4 * m) if False else (xb - .4 if m == 1 else xa + .4, (xa + xb) / 2):
            p.beam((x, -3.3, 0), (x, -3.3, zt - 1.5), .13, C['woodD'], 3)
    chimney(p, 3.5 * m, 2, zt + h * .55, 1.5)
    INFO[name] = p
    return p


def casa_alta(name):
    """Tall narrow timber-and-adobe house, 7x7, steep gable facing front."""
    p = Pt(name)
    plh, hs = .7, 3.0
    g = (0, 0, 3.5, 3.5)
    p.box((0, 0, -.5), (7.5, 7.5, plh + .5), C['base'], bottom=False)
    p.box((0, 0, plh), (7, 7, hs), C['white'], bottom=False, top=False)
    p.box((0, 0, plh + hs), (7.4, 7.4, hs), C['tan'], bottom=False, top=False)
    zt = plh + 2 * hs
    h = 4.3
    gable2(p, 0, 0, 7.4, 7.4, zt, h, C['tan'], False, strips=4, over=.55, rake=.5)
    # timber framing on upper floor front
    for u in (-3.6, -1.2, 1.2, 3.6):
        wf(p, g, 'S', u - .13, u + .13, plh + hs, zt, C['woodD'], .26)
    wf(p, g, 'S', -3.7, 3.7, plh + hs - .1, plh + hs + .2, C['woodD'], .26)
    wf(p, g, 'S', -3.7, 3.7, zt - .3, zt, C['woodD'], .26)
    door(p, g, 'S', 0, plh, trim='stoneL')
    win(p, g, 'S', -2.1, plh + .9, sh='sh_green', w=.9)
    win(p, g, 'S', 2.1, plh + .9, sh='sh_green', w=.9)
    win(p, g, 'S', -2.4, plh + hs + .7, sh='sh_green', w=.9)
    win(p, g, 'S', 2.4, plh + hs + .7, sh='sh_green', w=.9)
    balcony(p, g, -1.3, 1.3, plh + hs, depth=1.2, posts_to=None)
    wf(p, g, 'S', -.6, .6, plh + hs, plh + hs + 2.1, C['door'], .3)
    win(p, g, 'S', 0, zt + 1.0, w=.9, h=1.0, sh='sh_green', shut=False)
    for s in ('E', 'W'):
        win(p, g, s, 0, plh + .9, sh='sh_green', shut=False)
        win(p, g, s, 0, plh + hs + .8, sh='sh_green', shut=False)
    chimney(p, 2.2, 1.5, zt + 1.0, 1.6)
    INFO[name] = p
    return p


# ───────────────────────── stones & rocks ─────────────────────────
def stone(p, c, sx, sy, sz, seed, tone=None, rz=0.0, moss=0.0):
    rng = random.Random(seed)
    cx, cy, cz = c
    co, si = math.cos(rz), math.sin(rz)
    tones = tone or (C['stone'], C['stoneL'], C['stoneD'])

    def ring(s, z, j):
        pts = []
        for (ux, uy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            x = ux * sx / 2 * s * (1 + (rng.random() - .5) * j)
            y = uy * sy / 2 * s * (1 + (rng.random() - .5) * j)
            pts.append((cx + x * co - y * si, cy + x * si + y * co, cz + z))
        return pts
    r0, r1, r2 = ring(1.02, 0, .2), ring(1.0, sz * .8, .25), ring(.8, sz, .3)
    ref = (cx, cy, cz + sz * .4)
    col = rng.choice(tones)
    for i in range(4):
        j = (i + 1) % 4
        c1 = col if i % 2 == 0 else rng.choice(tones)
        Q(p, [r0[i], r0[j], r1[j], r1[i]], c1, ref)
    top = C['mossL'] if rng.random() < moss * .5 else rng.choice((C['stoneL'], C['stone']))
    Q(p, r1, top, ref)
    # (the slightly inset r2 ring is used as a bevel for blocky stones)
    return p


def rockstone(p, c, rx, ry, h, seed, n=6, moss=0.8, tone=None):
    rng = random.Random(seed)
    tones = tone or (C['rock'], C['rockL'], C['rockD'], C['rockL'])
    a0 = rng.random() * 6.28
    angs = [a0 + 2 * math.pi * i / n + (rng.random() - .5) * .45 for i in range(n)]

    def ring(z, s, jit, off=(0, 0)):
        pts = []
        for a in angs:
            k = s * (1 + (rng.random() - .5) * 2 * jit)
            pts.append((c[0] + off[0] + math.cos(a) * rx * k, c[1] + off[1] + math.sin(a) * ry * k, c[2] + z))
        return pts
    r0 = ring(-.5, 1.05, .06)
    r1 = ring(h * .5, 1.0, .16)
    r2 = ring(h * .92, .6, .22, (rng.uniform(-.2, .2) * rx, rng.uniform(-.2, .2) * ry))
    ref = (c[0], c[1], c[2] + h * .35)
    for i in range(n):
        j = (i + 1) % n
        Q(p, [r0[i], r0[j], r1[j], r1[i]], rng.choice(tones[:3]), ref)
        col = C['moss'] if rng.random() < moss * .2 else rng.choice(tones)
        Q(p, [r1[i], r1[j], r2[j], r2[i]], col, ref)
    Q(p, r2, (C['mossL'] if rng.random() < .5 else C['moss']) if rng.random() < .5 else rng.choice(tones[:2]), ref)


def muro_stones(p, x0, y0, x1, y1, seed, moss=.3):
    """Dry-stone wall along (x0,y0)->(x1,y1) built of irregular stones in two courses + cap."""
    rng = random.Random(seed)
    L_ = math.hypot(x1 - x0, y1 - y0)
    ang = math.atan2(y1 - y0, x1 - x0)
    n = max(2, int(L_ / 2.0 + .5))
    seg = L_ / n
    for i in range(n):
        t = (i + .5) / n
        cx_, cy_ = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        stone(p, (cx_, cy_, -.3), seg * 1.02, 1.35, 1.2 + rng.random() * .2, seed * 31 + i, rz=ang)
    for i in range(n - 1):
        t = (i + 1.0) / n
        cx_, cy_ = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        stone(p, (cx_, cy_, .85), seg * 1.0, 1.15, .75 + rng.random() * .2, seed * 17 + i, rz=ang + rng.uniform(-.1, .1), moss=moss)


def roca(name, stones, extra=None):
    p = Pt(name)
    for i, (x, y, rx, ry, h) in enumerate(stones):
        rockstone(p, (x, y, 0), rx, ry, h, hash((name, i)) % 9973, n=6 if rx > 1.4 else 5)
    INFO[name] = p
    return p


# ───────────────────────── vegetation ─────────────────────────
def pino(name, H, R, tiers, n=8, seed=1):
    p = Pt(name)
    th = H * .2
    p.frustum((0, 0, -.5), R * .16, R * .11, th + .5 + H * .1, 5, C['wood'], bottom=False, top=False)
    zs = th * .6
    th_ = (H - zs) / tiers * 1.75
    for k in range(tiers):
        f = k / max(tiers - 1, 1)
        zb = zs + (H - zs - th_) * f
        r0 = R * (1 - .8 * f)
        r1 = r0 * (.2 if k < tiers - 1 else 0.0)
        cols = (C['pine1'], C['pine2']) if k % 2 == 0 else (C['pine2'], C['pine3'])
        p.frustum((0, 0, zb), r0, r1, th_, n, cols[0], rz=k * .45, ring_colors=[cols[0], cols[1]] if n % 2 == 0 else None,
                  tcolor=C['pine3'], bottom=False)
    INFO[name] = p
    return p


def arbol(name, H, R, trunk_h, lumps, cols, seed):
    p = Pt(name)
    rng = random.Random(seed)
    p.frustum((0, 0, -.5), .75, .45, trunk_h + .5, 5, C['wood'], bottom=False, top=False)
    p.beam((0, 0, trunk_h * .6), (R * .35, R * .1, trunk_h + R * .35), .22, C['wood'], 3)
    lo, mid, hi = cols

    def bands(zc, r):
        if zc > .3:
            return hi if r > .45 else mid
        if zc > -.25:
            return mid if r > .4 else lo
        return lo
    for i, (x, y, z, r, s) in enumerate(lumps):
        p.ico((x, y, z), r, mid, sub=1, sc=(1.05, 1.05, .82), jitter=.1, seed=seed + i, bands=bands, cut_below=z - r * .3)
    INFO[name] = p
    return p


def leaf(p, base, az, el, length, width, ca, cb, droop=.25, ref=None):
    d = V((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
    side = V((-math.sin(az), math.cos(az), 0))
    B = V(base)
    BL, BR = B - side * width / 2, B + side * width / 2
    BC = B + V((0, 0, width * .3))
    T = B + d * length + V((0, 0, -droop * length * max(0, 1 - el / 1.2)))
    M = B + d * length * .45 + V((0, 0, width * .25))
    r = ref or (B.x, B.y, B.z - 2)
    Q(p, [BL, M, T], ca, r)
    Q(p, [M, BR, T], cb, r)
    Q(p, [BL, BC, M], ca, r)
    Q(p, [BC, BR, M], cb, r)


def rosette(p, c, S, tiers, seed, cols=None):
    rng = random.Random(seed)
    cols = cols or (C['fr1'], C['fr2'], C['fr3'], C['frD'])
    ref = (c[0], c[1], c[2] - 3)
    for (n, el, ln, wd, r0) in tiers:
        off = rng.random() * 6.28
        for i in range(n):
            az = off + 2 * math.pi * i / n + rng.uniform(-.1, .1)
            e = el + rng.uniform(-.08, .08)
            l_ = ln * S * rng.uniform(.9, 1.1)
            base = (c[0] + math.cos(az) * r0 * S, c[1] + math.sin(az) * r0 * S, c[2] + .05)
            ca, cb = (cols[0], cols[1]) if el < .8 else (cols[1], cols[2])
            if i % 3 == 2:
                ca, cb = cols[3], cols[0]
            leaf(p, base, az, e, l_, wd * S, ca, cb, ref=ref)


def frailejon(name, th, S, seed, branch=False):
    p = Pt(name)
    p.frustum((0, 0, -.5), .8 * S, .6 * S, th + .5, 6, C['frT'], bottom=False, top=False, ring_colors=[C['frT'], C['frS']])
    rng = random.Random(seed)
    for i in range(8):
        az = i * math.pi / 4 + rng.uniform(-.2, .2)
        bz = th * rng.uniform(.5, .9)
        r = .75 * S
        B = (math.cos(az) * r * .85, math.sin(az) * r * .85, bz)
        T = (math.cos(az) * r * 1.35, math.sin(az) * r * 1.35, bz - 1.0 * S)
        sd = (-math.sin(az) * .3 * S, math.cos(az) * .3 * S, 0)
        Q(p, [(B[0] - sd[0], B[1] - sd[1], B[2]), (B[0] + sd[0], B[1] + sd[1], B[2]), T], C['frS'] if i % 2 else C['frT'], (0, 0, bz))
    tiers = [(12, .35, 3.3, .8, .5), (10, .85, 2.8, .7, .4), (7, 1.3, 2.0, .55, .3)]
    rosette(p, (0, 0, th), S, tiers, seed)
    if branch:
        bx, by = 2.2 * S, .6 * S
        p.beam((.2, 0, th * .7), (bx, by, th * .55), .38 * S, C['frT'], 5)
        rosette(p, (bx, by, th * .55), S * .62, [(10, .4, 3.0, .75, .4), (8, 1.0, 2.2, .6, .3), (5, 1.4, 1.5, .5, .2)], seed + 5)
    INFO[name] = p
    return p


def blades(p, c, R, H, n, seed, cols, w=.4, spread=.55):
    rng = random.Random(seed)
    for i in range(n):
        a = rng.random() * 6.28
        r0 = R * spread * math.sqrt(rng.random()) * .6
        bx, by = c[0] + math.cos(a) * r0, c[1] + math.sin(a) * r0
        out = rng.uniform(.5, 1.0) * R * .5
        hh = H * rng.uniform(.55, 1.0)
        tx, ty = bx + math.cos(a) * out, by + math.sin(a) * out
        sx, sy = -math.sin(a) * w / 2, math.cos(a) * w / 2
        Q(p, [(bx - sx, by - sy, c[2]), (bx + sx, by + sy, c[2]), (tx, ty, c[2] + hh)], rng.choice(cols), (c[0], c[1], c[2] - 2))


def arbusto(name, kind):
    p = Pt(name)
    if kind == 'a':
        p.ico((0, 0, 0), 1.6, C['grass3'], sub=1, sc=(1, 1, .6), jitter=.1, seed=3, cut_below=-.2)
        blades(p, (0, 0, .1), 3.0, 2.6, 34, 11, [C['grass1'], C['grass2'], C['grass4'], C['grass3']], w=.5)
    elif kind == 'b':
        for i, (x, y, z, r) in enumerate(((0, 0, 1.0, 1.8), (1.5, .6, .8, 1.3), (-1.3, -.5, .7, 1.2))):
            p.ico((x, y, z), r, C['ol1'], sub=1, sc=(1.1, 1.1, .8), jitter=.12, seed=5 + i, tcolor=C['ol2'], cut_below=z - r * .3,
                  bands=lambda zc, rr: C['ol3'] if zc > .35 and rr > .4 else (C['ol2'] if zc > -.1 else C['ol1']))
        for (x, y, z) in ((.6, -1.2, 1.9), (-1.2, .5, 1.7), (1.8, .9, 1.7), (.2, .9, 2.4)):
            p.frustum((x, y, z), .26, 0, .4, 4, C['goldL'])
    else:
        for i, (x, y, r) in enumerate(((0, 0, 1.7), (1.9, .4, 1.15), (-1.5, .9, 1.0))):
            p.ico((x, y, 0), r, C['grass3'], sub=1, sc=(1.1, 1.1, .5), jitter=.1, seed=20 + i, cut_below=-.2,
                  bands=lambda zc, rr: C['mossL'] if zc > .3 else (C['grass3'] if rr > .5 else C['mossD']))
        blades(p, (0, 0, .1), 3.4, 1.9, 16, 4, [C['grass1'], C['grass4'], C['grass2']], w=.45, spread=1.1)
    INFO[name] = p
    return p


# ───────────────────────── church ─────────────────────────
def arch_quad(p, g, side, u, z0, w, h, col, off=.05):
    """Round-topped opening on a wall (octagonal-ish arch)."""
    r = w / 2
    pts_u = [(-r, 0), (r, 0), (r, h - r)]
    for a in (30, 60, 90, 120, 150):
        pts_u.append((r * math.cos(math.radians(a)), h - r + r * math.sin(math.radians(a))))
    pts_u.append((-r, h - r))
    pts_u = [(-r, 0), (r, 0), (r, h - r), (r * .7, h - r + r * .7), (0, h), (-r * .7, h - r + r * .7), (-r, h - r)]
    cx, cy, hw, hd = g
    pts = []
    for (du, dz) in pts_u:
        uu = u + du
        if side == 'S':
            pts.append((cx + uu, cy - hd - off, z0 + dz))
            ref = (cx + u, cy - hd - 6, z0 + h / 2)
        elif side == 'N':
            pts.append((cx + uu, cy + hd + off, z0 + dz))
            ref = (cx + u, cy + hd + 6, z0 + h / 2)
        elif side == 'E':
            pts.append((cx + hw + off, cy + uu, z0 + dz))
            ref = (cx + hw + 6, cy + u, z0 + h / 2)
        else:
            pts.append((cx - hw - off, cy + uu, z0 + dz))
            ref = (cx - hw - 6, cy + u, z0 + h / 2)
    Q(p, pts, col, ref)


def iglesia():
    p = Pt('iglesia_and')
    W = C['white']
    zf = .7
    p.cbox((0, -9.5, -.5), (14, 3, zf + .5), C['stoneL'], ch=.25, tcolor=C['plazaL'])
    p.box((0, -7.9, zf - .05), (6.4, 1.0, .35), C['stone'], bottom=False)
    # nave
    nz = zf + 7.0
    p.box((0, 0, zf), (10, 16, 7.0), W, bottom=False, top=False)
    gN = (0, 0, 5, 8)
    gable2(p, 0, 0, 10, 16, nz, 3.0, W, False, strips=4, over=.5, rake=.4)
    # transept
    p.box((0, 0, zf), (14, 6, 6.0), W, bottom=False, top=False)
    gable2(p, 0, 0, 14, 6, zf + 6.0, 2.2, W, True, strips=3, over=.4, rake=.3)
    gT = (0, 0, 7, 3)
    # apse
    p.frustum((0, 8, zf), 3.1, 3.1, 5.0, 6, W, bottom=False, top=False)
    p.frustum((0, 8, zf + 5.0), 3.5, 0, 2.6, 6, C['teja'], ring_colors=[C['teja'], C['tejaL']], bottom=False)
    # dome on drum at the crossing
    dz = nz + 3.0 - .6
    p.frustum((0, 0, dz), 3.1, 3.1, 2.4, 8, W, rz=math.pi / 8, bottom=False, top=False, ring_colors=[W, C['stoneL']])
    for k in range(4):
        a = math.pi / 2 * k
        Q(p, [(3.0 * math.cos(a) * 1.0 - .55 * math.sin(a), 3.0 * math.sin(a) + .55 * math.cos(a), dz + .6),
              (3.0 * math.cos(a) * 1.0 + .55 * math.sin(a), 3.0 * math.sin(a) - .55 * math.cos(a), dz + .6),
              (3.0 * math.cos(a) * 1.0 + .55 * math.sin(a), 3.0 * math.sin(a) - .55 * math.cos(a), dz + 1.9),
              (3.0 * math.cos(a) * 1.0 - .55 * math.sin(a), 3.0 * math.sin(a) + .55 * math.cos(a), dz + 1.9)], C['glass'], (0, 0, dz + 1.2))
    p.frustum((0, 0, dz + 2.4), 3.4, 3.4, .35, 8, C['stoneL'], rz=math.pi / 8, bottom=False)
    zd = dz + 2.75
    p.ico((0, 0, zd), 3.15, C['gold'], sub=2, sc=(1, 1, .95), jitter=.0, seed=4, cut_below=zd - .05,
          bands=lambda zc, r: C['goldL'] if (zc > .55 or r > .8) else C['gold'])
    p.frustum((0, 0, zd + 2.85), .55, .4, .9, 6, C['stoneL'], bottom=False)
    p.ico((0, 0, zd + 3.9), .5, C['gold'], sub=1)
    p.box((0, 0, zd + 4.2), (.22, .22, 1.6), C['gold'], bottom=False)
    p.box((0, 0, zd + 5.0), (1.0, .22, .22), C['gold'], bottom=False)
    # facade (south face of the nave at y=-8)
    gF = (0, 0, 5, 8)
    for s in (-1, 1):
        p.box((s * 4.75, -8.15, zf), (.9, .5, 7.3), C['stoneL'], bottom=False)
    p.box((0, -8.1, zf + 6.8), (10.6, .6, .5), C['stoneL'], bottom=False)
    arch_quad(p, gF, 'S', 0, zf, 3.4, 4.4, C['stoneL'], .04)
    arch_quad(p, gF, 'S', 0, zf, 2.6, 3.8, C['door'], .08)
    wf(p, gF, 'S', -.06, .06, zf, zf + 2.6, C['woodD'], .1)
    wf(p, gF, 'S', -1.3, 1.3, zf + 1.8, zf + 1.95, C['woodD'], .1)
    arch_quad(p, gF, 'S', 0, zf + 5.2, 1.7, 2.1, C['gold'], .04) if False else None
    # round window in the pediment
    Q(p, [(math.cos(a) * 1.1, -8.05, nz + 1.25 + math.sin(a) * 1.1) for a in [i * math.pi / 4 for i in range(8)]], C['gold'], (0, -20, nz + 1.25))
    Q(p, [(math.cos(a) * .75, -8.09, nz + 1.25 + math.sin(a) * .75) for a in [i * math.pi / 4 for i in range(8)]], C['glass'], (0, -20, nz + 1.25))
    for u in (-3.2, 3.2):
        arch_quad(p, gF, 'S', u, zf + 3.2, 1.0, 2.0, C['glass'], .08)
    # side windows
    for s in ('E', 'W'):
        for u in (-5.0, 5.0):
            arch_quad(p, gN, s, u, zf + 2.8, 1.2, 2.9, C['glass'], .06)
        arch_quad(p, gN, s, 0, zf + 2.8, 1.2, 2.9, C['glass'], .06) if False else None
    # tower
    tx, ty = -4.7, -5.5
    gTw = (tx, ty, 2.6, 2.6)
    tb = 9.4
    p.box((tx, ty, zf), (5.2, 5.2, tb - zf), W, bottom=False, top=False)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((tx + sx * 2.5, ty + sy * 2.5, zf), (.7, .7, tb - zf + .3), C['stoneL'], bottom=False, top=False)
    p.cbox((tx, ty, tb), (6.0, 6.0, .5), C['stoneL'], ch=.15)
    arch_quad(p, gTw, 'S', 0, zf + 3.6, 1.0, 2.6, C['glass'], .05)
    arch_quad(p, gTw, 'W', 0, zf + 3.6, 1.0, 2.6, C['glass'], .05)
    # clock
    Q(p, [(tx + math.cos(a) * 1.0, ty - 2.65, zf + 6.4 + math.sin(a) * 1.0) for a in [i * math.pi / 4 for i in range(8)]], C['gold'], (tx, ty - 9, zf + 6.4))
    Q(p, [(tx + math.cos(a) * .72, ty - 2.68, zf + 6.4 + math.sin(a) * .72) for a in [i * math.pi / 4 for i in range(8)]], C['white'], (tx, ty - 9, zf + 6.4))
    bz = tb + .5
    p.box((tx, ty, bz), (4.4, 4.4, 4.4), W, bottom=False, top=False)
    for s in 'SNEW':
        arch_quad(p, (tx, ty, 2.2, 2.2), s, 0, bz + .5, 2.0, 3.2, C['glass'], .05)
    p.ico((tx, ty - 2.2, bz + 1.5), .38, C['gold'], sub=1)
    p.cbox((tx, ty, bz + 4.4), (5.0, 5.0, .5), C['stoneL'], ch=.15)
    hip2(p, tx, ty, 4.4, 4.4, bz + 4.9, 4.4, strips=4, over=.5)
    p.ico((tx, ty, bz + 9.5), .5, C['gold'], sub=1)
    p.box((tx, ty, bz + 9.8), (.22, .22, 1.7), C['gold'], bottom=False)
    p.box((tx, ty, bz + 10.6), (1.0, .22, .22), C['gold'], bottom=False)
    INFO['iglesia_and'] = p
    return p


# ───────────────────────── plaza ─────────────────────────
def banca(p, x, y, rz):
    co, si = math.cos(rz), math.sin(rz)
    p.box((x, y, .4), (2.6, .75, .22), C['wood'], rz=rz)
    for s in (-1, 1):
        p.box((x + s * 1.0 * co, y + s * 1.0 * si, 0), (.28, .65, .45), C['stone'], rz=rz, bottom=False, top=False)


def planter_tree(p, x, y, seed):
    p.box((x, y, 0), (3.0, 3.0, .75), C['stone'], bottom=False, tcolor=C['soil'])
    p.frustum((x, y, .7), .4, .28, 2.6, 5, C['wood'], bottom=False, top=False)
    for i, (dx, dy, z, r) in enumerate(((0, 0, 3.7, 1.9), (.6, .3, 4.8, 1.3))):
        p.ico((x + dx, y + dy, z), r, C['leaf1'], sub=1, sc=(1.05, 1.05, .85), jitter=.1, seed=seed + i, tcolor=C['leaf2'])


def plaza():
    p = Pt('plaza_and')
    p.cbox((0, 0, -.5), (20, 20, .95), C['stone'], ch=.3, tcolor=C['plazaD'])

    def cobbles(x, y):
        i, j = int((x + 8.4) // 2.8), int((y + 8.4) // 2.8)
        if (abs(x) < 2.6 or abs(y) < 2.6):
            return C['plazaL'] if (i + j) % 2 == 0 else C['plaza']
        return C['plaza'] if (i + j) % 2 == 0 else C['plazaD']
    p.grid((0, 0, .47), (16.8, 16.8), 6, 6, C['plaza'], colorfn=cobbles)
    # fountain
    f0 = .47
    p.frustum((0, 0, f0), 3.4, 3.1, .9, 8, C['stoneL'], rz=math.pi / 8, bottom=False, top=False)
    p.frustum((0, 0, f0 + .9), 3.1, 3.1, .01, 8, C['stoneL'], rz=math.pi / 8, top=False, bottom=False) if False else None
    ring_o = [(3.2 * math.cos(math.pi / 8 + a * math.pi / 4), 3.2 * math.sin(math.pi / 8 + a * math.pi / 4), f0 + .9) for a in range(8)]
    ring_i = [(2.5 * math.cos(math.pi / 8 + a * math.pi / 4), 2.5 * math.sin(math.pi / 8 + a * math.pi / 4), f0 + .9) for a in range(8)]
    for i in range(8):
        j = (i + 1) % 8
        Q(p, [ring_o[i], ring_o[j], ring_i[j], ring_i[i]], C['stoneL'], up=True)
    p.disc((0, 0, f0 + .72), 2.5, C['turq'], rings=1, segs=8, colorfn=lambda x, y: C['turqL'] if (x * x + y * y) > 4 else C['turq'])
    p.frustum((0, 0, f0), .85, .55, 2.0, 8, C['stoneL'], bottom=False, top=False)
    p.frustum((0, 0, f0 + 2.0), .5, 1.5, .55, 8, C['stone'], top=False, bottom=False)
    p.disc((0, 0, f0 + 2.55), 1.5, C['turqL'], rings=1, segs=8)
    p.frustum((0, 0, f0 + 2.5), .3, .2, 1.2, 6, C['stoneL'], bottom=False)
    p.ico((0, 0, f0 + 3.9), .55, C['gold'], sub=1)
    for (x, y, sd) in ((-6.2, -6.2, 1), (6.2, -6.2, 5), (-6.2, 6.2, 9), (6.2, 6.2, 13)):
        planter_tree(p, x, y, sd)
    for (x, y, r) in ((0, -5.6, 0), (0, 5.6, math.pi), (-5.6, 0, math.pi / 2), (5.6, 0, -math.pi / 2)):
        banca(p, x, y, r if r in (0, math.pi) else r)
    INFO['plaza_and'] = p
    return p


# ───────────────────────── posada ─────────────────────────
def posada():
    p = Pt('posada')
    W = C['white']
    p.cbox((0, 0, -.5), (18.4, 14.4, 1.2), C['base'], ch=.25, tcolor=C['plazaD'])
    p.grid((0, 0, .72), (10, 6), 5, 3, C['plaza'], colorfn=lambda x, y: C['plazaL'] if (int((x + 5) // 2) + int((y + 3) // 2)) % 2 == 0 else C['plaza'])
    z0 = .7
    h1, h2 = 3.5, 6.8
    # south wing split by the gate
    gS = (0, -5, 9, 2)
    for s in (-1, 1):
        p.box((s * 5.4, -5, z0), (7.2, 4, h1), W, bottom=False, top=False)
        for u0, u1 in ((s * 1.8, s * 1.8),):
            pass
        Q(p, [(s * 1.8, -7, z0), (s * 1.8, -3, z0), (s * 1.8, -3, z0 + h1), (s * 1.8, -7, z0 + h1)], C['stoneL'], (0, -5, z0 + 1))
    p.box((0, -5, z0 + 2.6), (3.6, 4, h1 - 2.6), W, bottom=False, top=False)
    p.box((0, -7.05, z0 + 2.4), (3.9, .3, .3), C['woodD'], bottom=False)
    for s in (-1, 1):
        p.box((s * 2.0, -7.05, z0), (.45, .45, 2.7), C['woodD'], bottom=False)
    gable2(p, 0, -5, 18, 4, z0 + h1, 2.0, W, True, strips=3, over=.4, rake=.35)
    for u in (-7, -4.2, 4.2, 7):
        win(p, gS, 'S', u, z0 + 1.0, w=1.0, sh='sh_red')
    # north wing 2 storeys
    gN = (0, 5, 9, 2)
    p.box((0, 5, z0), (18, 4, h2), W, bottom=False, top=False)
    gable2(p, 0, 5, 18, 4, z0 + h2, 2.0, W, True, strips=3, over=.4, rake=.35)
    for u in (-6.5, -3, 3, 6.5):
        win(p, gN, 'N', u, z0 + 1.0, w=1.0, sh='sh_red')
        win(p, gN, 'N', u, z0 + 4.2, w=1.0, sh='sh_red')
        win(p, gN, 'S', u, z0 + 1.0, w=1.0, sh='sh_red')
    for u in (-6.5, -3, 3, 6.5):
        door(p, gN, 'S', 0, z0, step=False) if u == 3 else None
    wf(p, gN, 'S', -9, 9, z0 + 3.5, z0 + 3.75, C['stoneL'], .04)
    balcony(p, gN, -7.6, 7.6, z0 + 3.5, depth=1.3, posts_to=None)
    for u in (-6.5, -3, 0, 3, 6.5):
        wf(p, gN, 'S', u - .5, u + .5, z0 + 3.5, z0 + 5.5, C['glass'], .06)
    # west / east wings
    for s in (-1, 1):
        gW = (s * 7, 0, 2, 3)
        p.box((s * 7, 0, z0), (4, 6, h1), W, bottom=False, top=False)
        gable2(p, s * 7, 0, 4, 6, z0 + h1, 1.9, W, False, strips=3, over=.4, rake=.3, ends=(True, True))
        win(p, gW, 'E' if s == 1 else 'W', 0, z0 + 1.0, w=1.0, sh='sh_red')
        inner = 'W' if s == 1 else 'E'
        door(p, gW, inner, 0, z0, step=False) if False else None
        win(p, gW, inner, -1.2, z0 + 1.0, w=.9, sh='sh_red', shut=False)
        win(p, gW, inner, 1.2, z0 + 1.0, w=.9, sh='sh_red', shut=False)
        # veranda along the courtyard side
        xi = s * 5
        xo = s * 3.7
        lean(p, min(xi, xo), max(xi, xo), -2.7, -2.7, 0, 0, 1) if False else None
        ref = (s * 4.3, 0, 0)
        for k in range(2):
            a, b = k / 2, (k + 1) / 2
            xa, xb = xi + (xo - xi) * a, xi + (xo - xi) * b
            za, zb = z0 + 3.1 - .55 * a, z0 + 3.1 - .55 * b
            Q(p, [(xa, -3, za), (xa, 3, za), (xb, 3, zb), (xb, -3, zb)], C['teja'] if k == 0 else C['tejaL'], (s * 4.3, 0, z0))
        for y in (-2.5, 0, 2.5):
            p.beam((xo - s * .15, y, z0), (xo - s * .15, y, z0 + 2.6), .12, C['woodD'], 3)
    # well + tree in the courtyard
    p.frustum((-1.8, 0, z0), 1.0, .9, .85, 8, C['stoneL'], bottom=False, top=False)
    p.disc((-1.8, 0, z0 + .7), .85, C['turq'], rings=1, segs=8)
    for s in (-1, 1):
        p.beam((-1.8 + s * .8, 0, z0 + .8), (-1.8 + s * .8, 0, z0 + 2.6), .1, C['woodD'], 3)
    lean(p, -2.8, -.8, -.9, .9, z0 + 2.9, z0 + 2.4, 1) if False else None
    p.box((-1.8, 0, z0 + 2.5), (2.3, 1.3, .22), C['teja'], bottom=False)
    p.frustum((2.2, .3, z0), .35, .25, 2.2, 5, C['wood'], bottom=False, top=False)
    p.ico((2.2, .3, z0 + 3.1), 1.6, C['leaf1'], sub=1, sc=(1.05, 1.05, .85), jitter=.1, seed=2, tcolor=C['leaf2'], cut_below=z0 + 2.4)
    INFO['posada'] = p
    return p


# ───────────────────────── bridge ─────────────────────────
def puente():
    p = Pt('puente_piedra')
    hw = 2.5
    rx, rz_, sp, N = 5.0, 2.8, .4, 6
    ro = .8

    def deck(x):
        return 3.0 + 2.2 * (1 - (x / 10.0) ** 2)
    ai = [(-rx * math.cos(math.pi * i / N), sp + rz_ * math.sin(math.pi * i / N)) for i in range(N + 1)]
    ao = [(-(rx + ro) * math.cos(math.pi * i / N), sp + (rz_ + ro) * math.sin(math.pi * i / N)) for i in range(N + 1)]
    for s in (-1, 1):
        y = s * hw
        ref = (0, y + s * 8, 3)

        def F(pts, col):
            Q(p, [(x, y, z) for (x, z) in pts], col, ref)
        for i in range(N):
            F([ai[i], ai[i + 1], ao[i + 1], ao[i]], C['stoneL'] if i % 2 == 0 else C['stoneD'])
            F([ao[i], ao[i + 1], (ao[i + 1][0], deck(ao[i + 1][0])), (ao[i][0], deck(ao[i][0]))], C['stone'] if i % 2 == 0 else C['stoneL'])
        for e in (-1, 1):
            xo_ = e * (rx + ro)
            xi_ = e * rx
            xe = e * 10.0
            F([(xe, -.5), (xo_, -.5), (xo_, deck(xo_ * 1.0) * .55 + .0), (xe, deck(xe) * .55)], C['stoneD'])
            F([(xe, deck(xe) * .55), (xo_, deck(xo_) * .55), (xo_, deck(xo_)), (xe, deck(xe))], C['stone'])
            F([(xo_, -.5), (xi_, -.5), (xi_, sp), (xo_, sp)], C['stoneD'])
        # parapet outer face
        xs = [-10, -8.2] + [a[0] for a in ao] + [8.2, 10]
        xs = sorted(set(round(x, 4) for x in xs))
        for a, b in zip(xs[:-1], xs[1:]):
            F([(a, deck(a)), (b, deck(b)), (b, deck(b) + 1.1), (a, deck(a) + 1.1)], C['stoneL'] if int(a * 3) % 2 == 0 else C['stone'])
            # inner face + top
            yi = y - s * .8
            Q(p, [(a, yi, deck(a)), (b, yi, deck(b)), (b, yi, deck(b) + 1.1), (a, yi, deck(a) + 1.1)], C['stoneD'], (0, yi - s * 6, 5))
            Q(p, [(a, y, deck(a) + 1.1), (b, y, deck(b) + 1.1), (b, yi, deck(b) + 1.1), (a, yi, deck(a) + 1.1)], C['stoneL'], up=True)
    xs = [-10, -8.2] + [a[0] for a in ao] + [8.2, 10]
    xs = sorted(set(round(x, 4) for x in xs))
    for k, (a, b) in enumerate(zip(xs[:-1], xs[1:])):
        Q(p, [(a, -hw + .8, deck(a)), (b, -hw + .8, deck(b)), (b, hw - .8, deck(b)), (a, hw - .8, deck(a))], C['plazaD'] if k % 2 == 0 else C['plaza'], up=True)
    for i in range(N):
        Q(p, [(ai[i][0], -hw, ai[i][1]), (ai[i + 1][0], -hw, ai[i + 1][1]), (ai[i + 1][0], hw, ai[i + 1][1]), (ai[i][0], hw, ai[i][1])],
          C['stoneD'], (0, 0, deck(0) + 20))
    # end posts + keystone
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((sx * 9.6, sy * (hw - .4), deck(9.6) - .2), (1.0, 1.0, 1.9), C['stoneL'], bottom=False)
    p.box((0, -hw - .1, sp + rz_ + ro - .5), (.8, .35, 1.3), C['stoneL'], bottom=False, top=False) if False else None
    INFO['puente_piedra'] = p
    return p


def muro_recto():
    p = Pt('muro_piedra_recto')
    muro_stones(p, -3, 0, 3, 0, 5)
    INFO['muro_piedra_recto'] = p
    return p


def muro_esquina():
    p = Pt('muro_piedra_esquina')
    muro_stones(p, -3, -3, 3, -3, 8)
    muro_stones(p, 3, -3, 3, 3, 12)
    INFO['muro_piedra_esquina'] = p
    return p


# ───────────────────────── water ─────────────────────────
def cascada():
    p = Pt('cascada_pieza')
    steps = [(-3.2, -0.2, 3.4), (-0.2, 2.8, 6.6), (2.8, 5.4, 9.8), (5.4, 8.0, 13.0)]
    for i, (a, b, zt) in enumerate(steps):
        p.cbox((0, (a + b) / 2, -.5), (14, b - a, zt + .5), C['rock'], ch=.4, tcolor=C['moss'],
               colors=[C['rockL'], C['rock'], C['rockL'], C['rock']])
    prof = [(7.9, 13.2, 2.2, 0), (5.7, 13.2, 2.4, 0), (5.35, 9.95, 2.6, 1), (3.1, 9.95, 2.8, 0), (2.65, 6.75, 3.0, 1),
            (0.1, 6.75, 3.2, 0), (-.35, 3.55, 3.4, 1), (-2.9, 3.55, 3.6, 0), (-3.4, .5, 3.8, 1)]
    for i in range(len(prof) - 1):
        y0, z0, w0, _ = prof[i]
        y1, z1, w1, fl = prof[i + 1]
        ref = (0, (y0 + y1) / 2 + (5 if fl else 0), (z0 + z1) / 2 - (0 if fl else 3))
        xs0 = [-w0, -w0 / 3, w0 / 3, w0]
        xs1 = [-w1, -w1 / 3, w1 / 3, w1]
        for c in range(3):
            if fl:
                col = C['fall'] if c == 1 else (C['foam'] if (i // 2) % 2 == 0 else C['fall'])
            else:
                col = C['turq'] if c != 1 else C['turqL']
                if c == 0 or c == 2:
                    col = C['turqD'] if i % 4 == 0 else C['turq']
            Q(p, [(xs0[c], y0, z0 + .05), (xs0[c + 1], y0, z0 + .05), (xs1[c + 1], y1, z1 + .05), (xs1[c], y1, z1 + .05)], col, ref)
    for (y, z, w) in ((5.0, 13.25, 2.2), (2.5, 10.0, 2.5), (-0.5, 6.8, 2.7), (-3.0, 3.6, 3.0)):
        Q(p, [(-w, y, z), (w, y, z), (w * .8, y + .5, z), (-w * .8, y + .5, z)], C['foam'], (0, y, z - 3))
    # splash pool
    p.disc((0, -6.2, .4), 5.0, C['turq'], rings=2, segs=10,
           colorfn=lambda x, y: C['foam'] if (x * x + (y + 6.2 - 2.2) ** 2) < 3.5 else (C['turqL'] if (x * x + (y + 6.2) ** 2) < 14 else C['turq']))
    for (x, y, r) in ((-2.2, -4.0, .8), (1.8, -3.7, .9), (0, -4.8, .7)):
        p.disc((x, y, .5), r, C['foam'], rings=1, segs=6)
    # rocks both sides
    for i, (x, y, rx, ry, h) in enumerate(((-6.6, 6.5, 3.0, 2.6, 15.0), (6.7, 6.0, 3.1, 2.7, 14.0), (-6.8, 1.2, 2.6, 2.6, 9.0), (6.8, 1.6, 2.6, 2.5, 9.5),
                                         (-6.4, -3.0, 2.5, 2.4, 5.0), (6.5, -3.2, 2.4, 2.4, 5.5), (-5.8, -7.0, 2.4, 2.2, 2.6), (5.9, -7.2, 2.2, 2.0, 2.4), (-3.4, -2.2, 1.0, 1.0, 1.4))):
        rockstone(p, (x, y, 0), rx, ry, h, 40 + i, n=6)
    INFO['cascada_pieza'] = p
    return p


def rapidos():
    p = Pt('rapidos_pieza')
    ys = [-12 + 4 * k for k in range(7)]
    xs = [-5.4, -2.7, 0, 2.7, 5.4]
    rng = random.Random(3)
    zs = lambda x, y: .22 + .12 * math.sin(y * .9 + x * .5)
    ref = (0, 0, -3)
    for k in range(6):
        for c in range(4):
            col = C['turq'] if (k + c) % 2 == 0 else C['turqD']
            if c in (0, 3):
                col = C['turqL'] if (k + c) % 2 == 0 else C['turq']
            Q(p, [(xs[c], ys[k], zs(xs[c], ys[k])), (xs[c + 1], ys[k], zs(xs[c + 1], ys[k])), (xs[c + 1], ys[k + 1], zs(xs[c + 1], ys[k + 1])),
                  (xs[c], ys[k + 1], zs(xs[c], ys[k + 1]))], col, ref)
    for (x, y, l, w) in ((-2.8, -9.5, 4, .9), (2.5, -6.0, 5, 1.0), (-.8, -2.5, 4, .8), (3.2, .5, 3.5, 1.0), (-3.4, 3.0, 4.5, .9), (.6, 6.0, 4, 1.0),
                         (-1.8, 9.5, 3, .8), (3.4, 10.0, 3, .7)):
        Q(p, [(x - w / 2, y, .38), (x + w / 2, y, .38), (x + w * .3, y + l, .38), (x - w * .3, y + l, .38)], C['foam'], (x, y, -3))
    for sx in (-1, 1):
        for k in range(6):
            a, b = ys[k], ys[k + 1]
            xa = sx * (5.4 + .25 * math.sin(k * 1.7))
            xb = sx * 6.6
            xc = sx * 8.0
            Q(p, [(xa, a, .2), (xb, a, .85), (xb, b, .85), (xa, b, .2)], C['dirt'] if k % 2 else C['dirtD'], (sx * 3, (a + b) / 2, -3))
            Q(p, [(xb, a, .85), (xc, a, .95), (xc, b, .95), (xb, b, .85)], C['grass3'] if k % 2 else C['mossL'], up=True)
    for i, (x, y, r, h) in enumerate(((-3.2, -9.0, 1.4, 1.6), (2.6, -4.2, 1.7, 2.0), (-2.0, 1.0, 1.5, 1.8), (3.0, 4.5, 1.3, 1.5), (-3.4, 7.5, 1.6, 1.9), (1.0, 10.5, 1.4, 1.7))):
        p.disc((x, y, .4), r * 1.45, C['turqL'], rings=1, segs=7)
        rockstone(p, (x, y, .1), r, r * .9, h, 70 + i, n=5)
    INFO['rapidos_pieza'] = p
    return p


# ───────────────────────── cable car stations ─────────────────────────
def cabina(p, x, y, z, rz=0.0):
    p.box((x, y, z + .9), (2.6, 1.9, 2.0), C['red'], rz=rz, bottom=False)
    p.box((x, y, z + 1.5), (2.7, 2.0, .8), C['glass'], rz=rz, bottom=False, top=False)
    p.beam((x, y, z + 2.9), (x, y, z + 4.4), .1, C['steel'], 3)


def estacion_cima():
    p = Pt('estacion_cima')
    p.cbox((0, 0, -.5), (14, 10, 2.5), C['stone'], ch=.3, tcolor=C['stoneL'], colors=[C['stoneD'], C['stone'], C['stoneL'], C['stone']])
    z0 = 2.0
    g = (-1, 0, 4.5, 3.2)
    p.box((-1, 0, z0), (9, 6.4, 4.2), C['stone'], bottom=False, top=False, colors={'n': C['stoneD'], 'e': C['stone'], 's': C['stoneL'], 'w': C['stone']})
    zt = z0 + 4.2
    # red gable roof with overhang
    gable2(p, -1, 0, 9, 6.4, zt, 2.8, C['stoneL'], True, strips=3, over=.7, rake=.6, t1='red', t2='redD')
    wf(p, g, 'S', -3.9, -1.9, z0, z0 + 2.7, C['steel'], .05)
    wf(p, g, 'S', -3.7, -2.1, z0, z0 + 2.5, C['glass'], .08)
    win(p, g, 'S', 1.6, z0 + 1.2, w=1.6, h=1.3, sh='red', trim='stoneL', shut=False)
    win(p, g, 'S', 3.6, z0 + 1.2, w=.9, h=1.3, sh='red', trim='stoneL', shut=False)
    win(p, g, 'W', 0, z0 + 1.2, w=1.6, h=1.4, shut=False, trim='stoneL')
    # cable machinery tower / pulley at the +X end
    p.box((5.6, 0, z0), (1.3, 1.3, 6.0), C['steel'], bottom=False)
    p.frustum((5.6, 0, z0 + 5.2), .9, .9, .5, 8, C['redD'], bottom=False)
    p.beam((5.6, -.3, z0 + 5.45), (7.0, -.3, z0 + 4.0), .08, C['steel'], 3)
    p.beam((5.6, .3, z0 + 5.45), (7.0, .3, z0 + 4.0), .08, C['steel'], 3)
    cabina(p, 6.2, -2.7, z0 + .1)
    # railing posts + chimney
    for x in (-6.5, -4, -1.5, 1, 3.5, 6.0):
        p.box((x, -4.4, z0), (.2, .2, .9), C['red'], bottom=False)
    p.beam((-6.5, -4.4, z0 + .9), (6.0, -4.4, z0 + .9), .07, C['red'], 3)
    chimney(p, -3.3, 1.0, zt + 1.0, 1.3)
    INFO['estacion_cima'] = p
    return p


def estacion_valle():
    p = Pt('estacion_valle')
    p.cbox((0, 0, -.5), (12, 9, 1.2), C['stoneL'], ch=.25, tcolor=C['plaza'])
    z0 = .7
    g = (-.5, 0, 4.5, 3.2)
    p.box((-.5, 0, z0), (9, 6.4, 5.2), C['white'], bottom=False, top=False)
    zt = z0 + 5.2
    # mono-pitch red roof sloping toward the front
    ref = (0, 0, zt - 4)
    over = .9
    pts = [(-5.0 - over, -3.2 - over, zt), (4.0 + over, -3.2 - over, zt), (4.0 + over, 3.2 + over, zt + 1.5), (-5.0 - over, 3.2 + over, zt + 1.5)]
    # split into 3 bands for tile look
    for k in range(3):
        a, b = k / 3, (k + 1) / 3
        ya, yb = -4.1 + 8.2 * a, -4.1 + 8.2 * b
        za, zb = zt + 1.5 * a * 1.0 + 0.0, zt + 1.5 * b
        Q(p, [(-5.9, ya, za), (4.9, ya, za), (4.9, yb, zb), (-5.9, yb, zb)], C['red'] if k % 2 == 0 else C['redD'], ref)
    for sx in (-1, 1):
        x = -.5 + sx * 4.5
        Q(p, [(x + sx * .02, -3.2, zt), (x + sx * .02, 3.2, zt), (x + sx * .02, 3.2, zt + 1.0), (x + sx * .02, -3.2, zt + 1.0)], C['white'], (x + sx * 6, 0, zt)) if False else None
    # front: wide glazed band, door, ticket window
    wf(p, g, 'S', -3.8, 3.8, z0 + 1.6, z0 + 3.9, C['stoneL'], .04)
    for u in (-3.0, -1.0, 1.0, 3.0):
        wf(p, g, 'S', u - .8, u + .8, z0 + 1.8, z0 + 3.7, C['glass'], .07)
    door(p, g, 'S', 0, z0, w=1.7, h=2.4, trim='stoneL', col='red', step=False)
    wf(p, g, 'S', -4.2, 4.2, z0 + 4.4, z0 + 5.0, C['red'], .06)
    for s in ('E', 'W'):
        win(p, g, s, 0, z0 + 1.6, w=1.6, h=1.6, trim='red', shut=False)
    # canopy over the front platform
    p.box((-.5, -5.2, z0 + 3.0), (7, 2.2, .22), C['red'], bottom=True)
    for x in (-3.5, 2.5):
        p.beam((x, -6.0, z0), (x, -6.0, z0 + 3.0), .12, C['steel'], 3)
    # cable pylon + cabin at the +X side
    p.box((5.4, 0, z0), (.8, .8, 6.4), C['red'], bottom=False)
    p.beam((4.4, -.3, zt + 1.5), (6.2, -.3, z0 + 6.8), .08, C['steel'], 3) if False else None
    p.beam((5.4, -.3, z0 + 6.4), (5.4, -.3, z0 + 6.4), .08, C['steel'], 3)
    p.box((5.4, 0, z0 + 6.2), (1.6, .5, .3), C['steel'], bottom=False)
    cabina(p, 5.2, -3.0, z0 + .0)
    INFO['estacion_valle'] = p
    return p


# ───────────────────────── farm & terraces ─────────────────────────
def pajar(p, x, y, r, h, seed):
    p.frustum((x, y, -.2), r, r * .92, h * .6 + .2, 7, C['hay'], bottom=False, top=False, ring_colors=[C['hay'], C['hayD']])
    p.frustum((x, y, h * .6), r * .92, r * .35, h * .35, 7, C['hayD'], bottom=False, ring_colors=[C['hayD'], C['hay']])
    p.frustum((x, y, h * .95), r * .35, 0, h * .18, 7, C['hay'])


def finca():
    p = Pt('finca')
    p.grid((0, 0, .08), (14, 11), 4, 3, C['dirt'], colorfn=lambda x, y: C['dirt'] if (int((x + 7) // 3.5) + int((y + 5.5) // 3.7)) % 2 == 0 else C['dirtD']) if False else None
    p.box((-2.5, -1.5, -.4), (11, 8.5, .45), C['dirt'], bottom=False)
    # stone corral
    x0, x1, y0, y1 = -7.2, 1.8, -6.5, 1.5
    muro_stones(p, x0, y0, x1 - 2.6, y0, 21)
    muro_stones(p, x1, y0, x1, y1, 22)
    muro_stones(p, x1, y1, x0, y1, 23)
    muro_stones(p, x0, y1, x0, y0, 24)
    # barn
    g = (4.5, 3.8, 3.6, 3.0)
    p.box((4.5, 3.8, -.3), (7.2, 6.0, .9), C['stone'], bottom=False)
    p.box((4.5, 3.8, .6), (7, 5.8, 3.6), C['woodL'], bottom=False, top=False, colors={'s': C['wood'], 'n': C['woodD'], 'e': C['woodL'], 'w': C['woodL']})
    gable2(p, 4.5, 3.8, 7, 5.8, 4.2, 2.6, C['woodL'], True, strips=3, over=.5, rake=.45, t1='tejaD', t2='teja')
    wf(p, g, 'S', -1.5, 1.5, .6, 3.4, C['woodD'], .05)
    wf(p, g, 'S', -1.3, -.05, .7, 3.3, C['door'], .08)
    wf(p, g, 'S', .05, 1.3, .7, 3.3, C['door'], .08)
    Q(p, [(4.5 - 1.3, 3.8 - 3.1, .7), (4.5, 3.8 - 3.1, 3.3), (4.5 - .0, 3.8 - 3.1, .7)], C['woodD'], (4.5, -10, 2)) if False else None
    win(p, g, 'S', 3.0, 2.2, w=.8, h=.9, trim='woodD', sh='woodD', shut=False)
    # hay + troughs
    pajar(p, -4.8, 4.6, 1.6, 2.8, 1)
    pajar(p, -1.8, 5.2, 1.3, 2.3, 2)
    p.box((-3.5, -3.0, 0), (3.2, .8, .7), C['wood'], bottom=False, tcolor=C['turqD'])
    INFO['finca'] = p
    return p


def terraza():
    p = Pt('terraza_cultivo')
    rng = random.Random(9)
    depth = 4.6
    for t in range(3):
        ya = -7.0 + t * depth
        yb = ya + depth
        zt = 1.0 + 1.5 * t
        p.box((0, (ya + yb) / 2, -.5), (16, depth, zt + .5), C['soil'], bottom=False, top=True, tcolor=C['soil'])
        # retaining wall (front) : two courses of dry stone
        cols = (C['stone'], C['stoneL'], C['stoneD'])
        n1 = 5
        for c_ in range(n1):
            a, b = -8 + 16 * c_ / n1, -8 + 16 * (c_ + 1) / n1
            Q(p, [(a, ya - .12, -.5), (b, ya - .12, -.5), (b, ya - .02, zt * .55), (a, ya - .02, zt * .55)], cols[(c_ + t) % 3], (0, ya - 5, 0))
            a2, b2 = a + 1.4, b + 1.4
            Q(p, [(min(a2, 8), ya - .12, zt * .55), (min(b2, 8), ya - .12, zt * .55), (min(b2, 8), ya - .02, zt + .1), (min(a2, 8), ya - .02, zt + .1)], cols[(c_ + 1 + t) % 3], (0, ya - 5, 0))
        Q(p, [(-8, ya - .12, zt + .1), (8, ya - .12, zt + .1), (8, ya + .35, zt + .1), (-8, ya + .35, zt + .1)], C['mossL'], up=True)
        # crop rows
        rows = 5
        rw = (depth - .9) / rows
        for r in range(rows):
            y0 = ya + .55 + r * rw
            y1 = y0 + rw * .78
            ym = (y0 + y1) / 2
            col = (C['crop1'], C['crop3'], C['crop2'], C['crop4'])[(r + t) % 4] if t != 1 else (C['crop3'], C['crop4'], C['crop1'], C['crop2'])[r % 4]
            col2 = col
            zb = zt
            Q(p, [(-7.4, y0, zb), (7.4, y0, zb), (7.4, ym, zb + .5), (-7.4, ym, zb + .5)], col, (0, y0 - 3, zb - 3))
            Q(p, [(-7.4, ym, zb + .5), (7.4, ym, zb + .5), (7.4, y1, zb), (-7.4, y1, zb)], col2, (0, y1 + 3, zb - 3))
    # steps and corner stones
    for i in range(3):
        p.box((7.2, -5.4 + i * 1.6 + 0, -.3), (1.2, 1.4, 1.0 + .6 * i + .3), C['stoneL'], bottom=False) if False else None
    for (x, y) in ((-8, -7.0), (8, -7.0)):
        stone(p, (x, y, -.3), 1.6, 1.4, 1.5, int(abs(x) + 3), tone=(C['stone'], C['stoneL']))
    INFO['terraza_cultivo'] = p
    return p


# ───────────────────────── assemble ─────────────────────────
def build(L):
    parts = []
    rows = []
    # row 0 : houses
    r0 = [
        casa('casa_and_01', 10, 8, fl=1, wall='white', roof='gable', sh='sh_teal', porch=True),
        casa('casa_and_02', 9, 8, fl=2, wall='cream', roof='gable', sh='sh_green', balc=True),
        casa_L('casa_and_03', 'ochre', 'sh_green', mirror=False, porch=False),
        casa('casa_and_04', 11, 9, fl=1, wall='ochre', roof='hip', sh='sh_red', porch=True),
        casa('casa_and_05', 8, 8, fl=2, wall='salmon', roof='hip', sh='sh_blue', balc=True),
        casa('casa_and_06', 7, 12, fl=1, wall='white', roof='gable_y', sh='sh_teal', attic=True),
        casa_L('casa_and_07', 'sage', 'sh_red', mirror=True, porch=True),
        casa_alta('casa_and_08'),
    ]
    rows.append(r0)
    rows.append([iglesia(), plaza(), posada(), puente(), muro_recto(), muro_esquina(), finca(), terraza()])
    rows.append([
        roca('roca_01', [(0, 0, 1.5, 1.3, 1.6), (1.6, 1.0, .8, .7, .8)]),
        roca('roca_02', [(0, 0, 1.2, 1.5, 1.4), (1.5, -.6, 1.0, .9, 1.1), (-1.2, 1.2, .7, .6, .6)]),
        roca('roca_03', [(0, 0, 2.3, 2.0, 2.8), (2.6, 1.0, 1.4, 1.3, 1.6), (-1.6, 2.2, 1.1, 1.0, 1.0)]),
        roca('roca_04', [(0, 0, 2.0, 2.3, 3.6), (2.7, -.8, 1.7, 1.5, 2.0), (-2.4, 1.6, 1.2, 1.1, 1.3)]),
        roca('roca_05', [(0, 0, 3.4, 3.0, 5.2), (3.9, 1.4, 2.0, 1.7, 2.6), (-3.2, 2.6, 1.8, 1.5, 2.2), (1.2, -3.2, 1.3, 1.2, 1.4)]),
        roca('roca_06', [(0, 0, 3.0, 3.4, 6.5), (4.0, -1.0, 2.2, 2.0, 3.4), (-3.4, -1.6, 1.9, 1.7, 2.4), (-.5, 3.4, 1.7, 1.5, 2.0), (2.5, 3.2, 1.2, 1.1, 1.2)]),
    ])
    rows.append([
        pino('pino_s', 6, 1.9, 3, n=7, seed=1),
        pino('pino_m', 10, 2.8, 4, n=8, seed=2),
        pino('pino_l', 15, 3.7, 5, n=8, seed=3),
        arbol('arbol_and_a', 8, 3.6, 3.0, [(0, 0, 5.0, 2.8, 0), (1.9, .6, 4.2, 2.1, 0), (-1.8, -.3, 4.0, 2.0, 0), (.3, .4, 6.6, 1.8, 0)],
              (C['leafD'], C['leaf1'], C['leaf3']), 11),
        arbol('arbol_and_b', 7, 3.8, 2.4, [(0, 0, 4.2, 3.0, 0), (2.4, -.4, 3.5, 2.0, 0), (-2.3, .5, 3.6, 2.1, 0), (.2, -.2, 5.8, 2.0, 0)],
              (C['ol1'], C['ol2'], C['ol3']), 31),
        frailejon('frailejon_01', 1.6, 1.0, 5),
        frailejon('frailejon_02', 2.8, 1.12, 9),
        frailejon('frailejon_03', 3.8, 1.15, 14, branch=True),
    ])
    rows.append([arbusto('arbusto_a', 'a'), arbusto('arbusto_b', 'b'), arbusto('arbusto_c', 'c'), cascada(), rapidos(), estacion_cima(), estacion_valle()])
    for ri, row in enumerate(rows):
        for ci, part in enumerate(row):
            part.loc = (ci * 26.0, -ri * 34.0, 0)
            parts.append(part)
    # record bounds (local) before the lib consumes the bmeshes
    for part in parts:
        vs = [v.co for v in part.bm.verts]
        lo = [min(v[i] for v in vs) for i in range(3)]
        hi = [max(v[i] for v in vs) for i in range(3)]
        INFO[part.name] = (round(hi[0] - lo[0], 1), round(hi[1] - lo[1], 1), round(hi[2], 1))
    return parts


if __name__ == '__main__':
    info = lib.run(sys.modules[__name__])
    out = os.path.join(lib.MODEL_DIR, 'andes_kit_manifest.md')
    lines = ['# andes_kit manifest', '', 'Vertex colours only; origin = base centre (bases buried 0.5); front faces -Y; 1 unit = 1 map unit.', '',
             '| Part | tris | footprint (x by y) | height |', '|---|---|---|---|']
    for k, t in info['per_mesh'].items():
        fp = INFO.get(k)
        if isinstance(fp, tuple):
            lines.append('| %s | %d | %s x %s | %s |' % (k, t, fp[0], fp[1], fp[2]))
    lines += ['', 'Total: %d tris.' % info['tris']]
    with open(out, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('MANIFEST written', out)
