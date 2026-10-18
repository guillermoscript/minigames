"""Per-section landmark composition (node driven). populate(sec, W, F, C, cfg) is called by run_section.py."""
import json, sys
import numpy as np
from pz_lib import *
from pz_props import *
import pz_props as P
import pz_assets as QA
from pz_populate import *

PATHC = hexc(0xefe0b8)
NODE_COL = {'salida': 0x3ec46d, 'azul': 0x3a8fe0, 'roja': 0xe0463a, 'banco': 0xf2c230, 'transporte': 0x8c95a6, 'evento': 0xa05ad8}
MINSEP = 58.0


def geo(name):
    sys.path.insert(0, PINNED)
    import geo_v2 as g
    la, lo = g.A[name]
    x, y = g.proj(lo, la)
    off = layout()['offset']
    return (x - off[0], y - off[1])


def all_nodes():
    sys.path.insert(0, PINNED)
    import geo_v2 as g
    R = json.load(open(os.path.join(PINNED, 'regions.json')))
    out = {}
    for k in g.A:
        if k in R['node_region']:
            out[k] = dict(id=k, region=R['node_region'][k], type=R['node_type'].get(k, 'azul'), name=R['node_name'].get(k, k), geo=geo(k))
    return out


# which landmark builder each node gets: (kind, size)
BUILD = {
    'and_merida': ('colonial', 60), 'and_ejido': ('town', 26), 'and_elvigia': ('town', 26), 'and_losnevados': ('town', 14), 'and_picoespejo': ('peak', 0),
    'coc_coro': ('colonial', 70), 'zul_dabajuro': ('town', 34), 'coc_barquisimeto': ('city', 70), 'coc_sanfelipe': ('town', 40),
    'coc_morrocoy': ('cay', 0), 'zul_maracaibo': ('city', 110), 'zul_puente': ('bridge', 0), 'zul_altagracia': ('stilts', 7),
    'zul_gaita': ('town', 30), 'zul_sanfrancisco': ('town', 32), 'zul_cabimas': ('oil', 8), 'zul_ojeda': ('oil', 7), 'zul_lagunillas': ('oil', 8),
    'zul_machiques': ('town', 34), 'zul_catatumbo': ('storm', 0), 'zul_encontrados': ('town', 30),
}


def bridge(ctx, p0, p1, h=10.5, towers=5, name='bridge', ramp=40.0):
    """Cable-stayed bridge. (p0, p1) are the water-crossing ends; deck ramps down to ground over `ramp` units beyond them."""
    p0 = np.array(p0, float); p1 = np.array(p1, float)
    d0 = (p1 - p0) / np.linalg.norm(p1 - p0)
    q0 = p0 - d0 * ramp; q1 = p1 + d0 * ramp
    L = float(np.linalg.norm(q1 - q0)); dirv = (q1 - q0) / L; nrm = np.array([-dirv[1], dirv[0]])
    gz0 = float(ctx.z_at(*q0)); gz1 = float(ctx.z_at(*q1))
    m = Mesh()
    steel = hexc(0xeceae2); rail = hexc(0xdad8d0); conc = hexc(0xcfccc2); road = hexc(0x3c3f46)

    def hz_at(t):
        s_ = t * L; e = min(s_, L - s_); g = gz0 if s_ < L / 2 else gz1
        return g + 0.9 + (h - g - 0.9) * float(sstep(0, ramp, e))

    n = max(10, int(L / 3.5)); w = 4.4
    for i in range(n):
        t0 = i / n; t1 = (i + 1) / n
        a = q0 + (q1 - q0) * t0; b = q0 + (q1 - q0) * t1
        za, zb_ = hz_at(t0), hz_at(t1)
        V = np.array([[*(a + nrm * w), za + 0.9], [*(b + nrm * w), zb_ + 0.9], [*(b - nrm * w), zb_ + 0.9], [*(a - nrm * w), za + 0.9],
                      [*(a + nrm * w), za - 0.7], [*(b + nrm * w), zb_ - 0.7], [*(b - nrm * w), zb_ - 0.7], [*(a - nrm * w), za - 0.7]])
        m.add(V, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 4, 7, 3), (1, 2, 6, 5), (3, 7, 6, 2), (0, 1, 5, 4)], road)
        for sg in (-1, 1):
            q = a + nrm * w * sg; qq = b + nrm * w * sg
            V2, F2 = tube((*q, za + 1.6), (*qq, zb_ + 1.6), 0.26, 4); m.add(V2, F2, rail)
    for t in np.linspace(0.02, 0.98, max(4, int(L / 13))):
        c = q0 + (q1 - q0) * t
        zb = float(ctx.z_at(c[0], c[1])) - 0.5; hz = hz_at(t)
        if hz - zb < 2.4:
            continue
        for sg in (-1, 1):
            q = c + nrm * 2.6 * sg
            V, F = tube((*q, zb), (*q, hz - 0.6), 1.3, 6); m.add(V, F, conc)
        V, F = tube((*(c + nrm * 3.6), hz - 0.4), (*(c - nrm * 3.6), hz - 0.4), 1.0, 4); m.add(V, F, conc)
    wl = L - 2 * ramp
    top_h = 32.0
    for tw in np.linspace(0.28, 0.72, towers):
        t = (ramp + tw * wl) / L; c = q0 + (q1 - q0) * t; hz = hz_at(t)
        for sg in (-1, 1):
            base = c + nrm * 4.8 * sg; topp = c + nrm * 0.8 * sg
            V, F = tube((*base, hz - 0.5), (*topp, hz + top_h), 1.3, 4); m.add(V, F, steel)
        V, F = tube((*(c + nrm * 3.1), hz + top_h * 0.5), (*(c - nrm * 3.1), hz + top_h * 0.5), 0.6, 4); m.add(V, F, steel)
        for sg in (-1, 1):
            topp = c + nrm * 0.8 * sg
            for j in range(1, 5):
                for sdir in (-1, 1):
                    q = c + dirv * j * 6.0 * sdir + nrm * 3.9 * sg
                    zq = hz_at(t + sdir * j * 6.0 / L) + 1.5
                    V, F = tube((*topp, hz + top_h - 1.1 * j), (*q, zq), 0.2, 3); m.add(V, F, rail)
    cols = [0xd9503a, 0xf4f4f0, 0xe8b820, 0x4a8fd0, 0x3a7a4a, 0xf08c3a]
    for i in range(14):
        rg = np.random.default_rng(i); t = 0.06 + 0.88 * rg.random(); lane = 1 if i % 2 else -1
        c = q0 + (q1 - q0) * t + nrm * 2.2 * lane
        V, F = box(4.0, 1.9, 1.4, 0); V = rotz(V, math.atan2(dirv[1], dirv[0])) + np.array([*c, hz_at(t) + 0.9]); m.add(V, F, hexc(cols[i % 6]))
    V, F, C, S = m.arrays()
    make_mesh_obj(f'{ctx.sec}_{name}', V, F, C, [False] * len(F), ctx.coll, ctx.mat)
    for t in np.linspace(0, 1, int(L / 9)):
        c = q0 + (q1 - q0) * t; ctx.circles.append((c[0], c[1], 11))
    return q0, q1


