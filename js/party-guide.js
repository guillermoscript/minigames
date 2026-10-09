'use strict';
/* Lobby guides describe the actual room rules. Browsing as a guest never changes the host's selection. */
const PARTY_GUIDE = {
  versus: { color: '#FFE14D', kind: 'COMPETE', format: 'ALL AT ONCE',
    steps: ['Everyone plays the same minigame at the same time.', 'Follow the command. Speed and performance earn points.', 'Play 6 rounds and compare your total scores.'],
    win: 'Finish with the highest score.', lose: 'A failed minigame earns no points.',
    you: 'Use the mouse, keyboard or touch controls shown before each minigame.', friends: 'Your friends play too. Finish early? Win trap minigames to sabotage the ones still playing.',
    tips: ['A good first mode: short matches and simple scoring.', 'Read the command before the timer starts.', 'Finished early? Sabotage hits are short and soft: they never block the controls.'] },
  team: { color: '#7BD88F', kind: 'COOPERATE', format: 'ALL AT ONCE',
    steps: ['Everyone plays the same minigame. Your successes help the team.', 'With 2 players, both must succeed. With 3 or 4, only one can fail.', 'Complete 8 rounds with your 4 shared lives.'],
    win: 'Reach round 8 with lives remaining.', lose: 'Too few successes cost one shared life.',
    you: 'Play your minigame using the controls shown before it starts.', friends: 'Your friends play their games too. Finish early? Win traps to cheer them on with a harmless sparkle.',
    tips: ['There is never sabotage in TEAM: finished players only cheer.', 'The team can afford one failure with 3 or 4 players.', 'All players succeeding gives your team bonus points.'] },
  duo: { color: '#4DB8FF', kind: 'COOPERATE', format: 'A ROLE EACH',
    steps: ['2 to 4 players share one minigame.', 'Watch the role demo: each player has a different job.', 'Work together through 8 rounds. Roles change between games.'],
    win: 'Clear 8 rounds together.', lose: 'A failed round costs one of 4 shared lives.',
    you: 'Follow your role demo. Your controls depend on your assigned job.', friends: 'Your teammates do the other jobs. Every role is needed to solve the game.',
    tips: ['2 players get duo games, 3 or 4 players get squad games.', 'Do your own job instead of copying a teammate.', 'Use voice chat if you want to coordinate.'] },
  survival: { color: '#FFB86B', kind: 'COMPETE', format: 'ALL AT ONCE',
    steps: ['Each player starts with 3 lives.', 'Play the minigames. Every failure removes one of your lives.', 'At zero lives you become a ghost: win trap minigames to charge BOOs and sabotage the players still alive.'],
    win: 'Be the last player with lives remaining.', lose: 'Lose all 3 lives and become a ghost.',
    you: 'Use each minigame’s controls. Focus on succeeding, not just going fast.', friends: 'Everyone plays. Eliminated friends become ghosts: they haunt the players still alive and can watch any of them.',
    tips: ['A more forgiving elimination mode for new groups.', 'Ghost sabotage is short and soft: it never blocks your controls.', 'If the round limit is reached, lives and score decide the ranking.'] },
  knockout: { color: '#F28CB1', kind: 'COMPETE', format: 'ALL AT ONCE',
    steps: ['Each player has just 1 life.', 'Beat each minigame. Your first failure eliminates you.', 'Eliminated players become ghosts: they play traps and haunt the players still in the match.'],
    win: 'Be the last player standing.', lose: 'One mistake puts you out of the match.',
    you: 'Follow the minigame controls carefully. There are no second chances.', friends: 'Everyone plays until eliminated, then haunts the remaining players as a ghost.',
    tips: ['Best after everyone has warmed up in Versus.', 'Survival is a gentler option with 3 lives each.', 'As a ghost, win traps to charge BOOs, then tap BOO! on anyone still playing.'] },
  lantern: { color: '#FFE14D', kind: 'COOPERATE', format: 'SHARED SCREEN',
    steps: ['One player gets a minigame with the screen darkened.', 'The others see the game and move their lights to reveal the action.', 'Take turns playing. Clear 12 rounds with 3 shared lives.'],
    win: 'Clear 12 rounds together.', lose: 'An active player’s failure costs one life.',
    you: 'When playing, use the minigame’s controls inside the lit area.', friends: 'Move the light with mouse, touch or arrow keys. Follow the player’s actions.',
    tips: ['Cooperate: the lights help the active player see.', 'Keep the light on the action, not on the instructions.', 'You all see the same game, and the active player rotates.'] },
  cards: { color: '#B49CFF', kind: 'PARTY TURNS', format: 'SHARED SCREEN',
    steps: ['Take turns choosing a card from either deck.', 'Minigame cards build a pile. A PLAY card makes you complete that pile.', 'Win the whole pile to collect it. Friends can steal while you play.'],
    win: 'Have the most cards when the deck runs out.', lose: 'Fail the pile and your cards go into the pot.',
    you: 'Draw: tap a deck or use left/right arrows. Challenge: play the minigames.', friends: 'Steal from rivals, win traps to charge SABOTAGE and guess the next deck.',
    tips: ['The deck has 24 cards: 16 minigames and 8 PLAY cards.', 'Guess the deck, tap emotes and win traps: each one charges a sabotage.', 'Stealing takes 1.2 seconds. Watch the progress bar.'] },
  balloon: { color: '#F28CB1', kind: 'PARTY TURNS', format: 'SHARED SCREEN',
    steps: ['One player plays a minigame while the others watch.', 'The others pump up the balloon beside the live game.', 'Win to pass the turn. Fail and you must keep playing.'],
    win: 'Make it pop on another player’s turn.', lose: 'The balloon pops during your turn.',
    you: 'When playing, beat the minigame to pass the turn before the balloon pops.', friends: 'Tap the pump or press Space repeatedly. Free a jammed valve with A / D and grab gold bubbles for TURBO.',
    tips: ['A simple party mode: one plays, everyone else pumps.', 'The balloon keeps its air between turns and leaks only a tiny bit when nobody pumps.', 'Air from each pump is balanced for 2, 3 or 4 players.'] }
};
const PARTY_GUIDE_TABS = ['HOW TO PLAY', 'CONTROLS', 'GOOD TO KNOW'];
function partyGuideMode(R) { return !isHost() && party.previewMode || R.mode; }
function partyChooseMode(m) {
  party.guideTab = 0;
  if (isHost()) { if (party.room.mode !== m) partyAct('mode', { mode: m }); }
  else party.previewMode = m;
}
function partyGuideText(key, x, y, width, size = 17, color = '#fff', limit = 2) {
  const words = t(key).split(/\s+/);
  const wrap = fontSize => {
    ctx.font = `900 ${fontSize}px "Arial Black", Impact, sans-serif`;
    const lines = []; let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (line && ctx.measureText(candidate).width > width) { lines.push(line); line = word; }
      else line = candidate;
    }
    if (line) lines.push(line);
    return lines;
  };
  let lines = wrap(size);
  while (lines.length > limit && size > 12) lines = wrap(--size);
  lines.forEach((text, i) => txt(text, x, y + i * 21, size, color, 'left', width));
  return lines.length * 21;
}

