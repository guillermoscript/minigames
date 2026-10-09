# Postiz on Dokploy: publishing runbook

**Status:** research done 2026-10-09, nothing deployed by this runbook yet. Every Dokploy step needs Guille's ok first.
**Target:** `https://postiz.guille.tech`, self-hosted Postiz (gitroomhq/postiz-app, latest release v2.25.0 on 2026-10-02).

## Verdict

**Feasible, with one important change to the plan for YouTube.**

| Channel | Through Postiz before any review/audit? | How we publish in weeks 1–4 |
|---|---|---|
| Facebook Page | **Yes.** Meta Standard Access covers accounts that have a role on the app. No App Review. | Postiz API, scheduled, public |
| Instagram (professional, via Facebook login) | **Yes.** Same Meta app and same rule | Postiz API, scheduled, public Reels |
| TikTok | **Partly.** Unaudited Direct Post forces `SELF_ONLY` and requires the account to be private when posting. That doesn't work for a brand account. | Postiz `UPLOAD` mode puts the video in the TikTok **inbox as a draft**. Guille opens the app, picks "Everyone" and posts. Limit: 5 pending drafts per 24 h. |
| YouTube Shorts | **No, not usefully.** Uploads from an unaudited API project are **locked as private, and Studio cannot make them public**; they have to be re-uploaded. "Upload private, tap publish" does not work on YouTube. | **Guille uploads Shorts by hand** (YouTube app, about 1 min each) until the API audit passes. Postiz holds the caption/title as a reminder. |

**Server:** fits easily. 8 vCPU, 16 GB RAM (~6–7 GB free right now), 500 GB disk (~30 GB used). The Postiz stack needs roughly 2–3 GB (Postiz says 2 GB minimum, 4 GB+ comfortable). The Elasticsearch heap is capped at 256 MB in the compose.

**Already on the server:** at 17:02 UTC today someone created a compose called **`postiz`** in project **Infraestructura** (status `idle`, never deployed). It has an auto-generated plain-HTTP `*.sslip.io` domain on service `postiz`, port 5000. **Reuse or replace it. Don't create a second one.** The sslip/HTTP domain has to go: TikTok refuses `http://` redirects, and Postiz cookies need HTTPS.

## Architecture (what gets deployed)

Dokploy ships a **Postiz template** (`compose-templates` id `postiz`, from `Dokploy/templates/blueprints/postiz`). It contains 6 services and 6 named volumes:

| Service | Image | Role |
|---|---|---|
| `postiz-app` | `ghcr.io/gitroomhq/postiz-app:latest` | Frontend + backend + Temporal worker. Internal nginx on **:5000** routes `/api/*` → backend, `/uploads/*` → files, `/` → Next.js |
| `postiz-postgres` | `postgres:17-alpine` | App DB |
| `postiz-redis` | `redis:7.2` | Cache/queues |
| `temporal` | `temporalio/auto-setup:1.28.1` | Scheduler (required since Postiz v2.12) |
| `temporal-postgresql` | `postgres:16` | Temporal DB |
| `temporal-elasticsearch` | `elasticsearch:7.17.27` | Temporal visibility (256 MB heap) |

Volumes: `postgres-volume`, `postiz-redis-data`, `postiz-config`, **`postiz-uploads`** (media, local storage), `temporal-es-data`, `temporal-pg-data`.

Uploads use `STORAGE_PROVIDER=local` and are served publicly at `https://postiz.guille.tech/uploads/...`. That's enough because Meta pulls Reels from a public HTTPS URL, and TikTok videos go up as `FILE_UPLOAD` (Postiz no longer uses `PULL_FROM_URL` for videos). We don't need R2.

---

## Part A: What the lead agent does in Dokploy (after Guille's ok)

### A1. DNS (Cloudflare), done by Guille or by the agent with approval
- Record: `A  postiz  →  <same IP as the other *.guille.tech records>` (the Dokploy server IP from `settings.getIp`).
- **Proxy status: DNS only (grey cloud).** Reasons: Dokploy issues Let's Encrypt certs like every other `*.guille.tech` host. Cloudflare's free proxy caps request bodies at 100 MB (video uploads). The MCP endpoint streams.

