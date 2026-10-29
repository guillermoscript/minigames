"""delta_kit: hero instanceable kit for the DELTA AMACURO (Orinoco delta) of LA FIESTA.
Warao stilt houses, boardwalks, pier, dugout canoes, wading birds, mangrove clumps, mini-islands, sand bars, rocks, nets, log.
Each Part is one instanceable piece (origin = base centre at z=0 = water level; stilts to z=-1.5; deck z=2.4; front faces -Y; canoes bow +X).
Preview/occlusion ground sits at z=-1 (olive tidal water bed). Vertex colours only."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'delta_kit'
GROUND = 0x8a9a5a
GROUND_Z = -1.0
PREVIEW = dict(az=0, pitch=float(os.environ.get('PITCH', '62')), fit=float(os.environ.get('FIT', '0.95')), size=int(os.environ.get('SIZE', '2000')))
AO_DIST = 10.0

DECK = 2.4
# palette
PLANK, PLANKL, PLANKD = 0xb99464, 0xd0ac76, 0x6e5236
POST = 0x5a4430
WALLC, WALLD, WALLL = 0xb8946a, 0x97754e, 0xcaa77a
THATCH, THATCHD, THATCHL = 0xc8aa5a, 0xa58a42, 0xdcc47a
TING, TINGD = 0x9aa4ae, 0x7f8a96
TINR, TINRD = 0xb4552f, 0x8c3f24
DARK = 0x2e2118
SHUT = 0x3f9aa4
SHUT2 = 0xd4a63a
ROPE = 0xd9d0b0
MUD, MUDD, MUDL = 0x7a6a48, 0x5a4e36, 0x8f7e55
ROOTC, ROOTL = 0x72462f, 0x9a5c3c
LOBES = [(0x25602c, 0x3a8236), (0x1f5028, 0x2f7230), (0x34702a, 0x58963a), (0x477f2c, 0x88b83c), (0x2c6a35, 0x4a9040)]
TRK, TRKD = 0x9a8a62, 0x6e5e3e
FROND, FRONDL, FRONDD = 0x4a9a3e, 0x7fb34a, 0x2c6f32
SAND, SANDL, SANDW, SANDD = 0xe2cb8e, 0xefdcA4, 0xb8a470, 0x8f8050
ROCK, ROCKL, ROCKD = 0x6b4a36, 0x8a6648, 0x4a3426
WHITE, WHITED, YEL, SCAR, SCARL, BLK = 0xf6f6f0, 0xd2d8e0, 0xe8b830, 0xe0301f, 0xf2604a, 0x2a2420
SKIN, SKIN2 = 0xc08a5c, 0xa06e46
HAT = 0xdcbc62
CANOE, CANOED, CANOEL, INSIDE = 0x8a5a34, 0x6a4326, 0xb0804e, 0x4a3320
V = lib.Vector


def beam(p, a, b, w, c, s=3):
    p.beam(a, b, w, c, sides=s)


def dface(p, pts, ctop, cbot):
    """double-sided face (top colour facing up, bottom colour facing down)"""
    p.face(pts, ctop, up=True)
    f = p.face([(q[0], q[1], q[2] - .07) for q in pts[::-1]], cbot)
    if f is not None:
        f.normal_update()
        if f.normal.z > 0:
            f.normal_flip()


def jit(n, seed, amp):
    r = random.Random(seed)
    return [r.uniform(-amp, amp) for _ in range(n)]


def ring(cx, cy, z, R, n, sx=1.0, sy=1.0, j=None, rot=0.0):
    out = []
    for i in range(n):
        a = rot + 2 * math.pi * i / n
        k = 1 + (j[i] if j else 0)
        out.append((cx + R * sx * k * math.cos(a), cy + R * sy * k * math.sin(a), z))
    return out


def fan(p, rg, zc, col, cx=0.0, cy=0.0, cols=None):
    c = (cx, cy, zc)
    n = len(rg)
    for i in range(n):
        p.face([c, rg[i], rg[(i + 1) % n]], cols[i % len(cols)] if cols else col, up=True)


# ───────────────────────── vegetation ─────────────────────────
def frond(p, c, a, R, droop, ct, cb, wid=.3):
    d = (math.cos(a), math.sin(a))
    nx, ny = -d[1], d[0]
    x, y, z = c
    m1 = (x + d[0] * R * .48 + nx * R * wid, y + d[1] * R * .48 + ny * R * wid, z + R * .14)
    m2 = (x + d[0] * R * .48 - nx * R * wid, y + d[1] * R * .48 - ny * R * wid, z + R * .14)
    t = (x + d[0] * R, y + d[1] * R, z - droop)
    dface(p, [c, m1, t, m2], ct, cb)


def palm(p, x, y, z0, h, R=3.4, seed=0, nf=5, tw=.3, lean=.35):
    rng = random.Random(seed)
    ang = rng.uniform(0, 6.28)
    lx, ly = math.cos(ang) * lean * h * .2, math.sin(ang) * lean * h * .2
    mid = (x + lx * .35, y + ly * .35, z0 + h * .5)
    top = (x + lx, y + ly, z0 + h)
    beam(p, (x, y, z0), mid, tw, TRK)
    beam(p, mid, top, tw * .8, TRKD)
    c = (top[0], top[1], top[2] + .1)
    for i in range(nf):
        a = ang + 2 * math.pi * i / nf + rng.uniform(-.25, .25)
        frond(p, c, a, R * rng.uniform(.85, 1.1), R * .55, FRONDL if i % 2 else FROND, FRONDD)


def lobe(p, c, r, seed, pal=None, sc=(1.15, 1.1, .78)):
    pal = pal if pal is not None else LOBES[seed % len(LOBES)]
    p.ico(c, r, pal[0], sub=0, sc=sc, jitter=.13, seed=seed, tcolor=pal[1])


def prop_root(p, x0, y0, z0, x1, y1, w=.22, endz=-.8, c=ROOTC):
    k = .62
    mx, my = x0 + (x1 - x0) * k, y0 + (y1 - y0) * k
    mz = max(.9, z0 * .42)
    beam(p, (x0, y0, z0), (mx, my, mz), w, c)
    beam(p, (mx, my, mz), (x1, y1, endz), w * .75, ROOTL if c == ROOTC else ROOTC)


def mound(p, R, n=8, seed=1, top=.4, sx=1, sy=1, cx=0, cy=0, tc=None):
    j = jit(n, seed, .08)
    A = ring(cx, cy, -.4, R, n, sx, sy, j)
    B = ring(cx, cy, top - .1, R * .84, n, sx, sy, j)
    p.loft([A, B], MUDD, colors=[MUD, MUDD, MUDL, MUD])
    fan(p, B, top, tc or MUD, cx, cy, cols=[MUDL, MUD])


def clump(p, seed, R, trees=3, lobes=2, roots=7, palms=1, nf=5, hs=1.0, palm_h=11.0):
    rng = random.Random(seed)
    mound(p, R * .72, n=8, seed=seed, top=.3)
    ph = rng.uniform(0, 6.28)
    pos = []
    for t in range(trees):
        a = ph + 2 * math.pi * t / trees
        r = R * (.34 if trees > 1 else 0)
        pos.append((r * math.cos(a), r * math.sin(a), a))
    nr_each = roots // trees
    extra = roots - nr_each * trees
    for t, (tx, ty, ta) in enumerate(pos):
        h = rng.uniform(4.4, 6.0) * hs
        beam(p, (tx, ty, .3), (tx + rng.uniform(-.3, .3), ty + rng.uniform(-.3, .3), h), .34, ROOTC)
        nr = nr_each + (1 if t < extra else 0)
        for k in range(nr):
            a = ta + 2 * math.pi * (k + rng.uniform(-.2, .2)) / max(1, nr)
            rr = R * rng.uniform(.82, 1.02)
            prop_root(p, tx * .6, ty * .6, h * .62, tx * .35 + rr * math.cos(a), ty * .35 + rr * math.sin(a), w=.27, c=ROOTC if (k + t) % 2 else ROOTL)
        cr = R * (.54 if trees > 1 else .7)
        for l in range(lobes):
            la = ta + l * 2.4 + rng.uniform(-.4, .4)
            off = R * (.22 if l else 0)
            lobe(p, (tx + off * math.cos(la), ty + off * math.sin(la), h + cr * (.3 + .25 * l)), cr * (1 - .1 * l), seed * 11 + t * 3 + l)
    for k in range(palms):
        a = ph + 1.9 + k * 3.1
        r = R * .5
        palm(p, r * math.cos(a), r * math.sin(a), .3, palm_h * rng.uniform(.9, 1.1), R=3.3, seed=seed + k, nf=nf)


def root_cluster(p, seed, stumps, roots, tuft=True):
    rng = random.Random(seed)
    for s, (sx_, sy_) in enumerate(stumps):
        h = rng.uniform(3.0, 3.8)
        beam(p, (sx_, sy_, -.5), (sx_ + .15, sy_, h), .42, ROOTC)
        if tuft:
            lobe(p, (sx_, sy_, h + .7), 1.3, seed + s, pal=LOBES[3], sc=(1.1, 1.1, .8))
        for k in range(roots):
            a = 2 * math.pi * k / roots + rng.uniform(-.25, .25) + s
            rr = rng.uniform(1.8, 2.6)
            prop_root(p, sx_, sy_, h * .8, sx_ + rr * math.cos(a), sy_ + rr * math.sin(a), w=.2, c=ROOTC if k % 2 else ROOTL)


# ───────────────────────── islands / bars / rocks ─────────────────────────
def hutlet(p, cx, cy, z0, rc=TINR, rcd=TINRD):
    """tiny stilt hut standing on an island"""
    for sx in (-1, 1):
        for sy in (-1, 1):
            beam(p, (cx + sx * 1.5, cy + sy * 1.3, z0 - .3), (cx + sx * 1.5, cy + sy * 1.3, z0 + 1.7), .17, POST)
    p.box((cx, cy, z0 + 1.45), (4.0, 3.5, .3), PLANK, bottom=False, tcolor=PLANKL)
    p.box((cx, cy + .2, z0 + 1.75), (3.1, 2.4, 1.7), WALLC, bottom=False, top=False, colors={'n': WALLL, 'e': WALLD, 'w': WALLD})
    roof(p, cx, cy, 3.4, 3.2, z0 + 3.45, 1.4, rc, rcd, WALLD, ov=.4, strips=2)
    p.face([(cx - .5, cy + .2 - 1.2 - .02, z0 + 1.75), (cx + .1, cy + .2 - 1.2 - .02, z0 + 1.75), (cx + .1, cy + .2 - 1.2 - .02, z0 + 3.15), (cx - .5, cy + .2 - 1.2 - .02, z0 + 3.15)], DARK, flip_ref=V((cx, cy + 5, z0 + 2)))


def island(p, seed, R, sx=1.0, sy=1.0, lobes_out=6, lobes_in=3, palms=3, hut=False, nroots=10, nf=5):
    rng = random.Random(seed)
    n = 12
    j = jit(n, seed, .09)
    A = ring(0, 0, -.5, R, n, sx, sy, j)
    B = ring(0, 0, .3, R * .94, n, sx, sy, j)
    C = ring(0, 0, .6, R * .86, n, sx, sy, j)
    D = ring(0, 0, .95, R * .72, n, sx, sy, j)
    # sand fringe on the -Y (front) arc and a patch on one flank
    sandcols = []
    for i in range(n):
        a = 2 * math.pi * i / n
        front = math.sin(a) < -.35
        sandcols.append(SAND if front else MUD)
    p.loft([A, B], MUDD, colors=[MUDD, MUD, MUDD])
    p.loft([B, C], MUD, colors=[SANDW if c == SAND else MUDL for c in sandcols])
    p.loft([C, D], MUD, colors=[SAND if c == SAND else 0x6b7c3a for c in sandcols])
    fan(p, D, 1.05, 0x5f7a36, cols=[0x5f7a36, 0x6b8a3c])
    # canopy: outer ring of lobes + taller inner ones
    ph = rng.uniform(0, 6.28)
    for i in range(lobes_out):
        a = ph + 2 * math.pi * i / lobes_out + rng.uniform(-.2, .2)
        rr = .5 * R
        r = R * rng.uniform(.27, .33)
        lobe(p, (rr * sx * math.cos(a), rr * sy * math.sin(a), 1.2 + r * .55), r, seed * 7 + i)
    for i in range(lobes_in):
        a = ph + 1 + 2 * math.pi * i / lobes_in
        rr = .16 * R
        r = R * rng.uniform(.25, .3)
        lobe(p, (rr * sx * math.cos(a), rr * sy * math.sin(a), 2.8 + r * .5), r, seed * 5 + i + 20)
    # palms poking out of the canopy
    for k in range(palms):
        a = ph + 2.2 * k + .6
        rr = .36 * R
        palm(p, rr * sx * math.cos(a), rr * sy * math.sin(a), 1.0, rng.uniform(11.5, 15), R=4.3, seed=seed + k * 3, nf=nf)
    # root skirt
    for i in range(nroots):
        a = ph + 2 * math.pi * (i + .5) / nroots
        if math.sin(a) < -.35 and i % 2:
            continue
        r0 = R * .8 * (sx if abs(math.cos(a)) > .5 else sy)
        beam(p, (R * .8 * sx * math.cos(a), R * .8 * sy * math.sin(a), 1.5),
             (R * 1.0 * sx * math.cos(a + .06), R * 1.0 * sy * math.sin(a + .06), -.7), .2, ROOTC if i % 2 else ROOTL)
    if hut:
        a = ph + 4.0
        hutlet(p, -.2 * R * sx, .15 * R * sy, 1.0)


def sandbar(p, seed, L, Wd, palms=2, shrubs=2, bend=0.0, log=False, nf=5):
    rng = random.Random(seed)
    n = 12
    j = jit(n, seed, .06)
    def rg(z, k):
        pts = ring(0, 0, z, L / 2 * k, n, 1.0, Wd / L * k, j)
        return [(x, y + bend * (x / (L / 2)) ** 2 * 3, zz) for x, y, zz in pts]
    A, B, C, D = rg(-.4, 1.0), rg(.05, .96), rg(.45, .86), rg(.8, .62)
    p.loft([A, B], SANDD, colors=[SANDD, SANDW])
    p.loft([B, C], SANDW, colors=[SANDW, 0xc8b47a])
    p.loft([C, D], SAND, colors=[SAND, SANDL])
    cy = sum(q[1] for q in D) / n
    fan(p, D, .9, SANDL, cy=cy, cols=[SANDL, SAND])
    for k in range(palms):
        x = (k - (palms - 1) / 2) * L * .28 + rng.uniform(-1, 1)
        palm(p, x, rng.uniform(-.2, .3) * Wd + bend * (x / (L / 2)) ** 2 * 3, .7, rng.uniform(8.5, 11.5), R=3.5, seed=seed + k, nf=nf)
    for k in range(shrubs):
        x = (rng.random() - .5) * L * .6
        y = rng.uniform(-.2, .25) * Wd + bend * (x / (L / 2)) ** 2 * 3
        lobe(p, (x, y, .9 + .8), 1.5 + rng.random() * .4, seed + k + 40, pal=LOBES[3 + k % 2], sc=(1.2, 1.1, .75))
    if log:
        beam(p, (-L * .22, -Wd * .24, .75), (-L * .12, -Wd * .3, .8), .3, 0xa89878, s=5)


def rock(p, seed, w, bush=True):
    rng = random.Random(seed)
    p.ico((0, 0, w * .16), w * .5, ROCK, sub=1, sc=(1.0, .85, .62), jitter=.2, seed=seed, tcolor=ROCKL, cut_below=-w * .05)
    p.ico((w * .5, -w * .15, w * .06), w * .22, ROCKD, sub=0, sc=(1, .9, .7), jitter=.15, seed=seed + 3, tcolor=ROCK)
    if bush:
        lobe(p, (-w * .12, w * .06, w * .5), w * .2, seed + 50, pal=LOBES[3], sc=(1.1, 1.1, .8))


# ───────────────────────── stilt houses ─────────────────────────
def roof(p, cx, cy, w, d, z, h, c1, c2, endc, ov=.5, strips=3, ridge=None):
    shade3 = ((int(((c1 >> 16) & 255) * .8 + 255 * .2) << 16) | (int(((c1 >> 8) & 255) * .8 + 255 * .2) << 8) | int((c1 & 255) * .8 + 255 * .2))
    hw, hd = w / 2 + ov, d / 2 + ov
    ref = V((cx, cy, z + h / 2))
    for sg in (-1, 1):
        for k in range(strips):
            t0, t1 = k / strips, (k + 1) / strips
            p.face([(cx - hw, cy + sg * hd * (1 - t0), z + h * t0), (cx + hw, cy + sg * hd * (1 - t0), z + h * t0),
                    (cx + hw, cy + sg * hd * (1 - t1), z + h * t1), (cx - hw, cy + sg * hd * (1 - t1), z + h * t1)],
                   (c1, c2, c1, shade3)[(k + (sg > 0)) % 4], flip_ref=ref)
    for sx in (-1, 1):
        x = cx + sx * (w / 2 + .03)
        p.face([(x, cy - d / 2, z), (x, cy + d / 2, z), (x, cy, z + h * (d / 2) / hd)], endc, flip_ref=ref)
    if ridge:
        p.box((cx, cy - .22, z + h - .08), (w + 2 * ov + .3, .44, .22), ridge, bottom=False)


def deck(p, cx, cy, W, D, nx=3, brace=True):
    p.cbox((cx, cy, DECK - .3), (W, D, .3), PLANK, ch=.08, tcolor=PLANKL)
    xs = [cx - W / 2 + .5 + (W - 1.0) * i / (nx - 1) for i in range(nx)]
    for x in xs:
        for sy in (-1, 1):
            beam(p, (x, cy + sy * (D / 2 - .45), -1.5), (x, cy + sy * (D / 2 - .45), DECK - .3), .22, POST)
    if brace:
        for sy in (-1, 1):
            beam(p, (xs[0], cy + sy * (D / 2 - .45), .8), (xs[-1], cy + sy * (D / 2 - .45), .8), .1, PLANKD)
    return xs


def ladder(p, x, y_edge, z_top=DECK, reach=1.4, w=.55, rungs=3):
    for sx in (-1, 1):
        beam(p, (x + sx * w / 2, y_edge, z_top + .5), (x + sx * w / 2, y_edge - reach, -.2), .09, PLANKD)
    for k in range(rungs):
        t = (k + 1) / (rungs + 1)
        beam(p, (x - w / 2, y_edge - reach * t, z_top * (1 - t) + .3 * t + .3), (x + w / 2, y_edge - reach * t, z_top * (1 - t) + .3 * t + .3), .07, PLANK)


def facade(p, cx, y_front, x_door, wz, shutters=None, door_w=.9):
    y = y_front - .03
    ref = V((cx, y + 8, DECK + 1))
    # door with light frame
    p.face([(x_door - door_w / 2 - .1, y, DECK), (x_door + door_w / 2 + .1, y, DECK), (x_door + door_w / 2 + .1, y, DECK + 1.75), (x_door - door_w / 2 - .1, y, DECK + 1.75)], PLANKL, flip_ref=ref)
    y -= .02
    p.face([(x_door - door_w / 2, y, DECK), (x_door + door_w / 2, y, DECK), (x_door + door_w / 2, y, DECK + 1.65), (x_door - door_w / 2, y, DECK + 1.65)], DARK, flip_ref=ref)
    if shutters is not None:
        wx = shutters[0]
        p.face([(wx - .55, y, DECK + 1.0), (wx + .55, y, DECK + 1.0), (wx + .55, y, DECK + 1.8), (wx - .55, y, DECK + 1.8)], DARK, flip_ref=ref)
        for s in (-1, 1):
            p.face([(wx + s * .55, y - .02, DECK + 1.0), (wx + s * .95, y - .02, DECK + 1.0), (wx + s * .95, y - .02, DECK + 1.8), (wx + s * .55, y - .02, DECK + 1.8)], shutters[1], flip_ref=ref)


def body(p, cx, cy_back, W, bd, wh=2.5, wc=WALLC):
    cyb = cy_back - bd / 2
    p.box((cx, cyb, DECK), (W, bd, wh), wc, bottom=False, top=False, colors={'n': WALLL, 'e': WALLD, 'w': WALLD, 's': wc})
    # plank lower band
    p.box((cx, cyb, DECK), (W + .1, bd + .1, .5), WALLD, bottom=False, top=False)
    return cyb - bd / 2   # front wall y


def veranda_posts(p, cx, W, y_front_deck, roof_z, roof_h, D_total, ov):
    hd = D_total / 2 + ov
    for sx in (-1, 1):
        x = cx + sx * (W / 2 - .3)
        yy = y_front_deck + .3
        rz = roof_z + roof_h * (1 - abs(yy) / hd) if False else None
    return


def post_to_roof(p, x, y, cy, D, roof_z, roof_h, ov):
    hd = D / 2 + ov
    zt = roof_z + roof_h * (1 - abs(y - cy) / hd)
    beam(p, (x, y, DECK), (x, y, zt), .17, POST)


def hammock(p, x0, x1, y, z, c1, c2):
    mid = (x0 + x1) / 2
    dface(p, [(x0, y, z + .8), (mid, y, z + .1), (mid, y - .7, z + .1), (x0, y - .7, z + .8)], c1, c1)
    dface(p, [(mid, y, z + .1), (x1, y, z + .8), (x1, y - .7, z + .8), (mid, y - .7, z + .1)], c2, c2)


def pot(p, x, y, c=0xb85a30, r=.3):
    p.frustum((x, y, DECK), r, r * .55, r * 1.5, 5, c, tcolor=DARK)


def house(p, W, D, kind, wc=WALLC, nx=3, bdf=.6, ladder_x=0.0, window=True, extras=()):
    cx = cy = 0.0
    deck(p, cx, cy, W, D, nx)
    bd = D * bdf
    yf = body(p, cx, cy + D / 2 - .35, W - 1.2, bd, 2.5, wc)
    facade(p, cx, yf, cx + (W / 4 if window else 0) - .3 * 0, 0, shutters=((-W / 4, (SHUT, SHUT2)[len(extras) % 2]) if window else None))
    rc = dict(thatch=(THATCH, THATCHD, THATCHL), grey=(TING, TINGD, 0x5a6570), rust=(TINR, TINRD, 0x6a3020))[kind]
    rz, rh = DECK + 2.6, 2.1 if kind != 'thatch' else 2.5
    roof(p, cx, cy, W, D, rz, rh, rc[0], rc[1], WALLD, ov=.55, strips=5 if kind != 'thatch' else 4, ridge=rc[2])
    for sx in (-1, 1):
        post_to_roof(p, cx + sx * (W / 2 - .3), cy - D / 2 + .3, cy, D, rz, rh, .55)
    ladder(p, ladder_x, cy - D / 2 - .0)
    hammock(p, cx - W / 2 + .6, cx - W / 2 + 3.0, cy - D / 2 + .5, DECK + .5, 0xd84a3a, 0xf0c040)
    return yf


def hut_wall_front(p, yf):
    pass


def palafito(p, i):
    if i == 1:
        house(p, 7.0, 6.0, 'thatch', nx=3, wc=0xbfa070, ladder_x=1.8)
        pot(p, 2.6, -2.2)
        pot(p, 3.1, -1.8, 0x6a8a5a, .25)
    elif i == 2:
        house(p, 8.0, 6.4, 'grey', nx=3, wc=0xc9a678, ladder_x=-1.5)
        p.box((2.6, -2.2, DECK), (.8, .8, .6), 0xa88a52, top=False, bottom=False, colors={'t': 0x5a7aa0})
        pot(p, 3.4, -2.4)
    elif i == 3:
        house(p, 7.6, 7.4, 'rust', nx=3, bdf=.5, wc=0xb88a62, ladder_x=0.0)
        # railing front
        for sx in (-1, 1):
            beam(p, (sx * 3.4, -3.35, DECK), (sx * 3.4, -3.35, DECK + 1.0), .07, PLANKD)
        beam(p, (-3.4, -3.35, DECK + 1.0), (-1.0, -3.35, DECK + 1.0), .07, PLANKD)
        beam(p, (1.0, -3.35, DECK + 1.0), (3.4, -3.35, DECK + 1.0), .07, PLANKD)
        pot(p, 2.8, -2.0)
    elif i == 4:
        # larger two-room house: rust room + thatch room joined by a deck
        W, D = 10.0, 7.0
        deck(p, 0, 0, W, D, 4, brace=False)
        for k, (cxr, wr, kind) in enumerate(((-2.7, 4.2, 'rust'), (2.7, 4.2, 'thatch'))):
            body(p, cxr, D / 2 - .3, wr, D * .62, 2.5 if k == 0 else 2.2, WALLC if k == 0 else 0xc4a278)
            rc = (TINR, TINRD, 0x6a3020) if kind == 'rust' else (THATCH, THATCHD, THATCHL)
            roof(p, cxr, 0, wr, D, DECK + 2.5 + (0 if k == 0 else -.3), 2.1 if k == 0 else 2.5, rc[0], rc[1], WALLD, ov=.35, strips=3, ridge=rc[2])
        facade(p, -2.7, -D / 2 + D * .62 * 0 + (D / 2 - .3 - D * .62), -2.7, 0, shutters=(-3.7, SHUT))
        facade(p, 2.7, (D / 2 - .3 - D * .62), 3.0, 0, shutters=None)
        for sx in (-1, 1):
            post_to_roof(p, sx * (W / 2 - .3), -D / 2 + .3, 0, D, DECK + 2.5, 2.1 if sx < 0 else 2.2, .35)
        ladder(p, 0.0, -D / 2)
        hammock(p, -4.4, -1.9, -D / 2 + .5, DECK + .5, 0x3a8ad8, 0xf0c040)
    elif i == 5:
        house(p, 6.6, 5.6, 'thatch', nx=3, wc=0xc4a070, ladder_x=2.0)
        # little dugout tied under the deck
        cn = lib.Part  # keep reference silent
        canoe_hull(p, 5.0, 1.0, ox=-.6, oy=-3.7, oz=0, style='small')
        beam(p, (1.8, -3.7, .3), (2.4, -2.5, 1.2), .05, ROPE)
        pot(p, -2.6, -1.8)
    elif i == 6:
        W, D = 7.0, 7.0
        deck(p, 0, 0, W, D, 3)
        p.box((0, D / 2 - 2.1, DECK), (W - 1.2, 3.4, 2.3), 0xc8a574, bottom=False, top=False, colors={'n': WALLL, 'e': WALLD, 'w': WALLD})
        p.frustum((0, 0, DECK + 2.3), (W / 2 + .7) * 1.414, .15, 2.6, 4, THATCH, rz=math.pi / 4, sy=(D + 1.4) / (W + 1.4), bottom=False, ring_colors=[THATCH, THATCHD, THATCHL, THATCHD])
        facade(p, 0, D / 2 - 2.1 - 1.7, 0.6, 0, shutters=(-1.8, SHUT))
        for sx in (-1, 1):
            beam(p, (sx * (W / 2 - .3), -D / 2 + .3, DECK), (sx * (W / 2 - .3), -D / 2 + .3, DECK + 2.1), .17, POST)
        ladder(p, -1.8, -D / 2)
        # drying fish rack + net strips on the veranda
        beam(p, (1.0, -2.6, DECK), (1.0, -2.6, DECK + 1.5), .07, PLANKD)
        beam(p, (3.0, -2.6, DECK), (3.0, -2.6, DECK + 1.5), .07, PLANKD)
        beam(p, (1.0, -2.6, DECK + 1.5), (3.0, -2.6, DECK + 1.5), .07, PLANKD)
        dface(p, [(1.1, -2.6, DECK + 1.45), (2.9, -2.6, DECK + 1.45), (2.8, -2.6, DECK + .6), (1.2, -2.6, DECK + .6)], 0xc8bfa0, 0xa89868)
        hammock(p, -3.2, -.6, -D / 2 + .55, DECK + .5, 0x3a9a6a, 0xe05a3a)


# ───────────────────────── boardwalks ─────────────────────────
PD = 2.3


def planks(p, x0, x1, y0, y1, along_x=True, n=None):
    n = n or int(abs((x1 - x0) if along_x else (y1 - y0)) / .8)
    for k in range(n):
        if along_x:
            a, b = x0 + (x1 - x0) * k / n, x0 + (x1 - x0) * (k + 1) / n
            pts = [(a, y0, PD + .01), (b, y0, PD + .01), (b, y1, PD + .01), (a, y1, PD + .01)]
        else:
            a, b = y0 + (y1 - y0) * k / n, y0 + (y1 - y0) * (k + 1) / n
            pts = [(x0, a, PD + .01), (x1, a, PD + .01), (x1, b, PD + .01), (x0, b, PD + .01)]
        p.face(pts, PLANKL if k % 2 else PLANK, up=True)


def pile(p, x, y, top=PD - .3):
    beam(p, (x, y, -1.5), (x, y, top), .2, POST)


def walkway_x(p, x0, x1, y0, y1, piles_x, rail=True):
    cy = (y0 + y1) / 2
    p.box(((x0 + x1) / 2, cy, PD - .35), (x1 - x0, y1 - y0, .35), PLANKD, top=False, bottom=False)
    planks(p, x0, x1, y0, y1, True)
    for x in piles_x:
        pile(p, x, y0 + .25)
        pile(p, x, y1 - .25)
    if rail:
        for x in piles_x:
            beam(p, (x, y0 + .15, PD), (x, y0 + .15, PD + 1.0), .07, PLANKD)
        beam(p, (piles_x[0], y0 + .15, PD + 1.0), (piles_x[-1], y0 + .15, PD + 1.0), .07, PLANK)


def walkway_y(p, y0, y1, x0, x1, piles_y, rail=True):
    cx = (x0 + x1) / 2
    p.box((cx, (y0 + y1) / 2, PD - .35), (x1 - x0, y1 - y0, .35), PLANKD, top=False, bottom=False)
    planks(p, x0, x1, y0, y1, False)
    for y in piles_y:
        pile(p, x0 + .25, y)
        pile(p, x1 - .25, y)
    if rail:
        for y in piles_y:
            beam(p, (x1 - .15, y, PD), (x1 - .15, y, PD + 1.0), .07, PLANKD)
        beam(p, (x1 - .15, piles_y[0], PD + 1.0), (x1 - .15, piles_y[-1], PD + 1.0), .07, PLANK)


def pasarela_recta(p):
    walkway_x(p, -4, 4, -1, 1, [-3.4, 0, 3.4])


def pasarela_esquina(p):
    walkway_x(p, -4, 1, -1, 1, [-3.4, -1.2], rail=True)
    walkway_y(p, 1, 4, -1, 1, [1.4, 3.6], rail=True)
    # corner square
    p.box((0, 0, PD - .35), (2, 2, .35), PLANKD, top=False, bottom=False)
    planks(p, -1, 1, -1, 1, True, n=3)
    pile(p, -.75, -.75)
    pile(p, .75, -.75)
    pile(p, .75, .75)
    pile(p, -.75, .75)


def muelle(p):
    walkway_x(p, -5, 1.5, -.9, .9, [-4.4, -2.0, 1.1])
    # platform
    p.box((3.5, 0, PD - .35), (4.0, 4.4, .35), PLANKD, top=False, bottom=False)
    planks(p, 1.5, 5.5, -2.2, 2.2, True, n=5)
    for x in (2.0, 5.0):
        for y in (-1.9, 1.9):
            pile(p, x, y)
    # rope post (bollard) + coiled rope + rope hanging into the water
    beam(p, (5.0, -1.9, PD), (5.0, -1.9, PD + 1.5), .2, POST, s=4)
    p.ico((5.0, -1.9, PD + 1.6), .32, ROPE, sub=0)
    beam(p, (5.0, -1.9, PD + 1.2), (5.9, -2.6, .3), .05, ROPE)
    p.box((3.2, 1.4, PD), (.9, .7, .6), 0x7a5a38, top=False, bottom=False, tcolor=0xa88a52)   # crate
    p.frustum((4.2, 1.3, PD), .35, .28, .8, 5, 0x3a7a9a, tcolor=0x2a5a7a)                      # water barrel


# ───────────────────────── canoes ─────────────────────────
def canoe_hull(p, L, Wd, ox=0, oy=0, oz=0, style='dug'):
    """stations along x (bow +X). returns (xs, ws, zg) for placing crew."""
    t = [-1, -.5, 0, .5, 1]
    if style == 'motor':
        ws = [.95, 1.0, 1.0, .85, .12]
        zg = [.85, .8, .8, .95, 1.5]
        zb = [-.25, -.3, -.3, -.25, .35]
    else:
        ws = [.5, .92, 1.0, .85, .14]
        zg = [.62, .5, .45, .55, 1.15]
        zb = [-.12, -.32, -.35, -.25, .25]
    outer, inner = [], []
    for k in range(5):
        x = ox + t[k] * L / 2
        w = ws[k] * Wd / 2
        outer.append([(x, oy - w, oz + zg[k]), (x, oy - w * .55, oz + zb[k]), (x, oy + w * .55, oz + zb[k]), (x, oy + w, oz + zg[k])])
        wi = w * .78
        inner.append([(x, oy - wi, oz + zg[k] - .02), (x, oy - wi * .5, oz + zb[k] + .16), (x, oy + wi * .5, oz + zb[k] + .16), (x, oy + wi, oz + zg[k] - .02)])
    hc = CANOE if style != 'motor' else 0xd0d6de
    hb = CANOED if style != 'motor' else 0x2f6fb8
    p.loft(outer, hc, closed=False, colors=[hc, hb, hc], ref=V((ox, oy, oz + .1)))
    # inside (normals toward the axis)
    for k in range(4):
        for i in range(3):
            a, b = inner[k], inner[k + 1]
            pts = [a[i], a[i + 1], b[i + 1], b[i]]
            f = p.face(pts, INSIDE if i == 1 else CANOEL if style != 'motor' else 0xe8ecf0)
            if f is not None:
                f.normal_update()
                tgt = V((a[0][0], oy, oz + zb[k] + .5)) - f.calc_center_median()
                if f.normal.dot(tgt) < 0:
                    f.normal_flip()
    # gunwale rim strips
    for k in range(4):
        for s in (0, 3):
            a, b = outer[k], outer[k + 1]
            ia, ib = inner[k], inner[k + 1]
            p.face([a[s], b[s], ib[s], ia[s]], CANOEL if style != 'motor' else 0xf6f8fa, up=True)
    return [ox + tk * L / 2 for tk in t], ws, zg


def person(p, x, y, z, shirt, hat=False, seated=False, face=1, arms=True, skin=SKIN):
    if seated:
        p.box((x, y, z + .05), (.6, .5, .55), 0x3a4a6a, bottom=False)                    # legs/hips
        p.box((x, y, z + .55), (.7, .5, .9), shirt, bottom=False, tcolor=shirt)
        hz = z + 1.75
    else:
        p.box((x, y, z), (.55, .4, 1.25), 0x3a4a6a, bottom=False, top=False)
        p.box((x, y, z + 1.25), (.7, .5, 1.2), shirt, bottom=False, tcolor=shirt)
        hz = z + 2.7
    p.ico((x + .05 * face, y, hz), .36, skin, sub=0, sc=(1, 1, 1.05), bands=lambda zc, r: 0x2a2420 if zc > .3 else skin)
    if hat:
        p.frustum((x, y, hz + .2), .62, 0, .7, 6, HAT, tcolor=HAT, ring_colors=[HAT, 0xc4a44a])


def canoa(p, kind):
    if kind == 'a':
        canoe_hull(p, 8.0, 1.5)
        p.box((-.5, 0, .1), (.3, 1.2, .14), CANOEL, bottom=False)
        p.box((1.9, 0, .1), (.3, 1.1, .14), CANOEL, bottom=False)
        beam(p, (-.2, .3, .2), (-.2, -.5, .6), .07, 0x6a4a2a)
        # paddle resting across
        beam(p, (-1.8, -.6, .45), (.2, .35, .3), .06, 0xb08850)
        p.face([(-2.1, -.8, .45), (-1.7, -.8, .5), (-1.55, -.5, .45), (-1.95, -.45, .4)], 0xc89a58, up=True)
    elif kind == 'b':
        canoe_hull(p, 8.0, 1.5)
        person(p, -.6, 0, .15, 0xd84a3a, hat=True)
        beam(p, (-.2, -.45, 2.4), (.9, -1.1, -.7), .07, 0xb08850)
        beam(p, (-.5, .45, 2.2), (-.2, -.45, 2.4), .07, SKIN)
        beam(p, (-.8, .35, 1.9), (-.6, .45, 2.4), .07, SKIN) if False else None
        dface(p, [(.7, -1.1, -.4), (1.2, -1.15, -.55), (1.1, -1.4, -.95), (.65, -1.25, -.8)], 0xc89a58, 0xa07838)
    elif kind == 'c':
        canoe_hull(p, 8.4, 1.6)
        person(p, -1.4, 0, .15, 0x3a8ad8, seated=True, hat=True)
        person(p, 1.0, 0, .15, 0xf0c040, seated=True)
        # draped fishing net with floats
        dface(p, [(2.5, -.5, .75), (3.7, -.2, .55), (3.5, .6, .5), (2.4, .55, .7)], 0xd0c8a0, 0xa89868)
        dface(p, [(.2, -.55, .55), (.3, .55, .55), (-.7, .5, .8), (-.6, -.5, .8)], 0xb8b090, 0x88805c)
        for k, c in enumerate((0xe05a3a, 0xf0c040, 0xe05a3a)):
            p.ico((2.6 + k * .45, -.2 + (k % 2) * .3, .85), .13, c, sub=0)
        beam(p, (1.2, .3, 1.5), (2.8, 1.5, 2.8), .04, 0x6a4a2a)
    else:
        canoe_hull(p, 10.0, 2.0, style='motor')
        p.box((1.6, 0, .15), (.5, 1.7, .16), 0xe8ecf0, bottom=False)
        p.box((-.8, 0, .15), (.5, 1.7, .16), 0xe8ecf0, bottom=False)
        person(p, -2.6, .1, .15, 0xf0c040, seated=True, hat=False)
        p.box((-4.9, 0, .55), (.45, 1.2, .8), 0x2a2e36, bottom=False, tcolor=0x4a5060)                 # transom
        p.box((-5.35, 0, .2), (.8, .8, 1.0), 0xd02a2a, bottom=False, tcolor=0xe84a3a)                  # engine
        beam(p, (-5.3, 0, .3), (-5.3, 0, -1.0), .12, 0x6a707c)
        p.box((-5.45, 0, -1.2), (.5, .3, .35), 0x5a606c, bottom=False)
        beam(p, (-5.3, .1, .9), (-3.2, .4, .75), .06, 0x2a2e36)
        p.box((.4, .55, .15), (.7, .5, .4), 0x3a7a3a, bottom=False, tcolor=0x4a8a4a)                    # fuel tank


# ───────────────────────── birds ─────────────────────────
def bird(p, kind):
    if kind == 'ibis':
        body, bodyL, legc, sz = SCAR, SCARL, 0xc87860, 1.0
    elif kind == 'c':
        body, bodyL, legc, sz = 0x8a9ab0, 0xa8b6c8, 0x3a3430, 1.0
    else:
        body, bodyL, legc, sz = WHITE, 0xffffff, 0x3a3430, 1.0
    lz = 2.1 if kind != 'ibis' else 1.6
    bz = lz + .55
    p.ico((0, 0, bz), 1.1, body, sub=0, sc=(1.45, .6, .62), tcolor=bodyL)
    for sy in (-1, 1):
        beam(p, (.15, sy * .22, lz + .1), (.2 if kind != 'b' else .3, sy * .22, 0.0), .06, legc)
        beam(p, (.15, sy * .22, lz + .1), (.15, sy * .22, bz - .2), .12, body)
        p.face([(.2, sy * .22, .03), (.75, sy * .1, .03), (.05, sy * .5, .03)], legc, up=True)
        # folded wing
        p.face([(.9, sy * .55, bz + .3), (-1.4, sy * .6, bz + .05), (-.3, sy * .75, bz - .3)], bodyL if kind != 'ibis' else SCARL, flip_ref=V((0, 0, bz)))
        p.face([(-.3, sy * .75, bz - .3), (-1.4, sy * .6, bz + .05), (-1.9, sy * .5, bz - .25)], body if kind != 'ibis' else BLK, flip_ref=V((0, 0, bz)))
    p.face([(-1.3, 0, bz + .1), (-2.2, .35, bz - .2), (-2.2, -.35, bz - .2)], bodyL, up=True)
    sh = (1.1, 0, bz + .3)
    if kind == 'a':
        neck = [(1.45, 0, bz + 1.2), (1.8, 0, bz + 2.1), (2.0, 0, bz + 2.8)]
        hd = (2.0, 0, bz + 2.95); beak = (3.2, 0, bz + 2.8)
    elif kind == 'b':
        neck = [(1.9, 0, bz + .7), (2.7, 0, bz + .5), (3.1, 0, bz - .5)]
        hd = (3.15, 0, bz - .7); beak = (3.3, 0, bz - 2.0)
    elif kind == 'c':
        neck = [(.9, 0, bz + 1.2), (1.9, 0, bz + 1.7), (1.5, 0, bz + 2.6)]
        hd = (1.6, 0, bz + 2.85); beak = (2.9, 0, bz + 2.55)
    else:
        neck = [(1.6, 0, bz + .8), (2.0, 0, bz + 1.5), (2.2, 0, bz + 1.9)]
        hd = (2.2, 0, bz + 2.0); beak = None
    pts = [sh] + neck
    for i in range(len(pts) - 1):
        beam(p, pts[i], pts[i + 1], .22, body if kind != 'ibis' else SCARL)
    p.ico(hd, .32, body, sub=0)
    if kind == 'ibis':
        mid = (hd[0] + .7, 0, hd[2] - .1)
        beam(p, hd, mid, .12, 0x4a3a34)
        beam(p, mid, (mid[0] + .7, 0, mid[2] - .65), .09, 0x4a3a34)
    else:
        beam(p, hd, beak, .12, YEL if kind != 'c' else 0xc8a040)
    if kind == 'a':   # breeding plumes
        p.face([(-1.0, 0, bz + .5), (-2.6, .1, bz + .1), (-1.6, 0, bz + .2)], WHITED, flip_ref=V((0, 5, bz)))


# ───────────────────────── props ─────────────────────────
def red_pesca(p):
    for sx in (-1, 1):
        for sy in (-1, 1):
            beam(p, (sx * 2.7, sy * 1.4, -.5), (sx * 2.7, sy * .15, 4.5), .15, POST)
    beam(p, (-3.2, 0, 4.5), (3.2, 0, 4.5), .12, PLANKD)
    for sy, nm in ((-1, 0), (1, 1)):
        for k in range(3):
            a, b = -3.0 + 2.0 * k, -3.0 + 2.0 * (k + 1)
            c1, c2 = (0xd0c8a0, 0xa89868) if k % 2 == 0 else (0xc0b88a, 0x988858)
            dface(p, [(a, sy * .15, 4.4), (b, sy * .15, 4.4), (b - .1, sy * 1.3, .9 + .25 * k), (a + .1, sy * 1.3, .9 + .15 * ((k + 1) % 2))], c1, c2)
    for k in range(3):
        p.ico((-2.0 + 2.0 * k, -1.35, 1.0), .16, 0xe05a3a if k % 2 else 0xf0c040, sub=0)
    p.box((0, 0, -.2), (7.4, 3.6, .35), MUD, bottom=False, tcolor=MUDL)


def tronco(p):
    n = 6
    st = [(-3.0, .5, -.1), (-1.0, .62, .0), (1.0, .55, .15), (3.0, .38, .4)]
    rings = []
    for x, r, z in st:
        rings.append([(x, r * math.cos(2 * math.pi * i / n + .3), z + r * math.sin(2 * math.pi * i / n + .3)) for i in range(n)])
    p.loft(rings, 0x7a6a56, caps=(True, True), colors=[0x8a7a62, 0x6a5a46, 0x9a8a70, 0x6a5a46, 0x7a6a56, 0x5a4a38], ref=V((0, 0, .1)))
    beam(p, (-.4, .3, .4), (-.9, 1.2, 1.5), .13, 0x6a5a46)
    beam(p, (.8, -.2, .5), (1.6, -1.0, 1.4), .12, 0x6a5a46)
    p.ico((-1.8, 0, .5), .5, 0x4a7a36, sub=0, sc=(1.2, .9, .45), jitter=.1, seed=3)      # moss
    beam(p, (.2, 0, .55), (.5, 0, 1.45), .2, 0x6a5a46)                                    # perch stub
    p.face([(.2, -.3, 1.45), (.8, -.3, 1.45), (.8, .3, 1.45), (.2, .3, 1.45)], 0x8a7a62, up=True)


# ───────────────────────── build ─────────────────────────
def build(L):
    parts = []
    X = lambda i, n, s=28: (i - (n - 1) / 2) * s
    only = os.environ.get('ONLY')

    def add(name, row, i, n, fn, s=28, *a, **k):
        if only and not any(name.startswith(o) for o in only.split(',')):
            return
        close = float(os.environ.get('CLOSE', '0'))
        if close:
            loc = (len(parts) * close, 0, 0)
        else:
            loc = (X(i, n, s), -34 * row, 0)
        p = L.Part(name, loc=loc, ao=0.0)
        fn(p, *a, **k)
        parts.append(p)

    for i in range(1, 7):
        add('palafito_%02d' % i, 0, i - 1, 6, palafito, 28, i)
    add('pasarela_recta', 1, 0, 6, pasarela_recta)
    add('pasarela_esquina', 1, 1, 6, pasarela_esquina)
    add('muelle_delta', 1, 2, 6, muelle)
    add('red_pesca', 1, 3, 6, red_pesca)
    add('tronco_flotante', 1, 4, 6, tronco)
    for i, k in enumerate('abc'):
        add('canoa_' + k, 2, i, 8, canoa, 28, k)
    add('canoa_motor', 2, 3, 8, canoa, 28, 'motor')
    for i, k in enumerate('abc'):
        add('garza_' + k, 2, 4 + i, 8, bird, 28, k)
    add('ibis_roja', 2, 7, 8, bird, 28, 'ibis')
    CL = [(4.0, 2, 2, 5, 0, 5, 1.0), (4.6, 2, 2, 6, 1, 5, .95), (5.4, 3, 2, 7, 1, 5, 1.0), (6.0, 3, 2, 7, 1, 5, 1.1),
          (6.6, 3, 2, 6, 2, 4, 1.0), (7.0, 3, 2, 8, 1, 5, 1.15), (7.6, 3, 2, 6, 2, 4, 1.05), (8.0, 3, 2, 7, 2, 4, 1.2)]
    for i, (R, tr, lb, rt, pm, nf, hs) in enumerate(CL):
        add('mangle_clump_%02d' % (i + 1), 3, i, 8, clump, 28, 100 + i * 7, R, tr, lb, rt, pm, nf, hs)
    add('mangle_raices_a', 4, 0, 6, root_cluster, 28, 5, [(0, 0)], 8)
    add('mangle_raices_b', 4, 1, 6, root_cluster, 28, 9, [(-1.0, .3), (1.2, -.4)], 4)
    for i, w in enumerate((5, 6.5, 4, 8)):
        add('roca_delta_%02d' % (i + 1), 4, 2 + i, 6, rock, 28, 30 + i, w, i != 2)
    IS = [(9.6, 1.0, 1.0, 5, 2, 2, False, 8), (12.0, 1.0, .74, 5, 3, 2, True, 8), (13.2, 1.0, .85, 6, 3, 3, False, 10),
          (15.5, 1.0, .72, 6, 3, 3, True, 9), (14.8, 1.0, 1.0, 6, 3, 4, False, 10), (15.8, 1.0, .75, 7, 3, 3, True, 9)]
    for i, (R, sx, sy, lo, li, pm, hut, nr) in enumerate(IS):
        add('isla_manglar_%02d' % (i + 1), 5, i, 6, island, 36, 200 + i * 13, R, sx, sy, lo, li, pm, hut, nr)
    BA = [(16, 7, 3, 2, 0, False), (22, 9, 3, 3, .15, True), (26, 10, 2, 2, -.2, False), (28, 11, 4, 3, .0, False)]
    for i, (Lg, Wd, pm, sh, bd, lg) in enumerate(BA):
        add('banco_arena_%02d' % (i + 1), 6, i, 4, sandbar, 32, 300 + i * 9, Lg, Wd, pm, sh, bd, lg)
    return parts


def write_manifest():
    import bpy
    rows = []
    for o in sorted(bpy.data.collections['prop'].objects, key=lambda o: o.name):
        me = o.data
        tris = sum(len(q.vertices) - 2 for q in me.polygons)
        xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
        rows.append((o.name, tris, max(xs) - min(xs), max(ys) - min(ys), min(zs), max(zs)))
    tot = sum(r[1] for r in rows)
    out = ['# delta_kit manifest', '',
           'File: `assets/models/delta_kit.glb` (source `tools/blender/prop_delta_kit.py`). 1 unit = 1 map unit. Origin = base centre, z=0 = water level; front faces -Y; canoes/birds bow/head +X.',
           'Grid in the file: one row per category, x spacing 28 (36 islands, 32 sand bars), y spacing -34. `pasarela_esquina` origin = the corner square centre (arms go -X and +Y).',
           'Stilt houses: stilt feet z=-1.5, deck top z=2.4. Boardwalks: deck top z=2.3. Mangrove roots end z=-0.8. Islands/sand bars: mud/sand bank z=-0.5..~1.',
           '', '| Part | tris | footprint (x by y) | height (z min..max) |', '|---|---|---|---|']
    for n, t, w, d, z0, z1 in rows:
        out.append('| %s | %d | %.1f x %.1f | %.1f (%.1f..%.1f) |' % (n, t, w, d, z1 - z0, z0, z1))
    out += ['', 'Total: **%d tris** in %d parts.' % (tot, len(rows))]
    path = os.path.join(lib.MODEL_DIR, 'delta_kit_manifest.md')
    open(path, 'w').write('\n'.join(out) + '\n')
    for r in rows:
        print('TRIS %-20s %4d  %5.1fx%5.1f h=%.1f' % (r[0], r[1], r[2], r[3], r[5] - r[4]))


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
    if not os.environ.get('ONLY'):
        write_manifest()
    else:
        write_manifest()
