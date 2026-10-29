'use strict';
/* Banco headless de f_guaya (1v3, modelo B, carrera por las guayas). Mide el balance del solo y deja afinar la perilla (PERILLA.SUBE por nivel: fracción de dur que
   tarda en subir alguien a quien no le pega nada; más alto = más difícil para el trío).
     node docs/style-lab/pruebas/fiesta-guaya-bench.js              balance: % de victorias del solo, 200 semillas × 3 niveles (skill .6; .35 y .85 informativos)
     S0=400 node ...                                                  otro bloque de semillas (S0+1 … S0+N)
     node docs/style-lab/pruebas/fiesta-guaya-bench.js --sweep      barre SUBE (valor actual ± 0,06) por nivel y marca los valores que caen en 45-55 %
   Usa LIVE.sim (el create() REAL con cuatro asientos CPU y reloj virtual): el veredicto sale de FIESTA.reglas.compara vía puestos(), nunca de un hook del juego.
   «Igual habilidad» = las 4 CPU con la misma skill; el modelo de la CPU (reacción, despistes y puntería del salto del trío; elección de guaya del operario) vive en `ai`
   y NO se toca una vez medido: la única perilla es SUBE. Afina en pasos de 0,01-0,02.
   Como el catálogo compartido todavía no trae f_guaya con lim, aquí se completa EN MEMORIA (no se escribe ningún archivo). Exporta cargar/sim/medir para las pruebas. */
const path = require('path');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-guaya.js');
const LO = 0.45, HI = 0.55;                              // objetivo: con CPU iguales el solo gana 45-55 %
const LIM = { scoreMax: 30, scoreRate: 10, minT: 6, finTemprano: 1 };

function cargar() {
  globalThis.window = globalThis;
  const LIVE = require(path.join(SL, 'fiesta-live.js'));
  globalThis.FIESTA.rng = require(path.join(SL, 'fiesta-rng.js'));
  const reglas = globalThis.FIESTA.reglas = require(path.join(SL, 'fiesta-reglas.js'));
  const cat = reglas.CATALOGO.filter((x) => x.g === 'f_guaya')[0];
  if (cat && !cat.lim) { cat.lim = Object.assign({}, LIM); cat.live = 1; cat.dur = 40; }      // sustituto en memoria hasta que exista la línea real del catálogo
  if (!LIVE.get('f_guaya')) require(SRC);
  return { LIVE, reglas, DEF: LIVE.get('f_guaya'), CAT: cat };
}
const K = cargar();

function sim(lv, seed, o) {
  o = o || {};
  return K.LIVE.sim('f_guaya', { tipo: '1v3', solo: o.solo || 'a', seed, lv, dur: o.dur, skill: o.skill == null ? 0.6 : o.skill, cpuNivel: o.cpuNivel });
}
/* % de victorias del solo con las 4 CPU de la misma habilidad */
function medir(o) {
  o = o || {};
  const N = o.N || +process.env.N || 200, lv = o.lv || 1, S0 = o.S0 || +process.env.S0 || 0;
  let w = 0, tt = 0, cr = 0, ca = 0, fr = 0, sa = 0, sh = 0; const h = [0, 0, 0, 0];
  for (let seed = S0 + 1; seed <= S0 + N; seed++) {
    const r = sim(lv, seed, o);
    if (r.ganaLado === 'solo') w++;
    const v = r.vista; tt += r.kk / 30; cr += v.cruzaron; ca += v.caidas; h[Math.min(3, v.cruzaron)]++;
    fr += v.fresas.reduce((a, b) => a + b, 0); sa += v.saltos.reduce((a, b) => a + b, 0); sh += v.shakes.length;
  }
  return { win: w / N, n: N, t: tt / N, cruzan: cr / N, caidas: ca / N, fresas: fr / N, saltos: sa / N, cabinas: sh / N, h };
}
const pct = (x) => (x * 100).toFixed(1).padStart(5) + ' %';
const dentro = (x) => x >= LO && x <= HI;

function balance() {
  console.log('f_guaya · balance del solo (4 CPU de igual habilidad, ' + (+process.env.N || 200) + ' semillas; objetivo ' + LO * 100 + '-' + HI * 100 + ' %)');
  console.log('  perilla: SUBE=' + JSON.stringify(K.DEF.perilla.SUBE));
  let todoOk = true;
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (const sk of [0.35, 0.6, 0.85]) {
      const r = medir({ lv, skill: sk });
      fila.push('skill ' + sk + ': ' + pct(r.win) + (sk === 0.6 ? (dentro(r.win) ? ' ok ' : ' FUERA') : '      ') + ' (fin ' + r.t.toFixed(1) + ' s, cruzan ' + r.cruzan.toFixed(2) + ', caídas ' + r.caidas.toFixed(1) + ', cabinas ' + r.cabinas.toFixed(0) + ', saltos ' + r.saltos.toFixed(0) + ', fresas ' + r.fresas.toFixed(0) + ')');
      if (sk === 0.6 && !dentro(r.win)) todoOk = false;
    }
    console.log('  lv' + lv + '  ' + fila.join('   '));
  }
  console.log(todoOk ? 'OK: skill .6 dentro de rango en los 3 niveles (.35 y .85 son informativos)' : 'FUERA DE RANGO: afina PERILLA.SUBE');
  return todoOk;
}
function sweep() {
  const orig = K.DEF.perilla.SUBE.slice();
  console.log('f_guaya · barrido de SUBE por nivel (skill .6, ' + (+process.env.N || 200) + ' semillas por celda)');
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (let a = orig[lv - 1] - 0.06; a <= orig[lv - 1] + 0.0601; a += 0.02) {
      K.DEF.perilla.SUBE[lv - 1] = a; const r = medir({ lv });
      fila.push(a.toFixed(2) + ':' + pct(r.win).trim() + (dentro(r.win) ? '*' : ''));
    }
    K.DEF.perilla.SUBE[lv - 1] = orig[lv - 1];
    console.log('  lv' + lv + '  ' + fila.join('  '));
  }
}

module.exports = { cargar, sim, medir, K, LO, HI, LIM };
if (require.main === module) {
  if (process.argv.includes('--sweep')) sweep();
  else process.exit(balance() ? 0 : 1);
}
