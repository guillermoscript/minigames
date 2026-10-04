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
function partyCardTable(R, interactive) {
  const all = R.players.filter(p => !p.left), w = 720 / all.length;
  all.forEach((p, i) => {
    const x = 40 + i * w, can = interactive && p.id !== party.you.id && p.score > 0 && R.extra.stolen[party.you.id] !== R.round;
    if (can) button(x + 3, 518, w - 6, 68, t('STEAL: {name}', { name: p.name }), () => partyStartSteal(p.id, R.round), { size: 18, fill: p.color });
    else { box(x + 3, 518, w - 6, 68, '#302b50', 3); txt(p.name, x + w / 2, 539, 17, p.color, 'center', w - 12); }
    txt(t('{n} CARDS', { n: p.score }), x + w / 2, 572, 19, can ? INK : '#FFE14D', 'center', w - 12);
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
      bg('#26304b', '#392d59', now);
      txt(partyCardReveal(R), 400, 76, 19, '#F28CB1', 'center', 720);
      txt('CARD TABLE', 400, 122, 42, '#FFE14D');
      txt(t('{n} MICROGAMES IN THE PILE', { n: R.extra.pile.length }), 400, 184, 25, '#fff');
      txt(t('{n} CARDS IN THE POT', { n: R.extra.pot }), 400, 223, 21, '#F28CB1');
      for (const [x, side, label] of [[180, 'left', 'LEFT DECK'], [430, 'right', 'RIGHT DECK']]) {
        for (let i = 2; i >= 0; i--) box(x + i * 5, 268 - i * 5, 190, 150, '#493e7c', 4);
        star(x + 95, 324, 34, 17, 5, -.2, '#FFE14D', 3);
        if (mine) button(x, 369, 190, 54, busy ? 'ONE MOMENT...' : label, () => choose(side), { size: 21, fill: '#B49CFF' });
      }
      txt(mine ? 'MICROGAME CARDS STACK UP · PLAY CARD STARTS THE CHALLENGE' : t('{name} IS DRAWING', { name: actor.name }), 400, 470, 18, '#fff', 'center', 740);
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
    bg('#26304b', '#392d59', now);
    box(6, 115, 594, 448, '#14101c', 5);
    box(12, 120, 584, 440, actor.color, 4);
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
      if (!frame || now - frameTime > 3) txt('CONNECTING TO THE PLAYER...', 400, 300, 28, '#FFE14D', 'center', 740);
      if (R.mode === 'lantern') { ctx.strokeStyle = me().color; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(lx, ly, 125, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
    txt(instruction, 302, 28, 24, '#FFE14D', 'center', 550);
    txt(t('{name} IS PLAYING', { name: actor.name }), 302, 59, 23, actor.color, 'center', 560);
    if (mine) txt(base.hint || '', 302, 89, 17, '#fff', 'center', 552);
    const seconds = mine ? Math.max(0, base.dur / Math.sqrt(sp) - gameTime) : Math.max(0, sharedTime - (now - sharedClockAt));
    const clockDuration = mine ? base.dur / Math.sqrt(sp) : sharedDuration;
    txt(modeLabel(R.mode), 692, 28, 19, '#FFE14D', 'center', 168);
    txt(t('{n} SECONDS', { n: Math.ceil(seconds) }), 692, 66, 19, seconds < 2 ? '#F28CB1' : '#fff', 'center', 168);
    if (R.mode === 'lantern') txt(t('{n} TEAM LIVES', { n: current.lives }), 692, 97, 16, '#7BD88F', 'center', 168);
    box(16, 107, 576, 6, '#14101c', 0);
    box(16, 107, 576 * Math.max(0, Math.min(1, seconds / clockDuration)), 6, seconds < 2 ? '#F28CB1' : '#7BD88F', 0);
    txt(mine ? 'YOU PLAY' : R.mode === 'lantern' ? 'YOU LIGHT' : R.mode === 'balloon' ? 'YOU PUMP' : 'YOU STEAL', 692, 142, 20, '#FFE14D', 'center', 166);
    const teammates = current.players.filter(p => !p.left && p.id !== actor.id);
    txt(mine ? 'YOUR TEAMMATES' : 'HELPER TEAM', 692, 176, 15, '#fff', 'center', 164);
    teammates.forEach((p, i) => txt(p.name, 692, 199 + i * 21, 15, p.color, 'center', 164));
    if (R.mode === 'balloon') {
      partyBalloon(current, false);
      const squash = Math.max(0, 1 - (elapsed - lastTap) / .2);
      box(665, 421, 54, 23, '#B49CFF', 3);
      ctx.save(); ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(692, 422); ctx.lineTo(692, 400 + squash * 16);
      ctx.moveTo(670, 400 + squash * 16); ctx.lineTo(714, 400 + squash * 16); ctx.stroke(); ctx.restore();
      txt('PASS IT BY WINNING!', 692, 548, 15, '#fff', 'center', 168);
      txt('POP = LOSE THE TURN', 692, 567, 14, '#F28CB1', 'center', 168);
      if (!mine) button(608, 452, 176, 76, 'PUMP! SPACE / TAP', tap, { size: 20, fill: '#F28CB1' });
      else txt('OTHERS ARE PUMPING', 692, 487, 16, '#FFE14D', 'center', 168);
    } else if (R.mode === 'cards') {
      txt(t('{n} CARDS AT STAKE', { n: current.extra.pile.length + current.extra.pot }), 692, 305, 19, '#FFE14D', 'center', 168);
      txt(t('{n} MICROGAMES TO GO', { n: current.extra.remaining.length }), 692, 345, 17, '#fff', 'center', 168);
      txt('WIN TO KEEP THE PILE', 692, 396, 15, '#fff', 'center', 168);
      const attempt = current.extra.stealing && current.extra.stealing[party.you.id];
      if (!mine && attempt && attempt.round === round) {
        box(610, 405, 172, 10, '#14101c', 0);
        ctx.fillStyle = '#B49CFF'; ctx.fillRect(610, 405, 172 * Math.max(0, Math.min(1, 1 - (attempt.readyAt - Date.now()) / 1200)), 10);
      }
      txt(!mine && attempt && attempt.round === round ? 'STEALING...' : !mine && current.extra.stolen[party.you.id] === round ? 'CARD STOLEN! WAIT FOR THE NEXT GAME' : 'OTHERS CAN STEAL', 692, 427, 15, '#F28CB1', 'center', 168);
      for (let i = 2; i >= 0; i--) { box(650 + i * 4, 258 - i * 3, 76, 32, '#B49CFF', 2); }
      txt(current.extra.pile.length + current.extra.pot, 688, 275, 21, INK);
      current.players.filter(p => !p.left).forEach((p, i) => {
        const can = !mine && p.id !== party.you.id && p.score > 0 && current.extra.stolen[party.you.id] !== round;
        const label = t('{name}: {n} CARDS', { name: p.name, n: p.score });
        if (can) button(608, 444 + i * 32, 176, 31, label, () => partyStartSteal(p.id, round), { size: 15, fill: p.color });
        else txt(label, 692, 460 + i * 32, 15, p.color, 'center', 168);
      });
    } else {
      txt(mine ? 'YOUR FRIENDS MOVE THE LIGHT' : 'MOVE THE LIGHT', 692, 310, 19, '#FFE14D', 'center', 166);
      txt(mine ? 'PLAY INSIDE THE LIGHT' : 'MOUSE / TOUCH', 692, 344, 16, '#fff', 'center', 166);
      txt(mine ? 'FOLLOW YOUR GAME CONTROLS' : 'OR ARROW KEYS', 692, 371, 16, '#fff', 'center', 166);
      txt('KEEP THE ACTION LIT!', 692, 425, 15, '#FFE14D', 'center', 168);
      txt('WIN TOGETHER', 692, 470, 18, '#7BD88F', 'center', 168);
    }
    if (!mine) txt(g.hint, 400, 580, 17, '#fff', 'center', 770);
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
