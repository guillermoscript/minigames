"""autana_tepui: Autana tepui (Amazonas) - a very tall, slender, sheer-sided cylinder (~55 high, r~9) with streaked sandstone cliffs,
dark green summit forest, forested talus skirt and a separate thin 'mist' ring (white blobs). Parts: tepuy, mist."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'autana_tepui'
GROUND = 0x2c6f32
PREVIEW = dict(az=0, pitch=float(os.environ.get('PITCH', '70')), fit=float(os.environ.get('FIT', '0.95')))
AO_DIST = 18.0
R, H, N = 9.0, 55.0, 16


def rad(i, k):
    a = 2 * math.pi * i / N
    flute = (-0.07 if i % 2 == 0 else 0.04)
    return R * k * (1 + flute + 0.05 * math.sin(3 * a + .6))


def ring(k, z, tw=0.0):
    return [(rad(i, k) * math.cos(2 * math.pi * i / N + tw), rad(i, k) * math.sin(2 * math.pi * i / N + tw), z) for i in range(N)]


def build(L):
    P = L.P
    rng = random.Random(7)
    t = L.Part('tepuy', ao=0.0)
    # forest skirt, flaring wide at the foot
    t.loft([ring(2.1, -1), ring(1.6, 3), ring(1.22, 11)], P['selva'],
           colors=[P['selvaL'], P['selva'], P['selva2'], P['selva']], ref=lib.Vector((0, 0, 4)))
    # sheer cliff: slight waist, overhanging lip at the top; vertical streaks (dark water stains) in alternating columns
    prof = [(1.22, 11), (1.0, 18), (.94, 28), (.97, 38), (.92, 47), (1.06, 53), (1.1, H)]
    streak = [P['tepuy'], P['tepuyL'], P['tepuyD'], P['tepuyL'], P['tepuy'], 0xe0a070, P['tepuyD'], P['tepuyL']]
    rings = [ring(k, z) for k, z in prof]
    for s in range(len(rings) - 1):
        cols = [streak[(i * 3) % len(streak)] if i % 4 else P['tepuyD'] for i in range(N)]
        if s % 2:
            cols = [c if i % 5 else P['tepuyD'] for i, c in enumerate(cols)]
        if s >= 4:
            cols = [streak[(i * 3) % len(streak)] if i % 4 else 0xdca06c for i in range(N)]
        t.loft([rings[s], rings[s + 1]], P['tepuy'], colors=cols, ref=lib.Vector((0, 0, 28)))
    t.face(rings[-1], P['selva2'], up=True)
    # dark green summit: low scrub domes
    for (x, y, rr) in ((-3.4, 2.2, 3.0), (3.4, 3.0, 2.6), (1.4, -3.6, 3.0), (-3.4, -3.0, 2.2), (4.4, -2.4, 1.9), (0, 0.4, 2.6)):
        t.ico((x, y, H + .3), rr, P['selva2'], sub=0, sc=(1, 1, .7), jitter=.14, seed=int(x * 5 + y), tcolor=0x2f6f34, cut_below=H - .2)
    # scree boulders at the foot
    for k in range(5):
        a = rng.uniform(0, 6.28)
        rr = R * rng.uniform(1.75, 2.1)
        t.ico((rr * math.cos(a), rr * math.sin(a), 0), rng.uniform(1.4, 2.2), P['tepuyD'], sub=0, sc=(1, 1, .8), jitter=.2, seed=k, tcolor=P['tepuy'], cut_below=-.2)
    m = L.Part('mist', ao=0.0)
    for k in range(10):                    # thin ring of mist blobs around the waist
        a = 2 * math.pi * k / 10 + .2
        rr = R * 1.28 + (k % 3) * .5
        m.ico((rr * math.cos(a), rr * math.sin(a), 14 + (k % 2) * 2.5), 1.0, P['mist'], sub=0, sc=(3.0, 2.2, .9), jitter=.1, seed=k)
    for k in range(4):                     # wisps clinging near the summit
        a = 2 * math.pi * k / 4 + .5
        rr = R * 1.15
        m.ico((rr * math.cos(a), rr * math.sin(a), 48), 1.0, P['mist'], sub=0, sc=(2.8, 2.0, .8), jitter=.1, seed=k + 20)
    return [t, m]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
