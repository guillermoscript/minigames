"""andes_merida: three snow-capped jagged peaks (Pico Bolivar group), paramo skirt, stone chapel 'capilla', 12 frailejones. Chapel faces -Y."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'andes_merida'
GROUND = 0x8f9a5c
GROUND_Z = -1.0
PREVIEW = dict(az=0, pitch=70, fit=1.0)
AO_DIST = 20.0

ROCK, ROCKD, ROCKL, ROCKW = 0x8c7e6e, 0x6b5f54, 0xa39683, 0x7a6d62
SNOW, SNOWB = 0xf4f6fa, 0xdde6f2
PARAMO, PARAMOD, PARAMOL = 0x9a9c5c, 0x80844c, 0xb0ae6c


def peak(L, name, cx, cy, H, R, N, seed, rot=0.0):
    rng = random.Random(seed)
    p = L.Part(name, loc=(cx, cy, 0), ao=0.0)
    # per-column ridge factor: spikes (arêtes) vs gullies
    ridge = [1.0 + (0.5 if i % 2 == 0 else -0.28) + rng.uniform(-.12, .14) for i in range(N)]
    lean = (rng.uniform(-.25, .25) * R, rng.uniform(-.2, .2) * R)
    prof = [(1.0, 0.0), (0.84, 0.13), (0.66, 0.28), (0.62, 0.42), (0.40, 0.57), (0.34, 0.70), (0.19, 0.82), (0.10, 0.92), (0.0, 1.0)]
    rings = []
    for k, (s, zf) in enumerate(prof):
        ring = []
        for i in range(N):
            a = rot + 2 * math.pi * i / N
            rr = R * s * (1 + (ridge[i] - 1) * min(1.0, 0.4 + k * .15) + rng.uniform(-.1, .1)) if s > 0.001 else 0.0
            ring.append((rr * math.cos(a) + lean[0] * zf * zf, rr * math.sin(a) + lean[1] * zf * zf, H * zf))
        rings.append([(x, y, z - 1.5 if k == 0 else z) for x, y, z in ring])
    for k in range(len(rings) - 1):
        zmid = (prof[k][1] + prof[k + 1][1]) / 2
        cols = []
        for i in range(N):
            ridgy = ridge[i] > 1.12
            snowline = 0.46 if ridgy else 0.36
            snowline += rng.uniform(-.04, .04) + (0.12 if (i % 3 == 0) else 0)   # facing variation
            if zmid > snowline + .08:
                c = SNOW
            elif zmid > snowline - .02:
                c = SNOWB
            elif zmid < 0.12:
                c = PARAMOD if i % 2 else ROCKD
            else:
                c = ROCKL if ridgy else (ROCKD if i % 3 == 1 else ROCK)
            cols.append(c)
        a, b = rings[k], rings[k + 1]
        if prof[k + 1][0] == 0.0:
            for i in range(N):
                j = (i + 1) % N
                p.face([a[i], a[j], b[i]], cols[i], flip_ref=lib.Vector((0, 0, H * .4)))
        else:
            p.loft([a, b], ROCK, colors=cols, ref=lib.Vector((0, 0, H * .4)))
    return p


def build(L):
    P = L.P
    V = lib.Vector
    rng = random.Random(5)
    parts = []
    # paramo skirt
    sk = L.Part('paramo', ao=0.0)
    N = 22
    def sring(sc, z, ph):
        return [(sc * (1 + .08 * math.sin(3 * (2 * math.pi * i / N) + ph)) * math.cos(2 * math.pi * i / N) * 1.25,
                 sc * (1 + .08 * math.sin(3 * (2 * math.pi * i / N) + ph)) * math.sin(2 * math.pi * i / N) * .95, z) for i in range(N)]
    r0, r1 = sring(38, -1.0, 0), sring(31, 2.2, 1.0)
    sk.loft([r0, r1], PARAMO, colors=[PARAMOD, PARAMO, PARAMOL, PARAMO], ref=V((0, 0, 0)))
    sk.face(r1, PARAMOL, up=True)
    for (x, y, rr, s) in ((-27, 10, 4, 1), (30, 12, 4, 2), (8, 21, 4, 3)):   # rocky outcrops
        sk.ico((x, y, 2.0), rr, ROCK, sub=0, sc=(1.2, 1, .8), jitter=.2, seed=s, tcolor=ROCKL, cut_below=1.4)
    parts.append(sk)
    parts.append(peak(L, 'pico_bolivar', -6, 12, 70, 21, 12, 11, .3))
    parts.append(peak(L, 'pico_humboldt', 24, 8, 54, 16, 12, 21, .9))
    parts.append(peak(L, 'pico_bonpland', -33, 2, 44, 14, 11, 31, .1))
    # chapel
    c = L.Part('capilla', loc=(7, -16, 2.2), ao=0.0)
    c.cbox((0, 0, 0), (7.6, 9.6, 5.0), P['stone'], ch=.25, tcolor=0xb5ad9b, colors=None)
    c.gable((0, 0, 5.0), 7.6, 9.6, 3.2, P['red'], color2=P['redD'], rz=math.pi / 2, strips=2, overhang=.5)
    c.box((-1.0, -5.0, 0), (2.0, .3, 3.4), 0x5a3a20)
    c.cbox((0, -4.4, 5.0), (2.2, 2.2, 3.8), 0xd8d0bc, ch=.15)
    c.frustum((0, -4.4, 8.8), 1.7, 0.01, 1.8, 4, P['red'], rz=math.pi / 4)
    c.box((-3.7, 0, 3.0), (.25, 1.0, 1.2), 0x3a4a60)
    parts.append(c)
    # frailejones
    f = L.Part('frailejones', ao=0.0)
    spots = [(-14, -10), (-20, -6), (-9, -16), (19, -11), (24, -6), (22, -19), (-21, -17), (14, -20), (-2, -22), (30, 0), (-29, -5), (-14, -22)]
    for (x, y) in spots:
        z0 = 1.6 + (abs(x) * .01)
        hh = rng.uniform(2.0, 2.8)
        f.frustum((x, y, z0), .7, .5, hh, 4, 0x7a6a4a, rz=math.pi / 4, bottom=False, top=False)
        f.ico((x, y, z0 + hh + .5), 2.1, 0x8fa27a, sub=0, sc=(1, 1, .55), jitter=.12, seed=int(x + y), tcolor=0xd0dcc0)
    parts.append(f)
    return parts


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
