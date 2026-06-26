// Provider abstraction for Connected analytics. Each social platform has a
// first-party adapter that emits the SAME normalized shapes. Dashboards/rollups/
// Content DNA only ever read normalized data — they never know which platform
// produced it. Adding a platform = one new adapter file; NO schema/UI changes.

export type Platform = 'tiktok' | 'instagram' | 'youtube'
export type AnalyticsSource = 'native'

export interface ConnectedAccountRef {
  id: string
  creatorId: string
  platform: Platform
  source: AnalyticsSource
  externalAccountId: string | null
}

// Auth handed to an adapter per connected account: an OAuth access token
// (Instagram/TikTok) and/or an app API key (YouTube public stats).
export interface AdapterAuth {
  accessToken: string | null
  apiKey?: string | null
}

export interface NormalizedAccount {
  platform: Platform
  handle: string | null
  followerCount: number | null
  avgViews: number | null
  avgLikes: number | null
  avgComments: number | null
  avgShares: number | null
  engagementRate: number | null // 0..1
  audience?: { topCountry?: string; ageBands?: Record<string, number> } | null
  fetchedAt: Date
}

export interface NormalizedPost {
  externalId: string
  platform: Platform
  url: string
  postedAt: Date | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  reach: number | null
  category?: string | null
  style?: string | null
  durationSec?: number | null
  // Creator-authored metadata — classification INPUT only (never performance).
  title?: string | null
  caption?: string | null
  hashtags?: string[] | null
  mediaType?: string | null
}

export interface PlatformAdapter {
  platform: Platform
  /** Pull current account-level metrics for one connected account. */
  fetchAccount(auth: AdapterAuth, externalId: string | null): Promise<NormalizedAccount>
  /** Pull recent posts + per-post metrics since a date. */
  fetchPosts(auth: AdapterAuth, externalId: string | null, since: Date): Promise<NormalizedPost[]>
}
