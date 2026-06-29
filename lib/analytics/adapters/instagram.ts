// Instagram adapter — Instagram API with Instagram Login (graph.instagram.com).
// externalId = the IG user id (from the token response). ⚠️ Field paths follow
// the documented API; verify at integration. Null-safe: missing → null.
import type { AdapterAuth, NormalizedAccount, NormalizedPost, PlatformAdapter } from './types'

const API = 'https://graph.instagram.com'
const num = (v: unknown): number | null => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v))

async function get(path: string, params: Record<string, string>, token: string): Promise<any> {
  const res = await fetch(`${API}/${path}?` + new URLSearchParams({ ...params, access_token: token }))
  if (!res.ok) throw new Error(`Instagram ${path} ${res.status}`)
  return res.json()
}

export class InstagramAdapter implements PlatformAdapter {
  platform = 'instagram' as const

  async fetchAccount(auth: AdapterAuth, igUserId: string | null): Promise<NormalizedAccount> {
    const token = auth.accessToken
    if (!token || !igUserId) throw new Error('Instagram access token + user id required')
    const d = await get(igUserId, { fields: 'username,followers_count,media_count' }, token)
    return {
      platform: 'instagram', handle: d?.username ?? null,
      followerCount: num(d?.followers_count),
      avgViews: null, avgLikes: null, avgComments: null, avgShares: null,
      engagementRate: null, audience: null, fetchedAt: new Date(),
    }
  }

  async fetchPosts(auth: AdapterAuth, igUserId: string | null, _since: Date): Promise<NormalizedPost[]> {
    const token = auth.accessToken
    if (!token || !igUserId) return []
    const d = await get(`${igUserId}/media`, {
      fields: 'id,permalink,timestamp,media_type,media_product_type,like_count,comments_count,caption',
      limit: '50',
    }, token)
    const out: NormalizedPost[] = []
    for (const m of d?.data ?? []) {
      // Per-media insights (reach/saved/plays) — best effort; null if unavailable.
      // Photos/carousels don't support the `plays` metric, and requesting it 400s
      // the WHOLE insights call (losing reach + saved too), so only ask for plays
      // on video/reels.
      let reach: number | null = null, saved: number | null = null, plays: number | null = null
      const isVideo = m?.media_type === 'VIDEO' || m?.media_product_type === 'REELS'
      try {
        const ins = await get(`${m.id}/insights`, { metric: isVideo ? 'reach,saved,views' : 'reach,saved' }, token)
        for (const row of ins?.data ?? []) {
          const val = num(row?.values?.[0]?.value)
          if (row?.name === 'reach') reach = val
          else if (row?.name === 'saved') saved = val
          else if (row?.name === 'views' || row?.name === 'plays') plays = val
        }
      } catch { /* insights not available for this media type, leave null */ }
      out.push({
        externalId: String(m?.id ?? ''),
        platform: 'instagram',
        url: m?.permalink ?? '',
        postedAt: m?.timestamp ? new Date(m.timestamp) : null,
        views: plays, likes: num(m?.like_count), comments: num(m?.comments_count),
        shares: null, saves: saved, reach,
        category: null, style: null, durationSec: null,
        caption: m?.caption ?? null,
        hashtags: typeof m?.caption === 'string' ? (m.caption.match(/#[\w]+/g) || []).slice(0, 20) : null,
        mediaType: m?.media_type ?? null,
      })
    }
    return out.filter((p) => p.externalId)
  }
}
