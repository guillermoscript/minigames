'use strict';
/* ISLA DE MARGARITA · tablero v0 (calco de Yoshi's Tropical Island, MP1). Diseño: docs/mario-party/12-tablero-margarita.md
   Dos islas (Oriente y Macanao) en circuito, dos cruces de un sentido con peaje (La Restinga y la lancha), la señora de las
   empanadas vende la Empanada de Oro y el Bachaquero cobra en la otra isla; los peñeros (Evento) las cambian de isla.
   Tú vs 3 CPU en la misma pantalla. Minijuego de 4 al final de la ronda (fiesta-juego-* en iframe, ?embed=1) y microjuego de
   campaña en las casillas M (jugar.html). Parámetros: ?turnos=N  ?sinmj=1 (minijuegos simulados)  ?cpu=1 (los 4 son CPU). */
(function () {
const Q = new URLSearchParams(location.search);
const TURNOS = Math.max(1, Math.min(30, +Q.get('turnos') || 10));
const SIN_MJ = Q.get('sinmj') === '1', TODO_CPU = Q.get('cpu') === '1';
const { nodos, J, PEAJES, PUESTOS, ISLAS, COCHE, NPCS } = MAPA;
/* Estado de la isla (como el día/noche de Superstars y los eventos de Super MP): hora por ronda (día, día, atardecer, noche),
   clima y vainas que duran N rondas, carnaval a mitad de partida y las 3 últimas rondas al doble. */
const CARNAVAL = TURNOS >= 4 ? Math.ceil(TURNOS / 2) : 0, FINAL = TURNOS >= 6 ? TURNOS - 2 : TURNOS + 1;
const E = { hora: 'dia', lluvia: 0, leva: 0, turistas: 0, apagon: false, obras: { O: false, W: false }, carnaval: false, final: false, vis: { tarde: 0, noche: 0, lluvia: 0 },
  sinAgua: null, kraken: 0, sirena: null, oferta: 0, silbon: null };
const HORAS = ['dia', 'dia', 'tarde', 'noche'];
const deNoche = () => E.hora === 'noche' || E.apagon;
const lanchaCerrada = () => E.kraken ? '¡el Kraken anda suelto en la laguna!' : deNoche() ? 'de noche la lancha no sale' : E.leva ? 'hay mar de leva' : '';

/* ───────── jugadores ───────── */
const JUG = [
  { nom: 'TÚ', c: '#ffd23f', pal: { h: '#3a2414', s: '#e8b48a', e: '#14101c', k: '#e8b48a', c: '#ffd23f', p: '#2a4a8a', z: '#14101c' } },
  { nom: 'MAMÁ', c: '#ff6fa8', pal: { h: '#2a1a14', s: '#c98a5a', e: '#14101c', k: '#d26a6a', c: '#ff6fa8', p: '#6a3a5a', z: '#14101c' } },
  { nom: 'ABUELA', c: '#b88aff', pal: { h: '#eeeeee', s: '#d8a070', e: '#14101c', k: '#d8a070', c: '#8a5ad2', p: '#4a3a6a', z: '#14101c' } },
  { nom: 'PANA', c: '#5cd27a', pal: { h: '#2a6a3a', s: '#8a5a3a', e: '#14101c', k: '#8a5a3a', c: '#3aa860', p: '#2a3a5a', z: '#14101c' } }
].map((j, i) => Object.assign(j, {
  i, cpu: TODO_CPU || i > 0, reales: 10, emp: 0, items: [], en: J.POR.id, x: 0, y: 0, z: 0, pierde: false, color: 'azul', pimpinas: 0,
  bono: { mj: 0, max: 10, ev: 0 }
}));
JUG.forEach((j) => { const n = nodos[j.en]; j.x = n.x; j.y = n.y; });
const S = { ritmo: 1, turno: 1, activo: 0, senora: 'O', bacha: 'W', dado: null, flechas: null, bote: null, puff: null, fin: false, confeti: [], foco: null, bolsas: [], san: 0, cofre: null };

/* ───────── objetos (como los de Mario Party: dado doble/triple, dado a medida, llave, bloque de cambio, tubo dorado) ───────── */
const ITEMS = {
  cafe: { nom: '☕ CAFECITO', ico: '☕', txt: 'tiras 2 dados', precio: 6 },
  guarapo: { nom: '🥤 GUARAPO', ico: '🥤', txt: 'tiras 3 dados', precio: 12 },
  trucado: { nom: '🎲 DADO TRUCADO', ico: '🎯', txt: 'eliges el número (1–10)', precio: 8 },
  palanca: { nom: '🤝 PALANCA', ico: '🤝', txt: 'pasas un peaje gratis', precio: 5 },
  colearse: { nom: '🔀 COLEARSE', ico: '🔀', txt: 'cambias de puesto con un rival al azar', precio: 10 },
  mototaxi: { nom: '🛵 MOTOTAXI', ico: '🛵', txt: 'te lleva directo a las empanadas', precio: 22 }
};
const ITEM_IDS = Object.keys(ITEMS);
const LLENO = 3;

/* ───────── tiempo, tweens, velocidad ───────── */
let VEL = 1;
const tweens = [];
let ultimoTween = null, saltable = null;
function tween(d, f) { return new Promise((r) => { ultimoTween = { t: 0, d, f, r }; tweens.push(ultimoTween); }); }
const espera = (s) => tween(s, () => {});
document.getElementById('vel').onclick = (e) => { VEL = VEL === 1 ? 2 : VEL === 2 ? 4 : 1; e.target.textContent = 'x' + VEL; e.target.blur(); };

/* ───────── sonido ───────── */
let AC = null;
function snd(f, d, ty, v) {
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain();
    o.type = ty || 'square'; o.frequency.value = f; g.gain.setValueAtTime(v || .05, AC.currentTime); g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + d);
    o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + d); } catch (e) {}
}
const sfx = {
  paso: () => snd(520 + R() * 60, .06, 'square', .03), bien: () => [660, 880].forEach((f, i) => setTimeout(() => snd(f, .12), i * 70)),
  mal: () => snd(220, .25, 'sawtooth', .05), dado: () => snd(900 + R() * 300, .03, 'square', .02),
  gana: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => snd(f, .16), i * 80)), plata: () => snd(1320, .08, 'square', .04)
};

/* ───────── HUD y mensajes (DOM) ───────── */
const hud = document.getElementById('hud'), msg = document.getElementById('msg'), msgT = msg.querySelector('.t'), msgB = msg.querySelector('.bt'), turnoEl = document.getElementById('turno');
function pintarHud() {
  hud.innerHTML = JUG.map((j) => `<div class="pj${j.i === S.activo && !S.fin ? ' on' : ''}" style="--c:${j.c}"><b>${j.nom}</b>${j.cpu ? '' : ' ★'}<br>🥟 ${j.emp} · ${j.reales}<span style="font-size:.7em"> Bs</span> <span class="it">${j.items.map((k) => ITEMS[k].ico).join('')}</span>${j.pierde ? '<span class="x">😵</span>' : ''}</div>`).join('');
  if (S.fin) { turnoEl.textContent = 'FIN DE LA PARTIDA'; return; }
  const ch = [`TURNO ${S.turno}/${TURNOS}`, E.apagon ? '⚡ APAGÓN' : E.hora === 'dia' ? '☀️ DÍA' : E.hora === 'tarde' ? '🌅 ATARDECER' : '🌙 NOCHE'];
  if (E.lluvia) ch.push('🌧️ AGUACERO ' + E.lluvia); if (E.leva) ch.push('🌊 MAR DE LEVA ' + E.leva); if (E.turistas) ch.push('📸 TURISTAS ' + E.turistas);
  if (E.obras.O) ch.push('🚧 OBRAS ORIENTE'); if (E.obras.W) ch.push('🚧 OBRAS MACANAO');
  if (E.carnaval) ch.push('🎉 CARNAVAL'); if (E.final) ch.push('🔥 TODO AL DOBLE');
  if (S.senora) ch.push('🥟 EN ' + ISLAS[S.senora].nom);
  if (S.san) ch.push('🏦 SAN ' + S.san + ' Bs');
  if (E.sinAgua) ch.push('💧 SIN AGUA EN ' + ISLAS[E.sinAgua.k].nom); if (E.kraken) ch.push('🐙 KRAKEN ' + E.kraken); if (E.sirena) ch.push('🧜 SIRENA');
  if (E.oferta) ch.push('🛍️ OFERTA ' + E.oferta); if (E.silbon !== null) ch.push('👻 EL SILBÓN');
  const sec = MAPA.SECRETOS.filter((q) => q.hallado).length; if (sec) ch.push(`🔍 ${sec}/${MAPA.SECRETOS.length}`);
  turnoEl.textContent = ch.join(' · ');
}
let teclas = null;
function preguntar(txt, botones, cpu, elegida) {
  msg.style.display = 'block'; msgT.textContent = txt; msgB.innerHTML = ''; pintarHud();
  if (cpu || !botones || !botones.length) {
    const w = espera((cpu ? 1.1 : 1.3) * S.ritmo); saltable = ultimoTween;
    return w.then(() => (botones && botones.length ? (elegida !== undefined ? elegida : botones[0].v) : null));
  }
  return new Promise((res) => {
    const fin = (v) => { teclas = null; msgB.innerHTML = ''; res(v); };
    botones.forEach((b, k) => {
      const el = document.createElement('button'); el.textContent = b.l; if (b.cls) el.className = b.cls;
      el.onclick = () => fin(b.v); msgB.appendChild(el);
    });
    teclas = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') { fin(botones[0].v); return; }
      const d = /^Digit(\d)$/.exec(e.code); if (d && botones[+d[1] - 1]) fin(botones[+d[1] - 1].v);
      if (e.code === 'ArrowLeft' && botones[0]) fin(botones[0].v);
      if (e.code === 'ArrowRight' && botones[1]) fin(botones[1].v);
    };
  });
}
const decir = (txt, s) => { msg.style.display = 'block'; msgT.textContent = txt; msgB.innerHTML = ''; pintarHud(); const w = espera((s || 1.3) * S.ritmo); saltable = ultimoTween; return w; };
/* Espacio, Enter o tocar el mensaje adelanta el texto que está esperando */
function adelantar() { if (!teclas && saltable && saltable.t < saltable.d) saltable.t = saltable.d; }
document.getElementById('msgbox').addEventListener('click', adelantar);
const callar = () => { msg.style.display = 'none'; };
addEventListener('keydown', (e) => { if (teclas && !e.repeat) { e.preventDefault(); teclas(e); } else if (!teclas && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); adelantar(); } });

/* ───────── movimiento ───────── */
function puntoDe(j, n) {
  const aqui = JUG.filter((o) => o !== j && o.en === n.id && !o.anda), k = aqui.length;
  const off = [[0, 0], [-6, 2], [6, 2], [0, 5]][k] || [0, 0];
  return { x: n.x + off[0], y: n.y + off[1] };
}
function salto(j, a) {
  const x0 = j.x, y0 = j.y, n = nodos[a], p = puntoDe(j, n);
  j.anda = true; sfx.paso();
  return tween(.16, (k) => { j.x = x0 + (p.x - x0) * k; j.y = y0 + (p.y - y0) * k; j.z = Math.sin(k * Math.PI) * 7; })
    .then(() => { j.en = a; j.z = 0; j.anda = false; });
}
function acomodar() { JUG.forEach((j) => { if (!j.anda) { const p = puntoDe(j, nodos[j.en]); j.x = p.x; j.y = p.y; } }); }
const nomIsla = (k) => ISLAS[k].nom;
const islaDe = (j) => { const n = nodos[j.en]; return n.isla === 'X' ? (n.cruce === 'lancha' ? 'W' : 'O') : n.isla; };
function plata(j, d) {
  const antes = j.reales; j.reales = Math.max(0, j.reales + d); j.bono.max = Math.max(j.bono.max, j.reales);
  if (d > 0) sfx.plata(); else if (d < 0) sfx.mal();
  pintarHud(); return j.reales - antes;
}

