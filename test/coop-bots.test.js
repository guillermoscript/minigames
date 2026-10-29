'use strict';
/* js/coop-bots.js (the CPU partner of the CO-OP TEST mode) must be regenerated whenever a test bot changes: node scripts/build-coop-bots.js */
const { spawnSync } = require('child_process'), path = require('path');
const r = spawnSync('node', [path.join(__dirname, '../scripts/build-coop-bots.js'), '--check'], { encoding: 'utf8' });
process.stdout.write(r.stdout + r.stderr); process.exit(r.status);
