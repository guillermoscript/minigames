/* Shared constants/helpers for MiniCaos hooks. Keep STAGE_MAX / SCORE_MAX in sync with the migration. */
const STAGE_MAX = 29;         // highest stage index (30 stages of headroom; keep in sync with the migrations)
const SCORE_MAX = 2000;       // per stage
const WRITES_PER_MIN = 40;    // per-user score writes per minute
const COLORS = ["#D97757", "#6EA8FE", "#7BD88F", "#F28CB1", "#B49CFF", "#FFD23F", "#FF6B4D", "#4DD0E1"];
const isInt = (v, lo, hi) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

function checkScore(record, body) {
  if (body) for (const k of ["stage", "score", "stars"]) { // create: all fields must be present (0 is valid)
    if (body[k] === undefined || body[k] === null || body[k] === "") throw new BadRequestError("Missing " + k);
  }
  const stage = record.get("stage"), score = record.get("score"), stars = record.get("stars");
  if (!isInt(stage, 0, STAGE_MAX)) throw new BadRequestError("Invalid stage");
  if (!isInt(score, 0, SCORE_MAX)) throw new BadRequestError("Invalid score");
  if (!isInt(stars, 0, 3)) throw new BadRequestError("Invalid stars");
  const store = $app.store();
  const key = "scorewrites:" + record.get("user");
  const now = Date.now();
  const hits = (store.get(key) || []).filter((t) => now - t < 60000);
  if (hits.length >= WRITES_PER_MIN) throw new TooManyRequestsError("Too many score submissions, slow down");
  hits.push(now);
  store.set(key, hits);
}

function recomputeTotal(userId) {
  const row = new DynamicModel({ total: 0 });
  $app.db().newQuery("SELECT COALESCE(SUM(score), 0) AS total FROM scores WHERE user = {:u}").bind({ u: userId }).one(row);
  const user = $app.findRecordById("users", userId);
  if (user.get("total") !== row.total) {
    user.set("total", row.total);
    $app.saveNoValidate(user); // bypasses collection rules (clients can't write `total`)
  }
}

const USERNAME_RE = /^[A-Za-z0-9_-]{3,16}$/;
const RENAMES_PER_DAY = 5;

/* Friendly default username from a Google display name (pure function, unit-tested in pb_hooks/lib.test.js).
 * exists(candidate) -> bool tells whether a username is taken. rand() -> [0,1) is injectable for tests. */
function makeUsername(name, exists, rand) {
  rand = rand || Math.random;
  let base = String(name || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // strip accents
    .replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 16);
  const digits = (n) => { let s = ""; for (let i = 0; i < n; i++) s += Math.floor(rand() * 10); return s; };
  if (base.length < 3) base = "player" + digits(4);
  if (!exists(base)) return base;
  for (let i = 0; i < 50; i++) {
    const suffix = digits(i < 25 ? 2 : 4);
    const cand = base.slice(0, 16 - suffix.length) + suffix;
    if (!exists(cand)) return cand;
  }
  for (let i = 0; i < 100; i++) { const cand = "player" + digits(6); if (!exists(cand)) return cand; }
  throw new Error("could not generate a username");
}

/* ALLOWED_EMAIL_DOMAINS="a.com, b.org" (empty = unrestricted). */
function checkEmailDomain(email, allowedCsv) {
  const allowed = String(allowedCsv || "").split(",").map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
  if (!allowed.length) return true;
  const at = String(email || "").lastIndexOf("@");
  return at > 0 && allowed.indexOf(String(email).slice(at + 1).toLowerCase()) >= 0;
}

/* Called before PocketBase creates/logs in the user through OAuth2 (the ONLY way accounts get created). */
function onOAuth2(e) {
  const u = e.oAuth2User;
  if (e.providerName !== "google") throw new ForbiddenError("Only Google sign-in is supported");
  if (!checkEmailDomain(u && u.email, $os.getenv("ALLOWED_EMAIL_DOMAINS"))) {
    throw new ForbiddenError("This Google account's email domain is not allowed");
  }
  if (!e.isNewRecord) return;
  const username = makeUsername(u && u.name, (c) => {
    try { $app.findFirstRecordByFilter("users", "username = {:u}", { u: c }); return true; } catch (_) { return false; }
  });
  e.createData = Object.assign({}, e.createData || {}, {
    username: username,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    unlocked: 1,
    total: 0,
  });
}

/* Optional convenience: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env -> users.oauth2 google provider, on every start.
 * If either is missing nothing is changed (a provider configured in the admin UI is left alone); we only warn. */