async function tirar(j, dados, yaPregunto) {
  dados = dados || 1; S.foco = j;
  const max = E.lluvia ? 6 : 10;
  S.dado = { j, n: ri(1, max), gira: true };
  const t = setInterval(() => { if (S.dado && S.dado.gira) { S.dado.n = ri(1, max); sfx.dado(); } }, 60);
  if (!yaPregunto) await preguntar(j.cpu ? `${j.nom} tira el dado…` : `¡Tu turno! Tira el dado (1–${max})${E.lluvia ? ' · con el aguacero se va más lento' : ''}`, [{ l: '🎲 TIRAR', v: 1 }], j.cpu);
  else await espera(.5);
  let total = 0; const sale = [];
  for (let k = 0; k < dados; k++) {
    const n = ri(1, max); sale.push(n); total += n;
    if (dados > 1) { S.dado.n = n; S.dado.gira = false; snd(1000 + k * 200, .1); await decir(`${j.nom}: ${sale.join(' + ')}${k === dados - 1 ? ' = ' + total : ''}`, .55); if (k < dados - 1) { S.dado.gira = true; await espera(.25); } }
  }
  clearInterval(t); S.dado.n = total; S.dado.gira = false; snd(1200, .1);
  callar(); await espera(.4);
  return total;
}

async function mover(j, pasos) {
  while (pasos > 0) {
    const n = nodos[j.en];
    let a = n.next[0];
    if (n.next.length > 1) a = await bifurcacion(j, n, pasos);
    await salto(j, a); pasos--; S.dado.n = pasos;
    const m = nodos[j.en];
    S.dado.oculto = true;
    const bolsa = S.bolsas.find((b) => b.nodo === m.id);
    if (bolsa) { S.bolsas.splice(S.bolsas.indexOf(bolsa), 1); plata(j, bolsa.v); lluvia(m.x, m.y - 6); await decir(bolsa.cofre ? `🏴‍☠️ ¡${j.nom} encontró el COFRE PIRATA! +${bolsa.v} Bs` : `💼 ¡${j.nom} se encontró la cartera! +${bolsa.v} Bs`, 1.1); }
    if (PUESTOS.O.nodo === m.id || PUESTOS.W.nodo === m.id) await puesto(j, PUESTOS.O.nodo === m.id ? 'O' : 'W');
    if (m.lugar === 'bodega') await bodega(j);
    else if (m.lugar === 'picaro') await picaro(j);
    else if (m.lugar === 'perla') await perlero(j);
    else if (m.lugar === 'san') await san(j, pasos === 0);
    else if (m.lugar === 'sambil') await rifa(j);
    else if (m.lugar === 'canon' && await canon(j)) pasos = 0;
    else if (m.lugar === 'monos') await monos(j);
    else if (m.lugar === 'matasiete') await matasiete(j);
    else if (m.lugar === 'calabozo') { if (pasos === 0) await calabozo(j); else if (!j.cpu) toast('📜 ' + MAPA.HISTORIA.santarosa); }
    if (E.silbon === j.en) await silbonAtrapa(j);
    if (E.sirena && E.sirena.nodo === j.en && !E.sirena.vistos.includes(j)) await sirenaCanta(j);
    callar(); S.dado.oculto = false;
  }
  S.dado = null; acomodar();
}

async function bifurcacion(j, n, pasos) {
  if (n.ramas && n.ramas[1].costo) return ferry(j, n);
  if (!n.peaje) return desvio(j, n, pasos);
  const P = n.peaje, sigue = n.next[0], cruza = n.next[1];
  if (P.id === 'lancha' && lanchaCerrada()) {
    S.flechas = [nodos[sigue]];
    await preguntar(`⛔ LA LANCHA: ${lanchaCerrada()}. ${j.cpu ? j.nom + ' sigue' : 'Sigues'} por ${nomIsla(P.de)}.`, null, j.cpu);
    S.flechas = null; callar(); return sigue;
  }
  const otra = P.a, quiere = S.senora === otra;
  S.flechas = [nodos[sigue], nodos[cruza]];
  let v;
  if (j.reales < feeDe(P)) {
    await preguntar(`${P.nom}: el Fiscal cobra mínimo ${feeDe(P)} Bs.\n${j.cpu ? j.nom + ' no tiene' : 'No te alcanza'}: sigue por ${nomIsla(P.de)}.`, null, j.cpu);
    v = sigue;
  } else if (j.cpu) {
    const ok = quiere ? j.reales >= feeDe(P) : j.reales >= feeDe(P) + 25 && R() < .25;
    v = await preguntar(`${j.nom} llega al cruce de ${P.nom}…`, [{ l: '', v: sigue }], true, ok ? cruza : sigue);
    if (v === cruza) await pagarPeaje(j, P);
  } else {
    v = await preguntar(`Cruce: ${P.nom} → ${nomIsla(otra)}.\nLas empanadas están en ${nomIsla(S.senora)}. Peaje mínimo: ${feeDe(P)} Bs${deNoche() && P.id === 'restinga' ? ' (tarifa nocturna)' : ''}.`,
      [{ l: '⬅ SEGUIR EN ' + nomIsla(P.de), v: sigue, cls: 'alt' }, { l: 'CRUZAR ➡ (' + feeDe(P) + '+ Bs)', v: cruza }]);
    if (v === cruza && !(await pagarPeaje(j, P))) v = sigue;
  }
  S.flechas = null; callar();
  return v;
}
/* el muelle de El Yaque: seguir o tomar el ferry a Coche (isla de la suerte) */
async function ferry(j, n) {
  const sigue = n.next[0], va = n.next[1], c = n.ramas[1].costo;
  S.flechas = [nodos[sigue], nodos[va]];
  let v;
  if (E.kraken) { await preguntar(`🐙 El ferry no sale: ¡el Kraken anda suelto!`, null, j.cpu); v = sigue; }
  else if (j.reales < c) v = sigue;
  else if (j.cpu) v = await preguntar(`${j.nom} está en el muelle…`, [{ l: '', v: sigue }], true, R() < .35 ? va : sigue);
  else v = await preguntar(`⛴️ EL MUELLE DE EL YAQUE: ¿tomas el ferry a COCHE por ${c} Bs?\nCoche está lleno de casillas de suerte 🎁 y vive el Perlero. Te deja en Punta de Piedras.`,
    [{ l: '⬅ SEGUIR POR TIERRA', v: sigue, cls: 'alt' }, { l: '⛴️ FERRY (' + c + ' Bs) ➡', v: va }]);
  if (v === va) { plata(j, -c); await decir(`⛴️ ${j.nom} se monta en el ferry a Coche.`, .9); }
  S.flechas = null; callar();
  return v;
}
/* bifurcación sin peaje: la costa (larga, pasa por la venta) o el atajo (corto, con más casillas rojas y apagones) */
async function desvio(j, n, pasos) {
  const costa = n.next[0], atajo = n.next[1], k = n.isla, venta = S.senora === k ? PUESTOS[k].lugar : null;
  if (E.obras[k]) {
    S.flechas = [nodos[costa]];
    await preguntar(`🚧 ${n.ramas[1].nom}: cerrado por obras. ${j.cpu ? j.nom + ' va' : 'Vas'} por la costa.`, null, j.cpu);
    S.flechas = null; callar(); return costa;
  }
  S.flechas = [nodos[costa], nodos[atajo]];
  let v;
  if (j.cpu) {
    const ok = venta ? j.reales >= 14 || R() < .3 : R() < .25;
    v = await preguntar(`${j.nom} llega al desvío…`, [{ l: '', v: costa }], true, ok ? costa : atajo);
  } else {
    v = await preguntar(`¿Por dónde?\n${venta ? 'La señora de las empanadas está en ' + venta + ', por la costa.' : 'Por la costa no hay empanadas ahorita.'} El atajo es más corto, pero tiene más rojas y apagones.`,
      [{ l: '⬅ ' + n.ramas[0].nom, v: costa, cls: 'alt' }, { l: n.ramas[1].nom + ' ➡', v: atajo }]);
  }
  S.flechas = null; callar();
  return v;
}
const feeDe = (P) => (P.id === 'restinga' && deNoche() ? Math.min(50, P.fee * 2) : P.fee);
async function pagarPeaje(j, P) {
  if (j.items.includes('palanca')) {
    const usa = await preguntar(j.cpu ? `${j.nom} saca su PALANCA… 🤝` : `🤝 Tienes una PALANCA: ¿pasas gratis? (el peaje no cambia)`, [{ l: '🤝 USAR PALANCA', v: 1 }, { l: 'PAGAR', v: 0, cls: 'alt' }], j.cpu, 1);
    if (usa) { quitar(j, 'palanca'); await decir(`El Fiscal: «Ah, ¿usted es amigo del jefe? Pase, pase.» ${j.nom} cruza GRATIS.`, 1.4); return true; }
  }
  const tope = Math.min(j.reales, 50), fee = feeDe(P);
  let monto = fee;
  if (j.cpu) {
    if (R() < .3 && tope > fee + 2) monto = fee + ri(1, Math.min(4, tope - fee));
    await preguntar(`El Fiscal: «¿Cuánto es la colaboración?»\n${j.nom} paga ${monto} Bs. El peaje queda en ${monto}.`, null, true);
  } else {
    for (;;) {
      const v = await preguntar(`El Fiscal: «¿Cuánto es la colaboración?»\nMínimo ${fee} Bs${deNoche() && P.id === 'restinga' ? ' (tarifa nocturna)' : ''}. Lo que pagues queda como nuevo peaje.\nOfreces: ${monto} Bs`,
        [{ l: 'PAGAR ' + monto, v: 'ok' }, { l: '−', v: -1, cls: 'alt' }, { l: '+', v: 1, cls: 'alt' }, { l: '+5', v: 5, cls: 'alt' }, { l: 'MEJOR NO', v: 'no', cls: 'no' }]);
      if (v === 'ok') break;
      if (v === 'no') return false;
      monto = clamp(monto + v, fee, tope);
    }
  }
  plata(j, -monto); P.fee = P.id === 'restinga' && deNoche() ? Math.max(1, Math.round(monto / 2)) : monto;   // de noche pagas el doble, el peaje base sube a la mitad de lo pagado
  return true;
}

async function puesto(j, k) {
  if (S.senora === k) {
    if (j.reales < 20) { await preguntar(`La señora de las empanadas: «La de oro cuesta 20 Bs, mi amor».\n${j.cpu ? j.nom + ' no tiene' : 'No te alcanza'} (${j.reales} Bs).`, null, j.cpu); return; }
    const v = await preguntar(j.cpu ? `${j.nom} compra la Empanada de Oro…` : '¿Compras la EMPANADA DE ORO por 20 Bs?', [{ l: '🥟 ¡SÍ!', v: 1 }, { l: 'NO', v: 0, cls: 'no' }], j.cpu, 1);
    if (v) { plata(j, -20); j.emp++; sfx.gana(); lluvia(PUESTOS[k].x, PUESTOS[k].y); await decir(`¡${j.nom} consiguió una EMPANADA DE ORO! 🥟`, 1.6); }
  } else {
    const cobra = Math.min(30, j.reales);
    await preguntar(`El Bachaquero: «¡Epa! Pimpina de gasolina, buenísima, 30 Bs». No es opcional.`, null, j.cpu);
    plata(j, -cobra); j.pimpinas++;
    await decir(cobra ? `${j.nom} paga ${cobra} Bs por una pimpina… que no sirve.` : `${j.nom} no tenía ni un real. El Bachaquero se va bravo.`, 1.4);
  }
  callar();
}

