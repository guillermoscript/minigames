"""terrain_venezuela: builds the island terrain from the page's own height/colour grid (assets/blender/terrain_src), so board tiles,
paths and rivers still sit on the same surface, then bakes ray-traced AO + sun shadows (including shadows cast by the landmark props)
into vertex colours and exports assets/models/venezuela_terrain.glb.
Run: blender -b -P tools/blender/terrain_venezuela.py
Source grid: heights.f32 / colors.u8 (261x261, world X,Z = -600..600) and pos.json (relaxed tile positions) exported by mapa3d-modelos.html."""
import bpy, bmesh, math, os, sys, json, struct, time
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

SRC = os.path.join(lib.BLEND_DIR, 'terrain_src')
N, W = 261, 1200.0
SEA, TOPE = 1.5, 10.0
t0 = time.time()

H = struct.unpack('<%df' % (N * N), open(os.path.join(SRC, 'heights.f32'), 'rb').read())
C = open(os.path.join(SRC, 'colors.u8'), 'rb').read()
POS = json.load(open(os.path.join(SRC, 'pos.json')))


def hsamp(X, Z):
    fx = max(0, min(N - 1.001, (X + W / 2) / W * (N - 1)))
    fz = max(0, min(N - 1.001, (Z + W / 2) / W * (N - 1)))
    i, j = int(fx), int(fz)
    u, v = fx - i, fz - j
    a = H[j * N + i] * (1 - u) + H[j * N + i + 1] * u
    b = H[(j + 1) * N + i] * (1 - u) + H[(j + 1) * N + i + 1] * u
    return a * (1 - v) + b * v


def altura(dx, dy):
    return hsamp(dx - 500, dy - 500)


# ── mesh: keep land + shelf cells ──
bpy.ops.wm.read_factory_settings(use_empty=True)
bm = bmesh.new()
verts = {}
step = W / (N - 1)


def vert(i, j):
    k = j * N + i
    if k not in verts:
        verts[k] = bm.verts.new((-W / 2 + i * step, -(-W / 2 + j * step), H[k]))   # Blender Y = -three Z
        verts[k].index = k
    return verts[k]


for j in range(N - 1):
    for i in range(N - 1):
        ks = (j * N + i, j * N + i + 1, (j + 1) * N + i, (j + 1) * N + i + 1)
        if max(H[k] for k in ks) < -11.5:
            continue
        a, b, c, d = vert(i, j), vert(i + 1, j), vert(i, j + 1), vert(i + 1, j + 1)
        # alternate the split so ridges don't all lean the same way
        if (i + j) % 2:
            bm.faces.new((a, c, b)); bm.faces.new((b, c, d))
        else:
            bm.faces.new((a, c, d)); bm.faces.new((a, d, b))
bm.normal_update()
for f in bm.faces:
    if f.normal.z < 0:
        f.normal_flip()
bm.verts.ensure_lookup_table()
mesh = bpy.data.meshes.new('terrain')
srckey = [v.index for v in bm.verts]
bm.to_mesh(mesh)
bm.free()
obj = bpy.data.objects.new('terrain', mesh)
bpy.context.scene.collection.objects.link(obj)
print('terrain verts', len(mesh.vertices), 'tris', len(mesh.polygons))

# ── props as shadow casters, placed exactly like the page does ──
def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lib.MODEL_DIR, name + '.glb'))
    return [o for o in bpy.data.objects if o not in before and o.type == 'MESH']


def place(objs, dx, dy, y=None, rot=0.0, sx=1.0, sc=1.0, zero=False):
    p = Vector((dx - 500, -(dy - 500), y if y is not None else max(altura(dx, dy), SEA)))
    M = Matrix.Translation(p) @ Matrix.Rotation(rot, 4, 'Z') @ Matrix.Diagonal((sx * sc, sc, sc, 1))
    for o in objs:
        if zero:
            o.location = (0, 0, 0)
            o.rotation_mode = 'XYZ'
            o.rotation_euler = (0, 0, 0)
            o.scale = (1, 1, 1)
            bpy.context.view_layer.update()
        o.parent = None
        o.matrix_world = M @ o.matrix_world
    bpy.context.view_layer.update()


occ = []
for nm, args in (
    ('caracas', dict(dx=POS['ccs_start']['x'], dy=POS['ccs_start']['y'], y=max(altura(POS['ccs_start']['x'], POS['ccs_start']['y']), SEA + .3))),
    ('caracas_hillside', dict(dx=520, dy=168, y=max(altura(520, 168), TOPE) - .2)),
    ('avila_ridge', dict(dx=530, dy=150, y=max(altura(530, 150), TOPE) - .3)),
    ('angel_falls_tepui', dict(dx=735, dy=612, y=TOPE - .6)),
    ('hato_llanos', dict(dx=369, dy=452, y=max(altura(369, 452), TOPE) - .1)),
    ('oil_derricks', dict(dx=150, dy=298, y=SEA)),
):
    objs = import_glb(nm)
    place(objs, **args)
    occ += objs
