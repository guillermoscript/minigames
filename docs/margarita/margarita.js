'use strict';
/* ISLA DE MARGARITA · tablero v0 (calco de Yoshi's Tropical Island, MP1). Diseño: docs/mario-party/12-tablero-margarita.md
   Dos islas (Oriente y Macanao) en circuito, dos cruces de un sentido con peaje (La Restinga y la lancha), la señora de las
   empanadas vende la Empanada de Oro y el Bachaquero cobra en la otra isla; los peñeros (Evento) las cambian de isla.
   Las REGLAS viven en margarita-reglas.js (reductor puro, doc 14), el mismo que corre en el servidor para jugar en línea.
   Este archivo es el DIRECTOR: anima los efectos (fx) que salen del reductor, uno por uno, con las tarjetas, saltos y sonidos
   de siempre, y le pregunta al jugador lo que el reductor pide (el aviso, S.esp). En local, el reductor corre en el navegador
   (margarita-local.js): tú vs 3 CPU. Minijuego de 4 al final de la ronda (fiesta-juego-* en iframe, ?embed=1) y microjuego de
   campaña en las casillas M (jugar.html). Parámetros: ?turnos=N  ?sinmj=1 (minijuegos simulados)  ?cpu=1 (los 4 son CPU). */
(function () {
const Q = new URLSearchParams(location.search);
let TURNOS = Math.max(1, Math.min(30, +Q.get('turnos') || 10));
const SIN_MJ = Q.get('sinmj') === '1', TODO_CPU = Q.get('cpu') === '1';
/* YO = mi asiento (en local, 'a'). EN_LINEA: el tablero lo corre el servidor (margarita-red.js); las tarjetas sin decisión pasan solas (AUTO) */
let YO = 'a', EN_LINEA = false, AUTO = TODO_CPU;
const RG = MARGA.reglas;
const { nodos, J, PEAJES, PUESTOS, ISLAS, COCHE, NPCS } = MAPA;
const SEATS = ['a', 'b', 'c', 'd'];
/* D = la foto que se ve: el estado del reductor con los efectos ya animados. Al terminar cada lote, D es igual a LOCAL.S. */
let D = null;
const clon = (x) => JSON.parse(JSON.stringify(x));
function nueva(n) { TURNOS = Math.max(1, Math.min(30, n | 0)); LOCAL.crear({ tot: TURNOS, todoCpu: TODO_CPU, sinMJ: SIN_MJ }); D = clon(LOCAL.S); }   // la carcasa (shell.js) elige los turnos
nueva(TURNOS);
/* Estado de la isla (hora, clima, vainas, criaturas): lo lleva el reductor en D.isla; aquí solo la transición visual */
const E = { vis: { tarde: 0, noche: 0, lluvia: 0 } };
['hora', 'lluvia', 'leva', 'turistas', 'apagon', 'obras', 'carnaval', 'final', 'sinAgua', 'kraken', 'sirena', 'oferta', 'silbon']
  .forEach((k) => Object.defineProperty(E, k, { get: () => D.isla[k], enumerable: true }));
const deNoche = () => RG.deNoche(D);
const RAZON = { kraken: '¡el Kraken anda suelto en la laguna!', noche: 'de noche la lancha no sale', leva: 'hay mar de leva' };
const lanchaCerrada = () => RAZON[RG.lanchaCerrada(D)] || '';
const feeDe = (P) => RG.feeDe(D, P.id);

/* ───────── jugadores: la vista (posición, colores); lo demás se lee del reductor ───────── */
const VISTA = [
  { c: '#ffd23f', pal: { h: '#3a2414', s: '#e8b48a', e: '#14101c', k: '#e8b48a', c: '#ffd23f', p: '#2a4a8a', z: '#14101c' } },
  { c: '#ff6fa8', pal: { h: '#2a1a14', s: '#c98a5a', e: '#14101c', k: '#d26a6a', c: '#ff6fa8', p: '#6a3a5a', z: '#14101c' } },
  { c: '#b88aff', pal: { h: '#eeeeee', s: '#d8a070', e: '#14101c', k: '#d8a070', c: '#8a5ad2', p: '#4a3a6a', z: '#14101c' } },
  { c: '#5cd27a', pal: { h: '#2a6a3a', s: '#8a5a3a', e: '#14101c', k: '#8a5a3a', c: '#3aa860', p: '#2a3a5a', z: '#14101c' } }
];
const JUG = SEATS.map((s, i) => {
  const j = Object.assign({ s, i, x: 0, y: 0, z: 0 }, VISTA[i]), p = () => D.pj[s];
  Object.defineProperties(j, {
    nom: { get: () => p().name }, ch: { get: () => p().ch }, cpu: { get: () => p().cpu !== null }, yo: { get: () => s === YO && p().cpu === null }, reales: { get: () => p().bs }, emp: { get: () => p().emp },
    items: { get: () => p().items }, en: { get: () => p().en }, pierde: { get: () => p().pierde }, pimpinas: { get: () => p().pimpinas },
    color: { get: () => p().color }, bono: { get: () => p().bono }
  });
  return j;
});
const jug = (s) => JUG[SEATS.indexOf(s)];
const nomDe = (s) => jug(s).nom;
JUG.forEach((j) => { const n = nodos[j.en]; j.x = n.x; j.y = n.y; });
const S = { ritmo: 1, activo: 0, dado: null, flechas: null, bote: null, puff: null, fin: false, confeti: [], foco: null, cofre: null, equipo: null, monedas: [],
  senora: 'O', bacha: 'W', puesto: MARGA.grafo.PUESTO_INICIAL.nodo, ganador: null, get turno() { return D.r; }, get san() { return D.isla.san; }, get bolsas() { return D.isla.bolsas; } };

/* ───────── objetos (como los de Mario Party: dado doble/triple, dado a medida, llave, bloque de cambio, tubo dorado) ───────── */
const ITEMS = {
  cafe: { nom: '☕ CAFECITO', ico: '☕', txt: 'tiras 2 dados y cuenta el mejor', precio: 6 },
  guarapo: { nom: '🥤 GUARAPO', ico: '🥤', txt: 'tiras 3 dados y cuenta el mejor', precio: 12 },
  trucado: { nom: '🎲 DADO TRUCADO', ico: '🎯', txt: 'eliges el número (1–6)', precio: 8 },
  palanca: { nom: '🤝 PALANCA', ico: '🤝', txt: 'pasas un peaje gratis', precio: 5 },
  colearse: { nom: '🔀 COLEARSE', ico: '🔀', txt: 'cambias de puesto con un rival al azar', precio: 10 },
  mototaxi: { nom: '🛵 MOTOTAXI', ico: '🛵', txt: 'te lleva directo a las empanadas', precio: 22 }
};
const ITEM_IDS = Object.keys(ITEMS);
const LLENO = RG.LLENO;

/* ───────── tiempo, tweens, velocidad ───────── */
let VEL = 1, PRISA = 1;   // PRISA: en línea, cuando la foto va atrasada respecto al servidor, la película corre más rápido
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
  hud.innerHTML = JUG.map((j) => `<div class="pj${j.i === S.activo && !S.fin ? ' on' : ''}" style="--c:${j.c}"><b>${j.nom}</b>${j.yo ? ' ★' : ''}<br>🥟 ${j.emp} · ${j.reales}<span style="font-size:.7em"> Bs</span> <span class="it">${j.items.map((k) => ITEMS[k].ico).join('')}</span>${j.pierde ? '<span class="x">😵</span>' : ''}</div>`).join('');
  if (S.fin) { turnoEl.textContent = 'FIN DE LA PARTIDA'; return; }
  const ch = [];
  if (PLAZO_HASTA && EN_LINEA) ch.push('⏱️ ' + Math.max(0, Math.ceil((PLAZO_HASTA - MARGA.red.net().serverNow()) / 1000)) + ' s');
  if (EN_LINEA && D.pj[YO] && D.pj[YO].cpu === 'afk') ch.push('😴 LA CPU JUEGA POR TI');
  ch.push(`TURNO ${Math.max(1, S.turno)}/${TURNOS}`, E.apagon ? '⚡ APAGÓN' : E.hora === 'dia' ? '☀️ DÍA' : E.hora === 'tarde' ? '🌅 ATARDECER' : '🌙 NOCHE');
  if (E.lluvia) ch.push('🌧️ AGUACERO ' + E.lluvia); if (E.leva) ch.push('🌊 MAR DE LEVA ' + E.leva); if (E.turistas) ch.push('📸 TURISTAS ' + E.turistas);
  if (E.obras.O) ch.push('🚧 OBRAS ORIENTE'); if (E.obras.W) ch.push('🚧 OBRAS MACANAO');
  if (E.carnaval) ch.push('🎉 CARNAVAL'); if (E.final) ch.push('🔥 TODO AL DOBLE');
  if (SEN()) { const pa = pasosEmpanada(JUG[S.activo]); ch.push('🥟 EMPANADA: ' + SEN().lugar + (pa !== null ? ' · ' + pa + (pa === 1 ? ' PASO' : ' PASOS') : ' · OTRA ISLA')); }
  if (S.san) ch.push('🏦 SAN ' + S.san + ' Bs');
  if (E.sinAgua) ch.push('💧 SIN AGUA EN ' + ISLAS[E.sinAgua.k].nom); if (E.kraken) ch.push('🐙 KRAKEN ' + E.kraken); if (E.sirena) ch.push('🧜 SIRENA');
  if (E.oferta) ch.push('🛍️ OFERTA ' + E.oferta); if (E.silbon !== null) ch.push('👻 EL SILBÓN');
  const sec = MAPA.SECRETOS.filter((q) => q.hallado).length; if (sec) ch.push(`🔍 ${sec}/${MAPA.SECRETOS.length}`);
  turnoEl.textContent = ch.join(' · ');
}
/* pasos del tablero desde el jugador hasta la señora de las empanadas (null si no hay o no se llega a pie: otra isla) */
function pasosEmpanada(j) {
  if (!SEN() || !j || S.bote) return null;
  const d = MARGA.grafo.distancia(j.en, S.puesto); return d >= 99 ? null : d;
}
/* el puesto actual de la Empanadera ({x, y, nodo, isla, lugar}) o null mientras se muda; la señora se muda al comprarle (fx mudanza) y con el peñero */
const stallDe = (nodo) => MARGA.grafo.PUESTO_POR_NODO[nodo] || null;
function SEN() { return S.puesto == null ? null : stallDe(S.puesto); }
let teclas = null, PLAZO_HASTA = null;
function preguntar(txt, botones, cpu, elegida) {
  msg.style.display = 'block'; msgT.textContent = txt; msgB.innerHTML = ''; pintarHud();
  if (cpu || !botones || !botones.length) {
    const w = espera((cpu ? 1.1 : 1.3) * S.ritmo); saltable = ultimoTween;
    return w.then(() => (botones && botones.length ? (elegida !== undefined ? elegida : botones[0].v) : null));
  }
  return new Promise((res) => {
    let hecho = false;
    const fin = (v) => { if (hecho) return; hecho = true; teclas = null; msgB.innerHTML = ''; res(v); };
    botones.forEach((b, k) => {
      const el = document.createElement('button'); el.textContent = b.l; if (b.cls) el.className = b.cls;
      /* click, pointerup y touchend (de-duplicados por «hecho»): en Android un toque con unos px de arrastre a veces no genera click */
      el.onclick = () => fin(b.v); el.addEventListener('pointerup', () => fin(b.v)); el.addEventListener('touchend', () => fin(b.v));
      msgB.appendChild(el); if (!k) try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {} guardaCapa(el, 'botón «' + b.l + '»');
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

/* ───────── movimiento (solo la animación: la casilla nueva la pone el efecto hop) ───────── */
function puntoDe(j, n) {
  const aqui = JUG.filter((o) => o !== j && o.en === n.id && !o.anda), k = aqui.length;
  const off = [[0, 0], [-6, 2], [6, 2], [0, 5]][k] || [0, 0];
  return { x: n.x + off[0], y: n.y + off[1] };
}
function salto(j, a) {
  const x0 = j.x, y0 = j.y, n = nodos[a], p = puntoDe(j, n);
  j.anda = true; sfx.paso();
  return tween(.16, (k) => { j.x = x0 + (p.x - x0) * k; j.y = y0 + (p.y - y0) * k; j.z = Math.sin(k * Math.PI) * 7; })
    .then(() => { j.z = 0; j.anda = false; });
}
function vuelo(j, n, d, alto) {   // cañón, mototaxi: la pieza vuela en arco hasta la casilla
  const x0 = j.x, y0 = j.y; j.anda = true; S.foco = j;
  return tween(d, (k) => { j.x = x0 + (n.x - x0) * k; j.y = y0 + (n.y - y0) * k; j.z = Math.sin(k * Math.PI) * alto; }).then(() => { j.z = 0; j.anda = false; });
}
function acomodar() { JUG.forEach((j) => { if (!j.anda) { const p = puntoDe(j, nodos[j.en]); j.x = p.x; j.y = p.y; } }); }
const nomIsla = (k) => (k === 'C' ? 'COCHE' : ISLAS[k].nom);   // las obras pueden caer en Coche (vaina pisada allá)
const plata = (j, d) => { if (d > 0) sfx.plata(); else if (d < 0) sfx.mal(); pintarHud(); };
const PEAJE = (id) => PEAJES.find((P) => P.id === id);
const lugarDe = (n) => MAPA.lugarCerca(nodos[n].x, nodos[n].y);

/* ───────── lo que el reductor le pregunta al jugador (S.esp), con los botones de siempre ───────── */
function flechasDe(n) { return RG.salidas(nodos[n]).map((i) => nodos[i]); }
const PEDIR = {
  async DADO(e, j) {
    const max = E.lluvia ? 3 : 6, usables = e.opc.slice(1);
    girar(j, max);
    if (!usables.length) { await preguntar(`¡Tu turno! Tira el dado (1–${max})${E.lluvia ? ' · con el aguacero se va más lento' : ''}`, [{ l: '🎲 TIRAR', v: 1 }]); return { t: 'TIRAR' }; }
    const k = await preguntar(`¡Tu turno! Tira el dado (1–${max}) o usa algo de tu bolsillo:\n${usables.map((x) => ITEMS[x].nom + ': ' + ITEMS[x].txt).join(' · ')}`,
      [{ l: '🎲 TIRAR', v: null }].concat(usables.map((x) => ({ l: ITEMS[x].nom, v: x, cls: 'alt' }))));
    return k ? { t: 'USAR', item: k } : { t: 'TIRAR' };
  },
  async TRUCADO() { return { t: 'PASOS', n: await preguntar('🎯 DADO TRUCADO: ¿cuántos pasos?', Array.from({ length: 6 }, (_, i) => ({ l: String(i + 1), v: i + 1, cls: 'alt' }))) }; },
  async CRUCE(e, j) {
    const o = e.opc, P = PEAJE(o.peaje); S.flechas = flechasDe(j.en);
    const si = await preguntar(`Cruce: ${P.nom} → ${nomIsla(o.a)}.\nLas empanadas están en ${nomIsla(S.senora)}. Peaje mínimo: ${o.fee} Bs${deNoche() && o.peaje === 'restinga' ? ' (tarifa nocturna)' : ''}.`,
      [{ l: '⬅ SEGUIR EN ' + nomIsla(o.de), v: false, cls: 'alt' }, { l: 'CRUZAR ➡ (' + o.fee + '+ Bs)', v: true }]);
    return { t: 'CRUZAR', si };
  },
  async PEAJE(e) {
    const o = e.opc;
    if (o.palanca && await preguntar('🤝 Tienes una PALANCA: ¿pasas gratis? (el peaje no cambia)', [{ l: '🤝 USAR PALANCA', v: 1 }, { l: 'PAGAR', v: 0, cls: 'alt' }])) return { t: 'PALANCA' };
    let monto = o.fee;
    for (;;) {
      const v = await preguntar(`El Fiscal: «¿Cuánto es la colaboración?»\nMínimo ${o.fee} Bs${deNoche() && o.peaje === 'restinga' ? ' (tarifa nocturna)' : ''}. Lo que pagues queda como nuevo peaje.\nOfreces: ${monto} Bs`,
        [{ l: 'PAGAR ' + monto, v: 'ok' }, { l: '−', v: -1, cls: 'alt' }, { l: '+', v: 1, cls: 'alt' }, { l: '+5', v: 5, cls: 'alt' }, { l: 'MEJOR NO', v: 'no', cls: 'no' }]);
      if (v === 'ok') return { t: 'PAGAR', bs: monto };
      if (v === 'no') return { t: 'NO' };
      monto = clamp(monto + v, o.fee, o.tope);
    }
  },
  async FERRY(e, j) {
    const c = e.opc.costo; S.flechas = flechasDe(j.en);
    const si = await preguntar(`⛴️ EL MUELLE DE EL YAQUE: ¿tomas el ferry a COCHE por ${c} Bs?\nCoche está lleno de casillas de suerte 🎁 y vive el Perlero. Te deja en Punta de Piedras.`,
      [{ l: '⬅ SEGUIR POR TIERRA', v: false, cls: 'alt' }, { l: '⛴️ FERRY (' + c + ' Bs) ➡', v: true }]);
    return { t: 'FERRY', si };
  },
  async DESVIO(e, j) {
    const n = nodos[j.en], o = e.opc; S.flechas = flechasDe(j.en);
    const a = await preguntar(`¿Por dónde?\n${o.venta ? 'La señora de las empanadas está en ' + o.venta + ', por la costa.' : 'Por la costa no hay empanadas ahorita.'} El atajo es más corto, pero tiene más rojas y apagones.`,
      [{ l: '⬅ ' + n.ramas[0].nom, v: o.rutas[0].a, cls: 'alt' }, { l: n.ramas[1].nom + ' ➡', v: o.rutas[1].a }]);
    return { t: 'RUTA', a };
  },
  async EMPANADA() { return { t: 'COMPRAR', si: !!await preguntar('¿Compras la EMPANADA DE ORO por 20 Bs?', [{ l: '🥟 ¡SÍ!', v: 1 }, { l: 'NO', v: 0, cls: 'no' }]) }; },
  async BODEGA(e, j) {
    const N = NPCS.find((x) => x.nodo === j.en); if (N) MAPA.burbuja('¡PASE, AMIGO!', N.x, N.y - 10);
    const item = await preguntar(`🏪 LA BODEGA DEL PORTU: «¿Qué te llevas, amigo?» (tienes ${j.reales} Bs, ${LLENO - j.items.length} espacios)`,
      e.opc.map((x) => ({ l: `${ITEMS[x.item].nom} ${x.precio}${E.oferta ? '🏷️' : ''}`, v: x.item, cls: 'alt' })).concat([{ l: 'NADA, GRACIAS', v: null, cls: 'no' }]));
    return { t: 'COMPRAR', item };
  },
  async PICARO(e) {
    const L = { plata: { l: '💸 ROBAR REALES (5 Bs)', v: 'plata', cls: 'alt' }, emp: { l: '🥟 ROBAR EMPANADA (30 Bs)', v: 'emp', cls: 'alt' } };
    return { t: 'NEGOCIO', op: await preguntar('🦹 EL PÍCARO DEL PUERTO: «Psst… ¿un negocito? Yo le saco algo a quien tú me digas.»', e.opc.map((k) => L[k]).concat([{ l: 'NO, GRACIAS', v: null, cls: 'no' }])) };
  },
  async VICTIMA(e) {
    const op = e.opc.op;
    return { t: 'VICTIMA', s: await preguntar('¿A quién?', e.opc.lista.map((s) => ({ l: `${nomDe(s)} (${op === 'emp' ? '🥟' + jug(s).emp : jug(s).reales + ' Bs'})`, v: s, cls: 'alt' }))) };
  },
  async BRONCA(e) { return { t: 'RETAR', s: await preguntar('⚔️ ¡BRONCA! Reta a alguien a un duelo. El que gane se lleva la apuesta.', e.opc.map((s) => ({ l: `${nomDe(s)} (${jug(s).reales} Bs)`, v: s, cls: 'alt' }))) }; },
  async CALABOZO() {
    toast('📜 ' + MAPA.HISTORIA.santarosa); const N = NPCS.find((x) => x.k === 'calabozo'); MAPA.efx('texto', N.x, N.y - 10, { s: '¡AL CALABOZO!', c: '#ff8a8a' });
    return { t: 'FIANZA', si: await preguntar(`🏰 ¡Caíste en el CALABOZO DEL CASTILLO DE SANTA ROSA! Paga 10 Bs de fianza o pierdes tu próximo turno.`, [{ l: 'PAGAR 10 Bs', v: true }, { l: 'ME QUEDO PRESO', v: false, cls: 'no' }]) };
  },
  async MATASIETE(e) {
    toast('📜 ' + MAPA.HISTORIA.obelisco);
    return { t: 'PIEDRA', s: await preguntar('⚔️ CERRO MATASIETE: como en 1817, ¡a pedradas! ¿A quién le lanzas piedras? Retrocede 4 casillas.', e.opc.map((s) => ({ l: `${nomDe(s)} (🥟${jug(s).emp})`, v: s, cls: 'alt' })).concat([{ l: 'A NADIE', v: null, cls: 'no' }])) };
  },
  async RIFA(e) { const c = e.opc.costo; return { t: 'RIFA', si: await preguntar(`🛍️ EL SAMBIL: ¡RIFA! Por ${c} Bs giras la ruleta: objetos, reales… ¡y hasta una EMPANADA DE ORO!`, [{ l: '🎡 JUGAR ' + c + ' Bs', v: true }, { l: 'NO', v: false, cls: 'no' }]) }; },
  async CANON() { return { t: 'CANON', si: await preguntar('💣 EL CAÑÓN DE PAMPATAR: ¿te montas? Te dispara a un lugar AL AZAR del mapa (y ahí termina tu turno).', [{ l: '💣 ¡DISPARA!', v: true }, { l: 'NO, GRACIAS', v: false, cls: 'no' }]) }; },
  async MICRO() { await preguntar(`🕹️ ¡MICROJUEGO! Gana y te llevas 10 Bs.`, [{ l: '¡DALE!', v: 1 }]); callar(); return { t: 'MICRO', gana: (await micro()) === 'win' }; }
};
/* lo que se ve mientras una CPU decide (las mismas tarjetas de antes: «MAMÁ llega al cruce…») */
const CPU_DICE = {
  DADO: (e, j) => { girar(j, E.lluvia ? 3 : 6); return `${j.nom} tira el dado…`; },
  CRUCE: (e, j) => { S.flechas = flechasDe(j.en); return `${j.nom} llega al cruce de ${PEAJE(e.opc.peaje).nom}…`; },
  PEAJE: (e, j) => (e.opc.palanca ? `${j.nom} saca su PALANCA… 🤝` : null),
  FERRY: (e, j) => { S.flechas = flechasDe(j.en); return `${j.nom} está en el muelle…`; },
  DESVIO: (e, j) => { S.flechas = flechasDe(j.en); return `${j.nom} llega al desvío…`; },
  EMPANADA: (e, j) => `${j.nom} compra la Empanada de Oro…`,
  BODEGA: (e, j) => { const N = NPCS.find((x) => x.nodo === j.en); if (N) MAPA.burbuja('¡PASE, AMIGO!', N.x, N.y - 10); return `🏪 ${j.nom} entra a LA BODEGA DEL PORTU…`; }
};
async function pensarCPU(e) {
  const j = jug(e.s), f = CPU_DICE[e.k], t = f && f(e, j);
  if (t) await preguntar(t, null, true);
}
async function pedir(e) {
  const j = jug(e.s); S.foco = j;
  const a = await PEDIR[e.k](e, j);
  S.flechas = null; callar();
  return a;
}
/* el dado gira mientras el jugador decide; el efecto «dado» lo para en el número que salió */
let giro = null;
function girar(j, max) {
  S.dado = { j, n: ri(1, max), gira: true };
  clearInterval(giro); giro = setInterval(() => { if (S.dado && S.dado.gira) { S.dado.n = ri(1, max); sfx.dado(); } }, 60);
}

/* ───────── el director: anima un lote de efectos, uno por uno, y deja D igual al estado del reductor ───────── */
let LOTE = [], IX = 0, RESP = null;
const prox = (pred) => { for (let i = IX + 1; i < LOTE.length; i++) if (pred(LOTE[i])) return LOTE[i]; return null; };
const montoDe = (s, por) => { const m = prox((f) => f.k === 'mon' && f.s === s && f.por === por); return m ? m.d : 0; };
function ya(f) { if (!f._ok) { RG.aplicaFx(D, f); f._ok = true; } }   // aplicar un efecto antes de que le toque (lo anima otro)
function sincronizar() { if (!S.bote) { S.senora = D.isla.senora; S.bacha = D.isla.bacha; S.puesto = D.isla.puesto; } }
async function reproducir(fx) {
  if (!fx) return;
  LOTE = fx;
  for (IX = 0; IX < fx.length; IX++) {
    const f = fx[IX];
    if (!f._ok && FX[f.k]) await FX[f.k](f);
    ya(f); sincronizar();
  }
  LOTE = []; acomodar(); pintarHud();
}
const VAINAS = {
  aguacero: { nom: '🌧️ ¡AGUACERO!', txt: 'Llueve 2 rondas: dado de 1 a 3 y las rojas quitan 6.' }, obras: { nom: '🚧 ¡OBRAS!' },
  leva: { nom: '🌊 ¡MAR DE LEVA!', txt: 'La lancha no sale por 2 rondas.' }, turistas: { nom: '📸 ¡LLEGARON LOS TURISTAS!', txt: 'Por 2 rondas las azules dan +2 Bs de propina.' },
  apagon: { nom: '⚡ ¡APAGÓN GENERAL!', txt: 'La isla queda a oscuras hasta la próxima ronda: es de noche (sin lancha, peaje doble).' }
};
const TRIPLE = [(a, b) => `${a} le da 10 Bs a ${b}`, (a, b) => `${b} le da 10 Bs a ${a}`, (a, b) => `${a} y ${b} cambian sus reales`,
  (a, b) => `${a} le da una empanada a ${b}`, (a, b) => `${a} y ${b} cambian sus empanadas`];
const RIFA = { nada: 'NADA 😅', objeto: 'UN OBJETO 🎁', 15: '15 Bs 💰', 30: '30 Bs 💰💰', emp: '¡EMPANADA DE ORO! 🥟' };
const TIT_NOTICIA = { agua: '💧 ¡SE FUE EL AGUA!', piratas: '🏴‍☠️ ¡PIRATAS!', kraken: '🐙 ¡EL KRAKEN!', sirena: '🧜 ¡UNA SIRENA!', ovni: '👽 ¡UN OVNI!',
  oferta: '🛍️ ¡OFERTA EN EL SAMBIL!', silbon: '👻 ¡EL SILBÓN!', pesca: '🐟 ¡PESCA BUENA!', virgen: '⛪ ¡LA VIRGEN DEL VALLE!', apagon: '⚡ ¡APAGÓN!' };
const VIS = { cist: null, krak: null, sir: null, silb: null, proc: null, pesc: null };
let bonusVisto = false;
/* ───────── foco de evento: la cámara baja a donde pasa la vaina (aunque estés en LIBRE o MAPA), oscurece el resto, anillo que late y cartel grande ───────── */
const SPOT = { on: false, a: 0, x: 0, y: 0, z: 2.4, b: '', c: '#ffd23f', ring: true, sigue: false, tok: 0, t: 0 };
const npcPos = (k, dy) => { const N = NPCS.find((x) => x.k === k); return N ? { x: N.x, y: N.y + (dy || 0) } : null; };
const sirPos = () => { if (VIS.sir) return { x: VIS.sir.x, y: VIS.sir.y + 8 }; const q = D.isla.sirena && nodos[D.isla.sirena.nodo]; return q ? { x: q.x - 8, y: q.y - 12 } : null; };
const SPOTS = {
  'n:agua': { b: '💧 ¡SE FUE EL AGUA!', c: '#9fd8ff', z: 2, pos: (p) => { const T = MAPA.TRAZOS.find((x) => x.id === (p.isla === 'O' ? 'agua' : 'arenas')); return { x: T.pts[0][0], y: T.pts[0][1] }; } },
  'n:piratas': { b: '🏴‍☠️ ¡PIRATAS!', c: '#ff8a8a', z: 1.7, sigue: 1, pos: (p) => (p.isla === 'O' ? { x: 430, y: 42 } : { x: 70, y: 112 }) },
  'n:kraken': { b: '🐙 ¡EL KRAKEN!', c: '#c58aff', z: 2.4, pos: () => ({ x: 258, y: 236 }) },
  'n:sirena': { b: '🧜 ¡LA SIRENA!', c: '#6fe7d6', z: 2.7, pos: (p) => { const n = nodos[p.nodo]; return { x: n.x - 8, y: n.y - 12 }; } },
  'n:ovni': { b: '👽 ¡UN OVNI!', c: '#7dff9a', z: 2, sigue: 1, pos: (p) => { const v = jug(p.vict); return { x: v.x, y: v.y - 20 }; } },
  'n:oferta': { b: '🛍️ ¡OFERTA EN EL SAMBIL!', c: '#ff6fa8', z: 2.2, pos: () => { const d = MAPA.DECO.find((x) => x.k === 'sambil'); return d ? { x: d.x + 15, y: d.y - 10 } : null; } },
  'n:silbon': { b: '👻 ¡EL SILBÓN!', c: '#b8f0ff', z: 2.7, pos: (p) => { const n = nodos[p.nodo]; return { x: n.x, y: n.y - 8 }; } },
  'n:pesca': { b: '🐟 ¡PESCA BUENA!', c: '#9fd8ff', z: 2.2, pos: () => ({ x: 120, y: 318 }) },
  'n:virgen': { b: '⛪ ¡LA VIRGEN DEL VALLE!', c: '#fff6b0', z: 2.1, pos: () => ({ x: 520, y: 236 }) },
  'n:apagon': { b: '⚡ ¡APAGÓN GENERAL!', c: '#ffd23f', z: 1, ring: false, pos: () => ({ x: W / 2, y: H / 2 }) },
  'e:sirenaPerla': { b: '🧜 ¡LA SIRENA LE CANTA!', c: '#6fe7d6', z: 3, pos: sirPos },
  'e:sirenaEmbobado': { b: '🧜 ¡EMBOBADO CON LA SIRENA!', c: '#6fe7d6', z: 3, pos: sirPos },
  'e:silbonAtrapa': { b: '👻 ¡SE TOPÓ CON EL SILBÓN!', c: '#b8f0ff', z: 3, pos: () => (VIS.silb ? { x: VIS.silb.x, y: VIS.silb.y - 6 } : null) },
  'e:sanCobra': { b: '🏦 ¡LE TOCÓ EL SAN!', c: '#ffd23f', z: 2.6, pos: () => npcPos('san', -6) },
  'e:monoMango': { b: '🐒 ¡UN MONO DEL COPEY!', c: '#ffb04d', z: 2.8, pos: () => npcPos('monos', -4) },
  'e:monoArranca': { b: '🐒 ¡UN MONO DEL COPEY!', c: '#ffb04d', z: 2.8, pos: () => npcPos('monos', -4) },
  'e:preso': { b: '🏰 ¡AL CALABOZO!', c: '#ff8a8a', z: 2.6, pos: () => npcPos('calabozo', -6) },
  'e:tiaDeMiami': { b: '✈️ ¡LA TÍA DE MIAMI!', c: '#ff6fa8', z: 2.6, pos: (p, j) => ({ x: j.x, y: j.y - 10 }) },
  'e:cofre': { b: '✨ ¡COFRE ESCONDIDO!', c: '#ffd23f', z: 2.8, pos: (p, j) => ({ x: j.x, y: j.y - 8 }) },
  'e:piedras': { b: '⚔️ ¡PIEDRAS EN EL MATASIETE!', c: '#ff8a8a', z: 2.6, pos: (p) => { const v = jug(p.vict); return { x: v.x, y: v.y - 8 }; } },
  'e:bachaquero': { b: '🛢️ ¡EL BACHAQUERO!', c: '#ffb04d', z: 2.6, pos: (p, j) => ({ x: j.x, y: j.y - 8 }) },
  'fx:bolsa': { b: '👛 ¡SE LE CAYÓ LA CARTERA AL TURISTA!', c: '#ffd23f', z: 2.5, pos: (f) => { const n = nodos[f.en]; return { x: n.x, y: n.y - 6 }; } },
  'fx:penero': { b: '🚤 ¡ZARPÓ EL PEÑERO!', c: '#9fd8ff', z: 1.8, sigue: 1, pos: (f) => { const p = stallDe(f.desde); return p && { x: p.x, y: p.y }; } },
  'fx:mudanza': { b: '🥟 ¡SE VA LA EMPANADERA!', c: '#ffd23f', z: 2.2, pos: (f) => { const p = stallDe(f.de); return p && { x: p.x + 2, y: p.y - 8 }; } },
  'fx:cartera': { b: '💼 ¡LA CARTERA!', c: '#ffd23f', z: 2.6, pos: (f, j) => { const n = nodos[j.en]; return { x: n.x, y: n.y - 6 }; } }
};
/* abre el foco del evento `id`; devuelve un ficha para cerrarlo (no hace nada si no hay tabla o lugar) */
async function spotAbre(id, a, b, c) {
  const e = SPOTS[id]; if (!e) return 0;
  let q = null; try { q = e.pos(a, b, c); } catch (_) { q = null; }
  if (!q) return 0;
  const mismo = SPOT.on && Math.hypot(SPOT.x - q.x, SPOT.y - q.y) < 4, tok = ++SPOT.tok;
  Object.assign(SPOT, { on: true, x: q.x, y: q.y, z: e.z, b: e.b, c: e.c, ring: e.ring !== false, sigue: !!e.sigue });
  SPOT.t = mismo ? SPOT.t : 0;
  S.foco = null; CAM.cine = true;
  await espera(.45);   // lo que tarda la cámara en llegar (corre con la velocidad x2/x4)
  return tok;
}
function spotMueve(tok, x, y) { if (tok && tok === SPOT.tok) { SPOT.x = x; SPOT.y = y; SPOT.sigue = false; } }
function spotCierra(tok) { if (tok && tok === SPOT.tok) { SPOT.on = false; CAM.cine = false; } }
const conSpot = async (id, a, b, c, fn) => { const k = await spotAbre(id, a, b, c); try { return await fn(); } finally { spotCierra(k); } };
const FX = {
  ronda: async (f) => { S.foco = null; S.ritmo = 1; ya(f); if (VIS.proc) { CRIAT.quitar(VIS.proc); VIS.proc = null; } if (VIS.pesc) { CRIAT.quitar(VIS.pesc); VIS.pesc = null; } pintarHud(); },
  turno: async (f) => { const j = jug(f.s); S.activo = j.i; S.ritmo = j.yo ? 1 : .6; S.foco = j; pintarHud(); },
  isla: async (f) => { ya(f); if (f.campo === 'hora' || f.campo === 'apagon' || f.campo === 'lluvia') efectoVisual(); pintarHud(); },
  dado: async (f) => {
    const j = jug(f.s); S.foco = j; clearInterval(giro);
    if (!S.dado || S.dado.j !== j) S.dado = { j, n: f.v, gira: true };
    if (f.dados.length > 1) {
      const sale = [];
      for (let k = 0; k < f.dados.length; k++) {
        sale.push(f.dados[k]); S.dado.n = f.dados[k]; S.dado.gira = false; snd(1000 + k * 200, .1);
        await decir(`${j.nom}: ${sale.join(' · ')}${k === f.dados.length - 1 ? ' → cuenta el mejor: ' + f.v : ''}`, .55);
        if (k < f.dados.length - 1) { S.dado.gira = true; await espera(.25); }
      }
    }
    S.dado.n = f.v; S.dado.gira = false; snd(1200, .1); callar(); await espera(.4);
  },
  hop: async (f) => {
    const j = jug(f.s), n = nodos[f.a];
    if (f.modo === 'paso' || f.modo === 'atras') { await salto(j, f.a); if (f.modo === 'paso' && S.dado) S.dado.n = Math.max(0, S.dado.n - 1); return; }
    if (f.modo === 'canon') {
      S.dado = null; await vuelo(j, n, 1.6, 70); ya(f); acomodar(); MAPA.efx('onda', n.x, n.y); snd(120, .2, 'square', .08);
      await decir(`💣 ¡${j.nom} salió volando y cayó en ${lugarDe(f.a)}!`, 1.3); return;
    }
    if (f.modo === 'moto') {
      S.dado = null; snd(180, .6, 'sawtooth', .04); await vuelo(j, n, 1.4, 30); ya(f); acomodar();
      await decir(`🛵 «¡Llegamos, pana!» ${j.nom} está en ${stallDe(D.isla.puesto).lugar}.`, 1); return;
    }
    ya(f); acomodar();
  },
  cae: async (f) => {
    S.dado = null; clearInterval(giro); acomodar();
    const j = jug(f.s);
    if (f.t === 'R' && !j.reales) await decir(`${j.nom}: ${E.lluvia ? 'te agarró el aguacero y se te mojaron los billetes.' : 'se te cayó en la arena.'} 0 Bs`, .9);
  },
  resp: async (f) => {
    RESP = f; const j = jug(f.s), a = f.a;
    if (f.e === 'CANON' && a.si) { const N = NPCS.find((x) => x.k === 'canon'); MAPA.efx('humo', N.x + 8, N.y - 2, { dx: 1 }); MAPA.efx('texto', N.x, N.y - 12, { s: '¡BUUM!', c: '#ff8a3d' }); snd(70, .6, 'sawtooth', .12); }
    if (j.yo) return;
    if (f.e === 'BODEGA' && !a.item) await decir(`${j.nom} no compra nada.`, .6);
    if (f.e === 'PICARO' && !a.op) await decir(`🦹 El Pícaro le susurra a ${j.nom}… pero ${j.nom} sigue de largo.`, .8);
  },
  mon: async (f) => {
    const j = jug(f.s), d = f.d;
    if (f.por === 'azul') { ya(f); plata(j, d); await decir(`${j.nom}: ${E.turistas ? '¡un turista te dio propina!' : E.carnaval ? '¡te cayó plata en la comparsa!' : '¡te encontraste un billete!'} +${d} Bs`, .9); return; }
    if (f.por === 'roja') { ya(f); plata(j, d); await decir(`${j.nom}: ${E.lluvia ? 'te agarró el aguacero y se te mojaron los billetes.' : 'se te cayó en la arena.'} ${d} Bs`, .9); return; }
    if (f.por === 'cartera' || f.por === 'cofre') { ya(f); plata(j, d); const n = nodos[j.en]; lluvia(n.x, n.y - 6); const k = await spotAbre('fx:cartera', f, j); if (f.por === 'cofre') SPOT.b = '🏴‍☠️ ¡EL COFRE PIRATA!'; try { await decir(f.por === 'cofre' ? `🏴‍☠️ ¡${j.nom} encontró el COFRE PIRATA! +${d} Bs` : `💼 ¡${j.nom} se encontró la cartera! +${d} Bs`, 1.1); } finally { spotCierra(k); } return; }
    if (f.por === 'san' && d < 0) { const N = NPCS.find((x) => x.k === 'san'); ya(f); plata(j, d); MAPA.burbuja('¡PAGUE EL SAN!', N.x, N.y - 10); await decir(`🏦 ${j.nom} paga ${-d} Bs al San. Pote: ${D.isla.san - d} Bs (se lo lleva el que caiga justo aquí).`, 1.1); return; }
    if (f.por === 'fianza') { ya(f); plata(j, d); await decir(`🏰 ${j.nom} paga la fianza y sale libre.`, 1); return; }
    if (f.por === 'tesoro') { ya(f); plata(j, d); await decir(`Adentro había ${d} Bs. 💰`, 1.2); S.cofre = null; return; }
    if (f.por === 'picaro' && d > 0 && RESP && RESP.e === 'VICTIMA') { ya(f); plata(j, d); sfx.mal(); await decir(`🦹 ¡El Pícaro le sacó ${d} Bs a ${nomDe(RESP.a.s)} para ${j.nom}!`, 1.6); return; }
    if (f.por === 'micro' && RESP && RESP.e === 'MICRO') { ya(f); plata(j, d); sfx.gana(); await decir('¡GANASTE el microjuego! +10 Bs', 1.3); return; }
    if (f.por === 'mj' || f.por === 'bronca') return;   // las pagan las monedas del podio
    ya(f); plata(j, d);
  },
  emp: async (f) => {
    const j = jug(f.s);
    if (f.por === 'senora') { const P = stallDe(D.isla.puesto); ya(f); sfx.gana(); lluvia(P.x, P.y); await decir(`¡${j.nom} consiguió una EMPANADA DE ORO! 🥟`, 1.6); }
    else if (f.por === 'tesoro') { const n = nodos[j.en]; ya(f); lluvia(n.x, n.y - 10); await decir(`🥟 ¡Adentro había una EMPANADA DE ORO! ¡Qué suerte, ${j.nom}!`, 1.8); S.cofre = null; }
    else if (f.por === 'picaro' && f.d > 0) { ya(f); sfx.mal(); await decir(`🦹 ¡El Pícaro le sacó una EMPANADA DE ORO a ${nomDe(RESP.a.s)} y se la dio a ${j.nom}!`, 2); }
    else if (f.d > 0) sfx.gana();
  },
  item: async (f) => {
    const j = jug(f.s), I = ITEMS[f.item];
    if (f.que === 'compra') { ya(f); sfx.bien(); await decir(`${j.nom} compra ${I.nom} (${I.txt}).`, 1.2); }
    else if (f.que === 'suerte') { ya(f); sfx.gana(); lluvia(j.x, j.y - 8); await decir(`🎁 ¡QUÉ SUERTE! ${j.nom} recibe ${I.nom} (${I.txt}).`, 1.5); }
    else if (f.que === 'perlero') { ya(f); await decir(`🦪 EL PERLERO de Coche le regala a ${j.nom}: ${I.nom}.`, 1.3); }
    else if (f.que === 'tesoro') { ya(f); await decir(`Adentro había ${I.nom}.`, 1.3); S.cofre = null; }
    else if (f.que === 'mono') { const N = NPCS.find((x) => x.k === 'monos'); MAPA.burbuja('¡UH UH AH!', N.x, N.y - 6); ya(f); await decir(`🐒 ¡Un mono del Copey le robó ${I.nom} a ${j.nom} y salió corriendo pal monte!`, 1.6); }
    else if (f.que === 'usa' && f.item !== 'palanca') { ya(f); sfx.bien(); await decir(`${j.nom} usa ${I.nom}!`, .9); }
  },
  cruza: async (f) => {
    const j = jug(f.s);
    if (f.por === 'ferry') await decir(`⛴️ ${j.nom} se monta en el ferry a Coche.`, .9);
    else if (f.palanca) await decir(`El Fiscal: «Ah, ¿usted es amigo del jefe? Pase, pase.» ${j.nom} cruza GRATIS.`, 1.4);
  },
  peaje: async (f) => { const j = jug(f.s); if (!j.yo) await preguntar(`El Fiscal: «¿Cuánto es la colaboración?»\n${j.nom} paga ${f.pago} Bs. El peaje queda en ${f.pago}.`, null, true); },
  colearse: async (f) => {
    const j = jug(f.s), o = jug(f.con);
    S.puff = { x: j.x, y: j.y - 4, t: 0 };
    LOTE.slice(IX + 1).filter((x) => x.k === 'hop' && x.modo === 'cole').forEach(ya);
    acomodar(); sfx.bien(); S.puff = { x: j.x, y: j.y - 4, t: 0 };
    await decir(`🔀 ¡${j.nom} se coleó! Cambia de puesto con ${o.nom}.`, 1.4);
  },
  penero: async (f) => {
    const j = jug(LOTE.find((x) => x.k === 'cae').s), kk = await spotAbre('fx:penero', f);
    await decir(`¡ZARPÓ EL PEÑERO! 🚤 Se lleva a la señora de las empanadas a ${nomIsla(f.a)}.`, 1.2);
    const de = stallDe(f.desde), a = stallDe(f.puesto), via = [{ x: de.x, y: de.y }].concat(MAPA.rutaBote(f.de), [{ x: a.x, y: a.y }]), tramos = via.length - 1;
    S.bote = { x: via[0].x, y: via[0].y, flip: a.x < de.x }; S.foco = S.bote; S.senora = null; S.puesto = null; S.puff = { x: de.x, y: de.y, t: 0 };
    await tween(3.2, (k) => {
      const s = k * tramos, i = Math.min(tramos - 1, Math.floor(s)), u = s - i, p = via[i], q = via[i + 1];
      S.bote.flip = q.x < p.x; S.bote.x = p.x + (q.x - p.x) * u; S.bote.y = p.y + (q.y - p.y) * u + Math.sin(k * 40) * .6;
    });
    S.foco = j; S.bote = null; ya(f); sincronizar(); S.puff = { x: a.x, y: a.y, t: 0 };
    spotMueve(kk, a.x, a.y - 6); SPOT.b = '🥟 ¡LA EMPANADERA SE MUDÓ!';
    sfx.bien(); pintarHud();
    const pa = pasosEmpanada(JUG[S.activo]);
    toast(`🥟 ¡LA EMPANADERA SE MUDÓ A ${a.lugar}!`);
    await decir(`🥟 ¡LA EMPANADERA SE MUDÓ A ${a.lugar}! (${nomIsla(S.senora)})${pa !== null ? `\nQueda a ${pa} ${pa === 1 ? 'paso' : 'pasos'} de ${JUG[S.activo].yo ? 'ti' : JUG[S.activo].nom}.` : ''}\nEl Bachaquero se mudó a ${nomIsla(S.bacha)}.`, 1.8);
    spotCierra(kk);
  },
  /* la Empanadera, como la estrella del Mario Party: tras venderte se muda. Todos lo ven: zoom al puesto viejo (recoge y se va), vuelo al nuevo y cartel */
  mudanza: async (f) => {
    const de = stallDe(f.de), a = stallDe(f.a), kk = await spotAbre('fx:mudanza', f);
    S.puesto = null; S.puff = { x: de.x, y: de.y - 6, t: 0 }; sfx.bien(); snd(520, .12, 'square', .05);
    await decir('🥟 ¡La Empanadera recoge el puesto y se va!', .9);
    ya(f); sincronizar(); S.puff = { x: a.x, y: a.y - 6, t: 0 };
    spotMueve(kk, a.x, a.y - 6); SPOT.b = '🥟 ¡LA EMPANADERA SE MUDÓ A ' + a.lugar + '!';
    sfx.gana(); snd(880, .15, 'triangle', .06); lluvia(a.x + 4, a.y - 8); pintarHud();
    const pa = pasosEmpanada(JUG[S.activo]);
    toast(`🥟 ¡LA EMPANADERA SE MUDÓ A ${a.lugar}!`);
    await decir(`🥟 ¡LA EMPANADERA SE MUDÓ A ${a.lugar}! (${nomIsla(a.isla)})${pa !== null ? `\nQueda a ${pa} ${pa === 1 ? 'paso' : 'pasos'} de ${JUG[S.activo].yo ? 'ti' : JUG[S.activo].nom}.` : '\nHay que cruzar de isla.'}\n¡A correr, el que llegue primero con 20 Bs se la lleva!`, 2.4);
    spotCierra(kk);
  },
  triple: async (f) => {
    const nom = Object.keys(D.pj).map(nomDe);
    for (let i = 0; i < 18; i++) {
      msg.style.display = 'block'; msgB.innerHTML = '';
      msgT.textContent = `🎰 ¡EL TRIPLE! 🎰\n[ ${pick(nom)} ]  [ ${pick(TRIPLE)('?', '?')} ]  [ ${pick(nom)} ]`;
      sfx.dado(); await espera(.08 + i * .012);
    }
    sfx.gana(); await decir(`🎰 ¡EL TRIPLE!\n${TRIPLE[f.c](nomDe(f.a), nomDe(f.b))}`, 1.8);
    LOTE.slice(IX + 1).filter((x) => ['mon', 'emp', 'swap'].includes(x.k) && (x.k === 'swap' || x.por === 'triple')).forEach(ya);
    pintarHud(); await espera(.4);
  },
  vaina: async (f) => {
    S.foco = null; const ks = Object.keys(VAINAS), v = VAINAS[f.id];
    for (let i = 0; i < 16; i++) { msg.style.display = 'block'; msgB.innerHTML = ''; msgT.textContent = `¡QUÉ VAINA! 🎡\n[ ${VAINAS[pick(ks)].nom} ]`; sfx.dado(); await espera(.08 + i * .015); }
    LOTE.slice(IX + 1).filter((x) => x.k === 'isla').slice(0, 1).forEach(ya);
    sfx.gana(); efectoVisual(); pintarHud();
    const extra = f.id === 'obras' ? `El atajo de ${nomIsla(f.p.isla)} ${f.p.cerrado ? 'queda CERRADO por obras' : 'ya está ABIERTO otra vez'}.` : v.txt;
    await decir(`¡QUÉ VAINA! ${v.nom}\n${extra}`, 2);
  },
  rifa: async (f) => {
    const j = jug(f.s), ks = Object.keys(RIFA);
    for (let i = 0; i < 14; i++) { msg.style.display = 'block'; msgB.innerHTML = ''; msgT.textContent = `🛍️ RIFA DEL SAMBIL 🎡\n[ ${RIFA[i === 13 ? f.sale : pick(ks)]} ]`; sfx.dado(); await espera(.07 + i * .014); }
    const d = MAPA.DECO.find((x) => x.k === 'sambil'); if (d) d.fiesta = 1.5;
    LOTE.slice(IX + 1).filter((x) => x.por === 'rifa' || x.que === 'rifa').forEach(ya);
    if (f.sale === 'objeto') await decir(`🛍️ ${j.nom} gana ${ITEMS[f.item].nom} en la rifa.`, 1.2);
    else if (f.sale === '15') { sfx.plata(); await decir(`🛍️ ¡${j.nom} gana 15 Bs en la rifa!`, 1.2); }
    else if (f.sale === '30') { sfx.gana(); await decir(`🛍️ ¡${j.nom} gana 30 Bs en la rifa!`, 1.4); }
    else if (f.sale === 'emp') { sfx.gana(); lluvia(j.x, j.y - 8); await decir(`🛍️ ¡¡${j.nom} SE GANÓ UNA EMPANADA DE ORO EN LA RIFA!! 🥟`, 2); }
    else await decir(`🛍️ ${j.nom} no ganó nada. ¡Así es la rifa!`, 1);
  },
  bolsa: async (f) => {
    const n = nodos[f.en], k = await spotAbre('fx:bolsa', f); S.foco = { x: n.x, y: n.y };
    LOTE.slice(IX + 1).filter((x) => x.k === 'isla' && x.campo === 'bolsas').slice(0, 1).forEach(ya);
    MAPA.efx('texto', n.x, n.y - 14, { s: '👛 ¡CARTERA!', c: '#ffd23f' }); lluvia(n.x, n.y - 6); sfx.plata();
    try { await decir(`💼 ¡A un turista se le cayó la cartera cerca de ${lugarDe(f.en)}! El primero que pase se lleva ${f.bs} Bs.`, 2); } finally { spotCierra(k); } S.foco = null;
  },
  noticia: async (f) => { sfx.gana(); const p = f.p || {}, k = await spotAbre('n:' + f.id, p); try { await preguntar(`📺 ¡ÚLTIMA HORA EN MARGARITA! 📺\n${TIT_NOTICIA[f.id]}`, [{ l: '¿QUÉ PASÓ?', v: 1 }], AUTO); await NOTICIA[f.id](p, f); } finally { spotCierra(k); } pintarHud(); S.foco = null; },
  evento: async (f) => { const h = EVENTO[f.id]; if (h) { const j = f.s ? jug(f.s) : null, p = f.p || {}; await conSpot('e:' + f.id, p, j, f, () => h(j, p, f)); } },
  equipos: async (f) => { await revelarEquipos(f); },
  mjIni: async (f) => { await (f.duelo ? cartaDuelo(f) : cartaMJ(f)); },
  mjRes: async (f) => { await (D.mj && D.mj.duelo || DUELO ? finDuelo(f) : finMJ(f)); },
  bonusFin: async (f) => {
    if (!bonusVisto) { bonusVisto = true; S.fin = true; S.foco = null; pintarHud(); await preguntar('¡SE ACABÓ LA PARTIDA!\nAhora… ¡las EMPANADAS EXTRA!', [{ l: 'VER', v: 1 }], AUTO); }
    const T = { mj: ['🎮 Empanada de los MINIJUEGOS', 'Bs ganados en minijuegos'], max: ['💰 Empanada de los REALES', 'Bs en el bolsillo de una vez'], ev: ['🚤 Empanada de los PEÑEROS', 'casillas de evento pisadas'] }[f.id];
    LOTE.slice(IX + 1).filter((x) => x.k === 'emp' && x.por === 'bonus').slice(0, f.ganan.length).forEach(ya);
    sfx.gana(); pintarHud();
    await preguntar(`${T[0]}\n${f.ganan.map(nomDe).join(' + ')} (${f.top} ${T[1]})`, [{ l: 'SIGUIENTE', v: 1 }], AUTO);
  },
  fin: async (f) => { ya(f); await final(f); }
};
/* las tarjetas de solo leer que vienen como evento */
const aviso = (j, txt) => preguntar(txt, null, j ? !j.yo : true);
const EVENTO = {
  pierdeTurno: (j) => { S.foco = j; return decir(`${j.nom} sigue con dolor de barriga. Pierde el turno.`, 1.3); },
  escampo: () => decir('☀️ Escampó: se acabó el aguacero.', 1.1), calma: () => decir('⛵ Se calmó el mar: la lancha vuelve a salir.', 1.1),
  turistasSeVan: () => decir('🧳 Los turistas se fueron.', 1.1), volvioLaLuz: () => decir('💡 ¡Volvió la luz!', 1.1),
  atardece: () => decir('🌅 Atardece en Margarita… a la próxima ronda cae la noche.', 1.4),
  anochece: () => decir('🌙 Cayó la noche: la lancha no sale y el peaje de La Restinga es doble (tarifa nocturna).', 2),
  amanece: () => decir('☀️ ¡Amaneció! La lancha vuelve a salir.', 1.4),
  carnaval: () => { sfx.gana(); return preguntar('🎉 ¡CARNAVAL EN MARGARITA! 🎉\nEsta ronda las azules dan el DOBLE y el minijuego es TODOS CONTRA TODOS por 15 Bs.', [{ l: '¡A GOZAR!', v: 1 }], AUTO); },
  recta: () => { sfx.gana(); return preguntar('🔥 ¡ÚLTIMAS 3 RONDAS! 🔥\nDe aquí al final las casillas azules y rojas valen el DOBLE.', [{ l: '¡DALE!', v: 1 }], AUTO); },
  tiaDeMiami: async (j, p) => {
    S.foco = j; lluvia(j.x, j.y - 8);
    LOTE.slice(IX + 1).filter((x) => (x.k === 'mon' && x.por === 'tia') || (x.k === 'item' && x.que === 'tia')).forEach(ya);
    await decir(`✈️ La tía de Miami le manda una ayudita a ${j.nom}, que va de último: +10 Bs y ${ITEMS[p.item].nom}.`, 2.2); S.foco = null;
  },
  ultimoTurno: () => decir('¡ÚLTIMO TURNO!', 1.4),
  cisterna: (j, p) => { CRIAT.quitar(VIS.cist); VIS.cist = null; return decir(`🚛 ¡Llegó la cisterna a ${nomIsla(p.isla)}! Volvió el agua.`, 1.3); },
  krakenSeVa: async () => { const c = VIS.krak; if (c) { await tween(1, (q) => { c.a = 1 - q; }); CRIAT.quitar(c); VIS.krak = null; } await decir('🐙 El Kraken se hundió otra vez. La lancha y el ferry vuelven a salir.', 1.3); },
  sirenaSeVa: () => { CRIAT.quitar(VIS.sir); VIS.sir = null; return decir('🧜 La sirena se fue nadando.', 1); },
  ofertaSeAcaba: () => decir('🛍️ Se acabó la oferta del Sambil.', 1),
  silbonSeVa: () => { CRIAT.quitar(VIS.silb); VIS.silb = null; return decir('👻 Amaneció y El Silbón se fue silbando…', 1.2); },
  sinPeaje: (j, p) => { const P = PEAJE(p.peaje); return aviso(j, `${P.nom}: el Fiscal cobra mínimo ${p.fee} Bs.\n${j.yo ? 'No te alcanza' : j.nom + ' no tiene'}: sigue por ${nomIsla(P.de)}.`); },
  ferryCerrado: (j) => aviso(j, '🐙 El ferry no sale: ¡el Kraken anda suelto!'),
  atajoCerrado: (j) => aviso(j, `🚧 ${nodos[j.en].ramas[1].nom}: cerrado por obras. ${j.yo ? 'Vas' : j.nom + ' va'} por la costa.`),
  lanchaCerrada: (j, p) => aviso(j, `⛔ LA LANCHA: ${RAZON[p.por]}. ${j.yo ? 'Sigues' : j.nom + ' sigue'} por ${nomIsla(PEAJE('lancha').de)}.`),
  empanadaCara: (j) => aviso(j, `La señora de las empanadas: «La de oro cuesta 20 Bs, mi amor».\n${j.yo ? 'No te alcanza' : j.nom + ' no tiene'} (${j.reales} Bs): ${j.yo ? 'te' : 'le'} faltan ${Math.max(0, 20 - j.reales)} Bs.`),
  bachaquero: async (j, p) => {
    await aviso(j, `El Bachaquero: «¡Epa! Pimpina de gasolina, buenísima, 30 Bs». No es opcional.`);
    LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'bachaquero').slice(0, 1).forEach((x) => { ya(x); plata(j, x.d); });
    await decir(p.cobra ? `${j.nom} paga ${p.cobra} Bs por una pimpina… que no sirve.` : `${j.nom} no tenía ni un real. El Bachaquero se va bravo.`, 1.4);
  },
  bodegaLleno: (j) => { const N = NPCS.find((x) => x.nodo === j.en); if (N) MAPA.burbuja('¡PASE, AMIGO!', N.x, N.y - 10); return decir(`🏪 El Portu: «¡${j.nom}, ya no te cabe nada en los bolsillos!»`, .9); },
  bodegaFiado: (j) => { const N = NPCS.find((x) => x.nodo === j.en); if (N) MAPA.burbuja('¡PASE, AMIGO!', N.x, N.y - 10); return decir(`🏪 El Portu: «¡Fiado no, ${j.nom}!» (no te alcanza)`, .9); },
  sanVacio: (j) => decir(`🏦 EL SAN: ${j.nom} cae en el san… ¡pero el pote está vacío!`, 1.1),
  sanCobra: async (j, p) => {
    const N = NPCS.find((x) => x.k === 'san');
    LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'san').slice(0, 1).forEach(ya);
    lluvia(N.x, N.y - 6); sfx.gana(); await decir(`🏦 ¡LE TOCÓ EL SAN A ${j.nom}! Se lleva todo el pote: +${p.pote} Bs`, 1.8);
  },
  picaroNada: (j) => decir(!j.yo ? `🦹 El Pícaro le susurra a ${j.nom}… pero ${j.nom} sigue de largo.` : '🦹 El Pícaro: «Psst… vuelve cuando tengas plata.»', !j.yo ? .8 : 1),
  perla: async (j) => { LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'perlero').slice(0, 1).forEach(ya); await decir(`🦪 EL PERLERO le da a ${j.nom} una perla de Cubagua: +8 Bs.`, 1.2); },
  monoMango: async (j) => { const N = NPCS.find((x) => x.k === 'monos'); MAPA.burbuja('¡UH UH AH!', N.x, N.y - 6); LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'monos').slice(0, 1).forEach(ya); plata(j, 3); await decir(`🐒 Un mono capuchino del Copey le regala un mango a ${j.nom}… ¡y adentro venían 3 Bs! (+3 Bs)`, 1.4); },
  monoArranca: async (j) => { const N = NPCS.find((x) => x.k === 'monos'); MAPA.burbuja('¡UH UH AH!', N.x, N.y - 6); const d = montoDe(j.s, 'monos'); LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'monos').slice(0, 1).forEach(ya); plata(j, d); await decir(`🐒 ¡Un mono del Copey le arrancó ${-d} Bs a ${j.nom}!`, 1.3); },
  preso: async (j) => {
    if (j.yo && RESP && RESP.e !== 'CALABOZO') toast('📜 ' + MAPA.HISTORIA.santarosa);
    const N = NPCS.find((x) => x.k === 'calabozo'); MAPA.efx('texto', N.x, N.y - 10, { s: '¡AL CALABOZO!', c: '#ff8a8a' });
    sfx.mal(); await decir(`🏰 ${j.nom} queda preso en Santa Rosa, como Luisa Cáceres de Arismendi. Pierde el próximo turno.`, 1.6);
  },
  silbonAtrapa: async (j) => {
    const c = VIS.silb, d = montoDe(j.s, 'silbon'); snd(1800, .5, 'sine', .06);
    LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'silbon').slice(0, 1).forEach(ya); plata(j, d);
    if (c) MAPA.efx('texto', c.x, c.y - 30, { s: 'FIU FIU', c: '#b8f0ff' });
    await decir(`👻 ¡${j.nom} se topó con EL SILBÓN! Del susto se le cayeron ${-d} Bs. El Silbón se va silbando…`, 1.8);
    if (c) CRIAT.quitar(c); VIS.silb = null;
  },
  sirenaPerla: async (j) => { LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'sirena').slice(0, 1).forEach(ya); plata(j, 10); if (VIS.sir) lluvia(VIS.sir.x, VIS.sir.y - 10); await decir(`🧜 La sirena le canta a ${j.nom} y le regala una perla: +10 Bs.`, 1.5); },
  sirenaEmbobado: async (j) => { const d = montoDe(j.s, 'sirena'); LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'sirena').slice(0, 1).forEach(ya); plata(j, d); await decir(`🧜 ${j.nom} se quedó embobado oyendo a la sirena y se le fueron ${-d} Bs al mar.`, 1.5); },
  sinAgua: (j) => decir(`💧 ${j.nom}: no hay agua en ${nomIsla(D.isla.sinAgua.k)}, todo está cerrado… +0 Bs`, .9),
  suerteLleno: async (j) => { sfx.gana(); lluvia(j.x, j.y - 8); LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'suerte').slice(0, 1).forEach(ya); await decir(`🎁 ¡QUÉ SUERTE! Pero ${j.nom} tiene los bolsillos llenos: +5 Bs.`, 1.3); },
  micro: async (j, p) => {
    await decir(`🕹️ ¡MICROJUEGO! ${j.nom} juega solo…`, 1.2);
    LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'micro').slice(0, 1).forEach((x) => { ya(x); plata(j, x.d); });
    await decir(p.gana ? `${j.nom} ganó: +10 Bs` : `${j.nom} perdió. Nada.`, 1);
  },
  malta: (j) => decir(`${j.nom}: ¡una MALTA bien fría! Tira otra vez.`, 1.2),
  pescado: (j) => { sfx.mal(); return decir(`${j.nom}: pescado pasado… 🤢 Pierde el próximo turno.`, 1.4); },
  apagonCasa: async (j) => { const d = montoDe(j.s, 'apagon'); LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'apagon').slice(0, 1).forEach(ya); plata(j, d); await decir(`¡APAGÓN! ⚡ Se dañó la nevera de ${j.nom}. ${d} Bs`, 1.5); },
  cofre: (j) => { const n = nodos[j.en]; S.cofre = { x: n.x, y: n.y - 8, t: 0 }; sfx.gana(); return decir(`✨ ¡${j.nom} escarbó en la arena y salió un COFRE ESCONDIDO!`, 1.1); },
  broncaPelaos: (j, p) => decir(`⚔️ ${j.nom} reta a ${nomDe(p.vs)}… pero no hay plata para apostar. ¡Quedan como panas!`, 1.4),
  piedras: async (j, p) => {
    const v = jug(p.vict); if (j.yo) toast('📜 ' + MAPA.HISTORIA.obelisco);
    S.foco = v; snd(300, .3, 'square', .05);
    for (let i = 0; i < 5; i++) { MAPA.efx('coco', v.x + ri(-6, 6), v.y - 4); MAPA.efx('humo', v.x, v.y - 4, { dx: 0 }); await espera(.08); }
    await decir(`⚔️ ¡${j.nom} le lanza piedras a ${v.nom} desde el Matasiete! ${v.nom} retrocede 4 casillas.`, 1.2);
  },
  secreto: () => {}
};
/* ───────── noticias de la isla: el reductor ya decidió víctima y lugar (p); aquí solo la película ───────── */
const NOTICIA = {
  agua: async (p) => {
    const T = MAPA.TRAZOS.find((x) => x.id === (p.isla === 'O' ? 'agua' : 'arenas')); VIS.cist = CRIAT.add('cisterna', { T, u: 0, v: .03 });
    S.foco = { x: T.pts[0][0], y: T.pts[0][1] };
    await decir(`💧 ¡SE FUE EL AGUA EN ${nomIsla(p.isla)}! Por 2 rondas las casillas azules de ${nomIsla(p.isla)} no dan nada. Ya viene la cisterna…`, 2.2);
  },
  piratas: async (p) => {
    const k = p.isla, meta = k === 'O' ? { x: 430, y: 42 } : { x: 70, y: 112 };
    const b = CRIAT.add('barco', { x: k === 'O' ? 690 : -50, y: meta.y, flip: k === 'O' }); S.foco = b;
    await decir('🏴‍☠️ ¡ÚLTIMA HORA! ¡Llegan los piratas de LOPE DE AGUIRRE, el Tirano!', 1.2);
    const x0 = b.x; await tween(2.4, (q) => { b.x = x0 + (meta.x - x0) * q; });
    b.humo = 1; snd(70, .5, 'sawtooth', .1); MAPA.efx('texto', b.x, b.y - 30, { s: '¡ARRR!', c: '#ff8a3d' });
    LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'piratas').forEach((x) => { ya(x); plata(jug(x.s), x.d); });
    await decir(p.vict.length ? `🏴‍☠️ Los piratas saquean ${nomIsla(k)}: ${p.vict.map(nomDe).join(', ')} pierden 5 Bs cada uno.` : `🏴‍☠️ Los piratas llegan a ${nomIsla(k)}… pero no hay nadie a quien robar.`, 1.8);
    const n = nodos[p.cofre]; LOTE.slice(IX + 1).filter((x) => x.k === 'isla' && x.campo === 'bolsas').slice(0, 1).forEach(ya); S.foco = { x: n.x, y: n.y };
    await decir(`🏴‍☠️ Al irse, se les cayó un COFRE PIRATA cerca de ${lugarDe(p.cofre)}: ¡20 Bs para el primero que pase!`, 2);
    S.foco = b; const x1 = b.x; b.flip = !b.flip; tween(3, (q) => { b.x = x1 + (k === 'O' ? -1 : 1) * 400 * q; }).then(() => CRIAT.quitar(b));
  },
  kraken: async (p) => {
    VIS.krak = CRIAT.add('kraken', { x: 258, y: 236, a: 0 }); S.foco = VIS.krak;
    snd(60, 1, 'sawtooth', .1); await tween(1.2, (q) => { VIS.krak.a = q; });
    LOTE.slice(IX + 1).filter((x) => x.k === 'hop' && x.modo === 'kraken').forEach(ya); acomodar();
    await decir(`🐙 ¡SALIÓ EL KRAKEN EN LA LAGUNA! Por 2 rondas no salen ni la lancha ni el ferry.${p.vuelven.length ? ' ¡' + p.vuelven.map(nomDe).join(' y ') + ' vuelve al muelle del susto!' : ''}`, 2.4);
  },
  sirena: async (p) => {
    const n = nodos[p.nodo]; VIS.sir = CRIAT.add('sirena', { x: n.x - 8, y: n.y - 20 }); S.foco = VIS.sir;
    await decir('🧜 ¡Vieron una SIRENA en Playa El Agua! El que pase por su lado se encontrará una sorpresa… (2 rondas)', 2.2);
  },
  ovni: async (p) => {
    const v = jug(p.vict), o = CRIAT.add('ovni', { x: v.x, y: -20 }); S.foco = o;
    await decir(`👽 ¡UN OVNI SOBRE MARGARITA! Viene por… ¡${v.nom}!`, 1.2);
    await tween(1.4, (q) => { o.y = -20 + (v.y - 50 + 20) * q; });
    o.rayo = true; o.suelo = v.y; snd(400, 1.2, 'sine', .06); v.anda = true;
    await tween(1.2, (q) => { v.z = q * 40; });
    const destino = nodos[p.a], ox = o.x, oy = o.y, vx = v.x, vy = v.y;
    o.rayo = false; S.foco = o;
    await tween(1.8, (q) => { o.x = ox + (destino.x - ox) * q; o.y = oy + (destino.y - 50 - oy) * q; v.x = vx + (destino.x - vx) * q; v.y = vy + (destino.y - vy) * q; });
    o.rayo = true; o.suelo = destino.y; await tween(.8, (q) => { v.z = 40 * (1 - q); });
    LOTE.slice(IX + 1).filter((x) => x.k === 'hop' && x.modo === 'ovni').forEach(ya);
    v.z = 0; v.anda = false; o.rayo = false; acomodar();
    await decir(`👽 El ovni dejó a ${v.nom} en ${lugarDe(p.a)}. «Bip bup.»`, 1.6);
    const oy2 = o.y; tween(1.5, (q) => { o.y = oy2 - 120 * q; }).then(() => CRIAT.quitar(o));
  },
  oferta: async () => {
    const d = MAPA.DECO.find((x) => x.k === 'sambil'); if (d) { d.fiesta = 3; S.foco = { x: d.x + 15, y: d.y - 10 }; }
    await decir('🛍️ ¡GRAN OFERTA EN EL SAMBIL! Por 2 rondas todo a mitad de precio en las bodegas y la rifa del Sambil cuesta 3 Bs.', 2.2);
  },
  silbon: async (p) => {
    const n = nodos[p.nodo]; VIS.silb = CRIAT.add('silbon', { x: n.x, y: n.y }); S.foco = VIS.silb;
    for (let i = 0; i < 3; i++) { snd(1800 - i * 300, .35, 'sine', .05); await espera(.3); }
    await decir(`👻 Fiu fiu fiu… ¡EL SILBÓN anda por ${lugarDe(p.nodo)}! «Si lo oyes cerca, está lejos». El que pase por ahí pierde 10 Bs. Se va al amanecer.`, 2.6);
  },
  pesca: async (p) => {
    VIS.pesc = CRIAT.add('peces', { x: 120, y: 318 }); S.foco = VIS.pesc;
    LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === 'pesca').forEach((x) => { ya(x); plata(jug(x.s), x.d); });
    await decir(`🐟 ¡Pesca buena en Boca de Río! Los pescadores reparten: ${p.ganan.length ? p.ganan.map(nomDe).join(', ') + ' (en Macanao) reciben 5 Bs.' : 'pero no hay nadie en Macanao.'}`, 2);
  },
  virgen: async (p) => {
    VIS.proc = CRIAT.add('procesion', { cx: 520, cy: 236, rx: 34, ry: 18, u: 0, velas: deNoche() }); S.foco = { x: 520, y: 236 };
    LOTE.slice(IX + 1).filter((x) => (x.k === 'mon' && x.por === 'virgen') || (x.k === 'item' && x.que === 'virgen')).forEach(ya); sfx.plata();
    await decir(`⛪ ¡Procesión de la VIRGEN DEL VALLE por Porlamar! Todos reciben 3 Bs, y ${nomDe(p.peor)} (que va de último) recibe ${ITEMS[p.item].nom}.`, 2.4);
  },
  apagon: async () => {
    LOTE.slice(IX + 1).filter((x) => x.k === 'isla' && x.campo === 'apagon').slice(0, 1).forEach(ya);
    await efectoVisual(); await decir('⚡ ¡SE FUE LA LUZ EN TODA LA ISLA! Hasta la próxima ronda es como de noche: no sale la lancha y el peaje es doble.', 2.2);
  }
};
function efectoVisual() {
  const meta = { tarde: E.hora === 'tarde' && !E.apagon ? 1 : 0, noche: deNoche() ? 1 : 0, lluvia: E.lluvia ? 1 : 0 }, de = Object.assign({}, E.vis);
  return tween(1.4, (k) => { for (const c in meta) E.vis[c] = de[c] + (meta[c] - de[c]) * k; });
}

