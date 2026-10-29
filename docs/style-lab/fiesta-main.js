// LA FIESTA · MAIN (M1, doc 07 §5.1 «fiesta-main», §7, §8): la máquina de estados de la página fiesta.html.
// Une fiesta-net (sala, SSE + sondeo ordenado por ver, act/commit/tick, sesión y reentrada), fiesta-director (cola de fx → D),
// fiesta-camara + fiesta-tablero (el mapa), fiesta-lobby (menú/sala/espectador) y fiesta-ui (HUD y avisos).
// Se engancha al laboratorio SIN campana.js: reemplaza tick()/hud()/frameWW(), pone un G falso cuyo draw() pinta la pantalla
// (así paintFrame() del motor sigue aplicando el estilo: snes/felt/ww/anime/tinta/garabato) y captura puntero y teclado antes que
// engine.js (que con los dígitos cambiaría de estilo). Ajusta GAME_VIEW al ancho de la pantalla (apaisado ancho) como campana.js.
//
// Pantallas: 'carga' (conectando) → 'menu' (sin sala: lobby) → 'sala' (board.f==='lobby') → 'juego' (sentado) | 'mira' (espectador).
// Entrada en juego: el toque va primero a los botones del HUD (fiesta-ui), luego a los míos (minimapa, candado, VER); si no, a la
// cámara (arrastre / pellizco / rueda). Un toque corto sobre el mapa elige la RUTA (si el aviso es mío), sigue una ficha o acelera.
// Sin Math.random en el juego (lo decide el servidor); el azar cosmético no existe aquí.
//
// M2 (minijuegos en vivo, doc M2-SPEC §5): reconciliarSesion() abre/cierra UNA sesión FIESTA.LIVE por (k:i) según board.f; fiesta-carta
// dibuja ruleta/tarjeta/práctica/cuenta/HUD/controles/podio y, mientras está visible, el mapa y el HUD del tablero NO se dibujan (el
// director sigue su curso y vuelve en reposo con hash(D)==hash(S)). ?practica=<id>&lv=1..3[&step=1] salta el lobby y deja jugar solo.
// ?r=CODE&mj=1 (doc 14 §7.2): SOLO el minijuego en vivo de esa sala, para el iframe del tablero de Margarita. Sin director, mapa ni lobby: la
// tarjeta y el juego salen de net.board.mj (el mismo contrato en los dos tableros) y, cuando el tablero sale de carta/mj, se avisa al padre
// con {k:'mj-cerrar'} (el podio y los pagos los anima la página de Margarita).
//
// Depuración (pruebas): window.FIESTA_DEBUG = {S, D, room, seat, net, director, ui, lobby, cam, tablero, carta, live, ya, goWall(), practica, estado(), boton(id), pantalla}
// Puro (Node): FIESTA.main.arranque(q, sesion) · pantallaDe(st) · compacto(w, h, vw) · encaje(iw, ih) · K
(function (root) {
'use strict';
const F = root.FIESTA = root.FIESTA || {};
const K = { RATIO_MAX: 2.17, RATIO_MIN: .56, TICK_MS: 250, ANDA_Y: 120, ROOM_LENTO: 12, SSE_GRACIA: 4, COMPACTO_K: .72, MINI: { w: 132, h: 99 },
  ESTILOS: ['snes', 'felt', 'ww', 'anime', 'tinta', 'garabato'], ESTILO0: 'snes', LAB_KEY: 'minicaos-lab-niveles-v1' };

/* ───────────── puros ───────────── */
const limpiarCodigo = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
// qué hacer al cargar: ?r=CODE manda; si coincide con la sesión guardada es una reentrada; si no hay ?r, la sesión se reanuda
function arranque(q, ses) {
  const r = limpiarCodigo(q && q.r);
  if (r.length === 4) return ses && ses.code === r ? { k: 'resume', code: r } : { k: 'join', code: r };
  if (ses && ses.code) return { k: 'resume', code: ses.code };
  return { k: 'menu' };
}
// st = {room, board, seat, spectating, cargando}
function pantallaDe(st) {
  if (st.cargando) return 'carga';
  if (!st.room) return 'menu';
  const f = st.board && st.board.f;
  if (!f || f === 'lobby') return 'sala';
  return st.seat ? 'juego' : 'mira';
}
// tamaño lógico: alto fijo 600, ancho entre 800 (4:3) y 600·RATIO_MAX según la ventana; en vertical (alto > ancho) el ancho se estrecha hasta 600·RATIO_MIN
// para que el lienzo llene la pantalla sin franjas negras (las capas de UI se adaptan al izq/der que reciben)
function encaje(iw, ih) {
  const r0 = iw / Math.max(1, ih), ratio = r0 < 1 ? Math.max(K.RATIO_MIN, r0) : Math.max(4 / 3, Math.min(K.RATIO_MAX, r0)), vw = 600 * ratio, k = Math.min(iw / vw, ih / 600);
  return { vw, ox: (vw - 800) / 2, k, cssW: vw * k, cssH: 600 * k };
}
// vertical o pantalla chica (el lienzo se ve a menos de ~0.72 px por unidad): botones más grandes y pestañas
function compacto(iw, ih) { const e = encaje(iw, ih); return ih > iw || e.k < K.COMPACTO_K; }

// qué hacer con la sesión del minijuego en vivo (doc M2-SPEC §5.1). x = {yo, B: net.board, key: clave de la sesión abierta, mala: clave que falló, Db: tablero
// mostrado por el director, now: serverNow}. -> {cerrar, abrir}. Se abre UNA vez por k:i; se cierra al salir de carta/mj/res o al cambiar de k:i.
function decidirSesion(x) {
  const B = x.B, ok = !!(x.yo && B && B.mj && (B.f === 'carta' || B.f === 'mj' || B.f === 'res'));
  if (!ok) return { cerrar: !!x.key, abrir: false };
  const key = B.mj.k + ':' + B.mj.i, cerrar = !!x.key && x.key !== key, abierta = !!x.key && !cerrar;
  if (abierta || x.mala === key) return { cerrar: cerrar, abrir: false };
  const Db = x.Db, abrir = (B.f === 'carta' || B.f === 'mj') && !!Db && (Db.f === 'carta' || Db.f === 'mj' || x.now >= (B.mj.startAt || 1e18) - 3000);
  return { cerrar: cerrar, abrir: abrir };
}

F.main = { arranque, pantallaDe, encaje, compacto, decidirSesion, K };
if (typeof module !== 'undefined') module.exports = F.main;
if (typeof document === 'undefined' || typeof GAME_VIEW === 'undefined' || !document.getElementById('c')) return;   // Node / sin motor

/* ───────────── navegador ───────────── */
const R = F.reglas, MAPA = R.mapa, ESC = F.tablero.ESC;
const q = new URLSearchParams(location.search);
const SIG = q.get('sig') !== '0';            // M2: el servidor ya tiene la rama fiesta de sigPayload. ?sig=0 la apaga (el relé se contesta aquí mismo)
const PRAC = q.get('practica');              // ?practica=<id>: salta el lobby y juega el minijuego solo
const MJ_SOLO = q.get('mj') === '1' && limpiarCodigo(q.get('r')).length === 4;   // iframe del tablero de Margarita: solo el minijuego
const nativeFetch = root.fetch.bind(root);
// Con ?sig=0 cada hb/aim/react se contesta aquí mismo (sin servidor que lo acepte sería un 409 en la consola).
function fetchFiesta(u, init) {
  if (!SIG && /\/api\/party\/sig$/.test(String(u))) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, n: 0 }) });
  return nativeFetch(u, init);
}
const net = F.net.create({ api: root.CLAUDEWARE_API || '', fetch: fetchFiesta, doc: document, RTC: q.get('p2p') === '1' ? undefined : null,
  log: (s) => { if (q.get('debug') === '1') console.log(s); } });
