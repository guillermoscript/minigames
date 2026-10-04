# Self-hosting and backend notes

A WarioWare-style browser microgame collection: 14 stages of rapid-fire minigames, Google sign-in (optional, guests can play), per-stage and total leaderboards.

The frontend is static (`index.html`, `css/`, `js/`). The backend is [PocketBase](https://pocketbase.io) (one Go binary + SQLite), which also serves the game itself, so everything is same-origin (`/api/...`). The old Node/Express server was removed.

```
index.html, css/, js/      the game (served by PocketBase as pb_public)
pocketbase/pb_migrations/  schema, API rules, settings (applied automatically on start)
pocketbase/pb_hooks/       server-side validation, rate limit, users.total, Google sign-up defaults
pocketbase/dev.sh          local dev launcher
Dockerfile                 production image
```

## Languages (i18n)

English is the source language and the English text is the key: `txt('SPLAT!')`, `t('SCORE {n}', { n })`. `txt()`/`floatText()` translate automatically, so game code needs no changes for static strings. Languages: English, Spanish.
- Dictionaries: `js/i18n/<lang>/ui.js` (menus, stages, errors, page meta) and one file per game file; game files register under a scope (`I18N.add('es', {...}, 'ds')`) so the same English word can translate differently per game family.
- Language is picked from `?lang=xx`, then the saved choice, then the browser language; the title-screen button (or `G`) cycles languages.
- **Add a language:** add it to `LANGS` in `js/i18n.js`, copy `js/i18n/es/` to `js/i18n/<code>/`, translate, and add the script tags in `index.html`. Open the game with `?i18n-debug` to log every untranslated string; `node test/i18n.test.js` checks placeholders, per-scope conflicts and coverage of every game's name/command/hint.
- Translations are uppercase to match the canvas style. Avoid plurals; write "SCORE {n}".

## Local dev

1. Download PocketBase (the binary is gitignored) into `pocketbase/`, matching your OS/arch from <https://github.com/pocketbase/pocketbase/releases> (pinned: v0.40.4), e.g. macOS arm64:
   ```sh
   cd pocketbase
   curl -L -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.40.4/pocketbase_0.40.4_darwin_arm64.zip
   unzip pb.zip pocketbase && rm pb.zip
   ```
2. Run:
   ```sh
   pocketbase/dev.sh            # http://127.0.0.1:8090  (admin UI: /_/)
   ```
   Google login needs credentials first, see "Google sign-in" below (`cp .env.example .env`, fill in; `dev.sh` loads `.env`). Without them the game works in guest mode.
   `dev.sh` copies only `index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `img/` and `js/` into `pocketbase/pb_public/` (so `research/`, `pocketbase/` etc. are never served) and starts PocketBase with data in `pocketbase/pb_data/`. Re-run it after editing the game files (`pocketbase/dev.sh sync` just refreshes the copy). Env: `HTTP=127.0.0.1:8091`, `DIR=/some/data/dir`.
3. Create the operator (superuser) account, once, for the admin UI:
   ```sh
   pocketbase/pocketbase superuser upsert you@example.com 'a-long-password' --dir=pocketbase/pb_data
   ```
   Never commit credentials.

## Deploy (Dokploy)

- Create an Application from this repo, build type **Dockerfile** (path `Dockerfile`, context `.`).
- Container port **8090**; attach your domain (Traefik terminates TLS).
- **Persistent volume: mount at `/pb/pb_data`** (Volumes/Mounts tab). Without it, all accounts and scores are lost on every redeploy.
- First run: open a terminal in the container (or Dokploy "Execute command") and run
  `/pb/pocketbase superuser upsert you@example.com 'strong-password'`, then sign in at `https://your-domain/_/`.
  (Alternatively open the one-time installer link PocketBase prints in the logs.)
- **Environment** (Environment tab): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional if you configure Google in the admin UI), optional `ALLOWED_EMAIL_DOMAINS`. Redeploy/restart after changing them.
- Domain: HTTPS on, container port 8090. Google requires the redirect URI `https://DOMAIN/api/oauth2-redirect`.
- Healthcheck: `GET /api/health` (built into the image).
- Behind the proxy, PocketBase reads the client IP from `X-Forwarded-For` (set in the migration under Settings > Application > User IP proxy headers) for rate limiting. If you expose the container directly (no proxy) clear that setting.
- Build args: `PB_VERSION` (default 0.40.4); `TARGETARCH` is automatic.

