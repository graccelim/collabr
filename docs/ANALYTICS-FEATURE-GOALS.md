# Collabr — Analytics & Creator-Growth Feature · Implementation Goals (Mega-Prompt)

> Paste this whole file to a coding agent as the spec. It is grounded in the
> real Collabr schema (Supabase + Next.js App Router + Stripe). **Do not invent
> tables that already exist** — reuse `collabs`, `campaigns`, `social_accounts`.

---

## ⚠️ Phase 0 — MANDATORY: verify the API landscape before writing code

API terms and endpoints change constantly. Before implementing, **research the
current state** (official docs + changelogs) and write findings to
`docs/analytics-api-findings.md`. Confirm, for each platform:

- **YouTube** — YouTube Data API v3 (public video stats: `videos.list?part=statistics`) + YouTube Analytics API (owner-authorized deep metrics). OAuth scopes, quota, pricing.
- **Instagram** — Instagram Graph API via Meta. Requires Instagram **Business/Creator** account linked to a Facebook Page, Facebook Login, and Meta **App Review** for `instagram_basic` + `instagram_manage_insights` + `pages_show_list`. (Basic Display API is deprecated — do not use.) Confirm media-insight metrics (reach, impressions, saves, engagement) still available.
- **TikTok** — TikTok for Developers Display API, `video.list` scope returns `view_count/like_count/comment_count/share_count`. Confirm OAuth, app-review requirements, and whether per-video time-series is available.
- **Lemon8** — confirm there is still **no official public API**. If true, Lemon8 is **manual/CSV/screenshot-only** in v1. Do NOT scrape Lemon8 in production (ToS + ban risk); note this explicitly in the findings.
- **Aggregator option** — evaluate **Phyllo** (and alternatives: Insense, Modash, HypeAuditor, Apify) as a single integration that normalizes TikTok/IG/YouTube with user consent. Recommend build-vs-aggregator with rough cost. Note whether the aggregator covers Lemon8 (likely not).

Deliver a recommendation: **(A) direct official APIs** or **(B) aggregator (Phyllo) for v1**. Default to (B) unless cost/coverage says otherwise. Then proceed.

---

## Product goals

### Brand analytics — two views
1. **Per-collab (single creator):** for one `collab`, show the performance of the delivered post(s): views, likes, comments, shares, saves, reach, engagement rate, and a small time-series since going live. Plus business context: agreed_rate, creator_payout, cost-per-view / cost-per-engagement.
2. **Per-campaign (all creators combined):** aggregate every collab in a `campaign`: total reach/views/engagement, blended engagement rate, total spend, blended CPV/CPE, per-platform breakdown, and a leaderboard of top-performing creators.

### Creator growth tools
1. **My content dashboard:** connect own accounts, auto-track own videos/posts over time (views/eng growth curves), see best & worst performers, best posting times.
2. **Trends:** a feed of trending hashtags/sounds/formats per platform + per niche (use TikTok Creative Center data, YouTube `chart=mostPopular`, and/or a trends API found in Phase 0). Be explicit about which trend sources are real vs. unavailable.
3. **Goals:** let a creator set a follower/views goal and track progress against tracked metrics.

---

## Data model (new migrations — follow existing migration conventions in `supabase/migrations/`)

Reuse existing: `collabs`, `campaigns`, `creator_profiles`, `brand_profiles`,
`social_accounts` (already has `platform` incl. `lemon8`, `verification_method`
incl. `oauth`, `verified_follower_count`). Add:

```sql
-- 1. OAuth/connection tokens per connected social account (encrypted at rest)
create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  provider text not null,                 -- 'youtube' | 'instagram' | 'tiktok' | 'phyllo'
  provider_account_id text,               -- channel/user id at the provider
  access_token text,                      -- ENCRYPTED (pgcrypto or app-layer)
  refresh_token text,                     -- ENCRYPTED
  token_expires_at timestamptz,
  scopes text[],
  status text not null default 'active',  -- 'active' | 'expired' | 'revoked' | 'error'
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. A tracked post/video (links a published piece of content to a collab and/or creator)
create table public.content_posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  collab_id uuid references public.collabs(id) on delete set null,   -- null = creator's own (not a paid collab)
  platform text not null,                 -- matches social_accounts.platform
  provider_post_id text,                  -- id at the platform (null for manual/lemon8)
  url text,
  caption text,
  posted_at timestamptz,
  source text not null default 'api',     -- 'api' | 'manual' | 'csv'
  created_at timestamptz default now(),
  unique (platform, provider_post_id)
);

-- 3. Time-series metric snapshots (one row per post per sync)
create table public.post_metrics (
  id bigserial primary key,
  content_post_id uuid not null references public.content_posts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  views bigint, likes bigint, comments bigint, shares bigint, saves bigint,
  reach bigint, impressions bigint,
  engagement_rate numeric,                -- computed, stored for fast reads
  raw jsonb                               -- full provider payload for audit
);
create index on public.post_metrics (content_post_id, captured_at desc);

-- 4. Optional: daily rollup per collab and per campaign for cheap dashboard reads
create table public.collab_analytics (
  collab_id uuid primary key references public.collabs(id) on delete cascade,
  total_views bigint default 0, total_likes bigint default 0,
  total_comments bigint default 0, total_shares bigint default 0,
  total_saves bigint default 0, total_reach bigint default 0,
  engagement_rate numeric, cost_per_view numeric, cost_per_engagement numeric,
  computed_at timestamptz default now()
);
```

