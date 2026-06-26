# Collabr — Infrastructure Audit (single source of truth)

> Generated from the current codebase only (no guessing). No code changed.
> "Applied?" for migrations and "do I have it?" for env vars can't be read from
> here without DB/secret access — those columns say what to verify and where.

---

## Part 1 — Stripe products / flows

| Flow | One-time vs sub | Checkout route | Webhook endpoint | Webhook secret | Price env | Metadata | Status | Beta-gated? |
|---|---|---|---|---|---|---|---|---|
| **Paid campaigns / Escrow** | one-time (manual-capture PaymentIntent) | `app/api/payments/create-intent` (+ `StripePaymentButton`) | `/api/webhooks/stripe` | `STRIPE_WEBHOOK_SECRET` | — (amount is the collab `agreed_rate`) | `creator_payout`, `platform_fee` on the PaymentIntent | **Live** | No |
| **Boost** (paid placement) | one-time (`mode: payment`) | `app/api/payments/boost-creator` | `/api/webhooks/stripe` (`checkout.session.completed` + `metadata.kind=boost`) | `STRIPE_WEBHOOK_SECRET` | `STRIPE_BOOST_PRICE_MONTHLY`, `STRIPE_BOOST_PRICE_PER_APP` | `kind=boost`, `creator_id`, `boost_type`, `days` | **Built; off unless price set** (`boostEnabled()`); UI-preview via `BOOST_UI_PREVIEW` | Gated by config |
| **Brand Pro** | subscription | `app/api/billing/checkout` (+ `app/api/billing/portal`) | `/api/webhooks/stripe` (`applySubscriptionToBrand`) | `STRIPE_WEBHOOK_SECRET` | `STRIPE_PRO_PRICE_ID` | `brand_id` | **Built & complete, dormant** (checkout 409s while `BETA_FREE_PRO` on) | **Yes — free in beta** |
| **Brand Plus** | subscription | — | — | — | — | — | **Not built** (no tier in code) | n/a |
| **Creator Pro** | subscription | `app/api/billing/creator-pro/checkout` | `/api/webhooks/stripe-creator-pro` (isolated) | `STRIPE_CREATOR_PRO_WEBHOOK_SECRET` | `STRIPE_CREATOR_PRO_PRICE_MONTHLY/ANNUAL` | `kind=creator_pro`, `creator_id` | **Built this session** (checkout + isolated webhook + gate); needs prices+secret+migration to run | Gated by `NEXT_PUBLIC_CREATOR_PRO` + config |

**Duplicate/shared logic:**
- The escrow webhook `/api/webhooks/stripe` is **multi-purpose**: escrow PaymentIntents + Boost + **Brand subscriptions** all live there.
- **Near-duplicate logic across the two webhooks:** `applySubscriptionToBrand` (escrow webhook) and `applySubscription` (creator-pro webhook) both map Stripe status → plan/state. Safe to extract a shared `stripeStatus→state` helper (and a shared `createSubscriptionCheckout` factory). **Do not merge the endpoints** — see Part 3.

---

## Part 2 — Environment variables (every one referenced in code)

Legend: ✅ in `.env.local` · ⚠️ referenced but **missing from `.env.local`** · 🗑️ in `.env.example` but **unused in code** · ❓ verify.

