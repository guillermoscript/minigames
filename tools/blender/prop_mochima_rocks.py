"""mochima_rocks: 3 sizes x 3 variants = 9 rock islets (rock_{s,m,l}_{1,2,3}) on a grid; each object origin = its own base centre at the waterline.
1 = rounded stack with jungle crown, 2 = fluted spire, 3 = twin spires on a mound. Foam ring at the base."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'mochima_rocks'
GROUND = 0x2f78d0
PREVIEW = dict(az=0, pitch=70, fit=1.0)
AO_DIST = 12.0
SIZES = {'s': (6.5, 12.0), 'm': (9.0, 18.0), 'l': (12.0, 25.0)}


def foam(p, r):
    n = 12
    p.disc((0, 0, .45), r * 1.25, p.P['foam'], rings=2, segs=n, colorfn=lambda x, y: p.P['foam'] if math.hypot(x, y) > r * .9 else 0xcfe6f6)


def spire(p, rng, x0, y0, r, h, n=7, tuft=True):
    P = p.P
    levels = [(0, 1.0), (.35, .86), (.7, .74), (1.0, .55)]
    rings = []
    for k, (zf, rf) in enumerate(levels):
        rings.append([(x0 + r * rf * (1 + rng.uniform(-.14, .14)) * math.cos(2 * math.pi * i / n + k * .3),
                       y0 + r * rf * (1 + rng.uniform(-.14, .14)) * math.sin(2 * math.pi * i / n + k * .3), h * zf) for i in range(n)])
    cols = [P['rocaL'], P['roca'], P['rocaD'], P['roca'], P['rocaL'], P['rocaD'], P['roca']]
    p.loft(rings, P['roca'], colors=cols, ref=lib.Vector((x0, y0, h / 2)))
    p.face(rings[-1], P['selva'], up=True)
    if tuft:
        p.ico((x0, y0, h), r * .55, P['selva'], sub=1, sc=(1, 1, .7), jitter=.1, seed=int(h), tcolor=P['selvaL'], cut_below=h - .1)


def build(L):
    P = L.P
    out = []
    gx = {'s': -28, 'm': 0, 'l': 34}
    for si, (k, (r, h)) in enumerate(SIZES.items()):
        for v in (1, 2, 3):
            rng = random.Random(si * 11 + v)
            p = L.Part('rock_%s_%d' % (k, v), loc=(gx[k], (2 - v) * 34, 0), ao=0.0)
            p.P = P
            foam(p, r)
            if v == 1:
                p.ico((0, 0, h * .40), r, P['roca'], sub=2, sc=(1, .92, h / r * .62), jitter=.13, seed=si * 7 + v, cut_below=.4,
                      bands=lambda zc, q: (P['selva'] if q < .5 else P['selvaL']) if zc > .5 else (P['rocaL'] if zc > .0 and q < .4 else (P['roca'] if zc > -.35 else P['rocaD'])))
            elif v == 2:
                spire(p, rng, 0, 0, r * .95, h)
            else:
                p.ico((0, 0, h * .1), r, P['rocaD'], sub=1, sc=(1, .9, .5), cut_below=.2, jitter=.1, seed=v, bands=lambda zc, q: P['roca'] if zc > 0 else P['rocaD'])
                spire(p, rng, -r * .32, 0, r * .6, h)
                spire(p, rng, r * .42, r * .1, r * .5, h * .66, n=6)
            out.append(p)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