/* ───────── minijuegos: el reductor elige el juego y el formato; aquí la ruleta, el iframe y el podio ───────── */
const MJ = {   // solo para la ruleta (los candidatos que se ven girar); el juego que sale lo eligió el reductor
  ffa: ['f_abuela', 'f_bombita', 'f_cola', 'f_chancla', 'f_cerro', 'f_toro', 'f_harina', 'f_cotufas', 'f_tequeno', 'f_mecate', 'f_perro', 'f_bombillo', 'f_bolas', 'f_vagon'],
  '2v2': ['f_cava', 'f_futbolito', 'f_hallacas', 'f_cuerda', 'f_chocones', 'f_mudanza'],
  '1v3': ['f_bono', 'f_alcabala', 'f_guaya', 'f_patilla', 'f_silbon']
};
const MICROS = ['mango', 'hielo', 'tequenos', 'soplalo', 'baile', 'torta', 'pique', 'chancla', 'sopa', 'queso', 'parada', 'tendedero'];
const mjBox = document.getElementById('mj'); let mjF = document.getElementById('mjf'); const skip = document.getElementById('skip');
/* el foco va al iframe al abrirlo y al cargar: Espacio/Enter de la tarjeta de reglas solo llegan si el foco está adentro */
const enfocarFrame = () => { try { mjF.focus(); mjF.contentWindow.focus(); } catch (e) {} };
/* pantalla completa real en táctiles (iOS Safari no tiene fullscreen de elemento: se ignora); y avisar al juego de cada cambio de tamaño */
const avisarResize = () => { try { mjF.contentWindow.dispatchEvent(new Event('resize')); } catch (e) {} };
const TACTIL = matchMedia('(pointer:coarse)').matches;
/* DISEÑO: ya NO se pone #mj en pantalla completa por juego (en Android Chrome cada alternar fullscreen redimensiona el viewport, la 2.ª petición sin gesto se rechaza y deja la página sin toques).
   #mj es solo una capa fija de viewport completo; la única pantalla completa es la de la página, pedida en un toque (ver abajo) y nunca se sale de ella. */
