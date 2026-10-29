"""Rebuild every landmark prop: blender -b -P tools/blender/build_all.py
Writes assets/models/*.glb, assets/blender/*.blend and assets/blender/previews/*.png."""
import sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

PROPS = ['maracaibo_bridge', 'caracas', 'caracas_hillside', 'avila_ridge', 'angel_falls_tepui', 'hato_llanos', 'teleferico',
         'mochima_rocks', 'oil_derricks', 'trees']
if __name__ == '__main__':
    only = [a for a in sys.argv[sys.argv.index('--') + 1:]] if '--' in sys.argv else PROPS
    for n in only:
        mod = importlib.import_module('prop_' + n)
        lib.run(mod)
