'use strict';
/* ───────────── easter eggs: hidden meme clips that fire now and then ─────────────
   Every clip is OPTIONAL: drop <name>.mp3 into audio/eggs/ and it starts working; a missing file is simply skipped.
   They are fetched once (on the first microgame of the session) and decoded the first time they play. One clip at a time:
   a new one cuts the old one, and so does the next microgame.
   Shared by the app (js/main.js, js/games/wii.js) and the style lab's levels mode (docs/style-lab/campana.js). */
const EGGS = (() => {
  /* audio/eggs/ sits next to js/, wherever this file was loaded from (the lab loads it as ../../js/eggs.js) */
  const here = typeof document !== 'undefined' && document.currentScript && document.currentScript.src || '';
  const DIR = here.replace(/[^/]*\/[^/]*$/, '') + 'audio/eggs/';
  const CLIPS = ['faaah', 'fart', 'spongebob-fail', 'anime-ahh', 'punch', 'correct', 'anime-wow', 'alert', 'defy-gravity', 'yay', 'heavenly', 'bebecita',
    'se-fue-la-luz', 'goku-drip', 'running', 'atrapada', 'carrera-de-buses'];
  /* how often each one fires (0 = never, 1 = always) */
  const CHANCE = {
    fail: .12,     // a lost microgame: 'faaah', 'fart' or 'spongebob-fail'
    hit: .3,       // any result in a game where something gets smacked: 'anime-ahh' or 'punch'
    dodge: .3,     // a won dodging game: 'goku-drip'
    catch: .3,     // a won catching game: 'atrapada'
    run: .25,      // a running game starts: 'running'
    dark: .15,     // a blackout game starts: 'se-fue-la-luz'
    race: .6,      // the lab's bus race (pique) starts: 'carrera-de-buses'
    win: .1,       // a won microgame: 'correct' or 'anime-wow'
    clear: .5,     // a cleared stage: 'yay' or 'heavenly'
    music: .25     // winning a game that puts music on (the lab's pendrive and anuncio): 'bebecita' instead of the game's own tune
  };
  /* which games count as what: the app's ids, then the lab's */
  const HIT = new Set(['whack', 'swat', 'mv_punch', 'gc_rhino', 'gc_nail', 'ap_mosquito', 'du_shield', 'dodge', 'chancla', 'zancudo', 'cucaracha']);
  const DODGE = new Set(['dodge', 'gc_sole', 'gc_rhino', 'sw_limbo', 'chancla']);
  const CATCH = new Set(['catch', 'du_catch', 'pt_grab', 'cc_claw', 'gc_trap', 'tequenos', 'cava']);
  const RUN = new Set(['sw_run', 'race', 'cc_dog', 'paga']);
  const DARK = new Set(['ap_switch', 'ap_fridge', 'ap_mosquito', 'ap_battery', 'ap_arepa', 'ap_grita', 'switch', 'nevera', 'zancudo', 'enchufa', 'voltea', 'llego', 'transformador']);
  /* songs: the lab keeps its own stage music quiet while one plays, and they trail off instead of being cut */
  const SONGS = new Set(['bebecita', 'se-fue-la-luz', 'goku-drip', 'defy-gravity', 'carrera-de-buses', 'heavenly']);
  const raw = {}, buf = {}, coming = {};
  const used = new Set(), pending = new Set(), results = new Set(), pendingResults = new Set();
  let outcomeDone = false, badge = 0;
  let ac = () => null, off = () => false, asked = false, cur = null, game = 0, request = 0;

  function load() {
    if (asked || typeof fetch !== 'function' || typeof location === 'undefined' || location.protocol === 'file:') return; asked = true;
    for (const n of CLIPS) coming[n] = fetch(DIR + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (b) raw[n] = b; }).catch(() => {});
  }
  function stop(fade = .06) {
    request++; // also cancel clips still downloading or decoding
    pending.clear(); pendingResults.clear(); badge = 0;
    if (!cur) return;
    try { const t = ac().currentTime; cur.g.gain.setTargetAtTime(0, t, fade); cur.s.stop(t + fade * 5); } catch (e) {}
    cur = null;
  }
  /* true if the clip exists (and is now playing or about to) */
  function play(name, v = .9, result) {
    if (off() || used.has(name) || pending.has(name) || (result && (results.has(result) || pendingResults.has(result))) || !(buf[name] || raw[name])) return false;
    try {
      const a = ac(); if (!a) return false;
      pending.clear(); pendingResults.clear();
      pending.add(name); if (result) pendingResults.add(result);
      const ticket = ++request, go = b => {
        if (ticket !== request || off()) return;
        try {
          stop(); const s = a.createBufferSource(), g = a.createGain();
          g.gain.value = v; s.buffer = b; s.connect(g); g.connect(a.destination); s.start();
          used.add(name); if (result) results.add(result); badge = 2;
          cur = { s, g, name }; s.onended = () => { if (cur && cur.s === s) cur = null; };
        } catch (e) {} // optional audio must not interrupt gameplay, even after asynchronous decoding
      };
      if (buf[name]) go(buf[name]);
      else { a.decodeAudioData(raw[name].slice(0), d => { buf[name] = d; delete raw[name]; go(d); }, () => { if(ticket===request){pending.clear();pendingResults.clear();} }); }
      return true;
    } catch (e) { return false; }
  }
  const roll = k => Math.random() < CHANCE[k];
  /* a clip for the start of a game: on the first game of the session it is still downloading, so it plays as soon as it lands
     (if that game is still the current one) */
  function opening(name, v) {
    if (play(name, v) || !coming[name]) return;
    const g = game, ticket = request; coming[name].then(() => { if (g === game && ticket === request) play(name, v); });
  }
  /* one of these, picked at random among the ones that exist */
  const any = (result, ...l) => l.map(n => [Math.random(), n]).sort((a, b) => a[0] - b[0]).some(e => play(e[1], .9, result));
  return {
    /* audio: () => the AudioContext to play through; muted: () => true while sound is off */
    use(audio, muted) { ac = audio; if (muted) off = muted; },
    play, stop,
    // A new attempt starts a fresh collection; microgame transitions keep it.
    stage() { stop(); used.clear(); results.clear(); outcomeDone = false; },
    update(dt) { badge = Math.max(0, badge - dt); },
    draw(x, width = 800, spanish = false) {
      if (badge <= 0) return;
      const t = 2 - badge, scale = t < .18 ? .75 + t / .18 * .25 : 1;
      x.save(); x.translate(width / 2, 130); x.rotate(-.035); x.scale(scale, scale);
      x.globalAlpha = Math.min(1, badge / .3);
      x.fillStyle = '#14101c'; x.fillRect(-130, -25, 268, 56);
      x.fillStyle = '#FFE14D'; x.fillRect(-134, -29, 268, 56);
      x.strokeStyle = '#14101c'; x.lineWidth = 3; x.strokeRect(-134, -29, 268, 56);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#14101c';
      x.font = '900 20px "Arial Black", sans-serif'; x.fillText('★ EASTER EGG ★', 0, -10);
      x.font = '900 12px "Arial Black", sans-serif'; x.fillText(spanish ? '¡VERSIÓN ESPECIAL!' : 'SPECIAL EDITION!', 0, 12);
      // A little confetti burst around the sticker, leaving the game visible.
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, r = 150 + Math.min(t, .6) * 30;
        x.fillStyle = ['#FF6B3D', '#5CFF7A', '#7C4DFF'][i % 3];
        x.fillRect(Math.cos(a) * r, Math.sin(a) * 42, 7, 7);
      }
      x.restore();
    },
    /* a song is playing right now */
    song: () => !!cur && SONGS.has(cur.name),
    /* a microgame is starting (id): a song trails off over the command card, anything else is cut */
    begin(id) {
      stop(cur && SONGS.has(cur.name) ? .45 : .06); load(); game++; outcomeDone = false;
      if (id === 'pique' && roll('race')) opening('carrera-de-buses');
      else if (DARK.has(id) && roll('dark')) opening('se-fue-la-luz', .8);
      else if (RUN.has(id) && roll('run')) opening('running');
    },
    /* a microgame ended: id, 'win' | 'lose' */
    outcome(id, r) {
      if (outcomeDone || results.has(r) || pendingResults.has(r)) return;
      outcomeDone = true;
      if (HIT.has(id) && roll('hit') && any(r, 'anime-ahh', 'punch')) return;
      if (r === 'win') {
        if (DODGE.has(id) && roll('dodge') && play('goku-drip', .9, r)) return;
        if (CATCH.has(id) && roll('catch') && play('atrapada', .9, r)) return;
        if (roll('win')) any(r, 'correct', 'anime-wow');
      } else if (roll('fail')) any(r, 'faaah', 'fart', 'spongebob-fail');
    },
    /* a game just put music on: true if the song took over (then the game keeps its own tune quiet) */
    music() { if(outcomeDone || !roll('music') || !play('bebecita', .8, 'win')) return false; outcomeDone = true; return true; },
    /* a stage was cleared. big = the one-off moment (level 6 for the first time): that one always plays */
    clear(big) { if (big && play('defy-gravity', .8, 'win')) return; if (roll('clear')) any('win', 'yay', 'heavenly'); }
  };
})();
