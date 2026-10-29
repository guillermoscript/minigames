"""trees: 3 sizes x 3 crowns (round, flat, cone) as separate meshes tree_{s,m,l}_{round,flat,cone}; origin = trunk base."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'trees'
GROUND = 0xa8b65a
PREVIEW = dict(az=0, pitch=62, fit=1.0)
AO_DIST = 8.0
SZ = {'s': (2.6, 2.2), 'm': (4.2, 3.2), 'l': (6.0, 4.6)}


def build(L):
    P = L.P
    out = []
    for si, (k, (th, cr)) in enumerate(SZ.items()):
        for ci, shape in enumerate(('round', 'flat', 'cone')):
            p = L.Part('tree_%s_%s' % (k, shape), loc=(ci * 16 - 16, (1 - si) * 16, 0), ao=0.0)
            p.frustum((0, 0, 0), cr * .26, cr * .16, th, 6, P['trunk'], bottom=False)
            if shape == 'round':
                for (ox, oy, oz, rr, sd) in ((.15, 0, th + cr * .75, 1.0, 1), (-.55, .2, th + cr * .25, .7, 2), (.5, -.3, th + cr * .35, .7, 3)):
                    p.ico((ox * cr, oy * cr, oz), cr * rr, P['selva'], sub=1, sc=(1.05, 1.05, .85), jitter=.1, seed=si * 9 + sd, tcolor=P['selvaL'])
            elif shape == 'flat':
                p.beam((0, 0, th * .7), (cr * .5, 0, th + cr * .2), cr * .1, P['trunk'], sides=3)
                p.frustum((0, 0, th * .85), cr * 1.35, cr * 1.05, cr * .45, 9, P['selva2'], tcolor=P['selva'], bottom=True)
                p.frustum((cr * .15, 0, th * .85 + cr * .45), cr * 1.0, cr * .6, cr * .4, 9, P['selva'], tcolor=P['selvaL'], bottom=False)
            else:
                for (zf, rf, hf, c) in ((.45, 1.05, 1.5, P['selva2']), (.45 + 1.0, .78, 1.4, P['selva']), (.45 + 1.9, .5, 1.3, P['selvaL'])):
                    p.frustum((0, 0, th * zf), cr * rf, 0, cr * hf, 8, c, bottom=(zf < .5))
            out.append(p)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
