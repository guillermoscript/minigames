/* PocketBase glue for PARTY mode: HTTP routes -> pure room logic (party.js) -> `rooms` record, all inside one DB transaction. */
const P = require(`${__hooks}/party.js`);

const NUM = ["round", "total", "seed", "sp", "roundAt", "betweenAt", "lives", "teamScore", "made"];
const TXT = ["mode", "state", "host", "game"];
const JSN = ["players", "keys", "cur", "last"];
const MAX_ROOMS = 400;

function load(rec) {
  const o = { code: rec.getString("code") };
  for (const k of NUM) o[k] = rec.getFloat(k);
  for (const k of TXT) o[k] = rec.getString(k);
  for (const k of JSN) { try { o[k] = JSON.parse(rec.getString(k) || "null"); } catch (_) { o[k] = null; } }
  o.players = o.players || []; o.keys = o.keys || {}; o.cur = o.cur || {};
  return o;
}
function store(rec, o) {
  for (const k of NUM) rec.set(k, o[k] || 0);
  for (const k of TXT) rec.set(k, o[k] || "");
  for (const k of JSN) rec.set(k, o[k] === undefined ? null : o[k]);
}
const view = (rec, o) => { const r = P.publicRoom(o); r.id = rec.id; return r; };
const findByCode = (tx, code) => {
  try { return tx.findFirstRecordByData("rooms", "code", code); } catch (_) { return null; }
};

function exec(tx, action, body, auth, now) {
  const rand = Math.random;
  if (action === "create") {
    const count = tx.countRecords("rooms");
    if (count >= MAX_ROOMS) P.fail("Server is busy, try again soon", 503);
    let code = "";
    for (let i = 0; i < 30 && !code; i++) { const c = P.makeCode(rand); if (!findByCode(tx, c)) code = c; }
    if (!code) P.fail("Server is busy, try again soon", 503);
    const o = P.newRoom(code, body.mode, now); o.made = now;
    const me = P.addPlayer(o, who(auth, body), rand);
    const rec = new Record(tx.findCollectionByNameOrId("rooms"));
    rec.set("code", code); store(rec, o); tx.save(rec);
    return { room: view(rec, o), you: me };
  }
  const code = P.cleanCode(body.code);
  const rec = code.length === 4 ? findByCode(tx, code) : null;
  if (!rec) P.fail("Room not found", 404);
  const o = load(rec), before = JSON.stringify(o);
  let extra = {};
  if (action === "join") {
    if (body.id && body.key && P.active(o).some((p) => p.id === body.id && o.keys[p.id] === body.key)) extra.you = { id: body.id, key: body.key }; // rejoin after reload
    else extra.you = P.addPlayer(o, who(auth, body), rand);
  } else if (action === "tick") {
    P.tick(o, now);
  } else {
    P.auth(o, String(body.id || ""), String(body.key || ""));
    if (action === "leave") { if (P.leave(o, body.id)) { tx.delete(rec); return { ok: true }; } }
    else if (action === "mode") P.setMode(o, body.id, body.mode);
    else if (action === "again") P.again(o, body.id);
    else if (action === "start") P.start(o, body.id, now, rand);
    else if (action === "report") P.report(o, body.id, body.round | 0, body.r, body.t, body.pts, now);
    else if (action === "advance") P.advance(o, body.round | 0, now, rand);
    else P.fail("Unknown action", 404);
  }
  if (JSON.stringify(o) !== before) { store(rec, o); tx.save(rec); }
  return Object.assign({ room: view(rec, o) }, extra);
}
/* signed-in players use their profile name + colour; guests send their own (sanitised in party.js) */
function who(auth, body) {
  if (auth && auth.collection().name === "users") return { name: auth.getString("username"), color: auth.getString("color"), uid: auth.id };
  return { name: body.name, color: body.color };
}

/* DUO live relay: auth + validate against the room record, then push straight to the other players' realtime connections
   (topic rooms/<id>/sig). No transaction and no write: this is the hot path (~8 requests/s per player). */
function relay(e, body) {
  try {
    const code = P.cleanCode(body.code);
    const rec = code.length === 4 ? findByCode($app, code) : null;
    if (!rec) return e.json(404, { error: "Room not found" });
    const o = load(rec);
    P.auth(o, String(body.id || ""), String(body.key || ""));
    const msg = P.sigPayload(o, String(body.id), body.round | 0, body.m);
    const name = "rooms/" + rec.id + "/sig", data = JSON.stringify(msg);
    const clients = $app.subscriptionsBroker().clients();
    let n = 0;
    for (const cid in clients) {
      const c = clients[cid];
      if (c.hasSubscription(name)) { c.send(new SubscriptionMessage({ name: name, data: data })); n++; }
    }
    return e.json(200, { ok: true, n: n });
  } catch (err) {
    if (err instanceof P.PartyError) return e.json(err.status, { error: err.message });
    console.log("[party] sig: " + err);
    return e.json(500, { error: "Server error" });
  }
}

function handle(e, action) {
  const body = e.requestInfo().body || {};
  if (action === "sig") return relay(e, body);
  let status = 200, out = null;
  $app.runInTransaction((tx) => {
    try { out = exec(tx, action, body, e.auth, Date.now()); }
    catch (err) {
      if (err instanceof P.PartyError) { status = err.status; out = { error: err.message }; }   // report instead of throwing so the tx doesn't roll back loudly
      else { status = 500; out = { error: "Server error" }; console.log("[party] " + action + ": " + err); }
    }
  });
  return e.json(status, out);
}

const SITE = "https://claudeware.guille.tech";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* /r/<code>: invite landing page (link-preview tags for chat apps), then into the game with ?r=<code> */
function invitePage(e) {
  const code = P.cleanCode(e.request.pathValue("code"));
  if (code.length !== 4) return e.redirect(302, "/");
  const title = "Join my Claude Ware room: " + code, desc = "Room code " + code + " - play 5-second microgames with friends, live. Tap the link to join!";
  const q = "/?r=" + code, url = SITE + "/r/" + code, img = SITE + "/r/" + code + "/og.png";
  return e.html(200, '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:site_name" content="Claude Ware"><meta property="og:type" content="website"><meta property="og:url" content="' + esc(url) + '">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:image" content="' + img + '"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + esc(title) + '"><meta name="twitter:description" content="' + esc(desc) + '"><meta name="twitter:image" content="' + img + '">' +
    '<meta http-equiv="refresh" content="0;url=' + esc(q) + '"></head><body style="background:#6a3de8;color:#fff;font:700 20px sans-serif;text-align:center;padding-top:20vh"><a style="color:#FFE14D" href="' + esc(q) + '">Opening Claude Ware...</a>' +
    '<script>location.replace(' + JSON.stringify(q) + ')</script></body></html>');
}

/* /r/<code>/og.png: link-preview image with the room code in it (see ogimg.js). Cached by chat apps and the CDN. */
function ogImage(e) {
  const code = P.cleanCode(e.request.pathValue("code"));
  if (code.length !== 4) return e.redirect(302, "/img/og.png");
  e.response.header().set("Cache-Control", "public, max-age=86400");
  return e.blob(200, "image/png", require(`${__hooks}/ogimg.js`).roomImage(code));
}

/* delete rooms nobody touched for 6 hours */
function gc() {
  const cutoff = new Date(Date.now() - 6 * 3600 * 1000).toISOString().replace("T", " ");
  const old = $app.findRecordsByFilter("rooms", "updated < {:t}", "", 200, 0, { t: cutoff });
  for (const r of old) $app.delete(r);
  return old.length;
}

module.exports = { handle, relay, invitePage, ogImage, gc };