def oil_field(ctx, cx, cy, n=6, spread=26):
    """Readable groups of derricks on gravel pads + a tank pad, joined by a service track."""
    rg = np.random.default_rng(int(cx * 3 + cy))
    der = t_derrick(); gravel = hexc(0x9d9078); track = hexc(0x9a8e72)
    groups = max(1, int(math.ceil(n / 3.0))); centers = []
    for g in range(groups + 1):
        for _ in range(60):
            a = rg.random() * 6.28; r = spread * (0.35 + 0.75 * rg.random())
            x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
            if ctx.land_at(x, y) and ctx.d_at(x, y) > 22 and ctx.slope_at(x, y) < 0.35 and not ctx.blocked(np.array([[x, y]]), 14)[0] and all((x - c[0]) ** 2 + (y - c[1]) ** 2 > 34 ** 2 for c in centers):
                centers.append((x, y)); break
    for gi, (x, y) in enumerate(centers):
        z = ctx.z_at(x, y); disc(x, y, z - 0.05, 15 if gi < groups else 13, gravel, f'{ctx.sec}_pad{int(x)}_{int(y)}', 24, ctx.coll, 0.2)
        ctx.circles.append((x, y, 25))
        if gi < groups:
            for k in range(min(3, n - gi * 3)):
                a = k / 3 * 6.28 + gi
                dx, dy = x + math.cos(a) * 9, y + math.sin(a) * 9
                ctx.sc['ind'].put(der, dx, dy, ctx.z_at(dx, dy), a + 0.6, 0.9)
        else:
            for k in range(3):
                tx, ty = x + (k - 1) * 9.5, y
                ctx.sc['ind'].put(t_tank(k), tx, ty, ctx.z_at(tx, ty), 0, 1.0)
            ctx.sc['ind'].put(t_shed(), x, y + 9, ctx.z_at(x, y + 9), 0, 1.0)
    for a_, b_ in zip(centers[:-1], centers[1:]):
        ribbon(ctx.W, ctx.F, [a_, ((a_[0] + b_[0]) / 2 + 4, (a_[1] + b_[1]) / 2 - 3), b_], 3.0, 0.3, track, f'{ctx.sec}_track{int(a_[0])}', ctx.coll)
    ctx.circles.append((cx, cy, spread * 0.5))


def city(ctx, cx, cy, n=44, spread=34):
    houses = [t_house(i + 1, True, True) for i in range(12)]
    blocks = [t_tower_block(i) for i in range(6)]
    return settlement(ctx, cx, cy, n, spread, houses, blocks, t_clock(), None, 'city', 3, 12, 0.85, True)


def stilts(ctx, cx, cy, n=7):
    rg = np.random.default_rng(int(cx + cy))
    placed = 0
    for _ in range(80):
        if placed >= n:
            break
        x = cx + (rg.random() - 0.5) * 50; y = cy + (rg.random() - 0.5) * 50
        z = ctx.z_at(x, y)
        if ctx.land_at(x, y) or not (4 < ctx.d_at(x, y) < 26) or z < -9:
            continue
        if any((x - q[0]) ** 2 + (y - q[1]) ** 2 < 11 ** 2 for q in ctx.misc_pts):
            continue
        ctx.misc_pts.append((x, y))
        ctx.sc['town'].put(t_palafito(int(rg.random() * 99)), x, y, 0.0, rg.random() * 6.28, 1.2); placed += 1
    ctx.circles.append((cx, cy, 20))


def storm(ctx, x, y):
    ctx.sc['misc'].put(t_cloud(3), x, y, 54.0, 0.0, 0.9)
    obj = None
    for i, (ox, oy) in enumerate(((-12, 4), (6, -8), (16, 10))):
        V, F, C, S = t_bolt(i, 44.0)
        P_ = V + np.array([x + ox, y + oy, 49.0])
        make_mesh_obj(f'{ctx.sec}_bolt{i}', P_, F, np.tile(hexc(0xfff6c8), (len(P_), 1)), [False] * len(F), ctx.coll, emit_material())


