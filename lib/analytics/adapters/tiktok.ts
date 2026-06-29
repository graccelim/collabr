// TikTok adapter — Display/Login Kit APIs (creator OAuth). externalId = open_id.
// ⚠️ Field paths follow the documented v2 APIs; verify at integration. Null-safe.
import type { AdapterAuth, NormalizedAccount, NormalizedPost, PlatformAdapter } from './types'

const API = 'https://open.tiktokapis.com/v2'
const num = (v: unknown): number | null => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v))

// GET — for /user/info/ (Display API user info is a GET request).
async function get(path: string, fields: string[], token: string): Promise<any> {
  const res = await fetch(`${API}/${path}?fields=${encodeURIComponent(fields.join(','))}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`TikTok ${path} ${res.status}`)
  return res.json()
}

// POST — for /video/list/ (paged, body carries max_count/cursor).
async function post(path: string, fields: string[], token: string, body: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch(`${API}/${path}?fields=${encodeURIComponent(fields.join(','))}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`TikTok ${path} ${res.status}`)
  return res.json()
}

export class TikTokAdapter implements PlatformAdapter {
  platform = 'tiktok' as const

  async fetchAccount(auth: AdapterAuth, _openId: string | null): Promise<NormalizedAccount> {
    const token = auth.accessToken
    if (!token) throw new Error('TikTok access token required')
    // user/info/ is a GET. follower_count requires the user.info.stats scope.
    const d = await get('user/info/', ['open_id', 'display_name', 'avatar_url', 'follower_count'], token)
    const u = d?.data?.user ?? {}
    return {
      platform: 'tiktok', handle: u?.display_name ?? null,
      followerCount: num(u?.follower_count),
      avgViews: null, avgLikes: null, avgComments: null, avgShares: null,
      engagementRate: null, audience: null, fetchedAt: new Date(),
    }
  }

  async fetchPosts(auth: AdapterAuth, _openId: string | null, _since: Date): Promise<NormalizedPost[]> {
    const token = auth.accessToken
    if (!token) return []
    const fields = ['id', 'create_time', 'share_url', 'view_count', 'like_count', 'comment_count', 'share_count', 'duration', 'title', 'video_description']
    const d = await post('video/list/', fields, token, { max_count: 20 })
    return (d?.data?.videos ?? []).map((v: any): NormalizedPost => ({
      externalId: String(v?.id ?? ''),
      platform: 'tiktok',
      url: v?.share_url ?? '',
      postedAt: v?.create_time ? new Date(Number(v.create_time) * 1000) : null,
      views: num(v?.view_count), likes: num(v?.like_count), comments: num(v?.comment_count),
      shares: num(v?.share_count), saves: null, reach: null,
      category: null, style: null, durationSec: num(v?.duration),
      title: v?.title ?? null,
      caption: v?.video_description ?? v?.title ?? null,
      hashtags: typeof (v?.video_description ?? v?.title) === 'string'
        ? ((v.video_description ?? v.title).match(/#[\w]+/g) || []).slice(0, 20) : null,
      mediaType: 'video',
    })).filter((p: NormalizedPost) => p.externalId)
  }
}
