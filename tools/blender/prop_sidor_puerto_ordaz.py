"""sidor_puerto_ordaz: Puerto Ordaz steel works. Blast furnace tower, 3 chimneys (+ smoke 'humo'), rolling-mill sheds, coils, slabs, gantry crane, conveyor. Front faces -Y."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'sidor_puerto_ordaz'
GROUND = 0x9a9a8c
PREVIEW = dict(az=0, pitch=70, fit=0.95)
AO_DIST = 14.0

G1, G2, G3 = 0x8e96a3, 0xb4bac4, 0x5d6573
RUST, RUSTD = 0xb5513a, 0x8a3a2a


def build(L):
    P = L.P
    V = lib.Vector
    # ---- furnace complex ----
    f = L.Part('alto_horno', loc=(-14, 8, 0), ao=0.0)
    f.cbox((0, 0, 0), (13, 13, 3), G3, ch=.5, tcolor=G1)
    f.frustum((0, 0, 3), 5.4, 4.2, 6, 8, G1, ring_colors=[G1, G2, G1, G3])          # hearth
    f.frustum((0, 0, 9), 4.2, 5.8, 7, 8, G2, ring_colors=[G2, G1, G2, G1])          # bosh belly
    f.frustum((0, 0, 16), 5.8, 3.4, 13, 8, G1, ring_colors=[G1, G2, G3, G2])        # stack taper
    f.frustum((0, 0, 29), 3.4, 3.8, 1.4, 8, RUST, ring_colors=[RUST, RUSTD])          # top ring
    f.frustum((0, 0, 30.4), 3.8, 1.4, 2.2, 8, G3)
    for k in range(4):                                                                   # hot stove columns
        x = -8.5 + k * 0.0
    for sx, h in ((-1, 22), (1, 18)):
        f.frustum((sx * 9.8, -3.0, 0), 2.1, 1.9, h, 8, G2, ring_colors=[G2, G1])
        f.frustum((sx * 9.8, -3.0, h), 1.9, 0.01, 2.2, 8, RUST)
    f.beam((0, -2, 22), (9.8, -3, 19), .55, RUSTD, sides=4)                          # duct
    f.beam((0, -2, 22), (-9.8, -3, 21), .55, RUSTD, sides=4)
    f.beam((0, -4, 13), (0, -11, 1.5), .8, G3, sides=4)                               # skip incline
    # ---- chimneys ----
    ch = L.Part('chimeneas', loc=(8, 14, 0), ao=0.0)
    for (x, y, h, r) in ((0, 0, 40, 2.2), (7, 2, 33, 1.9), (13, -1, 27, 1.7)):
        ch.cbox((x, y, 0), (r * 2.6, r * 2.6, 2.2), G3, ch=.4, tcolor=G1)
        seg = [(r * 1.25, r * 1.0, h * .30, G2), (r * 1.0, r * .85, h * .22, RUST), (r * .85, r * .72, h * .22, G2), (r * .72, r * .66, h * .22, RUST)]
        z = 2.2
        for (a, b, hh, c) in seg:
            ch.frustum((x, y, z), a, b, hh, 8, c, ring_colors=[c, G1] if c == G2 else [RUST, RUSTD])
            z += hh
        ch.frustum((x, y, z), r * .72, r * .66, 1.0, 8, G3)
    sm = L.Part('humo', loc=(8, 14, 0), ao=0.0)
    for (x, y, z, s) in ((0, 0, 44, 2.8), (1.8, 0.4, 47.5, 3.5), (4.2, 1.0, 51, 3.9), (7.0, 1.4, 53.5, 3.0), (2.5, -1, 50.5, 2.5)):
        sm.ico((x, y, z), s, P['white'], sub=1, sc=(1, 1, .8), jitter=.1, seed=int(x * 3 + z))
    # ---- sheds (rolling mills) ----
    sh = L.Part('naves', ao=0.0)
    def shed(x, y, w, d, h, wall, roof):
        sh.cbox((x, y, 0), (w, d, h), wall, ch=.3, tcolor=wall)
        sh.gable((x, y, h), w, d, 2.6, roof, color2=G3, strips=2, overhang=.3)
    shed(6, -9, 34, 9, 5.5, G2, G1)
    shed(6, -20, 34, 8, 4.5, G1, RUST)
    shed(-22, -17, 8, 20, 4.8, G2, RUSTD)
    for i in range(6):   # doors
        sh.box((-9 + i * 5.2 + 6 - 12, -13.6, 0), (3.0, .3, 3.4), RUSTD)
    # ---- coils and slabs ----
    cs = L.Part('bobinas', ao=0.0)
    for r_ in range(2):
        for c_ in range(4):
            x, y = 26 + c_ * 3.7, -2.5 - r_ * 3.7
            cs.frustum((x, y, 0), 1.8, 1.8, 2.3, 6, RUSTD if (c_ + r_) % 3 == 0 else G1, tcolor=G3, ring_colors=[G1, G2])
            
    cs.frustum((30, -6.2, 2.1), 1.4, 1.4, 1.9, 8, RUST, tcolor=G3)
    sl = L.Part('planchones', loc=(-31, 6, 0), ao=0.0)
    for k in range(5):
        sl.cbox((0, 0, k * 1.1), (13 - k * .5, 4.2, 1.1), RUSTD if k % 2 else RUST, ch=.2, tcolor=0xc6674a)
    for k in range(4):
        sl.cbox((0, -6, k * 1.1), (11, 3.6, 1.1), G1 if k % 2 else G2, ch=.2, tcolor=G2)
    # ---- gantry crane ----
    cr = L.Part('grua', loc=(-4, -32, 0), ao=0.0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cr.frustum((sx * 13, sy * 2.6, 0), 0.9, 0.7, 11, 4, RUST, rz=math.pi / 4)
        cr.cbox((sx * 13, 0, 10.4), (2.4, 7.2, 1.2), RUSTD, ch=.2)
        cr.cbox((sx * 13, 0, 0), (3, 7.2, 0.7), G3, ch=.1)
    cr.cbox((0, 0, 11.6), (30, 2.6, 2.0), RUST, ch=.3, tcolor=0xc6674a)
    cr.cbox((3, 0, 9.0), (3.6, 2.2, 2.6), G3, ch=.3)                                   # trolley
    cr.beam((3, 0, 9.0), (3, 0, 6.0), .22, G1, sides=3)
    cr.cbox((3, 0, 4.9), (2.0, 1.6, 1.4), RUSTD, ch=.2)
    # ---- conveyor ----
    cv = L.Part('cinta', loc=(0, 0, 0), ao=0.0)
    a, b = (-22, 26, 1.5), (-20, 20, 14)
    a, b = (30, 16, 1.2), (6, 14, 24)
    cv.beam((a[0], a[1] - .8, a[2] + 1), (b[0], b[1] - .8, b[2]), .5, G3, sides=4)
    cv.beam((a[0], a[1] + .8, a[2] + 1), (b[0], b[1] + .8, b[2]), .5, G3, sides=4)
    cv.beam(a, b, .8, G2, sides=4)
    for t in (0.0, .35, .7):
        x = a[0] + (b[0] - a[0]) * t
        z = a[2] + (b[2] - a[2]) * t
        y = a[1] + (b[1] - a[1]) * t
        cv.frustum((x, y, 0), 0.7, 0.5, z - .4, 4, RUST, rz=math.pi / 4)
    # ---- ground pad ----
    parts = [f, ch, sm, sh, cs, sl, cr, cv]
    K = 0.74
    for p in parts:
        if p.name in ('naves', 'bobinas', 'planchones', 'cinta'):
            lx, ly = p.loc[0], p.loc[1]
            import bmesh
            bmesh.ops.scale(p.bm, vec=(K, K, 1), verts=list(p.bm.verts), space=lib.Matrix.Translation((0, 0, 0)))
        p.loc = (p.loc[0] * K, p.loc[1] * K, 0)
    return parts


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
