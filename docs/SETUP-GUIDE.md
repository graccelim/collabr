# Collabr — Production Setup Guide (final)

Step-by-step infrastructure setup for the Creator/Brand monetisation + Connected +
analytics + AI ecosystem. The code is complete and **fails safe**: with the master
flag off and no credentials, the app runs as the original pre-analytics product.
Nothing fakes data, charges anyone, or calls a provider until you complete these steps.

**Recommended go-live order:** Supabase → env vars → Stripe → Social platforms (YouTube/Instagram/TikTok) →
Anthropic → Resend → Vercel → DNS → flip flags → QA.

---

## 1. Supabase
**Migrations — apply `037`→`044` together as ONE batch, in order, BEFORE enabling any
new feature flag.** `001`–`036` should already be live; confirm, then run the whole batch:
- `037_collabr_certified.sql` — Certified badge (independent of the analytics suite)
- `038_creator_pro.sql` — private `creator_subscriptions`
- `039_connected_analytics.sql` — connected_accounts/snapshots/posts/rollups/content_dna/ai_* + ops
- `040_brand_plus_tier.sql` — `brand_profiles.plan` += `plus`
- `041_brand_billing_privacy.sql` — private `brand_subscriptions`; migrates any existing Stripe IDs out of, then **drops them from, the public `brand_profiles`** (the canonical billing-privacy architecture — intentionally destructive, do not soften)
- `042_campaign_analytics.sql` — campaign_rollups trend/coverage/AI-recap + `content_posts.collab_id` index
- `043_creator_trends.sql` — `creator_rollups.trends` for the Insights historical-trend chart (additive)
- `044_native_oauth_tokens.sql` — private `connected_account_tokens` (service-role only) for first-party social OAuth (additive)

> **Apply as a single batch.** `041` removes `stripe_customer_id` / `stripe_subscription_id` from
> `brand_profiles` and the deployed code reads them exclusively from `brand_subscriptions`, so the new
> code and this schema are a matched pair — never run the new code against a DB missing `041`, or apply
> `041` while old code is live. `037`–`040`, `042` and `043` are additive; `041` migrates existing data before
> dropping the columns, so the batch is safe to apply in one pass. The batch is **not** designed to be
> rolled back (no down-migrations) — it is the canonical schema going forward.

**Service role key:** copy from Supabase → Settings → API → `service_role` → set `SUPABASE_SERVICE_ROLE_KEY` (server-only; required by the admin client, all crons, and all webhooks). **Currently missing from `.env.local`.**

**RLS checks** (the migrations set these — verify in Table editor → RLS):
- Private, owner-read + service-write: `creator_subscriptions`, `brand_subscriptions`, `collabr_certification`, `connected_accounts`, `creator_rollups`, `content_dna`, `content_posts`, all `ai_*`, `creator_goals`.
- Service-role only (no client read): `account_snapshots`, `post_snapshots`, `sync_jobs`, `webhook_events`.
- Brand-owner read: `campaign_rollups`.
- Verify **no Stripe IDs on public tables**: `brand_profiles` and `creator_profiles` must NOT contain `stripe_customer_id`/`stripe_subscription_id` (041 removed brand's; creator's were never there).

**Storage buckets:** none new (dispute-evidence bucket from earlier migrations is unchanged).

## 2. Stripe
**Products + recurring Prices** (Dashboard → Products; SGD). Creating Prices charges no one.
| Product | Prices → env var |
|---|---|
| Creator Pro | monthly `STRIPE_CREATOR_PRO_PRICE_MONTHLY`, annual `STRIPE_CREATOR_PRO_PRICE_ANNUAL` |
| Brand Pro | monthly `STRIPE_BRAND_PRO_PRICE_MONTHLY`, annual `STRIPE_BRAND_PRO_PRICE_ANNUAL` (legacy fallback `STRIPE_PRO_PRICE_ID`) |
| Brand Plus | monthly `STRIPE_BRAND_PLUS_PRICE_MONTHLY`, annual `STRIPE_BRAND_PLUS_PRICE_ANNUAL` |
| (optional) Boost | `STRIPE_BOOST_PRICE_MONTHLY`, `STRIPE_BOOST_PRICE_PER_APP` |

