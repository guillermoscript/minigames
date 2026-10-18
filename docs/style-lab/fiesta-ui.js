// LA FIESTA · HUD y paneles del tablero en vivo (M1, doc 07 §5.1 «fiesta-hud», §7.1, §7.3, §8.5; doc 09 §9.3).
// Modo inmediato sobre el canvas del laboratorio: TODO se dibuja con las primitivas de engine.js (rr, ell, poly, line, txt, bust,
// arcPts, tw…), así sale en cualquier estilo (snes/felt/ww/anime/tinta/garabato). Cada cuadro se vuelve a registrar cada botón;
// tocar = buscar en el registro (el último dibujado gana) y devolver una INTENCIÓN por callback. Este archivo NO habla con la red:
// fiesta-main recibe las intenciones y llama a fiesta-net.
//
// Intenciones (opts.emit(it)):
//   {k:'act', a:{t:'TIRAR'}} | {k:'act', a:{t:'USAR', slot, a?, n?}} | {k:'act', a:{t:'RUTA', a}} | {k:'act', a:{t:'COMPRAR', item|null}}
//   {k:'act', a:{t:'ESTRELLA', si}} | {k:'act', a:{t:'OBJETIVO', a}} | {k:'commit', c:'orden'} | {k:'ready', on:true} | {k:'back'}
//   {k:'aim', a:{k, v}} (la duda en vivo: objeto señalado) | {k:'react', id} | {k:'skip'} | {k:'leave'}
// API (window.FIESTA.ui / module.exports):
//   crear({emit, reloj?}) -> U   controlador con estado local (submenús, dado optimista, tarjetas de evento, toasts, emotes)
//     U.dibujar(vm)              HUD + aviso + tarjetas + podio; vm = {S, yo, serverNow, t?, izq?, der?, compacto?, net?, backlog?,
//                                  aim?, seats?, espVisible?}. S = board MOSTRADO (D del director).
//     U.tap(x,y) -> bool          coordenadas lógicas (canvasPoint); false = el toque es del mapa (RUTA se elige ahí)
//     U.mover(x,y,abajo)          hover/presión visual · U.tecla(code) -> bool (Space/Enter = tirar, 1-5 emotes, Esc = atrás)
//     U.efecto(f, S, yo?) -> pistas cada fx que el director reproduce (dado, mon, est, turno, ronda, evento, ruleta, ataque, mjIni,
//                                  mjRes, afk, vuelve, llega, bonus, estrellaMueve); devuelve {vibrar?} para el actor
//     U.toast(msg, col) · U.error(r) (respuesta de fiesta-net -> toast en criollo) · U.emote(s, id) · U.saltar() · U.reset()
//   Puros (probados en Node): registro(), layout(L), fmt, restante, fraccion, modeloAviso(S, yo, local), errorEs(e),
//   PJ (8 personajes: nombre, color, frase, look), ITEM (nombre corto, descripción, color), REACT, BONUS, textoRuleta(f, S).
// Pulido (M1.5): identidad por personaje (ident, PJ.frases/rasgo/col2, animoMood, dibujaPj, pose, placa), partículas de pantalla (fx, pool de 160),
//   sonido con mute (sonido, alternarSilencio; botón 'mute'), temporizador (modeloTemporizador), final (modeloFinal), log ('log'), U.reservado(vm),
//   vm.k (px CSS por unidad lógica: botones >= 44 px reales), vm.ancla(q) y vm.cam.sacudir opcionales. Alias F.UI = F.ui.
(function (root) {
'use strict';
const F = root.FIESTA = root.FIESTA || {};
const NODE = typeof module !== 'undefined' && typeof require !== 'undefined';
const REG = () => F.reglas || (NODE ? require('./fiesta-reglas.js') : null);
const DW = 800, DH = 600, INKC = '#14101c';

/* ───────────── datos ───────────── */
// personajes: la tabla (CHARS), el dibujo, las frases y el roster viven en fiesta-personajes.js (F.PJ); aquí solo se reexportan con las firmas de siempre
const PJ_VACIO = { oscuro: (c) => c, ANIMOS: ['esperar', 'hablar', 'celebrar', 'perder'], animoMood: () => ({ mood: 'calm', talk: 0, dy: 0, rot: 0, sx: 1, sy: 1 }),
  ident: () => ({ id: '', n: '¿?', col: '#9a96a8', col2: '#4a4558', frase: '', rasgo: '', look: () => ({}) }), PJ: {}, PJ_IDS: [], CHARS: {}, LOOK0: {}, GRIS: '#9a96a8',
  cargarRoster: () => [], dibujaPj() {}, pose() {}, retrato() {}, glifo() {}, frase: () => '', lookDe: () => ({}), placa: () => ({ w: 48, h: 22 }) };
const PJM = F.PJ || (NODE ? require('./fiesta-personajes.js') : null) || PJ_VACIO;
const { oscuro, ANIMOS, animoMood, ident, PJ, PJ_IDS, CHARS } = PJM;
{ const Rg = REG(); PJM.cargarRoster(Rg && Rg.PERSONAJES); }
// objetos (fiesta-reglas OBJ): nombre corto para el HUD, qué hace en criollo, color del icono
const ITEM = {
  malta:      { n: 'MALTA',        d: '2 dados · dobles +10',            col: '#7a4a2a' },
  guayoyo:    { n: 'GUAYOYO',      d: '3 dados · trío +30',              col: '#5a3a22' },
  arepa:      { n: 'AREPA',        d: '+4 al dado y te cura la señal',   col: '#f2d38a' },
  medida:     { n: 'A LA MEDIDA',  d: 'tú eliges del 1 al 10',           col: '#3fb0ff' },
  llave:      { n: 'LLAVE',        d: 'abre los portones',               col: '#ffd23f' },
  paracaidas: { n: 'PARACAÍDAS',   d: 'pa\' bajar por los saltos',       col: '#5cff7a' },
  recibo:     { n: 'RECIBO',       d: 'Don Corte no te toca',            col: '#fffdf2' },
  chancla:    { n: 'CHANCLA',      d: 'el rival recula 2 y suelta 5',    col: '#2f7fe0' },
  tequeno:    { n: 'TEQUEÑO',      d: 'le robas un objeto',              col: '#f0b060' },
  senal:      { n: 'SEÑAL CAÍDA',  d: 'el rival saca 1-3',               col: '#9a96a8' },
  dato:       { n: 'EL DATO',      d: 'la estrella se muda',             col: '#ff8aa5' },
  bono:       { n: 'BONO',         d: 'la estrella te sale en 10',       col: '#b49cff' }
};
// emotes: los MISMOS ids de REACT_KINDS (pocketbase/pb_hooks/party.js) con su grito venezolano
const REACT = [
  { id: 'wow',   ic: '😱', s: '¡NA\'GUARÁ!' },
  { id: 'laugh', ic: '😂', s: '¡JAJAJA!' },
  { id: 'fire',  ic: '🔥', s: '¡EPA!' },
  { id: 'star',  ic: '⭐', s: '¡ESO ES TODO!' },
  { id: 'heart', ic: '❤️', s: '¡QUÉ BELLO!' }
];
const REACT_GAP = .6;   // s entre dos emotes míos (doc 07 §8.5)
const BONUS = { minijuegos: 'REY DEL MINIJUEGO', ricachon: 'EL RICACHÓN', pasos: 'EL CAMINANTE', eventos: 'EL CHISMOSO',
  rojas: 'EL SALADO', compras: 'EL COMPRADOR COMPULSIVO' };
const BONUS_D = { minijuegos: 'ganó más minijuegos', ricachon: 'llegó a tener más real', pasos: 'caminó más casillas',
  eventos: 'cayó en más eventos', rojas: 'pisó más rojas', compras: 'compró más cosas' };
const TIPO = { ffa: 'TODOS CONTRA TODOS', '2v2': '2 VS 2', '1v3': '1 VS 3', '1v1': '¡DUELO!' };
const PLAZO0 = { DADO: 20000, RUTA: 12000, TIENDA: 15000, ESTRELLA: 10000, OBJETIVO: 12000, COMMIT: 12000 };
const ERR = [
  [/character taken/i, '¡Ese personaje ya lo agarraron!'], [/room not found|not found/i, 'Esa sala no existe, pana'],
  [/unreachable/i, 'No hay señal con el servidor'], [/stale prompt|stale board/i, 'Se te pasó el tiempo, mi pana'],
  [/not your turn/i, 'No es tu turno, tranquilo'], [/not enough coins/i, 'No te alcanza el real'],
  [/only the host/i, 'Eso lo decide el anfitrión'], [/need at least 2/i, 'Hacen falta 2 panas mínimo'],
  [/not everybody is ready/i, 'Falta gente por estar lista'], [/already started/i, 'Esa partida ya arrancó'],
  [/seat is not free/i, 'Ese puesto ya lo agarraron'], [/bad code/i, 'Ese código no sirve: son 4 letras'],
  [/room is full|full/i, 'La sala está full'], [/played by the cpu/i, 'Ese puesto lo lleva la CPU'],
  [/not now/i, 'Ahorita no se puede'], [/not your seat/i, 'Ese no es tu puesto'], [/too many|rate/i, 'Muy rápido, pana: respira'],
  [/not away/i, 'Ya estás de vuelta'], [/bad (action|option|slot|target)/i, 'Eso no se puede, pana']
];

/* ───────────── puros ───────────── */
function errorEs(e) {
  if (e && typeof e === 'object') e = (e.data && e.data.error) || e.error || (e.status === 0 ? 'unreachable' : '');
  e = String(e || '');
  for (let i = 0; i < ERR.length; i++) if (ERR[i][0].test(e)) return ERR[i][1];
  return '¡Epa! Algo falló';
}
// Registro de botones de un cuadro: add() mientras se dibuja, hit()/press() al tocar. El último agregado gana (está encima).
function registro() {
  let L = [];
  const R = {
    get lista() { return L; },
    limpiar() { L = []; },
    add(b) { const o = Object.assign({ id: '', x: 0, y: 0, w: 0, h: 0, off: false }, b); L.push(o); return o; },
    dentro(b, x, y) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; },
    hit(x, y) { for (let i = L.length - 1; i >= 0; i--) if (R.dentro(L[i], x, y)) return L[i]; return null; },
    press(x, y) { const b = R.hit(x, y); return b && !b.off ? b : (b ? { off: true, b } : null); },
    tecla(code) { for (let i = L.length - 1; i >= 0; i--) { const b = L[i]; if (!b.off && b.key && (b.key === code || (Array.isArray(b.key) && b.key.indexOf(code) >= 0))) return b; } return null; },
    porId(id) { for (let i = L.length - 1; i >= 0; i--) if (L[i].id === id) return L[i]; return null; }
  };
  return R;
}
const fmt = {
  mon: (n) => String(Math.max(0, n | 0)),
  ronda: (r, tot) => 'RONDA ' + (r | 0) + '/' + (tot | 0),
  seg: (ms) => String(Math.max(0, Math.ceil((ms || 0) / 1000))),
  reloj: (ms) => { const s = Math.max(0, Math.ceil((ms || 0) / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  limpio: (s) => String(s == null ? '' : s).replace(/^CPU\s*[·•-]\s*/i, ''),                    // el reductor llama «CPU · EL PORTU» a las CPU: la insignia CPU va aparte
  nombre: (s, max) => { s = String(s == null ? '' : s).toUpperCase(); max = max || 12; return s.length > max ? s.slice(0, max - 1) + '…' : s; },
  puesto: (p) => (p | 0) + '.º',
  signo: (d) => (d > 0 ? '+' : '') + d
};
const restante = (hasta, serverNow) => (typeof hasta === 'number' && typeof serverNow === 'number') ? Math.max(0, hasta - serverNow) : 0;
// fracción que queda del aviso (1 = recién abierto). total = plazo del tipo (el primer dado es de 30 s)
function fraccion(esp, serverNow, S) {
  if (!esp || typeof esp.hasta !== 'number') return 0;
  const R = REG(), P = (R && R.PLAZO) || PLAZO0;
  let tot = P[esp.k] || 15000; if (esp.k === 'DADO' && S && S.r === 1) tot = P.DADO1 || 30000;
  return Math.max(0, Math.min(1, restante(esp.hasta, serverNow) / tot));
}
function nombreDe(S, s) { const p = S && S.pj && S.pj[s]; return p ? fmt.limpio(p.name || (PJ[p.ch] ? PJ[p.ch].n : s)) : String(s || ''); }
function nodoNombre(id) { const R = REG(), m = R && R.mapa; return m && m.nodos && m.nodos[id] ? m.nodos[id].n : String(id); }
function ordenAsientos(S) {
  const ss = S && S.pj ? Object.keys(S.pj).sort() : [];
  if (S && Array.isArray(S.orden) && S.orden.length === ss.length) return S.orden.slice();
  return ss;
}
const numF = (v) => { v = +v; return isFinite(v) ? v : 0; };
// temporizador del aviso como datos: frac (1 = recién abierto), seg enteros, urgente = últimos 5 s, quien = asiento con el turno
function modeloTemporizador(S, vm) {
  const e = S && S.esp, sn = vm && vm.serverNow;
  if (!e || typeof e.hasta !== 'number' || typeof sn !== 'number') return { frac: 0, seg: 0, urgente: false, quien: e && e.s ? e.s : null };
  const seg = Math.ceil(restante(e.hasta, sn) / 1000);
  return { frac: fraccion(e, sn, S), seg, urgente: seg <= 5, quien: e.s || null };
}
// pantalla final como datos: orden del reductor (S.podio ya viene con R.rango; si no, R.rango), bonus de S.bonus o del 2.º argumento
function modeloFinal(S, extra) {
  S = S || {}; const R = REG(), pj = S.pj || {};
  let pod = Array.isArray(S.podio) ? S.podio : null;
  if (!pod) {
    const rk = R && R.rango && S.pj ? R.rango(S) : ordenAsientos(S); pod = [];
    rk.forEach((s, i) => { const p = pj[s], q = pod[i - 1]; pod.push({ s, est: p.est, mon: p.mon, p: q && q.est === p.est && q.mon === p.mon ? q.p : i + 1 }); });
  }
  const bonus = (Array.isArray(extra) ? extra : Array.isArray(S.bonus) ? S.bonus : []).map((b) => ({ s: b.s, id: b.id, v: b.v }));
  const podio = pod.filter((x) => pj[x.s]).map((x) => ({ s: x.s, ch: pj[x.s].ch || '', name: fmt.limpio(pj[x.s].name || (PJ[pj[x.s].ch] || {}).n || x.s), est: x.est, mon: x.mon, rank: x.p, cpu: pj[x.s].cpu || null,
    bonus: bonus.filter((b) => b.s === x.s).map((b) => b.id) }));
  return { podio, bonus, empate: podio.filter((x) => x.rank === 1).length > 1 };
}
// leyenda de casillas: nombres en español por tipo (los iconos los dibuja el tablero)
const LEY = [['banco', 'Banco: cobras'], ['azul', 'Azul: ganas monedas'], ['roja', 'Roja: pierdes monedas'], ['evento', 'Evento'], ['vaina', 'Qué vaina'], ['duelo', 'Duelo'],
  ['transporte', 'Transporte'], ['alcabala', 'Alcabala'], ['ahorita', 'Ahorita'], ['delta', 'Delta'], ['especial', 'Especial'], ['villano', 'Don Corte']];
function leyendaCasillas() {
  const T0 = F.tablero && F.tablero.LEYENDA; if (Array.isArray(T0) && T0.length) return T0;
  const TP = (F.tablero && F.tablero.TIPOS) || null;
  return LEY.filter((x) => !TP || TP[x[0]]).map((x) => ({ t: x[0], n: x[1], ic: (TP && TP[x[0]] && TP[x[0]].g) || x[0] }));
}
// cuántas partículas por efecto (puro): k = 'mon'|'est'|'turno'|'ronda'|'evento'|'fin'|'dado'|'ataque'|'bonus'..., d = monto
function fxCuenta(k, d) {
  d = Math.abs(numF(d));
  switch (k) {
    case 'mon': return Math.max(3, Math.min(14, 2 + Math.round(d)));
    case 'est': return 16;
    case 'bonus': case 'fin': return 24;
    case 'turno': case 'ronda': return 8;
    case 'evento': case 'mjRes': return 12;
    case 'dado': return 6;
    case 'ataque': return 10;
    default: return 6;
  }
}

/* ── sonido: hooks sobre snd() del motor, nada de archivos. No-op en Node, con silencio y con más de 1 sonido del mismo nombre cada 80 ms ── */
const SONIDOS = {                 // [freq, dur, tipo, vol, slide, retardo ms]
  tap: [[660, .05, 'square', .04, 0, 0]], ok: [[660, .07, 'square', .05, 0, 0], [880, .1, 'square', .05, 0, 70]], no: [[200, .15, 'sawtooth', .05, -90, 0]],
  join: [[523, .08, 'triangle', .07, 0, 0], [784, .12, 'triangle', .07, 0, 80]], salir: [[500, .12, 'triangle', .05, -200, 0]],
  listo: [[784, .08, 'square', .05, 0, 0], [1047, .12, 'square', .05, 0, 70]], pick: [[440, .06, 'square', .05, 0, 0], [660, .1, 'square', .05, 0, 60]],
  rechazo: [[180, .2, 'sawtooth', .06, -80, 0]], dado: [[300, .05, 'square', .04, 100, 0], [360, .05, 'square', .04, 100, 70], [420, .05, 'square', .04, 100, 140]],
  dadoCae: [[160, .12, 'sine', .14, -60, 0]], hop: [[520, .04, 'square', .03, 80, 0]],
  moneda: [[988, .06, 'square', .05, 0, 0], [1319, .14, 'square', .05, 0, 60]], perdida: [[330, .25, 'sawtooth', .05, -200, 0]],
  estrella: [[523, .1, 'square', .05, 0, 0], [659, .1, 'square', .05, 0, 90], [784, .1, 'square', .05, 0, 180], [1047, .3, 'square', .06, 0, 270]],
  turno: [[740, .09, 'triangle', .08, 0, 0], [988, .14, 'triangle', .08, 0, 100]], ronda: [[392, .12, 'triangle', .06, 0, 0], [523, .18, 'triangle', .06, 0, 110]],
  evento: [[600, .1, 'sine', .07, 300, 0]], ataque: [[200, .2, 'sawtooth', .07, -120, 0]], emote: [[880, .05, 'sine', .05, 400, 0]],
  cuenta: [[1000, .06, 'square', .05, 0, 0]], empezar: [[392, .1, 'square', .05, 0, 0], [523, .1, 'square', .05, 0, 110], [784, .25, 'square', .06, 0, 220]],
  ganar: [[523, .12, 'square', .05, 0, 0], [659, .12, 'square', .05, 0, 100], [784, .2, 'square', .05, 0, 200]], perder: [[330, .3, 'sawtooth', .05, -200, 0]],
  ching: [[1319, .05, 'square', .05, 0, 0], [1760, .16, 'square', .05, 0, 55]], tic: [[1200, .04, 'square', .05, 0, 0]],
  fanfarria: [[523, .15, 'square', .05, 0, 0], [523, .15, 'square', .05, 0, 160], [659, .15, 'square', .05, 0, 320], [784, .35, 'square', .06, 0, 480], [1047, .4, 'square', .06, 0, 760]]
};
// voz del personaje: notas derivadas de su pitch y del ánimo (arreglos congelados y cacheados; esperar = silencio)
const VOZ = {};
function vozNotas(ch, animo) {
  const k = ch + '|' + animo, c = VOZ[k]; if (c) return c;
  const d = CHARS[ch], b = 440 * (d && d.pitch > 0 ? d.pitch : 1); let n;
  if (animo === 'celebrar') n = [[b, .08, 'triangle', .06, 0, 0], [b * 1.25, .08, 'triangle', .06, 0, 70], [b * 1.5, .16, 'triangle', .06, 0, 140]];
  else if (animo === 'perder') n = [[b * .9, .16, 'sawtooth', .04, -60, 0], [b * .7, .26, 'sawtooth', .04, -90, 150]];
  else if (animo === 'hablar') n = [[b * .8, .06, 'square', .03, 40, 0], [b * .95, .07, 'square', .03, -30, 75]];
  else n = [];
  n.forEach((x) => Object.freeze(x)); return (VOZ[k] = Object.freeze(n));
}
function crearSonido(o) {
  o = o || {}; const ult = {}, fin = [];                  // fin = instantes (ms) en que acaban los sonidos en curso: nunca más de 3 a la vez
  const reloj = o.reloj || (() => Date.now());
  const mudo = o.silencio || (() => !!(F.ui && F.ui.silencio));
  return function (nombre, op) {
    try {
      op = op || {};
      const def = nombre === 'voz' ? vozNotas(op.ch, op.animo) : SONIDOS[nombre], play = o.snd || (typeof snd === 'function' ? snd : null);
      if (!def || !def.length || !play || mudo()) return false;
      const t = reloj(); if (ult[nombre] !== undefined && t - ult[nombre] < 80) return false;
      for (let i = fin.length - 1; i >= 0; i--) if (fin[i] <= t) fin.splice(i, 1);
      if (fin.length >= 3) return false;
      let dur = 0; for (let i = 0; i < def.length; i++) dur = Math.max(dur, (def[i][5] || 0) + def[i][1] * 1000); fin.push(t + dur);
      ult[nombre] = t;
      const vol = op.vol === undefined ? 1 : op.vol, pit = op.pitch || 1;
      def.forEach((n) => { const f = () => play(n[0] * pit, n[1], n[2], n[3] * vol, n[4]); if (n[5]) setTimeout(f, n[5]); else f(); });
      return true;
    } catch (e) { return false; }
  };
}
const sonido = crearSonido();
function leerSilencio() { try { return !!(root.localStorage && root.localStorage.getItem('fiesta.silencio') === '1'); } catch (e) { return false; } }
function alternarSilencio() {
  F.ui.silencio = !F.ui.silencio;
  try { if (root.localStorage) root.localStorage.setItem('fiesta.silencio', F.ui.silencio ? '1' : '0'); } catch (e) { /* sin storage */ }
  return F.ui.silencio;
}

// contador que rueda hacia el valor real (cosmético): ~.4 s; con |dif| < .5 salta al valor exacto
function rueda(v, to, dt) {
  if (!isFinite(+v)) return numF(to);
  v = numF(v); to = numF(to); const d = to - v; if (Math.abs(d) < .5) return to;
  return v + d * Math.min(1, numF(dt) / .12);
}
// color del temporizador: verde -> naranja -> rojo
const tcol = (k) => (k > .5 ? '#5cff7a' : k > .25 ? '#ff9f3d' : '#ff4d5e');
// Layout del HUD en coordenadas lógicas. L = {izq, der, compacto}. izq/der = gameLeft()/gameRight() (pantallas anchas).
function layout(L) {
  L = L || {};
  const izq = typeof L.izq === 'number' ? L.izq : 0, der = typeof L.der === 'number' ? L.der : DW, c = !!L.compacto;
  const m = 6, g = 6, ancho = der - izq, h = c ? 86 : 70;
  // k = px CSS por unidad lógica (main fija el alto del lienzo a 600 unidades): 44 px reales = 44/k unidades. tg = botones sueltos (hasta 100), tp = botones de panel (hasta 64)
  const k = L.k > 0 ? L.k : (c ? .72 : 1), tg = Math.min(100, Math.max(44, Math.ceil(44 / k))), tp = Math.min(64, tg), us = c ? Math.max(62, tg) : 46;
  let w = (ancho - 2 * m - 3 * g) / 4, cards;
  const MAXW = 236;
  if (w > MAXW) { w = MAXW; cards = [0, 1, 2, 3].map((i) => ({ x: i < 2 ? izq + m + i * (w + g) : der - m - (4 - i) * (w + g) + g, y: m, w, h })); }
  else cards = [0, 1, 2, 3].map((i) => ({ x: izq + m + i * (w + g), y: m, w, h }));
  const cx = (izq + der) / 2, ph = c ? 236 : 196;
  const btn = c ? Math.max(66, tg) : 54, fila = btn > 80, sw = c ? Math.min(170, Math.max(btn + 20, 118)) : 150, pw = Math.min(c ? 640 : 560, ancho - 2 * (Math.max(btn, sw) + 12));   // el panel no pisa emotes ni ADELANTAR
  // pantallas muy angostas (móvil vertical): la ronda se pega a la izquierda para no pisar mute y log, y el ticker no cabe
  const bw0 = Math.min(500, Math.max(300, ancho - 300)), cw0 = Math.min(440, ancho - 40), lx = der - 2 * us - 16, yb = m + h + 6 + us + 6;   // yb: debajo de mute y log cuando el banner o la carta llegan hasta ellos
  const bajoMini = c && ancho < 560 ? 282 : 0;   // vertical angosto: el minimapa (y 132-231 + hueco) ocupa la esquina izquierda; banner y carta van debajo
  const bY = Math.max(c ? 178 : 168, cx + bw0 / 2 > lx ? yb + 38 : 0, bajoMini ? bajoMini + 38 : 0), cY = Math.max(170, cx + cw0 / 2 > lx ? yb : 0, bajoMini);
  const angosto = c && cx + 80 > der - 2 * us - 16 - 6, rw = angosto ? Math.max(90, Math.min(160, der - 2 * us - 16 - 6 - (izq + m))) : 160;
  return {
    izq, der, cx, compacto: c, cards,
    ronda: { x: angosto ? izq + m : cx - 80, y: m + h + 6, w: rw, h: c ? 34 : 28 },
    ticker: { x: izq + m, y: m + h + 6, w: angosto ? 0 : Math.max(0, Math.min(330, cx - 80 - 12 - (izq + m))), h: c ? 30 : 24 },
    panel: { x: cx - pw / 2, y: DH - ph - 10, w: pw, h: ph },
    banner: { x: cx, y: bY, w: bw0, h: 76 },
    carta: { x: cx - Math.min(220, ancho / 2 - 20), y: cY, w: cw0, h: 170 },
    mute: { x: der - us - 10, y: m + h + 6, w: us, h: us },
    log: { x: der - 2 * us - 16, y: m + h + 6, w: us, h: us },
    logPanel: { x: Math.max(izq + 10, der - 350), y: m + h + us + 12, w: Math.min(340, ancho - 20), h: 232 + Math.max(0, tg - 44) },
    k, tg, tp,
    emoteBtn: { x: der - btn - 10, y: DH - btn - 10, w: btn, h: btn },
    emotes: [0, 1, 2, 3, 4].map((i) => (fila ? { x: der - btn - 10 - (i + 1) * (btn + 8), y: DH - btn - 10, w: btn, h: btn } : { x: der - btn - 10, y: DH - btn - 10 - (i + 1) * (btn + 8), w: btn, h: btn })),
    skip: { x: izq + 10, y: DH - btn - 10, w: sw, h: btn },
    red: { x: cx - 170, y: m + h + (c ? 46 : 40), w: 340, h: c ? 40 : 34 }
  };
}
// Podio: L = {izq, der, tg (alto táctil del botón de salir), bonus (cuántas tarjetas de bonus)}. Todo lo que cuelga bajo la base (placa, cifras, bonus) y el botón
// VOLVER AL MENÚ caben sin pisarse: la base sube y los escalones se achican si hace falta. hc = alto de cabeza; el personaje se asoma de la cintura para arriba.
function layoutPodio(n, L) {
  L = L || {};
  const izq = typeof L.izq === 'number' ? L.izq : 0, der = typeof L.der === 'number' ? L.der : DW, cx = (izq + der) / 2;
  const w = Math.min(150, (der - izq - 60) / Math.max(1, n)), bh = Math.max(46, L.tg | 0), by = DH - bh - 10, nb = Math.max(0, Math.min(4, L.bonus | 0));
  const base = Math.min(410, by - 8 - 58 - (nb ? 52 : 0)), hc = Math.min(84, w * .62), top0 = 118;     // top0: bajo el título y la frase
  const a0 = Math.max(56, Math.min(130, base - top0 - hc * 1.75)), alto = [a0, a0 * .72, a0 * .52, a0 * .36];
  // orden visual clásico: 2.º, 1.º, 3.º, 4.º
  const pos = n >= 3 ? [1, 0, 2, 3] : [0, 1];
  return { cx, base, w, hc, by, slots: pos.slice(0, n).map((rank, k) => ({ rank, x: cx + (k - (n - 1) / 2) * (w + 10) - w / 2, w, h: Math.max(36, alto[rank] || 40) })) };
}
/* Texto de una ruleta ya resuelta (fx {k:'ruleta', que, v}) */
function textoRuleta(f, S) {
  const n = (s) => nombreDe(S, s);
  if (f.que === 'vaina') { const v = f.v || []; const q = typeof v[1] === 'number' ? v[1] + ' monedas' : v[1] === 'lugar' ? 'su puesto' : v[1] === 'monedas' ? 'TODAS sus monedas' : 'una estrella';
    return { t: '¡QUÉ VAINA!', s: n(v[0]) + ' le da ' + q + ' a ' + n(v[2]) }; }
  if (f.que === 'villano') { const T = { planta: 'Te cortó la luz: −10', apagon: '¡SE FUE LA LUZ EN TODO EL PAÍS!', bombillo: 'Se llevó un bombillo… y un objeto', reparto: 'Reparto equitativo pa\' todos', buendia: 'Amaneció de buenas: +5' };
    return { t: 'DON CORTE', s: T[f.v] || String(f.v) }; }
  if (f.que === 'delta') { const T = { flota: 'Flota el bote: ganas real', hunde: 'Se hunde la curiara', recalcula: 'Recalculando ruta…', telenovela: '¡Telenovela! Dos se cambian de puesto',
      espejo: 'Espejo: te cambias con el más lejos', cedula: 'Te pidieron la cédula: a la salida', hamaca: 'Te tiras en la hamaca', aprecia: 'El Delta aprecia la visita',
      vaca: 'Hiciste la vaca del banco', garza: 'Una garza te lleva volando', luz: 'Volvió la luz', apagon: '¡Apagón!', penero: 'El peñero te devuelve' };
    return { t: 'CARTA DEL DELTA', s: T[f.v] || String(f.v) }; }
  if (f.que === 'duelo') return { t: '¡DUELO!', s: n(f.s) + ' reta a ' + n(f.a) + ' por ' + f.v + ' monedas' };
  if (f.que === 'ultimos5') { const T = { autobus: 'Se va en autobús cerquita de la estrella', bono: 'Le toca el Bono de la Abuela', vaca: 'Se lleva 20 del banco' };
    return { t: '¡ÚLTIMOS 5!', s: n(f.s) + ': ' + (T[f.v] || f.v) }; }
  if (f.que === 'tasa') return { t: 'LA TASA DEL DÍA', s: 'La estrella cuesta ' + f.v };
  if (f.que === 'color') return { t: 'RULETA', s: n(f.s) + ' queda ' + (f.v === 'a' ? 'AZUL' : 'ROJO') };
  return { t: 'RULETA', s: String(f.v) };
}
const TXT_EVENTO = { billete: '¡BILLETE!', cola: 'COLA EN EL BANCO', regalo: 'REGALO DE LA VECINA', fresas: '¡FRESAS CON CREMA!', propina: 'PROPINA',
  relampago: '¡RELÁMPAGO!', apagon: '¡SE FUE LA LUZ!', luz: 'VOLVIÓ LA LUZ', ultimos5: '¡ÚLTIMOS 5!', hamaca: 'LA HAMACA', ahorita: 'AHORITA',
  recibo: 'RECIBO PAGADO', lastima: 'DON CORTE', dato: 'EL DATO', pelaos: 'DUELO DE PELAOS', rey: '¡REY DE LA RUMBA!' };
/* El aviso que me toca, como datos (puro): {k, titulo, sub?, botones:[{id, label, sub?, intent, off?, item?, s?, sel?}], s?, hasta?}.
   local = estado del submenú: {modo:'objetivo'|'medida', slot, item} y {sel} (artículo marcado en la tienda). */
function modeloAviso(S, yo, local) {
  local = local || {};
  if (!S || !S.pj || !yo || !S.pj[yo]) return null;
  const p = S.pj[yo], e = S.esp, f = S.f, R = REG();
  if (f === 'lobby' || f === 'fin' || f === 'final') return null;
  if (p.cpu === 'afk') return { k: 'AFK', titulo: 'Estás en la hamaca 💤', sub: 'La CPU juega por ti mientras tanto', botones: [{ id: 'volvi', label: '¡VOLVÍ!', intent: { k: 'back' }, grande: true }] };
  if (p.cpu === 'auto') return null;
  if (f === 'orden' && e && e.k === 'COMMIT') {
    if (e.quien && e.quien.indexOf(yo) >= 0 && !(e.hecho && e.hecho[yo]))
      return { k: 'COMMIT', titulo: '¡TIRA PA\' VER QUIÉN EMPIEZA!', sub: 'El más alto arranca', hasta: e.hasta, botones: [{ id: 'orden', label: '¡TIRA!', intent: { k: 'commit', c: 'orden' }, grande: true, key: ['Space', 'Enter'] }] };
    return { k: 'ESPERA', titulo: 'Esperando que los demás tiren…', botones: [] };
  }
  if (f === 'carta' && S.mj && S.mj.as && S.mj.as.indexOf(yo) >= 0) {
    if (S.mj.listos && S.mj.listos[yo]) return { k: 'ESPERA', titulo: '¡Listo! Esperando a los demás…', botones: [] };
    return { k: 'LISTO', titulo: '¡MINIJUEGO! ' + (TIPO[S.mj.tipo] || ''), sub: 'Dale a LISTO cuando estés', hasta: S.mj.cartaHasta,
      botones: [{ id: 'listo', label: '¡LISTO!', intent: { k: 'ready', on: true }, grande: true, key: ['Space', 'Enter'] }] };
  }
  if (f !== 'turno' || !e) return null;
  if (e.s !== yo) return { k: 'ESPERA', s: e.s, kind: e.k, hasta: e.hasta, titulo: textoEspera(S, e), botones: [] };
  const base = { k: e.k, hasta: e.hasta, eid: e.id };
  if (e.k === 'DADO') {
    const items = (e.opc || []).filter((o) => o && typeof o === 'object');
    if (local.modo === 'objetivo') {
      const it = items.filter((o) => o.slot === local.slot)[0];
      if (it) return Object.assign(base, { titulo: '¿A quién le tiras ' + (ITEM[it.o] ? ITEM[it.o].n : it.o) + '?', botones:
        (it.bl || []).map((s) => ({ id: 'bl:' + s, label: nombreDe(S, s), s, intent: { k: 'act', a: { t: 'USAR', slot: it.slot, a: s } } }))
          .concat([{ id: 'atras', label: 'ATRÁS', intent: { k: 'ui', modo: null }, chico: true, key: 'Escape' }]) });
    }
    if (local.modo === 'medida') {
      const it = items.filter((o) => o.slot === local.slot)[0];
      if (it) { const b = []; for (let n = 1; n <= 10; n++) b.push({ id: 'n:' + n, label: String(n), intent: { k: 'act', a: { t: 'USAR', slot: it.slot, n } }, key: n < 10 ? 'Digit' + n : 'Digit0' });
        b.push({ id: 'atras', label: 'ATRÁS', intent: { k: 'ui', modo: null }, chico: true, key: 'Escape' });
        return Object.assign(base, { titulo: '¿Cuánto quieres sacar?', botones: b }); }
    }
    const b = [{ id: 'tirar', label: '¡TIRA EL DADO!', intent: { k: 'act', a: { t: 'TIRAR' } }, grande: true, key: ['Space', 'Enter'] }];
    items.forEach((o) => {
      const d = R && R.OBJ ? R.OBJ[o.o] : null, intent = d && d.blanco ? { k: 'ui', modo: 'objetivo', slot: o.slot, item: o.o }
        : o.o === 'medida' ? { k: 'ui', modo: 'medida', slot: o.slot, item: o.o } : { k: 'act', a: { t: 'USAR', slot: o.slot } };
      b.push({ id: 'usar:' + o.slot, label: (ITEM[o.o] ? ITEM[o.o].n : o.o), sub: 'USAR', item: o.o, intent });
    });
    return Object.assign(base, { titulo: '¡TE TOCA, PANA!', sub: items.length ? 'Usa un objeto antes de tirar (o no)' : null, botones: b });
  }
  if (e.k === 'RUTA') {
    return Object.assign(base, { titulo: '¿Pa\' dónde agarras?', sub: 'Toca una flecha en el mapa', banner: true,
      botones: (e.opc || []).filter((o) => o.ok).map((o) => ({ id: 'ruta:' + o.a, label: nodoNombre(o.a), sub: o.costo ? '−' + o.costo + ' 🪙' : (o.modo && o.modo !== 'camino' ? o.modo : null),
        intent: { k: 'act', a: { t: 'RUTA', a: o.a } }, chico: true })) });
  }
  if (e.k === 'TIENDA') {
    const sel = local.sel, op = e.opc || [], b = op.map((o, i) => ({ id: 'item:' + o.item, label: ITEM[o.item] ? ITEM[o.item].n : o.item, sub: ITEM[o.item] ? ITEM[o.item].d : '',
      item: o.item, precio: o.precio, off: o.precio > p.mon, sel: sel === o.item, intent: { k: 'ui', sel: o.item, aim: { k: 'item', v: o.item } }, key: 'Digit' + (i + 1) }));
    const ok = op.filter((o) => o.item === sel)[0];
    b.push({ id: 'comprar', label: ok ? 'COMPRAR · ' + ok.precio : 'COMPRAR', intent: ok ? { k: 'act', a: { t: 'COMPRAR', item: ok.item } } : { k: 'ui' }, off: !ok || ok.precio > p.mon, sub: !ok ? 'Marca algo primero' : ok.precio > p.mon ? 'No te alcanzan las monedas' : null, key: 'Enter', accion: true });
    b.push({ id: 'nada', label: 'NO, GRACIAS', intent: { k: 'act', a: { t: 'COMPRAR', item: null } }, accion: true, key: 'Escape' });
    return Object.assign(base, { titulo: '🛒 Abasto de la esquina', sub: 'Tienes ' + p.mon + ' monedas', botones: b });
  }
  if (e.k === 'ESTRELLA') {
    const pr = e.opc && e.opc[0] ? e.opc[0].precio : (S.estrella ? S.estrella.precio : 10);
    return Object.assign(base, { titulo: '¿Le compras la arepa-estrella a la Abuela?', sub: 'Cuesta ' + pr + ' · tienes ' + p.mon, precio: pr, botones: [
      { id: 'si', label: '¡SÍ, DAME!', intent: { k: 'act', a: { t: 'ESTRELLA', si: true } }, off: p.mon < pr, sub: p.mon < pr ? 'No te alcanzan las monedas' : null, grande: true, key: 'Enter' },
      { id: 'no', label: 'NO, GRACIAS', intent: { k: 'act', a: { t: 'ESTRELLA', si: false } }, key: 'Escape' }] });
  }
  if (e.k === 'OBJETIVO') {
    return Object.assign(base, { titulo: '¡DUELO! ¿A quién retas?', sub: 'El que gane se lleva la apuesta',
      botones: (e.opc || []).map((s) => ({ id: 'obj:' + s, label: nombreDe(S, s), s, intent: { k: 'act', a: { t: 'OBJETIVO', a: s } } })) });
  }
  return null;
}
function textoEspera(S, e) {
  const n = nombreDe(S, e.s);
  return ({ DADO: n + ' va a tirar el dado…', RUTA: n + ' está pensando por dónde agarrar 🤔', TIENDA: n + ' está en el abasto 🛒',
    ESTRELLA: '¿' + n + ' comprará la estrella?', OBJETIVO: n + ' está eligiendo a quién retar…' })[e.k] || n + ' está pensando…';
}

/* ───────────── dibujo (solo navegador: usa las primitivas globales de engine.js) ───────────── */
// px CSS por unidad lógica: vm.k si main lo pasa; si no, el alto real del canvas entre 600 (solo navegador)
function kDe(vm) {
  if (vm && vm.k > 0) return vm.k;
  try { if (typeof view !== 'undefined' && view.getBoundingClientRect) { const k = view.getBoundingClientRect().height / DH; if (k > .05 && k < 8) return k; } } catch (e) { /* sin canvas */ }
  return 0;
}
const lab = () => typeof rr === 'function' && typeof txt === 'function';
const tnow = () => (typeof now === 'number' ? now : 0);
// ancho de texto con caché por (estilo, tamaño, cadena): tw() mide con el canvas y se llama varias veces por cuadro
const TWC = {}; let twN = 0;
function tw2(s, size) {
  const k = (typeof style !== 'undefined' ? style : '') + '|' + size + '|' + s, v = TWC[k]; if (v !== undefined) return v;
  if (twN > 600) { for (const q in TWC) delete TWC[q]; twN = 0; }
  twN++; return (TWC[k] = tw(s, size));
}
// txt() del motor en anime inclina, rellena con degradado y le pone contorno doble: a ≤ 32 px eso es papilla. Ahí dibujamos derecho, plano y con un solo contorno fino.
function txtL(s, x, y, size, col, plain) {
  if (typeof style !== 'undefined' && style === 'anime' && size <= 32 && typeof fnt === 'function') {
    ctx.save(); ctx.translate(x, y); ctx.font = fnt(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (!plain) { ctx.lineWidth = Math.max(2, size * .2); ctx.strokeStyle = INKC; ctx.strokeText(s, 0, 0); }
    ctx.fillStyle = col; ctx.fillText(s, 0, 0); ctx.restore(); return;
  }
  txt(s, x, y, size, col, 0, plain);
}
function T(s, x, y, size, col, maxW, plain) {          // texto centrado que se achica hasta caber
  s = String(s); if (maxW) { const w = tw2(s, size); if (w > maxW) size = Math.max(8, size * maxW / w); }
  txtL(s, x, y, size, col || '#fff', !!plain);
}
function TL(s, x, y, size, col, maxW, plain) { s = String(s); let w = tw2(s, size); if (maxW && w > maxW) { size = Math.max(8, size * maxW / w); w = tw2(s, size); } txtL(s, x + w / 2, y, size, col || '#fff', !!plain); }
function TR(s, x, y, size, col, maxW, plain) { s = String(s); let w = tw2(s, size); if (maxW && w > maxW) { size = Math.max(8, size * maxW / w); w = tw2(s, size); } txtL(s, x - w / 2, y, size, col || '#fff', !!plain); }
function estrellaP(x, y, r, col, o) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * .45 : r; p.push([x + Math.cos(a) * k, y + Math.sin(a) * k]); } poly(p, col || '#ffe14d', o === undefined ? 2.5 : o); }
function moneda(x, y, r) { ell(x, y, r, r, '#ffd23f', 2.5); ell(x, y, r * .55, r * .55, '#f0b020', 0); }
function anillo(x, y, r, k, w) {
  w = w || 5; line(arcPts(x, y, r, 0, Math.PI * 2, 24), w + 3, INKC);
  line(arcPts(x, y, r, 0, Math.PI * 2, 24), w, '#3a3550');
  if (k > 0.01) line(arcPts(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, Math.max(4, Math.round(24 * k))), w, k > .5 ? '#5cff7a' : k > .25 ? '#ffe14d' : '#ff4d5e');
}
const lookDe = PJM.lookDe;
// cara recortada: la cabeza centrada en (cx, cy), alto de cabeza ≈ hc
const retrato = PJM.retrato;
// icono de botón con la cara del personaje, recortada al cuadrito
const icRetrato = (ch) => (x, y, r) => retrato(ch, x, y, r * 1.7, { clip: { x: x - r * 1.25, y: y - r * 1.25, w: r * 2.5, h: r * 2.5 } });
// colores de confeti de un personaje (cacheado; sin fila = los de siempre)
const PAL = {};
function paleta(ch) {
  const c = PAL[ch]; if (c) return c; const d = CHARS[ch];
  return (PAL[ch] = d ? [d.col, d.col2, '#ffe14d', '#fffdf2', d.col] : FX_COLS);
}
function corona(x, y, w) {                                 // corona chica (1.º lugar), centrada en x con la base en y
  const h = w * .7, p = [[x - w / 2, y], [x - w / 2, y - h * .7], [x - w / 4, y - h * .35], [x, y - h], [x + w / 4, y - h * .35], [x + w / 2, y - h * .7], [x + w / 2, y]];
  poly(p, '#ffd23f', 2.5); ell(x, y - h * .55, w * .06, w * .06, '#ff5c8a', 0);
}
function caja(x, y, w, h, fill, r, o) { rr(x + 3, y + 4, w, h, r === undefined ? 12 : r, 'rgba(20,16,28,.35)', 0); rr(x, y, w, h, r === undefined ? 12 : r, fill, o === undefined ? 4 : o); }
// botón con sombra, hover y presión; registra el rectángulo
function boton(B, b, ptr) {
  const hv = ptr && ptr.x >= b.x && ptr.x <= b.x + b.w && ptr.y >= b.y && ptr.y <= b.y + b.h, pr = hv && ptr.abajo && !b.off;
  const fill = b.off ? '#8f8b9c' : b.sel ? '#ffe14d' : (b.fill || '#ffffff'), d = pr ? 1 : 5;
  rr(b.x + 2, b.y + 5, b.w, b.h, 14, '#14101c', 0);
  rr(b.x, b.y + (5 - d), b.w, b.h, 14, hv && !b.off ? mixC(fill) : fill, 4);
  const cy = b.y + (5 - d) + b.h / 2, size = b.size || Math.min(30, b.h * .42), col = b.off ? '#4a4558' : (b.col || INKC);
  if (b.icon) b.icon(b.x + 6 + b.h / 2, cy, b.h * .32);
  const lx = b.icon ? b.x + b.h + 6 : b.x + 10, lw = b.w - (b.icon ? b.h + 16 : 20);
  const dos = !b.sub && b.label.length > 14 && tw2(b.label, size) > lw && b.label.indexOf(' ') > 0 ? partir(b.label) : null;   // etiqueta larga: dos líneas del mismo tamaño en vez de una diminuta
  if (b.sub) { T(b.label, lx + lw / 2, cy - size * .38, size * .9, col, lw, true); T(b.sub, lx + lw / 2, cy + size * (b.subSize ? .62 : .5), b.subSize || size * .55, col, lw, true); }
  else if (dos) { const z2 = Math.max(11, Math.min(size * .8, b.h * .3)); T(dos[0], lx + lw / 2, cy - z2 * .55, z2, col, lw, true); T(dos[1], lx + lw / 2, cy + z2 * .6, z2, col, lw, true); }
  else T(b.label, lx + lw / 2, cy + 1, size, col, lw, true);
  B.add(b);
}
// parte una etiqueta en dos líneas por el espacio más cercano a la mitad
function partir(s) { const m = s.length / 2; let k = -1; for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (k < 0 || Math.abs(i - m) < Math.abs(k - m))) k = i; return k < 0 ? [s, ''] : [s.slice(0, k), s.slice(k + 1)]; }
function mixC(c) { try { return typeof mix === 'function' && /^#[0-9a-f]{6}$/i.test(c) ? mix(c, '#ffffff', .25) : c; } catch (e) { return c; } }
function icItem(item) { return (x, y, r) => { const c = (ITEM[item] || {}).col || '#ccc';
  if (item === 'chancla') { ell(x, y, r * .55, r, c, 2.5); ell(x, y - r * .4, r * .3, r * .15, '#fff', 0); }
  else if (item === 'llave') { ell(x - r * .4, y, r * .45, r * .45, c, 2.5); rr(x - r * .1, y - r * .14, r * 1.1, r * .28, 2, c, 2); }
  else if (item === 'malta' || item === 'guayoyo') { rr(x - r * .45, y - r, r * .9, r * 2, 5, c, 2.5); rr(x - r * .45, y - r * .3, r * .9, r * .5, 2, '#ffd23f', 0); }
  else if (item === 'medida' || item === 'senal') { rr(x - r * .8, y - r * .8, r * 1.6, r * 1.6, 5, c, 2.5); ell(x, y, r * .2, r * .2, INKC, 0); }
  else if (item === 'tequeno' || item === 'arepa') { ell(x, y, r, r * .6, c, 2.5); }
  else if (item === 'dato' || item === 'bono') estrellaP(x, y, r, c, 2);
  else { rr(x - r * .7, y - r * .9, r * 1.4, r * 1.8, 4, c, 2.5); line([[x - r * .4, y - r * .3], [x + r * .4, y - r * .3]], 2, INKC); }
}; }
function dado(x, y, sz, v, rot) {   // el bloque del dado con su número (v puede ser '?')
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
  rr(-sz / 2 + 3, -sz / 2 + 5, sz, sz, sz * .2, 'rgba(20,16,28,.4)', 0); rr(-sz / 2, -sz / 2, sz, sz, sz * .2, '#fffdf2', 4);
  rr(-sz / 2 + 6, -sz / 2 + 6, sz - 12, sz * .18, sz * .08, '#ffe9a8', 0);
  txt(String(v), 0, sz * .04, sz * .58, INKC, 0, true); ctx.restore();
}

/* ───────────── personajes en pantalla: dibujaPj / pose / placa / glifo viven en fiesta-personajes.js (F.PJ) ───────────── */
const dibujaPj = PJM.dibujaPj, pose = PJM.pose, placa = PJM.placa;

/* ───────────── partículas de pantalla (pool fijo, sin asignaciones por cuadro) ───────────── */
const FX_MAX = 160, FX_COLS = ['#ffd23f', '#ff5c8a', '#5cff7a', '#3fb0ff', '#ff8a3d', '#b49cff'];
function crearFx(opts) {
  opts = opts || {}; let sem = (opts.semilla || 12345) | 0;
  const rnd = () => { sem = (sem * 1103515245 + 12345) & 0x7fffffff; return sem / 0x7fffffff; };   // LCG: solo cosmético
  const pool = []; for (let i = 0; i < FX_MAX; i++) pool.push({ on: false, k: '', x: 0, y: 0, vx: 0, vy: 0, t: 0, dur: 1, g: 0, col: '#fff', sz: 8, hx: NaN, hy: NaN, rot: 0, vr: 0 });
  let vivas = 0;
  const P = {
    get vivas() { return vivas; },
    emitir(tipo, x, y, op) {
      op = op || {}; if (!(x === x && y === y)) return 0;
      const n = Math.min(24, Math.max(1, (op.n | 0) || fxCuenta(tipo === 'monedas' ? 'mon' : tipo === 'estrellas' ? 'est' : 'x', op.d || 3)));
      let hechas = 0;
      for (let i = 0; i < FX_MAX && hechas < n; i++) {
        const q = pool[i]; if (q.on) continue;
        const a = rnd() * Math.PI * 2, v = (op.vel || 160) * (.4 + rnd() * .8);
        q.on = true; q.k = tipo; q.x = x; q.y = y; q.t = 0; q.dur = (op.dur || 1) * (.75 + rnd() * .5); q.rot = rnd() * 6.28; q.vr = (rnd() - .5) * 10;
        q.hx = op.haciaX === undefined ? NaN : op.haciaX; q.hy = op.haciaY === undefined ? NaN : op.haciaY;
        q.col = op.col || (op.cols && tipo === 'confeti' ? op.cols[(rnd() * op.cols.length) | 0] : tipo === 'monedas' ? '#ffd23f' : tipo === 'estrellas' ? '#ffe14d' : tipo === 'polvo' ? '#e6dcc0' : tipo === 'brillo' ? '#ffffff' : FX_COLS[(rnd() * FX_COLS.length) | 0]);
        q.g = op.g === undefined ? (tipo === 'polvo' || tipo === 'brillo' ? 0 : tipo === 'confeti' ? 260 : 380) : op.g;
        q.sz = tipo === 'confeti' ? 6 + rnd() * 5 : tipo === 'polvo' ? 5 + rnd() * 5 : tipo === 'monedas' ? 9 : 8 + rnd() * 6;
        if (tipo === 'monedas') { q.vx = (rnd() - .5) * 120; q.vy = -v * 1.1; }
        else if (tipo === 'confeti') { q.vx = Math.cos(a) * v; q.vy = -Math.abs(Math.sin(a)) * v * 1.4; }
        else if (tipo === 'polvo') { q.vx = Math.cos(a) * v * .35; q.vy = -Math.abs(Math.sin(a)) * v * .25; }
        else { q.vx = Math.cos(a) * v; q.vy = Math.sin(a) * v; }
        hechas++; vivas++;
      }
      return hechas;
    },
    paso(dt) {
      dt = Math.min(.1, Math.max(0, numF(dt)));
      for (let i = 0; i < FX_MAX; i++) {
        const q = pool[i]; if (!q.on) continue;
        q.t += dt; if (q.t >= q.dur) { q.on = false; vivas--; continue; }
        if (q.hx === q.hx && q.t > q.dur * .3) {            // las monedas se curvan hacia la tarjeta y mueren al llegar
          const dx = q.hx - q.x, dy = q.hy - q.y; q.vx += (dx * 9 - q.vx) * Math.min(1, dt * 7); q.vy += (dy * 9 - q.vy) * Math.min(1, dt * 7);
          if (dx * dx + dy * dy < 150) { q.on = false; vivas--; continue; }
        } else q.vy += q.g * dt;
        q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
        if (q.k === 'brillo' || q.k === 'polvo') { q.vx *= 1 - dt * 2; q.vy *= 1 - dt * 2; }
      }
    },
    dibujar() {
      if (!lab() || !vivas) return;
      for (let i = 0; i < FX_MAX; i++) {
        const q = pool[i]; if (!q.on) continue;
        const k = q.t / q.dur, al = k > .7 ? (1 - k) / .3 : 1;
        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, al));
        if (q.k === 'monedas') moneda(q.x, q.y, q.sz * (.8 + .2 * Math.abs(Math.cos(q.rot))));
        else if (q.k === 'estrellas') estrellaP(q.x, q.y, q.sz * (1 - k * .4), q.col, 1.5);
        else if (q.k === 'confeti') { ctx.translate(q.x, q.y); ctx.rotate(q.rot); rr(-q.sz / 2, -q.sz / 3, q.sz, q.sz * .66, 1, q.col, 0); }
        else if (q.k === 'polvo') ell(q.x, q.y, q.sz * (.6 + k), q.sz * (.5 + k * .8), q.col, 0);
        else { const r = q.sz * (1 - k * .5); line([[q.x - r, q.y], [q.x + r, q.y]], 3, q.col); line([[q.x, q.y - r], [q.x, q.y + r]], 3, q.col); }
        ctx.restore();
      }
    },
    vacio() { return vivas === 0; },
    limpiar() { for (let i = 0; i < FX_MAX; i++) pool[i].on = false; vivas = 0; }
  };
  return P;
}

/* ───────────── controlador ───────────── */
function crear(opts) {
  opts = opts || {};
  const emit = opts.emit || function () {};
  const reloj = opts.reloj || (() => (root.performance ? root.performance.now() : Date.now()) / 1000);
  const B = registro();
  const U = { B, ptr: { x: -999, y: -999, abajo: false }, local: {}, espId: null, cartas: [], toasts: [], floats: [], emos: [], shake: {}, orden: {},
    bonus: [], dadoV: null, gira: 0, banner: null, emoAbierto: false, emoAt: -9, vm: null,
    fx: crearFx({ semilla: opts.semilla }), lider: null, reservados: [], pos: {}, anim: {}, cnt: {}, logAbierto: false, lastT: null, flash: null, flashAt: -9, tickSeg: -1, L: null, finT0: null, finSig: 0,
    sonido: opts.sonido || sonido };
  if (F.cam) F.cam.reserva = () => U.banda || null;                 // gancho de cámara: franja libre de pantalla (null = sin desvío)
  const snd0 = (n, o) => { try { U.sonido(n, o); } catch (e) { /* sin audio */ } };

  function lanzar(it) {
    if (!it) return;
    if (it.k === 'ui') {                                    // submenús locales: no salen del cliente
      if ('modo' in it) U.local = it.modo ? { modo: it.modo, slot: it.slot, item: it.item } : {};
      if ('sel' in it) { U.local.sel = it.sel; if (it.aim) emit({ k: 'aim', a: it.aim }); }
      return;
    }
    if (it.k === 'act' && it.a && it.a.t === 'TIRAR' || it.k === 'commit') U.gira = reloj();   // el dado gira ya (latencia del actor)
    if (it.k === 'act') U.local = {};
    emit(it);
  }
  U.tap = function (x, y) {
    let b = B.press(x, y);
    if (U.logAbierto && U.logR) {                           // log abierto: solo sus botones (y el del log) responden; dentro del panel se traga el toque, fuera lo cierra
      const id = b && (b.id || (b.b && b.b.id)) || '', suyo = id === 'log' || id === 'atras' || id === 'logx' || id.indexOf('log:') === 0;
      if (!suyo) { if (!B.dentro(U.logR, x, y)) U.logAbierto = false; return true; }
    }
    if (!b) { if (U.emoAbierto) { U.emoAbierto = false; return true; } return false; }
    if (b.off) return true;
    snd0(b.id === 'tirar' || b.id === 'orden' ? 'dado' : b.id === 'listo' ? 'listo' : b.id === 'nada' || b.id === 'no' || b.id === 'atras' ? 'no' : 'tap');
    if (b.fn) b.fn(); else lanzar(b.intent);
    return true;
  };
  U.mover = function (x, y, abajo) { U.ptr.x = x; U.ptr.y = y; if (abajo !== undefined) U.ptr.abajo = !!abajo; };
  U.tecla = function (code) {
    if (code === 'Escape' && U.logAbierto) { U.logAbierto = false; return true; }
    if (/^Digit[1-5]$/.test(code) && U.vm && U.vm.yo && !(U.vm.S && U.vm.S.esp && U.vm.S.esp.s === U.vm.yo && U.vm.S.esp.k === 'TIENDA') && !U.local.modo) {
      return U.reaccionar(REACT[+code.slice(5) - 1].id);
    }
    const b = B.tecla(code); if (!b) return false; if (b.fn) b.fn(); else lanzar(b.intent); return true;
  };
  U.reaccionar = function (id) {
    const t = reloj(); if (t - U.emoAt < REACT_GAP) return false;
    U.emoAt = t; if (U.vm && U.vm.yo) U.emote(U.vm.yo, id); emit({ k: 'react', id }); return true;
  };
  // toast: el color decide el icono (verde = ok, rojo = error, otro = aviso)
  U.toast = function (msg, col) {
    msg = String(msg); const t = reloj();
    for (let i = 0; i < U.toasts.length; i++) if (U.toasts[i].s === msg) { U.toasts[i].t0 = t; U.toasts[i].col = col || U.toasts[i].col; return; }   // el mismo aviso refresca su reloj, no se apila
    U.toasts.push({ s: msg, col: col || '#ff4d5e', t0: t }); if (U.toasts.length > 3) U.toasts.shift(); };
  U.error = function (r) { U.gira = 0; snd0('no'); U.toast(errorEs(r)); };
  function animar(s, a, dur) { U.anim[s] = { a, hasta: reloj() + dur }; }
  U.emote = function (s, id) {
    const e = REACT.filter((x) => x.id === id)[0]; if (!e) return;
    U.emos.push({ s, id, t0: reloj() }); if (U.emos.length > 12) U.emos.shift();
    animar(s, 'hablar', 1.4); snd0('emote');
  };
  U.saltar = function () { U.cartas = []; U.banner = null; U.floats = []; U.fx.limpiar(); };
  U.reset = function () { U.saltar(); U.local = {}; U.espId = null; U.orden = {}; U.bonus = []; U.dadoV = null; U.gira = 0; U.toasts = []; U.emos = []; U.anim = {}; U.cnt = {};
    U.logAbierto = false; U.logPag = 0; U.flash = null; U.finT0 = null; U.finSig = 0; U.tickSeg = -1; };
  // parpadeo suave de pantalla: alfa máximo .22 y nunca más de 2 por segundo
  U.screenFlash = function (col, dur) { const t = reloj(); if (t - U.flashAt < .5) return false; U.flashAt = t; U.flash = { col: col || '#ffffff', t0: t, dur: dur || .5 }; return true; };
  function carta(c) { c.t0 = null; c.dur = c.dur || 1.8; U.cartas.push(c); if (U.cartas.length > 5) U.cartas.shift(); }
  function flota(s, s2, col) { U.floats.push({ s, txt: s2, col, t0: reloj() }); if (U.floats.length > 16) U.floats.shift(); }
  // punto de pantalla de un asiento: sobre su ficha si main pasó ancla(), si no desde su tarjeta
  function origen(s) {
    const v = U.vm; if (v && typeof v.ancla === 'function') { try { const a = v.ancla(s); if (a && a.ve !== false && a.x === a.x) return { x: a.x, y: a.y }; } catch (e) { /* sin ancla */ } }
    const r = U.pos[s]; return r ? { x: r.x + r.w / 2, y: r.y + r.h + 56 } : null;   // sin ancla: suben desde debajo de la tarjeta
  }
  function sacudir(a, d) { const c = U.vm && U.vm.cam; if (c && typeof c.sacudir === 'function') c.sacudir(a, d); }
  U.efecto = function (f, S, quien) {
    if (!f || !f.k) return {};
    const t = reloj(), R = REG(), MS = (R && R.FX_MS) || {}, dur = (k) => (MS[k] || 1800) / 1000, n = (s) => nombreDe(S, s);
    const yo = quien !== undefined ? quien : U.vm ? U.vm.yo : null, chDe = (s) => (S && S.pj && S.pj[s] ? S.pj[s].ch : null);
    const Lb = U.L ? U.L.banner : { x: 400, y: 168 };
    switch (f.k) {
      case 'dado':
        if (f.de === 'orden') { U.orden[f.s] = f.v; snd0('dadoCae'); break; }
        U.dadoV = { s: f.s, v: f.v, dados: f.dados || [f.v], de: f.de, t0: t, quedan: f.v, cayo: false }; U.gira = 0; snd0('dado'); break;
      case 'hop': if (U.dadoV && U.dadoV.s === f.s && f.pasos) U.dadoV.quedan = Math.max(0, U.dadoV.quedan - f.pasos); snd0('hop'); break;
      case 'mon': {
        flota(f.s, (f.d > 0 ? '+' : '') + f.d, f.d > 0 ? '#5cff7a' : '#ff4d5e');
        const o = origen(f.s), r = U.pos[f.s];
        if (f.d > 0) { animar(f.s, 'celebrar', 1); snd0('moneda');
          if (o) U.fx.emitir('monedas', o.x, o.y, { n: fxCuenta('mon', f.d), haciaX: r ? r.mx : undefined, haciaY: r ? r.my : undefined, dur: .9, vel: 150 }); }
        else if (f.d < 0) { animar(f.s, 'perder', 1.2); snd0('perdida'); if (o) U.fx.emitir('brillo', o.x, o.y, { n: 4, col: '#ff4d5e', vel: 90, dur: .6 }); }
        break; }
      case 'est': flota(f.s, (f.d > 0 ? '+' : '') + f.d + '★', '#ffe14d');
        if (f.d > 0) { animar(f.s, 'celebrar', 1.4); const o = origen(f.s), r = U.pos[f.s];
          if (o && r) U.fx.emitir('estrellas', o.x, o.y, { n: fxCuenta('est'), haciaX: r.ex, haciaY: r.ey, dur: 1, vel: 190 });
          if (f.por !== 'bonus') { snd0('estrella'); sacudir(7, .45); U.screenFlash('#ffe14d', .5); } }
        if (f.d > 0 && f.por !== 'bonus') carta({ k: 'est', t: f.s === yo ? '¡TU ESTRELLA!' : '¡ESTRELLA PA\' ' + n(f.s) + '!', s: n(f.s) + ' ya tiene ' + f.tot, ch: chDe(f.s), dur: dur('est'), fxk: 'est' });
        break;
      case 'turno': U.dadoV = null; U.local = {};
        U.banner = { s: f.s, quien: fmt.nombre(n(f.s), 14), t: f.s === yo ? '¡TE TOCA, PANA!' : '¡LE TOCA A ' + fmt.nombre(n(f.s), 14) + '!', ch: chDe(f.s), frase: PJM.frase(chDe(f.s), 'hablar', S ? S.r | 0 : 0), t0: t, dur: dur('turno') + .6 };
        U.fx.emitir('brillo', Lb.x - 190, Lb.y, { n: 6, vel: 120, dur: .7 }); U.fx.emitir('brillo', Lb.x + 190, Lb.y, { n: 6, vel: 120, dur: .7 });
        snd0('voz', { ch: chDe(f.s), animo: 'hablar', vol: f.s === yo ? 1 : .6 });
        if (f.s === yo) { snd0('turno'); return { vibrar: 80 }; }
        break;
      case 'ronda': U.banner = { t: fmt.ronda(f.r, S ? S.tot : 0), r: f.r, tot: S ? S.tot : 0, t0: t, dur: dur('ronda') }; U.orden = {}; snd0('ronda');
        U.fx.emitir('brillo', Lb.x, Lb.y, { n: 8, vel: 140, dur: .8 }); break;
      case 'evento': carta({ k: 'evento', t: TXT_EVENTO[f.id] || '¡EVENTO!', s: (f.s ? n(f.s) + ': ' : '') + f.txt, dur: dur('evento') }); snd0('evento'); break;
      case 'ruleta': if (f.que !== 'color') { const r = textoRuleta(f, S); carta({ k: 'ruleta', t: r.t, s: r.s, dur: dur('ruleta') }); } break;
      case 'ataque': U.shake[f.a] = t; animar(f.a, 'perder', 1.2); snd0('ataque');
        carta({ k: 'ataque', t: '¡' + (ITEM[f.item] ? ITEM[f.item].n : f.item) + '!', s: n(f.s) + ' se la aplicó a ' + n(f.a), dur: dur('ataque') });
        if (f.a === yo) { U.emote(yo, 'wow'); sacudir(5, .35); return { vibrar: 200 }; }
        break;
      case 'estrellaMueve': U.toast((S && S.estrella && S.estrella.b && f.de ? 'La Abuela de ' + nodoNombre(f.de) + ' se mudó a ' : 'La Abuela se mudó a ') + nodoNombre(f.a), '#ffe14d'); break;
      case 'mjIni': carta({ k: 'mj', t: f.rel ? '¡RELÁMPAGO!' : '¡MINIJUEGO!', s: f.rel ? '5 minijuegos seguidos' : (TIPO[f.tipo] || ''), dur: dur('mjIni') }); break;
      case 'mjRes': if (!f.empate) { const g = (f.as || []).filter((s, i) => f.puestos[i] === 1).map(n); carta({ k: 'mj', t: '¡GANÓ ' + (g.join(' Y ') || '¿?') + '!', s: (f.pagos || []).some((x) => x) ? 'Monedas repartidas' : '', dur: dur('mjRes') });
          (f.as || []).forEach((s, i) => { if (f.puestos[i] === 1) animar(s, 'celebrar', 1.2); });
          snd0((f.as || []).some((s, i) => s === yo && f.puestos[i] === 1) ? 'ganar' : 'evento'); }
        else carta({ k: 'mj', t: 'EMPATE', s: 'Se fue la luz en todo el país', dur: dur('mjRes') }); break;
      case 'afk': U.toast(n(f.s) + ' se fue a la hamaca 💤', '#b49cff'); break;
      case 'vuelve': U.toast('¡VOLVIÓ ' + n(f.s) + '!', '#5cff7a'); break;
      case 'llega': U.toast('¡LLEGÓ ' + f.name + '!', '#5cff7a'); snd0('join'); break;
      case 'bonus': U.bonus.push({ s: f.s, id: f.id, v: f.v }); snd0('estrella');
        carta({ k: 'bonus', t: BONUS[f.id] || 'BONO', s: n(f.s) + ' ' + (BONUS_D[f.id] || '') + ' · +1★', ch: chDe(f.s), dur: dur('bonus'), fxk: 'est' }); break;
      case 'fin': snd0('fanfarria'); break;
    }
    return {};
  };

  /* ── piezas ── */
  function animoDe(s, p, turno, t) {                          // ánimo del retrato de la tarjeta (efímero, solo cosmético)
    if (p.cpu === 'afk') return { mood: 'sleep' };
    const a = U.anim[s]; if (a && t < a.hasta) return { animo: a.a };
    if (U.shake[s] && t - U.shake[s] < 1.2) return { mood: 'panic' };
    return turno ? { mood: 'grin' } : { animo: 'esperar' };
  }
  function tarjeta(S, s, r, vm, L, dt) {
    const p = S.pj[s], t = reloj(), turno = S.esp && (S.esp.s === s || (S.esp.k === 'COMMIT' && S.esp.quien && S.esp.quien.indexOf(s) >= 0 && !(S.esp.hecho || {})[s]));
    const sk = U.shake[s] && t - U.shake[s] < .6 ? Math.sin((t - U.shake[s]) * 60) * 6 * (1 - (t - U.shake[s]) / .6) : 0;
    const id = ident(p.ch), yo = s === vm.yo, c = L.compacto;
    const cn = U.cnt[s] || (U.cnt[s] = { mon: p.mon, est: p.est });         // contadores que ruedan hacia el valor real
    cn.mon = rueda(cn.mon, p.mon, dt); cn.est = rueda(cn.est, p.est, dt);
    ctx.save(); ctx.translate(sk, 0);
    if (turno) { const pu = 2.5 + Math.sin(t * 6) * 1.5; rr(r.x - pu, r.y - pu, r.w + 2 * pu, r.h + 2 * pu, 16, '#ffe14d', 0); }
    caja(r.x, r.y, r.w, r.h, yo ? '#2b2757' : '#1f1b33', 12, 4);
    rr(r.x + 4, r.y + 4, 8, r.h - 8, 4, id.col, 0);                         // barra de identidad
    const ph = r.h - 10, px = r.x + 16 + ph / 2;
    rr(px - ph / 2, r.y + 5, ph, ph, 10, id.col2, 2.5);
    const an = animoDe(s, p, turno, t), bump = an.animo === 'celebrar' ? 1 : 0;
    dibujaPj(p.ch, px, r.y + 5 + ph * .5, ph * .9, { animo: an.animo, mood: an.mood, t, clip: { x: px - ph / 2 + 2, y: r.y + 7, w: ph - 4, h: ph - 4 } });
    if (s === U.lider) corona(px - ph / 2 + 12, r.y + 8, 18);                // 1.º con corona chica en la esquina del retrato
    const tx = px + ph / 2 + 8, tw0 = r.x + r.w - tx - 8, fs = c ? 18 : 15, my0 = r.y + r.h * .52;
    TL(fmt.nombre(fmt.limpio(p.name || id.n), 12), tx, r.y + 15, fs, yo ? '#ffe14d' : '#ffffff', tw0);
    estrellaP(tx + 9, my0, (c ? 11 : 9) + bump * Math.abs(Math.sin(t * 8)) * 2); TL(String(Math.round(cn.est)), tx + 22, my0, fs + 2, '#ffe14d');
    const mx = tx + Math.min(tw0 * .5, 62); moneda(mx + 8, my0, c ? 9 : 8); TL(fmt.mon(Math.round(cn.mon)), mx + 20, my0, fs + 2, cn.mon < p.mon - .5 ? '#5cff7a' : cn.mon > p.mon + .5 ? '#ff7a85' : '#ffffff');
    const q0 = U.pos[s] || (U.pos[s] = {}); q0.x = r.x; q0.y = r.y; q0.w = r.w; q0.h = r.h; q0.mx = mx + 8; q0.my = my0; q0.ex = tx + 9; q0.ey = my0;
    const os = p.obj || [], sz = c ? 18 : 15;                // los 3 objetos (públicos, doc 07 D4)
    for (let i = 0; i < 3; i++) { const ox = tx + i * (sz + 5), oy = r.y + r.h - sz - 5; rr(ox, oy, sz, sz, 4, os[i] ? '#fffdf2' : 'rgba(255,255,255,.12)', 2); if (os[i]) icItem(os[i])(ox + sz / 2, oy + sz / 2, sz * .36); }
    // insignia de estado (CPU / zzz AFK / SIN SEÑAL) en el borde de abajo del retrato: no tapa los 3 objetos ni el nombre
    { const bx = px, by = r.y + 5 + ph - 7;
      if (p.cpu) { const lbl = p.cpu === 'afk' ? 'zzz' : 'CPU', bw = p.cpu === 'afk' ? 36 : 38; rr(bx - bw / 2, by - 8, bw, 16, 7, p.cpu === 'afk' ? '#b49cff' : '#c9c5d6', 2.5); T(lbl, bx, by, 11, INKC, bw - 4, true); }
      else if (vm.seats) { const q = vm.seats.filter((x) => x.id === s)[0]; if (q && !q.you && !q.online) { rr(bx - 27, by - 8, 54, 16, 7, '#ff8a3d', 2.5); T('SIN SEÑAL', bx, by, 9, INKC, 50, true); } } }
    if (U.orden[s] && S.f === 'orden') dado(r.x + r.w - 22, r.y + 22, 30, U.orden[s], .1);
    if (turno && S.esp && typeof S.esp.hasta === 'number' && vm.serverNow) {
      anillo(px - ph / 2 + 10, r.y + 14, 9, fraccion(S.esp, vm.serverNow, S), 4);   // mini anillo en la esquina del retrato
      if (!yo && S.esp.s === s) T(fmt.seg(restante(S.esp.hasta, vm.serverNow)), px - ph / 2 + 10, r.y + 14, 10, '#fff', 14, true);   // cuenta atrás del asiento ajeno
    }
    ctx.restore();
  }
  function flotantes(S, L, orden) {
    const t = reloj();
    U.floats = U.floats.filter((f) => t - f.t0 < 1.2);
    U.floats.forEach((f) => { const i = orden.indexOf(f.s); if (i < 0) return; const r = L.cards[i], k = (t - f.t0) / 1.2, pop = 1 + Math.max(0, .4 - k * 2);
      T(f.txt, r.x + r.w * .7, r.y + r.h + 14 - k * 18, 24 * pop, f.col); });
    U.emos = U.emos.filter((e) => t - e.t0 < 2);
    U.emos.forEach((e) => { const i = orden.indexOf(e.s); if (i < 0) return; const r = L.cards[i], k = (t - e.t0) / 2, R0 = REACT.filter((x) => x.id === e.id)[0];
      const y = r.y + r.h + 34 + k * 30, x = r.x + r.w / 2;
      if (typeof bubble === 'function') bubble(x, y, R0.ic + ' ' + R0.s, 16, x - 10, r.y + r.h + 4); else T(R0.ic + ' ' + R0.s, x, y, 18); });
  }
  function rondaYticker(S, L) {
    const rd = L.ronda;
    if (S.r) { caja(rd.x, rd.y, rd.w, rd.h, '#ff6b3d', 10, 3.5); T(fmt.ronda(S.r, S.tot), rd.x + rd.w / 2, rd.y + rd.h / 2 + 1, L.compacto ? 20 : 17, '#fff', rd.w - 12); }
    const lg = S.log || []; if (!lg.length) return;
    const tk = L.ticker, line0 = lg[lg.length - 1]; if (tk.w < 60) return;
    rr(tk.x, tk.y, tk.w, tk.h, 8, '#1f1b33', 0);
    TL('📜 ' + fmt.limpio(line0), tk.x + 8, tk.y + tk.h / 2 + 1, L.compacto ? 15 : 13, '#fff', tk.w - 16, true);
  }
  // pie del panel: atajos de teclado en una pastilla encima del panel (no registra botones ni toca el mapa); en móvil no hace falta
  const PISTA = { DADO: 'Espacio = tirar · 1-5 emotes', COMMIT: 'Espacio = tirar', LISTO: 'Espacio = listo', TIENDA: '1-9 = marcar · Enter = comprar · Esc = no', ESTRELLA: 'Enter = sí · Esc = no',
    RUTA: 'Toca una flecha del mapa', OBJETIVO: 'Elige a quién retar', AFK: 'Espacio = volver' };
  function pista(m, L, y, vm) {
    const s = PISTA[m.k]; if (!s || L.compacto || !vm.yo) return;
    const w = Math.min(L.panel.w, tw2(s, 13) + 30); rr(L.cx - w / 2, y - 26, w, 22, 11, '#1f1b33', 0); T(s, L.cx, y - 15, 13, '#ffffff', w - 16, true);   // opaco: con alfa, garabato/tinta lo pintan crema y el texto blanco no se lee
  }
  // cabecera común de TODOS los avisos: retrato de quien juega + título + temporizador (anillo con segundos); devuelve el rect del título
  function cabecera(S, vm, L, m, x, y, w, h, col) {
    const t = reloj(), mt = modeloTemporizador(S, vm), mio = !!(S.esp && S.esp.s === vm.yo) || m.k === 'LISTO' || m.k === 'COMMIT';
    const ch = S.pj[vm.yo] ? S.pj[vm.yo].ch : null, pr = h - 8;
    rr(x + 6, y + 4, pr, pr, pr / 2, ident(ch).col2, 3);
    dibujaPj(ch, x + 6 + pr / 2, y + 4 + pr / 2, pr * .95, { animo: mt.urgente && mio ? undefined : 'hablar', mood: mt.urgente && mio ? 'worry' : undefined, t, clip: { x: x + 7, y: y + 5, w: pr - 2, h: pr - 2 } });
    if (m.hasta && vm.serverNow) {
      const esp = S.esp && S.esp.hasta === m.hasta ? S.esp : { k: m.k === 'LISTO' ? 'COMMIT' : m.k, hasta: m.hasta };
      const k = m.k === 'LISTO' ? Math.max(0, Math.min(1, restante(m.hasta, vm.serverNow) / 19500)) : fraccion(esp, vm.serverNow, S);
      const seg = Math.ceil(restante(m.hasta, vm.serverNow) / 1000), urg = seg <= 5, pul = urg && mio ? 1 + Math.abs(Math.sin(t * 6)) * .18 : 1, rr0 = (h * .34) * pul;
      anillo(x + w - h * .5, y + h / 2, rr0, k, 4);
      T(String(seg), x + w - h * .5, y + h / 2 + 1, h * .36, urg ? '#ffe14d' : '#fff');
      return { tx: x + 6 + pr + 6, tw: w - (pr + 6 + 6) - h };
    }
    return { tx: x + 6 + pr + 6, tw: w - (pr + 6 + 6) - 10 };
  }
  // rectángulos de pantalla que el tablero debe esquivar (arreglo reusado: se rellena en cada cuadro, sin asignar salvo la primera vez)
  const RSV = []; let rsvN = 0;
  function rsv(x, y, w, h) { const r = RSV[rsvN] || (RSV[rsvN] = { x: 0, y: 0, w: 0, h: 0 }); rsvN++; r.x = x; r.y = y; r.w = w; r.h = h; }
  function panelAviso(S, vm, L) {
    const m = modeloAviso(S, vm.yo, U.local), P = L.panel, ptr = U.ptr, c = L.compacto, t = reloj();
    if (!m) return;
    if (m.k === 'ESPERA') {                                  // los que esperan: una tira chiquita, no tapan el mapa
      if (!m.titulo) return;
      const w = Math.min(P.w, 460), x = L.cx - w / 2, h = c ? 46 : 38, y = DH - h - 14, ch = m.s && S.pj[m.s] ? S.pj[m.s].ch : null;
      rsv(x, y - 22, w, h + 22);
      caja(x, y, w, h, '#1f1b33', 12, 3);
      if (ch) { const pr = h - 8; dibujaPj(ch, x + 6 + pr / 2, y + 4 + pr / 2, pr * .95, { animo: 'esperar', t, clip: { x: x + 6, y: y + 4, w: pr, h: pr } }); }
      T(m.titulo, L.cx + (m.hasta ? -12 : 0) + (ch ? 14 : 0), y + h / 2 + 1, c ? 18 : 15, '#fff', w - 90);
      if (m.s && vm.aim && vm.aim[m.s] && vm.aim[m.s].k === 'item') { const it = vm.aim[m.s].v; T('👉 ' + (ITEM[it] ? ITEM[it].n : it), L.cx, y - 14, 15, '#ffe14d', w); }
      if (m.hasta && vm.serverNow) anillo(x + w - 22, y + h / 2, 11, fraccion(S.esp, vm.serverNow, S), 4);
      return;
    }
    if (m.banner) {                                          // RUTA: se elige tocando el mapa; aquí solo el aviso y atajos
      const h = c ? 56 : 48, y = L.ronda.y + L.ronda.h + 8, tope = L.log.x - 8;              // el banner no pasa de mute / log
      let w = Math.min(P.w, 520); if (L.cx + w / 2 > tope) w = Math.max(200, Math.min(w, 2 * (tope - L.cx), tope - (L.izq + 8)));
      const x = Math.max(L.izq + 8, Math.min(L.cx - w / 2, tope - w));
      rsv(x, y, w, h); U.topeToast = y + h + 30;
      caja(x, y, w, h, '#ffe14d', 14, 4);
      const ch = S.pj[vm.yo] ? S.pj[vm.yo].ch : null, pr = h - 8, d0 = U.dadoV, qd = d0 && d0.s === vm.yo && d0.quedan > 0 ? d0.quedan : 0;
      dibujaPj(ch, x + 8 + pr / 2, y + 4 + pr / 2, pr * .95, { animo: 'hablar', t, clip: { x: x + 8, y: y + 4, w: pr, h: pr } });
      const tw1 = w - pr - 64, tcx = x + pr + 16 + tw1 / 2, sub = w < 300 ? (qd ? 'Quedan ' + qd : 'Toca una flecha') : (qd ? 'Quedan ' + qd + ' · ' : '') + m.sub.toLowerCase().replace(/^toca/, 'toca');   // banner angosto (vertical): subtítulo corto para que quepa junto al retrato y el anillo
      if (w < 470) { T(m.titulo, tcx, y + h * .32, c ? 20 : 17, INKC, tw1, true); T(sub.charAt(0).toUpperCase() + sub.slice(1), tcx, y + h * .72, c ? 15 : 13, '#4a3a00', tw1, true); }
      else T(m.titulo + ' · ' + sub.charAt(0).toUpperCase() + sub.slice(1), tcx, y + h / 2 + 1, c ? 20 : 17, INKC, tw1, true);
      if (vm.serverNow) anillo(x + w - 24, y + h / 2, 13, fraccion(S.esp, vm.serverNow, S), 4);
      const bs = m.botones, bw = Math.min(190, (P.w - 10 * (bs.length - 1)) / Math.max(1, bs.length)), bh = Math.max(c ? 52 : 44, L.tp), y0 = DH - bh - 14;
      pista(m, L, y0, vm); U.panelTop = y0 - 30;
      bs.forEach((b, i) => boton(B, Object.assign({}, b, { x: L.cx - (bs.length * bw + (bs.length - 1) * 10) / 2 + i * (bw + 10), y: y0, w: bw, h: bh, size: c ? 18 : 16, fill: '#ffffff' }), ptr));
      return;
    }
    let h = P.h;
    if (m.k === 'DADO' && !U.local.modo) { const ni = m.botones.length - 1, ih0 = Math.max(c ? 52 : 44, L.tp), cab = (c ? 48 : 40) + 8 + (m.sub ? 26 : 6);   // sin objetos el panel es bajito: el mapa y la ficha se ven
      h = Math.min(P.h, cab + Math.max(c ? 76 : 70, ni * ih0 + Math.max(0, ni - 1) * 8) + 12 + (m.sub ? 14 : 0)); }
    if (m.k === 'TIENDA') h = Math.min(DH - 150, 100 + Math.ceil((m.botones.length - 2) / 2) * (c ? 70 : 60) + (c ? 70 : 60));
    if (m.k === 'AFK' || m.k === 'COMMIT' || m.k === 'LISTO') h = c ? 190 : 160;
    const ah = Math.max(44, L.tp); if (U.local.modo) h += ah + 6;      // submenús (objetivo / a la medida): ATRÁS abajo a la izquierda, fuera del temporizador
    const y = DH - h - 10, hh = c ? 48 : 40;
    rsv(P.x, y, P.w, h); U.panelTop = y;
    caja(P.x, y, P.w, h, '#fffdf2', 18, 4.5);
    rr(P.x, y, P.w, hh, 18, '#ff6b3d', 4.5); rr(P.x + 4, y + hh - 16, P.w - 8, 16, 0, '#ff6b3d', 0);
    const cb = cabecera(S, vm, L, m, P.x, y, P.w, hh);
    T(m.titulo, cb.tx + cb.tw / 2, y + hh / 2 + 1, c ? 23 : 20, '#fff', cb.tw);
    pista(m, L, y, vm);
    const top = y + hh + 8, ins = P.x + 14, iw = P.w - 28;
    if (m.sub && m.k !== 'TIENDA') T(m.sub, P.x + P.w / 2, top + 10, c ? 17 : 14, INKC, iw, true);
    const bs = m.botones;
    if (m.k === 'DADO' && !U.local.modo) {                    // el botón grande del dado + la barra de objetos
      const big = bs[0], items = bs.slice(1), gw = items.length ? iw * .55 : iw, gh = h - (top - y) - (m.sub ? 36 : 16);
      const spin = U.gira && t - U.gira < 4;
      boton(B, Object.assign({}, big, { x: ins, y: top + (m.sub ? 26 : 6), w: gw, h: gh, fill: '#5cff7a', size: c ? 30 : 26, label: spin ? '¡AHÍ VA!' : big.label, off: !!spin,
        icon: (x, yy, r) => dado(x, yy, r * 2.2, spin || U.dadoV == null ? (Math.floor(t * 14) % 10) + 1 : '?', Math.sin(t * 6) * .2) }), ptr);
      const ih = Math.min(c ? 64 : 54, (gh - 8 * (items.length - 1)) / Math.max(1, items.length));
      items.forEach((b, i) => boton(B, Object.assign({}, b, { x: ins + gw + 12, y: top + (m.sub ? 26 : 6) + i * (ih + 8), w: iw - gw - 12, h: ih, icon: icItem(b.item), size: c ? 20 : 17 }), ptr));
      return;
    }
    if (m.k === 'TIENDA') {
      const its = bs.filter((b) => b.item), acc = bs.filter((b) => b.accion), rh = c ? 62 : 52, cols = 2, cw = (iw - 10) / cols;
      T(m.sub, P.x + P.w / 2, top + 8, c ? 16 : 13, INKC, iw, true);
      its.forEach((b, i) => { const bx = ins + (i % cols) * (cw + 10), by = top + 20 + Math.floor(i / cols) * (rh + 8);
        boton(B, Object.assign({}, b, { x: bx, y: by, w: cw, h: rh, icon: icItem(b.item), label: b.label + ' · ' + b.precio + '🪙', size: c ? 18 : 15, subSize: c ? 15 : 12 }), ptr); });
      const ah2 = Math.max(c ? 50 : 44, L.tp), ay = y + h - ah2 - 10, aw = (iw - 10) / 2;
      acc.forEach((b, i) => boton(B, Object.assign({}, b, { x: ins + i * (aw + 10), y: ay, w: aw, h: ah2, fill: i === 0 ? '#5cff7a' : '#ffffff', size: c ? 19 : 16, subSize: c ? 13 : 11 }), ptr));
      return;
    }
    if (m.k === 'ESTRELLA') { dibujaPj('abuela', ins + 50, top + 52, 80, { animo: 'hablar', t, clip: { x: ins, y: top + 4, w: 100, h: y + h - top - 14 } }); estrellaP(ins + 96, top + 30, 18 + Math.sin(t * 5) * 2); }
    // genéricos: COMMIT, LISTO, AFK, ESTRELLA, OBJETIVO, submenús del dado (objetivo / medida)
    const bx0 = m.k === 'ESTRELLA' ? ins + 130 : ins, bw0 = m.k === 'ESTRELLA' ? iw - 130 : iw, n = bs.length;
    const grande = bs.some((b) => b.grande) && n <= 2, by0 = top + (m.sub ? 28 : 8), bh = grande ? Math.min(Math.max(c ? 92 : 80, L.tg), y + h - by0 - 14) : Math.max(c ? 54 : 46, L.tp);
    if (m.k === 'DADO' && U.local.modo === 'medida') {      // 1-10 en dos filas + ATRÁS
      const nums = bs.filter((b) => b.id.indexOf('n:') === 0), cw = (bw0 - 9 * 6) / 5;
      nums.forEach((b, i) => boton(B, Object.assign({}, b, { x: bx0 + (i % 5) * (cw + 6), y: by0 + Math.floor(i / 5) * (bh + 8), w: cw, h: bh, size: c ? 26 : 22 }), ptr));
      bs.filter((b) => b.id === 'atras').forEach((b) => boton(B, Object.assign({}, b, { x: P.x + 14, y: y + h - ah - 8, w: 130, h: ah, size: 16 }), ptr));
      return;
    }
    const main = bs.filter((b) => !b.chico), ch = bs.filter((b) => b.chico), bw = (bw0 - 10 * (main.length - 1)) / Math.max(1, main.length);
    main.forEach((b, i) => boton(B, Object.assign({}, b, { x: bx0 + i * (bw + 10), y: by0, w: bw, h: bh, fill: b.grande ? '#5cff7a' : '#ffffff', size: grande ? (c ? 32 : 28) : (c ? 19 : 16),
      icon: b.s && S.pj[b.s] ? icRetrato(S.pj[b.s].ch) : null }), ptr));
    ch.forEach((b) => boton(B, Object.assign({}, b, { x: P.x + 14, y: y + h - ah - 8, w: 130, h: ah, size: 16 }), ptr));
  }
  // El dado de todos: rueda con rebote y sombra, cae con el valor y se queda GRANDE 1,3 s; luego se encoge a una pastilla fija arriba (bajo RONDA) con los pasos
  // que quedan, para no tapar la ficha que camina ni las flechas de ruta. Con mi propio aviso de RUTA, los pasos van dentro del banner.
  const BIG_T = 1.3;
  function chipDado(L) {                                    // rect de la pastilla (sin dibujar): bajo la ronda, centrada
    const h = L.compacto ? 50 : 44, w = 156; return { x: L.cx - w / 2, y: L.ronda.y + L.ronda.h + 8, w, h };
  }
  function dadoGrande(S, L) {
    const t = reloj(), d = U.dadoV, cx = L.cx, cy = 300;
    if (d && t - d.t0 < BIG_T) {
      const k = Math.min(1, (t - d.t0) / .9), bounce = k < 1 ? Math.abs(Math.sin(k * Math.PI * 2.5)) * (1 - k) * 40 : 0, n = d.dados.length;
      ell(cx, cy + 14, 46 - bounce * .5, 8, 'rgba(20,16,28,' + (.28 - bounce * .003) + ')', 0);      // sombra: se achica cuando el dado salta
      if (k < .45) dado(cx, cy - 40 - Math.abs(Math.sin(t * 14)) * 14, 92, (Math.floor(t * 18) % 10) + 1, Math.sin(t * 20) * .3);
      else {
        if (!d.cayo) { d.cayo = true; d.cayoT = t; snd0('dadoCae'); U.fx.emitir('polvo', cx, cy + 10, { n: 8, vel: 110, dur: .6 }); sacudir(3, .22);
          const pc = S && S.pj && S.pj[d.s] ? S.pj[d.s].ch : null; U.fx.emitir('confeti', cx, cy - 30, { n: 8, vel: 170, dur: .9, cols: paleta(pc) }); }
        if (d.cayoT !== undefined && t - d.cayoT < .3) { const q = (t - d.cayoT) / .3; ell(cx, cy - 40, 50 + q * 60, 50 + q * 60, 'rgba(255,255,255,' + (.5 * (1 - q)).toFixed(2) + ')', 0); }
        d.dados.forEach((v, i) => dado(cx + (i - (n - 1) / 2) * 100, cy - 40 - bounce, 92, v, (1 - k) * .4));
      }
      if (k >= 1 && n > 1) T('= ' + d.v, cx, cy + 34, 34, '#ffe14d');
      return;
    }
    if (d && d.quedan > 0 && t - d.t0 < 12 && !U.rutaMia) {   // pastilla: dado chico + QUEDAN n
      const q = chipDado(L); U.topeToast = Math.max(U.topeToast || 0, q.y + q.h + 30);
      caja(q.x, q.y, q.w, q.h, '#1f1b33', 12, 3.5);
      dado(q.x + q.h / 2 + 4, q.y + q.h / 2, q.h - 14, d.dados.length > 1 ? '=' + d.v : d.v, 0);
      T('QUEDAN', q.x + q.h + 4 + (q.w - q.h - 8) / 2, q.y + q.h * .32, 13, '#cfc8e8', q.w - q.h - 14, true); T(String(d.quedan), q.x + q.h + 4 + (q.w - q.h - 8) / 2, q.y + q.h * .7, q.h * .5, '#ffe14d', q.w - q.h - 14);
      return;
    }
    if (U.gira && t - U.gira < 4) { ell(cx, cy + 14, 46, 8, 'rgba(20,16,28,.2)', 0); dado(cx, cy - 40 - Math.abs(Math.sin(t * 14)) * 14, 92, (Math.floor(t * 18) % 10) + 1, Math.sin(t * 20) * .3); }
  }
  const easeBack = (k) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  function bannerYcartas(L, S) {
    const t = reloj(), b = U.banner, Bn = L.banner;
    if (b) { const k = (t - b.t0) / b.dur; if (k >= 1) U.banner = null; else {
      U.topeToast = Math.max(U.topeToast || 0, Bn.y + Bn.h / 2 + 30);
      const ent = Math.min(1, k / .18), sal = k > .85 ? (k - .85) / .15 : 0, sc = .4 + .6 * easeBack(ent), w = Bn.w, h = Bn.h;
      ctx.save(); ctx.translate(Bn.x, Bn.y - sal * 120); ctx.scale(sc, sc * (1 - sal * .3)); ctx.globalAlpha = 1 - sal;
      caja(-w / 2, -h / 2, w, h, '#ff6b3d', 18, 5); rr(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 12, 'rgba(20,16,28,.28)', 0);
      const yo = U.vm ? U.vm.yo : null;
      if (b.ch) {
        const pr = h - 14; rr(-w / 2 + 7, -h / 2 + 7, pr, pr, 14, ident(b.ch).col, 3);
        pose(b.ch, -w / 2 + 7 + pr / 2, -pr * .12, pr * .8, { animo: 'hablar', cuerpo: true, t, clip: { x: -w / 2 + 9, y: -h / 2 + 9, w: pr - 4, h: pr - 4 } });
        const tx = -w / 2 + pr + 20 + (w - pr - 30) / 2, tw0 = w - pr - 40, tit = b.s === yo ? '¡TE TOCA, PANA!' : '¡LE TOCA A ' + b.quien + '!';
        T(tit, tx, -8, L.compacto ? 34 : 30, '#ffe14d', tw0);
        T('«' + (b.frase || ident(b.ch).frase || '') + '»', tx, 20, 15, '#fffdf2', tw0, true);
      } else if (b.r) { T('RONDA', 0, -14, 20, '#fffdf2', w - 40, true); T(b.r + ' / ' + b.tot, 0, 12, L.compacto ? 44 : 40, '#ffe14d', w - 40); }
      else T(b.t, 0, 0, L.compacto ? 38 : 34, '#ffe14d', w - 40);
      ctx.restore(); } }
    if (!U.cartas.length || U.banner) return;                // la tarjeta espera a que pase el banner
    const c = U.cartas[0];
    if (c.t0 == null) { c.t0 = t; if (c.fxk === 'est') { const C0 = L.carta; U.fx.emitir('confeti', C0.x + C0.w / 2, C0.y + C0.h / 2, { n: 20, vel: 260, dur: 1.4 }); U.fx.emitir('estrellas', C0.x + C0.w / 2, C0.y + C0.h / 2, { n: 12, vel: 200, dur: 1 }); } }
    const k = (t - c.t0) / c.dur; if (k >= 1) { U.cartas.shift(); return; }
    const C = L.carta, pop = Math.min(1, k / .12), sc = .6 + .4 * pop;
    ctx.save(); ctx.translate(C.x + C.w / 2, C.y + C.h / 2); ctx.scale(sc, sc); ctx.rotate(-.02);
    const fill = c.k === 'ataque' ? '#ff4d5e' : c.k === 'est' || c.k === 'bonus' ? '#ffe14d' : c.k === 'mj' ? '#3fb0ff' : '#b49cff';
    caja(-C.w / 2, -C.h / 2, C.w, C.h, fill, 18, 5); rr(-C.w / 2 + 10, -C.h / 2 + 10, C.w - 20, C.h - 20, 12, '#fffdf2', 3);
    if (c.k === 'est' || c.k === 'bonus') estrellaP(-C.w / 2 + 50, 0, 30 + Math.sin(t * 6) * 3);
    if (c.ch) dibujaPj(c.ch, C.w / 2 - 60, 6, 80, { animo: 'celebrar', t, clip: { x: C.w / 2 - 110, y: -C.h / 2 + 14, w: 100, h: C.h - 28 } });
    T(c.t, 0, -C.h / 2 + 50, L.compacto ? 34 : 30, fill === '#ffe14d' ? '#ff6b3d' : fill, C.w - (c.ch ? 160 : 60));
    if (c.s) T(c.s, 0, 26, L.compacto ? 20 : 17, INKC, C.w - (c.ch ? 160 : 60), true);
    ctx.restore();
  }
  function emotes(vm, L) {
    if (!vm.yo) return;
    const ptr = U.ptr, e = L.emoteBtn;
    boton(B, { id: 'emo', x: e.x, y: e.y, w: e.w, h: e.h, label: U.emoAbierto ? '✕' : '😀', fill: '#ffe14d', size: 26, fn: () => { U.emoAbierto = !U.emoAbierto; } }, ptr);
    if (!U.emoAbierto) return;
    REACT.forEach((r, i) => { const q = L.emotes[i]; boton(B, { id: 'react:' + r.id, x: q.x, y: q.y, w: q.w, h: q.h, label: r.ic, size: 26, fn: () => { U.reaccionar(r.id); U.emoAbierto = false; } }, ptr); });
  }
  function red(vm, L) {
    const n = vm.net || {}, t = reloj();
    if (n.estado && n.estado !== 'ok') {
      const r = L.red, txt0 = n.estado === 'caido' ? 'SIN CONEXIÓN · reintentando…' : 'RECONECTANDO' + '...'.slice(0, 1 + Math.floor(t * 3) % 3);
      caja(r.x, r.y, r.w, r.h, '#ff8a3d', 10, 3.5); T('📡 ' + txt0, r.x + r.w / 2, r.y + r.h / 2 + 1, L.compacto ? 19 : 16, INKC, r.w - 16, true);
    }
    if (n.label) TR(n.label, L.der - 10, DH - (vm.yo ? 82 : 14), 11, '#ffffff');
    if (!vm.yo) { const w = 150; caja(L.izq + 10, DH - 46, w, 34, '#3fb0ff', 10, 3); T('👀 MIRANDO', L.izq + 10 + w / 2, DH - 28, 16, INKC, w - 10, true); }
  }
  function skip(vm, L) {
    if (!(vm.backlog > 1) && !U.cartas.length) return;
    const s = L.skip;
    boton(B, { id: 'skip', x: s.x, y: s.y - (vm.yo ? 0 : 50), w: s.w, h: s.h, label: L.skip.w < 140 ? '⏩ SALTAR' : '⏩ ADELANTAR', size: L.compacto ? 20 : 17, fill: '#ffffff',
      fn: () => { U.saltar(); emit({ k: 'skip' }); } }, U.ptr);
  }
  function silencioBtn(L, ptr, conLog) {                   // mute (siempre) y el log (solo en partida), arriba a la derecha, bajo las tarjetas
    const m = L.mute;
    boton(B, { id: 'mute', x: m.x, y: m.y, w: m.w, h: m.h, label: F.ui.silencio ? '🔇' : '🔊', size: 22, fill: F.ui.silencio ? '#c9c5d6' : '#ffffff', fn: () => { alternarSilencio(); snd0('tap'); } }, ptr);
    if (conLog) { const q = L.log; boton(B, { id: 'log', x: q.x, y: q.y, w: q.w, h: q.h, label: '📜', size: 22, fill: U.logAbierto ? '#ffe14d' : '#ffffff', fn: () => { U.logAbierto = !U.logAbierto; } }, ptr); }
  }
  // color de una línea del log: el del primer jugador cuyo nombre aparece en ella (o neutro)
  function colLinea(S, linea, def) {
    const u = String(linea).toUpperCase();
    for (const s in S.pj) { const p = S.pj[s], n = p && (p.name || (PJ[p.ch] || {}).n); if (n && u.indexOf(String(n).toUpperCase()) >= 0) return ident(p.ch).col; }
    return def;
  }
  const LOG_PAG = 5;
  function logPanel(S, L) {
    if (!U.logAbierto) return;
    const q = L.logPanel, all = S.log || [], np = Math.max(1, Math.ceil(all.length / LOG_PAG));
    U.logPag = Math.max(0, Math.min(np - 1, U.logPag | 0));                     // 0 = lo más reciente
    const fin = all.length - U.logPag * LOG_PAG, lg = all.slice(Math.max(0, fin - LOG_PAG), fin), bh = Math.max(44, L.tg);
    U.logR = q;                                                                  // U.tap: tocar dentro no pasa al prompt de abajo; tocar fuera cierra
    caja(q.x, q.y, q.w, q.h, '#1f1b33', 14, 3.5);
    { const cw = Math.max(52, L.tg + 6) + 8; T('📜 LO QUE HA PASADO', q.x + (q.w - cw) / 2, q.y + 24, 16, '#ffe14d', q.w - cw - 8); }
    if (!lg.length) T('Todavía no ha pasado nada…', q.x + q.w / 2, q.y + q.h / 2 - 20, 14, '#cfc8e8', q.w - 20, true);
    lg.forEach((s, i) => { const nuevo = U.logPag === 0 && i === lg.length - 1; TL(String(s), q.x + 12, q.y + 58 + i * 21, 13, colLinea(S, s, nuevo ? '#ffffff' : '#cfc8e8'), q.w - 24, true); });
    if (np > 1) { const bw = (q.w - 36) / 2, by = q.y + q.h - bh - 8;
      boton(B, { id: 'log:antes', x: q.x + 12, y: by, w: bw, h: bh, label: '▲ ANTES', size: 15, fill: '#ffffff', off: U.logPag >= np - 1, fn: () => { U.logPag++; } }, U.ptr);
      boton(B, { id: 'log:ahora', x: q.x + 24 + bw, y: by, w: bw, h: bh, label: '▼ AHORA', size: 15, fill: '#ffffff', off: U.logPag <= 0, fn: () => { U.logPag--; } }, U.ptr); }
    boton(B, { id: U.local.modo ? 'logx' : 'atras', x: q.x + q.w - Math.max(52, L.tg + 6), y: q.y + 2, w: Math.max(48, L.tg), h: Math.max(46, L.tg), label: '✕', size: 18, fill: '#ffffff', fn: () => { U.logAbierto = false; } }, U.ptr);
  }
  function toasts(L) {
    const t = reloj(); U.toasts = U.toasts.filter((x) => t - x.t0 < 2.6);
    const y0 = Math.max(150, U.topeToast || 0);   // debajo del banner de ruta / turno si están en pantalla
    U.toasts.forEach((x, i) => { const y = y0 + i * 46, k = Math.min(1, (t - x.t0) / .2), a = t - x.t0 > 2.2 ? 1 - (t - x.t0 - 2.2) / .4 : 1, e = easeBack(k);
      const ic = x.col === '#5cff7a' ? '✓' : x.col === '#ff4d5e' ? '✕' : '!';
      ctx.save(); ctx.globalAlpha = Math.max(0, a); const w = Math.min(540, tw2(x.s, 18) + 82), dy = (1 - e) * 24;
      caja(L.cx - w / 2, y - 18 - dy, w, 38, x.col, 12, 3.5);
      ell(L.cx - w / 2 + 20, y + 1 - dy, 11, 11, '#fffdf2', 2.5); T(ic, L.cx - w / 2 + 20, y + 2 - dy, 15, INKC, 0, true);
      T(x.s, L.cx + 14, y + 1 - dy, 18, INKC, w - 60, true); ctx.restore(); });
  }
  function flash() {
    const f = U.flash; if (!f) return; const t = reloj(), k = (t - f.t0) / f.dur; if (k >= 1 || k < 0) { U.flash = null; return; }
    ctx.save(); ctx.globalAlpha = .22 * Math.sin(Math.PI * k); rr(-400, -50, 2000, 800, 0, f.col, 0); ctx.restore();
  }
  // PODIO / FINAL: escalones que suben de último a primero, confeti continuo, bonus uno a uno (+1★ suma en vivo), tabla y SALIR
  function podio(S, vm, L, dt) {
    const M = modeloFinal(S, U.bonus), pod = M.podio, t = reloj(), P = layoutPodio(pod.length, { izq: L.izq, der: L.der, tg: L.tg, bonus: M.bonus.length });
    if (U.finT0 === null) { U.finT0 = t; U.finSig = 0; U.bsd = {}; U.fanDone = false; U.finSkip = false; }
    const dT = t - U.finT0, n = pod.length, ESC_T = .6, BON_T = .9, t1 = (n + .6) * ESC_T;           // t1 = cuando ya subió el 1.º
    const nb = Math.min(4, M.bonus.length), reveladas = skipFin() ? nb : Math.max(0, Math.min(nb, Math.floor((dT - t1) / BON_T) + (dT > t1 ? 1 : 0)));
    if (typeof wash === 'function') wash(L.izq, 0, L.der - L.izq, DH, '#2b2757', '#ff6b3d'); else rr(L.izq, 0, L.der - L.izq, DH, 0, '#2b2757', 0);
    for (let i = 0; i < 18; i++) { const x = L.izq + ((i * 97.3 + t * 40 * (1 + i % 3)) % (L.der - L.izq)), y = (i * 53.1 + t * 90 * (1 + i % 2)) % DH; rr(x, y, 8, 5, 1, ['#ffd23f', '#ff5c8a', '#5cff7a', '#3fb0ff'][i % 4], 0); }
    if (dT > t1 * .7 && t - U.finSig > .22) { U.finSig = t; U.fx.emitir('confeti', L.izq + (L.der - L.izq) * (.15 + ((t * 7) % 1) * .7), 40, { n: 3, vel: 70, dur: 2.2, g: 150, cols: pod[0] && pod[0].rank === 1 ? paleta(pod[0].ch) : undefined }); }
    const gan = pod.filter((x) => x.rank === 1).map((x) => fmt.nombre(x.name, 22));
    const tit = S.f === 'fin' || t % 4 < 3 ? '¡GANÓ ' + gan.join(' Y ') + '!' : '¡QUÉ FIESTA!';
    T(tit, L.cx, 54, L.compacto ? 46 : 42, '#ffe14d', L.der - L.izq - 40);
    const g0 = pod[0], ganCh = g0 ? g0.ch : null;
    if (ganCh && PJ[ganCh]) T('«' + PJ[ganCh].frases.celebrar + '»', L.cx, 92, 18, '#fff', 600);
    if (M.empate) { rr(L.cx + 150, 28, 96, 24, 10, '#ff4d5e', 3); T('EMPATE', L.cx + 198, 40, 15, '#fff', 84, true); }
    let sonoFan = false;
    P.slots.forEach((sl) => {
      const row = pod[sl.rank];                             // pod viene ordenado (rango); sl.rank = su índice
      if (!row) return;
      const k = Math.min(1, Math.max(0, (dT - (n - 1 - sl.rank) * ESC_T) / ESC_T)); if (k <= 0) return;        // el último sube primero
      if (sl.rank === 0 && k >= 1 && !U.fanDone) { U.fanDone = true; sonoFan = true; }
      const top = P.base - sl.h * easeBack(k), gana = row.rank === 1, cx = sl.x + sl.w / 2, ult = row.rank === pod[n - 1].rank && n > 1 && !gana;
      caja(sl.x, top, sl.w, P.base - top, gana ? '#ffd23f' : row.rank === 2 ? '#d8d8e0' : row.rank === 3 ? '#e09060' : '#7a7590', 8, 4);
      rr(sl.x + 5, top + 5, 8, Math.max(0, P.base - top - 10), 4, ident(row.ch).col, 0);                   // barra de identidad en el escalón
      T(fmt.puesto(row.rank), cx, top + 26, 30, INKC, sl.w - 10, true);
      const hc = P.hc, animo = gana ? 'celebrar' : ult ? 'perder' : 'esperar', hy = top - hc * 1.25;   // la cabeza queda sobre el escalón y se ve el pecho y los brazos
      pose(row.ch, cx, hy, hc, { animo, t: t + sl.rank * .3, cuerpo: true, clip: { x: sl.x - 40, y: 100, w: sl.w + 80, h: Math.max(0, top - 100) } });
      if (gana && k >= 1) corona(cx, hy - hc * .58 + Math.abs(Math.sin(t * 3)) * -3, hc * .34);
      placa(cx, P.base + 18, fmt.nombre(row.name, 12), row.ch, { w: Math.min(sl.w + 6, 150), cpu: row.cpu });
      const pend = pod[sl.rank] ? M.bonus.slice(0, nb).filter((b, i) => b.s === row.s && i >= reveladas).length : 0, estV = row.est - pend;      // el +1★ suma al revelar el bonus
      estrellaP(cx - 30, P.base + 46, 10); TL(String(estV), cx - 17, P.base + 46, 18, '#ffe14d');
      moneda(cx + 14, P.base + 46, 8); TL(String(Math.round(row.mon * k)), cx + 25, P.base + 46, 18, '#fff');   // las monedas cuentan al subir el escalón
    });
    if (sonoFan) snd0('fanfarria');
    if (nb) { const bw = Math.min(250, (L.der - L.izq - 40) / nb - 10);
      M.bonus.slice(0, nb).forEach((b, i) => { if (i >= reveladas) return; const k = skipFin() ? 1 : Math.min(1, (dT - t1 - i * BON_T) / .35);
        const x = L.cx + (i - (nb - 1) / 2) * (bw + 10) - bw / 2, y = P.base + 62 + (1 - easeBack(k)) * 40;
        if (k >= 1 && !U.bsd[i]) { U.bsd[i] = 1; snd0('estrella'); U.fx.emitir('estrellas', x + 20, P.base + 85, { n: 8, vel: 120, dur: .8 }); }
        caja(x, y, bw, 46, '#fffdf2', 10, 3); estrellaP(x + 20, y + 23, 11 + Math.sin(t * 6 + i) * 1.5); TL(BONUS[b.id] || b.id, x + 36, y + 14, 13, INKC, bw - 44, true);
        TL(nombreDe(S, b.s) + ' · +1★', x + 36, y + 33, 12, '#6a6578', bw - 44, true); }); }
    U.fx.paso(dt);
    if (!U.finSkip && dT < t1 + nb * BON_T) { const s0 = L.skip; boton(B, { id: 'skip', x: s0.x, y: s0.y, w: s0.w, h: s0.h, label: L.skip.w < 140 ? '⏩ SALTAR' : '⏩ ADELANTAR', size: L.compacto ? 20 : 17, fill: '#ffffff', fn: () => { U.finSkip = true; } }, U.ptr); }
    boton(B, { id: 'salir', x: L.cx - 130, y: P.by, w: 260, h: Math.max(46, L.tg), label: 'VOLVER AL MENÚ', size: 19, fill: '#5cff7a', intent: { k: 'leave' }, key: ['Enter', 'Escape'] }, U.ptr);
  }
  const skipFin = () => !!U.finSkip;

  // rectángulos que el tablero debe esquivar con sus etiquetas (dado, «QUEDAN n», banner) mientras estén en pantalla
  function rectDado(L) {                                   // el dado ocupa el centro mientras rueda / 1,3 s y luego su pastilla (o nada: los pasos van en el banner de ruta)
    const t = reloj(), d = U.dadoV;
    if (U.gira && t - U.gira < 4 || d && t - d.t0 < BIG_T) return { x: L.cx - 150, y: 196, w: 300, h: 150 };
    if (d && d.quedan > 0 && t - d.t0 < 12 && !U.rutaMia) return chipDado(L);
    return null;
  }
  U.reservado = function (vm) {
    const L = layout({ izq: vm && vm.izq, der: vm && vm.der, compacto: vm && vm.compacto, k: kDe(vm) }), r = [], d0 = rectDado(L);
    if (d0) r.push(d0);
    if (U.banner) r.push({ x: L.banner.x - L.banner.w / 2, y: L.banner.y - L.banner.h / 2, w: L.banner.w, h: L.banner.h });
    return r;
  };

  U.dibujar = function (vm) {
    vm = vm || {}; U.vm = vm; B.limpiar();
    if (!lab()) return;
    const S = vm.S; if (!S || !S.pj || S.f === 'lobby') return;
    const L = layout({ izq: vm.izq, der: vm.der, compacto: vm.compacto, k: kDe(vm) }); U.L = L;
    const t = reloj(), dt = U.lastT === null ? 0 : Math.min(.1, Math.max(0, t - U.lastT)); U.lastT = t;
    const e = S.esp; if ((e ? e.id : null) !== U.espId) { U.espId = e ? e.id : null; U.local = {}; U.tickSeg = -1; if (!(e && e.s === vm.yo && e.k === 'DADO')) U.gira = 0; }
    if (S.f === 'final' || S.f === 'fin') {
      podio(S, vm, L, dt); U.fx.dibujar(); silencioBtn(L, U.ptr, false); flash(); toasts(L); red(vm, L); return;
    }
    U.finT0 = null; U.fanDone = false; U.finSkip = false;
    const mt = modeloTemporizador(S, vm);                    // cuenta de los últimos 5 s: solo si el turno es mío (para otros solo el anillo)
    if (e && e.s === vm.yo && mt.urgente && mt.seg > 0 && mt.seg !== U.tickSeg) { U.tickSeg = mt.seg; snd0('cuenta'); }
    const orden = ordenAsientos(S);
    U.panelTop = null; U.topeToast = 0; { const mA = modeloAviso(S, vm.yo, U.local); U.rutaMia = !!(mA && mA.banner); }
    rsvN = 0; L.cards.forEach((r, i) => { if (orden[i]) rsv(r.x, r.y, r.w, r.h); });
    { const m0 = L.mute, g0 = L.log; rsv(m0.x, m0.y, m0.w, m0.h); rsv(g0.x, g0.y, g0.w, g0.h); const e0 = L.emoteBtn; if (vm.yo) rsv(e0.x, e0.y, e0.w, e0.h); }
    U.lider = null; { let be = -1, bm = -1, emp = false;       // quién va 1.º (est, luego mon); sin corona si hay empate o nadie tiene nada
      orden.forEach((s) => { const p = S.pj[s]; if (!p) return; if (p.est > be || (p.est === be && p.mon > bm)) { be = p.est; bm = p.mon; U.lider = s; emp = false; } else if (p.est === be && p.mon === bm) emp = true; });
      if (emp || be + bm <= 0) U.lider = null; }
    orden.forEach((s, i) => { if (L.cards[i] && S.pj[s]) tarjeta(S, s, L.cards[i], vm, L, dt); });
    rondaYticker(S, L);
    dadoGrande(S, L);
    flotantes(S, L, orden);
    if (vm.espVisible !== false) panelAviso(S, vm, L);
    bannerYcartas(L, S);
    skip(vm, L);
    emotes(vm, L);
    silencioBtn(L, U.ptr, true);
    logPanel(S, L);
    red(vm, L);
    U.fx.paso(dt); U.fx.dibujar();
    flash();
    toasts(L);
    { const d1 = rectDado(L); if (d1) rsv(d1.x, d1.y, d1.w, d1.h);
      if (U.banner) rsv(L.banner.x - L.banner.w / 2, L.banner.y - L.banner.h / 2, L.banner.w, L.banner.h); }
    RSV.length = rsvN; U.reservados = RSV;
    // el tablero esquiva estos rectángulos con sus rótulos y la cámara centra la ficha en la franja libre (entre el HUD y el panel abierto)
    F.ui.reservadosActual = RSV;
    if (U.panelTop !== null) { const y0 = L.ronda.y + L.ronda.h + (U.rutaMia ? 62 : 6); U.banda = { y0, y1: Math.max(y0 + 120, U.panelTop - 6) }; } else U.banda = null;
  };
  return U;
}

F.ui = { crear, registro, layout, layoutPodio, fmt, restante, fraccion, modeloAviso, textoEspera, textoRuleta, errorEs, nombreDe, nodoNombre, ordenAsientos,
  PJ, PJ_IDS, CHARS, cargarRoster: PJM.cargarRoster, glifo: PJM.glifo, frase: PJM.frase, ITEM, REACT, REACT_GAP, BONUS, BONUS_D, TIPO, TXT_EVENTO,
  ident, ANIMOS, animoMood, modeloTemporizador, modeloFinal, leyendaCasillas, fxCuenta, rueda, oscuro, crearSonido, sonido, SONIDOS, alternarSilencio, silencio: leerSilencio(),
  dibujaPj, pose, placa, fx: { crear: crearFx, MAX: FX_MAX },
  d: { T, TL, TR, txtL, estrellaP, moneda, anillo, retrato, icRetrato, caja, boton, dado, icItem, lookDe, lab, dibujaPj, pose, placa, sonido } };
F.UI = F.ui;
if (typeof module !== 'undefined') module.exports = F.ui;
})(typeof window !== 'undefined' ? window : globalThis);
