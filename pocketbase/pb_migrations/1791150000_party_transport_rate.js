/// <reference path="../pb_data/types.d.ts" />
// Four players sharing an IP can each send 20 input and ~7 screen updates/s.
// Signaling also needs room for a four-player data/audio mesh and trickled ICE.
migrate((app) => {
  const s = app.settings();
  s.rateLimits.rules = s.rateLimits.rules.filter(r => r.label !== '/api/party/sig' && r.label !== '/api/party/vsig').concat([
    { label: '/api/party/sig', maxRequests: 7200, duration: 60 },
    { label: '/api/party/vsig', maxRequests: 1200, duration: 60 },
  ]);
  app.save(s);
}, (app) => {
  const s = app.settings();
  s.rateLimits.rules = s.rateLimits.rules.filter(r => r.label !== '/api/party/sig' && r.label !== '/api/party/vsig').concat([
    { label: '/api/party/sig', maxRequests: 1500, duration: 60 },
  ]);
  app.save(s);
});
