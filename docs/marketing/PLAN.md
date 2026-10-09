# Growth experiment: +1,000 players in 30 days

**Window:** 2026-10-09 → 2026-11-09
**Goal:** +1,000 new users, counted as **someone who plays at least one microgame** (OpenPanel `game_start`). Google sign-ups are a secondary metric.

## Decisions taken (grilling session, 2026-10-09)

| Topic | Decision |
|---|---|
| Metric | Players who play 1 game (not visits, not sign-ups) |
| Paid budget | ~$150–300 USD, **Meta only** (TikTok Ads needs at least $50/day, which doesn't fit) |
| Market | **Venezuela first** (cheapest CPC), then MX, CO, AR as tests |
| Brand | **MiniCaos.** Full rebrand before any ad: game name + character name + mascot redesign. Nothing public uses "Claude". Lives at `minicaos.guille.tech` for now; own domain later (minicaos.gg/.io looked free on 2026-10-09). |
| Cast | **Caos** (a lit bomb whose fuse follows the timer) + 5 Latin American animal friends hosting the first 5 stages: Sapito (frog, Bug Hunt), Pulpi (octopus, Keyboard Kingdom), Zumbi (hummingbird, Reflex Rush), Chigüi (capybara with the meme orange, Mouse Mayhem), Profe Lechuza (owl, Brain Break). Other stages use a recolored Caos for now. Sketches: `docs/mascot-preview.html`. |
| Voice | **People follow people, not brands.** Guille's personal accounts are the main organic voice (dev on camera). The MiniCaos brand accounts carry gameplay clips, the ads and the play link. |
| Channels | TikTok, Instagram + Facebook, YouTube Shorts. **Video only:** no Reddit, no portals, no creator outreach. |
| Code | Rebrand + Wordle-style share card on challenge links + Meta Pixel with a `game_start` event |
| Publishing | Postiz self-hosted on Dokploy. IG/FB publish via API; TikTok/Shorts upload as draft or private and Guille taps publish. TikTok and YouTube audits requested in week 1. |
| Video | Automated gameplay capture (Playwright → vertical edit with ffmpeg/Remotion) + Guille's face clips (~4 h/week) |
| Approvals | **Each post and each ad needs Guille's explicit ok.** Pausing a losing ad is the only thing done without asking. |
| Workspace | This folder. Rendered videos stay out of git. |

## What only Guille can do
Claude can't create accounts or enter payment methods:
1. Create the TikTok, Instagram, Facebook Page + Business Manager + ad account (with card), and YouTube channel accounts, using the new name.
2. Register the TikTok and Google Cloud (YouTube Data API) developer apps, then give Claude the keys via `.env`, never in chat.
3. Access to OpenPanel and the PocketBase admin, to record the baseline.
4. Publish TikTok and Shorts drafts (one tap each).

## Research summary (full report in the session; key sources)
- Comparable games (Wordle, Agar.io, Gartic Phone, Among Us) grew through **shareable results + creator clips + community**, not ads. Wordle went from 90 to 300k players after adding its emoji share grid.
- Organic devlog reach dropped in 2025. **Re-editing** the same clip faster (<15 s, hook + CTA) took one game from 10k to 7M views. Never judge a clip by a single post.
- Meta gaming CPC: ~$0.16 BR, ~$0.23–0.35 AR/MX/CO, against ~$1.18 globally. Estimate: **$0.20–0.60 per player in LATAM.**
- Test with ABO (4 creatives × $5/day × 7 days), scale the winner with CBO. Don't decide before days 5–7.
- Meta and TikTok reject ads that suggest affiliation with another brand, and Anthropic requires prior approval to use "Claude". Hence the rebrand.

## Calendar
| Week | Product | Content | Ads |
|---|---|---|---|
| 1 (Oct 9–15) | Name chosen → rebrand, share card, Pixel. Postiz on Dokploy. | Accounts created. Capture pipeline working. First 3 videos (organic). | Request TikTok/YT audits. Baseline recorded. |
| 2 (Oct 16–22) | Fixes based on data | 5 videos/week across 4 formats (see below) | ABO test: 4 creatives, VE + 1 test country, $20/day |
| 3 (Oct 23–29) | — | Re-cuts of the winner + face clips | Winner → CBO, ~$20–30/day |
| 4 (Oct 30–Nov 9) | — | Double down on the best-performing format | Scale or reallocate; close with a report |

## Formats to A/B test
1. "Can you beat these 5 in 25 seconds?" A fail on the last one, plus a question for comments.
2. "I made 100 microgames on my own. Which is the worst?" (Guille on camera)
3. Split-screen friend reactions in a VERSUS/KNOCKOUT room
4. Ultra-fast montage, <10 s, of a single theme (bosses, 3D, impossible ones)

Each format gets at least 2 re-cuts before it's dropped.

## Results log
See `RESULTS.md` (created once baseline data exists).