| Variable | Used in | Req? | Env | Feature | In `.env.local`? | Need to create? |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | supabase clients | required | both | core | ✅ | have |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase clients | required | both | core | ✅ | have |
| `SUPABASE_SERVICE_ROLE_KEY` | `createAdminClient` (crons, webhooks, admin reads) | **required** | both | core/admin | ⚠️ **missing locally** | **YES — add locally; set in Vercel** |
| `CRON_SECRET` | all 11 cron routes | required (prod) | prod | crons | ✅ | have |
| `NEXT_PUBLIC_APP_URL` | checkout success/cancel URLs, emails | required | both | billing/email | ⚠️ missing locally (falls back to localhost:3000) | set in Vercel (prod URL) |
| `STRIPE_SECRET_KEY` | `lib/stripe` | required | both | all Stripe | ✅ | have |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client Stripe (Payment Element) | required | both | escrow pay | ✅ | have |
| `STRIPE_WEBHOOK_SECRET` | `/api/webhooks/stripe` | required | both | escrow+boost+brand sub | ✅ | have |
| `STRIPE_CREATOR_PRO_WEBHOOK_SECRET` | `/api/webhooks/stripe-creator-pro` | required (for Creator Pro) | both | Creator Pro | ⚠️ missing | **YES — from the new Stripe endpoint** |
| `STRIPE_CREATOR_PRO_PRICE_MONTHLY` | creator-pro checkout | required (Creator Pro) | both | Creator Pro | ✅ | have |
| `STRIPE_CREATOR_PRO_PRICE_ANNUAL` | creator-pro checkout | required (Creator Pro) | both | Creator Pro | ✅ | have |
| `STRIPE_PRO_PRICE_ID` | brand `billing/checkout` | required when brand Pro paid | both | Brand Pro | ⚠️ missing | create when leaving beta (see Part 4) |
| `STRIPE_BOOST_PRICE_MONTHLY` | `lib/stripe` boost | optional | both | Boost | ⚠️ missing | only if enabling Boost |
| `STRIPE_BOOST_PRICE_PER_APP` | `lib/stripe` boost | optional | both | Boost | ⚠️ missing | only if enabling Boost |
| `RESEND_API_KEY` | `lib/email` | required (email send) | both | email | ⚠️ missing locally | set in Vercel |
| `RESEND_FROM_EMAIL` | `lib/email` | optional (defaults `onboarding@resend.dev`) | both | email | ⚠️ missing | set in Vercel |
| `PAYOUT_REMINDER_DAYS` | `cron/payout-stuck` | optional (default 2) | prod | payouts | ⚠️ | optional |
| `PAYOUT_GRACE_DAYS` | `cron/payout-stuck` | optional (default 7) | prod | payouts | ⚠️ | optional |
| `BETA_FREE_PRO` | `lib/plans` | optional (**defaults ON**) | both | Brand plan beta | ⚠️ (unset = beta on) | leave unset/true for beta |
| `BOOST_UI_PREVIEW` | `lib/stripe` | optional | dev | Boost preview | ✅ | dev only |
| `CREATOR_PRO_UI_PREVIEW` | `lib/stripe` | optional | dev | Creator Pro preview | ⚠️ | dev only |
| `NEXT_PUBLIC_COLLABR_CERTIFIED` | `lib/flags` | optional | both | Certified badge | ⚠️ | set `true` to launch Phase 1 |
| `NEXT_PUBLIC_CREATOR_PRO` | `lib/flags` | optional | both | Creator Pro UI | ⚠️ | set `true` to launch Phase 2 |
| `NEXT_PUBLIC_CONNECTED_CREATOR` | `lib/flags` | optional | both | Connected badge | ⚠️ | Phase 3 |
| `NEXT_PUBLIC_CREATOR_STUDIO` | `lib/flags` | optional | both | Studio | ⚠️ | Phase 4 |
| `NEXT_PUBLIC_AI_GROWTH_COACH` | `lib/flags` | optional | both | AI | ⚠️ | Phase 5 |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | — | — | — | (intended social) | 🗑️ in `.env.example`, **unused in code** | ignore until Phyllo/social |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | — | — | — | (intended social) | 🗑️ unused in code | ignore until Phyllo |
| `STRIPE_CONNECT_CLIENT_ID` | — | — | — | Connect payouts | 🗑️ in `.env.example`, **not referenced** | ❓ verify Connect onboarding still works without it (it uses account links) |
| `PHYLLO_CLIENT_ID` / `PHYLLO_SECRET` | **comment only** (`adapters/index.ts`) | — | — | Phyllo (Phase 3) | not yet | create at Phase 3 |
| `VERCEL_OIDC_TOKEN` | Vercel-managed | auto | — | platform | ✅ | auto |

**Most urgent gap:** `SUPABASE_SERVICE_ROLE_KEY` is **missing from `.env.local`** — admin client, all crons, and both webhooks need it locally to test.

---

## Part 3 — Webhooks