function pantallaCompleta() {}
['resize', 'orientationchange'].forEach((ev) => addEventListener(ev, () => { if (mjBox.style.display !== 'none') { avisarResize(); setTimeout(avisarResize, 250); } }));
/* cada minijuego usa un iframe NUEVO: reusar el mismo (src -> about:blank -> src) deja en móvil el foco/toques del documento anterior y el botón de la tarjeta no responde */
function frameNuevo() { const f = document.createElement('iframe'); f.id = 'mjf'; f.setAttribute('allow', 'autoplay'); mjF.replaceWith(f); mjF = f; }
function abrirFrame(src) { resetToques(); frameNuevo(); mjBox.style.display = 'block'; mjF.onload = () => { enfocarFrame(); avisarResize(); }; mjF.src = src; enfocarFrame(); guardaCapa(mjF, 'minijuego'); enfocarFrame(); }
function cerrarFrame() { mjF.onload = null; mjBox.style.display = 'none'; frameNuevo(); resetToques(); window.focus(); }
/* guardia: pasados unos ms, el elemento (botón o iframe) debe ser lo más alto en su centro; si otra capa se lo come, avisa y la apaga */
function guardaCapa(el, que) {
  const mira = () => {
    try {
      if (!el.isConnected) return;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
      const top = document.elementFromPoint(x, y);
      if (!top || top === el || el.contains(top) || top.contains(el) || top === document.documentElement || top === document.body) return;
      console.warn('[margarita] capa que come toques sobre ' + que + ':', top.tagName + (top.id ? '#' + top.id : '') + (top.className ? '.' + top.className : ''));
      top.style.pointerEvents = 'none';
    } catch (e) {}
  };
  setTimeout(mira, 60); setTimeout(mira, 600);
}

