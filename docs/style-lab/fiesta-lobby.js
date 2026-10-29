// LA FIESTA · lobby (M1, doc 07 §8): menú (CREAR SALA / UNIRSE con código / seguir sala guardada), nombre de invitado,
// la SALA con 4 puestos, código + enlace /r/CODE, personajes únicos, configuración del anfitrión, ¡LISTO!, EMPEZAR, y la vista de
// espectador con «TOMAR A <CPU>» (D14). Modo inmediato con las primitivas del laboratorio (sirve en todos los estilos) y el
// registro de botones de fiesta-ui.js, que tiene que cargarse ANTES que este archivo.
//
// Intenciones (opts.emit(it)): {k:'create', name} | {k:'join', code, name} | {k:'resume'} | {k:'name', name} | {k:'pick', ch}
//   {k:'cfg', cfg:{tot|ronda|reglas|cpuNivel}} | {k:'ready', on} | {k:'start'} | {k:'leave'} | {k:'copy', text} | {k:'share', url, text}
//   {k:'takeover', seat, name} | {k:'mundo'} (volver al mundo Venezuela) | {k:'pegar'} (leer el portapapeles y llamar L.setCodigo)
//   {k:'react', id} (emote del panel de la sala; mismo transporte que el HUD) | {k:'kick', seat} y {k:'host', seat} (RESERVADAS: solo
//   existen botones si main pasa vm.puedeExpulsar / vm.puedeCeder; hoy ni la red ni el servidor las soportan)
// API (window.FIESTA.lobby / module.exports):
//   crear({emit, storage?, reloj?, origin?, rnd?, gamepads?}) -> L
//     L.dibujar(vm)  vm = {room?, S?(board), yo?, serverNow?, seats?(net.seats(): {id, rtt, online, you, cpu}), espectador?, cargando?, sesion?, izq?, der?, compacto?,
//                          t?, k? (px por unidad lógica; si falta se lee canvasScale()), net? ({estado:'ok'|'reconectando'|'caido'}: prende la pastilla de conexión),
//                          reacciones? ([{s, id, at}] emotes de otros), puedeExpulsar?, puedeCeder?}
//                    sin sala: menú / nombre / código · sala en lobby: la SALA · espectador en partida: tira de «TOMAR A …»
//     L.tap(x,y) -> bool · L.mover(x,y,abajo) · L.tecla(code, key) -> bool (letras, Backspace, Enter, Escape, flechas/Tab = foco, Start = empezar)
//     L.ir(pantalla) ('menu'|'nombre'|'codigo') · L.setCodigo(s) · L.toast(msg,col) · L.error(r) · L.pickFallo() · L.emote(id) · L.frase(animo) · L.nombre
//     El mando (navigator.getGamepads) se sondea dentro de L.dibujar: D-pad/stick = flechas, A = Enter, B = Esc, Start = empezar.
//   Puros: CODE_CHARS, limpiarCodigo, limpiarNombre, escribir(texto, tecla, op), invitado(storage, rnd), guardarNombre(storage, name),
//          sesion(storage, wallMs), link(code, origin), sala(room, S, yo, serverNow), libres(room, S, serverNow), CFG_OPC,
//          layoutSala(o) (todos los rectángulos de la sala, probados sin solapes), solapes(lista), presencia(prev, asientos, t), animoPuesto, animoPrevia,
//          bote(u), siguienteFoco(lista, id, dir), mandoTeclas(est, gps, t), pingNivel(rtt, online, cpu), netNivel(net), fichas(code), fraseDe(ch, animo)
(function (root) {
'use strict';
const F = root.FIESTA = root.FIESTA || {};
const NODE = typeof module !== 'undefined' && typeof require !== 'undefined';
const UI = F.ui || (NODE ? require('./fiesta-ui.js') : null);
if (!UI) throw new Error('fiesta-lobby: carga fiesta-ui.js antes');
const DW = 800, DH = 600, INKC = '#14101c';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // igual que pocketbase/pb_hooks/party.js (sin 0/O/1/I)
const NAME_CHARS = 'QWERTYUIOPASDFGHJKLZXCVBNM1234567890';
const GUEST_KEY = 'claudeware-guest', SESION_KEY = 'minicaos-fiesta-v1', SESION_MS = 6 * 3600 * 1000;
const FORCE_MS = 20000, TAKE_MS = 180000;                 // FIESTA_FORCE_MS / FIESTA_TAKE_MS del servidor
const COLORS = ['#D97757', '#6EA8FE', '#7BD88F', '#F28CB1', '#B49CFF', '#FFD23F', '#FF6B4D', '#4DD0E1'];
const SEATS = ['a', 'b', 'c', 'd'];
const CFG_OPC = [
  { k: 'tot', n: 'TURNOS', o: [[10, '10'], [15, '15'], [20, '20']] },
  { k: 'ronda', n: 'RONDA', o: [['clasica', 'CLÁSICA'], ['relampago', 'RELÁMPAGO']] },
  { k: 'reglas', n: 'REGLAS', o: [['caos', 'CAOS'], ['clasico', 'CLÁSICO']] },
  { k: 'cpuNivel', n: 'CPU', o: [[1, 'SUAVE'], [2, 'NORMAL'], [3, 'BRAVA']] }
];

/* ───────────── puros ───────────── */
const limpiarCodigo = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').split('').filter((c) => CODE_CHARS.indexOf(c) >= 0).join('').slice(0, 4);
// mismo filtro que cleanName del servidor ([\w -], 16), pero sin perder las tildes: Ñ→N, Á→A
function limpiarNombre(s) {
  let x = String(s == null ? '' : s); if (x.normalize) x = x.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return x.toUpperCase().replace(/[^A-Z0-9 _-]/g, '').replace(/\s+/g, ' ').replace(/^ /, '').slice(0, 16);
}
// del KeyboardEvent.code a un carácter (por si la main solo pasa el code)
const deCode = (code) => /^Key[A-Z]$/.test(code) ? code.slice(3) : /^(Digit|Numpad)[0-9]$/.test(code) ? code.slice(-1) : code === 'Space' ? ' ' : null;
// teclado: aplica una tecla al texto. op = {max, chars}
function escribir(texto, tecla, op) {
  op = op || {}; const max = op.max || 16, chars = op.chars || NAME_CHARS + ' ';
  texto = String(texto || '');
  if (tecla === 'Backspace' || tecla === '⌫') return texto.slice(0, -1);
  if (tecla === 'Clear') return '';
  if (typeof tecla !== 'string' || tecla.length !== 1) return texto;
  let c = tecla.toUpperCase(); c = c.normalize ? c.normalize('NFD').replace(/[̀-ͯ]/g, '') : c;
  if (chars.indexOf(c) < 0 || texto.length >= max) return texto;
  if (c === ' ' && (!texto.length || texto[texto.length - 1] === ' ')) return texto;
  return texto + c;
}
function leer(storage, k) { try { const v = storage && storage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function escribirS(storage, k, v) { try { if (storage) storage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
// el invitado de siempre (misma clave que js/party.js): {name, color}; si no hay, se crea uno («PANA 1234»)
function invitado(storage, rnd) {
  rnd = rnd || Math.random;                                 // cosmético: solo el nombre por defecto
  const g = leer(storage, GUEST_KEY);
  if (g && g.name) return { name: limpiarNombre(g.name) || 'PANA', color: g.color || COLORS[0] };
  const n = { name: 'PANA ' + (1000 + Math.floor(rnd() * 9000)), color: COLORS[Math.floor(rnd() * COLORS.length) % COLORS.length] };
  escribirS(storage, GUEST_KEY, n); return n;
}
function guardarNombre(storage, name) {
  name = limpiarNombre(name).trim(); if (!name) return null;
  const g = leer(storage, GUEST_KEY) || {}; g.name = name; if (!g.color) g.color = COLORS[0];
  escribirS(storage, GUEST_KEY, g); return g;
}
// la sala guardada por fiesta-net ({code, id, key, ts}) si tiene menos de 6 h
function sesion(storage, wallMs) {
  const s = leer(storage, SESION_KEY);
  if (!s || !s.code || !s.id || !s.key) return null;
  if (typeof wallMs === 'number' && !(wallMs - (s.ts || 0) < SESION_MS)) return null;
  return s;
}
const link = (code, origin) => String(origin || '').replace(/\/+$/, '') + '/r/' + limpiarCodigo(code);
// Lo que muestra la sala, como datos: puestos, quién eligió qué, si se puede empezar y por qué no.
function sala(room, S, yo, serverNow) {
  room = room || {}; S = S || room.board || {};
  const pj = S.pj || {}, players = room.players || [], host = room.host || null;
  const asientos = SEATS.map((s) => {
    const p = players.filter((x) => x.id === s)[0], q = pj[s];
    if (!p) return { id: s, vacio: true };
    return { id: s, name: p.name || (q && q.name) || s, color: p.color || COLORS[0], ch: q ? q.ch || null : null, listo: !!(q && q.listo),
      host: s === host, yo: s === yo, cpu: !!p.cpu || !!(q && q.cpu) };
  });
  const hum = asientos.filter((a) => !a.vacio && !a.cpu), tomados = {}, sinPj = hum.filter((a) => !a.ch).length;
  asientos.forEach((a) => { if (!a.vacio && a.ch) tomados[a.ch] = a.id; });
  const otros = hum.filter((a) => a.id !== host), todos = otros.every((a) => a.listo);
  const listoAt = S.listoAt || 0, forzarEn = listoAt && typeof serverNow === 'number' ? Math.max(0, listoAt + FORCE_MS - serverNow) : null;
  const puede = hum.length >= 2 && (todos || (listoAt > 0 && forzarEn === 0));
  let porque = null;
  if (hum.length < 2) porque = hum.length === 1 ? 'Falta 1 pana más (mínimo 2)' : 'Faltan panas';
  else if (!puede) porque = forzarEn ? 'Esperando que estén listos · forzar en ' + Math.ceil(forzarEn / 1000) + ' s'
    : sinPj ? 'Esperando · falta' + (sinPj > 1 ? 'n ' : ' ') + sinPj + ' por elegir personaje' : 'Esperando que todos estén listos';
  const me = asientos.filter((a) => a.id === yo)[0] || null;
  return { code: room.code || '', host, esHost: !!yo && yo === host, asientos, humanos: hum.length, listos: hum.filter((a) => a.listo).length, sinPj,
    todosListos: todos, puedeEmpezar: !!puede, porque, forzarEn, tomados, miCh: me ? me.ch : null, miListo: me ? me.listo : false,
    cfg: S.cfg || {}, cpus: 4 - hum.length };
}
// asientos que un espectador puede tomar (doc 07 §8.3): CPU 'auto', o 'afk' con más de 180 s fuera (extra.afkAt si viene)
function libres(room, S, serverNow) {
  room = room || {}; S = S || room.board || {};
  if (!S.pj || S.f === 'lobby' || S.f === 'fin' || S.f === 'final') return [];
  const afk = (room.extra && room.extra.afkAt) || {};
  return SEATS.filter((s) => S.pj[s]).map((s) => {
    const q = S.pj[s];
    if (q.cpu === 'auto') return { s, name: q.name, ch: q.ch, est: q.est | 0, mon: q.mon | 0, cpu: 'auto', ya: true, en: 0 };
    if (q.cpu === 'afk') { const t0 = afk[s], en = t0 && typeof serverNow === 'number' ? Math.max(0, t0 + TAKE_MS - serverNow) : null;
      return { s, name: q.name, ch: q.ch, est: q.est | 0, mon: q.mon | 0, cpu: 'afk', ya: en === 0, en }; }
    return null;
  }).filter(Boolean);
}


/* ───────────── puros nuevos (pulido): layout, presencia, ánimos, foco, mando, conexión ───────────── */
const interseca = (a, b) => a.x < b.x + b.w - .01 && b.x < a.x + a.w - .01 && a.y < b.y + b.h - .01 && b.y < a.y + a.h - .01;
// pares de rectángulos {id,x,y,w,h} que se pisan (los tests exigen [])
function solapes(lista) {
  const out = [];
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) if (interseca(lista[i], lista[j])) out.push([lista[i].id, lista[j].id]);
  return out;
}
// las 4 letras del código como fichas (siempre 4, con '' si falta)
const fichas = (code) => { const c = limpiarCodigo(code); return [0, 1, 2, 3].map((i) => c[i] || ''); };
// rebote de caída (0..1): u = tiempo/duración. 1 = arriba del todo, 0 = en su sitio; rebota una vez y termina exacto en 0
function bote(u) { u = +u; if (!(u > 0)) return u === 0 ? 1 : 0; if (u >= 1) return 0; return Math.abs(Math.cos(u * Math.PI * 1.5)) * (1 - u); }
// qué ven los puestos entre un cuadro y el siguiente: quién entró, quién salió, quién pasó a LISTO (estado local, sin red)
// prev = lo que devolvió la llamada anterior (o null en el primer cuadro: ahí nadie «entra»)
function presencia(prev, asientos, t) {
  const m = {}, entran = [], salen = [], listos = [];
  (asientos || []).forEach((a) => { m[a.id] = Object.assign({}, a); });
  if (prev && prev.m) (asientos || []).forEach((a) => {
    const p = prev.m[a.id]; if (!p) return;
    if (p.vacio && !a.vacio) entran.push(a.id);
    else if (!p.vacio && a.vacio) salen.push({ id: a.id, a: p });
    else if (!a.vacio && !p.listo && a.listo && !a.host) listos.push(a.id);
  });
  return { m, entran, salen, listos, t };
}
// ánimo de un puesto: perder si se cayó, celebrar 1.2 s al ponerse listo, hablar 1.6 s tras un emote o frase, si no esperar
function animoPuesto(a, e, t) {
  e = e || {}; a = a || {};
  if (!a.cpu && e.online === false) return 'perder';
  if (typeof e.celebraAt === 'number' && t - e.celebraAt >= 0 && t - e.celebraAt < 1.2) return 'celebrar';
  if (typeof e.hablaAt === 'number' && t - e.hablaAt >= 0 && t - e.hablaAt < 1.6) return 'hablar';
  return 'esperar';
}
// ánimo del personaje grande de la selección: rechazo (gris) > celebrar 1 s al confirmar > hablar mientras se confirma y 3 s después > esperar
function animoPrevia(o) {
  o = o || {}; const t = o.t || 0, dt = t - (o.pickAt === undefined ? -99 : o.pickAt), suyo = o.pickCh && o.pickCh === o.ch;
  if (o.ajeno) return { animo: 'perder', gris: true };
  if (suyo && o.pickOk === false && dt >= 0 && dt < 1.6) return { animo: 'perder', gris: true };
  if (suyo && o.pickOk === true && dt >= 0 && dt < 1) return { animo: 'celebrar', gris: false };
  if (suyo && o.pickOk === null && dt >= 0 && dt < 1.6) return { animo: 'hablar', gris: false };
  if (suyo && o.pickOk === true && dt >= 1 && dt < 3) return { animo: 'hablar', gris: false };
  return { animo: 'esperar', gris: false };
}
// conexión: por puesto (rtt en ms, online false = caído, cpu = lo lleva la CPU) y de toda la sala (estado de vm.net)
function pingNivel(rtt, online, cpu) {
  if (cpu) return { nivel: 'cpu', col: '#9a96a8', barras: 0 };
  if (online === false) return { nivel: 'caido', col: '#9a96a8', barras: 0 };
  rtt = +rtt || 0;
  if (rtt >= 300) return { nivel: 'lento', col: '#ff8a3d', barras: 1 };
  if (rtt >= 150) return { nivel: 'lento', col: '#ff8a3d', barras: 2 };
  return { nivel: 'ok', col: '#5cff7a', barras: 3 };
}
function netNivel(net) {
  if (!net) return null;
  const e = net.estado;
  if (e === 'caido') return { nivel: 'caido', col: '#ff4d5e', barras: 0, txt: 'SIN SEÑAL', corto: 'SIN SEÑAL', bloquea: true };
  if (e === 'reconectando') return { nivel: 'reconectando', col: '#ff8a3d', barras: 1, txt: 'RECONECTANDO', corto: 'LENTO', bloquea: true };
  const rtt = +net.rtt || 0;
  if (rtt >= 300) return { nivel: 'ok', col: '#ff8a3d', barras: 2, txt: 'EN LÍNEA', corto: 'LENTO', bloquea: false };
  return { nivel: 'ok', col: '#5cff7a', barras: 3, txt: 'EN LÍNEA', corto: 'BIEN', bloquea: false };
}
// letras del código como fichas que caben en un ancho dado: devuelve {w, gap, n, x0} (4 fichas centradas en [x, x+ancho])
function fichasAncho(ancho, max) {
  const gap = ancho >= 200 ? 6 : 4, w = Math.max(18, Math.min(max || 54, (ancho - 3 * gap) / 4));
  return { w, gap, n: 4, x0: (ancho - (4 * w + 3 * gap)) / 2 };
}
// orden de elección: asientos ocupados por humanos en orden de llegada (a,b,c,d); cada uno con su pick o null
function ordenElegir(asientos) {
  return (asientos || []).map((a, i) => ({ s: a.id, n: i + 1, vacio: !!a.vacio, ch: a.ch || null, eligiendo: !a.vacio && !a.cpu && !a.ch }));
}
// confirmación en dos toques (expulsar/ceder): primer toque arma 2 s, el segundo dentro de ese plazo ejecuta
function confirmar(est, id, t, ventana) {
  ventana = ventana || 2;
  if (est[id] !== undefined && t - est[id] >= 0 && t - est[id] <= ventana) { delete est[id]; return true; }
  est[id] = t; return false;
}
// frase corta del personaje según el ánimo (cae a la frase de siempre)
function fraseDe(ch, animo, idx) {
  if (typeof UI.frase === 'function' && UI.PJ && UI.PJ[ch]) { const f = UI.frase(ch, animo, idx | 0); if (f) return f; }
  const d = UI.PJ && UI.PJ[ch]; if (!d) return '';
  return (d.frases && d.frases[animo]) || d.frase || '';
}

// contador de listos de la sala («2/4 listos»): cuenta solo humanos; las CPU no hacen fila
const textoListos = (st) => st.listos + '/' + st.humanos + ' listos';
// qué texto va bajo el botón de acción: motivo de «empezar» bloqueado, contador de listos o mensaje de red (la red manda)
function mensajeAccion(st, nn) {
  if (nn && nn.bloquea) return nn.txt + '…';
  if (st.esHost) return st.puedeEmpezar ? (st.cpus ? 'La CPU completa ' + st.cpus + ' puesto' + (st.cpus > 1 ? 's' : '') + ' · ' + textoListos(st) : '¡Todos listos! · ' + textoListos(st)) : (st.porque || '') + (st.humanos >= 2 ? ' · ' + textoListos(st) : '');
  return st.humanos < 2 ? (st.porque || '') : (st.miListo ? textoListos(st) + ' · esperando al anfitrión' : 'El anfitrión arranca la fiesta · ' + textoListos(st));
}

// ids de personaje que muestra la selección: siempre los activos de F.PJ (nunca una lista fija); respaldo a los de fiesta-ui
const ordenPj = () => (F.PJ && F.PJ.PJ_IDS && F.PJ.PJ_IDS.length ? F.PJ.PJ_IDS : UI.PJ_IDS);

// Foco de teclado/mando: lista = registro de botones, id = foco actual, dir = 'izq'|'der'|'arr'|'aba'|'sig'|'ant'. Devuelve el id nuevo (o null).
function siguienteFoco(lista, id, dir) {
  const v = (lista || []).filter((b) => b && b.id && !b.off && b.w > 0 && b.h > 0);
  if (!v.length) return null;
  const i = v.findIndex((b) => b.id === id);
  if (i < 0) return v[0].id;
  if (dir === 'sig') return v[(i + 1) % v.length].id;
  if (dir === 'ant') return v[(i - 1 + v.length) % v.length].id;
  const a = v[i], ax = a.x + a.w / 2, ay = a.y + a.h / 2, h = dir === 'izq' || dir === 'der', sg = dir === 'izq' || dir === 'arr' ? -1 : 1;
  let mejor = null, ms = Infinity;
  v.forEach((b) => {
    if (b === a) return; const dx = b.x + b.w / 2 - ax, dy = b.y + b.h / 2 - ay, along = (h ? dx : dy) * sg, perp = Math.abs(h ? dy : dx);
    if (along <= 1) return;
    const s = along + perp * 2.2; if (s < ms) { ms = s; mejor = b; }
  });
  if (mejor) return mejor.id;
  // no hay nada en esa dirección: da la vuelta al lado contrario (el más alineado)
  let m2 = null, s2 = Infinity;
  v.forEach((b) => { if (b === a) return; const dx = b.x + b.w / 2 - ax, dy = b.y + b.h / 2 - ay, along = (h ? dx : dy) * sg, perp = Math.abs(h ? dy : dx);
    if (along < -1) { const s = perp * 3 - along; if (s < s2) { s2 = s; m2 = b; } } });
  return m2 ? m2.id : a.id;
}
// Mando → teclas. est = estado que guarda quien llama ({}), gps = navigator.getGamepads(), t = segundos.
// D-pad/stick = flechas (repite a los .4 s cada .12 s), A = Enter, B = Escape, Start = 'Start'.
function mandoTeclas(est, gps, t) {
  est.h = est.h || {}; est.u = est.u || {}; const out = []; let gp = null;
  if (gps) for (let i = 0; i < gps.length; i++) if (gps[i] && gps[i].connected !== false) { gp = gps[i]; break; }
  const ax = gp && gp.axes ? gp.axes : [], bt = gp && gp.buttons ? gp.buttons : [];
  const pr = (i) => !!(bt[i] && (bt[i].pressed || bt[i].value > .5));
  const on = { ArrowLeft: pr(14) || ax[0] < -.5, ArrowRight: pr(15) || ax[0] > .5, ArrowUp: pr(12) || ax[1] < -.5, ArrowDown: pr(13) || ax[1] > .5,
    Enter: pr(0), Escape: pr(1), Start: pr(9), BumpL: pr(4), BumpR: pr(5), Emote: pr(3) };
  Object.keys(on).forEach((k) => {
    if (!on[k]) { delete est.h[k]; return; }
    if (est.h[k] === undefined) { est.h[k] = t; est.u[k] = t; out.push(k); return; }
    if (k.indexOf('Arrow') === 0 && t - est.h[k] > .4 && t - est.u[k] > .12) { est.u[k] = t; out.push(k); }
  });
  return out;
}

// Todo el reparto de la sala como rectángulos (lo que se dibuja ES lo que se prueba: sin solapes en ningún tamaño).
// o = {izq, der, compacto, mt (alto mínimo táctil en unidades lógicas), tab, host, admin:[seat], kick, ceder, lemo (panel abierto), mute, red}
function layoutSala(o) {
  o = o || {};
  const izq = typeof o.izq === 'number' ? o.izq : 0, der = typeof o.der === 'number' ? o.der : DW, W = der - izq, cx = (izq + der) / 2;
  const comp = !!o.compacto, mt = Math.max(44, Math.ceil(o.mt || (comp ? 62 : 44))), pad = 8, g = 8;
  const tab = o.tab === 'pj' || o.tab === 'reglas' ? o.tab : 'panas', host = !!o.host;
  const admin = (o.kick || o.ceder) && Array.isArray(o.admin) ? o.admin : [];
  const R = { modo: comp ? 'tabs' : 'ancho', izq, der, W, cx, mt, tab, botones: [], cab: {}, tabs: null, puestos: [], pj: { cols: 4, rects: {}, area: null }, previa: null,
    config: [], acc: null, accMsg: null, lemo: null, panel: null, admin: {}, area: null };
  const add = (id, r) => { R.botones.push({ id, x: r.x, y: r.y, w: r.w, h: r.h }); return r; };
  const hh = Math.max(48, mt);
  /* cabecera: código en fichas + copiar + invitar + conexión + sonido + salir */
  let y = 8, cabB;
  if (W >= 700) {
    let x = izq + pad; const bw = comp ? 130 : 124;
    R.cab.codigo = add('codigo', { x, y, w: comp ? 200 : 214, h: hh }); x += R.cab.codigo.w + g;
    R.cab.copiar = add('copiar', { x, y, w: bw, h: hh }); x += bw + g;
    R.cab.compartir = add('compartir', { x, y, w: bw, h: hh }); x += bw + g;
    let rx = der - pad;
    R.cab.salir = add('salir', { x: rx - 100, y, w: 100, h: hh }); rx -= 100 + g;
    if (o.mute) { R.cab.mute = add('mute', { x: rx - hh, y, w: hh, h: hh }); rx -= hh + g; }
    if (o.red) { if (rx - 108 >= x + 40) { R.cab.red = { x: rx - 108, y: y + hh / 2 - 14, w: 108, h: 28 }; rx -= 108 + g; }          // sin sitio a la vista: la pastilla se vuelve el medidor chico de la esquina del código
      else R.cab.red = { x: R.cab.codigo.x + R.cab.codigo.w - 36, y: y + hh / 2 - 12, w: 30, h: 24, mini: true }; }
    R.cab.url = rx - x >= 110 ? { x, y, w: rx - x, h: hh } : null;
    cabB = y + hh;
  } else {
    let rx = der - pad;
    R.cab.salir = add('salir', { x: rx - 92, y, w: 92, h: hh }); rx -= 92 + g;
    if (o.mute) { R.cab.mute = add('mute', { x: rx - hh, y, w: hh, h: hh }); rx -= hh + g; }
    R.cab.codigo = add('codigo', { x: izq + pad, y, w: rx - (izq + pad), h: hh });
    if (o.red) R.cab.red = { x: R.cab.codigo.x + R.cab.codigo.w - 36, y: y + hh / 2 - 12, w: 30, h: 24, mini: true };
    const y2 = y + hh + 6, w2 = (W - 2 * pad - g) / 2;
    R.cab.copiar = add('copiar', { x: izq + pad, y: y2, w: w2, h: hh });
    R.cab.compartir = add('compartir', { x: izq + pad + w2 + g, y: y2, w: w2, h: hh });
    cabB = y2 + hh;
  }
  const idAcc = host ? 'empezar' : 'listo';
  const celdas = (a, cols, rows) => {
    const w = (a.w - g * (cols - 1)) / cols, h = (a.h - g * (rows - 1)) / rows;
    ordenPj().forEach((ch, i) => { R.pj.rects[ch] = add('pj:' + ch, { x: a.x + (i % cols) * (w + g), y: a.y + Math.floor(i / cols) * (h + g), w, h }); });
    R.pj.cols = cols; R.pj.area = a;
  };
  const gruposAncho = (a) => {                                   // 2×2 grupos: [TURNOS][RONDA] / [REGLAS][CPU]
    const gw2 = (a.w - g) / 2, lw = 56;
    ['tot', 'cpuNivel', 'ronda', 'reglas'].map((k) => CFG_OPC.filter((c) => c.k === k)[0]).forEach((c, i) => {   // arriba los de 3 opciones, abajo los de 2
      const gx = a.x + (i % 2) * (gw2 + g), gy = a.y + Math.floor(i / 2) * (mt + g), n = c.o.length, bw = (gw2 - lw - 4 * (n - 1)) / n;
      R.config.push({ k: c.k, n: c.n, lab: { x: gx, y: gy, w: lw, h: mt }, ops: c.o.map((v, j) => {
        const r = { x: gx + lw + j * (bw + 4), y: gy, w: bw, h: mt }, id = 'cfg:' + c.k + ':' + v[0]; if (host) add(id, r); return Object.assign({ v: v[0], n: v[1], id }, r); }) });
    });
  };
  const gruposFila = (a, rowH) => {                              // una fila por grupo (pestaña AJUSTES)
    const lw = Math.min(110, a.w * .26);
    CFG_OPC.forEach((c, i) => {
      const gy = a.y + i * (rowH + g), n = c.o.length, bw = (a.w - lw - g * n) / n;
      R.config.push({ k: c.k, n: c.n, lab: { x: a.x, y: gy, w: lw, h: rowH }, ops: c.o.map((v, j) => {
        const r = { x: a.x + lw + g + j * (bw + g), y: gy, w: bw, h: rowH }, id = 'cfg:' + c.k + ':' + v[0]; if (host) add(id, r); return Object.assign({ v: v[0], n: v[1], id }, r); }) });
    });
  };
  const adminDe = (r, id) => {                                   // expulsar / ceder: solo si los flags están prendidos
    if (admin.indexOf(id) < 0) return;
    const both = o.kick && o.ceder, w = both ? (r.w - 6 - 2 * g) / 2 : r.w - 12;
    let x = r.x + 6; const yy = r.y + r.h - mt - 4;
    if (o.kick) { R.admin['kick:' + id] = add('kick:' + id, { x, y: yy, w, h: mt }); x += w + g; }
    if (o.ceder) R.admin['ceder:' + id] = add('ceder:' + id, { x, y: yy, w, h: mt });
  };
  const panelDe = (a, lemo) => {                                 // panel desplegable de emotes y frases
    const mh = Math.max(40, Math.min(mt, Math.floor((a.h - 2 * pad - 2 * g) / 3)));       // si el área es baja, las filas se achican
    const pw = Math.min(a.w - 12, 460), ph = 3 * mh + 2 * g + 2 * pad, px = a.x + (a.w - pw) / 2;
    const py = lemo && comp === false ? Math.max(a.y + 4, lemo.y - g - ph) : Math.max(a.y, a.y + a.h - ph);
    const ew = (pw - 2 * pad - 4 * g) / 5, fw = (pw - 2 * pad - g) / 2, p = { x: px, y: py, w: pw, h: ph, emotes: [], frases: [] };
    UI.REACT.forEach((r, i) => { p.emotes.push(Object.assign({ id: r.id }, { x: px + pad + i * (ew + g), y: py + pad, w: ew, h: mh })); });
    ['esperar', 'hablar', 'celebrar', 'perder'].forEach((k, i) => { p.frases.push({ id: k, x: px + pad + (i % 2) * (fw + g), y: py + pad + mh + g + Math.floor(i / 2) * (mh + g), w: fw, h: mh }); });
    return p;
  };

  if (!comp) {
    /* ───── pantalla ancha: puestos arriba, selección al centro, reglas + acción abajo ───── */
    const span = Math.min(W - 2 * pad, 1100), x0 = cx - span / 2, top = cabB + 8, sw = (span - 3 * 6) / 4, sh = admin.length ? 100 + mt : 84;
    for (let i = 0; i < 4; i++) { const r = { x: x0 + i * (sw + 6), y: top, w: sw, h: sh }; R.puestos.push(r); }
    const seatIds = ['a', 'b', 'c', 'd']; R.puestos.forEach((r, i) => adminDe(r, seatIds[i]));
    const botH = 2 * mt + g, by = DH - 8 - botH, my = top + sh + 8, mh = by - 8 - my, gw = Math.round(span * .56);
    celdas({ x: x0, y: my, w: gw, h: mh }, 4, 2);
    R.previa = { x: x0 + gw + g, y: my, w: span - gw - g, h: mh };
    const cw = Math.round(span * .62);
    gruposAncho({ x: x0, y: by, w: cw, h: botH });
    R.acc = add(idAcc, { x: x0 + cw + g, y: by, w: span - cw - g, h: botH - 28 });
    R.accMsg = { x: R.acc.x, y: by + botH - 24, w: R.acc.w, h: 24 };
    R.lemo = add('lemo', { x: R.previa.x + R.previa.w - 70, y: R.previa.y + R.previa.h - mt - 6, w: 64, h: mt });
    R.area = { x: x0, y: my, w: span, h: mh };
    if (o.lemo) R.panel = panelDe(R.previa, R.lemo);
  } else {
    /* ───── vertical / chica: pestañas PUESTOS · PERSONAJE · AJUSTES, acción fija abajo ───── */
    const ty = cabB + 8, tw0 = (W - 2 * pad - 2 * g) / 3; R.tabs = [];
    [['panas', 'PUESTOS'], ['pj', 'PERSONAJE'], ['reglas', 'AJUSTES']].forEach((tb, i) => { R.tabs.push(Object.assign({ id: 'tab:' + tb[0], n: tb[1], k: tb[0] }, add('tab:' + tb[0], { x: izq + pad + i * (tw0 + g), y: ty, w: tw0, h: mt }))); });
    const accH = Math.max(mt, 64), accY = DH - 8 - accH, msgY = accY - 22;
    const a0 = { x: izq + pad, y: ty + mt + 8, w: W - 2 * pad, h: msgY - 6 - (ty + mt + 8) };
    R.area = a0;
    const lw = Math.max(mt, 64);
    R.lemo = add('lemo', { x: izq + pad, y: accY, w: lw, h: accH });
    R.acc = add(idAcc, { x: izq + pad + lw + g, y: accY, w: W - 2 * pad - lw - g, h: accH });
    R.accMsg = { x: izq + pad, y: msgY, w: W - 2 * pad, h: 20 };
    if (tab === 'panas') {
      const cuatro = W >= 1000, sw = cuatro ? (a0.w - 3 * g) / 4 : (a0.w - g) / 2, sh = cuatro ? Math.min(a0.h, 170) : (a0.h - g) / 2, seatIds = ['a', 'b', 'c', 'd'];
      for (let i = 0; i < 4; i++) { const r = cuatro ? { x: a0.x + i * (sw + g), y: a0.y, w: sw, h: sh } : { x: a0.x + (i % 2) * (sw + g), y: a0.y + Math.floor(i / 2) * (sh + g), w: sw, h: sh };
        R.puestos.push(r); adminDe(r, seatIds[i]); }
    } else if (tab === 'pj') {
      if (W >= 560) {
        // 4 columnas si cada tarjeta mide ≥ el alto táctil; si no (móvil con el lienzo 4:3 encogido) 2 columnas × 4 filas, más grandes
        const c4 = ((a0.w - g) * .5 - 3 * g) / 4 >= mt, gw = Math.round((a0.w - g) * (c4 ? .5 : .52));
        celdas({ x: a0.x, y: a0.y, w: gw, h: a0.h }, c4 ? 4 : 2, c4 ? 2 : 4);
        R.previa = { x: a0.x + gw + g, y: a0.y, w: a0.w - gw - g, h: a0.h };
      } else {
        // ancho de vertical (≈ 370): 4 columnas dejan ~80 px por tarjeta y el nombre se corta; 2 columnas × 4 filas si el nombre cabe y sobra sitio para la previa
        const ang = (a0.w - 3 * g) / 4 < 110, f2 = ang ? 4 : 2, cols = ang ? 2 : 4, gh = f2 * mt + (f2 - 1) * g, ph = a0.h - gh - g;
        if (ph >= 90) { R.previa = { x: a0.x, y: a0.y, w: a0.w, h: ph }; celdas({ x: a0.x, y: a0.y + ph + g, w: a0.w, h: gh }, cols, f2); }
        else celdas({ x: a0.x, y: a0.y, w: a0.w, h: Math.min(a0.h, 2 * mt + g) }, 4, 2);
      }
    } else {
      const cw = Math.min(a0.w, 640), rowH = Math.max(40, Math.min(mt + 6, Math.floor((a0.h - 3 * g) / 4)));
      gruposFila({ x: cx - cw / 2, y: a0.y, w: cw, h: a0.h }, rowH);
    }
    if (o.lemo) R.panel = panelDe(a0, null);
  }
  if (R.panel) {                                                 // lo que queda debajo del panel no se puede tocar: sale de la lista
    const p = R.panel;
    R.botones = R.botones.filter((b) => b.id === 'lemo' || !interseca(b, p));
    p.emotes.forEach((e) => { R.botones.push({ id: 'lemo:' + e.id, x: e.x, y: e.y, w: e.w, h: e.h }); });
    p.frases.forEach((e) => { R.botones.push({ id: 'lemo:f:' + e.id, x: e.x, y: e.y, w: e.w, h: e.h }); });
  }
  return R;
}

/* ───────────── dibujo ───────────── */
const D = UI.d;
const lab = () => D.lab();
const BUNT = ['#ff4d5e', '#ffd23f', '#3fb0ff', '#5cff7a', '#ff8a3d', '#b49cff'];
// con detección de capacidad: si fiesta-ui aún no trae la API de personajes, cae al retrato de siempre
const ident = (ch) => F.PJ && F.PJ.ident ? F.PJ.ident(ch) : UI.ident ? UI.ident(ch) : { id: ch || '', n: UI.PJ[ch] ? UI.PJ[ch].n : '¿?', col: UI.PJ[ch] ? UI.PJ[ch].col : '#9a96a8', col2: UI.PJ[ch] ? UI.PJ[ch].col : '#4a4558',
  frase: UI.PJ[ch] ? UI.PJ[ch].frase : '', rasgo: '' };
// colores de confeti del personaje (cacheado): su color de identidad + dorado y blanco
const PALC = {};
function paletaPj(ch) { return PALC[ch] || (PALC[ch] = (() => { const i = ident(ch); return [i.col, i.col2, '#ffe14d', '#fffdf2', i.col]; })()); }
const sonido = (n, op) => { try { if (UI.sonido) UI.sonido(n, op); } catch (e) { /* sin audio */ } };
function pjDibuja(ch, x, y, h, op) {
  if (F.PJ && F.PJ.dibujaPj) F.PJ.dibujaPj(ch, x, y, h, op);
  else if (UI.dibujaPj) UI.dibujaPj(ch, x, y, h, op);
  else D.retrato(ch, x, y, h, { mood: op.mood || (op.animo === 'celebrar' ? 'happy' : op.animo === 'perder' ? 'frown' : op.animo === 'hablar' ? 'smile' : null), talk: op.talk, flip: op.flip, gris: op.gris, clip: op.clip });
}
function pjPose(ch, x, y, h, op) { if (F.PJ && F.PJ.pose) F.PJ.pose(ch, x, y, h, op); else if (UI.pose) UI.pose(ch, x, y, h, op); else pjDibuja(ch, x, y, h, op); }
function ptsRR(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); const p = [], arc = (cx, cy, a0) => { for (let i = 0; i <= 3; i++) { const a = a0 + i * Math.PI / 6; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI); return p;
}
const marco = (x, y, w, h, col, wd, r) => line(ptsRR(x, y, w, h, r === undefined ? 14 : r), wd || 5, col, true);
function corona(x, y, s, col) { poly([[-1, .6], [-1, -.5], [-.5, 0], [0, -.8], [.5, 0], [1, -.5], [1, .6]].map((p) => [x + p[0] * s, y + p[1] * s]), col || '#ffd23f', 2); }
function candado(x, y, s) { line(arcPts(x, y - s * .2, s * .5, Math.PI, Math.PI * 2, 8), 3, '#ffffff'); rr(x - s * .7, y - s * .2, s * 1.4, s, 3, '#ffd23f', 2.5); }
function barras(x, y, n, col) { for (let i = 0; i < 3; i++) rr(x + i * 7, y + 12 - (5 + i * 4), 5, 5 + i * 4, 1.5, i < n ? col : '#4a4558', 0); }
function burbuja(x, y, s, col, w) {                              // globo de texto con colita abajo; (x,y) = punta de la colita
  const bw = Math.max(46, Math.min(w || 190, tw(s, 14) + 22)), bh = 28;
  poly([[x - 7, y - bh - 6], [x + 7, y - bh - 6], [x, y]], col || '#ffffff', 3);
  D.caja(x - bw / 2, y - bh - 14, bw, bh, col || '#ffffff', 10, 3);
  D.T(s, x, y - bh / 2 - 14, 14, INKC, bw - 12, true);
}
function fondo(L, t, a, b) {
  if (typeof wash === 'function') wash(L.izq, 0, L.der - L.izq, DH, a || '#2b2757', b || '#5a2a6e'); else rr(L.izq, 0, L.der - L.izq, DH, 0, a || '#2b2757', 0);
  for (let i = 0; i < 22; i++) { const x = L.izq + ((i * 131.7 + t * 18 * (1 + i % 3)) % (L.der - L.izq)), y = (i * 71.3 + t * 26 * (1 + i % 2)) % DH;
    rr(x, y, 7, 4, 1, ['#ffd23f', '#ff5c8a', '#5cff7a', '#3fb0ff'][i % 4], 0); }
}
// guirnalda de banderines que cuelga de lado a lado (y0 = donde se ata, dy = cuánto se combaba)
function guirnalda(Lt, t, y0, dy) {
  const W = Lt.der - Lt.izq, n = Math.max(8, Math.round(W / 64)), pts = [];
  for (let i = 0; i <= n; i++) pts.push([Lt.izq + W * i / n, y0 + Math.sin(i / n * Math.PI) * dy + Math.sin(t * 1.7 + i * .9) * 1.5]);
  line(pts, 3, '#e8dcc0');
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + 26 + Math.sin(t * 2.4 + i) * 2.5;
    poly([[a[0] + 3, a[1]], [b[0] - 3, b[1]], [mx, my]], BUNT[i % BUNT.length], 2.5); }
}
function farolito(x, y, t, col, s) {                              // farol de papel que se mece
  const sw = Math.sin(t * 1.4 + x * .05) * 3 * s;
  line([[x, y - 40 * s], [x + sw, y]], 2.5, '#e8dcc0');
  ell(x + sw, y + 24 * s, 34 * s, 38 * s, 'rgba(255,225,77,.18)', 0);
  rr(x + sw - 7 * s, y - 2 * s, 14 * s, 6 * s, 2, '#7a4a2a', 2);
  rr(x + sw - 17 * s, y + 3 * s, 34 * s, 40 * s, 15 * s, col, 3.5);
  rr(x + sw - 9 * s, y + 9 * s, 18 * s, 28 * s, 9 * s, 'rgba(255,255,255,.4)', 0);
  rr(x + sw - 7 * s, y + 42 * s, 14 * s, 6 * s, 2, '#7a4a2a', 2);
}
// título con cada letra rebotando en onda
function tituloOnda(s, cx, y, size, col, maxW, t) {
  let w = tw(s, size); if (maxW && w > maxW) { size = Math.max(10, size * maxW / w); w = tw(s, size); }
  let x = cx - w / 2;
  for (let i = 0; i < s.length; i++) { const cw = tw(s[i], size), k = Math.sin(t * 3.2 - i * .55); D.T(s[i], x + cw / 2, y - Math.max(0, k) * 7, size, k > .6 ? '#fff6b0' : col, 0); x += cw; }
}
const dentro = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/* ───────────── controlador ───────────── */
function crear(opts) {
  opts = opts || {};
  const emit = opts.emit || function () {};
  const reloj = opts.reloj || (() => (root.performance ? root.performance.now() : Date.now()) / 1000);
  const storage = opts.storage !== undefined ? opts.storage : (root.localStorage || null);
  const gamepads = opts.gamepads || (() => { try { return root.navigator && root.navigator.getGamepads ? root.navigator.getGamepads() : null; } catch (e) { return null; } });
  const B = UI.registro();
  const g = invitado(storage, opts.rnd);
  const L = { B, pantalla: 'menu', nombre: g.name, color: g.color, codigo: '', borrador: '', ptr: { x: -999, y: -999, abajo: false },
    toasts: [], pickAt: -9, pickOk: null, pickCh: null, tab: 'panas', vm: null, ver: null,
    t: null, tPrev: null, foco: null, focoOn: false, mando: {}, presPrev: null, llegada: {}, celebra: {}, habla: {}, burbujas: {}, ghosts: [], lemoAbierto: false,
    emoAt: -9, copiadoAt: -9, celebraAt: -9, tabAuto: false, nFrase: 0, salaAt: null, R: null, fx: null, conf: {}, hovPj: null, hostPrev: null, todosPrev: false, shakeAt: -9, ticAt: -9 };
  L.fx = UI.fx && UI.fx.crear ? UI.fx.crear({ semilla: 4321 }) : null;
  const origin = () => opts.origin || (root.location ? root.location.origin : '');
  const ahora = () => (L.t !== null ? L.t : reloj());
  const enSala = () => !!(L.vm && L.vm.room);
  const chispas = (tipo, x, y, op) => { if (L.fx) L.fx.emitir(tipo, x, y, op); };

  L.ir = function (p) { L.pantalla = p; L.foco = null; if (p === 'nombre') L.borrador = L.nombre; if (p === 'codigo') L.codigo = ''; };
  L.setCodigo = function (s) { L.codigo = limpiarCodigo(s); if (L.codigo.length === 4) unirse(); };
  L.toast = function (msg, col) { L.toasts.push({ s: String(msg), col: col || '#ff4d5e', t0: ahora() }); if (L.toasts.length > 3) L.toasts.shift(); };
  L.error = function (r) { L.toast(UI.errorEs(r)); sonido('no'); };
  L.pickFallo = function () {          // personaje tomado: temblor, toast y la frase «perder» del personaje que quería
    const t = ahora(), yo = L.vm && L.vm.yo; L.pickOk = false; L.pickAt = t; L.shakeAt = t; L.toast(UI.errorEs('Character taken')); sonido('rechazo');
    if (yo && L.pickCh) { L.burbujas[yo] = { s: fraseDe(L.pickCh, 'perder', L.nFrase++), t0: t }; L.habla[yo] = t; }
  };
  // emote del lobby: el transporte es el de siempre ({k:'react'}); el globo sale al instante sobre mi puesto (enfriamiento UI.REACT_GAP)
  L.emote = function (id) {
    const t = ahora(), e = UI.REACT.filter((r) => r.id === id)[0], yo = L.vm && L.vm.yo;
    if (!e || t - L.emoAt < (UI.REACT_GAP || .6)) return false;
    L.emoAt = t; if (yo) { L.burbujas[yo] = { s: e.s, t0: t }; L.habla[yo] = t; }
    emit({ k: 'react', id }); sonido('emote'); return true;
  };
  // frase rápida: SOLO local (globo sobre mi avatar, no viaja por la red)
  L.frase = function (animo) {
    const t = ahora(), yo = L.vm && L.vm.yo, st = L.vm && L.vm.room ? sala(L.vm.room, L.vm.S, yo, L.vm.serverNow) : null;
    if (!yo || !st || !st.miCh) return false;
    L.burbujas[yo] = { s: fraseDe(st.miCh, animo, L.nFrase++), t0: t }; L.habla[yo] = t; sonido('tap'); return true;
  };
  function unirse() { if (L.codigo.length !== 4) return; emit({ k: 'join', code: L.codigo, name: L.nombre }); }
  function guardar() {
    const n = limpiarNombre(L.borrador).trim(); if (!n) { L.toast('Ponte un nombre, pana'); return; }
    guardarNombre(storage, n); L.nombre = n; emit({ k: 'name', name: n }); L.pantalla = 'menu'; L.foco = null; sonido('ok');
  }
  function hacer(b) {
    if (!b || b.off) return;
    if (b.fn) { sonido('tap'); b.fn(); }
    else if (b.intent) {
      const k = b.intent.k, nn = L.vm && L.vm.room ? netNivel(L.vm.net) : null;
      if (nn && nn.bloquea && (k === 'pick' || k === 'ready' || k === 'start' || k === 'cfg')) { L.toast('Reconectando…', '#ff8a3d'); sonido('rechazo'); return; }
      if (k === 'pick') { L.pickCh = b.intent.ch; L.pickAt = ahora(); L.pickOk = null; sonido('tap'); }
      else if (k === 'copy') { L.copiadoAt = ahora(); sonido('ok'); }
      else if (k === 'share') sonido('ok');
      else if (k === 'start') sonido('empezar');
      else if (k === 'ready') sonido(b.intent.on ? 'listo' : 'tap');
      else sonido('tap');
      emit(b.intent);
    }
  }
  L.tap = function (x, y) { L.focoOn = false; const b = B.press(x, y); if (!b) return false; if (!b.off) hacer(b); return true; };
  L.mover = function (x, y, abajo) { if (x !== L.ptr.x || y !== L.ptr.y) L.focoOn = false; L.ptr.x = x; L.ptr.y = y; if (abajo !== undefined) L.ptr.abajo = !!abajo; };
  // foco con flechas/Tab (mando incluido): se mueve entre los botones del último cuadro; con el panel de emotes abierto solo entre los del panel
  function listaFoco() { const l = B.lista.filter((b) => !b.off && b.id); return L.lemoAbierto ? l.filter((b) => b.id.indexOf('lemo') === 0) : l; }
  function moverFoco(dir) {
    const l = listaFoco(); if (!l.length) return false;
    let id = L.foco; if (!l.some((b) => b.id === id)) { const libre = l.filter((b) => b.id.indexOf('pj:') === 0)[0], pref = enSala() ? (L.ver ? 'pj:' + L.ver : libre ? libre.id : 'pj:tu') : 'crear'; id = null; dir = null; L.foco = (l.filter((b) => b.id === pref)[0] || l[0]).id; }
    if (dir) L.foco = siguienteFoco(l, id, dir) || L.foco;
    L.focoOn = true; sonido('tap'); return true;
  }
  const FLECHAS = { ArrowLeft: 'izq', ArrowRight: 'der', ArrowUp: 'arr', ArrowDown: 'aba' };
  L.tecla = function (code, key) {
    if (typeof key !== 'string' || key.length !== 1) key = deCode(code);
    if (FLECHAS[code]) return moverFoco(FLECHAS[code]);
    if (code === 'Tab') return moverFoco('sig');
    if (code === 'ShiftTab') return moverFoco('ant');
    const foc = L.focoOn && L.foco ? B.porId(L.foco) : null;
    if (L.pantalla === 'nombre' && !enSala()) {
      if (code === 'Enter') { if (foc && !foc.off) hacer(foc); else guardar(); return true; } if (code === 'Escape') { L.pantalla = 'menu'; L.foco = null; return true; }
      L.borrador = escribir(L.borrador, code === 'Backspace' ? 'Backspace' : key, { max: 16 }); return true;
    }
    if (L.pantalla === 'codigo' && !enSala()) {
      if (code === 'Enter') { if (foc && !foc.off) hacer(foc); else unirse(); return true; } if (code === 'Escape') { L.pantalla = 'menu'; L.foco = null; return true; }
      L.codigo = escribir(L.codigo, code === 'Backspace' ? 'Backspace' : key, { max: 4, chars: CODE_CHARS }); if (L.codigo.length === 4 && code !== 'Backspace') unirse(); return true;
    }
    if (code === 'Escape' && L.lemoAbierto) { L.lemoAbierto = false; return true; }
    if (enSala()) {
      const dg = /^Digit([1-5])$/.exec(code);
      if (dg && UI.REACT[+dg[1] - 1]) return L.emote(UI.REACT[+dg[1] - 1].id) || true;
      if (code === 'KeyM' && UI.alternarSilencio) { UI.alternarSilencio(); return true; }
      if (code === 'BumpL' || code === 'BumpR') { const tabs = ['panas', 'pj', 'reglas'], i = tabs.indexOf(L.tab); L.tab = tabs[(i + (code === 'BumpR' ? 1 : 2)) % 3]; L.foco = null; sonido('tap'); return true; }
      if (code === 'Emote') { L.lemoAbierto = !L.lemoAbierto; L.foco = null; sonido('tap'); return true; }
    }
    if (code === 'Start') { const b = B.porId('empezar'); if (b && !b.off) { hacer(b); return true; } return false; }
    if ((code === 'Enter' || code === 'Space') && foc && !foc.off) { hacer(foc); return true; }
    const b = B.tecla(code); if (b) { hacer(b); return true; }
    return false;
  };
  function sondearMando(t) {
    let ks; try { ks = mandoTeclas(L.mando, gamepads(), t); } catch (e) { ks = []; }
    ks.forEach((k) => { L.tecla(k, k); });
  }

  /* ── pantallas ── */
  function mute(Lt, r) {
    if (!UI.alternarSilencio) return;
    D.boton(B, { id: 'mute', x: r.x, y: r.y, w: r.w, h: r.h, label: '', fill: '#ffffff', fn: () => { UI.alternarSilencio(); } }, L.ptr);
    const cx = r.x + r.w / 2 - 2, cy = r.y + r.h / 2 + 1, m = UI.silencio;
    rr(cx - 11, cy - 5, 8, 10, 2, INKC, 0); poly([[cx - 6, cy - 5], [cx + 3, cy - 12], [cx + 3, cy + 12], [cx - 6, cy + 5]], INKC, 0);
    if (m) { line([[cx + 8, cy - 7], [cx + 18, cy + 7]], 3, '#ff4d5e'); line([[cx + 18, cy - 7], [cx + 8, cy + 7]], 3, '#ff4d5e'); }
    else { line(arcPts(cx + 3, cy, 9, -.9, .9, 6), 3, INKC); line(arcPts(cx + 3, cy, 15, -.9, .9, 6), 3, INKC); }
  }
  function menuMundo(Lt, mt) { D.boton(B, { id: 'mundo', x: Lt.izq + 12, y: 12, w: 130, h: Math.max(40, mt), label: '← MUNDO', size: 16, intent: { k: 'mundo' }, key: 'Escape' }, L.ptr); }
  function titulo(Lt, t) {
    const y = 96 + Math.sin(t * 2) * 4, w = Lt.der - Lt.izq - 40;
    tituloOnda('¡LA FIESTA!', Lt.cx, y, Lt.compacto ? 78 : 70, '#ffe14d', w, t);
    D.T('Mario Party a la venezolana · de 2 a 4 panas', Lt.cx, y + 58, Lt.compacto ? 22 : 19, '#ffffff', Lt.der - Lt.izq - 60);
  }
  function bailarines(Lt, t, y) {
    const ids = ordenPj(), n = Lt.compacto ? 4 : 8, sp = Math.min(100, (Lt.der - Lt.izq - 40) / n);
    for (let i = 0; i < n; i++) { const ch = ids[(i * 3 + Math.floor(t / 4)) % ids.length], x = Lt.cx + (i - (n - 1) / 2) * sp, j = Math.abs(Math.sin(t * 4 + i)) * 10;
      pjDibuja(ch, x, y - j, sp * .85, { animo: (Math.floor(t * 1.5) + i) % 3 ? 'celebrar' : 'esperar', mood: (Math.floor(t * 1.5) + i) % 3 ? 'happy' : 'grin', flip: i % 2 === 1, t: t + i * .3 }); }
  }
  function menu(vm, Lt, t, mt) {
    fondo(Lt, t); guirnalda(Lt, t, 6, 22);
    if (Lt.der - Lt.izq > 900) { farolito(Lt.izq + 200, 40, t, '#ff4d5e', 1); farolito(Lt.der - 200, 40, t, '#ffd23f', 1); }
    titulo(Lt, t);
    const c = Lt.compacto, w = Math.min(c ? 560 : 440, Lt.der - Lt.izq - 40), x = Lt.cx - w / 2, h = Math.max(c ? 66 : 56, mt), g = 12, nh = Math.max(c ? 52 : 44, mt);
    let y = 196;
    D.caja(x, y, w, nh, 'rgba(255,255,255,.12)', 12, 0);
    D.boton(B, { id: 'nombre', x, y, w, h: nh, label: 'JUEGAS COMO: ' + L.nombre + '  ✎', size: c ? 20 : 17, fill: '#b49cff', fn: () => L.ir('nombre') }, L.ptr);
    y += nh + g + 6;
    D.boton(B, { id: 'crear', x, y, w, h, label: 'CREAR SALA', sub: 'tú eres el anfitrión', fill: '#5cff7a', size: c ? 30 : 26, intent: { k: 'create', name: L.nombre }, key: 'Enter' }, L.ptr); y += h + g;
    D.boton(B, { id: 'unirse', x, y, w, h, label: 'UNIRSE CON CÓDIGO', sub: '4 letras que te pasó tu pana', fill: '#3fb0ff', size: c ? 28 : 24, fn: () => L.ir('codigo'), key: 'KeyJ' }, L.ptr); y += h + g;
    const s = vm.sesion !== undefined ? vm.sesion : sesion(storage, Date.now());
    if (s) { D.boton(B, { id: 'seguir', x, y, w, h, label: 'SEGUIR EN LA SALA ' + s.code, sub: 'tu puesto te espera', fill: '#ffe14d', size: c ? 26 : 22, intent: { k: 'resume' } }, L.ptr); y += h + g; }
    menuMundo(Lt, mt);
    mute(Lt, { x: Lt.der - 12 - Math.max(44, mt), y: 12, w: Math.max(44, mt), h: Math.max(44, mt) });
    if (y < DH - 120) bailarines(Lt, t, DH - 40);
  }
  function teclado(Lt, chars, cols, y0, onKey, extra, mt) {
    const c = Lt.compacto, n = chars.length, ancho = Lt.der - Lt.izq; cols = Math.max(4, Math.min(cols, Math.floor((ancho - 24) / 50)));
    const rows = Math.ceil(n / cols), gap = 6, w = Math.min(c ? 76 : 62, (ancho - 24) / cols - gap);
    const h = Math.max(40, Math.min(Math.max(c ? 62 : 52, mt), Math.floor((DH - 10 - y0 - gap * (rows + 1)) / (rows + 1))));
    const x0 = Lt.cx - (cols * w + (cols - 1) * gap) / 2;
    for (let i = 0; i < n; i++) { const ch = chars[i], r = Math.floor(i / cols), k = i % cols;
      D.boton(B, { id: 'key:' + ch, x: x0 + k * (w + gap), y: y0 + r * (h + gap), w, h, label: ch === ' ' ? '␣' : ch, size: Math.min(c ? 28 : 24, h * .5), fn: () => onKey(ch) }, L.ptr); }
    const yb = y0 + rows * (h + gap) + 4, bw = (cols * w + (cols - 1) * gap - 2 * gap) / 3;
    (extra || []).forEach((b, i) => D.boton(B, Object.assign({ x: x0 + i * (bw + gap), y: yb, w: bw, h }, b), L.ptr));
  }
  function pantNombre(Lt, t, mt) {
    fondo(Lt, t, '#2b2757', '#1f4f6e'); guirnalda(Lt, t, 2, 12);
    D.T('¿CÓMO TE DICEN?', Lt.cx, 52, Lt.compacto ? 44 : 40, '#ffe14d', Lt.der - Lt.izq - 40);
    const w = Math.min(520, Lt.der - Lt.izq - 40);
    D.caja(Lt.cx - w / 2, 86, w, 60, '#fffdf2', 14, 4);
    D.T((L.borrador || '') + (Math.floor(t * 2) % 2 ? '|' : ' '), Lt.cx, 117, Lt.compacto ? 34 : 30, INKC, w - 20, true);
    teclado(Lt, NAME_CHARS + ' ', 10, 162, (ch) => { L.borrador = escribir(L.borrador, ch, { max: 16 }); sonido('tap'); }, [
      { id: 'borrar', label: '⌫ BORRAR', size: 18, fn: () => { L.borrador = escribir(L.borrador, 'Backspace'); }, key: 'Backspace' },
      { id: 'atras', label: 'ATRÁS', size: 18, fn: () => { L.pantalla = 'menu'; } },
      { id: 'ok', label: 'LISTO ✓', size: 20, fill: '#5cff7a', fn: guardar, off: !limpiarNombre(L.borrador).trim() }], mt);
  }
  function pantCodigo(Lt, t, mt) {
    fondo(Lt, t, '#2b2757', '#1f6e4f'); guirnalda(Lt, t, 2, 12);
    const oy = Lt.der - Lt.izq < 560 ? Math.max(40, mt) + 6 : 0;      // en vertical angosto el título baja: ATRÁS ocupa la esquina
    D.T('CÓDIGO DE LA SALA', Lt.cx, 50 + oy, Lt.compacto ? 42 : 38, '#ffe14d', Lt.der - Lt.izq - 40);
    const bw = Math.min(Lt.compacto ? 82 : 70, (Lt.der - Lt.izq - 60) / 4), g = 12, x0 = Lt.cx - (4 * bw + 3 * g) / 2, by = 82 + oy, bh = oy ? 64 : 78;
    for (let i = 0; i < 4; i++) { const ch = L.codigo[i] || '', act = i === L.codigo.length;
      D.caja(x0 + i * (bw + g), by, bw, bh, act ? '#ffe14d' : '#fffdf2', 14, 4); if (ch) D.T(ch, x0 + i * (bw + g) + bw / 2, by + bh / 2 + 2, 50, INKC, bw - 8, true);
      else if (act && Math.floor(t * 2) % 2) rr(x0 + i * (bw + g) + bw / 2 - 14, by + bh - 20, 28, 5, 2, INKC, 0); }
    teclado(Lt, CODE_CHARS, 8, by + bh + 16, (ch) => { L.codigo = escribir(L.codigo, ch, { max: 4, chars: CODE_CHARS }); sonido('tap'); if (L.codigo.length === 4) unirse(); }, [
      { id: 'borrar', label: '⌫ BORRAR', size: 18, fn: () => { L.codigo = L.codigo.slice(0, -1); }, key: 'Backspace' },
      { id: 'pegar', label: 'PEGAR', size: 18, intent: { k: 'pegar' } },
      { id: 'entrar', label: 'ENTRAR', size: 20, fill: '#5cff7a', fn: unirse, off: L.codigo.length !== 4 }], mt);
    D.boton(B, { id: 'atras', x: Lt.izq + 12, y: 12, w: 120, h: Math.max(40, mt), label: '← ATRÁS', size: 16, fn: () => { L.pantalla = 'menu'; }, key: 'Escape' }, L.ptr);
  }
  function cargando(Lt, t, msg) {
    fondo(Lt, t);
    for (let i = 0; i < 8; i++) { const a = t * 4 + i * Math.PI / 4; ell(Lt.cx + Math.cos(a) * 34, 260 + Math.sin(a) * 34, 7, 7, i === 0 ? '#ffe14d' : 'rgba(255,255,255,' + (.2 + i * .1) + ')', 0); }
    D.T(msg || 'Conectando…', Lt.cx, 340, 26, '#fff', Lt.der - Lt.izq - 40);
  }

  /* ── la sala ── */
  function nombreAsiento(s) { const r = L.vm && L.vm.room; const p = r && r.players ? r.players.filter((x) => x.id === s)[0] : null; return p ? p.name : s; }
  function puestoVacio(r, i, c, t, alpha) {
    ctx.save(); if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (ctx.setLineDash) ctx.setLineDash([8, 6]); rr(r.x, r.y, r.w, r.h, 14, '#2d2852', 2.5); if (ctx.setLineDash) ctx.setLineDash([]);
    ell(r.x + 14, r.y + 14, 11, 11, '#4a4558', 2.5); D.T(String(i + 1), r.x + 14, r.y + 15, 14, '#ffffff', 0, true);
    D.T('PUESTO LIBRE', r.x + r.w / 2, r.y + r.h / 2 - 8, c ? 18 : 15, '#ffffff', r.w - 16);
    D.T('si nadie llega, entra la CPU', r.x + r.w / 2, r.y + r.h / 2 + 14, c ? 13 : 11, '#cfc8e8', r.w - 16); ctx.restore();
  }
  function puesto(a, r, i, st, vm, t, c) {
    if (a.vacio) { puestoVacio(r, i, c, t); return; }
    const idc = a.ch ? ident(a.ch) : null, col = idc ? idc.col : a.color, q = vm.seats ? vm.seats.filter((x) => x.id === a.id)[0] : null;
    const online = q ? q.online !== false : true, anim = animoPuesto(a, { online, celebraAt: L.celebra[a.id], hablaAt: L.habla[a.id] }, t);
    const u = L.llegada[a.id] !== undefined ? (t - L.llegada[a.id]) / .5 : 2, dy = u < 1 ? -bote(u) * 90 : 0;
    ctx.save(); if (u < 1) ctx.globalAlpha = Math.max(0, Math.min(1, .35 + u * 3));
    const vert = r.w < 170 && r.h >= r.w * .75, admin = L.R && L.R.admin && L.R.admin['kick:' + a.id] || L.R && L.R.admin && L.R.admin['ceder:' + a.id];
    const rh = admin ? r.h - L.R.mt - 6 : r.h, y0 = r.y + dy;
    D.caja(r.x, y0, r.w, r.h, a.yo ? '#3a3577' : '#1f1b33', 14, 4);
    rr(r.x + 4, y0 + 4, r.w - 8, 8, 4, col, 0);
    if (a.yo) marco(r.x - 2, y0 - 2, r.w + 4, r.h + 4, '#ffe14d', 4, 16);
    const ps = vert ? Math.min(r.w - 24, rh * .46) : Math.min(rh - 22, r.w * .4), px = vert ? r.x + r.w / 2 : r.x + 10 + ps / 2, pyT = vert ? y0 + 18 : y0 + 16;
    rr(px - ps / 2, pyT, ps, ps, 10, idc ? idc.col2 : '#3a3550', 2.5);
    if (a.ch) pjDibuja(a.ch, px, pyT + ps * .5, ps * .9, { animo: anim, mood: anim === 'esperar' && a.listo ? 'happy' : undefined, t, gris: anim === 'perder' && !a.cpu, clip: { x: px - ps / 2 + 2, y: pyT + 2, w: ps - 4, h: ps - 4 } });
    else D.T('?', px, pyT + ps / 2, ps * .6, '#9a96a8');
    if (!online && !a.cpu) D.T('z' + 'z'.repeat(Math.floor(t * 1.5) % 3), px + ps / 2 - 10, pyT + 12, 14, '#cfc8e8', 40, true);
    // número del puesto = orden de elección
    rr(r.x + 3, y0 + 3, 28, 20, 10, '#ffe14d', 2.5); D.T((i + 1) + 'º', r.x + 17, y0 + 14, 12, INKC, 24, true);
    const tx = vert ? r.x + 8 : px + ps / 2 + 8, tw0 = vert ? r.w - 16 : r.x + r.w - tx - 20, tcx = vert ? r.x + r.w / 2 : tx;
    const ty = vert ? pyT + ps + 14 : y0 + 30, fs = c ? 18 : 15;
    if (vert) D.T(UI.fmt.nombre(a.name, 12), tcx, ty, fs, a.yo ? '#ffe14d' : '#ffffff', tw0); else D.TL(UI.fmt.nombre(a.name, 12), tx, ty, fs, a.yo ? '#ffe14d' : '#ffffff', tw0);
    const sub = a.ch ? idc.n : 'eligiendo' + '...'.slice(0, 1 + Math.floor(t * 3) % 3);
    if (vert) D.T(sub, tcx, ty + 18, c ? 14 : 12, '#cfc8e8', tw0); else D.TL(sub, tx, ty + 21, c ? 14 : 12, '#cfc8e8', tw0);
    // insignia de estado
    const bw = Math.min(tw0, 104), bx = vert ? r.x + (r.w - bw) / 2 : tx, by = vert ? ty + 28 : y0 + rh - 28, bcx = bx + bw / 2;
    if (by + 20 <= y0 + rh + 2) {
      if (a.host) { rr(bx, by, bw, 20, 8, '#ffe14d', 2); corona(bx + 12, by + 10, 6); D.T('ANFITRIÓN', bcx + 6, by + 11, 11, INKC, bw - 30, true); }
      else if (a.cpu) { rr(bx, by, bw, 20, 8, '#4a4558', 2); D.T('CPU', bcx, by + 11, 11, '#ffffff', bw - 10, true); }
      else if (!online) { rr(bx, by, bw, 20, 8, '#4a4558', 2); D.T('AUSENTE', bcx, by + 11, 11, '#ffffff', bw - 10, true); }
      else if (!a.ch) { const p = .5 + .5 * Math.sin(t * 6); rr(bx - p * 2, by - p, bw + p * 4, 20 + p * 2, 9, '#ff8a3d', 2.5); D.T('¡ELIGE!', bcx, by + 11, 12, INKC, bw - 8, true); }
      else if (a.listo) { rr(bx, by, bw, 20, 8, '#5cff7a', 2); D.T('✓ LISTO', bcx, by + 11, 12, INKC, bw - 8, true); }
      else { rr(bx, by, bw, 20, 8, '#4a4558', 2); D.T('ESPERANDO', bcx, by + 11, 11, '#ffffff', bw - 8, true); }
    }
    // conexión: puntito + ms
    if (L.vm && L.vm.seats) { const pn = pingNivel(q && !q.you ? q.rtt : 0, q ? q.online : true, a.cpu);
      ell(r.x + r.w - 12, y0 + 14, 5, 5, pn.col, 1.5);
      if (!vert && q && !q.you && q.rtt && r.w > 150) D.TR(q.rtt + ' MS', r.x + r.w - 22, y0 + 15, 10, pn.col); }
    ctx.restore();
    // globo de emote o frase rápida
    const bb = L.burbujas[a.id];
    if (bb && t - bb.t0 < 2.2) { const k = t - bb.t0; ctx.save(); ctx.globalAlpha = k > 1.8 ? (2.2 - k) / .4 : 1; burbuja(r.x + r.w / 2, r.y + 26 - Math.min(1, k * 4) * 0, bb.s, '#ffffff', r.w + 40); ctx.restore(); }
  }
  function puestos(st, R, vm, t, c) {
    const seatIds = SEATS;
    R.puestos.forEach((r, i) => {
      const a = st.asientos[i]; puesto(a, r, i, st, vm, t, c);
      L.ghosts.filter((gh) => gh.id === a.id && t - gh.t0 < .5).forEach((gh) => { ctx.save(); ctx.globalAlpha = 1 - (t - gh.t0) / .5; puesto(Object.assign({}, gh.a, { vacio: false }), Object.assign({}, r, { y: r.y - (t - gh.t0) * 40 }), i, st, vm, t, c); ctx.restore(); });
      const kb = R.admin['kick:' + seatIds[i]], cb = R.admin['ceder:' + seatIds[i]];
      const arm = (id) => L.conf[id] !== undefined && t - L.conf[id] <= 2;
      const dos = (id, intent) => () => { if (confirmar(L.conf, id, ahora())) { emit(intent); sonido('ok'); } };   // 2.º toque dentro de 2 s ejecuta
      if (kb) D.boton(B, { id: 'kick:' + seatIds[i], x: kb.x, y: kb.y, w: kb.w, h: kb.h, label: arm('kick:' + seatIds[i]) ? '¿SEGURO?' : 'SACAR', size: 15, fill: arm('kick:' + seatIds[i]) ? '#ff4d5e' : '#ff8aa5', fn: dos('kick:' + seatIds[i], { k: 'kick', seat: seatIds[i] }) }, L.ptr);
      if (cb) D.boton(B, { id: 'ceder:' + seatIds[i], x: cb.x, y: cb.y, w: cb.w, h: cb.h, label: arm('ceder:' + seatIds[i]) ? '¿SEGURO?' : cb.w < 120 ? 'CORONA' : 'DAR LA CORONA', size: 14, fill: arm('ceder:' + seatIds[i]) ? '#ffb347' : '#ffe14d', fn: dos('ceder:' + seatIds[i], { k: 'host', seat: seatIds[i] }) }, L.ptr);
    });
    L.ghosts = L.ghosts.filter((gh) => t - gh.t0 < .5);
  }
  function celda(ch, r, st, t, dueño, hv) {
    const mio = st.miCh === ch, ajeno = !!dueño && !mio, idc = ident(ch), foco = L.focoOn && L.foco === 'pj:' + ch;
    D.caja(r.x, r.y, r.w, r.h, mio ? '#ffe14d' : ajeno ? '#4a4558' : hv || foco ? '#fff3c4' : '#fffdf2', 12, mio ? 5 : 3.5);
    const mood = mio ? 'happy' : hv || foco ? 'grin' : undefined, nom = ajeno ? UI.fmt.nombre(nombreAsiento(dueño), 10) : idc.n;
    if (r.w > r.h * 1.5) {                                          // tarjeta ancha y baja (móvil vertical, 2 columnas): retrato a la izquierda, nombre a la derecha
      rr(r.x + 5, r.y + 5, 7, r.h - 10, 3, ajeno ? '#6a6578' : idc.col, 0);
      const ps = r.h - 12, px = r.x + 18 + ps / 2, py = r.y + r.h / 2;
      rr(px - ps / 2, py - ps / 2, ps, ps, 10, ajeno ? '#3a3550' : idc.col2, 2.5);
      pjDibuja(ch, px, py + 1, ps * .86, { animo: 'esperar', mood, t: t + ch.length, gris: ajeno, clip: { x: px - ps / 2 + 2, y: py - ps / 2 + 2, w: ps - 4, h: ps - 4 } });
      const tx = px + ps / 2 + 8, tw0 = r.x + r.w - tx - 8;
      D.TL(nom, tx + (ajeno ? 14 : 0), py, Math.min(18, r.h * .3), ajeno ? '#ffffff' : INKC, tw0 - (ajeno ? 14 : 0), true);
      if (ajeno) candado(tx + 5, py, 7);
      if (mio) { D.estrellaP(r.x + r.w - 14, r.y + 14, 10, '#ffffff', 2); D.estrellaP(r.x + r.w - 14, r.y + 14, 7, '#ff6b3d', 0); }
      return;
    }
    rr(r.x + 5, r.y + 5, r.w - 10, 7, 3, ajeno ? '#6a6578' : idc.col, 0);
    const ph = Math.min(r.w, r.h) * .66, ph2 = r.h - 34;
    pjDibuja(ch, r.x + r.w / 2, r.y + 14 + ph2 * .46, Math.min(ph, ph2 * .8), { animo: 'esperar', mood, t: t + ch.length, gris: ajeno,
      clip: { x: r.x + 4, y: r.y + 14, w: r.w - 8, h: r.h - 14 - 30 } });
    rr(r.x + 4, r.y + r.h - 28, r.w - 8, 24, 8, ajeno ? '#3a3550' : mio ? '#ff6b3d' : idc.col2, 0);
    D.T(nom, r.x + r.w / 2 + (ajeno ? 8 : 0), r.y + r.h - 16, 13, '#ffffff', r.w - (ajeno ? 36 : 14));
    if (ajeno) candado(r.x + 15, r.y + r.h - 18, 7);
    if (mio) { D.estrellaP(r.x + r.w - 16, r.y + 24, 11, '#ffffff', 2); D.estrellaP(r.x + r.w - 16, r.y + 24, 8, '#ff6b3d', 0); }
  }
  function rejilla(st, R, t) {
    ordenPj().forEach((ch) => {
      const r = R.pj.rects[ch], dueño = st.tomados[ch], mio = st.miCh === ch, hv = dentro(L.ptr, r);
      celda(ch, r, st, t, dueño, hv);
      B.add({ id: 'pj:' + ch, x: r.x, y: r.y, w: r.w, h: r.h, off: !!dueño && !mio, intent: mio ? null : { k: 'pick', ch } });
    });
  }
  // orden de elección: 1º 2º 3º 4º con el pick de cada puesto (o «eligiendo…» con puntitos); primero en llegar, primero en elegir
  function ordenChips(st, x, y, w, t) {
    const cw = (w - 3 * 4) / 4;
    ordenElegir(st.asientos).forEach((o, i) => {
      const cx = x + i * (cw + 4), ch = o.ch ? ident(o.ch) : null;
      rr(cx, y, cw, 20, 8, o.vacio ? '#2a2145' : '#2a2145', o.eligiendo ? 2.5 : 0); if (ch) rr(cx + 3, y + 4, 4, 12, 2, ch.col, 0);   // fondo oscuro y opaco: con alfa o col2 claro, tinta/garabato lo pintan crema y el blanco no se lee
      D.T((i + 1) + 'º ' + (o.vacio ? '—' : ch ? ch.n.replace(/^(El|La) /, '') : 'eligiendo' + '...'.slice(0, 1 + Math.floor(t * 3) % 3)), cx + cw / 2 + (ch ? 3 : 0), y + 11, 11, o.vacio ? '#9a96a8' : '#ffffff', cw - 12, true);
    });
  }
  // el personaje grande: foco/cursor > el que acabo de tocar > el mío > uno que rota solo
  function previa(st, r, t, R) {
    const foc = L.focoOn && L.foco && L.foco.indexOf('pj:') === 0 ? L.foco.slice(3) : null;
    let hov = null; ordenPj().forEach((ch) => { const q = R.pj.rects[ch]; if (q && L.ptr.x >= 0 && dentro(L.ptr, q)) hov = ch; });
    const hv = foc || hov; if (hv !== L.hovPj) { if (hv) sonido('hover'); L.hovPj = hv; }
    const reciente = L.pickCh && t - L.pickAt < 3.2 ? L.pickCh : null;
    const ch = foc || hov || reciente || st.miCh || ordenPj()[Math.floor(t / 3) % ordenPj().length];
    const idc = ident(ch), dueño = st.tomados[ch], ajeno = !!dueño && st.miCh !== ch;
    const am = animoPrevia({ ch, ajeno, pickCh: L.pickCh, pickAt: L.pickAt, pickOk: L.pickOk, t });
    if (am.animo === 'esperar' && Math.floor(t / 2.4) % 2 === 1) am.animo = 'hablar';        // ciclo esperar → hablar mientras lo miras
    const k = Math.min(1, r.h / 330), compactoP = r.h < 210, kk = Math.max(.8, k), cx = r.x + r.w / 2;
    // reparto vertical por capas: globo arriba, figura en el hueco, placa, rasgo y orden de elección abajo (nada se pisa)
    const conOrden = r.h >= 290 && r.w >= 220, rh = 40 * kk, rasgoY = r.y + r.h - rh - (conOrden ? 28 : 10);
    const pw = Math.min(r.w - 30, 220), py = compactoP ? r.y + r.h - 22 : rasgoY - 22;
    const figTop = r.y + (compactoP && r.h <= 150 ? 8 : 50), figBot = py - 18, hc = Math.max(30, Math.min(r.w * .5, (figBot - figTop) / 1.65));
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    D.caja(r.x, r.y, r.w, r.h, '#1f1b33', 16, 4);
    rr(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 12, am.gris ? '#5a5668' : idc.col2, 0);
    ell(cx, figTop + (figBot - figTop) * .45, r.w * .42, (figBot - figTop) * .5, am.gris ? '#7a7688' : idc.col, 0);            // foco de luz detrás
    for (let i = 0; i < 6; i++) { const a = t * .6 + i * 1.05; D.estrellaP(cx + Math.cos(a) * r.w * .36, r.y + r.h * .42 + Math.sin(a * 1.3) * r.h * .24, 4 + (i % 2) * 2, '#ffffff', 0); }
    ell(cx, figBot + 2, r.w * .26, r.h * .03, 'rgba(20,16,28,.35)', 0);
    // al celebrar rebota; el busto se asoma con squash al elegir
    const reb = am.animo === 'celebrar' ? Math.abs(Math.sin((t - L.pickAt) * 9)) * 10 * kk : 0;
    ctx.save(); ctx.beginPath(); ctx.rect(r.x + 6, r.y + 6, r.w - 12, py - r.y - 24); ctx.clip();
    pjPose(ch, cx, figTop + hc * .55 - reb, hc, { animo: am.animo, cuerpo: !compactoP, props: !compactoP, t, gris: am.gris, talk: undefined });
    ctx.restore();
    // globo con la frase (cambia con el ánimo y rota entre las variantes del personaje)
    const fr = fraseDe(ch, am.animo === 'esperar' ? 'hablar' : am.animo, Math.floor(t / 2.4)), fs = 15 * kk, bw = Math.min(r.w - 24, tw(fr, fs) + 28), bx = cx - bw / 2;
    if (!compactoP || r.h > 150) { D.caja(bx, r.y + 12, bw, 32 * kk, '#ffffff', 10, 3); D.T('«' + fr + '»', cx, r.y + 12 + 16 * kk, fs, INKC, bw - 16, true); }
    // placa con el nombre (del color del personaje) y su insignia
    rr(cx - pw / 2 + 2, py - 15 + 4, pw, 32, 16, 'rgba(20,16,28,.35)', 0);
    rr(cx - pw / 2, py - 15, pw, 32, 16, am.gris ? '#6a6578' : idc.col, 3.5);
    D.T(idc.n, cx, py + 1, 22, '#fffdf2', Math.min(r.w - 50, 200));
    if (UI.glifo && !compactoP) UI.glifo(ch, cx - pw / 2 - 12, py + 1, 10);
    // rasgo (sabor, sin mecánica) y estado
    if (!compactoP) {
      D.caja(r.x + 14, rasgoY, r.w - 28 - 70, rh, '#2a2145', 10, 0);   // oscuro y opaco: con alfa, tinta/garabato lo pintan crema y el texto blanco no se lee
      D.TL('RASGO (de mentiritas)', r.x + 22, rasgoY + 11, 10, '#ffe14d', r.w - 100, true);
      D.TL(idc.rasgo, r.x + 22, rasgoY + 27, 13, '#ffffff', r.w - 100, true);
    }
    if (st.miCh === ch) { const w = 92; rr(r.x + r.w - w - 12, r.y + 52, w, 24, 12, '#ffe14d', 3); D.T('ES TUYO', r.x + r.w - w / 2 - 12, r.y + 64, 13, INKC, w - 10, true); }
    else if (ajeno) { rr(r.x + r.w - 118, r.y + 52, 106, 24, 12, '#4a4558', 3); candado(r.x + r.w - 104, r.y + 66, 6); D.T(UI.fmt.nombre(nombreAsiento(dueño), 8), r.x + r.w - 54, r.y + 64, 12, '#ffffff', 70, true); }
    if (conOrden) ordenChips(st, r.x + 14, r.y + r.h - 22, r.w - 28 - 70, t);
    ctx.restore();
  }
  function config(st, R) {
    const c = L.vm && L.vm.compacto;
    R.config.forEach((gr) => {
      D.TL(gr.n, gr.lab.x + 2, gr.lab.y + gr.lab.h / 2, c ? 16 : 13, '#ffffff', gr.lab.w - 4);
      gr.ops.forEach((o) => {
        const sel = st.cfg[gr.k] === o.v;
        if (st.esHost) D.boton(B, { id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, label: o.n, size: c ? 17 : 14, sel, intent: sel ? null : { k: 'cfg', cfg: { [gr.k]: o.v } } }, L.ptr);
        else { rr(o.x, o.y, o.w, o.h, 10, sel ? '#ffe14d' : 'rgba(255,255,255,.1)', sel ? 3 : 0); D.T(o.n, o.x + o.w / 2, o.y + o.h / 2, c ? 16 : 13, sel ? INKC : '#9a96a8', o.w - 8, true); }
      });
    });
  }
  function acciones(st, R, t, vm) {
    const c = vm.compacto, r = R.acc;
    if (st.esHost) {
      const lista = st.puedeEmpezar, p = lista ? Math.sin(t * 5) * 2 : 0;
      D.boton(B, { id: 'empezar', x: r.x - p, y: r.y - p, w: r.w + p * 2, h: r.h + p * 2, label: '¡EMPEZAR!', size: c ? 34 : 30, fill: '#5cff7a', off: !st.puedeEmpezar, intent: { k: 'start' }, key: 'Enter' }, L.ptr);
    } else {
      D.boton(B, { id: 'listo', x: r.x, y: r.y, w: r.w, h: r.h, label: st.miListo ? '✓ ¡LISTO!' : '¿LISTO?', sub: st.miListo ? 'toca pa\' quitarlo' : (st.miCh ? 'toca cuando estés' : 'primero elige personaje'),
        size: c ? 32 : 28, fill: st.miListo ? '#5cff7a' : '#ffe14d', off: !st.miCh && !st.miListo, intent: { k: 'ready', on: !st.miListo }, key: 'Enter' }, L.ptr);
    }
    const nn = netNivel(vm.net), msg = mensajeAccion(st, nn);
    D.T(msg || '', R.accMsg.x + R.accMsg.w / 2, R.accMsg.y + R.accMsg.h / 2, c ? 16 : 14, nn && nn.bloquea ? nn.col : '#ffffff', R.accMsg.w);
  }
  function emotes(R, st, vm, t) {
    const abierto = !!R.panel;
    D.boton(B, { id: 'lemo', x: R.lemo.x, y: R.lemo.y, w: R.lemo.w, h: R.lemo.h, label: abierto ? '✕' : '💬', size: 22, fill: abierto ? '#ff8aa5' : '#ffffff', fn: () => { L.lemoAbierto = !L.lemoAbierto; } }, L.ptr);
    if (!R.panel) return;
    const p = R.panel, enf = t - L.emoAt < (UI.REACT_GAP || .6);
    D.caja(p.x, p.y, p.w, p.h, '#1f1b33', 14, 4);
    p.emotes.forEach((e) => { const r = UI.REACT.filter((x) => x.id === e.id)[0];
      D.boton(B, { id: 'lemo:' + e.id, x: e.x, y: e.y, w: e.w, h: e.h, label: r.ic, sub: r.s.replace(/[¡!]/g, '').slice(0, 8), size: 22, off: enf, fn: () => { L.emote(e.id); } }, L.ptr); });
    p.frases.forEach((f) => D.boton(B, { id: 'lemo:f:' + f.id, x: f.x, y: f.y, w: f.w, h: f.h, label: fraseDe(st.miCh, f.id) || '…', size: 14, fill: '#fff3c4', off: !st.miCh, fn: () => { L.frase(f.id); } }, L.ptr));
  }
  function cabecera(st, R, Lt, vm, t) {
    const c = vm.compacto, cb = R.cab, u = link(st.code, origin()), z = cb.codigo;
    D.caja(z.x, z.y, z.w, z.h, '#fffdf2', 12, 3.5);
    const cop = t - L.copiadoAt < 1.5;
    const lw = z.w >= 200 ? 44 : 0, fa = fichasAncho(z.w - lw - 12 - (cb.red && cb.red.mini ? 36 : 4), z.h);
    if (lw) D.TL('SALA', z.x + 8, z.y + z.h / 2, c ? 13 : 12, '#6a6578', lw - 6, true);
    fichas(st.code).forEach((ch, i) => { const fx = z.x + lw + 8 + fa.x0 + i * (fa.w + fa.gap), wob = cop ? 0 : Math.sin(t * 2 + i) * 1.5;
      rr(fx, z.y + 5 + wob, fa.w, z.h - 10, 8, cop ? '#2fbf5c' : COLORS[(i * 3) % COLORS.length], 2.5); D.T(ch || '·', fx + fa.w / 2, z.y + z.h / 2 + 1 + wob, Math.min(38, z.h * .66, fa.w * 1.1), '#fffdf2', fa.w - 4); });
    B.add({ id: 'codigo', x: z.x, y: z.y, w: z.w, h: z.h, intent: { k: 'copy', text: st.code } });
    D.boton(B, { id: 'copiar', x: cb.copiar.x, y: cb.copiar.y, w: cb.copiar.w, h: cb.copiar.h, label: cop ? '¡COPIADO!' : 'COPIAR LINK', size: c ? 16 : 14, fill: cop ? '#5cff7a' : '#ffffff', intent: { k: 'copy', text: u } }, L.ptr);
    D.boton(B, { id: 'compartir', x: cb.compartir.x, y: cb.compartir.y, w: cb.compartir.w, h: cb.compartir.h, label: 'INVITAR', size: c ? 16 : 14, fill: '#5cff7a', intent: { k: 'share', url: u, text: '¡Vente pa\' LA FIESTA! Sala ' + st.code } }, L.ptr);
    if (cb.mute) mute(Lt, cb.mute);
    D.boton(B, { id: 'salir', x: cb.salir.x, y: cb.salir.y, w: cb.salir.w, h: cb.salir.h, label: 'SALIR', size: c ? 17 : 15, fill: '#ff8aa5', intent: { k: 'leave' }, key: 'Escape' }, L.ptr);
    if (cb.url) D.TL(u.replace(/^https?:\/\//, ''), cb.url.x + 4, cb.url.y + cb.url.h / 2, 12, '#cfc8e8', cb.url.w - 6);
    const nn = netNivel(vm.net);
    if (cb.red && nn) { const r = cb.red;
      if (r.mini) barras(r.x + 4, r.y + 5, nn.barras, nn.col);
      else { rr(r.x, r.y, r.w, r.h, 14, 'rgba(255,255,255,.12)', 2); barras(r.x + 8, r.y + 7, nn.barras, nn.col); D.TL(nn.corto, r.x + 36, r.y + r.h / 2, 12, nn.col, r.w - 40, true); } }
    if (nn && nn.bloquea) { const bw = Math.max(60, (Lt.der - Lt.izq) * .3), bx = Lt.izq + ((t * 260) % ((Lt.der - Lt.izq) + bw)) - bw; rr(Lt.izq, 0, Lt.der - Lt.izq, 4, 0, 'rgba(255,138,61,.25)', 0); rr(Math.max(Lt.izq, bx), 0, Math.min(bw, Lt.der - Math.max(Lt.izq, bx), bx + bw - Lt.izq), 4, 2, nn.col, 0); }
  }
  function laSala(vm, Lt, t, mt) {
    fondo(Lt, t, '#231f45', '#3a1f55');
    const st = sala(vm.room, vm.S, vm.yo, vm.serverNow), c = !!vm.compacto;
    // presencia: entradas (caen con rebote), salidas (se desvanecen), listos (celebran)
    const pr = presencia(L.presPrev, st.asientos, t);
    const sIdx = (id) => SEATS.indexOf(id);
    if (!L.presPrev) st.asientos.forEach((a, i) => { if (!a.vacio) L.llegada[a.id] = t + i * .1; });     // entrada escalonada de los puestos al abrir la sala
    pr.entran.forEach((id) => { L.llegada[id] = t; if (id !== vm.yo) { sonido('join'); sonido('sala'); L.toast(UI.fmt.nombre(nombreAsiento(id), 12) + ' llegó', '#5cff7a'); } if (L.R && L.R.puestos[sIdx(id)]) { const r = L.R.puestos[sIdx(id)]; chispas('confeti', r.x + r.w / 2, r.y + r.h / 2, { n: 10, vel: 150 }); } });
    pr.salen.forEach((s) => { L.ghosts.push({ id: s.id, a: s.a, t0: t }); sonido('salir'); });
    pr.listos.forEach((id) => { L.celebra[id] = t; sonido('listo'); if (L.R && L.R.puestos[sIdx(id)]) { const r = L.R.puestos[sIdx(id)]; chispas('confeti', r.x + r.w / 2, r.y + 20, { n: 12 }); } });
    L.presPrev = pr;
    // reacciones de los demás (si main las pasa): vm.reacciones = [{s, id, at}] con at creciente
    if (Array.isArray(vm.reacciones)) vm.reacciones.forEach((x) => { if (x && x.s && typeof x.at === 'number' && x.at > (L.reactVisto || -1)) { L.reactVisto = x.at;
      const e = UI.REACT.filter((r) => r.id === x.id)[0]; if (e && x.s !== vm.yo) { L.burbujas[x.s] = { s: e.s, t0: t }; L.habla[x.s] = t; } } });
    if (L.ver !== st.miCh && L.pickCh && st.miCh === L.pickCh) {            // se confirmó mi personaje
      L.pickOk = true; L.pickAt = t; L.celebraAt = t; const pit = (F.PJ && F.PJ.CHARS && F.PJ.CHARS[st.miCh] && F.PJ.CHARS[st.miCh].pitch) || (UI.CHARS && UI.CHARS[st.miCh] && UI.CHARS[st.miCh].pitch) || 1;
      sonido('pick', { pitch: pit }); setTimeout(() => sonido('listo', { pitch: pit }), 120);
      if (L.R && L.R.previa) chispas('confeti', L.R.previa.x + L.R.previa.w / 2, L.R.previa.y + L.R.previa.h * .3, { n: 22, cols: paletaPj(st.miCh) });
    }
    L.ver = st.miCh;
    if (L.hostPrev !== null && st.host && st.host !== L.hostPrev) sonido('coron');            // cambió el anfitrión
    L.hostPrev = st.host || null;
    const todos = st.humanos >= 2 && st.todosListos;                                         // todos listos: tic + temblor suave
    if (todos && !L.todosPrev) { L.shakeAt = t; sonido('tic'); }
    L.todosPrev = todos;
    if (!L.tabAuto) { L.tabAuto = true; if (!st.miCh) L.tab = 'pj'; }
    const admin = st.esHost && (vm.puedeExpulsar || vm.puedeCeder) ? st.asientos.filter((a) => !a.vacio && !a.yo && !a.cpu).map((a) => a.id) : [];
    const R = layoutSala({ izq: Lt.izq, der: Lt.der, compacto: c, mt, tab: L.tab, host: st.esHost, admin, kick: !!vm.puedeExpulsar, ceder: !!vm.puedeCeder,
      lemo: L.lemoAbierto, mute: !!UI.alternarSilencio, red: !!vm.net });
    L.R = R;
    const sh = t - L.shakeAt >= 0 && t - L.shakeAt < .45 ? (1 - (t - L.shakeAt) / .45) * 3 : 0;
    if (sh) { ctx.save(); ctx.translate(Math.sin(t * 90) * sh, Math.cos(t * 70) * sh); }
    cabecera(st, R, Lt, vm, t);
    if (R.tabs) R.tabs.forEach((tb) => D.boton(B, { id: tb.id, x: tb.x, y: tb.y, w: tb.w, h: tb.h, label: tb.k === 'panas' ? 'PUESTOS ' + st.humanos + '/4' : tb.n, size: c ? 18 : 16, sel: L.tab === tb.k, fn: () => { L.tab = tb.k; } }, L.ptr));
    if (R.puestos.length) puestos(st, R, vm, t, c);
    if (R.pj.area) rejilla(st, R, t);
    if (R.previa) previa(st, R.previa, t, R);
    if (R.config.length) config(st, R);
    acciones(st, R, t, vm);
    emotes(R, st, vm, t);
    if (sh) ctx.restore();
  }
  // espectador en partida: tira de abajo con los puestos que se pueden tomar (la main dibuja el tablero debajo)
  function mirando(vm, Lt, t, mt) {
    const lb = libres(vm.room, vm.S, vm.serverNow), c = !!vm.compacto, h = Math.max(c ? 120 : 104, mt + 52), y = DH - h - 8, w = Math.min(760, Lt.der - Lt.izq - 20), x = Lt.cx - w / 2;
    D.caja(x, y, w, h, 'rgba(31,27,51,.94)', 16, 4);
    if (!lb.length) { D.T('Estás mirando · la sala está full', Lt.cx, y + h / 2 - 10, c ? 22 : 19, '#ffffff', w - 30);
      D.T('Si alguien se va, aquí te avisamos pa\' que entres', Lt.cx, y + h / 2 + 18, c ? 16 : 13, '#cfc8e8', w - 30); return; }
    D.T(lb.some((q) => q.ya) ? '¡Hay puesto libre! Te montas con lo que tenga' : 'Estás mirando', Lt.cx, y + 20, c ? 19 : 16, '#ffe14d', w - 30);
    const bw = Math.min(240, (w - 20 - 10 * (lb.length - 1)) / lb.length), bh = h - 46;
    lb.forEach((q, i) => {
      const bx = Lt.cx - (lb.length * bw + (lb.length - 1) * 10) / 2 + i * (bw + 10);
      D.boton(B, { id: 'tomar:' + q.s, x: bx, y: y + 38, w: bw, h: bh, label: 'TOMAR A ' + UI.fmt.nombre(q.name, 14), sub: q.ya ? q.est + '★ · ' + q.mon + ' monedas · ¿dale?' : 'libre en ' + UI.fmt.reloj(q.en || 0),
        off: !q.ya, size: c ? 18 : 15, fill: '#5cff7a', icon: D.icRetrato(q.ch), intent: { k: 'takeover', seat: q.s, name: L.nombre } }, L.ptr);
    });
  }
  function toasts(Lt, t) {
    L.toasts = L.toasts.filter((x) => t - x.t0 < 2.6);
    L.toasts.forEach((x, i) => { const y = 170 + i * 46, w = Math.min(520, tw(x.s, 18) + 50);
      D.caja(Lt.cx - w / 2, y - 18, w, 38, x.col, 12, 3.5); D.T(x.s, Lt.cx, y + 1, 18, INKC, w - 20, true); });
  }
  function anillo(Lt) {                                            // foco visible de teclado/mando
    if (!L.focoOn || !L.foco) return;
    const b = B.porId(L.foco); if (!b || b.off) return;
    marco(b.x - 4, b.y - 4, b.w + 8, b.h + 8, '#ffe14d', 4, 16); marco(b.x - 1, b.y - 1, b.w + 2, b.h + 2, '#14101c', 2, 14);
  }

  L.dibujar = function (vm) {
    vm = vm || {};
    const t = typeof vm.t === 'number' ? vm.t : reloj();
    sondearMando(t);                                                // mando: se sondea antes de limpiar el registro (usa el del cuadro anterior)
    const dt = L.tPrev === null ? 0 : Math.max(0, Math.min(.1, t - L.tPrev)); L.tPrev = t; L.t = t;
    L.vm = vm; B.limpiar();
    if (!lab()) return;
    let k = 0; try { k = typeof canvasScale === 'function' ? canvasScale() : 0; } catch (e) { k = 0; }
    k = vm.k || k;
    const mt = Math.max(44, Math.min(96, k > 0 ? Math.ceil(44 / k) : (vm.compacto ? 62 : 44)));
    const Lt = { izq: typeof vm.izq === 'number' ? vm.izq : 0, der: typeof vm.der === 'number' ? vm.der : DW, compacto: !!vm.compacto };
    Lt.cx = (Lt.izq + Lt.der) / 2;
    const S = vm.S || (vm.room && vm.room.board) || null;
    const sala0 = !vm.cargando && vm.room && S && S.f === 'lobby';
    if (!sala0) { L.presPrev = null; L.ghosts = []; L.R = null; L.lemoAbierto = false; if (!vm.room) { L.tabAuto = false; L.hostPrev = null; L.todosPrev = false; L.llegada = {}; L.celebra = {}; L.habla = {}; L.burbujas = {}; } }
    if (vm.cargando) cargando(Lt, t, vm.cargando);
    else if (sala0) laSala(Object.assign({}, vm, { S }), Lt, t, mt);
    else if (vm.room && vm.espectador) mirando(Object.assign({}, vm, { S }), Lt, t, mt);
    else if (!vm.room) { if (L.pantalla === 'nombre') pantNombre(Lt, t, mt); else if (L.pantalla === 'codigo') pantCodigo(Lt, t, mt); else menu(vm, Lt, t, mt); }
    anillo(Lt);
    if (L.fx) { L.fx.paso(dt); L.fx.dibujar(); }
    toasts(Lt, t);
  };
  return L;
}

F.lobby = { crear, CODE_CHARS, NAME_CHARS, GUEST_KEY, SESION_KEY, CFG_OPC, limpiarCodigo, limpiarNombre, escribir, invitado, guardarNombre, sesion, link, sala, libres,
  layoutSala, solapes, presencia, animoPuesto, animoPrevia, bote, siguienteFoco, mandoTeclas, pingNivel, netNivel, fichas, fraseDe,
  fichasAncho, ordenElegir, confirmar, textoListos, mensajeAccion, ordenPj };
if (typeof module !== 'undefined') module.exports = F.lobby;
})(typeof window !== 'undefined' ? window : globalThis);
