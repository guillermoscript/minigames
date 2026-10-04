'use strict';
(() => {
  const button = document.getElementById('pwa-install');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let prompt = null, installed = standalone(), busy = false;
  function sync() {
    button.hidden = installed || busy || (!prompt && !ios) || !['title', 'menu'].includes(state);
    button.textContent = I18N.lang === 'es' ? 'INSTALAR APP' : 'INSTALL APP';
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; sync(); });
  addEventListener('appinstalled', () => { installed = true; prompt = null; sync(); });
  button.addEventListener('click', async () => {
    if (!prompt && ios) {
      alert(I18N.lang === 'es'
        ? 'En Safari, abre Compartir (o Más → Compartir), elige “Añadir a pantalla de inicio” y pulsa “Añadir”.'
        : 'In Safari, open Share (or More → Share), choose “Add to Home Screen”, then tap “Add”.');
      return;
    }
    if (!prompt) return;
    const pending = prompt; prompt = null; busy = true; sync();
    try { await pending.prompt(); await pending.userChoice; }
    catch (err) { console.warn('Install prompt unavailable', err); }
    finally { busy = false; sync(); }
  });
  // Keep the install control out of gameplay and refresh its language with the menu.
  setInterval(sync, 200); sync();
  if ('serviceWorker' in navigator) addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .catch(err => console.warn('Offline setup unavailable', err));
  });
})();
