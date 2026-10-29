"""caroni_llovizna: Parque La Llovizna / Caroni falls. Wide stepped white cascade 'cascada' into a green pool, 3 rocky islets, wooden footbridge, lush trees. Falls face -Y (south)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'caroni_llovizna'
GROUND = 0x72a252
GROUND_Z = -0.5
PREVIEW = dict(az=0, pitch=70, fit=1.0)
AO_DIST = 14.0
ROCK, ROCKD, ROCKL = 0x8a7766, 0x6b5a4c, 0xa89580
POOL = 0x3f9a86
POOLD = 0x2f8472


def build(L):
    P = L.P
    V = lib.Vector
    rng = random.Random(6)
    # rock tiers behind the falls
    r = L.Part('roca_cascada', ao=0.0)
    tiers = [(14.0, 5.0, 58, 5.5), (19.0, 5.0, 56, 10.0), (24.5, 6.0, 54, 14.5)]
    for (y, d, w, h) in tiers:
        r.cbox((0, y, 0), (w, d, h), ROCK, ch=.6, tcolor=ROCKL, colors=None)
    r.cbox((0, 33, 0), (62, 14, 14.5), P['selva'], ch=1.0, tcolor=P['selvaL'])
    # rock pillars between curtains (on each tier front)
    for (y, h) in ((14.0 - 2.6, 5.5), (19.0 - 2.6, 10.0), (24.5 - 3.1, 14.5)):
        for x in (-18, -5, 9, 21):
            r.cbox((x + rng.uniform(-1.5, 1.5), y + .4, 0), (rng.uniform(4.5, 6.5), 3.2, h + 1.2), ROCKD, ch=.5, tcolor=ROCKL)
    # waterfall curtains
    f = L.Part('cascada', ao=0.0)
    segs = [(-27, -20.5), (-15.5, -8.5), (-1.5, 5.5), (13, 18), (24, 28)]
    for (y, d, w, h) in tiers:
        yf = y - d / 2 - .25
        for (a, b) in segs:
            wa, wb = a * w / 58, b * w / 58
            f.face([(wa, yf, h), (wb, yf, h), (wb + .5, yf - .5, 0.4), (wa - .5, yf - .5, 0.4)], P['fall'], shade=1.0, flip_ref=V(((wa + wb) / 2, yf - 20, h / 2)))
            f.face([(wa, yf, h), (wa - .5, yf - .5, 0.4), (wa - .5, yf, 0.4)], 0xd6ecf8, shade=1.0, flip_ref=V((wa - 5, yf - 3, h / 2)))
            f.face([(wa, y - d / 2 - .25, h + .05), (wb, y - d / 2 - .25, h + .05), (wb, y + d / 2 - .4, h + .05), (wa, y + d / 2 - .4, h + .05)], P['fall'], shade=1.0, up=True)
            # foam at the foot
            f.ico(((wa + wb) / 2, yf - 1.0, .8), 1.5 + (wb - wa) * .12, P['white'], sub=0, sc=(1.6, 1, .6), jitter=.1, seed=int(wa + y), cut_below=.1)
    # pool
    po = L.Part('estanque', ao=0.0)
    M = 18
    def prr(a, k):
        return (23 + 3 * math.sin(3 * a + 1) + 2 * math.sin(5 * a)) * k, (14 + 2 * math.sin(2 * a + .5)) * k
    cy = 3.0
    ring_o = [(prr(2 * math.pi * i / M, 1)[0], cy + prr(2 * math.pi * i / M, 1)[1] * math.sin(2 * math.pi * i / M) / 1.0 * 1.0, .15) for i in range(M)]
    ring_o = [(prr(2 * math.pi * i / M, 1)[0] * math.cos(2 * math.pi * i / M), cy - 3 + prr(2 * math.pi * i / M, 1)[1] * math.sin(2 * math.pi * i / M), .15) for i in range(M)]
    cen = (0, cy - 3, .15)
    ring_i = [(x * .55, cen[1] + (y - cen[1]) * .55, .15) for (x, y, z) in ring_o]
    for i in range(M):
        j = (i + 1) % M
        po.face([ring_i[i], ring_i[j], cen], POOLD, up=True)
        po.face([ring_o[i], ring_o[j], ring_i[j], ring_i[i]], POOL if i % 4 else 0x4aa890, up=True)
    # grassy bank
    ob = [(x * 1.16, cy - 3 + (y - (cy - 3)) * 1.2, 0.5) for (x, y, z) in ring_o]
    ib = [(x, y, .15) for (x, y, z) in ring_o]
    po.loft([ib, ob], 0x6aa050, closed=True, colors=[0x4f7a3e, 0xa88f5a, 0x6aa050], ref=V((0, cy - 3, -5)))
    # islets
    isl = L.Part('islotes', ao=0.0)
    isl_pos = [(-9, -6, 4.5), (8, -12, 3.8), (13, -1, 3.2)]
    for k, (x, y, s) in enumerate(isl_pos):
        isl.ico((x, y, 0), s, ROCK, sub=1, sc=(1.2, 1.0, .8), jitter=.18, seed=k + 3, tcolor=ROCKL, cut_below=.0)
        isl.ico((x + .4, y, s * .5), s * .72, P['selva'], sub=0, sc=(1, 1, .5), jitter=.12, seed=k + 9, tcolor=P['selvaL'], cut_below=s * .35)
        isl.frustum((x + .3, y, s * .6), .5, .4, 2.6, 4, 0x6e4a2a, bottom=False, top=False)
        isl.ico((x + .3, y, s * .6 + 3.4), 2.0, P['selva2'], sub=0, jitter=.15, seed=k, tcolor=P['selvaL'])
    # footbridge: bank (-27,-9) -> islet (-9,-6)
    br = L.Part('puente_madera', ao=0.0)
    pts = []
    n = 6
    for i in range(n + 1):
        u = i / n
        pts.append((-26 + 15 * u, -10 + 3.5 * u, 1.0 + 1.3 * math.sin(math.pi * u)))
    for i in range(n):
        a, b = pts[i], pts[i + 1]
        br.beam(a, b, 0.95, P['wood'], sides=4)
        for sy in (-1, 1):
            br.beam((a[0], a[1] + sy * 1.1, a[2] + 1.5), (b[0], b[1] + sy * 1.1, b[2] + 1.5), .2, P['woodD'], sides=3)
    for p in pts[::2]:
        for sy in (-1, 1):
            br.frustum((p[0], p[1] + sy * 1.1, 0), .3, .26, p[2] + 1.55, 4, P['woodD'], bottom=False, top=False)
    # trees
    tr = L.Part('arboles', ao=0.0)
    spots = [(-34, 10, 1.2), (-38, -8, 1.1), (-30, -20, 1.0), (32, 8, 1.2), (36, -6, 1.1), (30, -22, 1.0), (-14, -24, 1.0), (18, -24, 1.0), (-26, 26, 1.3), (28, 30, 1.3), (-8, 40, 1.4)]
    for (x, y, s) in spots:
        z0 = 14.5 if y > 26 and abs(x) < 29 else 0.0
        hh = 5.2 * s
        tr.frustum((x, y, z0), .75 * s, .5 * s, hh, 5, 0x6e4a2a, bottom=False, top=False)
        tr.ico((x, y, z0 + hh + 1.6 * s), 3.3 * s, P['selva2'] if int(x + y) % 2 else P['selva'], sub=0, sc=(1.1, 1.1, 1.0), jitter=.15, seed=int(x * 3 + y), tcolor=P['selvaL'])
        if int(x) % 3 != 0:
            tr.ico((x + 1.3 * s, y + .8, z0 + hh + 3.2 * s), 2.2 * s, P['selvaL'], sub=0, sc=(1, 1, .9), jitter=.15, seed=int(x + y * 3), tcolor=0x5fae50)
    return [r, f, po, isl, br, tr]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
