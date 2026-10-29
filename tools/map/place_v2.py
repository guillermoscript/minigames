"""Place landmarks, fauna and boats on the v2 map: each item has an anchor tile (or lon/lat), a footprint radius and a terrain mode; a small solver
searches around the anchor for the spot that keeps clear of tiles, paths, rivers and other props. Writes assets/map/v2/placements.json.
Run: python3 tools/map/place_v2.py   (after layout_v2.py and terrain_v2.py)"""
import os, sys, json, math, struct, array, random

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import geo_v2 as G

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'map', 'v2')
L = json.load(open(os.path.join(OUT, 'layout.json')))
META = json.load(open(os.path.join(OUT, 'terrain_meta.json')))
NX, NY, CELL = META['nx'], META['ny'], META['cell']
Hh = array.array('f')
Hh.frombytes(open(os.path.join(OUT, 'heights.f32'), 'rb').read())
MINX, MINY = L['offset']
NODES = L['nodes']
SEA, TOPE = 1.5, 10.0
random.seed(8)


def P2(lon, lat):
    x, y = G.proj(lon, lat)
    return x - MINX, y - MINY


HEROES = META.get('heroes', [])
HHg = {}
for _h in HEROES:
    _a = array.array('f')
    _a.frombytes(open(os.path.join(OUT, 'heights_hero_%s.f32' % _h['name']), 'rb').read())
    HHg[_h['name']] = _a


def ht(x, y):
    for _h in HEROES:
        if _h['x0'] <= x < _h['x0'] + (_h['nx'] - 1) * _h['cell'] - .01 and _h['y0'] <= y < _h['y0'] + (_h['ny'] - 1) * _h['cell'] - .01:
            fx, fy = (x - _h['x0']) / _h['cell'], (y - _h['y0']) / _h['cell']
            i, j = int(fx), int(fy)
            u, v = fx - i, fy - j
            n = _h['nx']
            k = j * n + i
            A_ = HHg[_h['name']]
            return (A_[k] * (1 - u) + A_[k + 1] * u) * (1 - v) + (A_[k + n] * (1 - u) + A_[k + n + 1] * u) * v
    fx = max(0, min(NX - 1.001, x / CELL))
    fy = max(0, min(NY - 1.001, y / CELL))
    i, j = int(fx), int(fy)
    u, v = fx - i, fy - j
    k = j * NX + i
    return (Hh[k] * (1 - u) + Hh[k + 1] * u) * (1 - v) + (Hh[k + NX] * (1 - u) + Hh[k + NX + 1] * u) * v


