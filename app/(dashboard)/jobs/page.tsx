import { createClient } from '@/lib/supabase/server'
import { requireCreator } from '@/lib/auth'
import Link from 'next/link'
import { formatSGD } from '@/lib/utils'

export default async function JobsPage() {
  await requireCreator()
  const supabase = createClient()
  const { data: campaigns } = await supabase.from('campaigns')
    .select('*, brand_profiles(company_name, logo_url)')
    .eq('status', 'active')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Browse campaigns</h1>
        <p className="text-sm text-gray-500 mt-0.5">{campaigns?.length || 0} open campaigns</p>
      </div>
      <div className="space-y-3">
        {campaigns?.map(c => (
          <Link key={c.id} href={`/jobs/${c.id}`}
            className="card flex items-start gap-4 hover:border-purple-200 transition-colors block">
            <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-xs font-medium text-gray-500 shrink-0">
              {((c.brand_profiles as any)?.company_name || 'B').slice(0,2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{c.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{(c.brand_profiles as any)?.company_name}</div>
                </div>
                {c.is_featured && <span className="badge badge-purple shrink-0">Featured</span>}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {c.comp_type === 'paid' || c.comp_type === 'both' ? (
                  <span className="badge badge-teal">
                    Paid · {c.budget_min ? formatSGD(c.budget_min) : '—'}{c.budget_max ? `–${formatSGD(c.budget_max)}` : ''}
                  </span>
                ) : null}
                {c.comp_type === 'barter' || c.comp_type === 'both' ? (
                  <span className="badge badge-amber">Barter</span>
                ) : null}
                {c.niche_tags?.map((tag: string) => (
                  <span key={tag} className="badge badge-gray">{tag}</span>
                ))}
                {c.deadline && (
                  <span className="badge badge-gray">Due {new Date(c.deadline).toLocaleDateString('en-SG')}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
        {(!campaigns || campaigns.length === 0) && (
          <div className="card text-center py-10">
            <p className="text-gray-500 text-sm">No campaigns right now. Check back soon.</p>
          </div>
        )}
      </div>
    </div>
  )
}
