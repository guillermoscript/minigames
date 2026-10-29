'use strict';
/* Isla de Margarita · el mapa: silueta real (Oriente + Macanao unidas por La Restinga, la laguna con manglares, Coche y Cubagua),
   rutas por pueblos reales con bifurcaciones (la costa larga con la venta de empanadas vs el atajo), terreno pixel a pixel con cerros,
   y decorado animado. Expone MAPA (lo usa margarita.js). Coordenadas en pixeles lógicos de 640x360. */
const MAPA = (function () {
let sd = 20261025;
const sr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;

/* ───────── ruido de valor (terreno) ───────── */
function h2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function ruido(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => ruido(x, y) * .6 + ruido(x * 2.1, y * 2.1) * .3 + ruido(x * 4.3, y * 4.3) * .1;

/* ───────── siluetas ───────── */
const POLI = {
  O: [[294, 172], [298, 140], [310, 112], [322, 94], [336, 100], [350, 80], [380, 70], [420, 62], [456, 52], [490, 46], [520, 40], [548, 46], [562, 62], [588, 80], [610, 104], [624, 140], [612, 170], [604, 186], [618, 214], [608, 248], [588, 272], [554, 288], [522, 302], [480, 296], [440, 304], [400, 300], [364, 304], [332, 294], [300, 285], [286, 258], [292, 234], [284, 210]],
  W: [[214, 166], [228, 194], [220, 222], [228, 250], [212, 282], [190, 296], [160, 306], [130, 302], [102, 310], [70, 302], [44, 290], [22, 266], [10, 236], [14, 206], [28, 184], [52, 164], [86, 152], [120, 148], [154, 142], [184, 148], [204, 154]],
  I: [[202, 152], [298, 160], [300, 174], [250, 176], [206, 168]],
  C: [[226, 324], [250, 316], [292, 316], [324, 322], [334, 334], [308, 346], [262, 350], [230, 346], [216, 336]],
  K: [[140, 338], [158, 332], [170, 340], [152, 347]]
};
const MANGLES = [[236, 214, 6], [262, 226, 6], [284, 206, 5], [232, 238, 4], [258, 198, 3]];
const CERROS = [
  { x: 174, y: 272, r: 8, h: .9 }, { x: 189, y: 274, r: 8, h: .9 },
  { x: 412, y: 182, r: 42, h: 1 }, { x: 500, y: 158, r: 30, h: .8 }, { x: 372, y: 112, r: 24, h: .55 },
  { x: 104, y: 228, r: 40, h: 1.05 }, { x: 156, y: 210, r: 26, h: .7 }, { x: 52, y: 214, r: 22, h: .55 }
];
const PORLAMAR = { x: 528, y: 238, r: 38 }, SALINA = { x: 60, y: 252 };
/* el interior: la Margarita real es semiárida (sabana y cardonal) y solo los cerros son verdes; El Copey tiene bosque nublado */
const COPEY = { x: 412, y: 180, r: 24 }, EMBALSE = { x: 350, y: 214, rx: 12, ry: 6 };
const PUEBLOS = [
  { nom: 'LA ASUNCION', x: 446, y: 112, n: 7, colonial: true }, { nom: 'SAN JUAN BAUTISTA', x: 376, y: 252, n: 6, colonial: true },
  { nom: 'PARAGUACHI', x: 542, y: 126, n: 5, colonial: true }, { nom: 'LOS MILLANES', x: 398, y: 104, n: 4 },
  { nom: 'TACARIGUA', x: 330, y: 238, n: 4 }, { nom: 'SAN FRANCISCO', x: 108, y: 160, n: 4, colonial: true }, { nom: 'BOCA DE POZO', x: 58, y: 178, n: 3 }
];
const CONUCOS = [[396, 264, 22, 10, 'maiz'], [422, 272, 16, 8, 'yuca'], [522, 108, 18, 9, 'maiz'], [560, 140, 12, 8, 'yuca'], [150, 154, 18, 8, 'melon'], [340, 252, 14, 8, 'maiz']];
function humedad(x, y) { return altura(x, y) + (fbm(x * .03 + 40, y * .03) - .5) * .9; }
const LAGUNA = { x: 256, y: 232, rx: 46, ry: 50 };
const enLaguna = (x, y) => Math.hypot((x - LAGUNA.x) / LAGUNA.rx, (y - LAGUNA.y) / LAGUNA.ry) < 1 + (fbm(x * .07, y * .07) - .5) * .5;
function distPoli(px, py, P) {
  let dmin = 1e9, dentro = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) dentro = !dentro;
    const dx = xj - xi, dy = yj - yi, t = clamp(((px - xi) * dx + (py - yi) * dy) / (dx * dx + dy * dy), 0, 1);
    dmin = Math.min(dmin, Math.hypot(px - xi - dx * t, py - yi - dy * t));
  }
  return dentro ? -dmin : dmin;
}
function altura(x, y) {
  let h = 0;
  for (const c of CERROS) { const d = Math.hypot(x - c.x, y - c.y) / c.r; if (d < 2) h += c.h * Math.exp(-d * d * 1.6); }
  return h + (fbm(x * .05, y * .05) - .5) * .35;
}

/* ───────── rutas: el grafo (casillas, caminos, cruces, puestos, lugares) vive en margarita-grafo.js, que lo comparte con
   las reglas y el servidor. Se arma con la misma semilla, así que el decorado sigue la secuencia justo donde el grafo la dejó. ───────── */
const G = window.MARGA.grafo;
const { nodos, J, SEGS, TRAZOS, PEAJES, ISLAS, PUESTOS, COCHE, NPCS, rutaBote } = G;
sd = G.sd;

/* ───────── fondo: terreno pixel a pixel + caminos ───────── */
const fondo = document.createElement('canvas'); fondo.width = W; fondo.height = H;
const espuma = [], olas = [];
(function () {
  const f = fondo.getContext('2d'), img = f.createImageData(W, H), d = img.data;
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const C = {};
  ['hondo:#163f72', 'hondo2:#1a4a82', 'medio:#21609e', 'bajo:#2e86c2', 'orilla:#6cc8e6', 'lag:#3fb3b0', 'lag2:#57c6bc', 'arena:#f4d690', 'arena2:#e6c070', 'arenaH:#d9ae5c',
    'verde:#5fb34e', 'verde2:#4c9e40', 'monte:#3d8a3a', 'monte2:#2f7430', 'cerroL:#7cc65e', 'cerroD:#3a7a34',
    'seco:#c4ab64', 'seco2:#b29854', 'secoD:#987a44', 'secoL:#dcc684', 'roca:#8a6a48',
    'sal:#f2f0e6', 'sal2:#e2dccc', 'sab:#b4b25e', 'sab2:#a4a252', 'sabV:#92ae4e', 'sabV2:#84a046', 'nub:#2a6a3a', 'nub2:#22582f', 'nubL:#3f8a48', 'lago:#3a90c8', 'lago2:#56a8d8', 'surco:#8a6a3a', 'mata:#5aa040', 'maiz:#d8c050', 'melon:#7ab040', 'plaza:#d8c8a0', 'mangle:#2e6a3a', 'mangle2:#3f8048', 'ciudad:#c9bfae', 'ciudad2:#b3a894', 'calle:#8f8778'].forEach((s) => { const [k, v] = s.split(':'); C[k] = hex(v); });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = fbm(x * .09, y * .09) * 5 - 2.5;
    const dO = distPoli(x, y, POLI.O) + n, dW = distPoli(x, y, POLI.W) + n, dI = distPoli(x, y, POLI.I) + n * .6;
    const dC = distPoli(x, y, POLI.C) + n * .5, dK = distPoli(x, y, POLI.K) + n * .4;
    let dm = 1e9; for (const m of MANGLES) dm = Math.min(dm, Math.hypot(x - m[0], y - m[1]) - m[2] + n * .5);
    const dd = Math.min(dO, dW, dI, dC, dK, dm), dith = (x + y) & 1;
    const arenaW = 3 + fbm(x * .04 + 9, y * .04) * 6 + (y < 92 && x > 420 && x < 580 ? 4 : 0) + (x < 40 ? 3 : 0);
    let c;
    if (dd < 0) {
      if (dm === dd) c = dd < -1.5 ? (h2(x, y) < .3 ? C.mangle2 : C.mangle) : C.arena2;
      else if (dI === dd || dC === dd || dK === dd) c = dd < -arenaW - 2 && dC === dd ? C.verde2 : (dith && dd > -1 ? C.arena2 : C.arena);
      else if (dd > -arenaW) c = dd > -1.2 ? C.arenaH : (h2(x, y) < .08 ? C.arena2 : C.arena);
      else {
        const seca = dW < dO, hh = altura(x, y), lado = altura(x - 1, y - 1) - altura(x + 1, y + 1), v = fbm(x * .15, y * .15);
        if (seca) {
          if (Math.hypot((x - SALINA.x) / 14, (y - SALINA.y) / 8) < 1 + (fbm(x * .2, y * .2) - .5) * .4) c = h2(x, y) < .15 ? C.sal2 : C.sal;
          else if (hh > .45) c = lado > .025 ? C.secoL : lado < -.025 ? C.secoD : (hh > .8 && v > .6 ? C.roca : C.seco2);
          else if (x < 46 && fbm(x * .1, y * .1) > .55) c = (x + y * 2) % 7 < 2 ? C.arena2 : C.arena;
          else c = v > .62 ? C.seco2 : (h2(x, y) < .05 ? C.secoD : C.seco);
        } else {
          const urb = Math.hypot(x - PORLAMAR.x, y - PORLAMAR.y) / PORLAMAR.r;
          if (urb < 1 - (v - .5) * .4) c = (x % 9 === 0 || y % 8 === 0) ? C.calle : (h2(x, y) < .2 ? C.ciudad2 : C.ciudad);
          else if (Math.hypot((x - EMBALSE.x) / EMBALSE.rx, (y - EMBALSE.y) / EMBALSE.ry) < 1 + (v - .5) * .3) c = Math.hypot((x - EMBALSE.x) / EMBALSE.rx, (y - EMBALSE.y) / EMBALSE.ry) > .8 ? C.lago2 : C.lago;
          else if (CONUCOS.some((q) => x >= q[0] && x < q[0] + q[2] && y >= q[1] && y < q[1] + q[3])) { const q = CONUCOS.find((z) => x >= z[0] && x < z[0] + z[2] && y >= z[1] && y < z[1] + z[3]); c = (y - q[1]) % 3 === 0 ? C.surco : q[4] === 'maiz' ? (h2(x, y) < .5 ? C.maiz : C.mata) : C.mata; }
          else if (PUEBLOS.some((P) => Math.abs(x - P.x) < 4 && Math.abs(y - P.y) < 3)) c = C.plaza;
          else if (Math.hypot(x - COPEY.x, y - COPEY.y) < COPEY.r + (v - .5) * 10) c = lado > .03 ? C.nubL : (h2(x, y) < .4 ? C.nub2 : C.nub);
          else if (hh > .45) c = lado > .025 ? C.cerroL : lado < -.025 ? C.cerroD : (v > .55 ? C.monte2 : C.monte);
          else { const m = humedad(x, y); c = m < .02 ? (h2(x, y) < .25 ? C.sab2 : C.sab) : m < .22 ? (h2(x, y) < .25 ? C.sabV2 : C.sabV) : v > .66 ? C.monte : v > .55 ? C.verde2 : (h2(x, y) < .06 ? C.verde2 : C.verde); }
        }
      }
    } else {
      const lag = enLaguna(x, y);
      if (dd < 2.2) { c = C.orilla; if (dd < 1.1 && dith) espuma.push([x, y]); }
      else if (lag) c = dd < 7 ? C.lag2 : C.lag;
      else if (dd < 12 + (dith ? 1 : 0)) c = C.bajo;
      else if (dd < 34 + (dith ? 2 : 0)) c = C.medio;
      else c = (fbm(x * .02, y * .02) > .55) === !!dith ? C.hondo2 : C.hondo;
    }
    const o = (y * W + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  f.putImageData(img, 0, 0);
  // caminos: borde oscuro + tierra clara (la Restinga es carretera gris; la lancha se dibuja animada)
  for (const T of TRAZOS) {
    if (T.kind === 'lancha' || T.kind === 'ferry') continue;
    const via = T.kind === 'restinga';
    for (const pass of [0, 1]) for (const p of T.pts) {
      const x = Math.round(p[0]), y = Math.round(p[1]), urb = Math.hypot(x - PORLAMAR.x, y - PORLAMAR.y) < PORLAMAR.r;
      f.fillStyle = pass === 0 ? (via || urb ? '#4a4652' : '#8a6a3a') : (via || urb ? '#6e6a76' : (T.kind === 'atajo' ? '#c9a46a' : '#f0dca6'));
      if (pass === 0) f.fillRect(x - 2, y - 2, 5, 5); else f.fillRect(x - 1, y - 1, 3, 3);
    }
    if (via) { f.fillStyle = '#f2e9a0'; T.pts.forEach((p, i) => { if (i % 6 < 3) f.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1); }); }
  }
  for (const P of PUEBLOS) {
    let b = null, dmin = 1e9;
    for (const T of TRAZOS) { if (T.kind === 'lancha' || T.kind === 'ferry' || T.kind === 'restinga') continue; for (const q of T.pts) { const e = Math.hypot(q[0] - P.x, q[1] - P.y); if (e < dmin) { dmin = e; b = q; } } }
    const n = Math.ceil(dmin);
    for (let i = 0; i <= n; i++) { const x = Math.round(P.x + (b[0] - P.x) * i / n + Math.sin(i * .3) * 1.5), y = Math.round(P.y + (b[1] - P.y) * i / n); f.fillStyle = '#8a6a3a'; f.fillRect(x, y, 2, 2); f.fillStyle = '#d8bf88'; f.fillRect(x, y, 1, 1); }
  }
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(sr() * (W - 4)), y = Math.floor(sr() * H);
    const dd = Math.min(distPoli(x, y, POLI.O), distPoli(x, y, POLI.W), distPoli(x, y, POLI.I), distPoli(x, y, POLI.C));
    if (dd > 14) olas.push({ x, y, f: sr() * 6.28, lag: enLaguna(x, y) });
  }
})();

