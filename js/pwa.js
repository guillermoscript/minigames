'use strict';
(() => {
  const button = document.getElementById('pwa-install');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let prompt = null, installed = standalone(), busy = false, offered = false;
  const ev = (name, props) => { try { track(name, Object.assign({ platform: ios ? 'ios' : 'other' }, props)); } catch (_) {} };   // analytics may be off or blocked
  // Launched from the home screen / app drawer: counts how many people actually run the installed app (once per page load).
  if (installed) ev('pwa_launch', { mode: navigator.standalone === true ? 'ios-standalone' : 'standalone' });
  function sync() {
    button.hidden = installed || busy || (!prompt && !ios) || !['title', 'menu'].includes(state);
    button.textContent = I18N.lang === 'es' ? 'INSTALAR APP' : 'INSTALL APP';
    if (!button.hidden && !offered) { offered = true; ev('pwa_install_offered', { native: !!prompt }); }   // the button was actually shown to someone
  }
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; sync(); });
  addEventListener('appinstalled', () => { installed = true; prompt = null; ev('pwa_installed'); sync(); });   // fires for the button and for the browser's own menu
  button.addEventListener('click', async () => {
    ev('pwa_install_click', { native: !!prompt });
    if (!prompt && ios) {
      alert(I18N.lang === 'es'
        ? 'En Safari, abre Compartir (o Más → Compartir), elige “Añadir a pantalla de inicio” y pulsa “Añadir”.'
        : 'In Safari, open Share (or More → Share), choose “Add to Home Screen”, then tap “Add”.');
      return;
    }
    if (!prompt) return;
    const pending = prompt; prompt = null; busy = true; sync();
    try { await pending.prompt(); const choice = await pending.userChoice; ev('pwa_install_choice', { outcome: choice && choice.outcome }); }
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
