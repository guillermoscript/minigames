# MiniCaos: Meta Ads plan (FB + IG)

**Window:** 2026-10-16 → 2026-11-09 · **Budget:** $150–300 USD total · **Markets:** Venezuela (main) + Colombia (test)
**Conversion:** Pixel custom event `MicrogamePlayed` (first microgame finished, fired once per page load; see `js/analytics.js`).
Companion to `PLAN.md`. Researched 2026-10-09. Sources are numbered and listed at the bottom; anything marked **[unverified]** must be checked in the UI or with a `validate_only` API call before you rely on it.

---

## 1. Feasibility in Venezuela

### Verdict
**Targeting Venezuela: yes. Paying from Venezuela: possible but the riskiest part of the plan.** Have a backup card ready before launch day.

| Question | Answer | Confidence |
|---|---|---|
| Can Meta ads *target* VE audiences? | Yes. VE is a normal selectable location in Ads Manager, and no Meta policy or OFAC rule bans delivering ads to people in VE. The US Venezuela sanctions program (31 CFR 591) is list-based: it blocks the Government of Venezuela, PDVSA and designated people. It is not a country-wide embargo like Cuba, Iran, North Korea, Syria or Crimea, the places where Google and X refuse advertisers [3][4][5]. The 2026 general licenses (GL 52, 53, 58, 60) eased things further and say nothing about advertising [3]. | High |
| Is the audience reachable? | Mostly. Conatel still blocks about 150–200 domains (mainly news sites), and X was blocked for long stretches. Instagram and TikTok have had **overnight blocks of 6–8 h** in the past [6][7][8]. Facebook and Instagram are not on the standing block list as far as I found, but expect delivery to dip during outages, and many users browse through VPNs, which blurs geo-targeting a little. | Medium |
| Can an advertiser **based in VE** open an ad account? | Probably yes for a private individual or company that isn't on the SDN list. Meta publishes no VE ban. However: (a) in 2019 Venezuelan ad accounts were mass-suspended for a "commercial restriction" that was never officially explained [9]; (b) one 2026 agency page says accounts of VE residents "may be blocked due to sanctions" and pushes using a relative's account abroad [10]. **Don't do that**: running ads on someone else's identity breaks Meta's terms and is the fastest way to a permanent ban. | Low–medium |
| Which cards work? | Meta takes Visa, Mastercard, Amex, Discover and JCB, plus PayPal in some countries [11]. Bolivar-only domestic cards generally fail on foreign USD charges. Options people report: a **USD Visa/Mastercard in your own name** from a foreign bank, or a VE bank's international USD debit card. Fintech prepaid cards such as Zinli (Visa, issued in Panama) are reported working by vendors but **[unverified]** [12][13]. Prepaid and virtual cards get declined more often and recurring threshold charges can fail. Failed payments get the ad account restricted [1]. | Low |
| Billing currency | Bill in **USD**. Meta bills USD for most of South America [1]. VES is very likely not offered as an ad-account currency **[unverified]**. Even if it were, USD avoids FX noise. | Medium |

### Pitfalls for a brand-new account (plan around these)
- **Daily Spending Limit.** New business portfolios, ad accounts and Pages get an undisclosed daily cap that rises with good history. Advertisers often report **$50/day** [14]. Our plan peaks at $20–30/day, so it should not bind. If ads stop delivering mid-day while under budget, this is why.
- **Billing threshold.** Charges start at a low threshold (about $25) and step up, so expect many small charges [1]. Tell your bank or card issuer, because repeated foreign charges trigger fraud blocks.
- **Limited payment options on new accounts.** Some new accounts only see prepaid or manual funding until they build history [15]. If prepaid shows up, that's fine for us and caps spend naturally.
- **Ad review.** Usually under 24 h, but it can take longer for a new advertiser. Submit the ads **2–3 days before** the week-2 start (they can sit approved and PAUSED).
- **Account security flags.** Logging into Business Suite through rotating VPN countries, which is common in VE, plus a fresh profile and a new card is the classic pattern behind "ad account disabled". Use one stable connection and the personal profile with real history, turn on 2FA before anything else, and **don't swap cards repeatedly** after a decline.
- **The mascot is a bomb.** Meta restricts weapons and explosives content. A cartoon lit bomb should pass, but automated review may reject it as a false positive. Lead the first frame with gameplay or the animal friends, and request a manual review if it's rejected.
- **Q4 auction pressure.** October–November CPMs rise across LATAM ahead of Black Friday and Christmas. Argentina's CPM nearly doubled in Q4 last year [16].