**Webhook endpoints** (Dashboard → Developers → Webhooks) — **two endpoints, two secrets**:
1. `https://<host>/api/webhooks/stripe` → secret `STRIPE_WEBHOOK_SECRET`. Events: `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `refund.updated`, `transfer.reversed`, `account.updated`, `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. *(escrow + boost + **brand** subscriptions)*
2. `https://<host>/api/webhooks/stripe-creator-pro` → secret `STRIPE_CREATOR_PRO_WEBHOOK_SECRET`. Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. *(**creator** subscriptions, isolated)*

Which secret → which endpoint: secret #1 belongs to `/api/webhooks/stripe`; secret #2 to `/api/webhooks/stripe-creator-pro`. Keep them isolated.

**Customer Portal:** Dashboard → Billing → Customer portal → enable (brands manage/cancel via `/api/billing/portal`). For creators, the portal is reachable via the same Stripe portal (creator subscription's customer).

**Beta behaviour:** with `BETA_FREE_PRO=true` (default), Brand Pro is **free** — `/api/billing/checkout` for tier `pro` returns 409 and brands resolve to "Pro Beta". Brand **Plus** is still purchasable (it's gated, not free) — unless you also set `BETA_FREE_PLUS=true`. Set `BETA_FREE_PRO=false` to start charging brands. **Creator Pro** charges from launch (gated by the master flag + `NEXT_PUBLIC_CREATOR_PRO`); a 7-day trial is configured on its checkout. **Connect Prices needed only when the corresponding tier is sold.**

**Local testing:** `stripe listen --forward-to localhost:3000/api/webhooks/stripe-creator-pro` (run a second `stripe listen` for the escrow path) → paste each `whsec_…` into the matching secret.

## 3. Social platforms (first-party — no Phyllo)
Each platform is independent; configure only what you've set up. **None of this is needed for the MVP** (suite off). The code is built; redirect URI for OAuth platforms is `https://<host>/api/connected/oauth/<platform>/callback`. ⚠️ The exact API field paths are implemented to each platform's documented shape (null-safe) but need a quick live check when you first connect a real account.

**YouTube — free, no app review (do first):**
1. Google Cloud Console → new project → enable **YouTube Data API v3**.
2. Create an **API key** → `YOUTUBE_API_KEY`. That's it — creators connect by entering their channel @handle/ID; the sync cron pulls public stats with the key.
3. (Optional, later) For private analytics: enable the **YouTube Analytics API**, create an **OAuth client ID** (`GOOGLE_OAUTH_CLIENT_ID`/`SECRET`), add the redirect URI, and pass Google verification.

**Instagram — Meta app (slow gate, ~4–8 wks):**
1. Meta for Developers → create a **Business** app → add **Instagram** + **Facebook Login**.
2. **Business Verification** + **domain verification**; add the redirect URI.
3. Request `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `business_management`; submit **App Review** with a demo screencast (I'll draft the write-up).
4. Provide privacy-policy + data-deletion URLs (I'll build the pages). Paste **`META_APP_ID`** / **`META_APP_SECRET`**.
5. Creators must have a **Business/Creator IG account linked to a Facebook Page**.

**TikTok — Login Kit app (days–weeks):**
1. TikTok for Developers → create app → configure **Login Kit**; add the redirect URI.
2. Request scopes `user.info.basic`, `video.list` (+ analytics scopes); submit for review with a demo.
3. Provide privacy/terms URLs. Paste **`TIKTOK_CLIENT_KEY`** / **`TIKTOK_CLIENT_SECRET`**.

**Built-in cost control:** connecting is gated to active **Creator Pro** (free creators never hit any API); lapsed Pro freezes sync (history kept); disconnect deletes stored tokens; the whole layer no-ops unless `NEXT_PUBLIC_ANALYTICS_SUITE=true`. **First live check:** after adding a platform's keys, connect your own account, run `/api/cron/sync-connected` (with `CRON_SECRET`), and confirm `account_snapshots`/`post_snapshots` have real numbers; if a field is null, adjust that adapter's field path (`lib/analytics/adapters/<platform>.ts`).

## 4. Anthropic
- **API key:** console.anthropic.com → set `ANTHROPIC_API_KEY` (server-only, Vercel).
- **Models used:** `claude-haiku-4-5` (batch summaries, weekly reports, campaign recaps — cheap), `claude-sonnet-4-6` (interactive coach / content lab / brand coach). Set in `lib/ai/client.ts`.
- **Cost control (built in):** prompt caching on the stable system prompt; weekly reports + campaign recaps skip regeneration when the underlying metrics are unchanged (`input_hash`); per-user rate limits on all AI routes; bounded `max_tokens`; AI runs only when the suite + `NEXT_PUBLIC_AI_GROWTH_COACH` are on and a key is present (else routes 404/503, crons no-op — no spend).

## 5. Resend
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (e.g. `hello@collabr.sg`). Verify the sending domain in Resend; add the SPF + DKIM DNS records it gives you. Supabase auth emails can use Supabase's built-in SMTP or your Resend domain — no extra SMTP wiring required by this feature set.

## 6. Vercel
- **Env vars** (Production + Preview) — the full list is at the bottom of this guide.
- **Feature flags** — see §8.
- **Crons** deploy from `vercel.json`. New: `recompute-certified` (needs `037`), `sync-connected` + `rollups` (need `039`/`042`/`043` + a configured platform for real data; no-op without the suite), `ai-reports` (needs Anthropic + suite). `NEXT_PUBLIC_APP_URL` must be your live URL.
- **Deployment checklist:** push branch → set all env → apply migrations on the prod DB → confirm crons listed in the Vercel Crons tab → smoke-test the Stripe webhooks → flip flags.

## 7. Cloudflare / DNS
- Point the domain to Vercel (per Vercel → Domains). Add Resend SPF/DKIM. Ensure `NEXT_PUBLIC_APP_URL` exactly matches the live origin (checkout returns + emails depend on it).

## 8. Feature flags
| Flag | Controls | Beta | Production (analytics live) |
|---|---|---|---|
| **`NEXT_PUBLIC_ANALYTICS_SUITE`** | **Master switch** — all analytics/Creator Pro/Connected/AI. OFF = original product; overrides every flag below. | `false` | `true` |
| `NEXT_PUBLIC_CREATOR_PRO` | Creator Pro upgrade + checkout + Studio gate | `false` | `true` |
| `NEXT_PUBLIC_CONNECTED_CREATOR` | ⭐ badge + connect flow + brand Connected analytics | `false` | `true` (after ≥1 platform set up) |
| `NEXT_PUBLIC_CREATOR_STUDIO` | Studio nav + pages | `false` | `true` |
| `NEXT_PUBLIC_AI_GROWTH_COACH` | AI coach/lab/brand-coach/recap | `false` | `true` (after Anthropic) |
| `NEXT_PUBLIC_COLLABR_CERTIFIED` | 🛡️ Certified badge + filter (**independent of suite**) | your call | `true` |
| `BETA_FREE_PRO` | Brand Pro free in beta | `true` | `false` when charging brands |
| `BETA_FREE_PLUS` | Brand Plus/Discovery free in beta (else gated) | `false` | `false` |

**Rule:** the master flag overrides the granular ones — with `NEXT_PUBLIC_ANALYTICS_SUITE=false`, Creator Pro/Connected/Studio/AI are all off even if their granular flags are `true`. **Brand Plus (Creator Discovery) is NOT part of the suite** — discovery stays Plus-gated regardless; only Plus *analytics* (Connected + campaign) require the suite. **Commission (charged to the creator, never the brand):** suite ON → Creator Free 10% / Creator Pro 8%; suite OFF → flat 10% for everyone (no Pro benefit exposed). *(Note: this differs from the pre-analytics commit, which keyed commission on the brand plan; the current model bills the creator, so suite-OFF is the 10% free rate, not the old behaviour.)*

## 9. Manual QA
**Auth:** signup/login/verify unaffected. **Escrow & barter:** fund → draft → approve → release; barter accept→complete — unchanged. **Reviews/disputes/onboarding:** unaffected.

**Commission:** suite ON — free creator paid collab → `platform_fee` = 10%; Pro creator → 8%; brand plan irrelevant. Suite OFF — everyone 10%.

**Brand Free/Pro/Plus:** beta → all brands Pro Beta (barter ok, Discovery gated unless `BETA_FREE_PLUS`). Paid mode → Free unlimited paid campaigns, no barter/discovery; Plus checkout unlocks Discovery (+ analytics when suite on).

**Creator Free/Pro:** non-Pro → overview upgrade card (suite on); `/studio` locked. Pro checkout (card `4242…`) → trial → `/studio` full. Cancel → after period read-only. Stripe IDs only in `creator_subscriptions`.

**Creator Discovery:** Plus brand can search/save/invite **with suite OFF** (discovery independent of suite).

**Analytics suite OFF:** no Creator Pro UI, no Studio (nav hidden, `/studio` redirects), no badges, no connect flow, no AI, no landing USP, no brand Connected/campaign analytics; analytics routes 404, crons no-op, Brand Plus = Discovery only.

**Analytics suite ON:** granular flags control each surface.

**Connected sync (suite on + ≥1 platform configured):** creator connects (YouTube channel handle, or Instagram/TikTok OAuth) → `connected_accounts` (+ tokens for OAuth platforms) → `sync-connected` writes snapshots → `rollups` builds creator_rollups + content_dna + campaign_rollups (for posts whose live URL matched a collab) → ⭐ badge + brand Connected analytics + campaign analytics appear. Lapse Pro → frozen, history kept, Studio read-only. Disconnect → tokens deleted, history kept.

**Campaign analytics:** Plus brand opens a campaign → totals/CPV/CPE/platform/per-creator/top-post; partial coverage banner names creators who haven't connected; never estimates missing data.

**AI (suite on + key):** Growth Coach / Content Lab / Brand Coach / Campaign Recap return real, self-referential output; "Not enough data yet" on thin data; guard blocks comparison/score/guarantee; `ai-reports` cron generates weekly reports (skips unchanged).

**Crons:** hit each with `Authorization: Bearer $CRON_SECRET`; analytics crons no-op when suite off. **Emails:** verification + collab notifications send via Resend.

---

## Full env var list (Vercel + `.env.local`)
```
# Core
NEXT_PUBLIC_SUPABASE_URL=  NEXT_PUBLIC_SUPABASE_ANON_KEY=  SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=  CRON_SECRET=
# Stripe
STRIPE_SECRET_KEY=  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  STRIPE_WEBHOOK_SECRET=
STRIPE_CREATOR_PRO_PRICE_MONTHLY=  STRIPE_CREATOR_PRO_PRICE_ANNUAL=  STRIPE_CREATOR_PRO_WEBHOOK_SECRET=
STRIPE_BRAND_PRO_PRICE_MONTHLY=  STRIPE_BRAND_PRO_PRICE_ANNUAL=  STRIPE_PRO_PRICE_ID=
STRIPE_BRAND_PLUS_PRICE_MONTHLY=  STRIPE_BRAND_PLUS_PRICE_ANNUAL=
STRIPE_BOOST_PRICE_MONTHLY=  STRIPE_BOOST_PRICE_PER_APP=
# Social platforms (first-party — only when suite is on; each independent)
YOUTUBE_API_KEY=
GOOGLE_OAUTH_CLIENT_ID=  GOOGLE_OAUTH_CLIENT_SECRET=
META_APP_ID=  META_APP_SECRET=
TIKTOK_CLIENT_KEY=  TIKTOK_CLIENT_SECRET=
# Anthropic
ANTHROPIC_API_KEY=
# Email
RESEND_API_KEY=  RESEND_FROM_EMAIL=
# Flags
NEXT_PUBLIC_ANALYTICS_SUITE=false   # master switch
BETA_FREE_PRO=true  BETA_FREE_PLUS=false  NEXT_PUBLIC_COLLABR_CERTIFIED=false
NEXT_PUBLIC_CREATOR_PRO=false  NEXT_PUBLIC_CONNECTED_CREATOR=false
NEXT_PUBLIC_CREATOR_STUDIO=false  NEXT_PUBLIC_AI_GROWTH_COACH=false
```