/* ───────── casillas ───────── */
async function caer(j) {
  const n = nodos[j.en], t = n.t;
  j.color = t === 'B' ? 'azul' : t === 'R' || t === 'A' ? 'rojo' : pick(['azul', 'rojo']);
  const x2 = (E.carnaval ? 2 : 1) * (E.final ? 2 : 1);
  if ((t === 'B' || t === 'R') && R() < .06) await tesoro(j, n);
  if (t === 'B') {
    if (E.sinAgua && islaDe(j) === E.sinAgua.k) { await decir(`💧 ${j.nom}: no hay agua en ${nomIsla(E.sinAgua.k)}, todo está cerrado… +0 Bs`, .9); callar(); return; }
    const v = (3 + (E.turistas ? 2 : 0)) * x2; plata(j, v);
    await decir(`${j.nom}: ${E.turistas ? '¡un turista te dio propina!' : E.carnaval ? '¡te cayó plata en la comparsa!' : '¡te encontraste un billete!'} +${v} Bs`, .9);
  } else if (t === 'R') {
    const d = plata(j, -(E.lluvia ? 6 : 3) * (E.final ? 2 : 1));
    await decir(`${j.nom}: ${E.lluvia ? 'te agarró el aguacero y se te mojaron los billetes.' : 'se te cayó en la arena.'} ${d} Bs`, .9);
  } else if (t === 'V') await vaina(j);
  else if (t === 'I') await suerte(j);
  else if (t === 'D') await bronca(j);
  else if (t === 'S') { /* el san ya cobró/pagó al llegar */ }
  else if (t === 'E') { j.bono.ev++; await penero(j); }
  else if (t === 'T') { j.bono.ev++; await triple(j); }
  else if (t === 'M') await micro(j);
  else if (t === 'H') {
    if (R() < .7) { await decir(`${j.nom}: ¡una MALTA bien fría! Tira otra vez.`, 1.2); const p = await tirar(j); await mover(j, p); await caer(j); return; }
    j.pierde = true; sfx.mal(); await decir(`${j.nom}: pescado pasado… 🤢 Pierde el próximo turno.`, 1.4);
  } else if (t === 'A') {
    j.bono.ev++; const d = plata(j, -ri(5, 15));
    await decir(`¡APAGÓN! ⚡ Se dañó la nevera de ${j.nom}. ${d} Bs`, 1.5);
  }
  callar();
}
/* ───────── objetos: dar, quitar, usar ───────── */
function darItem(j, k) { if (j.items.length >= LLENO) return false; j.items.push(k); pintarHud(); return true; }
function quitar(j, k) { const i = j.items.indexOf(k); if (i >= 0) j.items.splice(i, 1); pintarHud(); }
function distancia(de, a) {   // pasos mínimos siguiendo el tablero (BFS)
  const vis = { [de]: 0 }, cola = [de];
  while (cola.length) { const n = cola.shift(); if (n === a) return vis[n]; for (const m of nodos[n].next) if (vis[m] === undefined && vis[n] < 60) { vis[m] = vis[n] + 1; cola.push(m); } }
  return 99;
}
const distVenta = (j) => (S.senora ? distancia(j.en, PUESTOS[S.senora].nodo) : 99);
function itemCPU(j) {
  const d = distVenta(j), has = (k) => j.items.includes(k), plataOk = j.reales >= 20;
  if (has('mototaxi') && plataOk && d > 6) return 'mototaxi';
  if (has('trucado') && plataOk && d >= 1 && d <= 10) return 'trucado';
  if (has('colearse') && JUG.some((o) => o !== j && distVenta(o) + 8 < d)) return 'colearse';
  if (has('guarapo') && (plataOk || R() < .4)) return 'guarapo';
  if (has('cafe') && (plataOk || R() < .4)) return 'cafe';
  return null;
}
async function turnoJugador(j) {
  S.foco = j;
  const usables = j.items.filter((k) => k !== 'palanca');
  let k = null;
  if (j.cpu) k = itemCPU(j);
  else if (usables.length) {
    const max = E.lluvia ? 6 : 10;
    k = await preguntar(`¡Tu turno! Tira el dado (1–${max}) o usa algo de tu bolsillo:\n${usables.map((x) => ITEMS[x].nom + ': ' + ITEMS[x].txt).join(' · ')}`,
      [{ l: '🎲 TIRAR', v: null }].concat(usables.map((x) => ({ l: ITEMS[x].nom, v: x, cls: 'alt' }))));
  }
  if (k) { quitar(j, k); sfx.bien(); await decir(`${j.nom} usa ${ITEMS[k].nom}!`, .9); }
  if (k === 'mototaxi') return mototaxi(j);
  if (k === 'colearse') await colearse(j);
  let p;
  if (k === 'trucado') {
    const d = distVenta(j);
    p = j.cpu ? clamp(d, 1, 10) : await preguntar('🎯 DADO TRUCADO: ¿cuántos pasos?', Array.from({ length: 10 }, (_, i) => ({ l: String(i + 1), v: i + 1, cls: 'alt' })));
    S.dado = { j, n: p, gira: false }; callar(); await espera(.4);
  } else p = await tirar(j, k === 'guarapo' ? 3 : k === 'cafe' ? 2 : 1, !j.cpu && usables.length > 0);
  await mover(j, p);
  await caer(j);
}
async function mototaxi(j) {
  if (!S.senora) return;
  const P = PUESTOS[S.senora], n = nodos[P.nodo], x0 = j.x, y0 = j.y;
  j.anda = true; S.foco = j; snd(180, .6, 'sawtooth', .04);
  await tween(1.4, (k) => { j.x = x0 + (n.x - x0) * k; j.y = y0 + (n.y - y0) * k; j.z = Math.sin(k * Math.PI) * 30; });
  j.en = n.id; j.z = 0; j.anda = false; acomodar();
  await decir(`🛵 «¡Llegamos, pana!» ${j.nom} está en ${P.lugar}.`, 1);
  await puesto(j, S.senora);
}
async function colearse(j) {
  const o = pick(JUG.filter((x) => x !== j)), a = j.en, b = o.en;
  S.puff = { x: j.x, y: j.y - 4, t: 0 };
  j.en = b; o.en = a; acomodar(); sfx.bien();
  S.puff = { x: j.x, y: j.y - 4, t: 0 };
  await decir(`🔀 ¡${j.nom} se coleó! Cambia de puesto con ${o.nom}.`, 1.4);
}
async function suerte(j) {
  const k = pick(ITEM_IDS);
  sfx.gana(); lluvia(j.x, j.y - 8);
  if (darItem(j, k)) await decir(`🎁 ¡QUÉ SUERTE! ${j.nom} recibe ${ITEMS[k].nom} (${ITEMS[k].txt}).`, 1.5);
  else { plata(j, 5); await decir(`🎁 ¡QUÉ SUERTE! Pero ${j.nom} tiene los bolsillos llenos: +5 Bs.`, 1.3); }
}
async function tesoro(j, n) {
  S.cofre = { x: n.x, y: n.y - 8, t: 0 }; sfx.gana();
  await decir(`✨ ¡${j.nom} escarbó en la arena y salió un COFRE ESCONDIDO!`, 1.1);
  if (R() < .2) { j.emp++; lluvia(n.x, n.y - 10); await decir(`🥟 ¡Adentro había una EMPANADA DE ORO! ¡Qué suerte, ${j.nom}!`, 1.8); }
  else if (R() < .5 && darItem(j, pick(ITEM_IDS))) await decir(`Adentro había ${ITEMS[j.items[j.items.length - 1]].nom}.`, 1.3);
  else { const v = 15 * (E.final ? 2 : 1); plata(j, v); await decir(`Adentro había ${v} Bs. 💰`, 1.2); }
  S.cofre = null;
}

