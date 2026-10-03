'use strict';
/* Turn-based party modes reuse the existing seeded microgames. The server owns turns,
   cards and the balloon; Lanterns relays only inputs and light positions. */
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
    if (can) button(x + 3, 518, w - 6, 68, t('STEAL: {name}', { name: p.name }), () => partyMoveAction('steal', { target: p.id }, R.round), { size: 18, fill: p.color });
    else { box(x + 3, 518, w - 6, 68, '#302b50', 3); txt(p.name, x + w / 2, 539, 17, p.color, 'center', w - 12); }
    txt(t('{n} CARDS', { n: p.score }), x + w / 2, 572, 19, can ? INK : '#FFE14D', 'center', w - 12);
  });
}
function partyBalloon(R, large) {
  const x = large ? 400 : 682, y = large ? 282 : 176;
  const size = (large ? 66 : 23) + Math.min(1, R.extra.balloon / 180) * (large ? 100 : 37);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(now * 5) * .04);
  ctx.fillStyle = '#F28CB1'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 0, size * .84, size, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  circ(-size * .25, -size * .4, size * .12, 'rgba(255,255,255,.6)', 0);
  ctx.beginPath(); ctx.moveTo(0, size); ctx.lineTo(-9, size + 14); ctx.lineTo(9, size + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, size + 14); ctx.lineTo(6, size + 44); ctx.stroke(); ctx.restore();
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
function partyWrapGame(base, R, sp) {
  const actor = partyActor(R), mine = actor.id === party.you.id, round = R.round;
  const g = { ...base, partyHelper: !mine, partyDark: R.mode === 'lantern' && mine };
  if (!mine) { g.dur = 3600; delete g.result; g.cmd = R.mode === 'lantern' ? 'LIGHT THE WAY!' : R.mode === 'balloon' ? 'PUMP THE BALLOON!' : 'STEAL CARDS!'; }
  let lx = 400, ly = 300, held = {}, elapsed = 0, lightAt = -1, taps = 0, lastTap = -1, sentAt = 0, pumping = false;
  const lights = {};
  const dark = R.mode === 'lantern' && mine ? document.createElement('canvas') : null;
  if (dark) { dark.width = W; dark.height = H; }
  const relay = R.mode === 'lantern' ? duoCtx(R) : null;
  if (relay) relay.onMsg((type, data, from) => {
    if (type === 'light' && from !== actor.id) { lights[from] = { x: Math.max(0, Math.min(W, data.x)), y: Math.max(0, Math.min(H, data.y)), at: now }; return; }
    if (!mine && from === actor.id && base[type]) base[type](data);
  });
  const tap = () => { if (mine || R.mode !== 'balloon' || elapsed - lastTap < .085) return; lastTap = elapsed; taps = Math.min(8, taps + 1); sfx.blip(4); };
  const input = (type, data) => {
    if (mine) {
      if (base[type]) base[type](data);
      if (relay) {
        const d = type === 'key' || type === 'keyup' ? { code: data.code, key: data.key || '', repeat: !!data.repeat } : { x: data.x, y: data.y };
        relay.send(type, d, type === 'move');
      }
    } else if (R.mode === 'lantern') {
      if (type === 'move' || type === 'down') { lx = Math.max(0, Math.min(W, data.x)); ly = Math.max(0, Math.min(H, data.y)); }
      if (type === 'key' || type === 'keyup') held[data.code] = type === 'key';
    } else if (R.mode === 'balloon' && (type === 'down' || (type === 'key' && !data.repeat && (data.code === 'Space' || data.code === 'Enter')))) tap();
  };
  g.hint = mine ? base.hint : R.mode === 'lantern' ? 'MOVE THE LIGHT · MOUSE / TOUCH / ARROWS' : R.mode === 'balloon' ? 'TAP / SPACE TO INFLATE · MAKE IT POP ON THEIR TURN' : 'TAP A RIVAL TO STEAL ONE CARD PER MICROGAME';
  g.thint = mine ? base.thint : g.hint;
  g.update = (dt, t) => {
    elapsed += dt;
    if (mine || R.mode === 'lantern') base.update(dt, t);
    if (mine) { g.result = base.result; g.pts = base.pts; g.timeWin = base.timeWin; }
    if (!mine && relay) {
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
    if (mine || R.mode === 'lantern') base.draw(gameTime);
    else {
      bg('#26304b', '#392d59', now);
      txt(tName(actor), 400, 132, 32, actor.color, 'center', 740);
      txt('YOUR FRIEND IS PLAYING', 400, 174, 22, '#fff');
      if (R.mode === 'balloon') {
        partyBalloon(current, true);
        box(210, 458, 380, 70, '#F28CB1', 4); txt('PUMP! TAP / SPACE', 400, 495, 30, INK, 'center', 350);
      } else {
        txt(t('{n} MICROGAMES TO GO', { n: current.extra.remaining.length }), 400, 290, 38, '#FFE14D');
        txt(t('{n} CARDS AT STAKE', { n: current.extra.pile.length + current.extra.pot }), 400, 360, 30, '#fff');
        partyCardTable(current, true);
      }
    }
    if (R.mode === 'lantern') {
      if (mine) {
        const mask = dark.getContext('2d');
        mask.globalCompositeOperation = 'source-over'; mask.clearRect(0, 0, W, H);
        mask.fillStyle = '#090911'; mask.fillRect(0, 0, W, H);
        mask.globalCompositeOperation = 'destination-out';
        for (const p of current.players.filter(p => !p.left && p.id !== actor.id)) {
          const l = lights[p.id]; if (!l || now - l.at > 2) continue;
          mask.beginPath(); mask.arc(l.x, l.y, 125, 0, Math.PI * 2); mask.fill();
        }
        mask.globalCompositeOperation = 'source-over'; ctx.drawImage(dark, 0, 0);
      } else {
        ctx.save(); ctx.strokeStyle = me().color; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(lx, ly, 125, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        txt('KEEP THE IMPORTANT PARTS LIT!', 400, 580, 22, '#FFE14D');
      }
    }
    if (R.mode === 'balloon' && mine) partyBalloon(current, false);
    if (R.mode === 'cards' && mine) { box(190, 554, 420, 36, '#302b50', 3); txt(t('{n} CARDS AT STAKE', { n: current.extra.pile.length + current.extra.pot }), 400, 574, 20, '#FFE14D'); }
  };
  for (const type of ['move', 'down', 'up', 'key', 'keyup']) g[type] = data => input(type, data);
  // Cosmetic names remain ordinary text and pass through the shared translation renderer.
  function tName(p) { return p.name.toUpperCase(); }
  return g;
}
function partyBuildGame(R, sp, dc) {
  if (R.game === 'pc_draw') return partyDrawGame(R);
  const base = REGMAP[R.game].fn(sp, dc);
  if (R.game === 'pt_mash' || R.game === 'pt_grab') {
    const update = base.update;
    base.update = (dt, t) => { update(dt, t); base.timeWin = base.pts >= base.need; };
  }
  return partyTurnMode(R) ? partyWrapGame(base, R, sp) : base;
}