### Test country: **Colombia (CO)**
- **Cheap and stable.** CO CPMs averaged about **$2.74** in 2025, roughly 86% below the global average [16]. MX runs higher (e-commerce CPC about $0.35 [17]). AR has the lowest CPC (about $0.11 average) but swings with the exchange rate, and its CPM nearly doubled in the Q4 run-up [16][17], which falls right in our window.
- **Same creative works.** Colombia has the largest Venezuelan diaspora (about 2.8 M people). VE-flavoured humour and the Chigüi capybara meme land there without re-cutting.
- **Payment friction is lower, and it de-risks the plan.** If VE delivery is choked by an outage or the conversion rate is poor, CO is the fallback that scales.

---

## 2. Account setup sequence (Guille does these by hand)

Order matters. Steps marked ⚠ cannot be undone.

1. **Personal Facebook profile**, real and with history. Turn on **2FA** (authenticator app, not SMS).
2. **Facebook Page "MiniCaos"** (category: Video game). Profile picture is Caos; add the website link.
3. **Instagram account → switch to Professional (Creator or Business)** and connect it to the Page in Page settings → Linked accounts.
4. **Business Portfolio** at business.facebook.com → Create. Use your **legal name and real address**; it's used for billing and possibly business verification later. Add the Page and the IG account to it.
5. **Turn on the 2FA requirement:** Settings → Business portfolio info → Two-factor authentication → *Everyone* [18].
6. **Ad account:** Settings → Accounts → Ad accounts → Add → Create new.
   - ⚠ **Currency: USD.** It can't be changed later; you'd need a new ad account.
   - ⚠ **Time zone: America/Caracas (UTC−4).** Daily budgets reset at local midnight, so reports line up with the VE audience's day. It is also within an hour of Colombia (UTC−5).
   - Country / tax info: where you actually are. Payment method: a card in **your own name** (see §1).
   - Set an **account spending limit of $300**, a hard ceiling that also protects against agent mistakes (Billing → Payment settings → Account spending limit).
7. **Pixel / dataset:** Events Manager → Connect data sources → Web → name it "MiniCaos web". Copy the ID into `<meta name="meta-pixel-id">` in `index.html` (currently `__META_PIXEL_ID__`), then deploy.
   - Check with **Test events** (Events Manager) plus the Meta Pixel Helper extension: play one microgame and confirm `PageView`, `GameStart` and `MicrogamePlayed` arrive.
8. **Domain verification:** Business Settings → Brand safety → Domains → add **`guille.tech`**. Meta verifies the registrable domain (eTLD+1), which covers `minicaos.guille.tech` [19].
   - **Preferred: DNS TXT in Cloudflare.** DNS → Add record → Type `TXT`, Name `@`, Content `facebook-domain-verification=…`. Don't touch existing SPF/DKIM TXT records. Proxy status doesn't apply to TXT. It can take up to 72 h.
   - Alternative: the `<meta name="facebook-domain-verification">` tag must sit on the root domain's homepage, so it only works if `guille.tech` itself serves a page you control. Use DNS.
   - If MiniCaos moves to its own domain later (minicaos.gg), verify that domain too, and re-point the pixel's allowed domains.
