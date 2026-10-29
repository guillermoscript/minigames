// Isla de Margarita · 300 partidas de 4 CPU sobre el reductor (doc 14 §9): sin errores ni bloqueos, y con las mismas cifras
// que el juego de hoy (margarita.js con ?cpu=1&sinmj=1&turnos=10).
const test = require('node:test'), assert = require('node:assert');
const R = require('../docs/margarita/margarita-reglas.js');
R.ESTRICTO = true;   // una jugada inválida de la CPU revienta la prueba en vez de caer en la acción por defecto

// Referencia: 120 partidas del juego de hoy en Chromium (rAF acelerado), medidas el 2026-10-26 antes de partir margarita.js.
// [media, desviación] por partida. emp = empanadas de los 4 al final (con las extra); bs, mj, ev, max, items = por jugador;
// pimp = pimpinas de los 4; gan = empanadas del ganador.
const HOY = { emp: [7.39, 1.66], bs: [53.52, 11.51], pimp: [0.27, 0.81], mj: [37.89, 5.92], ev: [1.09, 0.43], max: [61.06, 9.89],
  items: [0.56, 0.36], gan: [3.10, 0.78] };
// Recalibrado el 2026-10-29 (600 partidas del reductor) tras limitar el dado a 1–6 (antes 1–10): ~41 % menos pasos por turno,
// así que se llega menos a la señora (empanadas -15 %) y sobra más plata (bs +24 %); el resto de cifras no se mueve.
// Recalibrado el 2026-10-29 (600 partidas) con la Empanadera MÓVIL (como la estrella del Mario Party): al comprarle se muda a otro de 10 puestos
// (PUESTOS_EMP) y arranca en Punta de Piedras, a 8 pasos de la salida. Antes solo había 2 puestos a 25-39 casillas uno del otro (~0.54 compras por
// jugador a 10 turnos); ahora ~0.84: empanadas +18 % (6.27 -> 7.39, con las extra del final), bs -9 % (se gasta más en ellas) y el Bachaquero cobra
// 3 veces menos (0.77 -> 0.27 pimpinas por partida) porque su puesto fijo cae menos en el camino de la carrera. Las demás cifras no se mueven.
// Diferencias a propósito con el juego de hoy (doc 14): las casillas M son una ruleta al 50 % (P3; hoy la CPU gana el 55 %),
// el minijuego sale del CATALOGO en vivo y La Restinga cobra por cruzar (hoy cobraba por quedarse, ver salidas() en el reductor).

function jugar(sem, cfg) {
  let { S, priv } = R.crear(sem, Object.assign({ tot: 10 }, cfg), [], 0), now = 0, n = 0, ms = 0, max = 0;
  const k = {};
  while (S.f !== 'fin') {
    now = Math.max(now, S.nextAt);
    const r = R.tick(S, priv, now);
    if (r.nada) { now += 50; continue; }
    if (++n > 3000) throw new Error('partida ' + sem + ' trancada en ' + S.f);
    r.fx.forEach((f) => { k[f.k] = (k[f.k] || 0) + 1; if (f.k === 'cruza') k['cruza_' + f.por] = (k['cruza_' + f.por] || 0) + 1; });
    ms += R.fxMs(r.fx) + (r.S.esp ? R.T.cpu : 0);
    max = Math.max(max, JSON.stringify(r.S).length);
    S = r.S; priv = r.priv;
  }
  const ss = Object.keys(S.pj), P = S.pj, suma = (f) => ss.reduce((t, s) => t + f(P[s]), 0);
  return { emp: suma((p) => p.emp), bs: suma((p) => p.bs) / 4, pimp: suma((p) => p.pimpinas), mj: suma((p) => p.bono.mj) / 4,
    ev: suma((p) => p.bono.ev) / 4, max: suma((p) => p.bono.max) / 4, items: suma((p) => p.items.length) / 4, gan: P[S.ganador].emp,
    fx: k, ms, lotes: n, tam: max };
}
const media = (l, k) => l.reduce((t, x) => t + x[k], 0) / l.length;

test('300 partidas de 4 CPU: terminan, sin jugadas inválidas, y las cifras caen en la franja del juego de hoy', () => {
  const l = [];
  for (let s = 1; s <= 300; s++) l.push(jugar(s));
  for (const k of Object.keys(HOY)) {
    const [mu, sd] = HOY[k], m = media(l, k);
    // franja: 4 errores estándar de la diferencia de medias (300 vs 120 partidas), con un piso de 12 % de la media de hoy
    const tol = Math.max(4 * sd * Math.sqrt(1 / 300 + 1 / 120), .12 * Math.abs(mu));
    assert.ok(Math.abs(m - mu) <= tol, `${k}: reductor ${m.toFixed(2)} vs hoy ${mu} (±${tol.toFixed(2)})`);
  }
  const tam = Math.max(...l.map((x) => x.tam));
  assert.ok(tam < 32 * 1024, 'el board pasa de 32 KB: ' + tam);
  const cruces = (p) => l.reduce((t, x) => t + (x.fx['cruza_' + p] || 0), 0) / l.length;
  assert.ok(cruces('restinga') > 0 && cruces('lancha') > 0 && cruces('ferry') > 0, 'nadie cruza: ' + [cruces('restinga'), cruces('lancha'), cruces('ferry')]);
  const min = media(l, 'ms') / 60000;
  assert.ok(min > 3 && min < 30, 'duración rara: ' + min.toFixed(1) + ' min');
  console.log(`# sim: ${(media(l, 'lotes')).toFixed(0)} lotes, ${min.toFixed(1)} min de cinemática, board máx ${tam} B, cruces/partida ` +
    `restinga ${cruces('restinga').toFixed(2)} lancha ${cruces('lancha').toFixed(2)} ferry ${cruces('ferry').toFixed(2)}`);
});

test('CPU nivel 1 (se equivoca al azar) y partidas cortas: siempre jugadas válidas', () => {
  for (let s = 1; s <= 40; s++) jugar(s, { cpuNivel: 1 });
  for (let s = 1; s <= 30; s++) jugar(s, { tot: 1 + (s % 6) });
});
