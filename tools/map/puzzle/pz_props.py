"""Procedural low-poly props (vertex coloured, merged into a few objects per section). Authored right-handed,
x east / y SOUTH (canvas frame); make_mesh_obj mirrors y into Blender."""
import numpy as np
from pz_lib import *

rng = np.random.default_rng(7)


# ───────────────────────── primitives (return V Nx3, F list, C Nx3 srgb) ─────────────────────────
class Mesh:
    def __init__(s):
        s.V = []; s.F = []; s.C = []; s.S = []; s.n = 0

    def add(s, V, F, col, smooth=False, shade=None):
        V = np.asarray(V, float)
        c = np.asarray(col, float)
        if c.ndim == 1:
            c = np.tile(c, (len(V), 1))
        if shade is not None:
            c = c * shade[:, None]
        s.V.append(V); s.C.append(c)
        s.F += [tuple(i + s.n for i in f) for f in F]
        s.S += [smooth] * len(F); s.n += len(V)
        return s

    def arrays(s):
        return np.vstack(s.V), s.F, np.vstack(s.C), s.S


def rotz(V, a):
    ca, sa = math.cos(a), math.sin(a)
    V = np.array(V, float)
    x = V[:, 0] * ca - V[:, 1] * sa; y = V[:, 0] * sa + V[:, 1] * ca
    V[:, 0], V[:, 1] = x, y
    return V


def cyl(r0, r1, h, seg=8, z0=0.0, cap=True, c0=(0, 0), tilt=(0, 0)):
    a = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    bot = np.stack([c0[0] + r0 * np.cos(a), c0[1] + r0 * np.sin(a), np.full(seg, z0)], -1)
    top = np.stack([c0[0] + tilt[0] + r1 * np.cos(a), c0[1] + tilt[1] + r1 * np.sin(a), np.full(seg, z0 + h)], -1)
    V = np.vstack([bot, top]); F = []
    for i in range(seg):
        j = (i + 1) % seg
        F.append((i, j, seg + j, seg + i))
    if cap and r1 > 1e-6:
        V = np.vstack([V, [[c0[0] + tilt[0], c0[1] + tilt[1], z0 + h]]])
        for i in range(seg):
            F.append((seg + i, seg + (i + 1) % seg, 2 * seg))
    return V, F


def tube(p0, p1, r, seg=4):
    """Prism between two 3D points."""
    p0 = np.array(p0, float); p1 = np.array(p1, float)
    d = p1 - p0; L = np.linalg.norm(d)
    if L < 1e-6:
        return np.zeros((0, 3)), []
    d /= L
    up = np.array([0, 0, 1.0]) if abs(d[2]) < 0.95 else np.array([1.0, 0, 0])
    u = np.cross(d, up); u /= np.linalg.norm(u); v = np.cross(d, u)
    a = np.linspace(0, 2 * np.pi, seg, endpoint=False) + np.pi / seg
    ring = (np.cos(a)[:, None] * u + np.sin(a)[:, None] * v) * r
    V = np.vstack([p0 + ring, p1 + ring]); F = []
    for i in range(seg):
        j = (i + 1) % seg
        F.append((i, j, seg + j, seg + i))
    return V, F


