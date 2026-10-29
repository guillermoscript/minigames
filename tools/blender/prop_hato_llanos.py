"""hato_llanos: whitewashed hacienda with tiled gable roof + veranda, board corral with gate, trough, hay, five cows, two shade trees.
Origin = base centre; the front (veranda) faces south."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'hato_llanos'
GROUND = 0xa8b65a
PREVIEW = dict(az=0, pitch=70, fit=0.95)
AO_DIST = 9.0


def cow(L, i, loc, rot, pattern, s=1.0, bull=False):
    """Barrel-shaped cow built from hexagonal rings. pattern: 'a' brown rump / white front, 'b' reverse, 'c' black bull."""
    P = L.P
    c = L.Part('cow_%d' % i, loc=loc, rot=rot, ao=0.0)
    W, B, K = P['cowW'], P['cowB'], P['cowK']
    xs = [-3.3, -2.3, 0.0, 2.2, 3.2]
    rs = [.55, 1.1, 1.18, 1.05, .6]
    zc = 2.35 * s

    def ring(x, r):
        return [(x * s, r * s * math.cos(a), zc + r * s * .95 * math.sin(a) - (0.0 if abs(a) < 9 else 0)) for a in
                [math.pi * 2 * k / 6 + math.pi / 6 for k in range(6)]]
    rings = [ring(x, r) for x, r in zip(xs, rs)]
    for k in range(len(rings) - 1):
        for col in range(6):
            top = col in (0, 1, 2)    # angles 30,90,150 are the upper half
            if pattern == 'c':
                cc = K if top or k % 2 else P['cowB']
            else:
                front = k >= 2
                base = (B if front else W) if pattern == 'b' else (W if front else B)
                cc = base if (top or k in (1, 2)) else W
                if pattern in ('a', 'b') and col == 1 and k == 3:
                    cc = W if base == B else B
            c.face([rings[k][col], rings[k][(col + 1) % 6], rings[k + 1][(col + 1) % 6], rings[k + 1][col]], cc, flip_ref=lib.Vector((0, 0, zc)))
    c.face(list(reversed(rings[0])), B if pattern != 'c' else K, flip_ref=lib.Vector((0, 0, zc)))
    # head: tapered box + muzzle, ears, horns
    hz = zc + .55 * s
    c.loft([[(3.0 * s, y * s, hz + z * s) for y, z in ((-.62, -.55), (.62, -.55), (.62, .6), (-.62, .6))],
            [(4.3 * s, y * s, hz + z * s - .15 * s) for y, z in ((-.5, -.5), (.5, -.5), (.5, .45), (-.5, .45))],
            [(4.75 * s, y * s, hz + z * s - .3 * s) for y, z in ((-.44, -.42), (.44, -.42), (.44, .3), (-.44, .3))]],
           W if pattern != 'c' else K, colors=None, caps=(False, True), ref=lib.Vector((4.0 * s, 0, hz)))
    c.box((4.62 * s, 0, hz - .72 * s), (.3 * s, .9 * s, .5 * s), P['cowK'], bottom=False, top=False)   # muzzle
    for sy in (-1, 1):
        c.beam((3.3 * s, sy * .35 * s, hz + .6 * s), (3.2 * s, sy * .7 * s, hz + 1.5 * s), .09 * s, P['hay'] if not bull else P['hay'], sides=3)  # horns
    for (lx, ly) in ((-2.2, -.75), (-2.2, .75), (2.2, -.75), (2.2, .75)):
        c.beam((lx * s, ly * s, 0.28 * s), (lx * s, ly * s, zc - .25 * s), .26 * s, W if pattern != 'c' else K, sides=4)
    c.beam((-3.1 * s, 0, zc + .5 * s), (-3.7 * s, 0, zc - 1.5 * s), .1 * s, P['cowK'], sides=3)
    return c


def build(L):
    P = L.P
    out = []
    # --- ground: packed-earth yard (irregular), blends into the olive llano ---
    g = L.Part('ground', ao=0.0)

    def yard(x, y):
        e = ((x - 0) / 36.0) ** 2 + (y / 16.0) ** 2
        e += 0.06 * math.sin(x * .7) + 0.05 * math.sin(y * 1.1 + x * .3)
        if e > 0.9:
            return None
        return P['dirt']
    g.grid((0, 0, .06), (74, 34), 16, 7, P['dirt'], colorfn=yard)
    out.append(g)

    # --- house ---
    h = L.Part('house', ao=0.0)
    hx, hw, hd = -17, 16, 9
    h.box((hx, 0, 0), (hw + .6, hd + .6, 1.1), P['zocalo'], bottom=False, top=False)
    h.box((hx, 0, 1.1), (hw, hd, 3.2), P['wall'], bottom=False)
    h.box((hx, -hd / 2 - 2.2, 0), (hw, 4.4, .35), P['stone'], bottom=False)               # veranda slab
    h.gable((hx, 0, 4.3), hw, hd, 3.6, P['teja'], P['tejaL'], strips=4, overhang=.7)
    h.box((hx + 4.5, 1.2, 6.2), (1.3, 1.3, 3.2), P['stone'], bottom=False)                   # chimney
    # veranda lean-to roof
    for k in range(3):
        y0, y1 = -hd / 2 - 3.9 + k * .0, 0
    ya, yb = -hd / 2 - .6, -hd / 2 - 4.6
    for k in range(3):
        t0, t1 = k / 3, (k + 1) / 3
        h.face([(hx - hw / 2 - .5, ya + (yb - ya) * t0, 4.2 - 1.3 * t0), (hx + hw / 2 + .5, ya + (yb - ya) * t0, 4.2 - 1.3 * t0),
                (hx + hw / 2 + .5, ya + (yb - ya) * t1, 4.2 - 1.3 * t1), (hx - hw / 2 - .5, ya + (yb - ya) * t1, 4.2 - 1.3 * t1)],
               P['teja'] if k % 2 == 0 else P['tejaL'], up=True)
    for px in (-7.5, -2.5, 2.5, 7.5):
        h.box((hx + px, -hd / 2 - 4.1, .35), (.55, .55, 2.6), P['wood'], bottom=False)
    h.box((hx, -hd / 2 - .02, 1.1), (2.6, .3, 2.5), P['door'], bottom=False, top=False)
    for wx in (-5, 5):
        h.box((hx + wx, -hd / 2 - .02, 1.7), (2.0, .3, 1.7), P['glass'], bottom=False, top=False)
        for sx in (-1.4, 1.4):
            h.box((hx + wx + sx, -hd / 2 - .05, 1.6), (.5, .3, 1.9), P['shutter'], bottom=False, top=False)
    out.append(h)

    # --- corral ---
    cr = L.Part('corral', ao=0.0)
    cx, cy, w, d = 15, 0, 26, 20
    gate = (cx - 3.2, cx + 3.2)
    pts = [(cx - w / 2, cy - d / 2), (cx + w / 2, cy - d / 2), (cx + w / 2, cy + d / 2), (cx - w / 2, cy + d / 2)]
    nx, ny = 4, 3
    posts = set()
    for i in range(nx + 1):
        posts.add((round(cx - w / 2 + w * i / nx, 2), cy - d / 2)); posts.add((round(cx - w / 2 + w * i / nx, 2), cy + d / 2))
    for j in range(ny + 1):
        posts.add((cx - w / 2, round(cy - d / 2 + d * j / ny, 2))); posts.add((cx + w / 2, round(cy - d / 2 + d * j / ny, 2)))
    posts.add(gate and (gate[0], cy - d / 2)); posts.add((gate[1], cy - d / 2))
    for (x, y) in sorted(posts):
        cr.box((x, y, 0), (.8, .8, 3.5), P['woodD'], bottom=False)
    for zr in (1.0, 1.9, 2.8):
        for k in range(4):
            a, b = pts[k], pts[(k + 1) % 4]
            if k == 0:   # south side with a gate opening
                segs = [((a[0], a[1]), (gate[0], a[1])), ((gate[1], a[1]), (b[0], b[1]))]
            else:
                segs = [(a, b)]
            for (p0, p1) in segs:
                ln = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
                ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
                cr.box(((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, zr - .12), (ln, .22, .26), P['wood'], rz=ang, bottom=False, top=False)
    cr.box((cx + 4.5, cy + 6.5, 0), (6, 1.8, 1.0), P['wood'], bottom=False, tcolor=P['water'])
    cr.cbox((cx - 8, cy + 6.5, 0), (3.2, 1.6, 1.5), P['hay'], ch=.25, tcolor=P['hayD'])
    cr.cbox((cx - 4.8, cy + 7.2, 0), (2.4, 1.6, 1.2), P['hay'], ch=.25, tcolor=P['hayD'])
    out.append(cr)

    out.append(cow(L, 1, (cx - 6, -3, 0), .4, 'a'))
    out.append(cow(L, 2, (cx + 1, 3, 0), -.35, 'b'))
    out.append(cow(L, 3, (cx + 8, -4.5, 0), 2.9, 'a'))
    out.append(cow(L, 4, (cx - 3.5, 3.5, 0), 3.5, 'b'))
    out.append(cow(L, 5, (cx + 7.5, 3.5, 0), .15, 'c', s=1.15, bull=True))

    tr = L.Part('trees', ao=0.0)
    for (x, y, k) in ((-30, 9, 1.0), (30, -12, 1.15)):
        tr.frustum((x, y, 0), .95 * k, .65 * k, 4.4 * k, 6, P['trunk'], bottom=False)
        for (ox, oy, oz, rr) in ((.8, 0, 6.8, 4.3), (-2.2, .8, 5.5, 3.1)):
            tr.ico((x + ox * k, y + oy * k, oz * k), rr * k, P['selva'], sub=1, sc=(1.05, 1.05, .8), jitter=.1, seed=int(x + oz), tcolor=P['selvaL'])
    out.append(tr)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
