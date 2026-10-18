"""Section population: forests, deserts, towns, landmarks. Everything is placed in canvas coords on the shared heightfield."""
import numpy as np
from pz_lib import *
from pz_props import *
import pz_props as P
import pz_assets as QA


class Ctx:
    def __init__(s, sec, W, F, cfg, coll):
        s.sec, s.W, s.F, s.cfg, s.coll = sec, W, F, cfg, coll
        gy, gx = np.gradient(F['Z'], W.c)
        s.slope = np.hypot(gx, gy)
        s.circles = []          # (x, y, r) keep-out
        s.landmarks = []        # dict(id, name, x, y, kind)
        s.seed = cfg['seed']
        s.sc = {k: Scatter(f'{sec}_{k}') for k in ('trees', 'palms', 'cacti', 'shrubs', 'rocks', 'town', 'ind', 'misc', 'boats')}
        s.mat = vc_material()

    def land_at(s, x, y):
        return s.W.sample(s.W.land.astype(float), x, y) > 0.5

    def d_at(s, x, y):
        return s.W.sample(s.W.d, x, y)

    def z_at(s, x, y):
        return s.W.sample(s.F['Z'], x, y)

    def fld(s, k, x, y):
        return s.W.sample(s.F[k], x, y)

    def slope_at(s, x, y):
        return s.W.sample(s.slope, x, y)

    def blocked(s, pts, extra=0.0):
        pts = np.asarray(pts)
        m = np.zeros(len(pts), bool)
        for (cx, cy, r) in s.circles:
            m |= (pts[:, 0] - cx) ** 2 + (pts[:, 1] - cy) ** 2 < (r + extra) ** 2
        return m

    def in_rect(s, pts, pad=3):
        x0, y0, x1, y1 = s.W.rect
        return (pts[:, 0] > x0 + pad) & (pts[:, 0] < x1 - pad) & (pts[:, 1] > y0 + pad) & (pts[:, 1] < y1 - pad)

    def find_land(s, x, y, dmin=12, dmax=45, R=90, slope_max=0.5, land=True):
        best = None; bd = 1e9
        W = s.W
        xs = np.arange(max(W.rect[0] + 8, x - R), min(W.rect[2] - 8, x + R), 3.0)
        ys = np.arange(max(W.rect[1] + 8, y - R), min(W.rect[3] - 8, y + R), 3.0)
        X, Y = np.meshgrid(xs, ys); X = X.ravel(); Y = Y.ravel()
        ok = (s.land_at(X, Y) == land) & (s.d_at(X, Y) >= dmin) & (s.d_at(X, Y) <= dmax) & (s.slope_at(X, Y) < slope_max)
        if not ok.any():
            return (x, y)
        dd = np.hypot(X - x, Y - y); dd[~ok] = 1e9
        i = int(dd.argmin())
        return (float(X[i]), float(Y[i]))


def _lot_yaw(tx, ty):
    """Yaw that points a template's front (-y) toward (tx, ty)."""
    return math.atan2(tx, -ty)