## Sharing and analytics

- **Link previews**: `index.html` carries Open Graph / Twitter card tags (absolute URLs on `https://claudeware.guille.tech`; change them if the domain moves) and the 1200x630 card `img/og.png`.
- **Challenge links**: after a run, SHARE sends `<site>/?c=<score>&s=<stage>&f=<name>` (native share sheet on phones, clipboard otherwise). Whoever opens it gets "NAME CHALLENGES YOU" on the title screen and is dropped into that stage.
- **OpenPanel** (self-hosted at openpanel.guille.tech): client id and API URL are set in the `<meta name="openpanel-*">` tags in `index.html` (the client id is public). Blank them to disable tracking. Events (all sent via `track()` in `js/analytics.js`): `app_loaded`, `stage_start`, `microgame_end`, `stage_clear`, `game_over`, `stage_quit`, `practice_start`, `share_click`, `share_result`, `challenge_accept`, `challenge_beaten`, `sign_in`, `leaderboard_view`, `profile_view`. Screen views are automatic.

## Google sign-in

Accounts can ONLY be created through Google OAuth2 (`users.createRule = @request.context = "oauth2"`, password auth is disabled). Guests can still play without an account.

### Google Cloud Console
1. <https://console.cloud.google.com/> > create/select a project.
2. APIs & Services > **OAuth consent screen** (Google Auth Platform > Branding): app name, support email, user type External, scopes `email` and `profile` (defaults), then publish the app to Production (in Testing mode only listed test users can sign in).
3. APIs & Services > Credentials > Create credentials > **OAuth client ID** > application type **Web application**.
4. **Authorized JavaScript origins**: `https://DOMAIN` (local dev: `http://127.0.0.1:8090`).
5. **Authorized redirect URIs**: `https://DOMAIN/api/oauth2-redirect` (local dev: `http://127.0.0.1:8090/api/oauth2-redirect`). This is PocketBase's built-in redirect endpoint; no extra page is needed.
6. Copy the Client ID and Client secret.

### Giving PocketBase the credentials (pick one)
- **Admin UI (simplest)**: `/_/` > Collections > `users` > gear icon > Options > OAuth2 > enable, add provider **Google**, paste client id/secret, save.
- **Env vars**: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. On every start the hook applies them to the `users` collection (enables OAuth2 with Google only); changing them + restarting is enough. If they are missing the log shows a warning and nothing is changed (a provider set in the admin UI stays).

| Env var | Required | Meaning |
|---|---|---|
| `GOOGLE_CLIENT_ID` | for env-based setup | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | for env-based setup | Google OAuth client secret (never commit; see `.env.example`) |
| `ALLOWED_EMAIL_DOMAINS` | no | Comma list (`school.edu,example.com`); only those email domains can sign in/up. Empty = anyone |

New Google users get a username from their Google name (sanitised to `[A-Za-z0-9_-]{3,16}`, digits appended on collision, `player####` fallback), a random colour, `unlocked = 1`, `total = 0`. They can rename via `PATCH` on their record (same validation; max 5 renames/day). Email is stored but never public (`emailVisibility = false`).

**Existing password users** are kept (data untouched) but can no longer log in with a password. To keep a legacy account, the person signs in with Google using the same email as the old record (PocketBase links an OAuth2 login to an existing record with the same email; this linking was not tested here); otherwise they start a new account.

Frontend contract (PocketBase JS SDK): `pb.collection('users').authWithOAuth2({ provider: 'google' })` (popup via `/api/oauth2-redirect`), or manually `GET /api/collections/users/auth-methods` > `oauth2.providers[0].authURL` (+ `state`, `codeVerifier`; redirect URI is appended by the SDK) and then `POST /api/collections/users/auth-with-oauth2` with `{provider, code, codeVerifier, redirectURL}`. No CSP / COOP headers are set, so the popup and `window.opener` flow work.

## Collections and rules

| Collection | Type | Fields | list / view | create | update | delete |
|---|---|---|---|---|---|---|
| `users` | auth (Google OAuth2 only; password auth disabled; email never exposed) | `username` (3-16, `[A-Za-z0-9_-]`, unique), `color` (one of 8 palette hexes, default `#D97757`), `unlocked` (int >= 1, default 1), `stars` (json int[] per stage), `best` (json int[] per stage), `total` (int, server-maintained) | public | OAuth2 sign-up only (`@request.context = "oauth2"`) | `id = @request.auth.id && @request.body.total:isset = false` | none |
| `scores` | base | `user` (relation, required, cascade delete), `stage` (int 0..9), `score` (int 0..2000), `stars` (int 0..3); unique index `(user, stage)`; index `(stage, score DESC)` | public | `@request.auth.id != "" && @request.body.user = @request.auth.id` | `user = @request.auth.id && @request.body.score >= score && @request.body.user:isset = false && @request.body.stage:isset = false` (scores only go up) | none |

