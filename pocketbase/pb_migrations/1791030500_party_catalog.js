/// <reference path="../pb_data/types.d.ts" />
// The hidden keys field now also holds the shuffled full-catalog bag.
migrate((app) => {
  const rooms = app.findCollectionByNameOrId("rooms");
  rooms.fields.getByName("keys").maxSize = 8192;
  app.save(rooms);
}, (app) => {
  const rooms = app.findCollectionByNameOrId("rooms");
  // Keep enough space for any active rooms that still contain a full-catalog bag.
  rooms.fields.getByName("keys").maxSize = 8192;
  app.save(rooms);
});
