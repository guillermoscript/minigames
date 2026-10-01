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
function scoreCard(o) {
  const W2 = 1080, H2 = 1350, INKC = '#14101c', S = STAGES[o.stage] || STAGES[0];
  const c = document.createElement('canvas'); c.width = W2; c.height = H2; const g = c.getContext('2d');
  g.textBaseline = 'middle'; g.lineJoin = 'round';
  const T = (s, x, y, size, fill, align = 'center', maxW = 0) => {
    g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
    if (maxW) { const w = g.measureText(s).width; if (w > maxW) { size *= maxW / w; g.font = `900 ${size}px "Arial Black", Impact, sans-serif`; } }
    g.textAlign = align; if (fill !== INKC) { g.lineWidth = size / 4.5; g.strokeStyle = INKC; g.strokeText(s, x, y); } g.fillStyle = fill; g.fillText(s, x, y);   // ink text on a light plate needs no outline
  };
  const plate = (x, y, w, h, fill, d = 12, ol = 10) => {
    g.fillStyle = INKC; g.fillRect(x - ol + d, y - ol + d, w + ol * 2, h + ol * 2);
    g.fillRect(x - ol, y - ol, w + ol * 2, h + ol * 2); g.fillStyle = fill; g.fillRect(x, y, w, h);
    const hl = g.createLinearGradient(0, y, 0, y + h); hl.addColorStop(0, 'rgba(255,255,255,.35)'); hl.addColorStop(.5, 'rgba(255,255,255,0)'); g.fillStyle = hl; g.fillRect(x, y, w, h);
  };
  const star = (cx, cy, R, fill, rot = -Math.PI / 2) => {
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, r = i % 2 ? R * .46 : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath();
    g.lineWidth = Math.max(5, R / 5); g.strokeStyle = INKC; g.stroke(); g.fillStyle = fill; g.fill();
  };
  const mascot = (x, y, u, col, mood) => {          // same pixel Claude as in the game, drawn on this canvas
    const ol = Math.max(3, u * .5), shapes = [[x - 6 * u, y - 9 * u, 12 * u, 7 * u], [x - 8 * u, y - 6.5 * u + (mood === 'happy' ? -u : 0), 2 * u, 2.4 * u], [x + 6 * u, y - 6.5 * u + (mood === 'happy' ? -u : 0), 2 * u, 2.4 * u],
      ...[-5, -2.6, 1.4, 3.8].map(lx => [x + lx * u, y - 2 * u, 1.2 * u, 2 * u])];
    g.fillStyle = INKC; for (const q of shapes) g.fillRect(q[0] - ol, q[1] - ol, q[2] + ol * 2, q[3] + ol * 2);
    g.fillStyle = col; for (const q of shapes) g.fillRect(q[0], q[1], q[2], q[3]);
    g.strokeStyle = g.fillStyle = INKC; g.lineWidth = Math.max(2, u * .55); g.lineCap = 'round';
    for (const ex of [x - 2.8 * u, x + 2.8 * u]) {
      const ey = y - 6.2 * u; g.beginPath();
      if (mood === 'happy') { g.moveTo(ex - u * .9, ey + u); g.lineTo(ex, ey - u * .3); g.lineTo(ex + u * .9, ey + u); g.stroke(); }
      else if (mood === 'sad') { g.moveTo(ex - u * .8, ey - u * .9); g.lineTo(ex + u * .8, ey + u * .9); g.moveTo(ex + u * .8, ey - u * .9); g.lineTo(ex - u * .8, ey + u * .9); g.stroke(); }
      else g.fillRect(ex - .6 * u, ey - 1.2 * u, 1.2 * u, 2.4 * u);
    }
    g.lineCap = 'butt';
  };

  /* background: the stage's colours, sunburst, vignette, halftone dots */
  g.fillStyle = S.bg[0]; g.fillRect(0, 0, W2, H2);
  g.fillStyle = S.bg[1]; const cx = W2 / 2, cy = 640;
  for (let i = 0; i < 20; i++) { const a0 = i * Math.PI / 10, a1 = a0 + Math.PI / 20; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * 1800, cy + Math.sin(a0) * 1800); g.lineTo(cx + Math.cos(a1) * 1800, cy + Math.sin(a1) * 1800); g.fill(); }
  const gl = g.createRadialGradient(cx, cy, 80, cx, cy, 900); gl.addColorStop(0, 'rgba(255,255,255,.35)'); gl.addColorStop(1, 'rgba(20,16,28,.28)'); g.fillStyle = gl; g.fillRect(0, 0, W2, H2);
  g.fillStyle = 'rgba(20,16,28,.07)'; for (let y = 14; y < H2; y += 40) for (let x = (y / 40 & 1) * 20 + 10; x < W2; x += 40) { g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); }
  const SPARK = ['#FFE14D', '#5CFF7A', '#4DB8FF', '#FF4D9E', '#fff'];       // confetti stars around the edges
  [[90, 330], [990, 300], [70, 760], [1010, 820], [160, 1010], [930, 1040], [330, 230], [760, 215], [120, 560], [960, 600]].forEach(([x, y], i) => star(x, y, 20 + (i % 3) * 8, SPARK[i % 5], i));

  /* logo */
  g.save(); g.translate(cx, 112); g.rotate(-.04);
  T('CLAUDE WARE!', 8, 10, 118, INKC, 'center', 900); T('CLAUDE WARE!', 0, 0, 118, '#FFE14D', 'center', 900); g.restore();

  /* stage ribbon */
  const label = t('STAGE {n}', { n: o.stage + 1 }) + ' · ' + t(S.name);
  g.font = '900 44px "Arial Black", Impact, sans-serif'; const rw = Math.min(900, g.measureText(label).width + 90);
  plate(cx - rw / 2, 195, rw, 78, '#fff', 8, 8); T(label, cx, 236, 44, S.col, 'center', rw - 50);

  /* mascot + stars */
  g.save(); g.fillStyle = 'rgba(20,16,28,.28)'; g.beginPath(); g.ellipse(cx, 700, 190, 28, 0, 0, 7); g.fill(); g.restore();
  mascot(cx, 690, 27, o.color || S.col, o.stars == null ? 'sad' : 'happy');
  if (o.stars != null) for (let i = 0; i < 3; i++) star(cx + (i - 1) * 190, i === 1 ? 372 : 405, i === 1 ? 72 : 60, i < o.stars ? '#FFE14D' : '#4a4558', -Math.PI / 2 + (i - 1) * .25);
  else T(t('GAME OVER'), cx, 385, 96, '#FF4D4D', 'center', 860);

  /* score plate */
  plate(150, 770, 780, 310, '#fff', 14, 12);
  T(t('SCORE'), cx, 830, 44, '#8d89a3', 'center', 500);
  T(String(Math.round(o.score)), cx, 940, 170, INKC, 'center', 700);
  if (o.best) { g.save(); g.translate(880, 790); g.rotate(.2); plate(-120, -34, 240, 68, '#5CFF7A', 6, 6); T(t('NEW BEST!'), 0, 2, 36, INKC, 'center', 210); g.restore(); }
  T(o.name ? o.name.toUpperCase() : t('GUEST'), cx, 1038, 40, o.color || S.col, 'center', 600);

  /* call to action */
  plate(110, 1130, 860, 118, '#5CFF7A', 10, 10); T(t('CAN YOU BEAT ME?'), cx, 1190, 70, INKC, 'center', 800);
  T(location.host.toUpperCase() + '  ►  ' + t('PLAY FREE'), cx, 1296, 40, '#fff', 'center', 900);
  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}

/* native share sheet on phones, clipboard everywhere else. Resolves 'shared' | 'copied' | 'cancelled' | 'failed'. */
async function shareText(text, url, blob) {
  if (navigator.share) {
    try {
      const data = { title: 'Claude Ware', text, url };
      if (blob) { const f = new File([blob], 'claude-ware-score.png', { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [f] })) data.files = [f]; }
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
