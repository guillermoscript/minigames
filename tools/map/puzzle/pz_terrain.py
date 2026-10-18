"""Heightfield + biome colours for a puzzle section. Deterministic in world coordinates (seams match)."""
import numpy as np
from pz_lib import *

# ── sections (layout frame). Neighbouring tiles share an edge coordinate. ──
SECTIONS = {
    'andes': dict(
        rect=(360, 820, 800, 1150), seed=37, alpine=True,
        blobs=[('mount', 470, 893, 95, 1.45), ('mount', 395, 955, 70, 1.15), ('mount', 565, 850, 62, 1.0), ('mount', 705, 880, 70, 0.75),
               ('mount', 430, 1040, 42, 0.5)],
        green_from=(5000, 5001),
        river=[(478, 925), (500, 960), (540, 990), (556, 1030), (598, 1062), (640, 1090), (650, 1150)],
        override={'and_picoespejo': (470, 893), 'and_losnevados': (548, 945), 'and_merida': (700, 1030), 'and_ejido': (590, 1040), 'and_elvigia': (410, 1085)}),
    'falcon': dict(
        rect=(620, 80, 1190, 640), seed=11,
        # (kind, x, y, radius, strength)   kinds: desert, mount, scrub   (frame of pinned/layout.json)
        blobs=[('desert', 820, 255, 120, 1.0), ('desert', 765, 180, 110, 1.0), ('desert', 675, 340, 115, 0.9),
               ('desert', 650, 205, 70, 0.7),
               ('mount', 770, 168, 18, 1.2), ('mount', 925, 375, 80, 1.0), ('mount', 870, 460, 70, 0.7),
               ('mount', 1100, 505, 90, 0.9), ('mount', 1030, 280, 45, 0.5)],
        green_from=(280, 480)),
    'zulia': dict(
        rect=(150, 200, 620, 820), seed=23,
        blobs=[('desert', 235, 300, 125, 1.0), ('desert', 390, 340, 90, 0.8), ('desert', 580, 290, 80, 0.7),
               ('scrub', 320, 500, 70, 0.8),
               ('mount', 175, 600, 100, 1.0), ('mount', 440, 810, 90, 1.0), ('mount', 220, 740, 80, 0.7)],
        green_from=(480, 700)),
}

CAMS = {'andes': dict(az=0, dx=0, dy=-10, dist=2.15, elev=40), 'falcon': dict(az=0, dx=-70, dy=45, dist=1.9, elev=40), 'zulia': dict(az=180, dx=15, dy=0, dist=2.1, elev=40)}

SAND = [hexc(0xf1d690), hexc(0xe3bd70), hexc(0xc9985a)]
GRASS = [hexc(0x86a04a), hexc(0x6f8c3e), hexc(0x587a36)]
SCRUB = hexc(0x9aa44e)
ROCKC = [hexc(0xb8976a), hexc(0xc9a878), hexc(0x9a7d58)]
BEACH = hexc(0xf6e6b4)
SEABED = hexc(0xc9c090)


