'use strict';
/* Stages, WarioWare-style: each one has a "host" (a recoloured Claude), a themed pool of
   microgames, a speed curve and a boss at the end. Game ids come from REG (see js/games/). */
const STAGES = [
  { name: 'BUG HUNT', tag: 'Click it. Squash it.', col: '#D97757', bg: ['#B8E05A', '#a8d046'],
    pool: ['swat', 'whack', 'spot', 'count', 'dodge', 'slice'], n: 8, sp0: 1.0, boss: 'bug', bossHp: 10 },
  { name: 'KEYBOARD KINGDOM', tag: 'Fingers on the keys!', col: '#6EA8FE', bg: ['#FF8FD0', '#ff7cc6'],
    pool: ['type', 'copy', 'math', 'race', 'sort', 'maze'], n: 8, sp0: 1.1, boss: 'type', bossWord: 'REFACTOR' },
  { name: 'REFLEX RUSH', tag: 'Faster. Then faster.', col: '#7BD88F', bg: ['#6EC6FF', '#5fb8f5'],
    pool: ['jump', 'stop', 'reflex', 'flap', 'charge', 'dont'], n: 8, sp0: 1.2, boss: 'dodge', bossBalls: 3 },
  { name: 'MOUSE MAYHEM', tag: 'Point, drag, scrub!', col: '#F28CB1', bg: ['#FFE9A8', '#ffe08c'],
    pool: ['steady', 'drag', 'scrub', 'crank', 'wires', 'mash'], n: 8, sp0: 1.3, boss: 'bug', bossHp: 14 },
  { name: 'BRAIN BREAK', tag: 'Think fast!', col: '#B49CFF', bg: ['#A0E7E5', '#8fdbd9'],
    pool: ['flip', 'shell', 'rps', 'balance', 'catch', 'pong'], n: 8, sp0: 1.4, boss: 'type', bossWord: 'DEBUGGING' },
  { name: 'MEGA MIX', tag: 'Everything. At once.', col: '#FFD23F', bg: ['#FF9AA2', '#ff8892'],
    pool: null /* every game */, n: 12, sp0: 1.5, boss: 'dodge', bossBalls: 5 },
  { name: 'WII WAGGLE', tag: 'Smooth moves, Claude!', col: '#4DB8FF', bg: ['#DDF3FF', '#c9ecff'],
    pool: ['wii_save', 'wii_zap', 'wii_draw', 'wii_sneak', 'wii_umbrella', 'wii_pop', 'wii_strike', 'wii_shave', 'wii_fan', 'wii_twirl', 'wii_roll', 'wii_close'], n: 8, sp0: 1.2, boss: 'bug', bossHp: 12 },
  { name: 'CUBE PARTY', tag: 'Mega party game, mega fast!', col: '#9B6BD1', bg: ['#D9C7FF', '#cbb4ff'],
    pool: ['gc_sole', 'gc_rhino', 'gc_alley', 'gc_pinball', 'gc_batter', 'gc_snap', 'gc_trap', 'gc_douse', 'gc_putt', 'gc_park', 'gc_goalie', 'gc_nail'], n: 8, sp0: 1.3, boss: 'dodge', bossBalls: 4 },
  { name: 'TOUCH SCREEN', tag: 'Poke it. Draw it. Cut it.', col: '#FF8FA3', bg: ['#FFD6E0', '#ffc6d4'],
    pool: ['ds_ramp', 'ds_creep', 'ds_fuse', 'ds_loop', 'ds_cage', 'ds_fan', 'ds_pose', 'ds_sink', 'ds_scratch', 'ds_faces', 'ds_tune', 'ds_strip'], n: 8, sp0: 1.3, boss: 'type', bossWord: 'TOUCHED' },
  { name: 'GET TOGETHER', tag: 'Stay still. Pick. Run. Fry.', col: '#FF6B4D', bg: ['#FFE0B8', '#ffd49c'],
    pool: ['sw_freeze', 'sw_pick', 'sw_run', 'sw_wanted', 'sw_fry', 'sw_fill', 'sw_limbo', 'sw_steer', 'sw_sleep', 'sw_stars', 'sw_draw', 'sw_protect'], n: 8, sp0: 1.4, boss: 'bug', bossHp: 16 }
];
