"""roraima_tepui: long rectangular table mountain (~60x32 plateau, 55 tall), fluted cliffs with 4 buttresses, notched rim, waterfall 'cascada' (south face), mist, forested skirt. Falls face -Y."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'roraima_tepui'
GROUND = 0x6f9a4c
GROUND_Z = -1.0
PREVIEW = dict(az=0, pitch=70, fit=1.0)
AO_DIST = 22.0
N = 32
WX, DY, H = 28.0, 13.5, 55.0
BUTT = [0.30 * math.pi, 0.72 * math.pi, 1.30 * math.pi, 1.72 * math.pi]
FALL = (24, 25)
NOTCH = {3, 4, 9, 15, 16, 21, 24, 25, 29}


def spow(v, p):
    return math.copysign(abs(v) ** p, v)


def ring(s, z, b, notch=False):
    pts = []
    for i in range(N):
        t = 2 * math.pi * i / N
        x = WX * spow(math.cos(t), 0.42)
        y = DY * spow(math.sin(t), 0.42)
        f = 1 + (-.06 if i % 2 == 0 else .035)
        for tb in BUTT:
            d = math.atan2(math.sin(t - tb), math.cos(t - tb))
            f += b * math.exp(-(d / 0.20) ** 2)
        if i in FALL:
            f -= 0.05
        zz = z
        if notch and i in NOTCH:
            zz = z - (4.5 if i in FALL else 2.8)
        pts.append((x * s * f, y * s * f, zz))
    return pts


def build(L):
    P = L.P
    V = lib.Vector
    rng = random.Random(2)
    t = L.Part('tepuy', ao=0.0)
    sk0, sk1 = ring(1.55, -1.0, 0.15), ring(1.2, 9, 0.32)
    t.loft([sk0, sk1], P['selva'], colors=[P['selvaL'], P['selva'], P['selva2'], P['selva']], ref=V((0, 0, 3)))
    prof = [(1.2, 9, .32), (1.0, 19, .25), (1.08, 30, .16), (0.98, 41, .07), (1.03, 49, .02), (1.0, H, 0.0)]
    cc = [P['tepuyD'], P['tepuy'], P['tepuyL'], P['tepuy'], P['tepuyD'], P['tepuyL']]
    rings = [ring(s, z, b, notch=(k == len(prof) - 1)) for k, (s, z, b) in enumerate(prof)]
    for k in range(len(rings) - 1):
        cols = []
        for i in range(N):
            c = [P['tepuyD'], P['tepuy'], P['tepuyL'], P['tepuy']][(i // 1) % 4]
            if k in (1, 3):
                c = [P['tepuy'], P['tepuyL'], P['tepuy'], P['tepuyD']][(i + 1) % 4]
            if k == 4:
                c = P['rocaD'] if i % 2 else P['tepuyD']
            cols.append(c)
        t.loft([rings[k], rings[k + 1]], P['tepuy'], colors=cols, ref=V((0, 0, 25)))
    top = rings[-1]
    inner = [(x * .93, y * .93, H) for (x, y, z) in top]
    t.loft([top, inner], 0x7a6c56, colors=[0x7a6c56, 0x8a7a62], ref=V((0, 0, 20)))
    for i in range(N):
        t.face([inner[i], inner[(i + 1) % N], (0, 0, H)], 0x8a7a62, up=True)
    # plateau rocks / bushes
    for (x, y, rr, s) in ((-18, 2, 3.0, 1), (-6, -3, 2.2, 2), (8, 4, 3.4, 3), (19, -2, 2.6, 4), (0, 6, 2.0, 5), (-10, 7, 2.2, 6)):
        t.ico((x, y, H + .1), rr, P['rocaD'] if s % 2 else 0x4f7a3e, sub=0, sc=(1.4, 1.1, .9), jitter=.18, seed=s, tcolor=0x6f9a4c if s % 2 == 0 else P['rocaL'], cut_below=H - .2)
    for k in range(8):
        a = rng.uniform(0, 6.28)
        t.ico((WX * 1.6 * math.cos(a) * .95, DY * 1.9 * math.sin(a), 0), rng.uniform(1.6, 2.6), P['tepuyD'], sub=0, sc=(1, 1, .8), jitter=.2, seed=k, tcolor=P['tepuy'], cut_below=-.2)
    # cloud-forest trees on the skirt
    tr = L.Part('bosque_nuboso', ao=0.0)
    for k in range(14):
        a = 2 * math.pi * k / 14 + rng.uniform(-.15, .15)
        rx, ry = WX * 1.42 + rng.uniform(-2, 3), DY * 1.58 + rng.uniform(-1, 3)
        x, y = rx * math.cos(a), ry * math.sin(a)
        tr.ico((x, y, 0.8), rng.uniform(2.6, 3.8), P['selva2'] if k % 2 else P['selva'], sub=0, sc=(1, 1, 1.1), jitter=.15, seed=k + 20, tcolor=P['selvaL'], cut_below=.4)
    # falls
    f = L.Part('cascada', ao=0.0)
    a_i, b_i = FALL
    lv = [(1.2, 9, .32, False), (1.0, 19, .25, False), (1.08, 30, .16, False), (0.98, 41, .07, False), (1.03, 49, .02, False), (1.0, H, 0.0, True)]
    for k in range(len(lv) - 1):
        r0 = ring(*lv[k][:3], notch=lv[k][3])
        r1 = ring(*lv[k + 1][:3], notch=lv[k + 1][3])
        cxm = (r0[a_i][0] + r0[b_i][0]) / 2
        q = lambda p, d: (cxm + (p[0] - cxm) * .45, p[1] - d, p[2])
        f.face([q(r0[a_i], .9), q(r0[b_i], .9), q(r1[b_i], .9), q(r1[a_i], .9)], P['fall'], shade=1.0, flip_ref=V((0, -40, 25)))
    r_b = ring(1.2, 9, .32)
    fx, fy = (r_b[a_i][0] + r_b[b_i][0]) / 2, r_b[a_i][1] - 1.0
    f.face([(fx - 1.8, fy + .2, 9.4), (fx + 1.8, fy + .2, 9.4), (fx + 2.6, fy - 1.8, 2.6), (fx - 2.6, fy - 1.8, 2.6)], 0xd6ecf8, shade=1.0, flip_ref=V((fx, fy - 20, 6)))
    f.disc((fx, fy - 5.5, .15), 6.5, P['water'], rings=2, segs=12)
    m = L.Part('mist', ao=0.0)
    for (x, y, z, sx, sy, sz) in ((fx, fy - 2.6, 3.0, 5.0, 3.0, 2.2), (fx - 5, fy - 3, 2.5, 4, 2.4, 1.8), (fx + 5, fy - 3.5, 2.8, 4, 2.4, 2.0),
                                  (-22, -17, 36, 7, 3.2, 2.2), (-12, -16, 39, 6, 3, 2.0), (22, -15, 44, 7, 3.2, 2.0), (30, -4, 34, 5, 3, 2.2)):
        m.ico((x, y, z), 1.0, P['mist'], sub=0, sc=(sx, sy, sz), jitter=.1, seed=int(x + 9))
    return [t, tr, f, m]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