let yo = null;                               // mi asiento ('a'..'d') o null
let cargando = null, pantalla = 'carga', lastF = null, turnos = 0, ultimoPaso = null;
const aims = {};
const tablero = F.tablero.crear({});
const cam = F.cam.crear({ mundo: F.tablero.MUNDO, vista: { x: 0, y: 0, w: 800, h: 600 } });
const director = F.director.create({
  yo: null, clock: () => performance.now(), serverNow: () => net.serverNow(),
  onStep: alPaso, onSkip: alSalto, onDesync: (x) => { console.warn('[fiesta] desync', x); }
});
const ui = F.ui.crear({ emit: intencion });
const lobby = F.lobby.crear({ emit: intencionLobby });
const carta = F.carta.crear({ emit: intencionCarta });
let sesion = null, cartaVisible = false, sesionMala = null, practicaLibre = null, practicaPasoAPaso = q.get('step') === '1';
const mios = F.ui.registro();                // mis botones (minimapa, candado, VER)
let bch = null;                              // canal del tablero (aim, react) cuando hay relé

/* ── estilo: ?estilo=, o el del modo niveles, o snes (solo los 6 elegidos: los demás envuelven la escena en marcos) ── */
(function () {
  let e = q.get('estilo');
  if (K.ESTILOS.indexOf(e) < 0) { try { e = (JSON.parse(localStorage.getItem(K.LAB_KEY)) || {}).estilo; } catch (x) { e = null; } }
  setStyle(K.ESTILOS.indexOf(e) >= 0 ? e : K.ESTILO0);
})();
hud = function () {};
frameWW = function () {};

/* ── pantalla: GAME_VIEW al ancho de la ventana (alto lógico fijo 600), lienzo centrado ── */
let compact = false;
function ajustar() {
  const e = encaje(innerWidth, innerHeight);
  GAME_VIEW.width = e.vw; GAME_VIEW.offsetX = e.ox;
  resizeGameBuffers();
  if (view.height !== 600) view.height = 600;
  view.style.width = e.cssW + 'px'; view.style.height = e.cssH + 'px';
  compact = compacto(innerWidth, innerHeight);
  cam.vista(gameLeft(), 0, GAME_VIEW.width, 600);
}
addEventListener('resize', ajustar);
if (root.visualViewport) root.visualViewport.addEventListener('resize', ajustar);
ajustar();

