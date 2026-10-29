"""Quaternius Ultimate Nature Pack (CC0) → vertex-coloured templates (V, F, C, S) compatible with Scatter.
Models are read straight from the downloaded .blend files; materials become per-face colours."""
import bpy, os, numpy as np
from pz_lib import OUT, hexc

PACK = os.path.join(OUT, 'packs', 'quaternius')
KEN = os.path.join(OUT, 'packs', 'kenney', 'kit', 'Models', 'GLTF format')
_cache = {}


def _srgb(c):
    return np.power(np.clip(np.array(c[:3], float), 0, 1), 1 / 2.2)


def load(name, target_h, tone=1.0, sat=0.88, tint=(1, 1, 1)):
    key = (name, target_h, tone, sat, tint)
    if key in _cache:
        return _cache[key]
    path = os.path.join(PACK, name + '.blend')
    if not os.path.exists(path):
        _cache[key] = None
        return None
    before = set(bpy.data.objects.keys()); mbefore = set(bpy.data.meshes.keys()); matb = set(bpy.data.materials.keys())
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = list(src.objects)
    objs = [o for o in dst.objects if o is not None and o.type == 'MESH']
    V = []; F = []; C = []; S = []; n = 0
    for o in objs:
        me = o.data
        M = np.array(o.matrix_basis)
        mats = []
        for sl in o.material_slots:
            m = sl.material; col = np.array([0.6, 0.6, 0.6])
            if m is not None:
                col = np.array(m.diffuse_color[:3])
                if m.use_nodes:
                    for nd in m.node_tree.nodes:
                        if nd.type == 'BSDF_PRINCIPLED':
                            col = np.array(nd.inputs['Base Color'].default_value[:3]); break
            c = _srgb(col); g = c.mean()
            mats.append(np.clip((g + (c - g) * sat) * np.array(tint) * tone, 0, 1))
        co = np.array([v.co[:] for v in me.vertices], float)
        co = (np.c_[co, np.ones(len(co))] @ M.T)[:, :3]
        for p in me.polygons:
            idx = list(p.vertices)
            V.append(co[idx]); F.append(tuple(range(n, n + len(idx)))); n += len(idx)
            c = mats[p.material_index] if p.material_index < len(mats) else np.array([0.6, 0.6, 0.6])
            C.append(np.tile(c, (len(idx), 1))); S.append(bool(p.use_smooth))
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for k in list(bpy.data.meshes.keys()):
        if k not in mbefore:
            bpy.data.meshes.remove(bpy.data.meshes[k])
    for k in list(bpy.data.materials.keys()):
        if k not in matb:
            bpy.data.materials.remove(bpy.data.materials[k])
    if not V:
        _cache[key] = None
        return None
    V = np.vstack(V); C = np.vstack(C)
    lo = V.min(0); hi = V.max(0)
    sc = target_h / max(hi[2] - lo[2], 1e-6)
    V = (V - np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])) * sc
    _cache[key] = (V, F, C, S)
    return _cache[key]


def set_of(names, h, **kw):
    out = []
    for n in names:
        t = load(n, h, **kw)
        if t is not None:
            out.append(t)
    return out


def trees():
    return ktrees() + set_of([f'CommonTree_{i}' for i in range(1, 6)] + [f'Willow_{i}' for i in range(1, 4)], 9.5, tone=1.12, sat=1.35, tint=(1.05, 1.06, 0.85))


def pines():
    return set_of([f'PineTree_{i}' for i in range(1, 4)], 11.0, tone=1.4, sat=1.5)


def palms():
    return kpalms() + set_of([f'PalmTree_{i}' for i in range(1, 5)], 10.5, tone=1.15, sat=1.4, tint=(1.04, 1.06, 0.88))


def cacti():
    return kcacti() + set_of([f'Cactus_{i}' for i in range(1, 6)] + ['CactusFlowers_2', 'CactusFlowers_3'], 7.0, tone=1.2, sat=1.3, tint=(0.95, 1.08, 0.9))


def bushes():
    return kbushes() + set_of(['Bush_1', 'Bush_2'] + [f'Plant_{i}' for i in range(1, 6)], 2.6, tone=1.15, sat=1.3, tint=(1.08, 1.08, 0.85))


def rocks():
    return krocks() + set_of([f'Rock_{i}' for i in range(1, 8)] + [f'Rock_Moss_{i}' for i in range(1, 4)], 3.0, tone=1.9, sat=1.0, tint=(1.25, 1.02, 0.78))


def tufts():
    return set_of(['Grass_Short', 'Grass'], 1.6)


def _tex_image(mat):
    if mat is None or not mat.use_nodes:
        return None
    for nd in mat.node_tree.nodes:
        if nd.type == 'TEX_IMAGE' and nd.image is not None:
            return nd.image
    return None


