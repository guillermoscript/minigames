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
/* Meta Pixel, for the ad campaigns (docs/marketing/PLAN.md). Inert unless <meta name="meta-pixel-id"> is set.
   Only a few game events are forwarded, each at most once per browser (localStorage):
   GameStart = the first stage / practice / party / challenge started, MicrogamePlayed = the first microgame finished
   (the campaign's conversion: "played one game"), plus Meta's standard CompleteRegistration on Google sign-in. */
const PIX = (() => {
  const m = document.querySelector('meta[name="meta-pixel-id"]'), id = m ? m.content.trim() : '';
  if (!id || id.startsWith('__')) return { fwd() {} };
  /* Meta's base code, unrolled */
  const f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
  if (!window._fbq) window._fbq = f;
  f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
  const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(s);
  const call = (...a) => { try { window.fbq(...a); } catch (e) {} };
  call('init', id); call('track', 'PageView');
  const MAP = { stage_start: 'GameStart', practice_start: 'GameStart', party_start: 'GameStart', challenge_accept: 'GameStart', microgame_end: 'MicrogamePlayed', sign_in: 'CompleteRegistration' };
  /* once per browser, not per page load: the campaign counts new players, so a reload must not convert again */
  const KEY = 'claudeware-px-', seen = ev => { try { return localStorage.getItem(KEY + ev) === '1'; } catch (e) { return false; } };
  const mark = ev => { try { localStorage.setItem(KEY + ev, '1'); } catch (e) {} }, sent = new Set();
  return { fwd(name) { const ev = MAP[name]; if (!ev || sent.has(ev) || seen(ev)) return; sent.add(ev); mark(ev); call(ev === 'CompleteRegistration' ? 'track' : 'trackCustom', ev); } };
})();
const track = (name, props) => { OP.track(name, props); PIX.fwd(name); };
