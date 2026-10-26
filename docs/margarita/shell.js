'use strict';
/* Isla de Margarita · la carcasa de MiniCaos (docs/ui/01-menu-redesign.md, W4). Antes del tablero, una pantalla con el kit de menús
   (js/ui/mcui.js): JUGAR (cuántos turnos, ¡ARRANCAR!) y REGLAS, el mismo VOLVER y las mismas teclas que el resto del juego.
   Durante la partida, Esc pregunta si te vas. El tablero no cambia: al arrancar se llama MARGARITA.arrancar(turnos).
   Se carga ANTES de margarita.js (que ve window.MARGARITA_SHELL y espera en vez de arrancar solo). */
window.MARGARITA_SHELL = (function () {
  const cv = document.createElement('canvas'); cv.id = 'shell';
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:30;touch-action:none;image-rendering:pixelated';
  document.body.appendChild(cv);
  const X = cv.getContext('2d');
  const T = (s, o) => (typeof t === 'function' ? t(s, o) : s);
  const JUGADORES = [['TÚ', '#ffd23f'], ['MAMÁ', '#ff6fa8'], ['ABUELA', '#b88aff'], ['PANA', '#5cd27a']];   // los de margarita.js (JUG)
  let on = true, modo = 'menu', tab = 0, turnos = 10, st = 0, now = 0, last = 0, leaving = null, arrive = null, L = { w: 800, h: 600, ox: 0, tall: false };
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
  function start() {
    on = false; cv.style.display = 'none';
    if (window.MARGARITA) window.MARGARITA.arrancar(turnos);
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
  function drawMenu() {
    MCUI.bg('margarita');
    MCUI.header('ISLA DE MARGARITA', { band: MCUI.WORLD.margarita, col: MCUI.INK });
    MCUI.back(leave, 'GO BACK');
    const x = L.tall ? 16 : 40, w = L.tall ? L.w - 32 : 720;
    MCUI.tabBar('mtab', x, 104, L.tall ? w : 360, 52, ['PLAY', 'RULES'], tab, i => { tab = i; });
    if (tab === 0) {
      if (L.tall) drawJugar(x, 176, w);
      else { drawJugar(x, 176, 440); MCUI.panel(x + 464, 176, 256, 120, { tone: 'panelDk' }); MCUI.para('EMPANADAS, TOLLS, BOATS AND 8 HIDDEN SECRETS ON THE MAP. TAP THINGS ON THE ISLAND!', x + 480, 212, 224, 8, '#ddd', 'left', 18); }
    } else drawReglas(x, 176, w, L.tall ? 1 : 3);
    MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'CHOOSE'], ['Q/E', 'TAB']]);
  }
  function drawSalir() {
    const stay = () => { on = false; cv.style.display = 'none'; };
    MCUI.dialog({ title: 'LEAVE THE ISLAND?', body: 'THIS GAME WILL BE LOST.', band: MCUI.TONE.bad,
      buttons: [{ label: 'STAY', fn: stay, tone: 'go' }, { label: 'I\'M LEAVING', fn: leave, tone: 'bad' }] });
    MCUI.setBack(stay);   // Esc / B: stay on the board
  }
  function frame(ts) {
    const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; now += dt; st += dt;
    if (on) {
      X.setTransform(1, 0, 0, 1, L.ox, 0); X.clearRect(-L.ox, 0, cv.width, cv.height);
      MCUI.begin(X, { w: L.w, h: L.h, ox: L.ox, tall: L.tall, t: now }, modo + (modo === 'menu' ? tab : ''));
      if (modo === 'menu') drawMenu(); else drawSalir();
      MCUI.end();
      if (leaving) { const k = (now - leaving.t0) / .25; MCUI.wipe(Math.max(0, 1 - k), MCUI.WORLD.margarita); if (k >= 1 && !leaving.gone) { leaving.gone = true; location.assign(home()); } }
      else if (modo === 'menu') { MCUI.wipe(st / .3, arrive || MCUI.WORLD.margarita); if (st > .3) arrive = null; }
    }
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
  return { get on() { return on; }, start, leave, hide: () => { on = false; cv.style.display = 'none'; } };
})();