def fields(W, cfg):
    X, Y, d = W.X, W.Y, W.d
    seed = cfg['seed']
    desert = np.zeros_like(X); mount = np.zeros_like(X); scrub = np.zeros_like(X)
    for kind, bx, by, r, s in cfg['blobs']:
        g = s * np.exp(-(((X - bx) ** 2 + (Y - by) ** 2) / (2 * (r * (1.45 if kind == 'desert' else 1.0)) ** 2)))
        if kind == 'desert':
            desert = np.maximum(desert, g)
        elif kind == 'mount':
            mount = np.maximum(mount, g)
        else:
            scrub = np.maximum(scrub, g)
    y0, y1 = cfg['green_from']
    # desert fades into green southwards
    dry = sstep(0.35, 0.55, fbm(X / 150, Y / 150, seed + 12, 3)) * 1.0 * (1 - sstep(y0, y1, Y))
    desert = np.clip(np.maximum(desert, dry) * (1 - 0.35 * sstep(y0, y1, Y)) * 1.25, 0, 1)
    desert = np.clip(desert + 0.25 * (fbm(X / 80, Y / 80, seed + 2, 3) - 0.5), 0, 1) * (desert > 0.02)
    inl = sstep(6, 40, d)
    alpine = cfg.get('alpine', False)
    if alpine:
        desert = desert * 0
    rolling = (fbm(X / 130, Y / 130, seed, 3) - 0.5) * 6.0
    hills = mount * (5 + 24 * ridged(X / 120, Y / 120, seed + 3, 3)) * (0.5 + 0.5 * fbm(X / 170, Y / 170, seed + 4, 2))
    ang = 0.5 + 0.9 * (fbm(X / 260, Y / 260, seed + 8, 2) - 0.5)
    tt = (X * np.cos(ang) + Y * np.sin(ang)) / 72.0 + 1.5 * fbm(X / 120, Y / 120, seed + 6, 3) + 0.5 * fbm(X / 45, Y / 45, seed + 9, 2)
    fr = tt - np.floor(tt)
    prof = (sstep(0.0, 0.7, fr) * (1 - sstep(0.7, 1.0, fr))) ** 1.25      # long windward rise, shorter slip face
    crest = prof
    core = sstep(0.38, 0.78, desert)
    fieldm = sstep(0.42, 0.58, fbm(X / 170, Y / 170, seed + 15, 2))             # dune fields alternate with near-flat sand
    dunes = core * fieldm * (1 - np.clip(mount, 0, 1) * 0.7) * (1.8 + 4.6 * sstep(0.38, 0.62, fbm(X / 150, Y / 150, seed + 7, 2))) * prof
    if alpine:
        hills = mount * (14 + 120 * ridged(X / 120, Y / 120, seed + 3, 4)) * (0.55 + 0.45 * fbm(X / 150, Y / 150, seed + 4, 2))
        rolling = (fbm(X / 70, Y / 70, seed, 4) - 0.5) * 14.0
        dunes = dunes * 0
    soft = rolling * 0.6 + dunes
    for _ in range(4):                                              # blur: remove small crumples, keep broad forms
        soft = (soft + np.roll(soft, 1, 0) + np.roll(soft, -1, 0) + np.roll(soft, 1, 1) + np.roll(soft, -1, 1)) / 5.0
    beachw = 5.0 + 11.0 * sstep(0.3, 0.7, fbm(X / 50, Y / 50, seed + 5, 2))
    h_land = 3.0 * (1 - np.exp(-d / (0.7 * beachw + 3))) + (soft + hills) * inl
    depth_sea = -14.0 * (1 - np.exp(-d / 20.0))
    depth_lake = -14.0 * (1 - np.exp(-d / 20.0))
    Z = np.where(W.land, h_land, np.where(W.lake, depth_lake, depth_sea))
    return dict(Z=Z, desert=desert, mount=mount, scrub=scrub, dunes=dunes, crest=crest, hills=hills, inl=inl)


