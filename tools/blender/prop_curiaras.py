"""curiaras: dugout canoes for the Orinoco delta. Four separate parts spaced 16 apart on X:
curiara_a (empty), curiara_b (paddler with conical hat), curiara_c (fisherman casting a net), penero_motor (long boat, outboard).
Waterline z=0, origin = boat centre, bow points +X before the part rotation."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'curiaras'
GROUND = 0x3f7f5a
PREVIEW = dict(az=0, fit=float(os.environ.get('FIT', '0.62')), pitch=float(os.environ.get('PITCH','70')))
AO_DIST = 5.0

IN = 0xc79a62        # pale inner wood
SKIN = 0xc98a5a
HATC = 0xd6b85c


def sect(x, Lh, W, H, depth, sh, k=4, inner=1.0, rise=0.0):
    """Cross-section (open ring) at x: from port gunwale round the keel to starboard gunwale."""
    t = x / Lh
    s = max(0.05, (1 - t * t)) ** 0.55 * inner
    top = H + rise * abs(t) ** 2.2
    pts = []
    for i in range(k + 1):
        th = math.pi + math.pi * i / k
        pts.append((x, (W / 2) * s * math.cos(th) * (1 if inner == 1 else 1), top + depth * s ** 0.6 * math.sin(th) * sh))
    return pts


def hull(p, Lh, W, H, depth, col, colIn, rise=0.5, n=6, rim=None):
    xs = [-Lh + 2 * Lh * i / (n - 1) for i in range(n)]
    outer = [sect(x, Lh, W, H, depth, 1.0, rise=rise) for x in xs]
    for a, b in zip(outer, outer[1:]):
        for i in range(len(a) - 1):
            cx = (a[i][0] + b[i][0]) / 2
            p.face([a[i], a[i + 1], b[i + 1], b[i]], col, flip_ref=lib.Vector((cx, 0, H)))
    inner = [sect(x, Lh, W * .8, H - .02, depth * .62, 1.0, rise=rise * .9) for x in xs]
    for a, b in zip(inner, inner[1:]):
        for i in range(len(a) - 1):
            cx = (a[i][0] + b[i][0]) / 2
            f = p.face([a[i], a[i + 1], b[i + 1], b[i]], colIn, flip_ref=lib.Vector((cx, 0, H)))
            if f is not None:
                f.normal_flip()
    # gunwale rim between outer and inner top edges
    for a, o in ((outer, inner),):
        for k, (oa, ob, ia, ib) in enumerate(zip(a, a[1:], o, o[1:])):
            for e in (0, -1):
                p.face([oa[e], ob[e], ib[e], ia[e]], rim or col, up=True)
    # pointed end caps (bow / stern)
    for e in (0, -1):
        o = outer[e if e == 0 else -1]
        i_ = inner[e if e == 0 else -1]
        p.face([o[0], o[-1], i_[-1], i_[0]], rim or col, up=True)


def person(p, x, z0, hat=True, pose='paddle'):
    # seated torso (shirt), head, optional conical hat
    p.cbox((x, 0, z0), (.9, .9, 1.3), 0xe8e2d0 if pose == 'paddle' else 0x3f7f8a, ch=.2)
    p.ico((x, 0, z0 + 1.65), .5, SKIN, sub=1)
    if hat:
        p.frustum((x, 0, z0 + 1.95), 1.05, 0.0, .8, 8, HATC, bottom=False)
        p.frustum((x, 0, z0 + 1.95), 1.05, .8, .12, 8, 0xa88a3e, bottom=False, top=False)


def paddle(p, x, y, z0):
    p.beam((x, y, z0 + 1.3), (x + .7, y * 1.9 + (.2 if y > 0 else -.2), z0 - .5), .1, lib.P['woodD'], sides=3)
    p.cbox((x + .75, y * 2.0, z0 - 1.0), (.7, .12, 1.0), lib.P['wood'], ch=.05, rz=0)


def build(L):
    P = L.P
    out = []
    # a: empty
    a = L.Part('curiara_a', loc=(-24, 0, 0), rot=.12, ao=0.0)
    hull(a, 6.0, 3.0, 1.1, 1.0, P['woodD'], IN, rise=.6)
    a.beam((-1.2, -1.0, .75), (-1.2, 1.0, .75), .08, P['wood'], sides=3)
    a.beam((1.4, -1.0, .75), (1.4, 1.0, .75), .08, P['wood'], sides=3)
    a.beam((-3, 0, .1), (1.5, .3, .25), .12, P['hay'], sides=3)     # a laid pole
    a.cbox((2.4, 0, .1), (.8, .6, .5), 0xcfb27a, ch=.1)              # a bundle
    out.append(a)
    # b: paddler
    b = L.Part('curiara_b', loc=(-8, 0, 0), rot=-.1, ao=0.0)
    hull(b, 6.0, 3.0, 1.1, 1.0, 0x6e4a2a, IN, rise=.6)
    person(b, 0.6, .15)
    paddle(b, 0.6, 0.9, .55)
    paddle(b, -0.3, -0.9, .55)
    out.append(b)
    # c: fisherman + net
    c = L.Part('curiara_c', loc=(8, 0, 0), rot=.2, ao=0.0)
    hull(c, 6.0, 3.0, 1.1, 1.0, P['woodD'], IN, rise=.6)
    c.cbox((-.4, 0, .15), (.9, .8, 2.1), 0x8fa9bf, ch=.2)           # standing fisherman (torso+legs)
    c.ico((-.4, 0, 2.7), .5, SKIN, sub=1)
    c.frustum((-.4, 0, 2.95), .95, 0, .7, 8, HATC, bottom=False)
    c.beam((-.4, 0, 2.0), (.9, -.9, 2.5), .13, SKIN, sides=3)      # arm throwing
    c.frustum((1.8, -2.6, 1.6), .15, 2.8, -.9, 10, 0xf0e8d0, bottom=False, top=False)  # flung net (cone opening down)
    for k in range(5):
        ang = 2 * math.pi * k / 5
        c.ico((1.8 + 2.7 * math.cos(ang), -2.6 + 2.7 * math.sin(ang), .7), .22, lib.P['red'], sub=0)   # floats
    c.cbox((2.4, .4, .1), (1.2, 1.0, .7), 0xcfb27a, ch=.12)         # catch basket
    out.append(c)
    # d: peñero
    d = L.Part('penero_motor', loc=(24, 0, 0), rot=-.05, ao=0.0)
    hull(d, 7.5, 3.6, 1.3, 1.1, P['shutter'], 0xe8e2d0, rise=.7, n=7, rim=P['white'])
    for xb in (-2.0, 3.0):
        d.cbox((xb, 0, .45), (.9, 2.3, .22), P['wood'], ch=.05)
    # stern outboard: cowl, shaft, prop
    d.cbox((-7.2, 0, 1.0), (1.3, .9, 1.2), P['red'], ch=.25)
    d.beam((-7.3, 0, 1.0), (-7.6, 0, -.8), .22, P['steelL'], sides=4)
    d.cbox((-7.75, 0, -.9), (.9, .5, .55), P['steel'], ch=.1)
    person(d, -5.2, .3, hat=False)
    person(d, 1.8, .3, hat=True)
    out.append(d)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
