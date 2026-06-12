import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { formatSGD, getInitials } from '@/lib/utils'
import { NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'
import type { SocialAccount } from '@/types'
import Link from 'next/link'

export default async function CreatorProfilePage({ params }: { params: { id: string } }) {
  await requireAuth()
  const supabase = createClient()

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, user_id, bio, niche, niches, platforms, base_rate, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, total_earned, created_at, users(display_name, avatar_url)')
    .eq('id', params.id).single()
  if (!creator) return <p className="text-sm text-red-500">Creator not found.</p>

  // Trust signals: connected socials + email verification status
  const { data: socialAccounts } = await supabase.from('social_accounts')
    .select('*').eq('creator_id', params.id)
    .order('is_primary', { ascending: false }).order('created_at')
  const { data: emailVerified } = await supabase
    .rpc('user_email_verified', { p_user_id: creator.user_id })

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
              {emailVerified === true && <span className="badge badge-teal">Email verified</span>}
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

      {/* Niche & rate */}
      <div className="grid grid-cols-2 gap-3">
        {(creator.niche || (creator.niches && creator.niches.length > 0)) && (
          <div className="card">
            <p className="text-xs text-gray-500 mb-2">Niche</p>
            <div className="flex flex-wrap gap-1">
              {creator.niche
                ? <span className="badge badge-gray">{NICHE_LABELS[creator.niche as CreatorNiche] || creator.niche}</span>
                : creator.niches!.map((n: string) => (
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

      {/* Connected socials */}
      {socialAccounts && socialAccounts.length > 0 ? (
        <div className="card">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Connected socials</h2>
          <div className="space-y-2">
            {(socialAccounts as SocialAccount[]).map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700 capitalize">{s.platform}</span>
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-gray-400 ml-2 hover:text-gray-600">@{s.handle}</a>
                  {s.is_primary && <span className="badge badge-purple ml-2 text-xs">Primary</span>}
                  {s.verification_status === 'verified' && <span className="badge badge-teal ml-2 text-xs">Verified</span>}
                </div>
                {s.follower_count != null && (
                  <span className="text-sm font-medium text-gray-900">
                    {s.follower_count.toLocaleString()} followers
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : creator.platforms && Object.keys(creator.platforms).length > 0 ? (
        // Legacy fallback for profiles created before normalized socials
        <div className="card">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Platforms</h2>
          <div className="space-y-2">
            {Object.entries(creator.platforms as Record<string, { handle: string; followers: number; verified: boolean }>)
              .map(([platform, info]) => (
                <div key={platform} className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700 capitalize">{platform}</span>
                    <span className="text-xs text-gray-400 ml-2">@{info.handle}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {Number(info.followers || 0).toLocaleString()} followers
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

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
