/// <reference path="../pb_data/types.d.ts" />
// DUO live relay (/api/party/sig): ~10 requests/s per player is normal, so it gets its own, higher rate-limit rule than the generic /api/ one.
migrate((app) => {
  const s = app.settings();
  s.rateLimits.rules = s.rateLimits.rules.filter((r) => r.label !== "/api/party/sig").concat([{ label: "/api/party/sig", maxRequests: 1500, duration: 60 }]);
  app.save(s);
}, (app) => {
  const s = app.settings();
  s.rateLimits.rules = s.rateLimits.rules.filter((r) => r.label !== "/api/party/sig");
  app.save(s);
});
