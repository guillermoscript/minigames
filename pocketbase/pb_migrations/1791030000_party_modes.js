/// <reference path="../pb_data/types.d.ts" />
// Shared turn state for Lanterns, Cards and Balloon; secret deck/threshold stay in the hidden keys field.
migrate((app) => {
  const rooms = app.findCollectionByNameOrId("rooms");
  rooms.fields.add(new JSONField({ name: "extra", maxSize: 8192 }));
  app.save(rooms);
  const settings = app.settings();
  settings.rateLimits.rules = settings.rateLimits.rules.filter(r => r.label !== "/api/party/pump").concat([{ label: "/api/party/pump", maxRequests: 1500, duration: 60 }]);
  app.save(settings);
}, (app) => {
  const rooms = app.findCollectionByNameOrId("rooms");
  rooms.fields.removeByName("extra");
  app.save(rooms);
  const settings = app.settings();
  settings.rateLimits.rules = settings.rateLimits.rules.filter(r => r.label !== "/api/party/pump");
  app.save(settings);
});
