"""terrain_v2: heightfield + colours for the v2 Venezuela board map, then a baked low-poly terrain .glb.
Run inside Blender (has numpy):  blender -b --python tools/map/terrain_v2.py
Inputs : assets/map/v2/layout.json  (from layout_v2.py)  [+ assets/map/v2/placements.json for shadow-casting props, optional]
Outputs: assets/map/v2/heights.f32, assets/map/v2/terrain_meta.json, assets/models/venezuela_v2_terrain.glb"""
import bpy, bmesh, math, os, sys, json, time
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools', 'blender'))
import geo_v2 as G
import lib

OUT = os.path.join(ROOT, 'assets', 'map', 'v2')
L = json.load(open(os.path.join(OUT, 'layout.json')))
W, H = L['canvas']
MINX, MINY = L['offset']
SEA, TOPE = 1.5, 10.0
CELL = 7.0                       # exported terrain cell
FC = CELL / 2                    # working grid cell
NX = int(W / CELL) + 1
NY = int(H / CELL) + 1
FX, FY = (NX - 1) * 2 + 1, (NY - 1) * 2 + 1
xs = np.arange(FX) * FC
ys = np.arange(FY) * FC
X, Y = np.meshgrid(xs, ys)
t0 = time.time()

# hero patches (finer, sculpted): Caracas and the Andes. bbox aligned to the export cell so borders match the main mesh.
def mk_hero(name, prefix, mx, my_n, my_s):
    pts = [v for k, v in L['nodes'].items() if k.startswith(prefix)]
    x0 = math.floor((min(p[0] for p in pts) - mx) / CELL) * CELL
    x1 = math.ceil((max(p[0] for p in pts) + mx) / CELL) * CELL
    y0 = math.floor((min(p[1] for p in pts) - my_n) / CELL) * CELL
    y1 = math.ceil((max(p[1] for p in pts) + my_s) / CELL) * CELL
    return dict(name=name, X0=x0, X1=x1, Y0=y0, Y1=y1, I0=int(x0 / FC), I1=int(x1 / FC), J0=int(y0 / FC), J1=int(y1 / FC))


CC = mk_hero('cc', 'ccs_', 170, 90, 110)          # Caracas window (city grid, Ávila ridge, barrios)
_north = [v for k, v in L['nodes'].items() if k.startswith(('ccs_', 'roq_', 'mar_', 'moc_'))]
_nb = dict(name='ccs', X0=math.floor((min(p[0] for p in _north) - 130) / CELL) * CELL, X1=math.ceil((max(p[0] for p in _north) + 130) / CELL) * CELL,
           Y0=math.floor((min(p[1] for p in _north) - 110) / CELL) * CELL, Y1=math.ceil((max(p[1] for p in _north) + 120) / CELL) * CELL)
_nb.update(I0=int(_nb['X0'] / FC), I1=int(_nb['X1'] / FC), J0=int(_nb['Y0'] / FC), J1=int(_nb['Y1'] / FC))
HEROES = [_nb, mk_hero('and', 'and_', 150, 110, 120)]
_dn = [v for k, v in L['nodes'].items() if k.startswith('del_')]
_GX = (NX - 1) * CELL
_dy0 = math.floor((min(p[1] for p in _dn) - 110) / CELL) * CELL
_dy1 = min(math.ceil((max(p[1] for p in _dn) + 140) / CELL) * CELL, (NY - 1) * CELL)
_dxm = math.floor((min(p[0] for p in _dn) - 130) / CELL) * CELL
for (nm_, x0_, x1_, y0_, y1_) in (('delA', _nb['X1'], _GX, _dy0, _dy1), ('delB', _dxm, _nb['X1'], max(_nb['Y1'], _dy0), _dy1)):
    if x1_ > x0_ and y1_ > y0_:
        HEROES.append(dict(name=nm_, X0=x0_, X1=x1_, Y0=y0_, Y1=y1_, I0=int(x0_ / FC), I1=int(x1_ / FC), J0=int(y0_ / FC), J1=int(y1_ / FC)))
_ox0 = math.floor(1650 / CELL) * CELL
_ox1 = math.floor(2198 / CELL) * CELL
_oy0 = max(_nb['Y1'], math.floor(790 / CELL) * CELL)
_oy1 = math.ceil(1120 / CELL) * CELL
HEROES.append(dict(name='ord', X0=_ox0, X1=_ox1, Y0=_oy0, Y1=_oy1, I0=int(_ox0 / FC), I1=int(_ox1 / FC), J0=int(_oy0 / FC), J1=int(_oy1 / FC)))
_ly1 = math.ceil(1141 / CELL) * CELL
HEROES.append(dict(name='lla', X0=HEROES[1]['X1'], X1=_ox0, Y0=_nb['Y1'], Y1=_ly1, I0=int(HEROES[1]['X1'] / FC), I1=int(_ox0 / FC), J0=int(_nb['Y1'] / FC), J1=int(_ly1 / FC)))
_fx0, _fx1, _fy0, _fy1 = math.floor(749 / CELL) * CELL, _nb['X0'], math.floor(98 / CELL) * CELL, HEROES[1]['Y0']
HEROES.append(dict(name='fal', X0=_fx0, X1=_fx1, Y0=_fy0, Y1=_fy1, I0=int(_fx0 / FC), I1=int(_fx1 / FC), J0=int(_fy0 / FC), J1=int(_fy1 / FC)))
_zy0 = math.floor(189 / CELL) * CELL
HEROES.append(dict(name='zul', X0=HEROES[1]['X0'], X1=_fx0, Y0=_zy0, Y1=HEROES[1]['Y0'], I0=int(HEROES[1]['X0'] / FC), I1=int(_fx0 / FC), J0=int(_zy0 / FC), J1=int(HEROES[1]['Y0'] / FC)))
import gsb_data as GS
import sur_data as SU
for _nm, (_x0, _y0, _x1, _y1) in SU.RECTS.items():
    HEROES.append(dict(name=_nm, X0=_x0, X1=_x1, Y0=_y0, Y1=_y1, I0=int(_x0 / FC), I1=int(_x1 / FC), J0=int(_y0 / FC), J1=int(_y1 / FC)))
FAMN = tuple(SU.FAMILY)
NODES_DEL = _dn
NODES_ZUL = [v for k, v in L['nodes'].items() if k.startswith('zul_')]
NODES_MAR = [v for k, v in L['nodes'].items() if k.startswith('mar_')]
NODES_ROQ = [v for k, v in L['nodes'].items() if k.startswith('roq_')]
NODES_MOC = [v for k, v in L['nodes'].items() if k.startswith('moc_')]


def dmin_pts(pts, Xa, Ya):
    d_ = np.full(Xa.shape, 1e9)
    for (px, py) in pts:
        d_ = np.minimum(d_, np.hypot(Xa - px, Ya - py))
    return d_

HI_ = lambda H_: (slice(H_['J0'], H_['J1'] + 1), slice(H_['I0'], H_['I1'] + 1))


def P2(lon, lat):
    x, y = G.proj(lon, lat)
    return x - MINX, y - MINY


