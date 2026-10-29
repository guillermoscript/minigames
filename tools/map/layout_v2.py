"""Layout the 114 tiles on the warped geography: min spacing, inside the land, edge lengths in range. Writes assets/map/v2/layout.json and a debug PNG.
Run with plain python3: python3 tools/map/layout_v2.py"""
import math, json, os, sys, random, zlib, struct, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo_v2 as G

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'map', 'v2')
os.makedirs(OUT, exist_ok=True)

# --- board graph from the game data (node, region, edges, special routes) ---
js = subprocess.run(['node', '-e', "global.window=global;global.FIESTA={};require('./docs/style-lab/fiesta-mapa-venezuela.js');const m=FIESTA.MAPAS.venezuela;"
                     "console.log(JSON.stringify({n:Object.fromEntries(Object.entries(m.nodos).map(([k,v])=>[k,[v.r,v.t,v.n]])),a:m.ady,r:m.rutas}))"],
                    cwd=ROOT, capture_output=True, text=True).stdout
D = json.loads(js)
IDS = list(D['n'].keys())
assert set(IDS) == set(G.A.keys()), (set(IDS) ^ set(G.A.keys()))
EDGES = sorted({tuple(sorted((a, b))) for a, bs in D['a'].items() for b in bs if b in D['n']})

# --- geometry in canvas units ---
land = G.smooth(G.poly(G.COAST), 2)
lake = G.smooth(G.poly(G.LAKE), 2)
_lc = (sum(p[0] for p in lake) / len(lake), sum(p[1] for p in lake) / len(lake))
lake = [(_lc[0] + (p[0] - _lc[0]) * .82, _lc[1] + (p[1] - _lc[1]) * .86) for p in lake]
canal = G.poly(G.CANAL)
isl = []
for (lo, la, rx, ry, nm) in G.ISLANDS:
    pts = [(lo + rx * math.cos(a), la + ry * math.sin(a)) for a in [i * math.pi / 12 for i in range(24)]]
    isl.append((nm, G.smooth(G.poly(pts, 0.02), 1)))
rivers = {k: G.smooth_line(G.line(v), 2) for k, v in G.RIVERS.items()}
xs = [p[0] for p in land]; ys = [p[1] for p in land]
PAD = 90
MINX, MINY = min(xs) - PAD, min(ys) - PAD
W_, H_ = max(xs) + PAD - MINX, max(ys) + PAD - MINY


def sh(p):
    return (p[0] - MINX, p[1] - MINY)


land, lake, canal = [sh(p) for p in land], [sh(p) for p in lake], [sh(p) for p in canal]
isl = [(n, [sh(p) for p in pts]) for n, pts in isl]
rivers = {k: [sh(p) for p in v] for k, v in rivers.items()}

# --- land mask + distance field ---
CELL = 5.0
GW, GH = int(W_ / CELL) + 1, int(H_ / CELL) + 1


def inpoly(x, y, pts):
    c = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]; xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            c = not c
        j = i
    return c


def bbox(pts):
    return min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)


bb = {id(p): bbox(p) for p in [land, lake, canal] + [q for _, q in isl]}


def fill(pts, val, mask):
    x0, y0, x1, y1 = bb[id(pts)]
    for j in range(max(0, int(y0 / CELL)), min(GH, int(y1 / CELL) + 2)):
        for i in range(max(0, int(x0 / CELL)), min(GW, int(x1 / CELL) + 2)):
            if inpoly(i * CELL, j * CELL, pts):
                mask[j * GW + i] = val


MASK = bytearray(GW * GH)
fill(land, 1, MASK)
for _, q in isl:
    fill(q, 1, MASK)
fill(lake, 0, MASK)
fill(canal, 0, MASK)
INF = 1e9