/* ───────── personajes: la bodega, el san, el pícaro, el perlero ───────── */
async function bodega(j) {
  const N = NPCS.find((x) => x.nodo === j.en); MAPA.burbuja('¡PASE, AMIGO!', N.x, N.y - 10);
  if (j.items.length >= LLENO) { await decir(`🏪 El Portu: «¡${j.nom}, ya no te cabe nada en los bolsillos!»`, .9); return; }
  const precio = (k) => (E.oferta ? Math.ceil(ITEMS[k].precio / 2) : ITEMS[k].precio);
  const ofertas = ITEM_IDS.filter((k) => precio(k) <= j.reales);
  if (!ofertas.length) { await decir(`🏪 El Portu: «¡Fiado no, ${j.nom}!» (no te alcanza)`, .9); return; }
  let k;
  if (j.cpu) {
    const quiere = ofertas.filter((x) => j.reales - precio(x) >= 20);
    k = quiere.length && R() < .6 ? (quiere.includes('mototaxi') && R() < .4 ? 'mototaxi' : pick(quiere)) : null;
    await preguntar(`🏪 ${j.nom} entra a LA BODEGA DEL PORTU…`, null, true);
  } else {
    k = await preguntar(`🏪 LA BODEGA DEL PORTU: «¿Qué te llevas, amigo?» (tienes ${j.reales} Bs, ${LLENO - j.items.length} espacios)`,
      ofertas.map((x) => ({ l: `${ITEMS[x].nom} ${precio(x)}${E.oferta ? '🏷️' : ''}`, v: x, cls: 'alt' })).concat([{ l: 'NADA, GRACIAS', v: null, cls: 'no' }]));
  }
  if (k) { plata(j, -precio(k)); darItem(j, k); sfx.bien(); await decir(`${j.nom} compra ${ITEMS[k].nom} (${ITEMS[k].txt}).`, 1.2); }
  else if (j.cpu) await decir(`${j.nom} no compra nada.`, .6);
}
async function san(j, cae) {
  const N = NPCS.find((x) => x.nodo === j.en);
  if (cae) {
    if (!S.san) { await decir(`🏦 EL SAN: ${j.nom} cae en el san… ¡pero el pote está vacío!`, 1.1); return; }
    const v = S.san; S.san = 0; plata(j, v); lluvia(N.x, N.y - 6); sfx.gana();
    await decir(`🏦 ¡LE TOCÓ EL SAN A ${j.nom}! Se lleva todo el pote: +${v} Bs`, 1.8);
  } else {
    const v = Math.min(5, j.reales); if (!v) return;
    plata(j, -v); S.san += v; MAPA.burbuja('¡PAGUE EL SAN!', N.x, N.y - 10);
    await decir(`🏦 ${j.nom} paga ${v} Bs al San. Pote: ${S.san} Bs (se lo lleva el que caiga justo aquí).`, 1.1);
  }
}
async function picaro(j) {
  const rivales = JUG.filter((o) => o !== j), conEmp = rivales.filter((o) => o.emp > 0), conPlata = rivales.filter((o) => o.reales > 0);
  let op = null, vict = null;
  if (j.cpu) {
    if (j.reales >= 35 && conEmp.length && R() < .6) { op = 'emp'; vict = conEmp.sort((a, b) => b.emp - a.emp)[0]; }
    else if (j.reales >= 15 && conPlata.length && R() < .3) { op = 'plata'; vict = conPlata.sort((a, b) => b.reales - a.reales)[0]; }
    if (!op) { await decir(`🦹 El Pícaro le susurra a ${j.nom}… pero ${j.nom} sigue de largo.`, .8); return; }
  } else {
    const ops = [];
    if (j.reales >= 5 && conPlata.length) ops.push({ l: '💸 ROBAR REALES (5 Bs)', v: 'plata', cls: 'alt' });
    if (j.reales >= 30 && conEmp.length) ops.push({ l: '🥟 ROBAR EMPANADA (30 Bs)', v: 'emp', cls: 'alt' });
    if (!ops.length) { await decir('🦹 El Pícaro: «Psst… vuelve cuando tengas plata.»', 1); return; }
    op = await preguntar('🦹 EL PÍCARO DEL PUERTO: «Psst… ¿un negocito? Yo le saco algo a quien tú me digas.»', ops.concat([{ l: 'NO, GRACIAS', v: null, cls: 'no' }]));
    if (!op) return;
    const lista = op === 'emp' ? conEmp : conPlata;
    vict = await preguntar('¿A quién?', lista.map((o) => ({ l: `${o.nom} (${op === 'emp' ? '🥟' + o.emp : o.reales + ' Bs'})`, v: o, cls: 'alt' })));
  }
  plata(j, op === 'emp' ? -30 : -5); sfx.mal();
  if (op === 'emp') { vict.emp--; j.emp++; await decir(`🦹 ¡El Pícaro le sacó una EMPANADA DE ORO a ${vict.nom} y se la dio a ${j.nom}!`, 2); }
  else { const v = Math.min(vict.reales, ri(5, 15)); plata(vict, -v); plata(j, v); await decir(`🦹 ¡El Pícaro le sacó ${v} Bs a ${vict.nom} para ${j.nom}!`, 1.6); }
}
async function perlero(j) {
  const k = pick(ITEM_IDS);
  if (darItem(j, k)) await decir(`🦪 EL PERLERO de Coche le regala a ${j.nom}: ${ITEMS[k].nom}.`, 1.3);
  else { plata(j, 8); await decir(`🦪 EL PERLERO le da a ${j.nom} una perla de Cubagua: +8 Bs.`, 1.2); }
}
/* ¡BRONCA!: duelo 1 vs 1 con apuesta (como los duelos de MP) */
const DUELOS = ['f_abuela', 'f_domino', 'f_harina', 'f_mecate'];
async function bronca(j) {
  const rivales = JUG.filter((o) => o !== j);
  const vs = j.cpu ? rivales.slice().sort((a, b) => b.reales - a.reales)[0]
    : await preguntar('⚔️ ¡BRONCA! Reta a alguien a un duelo. El que gane se lleva la apuesta.', rivales.map((o) => ({ l: `${o.nom} (${o.reales} Bs)`, v: o, cls: 'alt' })));
  const ap = Math.min(10, j.reales, vs.reales);
  if (!ap) { await decir(`⚔️ ${j.nom} reta a ${vs.nom}… pero no hay plata para apostar. ¡Quedan como panas!`, 1.4); return; }
  const g = pick(DUELOS);
  await preguntar(`⚔️ ¡BRONCA! ${j.nom} VS ${vs.nom}\nApuesta: ${ap} Bs cada uno · «${nombreMJ(g)}»`, [{ l: '¡VAMOS!', v: 1 }], j.cpu && vs.cpu || TODO_CPU);
  callar();
  const tu = !j.cpu ? j : !vs.cpu ? vs : null;
  let gana;
  if (!tu || SIN_MJ) gana = R() < .5 ? j : vs;
  else {
    const pl = await new Promise((done) => {
      const oir = (e) => { if (e.data && e.data.k === 'mj-fin') { removeEventListener('message', oir); done(e.data.pl || []); } };
      addEventListener('message', oir);
      skip.onclick = () => { removeEventListener('message', oir); done([]); };
      abrirFrame(`../style-lab/fiesta.html?practica=${g}&embed=1&tipo=1v1&ch=tu&lv=1`);
    });
    cerrarFrame();
    const otro = tu === j ? vs : j;
    gana = pl.length === 2 && pl[0] !== pl[1] ? (pl[0] === 1 ? tu : otro) : (R() < .5 ? j : vs);
  }
  const pierde = gana === j ? vs : j;
  plata(pierde, -ap); plata(gana, ap); sfx.gana();
  await decir(`⚔️ ¡${gana.nom} gana la bronca! Se lleva ${ap} Bs de ${pierde.nom}.`, 1.8);
}
/* ───────── la ruta histórica de La Asunción: los monos del Copey, el calabozo de Santa Rosa y el cerro Matasiete ───────── */
const PREV = {}; nodos.forEach((n) => n.next.forEach((m) => { (PREV[m] = PREV[m] || []).push(n.id); }));
async function monos(j) {
  const N = MAPA.NPCS.find((x) => x.k === 'monos'); MAPA.burbuja('¡UH UH AH!', N.x, N.y - 6);
  if (R() < .5) { plata(j, 3); await decir(`🐒 Un mono capuchino del Copey le regala un mango a ${j.nom}… ¡y adentro venían 3 Bs! (+3 Bs)`, 1.4); return; }
  if (j.items.length) { const k = pick(j.items); quitar(j, k); await decir(`🐒 ¡Un mono del Copey le robó ${ITEMS[k].nom} a ${j.nom} y salió corriendo pal monte!`, 1.6); }
  else { const d = plata(j, -3); await decir(`🐒 ¡Un mono del Copey le arrancó ${-d} Bs a ${j.nom}!`, 1.3); }
}
async function calabozo(j) {
  if (!j.cpu) toast('📜 ' + MAPA.HISTORIA.santarosa);
  const N = MAPA.NPCS.find((x) => x.k === 'calabozo'); MAPA.efx('texto', N.x, N.y - 10, { s: '¡AL CALABOZO!', c: '#ff8a8a' });
  const paga = j.reales >= 10 && (j.cpu ? j.reales >= 25 : await preguntar(`🏰 ¡Caíste en el CALABOZO DEL CASTILLO DE SANTA ROSA! Paga 10 Bs de fianza o pierdes tu próximo turno.`, [{ l: 'PAGAR 10 Bs', v: true }, { l: 'ME QUEDO PRESO', v: false, cls: 'no' }]));
  if (paga) { plata(j, -10); await decir(`🏰 ${j.nom} paga la fianza y sale libre.`, 1); }
  else { j.pierde = true; sfx.mal(); await decir(`🏰 ${j.nom} queda preso en Santa Rosa, como Luisa Cáceres de Arismendi. Pierde el próximo turno.`, 1.6); }
}
async function matasiete(j) {
  if (!j.cpu) toast('📜 ' + MAPA.HISTORIA.obelisco);
  const rivales = JUG.filter((o) => o !== j && !nodos[o.en].cruce);
  if (!rivales.length) return;
  const lider = rivales.slice().sort((a, b) => b.emp - a.emp || b.reales - a.reales)[0];
  const vict = j.cpu ? (R() < .7 ? lider : null)
    : await preguntar('⚔️ CERRO MATASIETE: como en 1817, ¡a pedradas! ¿A quién le lanzas piedras? Retrocede 4 casillas.', rivales.map((o) => ({ l: `${o.nom} (🥟${o.emp})`, v: o, cls: 'alt' })).concat([{ l: 'A NADIE', v: null, cls: 'no' }]));
  if (!vict) return;
  const N = MAPA.NPCS.find((x) => x.k === 'matasiete');
  const piedras = []; for (let i = 0; i < 5; i++) piedras.push({ i });
  S.foco = vict; snd(300, .3, 'square', .05);
  for (let i = 0; i < 5; i++) { MAPA.efx('coco', vict.x + ri(-6, 6), vict.y - 4); MAPA.efx('humo', vict.x, vict.y - 4, { dx: 0 }); await espera(.08); }
  void N; void piedras;
  await decir(`⚔️ ¡${j.nom} le lanza piedras a ${vict.nom} desde el Matasiete! ${vict.nom} retrocede 4 casillas.`, 1.2);
  for (let i = 0; i < 4; i++) { const p = PREV[vict.en]; if (!p) break; await salto(vict, p[0]); }
  acomodar(); S.foco = j;
}
/* ───────── el Sambil (rifa, como la lotería de MP) y el cañón de Pampatar (como los cañones de los tableros de MP) ───────── */
async function rifa(j) {
  const c = E.oferta ? 3 : 5;
  if (j.reales < c) return;
  const juega = j.cpu ? (j.reales >= 20 && R() < .5) : await preguntar(`🛍️ EL SAMBIL: ¡RIFA! Por ${c} Bs giras la ruleta: objetos, reales… ¡y hasta una EMPANADA DE ORO!`, [{ l: '🎡 JUGAR ' + c + ' Bs', v: true }, { l: 'NO', v: false, cls: 'no' }]);
  if (!juega) return;
  plata(j, -c);
  const PREMIOS = [['NADA 😅', 40], ['UN OBJETO 🎁', 30], ['15 Bs 💰', 17], ['30 Bs 💰💰', 9], ['¡EMPANADA DE ORO! 🥟', 4]];
  const tira = () => { let r = R() * 100; for (const p of PREMIOS) { r -= p[1]; if (r <= 0) return p[0]; } return PREMIOS[0][0]; };
  let sale; for (let i = 0; i < 14; i++) { sale = tira(); msg.style.display = 'block'; msgB.innerHTML = ''; msgT.textContent = `🛍️ RIFA DEL SAMBIL 🎡\n[ ${sale} ]`; sfx.dado(); await espera(.07 + i * .014); }
  const d = MAPA.DECO.find((x) => x.k === 'sambil'); if (d) d.fiesta = 1.5;
  if (sale.startsWith('UN OBJETO')) { const k = pick(ITEM_IDS); if (!darItem(j, k)) plata(j, 5); await decir(`🛍️ ${j.nom} gana ${ITEMS[k].nom} en la rifa.`, 1.2); }
  else if (sale.startsWith('15')) { plata(j, 15); await decir(`🛍️ ¡${j.nom} gana 15 Bs en la rifa!`, 1.2); }
  else if (sale.startsWith('30')) { plata(j, 30); sfx.gana(); await decir(`🛍️ ¡${j.nom} gana 30 Bs en la rifa!`, 1.4); }
  else if (sale.startsWith('¡EMPANADA')) { j.emp++; sfx.gana(); lluvia(j.x, j.y - 8); await decir(`🛍️ ¡¡${j.nom} SE GANÓ UNA EMPANADA DE ORO EN LA RIFA!! 🥟`, 2); }
  else await decir(`🛍️ ${j.nom} no ganó nada. ¡Así es la rifa!`, 1);
}
async function canon(j) {
  const monta = j.cpu ? R() < (S.senora === 'O' ? .1 : .3) : await preguntar('💣 EL CAÑÓN DE PAMPATAR: ¿te montas? Te dispara a un lugar AL AZAR del mapa (y ahí termina tu turno).', [{ l: '💣 ¡DISPARA!', v: true }, { l: 'NO, GRACIAS', v: false, cls: 'no' }]);
  if (!monta) return false;
  const N = MAPA.NPCS.find((x) => x.k === 'canon'); MAPA.efx('humo', N.x + 8, N.y - 2, { dx: 1 }); MAPA.efx('texto', N.x, N.y - 12, { s: '¡BUUM!', c: '#ff8a3d' }); snd(70, .6, 'sawtooth', .12);
  const destino = pick(nodos.filter((n) => !n.cruce && !n.ramas && !n.lugar && n.t !== 'S')), x0 = j.x, y0 = j.y;
  j.anda = true; S.foco = j;
  await tween(1.6, (k) => { j.x = x0 + (destino.x - x0) * k; j.y = y0 + (destino.y - y0) * k; j.z = Math.sin(k * Math.PI) * 70; });
  j.en = destino.id; j.z = 0; j.anda = false; acomodar(); MAPA.efx('onda', destino.x, destino.y); snd(120, .2, 'square', .08);
  await decir(`💣 ¡${j.nom} salió volando y cayó en ${MAPA.lugarCerca(destino.x, destino.y)}!`, 1.3);
  return true;
}

