"""barcos: boat set, each a separate Part at its own origin (20 apart along X): sailboat, penero, ferry, lancha, velero_catamaran.
Bow = +X, keel/bottom at z=0 (waterline), <=300 tris each. Also exports hull()/boats for other Caribbean props."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from prop_palmas_coco import C, xf

NAME = 'barcos'
GROUND = 0x2f9fcc
PREVIEW = dict(az=0, pitch=60, fit=0.78)
AO_DIST = 6.0
V = lib.Vector


def hull(p, length, beam, H, cA, cB, cBottom, cDeck, ox=0.0, oy=0.0, rz=0.0, z0=0.0, bow_rise=0.35, stern_w=.8, bow_pt=.07, ns=5, flat=.5):
    """Lofted hull (bow +X). 6-point section: stripe band (cA) on top side, lower side (cB), flat bottom, deck."""
    T = xf(ox, oy, rz)
    us = [i / (ns - 1) for i in range(ns)]
    rings = []
    for u in us:
        x = (u - .5) * length
        if u < .5:
            wf = stern_w + (1 - stern_w) * (u / .5) ** .6
        else:
            wf = 1.0 - (1.0 - bow_pt) * ((u - .5) / .5) ** 1.8
        w = beam / 2 * wf
        sheer = H * bow_rise * u ** 2.5
        lift = H * .5 * max(0.0, (u - .62) / .38) ** 1.6
        top = H + sheer
        mid = H * .55 + lift * .6
        ring = [T(x, -w, z0 + top), T(x, -w * .94, z0 + mid), T(x, -w * flat, z0 + lift), T(x, w * flat, z0 + lift), T(x, w * .94, z0 + mid), T(x, w, z0 + top)]
        rings.append(ring)
    cen = V(T(0, 0, z0 + H * .5))
    p.loft(rings, cB, colors=[cA, cB, cBottom, cB, cA, cDeck], caps=(True, True), ref=cen)


def mast(p, x, y, z0, z1, ox=0, oy=0, rz=0, w=.09, c=None):
    T = xf(ox, oy, rz)
    p.beam(T(x, y, z0), T(x, y, z1), w, c if c is not None else C['white'], sides=3)


def sail(p, T, tack, head, clew, belly, color, color2=None):
    """Two-triangle sail with a bulged leech; points are local (x,y,z). Normal faces local -Y (south/sun side)."""
    mid = ((head[0] + clew[0]) / 2 + .05, (head[1] + clew[1]) / 2 + belly, (head[2] + clew[2]) / 2 + .1)
    ref = V(T(mid[0], 10, mid[2]))
    p.face([T(*tack), T(*head), T(*mid)], color, flip_ref=ref)
    p.face([T(*tack), T(*mid), T(*clew)], color2 if color2 is not None else color, flip_ref=ref)


def sailboat(p, ox=0, oy=0, rz=0, s=1.0, sail_c=None, hull_c=None, stripe=None):
    T = xf(ox, oy, rz)
    hull(p, 7.2 * s, 2.5 * s, 1.0 * s, stripe or C['navy'], hull_c or C['white'], C['navy'], 0xe6cf9c, ox, oy, rz, bow_rise=.35)
    p.cbox(T(-.9 * s, 0, 1.0 * s), (2.2 * s, 1.1 * s, .55 * s), C['white'], ch=.2, rz=rz) if False else None
    cab = [[T(-1.7 * s, -.7 * s, 1.0 * s), T(.2 * s, -.8 * s, 1.0 * s), T(.2 * s, .8 * s, 1.0 * s), T(-1.7 * s, .7 * s, 1.0 * s)],
           [T(-1.5 * s, -.55 * s, 1.55 * s), T(0, -.6 * s, 1.5 * s), T(0, .6 * s, 1.5 * s), T(-1.5 * s, .55 * s, 1.55 * s)]]
    p.loft(cab, C['white'], caps=(False, True), ref=V(T(-.7 * s, 0, 1.2 * s)))
    p.face([T(.15 * s, -.55 * s, 1.15 * s), T(.15 * s, .55 * s, 1.15 * s), T(.05 * s, .5 * s, 1.45 * s), T(.05 * s, -.5 * s, 1.45 * s)], C['glass'], flip_ref=V(T(-1, 0, 1.2)))
    mast(p, .7 * s, 0, 1.0 * s, 8.4 * s, ox, oy, rz, w=.1 * s)
    sail(p, T, (.55 * s, 0, 1.5 * s), (.55 * s, 0, 8.1 * s), (-3.0 * s, 0, 1.7 * s), .55 * s, sail_c or C['white'], C['cream'])
    sail(p, T, (.85 * s, 0, 1.2 * s), (.8 * s, 0, 7.4 * s), (3.4 * s, 0, 1.15 * s), -.4 * s, C['coral'], C['white'])
    p.beam(T(-3.0 * s, 0, 1.7 * s), T(.6 * s, 0, 1.6 * s), .06 * s, C['woodL'], sides=3)


def penero(p, ox=0, oy=0, rz=0, s=1.0):
    T = xf(ox, oy, rz)
    hull(p, 8.0 * s, 2.3 * s, 1.1 * s, C['white'], 0x2f6fd0, C['navy'], 0xe3c47e, ox, oy, rz, bow_rise=.9, stern_w=.85, bow_pt=.12, flat=.45)
    for x in (-1.6, 0.2, 1.8):
        p.box(T((x) * s, -.0, 1.15 * s), (.5 * s, 2.0 * s, .22 * s), C['woodL'], rz=rz, bottom=False)
    # little canopy over centre thwart
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.beam(T(sx * .55 * s + .2, sy * .7 * s, 1.15 * s), T(sx * .55 * s + .2, sy * .7 * s, 3.1 * s), .07 * s, C['white'], sides=3)
    p.face([T(-.5 * s, -.95 * s, 3.2 * s), T(1.2 * s, -.95 * s, 3.2 * s), T(1.2 * s, .95 * s, 3.2 * s), T(-.5 * s, .95 * s, 3.2 * s)], C['yellow'], up=True)
    # outboard motor at the stern
    p.box(T(-4.05 * s, 0, 1.0 * s), (.9 * s, .8 * s, .9 * s), C['red'], rz=rz)
    p.box(T(-4.2 * s, 0, 0.0), (.35 * s, .35 * s, 1.0 * s), C['steel'], rz=rz, bottom=False)
    p.beam(T(-4.4 * s, 0, 1.9 * s), T(-4.9 * s, 0, 1.6 * s), .08 * s, C['steel'], sides=3)
    # bow tip colour block and crate
    p.box(T(2.3 * s, 0, 1.15 * s), (.9 * s, .8 * s, .5 * s), C['coral'], rz=rz)


def ferry(p, ox=0, oy=0, rz=0, s=1.0):
    T = xf(ox, oy, rz)
    hull(p, 16 * s, 5.0 * s, 1.9 * s, C['red'], C['navy'], C['navy'], C['white'], ox, oy, rz, bow_rise=.25, stern_w=.92, bow_pt=.25, ns=5, flat=.6)
    # main deck block
    p.cbox(T(-.8 * s, 0, 2.0 * s), (12.0 * s, 4.4 * s, 2.1 * s), C['white'], ch=.35 * s, rz=rz, tcolor=C['cream'])
    p.cbox(T(-1.8 * s, 0, 4.1 * s), (8.0 * s, 3.6 * s, 1.8 * s), C['white'], ch=.3 * s, rz=rz, tcolor=C['cream'])
    # window bands both decks
    for sy in (-1, 1):
        for (x0, x1, z, zh, sh) in ((-6.3, 5.2, 2.9, 3.6, 2.2), (-5.4, 2.4, 4.8, 5.5, 1.8)):
            y = sy * (sh + .02) * s
            p.face([T(x0 * s, y, z * s), T(x1 * s, y, z * s), T(x1 * s, y, zh * s), T(x0 * s, y, zh * s)], C['glass'], flip_ref=V(T(0, 0, z * s)))
    # bridge + funnel
    p.cbox(T(2.6 * s, 0, 5.9 * s), (3.2 * s, 2.8 * s, 1.3 * s), C['white'], ch=.25 * s, rz=rz, tcolor=C['cream'])
    p.face([T(4.25 * s, -1.2 * s, 6.3 * s), T(4.25 * s, 1.2 * s, 6.3 * s), T(4.25 * s, 1.2 * s, 6.9 * s), T(4.25 * s, -1.2 * s, 6.9 * s)], C['glass'], flip_ref=V(T(0, 0, 6.3 * s)))
    p.frustum(T(-3.6 * s, 0, 5.9 * s), 1.1 * s, .9 * s, 1.1 * s, 6, C['yellow'], rz=rz, sy=.8, ring_colors=[C['yellow']], tcolor=C['steel'])
    p.frustum(T(-3.6 * s, 0, 7.0 * s), .9 * s, .85 * s, .35 * s, 6, C['red'], rz=rz, sy=.8, ring_colors=[C['red']], tcolor=C['steel'])
    mast(p, 2.8 * s, 0, 7.2 * s, 9.2 * s, ox, oy, rz, w=.1 * s, c=C['steel'])
    # bow visor/ramp lip and stern ramp
    p.face([T(6.3 * s, -2.0 * s, 2.0 * s), T(8.9 * s, 0, 2.0 * s), T(8.4 * s, 0, 3.0 * s), T(6.3 * s, -2.0 * s, 3.2 * s)], C['coral'], up=True) if False else None
    p.box(T(-8.5 * s, 0, 2.0 * s), (.7 * s, 4.0 * s, .6 * s), C['red'], rz=rz, bottom=False)
    # lifeboats
    for sy in (-1, 1):
        p.cbox(T(-.2 * s, sy * 2.35 * s, 3.9 * s), (2.4 * s, .7 * s, .55 * s), C['coral'], ch=.15 * s, rz=rz)


def lancha(p, ox=0, oy=0, rz=0, s=1.0):
    T = xf(ox, oy, rz)
    hull(p, 6.4 * s, 2.2 * s, .9 * s, C['coral'], C['white'], C['navy'], 0xf0ead8, ox, oy, rz, bow_rise=.55, stern_w=.95, bow_pt=.1, flat=.5)
    p.face([T(.7 * s, -.9 * s, 1.0 * s), T(.7 * s, .9 * s, 1.0 * s), T(-.2 * s, .85 * s, 1.75 * s), T(-.2 * s, -.85 * s, 1.75 * s)], C['glass'], flip_ref=V(T(-1, 0, 1)))
    for sy in (-1, 1):
        p.face([T(.7 * s, sy * .9 * s, 1.0 * s), T(-.2 * s, sy * .85 * s, 1.75 * s), T(-.2 * s, sy * .85 * s, 1.0 * s)], C['white'], flip_ref=V(T(0, 0, 1.2)))
    p.cbox(T(-1.5 * s, 0, .9 * s), (1.6 * s, 1.6 * s, .6 * s), C['navy'], ch=.2 * s, rz=rz)
    p.box(T(-2.3 * s, -.5 * s, .0), (.5 * s, .35 * s, 1.6 * s), C['steel'], rz=rz, bottom=False)
    p.box(T(-2.3 * s, .5 * s, .0), (.5 * s, .35 * s, 1.6 * s), C['steel'], rz=rz, bottom=False)
    for sy in (-1, 1):
        p.box(T(-3.0 * s, sy * .5 * s, .85 * s), (.9 * s, .6 * s, .75 * s), C['red'], rz=rz)


def catamaran(p, ox=0, oy=0, rz=0, s=1.0):
    T = xf(ox, oy, rz)
    for sy in (-1, 1):
        hull(p, 8.0 * s, 1.15 * s, 1.0 * s, C['teal'], C['white'], C['navy'], C['white'], *(T(0, sy * 2.1 * s)[:2]), rz, bow_rise=.5, stern_w=.8, bow_pt=.2, ns=4, flat=.5)
    # deck / trampoline
    p.cbox(T(-.5 * s, 0, 1.2 * s), (5.6 * s, 3.4 * s, .45 * s), C['white'], ch=.15 * s, rz=rz, tcolor=C['sand'])
    p.face([T(2.4 * s, -1.6 * s, 1.65 * s), T(3.8 * s, -.6 * s, 1.65 * s), T(3.8 * s, .6 * s, 1.65 * s), T(2.4 * s, 1.6 * s, 1.65 * s)], C['teal'], up=True)
    p.cbox(T(-1.6 * s, 0, 1.65 * s), (2.6 * s, 1.8 * s, 1.1 * s), C['white'], ch=.25 * s, rz=rz, tcolor=C['cream'])
    p.face([T(-.29 * s, -.8 * s, 2.0 * s), T(-.29 * s, .8 * s, 2.0 * s), T(-.29 * s, .8 * s, 2.5 * s), T(-.29 * s, -.8 * s, 2.5 * s)], C['glass'], flip_ref=V(T(-1.6, 0, 2.0)))
    mast(p, .9 * s, 0, 1.6 * s, 9.0 * s, ox, oy, rz, w=.1 * s)
    sail(p, T, (.75 * s, 0, 2.2 * s), (.75 * s, 0, 8.7 * s), (-2.6 * s, 0, 2.4 * s), .5 * s, C['white'], C['cream'])
    sail(p, T, (1.0 * s, 0, 1.8 * s), (.95 * s, 0, 7.9 * s), (3.5 * s, 0, 1.75 * s), -.4 * s, C['yellow'], C['white'])


def build(L):
    out = []
    for i, (nm, fn) in enumerate((('sailboat', sailboat), ('penero', penero), ('ferry', ferry), ('lancha', lancha), ('velero_catamaran', catamaran))):
        p = L.Part(nm, loc=((i % 3) * 20, -(i // 3) * 20, 0), ao=0.0)
        fn(p)
        out.append(p)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
