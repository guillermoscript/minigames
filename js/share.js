'use strict';
/* Sharing + friend challenges. A share link is the game URL plus ?c=<score>&s=<stage index>&f=<name>;
   whoever opens it sees "<name> challenges you" on the title screen and can jump straight into that stage. */
const CH = (() => {
  try {
    const q = new URLSearchParams(location.search), c = parseInt(q.get('c'), 10), s = parseInt(q.get('s'), 10);
    if (!(c > 0) || !(s >= 0 && s < STAGES.length)) return null;
    const f = (q.get('f') || '').replace(/[^\w -]/g, '').slice(0, 16).trim();
    return { score: Math.min(c, 2000), stage: s, from: f || 'A FRIEND' };
  } catch (e) { return null; }
})();

const gameUrl = () => location.origin + location.pathname;
/* /c/<score>/<stage>/<name> is served by PocketBase with personalised link-preview tags, then redirects to /?c=&s=&f= */
function challengeUrl(score, stageIdx, name) {
  return location.origin + '/c/' + Math.round(score) + '/' + stageIdx + (name ? '/' + encodeURIComponent(name) : '');
}

/* shareable 1080x1350 score card (4:5, for the phone share sheet / posting to stories and feeds).
   o: { score, stage (index), stars (0-3, or null after a game over), name, color (mascot), best (bool: new personal best) } */