### A2. Compose
1. Reuse the existing `postiz` compose in **Infraestructura** (`composeId evr_dPbfI7Ym3GVfVvghQ`) if it was made from the template. Otherwise delete it (with Guille's ok) and deploy the template `postiz` into **Infraestructura / production**.
2. Remove the sslip.io domain. Add the domain: host `postiz.guille.tech`, path `/`, **service `postiz-app`** (or whatever the app service is called in the existing compose), **port 5000**, HTTPS on, certificate `letsencrypt`.
3. Environment tab. The template generates the DB/Temporal passwords and `JWT_SECRET`. Set or confirm these (**never paste secret values in chat or commit them**):

```env
POSTIZ_HOST=postiz.guille.tech
# JWT_SECRET, DB_*, TEMPORAL_* : keep the generated values, never rotate JWT_SECRET (logs everyone out)
DISABLE_REGISTRATION=false        # flip to true after Guille creates his account (A5)

FACEBOOK_APP_ID=                  # from Guille (B1); covers Facebook Page AND Instagram-via-Facebook
FACEBOOK_APP_SECRET=
YOUTUBE_CLIENT_ID=                # from Guille (B3)
YOUTUBE_CLIENT_SECRET=
TIKTOK_CLIENT_ID=                 # from Guille (B2), 16 chars
TIKTOK_CLIENT_SECRET=             # 32 chars
# INSTAGRAM_APP_ID/SECRET only for "Instagram Standalone"; we don't use it
```

   The template already derives `MAIN_URL`, `FRONTEND_URL` = `https://postiz.guille.tech`, `NEXT_PUBLIC_BACKEND_URL` = `https://postiz.guille.tech/api`, `BACKEND_INTERNAL_URL=http://127.0.0.1:3000`, `TEMPORAL_ADDRESS=temporal:7233`, `STORAGE_PROVIDER=local`, `UPLOAD_DIRECTORY=/uploads`.
   Optional additions to the compose `environment:` block: `API_LIMIT: 90` (create-post calls per hour, the default is fine). **Do not set `NOT_SECURED`** (any value turns off secure cookies).
4. Deploy. The first boot takes 2–3 min because Temporal's healthcheck has a 120 s start period. Check that `https://postiz.guille.tech` loads and `https://postiz.guille.tech/api/` answers.
5. Backups: add a Dokploy volume backup for `postgres-volume` and `postiz-uploads` (optional, nice to have).

### A3. Credentials can arrive later
Deploying with empty provider keys is fine. When Guille hands over keys (via `.env` / Dokploy UI, never chat), set them in the Environment tab and **redeploy**. Keys only reach the container if they're listed in the compose; the template lists FB, IG, LinkedIn, X, YouTube and TikTok.

### A4. Hook up Claude Code (after A5 gives an API key)
- **Public API base:** `https://postiz.guille.tech/api/public/v1`. Header `Authorization: <API_KEY>` (raw key, no `Bearer`).
- **MCP (streamable HTTP):** `https://postiz.guille.tech/api/mcp` with header `Authorization: Bearer <API_KEY>`. The alternative `…/api/mcp/<API_KEY>` puts the key in the URL; avoid it.
  ```bash
  # key lives in .env as POSTIZ_API_KEY, never in chat
  claude mcp add --transport http postiz https://postiz.guille.tech/api/mcp \
    --header "Authorization: Bearer $POSTIZ_API_KEY"
  ```
  MCP tools: `integrationList`, `integrationSchema`, `schedulePostTool` (schedule / draft / now), `postsListTool`, `postSettingsTool`, `triggerTool`, `groupList`, plus AI image/video/clipping tools we won't use.
- **CLI (optional):** `export POSTIZ_API_URL=https://postiz.guille.tech`.

### A5. Post creation recipe (API)
1. `GET /integrations`: get the ids of the 4 channels.
2. `POST /upload` (multipart `file=@clip.mp4`) → `{id, path}`. Or `POST /upload-from-url`.
3. `POST /posts`: **one request, several channels**, one `posts[]` entry per channel. `type`: `"draft"` (for Guille's approval), `"schedule"` or `"now"`. `date` in ISO UTC.

```json
{
  "type": "schedule",
  "date": "2026-10-16T23:00:00.000Z",
  "shortLink": false,
  "tags": [],
  "posts": [
    { "integration": { "id": "<instagram-id>" },
      "value": [{ "content": "¿Puedes con estos 5 en 25 segundos? 💣 minicaos.guille.tech", "image": [{ "id": "<id>", "path": "<path>" }] }],
      "settings": { "__type": "instagram", "post_type": "post" } },
    { "integration": { "id": "<facebook-id>" },
      "value": [{ "content": "…", "image": [{ "id": "<id>", "path": "<path>" }] }],
      "settings": { "__type": "facebook" } },
    { "integration": { "id": "<tiktok-id>" },
      "value": [{ "content": "… #minicaos", "image": [{ "id": "<id>", "path": "<path>" }] }],
      "settings": { "__type": "tiktok", "title": "¿Puedes con estos 5?", "content_posting_method": "UPLOAD",
                    "privacy_level": "SELF_ONLY", "duet": false, "stitch": false, "comment": true,
                    "autoAddMusic": "no", "brand_content_toggle": false, "brand_organic_toggle": false,
                    "video_made_with_ai": false } }
  ]
}
```
- Instagram: a single video with `post_type: "post"` is published as a **Reel**.
- TikTok `UPLOAD`: Postiz reports the post as "published", but it only reached the TikTok inbox. Guille must finish it **within 24 h**. Max 5 pending inbox drafts per 24 h.
- YouTube (after the audit only): `{"__type":"youtube","title":"…","type":"public","selfDeclaredMadeForKids":"no","tags":[]}`.
- Workflow rule from PLAN.md: create as `"draft"`, show Guille, and switch to `schedule` only after his explicit ok (`Change Post Status` endpoint or MCP).
- Limits: 50 MB JSON body on `/posts` (always upload media first). `API_LIMIT` create-post calls per hour.

---

## Part B: What Guille must do by hand

Prerequisites: the brand accounts from PLAN.md exist (FB Page, IG **professional** account **linked to that Page**, TikTok, YouTube channel), and Postiz is up at `https://postiz.guille.tech` (Part A).

**Legal pages needed by Meta (Live mode) and TikTok (app review):** a Privacy Policy URL and a Terms URL on HTTPS. The repo has none today. Proposal: the agent adds `https://minicaos.guille.tech/privacy` and `/terms` (a small static page, a separate task).

### B1. Meta app (Facebook Page + Instagram), about 20 min
1. https://developers.facebook.com/apps/creation/ → pick the business portfolio that owns the MiniCaos Page.
2. Use case: filter **All** → "Looking for something else?" → **Other** → app type **Business** → name `MiniCaos Publisher` → Create.
3. Add product **Facebook Login for Business** → Settings → **Valid OAuth Redirect URIs** (paste both):
   ```
   https://postiz.guille.tech/integrations/social/facebook
   https://postiz.guille.tech/integrations/social/instagram
   ```
4. App settings → Basic: Privacy Policy URL, Terms URL, app icon, category, and User data deletion (an instructions URL is fine). Save.
5. Permissions the app will request (Postiz asks for them at connect time; check they show **Standard Access**, which is enough for app admins):
   - Facebook: `pages_show_list, business_management, pages_manage_posts, pages_manage_engagement, pages_read_engagement, read_insights`
   - Instagram: `instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_insights, pages_show_list, pages_read_engagement, business_management`
6. Switch **App Mode → Live**. In Development mode, Page posts with media are only visible to app roles. Standard Access + Live works for Guille's own Page/IG **with no App Review and no Business Verification** (those are needed only for Advanced Access, meaning other people's accounts).
7. Copy **App ID + App Secret** into the `.env` handoff (`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`).
8. After the deploy, in Postiz: **Add Channel → Facebook Page** (pick the MiniCaos Page), then **Add Channel → Instagram (Facebook Business)** and grant every Page/IG asset.

### B2. TikTok developer app, about 30 min + review wait
1. https://developers.tiktok.com/apps → Create app `MiniCaos Publisher` (as an individual or as an organization).
2. Basic info: icon, category, description, **Terms URL, Privacy URL**, platform **Web**, website URL `https://minicaos.guille.tech` (verify it when asked: URL prefix file or DNS TXT in Cloudflare).
3. Products: **Login Kit**, **Content Posting API** (turn on **Direct Post** too, for later), **Display API** (Postiz requests `video.list`).
4. Login Kit redirect URI: `https://postiz.guille.tech/integrations/social/tiktok`
5. Scopes, **all of them**, or Postiz rejects the connection: `user.info.basic, user.info.profile, user.info.stats, video.list, video.upload, video.publish`
6. Content Posting API → verify domain/URL prefix `https://postiz.guille.tech/` (needed only for photo posts; cheap to do now).
7. **Now (no review):** Sandbox → add the MiniCaos TikTok account as a **target user** (max 10). Copy the **sandbox** Client key/secret into `.env` → connect in Postiz → test one `UPLOAD` draft. Sandbox excludes Content Posting "for public videos". The inbox draft that Guille posts from the app is expected to work, **but confirm it with this test on day 1**.
8. **Week 1:** submit the production app for **review** (demo video of the Postiz connect → upload → inbox flow). After approval, swap to the production keys. Then file the **Content Posting API audit** to unlock public Direct Post. Third-party reports put it at 2–6 weeks with frequent rejections, so **don't count on it during this 30-day window**.
9. Until then: open the TikTok inbox notification → set **Everyone** → post. Within 24 h, at most 5 pending.

### B3. Google Cloud / YouTube, about 20 min + audit wait
1. https://console.cloud.google.com/projectcreate → new project `minicaos-publisher` (keep it separate from the Google sign-in project of the game; the audit is per project).
2. Enable: **YouTube Data API v3**, **YouTube Analytics API**, **YouTube Reporting API** (https://console.cloud.google.com/apis/library).
3. OAuth consent screen (Google Auth Platform): user type **External**, app name `MiniCaos Publisher`, support email, privacy/terms URLs, add Guille's Google account as a **test user**.
4. Credentials → Create OAuth client ID → **Web application** → Authorized redirect URI:
   ```
   https://postiz.guille.tech/integrations/social/youtube
   ```
   Copy the client ID/secret into `.env` (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`).
5. Postiz requests these scopes: `userinfo.profile, userinfo.email, youtube, youtube.force-ssl, youtube.readonly, youtube.upload, youtubepartner, yt-analytics.readonly`.
6. **Refresh tokens in "Testing" status expire every 7 days.** Either re-connect weekly, or click **Publish app → In production** without verification (Google shows an "unverified app" warning that Guille clicks through; cap of 100 users). Recommended: publish to production.
7. **File the YouTube API Services audit in week 1:** https://support.google.com/youtube/contact/yt_api_form. Until it passes, **every API upload is locked private and cannot be made public**. So, for now: **upload Shorts manually** in the YouTube app/Studio. The agent prepares the file + title + description in `docs/marketing/` (renders stay out of git).
8. In Postiz: Add Channel → YouTube → pick the MiniCaos channel (brand account) on Google's account chooser.

### B4. In Postiz itself, 5 min
1. Open `https://postiz.guille.tech` → **Sign up** (first user = owner). No email provider is set, so the account auto-activates.
2. Tell the agent → it sets `DISABLE_REGISTRATION=true` and redeploys.
3. Settings → **Developers → Public API** → copy the API key into the local `.env` as `POSTIZ_API_KEY` (never in chat). The agent then adds the MCP server (A4).
4. Connect channels (B1.8, B2.7, B3.8).

## Checklist: exact list for Guille
1. Approve the deploy plan (Part A). Create the Cloudflare DNS record `postiz` (grey cloud), or allow the agent to do it.
2. Approve the agent adding `/privacy` and `/terms` pages to minicaos.guille.tech.
3. Meta: create the app, add redirect URIs, set it Live, put the ID/secret in `.env` (B1).
4. TikTok: create the app with 3 products and 6 scopes, add a sandbox target user, put the keys in `.env`; submit app review, then the audit (B2).
5. Google: create the project, enable 3 APIs, set up the consent screen, publish to production, create the OAuth client, put the keys in `.env`; file the YouTube API audit (B3).
6. Sign up in Postiz, put the API key in `.env`, connect the 4 channels (B4).
7. Ongoing: post TikTok inbox drafts within 24 h; upload YouTube Shorts by hand until the audit passes.

## Sources
- Postiz docs index: https://docs.postiz.com/llms.txt (system requirements, uploads, providers facebook/instagram/tiktok/youtube, public API, MCP)
- Official compose: https://github.com/gitroomhq/postiz-docker-compose · Dokploy template: https://github.com/Dokploy/templates/tree/main/blueprints/postiz
- Postiz provider source (scopes, TikTok FILE_UPLOAD/inbox, 5-pending limit): `libraries/nestjs-libraries/src/integrations/social/*.provider.ts`
- TikTok: https://developers.tiktok.com/doc/content-sharing-guidelines · https://developers.tiktok.com/doc/content-posting-api-get-started-upload-content · https://developers.tiktok.com/doc/add-a-sandbox
- YouTube private lock: https://support.google.com/youtube/answer/7300965
