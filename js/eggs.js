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
  const DODGE = new Set(['dodge', 'gc_sole', 'gc_rhino', 'sw_limbo', 'chancla', 'hueco']);
  const CATCH = new Set(['catch', 'du_catch', 'pt_grab', 'cc_claw', 'gc_trap', 'tequenos', 'cava']);
  const RUN = new Set(['sw_run', 'race', 'cc_dog', 'paga']);
  const DARK = new Set(['ap_switch', 'ap_fridge', 'ap_mosquito', 'ap_battery', 'ap_arepa', 'ap_grita', 'switch', 'nevera', 'zancudo', 'enchufa', 'voltea', 'llego', 'transformador']);
  /* songs: the lab keeps its own stage music quiet while one plays, and they trail off instead of being cut */
  const SONGS = new Set(['bebecita', 'se-fue-la-luz', 'goku-drip', 'defy-gravity', 'carrera-de-buses', 'heavenly']);
  const raw = {}, buf = {}, coming = {};
  let ac = () => null, off = () => false, asked = false, cur = null, game = 0;

  function load() {
    if (asked || typeof fetch !== 'function' || typeof location === 'undefined' || location.protocol === 'file:') return; asked = true;
    for (const n of CLIPS) coming[n] = fetch(DIR + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (b) raw[n] = b; }).catch(() => {});
  }
  function stop(fade = .06) {
    if (!cur) return;
    try { const t = ac().currentTime; cur.g.gain.setTargetAtTime(0, t, fade); cur.s.stop(t + fade * 5); } catch (e) {}
    cur = null;
  }
  /* true if the clip exists (and is now playing or about to) */
  function play(name, v = .9) {
    if (off() || !(buf[name] || raw[name])) return false;
    try {
      const a = ac(), go = b => { stop(); const s = a.createBufferSource(), g = a.createGain(); g.gain.value = v; s.buffer = b; s.connect(g); g.connect(a.destination); s.start(); cur = { s, g, name }; s.onended = () => { if (cur && cur.s === s) cur = null; }; };
      if (buf[name]) go(buf[name]);
      else { const b = raw[name]; delete raw[name]; a.decodeAudioData(b, d => { buf[name] = d; go(d); }, () => {}); }
      return true;
    } catch (e) { return false; }
  }
  const roll = k => Math.random() < CHANCE[k];
  /* a clip for the start of a game: on the first game of the session it is still downloading, so it plays as soon as it lands
     (if that game is still the current one) */
  function opening(name, v) {
    if (play(name, v) || !coming[name]) return;
    const g = game; coming[name].then(() => { if (g === game) play(name, v); });
  }
  /* one of these, picked at random among the ones that exist */
  const any = (...l) => l.map(n => [Math.random(), n]).sort((a, b) => a[0] - b[0]).some(e => play(e[1]));
  return {
    /* audio: () => the AudioContext to play through; muted: () => true while sound is off */
    use(audio, muted) { ac = audio; if (muted) off = muted; },
    play, stop,
    /* a song is playing right now */
    song: () => !!cur && SONGS.has(cur.name),
    /* a microgame is starting (id): a song trails off over the command card, anything else is cut */
    begin(id) {
      stop(cur && SONGS.has(cur.name) ? .45 : .06); load(); game++;
      if (id === 'pique' && roll('race')) opening('carrera-de-buses');
      else if (DARK.has(id) && roll('dark')) opening('se-fue-la-luz', .8);
      else if (RUN.has(id) && roll('run')) opening('running');
    },
    /* a microgame ended: id, 'win' | 'lose' */
    outcome(id, r) {
      if (HIT.has(id) && roll('hit') && any('anime-ahh', 'punch')) return;
      if (r === 'win') {
        if (DODGE.has(id) && roll('dodge') && play('goku-drip')) return;
        if (CATCH.has(id) && roll('catch') && play('atrapada')) return;
        if (roll('win')) any('correct', 'anime-wow');
      } else if (roll('fail')) any('faaah', 'fart', 'spongebob-fail');
    },
    /* a game just put music on: true if the song took over (then the game keeps its own tune quiet) */
    music: () => roll('music') && play('bebecita', .8),
    /* a stage was cleared. big = the one-off moment (level 6 for the first time): that one always plays */
    clear(big) { if (big && play('defy-gravity', .8)) return; if (roll('clear')) any('yay', 'heavenly'); }
  };
})();
