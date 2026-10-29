"""Shared helpers for the LA FIESTA landmark pack (run inside Blender: blender -b -P <prop>.py).

Conventions
- Blender Z is up. glTF export converts to Y-up, so Blender +X = three +X (east),
  Blender -Y = three +Z (south, toward the game camera), Blender +Y = three -Z (north).
- 1 unit = 1 design-canvas unit. Every prop has its origin at the base centre.
- Colours are stored as RAW sRGB hex values in a FLOAT_COLOR attribute "Col". The board
  page (three r13x, default linear output) shows `new THREE.Color(hex)` as-is, so the
  glTF COLOR_0 must hold the same raw numbers to match the terrain palette.
- Shading is baked into the vertex colours: per-face light (key light from -X,-Y like the
  page's sun), a cool shadow tint and a soft ground-contact AO ramp.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BLEND_DIR = os.path.join(ROOT, 'assets', 'blender')
PREV_DIR = os.path.join(BLEND_DIR, 'previews')
MODEL_DIR = os.path.join(ROOT, 'assets', 'models')

# ── palette (matches mapa3d terrain) ──
def hexc(h):
    return ((h >> 16) & 255) / 255.0, ((h >> 8) & 255) / 255.0, (h & 255) / 255.0

P = dict(
    selva=0x2c6f32, selva2=0x1f5f2a, selvaL=0x3f8a40, llano=0xa8b65a, llanoD=0x8c9c48,
    arena=0xd9b878, arena2=0xdcc98c, ccs=0x7d9f50, ccsD=0x5f8040,
    roca=0xb09a78, rocaD=0x7d6a52, rocaL=0xcdb892, tepuy=0xb5714a, tepuyD=0x8a4f34, tepuyL=0xd08c5c,
    white=0xf2f4f8, glass=0x3f6aa0, glassL=0x5f8fc8, glassD=0x2f4f80, band=0xcfd6e2, concrete=0xb9bfc9, concD=0x8a93a3,
    asphalt=0x4a4f5a, road=0xf0e2b6, pier=0xaeb4bf, steel=0x30343c, steelL=0x5a606c,
    teja=0xb8553a, tejaD=0x96432f, wall=0xf6f0e0, wood=0x7a5230, woodD=0x5a3a20, door=0x6e4a2a,
    red=0xd92a2a, redD=0xa01f1f, flame=0xff7a2a, water=0x56b4e8, fall=0xeaf6ff, mist=0xffffff,
    cowW=0xf4efe4, cowB=0x7a4a2a, cowK=0x2a2420, dirt=0xc4a470, plaza=0xd7cfbb, fount=0x9aa8b8,
    foam=0xeef6ff, trunk=0x6e4a2a,
    tejaL=0xcf6c4a, zocalo=0x7aa0b8, hay=0xd6b85c, hayD=0xa88a3e, stone=0x9a9484, shutter=0x3f7f8a,
)
CASAS = [0xeadfc8, 0xd9c39a, 0xc98560, 0xd8b45a, 0x8fa9bf, 0xe3a98c, 0xa9bc95]   # muted facades

KEY = Vector((-0.5, -0.6, 0.0)).normalized()  # horizontal key-light direction (toward the light)


def _sstep(a, b, v):
    t = max(0.0, min(1.0, (v - a) / (b - a) if b != a else 1.0))
    return t * t * (3 - 2 * t)


def _pack(c):
    return (int(c) if isinstance(c, int) else c)


class Part:
    """One exported mesh object. Geometry is local; `loc` places the object."""

    def __init__(self, name, loc=(0, 0, 0), ao_h=3.0, ao=0.22, floor=None, rot=0.0):
        self.name = name
        self.loc = loc
        self.rot = rot
        self.ao_h = ao_h
        self.ao = ao
        self.floor = floor
        self.bm = bmesh.new()
        self.lay = self.bm.loops.layers.color.new('Col')
        self.fcol = self.bm.faces.layers.int.new('hexc')
        self.fsh = self.bm.faces.layers.float.new('shade')  # per-face shade multiplier override (0 = auto)
        self.fsm = self.bm.faces.layers.int.new('smooth')   # 1 = take colours per vertex from self.vcolfn(x,y,z)
        self.vcolfn = None
        self.obj = None

    # ── low level ──
    def face(self, pts, color, shade=0.0, flip_ref=None, up=False, smooth=False):
        vs = [self.bm.verts.new(p) for p in pts]
        try:
            f = self.bm.faces.new(vs)
        except ValueError:
            return None
        f[self.fcol] = int(color)
        f[self.fsh] = shade
        f[self.fsm] = 1 if smooth else 0
        if flip_ref is not None:
            f.normal_update()
            if f.normal.dot(f.calc_center_median() - flip_ref) < 0:
                f.normal_flip()
        if up:
            f.normal_update()
            if f.normal.z < 0:
                f.normal_flip()
        return f

    def _poly(self, ring, color, ref):
        return self.face(ring, color, flip_ref=ref)

    # ── primitives (all closed convex pieces are oriented outward by centroid test) ──
    def box(self, c, s, color, rz=0.0, bottom=True, top=True, colors=None, tcolor=None):
        """Axis box centred at c (c.z = bottom?) -> c is the BOTTOM centre. s = (sx, sy, sz)."""
        cx, cy, cz = c
        sx, sy, sz = s
        co, si = math.cos(rz), math.sin(rz)

        def T(x, y, z):
            return (cx + x * co - y * si, cy + x * si + y * co, cz + z)
        hx, hy = sx / 2, sy / 2
        v = [T(-hx, -hy, 0), T(hx, -hy, 0), T(hx, hy, 0), T(-hx, hy, 0),
             T(-hx, -hy, sz), T(hx, -hy, sz), T(hx, hy, sz), T(-hx, hy, sz)]
        ref = Vector(T(0, 0, sz / 2))
        col = colors or {}
        sides = [(0, 1, 5, 4, 'n'), (1, 2, 6, 5, 'e'), (2, 3, 7, 6, 's'), (3, 0, 4, 7, 'w')]
        for a, b, cc, d, k in sides:
            self.face([v[a], v[b], v[cc], v[d]], col.get(k, color), flip_ref=ref)
        if top:
            self.face([v[4], v[5], v[6], v[7]], col.get('t', tcolor if tcolor is not None else color), flip_ref=ref)
        if bottom:
            self.face([v[0], v[1], v[2], v[3]], col.get('b', color), flip_ref=ref)

    def frustum(self, c, r0, r1, h, n, color, rz=0.0, sy=1.0, top=True, bottom=True, tcolor=None, ring_colors=None):
        """n-gon frustum, base centre c. r0/r1 radii (x); sy squashes y. Optional per-side colours."""
        cx, cy, cz = c
        b = [(cx + r0 * math.cos(rz + 2 * math.pi * i / n), cy + r0 * sy * math.sin(rz + 2 * math.pi * i / n), cz) for i in range(n)]
        t = [(cx + r1 * math.cos(rz + 2 * math.pi * i / n), cy + r1 * sy * math.sin(rz + 2 * math.pi * i / n), cz + h) for i in range(n)]
        ref = Vector((cx, cy, cz + h / 2))
        for i in range(n):
            j = (i + 1) % n
            col = ring_colors[i % len(ring_colors)] if ring_colors else color
            if r1 <= 1e-6:
                self.face([b[i], b[j], t[i]], col, flip_ref=ref)
            else:
                self.face([b[i], b[j], t[j], t[i]], col, flip_ref=ref)
        if top and r1 > 1e-6:
            self.face(t, tcolor if tcolor is not None else color, flip_ref=ref)
        if bottom and r0 > 1e-6:
            self.face(b, color, flip_ref=ref)

    def poly_prism(self, ring, z0, z1, color, tcolor=None, bottom=True, top=True, ring_colors=None):
        """Extrude an (x,y) ring (convex-ish, CCW irrelevant) from z0 to z1."""
        n = len(ring)
        cx = sum(p[0] for p in ring) / n
        cy = sum(p[1] for p in ring) / n
        ref = Vector((cx, cy, (z0 + z1) / 2))
        for i in range(n):
            j = (i + 1) % n
            col = ring_colors[i % len(ring_colors)] if ring_colors else color
            self.face([(ring[i][0], ring[i][1], z0), (ring[j][0], ring[j][1], z0),
                       (ring[j][0], ring[j][1], z1), (ring[i][0], ring[i][1], z1)], col, flip_ref=ref)
        if top:
            self.face([(p[0], p[1], z1) for p in ring], tcolor if tcolor is not None else color, flip_ref=ref)
        if bottom:
            self.face([(p[0], p[1], z0) for p in ring], color, flip_ref=ref)

    def beam(self, p0, p1, w, color, sides=3):
        """Thin tube between two points (no caps)."""
        a, b = Vector(p0), Vector(p1)
        d = b - a
        if d.length < 1e-6:
            return
        d.normalize()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
        u = d.cross(up).normalized()
        v = d.cross(u).normalized()
        ra = [a + (u * math.cos(2 * math.pi * i / sides) + v * math.sin(2 * math.pi * i / sides)) * w for i in range(sides)]
        rb = [b + (u * math.cos(2 * math.pi * i / sides) + v * math.sin(2 * math.pi * i / sides)) * w for i in range(sides)]
        ref = (a + b) / 2
        for i in range(sides):
            j = (i + 1) % sides
            self.face([ra[i], ra[j], rb[j], rb[i]], color, flip_ref=ref)

    def ico(self, c, r, color, sub=1, sc=(1, 1, 1), jitter=0.0, seed=1, tcolor=None, cut_below=None, bands=None):
        """Low-poly icosphere. Colour blends to tcolor on upward faces."""
        import random
        rng = random.Random(seed)
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=sub, radius=1.0)
        verts = {}
        for v in tmp.verts:
            k = 1.0 + (rng.random() - 0.5) * 2 * jitter
            verts[v.index] = (c[0] + v.co.x * r * sc[0] * k, c[1] + v.co.y * r * sc[1] * k, c[2] + v.co.z * r * sc[2] * k)
        tmp.verts.ensure_lookup_table()
        ref = Vector(c)
        for f in tmp.faces:
            pts = [verts[v.index] for v in f.verts]
            if cut_below is not None and sum(p[2] for p in pts) / 3 < cut_below:
                continue
            col = color
            zc = (sum(p[2] for p in pts) / 3 - c[2]) / (r * sc[2])
            if bands is not None:
                col = bands(zc, rng.random())
            elif tcolor is not None:
                col = tcolor if zc > 0.25 else color
            self.face(pts, col, flip_ref=ref)
        tmp.free()

    # ── extra shapes ──
    def loft(self, rings, color, closed=True, caps=(False, False), colors=None, ref=None):
        """Stitch successive rings (lists of (x,y,z), same length) into quads. colors: list per ring-segment column."""
        n = len(rings[0])
        allp = [Vector(p) for r in rings for p in r]
        cen = sum(allp, Vector()) / len(allp)
        ref = ref if ref is not None else cen
        for k in range(len(rings) - 1):
            a, b = rings[k], rings[k + 1]
            for i in range(n if closed else n - 1):
                j = (i + 1) % n
                col = colors[i % len(colors)] if colors else color
                self.face([a[i], a[j], b[j], b[i]], col, flip_ref=ref)
        if caps[0]:
            self.face(rings[0], color, flip_ref=ref)
        if caps[1]:
            self.face(rings[-1], color, flip_ref=ref)

    def cbox(self, c, s, color, ch=0.5, rz=0.0, bottom=False, tcolor=None, colors=None):
        """Chamfered-top box (bottom centre c). Catches light on the rim like a bevel."""
        cx, cy, cz = c
        sx, sy, sz = s
        co, si = math.cos(rz), math.sin(rz)

        def ring(w, d, z):
            return [(cx + x * co - y * si, cy + x * si + y * co, cz + z) for x, y in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
        rings = [ring(sx, sy, 0), ring(sx, sy, sz - ch), ring(sx - 2 * ch, sy - 2 * ch, sz)]
        self.loft(rings, color, colors=colors, ref=Vector((cx, cy, cz + sz / 2)))
        self.face(rings[-1], tcolor if tcolor is not None else color, flip_ref=Vector((cx, cy, cz + sz / 2)))
        if bottom:
            self.face(rings[0], color, flip_ref=Vector((cx, cy, cz + sz / 2)))

    def gable(self, c, w, d, h, color, color2=None, rz=0.0, strips=1, overhang=0.4, ridge_x=True):
        """Gable roof sitting on z=c.z; ridge along local X (width w), eaves overhang. strips: tile bands per slope."""
        cx, cy, cz = c
        co, si = math.cos(rz), math.sin(rz)
        hw, hd = w / 2 + overhang, d / 2 + overhang

        def T(x, y, z):
            return (cx + x * co - y * si, cy + x * si + y * co, cz + z)
        ref = Vector(T(0, 0, h / 2))
        c2 = color2 if color2 is not None else color
        for sgn in (-1, 1):
            for k in range(strips):
                t0, t1 = k / strips, (k + 1) / strips
                y0, y1 = sgn * hd * (1 - t0), sgn * hd * (1 - t1)
                z0, z1 = h * t0, h * t1
                self.face([T(-hw, y0, z0), T(hw, y0, z0), T(hw, y1, z1), T(-hw, y1, z1)], color if k % 2 == 0 else c2, flip_ref=ref)
        for sx in (-1, 1):
            self.face([T(sx * hw * .94, -hd * .94, 0), T(sx * hw * .94, hd * .94, 0), T(sx * hw * .94, 0, h * .96)], color2 if color2 is not None else color, flip_ref=ref)

    def disc(self, c, r, color, rings=2, segs=12, colorfn=None):
        """Flat up-facing disc as concentric rings (so ground shadows/AO have vertices to land on)."""
        cx, cy, cz = c
        prev = None
        for k in range(rings + 1):
            rr = r * k / rings
            ring = [(cx + rr * math.cos(2 * math.pi * i / segs), cy + rr * math.sin(2 * math.pi * i / segs), cz) for i in range(segs)]
            if k == 0:
                prev = [(cx, cy, cz)]
                continue
            for i in range(segs):
                j = (i + 1) % segs
                col = colorfn(ring[i][0], ring[i][1]) if colorfn else color
                if len(prev) == 1:
                    self.face([prev[0], ring[i], ring[j]], col, up=True)
                else:
                    self.face([prev[i], ring[i], ring[j], prev[j]], col, up=True)
            prev = ring

    def grid(self, c, size, nx, ny, color, colorfn=None, z=0.0, rz=0.0):
        cx, cy, cz = c
        sx, sy = size
        for i in range(nx):
            for j in range(ny):
                x0, x1 = -sx / 2 + sx * i / nx, -sx / 2 + sx * (i + 1) / nx
                y0, y1 = -sy / 2 + sy * j / ny, -sy / 2 + sy * (j + 1) / ny
                col = colorfn((x0 + x1) / 2, (y0 + y1) / 2) if colorfn else color
                if col is None:
                    continue
                self.face([(cx + x0, cy + y0, cz + z), (cx + x1, cy + y0, cz + z), (cx + x1, cy + y1, cz + z), (cx + x0, cy + y1, cz + z)], col, up=True)

    # ── finish: store base colours; lighting is baked afterwards for the whole prop ──
    def finish(self, mat, coll):
        bm = self.bm
        bm.faces.ensure_lookup_table()
        for f in bm.faces:
            r, g, b = hexc(f[self.fcol])
            for l in f.loops:
                if f[self.fsm] and self.vcolfn:
                    rr, gg, bb = hexc(self.vcolfn(*l.vert.co))
                    l[self.lay] = (rr, gg, bb, 1.0)
                else:
                    l[self.lay] = (r, g, b, 1.0)
        mesh = bpy.data.meshes.new(self.name)
        bm.to_mesh(mesh)
        bm.free()
        for p in mesh.polygons:
            p.use_smooth = False
        mesh.color_attributes.active_color = mesh.color_attributes['Col']
        mesh.color_attributes.render_color_index = list(mesh.color_attributes.keys()).index('Col')
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(self.name, mesh)
        obj.location = self.loc
        obj.rotation_euler = (0, 0, self.rot)
        obj['ao'] = self.ao
        coll.objects.link(obj)
        self.obj = obj
        return obj


# ── ray-traced baking of ambient occlusion + sun shadow into the vertex colours ──
SUN = Vector((-0.45, -0.45, 0.8)).normalized()   # page sun (-300,600,300) in Blender axes
AMB = 0.56


def _hemi(n_samples):
    pts = []
    for i in range(n_samples):
        u = (i + 0.5) / n_samples
        phi = i * 2.399963
        r = math.sqrt(u)
        pts.append((r * math.cos(phi), r * math.sin(phi), math.sqrt(1 - u)))   # cosine weighted, local z = normal
    return pts


def bake_lighting(objs, occluders, ao_dist=14.0, ao_strength=0.85, samples=26):
    from mathutils.bvhtree import BVHTree
    verts, polys = [], []
    for o in list(objs) + list(occluders):
        mw = o.matrix_world
        base = len(verts)
        verts += [mw @ v.co for v in o.data.vertices]
        for p in o.data.polygons:
            vi = [base + v for v in p.vertices]
            for k in range(1, len(vi) - 1):
                polys.append((vi[0], vi[k], vi[k + 1]))
    bvh = BVHTree.FromPolygons(verts, polys, epsilon=0.0)
    hemi = _hemi(samples)
    sun_jit = [(0, 0), (0.12, 0.0), (-0.12, 0.0), (0.0, 0.12), (0.0, -0.12), (0.09, 0.09), (-0.09, -0.09)]
    for o in list(objs) + list(occluders):
        me = o.data
        col = me.color_attributes['Col']
        mw = o.matrix_world
        nm = mw.to_3x3().inverted_safe().transposed()
        fixed = me.attributes.get('shade')
        for p in me.polygons:
            n = (nm @ p.normal).normalized()
            fixed_v = fixed.data[p.index].value if fixed else 0.0
            t = n.cross(Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))).normalized()
            b = n.cross(t)
            for li in p.loop_indices:
                base = col.data[li].color
                if fixed_v:
                    L = fixed_v
                    col.data[li].color = (min(1, base[0] * L), min(1, base[1] * L), min(1, base[2] * L), 1.0)
                    continue
                pos = mw @ me.vertices[me.loops[li].vertex_index].co + n * 0.03
                hit = 0.0
                for (x, y, z) in hemi:
                    d = t * x + b * y + n * z
                    r = bvh.ray_cast(pos, d, ao_dist)
                    if r[0] is not None:
                        hit += 1.0 - 0.5 * (r[3] / ao_dist)
                ao = 1.0 - ao_strength * hit / len(hemi)
                lam = max(0.0, n.dot(SUN))
                sh = 0.0
                if lam > 0:
                    for (jx, jy) in sun_jit:
                        d = (SUN + Vector((jx, jy, 0))).normalized()
                        if bvh.ray_cast(pos, d, 400.0)[0] is not None:
                            sh += 1.0
                    sh /= len(sun_jit)
                sun = lam * (1.0 - sh)
                L = AMB * ao + (1 - AMB) * sun * (0.55 + 0.45 * ao) * 1.0
                L = min(1.0, L * 1.04)
                tint = 1.0 - L
                col.data[li].color = (min(1, base[0] * L * (1 - 0.05 * tint)), min(1, base[1] * L * (1 - 0.02 * tint)), min(1, base[2] * (L + tint * 0.16)), 1.0)
                if o.name == 'ground_occ':
                    pass


def make_material():
    mat = bpy.data.materials.new('palette_vc')
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    ca = nt.nodes.new('ShaderNodeVertexColor')
    ca.layer_name = 'Col'
    nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    bsdf.inputs['Metallic'].default_value = 0.0
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    coll = bpy.data.collections.new('prop')
    sc.collection.children.link(coll)
    return coll, make_material()


def tri_count(objs):
    n = 0
    for o in objs:
        me = o.data
        n += sum(len(p.vertices) - 2 for p in me.polygons)
    return n


def bounds(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    return lo, hi


def render_preview(objs, path, az=0.0, pitch=70.0, fit=1.0, size=512, bg=0x1459b8, ground=None):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.film_transparent = False
    sc.render.filepath = path
    try:
        sc.view_settings.view_transform = 'Raw'
    except Exception:
        try:
            sc.view_settings.view_transform = 'Standard'
        except Exception:
            pass
    sc.view_settings.look = 'None'
    w = bpy.data.worlds.new('w')
    w.color = tuple(c ** 2.2 for c in hexc(bg))  # compensated: preview is gamma-corrected after render
    sc.world = w
    sh = sc.display.shading
    sh.light = 'FLAT'
    sh.color_type = 'VERTEX'
    sh.show_cavity = False
    sh.show_shadows = False
    sh.show_object_outline = True
    sh.object_outline_color = (0.08, 0.06, 0.11)
    sc.display.render_aa = '8'
    lo, hi = bounds(objs)
    ctr = (lo + hi) / 2
    rad = (hi - lo).length / 2
    fov = math.radians(24)
    d = rad / math.sin(fov / 2) * 1.15 / fit
    p = math.radians(pitch)
    a = math.radians(az)
    dirn = Vector((-math.sin(a) * math.cos(p), math.cos(a) * math.cos(p), -math.sin(p)))  # looking north tilted down
    cam = bpy.data.cameras.new('cam')
    cam.angle = fov
    cam.sensor_fit = 'VERTICAL'
    cam.clip_start, cam.clip_end = 1, 5000
    co = bpy.data.objects.new('cam', cam)
    bpy.context.scene.collection.objects.link(co)
    co.location = ctr - dirn * d
    co.rotation_euler = (math.radians(90 - pitch), 0, a)
    sc.camera = co
    # optional ground disc under the prop for readability
    if ground:
        gm = bpy.data.meshes.new('g')
        r = max(hi.x - lo.x, hi.y - lo.y) * 0.75 + 4
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=True, radius=r, segments=24)
        bm.to_mesh(gm)
        bm.free()
        gobj = bpy.data.objects.new('ground', gm)
        gobj.location = (ctr.x, ctr.y, lo.z - 0.05)
        gmat = bpy.data.materials.new('g')
        gmat.diffuse_color = (*hexc(ground), 1)
        gm.materials.append(gmat)
        bpy.context.scene.collection.objects.link(gobj)
        # workbench uses vertex colours only if present; fall back to material colour
        gobj.color = (*hexc(ground), 1)
        sh.color_type = 'VERTEX'
    bpy.ops.render.render(write_still=True)
    # The headless build has no OCIO view transform: workbench writes linear, so re-encode to sRGB.
    im = bpy.data.images.load(path)
    im.colorspace_settings.name = 'Non-Color'
    px = list(im.pixels)
    for i in range(0, len(px), 4):
        px[i] = px[i] ** (1 / 2.2)
        px[i + 1] = px[i + 1] ** (1 / 2.2)
        px[i + 2] = px[i + 2] ** (1 / 2.2)
    im.pixels = px
    im.filepath_raw = path
    im.file_format = 'PNG'
    im.save()


def export(coll, name):
    os.makedirs(MODEL_DIR, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in coll.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(MODEL_DIR, name + '.glb'), export_format='GLB', use_selection=True,
        export_yup=True, export_apply=True, export_cameras=False, export_lights=False,
        export_materials='EXPORT', export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True,
        export_normals=True, export_texcoords=False, export_extras=False)


def ground_part(L, mod, lo, hi, z):
    """Preview/occlusion ground (not exported): subdivided plane with the prop's ground colour."""
    pad = max(hi.x - lo.x, hi.y - lo.y) * 0.35 + 8
    sx, sy = hi.x - lo.x + 2 * pad, hi.y - lo.y + 2 * pad
    col = getattr(mod, 'GROUND', 0x2f78d0)
    g = Part('ground_occ', ao=0.0)
    n = 28
    cxm, cym = (hi.x + lo.x) / 2, (hi.y + lo.y) / 2
    g.grid((cxm, cym, z), (sx, sy), n, n, col)
    return g


