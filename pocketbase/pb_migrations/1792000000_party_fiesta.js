/// <reference path="../pb_data/types.d.ts" />
// LA FIESTA (docs/mario-party/07-multijugador-online.md §3.1, §9.3): the public board S (rooms.board, pushed by realtime), its version
// (rooms.ver, +1 on every fiesta write; clients order by it, not by `updated`) and a bigger hidden `keys` for the reducer's private part
// (keys._f: RNG state, deck, hidden commits, action ids). `mode` is plain text (max 8), so 'fiesta' needs no schema change.
// Per-IP limits for the new routes, sized for 4 phones on one Wi-Fi.
const FIESTA_RULES = [
  { label: '/api/party/act', maxRequests: 600, duration: 60 },
  { label: '/api/party/tick', maxRequests: 600, duration: 60 },
  { label: '/api/party/commit', maxRequests: 300, duration: 60 },
  { label: '/api/party/mine', maxRequests: 300, duration: 60 },
  { label: '/api/party/mjfin', maxRequests: 300, duration: 60 },
  { label: '/api/party/mjack', maxRequests: 300, duration: 60 },
  { label: '/api/party/pick', maxRequests: 240, duration: 60 },
  { label: '/api/party/ready', maxRequests: 240, duration: 60 },
  { label: '/api/party/cfg', maxRequests: 240, duration: 60 },
  { label: '/api/party/juez', maxRequests: 120, duration: 60 },
  { label: '/api/party/time', maxRequests: 300, duration: 60 },
  { label: '/api/party/join', maxRequests: 60, duration: 60 },
];
migrate((app) => {
  const rooms = app.findCollectionByNameOrId('rooms');
  rooms.fields.add(new JSONField({ name: 'board', maxSize: 32768 }));
  rooms.fields.add(new NumberField({ name: 'ver', onlyInt: true, min: 0 }));
  rooms.fields.getByName('keys').maxSize = 16384;
  app.save(rooms);
  const s = app.settings(), labels = FIESTA_RULES.map(r => r.label);
  s.rateLimits.rules = s.rateLimits.rules.filter(r => labels.indexOf(r.label) < 0).concat(FIESTA_RULES);
  app.save(s);
}, (app) => {
  const rooms = app.findCollectionByNameOrId('rooms');
  rooms.fields.removeByName('board');
  rooms.fields.removeByName('ver');
  rooms.fields.getByName('keys').maxSize = 8192;
  app.save(rooms);
  const s = app.settings(), labels = FIESTA_RULES.map(r => r.label);
  s.rateLimits.rules = s.rateLimits.rules.filter(r => labels.indexOf(r.label) < 0);
  app.save(s);
});