def dist_inside():
    d = [0.0 if not MASK[i] else INF for i in range(GW * GH)]
    for j in range(GH):
        for i in range(GW):
            k = j * GW + i
            if d[k] == 0: continue
            for (di, dj, w) in ((-1, 0, 1), (0, -1, 1), (-1, -1, 1.414), (1, -1, 1.414)):
                ii, jj = i + di, j + dj
                if 0 <= ii < GW and 0 <= jj < GH: d[k] = min(d[k], d[jj * GW + ii] + w)
    for j in range(GH - 1, -1, -1):
        for i in range(GW - 1, -1, -1):
            k = j * GW + i
            if d[k] == 0: continue
            for (di, dj, w) in ((1, 0, 1), (0, 1, 1), (1, 1, 1.414), (-1, 1, 1.414)):
                ii, jj = i + di, j + dj
                if 0 <= ii < GW and 0 <= jj < GH: d[k] = min(d[k], d[jj * GW + ii] + w)
    return [v * CELL for v in d]


DIST = dist_inside()


def dsamp(x, y):
    i, j = int(round(x / CELL)), int(round(y / CELL))
    if i < 0 or j < 0 or i >= GW or j >= GH: return 0.0
    return DIST[j * GW + i]


def grad(x, y):
    return (dsamp(x + CELL, y) - dsamp(x - CELL, y), dsamp(x, y + CELL) - dsamp(x, y - CELL))


# delta distributaries: leave the Orinoco around lon -62.2 and fan NE to the coast, stopping at the shoreline
_r = random.Random(5)
_orl = rivers['orinoco']
_st = min(range(len(_orl)), key=lambda k: math.hypot(_orl[k][0] - sh(G.proj(-62.3, 8.45))[0], _orl[k][1] - sh(G.proj(-62.3, 8.45))[1]))
_oe = _orl[_st]
for k in range(8):
    ang = math.radians(-105 + k * 24 + _r.uniform(-5, 5))
    pts = [_oe]
    px, py = _oe
    for st in range(22):
        ang += _r.uniform(-.3, .3)
        px += math.cos(ang) * 11
        py += math.sin(ang) * 11
        if dsamp(px, py) < 5:
            break
        pts.append((px, py))
    if len(pts) > 3:
        rivers['delta_%d' % k] = G.smooth_line(pts, 1)
# --- node layout ---
P = {i: list(sh(G.proj(G.A[i][1], G.A[i][0]))) for i in IDS}
A0 = {i: tuple(v) for i, v in P.items()}
DMIN, EMIN, EMAX, MARGIN = 70.0, 76.0, 120.0, 22.0
L0 = 90.0
# Caracas is laid out by hand (coast row -> Ávila ridge -> valley rows) so the city reads like the reference diorama
CCS_OFF = {'ccs_maiquetia': (-215, -105), 'ccs_guaira': (-120, -125), 'ccs_galipan': (40, -115), 'ccs_arana': (-235, -20), 'ccs_metro': (-165, 45),
           'ccs_parquecentral': (-95, 60), 'ccs_sabana': (-25, 70), 'ccs_start': (45, 60), 'ccs_avila': (40, -10), 'ccs_altamira': (110, -15),
           'ccs_chacao': (175, 20), 'ccs_petare': (240, 60)}
_cx = sum(P[i][0] for i in CCS_OFF) / len(CCS_OFF)
_cy = sum(P[i][1] for i in CCS_OFF) / len(CCS_OFF)
_cy += 45
for i, (ox, oy) in CCS_OFF.items():
    P[i][0], P[i][1] = _cx + ox, _cy + oy
CCS_C = (_cx, _cy)
FIXED = set(CCS_OFF)
for i, (ox, oy) in CCS_OFF.items():
    P[i][0], P[i][1] = _cx + ox, _cy + oy
ISLN = {i for i in IDS if i.startswith(('mar_', 'roq_'))} | {'coc_morrocoy'}
random.seed(3)
SPEC0 = {tuple(sorted((r['de'], r['a']))) for r in D['r']}
for i in IDS:
    P[i][0] += random.uniform(-3, 3); P[i][1] += random.uniform(-3, 3)
