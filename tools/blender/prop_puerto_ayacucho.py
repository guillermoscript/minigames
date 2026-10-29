"""puerto_ayacucho: riverfront town on the Orinoco. Parts: tierra (bank), rio (water), churuata (big round Piaroa thatched house),
casa_1..5 (small houses with tin roofs), iglesia (church with bell tower), muelle (pier), raudales (Atures rapids, ~30 wide).
River in front (south, -Y), town on the bank (north). Origin = town centre at the waterline, water z=0.1, bank z=0.6."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'puerto_ayacucho'
GROUND = 0x56b4e8
PREVIEW = dict(az=0, pitch=float(os.environ.get('PITCH', '70')), fit=float(os.environ.get('FIT', '0.95')))
AO_DIST = 10.0

BANK = 0.6
THATCH = 0xc9a85a
THATCHD = 0xa08440
THATCHL = 0xdcc27a
TIN = 0xb9bfc9
TIND = 0x8a93a3
RIVER = 0x56a8d8
RIVERL = 0x6cbce8


def build(L):
    P = L.P
    out = []
    # ---- bank (north) with a sandy shore, irregular edge ----
    g = L.Part('tierra', ao=0.0)

    def bank(x, y):
        edge = -7 + 1.8 * math.sin(x * .22) + 1.1 * math.sin(x * .53 + 1)
        if y < edge - 2.2:
            return None
        if y < edge:
            return P['arena']
        return P['llanoD'] if ((int(x * 7) * 13 + int(y * 5) * 7) % 9) == 0 else P['llano']
    g.grid((0, 10, BANK), (84, 40), 14, 7, P['llano'], colorfn=bank)
    out.append(g)
    # ---- river (south) ----
    r = L.Part('rio', ao=0.0)

    def wcol(x, y):
        return RIVERL if ((int(x * 5) * 11 + int(y * 3) * 17) % 7) == 0 else RIVER
    r.grid((0, -18, .12), (84, 40), 14, 7, RIVER, colorfn=wcol)
    out.append(r)

    # ---- churuata: Piaroa communal house, round with a tall thatched cone ----
    c = L.Part('churuata', loc=(-26, 18, BANK), ao=0.0)
    n = 10
    c.frustum((0, 0, 0), 7.0, 6.7, 2.6, n, 0xc79a62, bottom=False, top=False, ring_colors=[0xc79a62, 0xb8894e])
    c.box((0, -6.8, 0), (2.6, .3, 2.0), 0x3a2c22, rz=0.0, bottom=False, top=False)          # doorway
    rings = []
    for (rf, z, tw) in ((1.5, 2.2, 0), (1.12, 4.4, .12), (.7, 7.4, .24), (.3, 10.2, .36), (0.05, 12.6, .4)):
        rr = 7.0 * rf
        rings.append([(rr * math.cos(2 * math.pi * i / n + tw + (.08 if i % 2 else 0)), rr * math.sin(2 * math.pi * i / n + tw), z) for i in range(n)])
    cols = [THATCH, THATCHD, THATCHL, THATCH, THATCHD]
    c.loft(rings, THATCH, colors=cols, ref=lib.Vector((0, 0, 4)))
    c.beam((0, 0, 12.4), (0, 0, 14.6), .18, P['wood'], sides=3)                            # finial pole
    c.ico((0, 0, 14.7), .5, P['red'], sub=0)
    out.append(c)

    # ---- small riverfront houses with tin roofs ----
    spots = [(-8, 6, .0), (4, 4.5, .0), (15, 7, .1), (-1, 15, 0.0), (11, 17, -.05)]
    cols = [0xeadfc8, 0xe3a98c, 0x8fa9bf, 0xd8b45a, 0xa9bc95]
    for i, (x, y, rz) in enumerate(spots):
        h = L.Part('casa_%d' % (i + 1), loc=(x, y, BANK), rot=rz, ao=0.0)
        w, d = 7.4 + (i % 2) * .8, 6.0
        h.box((0, 0, 0), (w, d, 3.2), cols[i], bottom=False, top=False)
        h.box((0, -d / 2 - .02, 0), (1.3, .25, 2.0), P['door'], bottom=False, top=False)
        h.box((w / 4 + .6, -d / 2 - .02, 1.1), (1.3, .25, 1.0), P['glass'], bottom=False, top=False)
        h.gable((0, 0, 3.2), w, d, 2.4, TIN, TIND, strips=2, overhang=.6)
        out.append(h)

    # ---- church with bell tower (north-east) ----
    ig = L.Part('iglesia', loc=(30, 20, BANK), ao=0.0)
    ig.cbox((0, 0, 0), (8, 12, 4.4), 0xf6f0e0, ch=.1, tcolor=0xf6f0e0)
    ig.gable((0, 0, 4.4), 12, 8, 3.2, P['teja'], P['tejaL'], rz=math.pi / 2, strips=2, overhang=.5)
    ig.cbox((0, -4.6, 0), (4, 4, 11.0), 0xf6f0e0, ch=.25)
    ig.box((0, -6.62, 6.4), (1.6, .25, 2.4), 0x3a2c22, bottom=False, top=False)         # belfry opening
    ig.box((0, -3.2, 5.0), (3.2, .2, .9), 0x3a2c22, bottom=False, top=False) if False else None
    ig.frustum((0, -4.6, 11.0), 3.0, 0, 3.4, 4, P['teja'], rz=math.pi / 4)               # spire roof
    ig.box((0, -4.6, 14.4), (.25, .25, 1.6), P['wood'], bottom=False)
    ig.box((0, -4.6, 15.3), (1.0, .25, .25), P['wood'], bottom=False)
    ig.box((0, -6.62, .0), (1.6, .3, 2.6), P['door'], bottom=False, top=False)            # church door
    out.append(ig)

    # ---- pier into the river ----
    m = L.Part('muelle', loc=(-12, -2, 0), ao=0.0)
    m.box((0, -5, BANK + .1), (2.6, 12, .4), 0xb99464, bottom=False, tcolor=0xd0ac76)
    m.box((0, -12, BANK + .1), (6.5, 2.6, .4), 0xb99464, bottom=False, tcolor=0xd0ac76)
    for yy in (-1, -6, -10.8, -13.2):
        for sx in ((-1.1, 1.1) if yy > -9 else (-2.9, 2.9)):
            m.beam((sx, yy, -.8), (sx, yy, BANK + .4), .18, P['woodD'], sides=3)
    out.append(m)

    # ---- Atures rapids: rocky band across the river with white water ----
    rp = L.Part('raudales', loc=(10, -14, 0), ao=0.0)
    rng = random.Random(11)
    for k in range(12):
        x = -14.5 + k * 2.65 + rng.uniform(-.6, .6)
        y = rng.uniform(-3.0, 3.0)
        s = rng.uniform(2.0, 3.4)
        rp.ico((x, y, .1), s, P['rocaD'] if k % 2 else P['roca'], sub=0, sc=(1.25, 1.0, .95), jitter=.2, seed=k + 3, tcolor=P['rocaL'], cut_below=.1)
    for k in range(9):     # jagged white-water tongues streaming downstream (south) from the rocks
        x = -13 + k * 3.3 + rng.uniform(-.5, .5)
        y = rng.uniform(-1.5, 1.0)
        L_ = rng.uniform(4.5, 6.5)
        rp.face([(x - 2.4, y - 1.0, .4), (x - 1.0, y - L_ * .5, .4), (x, y - L_, .4), (x + 1.2, y - L_ * .55, .4), (x + 2.6, y - .9, .4)], P['foam'] if k % 2 else 0xdcecf8, up=True)
    rp.face([(-15, 3.8, .35), (15, 3.8, .35), (15.5, 5.0, .35), (-15.5, 5.0, .35)], P['foam'], up=True)     # upstream foam lip
    out.append(rp)

    # ---- palms / shade trees on the bank for lushness ----
    tr = L.Part('arboles', ao=0.0)
    for (x, y, k) in ((-38, 8, 1.1), (36, 6, 1.0), (-14, 26, 1.1), (20, 28, 1.0), (-4, 28, .9)):
        tr.frustum((x, y, BANK), .7 * k, .5 * k, 4.0 * k, 5, P['trunk'], bottom=False)
        tr.ico((x, y, BANK + 5.6 * k), 3.0 * k, P['selva'], sub=0, sc=(1.1, 1.1, .85), jitter=.1, seed=int(x + y), tcolor=P['selvaL'])
        tr.ico((x + 1.4 * k, y - .8 * k, BANK + 4.6 * k), 2.2 * k, P['selva2'], sub=0, sc=(1.1, 1.1, .85), jitter=.1, seed=int(y), tcolor=P['selva'])
    out.append(tr)
    only = os.environ.get('ONLY')
    return [o for o in out if not only or o.name in only.split(',')]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
