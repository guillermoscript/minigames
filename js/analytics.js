'use strict';
/* OpenPanel analytics. Inert unless a client id is configured (<meta name="openpanel-client-id">, injected at build time).
   Everything goes through track()/identify(), which never throw, so the game runs the same with tracking off or blocked. */
const OP = (() => {
  const meta = n => { const m = document.querySelector('meta[name="' + n + '"]'); const v = m ? m.content.trim() : ''; return v && !v.startsWith('__') ? v : ''; };
  const clientId = meta('openpanel-client-id'), apiUrl = meta('openpanel-api-url');
  if (!clientId) return { on: false, track() {}, identify() {}, props() {} };
  window.op = window.op || function () { (window.op.q = window.op.q || []).push([].slice.call(arguments)); };
  window.op('init', Object.assign({ clientId, trackScreenViews: true, trackOutgoingLinks: true }, apiUrl ? { apiUrl } : {}));
  const s = document.createElement('script'); s.async = true; s.defer = true; s.src = apiUrl ? new URL(apiUrl).origin + '/op1.js' : 'https://openpanel.dev/op1.js';
  document.head.appendChild(s);
  const call = (...a) => { try { window.op(...a); } catch (e) {} };
  return {
    on: true,
    track: (name, props) => call('track', name, props || {}),
    identify: u => call('identify', { profileId: u.id, firstName: u.username }),
    props: p => call('setGlobalProperties', p),
  };
})();
const track = OP.track;