- **RLS:** brands read analytics only for collabs/campaigns they own; creators read their own connections/posts/metrics. Token columns: service-role only. Mirror the existing RLS patterns in `migrations/`.
- **Encryption:** never store raw OAuth tokens in plaintext — use pgcrypto or an app-layer KMS. Document the choice.

---

## Sync architecture (reuse the existing cron pattern)

- Add cron routes under `app/api/cron/` guarded by `CRON_SECRET` (copy the pattern in `app/api/cron/recompute-scores/route.ts`), and register them in `vercel.json`:
  - `/api/cron/sync-content-metrics` (e.g. `0 */6 * * *`) — for every active `content_posts`, call the provider/aggregator, insert a `post_metrics` snapshot, refresh `collab_analytics`.
  - `/api/cron/refresh-social-tokens` (daily) — refresh expiring OAuth tokens; mark `status='error'` on failure and notify the creator.
- Respect provider rate limits + quota; batch and back off. Log failures to a sync-runs table or `last_error`.
- Newly-confirmed live posts: when a `collab` reaches `live_confirmed`, auto-create a `content_posts` row from `live_posts.post_url` (parse platform + provider_post_id from the URL) so collab analytics start tracking automatically.

---

## OAuth / connection flow

- New routes: `app/api/connect/[provider]/route.ts` (start OAuth) + `.../callback/route.ts` (exchange code, store encrypted tokens in `social_connections`, link to the creator's matching `social_accounts` row, set `verification_method='oauth'` and `verified_follower_count`).
- If using **Phyllo**: implement the Connect SDK + webhook receiver instead of per-provider OAuth; map Phyllo accounts → `social_connections(provider='phyllo')`.
- Lemon8 + any unsupported platform: a **manual entry / CSV import** UI writing `content_posts(source='manual')` and `post_metrics`.

---

## UI (Next.js App Router, match existing design system in `docs/DESIGN-BRIEF.md`)

- **Brand → campaign analytics:** `app/(dashboard)/campaigns/[id]/analytics/page.tsx` — KPI tiles (reach, engagement, spend, blended CPV/CPE), per-platform breakdown, top-creator leaderboard, trend chart.
- **Brand → collab analytics:** a tab/section on the existing collab detail page — post metrics + cost efficiency + time-series.
- **Creator → growth dashboard:** `app/(dashboard)/insights/page.tsx` — connected accounts, content table with growth sparklines, best/worst performers, best posting times, trends feed, goals.
- Charts: use a lightweight lib (e.g. Recharts or visx) consistent with bundle size. Reuse `--money`/navy tokens; green only for money metrics (spend/payout), navy/violet for reach/engagement.
- Always show **data freshness** ("updated 3h ago") and graceful empty/disconnected/error states.

---

## Phasing (ship incrementally)

1. **P0** — API findings doc + build-vs-aggregator decision.
2. **P1 (MVP)** — schema + manual/CSV entry + per-collab and per-campaign dashboards reading from `post_metrics`. Proves the UI/value with zero API risk.
3. **P2** — one real integration end-to-end (recommend **YouTube** first: simplest official API), auto-create posts from `live_confirmed` collabs, cron sync.
4. **P3** — Instagram + TikTok (or Phyllo for all three at once).
5. **P4** — creator growth tools: trends feed + goals.
6. **Lemon8** — manual-only until/unless an API appears.

## Acceptance criteria

- Brand sees accurate per-collab and per-campaign metrics with cost efficiency, refreshed on a schedule, with correct RLS (no cross-tenant leakage).
- Creator can connect ≥1 platform via OAuth/aggregator, see their content tracked over time, and view a trends feed.
- Tokens encrypted; no secrets in client bundles; cron routes `CRON_SECRET`-guarded.
- Honest UX where data is unavailable (esp. Lemon8) — no fake numbers.

## Non-goals / cautions

- No production scraping of platforms that forbid it (esp. Lemon8/Instagram). Prefer official APIs / aggregator.
- Don't block the MVP on Meta/TikTok app review — ship manual + YouTube first.