9. **Custom conversion:** Events Manager → Custom conversions → Create.
   - Data source: the MiniCaos pixel. Event: **`MicrogamePlayed`** (it appears only after it has fired at least once, so do step 7's test first). Rule: URL contains `minicaos`. Category: *Other*. Name: `CC_MicrogamePlayed`.
   - Note the **custom conversion ID** for `.env`.
10. **(Optional) Traffic allow-list:** Events Manager → Settings → *Traffic permissions* → allow only `guille.tech`, so nobody can pollute the pixel from another site.
11. Hand off to the API path (§3): create the app and system user, and give the token to Claude via `.env`.

> **Measurement caveat:** `MicrogamePlayed` fires once per *page load*, not once per person. A player who reloads or comes back counts again, while ad-blockers and in-app browser quirks under-count. Expect pixel numbers to differ from OpenPanel by ±20%. **OpenPanel `game_start` filtered by `utm_source` is the source of truth for the +1,000 goal.** Meta's number is what the algorithm optimizes.

---

## 3. API path (so an agent can run the campaigns)

### One-time setup (Guille)
1. **developers.facebook.com → My Apps → Create app.** Pick the use case **"Create & manage ads with Marketing API"**, app type **Business**, and link it to the MiniCaos Business Portfolio. No App Review is needed (see below).
2. Business Settings → Users → **System users → Add**. Name `minicaos-agent`, role **Admin**.
3. **Assign assets** to the system user:
   - the ad account (**Manage campaigns / full control**)
   - the Page (**Create ads**, plus content if you want it to read posts)
   - the pixel/dataset (**Manage**)
   - the Instagram account
4. **Generate new token:** choose the app, expiration **Never**, and these scopes:
   - `ads_management`: create, edit and pause campaigns, ad sets, ads and creatives
   - `ads_read`: insights
   - `business_management`: read business assets and the system user's asset list
   - `pages_show_list` + `pages_read_engagement`: use the Page as the ad identity
   - `instagram_basic`: resolve the IG account for placements via `/connected_instagram_accounts`. **[unverified]** Some setups need `instagram_manage_ads` instead; add it if the creative call says so.
   - Scopes are fixed at generation. To add one later, generate a new token [20].
5. Copy the **App Secret** too, for `appsecret_proof`.

**Access level:** **Standard Access is enough.** It covers ad accounts the app's own business owns or administers. Advanced Access, App Review and Business Verification are only needed to manage *other people's* accounts or for higher rate limits [20][21]. The app can stay in Development mode for system-user calls on your own assets **[unverified]**. Switch it to Live if a call complains.

### `.env` (never committed; `.gitignore` already covers `.env*` and keeps only `.env.example`)
```dotenv
META_API_VERSION=v26.0          # current as of 2026-10 (released 2026-07-29) [22]
META_ACCESS_TOKEN=...           # system user token, never paste in chat
META_APP_SECRET=...
META_AD_ACCOUNT_ID=act_...
META_PAGE_ID=...
META_IG_USER_ID=...             # from GET /act_.../connected_instagram_accounts
META_PIXEL_ID=...
META_CUSTOM_CONVERSION_ID=...
```
Commit only `.env.example` with these keys and empty values.

### Version notes for 2026
- **Use v26.0**, released 2026-07-29 [22]; v25.0 came out 2026-02-18 [23]. Meta ships about three versions a year, so re-check before November.
- Legacy Advantage+ Shopping/App campaigns (ASC/AAC, `smart_promotion_type`) **can no longer be created** through the API on any version [24]. A manual campaign becomes "Advantage+" by combining campaign budget, `advantage_audience`, and default placements. Read the result from `advantage_state_info`.
- `instagram_actor_id` is gone. Use **`instagram_user_id`** in creatives [25].
- An ABO campaign without a campaign budget must say whether ad sets may share budget (`is_adset_budget_sharing_enabled`) **[unverified field name; validate first]** [26]. Set it to `false` for a clean creative test.
- **Safety habit:** run every create first with `execution_options=["validate_only"]`, and create everything with `status: "PAUSED"`. Guille approves each ad (PLAN.md); the agent may only *pause* on its own.

### Minimal Node client (Node ≥ 20; built-in `fetch`, `FormData`, `fs.openAsBlob`)
```js
// scripts/meta/client.mjs  (example, not yet in repo)
import crypto from 'node:crypto';
import 'dotenv/config'; // or: node --env-file=.env
const { META_API_VERSION: V, META_ACCESS_TOKEN: TOKEN, META_APP_SECRET: SECRET } = process.env;
const BASE = `https://graph.facebook.com/${V}`;
const proof = crypto.createHmac('sha256', SECRET).update(TOKEN).digest('hex');

export async function graph(path, { method = 'GET', params = {}, body } = {}) {
  const url = new URL(`${BASE}/${path}`);
  const auth = { access_token: TOKEN, appsecret_proof: proof };
  let init = { method };
  if (method === 'GET') Object.entries({ ...params, ...auth }).forEach(([k, v]) => url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v));
  else if (body instanceof FormData) { Object.entries(auth).forEach(([k, v]) => body.set(k, v)); init.body = body; }
  else {
    const form = new URLSearchParams();
    Object.entries({ ...params, ...auth }).forEach(([k, v]) => form.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v)));
    init.body = form;
  }
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(`${json.error.code}/${json.error.error_subcode}: ${json.error.message}`);
  return json;
}
export const VALIDATE = { execution_options: ['validate_only'] }; // spread into params for a dry run
```

### Campaign → ad set → video → creative → ad (all PAUSED)
```js
// scripts/meta/create-test.mjs
import fs from 'node:fs';
import { graph } from './client.mjs';
const { META_AD_ACCOUNT_ID: ACT, META_PAGE_ID: PAGE, META_IG_USER_ID: IG, META_PIXEL_ID: PIXEL, META_CUSTOM_CONVERSION_ID: CC } = process.env;