function partyModeIcon(m, x, y, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
  circ(0, 0, 22, '#171c34', 0);
  if (m === 'cards') { box(-12, -13, 22, 27, '#fff', 2); box(-6, -9, 22, 27, color, 2); star(5, 3, 7, 3, 5, -.2, INK, 0); }
  else if (m === 'balloon') { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, -4, 11, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 11); ctx.lineTo(3, 19); ctx.stroke(); circ(-3, -9, 3, '#fff', 0); }
  else if (m === 'lantern') { ctx.fillStyle = 'rgba(255,225,77,.3)'; ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(19, -18); ctx.lineTo(19, 18); ctx.fill(); box(-17, -5, 17, 10, color, 1); box(-1, -8, 4, 16, '#fff', 1); }
  else if (m === 'duo' || m === 'team') { caos(-10, 10, 1.2, { col: color }); caos(11, 10, 1.2, { col: '#fff' }); if (m === 'team') star(0, -12, 8, 4, 5, -.2, color, 0); }
  else if (m === 'survival') { for (let i = -1; i <= 1; i++) star(i * 13, i === 0 ? -5 : 6, 8, 4, 5, -.2, color, 0); }
  else if (m === 'knockout') { ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(10, -10); ctx.lineTo(-10, 10); ctx.stroke(); }
  else { star(-8, -4, 11, 5, 5, -.3, color, 0); star(10, 7, 9, 4, 5, .3, '#fff', 0); }
  ctx.restore();
}
function drawPartyGuide(R) {
  const m = partyGuideMode(R), guide = PARTY_GUIDE[m], tab = party.guideTab || 0;
  box3(292, 158, 484, 366, '#252c4b', 4, 5);
  ctx.fillStyle = guide.color; ctx.fillRect(292, 158, 484, 5);
  txt(modeLabel(m), 312, 188, 29, guide.color, 'left', 350);
  partyModeIcon(m, 738, 197, 30, guide.color);
  const badges = ['2-4 PLAYERS', guide.kind, guide.format];
  badges.forEach((label, i) => { const x = 312 + i * 146; box(x, 218, 138, 26, '#171c34', 0); txt(label, x + 69, 231, 12, '#fff', 'center', 132); });
  PARTY_GUIDE_TABS.forEach((label, i) => button(312 + i * 146, 261, 136, 32, label, () => { party.guideTab = i; }, { size: 13, fill: tab === i ? guide.color : '#414c70', col: tab === i ? INK : '#fff' }));
  if (tab === 0 || tab === 2) {
    const lines = tab === 0 ? guide.steps : guide.tips;
    lines.forEach((line, i) => { const y = 322 + i * 45; circ(324, y + 5, 12, tab === 0 ? guide.color : '#B49CFF', 0); txt(tab === 0 ? String(i + 1) : '!', 324, y + 5, 15, INK); partyGuideText(line, 346, y, 406); });
  } else {
    txt('ACTIVE PLAYER', 312, 317, 15, guide.color, 'left');
    partyGuideText(guide.you, 312, 342, 440, 17, '#fff', 2);
    txt('YOUR FRIENDS', 312, 397, 15, guide.color, 'left');
    partyGuideText(guide.friends, 312, 421, 440, 17, '#fff', 2);
  }
  ctx.fillStyle = '#171c34'; ctx.fillRect(304, 459, 460, 53);
  txt('WIN', 312, 473, 13, '#7BD88F', 'left'); partyGuideText(guide.win, 392, 473, 366, 14, '#fff', 1);
  txt('LOSE', 312, 497, 13, '#F28CB1', 'left'); partyGuideText(guide.lose, 392, 497, 366, 14, '#fff', 1);
}