for it in range(1300):
    f = {i: [0.0, 0.0] for i in IDS}
    for a in range(len(IDS)):
        for b in range(a + 1, len(IDS)):
            A_, B_ = IDS[a], IDS[b]
            dx, dy = P[B_][0] - P[A_][0], P[B_][1] - P[A_][1]
            d = math.hypot(dx, dy) + 1e-6
            if d < DMIN:
                k = (DMIN - d) * .5 / d
                f[A_][0] -= dx * k; f[A_][1] -= dy * k; f[B_][0] += dx * k; f[B_][1] += dy * k
    for (a, b) in EDGES:
        dx, dy = P[b][0] - P[a][0], P[b][1] - P[a][1]
        d = math.hypot(dx, dy) + 1e-6
        tgt = EMIN if d < EMIN else EMAX if d > EMAX else None
        if tgt:
            k = (d - tgt) * .25 / d
            f[a][0] += dx * k; f[a][1] += dy * k; f[b][0] -= dx * k; f[b][1] -= dy * k
    for (a, b) in EDGES:
        if (a, b) in SPEC0 or (b, a) in SPEC0:
            continue
        dx, dy = P[b][0] - P[a][0], P[b][1] - P[a][1]
        d = math.hypot(dx, dy) + 1e-6
        k = (d - L0) * .045 / d
        f[a][0] += dx * k; f[a][1] += dy * k; f[b][0] -= dx * k; f[b][1] -= dy * k
    for i in IDS:
        ax, ay = A0[i]
        f[i][0] += (ax - P[i][0]) * .012; f[i][1] += (ay - P[i][1]) * .012
        if i not in ISLN:
            d = dsamp(*P[i])
            if d < MARGIN:
                gx, gy = grad(*P[i])
                gl = math.hypot(gx, gy) + 1e-6
                push = (MARGIN - d) + 1
                f[i][0] += gx / gl * push; f[i][1] += gy / gl * push
        if i in FIXED:
            continue
        P[i][0] += f[i][0] * .6; P[i][1] += f[i][1] * .6

# --- uncross: greedy swaps inside a region, then a short re-relax ---
def count_cross():
    c = 0
    for k, (a, b) in enumerate(NORM):
        for (cc, d) in NORM[k + 1:]:
            if len({a, b, cc, d}) == 4 and seg_x(P[a], P[b], P[cc], P[d]): c += 1
    return c
