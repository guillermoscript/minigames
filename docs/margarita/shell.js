'use strict';
/* Isla de Margarita · la carcasa de MiniCaos (docs/ui/01-menu-redesign.md, W4). Antes del tablero, una pantalla con el kit de menús
   (js/ui/mcui.js): JUGAR (SOLO: cuántos turnos, ¡ARRANCAR!; CON PANAS: armar sala o unirse con código) y REGLAS, el mismo VOLVER
   y las mismas teclas que el resto del juego. Durante la partida, Esc pregunta si te vas.
   SOLO: al arrancar se llama MARGARITA.arrancar(turnos). CON PANAS (doc 14 M3): la sala de LA FIESTA con board.tab 'margarita'
   (MARGA.red.net(), fiesta-net.js); aquí va su lobby (código, asientos, personaje, turnos, listo, empezar) y, cuando el servidor
   arranca la partida, MARGARITA.enLinea(). ?r=CODE entra directo a esa sala; una sesión guardada de Margarita se retoma sola.
   Se carga ANTES de margarita.js (que ve window.MARGARITA_SHELL y espera en vez de arrancar solo), y DESPUÉS de fiesta-net.js y margarita-red.js. */
window.MARGARITA_SHELL = (function () {
  const cv = document.createElement('canvas'); cv.id = 'shell';
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:30;touch-action:none;image-rendering:pixelated';
  document.body.appendChild(cv);
  const X = cv.getContext('2d');
  const T = (s, o) => (typeof t === 'function' ? t(s, o) : s);
  const JUGADORES = [['TÚ', '#ffd23f'], ['MAMÁ', '#ff6fa8'], ['ABUELA', '#b88aff'], ['PANA', '#5cd27a']];   // los de margarita.js (JUG)
  let on = true, modo = 'menu', tab = 0, turnos = 10, st = 0, now = 0, last = 0, leaving = null, arrive = null, L = { w: 800, h: 600, ox: 0, tall: false };
  let msg = '', msgCol = '#FF4D4D', cargando = '', codeSlot = null;
  try { arrive = sessionStorage.getItem('mc-wipe'); sessionStorage.removeItem('mc-wipe'); } catch (e) {}

  function fit() {
    const tall = innerHeight > innerWidth * 1.05;
    if (tall) L = { w: 400, h: Math.round(400 * innerHeight / innerWidth), ox: 0, tall: true };
    else { const vw = Math.round(600 * Math.max(800 / 600, innerWidth / innerHeight)); L = { w: 800, h: 600, ox: (vw - 800) / 2, tall: false }; }
    const cw = L.w + 2 * L.ox;
    if (cv.width !== cw) cv.width = cw;
    if (cv.height !== L.h) cv.height = L.h;
  }
  addEventListener('resize', fit); fit();
  const pt = e => ({ x: e.clientX / innerWidth * cv.width - L.ox, y: e.clientY / innerHeight * cv.height, touch: e.pointerType === 'touch' });
  const home = () => '../../?worlds=1&from=margarita&lang=' + encodeURIComponent(typeof I18N !== 'undefined' ? I18N.lang : 'es');
  function leave() { if (leaving) return; try { sessionStorage.setItem('mc-wipe', MCUI.WORLD.margarita); } catch (e) {} leaving = { t0: now }; }
  function go(k) { modo = k; st = 0; }
  function hide() { on = false; cv.style.display = 'none'; inCode.style.display = 'none'; }
  function start() {
    hide();
    if (window.MARGARITA) window.MARGARITA.arrancar(turnos);
  }

  /* ───────── CON PANAS: la sala ───────── */
  const RED = window.MARGA && window.MARGA.red, net = () => (RED ? RED.net() : null);
  const yo = RED ? RED.invitado() : { name: 'PANA', color: '#5CFF7A' };
  const ERR = { 'Need at least 2 players': 'YOU NEED AT LEAST ONE FRIEND', 'Not everybody is ready': 'NOT EVERYBODY IS READY',
    'Character taken': 'THAT CHARACTER IS TAKEN', 'Room not found': 'ROOM NOT FOUND', 'Room is full': 'THE ROOM IS FULL', 'Server unreachable': 'NO CONNECTION. TRY AGAIN' };
  const err = (r) => ERR[r && r.data && r.data.error] || (r && r.status === 0 ? ERR['Server unreachable'] : 'SOMETHING WENT WRONG. TRY AGAIN');
  const fail = (s) => { msg = s; msgCol = '#FF4D4D'; };
  function trasEntrar(r) {
    cargando = '';
    const N = net();
    if (!r || !r.ok) { go('menu'); fail(err(r)); return; }
    if (!RED.esMargarita(N.room)) { N.leave(); go('menu'); fail('THAT CODE IS FOR ANOTHER GAME'); return; }
    if (N.board.f === 'fin') { N.leave(); try { localStorage.removeItem(N.K.SESION); } catch (e) {} go('menu'); fail('THAT GAME IS OVER'); return; }
    msg = '';
    if (N.board.f === 'lobby') go('sala'); else enPartida();
  }
  function enPartida() { if (!on) return; hide(); if (window.MARGARITA) window.MARGARITA.enLinea(); }
  function crearSala() {
    const N = net(); if (!N || cargando) return;
    go('carga'); cargando = 'MAKING THE ROOM...';
    N.create({ name: yo.name, color: yo.color, cfg: { tab: RED.TAB, tot: turnos } }).then(trasEntrar, () => trasEntrar(null));
  }
  // una sola caja de código: el servidor dice de qué tablero es (kind); los códigos de otros juegos no entran aquí
  function unirse(code) {
    const N = net(); code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (!N || cargando) return;
    if (code.length !== 4) { fail('TYPE THE 4-LETTER ROOM CODE'); return; }
    go('carga'); cargando = T('JOINING {code}...', { code }); inCode.blur();
    fetch((window.CLAUDEWARE_API || '') + '/api/party/kind/' + code).then((r) => (r.ok ? r.json() : r.status === 404 ? { kind: 'none' } : {}), () => ({}))
      .then((k) => {
        if (k.kind === 'none') return trasEntrar({ ok: false, status: 404, data: { error: 'Room not found' } });
        if (k.kind && (k.kind !== 'fiesta' || k.tab !== RED.TAB)) { cargando = ''; go('menu'); fail('THAT CODE IS FOR ANOTHER GAME'); return; }
        const s = N.session(), p = s && s.code === code ? N.resume() : N.join(code, { name: yo.name, color: yo.color });   // mi asiento guardado: reentrada
        return p.then(trasEntrar, () => trasEntrar(null));
      });
  }
  function salirSala() { const N = net(); if (N) N.leave(); go('menu'); msg = ''; }
  function invitacion() { const N = net(); return location.origin + location.pathname + '?r=' + (N && N.room ? N.room.code : ''); }
  function copiar() {
    const u = invitacion(), ok = () => MCUI.toast('LINK COPIED! SEND IT TO YOUR FRIENDS', 'go');
    if (navigator.share && matchMedia('(pointer:coarse)').matches) { navigator.share({ title: 'ISLA DE MARGARITA', url: u }).catch(() => {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(ok, () => MCUI.toast(u, 'gold')); else MCUI.toast(u, 'gold');
  }
  if (RED) {
    const N = net();
    N.onRoom((room) => { if (on && modo === 'sala' && room && room.board && room.board.f !== 'lobby') enPartida(); });
    N.onGone(() => {
      if (!on) { location.href = location.pathname; return; }   // la sala desapareció a mitad de partida: de vuelta al menú de la isla
      go('menu'); fail('THE ROOM CLOSED');
    });
  }

  /* el código se escribe en un <input> de verdad, puesto encima de su ranura (como el JOIN del menú principal) */
  const inCode = document.createElement('input');
  inCode.maxLength = 4; inCode.autocapitalize = 'characters'; inCode.autocomplete = 'off'; inCode.spellcheck = false; inCode.placeholder = 'ABCD';
  inCode.style.cssText = 'position:fixed;z-index:31;display:none;border:0;background:transparent;color:#FFE14D;text-align:center;font-family:"Press Start 2P",monospace;text-transform:uppercase;outline:none;padding:0;letter-spacing:.3em';
  inCode.addEventListener('input', () => { inCode.value = inCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
  inCode.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); unirse(inCode.value); } e.stopPropagation(); });
  document.body.appendChild(inCode);
  function placeInput() {
    const show = on && modo === 'menu' && tab === 0 && !!codeSlot && !leaving;
    inCode.style.display = show ? 'block' : 'none';
    if (!show) return;
    const [x, y, w, h] = codeSlot, kx = innerWidth / cv.width, ky = innerHeight / cv.height, s = inCode.style;
    s.left = (x + L.ox) * kx + 'px'; s.top = y * ky + 'px'; s.width = w * kx + 'px'; s.height = h * ky + 'px'; s.fontSize = h * ky * .36 + 'px';
  }

  /* ───────── pantallas ───────── */
  function playerRow(x, y, w) {
    const bw = (w - 3 * 8) / 4;
    JUGADORES.forEach(([n, c], i) => {
      MCUI.notch(x + i * (bw + 8) - 2, y - 2, bw + 4, 64, 2, MCUI.INK); MCUI.notch(x + i * (bw + 8), y, bw, 60, 0, '#171c34');
      MCUI.notch(x + i * (bw + 8), y, bw, 6, 0, c);
      MCUI.text(n, x + i * (bw + 8) + bw / 2, y + 28, 8, c, 'center', bw - 8);
      MCUI.text(i ? 'CPU' : '1P', x + i * (bw + 8) + bw / 2, y + 46, 8, '#ddd', 'center', bw - 8);
    });
  }
  function drawJugar(x, y, w) {
    MCUI.panel(x, y, w, 120, { band: MCUI.WORLD.margarita });
    MCUI.text('1 + 3 CPU', x + 20, y + 30, 16, MCUI.WORLD.margarita, 'left', w - 40);
    playerRow(x + 20, y + 48, w - 40);
    y += 144;
    MCUI.text('TURNS', x, y + 10, 8, '#ddd', 'left');
    [10, 15, 20].forEach((n, i) => MCUI.btn('turnos-' + n, x + i * ((w + 12) / 3), y + 24, (w + 12) / 3 - 12, 56, String(n), () => { turnos = n; }, { tone: turnos === n ? 'gold' : 'paper', icon: turnos === n ? 'check' : null }));
    MCUI.btn('arrancar', x, y + 104, w, 72, 'LET\'S GO!', start, { tone: 'go', icon: 'play', size: 24, prime: true, key: 'ENTER' });
  }
  // CON PANAS: armar sala (con los turnos de arriba) o unirse con las 4 letras
  function drawPanas(x, y, w) {
    MCUI.panel(x, y, w, 300, { band: MCUI.TONE.info });
    MCUI.text('WITH FRIENDS', x + 16, y + 30, 16, MCUI.TONE.info, 'left', w - 32);
    MCUI.para('ONLINE · 2-4 PLAYERS', x + 16, y + 50, w - 32, 8, '#ddd', 'left', 14);
    MCUI.btn('crear', x + 16, y + 72, w - 32, 56, 'CREATE ROOM', crearSala, { tone: 'go', icon: 'right' });
    MCUI.text('JOIN WITH CODE', x + 16, y + 158, 8, '#ddd', 'left', w - 32);
    MCUI.notch(x + 12, y + 172, w - 32 - 72, 64 + 8, 4, MCUI.INK); MCUI.notch(x + 16, y + 176, w - 32 - 80, 64, 0, '#171c34');
    MCUI.area('code', x + 16, y + 176, w - 32 - 80, 64, () => inCode.focus(), { focus: true });
    codeSlot = [x + 16, y + 176, w - 32 - 80, 64];
    MCUI.btn('unirse', x + w - 16 - 64, y + 176, 64, 64, '', () => unirse(inCode.value), { tone: 'info', icon: 'right' });
    MCUI.para('THE 4 LETTERS YOUR FRIEND SENT YOU', x + 16, y + 260, w - 32, 8, '#ddd', 'left', 14);
  }
  const REGLAS = [
    ['GOLDEN EMPANADAS', 'BUY THEM FROM THE EMPANADA LADY FOR 20 BS. MOST EMPANADAS WINS.'],
    ['CROSSINGS', 'CROSS AT LA RESTINGA OR BY BOAT. THE FISCAL CHARGES A TOLL AND THE BACHAQUERO SELLS ON THE OTHER ISLAND.'],
    ['SPACES', 'BLUE ADDS, RED TAKES AWAY, M IS A MICROGAME AND THE FISHING BOATS MOVE YOU TO THE OTHER ISLAND.'],
  ];
  function drawReglas(x, y, w, cols) {
    const gap = 16, cw = (w - gap * (cols - 1)) / cols, ch = cols === 1 ? 150 : 220;
    REGLAS.forEach(([h, b], i) => {
      const cx = x + (i % cols) * (cw + gap), cy = y + (i / cols | 0) * (ch + gap);
      MCUI.panel(cx, cy, cw, ch, { band: [MCUI.TONE.gold, MCUI.TONE.info, MCUI.TONE.bad][i] });
      MCUI.label(h, cx + cw / 2, cy + 40, cw - 32, 48, 16, '#FFE14D', 'left', cx + 16);   // two lines of 16 before going smaller
      MCUI.para(b, cx + 16, cy + 78, cw - 32, 8, '#fff', 'left', 18);
    });
  }
  function drawMsg(y) { if (msg) MCUI.text(msg, L.w / 2, y, 8, msgCol, 'center', L.w - 32); }
  function drawMenu() {
    MCUI.bg('margarita');
    MCUI.header('ISLA DE MARGARITA', { band: MCUI.WORLD.margarita, col: MCUI.INK });
    MCUI.back(leave, 'GO BACK');
    const x = L.tall ? 16 : 40, w = L.tall ? L.w - 32 : 720;
    MCUI.tabBar('mtab', x, 104, L.tall ? w : 360, 52, ['PLAY', 'RULES'], tab, i => { tab = i; });
    codeSlot = null;
    if (tab === 0) {
      if (L.tall) {
        const top = 172, off = MCUI.scrollStart('jugar', top, L.h - 8, 8 + 360 + 24 + 300 + 40);
        drawJugar(x, top + 8 + off, w); drawPanas(x, top + 8 + off + 384, w); drawMsg(top + 8 + off + 384 + 324);
        MCUI.scrollEnd();
        if (codeSlot && (codeSlot[1] < top || codeSlot[1] + codeSlot[3] > L.h - 8)) codeSlot = null;
      } else { drawJugar(x, 176, 440); drawPanas(x + 464, 176, 256); drawMsg(500); }
    } else drawReglas(x, 176, w, L.tall ? 1 : 3);
    if (!L.tall) MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'CHOOSE'], ['Q/E', 'TAB']]);
  }
  function drawCarga() { MCUI.loading(cargando || 'CONNECTING...', (st * .7) % 1); }
  /* el lobby de la sala: código + enlace, los 4 asientos, mi personaje, turnos (anfitrión) y listo / empezar */
  function seatTile(s, x, y, w, h) {
    const N = net(), R = N.room, B = N.board || {}, p = (R.players || []).find((q) => q.id === s), q = B.pj && B.pj[s];
    const mio = N.you && N.you.id === s, col = p ? p.color : '#4a4558';
    MCUI.notch(x - 4, y - 4, w + 8, h + 8, 4, MCUI.INK); MCUI.notch(x, y, w, h, 0, mio ? '#2c3659' : '#171c34'); MCUI.notch(x, y, w, 6, 0, col);
    if (!p) { MCUI.text('CPU', x + w / 2, y + h / 2 + 4, 8, '#8a84a0', 'center', w - 8); return; }
    MCUI.text(p.name, x + w / 2, y + 28, 8, col, 'center', w - 12);
    const ch = q && q.ch && (window.FIESTA.reglas.PERSONAJES.find((c) => c.id === q.ch) || {}).n;
    MCUI.text(ch || '?', x + w / 2, y + 52, 8, ch ? '#fff' : '#8a84a0', 'center', w - 12);
    if (R.host === s) MCUI.badge(x + 8, y + h - 30, 'HOST', 'gold');
    else MCUI.badge(x + 8, y + h - 30, q && q.listo ? 'READY' : 'WAITING', q && q.listo ? 'go' : 'off');
  }
  function drawSala() {
    const N = net(), R = N.room, B = N.board;
    if (!R || !B) { drawCarga(); return; }
    const me = N.you ? N.you.id : null, host = me && R.host === me, mio = me && B.pj[me];
    MCUI.bg('margarita');
    MCUI.header('ISLA DE MARGARITA', { band: MCUI.WORLD.margarita, col: MCUI.INK });
    MCUI.back(salirSala, 'LEAVE');
    const x = L.tall ? 16 : 40, w = L.tall ? L.w - 32 : 720, tall = L.tall;
    const top = 96, off = tall ? MCUI.scrollStart('sala', top, L.h - 8, 760) : 0;
    let y = top + 8 + off;
    MCUI.panel(x, y, w, 80, { band: MCUI.WORLD.margarita });
    MCUI.text('ROOM CODE', x + 16, y + 30, 8, '#ddd', 'left');
    MCUI.text(R.code, x + 16, y + 58, 24, '#FFE14D', 'left');
    MCUI.btn('invitar', x + w - 16 - (tall ? 150 : 220), y + 16, tall ? 150 : 220, 52, 'INVITE', copiar, { tone: 'info', icon: 'right' });
    y += 96;
    const cols = tall ? 2 : 4, sw = (w - (cols - 1) * 12) / cols, sh = 96;
    ['a', 'b', 'c', 'd'].forEach((s, i) => seatTile(s, x + (i % cols) * (sw + 12), y + (i / cols | 0) * (sh + 12), sw, sh));
    y += (4 / cols) * (sh + 12) + 8;
    MCUI.text('YOUR CHARACTER', x, y + 8, 8, '#ddd', 'left');
    y += 20;
    const PJ = window.FIESTA.reglas.PERSONAJES, pc = 4, pw = (w - (pc - 1) * 8) / pc;
    PJ.forEach((c, i) => {
      const otro = Object.keys(B.pj).some((s) => s !== me && B.pj[s].ch === c.id), sel = mio && mio.ch === c.id;
      MCUI.btn('pj-' + c.id, x + (i % pc) * (pw + 8), y + (i / pc | 0) * 48, pw, 40, c.n, () => { N.pick({ ch: c.id }).then((r) => { if (!r.ok) fail(err(r)); }); },
        { tone: sel ? 'gold' : 'paper', size: 8, off: otro || !mio });
    });
    y += Math.ceil(PJ.length / pc) * 48 + 12;
    const tw = tall ? w : 340;
    MCUI.text('TURNS', x, y + 8, 8, '#ddd', 'left');
    [10, 15, 20].forEach((n, i) => MCUI.btn('sala-turnos-' + n, x + i * ((tw + 12) / 3), y + 20, (tw + 12) / 3 - 12, 52, String(n),
      () => { N.cfg({ cfg: { tot: n } }).then((r) => { if (!r.ok) fail(err(r)); }); }, { tone: B.cfg.tot === n ? 'gold' : 'paper', icon: B.cfg.tot === n ? 'check' : null, off: !host }));
    const ax = tall ? x : x + tw + 24, ay = tall ? y + 88 : y + 8, aw = tall ? w : w - tw - 24;
    if (host) MCUI.btn('empezar', ax, ay, aw, 64, 'START!', () => { msg = ''; N.start({}).then((r) => { if (!r.ok) fail(err(r)); }); }, { tone: 'go', icon: 'play', size: 16, prime: true, key: 'ENTER' });
    else if (mio) MCUI.btn('listo', ax, ay, aw, 64, mio.listo ? 'READY!' : 'I\'M READY', () => { N.ready({ on: !mio.listo }).then((r) => { if (!r.ok) fail(err(r)); }); },
      { tone: mio.listo ? 'gold' : 'go', icon: mio.listo ? 'check' : 'play', prime: true, key: 'ENTER' });
    drawMsg(tall ? ay + 92 : ay + 84);
    if (tall) MCUI.scrollEnd();
  }
  function drawSalir() {
    const stay = () => { on = false; cv.style.display = 'none'; };
    const red = window.MARGARITA && window.MARGARITA.enLineaOn;
    MCUI.dialog({ title: 'LEAVE THE ISLAND?', body: red ? 'A CPU WILL PLAY FOR YOU UNTIL YOU COME BACK.' : 'THIS GAME WILL BE LOST.', band: MCUI.TONE.bad,
      buttons: [{ label: 'STAY', fn: stay, tone: 'go' }, { label: 'I\'M LEAVING', fn: () => { if (red) net().leave(); leave(); }, tone: 'bad' }] });
    MCUI.setBack(stay);   // Esc / B: stay on the board
  }
  function frame(ts) {
    const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; now += dt; st += dt;
    if (on) {
      X.setTransform(1, 0, 0, 1, L.ox, 0); X.clearRect(-L.ox, 0, cv.width, cv.height);
      MCUI.begin(X, { w: L.w, h: L.h, ox: L.ox, tall: L.tall, t: now }, modo + (modo === 'menu' ? tab : ''));
      if (modo === 'menu') drawMenu(); else if (modo === 'carga') drawCarga(); else if (modo === 'sala') drawSala(); else drawSalir();
      MCUI.end();
      if (leaving) { const k = (now - leaving.t0) / .25; MCUI.wipe(Math.max(0, 1 - k), MCUI.WORLD.margarita); if (k >= 1 && !leaving.gone) { leaving.gone = true; location.assign(home()); } }
      else if (modo === 'menu') { MCUI.wipe(st / .3, arrive || MCUI.WORLD.margarita); if (st > .3) arrive = null; }
    }
    placeInput();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ───────── entrada: mientras se ve la carcasa, es suya ───────── */
  cv.addEventListener('pointerdown', e => { e.preventDefault(); if (!leaving) MCUI.down(pt(e)); });
  cv.addEventListener('pointermove', e => MCUI.move(pt(e)));
  cv.addEventListener('pointerup', e => { if (!leaving) MCUI.up(pt(e)); });
  cv.addEventListener('wheel', e => { MCUI.wheel(e.deltaY); e.preventDefault(); }, { passive: false });
  addEventListener('keydown', e => {
    const mj = document.getElementById('mj'), enMJ = mj && mj.style.display && mj.style.display !== 'none';
    if (!on) {   // jugando: Esc (o B en el mando) pregunta si te vas; el resto es del tablero
      if ((e.code === 'Escape') && !enMJ && window.MARGARITA) { e.preventDefault(); e.stopImmediatePropagation(); on = true; cv.style.display = ''; go('salir'); }
      return;
    }
    e.stopImmediatePropagation();
    if (e.repeat || leaving) return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code.startsWith('Arrow')) e.preventDefault();
    MCUI.key(e);
  }, true);
  if (typeof MCUI !== 'undefined') MCUI.sounds({});

  /* ───────── arranque: ?r=CODE entra a esa sala; si no, una sesión guardada de Margarita se retoma ───────── */
  if (RED) {
    const code = String(new URLSearchParams(location.search).get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4), s = net().session();
    if (code.length === 4) unirse(code);
    else if (s && s.code) fetch((window.CLAUDEWARE_API || '') + '/api/party/kind/' + s.code).then((r) => (r.ok ? r.json() : {}), () => ({}))
      .then((k) => { if (k.kind === 'fiesta' && k.tab === RED.TAB && modo === 'menu' && on) { go('carga'); cargando = 'BACK TO YOUR ROOM...'; net().resume().then(trasEntrar, () => trasEntrar(null)); } });
  }
  return { get on() { return on; }, start, leave, hide };
})();