/* ───────────── red → director ───────────── */
function seatDeNet() { return net.you ? net.you.id : null; }
function sincronizarYo() {
  const s = seatDeNet();
  if (s !== yo) { yo = s; director.setYo(s); }
}
net.onRoom(function (room) {
  sincronizarYo();
  const b = room && room.board;
  if (!b) return;
  if (MJ_SOLO) { avisarPadre(); return; }    // el tablero de otro reductor (Margarita): el director de Venezuela no lo toca
  if (b.f !== 'lobby') {
    if (lastF === 'lobby' || lastF === null) { director.reset(); ui.reset(); cam.general(2.4); }
    director.push(room);
  }
  lastF = b.f;
});
net.onGone(function () {
  director.reset(); ui.reset(); lastF = null; yo = null; director.setYo(null); cerrarCanal();
  lobby.toast('La sala se cerró, pana', '#ffe14d'); lobby.ir('menu');
});
function abrirCanal() {
  if (bch || !net.room) return;
  bch = net.channel('b');
  bch.onMsg(function (t, d, rol, de) {
    if (t === 'aim' && d && typeof d === 'object') aims[de] = d;
    else if (t === 'react' && d && d.id) ui.emote(de, d.id);
  });
}
function cerrarCanal() { if (bch) { try { bch.close(); } catch (e) {} } bch = null; }
let padreAvisado = false;
function avisarPadre() {                     // ?mj=1: el minijuego terminó (o ya no está): el padre cierra el iframe
  const B = net.board;
  if (padreAvisado || !MJ_SOLO || (B && B.mj && (B.f === 'carta' || B.f === 'mj'))) return;
  padreAvisado = true; cerrarSesion();
  try { parent.postMessage({ k: 'mj-cerrar', f: B ? B.f : null }, '*'); } catch (e) {}
}
setInterval(function () { if (net.room && net.visible) net.tickIfDue(); }, K.TICK_MS);   // el primer cliente que ve el vencimiento lo dispara

/* ── efectos del director: HUD, cámara, vibración ── */
const enMundo = (n) => { const p = MAPA.nodos[n]; return p ? { x: p.x * ESC.x, y: p.y * ESC.y } : null; };
function alPaso(paso) {
  ultimoPaso = paso;
  if (!paso || paso.local || !paso.f) return;
  const f = paso.f, S = director.board();
  if (f.k === 'turno') turnos++;
  const r = ui.efecto(f, S, yo) || {};
  if (r.vibrar && navigator.vibrate) { try { navigator.vibrate(r.vibrar); } catch (e) {} }
  if (f.k === 'estrellaMueve') { const p = enMundo(f.a); if (p) cam.forzar(p.x, p.y, .6, 1.6); }
  else if (f.k === 'est' && f.d > 0 && S && S.pj[f.s]) { const p = enMundo(S.pj[f.s].nodo); if (p) cam.forzar(p.x, p.y, .9, 1.8); }
  else if (f.k === 'ataque' && f.a === yo && S && S.pj[f.a]) { const p = enMundo(S.pj[f.a].nodo); if (p) cam.forzar(p.x, p.y, .9, 1.4); }
}
function alSalto(x) { ui.saltar(); if (x && x.why !== 'mj' && x.lines && x.lines.length) ui.toast('Mientras no estabas… ' + x.lines[x.lines.length - 1], '#ffe14d'); }

/* ───────────── intenciones ───────────── */
const nombre = () => lobby.nombre, color = () => lobby.color;
function trasEntrar(r, L) {
  cargando = null;
  if (!r || !r.ok) { (L || lobby).error(r || { status: 0 }); return r; }
  sincronizarYo(); abrirCanal();
  if (r.data && r.data.spectate) lobby.toast('La sala está full: entras mirando 👀', '#3fb0ff');
  return r;
}
function entrarCon(p, msg) { cargando = msg || 'Conectando…'; return p.then((r) => trasEntrar(r), () => trasEntrar(null)); }
function intencionLobby(it) {
  if (!it) return;
  switch (it.k) {
    case 'create': entrarCon(net.create({ name: it.name || nombre(), color: color() }), 'Armando la sala…'); break;
    case 'join': entrarCon(net.join(it.code, { name: it.name || nombre(), color: color() }), 'Entrando a ' + limpiarCodigo(it.code) + '…'); break;
    case 'resume': entrarCon(net.resume().then((r) => r || { ok: false, status: 404, data: { error: 'Room not found' } }), 'Volviendo a tu sala…'); break;
    case 'pick': net.pick({ ch: it.ch }).then((r) => { if (!r.ok) { if (r.status === 409) lobby.pickFallo(); else lobby.error(r); } }); break;
    case 'cfg': net.cfg({ cfg: it.cfg }).then((r) => { if (!r.ok) lobby.error(r); }); break;
    case 'ready': net.ready({ on: it.on !== false }).then((r) => { if (!r.ok) lobby.error(r); }); break;
    case 'start': net.start({}).then((r) => { if (!r.ok) lobby.error(r); }); break;
    case 'leave': salir(); break;
    case 'copy': copiar(it.text); break;
    case 'share':
      if (navigator.share) navigator.share({ title: 'LA FIESTA', text: it.text, url: it.url }).catch(() => {});
      else copiar(it.url);
      break;
    case 'takeover': entrarCon(net.takeover(net.room ? net.room.code : '', it.seat, { name: it.name || nombre(), color: color() }), 'Montándote en el puesto…'); break;
    case 'mundo': location.href = './'; break;
    case 'pegar':
      if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((s) => lobby.setCodigo(s), () => lobby.toast('No pude leer el portapapeles'));
      break;
  }
}
function copiar(s) {
  const ok = () => lobby.toast('¡Copiado! Pásaselo a tus panas', '#5cff7a'), no = () => lobby.toast(String(s), '#ffe14d');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(String(s)).then(ok, no); else no();
}
function salir() {
  const fin = net.board && (net.board.f === 'fin' || net.board.f === 'final');
  cerrarCanal();
  net.leave().then(() => {});
  if (fin) { try { localStorage.removeItem(net.K.SESION); } catch (e) {} }   // la partida terminó: no hay a qué volver
  director.reset(); ui.reset(); lastF = null; yo = null; director.setYo(null); lobby.ir('menu');
}
function intencion(it) {
  if (!it) return;
  if (it.k === 'act') {
    if (it.a && it.a.t === 'TIRAR') director.rollLocal();
    net.act(it.a).then((r) => { if (!r.ok && !(r.data && r.data.dup)) ui.error(r); });
  } else if (it.k === 'commit') net.commit(it.c || 'orden').then((r) => { if (!r.ok) ui.error(r); });
  else if (it.k === 'ready') net.ready({ on: it.on !== false }).then((r) => { if (!r.ok) ui.error(r); });
  else if (it.k === 'back') net.back({}).then((r) => { if (!r.ok) ui.error(r); });
  else if (it.k === 'aim') { if (bch) bch.send('aim', it.a, true); }
  else if (it.k === 'react') { if (bch) bch.send('react', { id: it.id }, false); }
  else if (it.k === 'skip') director.skip('manual');
  else if (it.k === 'leave') salir();
}

