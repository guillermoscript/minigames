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

/* shareable 1080x1080 score card (for the phone share sheet / saving to post on stories) */
function scoreCard(score, stageName, stars, name) {
  const c = document.createElement('canvas'); c.width = c.height = 1080; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 1080, 1080); gr.addColorStop(0, '#8f66ff'); gr.addColorStop(1, '#4d2bb8'); g.fillStyle = gr; g.fillRect(0, 0, 1080, 1080);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const T = (s, y, size, fill) => { g.font = `900 ${size}px "Arial Black", Impact, sans-serif`; g.lineWidth = size / 5; g.strokeStyle = '#14101c'; g.strokeText(s, 540, y); g.fillStyle = fill; g.fillText(s, 540, y); };
  T('CLAUDE WARE!', 140, 120, '#FFE14D');
  g.fillStyle = '#D97757'; g.strokeStyle = '#14101c'; g.lineWidth = 14;     // pixel mascot
  g.fillRect(400, 250, 280, 170); g.strokeRect(400, 250, 280, 170);
  for (let i = 0; i < 4; i++) { g.fillRect(420 + i * 62, 420, 40, 80); g.strokeRect(420 + i * 62, 420, 40, 80); }
  g.fillStyle = '#14101c'; g.fillRect(450, 290, 36, 70); g.fillRect(594, 290, 36, 70);
  T(String(Math.round(score)), 640, 230, '#fff');
  T(stageName, 780, 62, '#FFE14D');
  T('★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars)), 870, 80, '#FFE14D');
  T((name ? name.toUpperCase() + ' · ' : '') + t('CAN YOU BEAT IT?'), 970, 50, '#5CFF7A');
  T(location.host.toUpperCase(), 1035, 34, '#fff');
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
