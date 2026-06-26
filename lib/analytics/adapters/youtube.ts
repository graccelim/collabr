// YouTube adapter — public stats via the Data API v3 (API key, no creator OAuth,
// no app review). externalId = the channel id. ⚠️ Field paths follow the documented
// Data API v3 responses; verify against a live response at integration. Null-safe:
// a missing field becomes null, never a fabricated number.
import type { AdapterAuth, NormalizedAccount, NormalizedPost, PlatformAdapter } from './types'

const API = 'https://www.googleapis.com/youtube/v3'
const num = (v: unknown): number | null => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v))

// ISO-8601 duration (e.g. PT1M30S) → seconds.
function isoDuration(s: string | null | undefined): number | null {
  if (!s) return null
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s)
  if (!m) return null
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0))
}

async function get(path: string, params: Record<string, string>, key: string): Promise<any> {
  const res = await fetch(`${API}/${path}?` + new URLSearchParams({ ...params, key }))
  if (!res.ok) throw new Error(`YouTube ${path} ${res.status}`)
  return res.json()
}

export class YouTubeAdapter implements PlatformAdapter {
  platform = 'youtube' as const

  async fetchAccount(auth: AdapterAuth, channelId: string | null): Promise<NormalizedAccount> {
    const key = auth.apiKey
    if (!key || !channelId) throw new Error('YouTube API key + channel id required')
    const d = await get('channels', { part: 'statistics,snippet', id: channelId }, key)
    const it = d?.items?.[0]
    const st = it?.statistics ?? {}
    return {
      platform: 'youtube', handle: it?.snippet?.title ?? null,
      followerCount: num(st.subscriberCount),
      avgViews: null, avgLikes: null, avgComments: null, avgShares: null,
      engagementRate: null, audience: null, fetchedAt: new Date(),
    }
  }

  async fetchPosts(auth: AdapterAuth, channelId: string | null, _since: Date): Promise<NormalizedPost[]> {
    const key = auth.apiKey
    if (!key || !channelId) return []
    // channel → uploads playlist → recent video ids → video stats.
    const ch = await get('channels', { part: 'contentDetails', id: channelId }, key)
    const uploads = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploads) return []
    const pl = await get('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: '50' }, key)
    const ids = (pl?.items ?? []).map((i: any) => i?.contentDetails?.videoId).filter(Boolean)
    if (!ids.length) return []
    const vids = await get('videos', { part: 'statistics,snippet,contentDetails', id: ids.join(',') }, key)
    return (vids?.items ?? []).map((v: any): NormalizedPost => ({
      externalId: String(v?.id ?? ''),
      platform: 'youtube',
      url: v?.id ? `https://www.youtube.com/watch?v=${v.id}` : '',
      postedAt: v?.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
      views: num(v?.statistics?.viewCount),
      likes: num(v?.statistics?.likeCount),
      comments: num(v?.statistics?.commentCount),
      shares: null, saves: null, reach: null,
      category: null, style: null,
      durationSec: isoDuration(v?.contentDetails?.duration),
      title: v?.snippet?.title ?? null,
      caption: v?.snippet?.description ?? null,
      hashtags: Array.isArray(v?.snippet?.tags) ? v.snippet.tags.slice(0, 20) : null,
      mediaType: 'video',
    })).filter((p: NormalizedPost) => p.externalId)
  }
}
