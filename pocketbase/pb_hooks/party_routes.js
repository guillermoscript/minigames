/* PocketBase glue for PARTY mode: HTTP routes -> pure room logic (party.js) -> `rooms` record, all inside one DB transaction. */
const P = require(`${__hooks}/party.js`);

const NUM = ["round", "total", "seed", "sp", "roundAt", "betweenAt", "lives", "teamScore", "made", "ver"];   // ver: LA FIESTA (migración 1792000000)
const TXT = ["mode", "state", "host", "game"];
const JSN = ["players", "keys", "cur", "last", "extra", "board"];
const MAX_ROOMS = 400;

function load(rec) {
  const o = { code: rec.getString("code") };
  for (const k of NUM) o[k] = rec.getFloat(k);
  for (const k of TXT) o[k] = rec.getString(k);
  for (const k of JSN) { try { o[k] = JSON.parse(rec.getString(k) || "null"); } catch (_) { o[k] = null; } }
  o.players = o.players || []; o.keys = o.keys || {}; o.cur = o.cur || {}; o.extra = o.extra || {};
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
    const fiesta = body.mode === P.FIESTA;   // LA FIESTA: su propio lobby (personajes, cfg) sobre el mismo registro; tab:'margarita' = tablero de Margarita (doc 14)
    const cfg = body.tab ? Object.assign({}, body.cfg && typeof body.cfg === "object" ? body.cfg : {}, { tab: body.tab }) : body.cfg;
    const o = fiesta ? P.fiestaNew(code, now, cfg) : P.newRoom(code, body.mode, now); o.made = now;
    const me = fiesta ? P.fiestaJoin(o, Object.assign(who(auth, body), { ch: body.ch }), now, rand).you : P.addPlayer(o, who(auth, body), rand);
    if (auth && auth.collection().name === "users") o.keys["u:" + me.id] = auth.id;
    const rec = new Record(tx.findCollectionByNameOrId("rooms"));
    rec.set("code", code); store(rec, o); tx.save(rec);
    return { room: view(rec, o), you: me };
  }
  const code = P.cleanCode(body.code);
  const rec = code.length === 4 ? findByCode(tx, code) : null;
  if (!rec) P.fail("Room not found", 404);
  const o = load(rec), before = JSON.stringify(o);
  let extra = {};
  if (P.isFiesta(o)) {
    let r;
    try {
      if (action !== "join" && action !== "tick") P.auth(o, String(body.id || ""), String(body.key || ""));
      r = P.fiesta(o, action, body, now, rand, action === "join" ? Object.assign(who(auth, body), { id: body.id, key: body.key, ch: body.ch, seat: body.seat }) : null, ghostLimiter);
    } catch (err) { if (err instanceof P.PartyError) err.room = view(rec, load(rec)); throw err; }   // 409 {room}: el cliente se resincroniza con el cuerpo (D17)
    if (r.del) { tx.delete(rec); return { ok: true }; }
    const uid = auth && auth.collection().name === "users" ? auth.id : "";
    if (action === "join" && r.you && !r.back && uid) { befriendRoom(tx, o, uid); o.keys["u:" + r.you.id] = uid; }
    delete r.del; delete r.back; delete r.took;
    extra = r;
  } else if (action === "join") {
    if (body.id && body.key && P.active(o).some((p) => p.id === body.id && o.keys[p.id] === body.key)) extra.you = { id: body.id, key: body.key }; // rejoin after reload
    else {
      extra.you = P.addPlayer(o, who(auth, body), rand);
      const uid = auth && auth.collection().name === "users" ? auth.id : "";
      if (uid) { befriendRoom(tx, o, uid); o.keys["u:" + extra.you.id] = uid; }   // never shown to clients (keys are stripped)
    }
  } else if (action === "tick") {
    P.tick(o, now);
  } else {
    P.auth(o, String(body.id || ""), String(body.key || ""));
    if (action === "leave") { if (P.leave(o, body.id, now)) { tx.delete(rec); return { ok: true }; } }
    else if (action === "mode") P.setMode(o, body.id, body.mode);
    else if (action === "again") P.again(o, body.id);
    else if (action === "start") P.start(o, body.id, now, rand);
    else if (action === "draw") P.drawCard(o, body.id, body.round | 0, body.side, now, rand);
    else if (action === "steal") P.stealCard(o, body.id, body.round | 0, String(body.target || ""), now);
    else if (action === "pump") P.pump(o, body.id, body.round | 0, body.count, now);
    else if (action === "report") P.report(o, body.id, body.round | 0, body.r, body.t, body.pts, now);
    else if (action === "advance") P.advance(o, body.round | 0, now, rand);
    else P.fail("Unknown action", 404);
  }
  if (JSON.stringify(o) !== before) { store(rec, o); tx.save(rec); }
  return Object.assign({ room: view(rec, o) }, extra);
}
/* joining a room as a signed-in player makes you mutual friends with every other signed-in player already in it (best effort, capped like the client) */
function befriendRoom(tx, o, uid) {
  try {
    const col = tx.findCollectionByNameOrId("friends");
    const follow = (a, b) => {
      try { tx.findFirstRecordByFilter("friends", "from = {:a} && to = {:b}", { a: a, b: b }); return; } catch (_) {}
      if (tx.countRecords("friends", $dbx.hashExp({ from: a })) >= 200) return;
      const r = new Record(col); r.set("from", a); r.set("to", b); tx.save(r);
    };
    for (const p of P.active(o)) {
      const other = o.keys["u:" + p.id];
      if (other && other !== uid) { follow(uid, other); follow(other, uid); }
    }
  } catch (err) { console.log("[party] befriend: " + err); }
}
/* signed-in players use their profile name + colour; guests send their own (sanitised in party.js) */
function who(auth, body) {
  if (auth && auth.collection().name === "users") return { name: auth.getString("username"), color: auth.getString("color"), uid: auth.id };
  return { name: body.name, color: body.color };
}

