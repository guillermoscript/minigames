/// <reference path="../pb_data/types.d.ts" />
/* Claude Ware server-side rules. Handlers run in isolated scopes, so all logic lives in lib.js and is require()d inside each. */

// scores: re-validate ints/ranges + per-user rate limit
onRecordCreateRequest((e) => { require(`${__hooks}/lib.js`).checkScore(e.record, e.requestInfo().body); e.next(); }, "scores");
onRecordUpdateRequest((e) => { require(`${__hooks}/lib.js`).checkScore(e.record); e.next(); }, "scores");

// scores: keep users.total = sum of the user's scores
onRecordAfterCreateSuccess((e) => { require(`${__hooks}/lib.js`).recomputeTotal(e.record.get("user")); e.next(); }, "scores");
onRecordAfterUpdateSuccess((e) => { require(`${__hooks}/lib.js`).recomputeTotal(e.record.get("user")); e.next(); }, "scores");

// users: accounts are created ONLY via Google OAuth2 (createRule = oauth2 context). Sets the friendly default
// username/colour/unlocked/total and enforces ALLOWED_EMAIL_DOMAINS before PocketBase creates or logs in the user.
onRecordAuthWithOAuth2Request((e) => { require(`${__hooks}/lib.js`).onOAuth2(e); e.next(); }, "users");

// users: validate client-writable fields (progress arrays, colour, username rename + rate limit)
onRecordCreateRequest((e) => { require(`${__hooks}/lib.js`).checkUser(e.record, true); e.next(); }, "users");
onRecordUpdateRequest((e) => { require(`${__hooks}/lib.js`).checkUser(e.record, false); e.next(); }, "users");

// shared challenge links: /c/<score>/<stage>[/<name>] serves a personalised link preview, then redirects into the game
routerAdd("GET", "/c/{score}/{stage}", (e) => require(`${__hooks}/lib.js`).challengePage(e));
routerAdd("GET", "/c/{score}/{stage}/{name}", (e) => require(`${__hooks}/lib.js`).challengePage(e));

// Apply GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to the users collection on every start.
onBootstrap((e) => {
  e.next(); // DB + migrations are ready after this
  try {
    const msg = require(`${__hooks}/lib.js`).syncGoogle();
    console.log("[claudeware] " + msg);
  } catch (err) { console.log("[claudeware] WARNING: could not sync Google OAuth2 settings: " + err); }
});

// PARTY mode (rooms with friends): every action is a POST that runs room logic in a transaction; clients watch the room via realtime.
routerAdd("POST", "/api/party/{action}", (e) => require(`${__hooks}/party_routes.js`).handle(e, e.request.pathValue("action")));
routerAdd("GET", "/r/{code}", (e) => require(`${__hooks}/party_routes.js`).invitePage(e));
cronAdd("party_gc", "*/20 * * * *", () => { try { require(`${__hooks}/party_routes.js`).gc(); } catch (err) { console.log("[party] gc failed: " + err); } });