def sst(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def lerp(a, b, k):
    return a + (b - a) * k


def inpoly(pts, X, Y):
    m = np.zeros(X.shape, bool)
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if yi != yj:
            cond = ((yi > Y) != (yj > Y)) & (X < (xj - xi) * (Y - yi) / (yj - yi) + xi)
            m ^= cond
        j = i
    return m


def box_blur(a, r, passes=1):
    for _ in range(passes):
        k = 2 * r + 1
        for ax in (0, 1):
            pad = [(0, 0), (0, 0)]
            pad[ax] = (r + 1, r)
            c = np.cumsum(np.pad(a, pad, mode='edge'), axis=ax)
            if ax == 0:
                a = (c[k:, :] - c[:-k, :]) / k
            else:
                a = (c[:, k:] - c[:, :-k]) / k
    return a


def hash2(ix, iy, s=0):
    h = (ix * 374761393 + iy * 668265263 + s * 982451653) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296.0


def vnoise(x, y, s=0):
    xi, yi = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    xf, yf = x - xi, y - yi
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    a, b = hash2(xi, yi, s), hash2(xi + 1, yi, s)
    c, d = hash2(xi, yi + 1, s), hash2(xi + 1, yi + 1, s)
    return lerp(lerp(a, b, u), lerp(c, d, u), v)


def fbm(x, y, s=0):
    return vnoise(x, y, s) * .55 + vnoise(x * 2.1, y * 2.1, s + 1) * .3 + vnoise(x * 4.3, y * 4.3, s + 2) * .15


def tepui_add(Xh, Yh, nd_h, pe_h, _t, _ti):
    """height added by one flat-topped tepui (steep fluted wall + gentle talus skirt), kept away from tiles and paths"""
    _cx, _cy = _t['c']
    _u = (Xh - _cx) * math.cos(_t['th']) + (Yh - _cy) * math.sin(_t['th'])
    _v = -(Xh - _cx) * math.sin(_t['th']) + (Yh - _cy) * math.cos(_t['th'])
    _an = np.arctan2(_v / _t['b'], _u / _t['a'])
    _d = np.hypot(_u / _t['a'], _v / _t['b']) * (1 + .15 * (fbm(Xh * .03 + _ti * 7, Yh * .03, 411) - .5) * 2 + .05 * (fbm(Xh * .12, Yh * .12, 413) - .5) * 2 + .035 * np.sin(_an * 15 + _ti))
    _wall = 1 - sst(.95, 1.03, _d)
    _tal = 1 - sst(.92, 1.6, _d)
    _top = _t['T'] * (1 + .03 * (fbm(Xh * .05, Yh * .05, 415) - .5) * 2) * (1 - _t.get('dome', 0) * np.clip(_d, 0, 1) ** 2)
    if _t.get('bell'):
        _top = _t['T'] * (1 + .04 * (fbm(Xh * .08, Yh * .08, 417) - .5) * 2) * (1 - np.clip(_d, 0, 1) ** 1.7)
    return np.maximum(_wall * _top, _tal * _t['T'] * .17) * sst(12, 24, nd_h) * sst(5, 11, pe_h)



def dist_line(pts, X, Y, step=1):
    best = np.full(X.shape, 1e9)
    for i in range(0, len(pts) - 1, step):
        ax, ay = pts[i]
        bx, by = pts[min(i + step, len(pts) - 1)]
        dx, dy = bx - ax, by - ay
        l2 = dx * dx + dy * dy + 1e-9
        t = np.clip(((X - ax) * dx + (Y - ay) * dy) / l2, 0, 1)
        d = np.hypot(X - ax - dx * t, Y - ay - dy * t)
        best = np.minimum(best, d)
    return best


# ───────────────────────── land / water masks ─────────────────────────
land = inpoly(L['land'], X, Y)
for nm, q in L['islands'].items():
    land |= inpoly(q, X, Y)
for (dx, dy, r) in L['discs']:
    land |= (np.hypot(X - dx, Y - dy) <= r)
lake = inpoly(L['lake'], X, Y) | inpoly(L['canal'], X, Y)
# Lake Maracaibo is wider than the geographic polygon (the board tiles ring it): grow it, but never into tiles or the other roads
_win = (X > 330) & (X < 650) & (Y > 380) & (Y < 770)
_dil = box_blur(lake.astype(np.float32), 8, 2) > .2
_gd = np.full(X.shape, 1e9)
for _k, _v in L['nodes'].items():
    if 300 < _v[0] < 700 and 340 < _v[1] < 800:
        _gd = np.minimum(_gd, np.hypot(X - _v[0], Y - _v[1]))
for (_a, _b) in L['edges']:
    if {_a, _b} == {'zul_machiques', 'zul_sanfrancisco'} or [_a, _b] in L['special'] or [_b, _a] in L['special']:
        continue
    _pa, _pb = L['nodes'][_a], L['nodes'][_b]
    if max(_pa[0], _pb[0]) < 300 or min(_pa[0], _pb[0]) > 700 or max(_pa[1], _pb[1]) < 340 or min(_pa[1], _pb[1]) > 800:
        continue
    _gd = np.minimum(_gd, dist_line([tuple(_pa), tuple(_pb)], X, Y, step=2) + 24)
lake = lake | (_dil & _win & (_gd > 40))
land &= ~lake
Mf = land.astype(np.float32)
M1, M3, M2 = box_blur(Mf, 4, 2), box_blur(Mf, 6, 2), box_blur(Mf, 12, 2)
M4 = box_blur(Mf, 26, 2)                    # wide blur ~ 'how far inland': mountains are held back from the coast so beaches and coastal plains exist
DCP = sst(.35, .92, M4)
LK = box_blur(lake.astype(np.float32), 2, 1)
print('masks', round(time.time() - t0, 1))

NODES = L['nodes']
reg_of = {}
js = json.load(open(os.path.join(OUT, 'regions.json')))
for k, v in js['node_region'].items():
    reg_of[k] = v

# ───────────────────────── relief ─────────────────────────
rel = np.zeros_like(X)


def ridge(pts_ll, h, sigma, noise=.35, sharp=1.35):
    global rel
    pts = [P2(*p) for p in pts_ll]
    d = dist_line(G.smooth_line(pts, 2) if len(pts) > 2 else pts, X, Y)
    k = np.exp(-(d / sigma) ** 2 * 1.2)
    rel += h * k ** sharp * (1 - noise + noise * 2 * fbm(X * .03, Y * .03, 5))


def bump(lon, lat, h, sigma, s=0):
    global rel
    x, y = P2(lon, lat)
    rel += h * np.exp(-((X - x) ** 2 + (Y - y) ** 2) / (2 * sigma ** 2)) * (.85 + .3 * fbm(X * .04, Y * .04, s))


def mesa(lon, lat, r, h):
    global rel
    x, y = P2(lon, lat)
    d = np.hypot(X - x, Y - y)
    rel += h * (1 - sst(r - 7, r + 7, d)) * (1 + .05 * fbm(X * .08, Y * .08, 3))


rel += fbm(X * .018, Y * .018, 1) * 2.6
# Andes (Mérida), Perijá, Cordillera de la Costa + Ávila, oriental
ridge([(-72.2, 7.7), (-71.7, 8.2), (-71.15, 8.6), (-70.7, 9.0), (-70.2, 9.5), (-69.9, 10.0)], 36, 40)
bump(-71.04, 8.54, 32, 15, 7)
bump(-70.8, 8.9, 18, 18, 8)
ridge([(-72.9, 8.8), (-73.05, 9.8), (-72.9, 10.6)], 20, 34)
ridge([(-68.4, 10.3), (-67.6, 10.35), (-67.0, 10.4), (-66.4, 10.4)], 20, 26)
ridge([(-64.6, 10.1), (-63.7, 10.25), (-63.1, 10.3)], 22, 28)
ridge([(-63.2, 10.6), (-62.2, 10.7)], 14, 20)
ridge([(-69.9, 10.7), (-69.5, 10.4), (-69.1, 10.2)], 12, 38)
# Ávila: ridge between the coastal row and the city valley (from the laid-out tiles)
gx, gy = NODES['ccs_galipan']
ax_, ay_ = NODES['ccs_avila']
av = [tuple(p) for p in L['avila_ridge']]
d = dist_line(G.smooth_line(av, 2), X, Y)
rel += 34 * np.exp(-(d / 30) ** 2 * 1.2) ** 1.3 * (.8 + .3 * fbm(X * .05, Y * .05, 11))
# Margarita, Paraguaná, Falcón
bump(-64.35, 11.0, 15, 26, 2)
bump(-63.85, 11.1, 12, 26, 3)
bump(-70.0, 11.85, 13, 30, 4)
# Guayana shield uplift + tepuis
lat_y = P2(-62.0, 8.0)[1]
rel += 5 * (1 - sst(P2(-62, 8.2)[1] - 30, P2(-62, 8.2)[1] + 160, Y)) * 0 + 5.5 * sst(P2(-62, 8.4)[1] - 20, P2(-62, 8.4)[1] + 120, Y) * (X > P2(-68.2, 6)[0])
for (lo, la, r, h) in ((-60.9, 5.3, 22, 46), (-65.5, 3.4, 30, 42),
                       (-62.0, 5.2, 30, 40), (-66.0, 0.9, 30, 50), (-61.7, 5.9, 18, 38), (-63.5, 4.6, 20, 40), (-66.3, 4.2, 14, 36)):
    mesa(lo, la, r, h)
# llanos stay flat; delta swamp and lake wetlands lower
wd = np.zeros_like(X)
for (lo, la, r) in ((-61.6, 9.1, 150),):
    x, y = P2(lo, la)
    wd = np.maximum(wd, 1 - sst(r * .5, r, np.hypot(X - x, Y - y)))
for nm in [k for k, v in reg_of.items() if v == 'del']:
    x, y = NODES[nm]
    wd = np.maximum(wd, 1 - sst(30, 80, np.hypot(X - x, Y - y)))
wl = np.zeros_like(X)
x, y = P2(-71.7, 9.3)
wl = np.maximum(wl, 1 - sst(40, 120, np.hypot(X - x, Y - y)))
# dunes (Coro)
dunes = np.zeros_like(X)
for (lo, la, sx, sy, rot) in ((-69.75, 11.42, 70, 28, .5), (-69.9, 11.38, 60, 24, .15), (-69.55, 11.46, 50, 22, .8), (-70.0, 11.5, 45, 20, .3)):
    x, y = P2(lo, la)
    u = ((X - x) * math.cos(rot) + (Y - y) * math.sin(rot)) / sx
    v = (-(X - x) * math.sin(rot) + (Y - y) * math.cos(rot)) / sy
    dunes = np.maximum(dunes, np.exp(-(u * u + v * v) * 1.4))
rel += 9 * dunes * (.85 + .3 * np.sin((X + Y) * .11))

# rivers
RV = {k: np.array(v) for k, v in L['rivers'].items()}
rdist = np.full(X.shape, 1e9)
rwid = {'orinoco': 1.9, 'caroni': 1.0, 'apure': 1.3, 'caura': .9}
rdist_by = {}
for k, v in L['rivers'].items():
    dd = dist_line([tuple(p) for p in v], X, Y, step=2) / rwid.get(k, .8)
    rdist = np.minimum(rdist, dd)

rel = rel * (.22 + .78 * DCP)
tierra = TOPE + rel
tierra = lerp(tierra, SEA + 1.3, wd)
tierra = lerp(tierra, SEA + 2.2 + fbm(X * .05, Y * .05, 9) * .8, wl * .8)
tierra -= 2.6 * (1 - sst(2.6, 7.5, rdist)) * (1 - wd * .6)
chan = np.full(X.shape, 1e9)
for k, v in L['rivers'].items():
    if k.startswith('delta_'):
        chan = np.minimum(chan, dist_line([tuple(p) for p in v], X, Y, step=2))
tierra -= 2.4 * (1 - sst(2.4, 7.0, chan)) * wd
dm = np.exp(0)
mar = -6 - (1 - M2) * 9
mar = lerp(mar, -3.2, np.clip(LK * 2, 0, 1))
_cn = [v for k, v in L['nodes'].items() if k.startswith(('mar_', 'moc_', 'roq_', 'ccs_'))]
_dcn = np.full(X.shape, 1e9)
for (px_, py_) in _cn:
    _dcn = np.minimum(_dcn, np.hypot(X - px_, Y - py_))
_wcar = np.exp(-(_dcn / 170.0) ** 2)
_shelf = -2.2 - 2.6 * np.clip(fbm(X * .05, Y * .05, 137), 0, 1) - 3.0 * sst(0, 1, 1 - M3)      # shallow reef shelf: -2 .. -8
mar = lerp(mar, np.maximum(mar, _shelf), _wcar * .85)
_roqn = [v for k, v in L['nodes'].items() if k.startswith('roq_')]
_drq = np.full(X.shape, 1e9)
for (px_, py_) in _roqn:
    _drq = np.minimum(_drq, np.hypot(X - px_, Y - py_))
_wrq = np.exp(-(_drq / 150.0) ** 2)
mar = lerp(mar, -1.2 - 2.4 * np.clip(fbm(X * .09, Y * .09, 139), 0, 1), _wrq)                      # Los Roques: broad turquoise flats
tt = sst(.3, .7, M1)
hh_ = tierra - TOPE
tierra = TOPE + np.where(hh_ > 28, 28 + (hh_ - 28) * .45, hh_)      # tame the stacked ridges/tepuis
h = lerp(mar, tierra, tt)
# smooth the shoreline: blur heights inside the coastal band so the waterline is a smooth curve instead of grid steps
shore = np.clip(1 - np.abs(M3 - .5) * 2.4, 0, 1)
h = lerp(h, box_blur(h, 4, 3), shore)

# flatten under tiles and along paths so everything sits right
hb = box_blur(h, 3, 2)
for nid, (nx_, ny_) in NODES.items():
    dd = np.hypot(X - nx_, Y - ny_)
    w = 1 - sst(13, 30, dd)
    if w.max() <= 0:
        continue
    j0, i0 = int(round(ny_ / FC)), int(round(nx_ / FC))
    tgt = max(float(hb[min(max(j0, 0), FY - 1), min(max(i0, 0), FX - 1)]), TOPE - 1.2 if nid not in ('roq_',) else SEA + 1)
    tgt = max(tgt, SEA + 2.0)
    h = lerp(h, tgt, w * .95)
pe = np.full(X.shape, 1e9)
for (a, b) in L['edges']:
    if [a, b] in L['special'] or [b, a] in L['special']:
        continue
    pe = np.minimum(pe, dist_line([tuple(NODES[a]), tuple(NODES[b])], X, Y))
h = lerp(h, hb, (1 - sst(5, 13, pe)) * .8)
h = np.where(M1 < .5, np.minimum(h, lerp(mar, tierra, tt)), h)       # never raise the seabed with the plateau blend
# south-east Guayana family (Gran Sabana + Roraima massif + Orinoco bend + Amazonas): union mask so the patches stitch seamlessly and only fade at the outer border
FAMU = np.zeros(X.shape)
for _nm in FAMN:
    _fx0, _fy0, _fx1, _fy1 = SU.RECTS[_nm]
    FAMU[(X >= _fx0) & (X <= _fx1) & (Y >= _fy0) & (Y <= _fy1)] = 1.0
FAMW = sst(.5, .97, box_blur(FAMU, 18, 3))
JW = np.zeros(X.shape)                  # jungle weight: 0 open savanna .. 1 rainforest (colour + vegetation)
DRB = np.full(X.shape, 1e9)             # distance to the nearest river bank / pond
for _H in HEROES:
    HX0, HX1, HY0, HY1, HI0, HI1, HJ0, HJ1 = _H['X0'], _H['X1'], _H['Y0'], _H['Y1'], _H['I0'], _H['I1'], _H['J0'], _H['J1']
    # ── hero relief: jagged Ávila range, hills on the flanks, flat city valley (details fade out at the bbox border and near tiles/paths) ──
    hs_ = (slice(HJ0, HJ1 + 1), slice(HI0, HI1 + 1))
    Xh, Yh = X[hs_], Y[hs_]
    nd_h = np.full(Xh.shape, 1e9)
    for nid, (nx_, ny_) in NODES.items():
        if HX0 - 40 < nx_ < HX1 + 40 and HY0 - 40 < ny_ < HY1 + 40:
            nd_h = np.minimum(nd_h, np.hypot(Xh - nx_, Yh - ny_))
    pe_h = np.full(Xh.shape, 1e9)
    for (a_, b_) in L['edges']:
        if [a_, b_] in L['special'] or [b_, a_] in L['special']:
            continue
        pa, pb = NODES[a_], NODES[b_]
        if max(pa[0], pb[0]) < HX0 - 30 or min(pa[0], pb[0]) > HX1 + 30 or max(pa[1], pb[1]) < HY0 - 30 or min(pa[1], pb[1]) > HY1 + 30:
            continue
        pe_h = np.minimum(pe_h, dist_line([tuple(pa), tuple(pb)], Xh, Yh))
    wtrack = sst(12, 26, nd_h) * sst(6, 14, pe_h)
    win = sst(0, 36, np.minimum(np.minimum(Xh - HX0, HX1 - Xh), np.minimum(Yh - HY0, HY1 - Yh)))
    if _H['name'] == 'and':
        NA = {k: v for k, v in L['nodes'].items() if k.startswith('and_')}
        mcx = np.mean([NA[k][0] for k in ('and_picoespejo', 'and_losnevados', 'and_aguila', 'and_mucuchies')])
        mcy = np.mean([NA[k][1] for k in ('and_picoespejo', 'and_losnevados', 'and_aguila', 'and_mucuchies')])
        sierra = [(mcx - 190, mcy + 140), (mcx - 70, mcy + 40), (mcx + 40, mcy - 20), (mcx + 150, mcy - 110)]
        dsr = dist_line(G.smooth_line(sierra, 2), Xh, Yh)
        env = np.exp(-(dsr / 120.0) ** 2)
        rn = 1 - np.abs(2 * fbm(Xh * .03, Yh * .03, 53) - 1)
        rn2 = 1 - np.abs(2 * fbm(Xh * .075 + 3, Yh * .075, 59) - 1)
        peaks = env * (rn ** 1.5 * 40 + rn2 ** 2 * 12) - env * 5
        for (px_, py_, ph_, ps_) in ((mcx - 60, mcy + 30, 30, 26), (mcx + 40, mcy - 30, 38, 30), (mcx - 160, mcy + 120, 20, 28), (mcx + 120, mcy - 100, 22, 28)):
            peaks = peaks + ph_ * np.exp(-((Xh - px_) ** 2 + (Yh - py_) ** 2) / (2 * ps_ ** 2)) * (.85 + .3 * fbm(Xh * .05, Yh * .05, 61))
        flank = 0 * Xh
    else:
        dav = dist_line(G.smooth_line(av, 2), Xh, Yh)
        ridge_w = np.exp(-(dav / 62.0) ** 2)
        rn = 1 - np.abs(2 * fbm(Xh * .035, Yh * .035, 17) - 1)
        rn2 = 1 - np.abs(2 * fbm(Xh * .08 + 7, Yh * .08, 19) - 1)
        peaks = ridge_w * (rn ** 1.6 * 30 + rn2 ** 2 * 9) - ridge_w * 6
        flank = np.exp(-((Xh - CC['X0']) / 70) ** 2) * 9 * fbm(Xh * .03, Yh * .03, 23) + np.exp(-((Xh - CC['X1']) / 70) ** 2) * 9 * fbm(Xh * .03, Yh * .03, 29)
    landw = sst(.35, .75, M1[hs_]) * (1 - wd[hs_])
    _dwt = np.exp(-(dmin_pts(NODES_DEL, Xh, Yh) / 175.0) ** 2)
    if _H['name'] == 'ccs':
        # Caribbean/oriental modules: Margarita hills, Mochima coastal range, low sand cays of Los Roques
        dmr, dmo, drq = dmin_pts(NODES_MAR, Xh, Yh), dmin_pts(NODES_MOC, Xh, Yh), dmin_pts(NODES_ROQ, Xh, Yh)
        r1 = 1 - np.abs(2 * fbm(Xh * .04, Yh * .04, 101) - 1)
        r2 = 1 - np.abs(2 * fbm(Xh * .09 + 5, Yh * .09, 103) - 1)
        peaks = peaks + np.exp(-(dmr / 100.0) ** 2) * (r1 ** 1.6 * 15 + r2 ** 2 * 4) - np.exp(-(dmr / 100.0) ** 2) * 3
        mxs = [NODES_MAR[i] for i in range(len(NODES_MAR))]
        cxm, cym = np.mean([p[0] for p in mxs]), np.mean([p[1] for p in mxs])
        for (ox, oy, ph_, ps_) in ((-60, -20, 15, 28), (30, 40, 12, 26), (90, -50, 10, 22)):
            peaks = peaks + ph_ * np.exp(-((Xh - cxm - ox) ** 2 + (Yh - cym - oy) ** 2) / (2 * ps_ ** 2)) * (.85 + .3 * fbm(Xh * .05, Yh * .05, 107))
        inl = sst(.45, .95, M2[hs_])
        peaks = peaks + np.exp(-(dmo / 135.0) ** 2) * inl * (r1 ** 1.4 * 15 + r2 ** 2 * 4) * 1.0
        peaks = peaks * (1 - np.exp(-(drq / 80.0) ** 2))                     # no mountains on the Roques cays
    if _H['name'] == 'ccs':
        _coastal = sst(.52, .88, M2[hs_])
        peaks = peaks * _coastal
        flank = flank * _coastal
    if _H['name'] == 'ord':
        peaks = 0 * Xh
        flank = 0 * Xh
    if _H['name'] == 'zul':
        # Zulia: sandy desert shore with tan rocky hills (west = Perijá foothills), gentle swells on the east bank
        swell = 2.4 * (fbm(Xh * .013, Yh * .013, 271) - .45) * 2
        hills = 0 * Xh
        for (hx_, hy_, hh_, hs2) in ((352, 292, 19, 24), (318, 392, 18, 26), (398, 440, 12, 18), (372, 238, 14, 18), (655, 372, 8, 16), (700, 440, 9, 18), (560, 420, 7, 14)):
            rr_ = 1 - np.abs(2 * fbm(Xh * .07 + hx_, Yh * .07, 273) - 1)
            hills = hills + hh_ * np.exp(-((Xh - hx_) ** 2 + (Yh - hy_) ** 2) / (2 * hs2 ** 2)) * (.75 + .5 * rr_)
        peaks = swell + hills
        flank = 0 * Xh
    if _H['name'] == 'per':
        # Sierra de Perijá: a forested range along the Colombian border dropping to the Maracaibo plain, with ridged spurs and rounded summits
        _sp = dist_line(G.smooth_line(SU.PERIJA_SPINE, 2), Xh, Yh)
        _env = np.exp(-(_sp / 82.0) ** 2)
        _r1 = 1 - np.abs(2 * fbm(Xh * .035, Yh * .035, 481) - 1)
        _r2 = 1 - np.abs(2 * fbm(Xh * .08 + 5, Yh * .08, 483) - 1)
        peaks = _env * (_r1 ** 1.5 * 36 + _r2 ** 2 * 10) - _env * 4
        for (_hx_, _hy_, _hh_, _hs_) in ((140, 360, 20, 30), (122, 520, 24, 30), (150, 660, 22, 30), (196, 800, 18, 28), (236, 920, 14, 24), (200, 440, 12, 24)):
            peaks = peaks + _hh_ * np.exp(-((Xh - _hx_) ** 2 + (Yh - _hy_) ** 2) / (2 * _hs_ ** 2)) * (.85 + .3 * fbm(Xh * .05, Yh * .05, 485))
        peaks = peaks + 2.0 * (fbm(Xh * .013, Yh * .013, 487) - .45) * 2 * sst(190, 301, Xh)       # gentle foothill swells toward the lake plain
        flank = 0 * Xh
    if _H['name'] == 'fal':
        # Falcón: golden dune field on the coast, sandstone hills and green scrub inland (south)
        gz = sst(318, 430, Yh)
        th_ = .55
        ph_ = (Xh * math.cos(th_) + Yh * math.sin(th_)) / 26.0 + 1.8 * fbm(Xh * .02, Yh * .02, 241)
        fr_ = ph_ - np.floor(ph_)
        prof = np.where(fr_ < .72, fr_ / .72, (1 - fr_) / .28) ** 1.3
        env_ = (1 - gz) * sst(.2, .5, fbm(Xh * .012, Yh * .012, 243))
        dunes_f = box_blur(env_ * 6.5 * prof, 1, 1)
        swell = 2.0 * (fbm(Xh * .014, Yh * .014, 245) - .45) * 2 * (1 - gz * .5)
        hills = 0 * Xh
        for (hx_, hy_, hh_, hs2) in ((930, 458, 20, 24), (1050, 412, 17, 22), (866, 268, 11, 16), (1015, 292, 8, 13), (800, 190, 9, 20), (825, 440, 14, 18)):
            rr_ = 1 - np.abs(2 * fbm(Xh * .07 + hx_, Yh * .07, 247) - 1)
            hills = hills + hh_ * np.exp(-((Xh - hx_) ** 2 + (Yh - hy_) ** 2) / (2 * hs2 ** 2)) * (.75 + .5 * rr_)
        peaks = dunes_f + swell + hills
        flank = 0 * Xh
    if _H['name'] == 'lla':
        # sabana: broad gentle swells, almost flat; ground a little higher in the north (the river sits in the south)
        peaks = 2.4 * (fbm(Xh * .011, Yh * .011, 201) - .45) * 2 + 1.1 * (fbm(Xh * .035, Yh * .035, 203) - .5) * 2
        flank = 0 * Xh
    peaks = peaks * (1 - _dwt)
    flank = flank * (1 - _dwt)
    h[hs_] = h[hs_] + (peaks + flank) * wtrack * win * landw
    if _H['name'] == 'ord':
        # wide Orinoco + Caroní confluence: deep river with rocky islets and rapids
        _riv = np.full(Xh.shape, 1e9)
        for _k in ('orinoco', 'caroni'):
            _pts = [tuple(p) for p in L['rivers'][_k] if HX0 - 120 < p[0] < HX1 + 120 and HY0 - 120 < p[1] < HY1 + 120]
            if len(_pts) > 1:
                _riv = np.minimum(_riv, dist_line(_pts, Xh, Yh, step=2) / (1.0 if _k == 'orinoco' else .72))
        _edge = np.minimum(np.minimum(Xh - HX0, HX1 - Xh), np.minimum(Yh - HY0, HY1 - Yh))
        _hw = 30 + 34 * sst(0, 90, _edge)                       # river narrows to its natural width at the patch border
        _rv = 1 - sst(_hw - 22, _hw + 6, _riv)
        _rv = _rv * sst(10, 22, nd_h) * sst(4, 10, pe_h)
        _rv = box_blur(_rv, 2, 2)
        _isl2 = sst(.56, .64, fbm(Xh * .04, Yh * .04, 171)) * _rv * sst(14, 28, _riv) * (1 - sst(_hw - 14, _hw - 2, _riv))
        _rk = SEA + 1.0 + 6 * fbm(Xh * .11, Yh * .11, 173) + 3
        h[hs_] = np.where(_rv > 0, lerp(h[hs_], SEA - 3.0 - 8.5 * sst(.25, .95, _rv), _rv), h[hs_])
        h[hs_] = np.where(_isl2 > .01, lerp(h[hs_], _rk, _isl2), h[hs_])
    if _H['name'] == 'zul':
        # wider lake / strait with soft banks, plus low sandy palm islets
        _edgeY = (HY1 - Yh)
        _wide = sst(.04, .30, box_blur(LK[hs_], 7, 2)) * sst(0, 70, _edgeY) * sst(8, 20, nd_h)
        _wide = box_blur(_wide, 2, 1)
        _bedz = SEA - 1.2 - 2.6 * sst(.35, 1.0, _wide)
        h[hs_] = np.where(_wide > .01, np.minimum(lerp(h[hs_], _bedz, np.clip(_wide * 1.2, 0, 1)), h[hs_]), h[hs_])
        for (ix_, iy_, ir_, ih_) in ((510, 262, 14, 2.6), (566, 246, 11, 2.4), (622, 226, 13, 2.8), (524, 226, 9, 2.2), (676, 276, 10, 2.4), (470, 305, 9, 2.4), (588, 292, 8, 2.2)):
            dd_ = np.hypot(Xh - ix_, Yh - iy_) * (.85 + .3 * fbm(Xh * .08, Yh * .08, 275))
            t_ = 1 - sst(ir_ * .5, ir_, dd_)
            top_ = SEA + ih_ * (.8 + .4 * fbm(Xh * .12, Yh * .12, 277))
            h[hs_] = np.where(t_ > 0, np.maximum(h[hs_], lerp(h[hs_], top_, t_)), h[hs_])
    if _H['name'] == 'fal':
        # rocky sandstone islets in the turquoise water
        for (ix_, iy_, ir_, ih_) in ((905, 232, 13, 9), (958, 242, 9, 7), (1040, 256, 11, 8), (1076, 264, 8, 6), (882, 205, 10, 8), (832, 102, 14, 9), (800, 112, 8, 6), (790, 160, 7, 6)):
            dd_ = np.hypot(Xh - ix_, Yh - iy_) * (.85 + .3 * fbm(Xh * .08, Yh * .08, 251))
            t_ = 1 - sst(ir_ * .55, ir_, dd_)
            top_ = SEA + ih_ * (.7 + .6 * fbm(Xh * .12, Yh * .12, 253))
            h[hs_] = np.where(t_ > 0, np.maximum(h[hs_], lerp(h[hs_], top_, t_)), h[hs_])
    if _H['name'] == 'lla':
        # Río Apure: a meandering wide river with soft banks, plus two esteros (shallow ponds); restore the old shallow trough first
        h[hs_] = h[hs_] + 2.6 * (1 - sst(2.6, 7.5, rdist[hs_])) * (1 - wd[hs_] * .6) * landw
        _ap = [(p_[0], p_[1] + 14 * math.sin(p_[0] * .012 + 1.0) + 7 * math.sin(p_[0] * .036)) for p_ in L['rivers']['apure'] if HX0 - 150 < p_[0] < HX1 + 150]
        _dap = dist_line(_ap, Xh, Yh, step=2)
        _edge = np.minimum(np.minimum(Xh - HX0, HX1 - Xh), np.minimum(Yh - HY0, HY1 - Yh))
        _hw = (5 + 12 * sst(0, 80, _edge)) * (.85 + .3 * np.clip(fbm(Xh * .02, Yh * .02, 207), 0, 1))
        _msk = sst(10, 24, nd_h) * sst(4, 12, pe_h)
        _t = (1 - sst(_hw - 3, _hw + 15, _dap)) * _msk
        for (qx_, qy_, qr_) in ((1085, 1002, 24), (1262, 992, 20), (1480, 985, 18)):
            _t = np.maximum(_t, (1 - sst(qr_ - 4, qr_ + 11, np.hypot(Xh - qx_, Yh - qy_) * (.9 + .25 * fbm(Xh * .06, Yh * .06, 209)))) * _msk * .98)
        _t = box_blur(_t, 1, 1)
        _bed = SEA - 1.6 - 2.4 * sst(.35, 1.0, _t)
        h[hs_] = np.where(_t > .01, np.minimum(lerp(h[hs_], _bed, np.clip(_t * 1.15, 0, 1)), h[hs_]), h[hs_])
    if _H['name'] in ('and', 'apw'):
        # Apure headwaters: a clear meandering river with soft banks and sandbars across the foothills (continues into the Llanos patch)
        _dap = dist_line(SU.APURE_W, Xh, Yh, step=2)
        _hwa = (5 + 11 * sst(0, 300, 1001 - Xh)) * (.85 + .3 * np.clip(fbm(Xh * .02, Yh * .02, 207), 0, 1))
        _ta = box_blur((1 - sst(_hwa - 3, _hwa + 15, _dap)) * sst(10, 24, nd_h) * sst(4, 12, pe_h), 1, 1)
        h[hs_] = np.where(_ta > .01, np.minimum(lerp(h[hs_], SEA - 1.6 - 2.4 * sst(.35, 1.0, _ta), np.clip(_ta * 1.15, 0, 1)), h[hs_]), h[hs_])
        for (_bx, _by, _brx, _bry, _bth, _btop) in SU.BARS_APURE:
            if not (HX0 - _brx < _bx < HX1 + _brx and HY0 - _brx < _by < HY1 + _brx):
                continue
            _uu = (Xh - _bx) * math.cos(_bth) + (Yh - _by) * math.sin(_bth)
            _vv = -(Xh - _bx) * math.sin(_bth) + (Yh - _by) * math.cos(_bth)
            _dd = np.hypot(_uu / _brx, _vv / _bry) * (.88 + .24 * fbm(Xh * .08, Yh * .08, 437))
            _tt = (1 - sst(.45, 1.0, _dd)) * (_ta > .5)
            h[hs_] = np.where(_tt > 0, np.maximum(h[hs_], lerp(h[hs_], SEA + _btop * (.8 + .35 * fbm(Xh * .1, Yh * .1, 439)), _tt)), h[hs_])
    if _H['name'] in FAMN:
        # Guayana south-east: lowered floor, tepuis / domes / mesas, Caroní + Orinoco + Roraima stream, lagoon, esteros, sandbars, plunge pools under the falls
        _bw = FAMW[hs_]
        _wetw = (1 - sst(1450, 1850, Xh)) * (1 - sst(1500, 1760, Yh))           # Apure wetlands sit lower than the plateau
        _gr = GS.GR - 3.6 * _wetw + 1.5 * (fbm(Xh * .013, Yh * .013, 401) - .45) * 2 + .6 * (fbm(Xh * .04, Yh * .04, 403) - .5) * 2
        _dry = h[hs_] > SEA + .8
        h[hs_] = np.where(_dry, lerp(np.minimum(h[hs_], 17.4), _gr, _bw), h[hs_])
        _tp_ = [(_ti, _t) for _ti, _t in enumerate(SU.ALL_TEPUIS)
                if HX0 - _t['a'] * 2.2 < _t['c'][0] < HX1 + _t['a'] * 2.2 and HY0 - _t['a'] * 2.2 < _t['c'][1] < HY1 + _t['a'] * 2.2]
        for _ti, _t in _tp_:
            h[hs_] = h[hs_] + tepui_add(Xh, Yh, nd_h, pe_h, _t, _ti) * _bw
        _msk = sst(10, 22, nd_h) * sst(4, 11, pe_h)
        _db = np.full(Xh.shape, 1e9)
        _cr = G.smooth_line([tuple(p_) for p_ in GS.CARONI], 2)
        _rv = dist_line(_cr, Xh, Yh, step=2)
        _hw = (4.4 + 5.5 * _bw) * (.85 + .3 * np.clip(fbm(Xh * .02, Yh * .02, 421), 0, 1))
        _t2 = (1 - sst(_hw - 2, _hw + 7, _rv)) * _msk
        _db = np.minimum(_db, _rv - _hw)
        _lg = GS.LAGOON
        _ul = (Xh - _lg['c'][0]) * math.cos(_lg['th']) + (Yh - _lg['c'][1]) * math.sin(_lg['th'])
        _vl = -(Xh - _lg['c'][0]) * math.sin(_lg['th']) + (Yh - _lg['c'][1]) * math.cos(_lg['th'])
        _dl = np.hypot(_ul / _lg['rx'], _vl / _lg['ry']) * (.92 + .22 * fbm(Xh * .05, Yh * .05, 423))
        _t2 = np.maximum(_t2, (1 - sst(.78, 1.08, _dl)) * _msk)
        _db = np.minimum(_db, (_dl - .95) * 40)
        # Orinoco: broad and brown at the Apure confluence, narrowing toward Amazonas with a lazy meander
        _ro = dist_line(SU.ORINOCO_M, Xh, Yh, step=2)
        _hwo = SU.orn_hw(Yh) * (.55 + .45 * _bw) * (.92 + .16 * np.clip(fbm(Xh * .018, Yh * .018, 431), 0, 1))
        _t2 = np.maximum(_t2, (1 - sst(_hwo - 4, _hwo + 11, _ro)) * _msk)
        _db = np.minimum(_db, _ro - _hwo)
        # Roraima stream with its tributary
        for _pl, _w0 in ((SU.SAB_RIVER, 6.2), (SU.SAB_RIVER2, 3.4), (SU.AMA_TRIB, 8.5), (SU.META, 12.0)):
            if not any(HX0 - 80 < p_[0] < HX1 + 80 and HY0 - 80 < p_[1] < HY1 + 80 for p_ in _pl):
                continue
            _sp = G.smooth_line([tuple(p_) for p_ in _pl], 2)
            _rs = dist_line(_sp, Xh, Yh, step=2)
            _hs2 = (_w0 + 2.6 * _bw) * (.85 + .3 * np.clip(fbm(Xh * .03, Yh * .03, 433), 0, 1))
            _t2 = np.maximum(_t2, (1 - sst(_hs2 - 2, _hs2 + 6, _rs)) * _msk)
            _db = np.minimum(_db, _rs - _hs2)
        # Apure esteros: shallow ponds with irregular shores + the narrow channels joining them
        if _H['name'] in ('orn0', 'orn', 'orn2', 'apw'):
            for (_px_, _py_, _rx_, _ry_, _th_) in (SU.PONDS_W if _H['name'] == 'apw' else SU.PONDS):
                _uu = (Xh - _px_) * math.cos(_th_) + (Yh - _py_) * math.sin(_th_)
                _vv = -(Xh - _px_) * math.sin(_th_) + (Yh - _py_) * math.cos(_th_)
                _dd = np.hypot(_uu / _rx_, _vv / _ry_) * (.9 + .24 * fbm(Xh * .07, Yh * .07, 435))
                _t2 = np.maximum(_t2, (1 - sst(.82, 1.12, _dd)) * _msk)
                _db = np.minimum(_db, (_dd - 1.0) * min(_rx_, _ry_))
            for _ch in (SU.ESTERO_W if _H['name'] == 'apw' else SU.ESTERO_CH):
                _cs = G.smooth_line(_ch, 2)
                _rc = dist_line(_cs, Xh, Yh, step=2)
                _t2 = np.maximum(_t2, (1 - sst(1.6, 4.4, _rc)) * _msk)
                _db = np.minimum(_db, _rc - 3)
        for _ti, _t in _tp_:
            for _fi, _al in enumerate(_t['falls']):
                _qx, _qy = SU.pool(_t, _al)
                _s = (_t['T'] + GS.GR - GS.SEA) / 40.0
                _t2 = np.maximum(_t2, (1 - sst(6.0 * _s ** .5, 9.5 * _s ** .5 + 5, np.hypot(Xh - _qx, Yh - _qy))) * _bw)
                _ch = _t['chan'][_fi] if _fi < len(_t['chan']) else None
                if _ch:
                    _cp = G.smooth_line([(_qx, _qy)] + [tuple(p_) for p_ in _ch], 2)
                    _t2 = np.maximum(_t2, (1 - sst(2.6, 6.2, dist_line(_cp, Xh, Yh, step=2))) * _msk)
        _t2 = box_blur(_t2, 1, 1)
        _bed = SEA - 1.6 - 2.4 * sst(.35, 1.0, _t2)
        h[hs_] = np.where(_t2 > .01, np.minimum(lerp(h[hs_], _bed, np.clip(_t2 * 1.15, 0, 1)), h[hs_]), h[hs_])
        for (_ix, _iy, _ir) in GS.ISLETS:
            _dd = np.hypot(Xh - _ix, Yh - _iy) * (.85 + .3 * fbm(Xh * .09, Yh * .09, 427))
            _tt = 1 - sst(_ir * .5, _ir, _dd)
            _tp = SEA + 2.4 * (.8 + .4 * fbm(Xh * .12, Yh * .12, 429))
            h[hs_] = np.where(_tt > 0, np.maximum(h[hs_], lerp(h[hs_], _tp, _tt)), h[hs_])
        for (_bx, _by, _brx, _bry, _bth, _btop) in SU.BARS:                    # elongated sandbars in the Orinoco
            if not (HX0 - _brx < _bx < HX1 + _brx and HY0 - _brx < _by < HY1 + _brx):
                continue
            _uu = (Xh - _bx) * math.cos(_bth) + (Yh - _by) * math.sin(_bth)
            _vv = -(Xh - _bx) * math.sin(_bth) + (Yh - _by) * math.cos(_bth)
            _dd = np.hypot(_uu / _brx, _vv / _bry) * (.88 + .24 * fbm(Xh * .08, Yh * .08, 437))
            _tt = 1 - sst(.45, 1.0, _dd)
            _tp = SEA + _btop * (.8 + .35 * fbm(Xh * .1, Yh * .1, 439))
            h[hs_] = np.where(_tt > 0, np.maximum(h[hs_], lerp(h[hs_], _tp, _tt)), h[hs_])
        DRB[hs_] = np.minimum(DRB[hs_], _db)
        # jungle weight
        _ex = sst(1800, 2150, Xh)                                              # open savanna grows toward the east: position-based so patch borders stay seamless
        _nzc = np.clip((fbm(Xh * .012 + 3, Yh * .012, 471) - (.52 + .08 * _ex)) * (7 + _ex), 0, 1)
        _jw = np.maximum(1 - sst(14 - 6 * _ex, 56 - 22 * _ex, _db), _nzc * .8)
        if _H['name'] in ('orn0', 'orn', 'orn2'):
            _xr = np.interp(Yh, [p_[1] for p_ in sorted(SU.ORN_N, key=lambda q_: q_[1])], [p_[0] for p_ in sorted(SU.ORN_N, key=lambda q_: q_[1])])
            _jw = np.maximum(_jw, sst(-10, 70, Xh - _xr) * .95 * (.85 + .15 * _nzc) * (1 - sst(1860, 2010, Xh)) * (1 - sst(1600, 1760, Yh)))   # forested east bank
            _jw = np.minimum(_jw, np.where(Xh < _xr, .75, 1.0))                                                                                    # west bank mostly open
        elif _H['name'] in ('sab', 'sab2'):
            _jw = np.maximum(_jw, sst(2470, 2650, Xh) * sst(1580, 1740, Yh) * (.75 + .25 * _nzc))
        elif _H['name'] in ('ama', 'ama2'):
            _ds = Yh - (SU.AMA_LINE[1] + SU.AMA_LINE[2] * (Xh - SU.AMA_LINE[0]))
            _jw = np.maximum(_jw, sst(-50, 110, _ds) * .96)
            _jw = np.maximum(_jw, .97 * sst(1701, 1830, Yh) * (1 - sst(1990, 2100, Xh)))              # rainforest almost everywhere, easing out at the patch borders
        JW[hs_] = _jw
    for _ti, _t in enumerate(GS.TEPUIS_X):
        if HX0 - 140 < _t['c'][0] < HX1 + 140 and HY0 - 90 < _t['c'][1] < HY1 + 90:
            h[hs_] = h[hs_] + tepui_add(Xh, Yh, nd_h, pe_h, _t, 20 + _ti)
    # Delta Amacuro: an archipelago of mangrove islands cut by shallow tidal channels (board paths stay on land / become boardwalks)
    _nzd = fbm(Xh * .018, Yh * .018, 151) * .65 + fbm(Xh * .042, Yh * .042, 153) * .35
    _isl = sst(.475, .565, _nzd)
    _keep = np.maximum(1 - sst(15, 25, nd_h), 1 - sst(5.5, 9, pe_h))
    _isl = np.maximum(_isl, _keep)
    _landt = SEA + 1.9 + 1.2 * np.clip(fbm(Xh * .09, Yh * .09, 157), 0, 1)
    _watt = SEA - 1.1 - .9 * np.clip(fbm(Xh * .07, Yh * .07, 159), 0, 1)
    _hd = lerp(_watt, _landt, _isl)
    _wdl = _dwt * sst(.3, .6, M1[hs_])
    h[hs_] = lerp(h[hs_], _hd, _wdl)
    if _H['name'] == 'ccs':
        _cf = 1 - sst(.5, .85, M2[hs_])
        h[hs_] = h[hs_] - _cf * np.maximum(h[hs_] - (SEA + 3.4), 0) * .8 * landw          # coastal plain: beaches instead of cliffs
        LEC = L.get('lecheria')
        if LEC:
            _c0 = LEC['c']
            _dl = np.hypot(Xh - _c0[0], Yh - _c0[1])
            _wl = (1 - sst(70, 105, _dl)) * sst(.4, .7, M1[hs_]) * sst(14, 28, nd_h)
            h[hs_] = lerp(h[hs_], SEA + 2.9, _wl)
            _can = np.full(Xh.shape, 1e9)
            for _pl in LEC['canals']:
                _can = np.minimum(_can, dist_line([tuple(p) for p in _pl], Xh, Yh))
            _cw = 1 - sst(3.4, 5.4, _can)
            h[hs_] = np.where(_cw > 0, lerp(h[hs_], SEA - 1.9, _cw), h[hs_])
    if _H['name'] == 'ccs':
        wr = np.exp(-(drq / 62.0) ** 2) * sst(.35, .7, M1[hs_])
        cay = SEA + 2.7 + 1.2 * np.clip(fbm(Xh * .12, Yh * .12, 109), 0, 1) + 3.5 * np.clip(fbm(Xh * .22 + 9, Yh * .22, 113) - .62, 0, 1) * 6
        h[hs_] = lerp(h[hs_], cay, wr)
    print('hero bbox', HX0, HX1, HY0, HY1, 'fine', HI0, HI1, HJ0, HJ1)
print('heights', round(time.time() - t0, 1), float(h.min()), float(h.max()))

pe_all_c = np.full(X.shape, 1e9)
for (a_, b_) in L['edges']:
    if [a_, b_] in L['special'] or [b_, a_] in L['special']:
        continue
    pe_all_c = np.minimum(pe_all_c, dist_line([tuple(NODES[a_]), tuple(NODES[b_])], X, Y))
nd = np.full(X.shape, 1e9)
for nid_, (nx2, ny2) in NODES.items():
    nd = np.minimum(nd, np.hypot(X - nx2, Y - ny2))
# ───────────────────────── regions (smooth weights) ─────────────────────────
REGS = ['ccs', 'coc', 'zul', 'and', 'lla', 'gua', 'can', 'del', 'moc', 'mar', 'roq', 'ama', 'fal']
pts_by = {r: [] for r in REGS}
for nid, (nx_, ny_) in NODES.items():
    pts_by[reg_of[nid]].append((nx_, ny_))
for (lo, la, r) in ((-67.62, 5.66, 'ama'), (-67.7, 4.05, 'ama'), (-65.55, 3.2, 'ama'), (-66.0, 1.5, 'ama'), (-64.2, 3.2, 'ama'), (-66.5, 5.0, 'ama'),
                    (-69.8, 11.4, 'fal'), (-70.0, 11.9, 'fal'), (-70.6, 11.1, 'fal'), (-69.4, 11.1, 'fal'),
                    (-63.0, 5.6, 'can'), (-62.0, 4.5, 'can'), (-65.5, 6.8, 'gua'), (-64.0, 7.0, 'gua'), (-62.5, 7.3, 'gua')):
    pts_by[r].append(P2(lo, la))
D = {}
for r in REGS:
    d = np.full(X.shape, 1e9)
    for (px, py) in pts_by[r]:
        d = np.minimum(d, np.hypot(X - px, Y - py))
    D[r] = np.exp(-d / 62.0)
tot = sum(D.values()) + 1e-9
Wt = {r: D[r] / tot for r in REGS}
PAL = {'ccs': '#7d9f50', 'coc': '#8fae52', 'zul': '#cdb97a', 'and': '#6f8a52', 'lla': '#a8b65a', 'gua': '#2f7a3a', 'can': '#235f31', 'del': '#2f7a4a',
       'moc': '#7fa860', 'mar': '#b3b86c', 'roq': '#dcc98c', 'ama': '#256b34', 'fal': '#d9b878'}


def hx(s):
    return np.array([int(s[i:i + 2], 16) / 255.0 for i in (1, 3, 5)])


col = np.zeros(X.shape + (3,))
for r in REGS:
    col += Wt[r][..., None] * hx(PAL[r])
nz = fbm(X * .02, Y * .02, 21)
col *= (.88 + nz * .24)[..., None]


def tint(mask, c, a=1.0):
    global col
    k = (np.clip(mask, 0, 1) * a)[..., None]
    col = col * (1 - k) + hx(c) * k


# llanos savanna patches + flooded marsh; gallery forest along rivers
tint(Wt['lla'] * fbm(X * .03, Y * .03, 31) * .8, '#93a64e')
tint(Wt['lla'] * (1 - sst(0, 1, rdist / 5)) * .0, '#000000')
gal = 1 - sst(4, 14, rdist * 1.0)
tint(gal * (1 - wd) * .55, '#2a7a3a')
# Andes: forest low, rock high, snow caps
tint(sst(TOPE + 14, TOPE + 26, h) * (Wt['and'] + .0) * .9, '#8b8676')
tint(sst(TOPE + 30, TOPE + 40, h) * .95 * (Wt['and'] > .15), '#eef2fa')
# Gran Sabana golden grass
sx_, sy_ = P2(-61.4, 5.1)
tint((1 - sst(30, 120, np.hypot(X - sx_, Y - sy_))) * .6, '#b9b55a')
# Falcón desert + dunes
fx_, fy_ = P2(-69.75, 11.4)
tint(np.clip(dunes * .95 + (1 - sst(70, 170, np.hypot(X - fx_, Y - fy_))) * .55, 0, 1), '#e2b868')
tint(np.clip((.5 + .5 * np.sin((X * .9 + Y * .5) * .13)) * dunes, 0, 1) * .25, '#c99a50')
# arid Lara/Carora and Guajira
tint((1 - sst(40, 110, np.hypot(X - P2(-70.1, 10.2)[0], Y - P2(-70.1, 10.2)[1]))) * .35, '#d3c27c')
tint((1 - sst(20, 90, np.hypot(X - P2(-71.4, 11.45)[0], Y - P2(-71.4, 11.45)[1]))) * .5, '#dcc98c')
# delta: lush green with teal lagoons
tint(wd * .55, '#2f7a4a')
tint(wd * (fbm(X * .09, Y * .09, 41) > .62) * .6, '#4aa070')
tint(wd * (1 - sst(2.4, 7.0, chan)) * .7, '#3aa89a')
# cliffs by slope
gy_, gx_ = np.gradient(h, FC)
slope = np.hypot(gx_, gy_)
tint(sst(.55, 1.2, slope) * (h > SEA + 1) * .6, '#a07045')
# coast: beach band + foam
beach = (1 - sst(SEA + .8, SEA + 3.6, h)) * (h > SEA - .3) * (1 - wd * .6) * (1 + .5 * (Wt['mar'] + Wt['roq'] + Wt['moc']))
tint(np.clip(beach, 0, 1) * .9, '#ecd9a0')
tint((h < SEA + .8) * (h > SEA - .6) * .6, '#d8f0f0')
# readable board: lawn around every tile and a clean lighter corridor along the paths (scenery stays calmer than the track)
near_track = np.maximum(1 - sst(14, 26, nd), 1 - sst(8, 15, pe_all_c))
tint(near_track * (1 - wd * .3) * (h > SEA + 1.2) * .22, '#9fd16a')
# cap heights by distance from the coast so the coast is a gentle plain and the hills rise inland
_cap = SEA + 1.4 + 80 * DCP ** 2.3
h = np.where(M1 > .5, np.minimum(h, np.maximum(_cap, SEA + 1.2)), h)
for _H in HEROES:
    HX0, HX1, HY0, HY1, HI0, HI1, HJ0, HJ1 = _H['X0'], _H['X1'], _H['Y0'], _H['Y1'], _H['I0'], _H['I1'], _H['J0'], _H['J1']
    hs_ = HI_(_H)
    Xh, Yh = X[hs_], Y[hs_]
    landw = sst(.35, .75, M1[hs_]) * (1 - wd[hs_])
    # ── hero colours: rock faces, lush forest, city street grid, barrio dirt ──
    _h = h[hs_]
    _sl = slope[hs_]
    _land = (M1[hs_] > .55) & (_h > SEA + 1.2)
    _rock = sst(.55, 1.15, _sl) * sst(TOPE + 10, TOPE + 22, _h)
    _forest = sst(TOPE + 4, TOPE + 14, _h) * (1 - sst(.9, 1.4, _sl))
    _c = col[hs_]
    _c = _c * (1 - (_forest * .8)[..., None]) + hx('#3b8a2c') * (_forest * .8)[..., None]
    _c = _c * (1 - (np.clip(fbm(Xh * .09, Yh * .09, 31), 0, 1) > .6) [..., None] * (_forest * .5)[..., None]) + hx('#5aa83a') * ((np.clip(fbm(Xh * .09, Yh * .09, 31), 0, 1) > .6) * _forest * .5)[..., None]
    _rk = np.where((fbm(Xh * .07, Yh * .07, 37) > .5)[..., None], hx('#9a8468'), hx('#7f7a70'))
    _c = _c * (1 - (_rock * .9)[..., None]) + _rk * (_rock * .9)[..., None]
    if _H['name'] == 'and':
        # snow caps, rock faces, páramo grass, pine slopes, valley meadow, gravel along the river
        _snow = sst(TOPE + 30, TOPE + 38, _h) * (1 - sst(1.1, 1.7, _sl) * .5)
        _c = _c * (1 - (_snow * .96)[..., None]) + hx('#f2f6fc') * (_snow * .96)[..., None]
        _par = sst(TOPE + 14, TOPE + 20, _h) * (1 - sst(TOPE + 30, TOPE + 36, _h)) * (1 - _rock * .6) * _land
        _pc = np.where((fbm(Xh * .08, Yh * .08, 67) > .5)[..., None], hx('#b5b55a'), hx('#9fae4a'))
        _c = _c * (1 - (_par * .85)[..., None]) + _pc * (_par * .85)[..., None]
        _mead = _land & (_h < TOPE + 7) & (_sl < .4)
        _c = np.where(_mead[..., None], _c * .35 + np.where((fbm(Xh * .05, Yh * .05, 71) > .55)[..., None], hx('#a6c95a'), hx('#8fbf55')) * .65, _c)
        _grav = (1 - sst(1.5, 5.5, rdist[hs_] / 1.0)) * _land
        _c = _c * (1 - (_grav * .6)[..., None]) + hx('#b8b0a0') * (_grav * .6)[..., None]
    else:
        # city grid in the flat valley
        _scx = (L['nodes']['ccs_parquecentral'][0] + L['nodes']['ccs_start'][0]) / 2
        _scy = (L['nodes']['ccs_parquecentral'][1] + L['nodes']['ccs_start'][1]) / 2 + 20
        _cityr = 345 + 40 * (fbm(Xh * .02, Yh * .02, 47) - .5)
        _val = box_blur((_land & (_h < TOPE + 6.5) & (_sl < .35) & (_h > SEA + 3.2) & (landw > .5)).astype(np.float64), 3, 2) * (1 - sst(_cityr - 150, _cityr, np.hypot(Xh - _scx, Yh - _scy)))
        px_, py_ = np.mod(Xh, 26.0), np.mod(Yh, 22.0)
        _st = (px_ < 3.6) | (py_ < 3.4)
        _sw = ((px_ < 5.2) | (py_ < 5.0)) & ~_st
        _park = hash2(np.floor(Xh / 26).astype(np.int64), np.floor(Yh / 22).astype(np.int64), 41) > .76
        _blk = np.where(_park[..., None], hx('#7dbd4f'), hx('#b6b39e'))
        _vk = np.where(_st[..., None], hx('#575a63'), np.where(_sw[..., None], hx('#cfcab6'), _blk))
        _c = _c * (1 - _val[..., None]) + _vk * _val[..., None]
        # barrio earth on the mid slopes
        _bar = _land & (_h > TOPE + 3) & (_sl > .18) & (_sl < .8) & (_rock < .3) & (np.hypot(Xh - _scx, Yh - _scy) < 540)
        _c = _c * (1 - (_bar * .5)[..., None]) + hx('#b48c5c') * (_bar * .5)[..., None]
    if _H['name'] == 'and':
        # south Zulia (Lagunillas / San Francisco / Catatumbo): hot dry lake plain instead of Andean meadow
        _zw = np.exp(-(dmin_pts(NODES_ZUL, Xh, Yh) / 125.0) ** 2) * (1 - sst(TOPE + 6, TOPE + 14, _h)) * _land
        _zs = np.where((fbm(Xh * .09, Yh * .09, 301) > .55)[..., None], hx('#efc474'), hx('#e2b45e'))
        _zg = np.where((fbm(Xh * .05, Yh * .05, 303) > .55)[..., None], hx('#a3b04a'), hx('#8fa23f'))
        _zm = np.clip((fbm(Xh * .02, Yh * .02, 305) - .5) * 3.5, 0, 1)
        _zb = _zs * (1 - (_zm * .7)[..., None]) + _zg * (_zm * .7)[..., None]
        _c = _c * (1 - (_zw * .92)[..., None]) + _zb * (_zw * .92)[..., None]
        _zbc = (1 - sst(SEA + .9, SEA + 3.0, _h)) * _land * (_zw > .15)
        _c = _c * (1 - (_zbc * .85)[..., None]) + hx('#f4e4b4') * (_zbc * .85)[..., None]
        # Barinas / Táchira farmland: a patchwork of paddocks (lawn, hay, plowed earth) with hedge lines, plus contour terraces on the Táchira slopes
        _fix, _fiy = np.floor(Xh / SU.FIELD_W).astype(np.int64), np.floor(Yh / SU.FIELD_H).astype(np.int64)
        _fv = SU.fld(_fix, _fiy)
        _lx, _ly = np.mod(Xh, SU.FIELD_W), np.mod(Yh, SU.FIELD_H)
        _fm = SU.field_region(Xh, Yh) & (_fv < 62) & (_sl < .3) & (_h > SEA + 2.0) & (_h < TOPE + 9) & (nd[hs_] > 56) & (pe_all_c[hs_] > 12) & (landw > .5)
        _inn = (_lx > 2.5) & (_lx < SU.FIELD_W - 2.5) & (_ly > 2.5) & (_ly < SU.FIELD_H - 2.5)
        _fk = np.where((_fv % 3 == 0)[..., None], hx('#a6c44a'), np.where((_fv % 3 == 1)[..., None], hx('#d2c35c'), hx('#bf9559')))
        _fk = np.where(((_fv % 3 == 2) & (np.mod(Xh * .5 + Yh * .15, 3.0) < 1.1))[..., None], _fk * .86, _fk)
        _c = np.where((_fm & _inn)[..., None], _c * .15 + _fk * .85, _c)
        _c = np.where((_fm & ~_inn)[..., None], _c * .45 + hx('#6f9a3a') * .55, _c)
        _tz = (np.mod(_h / 1.5, 1.0) < .42) & (_sl > .2) & (_sl < .75) & (_h > TOPE + 1) & (_h < TOPE + 22) & (nd[hs_] > 26) & (Xh < 800) & (Yh > 880) & _land
        _c = np.where(_tz[..., None], _c * .55 + np.where((fbm(Xh * .06, Yh * .06, 311) > .5)[..., None], hx('#92b34a'), hx('#b3a954')) * .45, _c)
    if _H['name'] == 'zul':
        _sl2 = slope[hs_]
        _sand = np.where((fbm(Xh * .09, Yh * .09, 281) > .55)[..., None], hx('#efc474'), hx('#e4b660'))
        _grn = np.where((fbm(Xh * .05, Yh * .05, 283) > .5)[..., None], hx('#9bae45'), hx('#88a23c'))
        _gm = np.clip((fbm(Xh * .02, Yh * .02, 285) - .5) * 4, 0, 1) * (Xh > 540)
        _base = _sand * (1 - (_gm * .8)[..., None]) + _grn * (_gm * .8)[..., None]
        _c = np.where(_land[..., None], _base, _c)
        _rk = np.where((fbm(Xh * .08, Yh * .08, 287) > .5)[..., None], hx('#b97f52'), hx('#9a7358'))
        _rm = sst(.45, 1.0, _sl2) * (_h > SEA + 1.5)
        _c = _c * (1 - (_rm * .9)[..., None]) + _rk * (_rm * .9)[..., None]
        _top = sst(TOPE + 9, TOPE + 20, _h) * (1 - sst(.6, 1.2, _sl2))
        _c = _c * (1 - (_top * .5)[..., None]) + hx('#d9b57e') * (_top * .5)[..., None]
        _bch = (1 - sst(SEA + .9, SEA + 3.0, _h)) * _land
        _c = _c * (1 - (_bch * .85)[..., None]) + hx('#f4e4b4') * (_bch * .85)[..., None]
    if _H['name'] in FAMN:
        _sl2 = slope[hs_]
        _jwh = JW[hs_]
        _jg = np.where((fbm(Xh * .06, Yh * .06, 441) > .52)[..., None], hx('#3f9a32'), hx('#2c7a2b'))
        _jg = _jg * (1 - (np.clip((fbm(Xh * .03, Yh * .03, 443) - .55) * 4, 0, 1) * .5)[..., None]) + hx('#6aa83a') * (np.clip((fbm(Xh * .03, Yh * .03, 443) - .55) * 4, 0, 1) * .5)[..., None]
        _sv = np.where((fbm(Xh * .045, Yh * .045, 461) > .5)[..., None], hx('#b3bf3e'), hx('#9cb83a'))
        _dryg = np.clip((fbm(Xh * .028, Yh * .028, 463) - .5) * 5, 0, 1)
        _sv = _sv * (1 - (_dryg * .5)[..., None]) + hx('#d0bc58') * (_dryg * .5)[..., None]
        _ochre = np.clip((fbm(Xh * .09, Yh * .09, 465) - .6) * 6, 0, 1) * (1 - _jwh)
        _sv = _sv * (1 - (_ochre * .45)[..., None]) + hx('#c98f4a') * (_ochre * .45)[..., None]
        _base = _sv * (1 - _jwh[..., None]) + _jg * _jwh[..., None]
        _c = np.where(_land[..., None], _base, _c)
        _hh = _h - GS.GR
        _cl = sst(.45, 1.0, _sl2) * sst(5, 13, _hh)
        _band = fbm(Xh * .42, Yh * .42, 451)
        _ck = np.where((_band > .56)[..., None], hx('#ee9c54'), np.where((_band > .42)[..., None], hx('#c9733a'), hx('#8c4a28')))
        _ck = np.where((fbm(Xh * .09, Yh * .09, 453) > .6)[..., None], hx('#6a5560') * .55 + _ck * .45, _ck)
        if _H['name'] in ('ama', 'ama2'):
            _gs = fbm(Xh * .5, Yh * .08, 473)                                  # vertical weathering streaks on the granite
            _ck = np.where((_band > .56)[..., None], hx('#bdb3a6'), np.where((_band > .42)[..., None], hx('#9c9187'), hx('#7d746b')))
            _ck = np.where((_gs > .6)[..., None], _ck * .72, _ck)
        _tp = sst(24, 34, _hh) * (1 - sst(.55, 1.0, _sl2)) * (.35 if _H['name'] in ('ama', 'ama2') else 1.0)
        _mo = np.where((fbm(Xh * .07, Yh * .07, 455) > .5)[..., None], hx('#86b238'), hx('#6f9a2e'))
        _mo = np.where((fbm(Xh * .05, Yh * .05, 457) > .66)[..., None], hx('#a39a48'), _mo)
        _c = _c * (1 - (_cl * .95)[..., None]) + _ck * (_cl * .95)[..., None]
        _c = _c * (1 - (_tp * .95)[..., None]) + _mo * (_tp * .95)[..., None]
        _tl = sst(1, 9, _hh) * (1 - _cl) * (1 - _tp) * _land
        _c = _c * (1 - (_tl * .35)[..., None]) + hx('#7a6a3c') * (_tl * .35)[..., None]
        if _H['name'] in SU.NEW:
            _mt = sst(5, 11, _hh) * (1 - sst(.55, 1.0, _sl2)) * _land                               # grass on the flat top of low mesas / domes
            _c = _c * (1 - (_mt * (_hh < 36) * .8)[..., None]) + _mo * (_mt * (_hh < 36) * .8)[..., None]
        _mar = (1 - sst(SEA + 2.4, SEA + 5.0, _h)) * _land * (1 - _jwh * .5)                        # lush wet fringe above the sand
        _c = _c * (1 - (_mar * .55)[..., None]) + hx('#6fae3e') * (_mar * .55)[..., None]
        for _rd in SU.ROADS:
            _rr = dist_line(G.smooth_line(_rd, 2), Xh, Yh, step=2)
            _rm = (1 - sst(2.2, 4.4, _rr)) * _land * (_h > SEA + 1.2)
            _c = _c * (1 - (_rm * .92)[..., None]) + np.where((fbm(Xh * .2, Yh * .2, 467) > .55)[..., None], hx('#b98f58'), hx('#cfa86c')) * (_rm * .92)[..., None]
        for (_vx_, _vy_, _vr_) in SU.NOVEG + [(GS.VILLAGE[0] - 18, GS.VILLAGE[1], 40)]:
            _vm = (1 - sst(_vr_ * .45, _vr_ * .85, np.hypot(Xh - _vx_, Yh - _vy_) * (.9 + .2 * fbm(Xh * .08, Yh * .08, 469)))) * _land * (_h > SEA + 1.6)
            _c = _c * (1 - (_vm * .6)[..., None]) + hx('#c9a266') * (_vm * .6)[..., None]
        _bch = (1 - sst(SEA + .9, SEA + 3.0, _h)) * _land
        _c = _c * (1 - (_bch * .85)[..., None]) + hx('#e0bd72' if _H['name'] in ('ama', 'ama2', 'orn', 'orn0', 'orn2', 'apw') else '#ead593') * (_bch * .85)[..., None]
    if _H['name'] == 'per':
        _sl2 = slope[hs_]
        _hh = _h - TOPE
        _fg = np.where((fbm(Xh * .06, Yh * .06, 491) > .5)[..., None], hx('#3f8f32'), hx('#2e7a2c'))
        _fg = _fg * (1 - (np.clip((fbm(Xh * .03, Yh * .03, 493) - .55) * 4, 0, 1) * .45)[..., None]) + hx('#6aa83a') * (np.clip((fbm(Xh * .03, Yh * .03, 493) - .55) * 4, 0, 1) * .45)[..., None]
        _dg = np.where((fbm(Xh * .05, Yh * .05, 495) > .5)[..., None], hx('#b9ae5c'), hx('#a3ab4c'))          # dry grass / scrub on the lowland side
        _fw = (1 - sst(215, 301, Xh)) * .85 + sst(.0, 12, _hh) * .4
        _base = _dg * (1 - np.clip(_fw, 0, 1)[..., None]) + _fg * np.clip(_fw, 0, 1)[..., None]
        _c = np.where(_land[..., None], _base, _c)
        _rk = sst(.5, 1.1, _sl2) * sst(4, 14, _hh)
        _rc = np.where((fbm(Xh * .09, Yh * .09, 497) > .5)[..., None], hx('#9a8f7c'), hx('#7d7468'))
        _c = _c * (1 - (_rk * .85)[..., None]) + _rc * (_rk * .85)[..., None]
        _pk = sst(26, 38, _hh) * (1 - sst(.6, 1.1, _sl2))
        _c = _c * (1 - (_pk * .55)[..., None]) + hx('#a9b46a') * (_pk * .55)[..., None]
        _bch = (1 - sst(SEA + .9, SEA + 3.0, _h)) * _land
        _c = _c * (1 - (_bch * .85)[..., None]) + hx('#f0dfa8') * (_bch * .85)[..., None]
    if _H['name'] == 'fal':
        gz = sst(318, 430, Yh)
        _sl2 = slope[hs_]
        ph_ = (Xh * math.cos(.55) + Yh * math.sin(.55)) / 26.0 + 1.8 * fbm(Xh * .02, Yh * .02, 241)
        fr_ = ph_ - np.floor(ph_)
        _sand = np.where((fr_ > .72)[..., None], hx('#d9a655'), np.where((fbm(Xh * .09, Yh * .09, 255) > .55)[..., None], hx('#efc474'), hx('#e6b862')))
        _grn = np.where((fbm(Xh * .05, Yh * .05, 257) > .5)[..., None], hx('#8fae3e'), hx('#7c9c38'))
        _dryg = np.clip((fbm(Xh * .03, Yh * .03, 259) - .45) * 4, 0, 1)
        _grn = _grn * (1 - (_dryg * .5)[..., None]) + hx('#b4a55a') * (_dryg * .5)[..., None]
        _mix = np.clip(gz * 1.15 - .1, 0, 1)
        _base = _sand * (1 - _mix[..., None]) + _grn * _mix[..., None]
        _c = np.where(_land[..., None], _base, _c)
        _rk = np.where((fbm(Xh * .08, Yh * .08, 261) > .5)[..., None], hx('#b57d54'), hx('#8f6a58'))
        _rm = sst(.45, 1.0, _sl2) * (_h > SEA + 1.5) * 1.0
        _c = _c * (1 - (_rm * .9)[..., None]) + _rk * (_rm * .9)[..., None]
        _top = sst(TOPE + 12, TOPE + 22, _h) * (1 - sst(.6, 1.2, _sl2))
        _c = _c * (1 - (_top * .5)[..., None]) + hx('#d6b27c') * (_top * .5)[..., None]
        _bch = (1 - sst(SEA + .9, SEA + 3.0, _h)) * _land
        _c = _c * (1 - (_bch * .85)[..., None]) + hx('#f4e4b4') * (_bch * .85)[..., None]
        _plz = (1 - sst(14, 30, np.hypot(Xh - L['nodes']['coc_coro'][0], Yh - L['nodes']['coc_coro'][1]))) * _land
        _c = _c * (1 - (_plz * .5)[..., None]) + hx('#dccaa0') * (_plz * .5)[..., None]
    if _H['name'] == 'lla':
        # savanna: sunny yellow-green grass with drier ochre patches, darker lush green near the water, sandy banks, trampled dirt around the hacienda yards
        _g1 = np.where((fbm(Xh * .045, Yh * .045, 211) > .5)[..., None], hx('#9cc13e'), hx('#86b23a'))
        _dry = np.clip((fbm(Xh * .028, Yh * .028, 213) - .52) * 5, 0, 1) * _land
        _c = np.where(_land[..., None], _g1, _c)
        _c = _c * (1 - (_dry * .55)[..., None]) + hx('#c3b550') * (_dry * .55)[..., None]
        _lush = (1 - sst(6, 26, rdist[hs_] / 1.0)) * _land
        _c = _c * (1 - (_lush * .55)[..., None]) + hx('#4f9a36') * (_lush * .55)[..., None]
        _wetl = (1 - sst(SEA + .2, SEA + 1.8, _h)) * _land
        _bk = (1 - sst(SEA + 1.0, SEA + 3.2, _h)) * _land
        _c = _c * (1 - (_bk * .8)[..., None]) + hx('#e4cf8a') * (_bk * .8)[..., None]
        _c = _c * (1 - (_wetl * .6)[..., None]) + hx('#cdb877') * (_wetl * .6)[..., None]
        _apc = [(p_[0], p_[1] + 14 * math.sin(p_[0] * .012 + 1.0) + 7 * math.sin(p_[0] * .036)) for p_ in L['rivers']['apure']]
        _yc = min(_apc, key=lambda q_: abs(q_[0] - 1148))[1]
        _trk = dist_line([(1122, 896), (1130, 950), (1140, _yc - 70), (1148, _yc - 20), (1148, _yc + 30), (1156, _yc + 80), (1160, 1141)], Xh, Yh, step=2)
        _tm = (1 - sst(2.4, 4.6, _trk)) * _land * (_h > SEA + .4)
        _c = _c * (1 - (_tm * .92)[..., None]) + np.where((fbm(Xh * .2, Yh * .2, 231) > .55)[..., None], hx('#b98f58'), hx('#cfa86c')) * (_tm * .92)[..., None]
        _yard = (1 - sst(16, 30, np.hypot(Xh - L['nodes']['lla_hato'][0], Yh - L['nodes']['lla_hato'][1]))) * _land
        _c = _c * (1 - (_yard * .55)[..., None]) + hx('#c9a266') * (_yard * .55)[..., None]
    if _H['name'] == 'ccs':
        dmr, dmo, drq = dmin_pts(NODES_MAR, Xh, Yh), dmin_pts(NODES_MOC, Xh, Yh), dmin_pts(NODES_ROQ, Xh, Yh)
        dcc = dmin_pts([v for k, v in L['nodes'].items() if k.startswith('ccs_')], Xh, Yh)
        carz = np.maximum(np.exp(-(dcc / 300.0) ** 2), np.maximum(np.exp(-(dmr / 130.0) ** 2), np.maximum(np.exp(-(dmo / 150.0) ** 2), np.exp(-(drq / 100.0) ** 2))))
        _beach = (1 - sst(SEA + 1.0, SEA + 5.6, _h)) * _land * np.maximum(carz, .35)
        _wet = (1 - sst(SEA + .3, SEA + 1.6, _h)) * _land
        _c = _c * (1 - (_wet * .6)[..., None]) + hx('#d9c892') * (_wet * .6)[..., None]
        _c = _c * (1 - (_beach * .95)[..., None]) + hx('#efe0b0') * (_beach * .95)[..., None]
        _dry = _land & (_h > SEA + 3) & (_h < TOPE + 16) & (fbm(Xh * .06, Yh * .06, 117) > .5)
        _c = _c * (1 - (_dry * carz * .55)[..., None]) + hx('#b9a565') * (_dry * carz * .55)[..., None]
        _wr = np.exp(-(drq / 62.0) ** 2) * (_h > SEA + 1.0)
        _cayc = np.where((fbm(Xh * .11, Yh * .11, 121) > .58)[..., None], hx('#5fae4a'), hx('#f2e6c0'))
        _c = _c * (1 - (_wr * .92)[..., None]) + _cayc * (_wr * .92)[..., None]
        _c = np.where(((_wr > .4) & (_sl > .7))[..., None], hx('#8c7a62'), _c)
        LEC = L.get('lecheria')
        if LEC:
            _dl = np.hypot(Xh - LEC['c'][0], Yh - LEC['c'][1])
            _can = np.full(Xh.shape, 1e9)
            for _pl in LEC['canals']:
                _can = np.minimum(_can, dist_line([tuple(p) for p in _pl], Xh, Yh))
            _pav = (1 - sst(60, 98, _dl)) * _land
            _c = _c * (1 - (_pav * .8)[..., None]) + np.where((fbm(Xh * .08, Yh * .08, 131) > .62)[..., None], hx('#7dbd4f'), hx('#d4cdb0')) * (_pav * .8)[..., None]
            _bank = (1 - sst(4.5, 9.0, _can)) * _land
            _c = _c * (1 - (_bank * .85)[..., None]) + hx('#eadba8') * (_bank * .85)[..., None]
        _rk2 = _rock * carz
        _c = _c * (1 - (_rk2 * .75)[..., None]) + hx('#6f9a46') * (_rk2 * .75)[..., None]
    if _H['name'] not in ('can', 'can2'):
        for _t in GS.TEPUIS_X:
            _sl2 = slope[hs_]
            _hh = _h - GS.GROUND_X
            _near = np.exp(-(np.hypot((Xh - _t['c'][0]) / (_t['a'] * 1.7), (Yh - _t['c'][1]) / (_t['b'] * 2.6))) ** 2 * 1.2)
            _cl = sst(.45, 1.0, _sl2) * sst(5, 13, _hh) * (_near > .05)
            _band = fbm(Xh * .42, Yh * .42, 451)
            _ck = np.where((_band > .56)[..., None], hx('#ee9c54'), np.where((_band > .42)[..., None], hx('#c9733a'), hx('#8c4a28')))
            _ck = np.where((fbm(Xh * .09, Yh * .09, 453) > .6)[..., None], hx('#6a5560') * .55 + _ck * .45, _ck)
            _tp = sst(_t['T'] * .55, _t['T'] * .72, _hh) * (1 - sst(.55, 1.0, _sl2))
            _mo = np.where((fbm(Xh * .07, Yh * .07, 455) > .5)[..., None], hx('#86b238'), hx('#6f9a2e'))
            _mo = np.where((fbm(Xh * .05, Yh * .05, 457) > .66)[..., None], hx('#a39a48'), _mo)
            _c = _c * (1 - (_cl * .95)[..., None]) + _ck * (_cl * .95)[..., None]
            _c = _c * (1 - (_tp * .95)[..., None]) + _mo * (_tp * .95)[..., None]
    _dwt = np.exp(-(dmin_pts(NODES_DEL, Xh, Yh) / 175.0) ** 2)
    _lnd = (M1[hs_] > .45) & (h[hs_] > SEA - .3)
    _mud = (1 - sst(SEA + .6, SEA + 2.0, h[hs_])) * _lnd * _dwt
    _can = _lnd * _dwt * sst(SEA + 1.4, SEA + 2.2, h[hs_])
    _c = _c * (1 - (_can * .85)[..., None]) + np.where((fbm(Xh * .1, Yh * .1, 161) > .6)[..., None], hx('#3a7a3c'), hx('#2c6a35')) * (_can * .85)[..., None]
    _c = _c * (1 - (_mud * .9)[..., None]) + hx('#8c8752') * (_mud * .9)[..., None]
    col[hs_] = _c
# seam harmoniser: every patch (and the coarse land around them) keeps its own detail, but near a patch border its low-frequency colour is pulled to the
# blend of both sides, so palettes fade into each other instead of meeting at a hard edge
_rid = np.zeros(X.shape, np.int32)
for _k, _H in enumerate(HEROES):
    _rid[HI_(_H)] = _k + 1
_ld = (h >= SEA - .5).astype(np.float64)
_R = 26
_lowG = np.stack([box_blur(col[..., c_] * _ld, _R, 3) for c_ in range(3)], -1) / np.maximum(box_blur(_ld, _R, 3), 1e-3)[..., None]
_acc = np.zeros(X.shape + (3,))
for _k in range(len(HEROES) + 1):
    _m = (_rid == _k).astype(np.float64)
    if _m.sum() < 50:
        continue
    _mw = _m * _ld
    _den = np.maximum(box_blur(_mw, _R, 3), 1e-3)
    _lowP = np.stack([box_blur(col[..., c_] * _mw, _R, 3) for c_ in range(3)], -1) / _den[..., None]
    _inner = box_blur(_m, 36, 2)
    _wk = (1 - sst(.55, .97, _inner)) * _m * _ld
    _acc += (_lowG - _lowP) * _wk[..., None]
col = np.clip(col + _acc * .95, 0, 1)
# sea floor: turquoise shelf -> deep blue; lake darker
sea = h < SEA - .5
shelf = sst(.04, .55, M3)
sea_col = hx('#0e4aa8') * (1 - shelf[..., None]) + hx('#46d4e6') * shelf[..., None]
sea_col = sea_col * (1 - (LK * .7)[..., None]) + hx('#1a5cc8') * (LK * .7)[..., None]
lum_ = (col * np.array([.3, .59, .11])).sum(-1, keepdims=True)
col = np.clip(lum_ + (col - lum_) * 1.3, 0, 1) * 1.04     # brighter, more saturated land (diorama look)
col = np.where(sea[..., None], sea_col, col)
col = np.clip(col, 0, 1)
print('colours', round(time.time() - t0, 1))

# ───────────────────────── export grids ─────────────────────────
h7 = h[::2, ::2].astype(np.float32)          # main grid keeps hero heights too (page falls back to it outside the patch)
c7 = (col[::2, ::2] * 255).round().astype(np.uint8)
assert h7.shape == (NY, NX), (h7.shape, NY, NX)
h7.tofile(os.path.join(OUT, 'heights.f32'))
c7.tofile(os.path.join(OUT, 'colors.u8'))
META_H = []
for _H in HEROES:
    hs_ = HI_(_H)
    h[hs_].astype(np.float32).tofile(os.path.join(OUT, 'heights_hero_%s.f32' % _H['name']))
    META_H.append({'name': _H['name'], 'x0': _H['X0'], 'y0': _H['Y0'], 'nx': _H['I1'] - _H['I0'] + 1, 'ny': _H['J1'] - _H['J0'] + 1, 'cell': FC})
json.dump({'nx': NX, 'ny': NY, 'cell': CELL, 'canvas': [W, H], 'sea': SEA, 'tope': TOPE, 'heroes': META_H}, open(os.path.join(OUT, 'terrain_meta.json'), 'w'))


# ───────────────────────── vegetation placements (instanced by the page) ─────────────────────────
rng = np.random.default_rng(11)
TREES = []
STEP = 18.0
pe_all = np.full(X.shape, 1e9)
for (a, b) in L['edges']:
    pe_all = np.minimum(pe_all, dist_line([tuple(NODES[a]), tuple(NODES[b])], X, Y))
nd = np.full(X.shape, 1e9)
for nid, (nx_, ny_) in NODES.items():
    nd = np.minimum(nd, np.hypot(X - nx_, Y - ny_))


def at(a, x, y):
    return a[min(max(int(round(y / FC)), 0), FY - 1), min(max(int(round(x / FC)), 0), FX - 1)]


selva_w = Wt['gua'] + Wt['can'] + Wt['ama']
carib = Wt['ccs'] + Wt['coc'] + Wt['moc'] + Wt['mar'] + Wt['roq']
for gy in np.arange(STEP, H - STEP, STEP):
    for gx in np.arange(STEP, W - STEP, STEP):
        x, y = gx + rng.uniform(-STEP, STEP) * .5, gy + rng.uniform(-STEP, STEP) * .5
        hh = at(h, x, y)
        if hh < SEA + .7 or at(M1, x, y) < .45:
            continue
        if any(H_['X0'] - 4 < x < H_['X1'] + 4 and H_['Y0'] - 4 < y < H_['Y1'] + 4 for H_ in HEROES):        # hero patches get their own vegetation pass
            continue
        if at(nd, x, y) < 22 or at(pe_all, x, y) < 9 or at(rdist, x, y) < 4.5 or at(slope, x, y) > .75:
            continue
        sw, cw_, lw, aw, fw, dw = at(selva_w, x, y), at(carib, x, y), at(Wt['lla'], x, y), at(Wt['and'], x, y), at(Wt['fal'], x, y), at(wd, x, y)
        nzv = fbm(np.array([x * .04]), np.array([y * .04]), 77)[0]
        r = rng.random()
        kind, sc = None, 1.0
        if dw > .35:
            if r < .45 * (nzv + .3): kind, sc = 'mangle', rng.uniform(.9, 1.4)
            elif r < .6: kind, sc = 'moriche', rng.uniform(.8, 1.2)
        elif sw > .45:
            if nzv > .38 and r < .7:
                kind = ['round', 'round', 'flat', 'round', 'cone'][int(rng.random() * 5)]
                sc = rng.uniform(.9, 1.7)
        elif aw > .25 and hh < TOPE + 22:
            if nzv > .35 and r < .5: kind, sc = 'cone', rng.uniform(.6, .95)
        elif aw > .25 and hh >= TOPE + 22 and hh < TOPE + 34:
            if r < .5: kind, sc = 'frailejon', rng.uniform(.8, 1.3)
        elif fw > .3:
            if r < .09: kind, sc = 'cardon', rng.uniform(.8, 1.4)
        elif lw > .4:
            gal = at(rdist, x, y) < 16
            if gal and r < .55: kind, sc = 'round', rng.uniform(.8, 1.3)
            elif r < .035 and nzv > .45: kind, sc = 'moriche', rng.uniform(.9, 1.3)
        elif cw_ > .35:
            beach = hh < SEA + 4.2
            if beach and r < .5: kind, sc = 'coco', rng.uniform(.8, 1.25)
            elif beach and r < .62: kind, sc = ['palapa_a', 'palapa_b', 'sombrilla_coral', 'sombrilla_amarilla', 'sombrilla_teal', 'set_palapa', 'set_sombrilla', 'camastro_a', 'camastro_b', 'bar_kiosco'][int(rng.random() * 10)], 1.0
            elif nzv > .5 and r < .32: kind, sc = ['round', 'flat'][int(rng.random() * 2)], rng.uniform(.8, 1.3)
        else:
            if nzv > .55 and r < .12: kind, sc = 'round', rng.uniform(.8, 1.2)
        if kind:
            TREES.append([kind, round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(float(sc), 2)])
# hero vegetation
for _H in HEROES:
    HX0, HX1, HY0, HY1 = _H['X0'], _H['X1'], _H['Y0'], _H['Y1']
    if _H['name'] == 'ccs':
        for gy in np.arange(HY0 + 3, HY1 - 3, 6.6):
            for gx in np.arange(HX0 + 3, HX1 - 3, 6.6):
                x, y = gx + rng.uniform(-2.2, 2.2), gy + rng.uniform(-2.2, 2.2)
                hh = at(h, x, y)
                if hh < TOPE + 8.5 or at(M1, x, y) < .5 or at(nd, x, y) < 19 or at(pe_all, x, y) < 9 or at(slope, x, y) > 1.15:
                    continue
                if rng.random() < .62:
                    TREES.append([['round', 'round', 'flat', 'cone', 'round'][int(rng.random() * 5)], round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(float(rng.uniform(.85, 1.35)), 2)])
    elif _H['name'] == 'and':
        for gy in np.arange(HY0 + 3, HY1 - 3, 7.4):
            for gx in np.arange(HX0 + 3, HX1 - 3, 7.4):
                x, y = gx + rng.uniform(-2.6, 2.6), gy + rng.uniform(-2.6, 2.6)
                hh = at(h, x, y)
                if hh < SEA + 3 or at(M1, x, y) < .5 or at(nd, x, y) < 17 or at(pe_all, x, y) < 8 or at(rdist, x, y) < 4 or at(slope, x, y) > 1.5:
                    continue
                if SU.field_region(x, y) and SU.fld(int(x // SU.FIELD_W), int(y // SU.FIELD_H)) < 62 and hh < TOPE + 9 and at(slope, x, y) < .3 and at(nd, x, y) > 56 and at(pe_all, x, y) > 12 and rng.random() < .93:
                    continue                                                     # paddocks stay open
                r = rng.random()
                zwv = math.exp(-(min(math.hypot(x - q_[0], y - q_[1]) for q_ in NODES_ZUL) / 125.0) ** 2)
                if zwv > .45 and hh < TOPE + 8:
                    n1 = fbm(np.array([x * .03]), np.array([y * .03]), 307)[0]
                    kind = (('arbol_falcon' if r < .3 else 'cuji' if r < .42 else 'palma_falcon' if r < .52 else None) if n1 > .6 else
                            'cardon' if r < .03 else 'cardon_peq' if r < .06 else 'arbusto_seco' if r < .13 else 'tuna' if r < .15 else 'cuji' if r < .18 else 'roca_arida' if r < .2 else 'palma_falcon' if r < .23 else None)
                    if kind:
                        TREES.append([kind, round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(float(rng.uniform(.85, 1.3)), 2)])
                    continue
                nzv = fbm(np.array([x * .05]), np.array([y * .05]), 83)[0]
                sc = float(rng.uniform(.85, 1.35))
                kind = None
                if hh >= TOPE + 36:
                    kind = 'roca' if r < .10 else None                                  # snow zone: only boulders
                elif hh >= TOPE + 17:                                                    # páramo: frailejones, tussocks, boulders
                    kind = 'frailejon' if r < .34 else 'arbusto' if r < .56 else 'roca' if r < .66 else None
                elif hh >= TOPE + 7:                                                     # montane: pines + some broadleaf + rocks
                    kind = 'pino' if (r < .46 and nzv > .3) else 'arbol_and' if r < .56 else 'roca' if r < .64 else 'arbusto' if r < .74 else None
                else:                                                                    # valley: meadow trees and shrubs
                    kind = 'arbol_and' if (r < .10 and nzv > .45) else 'pino' if r < .13 else 'arbusto' if r < .20 else 'roca' if r < .23 else None
                if kind:
                    TREES.append([kind, round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(sc, 2)])
    elif _H['name'] == 'zul':
        for gy in np.arange(HY0 + 3, HY1 - 3, 6.0):
            for gx in np.arange(HX0 + 3, HX1 - 3, 6.0):
                x, y = gx + rng.uniform(-2.6, 2.6), gy + rng.uniform(-2.6, 2.6)
                hh = at(h, x, y)
                if hh < SEA + 1.2 or at(M1, x, y) < .3 or at(nd, x, y) < 19 or at(pe_all, x, y) < 8 or at(slope, x, y) > 1.1:
                    continue
                r = rng.random()
                sc = float(rng.uniform(.85, 1.3))
                islet = at(M1, x, y) < .62
                if islet:
                    kind = 'palma_falcon' if r < .34 else 'arbusto_seco' if r < .5 else 'arbol_falcon' if r < .56 else None
                elif hh < SEA + 3.0:
                    kind = 'palma_falcon' if r < .16 else 'arbusto_seco' if r < .21 else None
                else:
                    n1 = fbm(np.array([x * .03]), np.array([y * .03]), 289)[0]
                    kind = ('arbol_falcon' if r < .3 else 'cuji' if r < .42 else 'palma_falcon' if r < .5 else None) if n1 > .6 else \
                           'cardon' if r < .03 else 'cardon_peq' if r < .06 else 'arbusto_seco' if r < .12 else 'tuna' if r < .14 else 'cuji' if r < .165 else 'roca_arida' if r < .19 else 'palma_falcon' if r < .21 else None
                if kind:
                    TREES.append([kind, round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(sc, 2)])
    elif _H['name'] == 'fal':
        for gy in np.arange(HY0 + 3, HY1 - 3, 6.0):
            for gx in np.arange(HX0 + 3, HX1 - 3, 6.0):
                x, y = gx + rng.uniform(-2.6, 2.6), gy + rng.uniform(-2.6, 2.6)
                hh = at(h, x, y)
                if hh < SEA + 1.6 or at(M1, x, y) < .5 or at(nd, x, y) < 19 or at(pe_all, x, y) < 8 or at(slope, x, y) > 1.1:
                    continue
                gzv = min(1, max(0, (y - 318) / 112.0))
                n1 = fbm(np.array([x * .03]), np.array([y * .03]), 263)[0]
                r = rng.random()
                sc = float(rng.uniform(.85, 1.3))
                beach = hh < SEA + 3.0
                if beach:
                    kind = 'palma_falcon' if r < .12 else 'arbusto_seco' if r < .16 else None
                elif gzv < .45:                                                   # desert: cardones, scrub, tunas, rocks
                    kind = 'cardon' if r < .035 else 'cardon_peq' if r < .07 else 'arbusto_seco' if r < .13 else 'tuna' if r < .15 else 'agave' if r < .165 else 'cuji' if r < .19 else 'roca_arida' if r < .21 else None
                else:                                                             # inland green: clumps of round trees
                    if n1 > .56:
                        kind = 'arbol_falcon' if r < .52 else 'palma_falcon' if r < .62 else 'arbusto_seco' if r < .72 else None
                    else:
                        kind = 'cuji' if r < .05 else 'arbol_falcon' if r < .09 else 'palma_falcon' if r < .12 else 'arbusto_seco' if r < .2 else 'cardon_peq' if r < .23 else 'roca_arida' if r < .27 else None
                if kind:
                    TREES.append([kind, round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(sc, 2)])
    elif _H['name'] == 'lla':
        _hc = L['nodes']['lla_hato']
        for gy in np.arange(HY0 + 3, HY1 - 3, 5.6):
            for gx in np.arange(HX0 + 3, HX1 - 3, 5.6):
                x, y = gx + rng.uniform(-2.4, 2.4), gy + rng.uniform(-2.4, 2.4)
                hh = at(h, x, y)
                if hh < SEA + 1.5 or at(M1, x, y) < .5 or at(nd, x, y) < 19 or at(pe_all, x, y) < 8 or at(slope, x, y) > 1.2 or math.hypot(x - _hc[0], y - _hc[1]) < 44:
                    continue
                n1 = fbm(np.array([x * .03]), np.array([y * .03]), 221)[0]
                gal = at(rdist, x, y) < 22
                r = rng.random()
                sc = float(rng.uniform(.85, 1.35))
                if n1 > .64 or (gal and n1 > .5):                       # forest clump: dense round-crowned trees with palms and shrubs
                    kind = 'arbol_llano' if r < .36 else 'palma_llanera' if r < .46 else 'arbusto_llano' if r < .6 else 'saman' if r < .63 else None
                elif gal:                                               # gallery edge: palms, shrubs, boulders
                    kind = 'palma_llanera' if r < .09 else 'arbusto_llano' if r < .17 else 'roca_llano' if r < .21 else 'mata_llano' if r < .3 else None
                else:                                                   # open savanna: lone trees, tufts, rocks
                    kind = 'saman' if r < .012 else 'arbol_llano' if r < .04 else 'palma_llanera' if r < .075 else 'arbusto_llano' if r < .1 else 'roca_llano' if r < .115 else 'mata_llano' if r < .21 else 'matorral' if r < .235 else None
                if kind:
                    TREES.append([kind, round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(sc, 2)])
    elif _H['name'] == 'per':
        for gy in np.arange(HY0 + 3, HY1 - 3, 6.0):
            for gx in np.arange(HX0 + 3, HX1 - 3, 6.0):
                x, y = gx + rng.uniform(-2.6, 2.6), gy + rng.uniform(-2.6, 2.6)
                hh = at(h, x, y)
                if hh < SEA + 1.6 or at(M1, x, y) < .5 or at(nd, x, y) < 19 or at(pe_all, x, y) < 8 or at(slope, x, y) > 1.3 or any(math.hypot(x - q_[0], y - q_[1]) < 34 for q_ in SU.PERIJA_HAMLETS):
                    continue
                r = rng.random()
                sc = float(rng.uniform(.85, 1.35))
                fw = 1 - float(min(1, max(0, (x - 215) / 86.0)))
                if hh >= TOPE + 27:                                    # summits: boulders, shrubs, frailejones
                    kind = 'roca' if r < .12 else 'frailejon' if r < .3 else 'arbusto' if r < .46 else None
                elif hh >= TOPE + 15:                                  # cloud forest: pines among broadleaf, rocks
                    kind = 'pino' if r < .26 else 'arbol_selva' if r < .56 else 'arbusto_selva' if r < .7 else 'roca' if r < .76 else None
                elif r < fw * .86:                                     # montane rainforest
                    kind = 'arbol_selva' if r < fw * .46 else 'arbol_alto' if r < fw * .5 else 'palma_selva' if r < fw * .6 else 'platanillo' if r < fw * .66 else 'arbusto_selva' if r < fw * .74 else 'helecho' if r < fw * .82 else 'roca_selva'
                else:                                                  # dry foothills toward the lake plain
                    kind = 'arbol_falcon' if r < .90 else 'arbusto_seco' if r < .95 else 'cuji' if r < .965 else 'palma_falcon' if r < .985 else None
                if kind:
                    TREES.append([kind, round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(sc, 2)])
    elif _H['name'] in FAMN:
        for gy in np.arange(HY0 + 3, HY1 - 3, 6.0):
            for gx in np.arange(HX0 + 3, HX1 - 3, 6.0):
                x, y = gx + rng.uniform(-2.6, 2.6), gy + rng.uniform(-2.6, 2.6)
                hh = at(h, x, y)
                if hh < SEA + 1.6 or at(M1, x, y) < .5 or at(nd, x, y) < 19 or at(pe_all, x, y) < 7.5 or math.hypot(x - GS.VILLAGE[0] + 18, y - GS.VILLAGE[1]) < 36 \
                        or any(math.hypot(x - nx_, y - ny_) < nr_ for nx_, ny_, nr_ in SU.NOVEG):
                    continue
                sl_ = at(slope, x, y)
                jw_ = at(JW, x, y)
                r = rng.random()
                sc = float(rng.uniform(.85, 1.3))
                hg_ = hh - GS.GR
                if hg_ > 24 or (hg_ > 9 and sl_ < .5):                    # tepui / dome / mesa top: heath, stunted trees, rocks
                    if sl_ > .55:
                        continue
                    kind = 'arbusto_cima' if r < .34 else 'arbolito_cima' if r < .44 else 'roca_cima' if r < .5 else None
                elif sl_ > 1.0:
                    continue
                elif hg_ > 5:                                             # talus under the cliffs
                    kind = 'arbol_selva' if r < .3 else 'roca_selva' if r < .38 else 'arbusto_selva' if r < .5 else None
                elif hh < SEA + 3.2:                                      # river banks, sandbars, esteros
                    if jw_ > .5:
                        kind = 'palma_selva' if r < .22 else 'roca_rio' if r < .27 else 'helecho' if r < .36 else None
                    else:
                        kind = 'palma_llanera' if r < .16 else 'arbusto_llano' if r < .26 else 'mata_llano' if r < .42 else 'roca_rio' if r < .45 else None
                elif jw_ > .5:                                            # rainforest floor
                    kind = 'arbol_selva' if r < .50 else 'arbol_alto' if r < .545 else 'palma_selva' if r < .63 else 'platanillo' if r < .69 else 'arbusto_selva' if r < .77 else 'helecho' if r < .83 else 'roca_selva' if r < .85 else None
                else:                                                     # open savanna: lone umbrella trees, palms, tussocks, boulders
                    kind = 'arbol_llano' if r < .05 else 'saman' if r < .056 else 'palma_llanera' if r < .085 else 'matorral' if r < .13 else 'arbusto_llano' if r < .19 else 'mata_llano' if r < .30 else 'roca_llano' if r < .325 else 'roca_selva' if r < .338 else None
                if kind:
                    TREES.append([kind, round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(sc, 2)])
    elif _H['name'] == 'ord':
        for gy in np.arange(HY0 + 3, HY1 - 3, 6.4):
            for gx in np.arange(HX0 + 3, HX1 - 3, 6.4):
                x, y = gx + rng.uniform(-2.8, 2.8), gy + rng.uniform(-2.8, 2.8)
                hh = at(h, x, y)
                if hh < SEA + 1.6 or at(M1, x, y) < .5 or at(nd, x, y) < 19 or at(pe_all, x, y) < 8 or at(slope, x, y) > 1.3:
                    continue
                r = rng.random()
                kind = 'coco' if r < .18 else 'round' if r < .46 else 'flat' if r < .52 else None
                if kind:
                    TREES.append([kind, round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(float(rng.uniform(.85, 1.3)), 2)])
    else:                                                       # Delta Amacuro: dense mangrove canopy on the islands, bare roots in the shallows
        for gy in np.arange(HY0 + 3, HY1 - 3, 5.4):
            for gx in np.arange(HX0 + 3, HX1 - 3, 5.4):
                x, y = gx + rng.uniform(-2.6, 2.6), gy + rng.uniform(-2.6, 2.6)
                hh = at(h, x, y)
                if at(nd, x, y) < 15 or at(pe_all, x, y) < 6:
                    continue
                r = rng.random()
                if hh > SEA + 1.5 and at(M1, x, y) > .45:
                    kind = 'mangle' if r < .58 else 'moriche' if r < .66 else 'coco' if r < .70 else 'round' if r < .76 else None
                    if kind:
                        TREES.append([kind, round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(float(rng.uniform(.85, 1.35)), 2)])
                elif SEA - 1.6 < hh < SEA - .1 and at(M1, x, y) > .3 and r < .10:
                    TREES.append(['mangle_raices', round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), 1.0])
# north patch lowlands outside the Caracas window: Margarita / Mochima / oriental coast trees
_N = HEROES[0]
for gy in np.arange(_N['Y0'] + 3, _N['Y1'] - 3, 8.8):
    for gx in np.arange(_N['X0'] + 3, _N['X1'] - 3, 8.8):
        if CC['X0'] <= gx <= CC['X1'] and CC['Y0'] <= gy <= CC['Y1']:
            continue
        x, y = gx + rng.uniform(-3, 3), gy + rng.uniform(-3, 3)
        hh = at(h, x, y)
        if hh < SEA + 2.2 or hh > TOPE + 8.4 or at(M1, x, y) < .5 or at(nd, x, y) < 19 or at(pe_all, x, y) < 9 or at(rdist, x, y) < 4 or at(slope, x, y) > 1.2:
            continue
        if at(np.exp(-(dmin_pts(NODES_ROQ, np.array([[x]]), np.array([[y]])) / 62.0) ** 2), 0, 0) > .35:
            continue
        r = rng.random()
        nzv = fbm(np.array([x * .05]), np.array([y * .05]), 127)[0]
        if hh < SEA + 4.5:
            if r < .12: TREES.append(['uva_playa', round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), 1.0])
            elif r < .52: TREES.append(['coco', round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(float(rng.uniform(.85, 1.25)), 2)])
        elif r < .12:
            TREES.append([['arbusto_costa', 'arbusto_costa', 'cactus_costa'][int(rng.random() * 3)], round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(float(rng.uniform(.8, 1.3)), 2)])
        elif nzv > .42 and r < .55:
            TREES.append([['round', 'flat', 'round', 'cone'][int(rng.random() * 4)], round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(float(rng.uniform(.8, 1.25)), 2)])
# beach pass: dense coconut palms and beach furniture hugging the Caribbean sand
KITS = ['palapa_a', 'palapa_b', 'sombrilla_coral', 'sombrilla_amarilla', 'sombrilla_teal', 'set_palapa', 'set_sombrilla', 'camastro_a', 'camastro_b', 'bar_kiosco']
for gy in np.arange(4, H - 4, 5.0):
    for gx in np.arange(4, W - 4, 5.0):
        x, y = gx + rng.uniform(-2.2, 2.2), gy + rng.uniform(-2.2, 2.2)
        hh = at(h, x, y)
        if not (SEA + .8 < hh < SEA + 5.5):
            continue
        if at(carib, x, y) < .3 or at(wd, x, y) > .3 or at(nd, x, y) < 15 or at(pe_all, x, y) < 7 or at(rdist, x, y) < 4:
            continue
        r = rng.random()
        if r < .36:
            TREES.append(['coco', round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(float(rng.uniform(.85, 1.3)), 2)])
        elif r < .50:
            TREES.append([KITS[int(rng.random() * len(KITS))], round(float(x), 1), round(float(y), 1), round(float(rng.uniform(-.3, .3)), 2), 1.0])
for _t in GS.TEPUIS_X:                                         # Salto Ángel plateau top: heath, stunted trees, rocks
    for gy in np.arange(_t['c'][1] - _t['b'] * 1.1, _t['c'][1] + _t['b'] * 1.1, 4.6):
        for gx in np.arange(_t['c'][0] - _t['a'] * 1.1, _t['c'][0] + _t['a'] * 1.1, 4.6):
            x, y = gx + rng.uniform(-2, 2), gy + rng.uniform(-2, 2)
            if at(h, x, y) < GS.GROUND_X + _t['T'] * .72 or at(slope, x, y) > .55:
                continue
            r = rng.random()
            kind = 'arbusto_cima' if r < .34 else 'arbolito_cima' if r < .46 else 'roca_cima' if r < .52 else None
            if kind:
                TREES.append([kind, round(float(x), 1), round(float(y), 1), round(float(rng.uniform(0, 6.28)), 2), round(float(rng.uniform(.85, 1.3)), 2)])
json.dump(TREES, open(os.path.join(OUT, 'trees.json'), 'w'))
cnt = {}
for t in TREES:
    cnt[t[0]] = cnt.get(t[0], 0) + 1
print('trees', len(TREES), cnt)

# debug image: colours + hillshade
import zlib, struct
def write_png(path, arr):
    hh, ww, _ = arr.shape
    raw = b''.join(b'\x00' + arr[y].tobytes() for y in range(hh))
    def ch(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', ww, hh, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b''))
gy7, gx7 = np.gradient(h7, CELL)
shade = np.clip(.75 + (-gx7 * .6 + gy7 * .6) * .9, .45, 1.25)
img = (c7 / 255.0 * shade[..., None]).clip(0, 1)
img = np.where((h7 > SEA - .5)[..., None] | True, img, img)
write_png(os.path.join(OUT, 'terrain_debug.png'), (img * 255).astype(np.uint8))
# ───────────────────────── mesh ─────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
H7 = h7
bm = bmesh.new()
vmap = {}
keep = np.zeros((NY - 1, NX - 1), bool)
mx = np.maximum.reduce([H7[:-1, :-1], H7[:-1, 1:], H7[1:, :-1], H7[1:, 1:]])
keep = mx > SEA - .8                      # the water plane hides everything below the waterline: drop all sea cells


def vert(i, j):
    k = j * NX + i
    if k not in vmap:
        vmap[k] = bm.verts.new((i * CELL - W / 2, -(j * CELL - H / 2), float(H7[j, i])))   # canvas -> centred world (Blender Y = -three Z)
    return vmap[k]


jj, ii = np.nonzero(keep)
for j, i in zip(jj.tolist(), ii.tolist()):
    if any(i * CELL >= H_['X0'] and (i + 1) * CELL <= H_['X1'] and j * CELL >= H_['Y0'] and (j + 1) * CELL <= H_['Y1'] for H_ in HEROES):
        continue
    a, b, c, d = vert(i, j), vert(i + 1, j), vert(i, j + 1), vert(i + 1, j + 1)
    if (i + j) % 2:
        bm.faces.new((a, c, b)); bm.faces.new((b, c, d))
    else:
        bm.faces.new((a, c, d)); bm.faces.new((a, d, b))
# hero patches (fine grid)
for _H in HEROES:
    HX0, HX1, HY0, HY1, HI0, HI1, HJ0, HJ1 = _H['X0'], _H['X1'], _H['Y0'], _H['Y1'], _H['I0'], _H['I1'], _H['J0'], _H['J1']
    hv = {}

    def hvert(jf, if_, HI0=HI0, HI1=HI1, HJ0=HJ0, HJ1=HJ1, hv=hv, name=_H['name']):
        key = (jf, if_)
        if key not in hv:
            z = float(h[jf, if_])
            onb = (jf in (HJ0, HJ1)) or (if_ in (HI0, HI1))
            if onb:                                   # mid-border vertices follow the straight main edge (no cracks)
                if (jf in (HJ0, HJ1)) and (if_ - HI0) % 2 == 1:
                    z = .5 * (float(h[jf, if_ - 1]) + float(h[jf, if_ + 1]))
                elif (if_ in (HI0, HI1)) and (jf - HJ0) % 2 == 1:
                    z = .5 * (float(h[jf - 1, if_]) + float(h[jf + 1, if_]))
            v = bm.verts.new((if_ * FC - W / 2, -(jf * FC - H / 2), z))
            hv[key] = v
            vmap[('h', name, jf, if_)] = v
        return hv[key]
    for jf in range(HJ0, HJ1):
        for if_ in range(HI0, HI1):
            if max(h[jf, if_], h[jf, if_ + 1], h[jf + 1, if_], h[jf + 1, if_ + 1]) < SEA - .8:
                continue
            a, b, c, d = hvert(jf, if_), hvert(jf, if_ + 1), hvert(jf + 1, if_), hvert(jf + 1, if_ + 1)
            if (if_ + jf) % 2:
                bm.faces.new((a, c, b)); bm.faces.new((b, c, d))
            else:
                bm.faces.new((a, c, d)); bm.faces.new((a, d, b))
bm.normal_update()
for f in bm.faces:
    if f.normal.z < 0:
        f.normal_flip()
bm.verts.ensure_lookup_table()
inv = {v.index: k for k, v in zip(vmap.keys(), [vmap[k] for k in vmap])}   # filled below
order = list(vmap.keys())
mesh = bpy.data.meshes.new('terrain')
bm.to_mesh(mesh)
bm.free()
obj = bpy.data.objects.new('terrain', mesh)
bpy.context.scene.collection.objects.link(obj)
print('mesh tris', len(mesh.polygons), 'verts', len(mesh.vertices), round(time.time() - t0, 1))
# vertex k of the mesh in creation order == order[idx]
vk = order

# ── shadow casters: props listed in placements.json (optional) ──
occ = []
pp = os.path.join(OUT, 'placements.json')
if os.path.exists(pp):
    from mathutils import Matrix
    PL = json.load(open(pp))
    cache = {}
    for it in PL.get('props', []):
        if not it.get('cast', True):
            continue
        gl = os.path.join(ROOT, 'assets', 'models', it['glb'] + '.glb')
        if not os.path.exists(gl):
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=gl)
        new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
        if it.get('only'):
            keep = [o for o in new if o.name.split('.')[0] in it['only']]
            for o in new:
                if o not in keep:
                    bpy.data.objects.remove(o)
            new = keep
        x, y, z = it['x'] - W / 2, -(it['y'] - H / 2), it.get('z')
        if z is None:
            jx, iy = min(max(int(round(it['y'] / CELL)), 0), NY - 1), min(max(int(round(it['x'] / CELL)), 0), NX - 1)
            z = max(float(H7[jx, iy]), SEA)
        M = Matrix.Translation((x, y, z)) @ Matrix.Rotation(it.get('rot', 0.0), 4, 'Z') @ Matrix.Diagonal((it.get('sx', 1.0) * it.get('s', 1.0), it.get('s', 1.0), it.get('s', 1.0), 1))
        for o in new:
            if it.get('zero'):
                o.location = (0, 0, 0); o.rotation_euler = (0, 0, 0); o.scale = (1, 1, 1)
            o.parent = None
            bpy.context.view_layer.update()
            o.matrix_world = M @ o.matrix_world
        occ += new
    urbs = PL.get('urbs', [])
    srcs = {}
    for ent in urbs:
        g_ = ent[5] if len(ent) > 5 else 'urbano'
        if g_ in srcs:
            continue
        ug = os.path.join(ROOT, 'assets', 'models', g_ + '.glb')
        if not os.path.exists(ug):
            srcs[g_] = {}
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=ug)
        srcs[g_] = {o.name.split('.')[0]: o for o in bpy.data.objects if o not in before and o.type == 'MESH'}
        for o in srcs[g_].values():
            o.location = (0, 0, 0); o.rotation_euler = (0, 0, 0); o.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    for ent in urbs:
        kind, ux, uy, urot, us = ent[:5]
        so = srcs.get(ent[5] if len(ent) > 5 else 'urbano', {}).get(kind)
        if so is None:
            continue
        cp = so.copy()
        bpy.context.scene.collection.objects.link(cp)
        jx, iy = min(max(int(round(uy / CELL)), 0), NY - 1), min(max(int(round(ux / CELL)), 0), NX - 1)
        zz = float(H7[jx, iy])
        if any(H_['X0'] <= ux <= H_['X1'] and H_['Y0'] <= uy <= H_['Y1'] for H_ in HEROES):
            zz = float(h[min(max(int(round(uy / FC)), 0), FY - 1), min(max(int(round(ux / FC)), 0), FX - 1)])
        cp.matrix_world = Matrix.Translation((ux - W / 2, -(uy - H / 2), max(zz, SEA))) @ Matrix.Rotation(urot, 4, 'Z') @ Matrix.Diagonal((us, us, us, 1))
        occ.append(cp)
    for d_ in srcs.values():
        for o in d_.values():
            bpy.data.objects.remove(o)
    bpy.context.view_layer.update()
    print('shadow casters', len(occ))
