'use strict';
// Async JPEG encoding keeps compression off the game's synchronous draw path.
// One encoder per canvas and a round/seat guard prevent stale work from being queued.
function partyCaptureFrame(canvas, metadata, send) {
  if (canvas.partyEncoding) return;
  const room = party.room, round = room && room.round, seat = party.you && party.you.id;
  if (!room || !party.you) return;
  const deliver = image => {
    if (typeof image === 'string' && image.length < 60000 && party.room && party.room.id === room.id && party.room.round === round && party.room.state === 'round' && party.you && party.you.id === seat) send(Object.assign({ image }, metadata));
  };
  if (typeof canvas.toBlob !== 'function' || typeof FileReader === 'undefined') {
    try { deliver(canvas.toDataURL('image/jpeg', .42)); } catch (_) {}
    return;
  }
  canvas.partyEncoding = true;
  try {
    canvas.toBlob(blob => {
      if (!blob) { canvas.partyEncoding = false; return; }
      const reader = new FileReader();
      reader.onload = () => { canvas.partyEncoding = false; deliver(reader.result); };
      reader.onerror = reader.onabort = () => { canvas.partyEncoding = false; };
      try { reader.readAsDataURL(blob); } catch (_) { canvas.partyEncoding = false; }
    }, 'image/jpeg', .42);
  } catch (_) { canvas.partyEncoding = false; }
}
const partyFrameGap = () => typeof linkMs === 'function' && linkMs() > 250 ? .3 : .15;

/* Turn-based party modes reuse the existing seeded microgames. The server owns turns,
   cards and the balloon; The actor broadcasts the game view; assistants relay light positions or use server actions. */