function syncGoogle() {
  const id = ($os.getenv("GOOGLE_CLIENT_ID") || "").trim();
  const secret = ($os.getenv("GOOGLE_CLIENT_SECRET") || "").trim();
  const users = $app.findCollectionByNameOrId("users");
  if (!id || !secret) {
    const has = users.oauth2.enabled && (users.oauth2.providers || []).some((p) => p.name === "google");
    return has ? "Google OAuth2 enabled (configured in the admin UI)"
      : "WARNING: Google login is DISABLED: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or configure Google in the admin UI). Guest mode still works.";
  }
  const cur = users.oauth2.providers || [];
  const same = users.oauth2.enabled && cur.length === 1 && cur[0].name === "google" && cur[0].clientId === id && cur[0].clientSecret === secret;
  if (!same) {
    users.oauth2.enabled = true;
    users.oauth2.providers = [{ name: "google", clientId: id, clientSecret: secret }];
    $app.save(users);
  }
  return "Google OAuth2 enabled from env";
}

/* Username renames: valid pattern + max RENAMES_PER_DAY per user per 24h (in memory; resets on restart). */
function checkUser(record, isCreate) {
  if (isCreate) {
    record.set("total", 0); // never client-controlled
    if (!record.get("color")) record.set("color", COLORS[0]);
    if (!record.get("unlocked")) record.set("unlocked", 1);
  } else {
    const old = record.original().get("username");
    const now = record.get("username");
    if (old !== now) {
      if (!USERNAME_RE.test(now)) throw new BadRequestError("Invalid username");
      const store = $app.store(), key = "renames:" + record.id, t = Date.now();
      const hits = (store.get(key) || []).filter((x) => t - x < 86400000);
      if (hits.length >= RENAMES_PER_DAY) throw new TooManyRequestsError("You can change your name " + RENAMES_PER_DAY + " times per day");
      hits.push(t);
      store.set(key, hits);
    }
  }
  if (record.get("color") && COLORS.indexOf(record.get("color")) < 0) throw new BadRequestError("Invalid colour");
  for (const [f, hi] of [["stars", 3], ["best", SCORE_MAX]]) {
    const raw = record.getString(f);
    if (!raw || raw === "null") continue;
    let arr = null;
    try { arr = JSON.parse(raw); } catch (_) {}
    if (!Array.isArray(arr) || arr.length > STAGE_MAX + 1) throw new BadRequestError("Invalid " + f);
    for (const v of arr) if (!isInt(v, 0, hi)) throw new BadRequestError("Invalid " + f);
  }
}
const SITE = "https://minicaos.guille.tech";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* Challenge landing page: crawlers read the personalised og: tags, people get redirected into the game (/?c=&s=&f=). */
function challengePage(e) {
  const score = parseInt(e.request.pathValue("score"), 10), stage = parseInt(e.request.pathValue("stage"), 10);
  const name = (e.request.pathValue("name") || "").replace(/[^\w-]/g, "").slice(0, 16);
  if (!isInt(score, 1, SCORE_MAX) || !isInt(stage, 0, STAGE_MAX)) return e.redirect(302, "/");
  const who = name || "A friend";
  const title = who + " scored " + score + " on MiniCaos. Can you beat it?";
  const desc = "Stage " + (stage + 1) + " challenge: 5-second microgames, bosses and global leaderboards. Play free in your browser.";
  const q = "/?c=" + score + "&s=" + stage + (name ? "&f=" + encodeURIComponent(name) : "");
  const url = SITE + e.request.url.path;
  return e.html(200, '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:site_name" content="MiniCaos"><meta property="og:type" content="website"><meta property="og:url" content="' + esc(url) + '">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:image" content="' + SITE + '/img/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + esc(title) + '"><meta name="twitter:description" content="' + esc(desc) + '"><meta name="twitter:image" content="' + SITE + '/img/og.png">' +
    '<meta http-equiv="refresh" content="0;url=' + esc(q) + '"></head><body style="background:#6a3de8;color:#fff;font:700 20px sans-serif;text-align:center;padding-top:20vh"><a style="color:#FFE14D" href="' + esc(q) + '">Opening MiniCaos...</a>' +
    '<script>location.replace(' + JSON.stringify(q) + ')</script></body></html>');
}

module.exports = { challengePage, checkScore, recomputeTotal, checkUser, makeUsername, checkEmailDomain, onOAuth2, syncGoogle };