def settlement(ctx, cx, cy, n=30, spread=26, houses=None, blocks=None, landmark=None, rot=None, name='town', side_streets=2, palms=8, tight=1.0, flat=False):
    """Main street + plaza + side streets; houses sit on lots facing the street with gaps; one landmark on the plaza."""
    rg = np.random.default_rng(int(cx * 7 + cy * 13))
    rot = (rg.random() - 0.5) * 0.9 if rot is None else rot
    cs, sn = math.cos(rot), math.sin(rot)
    P_ = lambda u, v: (cx + u * cs - v * sn, cy + u * sn + v * cs)
    Lh = spread * 1.0
    asph = hexc(0x6c6f78)
    streets = [((-Lh, 0), (Lh, 0))]
    offs = [-0.75, -0.25, 0.25, 0.75] if side_streets >= 3 else ([-0.5, 0.5] if side_streets == 2 else ([0.45] if side_streets == 1 else []))
    for o in offs:
        streets.append(((o * Lh * 1.3, -Lh * 0.62), (o * Lh * 1.3, Lh * 0.62)))
    ctx.circles.append((cx, cy, spread + 10))
    for i, (a_, b_) in enumerate(streets):
        ribbon(ctx.W, ctx.F, [P_(*a_), P_(*b_)], 3.6 if i == 0 else 2.8, 0.24, asph, f'{ctx.sec}_{name}_st{i}', ctx.coll)
    # plaza + fountain
    zc = ctx.z_at(cx, cy)
    disc(cx, cy, zc - 0.05, 6.8, hexc(0xd8cfb4), f'{ctx.sec}_{name}_plaza', 22, ctx.coll, 0.3)
    for k in range(5):
        a = k / 5 * 6.28 + 0.3
        x, y = cx + math.cos(a) * 6.2, cy + math.sin(a) * 6.2
        ctx.sc['town'].put(t_lamp(), x, y, ctx.z_at(x, y), 0, 1.0)
    # landmark on the plaza edge facing it
    if landmark is not None:
        lx, ly = P_(0, -17)
        ctx.sc['town'].put(landmark, lx, ly, ctx.z_at(lx, ly) - 0.1, _lot_yaw(-sn * -1, cs * -1) if False else _lot_yaw(-sn, cs), 1.45)
    houses = houses or [t_house(i) for i in range(10)]
    placed = 0
    sp = 10.8 * tight
    for si, (a_, b_) in enumerate(streets):
        A = np.array(P_(*a_)); B = np.array(P_(*b_)); Ln = np.linalg.norm(B - A); dvec = (B - A) / Ln; nv = np.array([-dvec[1], dvec[0]])
        for side in (-1, 1):
            s = rg.random() * 4 + 3
            while s < Ln - 3 and placed < n:
                pt = A + dvec * s
                off = 1.8 + 1.0 + 4.6
                pos = pt + nv * side * (off + rg.random() * 1.0)
                r_c = math.hypot(pos[0] - cx, pos[1] - cy)
                skip = rg.random() < 0.10 or r_c < 15 or r_c > spread * 1.05 or (si > 0 and abs(math.hypot(pt[0] - cx, pt[1] - cy)) < 8)
                if not skip and ctx.land_at(pos[0], pos[1]) and ctx.d_at(pos[0], pos[1]) > 5 and ctx.slope_at(pos[0], pos[1]) < 0.5:
                    tpl = houses[int(rg.random() * len(houses))]
                    if blocks and r_c < spread * 0.5 and rg.random() < 0.5:
                        tpl = blocks[int(rg.random() * len(blocks))]
                    ctx.sc['town'].put(tpl, pos[0], pos[1], ctx.z_at(pos[0], pos[1]) - 0.15, _lot_yaw(-nv[0] * side, -nv[1] * side), 1.5 + rg.random() * 0.3)
                    placed += 1
                s += sp * (0.85 + 0.4 * rg.random())
    # street trees (sparse) and a few palms around
    for k in range(palms):
        a = rg.random() * 6.28; r = spread * (0.95 + rg.random() * 0.35)
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        if ctx.land_at(x, y) and ctx.d_at(x, y) > 5:
            ctx.sc['palms'].put(t_palm(int(rg.random() * 9999)), x, y, ctx.z_at(x, y) - 0.2, rg.random() * 6.28, 0.95)
    return placed


