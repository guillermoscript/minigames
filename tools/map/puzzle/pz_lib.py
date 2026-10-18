"""Puzzle map (Blender): shared infrastructure.

Every section is a slab cut from the SAME global heightfield (layout frame of assets/map/v2/layout.json),
so neighbouring tiles match exactly along their shared edge and can be glued by just importing both.
Run inside Blender (numpy + bpy available): exec(open(path).read()).
Colours are stored in the float colour attribute "Col" (linear) so the same data exports to glTF COLOR_0.
"""
import bpy, bmesh, json, math, os
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PINNED = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pinned')   # frozen copy of the v2 geography so concurrent v2 edits don't move the tiles
LAYOUT = os.path.join(PINNED, 'layout.json')
OUT = os.path.join(ROOT, 'assets', 'map', 'puzzle')
os.makedirs(OUT, exist_ok=True)

_L = None
CURRENT = None   # collection new objects are linked to


def layout():
    global _L
    if _L is None:
        _L = json.load(open(LAYOUT))
    return _L


# ───────────────────────── noise ─────────────────────────
def _hash(ix, iy, seed):
    n = (ix.astype(np.int64) * 374761393 + iy.astype(np.int64) * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n = n ^ (n >> 16)
    return (n & 0xFFFFFF) / float(0xFFFFFF)


def vnoise(x, y, seed=0):
    x = np.asarray(x, float); y = np.asarray(y, float)
    ix = np.floor(x); iy = np.floor(y)
    fx = x - ix; fy = y - iy
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    a = _hash(ix, iy, seed); b = _hash(ix + 1, iy, seed)
    c = _hash(ix, iy + 1, seed); d = _hash(ix + 1, iy + 1, seed)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy


def fbm(x, y, seed=0, oct=5, lac=2.03, gain=0.5):
    s = 0.0; amp = 1.0; tot = 0.0
    for o in range(oct):
        s = s + amp * vnoise(x, y, seed + o * 17)
        tot += amp; amp *= gain; x = x * lac + 31.7; y = y * lac - 17.3
    return s / tot


def ridged(x, y, seed=0, oct=5):
    s = 0.0; amp = 1.0; tot = 0.0
    for o in range(oct):
        n = 1 - abs(2 * vnoise(x, y, seed + o * 13) - 1)
        s = s + amp * n * n
        tot += amp; amp *= 0.5; x = x * 2.1 + 11.3; y = y * 2.1 - 7.9
    return s / tot


def sstep(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ───────────────────────── geometry masks ─────────────────────────
def pip(px, py, poly):
    poly = np.asarray(poly, float)
    x1 = poly[:, 0]; y1 = poly[:, 1]
    x2 = np.roll(x1, -1); y2 = np.roll(y1, -1)
    dy = np.where(y2 == y1, 1e-9, y2 - y1)
    out = np.zeros(px.shape, bool)
    for a in range(0, len(px), 3000):
        X = px[a:a + 3000, None]; Y = py[a:a + 3000, None]
        cond = ((y1 > Y) != (y2 > Y)) & (X < (x2 - x1) * (Y - y1) / dy + x1)
        out[a:a + 3000] = (cond.sum(1) & 1) == 1
    return out


def chaikin(poly, passes=2):
    p = [tuple(q) for q in poly]
    for _ in range(passes):
        out = []
        for i in range(len(p)):
            a = p[i]; b = p[(i + 1) % len(p)]
            out.append((a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25)); out.append((a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75))
        p = out
    return p


def wobble(poly, amp=4.5, seed=5):
    """Densify then displace by low-frequency noise (deterministic in world coords, so tiles still match)."""
    d = densify(poly, 2.5)
    dx = (fbm(d[:, 0] / 38.0, d[:, 1] / 38.0, seed, 3) - 0.5) * 2 * amp
    dy = (fbm(d[:, 0] / 38.0 + 50, d[:, 1] / 38.0 - 20, seed + 1, 3) - 0.5) * 2 * amp
    return np.stack([d[:, 0] + dx, d[:, 1] + dy], -1)


def densify(poly, step=2.0):
    p = np.asarray(poly, float); n = len(p); out = []
    for i in range(n):
        a = p[i]; b = p[(i + 1) % n]
        k = max(1, int(np.hypot(*(b - a)) / step))
        t = np.arange(k) / k
        out.append(a[None] + (b - a)[None] * t[:, None])
    return np.vstack(out)


def mindist(px, py, B):
    out = np.empty(px.shape, float)
    for a in range(0, len(px), 1500):
        dx = px[a:a + 1500, None] - B[None, :, 0]
        dy = py[a:a + 1500, None] - B[None, :, 1]
        out[a:a + 1500] = np.sqrt((dx * dx + dy * dy).min(1))
    return out


class World:
    """Rasterised geography for one rectangle (+margin) at cell size c. All fields are (ny, nx)."""

    def __init__(self, rect, c=2.0, margin=0.0):
        L = layout()
        x0, y0, x1, y1 = rect
        self.rect = rect; self.c = c
        self.xs = np.arange(x0, x1 + 1e-6, c); self.ys = np.arange(y0, y1 + 1e-6, c)
        self.nx = len(self.xs); self.ny = len(self.ys)
        X, Y = np.meshgrid(self.xs, self.ys)
        self.X, self.Y = X, Y
        fx, fy = X.ravel(), Y.ravel()
        cn = [(x_, y_ + (12 if y_ > 380 else 0)) for x_, y_ in L['canal']]
        lakes = [wobble(chaikin(L['lake'], 4), 7.0, 7), wobble(chaikin(cn, 4), 7.0, 7)]
        isl = [wobble(p_, 3.5, 7) for p_ in L['islands'].values()]
        landp = wobble(L['land'], 3.5, 7)

        def landfn(px, py):
            m = pip(px, py, landp)
            for poly in isl:
                m |= pip(px, py, poly)
            lk = pip(px, py, lakes[0]) | pip(px, py, lakes[1])
            return m & ~lk
        land = landfn(fx, fy)
        lake = (pip(fx, fy, lakes[0]) | pip(fx, fy, lakes[1])) & ~land
        pad = 320
        bs = []
        for poly in [landp, lakes[0], lakes[1]] + isl:
            d = densify(poly, 2.5)
            m = (d[:, 0] > x0 - pad) & (d[:, 0] < x1 + pad) & (d[:, 1] > y0 - pad) & (d[:, 1] < y1 + pad)
            if m.any():
                bs.append(d[m])
        B = np.vstack(bs)
        keep = np.zeros(len(B), bool)
        sides = [landfn(B[:, 0] + dx, B[:, 1] + dy) for dx, dy in ((2.5, 0), (-2.5, 0), (0, 2.5), (0, -2.5))]
        anyl = sides[0] | sides[1] | sides[2] | sides[3]; alll = sides[0] & sides[1] & sides[2] & sides[3]
        B = B[anyl & ~alll]
        self.d = mindist(fx, fy, B).reshape(X.shape)     # distance to nearest shoreline (land/water boundary)
        self.land = land.reshape(X.shape)
        self.lake = lake.reshape(X.shape)
        self.sea = ~(self.land | self.lake)

    def sample(self, A, px, py):
        """Bilinear sample of grid field A at points."""
        x0, y0 = self.rect[0], self.rect[1]
        fx = np.clip((px - x0) / self.c, 0, self.nx - 1.001); fy = np.clip((py - y0) / self.c, 0, self.ny - 1.001)
        ix = fx.astype(int); iy = fy.astype(int); tx = fx - ix; ty = fy - iy
        a = A[iy, ix]; b = A[iy, ix + 1]; c_ = A[iy + 1, ix]; d = A[iy + 1, ix + 1]
        return a + (b - a) * tx + (c_ - a) * ty + (a - b - c_ + d) * tx * ty


# ───────────────────────── colour ─────────────────────────
def hexc(h):
    return np.array([((h >> 16) & 255) / 255.0, ((h >> 8) & 255) / 255.0, (h & 255) / 255.0])


def lin(c):
    return np.power(np.clip(c, 0, 1), 2.2)


# ───────────────────────── mesh helpers ─────────────────────────
def make_mesh_obj(name, V, F, C, smooth=None, coll=None, mat=None, uv=False):
    """V Nx3, F list of index tuples, C Nx3 srgb 0-1 (stored linear) per vertex."""
    me = bpy.data.meshes.new(name)
    V = np.array(V, np.float32); V[:, 1] *= -1          # canvas y is south-positive; Blender +Y is north
    F = [tuple(reversed(f)) for f in F]
    me.vertices.add(len(V)); me.vertices.foreach_set('co', V.ravel())
    nl = [len(f) for f in F]
    me.loops.add(sum(nl)); me.polygons.add(len(F))
    me.loops.foreach_set('vertex_index', np.fromiter((i for f in F for i in f), np.int32))
    starts = np.concatenate([[0], np.cumsum(nl)[:-1]]).astype(np.int32)
    me.polygons.foreach_set('loop_start', starts)
    me.polygons.foreach_set('loop_total', np.array(nl, np.int32))
    if smooth is not None:
        me.polygons.foreach_set('use_smooth', np.asarray(smooth, bool))
    me.update(calc_edges=True)
    if C is not None:
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        col = np.ones((len(V), 4), np.float32)
        col[:, :3] = lin(np.asarray(C, float))
        ca.data.foreach_set('color', col.ravel())
    ob = bpy.data.objects.new(name, me)
    (coll or CURRENT or bpy.context.scene.collection).objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    return ob


def vc_material(name='pz_vc', rough=0.85, spec=0.25):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    ca = nt.nodes.new('ShaderNodeAttribute'); ca.attribute_name = 'Col'
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.6; nz.inputs['Detail'].default_value = 7
    nz2 = nt.nodes.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = 0.09; nz2.inputs['Detail'].default_value = 3
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.22; bump.inputs['Distance'].default_value = 0.4
    mixg = nt.nodes.new('ShaderNodeMix'); mixg.data_type = 'RGBA'; mixg.blend_type = 'OVERLAY'; mixg.inputs['Factor'].default_value = 0.16
    mixl = nt.nodes.new('ShaderNodeMix'); mixl.data_type = 'RGBA'; mixl.blend_type = 'SOFT_LIGHT'; mixl.inputs['Factor'].default_value = 0.22
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(tc.outputs['Object'], nz2.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(ca.outputs['Color'], mixg.inputs[6]); nt.links.new(nz.outputs['Color'], mixg.inputs[7])
    nt.links.new(mixg.outputs[2], mixl.inputs[6]); nt.links.new(nz2.outputs['Color'], mixl.inputs[7])
    nt.links.new(mixl.outputs[2], bsdf.inputs['Base Color'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = rough
    for k in ('Specular IOR Level', 'Specular'):
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = spec
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m


PH_DIR = os.path.join(OUT, 'packs', 'polyhaven')


def _img(fn, color=True):
    p = os.path.join(PH_DIR, fn)
    if not os.path.exists(p):
        return None
    im = bpy.data.images.get(fn) or bpy.data.images.load(p)
    im.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    return im


def terrain_material(name='pz_terrain_tex'):
    """Poly Haven sand / grass / rock blended by the per-vertex weights 'Wts' (R sand, G grass, B rock), box-projected;
    the biome colour 'Col' stays the base and the photo texture adds detail (overlay) + normals + roughness."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    need = [f'{t}_{k}_1k.jpg' for t in ('coast_sand_01', 'aerial_grass_rock', 'rock_face') for k in ('diff', 'nor_gl', 'rough')]
    if not all(os.path.exists(os.path.join(PH_DIR, n)) for n in need):
        return vc_material()
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear(); N = nt.nodes.new; L = nt.links.new
    out = N('ShaderNodeOutputMaterial'); bsdf = N('ShaderNodeBsdfPrincipled')
    col = N('ShaderNodeAttribute'); col.attribute_name = 'Col'
    wt = N('ShaderNodeAttribute'); wt.attribute_name = 'Wts'
    sep = N('ShaderNodeSeparateColor'); L(wt.outputs['Color'], sep.inputs['Color'])
    tc = N('ShaderNodeTexCoord'); mp = N('ShaderNodeMapping')
    for i in range(3):
        mp.inputs['Scale'].default_value[i] = 0.045
    L(tc.outputs['Object'], mp.inputs['Vector'])

    def tex(fn, color=True):
        n = N('ShaderNodeTexImage'); n.image = _img(fn, color); n.projection = 'BOX'; n.projection_blend = 0.25; n.interpolation = 'Smart'
        L(mp.outputs['Vector'], n.inputs['Vector']); return n

    def blend3(kind):
        s = tex(f'coast_sand_01_{kind}_1k.jpg', kind == 'diff'); g = tex(f'aerial_grass_rock_{kind}_1k.jpg', kind == 'diff'); r = tex(f'rock_face_{kind}_1k.jpg', kind == 'diff')
        den = N('ShaderNodeMath'); den.operation = 'ADD'; L(sep.outputs['Red'], den.inputs[0]); L(sep.outputs['Green'], den.inputs[1])
        den2 = N('ShaderNodeMath'); den2.operation = 'ADD'; den2.inputs[1].default_value = 0.0001; L(den.outputs[0], den2.inputs[0])
        fg = N('ShaderNodeMath'); fg.operation = 'DIVIDE'; L(sep.outputs['Green'], fg.inputs[0]); L(den2.outputs[0], fg.inputs[1])
        a = N('ShaderNodeMix'); a.data_type = 'RGBA'; L(fg.outputs[0], a.inputs['Factor']); L(s.outputs['Color'], a.inputs[6]); L(g.outputs['Color'], a.inputs[7])
        b = N('ShaderNodeMix'); b.data_type = 'RGBA'; L(sep.outputs['Blue'], b.inputs['Factor']); L(a.outputs[2], b.inputs[6]); L(r.outputs['Color'], b.inputs[7])
        return b.outputs[2]
    diff = blend3('diff'); nor = blend3('nor_gl'); rough = blend3('rough')
    ov = N('ShaderNodeMix'); ov.data_type = 'RGBA'; ov.blend_type = 'OVERLAY'; ov.inputs['Factor'].default_value = 0.6
    L(col.outputs['Color'], ov.inputs[6]); L(diff, ov.inputs[7]); L(ov.outputs[2], bsdf.inputs['Base Color'])
    nm = N('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.9; L(nor, nm.inputs['Color']); L(nm.outputs['Normal'], bsdf.inputs['Normal'])
    rs = N('ShaderNodeSeparateColor'); L(rough, rs.inputs['Color']); L(rs.outputs['Red'], bsdf.inputs['Roughness'])
    for k in ('Specular IOR Level', 'Specular'):
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = 0.2
    L(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m


def water_material(name='pz_water'):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    ca = nt.nodes.new('ShaderNodeAttribute'); ca.attribute_name = 'Col'
    nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.08
    for k in ('Specular IOR Level', 'Specular'):
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = 0.9
    # fine ripples
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.35; nz.inputs['Detail'].default_value = 4
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.22
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    nz2 = nt.nodes.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = 0.06; nz2.inputs['Detail'].default_value = 3
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'SOFT_LIGHT'; mix.inputs['Factor'].default_value = 0.55
    nt.links.new(tc.outputs['Object'], nz2.inputs['Vector'])
    nt.links.new(ca.outputs['Color'], mix.inputs[6]); nt.links.new(nz2.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs['Fac'].default_value = 0.22
    nt.links.new(bsdf.outputs['BSDF'], mx.inputs[1]); nt.links.new(tr.outputs['BSDF'], mx.inputs[2])
    nt.links.new(mx.outputs['Shader'], out.inputs['Surface'])
    return m


# ───────────────────────── terrain slab ─────────────────────────
ROCK = [0x7f5a3e, 0x8c6644, 0x70503a, 0x946e48, 0x654636]


def build_slab(name, W, Z, color, water_lvl=0.0, depth=34.0, buf=None, coll=None, seed=3, wts=None):
    """W: World. Z: (ny,nx) top height. color: (ny,nx,3) srgb. buf: (ny,nx) footprint half-width into the sea.
    Returns (terrain_obj, water_obj, info)."""
    ny, nx = W.ny, W.nx
    land_like = W.land | W.lake
    if buf is None:
        buf = 70 + 50 * fbm(W.X / 60.0, W.Y / 60.0, seed + 5, 3)
    f = np.where(land_like, buf + 5.0, buf - W.d)           # >0 inside footprint
    inside = f > 0
    # snap outside vertices that touch an inside neighbour onto the f=0 contour
    P = np.stack([W.X, W.Y], -1).copy()
    valid = inside.copy()
    onrect = np.zeros((ny, nx), bool)
    onrect[0, :] = onrect[-1, :] = True; onrect[:, 0] = onrect[:, -1] = True
    best = np.full((ny, nx), -1e9); bi = np.zeros((ny, nx), int); bj = np.zeros((ny, nx), int)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            if di == 0 and dj == 0:
                continue
            sh = np.full((ny, nx), -1e9)
            ys0, ys1 = max(0, -di), ny - max(0, di); xs0, xs1 = max(0, -dj), nx - max(0, dj)
            sh[ys0:ys1, xs0:xs1] = f[ys0 + di:ys1 + di, xs0 + dj:xs1 + dj]
            if (di != 0 and dj != 0):
                sh = np.where(onrect, -1e9, sh)
            elif di != 0:
                sh = np.where(onrect & ((np.arange(ny)[:, None] == 0) | (np.arange(ny)[:, None] == ny - 1)), -1e9, sh)
            elif dj != 0:
                sh = np.where(onrect & ((np.arange(nx)[None, :] == 0) | (np.arange(nx)[None, :] == nx - 1)), -1e9, sh)
            m = sh > best
            best = np.where(m, sh, best); bi = np.where(m, di, bi); bj = np.where(m, dj, bj)
    snap = (~inside) & (best > 0)
    I, J = np.indices((ny, nx))
    t = np.where(snap, -f / np.maximum(best - f, 1e-6), 0.0)
    ni = np.clip(I + bi, 0, ny - 1); nj = np.clip(J + bj, 0, nx - 1)
    P[..., 0] = np.where(snap, W.X + (W.X[ni, nj] - W.X) * t, W.X)
    P[..., 1] = np.where(snap, W.Y + (W.Y[ni, nj] - W.Y) * t, W.Y)
    valid |= snap
    Zs = np.where(snap, Z[ni, nj], Z)
    Cs = np.where(snap[..., None], color[ni, nj], color)
    Ws = np.where(snap[..., None], wts[ni, nj], wts) if wts is not None else None
    # quads: all four corners valid
    q = valid[:-1, :-1] & valid[:-1, 1:] & valid[1:, 1:] & valid[1:, :-1]
    qi, qj = np.nonzero(q)
    vid = -np.ones((ny, nx), int)
    used = np.zeros((ny, nx), bool)
    for di, dj in ((0, 0), (0, 1), (1, 1), (1, 0)):
        used[qi + di, qj + dj] = True
    vid[used] = np.arange(used.sum())
    V = np.stack([P[..., 0][used], P[..., 1][used], Zs[used]], -1)
    Cv = Cs[used]
    Wv = Ws[used] if Ws is not None else None
    quads = np.stack([vid[qi, qj], vid[qi, qj + 1], vid[qi + 1, qj + 1], vid[qi + 1, qj]], -1)
    # flip for upward normals (y down grid → ccw needs reversed)
    waterv = (Zs[used] < water_lvl)
    wallw = waterv.copy()

    # boundary edges
    cnt = {}
    for a, b, c_, d in quads.tolist():
        for e in ((a, b), (b, c_), (c_, d), (d, a)):
            k = (e[1], e[0]) if e[0] > e[1] else e
            if k in cnt:
                cnt[k][0] += 1
            else:
                cnt[k] = [1, e]
    bedges = [v[1] for v in cnt.values() if v[0] == 1]
    # chain edges (for normals + along-path noise)
    nxt = {a: b for a, b in bedges}
    bset = set(nxt.keys()) | set(nxt.values())
    nrm = {v: np.zeros(2) for v in bset}
    for a, b in bedges:
        e = V[b, :2] - V[a, :2]; n = np.array([e[1], -e[0]]); n /= (np.linalg.norm(n) + 1e-9)
        nrm[a] += n; nrm[b] += n
    x0, y0, x1, y1 = W.rect
    onlimit = lambda v: (abs(V[v, 0] - x0) < 1e-3 or abs(V[v, 0] - x1) < 1e-3 or abs(V[v, 1] - y0) < 1e-3 or abs(V[v, 1] - y1) < 1e-3)

    levels = 7
    _rg = np.random.default_rng(seed + 100)
    LV = np.concatenate([[0], np.cumsum(0.5 + _rg.random(levels))]); LV = LV / LV[-1]
    LCOL = [hexc(c_) * (0.85 + 0.3 * _rg.random()) for c_ in (0xb89c6c, 0x8c6644, 0x7a5a3e, 0x9c7650, 0x6e503a, 0x84603f, 0x5e4432)]
    zb = -depth
    verts = [V]; faces = [tuple(q_) for q_ in quads.tolist()]; cols = [Cv]
    smooth = [True] * len(faces)
    ring = {}       # (v, level) -> new vertex index
    nv = len(V)
    wfaces = []; wcols = []; wv = []     # water surface walls
    for v in bset:
        n = nrm[v] / (np.linalg.norm(nrm[v]) + 1e-9)
        top = V[v, 2]
        zl = top + (zb - top) * LV
        rim = onlimit(v)
        for lv in range(levels + 1):
            if lv == 0:
                ring[(v, 0)] = v
                continue
            blk = float(vnoise((V[v, 0] + V[v, 1]) / 17.0 + lv * 5.3, lv * 0.9, seed + 3))
            jit = 5.0 * (blk - 0.45)
            jit = (jit * (0.6 if rim else 1.1) * (0.5 + 0.6 * math.sin(lv * 1.7 + blk * 6))) if lv < levels else jit * 0.4
            p = np.array([V[v, 0] + n[0] * jit, V[v, 1] + n[1] * jit, zl[lv]])
            ring[(v, lv)] = nv; verts.append(p[None]); nv += 1
            # strata colour: bands + vertical grooves
            tt = lv / levels
            band = vnoise(V[v, 0] * 0.25, V[v, 1] * 0.25, seed + 21)
            base = hexc(ROCK[int(band * 4.99)])
            shade = 1.05 - 0.55 * tt ** 1.2 + 0.12 * (vnoise(zl[lv] * 0.5, V[v, 0] * 0.4 + V[v, 1] * 0.4, seed + 4) - 0.5)
            wall_c = base * shade * (0.84 + 0.3 * float(_hash(np.array(lv), np.array(math.floor((V[v, 0] + V[v, 1]) / 11.0)), seed + 8)))
            if lv == 1:
                wall_c = hexc(0xb59868) * (0.9 + 0.2 * blk)
            if V[v, 2] < water_lvl:     # seabed column: sandy-teal
                wall_c = np.array([0.20, 0.52, 0.62]) * (1.1 - 0.5 * tt)
            cols.append(wall_c[None])
    Pall = np.vstack(verts); Call0 = np.vstack(cols)
    xv = []; xc = []; nb = len(Pall)
    for a, b in bedges:
        water_col = V[a, 2] < water_lvl and V[b, 2] < water_lvl
        for lv in range(levels):
            idx = [ring[(a, lv + 1)], ring[(b, lv + 1)], ring[(b, lv)], ring[(a, lv)]]
            pts = Pall[idx]
            mx = pts[:, 0].mean(); my = pts[:, 1].mean()
            lowf = float(vnoise((mx + my) / 38.0, lv * 0.6, seed + 12))
            fine = float(vnoise((mx + my) / 3.0, lv * 1.7, seed + 8))
            if water_col:
                c = np.array([0.16, 0.42, 0.55]) * (1.0 - 0.45 * lv / levels)
            else:
                c = LCOL[lv % 7] * (0.88 + 0.26 * lowf) * (0.94 + 0.1 * fine) * (1.0 - 0.28 * lv / levels)
            faces.append(tuple(range(nb + len(xv), nb + len(xv) + 4))); smooth.append(False)
            xv += list(pts); xc += [c] * 4
    Vall = np.vstack([Pall, np.array(xv)]); Call = np.vstack([Call0, np.array(xc)])
    terr = make_mesh_obj(name + '_terrain', Vall, faces, Call, smooth, coll, vc_material())
    if Wv is not None:
        Wall = np.vstack([Wv, np.tile([0.0, 0.0, 1.0], (len(Vall) - len(Wv), 1))])
        at = terr.data.color_attributes.new('Wts', 'FLOAT_COLOR', 'POINT')
        rgba = np.ones((len(Vall), 4), np.float32); rgba[:, :3] = Wall
        at.data.foreach_set('color', rgba.ravel())
        terr.data.materials.clear(); terr.data.materials.append(terrain_material())

    # ── water: full-footprint surface at water_lvl (terrain pokes through on land) + translucent-look walls ──
    wmap = {}; wV = []; wC = []
    shallow = np.array([0.34, 0.60, 0.64]); mid = np.array([0.13, 0.46, 0.74]); deep = np.array([0.06, 0.28, 0.62])

    def wv_(v):
        if v in wmap:
            return wmap[v]
        wmap[v] = len(wV)
        dd = float(np.clip((water_lvl - V[v, 2]) / 9.0, 0, 1)) ** 0.9
        c = shallow + (mid - shallow) * min(dd * 2, 1) if dd < 0.5 else mid + (deep - mid) * (dd - 0.5) * 2
        fo = float(np.clip(1.0 - (water_lvl - V[v, 2]) / 0.7, 0, 1)) ** 2
        st = float(sstep(0.66, 0.74, fbm(V[v, 0] / 7.0, V[v, 1] / 7.0, seed + 61, 3))) * float(sstep(14, 3, W.sample(W.d, V[v, 0], V[v, 1]))) * 0.2
        fo = max(fo, st)
        c = c * (1 - fo * 0.8) + np.array([0.95, 0.98, 0.97]) * fo * 0.8
        wV.append([V[v, 0], V[v, 1], water_lvl]); wC.append(c)
        return wmap[v]

    wF = [tuple(wv_(i) for i in qd) for qd in quads.tolist()]
    wring = {}
    for a, b in bedges:
        if not (V[a, 2] < water_lvl and V[b, 2] < water_lvl):
            continue
        for v in (a, b):
            if (v, 0) not in wring:
                wring[(v, 0)] = wv_(v)
                wring[(v, 1)] = len(wV); wV.append([V[v, 0], V[v, 1], zb]); wC.append(np.array([0.10, 0.50, 0.88]))
        wF.append((wring[(a, 1)], wring[(b, 1)], wring[(b, 0)], wring[(a, 0)]))
    wobj = None
    if wF:
        wobj = make_mesh_obj(name + '_water', np.array(wV), wF, np.array(wC), None, coll, water_material())
    return terr, wobj, dict(P=P, valid=valid, snap=snap, f=f)


# ───────────────────────── scene setup ─────────────────────────
def setup_scene(center, span, bg=(0.56, 0.76, 0.95), res=1254, elev=52, azim=-18, dist_mul=2.0, lens=75, cycles=True, samples=96):
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        if o.type in ('CAMERA', 'LIGHT') or o.name.startswith(('Cube',)):
            bpy.data.objects.remove(o, do_unlink=True)
    sc.render.engine = 'CYCLES' if cycles else 'BLENDER_EEVEE'
    if cycles:
        sc.cycles.samples = samples; sc.cycles.use_denoising = True; sc.cycles.max_bounces = 6
        try:
            pr = bpy.context.preferences.addons['cycles'].preferences
            pr.compute_device_type = 'METAL'; pr.get_devices()
            for d_ in pr.devices:
                d_.use = True
            sc.cycles.device = 'GPU'
        except Exception as e_:
            print('cycles gpu unavailable', e_)
    sc.render.resolution_x = res; sc.render.resolution_y = res
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.exposure = -0.5
    try:
        sc.view_settings.look = 'None'
    except Exception:
        pass
    w = sc.world or bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    outw = nt.nodes.new('ShaderNodeOutputWorld')
    sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'MULTIPLE_SCATTERING'; sky.sun_disc = False; sky.sun_elevation = math.radians(50); sky.sun_rotation = math.radians(220)
    b1 = nt.nodes.new('ShaderNodeBackground'); b1.inputs['Strength'].default_value = 0.28
    b2 = nt.nodes.new('ShaderNodeBackground'); b2.inputs['Color'].default_value = (*lin(np.array(bg)), 1); b2.inputs['Strength'].default_value = 1.0
    lp = nt.nodes.new('ShaderNodeLightPath'); mxw = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(sky.outputs['Color'], b1.inputs['Color'])
    nt.links.new(lp.outputs['Is Camera Ray'], mxw.inputs['Fac']); nt.links.new(b1.outputs['Background'], mxw.inputs[1]); nt.links.new(b2.outputs['Background'], mxw.inputs[2])
    nt.links.new(mxw.outputs['Shader'], outw.inputs['Surface'])
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); sc.collection.objects.link(cam)
    cam.data.lens = lens; cam.data.clip_end = 20000
    cx, cy, cz = center
    d = span * dist_mul
    el = math.radians(elev); az = math.radians(azim)
    cam.location = (cx + d * math.cos(el) * math.sin(az), cy - d * math.cos(el) * math.cos(az), cz + d * math.sin(el))
    tgt = bpy.data.objects.new('Tgt', None); sc.collection.objects.link(tgt); tgt.location = center
    tc = cam.constraints.new('TRACK_TO'); tc.target = tgt; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
    sc.camera = cam
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = 4.0; sun.data.angle = math.radians(3)
    sun.rotation_euler = (math.radians(60), math.radians(8), math.radians(-38))
    sun.data.color = (1.0, 0.96, 0.88)
    try:
        sc.eevee.use_raytracing = True
        sc.eevee.taa_render_samples = 48
        sc.eevee.use_shadows = True
    except Exception:
        pass
    return cam, sun


def render_to(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    return path


def emit_material(name='pz_emit', color=(1.0, 0.95, 0.7), strength=12.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1); em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m