/* la casilla M en local: el microjuego de campaña de verdad; el resultado lo manda el reductor como MICRO{gana} */
async function micro() {
  const id = pick(MICROS);
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
  if (res !== 'win') await decir('Perdiste el microjuego. ¡La próxima!', 1.2);
  return res;
}
/* URL del minijuego en iframe: nombres y personajes en orden de asiento (a = tú siempre) */
const urlMJ = (g, tipo, rol, asientos) => `../style-lab/fiesta.html?practica=${g}&embed=1&tipo=${tipo}&rol=${rol}&ch=tu&lv=1` +
  `&noms=${asientos.map((j) => encodeURIComponent(j.nom)).join(',')}&chs=${asientos.map((j) => j.ch).join(',')}`;
const barajar = (l) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const k = ri(0, i); [a[i], a[k]] = [a[k], a[i]]; } return a; };
const nomCol = (j) => `<b style="color:${j.c}">${j.nom}</b>`;
const COL_EQ = { azul: '#4f8fff', rojo: '#ff5a4f', ffa: '#ffd23f' };
const formatoDe = (f) => ({ tipo: f.tipo, lados: f.tipo === 'ffa' ? [JUG.slice()] : f.eq.map((l) => l.map(jug)) });
function equiposHtml(fm) {
  if (fm.tipo === 'ffa') return JUG.map(nomCol).join(' · ');
  return fm.lados.map((l) => `<span class="eq" style="--e:${COL_EQ[l[0].color]}">${l.map(nomCol).join(' + ')}</span>`).join('  <b>VS</b>  ');
}
const NOM_FM = (t) => (t === 'ffa' ? 'TODOS CONTRA TODOS' : t === '2v2' ? '2 VS 2' : '1 VS 3');
/* las piezas saltan y se marcan con el color de su equipo (como la revelación de equipos de MP) */
async function revelarEquipos(f) {
  const fm = formatoDe(f);
  S.foco = null; S.ritmo = 1;
  msg.style.display = 'block'; msgB.innerHTML = ''; msgT.innerHTML = `📣 <b class="host">¡EPA! ¡HORA DEL MINIJUEGO!</b>\n${NOM_FM(fm.tipo)}${E.carnaval ? ' · 🎉 CARNAVAL' : ''}: ${equiposHtml(fm)}`; pintarHud();
  S.equipo = new Map(JUG.map((j) => [j, fm.tipo === 'ffa' ? COL_EQ.ffa : COL_EQ[j.color]]));
  for (const j of fm.tipo === 'ffa' ? JUG : fm.lados.flat()) {
    snd(fm.tipo === 'ffa' ? 700 : j.color === 'azul' ? 620 : 420, .08);
    await tween(.28, (k) => { j.z = Math.sin(k * Math.PI) * 10; }); j.z = 0;
  }
  await espera(.6 * (TODO_CPU ? .6 : 1));
}
const podioEl = document.getElementById('podio');   // cartel grande sobre el tablero: ruleta y podio
/* ruleta: 4 candidatos del formato con el elegido entre ellos; frena en el elegido con el animador */
async function ruleta(tipo, cab, g) {
  const otros = barajar((MJ[tipo] || MJ.ffa).filter((x) => x !== g)).slice(0, 3), gi = ri(0, otros.length), cand = otros.slice(0, gi).concat([g], otros.slice(gi)), n = cand.length;
  const pintar = (on, linea, flash) => {
    podioEl.className = 'rul'; podioEl.style.display = 'flex';
    podioEl.innerHTML = `${cab}<div class="ru">${cand.map((c, i) => `<span class="${i === on ? (flash ? 'on fl' : 'on') : ''}">${nombreMJ(c)}</span>`).join('')}</div>`;
    msg.style.display = 'block'; msgB.innerHTML = ''; msgT.textContent = linea || '';
  };
  if (n > 1) {
    const fin = n * 3 + (((gi - 2) % n) + n) % n;
    for (let i = 0; i <= fin; i++) { pintar(i % n, '🎡 ¡Gira, gira, gira!'); sfx.dado(); await espera(.05 + Math.pow(i / fin, 2) * .22); }
    let at = fin % n;
    for (const l of ['🎤 «¡Esa no…', '🎤 «…esa no…']) { pintar(at, l); await espera(.55); at = (at + 1) % n; snd(900, .05); }
  }
  for (let k = 0; k < 4; k++) { pintar(gi, '🎤 «…¡ESA!» 🎉', k % 2 === 0); if (!k) sfx.gana(); await espera(.18); }
}
let ULT = null, DUELO = null;
async function cartaMJ(f) {
  ULT = f;
  const fm = formatoDe(f), eq = equiposHtml(fm), nomJ = nombreMJ(f.g);
  const cab = `<div class="fm">🎮 ${NOM_FM(fm.tipo)}${E.carnaval ? ' · 🎉 CARNAVAL' : ''}</div><div class="eqs">${eq}</div>`;
  await ruleta(fm.tipo, cab, f.g);
  podioEl.innerHTML = `${cab}<div class="ru"><span class="on">${nomJ}</span></div>`;
  await preguntar(`«${nomJ}» · ${fm.tipo === 'ffa' ? 'gana el mejor' : 'gana un equipo'}: +${f.premio} Bs`, [{ l: '¡A JUGAR!', v: 1 }], AUTO);
  podioEl.style.display = 'none'; callar();
}
async function cartaDuelo(f) {
  DUELO = f; const [a, b] = f.eq.map((l) => jug(l[0]));
  await preguntar(`⚔️ ¡BRONCA! ${a.nom} VS ${b.nom}\nApuesta: ${f.premio} Bs cada uno · «${nombreMJ(f.g)}»`, [{ l: '¡VAMOS!', v: 1 }], !a.yo && !b.yo || AUTO);
  callar();
}
/* el minijuego en vivo (local): el iframe de fiesta.html con tú en el asiento a; los puestos vuelven en el orden de mj.as */
async function jugarMJ() {
  const mj = D.mj, g = mj.cola[0].g, tu = jug(YO), as = mj.as.map(jug);
  let asientos, rol = 'solo', tipo = mj.tipo;
  if (tipo === 'ffa' || tipo === '1v1') asientos = [tu].concat(as.filter((j) => j !== tu));
  else if (tipo === '2v2') { const lados = mj.eq.map((l) => l.map(jug)), mio = lados.find((l) => l.includes(tu)), otro = lados.find((l) => l !== mio); asientos = [tu, mio.find((j) => j !== tu)].concat(otro); }
  else { const solo = jug(mj.solo), trio = as.filter((j) => j !== solo); if (solo === tu) asientos = [tu].concat(trio); else { rol = 'trio'; asientos = [tu, solo].concat(trio.filter((j) => j !== tu)); } }
  const pl = await new Promise((done) => {
    const oir = (e) => { if (e.data && e.data.k === 'mj-fin' && (!e.source || e.source === mjF.contentWindow)) { removeEventListener('message', oir); done(e.data.pl || []); } };
    addEventListener('message', oir);
    skip.onclick = () => { removeEventListener('message', oir); done([]); };
    abrirFrame(urlMJ(g, tipo, rol, asientos));
  });
  cerrarFrame();
  return pl.length === as.length ? as.map((j) => pl[asientos.indexOf(j)]) : null;
}
async function podio(titulo, asientos, pl, premio) {
  const puesto = asientos.map((j, k) => ({ j, p: pl[k] >= 1 && pl[k] <= 4 ? pl[k] : 4 }));
  const grupos = [...new Set(puesto.map((x) => x.p))].sort((a, b) => a - b).map((p) => ({ p, js: puesto.filter((x) => x.p === p).map((x) => x.j) }));
  const vis = grupos.length > 1 ? [grupos[1], grupos[0]].concat(grupos.slice(2)) : grupos;   // 2.º a la izquierda, 1.º en el centro
  const ALTO = { 1: 62, 2: 44, 3: 30, 4: 18 }, MET = { 1: '#ffd23f', 2: '#c8d4e0', 3: '#d8925a', 4: '#6a6a7a' };
  podioEl.className = 'pod';
  podioEl.innerHTML = `<div class="tit">🏆 «${titulo}»</div><div class="esc">${vis.map((g) => `<div class="col"><div class="who">${g.js.map((j) => `<div style="color:${j.c}">${j.nom}${j.yo ? ' ★' : ''}</div>`).join('')}${g.p === 1 && premio ? `<div class="pr">+${premio} Bs</div>` : ''}</div><div class="blk" data-h="${ALTO[g.p]}" style="--m:${MET[g.p]}">${g.p}.º</div></div>`).join('')}</div>`;
  podioEl.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => podioEl.querySelectorAll('.blk').forEach((b) => { b.style.height = b.dataset.h + '%'; })));
  sfx.gana();
  await decir(grupos[0].p === 1 ? `🏆 ${grupos[0].js.map((j) => j.nom).join(' + ')} ${grupos[0].js.length > 1 ? 'ganan' : 'gana'} el minijuego` : 'Nadie ganó. ¡Qué pena!', 2.2);
  podioEl.style.display = 'none';
}
/* monedas que vuelan a la pieza de cada ganador (desde arriba, o desde la pieza del que pierde); pagan al llegar */
async function monedas(ganan, premio, de) {
  if (!ganan.length || !premio) return;
  const N = Math.min(10, Math.max(4, premio >> 1)), Dur = 1.9;
  const xs = ganan.map((j) => j.x), ys = ganan.map((j) => j.y);   // la cámara se acerca si los ganadores caben en el cuadro
  const cerca = Math.max(...xs) - Math.min(...xs) < 140 && Math.max(...ys) - Math.min(...ys) < 60;
  S.foco = cerca ? { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 } : null;
  if (cerca) await espera(.5);
  const ms = [];
  ganan.forEach((j) => { for (let i = 0; i < N; i++) ms.push({ j, x0: de ? de.x : j.x + ri(-30, 30), y0: de ? de.y - 8 : j.y - 80 - ri(0, 20), del: i * .07 + R() * .05, dur: .55, u: 0, ok: false }); });
  S.monedas = ms;
  await tween(Dur, (k) => {
    const t = k * Dur;
    for (const m of ms) {
      m.u = clamp((t - m.del) / m.dur, 0, 1);
      if (m.u >= 1 && !m.ok) { m.ok = true; snd(1320 + R() * 200, .05, 'square', .03); }
    }
  });
  S.monedas = [];
  ganan.forEach((j) => MAPA.efx('texto', j.x, j.y - 18, { s: '+' + premio, c: '#ffd23f' }));
  sfx.gana();
}
function dibujarMonedas(t) {
  for (const m of S.monedas) {
    if (m.u <= 0 || m.ok) continue;
    const j = m.j, u = m.u, x = m.x0 + (j.x - m.x0) * u, y = m.y0 + (j.y - 10 - m.y0) * u - Math.sin(u * Math.PI) * (m.y0 < j.y - 40 ? 10 : 24);
    const c = Math.abs(Math.cos(t * 10 + m.del * 30)), ancho = c > .7 ? 5 : c > .3 ? 3 : 1, X = Math.round(x - ancho / 2), Y = Math.round(y);
    ctx.fillStyle = '#14101c'; ctx.fillRect(X - 1, Y - 3, ancho + 2, 7);
    ctx.fillStyle = '#d8a520'; ctx.fillRect(X, Y - 2, ancho, 5);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(X, Y - 2, ancho, 3);
    ctx.fillStyle = '#fff6b0'; ctx.fillRect(X, Y - 2, 1, 1);
  }
}
const pagosDe = (por) => LOTE.slice(IX + 1).filter((x) => x.k === 'mon' && x.por === por);
async function finMJ(f) {
  const asientos = f.as.map(jug), nomJ = nombreMJ(ULT ? ULT.g : ''), premio = ULT ? ULT.premio : 10;
  S.foco = null; callar();
  if (f.empate) { await decir('⚡ ¡Se cayó la señal! El minijuego quedó en el aire y nadie cobra.', 1.6); S.equipo = null; return; }
  const ganan = asientos.filter((j, k) => f.puestos[k] === 1);
  await podio(nomJ, asientos, f.puestos, premio);
  callar(); S.foco = null;
  await monedas(ganan, premio);
  pagosDe('mj').forEach(ya); pintarHud();
  if (ganan.length) await decir(`🏆 ${ganan.map((j) => j.nom).join(' + ')} ${ganan.length > 1 ? 'ganan' : 'gana'} +${premio} Bs`, 1.2);
  S.equipo = null; ULT = null;
  callar();
}
async function finDuelo(f) {
  const gana = jug(f.gana), pierde = jug(f.as.find((s) => s !== f.gana)), ap = Math.max(...f.pagos);
  pagosDe('bronca').filter((x) => x.d < 0).forEach(ya); plata(pierde, -ap); sfx.gana();
  S.foco = null; await monedas([gana], ap, pierde);
  pagosDe('bronca').forEach(ya); pintarHud();
  await decir(`⚔️ ¡${gana.nom} gana la bronca! Se lleva ${ap} Bs de ${pierde.nom}.`, 1.8);
  DUELO = null;
}
const NOMBRES = { f_abuela: '¡LA ABUELA DICE!', f_bombita: '¡AGUA EN CARNAVAL!', f_cola: '¡LA COLA DE LA GASOLINA!', f_chancla: '¡LLUEVEN CHANCLAS!', f_cerro: '¡SUBE EL CERRO!',
  f_domino: '¡CAPICÚA!', f_toro: '¡TOROS COLEADOS!', f_harina: '¡LA ÚLTIMA HARINA!', f_cotufas: '¡LLUEVEN COTUFAS!', f_tequeno: '¡TEQUEÑOS!', f_mecate: '¡SALTA EL MECATE!', f_perro: '¡PERRO CALIENTE CON TODO!',
  f_cava: '¡CARGA LA CAVA!', f_futbolito: '¡FUTBOLITO DE CALLE!', f_hallacas: '¡LA LÍNEA DE HALLACAS!', f_cuerda: '¡HALA LA CUERDA!', f_chocones: '¡CARRITOS CHOCONES!', f_mudanza: '¡LA MUDANZA!', f_bono: '¡SE LE CAE EL BONO!', f_alcabala: '¡LA ALCABALA DE MEDIANOCHE!',
  f_guaya: '¡LA GUAYA DEL TELEFÉRICO!', f_patilla: '¡BOMBAS DESDE EL BALCÓN!',
  f_bombillo: '¡SE VA LA LUZ!', f_bolas: '¡BOLAS CRIOLLAS!', f_vagon: '¡EL VAGÓN!', f_silbon: '¡EL SILBÓN EN EL LLANO!' };
