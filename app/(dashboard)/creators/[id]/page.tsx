import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { formatSGD, getInitials } from '@/lib/utils'
import Link from 'next/link'

export default async function CreatorProfilePage({ params }: { params: { id: string } }) {
  await requireAuth()
  const supabase = createClient()

  const { data: creator } = await supabase.from('creator_profiles')
    .select('*, users(display_name, email, avatar_url)')
    .eq('id', params.id).single()
  if (!creator) return <p className="text-sm text-red-500">Creator not found.</p>

  const { data: reviews } = await supabase.from('reviews')
    .select('*, collabs(campaigns(title))')
    .eq('reviewer_type', 'brand')
    .eq('collab_id', supabase.from('collabs').select('id').eq('creator_id', params.id) as any)
    .order('created_at', { ascending: false })
    .limit(10)

  // Fetch reviews differently — join via collabs
  const { data: brandReviews } = await supabase.from('reviews')
    .select('*, collabs!inner(id, creator_id, campaigns(title))')
    .eq('reviewer_type', 'brand')
    .eq('collabs.creator_id', params.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const name = (creator.users as any)?.display_name || 'Creator'
  const isBoosted = creator.boost_active_until && new Date(creator.boost_active_until) > new Date()
  const totalFollowers = Object.values((creator.platforms as any) || {})
    .reduce((sum: number, p: any) => sum + (p.followers || 0), 0)

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/creators" className="text-xs text-gray-400 hover:text-gray-600">← Creators</Link>

      {/* Profile header */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-600 text-xl font-medium flex items-center justify-center shrink-0 overflow-hidden">
            {(creator.users as any)?.avatar_url
              ? <img src={(creator.users as any).avatar_url} alt={name} className="w-16 h-16 object-cover" />
              : getInitials(name)
            }
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-gray-900">{name}</h1>
              {creator.is_verified && <span className="badge badge-teal">Verified</span>}
              {isBoosted && <span className="badge badge-purple">Boosted</span>}
            </div>
            {creator.rating_count > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                {creator.rating_avg} ★ · {creator.rating_count} review{creator.rating_count !== 1 ? 's' : ''}
              </p>
            )}
            {creator.collabs_completed > 0 && (
              <p className="text-xs text-gray-400">{creator.collabs_completed} collabs completed</p>
            )}
          </div>
        </div>

        {creator.bio && (
          <p className="text-sm text-gray-600 mt-4 whitespace-pre-wrap">{creator.bio}</p>
        )}
      </div>

      {/* Niches & rate */}
      <div className="grid grid-cols-2 gap-3">
        {creator.niches && creator.niches.length > 0 && (
          <div className="card">
            <p className="text-xs text-gray-500 mb-2">Niches</p>
            <div className="flex flex-wrap gap-1">
              {creator.niches.map((n: string) => (
                <span key={n} className="badge badge-gray">{n}</span>
              ))}
            </div>
          </div>
        )}
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Base rate</p>
          <p className="text-lg font-semibold text-gray-900">
            {creator.base_rate > 0 ? formatSGD(creator.base_rate) : 'Negotiable'}
          </p>
        </div>
      </div>

      {/* Platforms */}
      {creator.platforms && Object.keys(creator.platforms).length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Platforms</h2>
          <div className="space-y-2">
            {Object.entries(creator.platforms as Record<string, { handle: string; followers: number; verified: boolean }>)
              .map(([platform, info]) => (
                <div key={platform} className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700 capitalize">{platform}</span>
                    <span className="text-xs text-gray-400 ml-2">@{info.handle}</span>
                    {info.verified && <span className="badge badge-teal ml-2 text-xs">Verified</span>}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {info.followers.toLocaleString()} followers
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {brandReviews && brandReviews.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-900 mb-3">Brand reviews</h2>
          <div className="space-y-3">
            {brandReviews.map(r => {
              const campaign = (r.collabs as any)?.campaigns
              return (
                <div key={r.id} className="card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">{campaign?.title || 'Collab'}</span>
                    <span className="text-sm font-medium">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  </div>
                  {r.note && <p className="text-sm text-gray-600">{r.note}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