/* ───────── noticias de la isla (como las cartas de «Suerte» o los eventos de tablero de MP): una por ronda, a veces ───────── */
const VIS = { cist: null, krak: null, sir: null, silb: null, proc: null, pesc: null };
const POR_ISLA = (k) => JUG.filter((x) => islaDe(x) === k || (k === 'O' && nodos[x.en].isla === 'C'));
const NOTICIAS = [
  { t: '💧 ¡SE FUE EL AGUA!', ok: () => !E.sinAgua, f: async () => {
    const k = pick(['O', 'W']); E.sinAgua = { k, n: 2 };
    const T = MAPA.TRAZOS.find((x) => x.id === (k === 'O' ? 'agua' : 'arenas')); VIS.cist = CRIAT.add('cisterna', { T, u: 0, v: .03 });
    S.foco = { x: T.pts[0][0], y: T.pts[0][1] };
    await decir(`💧 ¡SE FUE EL AGUA EN ${nomIsla(k)}! Por 2 rondas las casillas azules de ${nomIsla(k)} no dan nada. Ya viene la cisterna…`, 2.2);
  } },
  { t: '🏴‍☠️ ¡PIRATAS!', ok: () => true, f: async () => {
    const k = POR_ISLA('O').length >= POR_ISLA('W').length ? 'O' : 'W', meta = k === 'O' ? { x: 430, y: 42 } : { x: 70, y: 112 };
    const b = CRIAT.add('barco', { x: k === 'O' ? 690 : -50, y: meta.y, flip: k === 'O' }); S.foco = b;
    await decir('🏴‍☠️ ¡ÚLTIMA HORA! ¡Llegan los piratas de LOPE DE AGUIRRE, el Tirano!', 1.2);
    const x0 = b.x; await tween(2.4, (q) => { b.x = x0 + (meta.x - x0) * q; });
    b.humo = 1; snd(70, .5, 'sawtooth', .1); MAPA.efx('texto', b.x, b.y - 30, { s: '¡ARRR!', c: '#ff8a3d' });
    const vict = POR_ISLA(k);
    vict.forEach((x) => plata(x, -5));
    await decir(vict.length ? `🏴‍☠️ Los piratas saquean ${nomIsla(k)}: ${vict.map((x) => x.nom).join(', ')} pierden 5 Bs cada uno.` : `🏴‍☠️ Los piratas llegan a ${nomIsla(k)}… pero no hay nadie a quien robar.`, 1.8);
    const libres = nodos.filter((n) => n.isla === k && n.t === 'B' && !n.lugar && !n.ramas);
    const n = pick(libres); S.bolsas.push({ nodo: n.id, v: 20, cofre: true }); S.foco = { x: n.x, y: n.y };
    await decir(`🏴‍☠️ Al irse, se les cayó un COFRE PIRATA cerca de ${MAPA.lugarCerca(n.x, n.y)}: ¡20 Bs para el primero que pase!`, 2);
    S.foco = b; const x1 = b.x; b.flip = !b.flip; tween(3, (q) => { b.x = x1 + (k === 'O' ? -1 : 1) * 400 * q; }).then(() => CRIAT.quitar(b));
  } },
  { t: '🐙 ¡EL KRAKEN!', ok: () => !E.kraken, f: async () => {
    E.kraken = 2; VIS.krak = CRIAT.add('kraken', { x: 258, y: 236, a: 0 }); S.foco = VIS.krak;
    snd(60, 1, 'sawtooth', .1); await tween(1.2, (q) => { VIS.krak.a = q; });
    const agua = JUG.filter((x) => nodos[x.en].cruce === 'lancha' || nodos[x.en].cruce === 'ferry');
    for (const x of agua) { const vuelta = nodos[x.en].cruce === 'lancha' ? J.PP : J.MUELLE; x.en = vuelta.id; }
    acomodar();
    await decir(`🐙 ¡SALIÓ EL KRAKEN EN LA LAGUNA! Por 2 rondas no salen ni la lancha ni el ferry.${agua.length ? ' ¡' + agua.map((x) => x.nom).join(' y ') + ' vuelve al muelle del susto!' : ''}`, 2.4);
  } },
  { t: '🧜 ¡UNA SIRENA!', ok: () => !E.sirena, f: async () => {
    const n = nodos[MAPA.SEGS.agua.ids[3]]; E.sirena = { nodo: n.id, n: 2, vistos: [] };
    VIS.sir = CRIAT.add('sirena', { x: n.x - 8, y: n.y - 20 }); S.foco = VIS.sir;
    await decir('🧜 ¡Vieron una SIRENA en Playa El Agua! El que pase por su lado se encontrará una sorpresa… (2 rondas)', 2.2);
  } },
  { t: '👽 ¡UN OVNI!', ok: () => true, f: async () => {
    const v = pick(JUG), o = CRIAT.add('ovni', { x: v.x, y: -20 }); S.foco = o;
    await decir(`👽 ¡UN OVNI SOBRE MARGARITA! Viene por… ¡${v.nom}!`, 1.2);
    await tween(1.4, (q) => { o.y = -20 + (v.y - 50 + 20) * q; });
    o.rayo = true; o.suelo = v.y; snd(400, 1.2, 'sine', .06); v.anda = true;
    const y0 = v.y; await tween(1.2, (q) => { v.z = q * 40; });
    const destino = pick(nodos.filter((n) => !n.cruce && !n.ramas && !n.lugar && n.t !== 'S')), ox = o.x, oy = o.y, vx = v.x, vy = v.y;
    o.rayo = false; S.foco = o;
    await tween(1.8, (q) => { o.x = ox + (destino.x - ox) * q; o.y = oy + (destino.y - 50 - oy) * q; v.x = vx + (destino.x - vx) * q; v.y = vy + (destino.y - vy) * q; });
    o.rayo = true; o.suelo = destino.y; await tween(.8, (q) => { v.z = 40 * (1 - q); });
    v.en = destino.id; v.z = 0; v.anda = false; o.rayo = false; acomodar(); void y0;
    await decir(`👽 El ovni dejó a ${v.nom} en ${MAPA.lugarCerca(destino.x, destino.y)}. «Bip bup.»`, 1.6);
    const oy2 = o.y; tween(1.5, (q) => { o.y = oy2 - 120 * q; }).then(() => CRIAT.quitar(o));
  } },
  { t: '🛍️ ¡OFERTA EN EL SAMBIL!', ok: () => !E.oferta, f: async () => {
    E.oferta = 2; const d = MAPA.DECO.find((x) => x.k === 'sambil'); if (d) { d.fiesta = 3; S.foco = { x: d.x + 15, y: d.y - 10 }; }
    await decir('🛍️ ¡GRAN OFERTA EN EL SAMBIL! Por 2 rondas todo a mitad de precio en las bodegas y la rifa del Sambil cuesta 3 Bs.', 2.2);
  } },
  { t: '👻 ¡EL SILBÓN!', ok: () => deNoche() && E.silbon === null, f: async () => {
    const lider = JUG.slice().sort((a, b) => b.emp - a.emp || b.reales - a.reales)[0];
    let n = nodos[lider.en]; for (let i = 0; i < ri(3, 7); i++) n = nodos[n.next[0]];
    if (n.ramas || n.lugar) n = nodos[n.next[0]];
    E.silbon = n.id; VIS.silb = CRIAT.add('silbon', { x: n.x, y: n.y }); S.foco = VIS.silb;
    for (let i = 0; i < 3; i++) { snd(1800 - i * 300, .35, 'sine', .05); await espera(.3); }
    await decir(`👻 Fiu fiu fiu… ¡EL SILBÓN anda por ${MAPA.lugarCerca(n.x, n.y)}! «Si lo oyes cerca, está lejos». El que pase por ahí pierde 10 Bs. Se va al amanecer.`, 2.6);
  } },
  { t: '🐟 ¡PESCA BUENA!', ok: () => true, f: async () => {
    VIS.pesc = CRIAT.add('peces', { x: 120, y: 318 }); S.foco = VIS.pesc;
    const g = POR_ISLA('W'); g.forEach((x) => plata(x, 5));
    await decir(`🐟 ¡Pesca buena en Boca de Río! Los pescadores reparten: ${g.length ? g.map((x) => x.nom).join(', ') + ' (en Macanao) reciben 5 Bs.' : 'pero no hay nadie en Macanao.'}`, 2);
  } },
  { t: '⛪ ¡LA VIRGEN DEL VALLE!', ok: () => true, f: async () => {
    VIS.proc = CRIAT.add('procesion', { cx: 520, cy: 236, rx: 34, ry: 18, u: 0, velas: deNoche() }); S.foco = { x: 520, y: 236 };
    JUG.forEach((x) => plata(x, 3));
    const peor = JUG.slice().sort((a, b) => a.emp - b.emp || a.reales - b.reales)[0], k = pick(ITEM_IDS); darItem(peor, k);
    await decir(`⛪ ¡Procesión de la VIRGEN DEL VALLE por Porlamar! Todos reciben 3 Bs, y ${peor.nom} (que va de último) recibe ${ITEMS[k].nom}.`, 2.4);
  } },
  { t: '⚡ ¡APAGÓN!', ok: () => !E.apagon && E.hora !== 'noche', f: async () => {
    E.apagon = true; await efectoVisual(); await decir('⚡ ¡SE FUE LA LUZ EN TODA LA ISLA! Hasta la próxima ronda es como de noche: no sale la lancha y el peaje es doble.', 2.2);
  } }
];
async function noticias() {
  // lo que se acaba
  if (E.sinAgua && !--E.sinAgua.n) { await decir(`🚛 ¡Llegó la cisterna a ${nomIsla(E.sinAgua.k)}! Volvió el agua.`, 1.3); E.sinAgua = null; CRIAT.quitar(VIS.cist); }
  if (E.kraken && !--E.kraken) { const c = VIS.krak; await tween(1, (q) => { c.a = 1 - q; }); CRIAT.quitar(c); await decir('🐙 El Kraken se hundió otra vez. La lancha y el ferry vuelven a salir.', 1.3); }
  if (E.sirena && !--E.sirena.n) { CRIAT.quitar(VIS.sir); E.sirena = null; await decir('🧜 La sirena se fue nadando.', 1); }
  if (E.oferta && !--E.oferta) await decir('🛍️ Se acabó la oferta del Sambil.', 1);
  if (E.silbon !== null && !deNoche()) { CRIAT.quitar(VIS.silb); E.silbon = null; await decir('👻 Amaneció y El Silbón se fue silbando…', 1.2); }
  if (VIS.proc) { CRIAT.quitar(VIS.proc); VIS.proc = null; }
  if (VIS.pesc) { CRIAT.quitar(VIS.pesc); VIS.pesc = null; }
  if (R() > .55) return;
  const N = pick(NOTICIAS.filter((x) => x.ok()));
  sfx.gana();
  await preguntar(`📺 ¡ÚLTIMA HORA EN MARGARITA! 📺\n${N.t}`, [{ l: '¿QUÉ PASÓ?', v: 1 }], TODO_CPU);
  await N.f(); pintarHud(); S.foco = null;
}
async function silbonAtrapa(j) {
  const c = VIS.silb; snd(1800, .5, 'sine', .06);
  const d = plata(j, -10); MAPA.efx('texto', c.x, c.y - 30, { s: 'FIU FIU', c: '#b8f0ff' });
  await decir(`👻 ¡${j.nom} se topó con EL SILBÓN! Del susto se le cayeron ${-d} Bs. El Silbón se va silbando…`, 1.8);
  CRIAT.quitar(c); E.silbon = null;
}
async function sirenaCanta(j) {
  E.sirena.vistos.push(j);
  if (R() < .6) { plata(j, 10); lluvia(VIS.sir.x, VIS.sir.y - 10); await decir(`🧜 La sirena le canta a ${j.nom} y le regala una perla: +10 Bs.`, 1.5); }
  else { const d = plata(j, -5); await decir(`🧜 ${j.nom} se quedó embobado oyendo a la sirena y se le fueron ${-d} Bs al mar.`, 1.5); }
}
/* carteras que se le caen a los turistas: aparecen en el tablero y las agarra el primero que pase */
async function soltarBolsas() {
  if (R() > .55) return;
  const libres = nodos.filter((n) => n.t === 'B' && !n.lugar && !n.ramas && !n.cruce && n.isla !== 'C' && !S.bolsas.some((b) => b.nodo === n.id) && !JUG.some((x) => x.en === n.id));
  const n = pick(libres), v = pick([5, 8, 10, 12]);
  S.bolsas.push({ nodo: n.id, v });
  S.foco = { x: n.x, y: n.y };
  await decir(`💼 ¡A un turista se le cayó la cartera cerca de ${MAPA.lugarCerca(n.x, n.y)}! El primero que pase se lleva ${v} Bs.`, 2);
  S.foco = null;
}
async function penero(j) {
  await decir(`¡ZARPÓ EL PEÑERO! 🚤 Se lleva a la señora de las empanadas a ${nomIsla(S.senora === 'O' ? 'W' : 'O')}.`, 1.2);
  const de = PUESTOS[S.senora], a = PUESTOS[S.senora === 'O' ? 'W' : 'O'];
  const via = MAPA.rutaBote(S.senora), tramos = via.length - 1;
  S.bote = { x: via[0].x, y: via[0].y, flip: a.x < de.x }; S.foco = S.bote;
  const vieja = S.senora; S.senora = null;
  S.puff = { x: a.x, y: a.y, t: 0 };
  await tween(3.2, (k) => {
    const s = k * tramos, i = Math.min(tramos - 1, Math.floor(s)), u = s - i, p = via[i], q = via[i + 1];
    S.bote.flip = q.x < p.x;
    S.bote.x = p.x + (q.x - p.x) * u; S.bote.y = p.y + (q.y - p.y) * u + Math.sin(k * 40) * .6;
  });
  S.foco = j; S.bote = null; S.senora = vieja === 'O' ? 'W' : 'O'; S.bacha = vieja; S.puff = { x: de.x, y: de.y, t: 0 };
  sfx.bien(); pintarHud();
  await decir(`Las empanadas ahora están en ${PUESTOS[S.senora].lugar} (${nomIsla(S.senora)}). El Bachaquero se mudó a ${nomIsla(S.bacha)}.`, 1.4);
}
/* ¡QUÉ VAINA!: ruleta de la isla. Cambia el estado del tablero por unas rondas. */
const VAINAS = [
  { nom: '🌧️ ¡AGUACERO!', txt: 'Llueve 2 rondas: dado de 1 a 6 y las rojas quitan 6.', f: () => { E.lluvia = 2; } },
  { nom: '🚧 ¡OBRAS!', txt: null, f: (j) => { const k = nodos[j.en].isla === 'X' ? pick(['O', 'W']) : nodos[j.en].isla; E.obras[k] = !E.obras[k]; return `El atajo de ${nomIsla(k)} ${E.obras[k] ? 'queda CERRADO por obras' : 'ya está ABIERTO otra vez'}.`; } },
  { nom: '🌊 ¡MAR DE LEVA!', txt: 'La lancha no sale por 2 rondas.', f: () => { E.leva = 2; } },
  { nom: '📸 ¡LLEGARON LOS TURISTAS!', txt: 'Por 2 rondas las azules dan +2 Bs de propina.', f: () => { E.turistas = 2; } },
  { nom: '⚡ ¡APAGÓN GENERAL!', txt: 'La isla queda a oscuras hasta la próxima ronda: es de noche (sin lancha, peaje doble).', f: () => { E.apagon = true; } }
];
async function vaina(j) {
  j.bono.ev++; S.foco = null;
  let v;
  for (let i = 0; i < 16; i++) { v = pick(VAINAS); msg.style.display = 'block'; msgB.innerHTML = ''; msgT.textContent = `¡QUÉ VAINA! 🎡\n[ ${v.nom} ]`; sfx.dado(); await espera(.08 + i * .015); }
  const extra = v.f(j); sfx.gana(); efectoVisual(); pintarHud();
  await decir(`¡QUÉ VAINA! ${v.nom}\n${extra || v.txt}`, 2);
}
function efectoVisual() {
  const meta = { tarde: E.hora === 'tarde' && !E.apagon ? 1 : 0, noche: deNoche() ? 1 : 0, lluvia: E.lluvia ? 1 : 0 }, de = Object.assign({}, E.vis);
  return tween(1.4, (k) => { for (const c in meta) E.vis[c] = de[c] + (meta[c] - de[c]) * k; });
}
async function inicioRonda() {
  S.foco = null; S.ritmo = 1;
  if (S.turno > 1) {
    const avisos = [];
    if (E.lluvia && !--E.lluvia) avisos.push('☀️ Escampó: se acabó el aguacero.');
    if (E.leva && !--E.leva) avisos.push('⛵ Se calmó el mar: la lancha vuelve a salir.');
    if (E.turistas && !--E.turistas) avisos.push('🧳 Los turistas se fueron.');
    if (E.apagon) { E.apagon = false; avisos.push('💡 ¡Volvió la luz!'); }
    for (const a of avisos) await decir(a, 1.1);
  }
  const antes = E.hora; E.hora = HORAS[(S.turno - 1) % 4];
  E.carnaval = S.turno === CARNAVAL; E.final = S.turno >= FINAL;
  pintarHud();
  const cambio = efectoVisual();
  if (E.hora !== antes) {
    if (E.hora === 'tarde') await decir('🌅 Atardece en Margarita… a la próxima ronda cae la noche.', 1.4);
    else if (E.hora === 'noche') await decir('🌙 Cayó la noche: la lancha no sale y el peaje de La Restinga es doble (tarifa nocturna).', 2);
    else if (antes === 'noche') await decir('☀️ ¡Amaneció! La lancha vuelve a salir.', 1.4);
  }
  await cambio;
  if (E.carnaval) { sfx.gana(); await preguntar('🎉 ¡CARNAVAL EN MARGARITA! 🎉\nEsta ronda las azules dan el DOBLE y el minijuego es TODOS CONTRA TODOS por 15 Bs.', [{ l: '¡A GOZAR!', v: 1 }], TODO_CPU); }
  if (S.turno === FINAL) {
    sfx.gana(); await preguntar('🔥 ¡ÚLTIMAS 3 RONDAS! 🔥\nDe aquí al final las casillas azules y rojas valen el DOBLE.', [{ l: '¡DALE!', v: 1 }], TODO_CPU);
    const peor = JUG.slice().sort((a, b) => a.emp - b.emp || a.reales - b.reales)[0], k = pick(['mototaxi', 'guarapo', 'trucado']);
    plata(peor, 10); darItem(peor, k); S.foco = peor; lluvia(peor.x, peor.y - 8);
    await decir(`✈️ La tía de Miami le manda una ayudita a ${peor.nom}, que va de último: +10 Bs y ${ITEMS[k].nom}.`, 2.2);
    S.foco = null;
  }
  else if (S.turno === TURNOS) await decir('¡ÚLTIMO TURNO!', 1.4);
  if (S.turno > 1) { await noticias(); await soltarBolsas(); }
  callar();
}
async function triple(j) {
  const ACC = [
    { t: (a, b) => `${a.nom} le da 10 Bs a ${b.nom}`, f: (a, b) => { const d = -plata(a, -10); plata(b, d); } },
    { t: (a, b) => `${b.nom} le da 10 Bs a ${a.nom}`, f: (a, b) => { const d = -plata(b, -10); plata(a, d); } },
    { t: (a, b) => `${a.nom} y ${b.nom} cambian sus reales`, f: (a, b) => { const x = a.reales; a.reales = b.reales; b.reales = x; } },
    { t: (a, b) => `${a.nom} le da una empanada a ${b.nom}`, f: (a, b) => { if (a.emp > 0) { a.emp--; b.emp++; } } },
    { t: (a, b) => `${a.nom} y ${b.nom} cambian sus empanadas`, f: (a, b) => { const x = a.emp; a.emp = b.emp; b.emp = x; } }
  ];
  let a, b, c;
  for (let i = 0; i < 18; i++) {
    a = pick(JUG); b = pick(JUG.filter((o) => o !== a)); c = pick(ACC);
    msg.style.display = 'block'; msgB.innerHTML = '';
    msgT.textContent = `🎰 ¡EL TRIPLE! 🎰\n[ ${a.nom} ]  [ ${c.t({ nom: '…' }, { nom: '…' }).replace(/…/g, '?')} ]  [ ${b.nom} ]`;
    sfx.dado(); await espera(.08 + i * .012);
  }
  sfx.gana(); await decir(`🎰 ¡EL TRIPLE!\n${c.t(a, b)}`, 1.8);
  c.f(a, b); pintarHud(); await espera(.4);
}

