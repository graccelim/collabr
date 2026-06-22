# Collabr — End-to-End QA Checklist

What I verified **automatically** (you don't need to re-test these in isolation):

- **235 unit tests pass** (`npx vitest run`) — covers: fee/cents math, capacity/spots
  math, rejection finality, barter vs rated-barter logic, workflow state derivation +
  escrow scale, open-redirect guard (`safeNextPath`), slug generation/collision,
  niche normalization, plan gating, contact-info moderation (chat + reviews), email
  templates, unselect/funding race guards.
- **`npx tsc --noEmit` clean**, **`npm run build` compiles** (60/60 pages).

Everything below needs a **real environment** (Supabase, Stripe test mode, email/SMTP,
storage, deployed crons, a browser) and so must be tested manually. Tagged:
🟢 happy · 🔴 sad/guard · 🟠 edge/concurrency.

> Recommended setup: Stripe **test mode**, two browsers/profiles (one brand, one
> creator) + one admin account, and the Stripe CLI (`stripe listen --forward-to`)
> to watch webhooks. Have a way to run crons manually (curl with the `CRON_SECRET`
> header).

---

## 1. Accounts, Auth & Onboarding

### Signup
- 🟢 Brand signup → receives verification email → clicks link → lands logged in → onboarding pre-filled → dashboard.
- 🟢 Creator signup (name, niches, ≥1 social w/ follower counts) → verify email → onboarding → dashboard.
- 🔴 Signup with an **email already registered** → friendly error, no duplicate user.
- 🔴 Signup **rate limit**: 6th signup from same IP within an hour → 429.
- 🔴 Brand signup with **no website and no social** → blocked ("website or social required").
- 🔴 Creator signup with a **social handle already taken** by another account → 409.
- 🟠 Two creators claim the **same @handle on the same platform** at once → exactly one wins; loser told to finish from dashboard.
- 🔴 **Email delivery failure** path (misconfigure SMTP once) → 503 "couldn't send verification email".

### Email verification & login
- 🟢 Resend verification email works; 🔴 4th resend within an hour → 429; 🔴 resend when already verified → 400.
- 🔴 **Unverified email** trying to create a campaign / apply / accept invite → blocked with "verify your email".
- 🟢 Login with correct credentials → dashboard (or the `?next=` page).
- 🔴 Login with wrong password → error, no session.
- 🟢 Logout clears session; back button does **not** restore an authed page (Cache-Control no-store).

### Password reset
- 🟢 Forgot password → email → reset link → set new password ≥8 chars → logged in.
- 🔴 Reset link **expired/invalid** → "this link has expired" screen.
- 🔴 New password < 8 chars or mismatch → inline error, not submitted.

### Route protection / redirects
- 🔴 Visit `/dashboard`, `/collabs`, `/profile`, etc. while logged out → redirect to `/login?next=…`.
- 🟠 **Open-redirect probes** on `next` (defense already unit-tested, but verify end-to-end): `//evil.com`, `/%2f%2fevil.com`, `\t//evil.com`, `https://evil.com` → all fall back to `/dashboard`, never navigate off-site.
- 🔴 Creator hitting brand-only routes (and vice versa) → redirected to dashboard.

### Profile editing
- 🟢 Creator edits bio/niches/rate/availability/portfolio/media-kit → saved; Save disabled until a real change.
- 🟢 Avatar upload (PNG/JPG/WebP ≤2MB); 🔴 oversized or wrong type rejected.
- 🟢 Add / remove / reorder socials; set primary; update follower count on blur.
- 🔴 Remove the **last** remaining social → blocked ("at least one required").
- 🟠 Remove the **primary** social when others exist → primary reassigns to the next one.
- 🟠 Rename display name → existing **slug stays the same** (slugs are immutable).
- 🔴 Bio/notes with **contact info** behavior where moderated; XSS string in bio renders escaped (no script execution).

---

## 2. Campaigns

- 🟢 Brand creates a **paid**, **barter**, and **both** campaign.
- 🔴 Create campaign without onboarding / unverified → blocked.
- 🔴 Free plan: **3rd active campaign** blocked (max 2); barter campaign gated off-beta. *(In beta `BETA_FREE_PRO=true` everything is allowed — confirm which mode you're testing.)*
- 🟢 Edit campaign content (title/brief/niches) → pending/shortlisted/selected applicants notified.
- 🔴 Lower `creators_needed` **below** current live collab count → blocked.
- 🔴 Change **comp_type** while live collabs exist → blocked.
- 🟢 Close campaign → all pending/shortlisted apps auto-rejected + notified; selected/funded collabs untouched.
- 🟢 Reopen a closed campaign (status flip only, no spurious notifications).
- 🟠 Public "spots remaining" counts **only funded** collabs; brand's own view shows funded + awaiting separately.

---

## 3. Applications (Creator → Campaign)

- 🟢 Apply with a valid pitch (+rate for paid/both) → shows "Applied".
- 🔴 Pitch < 30 or > 2000 chars → 400.
- 🔴 Apply to a **paid** campaign with no rate → "add your expected rate".
- 🔴 Apply to a **closed/completed** campaign → 409.
- 🔴 Apply to a **full** campaign (no available spots) → 409.
- 🔴 Apply **twice** to the same campaign → 409 "already applied".
- 🔴 **Apply rate limit**: 11th application within an hour → 429.
- 🟢 Withdraw a pending/shortlisted application → status "withdrawn"; can re-apply afterwards.
- 🔴 Withdraw **after being selected** → blocked.
- 🔴🔴 **Rejection is final**: rejected applicant tries to re-apply → blocked ("already decided"). *(Confirm there is NO path anywhere that flips rejected→pending or allows reapply.)*
- 🟠 Apply → withdraw → re-apply revives the **same** row to pending (no duplicate).

### Brand selecting an applicant
- 🟢 Brand shortlists (private — creator gets **no** notification).
- 🟢 Brand selects an applicant on a paid campaign → collab created `briefed/unfunded`, **hidden** from creator (still reads "Applied").
- 🟢 Brand selects on a barter/both with rate 0 → collab `briefed/funded` (no escrow), creator notified.
- 🟢 Rated-barter (creator named a positive rate on a both campaign, brand accepts) → treated as a **paid** collab (escrow required).
- 🔴 Select when capacity already reached → friendly "capacity reached".
- 🟠 Error message distinguishes "**awaiting payment**" (selected-but-unfunded) from truly "full".
- 🟠 Select the **same application twice** (double-click) → one collab, idempotent.
- 🟠🟠 **Race: two selections for the last spot** simultaneously → only one collab; the other gets capacity error.

### Undo selection (pre-funding)
- 🟢 Brand "undo selection" while `briefed/unfunded` → collab cancelled, applicant back to pending, re-selectable; creator saw nothing.
- 🔴 Undo **after funding** → 409 "already funded, contact support".
- 🟠🟠 **Race: undo vs funding webhook** at the same instant → money never moves after cancel; either it's funded (undo 409s) or it cancels (webhook no-ops).

---

## 4. Invites (Brand → Creator)

- 🟢 Brand invites a creator (paid, rate > 0) → creator sees pending invite with offer + 7-day expiry.
- 🟢 Creator **accepts** → collab created and **visible** to creator pre-funding (`from_invite`), shows "awaiting brand to secure payment".
- 🟢 Barter invite (rate 0 on barter/both) → accept → barter collab active.
- 🔴 Invite with rate 0 on a **paid** campaign → "enter the rate".
- 🔴 Invite to a creator who **already has a (non-cancelled) collab** on that campaign → 409.
- 🔴 Invite on a **non-active** campaign → blocked.
- 🔴 Send the **same pending invite twice** → 409.
- 🔴 Creator accepts/declines an invite that was **already** accepted/declined → 409.
- 🔴 Accept invite while **unverified / not onboarded** → blocked.
- 🔴 Accept invite on a campaign that **closed/filled** in the meantime → friendly 409.
- 🟢 Invites tab (creator) shows **Pending / Accepted / Declined** sections; barter shows "Barter" not "$0.00".
- 🟠 Invite rate differs from an existing pending application's rate → application rate updates to the invite's offer.
- 🟠 Accepting an invite for an application that was **already selected** → no second collab, invite just closes.
- 🔴/🟠 Barter invite on a DB **missing migration 032** → friendly "barter invites not enabled yet" message (only relevant if migrations are behind).

---

## 5. Funding the Escrow (paid collabs)

- 🟢 Brand funds a `briefed/unfunded` collab → Stripe PaymentIntent (manual capture) → webhook `amount_capturable_updated` → `funded`; creator notified "confirmed / payment secured".
- 🟢 When funding fills the campaign → remaining pending applicants auto-rejected (notified once).
- 🔴 Try to fund a **barter** (rate 0) collab → "this is a barter collaboration".
- 🔴 Try to fund a collab not in `briefed` → "payment already processed".
- 🟠 **Double-fund** (click twice) → same PaymentIntent reused (idempotency key), no double charge.
- 🟢 Funding **deadline (72h)**: leave a selection unfunded > 72h → `expire-funding` cron cancels it, applicant returns to pending, **brand** notified "selection expired", any Stripe hold released.

---

## 6. Collab Lifecycle (draft → live → paid)

### Draft
- 🟢 Creator submits a draft (file upload **or** external HTTPS link, exactly one) → `draft_submitted`, 48h auto-approve timer set.
- 🔴 Submit draft while **not funded** → 409.
- 🔴 Submit draft with **both** file and link, or neither → 400.
- 🔴 Submit draft with a file path **not belonging to this collab** → 400.
- 🔴 External draft link not http(s) → 400.
- 🟠 **Double-submit same draft** → idempotent; submitting a **different** draft while one is pending review → blocked.

### Review / revision
- 🟢 Brand **approves** draft → `draft_approved`, timer cleared.
- 🟢 Brand **requests revision** with feedback (≥20 chars) → `in_revision`, count increments.
- 🔴 Request revision with short/empty feedback → 400.
- 🔴 **3rd revision** request (cap is 2) → blocked "max revision rounds reached".
- 🟢 **Auto-approve at 48h**: don't act for 48h → `auto-approve-drafts` cron approves; both parties notified.
- 🟠🟠 **Brand approves at ~47:59 while cron fires at 48:00** → single approval, one notification, no double.

### Live
- 🟢 Creator submits the live post URL (valid HTTPS) → `live_submitted`, 72h auto-release timer set.
- 🔴 Submit live before draft approved → 400; non-HTTPS URL → 400; payment no longer funded → 409.
- 🟢 Brand **confirms live** → capture PaymentIntent + Stripe **transfer** to creator → `paid` + `completed`; creator sees payout.
- 🟢 **Auto-release at 72h**: don't act → `auto-release-live` cron captures + transfers (paid) / completes (barter).
- 🟠 **Double-confirm** (click twice / confirm + auto-release race) → settlement lease + idempotency keys ⇒ **exactly one** capture & transfer.

### Barter completion & shipping
- 🟢 Barter collab runs the same draft→live flow; completes via `manual_exception` (no money moves, earned = 0).
- 🟢 Creator submits **shipping details** (barter only); brand sees them and "mark as shipped".
- 🔴 Shipping form on a **paid** collab → blocked; non-party POST/PATCH → 403.
- 🔴 Edit shipping **after** it's marked shipped → 409 (locked).

### Money-safety edge cases (highest priority)
- 🟠🟠 **Creator never connected Stripe** at release time → `transfer_failed`; `payout-stuck` cron reminds, then escalates at the grace window; `account.updated` webhook (creator connects later) **retries the payout immediately**.
- 🟠🟠 `transfer.reversed` webhook **after** payout → state becomes `transfer_reversed` (distinct), `payout_review_at` set, support emailed — **not** clobbered to refunded, cron does not loop.
- 🟠🟠 `charge.refunded` / `refund.updated` **after** payout → `payout_review_at` + support email; **not** auto-clobbered to `refunded`.
- 🟠 Stripe **webhook replay / duplicate delivery** → processed once (event lock + 3-min stale reclaim).
- 🔴 Webhook with **bad/missing signature** → 400, not processed.

---

## 7. Disputes

- 🟢 Raise a dispute (brand or creator) from `draft_submitted`/`in_revision`/`draft_approved`/`live_submitted` → `disputed`, auto-timers frozen, both parties + admin notified.
- 🟢 Barter dispute → wording says "paused" (no "payment frozen").
- 🔴 Raise dispute at a wrong stage (e.g. completed/cancelled) → 400.
- 🔴 Dispute reason < 20 chars → 400; non-party → 403.
- 🟠 Raise dispute **twice** → idempotent (same dispute returned).
- 🟢 Upload evidence: text / links / files (PNG/JPEG/WebP/GIF/PDF/MP4/MOV, ≤25MB each, ≤10 files/URLs); other party + admin notified.
- 🔴 Evidence with **no** text/link/file → 400; bad URL → 400; file > 25MB → 413; unsupported type → dropped (reported in `failed_files`), submission still succeeds if anything else attached.
- 🔴 Upload evidence when there is **no open dispute** → 409.

### Admin resolution
- 🟢 **Creator wins** → full capture + transfer to creator (paid) / mark complete (barter).
- 🟢 **Brand wins / mutual** → refund/cancel the PaymentIntent → collab cancelled.
- 🟢 **Split %** → partial capture of the creator's share, remainder released to brand; verify fee recomputed on the captured amount and `dispute_released_cents` recorded.
- 🔴 Resolve by a **non-admin** → 403; resolve an **already-resolved** dispute → 409; invalid outcome / split % out of 0–100 → 400.
- 🔴 **Brand wins but creator already paid** (transfer exists) → auto-refund blocked, admin handles manually.
- 🟠🟠 Two admins resolve **simultaneously** → settlement claim lease ⇒ one settles, the other gets "already resolved"; **no double movement**.
- 🔴 If Stripe settlement fails mid-resolve → 502 and the dispute **stays unresolved** (retryable).

---

## 8. Cancellation

- 🔴 POST cancel on an **accepted** collab → 403 "open a dispute or contact support" (by design).
- (Pre-acceptance cancellation is the "undo selection" + "funding expiry" flows in §3/§5.)

---

## 9. Reviews & Reputation

- 🟢 After completion, both sides leave a review (1–5 + optional note ≤1000 chars).
- 🟢 **Mutual reveal**: when the 2nd review lands, both reveal immediately + ratings recompute.
- 🟢 **7-day auto-reveal**: only one side reviews → `update-ratings` cron reveals after 7 days + recomputes.
- 🔴 Review **before completion** / before payment settled → 409.
- 🔴 Review **twice** (same side) → 409; review by a **non-party** → 403.
- 🔴 Rating outside 1–5 → 400; note > 1000 → 400.
- 🔴 Review note with **email/phone/URL** → blocked; a **bare @handle is allowed** (verify this nuance).
- 🟢 Barter collabs are review-eligible on completion.
- 🟠 Repeat collabs between the **same pair** count as **one** rating vote (no rating farming).
- 🟠 Author always sees their own (unrevealed) review; the counterparty sees it only after reveal.

---

## 10. Boosts & Subscriptions

### Boost
- 🟢 Creator buys a boost → Stripe checkout → webhook activates `boost_active_until`.
- 🔴 Buy boost without onboarding → 403; boost disabled / price unset → 503; >5 attempts/hr → 429; bad type → 400.
- 🟠 **Stacking**: buy a 2nd boost while one is active → extends from the later expiry, capped at the max horizon.
- 🟠 **Webhook replay** of the same boost checkout → activated once (idempotent on session id).
- 🟢 Boost expiry cron clears `boost_active_until`; boosted creators rank higher **only within tier** (never changes match label/score — unit-tested, but eyeball the ordering).

### Pro subscription (brand)
- 🟢 Start Pro checkout → webhook sets `plan=pro/active`.
- 🟢 Cancel via billing portal → keeps Pro until period end (`cancelled` but access continues) → `subscription.deleted` → `free`.
- 🟠 `past_due` keeps access while Stripe retries.
- 🔴 Non-brand checkout/portal → 403; already-subscribed → 409; beta-free-pro mode → 409 "complimentary during beta"; portal with no Stripe customer → 404.

---

## 11. Crons (run each manually with the `CRON_SECRET` header)

- 🔴 **Every** cron without/with-wrong `CRON_SECRET` → 401 (fail-closed). *(Test this for all 10.)*
- 🟢 `auto-approve-drafts`, `auto-release-live`, `expire-applications` (pending 14d / shortlisted 30d), `expire-funding` (72h), `expire-invites` (7d), `expire-boosts`, `notify-expiring` (24h/12h/6h reminders, deduped), `payout-stuck` (reminder→escalate→backstop), `recompute-scores`, `update-ratings` (7d reveal).
- 🟠 Run any cron **twice in a row** → second run is a no-op (idempotent / dedupe keys), no double notifications or double settlement.
- ⚠️ **Vercel plan**: 10 crons require **Vercel Pro** (Hobby allows 1/day and will fail to deploy the rest). Confirm all 10 are scheduled and firing in production logs.

---

## 12. Cross-cutting / infra smoke tests

- ⚠️ **All migrations 023–036 applied** to the production DB (several are manual). Spot-check: `collabs.settlement_claimed_at` (034), `collab_shipping` (036), barter-invite rate constraint (032), recompute-scores lockdown (035).
- ⚠️ **Supabase Auth URL config** (site URL + redirect allow-list) so verification/reset links point to the right domain.
- ⚠️ **Supabase email templates** (verification, recovery) wired to the right `next` paths.
- ⚠️ **Resend/SMTP** sending domain verified; transactional emails actually arrive (not spam).
- ⚠️ **Stripe webhook endpoint** registered with the right events: `payment_intent.*`, `charge.refunded`, `refund.updated`, `transfer.reversed`, `account.updated`, `checkout.session.completed`, `customer.subscription.*`.
- ⚠️ **Stripe Connect** onboarding for creators (payouts_enabled) — a real transfer reaches a test connected account.
- ⚠️ **Vercel env vars** present in production: Stripe keys + webhook secret, `CRON_SECRET`, Supabase service-role key, Resend key, boost/pro price IDs, `BETA_FREE_PRO`.
- 🟠 **RLS** spot-check: as creator, you cannot read another creator's collab/shipping/dispute rows; selected-but-unfunded collab is not visible to the creator.
- 🟠 **Mobile**: run the core journeys (signup, discover, apply, collab chat, confirm) on a phone viewport.

---

### Priority order if time is short
1. **§5–§7 money paths** (fund → release → dispute resolve) including the 🟠🟠 race/edge cases — this is where real money can be lost or duplicated.
2. **§3/§4 selection/acceptance + rejection finality**.
3. **§11 crons + §12 infra config** (a misconfigured webhook or unscheduled cron silently breaks settlement).
4. The rest (§1, §2, §9, §10).