const nombreMJ = (g) => NOMBRES[g] || g.replace(/^f_/, '').toUpperCase();

/* ───────── final ───────── */
async function final(f) {
  S.fin = true; S.foco = null;
  const ganador = jug(f.gan[0]);
  S.ganador = ganador; pintarHud();
  ganador.anda = true;
  const x0 = ganador.x, y0 = ganador.y;
  await tween(1.6, (k) => { ganador.x = x0 + (COCHE.x - x0) * k; ganador.y = y0 + (COCHE.y - 2 - y0) * k; ganador.z = Math.abs(Math.sin(k * Math.PI * 4)) * 8; });
  ganador.z = 0;
  for (let i = 0; i < 6; i++) lluvia(COCHE.x + ri(-30, 30), COCHE.y - 20);
  sfx.gana();
  const tabla = f.podio.map((x, k) => `${k + 1}. ${nomDe(x.s)}  🥟${x.emp}  ${x.bs} Bs`).join('\n');
  await preguntar(`🏆 ¡${ganador.nom} ${ganador.yo ? 'GANAS' : 'GANA'} LA FIESTA EN COCHE! 🏆\n\n${tabla}`, [{ l: EN_LINEA ? 'VOLVER AL MENÚ' : 'OTRA VEZ', v: 1 }]);
  if (!EN_LINEA) { location.reload(); return; }
  const N = MARGA.red.net(); N.leave(); try { localStorage.removeItem(N.K.SESION); } catch (e) {}   // la partida terminó: no hay a qué volver
  location.href = location.pathname;
}

