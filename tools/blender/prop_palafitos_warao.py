"""palafitos_warao: Warao stilt-house village on a mangrove channel. Four thatched palafitos (casa_1..4) on stilts, plank walkways
(pasarelas), a small dock (muelle), nets drying (redes), a tied-up dugout 'curiara_1', and a few mangrove clumps (manglar).
Water surface z=0; plank decks at z=2.4. Origin = village centre; front faces south (-Y)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'palafitos_warao'
GROUND = 0x5a7a56
PREVIEW = dict(az=0, pitch=float(os.environ.get('PITCH', '70')), fit=float(os.environ.get('FIT', '0.95')))
AO_DIST = 8.0

DECK = 2.4
PLANK = 0xb99464
PLANKD = 0x6e5236
POST = 0x5a4430
THATCH = 0xc2a45a
THATCHD = 0x9a8040
THATCHL = 0xd6bc72
WALL = 0xb8946a
DARK = 0x3a2c22
ROPE = 0xd9d0b0


def stilt(p, x, y, z0=-1.0, z1=DECK, w=.26):
    p.beam((x, y, z0), (x, y, z1), w, POST, sides=3)


def house(p, cx, cy, rz, w=7.0, d=6.0, wall_h=2.4, roof_h=3.8):
    co, si = math.cos(rz), math.sin(rz)

    def T(x, y, z=0):
        return (cx + x * co - y * si, cy + x * si + y * co, z)
    # deck
    p.cbox((cx, cy, DECK - .35), (w + 1.0, d + 1.0, .45), PLANK, ch=.12, rz=rz, bottom=False, tcolor=0xd0ac76)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y, _ = T(sx * (w / 2 - .1), sy * (d / 2 - .1))
            stilt(p, x, y)
    x, y, _ = T(0, d / 2 - .1)
    stilt(p, x, y)
    x, y, _ = T(0, -d / 2 + .1)
    stilt(p, x, y)
    # low plank walls: back and sides only, open front
    z0 = DECK + .1
    bx, by, _ = T(0, d / 2 - .15)
    p.box((bx, by, z0), (w - .2, .3, wall_h * .55), WALL, rz=rz, bottom=False)
    for sx in (-1, 1):
        sx_, sy_, _ = T(sx * (w / 2 - .15), 0)
        p.box((sx_, sy_, z0), (.3, d - .4, wall_h * .55), WALL, rz=rz, bottom=False)
    # four corner posts carry the roof
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y, _ = T(sx * (w / 2 - .2), sy * (d / 2 - .2))
            p.beam((x, y, z0), (x, y, z0 + wall_h), .18, POST, sides=3)
    # dark doorway shadow on the front (south) side wall of the roofed interior
    fx, fy, _ = T(0, d / 2 - .45)
    p.box((fx, fy, z0 + .05), (2.2, .2, 1.4), DARK, rz=rz, bottom=False, top=False)
    # steep thatch roof, ridge along local X
    p.gable((cx, cy, DECK + wall_h), w, d, roof_h, THATCH, THATCHD, rz=rz, strips=3, overhang=.8)
    rx, ry, _ = T(0, 0)
    p.beam((rx - w / 2 - .9 * co, ry - w / 2 * 0 - .9 * si, DECK + wall_h + roof_h + .05), (rx + (w / 2 + .9) * co, ry + (w / 2 + .9) * si, DECK + wall_h + roof_h + .05), .18, THATCHL, sides=3)
    # ladder to the water at the front (south, local -Y)
    lx, ly, _ = T(-w / 4, -d / 2 - .9)
    p.beam((lx, ly, DECK), (lx - .2 * si, ly - .9 * co + 0.0, -.2), .1, POST, sides=3)
    lx2, ly2, _ = T(w / 4, -d / 2 - .9)


def walk(p, a, b, w=1.7, z=DECK):
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    ln = math.hypot(b[0] - a[0], b[1] - a[1])
    cx, cy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    p.box((cx, cy, z - .3), (ln, w, .3), PLANK, rz=ang, bottom=False, tcolor=0xd0ac76)
    n = max(2, int(ln / 7))
    for i in range(n + 1):
        t = i / n
        x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        for sg in (-1, 1):
            px, py = x - math.sin(ang) * sg * (w / 2 - .1), y + math.cos(ang) * sg * (w / 2 - .1)
            stilt(p, px, py, -1.0, z - .1, .15)


def canoe(p, cx, cy, rot, Lh=4.6, W=2.0, H=.8):
    """Compact dugout hull (single part, ~70 tris)."""
    xs = [-Lh + 2 * Lh * i / 4 for i in range(5)]

    def sect(x, inner=1.0, rise=.5):
        t = x / Lh
        s = max(.05, 1 - t * t) ** .55 * inner
        top = H + rise * abs(t) ** 2.2
        return [(x, (W / 2) * s * math.cos(math.pi + math.pi * i / 4), top + (.8 * inner ** .5) * s ** .6 * math.sin(math.pi + math.pi * i / 4)) for i in range(5)]
    co, si = math.cos(rot), math.sin(rot)

    def Tp(q):
        return (cx + q[0] * co - q[1] * si, cy + q[0] * si + q[1] * co, q[2])
    outer = [[Tp(q) for q in sect(x)] for x in xs]
    inner = [[Tp(q) for q in sect(x, .78, .45)] for x in xs]
    for a, b in zip(outer, outer[1:]):
        for i in range(4):
            p.face([a[i], a[i + 1], b[i + 1], b[i]], 0x6e4a2a, flip_ref=lib.Vector((cx, cy, H)))
    for a, b in zip(inner, inner[1:]):
        for i in range(4):
            f = p.face([a[i], a[i + 1], b[i + 1], b[i]], 0xc79a62, flip_ref=lib.Vector((cx, cy, H)))
            if f is not None:
                f.normal_flip()
    for a, o in zip(outer, inner):
        pass
    for k in range(4):
        for e in (0, 4):
            p.face([outer[k][e], outer[k + 1][e], inner[k + 1][e], inner[k][e]], 0x5a3a20, up=True)
    for e in (0, 4):
        p.face([outer[0][e], inner[0][e], inner[0][4 - e], outer[0][4 - e]], 0x5a3a20, up=True)
        p.face([outer[4][e], inner[4][e], inner[4][4 - e], outer[4][4 - e]], 0x5a3a20, up=True)


def build(L):
    P = L.P
    out = []
    # houses
    layout = [(-19, 8, .1, 9.0, 7.4), (3, 14, -.12, 8.4, 7.2), (23, 6, .08, 9.4, 7.6), (-3, -4, .0, 7.6, 6.4)]
    for i, (x, y, rz, w, d) in enumerate(layout):
        h = L.Part('casa_%d' % (i + 1), ao=0.0)
        house(h, x, y, rz, w, d)
        out.append(h)
    # walkways joining the decks + dock
    wk = L.Part('pasarelas', ao=0.0)
    walk(wk, (-13.7, 8.9), (-1.9, 13.3))
    walk(wk, (7.9, 13.4), (17.6, 7.3))
    walk(wk, (-16.5, 3.4), (-7.7, -2.6))
    walk(wk, (-3, -8.0), (-3, -20.1))
    out.append(wk)
    dk = L.Part('muelle', ao=0.0)
    dk.cbox((-3, -22, DECK - .3), (9, 4.0, .3), PLANK, ch=.08, bottom=False, tcolor=0xd0ac76)
    for sx in (-6.9, -3, .9):
        for sy in (-23.5, -20.5):
            stilt(dk, sx, sy, -1.0, DECK - .1, .2)
    dk.beam((-7.6, -20.2, DECK), (-7.6, -20.2, DECK + 1.6), .14, POST, sides=3)      # mooring post
    dk.ico((-.2, -22.4, DECK + .3), .6, ROPE, sub=0, sc=(1.4, 1, .5))                 # rope coil
    out.append(dk)
    cu = L.Part('curiara_1', ao=0.0)
    canoe(cu, -11.5, -22.5, 1.55, Lh=6.0, W=2.8, H=1.0)
    cu.beam((-8.1, -21.0, DECK - .3), (-7.6, -20.2, DECK + .6), .06, ROPE, sides=3)  # tie line
    out.append(cu)
    # nets drying: flat racks (two A-frames + a stretched net, seen from above) with red floats
    nt = L.Part('redes', ao=0.0)
    for (nx, ny, rz) in ((12.5, -3.5, .4), (-12, -13.5, -.3)):
        co, si = math.cos(rz), math.sin(rz)

        def pt(u, v, z):
            return (nx + u * co - v * si, ny + u * si + v * co, z)
        for (u, v) in ((-3.6, -1.6), (3.6, -1.6), (-3.6, 1.6), (3.6, 1.6)):
            q = pt(u, v, 0)
            nt.beam((q[0], q[1], -1.0), (q[0], q[1], 2.4), .16, POST, sides=3)
        nt.beam(pt(-3.6, 0, 2.4), pt(3.6, 0, 2.4), .12, POST, sides=3)
        for k in range(6):
            u0, u1 = -3.8 + k * 1.27, -3.8 + (k + 1) * 1.27
            col = 0xe6dcc0 if k % 2 == 0 else 0xcfc4a2
            nt.face([pt(u0, -1.9, 2.55 - .35 * math.sin((k / 6) * math.pi)), pt(u1, -1.9, 2.55 - .35 * math.sin(((k + 1) / 6) * math.pi)),
                     pt(u1, 1.9, 2.55 - .35 * math.sin(((k + 1) / 6) * math.pi)), pt(u0, 1.9, 2.55 - .35 * math.sin((k / 6) * math.pi))], col, up=True)
        for k in range(3):
            q = pt(-2.4 + k * 2.4, 1.9, 2.5)
            nt.ico(q, .3, 0xd9702a, sub=0)
    out.append(nt)
    # mangrove clumps for lushness at the edges
    mg = L.Part('manglar', ao=0.0)
    for (x, y, r) in ((-31, 0, 3.4), (34, -6, 3.6), (14, -19, 3.0), (-24, -17, 2.8)):
        mg.beam((x, y, -.5), (x, y, 2.6), .5, POST, sides=3)
        for k in range(3):
            a = 2 * math.pi * k / 3 + x
            mg.beam((x, y, 2.2), (x + 2.8 * math.cos(a), y + 2.8 * math.sin(a), -.7), .22, POST, sides=3)
        mg.ico((x, y, 3.4 + r * .35), r, 0x2a6a38, sub=0, sc=(1.2, 1.15, .8), jitter=.1, seed=int(x), tcolor=0x3f8a40)
        mg.ico((x + r * .6, y - r * .3, 3.0 + r * .1), r * .7, 0x1c4f2c, sub=0, sc=(1.2, 1.1, .8), jitter=.12, seed=int(y + 3), tcolor=0x2a6a38)
    out.append(mg)
    only = os.environ.get('ONLY')
    return [o for o in out if not only or o.name in only.split(',')]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
