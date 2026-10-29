// LA FIESTA · pantallas del minijuego en vivo (M2, E2). Contrato: docs/mario-party/M2-SPEC.md §5.
// fiesta-carta dibuja TODO lo que rodea al juego y nada del juego mismo (eso es sess.draw()): ruleta de formato, tarjeta de instrucciones
// (controles + PRÁCTICA + ¡LISTO!), práctica, cuenta 3-2-1, HUD (franja de 64 px), controles táctiles/teclado, «¡SE ACABÓ!» y podio.
// Modo inmediato sobre las primitivas del laboratorio (rr, ell, line, poly, txt, bust) vía F.ui.d: sale en los 6 estilos.
// No habla con la red: emite INTENCIONES por opts.emit ({k:'ready'} | {k:'back'} | {k:'practica', on}) y fiesta-main las conecta.
// Puros (probados en Node, test/fiesta-carta.test.js): fase · teclaAInput · stickDe · layoutPads · layoutTarjeta · layoutHud ·
//   podioModelo · tituloPodio · cartaParaRol · modeloRuleta · textoFormato · KEYS
// API: F.carta.crear({emit}) -> C   C.abrir(sess) · C.cerrar() · C.dibujar(vm) -> bool (false = «espera»: main dibuja el tablero)
//   C.B (registro de botones) · C.mover(x,y,abajo) · C.down(id,x,y) · C.move(id,x,y) · C.up(id,x,y) · C.tecla(code, abajo) -> bool
//   C.practica(on) · C.fase · C.practicando · C.modelo()
// vm = {S (board mostrado), D, yo, serverNow, izq, der, compacto, seats, sess, net, dt?, ahoraMs?}
// Sin ?. ni ?? ni spread de objetos (se parece al resto de fiesta-*.js).
(function (root) {
'use strict';
const F = root.FIESTA = root.FIESTA || {};
const DW = 800, DH = 600, HUDH = 64, INKC = '#14101c';
const K = { RULETA_MS: 4500, GIRO_MS: 3000, REL_CARTA: 1400, ZONA_STICK: .45, STICK_R: 60, MUERTA: .12, PODIO_CUENTA_MS: 1300, FIN_MS: 1200,
  YA_MS: 800, PRAC_REINICIO: 1.6, COL_EQ: ['#2f6fdb', '#d93a3a'] };

/* ───────────── puros ───────────── */
function reglasT() { const R = F.reglas || (typeof module !== 'undefined' && typeof require !== 'undefined' ? safeReq('./fiesta-reglas.js') : null); return (R && R.T) || { carta: 19500, relCarta: 1400 }; }
function safeReq(p) { try { return require(p); } catch (e) { return null; } }
// qué pantalla toca (S = board mostrado, ahora = ms del reloj del servidor, sess = sesión en vivo o null)
function fase(S, ahora, sess) {
  if (!S || !S.mj) return null;
  const mj = S.mj, T = reglasT();
  if (S.f === 'res') return 'podio';
  if (S.f === 'carta') {
    const t0 = mj.cartaHasta - (mj.rel ? T.relCarta : T.carta);
    if (ahora < t0) return 'espera';
    if (ahora < t0 + (mj.rel ? 0 : K.RULETA_MS)) return 'ruleta';
    return 'tarjeta';
  }
  if (S.f === 'mj') {
    if (mj.startAt == null) return 'tarjeta';
    if ((ahora - mj.startAt) / 1000 < 0) return 'cuenta';
    if (sess && sess.over) return 'fin';
    return 'juego';
  }
  return null;
}
// tecla -> entrada: {b:'a'|'b'} (botón) · {e:'u'|'d'|'l'|'r'} (eje) · null
const KEYS = { KeyW: { e: 'u' }, ArrowUp: { e: 'u' }, KeyS: { e: 'd' }, ArrowDown: { e: 'd' }, KeyA: { e: 'l' }, ArrowLeft: { e: 'l' }, KeyD: { e: 'r' }, ArrowRight: { e: 'r' },
  Space: { b: 'a' }, KeyJ: { b: 'a' }, ShiftLeft: { b: 'b' }, ShiftRight: { b: 'b' }, KeyK: { b: 'b' } };
function teclaAInput(code) { const k = KEYS[code]; return k ? Object.assign({}, k) : null; }
// vector del pulgar (dx,dy en unidades lógicas desde el origen) -> {x,y} con módulo 0..1: 0 dentro de la zona muerta (12 %), 1 a partir del radio
function stickDe(dx, dy, radio, muerta) {
  radio = radio || K.STICK_R; muerta = muerta === undefined ? K.MUERTA : muerta;
  const d = Math.sqrt(dx * dx + dy * dy), m = d / radio;
  if (!(d > 0) || m < muerta) return { x: 0, y: 0 };
  const k = Math.min(1, m) / d;
  return { x: dx * k, y: dy * k };
}
// controles: vw = ancho lógico de la vista (≥800), vh = 600. `vertical` = el 800×600 va en caja (compacto y vw≈800): los pads van en la
// franja de abajo (y>470). Cada rect {x,y,w,h} de «zona» es donde cuenta el pulgar; el círculo es solo lo que se ve.
function layoutPads(vw, vh, compacto, def) {
  vh = vh || DH; def = def || {};
  const izq = (DW - vw) / 2, der = izq + vw, vertical = !!compacto && vw <= DW + 1, grande = compacto ? 1.2 : 1;
  let rA = vertical ? 58 : Math.round(52 * grande), rB = vertical ? 42 : Math.round(40 * grande), rS = vertical ? 58 : 60;
  // vertical con stick + 2 botones (juegos de equipo, p. ej. futbolito): en ~340 px de ancho no caben tres pads de 116/84/116 px, así que se
  // encogen en proporción (sin tocar el caso de 1 botón ni el apaisado, que ya cabían).
  if (vertical && def.stick && def.botones >= 2) { const s = Math.min(1, (vw - 40) / (2 * rS + 2 * rA + 2 * rB)); rA = Math.round(rA * s); rB = Math.round(rB * s); rS = Math.round(rS * s); }
  const yA = vertical ? 535 : Math.round(vh - rA - 28);
  const L = { izq: izq, der: der, vertical: vertical, hud: { x: izq, y: 0, w: vw, h: HUDH } };
  L.a = { x: der - rA - (vertical && def.stick && def.botones >= 2 ? 14 : 24), y: yA, r: rA };
  L.a.rect = { x: L.a.x - L.a.r, y: L.a.y - L.a.r, w: L.a.r * 2, h: L.a.r * 2 };
  L.b = def.botones >= 2 ? { x: L.a.x - rA - rB - (vertical ? 6 : 12), y: yA - (vertical ? 4 : rB * .9), r: rB } : null;
  if (L.b) L.b.rect = { x: L.b.x - L.b.r, y: L.b.y - L.b.r, w: L.b.r * 2, h: L.b.r * 2 };
  L.stick = def.stick ? { x: izq + rS + (vertical && def.botones >= 2 ? 14 : 28), y: vertical ? 535 : Math.round(vh - rS - 30), r: rS } : null;
  if (L.stick) L.stick.rect = { x: L.stick.x - L.stick.r, y: L.stick.y - L.stick.r, w: L.stick.r * 2, h: L.stick.r * 2 };
  // zonas del pulgar (fuera del HUD): con stick, 45 % izquierdo = stick y el resto = A; sin stick, TODA la pantalla jugable = A
  const top = HUDH, zh = vh - top;
  L.zonaStick = def.stick ? { x: izq, y: top, w: Math.round(vw * K.ZONA_STICK), h: zh } : null;
  L.zonaA = def.stick ? { x: izq + Math.round(vw * K.ZONA_STICK), y: top, w: vw - Math.round(vw * K.ZONA_STICK), h: zh } : { x: izq, y: top, w: vw, h: zh };
  return L;
}
// tarjeta: rectángulos de todo lo que se dibuja (el HUD de 64 px y el reloj de juego NO se usan aquí: la franja queda libre para el título)
function layoutTarjeta(vw, vh, compacto) {
  vh = vh || DH; const izq = (DW - vw) / 2, cx = izq + vw / 2, c = !!compacto;
  const bh = c ? 76 : 62, y = vh - bh - 18, W0 = Math.min(vw, DW) - 40, x0 = cx - W0 / 2, ph = c ? 190 : 176, ry = 72 + ph + 6;
  return {
    izq: izq, der: izq + vw, cx: cx, x0: x0, W: W0,
    titulo: { x: x0, y: 8, w: W0, h: 54 },
    objetivo: { x: x0, y: 72, w: Math.round(W0 * .46), h: ph },
    controles: { x: x0 + Math.round(W0 * .48), y: 72, w: Math.round(W0 * .52), h: ph },
    retratos: { x: x0, y: ry, w: W0, h: Math.min(y - 10 - ry, c ? 150 : 160) },
    practica: { id: 'practica', x: x0, y: y, w: Math.round(W0 * .36), h: bh },
    listo: { id: 'listo', x: x0 + Math.round(W0 * .40), y: y, w: Math.round(W0 * .60), h: bh },
    volvi: { id: 'volvi', x: x0, y: y - bh - 12, w: W0, h: bh },
    anillo: { x: x0 + W0 - 32, y: ry + 36, r: 22 }
  };
}
// HUD de juego (franja de 64 px): n fichas + barra de tiempo en la base. NO invade y>=64.
function layoutHud(vw, n) {
  const izq = (DW - vw) / 2, pad = 6, ancho = vw - pad * 2, w = Math.min(196, Math.floor((ancho - pad * (n - 1)) / Math.max(1, n))), tot = w * n + pad * (n - 1);
  const x0 = izq + (vw - tot) / 2, chips = [];
  for (let i = 0; i < n; i++) chips.push({ x: x0 + i * (w + pad), y: 3, w: w, h: 46 });
  return { izq: izq, chips: chips, barra: { x: x0, y: 52, w: tot - 34, h: 9 }, num: { x: x0 + tot - 16, y: 56 }, y1: HUDH };
}
// podio: orden por puesto (empates: por equipo y asiento), con sus pagos y puntajes. res = board.mj.res; mj = board.mj
// Formatos de equipo (M3-TEAMS DM3-8): `lados` = [{eq, miembros, rank, pago, sc}] (2v2: azul y rojo, sc = suma del equipo; 1v3: el solo y el trío, sc = null
// porque el puntaje de un 1v3 de umbral NO es algo que se enseñe) y `ganLado` = índice del lado que ganó (null si empatan). Los compañeros salen juntos en la tarima.
function podioModelo(res, mj) {
  if (!res || !mj || !mj.as) return null;
  const as = mj.as, n = as.length, pu = res.puestos || as.map(() => 1), pg = res.pagos || as.map(() => 0), sc = res.sc || null, cpu = res.cpu || [];
  const tipo = mj.tipo, equipo = (tipo === '2v2' || tipo === '1v3') && Array.isArray(mj.eq) && mj.eq.length === 2;
  const eqDe = (s, i) => { if (!equipo) return i; for (let j = 0; j < mj.eq.length; j++) if (mj.eq[j].indexOf(s) >= 0) return j; return i; };
  const l = as.map((s, i) => ({ s: s, i: i, eq: eqDe(s, i), rank: pu[i] || 1, pago: pg[i] || 0, sc: sc ? sc[i] : null, cpu: cpu.indexOf(s) >= 0 }));
  l.sort((a, b) => a.rank - b.rank || a.eq - b.eq || a.i - b.i);
  const gan = l.filter((x) => x.rank === 1).map((x) => x.s);
  let lados = [], ganLado = null;
  if (equipo) {
    lados = mj.eq.map((mi, t) => {
      const ids = mi.map((s) => as.indexOf(s)).filter((j) => j >= 0), j0 = ids.length ? ids[0] : 0;
      let suma = null;
      if (sc && tipo === '2v2') { suma = 0; ids.forEach((j) => { suma += sc[j] || 0; }); }
      return { eq: t, miembros: mi.slice(), rank: pu[j0] || 1, pago: pg[j0] || 0, sc: suma };
    });
    ganLado = lados[0].rank === lados[1].rank ? null : (lados[0].rank < lados[1].rank ? 0 : 1);
  }
  const empate = !!res.empate || (equipo ? ganLado === null : gan.length === n && n > 1 && !sc);
  return { lista: l, ganadores: gan, empate: empate, n: n, h: res.h || 0, puestos: pu.slice(), pagos: pg.slice(), sc: sc ? sc.slice() : null, tipo: tipo, lados: lados, ganLado: ganLado };
}
// título y subtítulo del podio (puro). `nombre`: función asiento -> nombre, o un board con pj[s].name.
function tituloPodio(M, mj, nombre) {
  if (!M) return { titulo: '', sub: '' };
  const nm = typeof nombre === 'function' ? nombre : (s) => String(((nombre && nombre.pj && nombre.pj[s] && nombre.pj[s].name) || s) || '').toUpperCase();
  const junta = (l) => l.map(nm).join(' y ');
  if (M.empate) return { titulo: 'EMPATE', sub: '' };
  if (M.tipo === '2v2' && M.ganLado !== null) {
    const L = M.lados[M.ganLado];
    return { titulo: '¡GANÓ EL EQUIPO ' + (M.ganLado === 0 ? 'AZUL' : 'ROJO') + '!', sub: junta(L.miembros) };
  }
  if (M.tipo === '1v3' && M.ganLado !== null) {
    const L = M.lados[M.ganLado];
    return M.ganLado === 0 ? { titulo: '¡GANÓ ' + nm(L.miembros[0]) + '!', sub: 'el solitario' } : { titulo: '¡GANÓ EL TRÍO!', sub: junta(L.miembros) };
  }
  const gan = M.ganadores;
  const titulo = gan.length > 2 ? '¡EMPATE ENTRE ' + gan.length + '!' : gan.length > 1 ? '¡EMPATAN ' + gan.map(nm).join(' Y ') + '!' : '¡GANÓ ' + nm(gan[0]) + '!';
  return { titulo: titulo, sub: '' };
}
// la carta que ve quien mira: en un 1v3 `carta.roles.solo|trio` se funde campo a campo sobre la base (obj, gana, como y demos se reemplazan enteros). Espectador => base.
function cartaParaRol(car, mj, yo) {
  const r = car && car.roles;
  if (!r || !mj || mj.tipo !== '1v3' || !mj.solo || !yo || mj.as.indexOf(yo) < 0) return car;
  const o = r[mj.solo === yo ? 'solo' : 'trio'];
  if (!o) return car;
  const out = {};
  Object.keys(car).forEach((k) => { if (k !== 'roles') out[k] = car[k]; });
  Object.keys(o).forEach((k) => { out[k] = o[k]; });
  return out;
}
// ruleta de formato (puro): ángulo (rad) a ese ms desde que arrancó. La ruleta cae SIEMPRE en mj.tipo; el ligero desvío sale de mj.k.
const FORMATOS = ['ffa', '2v2', '1v3'];
function modeloRuleta(mj, ms) {
  if (!mj) return null;
  const i = Math.max(0, FORMATOS.indexOf(mj.tipo === '1v1' ? 'ffa' : mj.tipo)), seg = Math.PI * 2 / 3, jit = (((mj.k | 0) * 37) % 50 - 25) / 100 * seg;
  const fin = -Math.PI / 2 - (i + .5) * seg + jit, u = Math.max(0, Math.min(1, ms / K.GIRO_MS)), e = 1 - Math.pow(1 - u, 3);
  return { ang: fin - (1 - e) * Math.PI * 2 * (4 + (mj.k | 0) % 2), u: u, hecho: u >= 1, idx: i, fin: fin };
}
// nombre (opcional): función asiento -> nombre; con ella el 2v2 añade «Tu pana: NOMBRE» para quien juega
function textoFormato(mj, yo, nombre) {
  if (!mj) return '';
  if (mj.rel) return '¡RELÁMPAGO!';
  if (mj.tipo === '2v2') {
    const eq = (mj.eq || []).filter((g) => g.indexOf(yo) >= 0)[0], pana = eq && eq.filter((s) => s !== yo)[0];
    return pana && typeof nombre === 'function' ? '¡2 CONTRA 2! · Tu pana: ' + nombre(pana) : '¡2 CONTRA 2!';
  }
  if (mj.tipo === '1v3') return mj.solo && mj.solo === yo ? '¡TÚ CONTRA TODOS!' : '¡1 CONTRA 3!';
  if (mj.tipo === '1v1') return '¡DUELO!';
  return '¡TODOS CONTRA TODOS!';
}
const HUMOR_GANA = ['¡Eso, mi pana!', '¡Ese sí sabe!', '¡Con calma y buen pulso!', '¡Y ahora a presumir!', '¡Esa es la actitud!'];
const HUMOR_PIERDE = ['Ni modo, a la próxima.', 'El que perdió, que invite el café.', 'Se lo llevó la corriente.'];
const humor = (k, l) => l[Math.abs((k | 0) * 7) % l.length];

/* ───────────── navegador ───────────── */
const lab = () => typeof rr === 'function' && typeof txt === 'function';
const UI = () => F.ui;
const D = () => (F.ui && F.ui.d) || {};
const tnow = () => (typeof now === 'number' ? now : 0);
const TWC = {}; let twN = 0;
function medir(s, size) {
  if (typeof tw !== 'function') return String(s).length * size * .55;
  const k = (typeof style !== 'undefined' ? style : '') + '|' + size + '|' + s, v = TWC[k]; if (v !== undefined) return v;
  if (twN > 500) { for (const q in TWC) delete TWC[q]; twN = 0; }
  twN++; return (TWC[k] = tw(s, size));
}
// achica el texto (hasta 70 %) hasta que quepa en maxL líneas de maxW; si aun así no cabe, corta con «…». -> {lines, size}
function ajustar(s, size0, maxW, maxL, maxH) {
  for (let k = 1; k >= .7; k -= .05) { const sz = size0 * k, l = envolver(s, sz, maxW, 0); if (l.length <= maxL && (!maxH || l.length * sz * 1.22 <= maxH)) return { lines: l, size: sz }; }
  return { lines: envolver(s, size0 * .7, maxW, maxL), size: size0 * .7 };
}
function envolver(s, size, maxW, maxL) {
  const ws = String(s).split(/\s+/), out = []; let cur = '';
  for (let i = 0; i < ws.length; i++) {
    const t = cur ? cur + ' ' + ws[i] : ws[i];
    if (cur && medir(t, size) > maxW) { out.push(cur); cur = ws[i]; } else cur = t;
  }
  if (cur) out.push(cur);
  if (maxL && out.length > maxL) { const r = out.slice(0, maxL); r[maxL - 1] = r[maxL - 1].replace(/[\s.,]*$/, '') + '…'; return r; }
  return out;
}
const T = (s, x, y, size, col, maxW, plain) => D().T(s, x, y, size, col, maxW, plain);
const TLf = (s, x, y, size, col, maxW, plain) => D().TL(s, x, y, size, col, maxW, plain);
const nom = (S, s) => UI().nombreDe(S, s);
const idCh = (ch) => UI().ident(ch);
// prueba de estilo pixel (?pixel=1, fiesta-pixel.js): lo enciende el juego que pinta en pixel (FIESTA.PX.puro) y entonces el HUD, los controles y los letreros también van en pixel
const PXon = () => !!(F.PX && F.PX.puro);
function Tp(s, x, y, size, col, maxW) {             // T centrado, o su versión pixel con la escala que quepa en maxW
  if (!PXon()) return T(s, x, y, size, col, maxW);
  let e = Math.max(1, Math.round(size / 11));
  while (e > 1 && maxW && F.PX.ancho(s, e) * F.PX.ESC > maxW) e--;
  F.PX.textoEn(ctx, s, x, y - 2.5 * e * F.PX.ESC, col, e, INKC);
}
const nomCorto = (n) => String(n || '').replace(/^CPU\s*·\s*/i, '');
const suave = (u) => u * u * (3 - 2 * u);
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;

function crear(opts) {
  opts = opts || {}; const emit = opts.emit || function () {};
  const B = UI().registro();
  const C = { B: B, fase: null, sess: null, prac: null, practicando: false, ptr: { x: -999, y: -999, abajo: false } };
  let sess = null, prac = null, tPrac = 0, ultMs = null, ultFase = null, ultCuenta = -1, tFase = 0, pracFinAt = null;
  const dedos = {};                                   // pointerId -> {k:'stick'|'a'|'b'|'btn', ox, oy, id}
  const teclas = { u: 0, d: 0, l: 0, r: 0 };
  let ultLayout = null, stickAct = null, podioT0 = null, podioKey = null, sonoPodio = false;

  const entrada = () => (prac ? prac.in : (sess && sess.phase === 'juego' ? sess.in : null));
  let extDef = null, libre = false, libreQuieto = false;
  // ?embed=1 (tablero de Margarita): tarjeta de reglas -> [PRACTICAR] -> ¡LISTO! -> 3·2·1·¡DALE! -> la sesión real UNA vez, sin reinicio ni «PRÁCTICA»
  let emb = null;                                     // {P (práctica real con cuenta), o (opciones para PRACTICAR), fase: 'tarjeta'|'practica'|'juego'}
  const def = () => extDef || (sess && sess.def) || {};

  C.abrir = function (s) { C.cerrar(); sess = C.sess = s; podioT0 = null; podioKey = null; sonoPodio = false; ultCuenta = -1; tFase = 0; };
  C.cerrar = function () {
    if (prac) { try { prac.close(); } catch (e) {} }
    prac = C.prac = null; C.practicando = false; sess = C.sess = null; stickAct = null;
    Object.keys(dedos).forEach((k) => delete dedos[k]); teclas.u = teclas.d = teclas.l = teclas.r = 0;
  };
  C.practica = function (on) {
    if (on === undefined) on = !prac;
    if (emb) {
      if (emb.fase === 'juego') return C.practicando;
      if (on && !prac) {
        const o = {}; Object.keys(emb.o).forEach((k) => { o[k] = emb.o[k]; }); o.dur = undefined; o.cuenta = 0; o.seed = undefined;
        try { prac = C.prac = F.LIVE.practice(sess.id, o); } catch (e) { prac = C.prac = null; }
        tPrac = 0; pracFinAt = null; C.practicando = !!prac; if (prac) emb.fase = 'practica';
      } else if (!on && prac) { try { prac.close(); } catch (e) {} prac = C.prac = null; C.practicando = false; emb.fase = 'tarjeta'; }
      return C.practicando;
    }
    if (on && !prac && sess && sess.phase === 'carta' && F.LIVE) {
      const s0 = sess.c.seats[sess.c.yo] || {};
      const rol = sess.c.rol ? sess.c.rol(sess.c.yo) : null;      // 1v3: la práctica te pone en TU rol (solo o trío); 2v2: contigo y un pana CPU contra 2 CPU
      try { prac = C.prac = F.LIVE.practice(sess.id, { lv: sess.c.lv || 1, yo: 'a', ch: s0.ch || 'tu', rol: rol === 'solo' || rol === 'trio' ? rol : undefined }); } catch (e) { prac = C.prac = null; }
      tPrac = 0; pracFinAt = null; C.practicando = !!prac;
    } else if (!on && prac) { try { prac.close(); } catch (e) {} prac = C.prac = null; C.practicando = false; }
    return C.practicando;
  };
  C.modelo = function () { return ultLayout; };
  C.embed = function (P, d, o) {
    sess = C.sess = P.sess; extDef = d; libre = false; libreQuieto = false; prac = C.prac = null; C.practicando = false;
    emb = C.emb = { P: P, o: o || {}, fase: 'tarjeta' }; ultCuenta = -1; tFase = 0;
  };
  function listoEmb() {
    if (!emb || emb.fase === 'juego') return;
    if (prac) { try { prac.close(); } catch (e) {} prac = C.prac = null; C.practicando = false; }
    Object.keys(dedos).forEach((k) => delete dedos[k]); stickAct = null; teclas.u = teclas.d = teclas.l = teclas.r = 0;
    emb.fase = 'juego'; ultCuenta = -1;
  }
  // ?practica=<id>: práctica a pantalla completa sin sesión ni red (la maneja fiesta-main; quieto = no avanza solo, para el banco)
  C.libre = function (p, d, quieto) { prac = C.prac = p; extDef = d; libre = true; libreQuieto = !!quieto; C.practicando = true; };
  C.dibujarLibre = function (vm) {
    if (lab() && emb) return dibujarEmbed(vm);
    if (!lab() || !prac) return false;
    const ms = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = ultMs === null || libreQuieto ? 0 : Math.min(.1, (ms - ultMs) / 1000); ultMs = ms;
    B.limpiar(); C.fase = 'practica';
    dibujarPractica({ S: { pj: {} }, yo: 'a', izq: vm.izq, der: vm.der }, dt, vm.izq, vm.der, vm.der - vm.izq, !!vm.compacto);
    return true;
  };

  /* ── entrada: puntero y teclado ── */
  C.mover = function (x, y, abajo) { C.ptr.x = x; C.ptr.y = y; if (abajo !== undefined) C.ptr.abajo = !!abajo; };
  const dentro = (r, x, y) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  const enCirculo = (c, x, y, k) => c && (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) <= (c.r * (k || 1)) * (c.r * (k || 1));
  C.down = function (id, x, y) {
    C.mover(x, y, true);
    const b = B.hit(x, y);
    if (b && /^(listo|practica|volvi|salir)$/.test(b.id) && !b.off) { dedos[id] = { k: 'btn', id: b.id }; return true; }
    if (b && b.off) { dedos[id] = { k: 'nada' }; return true; }
    const inp = entrada(), L = ultLayout;
    if (inp && L) {
      if (L.b && enCirculo(L.b, x, y, 1.35)) { dedos[id] = { k: 'b' }; inp.down('b'); return true; }
      if (L.zonaStick && dentro(L.zonaStick, x, y)) {
        if (!stickAct) { stickAct = { id: id, ox: x, oy: y, x: x, y: y }; dedos[id] = { k: 'stick' }; inp.axis(0, 0); return true; }
      }
      if (dentro(L.zonaA, x, y) || enCirculo(L.a, x, y, 1.4)) { dedos[id] = { k: 'a' }; inp.down('a'); return true; }
    }
    dedos[id] = { k: 'nada' };
    return true;
  };
  C.move = function (id, x, y) {
    C.mover(x, y);
    const d = dedos[id]; if (!d || d.k !== 'stick' || !stickAct || stickAct.id !== id) return;
    stickAct.x = x; stickAct.y = y;
    const v = stickDe(x - stickAct.ox, y - stickAct.oy), inp = entrada(); if (inp) inp.axis(v.x, v.y);
  };
  C.up = function (id, x, y) {
    C.mover(x, y, false);
    const d = dedos[id]; delete dedos[id]; if (!d) return null;
    const inp = entrada();
    if (d.k === 'a') { if (inp) inp.up('a'); }
    else if (d.k === 'b') { if (inp) inp.up('b'); }
    else if (d.k === 'stick') { if (stickAct && stickAct.id === id) stickAct = null; if (inp) inp.axis(0, 0); }
    else if (d.k === 'btn') {
      const b = B.hit(x, y);
      if (b && b.id === d.id && !b.off) return boton(d.id);
    }
    return null;
  };
  function boton(id) {
    if (id === 'listo' && emb) { listoEmb(); return 'listo'; }
    if (id === 'listo') { emit({ k: 'ready' }); return 'listo'; }
    if (id === 'practica' || id === 'salir') { const on = !prac; C.practica(on); emit({ k: 'practica', on: on }); return 'practica'; }
    if (id === 'volvi') { emit({ k: 'back' }); return 'volvi'; }
    return null;
  }
  // devuelve true si la tecla es del minijuego (main ya no se la pasa a ui)
  C.tecla = function (code, abajo) {
    const f = C.fase, k = teclaAInput(code), inp = entrada();
    if (emb && abajo && emb.fase !== 'juego') {
      if (emb.fase === 'tarjeta' && (code === 'Space' || code === 'Enter')) { listoEmb(); return true; }
      if (emb.fase === 'practica' && code === 'Enter') { listoEmb(); return true; }
      if (code === 'KeyP' || (emb.fase === 'practica' && code === 'Escape')) { boton('practica'); return true; }
    }
    if (abajo && f === 'tarjeta' && !prac && sess && sess.c.yo >= 0) {
      if (code === 'Space' || code === 'Enter') { emit({ k: 'ready' }); return true; }
      if (code === 'KeyP') { boton('practica'); return true; }
    }
    if (abajo && prac && sess && code === 'Enter') { emit({ k: 'ready' }); return true; }
    if (abajo && prac && sess && code === 'KeyP') { boton('practica'); return true; }
    if (!k) return false;
    if (!inp) return true;
    if (k.b) { if (abajo) inp.down(k.b); else inp.up(k.b); return true; }
    teclas[k.e] = abajo ? 1 : 0;
    inp.axis(teclas.r - teclas.l, teclas.d - teclas.u);
    return true;
  };

  /* ── dibujo ── */
  C.dibujar = function (vm) {
    if (!lab()) return false;
    B.limpiar();
    const S = vm.S, sn = vm.serverNow, izq = vm.izq, der = vm.der, vw = der - izq, comp = !!vm.compacto;
    const ms = vm.ahoraMs !== undefined ? vm.ahoraMs : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dt = ultMs === null ? 0 : Math.min(.1, (ms - ultMs) / 1000); ultMs = ms;
    let f = fase(S, sn, sess);
    if (f === 'espera' || !f) { C.fase = f; ultFase = f; return false; }
    if (f !== ultFase) { tFase = 0; ultFase = f; }
    tFase += dt; C.fase = f;
    if (prac && f !== 'tarjeta') { try { prac.close(); } catch (e) {} prac = C.prac = null; C.practicando = false; }
    const mj = S.mj, yoIdx = sess ? sess.c.yo : mj.as.indexOf(vm.yo);
    ultLayout = null;
    if (f === 'ruleta') dibujarRuleta(vm, mj, sn, izq, der, comp);
    else if (f === 'tarjeta') {
      if (prac) dibujarPractica(vm, dt, izq, der, vw, comp);
      else dibujarTarjeta(vm, mj, sn, izq, der, vw, comp, yoIdx);
    } else if (f === 'cuenta' || f === 'juego' || f === 'fin') dibujarJuego(vm, f, dt, izq, der, vw, comp, yoIdx);
    else if (f === 'podio') dibujarPodio(vm, mj, dt, izq, der, vw, comp);
    return true;
  };

  function dibujarEmbed(vm) {
    const ms = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = ultMs === null ? 0 : Math.min(.1, (ms - ultMs) / 1000); ultMs = ms;
    B.limpiar();
    const izq = vm.izq, der = vm.der, vw = der - izq, comp = !!vm.compacto, P = emb.P, S = P.board, mj = S.mj, yoIdx = sess.c.yo;
    const v = { S: S, yo: mj.juez, izq: izq, der: der, compacto: comp };
    let f = emb.fase;
    if (f === 'juego') { P.update(dt); f = P.fin ? 'fin' : P.gt() < 0 ? 'cuenta' : 'juego'; }
    if (f !== ultFase) { tFase = 0; ultFase = f; }
    tFase += dt; C.fase = f;
    ultLayout = null;
    if (f === 'tarjeta') dibujarTarjeta(v, mj, 0, izq, der, vw, comp, yoIdx);
    else if (f === 'practica' && prac) dibujarPractica(v, dt, izq, der, vw, comp);
    else dibujarJuego(v, f === 'practica' ? 'cuenta' : f, dt, izq, der, vw, comp, yoIdx);
    return true;
  }

  function fondo(izq, der, a, b) { if (typeof wash === 'function') wash(izq, 0, der - izq, DH, a, b); else rr(izq, 0, der - izq, DH, 0, a, 0); }
  function guirnalda(izq, der, y, t) {
    const cols = ['#ff5ca8', '#ffe14d', '#3fb0ff', '#5cff7a', '#ff8a3d'];
    for (let x = izq + 14, i = 0; x < der; x += 34, i++) ell(x, y + Math.sin(i * .9 + t * 2) * 3, 6, 8, cols[i % 5], 2);
  }
  function chd(S, s) { const p = S.pj && S.pj[s]; return p ? p.ch : null; }

  /* ── ruleta de formato ── */
  function dibujarRuleta(vm, mj, sn, izq, der, comp) {
    const t = tnow(), t0 = mj.cartaHasta - reglasT().carta, ms = sn - t0, cx = (izq + der) / 2, S = vm.S;
    fondo(izq, der, '#231f45', '#4a1f6e'); guirnalda(izq, der, 14, t);
    const ruleta = mj.tipo !== '1v1' && !mj.rel && mj.as.length === 4;
    const fm = textoFormato(mj, vm.yo);
    let uBan = 1;
    if (ruleta) {
      const m = modeloRuleta(mj, ms), R0 = comp ? 122 : 112, cy = 160;
      uBan = clamp01((ms - K.GIRO_MS) / 500);
      const seg = Math.PI * 2 / 3, cols = ['#ffb36b', '#3fb0ff', '#ff5c8a'], et = ['4P', '2 VS 2', '1 VS 3'], sub = ['TODOS', 'POR EQUIPOS', 'EL SOLITARIO'];
      ell(cx + 4, cy + 8, R0 + 10, R0 + 10, 'rgba(20,16,28,.35)', 0);
      for (let i = 0; i < 3; i++) {
        const a0 = m.ang + i * seg, a1 = a0 + seg, pts = [[cx, cy]];
        for (let j = 0; j <= 10; j++) { const a = a0 + (a1 - a0) * j / 10; pts.push([cx + Math.cos(a) * R0, cy + Math.sin(a) * R0]); }
        poly(pts, m.hecho && m.idx !== i ? '#6b6785' : cols[i], 4);
        const am = a0 + seg / 2, tx = cx + Math.cos(am) * R0 * .62, ty = cy + Math.sin(am) * R0 * .62;
        txt(et[i], tx, ty, comp ? 26 : 22, '#fffdf2', am + Math.PI / 2 > Math.PI / 2 && am + Math.PI / 2 < Math.PI * 1.5 ? am + Math.PI / 2 + Math.PI : am + Math.PI / 2, false);
      }
      ell(cx, cy, 20, 20, '#fffdf2', 4);
      poly([[cx - 16, cy - R0 - 18], [cx + 16, cy - R0 - 18], [cx, cy - R0 + 16]], '#ffe14d', 4);          // la flecha
      if (m.hecho) T(sub[m.idx], cx, cy + R0 + 24, 16, '#ffe14d', 300);
    }
    if (uBan > 0) {
      ctx.save(); ctx.globalAlpha = uBan;
      const by = ruleta ? 330 : 150;
      T(fm, cx, by, (comp ? 40 : 36) * (ruleta ? 1 : 1.15), '#ffe14d', Math.min(560, der - izq - 40));
      dibujarFormatoBanner(vm, mj, cx, by + (ruleta ? 22 : 40), comp, ruleta ? .92 : 1.15, S);
      ctx.restore();
    }
    if (ruleta && uBan === 0) T('¿Cómo se juega esta?', cx, 360, 22, '#fffdf2', 400, true);
    T('SIGUIENTE MINIJUEGO', cx, DH - 22, 14, '#9a96a8', 300, true);
  }
  // a quién le toca con quién: ffa = bustos, 2v2 = marcos por equipo, 1v3 = el solo al centro
  function dibujarFormatoBanner(vm, mj, cx, y0, comp, k, S) {
    const as = mj.as, hc = 64 * k, yy = y0 + hc * .8 + 6, d = D();
    const ficha = (s, x, y, h, eq, w) => { d.dibujaPj(chd(S, s), x, y, h, { sombra: true, animo: 'esperar', t: tnow() + as.indexOf(s) }); d.placa(x, y + h * .68, nomCorto(nom(S, s)), chd(S, s), { equipo: eq, cpu: S.pj[s] && S.pj[s].cpu, w: w || 112 }); };
    if (mj.tipo === '2v2') {
      const w = Math.min(230, (vm.der - vm.izq) / 2 - 40);
      mj.eq.forEach((g, ti) => {
        const x0 = cx + (ti ? 30 : -30 - w);
        ctx.save(); ctx.globalAlpha = .4; rr(x0, y0 - 8, w, hc + 62, 16, '#14101c', 0); ctx.restore();
        rr(x0, y0 - 8, w, 9, 4, K.COL_EQ[ti], 2);
        g.forEach((s, j) => ficha(s, x0 + w * (j + .5) / g.length, yy, hc * .9, ti, w / g.length - 8));
      });
      T('VS', cx, yy + 6, 26, '#ffe14d', 60);
    } else if (mj.tipo === '1v3' && mj.solo) {
      ficha(mj.solo, cx - 190, yy, hc * 1.15, 0, 130);
      T('VS', cx - 100, yy + 6, 24, '#ffe14d', 60);
      const otros = as.filter((s) => s !== mj.solo);
      otros.forEach((s, j) => ficha(s, cx + 20 + j * 112, yy, hc * .78, 1, 104));
    } else if (mj.tipo === '1v1') {
      ficha(as[0], cx - 120, yy, hc, null); T('VS', cx, yy + 6, 28, '#ffe14d', 60); ficha(as[1], cx + 120, yy, hc, null);
    } else {
      const sep = Math.min(150, (vm.der - vm.izq - 60) / as.length);
      as.forEach((s, j) => ficha(s, cx + (j - (as.length - 1) / 2) * sep, yy, hc, null));
    }
  }

  /* ── tarjeta de instrucciones ── */
  function dibujarTarjeta(vm, mj, sn, izq, der, vw, comp, yoIdx) {
    const t = tnow(), S = vm.S, d = D(), L = layoutTarjeta(vw, DH, comp), g = sess ? sess.def : null, cx = L.cx;
    ultLayout = null;
    fondo(izq, der, '#1f1b3d', '#3a2a6e'); guirnalda(izq, der, 8, t);
    const fs = comp ? 1.22 : 1, name = g ? g.name : String((mj.cola[mj.i] || {}).g || '').replace(/^f_/, '').toUpperCase();
    d.caja(L.titulo.x, L.titulo.y + 6, L.titulo.w, L.titulo.h - 6, '#3fb0ff', 16, 4);
    T(name, cx, L.titulo.y + 6 + (L.titulo.h - 6) / 2 + 1, 34 * fs, '#fffdf2', L.titulo.w - 24);
    const sm = mj.rel ? '¡RELÁMPAGO ' + (mj.i + 1) + '/' + mj.cola.length + '!' : textoFormato(mj, vm.yo, (s) => nomCorto(nom(S, s)).toUpperCase());
    // objetivo y cómo se gana (en un 1v3, con el texto del rol de quien mira)
    const car = g ? cartaParaRol(g.carta, mj, vm.yo) : { obj: '', gana: '', como: {}, demos: [] }, O = L.objetivo, gy = O.y + Math.round(O.h * .5), gh = O.h - Math.round(O.h * .5) - 8;
    d.caja(O.x, O.y, O.w, O.h, '#fffdf2', 14, 4);
    TLf('EL RETO', O.x + 14, O.y + 18, 14 * fs, '#3fb0ff', 120, true);
    const fo = ajustar(car.obj, 20 * fs, O.w - 28, 2);
    fo.lines.forEach((ln, i) => TLf(ln, O.x + 14, O.y + 42 + i * fo.size * 1.2, fo.size, INKC, O.w - 28, true));
    rr(O.x + 8, gy, O.w - 16, gh, 10, '#ffe9a8', 3);
    TLf('¡CÓMO SE GANA!', O.x + 18, gy + 14, 13 * fs, '#c0392b', 160, true);
    const fg = ajustar(car.gana, 15 * fs, O.w - 40, 3, gh - 24);
    fg.lines.forEach((ln, i) => TLf(ln, O.x + 18, gy + 14 + (i + 1) * fg.size * 1.22 + 3, fg.size, INKC, O.w - 40, true));
    // controles: táctil | teclado + demo
    const CT = L.controles;
    d.caja(CT.x, CT.y, CT.w, CT.h, '#fffdf2', 14, 4);
    const cw = CT.w / 2, dm = (car.demos && car.demos[0]) || null;
    TLf('TÁCTIL', CT.x + 12, CT.y + 18, 13 * fs, '#3fb0ff', 100, true);
    TLf('TECLADO', CT.x + cw + 12, CT.y + 18, 13 * fs, '#3fb0ff', 100, true);
    demo(dm ? dm.id : '', CT.x + cw / 2, CT.y + 58, 1, t, false, g, dm);
    demo(dm ? dm.id : '', CT.x + cw * 1.5, CT.y + 66, 1, t, true, g, dm);
    [['tactil', cw / 2], ['teclado', cw * 1.5]].forEach((q) => {
      const f = ajustar((car.como && car.como[q[0]]) || '', 14 * fs, cw - 16, 2);
      f.lines.forEach((ln, i) => T(ln, CT.x + q[1], CT.y + 102 * (comp ? 1.1 : 1) + i * f.size * 1.2, f.size, INKC, cw - 14, true));
    });
    line([[CT.x + cw, CT.y + 26], [CT.x + cw, CT.y + 126 * (comp ? 1.1 : 1)]], 2, '#cfc9e6');
    if (dm && dm.txt) { const f = ajustar(dm.txt, 12 * fs, CT.w - 24, 2); f.lines.forEach((ln, i, a) => T(ln, CT.x + CT.w / 2, CT.y + CT.h - 10 - (a.length - 1 - i) * f.size * 1.2, f.size, '#6b6785', CT.w - 24, true)); }
    // retratos con ✓ (las CPU nunca bloquean: no llevan marca)
    const listos = {}; Object.keys(mj.listos || {}).forEach((s) => { listos[s] = 1; }); if (sess) Object.keys(sess.listos || {}).forEach((s) => { listos[s] = 1; });
    const as = mj.as, hc = comp ? 84 : 76, sep = Math.min(hc * 2, L.retratos.w / as.length), ry = L.retratos.y + 28 + hc * .5;
    T(sm, cx, L.retratos.y + 8, 22 * fs, '#ffe14d', L.retratos.w - 80);
    as.forEach((s, j) => {
      const x = cx + (j - (as.length - 1) / 2) * sep, p = S.pj[s] || {}, cpu = p.cpu, eq = mj.tipo === '2v2' || mj.tipo === '1v3' ? (mj.eq[0].indexOf(s) >= 0 ? 0 : 1) : null;
      d.dibujaPj(p.ch, x, ry, hc, { animo: listos[s] ? 'celebrar' : 'esperar', t: t + j, gris: cpu === 'afk', sombra: true });
      d.placa(x, ry + hc * .72, nomCorto(nom(S, s)), p.ch, { equipo: eq, cpu: cpu, w: Math.min(sep - 6, 150) });
      if (listos[s]) { ell(x + hc * .46, ry - hc * .42, 13, 13, '#5cff7a', 3); T('✓', x + hc * .46, ry - hc * .42 + 1, 17, INKC, 16, true); }
    });
    // anillo de tiempo + botones
    if (!emb) {                                         // embed: sin reloj, se espera al humano (las CPU no esperan nada)
      const quedan = Math.max(0, mj.cartaHasta - sn), tot = reglasT().carta - (mj.rel ? 0 : K.RULETA_MS);
      d.anillo(L.anillo.x, L.anillo.y, L.anillo.r, clamp01(quedan / (mj.rel ? reglasT().relCarta : tot)), 5);
      T(String(Math.ceil(quedan / 1000)), L.anillo.x, L.anillo.y + 1, 18, '#fffdf2', 30);
    }
    const ptr = C.ptr, mio = yoIdx >= 0, yoListo = !!listos[vm.yo], afk = mio && S.pj[vm.yo] && S.pj[vm.yo].cpu === 'afk';
    if (afk) d.boton(B, { id: 'volvi', x: L.volvi.x, y: L.volvi.y, w: L.volvi.w, h: L.volvi.h, label: '¡YA VOLVÍ!', size: 28 * fs, fill: '#ff8a3d' }, ptr);
    if (mio) {
      d.boton(B, { id: 'practica', x: L.practica.x, y: L.practica.y, w: L.practica.w, h: L.practica.h, label: emb ? 'PRACTICAR' : 'PRÁCTICA', size: 24 * fs, fill: '#ffffff', key: 'KeyP' }, ptr);
      d.boton(B, { id: 'listo', x: L.listo.x, y: L.listo.y, w: L.listo.w, h: L.listo.h, label: yoListo ? '¡Listo! esperando…' : '¡LISTO!', size: 30 * fs, fill: yoListo ? '#c9c4dd' : '#5cff7a', off: yoListo || afk, key: ['Space', 'Enter'] }, ptr);
    } else T('Mirando el minijuego…', cx, L.listo.y + L.listo.h / 2, 24, '#fffdf2', L.W, true);
  }

  // demos animados de los controles (rr/ell/line/poly): saltar · compas · mover · robar
  // demo propio del juego (M3-TEAMS DM3-7): demos[i].dibuja(cx, cy, k, t, teclado) con las mismas primitivas; si lanza, se cae al pad genérico
  function demo(id, cx, cy, k, t, teclado, g, dm) {
    if (dm && typeof dm.dibuja === 'function') { try { dm.dibuja(cx, cy, k, t, teclado); return; } catch (e) { /* cae al genérico */ } }
    const d = D(), u = (t * .9) % 1, col = g && g.stick ? '#ff8a3d' : '#ffe14d';
    const pad = (x, y, r, txtP, press) => { ell(x, y + (press ? 2 : 0), r, r, press ? '#ff8a3d' : '#ffe14d', 4); if (txtP) T(txtP, x, y + 1, r * .95, INKC, r * 1.6, true); };
    if (teclado) {
      const press = id === 'saltar' ? u > .35 && u < .6 : id === 'compas' ? u > .7 && u < .9 : u > .5 && u < .7;
      const stick = g && g.stick;
      if (stick) {                                   // WASD + espacio
        [['W', 0, -25], ['A', -27, 1], ['S', 0, 1], ['D', 27, 1]].forEach((q) => { rr(cx - 55 + q[1] - 12, cy + q[2] - 12, 24, 24, 5, '#f0ead8', 3); T(q[0], cx - 55 + q[1], cy + q[2] + 1, 13, INKC, 20, true); });
        rr(cx + 2, cy - 12, 56, 24, 6, press ? '#ff8a3d' : '#f0ead8', 3); T('ESPACIO', cx + 30, cy + 1, 11, INKC, 50, true);
      } else { rr(cx - 62, cy - 16, 124, 34, 8, press ? '#ff8a3d' : '#f0ead8', 3); T('ESPACIO', cx, cy + 1, 17, INKC, 110, true); }
      return;
    }
    if (id === 'saltar') {
      const h = Math.abs(Math.sin(u * Math.PI)) * 26, cu = Math.sin(u * Math.PI * 2);
      line([[cx - 56, cy + 24], [cx - 20, cy + 24 + cu * 10], [cx + 20, cy + 24 + cu * 10], [cx + 56, cy + 24]], 4, '#c0392b');
      ell(cx, cy + 4 - h, 13, 15, '#3fb0ff', 3); ell(cx, cy - 8 - h, 9, 9, '#f2c9a0', 2.5);
      pad(cx + 52, cy - 8, 17, 'A', u > .1 && u < .4);
    } else if (id === 'compas') {
      const x = cx - 60 + u * 100;
      line([[cx + 26, cy - 22], [cx + 26, cy + 26]], 3, '#c0392b');
      rr(x - 11, cy - 14, 22, 30, 5, '#fffdf2', 3); ell(x, cy - 3, 3, 3, INKC, 0); ell(x, cy + 9, 3, 3, INKC, 0);
      pad(cx + 52, cy - 8, 17, 'A', u > .62 && u < .82);
    } else if (id === 'mover') {
      const a = t * 2.2;
      ell(cx - 28, cy, 30, 30, 'rgba(255,255,255,.55)', 3); ell(cx - 28 + Math.cos(a) * 14, cy + Math.sin(a) * 14, 13, 13, col, 3);
      pad(cx + 42, cy + 4, 17, 'A', u > .5 && u < .7);
    } else if (id === 'robar') {
      const br = u > .5 && u < .8;
      rr(cx - 12, cy - 18, 24, 32, 6, br ? '#fff6a8' : '#f2d38a', 3); T('PAN', cx, cy - 2, 9, INKC, 22, true);
      ell(cx - 44 + (br ? 18 : 0), cy + 18, 11, 11, '#f2c9a0', 2.5);
      pad(cx + 46, cy + 4, 17, 'A', br);
    } else pad(cx, cy, 22, 'A', u > .5);
  }

  /* ── práctica a pantalla completa con el HUD, los controles reales y los botones en la franja ── */
  function dibujarPractica(vm, dt, izq, der, vw, comp) {
    const d = D(), p = prac, L = layoutPads(vw, DH, comp, def());
    tPrac += dt;
    if (dt > 0 || !libre) p.update(dt);
    p.draw();
    ultLayout = L;
    dibujarHudFicha(vm, p.hud(), izq, vw, comp, true);
    if (!libre) {
      d.boton(B, { id: 'practica', x: izq + 6, y: 6, w: 132, h: 40, label: '← SALIR', size: 18, fill: '#ffffff' }, C.ptr);
      d.boton(B, { id: 'listo', x: izq + vw - 138, y: 6, w: 132, h: 40, label: '¡LISTO!', size: 20, fill: '#5cff7a' }, C.ptr);
    }
    if (PXon()) F.PX.textoEn(ctx, 'PRÁCTICA', izq + 8 + F.PX.ancho('PRÁCTICA', 1), 54, '#ffe14d', 1, INKC); else TLf('PRÁCTICA', izq + 8, 56, 11, '#ffe14d', 90, true);
    if (p.fin) {
      if (pracFinAt === null) pracFinAt = tPrac;
      Tp('¡Bien! otra vez…', izq + vw / 2, 270, 36, '#fffdf2', 400);
      if (tPrac - pracFinAt > K.PRAC_REINICIO && !libreQuieto) { p.reiniciar(); pracFinAt = null; }
    }
    dibujarPads(L, vm);
  }

  /* ── juego: cuenta, HUD, controles, fin ── */
  function dibujarJuego(vm, f, dt, izq, der, vw, comp, yoIdx) {
    const d = D(), cx = (izq + der) / 2;
    if (!sess) return;
    sess.draw();
    const h = sess.hud(), L = layoutPads(vw, DH, comp, def());
    ultLayout = yoIdx >= 0 ? L : null;
    dibujarHudFicha(vm, h, izq, vw, comp, false);
    const S = vm.S, mio = yoIdx >= 0 && sess.c.mio(yoIdx), afk = yoIdx >= 0 && !mio && S.pj[vm.yo] && S.pj[vm.yo].cpu === 'afk';
    if (yoIdx >= 0 && !afk && f !== 'fin') dibujarPads(L, vm);
    if (afk) d.boton(B, { id: 'volvi', x: cx - 150, y: 240, w: 300, h: 70, label: '¡YA VOLVÍ!', size: 30, fill: '#ff8a3d' }, C.ptr);
    if (yoIdx < 0) T('Mirando el minijuego…', cx, 500, 22, '#fffdf2', 360, true);
    if (f === 'cuenta' || (f === 'juego' && sess.cuenta())) {
      const c = sess.cuenta();
      if (c) {
        if (c.n !== ultCuenta) { ultCuenta = c.n; try { d.sonido(c.n === 0 ? 'empezar' : 'cuenta'); } catch (e) {} if (c.n === 0 && typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} } }
        const pop = 1 + .55 * (1 - Math.min(1, c.frac * 3)), txtC = c.n === 0 ? (emb ? '¡DALE!' : '¡YA!') : String(c.n);
        ctx.save(); ctx.globalAlpha = c.n === 0 ? 1 - Math.max(0, (c.frac - .6) / .4) : 1;
        Tp(txtC, cx, 280, (c.n === 0 ? 120 : 190) * pop, c.n === 0 ? '#5cff7a' : '#ffe14d', 520);
        ctx.restore();
      }
    }
    if (f === 'fin') {
      const pop = Math.min(1, tFase * 5), cx2 = cx;
      ctx.save(); ctx.globalAlpha = .35 * pop; rr(izq, 0, vw, DH, 0, '#14101c', 0); ctx.restore();
      Tp('¡SE ACABÓ!', cx2, 280, 86 * (.6 + .4 * pop), '#ffe14d', Math.min(vw - 40, 640));
    }
  }

  function dibujarHudFicha(vm, h, izq, vw, comp, prc) {
    if (PXon()) return hudPx(h, vw);
    const d = D(), n = h.items.length, H = layoutHud(vw, n), surv = def().clase === 'survival', equipos = h.tipo === '2v2' || h.tipo === '1v3';
    ctx.save(); ctx.globalAlpha = .62; rr(H.izq, 0, vw, HUDH - 2, 0, '#14101c', 0); ctx.restore();
    // con equipos las fichas van juntas por bando (el solo / equipo azul primero), no por asiento
    const orden = equipos ? h.items.slice().sort((a, b) => (a.team - b.team) || (a.i - b.i)) : h.items;
    orden.forEach((it, i) => {
      const c = H.chips[i], id = idCh(it.ch), dead = surv && !it.vivo;
      rr(c.x, c.y, c.w, c.h, 12, dead ? '#5a5668' : id.col, it.yo ? 4 : 2.5);
      rr(c.x + 4, c.y + c.h * .55, c.w - 8, c.h * .38, 8, dead ? '#3a3648' : id.col2, 0);
      if (equipos) rr(c.x + 2, c.y + 2, 8, c.h - 4, 4, K.COL_EQ[it.team === 1 ? 1 : 0], 1.5);
      d.retrato(it.ch, c.x + 25, c.y + 22, 34, { clip: { x: c.x + 5, y: c.y + 3, w: 40, h: c.h - 6 }, gris: dead });
      const tag = it.caido ? 'sin señal' : it.mate ? (it.cpu ? 'PANA·CPU' : 'PANA') : h.tipo === '1v3' && it.rol === 'solo' ? (it.cpu ? 'SOLO·CPU' : 'SOLO') : it.cpu ? 'CPU' : '';
      TLf(nomCorto(String(it.name || it.id)).toUpperCase().slice(0, 9), c.x + 48, c.y + 14, 12, '#fffdf2', c.w - 54, true);
      // lo que enseña la ficha: el texto del juego (hudChip) manda; si no, 2v2 = marcador del EQUIPO y el resto el puntaje propio
      const val = surv ? (it.vivo ? 'VIVO' : 'FUERA') : (it.txt !== undefined && it.txt !== null ? it.txt : String(h.tipo === '2v2' && it.tsc !== undefined ? it.tsc : it.sc));
      if (tag) {   // el rótulo y el valor comparten renglón: si no caben en una ficha angosta (móvil vertical), «PANA·CPU» pasa a «PANA»
        const libre = c.w - 54 - medir(val, 15) - 4;
        const tg = medir(tag, 10) > libre && tag.indexOf('·') > 0 ? tag.split('·')[0] : tag;
        const tz = medir(tg, 10) > libre ? Math.max(7, Math.floor(10 * libre / Math.max(1, medir(tg, 10)))) : 10;   // último recurso: letra más chica antes que cortar el rótulo
        TLf(tg, c.x + 48, c.y + 36, tz, '#ffe14d', Math.max(20, libre + 2), true);
      }
      TLf(val, tag ? c.x + c.w - 6 - medir(val, 15) : c.x + 48, tag ? c.y + 34 : c.y + 34, tag ? 15 : 17, dead ? '#c9c4dd' : '#fffdf2', c.w - 54, true);
    });
    // barra de tiempo
    const b = H.barra, fr = clamp01(h.quedan / Math.max(1, h.dur));
    rr(b.x, b.y, b.w, b.h, 4, '#14101c', 2);
    if (fr > .01) rr(b.x + 2, b.y + 2, (b.w - 4) * fr, b.h - 4, 3, fr > .5 ? '#5cff7a' : fr > .2 ? '#ffe14d' : '#ff4d5e', 0);
    if (h.fase === 'juego' || h.fase === 'fin') T(String(Math.ceil(h.quedan)), H.num.x, H.num.y, 15, '#fffdf2', 30, true);
  }

  /* ── HUD en pixel (prueba de estilo): fichas como los paneles del tablero de Margarita, retrato de cabeza y fuente 3x5 ── */
  function hudPx(h, vw) {
    const P = F.PX, E = P.ESC, n = h.items.length, H = layoutHud(vw, n), surv = def().clase === 'survival', equipos = h.tipo === '2v2' || h.tipo === '1v3';
    const g = P.lienzo(vw / E, HUDH / E), ox = H.izq, X = (x) => Math.round((x - ox) / E), Y = (y) => Math.round(y / E);
    P.R(g, 0, 0, vw / E, HUDH / E - 1, '#0c1020'); P.R(g, 0, HUDH / E - 2, vw / E, 1, INKC);
    const orden = equipos ? h.items.slice().sort((a, b) => (a.team - b.team) || (a.i - b.i)) : h.items;
    orden.forEach((it, i) => {
      const c = H.chips[i], id = idCh(it.ch), dead = surv && !it.vivo, x = X(c.x), y = Y(c.y), w = Math.round(c.w / E), hh = Math.round(c.h / E);
      const borde = dead ? '#5a5668' : id.col;
      P.R(g, x, y, w, hh, INKC); P.R(g, x + 1, y + 1, w - 2, hh - 2, borde); P.R(g, x + 2, y + 2, w - 4, hh - 4, dead ? '#2a2838' : '#1a2238');
      P.R(g, x + 2, y + 2, w - 4, 1, dead ? '#3a3848' : '#3a4a78');
      if (it.yo) { P.R(g, x, y, w, 1, '#ffe14d'); P.R(g, x, y + hh - 1, w, 1, '#ffe14d'); P.R(g, x, y, 1, hh, '#ffe14d'); P.R(g, x + w - 1, y, 1, hh, '#ffe14d'); }
      if (equipos) P.R(g, x + 2, y + 2, 2, hh - 4, K.COL_EQ[it.team === 1 ? 1 : 0]);
      P.R(g, x + 5, y + 3, 16, hh - 6, dead ? '#3a3848' : P.tono(borde, -0.45));
      P.cabeza(g, it.ch, id.col, x + 13, y + 5, dead);
      const tag = it.caido ? 'SIN SEÑAL' : it.mate ? (it.cpu ? 'PANA·CPU' : 'PANA') : h.tipo === '1v3' && it.rol === 'solo' ? (it.cpu ? 'SOLO·CPU' : 'SOLO') : it.cpu ? 'CPU' : '';
      const val = surv ? (it.vivo ? 'VIVO' : 'FUERA') : (it.txt !== undefined && it.txt !== null ? it.txt : String(h.tipo === '2v2' && it.tsc !== undefined ? it.tsc : it.sc));
      const tx = x + 24, libre = w - 26, nomb = nomCorto(String(it.name || it.id)).toUpperCase().slice(0, Math.max(3, Math.floor(libre / 4)));
      P.texto(g, nomb, tx + P.ancho(nomb, 1) / 2, y + 4, dead ? '#c9c4dd' : borde, 1, INKC);
      const vw2 = P.ancho(val, 1), tgFull = tag && P.ancho(tag, 1) + vw2 + 4 > libre && tag.indexOf('·') > 0 ? tag.split('·')[0] : tag;
      if (tgFull) P.texto(g, tgFull, tx + P.ancho(tgFull, 1) / 2, y + 13, '#ffe14d', 1, INKC);
      P.texto(g, val, tgFull ? x + w - 4 - vw2 / 2 : tx + vw2 / 2, y + 13, dead ? '#c9c4dd' : '#fffdf2', 1, INKC);
    });
    const b = H.barra, fr = clamp01(h.quedan / Math.max(1, h.dur)), bx = X(b.x), by = Y(b.y), bw = Math.round(b.w / E);
    P.R(g, bx, by, bw, 5, INKC); P.R(g, bx + 1, by + 1, bw - 2, 3, '#2a2838');
    if (fr > .01) { const fc = fr > .5 ? '#5cd27a' : fr > .2 ? '#ffd23f' : '#ff4d5e'; P.R(g, bx + 1, by + 1, Math.round((bw - 2) * fr), 3, fc); P.R(g, bx + 1, by + 1, Math.round((bw - 2) * fr), 1, P.tono(fc, 0.4)); }
    if (h.fase === 'juego' || h.fase === 'fin') { const q = String(Math.ceil(h.quedan)); P.texto(g, q, X(H.num.x), by, '#fffdf2', 1, INKC); }
    P.volcar(ctx, ox, 0);
  }
  /* ── controles táctiles en pixel: aro con trama y perilla con brillo; el A es una moneda de 1 px de contorno ── */
  function padsPx(L, vm, col, dA, dB) {
    const P = F.PX, E = P.ESC, vw = DW - 2 * L0izq(), g = P.lienzo(vw / E, DH / E), ox = L0izq(), X = (x) => Math.round((x - ox) / E), Y = (y) => Math.round(y / E);
    const boton = (c, label, pres) => {
      const x = X(c.x), y = Y(c.y), r = Math.round(c.r / E), base = pres ? '#ffffff' : '#ffd23f';
      P.elipse(g, x, y + 2, r, r, 'rgba(20,16,28,.5)'); P.elipse(g, x, y, r, r, INKC); P.elipse(g, x, y, r - 1, r - 1, P.tono(base, -0.3)); P.elipse(g, x, y - 1, r - 2, r - 2, base);
      P.R(g, x - Math.round(r / 2), y - Math.round(r / 2), 3, 2, P.tono(base, 0.6)); P.R(g, x - Math.round(r / 2), y - Math.round(r / 2) + 2, 1, 1, P.tono(base, 0.6));
      P.texto(g, label, x, y - 5, INKC, 2);
    };
    boton(L.a, 'A', dA); if (L.b) boton(L.b, 'B', dB);
    if (L.stick) {
      const s = stickAct, sx = s ? s.ox : L.stick.x, sy = s ? s.oy : L.stick.y, v = s ? stickDe(s.x - s.ox, s.y - s.oy) : { x: 0, y: 0 }, r = Math.round(L.stick.r / E);
      const x = X(sx), y = Y(sy);
      P.elipse(g, x, y, r, r, INKC); P.elipse(g, x, y, r - 1, r - 1, 'rgba(26,34,56,.55)'); P.anillo(g, x, y, r - 3, r - 3, 'rgba(255,253,242,.35)');
      const kx = x + Math.round(v.x * r * .7), ky = y + Math.round(v.y * r * .7), kr = Math.round(r * .46);
      P.elipse(g, kx, ky + 2, kr, kr, 'rgba(20,16,28,.5)'); P.elipse(g, kx, ky, kr, kr, INKC); P.elipse(g, kx, ky, kr - 1, kr - 1, P.tono(col, -0.3)); P.elipse(g, kx, ky - 1, kr - 2, kr - 2, col);
      P.R(g, kx - Math.round(kr / 2), ky - Math.round(kr / 2), 3, 2, P.tono(col, 0.6)); P.R(g, kx - Math.round(kr / 2), ky - Math.round(kr / 2) + 2, 1, 1, P.tono(col, 0.6));
    }
    P.volcar(ctx, ox, 0);
  }
  function L0izq() { return (DW - (typeof GAME_VIEW !== 'undefined' && GAME_VIEW ? GAME_VIEW.width : DW)) / 2; }
  function dibujarPads(L, vm) {
    const col = (vm.S && vm.S.pj && vm.S.pj[vm.yo] && vm.S.pj[vm.yo].ch ? idCh(vm.S.pj[vm.yo].ch).col : '#ffe14d');
    const pad = (c, label, id, pres) => {
      ctx.save(); ctx.globalAlpha = pres ? .95 : .62;
      ell(c.x, c.y, c.r, c.r, pres ? '#ffffff' : col, 4); ctx.restore();
      T(label, c.x, c.y + 1, c.r * .8, INKC, c.r * 1.5, true);
      B.add({ id: id, x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2, pad: true });
    };
    const dA = Object.keys(dedos).some((k) => dedos[k].k === 'a'), dB = Object.keys(dedos).some((k) => dedos[k].k === 'b');
    if (PXon()) {                                                   // los mismos botones de toque; solo cambia el dibujo
      padsPx(L, vm, col, dA, dB);
      B.add({ id: 'pad_a', x: L.a.x - L.a.r, y: L.a.y - L.a.r, w: L.a.r * 2, h: L.a.r * 2, pad: true });
      if (L.b) B.add({ id: 'pad_b', x: L.b.x - L.b.r, y: L.b.y - L.b.r, w: L.b.r * 2, h: L.b.r * 2, pad: true });
      if (L.stick) B.add({ id: 'stick', x: L.stick.x - L.stick.r, y: L.stick.y - L.stick.r, w: L.stick.r * 2, h: L.stick.r * 2, pad: true });
      return;
    }
    pad(L.a, 'A', 'pad_a', dA);
    if (L.b) pad(L.b, 'B', 'pad_b', dB);
    if (L.stick) {
      const s = stickAct, bx = s ? s.ox : L.stick.x, by = s ? s.oy : L.stick.y, v = s ? stickDe(s.x - s.ox, s.y - s.oy) : { x: 0, y: 0 };
      ctx.save(); ctx.globalAlpha = s ? .9 : .5;
      ell(bx, by, L.stick.r, L.stick.r, 'rgba(255,255,255,.55)', 3);
      ell(bx + v.x * L.stick.r * .7, by + v.y * L.stick.r * .7, L.stick.r * .46, L.stick.r * .46, col, 3.5); ctx.restore();
      B.add({ id: 'stick', x: L.stick.x - L.stick.r, y: L.stick.y - L.stick.r, w: L.stick.r * 2, h: L.stick.r * 2, pad: true });
    }
  }

  /* ── podio ── */
  function dibujarPodio(vm, mj, dt, izq, der, vw, comp) {
    const d = D(), t = tnow(), cx = (izq + der) / 2, S = vm.S, res = mj.res, M = podioModelo(res, mj);
    fondo(izq, der, '#231f45', '#6e2a4a'); guirnalda(izq, der, 12, t);
    const key = mj.k + ':' + mj.i;
    if (podioKey !== key) { podioKey = key; podioT0 = tFase; sonoPodio = false; }
    const tp = Math.max(0, tFase - (podioT0 || 0));
    if (!M) { T('Contando los votos…', cx, 280, 30, '#fffdf2', 400); return; }
    const emp = M.empate || (res && res.empate), gan = M.ganadores, equipo = M.lados.length === 2;
    const tt = tituloPodio(M, mj, (s) => nomCorto(nom(S, s)).toUpperCase());
    T(tt.titulo, cx, 38, 40, '#ffe14d', vw - 40);
    const gd = sess && sess.g && sess.g.destacado ? safe(() => sess.g.destacado()) : null;
    const yoGano = gan.indexOf(vm.yo) >= 0;
    const lineaH = emp ? 'Se fue la luz en todo el país' : (gd ? String(gd) : (tt.sub && !yoGano ? tt.sub : (yoGano ? humor(mj.k, HUMOR_GANA) : humor(mj.k, HUMOR_PIERDE))));
    T(lineaH, cx, 74, 19, '#fffdf2', vw - 40, true);
    if (!sonoPodio && tp > .3) { sonoPodio = true; try { d.sonido(emp ? 'perder' : (yoGano ? 'ganar' : 'perder')); } catch (e) {} }
    const n = M.lista.length, sep = Math.min(190, (vw - 40) / n), base = 452, alt = [150, 112, 82, 58];
    const uCuenta = clamp01((tp - .5) * 1000 / K.PODIO_CUENTA_MS);
    M.lista.forEach((x, j) => {
      const px = cx + (j - (n - 1) / 2) * sep, hh = alt[Math.min(3, x.rank - 1)], p = S.pj[x.s] || {}, id = idCh(p.ch);
      const grow = suave(clamp01((tp - .12 * j) / .5)), h2 = hh * grow, top = base - h2;
      rr(px - sep * .4, top, sep * .8, h2 + 16, 10, id.col, 4);
      rr(px - sep * .4 + 4, top + h2 * .5, sep * .8 - 8, h2 * .5 + 12, 8, id.col2, 0);
      const ganador = x.rank === 1 && !emp;
      d.pose(p.ch, px, top - 58, 96, { animo: emp ? 'esperar' : ganador ? 'celebrar' : 'perder', cuerpo: true, t: t + j, sombra: true });
      if (h2 > 24) { ell(px, top + 22, 20, 20, ganador ? '#ffd23f' : '#e8e4f4', 3); T(String(x.rank), px, top + 23, 24, INKC, 30, true); }
      d.placa(px, base + 36, nomCorto(nom(S, x.s)), p.ch, { cpu: x.cpu ? 'auto' : null, w: Math.min(sep * .9, 150), equipo: equipo ? x.eq : null });
      const monto = Math.round(x.pago * uCuenta);
      if (x.pago) {
        d.moneda(px - 30, base + 66, 10);
        T((x.pago > 0 ? '+' : '') + monto, px + 8, base + 66, 24, x.pago > 0 ? '#ffe14d' : '#ff8a8a', sep * .55);
      } else T('+0', px + 8, base + 66, 20, '#9a96a8', 60, true);
      if (!equipo && x.sc !== null && mj.clase !== 'survival') T(String(x.sc) + ' pts', px, base + 92, 14, '#fffdf2', sep * .8, true);
    });
    // equipos: un solo marcador del bando (2v2 «AZUL 3 – 2 ROJO»); en un 1v3 de umbral no se enseña el puntaje interno
    if (equipo && M.tipo === '2v2' && M.lados[0].sc !== null && M.lados[1].sc !== null) {
      T('AZUL', cx - 90, base + 92, 16, K.COL_EQ[0], 90, true); T(M.lados[0].sc + ' – ' + M.lados[1].sc, cx, base + 92, 24, '#fffdf2', 110); T('ROJO', cx + 90, base + 92, 16, K.COL_EQ[1], 90, true);
    }
    if (ganadorConfeti(emp, gan)) confeti(izq, vw, tp);
    const rest = Math.max(0, (S.nextAt || 0) - vm.serverNow);
    if (rest > 0) T('Volvemos al tablero en ' + Math.ceil(rest / 1000), cx, DH - 10, 13, '#c9c4dd', 300, true);
  }
  const safe = (f) => { try { return f(); } catch (e) { return null; } };
  const ganadorConfeti = (emp, gan) => !emp && gan.length > 0;
  function confeti(izq, vw, tp) {
    const cols = ['#ffd23f', '#ff5c8a', '#5cff7a', '#3fb0ff', '#ff8a3d'];
    for (let i = 0; i < 26; i++) {
      const hx = typeof hash === 'function' ? hash(i, 3, 9) : (i * .37) % 1, hy = typeof hash === 'function' ? hash(i, 5, 2) : (i * .61) % 1;
      const x = izq + hx * vw, y = ((hy * 500 + tp * 90 + i * 31) % 520) + 80;
      rr(x, y, 8, 5, 2, cols[i % 5], 0);
    }
  }

  return C;
}

F.carta = { cartaParaRol: cartaParaRol, tituloPodio: tituloPodio, crear: crear, fase: fase, teclaAInput: teclaAInput, stickDe: stickDe, layoutPads: layoutPads, layoutTarjeta: layoutTarjeta, layoutHud: layoutHud,
  podioModelo: podioModelo, modeloRuleta: modeloRuleta, textoFormato: textoFormato, KEYS: KEYS, K: K, HUDH: HUDH, FORMATOS: FORMATOS };
if (typeof module !== 'undefined') module.exports = F.carta;
})(typeof window !== 'undefined' ? window : globalThis);