def segd(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0 if l2 == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
    return math.hypot(px - ax - dx * t, py - ay - dy * t)


SPECIAL = {tuple(sorted(e)) for e in L['special']}
WALK = [(NODES[a], NODES[b]) for a, b in L['edges'] if tuple(sorted((a, b))) not in SPECIAL]
RIV = [(r[i], r[i + 1], k) for k, r in L['rivers'].items() for i in range(0, len(r) - 1, 2) if i + 1 < len(r)]
RIVER_PTS = {k: v for k, v in L['rivers'].items()}


def d_nodes(x, y):
    return min(math.hypot(x - n[0], y - n[1]) for n in NODES.values())


def d_edges(x, y):
    return min(segd(x, y, a[0], a[1], b[0], b[1]) for a, b in WALK)


def d_river(x, y):
    return min(segd(x, y, a[0], a[1], b[0], b[1]) for a, b, k in RIV)


PLACED = []          # (x, y, r)


def stats(x, y, r):
    pts = [(x, y)] + [(x + math.cos(a) * r * .7, y + math.sin(a) * r * .7) for a in [i * math.pi / 3 for i in range(6)]]
    hs = [ht(*p) for p in pts]
    return hs


def ok(mode, x, y, r, clear):
    hs = stats(x, y, r)
    if mode == 'land':
        if min(hs) < SEA + 1.8 or max(hs) - min(hs) > 9:
            return False
    elif mode == 'coast':
        if not (SEA - 2.5 < hs[0] < SEA + 5):
            return False
    elif mode == 'water':
        if max(hs) > SEA - 1.2:
            return False
    elif mode == 'any':
        pass
    if mode in ('land', 'coast') and d_river(x, y) < max(5, r * .25):
        return False
    if mode != 'water' or r > 10:
        if d_nodes(x, y) < r * .5 + clear + 6:
            return False
        if mode != 'water' and d_edges(x, y) < r * .45 + clear:
            return False
    else:
        if d_nodes(x, y) < r + 10:
            return False
    for (px, py, pr) in PLACED:
        if math.hypot(x - px, y - py) < (r + pr) * .8:
            return False
    return True


def solve(anchor, r, mode='land', search=140, clear=6, scales=(1.0, .85, .7, .55), prefer=None):
    best = None
    for sc in scales:
        rr = r * sc
        for ring in range(0, int(search / 8) + 1):
            rad = ring * 8
            n = max(1, int(2 * math.pi * rad / 8))
            for k in range(n):
                a = 2 * math.pi * k / n + ring * .7
                x, y = anchor[0] + math.cos(a) * rad, anchor[1] + math.sin(a) * rad
                if prefer is not None:
                    dx, dy = x - anchor[0], y - anchor[1]
                    if dx * prefer[0] + dy * prefer[1] < -rad * .3:
                        continue
                if ok(mode, x, y, rr, clear):
                    return x, y, sc
        # try next smaller scale
    return None


items = []
SKIPPED = []


def add(glb, anchor, r, mode='land', search=140, only=None, zero=False, rot=0.0, clear=6, scales=(1.0, .85, .7, .55), extra=None, prefer=None, at=None):
    if at is not None:
        x, y, sc = at[0], at[1], at[2] if len(at) > 2 else 1.0
    else:
        res = solve(anchor, r, mode, search, clear, scales, prefer)
        if not res:
            SKIPPED.append((glb, only))
            return None
        x, y, sc = res
    PLACED.append((x, y, r * sc))
    it = {'glb': glb, 'x': round(x, 1), 'y': round(y, 1), 'rot': round(rot, 3), 's': sc}
    if only:
        it['only'] = only
    if zero:
        it['zero'] = True
    if extra:
        it.update(extra)
    items.append(it)
    return it


nd = lambda k: NODES[k]
rv = lambda k, f: RIVER_PTS[k][int(len(RIVER_PTS[k]) * f)]


def river_tangent(k, f):
    pts = RIVER_PTS[k]
    i = max(1, min(len(pts) - 2, int(len(pts) * f)))
    return math.atan2(pts[i + 1][1] - pts[i - 1][1], pts[i + 1][0] - pts[i - 1][0])


# ── Caracas: towers + plaza near the start tile, the barrio on the north slope, Ávila decoration is the terrain itself ──
# ── Andes / Guayana / Amazonas giants ──
add('andes_merida', nd('and_picoespejo'), 42, 'land', 170)
# (angel_falls_tepui prop replaced by the Salto Ángel escarpment hero relief)
# (roraima_tepui prop replaced by the Gran Sabana hero patches)
ax_, ay_ = P2(-67.45, 4.75)
add('autana_tepui', (ax_, ay_), 16, 'land', 120)
pa = P2(-67.55, 5.7)
_pa0 = (pa[0] + 55, pa[1])
_npr = min(L['rivers']['orinoco'], key=lambda p_: math.hypot(p_[0] - _pa0[0], p_[1] - _pa0[1]))
add('puerto_ayacucho', _pa0, 38, 'land', 120, only=['arboles', 'casa_1', 'casa_2', 'casa_3', 'casa_4', 'casa_5', 'churuata', 'iglesia', 'muelle'], rot=math.atan2(_npr[0] - _pa0[0], _npr[1] - _pa0[1]))     # town only: the terrain carries its own river and ground now
# ── Llanos ──
add('llanero_caballo', nd('lla_hato'), 9, 'land', 160, only=['llanero_a'], zero=True, rot=.4, extra={'anim': 'vaga', 'radio': 14})
add('llanero_caballo', nd('lla_calabozo'), 9, 'land', 160, only=['llanero_b'], zero=True, rot=2.2, extra={'anim': 'vaga', 'radio': 16})
add('llanero_caballo', nd('lla_guanare'), 9, 'land', 160, only=['llanero_a'], zero=True, rot=1.0, extra={'anim': 'vaga', 'radio': 12})
add('caballos_manada', nd('lla_mantecal'), 11, 'land', 170)
add('caballos_manada', nd('lla_acarigua'), 11, 'land', 170)
add('chiguiros', nd('lla_achaguas'), 14, 'land', 170)
add('chiguiros', nd('lla_mantecal'), 14, 'land', 190)
add('garzas_corocoras', nd('lla_sanfernando'), 14, 'land', 170)
# ── Guayana industry & rivers ──
add('represa_guri', nd('gua_guri'), 38, 'any', 170)
bx, by = nd('gua_angostura')
ang = river_tangent('orinoco', .74)
add('puente_angostura', None, 0, at=(bx + math.cos(ang) * 42, by + math.sin(ang) * 42, 0.8), rot=-ang)
add('toninas', None, 0, at=(rv('orinoco', .62)[0], rv('orinoco', .62)[1], 1.0), rot=-river_tangent('orinoco', .62), extra={'dy': .2})
add('toninas', None, 0, at=(rv('orinoco', .86)[0], rv('orinoco', .86)[1], 1.0), rot=-river_tangent('orinoco', .86), extra={'dy': .2})
# ── Delta ──
add('palafitos_warao', nd('del_mercado'), 36, 'any', 150)
add('curiaras', nd('del_espejo'), 20, 'any', 150)
add('manglares', nd('del_niebla'), 24, 'any', 150, scales=(1.0, .8))
add('garzas_corocoras', nd('del_reloj'), 14, 'any', 150)
# ── Falcón / Zulia ──
add('flamingos', nd('coc_coro'), 12, 'land', 190)
add('oil_derricks', nd('zul_cabimas'), 22, 'water', 130)
# ── Oriente / Caribe ──
add('cueva_guacharo', nd('moc_caripe'), 36, 'land', 170)
add('cacao_paria', nd('moc_paria'), 20, 'land', 130)
add('mochima_muelle', nd('moc_mochima'), 20, 'coast', 150, rot=0)
add('margarita_playa', nd('mar_elagua'), 22, 'coast', 140)
add('castillo_pampatar', nd('mar_pampatar'), 21, 'coast', 140)
add('flamingos', nd('mar_restinga'), 12, 'land', 120)
add('los_roques', nd('roq_faro'), 19, 'any', 150)
add('cayo_morrocoy', nd('coc_morrocoy'), 14, 'any', 130)
# Mochima islets
for k, (nm, s) in enumerate((('rock_l_2', 1.0), ('rock_m_2', 1.1), ('rock_s_1', 1.3), ('rock_m_1', 1.1))):
    m = nd('moc_mochima')
    add('mochima_rocks', (m[0] + 40 + k * 22, m[1] - 40 - k * 12), 11, 'water', 90, only=[nm], zero=True, rot=k * 1.7, scales=(s,), clear=2)
# ── jungle fauna ──
add('jaguar', nd('can_kavac'), 9, 'land', 170, rot=.6)
add('guacamayas', nd('can_kama'), 9, 'land', 170, rot=-.5)
add('guacamayas', P2(-66.5, 3.5), 9, 'land', 120, rot=1.4)
add('jaguar', P2(-65.6, 2.6), 9, 'land', 120, rot=2.8)
add('chiguiros', P2(-66.2, 4.4), 14, 'land', 120)
# ── more llanos life and wild animals ──
for nm, kind, extra in (('lla_barinas', 'caballos_manada', None), ('lla_guanare', 'caballos_manada', None), ('lla_calabozo', 'caballos_manada', None), ('lla_guasdualito', 'chiguiros', None),
                        ('lla_sanfernando', 'chiguiros', None), ('lla_hato', 'chiguiros', None), ('lla_mantecal', 'garzas_corocoras', None), ('lla_achaguas', 'garzas_corocoras', None)):
    add(kind, nd(nm), 14, 'land', 190)
for nm in ('lla_barinas', 'lla_achaguas', 'lla_acarigua', 'lla_pascua'):
    add('llanero_caballo', nd(nm), 9, 'land', 190, only=[random.choice(['llanero_a', 'llanero_b'])], zero=True, rot=random.uniform(0, 6), extra={'anim': 'vaga', 'radio': random.choice([10, 14, 18])})
add('flamingos', nd('zul_dabajuro'), 12, 'land', 200)
add('flamingos', nd('roq_noronqui'), 12, 'any', 160)
for (lo, la) in ((-66.0, 3.0), (-64.8, 2.0), (-65.0, 5.4), (-62.9, 4.4), (-63.8, 5.9), (-67.0, 2.2), (-66.2, 6.2)):
    add(random.choice(['jaguar', 'guacamayas', 'guacamayas', 'chiguiros']), P2(lo, la), 11, 'land', 140, rot=random.uniform(0, 6))
for f_ in (.4, .5, .7, .78, .9, .35):
    p_ = rv('orinoco', f_)
    add('toninas', None, 0, at=(p_[0], p_[1], 1.0), rot=-river_tangent('orinoco', f_), extra={'dy': .2})
# ── boats on sea routes ──
for e in L['edges']:
    a, b = e
    key = tuple(sorted(e))
    mode = None
    if key in SPECIAL:
        pass
bo = {'ferry': [], 'penero': [], 'sailboat': [], 'lancha': [], 'velero_catamaran': []}
seas = [r for r in json.loads(open(os.path.join(OUT, 'regions.json')).read()).get('sea_routes', [])]
# (ferry/boat routes are listed by the page from the rutas; here we scatter a few vessels around the Caribbean tiles)
for (anchor, kind, rot) in ((nd('mar_puntapiedras'), 'ferry', .3), (nd('mar_coche'), 'penero', 1.2), (nd('moc_plc'), 'sailboat', 2.0), (nd('roq_pista'), 'velero_catamaran', .5),
                            (nd('mar_porlamar'), 'sailboat', 3.0), (nd('moc_cumana'), 'penero', .8), (nd('coc_puertocolombia'), 'lancha', 1.5), (nd('roq_noronqui'), 'sailboat', .2)):
    add('barcos', anchor, 12, 'water', 120, only=[kind], zero=True, rot=rot, clear=2, scales=(1.0,))


# ── city fill: scatter the urbano kit (edif_*, torre_*, casa_*, barrio_*, iglesia, galpon, rancho) around every settlement ──
URB = []
EDIF = ['edif_a', 'edif_b', 'edif_c', 'edif_d', 'edif_e', 'edif_f']
TORRE = ['torre_a', 'torre_b', 'torre_c']
CASA = ['casa_a', 'casa_b', 'casa_c', 'casa_d', 'casa_e']
BARRIO = ['barrio_a', 'barrio_b', 'barrio_c', 'barrio_d']
RANCHO = ['rancho']
CITIES = [  # nodes, radius, density, core, mid, edge
    (['zul_maracaibo', 'zul_gaita', 'zul_sanfrancisco', 'zul_puente'], 120, .85, TORRE[:2] + EDIF, EDIF + CASA, CASA + BARRIO),
    (['coc_valencia'], 95, .8, TORRE[:1] + EDIF, EDIF + CASA, CASA + ['galpon']),
    (['coc_maracay', 'coc_tejerias'], 95, .75, EDIF, EDIF + CASA, CASA),
    (['coc_barquisimeto'], 90, .75, TORRE[:1] + EDIF, EDIF + CASA, CASA),
    (['and_merida', 'and_ejido'], 95, .75, EDIF[:3], CASA + ['iglesia_a'], CASA + BARRIO),
    (['gua_cbolivar', 'gua_angostura'], 90, .7, EDIF[:3], CASA + EDIF[:2], CASA + ['iglesia_a']),
    (['gua_pordaz', 'gua_sanfelix', 'gua_llovizna'], 95, .7, EDIF[:2] + ['galpon'], CASA + ['galpon'], CASA + BARRIO),
    (['moc_barcelona', 'moc_plc'], 90, .75, TORRE[:1] + EDIF[:3], EDIF + CASA, CASA),
    (['moc_cumana'], 70, .7, EDIF[:3], CASA, CASA),
    (['moc_maturin'], 70, .65, EDIF[:3], CASA, CASA),
    (['and_sancristobal', 'and_sanantonio'], 85, .7, EDIF[:3], CASA, CASA + BARRIO),
    (['mar_porlamar', 'mar_pampatar', 'mar_asuncion'], 90, .6, EDIF[:3], CASA, CASA),
    (['coc_coro'], 70, .55, CASA, CASA + ['iglesia_a'], CASA),
    (['coc_puertocabello', 'coc_sanfelipe', 'and_valera', 'lla_acarigua', 'lla_guanare', 'lla_barinas', 'lla_sanfernando', 'lla_calabozo', 'lla_sanjuan', 'and_carora',
      'gua_eltigre', 'gua_upata', 'zul_cabimas', 'zul_ojeda', 'zul_lagunillas', 'moc_carupano', 'zul_machiques', 'ccs_galipan', 'moc_higuerote', 'moc_guarenas', 'moc_uchire'], 60, .55, CASA, CASA + ['iglesia_b'], CASA),
    (['lla_guasdualito', 'lla_mantecal', 'lla_achaguas', 'lla_pascua', 'gua_caicara', 'gua_elcallao', 'can_santaelena', 'can_kama', 'zul_encontrados', 'zul_dabajuro', 'and_timotes', 'and_mucuchies'], 50, .5, RANCHO, RANCHO + CASA, RANCHO),
]


def land_ok(x, y, steep=5.0):
    hs = stats(x, y, 4)
    return min(hs) >= SEA + 1.8 and max(hs) - min(hs) <= steep


rngc = random.Random(21)
for (nodes, R, dens, core, mid, edge) in CITIES:
    nodes = [n for n in nodes if n in NODES]
    if not nodes:
        continue
    cx = sum(NODES[n][0] for n in nodes) / len(nodes)
    cy = sum(NODES[n][1] for n in nodes) / len(nodes)
    n_try = int(R * R * 3.14 / 150 * dens * 1.3)
    taken = []
    for t in range(n_try):
        a = rngc.uniform(0, 6.2832)
        d = R * math.sqrt(rngc.random())
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        # distance to the nearest member node controls density: dense near tiles
        dn = min(math.hypot(x - NODES[n][0], y - NODES[n][1]) for n in nodes)
        p = max(0.0, 1 - dn / R) ** 1.1 * dens * .8 + .03
        if rngc.random() > p * 1.2:
            continue
        zone = dn / R
        kinds = core if zone < .38 else mid if zone < .7 else edge
        kind = rngc.choice(kinds)
        hh = ht(x, y)
        steep = 9.5 if kind.startswith('barrio') else 5.0
        if kind.startswith('barrio') and hh < TOPE + 3 and not kind in edge:
            continue
        if not land_ok(x, y, steep):
            continue
        if d_nodes(x, y) < 27 or d_edges(x, y) < 15 or d_river(x, y) < 8:
            continue
        if any(math.hypot(x - px, y - py) < (9 if kind.startswith(('edif', 'torre', 'galpon', 'iglesia')) else 7.5) for (px, py, _) in taken):
            continue
        if any(math.hypot(x - px, y - py) < pr * .9 + 5 for (px, py, pr) in PLACED):
            continue
        taken.append((x, y, 0))
        rot = rngc.choice([0, 0, 0, math.pi / 2, -math.pi / 2, 0.0, math.pi / 2])
        if kind.startswith('barrio'):
            rot = rngc.choice([0, math.pi / 2])
        URB.append([kind, round(x, 1), round(y, 1), round(rot, 3), 1.0])
print('urbs', len(URB))


# ── boats scattered in the Caribbean water ──
BOATS = []
rngb = random.Random(5)
anchors = ['mar_juangriego', 'mar_elagua', 'mar_pampatar', 'mar_porlamar', 'mar_coche', 'mar_macanao', 'moc_mochima', 'moc_plc', 'moc_cumana', 'moc_carupano', 'moc_higuerote', 'roq_pista', 'roq_francisqui',
           'roq_crasqui', 'roq_noronqui', 'coc_morrocoy', 'coc_puertocolombia', 'ccs_guaira', 'coc_puertocabello', 'zul_altagracia']
kinds = ['sailboat', 'penero', 'penero', 'sailboat', 'velero_catamaran', 'lancha', 'ferry']
for an in anchors:
    ax, ay = NODES[an]
    got = 0
    for t in range(400):
        if got >= 3:
            break
        a = rngb.uniform(0, 6.283)
        d = rngb.uniform(26, 85)
        x, y = ax + math.cos(a) * d, ay + math.sin(a) * d
        if ht(x, y) > SEA - 1.5:
            continue
        ring = [ht(x + math.cos(b) * 12, y + math.sin(b) * 12) for b in [i * .785 for i in range(8)]]
        far = [ht(x + math.cos(b) * 55, y + math.sin(b) * 55) for b in [i * .785 for i in range(8)]]
        if max(ring) > SEA - .5 or max(far) < SEA + 1:
            continue
        if any(math.hypot(x - q[1], y - q[2]) < 22 for q in BOATS):
            continue
        if d_nodes(x, y) < 18:
            continue
        kind = rngb.choice(kinds if an.startswith(('mar_', 'moc_plc', 'moc_cumana')) else kinds[:6])
        if kind == 'ferry' and any(b[0] == 'ferry' for b in BOATS):
            kind = 'sailboat'
        BOATS.append([kind, round(x, 1), round(y, 1), round(rngb.uniform(0, 6.283), 2), 1.7 if kind != 'ferry' else 1.4])
        got += 1
print('boats', len(BOATS))


# ── CARACAS hero fill: landmarks, street-aligned blocks, barrios on the slopes, palms/trees (kits: ccs_landmarks + ccs_city) ──
def hash2(ix, iy, sd=0):
    h_ = (ix * 374761393 + iy * 668265263 + sd * 982451653) & 0xFFFFFFFF
    h_ = ((h_ ^ (h_ >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h_ ^ (h_ >> 16)) & 0xFFFFFFFF) / 4294967296.0


CCS_NODES = [k for k in NODES if k.startswith('ccs_')]
pcn, stn = NODES['ccs_parquecentral'], NODES['ccs_start']
center = ((pcn[0] + stn[0]) / 2, (pcn[1] + stn[1]) / 2 + 20)
CITY = []            # [kind, x, y, rot, scale, glb]
LM = [('torre_pc_a', (pcn[0], pcn[1] + 55), 12), ('torre_pc_b', (pcn[0], pcn[1] + 55), 12), ('teatro_teresa_carreno', (NODES['ccs_sabana'][0], NODES['ccs_sabana'][1] + 60), 28),
      ('capitolio', (stn[0] + 20, stn[1] + 60), 26), ('iglesia_catedral', (NODES['ccs_arana'][0], NODES['ccs_arana'][1] + 70), 20),
      ('centro_comercial', (NODES['ccs_altamira'][0], NODES['ccs_altamira'][1] + 70), 28), ('estadio', (NODES['ccs_petare'][0] - 20, NODES['ccs_petare'][1] + 80), 28),
      ('hotel_alba', (NODES['ccs_chacao'][0], NODES['ccs_chacao'][1] + 60), 18), ('torre_oficina_a', (NODES['ccs_metro'][0], NODES['ccs_metro'][1] + 60), 12),
      ('torre_oficina_b', (stn[0] - 40, stn[1] + 80), 12), ('torre_oficina_c', (NODES['ccs_altamira'][0] + 40, NODES['ccs_altamira'][1] + 60), 12),
      ('torre_telefonica', (stn[0] + 60, stn[1] + 40), 8)]
for nm, anc, R in LM:
    it = add('ccs_landmarks', anc, R, 'land', 150, only=[nm], zero=True, clear=3, scales=(1.0, .9, .8, .7))
    if it:
        items.remove(it)
        CITY.append([nm, it['x'], it['y'], 0.0, it['s'], 'ccs_landmarks'])


def rect_ok(cx, cy, hw, hd, nclear=11, eclear=5):
    pts = [(cx + a * hw, cy + b * hd) for a in (-1, 0, 1) for b in (-1, 0, 1)]
    return all(d_nodes(*p) >= nclear and d_edges(*p) >= eclear and d_river(*p) >= 5 for p in pts)


def flat_ok(x, y, tol=3.2):
    hs = [ht(x + dx, y + dy) for dx, dy in ((0, 0), (8, 0), (-8, 0), (0, 7), (0, -7))]
    return min(hs) > SEA + 3.0 and max(hs) - min(hs) < tol and hs[0] < TOPE + 6.5


EDIF = ['edif_%02d' % k for k in range(1, 17)]
TORRE = ['torre_%02d' % k for k in range(1, 5)]
CASA = ['casa_%02d' % k for k in range(1, 7)]
BARRIO = ['barrio_%02d' % k for k in range(1, 15)]
rngx = random.Random(77)
_hc = [h_ for h_ in HEROES if h_['name'] == 'ccs'][0]
bx0, bx1 = _hc['x0'], _hc['x0'] + (_hc['nx'] - 1) * _hc['cell']
by0, by1 = _hc['y0'], _hc['y0'] + (_hc['ny'] - 1) * _hc['cell']
bx0, bx1 = max(bx0, center[0] - 430), min(bx1, center[0] + 430)
by0, by1 = max(by0, center[1] - 340), min(by1, center[1] + 330)
# elevated highway along the street row with the longest clear run (deck 9 above the ground, pieces 24 long)
best = None
for bj in range(int(by0 // 22) + 1, int(by1 // 22)):
    yy = bj * 22 + 1.7
    run, bestrun, start = [], [], None
    x = bx0 + 30
    cur = []
    while x < bx1 - 30:
        okp = flat_ok(x, yy, 3.0) and d_nodes(x, yy) >= 20 and d_edges(x, yy) >= 7 and d_river(x, yy) >= 6
        if okp:
            cur.append(x)
        else:
            if len(cur) > len(bestrun):
                bestrun = cur
            cur = []
        x += 24
    if len(cur) > len(bestrun):
        bestrun = cur
    if best is None or len(bestrun) > len(best[1]):
        best = (yy, bestrun)
if best and len(best[1]) >= 3:
    for hx in best[1]:
        CITY.append(['autopista_recta', round(hx, 1), round(best[0], 1), 0.0, 1.0, 'ccs_city'])
        PLACED.append((hx, best[0], 5))
    print('highway pieces', len(best[1]), 'row y', best[0])
PARKS = []
for bj in range(int(by0 // 22), int(by1 // 22) + 1):
    for bi in range(int(bx0 // 26), int(bx1 // 26) + 1):
        cx, cy = bi * 26 + 5.2 + 10.4, bj * 22 + 5.0 + 8.5
        if not (bx0 + 14 < cx < bx1 - 14 and by0 + 12 < cy < by1 - 12):
            continue
        if math.hypot(cx - center[0], cy - center[1]) > 335:
            continue
        if not flat_ok(cx, cy):
            continue
        if not rect_ok(cx, cy, 10.2, 8.2):
            for (ox, oy) in ((-5.5, -4.2), (5.5, -4.2), (-5.5, 4.2), (5.5, 4.2)):      # blocks cut by a board path: fill the free quarters with small houses
                qx, qy = cx + ox, cy + oy
                if d_nodes(qx, qy) >= 13 and d_edges(qx, qy) >= 6 and d_river(qx, qy) >= 5 and rngx.random() < .85:
                    CITY.append([rngx.choice(CASA), round(qx, 1), round(qy, 1), rngx.choice([0, math.pi / 2]), 1.0, 'ccs_city'])
            continue
        if any(math.hypot(cx - px, cy - py) < pr * .85 + 11 for (px, py, pr) in PLACED):
            continue
        dc = math.hypot(cx - center[0], cy - center[1])
        if hash2(bi, bj, 41) > .76:                       # park block (green in the terrain colours)
            PARKS.append((cx, cy))
            continue
        r = rngx.random()
        if dc < 150 and r < .35:
            CITY.append([rngx.choice(TORRE), round(cx + rngx.uniform(-1, 1), 1), round(cy + rngx.uniform(-1, 1), 1), rngx.choice([0, 0, math.pi / 2, -math.pi / 2]), 1.0, 'ccs_city'])
        elif dc < 330 and r < .85:
            CITY.append([rngx.choice(EDIF), round(cx + rngx.uniform(-1, 1), 1), round(cy + rngx.uniform(-1, 1), 1), rngx.choice([0, 0, math.pi / 2, -math.pi / 2, math.pi]), 1.0, 'ccs_city'])
        else:
            for (ox, oy) in ((-5, -4), (5, -4), (-5, 4), (5, 4)):
                if rngx.random() < .8:
                    CITY.append([rngx.choice(CASA), round(cx + ox, 1), round(cy + oy, 1), rngx.choice([0, math.pi / 2]), 1.0, 'ccs_city'])
        # corner palms
        for (ox, oy) in ((-11, -9), (11, -9), (-11, 9), (11, 9)):
            if rngx.random() < .45:
                CITY.append([rngx.choice(['palma_s', 'palma_m', 'palma_l']), round(cx + ox, 1), round(cy + oy, 1), rngx.uniform(0, 6.28), 1.0, 'ccs_city'])
for (cx, cy) in PARKS:
    for (ox, oy) in ((-6, -4), (5, -5), (0, 5), (7, 4), (-7, 5)):
        CITY.append([rngx.choice(['arbol_a', 'arbol_b', 'arbol_c', 'palma_m']), round(cx + ox, 1), round(cy + oy, 1), rngx.uniform(0, 6.28), rngx.uniform(.9, 1.2), 'ccs_city'])
# barrios: dense colourful houses on the mid slopes, fronts facing downhill
BARR = []
y = by0 + 10
while y < by1 - 10:
    x = bx0 + 10
    while x < bx1 - 10:
        px_, py_ = x + rngx.uniform(-2.4, 2.4), y + rngx.uniform(-2.4, 2.4)
        hh = ht(px_, py_)
        sl = math.hypot(ht(px_ + 3, py_) - ht(px_ - 3, py_), ht(px_, py_ + 3) - ht(px_, py_ - 3)) / 6
        if TOPE + 3.2 < hh < TOPE + 20 and .14 < sl < .9 and rngx.random() < .85 and math.hypot(px_ - center[0], py_ - center[1]) < 390:
            if d_nodes(px_, py_) >= 15 and d_edges(px_, py_) >= 9 and d_river(px_, py_) >= 6 and not any(math.hypot(px_ - q[0], py_ - q[1]) < q[2] * .9 + 7 for q in PLACED):
                gx_ = ht(px_ + 3, py_) - ht(px_ - 3, py_)
                gy_ = ht(px_, py_ + 3) - ht(px_, py_ - 3)
                ang = math.atan2(gx_, gy_)               # downhill is -gradient; front (-Y after yaw) -> pick the nearest cardinal
                rot = round(ang / (math.pi / 2)) * (math.pi / 2)
                if rngx.random() < .72:
                    CITY.append([rngx.choice(BARRIO), round(px_, 1), round(py_, 1), rot, rngx.uniform(.95, 1.1), 'ccs_city'])
                BARR.append((px_, py_))
        x += 6.4
    y += 6.0
URB.extend(CITY)
# drop forest trees that would poke through barrios / city
trees_path = os.path.join(OUT, 'trees.json')
if os.path.exists(trees_path):
    tj = json.load(open(trees_path))
    keep = []
    for t in tj:
        if bx0 < t[1] < bx1 and by0 < t[2] < by1 and any(abs(t[1] - bx_) < 5 and abs(t[2] - by_) < 5 for (bx_, by_) in BARR):
            continue
        keep.append(t)
    json.dump(keep, open(trees_path, 'w'))
print('caracas city items', len(CITY), 'barrios', len(BARR), 'parks', len(PARKS))


# ── ANDES hero fill (kit: andes_kit): colonial villages, church + plaza, stations, waterfalls, rapids, stone bridge, farms, cows ──
AND = []
rnga = random.Random(91)
CASA_AND = ['casa_and_%02d' % k for k in range(1, 9)]


def flat_a(x, y, tol=4.0):
    hs = [ht(x + dx, y + dy) for dx, dy in ((0, 0), (6, 0), (-6, 0), (0, 6), (0, -6))]
    return min(hs) > SEA + 2.5 and max(hs) - min(hs) < tol and hs[0] < TOPE + 17


VILL = [('and_merida', 105, 34), ('and_ejido', 80, 24), ('and_sancristobal', 85, 26), ('and_sanantonio', 70, 18), ('and_losnevados', 60, 14), ('and_timotes', 60, 14),
        ('and_mucuchies', 60, 14), ('and_valera', 75, 20), ('and_aguila', 45, 8), ('and_carora', 60, 14), ('and_elvigia', 70, 18)]
for nm, R, ncasas in VILL:
    cx, cy = NODES[nm]
    got, tries = 0, 0
    while got < ncasas and tries < ncasas * 40:
        tries += 1
        a = rnga.uniform(0, 6.283)
        d = 22 + (R - 22) * math.sqrt(rnga.random())
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        if not flat_a(x, y) or d_nodes(x, y) < 17 or d_edges(x, y) < 9 or d_river(x, y) < 7:
            continue
        if any(math.hypot(x - q[1], y - q[2]) < 12 for q in AND) or any(math.hypot(x - px, y - py) < pr * .9 + 8 for (px, py, pr) in PLACED):
            continue
        face = round(math.atan2(cx - x, cy - y) / (math.pi / 2)) * (math.pi / 2)      # front toward the plaza (tile)
        AND.append([rnga.choice(CASA_AND), round(x, 1), round(y, 1), face, rnga.uniform(.95, 1.1), 'andes_kit'])
        got += 1
# church + plaza + inn (solver keeps them clear of tiles/paths)
for nm, anc, R in (('iglesia_and', NODES['and_merida'], 14), ('plaza_and', NODES['and_merida'], 12), ('posada', NODES['and_ejido'], 12)):
    it = add('andes_kit', (anc[0] + 10, anc[1] + 30), R, 'land', 130, only=[nm], zero=True, clear=3, scales=(1.0, .9))
    if it:
        items.remove(it)
        AND.append([nm, it['x'], it['y'], 0.0, it['s'], 'andes_kit'])
# cable-car stations
it = add('andes_kit', NODES['and_picoespejo'], 8, 'land', 70, only=['estacion_cima'], zero=True, clear=1, scales=(1.0,))
if it:
    items.remove(it)
    AND.append(['estacion_cima', it['x'], it['y'], 0.0, 1.0, 'andes_kit'])
it = add('andes_kit', NODES['and_merida'], 8, 'land', 90, only=['estacion_valle'], zero=True, clear=1, scales=(1.0,))
if it:
    items.remove(it)
    AND.append(['estacion_valle', it['x'], it['y'], 0.0, 1.0, 'andes_kit'])
# farms + terraces on the mid slopes near villages
for nm in ('and_mucuchies', 'and_timotes', 'and_valera', 'and_carora', 'and_aguila'):
    for kind in ('finca', 'terraza_cultivo', 'terraza_cultivo'):
        it = add('andes_kit', NODES[nm], 11, 'land', 150, only=[kind], zero=True, clear=3, scales=(1.0, .9, .8), rot=rnga.choice([0, math.pi / 2]))
        if it:
            items.remove(it)
            AND.append([kind, it['x'], it['y'], it['rot'], it['s'], 'andes_kit'])
# river features along the Chama: two waterfalls at the steepest drops, rapids in between
ch = L['rivers'].get('chama', [])
if len(ch) > 6:
    seg = []
    for k in range(2, len(ch) - 2, 2):
        a, b = ch[k - 2], ch[k + 2]
        dh = ht(a[0], a[1]) - ht(b[0], b[1])
        seg.append((dh, k))
    used = []
    for dh, k in sorted(seg, reverse=True)[:6]:
        if dh < 2.0 or any(abs(k - u) < 14 for u in used):
            continue
        used.append(k)
        p, q = ch[k - 1], ch[k + 1]
        rot = math.atan2(q[0] - p[0], q[1] - p[1])
        AND.append(['cascada_pieza', round(ch[k][0], 1), round(ch[k][1], 1), rot, 1.0, 'andes_kit'])
        if len(used) >= 2:
            break
    for k in range(6, len(ch) - 6, 12):
        if any(abs(k - u) < 8 for u in used):
            continue
        p, q = ch[k - 1], ch[k + 1]
        AND.append(['rapidos_pieza', round(ch[k][0], 1), round(ch[k][1], 1), math.atan2(q[0] - p[0], q[1] - p[1]), 1.0, 'andes_kit'])
# stone bridge where a walking path crosses the river
def seg_inter(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-6:
        return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    return (t, u) if 0 < t < 1 and 0 < u < 1 else None
done_b = 0
for (a_, b_) in L['edges']:
    if done_b >= 2 or tuple(sorted((a_, b_))) in SPECIAL or not (a_.startswith('and_') or b_.startswith('and_')):
        continue
    for i in range(len(ch) - 1):
        hit = seg_inter(NODES[a_], NODES[b_], ch[i], ch[i + 1])
        if hit:
            x = NODES[a_][0] + (NODES[b_][0] - NODES[a_][0]) * hit[0]
            y = NODES[a_][1] + (NODES[b_][1] - NODES[a_][1]) * hit[0]
            AND.append(['puente_piedra', round(x, 1), round(y, 1), -math.atan2(NODES[b_][1] - NODES[a_][1], NODES[b_][0] - NODES[a_][0]), 1.15, 'andes_kit'])
            done_b += 1
            break
# cows grazing in the meadows
for k in range(10):
    nm = rnga.choice(['and_merida', 'and_ejido', 'and_sancristobal', 'and_sanantonio'])
    for t in range(60):
        a = rnga.uniform(0, 6.283); d = rnga.uniform(45, 110)
        x, y = NODES[nm][0] + math.cos(a) * d, NODES[nm][1] + math.sin(a) * d
        if flat_a(x, y, 2.5) and d_nodes(x, y) > 16 and d_edges(x, y) > 8 and d_river(x, y) > 8 and ht(x, y) < TOPE + 6:
            items.append({'glb': 'hato_llanos', 'x': round(x, 1), 'y': round(y, 1), 'rot': round(rnga.uniform(0, 6.28), 2), 's': 1.0, 'only': ['cow_%d' % rnga.randint(1, 4)], 'zero': True, 'anim': 'vaga', 'radio': 6})
            break
URB.extend(AND)
print('andes items', len(AND))


# ── CARIBBEAN / ORIENTAL fill (kit: caribe_kit): colonial harbour towns, churches, lighthouse, forts, islets, cays, rocks, beach houses ──
CAR = []
rngc2 = random.Random(131)
CASA_CAR = ['casa_car_%02d' % k for k in range(1, 13)]
CASA_PLAYA = ['casa_playa_%02d' % k for k in range(1, 7)]


def sea_dir(x, y, r=34):
    best, bd = None, 1e9
    for k in range(16):
        a = k * math.pi / 8
        hh = ht(x + math.cos(a) * r, y + math.sin(a) * r)
        if hh < bd:
            bd, best = hh, a
    return best, bd


def town(node, R, n, kinds, glb='caribe_kit', rows=True):
    cx, cy = NODES[node]
    got, tries = 0, 0
    while got < n and tries < n * 50:
        tries += 1
        a = rngc2.uniform(0, 6.283)
        d = 20 + (R - 20) * math.sqrt(rngc2.random())
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        hh = ht(x, y)
        if not (SEA + 2.2 < hh < TOPE + 6) or d_nodes(x, y) < 16 or d_edges(x, y) < 9 or d_river(x, y) < 6:
            continue
        hs = [ht(x + dx, y + dy) for dx, dy in ((6, 0), (-6, 0), (0, 6), (0, -6))]
        if max(hs) - min(hs) > 4.5:
            continue
        if any(math.hypot(x - q[1], y - q[2]) < 11.5 for q in CAR) or any(math.hypot(x - px, y - py) < pr * .9 + 8 for (px, py, pr) in PLACED):
            continue
        ang, bd = sea_dir(x, y)
        rot = round(((ang - math.pi / 2) % (2 * math.pi)) / (math.pi / 2)) * (math.pi / 2) if bd < SEA + 3 else rngc2.choice([0, math.pi / 2])
        CAR.append([rngc2.choice(kinds), round(x, 1), round(y, 1), rot, rngc2.uniform(.95, 1.08), glb])
        got += 1


for nd_, R_, n_ in (('mar_porlamar', 95, 30), ('mar_pampatar', 85, 22), ('mar_asuncion', 85, 22), ('mar_juangriego', 80, 18), ('mar_elagua', 70, 12), ('mar_puntapiedras', 65, 10),
                    ('moc_cumana', 95, 30), ('moc_carupano', 85, 22), ('moc_plc', 90, 26), ('moc_barcelona', 85, 22), ('moc_mochima', 75, 14), ('moc_paria', 65, 10),
                    ('moc_higuerote', 75, 14), ('moc_uchire', 60, 10), ('moc_maturin', 85, 18), ('moc_caripe', 60, 8)):
    town(nd_, R_, n_, CASA_CAR if nd_ not in ('moc_mochima', 'mar_elagua', 'moc_paria') else CASA_PLAYA + CASA_CAR[:4])
# churches / chapels / lighthouse / fort via the solver
for nd_, kind, R_ in (('mar_asuncion', 'iglesia_car', 14), ('moc_cumana', 'iglesia_car', 14), ('moc_carupano', 'iglesia_car', 14), ('moc_plc', 'capilla_car', 8), ('moc_barcelona', 'iglesia_car', 14),
                      ('mar_juangriego', 'capilla_car', 8), ('mar_pampatar', 'capilla_car', 8), ('moc_mochima', 'capilla_car', 8)):
    it = add('caribe_kit', (NODES[nd_][0], NODES[nd_][1] + 25), R_, 'land', 120, only=[kind], zero=True, clear=3, scales=(1.0, .9))
    if it:
        items.remove(it)
        CAR.append([kind, it['x'], it['y'], 0.0, it['s'], 'caribe_kit'])
for nd_, R_ in (('roq_faro', 11), ('mar_juangriego', 11), ('moc_mochima', 11)):
    it = add('caribe_kit', (NODES[nd_][0] + 20, NODES[nd_][1] - 20), R_, 'land', 130, only=['faro'], zero=True, clear=3, scales=(1.0, .9))
    if it:
        items.remove(it)
        CAR.append(['faro', it['x'], it['y'], 0.0, it['s'], 'caribe_kit'])
it = add('caribe_kit', (NODES['mar_pampatar'][0], NODES['mar_pampatar'][1] - 60), 19, 'water', 120, only=['fuerte_estrella'], zero=True, clear=2, scales=(1.0, .85))
if it:
    items.remove(it)
    CAR.append(['fuerte_estrella', it['x'], it['y'], 0.0, it['s'], 'caribe_kit'])
# islets, sea rocks and sand cays in the shallows around the Caribbean tiles
for nd_, kind, R_, k_ in [(n_, 'islote_%02d' % (1 + i % 6), 11, 0) for i, n_ in enumerate(['mar_juangriego', 'mar_macanao', 'mar_coche', 'moc_mochima', 'moc_cumana', 'moc_plc', 'mar_restinga', 'moc_carupano', 'roq_pista', 'roq_noronqui', 'mar_puntapiedras', 'moc_higuerote'])]:
    it = add('caribe_kit', NODES[nd_], R_, 'water', 150, only=[kind], zero=True, clear=2, scales=(1.0, .9), rot=rngc2.uniform(0, 6.28))
    if it:
        items.remove(it)
        CAR.append([kind, it['x'], it['y'], it['rot'], it['s'] * 1.35, 'caribe_kit'])
for i in range(46):
    nd_ = rngc2.choice(['mar_juangriego', 'mar_macanao', 'mar_coche', 'mar_elagua', 'moc_mochima', 'moc_cumana', 'moc_plc', 'moc_carupano', 'roq_faro', 'roq_francisqui', 'roq_crasqui', 'roq_madrisqui', 'moc_paria'])
    it = add('caribe_kit', NODES[nd_], 5, 'water', 160, only=['roca_mar_%02d' % rngc2.randint(1, 8)], zero=True, clear=1, scales=(1.0,), rot=rngc2.uniform(0, 6.28))
    if it:
        items.remove(it)
        CAR.append([it['only'][0], it['x'], it['y'], it['rot'], rngc2.uniform(.9, 1.3), 'caribe_kit'])
for i, nd_ in enumerate(['roq_pista', 'roq_francisqui', 'roq_cayoagua', 'roq_crasqui', 'roq_madrisqui', 'roq_noronqui', 'roq_faro']):
    it = add('caribe_kit', (NODES[nd_][0] + rngc2.uniform(-30, 30), NODES[nd_][1] + rngc2.uniform(40, 80)), 14, 'water', 120, only=['cayo_arena_%02d' % (1 + i % 4)], zero=True, clear=2, scales=(1.0, .85), rot=rngc2.uniform(0, 6.28))
    if it:
        items.remove(it)
        CAR.append([it['only'][0], it['x'], it['y'], it['rot'], it['s'], 'caribe_kit'])
# Los Roques village: beach houses + pier on the main cay
rp = NODES['roq_pista']
town_cnt = 0
for t in range(400):
    a = rngc2.uniform(0, 6.283); d = rngc2.uniform(18, 55)
    x, y = rp[0] + math.cos(a) * d, rp[1] + math.sin(a) * d
    if SEA + 1.6 < ht(x, y) < SEA + 6 and d_nodes(x, y) > 15 and d_edges(x, y) > 8 and not any(math.hypot(x - q[1], y - q[2]) < 10 for q in CAR):
        CAR.append([rngc2.choice(CASA_PLAYA), round(x, 1), round(y, 1), rngc2.choice([0, math.pi / 2]), 1.0, 'caribe_kit'])
        town_cnt += 1
        if town_cnt >= 8:
            break
it = add('caribe_kit', (rp[0], rp[1] + 40), 10, 'coast', 100, only=['muelle_cabana'], zero=True, clear=1, scales=(1.0,))
if it:
    items.remove(it)
    CAR.append(['muelle_cabana', it['x'], it['y'], 0.0, 1.0, 'caribe_kit'])
# ── Lechería: villas along the canals, condo towers on the shore, boats moored in the canals, palms ──
LECH = L.get('lecheria')
if LECH:
    ux, uy = LECH['u']
    tx, ty = -uy, ux
    c0 = LECH['c']
    for pl in LECH['canals'][:3]:
        p0, p1 = pl
        Ln = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
        dx, dy = (p1[0] - p0[0]) / Ln, (p1[1] - p0[1]) / Ln
        nxx, nyy = -dy, dx
        k = 10.0
        while k < Ln - 6:
            cx_, cy_ = p0[0] + dx * k, p0[1] + dy * k
            if k > 14 and rngc2.random() < .8:
                BOATS.append([rngc2.choice(['yate', 'penero_azul', 'penero_rojo', 'velero_b']), round(cx_, 1), round(cy_, 1), round(math.atan2(dx, dy) + math.pi / 2, 2), 1.15, 'caribe_kit'])
            for side in (-1, 1):
                bx_, by_ = cx_ + nxx * side * 10.5, cy_ + nyy * side * 10.5
                if ht(bx_, by_) > SEA + 1.2 and d_nodes(bx_, by_) > 15 and d_edges(bx_, by_) > 8:
                    CAR.append([rngc2.choice(CASA_PLAYA + CASA_CAR[:5]), round(bx_, 1), round(by_, 1), round(math.atan2(-nxx * side, -nyy * side), 3), rngc2.uniform(.95, 1.08), 'caribe_kit'])
                    if rngc2.random() < .5:
                        CAR.append([rngc2.choice(['palma_s', 'palma_m']), round(bx_ + nxx * side * 8, 1), round(by_ + nyy * side * 8, 1), rngc2.uniform(0, 6.28), 1.0, 'ccs_city'])
            k += 13.5
    # condo towers along the shore and a landmark church
    for off in (-62, -22, 22, 62):
        x_, y_ = c0[0] + tx * off + ux * -8, c0[1] + ty * off + uy * -8
        if ht(x_, y_) > SEA + 1.5 and d_nodes(x_, y_) > 24 and d_edges(x_, y_) > 12:
            CAR.append([rngc2.choice(['torre_01', 'torre_02', 'torre_03', 'torre_04']), round(x_, 1), round(y_, 1), 0.0, 1.0, 'ccs_city'])
    for off in (-80, 80):
        x_, y_ = c0[0] + tx * off + ux * 18, c0[1] + ty * off + uy * 18
        if ht(x_, y_) > SEA + 1.5 and d_nodes(x_, y_) > 22:
            CAR.append([rngc2.choice(['edif_03', 'edif_07', 'edif_11']), round(x_, 1), round(y_, 1), 0.0, 1.0, 'ccs_city'])
    print('lecheria items', len(CAR))
# ── Anzoátegui / Margarita coastal cities: a gradient from beachfront condos to mid-rise to houses to scattered farms ──
def sea_dist(x, y):
    for r in (14, 22, 32, 44, 58, 74, 92, 112, 140, 170):
        for k in range(12):
            a = k * math.pi / 6
            if ht(x + math.cos(a) * r, y + math.sin(a) * r) < SEA - .8:
                return r
    return 200


def coast_city(nodes, R, n):
    for nd_ in nodes:
        cx, cy = NODES[nd_]
        got = tries = 0
        while got < n and tries < n * 40:
            tries += 1
            a = rngc2.uniform(0, 6.283); d = 18 + (R - 18) * math.sqrt(rngc2.random())
            x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
            hh = ht(x, y)
            if not (SEA + 1.8 < hh < TOPE + 12):
                continue
            if d_nodes(x, y) < 17 or d_edges(x, y) < 9 or d_river(x, y) < 6:
                continue
            if abs(ht(x + 6, y) - ht(x - 6, y)) + abs(ht(x, y + 6) - ht(x, y - 6)) > 7:
                continue
            if any(math.hypot(x - q[1], y - q[2]) < 10.5 for q in CAR) or any(math.hypot(x - px, y - py) < pr * .9 + 8 for (px, py, pr) in PLACED):
                continue
            sd = sea_dist(x, y)
            r = rngc2.random()
            if sd < 45:                                           # beachfront: condo towers + villas
                if r < .22: kind, glb = rngc2.choice(['torre_01', 'torre_02', 'torre_03', 'torre_04']), 'ccs_city'
                elif r < .6: kind, glb = rngc2.choice(CASA_PLAYA + CASA_CAR[:5]), 'caribe_kit'
                else: kind, glb = rngc2.choice(['palma_m', 'palma_l', 'palma_s']), 'ccs_city'
            elif sd < 100:                                        # mid-rise + colonial houses
                kind, glb = (rngc2.choice(['edif_%02d' % k for k in range(1, 17)]), 'ccs_city') if r < .35 else (rngc2.choice(CASA_CAR), 'caribe_kit')
            elif sd < 175:                                        # houses, a few barrios
                kind, glb = (rngc2.choice(CASA_CAR + CASA_PLAYA), 'caribe_kit') if r < .7 else (rngc2.choice(['barrio_%02d' % k for k in range(1, 15)]), 'ccs_city')
            else:
                if r > .35:
                    continue
                kind, glb = rngc2.choice(CASA_CAR), 'caribe_kit'
            ang, bd = sea_dir(x, y)
            rot = round(((ang - math.pi / 2) % (2 * math.pi)) / (math.pi / 2)) * (math.pi / 2) if bd < SEA + 3 else rngc2.choice([0, math.pi / 2])
            CAR.append([kind, round(x, 1), round(y, 1), rot, rngc2.uniform(.95, 1.08), glb])
            got += 1


coast_city(['moc_barcelona', 'moc_plc', 'moc_cumana', 'moc_carupano', 'moc_mochima', 'moc_higuerote'], 190, 55)
coast_city(['mar_porlamar', 'mar_pampatar', 'mar_juangriego', 'mar_asuncion', 'mar_puntapiedras'], 130, 34)
# Los Roques: a chain of sand cays + rocks + moorings across the turquoise flats
for i in range(26):
    nd_ = rngc2.choice(['roq_pista', 'roq_faro', 'roq_francisqui', 'roq_cayoagua', 'roq_crasqui', 'roq_madrisqui', 'roq_noronqui'])
    it = add('caribe_kit', (NODES[nd_][0] + rngc2.uniform(-90, 90), NODES[nd_][1] + rngc2.uniform(-70, 90)), 13, 'water', 70, only=['cayo_arena_%02d' % rngc2.randint(1, 4)], zero=True, clear=2, scales=(1.0, .85), rot=rngc2.uniform(0, 6.28))
    if it:
        items.remove(it)
        CAR.append([it['only'][0], it['x'], it['y'], it['rot'], it['s'] * rngc2.uniform(.9, 1.3), 'caribe_kit'])
URB.extend(CAR)
for _b in range(70):                              # extra boats from the kit
    nd_ = rngc2.choice(['mar_juangriego', 'mar_pampatar', 'mar_porlamar', 'moc_cumana', 'moc_plc', 'moc_mochima', 'roq_faro', 'roq_pista', 'mar_coche'])
    for t in range(120):
        a = rngc2.uniform(0, 6.283); d = rngc2.uniform(30, 90)
        x, y = NODES[nd_][0] + math.cos(a) * d, NODES[nd_][1] + math.sin(a) * d
        if ht(x, y) < SEA - 2 and d_nodes(x, y) > 20 and min(ht(x + math.cos(b) * 14, y + math.sin(b) * 14) for b in (0, 1.6, 3.1, 4.7)) < SEA - .5:
            BOATS.append([rngc2.choice(['velero_b', 'penero_azul', 'penero_rojo', 'yate']), round(x, 1), round(y, 1), round(rngc2.uniform(0, 6.28), 2), 1.7, 'caribe_kit'])
            break
print('caribe items', len(CAR))


# ── DELTA AMACURO (kit: delta_kit): palafito villages, canoes, egrets, sand bars, mangrove mini-islands, nets ──
DEL = []
rngd = random.Random(171)
DN = [k for k in NODES if k.startswith('del_')]
dcx = sum(NODES[k][0] for k in DN) / len(DN)
dcy = sum(NODES[k][1] for k in DN) / len(DN)


def shallow(x, y, lo=-1.4, hi=.3):
    return lo < ht(x, y) < hi


for nm in DN:
    cx, cy = NODES[nm]
    got = tries = 0
    while got < 5 and tries < 160:
        tries += 1
        a_ = rngd.uniform(0, 6.283); d = rngd.uniform(20, 70)
        x, y = cx + math.cos(a_) * d, cy + math.sin(a_) * d
        hh = ht(x, y)
        if not (SEA - 1.3 < hh < SEA + 2.8) or d_nodes(x, y) < 17 or d_edges(x, y) < 8:
            continue
        if any(math.hypot(x - q[1], y - q[2]) < 13 for q in DEL):
            continue
        DEL.append([rngd.choice(['palafito_%02d' % k for k in range(1, 7)]), round(x, 1), round(y, 1), rngd.choice([0, math.pi / 2, math.pi, -math.pi / 2]), rngd.uniform(.95, 1.1), 'delta_kit'])
        got += 1
    for kind, n_, test in (('canoa_a', 1, 'w'), ('canoa_b', 1, 'w'), ('canoa_c', 1, 'w'), ('garza_a', 2, 's'), ('garza_b', 1, 's'), ('garza_c', 1, 's'), ('ibis_roja', 1, 's'), ('red_pesca', 1, 'l'), ('tronco_flotante', 1, 'w'), ('roca_delta_%02d' % rngd.randint(1, 4), 1, 'w')):
        for _ in range(n_):
            for t in range(80):
                a_ = rngd.uniform(0, 6.283); d = rngd.uniform(25, 95)
                x, y = cx + math.cos(a_) * d, cy + math.sin(a_) * d
                hh = ht(x, y)
                ok_ = (test == 'w' and hh < SEA - .4) or (test == 's' and SEA - 1.0 < hh < SEA + 2.4) or (test == 'l' and SEA + 1.2 < hh < SEA + 2.8)
                if ok_ and d_nodes(x, y) > 14 and d_edges(x, y) > 6 and not any(math.hypot(x - q[1], y - q[2]) < 9 for q in DEL):
                    DEL.append([kind, round(x, 1), round(y, 1), rngd.uniform(0, 6.28), 1.2 if kind.startswith(('canoa', 'garza', 'ibis')) else 1.0, 'delta_kit'])
                    break
# ocean side: sand bars, mangrove mini-islands and rocks in the shallows east/north of the delta
for k in range(70):
    x, y = dcx + rngd.uniform(-330, 330), dcy + rngd.uniform(-220, 260)
    hh = ht(x, y)
    if hh < SEA - .6 and hh > -7 and d_nodes(x, y) > 40 and not any(math.hypot(x - q[1], y - q[2]) < 38 for q in DEL if q[0].startswith(('banco', 'isla_manglar', 'roca_delta'))):
        kind = rngd.choice(['banco_arena_%02d' % rngd.randint(1, 4), 'isla_manglar_%02d' % rngd.randint(1, 6), 'isla_manglar_%02d' % rngd.randint(1, 6), 'roca_delta_%02d' % rngd.randint(1, 4)])
        DEL.append([kind, round(x, 1), round(y, 1), rngd.uniform(0, 6.28), rngd.uniform(1.0, 1.5), 'delta_kit'])
# mangrove mini-islands scattered through the muddy water between the tiles (kept clear of tiles and paths)
for k in range(900):
    x, y = dcx + rngd.uniform(-330, 330), dcy + rngd.uniform(-250, 260)
    hh = ht(x, y)
    if not (SEA - 1.8 < hh < SEA - .1) or d_nodes(x, y) < 30 or d_edges(x, y) < 17 or d_river(x, y) < 6:
        continue
    if any(math.hypot(x - q[1], y - q[2]) < 26 for q in DEL if q[0].startswith(('isla_manglar', 'mangle_clump'))):
        continue
    kind = rngd.choice(['isla_manglar_%02d' % rngd.randint(1, 6)] * 2 + ['mangle_clump_%02d' % rngd.randint(1, 8)] * 3)
    DEL.append([kind, round(x, 1), round(y, 1), rngd.uniform(0, 6.28), rngd.uniform(.85, 1.2), 'delta_kit'])
URB.extend(DEL)
print('delta items', len(DEL))


# ── PUERTO ORDAZ (kit: ordaz_kit): steel port on the north bank, city on the south bank, bridge across the Orinoco, islets and rapids ──
OGL = []
rngo = random.Random(191)
po = NODES['gua_pordaz']
orr = L['rivers']['orinoco']
# river centre line near the tile
ri = min(range(len(orr)), key=lambda i: math.hypot(orr[i][0] - po[0], orr[i][1] - po[1]))
rp0, rp1 = orr[max(0, ri - 8)], orr[min(len(orr) - 1, ri + 8)]
rdx, rdy = rp1[0] - rp0[0], rp1[1] - rp0[1]
rl = math.hypot(rdx, rdy)
rdx, rdy = rdx / rl, rdy / rl
rnx, rny = -rdy, rdx
rc = orr[ri]
side = 1 if (po[0] - rc[0]) * rnx + (po[1] - rc[1]) * rny > 0 else -1            # +side = the bank where the tile is (industrial bank)


def og(kind, x, y, rot=0.0, sc=1.0, only_ok=None):
    OGL.append([kind, round(x, 1), round(y, 1), round(rot, 3), sc, 'ordaz_kit'])


def bank(off_along, off_out):
    return rc[0] + rdx * off_along + rnx * side * off_out, rc[1] + rdy * off_along + rny * side * off_out


# port: quay line along the industrial bank
qrot = -math.atan2(rdy, rdx)
for k in range(5):
    x, y = bank(-70 + k * 30, 58)
    if ht(x, y) > SEA - .5:
        og('muelle_largo', x, y, qrot)
for k, (a_, o_) in enumerate(((-60, 70), (-25, 70), (10, 70), (45, 70))):
    x, y = bank(a_, o_)
    if ht(x, y) > SEA + 1:
        og('grua_muelle' if k % 2 == 0 else rngo.choice(['contenedores_a', 'contenedores_b', 'contenedores_c']), x, y, qrot + (math.pi / 2 if k % 2 == 0 else 0))
x, y = bank(-5, 40)
og('buque_carga', x, y, qrot)
x, y = bank(55, 42)
og('remolcador', x, y, qrot)
x, y = bank(-100, 38)
og('gabarra', x, y, qrot)
for nm_, a_, o_ in (('alto_horno', -50, 112), ('chimenea_a', -20, 120), ('chimenea_b', 5, 122), ('tanque_blanco_a', 30, 112), ('tanque_blanco_b', 50, 116), ('nave_a', -80, 108), ('nave_b', -35, 94), ('nave_c', 15, 94),
                    ('silo_a', 70, 108), ('pila_bobinas', -75, 88), ('contenedores_a', 40, 90), ('tuberia_pieza', -10, 106), ('cinta_pieza', -40, 100)):
    x, y = bank(a_, o_)
    if ht(x, y) > SEA + 1.5 and d_nodes(x, y) > 20 and d_edges(x, y) > 10:
        og(nm_, x, y, qrot if nm_.startswith(('nave', 'tuberia', 'cinta')) else rngo.choice([0, math.pi / 2]))
# city on the opposite bank
for k in range(180):
    a_ = rngo.uniform(-190, 190)
    o_ = rngo.uniform(80, 260)
    x, y = bank(a_, -o_)
    if not (SEA + 1.8 < ht(x, y) < TOPE + 10) or d_nodes(x, y) < 19 or d_edges(x, y) < 10 or d_river(x, y) < 12:
        continue
    if any(math.hypot(x - q[1], y - q[2]) < 12 for q in OGL):
        continue
    r = rngo.random()
    if o_ < 110 and r < .22:
        kind = rngo.choice(['torre_oscura_a', 'torre_oscura_b'])
    elif o_ < 150 and r < .7:
        kind = rngo.choice(['edif_gris_%02d' % rngo.randint(1, 6), 'edif_terracota_%02d' % rngo.randint(1, 4)])
    else:
        kind = rngo.choice(['casa_og_%02d' % rngo.randint(1, 6)] * 3 + ['palma_og_a', 'palma_og_b', 'arbol_og_a'])
    og(kind, x, y, rngo.choice([0, math.pi / 2, math.pi, -math.pi / 2]))
# bridge across the river: scan candidate crossings along the river, pick the narrowest clean one, span it end to end
def crossing(px, py):
    lo = hi = 0
    t = 0
    while t < 400 and ht(px + rnx * t, py + rny * t) < SEA - .3:
        t += 3
    hi = t
    t = 0
    while t < 400 and ht(px - rnx * t, py - rny * t) < SEA - .3:
        t += 3
    lo = t
    return lo, hi


best = None
for a in range(-50, 51, 10):
    px, py = rc[0] + rdx * a, rc[1] + rdy * a
    lo, hi = crossing(px, py)
    w = lo + hi
    if w < 60 or w > 330:
        continue
    for t0 in (-lo - 14, hi + 14):                                  # both landings must be clear of tiles
        if d_nodes(px + rnx * t0, py + rny * t0) < 26:
            break
    else:
        if best is None or w > best[0]:
            best = (w, px, py, lo, hi)
if best:
    w, px, py, lo, hi = best
    BRIDGE_Y = max(ht(px + rnx * (hi + 8), py + rny * (hi + 8)), ht(px - rnx * (lo + 8), py - rny * (lo + 8))) - 8.6
    total = w + 36
    nbr = max(1, int(round(total / 24.0)))
    sx = total / (24.0 * nbr)
    c0 = (hi - lo) / 2 - total / 2
    for k in range(nbr):
        t = c0 + (k + .5) * (total / nbr)
        og('puente_ordaz_recto', px + rnx * t, py + rny * t, -math.atan2(rny, rnx), sx)
        OGL[-1].append(round(BRIDGE_Y, 2))
    print('bridge pieces', nbr, 'width', w, 'scale', round(sx, 2))
else:
    print('bridge: no crossing found')
# islets, rocks and rapids in the river
for k in range(34):
    a_ = rngo.uniform(-260, 260)
    o_ = rngo.uniform(-46, 46)
    x, y = rc[0] + rdx * a_ + rnx * o_, rc[1] + rdy * a_ + rny * o_
    if ht(x, y) < SEA - .5 and d_nodes(x, y) > 25 and abs(((x - rc[0]) * rdx + (y - rc[1]) * rdy) - 50) > 18 and not any(math.hypot(x - q[1], y - q[2]) < 20 for q in OGL if q[0].startswith(('isla_rocosa', 'rapidos', 'roca_rio'))):
        kind = rngo.choice(['isla_rocosa_%02d' % rngo.randint(1, 6), 'roca_rio_%02d' % rngo.randint(1, 6), 'roca_rio_%02d' % rngo.randint(1, 6), 'rapidos_pieza_%s' % rngo.choice('ab')])
        og(kind, x, y, rngo.uniform(0, 6.28), rngo.uniform(.9, 1.3))
cl = NODES['gua_llovizna']
for k in range(6):
    x, y = cl[0] + rngo.uniform(-60, 60), cl[1] + rngo.uniform(-50, 50)
    if SEA + 1.6 < ht(x, y) < TOPE + 6 and d_nodes(x, y) > 18 and d_edges(x, y) > 9:
        og(rngo.choice(['palma_og_a', 'palma_og_b', 'palma_og_c', 'arbol_og_b']), x, y, rngo.uniform(0, 6.28))
URB.extend(OGL)
print('ordaz items', len(OGL))

# ── LOS LLANOS hero fill (kit: llanos_kit): hacienda compound with windmill + corral, ranches near every tile, cows / horses / capybaras, river rocks and rapids ──
LLG = []
rl_ = random.Random(311)
LHERO = [h_ for h_ in HEROES if h_['name'] == 'lla'][0]
_ap = [(p_[0], p_[1] + 14 * math.sin(p_[0] * .012 + 1.0) + 7 * math.sin(p_[0] * .036)) for p_ in L['rivers']['apure'] if LHERO['x0'] - 150 < p_[0] < LHERO['x0'] + (LHERO['nx'] - 1) * LHERO['cell'] + 150]
LPONDS = ((1085, 1002, 24), (1262, 992, 20), (1480, 985, 18))


def d_ap(x, y):
    return min(segd(x, y, _ap[i][0], _ap[i][1], _ap[i + 1][0], _ap[i + 1][1]) for i in range(len(_ap) - 1))


def lg(kind, x, y, rot=0.0, sc=1.0, y_=None):
    LLG.append([kind, round(x, 1), round(y, 1), round(rot, 3), sc, 'llanos_kit'])
    if y_ is not None:
        LLG[-1].append(round(y_, 2))


def lfree(x, y, r=0.0, dn=14, de=9):
    return ht(x, y) > SEA + 2.0 and d_nodes(x, y) > dn + r and d_edges(x, y) > de + r * .5 and d_ap(x, y) > 24 and all(math.hypot(x - px_, y - py_) > qr + r for px_, py_, qr in LPONDS) and all(math.hypot(x - q[1], y - q[2]) > r + 3 for q in LLG if q[0].startswith(('casa', 'anexo', 'molino', 'tanque', 'caney')))


def corral(cx, cy, nx_, ny_, gate=True, rot=0.0):
    """rectangular fence of cerca pieces (6 long) centred on cx,cy: nx_ pieces along x, ny_ along y"""
    c, sn = math.cos(rot), math.sin(rot)

    def w(px, py):
        return cx + px * c - py * sn, cy + px * sn + py * c
    hx_, hy_ = nx_ * 3, ny_ * 3
    for k in range(nx_):
        for sgn in (-1, 1):
            x, y = w(-hx_ + 3 + k * 6, sgn * hy_)
            lg('cerca_porton' if (gate and sgn == 1 and k == nx_ // 2) else 'cerca_recta', x, y, rot)
    for k in range(ny_):
        for sgn in (-1, 1):
            x, y = w(sgn * hx_, -hy_ + 3 + k * 6)
            lg('cerca_recta', x, y, rot + math.pi / 2)
    for sx_, sy_ in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        x, y = w(sx_ * hx_, sy_ * hy_)
        lg('cerca_esquina', x, y, rot + (0 if (sx_, sy_) == (-1, -1) else math.pi / 2 if (sx_, sy_) == (1, -1) else -math.pi / 2 if (sx_, sy_) == (-1, 1) else math.pi))
    return w


def herd(cx, cy, n, rr, kinds, scl=(.95, 1.15)):
    out = 0
    for _ in range(n * 6):
        if out >= n:
            break
        a_ = rl_.uniform(0, 6.28)
        d_ = rl_.uniform(2, rr)
        x, y = cx + math.cos(a_) * d_, cy + math.sin(a_) * d_
        if lfree(x, y, 2, 12, 8) and not any(math.hypot(x - q[1], y - q[2]) < 5 for q in LLG if q[0].startswith(('vaca', 'toro', 'caballo', 'chigui'))):
            lg(rl_.choice(kinds), x, y, rl_.uniform(0, 6.28), rl_.uniform(*scl) * 1.3)
            out += 1


hato = NODES['lla_hato']
C = (hato[0] + 6, hato[1] - 60)
for kind, ox, oy, rot in (('casa_hacienda_a', -16, 0, 0), ('casa_hacienda_b', 14, -3, 0), ('anexo_cobertizo', 38, 8, 0), ('molino_viento', -44, -6, .3), ('tanque_agua', -54, 8, 0),
                          ('caney', 52, -10, 0), ('pozo', -30, 14, 0), ('cartel_hato', 0, 46, 0), ('saman_a', -64, 2, 0), ('saman_b', 66, 4, 1.2), ('camino_poste', 14, 52, 0.4)):
    x, y = C[0] + ox, C[1] + oy
    if ht(x, y) > SEA + 2:
        lg(kind, x, y, rot)
wf = corral(C[0] + 2, C[1] + 30, 8, 4)
for kind, ox, oy in (('abrevadero', 14, 6), ('heno_a', -16, 4), ('heno_b', -10, 8), ('vaca_a', -6, -2), ('vaca_b', 4, 1), ('vaca_c', 12, -4), ('toro', 18, 4), ('caballo_a', -12, -4), ('caballo_b', 0, 6)):
    x, y = wf(ox - 2, oy - 2)
    lg(kind, x, y, rl_.uniform(0, 6.28), 1.3 if kind.startswith(('vaca', 'toro', 'caballo')) else 1.0)
for k in range(6):
    herd(hato[0] - 50 + k * 8, hato[1] + 40, 1, 46, ['vaca_a', 'vaca_b', 'vaca_c', 'caballo_a', 'caballo_b', 'caballo_c'])

# ranches near every Llanos tile (house + yard + a few animals), fewer for the far ones
for nid in [k for k in NODES if k.startswith('lla_')] + ['and_barinas']:
    if nid not in NODES or nid == 'lla_hato':
        continue
    cx_, cy_ = NODES[nid]
    for tries in range(2 if nid in ('lla_mantecal', 'lla_achaguas', 'lla_sanfernando', 'lla_guasdualito', 'lla_barinas') else 1):
        for _ in range(60):
            a_ = rl_.uniform(0, 6.28)
            d_ = rl_.uniform(34, 78)
            x, y = cx_ + math.cos(a_) * d_, cy_ + math.sin(a_) * d_
            if lfree(x, y, 14, 14, 18):
                break
        else:
            continue
        rot_ = rl_.choice([0, math.pi / 2])
        lg(rl_.choice(['casa_hacienda_a', 'casa_hacienda_b']), x, y, 0)
        if rl_.random() < .6:
            lg('anexo_cobertizo', x + 17, y + 4, 0)
        if rl_.random() < .5:
            lg('molino_viento', x - 18, y - 3, rl_.uniform(0, 6))
        lg(rl_.choice(['saman_a', 'saman_b', 'arbol_llano_a', 'arbol_llano_b']), x - 12, y + 10, rl_.uniform(0, 6))
        herd(x, y + 14, 4, 22, ['vaca_a', 'vaca_b', 'vaca_c', 'caballo_a', 'caballo_c'])

# open savanna herds across the Llanos (hero patch + northern Llanos)
for _ in range(120):
    x, y = rl_.uniform(880, 1620), rl_.uniform(640, 1060)
    if not (LHERO['x0'] <= x < LHERO['x0'] + (LHERO['nx'] - 1) * LHERO['cell'] or 880 <= x <= 1600 and y < 800):
        continue
    if lfree(x, y, 8, 16, 12):
        herd(x, y, rl_.randint(3, 5), 20, ['vaca_a', 'vaca_b', 'vaca_c', 'vaca_a', 'caballo_a', 'caballo_b', 'caballo_c'] if rl_.random() < .8 else ['toro', 'vaca_a'])

# river life: capybaras on the banks and ponds, egrets, rocks in the water, rapids
for (qx_, qy_, qr_) in LPONDS:
    for k in range(rl_.randint(2, 3)):
        a_ = rl_.uniform(0, 6.28)
        lg('chigui_agua', qx_ + math.cos(a_) * qr_ * .35, qy_ + math.sin(a_) * qr_ * .35, a_, 1.5)
    for k in range(5):
        a_ = rl_.uniform(0, 6.28)
        x, y = qx_ + math.cos(a_) * (qr_ + 4), qy_ + math.sin(a_) * (qr_ + 4)
        if ht(x, y) > SEA + .8:
            lg(rl_.choice(['chigui_a', 'chigui_b', 'chigui_c', 'roca_llano_%02d' % rl_.randint(1, 6), 'arbusto_llano_a']), x, y, rl_.uniform(0, 6.28))
step_ = 0
for i in range(0, len(_ap) - 1):
    if not (LHERO['x0'] + 20 < _ap[i][0] < LHERO['x0'] + (LHERO['nx'] - 1) * LHERO['cell'] - 20):
        continue
    step_ += 1
    x, y = _ap[i]
    if step_ % 3 == 0:
        for k in range(2):
            ox, oy = rl_.uniform(-12, 12), rl_.uniform(-8, 8)
            if ht(x + ox, y + oy) < SEA - .4:
                lg(rl_.choice(['roca_rio_01', 'roca_rio_02', 'roca_rio_03', 'roca_rio_04']), x + ox, y + oy, rl_.uniform(0, 6.28), rl_.uniform(.9, 1.4))
    if step_ % 14 == 0 and ht(x, y) < SEA - .5:
        tx, ty = _ap[i + 1][0] - _ap[i][0], _ap[i + 1][1] - _ap[i][1]
        lg(rl_.choice(['rapidos_llano_a', 'rapidos_llano_b']), x, y, -math.atan2(ty, tx), rl_.uniform(.9, 1.2))
    if step_ % 6 == 2:
        a_ = rl_.choice([-1, 1])
        bx, by = x + 0, y + a_ * 26
        if lfree(bx, by, 2, 14, 6) and ht(bx, by) > SEA + .5:
            lg(rl_.choice(['chigui_a', 'chigui_b', 'chigui_c', 'roca_llano_%02d' % rl_.randint(1, 6)]), bx + rl_.uniform(-6, 6), by, rl_.uniform(0, 6.28))
# bridge on the dirt track that runs from the hacienda tile south across the Apure
bx_ = 1148
yin = next((yy for yy in range(960, 1140, 2) if ht(bx_, yy) < SEA - .3), None)
yout = next((yy for yy in range(1140, 960, -2) if ht(bx_, yy) < SEA - .3), None)
if yin and yout:
    wid = yout - yin
    ya, yb = yin - 4, yout + 4
    BY = max(ht(bx_, yin - 10), ht(bx_, yout + 10)) + 1.4 - 10
    total = wid + 40
    nbr = max(1, int(round(total / 24.0)))
    sxx = total / (24.0 * nbr)
    for k in range(nbr):
        t_ = (yin + yout) / 2 - total / 2 + (k + .5) * total / nbr
        lg('puente_llano_recto', bx_, t_, -math.pi / 2, sxx, BY)
    print('llanos bridge', nbr, wid)
URB.extend(LLG)
print('llanos items', len(LLG))

# ── FALCÓN hero fill (kit: falcon_kit): colonial Coro on the beach, villages, wind turbines, rocky islets, goats / donkeys / flamingos ──
FGL = []
rf_ = random.Random(411)
FHERO = [h_ for h_ in HEROES if h_['name'] == 'fal'][0]


def fg(kind, x, y, rot=0.0, sc=1.0, y_=None):
    FGL.append([kind, round(x, 1), round(y, 1), round(rot, 3), sc, 'falcon_kit'])
    if y_ is not None:
        FGL[-1].append(round(y_, 2))


def ffree(x, y, r=0.0, dn=14, de=9, dbl=1.2):
    return ht(x, y) > SEA + dbl + .6 and d_nodes(x, y) > dn + r and d_edges(x, y) > de + r * .5 and all(math.hypot(x - q[1], y - q[2]) > r + 4 for q in FGL if q[0].startswith(('casa', 'iglesia', 'kiosco', 'molino', 'aljibe')))


def near_sea(x, y, rad=30):
    return any(ht(x + math.cos(a_ * .785) * rad, y + math.sin(a_ * .785) * rad) < SEA - .3 for a_ in range(8))


def village(cx_, cy_, n, rmin, rmax, kinds):
    got = 0
    for _ in range(n * 25):
        if got >= n:
            break
        a_, d_ = rf_.uniform(0, 6.28), rf_.uniform(rmin, rmax)
        x, y = cx_ + math.cos(a_) * d_, cy_ + math.sin(a_) * d_
        if ffree(x, y, 6, 14, 12):
            fg(rf_.choice(kinds), x, y, rf_.choice([0, math.pi / 2, math.pi, -math.pi / 2]))
            got += 1


coro = NODES['coc_coro']
best = None
for _ in range(1400):
    a_, d_ = rf_.uniform(0, 6.28), rf_.uniform(24, 90)
    x, y = coro[0] + math.cos(a_) * d_, coro[1] + math.sin(a_) * d_
    if SEA + 1.8 < ht(x, y) < SEA + 5 and near_sea(x, y, 34) and d_nodes(x, y) > 28 and d_edges(x, y) > 20 and (best is None or d_ < best[2]):
        best = (x, y, d_)
if best:
    cx_, cy_ = best[0], best[1]
    fg('iglesia_coro', cx_, cy_, 0)
    village(cx_, cy_, 22, 18, 52, ['casa_falcon_a', 'casa_falcon_b', 'casa_falcon_c', 'casa_falcon_d', 'casa_falcon_a', 'casa_falcon_b'])
    for k in range(4):
        x, y = cx_ + rf_.uniform(-45, 45), cy_ + rf_.uniform(-45, 45)
        if ffree(x, y, 3, 14, 9) and near_sea(x, y, 18):
            fg('kiosco_playa', x, y, rf_.uniform(0, 6.28))
    for k in range(14):
        x, y = cx_ + rf_.uniform(-60, 60), cy_ + rf_.uniform(-60, 60)
        if ffree(x, y, 2, 14, 9):
            fg(rf_.choice(['palma_falcon_a', 'palma_falcon_b', 'palma_falcon_a']), x, y, rf_.uniform(0, 6.28))
    print('coro town at', round(cx_), round(cy_))
for nid, nn in (('zul_altagracia', 7), ('zul_puente', 6), ('zul_dabajuro', 7)):
    c_ = NODES[nid]
    village(c_[0], c_[1], nn, 24, 62, ['casa_falcon_a', 'casa_falcon_b', 'casa_falcon_c', 'casa_falcon_d'])
    for k in range(3):
        a_ = rf_.uniform(0, 6.28)
        x, y = c_[0] + math.cos(a_) * rf_.uniform(26, 60), c_[1] + math.sin(a_) * rf_.uniform(26, 60)
        if ffree(x, y, 3, 14, 9):
            fg(rf_.choice(['aljibe', 'cruz_camino', 'burro', 'cabra_a', 'cabra_b']), x, y, rf_.uniform(0, 6.28))
for (mx_, my_) in ((792, 138), (806, 172), (820, 206), (788, 112)):
    if ht(mx_, my_) > SEA + 2:
        fg('molino_aeolico', mx_, my_, rf_.uniform(-.4, .4))
for _ in range(60):
    x, y = rf_.uniform(FHERO['x0'] + 10, FHERO['x0'] + (FHERO['nx'] - 1) * FHERO['cell'] - 10), rf_.uniform(FHERO['y0'] + 10, FHERO['y0'] + (FHERO['ny'] - 1) * FHERO['cell'] - 10)
    if ffree(x, y, 3, 16, 12, 1.5):
        k = rf_.random()
        fg('burro' if k < .25 else rf_.choice(['cabra_a', 'cabra_b']) if k < .8 else rf_.choice(['lagarto', 'calavera_vaca', 'tronco_seco']), x, y, rf_.uniform(0, 6.28), 1.2 if k < .8 else 1.0)
for (ix_, iy_, kind) in ((905, 232, 'islote_a'), (958, 242, 'islote_c'), (1040, 256, 'islote_b'), (1076, 264, 'islote_c'), (882, 205, 'islote_b'), (832, 102, 'islote_a'), (800, 112, 'islote_c'), (790, 160, 'islote_b')):
    if ht(ix_, iy_) > SEA - .5:
        fg(kind, ix_, iy_, rf_.uniform(0, 6.28), 1.0, SEA)
for _ in range(120):
    x, y = rf_.uniform(FHERO['x0'] + 10, FHERO['x0'] + (FHERO['nx'] - 1) * FHERO['cell'] - 10), rf_.uniform(FHERO['y0'] + 10, FHERO['y0'] + (FHERO['ny'] - 1) * FHERO['cell'] - 10)
    if -4 < ht(x, y) - SEA < -.8 and near_sea(x, y, 20) and d_nodes(x, y) > 30 and not any(math.hypot(x - q[1], y - q[2]) < 16 for q in FGL if q[0].startswith(('islote', 'roca_mar'))) and ht(x + 26, y) < SEA - 2:
        fg(rf_.choice(['roca_mar_01', 'roca_mar_02', 'roca_mar_03', 'roca_mar_04', 'flamenco_grupo', 'pelicano_a']), x, y, rf_.uniform(0, 6.28), 1.0, SEA)
URB.extend(FGL)
print('falcon items', len(FGL))

# ── ZULIA hero fill (kit: zulia_kit): oil field + pier + tanker on the west shore, colourful lake town on the east shore, cable-stayed bridge across the lake ──
ZG = []
rz_ = random.Random(511)


def zg(kind, x, y, rot=0.0, sc=1.0, y_=None):
    ZG.append([kind, round(x, 1), round(y, 1), round(rot, 3), sc, 'zulia_kit'])
    if y_ is not None:
        ZG[-1].append(round(y_, 2))


def zfree(x, y, r=0.0, dn=15, de=9, ds=1.0):
    return ht(x, y) > SEA + ds + .8 and d_nodes(x, y) > dn + r and d_edges(x, y) > de + r * .5 and all(math.hypot(x - q[1], y - q[2]) > r + 3.5 for q in ZG if q[0] not in ('puente_lago_recto', 'puente_lago_torre'))


def shore_w(y, x0=330):
    x = x0
    while x < 760 and ht(x, y) > SEA - .3:
        x += 2
    return x


def shore_e(y, xs=700):
    x = xs
    while x > 300 and ht(x, y) > SEA - .3:
        x -= 2
    return x


# oil field: derricks, pumpjacks, tanks, sheds, flare, pier + tanker on the west shore (y 320..455)
placed_d = []
for _ in range(500):
    y = rz_.uniform(318, 450)
    sx_ = shore_w(y)
    x = sx_ - rz_.uniform(18, 95)
    if zfree(x, y, 9, 18, 14) and all(math.hypot(x - a_, y - b_) > 24 for a_, b_ in placed_d) and len(placed_d) < 7:
        placed_d.append((x, y))
        zg(['torre_petroleo_a', 'torre_petroleo_b', 'torre_petroleo_c'][len(placed_d) % 3], x, y, rz_.choice([0, math.pi / 2]))
for _ in range(500):
    y = rz_.uniform(300, 455)
    sx_ = shore_w(y)
    x = sx_ - rz_.uniform(40, 175)
    if zfree(x, y, 6, 18, 14, 1.5) and sum(1 for q in ZG if q[0].startswith('balancin')) < 9:
        zg(rz_.choice(['balancin_a', 'balancin_b']), x, y, rz_.uniform(0, 6.28))
for kind, n_ in (('tanque_crudo_a', 3), ('tanque_crudo_b', 2), ('tanque_esfera', 1), ('caseta_gris_a', 2), ('caseta_gris_b', 2), ('caseta_gris_c', 2), ('planta_destilacion', 1), ('antorcha', 1), ('tablero_electrico', 1), ('barril_set', 2), ('cabezal_pozo', 3), ('camion_cisterna', 2)):
    for _ in range(n_):
        for tries in range(250):
            y = rz_.uniform(330, 440)
            sx_ = shore_w(y)
            x = sx_ - rz_.uniform(12, 70)
            if zfree(x, y, 8, 16, 12):
                zg(kind, x, y, rz_.choice([0, math.pi / 2, math.pi]))
                break
yp = 352
xp = shore_w(yp)
zg('muelle_petrolero', xp + 8, yp, 0, 1.0, SEA)
zg('tanquero_chico', xp + 34, yp + 11, 0, 1.0, SEA)
for k in range(5):
    zg('tuberia_pared', xp - 8 - k * 12, yp, 0)

# colourful lake town along the east shore
ch_ = None
for _ in range(900):
    y = rz_.uniform(355, 440)
    x = shore_e(y) + rz_.uniform(14, 34)
    if zfree(x, y, 8, 16, 10):
        ch_ = (x, y)
        break
if ch_:
    zg('iglesia_zulia', ch_[0], ch_[1], 0)
    got = 0
    for _ in range(1500):
        if got >= 42:
            break
        y = rz_.uniform(330, 462)
        x = shore_e(y) + rz_.uniform(8, 78)
        if zfree(x, y, 5, 14, 9):
            zg(rz_.choice(['casa_zulia_a', 'casa_zulia_b', 'casa_zulia_c', 'casa_zulia_d', 'casa_zulia_e', 'casa_zulia_f', 'casa_zulia_baja_a', 'casa_zulia_baja_b']), x, y, rz_.choice([0, math.pi / 2, math.pi, -math.pi / 2]))
            got += 1
    for k in range(5):
        y = 345 + k * 22
        xe = shore_e(y)
        zg('muelle_madera_a' if k % 2 else 'muelle_madera_b', xe - 6, y, math.pi, 1.0, SEA)
        zg(rz_.choice(['lancha_pesca_a', 'lancha_pesca_b', 'penero']), xe - 20, y + rz_.uniform(-6, 6), rz_.uniform(-.4, .4) + math.pi, 1.0, SEA)
    for k in range(5):
        y = rz_.uniform(350, 450)
        xe = shore_e(y)
        if ht(xe - 5, y) < SEA - .3:
            zg(rz_.choice(['palafito_lago_a', 'palafito_lago_b']), xe - 4, y, rz_.choice([0, math.pi]), 1.0, SEA)
    for k in range(7):
        x, y = rz_.uniform(470, 640), rz_.uniform(262, 330)
        if ht(x, y) < SEA - 1.0:
            zg(rz_.choice(['lancha_pesca_a', 'lancha_pesca_b', 'penero', 'tanquero_chico']), x, y, rz_.uniform(0, 6.28), 1.0, SEA)

# lake bridge along the walkable edge machiques -> sanfrancisco: stay-cable tower segments + plain deck segments, deck flush with the road ribbon
_A, _B = NODES['zul_machiques'], NODES['zul_sanfrancisco']
_len = math.hypot(_B[0] - _A[0], _B[1] - _A[1])
_ux, _uy = (_B[0] - _A[0]) / _len, (_B[1] - _A[1]) / _len
_wet = [t_ for t_ in range(0, int(_len), 2) if ht(_A[0] + _ux * t_, _A[1] + _uy * t_) < SEA + .2]
if _wet:
    t0_, t1_ = _wet[0] - 12, _wet[-1] + 12
    total_ = t1_ - t0_
    nbr_ = max(2, int(round(total_ / 24.0)))
    sxz = total_ / (24.0 * nbr_)
    deck_ = min(max(ht(*_A), ht(*_B)), TOPE + 3) + 1.4
    for k in range(nbr_):
        t_ = t0_ + (k + .5) * total_ / nbr_
        torre = nbr_ >= 4 and k in (nbr_ // 3, nbr_ - 1 - nbr_ // 3)
        zg('puente_lago_torre' if torre else 'puente_lago_recto', _A[0] + _ux * t_, _A[1] + _uy * t_, -math.atan2(_uy, _ux), sxz, deck_ - 10 * sxz - .35)
    print('zulia bridge', nbr_, total_)
# ── south Zulia: oil on both lake shores, a second colourful lake town at San Francisco / Lagunillas, jetties, stilt houses, boats ──
def lake_e(y):
    x = shore_e(y, 720)
    return x if x > 340 else None


def lake_w(y):
    x = shore_w(y, 300)
    return x if x < 700 else None


nder = 0
for _ in range(900):
    y = rz_.uniform(500, 700)
    xe = lake_e(y)
    if xe is None:
        continue
    x = xe + rz_.uniform(16, 90)
    if nder < 6 and zfree(x, y, 9, 18, 14) and all(math.hypot(x - q[1], y - q[2]) > 24 for q in ZG if q[0].startswith('torre_petroleo')):
        zg(['torre_petroleo_a', 'torre_petroleo_b', 'torre_petroleo_c'][nder % 3], x, y, rz_.choice([0, math.pi / 2]))
        nder += 1
nder = 0
for _ in range(900):
    y = rz_.uniform(540, 740)
    xw = lake_w(y)
    if xw is None:
        continue
    x = xw - rz_.uniform(16, 90)
    if nder < 4 and zfree(x, y, 9, 18, 14) and all(math.hypot(x - q[1], y - q[2]) > 24 for q in ZG if q[0].startswith('torre_petroleo')):
        zg(['torre_petroleo_b', 'torre_petroleo_a', 'torre_petroleo_c'][nder % 3], x, y, rz_.choice([0, math.pi / 2]))
        nder += 1
for _ in range(700):
    y = rz_.uniform(500, 740)
    side = rz_.choice([-1, 1])
    xs_ = lake_e(y) if side > 0 else lake_w(y)
    if xs_ is None:
        continue
    x = xs_ + side * rz_.uniform(40, 190)
    if zfree(x, y, 6, 18, 14, 1.5) and sum(1 for q in ZG if q[0].startswith('balancin')) < 20:
        zg(rz_.choice(['balancin_a', 'balancin_b']), x, y, rz_.uniform(0, 6.28))
for kind, n_ in (('tanque_crudo_a', 3), ('tanque_crudo_b', 2), ('caseta_gris_a', 2), ('caseta_gris_b', 2), ('planta_destilacion', 1), ('antorcha', 1), ('barril_set', 2), ('cabezal_pozo', 3), ('camion_cisterna', 1)):
    for _ in range(n_):
        for tries in range(300):
            y = rz_.uniform(580, 700)
            xe = lake_e(y)
            if xe is None:
                continue
            x = xe + rz_.uniform(14, 75)
            if zfree(x, y, 8, 16, 12):
                zg(kind, x, y, rz_.choice([0, math.pi / 2, math.pi]))
                break
zg('muelle_petrolero', (lake_e(655) or 560) - 8, 655, math.pi, 1.0, SEA)
zg('tanquero_chico', (lake_e(655) or 560) - 38, 646, math.pi, 1.0, SEA)
got = 0
for _ in range(2500):
    if got >= 40:
        break
    y = rz_.uniform(488, 612)
    xe = lake_e(y)
    if xe is None:
        continue
    x = xe + rz_.uniform(8, 78)
    if zfree(x, y, 5, 14, 9):
        zg(rz_.choice(['casa_zulia_a', 'casa_zulia_b', 'casa_zulia_c', 'casa_zulia_d', 'casa_zulia_e', 'casa_zulia_f', 'casa_zulia_baja_a', 'casa_zulia_baja_b']), x, y, rz_.choice([0, math.pi / 2, math.pi, -math.pi / 2]))
        got += 1
for _ in range(400):
    y = rz_.uniform(488, 600)
    xe = lake_e(y)
    if xe is None:
        continue
    x = xe + rz_.uniform(16, 40)
    if zfree(x, y, 8, 16, 10):
        zg('iglesia_zulia', x, y, 0)
        break
for k in range(7):
    y = 492 + k * 18
    xe = lake_e(y)
    if xe is None:
        continue
    zg('muelle_madera_a' if k % 2 else 'muelle_madera_b', xe - 6, y, math.pi, 1.0, SEA)
    zg(rz_.choice(['lancha_pesca_a', 'lancha_pesca_b', 'penero']), xe - 20, y + rz_.uniform(-6, 6), rz_.uniform(-.4, .4) + math.pi, 1.0, SEA)
for k in range(8):
    y = rz_.uniform(490, 690)
    xe = lake_e(y)
    if xe and ht(xe - 5, y) < SEA - .3:
        zg(rz_.choice(['palafito_lago_a', 'palafito_lago_b']), xe - 4, y, rz_.choice([0, math.pi]), 1.0, SEA)
_bt_ = []
for k in range(24):
    y = rz_.uniform(470, 720)
    xe, xw = lake_e(y), lake_w(y)
    if xe and xw and xe - xw > 40:
        x = rz_.uniform(xw + 14, xe - 14)
        if ht(x, y) < SEA - 1.0 and d_edges(x, y) > 12:
            zg(rz_.choice(['lancha_pesca_a', 'lancha_pesca_b', 'penero', 'penero', 'tanquero_chico']), x, y, rz_.uniform(0, 6.28), 1.0, SEA)
for (ix_, iy_, ir_) in ((510, 262, 14), (566, 246, 11), (622, 226, 13), (524, 226, 9), (676, 276, 10), (470, 305, 9), (588, 292, 8)):
    for k in range(4):
        x, y = ix_ + rz_.uniform(-ir_ * .45, ir_ * .45), iy_ + rz_.uniform(-ir_ * .45, ir_ * .45)
        if ht(x, y) > SEA + 1.0:
            ZG.append([rz_.choice(['palma_falcon_a', 'palma_falcon_b', 'palma_falcon_a', 'arbusto_seco_a', 'arbusto_seco_b']), round(x, 1), round(y, 1), round(rz_.uniform(0, 6.28), 2), round(rz_.uniform(.9, 1.2), 2), 'falcon_kit'])
for k in range(60):                                    # open-lake traffic: fishing boats, peñeros and the odd tanker between the two shores
    x, y = rz_.uniform(380, 640), rz_.uniform(240, 470)
    if ht(x, y) < SEA - 1.6 and d_edges(x, y) > 16 and not any((x - bx_) ** 2 + (y - by_) ** 2 < 26 ** 2 for bx_, by_ in _bt_):
        _bt_.append((x, y))
        zg(rz_.choice(['lancha_pesca_a', 'lancha_pesca_b', 'penero', 'penero', 'penero', 'tanquero_chico']), x, y, rz_.uniform(0, 6.28), 1.0, SEA)
        if len(_bt_) >= 16:
            break
URB.extend(ZG)
print('zulia items', len(ZG))

# ── GRAN SABANA hero fill (kit: canaima_kit): tepui waterfalls with plunge pools and mist, river cascades, Pemón village on the lagoon, macaws ──
import gsb_data as GS
import sur_data as SU
GB = []
BR = []
rg_ = random.Random(733)


def gb(kind, x, y, rot=0.0, sc=1.0, y_=None, sx=None):
    GB.append([kind, round(x, 1), round(y, 1), round(rot, 3), sc, 'canaima_kit'])
    if y_ is not None or sx is not None:
        GB[-1].append(None if y_ is None else round(y_, 2))
    if sx is not None:
        GB[-1].append(sx)                                    # width factor (the real falls are thin ribbons, the prop scales uniformly)


def gfree(x, y, r=4.0, dn=17, de=8, flat=1.4):
    if not (ht(x, y) > SEA + 2.2 and d_nodes(x, y) > dn and d_edges(x, y) > de):
        return False
    if max(abs(ht(x + 3, y) - ht(x, y)), abs(ht(x, y + 3) - ht(x, y)), abs(ht(x - 3, y) - ht(x, y)), abs(ht(x, y - 3) - ht(x, y))) > flat:
        return False
    return all(math.hypot(x - q[1], y - q[2]) > r + 3 for q in GB if q[0].startswith(('choza', 'cobertizo', 'muelle', 'fogata', 'tendedero', 'pila', 'cesta')))


for _t in GS.TEPUIS + GS.TEPUIS_X + SU.SUR_TEPUIS:
    _cx, _cy = _t['c']
    _dry = _t.get('dry', False)
    _s = (_t['T'] if _dry else _t['T'] + GS.GR - GS.SEA) / 40.0
    for _al in _t['falls']:
        (_px, _py), (_ix, _iy) = GS.face(_t, _al)
        _qx, _qy = _px - _ix * 3.2 * _s, _py - _iy * 3.2 * _s
        gb('cascada_alta', _qx, _qy, math.atan2(-_ix, -_iy), _s, GS.GROUND_X + .1 if _dry else SEA + .15, .36 if _t['T'] >= 100 else .6 if _t['T'] >= 90 else None)
        BR.append([round(_qx), round(_qy), 5, 17, 3, .8, 54])
        if _dry:
            BR.append([round(_qx), round(_qy), 7, 24, 5, .85, 70])
            BR.append([round(_qx - _ix * 6), round(_qy - _iy * 6), 5, 20, 26, .55, 66])
        BR.append([round(_qx - _ix * 10), round(_qy - _iy * 10), 4, 20, 9, .5, 62])
    for _k in range(3 if _t['T'] >= 60 else 0):             # drifting mist along the cliffs
        _a = rg_.uniform(0, 6.28)
        BR.append([round(_cx + math.cos(_a) * _t['a'] * 1.1), round(_cy + math.sin(_a) * _t['b'] * 1.1), 3, 24, 12 + _t['T'] * .3, .5, 60])
    for _k in range(26 if _t['T'] >= 60 else 12):           # outcrops at the cliff foot
        _a = rg_.uniform(0, 6.28)
        _wx, _wy = math.cos(_a), math.sin(_a)
        _e1 = (math.cos(_t['th']), math.sin(_t['th']))
        _e2 = (-_e1[1], _e1[0])
        _kk = 1.1 / math.hypot((_wx * _e1[0] + _wy * _e1[1]) / _t['a'], (_wx * _e2[0] + _wy * _e2[1]) / _t['b'])
        _x, _y = _cx + _wx * _kk, _cy + _wy * _kk
        if ht(_x, _y) > SEA + 2.5 and d_nodes(_x, _y) > 22 and d_edges(_x, _y) > 11 and all(math.hypot(_x - q[1], _y - q[2]) > 9 for q in GB if q[0].startswith('cima_roca')):
            if _t.get('bell'):                                      # granite domes: grey boulders at the foot instead of the orange columns
                gb(rg_.choice(['roca_selva_01', 'roca_selva_02', 'roca_selva_03', 'roca_selva_04']), _x, _y, rg_.uniform(0, 6.28), rg_.uniform(1.6, 3.0))
            else:
                gb(rg_.choice(['cima_roca_a', 'cima_roca_b', 'cima_roca_c']), _x, _y, _a + math.pi / 2, rg_.uniform(.8, 1.25))

_cr = GS.CARONI
for _fy_, _sc_ in ((1225, .72), (1078, .7)):             # stepped cascades across the Caroní (it flows north: the drop faces downstream)
    _j = min(range(len(_cr) - 1), key=lambda i: abs(_cr[i][1] - _fy_))
    _p0, _p1 = _cr[_j], _cr[_j + 1]
    _dx, _dy = _p0[0] - _p1[0], _p0[1] - _p1[1]
    _n = math.hypot(_dx, _dy)
    gb('cascada_ancha', _p0[0], _p0[1], math.atan2(_dx / _n, _dy / _n), _sc_, SEA + .1)
    BR.append([round(_p0[0]), round(_p0[1]), 4, 16, 3, .7, 54])
for _i in range(len(_cr) - 1):                            # rapids along the river
    if rg_.random() < .55:
        _f = rg_.uniform(.2, .8)
        _x, _y = _cr[_i][0] + (_cr[_i + 1][0] - _cr[_i][0]) * _f, _cr[_i][1] + (_cr[_i + 1][1] - _cr[_i][1]) * _f
        if ht(_x, _y) < SEA - 1.0 and d_edges(_x, _y) > 10:
            gb(rg_.choice(['rapido_a', 'rapido_b', 'espuma_pozo']), _x, _y, math.atan2(_cr[_i + 1][0] - _cr[_i][0], _cr[_i + 1][1] - _cr[_i][1]), rg_.uniform(.8, 1.1), SEA + .1)

# Pemón village on the lagoon's west shore
_lg = GS.LAGOON
_vx, _vy = GS.VILLAGE
_dwx, _dwy = _lg['c'][0] - _vx, _lg['c'][1] - _vy
_dn_ = math.hypot(_dwx, _dwy)
_dwx, _dwy = _dwx / _dn_, _dwy / _dn_
_sx, _sy = _vx, _vy
for _k in range(160):                                    # walk from the village toward the lagoon until water
    _x, _y = _vx + _dwx * _k * .8, _vy + _dwy * _k * .8
    if ht(_x, _y) < SEA + .8:
        _sx, _sy = _x - _dwx * 2.5, _y - _dwy * 2.5
        break
gb('muelle_selva', _sx - _dwx * 2, _sy - _dwy * 2, math.atan2(-_dwx, -_dwy), 1.0, SEA + 1.3)
gb('canoa_curiara', _sx + _dwx * 13 - _dwy * 6, _sy + _dwy * 13 + _dwx * 6, math.atan2(_dwy, _dwx) + .2, 1.0, SEA + .25)
gb('canoa_b', _sx + _dwx * 9 + _dwy * 8, _sy + _dwy * 9 - _dwx * 8, math.atan2(_dwx, _dwy) + 1.2, 1.0, SEA + .25)
_hut = ['choza_a', 'choza_b', 'choza_c', 'choza_grande', 'choza_a', 'choza_b', 'cobertizo', 'choza_a']
_placed = 0
for _k in range(400):
    _x, _y = _sx - _dwx * rg_.uniform(8, 36) + rg_.uniform(-16, 16), _sy - _dwy * rg_.uniform(8, 36) + rg_.uniform(-16, 16)
    _kind = _hut[_placed % len(_hut)]
    if gfree(_x, _y, 6.5 if _kind != 'choza_grande' else 8.5):
        gb(_kind, _x, _y, math.atan2(_dwx, _dwy) + rg_.uniform(-.8, .8), 1.0)
        _placed += 1
        if _placed >= 8:
            break
for _kind, _r in (('fogata', 2.5), ('tendedero', 4), ('pila_lena', 2.5), ('cesta_yuca', 2), ('tendedero', 4)):
    for _k in range(120):
        _x, _y = _sx - _dwx * rg_.uniform(6, 22) + rg_.uniform(-12, 12), _sy - _dwy * rg_.uniform(6, 22) + rg_.uniform(-12, 12)
        if gfree(_x, _y, _r):
            gb(_kind, _x, _y, rg_.uniform(0, 6.28), 1.0)
            break
BR.append([round(_sx - _dwx * 18), round(_sy - _dwy * 18), 2, 14, 7, .35, 40])

# small hamlets beside the tiles (Santa Elena, Kamá, Jaspe, km88, Roraima base camp)
for _nid in ('can_santaelena', 'can_kama', 'can_jaspe', 'can_km88', 'can_roraima', 'can_sabana'):
    _nx_, _ny_ = NODES[_nid]
    _pl = 0
    for _k in range(300):
        _a = rg_.uniform(0, 6.28)
        _r = rg_.uniform(26, 44)
        _x, _y = _nx_ + math.cos(_a) * _r, _ny_ + math.sin(_a) * _r
        if gfree(_x, _y, 6.5, dn=20, de=10):
            gb(rg_.choice(['choza_a', 'choza_b', 'choza_c', 'cobertizo']), _x, _y, _a + math.pi / 2 + rg_.uniform(-.5, .5), 1.0)
            _pl += 1
            if _pl >= 3:
                break
for _k in range(26):                                     # macaws around the walls and over the canopy
    _t = GS.TEPUIS[_k % 3]
    _a = rg_.uniform(0, 6.28)
    _x, _y = _t['c'][0] + math.cos(_a) * _t['a'] * rg_.uniform(1.0, 1.5), _t['c'][1] + math.sin(_a) * _t['b'] * rg_.uniform(1.0, 1.5)
    gb(rg_.choice(['guacamaya_vuelo_a', 'guacamaya_vuelo_b', 'guacamaya_vuelo_c']), _x, _y, rg_.uniform(0, 6.28), rg_.uniform(.9, 1.2), max(ht(_x, _y), SEA) + rg_.uniform(14, 40))
URB.extend(GB)
print('gran sabana items', len(GB))

# ── SOUTH hero fill: Roraima massif + Sur de Bolívar savanna, Orinoco bend with Apure wetlands + hacienda, Amazonas domes + river village ──
SG = []
rs_ = random.Random(917)


def sg(kind, x, y, rot=0.0, sc=1.0, kit='canaima_kit', y_=None):
    SG.append([kind, round(x, 1), round(y, 1), round(rot, 3), sc, kit])
    if y_ is not None:
        SG[-1].append(round(y_, 2))


_SBLD = ('choza', 'cobertizo', 'muelle', 'fogata', 'tendedero', 'pila', 'cesta', 'casa', 'anexo', 'molino', 'tanque', 'caney', 'pozo', 'cartel', 'cerca')


def sfree(x, y, r=4.0, dn=19, de=9, flat=1.5):
    if not (ht(x, y) > SEA + 2.2 and d_nodes(x, y) > dn and d_edges(x, y) > de):
        return False
    if max(abs(ht(x + 3, y) - ht(x, y)), abs(ht(x, y + 3) - ht(x, y)), abs(ht(x - 3, y) - ht(x, y)), abs(ht(x, y - 3) - ht(x, y))) > flat:
        return False
    return all(math.hypot(x - q[1], y - q[2]) > r + 3 for q in SG if q[0].startswith(_SBLD))


def river_pts(poly, n=1):
    return G.smooth_line([tuple(p) for p in poly], 2)[::n]


def river_dir(pts, i):
    a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
    n = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
    return (b[0] - a[0]) / n, (b[1] - a[1]) / n


def river_life(poly, p_rap, p_rock, sc_rap=(.8, 1.1), skip_first=3, big=False):
    pts = river_pts(poly)
    for i in range(skip_first, len(pts) - 1):
        x, y = pts[i]
        dx, dy = river_dir(pts, i)
        if ht(x, y) > SEA - .6 or d_edges(x, y) < 10:
            continue
        if rs_.random() < p_rap:
            sg(rs_.choice(['rapido_a', 'rapido_b', 'espuma_pozo']), x, y, math.atan2(dx, dy), rs_.uniform(*sc_rap) * (1.6 if big else 1.0), y_=SEA + .1)
        if rs_.random() < p_rock:
            ox, oy = rs_.uniform(-18, 18), rs_.uniform(-18, 18)
            if ht(x + ox, y + oy) < SEA - .4:
                sg(rs_.choice(['roca_rio_a', 'roca_rio_b', 'roca_rio_c']), x + ox, y + oy, rs_.uniform(0, 6.28), rs_.uniform(.9, 1.5) * (1.4 if big else 1.0))


def village(vx, vy, toward, n_huts=9, spread=(8, 38), dock=True):
    """Pemón/ribereño village: huts + yard props behind (away from the water), a dock and canoes on the shore toward `toward` (unit vector)"""
    dwx, dwy = toward
    sx, sy = vx, vy
    for k in range(200 if dock else 0):
        x, y = vx + dwx * k * .8, vy + dwy * k * .8
        if ht(x, y) < SEA + .8:
            sx, sy = x - dwx * 2.5, y - dwy * 2.5
            break
    if dock:
        sg('muelle_selva', sx - dwx * 2, sy - dwy * 2, math.atan2(-dwx, -dwy), 1.0, y_=SEA + 1.3)
        sg('canoa_curiara', sx + dwx * 13 - dwy * 6, sy + dwy * 13 + dwx * 6, math.atan2(dwy, dwx) + .2, 1.0, y_=SEA + .25)
        sg('canoa_b', sx + dwx * 9 + dwy * 8, sy + dwy * 9 - dwx * 8, math.atan2(dwx, dwy) + 1.2, 1.0, y_=SEA + .25)
    hut = ['choza_a', 'choza_b', 'choza_c', 'choza_grande', 'choza_a', 'choza_b', 'cobertizo', 'choza_a', 'choza_c']
    placed = 0
    for k in range(500):
        x, y = sx - dwx * rs_.uniform(*spread) + rs_.uniform(-18, 18), sy - dwy * rs_.uniform(*spread) + rs_.uniform(-18, 18)
        kind = hut[placed % len(hut)]
        if sfree(x, y, 6.5 if kind != 'choza_grande' else 8.5, dn=0, de=6):
            sg(kind, x, y, math.atan2(dwx, dwy) + rs_.uniform(-.8, .8))
            placed += 1
            if placed >= n_huts:
                break
    for kind, r in (('fogata', 2.5), ('tendedero', 4), ('pila_lena', 2.5), ('cesta_yuca', 2), ('tendedero', 4), ('cesta_yuca', 2)):
        for k in range(120):
            x, y = sx - dwx * rs_.uniform(6, 26) + rs_.uniform(-14, 14), sy - dwy * rs_.uniform(6, 26) + rs_.uniform(-14, 14)
            if sfree(x, y, r, dn=0, de=6):
                sg(kind, x, y, rs_.uniform(0, 6.28))
                break
    BR.append([round(sx - dwx * 18), round(sy - dwy * 18), 2, 14, 7, .3, 40])


# ---- Roraima massif: cloud banks around the top, falls come from the generic loop above ----
_m = SU.SAB_MASSIF
for _k in range(9):
    _a = _k / 9 * 6.283 + rs_.uniform(-.2, .2)
    BR.append([round(_m['c'][0] + math.cos(_a) * _m['a'] * 1.0), round(_m['c'][1] + math.sin(_a) * _m['b'] * 1.0), 5, 38, 52 + rs_.uniform(0, 24), .62, 92])
for _k in range(5):
    _a = rs_.uniform(0, 6.283)
    BR.append([round(_m['c'][0] + math.cos(_a) * _m['a'] * .55), round(_m['c'][1] + math.sin(_a) * _m['b'] * .55), 4, 30, 104 + rs_.uniform(0, 8), .5, 80])
for _k in range(14):                                     # macaws wheeling around the massif
    _a = rs_.uniform(0, 6.28)
    _x, _y = _m['c'][0] + math.cos(_a) * _m['a'] * rs_.uniform(1.0, 1.5), _m['c'][1] + math.sin(_a) * _m['b'] * rs_.uniform(1.0, 1.7)
    sg(rs_.choice(['guacamaya_vuelo_a', 'guacamaya_vuelo_b', 'guacamaya_vuelo_c']), _x, _y, rs_.uniform(0, 6.28), rs_.uniform(.9, 1.2), y_=max(ht(_x, _y), SEA) + rs_.uniform(16, 60))

# ---- Roraima stream: stepped cascades + rapids ----
_sp = river_pts(SU.SAB_RIVER)
for _f, _sc in ((.22, .75), (.46, .7), (.7, .65)):
    _i = int(_f * (len(_sp) - 1))
    _dx, _dy = river_dir(_sp, _i)
    if ht(*_sp[_i]) < SEA - .5:
        sg('cascada_ancha', _sp[_i][0], _sp[_i][1], math.atan2(_dx, _dy), _sc, y_=SEA + .1)
        BR.append([round(_sp[_i][0]), round(_sp[_i][1]), 4, 16, 3, .7, 54])
river_life(SU.SAB_RIVER, .5, .5, skip_first=6)
river_life(SU.SAB_RIVER2, .4, .4, skip_first=2)

# ---- Sur de Bolívar village (savanna road) + hamlets ----
village(SU.SAB_VILLAGE[0], SU.SAB_VILLAGE[1], (.5, .87), n_huts=11, spread=(2, 30), dock=False)
for (_hx, _hy, _n) in ((2085, 1672, 4), (2470, 1745, 3), (2040, 1800, 3)):
    _pl = 0
    for _k in range(300):
        _x, _y = _hx + rs_.uniform(-28, 28), _hy + rs_.uniform(-24, 24)
        if sfree(_x, _y, 6.5, dn=20, de=9):
            sg(rs_.choice(['choza_a', 'choza_b', 'choza_c', 'cobertizo']), _x, _y, rs_.uniform(0, 6.28))
            _pl += 1
            if _pl >= _n:
                break
for _k in range(26):                                     # boulder stacks scattered over the savanna (the dark rock piles of the reference)
    _x, _y = rs_.uniform(2000, 2760), rs_.uniform(1520, 1860)
    if sfree(_x, _y, 7, dn=22, de=12, flat=2.2) and ht(_x, _y) < GS.GR + 3:
        sg(rs_.choice(['cima_roca_a', 'cima_roca_b', 'cima_roca_c']), _x, _y, rs_.uniform(0, 6.28), rs_.uniform(.7, 1.15))

# ---- Orinoco bend: sandbar life, river boats, esteros, hacienda + cattle ----
_op = river_pts(SU.ORN_N[::-1])
river_life(SU.ORN_N[::-1], .06, .22, sc_rap=(.9, 1.2), skip_first=4, big=True)
for _f in (.12, .31, .52, .74):                          # fishing canoes on the open river
    _i = int(_f * (len(_op) - 1))
    _x, _y = _op[_i]
    _dx, _dy = river_dir(_op, _i)
    if ht(_x + _dy * 14, _y - _dx * 14) < SEA - 1.4:
        sg('canoa_curiara', _x + _dy * 14, _y - _dx * 14, math.atan2(_dx, _dy) + rs_.uniform(-.2, .2), 1.3, y_=SEA + .25)
for (_bx, _by, _brx, _bry, _bth, _bt) in SU.BARS:        # driftwood, a palm or two and capybaras on the sandbars
    if not (1100 < _bx < 1960 and 1100 < _by < 1760):
        continue
    for _k in range(3):
        _u, _v = rs_.uniform(-.6, .6) * _brx, rs_.uniform(-.5, .5) * _bry
        _x, _y = _bx + _u * math.cos(_bth) - _v * math.sin(_bth), _by + _u * math.sin(_bth) + _v * math.cos(_bth)
        if ht(_x, _y) > SEA + 1.4:
            sg(rs_.choice(['palma_llanera_a', 'palma_llanera_b', 'chigui_a', 'chigui_b', 'chigui_c', 'roca_llano_01', 'arbusto_llano_b']), _x, _y, rs_.uniform(0, 6.28), 1.0 if rs_.random() < .5 else 1.4, 'llanos_kit')
for (_px_, _py_, _rx_, _ry_, _th_) in SU.PONDS + SU.PONDS_W:          # capybaras bathing + a few rocks and shrubs around every estero
    sg('chigui_agua', _px_ + rs_.uniform(-.3, .3) * _rx_, _py_ + rs_.uniform(-.3, .3) * _ry_, rs_.uniform(0, 6.28), 1.5, 'llanos_kit', SEA + .05)
    for _k in range(4):
        _a = rs_.uniform(0, 6.28)
        _x, _y = _px_ + math.cos(_a) * (_rx_ + 5), _py_ + math.sin(_a) * (_ry_ + 5)
        if ht(_x, _y) > SEA + .8:
            sg(rs_.choice(['chigui_a', 'chigui_b', 'chigui_c', 'roca_llano_02', 'arbusto_llano_a', 'palma_llanera_c']), _x, _y, rs_.uniform(0, 6.28), 1.0, 'llanos_kit')
    BR.append([round(_px_), round(_py_), 2, 20, 2.5, .22, 44])
for _hx, _hy in (SU.HACIENDA, SU.HACIENDA2):
    for kind, ox, oy, rot in (('casa_hacienda_a', -16, 0, 0), ('casa_hacienda_b', 14, -3, 0), ('anexo_cobertizo', 38, 8, 0), ('molino_viento', -44, -6, .3), ('tanque_agua', -54, 8, 0),
                              ('caney', 52, -10, 0), ('pozo', -30, 14, 0), ('saman_a', -64, 2, 0), ('saman_b', 66, 4, 1.2), ('cartel_hato', 0, 46, 0)):
        _x, _y = _hx + ox, _hy + oy
        if ht(_x, _y) > SEA + 2:
            sg(kind, _x, _y, rot, 1.0, 'llanos_kit')
    _cx_, _cy_ = _hx + 2, _hy + 30
    _ncx, _ncy = 8, 4
    for _k in range(_ncx):
        for _sgn in (-1, 1):
            sg('cerca_porton' if (_sgn == 1 and _k == _ncx // 2) else 'cerca_recta', _cx_ - _ncx * 3 + 3 + _k * 6, _cy_ + _sgn * _ncy * 3, 0, 1.0, 'llanos_kit')
    for _k in range(_ncy):
        for _sgn in (-1, 1):
            sg('cerca_recta', _cx_ + _sgn * _ncx * 3, _cy_ - _ncy * 3 + 3 + _k * 6, math.pi / 2, 1.0, 'llanos_kit')
    for (_sx_, _sy_, _ro_) in ((-1, -1, 0), (1, -1, math.pi / 2), (-1, 1, -math.pi / 2), (1, 1, math.pi)):
        sg('cerca_esquina', _cx_ + _sx_ * _ncx * 3, _cy_ + _sy_ * _ncy * 3, _ro_, 1.0, 'llanos_kit')
    for kind, ox, oy in (('abrevadero', 14, 6), ('heno_a', -16, 4), ('heno_b', -10, 8), ('vaca_a', -6, -2), ('vaca_b', 4, 1), ('vaca_c', 12, -4), ('toro', 18, 4), ('caballo_a', -12, -4), ('caballo_b', 0, 6)):
        sg(kind, _cx_ + ox - 2, _cy_ + oy - 2, rs_.uniform(0, 6.28), 1.3 if kind.startswith(('vaca', 'toro', 'caballo')) else 1.0, 'llanos_kit')
for _k in range(26):                                     # herds grazing the wet savanna
    _x, _y = rs_.uniform(1030, 1440), rs_.uniform(1160, 1460)
    if sfree(_x, _y, 3, dn=18, de=10, flat=1.2) and math.hypot(_x - _hx, _y - _hy) > 60:
        if not any(math.hypot(_x - q[1], _y - q[2]) < 5 for q in SG if q[0].startswith(('vaca', 'toro', 'caballo'))):
            sg(rs_.choice(['vaca_a', 'vaca_b', 'vaca_c', 'vaca_a', 'caballo_a', 'caballo_b']), _x, _y, rs_.uniform(0, 6.28), rs_.uniform(1.2, 1.5), 'llanos_kit')
for _k in range(34):                                     # herds grazing the western Apure savanna
    _x, _y = rs_.uniform(480, 990), rs_.uniform(1150, 1420)
    if sfree(_x, _y, 3, dn=18, de=10, flat=1.2) and math.hypot(_x - SU.HACIENDA2[0], _y - SU.HACIENDA2[1]) > 60:
        if not any(math.hypot(_x - q[1], _y - q[2]) < 5 for q in SG if q[0].startswith(('vaca', 'toro', 'caballo'))):
            sg(rs_.choice(['vaca_a', 'vaca_b', 'vaca_c', 'vaca_a', 'caballo_a', 'caballo_b']), _x, _y, rs_.uniform(0, 6.28), rs_.uniform(1.2, 1.5), 'llanos_kit')
river_life(SU.META, .25, .4, skip_first=2)
for _k in range(22):                                     # rock outcrops among the eastern hills
    _x, _y = rs_.uniform(1660, 1950), rs_.uniform(1150, 1690)
    if sfree(_x, _y, 6, dn=22, de=12, flat=2.4) and ht(_x, _y) > GS.GR - 1:
        sg(rs_.choice(['cima_roca_a', 'cima_roca_b', 'cima_roca_c']), _x, _y, rs_.uniform(0, 6.28), rs_.uniform(.55, .9))

# ---- Amazonas: rapids, sandbar canoes, river village, macaws over the domes ----
river_life(SU.AMA_RUN, .10, .22, sc_rap=(.9, 1.3), skip_first=3, big=True)
river_life(SU.AMA_TRIB, .22, .35, sc_rap=(.8, 1.1), skip_first=2)
_ap2 = river_pts(SU.AMA_RUN)
for _f in (.08, .24, .41, .58, .75):
    _i = int(_f * (len(_ap2) - 1))
    _x, _y = _ap2[_i]
    _dx, _dy = river_dir(_ap2, _i)
    if ht(_x - _dy * 8, _y + _dx * 8) < SEA - 1.0:
        sg(rs_.choice(['canoa_curiara', 'canoa_b']), _x - _dy * 8, _y + _dx * 8, math.atan2(_dx, _dy) + rs_.uniform(-.2, .2), 1.2, y_=SEA + .25)
_vi = min(range(len(_ap2)), key=lambda i: math.hypot(_ap2[i][0] - SU.AMA_VILLAGE[0], _ap2[i][1] - SU.AMA_VILLAGE[1]))
_vd = (_ap2[_vi][0] - SU.AMA_VILLAGE[0], _ap2[_vi][1] - SU.AMA_VILLAGE[1])
_vn = math.hypot(*_vd)
village(SU.AMA_VILLAGE[0], SU.AMA_VILLAGE[1], (_vd[0] / _vn, _vd[1] / _vn), n_huts=10, spread=(6, 34))
for (_bx, _by, _brx, _bry, _bth, _bt) in SU.BARS:
    if _by > 1750:
        for _k in range(2):
            _u = rs_.uniform(-.5, .5) * _brx
            _x, _y = _bx + _u * math.cos(_bth), _by + _u * math.sin(_bth)
            if ht(_x, _y) > SEA + 1.4:
                sg(rs_.choice(['palma_selva_a', 'palma_selva_b', 'roca_rio_a', 'roca_rio_b', 'helecho_a']), _x, _y, rs_.uniform(0, 6.28), 1.0)
for _k in range(14):
    _t = SU.AMA_DOMES[_k % len(SU.AMA_DOMES)]
    _a = rs_.uniform(0, 6.28)
    _x, _y = _t['c'][0] + math.cos(_a) * _t['a'] * rs_.uniform(1.0, 1.6), _t['c'][1] + math.sin(_a) * _t['b'] * rs_.uniform(1.0, 1.6)
    sg(rs_.choice(['guacamaya_vuelo_a', 'guacamaya_vuelo_b', 'guacamaya_vuelo_c']), _x, _y, rs_.uniform(0, 6.28), rs_.uniform(.9, 1.2), y_=max(ht(_x, _y), SEA) + rs_.uniform(14, 44))
for _k in range(26):                                     # boulders at the dome feet and across the savanna side
    _t = SU.AMA_DOMES[_k % len(SU.AMA_DOMES)]
    _a = rs_.uniform(0, 6.28)
    _x, _y = _t['c'][0] + math.cos(_a) * _t['a'] * 1.5, _t['c'][1] + math.sin(_a) * _t['b'] * 1.5
    if sfree(_x, _y, 6, dn=22, de=12, flat=2.4):
        sg(rs_.choice(['roca_selva_01', 'roca_selva_02', 'roca_selva_03', 'roca_selva_04']), _x, _y, rs_.uniform(0, 6.28), rs_.uniform(1.8, 3.2))
# ---- Barinas / Táchira paddocks: fence lines on the lattice used by the colour pass, cattle and the odd farmhouse ----
_FW, _FH = SU.FIELD_W, SU.FIELD_H
_fcell = {}


def _is_field(ix, iy):
    k = (ix, iy)
    if k not in _fcell:
        cx, cy = (ix + .5) * _FW, (iy + .5) * _FH
        _fcell[k] = bool(SU.field_region(cx, cy) and 330 < cx < 1000 and 800 < cy < 1130 and SU.fld(ix, iy) < 62 and sfree(cx, cy, 0, dn=56, de=12, flat=1.5))
    return _fcell[k]


def _fence(x, y, rot):
    if ht(x, y) > SEA + 2.2 and d_edges(x, y) > 7 and d_nodes(x, y) > 24 and abs(ht(x + 3, y) - ht(x - 3, y)) + abs(ht(x, y + 3) - ht(x, y - 3)) < 2.2:
        sg('cerca_recta', x, y, rot, 1.0, 'llanos_kit')


for _ix in range(int(330 / _FW), int(1000 / _FW) + 1):
    for _iy in range(int(800 / _FH), int(1130 / _FH) + 1):
        if not _is_field(_ix, _iy):
            continue
        _x0, _y0 = _ix * _FW, _iy * _FH
        for _k in range(int(_FW // 6)):                                  # top edge, bottom edge only when the cell below is open land
            _fence(_x0 + 3 + _k * 6, _y0, 0)
            if not _is_field(_ix, _iy + 1):
                _fence(_x0 + 3 + _k * 6, _y0 + _FH, 0)
        for _k in range(int(_FH // 6)):
            _fence(_x0, _y0 + 3 + _k * 6, math.pi / 2)
            if not _is_field(_ix + 1, _iy):
                _fence(_x0 + _FW, _y0 + 3 + _k * 6, math.pi / 2)
        if SU.fld(_ix, _iy) % 3 != 2 and rs_.random() < .75:                # grazing paddocks (not the plowed ones)
            for _k in range(rs_.randint(2, 4)):
                sg(rs_.choice(['vaca_a', 'vaca_b', 'vaca_c', 'vaca_a', 'caballo_a']), _x0 + rs_.uniform(8, _FW - 8), _y0 + rs_.uniform(8, _FH - 8), rs_.uniform(0, 6.28), rs_.uniform(1.2, 1.5), 'llanos_kit')
        elif rs_.random() < .35:
            sg(rs_.choice(['casa_hacienda_a', 'casa_hacienda_b']), _x0 + _FW * .5, _y0 + 8, 0, 1.0, 'llanos_kit')
for _k in range(14):                                                    # canoes drifting on the Apure headwaters
    _p = SU.APURE_W[int(rs_.uniform(.05, .95) * (len(SU.APURE_W) - 1))]
    if ht(*_p) < SEA - 1.2:
        sg('canoa_curiara', _p[0], _p[1], rs_.uniform(0, 6.28), 1.0, 'canaima_kit', SEA + .25)
for (_hx, _hy) in SU.PERIJA_HAMLETS:                        # Yukpa hamlets on the Perijá foothills
    _pl = 0
    for _k in range(400):
        _x, _y = _hx + rs_.uniform(-26, 26), _hy + rs_.uniform(-26, 26)
        if sfree(_x, _y, 6.5, dn=20, de=9, flat=2.0):
            sg(rs_.choice(['choza_a', 'choza_b', 'choza_c', 'cobertizo']), _x, _y, rs_.uniform(0, 6.28))
            _pl += 1
            if _pl >= 5:
                break
    for _kind in ('fogata', 'tendedero', 'cesta_yuca', 'pila_lena'):
        for _k in range(80):
            _x, _y = _hx + rs_.uniform(-22, 22), _hy + rs_.uniform(-22, 22)
            if sfree(_x, _y, 3, dn=18, de=8, flat=2.0):
                sg(_kind, _x, _y, rs_.uniform(0, 6.28))
                break
for (_mx, _my) in ((150, 380), (128, 540), (170, 700), (210, 860), (110, 460)):   # cloud banks hugging the sierra
    BR.append([_mx, _my, 4, 30, 16 + rs_.uniform(0, 20), .5, 64])
URB.extend(SG)
print('south items', len(SG))

treeSets = {
    'coco': {'glb': 'palmas_coco', 'node': ['palm_m', 'palm_l', 'palm_lean', 'palm_s'], 's': 1.0},
    'moriche': {'glb': 'palmas_moriche', 'node': ['palm_moriche_m', 'palm_moriche_l'], 's': 1.0},
    'mangle': {'glb': 'delta_kit', 'node': ['mangle_clump_%02d' % k for k in range(1, 9)], 's': 1.15},
    'mangle_raices': {'glb': 'delta_kit', 'node': ['mangle_raices_a', 'mangle_raices_b'], 's': 1.3},
}
treeSets.update({'pino': {'glb': 'andes_kit', 'node': ['pino_s', 'pino_m', 'pino_l'], 's': 1.0}, 'arbol_and': {'glb': 'andes_kit', 'node': ['arbol_and_a', 'arbol_and_b'], 's': 1.0},
                 'frailejon': {'glb': 'andes_kit', 'node': ['frailejon_01', 'frailejon_02', 'frailejon_03'], 's': 1.5}, 'arbusto': {'glb': 'andes_kit', 'node': ['arbusto_a', 'arbusto_b', 'arbusto_c'], 's': 1.0},
                 'roca': {'glb': 'andes_kit', 'node': ['roca_01', 'roca_02', 'roca_03', 'roca_04', 'roca_05', 'roca_06'], 's': 1.0}})
treeSets.update({'arbol_llano': {'glb': 'llanos_kit', 'node': ['arbol_llano_a', 'arbol_llano_b', 'arbol_llano_c'], 's': .8}, 'saman': {'glb': 'llanos_kit', 'node': ['saman_a', 'saman_b'], 's': .85},
                 'palma_llanera': {'glb': 'llanos_kit', 'node': ['palma_llanera_a', 'palma_llanera_b', 'palma_llanera_c'], 's': 1.0}, 'arbusto_llano': {'glb': 'llanos_kit', 'node': ['arbusto_llano_a', 'arbusto_llano_b', 'arbusto_llano_c'], 's': 1.0},
                 'mata_llano': {'glb': 'llanos_kit', 'node': ['mata_hierba_a', 'mata_hierba_b'], 's': 1.0}, 'roca_llano': {'glb': 'llanos_kit', 'node': ['roca_llano_%02d' % k for k in range(1, 7)], 's': 1.0},
                 'matorral': {'glb': 'llanos_kit', 'node': 'matorral_espinoso', 's': 1.0}})
treeSets.update({'cardon': {'glb': 'falcon_kit', 'node': ['cardon_a', 'cardon_b', 'cardon_c'], 's': 1.0}, 'cardon_peq': {'glb': 'falcon_kit', 'node': ['cardon_pequeno_a', 'cardon_pequeno_b'], 's': 1.0},
                 'tuna': {'glb': 'falcon_kit', 'node': ['tuna_a', 'tuna_b'], 's': 1.0}, 'agave': {'glb': 'falcon_kit', 'node': ['agave_a', 'agave_b'], 's': 1.0},
                 'arbusto_seco': {'glb': 'falcon_kit', 'node': ['arbusto_seco_a', 'arbusto_seco_b', 'arbusto_seco_c'], 's': 1.0}, 'cuji': {'glb': 'falcon_kit', 'node': ['cuji_a', 'cuji_b', 'cuji_c'], 's': .9},
                 'arbol_falcon': {'glb': 'falcon_kit', 'node': ['arbol_falcon_a', 'arbol_falcon_b'], 's': .85}, 'palma_falcon': {'glb': 'falcon_kit', 'node': ['palma_falcon_a', 'palma_falcon_b'], 's': 1.0},
                 'roca_arida': {'glb': 'falcon_kit', 'node': ['roca_arida_%02d' % k for k in range(1, 7)], 's': 1.0}})
treeSets.update({'arbol_selva': {'glb': 'canaima_kit', 'node': ['arbol_selva_a', 'arbol_selva_b', 'arbol_selva_c'], 's': 1.0}, 'arbol_alto': {'glb': 'canaima_kit', 'node': 'arbol_selva_alto', 's': 1.0},
                 'palma_selva': {'glb': 'canaima_kit', 'node': ['palma_selva_a', 'palma_selva_b'], 's': 1.0}, 'platanillo': {'glb': 'canaima_kit', 'node': ['platanillo_a', 'platanillo_b'], 's': 1.0},
                 'helecho': {'glb': 'canaima_kit', 'node': ['helecho_a', 'helecho_b'], 's': 1.0}, 'arbusto_selva': {'glb': 'canaima_kit', 'node': ['arbusto_selva_a', 'arbusto_selva_b'], 's': 1.0},
                 'arbolito_cima': {'glb': 'canaima_kit', 'node': ['arbolito_cima_a', 'arbolito_cima_b'], 's': 1.0}, 'arbusto_cima': {'glb': 'canaima_kit', 'node': ['arbusto_cima_a', 'arbusto_cima_b'], 's': 1.0},
                 'roca_cima': {'glb': 'canaima_kit', 'node': ['roca_cima_a', 'roca_cima_b'], 's': 1.0}, 'roca_selva': {'glb': 'canaima_kit', 'node': ['roca_selva_%02d' % k for k in range(1, 5)], 's': 1.0},
                 'roca_rio': {'glb': 'canaima_kit', 'node': ['roca_rio_a', 'roca_rio_b', 'roca_rio_c'], 's': 1.0}})
for _k in ('palapa_a', 'palapa_b', 'sombrilla_coral', 'sombrilla_amarilla', 'sombrilla_teal', 'set_palapa', 'set_sombrilla', 'camastro_a', 'camastro_b', 'bar_kiosco'):
    treeSets[_k] = {'glb': 'playa_kit', 'node': _k, 's': 1.6}
treeSets.update({'arbusto_costa': {'glb': 'caribe_kit', 'node': ['arbusto_costa_a', 'arbusto_costa_b', 'arbusto_costa_c'], 's': 1.2}, 'cactus_costa': {'glb': 'caribe_kit', 'node': ['cactus_costa_a', 'cactus_costa_b'], 's': 1.2}, 'uva_playa': {'glb': 'caribe_kit', 'node': ['uva_playa'], 's': 1.2}})
# the lake bridge between the two lake-shore tiles
pu = None
json.dump({'props': items, 'treeSets': treeSets, 'puente': pu, 'urbs': URB, 'boats': BOATS, 'brumas': BR}, open(os.path.join(OUT, 'placements.json'), 'w'))
print('placed', len(items), 'skipped', SKIPPED)