/* ───────── bucle de la partida: pedirle al reductor el próximo lote y animarlo ───────── */
const secretos = [];   // los secretos tocados esperan al próximo hueco entre lotes (D tiene que coincidir con el reductor)
async function partida(intro = true) {
  pintarHud();
  if (intro) await preguntar('🏝️ ISLA DE MARGARITA 🏝️\nCompra EMPANADAS DE ORO (20 Bs) a la señora. Cruza por La Restinga o la lancha (el Fiscal cobra peaje).\nCuidado con el Bachaquero. Compra cosas en la BODEGA, paga el SAN, y ojo con el PÍCARO. El que tenga más empanadas gana.\n(Rueda o pellizca para hacer zoom · 🎥 cambia la cámara · ¡TOCA las cosas del mapa, hay 8 SECRETOS escondidos! · ESPACIO adelanta los mensajes)',
    [{ l: '¡ARRANCAR!', v: 1 }], TODO_CPU);
  for (let vueltas = 0; vueltas < 100000; vueltas++) {
    if (secretos.length) { await reproducir(LOCAL.libre({ t: 'SECRETO', n: secretos.shift() })); continue; }
    const esp = LOCAL.espera();
    if (esp === 'aviso') { await reproducir(LOCAL.jugar(await pedir(D.esp))); continue; }
    if (esp === 'carta') { await reproducir(LOCAL.listo()); continue; }
    if (esp === 'mj') { await reproducir(LOCAL.mjFin(await jugarMJ())); continue; }
    if (D.f === 'turno' && D.esp) await pensarCPU(D.esp);
    const fx = LOCAL.paso();
    if (fx === null) return;   // se acabó (la tarjeta final ya pasó con el efecto fin)
    await reproducir(fx);
  }
}

