# Collabr — Beta Launch Checklist

Work through this top-to-bottom before inviting real brands and creators.
Every unchecked box is a silently-disabled safety system.

---

## 1. Supabase

### Migrations (SQL editor, in this exact order)
- [ ] `001_initial_schema.sql`
- [ ] `002_database_integrity_constraints.sql`
- [ ] `003_rls_security_hardening.sql`
- [ ] `004_payment_truth_and_payouts.sql`
- [ ] `005_workflow_integrity.sql`
- [ ] `006_storage_security_and_signed_urls.sql`
- [ ] `007_trust_and_onboarding.sql`
- [ ] `008_profile_quality.sql`
- [ ] `009_creator_discovery.sql`
- [ ] `010_monetization_architecture.sql` (idempotent — safe to re-run; the
      final revision REVOKES subscription-column grants)

Rollbacks for 002–010 live in `supabase/rollbacks/` if a migration must be reversed.

### Auth
- [ ] **Authentication → Providers → Email → "Confirm email" is ON.**
      The app enforces `email_confirmed_at` before applying/creating campaigns/
      inviting; with this off, users auto-verify and that gate is a no-op.
- [ ] Site URL / redirect URLs include the production domain (email links,
      password reset, `/earnings?connect=...` return).

### Storage (created by migrations — verify in dashboard)
- [ ] `draft-submissions` — **private**, 500 MB limit, video/image MIME only
- [ ] `brand-assets` — public, 2 MB, images
- [ ] `avatars` — public, 2 MB, images
- [ ] Spot-check policies on `storage.objects`: `draft_creator_upload`,
      `brand_asset_owner_*`, `avatar_owner_*` and **nothing else** (006
      deliberately drops all dashboard-created policies).

### RLS verification (run as a signed-in NON-admin user via the browser console)
- [ ] `supabase.from('brand_profiles').select('subscription_status').limit(1)`
      → **permission error** (billing state is server-only)
- [ ] `supabase.from('users').select('email').neq('id', '<your-id>')`
      → returns **no rows** (emails protected)
- [ ] `supabase.from('collabs').select('*')` as a third party → no rows
- [ ] `supabase.from('stripe_events').select('*')` → permission error

---

## 2. Stripe

- [ ] **Webhook endpoint** → `https://<domain>/api/webhooks/stripe`, with events:
      `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`,
      `payment_intent.payment_failed`, `payment_intent.canceled`,
      `charge.refunded`, `refund.updated`, `transfer.reversed`, `account.updated`,
      `checkout.session.completed`, `customer.subscription.created`,
      `customer.subscription.updated`, `customer.subscription.deleted`
      (or "all events"). Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
- [ ] **Billing portal activated** (Settings → Billing → Customer portal) —
      `/api/billing/portal` errors until this is done. (Only matters in paid
      mode, but activate it now.)
- [ ] **Connect enabled** (Express accounts) — creator payouts use
      `stripe.transfers` to connected accounts; SGD supported.
- [ ] `STRIPE_PRO_PRICE_ID` — **not needed during beta.** Create the recurring
      Price and set the env var on the day `BETA_FREE_PRO` flips to `false`.
- [ ] **Test-mode rehearsal (mandatory, end-to-end):**
      1. Brand signs up, verifies email, posts a campaign
      2. Creator signs up (niche + social), verifies, connects Stripe (test),
         applies
      3. Brand selects → funds escrow with test Apple/Google Pay
         (`4242…` via wallet) → webhook flips `payment_status` to `funded`
      4. Creator submits draft → brand approves → creator submits live link
      5. Brand confirms → capture + transfer succeed → collab `completed`,
         `payment_status='paid'`, creator stats increment **once**
      6. Both sides leave reviews
      7. Replay the last webhook from the Stripe CLI → response shows
         `duplicate: true`, nothing changes
      8. Repeat once with a creator that has **no** Connect account →
         confirm `transfer_failed` (NOT `paid`), and the brand sees the
         payout-failed message
- [ ] Then one **live-mode** rehearsal with a real ~S$10 collab between your
      own accounts before any external user funds escrow.

---

## 3. Vercel

### Environment variables (Production + Preview)
| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | server-only — never `NEXT_PUBLIC_` |
| `STRIPE_SECRET_KEY` | ✅ | live key in Production only |
| `STRIPE_WEBHOOK_SECRET` | ✅ | per-endpoint |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | wallet payment button |
| `NEXT_PUBLIC_APP_URL` | ✅ | production URL — email links + Stripe redirects break on the localhost default |
| `CRON_SECRET` | ✅ | long random string; crons are useless without it |
| `BETA_FREE_PRO` | ✅ set `true` | only the literal `false` activates paid mode |
| `RESEND_API_KEY` | ⚠️ recommended | emails silently skip if missing |
| `RESEND_FROM_EMAIL` | ⚠️ recommended | verified sender domain |
| `STRIPE_PRO_PRICE_ID` | later | paid-mode launch day only |

### Crons (vercel.json — verify they appear in the Vercel dashboard)
- [ ] `auto-approve-drafts` — 48h draft auto-approval
- [ ] `auto-release-live` — 72h payment auto-release (**money moves here — this
      one being dead means creators don't get paid on brand silence**)
- [ ] `notify-expiring` — deadline warnings
- [ ] `expire-boosts`, `update-ratings`
- [ ] Confirm each returns 200 in cron logs after first run (401 = bad `CRON_SECRET`)

---

## 4. Launch-day operations

- [ ] Decide grandfathering policy now (do nothing during beta; on paid-mode
      day: `update brand_profiles set grandfathered_pro_until = now() + interval '60 days' where created_at < '<launch>'`)
- [ ] Bookmark a daily money-health query until alerting exists:
      ```sql
      select id, status, payment_status, payment_failure_reason
      from collabs
      where payment_status in ('capture_failed','transfer_failed','refund_failed','refund_pending')
         or (status = 'disputed');
      ```
      Anything here needs a human the same day.
- [ ] Create one admin user (`update users set role='admin' where id='…'`) and
      verify `/admin/disputes` loads.
- [ ] Smoke-test after each deploy: `npm test` (64+ unit tests) is green in CI
      or locally before pushing.