def colors(W, cfg, F):
    X, Y, d, Z = W.X, W.Y, W.d, F['Z']
    seed = cfg['seed']
    gy, gx = np.gradient(Z, W.c)
    slope = np.hypot(gx, gy)
    n1 = fbm(X / 14, Y / 14, seed + 40, 3)
    n2 = fbm(X / 40, Y / 40, seed + 41, 3)
    sand = SAND[1][None, None] * np.ones(Z.shape + (1,))
    cr = F['crest'][..., None]
    sand = SAND[2] + (SAND[0] - SAND[2]) * cr
    sand = sand * (0.94 + 0.12 * n1[..., None])
    grass = GRASS[1] * np.ones(Z.shape + (1,))
    g2 = sstep(0.3, 0.7, n2)[..., None]
    grass = (GRASS[2] + (GRASS[0] - GRASS[2]) * g2) * (0.93 + 0.14 * n1[..., None])
    scrub = SCRUB * (0.92 + 0.16 * n1[..., None])
    w_sand = sstep(0.18, 0.5, F['desert'])[..., None]
    w_scrub = np.clip(F['scrub'] + 0.35 * (1 - F['desert']) * sstep(0.2, 0.0, n2) , 0, 1)[..., None] * (1 - w_sand)
    col = grass * (1 - w_sand) + sand * w_sand
    col = col * (1 - w_scrub) + scrub * w_scrub
    forest = sstep(0.32, 0.62, fbm(X / 48, Y / 48, seed + 90, 3)) * np.clip(1.25 - F['desert'] * 2.4, 0, 1)
    floor_c = hexc(0x4b6a32) * (0.9 + 0.2 * n1[..., None])
    col = col * (1 - 0.55 * forest[..., None]) + floor_c * 0.55 * forest[..., None]
    dirt = sstep(0.62, 0.72, fbm(X / 22, Y / 22, seed + 77, 3)) * (1 - F['desert']) * sstep(5, 15, d)
    col = col * (1 - 0.7 * dirt[..., None]) + hexc(0xb08c5a) * 0.7 * dirt[..., None]
    rockw = np.clip((slope - 0.42) * 2.4, 0, 1) * sstep(3, 9, Z) * 0.8 + np.clip((F['mount'] - 0.55) * 1.6, 0, 1) * sstep(10, 26, Z)
    rockw = np.clip(rockw, 0, 1)
    r2 = sstep(0.3, 0.7, n1)[..., None]
    rockc = (ROCKC[2] + (ROCKC[1] - ROCKC[2]) * r2) if not cfg.get('alpine') else (hexc(0x77736e) + (hexc(0xa39d94) - hexc(0x77736e)) * r2)
    col = col * (1 - rockw[..., None]) + rockc * rockw[..., None]
    beach = sstep(4.0 + 16.0 * sstep(0.3, 0.7, fbm(X / 50, Y / 50, seed + 5, 2)), 2.0, d) * (1 - np.clip((Z - 3.6) / 2.0, 0, 1))
    wet = sstep(-0.5, 1.5, Z) * 0 + 1.0
    col = np.where(W.land[..., None], col * (1 - beach[..., None]) + BEACH * beach[..., None], BEACH + (SEABED - BEACH) * sstep(0, 14, d)[..., None])
    snow = sstep(54, 66, Z + 6 * (n1 - 0.5)) * sstep(2.6, 1.0, slope) if cfg.get('alpine') else np.zeros_like(Z)
    col = col * (1 - snow[..., None]) + hexc(0xf2f6fb) * snow[..., None]
    F['snow'] = snow
    ws = w_sand[..., 0] * (1 - rockw); wg = (1 - w_sand[..., 0]) * (1 - rockw) * (1 - beach)
    wts = np.stack([ws + (1 - ws - wg - rockw), wg, rockw], -1)
    F['wts'] = wts * (1 - snow[..., None]) + np.array([0.0, 0.0, 1.0]) * snow[..., None]
    return np.clip(col, 0, 1)


def build_fields(sec, c=2.0):
    cfg = SECTIONS[sec]
    W = World(cfg['rect'], c)
    F = fields(W, cfg)
    C = colors(W, cfg, F)
    return W, F, C, cfg


def build_terrain(name, sec, c=2.0):
    cfg = SECTIONS[sec]
    W = World(cfg['rect'], c)
    F = fields(W, cfg)
    C = colors(W, cfg, F)
    terr, wat, info = build_slab(name, W, F['Z'], C, seed=cfg['seed'], wts=F.get('wts'))
    return W, F, C, terr, wat, info, cfg


def frame_scene(sec, cfg, samples=48, cycles=True, res=1254):
    c = CAMS.get(sec, dict(az=0, dx=0, dy=0, dist=1.9, elev=40))
    x0, y0, x1, y1 = cfg['rect']
    sgn = 1 if c['az'] == 0 else -1
    setup_scene(((x0 + x1) / 2 + c['dx'], -(y0 + y1) / 2 - c['dy'] * sgn, 0), (x1 - x0), azim=c['az'], elev=c['elev'], dist_mul=c['dist'], cycles=cycles, samples=samples, res=res)
