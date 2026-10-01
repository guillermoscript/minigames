/// <reference path="../pb_data/types.d.ts" />
/* Additive: switch `users` to Google-OAuth2-only account creation. Existing users/data are untouched
 * (password users simply can no longer log in with a password). Provider credentials are applied from env
 * on every start by pb_hooks (syncGoogle), so oauth2 stays disabled here until GOOGLE_CLIENT_ID/SECRET are set. */
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.passwordAuth.enabled = false;
  users.oauth2.enabled = false;
  users.oauth2.providers = [];
  users.oauth2.mappedFields.username = "";
  users.createRule = '@request.context = "oauth2"';
  const email = users.fields.getByName("email");
  email.required = false;
  email.hidden = false;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.passwordAuth.enabled = true;
  users.createRule = "";
  app.save(users);
});
