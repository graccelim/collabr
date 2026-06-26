# Collabr — Creator Pro, Connected Creator & AI Growth Coach — Mega Plan

> Status: **planning only — no code written yet.** Sign-off doc before implementation.
> Supersedes `VERIFIED-CREATOR-PLAN.md` (kept for architecture/Phyllo reference).
> Grounded in the actual repo: split `creator_profiles`/`brand_profiles`, Stripe escrow + Boost
> price-ID pattern, no AI SDK yet, Supabase RLS, Vercel cron (`CRON_SECRET`), cents convention.

---

## ROADMAP v4 — AUTHORITATIVE (supersedes all earlier build-order / funnel guidance below)

> Wherever anything below this section mentions a "free YouTube funnel", "YouTube first (free API)",
> "free taste", or gating only IG/TikTok behind Pro — **it is superseded by this section.** The free
> YouTube funnel is removed. Connected (all of TikTok + Instagram + YouTube) is a **Creator Pro–only**
> feature, synced via **Phyllo only**, and Phyllo is **never touched for a non-paying creator**.

### Positioning
- **Free Creator** → Marketplace · Portfolio · Applications · Reviews · 🛡️ Collabr Certified.
- **Creator Pro 💎** → ⭐ Connected Creator (Connect TikTok / Instagram / YouTube) · Creator Studio ·
  AI Growth Coach · AI Brand Coach · Content Lab · Historical analytics · Weekly reports.

### Cost control (hard rules — design around minimizing Phyllo spend)
- **Never** create a Phyllo user at signup, or for any free creator.
- **Never** sync analytics for a free creator.
- Only **after Stripe confirms an active Creator Pro subscription** do we, in order:
  1. create the Phyllo user, 2. store `phyllo_user_id`, 3. launch Phyllo Connect, 4. allow connecting
  TikTok/Instagram/YouTube, 5. begin syncing. If a creator never upgrades, **we never call Phyllo.**

### Expiry (freeze, never delete)
Stop all syncing · keep historical analytics · **Creator Studio becomes read-only** · keep the ⭐ badge
visible with "Last synced X days ago" · AI stops generating new reports (existing remain) · renewing
resumes syncing automatically. Nothing is deleted. (Enforced by `lib/entitlements.ts` `proState` →
`active` / `frozen`; frozen ⇒ `shouldSyncAccount=false`, Studio read-only, `canGenerateAI=false`.)

### Phase order (revised)
1. ✅ **Collabr Certified** (done).
2. **Creator Pro billing** — Stripe subscriptions · entitlements · Creator Studio gating.
3. **Phyllo integration** — TikTok · Instagram · YouTube (provider-specific code waits for an account).
4. **Creator Studio** — Analytics · Content DNA.
5. **AI** — Growth Coach · Brand Coach · Content Lab.