/* ───────── minijuegos ───────── */
const MJ = {
  ffa: ['f_abuela', 'f_bombita', 'f_cola', 'f_chancla', 'f_cerro', 'f_domino', 'f_harina', 'f_cotufas', 'f_tequeno', 'f_mecate', 'f_perro'],
  '2v2': ['f_cava', 'f_futbolito', 'f_hallacas'],
  '1v3': ['f_bono', 'f_alcabala', 'f_guaya', 'f_patilla']
};
const MICROS = ['mango', 'hielo', 'tequenos', 'soplalo', 'baile', 'torta', 'pique', 'chancla', 'sopa', 'queso', 'parada', 'tendedero'];
const mjBox = document.getElementById('mj'), mjF = document.getElementById('mjf'), skip = document.getElementById('skip');
function abrirFrame(src) { mjBox.style.display = 'block'; mjF.src = src; mjF.onload = () => { try { mjF.contentWindow.focus(); } catch (e) {} }; }
function cerrarFrame() { mjBox.style.display = 'none'; mjF.src = 'about:blank'; window.focus(); }

async function micro(j) {
  if (j.cpu || SIN_MJ) {
    await decir(`🕹️ ¡MICROJUEGO! ${j.nom} juega solo…`, 1.2);
    const gana = R() < .55;
    if (gana) plata(j, 10);
    await decir(gana ? `${j.nom} ganó: +10 Bs` : `${j.nom} perdió. Nada.`, 1); return;
  }
  const id = pick(MICROS);
  await preguntar(`🕹️ ¡MICROJUEGO! Gana y te llevas 10 Bs.`, [{ l: '¡DALE!', v: 1 }]);
  callar();
  const res = await new Promise((done) => {
    abrirFrame(`../style-lab/jugar.html?juego=${id}&estilo=snes&nivel=1`);
    let visto = 0, res = null;
    const t = setInterval(() => {
      let inf = null; try { inf = mjF.contentWindow.CAMP && mjF.contentWindow.CAMP.info; } catch (e) {}
      if (!res && inf && inf.result) { res = inf.result; visto = performance.now(); }
      if (res && performance.now() - visto > 1400) { clearInterval(t); done(res); }
    }, 150);
    skip.onclick = () => { clearInterval(t); done(R() < .5 ? 'win' : 'lose'); };
  });
  cerrarFrame();
  if (res === 'win') { plata(j, 10); sfx.gana(); await decir('¡GANASTE el microjuego! +10 Bs', 1.3); }
  else await decir('Perdiste el microjuego. ¡La próxima!', 1.2);
}