Hooks (`pocketbase/pb_hooks/`):
- `scores` create/update: re-validates integers and ranges (rejects floats, stage > 9, score > 2000, stars > 3) and limits each user to 40 score writes per minute.
- After a score is created/updated, `users.total` is recomputed as the sum of that user's scores (written server-side, clients can never set `total`).
- `users` OAuth2 auth: Google only, optional email-domain allow-list, default username/colour on sign-up. `users` update: validates `stars` / `best`, username pattern and rename rate limit. On start: applies Google env credentials (see above).
- Pure helpers are unit-tested: `node pocketbase/pb_hooks/lib.test.js`.

Settings (migration): app name "Claude Ware"; built-in rate limits on (auth endpoints 20/min, creates 60/min, all API 600/min, per IP).

DUO mode (live two-player microgames): `POST /api/party/sig` relays small input messages to the partner over PocketBase realtime (topic `rooms/<id>/sig`, nothing is stored) and has its own rate-limit rule of 1500/min per IP (migration `1790900800_party_sig_rate.js`, so players behind one NAT don't hit the generic 600/min). On an already-deployed instance just redeploy: the migration runs on start. The proxy must not buffer SSE (`/api/realtime`).

Handy API calls: `GET /api/collections/users/auth-methods`, `POST /api/collections/users/auth-with-oauth2`, `GET /api/collections/scores/records?filter=stage=3&sort=-score&expand=user`, `GET /api/collections/users/records?sort=-total`.

## Superuser and backups

Create the operator account as described above (`superuser upsert`). 
Backups: everything lives in `pb_data/` (SQLite + uploads). Stop the app (or use the admin UI: Settings > Backups) and copy the directory: `cp -R pb_data pb_data.bak`. Restore by putting it back at `/pb/pb_data`.

## Changing the number of stages

The stage count is 10 (indices 0..9). To change it, update all of:
- `pocketbase/pb_migrations/1760000000_claudeware_schema.js`: `STAGE_MAX` (highest index) for fresh databases;
- on an already-deployed database, edit the `scores.stage` max and the `users.unlocked` max in the admin UI (`/_/` > Collections), because migrations only run once;
- `pocketbase/pb_hooks/lib.js`: `STAGE_MAX` (and `SCORE_MAX` if per-stage max score changes);
- `js/stages.js` in the frontend.

## Multiplayer transport

Rooms establish a WebRTC data mesh for up to four players, independently of microphone permission. When every peer is healthy, controls use unordered latest-state updates and reliable event delivery. If a peer is unavailable, HTTP/SSE relays controls instead. Screens use separate HTTP requests, so a slow screen upload cannot serialize local input behind it. JPEG encoding uses `toBlob` where available, with one encoder at a time and a 150 ms capture interval (300 ms when measured RTT exceeds 250 ms).

Deploy the frontend and hooks together and restart PocketBase. Migration `1791150000_party_transport_rate.js` allows 7200 signal requests/minute per IP for four players sharing a network, plus 1200 WebRTC setup requests/minute. The generic API limit remains unchanged. Ensure the reverse proxy does not buffer `/api/realtime`.

The default ICE configuration remains STUN. If your deployment already issues temporary TURN credentials, assign its `RTCIceServer[]` to `window.CLAUDEWARE_ICE_SERVERS` before connecting to a room; data and voice connections both use this configuration. Include STUN entries too if desired. Do not embed the TURN shared secret or permanent account credentials in static JavaScript. This change does not provision a TURN server or credential issuer; restrictive networks still fall back to HTTP/SSE until those are configured.

Transport regression checks: `node test/party-network.test.js` and `node test/party-capture.test.js`. For a running isolated PocketBase, run `PB=http://127.0.0.1:8099 node test/party.e2e.js` and `PB=http://127.0.0.1:8099 node test/party-spectators.e2e.js`. These exercise the real relay and SSE broker; they do not replace latency measurements between real devices on Wi-Fi/mobile networks.