/* ───────── en línea (doc 14 M3): el servidor corre el reductor; aquí se anima su anillo de lotes y se contesta MI aviso ───────── */
const RED = MARGA.red;
// la próxima vez que cambie la sala (o 1 s, para volver a mirar)
function cambioRed() {
  return new Promise((res) => { const N = RED.net(); let off = null; const t = setTimeout(() => { off(); res(); }, 1000); off = N.onRoom(() => { clearTimeout(t); off(); res(); }); });
}
// la foto salta al tablero sin animar (llegué tarde, recargué o el anillo se recortó)
function resincronizar(B) {
  D = clon(B); TURNOS = B.tot;
  JUG.forEach((j) => { j.anda = false; j.z = 0; const q = nodos[j.en]; j.x = q.x; j.y = q.y; });
  S.senora = D.isla.senora; S.bacha = D.isla.bacha; S.puesto = D.isla.puesto; S.dado = null; S.flechas = null; S.bote = null; clearInterval(giro);
  if (D.t && D.t.s) S.activo = jug(D.t.s).i;
  acomodar(); efectoVisual(); pintarHud();
}
// mi aviso: los botones de siempre, contra el plazo del servidor; si vence (decide la CPU) o el aviso cambia, la pregunta se retira
async function pedirRed(e) {
  const N = RED.net(); let off = null;
  PLAZO_HASTA = e.hasta || null;
  const reloj = setInterval(pintarHud, 500);
  const cambio = new Promise((res) => { off = N.onRoom(() => { const B = N.board; if (!B || !B.esp || B.esp.id !== e.id) res(null); }); });
  const a = await Promise.race([pedir(e), cambio]);
  off(); clearInterval(reloj); PLAZO_HASTA = null;
  if (!a) { teclas = null; msgB.innerHTML = ''; S.flechas = null; callar(); pintarHud(); return; }
  const r = await N.act(a);
  if (!r.ok && !(r.data && r.data.dup)) toast(r.status === 0 ? '📡 Se cayó la señal, reintentando…' : '⏱️ Esa jugada ya no vale (se venció el plazo)');
}
// el aviso de otro (CPU o pana): la tarjeta de siempre mientras decide
let esperando = null;
async function esperarA(e) {
  if (esperando !== e.id) {
    esperando = e.id;
    const j = jug(e.s), f = CPU_DICE[e.k], t = f && f(e, j);
    msg.style.display = 'block'; msgB.innerHTML = ''; msgT.textContent = t || `⏳ ${j.nom} está decidiendo…`; S.foco = j; pintarHud();
  }
  await cambioRed();
}
// la tarjeta y el minijuego: el iframe de fiesta.html?r=CODE&mj=1 con su propia conexión; esta página se calla mientras tanto
async function minijuegoRed() {
  const N = RED.net(), enMJ = () => { const b = N.board; return !!b && (b.f === 'carta' || b.f === 'mj'); };
  callar(); podioEl.style.display = 'none';
  N.setVisible(false);
  await new Promise((done) => {
    let t = null;
    const fin = () => { removeEventListener('message', oir); clearInterval(t); done(); };
    const oir = (ev) => { if (ev.data && ev.data.k === 'mj-cerrar') fin(); };
    addEventListener('message', oir);
    t = setInterval(() => { if (!enMJ()) fin(); }, 400);
    abrirFrame(`../style-lab/fiesta.html?r=${N.room.code}&mj=1`);
  });
  cerrarFrame(); N.setVisible(true);
}
async function partidaRed() {
  const N = RED.net();
  for (;;) {
    const B = N.board;
    if (!B || !RED.esMargarita(N.room)) return;                      // la sala se cerró (onGone ya avisó)
    if (secretos.length && N.you) { await N.act({ t: 'SECRETO', n: secretos.shift() }); continue; }
    const p = RED.pendientes(D.ver, B);
    if (p.snap) { resincronizar(B); continue; }
    if (p.lotes.length) {
      PRISA = p.lotes.length > 2 ? 3 : p.lotes.length > 1 || (B.esp && B.esp.s === YO) ? 1.8 : 1;
      await reproducir(clon(p.lotes[0].fx)); PRISA = 1; esperando = null;
      continue;
    }
    if (B.f === 'fin') return;
    const e = RED.espera(B, N.you ? YO : null);
    if (e !== 'otro') esperando = null;
    if (e === 'mio') { await pedirRed(D.esp); continue; }
    if (e === 'otro') { await esperarA(D.esp); continue; }
    if (e === 'mj') { await minijuegoRed(); continue; }
    await cambioRed();
  }
}
// la carcasa llama esto cuando la sala arranca (o al volver a una partida empezada)
function enLinea() {
  const N = RED.net();
  EN_LINEA = true; AUTO = true; YO = N.you ? N.you.id : null;
  skip.style.display = 'none';
  resincronizar(N.board);
  N.onRoom(() => { const q = YO && N.board && N.board.pj[YO]; volverBtn.style.display = q && q.cpu === 'afk' ? '' : 'none'; });
  partidaRed();
}
const volverBtn = document.createElement('button');
volverBtn.className = 'no'; volverBtn.textContent = '🙋 VOLVER'; volverBtn.style.display = 'none';
volverBtn.onclick = () => { RED.net().back({}); volverBtn.style.display = 'none'; volverBtn.blur(); };
document.getElementById('ctl').appendChild(volverBtn);

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
    const n = nodos[b.en], y = n.y - 12 + Math.round(Math.sin(t * 4 + n.id) * 1.5);
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
function puestoDibujo(p, rol, t) {
  if (!p) return;
  ctx.fillStyle = '#6a4a2a'; ctx.fillRect(p.x + 4, p.y - 12, 1, 12);
  if (rol === 'senora') {   // sombrilla a rayas + carrito de madera con letrero de empanada + señora con pañuelo y delantal + vaho de la freidora
    const x = Math.round(p.x), y = Math.round(p.y) - 4, R = (rx, ry, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + rx, y + ry, w, h); };
    R(4, -16, 1, 18, '#6a4a2a');                                                           // palo de la sombrilla
    [[-20, 0, 9], [-19, -2, 13], [-18, -4, 17]].forEach(([ry, rx, w], k) => {          // domo de la sombrilla a rayas
      if (!k) R(rx, ry - 1, w, 1, '#14101c');
      R(rx - 1, ry, 1, 1, '#14101c'); R(rx + w, ry, 1, 1, '#14101c');
      for (let i = 0; i < w; i++) R(rx + i, ry, 1, 1, (rx + i + 8) % 4 < 2 ? '#d23b3b' : '#fffdf2');
    });
    for (let i = -4; i < 13; i += 2) R(i, -17, 1, 1, '#14101c');                          // festón
    R(-4, 1, 16, 9, '#14101c'); R(-3, 2, 14, 7, '#8a5a2a'); R(-3, 2, 14, 2, '#c98a4a'); R(-3, 8, 14, 1, '#6a4a2a');   // carrito de madera
    R(-1, 4, 9, 5, '#fff6b0'); sprite(EMPANADA_MINI, PAL_EMPICO, x, y + 5);                                       // letrero de la empanada al frente
    R(-1, 10, 4, 3, '#14101c'); R(0, 11, 2, 1, '#8a8a96'); R(7, 10, 4, 3, '#14101c'); R(8, 11, 2, 1, '#8a8a96');       // ruedas
    sprite(EMPANADA_MINI, PAL_EMPICO, x - 1, y - 3); sprite(EMPANADA_MINI, PAL_EMPICO, x + 6, y - 3);                  // bandeja a la vista
    sprite(SENORA, PAL_SENORA, x - 11, y + 1);
    for (let i = 0; i < 3; i++) {                                                         // vaho: se eleva en pasos de 2px y se desvanece
      const f = (t * 1.6 + i / 3) % 1, py = y - 5 - Math.floor(f * 8 / 2) * 2, px = x + 2 + i * 4 + (Math.floor(f * 4) % 2 ? 1 : 0);
      ctx.fillStyle = `rgba(255,253,242,${(1 - f * .85).toFixed(2)})`; ctx.fillRect(px, py, 2, 2); if (f < .5) ctx.fillRect(px + 1, py - 1, 1, 1);
    }
  } else {
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
  if (S.equipo && S.equipo.get(j)) {   // flechita del color del equipo
    const ex = Math.round(j.x), ey = Math.round(j.y - 18 - j.z - bob);
    ctx.fillStyle = '#14101c'; ctx.fillRect(ex - 3, ey - 1, 7, 4); ctx.fillStyle = S.equipo.get(j); ctx.fillRect(ex - 2, ey, 5, 1); ctx.fillRect(ex - 1, ey + 1, 3, 1); ctx.fillRect(ex, ey + 2, 1, 1);
  } else if (j.yo && !S.fin) { ctx.fillStyle = j.c; ctx.fillRect(Math.round(j.x), Math.round(j.y - 14 - j.z - bob), 1, 2); }
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
/* baliza de la empanadera: resplandor + empanada que rebota + cartel, en el mundo (se ve a cualquier zoom) */
function balizaEmpanada(t) {
  if (!SEN() || S.bote) return;
  const q = SEN(), v = CAM.vista, k = v && v.sw > W * .62 ? 2 : 1;   // vista general: icono al doble (píxeles enteros); de cerca: tamaño normal
  const cx = Math.round(q.x + 4), cy = Math.round(q.y + 7);
  ctx.fillStyle = 'rgba(20,16,28,.35)'; for (let i = 0; i < 9; i++) if (!(i & 1)) ctx.fillRect(cx - 4 + i, cy, 1, 1);   // sombrita fija de 1 fila tramada
  const b = Math.floor(t * 3) % 2 * 2;                                        // vaivén en pasos de 2px
  const oy = Math.round(q.y - 31 - (k - 1) * 8) - b;
  ctx.save(); ctx.translate(cx, oy); ctx.scale(k, k);
  ctx.fillStyle = '#14101c'; ctx.fillRect(-23, -18, 47, 9); ctx.fillStyle = '#d23b3b'; ctx.fillRect(-22, -17, 45, 7);   // cinta roja con borde de tinta
  ctx.fillStyle = '#ff6a5a'; ctx.fillRect(-22, -17, 45, 1);
  ctx.fillStyle = '#14101c'; ctx.fillRect(-26, -16, 3, 7); ctx.fillRect(24, -16, 3, 7); ctx.fillStyle = '#a82a2a'; ctx.fillRect(-25, -15, 3, 5); ctx.fillRect(24, -15, 2, 5);   // colas de la cinta
  texto('EMPANADERA', 0, -16, '#fffdf2', 1, '#14101c');                         // mismo tipo de letra de los globos, con sombra
  sprite(EMPANADA_ICO, PAL_EMPICO, -7, -8);                                    // la empanada dorada
  ctx.fillStyle = '#14101c'; ctx.fillRect(-2, 1, 5, 1); ctx.fillRect(-1, 2, 3, 1); ctx.fillRect(0, 3, 1, 1);   // punta que señala al puesto
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(-1, 1, 3, 1); ctx.fillRect(0, 2, 1, 1);
  ctx.restore();
}
/* flechas en el borde de la pantalla hacia lo que quedó fuera de cuadro: la empanadera y el jugador en turno */
function guiaFuera(t) {
  const v = CAM.vista; if (!v || (v.sw >= W - 1 && v.sh >= H - 1)) return;
  const act = JUG[S.activo], objs = [];
  if (SEN() && !S.bote) { const p = SEN(), n = pasosEmpanada(act); objs.push({ x: p.x + 4, y: p.y - 20, c: '#ffd23f', ico: '🥟', tx: n !== null ? n + (n === 1 ? ' PASO' : ' PASOS') : 'OTRA ISLA', pri: 1 }); }
  if (act && !S.fin) objs.push({ x: act.x, y: act.y - 10, c: act.c, ico: '', tx: act.yo ? 'TU' : act.nom, pri: 0 });
  const sx = cv.width / v.sw, sy = cv.height / v.sh, cw = cv.width, ch = cv.height, u = cw / V0.sw, m = 16 * u;
  const ls = document.getElementById('wrap').classList.contains('ls'), mt = ls ? ch * .17 : m, mb = ls && msg.style.display !== 'none' ? ch * .3 : m;   // en horizontal el HUD y los mensajes se montan sobre el lienzo
  objs.forEach((o, k) => {
    const px = (o.x - v.sx) * sx, py = (o.y - v.sy) * sy;
    if (px > 0 && px < cw && py > 0 && py < ch) return;
    const cy = (mt + ch - mb) / 2, dx = px - cw / 2, dy = py - cy, e = Math.min((cw / 2 - m) / Math.abs(dx || 1e-6), ((ch - mt - mb) / 2) / Math.abs(dy || 1e-6));
    const ax = cw / 2 + dx * e, ay = cy + dy * e, a = Math.atan2(dy, dx), pu = Math.round(Math.sin(t * 6) * 3 * u);
    vctx.save(); vctx.translate(Math.round(ax + Math.cos(a) * pu), Math.round(ay + Math.sin(a) * pu)); vctx.rotate(a); vctx.scale(u * 1.6, u * 1.6);
    vctx.fillStyle = '#14101c'; vctx.beginPath(); vctx.moveTo(12, 0); vctx.lineTo(-7, -9); vctx.lineTo(-7, 9); vctx.closePath(); vctx.fill();
    vctx.fillStyle = o.c; vctx.beginPath(); vctx.moveTo(9, 0); vctx.lineTo(-5, -6); vctx.lineTo(-5, 6); vctx.closePath(); vctx.fill();
    vctx.restore();
    const lbl = o.tx, pxs = Math.max(1, Math.round(u * 1.5)), icw = o.ico ? 15 * pxs + 3 * u : 0;   // la empanada va dibujada en píxeles
    vctx.font = 'bold ' + Math.round(11 * u * 1.5) + 'px monospace'; vctx.textBaseline = 'middle';
    const bh = 14 * u * 1.5, tw = vctx.measureText(lbl).width + 10 * u + icw, bx = Math.round(clamp(ax - Math.cos(a) * 34 * u - tw / 2, 2, cw - tw - 2)), by = Math.round(clamp(ay - Math.sin(a) * 34 * u - bh / 2, mt - 10 * u, ch - mb - bh + 10 * u));
    vctx.fillStyle = '#14101c'; vctx.fillRect(bx, by, tw, bh); vctx.fillStyle = o.c; vctx.fillRect(bx, by, tw, 2 * u); vctx.fillRect(bx, by + bh - 2 * u, tw, 2 * u);
    vctx.fillStyle = '#fffdf2'; vctx.fillText(lbl, bx + 5 * u + icw, by + bh / 2 + u);
    if (o.ico) { const ox = Math.round(bx + 3 * u), oy = Math.round(by + (bh - 8 * pxs) / 2); EMPANADA_ICO.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = row[i]; if (c === '.') continue; vctx.fillStyle = PAL_EMPICO[c]; vctx.fillRect(ox + i * pxs, oy + j * pxs, pxs, pxs); } }); }
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
    const w = tweens[i]; w.t += dt * VEL * PRISA; const k = Math.min(1, w.t / w.d); w.f(k);
    if (k >= 1) { tweens.splice(i, 1); w.r(); }
  }
  MAPA.dibujarMar(T, dt);
  for (const n of nodos) { if (n.cruce === 'lancha') boya(n, T); casilla(n, T); }
  MAPA.dibujarDeco(T);
  MAPA.dibujarNPCs(T, SEN(), S.bacha);
  if (SEN()) puestoDibujo(SEN(), 'senora', T);
  if (S.bacha) puestoDibujo(PUESTOS[S.bacha], 'bacha', T);
  balizaEmpanada(T);
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
  flechas(T); dado(T); dibujarMonedas(T); particulas(dt);
  camara(dt);
  spotDibuja(dt);
  if (SPOT.a < .05) guiaFuera(T);
}