function formato() {
  if (E.carnaval) return { tipo: 'ffa', lados: [JUG.slice()] };
  const az = JUG.filter((j) => j.color === 'azul'), ro = JUG.filter((j) => j.color === 'rojo');
  if (!az.length || !ro.length) return { tipo: 'ffa', lados: [JUG.slice()] };
  if (az.length === 2) return { tipo: '2v2', lados: [az, ro] };
  return { tipo: '1v3', lados: az.length === 1 ? [az, ro] : [ro, az] };
}
async function minijuego() {
  S.foco = null; S.ritmo = 1;
  const fm = formato(), g = pick(MJ[fm.tipo]);
  const tu = JUG.find((j) => !j.cpu) || JUG[0];
  let asientos, rol = 'solo';
  if (fm.tipo === 'ffa') asientos = [tu].concat(JUG.filter((j) => j !== tu));
  else if (fm.tipo === '2v2') {
    const mio = fm.lados.find((l) => l.includes(tu)), otro = fm.lados.find((l) => l !== mio);
    asientos = [tu, mio.find((j) => j !== tu)].concat(otro);
  } else {
    const solo = fm.lados[0][0];
    if (solo === tu) asientos = [tu].concat(fm.lados[1]);
    else { rol = 'trio'; asientos = [tu, solo].concat(fm.lados[1].filter((j) => j !== tu)); }
  }
  const nomFm = fm.tipo === 'ffa' ? 'TODOS CONTRA TODOS' : fm.tipo === '2v2' ? '2 VS 2' : '1 VS 3';
  const lados = fm.tipo === 'ffa' ? JUG.map((j) => j.nom).join(' · ') : fm.lados.map((l) => l.map((j) => j.nom).join(' + ')).join('  VS  ');
  const nomJ = nombreMJ(g);
  await preguntar(`🎮 ¡MINIJUEGO! ${nomFm}\n${lados}\n«${nomJ}»`, [{ l: '¡A JUGAR!', v: 1 }], TODO_CPU);
  callar();
  let pl;
  if (SIN_MJ || TODO_CPU) pl = simular(fm, asientos);
  else {
    pl = await new Promise((done) => {
      const oir = (e) => { if (e.data && e.data.k === 'mj-fin') { removeEventListener('message', oir); done(e.data.pl && e.data.pl.length ? e.data.pl : simular(fm, asientos)); } };
      addEventListener('message', oir);
      skip.onclick = () => { removeEventListener('message', oir); done(simular(fm, asientos)); };
      abrirFrame(`../style-lab/fiesta.html?practica=${g}&embed=1&tipo=${fm.tipo}&rol=${rol}&ch=tu&lv=1`);
    });
    cerrarFrame();
  }
  const ganan = asientos.filter((j, k) => pl[k] === 1);
  const premio = E.carnaval ? 15 : 10;
  ganan.forEach((j) => { plata(j, premio); j.bono.mj += premio; });
  sfx.gana();
  await decir(ganan.length ? `🏆 ${ganan.map((j) => j.nom).join(' + ')} ${ganan.length > 1 ? 'ganan' : 'gana'} +${premio} Bs` : 'Nadie ganó. ¡Qué pena!', 2);
  callar();
}
function simular(fm, asientos) {
  if (fm.tipo === 'ffa') { const w = ri(0, 3); return asientos.map((j, k) => (k === w ? 1 : 2)); }
  const gana = R() < .5 ? 0 : 1, lado = fm.lados[gana];
  return asientos.map((j) => (lado.includes(j) ? 1 : 2));
}
const NOMBRES = { f_abuela: '¡LA ABUELA DICE!', f_bombita: '¡AGUA EN CARNAVAL!', f_cola: '¡LA COLA DE LA GASOLINA!', f_chancla: '¡LLUEVEN CHANCLAS!', f_cerro: '¡SUBE EL CERRO!',
  f_domino: '¡DOMINÓ!', f_harina: '¡LA ÚLTIMA HARINA!', f_cotufas: '¡LLUEVEN COTUFAS!', f_tequeno: '¡TEQUEÑOS!', f_mecate: '¡SALTA EL MECATE!', f_perro: '¡PERRO CALIENTE CON TODO!',
  f_cava: '¡CARGA LA CAVA!', f_futbolito: '¡FUTBOLITO DE CALLE!', f_hallacas: '¡LA LÍNEA DE HALLACAS!', f_bono: '¡SE LE CAE EL BONO!', f_alcabala: '¡LA ALCABALA DE MEDIANOCHE!',
  f_guaya: '¡LA GUAYA DEL TELEFÉRICO!', f_patilla: '¡LA PATILLA GIGANTE!' };
const nombreMJ = (g) => NOMBRES[g] || g.replace(/^f_/, '').toUpperCase();

/* ───────── final ───────── */
async function final() {
  S.fin = true; S.foco = null; pintarHud();
  await preguntar('¡SE ACABÓ LA PARTIDA!\nAhora… ¡las EMPANADAS EXTRA!', [{ l: 'VER', v: 1 }], TODO_CPU);
  const extra = [
    ['🎮 Empanada de los MINIJUEGOS', (j) => j.bono.mj, 'Bs ganados en minijuegos'],
    ['💰 Empanada de los REALES', (j) => j.bono.max, 'Bs en el bolsillo de una vez'],
    ['🚤 Empanada de los PEÑEROS', (j) => j.bono.ev, 'casillas de evento pisadas']
  ];
  for (const [t, f, u] of extra) {
    const top = Math.max.apply(null, JUG.map(f)), ganan = JUG.filter((j) => f(j) === top);
    ganan.forEach((j) => j.emp++); sfx.gana();
    await preguntar(`${t}\n${ganan.map((j) => j.nom).join(' + ')} (${top} ${u})`, [{ l: 'SIGUIENTE', v: 1 }], TODO_CPU);
  }
  const orden = JUG.slice().sort((a, b) => b.emp - a.emp || b.reales - a.reales);
  const ganador = orden[0];
  S.ganador = ganador;
  const viaje = nodos[ganador.en];
  ganador.anda = true;
  const x0 = ganador.x, y0 = ganador.y;
  await tween(1.6, (k) => { ganador.x = x0 + (COCHE.x - x0) * k; ganador.y = y0 + (COCHE.y - 2 - y0) * k; ganador.z = Math.abs(Math.sin(k * Math.PI * 4)) * 8; });
  ganador.z = 0;
  for (let i = 0; i < 6; i++) lluvia(COCHE.x + ri(-30, 30), COCHE.y - 20);
  sfx.gana();
  const tabla = orden.map((j, k) => `${k + 1}. ${j.nom}  🥟${j.emp}  ${j.reales} Bs`).join('\n');
  void viaje;
  await preguntar(`🏆 ¡${ganador.nom} ${ganador.cpu ? 'GANA' : 'GANAS'} LA FIESTA EN COCHE! 🏆\n\n${tabla}`, [{ l: 'OTRA VEZ', v: 1 }]);
  location.reload();
}

/* ───────── bucle de la partida ───────── */
async function partida() {
  pintarHud();
  await preguntar('🏝️ ISLA DE MARGARITA 🏝️\nCompra EMPANADAS DE ORO (20 Bs) a la señora. Cruza por La Restinga o la lancha (el Fiscal cobra peaje).\nCuidado con el Bachaquero. Compra cosas en la BODEGA, paga el SAN, y ojo con el PÍCARO. El que tenga más empanadas gana.\n(Rueda o pellizca para hacer zoom · 🎥 cambia la cámara · ¡TOCA las cosas del mapa, hay 8 SECRETOS escondidos! · ESPACIO adelanta los mensajes)',
    [{ l: '¡ARRANCAR!', v: 1 }], TODO_CPU);
  for (S.turno = 1; S.turno <= TURNOS; S.turno++) {
    await inicioRonda();
    for (const j of JUG) {
      S.activo = j.i; S.ritmo = j.cpu ? .6 : 1; pintarHud();
      if (j.pierde) { j.pierde = false; S.foco = j; await decir(`${j.nom} sigue con dolor de barriga. Pierde el turno.`, 1.3); continue; }
      await turnoJugador(j);
      acomodar();
    }
    await minijuego();
  }
  await final();
}