def box(w, d, h, z0=0.0, c0=(0, 0)):
    x, y = w / 2, d / 2
    V = np.array([[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [-x, -y, h], [x, -y, h], [x, y, h], [-x, y, h]], float)
    V[:, 0] += c0[0]; V[:, 1] += c0[1]; V[:, 2] += z0
    F = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return V, F


def gable(w, d, h, z0, over=0.5, ridge='x', c0=(0, 0)):
    x, y = w / 2 + over, d / 2 + over
    if ridge == 'x':
        V = np.array([[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [-x, 0, h], [x, 0, h]], float)
        F = [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5)]
    else:
        V = np.array([[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [0, -y, h], [0, y, h]], float)
        F = [(0, 1, 4), (2, 3, 5), (4, 5, 3, 0), (5, 4, 1, 2)]
    V[:, 0] += c0[0]; V[:, 1] += c0[1]; V[:, 2] += z0
    return V, F


def hip(w, d, h, z0, over=0.4, c0=(0, 0)):
    x, y = w / 2 + over, d / 2 + over
    V = np.array([[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [0, 0, h]], float)
    V[:, 0] += c0[0]; V[:, 1] += c0[1]; V[:, 2] += z0
    return V, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)]


_ico = {}


def ico(sub=1):
    if sub in _ico:
        return _ico[sub]
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    V = np.array([v.co[:] for v in bm.verts]); F = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    _ico[sub] = (V, F)
    return _ico[sub]


def blob(c, r, sq=0.85, sub=1, jit=0.1, seed=0):
    V, F = ico(sub)
    rg = np.random.default_rng(seed)
    k = 1 + jit * (rg.random(len(V)) - 0.5) * 2
    P = V * k[:, None] * np.array([r, r, r * sq])
    P += np.array(c)
    return P, F


def lerp(a, b, t):
    return np.asarray(a) + (np.asarray(b) - np.asarray(a)) * t


# ───────────────────────── templates ─────────────────────────
def shade_z(V, z0, z1, lo=0.7, hi=1.15):
    t = np.clip((V[:, 2] - z0) / max(z1 - z0, 1e-6), 0, 1)
    return lo + (hi - lo) * t


TRUNK = hexc(0x6a4a2e)
GREENS = [hexc(0x3a6a2e), hexc(0x4c7a34), hexc(0x66883a), hexc(0x2d5a2c), hexc(0x5a7e3a)]


def tone(V, seed, amt=0.16):
    """Per-vertex value noise so canopies read as soft clusters of leaves."""
    return 1.0 + amt * (vnoise(V[:, 0] * 1.3 + seed, V[:, 1] * 1.3 + V[:, 2] * 0.9, seed) - 0.5) * 2


def t_tree(seed, scale=1.0):
    """Faceted low-poly trees in three silhouettes: broadleaf, cypress, umbrella (acacia)."""
    rg = np.random.default_rng(seed)
    m = Mesh()
    kind = seed % 7
    g = GREENS[seed % 5]
    if kind in (5,):                                   # cypress / tall narrow
        h = 7.5 + rg.random() * 3.0
        V, F = cyl(0.35, 0.25, 1.2, 5, 0, cap=False); m.add(V, F, TRUNK)
        for i in range(3):
            V, F = blob((0, 0, 1.4 + i * h * 0.22 + 0.9), 1.5 - i * 0.28, 1.9 + i * 0.2, 1, 0.14, seed + i)
            m.add(V, F, g * 0.85, False, shade_z(V, 0, h, 0.65, 1.2))
    elif kind == 6:                                    # umbrella
        h = 3.6 + rg.random() * 1.2
        V, F = tube((0, 0, 0), (0.4, 0.2, h), 0.38, 5); m.add(V, F, TRUNK)
        V, F = blob((0.4, 0.2, h + 0.7), 4.4, 0.34, 1, 0.2, seed); m.add(V, F, g * 1.05, False, shade_z(V, h, h + 2, 0.78, 1.2))
        V, F = blob((-1.2, 0.8, h + 0.3), 2.4, 0.4, 1, 0.2, seed + 1); m.add(V, F, g * 0.95, False)
    else:                                              # broadleaf
        h = 2.4 + rg.random() * 1.2
        V, F = tube((0, 0, 0), (0, 0, h + 0.5), 0.5, 6); m.add(V, F, TRUNK, False, shade_z(V, 0, h, 0.7, 1.0))
        n = 2 + int(rg.random() * 2)
        for i in range(n):
            ang = rg.random() * 6.28; rr = (0.6 + rg.random() * 1.2) if i else 0
            c = (math.cos(ang) * rr, math.sin(ang) * rr, h + 1.2 + (i % 2) * 0.7)
            r = (3.0 if i == 0 else 2.2) + rg.random() * 0.8
            V, F = blob(c, r, 0.82, 1, 0.24, seed * 7 + i)
            m.add(V, F, g * (0.92 + 0.2 * rg.random()), False, shade_z(V, h - 0.5, h + 5, 0.62, 1.22))
    V, F, C, S = m.arrays(); V = V * scale
    return V, F, C, S


def t_palm(seed, scale=1.0):
    rg = np.random.default_rng(seed)
    m = Mesh()
    H = 7.5 + rg.random() * 2.5
    lean = (rg.random() - 0.5) * 2.2; leand = rg.random() * 6.28
    segs = 5; pts = []
    for i in range(segs + 1):
        t = i / segs
        pts.append((math.cos(leand) * lean * t * t, math.sin(leand) * lean * t * t, H * t))
    for i in range(segs):
        r0 = 0.38 - 0.04 * i; r1 = 0.38 - 0.04 * (i + 1)
        V, F = tube(pts[i], pts[i + 1], (r0 + r1) / 2, 5)
        m.add(V, F, lerp(hexc(0x9a7a52), hexc(0x7a5c3c), i / segs))
    top = np.array(pts[-1])
    nf = 8
    for k in range(nf):
        a = k / nf * 2 * np.pi + rg.random() * 0.3
        ca, sa = math.cos(a), math.sin(a)
        L = 4.4 + rg.random() * 1.0
        prof = []
        for j in range(5):
            t = j / 4
            prof.append((ca * L * t, sa * L * t, top[2] + 1.2 * math.sin(t * 2.6) - 1.9 * t * t * t))
        wv = [0.15, 0.85, 0.7, 0.45, 0.05]
        Vv = []
        for j in range(5):
            p = np.array(prof[j]) + np.array([top[0], top[1], 0])
            side = np.array([-sa, ca, 0]) * wv[j]
            Vv += [p - side, p + side]
        Ff = [(2 * j, 2 * j + 1, 2 * j + 3, 2 * j + 2) for j in range(4)]
        m.add(Vv, Ff, GREENS[(seed + k) % 5] * (0.95 + 0.15 * (k % 2)) if False else lerp(hexc(0x3f8a34), hexc(0x66a844), (k % 3) / 2))
    V, F, C, S = m.arrays(); V = V * scale
    return V, F, C, S


def t_cactus(seed, scale=1.0):
    rg = np.random.default_rng(seed)
    m = Mesh()
    H = 6.5 + rg.random() * 3.5
    col = lerp(hexc(0x3a8a3c), hexc(0x4d9a3e), rg.random())
    V, F = cyl(0.95, 0.85, H, 7, 0, cap=False); m.add(V, F, col, True)
    V, F = blob((0, 0, H), 0.88, 1.0, 1, 0.02, seed); m.add(V, F, col, True)
    for sgn in ((-1, 1) if rg.random() < 0.7 else (1,)):
        z = H * (0.35 + rg.random() * 0.25); arm = 1.8 + rg.random() * 0.8; up = 2.4 + rg.random() * 2.2
        V, F = tube((0, 0, z), (sgn * arm, 0, z + 0.2), 0.5, 6); m.add(V, F, col, True)
        V, F = tube((sgn * arm, 0, z), (sgn * arm, 0, z + up), 0.52, 6); m.add(V, F, col, True)
        V, F = blob((sgn * arm, 0, z + up), 0.55, 1.0, 1, 0.02, seed); m.add(V, F, col, True)
    V, F, C, S = m.arrays(); V = V * scale
    return V, F, C, S


def t_shrub(seed, scale=1.0, dry=False):
    rg = np.random.default_rng(seed)
    m = Mesh()
    base = hexc(0x8a9a44) if dry else hexc(0x3f7f34)
    for i in range(2 + int(rg.random() * 2)):
        V, F = blob((rg.normal() * 0.6, rg.normal() * 0.6, 0.6), 0.9 + rg.random() * 0.5, 0.7, 1, 0.15, seed + i)
        m.add(V, F, base * (0.85 + 0.3 * rg.random()), True, shade_z(V, 0, 1.6, 0.7, 1.15))
    V, F, C, S = m.arrays(); return V * scale, F, C, S


def t_boulder(seed, scale=1.0, palette=None):
    rg = np.random.default_rng(seed)
    palette = palette or [hexc(0x9c7a58), hexc(0xb18c63), hexc(0x7f6247), hexc(0xa08868)]
    m = Mesh()
    for i in range(1 + int(rg.random() * 3)):
        r = 1.2 + rg.random() * 1.6
        V, F = blob((rg.normal() * 1.2, rg.normal() * 1.2, r * 0.3), r, 0.7, 1, 0.35, seed * 5 + i)
        m.add(V, F, palette[int(rg.random() * len(palette))] * (0.9 + 0.2 * rg.random()), False, shade_z(V, -1, 3, 0.75, 1.15))
    V, F, C, S = m.arrays(); return V * scale, F, C, S


CASAS = [0xf6f0e0, 0xf6f0e0, 0xf1e6c8, 0xe9d8b0, 0xf4d9c4, 0xdcebf0]
ROOFS = [0xc4553a, 0xb4482f, 0xcf6a44, 0xa83e2c]
COLORFUL = [0xe8b83a, 0xd9503a, 0x4a8fd0, 0xf08c3a, 0x5db08a, 0xe86a8a, 0xf2ecd8, 0x9a6ac8]


def t_house(seed, colorful=False, flat_roof=False):
    """Pitched/hip roofs, optional L-wing, porch, chimney, shutters. flat_roof=True gives low-rise city blocks with parapets + water tank."""
    rg = np.random.default_rng(seed)
    m = Mesh()
    w = 5.2 + rg.random() * 2.6; d = 4.4 + rg.random() * 2.0
    two = rg.random() < 0.35
    h = (2.9 + rg.random() * 0.9) * (1.75 if two else 1.0)
    wall = hexc(COLORFUL[seed % len(COLORFUL)] if colorful else CASAS[seed % len(CASAS)])
    roof = hexc(ROOFS[(seed // 3) % 4]) * (0.92 + 0.16 * rg.random())
    V, F = box(w, d, h); m.add(V, F, wall)
    V, F = box(w + 0.25, d + 0.25, 0.4, 0.0); m.add(V, F, wall * 0.75)
    wing = rg.random() < 0.45 and not flat_roof
    if wing:
        ww, wd, wh = w * 0.5, d * 0.7, h * 0.78
        cx_, cy_ = w / 2 + ww / 2 - 0.2, d * 0.15
        V, F = box(ww, wd, wh, 0, (cx_, cy_)); m.add(V, F, wall * 0.97)
        V, F = hip(ww, wd, 1.5, wh, 0.4, (cx_, cy_)); m.add(V, F, roof * 0.95)
    if flat_roof:
        V, F = box(w + 0.5, d + 0.5, 0.35, h); m.add(V, F, wall * 0.78)                 # cornice
        V, F = box(w + 0.1, d + 0.1, 0.5, h + 0.35); m.add(V, F, wall * 0.9)           # parapet band
        if rg.random() < 0.5:
            V, F = cyl(0.9, 0.9, 1.5, 7, h + 0.4, True, (w * 0.22, d * 0.2)); m.add(V, F, hexc(0xd8dade))
        if rg.random() < 0.4:
            V, F = box(1.6, 1.6, 1.2, h + 0.4, (-w * 0.25, -d * 0.15)); m.add(V, F, wall * 0.85)
    else:
        rh = 1.8 + rg.random() * 1.0
        if rg.random() < 0.5:
            V, F = hip(w, d, rh, h, 0.55)
        else:
            V, F = gable(w, d, rh, h, 0.55, 'x' if w > d else 'y')
        m.add(V, F, roof)
        if rg.random() < 0.55:
            V, F = box(0.8, 0.8, 1.9, h + 0.8, (w * 0.22, d * 0.1)); m.add(V, F, hexc(0x9a6a52))
    glass = hexc(0x3f6a88); trim = hexc(0xf6f0e0)
    for lv in range(2 if two else 1):
        z = 1.3 + lv * 3.0
        for fx in (-w * 0.3, w * 0.3):
            V, F = box(1.0, 0.2, 1.2, z, (fx, -d / 2 - 0.05)); m.add(V, F, glass)
            V, F = box(1.5, 0.14, 0.18, z - 0.18, (fx, -d / 2 - 0.1)); m.add(V, F, trim)
            for sx in (-0.7, 0.7):
                V, F = box(0.35, 0.12, 1.2, z, (fx + sx, -d / 2 - 0.08)); m.add(V, F, hexc(0x3f7a5a))      # shutters
    V, F = box(1.1, 0.35, 2.1, 0, (0, -d / 2 - 0.05)); m.add(V, F, hexc(0x6a4a2e))
    if rg.random() < 0.5:                                                                  # porch with posts
        V, F = box(w * 0.7, 1.6, 0.25, 2.5, (0, -d / 2 - 0.8)); m.add(V, F, roof * 0.9)
        for sx in (-w * 0.3, w * 0.3):
            V, F = tube((sx, -d / 2 - 1.4, 0), (sx, -d / 2 - 1.4, 2.5), 0.12, 4); m.add(V, F, trim)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_lamp(seed=0):
    m = Mesh()
    V, F = tube((0, 0, 0), (0, 0, 3.4), 0.12, 4); m.add(V, F, hexc(0x3a3a40))
    V, F = blob((0, 0, 3.6), 0.4, 1.0, 1, 0.0, 1); m.add(V, F, hexc(0xfff0b0), True)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_fountain(seed=0):
    m = Mesh()
    V, F = cyl(3.2, 3.2, 0.7, 14, 0, True); m.add(V, F, hexc(0xb8b2a2))
    V, F = cyl(2.7, 2.7, 0.1, 14, 0.62, True); m.add(V, F, hexc(0x6ac0e8))
    V, F = cyl(0.5, 0.35, 2.0, 8, 0.6, True); m.add(V, F, hexc(0xd0cabb))
    V, F = blob((0, 0, 2.7), 0.7, 0.8, 1, 0.0, 1); m.add(V, F, hexc(0xbfe8f8), True)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_tuft(seed, flower=False):
    rg = np.random.default_rng(seed)
    m = Mesh()
    base = lerp(hexc(0x6a9a3a), hexc(0x9ab04a), rg.random())
    for i in range(4):
        a = i * 1.57 + rg.random()
        V, F = tube((math.cos(a) * 0.15, math.sin(a) * 0.15, 0), (math.cos(a) * 0.5, math.sin(a) * 0.5, 0.9 + rg.random() * 0.4), 0.09, 3)
        m.add(V, F, base)
    if flower:
        V, F = blob((0, 0, 0.8), 0.28, 1.0, 1, 0.0, seed); m.add(V, F, hexc([0xf2e04a, 0xf08ab0, 0xf4f4f0, 0xe0603a][seed % 4]), True)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_church(seed=0):
    m = Mesh()
    wall = hexc(0xf0d98a); wall2 = hexc(0xf6f0e0); red = hexc(0xc4553a)
    V, F = box(9, 15, 6.5, 0, (0, 1.5)); m.add(V, F, wall)
    V, F = gable(9, 15, 3.2, 6.5, 0.7, 'y', (0, 1.5)); m.add(V, F, red)
    V, F = box(5.4, 5.4, 12.5, 0, (0, -7)); m.add(V, F, wall)
    V, F = box(6.0, 6.0, 0.7, 12.5, (0, -7)); m.add(V, F, wall2)
    V, F = box(3.8, 3.8, 3.0, 13.2, (0, -7)); m.add(V, F, wall2)
    V, F = hip(3.8, 3.8, 3.2, 16.2, 0.4, (0, -7)); m.add(V, F, red)
    V, F = blob((0, 1.5, 8.2), 3.4, 0.9, 1, 0.0, 1); m.add(V, F, wall2, True)
    V, F = box(1.6, 0.4, 3.2, 0, (0, -10.1)); m.add(V, F, hexc(0x5a4a3a))
    for zz in (4.5,):
        for yy in (-3.0, 1.0, 5.0):
            for sx in (-4.55, 4.55):
                V, F = box(0.2, 1.1, 2.0, zz, (sx, yy)); m.add(V, F, hexc(0x3f6a88))
    V, F = box(0.3, 0.3, 1.8, 19.2, (0, -7)); m.add(V, F, hexc(0xf6f0e0))
    V, F = box(1.2, 0.3, 0.3, 20.4, (0, -7)); m.add(V, F, hexc(0xf6f0e0))
    for dx in (-1.6, 0, 1.6):
        V, F = box(0.9, 0.2, 1.6, 6.8, (dx, -9.8)); m.add(V, F, hexc(0x3f6a88))
    V, F, C, S = m.arrays(); return V, F, C, S


def t_derrick(seed=0):
    m = Mesh()
    dark = hexc(0x2e2824); yel = hexc(0xe8b820); H = 24.0; b = 3.4; t = 1.1
    legs = [(sx, sy) for sx in (-1, 1) for sy in (-1, 1)]
    for sx, sy in legs:
        V, F = tube((sx * b, sy * b, 0), (sx * t, sy * t, H), 0.5, 4); m.add(V, F, dark)
    for z in (H * 0.33, H * 0.66, H):
        w = b + (t - b) * z / H
        for (ax, ay), (bx, by) in [((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))]:
            V, F = tube((ax * w, ay * w, z), (bx * w, by * w, z), 0.26, 4); m.add(V, F, dark)
    for (ax, ay), (bx, by) in [((-1, -1), (1, -1)), ((1, 1), (-1, 1))]:                  # one X per visible face
        V, F = tube((ax * b, ay * b, 0), (bx * (b + (t - b) * 0.5), by * (b + (t - b) * 0.5), H * 0.5), 0.2, 4); m.add(V, F, dark)
        V, F = tube((bx * b, by * b, 0), (ax * (b + (t - b) * 0.5), ay * (b + (t - b) * 0.5), H * 0.5), 0.2, 4); m.add(V, F, dark)
    V, F = box(3.4, 3.4, 1.8, H - 0.2); m.add(V, F, yel)
    V, F = box(1.6, 1.6, 2.2, H + 1.6); m.add(V, F, dark)
    V, F = box(8, 8, 0.5, 0); m.add(V, F, hexc(0x8a8478))
    V, F, C, S = m.arrays(); return V, F, C, S


def t_tank(seed=0):
    m = Mesh()
    r = 3.6 + (seed % 3) * 0.5; h = 3.6 + (seed % 2)
    V, F = cyl(r, r, h, 12, 0, cap=True); m.add(V, F, hexc(0xe8e8ec), False)
    V, F = cyl(r + 0.05, r + 0.05, 0.5, 12, h * 0.55, cap=False); m.add(V, F, hexc(0xc0c4cc))
    V, F, C, S = m.arrays(); return V, F, C, S


def t_shed(seed=0):
    m = Mesh()
    V, F = box(6, 4, 2.6); m.add(V, F, hexc(0xd8dade))
    V, F = box(6.4, 4.4, 0.4, 2.6); m.add(V, F, hexc(0x8a93a3))
    V, F, C, S = m.arrays(); return V, F, C, S


def _hull(L, W, H, deck, hullc, m, z0=0.0):
    xs = np.linspace(-L / 2, L / 2, 8)
    hw = np.array([0.62, 0.92, 1.0, 1.0, 0.98, 0.84, 0.5, 0.0]) * W / 2
    V = []
    for x, w in zip(xs, hw):
        V += [[x, -w, z0 + H], [x, w, z0 + H], [x, w * 0.62, z0], [x, -w * 0.62, z0]]
    V = np.array(V, float); F = []
    n = len(xs)
    for i in range(n - 1):
        a, b = i * 4, (i + 1) * 4
        F += [(a, a + 1, b + 1, b)[::-1], (a + 1, a + 2, b + 2, b + 1)[::-1], (a + 3, a, b, b + 3)[::-1], (a + 2, a + 3, b + 3, b + 2)[::-1]]
    F += [(0, 1, 2, 3)]
    m.add(V, F, np.where(np.arange(len(V))[:, None] % 4 < 2, deck, hullc), False)


def t_boat(seed=0, kind='fish'):
    m = Mesh()
    if kind == 'tanker':
        _hull(30, 8, 3.4, hexc(0x3a3a42), hexc(0x2a2a30), m, 0.1)
        V, F = box(24, 7.4, 0.5, 3.4, (1, 0)); m.add(V, F, hexc(0xb03a2a))
        V, F = box(5, 6, 5.5, 3.6, (-11, 0)); m.add(V, F, hexc(0xf0f0f0))
        V, F = box(5.4, 6.4, 0.5, 9.0, (-11, 0)); m.add(V, F, hexc(0xe8b820))
        V, F = cyl(0.9, 0.9, 2.6, 6, 9.4, True, (-12.5, 0)); m.add(V, F, hexc(0xd9503a))
        for i in range(4):
            V, F = cyl(1.8, 1.8, 1.8, 8, 3.9, True, (-3 + i * 5.2, 0)); m.add(V, F, hexc(0xd8dade))
    else:
        col = [hexc(0xd9503a), hexc(0x2f6fb0), hexc(0xe8b820)][seed % 3]
        _hull(8.5, 3.0, 1.5, hexc(0xf4f4f0), col, m, 0.0)
        V, F = box(2.6, 2.0, 1.7, 1.5, (-1.0, 0)); m.add(V, F, hexc(0xf4f4f0))
        V, F = box(2.8, 2.2, 0.28, 3.2, (-1.0, 0)); m.add(V, F, col)
        V, F = tube((1.2, 0, 1.5), (1.2, 0, 4.4), 0.1, 4); m.add(V, F, hexc(0x666666))
    V, F, C, S = m.arrays(); return V, F, C, S


# ───────────────────────── instancing / scatter ─────────────────────────
class Scatter:
    def __init__(s, name):
        s.name = name; s.m = Mesh()

    def put(s, tpl, x, y, z, rot=0.0, sc=1.0, tint=None):
        V, F, C, S = tpl
        P = rotz(V * sc, rot) + np.array([x, y, z])
        c = C if tint is None else C * tint
        s.m.add(P, F, c, False)
        s.m.S[-len(F):] = S

    def build(s, coll=None, mat=None):
        if not s.m.V:
            return None
        V, F, C, S = s.m.arrays()
        return make_mesh_obj(s.name, V, F, C, S, coll, mat or vc_material())


def place_many(W, F, sc_, tpls, pts, sc_range=(0.85, 1.25), zoff=-0.2, rot=True):
    """pts: Nx2 canvas coords. tpls: list of templates picked randomly."""
    if len(pts) == 0:
        return 0
    zs = W.sample(F['Z'], pts[:, 0], pts[:, 1])
    for (x, y), z in zip(pts, zs):
        t = tpls[int(rng.random() * len(tpls))]
        sc_.put(t, x, y, z + zoff, rng.random() * 6.28 if rot else 0.0, sc_range[0] + rng.random() * (sc_range[1] - sc_range[0]))
    return len(pts)


def jgrid(rect, step, jit=0.45):
    x0, y0, x1, y1 = rect
    xs = np.arange(x0, x1, step); ys = np.arange(y0, y1, step)
    X, Y = np.meshgrid(xs, ys)
    X = X + (rng.random(X.shape) - 0.5) * 2 * jit * step; Y = Y + (rng.random(Y.shape) - 0.5) * 2 * jit * step
    return np.stack([X.ravel(), Y.ravel()], -1)


def ribbon(W, F, pts, width, zoff, color, name, coll=None, closed=False):
    """Terrain-hugging strip along a polyline of canvas points."""
    pts = np.asarray(pts, float)
    seg = [pts[0]]
    for a, b in zip(pts[:-1], pts[1:]):
        k = max(1, int(np.hypot(*(b - a)) / 2.0))
        for i in range(1, k + 1):
            seg.append(a + (b - a) * i / k)
    P = np.array(seg)
    t = np.gradient(P, axis=0); t /= (np.linalg.norm(t, axis=1, keepdims=True) + 1e-9)
    nrm = np.stack([-t[:, 1], t[:, 0]], -1)
    L = P + nrm * width / 2; R = P - nrm * width / 2
    zl = W.sample(F['Z'], L[:, 0], L[:, 1]) + zoff; zr = W.sample(F['Z'], R[:, 0], R[:, 1]) + zoff
    V = np.vstack([np.column_stack([L, zl]), np.column_stack([R, zr])]); n = len(P)
    Fc = [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)]
    C = np.tile(color, (len(V), 1))
    return make_mesh_obj(name, V, Fc, C, None, coll, vc_material())


def disc(x, y, z, r, color, name, seg=20, coll=None, h=0.5):
    V, Fc = cyl(r, r, h, seg, z, True, (x, y))
    return make_mesh_obj(name, V, Fc, np.tile(color, (len(V), 1)), None, coll, vc_material())


def t_tower_block(seed):
    rg = np.random.default_rng(seed)
    m = Mesh()
    h = 9 + rg.random() * 10; w = 4.8 + rg.random() * 1.6
    col = hexc([0xe8e4d8, 0xcfe0ea, 0xf0d8b8, 0xd9e6d0][seed % 4])
    V, F = box(w, w, h * 0.72); m.add(V, F, col)
    V, F = box(w * 0.72, w * 0.72, h * 0.28, h * 0.72); m.add(V, F, col * 0.95)        # setback
    V, F = box(w * 0.4, w * 0.4, 1.6, h); m.add(V, F, col * 0.8)                       # crown
    V, F = box(0.3, 0.3, 2.4, h + 1.6); m.add(V, F, hexc(0x888888))                   # antenna
    for k in range(int(h * 0.72 // 2.4)):
        V, F = box(w + 0.08, w + 0.08, 0.5, 1.5 + k * 2.4); m.add(V, F, hexc(0x4a6a8a))
    V, F, C, S = m.arrays(); return V, F, C, S


def t_palafito(seed=0):
    m = Mesh()
    wall = hexc(COLORFUL[seed % len(COLORFUL)])
    for sx in (-1, 1):
        for sy in (-1, 1):
            V, F = tube((sx * 2.2, sy * 1.6, -9), (sx * 2.2, sy * 1.6, 1.6), 0.28, 4); m.add(V, F, hexc(0x5a3a20))
    V, F = box(7.0, 5.0, 0.35, 1.5); m.add(V, F, hexc(0x7a5230))
    V, F = box(4.6, 3.6, 2.6, 1.85); m.add(V, F, wall)
    V, F = gable(4.6, 3.6, 1.7, 4.45, 0.5, 'x'); m.add(V, F, hexc(0xb8c0c8))
    V, F, C, S = m.arrays(); return V, F, C, S


def t_cloud(seed=0, n=26, R=44):
    rg = np.random.default_rng(seed)
    m = Mesh()
    for i in range(n):
        a = rg.random() * 6.28; r = R * math.sqrt(rg.random()) * 0.85
        c = (math.cos(a) * r, math.sin(a) * r * 0.65, rg.random() * 9 - 4.5 + (1.5 - r / R * 3))
        rad = 8 + rg.random() * 9
        V, F = blob(c, rad, 0.55, 2, 0.1, seed * 31 + i)
        t = np.clip((V[:, 2] + 12) / 24.0, 0, 1)
        cols = np.array([lerp(hexc(0x4f5468), hexc(0xe9ecf4), tv) for tv in t])
        m.add(V, F, cols, True)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_bolt(seed=0, H=60.0):
    rg = np.random.default_rng(seed)
    m = Mesh()
    p = np.array([0.0, 0.0, 0.0]); k = 8; pts = [p.copy()]
    for i in range(k):
        p = p + np.array([(rg.random() - 0.5) * 7, (rg.random() - 0.5) * 7, -H / k]); pts.append(p.copy())
        V, F = tube(pts[-2], pts[-1], 0.22, 3); m.add(V, F, hexc(0xfff6d0))
    for s in (3, 5):                                   # side branches
        q = pts[s].copy()
        for j in range(2):
            q2 = q + np.array([(rg.random() - 0.3) * 6, (rg.random() - 0.5) * 6, -H / k * 0.8])
            V, F = tube(q, q2, 0.14, 3); m.add(V, F, hexc(0xfff6d0)); q = q2
    V, F, C, S = m.arrays(); return V, F, C, S


def t_chapel(seed=0):
    m = Mesh()
    wall = hexc(0xf4efe0); roof = hexc(0xb4482f)
    V, F = box(6.5, 9, 4.5, 0, (0, 0.5)); m.add(V, F, wall)
    V, F = gable(6.5, 9, 2.6, 4.5, 0.5, 'y', (0, 0.5)); m.add(V, F, roof)
    V, F = box(2.2, 0.8, 3.6, 4.6, (0, -3.9)); m.add(V, F, wall)
    V, F = box(1.0, 0.9, 1.4, 6.6, (0, -3.9)); m.add(V, F, hexc(0x3a3a40))
    V, F = box(1.6, 0.3, 2.6, 0, (0, -4.1)); m.add(V, F, hexc(0x6a4a2e))
    V, F, C, S = m.arrays(); return V, F, C, S


def t_clock(seed=0):
    m = Mesh()
    wall = hexc(0xe9d8b0)
    V, F = box(7, 7, 4.5, 0); m.add(V, F, wall)
    V, F = box(4, 4, 9, 4.5); m.add(V, F, wall)
    V, F = box(4.4, 4.4, 0.5, 13.5); m.add(V, F, wall * 0.8)
    V, F = hip(4, 4, 3.2, 14, 0.3); m.add(V, F, hexc(0xb4482f))
    V, F = blob((0, -2.05, 11.2), 1.1, 0.12, 1, 0.0, 1); m.add(V, F, hexc(0xf6f6f0), True)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_market(seed=0):
    m = Mesh()
    for sx in (-1, 1):
        for sy in (-1, 1):
            V, F = tube((sx * 4.2, sy * 3, 0), (sx * 4.2, sy * 3, 3.2), 0.22, 4); m.add(V, F, hexc(0x6a4a2e))
    V, F = gable(9.2, 7, 2.0, 3.2, 0.4, 'x'); m.add(V, F, hexc(0xc4553a))
    V, F = box(7, 0.6, 1.0, 0, (0, 1.5)); m.add(V, F, hexc(0xd9b25a))
    V, F = box(2.4, 0.8, 1.0, 0, (-2.2, -1.5)); m.add(V, F, hexc(0x5db08a))
    V, F, C, S = m.arrays(); return V, F, C, S


def t_cay(seed, depth):
    """Sand cay with palms-ready top, from the seabed up."""
    rg = np.random.default_rng(seed)
    m = Mesh()
    R = 9 + rg.random() * 3
    V, F = cyl(R, R * 0.5, depth + 1.1, 12, -depth, True)
    sand = hexc(0xf1dfa8)
    m.add(V, F, sand, False, shade_z(V, -depth, 1.2, 0.8, 1.1))
    V, F = blob((0, 0, 0.9), R * 0.62, 0.2, 1, 0.1, seed); m.add(V, F, hexc(0x7fb23f), True)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_row(seed, colorful=False):
    """Long arcaded row house: continuous façade, repeated doors/windows, shallow gable."""
    rg = np.random.default_rng(seed + 500)
    m = Mesh()
    w = 12.0 + rg.random() * 4; d = 4.8; h = 3.4
    wall = hexc(COLORFUL[seed % len(COLORFUL)] if colorful else CASAS[seed % len(CASAS)])
    V, F = box(w, d, h); m.add(V, F, wall)
    V, F = gable(w, d, 1.5, h, 0.45, 'x'); m.add(V, F, hexc(ROOFS[seed % 4]))
    n = int(w // 3)
    for i in range(n):
        fx = -w / 2 + (i + 0.5) * w / n
        V, F = box(1.0, 0.25, 2.0, 0, (fx, -d / 2 - 0.05)); m.add(V, F, hexc(0x6a4a2e) if i % 2 == 0 else hexc(0x3f6a88))
        V, F = box(0.9, 0.2, 0.9, 2.0, (fx, -d / 2 - 0.05)); m.add(V, F, hexc(0x3f6a88))
    V, F = box(w, 1.3, 0.22, 2.7, (0, -d / 2 - 0.65)); m.add(V, F, hexc(ROOFS[seed % 4]) * 0.9)
    for i in range(n + 1):
        fx = -w / 2 + i * w / n
        V, F = tube((fx, -d / 2 - 1.2, 0), (fx, -d / 2 - 1.2, 2.7), 0.14, 4); m.add(V, F, hexc(0xf6f0e0))
    V, F, C, S = m.arrays(); return V, F, C, S


def t_hacienda(seed):
    """L-shaped house around a small walled courtyard, with a tile roof and a tree."""
    rg = np.random.default_rng(seed + 900)
    m = Mesh()
    wall = hexc(CASAS[seed % len(CASAS)]); roof = hexc(ROOFS[seed % 4])
    V, F = box(11, 4.6, 3.2, 0, (0, 3.6)); m.add(V, F, wall)
    V, F = gable(11, 4.6, 1.5, 3.2, 0.45, 'x', (0, 3.6)); m.add(V, F, roof)
    V, F = box(4.6, 8.6, 3.2, 0, (-3.2, -2.0)); m.add(V, F, wall)
    V, F = gable(4.6, 8.6, 1.5, 3.2, 0.45, 'y', (-3.2, -2.0)); m.add(V, F, roof)
    V, F = box(6.5, 0.4, 1.4, 0, (2.6, -6.3)); m.add(V, F, wall * 0.95)             # courtyard wall
    V, F = box(0.4, 4.2, 1.4, 0, (5.6, -4.2)); m.add(V, F, wall * 0.95)
    V, F = blob((3.2, -3.2, 3.0), 1.9, 0.9, 1, 0.2, seed); m.add(V, F, hexc(0x4c7a34), True)
    V, F = tube((3.2, -3.2, 0), (3.2, -3.2, 2.6), 0.3, 4); m.add(V, F, TRUNK)
    for fx in (-3.5, 0.5, 4.0):
        V, F = box(0.9, 0.2, 1.1, 1.3, (fx, 1.25)); m.add(V, F, hexc(0x3f6a88))
    V, F, C, S = m.arrays(); return V, F, C, S


def t_cow(seed=0):
    rg = np.random.default_rng(seed)
    m = Mesh()
    W_ = hexc(0xf4efe4); B_ = hexc(0x2a2420)
    V, F = box(3.4, 1.5, 1.6, 1.0); m.add(V, F, W_)
    for i in range(3):
        V, F = box(0.9 + rg.random() * 0.6, 1.62, 0.9, 1.2 + rg.random() * 0.4, (rg.random() * 2.2 - 1.1, 0)); m.add(V, F, B_)
    V, F = box(1.0, 1.0, 1.0, 1.4, (2.1, 0)); m.add(V, F, W_ * 0.97)
    V, F = box(0.5, 0.9, 0.5, 1.4, (2.7, 0)); m.add(V, F, hexc(0xe8b8a8))
    for sx in (-1.3, 1.3):
        for sy in (-0.5, 0.5):
            V, F = box(0.3, 0.3, 1.1, 0, (sx, sy)); m.add(V, F, B_)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_station(seed=0, roof=0xc4382f):
    m = Mesh()
    V, F = box(7, 6, 5.0); m.add(V, F, hexc(0xc9c6bc))
    V, F = hip(7, 6, 2.4, 5.0, 0.5); m.add(V, F, hexc(roof))
    V, F = box(2.0, 0.3, 2.2, 0, (0, -3.1)); m.add(V, F, hexc(0x4a4a50))
    V, F, C, S = m.arrays(); return V, F, C, S


def t_cabin(seed=0):
    m = Mesh()
    V, F = box(3.0, 2.4, 2.4, 0.0); m.add(V, F, hexc(0xd8302a))
    V, F = box(3.1, 2.5, 0.35, 2.4); m.add(V, F, hexc(0x8a1f1c))
    V, F = box(2.6, 0.1, 1.0, 0.9, (0, -1.22)); m.add(V, F, hexc(0xbfe3f4))
    V, F, C, S = m.arrays(); return V, F, C, S


def _ell(m, c, rx, ry, rz, col, seed=0, sub=1, smooth=True):
    V, F = blob((0, 0, 0), 1.0, 1.0, sub, 0.04, seed)
    V = V * np.array([rx, ry, rz]) + np.array(c)
    m.add(V, F, col, smooth)


def t_cow(seed=0):
    """Holstein-style cow built from ellipsoids: body, patches, head with muzzle/ears, legs, tail, udder."""
    rg = np.random.default_rng(seed + 31)
    m = Mesh()
    W_ = hexc(0xf6f2ea); B_ = hexc(0x25211f); PK = hexc(0xe9b4a6)
    _ell(m, (0, 0, 1.35), 1.45, 0.72, 0.78, W_, seed)
    for i in range(3 + int(rg.random() * 2)):
        x = rg.random() * 2.0 - 1.0
        _ell(m, (x, 0, 1.45 + rg.random() * 0.25), 0.35 + rg.random() * 0.4, 0.76, 0.34 + rg.random() * 0.25, B_, seed + i)
    _ell(m, (1.75, 0, 1.78), 0.58, 0.40, 0.44, W_ if seed % 2 else B_, seed + 7)
    _ell(m, (2.22, 0, 1.62), 0.30, 0.31, 0.27, PK, seed + 8)
    for sy in (-1, 1):
        _ell(m, (1.62, 0.48 * sy, 2.05), 0.22, 0.12, 0.10, B_, seed + 9)
        V, F = tube((1.6, 0.30 * sy, 2.1), (1.55, 0.42 * sy, 2.4), 0.06, 3); m.add(V, F, hexc(0xe8dcc0))
    for sx in (-0.85, 0.85):
        for sy in (-0.40, 0.40):
            V, F = tube((sx, sy, 0.95), (sx, sy, 0.12), 0.17, 5); m.add(V, F, W_)
            V, F = tube((sx, sy, 0.16), (sx, sy, 0.0), 0.19, 5); m.add(V, F, B_)
    V, F = tube((-1.42, 0, 1.75), (-1.62, 0, 0.75), 0.06, 3); m.add(V, F, B_)
    _ell(m, (-0.45, 0, 0.82), 0.32, 0.26, 0.2, PK, seed + 12)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_frailejon(seed=0):
    """Espeletia: furry trunk wrapped in dead leaves, silver-green rosette on top, yellow flower stalks."""
    rg = np.random.default_rng(seed + 77)
    m = Mesh()
    h = 1.8 + rg.random() * 2.2
    V, F = cyl(0.55, 0.42, h, 7, 0, cap=False); m.add(V, F, hexc(0x8a7550), True, shade_z(V, 0, h, 0.7, 1.05))
    V, F = cyl(0.95, 0.55, h * 0.5, 7, 0, cap=False); m.add(V, F, hexc(0x6f5d3d), False)
    n = 18
    for k in range(n):
        a = k / n * 6.28 + rg.random() * 0.2; lift = 0.6 + 0.9 * (k % 3) / 2
        L = 1.4 + rg.random() * 0.5
        base = np.array([0.0, 0.0, h]); mid = base + np.array([math.cos(a) * L * 0.55, math.sin(a) * L * 0.55, lift * 0.9]); end = base + np.array([math.cos(a) * L, math.sin(a) * L, lift * 0.7])
        c = lerp(hexc(0x93ab7a), hexc(0xc9d6b0), rg.random())
        V, F = tube(base, mid, 0.22, 3); m.add(V, F, c)
        V, F = tube(mid, end, 0.14, 3); m.add(V, F, c * 0.95)
    for k in range(2 + int(rg.random() * 2)):
        a = rg.random() * 6.28
        top = np.array([math.cos(a) * 0.5, math.sin(a) * 0.5, h + 2.6 + rg.random() * 0.8])
        V, F = tube((0, 0, h + 0.4), top, 0.07, 3); m.add(V, F, hexc(0x7a8a50))
        _ell(m, top, 0.28, 0.28, 0.22, hexc(0xf2cf3a), seed + k)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_wallblock(seed=0):
    rg = np.random.default_rng(seed)
    m = Mesh()
    c = lerp(hexc(0x9a948a), hexc(0xb8b0a2), rg.random())
    V, F = box(2.8, 1.0, 0.8, 0.0); m.add(V, F, c)
    V, F = box(2.3, 0.85, 0.55, 0.8, (0.2 * (rg.random() - 0.5), 0)); m.add(V, F, c * (0.9 + 0.15 * rg.random()))
    V, F, C, S = m.arrays(); return V, F, C, S


def t_horse(seed=0):
    rg = np.random.default_rng(seed + 5)
    m = Mesh()
    col = [hexc(0x7a4a2e), hexc(0x5a3822), hexc(0xa8764a), hexc(0x2e2420)][seed % 4]
    dark = col * 0.55
    _ell(m, (0, 0, 1.55), 1.35, 0.55, 0.62, col, seed)
    V, F = tube((0.95, 0, 1.8), (1.55, 0, 2.55), 0.3, 5); m.add(V, F, col, True)
    _ell(m, (1.85, 0, 2.6), 0.5, 0.26, 0.28, col, seed + 1)
    for sy in (-1, 1):
        _ell(m, (1.62, 0.17 * sy, 2.95), 0.1, 0.06, 0.2, dark, seed + 2)
    for sx in (-0.85, 0.85):
        for sy in (-0.3, 0.3):
            V, F = tube((sx, sy, 1.15), (sx, sy, 0.08), 0.12, 4); m.add(V, F, col)
            V, F = tube((sx, sy, 0.14), (sx, sy, 0.0), 0.14, 4); m.add(V, F, dark)
    V, F = tube((-1.3, 0, 1.9), (-1.75, 0, 0.8), 0.13, 4); m.add(V, F, dark)
    V, F = tube((0.9, 0, 2.2), (1.5, 0, 2.95), 0.1, 3); m.add(V, F, dark)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_capybara(seed=0):
    m = Mesh()
    col = lerp(hexc(0x8a5a3a), hexc(0x6e4630), (seed % 3) / 2)
    _ell(m, (0, 0, 0.7), 1.0, 0.5, 0.42, col, seed)
    _ell(m, (1.05, 0, 0.85), 0.42, 0.33, 0.33, col * 0.95, seed + 1)
    _ell(m, (1.4, 0, 0.78), 0.2, 0.22, 0.2, col * 0.7, seed + 2)
    for sy in (-1, 1):
        _ell(m, (0.95, 0.22 * sy, 1.18), 0.09, 0.07, 0.09, col * 0.7, seed + 3)
    for sx in (-0.5, 0.5):
        for sy in (-0.3, 0.3):
            V, F = tube((sx, sy, 0.4), (sx, sy, 0.0), 0.1, 3); m.add(V, F, col * 0.8)
    V, F, C, S = m.arrays(); return V, F, C, S


def t_windmill(seed=0):
    m = Mesh()
    steel = hexc(0xbfc5cc); dark = hexc(0x6c7077); wood = hexc(0x8a6a4a)
    H = 12.0
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        V, F = tube((sx * 2.2, sy * 2.2, 0), (sx * 0.8, sy * 0.8, H), 0.22, 4); m.add(V, F, wood)
    for z in (3.5, 7.0):
        w = 2.2 + (0.8 - 2.2) * z / H
        for (ax, ay), (bx, by) in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
            V, F = tube((ax * w, ay * w, z), (bx * w, by * w, z), 0.13, 3); m.add(V, F, wood)
    V, F = box(1.6, 1.6, 0.8, H); m.add(V, F, dark)
    hub = np.array([0.0, -1.1, H + 0.5])
    for k in range(12):
        a = k / 12 * 6.283
        tip = hub + np.array([math.cos(a) * 3.3, 0, math.sin(a) * 3.3])
        V, F = tube(hub, tip, 0.16, 3); m.add(V, F, steel)
        V2 = np.array([hub + np.array([math.cos(a) * 1.2, -0.05, math.sin(a) * 1.2]), tip + np.array([0, -0.05, 0]),
                       tip + np.array([math.cos(a + 0.35) * 0.0, -0.05, 0]) + np.array([-math.sin(a) * 0.9, 0, math.cos(a) * 0.9]),
                       hub + np.array([math.cos(a) * 1.2, -0.05, math.sin(a) * 1.2]) + np.array([-math.sin(a) * 0.5, 0, math.cos(a) * 0.5])])
        m.add(V2, [(0, 1, 2, 3)], hexc(0xe4dccb), False)
    V, F = tube(hub, hub + np.array([0, 3.0, 0]), 0.16, 4); m.add(V, F, dark)
    V, F = box(0.2, 2.0, 1.4, H + 0.1, (0, 3.6)); m.add(V, F, hexc(0xc4382f))
    V, F, C, S = m.arrays(); return V, F, C, S
