"""teleferico: lattice A-frame towers with station sheds, twin ropes, two cabins (cabin_a / cabin_b) hanging below their own origin (the rope grip point)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'teleferico'
GROUND = 0x7d9f50
PREVIEW = dict(az=15, pitch=70, fit=0.8)
AO_DIST = 8.0
SPAN = 16.0
TOP = 13.0


def build(L):
    P = L.P
    out = []
    tw = L.Part('towers', ao=0.0)
    for x in (-SPAN, SPAN):
        tw.cbox((x, 0, 0), (7.0, 6.0, 2.4), P['stone'], ch=.3, tcolor=0xb4bac4)                    # station block
        tw.gable((x, 0, 2.4), 6.4, 5.4, 1.6, 0x6a7080, 0x8a93a3, strips=2, overhang=.4)           # shed roof
        for sy in (-1, 1):                                                                          # A-frame legs
            tw.beam((x, sy * 2.2, 3.6), (x, sy * .5, TOP - .8), .5, P['white'], sides=4)
        for z, w in ((6.0, 1.7), (9.2, 1.1)):                                                       # cross braces
            tw.beam((x, -w, z), (x, w, z), .22, P['band'], sides=3)
        tw.beam((x, -1.7, 6.0), (x, 1.1, 9.2), .16, P['band'], sides=3)
        tw.beam((x, 1.7, 6.0), (x, -1.1, 9.2), .16, P['band'], sides=3)
        tw.cbox((x, 0, TOP - 1.0), (2.2, 5.0, 1.2), P['red'], ch=.25, tcolor=P['tejaL'])
        for sy in (-.9, .9):
            tw.cbox((x, sy, TOP + .2), (.9, .6, .8), P['steel'], ch=.15)                            # sheave housings
    out.append(tw)
    ca = L.Part('cable', ao=0.0)
    for sy in (-.9, .9):
        ca.beam((-SPAN, sy, TOP + .7), (SPAN, sy, TOP + .7), .12, P['steelL'], sides=3)
    out.append(ca)
    for name, x in (('cabin_a', -7.0), ('cabin_b', 8.0)):
        c = L.Part(name, loc=(x, 0, TOP + .7), ao=0.0)
        for sy in (-.9, .9):
            c.beam((0, sy, 0), (0, sy * .5, -1.9), .09, P['steel'], sides=3)
        c.cbox((0, 0, -1.95), (2.2, 2.0, .3), P['steel'], ch=.08)
        c.cbox((0, 0, -6.0), (5.2, 3.6, 1.5), P['red'], ch=.3, tcolor=P['redD'])
        c.box((0, 0, -4.55), (5.0, 3.4, 1.6), P['glassL'], bottom=False, top=False)
        c.cbox((0, 0, -2.95), (5.4, 3.8, .9), P['red'], ch=.3, tcolor=P['tejaL'])
        for sx in (-2.5, 0, 2.5):
            c.box((sx, 0, -4.55), (.3, 3.5, 1.6), P['redD'], bottom=False, top=False)
        out.append(c)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
