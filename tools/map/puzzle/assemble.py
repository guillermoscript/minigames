"""blender -b -P assemble.py -- sec1 sec2 ...  → assets/map/puzzle/assembled.blend + assembled_preview.png (sections glue by shared coordinates)."""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy
from pz_lib import *
import pz_terrain
secs = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['zulia', 'falcon']
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
x0 = y0 = 1e9; x1 = y1 = -1e9
for s in secs:
    fp = os.path.join(OUT, s + '.blend')
    bpy.ops.wm.append(filepath=os.path.join(fp, 'Collection', s), directory=os.path.join(fp, 'Collection') + os.sep, filename=s)
    r = pz_terrain.SECTIONS[s]['rect']
    x0 = min(x0, r[0]); y0 = min(y0, r[1]); x1 = max(x1, r[2]); y1 = max(y1, r[3])
print('collections', [c.name for c in bpy.data.collections], len(bpy.data.objects))
span = max(x1 - x0, y1 - y0)
setup_scene(((x0 + x1) / 2, -(y0 + y1) / 2, 0), span, azim=0, elev=40, dist_mul=1.5, res=1600)
bpy.context.scene.render.resolution_y = 1100
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'assembled.blend'))
render_to(os.path.join(OUT, 'assembled_preview.png'))