/* ───────────── minijuego en vivo (M2): una sesión por k:i ───────────── */
// el tablero MOSTRADO (director) y el de la red pueden ir distintos: la sesión nace con la tarjeta (o 3 s antes del startAt, si el director
// aún reproduce el lote) y muere cuando net.board sale de carta/mj/res. NO se hace director.skip aquí: el director ya salta a S en startAt-3 s.
function mjClave(B) { return B.mj.k + ':' + B.mj.i; }
function reconciliarSesion() {
  if (practicaLibre) return;
  const B = net.board, r = decidirSesion({ yo: yo, B: B, key: sesion ? sesion.key : null, mala: sesionMala, Db: MJ_SOLO ? B : director.D.board, now: net.serverNow() });
  if (r.cerrar) cerrarSesion();
  if (r.abrir) abrirSesion(mjClave(B));
}
function abrirSesion(key) {
  const B = net.board, g = B.mj.cola[B.mj.i] ? B.mj.cola[B.mj.i].g : '';
  if (!F.LIVE || !F.LIVE.get(g)) { sesionMala = key; return; }            // juego sin runtime en vivo (aún): se queda la tarjeta de siempre
  try { sesion = F.LIVE.create({ net: net, yo: yo, onGo: alYa }); } catch (e) { console.error('[fiesta] sesión: ' + (e && e.message)); sesionMala = key; return; }
  carta.abrir(sesion); net.sync(5, 150);
}
function cerrarSesion() { if (sesion) { try { sesion.close(); } catch (e) {} sesion = null; } carta.cerrar(); }
function alYa(x) { root.FIESTA_YA = { k: x.k, i: x.i, wall: x.wall, perf: performance.now() }; }
function intencionCarta(it) {
  if (!it) return;
  if (it.k === 'ready') { if (sesion) sesion.ready(); else intencion({ k: 'ready' }); }
  else if (it.k === 'back') intencion({ k: 'back' });
  // {k:'practica'}: la tarjeta ya abrió/cerró su práctica local
}
if (PRAC && F.LIVE && F.LIVE.get(PRAC)) {
  const EMB = q.get('embed') === '1', defP = F.LIVE.get(PRAC);   // ?embed=1&tipo=ffa|1v3|2v2: lo abre el tablero de Margarita en un iframe y espera el resultado
  // embed: &noms=<4 (o 2 en 1v1) nombres URI-codificados por asiento a,b,c,d>&chs=<ids del elenco>; el asiento a es el humano (ch=tu)
  const lista = (k) => { const v = q.get(k); return v ? v.split(',').map((x) => { try { return decodeURIComponent(x).trim(); } catch (e) { return x.trim(); } }) : undefined; };
  const optsP = { lv: Math.max(1, Math.min(3, +q.get('lv') || 1)), ch: q.get('ch') || 'mama', rol: q.get('rol') === 'trio' ? 'trio' : 'solo',
    tipo: EMB ? q.get('tipo') || undefined : undefined, noms: EMB ? lista('noms') : undefined, chs: EMB ? lista('chs') : undefined };
  if (EMB && optsP.chs && optsP.chs[0]) optsP.ch = optsP.chs[0];
  const optsReal = Object.assign({}, optsP, { dur: EMB ? defP.dur : undefined, cuenta: EMB ? 3 : 0 });
  practicaLibre = F.LIVE.practice(PRAC, optsReal);
  if (EMB) {
    let avisado = false;
    setInterval(() => {
      const p = practicaLibre, v = p && p.sess && p.sess.verdict; if (avisado || !p || !p.fin) return;
      avisado = true;
      parent.postMessage({ k: 'mj-fin', id: PRAC, tipo: p.sess.c ? p.sess.c.modo : q.get('tipo'), sc: v ? v.sc : [], pl: v ? v.pl : [] }, '*');
    }, 200);
  }   // rol: solo en 1v3 (?rol=solo|trio); los demás juegos lo ignoran
  if (EMB) carta.embed(practicaLibre, F.LIVE.get(PRAC), optsP);   // tarjeta de reglas + PRACTICAR + ¡LISTO! + 3·2·1 antes de la sesión real
  else carta.libre(practicaLibre, F.LIVE.get(PRAC), practicaPasoAPaso);
}