| Endpoint | Purpose | Events | Secret | Active | Overlap |
|---|---|---|---|---|---|
| `/api/webhooks/stripe` | Escrow + Boost + **Brand** subscriptions | `payment_intent.amount_capturable_updated/succeeded/payment_failed/canceled`, `charge.refunded`, `refund.updated`, `transfer.reversed`, `account.updated`, `checkout.session.completed`, `customer.subscription.created/updated/deleted` | `STRIPE_WEBHOOK_SECRET` | Live | Shares `checkout.session.completed` + `customer.subscription.*` **names** with the creator endpoint |
| `/api/webhooks/stripe-creator-pro` | **Creator** subscriptions (isolated) | `checkout.session.completed`, `customer.subscription.created/updated/deleted` | `STRIPE_CREATOR_PRO_WEBHOOK_SECRET` | Built (needs secret) | same event names, **different Stripe endpoint** |

**Overlap verdict — keep isolated (recommended):** Each Stripe endpoint only receives the events for the endpoint you configure, and each handler is guarded by metadata (escrow → `brand_id`; creator → `kind=creator_pro`/`creator_id`) **and uses different Stripe customers**, so they can't corrupt each other. **Safety note:** `applySubscriptionToBrand` falls back to matching by `stripe_customer_id` when `brand_id` is absent — harmless today (creator customers never match a brand row), but it means you must **not** subscribe the escrow endpoint to creator events (and vice-versa). Keep the two endpoints pointed at their own events.

---

## Part 4 — Stripe dashboard checklist (what should exist after setup)

**Now (Creator Pro launch):**
- [ ] **Product:** "Creator Pro".
  - [ ] Recurring **Price** — monthly (S$14.90) → `STRIPE_CREATOR_PRO_PRICE_MONTHLY` ✅ already in env.
  - [ ] Recurring **Price** — annual (S$149) → `STRIPE_CREATOR_PRO_PRICE_ANNUAL` ✅ already in env.
