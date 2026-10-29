"""playa_kit: individually instanceable beach pieces for the Caribbean coast: palapas, umbrellas, loungers, bar kiosk, stranded boat.
Parts sit on a grid 14 apart; geometry is local with origin at the base centre. Built from the shared kit in prop_palmas_coco.py."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
import prop_palmas_coco as K

NAME = 'playa_kit'
GROUND = 0xf1e6c4
PREVIEW = dict(az=0, pitch=60, fit=0.9)
AO_DIST = 6.0
C = K.C


def build(L):
    out = []
    specs = [
        ('palapa_a', lambda p: K.palapa(p, 0, 0, r=2.8, h=3.6, rz=0, tilt=.2)),
        ('palapa_b', lambda p: K.palapa(p, 0, 0, r=2.3, h=3.1, rz=.4, tilt=-.2)),
        ('sombrilla_coral', lambda p: K.umbrella(p, 0, 0, C['coral'], C['white'])),
        ('sombrilla_amarilla', lambda p: K.umbrella(p, 0, 0, C['yellow'], C['white'])),
        ('sombrilla_teal', lambda p: K.umbrella(p, 0, 0, C['teal'], C['white'], r=2.0)),
        ('camastro_a', lambda p: K.lounger(p, 0, 0, 0.0, C['coral'], C['white'])),
        ('camastro_b', lambda p: K.lounger(p, 0, 0, 0.0, C['teal'], C['white'])),
        ('set_palapa', lambda p: (K.palapa(p, 0, 0, r=2.7, h=3.5, rz=.2, tilt=.25), K.lounger(p, -1.6, -1.8, .1, C['yellow'], C['white']), K.lounger(p, 1.7, -1.7, -.12, C['coral'], C['white']))),
        ('set_sombrilla', lambda p: (K.umbrella(p, 0, 0, C['coral'], C['white']), K.lounger(p, -1.3, -1.6, .08, C['teal'], C['white']), K.lounger(p, 1.4, -1.5, -.1, C['yellow'], C['white']))),
    ]
    for i, (nm, fn) in enumerate(specs):
        p = L.Part(nm, loc=((i % 5) * 14, -(i // 5) * 14, 0), ao=0.0)
        fn(p)
        out.append(p)
    # beach bar kiosk with striped awning
    b = L.Part('bar_kiosco', loc=(0, -28, 0), ao=0.0)
    b.cbox((0, 0, 0), (5.4, 3.6, 2.4), C['cream'], ch=.2, tcolor=C['white'])
    b.gable((0, 0, 2.4), 5.4, 3.6, 1.3, C['coral'], C['white'], strips=4, overhang=.5)
    b.box((0, -1.85, .6), (3.6, .25, 1.0), C['woodL'], bottom=False)
    for sx in (-2.3, 2.3):
        b.beam((sx, -2.3, 0), (sx, -2.3, 2.4), .12, C['pole'], sides=4)
    out.append(b)
    # stranded fishing boat on the sand (painted wood)
    bt = L.Part('bote_varado', loc=(14, -28, 0), ao=0.0)
    rings = []
    for k, (x, w, z) in enumerate(((-3.2, .5, .5), (-1.6, 1.15, .1), (0, 1.3, 0), (1.6, 1.15, .1), (3.2, .35, .9))):
        rings.append([(x, -w, z + .9), (x, w, z + .9), (x, w * .7, z), (x, -w * .7, z)])
    bt.loft(rings, C['teal'], colors=[C['white'], C['teal'], C['red'], C['teal']], caps=(True, True), ref=lib.Vector((0, 0, .5)))
    out.append(bt)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