bpy.context.view_layer.update()
verts_w, polys = [], []
for o in [obj] + occ:
    mw = o.matrix_world
    base = len(verts_w)
    verts_w += [mw @ v.co for v in o.data.vertices]
    for p in o.data.polygons:
        vi = [base + v for v in p.vertices]
        for k in range(1, len(vi) - 1):
            polys.append((vi[0], vi[k], vi[k + 1]))
bvh = BVHTree.FromPolygons(verts_w, polys, epsilon=0.0)
vn = [Vector((0, 0, 0)) for _ in mesh.vertices]
for p in mesh.polygons:
    for v in p.vertices:
        vn[v] += p.normal * p.area
for n in vn:
    n.normalize()
hemi = lib._hemi(14)
SUN = lib.SUN
jit = [(0, 0), (.14, 0), (-.14, 0), (0, .14), (0, -.14)]
colattr = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
AMB = 0.70
C7 = c7.reshape(-1, 3)
for i, v in enumerate(mesh.vertices):
    k = vk[i]
    if isinstance(k, tuple):
        r, g, b = col[k[2], k[3]]
    else:
        r, g, b = C7[k] / 255.0
    z = v.co.z
    if z < SEA - 0.6:
        colattr.data[i].color = (r ** 2.2, g ** 2.2, b ** 2.2, 1.0)
        continue
    n = vn[i]
    t = n.cross(Vector((0, 0, 1)) if abs(n.z) < .9 else Vector((1, 0, 0))).normalized()
    bt = n.cross(t)
    pos = v.co + n * 0.12 + Vector((0, 0, .02))
    hit = 0.0
    for (x, y, zz) in hemi:
        d = t * x + bt * y + n * zz
        res = bvh.ray_cast(pos, d, 22.0)
        if res[0] is not None:
            hit += 1.0 - 0.5 * (res[3] / 22.0)
    ao = 1.0 - 0.5 * hit / len(hemi)
    lam = max(0.0, n.dot(SUN))
    sh = 0.0
    if lam > 0:
        for (jx, jy) in jit:
            if bvh.ray_cast(pos, (SUN + Vector((jx, jy, 0))).normalized(), 600.0)[0] is not None:
                sh += 1
        sh /= len(jit)
    sun = lam * (1 - sh)
    Lm = min(1.0, (AMB * ao + (1 - AMB) * sun * (.6 + .4 * ao)) * 1.06)
    if 290 < v.co.x + W / 2 < 720 and 180 < H / 2 - v.co.y < 820:      # Zulia: towns and rigs would otherwise stamp dark blotches over the pale sand
        Lm = max(Lm, .72)
    if 1690 < v.co.x + W / 2 < 1900 and 660 < H / 2 - v.co.y < 795 and z > 14:      # Salto Ángel wall: keep the orange rock lit even on its shaded south face
        Lm = max(Lm, .84)
    tint_ = 1 - Lm
    colattr.data[i].color = (min(1, r * Lm * (1 - .05 * tint_)) ** 2.2, min(1, g * Lm * (1 - .02 * tint_)) ** 2.2, min(1, b * (Lm + tint_ * .16)) ** 2.2, 1.0)
mesh.color_attributes.active_color = colattr
mesh.color_attributes.render_color_index = 0
for p in mesh.polygons:
    p.use_smooth = False
mesh.materials.append(lib.make_material())
print('baked', round(time.time() - t0, 1))
for o in list(bpy.data.objects):
    if o is not obj:
        bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
out = os.path.join(ROOT, 'assets', 'models', 'venezuela_v2_terrain.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_materials='EXPORT',
                          export_vertex_color='ACTIVE', export_normals=False, export_texcoords=False, export_cameras=False, export_lights=False)
print('TERRAIN_V2 tris', len(mesh.polygons), 'bytes', os.path.getsize(out), 'secs', round(time.time() - t0, 1))