/* ───────────── dibujo ───────────── */
function estadoRed() {
  if (!net.room) return { estado: 'ok', label: '' };
  const t = performance.now() / 1000;
  if (net.sseOK) sseVisto = t;
  const sin = t - sseVisto;
  return { estado: sin > K.ROOM_LENTO ? 'caido' : sin > K.SSE_GRACIA ? 'reconectando' : 'ok', label: SIG ? net.label() : '' };
}
// Presencia: sin el relé (M2) nadie manda hb, así que fiesta-net vería a todos «sin señal». Hasta entonces se toma el estado del tablero
// (cpu 'afk' = fuera) y se oculta el ping.
function asientos() {
  const l = net.seats();
  return SIG ? l : l.map((x) => Object.assign({}, x, { online: x.cpu !== 'afk', rtt: x.you ? x.rtt : 0 }));
}
let sseVisto = performance.now() / 1000;
function colores() { const o = {}; ((net.room && net.room.players) || []).forEach((p) => { o[p.id] = p.color; }); return o; }
function saltos(D) {
  const o = {}; Object.keys(D.fichas || {}).forEach((s) => { const f = D.fichas[s]; if (f.hop && f.de) o[s] = { de: f.de, a: f.nodo, k: f.t }; });
  return o;
}
function miniRect() { const m = K.MINI, p = (gameRight() - gameLeft()) < 560 ? .85 : 1; return { x: gameLeft() + 8, y: compact ? 132 : 116, w: Math.round(m.w * p), h: Math.round(m.h * p) }; }   // vertical angosto: más chico para dejar sitio a los botones junto a él sin pisar mute/log
function dibujarMapa(D) {
  const B = D.board;
  const foco = tablero.foco(B);
  // mientras la ficha camina, el dado grande y el «QUEDAN n» del HUD ocupan el centro: la cámara mira un poco más arriba y la ficha
  // queda en el tercio de abajo (en reposo vuelve al centro, encima del panel del aviso)
  const anda = B.f === 'turno' && B.t && B.t.paso === 'mover' || !!(D.paso && (D.paso.k === 'dado' || D.paso.k === 'hop'));
  if (foco) cam.seguir(foco.x, foco.y - (anda ? K.ANDA_Y / cam.zSeguir : 0), B.f === 'turno' ? cam.zSeguir : cam.zFit());
  else cam.seguir(cam.mundo.w / 2, cam.mundo.h / 2, cam.zFit());
  const mio = !!(D.prompt && D.prompt.esp && D.prompt.esp.s === yo);
  tablero.dibujar(ctx, cam, B, { yo: yo, mio: mio, colores: colores(), saltos: saltos(D) });
  if (ui.rutaMia && (gameRight() - gameLeft()) < 560) return;   // vertical angosto: el aviso de ruta ocupa ese rincón; el mapa se toca directo
  const r = miniRect();
  tablero.dibujarMini(ctx, cam, B, r, { colores: colores() });
  mios.add({ id: 'mini', x: r.x, y: r.y, w: r.w, h: r.h, fn: (x, y) => { const m = F.cam.mini(r, cam.mundo); const w = m.aMundo(x, y); cam.irA(w.x, w.y, Math.max(cam.z, cam.zSeguir)); } });
  const d = F.ui.d, fijo = cam.modo === 'fijo', lado = (gameRight() - gameLeft()) < 560;   // vertical angosto: los botones van a la derecha del minimapa (no debajo, donde chocan con avisos)
  const bx = lado ? r.x + r.w + 8 : r.x, by = lado ? r.y : r.y + r.h + 10, dx = lado ? 0 : 68, dy = lado ? 52 : 0;
  d.boton(mios, { id: 'candado', x: bx, y: by, w: 64, h: 44, label: fijo ? '🔒' : '🎥', size: 20, fill: fijo ? '#ffe14d' : '#ffffff', fn: () => cam.fijar(!fijo) }, ui.ptr);
  d.boton(mios, { id: 'general', x: bx + dx, y: by + dy, w: 64, h: 44, label: '🗺️', size: 20, fill: '#ffffff', fn: () => cam.general(3) }, ui.ptr);
  if (cam.pendiente) d.boton(mios, { id: 'ver', x: r.x, y: r.y + r.h + 8, w: 132, h: 44, label: '👀 VER', size: 18, fill: '#ff8a3d', fn: () => cam.ver() }, ui.ptr);
}
function dibujarMJ(B) {                       // espectador (o juego sin runtime en vivo): una tarjeta con la cuenta hasta el cierre
  if (!B || (B.f !== 'mj' && B.f !== 'carta') || !B.mj) return;
  const d = F.ui.d, cx = (gameLeft() + gameRight()) / 2, g = B.mj.cola && B.mj.cola[B.mj.i] ? B.mj.cola[B.mj.i].g : '';
  const nom = F.LIVE && F.LIVE.get(g) ? F.LIVE.get(g).name : String(g).replace(/^f_/, '').toUpperCase();
  const hasta = B.f === 'mj' ? B.mj.cierre : B.mj.cartaHasta, quedan = Math.max(0, Math.ceil(((hasta || 0) - net.serverNow()) / 1000));
  d.caja(cx - 230, 230, 460, 120, '#3fb0ff', 18, 5); rr(cx - 220, 240, 440, 100, 12, '#fffdf2', 3);
  d.T('🎮 ' + (F.ui.TIPO[B.mj.tipo] || 'MINIJUEGO') + ' · ' + nom, cx, 272, 24, '#3fb0ff', 420);
  d.T(yo ? 'Minijuego en curso · ' + quedan + ' s' : 'Mirando el minijuego · ' + quedan + ' s', cx, 312, 16, '#14101c', 420, true);
}
function dibujarResumen(D) {
  if (!D.resumen || !D.resumen.lines || !D.resumen.lines.length) return;
  const d = F.ui.d, cx = (gameLeft() + gameRight()) / 2, n = Math.min(4, D.resumen.lines.length), h = 50 + n * 22;
  ctx.save(); ctx.globalAlpha = Math.min(1, (1 - D.resumen.t) * 4);
  d.caja(cx - 240, 170, 480, h, '#1f1b33', 14, 4);
  d.T('Mientras no estabas…', cx, 192, 20, '#ffe14d', 460);
  D.resumen.lines.slice(-n).forEach((l, i) => d.T(l, cx, 220 + i * 22, 14, '#ffffff', 460, true));
  ctx.restore();
}
function vmLobby() {
  return { room: net.room, S: net.board, yo: yo, serverNow: net.serverNow(), seats: asientos(), espectador: net.spectating || !yo,
    cargando: cargando, izq: gameLeft(), der: gameRight(), compacto: compact };
}
function vmCarta(D) {
  return { S: D.board, D: D, yo: yo, serverNow: net.serverNow(), izq: gameLeft(), der: gameRight(), compacto: compact, seats: asientos(),
    sess: sesion, net: net };
}
function dibujarSoloMJ() {                   // ?mj=1: la tarjeta y el juego; mientras no hay sesión, un fondo con lo que pasa
  pantalla = 'juego'; mios.limpiar(); cartaVisible = false;
  const B = net.board;
  if (sesion && B && B.mj && (B.f === 'carta' || B.f === 'mj')) cartaVisible = carta.dibujar(vmCarta({ board: B }));
  if (cartaVisible) return;
  const d = F.ui.d, cx = (gameLeft() + gameRight()) / 2;
  ctx.fillStyle = '#0b0b14'; ctx.fillRect(gameLeft(), 0, gameRight() - gameLeft(), 600);
  d.T(cargando || (B && B.mj ? '🎮 ¡Ya viene el minijuego!' : 'Conectando…'), cx, 300, 22, '#ffe14d', 520);
}
function dibujar() {
  sincronizarYo();
  if (MJ_SOLO) { dibujarSoloMJ(); return; }
  if (practicaLibre) {                          // ?practica=<id>: sin red, sin lobby
    pantalla = 'practica'; mios.limpiar(); cartaVisible = true;
    carta.dibujarLibre({ izq: gameLeft(), der: gameRight(), compacto: compact, dt: practicaPasoAPaso ? 0 : undefined });
    return;
  }
  pantalla = pantallaDe({ room: net.room, board: net.board, seat: yo, cargando: cargando });
  mios.limpiar();
  cartaVisible = false;
  if (pantalla === 'juego' || pantalla === 'mira') {
    const D = director.D;
    if (!D.board) { lobby.dibujar(Object.assign(vmLobby(), { cargando: 'Cargando el tablero…' })); return; }
    const Bm = D.board, enMJ = Bm.mj && (Bm.f === 'carta' || Bm.f === 'mj' || Bm.f === 'res');
    // pantalla del minijuego: con sesión (asiento propio) o, para el podio, también de espectador. Devuelve false en «espera» (tablero).
    if (enMJ && (sesion || (Bm.f === 'res' && Bm.mj.res))) cartaVisible = carta.dibujar(vmCarta(D));
    if (cartaVisible) return;
    dibujarMapa(D);
    ui.dibujar({ S: D.board, yo: yo, serverNow: net.serverNow(), izq: gameLeft(), der: gameRight(), compacto: compact, net: estadoRed(),
      backlog: director.pending(), aim: aims, seats: asientos(), espVisible: director.isIdle() || !!D.prompt });
    if (!sesion) dibujarMJ(D.board);
    dibujarResumen(D);
    if (pantalla === 'mira') lobby.dibujar(vmLobby());
  } else lobby.dibujar(vmLobby());
}
G = { t: 0, dur: 1, result: null, impact: 0, cmd: '', hint: '', update: function () {}, press: function () {}, draw: dibujar };

