'use strict';
/* Isla de Margarita · el "servidor" del modo local (doc 14 §7.2, D4): el mismo reductor que corre en el hook, aquí en el navegador.
   Tú (asiento a) contra 3 CPU. El reloj es virtual: cuando nadie humano tiene que decidir, avanza solo hasta el próximo
   vencimiento (S.nextAt); mientras te toca a ti, se queda quieto, así que en local no hay plazos que se venzan.
   margarita.js (el director) pide lotes de efectos con paso()/jugar()/listo()/mjFin() y los anima. */
const LOCAL = (function () {
const R = MARGA.reglas;
const QUIENES = [['TÚ', 'tu'], ['MAMÁ', 'mama'], ['ABUELA', 'abuela'], ['PANA', 'pana']];
let S = null, P = null, now = 0;
function usar(r) { if (r.error) { console.warn('[margarita] jugada rechazada:', r.error); return null; } S = r.S; P = r.priv; return r.fx; }
// o = {tot, todoCpu, sinMJ}
function crear(o) {
  const asientos = QUIENES.map(([name, ch], i) => (o.todoCpu || i > 0 ? { name, ch, cpu: 'auto' } : { name, ch }));
  const semilla = (Math.random() * 2147483646 | 0) + 1;
  const c = R.crear(semilla, { tot: o.tot, orden: 'fijo', sinMJ: !!o.sinMJ, micro: !o.sinMJ, cpuNivel: 2 }, asientos, 0);
  S = c.S; P = c.priv; now = 0;
}
const humano = (s) => S.pj[s] && S.pj[s].cpu === null;
// lo que el director tiene que resolver con el jugador antes de seguir: un aviso suyo, la tarjeta o el minijuego en vivo
function espera() {
  if (S.f === 'turno' && S.esp && humano(S.esp.s)) return 'aviso';
  if (S.f === 'carta' && S.mj && S.mj.as.some(humano)) return 'carta';
  if (S.f === 'mj') return 'mj';
  return null;
}
// el próximo lote que no necesita a nadie (CPU, orden, resultado, final), o null si hay que esperar o se acabó
function paso() {
  if (S.f === 'fin' || espera()) return null;
  now = Math.max(now, S.nextAt || now);
  const r = R.tick(S, P, now);
  if (r.nada) { now += 100; return []; }
  return usar(r);
}
const jugar = (a) => usar(R.aplicar(S, P, 'a', Object.assign({ eid: S.esp && S.esp.id }, a), now));
const libre = (a) => usar(R.aplicar(S, P, 'a', a, now));   // jugadas que no dependen de un aviso (los secretos)
const listo = () => usar(R.aplicar(S, P, 'a', { t: 'LISTO' }, now));
// pl = puestos por asiento de S.mj.as (1 = ganó); sin puestos válidos, el juez lo resuelve con puntajes al azar
function mjFin(pl) {
  const mj = S.mj, n = mj.as.length, ok = pl && pl.length === n && pl.every((x) => x >= 1 && x <= n);
  const sc = ok ? pl.map((x) => n - x) : mj.as.map(() => Math.random());
  return usar(R.aplicar(S, P, '$', ok ? { t: 'MJ_RESULTADO', k: mj.k, sc, pl } : { t: 'MJ_RESULTADO', k: mj.k, sc }, now));
}
return { crear, paso, jugar, libre, listo, mjFin, espera, get S() { return S; } };
})();