/* ───────── dibujo ───────── */
const TCOL = { B: '#2f6fe0', R: '#e0403a', E: '#36b04a', T: '#9a4fd0', M: '#f0a020', H: '#8a5a2a', A: '#22222c', V: '#18a8b0', I: '#7ac943', D: '#e8742a', S: '#d8a520' };
const TGLY = { B: '+', R: '-', E: '!', T: '?', M: 'M', H: 'botella', A: 'rayo', V: 'V', I: 'regalo', D: 'X', S: 'plata' };
const TILE = ['..#####..', '.#ccccc#.', '#ccccccc#', '#ccccccc#', '#ccccccc#', '.#ccccc#.', '..#####..'];
function casilla(n, t) {
  const c = TCOL[n.t], pulso = (n.t === 'E' || n.t === 'V') && Math.sin(t * 4 + n.id) > .7;
  sprite(TILE, { '#': '#14101c', c: pulso ? (n.t === 'V' ? '#7ef0f0' : '#7ce88a') : c }, n.x - 4, n.y - 3);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(n.x - 2, n.y - 2, 4, 1);
  glyph(TGLY[n.t], n.x - 1, n.y - 2, n.t === 'A' ? '#ffd23f' : '#fffdf2');
}
const BOLSA = ['.kk.', 'kyyk', 'yyyy', 'yGyy', '.yy.'];
function bolsas(t) {
  for (const b of S.bolsas) {
    const n = nodos[b.nodo], y = n.y - 12 + Math.round(Math.sin(t * 4 + n.id) * 1.5);
    if (b.cofre) sprite(['.bbbbb.', 'byyyyyb', 'bbbkbbb', 'byyyyyb'], { b: '#4a2a10', y: '#d8a520', k: '#14101c' }, n.x - 3, y);
    else sprite(BOLSA, { k: '#6a4a2a', y: '#d8a520', G: '#3a8a3a' }, n.x - 2, y);
    if (Math.sin(t * 6 + n.id) > .7) { ctx.fillStyle = '#fff'; ctx.fillRect(n.x + 3, y - 1, 1, 1); }
  }
  if (S.cofre) {
    S.cofre.t += 1 / 60; const c = S.cofre, y = Math.round(c.y - Math.min(1, c.t * 3) * 6);
    sprite(['.bbbbb.', 'byyyyyb', 'bbbybbb', 'byyyyyb', 'bbbbbbb'], { b: '#6a4a2a', y: '#d8a520' }, c.x - 3, y);
    ctx.fillStyle = `rgba(255,240,150,${.4 + Math.sin(c.t * 10) * .2})`; ctx.fillRect(c.x - 5, y - 4, 11, 2);
  }
}
function boya(n, t) { const b = Math.round(Math.sin(t * 3 + n.id) * .8); ctx.fillStyle = '#d23b3b'; ctx.fillRect(n.x - 5, n.y + 3 + b, 11, 2); }
function puestoDibujo(k, t) {
  const p = PUESTOS[k];
  ctx.fillStyle = '#6a4a2a'; ctx.fillRect(p.x + 4, p.y - 12, 1, 12);
  if (S.senora === k) {
    for (let i = 0; i < 11; i++) { ctx.fillStyle = i % 4 < 2 ? '#d23b3b' : '#fffdf2'; ctx.fillRect(p.x - 1 + i, p.y - 14 + Math.abs(i - 5) * .4, 1, 3); }
    ctx.fillStyle = '#8a5a2a'; ctx.fillRect(p.x - 3, p.y + 3, 14, 4);
    sprite(SENORA, PAL_SENORA, p.x - 8, p.y - 7);
    const b = Math.round(Math.sin(t * 3) * 1.5);
    sprite(EMPANADA, PAL_EMP, p.x + 2, p.y - 22 + b);
  } else if (S.bacha === k) {
    ctx.fillStyle = '#4a4a5a'; ctx.fillRect(p.x - 3, p.y + 3, 14, 4);
    sprite(BACHA, PAL_BACHA, p.x - 8, p.y - 7, Math.sin(t * 1.5) > 0);
    sprite(PIMPINA, PAL_PIMP, p.x + 2, p.y - 2); sprite(PIMPINA, PAL_PIMP, p.x + 7, p.y - 2);
  }
}
function pieza(j, t) {
  const sombra = Math.max(2, 4 - j.z / 3);
  ctx.fillStyle = 'rgba(20,16,28,.35)'; ctx.fillRect(Math.round(j.x - sombra), Math.round(j.y + 2), Math.round(sombra * 2), 2);
  const bob = !j.anda && j.i === S.activo && !S.fin ? Math.round(Math.abs(Math.sin(t * 5)) * 1.5) : 0;
  sprite(PJ_ROWS, j.pal, Math.round(j.x - 4), Math.round(j.y - 10 - j.z - bob));
  if (!j.cpu && !S.fin) { ctx.fillStyle = j.c; ctx.fillRect(Math.round(j.x), Math.round(j.y - 14 - j.z - bob), 1, 2); }
}
function dado(t) {
  const d = S.dado; if (!d || d.oculto) return;
  const j = d.j, x = Math.round(j.x - 7), y = Math.round(j.y - 32 - j.z) + (d.gira ? Math.round(Math.sin(t * 20)) : 0);
  ctx.fillStyle = '#14101c'; ctx.fillRect(x - 1, y - 1, 16, 16);
  ctx.fillStyle = d.gira ? '#fffdf2' : '#ffd23f'; ctx.fillRect(x, y, 14, 14);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y + 11, 14, 3);
  const s = String(d.n); texto(s, x + 7, y + 2, '#14101c', 2);
}
function flechas(t) {
  if (!S.flechas) return;
  const k = Math.round(Math.sin(t * 8) * 1.5);
  S.flechas.forEach((n, i) => {
    const c = i === 0 ? '#9fd8ff' : '#ffd23f';
    ctx.fillStyle = '#14101c'; ctx.fillRect(n.x - 3, n.y - 14 + k, 7, 5);
    ctx.fillStyle = c; ctx.fillRect(n.x - 2, n.y - 13 + k, 5, 2); ctx.fillRect(n.x - 1, n.y - 11 + k, 3, 1); ctx.fillRect(n.x, n.y - 10 + k, 1, 1);
  });
}
const PART = [];
function lluvia(x, y) { for (let i = 0; i < 26; i++) PART.push({ x, y, vx: (R() - .5) * 90, vy: -40 - R() * 70, t: 0, c: pick(['#ffd23f', '#ff6fa8', '#5cd27a', '#9fd8ff', '#fffdf2']) }); }
function particulas(dt) {
  for (let i = PART.length - 1; i >= 0; i--) {
    const p = PART[i]; p.t += dt; p.vy += 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.t > 1.4) { PART.splice(i, 1); continue; }
    ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }
}
let ult = performance.now(), T = 0;
function cuadro(ts) {
  requestAnimationFrame(cuadro);
  try { cuadroReal(ts); } catch (e) { console.error('[margarita] cuadro', e); }
}
function cuadroReal(ts) {
  let dt = clamp((ts - ult) / 1000, 0, .1); ult = ts; T += dt;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt * VEL; const k = Math.min(1, w.t / w.d); w.f(k);
    if (k >= 1) { tweens.splice(i, 1); w.r(); }
  }
  MAPA.dibujarMar(T, dt);
  for (const n of nodos) { if (n.cruce === 'lancha') boya(n, T); casilla(n, T); }
  MAPA.dibujarDeco(T);
  MAPA.dibujarNPCs(T, S.senora, S.bacha);
  puestoDibujo('O', T); puestoDibujo('W', T);
  bolsas(T);
  if (S.bote) {
    sprite(PENERO, PAL_PEN, Math.round(S.bote.x - 9), Math.round(S.bote.y - 3), S.bote.flip);
    sprite(SENORA, PAL_SENORA, Math.round(S.bote.x - 4), Math.round(S.bote.y - 12));
  }
  if (S.puff) { S.puff.t += dt; const r = S.puff.t * 20; ctx.fillStyle = 'rgba(240,240,240,' + Math.max(0, .8 - S.puff.t) + ')'; ctx.fillRect(Math.round(S.puff.x - r), Math.round(S.puff.y - r), Math.round(r * 2), Math.round(r * 2)); if (S.puff.t > .8) S.puff = null; }
  MAPA.dibujarVida(T, dt, E.vis.noche);
  MAPA.dibujarEstado(T, dt, E);
  if (VIS.cist) { const c = VIS.cist, P = c.T.pts; c.u += c.v * dt; if (c.u > 1 || c.u < 0) { c.v = -c.v; c.u = clamp(c.u, 0, 1); } const i = Math.min(P.length - 2, Math.floor(c.u * (P.length - 1))); c.x = P[i][0]; c.y = P[i][1] + 1; c.flip = (P[i + 1][0] - P[i][0]) * c.v < 0; }
  if (VIS.proc) VIS.proc.u += dt * .04;
  CRIAT.dibujar(T, dt);
  MAPA.dibujarNombres(T);
  PEAJES.forEach((P) => { const n = nodos[P.nodo], c = P.id === 'lancha' && lanchaCerrada(); texto(c ? 'CERRADO' : 'PEAJE ' + feeDe(P), n.x + (P.id === 'lancha' ? -14 : 10), n.y + (P.id === 'lancha' ? 14 : -24), c ? '#ff8a8a' : '#ffd23f', 1, '#14101c'); });
  JUG.slice().sort((a, b) => a.y - b.y).forEach((j) => pieza(j, T));
  MAPA.dibujarCielo(T, dt);
  flechas(T); dado(T); particulas(dt);
  camara(dt);
}

/* ───────── cámara: sigue al que juega (zoom 2x), vista general en los anuncios; rueda/pellizco/arrastre = cámara libre ───────── */
const CAM = { x: W / 2, y: H / 2, z: 1, modo: 'auto' };
const camBtn = document.getElementById('cam');
function camModo(m) { CAM.modo = m; camBtn.textContent = m === 'auto' ? '🎥 AUTO' : m === 'mapa' ? '🗺️ MAPA' : '✋ LIBRE'; }
camBtn.onclick = (e) => { camModo(CAM.modo === 'auto' ? 'mapa' : 'auto'); e.target.blur(); };
function camara(dt) {
  let tx = W / 2, ty = H / 2, tz = 1;
  if (CAM.modo === 'auto' && S.foco) { tx = S.foco.x; ty = S.foco.y - 10; tz = 2; }
  else if (CAM.modo === 'libre') { tx = CAM.lx; ty = CAM.ly; tz = CAM.lz; }
  const k = 1 - Math.pow(.02, dt);
  CAM.z += (tz - CAM.z) * k; CAM.x += (tx - CAM.x) * k; CAM.y += (ty - CAM.y) * k;
  if (Math.abs(CAM.z - tz) < .01) CAM.z = tz;
  const sw = W / CAM.z, sh = H / CAM.z, sx = clamp(CAM.x - sw / 2, 0, W - sw), sy = clamp(CAM.y - sh / 2, 0, H - sh);
  vctx.drawImage(mundoCv, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  CAM.vista = { sx, sy, sw, sh };
}
function aMundo(e) { const r = cv.getBoundingClientRect(), v = CAM.vista; return { x: v.sx + (e.clientX - r.left) / r.width * v.sw, y: v.sy + (e.clientY - r.top) / r.height * v.sh }; }
function libre() { if (CAM.modo !== 'libre') { CAM.lx = CAM.x; CAM.ly = CAM.y; CAM.lz = CAM.z; camModo('libre'); } }
cv.addEventListener('wheel', (e) => {
  e.preventDefault(); libre();
  const p = aMundo(e), z = clamp(CAM.lz * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 3.5);
  CAM.lx = p.x + (CAM.lx - p.x) * CAM.lz / z; CAM.ly = p.y + (CAM.ly - p.y) * CAM.lz / z; CAM.lz = z;
  if (z === 1) camModo('auto');
}, { passive: false });
const dedos = new Map();
cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); dedos.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }); });
cv.addEventListener('pointermove', (e) => {
  const d = dedos.get(e.pointerId); if (!d) return;
  const r = cv.getBoundingClientRect(), v = CAM.vista;
  if (dedos.size === 1) {
    const dx = (e.clientX - d.x) / r.width * v.sw, dy = (e.clientY - d.y) / r.height * v.sh;
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) { libre(); CAM.lx -= dx; CAM.ly -= dy; }
  } else if (dedos.size === 2) {
    const [a, b] = [...dedos.entries()].map(([id, q]) => (id === e.pointerId ? { x: e.clientX, y: e.clientY } : q));
    const [a0, b0] = [...dedos.values()], d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y), d1 = Math.hypot(a.x - b.x, a.y - b.y);
    if (d0 > 10) { libre(); CAM.lz = clamp(CAM.lz * d1 / d0, 1, 3.5); }
  }
  d.x = e.clientX; d.y = e.clientY;
});
const suelta = (e) => {
  const d = dedos.get(e.pointerId); dedos.delete(e.pointerId);
  if (!d || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6 || dedos.size) return;
  const p = aMundo(e), r = MAPA.tocar(p.x, p.y); if (!r) return;
  const S2 = { coco: [300, .08], pio: [1400, .05], ay: [500, .1], toc: [200, .05], beep: [900, .05], campana: [520, .5], bum: [70, .4], fiesta: [880, .15], brillo: [1600, .1], bocina: [140, .5], burro: [260, .35], agua: [600, .06], silbido: [1800, .4], secreto: [1320, .3] }[r.sonido] || [700, .05];
  snd(S2[0], S2[1], r.sonido === 'bocina' || r.sonido === 'burro' ? 'sawtooth' : r.sonido === 'campana' || r.sonido === 'silbido' ? 'sine' : 'square', .05);
  if (r.historia && !r.secreto) toast('📜 ' + r.historia);
  if (r.secreto) {
    const yo = JUG.find((x) => !x.cpu);
    if (yo) { plata(yo, 3); if (r.hallados === r.total) { yo.emp++; sfx.gana(); } }
    toast(`🔍 ¡SECRETO ${r.hallados}/${r.total}! Encontraste ${r.secreto}. +3 Bs${r.hallados === r.total ? ' · ¡LOS ENCONTRASTE TODOS! +1 EMPANADA 🥟' : ''}`);
    pintarHud();
  }
};
const toastEl = document.getElementById('toast');
function toast(s) { toastEl.textContent = s; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), 3200); }
cv.addEventListener('pointerup', suelta); cv.addEventListener('pointercancel', suelta);

/* ───────── tamaño ───────── */
function ajustar() {
  const st = document.getElementById('stage'), top = document.getElementById('top'), mb = document.getElementById('msgbox');
  const s = Math.min((innerWidth - 12) / W, (innerHeight - top.offsetHeight - mb.offsetHeight - 30) / H), e = s >= 2 ? Math.floor(s) : s;
  st.style.width = W * e + 'px'; st.style.height = H * e + 'px'; top.style.width = mb.style.width = W * e + 'px';
}
addEventListener('resize', ajustar); pintarHud(); ajustar();
acomodar();
requestAnimationFrame(cuadro);
partida();
window.MARGARITA = { S, JUG, nodos, PEAJES, E, CAM, ITEMS, NOTICIAS };
})();
