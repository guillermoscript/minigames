/* In-page driver for scripts/marketing/clip.js. Loaded into the REAL game (index.html) after main.js, so every frame is the game's
   own render(): instruction card, HUD, fuse, NICE!/FAIL! stamps, the inter screens with Caos, the stage intros with the hosts.
   - time: requestAnimationFrame is disabled (see the init script in clip.js); run(n) calls main.js's loop(ts) with a fixed 1/fps step,
     so the clip is smooth at any machine speed and the same seed gives the same clip.
   - sound: AudioContext is swapped for an OfflineAudioContext whose currentTime is the virtual clock (clip.js init script);
     audioWav() renders everything the game scheduled (sfx + music) into a WAV at the end.
   - inputs: BOTS[id](want, e) are called once per frame while a microgame is live. They read the game's state from the art calls
     (SPY wraps W1A.swat, W2STOP.draw, ...) and act through the same entry points main.js uses (cur.down / cur.move / cur.key).
   Globals used from the game: state, st, mode, stage, stageIdx, played, lives, score, shownScore, lastOut, recent, retryId, runLog,
   cur, curId, tt, pre, outcome, mouse, pressing, keys, interacted, muted, mus, musTick, loop, startStage, speed, STAGES, W, H. */
(() => {
  'use strict';
  const D = window.__drv = { frame: 0, fps: 30, done: false, results: [], warn: [] };
  const SPY = window.__spy = {};
  let P = null;                                          // the plan being played

  /* ── spies: remember the last state each art function was drawn with (read-only, the game is unchanged) ── */
  function spy(obj, prop, id) {
    if (!obj || typeof obj[prop] !== 'function') return;
    const orig = obj[prop];
    obj[prop] = function (a) { SPY[id] = a; return orig.apply(this, arguments); };
  }
  function installSpies() {
    if (typeof W1A !== 'undefined') { spy(W1A, 'swat', 'swat'); spy(W1A, 'jump', 'jump'); spy(W1A, 'type', 'type'); spy(W1A, 'mash', 'mash'); }
    if (typeof W2STOP !== 'undefined') spy(W2STOP, 'draw', 'stop');
    if (typeof W2COUNT !== 'undefined') spy(W2COUNT, 'draw', 'count');
  }

  /* ── HD: draw the 800×600 logical canvas at S× pixels (every main.js frame starts with ctx.setTransform) ── */
  function installHD(S) {
    if (!(S > 1)) return;
    cv.width = W * S; cv.height = H * S;
    const set = ctx.setTransform.bind(ctx), reset = ctx.resetTransform ? ctx.resetTransform.bind(ctx) : null;
    ctx.setTransform = function (a, b, c, d, e, f) {
      if (typeof a === 'object' && a) return set(a.a * S, a.b * S, a.c * S, a.d * S, a.e * S, a.f * S);
      return set(a * S, b * S, c * S, d * S, e * S, f * S);
    };
    ctx.resetTransform = () => set(S, 0, 0, S, 0, 0);
    void reset;
  }

  /* ── pointer + keyboard, the way main.js forwards them to the live microgame ── */
  const ptr = { x: 400, y: 330, upAt: -1, keyUps: [] };
  const live = () => state === 'play' && !outcome && pre <= 0 && cur;
  const api = {
    show(x, y) { ptr.x = x; ptr.y = y; mouse = { x, y, touch: false }; },
    hide() { mouse = { x: -999, y: -999, touch: true }; },
    /* glide the hand toward (x, y); returns the distance still to go */
    aim(x, y, spd = 2600) {
      const dx = x - ptr.x, dy = y - ptr.y, d = Math.hypot(dx, dy), st1 = spd / D.fps;
      if (d <= st1) { ptr.x = x; ptr.y = y; } else { ptr.x += dx / d * st1; ptr.y += dy / d * st1; }
      const p = { x: ptr.x, y: ptr.y, touch: false }; mouse = p;
      if (live() && cur.move) cur.move(p);
      return Math.max(0, d - st1);
    },
    click() {
      if (!live()) return; const p = { x: ptr.x, y: ptr.y, touch: false };
      pressing = true; ptr.upAt = tt + .08; if (cur.move) cur.move(p); if (cur.down) cur.down(p);
    },
    key(code, key) {
      if (!live()) return; keys[code] = true;
      const k = key != null ? key : code === 'Space' ? ' ' : code.replace(/^(Key|Digit)/, '').toLowerCase();
      if (cur.key) cur.key({ code, key: k, repeat: false, preventDefault() {} });
      ptr.keyUps.push([code, tt + .06]);
    },
  };
  function releaseInputs() {
    if (ptr.upAt >= 0 && tt >= ptr.upAt) { ptr.upAt = -1; pressing = false; if (live() && cur.up) cur.up({ x: ptr.x, y: ptr.y, touch: false }); }
    ptr.keyUps = ptr.keyUps.filter(([code, at]) => { if (tt < at) return true; keys[code] = false; if (live() && cur.keyup) cur.keyup({ code, key: code, preventDefault() {} }); return false; });
  }

  /* ── bots: (want, e) once per live frame. e = { t: seconds since the microgame went live, dt, s: spied state, m: per-game memory, sp: speed } ── */
  const BOTS = {
    swat(want, e) {
      if (!e.s) return; e.m.cd = (e.m.cd || 0) - e.dt; if (e.t < .15) return;
      const bugs = e.s.bugs.filter(b => !b.dead); if (!bugs.length) return;
      const b = bugs.sort((p, q) => Math.hypot(p.x - ptr.x, p.y - ptr.y) - Math.hypot(q.x - ptr.x, q.y - ptr.y))[0];
      const miss = want === 'lose' && bugs.length === 1;              // lose: squash all but the last one, then keep whiffing it
      const ox = miss ? 62 * Math.cos(e.t * 3) : 0, oy = miss ? 62 * Math.sin(e.t * 3) : 0;
      const d = api.aim(b.x + ox, b.y + oy, miss ? 1500 : 2600);
      if (d < 14 && e.m.cd <= 0) { api.click(); e.m.cd = miss ? .45 : .12; }
    },
    jump(want, e) {
      api.hide(); if (!e.s) return;
      const spd = 420 * e.sp, dmin = 78 + .09 * spd, dmax = .65 * spd - 78;
      e.s.obs.forEach((o, i) => {
        const d = o.x - 150;
        if (!o.passed && !o.jumped && d > 0 && d <= (dmin + dmax) / 2) { o.jumped = 1; if (!(want === 'lose' && i === 1)) api.key('Space'); }   // lose: clear the first bug, trip on the second
      });
    },
    type(want, e) {
      api.hide(); if (!e.s) return; e.m.cd = (e.m.cd || 0) - e.dt; if (e.t < .3 || e.m.cd > 0) return;
      const { w, i } = e.s;
      if (want === 'lose' && i >= Math.ceil(w.length / 2)) {        // lose: half the word, then fumbles
        const wrong = 'QZXJVKWY'.split('').find(c => c !== w[i]); api.key('Key' + wrong, wrong.toLowerCase()); e.m.cd = .42; return;
      }
      api.key('Key' + w[i], w[i].toLowerCase()); e.m.cd = .17;
    },
    count(want, e) {
      if (!e.s) return;
      const { pts, n, clock } = e.s, last = Math.max(...pts.map(p => p.at));
      if (clock < last + .35) { api.aim(400, 330 + Math.sin(e.t * 4) * 10, 600); return; }
      const v = want === 'win' ? n : n < 8 ? n + 1 : n - 1, bx = 56 + (v - 1) * 86 + 38, by = 480;
      if (api.aim(bx, by, 1800) < 4 && !e.m.done) { e.m.done = 1; api.click(); }
    },
    stop(want, e) {
      api.hide(); if (!e.s || e.m.done) return;
      const { p, zx, zw } = e.s;
      const hit = want === 'win' ? e.t > .7 && p >= zx + zw * .3 && p <= zx + zw * .7
        : e.t > 1.2 && ((p > zx + zw + 10 && p < zx + zw + 40) || (p < zx - 10 && p > zx - 40));   // lose: a near miss, just outside the green
      if (hit) { e.m.done = 1; api.key('Space'); }
    },
    mash(want, e) {
      e.m.cd = (e.m.cd || 0) - e.dt; api.aim(400 + Math.sin(e.t * 9) * 6, 300, 900);
      if (e.t > .15 && e.m.cd <= 0) { api.click(); e.m.cd = want === 'win' ? .075 : .32; }
    },
    dont(want, e) {
      const k = Math.sin(e.t * 2.2);                                  // the hand creeps toward the button and pulls back
      if (want === 'lose' && e.t > 1.4) { if (api.aim(400, 380, 1600) < 4 && !e.m.done) { e.m.done = 1; api.click(); } return; }
      api.aim(400 + k * 40, 470 - (k + 1) * 30, 500);
    },
    /* POWER OUT! (js/games/ap1.js): these expose probe() and their own clock g.c */
    ap_switch(want, e) {
      e.m.cd = (e.m.cd || 0) - e.dt; api.aim(330 + Math.sin(e.t * 7) * 4, 345, 1400);
      if (e.t > .25 && e.m.cd <= 0) { api.click(); e.m.cd = want === 'win' ? .13 : .6; }   // lose: too slow, the light never comes back
    },
    ap_fridge(want, e) {
      e.m.cd = (e.m.cd || 0) - e.dt; api.aim(505, 385 + Math.sin(e.t * 8) * 6, 1200);
      const o = e.s ? e.s.o : 0, push = want === 'win' ? o > .22 : e.t < 1.3 && o > .3;   // lose: gives up after a few shoves
      if (push && e.m.cd <= 0) { api.click(); e.m.cd = .12; }
    },
    ap_mosquito(want, e) {
      if (!e.s) return; e.m.cd = (e.m.cd || 0) - e.dt;
      const off = want === 'lose' ? 70 : 0, d = api.aim(e.s.x + off * Math.cos(e.t * 2), e.s.y + off * Math.sin(e.t * 2), e.t < .7 ? 700 : 2400);
      if (e.t > .8 && d < 10 && e.m.cd <= 0) { api.click(); e.m.cd = want === 'win' ? .35 : .55; }
    },
    ap_battery(want, e) {
      if (!e.s) return; e.m.cd = (e.m.cd || 0) - e.dt;
      const off = want === 'lose' ? 65 : 0, d = api.aim(e.s.x + off, e.s.y + 26 + off * .4, e.t < .5 ? 500 : 2400);
      if (e.t > .7 && d < 6 && e.m.cd <= 0) { api.click(); e.m.cd = .7; }                  // lose: each miss zaps and burns battery
    },
    ap_arepa(want, e) {
      if (!e.s || e.m.done) return; api.aim(420, 470, 600);
      const { cook, lo, hi } = e.s;
      if (want === 'win' ? cook >= (lo + hi) / 2 : cook >= hi + .05) { e.m.done = 1; api.click(); }   // lose: a beat too late (charcoal)
    },
    ap_grita(want, e) {
      if (!e.s || e.m.done) return; api.aim(400, 420, 400);
      if (e.g.c >= (want === 'win' ? e.s.T + .2 : e.s.T - .35)) { e.m.done = 1; api.click(); }   // lose: jumps the gun on the flicker
    },
  };
  D.bots = Object.keys(BOTS);

  /* ── plans ── */
  function startSeq() {
    const base = STAGES[P.host];
    mode = 'stage'; stageIdx = P.host;
    stage = Object.assign({}, base, { pool: [P.items[0].id], n: P.items.length, sp0: P.sp0 != null ? P.sp0 : base.sp0 });
    lives = 4; played = 0; score = 0; shownScore = 0; lastOut = null; recent = []; retryId = null; runLog = [];
    state = P.intro ? 'stagein' : 'inter'; st = 0; lifeT = 99;
    P.k = 0;
  }
  function seqBefore() {
    const n = P.items.length;
    if (state === 'inter') {
      if (P.k < n) {
        stage.pool = [P.items[P.k].id]; recent.length = 0; retryId = null; played = P.k;
      }
    }
    if (state === 'play') {
      if (pre <= 0 && !outcome) {
        const item = P.items[P.k] || {}, bot = BOTS[curId];
        P.t += 1 / D.fps;
        if (bot) bot(item.want || 'win', { t: P.t, dt: 1 / D.fps, s: cur.probe ? cur.probe() : SPY[curId], m: P.m, sp: speed(), g: cur });
      }
    }
  }
  function seqAfter() {
    if (state === 'inter' && P.prev !== 'inter' && P.k < P.items.length) st = Math.max(st, 1.4 - P.inter);
    if (state === 'play' && P.prev !== 'play') { pre = Math.min(pre, P.pre); P.m = {}; P.t = 0; P.counted = false; ptr.x = 400; ptr.y = 360; api.hide(); }
    if (state === 'play' && outcome && !P.counted) {
      P.counted = true; const item = P.items[P.k];
      D.results.push({ id: curId, want: item.want, got: outcome, at: +(D.frame / D.fps).toFixed(2) });
      P.k++;
      if (lives <= 0 && P.k < P.items.length) lives = 1;   // more than 3 fails would end the run (GAME OVER): keep one life so the clip goes on
    }
  }
  function introsBefore() {
    if (P.segT == null || P.segT >= P.each) {
      if (P.i >= P.stages.length) { D.done = true; return; }
      startStage(P.stages[P.i++] - 1); P.segT = 0;
    }
    P.segT += 1 / D.fps;
  }

  D.setup = o => {
    D.fps = o.fps || 30; installHD(o.hd || 1); installSpies();
    muted = !o.sound; interacted = !!o.music;
    P = Object.assign({ prev: '' }, o.plan);
    if (P.kind === 'seq') { P.items.forEach(it => { if (!REGMAP[it.id]) throw new Error('unknown microgame id: ' + it.id); if (!BOTS[it.id]) D.warn.push(it.id); }); startSeq(); }
    else if (P.kind === 'intros') { P.i = 0; }
    return { bots: D.bots, warn: D.warn, size: [cv.width, cv.height] };
  };

  /* step n frames, returning each one as a JPEG data URL */
  D.run = (n, q) => {
    const out = [];
    for (let i = 0; i < n && !D.done; i++) {
      D.frame++; window.__vt = D.frame / D.fps;
      if (P.kind === 'seq') seqBefore(); else introsBefore();
      if (D.done) break;
      if (state === 'play') releaseInputs();
      loop(D.frame * 1000 / D.fps);
      if (interacted && !muted && mus.on) musTick();
      if (P.kind === 'seq') { seqAfter(); if (P.k >= P.items.length && state !== 'play') { D.done = true; break; } }   // last stamp done: clip.js freezes on it (--tail)
      P.prev = state;
      out.push(cv.toDataURL('image/jpeg', q || .92));
    }
    return { frames: out, done: D.done, results: D.results };
  };

  /* render the offline audio graph and return the first `secs` seconds as a 16-bit stereo WAV (base64) */
  D.audioWav = async secs => {
    if (typeof AC === 'undefined' || !AC || !AC.startRendering) return null;
    const buf = await AC.startRendering(), sr = buf.sampleRate, len = Math.min(buf.length, Math.ceil(secs * sr));
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const bytes = new Uint8Array(44 + len * 4), v = new DataView(bytes.buffer);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
    str(0, 'RIFF'); v.setUint32(4, 36 + len * 4, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, len * 4, true);
    for (let i = 0, o = 44; i < len; i++, o += 4) {
      v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
})();
