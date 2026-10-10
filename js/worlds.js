'use strict';
// Native controls make world and stage selection readable on small portrait screens.
const worldsPanel = document.createElement('section');
worldsPanel.className = 'world-menu'; worldsPanel.hidden = true;
worldsPanel.setAttribute('aria-label', 'MiniCaos');
document.body.append(worldsPanel);
let worldsView = '';
function worldText(es, en) { return I18N.lang === 'es' ? es : en; }
function worldEscape(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function worldInk(hex) { const rgb = hex.slice(1).match(/../g).map(c => parseInt(c, 16)); return rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 < 115 ? '#fff' : '#14101c'; }
function goWorlds() { if (window.frameElement?.id === 'camp-app' && parent.CAMP) { parent.CAMP.closeClassic(); return; } EGGS.stop(); state = 'worlds'; st = 0; mode = 'stage'; parts.length = 0; syncWorldMenu(); }
function chooseClassic() { menuPage = 0; track('world_select', { world: 'classic' }); goMenu(); syncWorldMenu(); }
function chooseVenezuela() {
  EGGS.stop(); track('world_select', { world: 'venezuela' });
  location.assign('worlds/venezuela/?lang=' + encodeURIComponent(I18N.lang));
}
function syncWorldMenu() {
  const visible = state === 'worlds' || state === 'menu';
  const changed = worldsPanel.hidden === visible;
  worldsPanel.hidden = !visible; document.body.classList.toggle('menu-open', visible);
  if (!visible) { worldsView = ''; return; }
  const key = [state, I18N.lang, save.unlocked, save.stars.join(',')].join('|');
  if (key !== worldsView) {
    worldsView = key;
    const tr = worldText, esc = worldEscape;
    const header = `<div class="menu-top"><span class="brand">MINICAOS!</span><button class="menu-back" data-action="${state === 'worlds' ? 'title' : 'worlds'}">← ${tr(state === 'worlds' ? 'Inicio' : 'Cambiar mundo', state === 'worlds' ? 'Home' : 'Change world')}</button></div>`;
    if (state === 'worlds') {
      worldsPanel.innerHTML = `<div class="menu-inner">${header}<h1>${tr('¿Dónde empieza el caos?', 'Where does the chaos begin?')}</h1><p>${tr('Elige un mundo. Juega desde la primera etapa o explora sus juegos.', 'Choose a world. Start at stage one or explore its games.')}</p><div class="world-grid">
      <button class="world-card" data-action="classic" style="--card-color:#6EC6FF"><span class="badge">${tr('Los de siempre', 'The originals')}</span><span class="world-art" aria-hidden="true">🐸 ⌨️ ⚡</span><strong class="world-name">${tr('Clásico', 'Classic')}</strong><span class="description">${tr('Bichos, reflejos y retos rápidos. Empieza por Caza Bichos.', 'Bugs, reflexes and quick challenges. Start with Bug Hunt.')}</span><span class="enter">${tr('Entrar a Clásico', 'Enter Classic')} →</span></button>
      <button class="world-card" data-action="venezuela" style="--card-color:#F5B93C"><span class="badge">${tr('Nuevos juegos', 'New games')}</span><span class="world-art" aria-hidden="true">🚌 🫓 🥭</span><strong class="world-name">Venezuela</strong><span class="description">${tr('La camionetica, la casa y la rumba. El caos de todos los días.', 'The bus, the house and the party. Everyday chaos.')}</span><span class="enter">${tr('Entrar a Venezuela', 'Enter Venezuela')} →</span></button></div><p>${tr('Partidas cortas. Puedes cambiar de mundo cuando quieras.', 'Short rounds. You can change worlds whenever you like.')}</p></div>`;
    } else {
      worldsPanel.innerHTML = `<div class="menu-inner">${header}<h1>${tr('Mundo Clásico', 'Classic World')}</h1><p>${tr('Los juegos de siempre. Elige una etapa para jugar.', 'The original games. Choose a stage to play.')}</p><button class="menu-action start-first" data-stage="0">▶ ${tr('Empezar por la etapa 1', 'Start at stage 1')} · ${esc(t(STAGES[0].name))}</button><div class="stage-grid">${STAGES.map((s, i) => {
        const locked = i >= save.unlocked;
        return `<button class="stage-card" data-stage="${i}" style="--card-color:${s.bg[0]};--card-ink:${worldInk(s.bg[0])}" ${locked ? 'disabled' : ''}><span class="badge">${tr('Etapa', 'Stage')} ${i + 1}${i === 0 ? ' · ' + tr('Empieza aquí', 'Start here') : ''}</span><strong>${esc(t(s.name))}</strong><small>${locked ? tr('Supera la etapa anterior', 'Clear the previous stage') : esc(t(s.tag))}</small><span>${locked ? '🔒' : '★'.repeat(save.stars[i] || 0) + '☆'.repeat(3 - (save.stars[i] || 0))}</span></button>`;
      }).join('')}</div><div class="menu-actions"><button class="menu-action" data-action="practice">${tr('Practicar juegos', 'Practice games')}</button><button class="menu-action" data-action="ranks">${tr('Clasificación', 'Leaderboards')}</button><button class="menu-action" data-action="profile">${tr('Mi perfil', 'My profile')}</button></div></div>`;
    }
  }
  if (changed) { const button = worldsPanel.querySelector(state === 'worlds' ? '[data-action=classic]' : '[data-stage="0"]'); if (button) button.focus({ preventScroll: true }); worldsPanel.scrollTop = 0; }
}
worldsPanel.addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button || button.disabled) return;
  interacted = true; sfx.click();
  if (button.dataset.stage !== undefined) startStage(Number(button.dataset.stage));
  else ({ title: goTitle, worlds: goWorlds, classic: chooseClassic, venezuela: chooseVenezuela, practice: goPractice, ranks: goBoard, profile: goProfile })[button.dataset.action]?.();
  syncWorldMenu();
});
function initWorldMenu() {
const worldQuery = new URLSearchParams(location.search);
if (!inviteOpen() && !chOpen) {
  if (worldQuery.get('world') === 'classic') chooseClassic();
  else if (worldQuery.has('worlds')) goWorlds();
}
}