// 1) Campaign: Sales objective, ABO (no campaign budget), PAUSED
const campaign = await graph(`${ACT}/campaigns`, { method: 'POST', params: {
  name: 'MC_VE_ABO-test_SALES-MGP_2026-10-16',
  objective: 'OUTCOME_SALES',
  buying_type: 'AUCTION',
  special_ad_categories: [],               // required, empty for us
  is_adset_budget_sharing_enabled: false,  // ABO test: each creative keeps its own $ [verify name]
  status: 'PAUSED',
}});

// 2) Ad set: optimize for the custom conversion, broad VE 18+, $4/day
const adset = await graph(`${ACT}/adsets`, { method: 'POST', params: {
  name: 'MC_VE_f1a_broad18+_advpl',
  campaign_id: campaign.id,
  daily_budget: 400,                        // cents → $4.00
  billing_event: 'IMPRESSIONS',
  optimization_goal: 'OFFSITE_CONVERSIONS',
  bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
  promoted_object: { pixel_id: PIXEL, custom_event_type: 'OTHER', custom_conversion_id: CC }, // [validate shape]
  attribution_spec: [{ event_type: 'CLICK_THROUGH', window_days: 1 }],
  targeting: {
    geo_locations: { countries: ['VE'], location_types: ['home', 'recent'] },
    age_min: 18,
    targeting_automation: { advantage_audience: 1 },  // broad; Meta finds players
    // Placements: omit = Advantage+ placements. Reels-only variant:
    // publisher_platforms: ['facebook','instagram'], facebook_positions: ['facebook_reels','story'], instagram_positions: ['reels','story'],
  },
  start_time: '2026-10-16T00:00:00-0400',
  status: 'PAUSED',
}});

// 3) Upload the vertical video (9:16, ≤ 60 s; ours are 10–25 s)
const fd = new FormData();
fd.set('name', 'f1a_reto5en25_v1');
fd.set('source', await fs.openAsBlob('out/f1a_reto5en25_v1.mp4'), 'f1a.mp4');
const video = await graph(`${ACT}/advideos`, { method: 'POST', body: fd });
// Wait until processed: poll GET /{video.id}?fields=status until status.video_status === 'ready'
const thumbs = await graph(`${video.id}/thumbnails`);
const thumb = (thumbs.data.find(t => t.is_preferred) || thumbs.data[0]).uri;

// 4) Creative: Page + IG identity, UTM via url_tags
const creative = await graph(`${ACT}/adcreatives`, { method: 'POST', params: {
  name: 'CR_f1a_reto5en25_v1',
  object_story_spec: {
    page_id: PAGE,
    instagram_user_id: IG,
    video_data: {
      video_id: video.id,
      image_url: thumb,
      message: '¿Pasas 5 microjuegos en 25 segundos? 💣 Gratis, sin descargar.',
      title: 'MiniCaos',
      call_to_action: { type: 'PLAY_GAME', value: { link: 'https://minicaos.guille.tech/' } }, // fallback: LEARN_MORE
    },
  },
  url_tags: 'utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content=f1a',
}});