def seg_x(p1, p2, p3, p4):
    def o(a, b, c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    return o(p1,p2,p3)*o(p1,p2,p4) < 0 and o(p3,p4,p1)*o(p3,p4,p2) < 0
SPECIAL = {tuple(sorted((r['de'], r['a']))) for r in D['r']}
NORM = [e for e in EDGES if e not in SPECIAL]
def elen_pen():
    return sum(max(0, math.hypot(P[a][0]-P[b][0], P[a][1]-P[b][1]) - 130) for a, b in NORM)
best = count_cross() * 1000 + elen_pen()
for rnd_ in range(6):
    improved = False
    for ra in set(D['n'][i][0] for i in IDS):
        mem = [i for i in IDS if D['n'][i][0] == ra and i not in FIXED]
        for x in range(len(mem)):
            for y in range(x + 1, len(mem)):
                a, b = mem[x], mem[y]
                P[a], P[b] = P[b], P[a]
                sc = count_cross() * 1000 + elen_pen()
                if sc < best - 1e-6: best = sc; improved = True
                else: P[a], P[b] = P[b], P[a]
    if not improved: break
print('after uncross swaps: crossings', count_cross())
mind = min((math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]), a, b) for a in IDS for b in IDS if a < b)
el = [(math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]), a, b) for a, b in EDGES]
print('canvas', round(W_), round(H_), 'min tile distance', round(mind[0], 1), mind[1:], 'edge len', round(min(el)[0], 1), round(max(el)[0], 1))
dry = [i for i in IDS if i not in G.CAY and dsamp(*P[i]) < 8]
print('nodes too near/outside coast:', dry)
def seg_x(p1, p2, p3, p4):
    def o(a, b, c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    return o(p1,p2,p3)*o(p1,p2,p4) < 0 and o(p3,p4,p1)*o(p3,p4,p2) < 0
SPECIAL = {tuple(sorted((r['de'], r['a']))) for r in D['r']}
NORM = [e for e in EDGES if e not in SPECIAL]
cross = [(a, b, c, d) for k, (a, b) in enumerate(NORM) for (c, d) in NORM[k+1:] if len({a, b, c, d}) == 4 and seg_x(P[a], P[b], P[c], P[d])]
print('special routes:', len(SPECIAL), 'walkable edges:', len(NORM), 'crossing walkable edges:', len(cross), cross[:12])
print('long edges:', [(a, b, round(l)) for l, a, b in sorted(el, reverse=True)[:8]])
DISCS = [[round(P[i][0], 1), round(P[i][1], 1), 40 if i.startswith('mar_') else 24] for i in IDS]

# Chama river (Mérida valley): from the massif, between the Andean tiles
_pe, _me, _ej, _sc, _lo = P['and_picoespejo'], P['and_merida'], P['and_ejido'], P['and_sancristobal'], P['and_losnevados']
_ch = [(_pe[0] + 40, _pe[1] - 45), (_me[0] + 100, _me[1] + 40), (_me[0] + 45, _me[1] + 78), (_ej[0] + 60, _ej[1] - 30), (_ej[0] + 38, _ej[1] + 62), (_sc[0] - 78, _sc[1] + 18)]
_fix = []
for (px, py) in _ch:
    for _ in range(8):
        nn = min(IDS, key=lambda i: math.hypot(P[i][0] - px, P[i][1] - py))
        dd = math.hypot(P[nn][0] - px, P[nn][1] - py)
        if dd >= 30:
            break
        px += (px - P[nn][0]) / (dd + 1e-6) * (31 - dd); py += (py - P[nn][1]) / (dd + 1e-6) * (31 - dd)
    _fix.append((px, py))
rivers['chama'] = G.smooth_line(_fix, 3)
# Lechería (next to Puerto La Cruz): marina district with canals perpendicular to the coast
_pl = P['moc_plc']
_best = None
for rr_ in range(60, 330, 8):
    for kk in range(48):
        ang_ = kk * math.pi / 24
        x_, y_ = _pl[0] + math.cos(ang_) * rr_, _pl[1] + math.sin(ang_) * rr_
        d_ = dsamp(x_, y_)
        if 22 < d_ < 70 and min(math.hypot(x_ - P[i][0], y_ - P[i][1]) for i in IDS) > 52:
            _best = (x_, y_, d_)
            break
    if _best:
        break
LECH = None
if _best:
    cx_, cy_, dd_ = _best
    gx_, gy_ = grad(cx_, cy_)
    gl_ = math.hypot(gx_, gy_) + 1e-6
    ux_, uy_ = gx_ / gl_, gy_ / gl_                       # inland direction
    tx_, ty_ = -uy_, ux_
    cans = []
    for off in (-34, 0, 34):
        p0 = (cx_ + tx_ * off - ux_ * (dd_ + 6), cy_ + ty_ * off - uy_ * (dd_ + 6))
        p1 = (cx_ + tx_ * off + ux_ * 62, cy_ + ty_ * off + uy_ * 62)
        cans.append([[round(p0[0], 1), round(p0[1], 1)], [round(p1[0], 1), round(p1[1], 1)]])
    cans.append([[round(cx_ + tx_ * -34 + ux_ * 62, 1), round(cy_ + ty_ * -34 + uy_ * 62, 1)], [round(cx_ + tx_ * 34 + ux_ * 62, 1), round(cy_ + ty_ * 34 + uy_ * 62, 1)]])
    LECH = {'c': [round(cx_, 1), round(cy_, 1)], 'u': [round(ux_, 3), round(uy_, 3)], 'canals': cans}
    print('lecheria at', LECH['c'], 'coast dist', round(dd_))
json.dump({'canvas': [round(W_, 1), round(H_, 1)], 'offset': [MINX, MINY],
           'nodes': {i: [round(P[i][0], 1), round(P[i][1], 1)] for i in IDS},
           'land': [[round(x, 1), round(y, 1)] for x, y in land], 'lake': [[round(x, 1), round(y, 1)] for x, y in lake],
           'canal': [[round(x, 1), round(y, 1)] for x, y in canal],
           'islands': {n: [[round(x, 1), round(y, 1)] for x, y in q] for n, q in isl},
           'rivers': {k: [[round(x, 1), round(y, 1)] for x, y in v] for k, v in rivers.items()},
           'avila_ridge': [[round(CCS_C[0] + dx, 1), round(CCS_C[1] - 72 + dy, 1)] for dx, dy in ((-340, 8), (-170, -2), (0, 0), (170, -6), (340, 6))],
           'lecheria': LECH,
           'discs': DISCS, 'edges': EDGES, 'special': [list(e) for e in SPECIAL]}, open(os.path.join(OUT, 'layout.json'), 'w'))


for (dx_, dy_, r_) in DISCS:
    for j in range(max(0, int((dy_ - r_) / CELL)), min(GH, int((dy_ + r_) / CELL) + 2)):
        for i in range(max(0, int((dx_ - r_) / CELL)), min(GW, int((dx_ + r_) / CELL) + 2)):
            if (i * CELL - dx_) ** 2 + (j * CELL - dy_) ** 2 <= r_ * r_: MASK[j * GW + i] = 1
json.dump({'node_region': {i: D['n'][i][0] for i in IDS}, 'node_type': {i: D['n'][i][1] for i in IDS}, 'node_name': {i: D['n'][i][2] for i in IDS}},
          open(os.path.join(OUT, 'regions.json'), 'w'), ensure_ascii=False)
# --- debug PNG ---
def png(path, w, h, px):
    raw = b''.join(b'\x00' + bytes(px[y * w * 3:(y + 1) * w * 3]) for y in range(h))
    def ch(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b''))


