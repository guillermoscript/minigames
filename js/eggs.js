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
  /* how often each one fires (0 = never, 1 = always); each sound category is capped once per stage. */
  const CHANCE = {
    fail: .06,     // a lost microgame: 'faaah', 'fart' or 'spongebob-fail'
    hit: .15,      // any result in a game where something gets smacked: 'anime-ahh' or 'punch'
    dodge: .12,    // a won dodging game: 'goku-drip'
    catch: .12,    // a won catching game: 'atrapada'
    run: .1,       // a running game starts: 'running'
    dark: .015,    // a blackout game starts: 'se-fue-la-luz' (very rare)
    race: .2,      // the lab's bus race (pique) starts: 'carrera-de-buses'
    win: .05,      // a won microgame: 'correct' or 'anime-wow'
    clear: .25,    // a cleared stage: 'yay' or 'heavenly'
    music: .1      // winning a game that puts music on (the lab's pendrive and anuncio): 'bebecita' instead of the game's own tune
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
  function play(name, v = .9, type) {
    if (off() || used.has(name) || pending.has(name) || (type && (results.has(type) || pendingResults.has(type))) || !(buf[name] || raw[name])) return false;
    try {
      const a = ac(); if (!a) return false;
      pending.clear(); pendingResults.clear();
      pending.add(name); if (type) pendingResults.add(type);
      const ticket = ++request, go = b => {
        if (ticket !== request || off()) return;
        try {
          stop(); const s = a.createBufferSource(), g = a.createGain();
          g.gain.value = v; s.buffer = b; s.connect(g); g.connect(a.destination); s.start();
          used.add(name); if (type) results.add(type); badge = 2.7;
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
  function opening(name, v, type) {
    if (play(name, v, type) || !coming[name]) return;
    const g = game, ticket = request; coming[name].then(() => { if (g === game && ticket === request) play(name, v, type); });
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
      const t = 2.7 - badge, enter = Math.min(1, t / .28), scale = enter < 1 ? .55 + enter * .55 : 1 + Math.sin(t * 9) * .025;
      x.save(); x.translate(width / 2, 142); x.rotate(-.025); x.scale(scale, scale);
      x.globalAlpha = Math.min(1, badge / .38);
      // A burst behind the announcement makes the hidden clip feel like a discovered event.
      x.save(); x.rotate(t * .35);
      for (let i = 0; i < 20; i++) {
        x.rotate(Math.PI / 10); x.fillStyle = i % 2 ? 'rgba(255,225,77,.72)' : 'rgba(255,107,61,.76)';
        x.fillRect(-5, -108, 10, 42);
      }
      x.restore();
      x.fillStyle = '#14101c'; x.fillRect(-218, -53, 436, 112);
      x.fillStyle = '#FFE14D'; x.fillRect(-224, -59, 436, 112);
      x.strokeStyle = '#14101c'; x.lineWidth = 5; x.strokeRect(-224, -59, 436, 112);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#14101c';
      x.font = '900 32px "Arial Black", sans-serif'; x.fillText(spanish ? '¡EASTER EGG!' : 'EASTER EGG!', 0, -21);
      x.font = '900 16px "Arial Black", sans-serif'; x.fillText(spanish ? '¡HALLAZGO SECRETO!' : 'SECRET DISCOVERY!', 0, 22);
      // Confetti pops beyond the banner while keeping the game visible.
      for (let i = 0; i < 14; i++) {
        const a = i * Math.PI / 7, r = 245 + Math.min(t, .6) * 35;
        x.save(); x.translate(Math.cos(a) * r, Math.sin(a) * 70); x.rotate(a + t * 4);
        x.fillStyle = ['#FF6B3D', '#5CFF7A', '#7C4DFF', '#fff'][i % 4]; x.fillRect(-5, -5, 10, 10); x.restore();
      }
      x.restore();
    },
    /* a song is playing right now */
    song: () => !!cur && SONGS.has(cur.name),
    /* a microgame is starting (id): a song trails off over the command card, anything else is cut */
    begin(id) {
      stop(cur && SONGS.has(cur.name) ? .45 : .06); load(); game++; outcomeDone = false;
      if (id === 'pique' && roll('race')) opening('carrera-de-buses', .9, 'race');
      else if (DARK.has(id) && roll('dark')) opening('se-fue-la-luz', .8, 'dark');
      else if (RUN.has(id) && roll('run')) opening('running', .9, 'run');
    },
    /* a microgame ended: id, 'win' | 'lose' */
    outcome(id, r) {
      if (outcomeDone) return;
      outcomeDone = true;
      if (HIT.has(id) && roll('hit') && any('hit', 'anime-ahh', 'punch')) return;
      if (r === 'win') {
        if (DODGE.has(id) && roll('dodge') && play('goku-drip', .9, 'dodge')) return;
        if (CATCH.has(id) && roll('catch') && play('atrapada', .9, 'catch')) return;
        if (roll('win')) any('victory', 'correct', 'anime-wow');
      } else if (roll('fail')) any('defeat', 'faaah', 'fart', 'spongebob-fail');
    },
    /* a game just put music on: true if the song took over (then the game keeps its own tune quiet) */
    music() { if(outcomeDone || !roll('music') || !play('bebecita', .8, 'music')) return false; outcomeDone = true; return true; },
    /* a stage was cleared. big = the one-off moment (level 6 for the first time): that one always plays */
    clear(big) { if (big && play('defy-gravity', .8, 'victory')) return; if (roll('clear')) any('victory', 'yay', 'heavenly'); }
  };
})();
