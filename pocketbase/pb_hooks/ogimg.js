/* Per-room link-preview image (1200x630 PNG) for /r/<CODE>/og.png: the room code in big chunky pixel letters, so a shared link shows
   the code right in the chat. Pure JS, no dependencies (goja has no canvas / zlib): an indexed-colour bitmap drawn from a 5x7 font and a
   tiny deflate (fixed Huffman + run/previous-row matches), which squeezes the flat colours to a few KB. Tested in ogimg.test.js. */
const W = 1200, H = 630;
const PAL = [[106, 61, 232], [124, 77, 255], [255, 225, 77], [20, 16, 28], [255, 255, 255], [92, 255, 122], [53, 64, 106], [221, 221, 221]];
const BG = 0, BAND = 1, YEL = 2, INK = 3, WHT = 4, GRN = 5, NAVY = 6, GREY = 7;

const FONT = {
  A: "01110 10001 10001 11111 10001 10001 10001", B: "11110 10001 10001 11110 10001 10001 11110", C: "01110 10001 10000 10000 10000 10001 01110",
  D: "11110 10001 10001 10001 10001 10001 11110", E: "11111 10000 10000 11110 10000 10000 11111", F: "11111 10000 10000 11110 10000 10000 10000",
  G: "01110 10001 10000 10111 10001 10001 01111", H: "10001 10001 10001 11111 10001 10001 10001", I: "01110 00100 00100 00100 00100 00100 01110",
  J: "00111 00010 00010 00010 00010 10010 01100", K: "10001 10010 10100 11000 10100 10010 10001", L: "10000 10000 10000 10000 10000 10000 11111",
  M: "10001 11011 10101 10101 10001 10001 10001", N: "10001 11001 10101 10011 10001 10001 10001", O: "01110 10001 10001 10001 10001 10001 01110",
  P: "11110 10001 10001 11110 10000 10000 10000", Q: "01110 10001 10001 10001 10101 10010 01101", R: "11110 10001 10001 11110 10100 10010 10001",
  S: "01111 10000 10000 01110 00001 00001 11110", T: "11111 00100 00100 00100 00100 00100 00100", U: "10001 10001 10001 10001 10001 10001 01110",
  V: "10001 10001 10001 10001 10001 01010 00100", W: "10001 10001 10001 10101 10101 11011 10001", X: "10001 10001 01010 00100 01010 10001 10001",
  Y: "10001 10001 01010 00100 00100 00100 00100", Z: "11111 00001 00010 00100 01000 10000 11111",
  0: "01110 10001 10011 10101 11001 10001 01110", 1: "00100 01100 00100 00100 00100 00100 01110", 2: "01110 10001 00001 00010 00100 01000 11111",
  3: "11110 00001 00001 01110 00001 00001 11110", 4: "00010 00110 01010 10010 11111 00010 00010", 5: "11111 10000 11110 00001 00001 10001 01110",
  6: "00110 01000 10000 11110 10001 10001 01110", 7: "11111 00001 00010 00100 01000 01000 01000", 8: "01110 10001 10001 01110 10001 10001 01110",
  9: "01110 10001 10001 01111 00001 00010 01100", ".": "00000 00000 00000 00000 00000 01100 01100", "!": "00100 00100 00100 00100 00100 00000 00100",
};
const GLYPH = {}; for (const k in FONT) GLYPH[k] = FONT[k].split(" ");

function canvas() { const px = new Uint8Array(W * H); return { px }; }
function rect(c, x, y, w, h, col) {
  x = Math.max(0, x | 0); y = Math.max(0, y | 0); const x2 = Math.min(W, (x + w) | 0), y2 = Math.min(H, (y + h) | 0);
  for (let j = y; j < y2; j++) c.px.fill(col, j * W + x, j * W + x2);
}
const textW = (s, sc) => s.length * 6 * sc - sc;
function text(c, s, x, y, sc, col, shadow) {
  for (let i = 0; i < s.length; i++) {
    const g = GLYPH[s[i].toUpperCase()]; if (!g) continue;
    for (const pass of shadow ? [[shadow, sc * .4], [col, 0]] : [[col, 0]]) {
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r][q] === "1") rect(c, x + i * 6 * sc + q * sc + pass[1], y + r * sc + pass[1], sc, sc, pass[0]);
    }
  }
}
const center = (c, s, y, sc, col, shadow) => text(c, s, Math.round((W - textW(s, sc)) / 2), y, sc, col, shadow);

