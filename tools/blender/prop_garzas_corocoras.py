"""garzas_corocoras: scarlet ibis (corocora) ibis_1..5 and white egrets (garza) garza_1..2, each a separate Part <=150 tris.
Origin = feet on the ground/water surface, bird faces +X (rotate the instance). ibis ~4.5 units tall, garza ~7."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'garzas_corocoras'
GROUND = 0x78a8b0
PREVIEW = dict(az=0, pitch=float(os.environ.get('PITCH', '70')), fit=float(os.environ.get('FIT', '0.85')))
AO_DIST = 4.0

SCARLET = 0xe0301f
SCARLETL = 0xf2604a
BLACK = 0x2a2420
WHITE = 0xf6f6f0
WHITED = 0xd6dce4
YEL = 0xe8b830
LEG_I = 0xc08060
LEG_G = 0x3a3430


def bird(p, s, body, bodyL, tipc, beakc, legc, bz, neck, head, beak, legs, wings='fold', beak_curve=0.0, tail=True):
    """neck: list of (x,z) offsets (units of s) from the shoulder; head: radius; beak: (len, droop);
    legs: list of ((hipx, hipy), (footx, footy, footz_lift)) in units of s; wings 'fold' | 'spread'."""
    sh = (1.05 * s, 0, bz + .35 * s)
    p.ico((0, 0, bz), 1.25 * s, body, sub=0, sc=(1.1, .62, .72), tcolor=bodyL)
    if tail:
        p.face([(-1.3 * s, 0, bz + .1 * s), (-2.4 * s, .45 * s, bz - .15 * s), (-2.4 * s, -.45 * s, bz - .15 * s)], tipc if tipc != body else bodyL, up=True)
    for sg in (-1, 1):
        if wings == 'fold':
            a = (.9 * s, sg * .62 * s, bz + .45 * s)
            b = (-1.7 * s, sg * .6 * s, bz + .1 * s)
            c = (-.4 * s, sg * .9 * s, bz - .05 * s)
            p.face([a, c, b], bodyL, flip_ref=lib.Vector((0, 0, bz)))
            p.face([(-.4 * s, sg * .9 * s, bz - .05 * s), (-1.7 * s, sg * .6 * s, bz + .1 * s), (-2.2 * s, sg * .75 * s, bz - .15 * s)], tipc, flip_ref=lib.Vector((0, 0, bz)))
        else:
            a = (.4 * s, sg * .55 * s, bz + .5 * s)
            b = (-1.2 * s, sg * 4.0 * s, bz + 2.0 * s)
            c = (-1.6 * s, sg * 1.0 * s, bz + .2 * s)
            d = (1.0 * s, sg * 3.0 * s, bz + 2.4 * s)
            mid1 = ((a[0] + d[0]) / 2, (a[1] + d[1]) / 2, (a[2] + d[2]) / 2)
            m2 = ((c[0] + b[0]) / 2 * .6 + a[0] * .4, (c[1] + b[1]) / 2 * .55 + a[1] * .45, (c[2] + b[2]) / 2 * .6 + a[2] * .4)
            m1 = (d[0] * .55 + a[0] * .45, d[1] * .55 + a[1] * .45, d[2] * .55 + a[2] * .45)
            p.face([a, m1, m2, c], bodyL, up=True)
            p.face([m1, d, b, m2], tipc, up=True)
    pts = [sh] + [(sh[0] + dx * s, 0, sh[2] + dz * s) for dx, dz in neck]
    for i in range(len(pts) - 1):
        p.beam(pts[i], pts[i + 1], .26 * s if i == 0 else .22 * s, body if body != SCARLET else SCARLETL, sides=3)
    hp = pts[-1]
    p.ico(hp, head * s, body, sub=0)
    p.ico((hp[0] + head * s * .55, -head * s * .55, hp[2] + .05 * s), .09 * s, BLACK, sub=0)
    p.ico((hp[0] + head * s * .55, head * s * .55, hp[2] + .05 * s), .09 * s, BLACK, sub=0)
    bl, bd = beak
    mid = (hp[0] + bl * s * .5 * 1.0, 0, hp[2] - bd * s * .15)
    tip = (hp[0] + bl * s, 0, hp[2] - bd * s * .5 * (1 + beak_curve))
    p.beam((hp[0] + head * s * .4, 0, hp[2]), mid, .14 * s, beakc, sides=3)
    p.beam(mid, tip, .08 * s, beakc, sides=3)
    for (hx, hy), (fx, fy, lift) in legs:
        hip = (hx * s, hy * s, bz - .5 * s)
        knee = ((hx + (fx - hx) * .4) * s - .35 * s, (hy + (fy - hy) * .4) * s, (bz - .5 * s) * .5 + lift * s * .5)
        foot = (fx * s, fy * s, lift * s)
        p.beam(hip, knee, .12 * s, legc, sides=3)
        p.beam(knee, foot, .1 * s, legc, sides=3)
        p.beam(foot, (foot[0] + .75 * s, foot[1], foot[2]), .1 * s, legc, sides=3)


def build(L):
    out = []
    # --- scarlet ibis: body red, black wing tips, long down-curved beak ---
    ib = dict(body=SCARLET, bodyL=SCARLETL, tipc=BLACK, beakc=0x5a3a30, legc=LEG_I)
    spec = [
        # 1 standing tall, head up
        dict(bz=2.9, neck=[(.7, .9), (.9, .55)], head=.38, beak=(1.8, 1.2), wings='fold', legs=[((.1, .35), (.2, .4, 0)), ((.1, -.35), (-.2, -.4, 0))]),
        # 2 wading, head dipped forward
        dict(bz=2.9, neck=[(.9, .45), (1.3, -.5)], head=.38, beak=(1.8, 1.6), wings='fold', legs=[((.2, .35), (.5, .4, 0)), ((.1, -.35), (-.7, -.4, 1.0))]),
        # 3 wings spread, landing
        dict(bz=3.6, neck=[(.7, .7), (1.2, .3)], head=.38, beak=(1.8, 1.0), wings='spread', legs=[((.1, .35), (.5, .4, 1.2)), ((.1, -.35), (-.5, -.4, 1.0))]),
        # 4 standing, neck curled
        dict(bz=2.9, neck=[(.2, .8), (.6, 1.3), (.9, 1.1)], head=.38, beak=(1.7, 1.4), wings='fold', legs=[((.1, .35), (.1, .4, 0)), ((.1, -.35), (.1, -.4, 0))]),
        # 5 walking, head level
        dict(bz=2.9, neck=[(.9, .6), (1.4, .4)], head=.38, beak=(1.8, 1.2), wings='fold', legs=[((.2, .35), (.9, .4, .2)), ((.0, -.35), (-.6, -.4, 0))]),
    ]
    for i, sp in enumerate(spec):
        p = L.Part('ibis_%d' % (i + 1), loc=(-30 + i * 13, 0, 0), rot=[0.2, -.3, .6, 0.0, -.15][i], ao=0.0)
        bird(p, 1.25, tipc=sp['tipc'] if 'tipc' in sp else ib['tipc'], body=ib['body'], bodyL=ib['bodyL'], beakc=ib['beakc'], legc=ib['legc'],
             bz=sp['bz'], neck=sp['neck'], head=sp['head'], beak=sp['beak'], legs=sp['legs'], wings=sp['wings'], beak_curve=.6)
        out.append(p)
    # --- white egrets: tall S-neck, long yellow dagger beak, black legs ---
    eg = [
        dict(bz=4.8, neck=[(-.1, .9), (.4, 1.8), (.1, 2.7), (.6, 3.2)], head=.34, beak=(2.2, .15), legs=[((.1, .35), (.1, .4, 0)), ((.1, -.35), (-.2, -.4, 0))]),
        dict(bz=4.4, neck=[(.7, .5), (1.4, .2), (1.9, -.6)], head=.34, beak=(2.2, 1.0), legs=[((.3, .35), (.9, .4, 0)), ((.0, -.35), (-.5, -.4, 1.0))]),
    ]
    for i, sp in enumerate(eg):
        p = L.Part('garza_%d' % (i + 1), loc=(-8 + i * 16, 16, 0), rot=[-.25, .3][i], ao=0.0)
        bird(p, 1.2, tipc=WHITED, body=WHITE, bodyL=WHITE, beakc=YEL, legc=LEG_G, bz=sp['bz'], neck=sp['neck'], head=sp['head'],
             beak=sp['beak'], legs=sp['legs'], wings='fold')
        out.append(p)
    only = os.environ.get('ONLY')
    return [o for o in out if not only or o.name in only.split(',')]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
