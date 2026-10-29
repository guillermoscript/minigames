"""caracas_hillside: terraced barrio climbing the Ávila slope. Origin = foot of the slope (south edge, centre); slope rises toward -Z... i.e. north."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'caracas_hillside'
GROUND = 0x7d9f50
PREVIEW = dict(az=0, pitch=70, fit=0.95)
AO_DIST = 10.0
W, D, RISE = 96.0, 34.0, 11.0


def zg(y):
    t = max(0.0, min(1.0, y / D))
    return RISE * (t * t * 0.6 + t * 0.4)


def build(L):
    P = L.P
    rng = random.Random(9)
    out = []
    # --- slope: green hillside with dirt paths ---
    sl = L.Part('slope', ao=0.0)
    nx, ny = 16, 6
    for i in range(nx):
        for j in range(ny):
            x0, x1 = -W / 2 + W * i / nx, -W / 2 + W * (i + 1) / nx
            y0, y1 = D * j / ny, D * (j + 1) / ny
            col = P['ccs'] if (i + j) % 3 else P['ccsD']
            if j in (1, 3) or i in (4, 8, 12):
                col = 0xb9a67e
            sl.face([(x0, y0, zg(y0)), (x1, y0, zg(y0)), (x1, y1, zg(y1)), (x0, y1, zg(y1))], col, up=True)
    out.append(sl)

    hs = L.Part('houses', ao=0.0)
    n = 0
    for r in range(4):
        y = 4 + r * 7.8
        x = -W / 2 + 4 + rng.random() * 2
        while x < W / 2 - 5:
            w = rng.uniform(5.6, 7.4)
            d = rng.uniform(4.4, 5.4)
            hh = rng.uniform(2.6, 4.2)
            z = zg(y)
            if int(x) % 24 in range(10, 14) and r % 2 == 0:    # stair gaps
                x += 3
                continue
            col = L.CASAS[rng.randrange(len(L.CASAS))] if rng.random() < .8 else [0xd9695a, 0x5fa1c4, 0xe8c24a][rng.randrange(3)]
            hs.box((x, y, z - 1.4), (w, d, hh + 1.4), col, bottom=False, top=False)
            if rng.random() < .5:
                hs.gable((x, y, z + hh), w, d, 1.8 + rng.random() * .8, P['teja'] if rng.random() < .7 else P['tejaD'], P['tejaL'], strips=1, overhang=.35, rz=0.0 if rng.random() < .6 else math.pi / 2)
            else:    # flat concrete roof with parapet
                hs.box((x, y, z + hh), (w + .2, d + .2, .4), 0xb4b8c0, bottom=False)
                if rng.random() < .5:
                    hs.box((x + .8, y, z + hh + .5), (1.4, 1.4, 1.0), 0x3f6aa0, bottom=False)       # water tank
            n += 1
            x += w + rng.uniform(1.0, 2.0)
    out.append(hs)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
