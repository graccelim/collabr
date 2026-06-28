# Collabr — Platform Approval Pack

Copy-paste-ready text and steps for TikTok, Meta/Instagram, and Google/YouTube
review forms. Reflects what the code in this repo actually does.

Product context: Collabr is a creator collaboration marketplace. Creators
voluntarily connect their own TikTok, Instagram, or YouTube account to unlock
Creator Pro analytics, become Connected Creators, and show brands verified
profile metrics. We do not scrape, we do not ask for passwords, we only access
creator-authorized data through official APIs, and we use it to power Creator
Studio insights, verified creator profile metrics, and creator-owned analytics.

---

## ⚡ Key finding: YouTube does NOT need OAuth right now

`lib/analytics/adapters/youtube.ts` uses ONLY the YouTube Data API v3 with an
API key. It reads public channel stats and public per-video stats (views, likes,
comments) by channel ID. It does not use an OAuth token and never calls
`yt-analytics.readonly`.

- YouTube Data API v3 + API key is enough for current Creator Studio. No OAuth
  client, no consent screen, no sensitive-scope verification, no Google demo video.
- Request `yt-analytics.readonly` (OAuth) only later, if we add private analytics
  (impressions, traffic sources, watch time, demographics).
- Describe YouTube accurately as "public metrics retrieved by channel ID," not as
  OAuth-consented data (OAuth phrasing is true for TikTok and Instagram only).

---

## Shared values (all platforms)

Domain / URLs (www, no trailing slash):
- App: https://www.joincollabr.com
- Privacy: https://www.joincollabr.com/privacy
- Terms: https://www.joincollabr.com/terms
- Data deletion: https://www.joincollabr.com/data-deletion
- Meta data-deletion callback: https://www.joincollabr.com/api/legal/meta-data-deletion
  (POST-only for Meta's signed request; a GET returns a 200 status JSON.)

Redirect URIs (must match exactly):
- TikTok:    https://www.joincollabr.com/api/connected/oauth/tiktok/callback
- Instagram: https://www.joincollabr.com/api/connected/oauth/instagram/callback
- YouTube (future OAuth only): https://www.joincollabr.com/api/connected/oauth/youtube/callback

Set `NEXT_PUBLIC_APP_URL=https://www.joincollabr.com` in prod, and 301-redirect
the apex `joincollabr.com` to `www` (or register both), so the live callback
matches what you submit.

---

## 1) TikTok

### App description
Collabr is a creator collaboration marketplace. Creators voluntarily connect
their own TikTok account to unlock Creator Studio analytics, become a verified
Connected Creator, and present accurate performance metrics to brands they choose
to work with. Collabr never asks for passwords, never posts on a creator's
behalf, and never scrapes. We access only the creator-authorized data returned by
TikTok's official APIs, and only for the creator who connected the account.

### Data usage explanation
When a creator connects TikTok via Login Kit (OAuth 2.0), we read their basic
profile and the list of their own videos with each video's public engagement
counts (views, likes, comments, shares) and publish time. We use this to compute
the creator's own analytics in Creator Studio (best formats, best posting times,
performance over time) and to show verified performance metrics on their Collabr
profile to brands. Data is stored securely and associated only with that
creator's account. We do not sell data or share it with third parties other than
infrastructure sub-processors. Creators can disconnect at any time, which stops
collection and removes stored TikTok data.

### Privacy explanation
Our handling of TikTok data complies with the TikTok Developer Terms. We store
access tokens in restricted storage, transmit over HTTPS, use the data solely to
provide analytics to the creator who authorized it, and honor deletion requests
via in-app disconnect or our data-deletion page. Full detail at
https://www.joincollabr.com/privacy.

### Per-scope justification
- user.info.basic: Required to identify the TikTok account the creator just
  connected (open ID, display name, avatar) so we can attach the connection to
  the correct Collabr creator and show them which account is linked.
- video.list: Required to retrieve the connecting creator's own videos and their
  public metrics (view, like, comment and share counts and publish timestamps).
  This is the core data that powers the creator's Creator Studio analytics and
  their verified profile metrics. Read-only; no posting or write scopes.

### Demo video script (30 to 60s)
1. Open https://www.joincollabr.com, sign in as a creator.
2. Creator Studio → connected accounts → Connect TikTok.
3. Show the TikTok consent screen with user.info.basic and video.list. Approve.
4. Show Insights populating: stats, best-time-to-post chart, what's working.
5. Open the creator's public profile to show verified metrics.
6. Disconnect to show data removal; mention the /data-deletion page.
7. Narrate/caption: read-only, creator-authorized, used only for this creator.

### Redirect URI
https://www.joincollabr.com/api/connected/oauth/tiktok/callback

### Env vars
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=https://www.joincollabr.com