def town(cx, cy, ctx, n=40, spread=34, colorful=False, church=True, rot=None, name='town', pal=0, style=None):
    styles = ['church', 'chapel', 'clock', 'market']
    st = style or (styles[0] if (church and n >= 50) else styles[1 + (pal + int(cx)) % 3])
    lm = {'church': t_church, 'chapel': t_chapel, 'clock': t_clock, 'market': t_market}[st]()
    k = (pal + int(cx) // 7) % 4
    if k == 0:      # colonial: red pitched roofs, white walls
        houses = [t_house(i + pal, False) for i in range(12)] + [t_row(i + pal) for i in range(3)]
    elif k == 1:    # coastal: colourful + long arcaded rows
        houses = [t_house(i + pal, True) for i in range(8)] + [t_row(i + pal, True) for i in range(5)]
    elif k == 2:    # hacienda: L-shaped courtyards + sheds
        houses = [t_hacienda(i + pal) for i in range(6)] + [t_house(i + pal, False) for i in range(6)]
    else:           # mixed
        houses = [t_house(i + pal, colorful) for i in range(8)] + [t_row(i + pal) for i in range(3)] + [t_hacienda(i) for i in range(3)]
    return settlement(ctx, cx, cy, n, spread, houses, None, lm, rot, name, 3 if n > 24 else 2)


def forests(ctx, step=6.6, desert_max=0.5):
    """Discrete groves of varied size with clearings between them, plus a few lone trees and bushes at grove edges."""
    W = ctx.W
    rg = np.random.default_rng(ctx.seed + 501)
    alpine = ctx.cfg.get('alpine', False)
    if alpine:
        tr = QA.pines() * 2 + QA.ktrees()[:4]
    else:
        tr = (QA.trees() * 2 + [t_tree(i) for i in (0, 6, 13)]) if QA.trees() else [t_tree(i) for i in range(21)]
    bushes = QA.bushes() or [t_shrub(i) for i in range(6)]
    centers = jgrid(W.rect, 30.0, 0.5)
    cnt = 0
    for cx, cy in centers:
        if not (W.rect[0] + 6 < cx < W.rect[2] - 6 and W.rect[1] + 6 < cy < W.rect[3] - 6):
            continue
        if not ctx.land_at(cx, cy):
            continue
        des = float(ctx.fld('desert', cx, cy)); mt = float(ctx.fld('mount', cx, cy))
        wet = float(sstep(0.30, 0.58, fbm(cx / 95, cy / 95, ctx.seed + 90, 3))) * float(np.clip(1.2 - des * 2.6, 0, 1)) * float(np.clip(1.2 - mt * 0.8, 0, 1))
        if alpine:
            wet = float(sstep(0.38, 0.62, fbm(cx / 70, cy / 70, ctx.seed + 90, 3))) * float(sstep(46, 30, ctx.z_at(cx, cy)))
        if rg.random() > wet * 0.95:
            continue
        R = 9 + rg.random() * 15 + 8 * wet
        ang = rg.random() * 6.28; ca, sa = math.cos(ang), math.sin(ang); ell = 0.55 + rg.random() * 0.4
        k = int(R * R * 0.05 * (0.6 + 0.8 * wet))
        for _ in range(k):
            u = rg.normal() * R * 0.5; v = rg.normal() * R * 0.5 * ell
            x = cx + u * ca - v * sa; y = cy + u * sa + v * ca
            if not (W.rect[0] + 6 < x < W.rect[2] - 6 and W.rect[1] + 6 < y < W.rect[3] - 6):
                continue
            if not (ctx.land_at(x, y) and ctx.d_at(x, y) > 10 and ctx.slope_at(x, y) < (1.3 if alpine else 0.8)) or (alpine and ctx.z_at(x, y) > 52):
                continue
            if ctx.blocked(np.array([[x, y]]), 3)[0]:
                continue
            sc_ = 0.9 + rg.random() * 0.55 - 0.25 * (math.hypot(u, v) / (R * 0.9))
            ctx.sc['trees'].put(tr[int(rg.random() * len(tr))], x, y, ctx.z_at(x, y) - 0.2, rg.random() * 6.28, max(0.6, sc_))
            cnt += 1
        for _ in range(int(k * 0.35)):                       # bushes ring the grove edge
            a2 = rg.random() * 6.28; rr = R * (0.7 + rg.random() * 0.5)
            x = cx + math.cos(a2) * rr * ca - math.sin(a2) * rr * ell * sa; y = cy + math.cos(a2) * rr * sa + math.sin(a2) * rr * ell * ca
            if ctx.land_at(x, y) and ctx.d_at(x, y) > 9 and ctx.slope_at(x, y) < 0.7 and not ctx.blocked(np.array([[x, y]]), 2)[0]:
                ctx.sc['shrubs'].put(bushes[int(rg.random() * len(bushes))], x, y, ctx.z_at(x, y) - 0.2, rg.random() * 6.28, 0.8 + rg.random() * 0.6)
    pts = jgrid(W.rect, 14.0, 0.5); pts = pts[ctx.in_rect(pts, 6)]
    x, y = pts[:, 0], pts[:, 1]
    des = ctx.fld('desert', x, y)
    ok = ctx.land_at(x, y) & (ctx.d_at(x, y) > 10) & (ctx.slope_at(x, y) < 0.6) & (des < 0.5) & ~ctx.blocked(pts, 3)
    keep = ok & (rng.random(len(x)) < 0.10)
    place_many(W, ctx.F, ctx.sc['trees'], tr, pts[keep], (0.9, 1.3))
    return cnt


def coast_palms(ctx, step=8.0):
    """Small palm groups with wide gaps and a few lone palms; no continuous rows along the shore."""
    W = ctx.W
    rg = np.random.default_rng(ctx.seed + 777)
    centers = jgrid(W.rect, 22.0, 0.5); n = 0
    for cx, cy in centers:
        if not (W.rect[0] + 6 < cx < W.rect[2] - 6 and W.rect[1] + 6 < cy < W.rect[3] - 6):
            continue
        d = float(ctx.d_at(cx, cy))
        if not (ctx.land_at(cx, cy) and 8 < d < 38):
            continue
        p = 0.42 * float(sstep(0.45, 0.65, fbm(cx / 60, cy / 60, ctx.seed + 55, 2)))
        if rg.random() > p:
            continue
        k = 2 + int(rg.random() * 5); R = 4 + rg.random() * 5
        for _ in range(k):
            x = cx + rg.normal() * R; y = cy + rg.normal() * R
            if ctx.land_at(x, y) and ctx.d_at(x, y) > 6 and ctx.slope_at(x, y) < 0.5 and not ctx.blocked(np.array([[x, y]]), 2)[0] and not (ctx.fld('crest', x, y) > 0.6 and ctx.fld('desert', x, y) > 0.5):
                ctx.sc['palms'].put((lambda pl: pl[int(rg.random() * len(pl))] if pl else t_palm(int(rg.random() * 9999)))(QA.palms()), x, y, ctx.z_at(x, y) - 0.2, rg.random() * 6.28, 0.85 + rg.random() * 0.4); n += 1
    return n


def desert_life(ctx):
    """Deliberate placement: cacti in uneven patches on dune fields, scrub along the coast strip and at biome transitions."""
    W = ctx.W
    pts = jgrid(W.rect, 13.0, 0.5); pts = pts[ctx.in_rect(pts, 6)]
    x, y = pts[:, 0], pts[:, 1]
    des = ctx.fld('desert', x, y); mt = ctx.fld('mount', x, y)
    patch = sstep(0.58, 0.74, fbm(x / 55, y / 55, ctx.seed + 33, 2))
    ok = ctx.land_at(x, y) & (ctx.d_at(x, y) > 14) & (ctx.slope_at(x, y) < 0.35) & (des > 0.5) & (mt < 0.35) & (ctx.fld('crest', x, y) < 0.5)
    keep = ok & (rng.random(len(x)) < 0.55 * patch) & ~ctx.blocked(pts, 3)
    place_many(W, ctx.F, ctx.sc['cacti'], QA.cacti() or [t_cactus(i) for i in range(8)], pts[keep], (0.85, 1.3), zoff=-0.2)
    pts = jgrid(W.rect, 8.0, 0.5); pts = pts[ctx.in_rect(pts, 6)]
    x, y = pts[:, 0], pts[:, 1]
    d = ctx.d_at(x, y); des = ctx.fld('desert', x, y)
    strip = sstep(6, 10, d) * sstep(26, 18, d) * sstep(0.62, 0.78, fbm(x / 28, y / 28, ctx.seed + 34, 2))
    trans = (1 - np.clip(abs(des - 0.4) / 0.14, 0, 1)) * sstep(0.5, 0.7, fbm(x / 22, y / 22, ctx.seed + 35, 2)) * 0.7
    keep = ctx.land_at(x, y) & (ctx.slope_at(x, y) < 0.6) & (ctx.fld('crest', x, y) < 0.55) & (rng.random(len(x)) < np.maximum(strip, trans)) & ~ctx.blocked(pts, 2)
    place_many(W, ctx.F, ctx.sc['shrubs'], QA.bushes() or [t_shrub(i, 1.0, True) for i in range(6)], pts[keep], (0.8, 1.3), zoff=-0.2)
    return 0


def boulders(ctx):
    """Rocks only on exposed outcrops (steep slopes inside mountain zones), in clusters."""
    W = ctx.W
    pts = jgrid(W.rect, 9.0, 0.5); pts = pts[ctx.in_rect(pts, 6)]
    x, y = pts[:, 0], pts[:, 1]
    sl = ctx.slope_at(x, y); mt = ctx.fld('mount', x, y)
    clump = sstep(0.55, 0.7, fbm(x / 24, y / 24, ctx.seed + 36, 2))
    p = np.clip((sl - 0.3) * 1.6, 0, 1) * sstep(0.35, 0.7, mt) * clump * (0.35 if ctx.cfg.get('alpine') else 1.0)
    keep = ctx.land_at(x, y) & (ctx.d_at(x, y) > 8) & (rng.random(len(x)) < p) & ~ctx.blocked(pts, 3)
    place_many(W, ctx.F, ctx.sc['rocks'], (QA.alpine_rocks() if ctx.cfg.get('alpine') else QA.rocks()) or [t_boulder(i, 1.0) for i in range(10)], pts[keep], (0.9, 2.1), zoff=-0.4)


def t_islet(seed, depth, r=7.0):
    """Rock column from the seabed up through the water + boulders and a few palms' worth of green on top."""
    rg = np.random.default_rng(seed)
    m = Mesh()
    top = 3.2 + rg.random() * 2.5
    seg = 9
    levels = 4
    rings = []
    for lv in range(levels + 1):
        t = lv / levels
        z = -depth + (depth + top) * t
        rad = r * (1 - 0.55 * t ** 1.3)
        ang = np.linspace(0, 2 * np.pi, seg, endpoint=False)
        rr = rad * (0.78 + 0.45 * rg.random(seg))
        rings.append(np.stack([rr * np.cos(ang), rr * np.sin(ang), np.full(seg, z)], -1))
    V = np.vstack(rings); F = []
    for lv in range(levels):
        for i in range(seg):
            j = (i + 1) % seg
            F.append((lv * seg + i, lv * seg + j, (lv + 1) * seg + j, (lv + 1) * seg + i))
    c = V.shape[0]
    V = np.vstack([V, [[0, 0, top + 0.3]]])
    for i in range(seg):
        F.append((levels * seg + i, levels * seg + (i + 1) % seg, c))
    cols = np.array([ROCKS_I[int(rg.random() * 3)] for _ in range(len(V))])
    sh = 0.7 + 0.45 * np.clip((V[:, 2] + depth) / (depth + top), 0, 1)
    m.add(V, F, cols, False, sh)
    # grass cap + boulders
    capc = hexc(0x5aa03c)
    Vb, Fb = blob((0, 0, top + 0.1), r * 0.42, 0.55, 1, 0.2, seed); m.add(Vb, Fb, capc, True, shade_z(Vb, top - 1, top + 2, 0.8, 1.15))
    for i in range(2):
        Vb, Fb = blob((rg.normal() * 2.5, rg.normal() * 2.5, top + 0.2), 1.5 + rg.random(), 0.7, 1, 0.3, seed + i); m.add(Vb, Fb, ROCKS_I[i], False, shade_z(Vb, top - 1, top + 2, 0.8, 1.15))
    V, F, C, S = m.arrays()
    return V, F, C, S


ROCKS_I = [hexc(0x9c7a58), hexc(0xb18c63), hexc(0x8a6a4c)]


def islets(ctx, n=6, dmin=14, dmax=70, seed=1):
    """Varied islets: rock stack with sand bar, bare rock cluster, small palm cay. Sizes and shapes differ."""
    rg = np.random.default_rng(ctx.seed + seed)
    W = ctx.W
    cnt = 0; tries = 0
    while cnt < n and tries < 600:
        tries += 1
        x = W.rect[0] + 20 + rg.random() * (W.rect[2] - W.rect[0] - 40); y = W.rect[1] + 20 + rg.random() * (W.rect[3] - W.rect[1] - 40)
        if ctx.land_at(x, y) or not (dmin < ctx.d_at(x, y) < dmax) or ctx.z_at(x, y) < -11:
            continue
        if ctx.blocked(np.array([[x, y]]), 14)[0]:
            continue
        z = float(ctx.z_at(x, y)); kind = cnt % 3
        if kind == 0:
            r = 5.0 + rg.random() * 4.0
            ctx.sc['rocks'].put(t_islet(int(rg.random() * 9999), -z + 0.5, r), x, y, 0.0, rg.random() * 6.28, 1.0)
            sb, sf = blob((x, y, -0.25), r * 1.3, 0.12, 1, 0.35, int(rg.random() * 999))
            ctx.sc['rocks'].m.add(sb, sf, hexc(0xe2d3a0), True)
        elif kind == 1:
            for i in range(2 + int(rg.random() * 3)):
                ox, oy = rg.normal() * 4, rg.normal() * 4
                zi = float(ctx.z_at(x + ox, y + oy))
                if zi < -9:
                    continue
                s_ = (-zi + 3.0) / 2.2
                ctx.sc['rocks'].put(t_boulder(int(rg.random() * 999)), x + ox, y + oy, zi - 0.5, rg.random() * 6.28, max(1.2, s_) * (0.8 + rg.random() * 0.5))
        else:
            ctx.sc['misc'].put(t_cay(int(rg.random() * 99), -z + 0.4), x, y, 0.0, 0, 0.55 + rg.random() * 0.35)
            for i in range(2 + int(rg.random() * 3)):
                a2 = rg.random() * 6.28
                ctx.sc['palms'].put(t_palm(int(rg.random() * 99)), x + math.cos(a2) * 2.5, y + math.sin(a2) * 2.5, 0.9, a2, 0.7)
        ctx.circles.append((x, y, 14)); cnt += 1


def finish(ctx):
    objs = []
    for k, sc in ctx.sc.items():
        o = sc.build(ctx.coll, ctx.mat)
        if o:
            objs.append(o)
    return objs
