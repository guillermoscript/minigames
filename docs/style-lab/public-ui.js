'use strict';
// Public Venezuela menus share the main app's responsive UI; lab tools stay in the lab.
(() => {
  if (!location.pathname.startsWith('/worlds/venezuela/') || !window.CAMP) return;
  const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = '../../css/worlds.css'; document.head.append(sheet);
  const panel = document.createElement('section'); panel.className = 'world-menu'; panel.id = 'venezuela-menu'; panel.hidden = true; panel.setAttribute('aria-label', 'Venezuela'); document.body.append(panel);
  const en = new URLSearchParams(location.search).get('lang') === 'en';
  const tr = (es, english) => en ? english : es;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names = ['The Bus', 'The House', 'The Party', 'Power Out!', 'All the Chaos'];
  let previous = '', wasVisible = false;
  const back = () => { EGGS.stop(); location.assign('../../?worlds=1&lang=' + (en ? 'en' : 'es')); };
  function refresh() {
    const visible = CAMP.state === 'menu';
    panel.hidden = !visible; document.body.classList.toggle('menu-open', visible);
    if (visible) {
      const { nivel, selectedStyle: style } = CAMP.info;
      const key = nivel + '|' + style;
      if (key !== previous) {
        previous = key;
        panel.innerHTML = `<div class="menu-inner"><div class="menu-top"><span class="brand">MINICAOS!</span><button class="menu-back" data-action="worlds">← ${tr('Cambiar mundo', 'Change world')}</button></div><h1>${tr('Mundo Venezuela', 'Venezuela World')}</h1><p>${tr('El caos de todos los días. Elige una etapa para jugar.', 'Everyday chaos. Choose a stage to play.')}</p><button class="menu-action start-first" data-stage="0">▶ ${tr('Empezar por La Camionetica', 'Start with The Bus')}</button><div class="stage-grid">${CAMP.ETAPAS.map((stage, i) => `<button class="stage-card" data-stage="${i}" style="--card-color:${stage.bg[0]};--card-ink:${i === 3 ? '#fff' : '#14101c'}"><span class="badge">${tr('Etapa', 'Stage')} ${i + 1}${i === 0 ? ' · ' + tr('Empieza aquí', 'Start here') : ''}</span><strong>${esc(en ? names[i] : stage.name)}</strong><small>${en ? stage.n + ' games + boss' : esc(stage.tag)}</small></button>`).join('')}</div><details><summary>${tr('Opciones de juego', 'Game options')}</summary><label>${tr('Dificultad', 'Difficulty')}<select id="venezuela-level"><option value="1">${tr('1 · De día', '1 · Daytime')}</option><option value="2">${tr('2 · Atardecer', '2 · Sunset')}</option><option value="3">${tr('3 · De noche', '3 · Nighttime')}</option></select></label><label>${tr('Estilo visual', 'Visual style')}<select id="venezuela-style">${[['snes','16 bits'],['felt',tr('Fieltro','Felt')],['ww','Wind Waker'],['anime','Anime 90s'],['tinta',tr('Tinta','Ink')],['garabato',tr('Garabato','Doodle')],['mezcla',tr('Mezcla','Mix')]].map(([value, name]) => `<option value="${value}">${name}</option>`).join('')}</select></label></details><div class="menu-actions"><button class="menu-action" data-action="practice">${tr('Practicar juegos', 'Practice games')}</button></div><p style="margin-top:24px">${tr('4 vidas, juegos rápidos y un jefe al final de cada etapa.', '4 lives, quick games and a boss at the end of each stage.')}</p></div>`;
        panel.querySelector('#venezuela-level').value = nivel;
        panel.querySelector('#venezuela-style').value = style;
      }
      if (!wasVisible) { panel.scrollTop = 0; panel.querySelector('button').focus({ preventScroll: true }); }
    }
    wasVisible = visible; requestAnimationFrame(refresh);
  }
  panel.addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button) return;
    if (button.dataset.stage !== undefined) CAMP.startStage(Number(button.dataset.stage));
    else if (button.dataset.action === 'worlds') back();
    else if (button.dataset.action === 'practice') CAMP.goPractice();
    panel.hidden = CAMP.state !== 'menu';
  });
  panel.addEventListener('change', e => {
    if (e.target.id === 'venezuela-level') CAMP.nivel = Number(e.target.value);
    if (e.target.id === 'venezuela-style') CAMP.estilo(e.target.value);
    // Keep the open options and keyboard focus while changing a setting.
    previous = CAMP.info.nivel + '|' + CAMP.info.selectedStyle;
  });
  document.title = 'MiniCaos · Venezuela'; refresh();
})();
