/// <reference path="../pb_data/types.d.ts" />
/* Friends = follows. One row per "from follows to"; two rows pointing at each other = mutual friends.
 * Only the two people involved can see a row; you can only create/delete rows where you are `from`. Max 200 follows (hook in claudeware.pb.js). */
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const friends = new Collection({
    type: "base",
    name: "friends",
    listRule: "from = @request.auth.id || to = @request.auth.id",
    viewRule: "from = @request.auth.id || to = @request.auth.id",
    createRule: '@request.auth.id != "" && @request.body.from = @request.auth.id && @request.body.to != @request.auth.id',
    updateRule: null,
    deleteRule: "from = @request.auth.id",
    fields: [
      { type: "relation", name: "from", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "relation", name: "to", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_friends_pair` ON `friends` (`from`, `to`)",
      "CREATE INDEX `idx_friends_to` ON `friends` (`to`)",
    ],
  });
  app.save(friends);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("friends")); } catch (_) {}
});
