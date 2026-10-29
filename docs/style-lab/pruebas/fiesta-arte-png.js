// LA FIESTA · volcado del arte del mapa a PNG SIN navegador (el arte es un búfer puro).
// Uso: node docs/style-lab/pruebas/fiesta-arte-png.js [salida.png] [x0,y0,x1,y1 en DISEÑO 0..1000] [factor de ampliación entero, def. 1] [debug]
//   p. ej. recorte del lago:  node fiesta-arte-png.js /tmp/lago.png 60,150,300,380 4
//   debug = 'bioma' | 'dist' | 'reg' | 'ocupado' pinta ese campo en vez del arte.  Añade 'casillas' como 5.º arg para ver nodos y caminos encima.
// Carga fiesta-arte-*.js de la carpeta (todas las capas) y escribe el PNG; imprime tiempos por capa y errores.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const LAB = path.join(__dirname, '..');
global.FIESTA = global.FIESTA || {};
const ARTE = require(path.join(LAB, 'fiesta-mapa-arte.js'));
fs.readdirSync(LAB).filter((f) => /^fiesta-arte-.*\.js$/.test(f)).sort().forEach((f) => require(path.join(LAB, f)));
const out = process.argv[2] || path.join(__dirname, 'out', 'fiesta-arte.png');
const caja = (process.argv[3] || '0,0,1000,1000').split(',').map(Number);
const k = Math.max(1, parseInt(process.argv[4] || '1', 10));
const debug = process.argv[5] || '', conCasillas = process.argv[6] === 'casillas' || debug === 'casillas';
const A = ARTE.construir({});
// animaciones: con T=<segundos> se pintan las entidades A.dyn (ctx falso que escribe en el búfer) para verlas en el PNG
if (process.env.T !== undefined) {
  const t = parseFloat(process.env.T) || 0; let fill = 0xffffffff, ga = 1;
  const parse = (s) => { s = String(s); const m = /rgba?\(([^)]+)\)/.exec(s); if (m) { const v = m[1].split(',').map(Number); ga = v.length > 3 ? v[3] : 1; return (255 << 24 | v[2] << 16 | v[1] << 8 | v[0]) >>> 0; } ga = 1; return ARTE.rgb(s); };
  const c = { set fillStyle(v) { fill = parse(v); }, get fillStyle() { return '#fff'; }, globalAlpha: 1, imageSmoothingEnabled: false,
    fillRect(x, y, w, h) { const a = ga * this.globalAlpha; for (let j = Math.floor(y); j < Math.ceil(y + h); j++) for (let i = Math.floor(x); i < Math.ceil(x + w); i++) if (i >= 0 && j >= 0 && i < A.W && j < A.H) A.buf[j * A.W + i] = a >= 1 ? fill : ARTE.mezcla(A.buf[j * A.W + i], fill, a); },
    save() {}, restore() {}, scale() {}, translate() {}, beginPath() {}, };
  let n = 0; for (const e of A.dyn) { const f = ARTE.din[e.k]; if (f) { try { f(c, e, t); n++; } catch (err) { console.log('din', e.k, err.message); } } }
  console.log('dyn pintadas', n, 'de', A.dyn.length);
}
console.log('tiempos(ms)', JSON.stringify(A.tiempos));
if (A.errores.length) console.log('ERRORES', A.errores);
console.log('capas', ARTE.capas().join(' '));
const x0 = Math.max(0, Math.round(caja[0] * A.SX)), y0 = Math.max(0, Math.round(caja[1] * A.SY));
const x1 = Math.min(A.W, Math.round(caja[2] * A.SX)), y1 = Math.min(A.H, Math.round(caja[3] * A.SY));
const w = x1 - x0, h = y1 - y0, OW = w * k, OH = h * k, raw = Buffer.alloc((OW * 4 + 1) * OH);
const colBio = [0x80402010, 0xff5ab4e0, 0xff3ac6b8, 0xff1f7f2a, 0xffe0e0e0, 0xff8a4fc0, 0xff40c8e0, 0xffa0a0a0, 0xff3aa8c0];
const nodoEn = {};
if (conCasillas) A.nodos.forEach((n) => { nodoEn[Math.round(n.x) + ',' + Math.round(n.y)] = 1; });
for (let y = 0; y < OH; y++) {
  raw[y * (OW * 4 + 1)] = 0;
  for (let x = 0; x < OW; x++) {
    const sx = x0 + ((x / k) | 0), sy = y0 + ((y / k) | 0), i = sy * A.W + sx;
    let c = A.buf[i];
    if (debug === 'bioma') c = colBio[A.bioma[i]] || 0xff000000;
    else if (debug === 'dist') { const d = Math.max(-255, Math.min(255, A.dist[i] / 3 * 2)); c = d >= 0 ? (0xff000000 | (d << 8) | (d >> 1)) : (0xff000000 | ((-d) << 16)); }
    else if (debug === 'reg') c = 0xff000000 | (A.reg[i] * 22 << 16) | (A.reg[i] * 53 % 256 << 8) | (A.reg[i] * 97 % 256);
    else if (debug === 'ocupado') c = A.ocupado[i] ? 0xff0000ff : (A.tierra[i] ? 0xff304030 : 0xff402010);
    if (conCasillas && A.ocupado[i] && !debug) c = (c & 0x00ffffff) * 0 + 0xff4040ff;
    const o = y * (OW * 4 + 1) + 1 + x * 4;
    raw[o] = c & 255; raw[o + 1] = (c >> 8) & 255; raw[o + 2] = (c >> 16) & 255; raw[o + 3] = 255;
  }
}
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(OW, 0); ihdr.writeUInt32BE(OH, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: process.env.HORNEAR ? 9 : 3 })), chunk('IEND', Buffer.alloc(0))]));
console.log('png', out, OW + 'x' + OH, (fs.statSync(out).size / 1024 | 0) + ' KB');
// HORNEAR=1: además del PNG, escribe <salida>.dyn.json (las animaciones). Producción: node fiesta-arte-png.js docs/style-lab/assets/fiesta/mapa-venezuela.png 0,0,1000,1000 1  (con HORNEAR=1, SIN T)
if (process.env.HORNEAR) { const j = out.replace(/\.png$/, '.dyn.json'); fs.writeFileSync(j, JSON.stringify(A.dyn)); console.log('dyn', j, A.dyn.length, 'entidades'); }