- [ ] **Webhook endpoint:** `https://<prod>/api/webhooks/stripe-creator-pro` → events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` → copy signing secret to `STRIPE_CREATOR_PRO_WEBHOOK_SECRET`.
- [ ] **Customer Portal:** enable in Stripe (Billing → Customer portal) so creators can cancel/manage. (A creator portal route isn't built yet — Brand uses `/api/billing/portal`; a creator portal route is a small later add.)

**Verify (already wired in code, may already exist):**
- [ ] Escrow uses Connect — confirm **Stripe Connect** is enabled and the existing escrow webhook endpoint exists for the prod domain with the PaymentIntent/charge/refund/transfer/account events + `STRIPE_WEBHOOK_SECRET`.
- [ ] **Boost** prices only if you enable Boost (`STRIPE_BOOST_PRICE_*`).

**Later (leaving beta / Brand tiers):**
- [ ] **Brand Pro** Price → `STRIPE_PRO_PRICE_ID`; set `BETA_FREE_PRO=false` to activate.
- [ ] **Brand Plus** Product + Prices (new env `STRIPE_BRAND_PLUS_PRICE_*`) — code not built yet.

**Tax/Billing settings:** Stripe Tax optional (SG GST if registered) — not required to launch; enable in Stripe → Tax if needed.

---

## Part 5 — Supabase migrations & crons

**Migrations present:** `001` → `039` (39 files). Rollbacks exist only for `002`–`018` (gaps after).
- `001`–`036`: pre-existing — **assume applied** in your environments if the app runs today; **confirm in Supabase**.
- `037_collabr_certified`, `038_creator_pro`, `039_connected_analytics`: **NEW this session — NOT applied yet.** Apply in order.
- None are "safe to skip"; none are deprecated. Apply `037`→`038`→`039` before launching their features.

**Crons (vercel.json, 11) → migration dependency:**
| Cron | Depends on |
|---|---|
| `auto-approve-drafts`, `auto-release-live` | collabs workflow (`001`/`005`) |
| `expire-invites` | campaign_invites (`009`,`016`) |
| `expire-applications` | applications (`001`,`024`) |
| `expire-funding` | funding deadline (`024`) |
| `expire-boosts` | boost columns (`010`) |
| `update-ratings` | reviews/ratings (`001`) |
| `payout-stuck` | payout fallback (`029`) |
| `notify-expiring` | invites/applications |
| `recompute-scores` | `014_creator_scores` (+`035`) |
| **`recompute-certified`** | **`037` (must be applied or this cron 500s)** |

---

## Part 6 — Feature flags

| Flag | true | false | Recommended (beta) |
|---|---|---|---|
| `BETA_FREE_PRO` (default ON) | every brand = "Pro Beta" free, no Stripe; brand checkout 409s | brands resolve Free/Pro by real subscription; brand checkout active | **leave ON (unset/true)** → Brand Pro free in beta ✅ |
| `NEXT_PUBLIC_COLLABR_CERTIFIED` | 🛡️ badge + brand filter visible | hidden (cron still computes data harmlessly) | your call — **true** to launch Phase 1 |
| `NEXT_PUBLIC_CREATOR_PRO` | upgrade card + checkout button show | hidden; checkout still gated by price config | **true** once Stripe prices+webhook live |
| `NEXT_PUBLIC_CONNECTED_CREATOR` | ⭐ Connected badge + connect UI show | hidden | **false** (Phase 3 not built) |
| `NEXT_PUBLIC_CREATOR_STUDIO` | Studio nav/surfaces show | `/studio` still gated by entitlements | **false** until Phase 4 |
| `NEXT_PUBLIC_AI_GROWTH_COACH` | AI surfaces show | hidden | **false** until Phase 5 |
| `boostEnabled()` (config: `STRIPE_BOOST_PRICE_*`) | Boost purchasable + ranking bump | Boost hidden | off unless you sell Boost |
| `BOOST_UI_PREVIEW` / `CREATOR_PRO_UI_PREVIEW` | render UI without real prices (dev) | normal | dev only |
| `analyticsConfigured()` (`adapters/index`) | returns adapter | **hardcoded false** (Phase 3 stub) | leave until Phyllo |

**Recommended beta config:** `BETA_FREE_PRO` on (Brand Pro free), Brand Plus not built (gated by absence), `NEXT_PUBLIC_CREATOR_PRO` true only after Stripe setup, Connected/Studio/AI flags **false**.

---

## Part 7 — Billing architecture (flows)

```
BRAND FREE / PRO (today, beta):
  resolvePlan(brand)  ── BETA_FREE_PRO on ─▶ everyone "Pro Beta" (free)
                       └─ off ─▶ Free unless brand_profiles.plan='pro' & status active/cancelled-in-period/grandfathered
  Paid path (when beta off): /api/billing/checkout (STRIPE_PRO_PRICE_ID, mode:subscription, meta.brand_id)
        → Stripe Checkout → /api/webhooks/stripe (applySubscriptionToBrand) → brand_profiles.plan/subscription_status
        → gates: lib/plans.proGateResponse / resolvePlan.isPro (Discovery, Invites, Saved, Barter)

BRAND PLUS:  NOT IMPLEMENTED (no tier, no price, no gate).

CREATOR FREE / PRO (this session):
  /api/billing/creator-pro/checkout (STRIPE_CREATOR_PRO_PRICE_*, mode:subscription, meta.creator_id, 7-day trial)
     → Stripe Checkout → /api/webhooks/stripe-creator-pro (applySubscription) → creator_subscriptions(status, pro_until,…)
     → entitlements.proState → studioAccess (full/read_only/locked); shouldSyncAccount/canGenerateAI
     → /studio gate; CreatorProUpgradeCard