function partyStartSteal(target, round) {
  if (party.stealBusy) return;
  party.stealBusy = { target, round, at: now, completing: false };
  partyMoveAction('steal', { target }, round).finally(() => {
    if (!party.room || party.room.round !== round || !party.room.extra.stealing || !party.room.extra.stealing[party.you.id]) party.stealBusy = null;
  });
}
const partyTurnMode = R => ['lantern', 'cards', 'balloon'].includes(R.mode);
const partyActor = R => R.players.find(p => p.id === R.extra.actor);
const partyTurnLabel = R => R.mode === 'cards' ? t('{n} CARDS LEFT', { n: R.extra.deck }) : R.mode === 'balloon' ? t('TURN {n}', { n: R.round + 1 }) : t('ROUND {n} / {total}', { n: R.round + 1, total: R.total });
async function partyMoveAction(action, data, expectedRound) {
  const R = party.room; if (!R || R.state !== 'round' || R.round !== expectedRound) return;
  const r = await pcall(action, Object.assign(auth(), { round: expectedRound }, data));
  if (r.ok) applyRoom(r.data.room);
  else if (r.status === 404) roomGone();
  else if (r.status !== 409) say(partyErr(r), '#FF4D4D');
}
// Card mode has its own quieter typography and rounded surfaces.
function partyCardPanel(x, y, w, h, fill, radius = 16, stroke = '') {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.save(); ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
}
function partyCardText(s, x, y, size, fill = '#F3F1E9', align = 'center', maxW = 0, weight = 600) {
  s = t(s); ctx.save();
  ctx.font = `${weight} ${size}px "Helvetica Neue", Arial, sans-serif`;
  if (maxW) { const measured = ctx.measureText(s).width; if (measured > maxW) ctx.font = `${weight} ${size * maxW / measured}px "Helvetica Neue", Arial, sans-serif`; }
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = fill; ctx.fillText(s, x, y); ctx.restore();
}
function partyCardBackdrop() {
  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, 800, 600);
  gradient.addColorStop(0, '#101D2B'); gradient.addColorStop(.6, '#123538'); gradient.addColorStop(1, '#10212E');
  ctx.fillStyle = gradient; ctx.fillRect(-OX, 0, VW, H);
  ctx.strokeStyle = 'rgba(178,211,191,.055)'; ctx.lineWidth = 1;
  for (let y = 0; y < 600; y += 24) { ctx.beginPath(); ctx.moveTo(-OX, y); ctx.lineTo(VW, y); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(400, 322, 365, 192, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
function partyCardButton(x, y, w, h, label, fn, fill = '#E9C989', color = '#182B32', size = 16) {
  // Keep the game's existing pointer dispatcher, then paint the custom surface.
  ctx.save(); ctx.globalAlpha = 0;
  button(x, y, w, h, '', fn, { fill });
  ctx.restore();
  const hover = typeof mouse !== 'undefined' && mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  partyCardPanel(x, y + 3, w, h, '#091A24', 12);
  partyCardPanel(x, y, w, h, fill, 12, hover ? '#FFEDD1' : '');
  if (hover) partyCardPanel(x, y, w, h, 'rgba(255,255,255,.08)', 12);
  partyCardText(label, x + w / 2, y + h / 2, size, color, 'center', w - 20, 700);
}
function partyCardArt(x, y, w, h, face = false) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
  partyCardPanel(x, y, w, h, '#F3EBD8', 13); ctx.restore();
  partyCardPanel(x + 5, y + 5, w - 10, h - 10, face ? '#F3EBD8' : '#203C4B', 9);
  partyCardPanel(x + 12, y + 12, w - 24, h - 24, face ? '#F3EBD8' : '#203C4B', 5, '#B89C68');
  ctx.save(); ctx.strokeStyle = face ? '#D9CCB3' : 'rgba(233,201,137,.15)'; ctx.lineWidth = 1;
  for (let d = 24; d < w - 18; d += 14) { ctx.beginPath(); ctx.moveTo(x + d, y + 18); ctx.lineTo(x + w - 18, y + h - d); ctx.stroke(); }
  ctx.restore();
  const cx = x + w / 2, cy = y + h / 2;
  partyCardPanel(cx - w * .24, cy - w * .30, w * .48, w * .60, face ? '#F3EBD8' : '#203C4B', 8, '#B89C68');
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#E9C989'; ctx.fillRect(-w * .1, -w * .1, w * .2, w * .2); ctx.restore();
  partyCardText('✦', x + 24, y + 27, Math.min(17, w * .23), '#B89C68');
  partyCardText('✦', x + w - 24, y + h - 27, Math.min(17, w * .23), '#B89C68');
}
function partyCardTable(R) {
  const all = R.players.filter(p => !p.left), w = 736 / all.length;
  all.forEach((p, i) => {
    const x = 32 + i * w, active = p.id === R.extra.actor;
    partyCardPanel(x + 4, 521, w - 8, 59, active ? '#28484A' : '#172F39', 13, active ? '#BBA477' : '#304952');
    circ(x + 24, 541, 6, p.color, 0);
    partyCardText(p.id === party.you.id ? t('{name} · YOU', { name: p.name }) : p.name, x + 40, 541, 14, '#E5ECE8', 'left', w - 54);
    partyCardText(t('{n} CARDS', { n: p.score }), x + 23, 562, 15, '#E9C989', 'left', w - 42);
    if (active) partyCardText('●', x + w - 21, 564, 9, '#E9C989');
  });
}
function partyBalloon(R, large) {
  const x = large ? 400 : 682, y = large ? 282 : 314;
  const size = (large ? 66 : 23) + Math.min(1, R.extra.balloon / 180) * (large ? 100 : 37);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(now * 5) * .04);
  ctx.fillStyle = '#F28CB1'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 0, size * .84, size, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  circ(-size * .25, -size * .4, size * .12, 'rgba(255,255,255,.6)', 0);
  ctx.beginPath(); ctx.moveTo(0, size); ctx.lineTo(-9, size + 14); ctx.lineTo(9, size + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, size + 14); ctx.lineTo(6, size + 44); ctx.stroke(); ctx.restore();
}
function partyCardReveal(R) {
  if (!R.extra.card) return '';
  if (R.extra.card !== 'play') return 'MICROGAME CARD ADDED · NEXT PLAYER DRAWS';
  return R.extra.phase === 'challenge' ? 'PLAY CARD · BEAT THE PILE TO KEEP IT' : 'PLAY CARD · EMPTY PILE: NEXT PLAYER';
}
function partyDrawGame(R) {
  const actor = partyActor(R), mine = R.extra.actor === party.you.id, round = R.round;
  let busy = false;
  const choose = side => {
    if (!mine || busy) return; busy = true;
    partyMoveAction('draw', { side }, round).finally(() => { busy = false; });
  };
  return {
    dur: 30, partyDraw: true, cmd: mine ? 'DRAW A CARD!' : 'CARD TABLE',
    hint: mine ? 'CHOOSE A DECK · ARROWS OR TAP' : t('{name} IS DRAWING', { name: actor.name }),
    update() {},
    draw() {
      const current = party.room, pile = current.extra.pile.length, pot = current.extra.pot;
      partyCardBackdrop();
      partyCardText('CARD HEIST', 32, 35, 19, '#E9C989', 'left', 240, 700);
      partyCardPanel(612, 20, 156, 30, '#1F3942', 15);
      partyCardText(partyTurnLabel(current), 690, 35, 13, '#C7D6D3', 'center', 140);
      partyCardText(mine ? 'YOUR TURN · PICK A CARD' : t('{name} IS DRAWING', { name: actor.name }), 400, 88, 31, '#F3F1E9', 'center', 730, 700);
      partyCardText(mine ? 'TAP EITHER DECK · BOTH ARE FACE DOWN' : 'WATCH THE TABLE · YOUR TURN IS COMING', 400, 121, 14, '#94AAA9', 'center', 730, 400);
      for (const [x, side, label, key] of [[78, 'left', 'DRAW LEFT', '← / A'], [560, 'right', 'DRAW RIGHT', '→ / D']]) {
        const lift = mine && !busy ? Math.sin(now * 1.8 + (side === 'left' ? 0 : .8)) * 2 : 0;
        if (mine && !busy) partyCardButton(x, 170, 162, 218, '', () => choose(side), '#203C4B');
        for (let i = 2; i >= 0; i--) {
          ctx.save(); ctx.translate(x + 81, 279); ctx.rotate((side === 'left' ? -1 : 1) * (i * .055 + .025));
          partyCardArt(-81 + i * 3, -109 - i * 4 + lift, 162, 218); ctx.restore();
        }
        if (mine && !busy) partyCardButton(x - 5, 409, 172, 45, label, () => choose(side));
        else { partyCardPanel(x - 5, 409, 172, 45, '#28404A', 12); partyCardText(busy ? 'ONE MOMENT...' : 'WAITING', x + 81, 432, 15, '#94AAA9'); }
        if (mine) partyCardText(key, x + 81, 475, 12, '#94AAA9', 'center', 160, 400);
      }
      partyCardPanel(284, 174, 232, 222, 'rgba(12,27,37,.72)', 24, '#365158');
      partyCardText('THE PRIZE', 400, 200, 12, '#A9BFBB', 'center', 210, 600);
      partyCardText(pile + pot, 400, 258, 64, '#E9C989', 'center', 210, 700);
      partyCardText('CARDS TO WIN', 400, 303, 12, '#A9BFBB', 'center', 210, 400);
      partyCardPanel(304, 326, 192, 1, '#365158', 0);
      partyCardText(t('PILE {n} · POT {pot}', { n: pile, pot }), 400, 349, 15, '#D4DEDA', 'center', 205, 500);
      partyCardText('WIN EVERY MICROGAME', 400, 377, 11, '#99CBB2', 'center', 210);
      partyCardText('FAIL = LOSE YOUR CARDS', 400, 417, 11, '#D3A3A2', 'center', 220, 400);
      partyCardText(partyCardReveal(current) || 'MOST CARDS AT THE END WINS', 400, 494, 12, '#A9BFBB', 'center', 720, 400);
      // Compact rule strip replaces the large tutorial panels.
      partyCardText('1 · DRAW', 315, 454, 11, '#E9C989');
      partyCardText('2 · BUILD', 400, 454, 11, '#94AAA9');
      partyCardText('3 · PLAY', 484, 454, 11, '#94AAA9');
      partyCardTable(party.room, false);
    },
    key(e) { if (e.repeat) return; if (e.code === 'ArrowLeft' || e.code === 'KeyA') choose('left'); if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Space') choose('right'); },
  };
}
// Normalize dimensions and pointer state for games that read global mouse/pressing or spawn in widescreen space.
function partyGameScope(fn, pointer) {
  const old = { VW, OX, mouse, pressing };
  VW = W; OX = 0;
  if (pointer) { mouse = pointer.pos; pressing = pointer.held; }
  try { return fn(); } finally { VW = old.VW; OX = old.OX; mouse = old.mouse; pressing = old.pressing; }
}
function partyWrapGame(base, R, sp) {
  const actor = partyActor(R), mine = actor.id === party.you.id, round = R.round;
  const view = { x: 16, y: 124, w: 576, h: 432, scale: .72 };
  const g = { ...base, partyHelper: !mine, partyScene: true, wide: false, partyDark: R.mode === 'lantern' && mine };
  if (!mine) { g.dur = 3600; delete g.result; }
  let instruction = base.cmd || 'MICROGAME';
  g.cmd = mine ? instruction : R.mode === 'lantern' ? 'LIGHT THE WAY!' : R.mode === 'balloon' ? 'PUMP THE BALLOON!' : 'STEAL CARDS!';
  g.hint = mine ? base.hint : R.mode === 'lantern' ? 'MOVE THE LIGHT · MOUSE / TOUCH / ARROWS' : R.mode === 'balloon' ? 'TAP / SPACE TO INFLATE · MAKE IT POP ON THEIR TURN' : 'TAP A RIVAL TO STEAL ONE CARD PER MICROGAME';
  g.thint = mine ? base.thint : g.hint;
  let lx = 400, ly = 300, held = {}, elapsed = 0, lightAt = -1, taps = 0, lastTap = -1, sentAt = 0, pumping = false, frameAt = -1, frame = null, frameTime = -1, frameSeq = 0, sharedTime = 0, sharedDuration = 1, sharedClockAt = 0;
  const lights = {}, pointer = { pos: { x: 400, y: 300 }, held: false };
  const relay = duoCtx(R);
  const capture = mine ? document.createElement('canvas') : null;
  if (capture) { capture.width = 400; capture.height = 300; }
  const dark = R.mode === 'lantern' && mine ? document.createElement('canvas') : null;
  if (dark) { dark.width = W; dark.height = H; }
  relay.onMsg((type, data, from) => {
    if (type === 'light' && from !== actor.id && data && Number.isFinite(data.x) && Number.isFinite(data.y)) {
      lights[from] = { x: Math.max(0, Math.min(W, data.x)), y: Math.max(0, Math.min(H, data.y)), at: now };
    }
    if (!mine && type === 'frame' && from === actor.id && data && typeof data.image === 'string' && data.image.startsWith('data:image/jpeg;base64,') && data.image.length < 60000) {
      if (typeof data.cmd === 'string' && data.cmd.length < 120) instruction = data.cmd;
      if (Number.isFinite(data.time) && Number.isFinite(data.duration)) { sharedTime = Math.max(0, data.time); sharedDuration = Math.max(1, data.duration); sharedClockAt = now; }
      const seq = ++frameSeq, incoming = new Image();
      incoming.onload = () => { if (seq === frameSeq) { frame = incoming; frameTime = now; } };
      incoming.src = data.image;
    }
  });
  const localPoint = data => ({ x: Math.max(0, Math.min(W, (data.x - view.x) / view.scale)), y: Math.max(0, Math.min(H, (data.y - view.y) / view.scale)) });
  const inside = data => data.x >= view.x && data.x <= view.x + view.w && data.y >= view.y && data.y <= view.y + view.h;
  const invoke = (type, data) => {
    if (type === 'move' || type === 'down' || type === 'up') {
      if (type === 'down' && !inside(data)) return;
      data = localPoint(data); pointer.pos = data;
      if (type === 'down') pointer.held = true;
      if (type === 'up') pointer.held = false;
    }
    return partyGameScope(() => base[type] && base[type](data), pointer);
  };
  const tap = () => {
    if (mine || R.mode !== 'balloon' || elapsed - lastTap < .085) return;
    lastTap = elapsed; taps = Math.min(8, taps + 1); sfx.blip(4);
  };
  g.update = (dt, time) => {
    elapsed += dt;
    const attempt = party.room && party.room.extra.stealing && party.room.extra.stealing[party.you.id];
    if (!mine && R.mode === 'cards' && attempt && attempt.round === round && party.room.state === 'round') {
      const busy = party.stealBusy;
      if (Date.now() >= attempt.readyAt && (!busy || !busy.completing)) {
        party.stealBusy = { target: attempt.target, round, completing: true };
        partyMoveAction('steal', { target: attempt.target }, round).finally(() => { party.stealBusy = null; });
      }
    } else if (party.stealBusy && party.stealBusy.round !== round) party.stealBusy = null;
    if (mine) { partyGameScope(() => base.update(dt, time), pointer); g.result = base.result; g.pts = base.pts; g.timeWin = base.timeWin; }
    if (!mine && R.mode === 'lantern') {
      lx = Math.max(0, Math.min(W, lx + ((held.ArrowRight || held.KeyD ? 1 : 0) - (held.ArrowLeft || held.KeyA ? 1 : 0)) * dt * 440));
      ly = Math.max(0, Math.min(H, ly + ((held.ArrowDown || held.KeyS ? 1 : 0) - (held.ArrowUp || held.KeyW ? 1 : 0)) * dt * 440));
      if (elapsed - lightAt > .08) { lightAt = elapsed; relay.send('light', { x: Math.round(lx), y: Math.round(ly) }, true); }
    }
    if (!mine && R.mode === 'balloon' && taps && !pumping && elapsed - sentAt > .22) {
      const count = taps; taps = 0; pumping = true; sentAt = elapsed;
      partyMoveAction('pump', { count }, round).finally(() => { pumping = false; });
    }
  };
  g.draw = gameTime => {
    const current = party.room;
    const label = R.mode === 'cards' ? partyCardText : txt;
    if (R.mode === 'cards') partyCardBackdrop(); else bg('#26304b', '#392d59', now);
    if (R.mode === 'cards') {
      partyCardPanel(8, 116, 592, 448, '#0B1C29', 16, '#486164');
      partyCardPanel(12, 120, 584, 440, '#1F3942', 12);
    } else { box(6, 115, 594, 448, '#14101c', 5); box(12, 120, 584, 440, actor.color, 4); }
    // Chunky television bezel keeps the microgame and the surrounding party props in one stage.
    circ(590, 110, 5, '#7BD88F', 0);
    ctx.save(); ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
    ctx.translate(view.x, view.y); ctx.scale(view.scale, view.scale);
    if (mine) {
      partyGameScope(() => { base.draw(gameTime); if (typeof drawParts === 'function') drawParts(); }, pointer);
      // Capture the actor's rendered game before darkness and controls. Helpers never simulate RNG or outcomes.
      if (elapsed - frameAt >= partyFrameGap() && !capture.partyEncoding && capture.getContext && capture.toDataURL) {
        frameAt = elapsed;
        try {
          capture.getContext('2d').drawImage(cv, view.x + OX, view.y, view.w, view.h, 0, 0, 400, 300);
          partyCaptureFrame(capture, { cmd: instruction, hint: base.hint || '', time: Math.max(0, base.dur / Math.sqrt(sp) - gameTime), duration: base.dur / Math.sqrt(sp) }, data => relay.send('frame', data, true));
        } catch (_) { /* Tainted third-party canvases cannot be broadcast. */ }
      }
      if (dark) {
        const mask = dark.getContext('2d'); mask.globalCompositeOperation = 'source-over'; mask.clearRect(0, 0, W, H);
        mask.fillStyle = '#090911'; mask.fillRect(0, 0, W, H); mask.globalCompositeOperation = 'destination-out';
        for (const p of current.players.filter(p => !p.left && p.id !== actor.id)) {
          const light = lights[p.id]; if (!light || now - light.at > 2) continue;
          mask.beginPath(); mask.arc(light.x, light.y, 125, 0, Math.PI * 2); mask.fill();
        }
        mask.globalCompositeOperation = 'source-over'; ctx.drawImage(dark, 0, 0);
      }
    } else {
      ctx.fillStyle = '#19172d'; ctx.fillRect(0, 0, W, H);
      if (frame) ctx.drawImage(frame, 0, 0, W, H);
      if (!frame || now - frameTime > 3) label('CONNECTING TO THE PLAYER...', 400, 300, 28, R.mode === 'cards' ? '#E9C989' : '#FFE14D', 'center', 740);
      if (R.mode === 'lantern') { ctx.strokeStyle = me().color; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(lx, ly, 125, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
    label(instruction, 302, 28, 24, R.mode === 'cards' ? '#E9C989' : '#FFE14D', 'center', 550);
    label(t('{name} IS PLAYING', { name: actor.name }), 302, 59, 23, actor.color, 'center', 560);
    if (mine) label(base.hint || '', 302, 89, 17, '#fff', 'center', 552);
    const seconds = mine ? Math.max(0, base.dur / Math.sqrt(sp) - gameTime) : Math.max(0, sharedTime - (now - sharedClockAt));
    const clockDuration = mine ? base.dur / Math.sqrt(sp) : sharedDuration;
    label(modeLabel(R.mode), 692, 28, 19, R.mode === 'cards' ? '#E9C989' : '#FFE14D', 'center', 168);
    label(t('{n} SECONDS', { n: Math.ceil(seconds) }), 692, 66, 19, seconds < 2 ? '#F28CB1' : '#fff', 'center', 168);
    if (R.mode === 'lantern') label(t('{n} TEAM LIVES', { n: current.lives }), 692, 97, 16, '#7BD88F', 'center', 168);
    box(16, 107, 576, 6, '#14101c', 0);
    box(16, 107, 576 * Math.max(0, Math.min(1, seconds / clockDuration)), 6, seconds < 2 ? '#F28CB1' : '#7BD88F', 0);
    label(mine ? 'YOU PLAY' : R.mode === 'lantern' ? 'YOU LIGHT' : R.mode === 'balloon' ? 'YOU PUMP' : 'YOU STEAL', 692, 142, 20, R.mode === 'cards' ? '#E9C989' : '#FFE14D', 'center', 166);
    const teammates = current.players.filter(p => !p.left && p.id !== actor.id);
    if (R.mode !== 'cards') { label(mine ? 'YOUR TEAMMATES' : 'HELPER TEAM', 692, 176, 15, '#fff', 'center', 164);
    teammates.forEach((p, i) => label(p.name, 692, 199 + i * 21, 15, p.color, 'center', 164)); }
    if (R.mode === 'balloon') {
      partyBalloon(current, false);
      const squash = Math.max(0, 1 - (elapsed - lastTap) / .2);
      box(665, 421, 54, 23, '#B49CFF', 3);
      ctx.save(); ctx.strokeStyle = R.mode === 'cards' ? '#E9C989' : '#FFE14D'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(692, 422); ctx.lineTo(692, 400 + squash * 16);
      ctx.moveTo(670, 400 + squash * 16); ctx.lineTo(714, 400 + squash * 16); ctx.stroke(); ctx.restore();
      label('PASS IT BY WINNING!', 692, 548, 15, '#fff', 'center', 168);
      label('POP = LOSE THE TURN', 692, 567, 14, '#F28CB1', 'center', 168);
      if (!mine) button(608, 452, 176, 76, 'PUMP! SPACE / TAP', tap, { size: 20, fill: '#F28CB1' });
      else label('OTHERS ARE PUMPING', 692, 487, 16, R.mode === 'cards' ? '#E9C989' : '#FFE14D', 'center', 168);
    } else if (R.mode === 'cards') {
      const attempt = current.extra.stealing && current.extra.stealing[party.you.id];
      const stealing = !mine && attempt && attempt.round === round;
      const stolen = !mine && current.extra.stolen[party.you.id] === round;
      const pending = !mine && party.stealBusy && party.stealBusy.round === round;
      const targets = current.players.filter(p => !p.left && p.id !== party.you.id && p.score > 0);
      partyCardPanel(608, 169, 176, 124, '#142C36', 18, '#365158');
      label('THE PRIZE', 696, 188, 15, '#B9DCD0');
      label(current.extra.pile.length + current.extra.pot, 696, 223, 40, R.mode === 'cards' ? '#E9C989' : '#FFE14D');
      label(t('{n} MICROGAMES TO GO', { n: current.extra.remaining.length }), 696, 258, 14, '#fff', 'center', 164);
      const total = current.extra.pile.length, done = total - current.extra.remaining.length;
      box(618, 278, 156, 5, '#304950', 0);
      box(618, 278, 156 * (total ? done / total : 0), 5, '#7BD88F', 0);
      label(mine ? 'WIN EVERY GAME' : stolen ? 'CARD STOLEN!' : stealing ? 'STEALING...' : pending ? 'ONE MOMENT...' : 'PICK A RIVAL', 696, 315, 19, stolen ? '#7BD88F' : R.mode === 'cards' ? '#E9C989' : '#FFE14D', 'center', 172);
      label(mine ? 'FAIL = LOSE YOUR CARDS' : stolen ? 'WAIT FOR THE NEXT GAME' : '1 CARD PER MICROGAME', 696, 343, 13, mine ? '#F28CB1' : '#fff', 'center', 170);
      if (stealing) {
        const victim = current.players.find(p => p.id === attempt.target);
        label(victim ? victim.name : '', 696, 368, 16, '#F28CB1', 'center', 164);
        box(618, 388, 156, 12, '#10232D', 0);
        box(618, 388, 156 * Math.max(0, Math.min(1, 1 - (attempt.readyAt - Date.now()) / 1200)), 12, '#F28CB1', 0);
      } else label(mine ? 'RIVALS CAN STEAL FROM YOU' : stolen ? '+1 TO YOUR COLLECTION' : targets.length ? 'TAP TO STEAL · 1.2s' : 'NO RIVAL HAS CARDS YET', 696, 381, 13, '#B9DCD0', 'center', 170);
      current.players.filter(p => !p.left).forEach((p, i) => {
        const y = 411 + i * 41;
        const can = !mine && !stealing && !stolen && !pending && p.id !== party.you.id && p.score > 0;
        const targetLabel = can ? t('STEAL · {name} · {n}', { name: p.name, n: p.score }) : t('{name}: {n} CARDS', { name: p.name, n: p.score });
        if (can) partyCardButton(608, y, 176, 36, targetLabel, () => partyStartSteal(p.id, round), '#C8DCD2', '#183B3C', 14);
        else { partyCardPanel(608, y, 176, 36, '#1E3540', 10); label(targetLabel, 696, y + 18, 14, p.color, 'center', 164); }
      });
    } else {
      label(mine ? 'YOUR FRIENDS MOVE THE LIGHT' : 'MOVE THE LIGHT', 692, 310, 19, R.mode === 'cards' ? '#E9C989' : '#FFE14D', 'center', 166);
      label(mine ? 'PLAY INSIDE THE LIGHT' : 'MOUSE / TOUCH', 692, 344, 16, '#fff', 'center', 166);
      label(mine ? 'FOLLOW YOUR GAME CONTROLS' : 'OR ARROW KEYS', 692, 371, 16, '#fff', 'center', 166);
      label('KEEP THE ACTION LIT!', 692, 425, 15, R.mode === 'cards' ? '#E9C989' : '#FFE14D', 'center', 168);
      label('WIN TOGETHER', 692, 470, 18, '#7BD88F', 'center', 168);
    }
    if (!mine) label(g.hint, 400, 580, 17, '#fff', 'center', 770);
  };
  for (const type of ['move', 'down', 'up', 'key', 'keyup']) g[type] = data => {
    if (mine) invoke(type, data);
    else if (R.mode === 'lantern') {
      if ((type === 'move' || type === 'down') && inside(data)) { const p = localPoint(data); lx = p.x; ly = p.y; }
      if (type === 'key' || type === 'keyup') held[data.code] = type === 'key';
    } else if (R.mode === 'balloon' && type === 'key' && !data.repeat && (data.code === 'Space' || data.code === 'Enter')) tap();
  };
  return g;
}
// Passive spectators watch rendered pixels; the game keeps its original input, state and DUO channel.
function partySpectatorGame(base, R, sp) {
  if (base.partyScene || base.partyDraw || typeof base.draw !== 'function') return base;
  const draw = base.draw;
  let capture = null, frameAt = -Infinity;
  base.draw = function (...args) {
    const value = draw.apply(this, args);
    if (typeof partySendFrame !== 'function' || now - frameAt < partyFrameGap() || capture && capture.partyEncoding) return value;
    frameAt = now;
    try {
      if (!capture) { capture = document.createElement('canvas'); capture.width = 400; capture.height = 300; }
      if (!capture.getContext || !capture.toDataURL) return value;
      capture.getContext('2d').drawImage(cv, OX, 0, W, H, 0, 0, 400, 300);
      partyCaptureFrame(capture, {
        cmd: base.cmd || '', hint: base.hint || '',
        time: Math.max(0, base.dur / Math.sqrt(sp) - (Number(args[0]) || 0)),
      }, partySendFrame);
    } catch (_) { /* A game canvas unavailable for capture must still keep playing. */ }
    return value;
  };
  return base;
}
function partyBuildGame(R, sp, dc) {
  if (R.game === 'pc_draw') return partyDrawGame(R);
  if (partyTurnMode(R) && R.extra.actor !== party.you.id) return partyWrapGame({}, R, sp);
  const base = partyTurnMode(R) ? partyGameScope(() => REGMAP[R.game].fn(sp, dc), { pos: { x: 400, y: 300 }, held: false }) : REGMAP[R.game].fn(sp, dc);
  if (R.game === 'pt_mash' || R.game === 'pt_grab') {
    const update = base.update;
    base.update = (dt, t) => { update(dt, t); base.timeWin = base.pts >= base.need; };
  }
  return partyTurnMode(R) ? partyWrapGame(base, R, sp) : partySpectatorGame(base, R, sp);
}