async function scoreCard(o) {
  if (!o || typeof o !== 'object') {                // legacy positional call (score, stageName, stars, name) from a stale cached main.js
    const [score, sname, stars, name] = arguments;
    o = { score, stage: Math.max(0, STAGES.findIndex(x => x.name === sname)), stars: stars > 0 ? stars : null, name };
  }
  o = Object.assign({}, o, { score: +o.score || 0, stage: Number.isInteger(o.stage) ? o.stage : 0 });
  const W2 = 1080, H2 = 1350, INKC = '#14101c', S = STAGES[o.stage] || STAGES[0], FONT = '"Fredoka", "Arial Rounded MT Bold", "Arial Black", sans-serif';
  try { await Promise.race([document.fonts.load('700 40px Fredoka'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  const c = document.createElement('canvas'); c.width = W2; c.height = H2; const g = c.getContext('2d');
  g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineCap = 'round';
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; };
  const T = (s, x, y, size, fill, align = 'center', maxW = 0, outline = true) => {
    g.font = `700 ${size}px ${FONT}`;
    if (maxW) { const w = g.measureText(s).width; if (w > maxW) { size *= maxW / w; g.font = `700 ${size}px ${FONT}`; } }
    g.textAlign = align;
    if (outline) { g.lineWidth = size / 3.2; g.strokeStyle = INKC; g.strokeText(s, x, y + size * .06); }
    g.fillStyle = fill; g.fillText(s, x, y);
  };
  /* rounded card: soft ground shadow, ink border, solid drop edge, light top sheen */
  const plate = (x, y, w, h, fill, r = 36, ol = 8, d = 12) => {
    g.save(); g.shadowColor = 'rgba(20,16,28,.35)'; g.shadowBlur = 36; g.shadowOffsetY = 18; g.fillStyle = INKC; rr(x - ol, y - ol + d, w + ol * 2, h + ol * 2, r + ol); g.fill(); g.restore();
    g.fillStyle = INKC; rr(x - ol, y - ol, w + ol * 2, h + ol * 2, r + ol); g.fill();
    g.fillStyle = fill; rr(x, y, w, h, r); g.fill();
    g.save(); rr(x, y, w, h, r); g.clip();
    const hl = g.createLinearGradient(0, y, 0, y + h); hl.addColorStop(0, 'rgba(255,255,255,.55)'); hl.addColorStop(.45, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(20,16,28,.08)'); g.fillStyle = hl; g.fillRect(x, y, w, h); g.restore();
  };
  const star = (cx, cy, R, fill, rot = -Math.PI / 2, ink = true) => {
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, r = i % 2 ? R * .52 : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath();
    if (ink) { g.save(); g.shadowColor = 'rgba(20,16,28,.3)'; g.shadowBlur = 14; g.shadowOffsetY = 8; g.lineWidth = Math.max(6, R / 4); g.strokeStyle = INKC; g.stroke(); g.restore(); }
    g.fillStyle = fill; g.fill();
    if (ink && fill === '#FFE14D') { g.save(); g.clip(); const sg = g.createLinearGradient(0, cy - R, 0, cy + R); sg.addColorStop(0, 'rgba(255,255,255,.7)'); sg.addColorStop(.55, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(230,150,0,.45)'); g.fillStyle = sg; g.fillRect(cx - R, cy - R, R * 2, R * 2); g.restore(); }
  };
  const mascot = (x, y, u, col, mood) => {          // same pixel Caos as in the game, drawn on this canvas, with a little shading
    const ol = Math.max(3, u * .45), up = mood === 'happy' ? -u : 0;
    const body = [x - 6 * u, y - 9 * u, 12 * u, 7 * u], arms = [[x - 8 * u, y - 6.5 * u + up, 2 * u, 2.4 * u], [x + 6 * u, y - 6.5 * u + up, 2 * u, 2.4 * u]],
      legs = [-5, -2.6, 1.4, 3.8].map(lx => [x + lx * u, y - 2 * u, 1.2 * u, 2 * u]), shapes = [body, ...arms, ...legs];
    g.save(); g.shadowColor = 'rgba(20,16,28,.35)'; g.shadowBlur = 30; g.shadowOffsetY = 16; g.fillStyle = INKC; for (const q of shapes) g.fillRect(q[0] - ol, q[1] - ol, q[2] + ol * 2, q[3] + ol * 2); g.restore();
    g.fillStyle = INKC; for (const q of shapes) g.fillRect(q[0] - ol, q[1] - ol, q[2] + ol * 2, q[3] + ol * 2);
    g.fillStyle = col; for (const q of shapes) g.fillRect(q[0], q[1], q[2], q[3]);
    const bg2 = g.createLinearGradient(0, body[1], 0, body[1] + body[3]); bg2.addColorStop(0, 'rgba(255,255,255,.28)'); bg2.addColorStop(.5, 'rgba(255,255,255,0)'); bg2.addColorStop(1, 'rgba(20,16,28,.22)');
    g.fillStyle = bg2; g.fillRect(body[0], body[1], body[2], body[3]);
    g.fillStyle = shade(col, .78); for (const q of legs) g.fillRect(q[0], q[1] + q[3] * .55, q[2], q[3] * .45);
    g.strokeStyle = g.fillStyle = INKC; g.lineWidth = Math.max(2, u * .6);
    for (const ex of [x - 2.8 * u, x + 2.8 * u]) {
      const ey = y - 6.2 * u; g.beginPath();
      if (mood === 'happy') { g.moveTo(ex - u * .9, ey + u); g.lineTo(ex, ey - u * .3); g.lineTo(ex + u * .9, ey + u); g.stroke(); }
      else if (mood === 'sad') { g.moveTo(ex - u * .8, ey - u * .9); g.lineTo(ex + u * .8, ey + u * .9); g.moveTo(ex + u * .8, ey - u * .9); g.lineTo(ex - u * .8, ey + u * .9); g.stroke(); }
      else g.fillRect(ex - .6 * u, ey - 1.2 * u, 1.2 * u, 2.4 * u);
    }
    if (mood === 'happy') { g.fillStyle = 'rgba(255,90,130,.45)'; for (const ex of [x - 4.6 * u, x + 4.6 * u]) { g.beginPath(); g.ellipse(ex, y - 4.2 * u, u * .9, u * .55, 0, 0, 7); g.fill(); } }
  };

  /* background: stage gradient, soft rays, glow behind the mascot, vignette, dots */
  const bgG = g.createLinearGradient(0, 0, 0, H2); bgG.addColorStop(0, S.bg[0]); bgG.addColorStop(1, shade(S.bg[1], .82)); g.fillStyle = bgG; g.fillRect(0, 0, W2, H2);
  const cx = W2 / 2, cy = 520;
  g.fillStyle = 'rgba(255,255,255,.14)';
  for (let i = 0; i < 24; i++) { const a0 = i * Math.PI / 12, a1 = a0 + Math.PI / 24; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * 1800, cy + Math.sin(a0) * 1800); g.lineTo(cx + Math.cos(a1) * 1800, cy + Math.sin(a1) * 1800); g.fill(); }
  const gl = g.createRadialGradient(cx, cy, 40, cx, cy, 820); gl.addColorStop(0, 'rgba(255,255,255,.55)'); gl.addColorStop(.45, 'rgba(255,255,255,.08)'); gl.addColorStop(1, 'rgba(20,16,28,.38)'); g.fillStyle = gl; g.fillRect(0, 0, W2, H2);
  g.fillStyle = 'rgba(255,255,255,.12)'; for (let y = 20; y < H2; y += 48) for (let x = (y / 48 & 1) * 24 + 12; x < W2; x += 48) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  const SPARK = ['#FFE14D', '#fff', '#4DB8FF', '#FF4D9E', '#5CFF7A'];       // confetti, kept to the margins
  [[70, 330, 18], [1010, 300, 22], [58, 640, 14], [1020, 700, 18], [96, 940, 20], [990, 1000, 16], [150, 245, 12], [940, 215, 14]].forEach(([x, y, R], i) => star(x, y, R, SPARK[i % 5], i, false));

  /* logo */
  g.save(); g.translate(cx, 112); g.rotate(-.035); g.shadowColor = 'rgba(20,16,28,.4)'; g.shadowBlur = 24; g.shadowOffsetY = 14;
  T('MINICAOS!', 0, 0, 132, '#FFE14D', 'center', 900); g.restore();

  /* stage pill */
  const label = (t('STAGE {n}', { n: o.stage + 1 }) + ' · ' + t(S.name)).toUpperCase();
  g.font = `700 42px ${FONT}`; const rw = Math.min(900, g.measureText(label).width + 100);
  plate(cx - rw / 2, 200, rw, 76, '#fff', 38, 7, 8); T(label, cx, 240, 42, S.col === '#FFD23F' || S.col === '#8BAC0F' ? INKC : shade(S.col, .85), 'center', rw - 60, false);

  /* stars + mascot */
  if (o.stars != null) for (let i = 0; i < 3; i++) star(cx + (i - 1) * 180, i === 1 ? 362 : 392, i === 1 ? 68 : 54, i < o.stars ? '#FFE14D' : '#6b6580', -Math.PI / 2 + (i - 1) * .22);
  else T(t('GAME OVER'), cx, 375, 104, '#FF4D4D', 'center', 860);
  g.save(); g.fillStyle = 'rgba(20,16,28,.3)'; g.filter = 'blur(6px)'; g.beginPath(); g.ellipse(cx, 682, 170, 22, 0, 0, 7); g.fill(); g.restore();
  mascot(cx, 664, 25, o.color || S.col, o.stars == null ? 'sad' : 'happy');

  /* score card */
  plate(140, 730, 800, 290, '#fff', 48, 8, 12);
  T(t('SCORE'), cx, 786, 40, '#8d89a3', 'center', 500, false);
  T(String(Math.round(o.score)), cx, 893, 170, INKC, 'center', 640, false);
  g.fillStyle = o.color || S.col; rr(cx - 130, 962, 260, 8, 4); g.fill();
  T(o.name ? o.name.toUpperCase() : t('GUEST'), cx, 995, 34, '#6d6883', 'center', 560, false);
  if (o.best) { g.save(); g.translate(868, 742); g.rotate(.14); plate(-118, -32, 236, 64, '#5CFF7A', 32, 6, 5); T(t('NEW BEST!'), 0, 1, 34, INKC, 'center', 200, false); g.restore(); }

  /* call to action */
  plate(130, 1100, 820, 108, '#5CFF7A', 54, 8, 10); T(t('CAN YOU BEAT ME?'), cx, 1155, 64, INKC, 'center', 740, false);
  g.save(); g.shadowColor = 'rgba(20,16,28,.5)'; g.shadowBlur = 8; g.shadowOffsetY = 3; T(location.host.toUpperCase() + '  ►  ' + t('PLAY FREE'), cx, 1288, 38, '#fff', 'center', 900, false); g.restore();
  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}

/* native share sheet on phones, clipboard everywhere else. Resolves 'shared' | 'copied' | 'cancelled' | 'failed'. */
async function shareText(text, url, blob) {
  if (navigator.share) {
    try {
      const data = { title: 'MiniCaos', text, url };
      if (blob) { const f = new File([blob], 'minicaos-score.png', { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [f] })) data.files = [f]; }
      await navigator.share(data); return 'shared';
    }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  try { await navigator.clipboard.writeText(text + ' ' + url); return 'copied'; } catch (e) {}
  try {                                       // clipboard API blocked (insecure origin / old browser)
    const ta = document.createElement('textarea'); ta.value = text + ' ' + url; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove();
    return ok ? 'copied' : 'failed';
  } catch (e) { return 'failed'; }
}

/* one-tap share targets for desktop (no native share sheet) */
const SHARE_TARGETS = [
  { id: 'whatsapp', label: 'WHATSAPP', fill: '#5CFF7A', href: (t, u) => 'https://wa.me/?text=' + encodeURIComponent(t + ' ' + u) },
  { id: 'x', label: 'X / TWITTER', fill: '#fff', href: (t, u) => 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t) + '&url=' + encodeURIComponent(u) },
  { id: 'telegram', label: 'TELEGRAM', fill: '#4DB8FF', href: (t, u) => 'https://t.me/share/url?url=' + encodeURIComponent(u) + '&text=' + encodeURIComponent(t) },
  { id: 'reddit', label: 'REDDIT', fill: '#FF9A4D', href: (t, u) => 'https://www.reddit.com/submit?url=' + encodeURIComponent(u) + '&title=' + encodeURIComponent(t) },
];