/* the soft relay rate limits (sabotage, cheers, emotes) live in the app's in-memory store (shared by every request, nothing written to the room); update() runs under the
   store's lock (store.setFunc), so parallel requests cannot all pass the limit before any of them records itself */
const ghostLimiter = { get: (k) => $app.store().get(k), set: (k, v) => $app.store().set(k, v), update: (k, fn) => $app.store().setFunc(k, fn), remove: (k) => $app.store().remove(k) };
const relayCache = () => P.relayCache(ghostLimiter);   // LA FIESTA: sala delgada del relé, TTL 1 s, invalidada tras cada commit (DM2-12)
/* DUO live relay: auth + validate against the room record, then push straight to the other players' realtime connections
   (topic rooms/<id>/sig). No transaction and no write: this is the hot path (~8 requests/s per player). */
function relay(e, body) {
  try {
    const code = P.cleanCode(body.code);
    if (code.length !== 4) return e.json(404, { error: "Room not found" });
    const slim = relayCache().get(code, () => {
      const rec = findByCode($app, code);
      if (!rec) return null;
      const s = rec.getString("mode") === P.FIESTA ? P.slimRoom(load(rec)) : { classic: true };
      s.rid = rec.id;
      return s;
    }, Date.now());
    if (!slim) return e.json(404, { error: "Room not found" });
    const o = slim.classic ? load(findByCode($app, code)) : slim;
    P.auth(o, String(body.id || ""), String(body.key || ""));
    const voice = body.voice === true;   // voice-chat signaling: its own topic, valid in every room state
    const msg = voice ? P.vsigPayload(o, String(body.id), body.to, String(body.k || ""), body.d) : P.sigPayload(o, String(body.id), body.round | 0, body.m, Date.now(), ghostLimiter, body.sc);
    if (msg === null) return e.json(200, { ok: true, n: 0, dropped: Array.isArray(body.m) ? body.m.length : 1, now: Date.now() });   // todo se descartó (DM2-8)
    const name = "rooms/" + slim.rid + (voice ? "/vsig" : "/sig"), data = JSON.stringify(msg);
    const clients = $app.subscriptionsBroker().clients();
    let n = 0;
    for (const cid in clients) {
      const c = clients[cid];
      if (c.hasSubscription(name)) { c.send(new SubscriptionMessage({ name: name, data: data })); n++; }
    }
    return e.json(200, { ok: true, n: n, now: Date.now() });
  } catch (err) {
    if (err instanceof P.PartyError) return e.json(err.status, { error: err.message, now: Date.now() });
    console.log("[party] sig: " + err);
    return e.json(500, { error: "Server error" });
  }
}