### Manual dashboard steps
1. developers.tiktok.com → Manage apps → create app.
2. Add Login Kit + Display API.
3. Add scopes user.info.basic, video.list.
4. Set the redirect URI; add Privacy + Terms URLs.
5. Copy Client key/secret into env.
6. Submit for review with the demo video (<=50MB, up to 5 videos).

### Test before submitting
- A sandbox test user completes connect; consent screen shows both scopes.
- Insights render from real returned data (not mock).
- Disconnect removes stored TikTok rows.
- Redirect URI matches exactly (www, https, no trailing slash).

---

## 2) Meta / Instagram

### App description
Collabr is a creator collaboration marketplace. Creators with an Instagram
professional (Business or Creator) account voluntarily connect it to unlock
Creator Studio analytics and show brands verified performance on their Collabr
profile. We use Facebook Login, never ask for passwords, never post or message on
the creator's behalf, and never scrape. We access only the creator-authorized
data returned by Meta's Graph API, for the creator who connected.

### Data usage explanation
After a creator authorizes via Facebook Login, we identify the Facebook Page they
manage that is linked to their Instagram professional account, then read that
Instagram account's profile, media, and media insights. We use this to compute
the creator's own analytics (formats, posting times, engagement) and verified
profile metrics shown to brands they choose to work with. Data is stored
securely, scoped to that creator, never sold, and shared only with infrastructure
sub-processors. Creators can disconnect at any time, and Meta's data-deletion
callback is honored automatically.

### Privacy explanation
Our use complies with the Meta Platform Terms and Developer Policies. We use the
minimum permissions needed, store tokens securely, transmit over HTTPS, and
provide deletion via in-app disconnect, our /data-deletion page, and the Meta Data
Deletion Callback at https://www.joincollabr.com/api/legal/meta-data-deletion.
Full detail at https://www.joincollabr.com/privacy.

### Per-scope justification
- instagram_basic: Required to identify the creator's connected Instagram
  professional account and read its basic profile and media list, so we can
  attach the connection to the right creator and enumerate their content.
- instagram_manage_insights: Required to read insights and metrics for the
  creator's own Instagram media and account (such as reach and interaction
  metrics) which power Creator Studio analytics and verified profile metrics.
  Read-only; only the connecting creator's own content.
- pages_show_list: The Instagram Graph API exposes a professional Instagram
  account only through the Facebook Page it is linked to. This lets the creator
  select, and lets us identify, the Page connected to their Instagram account so
  we can reach the correct Instagram Business account. We do not post to Pages.
- business_management: Required so creators whose Instagram/Page assets are owned
  or managed inside Meta Business Manager can still connect; it lets us resolve
  the linked Instagram Business account through their business assets. Read-only
  resolution of the asset link, no asset modification.

### Demo video script (30 to 60s)
1. Open https://www.joincollabr.com, sign in as a creator.
2. Creator Studio → connected accounts → Connect Instagram.
3. Show Facebook Login, the Page selection, and the permissions screen listing
   all four scopes. Approve.
4. Show Insights populating from Instagram data; show verified profile metrics.
5. Disconnect; mention /data-deletion and that Meta's removal callback is wired.
6. Narrate/caption: creator-authorized, read-only, used only for this creator.

### Redirect URI
https://www.joincollabr.com/api/connected/oauth/instagram/callback

### Env vars
META_APP_ID=
META_APP_SECRET=
NEXT_PUBLIC_APP_URL=https://www.joincollabr.com

### Manual dashboard steps
1. developers.facebook.com → Create App → Business.
2. Add Instagram Graph API + Facebook Login.
3. App settings → Basic: Privacy URL, Terms URL, Data deletion callback URL =
   https://www.joincollabr.com/api/legal/meta-data-deletion. Copy App ID/Secret.
4. Facebook Login → Settings → add the redirect URI.
5. Start Business Verification (company docs) — slowest step, ~5 to 15 business days.
6. App Review → request the 4 permissions with the use-case text + screencast.

### Test before submitting
- A dev/test user connects, sees the Page selector and all 4 scopes.
- Insights render from real Graph API data.
- The Meta callback returns 200 with { url, confirmation_code } for a POSTed
  signed request (requires META_APP_SECRET set, else 503). A browser GET returns
  a 200 status JSON.
- Disconnect removes stored IG data.

---

## 3) Google / YouTube (API key path, no OAuth review)

### App description
Collabr is a creator collaboration marketplace. For YouTube, creators provide
their channel, and Collabr reads public channel and video statistics through the
YouTube Data API v3 to power Creator Studio analytics and verified profile
metrics. We use a server-side API key for public data; we do not request access
to private user data and do not use OAuth for this.

### Data usage explanation
We call the YouTube Data API v3 (channels, playlistItems, videos) with an API key
to read a channel's public subscriber count and its public videos' public
statistics (views, likes, comments) and titles. These are used for the creator's
own analytics and verified metrics. No private analytics, no user OAuth, no write.

