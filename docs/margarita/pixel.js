'use strict';
/* Isla de Margarita · utilidades de pixel compartidas (canvas, fuente 3x5, sprites por cadenas). Globales para mapa.js y margarita.js. */
const W = 640, H = 360;
/* el mundo se dibuja a 640x360 en un canvas aparte (ctx); la cámara de margarita.js lo copia ampliado al canvas visible (vctx, 2x) */
const cv = document.getElementById('b'), vctx = cv.getContext('2d');
const mundoCv = document.createElement('canvas'); mundoCv.width = W; mundoCv.height = H;
const ctx = mundoCv.getContext('2d');
ctx.imageSmoothingEnabled = false; vctx.imageSmoothingEnabled = false;
const R = Math.random;
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = (l) => l[Math.floor(R() * l.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ───────── fuente 3x5 ───────── */
const F3 = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', '?': '110001010000010', ' ': '000000000000000',
  botella: '010010111111111', rayo: '001010111010100', regalo: '010111101111111', plata: '011110010011110', nota: '011010010110110'
};
function glyph(g, x, y, col, s) {
  s = s || 1; const b = F3[g] || F3[' ']; ctx.fillStyle = col;
  for (let i = 0; i < 15; i++) if (b[i] === '1') ctx.fillRect(x + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
}
function texto(t, x, y, col, s, sombra) {
  s = s || 1; t = String(t).toUpperCase().replace(/[ÁÀ]/g, 'A').replace(/[ÉÈ]/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U').replace(/Ñ/g, 'N');
  const w = t.length * 4 * s - s; x = Math.round(x - w / 2);
  for (let i = 0; i < t.length; i++) { if (sombra) glyph(t[i], x + i * 4 * s + s, y + s, sombra, s); glyph(t[i], x + i * 4 * s, y, col, s); }
}

/* ───────── sprites (cadenas + paleta) ───────── */
function sprite(rows, pal, x, y, flip) {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    for (let i = 0; i < r.length; i++) {
      const c = r[flip ? r.length - 1 - i : i]; if (c === '.') continue;
      ctx.fillStyle = pal[c]; ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
}
const PJ_ROWS = [
  '..hhhh..',
  '.hhhhhh.',
  '.hssssh.',
  '.sekske.',
  '.ssssss.',
  '..cccc..',
  '.cccccc.',
  '.sccccs.',
  '..pppp..',
  '..p..p..',
  '..z..z..'
];
const SENORA = [
  '..rrrr..',
  '.rrrwrr.',
  '.hssssh.',
  '..sese..',
  '..ssss..',
  '.wwwwww.',
  'swaaaaws',
  '.waaaaw.',
  '.bbbbbb.',
  '..b..b..'
];
const BACHA = [
  '..kkkk..',
  '.kkkkkkk',
  '..ssss..',
  '..gggg..',
  '..ssss..',
  '.tttttt.',
  'stttttth',
  '.tttttt.',
  '..jjjj..',
  '..j..j..'
];
const PAL_SENORA = { r: '#d23b3b', w: '#fffdf2', s: '#c98a5a', e: '#14101c', b: '#2a4a8a', h: '#3a2a22', a: '#ffd23f' };
const PAL_BACHA = { k: '#1a1a24', s: '#a8703f', g: '#14101c', t: '#e8a020', h: '#a8703f', j: '#2a3a5a' };
const EMPANADA = ['..yyy..', '.yyyyy.', 'yyyyyyy', 'ooooooo', '.o.o.o.'];
const PAL_EMP = { y: '#ffd23f', o: '#d08a1a' };
/* icono de la empanada (media luna con repulgue): para la baliza, la flecha y el letrero del puesto */
const EMPANADA_ICO = [
  '....kkkkkkk....',
  '..kkyyyyyyykk..',
  '.kyllyyyyyyyyk.',
  'kyllyyyyyyyyyok',
  'kyyyyyyyyyyyyok',
  'kooyoyoyoyoyook',
  '.kkokokokokokk.',
  '...kkkkkkkkk...'
];
const PAL_EMPICO = { k: '#14101c', y: '#ffd23f', l: '#fff6b0', o: '#d08a1a' };
const EMPANADA_MINI = ['.kkkkk.', 'kyyylyk', 'kooyook', '.kkkkk.'];
const PIMPINA = ['.kk.', 'rrrr', 'rwrr', 'rrrr', 'rrrr'];
const PAL_PIMP = { k: '#14101c', r: '#d23b3b', w: '#ffb3b3' };
const PENERO = [
  '......mm..........',
  '......mm..........',
  'wwwwwwwwwwwwwwwww.',
  '.wbbbbbbbbbbbbbbw.',
  '..wwwwwwwwwwwwww..',
  '...rrrrrrrrrrrr...'
];
const PAL_PEN = { m: '#6a4a2a', w: '#fffdf2', b: '#2f6fe0', r: '#d23b3b' };
const PALMA = [
  '..gg.gg..',
  '.ggggggg.',
  'gg.ggg.gg',
  '....t....',
  '....t....',
  '...t.....',
  '...t.....',
  '...t.....'
];
const PAL_PALMA = { g: '#2f8a3a', t: '#8a5a2a' };
const CARDON = ['..g..', 'g.g..', 'g.g.g', 'ggg.g', '..ggg', '..g..', '..g..'];
const PAL_CARDON = { g: '#3f7a3a' };
const CASA = ['..rrrr..', '.rrrrrr.', 'rrrrrrrr', '.wwwwww.', '.wkwwdw.', '.wwwwdw.'];
const PAL_CASA = [{ r: '#d2563b', w: '#f3e3c3', k: '#2a6fb0', d: '#6a4a2a' }, { r: '#3b8ad2', w: '#fff0d0', k: '#d2563b', d: '#6a4a2a' }, { r: '#e8c040', w: '#f3e3f3', k: '#2a6fb0', d: '#6a4a2a' }];
const CASTILLO = ['m.m.m.m.m.m', 'mmmmmmmmmmm', 'mnmmmmmmmnm', 'mmmmmddmmmm', 'mmmmmddmmmm'];
const PAL_CAST = { m: '#b8a888', n: '#8a7a60', d: '#4a3a2a' };
