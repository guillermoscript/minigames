"""blender -b -P rerender.py -- <section> [eevee]  → re-frame and re-render an existing section .blend (fast look iteration)."""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy
from pz_lib import *
import pz_terrain
args = sys.argv[sys.argv.index('--') + 1:]
sec = args[0]
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, sec + '.blend'))
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT') or o.name in ('Tgt',):
        bpy.data.objects.remove(o, do_unlink=True)
pz_terrain.frame_scene(sec, pz_terrain.SECTIONS[sec], cycles=('eevee' not in args))
render_to(os.path.join(OUT, sec + '_preview.png'))
