"""ccs_city: dense Caracas city kit for LA FIESTA (edif_*, torre_*, barrio_*, casa_*, palms, trees, highway, plaza, park).
Each Part = one instanceable piece, origin = base centre (z=0), front = -Y, bases buried 0.5 (barrios 1.5)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
import prop_palmas_coco as K
from mathutils import Vector

NAME = 'ccs_city'
GROUND = 0xb8b8a8
PREVIEW = dict(az=0, pitch=62, fit=0.95, size=2000)
AO_DIST = 10

SQ2 = math.sqrt(2)
W = dict(conc=0xd6ccb8, concL=0xe6dfcf, sand=0xe3cb9c, terra=0xc4724f, terraD=0x9b4f37, blue=0xa9c6da, blueD=0x84a5c2,
         white=0xf2efe6, mustard=0xdfb24c, sage=0xaec3a0, sageD=0x8aa87c, grey=0xc0beb8, greyD=0x8f9096, glass=0x4f7aa6,
         glassL=0x7fa6cc, glassD=0x35557c, teal=0x3f8c92, dark=0x3b4452, roof=0x8a8d94, roofL=0xa4a7ad, brick=0xb95f43,
         brickD=0x9a4a33, steel=0x30343c, tankB=0x3f6ea8, tankK=0x2b2f38, rust=0x9a5236, tinB=0x5f86b0, tinG=0x6aa07a,
         tinR=0xb5603f, tinRL=0xc97a52, win=0x33475c, door=0x6b4a2b, wood=0x7a5230, red=0xc9483c)


# ───────────────────────── generic helpers ─────────────────────────
def sq(p, side, cx, cy, w, d, a0, a1, z0, z1, col, off=0.04):
    """Flat quad on a wall of the box centred (cx,cy) size (w,d). a0..a1 = lateral range along that wall."""
    hx, hy = w / 2, d / 2
    if side in 'sn':
        y = cy + (-hy - off if side == 's' else hy + off)
        pts = [(cx + a0, y, z0), (cx + a1, y, z0), (cx + a1, y, z1), (cx + a0, y, z1)]
    else:
        x = cx + (hx + off if side == 'e' else -hx - off)
        pts = [(x, cy + a0, z0), (x, cy + a1, z0), (x, cy + a1, z1), (x, cy + a0, z1)]
    p.face(pts, col, flip_ref=Vector((cx, cy, (z0 + z1) / 2)))


def vol(p, cx, cy, w, d, z0, z1, wall, glass, nf, win='ribbon', sides='nsew', top=None, ch=0.35, frac=0.5, nc=3, mar=0.7,
        shop=None):
    """Bevelled volume with window bands (ribbon) or punched windows on the front."""
    p.cbox((cx, cy, z0), (w, d, z1 - z0), wall, ch=ch, tcolor=top)
    zb = max(z0, 0.0)
    f = (z1 - zb - ch * 0.9) / nf
    for sd in sides:
        L = w if sd in 'ns' else d
        for k in range(nf):
            if shop is not None and sd == 's' and k == 0:
                continue
            za = zb + k * f + f * 0.27
            zz = za + f * frac
            if win == 'punched' and sd == 's':
                cw = (L - 2 * mar) / nc
                for c in range(nc):
                    a = -L / 2 + mar + cw * (c + .5)
                    sq(p, sd, cx, cy, w, d, a - cw * .27, a + cw * .27, za, zz, glass)
            else:
                sq(p, sd, cx, cy, w, d, -L / 2 + mar, L / 2 - mar, za, zz, glass)
    if shop is not None:
        sq(p, 's', cx, cy, w, d, -w / 2 + .5, w / 2 - .5, zb + .3, zb + f * .78, shop)


def balc(p, cx, y, w, z, col, rail=None, depth=.9, hh=.8):
    p.box((cx, y - depth / 2 + .1, z), (w, depth, hh), col, bottom=False, colors={'s': rail if rail is not None else col})


def tank(p, x, y, z, r=.9, h=1.3, col=W['tankB']):
    p.frustum((x, y, z), r, r * .9, h, 6, col, tcolor=0x8a93a3, bottom=False)


def unit(p, x, y, z, w=1.6, d=1.1, h=.8, col=W['roofL']):
    p.box((x, y, z), (w, d, h), col, bottom=False)


def ant(p, x, y, z, h):
    p.beam((x, y, z), (x, y, z + h), .1, W['steel'], 3)
    p.beam((x - .8, y, z + h * .75), (x + .8, y, z + h * .75), .07, W['steel'], 3)


def roofkit(p, cx, cy, w, d, z, items, seed, acc=W['concL']):
    rng = random.Random(seed)
    slots = [(-.25, -.2), (.25, -.2), (-.25, .22), (.25, .22), (0, 0)]
    rng.shuffle(slots)
    for it, (sx, sy) in zip(items, slots):
        x = cx + sx * w + (rng.random() - .5) * .6
        y = cy + sy * d + (rng.random() - .5) * .6
        if it == 'tank':
            tank(p, x, y, z, col=rng.choice([W['tankB'], W['white'], W['tankK']]))
        elif it == 'unit':
            unit(p, x, y, z)
        elif it == 'stair':
            p.box((x, y, z), (2.2, 2.0, 1.6), acc, bottom=False)
        elif it == 'ant':
            ant(p, x, y, z, 4.5)
        elif it == 'dish':
            p.frustum((x, y, z + .5), .9, .2, .55, 6, W['white'], bottom=False)
            p.beam((x, y, z), (x, y, z + .55), .1, W['steel'], 3)


def hip(p, cx, cy, w, d, z, h, col, col2, ov=.45, flat=.28):
    r0 = (w / 2 + ov) * SQ2
    p.frustum((cx, cy, z), r0, r0 * flat, h, 4, col, rz=math.pi / 4, sy=(d / 2 + ov) / (w / 2 + ov), bottom=False,
              ring_colors=[col, col2, col, col2], tcolor=col2)


def wedge(p, cx, cy, w, d, z, rise, col, side, front_low=True, ov=.3):
    hw, hd = w / 2 + ov, d / 2 + ov
    z0, z1 = (z, z + rise) if front_low else (z + rise, z)
    ref = Vector((cx, cy, z + rise / 2))
    p.face([(cx - hw, cy - hd, z0), (cx + hw, cy - hd, z0), (cx + hw, cy + hd, z1), (cx - hw, cy + hd, z1)], col, flip_ref=ref)
    for sx in (-1, 1):
        if front_low:
            tri = [(cx + sx * hw, cy - hd, z), (cx + sx * hw, cy + hd, z), (cx + sx * hw, cy + hd, z + rise)]
        else:
            tri = [(cx + sx * hw, cy - hd, z), (cx + sx * hw, cy + hd, z), (cx + sx * hw, cy - hd, z + rise)]
        p.face(tri, side, flip_ref=ref)
    yb = cy + hd if front_low else cy - hd
    p.face([(cx - hw, yb, z), (cx + hw, yb, z), (cx + hw, yb, z + rise), (cx - hw, yb, z + rise)], side, flip_ref=ref)


def sink(p, depth=.5):
    for v in p.bm.verts:
        if v.co.z <= 0.001:
            v.co.z = -depth


# ───────────────────────── mid-rise archetypes ─────────────────────────
def e_slab(p, w, d, h, wall, acc, glass, nf, win, top, items, seed, shop=None, bal=()):
    vol(p, 0, 0, w, d, -.5, h, wall, glass, nf, win, top=top, shop=shop)
    p.cbox((0, 0, h - .2), (w + .5, d + .5, .9), acc, ch=.25, tcolor=top)
    for (z, c, r) in bal:
        balc(p, 0, -d / 2, w * .62, z, c, r)
    roofkit(p, 0, 0, w, d, h + .7, items, seed, acc)


def e_setback(p, w, d, h, wall1, wall2, acc, glass, nf, items, seed, shop):
    ph = round(h * .3)
    vol(p, 0, 0, w, d, -.5, ph, wall1, glass, 2, 'punched', top=W['roof'], shop=shop, nc=4)
    p.cbox((0, 0, ph - .2), (w + .5, d + .5, .5), acc, ch=.2, tcolor=W['roof'])
    tw, td = w * .68, d * .7
    vol(p, -w * .1, d * .1, tw, td, ph + .3, h, wall2, glass, nf, 'ribbon', top=W['roofL'])
    p.box((-w * .1, d * .1, h - .1), (tw + .5, td + .5, .5), acc, bottom=False, tcolor=W['roofL'])
    roofkit(p, -w * .1, d * .1, tw, td, h + .4, items, seed, acc)


def e_balcony(p, w, d, h, wall, glass, nf, acc, roofc, roof2, bal, items, seed, shop):
    vol(p, 0, 0, w, d, -.5, h, wall, glass, nf, 'punched', top=acc, shop=shop, nc=3, mar=.9)
    for (z, c) in bal:
        balc(p, 0, -d / 2, w * .75, z, c, W['white'])
    hip(p, 0, 0, w, d, h - .2, 2.6, roofc, roof2)
    if items:
        roofkit(p, 0, 0, w * .4, d * .4, h + 1.3, items, seed)


def e_corner(p, w, d, h, wall, wall2, glass, nf, acc, items, seed, shop):
    h1 = h * .62
    vol(p, w * .12, 0, w * .76, d, -.5, h1, wall, glass, max(3, nf - 3), 'ribbon', top=W['roof'], shop=shop)
    p.cbox((w * .12, 0, h1 - .2), (w * .76 + .5, d + .5, .7), acc, ch=.2, tcolor=W['roof'])
    tw, td = w * .38, d * .6
    tx, ty = -w * .31, -d * .06
    vol(p, tx, ty, tw, td, -.5, h, wall2, glass, nf, 'ribbon', top=W['roofL'], mar=.6)
    p.cbox((tx, ty, h - .2), (tw + .5, td + .5, .9), acc, ch=.2, tcolor=W['roofL'])
    p.box((tx, ty, h + .7), (tw * .5, td * .5, 1.6), W['roofL'], bottom=False)
    ant(p, tx, ty, h + 2.3, 5.0)
    roofkit(p, w * .12, 0, w * .76, d, h1 + .5, items, seed, acc)


def e_shed(p, w, d, h, wall, fin, glass, nf, roofc, side, front_low, seed, shop):
    vol(p, 0, 0, w, d, -.5, h, wall, glass, nf, 'ribbon', top=wall, mar=1.0, shop=shop)
    wedge(p, 0, 0, w, d, h - .2, 2.8, roofc, side, front_low)
    for sx in (-1, 1):
        p.box((sx * (w / 2 - .5), -d / 2 - .25, -.5), (.8, .7, h + .1), fin, bottom=False)


def e_twin(p, w, d, hA, hB, wallA, wallB, acc, glass, nA, nB, items, seed, shop):
    wa, wb = w * .56, w * .5
    vol(p, -w * .22, 0, wa, d, -.5, hA, wallA, glass, nA, 'punched', top=W['roof'], shop=shop, nc=3)
    p.cbox((-w * .22, 0, hA - .2), (wa + .5, d + .5, .7), acc, ch=.2, tcolor=W['roof'])
    vol(p, w * .26, -.7, wb, d * .9, -.5, hB, wallB, glass, nB, 'ribbon', top=W['roofL'])
    p.cbox((w * .26, -.7, hB - .2), (wb + .5, d * .9 + .5, .7), acc, ch=.2, tcolor=W['roofL'])
    roofkit(p, -w * .22, 0, wa, d, hA + .5, items[:3], seed, acc)
    roofkit(p, w * .26, -.7, wb, d * .9, hB + .5, items[3:], seed + 5, acc)


def e_terrace(p, w, d, h, wall, glass, acc, plant, items, seed):
    h1, h2 = h * .36, h * .68
    vol(p, 0, 0, w, d, -.5, h1, wall, glass, 3, 'punched', top=acc, nc=4, mar=.9)
    vol(p, 0, 1.2, w, d - 2.4, h1, h2, wall, glass, 3, 'ribbon', top=acc, mar=.9)
    vol(p, 0, 2.4, w * .85, d - 4.8, h2, h, wall, glass, 3, 'ribbon', top=acc, mar=.9)
    p.box((0, -d / 2 + .5, h1), (w - 1.4, .8, .7), plant, bottom=False)
    p.box((0, -d / 2 + 2.0, h2), (w - 1.4, .8, .7), plant, bottom=False)
    roofkit(p, 0, 2.4, w * .85, d - 4.8, h + .4, items, seed, acc)


def e_round(p, r, sy, h, wall, glass, nf, acc, items, seed):
    n = 8
    f = (h + .5) / (nf * 2)
    z = -.5

    def ring(rr, zz):
        return [(rr * math.cos(2 * math.pi * i / n + math.pi / 8), rr * sy * math.sin(2 * math.pi * i / n + math.pi / 8), zz) for i in range(n)]
    for k in range(nf * 2):
        col = wall if k % 2 == 0 else glass
        p.loft([ring(r, z + k * f), ring(r, z + (k + 1) * f)], col, ref=Vector((0, 0, z + (k + .5) * f)))
    zt = h
    p.frustum((0, 0, zt), r + .3, r + .1, .9, n, acc, rz=math.pi / 8, sy=sy, bottom=False, tcolor=W['roofL'])
    roofkit(p, 0, 0, r * 1.4, r * 1.4 * sy, zt + .9, items, seed, acc)


# ───────────────────────── towers ─────────────────────────
def tower(p, w, d, h, wall, glass, nf, acc, crown, seed, podc=W['white']):
    p.cbox((0, 0, -.5), (w + 3.4, d + 3.4, 5.0), podc, ch=.35, tcolor=W['roof'])
    sq(p, 's', 0, 0, w + 3.4, d + 3.4, -(w + 3.4) / 2 + .6, (w + 3.4) / 2 - .6, .6, 3.6, W['dark'])
    vol(p, 0, 0, w, d, 4.5, h, wall, glass, nf, 'ribbon', top=acc, ch=.5, mar=.55, frac=.55)
    z = h
    if crown == 'step':
        p.cbox((0, 0, z - .2), (w * .78, d * .78, 3.2), acc, ch=.3)
        p.cbox((0, 0, z + 3.0), (w * .42, d * .42, 2.4), W['roofL'], ch=.25)
        ant(p, 0, 0, z + 5.4, 8)
    elif crown == 'cap':
        p.cbox((0, 0, z - .3), (w + .8, d + .8, 1.1), acc, ch=.3, tcolor=W['roofL'])
        hip(p, 0, 0, w, d, z + .8, 3.6, W['terraD'], W['terra'], ov=0.1, flat=.1)
        p.beam((0, 0, z + 4.4), (0, 0, z + 10), .12, W['steel'], 3)
    elif crown == 'core':
        p.cbox((0, 0, z - .2), (w + .6, d + .6, .9), acc, ch=.25, tcolor=W['roofL'])
        for sx in (-1, 1):
            p.cbox((sx * w * .22, 0, z + .5), (w * .3, d * .55, 4.2), W['dark'], ch=.3, tcolor=W['roofL'])
        p.box((0, 0, z + .5), (w * .2, d * .3, 1.4), W['roofL'], bottom=False)
        ant(p, 0, 0, z + 2, 6)
    else:  # 'slope'
        p.cbox((0, 0, z - .2), (w + .5, d + .5, .9), acc, ch=.25, tcolor=W['roofL'])
        wedge(p, 0, 0, w * .8, d * .8, z + .6, 4.0, W['glassD'], W['greyD'], False)
        tank(p, w * .22, d * .25, z + .6, r=1.0, h=1.2)
        ant(p, -w * .2, -d * .15, z + .6, 4.5)


# ───────────────────────── barrio ─────────────────────────
BC = dict(Y=0xe9c34b, O=0xe58b3d, R=0xc9483c, B=0x8fb7d8, Wh=0xf1ede2, Pk=0xe6a0ab, G=0x82b97c, Br=0xbf6a4c, Gr=0xb8b6b0,
          T=0x5fb0a8)


def tin(p, w, d, z, rise, c1, c2, ov=.3, n=4, front_low=True, side=0xb0aea8):
    hw, hd = w / 2 + ov, d / 2 + ov
    zf, zb = (z, z + rise) if front_low else (z + rise, z)
    ref = Vector((0, 0, z + rise / 2))
    for i in range(n):
        x0, x1 = -hw + 2 * hw * i / n, -hw + 2 * hw * (i + 1) / n
        p.face([(x0, -hd, zf), (x1, -hd, zf), (x1, hd, zb), (x0, hd, zb)], c1 if i % 2 == 0 else c2, flip_ref=ref)
    for sx in (-1, 1):
        if front_low:
            tri = [(sx * hw, -hd, z), (sx * hw, hd, z), (sx * hw, hd, z + rise)]
        else:
            tri = [(sx * hw, -hd, z), (sx * hw, hd, z), (sx * hw, -hd, z + rise)]
        p.face(tri, side, flip_ref=ref)
    yb = hd if front_low else -hd
    p.face([(-hw, yb, z), (hw, yb, z), (hw, yb, z + rise), (-hw, yb, z + rise)], side, flip_ref=ref)


def barrio(p, w, d, floors, roof, seed, stairs=False, roofc=None):
    rng = random.Random(seed)
    z = -1.5
    zf_list = []
    for i, (h, col) in enumerate(floors):
        dw = 0 if i == 0 else rng.choice([0, 0, .3, -.35])
        dd = 0 if i == 0 else rng.choice([0, .3, -.3])
        ox = 0 if i == 0 else rng.choice([-.2, 0, .2])
        oy = 0 if i == 0 else rng.choice([0, 0, -.2])
        wi, di = w + dw, d + dd
        top = h if i < len(floors) - 1 else None
        zt = z + (h + 1.5 if i == 0 else h)
        p.box((ox, oy, z), (wi, di, zt - z), col, bottom=False, tcolor=0xa9a7a2 if i < len(floors) - 1 else col)
        zf = max(z, 0.0)
        # windows / door
        if i == 0:
            sq(p, 's', ox, oy, wi, di, -wi * .32 - .45, -wi * .32 + .45, zf + 1.0, zf + 2.0, W['win'])
            sq(p, 's', ox, oy, wi, di, wi * .2 - .45, wi * .2 + .45, zf, zf + 2.0, W['door'])
        else:
            sq(p, 's', ox, oy, wi, di, -wi * .27 - .45, -wi * .27 + .45, zf + .9, zf + 1.9, W['win'])
            sq(p, 's', ox, oy, wi, di, wi * .27 - .45, wi * .27 + .45, zf + .9, zf + 1.9, W['win'])
        sq(p, 'e', ox, oy, wi, di, -.5, .5, zf + 1.0 + (0 if i else .0), zf + 2.0, W['win'])
        z = zt
        zf_list.append((ox, oy, wi, di, zt))
    ox0, oy0, wi0, di0, zt0 = zf_list[0]
    p.box((ox0 + wi0 * .2, oy0 - di0 / 2 - .35, 2.2), (1.6, .8, .18), rng.choice([W['red'], BC['T'], BC['Y']]), bottom=False)
    if len(floors) > 1:
        ox1, oy1, wi1, di1, zt1 = zf_list[1]
        p.box((ox1, oy1 - di1 / 2 - .3, zt0), (wi1 * .8, .7, .55), rng.choice([W['white'], BC['Gr'], BC['B']]), bottom=False,
              colors={'s': rng.choice([BC['Wh'], W['dark']])})
    ox, oy, wi, di, ztop = zf_list[-1]
    if roof == 'tank':
        p.box((ox, oy, ztop), (wi + .3, di + .3, .3), 0xa9a7a2, bottom=False)
        tank(p, ox + wi * .22, oy + di * .15, ztop + .3, r=.75, h=1.0, col=rng.choice([W['tankB'], W['tankK'], W['white']]))
        p.box((ox - wi * .22, oy - di * .2, ztop + .3), (1.0, 1.0, .9), W['roofL'], bottom=False)
    elif roof == 'rebar':
        p.box((ox, oy, ztop), (wi + .3, di + .3, .3), 0xb2b0aa, bottom=False)
        for sx in (-1, 1):
            p.box((ox + sx * (wi / 2 - .3), oy - di / 2 + .3, ztop + .3), (.4, .4, 1.1), 0xa9a7a2, bottom=False)
            for sy in (-1, 1):
                x = ox + sx * (wi / 2 - .3)
                y = oy + sy * (di / 2 - .3)
                p.beam((x, y, ztop + .3), (x, y, ztop + 1.7), .08, W['rust'], 3)
    elif roof.startswith('tin'):
        c1, c2 = {'tin_rust': (W['tinR'], W['tinRL']), 'tin_blue': (W['tinB'], 0x7aa0c6), 'tin_green': (W['tinG'], 0x82b892)}[roof]
        tin(p, wi, di, ztop, 1.3, c1, c2, front_low=rng.random() < .5)
        p.box((ox - wi * .25, oy, ztop + .9), (.7, .7, .4), 0x6e6a64, bottom=False)
        tank(p, ox + wi * .3, oy - di * .2, ztop + .9, r=.6, h=.9, col=rng.choice([W['tankB'], W['tankK']]))
    elif roof == 'gable':
        p.gable((ox, oy, ztop), wi, di, 1.5, W['tinB'], 0x7aa0c6, strips=2, overhang=.3)
        p.box((wi / 2 + .6, 0, -1.5), (1.0, 1.6, 2.2), 0xa9a7a2, bottom=False)
    if stairs and len(floors) > 1:
        sx = ox + wi / 2 + .55
        for k in range(3):
            p.box((sx, oy - di / 2 + .6 + k * 1.0, -1.5), (.9, 1.0, 1.5 + .9 * (k + 1)), 0xa9a7a2, bottom=False)


BARRIOS = [
    (5.0, 5.0, [(3, BC['Y']), (2.7, BC['Br'])], 'rebar', False),
    (4.6, 5.4, [(3, BC['Wh']), (2.7, BC['B']), (2.7, BC['Pk'])], 'tank', False),
    (5.8, 5.0, [(3, BC['O']), (2.7, BC['Y'])], 'tin_rust', False),
    (4.4, 4.4, [(3.2, BC['Br']), (2.7, BC['Br']), (2.7, BC['Gr']), (2.4, BC['Br'])], 'tank', False),
    (5.4, 6.0, [(3, BC['B']), (2.7, BC['Wh'])], 'tin_blue', False),
    (4.8, 5.2, [(4.0, BC['R'])], 'tin_green', False),
    (6.0, 5.4, [(3, BC['Pk']), (2.7, BC['Y']), (2.7, BC['Wh'])], 'tank', True),
    (4.2, 4.8, [(3, BC['G']), (2.7, BC['Br'])], 'rebar', False),
    (5.2, 4.6, [(2.8, BC['Wh']), (2.5, BC['O']), (2.5, BC['B']), (2.4, BC['Br'])], 'tank', False),
    (5.6, 5.8, [(3, BC['Gr']), (2.7, BC['Gr'])], 'rebar', False),
    (4.8, 5.8, [(3, BC['T']), (2.7, BC['Wh'])], 'tin_rust', True),
    (6.2, 5.0, [(3, BC['Y']), (2.7, BC['R'])], 'tank', False),
    (4.4, 5.0, [(4.2, BC['Wh'])], 'gable', False),
    (5.4, 5.4, [(2.8, BC['O']), (2.6, BC['Br']), (2.6, BC['Pk'])], 'tin_blue', True),
]


# ───────────────────────── casas ─────────────────────────
def casa(p, k):
    C = lib.CASAS
    if k == 1:   # single-storey villa, hip tile roof, porch, chimney
        w, d = 8.2, 7.0
        p.cbox((0, 0, -.5), (w, d, 4.0), C[0], ch=.25)
        hip(p, 0, 0, w, d, 3.5, 2.4, W['terra'], W['terraD'])
        p.box((w * .25, d * .2, 5.0), (.9, .9, 2.0), W['brick'], bottom=False)
        sq(p, 's', 0, 0, w, d, -2.8, -1.2, 1.0, 2.6, W['win'])
        sq(p, 's', 0, 0, w, d, 2.0, 3.4, 1.0, 2.6, W['win'])
        sq(p, 's', 0, 0, w, d, -.6, .6, 0, 2.5, W['door'])
        p.box((0, -d / 2 - .8, -.5), (3.4, 1.6, 3.0), 0xe9e1cf, bottom=False)
    elif k == 2:  # two-storey gable villa with balcony
        w, d = 7.0, 8.0
        p.cbox((0, 0, -.5), (w, d, 6.6), C[1], ch=.25)
        p.gable((0, 0, 6.1), w, d, 2.6, W['terra'], W['terraD'], strips=2, overhang=.5)
        for sx in (-1, 1):
            sq(p, 's', 0, 0, w, d, sx * 1.9 - .6, sx * 1.9 + .6, 1.0, 2.4, W['win'])
            sq(p, 's', 0, 0, w, d, sx * 1.9 - .6, sx * 1.9 + .6, 4.0, 5.4, W['win'])
        sq(p, 's', 0, 0, w, d, -.5, .5, 0, 2.5, W['door'])
        balc(p, 0, -d / 2, 3.6, 3.4, W['white'], W['wood'], depth=1.1, hh=.45)
    elif k == 3:  # townhouse pair, flat roofs
        for i, (sx, col, h) in enumerate(((-1, C[5], 6.4), (1, C[4], 5.6))):
            p.cbox((sx * 2.1, 0, -.5), (4.2, 7.6, h), col, ch=.2)
            p.box((sx * 2.1, 0, h - .3), (4.6, 8.0, .5), W['white'], bottom=False)
            sq(p, 's', sx * 2.1, 0, 4.2, 7.6, -1.0, 1.0, 3.4, 4.9, W['win'])
            sq(p, 's', sx * 2.1, 0, 4.2, 7.6, -.5 + sx * .9, .5 + sx * .9, 0, 2.3, W['door'])
        p.cbox((-2.1, 1.0, 5.9), (1.8, 1.8, 1.6), W['roofL'], ch=.15)
        tank(p, 2.4, 1.5, 5.3, r=.8, h=1.0)
    elif k == 4:  # L-shaped villa, crossed gables
        p.cbox((0, 0, -.5), (8.6, 5.6, 4.2), C[3], ch=.25)
        p.cbox((-2.2, 3.4, -.5), (4.2, 6.0, 4.2), C[3], ch=.25)
        p.gable((0, 0, 3.7), 8.6, 5.6, 2.2, W['terra'], W['terraD'], strips=2, overhang=.4)
        p.gable((-2.2, 3.4, 3.7), 6.0, 4.2, 2.2, W['terraD'], W['terra'], rz=math.pi / 2, strips=2, overhang=.4)
        sq(p, 's', 0, 0, 8.6, 5.6, -3.0, -1.6, 1.0, 2.6, W['win'])
        sq(p, 's', 0, 0, 8.6, 5.6, 2.2, 3.6, 1.0, 2.6, W['win'])
        sq(p, 's', 0, 0, 8.6, 5.6, -.5, .5, 0, 2.5, W['door'])
    elif k == 5:  # modern: flat roof + cantilever slab
        p.cbox((0, 0, -.5), (7.6, 7.0, 3.9), C[6], ch=.2)
        p.cbox((.8, -.4, 3.2), (8.8, 7.4, .7), W['white'], ch=.2, tcolor=W['roofL'])
        p.cbox((-1.0, .5, 3.9), (4.0, 4.0, 2.8), W['white'], ch=.2, tcolor=W['roofL'])
        sq(p, 's', 0, 0, 7.6, 7.0, -3.2, 1.0, 1.0, 2.7, W['glassD'])
        sq(p, 's', 0, 0, 7.6, 7.0, 1.8, 3.1, 0, 2.5, W['door'])
        sq(p, 's', -1.0, .5, 4.0, 4.0, -1.4, 1.4, 4.6, 5.9, W['glass'])
    else:         # colonial: long hip roof, columns, arched door
        w, d = 9.0, 6.2
        p.cbox((0, 0, -.5), (w, d, 4.0), C[4], ch=.25)
        hip(p, 0, 0, w, d, 3.5, 2.2, W['terra'], W['terraD'], flat=.35)
        p.box((0, -d / 2 - 1.1, -.5), (6.4, 2.2, .7), 0xe9e1cf, bottom=False)
        for sx in (-2.8, 0, 2.8):
            p.beam((sx, -d / 2 - 1.8, .2), (sx, -d / 2 - 1.8, 3.4), .22, W['white'], 4)
        p.box((0, -d / 2 - 1.1, 3.4), (7.2, 2.6, .4), W['white'], bottom=False)
        for sx in (-2.8, 2.8):
            sq(p, 's', 0, 0, w, d, sx - .6, sx + .6, 1.0, 2.6, W['win'])
        sq(p, 's', 0, 0, w, d, -.55, .55, 0, 2.6, W['door'])


def casa_bushes(p, k):
    spots = {1: [(-3.4, -4.2), (3.6, -4.6)], 2: [(-3.0, -4.6), (3.0, -4.6)], 4: [(-3.8, -3.4), (3.6, -3.5)], 5: [(-3.2, -4.4), (3.8, -4.2)], 6: [(-4.2, -3.6), (4.2, -3.6)], 3: [(-4.6, -4.5), (4.6, -4.5)]}[k]
    for i, (x, y) in enumerate(spots):
        p.ico((x, y, .35), .85, 0x4f9a46, sub=0, jitter=.12, seed=k * 3 + i, tcolor=0x72b455, sc=(1, 1, .8))


# ───────────────────────── trees ─────────────────────────
def tree(p, th, blobs, trunk_r, c, tc, seed):
    p.frustum((0, 0, 0), trunk_r, trunk_r * .65, th, 5, W['wood'], bottom=False)
    for i, (ox, oy, oz, r, sz) in enumerate(blobs):
        p.ico((ox, oy, th + oz), r, c, sub=0, sc=(1, 1, sz), jitter=.1, seed=seed + i, tcolor=tc)
    sink(p, .5)


def palma(p, h, s, nfr, fl, seed, lean, nco=0, rings=3, royal=False):
    if royal:
        old = (K.C['trunk'], K.C['trunkD'])
        K.C['trunk'], K.C['trunkD'] = 0xb9ae98, 0x9c917c
    K.palm(p, 0, 0, h=h, lean=lean, s=s, seed=seed, nfr=nfr, fl=fl, coconuts=nco, rings=rings)
    if royal:
        K.C['trunk'], K.C['trunkD'] = old
    sink(p, .5)


# ───────────────────────── highway ─────────────────────────
H_CONC, H_SIDE, H_BOT, H_CAP = 0xc9c7c1, 0xaeaca8, 0x8f9096, 0xdedbd3
H_ASPH, H_LINE, H_YEL = 0x555a66, 0xf0eee4, 0xe8c040


def sweep(p, st, prof, colors, closed=True, caps=False):
    rings = [[(o[0] + u[0] * a, o[1] + u[1] * a, o[2] + dz) for a, dz in prof] for o, u in st]
    for k in range(len(rings) - 1):
        pts = rings[k] + rings[k + 1]
        ref = Vector((sum(q[0] for q in pts) / len(pts), sum(q[1] for q in pts) / len(pts), sum(q[2] for q in pts) / len(pts)))
        p.loft([rings[k], rings[k + 1]], colors[0], closed=closed, colors=colors, ref=ref)
    if caps:
        for k in (0, len(rings) - 2):
            pts = rings[k] + rings[k + 1]
            ref = Vector((sum(q[0] for q in pts) / len(pts), sum(q[1] for q in pts) / len(pts), sum(q[2] for q in pts) / len(pts)))
            p.face(rings[k] if k == 0 else rings[k + 1], colors[0], flip_ref=ref)


def highway(p, kind):
    if kind == 'recta':
        def at(t):
            return (-12 + 24 * t, 0, 9.0), (0, 1, 0)
        ts = [0, 1]
        dashes = [(.07, .17), (.32, .42), (.57, .67), (.82, .92)]
        piers = [.25, .75]
        ang = lambda t: math.pi / 2
    elif kind == 'rampa':
        def at(t):
            return (-12 + 24 * t, 0, .05 + 8.95 * t), (0, 1, 0)
        ts = [0, 1]
        dashes = [(.07, .17), (.32, .42), (.57, .67), (.82, .92)]
        piers = [.38, .78]
        ang = lambda t: math.pi / 2
    else:
        Rc = 25.5

        def at(t):
            a = math.pi / 2 * t
            return (Rc * math.cos(a), Rc * math.sin(a), 9.0), (math.cos(a), math.sin(a), 0)
        ts = [i / 6 for i in range(7)]
        dashes = [(0, 1 / 6), (2 / 6, 3 / 6), (4 / 6, 5 / 6)]
        piers = [.25, .75]
        ang = lambda t: math.pi / 2 * t
    st = [at(t) for t in ts]
    # deck (asphalt top, side concrete, underside) and parapets
    sweep(p, st, [(-4.5, 0), (4.5, 0), (4.5, -1.3), (-4.5, -1.3)], [H_ASPH, H_SIDE, H_BOT, H_SIDE], caps=True)
    for sgn in (-1, 1):
        sweep(p, st, [(sgn * 4.5, 0), (sgn * 4.5, 1.1), (sgn * 3.8, 1.1), (sgn * 3.8, 0)], [H_CONC, H_CAP, H_CONC], closed=False)
        sweep(p, st, [(sgn * 3.3, .04), (sgn * 3.45, .04)], [H_LINE], closed=False)   # edge line (solid)
    # centre double yellow
    for a in (-.18, .18):
        sweep(p, st, [(a - .06, .04), (a + .06, .04)], [H_YEL], closed=False)
    # dashed lane lines
    for lat in (-1.9, 1.9):
        for (t0, t1) in dashes:
            sweep(p, [at(t0), at(t1)], [(lat - .07, .05), (lat + .07, .05)], [H_LINE], closed=False)
    # piers (column + hammerhead cap)
    for t in piers:
        o, u = at(t)
        a = math.atan2(u[1], u[0])
        capb = o[2] - 1.3 - 1.0
        p.box((o[0], o[1], -.5), (1.8, 1.8, capb + .5), H_SIDE, rz=a, bottom=False)
        p.cbox((o[0], o[1], capb), (8.4, 2.4, 1.0), H_CONC, ch=.3, rz=a, tcolor=H_CAP)


# ───────────────────────── plaza & park ─────────────────────────
def plaza(p):
    p.box((0, 0, -.5), (16, 16, .8), 0xc2b89f, bottom=False, tcolor=0xc2b89f)
    p.grid((0, 0, 0), (15.2, 15.2), 4, 4, None, z=.34,
           colorfn=lambda x, y: 0xe6dec9 if (int((x + 7.6) / 3.8) + int((y + 7.6) / 3.8)) % 2 == 0 else 0xd5caae)
    z = .34
    p.frustum((0, 0, z), 3.3, 3.1, .75, 8, 0xb9b3a4, tcolor=0xcfc9b8, bottom=False, rz=math.pi / 8)
    p.disc((0, 0, z + .66), 2.7, 0x62b6d8, rings=1, segs=8)
    p.frustum((0, 0, z + .5), .75, .5, 1.5, 6, 0xb9b3a4, bottom=False, tcolor=0xcfc9b8)
    p.frustum((0, 0, z + 1.9), 1.5, .6, .55, 8, 0xcfc9b8, bottom=False, tcolor=0x62b6d8)
    p.frustum((0, 0, z + 2.4), .22, 0, 1.2, 4, 0xbfe6f4, bottom=False)
    for (bx, by, rz) in ((0, -5.9, 0), (0, 5.9, 0), (-5.9, 0, math.pi / 2), (5.9, 0, math.pi / 2)):
        p.box((bx, by, z), (2.8, .8, .5), W['wood'], rz=rz, bottom=False)
        sgn = 1 if (by > 0 or bx > 0) else -1
        if rz == 0:
            p.box((bx, by + sgn * .35, z + .5), (2.8, .2, .55), 0x5a3a20, bottom=False)
        else:
            p.box((bx + sgn * .35, by, z + .5), (.2, 2.8, .55), 0x5a3a20, bottom=False)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((sx * 6.2, sy * 6.2, z), (1.9, 1.9, .6), 0xb9b3a4, bottom=False)
            p.ico((sx * 6.2, sy * 6.2, z + .9), .95, 0x4f9a46, sub=0, jitter=.12, seed=3 + sx + 2 * sy, tcolor=0x72b455)


def parque(p):
    p.box((0, 0, -.5), (16, 16, .6), 0x6f9a48, bottom=False, top=False)
    p.grid((0, 0, 0), (16, 16), 4, 4, None, z=.1,
           colorfn=lambda x, y: 0x86b455 if (int((x + 8) / 4) + int((y + 8) / 4)) % 2 == 0 else 0x7aa94d)
    pts = [(-8, -6.5), (-3.5, -3.5), (1.5, -.5), (3.5, 3.5), (8, 6)]
    for (a, b) in zip(pts[:-1], pts[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        nx, ny = -dy / L * .85, dx / L * .85
        p.face([(a[0] - nx, a[1] - ny, .14), (a[0] + nx, a[1] + ny, .14), (b[0] + nx, b[1] + ny, .14), (b[0] - nx, b[1] - ny, .14)], 0xe0d2a8, up=True)
    for (tx, ty, s, c, tc, sd) in ((-4.5, 3.8, 1.0, 0x4c9444, 0x72b455, 1), (4.8, -4.5, .9, 0x3f8a40, 0x62a84c, 7), (-5.2, -5.5, .8, 0x6fa84a, 0x93c25a, 12)):
        th = 2.4 * s
        p.frustum((tx, ty, .1), .45 * s, .3 * s, th, 5, W['wood'], bottom=False)
        for i, (ox, oy, oz, r) in enumerate(((0, 0, 1.9, 1.9), (1.1, .4, 1.1, 1.4), (-1.0, -.5, 1.2, 1.4))):
            p.ico((tx + ox * s, ty + oy * s, th + oz * s), r * s, c, sub=0, sc=(1, 1, .85), jitter=.1, seed=sd + i, tcolor=tc)
    p.box((2.2, 5.6, .1), (2.4, .7, .45), W['wood'], bottom=False)
    for (bx, by, s) in ((5.5, 1.5, .8), (-1.0, -6.4, .7)):
        p.ico((bx, by, .8), 1.0 * s, 0x4f9a46, sub=0, jitter=.12, seed=5, tcolor=0x72b455)


# ───────────────────────── build ─────────────────────────
INFO = {}


def build(L):
    out = []
    X = 24.0

    def part(name, col, row, dx=0.0):
        p = L.Part(name, loc=(col * X + dx, -row * X, 0), ao=0.22)
        out.append(p)
        return p

    G, WL = W, W
    # ── 16 mid-rise blocks ──
    sh = W['dark']
    e = lambda n: part('edif_%02d' % n, (n - 1) % 8, (n - 1) // 8)
    e_slab(e(1), 11, 9, 22, G['conc'], G['white'], G['glass'], 7, 'punched', G['roof'], ['tank', 'unit', 'stair'], 1, shop=sh)
    e_setback(e(2), 13, 11, 26, G['sand'], G['concL'], G['terra'], G['glass'], 7, ['tank', 'unit', 'ant'], 2, shop=sh)
    e_balcony(e(3), 10, 9, 20, G['white'], G['glassL'], 6, G['terra'], G['terraD'], G['terra'],
              [(5.5, G['mustard']), (8.8, G['mustard']), (12.1, G['mustard']), (15.4, G['mustard'])], ['tank'], 3, sh)
    e_corner(e(4), 13, 10, 30, G['blue'], G['grey'], G['glassD'], 8, G['white'], ['tank', 'unit', 'stair'], 4, sh)
    e_shed(e(5), 12, 9, 17, G['terra'], G['sand'], G['glassL'], 5, G['sage'], G['greyD'], True, 5, sh)
    e_twin(e(6), 14, 11, 22, 16, G['sage'], G['conc'], G['white'], G['glass'], 6, 4, ['tank', 'unit', 'ant', 'stair', 'unit'], 6, sh)
    e_terrace(e(7), 13, 12, 28, G['concL'], G['glass'], G['white'], G['sageD'], ['tank', 'unit', 'dish'], 7)
    e_round(e(8), 5.6, .95, 24, G['white'], G['glassD'], 5, G['terra'], ['tank', 'ant'], 8)
    e_slab(e(9), 10, 12, 16, G['mustard'], G['white'], G['glassD'], 5, 'ribbon', G['roof'], ['unit', 'tank'], 9, shop=sh)
    e_setback(e(10), 12, 10, 24, G['terra'], G['conc'], G['white'], G['glassL'], 6, ['unit', 'tank', 'stair'], 10, sh)
    e_balcony(e(11), 11, 10, 25, G['blue'], G['glass'], 7, G['white'], G['sand'], G['sage'],
              [(5.5, G['terra']), (9.0, G['terra']), (12.5, G['terra']), (16.0, G['terra']), (19.5, G['terra'])], [], 11, sh)
    e_corner(e(12), 12, 12, 28, G['sand'], G['terra'], G['glass'], 8, G['concL'], ['tank', 'unit', 'dish'], 12, sh)
    e_shed(e(13), 14, 10, 19, G['blue'], G['white'], G['glass'], 6, G['terraD'], G['concL'], False, 13, sh)
    e_twin(e(14), 14, 10, 20, 26, G['terra'], G['sand'], G['white'], G['glassD'], 6, 7, ['tank', 'unit', 'ant', 'tank', 'stair'], 14, sh)
    e_slab(e(15), 9, 8, 14, G['white'], G['terra'], G['teal'], 4, 'punched', G['roofL'], ['tank', 'dish'], 15,
           bal=[(3.8, G['sage'], G['white']), (7.4, G['sage'], G['white'])])
    e_slab(e(16), 12, 10, 30, G['sage'], G['white'], G['glass'], 9, 'ribbon', G['roof'], ['tank', 'unit', 'ant', 'stair'], 16, shop=sh)

    # ── 4 towers ──
    tower(part('torre_01', 0, 2), 9, 9, 46, 0x4a7db0, 0x9cc2e2, 16, W['white'], 'step', 1)
    tower(part('torre_02', 1, 2), 9, 9, 40, W['white'], 0x6f94b8, 13, W['concL'], 'core', 2, podc=W['concL'])
    tower(part('torre_03', 2, 2), 8.4, 9.4, 52, 0x4a4f5a, 0x7f8b9d, 18, W['greyD'], 'slope', 3, podc=W['greyD'])
    tower(part('torre_04', 3, 2), 9.6, 8.6, 44, W['terra'], 0x6f8fae, 14, W['terraD'], 'cap', 4, podc=W['sand'])

    # ── 14 barrio houses ──
    for i, (w, d, fl, rf, stairs) in enumerate(BARRIOS):
        barrio(part('barrio_%02d' % (i + 1), i % 7, 3 + i // 7, 0), w, d, fl, rf, 100 + i, stairs)

    # ── 6 casas ──
    for k in range(1, 7):
        cp = part('casa_%02d' % k, k - 1, 5)
        casa(cp, k)
        if k != 3:
            casa_bushes(cp, k)

    # ── palms & trees ──
    palma(part('palma_s', 0, 6), 4.8, .8, 6, 3.2, 3, (.5, .2), nco=0)
    palma(part('palma_m', 1, 6), 7.4, 1.0, 7, 4.2, 5, (1.2, .5), nco=1)
    palma(part('palma_l', 2, 6), 10.8, 1.2, 8, 5.0, 8, (1.5, -.7), nco=0, royal=True)
    tree(part('arbol_a', 3, 6), 3.0, [(0, 0, 2.7, 2.6, .9), (2.1, .8, 1.5, 2.0, .8), (-2.0, -.6, 1.6, 2.0, .8), (.6, -2.0, 1.4, 1.8, .8), (-.5, 2.0, 1.2, 1.7, .8)], .55, 0x4c9444, 0x72b455, 1)
    tree(part('arbol_b', 4, 6), 3.6, [(0, 0, 2.2, 3.0, .6), (2.8, 1.0, 1.7, 2.3, .55), (-2.8, -.8, 1.8, 2.3, .55), (.5, -2.8, 1.6, 2.1, .55), (-.6, 2.8, 1.5, 2.0, .55)], .7, 0x6fa84a, 0x93c25a, 11)
    tree(part('arbol_c', 5, 6), 2.8, [(0, 0, 3.4, 2.7, 1.2), (1.8, .5, 1.6, 1.9, 1.0), (-1.8, -.5, 1.7, 1.9, 1.0), (.4, -1.8, 1.4, 1.6, 1.0), (-.4, 1.8, 1.5, 1.6, 1.0)], .5, 0x2f7a3a, 0x4f9a46, 21)

    # ── highways, plaza, park ──
    for nm, kind, lx in (('autopista_recta', 'recta', 0), ('autopista_curva', 'curva', 40), ('autopista_rampa', 'rampa', 100)):
        p = L.Part(nm, loc=(lx, -8.4 * X, 0), ao=0.2)
        highway(p, kind)
        out.append(p)
    p = L.Part('plaza_pieza', loc=(150, -8 * X, 0), ao=0.2)
    plaza(p)
    out.append(p)
    p = L.Part('parque_pieza', loc=(176, -8 * X, 0), ao=0.2)
    parque(p)
    out.append(p)
    return out


def write_manifest(info):
    import bpy
    rows = []
    for nm, t in info['per_mesh'].items():
        o = bpy.data.objects[nm]
        xs = [v.co.x for v in o.data.vertices]
        ys = [v.co.y for v in o.data.vertices]
        zs = [v.co.z for v in o.data.vertices]
        rows.append((nm, t, '%.1f x %.1f' % (max(xs) - min(xs), max(ys) - min(ys)), '%.1f' % max(zs)))
    path = os.path.join(lib.MODEL_DIR, 'ccs_city_manifest.md')
    with open(path, 'w') as f:
        f.write('# ccs_city kit manifest\n\nTotal tris: %d. Origin = base centre at z=0 (bases buried 0.5, barrios 1.5), front faces -Y (glTF +Z).\n'
                'Highway pieces: deck top at z=9; `autopista_recta` runs along X (-12..12), `autopista_rampa` rises from z=0 at x=-12 to z=9 at x=+12, '
                '`autopista_curva` is a 90 degree arc whose ORIGIN IS THE CENTRE OF CURVATURE (centreline radius 25.5, outer 30; starts at (25.5,0) heading +Y, '
                'ends at (0,25.5) heading -X).\n\n' % info['tris'])
        f.write('| Part | tris | footprint (x by y) | height (z max) |\n|---|---|---|---|\n')
        for r in rows:
            f.write('| %s | %d | %s | %s |\n' % r)


if __name__ == '__main__':
    info = lib.run(sys.modules[__name__])
    write_manifest(info)