/* ───────── sprites del decorado ───────── */
const SPR = {
  palma: [['..gg.gg..', '.ggggggg.', 'gg.ggg.gg', 'g...t...g', '....t....', '...t.....', '...t.....', '...t.....'],
    ['.gg.gg...', 'ggggggg..', 'g.ggg.gg.', '...t...g.', '....t....', '...t.....', '...t.....', '...t.....']],
  arbol: ['.ggg.', 'ggGgg', 'gGggg', '.ggg.', '..t..'],
  cardon: ['..g..', 'g.g..', 'g.g.g', 'ggg.g', '..ggg', '..g..', '..g..'],
  tuna: ['.gg', 'gggg', '.gg.'],
  torre: null,
  iglesia: ['...b.....', '..bbb....', '..bwb....', '..bbb.ww.', '.wwwwwwww', '.wwwwwwww', '.wwddwwrw', '.wwddwwww'],
  castillo: ['m.m.m...m.m.m', 'mmmmm...mmmmm', 'mnmmmmmmmmmnm', 'mmmmmmmmmmmmm', 'mmmmmmddmmmmm', 'nmmmmmddmmmmn'],
  fortin: ['m.m.m', 'mmmmm', 'mnmnm', 'mmmmm'],
  sombrilla: [['.rwrwr.', 'rwrwrwr', '...t...', '...t...', '...t...'], ['.ywyw y.'.replace(' ', ''), 'ywywywy', '...t...', '...t...', '...t...'], ['.bwbwb.', 'bwbwbwb', '...t...', '...t...', '...t...']],
  casita: ['.rrrr.', 'rrrrrr', '.wwww.', '.wdkw.'],
  ferry: ['.......kk.......', '....wwwwwwww....', '...wkwkwkwkww...', 'wwwwwwwwwwwwwwww', 'bbbbbbbbbbbbbbbb', '.wwwwwwwwwwwwww.'],
  velero: [['...w..', '..ww..', '.www..', 'wwww..', '..k...', 'bbbbbb', '.bbbb.'], ['..w...', '..ww..', '..www.', '..wwww', '..k...', 'bbbbbb', '.bbbb.']],
  penero: ['.....m.....', 'wwwwwwwwwww', '.wbbbbbbbw.', '..rrrrrrr..'],
  peaje: ['kkkkkkk', 'kyyyyyk', 'kwwwwwk', 'kwkkkwk', 'kwwwwwk', 'kwwwwwk'],
  fiscal: ['.kkk.', 'kkkkk', '.sss.', '.gggg', '.ggg.', '.g.g.'],
  gaviota: [['w...w', '.w.w.', '..k..'], ['.....', 'wwkww', '.....']],
  roca: ['.mm.', 'mmmm', 'mnmm'],
  arbolN: ['.ggg.', 'gGgGg', 'ggggg', 'gGggg', '.ggg.', '..t..'],
  arbusto: ['.gg.', 'gggg', '.t..'],
  colonial: null,
  iglesiaC: ['....k....', '...www...', '...wbw...', '...www...', '.rrrwrrr.', 'rwwwwwwwr', 'wwwwdwwww', 'wkwwdwwkw', 'wwwwdwwww'],
  santarosa: ['m.m.m.m.m.m', 'mmmmmmmmmmm', 'mnmmmmmmmnm', 'mmmmmddmmmm', 'nmmmmddmmmn', 'sssssssssss'],
  obelisco: ['.w.', '.w.', '.w.', 'www', 'www', 'sssss'],
  antena: ['..k..', '..k..', '.k.k.', '.kkk.', 'k...k'],
  espanta: ['.h.', 'sss', '.s.', '.s.'],
  rancho: ['..ttt..', '.ttttt.', 'ttttttt', '.p.w.p.', '.p.w.p.']
};
const PALS = {
  palma: { g: '#2f8a3a', t: '#8a5a2a' }, arbol: { g: '#2f7430', G: '#4a9a3e', t: '#6a4a2a' }, cardon: { g: '#3f7a3a' }, tuna: { g: '#5a8a3a' },
  iglesia: { b: '#d8c8a0', w: '#fffdf2', d: '#6a4a2a', r: '#d23b3b' }, castillo: { m: '#bcae8e', n: '#8a7a60', d: '#3a2a1a' }, fortin: { m: '#bcae8e', n: '#6a5a40' },
  sombrilla: { r: '#e0403a', w: '#fffdf2', y: '#ffd23f', b: '#2f6fe0', t: '#6a4a2a' }, casita: { r: '#d2563b', w: '#f3e3c3', d: '#6a4a2a', k: '#2a6fb0' },
  ferry: { k: '#14101c', w: '#fffdf2', b: '#2f6fe0' }, velero: { w: '#fffdf2', k: '#6a4a2a', b: '#d23b3b' }, penero: { m: '#6a4a2a', w: '#fffdf2', b: '#36b04a', r: '#2f6fe0' },
  peaje: { k: '#14101c', y: '#ffd23f', w: '#e8e2d0' }, fiscal: { k: '#1a2a4a', s: '#c98a5a', g: '#3a5a3a' }, gaviota: { w: '#fffdf2', k: '#ffb040' }, roca: { m: '#8a7a6a', n: '#5a4a3a' },
  arbolN: { g: '#1f5a2c', G: '#2f7a3a', t: '#5a3a1a' }, arbusto: { g: '#6a8a3a', t: '#6a4a2a' },
  iglesiaC: { k: '#14101c', w: '#fffdf2', b: '#d8a520', r: '#c0503a', d: '#6a4a2a' },
  santarosa: { m: '#c8b890', n: '#9a8a6a', d: '#3a2a1a', s: '#7a6a50' }, obelisco: { w: '#f0ece0', s: '#9a9a8a' },
  antena: { k: '#6a6a7a' }, espanta: { h: '#c8a050', s: '#8a5a3a' }, rancho: { t: '#c8a050', p: '#6a4a2a', w: '#3a2a1a' }
};
function torre(x, y, w, h, col, t) {
  ctx.fillStyle = '#14101c'; ctx.fillRect(x - 1, y - h - 1, w + 2, h + 1);
  ctx.fillStyle = col; ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y - h, 1, h);
  for (let j = y - h + 2; j < y - 2; j += 3) for (let i = x + 1; i < x + w - 1; i += 2) {
    ctx.fillStyle = h2(i * 7 + Math.floor(t * .3), j) > .82 ? '#ffe680' : '#3a5a8a'; ctx.fillRect(i, j, 1, 1);
  }
}

