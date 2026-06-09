import { createClient } from '@/lib/supabase/server'
import { requireCreator } from '@/lib/auth'
import Link from 'next/link'
import { formatSGD } from '@/lib/utils'
import { ArrowRight, Calendar, Users } from 'lucide-react'

export default async function JobsPage() {
  await requireCreator()
  const supabase = createClient()
  const { data: campaigns } = await supabase.from('campaigns')
    .select('*, brand_profiles(company_name, logo_url)')
    .eq('status', 'active')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 28 }}>Browse campaigns</h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 4, fontSize: 15 }}>
          {campaigns?.length || 0} open campaign{campaigns?.length !== 1 ? 's' : ''} right now
        </p>
      </div>

      {/* Campaign cards */}
      {campaigns && campaigns.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {campaigns.map(c => {
            const brand = c.brand_profiles as any
            const brandInitials = (brand?.company_name || 'B').slice(0, 2).toUpperCase()
            const hasPay = c.comp_type === 'paid' || c.comp_type === 'both'
            const hasBarter = c.comp_type === 'barter' || c.comp_type === 'both'

            return (
              <Link
                key={c.id}
                href={`/jobs/${c.id}`}
                className="card card-hover"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 18, padding: 20,
                  alignItems: 'start',
                  borderColor: c.is_featured ? 'var(--creator)' : 'var(--line)',
                  textDecoration: 'none',
                }}
              >
                {/* Brand logo / initials */}
                <div style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: 'var(--paper-2)',
                  display: 'grid', placeItems: 'center',
                  fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)',
                  flexShrink: 0, overflow: 'hidden',
                  border: '1px solid var(--line)',
                }}>
                  {brand?.logo_url
                    ? <img src={brand.logo_url} alt={brand.company_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : brandInitials}
                </div>

                {/* Main info */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{c.title}</span>
                    {c.is_featured && (
                      <span className="badge badge-accent">Featured</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 10 }}>
                    {brand?.company_name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {hasPay && (
                      <span className="badge badge-money">
                        Paid · {c.budget_min ? formatSGD(c.budget_min) : '—'}{c.budget_max ? `–${formatSGD(c.budget_max)}` : ''}
                      </span>
                    )}
                    {hasBarter && (
                      <span className="badge badge-pending">Barter</span>
                    )}
                    {c.niche_tags?.map((tag: string) => (
                      <span key={tag} className="badge badge-neutral">{tag}</span>
                    ))}
                    {c.deliverable_types?.slice(0, 3).map((d: string) => (
                      <span key={d} className="badge badge-neutral">{d}</span>
                    ))}
                    {c.deadline && (
                      <span className="badge badge-neutral" style={{ display: 'inline-flex', gap: 4 }}>
                        <Calendar size={11} />
                        {new Date(c.deadline).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {c.min_followers > 0 && (
                      <span className="badge badge-neutral" style={{ display: 'inline-flex', gap: 4 }}>
                        <Users size={11} />
                        {c.min_followers >= 1000 ? `${Math.round(c.min_followers / 1000)}k+` : `${c.min_followers}+`} followers
                      </span>
                    )}
                  </div>
                </div>

                {/* CTA arrow */}
                <div style={{ color: 'var(--accent-deep)', flexShrink: 0, marginTop: 4 }}>
                  <ArrowRight size={20} />
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 56 }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>🔍</div>
          <h3 style={{ marginBottom: 8 }}>No campaigns right now</h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14.5 }}>
            Check back soon — new campaigns are posted regularly.
          </p>
        </div>
      )}
    </div>
  )
}