function handle(e, action) {
  const body = e.requestInfo().body || {};
  if (action === "sig" || action === "vsig") return relay(e, action === "vsig" ? Object.assign({}, body, { voice: true }) : body);
  if (action === "time") return e.json(200, { now: Date.now() });   // LA FIESTA: muestra de reloj sin tocar la BD (D15)
  if (action === "tick") { const fast = fastTick(body); if (fast) return e.json(200, fast); }
  let status = 200, out = null;
  $app.runInTransaction((tx) => {
    try { out = exec(tx, action, body, e.auth, Date.now()); }
    catch (err) {
      if (err instanceof P.PartyError) { status = err.status; out = { error: err.message }; if (err.room) out.room = err.room; }   // report instead of throwing so the tx doesn't roll back loudly
      else { status = 500; out = { error: "Server error" }; console.log("[party] " + action + ": " + err); }
    }
  });
  /* DM2-12: la sala delgada del relé se invalida DESPUÉS del commit de toda acción que pueda escribir (el TTL de 1 s es solo red de seguridad) */
  if (["sig", "vsig", "time", "mine"].indexOf(action) < 0) {
    const c = P.cleanCode(body.code || (out && out.room && out.room.code));
    if (c.length === 4) { try { relayCache().invalidate(c); } catch (_) { /* mejor esfuerzo */ } }
  }
  if (out && typeof out === "object") out.now = Date.now();   // D15: la hora del servidor en toda respuesta
  return e.json(status, out);
}
/* LA FIESTA: `tick` es barato cuando no hay nada vencido (now < board.nextAt): se lee sin abrir transacción de escritura */
function fastTick(body) {
  try {
    const code = P.cleanCode(body.code);
    const rec = code.length === 4 ? findByCode($app, code) : null;
    if (!rec || rec.getString("mode") !== P.FIESTA) return null;
    const o = load(rec), now = Date.now();
    return P.fiestaDue(o, now) ? null : { room: view(rec, o), now };
  } catch (_) { return null; }
}

const SITE = "https://minicaos.guille.tech";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* /r/<code>: invite landing page (link-preview tags for chat apps), then into the game with ?r=<code> */
function invitePage(e) {
  const code = P.cleanCode(e.request.pathValue("code"));
  if (code.length !== 4) return e.redirect(302, "/");
  const title = "Join my MiniCaos room: " + code, desc = "Room code " + code + " - play 5-second microgames with friends, live. Tap the link to join!";
  const rec = findByCode($app, code), fiesta = !!rec && rec.getString("mode") === P.FIESTA;   // LA FIESTA vive en el mundo Venezuela
  const tab = fiesta ? boardTab(rec) : "";                                                        // Margarita, en su página (doc 14 §7.1)
  const q = (tab === P.MARGARITA ? "/docs/margarita/?r=" : fiesta ? "/worlds/venezuela/fiesta.html?r=" : "/?r=") + code, url = SITE + "/r/" + code, img = SITE + "/r/" + code + "/og.png";
  return e.html(200, '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:site_name" content="MiniCaos"><meta property="og:type" content="website"><meta property="og:url" content="' + esc(url) + '">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:image" content="' + img + '"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + esc(title) + '"><meta name="twitter:description" content="' + esc(desc) + '"><meta name="twitter:image" content="' + img + '">' +
    '<meta http-equiv="refresh" content="0;url=' + esc(q) + '"></head><body style="background:#6a3de8;color:#fff;font:700 20px sans-serif;text-align:center;padding-top:20vh"><a style="color:#FFE14D" href="' + esc(q) + '">Opening MiniCaos...</a>' +
    '<script>location.replace(' + JSON.stringify(q) + ')</script></body></html>');
}

/* which board a LA FIESTA room plays: 'margarita' or '' (Venezuela) */
function boardTab(rec) {
  try { return P.tabDe({ board: JSON.parse(rec.getString("board") || "null") }); } catch (_) { return ""; }
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
  for (const r of old) {
    if (r.getString("mode") === P.FIESTA) { try { relayCache().purge(load(r)); } catch (_) { /* mejor esfuerzo */ } }   // claves del almacén de la sala (relé, presencia, cubetas)
    $app.delete(r);
  }
  return old.length;
}

module.exports = { handle, relay, invitePage, ogImage, gc, boardTab };
