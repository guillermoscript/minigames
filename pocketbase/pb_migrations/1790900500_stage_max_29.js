/// <reference path="../pb_data/types.d.ts" />
// Raise the stage limit so stages beyond the first 10 can store scores/progress. Keep in sync with pb_hooks/lib.js (STAGE_MAX).
const STAGE_MAX = 29;
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.getByName("unlocked").max = STAGE_MAX + 1;
  app.save(users);
  const scores = app.findCollectionByNameOrId("scores");
  scores.fields.getByName("stage").max = STAGE_MAX;
  app.save(scores);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.getByName("unlocked").max = 10;
  app.save(users);
  const scores = app.findCollectionByNameOrId("scores");
  scores.fields.getByName("stage").max = 9;
  app.save(scores);
})
