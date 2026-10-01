'use strict';
/* i18n. English is the source language: the English text itself is the key, so game code reads naturally,
   e.g. txt('SPLAT!', ...) or t('YOU BEAT {name}\'S {score}!', { name, score }).
   Other languages are plain dictionaries { 'ENGLISH TEXT': 'translation' } registered with I18N.add(code, dict)
   from js/i18n/<code>*.js. A missing entry falls back to English, so a half-translated language still works.

   Adding a language:
     1. add { code, name } to LANGS below (name = native name, written the way the game writes text: caps)
     2. create js/i18n/<code>.js calling I18N.add('<code>', {...}) and list it in index.html (and the Dockerfile/dev.sh copy needs nothing: js/ is copied whole)
     3. open the game with ?i18n-debug to log every string that has no translation yet (console + I18N.missing)

   Scopes: a flat key can mean different things in different games (e.g. 'DRAW!' = draw a card / draw a weapon). Game files
   register their dictionary under a scope, I18N.add('es', {...}, 'ds'), and while a game of that scope is on screen (game id
   prefix, see I18N.scopeOf) the scoped dictionary wins over the shared one. Un-prefixed games, bosses and menus use scope ''.
   Touch screens: a language may add I18N.touch rules that reword click/mouse hints (see the English ones below).

   Placeholders are {name}. Keep them verbatim in translations. Strings are drawn on a canvas in caps,
   so translations must be uppercase wherever the English is.  Avoid plurals: reword to "SCORE: {n}". */
const LANGS = [
  { code: 'en', name: 'ENGLISH' },
  { code: 'es', name: 'ESPAÑOL' },
];
const I18N = (() => {
  const KEY = 'claudeware-lang', dicts = {}, touchRules = {}, subs = [], missing = new Set();
  const known = c => LANGS.some(l => l.code === c);
  const pick = c => { c = String(c || '').toLowerCase().split(/[-_]/)[0]; return known(c) ? c : ''; };
  function detect() {
    let q = ''; try { q = pick(new URLSearchParams(location.search).get('lang')); } catch (e) {}
    if (q) return q;
    try { const s = pick(localStorage.getItem(KEY)); if (s) return s; } catch (e) {}
    for (const l of navigator.languages || [navigator.language]) { const c = pick(l); if (c) return c; }
    return 'en';
  }
  const api = {
    lang: detect(), missing, debug: /[?&]i18n-debug/.test(location.search),
    scope: '',
    scopeOf: id => { const m = /^([a-z]+)_/.exec(id || ''); return m ? m[1] : ''; },
    add(code, dict, scope = '') { const d = dicts[code] = dicts[code] || {}; d[scope] = Object.assign(d[scope] || {}, dict); },
    addTouch(code, rules) { touchRules[code] = rules; },
    touch(s) { for (const [re, to] of touchRules[api.lang] || []) s = s.replace(re, to); return s; },
    onChange(fn) { subs.push(fn); },
    setLang(code) {
      if (!known(code)) return;
      api.lang = code;
      try { localStorage.setItem(KEY, code); } catch (e) {}
      api.apply(); subs.forEach(fn => { try { fn(code); } catch (e) {} });
    },
    next() { api.setLang(LANGS[(LANGS.findIndex(l => l.code === api.lang) + 1) % LANGS.length].code); },
    /* static page bits: <html lang>, <title>, meta tags and [data-i18n] / [data-i18n-attr="attr:key,..."] elements */
    apply() {
      document.documentElement.lang = api.lang;
      document.title = t('Claude Ware');
      document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
      document.querySelectorAll('[data-i18n-attr]').forEach(el => el.dataset.i18nAttr.split(',').forEach(p => {
        const [a, k] = p.split(':'); el.setAttribute(a, t(k));
      }));
      document.querySelectorAll('meta[data-i18n-content]').forEach(m => { m.content = t(m.dataset.i18nContent); });
    },
  };
  api.lookup = s => { const d = dicts[api.lang]; if (!d) return undefined; const sc = d[api.scope]; return sc && s in sc ? sc[s] : d[''] && d[''][s]; };
  api.has = s => api.lookup(s) !== undefined;
  api.addTouch('en', [[/CLICK/g, 'TAP'], [/MOUSE/g, 'FINGER']]);
  return api;
})();

function t(s, params) {
  if (typeof s !== 'string' || !s) return s;
  let out = I18N.lookup(s);
  if (out === undefined) {
    out = s;
    if (I18N.debug && I18N.lang !== 'en' && /[A-Za-z]{2}/.test(s) && !I18N.missing.has(s)) {
      I18N.missing.add(s); console.warn('[i18n] missing', I18N.lang, JSON.stringify(s));
    }
  }
  return params ? out.replace(/\{(\w+)\}/g, (m, k) => k in params ? params[k] : m) : out;
}
