'use strict';
/* Isla de Margarita · EN LÍNEA (doc 14 §7.2, M3). La sala es la de LA FIESTA (fiesta-net.js: create/join/act/tick, SSE + sondeo
   ordenado por ver, sesión en localStorage 'minicaos-fiesta-v1'); el tablero es board.tab === 'margarita' y lo corre el servidor.
   Aquí va lo puro que decide qué hace la página con la sala (pendientes, espera), que también usa test/margarita-live.test.js,
   y la conexión del navegador (MARGA.red.net()), una sola para la carcasa (el lobby) y el director (la partida).
   El minijuego en vivo no pasa por aquí: lo juega un iframe de fiesta.html?r=CODE&mj=1 con su propia conexión. */
(function (root) {
const M = root.MARGA = root.MARGA || {};
const TAB = 'margarita';

// Los lotes del anillo (board.fx = [{v, s, fx}]) que la foto D (en la versión Dver) aún no animó, en orden. Si falta alguno
// (el anillo se recortó, o la página acaba de llegar), {snap:true}: la foto salta al tablero sin animar.
function pendientes(Dver, B) {
  if (!B || B.f === 'lobby') return { lotes: [] };
  const l = (B.fx || []).filter((e) => e.v > Dver).sort((a, b) => a.v - b.v);
  if (!l.length) return { lotes: [], snap: B.ver > Dver };
  for (let i = 0; i < l.length; i++) if (l[i].v !== Dver + 1 + i) return { lotes: [], snap: true };
  return { lotes: l };
}
// Qué espera el tablero de este asiento cuando la foto ya lo alcanzó: 'mio' (mi aviso), 'otro' (el aviso de otro),
// 'mj' (tarjeta o minijuego: se abre el iframe; también para los dos que miran una bronca) o null (nada: correr el reloj).
function espera(B, yo) {
  if (!B) return null;
  if (B.f === 'turno' && B.esp) return B.esp.s === yo ? 'mio' : 'otro';
  if ((B.f === 'carta' || B.f === 'mj') && B.mj && yo) return 'mj';
  return null;
}
const esMargarita = (room) => !!(room && room.board && room.board.tab === TAB);

/* ───────── navegador: la conexión y el invitado (el mismo de la app: 'claudeware-guest' = {name, color}) ───────── */
const GUEST_KEY = 'claudeware-guest', COLORES = ['#FF4D4D', '#4DB8FF', '#5CFF7A', '#FFE14D', '#B49CFF', '#FF6FA8'];
function invitado() {
  let g = null;
  try { g = JSON.parse(localStorage.getItem(GUEST_KEY)); } catch (e) {}
  if (!g || !g.name) {
    g = { name: 'GUEST ' + (1000 + Math.floor(Math.random() * 9000)), color: COLORES[Math.floor(Math.random() * COLORES.length)] };
    try { localStorage.setItem(GUEST_KEY, JSON.stringify(g)); } catch (e) {}
  }
  return g;
}
let N = null;
function net() {
  if (N || !root.FIESTA || !root.FIESTA.net) return N;
  N = root.FIESTA.net.create({ api: root.CLAUDEWARE_API || '', doc: root.document, RTC: null });   // la página no juega minijuegos: sin malla P2P
  setInterval(() => { if (N.room && N.visible) N.tickIfDue(); }, 250);   // el primer cliente que ve un vencimiento lo dispara (CPU, plazos)
  return N;
}

M.red = { TAB, pendientes, espera, esMargarita, invitado, net };
if (typeof module !== 'undefined') module.exports = M.red;
})(typeof window !== 'undefined' ? window : globalThis);