def load_glb(name, target_h, tone=1.0, sat=1.0, tint=(1, 1, 1), green=(1.6, 0.72, 0.3), by='z'):
    """Kenney Nature Kit (CC0) GLB → template. Face colours are sampled from the shared colormap texture at each face's UV."""
    key = ('glb', name, target_h, tone, sat, tint, green, by)
    if key in _cache:
        return _cache[key]
    path = os.path.join(KEN, name + '.glb')
    if not os.path.exists(path):
        _cache[key] = None
        return None
    prev = set(bpy.data.objects.keys())
    try:
        bpy.ops.import_scene.gltf(filepath=path)
    except Exception as e:
        print('glb import failed', name, e); _cache[key] = None; return None
    new = [bpy.data.objects[k] for k in bpy.data.objects.keys() if k not in prev]
    bpy.context.view_layer.update()
    V = []; F = []; C = []; S = []; n = 0
    imgs = {}
    for o in new:
        if o.type != 'MESH':
            continue
        me = o.data; M = np.array(o.matrix_world)
        co = np.array([v.co[:] for v in me.vertices], float)
        co = (np.c_[co, np.ones(len(co))] @ M.T)[:, :3]
        uv = me.uv_layers.active.data if me.uv_layers.active else None
        cols = []
        for sl in o.material_slots:
            im = _tex_image(sl.material)
            if im is not None and im.name not in imgs:
                w, h = im.size; imgs[im.name] = (np.array(im.pixels[:]).reshape(h, w, im.channels), w, h)
            cols.append((imgs[im.name] if im is not None else None, sl.material))
        for p in me.polygons:
            idx = list(p.vertices)
            c = np.array([0.6, 0.6, 0.6])
            if p.material_index < len(cols):
                tinfo, mat = cols[p.material_index]
                if tinfo is not None and uv is not None:
                    u = np.mean([uv[l].uv[0] for l in p.loop_indices]); v_ = np.mean([uv[l].uv[1] for l in p.loop_indices])
                    arr, w, h = tinfo
                    c = arr[min(h - 1, max(0, int(v_ * h))), min(w - 1, max(0, int(u * w))), :3].astype(float)
                elif mat is not None:
                    c = np.array(mat.diffuse_color[:3])
            if c[1] > c[0] * 1.35:
                c = c * np.array(green)          # Kenney leaves are mint/teal: pull them to olive/forest green
            g = c.mean(); c = np.clip((g + (c - g) * sat) * np.array(tint) * tone, 0, 1)
            V.append(co[idx]); F.append(tuple(range(n, n + len(idx)))); n += len(idx)
            C.append(np.tile(c, (len(idx), 1))); S.append(bool(p.use_smooth))
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    if not V:
        _cache[key] = None
        return None
    V = np.vstack(V); C = np.vstack(C)
    lo = V.min(0); hi = V.max(0)
    ext = max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) if by == 'max' else hi[2] - lo[2]
    sc = target_h / max(ext, 1e-6)
    V = (V - np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])) * sc
    print('GLB', name, 'dims', [round(float(x), 2) for x in (hi - lo) * sc])
    _cache[key] = (V, F, C, S)
    return _cache[key]


def kset(names, h, **kw):
    return [t for t in (load_glb(n, h, **kw) for n in names) if t is not None]


_KT = dict(tone=0.88, sat=1.0, tint=(1.0, 1.0, 1.0))


def ktrees():
    return kset(['tree_default', 'tree_oak', 'tree_detailed', 'tree_fat', 'tree_simple', 'tree_tall', 'tree_thin', 'tree_small', 'tree_default_dark', 'tree_oak_dark', 'tree_detailed_dark'], 9.5, **_KT)


def kpalms():
    return kset(['tree_palm', 'tree_palmTall', 'tree_palmBend', 'tree_palmDetailedShort', 'tree_palmDetailedTall', 'tree_palmShort'], 10.5, **_KT)


def kcacti():
    return kset(['cactus_short', 'cactus_tall'], 7.0, **_KT)


def kbushes():
    return kset(['plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushSmall', 'plant_bushTriangle', 'plant_flatTall'], 2.6, **_KT)


def kflowers():
    return kset([f'flower_{c}{k}' for c in ('red', 'yellow', 'purple') for k in 'ABC'], 1.4, **_KT)


def krocks():
    return kset([f'rock_tall{k}' for k in 'ABCDEFGHIJ'] + [f'rock_large{k}' for k in 'ABCDEF'] + [f'stone_large{k}' for k in 'ABCDEF'], 3.2, tone=0.72, sat=0.8, tint=(1.18, 1.0, 0.78), green=(1.5, 0.7, 0.35))


def ksmallrocks():
    return kset([f'rock_small{k}' for k in 'ABCDEFGHI'] + [f'stone_small{k}' for k in 'ABCDEFGHI'], 1.4, tone=0.72, sat=0.8, tint=(1.18, 1.0, 0.78), green=(1.5, 0.7, 0.35))


def kpines():
    return kset(['tree_pineRoundA', 'tree_pineRoundB', 'tree_pineRoundC', 'tree_pineRoundD', 'tree_pineRoundE', 'tree_pineRoundF', 'tree_pineTallA', 'tree_pineTallB', 'tree_pineTallC', 'tree_pineDefaultA', 'tree_pineDefaultB', 'tree_pineSmallA', 'tree_pineSmallB'], 11.0, tone=0.8, sat=1.0, tint=(1, 1, 1), green=(1.55, 0.85, 0.4))


def pines():
    return kpines() + set_of([f'PineTree_{i}' for i in range(1, 4)], 11.0, tone=1.1, sat=1.3)


def stone_bridge(length=20.0):
    return load_glb('bridge_stoneRound', length, tone=0.85, sat=0.8, tint=(1.15, 1.0, 0.8), green=(1.4, 0.7, 0.4), by='max')


def alpine_rocks():
    return kset([f'rock_tall{k}' for k in 'ABCDEFGHIJ'] + [f'rock_large{k}' for k in 'ABCDEF'], 3.2, tone=0.8, sat=0.22, tint=(1.04, 1.0, 0.96), green=(0.9, 0.85, 0.8))


def river_rocks():
    return kset([f'rock_small{k}' for k in 'ABCDEFGHI'] + [f'stone_small{k}' for k in 'ABCDEFGHI'], 1.5, tone=0.8, sat=0.22, tint=(1.04, 1.0, 0.96), green=(0.9, 0.85, 0.8))
