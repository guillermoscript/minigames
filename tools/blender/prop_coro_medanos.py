"""coro_medanos: Medanos de Coro. 3 rippled golden dunes with sinuous crests, 5 cardon cacti (candelabra), 4 round cacti, dry shrubs, colonial white church 'iglesia_coro' (bell gable, terracotta roof) at the south-east edge."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'coro_medanos'
GROUND = 0xc7a96e
GROUND_Z = -0.5
PREVIEW = dict(az=0, pitch=70, fit=1.0)
AO_DIST = 14.0

SAND = [0xe2b868, 0xd9b878, 0xdcc98c]
SANDD = 0xc89a54
CACT, CACTD, CACTL = 0x4f8a4a, 0x3d7040, 0x6aa05a
DRY = 0x8a6a40


def dune(L, name, cx, cy, Rx, Ry, H, ph, rot=0.0):
    p = L.Part(name, loc=(cx, cy, 0), ao=0.0, rot=rot)
    N = 14
    prof = [(1.0, -.6, 0), (0.93, 0.22, 0), (0.80, 0.52, 1), (0.64, 0.76, 2), (0.46, 0.92, 3), (0.28, 0.96, 4), (0.10, 1.0, 5)]
    rings = []
    for (s, zf, k) in prof:
        ring = []
        for i in range(N):
            a = 2 * math.pi * i / N
            x = s * Rx * math.cos(a)
            y = (s ** 1.5) * Ry * math.sin(a) * (1 + .15 * math.cos(2 * a + ph)) + 3.2 * math.sin(x / Rx * 3.0 + ph) * (1 - s * .4)
            z = zf * H * (0.8 + 0.2 * math.sin(x * .14 + ph)) if zf > 0 else zf
            ring.append((x, y, z))
        rings.append(ring)
    for k in range(len(rings) - 1):
        cols = []
        for i in range(N):
            a = 2 * math.pi * i / N
            c = SAND[(k + (i // 2)) % 3]
            if math.sin(a) > 0.35 and k > 0:
                c = SANDD if k % 2 else 0xbf8f4c        # leeward slip face
            cols.append(c)
        p.loft([rings[k], rings[k + 1]], SAND[0], colors=cols, ref=lib.Vector((0, 0, H * .4)))
    top = rings[-1]
    for i in range(1, N // 2):
        q = [top[i], top[i + 1], top[N - i - 1], top[N - i]]
        p.face(q, SAND[2], up=True)
    return p


def build(L):
    P = L.P
    V = lib.Vector
    rng = random.Random(8)
    parts = [dune(L, 'duna_1', -16, 8, 25, 12, 12, 0.3), dune(L, 'duna_2', 17, -2, 22, 11, 9.5, 1.7, .25),
             dune(L, 'duna_3', 2, 22, 20, 9, 8.0, 2.9, -.2)]
    # cardon cacti
    cd = L.Part('cardones', ao=0.0)
    for (x, y, h, k) in ((-28, -10, 11, 0), (-6, -14, 9, 1), (-20, -20, 8, 2), (10, -18, 10, 3), (34, 6, 9.5, 4)):
        z0 = 0.2
        h *= 1.3
        cd.frustum((x, y, z0), 1.3, 1.05, h, 5, CACT, bottom=False, ring_colors=[CACT, CACTD, CACTL], tcolor=CACTL)
        for (dx, dy, hz, ah) in ((1, 0, .45, 4.2), (-1, .3, .6, 3.4), (.3, 1, .72, 2.4)):
            zb = z0 + h * hz
            ox, oy = x + dx * 2.8, y + dy * 2.8
            cd.beam((x + dx * .5, y + dy * .5, zb), (ox, oy, zb + .3), .7, CACTD, sides=3)
            cd.frustum((ox, oy, zb), .85, .7, ah * 1.2, 4, CACT, rz=math.pi / 4, bottom=False, tcolor=CACTL, ring_colors=[CACT, CACTD])
    rc = L.Part('cactus_redondo', ao=0.0)
    for (x, y, r) in ((-33, -3, 1.5), (24, -14, 1.3), (-12, -24, 1.4), (39, -2, 1.2)):
        rc.ico((x, y, .6), r, CACT, sub=0, sc=(1, 1, .9), jitter=.08, seed=int(x), tcolor=CACTL, cut_below=.3)
        rc.ico((x + .1, y, .6 + r * .85), .35, 0xe56a8c, sub=0, seed=3)
    sh = L.Part('arbustos_secos', ao=0.0)
    for (x, y, r) in ((-24, -4, 1.7), (5, -8, 1.5), (22, -24, 1.6), (-36, 6, 1.4), (40, 14, 1.5)):
        sh.ico((x, y, .4), r, DRY, sub=0, sc=(1.3, 1.1, .8), jitter=.3, seed=int(y + 9), tcolor=0xa88a56, cut_below=.1)
    # church
    ch = L.Part('iglesia_coro', loc=(33, -20, 0), ao=0.0, rot=0.35)
    WALL = 0xf6f0e0
    ch.cbox((0, 0, 0), (9, 13, 5.2), WALL, ch=.25, tcolor=WALL)
    ch.gable((0, 0, 5.2), 9, 13, 3.2, P['teja'], color2=P['tejaD'], rz=math.pi / 2, strips=3, overhang=.5)
    # bell gable on the front
    ch.cbox((0, -6.1, 0), (6.4, 1.6, 8.2), WALL, ch=.3)
    ch.cbox((0, -6.1, 8.2), (2.6, 1.4, 3.0), WALL, ch=.2)
    ch.frustum((0, -6.1, 11.2), 1.8, 0.01, 1.8, 4, P['teja'], rz=math.pi / 4, sy=.8)
    ch.box((-.7, -6.95, 8.6), (1.4, .3, 1.9), 0x4a3a30)              # bell opening
    ch.box((-.9, -6.95, 0), (1.8, .3, 3.2), 0x6e4a2a)                # door
    for sx in (-1, 1):
        ch.box((sx * 2.2 - .5, -6.95, 3.2), (1.0, .3, 1.6), 0x3f7f8a)
    import bmesh
    bmesh.ops.scale(ch.bm, vec=(1.3, 1.3, 1.3), verts=list(ch.bm.verts), space=lib.Matrix.Translation((0, 0, 0)))
    parts += [cd, rc, sh, ch]
    return parts


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