// 5) Ad: PAUSED; Guille flips it on after review
const ad = await graph(`${ACT}/ads`, { method: 'POST', params: {
  name: 'MC_VE_f1a_reto5en25_v1',
  adset_id: adset.id,
  creative: { creative_id: creative.id },
  status: 'PAUSED',
}});
console.log({ campaign: campaign.id, adset: adset.id, video: video.id, creative: creative.id, ad: ad.id });
```
`PLAY_GAME` is documented for desktop game apps and Instant Games [27]. If the web-link creative rejects it, use `LEARN_MORE` or `SIGN_UP`.

### Read insights, and the one action the agent may take alone
```js
// scripts/meta/report.mjs
import { graph } from './client.mjs';
const { META_AD_ACCOUNT_ID: ACT, META_CUSTOM_CONVERSION_ID: CC } = process.env;
const KEY = `offsite_conversion.custom.${CC}`; // custom-conversion action type

const { data } = await graph(`${ACT}/insights`, { params: {
  level: 'ad',
  date_preset: 'last_7d',             // or time_range: {since,until}
  fields: 'campaign_name,adset_name,ad_name,ad_id,adset_id,impressions,reach,frequency,spend,cpm,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,actions,cost_per_action_type',
  breakdowns: 'country',
}});
for (const r of data) {
  const conv = Number(r.actions?.find(a => a.action_type === KEY)?.value || 0);
  const cpp = conv ? (Number(r.spend) / conv).toFixed(2) : '∞';
  console.log(r.country, r.ad_name, `$${r.spend}`, `${r.impressions} imp`, `CPM $${r.cpm}`, `CTR ${r.inline_link_click_ctr}%`, `MGP ${conv}`, `CPP $${cpp}`);
}
// Pausing a loser is the only unattended write allowed by PLAN.md:
// await graph(adsetId, { method: 'POST', params: { status: 'PAUSED' } });
```

---

## 4. Campaign structure

### Objective: **Sales (OUTCOME_SALES), conversion location Website, optimized on `CC_MicrogamePlayed`**
- **Traffic** optimizes for link clicks or landing-page views. In VE that buys the cheapest, most accidental taps (Audience Network, fat-finger Reels clicks), and many never wait for the game to load. Clicks are cheap; players are not.
- **Engagement** optimizes for likes and video views on Meta, the wrong place.
- **Leads** can also optimize on a custom conversion, but it's built for forms and lead events. Sales is Meta's standard home for "website + pixel event" optimization, and the cleanest in the API.
- **Sales on our custom conversion** pushes Meta toward people who *actually finish a microgame*. That matches the PLAN metric, and the event fires within about 30 s of the click, so the learning signal is fast and dense.
- **Fallback rule:** if an ad set has **fewer than 5 conversions after 72 h** while spending its budget, the pixel has too little signal. Duplicate the ad set optimized on the higher-volume `GameStart`, or as a last resort on Traffic → Landing page views. Never compare CPP across optimization goals.

### Week 2 (Oct 16–22): ABO creative test (about $140)
| Campaign | Ad sets | Budget |
|---|---|---|
| `MC_VE_ABO-test_SALES-MGP_2026-10-16` | 4 ad sets, **one creative each** (formats 1–4 from PLAN.md: f1 "reto 5 en 25", f2 "100 microjuegos", f3 "versus", f4 "montaje <10 s") | 4 × $4/day = $16/day |
| `MC_CO_ABO-test_SALES-MGP_2026-10-16` | 1 ad set with the same 4 ads (Meta rotates them) | $4/day |

- **Targeting: broad.** Country only, age 18+, Advantage+ audience on, no interests. At $4/day an interest stack just shrinks the pool and slows learning, and with Advantage+ audience Meta treats interests as suggestions anyway. Use 18+ (not 13+) to stay clear of teen-ad restrictions. Language isn't needed, since all of VE and CO speaks Spanish.
- **Placements: Advantage+ placements, minus Audience Network.** AN in LATAM is where accidental clicks and junk traffic concentrate. All creatives are 9:16 vertical with a safe zone, so Reels and Stories get them natively, and feeds get a 4:5 crop. Run a **Reels-only** ad set as a second test only if Advantage+ spend drifts into feeds with poor CPP.
- **Learning phase:** Meta wants about 50 conversions per ad set per week to exit learning. At $4/day and $0.30 CPP that's about 13/day, roughly 90/week, so the test is feasible in VE. In CO it's borderline, which is why CO gets one pooled ad set.
- **Smaller budget ($150 total):** drop the CO campaign and run 4 × $3/day in VE.

### Week 3 (Oct 23–29): CBO scale (about $140)
- New campaign `MC_VE_CBO-scale_SALES-MGP_2026-10-23` with **campaign budget $20/day**, Advantage+ audience, and default placements minus AN. That puts it in Meta's "Advantage+" state.
- Contents: one ad set holding the **winner + 2 re-cuts** of it (the f1a/f1b/f1c style re-cuts from PLAN.md) + the runner-up. Add CO as a second ad set **only** if its week-2 CPP was within 1.5× of VE's.
- Keep the week-2 winner ad set running at $4 for a few days as a control, then pause it.

### Week 4 (Oct 30–Nov 9)
- Spend what's left in the CBO. **Raise budget at most +20–30% every 48 h** (bigger jumps reset learning). Refresh creative when frequency passes 3 or CTR drops 30% from its peak.

### Kill and scale rules
Target cost per `MicrogamePlayed` (CPP): **VE $0.30, CO $0.60**.

| When | Rule |
|---|---|
| Day 1–2 | **No verdicts.** Only kill for broken things: rejected ad, 0 impressions after 24 h, landing page errors, pixel not firing. |
| Any time after $1.50 spent in VE ($3 in CO) | **0 conversions → pause** (5× target with nothing to show). |
| Day 3–5, ≥ 3,000 impressions | **CPP > 2× target → pause.** CPP between 1–2× → keep until day 5, then pause if still above 1.5×. |
| Any time, ≥ 2,000 impressions | Link CTR < 0.6% → the hook is weak. Mark the creative for a re-cut (don't kill the format; PLAN.md says 2 re-cuts before dropping one). |
| Day 5–7 | **Winner = lowest CPP with ≥ 15 conversions and CPP ≤ target.** It goes to the CBO. Runner-up goes along if CPP ≤ 1.3× winner. |
| Scale | +20–30% budget per 48 h while CPP stays ≤ target. If CPP rises > 1.5× target for 2 straight days, roll the budget back one step. |
| Cross-check | Weekly: compare Meta conversions against OpenPanel `game_start` with `utm_medium=paid_social`. If OpenPanel shows < 60% of Meta's count, investigate (bots, reload double-counts) before scaling. |

The agent may **pause** under these rules without asking. Anything else (new ads, budget changes, resuming) needs Guille's ok.

### UTMs (set once in `url_tags` on each creative)
```
utm_source={{site_source_name}}   → fb | ig | an | msg  (Meta fills it in)
utm_medium=paid_social
utm_campaign={{campaign.name}}    → MC_VE_ABO-test_SALES-MGP_2026-10-16
utm_term={{adset.name}}           → MC_VE_f1a_broad18+_advpl
utm_content=<creative id>         → f1a
```
OpenPanel records UTM params on the first screen view (`trackScreenViews: true`). **[verify]** Filter there by `utm_content` to get per-creative players.

### Naming conventions
`MC_<geo>_<structure>-<stage>_<objective>-<event>_<start date>`

| Level | Pattern | Example |
|---|---|---|
| Campaign | `MC_{VE|CO|LATAM}_{ABO|CBO}-{test|scale}_SALES-MGP_{YYYY-MM-DD}` | `MC_VE_CBO-scale_SALES-MGP_2026-10-23` |
| Ad set | `MC_{geo}_{creative or pool}_{audience}_{placement}` | `MC_VE_f1a_broad18+_advpl`, `MC_CO_pool4_broad18+_reels` |
| Ad | `MC_{geo}_{creativeId}_{slug}_v{n}` | `MC_VE_f1b_reto5en25_v2` |
| Creative ID | `f{format 1–4}{re-cut letter}`, which matches the PLAN.md formats | `f1a`, `f1b`, `f3a` |
| Video file | `{creativeId}_{slug}_v{n}.mp4` | `f2a_100juegos_v1.mp4` |

---

## 5. Expected numbers

No public dataset has clean VE numbers. These ranges combine CO, AR and MX benchmarks [16][17], a VE agency estimate (CPM $2–5 for e-commerce) [10], and gaming CPCs from PLAN.md research ($0.23–0.35 in AR/MX/CO). **Week 2 replaces this table with real data.**

| Metric | Venezuela | Colombia |
|---|---|---|
| CPM | $1.00–3.50 | $2.50–5.00 |
| Link CTR (vertical gameplay video) | 1.2–2.5% | 1.0–2.0% |
| CPC (link) | $0.05–0.20 | $0.15–0.40 |
| Click → `MicrogamePlayed` (load, tap start, finish ~5 s game) | 30–50% | 35–55% |
| **Cost per player (CPP)** | **$0.12–0.60 (plan with $0.30)** | **$0.30–1.10 (plan with $0.60)** |
| Cost of 1,000 players | $150–600 (central ~$300) | $300–1,100 (central ~$600) |

VE's click→play rate assumes a slow mobile network. Game load time on a low-end Android is the biggest lever on CPP. Check the bundle size before launch.

### What $150–300 buys
| Scenario | Avg CPP (blended) | Players from $280 | Players from $150 |
|---|---|---|---|
| Optimistic | $0.18 | ~1,550 | ~830 |
| **Central** | **$0.33** | **~850** | **~450** |
| Pessimistic | $0.65 | ~430 | ~230 |

These are *pixel-counted* conversions. Unique players run about 10–20% lower, because `MicrogamePlayed` re-fires on reload or return visits.

**Honest read:** the central case gets about **700–850 unique players from paid** on the full $300. **The budget alone will most likely not reach 1,000.** It gets there only if VE CPP holds at or below about $0.28 for the whole run. The gap has to come from organic video and the share-card loop (challenge links): every paid player who shares a result is a free second player. Track the "k-factor" (new players arriving via challenge links ÷ paid players). A k of 0.2–0.3 closes the gap. If week 2 shows VE CPP above $0.50, move remaining spend to whichever of VE or CO is cheaper rather than adding budget, and lean harder on organic.

---

## Launch checklist (who / when)
- [ ] **Guille**: 2FA → Page → IG Professional → Business Portfolio (2FA required) → ad account (**USD, America/Caracas**, own-name card, $300 account limit)
- [ ] **Guille**: Pixel created; ID into `index.html`; deploy `minicaos.guille.tech`; Test Events shows `MicrogamePlayed`
- [ ] **Guille**: DNS TXT for `guille.tech` in Cloudflare → verified in Business Settings
- [ ] **Guille**: Custom conversion `CC_MicrogamePlayed`
- [ ] **Guille**: Marketing API app (Business, linked) → admin system user → assets assigned → token (never expires) → `.env`
- [ ] **Agent**: `validate_only` dry run of the §3 script, then create the week-2 structure PAUSED, about 3 days before Oct 16
- [ ] **Guille**: review and approve each ad → set ACTIVE
- [ ] **Agent**: daily insights report + kill rules; weekly OpenPanel cross-check into `RESULTS.md`

---

## Sources
1. EverTry, "How to Pay for Meta Ads in South America" (vendor): https://evertry.co/blog/how-to-pay-for-meta-ads-in-south-america-2/
2. Slash, "Credit Cards for Meta Ads": https://www.slash.com/blog/cards-for-meta-ad-spend
3. OFAC recent actions, Venezuela GLs 2026: https://ofac.treasury.gov/recent-actions/20260324 · https://ofac.treasury.gov/recent-actions/20260505 · https://ofac.treasury.gov/recent-actions/20260625_33
4. Google Ads country restrictions (embargoed list, for comparison): https://support.google.com/google-ads/answer/6163740
5. Kharon, "Businesses in embargoed jurisdictions marketing ad services with digital giants": https://kharon.com/updates/businesses-in-embargoed-jurisdictions-marketing-ad-services-with-digital-giants/
6. El Diario / VE Sin Filtro, blocked domains report (2026-09-28): https://eldiario.com/2026/09/28/dominios-bloqueados-venezuela-4/
7. La Patilla, "más de 200 dominios siguen bloqueados" (2026-03-22): https://lapatilla.com/2026/03/22/informe-revela-la-magnitud-de-la-censura-digital-en-venezuela-mas-de-200-dominios-siguen-bloqueados-foto/
8. Emol, "Venezuela levanta restricciones a sitios informativos" (2026-09-17): https://www.emol.com/noticias/Internacional/2026/09/17/1211785/venezuela-levanta-restricciones-sitios-informativos.html
9. La Patilla, "¿Qué pasó con las publicidades de Facebook e Instagram en Venezuela?" (2019): https://lapatilla.com/2019/08/27/que-paso-con-las-publicidades-de-facebook-e-instagram-en-venezuela/
10. Andrey Business, "Pauta Meta · Venezuela" (agency, unverified claims): https://www.andreybusiness.com/venezuela/meta-ads
11. Tiendanube, "Cómo pagar publicidad en Facebook": https://www.tiendanube.com/blog/como-pagar-publicidad-en-facebook/
12. CB Insights, Zinli: https://www.cbinsights.com/company/zinli
13. Descubre.vc, recarga Zinli con Binance: https://www.descubre.vc/noticia/c-mo-recargar-la-tarjeta-zinli-en-venezuela-con-binance-2024-12-27
14. Jon Loomer, Daily Spending Limit: https://www.jonloomer.com/glossary/daily-spending-limit/ · https://www.jonloomer.com/campaign-spending-limits-account-spending-limits-daily-spending-limits/
15. Metricool, Meta Ads errors (new accounts / billing options): https://help.metricool.com/es/errores-y-resolucion-de-problemas-de-campanas-de-meta-ads-7o5qe
16. SuperAds, CPM/CPC by country (CO, AR): https://www.superads.ai/facebook-ads-costs/cpm-cost-per-mille/colombia · https://www.superads.ai/facebook-ads-costs/cpm-cost-per-mille/argentina · https://www.superads.ai/facebook-ads-costs/cpc-cost-per-click/colombia
17. NovoAds, "¿Cuánto cuesta la publicidad en Meta?" (LATAM): https://novoads.ai/es/blog/cuanto-cuesta-publicidad-en-meta
18. Business portfolio 2FA requirement (Meta help mirror): https://support.chatarchitect.com/books/meta-business-portfolio-setup/page/turn-on-the-two-factor-authentication-requirement-in-your-business-portfolio
19. NameSilo, "How to verify domain ownership for Meta Business Manager": https://www.namesilo.com/blog/en/dns/how-to-verify-domain-ownership-for-meta-business-manager · IONOS guide: https://www.ionos.com/digitalguide/domains/domain-tips/facebook-domain-verification.md
20. Meta, Marketing API authentication (system users): https://developers.facebook.com/docs/marketing-api/get-started/authentication · Unified.to guide: https://unified.to/blog/how_to_get_your_meta_ads_api_key
21. Hightouch, Facebook destination (permissions/access): https://hightouch.com/es/docs/destinations/facebook
22. Meta, "Introducing Graph API v26 and Marketing API v26" (2026-07-29): https://developers.facebook.com/blog/post/2026/07/29/introducing-graph-api-v26-and-marketing-api-v26/
23. Meta, "Introducing Graph API v25 and Marketing API v25" (2026-02-18): https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25
24. Meta, "ASC and AAC deprecation, MAPI v25": https://developers.facebook.com/blog/post/2026/02/13/asc-and-aac-deprecation-mapi-v25/ · Advantage+ campaigns: https://developers.facebook.com/docs/marketing-api/advantage-campaigns
25. Meta, Marketing API v22.0 changelog (`instagram_user_id`): https://developers.facebook.com/docs/marketing-api/marketing-api-changelog/version22.0
26. Meta, Ad set budget sharing: https://developers.facebook.com/documentation/ads-commerce/marketing-api/bidding/guides/adset-budget-sharing
27. Meta, Mobile app ads CTAs (`PLAY_GAME`): https://developers.facebook.com/docs/marketing-api/mobile-app-ads · Promoted object reference: https://developers.facebook.com/docs/marketing-api/reference/ad-promoted-object
