/// <reference path="../pb_data/types.d.ts" />
/* Claude Ware schema: extends the built-in `users` auth collection, creates `scores`, and sets app settings.
 * To change the number of stages, see STAGE_MAX below (highest stage INDEX, i.e. stage count - 1)
 * and pb_hooks/lib.js (STAGE_MAX too). Existing installs: edit the field limits in the admin UI (/_/).
 */
const STAGE_MAX = 9;      // stages 0..9 => 10 stages
const SCORE_MAX = 2000;   // per stage
const COLORS = ["#D97757", "#6EA8FE", "#7BD88F", "#F28CB1", "#B49CFF", "#FFD23F", "#FF6B4D", "#4DD0E1"];

migrate((app) => {
  /* ---------- users ---------- */
  const users = app.findCollectionByNameOrId("users");

  // login by username, email is optional and never exposed
  for (const n of ["name", "avatar"]) { if (users.fields.getByName(n)) users.fields.removeByName(n); }
  const email = users.fields.getByName("email");
  email.required = false;
  users.fields.add(new TextField({
    name: "username", required: true, min: 3, max: 16, pattern: "^[A-Za-z0-9_-]+$",
  }));
  users.fields.add(new TextField({
    name: "color", required: false, max: 7, pattern: "^#(" + COLORS.map((c) => c.slice(1)).join("|") + ")$",
  }));
  users.fields.add(new NumberField({ name: "unlocked", onlyInt: true, min: 1, max: STAGE_MAX + 1 }));
  users.fields.add(new JSONField({ name: "stars", maxSize: 512 }));
  users.fields.add(new JSONField({ name: "best", maxSize: 512 }));
  users.fields.add(new NumberField({ name: "total", onlyInt: true, min: 0 }));

  users.passwordAuth.enabled = true;
  users.passwordAuth.identityFields = ["username"];
  users.oauth2.enabled = false;
  users.otp.enabled = false;
  users.mfa.enabled = false;
  users.authAlert.enabled = false;

  users.listRule = "";
  users.viewRule = "";
  users.createRule = "";
  users.updateRule = "id = @request.auth.id && @request.body.total:isset = false";
  users.deleteRule = null;

  // password min length 6 (set on the built-in password field)
  const pw = users.fields.getByName("password");
  pw.min = 6;

  users.indexes = (users.indexes || []).concat([
    "CREATE UNIQUE INDEX `idx_users_username_nocase` ON `users` (`username` COLLATE NOCASE)",
    "CREATE INDEX `idx_users_total` ON `users` (`total` DESC)",
  ]);
  app.save(users);

  /* ---------- scores ---------- */
  const scores = new Collection({
    type: "base",
    name: "scores",
    listRule: "",
    viewRule: "",
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: "user = @request.auth.id && @request.body.score >= score && @request.body.user:isset = false && @request.body.stage:isset = false",
    deleteRule: null,
    fields: [
      { type: "relation", name: "user", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      // NOTE: number fields are NOT marked required because PocketBase treats 0 as blank for required numbers;
      // presence on create is enforced by the hook instead.
      { type: "number", name: "stage", required: false, onlyInt: true, min: 0, max: STAGE_MAX },
      { type: "number", name: "score", required: false, onlyInt: true, min: 0, max: SCORE_MAX },
      { type: "number", name: "stars", required: false, onlyInt: true, min: 0, max: 3 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_scores_user_stage` ON `scores` (`user`, `stage`)",
      "CREATE INDEX `idx_scores_stage_score` ON `scores` (`stage`, `score` DESC)",
    ],
  });
  app.save(scores);

  /* ---------- settings ---------- */
  const s = app.settings();
  s.meta.appName = "Claude Ware";
  s.meta.hideControls = false;
  s.rateLimits.enabled = true;
  s.rateLimits.rules = [
    { label: "*:auth", maxRequests: 20, duration: 60 },
    { label: "*:create", maxRequests: 60, duration: 60 },
    { label: "/api/", maxRequests: 600, duration: 60 },
  ];
  // The container sits behind a reverse proxy (Traefik/Dokploy): trust its forwarded IP for rate limiting.
  s.trustedProxy.headers = ["X-Forwarded-For"];
  s.trustedProxy.useLeftmostIP = false;
  app.save(s);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("scores")); } catch (_) {}
  try {
    const users = app.findCollectionByNameOrId("users");
    for (const n of ["username", "color", "unlocked", "stars", "best", "total"]) users.fields.removeByName(n);
    users.indexes = [];
    app.save(users);
  } catch (_) {}
});
