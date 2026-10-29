"""Print per-mesh info of a .glb: accessor counts, tri counts and COLOR_0 ranges. Usage: python3 inspect_glb.py file.glb"""
import struct, json, sys
for path in sys.argv[1:]:
    b = open(path, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    tris = 0
    print(path, len(b) // 1024, 'KB')
    for n in j['nodes']:
        if 'mesh' not in n:
            continue
        pr = j['meshes'][n['mesh']]['primitives'][0]
        t = j['accessors'][pr['indices']]['count'] // 3
        tris += t
        c = j['accessors'][pr['attributes']['COLOR_0']]
        print('  ', n['name'], t, 'tris', 'color', c.get('min'), c.get('max'), c['componentType'], 'T' if 'translation' in n else '')
    print('  total tris', tris, 'images', len(j.get('images', [])), 'cams', len(j.get('cameras', [])))
