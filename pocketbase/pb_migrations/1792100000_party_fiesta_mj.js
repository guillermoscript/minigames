/// <reference path="../pb_data/types.d.ts" />
// LA FIESTA M2 (docs/mario-party/M2-SPEC.md DM2-13): the live minigame relay now carries up to ~45 req/s per room, and two rooms can sit behind
// one NAT, so /sig goes from 7200 to 14400 per minute per IP. back / leave / start had no cap before. (ready, juez, mjfin, mjack and time
// already got theirs in 1792000000.)
const RULES = [
  { label: '/api/party/sig', maxRequests: 14400, duration: 60 },
  { label: '/api/party/back', maxRequests: 120, duration: 60 },
  { label: '/api/party/leave', maxRequests: 120, duration: 60 },
  { label: '/api/party/start', maxRequests: 60, duration: 60 },
];
migrate((app) => {
  const s = app.settings(), labels = RULES.map(r => r.label);
  s.rateLimits.rules = s.rateLimits.rules.filter(r => labels.indexOf(r.label) < 0).concat(RULES);
  app.save(s);
}, (app) => {
  const s = app.settings(), labels = RULES.map(r => r.label);
  s.rateLimits.rules = s.rateLimits.rules.filter(r => labels.indexOf(r.label) < 0).concat([{ label: '/api/party/sig', maxRequests: 7200, duration: 60 }]);
  app.save(s);
});
