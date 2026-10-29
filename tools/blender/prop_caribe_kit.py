"""caribe_kit: hero instanceable kit for the Venezuelan Caribbean / Oriental coast (Margarita, Mochima, Los Roques, Cumana,
Puerto La Cruz, Carupano): colonial harbour houses, beach houses, church/chapel, lighthouse, star fort, promenades, piers,
rocky islets, sea rocks, sand cays, coastal scrub, cacti, seagrape and boats.
Each Part = one instanceable piece. Land pieces: origin = base centre, bases buried 0.5. Marine pieces: waterline z=0.
Front = -Y. Boats: bow +X, keel at z=0. Writes assets/models/caribe_kit_manifest.md as a side effect of build()."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from prop_palmas_coco import xf
import prop_barcos as BB

NAME = 'caribe_kit'
GROUND = 0xe3d3a0
PREVIEW = dict(az=0, pitch=62, fit=0.95, size=2000)
AO_DIST = 10

LIFT = 1.12   # pre-compensates the baked AO/shadow so hero colours read bright (the pipeline darkens ~20%)
V = lib.Vector
INFO = {}

# ───────────────────────── palette ─────────────────────────
H = dict(
    Y=0xf2c744, W=0xf6f1e4, O=0xec8a3c, B=0x9bcbe6, S=0xf0a58f, M=0xa4dcc0, R=0xd9473b, K=0xdfae4e, P=0xf0b3c0,
    T=0x78c7c4, C=0xf3e2b8, G=0xc9ccd2,
    tile=0xd2663a, tileD=0xb24a2c, tileL=0xe58552, flat=0xc9c2b2,
    stone=0x9a9484, stoneL=0xc2baa4, stoneD=0x7c776a, glass=0x4a7ea8, glassD=0x2f5478, dark=0x3b2e28, door=0x7a4a2a,
    sand=0xf1e6c4, sandD=0xe2d2a4, sandW=0xd0bd88, shal=0x9fe6dc, shal2=0x7fd6d8, foam=0xf6fcfb, foamB=0xcdeaf2,
    rock=0xa68f72, rockL=0xc4ae8c, rockD=0x7a644c, rockDD=0x5e4d3b,
    grass=0x5f9a42, grassL=0x86bd55, grassD=0x44803a, dry=0xa9a05a, dryD=0x857c40, dryL=0xc5b86c,
    palm=0x4a9a48, palmL=0x6bb25a, palmD=0x2f7a3a, trunk=0x8a6a45, trunkD=0x6f5236,
    wood=0x7a5230, woodL=0xa57a4a, woodD=0x5a3a20, thatch=0xcfa85a, thatchD=0xa88442,
    white=0xf4f2ea, red=0xd9453a, navy=0x2a4a8a, blue=0x2f6fd0, yellow=0xf2c84b, steel=0x30343c, coral=0xe8725a,
    teal=0x2fa8a0, cream=0xf6edd6, plaza=0xd9cdb0, plazaD=0xc8b994, gold=0xf0b830, goldD=0xc8901c,
)


def reg(name, w, d, h):
    INFO[name] = (w, d, h)


def stats(p):
    xs = [v.co.x for v in p.bm.verts]
    ys = [v.co.y for v in p.bm.verts]
    zs = [v.co.z for v in p.bm.verts]
    tris = sum(len(f.verts) - 2 for f in p.bm.faces)
    return tris, max(xs) - min(xs), max(ys) - min(ys), max(zs)


# ───────────────────────── generic helpers ─────────────────────────
def wq(p, B, side, u0, u1, za, zb, col, off=0.04, arch=0.0):
    """Wall-attached quad/arch on one side of box B=(cx,cy,w,d). u = along-wall offset from the wall centre."""
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


def wallbox(p, cx, cy, w, d, z0, z1, col, step=3.0, levels=None, back=True):
    """4 walls split into horizontal bands (more vertices -> the AO bake stays bright mid-wall). No top/bottom."""
    if levels is None:
        nb = max(1, int(round((z1 - z0) / step)))
        levels = [z0 + (z1 - z0) * i / nb for i in range(nb + 1)]
    ref = V((cx, cy, (z0 + z1) / 2))
    hx, hy = w / 2, d / 2
    sides = [((cx - hx, cy - hy), (cx + hx, cy - hy)), ((cx + hx, cy - hy), (cx + hx, cy + hy)),
             ((cx + hx, cy + hy), (cx - hx, cy + hy)), ((cx - hx, cy + hy), (cx - hx, cy - hy))]
    for si, (a, b) in enumerate(sides):
        lv = levels if (si != 2 or back) else [z0, z1]
        for k in range(len(lv) - 1):
            p.face([(a[0], a[1], lv[k]), (b[0], b[1], lv[k]), (b[0], b[1], lv[k + 1]), (a[0], a[1], lv[k + 1])], col, flip_ref=ref)


def band(p, cx, cy, w, d, z, h, col, ov=.2, sides=4):
    """Open box band (no top/bottom) = cornice / string course."""
    p.box((cx, cy, z), (w + 2 * ov, d + 2 * ov, h), col, bottom=False, top=False)


def hip(p, cx, cy, w, d, z, rh, c1, c2, ov=.45, top_scale=.34, bands=2, topc=None):
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
    """Gable with ridge along X (slopes face +-Y). Gable ends in wall colour."""
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
    """Gable with ridge along Y (slopes face +-X)."""
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


def parapet(p, cx, cy, w, d, z, hgt, thk, topc, wallc, inc, floorc, ov=.12):
    ow, od = w + 2 * ov, d + 2 * ov
    iw, idp = ow - 2 * thk, od - 2 * thk

    def ring(a, b, zz):
        return [(cx - a / 2, cy - b / 2, zz), (cx + a / 2, cy - b / 2, zz), (cx + a / 2, cy + b / 2, zz), (cx - a / 2, cy + b / 2, zz)]
    r0, r1, i1, i0 = ring(ow, od, z - .4), ring(ow, od, z + hgt), ring(iw, idp, z + hgt), ring(iw, idp, z)
    ref = V((cx, cy, z + hgt / 2))
    p.loft([r0, r1], wallc, ref=ref)
    p.loft([r1, i1], topc, ref=ref)
    for i in range(4):
        j = (i + 1) % 4
        pts = [i1[i], i1[j], i0[j], i0[i]]
        c = sum((V(q) for q in pts), V()) / 4
        o = V((c.x - cx, c.y - cy, 0))
        p.face(pts, inc, flip_ref=c + o.normalized() * 10)
    p.face(i0, floorc, shade=.96, up=True)


def tank(p, c, r, h, col=0x30343c, lid=0x8a93a3, n=5):
    p.frustum(c, r, r * .92, h, n, col, tcolor=lid, bottom=False)


def dome(p, c, r, hz, n, rings, c1, c2, rz=0.0, ref_dz=-1.0):
    cx, cy, cz = c
    rs = []
    for k in range(rings):
        a = (math.pi / 2) * k / rings
        rr, zz = r * math.cos(a), cz + hz * math.sin(a)
        rs.append([(cx + rr * math.cos(rz + 2 * math.pi * i / n), cy + rr * math.sin(rz + 2 * math.pi * i / n), zz) for i in range(n)])
    ref = V((cx, cy, cz + ref_dz))
    p.loft(rs, c1, closed=True, colors=[c1, c2], ref=ref)
    apex = (cx, cy, cz + hz)
    for i in range(n):
        p.face([rs[-1][i], rs[-1][(i + 1) % n], apex], c1 if i % 2 == 0 else c2, flip_ref=ref)


def arc_pt(cx, cy, r, a, z):
    return (cx + r * math.cos(a), cy + r * math.sin(a), z)


# ───────────────────────── palm / plants ─────────────────────────
def palm(p, x, y, z=0.0, h=7.0, lean=(0.0, 0.0), s=1.0, seed=0, nfr=6, fl=4.2):
    """Cheap hero palm: 3-ring square trunk (~16 tris) + nfr drooping fronds (4 tris each)."""
    rng = random.Random(seed)
    pts = [(x + lean[0] * t ** 1.6, y + lean[1] * t ** 1.6, z + h * t) for t in (0, .5, 1)]
    radii = (.46 * s, .34 * s, .27 * s)
    rings = [[(c[0] + r * math.cos(a), c[1] + r * math.sin(a), c[2]) for a in (.4, .4 + 1.571, .4 + 3.142, .4 + 4.712)] for c, r in zip(pts, radii)]
    p.loft(rings, H['trunk'], colors=[H['trunk'], H['trunkD'], H['trunk'], H['trunkD']], ref=V((x, y, z + h * .5)))
    top = pts[-1]
    a0 = rng.random() * 6.28
    for i in range(nfr):
        a = a0 + 2 * math.pi * i / nfr + (rng.random() - .5) * .4
        L2 = fl * s * (.85 + .25 * rng.random())
        d = (math.cos(a), math.sin(a))
        n = (-d[1], d[0])
        wd = .85 * s
        b = (top[0], top[1], top[2] + .25 * s)
        mid = (top[0] + d[0] * L2 * .55, top[1] + d[1] * L2 * .55, top[2] + L2 * .22 + .3 * s)
        ml = (mid[0] + n[0] * wd, mid[1] + n[1] * wd, mid[2] - wd * .45)
        mr = (mid[0] - n[0] * wd, mid[1] - n[1] * wd, mid[2] - wd * .45)
        tip = (top[0] + d[0] * L2, top[1] + d[1] * L2, top[2] - L2 * .22)
        cA, cB = (H['palm'], H['palmL']) if i % 2 == 0 else (H['palmD'], H['palm'])
        p.face([b, ml, mid], cA, up=True)
        p.face([b, mid, mr], cB, up=True)
        p.face([ml, tip, mid], cB, up=True)
        p.face([mid, tip, mr], cA, up=True)
    p.ico((top[0] + .2 * s, top[1] + .15 * s, top[2] - .15 * s), .26 * s, 0x5a3a20, sub=0, seed=seed + 2) if False else None


def bush(p, x, y, z, r, col=None, col2=None, seed=1, sz=.7):
    p.ico((x, y, z), r, col if col is not None else H['grassD'], sub=0, sc=(1, 1, sz), jitter=.15, seed=seed,
          tcolor=col2 if col2 is not None else H['grassL'])


# ───────────────────────── rocks / foam / sand ─────────────────────────
def foam_ring(p, cx, cy, rx, ry, n=10, w=1.6, seed=3, z=.07, bend=0.0, inner=.9):
    """Flat white foam skirt around a body at the waterline."""
    rng = random.Random(seed)
    a = [(rng.uniform(.85, 1.15), rng.uniform(.8, 1.2)) for _ in range(n)]
    ang = lambda i: 2 * math.pi * i / n

    def pt(i, k):
        m = (inner + (k * w / max(rx, ry))) * a[i % n][0] if k else inner * .96
        x = cx + rx * m * math.cos(ang(i))
        y = cy + ry * m * math.sin(ang(i)) + bend * ((x - cx) / max(rx, 1)) ** 2
        return (x, y, z)
    for i in range(n):
        j = (i + 1) % n
        p.face([pt(i, 0), pt(i, 1), pt(j, 1), pt(j, 0)], H['foam'] if i % 3 else H['foamB'], up=True)


def rock_mass(p, cx, cy, rx, ry, h, n=8, seed=1, z0=-.4, grass=0.0, jit=.16, bend=0.0, rot=0.0,
              prof=((0, 1.12), (.34, 1.0), (.68, .82), (1.0, .58)), cap=None, topjit=.07, tilt=(0, 0)):
    """Faceted rock mass: loft of irregular rings. Band 0 wet-dark, middle rock, top band grass (grass = fraction) or light rock."""
    rng = random.Random(seed)
    rings = []
    for k, (t, rf) in enumerate(prof):
        z = z0 + (h - z0) * t
        ring = []
        for i in range(n):
            a = 2 * math.pi * i / n + rot + k * .28
            m = rf * (1 + rng.uniform(-jit, jit))
            x = cx + rx * m * math.cos(a) + tilt[0] * t
            y = cy + ry * m * math.sin(a) + bend * ((rx * m * math.cos(a)) / max(rx, 1)) ** 2 + tilt[1] * t
            zz = z + (rng.uniform(-topjit, topjit) * h if 0 < k else 0)
            ring.append((x, y, zz))
        rings.append(ring)
    ref = V((cx + tilt[0] * .5, cy + tilt[1] * .5, (z0 + h) * .35))
    nb = len(prof) - 1
    for k in range(nb):
        if k == 0:
            cols = [H['rockD'], H['rockDD'], H['rockD']]
        elif k == nb - 1 and grass > 0:
            cols = [H['grass'] if rng.random() < grass else H['rockL'] for _ in range(n)]
        else:
            cols = [rng.choice((H['rock'], H['rockL'], H['rock'], H['rockD'])) for _ in range(n)]
        p.loft(rings[k:k + 2], cols[0], colors=cols, ref=ref)
    top = rings[-1]
    if cap is not False:
        if cap is None:
            ctr = (sum(q[0] for q in top) / n, sum(q[1] for q in top) / n, sum(q[2] for q in top) / n + .07 * h)
            cc = [H['grassL'], H['grass'], H['grassL'], H['grassD']] if grass > 0 else [H['rockL'], H['rock']]
            for i in range(n):
                p.face([top[i], top[(i + 1) % n], ctr], cc[i % len(cc)], up=True)
        else:
            p.face(top, cap, up=True)
    return rings


def beach(p, cx, cy, r, a0, a1, wd=2.4, n=6, z=.55, seed=2):
    """Sand crescent hugging a rock body between angles a0..a1 (radians)."""
    rng = random.Random(seed)
    inner, outer = [], []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        k = 1 + (rng.random() - .5) * .12
        taper = math.sin(math.pi * i / n) * .6 + .4
        inner.append(arc_pt(cx, cy, r * .9, a, z))
        outer.append(arc_pt(cx, cy, r * .9 + wd * taper * k, a, .12))
    for i in range(n):
        p.face([inner[i], inner[i + 1], outer[i + 1], outer[i]], H['sand'] if i % 2 == 0 else H['sandD'], up=True)


def sand_island(p, cx, cy, rx, ry, h=1.0, n=12, seed=1, bend=0.0, shal=1.9, jit=.12):
    """Low sand cay: wet-sand rim, sand top, plus a turquoise shallow skirt at z=0.06."""
    rng = random.Random(seed)
    ks = [1 + (rng.random() - .5) * 2 * jit for _ in range(n)]

    def ring(sc, z):
        out = []
        for i in range(n):
            a = 2 * math.pi * i / n
            x = cx + rx * sc * ks[i] * math.cos(a)
            y = cy + ry * sc * ks[i] * math.sin(a) + bend * ((x - cx) / rx) ** 2
            out.append((x, y, z))
        return out
    rs = [ring(1.1, -.2), ring(1.0, h * .45), ring(.84, h)]
    ref = V((cx, cy, h * .3))
    p.loft(rs[:2], H['sandW'], ref=ref)
    p.loft(rs[1:], H['sand'], ref=ref, colors=[H['sand'], H['sandD']])
    top = rs[-1]
    ctr = (cx, cy + bend * 0, h + .25)
    for i in range(n):
        p.face([top[i], top[(i + 1) % n], ctr], H['sand'] if i % 2 == 0 else H['sandD'], up=True)
    # shallow-water skirt
    s0 = ring(1.08, .06)
    so = [(cx + (q[0] - cx) * 1 + (q[0] - cx) / max(rx, 1) * shal, cy + (q[1] - cy) + (q[1] - cy) / max(ry, 1) * shal * .9, .06) for q in s0]
    for i in range(n):
        j = (i + 1) % n
        p.face([s0[i], so[i], so[j], s0[j]], H['shal'] if i % 2 == 0 else H['shal2'], up=True)
    return rs


# ═════════════════════════════ HOUSES ═════════════════════════════
def house(p, w, d, nfl, wall, trim, shut, roof='hip', tile=None, fh0=4.2, fh=3.3, arcade=True, balc=(), awn=None,
          tank_=False, chim=False, turret=False, pedi=False, dorm=False, rh=2.2, glassc=None, door=None, sidew=True):
    tile = tile if tile is not None else H['tile']
    tileD = H['tileD']
    glassc = glassc if glassc is not None else H['glass']
    z0 = -.5
    Ht = fh0 + fh * (nfl - 1)
    B = (0, 0, w, d)
    # body + stone plinth
    lv = [z0, 1.5, fh0] + [x for k in range(1, nfl) for x in (fh0 + (k - 1) * fh + fh / 2, fh0 + k * fh)]
    wallbox(p, 0, 0, w, d, z0, Ht, wall, levels=lv, back=False)
    p.box((0, 0, z0), (w + .3, d + .3, 1.5 - z0), H['stone'], bottom=False, tcolor=H['stoneL'])
    nb = max(3, int(round(w / 3.2)))
    bw = (w - 1.0) / nb
    cu = [-w / 2 + .5 + bw * (i + .5) for i in range(nb)]
    # ground floor
    if arcade:
        aw = bw - 1.15
        for i, u in enumerate(cu):
            wq(p, B, 's', u - aw / 2, u + aw / 2, .9, fh0 - 1.5, H['dark'], off=.05, arch=.6)
            if i == nb // 2:
                wq(p, B, 's', u - aw * .32, u + aw * .32, .9, fh0 - 1.8, door if door is not None else H['door'], off=.08, arch=.3)
        band(p, 0, 0, w, d, fh0 - .8, .35, trim, ov=.18)
    else:
        for i, u in enumerate(cu):
            if i == nb // 2:
                wq(p, B, 's', u - .65, u + .65, .8, 3.0, door if door is not None else H['door'], off=.06, arch=.35)
            else:
                wq(p, B, 's', u - .95, u + .95, 1.1, 2.9, shut, off=.04)
                wq(p, B, 's', u - .75, u + .75, 1.3, 2.7, glassc, off=.07)
            if awn:
                aa = awn[i % len(awn)]
                p.face([(u - bw / 2, -d / 2, 3.35), (u + bw / 2, -d / 2, 3.35), (u + bw / 2, -d / 2 - 1.0, 2.95), (u - bw / 2, -d / 2 - 1.0, 2.95)], aa, flip_ref=V((0, 5, 6)) if False else V((0, 0, 4)))
        band(p, 0, 0, w, d, fh0 - .8, .35, trim, ov=.18)
    # upper floors
    for k in range(1, nfl):
        zf = fh0 + (k - 1) * fh
        bal = k in balc
        for u in cu:
            if bal:
                wq(p, B, 's', u - .85, u + .85, zf + .2, zf + 2.8, shut, off=.04)
                wq(p, B, 's', u - .52, u + .52, zf + .3, zf + 2.6, glassc, off=.07)
            else:
                wq(p, B, 's', u - .85, u + .85, zf + .7, zf + 2.75, shut, off=.04)
                wq(p, B, 's', u - .5, u + .5, zf + .95, zf + 2.5, glassc, off=.07)
        if bal:
            p.box((0, -d / 2 - .55, zf - .2), (w - .6, 1.1, .35), trim, bottom=False)
            wq(p, (0, -.55, w - .6, d), 's', -(w - .6) / 2 + .1, (w - .6) / 2 - .1, zf + .15, zf + 1.05, shut, off=.55 + .02)
        elif k < nfl:
            band(p, 0, 0, w, d, zf - .25, .3, trim, ov=.16)
        if sidew:
            for sd in ('e', 'w'):
                for u in (-d * .23, d * .23):
                    wq(p, B, sd, u - .5, u + .5, zf + .95, zf + 2.5, glassc, off=.05)
    if sidew:
        for sd in ('e', 'w'):
            for u in (-d * .23, d * .23):
                wq(p, B, sd, u - .5, u + .5, 1.2, 2.6, glassc, off=.05)
    # corner pilasters + window sills
    for sx in (-1, 1):
        p.box((sx * w / 2, -d / 2, z0), (.5, .5, Ht - z0), trim, bottom=False, top=False)
    for k in range(1, nfl):
        zf = fh0 + (k - 1) * fh
        if k in balc:
            continue
        for u in cu:
            wq(p, B, 's', u - .75, u + .75, zf + .55, zf + .75, trim, off=.12)
    # roof
    if roof == 'hip':
        band(p, 0, 0, w, d, Ht - .35, .35, trim, ov=.2)
        hip(p, 0, 0, w, d, Ht, rh, tile, H['tileL'], ov=.55, topc=tileD, bands=4)
        if dorm:
            zb = Ht + rh * .2
            p.box((0, -d / 2 + .9, zb), (2.2, 1.4, 1.5), wall, bottom=False, top=False)
            gable_x(p, 0, -d / 2 + .9, 2.2, 1.4, zb + 1.5, .9, tile, tileD, wall, ov=.2, strips=1)
            wq(p, (0, -d / 2 + .9, 2.2, 1.4), 's', -.5, .5, zb + .3, zb + 1.3, glassc, off=.05)
    elif roof == 'gable':
        band(p, 0, 0, w, d, Ht - .35, .35, trim, ov=.2)
        gable_x(p, 0, 0, w, d, Ht, rh, tile, H['tileL'], wall, ov=.5, strips=4)
    else:
        parapet(p, 0, 0, w, d, Ht, .75, .35, trim, wall, wall, H['flat'], ov=.18)
        if tank_:
            tank(p, (w * .22, d * .15, Ht), .95, 1.5, col=0x2f4f80, lid=0x8a93a3)
            p.box((-w * .3, d * .1, Ht), (1.8, 1.8, 1.6), wall, bottom=False)
    if chim:
        p.box((w * .25, d * .1, Ht + rh * .35), (.9, .9, rh * .8 + .9), H['stoneL'], bottom=False)
    if turret:
        p.box((-w / 2 + 1.7, 0.4, Ht), (2.8, 2.8, 2.7), wall, bottom=False, top=False)
        wq(p, (-w / 2 + 1.7, .4, 2.8, 2.8), 's', -.5, .5, Ht + .7, Ht + 2.1, H['dark'], off=.05, arch=.4)
        hip(p, -w / 2 + 1.7, .4, 2.8, 2.8, Ht + 2.7, 1.9, tile, tileD, ov=.35, top_scale=.05, bands=1)
    if pedi:
        zt = Ht - .3
        p.face([(-w * .22, -d / 2 - .22, zt), (w * .22, -d / 2 - .22, zt), (0, -d / 2 - .22, zt + 1.9)], trim, flip_ref=V((0, 0, zt)))
        wq(p, B, 's', -.35, .35, zt + .2, zt + .7, glassc, off=.25)
    return Ht


HOUSES = [
    # w, d, nfl, wall, trim, shut, roof, extra kwargs
    dict(w=10, d=8, nfl=3, wall='Y', trim='W', shut=0x2f7f6a, roof='hip', arcade=True, balc=(2,), dorm=True),
    dict(w=9, d=8, nfl=2, wall='W', trim='R', shut=0x2f6fa8, roof='gable', tile=0xd9573a, arcade=True, fh0=4.4, fh=3.6, rh=2.6),
    dict(w=11, d=8, nfl=3, wall='O', trim='W', shut=0x2f6a6a, roof='flat', arcade=False, awn=(0xf4efe4, 0xd9473b), tank_=True),
    dict(w=10, d=8, nfl=2, wall='B', trim='W', shut=0x2a4a8a, roof='hip', arcade=True, balc=(1,), fh0=4.4, fh=3.8, dorm=True),
    dict(w=8, d=8, nfl=3, wall='S', trim='W', shut=0x2f6a6a, roof='gable', arcade=False, awn=(0x2f6fa8, 0xf4efe4), rh=2.4),
    dict(w=9, d=8, nfl=2, wall='M', trim='W', shut=0xe58552, roof='flat', arcade=True, balc=(1,), tank_=True, fh0=4.6, fh=3.8),
    dict(w=12, d=8, nfl=3, wall='R', trim='W', shut=0xf4efe4, roof='hip', tile=0xb24a2c, arcade=True, turret=True, balc=(2,), sidew=False, rh=2.0),
    dict(w=10, d=8, nfl=2, wall='K', trim='W', shut=0x2f7f6a, roof='gable', arcade=True, pedi=True, fh0=4.6, fh=4.0, rh=2.8),
    dict(w=9, d=8, nfl=3, wall='W', trim='B', shut=0x2f6fa8, roof='flat', arcade=False, balc=(1, 2), awn=(0xe9a23c, 0xf4efe4), tank_=True),
    dict(w=11, d=8, nfl=2, wall='P', trim='W', shut=0x2f6a6a, roof='hip', arcade=True, fh0=4.4, fh=3.6, chim=True, rh=2.6, dorm=True),
    dict(w=10, d=8, nfl=3, wall='T', trim='W', shut=0xd9473b, roof='gable', arcade=False, awn=(0xd9473b, 0xf4efe4), rh=2.4),
    dict(w=12, d=8, nfl=2, wall='C', trim='O', shut=0x2f6a6a, roof='flat', arcade=True, balc=(1,), tank_=True, fh0=4.4, fh=3.7),
]


def build_house(p, spec):
    s = dict(spec)
    for k in ('wall', 'trim'):
        s[k] = H[s[k]]
    return house(p, **s)


# ═════════════════════════════ PLAYA HOUSES ═════════════════════════════
def stairs(p, x, y, z0, steps, rise, run, wd, col, axis='x', sgn=1):
    """Block stair: steps rising along +axis (sgn). Each step is a box from the ground."""
    for i in range(steps):
        h = rise * (i + 1)
        if axis == 'x':
            p.box((x + sgn * run * i, y, z0), (run, wd, h - z0), col, bottom=False, top=True)
        else:
            p.box((x, y + sgn * run * i, z0), (wd, run, h - z0), col, bottom=False, top=True)


def playa(p, k):
    z0 = -.5
    G = H['glass']
    if k == 0:   # white 1-floor, roof terrace, tank, stairs
        w, d, hh = 8, 6, 5.4
        wallbox(p, 0, 0, w, d, z0, hh, H['W'])
        B = (0, 0, w, d)
        for u in (-2.2, 2.2):
            wq(p, B, 's', u - .9, u + .9, 1.3, 3.3, 0x2f7fb0, off=.04)
            wq(p, B, 's', u - .62, u + .62, 1.5, 3.1, G, off=.07)
        wq(p, B, 's', -.6, .6, .0, 3.0, H['door'], off=.05)
        wq(p, B, 'e', -1.0, 1.0, 1.4, 3.2, G, off=.05)
        parapet(p, 0, 0, w, d, hh, .8, .3, 0x2f7fb0, H['W'], H['W'], H['plaza'], ov=.12)
        tank(p, (-2.4, 1.2, hh), .9, 1.5, col=0x1f2f4a)
        stairs(p, w / 2 + .2, 1.4, z0, 5, 1.1, .8, 1.3, H['stoneL'], 'y', 1) if False else None
        # front terrace deck with rail
        p.box((0, -d / 2 - 1.3, z0), (w + 1.2, 2.6, 1.0 - z0), H['woodL'], bottom=False, tcolor=H['thatch'])
        for u in (-w / 2 - .4, w / 2 + .4):
            p.beam((u, -d / 2 - 2.5, 1.0), (u, -d / 2 - 2.5, 2.0), .09, H['white'], 3)
        p.beam((-w / 2 - .4, -d / 2 - 2.5, 1.95), (w / 2 + .4, -d / 2 - 2.5, 1.95), .08, H['white'], 3)
        stairs(p, w / 2 + .9, -d / 2 + .6, z0, 3, .45, .7, 1.4, H['woodL'], 'x', -1) if False else None
    elif k == 1:   # yellow 2 floors, external stair, balcony
        w, d, hh = 7, 6, 6.8
        wallbox(p, 0, 0, w, d, z0, hh, H['Y'])
        B = (0, 0, w, d)
        wq(p, B, 's', -1.0, 1.0, 0, 2.9, 0x2f7f6a, off=.05)
        for u in (-2.3, 2.3):
            wq(p, B, 's', u - .55, u + .55, 1.4, 2.9, G, off=.05)
        for u in (-2.3, 0, 2.3):
            wq(p, B, 's', u - .55, u + .55, 4.6, 6.0, G, off=.05)
            wq(p, B, 's', u - .85, u + .85, 4.4, 6.2, 0x2f7f6a, off=.03)
        p.box((0, 0, 3.4), (w + .4, d + .4, .45), H['W'], bottom=False, top=False)
        p.box((0, -d / 2 - .6, 3.25), (w - .5, 1.2, .35), H['W'], bottom=False)
        parapet(p, 0, 0, w, d, hh, .7, .3, H['W'], H['Y'], H['Y'], H['flat'], ov=.12)
        tank(p, (1.6, 1.0, hh), .85, 1.4, col=0x1f2f4a)
        # side stair to first floor
        stairs(p, w / 2 + .5, 1.0, z0, 6, .62, .65, 1.2, H['stoneL'], 'y', -1)
    elif k == 2:   # blue 1 floor + roof terrace + canopy
        w, d, hh = 8.5, 6.5, 5.0
        wallbox(p, 0, 0, w, d, z0, hh, H['B'])
        B = (0, 0, w, d)
        wq(p, B, 's', -3.5, -1.5, 1.3, 3.3, G, off=.05)
        wq(p, B, 's', 1.5, 3.5, 1.3, 3.3, G, off=.05)
        wq(p, B, 's', -.65, .65, 0, 3.1, H['door'], off=.05)
        wq(p, B, 'w', -1.2, 1.2, 1.4, 3.3, G, off=.05)
        parapet(p, 0, 0, w, d, hh, .75, .3, H['W'], H['B'], H['B'], H['plaza'], ov=.12)
        for sx in (-1, 1):
            p.beam((sx * 3.2, 1.8, hh), (sx * 3.2, 1.8, hh + 2.2), .1, H['white'], 3)
            p.beam((sx * 3.2, -1.8, hh), (sx * 3.2, -1.8, hh + 2.2), .1, H['white'], 3)
        p.face([(-3.7, -2.2, hh + 2.3), (3.7, -2.2, hh + 2.3), (3.7, 2.2, hh + 2.7), (-3.7, 2.2, hh + 2.7)], H['O'], up=True)
        stairs(p, -w / 2 - .5, -1.2, z0, 5, 1.0, .75, 1.2, H['stoneL'], 'y', 1)
    elif k == 3:   # grey modern 2 floors, slit windows
        w, d, hh = 9, 6.5, 6.8
        p.box((0, 0, z0), (w, d, 3.4 - z0), H['G'], bottom=False, top=True, tcolor=H['plazaD'])
        p.box((.8, 0, 3.3), (w - 1.6, d, hh - 3.3), 0xe8e6e0, bottom=False, top=False)
        B = (.8, 0, w - 1.6, d)
        wq(p, B, 's', -3.3, 3.3, 4.4, 5.6, H['glassD'], off=.04)
        p.box((-w / 2 + 1.0, -d / 2 - .6, 3.3), (w * .45, 1.2, .35), H['W'], bottom=False)
        B0 = (0, 0, w, d)
        wq(p, B0, 's', -3.8, -1.2, 1.2, 3.0, H['glassD'], off=.04)
        wq(p, B0, 's', 1.2, 3.8, 1.2, 3.0, H['glassD'], off=.04)
        wq(p, B0, 's', -.5, .5, 0, 2.7, H['door'], off=.05)
        parapet(p, .8, 0, w - 1.6, d, hh, .6, .3, H['W'], 0xe8e6e0, 0xe8e6e0, H['flat'], ov=.1)
        tank(p, (1.8, 1.4, hh), .9, 1.5, col=0x1f2f4a)
        p.box((-1.2, -1, hh), (1.8, 1.8, 1.5), H['G'], bottom=False)
    elif k == 4:   # small white with blue shutters, front terrace + parasol
        w, d, hh = 6, 5.5, 5.4
        wallbox(p, 0, 0, w, d, z0, hh, H['W'])
        B = (0, 0, w, d)
        for u in (-1.8, 1.8):
            wq(p, B, 's', u - .95, u + .95, 1.5, 3.5, 0x2f6fa8, off=.04)
            wq(p, B, 's', u - .55, u + .55, 1.8, 3.3, G, off=.07)
        wq(p, B, 's', -.6, .6, 0, 3.1, 0x2f6fa8, off=.05)
        wq(p, B, 'e', -.8, .8, 1.6, 3.4, G, off=.05)
        hip(p, 0, 0, w, d, hh, 1.6, H['tile'], H['tileD'], ov=.5, top_scale=.4)
        p.box((0, -d / 2 - 1.2, z0), (w + 1.5, 2.4, 1.0 - z0), H['plaza'], bottom=False, tcolor=H['plazaD'])
        p.beam((w / 2 + .3, -d / 2 - 1.9, 1.0), (w / 2 + .3, -d / 2 - 1.9, 4.2), .1, H['white'], 3)
        p.frustum((w / 2 + .3, -d / 2 - 1.9, 3.6), 2.2, 0, 1.0, 6, H['R'], bottom=False, ring_colors=[H['R'], H['white']])
    else:   # yellow L-shape with terrace
        w, d, hh = 8.5, 6, 5.6
        p.box((-1.2, 0, z0), (w - 2.4, d, hh - z0), H['Y'], bottom=False, top=False)
        p.box((w / 2 - 1.2, -d / 2 + 1.6, z0), (2.4, 3.2, 4.2 - z0), H['W'], bottom=False, top=False)
        B = (-1.2, 0, w - 2.4, d)
        for u in (-1.9, 1.9):
            wq(p, B, 's', u - .9, u + .9, 1.4, 3.4, 0x2f7f6a, off=.04)
            wq(p, B, 's', u - .55, u + .55, 1.7, 3.2, G, off=.07)
        wq(p, (w / 2 - 1.2, -d / 2 + 1.6, 2.4, 3.2), 's', -.6, .6, 0, 3.0, H['door'], off=.05)
        parapet(p, -1.2, 0, w - 2.4, d, hh, .7, .3, H['W'], H['Y'], H['Y'], H['flat'], ov=.12)
        p.box((w / 2 - 1.2, -d / 2 + 1.6, 4.2), (2.9, 3.7, .35), H['W'], bottom=False)
        tank(p, (-2.4, 1.2, hh), .9, 1.5, col=0x1f2f4a)
        p.box((-1.2, -d / 2 - 1.1, z0), (w - 2.4, 2.2, .6 - z0), H['woodL'], bottom=False, tcolor=H['thatch'])
        stairs(p, -w / 2 - .2, -.8, z0, 4, .5, .7, 1.3, H['stoneL'], 'x', 1) if False else None
    return None


# ═════════════════════════════ CHURCH / CHAPEL ═════════════════════════════
def cross(p, x, y, z, hh=1.8, col=None):
    col = col if col is not None else H['goldD']
    p.box((x - .12, y - .12, z), (.24, .24, hh), col, bottom=False)
    p.box((x - .5, y - .12, z + hh * .55), (1.0, .24, .24), col, bottom=False)


def iglesia(p):
    WH, WT = 0xf6f0e0, 0xe6dcc0
    z0 = -.5
    # forecourt (14 x 7) with pavers, low wall, gate pillars, steps, lamps, palms
    p.box((0, -7.5, z0), (14, 7, .85), H['plaza'], bottom=False, top=False)
    p.grid((0, -7.5, 0), (14, 7), 7, 3, None, z=.35, colorfn=lambda x, y: H['plaza'] if (int((x + 7) / 2) + int((y + 3.5) / 2.34)) % 2 == 0 else H['plazaD'])
    for sx in (-1, 1):
        p.box((sx * 4.6, -10.8, z0), (4.8, .6, 1.2 - z0), WH, bottom=False, tcolor=WT)
        p.box((sx * 6.8, -7.5, z0), (.5, 7.2, 1.2 - z0), WH, bottom=False, tcolor=WT)
        p.box((sx * 2.0, -10.8, z0), (.8, .8, 2.4 - z0), WH, bottom=False, tcolor=H['goldD'])
    stairs(p, 0, -4.9, 0, 3, .45, .6, 4.6, H['stoneL'], 'y', 1)
    palm(p, -5.4, -6.4, .3, h=6.2, lean=(.4, 0), s=.8, seed=4, nfr=4, fl=3.6)
    palm(p, 5.4, -6.2, .3, h=5.6, lean=(-.4, 0), s=.75, seed=9, nfr=5, fl=3.4)
    # nave
    nave = (0, 3.5, 9, 15)
    wallbox(p, 0, 3.5, 9, 15, z0, 10.3, WH, step=3.4)
    p.box((0, 3.5, z0), (9.3, 15.3, 1.5 - z0), H['stone'], bottom=False, tcolor=H['stoneL'])
    # aisles
    wallbox(p, 5.9, 4.0, 2.6, 14, z0, 6.4, WH, step=3.5)
    wallbox(p, -5.9, 5.9, 2.6, 10.4, z0, 6.4, WH, step=3.5)
    for sx in (-1, 1):
        yb = 4.0 if sx > 0 else 5.9
        db = 14 if sx > 0 else 10.4
        p.face([(sx * 4.5, yb - db / 2 - .25, 8.2), (sx * 4.5, yb + db / 2 + .25, 8.2), (sx * 7.4, yb + db / 2 + .25, 6.0), (sx * 7.4, yb - db / 2 - .25, 6.0)], H['tileD'] if sx > 0 else H['tile'], flip_ref=V((sx * 4.5, yb, 4)))
        for u in (-3.2, 0.5, 3.8):
            wq(p, (sx * 5.9, yb, 2.6, db), 'e' if sx > 0 else 'w', u - .5, u + .5, 2.2, 4.8, H['glassD'], off=.04, arch=.5)
    # facade
    wq(p, nave, 's', -1.2, 1.2, 0, 4.8, H['dark'], off=.05, arch=1.2)
    wq(p, nave, 's', -.85, .85, 0, 4.4, H['door'], off=.08, arch=.8)
    for sx in (-1, 1):
        wq(p, nave, 's', sx * 3.0 - .6, sx * 3.0 + .6, 3.0, 5.8, H['glassD'], off=.04, arch=.5)
        p.box((sx * 4.2, -4.25, z0), (.5, .5, 11.2 - z0), WT, bottom=False)
    rose = [(math.cos(2 * math.pi * i / 8) * 1.1, -4.06, 7.9 + math.sin(2 * math.pi * i / 8) * 1.1) for i in range(8)]
    p.face(rose, H['glass'], flip_ref=V((0, 0, 7.9)))
    p.box((0, 3.5, 9.95), (9.8, 15.8, .45), WT, bottom=False, top=False)
    p.face([(-4.4, -4.28, 10.4), (4.4, -4.28, 10.4), (0, -4.28, 13.4)], WT, flip_ref=V((0, 3, 10)))
    p.face([(-3.6, -4.32, 10.7), (3.6, -4.32, 10.7), (0, -4.32, 12.8)], WH, flip_ref=V((0, 3, 10)))
    cross(p, 0, -4.2, 13.2, 1.6)
    # nave roof (ridge along Y)
    gable_y(p, 0, 3.5, 9, 15, 10.4, 3.2, H['tile'], H['tileL'], WH, ov=.5, strips=4, front=False)
    # crossing dome
    p.frustum((0, 4.5, 9.8), 3.3, 3.1, 4.4, 8, WH, rz=.39, top=False, bottom=False, ring_colors=[WH, WT])
    for i in range(4):
        a = i * math.pi / 2 + .39 + math.pi / 8
        p.face([arc_pt(0, 4.5, 3.14, a - .25, 11.4), arc_pt(0, 4.5, 3.14, a + .25, 11.4), arc_pt(0, 4.5, 3.14, a + .25, 13.1), arc_pt(0, 4.5, 3.14, a - .25, 13.1)], H['glassD'], flip_ref=V((0, 4.5, 12)))
    dome(p, (0, 4.5, 14.1), 3.5, 3.5, 8, 3, H['gold'], H['goldD'], rz=.39, ref_dz=-3)
    p.frustum((0, 4.5, 17.6), .55, .4, 1.0, 6, WH, top=True, bottom=False)
    dome(p, (0, 4.5, 18.6), .55, .6, 6, 2, H['gold'], H['goldD'])
    cross(p, 0, 4.5, 19.2, 1.5)
    # bell tower (left front)
    tx, ty = -4.6, -1.6
    tb = (tx, ty, 4.8, 4.8)
    wallbox(p, tx, ty, 4.8, 4.8, z0, 14.6, WH, step=3.8)
    p.box((tx, ty, z0), (5.1, 5.1, 1.5 - z0), H['stone'], bottom=False, tcolor=H['stoneL'])
    wq(p, tb, 's', -.7, .7, 1.5, 4.4, H['dark'], off=.05, arch=.7)
    wq(p, tb, 's', -.5, .5, 7.6, 10.4, H['glassD'], off=.05, arch=.5)
    wq(p, tb, 'w', -.5, .5, 7.6, 10.4, H['glassD'], off=.05, arch=.5)
    band(p, tx, ty, 4.8, 4.8, 6.4, .4, WT, ov=.2)
    band(p, tx, ty, 4.8, 4.8, 14.0, .6, WT, ov=.25)
    p.box((tx, ty, 14.4), (4.0, 4.0, 4.4), WT, bottom=False, top=False)
    belf = (tx, ty, 4.0, 4.0)
    for sd in 'sewn':
        wq(p, belf, sd, -.8, .8, 15.4, 17.6, H['dark'], off=.05, arch=.7)
    p.ico((tx, ty, 16.1), .5, H['goldD'], sub=0, seed=3)
    band(p, tx, ty, 4.0, 4.0, 18.6, .5, WH, ov=.2)
    dome(p, (tx, ty, 19.1), 2.5, 2.6, 8, 3, H['gold'], H['goldD'], rz=.39, ref_dz=-3)
    p.beam((tx, ty, 21.5), (tx, ty, 22.3), .14, H['goldD'], 3)
    cross(p, tx, ty, 22.0, 1.8)
    for sx in (-1, 1):
        p.box((tx + sx * 2.5, ty - 2.5, z0), (.5, .5, 15.4 - z0), WT, bottom=False)


def capilla(p):
    WH, WT = 0xf6f0e0, 0xe6dcc0
    z0 = -.5
    body = (0, .4, 6, 7.4)
    wallbox(p, 0, .4, 6, 7.4, z0, 4.8, WH, step=2.7)
    p.box((0, .4, z0), (6.3, 7.7, 1.0 - z0), H['stone'], bottom=False, tcolor=H['stoneL'])
    gable_y(p, 0, .4, 6, 7.4, 4.8, 2.0, H['tile'], H['tileD'], WH, ov=.4, strips=2, front=False)
    # espadana (bell gable)
    p.box((0, -3.1, 4.8), (6.2, .75, 1.4), WH, bottom=False)
    p.box((0, -3.1, 6.2), (3.4, .75, 2.3), WH, bottom=False, tcolor=WT)
    p.face([(-1.9, -3.5, 8.5), (1.9, -3.5, 8.5), (0, -3.5, 9.7)], WT, flip_ref=V((0, 0, 8)))
    p.face([(-1.9, -2.7, 8.5), (1.9, -2.7, 8.5), (0, -2.7, 9.7)], WT, flip_ref=V((0, 0, 8)))
    wq(p, (0, -3.1, 3.4, .75), 's', -.65, .65, 6.5, 8.0, H['dark'], off=.03, arch=.7)
    p.ico((0, -3.52, 7.3), .42, H['gold'], sub=0, sc=(1, .6, 1), seed=2)
    cross(p, 0, -3.1, 9.6, 1.3)
    wq(p, body, 's', -.9, .9, 0, 3.2, H['dark'], off=.05, arch=.9)
    wq(p, body, 's', -.65, .65, 0, 3.0, H['door'], off=.08, arch=.55)
    for sx in (-1, 1):
        wq(p, body, 's', sx * 2.2 - .45, sx * 2.2 + .45, 1.8, 3.6, H['glassD'], off=.04, arch=.4)
        p.box((sx * 3.15, -3.5, z0), (.4, .4, 5.0 - z0), WT, bottom=False)
        for u in (-1.6, 1.6):
            wq(p, body, 'e' if sx > 0 else 'w', u - .45, u + .45, 1.8, 3.6, H['glassD'], off=.04, arch=.4)
    stairs(p, 0, -4.2, 0, 2, .4, .55, 2.6, H['stoneL'], 'y', 1)


# ═════════════════════════════ LIGHTHOUSE ═════════════════════════════
def faro(p):
    # rock plinth
    rock_mass(p, -.6, .8, 4.4, 4.2, 3.0, n=8, seed=21, grass=.8, prof=((0, 1.15), (.45, 1.0), (1.0, .72)), jit=.12)
    foam_ring(p, -.6, .8, 4.4, 4.2, n=10, w=1.2, seed=5, inner=1.0)
    zt = 2.8
    tx, ty = -.6, .8
    n = 8
    radii = [2.2, 2.0, 1.82, 1.68, 1.5]
    zs = [zt, zt + 3.9, zt + 7.8, zt + 11.7, zt + 15.6]
    rings = [[(tx + r * math.cos(2 * math.pi * i / n + .39), ty + r * math.sin(2 * math.pi * i / n + .39), z) for i in range(n)] for r, z in zip(radii, zs)]
    for k in range(4):
        p.loft(rings[k:k + 2], H['red'] if k % 2 == 0 else H['white'], ref=V((tx, ty, zs[k] + 1)))
    zg = zs[-1]
    # gallery
    p.frustum((tx, ty, zg), 2.5, 2.3, .45, 8, H['steel'], rz=.39, tcolor=0x5a606c, bottom=True)
    rr = [[(tx + 2.4 * math.cos(2 * math.pi * i / n + .39), ty + 2.4 * math.sin(2 * math.pi * i / n + .39), z) for i in range(n)] for z in (zg + .45, zg + 1.3)]
    p.loft(rr, H['red'], ref=V((tx, ty, zg + .5)))
    for i in range(n):
        a = 2 * math.pi * i / n + .39
        p.beam((tx + 2.4 * math.cos(a), ty + 2.4 * math.sin(a), zg + 1.3), (tx + 2.4 * math.cos(a), ty + 2.4 * math.sin(a), zg + 1.5), .07, H['white'], 3)
    # lantern room
    p.frustum((tx, ty, zg + .45), 1.3, 1.25, 2.1, 8, H['glass'], rz=.39, top=False, ring_colors=[0xcfe8f6, H['steel']], bottom=False)
    p.frustum((tx, ty, zg + 2.55), 1.75, 1.3, .4, 8, H['red'], rz=.39, tcolor=H['red'], bottom=False)
    p.frustum((tx, ty, zg + 2.95), 1.3, 0, 1.4, 8, H['red'], rz=.39, bottom=False)
    p.ico((tx, ty, zg + 4.5), .3, H['goldD'], sub=0, seed=1)
    p.beam((tx, ty, zg + 4.6), (tx, ty, zg + 5.8), .06, H['steel'], 3)
    # tower details
    tb = (tx, ty, 4.4, 4.4)
    wq(p, tb, 's', -.55, .55, zt + .0, zt + 2.1, H['door'], off=.03, arch=.5) if False else None
    for k, zz in enumerate((zt + 1.6, zt + 5.5, zt + 9.4, zt + 13.4)):
        a = -math.pi / 2 + .2
        r = 2.0 - k * .1
        p.face([arc_pt(tx, ty, r * 1.0, -math.pi / 2 - .09, zz), arc_pt(tx, ty, r * 1.0, -math.pi / 2 + .09, zz), arc_pt(tx, ty, r * 1.0, -math.pi / 2 + .09, zz + .9), arc_pt(tx, ty, r * 1.0, -math.pi / 2 - .09, zz + .9)], H['dark'], flip_ref=V((tx, ty, zz)))
    # keeper's house
    hx, hy = 3.1, -1.9
    hb = (hx, hy, 4.2, 3.4)
    p.box((hx, hy, 0.4), (4.2, 3.4, 2.7), H['W'], bottom=False, top=False)
    hip(p, hx, hy, 4.2, 3.4, 3.1, 1.6, H['red'], H['redD'] if 'redD' in H else 0xa01f1f, ov=.4, top_scale=.35)
    wq(p, hb, 's', -.55, .55, .4, 2.2, H['door'], off=.04, arch=.3)
    wq(p, hb, 's', 1.0, 1.7, 1.1, 2.3, H['glassD'], off=.04)
    wq(p, hb, 's', -1.7, -1.0, 1.1, 2.3, H['glassD'], off=.04)
    p.box((hx - 1.2, hy + .8, 3.5), (.6, .6, 1.4), H['stoneL'], bottom=False)
    # footpath of steps to the door
    p.box((hx, hy - 2.2, 0.2), (1.6, 1.2, .3), H['stoneL'], bottom=False)


# ═════════════════════════════ STAR FORT ═════════════════════════════
def star_pts(R, r, n=5, rot=math.pi / 2):
    pts = []
    for i in range(2 * n):
        rr = R if i % 2 == 0 else r
        a = rot + math.pi * i / n
        pts.append((rr * math.cos(a), rr * math.sin(a)))
    return pts


def fuerte(p):
    ZP = 4.6   # plateau height
    rock_mass(p, 0, 0, 15.7, 15.7, ZP, n=14, seed=7, z0=-.4, jit=.1, grass=.35, topjit=.04,
              prof=((0, 1.07), (.28, .98), (.62, .9), (1.0, .8)), cap=H['grass'])
    foam_ring(p, 0, 0, 15.7, 15.7, n=20, w=1.0, seed=3, inner=1.04)
    # star curtain wall
    Ro, ri = 11.6, 6.9
    sp = star_pts(Ro, ri)
    zt = ZP + 3.9
    n = len(sp)
    cols = [H['stone'], H['stoneL']]
    ref = V((0, 0, ZP + 2))
    for i in range(n):
        j = (i + 1) % n
        p.face([(sp[i][0], sp[i][1], ZP - .3), (sp[j][0], sp[j][1], ZP - .3), (sp[j][0], sp[j][1], zt), (sp[i][0], sp[i][1], zt)], cols[i % 2], flip_ref=ref)
    sin_ = [(x * .66, y * .66) for x, y in sp]
    for i in range(n):
        j = (i + 1) % n
        p.face([(sp[i][0], sp[i][1], zt), (sp[j][0], sp[j][1], zt), (sin_[j][0], sin_[j][1], zt), (sin_[i][0], sin_[i][1], zt)], H['stoneL'] if i % 2 == 0 else 0xd6ceb8, up=True)
    zc = ZP + .5
    for i in range(n):
        j = (i + 1) % n
        pts = [(sin_[i][0], sin_[i][1], zt), (sin_[j][0], sin_[j][1], zt), (sin_[j][0], sin_[j][1], zc), (sin_[i][0], sin_[i][1], zc)]
        c = sum((V(q) for q in pts), V()) / 4
        o = V((c.x, c.y, 0)).normalized()
        p.face(pts, H['stoneD'], flip_ref=c + o * 10)
    p.face([(x, y, zc) for x, y in sin_], H['dirt'] if 'dirt' in H else 0xc8b48a, up=True)
    # sentry turrets on the 5 bastion tips + cannons
    for i in range(0, n, 2):
        x, y = sp[i]
        tx, ty = x * .93, y * .93
        p.frustum((tx, ty, zt), .85, .75, 1.1, 5, H['stoneL'], rz=.3, tcolor=H['stoneL'], bottom=False)
        p.frustum((tx, ty, zt + 1.1), 1.0, 0, 1.0, 5, H['tile'], rz=.3, bottom=False)
        ang = math.atan2(y, x)
        sx, sy = x * .66, y * .66
        p.beam((sx, sy, zt + .45), (sx + math.cos(ang) * 1.6, sy + math.sin(ang) * 1.6, zt + .6), .17, H['steel'], 3)
    # central keep with flag
    p.box((0, 1.0, zc), (4.6, 4.2, 4.4), H['stoneL'], bottom=False, tcolor=0xd6ceb8)
    wq(p, (0, 1.0, 4.6, 4.2), 's', -.6, .6, zc + .4, zc + 2.0, H['dark'], off=.04, arch=.4)
    p.box((-1.6, -.4, zc + 4.4), (.9, .9, .6), H['stoneL'], bottom=False)
    p.box((1.6, -.4, zc + 4.4), (.9, .9, .6), H['stoneL'], bottom=False)
    p.box((-1.6, 2.4, zc + 4.4), (.9, .9, .6), H['stoneL'], bottom=False)
    p.box((1.6, 2.4, zc + 4.4), (.9, .9, .6), H['stoneL'], bottom=False)
    fz = zc + 4.4
    p.beam((0, 1.0, fz), (0, 1.0, fz + 3.6), .12, H['white'], 3)
    p.face([(0, 1.0, fz + 3.5), (2.3, .9, fz + 3.1), (2.3, .9, fz + 2.1), (0, 1.0, fz + 2.3)], 0xf2c844, flip_ref=V((0, 9, fz)))
    p.face([(0, 1.0, fz + 2.3), (2.3, .9, fz + 2.1), (2.1, .9, fz + 1.5), (0, 1.0, fz + 1.7)], 0x2a4a8a, flip_ref=V((0, 9, fz)))
    # gatehouse at the south notch + causeway/drawbridge
    gb = (0, -8.1, 3.8, 4.6)
    p.box((0, -8.1, ZP - .3), (3.8, 4.6, zt - ZP + 1.1), H['stoneL'], bottom=False, tcolor=0xd6ceb8)
    wq(p, gb, 's', -1.0, 1.0, ZP - .3, ZP + 2.4, H['dark'], off=.05, arch=.9)
    wq(p, gb, 's', -.7, .7, ZP - .3, ZP + 2.2, H['wood'], off=.08, arch=.6)
    for sx in (-1, 1):
        p.box((sx * 1.55, -10.5, zt + .8), (.7, .7, .7), H['stoneL'], bottom=False)
    # path on plateau + sloping bridge
    p.box((0, -12.2, ZP - .4), (2.6, 4.0, .5), H['woodL'], bottom=False) if False else None
    yb0, yb1, yb2 = -10.4, -12.8, -17.0
    wd = 1.3
    def deck(y0, z0_, y1, z1_, col, off=0.0):
        p.face([(-wd, y0, z0_ + off), (wd, y0, z0_ + off), (wd, y1, z1_ + off), (-wd, y1, z1_ + off)], col, up=True)
    deck(yb0, ZP + .02, yb1, ZP + .02, H['woodL'])
    ys = [yb1 + (yb2 - yb1) * t / 3 for t in range(4)]
    zs = [ZP + .02 - (ZP - 1.0) * (t / 3) ** 1.2 for t in range(4)]
    for t in range(3):
        deck(ys[t], zs[t], ys[t + 1], zs[t + 1], H['wood'] if t % 2 == 0 else H['woodL'])
    for sx in (-1, 1):
        p.beam((sx * wd, yb0, ZP + .9), (sx * wd, yb1, ZP + .9), .08, H['woodD'], 3)
        p.beam((sx * wd, ys[0], zs[0] + .9), (sx * wd, ys[3], zs[3] + .9), .08, H['woodD'], 3)
        p.beam((sx * wd, ys[3], zs[3] - 1.5), (sx * wd, ys[3], zs[3] + .9), .1, H['woodD'], 3)
    # palms on the rock
    palm(p, -12.0, 5.0, ZP - .2, h=6.5, lean=(.7, -.5), s=.9, seed=3, nfr=5, fl=3.8)
    palm(p, 12.4, -4.0, ZP - 1.0, h=6.0, lean=(-.7, .3), s=.85, seed=8, nfr=5, fl=3.6)
    palm(p, 9.8, 10.0, ZP - 1.6, h=5.0, lean=(-.3, -.5), s=.75, seed=11, nfr=5, fl=3.2)
    bush(p, -13.2, -5.0, ZP - .3, 1.3, seed=2)
    bush(p, 4.0, -14.0, ZP - 1.0, 1.1, seed=4)


# ═════════════════════════════ PROMENADE / PIERS ═════════════════════════════
def lamp(p, x, y, z, h=4.2):
    p.beam((x, y, z), (x, y, z + h), .1, H['steel'], 3)
    p.frustum((x, y, z + h - .1), .5, .32, .6, 4, 0xf6e6a0, tcolor=H['steel'], bottom=False)


def bollard(p, x, y, z):
    p.frustum((x, y, z), .3, .24, .75, 5, H['steel'], tcolor=0x5a606c, bottom=False)


def malecon_recto(p, L=18.0, W=4.0):
    z0 = -.5
    hl = L / 2
    ZW = 1.1
    p.box((0, 0, z0), (L, W, ZW - z0), H['stoneL'], bottom=False, top=False)
    nx = 9
    for i in range(nx):
        for j in range(2):
            x0, x1 = -hl + L * i / nx, -hl + L * (i + 1) / nx
            y0, y1 = -.9 + j * 1.9, -.9 + (j + 1) * 1.9
            if j == 1:
                y1 = W / 2 - .3
            p.face([(x0, y0, ZW), (x1, y0, ZW), (x1, y1, ZW), (x0, y1, ZW)], H['plaza'] if (i + j) % 2 == 0 else H['plazaD'], up=True)
    # sea wall + cap + block stripes
    p.box((0, -W / 2 + .45, z0), (L, .9, 2.0 - z0), H['stone'], bottom=False, top=False)
    p.box((0, -W / 2 + .45, 1.9), (L + .3, 1.2, .35), H['stoneL'], bottom=False)
    for i in range(6):
        x0, x1 = -hl + L * i / 6 + .05, -hl + L * (i + 1) / 6 - .05
        p.face([(x0, -W / 2 - .02, .35), (x1, -W / 2 - .02, .35), (x1, -W / 2 - .02, 1.85), (x0, -W / 2 - .02, 1.85)], H['stoneL'] if i % 2 else H['stone'], flip_ref=V((0, 0, 1)))
    p.face([(-hl, -W / 2 - .03, -.5), (hl, -W / 2 - .03, -.5), (hl, -W / 2 - .03, .35), (-hl, -W / 2 - .03, .35)], H['stoneD'], flip_ref=V((0, 0, 0)))
    # landside curb
    p.box((0, W / 2 - .15, ZW - .1), (L, .3, .4), H['stone'], bottom=False)
    for x in (-6, 0, 6):
        lamp(p, x, -W / 2 + .9, ZW, 4.0)
    for x in (-3.4, 3.4, 8.2):
        bollard(p, x, -W / 2 + 1.1, ZW)
    # benches
    for x in (-3, 3.5):
        p.box((x, .95, ZW), (1.8, .45, .5), H['woodL'], bottom=False)
        p.box((x, 1.25, ZW + .5), (1.8, .12, .5), H['woodD'], bottom=False, top=False)


def malecon_curvo(p, R=16.0, W=4.0):
    """90-degree arc, sea on the INNER (concave) side. Circle centre at local (-9, 9); arc from angle 270 deg (south) to 360 deg (east)."""
    z0 = -.5
    ZW = 1.1
    cx, cy = -(R + W / 2 - 4.0) / 1.0 * 0 - 9.0 + 0.0, 9.0
    cx, cy = -9.0, 9.0
    rin, rout, rc = R - W / 2, R + W / 2, R
    ns = 6
    a0 = 1.5 * math.pi
    sw = (math.pi / 2) / ns
    P_ = lambda r, i, z: arc_pt(cx, cy, r, a0 + sw * i, z)
    for i in range(ns):
        # body slab sides (outer) + inner
        p.face([P_(rout, i, z0), P_(rout, i + 1, z0), P_(rout, i + 1, ZW), P_(rout, i, ZW)], H['stoneL'], flip_ref=V((cx, cy, 0)) * 1 + V((cx, cy, 0)) - V((cx, cy, 0)) if False else V((cx, cy, 0)) + (V(P_(rout, i, 0)) - V((cx, cy, 0))) * .0 - (V(P_(rout, i, 0)) - V((cx, cy, 0))) * 0 + V((0, 0, 0)))
        # pavers 2 lanes
        for j in range(2):
            r0 = rin + .9 + j * 1.5
            r1 = r0 + 1.5 if j == 0 else rout - .3
            p.face([P_(r0, i, ZW), P_(r1, i, ZW), P_(r1, i + 1, ZW), P_(r0, i + 1, ZW)], H['plaza'] if (i + j) % 2 == 0 else H['plazaD'], up=True)
        # sea wall (inner): outward-facing toward centre
        ref_c = V((cx, cy, 1.0))
        pts = [P_(rin, i, z0), P_(rin, i + 1, z0), P_(rin, i + 1, 2.0), P_(rin, i, 2.0)]
        c = sum((V(q) for q in pts), V()) / 4
        o = V((c.x - cx, c.y - cy, 0)).normalized()
        p.face(pts, H['stoneL'] if i % 2 else H['stone'], flip_ref=c + o * 10)  # faces toward the centre (sea)
        # wall thickness top
        p.face([P_(rin, i, 2.0), P_(rin, i + 1, 2.0), P_(rin + .9, i + 1, 2.0), P_(rin + .9, i, 2.0)], H['stoneL'], up=True)
        p.face([P_(rin + .9, i, z0), P_(rin + .9, i + 1, z0), P_(rin + .9, i + 1, 2.0), P_(rin + .9, i, 2.0)], H['stone'], flip_ref=V((cx, cy, 1)))
        p.face([P_(rin + .9, i, ZW), P_(rin + .9, i + 1, ZW), P_(rin + .9, i + 1, ZW + .02), P_(rin + .9, i, ZW + .02)], H['stone'], flip_ref=V((cx, cy, 1))) if False else None
    # curb
    for i in range(ns):
        p.face([P_(rout - .3, i, ZW), P_(rout, i, ZW), P_(rout, i + 1, ZW), P_(rout - .3, i + 1, ZW)], H['stone'], up=True)
    # end caps (so the slab reads closed)
    for i in (0, ns):
        p.face([P_(rin, i, z0), P_(rout, i, z0), P_(rout, i, ZW), P_(rin, i, ZW)], H['stoneL'], flip_ref=V(P_(rc, ns // 2, 0.5)))
    for i in (1, 3, 5):
        a = a0 + sw * i
        x, y, _ = arc_pt(cx, cy, rin + 1.2, a - sw * .5, 0)
        lamp(p, x, y, ZW, 4.0)
    for i in (2, 4):
        x, y, _ = arc_pt(cx, cy, rin + 1.3, a0 + sw * i, 0)
        bollard(p, x, y, ZW)


def muelle_pieza(p, L=14.0, W=3.2):
    ZD = 1.3
    n = 8
    for i in range(n):
        x0, x1 = -L / 2 + L * i / n, -L / 2 + L * (i + 1) / n
        p.face([(x0, -W / 2, ZD), (x1, -W / 2, ZD), (x1, W / 2, ZD), (x0, W / 2, ZD)], H['woodL'] if i % 2 == 0 else 0x9a6e40, up=True)
    p.box((0, 0, ZD - .4), (L, W, .4), H['woodD'], bottom=False, top=False)
    for x in (-L / 2 + 1, -L / 6, L / 6, L / 2 - 1):
        for sy in (-1, 1):
            p.beam((x, sy * (W / 2 - .15), -1.4), (x, sy * (W / 2 - .15), ZD + .5), .2, H['woodD'], 3)
    p.box((0, 0, ZD - .8), (L - .2, .35, .3), H['wood'], bottom=False, top=False)
    for x in (-L / 2 + 1, L / 2 - 1):
        bollard(p, x, W / 2 - .5, ZD)
    for x in (-L / 2 + .5, -L / 6 + .2, L / 6 + .2, L / 2 - .5):
        p.beam((x, -W / 2 + .12, ZD), (x, -W / 2 + .12, ZD + 1.0), .08, H['woodD'], 3)
    p.beam((-L / 2 + .5, -W / 2 + .12, ZD + .95), (L / 2 - .5, -W / 2 + .12, ZD + .95), .07, H['woodL'], 3)
    p.box((2.5, W / 2 - .85, ZD), (.9, .9, .6), H['woodD'], bottom=False)
    p.box((3.6, W / 2 - .85, ZD), (.7, .7, .45), H['woodL'], bottom=False)


def muelle_cabana(p, L=11.0, W=4.2):
    ZD = 1.3
    n = 7
    for i in range(n):
        x0, x1 = -L / 2 + L * i / n, -L / 2 + L * (i + 1) / n
        p.face([(x0, -W / 2, ZD), (x1, -W / 2, ZD), (x1, W / 2, ZD), (x0, W / 2, ZD)], H['woodL'] if i % 2 == 0 else 0x9a6e40, up=True)
    p.box((0, 0, ZD - .4), (L, W, .4), H['woodD'], bottom=False, top=False)
    for x in (-L / 2 + 1, -1.2, 2.4, L / 2 - 1):
        for sy in (-1, 1):
            p.beam((x, sy * (W / 2 - .2), -1.4), (x, sy * (W / 2 - .2), ZD + .5), .2, H['woodD'], 3)
    # hut at the far end (+X)
    hx, hy, hw, hd = 2.4, 0, 5.0, 3.6
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.beam((hx + sx * (hw / 2 - .2), sy * (hd / 2 - .2), ZD), (hx + sx * (hw / 2 - .2), sy * (hd / 2 - .2), ZD + 3.0), .17, H['wood'], 3)
    hb = (hx, 0, hw, hd)
    p.box((hx, hd / 2 - .2, ZD), (hw - .3, .25, 2.2), H['B'], bottom=False, top=False)
    p.box((hx + hw / 2 - .2, 0, ZD), (.25, hd - .3, 2.2), H['W'], bottom=False, top=False)
    wq(p, hb, 'e', -.7, .7, ZD + .5, ZD + 1.7, H['glassD'], off=-.0 + .0) if False else None
    p.box((hx - .8, -hd / 2 + .5, ZD), (3.0, .6, 1.0), H['woodL'], bottom=False, tcolor=H['thatch'])   # bar counter
    hip(p, hx, 0, hw, hd, ZD + 3.0, 1.9, H['tile'], H['tileL'], ov=.7, top_scale=.2)
    p.frustum((hx, 0, ZD + 4.9), .3, 0, .6, 4, H['tileD'], bottom=False)
    for k, (x, y) in enumerate(((hx - 1.2, hd / 2 - 1.0), (hx + .3, hd / 2 - 1.0))):
        p.cbox((x, y, ZD), (.9, .9, .9), [H['woodL'], H['thatchD']][k], ch=.12)
    lamp(p, -L / 2 + .5, -W / 2 + .4, ZD, 2.8)
    bollard(p, -L / 2 + 1, W / 2 - .5, ZD)
    p.box((-2.6, -1.0, ZD), (1.0, 1.0, .9), H['woodD'], bottom=False)
    p.ico((-2.6, -1.0, ZD + 1.2), .5, H['palmD'], sub=0, seed=3)


# ═════════════════════════════ ISLETS / SEA ROCKS / CAYS ═════════════════════════════
def islote(p, k):
    if k == 0:    # r~5, one hump, 2 palms, beach south
        rock_mass(p, 0, 0, 5.2, 4.8, 4.2, n=8, seed=11, grass=.55)
        foam_ring(p, 0, 0, 5.2, 4.8, n=10, w=1.5, seed=1)
        beach(p, 0, 0, 5.4, 4.1, 5.6, wd=2.0, n=5, seed=3)
        palm(p, -.8, .6, 4.0, h=5.6, lean=(.8, -.3), s=.85, seed=1, nfr=5, fl=3.4)
        palm(p, 1.6, -.4, 3.4, h=4.4, lean=(-.4, .5), s=.7, seed=5, nfr=5, fl=3.0)
        bush(p, -2.0, -1.2, 3.4, 1.0, seed=3)
    elif k == 1:  # two humps joined, 3 palms
        rock_mass(p, -2.2, 0, 4.8, 4.2, 4.6, n=8, seed=12, grass=.6)
        rock_mass(p, 3.6, 1.2, 3.2, 3.0, 3.0, n=7, seed=14, grass=.5)
        foam_ring(p, .4, .4, 8.0, 5.0, n=12, w=1.5, seed=2, inner=.96)
        palm(p, -2.8, -.2, 4.4, h=6.4, lean=(.5, .4), s=.9, seed=2, nfr=5, fl=3.6)
        palm(p, -.4, 1.4, 4.0, h=4.8, lean=(.7, 0), s=.75, seed=6, nfr=5, fl=3.1)
        palm(p, 4.0, 1.4, 2.8, h=4.8, lean=(-.5, -.5), s=.75, seed=9, nfr=5, fl=3.1)
        bush(p, -4.6, -2.0, 3.6, 1.0, seed=5)
    elif k == 2:  # tall spire, grass crown, 1 palm
        rock_mass(p, 0, 0, 4.4, 4.2, 8.5, n=7, seed=15, grass=.35, prof=((0, 1.15), (.3, 1.0), (.62, .72), (1.0, .5)), jit=.18)
        foam_ring(p, 0, 0, 4.4, 4.2, n=10, w=1.5, seed=4)
        beach(p, 0, 0, 4.6, 3.4, 4.6, wd=1.6, n=4, seed=6)
        palm(p, .2, -.2, 8.3, h=4.6, lean=(.5, .3), s=.8, seed=3, nfr=5, fl=3.2)
        bush(p, -1.2, .9, 8.0, .9, seed=2)
    elif k == 3:  # big island 22 wide: cliff + hill + beach + outcrops
        rock_mass(p, -1.0, 0, 8.6, 7.0, 6.0, n=11, seed=16, grass=.7, prof=((0, 1.1), (.3, 1.0), (.66, .82), (1.0, .56)), jit=.14)
        rock_mass(p, 5.0, -1.4, 4.0, 3.6, 3.6, n=8, seed=18, grass=.5)
        rock_mass(p, -7.6, 4.0, 2.4, 2.2, 2.4, n=7, seed=19, grass=.2)
        foam_ring(p, 0, 0, 10.0, 7.4, n=14, w=1.6, seed=3, inner=.96)
        beach(p, -1.0, 0, 8.6, 3.9, 5.6, wd=2.8, n=6, seed=8)
        palm(p, -2.0, 1.0, 5.8, h=6.2, lean=(.7, 0), s=.95, seed=4, nfr=6, fl=3.8)
        palm(p, 1.6, -.4, 5.2, h=5.2, lean=(-.4, .4), s=.85, seed=7, nfr=5, fl=3.4)
        palm(p, 5.4, -1.4, 3.4, h=4.6, lean=(.4, .3), s=.75, seed=10, nfr=5, fl=3.1)
        bush(p, -4.4, -2.0, 4.6, 1.3, seed=4)
        bush(p, 2.6, 2.6, 4.4, 1.1, seed=6)
    elif k == 3 + 1:   # small, 1 palm
        rock_mass(p, 0, 0, 3.4, 3.2, 2.6, n=7, seed=22, grass=.6)
        foam_ring(p, 0, 0, 3.4, 3.2, n=8, w=1.4, seed=5)
        palm(p, -.2, .2, 2.4, h=4.4, lean=(.5, -.3), s=.8, seed=1, nfr=5, fl=3.0)
        bush(p, 1.4, -1.0, 2.1, .7, seed=7)
    else:         # elongated ridge, sand tongue
        rock_mass(p, 0, 0, 7.4, 3.4, 4.2, n=9, seed=23, grass=.6, bend=1.4, prof=((0, 1.12), (.34, 1.0), (.68, .8), (1.0, .55)))
        foam_ring(p, 0, 0, 7.4, 3.4, n=12, w=1.5, seed=6, bend=1.4)
        beach(p, 0, 0, 7.0, 3.6, 5.2, wd=1.8, n=5, seed=9)
        palm(p, -3.0, .6, 3.6, h=5.0, lean=(.6, 0), s=.85, seed=2, nfr=5, fl=3.3)
        palm(p, 2.4, .8, 3.5, h=4.2, lean=(-.4, -.3), s=.75, seed=5, nfr=5, fl=3.0)
        bush(p, 5.0, 0, 2.6, .8, seed=8)


def roca_mar(p, k):
    specs = [  # rx, ry, h, n, seed, grass, bush
        (1.0, .9, 1.8, 6, 31, 0, False), (1.6, 1.5, 2.8, 7, 32, 0.2, False), (2.0, 1.8, 3.6, 7, 33, 0.6, True),
        (2.6, 2.4, 4.4, 8, 34, 0.5, True), (1.3, 1.2, 5.2, 6, 35, 0, False), (3.0, 2.5, 3.6, 8, 36, 0.4, True),
        (2.0, 1.6, 2.4, 7, 37, 0.0, False), (3.0, 2.8, 6.2, 8, 38, 0.5, True)]
    rx, ry, h, n, seed, grass, bsh = specs[k]
    prof = ((0, 1.15), (.5, 1.0), (1.0, .6)) if k not in (4,) else ((0, 1.2), (.5, .85), (1.0, .35))
    rock_mass(p, 0, 0, rx, ry, h, n=n, seed=seed, grass=grass, prof=prof, jit=.17)
    foam_ring(p, 0, 0, rx, ry, n=max(8, n + 1), w=1.1 + rx * .12, seed=seed, inner=1.0)
    if k == 6:
        rock_mass(p, 1.9, -1.0, 1.0, .9, 1.4, n=6, seed=41, prof=((0, 1.15), (.5, 1.0), (1.0, .6)))
    if bsh:
        bush(p, .1, .1, h - .1, rx * .35, seed=seed)


def cayo(p, k):
    if k == 0:
        sand_island(p, 0, 0, 7.6, 5.6, h=1.0, n=12, seed=2, shal=2.0)
        palm(p, -2.4, 1.2, .9, h=6.4, lean=(.9, -.3), s=.95, seed=2, nfr=6, fl=3.8)
        palm(p, 1.6, 1.8, .9, h=5.2, lean=(-.6, -.4), s=.8, seed=6, nfr=5, fl=3.3)
        palm(p, 3.6, -1.0, .9, h=4.4, lean=(.4, .3), s=.7, seed=11, nfr=5, fl=3.0)
        rock_mass(p, -4.4, -1.8, 1.6, 1.4, 1.9, n=6, seed=51, prof=((0, 1.15), (.5, 1.0), (1.0, .6)))
        bush(p, 0, -1.6, 1.0, .7, seed=9, col=H['dry'], col2=H['dryL'])
    elif k == 1:
        sand_island(p, 0, 0, 10.6, 4.6, h=1.0, n=14, seed=3, shal=2.0, bend=1.6)
        palm(p, -4.6, 1.4, .9, h=6.0, lean=(.8, 0), s=.9, seed=3, nfr=6, fl=3.7)
        palm(p, 0.4, 2.4, .9, h=5.4, lean=(-.5, -.5), s=.8, seed=7, nfr=5, fl=3.4)
        palm(p, 5.4, 1.6, .9, h=4.4, lean=(.4, .2), s=.7, seed=12, nfr=5, fl=3.0)
        rock_mass(p, 7.4, .2, 2.0, 1.7, 2.2, n=7, seed=52, grass=.2, prof=((0, 1.15), (.5, 1.0), (1.0, .6)))
        rock_mass(p, -7.6, -1.2, 1.2, 1.0, 1.4, n=6, seed=53, prof=((0, 1.15), (.5, 1.0), (1.0, .6)))
    elif k == 2:
        sand_island(p, 0, 0, 11.5, 5.2, h=1.0, n=15, seed=4, shal=2.1, bend=-2.4)
        palm(p, -6.0, 1.0, .9, h=5.8, lean=(.8, .3), s=.9, seed=4, nfr=6, fl=3.7)
        palm(p, -2.0, 3.0, .9, h=6.6, lean=(.6, -.5), s=.95, seed=8, nfr=6, fl=3.9)
        palm(p, 4.8, 1.2, .9, h=5.0, lean=(-.4, .3), s=.8, seed=13, nfr=5, fl=3.4)
        rock_mass(p, 7.6, -1.4, 2.1, 1.9, 2.4, n=7, seed=54, grass=.2, prof=((0, 1.15), (.5, 1.0), (1.0, .6)))
        bush(p, 1.5, 0.2, 1.0, .8, seed=3, col=H['dry'], col2=H['dryL'])
    else:
        sand_island(p, 0, 0, 5.8, 5.2, h=1.0, n=11, seed=5, shal=1.9)
        palm(p, -1.0, .6, .9, h=5.8, lean=(1.0, -.2), s=.9, seed=5, nfr=6, fl=3.6)
        palm(p, 2.0, -.6, .9, h=4.4, lean=(-.5, .4), s=.75, seed=14, nfr=5, fl=3.1)
        rock_mass(p, -2.6, -2.2, 1.3, 1.2, 1.6, n=6, seed=55, prof=((0, 1.15), (.5, 1.0), (1.0, .6)))


# ═════════════════════════════ COASTAL PLANTS ═════════════════════════════
def arbusto(p, k):
    if k == 0:   # round dry tufts + dead twigs
        bush(p, 0, 0, 0, 1.3, col=H['dryD'], col2=H['dryL'], seed=1, sz=.75)
        bush(p, 1.5, .5, 0, .95, col=H['dry'], col2=H['dryL'], seed=2, sz=.75)
        bush(p, -1.2, .8, 0, .8, col=H['grassD'], col2=H['dryL'], seed=3, sz=.7)
        p.beam((.2, -.9, 0), (.5, -1.0, 1.2), .05, H['woodD'], 3)
    elif k == 1:  # cuji: umbrella-crowned thorn tree
        p.beam((0, 0, -.3), (.35, 0, 2.3), .18, H['woodD'], 4)
        p.beam((.2, 0, 1.4), (1.2, .3, 2.5), .1, H['woodD'], 3)
        p.frustum((.3, 0, 2.3), 2.3, 1.7, .55, 7, H['dry'], rz=.2, tcolor=H['dryL'], bottom=True, ring_colors=[H['dryD'], H['dry']])
        p.frustum((1.5, .5, 2.4), 1.2, .8, .4, 6, H['dryD'], rz=.1, tcolor=H['dry'], bottom=False)
    else:         # agave rosette + blooms
        for i in range(8):
            a = i * 2 * math.pi / 8 + .2
            d = (math.cos(a), math.sin(a))
            n_ = (-d[1], d[0])
            L2 = 1.6 + .25 * (i % 2)
            b = (0, 0, .15)
            tip = (d[0] * L2, d[1] * L2, .9 + .3 * (i % 2))
            mid = (d[0] * L2 * .5, d[1] * L2 * .5, .6)
            p.face([b, (mid[0] + n_[0] * .45, mid[1] + n_[1] * .45, mid[2] - .1), tip, (mid[0] - n_[0] * .45, mid[1] - n_[1] * .45, mid[2] - .1)],
                   H['grassD'] if i % 2 else 0x6a8f4a, up=True)
        p.beam((0, 0, .3), (.1, 0, 3.4), .07, H['woodL'], 3)
        for i in range(3):
            p.ico((.1, 0, 3.0 + .12 * i), .22, H['yellow'], sub=0, seed=i) if False else None
        p.frustum((.1, 0, 3.0), .35, .0, .55, 4, H['yellow'], bottom=False)


def cactus(p, k):
    if k == 0:   # cardon: columnar with two arms
        p.frustum((0, 0, -.3), .75, .6, 6.3, 5, 0x5f8f4a, tcolor=0x7aa85a, bottom=False, ring_colors=[0x5f8f4a, 0x4f7a3f, 0x6a9a52, 0x4f7a3f, 0x5f8f4a])
        p.beam((.5, 0, 2.6), (1.9, 0, 2.7), .38, 0x5f8f4a, 5)
        p.beam((1.9, 0, 2.7), (1.9, 0, 4.9), .34, 0x5f8f4a, 5)
        p.face([(1.9 - .34, 0, 4.9), (1.9, .34, 4.9), (1.9 + .34, 0, 4.9), (1.9, -.34, 4.9)], 0x7aa85a, up=True)
        p.beam((-.5, 0, 3.6), (-1.7, 0, 3.7), .34, 0x5f8f4a, 5)
        p.beam((-1.7, 0, 3.7), (-1.7, 0, 5.4), .3, 0x5f8f4a, 5)
        p.face([(-1.7 - .3, 0, 5.4), (-1.7, .3, 5.4), (-1.7 + .3, 0, 5.4), (-1.7, -.3, 5.4)], 0x7aa85a, up=True)
    else:        # round melon cactus with red cap
        n = 8
        prof = [(1.35, -.1), (1.5, .7), (1.2, 1.5), (.55, 1.95)]
        rings = [[(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), z) for i in range(n)] for r, z in prof]
        p.loft(rings, 0x5f8f4a, colors=[0x5f8f4a, 0x4f7a3f], ref=V((0, 0, .8)))
        p.face(rings[-1], 0x7aa85a, up=True)
        p.frustum((0, 0, 1.9), .5, .38, .55, 6, H['red'], tcolor=0xe86a5a, bottom=False)
        p.face([(1.45, 0, .5), (1.6, .08, .8), (1.45, .16, .5)], 0xf2e6b0, flip_ref=V((0, 0, .5)))


def uva(p):
    p.beam((0, 0, -.3), (.5, .2, 2.2), .22, H['woodD'], 3)
    p.beam((.3, 0, 1.3), (-1.0, -.4, 2.6), .14, H['woodD'], 3)
    p.ico((.9, .3, 3.3), 2.0, 0x4f9a3f, sub=0, sc=(1, 1, .72), jitter=.12, seed=3, tcolor=0x6ab04e)
    p.ico((-1.2, -.5, 3.4), 1.6, 0x3f8035, sub=0, sc=(1, 1, .7), jitter=.12, seed=5, tcolor=0x5aa046)
    p.ico((.1, -.9, 2.5), 1.2, 0x468a3a, sub=0, sc=(1, 1, .7), jitter=.12, seed=7, tcolor=0x5aa046)
    for i, (x, y, z) in enumerate(((1.4, -1.0, 2.6), (-.5, -1.6, 2.2), (2.2, .6, 2.8))):
        p.face([(x, y, z), (x + .3, y, z - .1), (x + .15, y, z - .45)], 0x7a3a6a, flip_ref=V((x, y - 5, z)))


# ═════════════════════════════ BOATS ═════════════════════════════
def velero_b(p):
    """Cat-ketch sloop: navy hull with teal stripe, doghouse, two masts, genoa + main."""
    T = xf(0, 0, 0)
    BB.hull(p, 8.6, 2.6, 1.0, H['teal'], H['W'], H['navy'], 0xe6cf9c, bow_rise=.4, stern_w=.85, bow_pt=.1)
    cab = [[(-2.0, -.8, 1.0), (.1, -.85, 1.0), (.1, .85, 1.0), (-2.0, .8, 1.0)], [(-1.8, -.6, 1.6), (-.1, -.65, 1.55), (-.1, .65, 1.55), (-1.8, .6, 1.6)]]
    p.loft(cab, H['W'], caps=(False, True), ref=V((-.9, 0, 1.2)))
    p.face([(.08, -.6, 1.15), (.08, .6, 1.15), (-.08, .55, 1.5), (-.08, -.55, 1.5)], H['glass'], flip_ref=V((-1, 0, 1.2)))
    BB.mast(p, 1.3, 0, 1.0, 9.0, w=.1)
    BB.sail(p, T, (1.2, 0, 1.6), (1.2, 0, 8.7), (-3.2, 0, 1.9), .55, H['W'], H['cream'])
    BB.sail(p, T, (1.6, 0, 1.2), (1.55, 0, 7.8), (4.1, 0, 1.25), -.5, 0xf6d36a, H['W'])
    p.beam((-3.2, 0, 1.9), (1.2, 0, 1.7), .06, H['woodL'], 3)
    p.box((-3.3, 0, 1.0), (.7, .9, .7), H['steel'], bottom=False)


def penero_azul(p):
    """Open fishing peñero, blue hull + yellow stripe, outboard, canopy."""
    T = xf(0, 0, 0)
    BB.hull(p, 8.6, 2.3, 1.1, H['yellow'], 0x2f6fd0, H['navy'], 0xe3c47e, bow_rise=.9, stern_w=.85, bow_pt=.12, flat=.45)
    for x in (-1.8, 0.0, 1.8):
        p.box((x, 0, 1.15), (.5, 2.0, .22), H['woodL'], bottom=False)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.beam((sx * .9 + .1, sy * .75, 1.15), (sx * .9 + .1, sy * .75, 3.2), .07, H['white'], 3)
    p.face([(-1.0, -1.0, 3.3), (1.2, -1.0, 3.3), (1.2, 1.0, 3.3), (-1.0, 1.0, 3.3)], H['O'], up=True)
    p.box((-4.5, 0, 1.0), (1.0, .8, .9), H['steel'], bottom=False)
    p.box((-4.8, 0, 0), (.35, .35, 1.1), H['steel'], bottom=False, top=False)
    p.box((2.4, .4, 1.15), (.9, .8, .5), H['coral'], bottom=False)
    p.beam((4.0, 0, 1.9), (4.0, 0, 3.1), .05, H['white'], 3)


def penero_rojo(p):
    """Peñero with a small wheelhouse + nets, red hull."""
    BB.hull(p, 9.4, 2.5, 1.15, H['white'], H['red'], H['navy'], 0xe0c07a, bow_rise=.85, stern_w=.85, bow_pt=.12, flat=.45)
    cab = [[(.6, -.9, 1.15), (2.6, -.8, 1.15), (2.6, .8, 1.15), (.6, .9, 1.15)], [(.8, -.75, 2.5), (2.3, -.7, 2.5), (2.3, .7, 2.5), (.8, .75, 2.5)]]
    p.loft(cab, H['W'], caps=(False, True), ref=V((1.5, 0, 1.8)))
    p.face([(2.62, -.65, 1.7), (2.62, .65, 1.7), (2.35, .6, 2.35), (2.35, -.6, 2.35)], H['glass'], flip_ref=V((0, 0, 1.8)))
    p.box((.6, -1.0, 2.5), (2.2, 2.0, .18), H['red'], bottom=False)
    p.box((-3.9, 0, 1.0), (1.0, .8, .9), H['steel'], bottom=False)
    p.box((-4.2, 0, 0), (.35, .35, 1.1), H['steel'], bottom=False, top=False)
    p.beam((1.5, 0, 2.6), (1.5, 0, 4.6), .06, H['white'], 3)
    p.face([(1.5, 0, 4.5), (2.7, 0, 4.2), (1.5, 0, 3.9)], H['yellow'], flip_ref=V((1.5, 5, 4)))
    p.ico((-1.6, .2, 1.4), .75, 0xd98a3a, sub=0, sc=(1.3, 1, .6), seed=2)
    for y in (-.5, .5):
        p.box((-2.6, y, 1.15), (.7, .55, .4), H['woodL'], bottom=False)


def yate(p):
    """Motor yacht 12 long: white hull, navy stripe, flybridge, radar arch, sun deck."""
    BB.hull(p, 12.0, 3.6, 1.3, H['navy'], H['W'], H['navy'], H['cream'], bow_rise=.35, stern_w=.95, bow_pt=.12, flat=.55)
    p.cbox((-1.8, 0, 1.4), (6.4, 3.2, 1.7), H['W'], ch=.3, tcolor=H['cream'])
    p.cbox((-1.4, 0, 3.1), (4.4, 2.6, 1.3), H['W'], ch=.25, tcolor=H['cream'])
    for sy in (-1, 1):
        p.face([(-4.8, sy * 1.62, 1.8), (1.2, sy * 1.62, 1.8), (1.2, sy * 1.62, 2.7), (-4.8, sy * 1.62, 2.7)], H['glassD'], flip_ref=V((-1.8, 0, 2.2)))
        p.face([(-3.4, sy * 1.32, 3.4), (.4, sy * 1.32, 3.4), (.4, sy * 1.32, 4.1), (-3.4, sy * 1.32, 4.1)], H['glassD'], flip_ref=V((-1.4, 0, 3.8)))
    p.face([(1.45, -1.3, 1.85), (1.45, 1.3, 1.85), (1.05, 1.2, 2.7), (1.05, -1.2, 2.7)], H['glass'], flip_ref=V((-2, 0, 2.2)))
    p.face([(1.0, -1.1, 3.4), (1.0, 1.1, 3.4), (.8, 1.0, 4.1), (.8, -1.0, 4.1)], H['glass'], flip_ref=V((-2, 0, 3.8)))
    for sy in (-1, 1):
        p.beam((-2.6, sy * 1.0, 4.4), (-2.6, sy * 1.0, 5.4), .07, H['steel'], 3)
    p.beam((-2.6, -1.0, 5.4), (-2.6, 1.0, 5.4), .07, H['steel'], 3)
    p.frustum((-2.6, 0, 5.4), .45, 0, .3, 4, H['white'], bottom=False)
    p.cbox((3.2, 0, 1.4), (2.4, 2.2, .35), H['woodL'], ch=.1, tcolor=0xe3c47e)
    p.box((-5.4, 0, 1.3), (1.6, 3.0, .3), H['woodL'], bottom=False)
    p.beam((4.8, 0, 1.8), (4.8, 0, 3.0), .05, H['white'], 3)
    p.face([(4.8, 0, 3.0), (4.8, 0, 2.5), (5.5, 0, 2.75)], H['red'], flip_ref=V((4.8, 5, 2.7)))


# ═════════════════════════════ BUILD ═════════════════════════════
def build(L):
    out = []
    rows = []   # (names, xspacing, rowdepth)
    pos = {}

    def row(items, dx, dy):
        rows.append((items, dx, dy))

    def mk(name, fn, fixed=False):
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
                # vertical walls: flat cartoon shade by facing (front/west lit, east/back dim), no AO gradient
                f[p.fsh] = max(.58, min(1.0, .8 + .28 * (n.x * lh.x + n.y * lh.y)))
                return f
            r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255
            c2 = (min(255, int(r * LIFT)) << 16) | (min(255, int(g * LIFT)) << 8) | min(255, int(b * LIFT))
            f[p.fcol] = c2
            return f
        p.face = lit_face
        fn(p)
        out.append(p)
        return p

    parts = {}
    for i, spec in enumerate(HOUSES):
        nm = 'casa_car_%02d' % (i + 1)
        parts[nm] = mk(nm, lambda p, s=spec: build_house(p, s), True)
    for i in range(6):
        nm = 'casa_playa_%02d' % (i + 1)
        parts[nm] = mk(nm, lambda p, k=i: playa(p, k), True)
    parts['iglesia_car'] = mk('iglesia_car', iglesia, True)
    parts['capilla_car'] = mk('capilla_car', capilla, True)
    parts['faro'] = mk('faro', faro)
    parts['fuerte_estrella'] = mk('fuerte_estrella', fuerte)
    parts['malecon_recto'] = mk('malecon_recto', malecon_recto)
    parts['malecon_curvo'] = mk('malecon_curvo', malecon_curvo)
    parts['muelle_pieza'] = mk('muelle_pieza', muelle_pieza)
    parts['muelle_cabana'] = mk('muelle_cabana', muelle_cabana)
    for i in range(6):
        nm = 'islote_%02d' % (i + 1)
        parts[nm] = mk(nm, lambda p, k=i: islote(p, k))
    for i in range(8):
        nm = 'roca_mar_%02d' % (i + 1)
        parts[nm] = mk(nm, lambda p, k=i: roca_mar(p, k))
    for i in range(4):
        nm = 'cayo_arena_%02d' % (i + 1)
        parts[nm] = mk(nm, lambda p, k=i: cayo(p, k))
    for i, c in enumerate('abc'):
        nm = 'arbusto_costa_' + c
        parts[nm] = mk(nm, lambda p, k=i: arbusto(p, k))
    for i, c in enumerate('ab'):
        nm = 'cactus_costa_' + c
        parts[nm] = mk(nm, lambda p, k=i: cactus(p, k))
    parts['uva_playa'] = mk('uva_playa', uva)
    for nm, fn in (('velero_b', velero_b), ('penero_azul', penero_azul), ('penero_rojo', penero_rojo), ('yate', yate)):
        parts[nm] = mk(nm, fn)

    layout = [
        (['casa_car_%02d' % i for i in range(1, 7)], 26, 30),
        (['casa_car_%02d' % i for i in range(7, 13)], 26, 30),
        (['casa_playa_%02d' % i for i in range(1, 7)], 26, 30),
        (['iglesia_car', 'capilla_car', 'faro', 'fuerte_estrella'], 40, 44),
        (['malecon_recto', 'malecon_curvo', 'muelle_pieza', 'muelle_cabana'], 30, 30),
        (['islote_%02d' % i for i in range(1, 7)], 30, 28),
        (['roca_mar_%02d' % i for i in range(1, 9)], 18, 24),
        (['cayo_arena_%02d' % i for i in range(1, 5)], 40, 28),
        (['arbusto_costa_a', 'arbusto_costa_b', 'arbusto_costa_c', 'cactus_costa_a', 'cactus_costa_b', 'uva_playa',
          'velero_b', 'penero_azul', 'penero_rojo', 'yate'], 15, 20),
    ]
    y = 0.0
    for names, dx, dy in layout:
        x0 = -dx * (len(names) - 1) / 2
        for i, nm in enumerate(names):
            parts[nm].loc = (x0 + i * dx, -y, 0)
        y += dy
    write_manifest(parts)
    return out


def write_manifest(parts):
    lines = ['# caribe_kit manifest', '',
             'GLB: `assets/models/caribe_kit.glb` (build: `tools/blender/prop_caribe_kit.py`). 1 unit = 1 map unit. Land pieces: origin = base centre, bases buried 0.5 (z=-0.5). '
             'Marine pieces: waterline z=0 (foam skirts at z~0.07). Front faces -Y. Boats: bow +X, keel z=0.', '',
             'Special origins: `malecon_curvo` is a 90 deg arc, sea on the INNER (concave) side, arc circle centre at local (-9, 9), centreline radius 16, width 4; '
             'it runs from the south end (tangent +X) to the east end (tangent +Y); origin is the bbox centre of the arc. `muelle_*`: deck top z=1.3, pier runs along X, '
             'tile pieces end to end (`muelle_pieza` 14 long); `muelle_cabana` hut at +X end. `malecon_recto` walkway top z=1.1, sea wall on the -Y side.', '',
             '| Part | tris | footprint (x y) | height |', '|---|---|---|---|']
    tot = 0
    for nm, p in parts.items():
        t, w, d, h = stats(p)
        tot += t
        lines.append('| %s | %d | %.1f x %.1f | %.1f |' % (nm, t, w, d, h))
    lines += ['', '**Total: %d tris** (%d parts).' % (tot, len(parts))]
    path = os.path.join(lib.MODEL_DIR, 'caribe_kit_manifest.md')
    os.makedirs(lib.MODEL_DIR, exist_ok=True)
    with open(path, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('CARIBE_TOTAL', tot)
    for nm, p in parts.items():
        t, w, d, h = stats(p)
        print('PART %-18s tris=%4d  %5.1f x %5.1f  h=%5.1f' % (nm, t, w, d, h))


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
