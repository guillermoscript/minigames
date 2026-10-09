'use strict';
/* Caos's friends: the MiniCaos cast of Latin American animals. Each one hosts a stage (STAGES[i].host).
   Same signature and footprint as caos(x, y, u, o) in js/core.js: x = centre, y = bottom of feet, u = pixel unit,
   o = { col, mood: 'happy' | 'sad' | null, run }. Drawn on the global ctx; animated from the global `now`.
   Sketch gallery: docs/mascot-preview.html (keep the two in sync). */
const CAST = (() => {
function blocks(shapes, col, ol) {
    ctx.fillStyle = INK;
    for (const s of shapes) ctx.fillRect(s[0] - ol, s[1] - ol, s[2] + ol * 2, s[3] + ol * 2);
    ctx.fillStyle = col;
    for (const s of shapes) ctx.fillRect(s[0], s[1], s[2], s[3]);
  }
  function legsFor(x, y, u, o, xs) {
    return xs.map((lx, i) => {
      const lift = o.run != null ? Math.max(0, Math.sin(o.run * 16 + i * Math.PI)) * 1.1 * u : 0;
      return [x + lx * u, y - 2 * u, 1.6 * u, 2 * u - lift];
    });
  }
  function eyes(ex, ey, u, mood, big) {
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = Math.max(2, u * .55); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const e of ex) {
      if (mood === 'happy') {
        ctx.beginPath(); ctx.moveTo(e - u * .9, ey + u); ctx.lineTo(e, ey - u * .3); ctx.lineTo(e + u * .9, ey + u); ctx.stroke();
      } else if (mood === 'sad') {
        ctx.beginPath(); ctx.moveTo(e - u * .8, ey - u * .9); ctx.lineTo(e + u * .8, ey + u * .9);
        ctx.moveTo(e + u * .8, ey - u * .9); ctx.lineTo(e - u * .8, ey + u * .9); ctx.stroke();
      } else if (big) {
        const blink = Math.sin(now * 1.7) > .985 ? .2 : 1;
        ctx.fillStyle = '#fff'; ctx.fillRect(e - 1.3 * u, ey - 1.7 * u * blink, 2.6 * u, 3.4 * u * blink);
        ctx.fillStyle = INK; ctx.fillRect(e - .3 * u + Math.sin(now * .9) * .4 * u, ey - .6 * u * blink, 1.2 * u, 1.8 * u * blink);
      } else {
        const blink = Math.sin(now * 1.7) > .985 ? .25 : 1;
        ctx.fillRect(e - .6 * u, ey - 1.2 * u * blink, 1.2 * u, 2.4 * u * blink);
      }
    }
    ctx.lineCap = 'butt';
  }

  /* ── Caos's friends: Latin American animals, one per stage host ── */
  function bob(o, u, f = 10) { return o.mood === 'happy' ? Math.abs(Math.sin(now * f)) * 1.1 * u : 0; }
  
  /* Sapito (frog) — Bug Hunt. Eyes sit on top bumps; tongue flicks when happy. */
  function sapito(x, y, u, o = {}) {
    const c = o.col || '#5CC24A', ol = Math.max(3, u * .5), mood = o.mood; y -= bob(o, u);
    blocks([[x - 7 * u, y - 7 * u, 14 * u, 5 * u], [x - 6 * u, y - 8.5 * u, 12 * u, 2 * u],
      [x - 6 * u, y - 11 * u, 4 * u, 3.4 * u], [x + 2 * u, y - 11 * u, 4 * u, 3.4 * u],
      ...legsFor(x, y, u, o, [-6, -3.5, 2, 4.5]).map(l => [l[0], l[1], 1.6 * u, l[3]])], c, ol);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x - 5 * u, y - 6 * u, 10 * u, 2.4 * u);
    eyes([x - 4 * u, x + 4 * u], y - 9.4 * u, u * .85, mood, true);
    ctx.fillStyle = INK; ctx.fillRect(x - 4 * u, y - 5.2 * u, 8 * u, .6 * u);
    if (mood === 'happy') { const t = Math.max(0, Math.sin(now * 6)) * 5 * u; ctx.fillStyle = '#FF4D9E'; ctx.fillRect(x - .5 * u, y - 5.2 * u, u, t + u); ctx.fillRect(x - u, y - 5 * u + t, 2 * u, 1.2 * u); }
  }
  
  /* Pulpi (octopus) — Keyboard Kingdom. Dome head, four wiggling tentacles. */
  function pulpi(x, y, u, o = {}) {
    const c = o.col || '#B06CFF', ol = Math.max(3, u * .5), mood = o.mood; y -= bob(o, u);
    const sp = o.run != null ? 18 : mood === 'happy' ? 12 : 3;
    const tent = [-5.6, -2.4, .8, 4].map((tx, i) => [x + tx * u + Math.sin(now * sp + i) * .5 * u, y - 4 * u, 1.6 * u, 4 * u - Math.abs(Math.sin(now * sp + i * 1.3)) * u]);
    blocks([[x - 6 * u, y - 10 * u, 12 * u, 6.5 * u], [x - 4.5 * u, y - 12 * u, 9 * u, 9 * u], ...tent], c, ol);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - 3 * u, y - 11 * u, 1.6 * u, 1.6 * u); ctx.fillRect(x + 2 * u, y - 10.4 * u, u, u);
    eyes([x - 2.4 * u, x + 2.4 * u], y - 7 * u, u, mood, true);
  }
  
  /* Zumbi (hummingbird) — Reflex Rush. Wings blur, long beak, tail. */
  function zumbi(x, y, u, o = {}) {
    const c = o.col || '#2EC4B6', ol = Math.max(3, u * .5), mood = o.mood;
    const hover = Math.sin(now * 6) * .8 * u; y += hover - 2 * u;
    const flap = mood === 'sad' ? 0 : Math.sin(now * 60) > 0 ? 1 : -1;
    blocks([[x - 4 * u, y - 9 * u, 8 * u, 6 * u], [x - 3 * u, y - 10.5 * u, 6 * u, 2 * u],
      [x - 6 * u, y - 4.5 * u, 3 * u, 2 * u], [x + 4 * u, y - 7.4 * u, 5 * u, 1 * u],
      [x - 5 * u, y - 10 * u - flap * 2.5 * u, 4 * u, 2 * u]], c, ol);
    ctx.fillStyle = '#FF4D6D'; ctx.fillRect(x - 3 * u, y - 5 * u, 6 * u, 1.6 * u);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x - 5 * u, y - 10 * u - flap * 2.5 * u, 4 * u, 2 * u);
    ctx.fillStyle = INK; ctx.fillRect(x + 4 * u, y - 7.2 * u, 5 * u, .6 * u);
    eyes([x + 1.8 * u], y - 7.8 * u, u * .8, mood, true);
  }
  
  /* Chigüi (capybara) — Mouse Mayhem. Long blocky body, sleepy eyes, the meme orange on its head. */
  function chigui(x, y, u, o = {}) {
    const c = o.col || '#A0703C', ol = Math.max(3, u * .5), mood = o.mood; y -= bob(o, u, 6);
    blocks([[x - 8 * u, y - 8 * u, 13 * u, 6 * u], [x + 3 * u, y - 9.5 * u, 6 * u, 6 * u], [x - 6 * u, y - 9 * u, 9 * u, 1.4 * u],
      [x + 3.6 * u, y - 10.6 * u, 1.4 * u, 1.4 * u], ...legsFor(x, y, u, o, [-7, -4, 0, 3])], c, ol);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 7 * u, y - 7.4 * u, 2 * u, 2.4 * u);
    ctx.fillStyle = INK; ctx.fillRect(x + 7.6 * u, y - 7.2 * u, .6 * u, .6 * u);
    if (mood === 'happy' || mood === 'sad') eyes([x + 5 * u], y - 7.6 * u, u * .9, mood, false);
    else { ctx.fillStyle = INK; ctx.fillRect(x + 4.2 * u, y - 7.6 * u, 1.8 * u, .55 * u); }   // eternally unbothered
    if (mood !== 'sad') {
      const ox = x + 5.2 * u, oy = y - 11.8 * u - (mood === 'happy' ? Math.abs(Math.sin(now * 6)) * 1.6 * u : 0);
      blocks([[ox - 1.4 * u, oy - 1.2 * u, 2.8 * u, 2.4 * u]], '#FF9F1C', Math.max(2, u * .35));
      ctx.fillStyle = '#5CC24A'; ctx.fillRect(ox, oy - 2 * u, 1.2 * u, .8 * u);
    }
  }
  
  /* Profe Lechuza (owl) — Brain Break. Ear tufts, round glasses, beak. */
  function lechuza(x, y, u, o = {}) {
    const c = o.col || '#8A6A4F', ol = Math.max(3, u * .5), mood = o.mood; y -= bob(o, u);
    const wing = mood === 'happy' ? Math.sin(now * 14) * u : 0;
    blocks([[x - 5.5 * u, y - 11 * u, 11 * u, 9.5 * u], [x - 6.5 * u, y - 9 * u, 13 * u, 6 * u],
      [x - 5.5 * u, y - 12.6 * u, 2 * u, 2 * u], [x + 3.5 * u, y - 12.6 * u, 2 * u, 2 * u],
      [x - 8 * u, y - 7 * u - wing, 1.8 * u, 4 * u], [x + 6.2 * u, y - 7 * u + wing, 1.8 * u, 4 * u],
      ...legsFor(x, y, u, o, [-2.6, 1])], c, ol);
    ctx.fillStyle = '#E8D6B0'; ctx.fillRect(x - 3.5 * u, y - 5.4 * u, 7 * u, 3.4 * u);
    ctx.fillStyle = INK; ctx.fillRect(x - 5 * u, y - 10.2 * u, 4.4 * u, 4 * u); ctx.fillRect(x + .6 * u, y - 10.2 * u, 4.4 * u, 4 * u); ctx.fillRect(x - .8 * u, y - 8.6 * u, 1.6 * u, .6 * u);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 4.5 * u, y - 9.7 * u, 3.4 * u, 3 * u); ctx.fillRect(x + 1.1 * u, y - 9.7 * u, 3.4 * u, 3 * u);
    eyes([x - 2.8 * u, x + 2.8 * u], y - 8.2 * u, u * .8, mood, false);
    ctx.fillStyle = '#FFB000'; ctx.fillRect(x - .6 * u, y - 6.4 * u, 1.2 * u, 1.4 * u);
  }

  const ALL = { sapito, pulpi, zumbi, chigui, lechuza };
  /* draw a stage host: a cast member (in its own colours) or, when the stage has none yet, Caos in o.col. o.locked greys either out */
  function host(id, x, y, u, o = {}) { const f = ALL[id]; return f ? f(x, y, u, Object.assign({}, o, { col: o.locked ? '#7a7890' : null })) : caos(x, y, u, o.locked ? Object.assign({}, o, { col: '#7a7890' }) : o); }
  return Object.assign({ host }, ALL);
})();
