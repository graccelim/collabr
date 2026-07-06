# Collabr — Go-Live Checklist (Phase 1: no creator analytics)

Everything to switch from test/sandbox to live production. Phase 1 ships the
**marketplace + self-reported results**, with the **creator analytics suite OFF**
(waiting on platform approvals).

> Legend: 🔴 change to live · 🟠 set/verify a value · 🟢 keep (confirm it's the prod value) · ⚪ leave as-is (unused in Phase 1)

---

## 0. Before you touch anything
- [ ] Do all env changes in **Vercel → collabr → Settings → Environment Variables → Production**.
- [ ] After changing any `NEXT_PUBLIC_*` var, **redeploy** (they're baked at build time).
- [ ] Merge/confirm `main` is the deploy branch (production builds from `main`).

---

## 1. Stripe (test → live) 🔴
The only true "sandbox → live" flip. Toggle Stripe to **Live mode** (top-left in the dashboard) before copying anything.

**Keys**
- [ ] `STRIPE_SECRET_KEY` → `sk_live_…`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_…`
- [ ] Rotate both (the test key appeared in chat/dev — good practice before launch).

**Products & prices** — recreate in Live mode, then paste the new `price_…` IDs:
| Env var | Amount (S$) |
|---|---|
| `STRIPE_BRAND_PRO_PRICE_MONTHLY` / `_ANNUAL` | 39 / 390 |
| `STRIPE_BRAND_PLUS_PRICE_MONTHLY` / `_ANNUAL` | 59 / 590 |
| `STRIPE_BRAND_PLUS_BETA_PRICE_MONTHLY` / `_ANNUAL` | 30 / 300 |
| `STRIPE_BOOST_PRICE_MONTHLY` / `STRIPE_BOOST_PRICE_PER_APP` | 20 / 5 |

> These must match the **display** prices in `lib/pricing.ts` (§6). Display ≠ charge — the charge is whatever the Stripe price is set to.

**Webhook** (the go-live checklist flagged this — you only have a test endpoint)
- [ ] Create a **live** webhook endpoint: `https://www.joincollabr.com/api/webhooks/stripe`
- [ ] Subscribe to these 12 events (exactly what the handler processes):
  `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`,
  `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`,
  `refund.updated`, `transfer.reversed`, `checkout.session.completed`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `account.updated`
- [ ] Copy its signing secret → `STRIPE_WEBHOOK_SECRET`
- [ ] Code already handles duplicate / delayed / out-of-order deliveries (idempotent) — no code change needed.
- [ ] ⚪ Do NOT create the Creator Pro webhook in Phase 1. When analytics launches, add a
  SEPARATE endpoint `…/api/webhooks/stripe-creator-pro` (events: `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`) → its own secret `STRIPE_CREATOR_PRO_WEBHOOK_SECRET`.

**Connect (creator payouts = Stripe Connect Express + transfers)**
- [ ] **Activate Connect in Live mode** — Stripe → Connect → Settings: complete the platform/business
  profile, set the payout **statement descriptor** + branding. Express onboarding fails in live until this is done.
- [ ] Confirm the live secret key has Connect enabled (Express account creation + `account_onboarding` links).
- [ ] ⚪ Skip `STRIPE_CREATOR_PRO_PRICE_*` and `STRIPE_CREATOR_PRO_WEBHOOK_SECRET` — analytics tier, off in Phase 1.

**End-to-end live payout test (do this before launch — the #1 flow to validate)**
- [ ] As a real creator: complete Stripe **Express onboarding** in live (real bank/debit).
- [ ] As a brand: fund a small real collab (e.g. S$1–5) with a live card.
- [ ] Approve the live post (or wait for 72h auto-release).
- [ ] Verify: brand funds **captured**, **transfer** created to the creator's Express account,
  collab → `paid`/completed, creator gets the "X transferred" notification, and the balance shows in
  the creator's Stripe Express dashboard → pays out to their bank on schedule.
- [ ] (Optional) Test the not-connected path: approve before the creator connects → confirm `transfer_failed`
  + the "Connect your payout account" nudge, then connect → confirm the retry pays them.

---

## 2. Feature flags 🟠 (most important step)
| Var | Set to | Why |
|---|---|---|
| `NEXT_PUBLIC_ANALYTICS_SUITE` | **`false`** | Master off-switch for ALL creator analytics. #1 change. |
| `ALLOW_MOCK_IN_PROD` | **`false`** or delete | ⚠️ Must not be true in prod — would show fake data. |
| `BOOST_UI_PREVIEW` | `false` or delete | Demo/preview flag. |
| `NEXT_PUBLIC_ANALYTICS_AI`, `NEXT_PUBLIC_AI_GROWTH_COACH`, `NEXT_PUBLIC_CREATOR_STUDIO`, `NEXT_PUBLIC_CONNECTED_CREATOR`, `NEXT_PUBLIC_CREATOR_PRO` | `false` | Analytics sub-flags (already dead with suite off; set false for cleanliness). |
| `BETA_FREE_PRO` | keep **`true`** | Brands get Pro free during launch. |
| `NEXT_PUBLIC_COLLABR_CERTIFIED` | keep (`true`) | Marketplace "Certified" badge + filter — NOT analytics. Dormant until creators earn it. |

---

## 3. Supabase (production project) 🟢
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` point to the **prod** project.
- [ ] **Run ALL migrations, now up to and including:**
  - `049_collab_results.sql` (self-reported results won't work without it)
  - `050_campaign_platforms.sql` — **required before this deploy**: campaign create/edit now
    persists the Platforms field and will error inserting without the column.
  - `051_durable_rate_limits.sql` — DB-backed rate limiting (signup/invites/boost/AI).
    Code fails open to the in-memory limiter until applied, but apply it.
- [ ] Confirm RLS is on (migrations set this).

---

## 4. Email — Resend 🟠
- [ ] `RESEND_API_KEY` = live key (you already have this if prod emails send today).
- [ ] Add + **verify a sending domain** in the Resend dashboard (e.g. `joincollabr.com`: add the SPF/DKIM DNS records → status "Verified").
- [ ] `RESEND_FROM_EMAIL` = an address on that verified domain (e.g. `hello@joincollabr.com`).
  - If left unset it falls back to `onboarding@resend.dev` (Resend's shared test sender) — unbranded and worse deliverability. Set it.

---

## 5. Core app config 🟢
- [ ] `NEXT_PUBLIC_APP_URL` = `https://www.joincollabr.com` (exact, `www`, no trailing slash).
- [ ] `CRON_SECRET` = strong random (also powers the results-reminder cron). Crons are registered in `vercel.json`.
- [ ] Optional tuning (leave unset for safe defaults): `RESULTS_REMINDER_DAYS` (14), `PAYOUT_GRACE_DAYS`, `PAYOUT_REMINDER_DAYS`, `BETA_FREE_PLUS` (unset → Plus stays paid).

---

## 6. Pricing (display) — must match Stripe (§1)
Source of truth: `lib/pricing.ts` (already updated).
| Tier | Monthly | Annual |
|---|---|---|
| Brand Pro | S$39 | S$390 |
| Brand Plus | S$59 | S$590 |
| Brand Plus (beta) | S$30 | S$300 |
| Creator Pro | S$14.99 | S$149 |
| Boost | per-post S$5 | 30-day S$20 |

- [ ] Every Stripe **live** price above equals the display amount here.

---

## 7. Not needed in Phase 1 ⚪ (analytics off — leave as-is, no action)
`TIKTOK_CLIENT_KEY/SECRET`, `META_APP_ID/SECRET`, `INSTAGRAM_APP_ID/SECRET`,
`GOOGLE_CLIENT_ID/SECRET`, `YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY`.
- [ ] When you DO enable analytics later, **rotate** the Google / TikTok / Instagram secrets first (they appeared in dev/chat).

---

## 8. Deploy & verify
- [ ] Save all env changes → **Redeploy** production.
- [ ] Landing loads; sign up as a brand → Pro shows "Free during beta".
- [ ] Create a campaign → fund a collab with a **live** card (small amount) → payout releases.
- [ ] A completed collab shows the "Add results" form (creator) and the brand sees "Reported results" + the campaign aggregate.
- [ ] Emails arrive from your verified domain (welcome / notifications).
- [ ] Confirm no analytics UI is visible anywhere (suite off).