A, B = POS['zul_maracaibo'], POS['zul_cabimas']
objs = import_glb('maracaibo_bridge')
place(objs, (A['x'] + B['x']) / 2, (A['y'] + B['y']) / 2, y=SEA, rot=-math.atan2(B['y'] - A['y'], B['x'] - A['x']), sx=(math.hypot(B['x'] - A['x'], B['y'] - A['y']) + 24) / 96)
occ += objs
all_rocks = import_glb('mochima_rocks')
keep = {}
for nm, x, y, s, k in (('rock_l_2', 690, 152, 1, 0), ('rock_m_2', 722, 146, 1.1, 1), ('rock_s_1', 646, 140, 1.3, 2), ('rock_m_1', 852, 142, 1.1, 3)):
    src = [o for o in all_rocks if o.name.startswith(nm)][0]
    cp = src.copy(); cp.data = src.data
    bpy.context.scene.collection.objects.link(cp)
    place([cp], x, y, y=SEA, rot=k * 1.7, sc=s, zero=True)
    occ.append(cp)
for o in all_rocks:
    bpy.data.objects.remove(o)

# ── bake (per vertex) ──
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
print('bvh tris', len(polys), 'in', round(time.time() - t0, 1), 's')

mesh.update()
mesh.calc_normals() if hasattr(mesh, 'calc_normals') else None
vn = [Vector((0, 0, 0)) for _ in mesh.vertices]
for p in mesh.polygons:
    for v in p.vertices:
        vn[v] += p.normal * p.area
for i, n in enumerate(vn):
    n.normalize()
hemi = lib._hemi(14)
SUN = lib.SUN
jit = [(0, 0), (.14, 0), (-.14, 0), (0, .14), (0, -.14)]
col = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
AMB = 0.62
for i, v in enumerate(mesh.vertices):
    k = srckey[i]
    r, g, b = C[k * 3] / 255, C[k * 3 + 1] / 255, C[k * 3 + 2] / 255
    h = v.co.z
    if h < SEA - 0.6:                      # seabed: keep the painted turquoise/blue, only a light depth fade
        col.data[i].color = (r ** 2.2, g ** 2.2, b ** 2.2, 1.0)
        continue
    n = vn[i]
    t = n.cross(Vector((0, 0, 1)) if abs(n.z) < .9 else Vector((1, 0, 0))).normalized()
    bt = n.cross(t)
    pos = v.co + n * 0.12 + Vector((0, 0, .02))
    hit = 0.0
    for (x, y, z) in hemi:
        d = t * x + bt * y + n * z
        res = bvh.ray_cast(pos, d, 22.0)
        if res[0] is not None:
            hit += 1.0 - 0.5 * (res[3] / 22.0)
    ao = 1.0 - 0.8 * hit / len(hemi)
    lam = max(0.0, n.dot(SUN))
    sh = 0.0
    if lam > 0:
        for (jx, jy) in jit:
            if bvh.ray_cast(pos, (SUN + Vector((jx, jy, 0))).normalized(), 500.0)[0] is not None:
                sh += 1
        sh /= len(jit)
    sun = lam * (1 - sh)
    L = min(1.0, (AMB * ao + (1 - AMB) * sun * (.6 + .4 * ao)) * 1.06)
    tint = 1 - L
    col.data[i].color = (min(1, r * L * (1 - .05 * tint)) ** 2.2, min(1, g * L * (1 - .02 * tint)) ** 2.2, min(1, b * (L + tint * .16)) ** 2.2, 1.0)   # POINT colours are exported as-is: store linear like the props
mesh.color_attributes.active_color = col
mesh.color_attributes.render_color_index = 0
for p in mesh.polygons:
    p.use_smooth = False
mat = lib.make_material()
mesh.materials.append(mat)
print('baked in', round(time.time() - t0, 1), 's')

# export only the terrain
for o in list(bpy.data.objects):
    if o is not obj:
        bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
out = os.path.join(lib.MODEL_DIR, 'venezuela_terrain.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                          export_materials='EXPORT', export_vertex_color='ACTIVE', export_normals=False, export_texcoords=False,
                          export_cameras=False, export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(lib.BLEND_DIR, 'venezuela_terrain.blend'))
print('TERRAIN_INFO tris', len(mesh.polygons), 'verts', len(mesh.vertices), 'bytes', os.path.getsize(out), 'secs', round(time.time() - t0, 1))