def pad(ctx, nd):
    """Compact game tile: small ring + coloured disc on the plaza, short pole with a small bulb."""
    x, y = nd['x'], nd['y']
    z = float(ctx.z_at(x, y)) if not nd.get('deck') else nd['deck']
    col = hexc(NODE_COL.get(nd['type'], 0x3a8fe0))
    z = max(z, 0.0)
    disc(x, y, z - 0.02, 5.6, hexc(0xffffff), f"{ctx.sec}_padring_{nd['id']}", 24, ctx.coll, 0.35)
    disc(x, y, z + 0.1, 4.6, col, f"{ctx.sec}_pad_{nd['id']}", 24, ctx.coll, 0.4)
    V, F = tube((x, y, z + 0.4), (x, y, z + 8.5), 0.28, 4)
    V2, F2 = blob((x, y, z + 9.6), 1.9, 1.0, 1, 0.0, 1)
    Vv = np.vstack([V, V2]); Ff = F + [tuple(i + len(V) for i in f) for f in F2]
    Cc = np.vstack([np.tile(hexc(0x444444), (len(V), 1)), np.tile(col, (len(V2), 1))])
    make_mesh_obj(f"{ctx.sec}_pin_{nd['id']}", Vv, Ff, Cc, [False] * len(F) + [True] * len(F2), ctx.coll, ctx.mat)


def place_nodes(ctx, nodes):
    """Anchor each node near its geographic position, snapped to land and spread to >= MINSEP."""
    W = ctx.W; pos = {}
    for k, nd in nodes.items():
        x, y = nd['geo']
        kind = BUILD.get(k, ('town', 10))[0]
        if kind == 'cay':
            pos[k] = ctx.find_land(x, y, dmin=18, dmax=45, R=70, slope_max=2, land=False)
        elif kind in ('stilts',):
            pos[k] = ctx.find_land(x, y, dmin=8, dmax=22, R=60, slope_max=2, land=False)
        elif kind == 'bridge':
            pos[k] = (x, y)
        else:
            pos[k] = ctx.find_land(x, y, dmin=16, dmax=400, R=70)
    keys = list(pos)
    fixed = {k for k in keys if BUILD.get(k, ('',))[0] in ('bridge',)}
    for it in range(80):
        moved = False
        for i, a in enumerate(keys):
            for b in keys[i + 1:]:
                pa = np.array(pos[a]); pb = np.array(pos[b]); d = np.linalg.norm(pa - pb)
                if d < MINSEP and d > 1e-6:
                    push = (pa - pb) / d * (MINSEP - d) / 2
                    for k, s in ((a, 1), (b, -1)):
                        if k in fixed:
                            continue
                        q = np.array(pos[k]) + push * s
                        kind = BUILD.get(k, ('town',))[0]
                        want_land = kind not in ('cay', 'stilts')
                        if ctx.land_at(q[0], q[1]) == want_land and (not want_land or ctx.d_at(q[0], q[1]) > 14):
                            pos[k] = (float(q[0]), float(q[1])); moved = True
        if not moved:
            break
    return pos


def draw_paths(ctx, pos, nodes):
    L = layout(); W = ctx.W
    edges = L['edges'] + L['special']
    drawn = []
    for a, b in edges:
        if a in pos and b in pos:
            pa = np.array(pos[a]); pb = np.array(pos[b])
            ts = np.linspace(0, 1, 24); pts = pa[None] + (pb - pa)[None] * ts[:, None]
            land = ctx.land_at(pts[:, 0], pts[:, 1]).mean()
            via_bridge = 'zul_puente' in (a, b)
            if land < 0.7 and not via_bridge:
                continue
            drawn.append((a, b))
            mid = (pa + pb) / 2; perp = np.array([-(pb - pa)[1], (pb - pa)[0]]); perp /= (np.linalg.norm(perp) + 1e-9)
            mid = mid + perp * (np.random.default_rng(len(a) * 31 + len(b)).random() - 0.5) * 0.18 * np.linalg.norm(pb - pa)
            pl = np.array(chaikin([pa, mid, pb], 3)[:]) if False else np.array([pa, mid, pb])
            ribbon(W, ctx.F, pl, 2.8, 0.28, PATHC, f'{ctx.sec}_road_{a}__{b}', ctx.coll)
            for t in np.linspace(0.1, 0.9, max(2, int(np.linalg.norm(pb - pa) / 7))):
                p = pa + (pb - pa) * t; ctx.circles.append((p[0], p[1], 6.5))
    return drawn


TERRACE_R = {'peak': 0, 'colonial': 46, 'city': 52, 'town': 34, 'oil': 0, 'stilts': 0, 'cay': 0, 'bridge': 0, 'storm': 28}


def terrace(F, C, W, x, y, R, blend=18.0, tint=0xb9ab7a):
    """Level ground around a settlement with a soft shoulder back into the terrain."""
    dist = np.hypot(W.X - x, W.Y - y)
    w = (1 - sstep(R, R + blend, dist)) * W.land
    zt = float(np.clip(W.sample(F['Z'], x, y), 1.8, None))
    F['Z'][:] = F['Z'] * (1 - w) + zt * w
    C[:] = C * (1 - 0.55 * w[..., None]) + hexc(tint) * 0.55 * w[..., None]


