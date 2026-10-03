/// <reference path="../pb_data/types.d.ts" />
/* PARTY mode: one record per room. Clients can only VIEW a room by its record id (so they can subscribe to it with realtime);
 * the room can't be listed (codes stay unguessable) and nothing is client-writable: every change goes through the
 * /api/party/* routes in pb_hooks/party_routes.js. `keys` (per-player secrets) is a hidden field, never sent to clients. */
migrate((app) => {
  const rooms = new Collection({
    type: "base",
    name: "rooms",
    listRule: null,
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "code", required: true, min: 4, max: 4, pattern: "^[A-Z0-9]{4}$" },
      { type: "text", name: "mode", max: 8 },
      { type: "text", name: "state", max: 8 },
      { type: "number", name: "round", onlyInt: true, min: 0 },
      { type: "number", name: "total", onlyInt: true, min: 0 },
      { type: "text", name: "host", max: 1 },
      { type: "text", name: "game", max: 24 },
      { type: "number", name: "seed", onlyInt: true, min: 0 },
      { type: "number", name: "sp", min: 0 },
      { type: "number", name: "roundAt", min: 0 },
      { type: "number", name: "betweenAt", min: 0 },
      { type: "number", name: "lives", onlyInt: true, min: 0 },
      { type: "number", name: "teamScore", onlyInt: true, min: 0 },
      { type: "number", name: "made", min: 0 },
      { type: "json", name: "players", maxSize: 4096 },
      { type: "json", name: "keys", maxSize: 1024, hidden: true },
      { type: "json", name: "cur", maxSize: 2048 },
      { type: "json", name: "last", maxSize: 4096 },
      { type: "autodate", name: "created", onCreate: true },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_rooms_code` ON `rooms` (`code`)", "CREATE INDEX `idx_rooms_updated` ON `rooms` (`updated`)"],
  });
  app.save(rooms);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("rooms")); } catch (_) {}
});
