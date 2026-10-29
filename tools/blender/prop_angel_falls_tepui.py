"""angel_falls_tepui: fluted flat-topped tepuy with overhanging strata, forested talus, plunge pool. 'falls' and 'mist' are separate meshes. Falls face south."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'angel_falls_tepui'
GROUND = 0xa8b65a
GROUND_Z = -1.0
PREVIEW = dict(az=0, pitch=70, fit=1.0)
AO_DIST = 16.0
R, H, N = 14.5, 40.0, 24
FALL_I = 18     # column facing south (-Y)


def rad(i, scale, seed_off=0.0):
    a = 2 * math.pi * i / N
    flute = -0.08 if i % 2 == 0 else 0.03
    lobe = 0.07 * math.sin(3 * a + .4) + 0.04 * math.sin(5 * a + 1.1)
    return R * scale * (1 + flute + lobe)


def ring(scale, z):
    return [(rad(i, scale) * math.cos(2 * math.pi * i / N), rad(i, scale) * math.sin(2 * math.pi * i / N), z) for i in range(N)]


def build(L):
    P = L.P
    rng = random.Random(3)
    t = L.Part('tepuy', ao=0.0)
    # forested talus skirt
    r0, r1 = ring(1.55, -1), ring(1.14, 8)
    t.loft([r0, r1], P['selva'], colors=[P['selvaL'], P['selva'], P['selva2'], P['selva']], ref=lib.Vector((0, 0, 3)))
    # cliff strata: (scale, z) rings, overhang at z=22 and lip at z=34
    prof = [(1.14, 8), (1.02, 14), (1.07, 21), (.99, 29), (1.04, 35), (1.0, H)]
    base = [P['tepuyD'], P['tepuy'], P['tepuyL'], P['tepuy'], P['tepuyD'], P['tepuyL']]
    rings = [ring(s, z) for s, z in prof]
    for k in range(len(rings) - 1):
        cols = [base[(i * 5 + k * 2) % 6] if (i + k) % 3 else base[(i + k) % 6] for i in range(N)]
        cols = [[P['tepuyD'], P['tepuy'], P['tepuyL'], P['tepuy']][(i * 7 // 2) % 4] for i in range(N)]
        t.loft([rings[k], rings[k + 1]], P['tepuy'], colors=cols, ref=lib.Vector((0, 0, 20)))
    t.face(rings[-1], P['selva'], up=True, shade=0.0)
    for (x, y, rr) in ((-6, 3, 3.8), (5, 6, 3.2), (3, -4, 3.6), (-3, -7, 2.6), (9, -2, 2.4), (-9, -3, 2.4)):
        t.ico((x, y, H + .2), rr, P['selva2'], sub=1, sc=(1, 1, .75), jitter=.12, seed=int(x * 3 + y), tcolor=P['selvaL'], cut_below=H)
    for k in range(7):                           # fallen boulders / scree at the foot
        a = rng.uniform(0, 6.28)
        rr = R * rng.uniform(1.5, 1.9)
        t.ico((rr * math.cos(a), rr * math.sin(a), 0), rng.uniform(1.5, 2.6), P['tepuyD'], sub=0, sc=(1, 1, .8), jitter=.2, seed=k, tcolor=P['tepuy'], cut_below=-.2)
    f = L.Part('falls', ao=0.0)
    def south(scale):
        return -rad(FALL_I, scale) - 0.55
    zs = [3.0] + [z for s, z in prof[1:]]
    sc = [1.2] + [s for s, z in prof[1:]]
    ws = [7.0, 5.6, 5.0, 4.5, 4.1, 3.9]
    for s_ in range(len(zs) - 1):
        y0, y1 = south(sc[s_]), south(sc[s_ + 1])
        w0, w1 = ws[s_], ws[s_ + 1]
        z0, z1 = zs[s_], zs[s_ + 1]
        f.face([(-w0, y0, z0), (w0, y0, z0), (w1, y1, z1), (-w1, y1, z1)], P['fall'], shade=1.0, flip_ref=lib.Vector((0, y0 - 5, (z0 + z1) / 2)))
        for sx in (-1, 1):
            f.face([(sx * w0, y0, z0), (sx * w1, y1, z1), (sx * w1, y1 + .7, z1), (sx * w0, y0 + .7, z0)], 0xd6ecf8, shade=1.0, flip_ref=lib.Vector((sx * -5, y0, (z0 + z1) / 2)))
    fy = south(1.2)
    f.disc((0, fy - 3.0, .15), 6.5, P['water'], rings=2, segs=12)    # plunge pool
    m = L.Part('mist', ao=0.0)
    for (x, y, z, sx, sy, sz) in ((0, fy - 1.5, 3.2, 5, 3.2, 2.2), (-5, fy - 1.5, 2.8, 4, 2.6, 1.8), (5, fy - 2, 3.0, 4.2, 2.8, 2.0),
                                  (-2.5, fy - 5, 2.2, 3.4, 2.2, 1.5), (3, fy - 4.6, 2.2, 3.2, 2.0, 1.4)):
        m.ico((x, y, z), 1.0, P['mist'], sub=0, sc=(sx, sy, sz), jitter=.1, seed=int(x + 7))
    return [t, f, m]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