def corridor(F, C, W, a, b, half=9.0, blend=12.0):
    """Smooth, evenly graded road bed along a->b (canvas pts)."""
    a = np.array(a, float); b = np.array(b, float); ab = b - a; L2 = float(ab @ ab) + 1e-9
    t = np.clip(((W.X - a[0]) * ab[0] + (W.Y - a[1]) * ab[1]) / L2, 0, 1)
    px = a[0] + ab[0] * t; py = a[1] + ab[1] * t
    dist = np.hypot(W.X - px, W.Y - py)
    w = (1 - sstep(half, half + blend, dist)) * W.land
    za = max(float(W.sample(F['Z'], *a)), 1.8); zb = max(float(W.sample(F['Z'], *b)), 1.8)
    zt = za + (zb - za) * t
    F['Z'][:] = F['Z'] * (1 - w) + zt * w


def bridge_geometry(W):
    best = None
    for j, yy in enumerate(W.ys):
        if not (400 <= yy <= 520):
            continue
        xs = np.nonzero(W.lake[j])[0]
        if len(xs) < 4:
            continue
        w = W.xs[xs[-1]] - W.xs[xs[0]]
        sc_ = abs(w - 125)
        if best is None or sc_ < best[0]:
            best = (sc_, yy, W.xs[xs[0]], W.xs[xs[-1]])
    _, by, bx0, bx1 = best
    return (bx0 - 20, by - 5), (bx1 + 20, by + 6)