### Phyllo research (answers to the specific questions; current June 2026)
| Question | Finding |
|---|---|
| Pricing model | **Custom / quote-based, sales-gated.** No public tiers. Reportedly scales with connected accounts + the products enabled (Identity/Engagement/Income). |
| Per connected vs per active account | **Not publicly stated — must confirm with sales.** Treat as "per connected account" for cost modelling (worst case) and minimize connections accordingly. |
| Sandbox | **Yes, free** — `dashboard.getphyllo.com` (sandbox env + keys for development). |
| Startup credits / pricing | **Not publicly documented** — ask sales for a startup plan/credits when you talk to them. |
| When billing begins | **Not public — confirm with sales** (on connect vs on first data fetch). Our design connects only after payment, so billing can't start for free users regardless. |
| Best practice: create users only after payment | Supported — user creation is an explicit API call you control; gate it behind the Stripe `active` webhook (our design). |
| Disconnect / expiry effect on billing | **Not public — confirm with sales.** Design: on expiry, stop syncing; **and disconnect accounts at Phyllo** if their billing is per-connected-account, to stop charges (we keep our local history regardless). |
| Supported metrics (TikTok/IG/YouTube) | Connected metrics include views/impressions, likes, comments, shares, saves (IG), audience demographics, and income — **exact per-platform availability must be read from their live docs at integration time** (don't overclaim per platform). |
| Webhook architecture | **Webhook-driven** (primary mechanism, not polling): subscribe to account-linked + per-datatype "data available" events; verify signature; idempotent on event id; enqueue sync. |
| OAuth flow | Connect SDK handles platform OAuth: create user → create SDK token (≈1-week TTL) → init Connect → `accountConnected` event returns `account_id` → backend pulls data. |
| Rate limits | Phyllo abstracts native platform limits with auto-retry; its own API has rate limits — see their "respecting rate limits" guide; rely on webhooks rather than polling. |

Sources: getphyllo.com/pricing (sales-gated), docs.getphyllo.com (Connect SDK, webhooks, rate-limits guide),
modash.io Phyllo comparison (~$20k/yr at scale, sales-gated). **Confirm the gated items (exact pricing,
per-account vs per-active, billing-start, disconnect effect, startup credits) on your sales call.**

### What to create in the Phyllo dashboard (once you have an account)
1. Sign up at `getphyllo.com` / `dashboard.getphyllo.com` (request access; start in **sandbox**).
2. Create an **application** → gives **sandbox** + **production** environments, each with `client_id` + `secret`.
3. Configure the **webhook URL** (`https://<host>/api/webhooks/phyllo`) and any redirect URLs.
4. Enable only the **products you need** (Identity + Engagement; add Income later) to limit cost.
5. Copy **sandbox** `client_id` + `secret` + webhook signing secret → set as **server-only** env vars
   (`PHYLLO_CLIENT_ID`, `PHYLLO_SECRET`, `PHYLLO_ENV=sandbox`, `PHYLLO_BASE_URL`, `PHYLLO_WEBHOOK_SECRET`).
6. Then I wire the `PhylloAdapter` into the abstraction built in Phase 2/3 (no other code changes).
Full step-by-step integration guide: `VERIFIED-CREATOR-PLAN.md` §12 (the 15-step beginner guide) — still current.

---

## 0. TL;DR / verdict

- **Three clean concepts, and they're correctly separated.** 🛡️ Collabr Certified (free, Collabr behaviour),
  ⭐ Connected (Pro-only, synced social analytics), 💎 Creator Pro (the paid subscription that unlocks
  Connected + Creator Studio + AI). This is a better structure than my v1 — keep it.
- **Build order is the key decision, and it's NOT what the spec implies.** Ship in this order:
  1. **🛡️ Collabr Certified first** — it's computable *today* from data you already store
     (`creator_profiles.rating_avg/rating_count/collabs_completed` + collabs/reviews/disputes).
     Zero external cost, immediate brand value, makes the marketplace better even if nobody buys Pro.
  2. **💎 Creator Pro subscription plumbing** (Stripe, reusing your Boost price-ID pattern) + the
     expiry/freeze state machine.
  3. **⭐ Connected Creator** ingestion — **YouTube first (free API)**, Phyllo for IG/TikTok later.
  4. **🤖 AI Growth Coach MVP** — rule-based + cached Claude summaries.
- **One assumption I'm challenging (important):** "Only Pro users can connect accounts, because Phyllo
  costs money." Correct *for Phyllo* (IG/TikTok). But **YouTube's Data API is free** — gating *YouTube*
  behind Pro throws away your best free funnel. **Recommended:** let any creator connect **YouTube free**
  (a taste of Connected analytics), and gate **IG/TikTok (Phyllo)** + **Creator Studio + AI** behind Pro.
  This kills the chicken-and-egg (creators see value before paying) while still never paying Phyllo for a
  non-paying creator. If you'd rather keep it strict (all connection = Pro), that's a one-flag change.
- **AI now, safely:** rule-based/deterministic where possible (best-time-to-post is *computed*, never
  guessed), Claude only for narrative summary + Content Lab generation, structured output, hard
  "insufficient data" gating, Batch + caching for cost. Use `@anthropic-ai/sdk` (not yet installed).
- **Pricing:** S$12–19/mo is in the right band; I'd launch **S$15/mo or S$144/yr (~S$12/mo)** with a
  **7-day free trial**. Critique + margin math in §13.

---

## 0.5 Direction update — no gamification, no comparison, coach-not-judge

These principles now **override** anything earlier in this doc or in `VERIFIED-CREATOR-PLAN.md`.
Creator Pro is a **professional business tool** (Stripe / Notion / Linear / Figma / Shopify), not a
game (no Duolingo / fitness-app / LinkedIn-Top-Voices energy).

**Hard rules:**
- ❌ No rankings, leaderboards (platform-wide), missions, streaks, XP, levels, activity badges,
  achievements, percentiles, "Top X%", "better than Y%", public creator scores, or any
  creator-vs-creator comparison.
- ❌ No **Performance Score** and no **Collabr Certified Score** as a 0–100 number. Removed entirely.
- ✅ AI compares a creator **only against their own history** — never platform averages, never other
  creators, never percentiles/ranks.
- ✅ Brands evaluate creators on **plain facts**, not a synthesized grade.
- ✅ Every AI recommendation ends with **what to do next**, explained from the creator's own data;
  if data is insufficient, it says so — never guesses.

### Conflicts in the prior plan, and how they're now resolved
| Prior proposal (now wrong) | Why it conflicts | Replacement |
|---|---|---|
| **Performance Score 0–100** (engagement percentile within niche cohort) | Cohort percentile = creator-vs-creator ranking | **Deleted.** Brands see raw avg views / engagement / last synced — facts, not a grade. |
| **Collabr Certified Score 0–100** (weighted composite) | A hidden grading number | **🛡️ Collabr Certified = a binary badge** earned by meeting **transparent, published criteria** (met / not met). No number. Brands see the underlying facts (completed collabs, rating, response time, repeat brands). |
| "score breakdown on hover", "vs cohort", "cohort/competitor benchmarking" | Comparison/ranking | **Deleted.** Replaced by self-only trends. |
| Campaign "leaderboard" | Reads as a ranking | Renamed **"per-creator results"** — scoped to the brand's *own* campaign (these creators I hired), not a platform ranking. Neutral framing. |
| Score engine (`lib/analytics/score.ts`) | Produces a grade | Replaced by **`lib/certification/criteria.ts`** — a deterministic *criteria-met evaluator* (returns booleans, not a number). |

### One genuine tension to decide: rate guidance
You want "suggested rate" (Brand Coach) and "negotiate better rates", but principle 2 forbids
platform averages / cross-creator comparison. Resolution: base rate suggestions on the creator's
**own** signals first — their past accepted rates, their `base_rate`, the campaign budget, and their
own performance trend — presented as *their* range. If any market context is shown, it must be
neutral **category-level deliverable pricing** (e.g. "typical IG Reel in F&B"), framed as market
info, **never** "you're below/above other creators" and never a per-creator comparison. See §10.

---

## 1. Product critique (deliverable 1)

### What's right
- Separating **reputation (Collabr Certified)** from **performance (Connected)** is exactly right — they answer
  different brand questions ("are they reliable?" vs "do they perform?") and have different costs
  (free vs Phyllo). Most platforms conflate these; keeping them distinct is a genuine clarity win.
- **Pro-gating the expensive part** (Phyllo + AI) aligns cost with revenue. Good instinct.
- **Expiry = freeze, not delete** is the correct, humane, trust-preserving behaviour.
- **"Do not call data verified unless synced"** and the anti-hallucination rules show the right
  discipline. This is what protects the brand.

### What to challenge / fix
1. **Cold-start on Pro.** Gating *all* connection behind Pro means creators must pay before seeing any
   analytics value. Fix with **free YouTube connect** (free API) + **7-day Pro trial**. (See §0.)
2. **"Connected" badge integrity.** A badge on an account with 2 posts and no engagement is worse than
   no badge. Require an **earned bar** before ⭐ shows (≥3 analysable posts in 90d + non-null engagement);
   until then show "Connected — syncing".
3. **Cross-platform metric blending.** "Average views" isn't comparable across TikTok/YT/IG. Store and
   show **per-platform**; pick a "top platform"; let brands filter by platform. Don't average across.
4. **Brand-facing vs private split must be explicit.** Creator Studio (Insights/Coach/Content Lab) is
   *private*. Brands only ever see a **curated aggregate** (avg views, engagement, platform breakdown,
   last synced) — never the creator's full studio, goals, or AI chat. Enforce in RLS, not just UI.
5. **AI cost can creep.** Interactive chat is the expensive path. Make the MVP **mostly cached batch
   output** + a *bounded* Content Lab generator; defer open-ended streaming chat to a later phase.
6. **Collabr Certified gaming.** Response-time and completion-rate can be gamed; keep the **criteria**
   server-side + versioned, require minimums (e.g. ≥N completed collabs) so the badge can't be earned
   trivially, and show brands the **underlying facts**, not a black-box grade.
7. **Phyllo per-account economics unknown.** S$12/mo only nets margin if Phyllo's per-connected-account
   cost is well under that after AI + Stripe fees. **Get Phyllo's quote before locking price.** (See §13.)

---

## 2. Final naming (deliverable 2)

| Concept | Badge / label | Tagline | Notes |
|---|---|---|---|
| Reputation (free) | **🛡️ Collabr Certified** | "Reliable track record on Collabr" | Keep. Clear, earned, not over-claimy. |
| Synced analytics (Pro) | **⭐ Connected Creator** | "Performance metrics synced from connected accounts" | Keep. Avoid "Verified" (implies identity/celebrity check — you flagged this correctly). |
| Subscription | **💎 Creator Pro** | — | Keep. |
| Workspace | **Creator Studio** | — | Keep (you also said "Growth Hub" — pick one; I'd use **Creator Studio**). |
| AI | **AI Growth Coach** | — | Keep. |
| Portfolio-only platforms | **"Profile linked"** | — | Keep. Never "Connected/Verified" for Lemon8/XHS/X. |

**Do not** use the word "verified" for ⭐ — "Connected" is honest (data is synced, not identity-verified).
Brand filter labels: "Collabr Certified creators", "Connected creators", "Proven performance" (for the metric thresholds).

### 2.1 Transparent badge copy (point 2 — never mysterious)
Hover/click on either badge shows exactly how it's earned. Exact copy:

```
🛡️ Collabr Certified
Earned by consistently demonstrating reliability on Collabr.
Typical requirements:
  ✓ Completed collaborations
  ✓ Strong ratings
  ✓ High completion rate
  ✓ Low dispute rate
  ✓ Responsive communication
Thresholds are set by Collabr and reviewed over time.
```
```
⭐ Connected Creator
Performance analytics are automatically synced from connected social accounts.
Last synced: Today        (or "2 hours ago")
```
On expiry: `Last synced: 127 days ago` + tooltip "Analytics are no longer actively synced. Upgrade to
Creator Pro to resume automatic updates. Historical analytics remain available."
The **exact thresholds stay server-side/configurable**, but the **criteria are always visible** — and
the criteria copy is the single source the tooltip reads, so it never drifts from the evaluator.

### 2.2 Collabr Certified is *maintained*, not permanent (your new recommendation — adopted)
The badge reflects **current** reliability, not a one-time achievement. It is **re-evaluated continuously**
(nightly), and can be **suspended** and later **reinstated**:
- **`certified_status`**: `none` → `certified` → `suspended` → `certified` (round-trips allowed).
- **Suspend** when the live criteria stop being met — e.g. unresolved disputes accumulate, repeated
  failure to deliver, or rating falls below threshold over a trailing window. Set `certified=false`,
  `certified_status='suspended'`, store `certified_suspended_reason`, notify the creator with the exact
  unmet criterion and how to recover.
- **Reinstate** automatically once criteria are met again.
- **Stability is the goal — the badge must be hard to lose.** Evaluate over a **trailing window**
  (default **last 90 days OR last 20 completed collaborations**, whichever is larger), never on single
  events. One bad review or one slow reply can't drop it.
- **Confirmed default thresholds (server-side, tunable):**
  | Criterion | Earn (reinstate) at | Suspend below (hysteresis) |
  |---|---|---|
  | Completed collaborations | ≥ 5 | < 5 |
  | Reviews | ≥ 5 | < 5 |
  | Average rating | ≥ 4.6 | < 4.4 |
  | Completion rate | ≥ 95% | < 90% |
  | Dispute rate | ≤ 2% | > 4% |
  | Unresolved disputes | 0 | ≥ 1 |
  | Median response time | ≤ 48h | > 72h |
  The **earn** column is the clean threshold; the **suspend** column is the looser hysteresis band — a
  creator is only suspended when clearly under, and only re-certified at the clean bar. This gap is what
  prevents day-to-day toggling. (An unresolved dispute is the one immediate-suspend trigger.)
- **Brands therefore trust it as *current*** — exactly your goal. Computed by the same nightly
  `lib/certification/criteria.ts` evaluator; no extra surface.

---

## 3. Monetisation critique (deliverable 3)

**Your thinking:** Creator Pro S$12–19/mo.

**My recommendation:**
- **S$15/mo**, or **S$144/yr (≈ S$12/mo, 20% off)** to push annual (better LTV, smooths Phyllo cost).
- **7-day free trial** (Stripe trial) — critical for a "pay to see your own data" product; conversion
  doubles when people see the dashboard first.
- Optional **founding-creator price** (S$9/mo for first N) to seed coverage so brand filters aren't empty.

**Why this works:**
- The **badge + a thin aggregate stays brand-visible** even after expiry (frozen/stale) — that's the
  network effect; don't fully hide it.
- **Pro = the studio + AI + IG/TikTok sync.** Willingness-to-pay for creators is *growth*, not a badge.
- **Margin math (validate with real Phyllo quote):** per Pro creator/month you pay ≈ Phyllo per-account
  + AI (≈ a few cents with Batch+Haiku+cache, see §10) + Stripe (~3.4% + S$0.50). If Phyllo lands around
  ~S$3–6/connected-account/mo, S$15 leaves healthy margin; if Phyllo is closer to S$10, raise to S$19 or
  push annual. **Do not finalise S$12 until you have the Phyllo number.**

**Don't:** paywall Collabr Certified (it's free reputation — paywalling it would feel punitive and it costs
you nothing). Don't promise outcomes ("guaranteed acceptance"). Don't meter AI per-message in v1 (confusing).

---

## 4. Full UX flow (deliverable 4)

### Creator journey
1. **Signup unchanged** — no analytics connection forced (matches spec; your `signup/page.tsx` stays as is).
2. **Post-signup + dashboard card:** "Become a Connected Creator ⭐ — Upgrade to Creator Pro / Maybe later"
   (dismissible, non-blocking; re-surfaces as a slim banner). Copy from the spec's UI Copy section.
3. **Free taste (recommended):** "Connect YouTube free" inline → shows a mini Insights preview → soft
   wall: "Connect TikTok & Instagram and unlock Creator Studio with Creator Pro."
4. **Upgrade → Stripe Checkout (subscription, 7-day trial) → returns Pro active.**
5. **Connect accounts** (Pro): platform picker → Phyllo Connect (IG/TikTok) / YouTube OAuth → "Connected —
   syncing" → flips to ⭐ once first sync + earned bar pass.
6. **Creator Studio** unlocked (7 tabs, §6).
7. **Expiry:** sync freezes, history stays, badge shows stale "Last synced 127 days ago", renew banner.

### Brand journey
- Creator states: **Basic** (portfolio only), **🛡️ Collabr Certified**, **⭐ Connected**, or **Collabr Certified + Connected**.
  All four usable; Basic never hidden.
- **Discovery filters:** Connected, Collabr Certified, platform, min avg views, min engagement, completed collabs,
  rating, response time, category. (Extend the `FilterSelect` bar you just built.)
- **Applicant cards:** show ⭐ avg views / engagement / last-synced when Connected (facts, **no score**);
  🛡️ track-record facts (completed collabs, rating, response time, repeat brands) when Collabr Certified; fall back
  to portfolio when Basic. No badge implies a ranking.
- **Campaign analytics:** Connected creators → real per-collab + per-campaign metrics (views/reach/likes/
  comments/shares/saves, CPV/CPE, **per-creator results** + top post — scoped to *this* campaign, not a
  platform ranking, last synced, source). Not Connected → honest
  "Analytics unavailable — creator hasn't connected supported accounts." **Never fake or estimate.**

---

## 5. Technical architecture (deliverable 5)

Same 4-layer decoupling as v1 (ingestion adapters → raw append-only storage → precomputed rollups →
RSC rendering), **plus** a subscription/entitlement layer that gates everything Pro.

```
 Entitlement layer ──► is this creator Pro-active right now?  (Stripe sub state)
        │                    │ gates: connect, sync, studio, AI
        ▼                    ▼
 ┌─ Ingestion adapters ──────────────────────────┐   PlatformAdapter interface:
 │  PhylloAdapter (Pro only — TikTok/IG/YouTube)  │   fetchAccount() / fetchPosts()
 │  → NormalizedAccount / NormalizedPost          │   → identical shape per source
 └───────────────┬────────────────────────────────┘
                 ▼
   Raw storage: connected_accounts · account_snapshots · content_posts · post_snapshots
                 ▼  (nightly cron, ONLY for Pro-active accounts)
   Aggregation: creator_rollups · campaign_rollups
                 ▼
   AI layer: ai_insights (cached batch) · ai_reports (weekly) · ai_chat_messages
                 ▼
   Rendering: Creator Studio (private) · Brand aggregate (curated) · Applicant cards
```

**The entitlement gate is the most important new piece** — it appears in three places:
1. `/api/verify/connect-token` refuses if not Pro-active (no exceptions — Connect is Pro-only).
2. The **sync cron skips accounts whose owner is not Pro-active** (this is how expiry "freezes" sync).
3. AI cron + Studio routes refuse if not Pro-active (history still *readable*, just not *regenerated*).

Adapter contract identical to v1 (`NormalizedAccount`/`NormalizedPost`) — Phyllo stays a drop-in.

---

## 6. Creator Studio — the creator business dashboard

**Positioning (your point 8):** Creator Studio is the creator's **operating system** — the home for
running and growing their business. It does **not** rebuild the marketplace; it **surfaces and links**
what already exists (Campaigns, Invites, Payments/Earnings, Profile/Media kit) alongside the new Pro
surfaces (Insights, Growth Coach, Content Lab, Brand Coach, Brand Performance, Goals, Reports). Reuse the existing pages; the Studio
is a unified, premium shell over them. Keep it clean and uncluttered — every panel earns its place; no
vanity widgets, no streaks, no scores.

All Studio analytics/AI surfaces are **private to the creator** (RLS). Work with zero Collabr collabs
(they analyse the creator's own social content).

**Navigation (point 8 — Strategy folded into Insights, Brand Coach promoted):**
Insights · Growth Coach · Content Lab · Brand Coach · Brand Performance · Goals · Reports

1. **Insights** — "what happened" + "what you're good at" (Strategy merged in here):
   - *Performance:* views/reach/likes/comments/shares/saves, follower growth (if avail), average
     views/engagement/reach/saves, total posts, best/worst posts, platform comparison, growth over time,
     recent posts.
   - *Strengths = the creator's **Content DNA** (§6.6), rendered directly* — Strongest Categories /
     Platforms / Content Styles, best posting times/lengths, posting consistency, audience geo/age.
     Factual summaries, never rankings/scores.
   *Reads `creator_rollups`. Deterministic; AI only adds a short narrative.*
2. **Growth Coach** — "why & what next": cached AI narrative (what improved/declined vs the creator's
   own prior period, strongest platform & style, next actions), each point **explaining the reasoning
   from their own data before the advice** (point 5) + bounded Q&A. *Reads `ai_insights`; `/api/insights/coach`.*
3. **Content Lab** — generator: input topic/platform/tone/niche → 5 hooks, 3 captions, 3 CTAs, structure,
   "why it may work". Rewrite tools (more authentic / concise / premium). *Interactive Claude, bounded.*
4. **Brand Coach** — §6.5: invite analysis (fit / own-history fit, not a forecast / rate / risks /
   negotiation) + Campaign Recap after each collab. *Pro, self-referential, guides not predicts.*
5. **Brand Performance** — Collabr campaigns only: completed collabs, campaign views, ratings, repeat
   brands, performance vs the creator's *own* average, best sponsored posts, rate guidance (§0.5).
   *Rules + light AI.*
6. **Goals** — creator sets goals (grow views, post 3×/wk, more deals…). Coaches reference them.
7. **Reports** — weekly/monthly stored report (top posts, growth, what worked/didn't, next actions, best
   time to post, wins, ideas). *Batch-generated, stored, not regenerated unnecessarily.*

> Plus **linked (not rebuilt) surfaces** in the same shell: Campaigns, Invites, Payments/Earnings,
> Profile & Media kit — these point at existing marketplace pages.

---

## 6.5 AI Brand Coach (new — Creator Pro feature)

The counterpart to Growth Coach: it behaves like an **experienced creator manager**, not a campaign
analyser. Beyond the two moments below, it continuously helps the creator **get selected and deal well** —
always grounded in **their own** Content DNA (§6.6) and history, never other creators:
- **Why a campaign fits** — map the brief to their strongest categories/platforms/styles.
- **Portfolio gaps** — "you have strong F&B reels but no portfolio piece showing a product unboxing,
  which this brand wants — add one."
- **Improve selection odds** — concrete profile/portfolio/media-kit actions that match what this brand
  (and similar past briefs they won) looked for.
- **Content to showcase** — which of *their own* posts to feature for this pitch.
- **Negotiation points** — bundles, usage rights, timeline, exclusivity — framed from their own deal history.
- **Deliverable improvements** — stronger hooks/CTAs/length for *this* deliverable, from what worked for them.
- **Risks from their own history** — "your last tight-deadline collab slipped; this one is tighter."
All as suggestions with the reasoning first (point 5), never guarantees, "not enough data yet" when thin.

**A. On receiving a campaign invite — "Should I take this, and how?"**
Grounded in the creator's *own* history (never other creators):
- **Fit:** why this campaign suits *their* content — from their own top categories/platform mix.
- **Guide, not predict (point 6).** Do **not** forecast numbers ("Estimated views: 20–30k"). Use
  qualitative, history-grounded framing instead: *"This campaign closely matches your strongest-performing
  category — similar restaurant content has historically performed well for your audience."* If there's
  little comparable history → "not enough comparable history yet." Never imply a guaranteed outcome.
- **Suggested rate:** own-data-first (past accepted rates + `base_rate` + the campaign budget + their
  own performance trend), optionally a neutral category-level market range — **never** a per-creator
  comparison (§0.5).
- **Similar past collabs of theirs** that went well; **risks** (tight deadline, deliverables vs their
  norm); **negotiation points** (bundle, usage rights, timeline) — all suggestions, never promises.

**B. After completing a campaign — "Campaign Recap"** (stored, premium):
- Campaign performance (their numbers), strongest content + strongest hook, engagement summary,
  lessons learned, and recommendations for their next collaboration — all self-referential + actionable.

**Rules:** Pro-gated; reads only the authenticated creator's own collabs/rollups/Content DNA; obeys the
no-comparison + safety lint (§10); "insufficient data" instead of guessing; rate guidance per §0.5.
Generation is **batch/cached** where possible (recap on collab completion; invite analysis on demand,
rate-limited).

---

## 6.6 Content DNA (new — the deterministic foundation)

Every Connected Creator gets a private **Content DNA** profile — a structured, **100% deterministic**
summary of their own synced analytics. **No AI generates these values**; they are computed from
`post_snapshots`/`account_snapshots` by `lib/analytics/contentDna.ts` (pure, tested) and stored in a
`content_dna` row, refreshed by the nightly rollup cron.

**Fields (all factual, self-only — never comparative):**
Best Categories · Best Platforms · Average Views · Average Engagement · Average Reach · Average Saves ·
Best Video Length · Best Posting Days · Best Posting Times · Best Performing Content Styles ·
Audience Geography · Audience Age · Posting Consistency. Each carries the window + a `confidence`
("not enough data yet" when a dimension is thin) so downstream surfaces can degrade gracefully.

**Why it matters:** Content DNA is the **single source of truth** that powers everything —
- **Insights** renders it directly (the "Strengths" block is Content DNA).
- **Growth Coach / Brand Coach** receive it as **context** so the AI explains *why* ("your Content DNA
  shows restaurant + short-form as your strongest combination") instead of re-deriving anything.
- Future **brand↔creator matching** scores against it (server-side; still no public ranking).

**Privacy:** Content DNA is **creator-private by default** (RLS owner-only). Brands only ever see the
specific, intentionally-surfaced metrics already defined in §8 (avg views/engagement, platform breakdown,
last synced) — never the full DNA, audience age/geo, or posting patterns unless the creator opts to show them.

```sql
-- migration 038 (ships with the Connected analytics tables; needs synced data to populate)
create table content_dna (                 -- one current row per creator (Connected only)
  creator_id uuid primary key references creator_profiles(id) on delete cascade,
  window text not null default '90d',
  best_categories jsonb, best_platforms jsonb,
  averages jsonb,                          -- {views, engagement, reach, saves}
  best_video_length jsonb, best_posting_days jsonb, best_posting_times jsonb,
  best_content_styles jsonb,
  audience_geo jsonb, audience_age jsonb,  -- aggregate only (from Phyllo where available)
  posting_consistency jsonb,
  confidence jsonb,                        -- per-dimension data sufficiency
  computed_at timestamptz not null default now()
);
```

---

## 7. Data model (deliverable 6) — grounded in your real schema

Your profiles are **split** (`creator_profiles`/`brand_profiles`), so all FKs below point at
`creator_profiles(id)`. Migrations continue your numbering (next is `037`).

### 7a. Collabr Certified + Pro fields on `creator_profiles` (migration `037`)
```sql
alter table creator_profiles
  -- Collabr Certified (computed from existing data; free) — BADGE ONLY, no score number
  add column certified boolean not null default false,
  add column certified_status text not null default 'none'
     check (certified_status in ('none','certified','suspended')),
  add column certified_criteria jsonb,          -- {completed:true, rating:true, disputes:false,...} met/not-met
  add column certified_suspended_reason text,            -- {completed:true, rating:true, disputes:true,...} met/not-met
  -- Creator Pro subscription
  add column pro_status text not null default 'none'
     check (pro_status in ('none','trialing','active','past_due','canceled','expired')),
  add column pro_until timestamptz,             -- access end (freeze sync after this)
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  -- Connected Creator (denormalised for fast list/applicant rendering)
  add column connected boolean not null default false,
  add column connected_platforms text[] not null default '{}',
  add column insights_last_synced_at timestamptz;   -- NO performance_score column (removed by design)
```
> Note: `brand_profiles` already has `plan/stripe_customer_id/stripe_subscription_id` (brand side).
> Creator Pro is a **separate** subscription on `creator_profiles` — don't reuse the brand columns.

### 7b. Connection + analytics tables (migration `037`)
`connected_accounts`, `account_snapshots`, `content_posts`, `post_snapshots`, `creator_rollups`,
`campaign_rollups`, `sync_jobs`, `webhook_events` — **identical to the schema in
`VERIFIED-CREATOR-PLAN.md` §5**, with `creator_id uuid references creator_profiles(id)` and an added
`sync_frozen boolean default false` on `connected_accounts` (set true when owner's Pro lapses).

**Metric definitions (point 7 — keep the name "Average", document the math).** Labels stay **Average
Views / Average Engagement / Average Reach / Average Saves** (not "Typical"/"Median"). Defined once and
computed identically everywhere from `post_snapshots`, per platform, over a fixed trailing window
(default 90d, configurable): `Average X = sum(latest per-post X) / number of posts in window`;
`Engagement rate = (likes+comments+shares+saves) / views` (or / reach where views absent), averaged per
post. Store the window + formula version in `creator_rollups` so the number is reproducible and the UI can
show "Average views (last 90 days)". No cross-creator inputs ever enter these.

### 7c. AI + Studio tables (migration `038`)
```sql
create table ai_insights (              -- cached coach summary per creator/period
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creator_profiles(id) on delete cascade,
  period text not null,                 -- '2026-06'
  model text not null, summary text, suggestions jsonb,
  input_hash text,                      -- skip regen if rollup unchanged
  created_at timestamptz not null default now(),
  unique (creator_id, period)
);
create table ai_reports (               -- weekly/monthly stored reports
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creator_profiles(id) on delete cascade,
  period_start date not null, period_end date not null,
  model text not null, report jsonb not null, input_hash text,
  created_at timestamptz not null default now(),
  unique (creator_id, period_start, period_end)
);
create table ai_chat_messages (         -- Growth Coach / Content Lab transcript
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creator_profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  surface text not null,                -- 'coach' | 'content_lab'
  content text not null,
  tokens_in int, tokens_out int,        -- spend tracking / rate limiting
  created_at timestamptz not null default now()
);
create table creator_goals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creator_profiles(id) on delete cascade,
  kind text not null, target jsonb, status text not null default 'active',
  created_at timestamptz not null default now()
);

-- AI Brand Coach: per-invite analysis (cached) + per-collab recap
create table ai_invite_analyses (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creator_profiles(id) on delete cascade,
  collab_id uuid references collabs(id) on delete cascade,    -- the invite/collab analysed
  model text not null, analysis jsonb not null, input_hash text,
  created_at timestamptz not null default now(),
  unique (creator_id, collab_id)
);
create table ai_campaign_recaps (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creator_profiles(id) on delete cascade,
  collab_id uuid not null references collabs(id) on delete cascade,
  model text not null, recap jsonb not null, input_hash text,
  created_at timestamptz not null default now(),
  unique (creator_id, collab_id)
);
```
> Both Brand-Coach tables are **creator-private** (RLS: owner-only). Brands never read them.

---

## 8. RLS / security plan (deliverable 7)
- **Creator-private (Studio):** `connected_accounts`, `content_dna`, `ai_insights`, `ai_reports`,
  `ai_chat_messages`, `ai_invite_analyses`, `ai_campaign_recaps`, `creator_goals`, `creator_rollups` →
  `select` only where `creator_id` = caller's creator profile. Brands never read any `ai_*` table or the
  full `content_dna` (only the §8 intentionally-surfaced metrics).
- **Raw snapshots + ops tables** (`account_snapshots`, `post_snapshots`, `sync_jobs`, `webhook_events`):
  **service-role only**, never client-readable.
- **Brand-facing aggregate:** a dedicated **read path** (a `security definer` view or a narrow RLS policy)
  exposing only `{connected, connected_platforms, avg views, engagement, platform breakdown, last synced,
  certified (bool), completed collabs, rating, response time, repeat brands}` — **facts only, no score /
  percentile / ranking** — and only when a brand⇄creator relationship exists
  (application/collab), mirroring your existing collab-visibility policy. Brands **never** read
  `ai_*`, `creator_goals`, or raw posts.
- **Entitlement check is server-side** (never trust the client for Pro state): a `lib/entitlements.ts`
  helper reads `pro_status`+`pro_until` and is called by every connect/sync/AI route.
- **Secrets server-only:** Phyllo + Anthropic keys never `NEXT_PUBLIC_`. Stripe webhook + Phyllo webhook
  signature-verified. AI sees only the caller's own data. Rate-limit AI + connect routes. Delete data on
  disconnect; on Pro-cancel, **freeze** (don't delete).

---

## 9. Phyllo integration guide (deliverable 8)
**Unchanged from `VERIFIED-CREATOR-PLAN.md` §12** — the full 15-step beginner guide (what Phyllo is, why,
pricing reality, supported platforms, metrics, limitations, alternatives, account → app → keys → callback
→ webhooks → SDK install → backend endpoints → frontend Connect → webhook verify → local/prod testing →
env vars → common mistakes → security → monitoring). Read it there. Key facts recap:
- **Pricing:** sales-gated, no public free tier; sandbox free for dev; production ~low-thousands/mo →
  ~$20k/yr at scale. **Confirm per-connected-account cost before pricing Creator Pro** (drives §13 margin).
- **Billing model:** quote-based; typically scales with connected accounts + products (Identity /
  Engagement / Income) — confirm in the contract whether it's per-account, per-API-call, or per-product.
- **Flow:** create Phyllo user → create SDK token (1-week TTL) → init Connect SDK → `accountConnected`
  event returns `account_id` → backend pulls data + webhooks for ongoing sync.
- **Platforms/metrics:** IG/TikTok/YouTube get engagement analytics; Lemon8/XHS/X are profile-only here.
- **Alternatives:** Modash (discovery + public pricing), HypeAuditor (authenticity), official APIs
  (YouTube free — use directly; IG/TikTok need app review — why Phyllo earns its keep).

---

## 10. AI Growth Coach implementation guide (deliverable 9) — answers your 15 questions

**Provider:** nothing is configured in the repo today. Recommend **`@anthropic-ai/sdk` + Claude** (repo is
Claude-native; consistent tooling). Install `@anthropic-ai/sdk`; add `ANTHROPIC_API_KEY` (server-only).

**The golden rule: compute what you can, generate only the narrative. **Content DNA (§6.6) is the computed
layer** — it's passed to every AI surface as read-only context so the model *explains* the creator's own
numbers rather than inventing them.** Best-time-to-post, best
categories, platform comparison, growth deltas are **deterministic calculations from `post_snapshots`** —
never ask the LLM to invent them. The LLM only *writes them up* and suggests next actions. This is the
single biggest anti-hallucination and cost lever.

1. **Which model.** Tiered (set as constants so you can swap):
   - **Batch summaries + weekly reports → `claude-haiku-4-5`** ($1/$5 per M) via the **Batch API (−50%)**.
   - **Interactive Content Lab / Coach Q&A → `claude-sonnet-4-6`** (good quality/cost) — or `claude-opus-4-8`
     if you want top quality (it's the SDK default; your call given the cost priority).
2. **Keep costs low.** Batch API (−50%) + **prompt caching** (stable rubric/schema cached, ~0.1× reads) +
   **idempotent skip** (hash the rollup; don't regenerate unchanged) + Haiku for bulk + per-user rate
   limits + bounded `max_tokens`. Net: cents per Pro creator/month for summaries+report.
3. **Avoid hallucination.** Feed only computed metrics; **structured-output JSON schema**; instruct
   "use only the numbers provided; if a field is null/insufficient, say 'not enough data yet'"; never let
   it state numbers not in the input; deterministic stats done in code.
4. **Prompt structure.** `system` = role + Collabr voice + the **safety language rules** (no "guaranteed",
   use "may help / your data suggests / consider testing / not enough data yet") + output schema, cached.
   `user` = the creator's rollup JSON (volatile, last). One creator per request.
5. **Use metrics safely.** Pass only the caller's own rollup; strip PII; aggregates only; never another
   creator's data in any prompt.
6. **Store insights.** `ai_insights` (period summary), `ai_reports` (weekly), `ai_chat_messages`
   (transcript + token counts). Cache by `input_hash`.
7. **Refresh.** Insights regenerate only when the nightly rollup's hash changes; reports weekly via cron;
   never for non-Pro-active creators.
8. **Rate limit.** Per-creator caps on `/api/insights/coach` and Content Lab (e.g. N/day), enforced
   server-side; 429 with friendly copy.
9. **Prevent abuse.** Pro-gate + rate limit + `max_tokens` cap + log spend per creator + block prompt
   injection (treat creator free-text as data, not instructions).
10. **No cross-creator leakage.** Prompts built server-side from the authenticated creator's rows only;
    never interpolate IDs from the request body into queries without ownership check.
11. **Streaming chat.** Phase 4: `client.messages.stream(...)` piped to the client; `finalMessage()`
    server-side for logging. MVP can be non-streaming request/response.
12. **Batch weekly reports.** `client.messages.batches.create({requests: proCreators.map(...)})` →
    poll → `results()` → upsert `ai_reports` by `custom_id`. Cron-driven, off-peak.
13. **Evaluate quality.** Golden-set of ~20 creators with hand-checked expected takeaways; assert the AI
    never states a number absent from input; spot-check "insufficient data" triggers; track thumbs-up/down
    on coach answers.
14. **Pro-only.** All of Studio (Insights/Growth Coach/Content Lab/Brand Coach/Brand-Perf/Goals/Reports)
    + sync. (Collabr Certified is free; a tiny brand-facing aggregate stays visible even when frozen.)
15. **Cacheable.** The system prompt/rubric/schema (prompt cache); the period summary + weekly report
    (`ai_insights`/`ai_reports` by `input_hash`); deterministic stats (rollups). Only live chat is uncached.

### AI MVP scope (what you asked to ship now)
1. **Growth Summary** — Haiku batch over rollup → improved/declined, strongest platform & style, next
   actions. Cached.
2. **Best Time to Post** — **computed** from `post_snapshots` weekday/hour buckets; AI only phrases it; if
   too few posts → "not enough data yet."
3. **Content Style Suggestions** — from top posts (computed) → AI suggests formats/hooks/caption/CTA angles.
4. **Caption/Hook Generator (Content Lab)** — interactive Sonnet; input topic/platform/tone/niche →
   5 hooks / 3 captions / 3 CTAs / structure. Rate-limited.
5. **Weekly Report** — Haiku batch, stored in `ai_reports`, regenerated only on change.

### Safety + no-comparison language (enforced in the system prompt + a lint on output)
**Coach, don't judge. Compare the creator only to their own history.** The system prompt forbids, and an
output lint rejects, any of:
- **Comparison/ranking:** "top X%", "better than", "above/below average", "percentile", "rank",
  "compared to other creators", "platform average", any number out of 100 implying a grade.
- **Guarantees:** "guaranteed growth / virality / acceptance / earnings".

Allowed framing (self-referential, actionable): "your restaurant videos outperformed your cafe videos
this month", "your evening posts retained more viewers than your afternoon posts", "shorter videos kept
viewers longer", "consider testing…", "not enough data yet". **Reasoning before advice (point 5):**
every recommendation must first state the *why* from the creator's own data, then the suggestion — e.g.
*"Your restaurant videos generated more saves and comments than your café videos over the past month.
Consider creating more restaurant-focused content if it aligns with your audience."* Not just "restaurant
videos perform better." Every answer ends with **what to do next**, grounded in the creator's own numbers. Tone = a supportive professional creator manager: data-driven,
never judgmental, never sensational. Brand-facing AI disclaimer: "Suggestions are based on available
performance data and may not guarantee results."

Implementation: ship a tiny `lib/ai/guard.ts` regex/keyword lint over every generated string; on a hit,
drop the offending sentence (or regenerate). Cheap insurance against a model slipping into comparison.

---

## 11. Cost control plan (deliverable 10)
- **Phyllo only for Pro-active creators** (the core rule) + free YouTube as the funnel.
- **AI:** Batch (−50%) + caching + Haiku for bulk + idempotent skip + rate limits + token caps → cents/creator.
- **Sync cadence:** nightly, not realtime; skip frozen accounts; backoff on errors.
- **Compute:** rollups precomputed (no live aggregate queries); watch Vercel function time as creators grow.
- **Hard ceilings:** per-creator monthly AI token budget; alert on Phyllo/AI spend anomalies.

---

## 12. Rollout plan (deliverable 11)
Feature flags: `collabr_certified`, `creator_pro`, `connected_creator`, `ai_growth_coach`.
1. **Collabr Certified → GA early** (free, no external dep; instant marketplace value).
2. **Creator Pro plumbing + free YouTube connect → invite beta** (flagged). Validate willingness-to-pay.
3. **Phyllo (IG/TikTok) → after Pro converts** and you have the Phyllo quote; widen.
4. **AI MVP → with Studio**, behind `ai_growth_coach`; batch first, interactive Content Lab next.
5. **GA** once enough Connected creators exist that brand filters return real results (empty filter = bad
   first impression).

---

## 13. Risks (deliverable 12)
- **Phyllo per-account cost vs S$15 price** — the make-or-break number; get the quote before pricing.
- **Cold-start coverage** — mitigate with free YouTube + founding price + invite beta.
- **Badge integrity / hollow data** — earned bar, non-negotiable.
- **AI hallucination / over-promise** — compute-don't-generate + schema + safety lint.
- **Cross-creator leakage** — server-built prompts, ownership checks, RLS.
- **Expiry bug syncing/charging lapsed users** — single `lib/entitlements.ts` gate, covered by tests.
- **Platform ToS** — official APIs / Phyllo only; **no unofficial scraping** (per your rule).
- **Subscription edge cases** — trials, past_due, proration, refunds, Stripe webhook ordering.
- **Scope creep** — Studio is large; ship Insights + Growth Summary + Report first, defer Content Lab chat.

---

## 14. Build now vs later (deliverable 13)

| Now (Phase 1–2) | Soon (Phase 3) | Later (Phase 4+) |
|---|---|---|
| 🛡️ Collabr Certified (compute + badge + brand filter) | ⭐ Connected via **YouTube (free)** | ⭐ Phyllo IG/TikTok sync |
| Creator Pro Stripe subscription + 7-day trial | Creator Studio: Insights (renders **Content DNA**) | AI: interactive Content Lab + streaming Coach chat |
| | **Content DNA engine** (`lib/analytics/contentDna.ts`, deterministic) + `content_dna` table | Brand↔creator matching (scores vs Content DNA, server-side) |
| **Nightly certification recompute** (suspend/reinstate, §2.2) | | |
| Expiry/freeze state machine + `entitlements.ts` | AI MVP: Growth Summary + Weekly Report (Haiku batch) | Brand discovery search (filters on facts) · category-level rate guidance |
| DB migrations `037`/`038` + adapter interface + rollup engine + `lib/certification/criteria.ts` (pure, tested) | Best-time-to-post (computed) · **AI Brand Coach** (invite analysis + Campaign Recap) | Email reports |
| Brand applicant cards + campaign analytics scaffolding (Connected-aware, honest empty states) | Goals tab | |

---

## 15. Implementation report template (what I'll give you when we build)
Per your Implementation Rules — each PR will report: files changed · migrations required · env vars
required (`ANTHROPIC_API_KEY`, `PHYLLO_*`, `STRIPE_CREATOR_PRO_PRICE_*`) · external services · new routes ·
new UI pages · new cron jobs · security risks · remaining decisions — and run **typecheck + tests + build**,
without breaking marketplace / payments / disputes / reviews / onboarding.

---

## 16. FINAL implementation plan (Phase 1 — the only thing I'd build first)

**Scope: 🛡️ Collabr Certified, end to end — free, no external services, no payments touched.** This is the
lowest-risk, highest-immediate-value slice and it exercises the whole pattern (migration → pure engine →
nightly recompute → badge → brand-facing facts → filters) before any Stripe/Phyllo/AI surface exists.

**Migration `037_collabr_certified.sql`** (additive, behind a flag, no behaviour change):
- `creator_profiles`: `certified boolean default false`, `certified_status text default 'none'`
  (`none|certified|suspended`), `certified_criteria jsonb`, `certified_suspended_reason text`,
  `certified_evaluated_at timestamptz`.
- RLS unchanged (these columns are readable wherever the creator profile already is; the *evaluator*
  writes via service role).

**Pure engine `lib/certification/criteria.ts`** (no I/O, unit-tested):
- Input: a creator's trailing-window facts (completed collabs, rating avg/count, dispute count/rate,
  completion rate, median response time) — all already derivable from existing tables.
- Output: `{ certified: boolean, status, criteria: {completed, reviews, rating, completion, disputes,
  unresolvedDisputes, responsive}, unmetReason }` — **booleans only, no number**, evaluated over the
  trailing 90d / last-20-collabs window with the §2.2 hysteresis bands so the badge stays stable.
- Thresholds come from a single server-side config object (the §2.2 defaults) — tunable without a deploy.

**Nightly cron `/api/cron/certification`** (`CRON_SECRET`, reuses the existing cron pattern):
- Recompute every creator; write `certified/certified_status/certified_criteria/...`; on a transition to
  `suspended`, set `certified_suspended_reason` + queue a notification; auto-reinstate when met again.

**UI (reuse existing components/tokens):**
- `🛡️ Collabr Certified` badge component + the transparent hover copy (§2.1), reading the same criteria
  config so copy never drifts. Shows nothing scary for non-certified (just absent).
- Brand-facing: add the badge + the **facts** (completed collabs, rating, response time, repeat brands)
  to applicant cards & creator profile — no score/percentile/ranking.
- Brand discovery: add a **"Collabr Certified"** toggle to the `FilterSelect` bar; default sort stays
  neutral (recency/relevance), so smaller creators remain discoverable.

**Tests:** criteria evaluator (met/unmet/suspend/reinstate/hysteresis), and a guard test that no
brand-facing payload includes a score/percentile field.

**Report on completion:** files changed · migration `037` · env (none new) · external services (none) ·
new route (`/api/cron/certification`) · new UI (badge + filter) · cron (nightly) · security (service-role
writes, facts-only brand reads) · `tsc + vitest + build` green · no change to payments/disputes/reviews/onboarding.

**Explicitly deferred to later phases:** Creator Pro subscription/Stripe, Connected/Phyllo/YouTube,
Creator Studio, all AI (Growth Coach, Content Lab, Brand Coach). None are touched in Phase 1.

---

## Decisions needed before Phase 1
1. ✅ RESOLVED (Roadmap v4): **no free funnel** — all connection is Creator Pro–only, Phyllo-only,
   created only after Stripe confirms payment.
2. **Build order**: Collabr Certified first (recommended), or all three together?
3. **Pricing**: S$15/mo + S$144/yr + 7-day trial (recommended) vs your S$12–19 — and founding price?
4. **AI models**: Haiku (batch) + Sonnet (interactive) — or Opus for interactive?
5. OK to add migrations `037`/`038` now (safe, behind flags, no behaviour change)?
6. ✅ **Collabr Certified thresholds locked** (defaults in §2.2): ≥5 completed collabs, ≥5 reviews,
   rating ≥4.6, completion ≥95%, dispute rate ≤2%, no unresolved disputes, median response ≤48h —
   over a trailing 90d / last-20-collabs window, with hysteresis. Flag if you want different numbers.
7. **AI Brand Coach** (§6.5) — approve as a Creator Pro feature and confirm the rate-guidance approach
   (own-data-first, neutral category market range only) from §0.5.
8. Confirm **certification is maintained/suspendable** (§2.2) and the trailing window (default 90d) +
   hysteresis approach.