/* ───────── decorado (fijo, con colisión contra casillas) ───────── */
const DECO = [];
(function () {
  const libre = (x, y, r) => nodos.every((n) => Math.hypot(n.x - x, n.y - y) > r) && TRAZOS.every((T) => T.kind === 'lancha' || T.pts.every((p, i) => i % 3 || Math.hypot(p[0] - x, p[1] - y) > 5))
    && Object.values(PUESTOS).every((p) => Math.hypot(p.x - x, p.y - y) > 14) && DECO.every((d) => Math.hypot(d.x - x, d.y - y) > 6);
  const enTierra = (x, y, k, m) => distPoli(x, y, POLI[k]) < -(m || 6);
  const pon = (o) => DECO.push(o);
  // Porlamar: torres
  [[512, 232, 7, 22, '#e8e2d0'], [522, 238, 6, 30, '#9fd8ff'], [532, 230, 8, 18, '#f0c9a0'], [543, 240, 6, 26, '#e8e2d0'], [552, 233, 7, 16, '#ffd8d8'],
    [503, 246, 6, 14, '#f0c9a0'], [538, 252, 7, 12, '#9fd8ff'], [560, 248, 6, 20, '#e8e2d0']].forEach((b) => { if (libre(b[0] + b[2] / 2, b[1] - 4, 8)) pon({ k: 'torre', x: b[0], y: b[1], w: b[2], h: b[3], c: b[4] }); });
  pon({ k: 'castillo', x: 548, y: 186 });
  pon({ k: 'iglesia', x: 452, y: 182 });
  pon({ k: 'fortin', x: 312, y: 104 });
  [[618, 52], [630, 60], [624, 66]].forEach((p) => pon({ k: 'roca', x: p[0], y: p[1] }));
  // lugares de la isla: el primer candidato libre gana
  const ponEn = (o, cands, r) => { for (const c of cands) { if (libre(c[0], c[1], r)) { pon(Object.assign({ x: c[0] - (o.cx || 0), y: c[1] - (o.cy || 0) }, o)); return true; } } return false; };
  ponEn({ k: 'sambil', cx: 15, cy: -7 }, [[522, 206], [530, 202], [512, 210], [540, 200]], 13);
  ponEn({ k: 'plaza', cx: 8, cy: 5 }, [[552, 262], [546, 268], [560, 258], [536, 270]], 9);
  ponEn({ k: 'catedral', cx: 5, cy: 4 }, [[566, 226], [572, 232], [558, 218]], 8);
  ponEn({ k: 'basilica', cx: 5, cy: 4 }, [[498, 196], [504, 186], [492, 204], [510, 192]], 8);
  for (const c of [[452, 66], [500, 64], [548, 70], [474, 62]]) ponEn({ k: 'churuata', cx: 3, cy: 3 }, [c], 7);
  for (let i = 0; i < 8; i++) ponEn({ k: 'silla', v: i % 3, cx: 1, cy: 1 }, [[440 + i * 15 + Math.floor(sr() * 6), 64 + Math.floor(sr() * 3)]], 6);
  ponEn({ k: 'chinchorro', cx: 5, cy: 3 }, [[64, 214], [70, 206], [160, 226], [56, 232]], 9);
  ponEn({ k: 'ruinas', cx: 4, cy: 2 }, [[158, 340], [154, 338]], 3);
  ponEn({ k: 'hotel', cx: 6, cy: 5 }, [[300, 326], [250, 326], [310, 334]], 8);
  ponEn({ k: 'faro', cx: 2, cy: 6 }, [[612, 100], [606, 96], [604, 108]], 6);
  for (let i = 0; i < 7; i++) { const x = 446 + i * 17 + Math.floor(sr() * 5), y = 58 + Math.floor(sr() * 4); if (libre(x + 3, y + 3, 7)) pon({ k: 'sombrilla', v: i % 3, x, y }); }
  for (let i = 0; i < 3; i++) pon({ k: 'sombrilla', v: i % 3, x: 22 + (i % 2) * 6, y: 214 + i * 12 });
  // pueblos coloniales: iglesia + casas de teja alrededor de la plaza
  for (const P of PUEBLOS) {
    if (P.colonial) ponEn({ k: 'iglesiaC', cx: 4, cy: 9 }, [[P.x, P.y - 4], [P.x + 8, P.y - 4], [P.x - 8, P.y - 4], [P.x, P.y + 8]], 7);
    let k = 0;
    for (let a = 0; a < 40 && k < P.n; a++) {
      const an = a * 2.4, r = 9 + a * .7, x = P.x + Math.cos(an) * r, y = P.y + Math.sin(an) * r * .7;
      if (ponEn({ k: 'colonial', v: Math.floor(sr() * 4), cx: 4, cy: 3 }, [[Math.round(x), Math.round(y)]], 6)) k++;
    }
  }
  ponEn({ k: 'santarosa', cx: 6, cy: 4 }, [[472, 124], [478, 118], [466, 130]], 8);
  ponEn({ k: 'obelisco', cx: 2, cy: 6 }, [[500, 150], [506, 146], [494, 154]], 6);
  ponEn({ k: 'antena', cx: 2, cy: 5 }, [[414, 166], [420, 170], [408, 172]], 5);
  for (const q of CONUCOS) ponEn({ k: 'espanta', cx: 1, cy: 3 }, [[q[0] + q[2] - 3, q[1] - 2], [q[0] + 2, q[1] - 2]], 4);
  for (const c of [[96, 230], [176, 214], [40, 176], [120, 278], [190, 250]]) ponEn({ k: 'rancho', cx: 3, cy: 2 }, [c], 7);
  // vegetación según el terreno: palmas en la costa, cardonal en la sabana seca, bosque en los cerros y El Copey
  const nada = (x, y) => Math.hypot((x - EMBALSE.x) / (EMBALSE.rx + 4), (y - EMBALSE.y) / (EMBALSE.ry + 4)) < 1 || CONUCOS.some((q) => x > q[0] - 3 && x < q[0] + q[2] + 3 && y > q[1] - 6 && y < q[1] + q[3] + 2);
  let nO = 0, nW = 0;
  for (let i = 0; i < 2600 && nO < 300; i++) {
    const x = 296 + sr() * 320, y = 50 + sr() * 250;
    if (!enTierra(x, y, 'O', 4) || Math.hypot(x - PORLAMAR.x, y - PORLAMAR.y) < PORLAMAR.r + 4 || nada(x, y) || !libre(x + 4, y + 5, 9)) continue;
    const costa = distPoli(x, y, POLI.O) > -16, copey = Math.hypot(x - COPEY.x, y - COPEY.y) < COPEY.r + 6, hh = altura(x, y), m = humedad(x, y);
    let o;
    if (costa) o = { k: 'palma', f: sr() * 6 };
    else if (copey || hh > .45) o = { k: copey && sr() < .5 ? 'arbolN' : 'arbol' };
    else if (m < .02) o = { k: sr() < .55 ? 'cardon' : sr() < .5 ? 'tuna' : 'arbusto' };
    else if (m < .22) o = { k: sr() < .5 ? 'arbusto' : sr() < .5 ? 'cardon' : 'arbol' };
    else o = { k: 'arbol' };
    pon(Object.assign(o, { x: Math.round(x), y: Math.round(y) })); nO++;
  }
  for (let i = 0; i < 2000 && nW < 150; i++) {
    const x = 12 + sr() * 214, y = 146 + sr() * 164;
    if (!enTierra(x, y, 'W', 5) || Math.hypot((x - SALINA.x) / 16, (y - SALINA.y) / 10) < 1 || nada(x, y) || !libre(x + 2, y + 4, 8)) continue;
    pon({ k: sr() < .55 ? 'cardon' : sr() < .5 ? 'tuna' : 'arbusto', x: Math.round(x), y: Math.round(y) }); nW++;
  }
  [[160, 152], [170, 156], [180, 152], [104, 300], [116, 302], [346, 166], [356, 170], [338, 174], [532, 52], [544, 56], [180, 286]].forEach((p) => { if (libre(p[0] + 3, p[1] + 2, 7)) pon({ k: 'casita', x: p[0], y: p[1] }); });
  [[232, 322], [262, 322], [300, 322], [324, 330], [226, 340]].forEach((p, i) => { if (libre(p[0] + 4, p[1] + 6, 8)) pon({ k: 'palma', x: p[0], y: p[1], f: i }); });
  pon({ k: 'palma', x: 160, y: 328, f: 3 });
  DECO.sort((a, b) => a.y - b.y);
})();

/* ───────── animados del mar ───────── */
const VELEROS = [{ x: 120, y: 40, v: 6 }, { x: 600, y: 320, v: -5 }, { x: 330, y: 22, v: 4 }];
const GAVIOTAS = Array.from({ length: 6 }, (_, i) => ({ x: sr() * W, y: 40 + sr() * 260, v: 10 + sr() * 8, f: sr() * 6 }));
const PENEROS_PLAYA = [{ x: 92, y: 318 }, { x: 132, y: 322 }, { x: 586, y: 270 }];
let delfin = { t: -5, x: 0, y: 0 };
const NUBES = Array.from({ length: 4 }, () => ({ x: sr() * W, y: 40 + sr() * 260, r: 30 + sr() * 30, v: 3 + sr() * 3 }));