### Privacy explanation
Our use complies with the Google API Services User Data Policy. Because we use
only public data via an API key, no user data is accessed under OAuth scopes
today. If we later add private analytics (yt-analytics.readonly), we will complete
OAuth verification and update our privacy policy, which already includes the
Google Limited Use disclosure. Full detail at https://www.joincollabr.com/privacy.

### Per-scope justification
- YouTube Data API v3 (API key): Used to read public channel and public video
  statistics by channel ID to compute the creator's analytics and verified
  metrics. Public data only; no consent screen required.
- yt-analytics.readonly: NOT requested at this time. Only needed if/when we add
  private channel analytics. We will request via OAuth and complete sensitive-
  scope verification with a dedicated demo video at that time.

### Demo video script
Not required now (no OAuth/sensitive scope). If OAuth is added later, mirror the
TikTok/Meta script with the Google consent screen showing yt-analytics.readonly.

### Redirect URI
None needed now (API key has no redirect).
Future OAuth: https://www.joincollabr.com/api/connected/oauth/youtube/callback

### Env vars
YOUTUBE_API_KEY=
# Future OAuth only (leave unset now):
# GOOGLE_OAUTH_CLIENT_ID=
# GOOGLE_OAUTH_CLIENT_SECRET=

### Manual dashboard steps
1. console.cloud.google.com → create project.
2. APIs & Services → Library → enable YouTube Data API v3.
3. Credentials → Create API key → restrict to YouTube Data API v3 → YOUTUBE_API_KEY.
4. Done. No consent screen, no verification, no review for the current feature.

### Test before going live
- With the key set, a known channel ID returns real subscriber + video stats.
- Quota sufficient (Data API default 10,000 units/day; a few units per creator).

---

## Staging / Prod env list

Same keys in both environments, different values, different NEXT_PUBLIC_APP_URL.
Register BOTH redirect URIs (staging + prod) in each platform dashboard.

Approval-related:
- NEXT_PUBLIC_APP_URL  (prod: https://www.joincollabr.com ; staging: your preview URL)
- TIKTOK_CLIENT_KEY
- TIKTOK_CLIENT_SECRET
- META_APP_ID
- META_APP_SECRET
- YOUTUBE_API_KEY
- (future YouTube OAuth) GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET

Everything else the app needs in prod:
- Supabase: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- AI: ANTHROPIC_API_KEY
- Email: RESEND_API_KEY, RESEND_FROM_EMAIL
- Stripe: STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET,
  STRIPE_CREATOR_PRO_WEBHOOK_SECRET, and the price IDs (Brand Pro/Plus, Creator Pro, Boost)
- Cron: CRON_SECRET
- Flags: NEXT_PUBLIC_ANALYTICS_SUITE, NEXT_PUBLIC_ANALYTICS_AI, NEXT_PUBLIC_CONNECTED_CREATOR,
  NEXT_PUBLIC_CREATOR_PRO, NEXT_PUBLIC_CREATOR_STUDIO, NEXT_PUBLIC_COLLABR_CERTIFIED

Staging note: keep ANALYTICS_MOCK_MODE OFF when doing real platform test-connects,
or the demo will show mock data. Mock must never run in prod.

---

## The single do-not-think checklist

Phase A — prerequisites
- [ ] 301-redirect joincollabr.com to https://www.joincollabr.com; site loads on www.
- [ ] Set NEXT_PUBLIC_APP_URL=https://www.joincollabr.com in prod.
- [ ] Confirm /privacy, /terms, /data-deletion load.
- [ ] Set ANTHROPIC_API_KEY, YOUTUBE_API_KEY, RESEND_*.

Phase B — TikTok
- [ ] Create app, add Login Kit + Display API, scopes user.info.basic + video.list.
- [ ] Redirect https://www.joincollabr.com/api/connected/oauth/tiktok/callback + Privacy/Terms.
- [ ] Set TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET; test connect in sandbox.
- [ ] Record demo; submit with per-scope text.

Phase C — Meta / Instagram (start verification first)
- [ ] Create Business app, add Instagram Graph API + Facebook Login.
- [ ] Set Privacy, Terms, Data Deletion Callback URL.
- [ ] Add redirect; set META_APP_ID / META_APP_SECRET.
- [ ] Start Business Verification now.
- [ ] Test connect with a dev user; confirm callback returns 200.
- [ ] Submit App Review for the 4 scopes with text + screencast.

Phase D — YouTube
- [ ] Enable YouTube Data API v3, create restricted API key → YOUTUBE_API_KEY. Done.

Phase E — supporting
- [ ] Stripe: activate live, create price IDs, set webhook secrets.
- [ ] Resend: verify domain DNS.
- [ ] Final: real connect per platform on prod, Insights show real (non-mock) data,
      disconnect deletes data.