/* ───────── cámara: sigue al que juega (zoom 2x), vista general en los anuncios; rueda/pellizco/arrastre = cámara libre ───────── */
const CAM = { x: W / 2, y: H / 2, z: 1, modo: 'auto' };
let V0 = { sw: W, sh: H };   // ventana de mundo a zoom 1 = «cover» del viewport sobre el mundo 640x360 (ajustar() la recalcula); a zoom z se ve V0/z

const camBtn = document.getElementById('cam');
function camModo(m) { CAM.modo = m; camBtn.textContent = m === 'auto' ? '🎥 AUTO' : m === 'mapa' ? '🗺️ MAPA' : '✋ LIBRE'; }
camBtn.onclick = (e) => { camModo(CAM.modo === 'auto' ? 'mapa' : 'auto'); e.target.blur(); };   // LIBRE (zoom/arrastre manual) y MAPA → AUTO; AUTO → MAPA
function camara(dt) {
  let tx = W / 2, ty = H / 2, tz = 1;
  if (V0.sw < W - 1 || V0.sh < H - 1) { const a = JUG[S.activo]; if (a && !S.fin) { tx = a.x; ty = a.y; } }   // vista general recortada (pantalla más ancha/angosta que 16:9): el recorte sigue al que juega
  if (SPOT.on) { const q = SPOT.sigue && S.foco ? S.foco : SPOT; tx = q.x; ty = q.y - 4; tz = SPOT.z; }
  else if (CAM.modo === 'auto' && S.foco) { tx = S.foco.x; ty = S.foco.y - 10; tz = 2; }
  else if (CAM.modo === 'libre') { tx = CAM.lx; ty = CAM.ly; tz = CAM.lz; }
  const k = 1 - Math.pow(.02, dt);
  CAM.z += (tz - CAM.z) * k; CAM.x += (tx - CAM.x) * k; CAM.y += (ty - CAM.y) * k;
  if (Math.abs(CAM.z - tz) < .01) CAM.z = tz;
  const sw = V0.sw / CAM.z, sh = V0.sh / CAM.z, sx = clamp(CAM.x - sw / 2, 0, W - sw), sy = clamp(CAM.y - sh / 2, 0, H - sh);
  vctx.drawImage(mundoCv, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  CAM.vista = { sx, sy, sw, sh };
}
/* evento: la cámara hace zoom (camara()) y listo; aquí solo un cartel chico arriba y, si hace falta señalar el punto exacto, una flechita de píxeles que rebota (nada de círculos ni oscurecer) */
function spotDibuja(dt) {
  SPOT.a = clamp(SPOT.a + (SPOT.on ? dt * 4 : -dt * 3), 0, 1); if (SPOT.a <= 0) return;
  SPOT.t += dt; const v = CAM.vista, a = SPOT.a, cw = cv.width, ch = cv.height, u = cw / V0.sw, sx = cw / v.sw, sy = ch / v.sh;
  const q = SPOT.sigue && S.foco ? S.foco : SPOT, px = (q.x - v.sx) * sx, py = (q.y - v.sy) * sy;
  const ls = document.getElementById('wrap').classList.contains('ls'), mt = ls ? ch * .17 : 8 * u, mb = ls && msg.style.display !== 'none' ? ch * .3 : 8 * u;
  vctx.save(); vctx.globalAlpha = a;
  if (SPOT.ring && SPOT.a > .5 && SPOT.t > .45 && px > 0 && px < cw && py > mt && py < ch - mb) {   // chevrón de 7x4 píxeles (x u*1.5) sobre el punto, rebota de a pasos enteros
    const k = Math.max(1, Math.round(u * 1.5)), bob = (Math.floor(SPOT.t * 4) % 2) * k, ax = Math.round(px - 3.5 * k), ay = Math.round(py - 9 * sy - 5 * k - bob);
    const fila = [[0, 7], [1, 5], [2, 3], [3, 1]];
    vctx.fillStyle = '#14101c'; fila.forEach(([j, n]) => vctx.fillRect(Math.round(ax + (7 - n) / 2 * k - k), ay + j * k - k, (n + 2) * k, 3 * k));
    vctx.fillStyle = SPOT.c; fila.forEach(([j, n]) => vctx.fillRect(Math.round(ax + (7 - n) / 2 * k), ay + j * k, n * k, k));
  }
  /* cartel chico: entra con un rebote corto y se ajusta al ancho */
  const pop = SPOT.t < .25 ? 1 + Math.sin(SPOT.t / .25 * Math.PI) * .12 : 1;
  let fs = Math.round(8 * u * 1.5); vctx.font = 'bold ' + fs + 'px monospace';
  const max = cw - 24 * u; let tw = vctx.measureText(SPOT.b).width + 14 * u; if (tw > max) { fs = Math.floor(fs * max / tw); vctx.font = 'bold ' + fs + 'px monospace'; tw = vctx.measureText(SPOT.b).width + 14 * u; }
  const bh = fs + 8 * u, cx = cw / 2, cy = Math.min(mt + bh / 2 + 4 * u, ch - mb - bh / 2);
  vctx.translate(cx, cy + (1 - a) * -10 * u); vctx.scale(pop, pop);
  vctx.fillStyle = '#14101c'; vctx.fillRect(-tw / 2 - 2 * u, -bh / 2 - 2 * u, tw + 4 * u, bh + 4 * u);
  vctx.fillStyle = SPOT.c; vctx.fillRect(-tw / 2, -bh / 2, tw, bh);
  vctx.fillStyle = '#14101c'; vctx.fillRect(-tw / 2 + 2 * u, -bh / 2 + 2 * u, tw - 4 * u, bh - 4 * u);
  vctx.textAlign = 'center'; vctx.textBaseline = 'middle'; vctx.fillStyle = '#fffdf2'; vctx.fillText(SPOT.b, 0, 1 * u);
  vctx.restore();
}
function aMundo(e) { const r = cv.getBoundingClientRect(), v = CAM.vista; return { x: v.sx + (e.clientX - r.left) / r.width * v.sw, y: v.sy + (e.clientY - r.top) / r.height * v.sh }; }
function libre() { if (CAM.modo !== 'libre') { CAM.lx = CAM.x; CAM.ly = CAM.y; CAM.lz = CAM.z; camModo('libre'); } }
const ZMAX = 3;
function topeLibre() { CAM.lz = clamp(CAM.lz, 1, ZMAX); const hw = V0.sw / CAM.lz / 2, hh = V0.sh / CAM.lz / 2; CAM.lx = clamp(CAM.lx, hw, W - hw); CAM.ly = clamp(CAM.ly, hh, H - hh); }
// fracción (0..1) del canvas bajo un punto de pantalla, y punto del mundo bajo esa fracción en la vista OBJETIVO (libre)
function fracCv(cx, cy) { const r = cv.getBoundingClientRect(); return { fx: (cx - r.left) / r.width, fy: (cy - r.top) / r.height }; }
function mundoLibre(fx, fy) { return { x: CAM.lx + (fx - .5) * V0.sw / CAM.lz, y: CAM.ly + (fy - .5) * V0.sh / CAM.lz }; }
function zoomEn(cx, cy, z2) {   // zoom manteniendo fijo el punto del mundo bajo (cx,cy)
  const { fx, fy } = fracCv(cx, cy), p = mundoLibre(fx, fy);
  CAM.lz = clamp(z2, 1, ZMAX); CAM.lx = p.x - (fx - .5) * V0.sw / CAM.lz; CAM.ly = p.y - (fy - .5) * V0.sh / CAM.lz; topeLibre();
}
cv.addEventListener('wheel', (e) => {
  e.preventDefault(); libre();
  zoomEn(e.clientX, e.clientY, CAM.lz * Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0015)));
}, { passive: false });
['gesturestart', 'gesturechange', 'gestureend'].forEach((n) => document.addEventListener(n, (e) => e.preventDefault(), { passive: false }));   // iOS: nada de zoom de página
const dedos = new Map();
let gesto = false;
function resetToques() { dedos.clear(); gesto = false; }   // hubo 2+ dedos en este toque → al soltar no cuenta como tap
cv.addEventListener('pointerdown', (e) => {
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  dedos.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
  if (dedos.size > 1) gesto = true;
});
cv.addEventListener('pointermove', (e) => {
  const d = dedos.get(e.pointerId); if (!d) return;
  const r = cv.getBoundingClientRect();
  if (dedos.size === 1) {
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) {
      libre(); const sw = V0.sw / CAM.lz, sh = V0.sh / CAM.lz;
      CAM.lx -= (e.clientX - d.x) / r.width * sw; CAM.ly -= (e.clientY - d.y) / r.height * sh; topeLibre();
    }
  } else if (dedos.size === 2) {
    const [a0, b0] = [...dedos.values()];
    const a = dedos.get(e.pointerId) === a0 ? { x: e.clientX, y: e.clientY } : a0, b = dedos.get(e.pointerId) === b0 ? { x: e.clientX, y: e.clientY } : b0;
    const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y), d1 = Math.hypot(a.x - b.x, a.y - b.y);
    if (d0 > 10 && d1 > 10) {
      libre();
      const f0 = fracCv((a0.x + b0.x) / 2, (a0.y + b0.y) / 2), f1 = fracCv((a.x + b.x) / 2, (a.y + b.y) / 2), p = mundoLibre(f0.fx, f0.fy);
      CAM.lz = clamp(CAM.lz * d1 / d0, 1, ZMAX);   // el punto entre los dedos queda pegado a ellos (zoom + arrastre de 2 dedos)
      CAM.lx = p.x - (f1.fx - .5) * V0.sw / CAM.lz; CAM.ly = p.y - (f1.fy - .5) * V0.sh / CAM.lz; topeLibre();
    }
  }
  d.x = e.clientX; d.y = e.clientY;
});
const suelta = (e) => {
  const d = dedos.get(e.pointerId); dedos.delete(e.pointerId);
  const fue = gesto; if (!dedos.size) gesto = false;
  if (!d || fue || e.type === 'pointercancel' || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6 || dedos.size) return;
  const p = aMundo(e), r = MAPA.tocar(p.x, p.y); if (!r) return;
  const S2 = { coco: [300, .08], pio: [1400, .05], ay: [500, .1], toc: [200, .05], beep: [900, .05], campana: [520, .5], bum: [70, .4], fiesta: [880, .15], brillo: [1600, .1], bocina: [140, .5], burro: [260, .35], agua: [600, .06], silbido: [1800, .4], secreto: [1320, .3] }[r.sonido] || [700, .05];
  snd(S2[0], S2[1], r.sonido === 'bocina' || r.sonido === 'burro' ? 'sawtooth' : r.sonido === 'campana' || r.sonido === 'silbido' ? 'sine' : 'square', .05);
  if (r.historia && !r.secreto) toast('📜 ' + r.historia);
  if (r.secreto) {
    const yo = jug(YO || 'a'), n = MAPA.SECRETOS.findIndex((q) => q.nom === r.secreto);
    if (yo && yo.yo && n >= 0) { secretos.push(n); if (r.hallados === r.total) sfx.gana(); }   // lo cobra el reductor en el próximo hueco
    toast(`🔍 ¡SECRETO ${r.hallados}/${r.total}! Encontraste ${r.secreto}. +3 Bs${r.hallados === r.total ? ' · ¡LOS ENCONTRASTE TODOS! +1 EMPANADA 🥟' : ''}`);
    pintarHud();
  }
};
const toastEl = document.getElementById('toast');
function toast(s) { toastEl.textContent = s; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), 3200); }
cv.addEventListener('pointerup', suelta); cv.addEventListener('pointercancel', suelta);
cv.addEventListener('lostpointercapture', (e) => { dedos.delete(e.pointerId); if (!dedos.size) gesto = false; });
addEventListener('touchcancel', () => resetToques(), true);
addEventListener('blur', () => resetToques());

/* ───────── tamaño ───────── */
function ajustar() {
  const wrap = document.getElementById('wrap'), st = document.getElementById('stage'), top = document.getElementById('top'), mb = document.getElementById('msgbox');
  const ls = innerWidth > innerHeight;   // horizontal (teléfono, tablet o escritorio): el mundo LLENA la pantalla de borde a borde; HUD y mensajes se montan encima
  wrap.classList.toggle('ls', ls);
  let A = 16 / 9;
  if (ls) {
    A = innerWidth / innerHeight;
    st.style.width = innerWidth + 'px'; st.style.height = innerHeight + 'px'; top.style.width = mb.style.width = '';
  } else {
    const s = Math.min((innerWidth - 12) / W, (innerHeight - top.offsetHeight - mb.offsetHeight - 30) / H), e = s >= 2 ? Math.floor(s) : s;
    st.style.width = W * e + 'px'; st.style.height = H * e + 'px'; top.style.width = mb.style.width = W * e + 'px';
  }
  // «cover»: la ventana de mundo a zoom 1 tiene la proporción de la pantalla (más ancha que 16:9 → recorta arriba/abajo; más cuadrada → recorta a los lados) y el lienzo es 2 px por pixel de mundo
  const sw0 = A >= W / H ? W : H * A, sh0 = A >= W / H ? W / A : H, cw = Math.round(sw0 * 2), ch = Math.round(sh0 * 2);
  V0 = { sw: sw0, sh: sh0 };
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; vctx.imageSmoothingEnabled = false; }
  const rot = document.getElementById('rot'); if (rot) rot.classList.toggle('on', !ls && innerHeight > innerWidth);
}
addEventListener('orientationchange', () => setTimeout(ajustar, 200));
/* en el teléfono, el primer toque pide pantalla completa (iPhone no tiene: se salta); al girar ya llena todo */
if (matchMedia('(pointer:coarse)').matches) {
  let intentos = 0;
  addEventListener('pointerup', function full() {   // activación de usuario = pointerup en táctil; pasivo, nunca bloquea ni altera el toque; se reintenta pocas veces si no quedó en pantalla completa; nunca se sale
    const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!rq || intentos >= 4 || document.fullscreenElement || document.webkitFullscreenElement) return;
    intentos++;
    try { const p = rq.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch (_) {}
  }, { capture: true, passive: true });
}
addEventListener('resize', ajustar); pintarHud(); ajustar();
acomodar();
requestAnimationFrame(cuadro);
// con la carcasa (shell.js) el tablero espera a ¡ARRANCAR!, que ya explicó las reglas; ?cpu=1 y ?turnos=N siguen entrando directo
const carcasa = !!window.MARGARITA_SHELL && !TODO_CPU && !Q.has('turnos');
if (!carcasa) { if (window.MARGARITA_SHELL) window.MARGARITA_SHELL.hide(); partida(); }
window.MARGARITA = { SPOT, SPOTS, FX, NOTICIA, EVENTO, reproducir, abrirFrame, cerrarFrame, S, JUG, nodos, PEAJES, E, CAM, ITEMS, MJ, urlMJ, LOCAL, enLinea, get D() { return D; }, get YO() { return YO; }, get enLineaOn() { return EN_LINEA; },
  arrancar: (n) => { nueva(n); JUG.forEach((j) => { const q = nodos[j.en]; j.x = q.x; j.y = q.y; }); partida(false); } };
})();
