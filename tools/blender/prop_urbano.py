"""urbano: instanceable low-poly building kit for LA FIESTA cities. Each Part = one building, origin = base centre, front = -Y."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'urbano'
GROUND = 0x7d9f50
PREVIEW = dict(az=0, pitch=70, fit=1.0, size=1600)
AO_DIST = 10.0

SQ = 1.0 / math.sqrt(2)
INFO = {}   # name -> (w, d, h) for the manifest


def facade(p, cx, cy, w, d, z0, z1, fh, slab, glass, sides='sew', gf=0.55, roof=0xa9aeb8, rim=None):
    """Window-band facade; unseen north side is flat. Closed with a roof cap."""
    h2, d2 = w / 2, d / 2
    cs = {'s': ((-h2, -d2), (h2, -d2)), 'e': ((h2, -d2), (h2, d2)), 'n': ((h2, d2), (-h2, d2)), 'w': ((-h2, d2), (-h2, -d2))}
    ref = lib.Vector((cx, cy, (z0 + z1) / 2))
    nf = max(1, round((z1 - z0) / fh))
    f = (z1 - z0) / nf
    for sd, (a, b) in cs.items():
        if sd in sides:
            for k in range(nf):
                za = z0 + k * f
                zs = za + f * (1 - gf)
                for (q0, q1, col) in ((za, zs, slab), (zs, za + f, glass)):
                    p.face([(cx + a[0], cy + a[1], q0), (cx + b[0], cy + b[1], q0), (cx + b[0], cy + b[1], q1), (cx + a[0], cy + a[1], q1)], col, flip_ref=ref)
        else:
            p.face([(cx + a[0], cy + a[1], z0), (cx + b[0], cy + b[1], z0), (cx + b[0], cy + b[1], z1), (cx + a[0], cy + a[1], z1)], slab, flip_ref=ref)
    p.face([(cx - h2, cy - d2, z1), (cx + h2, cy - d2, z1), (cx + h2, cy + d2, z1), (cx - h2, cy + d2, z1)], roof, up=True)


def parapet(p, w, d, z, color, t=0.5, h=0.7):
    """Roof lip: slightly larger slab (catches light like a cornice)."""
    p.cbox((0, 0, z), (w + 0.5, d + 0.5, h), color, ch=0.2)


def tank(p, c, r, h, color=0x3f6aa0, lid=0x8a93a3, legs=0.0):
    x, y, z = c
    if legs:
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.box((x + sx * r * .6, y + sy * r * .6, z), (.25, .25, legs), 0x30343c, bottom=False, top=False)
        z += legs
    p.frustum((x, y, z), r, r * .92, h, 8, color, tcolor=lid, bottom=False)


def antenna(p, x, y, z, h, color=0x30343c):
    p.beam((x, y, z), (x, y, z + h), .12, color, 3)
    p.beam((x - .9, y, z + h * .7), (x + .9, y, z + h * .7), .08, color, 3)


def wedge(p, w, d, z, rise, color, side, lo_front=True, over=0.3):
    """Shed roof: slope rising from front (-Y) to back or vice-versa."""
    hw, hd = w / 2 + over, d / 2 + over
    z0, z1 = (z, z + rise) if lo_front else (z + rise, z)
    ref = lib.Vector((0, 0, z + rise / 2))
    p.face([(-hw, -hd, z0), (hw, -hd, z0), (hw, hd, z1), (-hw, hd, z1)], color, flip_ref=ref)
    p.face([(-hw, -hd, z), (-hw, hd, z), (-hw, hd, z1), (-hw, -hd, z0)], side, flip_ref=ref)
    p.face([(hw, -hd, z), (hw, hd, z), (hw, hd, z1), (hw, -hd, z0)], side, flip_ref=ref)
    p.face([(-hw, hd, z), (hw, hd, z), (hw, hd, z1), (-hw, hd, z1)], side, flip_ref=ref)
    p.face([(-hw, -hd, z), (hw, -hd, z), (hw, -hd, z0), (-hw, -hd, z0)], side, flip_ref=ref)


def pyramid(p, w, z, h, color, color2=None, over=0.3, apex=0.0):
    r = (w / 2 + over) / SQ * SQ * math.sqrt(2) / math.sqrt(2)
    p.frustum((0, 0, z), (w / 2 + over) * math.sqrt(2), apex, h, 4, color, rz=math.pi / 4, bottom=False,
              ring_colors=[color, color2 if color2 is not None else color])


def qf(p, x, z, w, h, color, y, ysign=-1):
    """Flat quad on a front wall (facing -Y) at wall plane y (nudged outward)."""
    yy = y + ysign * 0.03
    p.face([(x - w / 2, yy, z), (x + w / 2, yy, z), (x + w / 2, yy, z + h), (x - w / 2, yy, z + h)], color,
           flip_ref=lib.Vector((x, yy + 10 * ysign * -1, z + h / 2)))


def pieces(p, w, d, hz, y):
    pass


def reg(name, w, d, h):
    INFO[name] = (w, d, h)


def build(L):
    P = L.P
    out = []
    X = 26.0

    def part(name, col, row, ao_h=3.0):
        p = L.Part(name, loc=(col * X, -row * X, 0), ao_h=ao_h, ao=0.22)
        out.append(p)
        return p

    # ============ DOWNTOWN MID-RISE ============
    p = part('edif_a', 0, 0)
    facade(p, 0, 0, 9, 8, -0.5, 16, 3.2, 0xe6dfd0, 0x4d7098, roof=0x8a93a3)
    parapet(p, 9, 8, 16, 0xcfd6e2)
    p.cbox((-1.5, 1, 16.7), (3.4, 3.0, 2.0), 0xb9bfc9, ch=0.25)
    tank(p, (2.4, -1.2, 16.7), 1.2, 1.9, 0x3f6aa0)
    p.box((3, 2.2, 16.7), (1.4, 1.4, 1.0), 0x8a93a3)
    reg('edif_a', 9, 8, 18.7)

    p = part('edif_b', 1, 0)
    facade(p, 0, 0, 8.5, 9, -0.5, 11, 3.2, 0xd9c39a, 0x5f8fc8, roof=0xa9aeb8)
    parapet(p, 8.5, 9, 11, 0xe6dfd0)
    facade(p, 0, 0.6, 6, 6.8, 11.7, 20.5, 3.0, 0xc98560, 0x3f6aa0, roof=0x9a4c34)
    p.cbox((0, 0.6, 20.5), (6.8, 7.6, 0.6), 0x8a4f34, ch=0.2)
    antenna(p, -1.5, 1.5, 21.1, 6.0)
    p.box((1.8, 2.2, 21.1), (1.6, 1.6, 1.4), 0xb9bfc9)
    reg('edif_b', 8.5, 9, 27)

    p = part('edif_c', 2, 0)
    facade(p, 0, 0, 10, 7, -0.5, 11.5, 3.0, 0xf2f4f8, 0x3f6aa0, roof=0xf2f4f8, gf=0.6)
    wedge(p, 10, 7, 11.5, 2.4, 0x5f8a7a, 0xd8e0e2, lo_front=False, over=0.3)
    for i in (-3, 0, 3):
        p.box((i, 1.6, 13.0), (1.6, 1.0, .5), 0x30343c)
    reg('edif_c', 10.6, 7.6, 14.5)

    p = part('edif_d', 3, 0)
    facade(p, 0, 0, 7, 7.5, -0.5, 18.5, 3.1, 0xd8b45a, 0x2f4f80, roof=0xd8b45a, gf=0.5)
    parapet(p, 7, 7.5, 18.5, 0xe6dfd0)
    pyramid(p, 7.4, 19.2, 3.6, 0x2f6f72, 0x3f8a8a, over=0.2, apex=0.0)
    p.beam((0, 0, 22.7), (0, 0, 25.5), .1, 0x30343c, 3)
    reg('edif_d', 7.9, 8.4, 25.5)

    p = part('edif_e', 4, 0)
    facade(p, 0, 0, 10, 8, -0.5, 14, 3.6, 0xc9ced6, 0x4e8e6f, roof=0x8a93a3)
    parapet(p, 10, 8, 14, 0xf2f4f8)
    p.cbox((-3, 1.5, 14.7), (3.0, 3.0, 2.4), 0xe6dfd0, ch=0.2)
    p.cbox((2.5, 1.0, 14.7), (4.2, 3.4, 1.2), 0xb9bfc9, ch=0.2)
    antenna(p, 3.5, 2.0, 15.9, 5.0)
    p.box((4.4, -2.4, 14.7), (1.4, 1.4, 1.0), 0x30343c)
    reg('edif_e', 10.5, 8.5, 21)

    p = part('edif_f', 5, 0)
    facade(p, 0, 0, 8, 10, -0.5, 17.5, 3.0, 0xc98560, 0x8fa9bf, roof=0xb4604a, gf=0.5)
    parapet(p, 8, 10, 17.5, 0xe3a98c)
    p.disc((-0.5, 0, 18.25), 2.9, 0x4a4f5a, rings=1, segs=10)
    p.disc((-0.5, 0, 18.28), 1.6, 0xf2c744, rings=1, segs=8)
    tank(p, (2.4, 3.4, 18.2), 1.0, 1.5, 0xd8d8d8, legs=0.5)
    tank(p, (-2.6, 3.6, 18.2), 1.0, 1.5, 0xd8d8d8, legs=0.5)
    reg('edif_f', 8.5, 10.5, 21)

    # ============ OFFICE TOWERS ============
    p = part('torre_a', 0, 1)
    facade(p, 0, 0, 7, 7, -0.5, 35.5, 4.5, 0x2f4f80, 0x5f8fc8, roof=0x2f4f80, gf=0.78)
    p.cbox((0, 0, 35.5), (7.6, 7.6, 0.8), 0xcfd6e2, ch=0.25)
    facade(p, 0, 0, 4.4, 4.4, 36.3, 39.3, 3.0, 0x2f4f80, 0x8fb8e0, roof=0xcfd6e2, gf=0.75)
    p.beam((0, 0, 39.3), (0, 0, 44.5), .12, 0xcfd6e2, 3)
    reg('torre_a', 7.6, 7.6, 44.5)

    p = part('torre_b', 1, 1)
    facade(p, 0, 0, 6.2, 6.2, -0.5, 32, 4.0, 0xf2f4f8, 0x6f8db0, roof=0xf2f4f8, gf=0.5)
    p.cbox((0, 0, 32), (6.8, 6.8, 1.0), 0xcfd6e2, ch=0.3)
    p.box((0, 0, 33), (3.6, 3.6, 2.4), 0xe6dfd0)
    p.disc((0, 0, 35.45), 1.5, 0xd92a2a, rings=1, segs=8)
    p.box((0, 0, 35.4), (.5, .5, .1), 0xf2f4f8)
    p.beam((0, 0, 35.4), (0, 0, 39), .1, 0x30343c, 3)
    reg('torre_b', 6.8, 6.8, 39)

    p = part('torre_c', 2, 1)
    facade(p, 0, 0, 8, 6, -0.5, 24.5, 4.0, 0x20263a, 0x37486a, roof=0x20263a, gf=0.8)
    # tapered crown
    r0 = [(-4, -3, 24.5), (4, -3, 24.5), (4, 3, 24.5), (-4, 3, 24.5)]
    r1 = [(-3, -2, 30), (3, -2, 30), (3, 2, 30), (-3, 2, 30)]
    r2 = [(-1.2, -0.8, 33), (1.2, -0.8, 33), (1.2, 0.8, 33), (-1.2, 0.8, 33)]
    p.loft([r0, r1, r2], 0x37486a, colors=[0x4a5f8a, 0x20263a, 0x37486a, 0x20263a], caps=(False, True))
    p.beam((0, 0, 33), (0, 0, 38), .1, 0xcfd6e2, 3)
    p.cbox((0, 0, 24.5), (8.5, 6.5, 0.7), 0x8a93a3, ch=0.2)
    reg('torre_c', 8.5, 6.5, 38)

    # ============ HOUSES / TOWN ============
    def door_win(p, y, xs, z, wcol, dcol=0x6e4a2a, door_x=None, wh=1.5):
        for x in xs:
            qf(p, x, z, 1.2, wh, wcol, y)
        if door_x is not None:
            qf(p, door_x, 0.0, 1.3, 2.3, dcol, y)

    p = part('casa_a', 0, 2)
    p.box((0, 0, -0.5), (7, 5.6, 4.6), 0xf6f0e0, bottom=False, top=False)
    p.gable((0, 0, 4.1), 7, 5.6, 2.8, 0xb8553a, 0xcf6c4a, strips=2, overhang=0.5)
    door_win(p, -2.8, (-2.2, 2.2), 1.2, 0x3f7f8a, door_x=0)
    p.box((2.2, 1.2, 5.0), (.9, .9, 2.4), 0xb09a78)
    reg('casa_a', 8, 6.6, 8)

    p = part('casa_b', 1, 2)
    p.box((0, 0, -0.5), (6.4, 6, 7.4), 0xe3a98c, bottom=False, top=False)
    p.box((0, 0, 3.0), (6.8, 6.4, .35), 0xf6f0e0, bottom=False, top=False)
    p.gable((0, 0, 6.9), 6.4, 6, 2.2, 0xb8553a, 0x96432f, strips=2, overhang=0.5, rz=math.pi / 2)
    p.box((0, -3.4, 3.0), (5.4, 1.5, .25), 0x7a5230, bottom=False)
    p.box((0, -4.05, 3.25), (5.4, .15, .8), 0x5a3a20, bottom=False, top=False)
    for x in (-2.0, 2.0):
        qf(p, x, 4.0, 1.1, 1.8, 0x3f7f8a, -3.0)
        qf(p, x, 1.0, 1.1, 1.5, 0x3f7f8a, -3.0)
    qf(p, 0, 0.0, 1.3, 2.3, 0x6e4a2a, -3.0)
    reg('casa_b', 6.8, 7.9, 9.1)

    p = part('casa_c', 2, 2)
    p.box((0, 0, -0.5), (8, 5.2, 4.5), 0x8fa9bf, bottom=False, top=False)
    p.box((0, 0, 3.4), (8.3, 5.5, .5), 0xf6f0e0, bottom=False)
    p.gable((0, 0, 4.0), 8, 5.2, 2.4, 0xb8553a, 0xcf6c4a, strips=2, overhang=0.5)
    p.box((-1.6, -3.2, 0), (4.0, 1.4, .25), 0xd7cfbb, bottom=False)
    p.box((-1.6, -3.9, 0.25), (4.0, .2, 2.4), 0xf6f0e0, bottom=False, top=False)
    for x in (-3.5, 0.3):
        p.box((x, -3.9, 0.25), (.25, .25, 2.5), 0xf6f0e0, bottom=False)
    door_win(p, -2.6, (2.6,), 1.2, 0xf6f0e0, door_x=-1.6)
    reg('casa_c', 9, 7, 6.4)

    p = part('casa_d', 3, 2)
    p.cbox((0, 0, -0.5), (7, 7, 4.0), 0xf2f4f8, ch=0.2)
    p.cbox((-1.0, 0.5, 3.5), (5, 5, 2.8), 0xd9c39a, ch=0.2)
    p.box((2.5, -2.5, 3.5), (2.0, 2.0, .15), 0x8a93a3)
    qf(p, -1, 4.2, 3.4, 1.4, 0x4d7098, -2.0)
    qf(p, -1.8, 0.5, 2.6, 1.8, 0x4d7098, -3.5)
    qf(p, 1.8, 0.5, 1.4, 2.2, 0x7a5230, -3.5)
    p.box((-2.6, 1.8, 6.3), (1.6, 1.6, 0.9), 0x8a93a3)
    reg('casa_d', 7, 7, 7)

    p = part('casa_e', 4, 2)
    p.box((0, 0, -0.5), (5.6, 5.6, 4.5), 0xd8b45a, bottom=False, top=False)
    pyramid(p, 5.6, 4.0, 2.8, 0xb8553a, 0xcf6c4a, over=0.5)
    door_win(p, -2.8, (-1.7, 1.7), 1.3, 0x3f7f8a, door_x=0)
    p.box((1.5, 1.0, 5.2), (.7, .7, 1.6), 0xb09a78)
    reg('casa_e', 6.6, 6.6, 6.8)

    # ============ BARRIO HILLSIDE ============
    def brick_box(p, c, s, col, top=True):
        p.box((c[0], c[1], c[2]), s, col, bottom=False, top=top)

    p = part('barrio_a', 0, 3, ao_h=2)
    brick_box(p, (0, 0, -1.5), (6, 6, 6.3), 0xc0663f, top=False)
    p.box((0, 0, 4.8), (6.3, 6.3, .4), 0x8a93a3, bottom=False)
    brick_box(p, (-0.2, 0.4, 5.2), (5.0, 5.0, 3.0), 0x7fb8c2)
    p.box((0, 0, 8.2), (5.4, 5.4, .35), 0x4a9a8a, bottom=False)
    tank(p, (1.5, 1.2, 8.55), 1.0, 1.7, 0x2f4f80)
    for x in (-2.2, 2.0):
        p.beam((x, -1.8, 8.5), (x, -1.8, 10), .06, 0x7a5230, 3)
    qf(p, -1.5, 1.0, 1.1, 1.1, 0x30343c, -3.0)
    qf(p, 1.5, 1.0, 1.1, 1.1, 0x30343c, -3.0)
    reg('barrio_a', 6.3, 6.3, 10)

    p = part('barrio_b', 1, 3, ao_h=2)
    brick_box(p, (0, 0, -1.5), (6.6, 5.6, 5.5), 0xe8c24a, top=False)
    p.box((0, 0, 4.0), (6.9, 5.9, .4), 0xb9bfc9, bottom=False)
    brick_box(p, (0.3, 0, 4.4), (5.4, 5.2, 3.0), 0xd9695a, top=False)
    wedge(p, 5.4, 5.2, 7.4, 1.4, 0xb5603c, 0x8a4a30, lo_front=True, over=0.35)
    for x in (-2.4, 2.8):
        p.beam((x, -2.0, 7.4), (x, -2.0, 8.8), .05, 0x7a5230, 3)
    tank(p, (-2.6, 0.5, 7.4), .9, 1.5, 0x20263a, lid=0x5a606c)
    qf(p, -1.2, 1.0, 1.1, 1.1, 0x30343c, -3.0)
    reg('barrio_b', 6.9, 5.9, 8.8)

    p = part('barrio_c', 2, 3, ao_h=2)
    brick_box(p, (0, 0, -1.5), (6.2, 5.0, 5.5), 0xb8553a, top=False)
    p.box((0, 0, 4.0), (6.5, 5.3, .4), 0x8a93a3, bottom=False)
    brick_box(p, (-0.4, 0.3, 4.4), (4.8, 4.2, 2.8), 0xf2f4f8, top=False)
    p.gable((-0.4, 0.3, 7.2), 4.8, 4.2, 1.5, 0x6a8fb8, 0x8fb0d0, strips=3, overhang=0.4, rz=math.pi / 2)
    p.box((1.7, -1.4, 4.4), (1.6, 1.6, .25), 0xe3a98c, bottom=False)
    tank(p, (2.0, 1.4, 4.4), .9, 1.5, 0x3f6aa0)
    qf(p, 1.2, 1.0, 1.1, 1.1, 0x30343c, -2.5)
    reg('barrio_c', 6.5, 5.3, 8.7)

    p = part('barrio_d', 3, 3, ao_h=2)
    brick_box(p, (0, 0, -1.5), (7, 5, 5.6), 0x4fb0a6, top=False)
    p.box((0, 0, 4.1), (7.3, 5.3, .4), 0xb9bfc9, bottom=False)
    brick_box(p, (-0.8, 0, 4.5), (4.4, 4.4, 2.6), 0xc0663f, top=False)
    p.box((-0.8, 0, 7.1), (4.7, 4.7, .35), 0xd9b050, bottom=False)
    for x in (2.1, 2.9):
        p.beam((x, -1.6, 4.5), (x, -1.6, 6.2), .06, 0x7a5230, 3)
        p.beam((x, 1.6, 4.5), (x, 1.6, 6.2), .06, 0x7a5230, 3)
    tank(p, (-1.8, 0.8, 7.45), .85, 1.5, 0x20263a, lid=0x5a606c)
    tank(p, (-0.2, 0.9, 7.45), .85, 1.5, 0xd9695a, lid=0xb9bfc9)
    qf(p, -2.0, 1.0, 1.1, 1.1, 0x30343c, -2.5)
    reg('barrio_d', 7.3, 5.3, 9)

    # ============ OTHERS ============
    p = part('iglesia_a', 0, 4)
    p.box((0, 1.0, -0.5), (7, 11, 6.0), 0xf6f0e0, bottom=False, top=False)
    p.gable((0, 1.0, 5.5), 11, 7, 3.0, 0xb8553a, 0xcf6c4a, strips=2, overhang=0.5, rz=math.pi / 2)
    p.box((0, -5.2, -0.5), (6, 3.0, 14.0), 0xf6f0e0, bottom=False)
    p.cbox((0, -5.2, 13.5), (6.4, 3.4, 0.6), 0xd7cfbb, ch=0.2)
    pyramid(p, 5.2, 14.1, 4.0, 0xb8553a, 0xcf6c4a, over=0.0)
    qf(p, 0, 9.8, 2.0, 2.6, 0x3a3328, -6.73)
    qf(p, 0, 2.8, 1.8, 2.4, 0x30343c, -6.73)
    p.beam((0, -5.2, 18.1), (0, -5.2, 19.8), .11, 0xf2f4f8, 3)
    p.beam((-.6, -5.2, 19.2), (.6, -5.2, 19.2), .09, 0xf2f4f8, 3)
    p.box((2.5, 6.8, -0.5), (3, 3, 4.2), 0xe6dfd0, bottom=False)
    p.cbox((2.5, 6.8, 3.7), (3.2, 3.2, 0.5), 0xb8553a, ch=0.2)
    reg('iglesia_a', 7.6, 12.5, 19.8)

    p = part('iglesia_b', 1, 4)
    p.box((0, 0, -0.5), (5, 7, 4.2), 0xf6f0e0, bottom=False, top=False)
    p.gable((0, 0, 3.7), 7, 5, 2.4, 0xb8553a, 0xcf6c4a, strips=2, overhang=0.4, rz=math.pi / 2)
    # bell gable above the front wall
    p.face([(-2.0, -3.52, 3.7), (2.0, -3.52, 3.7), (1.0, -3.52, 5.9), (-1.0, -3.52, 5.9)], 0xf6f0e0, flip_ref=lib.Vector((0, 0, 4.5)))
    p.face([(-2.0, -3.52, 3.7), (2.0, -3.52, 3.7), (1.0, -3.52, 5.9), (-1.0, -3.52, 5.9)], 0xe6dfd0, flip_ref=lib.Vector((0, -10, 4.5)))
    qf(p, 0, 4.4, 0.9, 1.0, 0x30343c, -3.55)
    qf(p, 0, 0, 1.5, 2.3, 0x6e4a2a, -2.5 - 0.02 - 0.0)
    p.beam((0, -3.5, 5.9), (0, -3.5, 7.2), .08, 0xf2f4f8, 3)
    p.beam((-.45, -3.5, 6.7), (.45, -3.5, 6.7), .07, 0xf2f4f8, 3)
    reg('iglesia_b', 5, 7.5, 7.2)

    p = part('galpon', 2, 4)
    p.cbox((0, 0, -0.5), (12, 18, 1.4), 0xb9bfc9, ch=0.15)
    p.box((0, 0, 0.9), (11.4, 17.4, 4.6), 0xcfd6e2, bottom=False, top=False)
    p.gable((0, 0, 5.5), 18, 11.4, 2.6, 0x5f7f98, 0x7a9bb4, strips=4, overhang=0.5, rz=math.pi / 2)
    p.box((0, 0, 8.1), (.6, 16, .5), 0x3f5568, bottom=False)
    qf(p, -1.8, 0, 3.4, 3.6, 0x3f6aa0, -8.74)
    qf(p, 2.8, 0, 2.2, 3.0, 0x6e4a2a, -8.74)
    p.box((6.4, -3, -0.5), (1.6, 5, 3.2), 0x8a93a3, bottom=False)
    reg('galpon', 12.5, 18, 8.6)

    p = part('rancho', 3, 4)
    p.cbox((0, 0, -0.3), (8.6, 6.4, 0.6), 0xc4a470, ch=0.15)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((sx * 3.2, sy * 2.2, 0.3), (.4, .4, 2.7), 0x7a5230, bottom=False)
    p.box((0, 2.6, 0.3), (6.2, .25, 1.6), 0xc98560, bottom=False)
    p.gable((0, 0, 2.8), 9, 6.0, 3.0, 0xd6b85c, 0xa88a3e, strips=3, overhang=0.7)
    p.box((0, 0, 5.7), (9.8, .5, .3), 0xa88a3e, bottom=False)
    reg('rancho', 10.4, 7.4, 6.0)

    p = part('plaza_kiosco', 4, 4)
    p.frustum((0, 0, -0.5), 4.4, 4.2, 1.2, 8, 0xb9bfc9, rz=math.pi / 8, bottom=False, tcolor=0xd7cfbb)
    for i in range(6):
        a = 2 * math.pi * i / 6
        p.box((3.0 * math.cos(a), 3.0 * math.sin(a), 0.7), (.35, .35, 3.4), 0xf2f4f8, bottom=False)
    p.frustum((0, 0, 4.1), 4.8, 0.3, 2.4, 6, 0xb8553a, bottom=False, ring_colors=[0xb8553a, 0xf2f4f8])
    p.beam((0, 0, 6.5), (0, 0, 7.6), .1, 0x30343c, 3)
    p.frustum((0, 0, 0.7), 1.0, 0.8, 0.8, 6, 0xc98560)
    reg('plaza_kiosco', 9.6, 9.6, 7.6)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