S = 0.5
w, h = int(W_ * S), int(H_ * S)
px = bytearray(w * h * 3)
for j in range(h):
    for i in range(w):
        gi, gj = int(i / S / CELL), int(j / S / CELL)
        on = MASK[min(gj, GH - 1) * GW + min(gi, GW - 1)]
        c = (140, 175, 95) if on else (20, 90, 185)
        px[(j * w + i) * 3:(j * w + i) * 3 + 3] = bytes(c)


def dot(x, y, r, c):
    for dj in range(-r, r + 1):
        for di in range(-r, r + 1):
            if di * di + dj * dj <= r * r:
                ii, jj = int(x * S) + di, int(y * S) + dj
                if 0 <= ii < w and 0 <= jj < h: px[(jj * w + ii) * 3:(jj * w + ii) * 3 + 3] = bytes(c)


for a, b in EDGES:
    n = int(math.hypot(P[b][0] - P[a][0], P[b][1] - P[a][1]) * S)
    for s in range(n + 1):
        t = s / max(1, n)
        dot(P[a][0] + (P[b][0] - P[a][0]) * t, P[a][1] + (P[b][1] - P[a][1]) * t, 0, (60, 40, 20))
for k, v in rivers.items():
    for (x, y) in v: dot(x, y, 1, (60, 170, 240))
reg = {'ccs': (255, 200, 0), 'coc': (120, 220, 0), 'zul': (0, 200, 200), 'and': (110, 140, 220), 'lla': (230, 190, 40), 'gua': (190, 100, 30), 'can': (30, 120, 40), 'del': (160, 90, 220), 'moc': (255, 120, 120), 'mar': (255, 120, 200), 'roq': (255, 255, 255)}
for i in IDS:
    dot(P[i][0], P[i][1], 5, reg[D['n'][i][0]])
png(os.path.join(OUT, 'layout_debug.png'), w, h, px)