let lastT = performance.now();
tick = function (dt) {
  now += dt; G.t += dt;
  const t = performance.now(), ms = t - lastT; lastT = t;
  director.update();
  cam.update(Math.min(.1, ms / 1000));
  reconciliarSesion();
  if (sesion) {
    try { sesion.update(Math.min(.1, dt)); }
    catch (e) { console.error('[fiesta] sesión.update: ' + (e && e.stack || e)); sesionMala = sesion.key; cerrarSesion(); }
  }
};

/* ───────────── entrada (captura: antes que engine.js) ───────────── */
const ptrs = {};                               // pointerId → 'ui' | 'mio' | 'lobby' | 'cam'
const despierta = () => { try { const a = A(); if (a.resume) a.resume(); } catch (e) {} };
function enJuego() { return pantalla === 'juego' || pantalla === 'mira'; }
function hitLobby(p) { return lobby.B.hit(p.x, p.y); }
addEventListener('pointerdown', function (e) {
  if (e.target !== view) return;
  e.stopImmediatePropagation(); e.preventDefault(); despierta();
  try { view.setPointerCapture(e.pointerId); } catch (x) {}
  const p = canvasPoint(e);
  ui.mover(p.x, p.y, true); lobby.mover(p.x, p.y, true);
  if (cartaVisible) { ptrs[e.pointerId] = 'carta'; carta.down(e.pointerId, p.x, p.y); return; }     // multitáctil: stick + A a la vez; nunca va a la cámara
  if (MJ_SOLO) return;
  if (!enJuego()) { ptrs[e.pointerId] = 'lobby'; return; }
  if (pantalla === 'mira' && hitLobby(p)) { ptrs[e.pointerId] = 'lobby'; return; }
  if (ui.B.hit(p.x, p.y)) { ptrs[e.pointerId] = 'ui'; return; }
  if (mios.hit(p.x, p.y)) { ptrs[e.pointerId] = 'mio'; return; }
  ptrs[e.pointerId] = 'cam'; cam.bajar(e.pointerId, p.x, p.y);
}, true);
addEventListener('pointermove', function (e) {
  if (e.target !== view && ptrs[e.pointerId] === undefined) return;
  e.stopImmediatePropagation();
  const p = canvasPoint(e);
  ui.mover(p.x, p.y); lobby.mover(p.x, p.y);
  if (ptrs[e.pointerId] === 'carta') { carta.move(e.pointerId, p.x, p.y); return; }
  if (ptrs[e.pointerId] === 'cam') cam.mover(e.pointerId, p.x, p.y);
}, true);
function soltar(e, cancel) {
  const k = ptrs[e.pointerId]; if (k === undefined) return;
  delete ptrs[e.pointerId];
  e.stopImmediatePropagation();
  const p = canvasPoint(e);
  ui.mover(p.x, p.y, false); lobby.mover(p.x, p.y, false);
  if (e.pointerType === 'touch') { ui.mover(-999, -999, false); lobby.mover(-999, -999, false); }
  if (k === 'carta') { if (cancel) carta.up(e.pointerId, -9999, -9999); else carta.up(e.pointerId, p.x, p.y); return; }
  if (cancel) { if (k === 'cam') cam.cancelar(); return; }
  if (k === 'lobby') lobby.tap(p.x, p.y);
  else if (k === 'ui') ui.tap(p.x, p.y);
  else if (k === 'mio') { const b = mios.press(p.x, p.y); if (b && !b.off && b.fn) b.fn(p.x, p.y); }
  else if (k === 'cam') { const r = cam.subir(e.pointerId, p.x, p.y); if (r && r.tap) tocarMapa(r.tap.x, r.tap.y); }
}
addEventListener('pointerup', (e) => soltar(e, false), true);
addEventListener('pointercancel', (e) => soltar(e, true), true);
addEventListener('contextmenu', (e) => { if (e.target === view) e.preventDefault(); });
view.addEventListener('wheel', function (e) { if (!enJuego()) return; e.preventDefault(); const p = canvasPoint(e); cam.rueda(e.deltaY, p.x, p.y); }, { passive: false });
function tocarMapa(x, y) {
  const D = director.D, B = D.board; if (!B) return;
  if (D.prompt && D.prompt.esp && D.prompt.esp.k === 'RUTA' && D.prompt.esp.s === yo) {
    const a = tablero.rutaEn(x, y, cam, B);
    if (a) { intencion({ k: 'act', a: { t: 'RUTA', a: a } }); return; }
  }
  const s = tablero.fichaEn(x, y, cam, B);
  if (s) { const f = tablero.posFicha(s, B); if (f) cam.irA(f.x, f.y, Math.max(cam.z, cam.zSeguir)); return; }
  if (!director.isIdle()) director.tap();
}
addEventListener('keydown', function (e) {
  e.stopImmediatePropagation(); despierta();
  if (e.repeat) return;
  const k = e.code;
  if (k === 'Space' || k === 'Backspace' || k.indexOf('Arrow') === 0) e.preventDefault();
  if (cartaVisible && carta.tecla(k, true)) return;                       // WASD/flechas/Espacio/J/K/Shift del minijuego (antes que ui)
  if (MJ_SOLO) return;
  if (!enJuego()) { lobby.tecla(k, e.key); return; }
  if (pantalla === 'mira' && lobby.tecla(k, e.key)) return;
  if (ui.tecla(k)) return;
  if (k === 'KeyL') cam.fijar(cam.modo !== 'fijo');
  else if (k === 'KeyV') cam.ver();
}, true);
addEventListener('keyup', function (e) {
  if (!cartaVisible) return;
  if (carta.tecla(e.code, false)) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
document.addEventListener('visibilitychange', function () { if (!document.hidden) { lastT = performance.now(); if (net.room) net.tickIfDue(); } });

/* ───────────── arranque ───────────── */
const plan = practicaLibre ? { k: 'menu' } : arranque({ r: q.get('r') }, net.session());
if (MJ_SOLO && plan.k !== 'resume') { padreAvisado = true; try { parent.postMessage({ k: 'mj-cerrar', f: null }, '*'); } catch (e) {} }   // sin mi asiento guardado no hay minijuego que jugar aquí
else if (plan.k === 'join') intencionLobby({ k: 'join', code: plan.code, name: nombre() });
else if (plan.k === 'resume') {
  cargando = 'Volviendo a tu sala…';
  net.resume().then(function (r) {
    if (!r) { cargando = null; avisarPadre(); return; }
    if (!r.ok) { cargando = null; lobby.toast(r.status === 403 || r.status === 404 ? 'Tu sala ya no existe' : F.ui.errorEs(r)); avisarPadre(); return; }
    trasEntrar(r);
  }, function () { cargando = null; avisarPadre(); });
}
if (!MJ_SOLO) tablero.precalentar();

/* ───────────── depuración (pruebas e2e) ───────────── */
function registroActivo() { return cartaVisible ? [carta.B] : enJuego() ? [ui.B, mios].concat(pantalla === 'mira' ? [lobby.B] : []) : [lobby.B]; }
root.FIESTA_DEBUG = {
  get S() { return net.board; }, get D() { return director.D; }, get room() { return net.room; }, get seat() { return yo; },
  get pantalla() { return pantalla; }, get turnos() { return turnos; }, get paso() { return ultimoPaso; },
  net: net, director: director, ui: ui, lobby: lobby, cam: cam, tablero: tablero, reglas: R, carta: carta, F: F,
  get live() { return sesion; }, get ya() { return root.FIESTA_YA || null; },
  // ms de reloj de pared (de ESTA página) en que arranca el «¡YA!» (para medir la diferencia entre pantallas)
  goWall: function () { const m = net.board && net.board.mj; return m && m.startAt != null ? Date.now() + (m.startAt - net.serverNow()) : null; },
  get practica() {
    const p = practicaLibre; if (!p) return null;
    return { update: (dt) => p.update(dt), draw: () => p.draw(), in: p.in, hud: () => p.hud(), gt: () => p.gt(), get fin() { return p.fin; }, p: p };
  },
  // centro de un botón registrado en el último cuadro, en coordenadas de cliente (para page.mouse / touchscreen)
  boton: function (id) {
    const regs = registroActivo();
    for (let i = 0; i < regs.length; i++) {
      const b = regs[i].porId(id); if (!b) continue;
      const r = view.getBoundingClientRect(), x = b.x + b.w / 2, y = b.y + b.h / 2;
      return { x: r.left + (x + GAME_VIEW.offsetX) * r.width / GAME_VIEW.width, y: r.top + y * r.height / 600, off: !!b.off };
    }
    return null;
  },
  botones: function () { const o = []; registroActivo().forEach((g) => g.lista.forEach((b) => { if (b.id) o.push(b.id + (b.off ? '(off)' : '')); })); return o; },
  // del mundo a cliente (para tocar fichas o casillas)
  aCliente: function (wx, wy) { const s = cam.aPantalla(wx, wy), r = view.getBoundingClientRect(); return { x: r.left + (s.x + GAME_VIEW.offsetX) * r.width / GAME_VIEW.width, y: r.top + s.y * r.height / 600 }; },
  estado: function () {
    const D = director.D, B = D.board, pr = D.prompt;
    return { pantalla: pantalla, seat: yo, code: net.room ? net.room.code : null, f: B ? B.f : (net.board ? net.board.f : null), r: B ? B.r : 0,
      ver: director.ver(), target: director.target(), idle: director.isIdle(), hash: director.hash(), hashS: director.hashS(),
      hashNet: net.board && net.board.f !== 'lobby' ? R.hash(net.board) : 0, netVer: net.ver, turnos: turnos, paso: D.paso ? D.paso.k : null,
      prompt: pr ? (pr.esp ? pr.esp.k : pr.listo ? 'LISTO' : '?') : null, afk: !!(B && yo && B.pj[yo] && B.pj[yo].cpu === 'afk'),
      pos: B ? Object.keys(B.pj).reduce((o, s) => { o[s] = B.pj[s].nodo; return o; }, {}) : {},
      mon: B ? Object.keys(B.pj).reduce((o, s) => { o[s] = B.pj[s].mon; return o; }, {}) : {},
      cpu: B ? Object.keys(B.pj).reduce((o, s) => { o[s] = B.pj[s].cpu; return o; }, {}) : {},
      ch: net.board ? Object.keys(net.board.pj || {}).reduce((o, s) => { o[s] = net.board.pj[s].ch; return o; }, {}) : {},
      stats: director.stats(), sse: net.sseOK, spectating: net.spectating,
      mj: net.board && net.board.mj ? { k: net.board.mj.k, i: net.board.mj.i, tipo: net.board.mj.tipo, g: (net.board.mj.cola[net.board.mj.i] || {}).g,
        phase: sesion ? sesion.phase : null, gt: sesion ? sesion.gt() : null, juez: net.board.mj.juez, e: net.board.mj.e, listos: net.board.mj.listos,
        sess: !!sesion, fase: carta.fase, verdict: sesion && sesion.verdict ? { h: sesion.verdict.h, sc: sesion.verdict.sc, pl: sesion.verdict.pl, fuente: sesion.verdict.fuente } : null } : null,
      podio: net.board && net.board.mj && net.board.mj.res ? { puestos: net.board.mj.res.puestos, pagos: net.board.mj.res.pagos, sc: net.board.mj.res.sc, h: net.board.mj.res.h || null, empate: net.board.mj.res.empate } : null,
      ya: root.FIESTA_YA || null };
  }
};
})(typeof window !== 'undefined' ? window : globalThis);
