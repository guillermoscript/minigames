"""represa_guri: curved concrete arch-gravity dam (bulges north/upstream), stepped spillway chute 'vertedero', powerhouse, penstocks, lake edge 'lago'. ~70 wide. Front faces -Y (downstream)."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

NAME = 'represa_guri'
GROUND = 0x8aa05a
PREVIEW = dict(az=0, pitch=70, fit=1.0)
AO_DIST = 16.0
R, CY, HW = 46.0, -40.0, 20.0     # arc radius, arc centre y, wall height
T0 = math.radians(47)
CONC, CONCD, CONCL = 0xc4c8cf, 0x969ca8, 0xdde0e6


def pt(t, d, z):
    r = R + d
    return (r * math.sin(t), CY + r * math.cos(t), z)


def build(L):
    P = L.P
    V = lib.Vector
    NS = 14
    ts = [-T0 + 2 * T0 * i / NS for i in range(NS + 1)]
    w = L.Part('muro', ao=0.0)
    sec = [(1.2, 0), (0.5, HW), (-2.5, HW), (-8.0, 0)]
    rings = [[pt(t, d, z) for d, z in sec] for t in ts]
    w.loft(rings, CONC, colors=[CONCD, CONCL, CONC, CONCD], caps=(True, True), ref=V((0, CY + R - 3, HW / 2)))
    # crest road + parapet
    for i in range(NS):
        a, b = ts[i], ts[i + 1]
        w.face([pt(a, -2.3, HW + .05), pt(b, -2.3, HW + .05), pt(b, .3, HW + .05), pt(a, .3, HW + .05)], 0x5a606c, up=True)
        w.face([pt(a, .3, HW), pt(b, .3, HW), pt(b, .3, HW + 1.0), pt(a, .3, HW + 1.0)], CONCL, flip_ref=V(pt((a + b) / 2, 5, HW)))
        w.face([pt(a, .3, HW + 1.0), pt(b, .3, HW + 1.0), pt(b, -.5, HW + 1.0), pt(a, -.5, HW + 1.0)], CONCL, up=True)
    # buttress ribs on the downstream face
    for i in range(1, NS, 2):
        t = ts[i]
        w.loft([[pt(t - .018, -2.5, HW), pt(t + .018, -2.5, HW), pt(t + .018, -8.0, 0), pt(t - .018, -8.0, 0)],
                [pt(t - .018, -3.4, HW - 1), pt(t + .018, -3.4, HW - 1), pt(t + .018, -8.3, 0), pt(t - .018, -8.3, 0)]], CONCD, closed=True, ref=V(pt(t, -5, HW / 2)))
    # intake towers on the lake side
    for i in (3, 7, 11):
        t = ts[i]
        x, y, _ = pt(t, 3.2, 0)
        w.cbox((x, y, 0), (3.2, 3.2, HW + 3.4), CONCL, ch=.4, rz=-t, tcolor=0xe9ecf0)
    # penstocks: pipes down the face into the powerhouse
    pn = L.Part('penstocks', ao=0.0)
    for i in (4, 6, 8, 10):
        t = ts[i]
        a = pt(t, -2.5, HW - 3)
        b = pt(t, -17, 6.5)
        pn.beam(a, b, 1.15, 0x7a828f, sides=6)
        c = pt(t, -17, 6.5)
    # powerhouse
    ph = L.Part('casa_de_maquinas', ao=0.0)
    ph.cbox((0, CY + R - 20.5, 0), (34, 7.5, 7.4), CONCL, ch=.5, tcolor=CONC)
    ph.gable((0, CY + R - 20.5, 7.4), 34, 7.5, 1.9, 0x4f8ca6, color2=0x3f7a94, overhang=.35)
    for k in range(7):
        ph.box((-14.4 + k * 4.8, CY + R - 24.35, 1.4), (2.0, .3, 3.2), 0x3a4a60)
    for sx in (-1, 1):    # tailrace walls
        ph.cbox((sx * 18.5, CY + R - 22, 0), (3, 12, 4.5), CONCD, ch=.4, tcolor=CONC)
    # spillway chute (east side) built as steps: concrete + white water 'vertedero'
    sp = L.Part('vertedero_cauce', ao=0.0)
    ve = L.Part('vertedero', ao=0.0)
    t = ts[10]
    ang = t
    sx_, sy_, _ = pt(t, -2.5, 0)
    dx, dy = math.sin(ang) * -1, math.cos(ang) * -1     # downstream direction
    ox, oy = math.cos(ang), -math.sin(ang)               # across
    NSTEP, SL, SW = 6, 5.0, 4.4
    def P_(s, c, z):
        return (sx_ + dx * s + ox * c, sy_ + dy * s + oy * c, z)
    for k in range(NSTEP):
        z_top = HW - 1.0 - k * (HW - 2.0) / NSTEP
        z_bot = z_top - (HW - 2.0) / NSTEP
        s0, s1 = k * SL, (k + 1) * SL
        # concrete step block
        sp.poly_prism([P_(s0, -SW - 1.2, 0)[:2], P_(s1, -SW - 1.2, 0)[:2], P_(s1, SW + 1.2, 0)[:2], P_(s0, SW + 1.2, 0)[:2]], 0, z_top - 0.4, CONC, tcolor=CONCD)
        for sg in (-1, 1):
            sp.poly_prism([P_(s0, sg * (SW + .2), 0)[:2], P_(s1, sg * (SW + .2), 0)[:2], P_(s1, sg * (SW + 1.5), 0)[:2], P_(s0, sg * (SW + 1.5), 0)[:2]], 0, z_top + 1.4, CONCL, tcolor=0xe9ecf0)
        # water on the tread + falling riser
        ve.face([P_(s0, -SW, z_top), P_(s1 - 1.0, -SW, z_top), P_(s1 - 1.0, SW, z_top), P_(s0, SW, z_top)], P['fall'], shade=1.0, up=True)
        ve.face([P_(s1 - 1.0, -SW, z_top), P_(s1 + .2, -SW, z_bot + .2), P_(s1 + .2, SW, z_bot + .2), P_(s1 - 1.0, SW, z_top)], 0xd6ecf8, shade=1.0, flip_ref=V(P_(s1 + 4, 0, z_top)))
    # splash pool at the foot
    ex = P_(NSTEP * SL + 3.5, 0, 0.3)
    ve.disc(ex, 6.0, P['water'], rings=2, segs=10)
    for (a_, b_, c_) in ((-2, 0, 1.4), (2, 1, 1.2), (0, 3, 1.1)):
        ve.ico((ex[0] + a_, ex[1] + b_, 1.0), c_, P['white'], sub=0, sc=(1.3, 1.3, .8), jitter=.1, seed=int(a_ + 5))
    # lake (north / upstream)
    lk = L.Part('lago', ao=0.0)
    M = 20
    outer = []
    for i in range(M + 1):
        t = -T0 - .25 + (2 * T0 + .5) * i / M
        rr = R + 4 + 8 + 4 * math.sin(i * 1.3) + 3 * math.sin(i * .5)
        outer.append((rr * math.sin(t) * 0.92, CY + rr * math.cos(t), HW - 3.0))
    inner = [(pt(-T0 - .25 + (2 * T0 + .5) * i / M, 1.0, HW - 3.0)) for i in range(M + 1)]
    for i in range(M):
        lk.face([inner[i], inner[i + 1], outer[i + 1], outer[i]], P['water'], up=True)
    # rocky abutments
    ab = L.Part('estribos', ao=0.0)
    for sg in (-1, 1):
        bx, by, _ = pt(sg * T0, -2, 0)
        ab.ico((bx + sg * 6, by + 2, 0), 12, 0x7d6a52, sub=1, sc=(1.0, 1.1, 1.35), jitter=.15, seed=3 + sg, tcolor=0x6f8a4c, cut_below=-.2)
        ab.ico((bx + sg * 15, by - 6, 0), 8, 0x7d6a52, sub=1, sc=(1, 1, 1.0), jitter=.15, seed=7 + sg, tcolor=0x4f7a3e, cut_below=-.2)
        ab.ico((bx + sg * 12, by + 12, 0), 8, 0x7d6a52, sub=1, sc=(1, 1, .9), jitter=.15, seed=9 + sg, tcolor=0x4f7a3e, cut_below=-.2)
    return [w, pn, ph, sp, ve, lk, ab]


if __name__ == '__main__':
    lib.run(sys.modules[__name__])