```

**Inconsistencies / dead code / things to resolve (for the monetisation work, NOT this audit):**
1. **🔴 Commission is keyed on the BRAND plan, at pro=8%.** `lib/utils.computeFee(rate, plan)` reads `campaigns.brand_profiles.plan` (`applications/[id]`, `invites/[id]`) with rates **free 12% / pro 8%**. Your new model says the fee comes from the **creator** (Free 12% / Creator Pro **10%**) and brand tier must **not** affect it. **This is the single biggest change** the monetisation update requires — and it touches collab-creation fee math (adjacent to payments). `COMMISSION_RATES={free:0.12,pro:0.08}` in `lib/stripe.ts` is currently unused by `computeFee` (which hardcodes 0.08/0.12) → **`COMMISSION_RATES` is effectively dead/duplicate.**
2. **Two parallel subscription models:** brands use `brand_profiles.plan` + `resolvePlan` (+ beta flag); creators use `creator_subscriptions` + `entitlements`. Fine to keep separate; share the status-mapper.
3. **Brand Plus** absent everywhere — `brand_profiles.plan` enum is `('free','pro')` only.

---

## Part 8 — Security audit

| Check | Result |
|---|---|
| Creator billing private | ✅ `creator_subscriptions` is owner-read RLS, service-write; Stripe IDs never on a public table. |
| Creator badge data | ✅ `creator_profiles.certified/connected/connected_platforms/insights_last_synced_at` are non-sensitive; sensitive certification detail is in private `collabr_certification`. |
| **Brand billing private** | **🔴 RISK.** `brand_profiles` is **public-read** (`brand_public_select`) and holds `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_current_period_end`. RLS is row-level (can't hide columns), so a direct client `select` of those columns may be readable. **Verify the `authenticated`/`anon` grants and whether anything queries these client-side; recommend moving brand Stripe/subscription columns into a private `brand_subscriptions` table (same pattern as creators)** during the monetisation refactor. |
| Webhook verification | ✅ Both webhooks verify `stripe-signature` via `constructEvent` with their own secret; reject missing sig/secret. |
| Payment logic untouched | ✅ Creator Pro added a **separate** checkout + **isolated** webhook; escrow webhook, PaymentIntents, disputes, transfers unchanged. |
| Cron auth | ✅ All crons require `Bearer ${CRON_SECRET}`. |
| Idempotency | ✅ Escrow webhook uses `stripe_events` insert-and-claim; creator webhook is idempotent via state upsert. |

---

## Part 9 — Final launch checklist (manual)

**Stripe**
- [ ] Create "Creator Pro" product + monthly + annual recurring Prices (IDs already in env).
- [ ] Add webhook endpoint `…/api/webhooks/stripe-creator-pro` (4 subscription events) → `STRIPE_CREATOR_PRO_WEBHOOK_SECRET`.
- [ ] Confirm existing escrow webhook endpoint exists for prod domain (`STRIPE_WEBHOOK_SECRET`) + Connect enabled.
- [ ] Enable Customer Portal.
- [ ] (Later) Brand Pro price + `BETA_FREE_PRO=false`; Brand Plus product (not built).

**Supabase**
- [ ] Apply migrations `037`, `038`, `039` (in order) to staging then prod.
- [ ] Confirm `001`–`036` already applied.
- [ ] Verify RLS on `creator_subscriptions` (owner-only) and review `brand_profiles` public-read column exposure (Part 8 🔴).

**Vercel**
- [ ] Set all prod env vars (Part 2) — especially `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `STRIPE_CREATOR_PRO_WEBHOOK_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`.
- [ ] Confirm the 11 crons are registered (they deploy from `vercel.json`); new `recompute-certified` needs `037` applied.
- [ ] Set launch flags: `NEXT_PUBLIC_COLLABR_CERTIFIED=true`, `NEXT_PUBLIC_CREATOR_PRO=true` (others false).

**Resend**
- [ ] Verify sending domain; set `RESEND_API_KEY` + `RESEND_FROM_EMAIL`.

**Phyllo** — not this phase. (At Phase 3: create app, sandbox keys, webhook URL, `PHYLLO_*` env.)

**Anthropic** — not this phase. (At Phase 5: `ANTHROPIC_API_KEY`.)

**DNS / Cloudflare**
- [ ] Point prod domain to Vercel; verify `NEXT_PUBLIC_APP_URL` matches.
- [ ] Resend domain DNS (SPF/DKIM).

**Testing (needs live Supabase + Stripe test mode + browser)**
- [ ] Creator Pro: checkout → trial → `/studio` full; cancel → read-only; non-Pro → locked.
- [ ] Collabr Certified: apply `037`, run `/api/cron/recompute-certified?dry=1`, then real run, flip flag.
- [ ] Regression: escrow fund→draft→approve→release, disputes, reviews unaffected.
