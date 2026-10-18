"""blender -b -P run_section.py -- <section> [--noprops]   → assets/map/puzzle/<section>.blend + preview png"""
import sys, os, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['falcon']
sec = args[0]
import bpy
from pz_lib import *
import pz_terrain
t0 = time.time()
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
import pz_lib
col = bpy.data.collections.new(sec); bpy.context.scene.collection.children.link(col); pz_lib.CURRENT = col
W, F, C, cfg = pz_terrain.build_fields(sec)
import pz_sections
plan = pz_sections.prepare(sec, W, F, C, cfg)
terr, wat, info = build_slab(sec, W, F['Z'], C, seed=cfg['seed'], wts=F.get('wts'))
print('terrain', time.time() - t0, len(terr.data.vertices))
if '--noprops' not in args:
    pz_sections.populate(sec, W, F, C, cfg, plan)
from pz_terrain import frame_scene
frame_scene(sec, cfg)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, sec + '.blend'))
render_to(os.path.join(OUT, sec + '_preview.png'))
print('done', time.time() - t0)