function dibujarMar(t, dt) {
  ctx.drawImage(fondo, 0, 0);
  for (const o of olas) {
    const k = Math.sin(t * 1.6 + o.f);
    if (k > .25) { ctx.fillStyle = o.lag ? (k > .8 ? '#bff0e6' : '#7ad8cc') : (k > .8 ? '#a8dcff' : '#4f9ad0'); ctx.fillRect(o.x + Math.round(Math.sin(t + o.f) * 2), o.y, 3, 1); }
  }
  ctx.fillStyle = '#f0fcff';
  for (let i = 0; i < espuma.length; i += 2) { const p = espuma[i]; if (((p[0] * 31 + p[1] * 17 + Math.floor(t * 4)) % 9) === 0) ctx.fillRect(p[0], p[1], 1, 1); }
  // lancha: estela punteada animada
  ctx.fillStyle = '#e8fbff';
  for (const L of TRAZOS) if (L.kind === 'lancha' || L.kind === 'ferry') L.pts.forEach((p, i) => { if ((i + Math.floor(t * 8)) % 5 === 0) ctx.fillRect(Math.round(p[0]), Math.round(p[1]), 1, 1); });
  for (const v of VELEROS) { v.x += v.v * dt; if (v.x > W + 10) v.x = -10; if (v.x < -10) v.x = W + 10; sprite(SPR.velero[Math.abs(Math.floor(t * 2)) % 2], PALS.velero, Math.round(v.x), Math.round(v.y + Math.sin(t * 2 + v.y) * .7), v.v < 0); }
  PENEROS_PLAYA.forEach((p, i) => sprite(SPR.penero, PALS.penero, p.x, p.y + Math.round(Math.sin(t * 2 + i) * .6)));
  sprite(SPR.ferry, PALS.ferry, 316 + Math.round(Math.sin(t * .2) * 6), 306 + Math.round(Math.sin(t * 1.5) * .6));
  delfin.t += dt;
  if (delfin.t > 7) { delfin = { t: 0, x: 380 + sr() * 220, y: 318 + sr() * 30 }; if (sr() < .5) { delfin.x = 30 + sr() * 120; delfin.y = 30 + sr() * 40; } }
  if (delfin.t < 1.2) {
    const k = delfin.t / 1.2, x = delfin.x + k * 18, y = delfin.y - Math.sin(k * Math.PI) * 9;
    ctx.fillStyle = '#5a7a9a'; ctx.fillRect(Math.round(x), Math.round(y), 5, 2); ctx.fillRect(Math.round(x) + 2, Math.round(y) - 1, 1, 1);
    if (k > .85 || k < .15) { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x) - 1, Math.round(delfin.y) + 1, 3, 1); }
  }
}
const R_ = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
const COLONIAL = ['.rrrrrr.', 'rrrrrrrr', 'wwwwwwww', 'wkwwwwkw', 'wwwddwww'];
const MUROS = ['#f3ead8', '#ecc878', '#a8d0e8', '#f0b8c0'];
const EDIF = {
  colonial(d) { sprite(COLONIAL, { r: '#c0503a', w: MUROS[d.v], k: '#4a7aa0', d: '#6a4a2a' }, d.x, d.y); },
  antena(d, t) { sprite(SPR.antena, PALS.antena, d.x, d.y); if (Math.floor(t * 1.5) % 2) R_(d.x + 2, d.y - 1, 1, 1, '#ff3030'); },
  obelisco(d, t) { sprite(SPR.obelisco, PALS.obelisco, d.x, d.y); R_(d.x + 1, d.y - 5, 1, 5, '#6a4a2a'); const o = Math.floor(t * 5) % 2; R_(d.x + 2, d.y - 5, 4 + o, 1, '#ffd23f'); R_(d.x + 2, d.y - 4, 4 + (1 - o), 1, '#2f6fe0'); R_(d.x + 2, d.y - 3, 4 + o, 1, '#e0403a'); },
  santarosa(d, t) { sprite(SPR.santarosa, PALS.santarosa, d.x, d.y); R_(d.x + 5, d.y - 6, 1, 6, '#6a4a2a'); const o = Math.floor(t * 4) % 2; R_(d.x + 6, d.y - 6, 4 + o, 1, '#ffd23f'); R_(d.x + 6, d.y - 5, 4 + (1 - o), 1, '#2f6fe0'); R_(d.x + 6, d.y - 4, 4 + o, 1, '#e0403a'); },
  rancho(d, t) { sprite(SPR.rancho, PALS.rancho, d.x, d.y); if (h2(d.x, d.y) > .5) { ctx.fillStyle = 'rgba(220,220,220,.5)'; for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(d.x + 5 + Math.sin(t * 2 + i) * 1.5), Math.round(d.y - 2 - ((t * 4 + i * 3) % 9)), 1, 1); } },
  sambil(d, t) {
    const x = d.x, y = d.y;
    R_(x - 1, y - 15, 32, 16, '#14101c'); R_(x, y - 14, 30, 14, '#e8e2d0'); R_(x, y - 14, 30, 2, '#b8b0a0');
    R_(x + 1, y - 10, 28, 3, '#3fa0e0'); R_(x + 1, y - 9, 28, 1, '#9fd8ff'); R_(x + 12, y - 5, 6, 5, '#3a5a8a');
    for (let i = 0; i < 6; i++) R_(x + 2 + i * 5, y - 13, 2, 1, ['#e0403a', '#ffd23f', '#3fb0ff'][i % 3]);
    R_(x + 3, y - 20, 24, 7, '#14101c'); R_(x + 4, y - 19, 22, 5, d.fiesta > 0 ? (Math.floor(t * 8) % 2 ? '#ffd23f' : '#e0403a') : '#e0403a');
    texto('SAMBIL', x + 15, y - 19, '#fffdf2');
    if (d.fiesta > 0) d.fiesta -= 1 / 60;
  },
  plaza(d, t) {
    const x = d.x, y = d.y;
    R_(x, y, 16, 10, '#4a9a3e'); R_(x, y + 4, 16, 2, '#d8c8a0'); R_(x + 7, y, 2, 10, '#d8c8a0');
    R_(x + 6, y + 3, 4, 4, '#a8a8a8'); R_(x + 7, y + 1, 2, 3, '#7a7a7a'); R_(x + 7, y, 1, 1, '#ffd23f');
    for (const [a, b] of [[1, 0], [13, 0], [1, 7], [13, 7]]) R_(x + a, y + b, 2, 2, '#2f7430');
    if (d.palomas > 0) { d.palomas -= 1 / 60; for (let i = 0; i < 5; i++) R_(x + 8 + Math.cos(i * 1.3) * (12 - d.palomas * 8), y - (1 - d.palomas) * 14 - i, 1, 1, '#e8e8f0'); }
  },
  catedral(d, t) { sprite(['.b.....b.', 'bbb...bbb', 'wwwwwwwww', 'wwwrrrwww', 'wkwwwwwkw', 'wwwddwwww', 'wwwddwwww'], { b: '#c8b890', w: '#fffdf2', r: '#e0603a', k: '#3a5a8a', d: '#6a4a2a' }, d.x, d.y - 3); },
  basilica(d, t) { sprite(['....w....', '...www...', '..ppppp..', '.pwpwpwp.', 'ppppppppp', 'pwwpdpwwp', 'pppddpppp'], { w: '#fffdf2', p: '#f0a8c8', d: '#6a4a2a' }, d.x, d.y - 3); },
  churuata(d, t) { sprite(['...ttt...', '.ttttttt.', 'ttttttttt', '.p.....p.', '.p.....p.'], { t: '#c8a050', p: '#6a4a2a' }, d.x, d.y); },
  silla(d) { const c = ['#e0403a', '#3fb0ff', '#ffd23f'][d.v]; R_(d.x, d.y + 1, 3, 1, c); R_(d.x + 2, d.y, 1, 1, c); },
  chinchorro(d, t) {
    const x = d.x, y = d.y, s = Math.sin(t * (d.meneo > 0 ? 5 : 1.6)) * (d.meneo > 0 ? 3 : 1.2); if (d.meneo > 0) d.meneo -= 1 / 60;
    R_(x, y - 4, 1, 7, '#6a4a2a'); R_(x + 10, y - 4, 1, 7, '#6a4a2a');
    for (let i = 0; i <= 8; i++) R_(x + 1 + i, y - 2 + Math.sin(i / 8 * Math.PI) * 3 + s * Math.sin(i / 8 * Math.PI), 1, 1, i % 2 ? '#e0403a' : '#ffd23f');
    R_(x + 4, y - 1 + s, 3, 1, '#c98a5a');
  },
  ruinas(d) { sprite(['m.m..m', 'mm.mmm', 'mmmmmm'], { m: '#a89878' }, d.x, d.y); },
  hotel(d, t) { sprite(['wwwwwwwwwwww', 'wkwkwkwkwkww', 'wwwwwwwwwwww', 'wkwkwkwkwkww', 'wwwwwddwwwww'], { w: '#fff0d0', k: '#3fa0e0', d: '#6a4a2a' }, d.x, d.y - 3); R_(d.x + 2, d.y + 3, 6, 2, Math.sin(t * 3) > 0 ? '#5cc8f0' : '#7ad8ff'); },
  faro(d, t) {
    sprite(['.k.', 'yyy', 'rwr', 'wrw', 'rwr', 'wrw', 'rwr'], { k: '#14101c', y: '#ffd23f', r: '#e0403a', w: '#fffdf2' }, d.x, d.y);
    const a = t * 1.4; ctx.fillStyle = 'rgba(255,240,150,.18)'; ctx.beginPath(); ctx.moveTo(d.x + 1.5, d.y + 1); ctx.lineTo(d.x + 1.5 + Math.cos(a) * 40 - Math.sin(a) * 6, d.y + 1 + Math.sin(a) * 40 + Math.cos(a) * 6); ctx.lineTo(d.x + 1.5 + Math.cos(a) * 40 + Math.sin(a) * 6, d.y + 1 + Math.sin(a) * 40 - Math.cos(a) * 6); ctx.fill();
  }
};
function dibujarDeco(t) {
  for (const d of DECO) {
    if (d.k === 'torre') torre(d.x, d.y, d.w, d.h, d.c, t);
    else if (d.k === 'palma') sprite(SPR.palma[Math.sin(t * 1.3 + d.f) > .6 ? 1 : 0], PALS.palma, d.x, d.y);
    else if (d.k === 'sombrilla') sprite(SPR.sombrilla[d.v], PALS.sombrilla, d.x, d.y);
    else if (d.k === 'castillo') {
      sprite(SPR.castillo, PALS.castillo, d.x, d.y);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(d.x + 6, d.y - 8, 1, 8);
      const ond = Math.floor(t * 6) % 2; ctx.fillStyle = '#ffd23f'; ctx.fillRect(d.x + 7, d.y - 8, 4 + ond, 1); ctx.fillStyle = '#2f6fe0'; ctx.fillRect(d.x + 7, d.y - 7, 4 + (1 - ond), 1); ctx.fillStyle = '#e0403a'; ctx.fillRect(d.x + 7, d.y - 6, 4 + ond, 1);
    } else if (EDIF[d.k]) EDIF[d.k](d, t);
    else sprite(SPR[d.k], PALS[d.k], d.x, d.y);
  }
  // peajes: caseta + fiscal + barrera que sube y baja
  for (const P of PEAJES) {
    const n = nodos[P.nodo], x = n.x + (P.id === 'lancha' ? -18 : 6), y = n.y + (P.id === 'lancha' ? 4 : -16);
    sprite(SPR.peaje, PALS.peaje, x, y);
    sprite(SPR.fiscal, PALS.fiscal, x + 8, y + 1);
    const ab = Math.sin(t * .8 + n.id) > .7;
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#e0403a' : '#fffdf2'; if (ab) ctx.fillRect(x - 1, y - 2 - i, 1, 1); else ctx.fillRect(x - 10 + i, y + 3, 1, 1); }
  }
}
function dibujarCielo(t, dt) {
  for (const g of GAVIOTAS) {
    g.x += g.v * dt; if (g.x > W + 10) { g.x = -10; g.y = 40 + sr() * 260; }
    sprite(SPR.gaviota[Math.floor(t * 5 + g.f) % 2], PALS.gaviota, Math.round(g.x), Math.round(g.y + Math.sin(t + g.f) * 4));
  }
  for (const c of NUBES) {
    c.x += c.v * dt; if (c.x - c.r > W) { c.x = -c.r; c.y = 40 + sr() * 260; }
    ctx.fillStyle = 'rgba(10,20,40,.07)';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(c.x + i * c.r * .5, c.y + (i % 2) * 6, c.r * .6, c.r * .35, 0, 0, 6.29); ctx.fill(); }
  }
}
/* ───────── estado de la isla: hora, clima, carnaval, obras, mar de leva ───────── */
const LUCES = [];
(function () {
  for (const d of DECO) {
    if (d.k === 'torre') for (let j = d.y - d.h + 2; j < d.y - 2; j += 3) for (let i = d.x + 1; i < d.x + d.w - 1; i += 2) if (h2(i, j) > .45) LUCES.push({ x: i, y: j, r: 0 });
    if (d.k === 'casita') LUCES.push({ x: d.x + 2, y: d.y + 3, r: 6 });
    if (d.k === 'iglesia') LUCES.push({ x: d.x + 4, y: d.y + 2, r: 8 });
    if (d.k === 'castillo') LUCES.push({ x: d.x + 1, y: d.y, r: 7 }, { x: d.x + 12, y: d.y, r: 7 });
  }
  LUCES.push({ x: PORLAMAR.x, y: PORLAMAR.y - 6, r: 34 });
  for (const k in PUESTOS) LUCES.push({ x: PUESTOS[k].x + 4, y: PUESTOS[k].y - 8, r: 12 });
  for (const P of PEAJES) LUCES.push({ x: nodos[P.nodo].x, y: nodos[P.nodo].y, r: 10 });
})();
const GOTAS = Array.from({ length: 170 }, () => ({ x: sr() * W, y: sr() * H, v: 160 + sr() * 80 }));
const CONF = Array.from({ length: 90 }, () => ({ x: sr() * W, y: sr() * H, v: 12 + sr() * 20, f: sr() * 6, c: ['#ffd23f', '#ff6fa8', '#5cd27a', '#9fd8ff', '#ff8a3d', '#b88aff'][Math.floor(sr() * 6)] }));
let rayo = 0, fuegos = [];
function glow(x, y, r, a, col) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function barrera(n) {
  const x = n.x - 7, y = n.y - 12;
  for (let i = 0; i < 15; i++) { ctx.fillStyle = (i >> 1) % 2 ? '#e0403a' : '#fffdf2'; ctx.fillRect(x + i, y, 1, 2); }
  ctx.fillStyle = '#14101c'; ctx.fillRect(x, y + 2, 1, 4); ctx.fillRect(x + 14, y + 2, 1, 4);
  ctx.fillStyle = '#ff8a1a'; ctx.fillRect(x + 3, y + 5, 2, 3); ctx.fillRect(x + 10, y + 5, 2, 3); ctx.fillStyle = '#fffdf2'; ctx.fillRect(x + 3, y + 6, 2, 1); ctx.fillRect(x + 10, y + 6, 2, 1);
  texto('OBRAS', n.x, n.y - 19, '#ffd23f', 1, '#14101c');
}
function comparsa(t) {
  const cols = ['#ff6fa8', '#ffd23f', '#5cd27a', '#9fd8ff', '#ff8a3d', '#b88aff', '#e0403a'];
  for (let i = 0; i < 9; i++) {
    const a = t * .5 + i * .42, x = Math.round(PORLAMAR.x - 4 + Math.cos(a) * 26), y = Math.round(PORLAMAR.y + 14 + Math.sin(a) * 9), b = Math.round(Math.abs(Math.sin(t * 8 + i)) * 2);
    ctx.fillStyle = cols[(i + 3) % 7]; ctx.fillRect(x - 2, y - 10 - b, 5, 2); ctx.fillRect(x - 1, y - 12 - b, 1, 2); ctx.fillRect(x + 1, y - 12 - b, 1, 2);
    ctx.fillStyle = '#c98a5a'; ctx.fillRect(x - 1, y - 8 - b, 3, 2);
    ctx.fillStyle = cols[i % 7]; ctx.fillRect(x - 1, y - 6 - b, 3, 4);
    ctx.fillStyle = '#14101c'; ctx.fillRect(x - 1, y - 2, 1, 2); ctx.fillRect(x + 1, y - 2 + (b ? -1 : 0), 1, 2);
  }
}
function dibujarEstado(t, dt, E) {
  // marcadores de juego sobre el mapa
  if (E.obras.O) barrera(nodos[SEGS.asuncion.ids[0]]);
  if (E.obras.W) barrera(nodos[SEGS.cerro.ids[0]]);
  const cerrada = E.hora === 'noche' || E.apagon || E.leva;
  if (E.leva) {
    ctx.fillStyle = '#e8fbff';
    for (const o of olas) if (Math.sin(t * 3 + o.f) > .5) ctx.fillRect(o.x + Math.round(Math.sin(t * 2 + o.f) * 3), o.y - 1, 5, 1);
  }
  if (cerrada) { const n = nodos[SEGS.lancha.ids[0]]; ctx.fillStyle = '#e0403a'; ctx.fillRect(n.x - 6, n.y - 1, 13, 3); ctx.fillStyle = '#fffdf2'; ctx.fillRect(n.x - 4, n.y, 9, 1); }
  if (E.carnaval) comparsa(t);
  // luz del día
  const V = E.vis;
  if (V.tarde > .01) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = V.tarde * .55; ctx.fillStyle = '#ff9a5a'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (V.noche > .01) {
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = V.noche * .8; ctx.fillStyle = '#28306a'; ctx.fillRect(0, 0, W, H); ctx.restore();
    if (!E.apagon) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const L of LUCES) {
        if (L.r) glow(L.x, L.y, L.r * (1 + Math.sin(t * 3 + L.x) * .05), .35 * V.noche, 'rgba(255,200,90,A)');
        else if (h2(L.x + Math.floor(t * .5), L.y) > .25) { ctx.fillStyle = `rgba(255,230,120,${V.noche})`; ctx.fillRect(L.x, L.y, 1, 1); }
      }
      ctx.restore();
    } else for (const k in PUESTOS) glow(PUESTOS[k].x + 4, PUESTOS[k].y - 6, 9, .3 * V.noche, 'rgba(255,190,90,A)');   // apagón: solo las velas
    ctx.fillStyle = `rgba(255,255,255,${.7 * V.noche})`;
    for (let i = 0; i < 40; i++) { const x = h2(i, 1) * W, y = h2(i, 2) * H; if (distPoli(x, y, POLI.O) > 20 && distPoli(x, y, POLI.W) > 20 && Math.sin(t * 2 + i) > 0) ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
  }
  // aguacero
  if (V.lluvia > .01) {
    ctx.fillStyle = `rgba(30,40,60,${.4 * V.lluvia})`; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(210,228,255,${.85 * V.lluvia})`;
    for (const g of GOTAS) {
      g.y += g.v * dt; g.x -= g.v * .25 * dt; if (g.y > H) { g.y = -6; g.x = sr() * (W + 60); }
      ctx.fillRect(Math.round(g.x), Math.round(g.y), 1, 5); ctx.fillRect(Math.round(g.x) - 1, Math.round(g.y) + 2, 1, 2);
      if (g.y > H - 4 || h2(Math.floor(g.x), Math.floor(g.y)) > .995) ctx.fillRect(Math.round(g.x) - 1, Math.round(g.y) + 4, 3, 1);
    }
    rayo -= dt; if (rayo < -6 - sr() * 8) rayo = .25;
    if (rayo > 0) { ctx.fillStyle = `rgba(255,255,255,${rayo * 1.6 * V.lluvia})`; ctx.fillRect(0, 0, W, H); }
  }
  // carnaval: papelillo y, de noche, fuegos artificiales
  if (E.carnaval) {
    for (const c of CONF) { c.y += c.v * dt; c.x += Math.sin(t * 2 + c.f) * 8 * dt; if (c.y > H) { c.y = -3; c.x = sr() * W; } ctx.fillStyle = c.c; ctx.fillRect(Math.round(c.x), Math.round(c.y), Math.sin(t * 6 + c.f) > 0 ? 2 : 1, 1); }
    if (V.noche > .4 || sr() < .3 * dt) {
      if (sr() < dt * 1.2) fuegos.push({ x: 380 + sr() * 220, y: 50 + sr() * 120, t: 0, c: ['#ffd23f', '#ff6fa8', '#9fd8ff', '#5cd27a'][Math.floor(sr() * 4)] });
    }
  }
  fuegos = fuegos.filter((f) => (f.t += dt) < 1.2);
  for (const f of fuegos) {
    const r = f.t * 26, a = 1 - f.t / 1.2; ctx.fillStyle = f.c; ctx.globalAlpha = a;
    for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283; ctx.fillRect(Math.round(f.x + Math.cos(an) * r), Math.round(f.y + Math.sin(an) * r + f.t * f.t * 10), 1, 1); }
    ctx.globalAlpha = 1;
  }
}
/* ───────── personajes de los lugares ───────── */
const SPR_NPC = {
  bodega: ['rrrrrrrrrrrrrrr', 'wrwrwrwrwrwrwrw', '.kkkkkkkkkkkkk.', '.kyyyyyyyyyyyk.', '.kwwwwwwwwwwwk.', '.kwbbwwwwwggwk.', '.kwbbwwwwwggwk.', '.kkkkkkkkkkkkk.'],
  san: ['....yyy....', '...yyyyy...', '..ykkkkky..', '.wwwwwwwww.', '.wkwwwwwkw.', '.wwwddwwww.', '.wwwddwwww.'],
  picaro: ['..kkk..', '.kkkkk.', '..sss..', '..sgs..', '.ttttt.', 'stttts.', '.t...t.'],
  perla: ['..www..', '.wpppw.', 'wpwwwpw', '.wpppw.', '..www..']
};
const PAL_NPC = {
  bodega: { r: '#e0403a', w: '#fffdf2', k: '#6a4a2a', y: '#ffd23f', b: '#3fb0ff', g: '#5cd27a' },
  san: { y: '#ffd23f', k: '#14101c', w: '#f3e3c3', d: '#6a4a2a' },
  picaro: { k: '#1a1a24', s: '#a8703f', g: '#fffdf2', t: '#5a3a7a' },
  perla: { w: '#fffdf2', p: '#f6c8e8' }
};
const DICHOS = {
  bodega: ['¡FIADO NO!', '¡HAY CAFECITO!', '¡PASE, AMIGO!'], san: ['¡PAGUEN EL SAN!', '¡ESTE MES TOCA!'], picaro: ['PSST...', '¿UN NEGOCITO?', 'JE JE JE'],
  perla: ['¡PERLAS!', '¡DE CUBAGUA!'], monos: ['¡UH UH AH!', '¿UN MANGO?'], calabozo: ['¡SILENCIO!', '¡AL CALABOZO!'], matasiete: ['¡A PIEDRA!', '¡1817!'], sambil: ['¡RIFA!', '¡OFERTA!', '¡HAY AIRE!'], canon: ['¡FUEGO!', '¿QUIEN SE MONTA?'], senora: ['¡EMPANADAS!', '¡DE CAZON!', '¡CALIENTITAS!'], bacha: ['¡PIMPINA!', '¡GASOLINA!'], fiscal: ['¿COLABORA?', '¡PAPELES!']
};
const BURB = [];
function burbuja(s, x, y, col) { BURB.push({ s, x, y, t: 0, col: col || '#14101c' }); }
function dibujarNPCs(t, senora, bacha) {
  for (const N of NPCS) {
    if (N.k === 'bodega') { sprite(SPR_NPC.bodega, PAL_NPC.bodega, N.x - 7, N.y - 4); texto('PORTU', N.x + 1, N.y - 9, '#ffd23f', 1, '#14101c'); }
    else if (N.k === 'san') { sprite(SPR_NPC.san, PAL_NPC.san, N.x - 5, N.y - 4 + Math.round(Math.sin(t * 2))); }
    else if (N.k === 'picaro') sprite(SPR_NPC.picaro, PAL_NPC.picaro, N.x - 3 + Math.round(Math.sin(t * .7) * 2), N.y, Math.sin(t * .7) < 0);
    else if (N.k === 'canon') { R_(N.x - 4, N.y + 1, 9, 3, '#4a3a2a'); R_(N.x - 2, N.y - 2, 9, 3, '#3a3a44'); R_(N.x + 6, N.y - 2, 2, 3, '#14101c'); R_(N.x - 3, N.y + 3, 3, 3, '#6a4a2a'); R_(N.x + 2, N.y + 3, 3, 3, '#6a4a2a'); for (let i = 0; i < 3; i++) R_(N.x - 6 + i * 2, N.y + 4, 2, 2, '#14101c'); }
    else if (N.k === 'matasiete') { for (let i = 0; i < 6; i++) R_(N.x - 3 + (i % 3) * 2, N.y + 2 - Math.floor(i / 3) * 2, 2, 2, i % 2 ? '#9a9a8a' : '#7a7a6a'); R_(N.x + 4, N.y - 6, 1, 8, '#6a4a2a'); const o = Math.floor(t * 4) % 2; R_(N.x + 5, N.y - 6, 4 + o, 1, '#ffd23f'); R_(N.x + 5, N.y - 5, 4 + (1 - o), 1, '#2f6fe0'); R_(N.x + 5, N.y - 4, 4 + o, 1, '#e0403a'); }
    else if (N.k === 'calabozo') { R_(N.x - 4, N.y - 2, 9, 8, '#5a5a66'); for (let i = 0; i < 4; i++) R_(N.x - 3 + i * 2, N.y - 1, 1, 6, '#2a2a33'); R_(N.x - 4, N.y - 3, 9, 1, '#3a3a44'); }
    else if (N.k === 'monos') { const b = Math.round(Math.abs(Math.sin(t * 3)) * 2); R_(N.x - 1, N.y - b, 3, 3, '#7a5030'); R_(N.x, N.y - 1 - b, 2, 1, '#f0d0a0'); R_(N.x + 2, N.y + 1 - b, 2, 1, '#7a5030'); R_(N.x - 4, N.y + 3, 9, 2, '#2f7430'); }
    else if (N.k === 'perla') { const b = Math.round(Math.sin(t * 3) * 1.2); sprite(SPR_NPC.perla, PAL_NPC.perla, N.x - 3, N.y + b); if (Math.sin(t * 5) > .9) { ctx.fillStyle = '#fff'; ctx.fillRect(N.x + 2, N.y - 1 + b, 1, 1); } }
  }
  // dichos al azar
  if (sr() < .006) {
    const op = NPCS.map((N) => [N.k, N.x, N.y - 10]);
    op.push(['senora', PUESTOS[senora || 'O'].x + 2, PUESTOS[senora || 'O'].y - 26], ['bacha', PUESTOS[bacha || 'W'].x, PUESTOS[bacha || 'W'].y - 14]);
    PEAJES.forEach((P) => op.push(['fiscal', nodos[P.nodo].x + (P.id === 'lancha' ? -10 : 14), nodos[P.nodo].y + (P.id === 'lancha' ? -4 : -22)]));
    const o = op[Math.floor(sr() * op.length)], l = DICHOS[o[0]];
    if (l) burbuja(l[Math.floor(sr() * l.length)], o[1], o[2]);
  }
}
function dibujarBurbujas(dt) {
  for (let i = BURB.length - 1; i >= 0; i--) {
    const b = BURB[i]; b.t += dt; if (b.t > 2.2) { BURB.splice(i, 1); continue; }
    const w = b.s.length * 4 + 4, x = Math.round(b.x - w / 2), y = Math.round(b.y - 8 - Math.min(1, b.t * 4) * 3);
    ctx.fillStyle = '#14101c'; ctx.fillRect(x - 1, y - 1, w + 2, 9); ctx.fillStyle = '#fffdf2'; ctx.fillRect(x, y, w, 7);
    ctx.fillRect(Math.round(b.x) - 1, y + 7, 2, 2); texto(b.s, b.x, y + 1, b.col);
  }
}

/* ───────── vida en la isla: carros, gente, avión, crucero, pelícanos, papagayo, flamencos, burros ───────── */
const VIA = TRAZOS.filter((T) => T.kind === 'restinga')[0].pts, CAMINOS = TRAZOS.filter((T) => T.kind === 'normal' || T.kind === 'costa' || T.kind === 'atajo');
const CARROS = [0, .35, .7].map((u, i) => ({ u, v: (i % 2 ? -1 : 1) * (.05 + sr() * .03), c: ['#e0403a', '#ffd23f', '#3fb0ff'][i], bus: i === 1 }));
const GENTE = Array.from({ length: 16 }, () => { const T = CAMINOS[Math.floor(sr() * CAMINOS.length)]; return { T, u: sr(), v: (sr() < .5 ? -1 : 1) * (.006 + sr() * .01), c: ['#e0403a', '#ffd23f', '#3fb0ff', '#ff6fa8', '#fffdf2', '#5cd27a'][Math.floor(sr() * 6)] }; });
const FLAMENCOS = [[246, 222], [266, 244], [240, 258], [276, 226]].map((p, i) => ({ x: p[0], y: p[1], f: i * 1.7 }));
const BURROS = [{ x: 70, y: 196, d: 1 }, { x: 150, y: 250, d: -1 }];
let avion = { t: -8 }, crucero = { x: -80 }, pelicanos = [];
const TORTUGAS = [{ x: 450, y: 326, f: 0 }, { x: 80, y: 92, f: 2 }, { x: 600, y: 40, f: 4 }];
const AGUAVIVAS = [{ x: 600, y: 322, f: 0 }, { x: 36, y: 330, f: 1 }, { x: 380, y: 34, f: 2 }, { x: 180, y: 90, f: 3 }];
const CARDUMEN = [{ x: 470, y: 336, a: 0 }, { x: 120, y: 70, a: 2 }, { x: 330, y: 340, a: 4 }];
const NIEBLA = Array.from({ length: 5 }, (_, i) => ({ x: COPEY.x - 40 + i * 18, y: COPEY.y - 12 + (i % 3) * 8, r: 10 + (i % 2) * 6, v: 2 + i * .5 }));
const MONOS = [{ p: [[398, 176], [410, 170], [420, 178], [406, 186]], f: 0, t: 0 }, { p: [[424, 186], [416, 194], [404, 190]], f: .5, t: 0 }];
const COTORRAS = [{ cx: 430, cy: 160, r: 28, a: 0 }, { cx: 500, cy: 140, r: 20, a: 2 }];
const VENADO = { x: 386, y: 210, d: 1, corre: 0 };
const CABRAS = [[132, 254, '#e8e2d0'], [140, 258, '#8a6a4a'], [60, 206, '#e8e2d0'], [70, 204, '#3a3030'], [176, 222, '#e8e2d0']].map((c) => ({ x: c[0], x0: c[0], y: c[1], c: c[2], t: 0, dx: 0 }));
const VACAS = [{ x: 418, y: 262, f: 0 }, { x: 352, y: 262, f: 2 }];
const KITES = [{ x0: 412, x1: 456, y: 312, v: .35, f: 0, c: '#ff6fa8' }, { x0: 424, x1: 470, y: 322, v: .28, f: 2, c: '#5cd27a' }, { x0: 440, x1: 482, y: 332, v: .4, f: 4, c: '#ffd23f' }];
const enPts = (P, u) => { const i = clamp(u, 0, .9999) * (P.length - 1), k = Math.floor(i), f = i - k, a = P[k], b = P[k + 1] || a; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, b[0] - a[0]]; };
function dibujarVida(t, dt, noche) {
  // carros y la camionetica por La Restinga (ida y vuelta)
  for (const c of CARROS) {
    c.u += c.v * dt; if (c.u > 1 || c.u < 0) { c.v = -c.v; c.u = clamp(c.u, 0, 1); }
    const [x, y, dx] = enPts(VIA, c.u), izq = (dx < 0) !== (c.v < 0), X = Math.round(x), Y = Math.round(y) - 2 + (c.v > 0 ? -1 : 1);
    const w = c.bus ? 7 : 4;
    ctx.fillStyle = '#14101c'; ctx.fillRect(X - 1, Y - 1, w + 2, 4); ctx.fillStyle = c.c; ctx.fillRect(X, Y, w, 2);
    ctx.fillStyle = '#bfe8ff'; ctx.fillRect(izq ? X : X + w - 2, Y, 1, 1); if (c.bus) { ctx.fillStyle = '#fffdf2'; ctx.fillRect(X + 1, Y + 1, w - 2, 1); }
    if (noche > .3) { ctx.fillStyle = `rgba(255,240,150,${noche})`; ctx.fillRect(izq ? X - 3 : X + w + 1, Y, 2, 1); }
  }
  // gente caminando
  for (const g of GENTE) {
    g.u += g.v * dt; if (g.u > 1 || g.u < 0) { g.v = -g.v; g.u = clamp(g.u, 0, 1); }
    const [x, y] = enPts(g.T.pts, g.u), X = Math.round(x) + 2, Y = Math.round(y) - 3, paso = Math.floor(t * 6 + g.u * 50) % 2;
    ctx.fillStyle = '#c98a5a'; ctx.fillRect(X, Y - 1, 1, 1); ctx.fillStyle = g.c; ctx.fillRect(X, Y, 1, 2); ctx.fillStyle = '#14101c'; ctx.fillRect(X - paso, Y + 2, 1, 1); ctx.fillRect(X + 1 - paso, Y + 2, 1, 1);
  }
  // flamencos en la laguna
  for (const f of FLAMENCOS) {
    const X = Math.round(f.x + Math.sin(t * .2 + f.f) * 3), Y = f.y, pico = Math.sin(t * .8 + f.f) > .6;
    ctx.fillStyle = '#ff8ab8'; ctx.fillRect(X, Y - 3, 2, 2); ctx.fillRect(X + 1, Y - 6, 1, 3); ctx.fillRect(X + (pico ? 2 : 1), Y - (pico ? 4 : 7), 1, 1);
    ctx.fillStyle = '#d8507a'; ctx.fillRect(X, Y - 1, 1, 2);
  }
  // burros de Macanao
  for (const b of BURROS) {
    b.x += b.d * 2 * dt; if (Math.abs(b.x - (b === BURROS[0] ? 70 : 150)) > 14) b.d = -b.d;
    const X = Math.round(b.x), Y = b.y, p = Math.floor(t * 4) % 2;
    ctx.fillStyle = '#8a7a6a'; ctx.fillRect(X, Y - 3, 5, 2); ctx.fillRect(b.d > 0 ? X + 4 : X - 1, Y - 5, 2, 2); ctx.fillStyle = '#5a4a3a'; ctx.fillRect(b.d > 0 ? X + 5 : X - 1, Y - 6, 1, 1);
    ctx.fillRect(X + p, Y - 1, 1, 1); ctx.fillRect(X + 3 - p, Y - 1, 1, 1);
  }
  // papagayo (cometa) sobre Macanao
  const kx = 118 + Math.sin(t * .7) * 8, ky = 168 + Math.sin(t * 1.3) * 4;
  ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 10; i++) ctx.fillRect(Math.round(kx + (128 - kx) * i / 10), Math.round(ky + (196 - ky) * i / 10 + Math.sin(i + t * 3)), 1, 1);
  ctx.fillStyle = '#e0403a'; ctx.fillRect(Math.round(kx) - 1, Math.round(ky) - 2, 3, 4); ctx.fillStyle = '#ffd23f'; ctx.fillRect(Math.round(kx), Math.round(ky) - 2, 1, 4);
  // pelícanos que se lanzan en picada
  if (sr() < dt * .25) { let x, y, k = 0; do { x = 20 + sr() * 600; y = 40 + sr() * 300; k++; } while (k < 20 && Math.min(distPoli(x, y, POLI.O), distPoli(x, y, POLI.W)) < 12); pelicanos.push({ x, y, t: 0 }); }
  pelicanos = pelicanos.filter((p) => (p.t += dt) < 1.6);
  for (const p of pelicanos) {
    if (p.t < 1) { const y = p.y - 26 + p.t * p.t * 26; ctx.fillStyle = '#e8e2d0'; ctx.fillRect(Math.round(p.x), Math.round(y), 2, 3); ctx.fillStyle = '#ffb040'; ctx.fillRect(Math.round(p.x), Math.round(y) + 3, 1, 1); }
    else { const r = (p.t - 1) * 8; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(Math.round(p.x - r), Math.round(p.y), Math.round(r * 2) + 1, 1); ctx.fillRect(Math.round(p.x), Math.round(p.y - r), 1, 1); }
  }
  // crucero lento por el norte
  crucero.x += 4 * dt; if (crucero.x > W + 90) crucero.x = -260;
  if (crucero.x > -60) {
    const X = Math.round(crucero.x), Y = 18;
    ctx.fillStyle = '#14101c'; ctx.fillRect(X - 1, Y - 5, 36, 10); ctx.fillStyle = '#fffdf2'; ctx.fillRect(X, Y - 4, 34, 7); ctx.fillStyle = '#2f6fe0'; ctx.fillRect(X, Y + 1, 34, 2);
    ctx.fillStyle = '#e0403a'; ctx.fillRect(X + 24, Y - 8, 3, 4); for (let i = 0; i < 7; i++) { ctx.fillStyle = noche > .3 ? '#ffe680' : '#3a5a8a'; ctx.fillRect(X + 3 + i * 4, Y - 2, 2, 1); }
    ctx.fillStyle = '#e8fbff'; ctx.fillRect(X - 6 - Math.floor(t * 4) % 3, Y + 3, 5, 1);
  }
  // avión que aterriza en el aeropuerto (sureste de Porlamar)
  avion.t += dt; if (avion.t > 22) avion.t = 0;
  if (avion.t < 8) {
    const k = avion.t / 8, X = Math.round(-20 + (462 + 20) * k), Y = Math.round(30 + 258 * k * k), som = Math.round(Y + 30 * (1 - k));
    ctx.fillStyle = 'rgba(10,20,40,.18)'; ctx.fillRect(X + 4, som + 12, 9, 2);
    ctx.fillStyle = '#14101c'; ctx.fillRect(X - 1, Y - 1, 13, 4); ctx.fillStyle = '#fffdf2'; ctx.fillRect(X, Y, 11, 2); ctx.fillStyle = '#e0403a'; ctx.fillRect(X, Y - 2, 2, 2);
    ctx.fillStyle = '#c8c8d8'; ctx.fillRect(X + 4, Y - 3, 3, 1); ctx.fillRect(X + 4, Y + 2, 3, 1);
    if (noche > .3 && Math.floor(t * 4) % 2) { ctx.fillStyle = '#ff4040'; ctx.fillRect(X + 10, Y, 1, 1); }
  }
  // tortugas, aguavivas, cardumen
  for (const g of TORTUGAS) { const a = t * .15 + g.f, x = Math.round(g.x + Math.cos(a) * 16), y = Math.round(g.y + Math.sin(a) * 6); R_(x, y, 4, 3, '#4a7a3a'); R_(x + (Math.cos(a + 1.57) < 0 ? -1 : 4), y + 1, 1, 1, '#8ab86a'); R_(x - 1, y + (Math.floor(t * 3) % 2), 1, 1, '#8ab86a'); R_(x + 4, y + 2 - (Math.floor(t * 3) % 2), 1, 1, '#8ab86a'); }
  for (const g of AGUAVIVAS) { const p = Math.abs(Math.sin(t * 2 + g.f)), x = Math.round(g.x + Math.sin(t * .3 + g.f) * 4), y = Math.round(g.y - p * 2); ctx.fillStyle = 'rgba(255,190,230,.6)'; ctx.fillRect(x, y, 3 + Math.round(p), 2); ctx.fillRect(x, y + 2, 1, 2); ctx.fillRect(x + 2, y + 2, 1, 2); }
  for (const g of CARDUMEN) { g.a += dt * .2; for (let i = 0; i < 7; i++) { const x = g.x + Math.cos(g.a + i * .25) * 20, y = g.y + Math.sin(g.a * 2 + i * .25) * 6; R_(x, y, 1, 1, 'rgba(200,230,255,.7)'); } }
  // El Yaque: kitesurf · Parguito: surf · El Agua: voleibol
  for (const k of KITES) {
    const u = (Math.sin(t * k.v + k.f) + 1) / 2, x = k.x0 + (k.x1 - k.x0) * u, y = k.y + Math.sin(t * 3 + k.f) * 1.5, dir = Math.cos(t * k.v + k.f) > 0 ? 1 : -1;
    R_(x, y, 4, 1, '#fffdf2'); R_(x + 1, y - 2, 1, 2, '#e8b48a'); ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 1; i < 6; i++) ctx.fillRect(Math.round(x + 1 + dir * i * 2), Math.round(y - 2 - i * 3), 1, 1);
    R_(x + 1 + dir * 12 - 3, y - 20, 7, 2, k.c); R_(x + 1 + dir * 12 - 4, y - 19, 1, 2, k.c); R_(x + 1 + dir * 12 + 3, y - 19, 1, 2, k.c);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(Math.round(x - dir * 4), Math.round(y + 1), 3, 1);
  }
  { const k = (t * .25) % 1, x = 634 - k * 20, y = 132 + k * 34; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(Math.round(x) - 3, Math.round(y) + 2, 9, 1); R_(x, y, 4, 1, '#ffd23f'); R_(x + 1, y - 3, 1, 3, '#14101c'); R_(x + 1, y - 4, 1, 1, '#c98a5a'); }
  { const k = (t * .8) % 2, u = k > 1 ? 2 - k : k, bx = 470 + u * 14, by = 52 - Math.sin(u * Math.PI) * 9; R_(468, 54, 1, 3, '#e0403a'); R_(468, 53, 1, 1, '#c98a5a'); R_(486, 54, 1, 3, '#3fb0ff'); R_(486, 53, 1, 1, '#8a5a3a'); R_(bx, by, 2, 2, '#fffdf2'); }
  // El Copey: niebla, monos, cotorras margariteñas y el venado
  for (const n of NIEBLA) { n.x += n.v * dt; if (n.x > COPEY.x + 40) n.x = COPEY.x - 40; ctx.fillStyle = 'rgba(240,248,255,.22)'; ctx.beginPath(); ctx.ellipse(n.x, n.y, n.r, n.r * .45, 0, 0, 6.29); ctx.fill(); }
  for (const m of MONOS) {
    m.t += dt; if (m.salto > 0) m.salto -= dt;
    const k = (m.t * .5 + m.f) % 1, i = Math.floor((m.t * .5 + m.f) % m.p.length), a = m.p[i], b = m.p[(i + 1) % m.p.length];
    m.x = a[0] + (b[0] - a[0]) * k; m.y = a[1] + (b[1] - a[1]) * k - Math.sin(k * Math.PI) * 6 - (m.salto > 0 ? 6 : 0);
    R_(m.x, m.y - 3, 3, 2, '#7a5030'); R_(m.x + 1, m.y - 4, 2, 1, '#f0d0a0'); R_(m.x - 1, m.y - 2 - Math.round(Math.sin(t * 6)), 1, 2, '#7a5030');
  }
  for (const c of COTORRAS) {
    c.a += dt * .5; const x = c.cx + Math.cos(c.a) * c.r, y = c.cy + Math.sin(c.a * 1.3) * c.r * .5, al = Math.floor(t * 8 + c.cx) % 2;
    for (let i = 0; i < 4; i++) { const xx = x - Math.cos(c.a) * i * 4, yy = y + (i % 2) * 2; R_(xx, yy, 2, 1, '#3aa848'); R_(xx + (al ? 0 : 1), yy - 1, 1, 1, '#ffd23f'); R_(xx + 2, yy, 1, 1, '#e0403a'); }
  }
  { if (VENADO.corre > 0) VENADO.corre -= dt; VENADO.x += VENADO.d * (VENADO.corre > 0 ? 18 : 3) * dt; if (Math.abs(VENADO.x - 386) > 18) VENADO.d = -VENADO.d;
    const X = Math.round(VENADO.x), Y = VENADO.y, p = Math.floor(t * (VENADO.corre > 0 ? 10 : 4)) % 2;
    R_(X, Y - 3, 5, 2, '#a8703f'); R_(VENADO.d > 0 ? X + 4 : X - 1, Y - 5, 2, 2, '#a8703f'); R_(VENADO.d > 0 ? X + 5 : X - 1, Y - 7, 1, 2, '#6a4a2a'); R_(X + p, Y - 1, 1, 1, '#6a4a2a'); R_(X + 3 - p, Y - 1, 1, 1, '#6a4a2a'); }
  // cabras de Macanao, vacas y el campesino de San Juan
  for (const c of CABRAS) { c.t -= dt; if (c.t < 0) { c.t = 1 + Math.random() * 3; c.dx = (Math.random() - .5) * 6; } c.x += c.dx * dt; if (Math.abs(c.x - c.x0) > 10) c.dx = -c.dx;
    R_(c.x, c.y - 2, 3, 2, c.c); R_(c.dx > 0 ? c.x + 3 : c.x - 1, c.y - 3, 1, 1, c.c); R_(c.x, c.y, 1, 1, '#3a2a1a'); R_(c.x + 2, c.y, 1, 1, '#3a2a1a'); }
  for (const v of VACAS) { const X = Math.round(v.x + Math.sin(t * .2 + v.f) * 4); R_(X, v.y - 3, 5, 3, '#fffdf2'); R_(X + 1, v.y - 3, 2, 1, '#14101c'); R_(X + 5, v.y - 3, 1, 2, '#fffdf2'); R_(X, v.y, 1, 1, '#14101c'); R_(X + 4, v.y, 1, 1, '#14101c'); }
  { const q = CONUCOS[0], u = (Math.sin(t * .3) + 1) / 2, X = Math.round(q[0] + u * q[2]), Y = q[1] + 4 + 3 * (Math.floor(t * .3 / Math.PI) % 2), p = Math.floor(t * 4) % 2;
    R_(X - 1, Y - 6, 3, 1, '#c8a050'); R_(X, Y - 5, 1, 1, '#c98a5a'); R_(X, Y - 4, 1, 2, '#fffdf2'); R_(X - p, Y - 2, 1, 1, '#2a3a5a'); R_(X + 1 - p, Y - 2, 1, 1, '#2a3a5a'); R_(X + 1, Y - 4, 2, 1, '#8a8a8a'); }
  dibujarEfx(dt);
  dibujarBurbujas(dt);
}
/* ───────── tocar el mapa: cada cosa hace algo; 8 secretos escondidos ───────── */
const EFX = [];
function efx(k, x, y, o) { EFX.push(Object.assign({ k, x, y, t: 0 }, o || {})); }
function dibujarEfx(dt) {
  for (let i = EFX.length - 1; i >= 0; i--) {
    const e = EFX[i]; e.t += dt;
    if (e.k === 'texto') { if (e.t > 1.4) { EFX.splice(i, 1); continue; } texto(e.s, e.x, e.y - e.t * 10, e.c || '#fffdf2', 1, '#14101c'); }
    else if (e.k === 'coco') {
      if (e.t > 1.6) { EFX.splice(i, 1); continue; }
      const k = Math.min(1, e.t / .5), y = e.y - 8 + k * k * 10 - (e.t > .5 ? Math.sin(Math.min(1, (e.t - .5) / .4) * Math.PI) * 3 : 0), x = e.x + (e.t > .5 ? (e.t - .5) * 8 : 0);
      R_(x, y, 2, 2, '#6a4a2a'); if (e.t > .5 && e.t < .6) texto('TOC', e.x, e.y - 14, '#ffd23f', 1, '#14101c');
    }
    else if (e.k === 'humo') { if (e.t > 1) { EFX.splice(i, 1); continue; } ctx.fillStyle = `rgba(230,230,230,${1 - e.t})`; for (let j = 0; j < 5; j++) ctx.fillRect(Math.round(e.x + (e.dx || 1) * e.t * 14 + Math.sin(j * 2) * 3), Math.round(e.y - e.t * 6 + Math.cos(j) * 3), 3, 3); }
    else if (e.k === 'onda') { if (e.t > .8) { EFX.splice(i, 1); continue; } const r = e.t * 12; ctx.fillStyle = `rgba(255,255,255,${.8 - e.t})`; for (let a = 0; a < 6.28; a += .5) ctx.fillRect(Math.round(e.x + Math.cos(a) * r), Math.round(e.y + Math.sin(a) * r * .5), 1, 1); }
    else if (e.k === 'pajaros') { if (e.t > 1.6) { EFX.splice(i, 1); continue; } for (let j = 0; j < 4; j++) { const x = e.x + Math.cos(j * 1.6) * e.t * 20, y = e.y - e.t * 18 - j * 2; R_(x, y, 1, 1, '#14101c'); R_(x - 1 + (Math.floor(e.t * 10) % 2), y - 1, 1, 1, '#14101c'); R_(x + 1, y - 1 + (Math.floor(e.t * 10) % 2), 1, 1, '#14101c'); } }
    else if (e.k === 'brillo') { if (e.t > 1.2) { EFX.splice(i, 1); continue; } for (let j = 0; j < 8; j++) { const a = j * .785 + e.t * 3, r = e.t * 14; R_(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 1, 1, j % 2 ? '#ffd23f' : '#fffdf2'); } }
    else if (e.k === 'fuego') { if (e.t > 1.2) { EFX.splice(i, 1); continue; } fuegos.push({ x: e.x, y: e.y, t: 0, c: e.c || '#ffd23f' }); EFX.splice(i, 1); }
    else if (e.k === 'brinco') { if (e.t > 1.2) { EFX.splice(i, 1); continue; } const x = e.x + e.t * 10, y = e.y - Math.sin(e.t / 1.2 * Math.PI) * 10; R_(x, y, 3, 1, '#c8e0f0'); R_(x + 3, y - 1, 1, 1, '#c8e0f0'); }
  }
}
const SECRETOS = [
  { x: 168, y: 343, nom: 'una botella con un mensaje en Cubagua' }, { x: 224, y: 342, nom: 'un coco de oro en Coche' },
  { x: 628, y: 58, nom: 'una perla en Los Frailes' }, { x: 13, y: 252, nom: 'la X del tesoro en Macanao' },
  { x: 0, y: 0, nom: 'el gato en el techo del Sambil', sambil: true }, { x: 150, y: 262, nom: 'un huevo de iguana entre los cardones' },
  { x: 272, y: 264, nom: 'el ancla hundida de la laguna' }, { x: 308, y: 98, nom: 'el cuatro olvidado en el fortín de Juan Griego' }
].map((q) => Object.assign(q, { hallado: false }));
(function () { const sb = DECO.find((d) => d.k === 'sambil'); const q = SECRETOS.find((x) => x.sambil); if (sb) { q.x = sb.x + 26; q.y = sb.y - 15; } else q.x = 540, q.y = 200; })();
function pistas(t) { for (const q of SECRETOS) if (!q.hallado && Math.sin(t * 1.3 + q.x) > .97) R_(q.x, q.y, 1, 1, '#fffdf2'); }
/* tarjetas de historia (datos cortos y seguros) */
const HISTORIA = {
  castillo: 'Castillo de San Carlos Borromeo, Pampatar: fortaleza colonial del siglo XVII contra piratas y corsarios.',
  fortin: 'Fortín de La Galera, Juan Griego: allí se peleó en 1817, en la guerra de Independencia. Hoy es famoso por sus atardeceres.',
  santarosa: 'Castillo de Santa Rosa, La Asunción: aquí estuvo presa la heroína Luisa Cáceres de Arismendi durante la Independencia.',
  obelisco: 'Cerro Matasiete: el 31 de julio de 1817 los margariteños derrotaron a las tropas realistas de Pablo Morillo.',
  ruinas: 'Nueva Cádiz, en Cubagua: fundada hacia 1528 gracias a las perlas, una de las primeras ciudades de América del Sur.',
  iglesiaC: 'Iglesia colonial: en Margarita hay templos de los siglos XVI y XVII, como la catedral de La Asunción, de las más antiguas de Venezuela.',
  basilica: 'Basílica de la Virgen del Valle: la patrona de oriente. Su fiesta grande es el 8 de septiembre.',
  antena: 'Cerro El Copey: el pico más alto de la isla, con bosque nublado. Allí viven el mono capuchino y la cotorra margariteña.'
};
const REACC = {
  palma: (d) => { efx('coco', d.x + 4, d.y + 2); efx('texto', d.x + 4, d.y - 4, { s: pick2(['¡COCO!', '¡CUIDADO!']) }); return 'coco'; },
  arbol: (d) => { efx('pajaros', d.x + 2, d.y); return 'pio'; }, cardon: (d) => { efx('texto', d.x + 2, d.y - 3, { s: '¡AY, ESPINAS!', c: '#ff8a8a' }); return 'ay'; },
  tuna: (d) => { efx('texto', d.x + 2, d.y - 3, { s: '¡AY!', c: '#ff8a8a' }); return 'ay'; },
  casita: (d) => { efx('texto', d.x + 3, d.y - 3, { s: pick2(['¿QUIEN ES?', '¡YA VOY!', '¡NO HAY AGUA!', '¡CERRAMOS!']) }); return 'toc'; },
  torre: (d) => { efx('texto', d.x + d.w / 2, d.y - d.h - 4, { s: pick2(['¡SE FUE LA LUZ!', '¡VOLVIO LA LUZ!', 'PISO 12']) }); return 'beep'; },
  iglesia: (d) => { efx('texto', d.x + 4, d.y - 6, { s: 'DON DON', c: '#ffd23f' }); efx('onda', d.x + 4, d.y); return 'campana'; },
  catedral: (d) => REACC.iglesia(d), basilica: (d) => { efx('texto', d.x + 4, d.y - 8, { s: 'VIRGEN DEL VALLE', c: '#ffb3d8' }); efx('brillo', d.x + 4, d.y - 2); return 'campana'; },
  castillo: (d) => { efx('humo', d.x + 13, d.y + 2, { dx: 1 }); efx('texto', d.x + 6, d.y - 10, { s: '¡BUM!', c: '#ff8a3d' }); return 'bum'; },
  fortin: (d) => { efx('humo', d.x + 5, d.y + 1, { dx: -1 }); efx('texto', d.x + 2, d.y - 6, { s: '¡BUM!', c: '#ff8a3d' }); return 'bum'; },
  sombrilla: (d) => { efx('texto', d.x + 3, d.y - 3, { s: pick2(['¡QUE CALOR!', '¡PROTECTOR!', '¡AGUA DE COCO!']) }); return 'pio'; },
  churuata: (d) => { efx('texto', d.x + 4, d.y - 3, { s: pick2(['¡UNA FRIA!', '¡PESCADO FRITO!', '¡TOSTONES!']) }); return 'pio'; },
  silla: (d) => { efx('texto', d.x, d.y - 3, { s: 'ZZZ' }); return 'pio'; },
  sambil: (d) => { d.fiesta = 2; for (let i = 0; i < 4; i++) efx('fuego', d.x + 4 + i * 7, d.y - 30 - i * 3, { c: ['#ffd23f', '#ff6fa8', '#9fd8ff', '#5cd27a'][i] }); efx('texto', d.x + 15, d.y - 24, { s: '¡OFERTA!', c: '#ffd23f' }); return 'fiesta'; },
  plaza: (d) => { d.palomas = 1; efx('texto', d.x + 8, d.y - 4, { s: 'PLAZA BOLIVAR' }); return 'pio'; },
  chinchorro: (d) => { d.meneo = 2; efx('texto', d.x + 5, d.y - 6, { s: 'ZZZ...' }); return 'pio'; },
  ruinas: (d) => { efx('brillo', d.x + 3, d.y); efx('texto', d.x + 3, d.y - 4, { s: 'NUEVA CADIZ 1528', c: '#ffd23f' }); return 'brillo'; },
  hotel: (d) => { efx('texto', d.x + 6, d.y - 6, { s: '¡TODO INCLUIDO!' }); return 'pio'; },
  faro: (d) => { efx('brillo', d.x + 1, d.y); efx('texto', d.x, d.y - 4, { s: 'EL FARO' }); return 'brillo'; },
  ferry: (d) => { efx('texto', d.x + 8, d.y - 4, { s: '¡TUUUU!' }); return 'bocina'; },
  colonial: (d) => { efx('texto', d.x + 4, d.y - 3, { s: pick2(['¡BUENAS!', '¿QUIEN VA?', '¡PASE ADELANTE!', '¡HAY CAFE!']) }); return 'toc'; },
  iglesiaC: (d) => { efx('texto', d.x + 4, d.y - 6, { s: 'DON DON', c: '#ffd23f' }); efx('onda', d.x + 4, d.y); return 'campana'; },
  santarosa: (d) => { efx('humo', d.x + 11, d.y + 2, { dx: 1 }); efx('texto', d.x + 5, d.y - 10, { s: '¡LUISA CACERES!', c: '#ffd23f' }); return 'bum'; },
  obelisco: (d) => { efx('brillo', d.x + 1, d.y); efx('texto', d.x + 1, d.y - 8, { s: 'MATASIETE 1817', c: '#ffd23f' }); return 'fiesta'; },
  antena: (d) => { efx('texto', d.x + 2, d.y - 4, { s: '¡SIN SEÑAL!' }); return 'beep'; },
  espanta: (d) => { efx('pajaros', d.x + 1, d.y); efx('texto', d.x + 1, d.y - 4, { s: '¡FUERA!' }); return 'pio'; },
  rancho: (d) => { efx('texto', d.x + 3, d.y - 3, { s: pick2(['¡SANCOCHO!', '¡ARRIBA, COMPADRE!', 'ZZZ']) }); return 'toc'; },
  arbolN: (d) => { efx('pajaros', d.x + 2, d.y); return 'pio'; }, arbusto: (d) => { efx('pajaros', d.x + 1, d.y); return 'pio'; }
};
function pick2(l) { return l[Math.floor(Math.random() * l.length)]; }
function centro(d) {
  if (d.k === 'torre') return [d.x + d.w / 2, d.y - d.h / 2];
  if (d.k === 'sambil') return [d.x + 15, d.y - 9];
  const S = SPR[d.k], rows = Array.isArray(S && S[0]) ? S[0] : S;
  return rows ? [d.x + rows[0].length / 2, d.y + rows.length / 2] : [d.x + 4, d.y + 3];
}
function tocar(x, y) {
  for (const q of SECRETOS) if (!q.hallado && Math.hypot(q.x - x, q.y - y) < 6) {
    q.hallado = true; efx('brillo', q.x, q.y); efx('texto', q.x, q.y - 6, { s: '¡SECRETO!', c: '#ffd23f' });
    return { secreto: q.nom, hallados: SECRETOS.filter((z) => z.hallado).length, total: SECRETOS.length, sonido: 'secreto' };
  }
  for (const c of (typeof CRIAT !== 'undefined' ? CRIAT.lista : [])) if (Math.hypot(c.x - x, c.y - 8 - y) < 16) {
    const s = { barco: '¡ARRR!', kraken: '¡GLUB GLUB!', sirena: '♪ LA LA LA ♪', ovni: '¡BIP BUP!', silbon: 'FIU FIU FIU', cisterna: '¡AGUAAA!', procesion: '¡AVE MARIA!', peces: '¡PLAF!' }[c.k];
    efx('texto', c.x, c.y - 26, { s, c: '#b8f0ff' }); return { sonido: c.k === 'silbon' ? 'silbido' : 'bocina' };
  }
  const moviles = [].concat(BURROS.map((b) => ['burro', b.x + 2, b.y - 3, b]), FLAMENCOS.map((f) => ['flamenco', f.x, f.y - 4, f]), VELEROS.map((v) => ['velero', v.x + 3, v.y + 3, v]));
  if (crucero.x > -40) moviles.push(['crucero', crucero.x + 17, 18, crucero]);
  for (const m of MONOS) moviles.push(['mono', m.x, m.y, m]); for (const c of CABRAS) moviles.push(['cabra', c.x, c.y, c]); moviles.push(['venado', VENADO.x, VENADO.y, VENADO]);
  for (const [k, mx, my, o] of moviles) if (Math.hypot(mx - x, my - y) < 8) {
    if (k === 'burro') { efx('texto', mx, my - 6, { s: '¡IIIH-AAA!' }); return { sonido: 'burro' }; }
    if (k === 'flamenco') { o.y -= 0; efx('pajaros', mx, my); efx('texto', mx, my - 6, { s: '¡FLAP!', c: '#ffb3d8' }); return { sonido: 'pio' }; }
    if (k === 'velero') { o.v *= -1; efx('texto', mx, my - 8, { s: '¡HOLA!' }); return { sonido: 'pio' }; }
    if (k === 'crucero') { efx('texto', mx, my - 12, { s: '¡TUUUUU!' }); return { sonido: 'bocina' }; }
    if (k === 'mono') { o.salto = 1; efx('texto', mx, my - 8, { s: '¡UH UH AH!' }); return { sonido: 'pio', historia: 'El mono capuchino de Margarita vive en los bosques de El Copey.' }; }
    if (k === 'cabra') { efx('texto', mx, my - 6, { s: '¡BEEE!' }); return { sonido: 'burro' }; }
    if (k === 'venado') { o.corre = 2; efx('texto', mx, my - 8, { s: '¡ZAS!' }); return { sonido: 'pio', historia: 'El venado de Margarita es una especie que solo vive en esta isla.' }; }
  }
  for (const N of NPCS) if (Math.hypot(N.x - x, N.y - y) < 9 && DICHOS[N.k]) { const l = DICHOS[N.k]; burbuja(l[Math.floor(Math.random() * l.length)], N.x, N.y - 10); return { sonido: 'pio' }; }
  if (Math.hypot(316 + 8 - x, 306 + 3 - y) < 10) return { sonido: REACC.ferry({ x: 316, y: 306 }) };
  let mejor = null, dm = 9;
  for (const d of DECO) { const [cx, cy] = centro(d), e = Math.hypot(cx - x, cy - y); if (e < dm && REACC[d.k]) { dm = e; mejor = d; } }
  if (mejor) return { sonido: REACC[mejor.k](mejor), historia: HISTORIA[mejor.k] };
  const agua = Math.min(distPoli(x, y, POLI.O), distPoli(x, y, POLI.W), distPoli(x, y, POLI.C), distPoli(x, y, POLI.I)) > 2;
  if (agua) { efx('onda', x, y); if (Math.random() < .25) efx('brinco', x - 5, y); return { sonido: 'agua' }; }
  return null;
}
const { LUGARES, lugarCerca } = G;
function dibujarNombres(t) {
  if (t !== undefined) pistas(t); for (const [s, x, y] of LUGARES) texto(s, x, y, '#fff2c8', 1, '#14101c'); }

if (typeof console !== 'undefined') {
  const c = {}; nodos.forEach((n) => { c[n.t] = (c[n.t] || 0) + 1; });
  console.log('[margarita] casillas', nodos.length, JSON.stringify(c));
}
return { nodos, J, SEGS, PEAJES, PUESTOS, ISLAS, COCHE, NPCS, TRAZOS, HISTORIA, tocar, efx, SECRETOS, DECO, rutaBote, dibujarNPCs, dibujarVida, burbuja, lugarCerca, dibujarMar, dibujarDeco, dibujarCielo, dibujarNombres, dibujarEstado, distPoli, POLI };
})();