function draw(code) {
  const c = canvas(); rect(c, 0, 0, W, H, BG);
  for (let i = 0; i < 6; i++) rect(c, 0, 20 + i * 110, W, 44, BAND);
  center(c, "JOIN MY MINICAOS ROOM", 44, 7, WHT, INK);
  // code plate
  rect(c, 158, 150, 884, 322, INK); rect(c, 170, 162, 860, 298, NAVY);
  const sc = 28, gap = 40, tw = 4 * 5 * sc + 3 * gap, x0 = Math.round((W - tw) / 2);
  for (let i = 0; i < 4; i++) text(c, code[i], x0 + i * (5 * sc + gap), 206, sc, YEL, INK);
  center(c, "TAP THE LINK TO JOIN!", 508, 7, GRN, INK);
  center(c, "MINICAOS.GUILLE.TECH", 576, 5, WHT, INK);
  return c.px;
}

/* ───────────── PNG encoder ───────────── */
let CRC_T = null;
function crc32(b, init) {
  if (!CRC_T) { CRC_T = new Int32Array(256); for (let n = 0; n < 256; n++) { let v = n; for (let k = 0; k < 8; k++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1; CRC_T[n] = v; } }
  let v = init === undefined ? -1 : init; for (let i = 0; i < b.length; i++) v = CRC_T[(v ^ b[i]) & 255] ^ (v >>> 8); return v;
}
function adler32(b) { let a = 1, s = 0; for (let i = 0; i < b.length; i++) { a = (a + b[i]) % 65521; s = (s + a) % 65521; } return ((s << 16) | a) >>> 0; }
const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
function deflate(data, rowLen) {
  const out = []; let bitBuf = 0, bitCnt = 0;
  const bits = (v, n) => { bitBuf |= v << bitCnt; bitCnt += n; while (bitCnt >= 8) { out.push(bitBuf & 255); bitBuf >>>= 8; bitCnt -= 8; } };
  const huff = (code, n) => { let r = 0; for (let i = 0; i < n; i++) r |= ((code >> i) & 1) << (n - 1 - i); bits(r, n); };   // Huffman codes go MSB first
  const lit = (s) => { if (s < 144) huff(0x30 + s, 8); else if (s < 256) huff(0x190 + s - 144, 9); else if (s < 280) huff(s - 256, 7); else huff(0xC0 + s - 280, 8); };
  bits(1, 1); bits(1, 2);                                        // final block, fixed Huffman
  const n = data.length;
  for (let i = 0; i < n;) {
    let best = 0, bd = 0;
    for (const d of [1, rowLen]) {
      if (i < d) continue; let l = 0; while (l < 258 && i + l < n && data[i + l] === data[i + l - d]) l++;
      if (l > best) { best = l; bd = d; }
    }
    if (best >= 3) {
      let li = 28; while (LBASE[li] > best) li--;
      lit(257 + li); if (LEXTRA[li]) bits(best - LBASE[li], LEXTRA[li]);
      let di = 29; while (DBASE[di] > bd) di--;
      huff(di, 5); if (DEXTRA[di]) bits(bd - DBASE[di], DEXTRA[di]);
      i += best;
    } else { lit(data[i]); i++; }
  }
  lit(256); if (bitCnt) bits(0, 8 - bitCnt);
  return out;
}
function png(px) {
  const rowLen = W + 1, raw = new Uint8Array(rowLen * H);
  for (let y = 0; y < H; y++) { raw[y * rowLen] = 0; raw.set(px.subarray(y * W, (y + 1) * W), y * rowLen + 1); }
  const z = [0x78, 0x01].concat(deflate(raw, rowLen)), ad = adler32(raw); z.push(ad >>> 24, (ad >>> 16) & 255, (ad >>> 8) & 255, ad & 255);
  const out = [137, 80, 78, 71, 13, 10, 26, 10];
  const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const chunk = (type, body) => {
    const t = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)], all = t.concat(body);
    return u32(body.length).concat(all, u32((crc32(all) ^ -1) >>> 0));
  };
  const plte = []; PAL.forEach((p) => plte.push(p[0], p[1], p[2]));
  return out.concat(chunk("IHDR", u32(W).concat(u32(H), [8, 3, 0, 0, 0])), chunk("PLTE", plte), chunk("IDAT", z), chunk("IEND", []));
}
/* code: 4 chars A-Z / 2-9 -> array of PNG bytes */
function roomImage(code) {
  const c = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return png(draw((c + "????").slice(0, 4).replace(/\?/g, "-")));
}
module.exports = { roomImage, W, H, PAL };
