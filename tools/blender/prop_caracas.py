"""caracas: Parque Central-style twin towers on a podium, plaza + fountain, street grid with downtown blocks. Origin = plaza centre (ccs_start).
Hillside barrio lives in caracas_hillside.glb; the Ávila ridge in avila_ridge.glb."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'caracas'
GROUND = 0x7d9f50
PREVIEW = dict(az=0, pitch=70, fit=1.0)
AO_DIST = 16.0


def facade(p, cx, cy, w, d, z0, z1, floor_h, slab, glass, sides='sew', glass_f=0.58, roof=0xa9aeb8):
    """Window-band facade on the camera-facing sides (s=-Y, e=+X, w=-X); the unseen north side is a single flat wall."""
    h2, d2 = w / 2, d / 2
    corners = {'s': ((-h2, -d2), (h2, -d2)), 'e': ((h2, -d2), (h2, d2)), 'n': ((h2, d2), (-h2, d2)), 'w': ((-h2, d2), (-h2, -d2))}
    ref = lib.Vector((cx, cy, (z0 + z1) / 2))
    n_floors = max(1, round((z1 - z0) / floor_h))
    fh = (z1 - z0) / n_floors
    for sd, (a, b) in corners.items():
        if sd in sides:
            for f in range(n_floors):
                za = z0 + f * fh
                zs = za + fh * (1 - glass_f)
                for (zz0, zz1, col) in ((za, zs, slab), (zs, za + fh, glass)):
                    p.face([(cx + a[0], cy + a[1], zz0), (cx + b[0], cy + b[1], zz0), (cx + b[0], cy + b[1], zz1), (cx + a[0], cy + a[1], zz1)], col, flip_ref=ref)
        else:
            p.face([(cx + a[0], cy + a[1], z0), (cx + b[0], cy + b[1], z0), (cx + b[0], cy + b[1], z1), (cx + a[0], cy + a[1], z1)], slab, flip_ref=ref)
    p.face([(cx - h2, cy - d2, z1), (cx + h2, cy - d2, z1), (cx + h2, cy + d2, z1), (cx - h2, cy + d2, z1)], roof, up=True)


def build(L):
    P = L.P
    rng = random.Random(4)
    out = []

    # --- plaza: paved ring pattern + fountain ---
    pl = L.Part('plaza', ao=0.0)
    pl.disc((0, 0, .3), 12, P['plaza'], rings=3, segs=14, colorfn=lambda x, y: P['plaza'] if (int(math.hypot(x, y) / 4)) % 2 == 0 else 0xc9c0aa)
    pl.frustum((0, 0, 0), 12.4, 12.4, .3, 14, 0xa8a090, bottom=False, top=False)
    pl.frustum((5, -5, .3), 3.2, 2.8, 1.3, 10, P['fount'], bottom=False)
    pl.disc((5, -5, 1.62), 2.4, P['water'], rings=1, segs=10)
    pl.frustum((5, -5, 1.6), .55, .25, 2.2, 5, P['white'], bottom=False, top=False)
    out.append(pl)

    # --- streets (flat strips between the block lattice) ---
    st = L.Part('streets', ao=0.0)
    for y in (-22, -33):
        st.grid((0, y, .12), (92, 3.2), 8, 1, P['asphalt'])
    for x in (-30, -18, -6, 6, 18, 30):
        st.grid((x, -30, .12), (3.2, 30), 1, 3, P['asphalt'])
    st.grid((0, -11, .12), (92, 3.2), 8, 1, P['asphalt'])
    out.append(st)

    # --- twin towers on a podium ---
    tw = L.Part('towers', ao=0.0)
    tw.cbox((24, 17, 0), (46, 17, 3.6), P['concD'], ch=.6, tcolor=0xb4bac4)
    for (x, y, h) in ((14, 17, 54), (34, 17, 48)):
        facade(tw, x, y, 9, 9, 3.6, h - 8, 6.4, P['white'], P['glassL'])
        facade(tw, x, y, 8, 8, h - 8, h - 2, 6.0, P['white'], P['glassL'], glass_f=.5)      # setback
        tw.cbox((x, y, h - 2), (7, 7, 2), P['concD'], ch=.4, tcolor=P['concrete'])             # crown
        tw.box((x, y, h), (2.4, 2.4, 2.0), P['concD'], bottom=False)
        tw.beam((x, y, h + 2), (x, y, h + 9), .2, P['white'], sides=3)
        for sx in (-1, 1):                                                                          # front corner pilasters
            tw.box((x + sx * 4.6, y - 4.6, 3.6), (.9, .9, h - 11), P['band'], bottom=False)
        tw.cbox((x, y, h - 8.6), (9.6, 9.6, .9), P['concrete'], ch=.25)                           # belt
    out.append(tw)

    # --- downtown blocks on a lattice ---
    mb = L.Part('midrise', ao=0.0)
    cols = [-36, -24, -12, 0, 12, 24, 36]
    rows = [-16, -27, -38]
    skip = {(0, -16), (12, -16)}
    for ry in rows:
        for cx in cols:
            if (cx, ry) in skip:
                continue
            w = 8.6 + rng.random() * 1.0
            d = 7.4 + rng.random() * 1.2
            h = 9 + rng.random() * 11
            body = L.CASAS[rng.randrange(len(L.CASAS))]
            facade(mb, cx, ry, w, d, 0, h, 6.6, body, P['glassL'], glass_f=.5)
            if rng.random() < .6:
                mb.box((cx + rng.uniform(-1, 1), ry + rng.uniform(-1, 1), h + .5), (2.2, 2.0, 1.5), P['concD'], bottom=False)
    for cx in (-38, 38):
        facade(mb, cx, 2, 8.6, 8, 0, 12, 6.6, L.CASAS[(cx // 2) % 7], P['glassL'], glass_f=.5)
    out.append(mb)
    return out


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
