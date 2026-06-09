import { createClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import Link from 'next/link'
import { formatSGD, getInitials } from '@/lib/utils'

export default async function CreatorsPage() {
  await requireBrand()
  const supabase = createClient()

  const { data: creators } = await supabase.from('creator_profiles')
    .select('*, users(display_name, avatar_url)')
    .order('is_verified', { ascending: false })
    .order('boost_active_until', { ascending: false, nullsFirst: false })
    .order('rating_avg', { ascending: false })
    .limit(60)

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Browse creators</h1>
        <p className="text-sm text-gray-500 mt-0.5">{creators?.length || 0} creators on the platform</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {creators?.map(c => {
          const name = (c.users as any)?.display_name || 'Creator'
          const totalFollowers = Object.values((c.platforms as any) || {})
            .reduce((sum: number, p: any) => sum + (p.followers || 0), 0)
          const isBoosted = c.boost_active_until && new Date(c.boost_active_until) > new Date()

          return (
            <Link key={c.id} href={`/creators/${c.id}`}
              className={`card hover:border-purple-200 transition-colors ${isBoosted ? 'border-purple-300' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 text-sm font-medium flex items-center justify-center shrink-0">
                  {(c.users as any)?.avatar_url
                    ? <img src={(c.users as any).avatar_url} alt={name} className="w-10 h-10 rounded-full object-cover" />
                    : getInitials(name)
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
                    {c.is_verified && <span className="badge badge-teal text-xs">✓</span>}
                    {isBoosted && <span className="badge badge-purple text-xs">Boosted</span>}
                  </div>
                  {totalFollowers > 0 && (
                    <p className="text-xs text-gray-500">{totalFollowers.toLocaleString()} followers</p>
                  )}
                  {c.niches && c.niches.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.niches.slice(0, 2).map((n: string) => (
                        <span key={n} className="badge badge-gray text-xs">{n}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {c.rating_count > 0
                      ? <span className="text-xs text-gray-400">{c.rating_avg} ★</span>
                      : <span className="text-xs text-gray-300">No reviews</span>
                    }
                    {c.base_rate > 0 && (
                      <span className="text-xs font-medium text-gray-700">from {formatSGD(c.base_rate)}</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}

        {(!creators || creators.length === 0) && (
          <div className="col-span-3 card text-center py-10">
            <p className="text-sm text-gray-500">No creators yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
