#!/usr/bin/env node
/* Renders the PWA / home-screen icons in the DUO look (docs/ART-STYLE.md): a sunny place, hard ink horizon, Claude on a crate.
   node scripts/art/icon.js        -> img/icons/icon-512.png, icon-192.png, icon-180.png
   The subject stays inside the maskable safe zone (a circle of 40% of the width around the centre), the sky/ground bleed to the edges. */
const fs = require('fs'), path = require('path'), os = require('os');
const pwDir = (() => { const base = path.join(os.homedir(), '.npm/_npx'); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'node_modules/playwright'); if (fs.existsSync(p)) return p; } throw new Error('playwright not found under ~/.npm/_npx'); })();
const exe = (() => { const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  for (const v of fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse()) for (const d of fs.readdirSync(path.join(cache, v))) { const p = path.join(cache, v, d, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  throw new Error('chrome-headless-shell not found under ' + cache); })();
const { chromium } = require(pwDir);
const outDir = path.join(__dirname, '../../img/icons');

function paint(S) {                                    // runs in the page; draws at 512 and scales
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.scale(S / 512, S / 512);
  const INK = '#14101c', OR = '#D97757', SH = '#b4553a', LT = '#f3a283';
  g.lineJoin = 'round'; g.lineCap = 'round';
  const rrp = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  const ink = (fill, o) => { g.lineWidth = o * 2; g.strokeStyle = INK; g.stroke(); g.fillStyle = fill; g.fill(); };
  const cel = (x, y, w, h, r, base, shade, sx, sy) => { g.save(); rrp(x, y, w, h, r); g.fillStyle = shade; g.fill(); g.clip();
    rrp(x - sx, y - sy, w, h, r); g.fillStyle = base; g.fill(); g.restore(); };
  const glint = (x, y, rx, ry, rot, a = .5) => { g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fill(); };
  const cloud = (x, y, k) => { const pts = [[0, 0, 26], [28, -12, 32], [62, -2, 26], [88, 8, 18]];
    for (const [ox, oy, r] of pts) { g.beginPath(); g.arc(x + ox * k, y + oy * k, r * k + 3, 0, 7); g.fillStyle = '#3c6fb4'; g.fill(); }
    for (const [ox, oy, r] of pts) { g.beginPath(); g.arc(x + ox * k, y + oy * k, r * k - 1, 0, 7); g.fillStyle = '#e4f5ff'; g.fill(); }
    glint(x + 22 * k, y - 20 * k, 14 * k, 8 * k, -.4, .8); };

  // sky
  let gr = g.createLinearGradient(0, 0, 0, 380); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(.55, '#86d8fb'); gr.addColorStop(1, '#d6f7ff');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  // sun rays + disc (top-right, rays bleed past the edge)
  g.fillStyle = 'rgba(255,240,150,.45)';
  for (let i = 0; i < 12; i++) { const a0 = .2 + i * Math.PI / 6, a1 = a0 + Math.PI / 12; g.beginPath(); g.moveTo(420, 92);
    g.lineTo(420 + Math.cos(a0) * 700, 92 + Math.sin(a0) * 700); g.lineTo(420 + Math.cos(a1) * 700, 92 + Math.sin(a1) * 700); g.fill(); }
  g.beginPath(); g.arc(420, 92, 40, 0, 7); g.fillStyle = INK; g.fill();
  g.beginPath(); g.arc(420, 92, 34, 0, 7); g.fillStyle = '#ffe14d'; g.fill(); glint(410, 82, 14, 8, -.5, .7);
  cloud(40, 110, 1); cloud(330, 190, .7);
  // hills: far (no ink) then near (tint outline)
  g.beginPath(); g.moveTo(-10, 380); g.quadraticCurveTo(110, 270, 250, 340); g.quadraticCurveTo(380, 280, 530, 350); g.lineTo(530, 400); g.lineTo(-10, 400); g.fillStyle = '#a9dfc6'; g.fill();
  g.beginPath(); g.moveTo(-10, 400); g.quadraticCurveTo(70, 330, 190, 380); g.quadraticCurveTo(330, 320, 530, 392); g.lineTo(530, 430); g.lineTo(-10, 430);
  g.lineWidth = 6; g.strokeStyle = '#4f9a6a'; g.stroke(); g.fillStyle = '#87d19b'; g.fill();
  // ground: gradient, light stripes, hard INK horizon
  gr = g.createLinearGradient(0, 400, 0, 512); gr.addColorStop(0, '#8fdc5c'); gr.addColorStop(1, '#5fb944'); g.fillStyle = gr; g.fillRect(0, 400, 512, 112);
  g.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -2; i < 9; i++) { g.beginPath(); g.moveTo(i * 70, 404); g.lineTo(i * 70 + 36, 404); g.lineTo(i * 70 - 24, 512); g.lineTo(i * 70 - 60, 512); g.fill(); }
  g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(-10, 402); g.lineTo(522, 402); g.stroke();
  g.strokeStyle = '#3f8f35'; g.lineWidth = 5; for (const [x, y] of [[70, 470], [430, 462]]) for (const d of [-9, 0, 9]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + d, y - 22); g.stroke(); }
  // shadow + crate
  g.fillStyle = 'rgba(20,16,28,.3)'; g.beginPath(); g.ellipse(256, 436, 128, 18, 0, 0, 7); g.fill();
  rrp(160, 350, 192, 82, 12); ink('#d9944f', 8);
  cel(160, 350, 192, 82, 12, '#d9944f', '#b06d33', 0, 10);
  g.strokeStyle = '#b06d33'; g.lineWidth = 6; for (const x of [210, 256, 302]) { g.beginPath(); g.moveTo(x, 364); g.lineTo(x, 418); g.stroke(); }
  rrp(160, 350, 192, 82, 12); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  g.fillStyle = '#f2b878'; g.beginPath(); g.roundRect(168, 356, 176, 8, 4); g.fill();
  // Claude: legs, arms (waving), body
  const leg = x => { rrp(x, 300, 26, 56, 8); ink(OR, 7); cel(x, 300, 26, 56, 8, OR, SH, 5, 0); };
  [186, 226, 262, 300].forEach(leg);
  rrp(92, 226, 48, 58, 16); ink(OR, 8); cel(92, 226, 48, 58, 16, OR, SH, -6, 0);    // left arm
  rrp(372, 176, 48, 58, 16); ink(OR, 8); cel(372, 176, 48, 58, 16, OR, SH, 6, 0);     // right arm up, waving
  rrp(132, 150, 248, 160, 36); ink(OR, 10);
  cel(132, 150, 248, 160, 36, OR, SH, 0, 16);
  glint(190, 182, 38, 14, -.4, .5);
  rrp(132, 150, 248, 160, 36); g.lineWidth = 10; g.strokeStyle = INK; g.stroke();
  // face: tall inked eyes with a white highlight, blush, open smile
  for (const ex of [212, 300]) { rrp(ex, 192, 38, 58, 17); ink(INK, 3); g.beginPath(); g.arc(ex + 12, 209, 8, 0, 7); g.fillStyle = '#fff'; g.fill(); g.beginPath(); g.arc(ex + 26, 235, 4, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,110,165,.7)'; for (const cx of [188, 324]) { g.beginPath(); g.ellipse(cx, 268, 20, 12, 0, 0, 7); g.fill(); }
  g.beginPath(); g.moveTo(226, 268); g.quadraticCurveTo(256, 304, 286, 268); g.closePath(); g.fillStyle = INK; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.moveTo(240, 284); g.quadraticCurveTo(256, 294, 272, 284); g.quadraticCurveTo(256, 276, 240, 284); g.fillStyle = '#ff6b81'; g.fill();
  // sparkle stars (gold, inked) for the win
  const star = (cx, cy, ro, ri, rot) => { g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / 4; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); ink('#ffe14d', 4); };
  star(112, 160, 24, 8, 0); star(428, 296, 18, 6, .3);
  return c;
}

(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await b.newPage();
  await p.setContent('<body></body>');
  for (const S of [512, 192, 180]) {
    const url = await p.evaluate(`(${paint.toString()})(${S}).toDataURL('image/png')`);
    fs.writeFileSync(path.join(outDir, `icon-${S}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote icon-' + S + '.png');
  }
  await b.close();
})();