def carve_river(F, C, W, pts, width=4.6):
    """Carve a monotonic-descending channel along pts; returns the dense centre line and bed heights."""
    P = np.array(pts, float)
    for _ in range(3):
        out = [P[0]]
        for a_, b_ in zip(P[:-1], P[1:]):
            out += [a_ * .75 + b_ * .25, a_ * .25 + b_ * .75]
        out.append(P[-1]); P = np.array(out)
    seg = [P[0]]
    for a, b in zip(P[:-1], P[1:]):
        k = max(1, int(np.hypot(*(b - a)) / 3.0))
        for i in range(1, k + 1):
            seg.append(a + (b - a) * i / k)
    P = np.array(seg)
    zg = np.array([max(float(W.sample(F['Z'], x, y)), 2.0) for x, y in P])
    win = 9
    zs = np.convolve(np.pad(zg, win // 2, mode='edge'), np.ones(win) / win, mode='valid')
    bed = np.minimum.accumulate(zs) - 1.4
    bed = np.maximum(bed, 1.5)
    for (x, y), zt in zip(P, bed):
        d = np.hypot(W.X - x, W.Y - y)
        m = d < width + 12
        if not m.any():
            continue
        w = np.where(m, 1 - sstep(width * 0.7, width + 10, d), 0.0)
        F['Z'][:] = np.where(w > 0, np.minimum(F['Z'], F['Z'] * (1 - w) + zt * w), F['Z'])
        wet = np.where(m, 1 - sstep(width * 0.9, width + 4, d), 0.0)[..., None]
        C[:] = C * (1 - 0.5 * wet) + hexc(0x8a8478) * 0.5 * wet
    return P, bed


def river_mesh(ctx, P, bed, width=4.6, name='river'):
    n = len(P)
    t = np.gradient(P, axis=0); t /= (np.linalg.norm(t, axis=1, keepdims=True) + 1e-9)
    nv = np.stack([-t[:, 1], t[:, 0]], -1)
    wv = width * (0.9 + 0.25 * fbm(P[:, 0] / 25, P[:, 1] / 25, 5, 2))
    L = P + nv * wv[:, None]; R = P - nv * wv[:, None]
    z = bed + 0.9
    V = np.vstack([np.column_stack([L, z]), np.column_stack([R, z])])
    Fc = [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)]
    fo = np.clip((fbm(P[:, 0] / 9, P[:, 1] / 9, 11, 3) - 0.55) * 4, 0, 1)
    base = np.array([0.26, 0.74, 0.82]); white = np.array([0.95, 0.99, 1.0])
    cc = np.array([base * (1 - f) + white * f for f in fo])
    C_ = np.vstack([cc * 0.85 + white * 0.15, cc * 0.85 + white * 0.15])           # lighter banks
    return make_mesh_obj(f'{ctx.sec}_{name}', V, Fc, C_, None, ctx.coll, water_material())


def waterfall(ctx, x, y, zt, width=5.0, name='fall'):
    """Sheet of white water over the slab edge (south side of the tile)."""
    Vs = []; Fs = []
    k = 6
    for i in range(k + 1):
        z = zt + (-34.0 - zt) * i / k
        out = 0.7 + 0.35 * math.sin(i * 1.3)
        Vs += [[x - width, y + out, z], [x + width, y + out, z]]
    for i in range(k):
        Fs.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    cols = np.array([[0.9 + 0.1 * (i % 2), 0.97, 1.0] if (i // 2) % 2 == 0 else [0.55, 0.85, 0.95] for i in range(len(Vs))])
    make_mesh_obj(f'{ctx.sec}_{name}', Vs, Fs, cols, None, ctx.coll, water_material())


def river_features(ctx, RP, bed, width=4.6):
    """Rapids: rocks in and beside the channel, foam patches around them and on steep runs."""
    rg = np.random.default_rng(21)
    small = QA.river_rocks() or [t_boulder(i) for i in range(6)]
    big = QA.alpine_rocks() or [t_boulder(i) for i in range(6)]
    n = len(RP); t = np.gradient(RP, axis=0); t /= (np.linalg.norm(t, axis=1, keepdims=True) + 1e-9); nv = np.stack([-t[:, 1], t[:, 0]], -1)
    foam = hexc(0xf4fbff)
    for k in range(int(n * 0.9)):
        i = int(rg.integers(2, n - 2)); lat = (rg.random() - 0.5) * 2 * width * 1.25
        x, y = RP[i] + nv[i] * lat
        z = bed[i] + 0.1
        tpl = big[int(rg.random() * len(big))] if rg.random() < 0.28 else small[int(rg.random() * len(small))]
        sc = 0.7 + rg.random() * 1.3
        ctx.sc['rocks'].put(tpl, x, y, z, rg.random() * 6.28, sc)
        if abs(lat) < width * 1.1:
            V, F = blob((x, y, bed[i] + 0.95), 1.4 + rg.random() * 1.4, 0.2, 1, 0.3, int(rg.random() * 999))
            ctx.sc['rocks'].m.add(V, F, foam, True)
    drop = -np.gradient(bed)
    for i in range(2, n - 2):
        if drop[i] > 0.55 and rg.random() < 0.7:
            for _ in range(2):
                lat = (rg.random() - 0.5) * width * 1.4
                x, y = RP[i] + nv[i] * lat
                V, F = blob((x, y, bed[i] + 0.98), 1.8 + rg.random() * 1.6, 0.16, 1, 0.3, int(rg.random() * 999))
                ctx.sc['rocks'].m.add(V, F, foam, True)


def switchback(ctx, A, B, amp=16.0, step=15.0, name='switch', width=3.0, color=0xcdb58a):
    A = np.array(A, float); B = np.array(B, float); L = np.linalg.norm(B - A); d = (B - A) / L; nv = np.array([-d[1], d[0]])
    pts = [A]
    k = 1
    s = step
    while s < L - step * 0.5:
        pts.append(A + d * s + nv * amp * (1 if k % 2 else -1)); s += step; k += 1
    pts.append(B)
    P_ = np.array(pts)
    for _ in range(3):
        out = [P_[0]]
        for a_, b_ in zip(P_[:-1], P_[1:]):
            out += [a_ * .75 + b_ * .25, a_ * .25 + b_ * .75]
        out.append(P_[-1]); P_ = np.array(out)
    ribbon(ctx.W, ctx.F, P_, width, 0.32, hexc(color), f'{ctx.sec}_{name}', ctx.coll)
    for p in P_[::4]:
        ctx.circles.append((p[0], p[1], 6))
    return P_


def stone_wall(ctx, pts, closed=False, gap=None, seed=1):
    """Dry-stone wall: rows of stacked blocks following the terrain."""
    rg = np.random.default_rng(seed)
    blocks = [t_wallblock(i) for i in range(5)]
    pts = [np.array(p, float) for p in pts]
    if closed:
        pts = pts + [pts[0]]
    for a, b in zip(pts[:-1], pts[1:]):
        L = np.linalg.norm(b - a); d = (b - a) / L; ang = math.atan2(d[1], d[0])
        k = int(L / 2.5)
        for i in range(k):
            p = a + d * (i * 2.5 + 1.2)
            if gap is not None and np.hypot(*(p - np.array(gap[0]))) < gap[1]:
                continue
            if not ctx.land_at(p[0], p[1]) or ctx.slope_at(p[0], p[1]) > 1.2:
                continue
            ctx.sc['misc'].put(blocks[int(rg.random() * 5)], p[0] + (rg.random() - 0.5) * 0.3, p[1] + (rg.random() - 0.5) * 0.3, ctx.z_at(p[0], p[1]) - 0.1, ang + (rg.random() - 0.5) * 0.12, 0.95 + rg.random() * 0.2)


def frailejones(ctx, zlo=14, zhi=50, step=8.0):
    W = ctx.W
    tpl = [t_frailejon(i) for i in range(8)]
    pts = jgrid(W.rect, step, 0.5); pts = pts[ctx.in_rect(pts, 8)]
    x, y = pts[:, 0], pts[:, 1]
    z = ctx.z_at(x, y)
    clump = sstep(0.5, 0.68, fbm(x / 26, y / 26, ctx.seed + 61, 2))
    ok = ctx.land_at(x, y) & (z > zlo) & (z < zhi) & (ctx.slope_at(x, y) < 1.1) & (rng.random(len(x)) < 0.8 * clump) & ~ctx.blocked(pts, 3)
    n = 0
    for (px, py), zz in zip(pts[ok], z[ok]):
        ctx.sc['shrubs'].put(tpl[int(rng.random() * 8)], px, py, zz - 0.2, rng.random() * 6.28, 0.9 + rng.random() * 0.6); n += 1
    return n


def cable_car(ctx, stops, name='cable'):
    """Aerial tramway through stops [(x, y), ...]: stations, pylons, sagging cables and red cabins."""
    steel = hexc(0x8a8f99); cab = t_cabin()
    tops = []
    for (x, y) in stops:
        z = float(ctx.z_at(x, y))
        ctx.sc['misc'].put(t_station(), x, y, z, 0.3, 1.0)
        tops.append(np.array([x, y, z + 6.5]))
        ctx.circles.append((x, y, 12))
    m = Mesh()
    for a, b in zip(tops[:-1], tops[1:]):
        L = np.linalg.norm((b - a)[:2]); d = (b - a) / np.linalg.norm(b - a); side = np.array([-d[1], d[0], 0])
        for sg in (-1, 1):
            off = side * 0.9 * sg
            pts = []
            for i in range(21):
                t = i / 20
                p = a + (b - a) * t + off
                p[2] -= 4.0 * math.sin(math.pi * t) * (L / 150.0)       # sag
                pts.append(p)
            for p0, p1 in zip(pts[:-1], pts[1:]):
                V, F = tube(p0, p1, 0.18, 3); m.add(V, F, steel)
        npy = max(0, int(L / 75))
        for k in range(1, npy + 1):
            t = k / (npy + 1); p = a + (b - a) * t; g = float(ctx.z_at(p[0], p[1]))
            V, F = tube((p[0], p[1], g), (p[0], p[1], p[2] - 0.5), 0.5, 4); m.add(V, F, steel)
            V, F = tube((p[0] + side[0] * 2.2, p[1] + side[1] * 2.2, p[2] - 0.5), (p[0] - side[0] * 2.2, p[1] - side[1] * 2.2, p[2] - 0.5), 0.25, 3); m.add(V, F, steel)
            ctx.circles.append((p[0], p[1], 6))
        for t in (0.3, 0.68):
            p = a + (b - a) * t; p[2] -= 4.0 * math.sin(math.pi * t) * (L / 150.0)
            V, F, C, S = cab
            m.add(V + np.array([p[0], p[1], p[2] - 4.8]), F, C, False)
            V, F = tube((p[0], p[1], p[2]), (p[0], p[1], p[2] - 2.4), 0.12, 3); m.add(V, F, steel)
    V, F, C, S = m.arrays()
    make_mesh_obj(f'{ctx.sec}_{name}', V, F, C, [False] * len(F), ctx.coll, ctx.mat)


def prepare(sec, W, F, C, cfg):
    """Decide node positions + bridge, level terraces and road beds BEFORE the terrain mesh is built."""
    ctx = Ctx(sec, W, F, cfg, None)
    x0, y0, x1, y1 = W.rect
    nodes_all = all_nodes()
    nodes = {k: v for k, v in nodes_all.items() if x0 + 14 < v['geo'][0] < x1 - 14 and y0 + 14 < v['geo'][1] < y1 - 14}
    ov = cfg.get('override')
    if ov:
        nodes = {k: dict(nodes_all[k]) for k in ov if k in nodes_all}
        for k in nodes:
            nodes[k]['geo'] = ov[k]
    plan = dict(nodes=nodes, bridge=None, river=None)
    if sec == 'zulia':
        bp0, bp1 = bridge_geometry(W)
        d0 = (np.array(bp1) - np.array(bp0)); d0 /= np.linalg.norm(d0)
        bq0 = tuple(np.array(bp0) - d0 * 40.0); bq1 = tuple(np.array(bp1) + d0 * 40.0)
        plan['bridge'] = (bp0, bp1, bq0, bq1)
        if 'zul_puente' not in nodes:
            nodes['zul_puente'] = dict(nodes_all['zul_puente'])
        nodes['zul_puente']['geo'] = ((bp0[0] + bp1[0]) / 2, (bp0[1] + bp1[1]) / 2)
        corridor(F, C, W, bq0, bp0, 9.0, 12.0); corridor(F, C, W, bp1, bq1, 9.0, 12.0)
    pos = dict(ov) if ov else place_nodes(ctx, nodes)
    if sec == 'zulia':
        pos['zul_puente'] = nodes['zul_puente']['geo']
    for k, p_ in pos.items():
        kind = BUILD.get(k, ('town', 10))[0]
        R = TERRACE_R.get(kind, 0)
        if R:
            terrace(F, C, W, p_[0], p_[1], R * (0.75 if BUILD.get(k, ('', 0))[1] < 30 else 1.0))
    if cfg.get('river'):
        plan['river'] = carve_river(F, C, W, cfg['river'])
    plan['pos'] = pos
    return plan


def smooth_road(pts, off=0.0, seed=0):
    pts = [np.array(p, float) for p in pts]
    if off and len(pts) >= 2:
        rg = np.random.default_rng(seed)
        mid = (pts[0] + pts[-1]) / 2; d = pts[-1] - pts[0]; nv = np.array([-d[1], d[0]]); nv /= (np.linalg.norm(nv) + 1e-9)
        pts = [pts[0], pts[0] + (mid - pts[0]) * 0.5 + nv * off * (rg.random() - 0.3), mid + nv * off * (rg.random() - 0.5) * 0.5, pts[-1]]
    return np.array(chaikin([tuple(p) for p in pts], 3)) if len(pts) > 2 else np.array(pts)


def port(ctx, cx, cy, big=True, seed=1):
    """Quay + piers + warehouses + containers + crane at the nearest shore of (cx, cy)."""
    rg = np.random.default_rng(seed)
    best = None
    for a in np.linspace(0, 2 * np.pi, 24, endpoint=False):
        for r in range(14, 110, 3):
            x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
            if not ctx.land_at(x, y) and ctx.z_at(x, y) < -0.4:
                if best is None or r < best[0]:
                    best = (r, a, x, y)
                break
    if best is None:
        return None
    r, a, sx, sy = best
    out = np.array([math.cos(a), math.sin(a)]); side = np.array([-out[1], out[0]])
    S = np.array([sx, sy]) - out * 4.0
    m = Mesh(); conc = hexc(0xbdb7aa); wood = hexc(0x8a6a4a)
    ang = math.atan2(out[1], out[0])
    L = 40 if big else 26
    V, F = box(10, L, 1.2, 0.2); V = rotz(V, ang - math.pi / 2) + np.array([*(S + out * 1.0), 0.0]); m.add(V, F, conc)            # quay
    npier = 2 if big else 1
    for i in range(npier):
        off = (i - (npier - 1) / 2) * (L * 0.55)
        base = S + side * off + out * 10.0
        V, F = box(5.0, 28 if big else 18, 0.7, 0.4); V = rotz(V, ang - math.pi / 2) + np.array([*(base + out * 6), 0.0]); m.add(V, F, wood)
        for k in range(5):
            for sg in (-1, 1):
                q = base + out * (k * 5.0) + side * 2.0 * sg
                V2, F2 = tube((*q, ctx.z_at(*q) - 0.5), (*q, 0.4), 0.3, 4); m.add(V2, F2, hexc(0x4a3a2a))
    if big:
        for i in range(3):                                          # warehouses behind the quay
            c = S - out * (12 + 0) + side * ((i - 1) * 16)
            V, F = box(12, 7, 4.0, 0); V = rotz(V, ang - math.pi / 2) + np.array([*c, 0.0]); m.add(V, F, hexc(0xc9c4b8))
            V, F = gable(12, 7, 1.6, 4.0, 0.3, 'x'); V = rotz(V, ang - math.pi / 2) + np.array([*c, 0.0]); m.add(V, F, hexc(0x8a93a3))
        cols = [0xd9503a, 0x2f6fb0, 0xe8b820, 0x3a7a4a, 0xf08c3a, 0xd8dade]
        for i in range(10):
            c = S + out * 1.5 + side * ((i % 5 - 2) * 3.4) + out * (3 if i >= 5 else 0)
            V, F = box(3.0, 2.4, 2.4, 1.3); V = rotz(V, ang - math.pi / 2) + np.array([*c, 0.0]); m.add(V, F, hexc(cols[(i * 7) % 6]))
        cp = S + out * 12 + side * (L * 0.275)
        for sg in (-1, 1):
            V, F = tube((*(cp + out * 3 * sg), 1.0), (*(cp + out * 3 * sg), 15), 0.4, 4); m.add(V, F, hexc(0xe8b820))
        V, F = tube((*(cp - out * 3), 15), (*(cp + out * 14), 15), 0.5, 4); m.add(V, F, hexc(0xe8b820))
    V, F, C_, S_ = m.arrays()
    for nm in ('quay',):
        ctx.sc['town'].m.add(V, F, C_, False)
    # moored boats alongside the pier
    for i in range(2 if big else 1):
        bp = S + out * 20 + side * ((-1) ** i * (L * 0.275 + 5))
        ctx.sc['boats'].put(t_boat(i), bp[0], bp[1], 0.1, ang + 1.57, 1.1)
    if big:
        tp = S + out * 36 + side * 10
        ctx.sc['boats'].put(t_boat(0, 'tanker'), tp[0], tp[1], 0.2, ang + 1.57, 1.0)
    ctx.circles.append((S[0], S[1], 26 if big else 16))
    return S


def populate(sec, W, F, C, cfg, plan):
    coll = pz_lib_current()
    ctx = Ctx(sec, W, F, cfg, coll)
    ctx.misc_pts = []
    rng_ = np.random.default_rng(cfg['seed'])
    nodes = plan['nodes']; pos = plan['pos']
    if sec == 'zulia':
        bp0, bp1, bq0, bq1 = plan['bridge']
        bridge(ctx, bp0, bp1, 10.5, 5)
        bx0, bx1 = bp0[0] + 20, bp1[0] - 20; by = (bp0[1] + bp1[1]) / 2
    # settlements
    for k, nd in nodes.items():
        x, y = pos[k]; kind, size = BUILD.get(k, ('town', 10))
        nd['x'], nd['y'] = x, y
        if kind == 'colonial':
            town(ctx=ctx, cx=x, cy=y, n=size, spread=44, colorful=False, name=k, style='church')
            port(ctx, x, y, big=False, seed=3)
        elif kind == 'city':
            city(ctx, x, y, size, 50 if size > 80 else 40)
            if sec == 'zulia':
                port(ctx, x, y, big=True, seed=5)
        elif kind == 'town':
            town(ctx=ctx, cx=x, cy=y, n=size, spread=30, colorful=(len(k) % 2 == 0), church=True, name=k, pal=len(k))
        elif kind == 'oil':
            oil_field(ctx, x, y - 12, size, 28)
        elif kind == 'stilts':
            stilts(ctx, x, y, size)
        elif kind == 'cay':
            z = float(ctx.z_at(x, y)); ctx.sc['misc'].put(t_cay(5, -z + 0.4), x, y, 0.0, 0, 1.0)
            for i in range(4):
                a = i * 1.5 + 0.4; ctx.sc['palms'].put(P.t_palm(40 + i), x + math.cos(a) * 3.5, y + math.sin(a) * 3.5, 1.0, a, 0.8)
        elif kind == 'storm':
            storm(ctx, 470.0, 690.0)
            town(ctx=ctx, cx=x, cy=y, n=size, spread=26, church=True, name=k, pal=7)
        nd['deck'] = None
    # roads: network between nodes (smooth, gently curved), then the bridge → town chain
    L = layout(); W_ = W
    edges = L['edges'] + L['special']; roads = []; seen = set()
    special = {frozenset(p) for p in L['special']}
    for a, b in edges:
        if frozenset((a, b)) in seen or (sec == 'andes' and (frozenset((a, b)) in special or 'and_picoespejo' in (a, b))):
            continue
        seen.add(frozenset((a, b)))
        if a in pos and b in pos:
            pa = np.array(pos[a]); pb = np.array(pos[b])
            ts = np.linspace(0, 1, 24); pts = pa[None] + (pb - pa)[None] * ts[:, None]
            if ctx.land_at(pts[:, 0], pts[:, 1]).mean() < 0.7 and 'zul_puente' not in (a, b):
                continue
            if 'zul_puente' in (a, b):
                continue
            roads.append((a, b))
            pl = smooth_road([pa, pb], 0.12 * np.linalg.norm(pb - pa), len(a) * 31 + len(b))
            ribbon(W_, ctx.F, pl, 3.0, 0.3, PATHC, f'{sec}_road_{a}__{b}', ctx.coll)
            for p in pl[::4]:
                ctx.circles.append((p[0], p[1], 6.5))
    if sec == 'andes':
        RP, bed = plan['river']
        river_mesh(ctx, RP, bed)
        waterfall(ctx, float(RP[-1][0]), float(W.rect[3]), float(bed[-1]) + 0.9)
        for q_ in RP[::3]:
            ctx.circles.append((q_[0], q_[1], 11))
        em = np.array(pos['and_ejido']); mm = np.array(pos['and_merida']); mid = (em + mm) / 2
        i = int(np.argmin(np.hypot(RP[:, 0] - mid[0], RP[:, 1] - mid[1])))
        tg = RP[min(i + 2, len(RP) - 1)] - RP[max(i - 2, 0)]; tg = tg / (np.linalg.norm(tg) + 1e-9)
        br = QA.stone_bridge(20.0)
        if br is not None:
            ctx.sc['misc'].put(br, RP[i][0], RP[i][1], float(bed[i]) + 0.4, math.atan2(-tg[0], tg[1]) + math.pi / 2 * 0 , 1.0)
            ctx.circles.append((RP[i][0], RP[i][1], 14))
        river_features(ctx, RP, bed)
        switchback(ctx, pos['and_merida'], pos['and_losnevados'], 20.0, 17.0, 'road_up')
        cable_car(ctx, [pos['and_merida'], pos['and_losnevados'], pos['and_picoespejo']])
        # pasture east of the village: dry-stone enclosure with a gate, cows inside
        pc = mm + np.array([14.0, 62.0]); hw, hd = 40.0, 26.0
        corners = [pc + np.array([-hw, -hd]), pc + np.array([hw, -hd]), pc + np.array([hw, hd]), pc + np.array([-hw, hd])]
        stone_wall(ctx, corners, closed=True, gap=(pc + np.array([-hw, 0.0]), 5.5), seed=4)
        stone_wall(ctx, [mm + np.array([-30.0, 38.0]), mm + np.array([-60.0, 30.0]), mm + np.array([-95.0, 36.0])], seed=6)
        ctx.circles.append((pc[0], pc[1], 40))
        rgc = np.random.default_rng(9); placed = 0
        cow = [t_cow(i) for i in range(4)]
        for _ in range(300):
            if placed >= 9:
                break
            x, y = pc[0] + (rgc.random() - 0.5) * (hw * 1.7), pc[1] + (rgc.random() - 0.5) * (hd * 1.7)
            if ctx.land_at(x, y) and ctx.slope_at(x, y) < 0.35 and ctx.z_at(x, y) > 2:
                if all((x - q[0]) ** 2 + (y - q[1]) ** 2 > 7 ** 2 for q in ctx.misc_pts):
                    ctx.misc_pts.append((x, y)); ctx.sc['misc'].put(cow[placed % 4], x, y, ctx.z_at(x, y) - 0.05, rgc.random() * 6.28, 1.5); placed += 1
        frailejones(ctx)
    if sec == 'zulia':
        asph = hexc(0x4c4f58)
        for end, tgt, sd in ((bq0, 'zul_maracaibo', 2), (bq1, 'zul_cabimas', 3)):
            if tgt in pos:
                pl = smooth_road([end, pos[tgt]], 16.0, sd)
                ribbon(W_, ctx.F, pl, 6.0, 0.32, asph, f'{sec}_bridgeroad_{tgt}', ctx.coll)
                for p in pl[::3]:
                    ctx.circles.append((p[0], p[1], 9))
                roads.append(('bridge', tgt))
    for k, nd in nodes.items():
        if k == 'zul_puente':
            nd['deck'] = 10.9
        pad(ctx, nd)
        landmark(ctx, k, nd['name'], nd['x'], nd['y'], BUILD.get(k, ('town',))[0], nd['type'], nd['region'])
    if sec == 'zulia':
        for i in range(7):
            for _ in range(60):
                x = bx0 + 8 + rng_.random() * (bx1 - bx0 - 16); y = by + 25 + rng_.random() * 190
                if W.sample(W.lake.astype(float), x, y) > 0.9 and ctx.d_at(x, y) > 12 and not ctx.blocked(np.array([[x, y]]), 6)[0]:
                    ctx.sc['boats'].put(t_boat(i), x, y, 0.1, rng_.random() * 6.28, 1.15); ctx.circles.append((x, y, 7)); break
    if sec != 'andes':
        islets(ctx, 7 if sec == 'falcon' else 3, 18, 75, 1)
    forests(ctx, 6.6)
    coast_palms(ctx, 8.0)
    desert_life(ctx)
    boulders(ctx)
    finish(ctx)
    json.dump(dict(section=sec, rect=cfg['rect'], landmarks=ctx.landmarks, roads=roads), open(os.path.join(OUT, sec + '_landmarks.json'), 'w'), indent=1, ensure_ascii=False)
    return ctx


def pz_lib_current():
    import pz_lib
    return pz_lib.CURRENT


def landmark(ctx, id_, name, x, y, kind, ntype='azul', region=''):
    ctx.landmarks.append(dict(id=id_, name=name, type=ntype, region=region, kind=kind, x=round(x, 1), y=round(y, 1), z=round(float(ctx.z_at(x, y)), 2)))