def run(mod):
    """Build a prop module: mod.NAME, mod.build(lib) -> list of Part; optional PREVIEW, GROUND (hex), GROUND_Z, AO_DIST."""
    coll, mat = reset()
    pcoll = bpy.data.collections.new('preview')
    bpy.context.scene.collection.children.link(pcoll)
    parts = mod.build(sys.modules[__name__])
    objs = [p.finish(mat, coll) for p in parts]
    bpy.context.view_layer.update()
    lo, hi = bounds(objs)
    gz = getattr(mod, 'GROUND_Z', 0.0)
    g = ground_part(sys.modules[__name__], mod, lo, hi, gz).finish(mat, pcoll)
    bpy.context.view_layer.update()
    bake_lighting(objs, [g], ao_dist=getattr(mod, 'AO_DIST', 14.0))
    tris = {o.name: sum(len(q.vertices) - 2 for q in o.data.polygons) for o in objs}
    os.makedirs(PREV_DIR, exist_ok=True)
    os.makedirs(BLEND_DIR, exist_ok=True)
    export(coll, mod.NAME)
    pv = dict(getattr(mod, 'PREVIEW', {}))
    pv.pop('ground', None)
    render_preview(objs, os.path.join(PREV_DIR, mod.NAME + '.png'), **pv)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BLEND_DIR, mod.NAME + '.blend'))
    info = dict(name=mod.NAME, tris=sum(tris.values()), per_mesh=tris,
                size=tuple(round(x, 1) for x in (hi - lo)), min=tuple(round(x, 1) for x in lo), max=tuple(round(x, 1) for x in hi))
    print('PROP_INFO', info)
    return info
