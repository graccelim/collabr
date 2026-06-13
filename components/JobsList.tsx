'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Shield, ArrowRight } from 'lucide-react'
import { formatSGD, getInitials } from '@/lib/utils'
import { NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'
import { computeFit } from '@/lib/fit'

export interface JobsListCampaign {
  id: string
  title: string
  comp_type: 'paid' | 'barter' | 'both'
  budget_min: number | null
  budget_max: number | null
  deadline: string | null
  niche_tags: string[] | null
  deliverable_types: string[] | null
  min_followers: number
  creators_needed: number
  is_featured: boolean
  platform: string | null
  brand_name: string
  brand_logo: string | null
}

interface CreatorContext {
  niches: string[]
  followers: number
}

function nicheLabel(tag: string): string {
  return NICHE_LABELS[tag as CreatorNiche] ?? tag
}

function paysLabel(c: JobsListCampaign): { value: string; money: boolean } {
  const hasPay = c.comp_type === 'paid' || c.comp_type === 'both'
  if (!hasPay) return { value: 'Barter', money: false }
  if (c.budget_min && c.budget_max) {
    return { value: `${formatSGD(c.budget_min)}–${formatSGD(c.budget_max)}`, money: true }
  }
  if (c.budget_min) return { value: formatSGD(c.budget_min), money: true }
  if (c.budget_max) return { value: formatSGD(c.budget_max), money: true }
  return { value: 'Paid', money: true }
}

function dueLabel(deadline: string | null): string {
  if (!deadline) return 'Flexible'
  return new Date(deadline).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

export default function JobsList({
  campaigns,
  creator,
}: {
  campaigns: JobsListCampaign[]
  creator: CreatorContext
}) {
  const [filter, setFilter] = useState<string>('__for_you')

  // Build the niche filter chip row: "For you" + each distinct campaign niche.
  const niches = useMemo(() => {
    const set = new Set<string>()
    campaigns.forEach(c => c.niche_tags?.forEach(t => set.add(t)))
    return Array.from(set)
  }, [campaigns])

  // Compute fit once per campaign (memoized) and sort by it.
  const ranked = useMemo(() => {
    return campaigns
      .map(c => ({
        c,
        fit: computeFit(
          { niches: creator.niches, followers: creator.followers },
          { niches: c.niche_tags ?? [], minFollowers: c.min_followers },
        ),
      }))
      .sort((a, b) => b.fit.pct - a.fit.pct)
  }, [campaigns, creator])

  const visible = useMemo(() => {
    if (filter === '__for_you') return ranked
    return ranked.filter(({ c }) => c.niche_tags?.includes(filter))
  }, [ranked, filter])

  return (
    <>
      {/* Niche filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          className={`chip${filter === '__for_you' ? ' on' : ''}`}
          onClick={() => setFilter('__for_you')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Sparkles size={14} />
          For you
        </button>
        {niches.map(n => (
          <button
            key={n}
            className={`chip${filter === n ? ' on' : ''}`}
            onClick={() => setFilter(n)}
          >
            {nicheLabel(n)}
          </button>
        ))}
      </div>

      {/* Campaign cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {visible.map(({ c, fit }) => {
          const pays = paysLabel(c)
          const deliverable = c.deliverable_types?.[0] ?? '—'
          return (
            <Link
              key={c.id}
              href={`/jobs/${c.id}`}
              className="card card-hover"
              style={{
                padding: 20,
                textDecoration: 'none',
                borderColor: c.is_featured ? 'var(--accent)' : 'var(--line)',
              }}
            >
              {/* Top zone */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
                  {/* Brand avatar */}
                  <div style={{
                    width: 46, height: 46, borderRadius: 'var(--radius-sm)',
                    background: 'var(--paper-2)', border: '1px solid var(--line)',
                    display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden',
                    fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)',
                  }}>
                    {c.brand_logo
                      ? <img src={c.brand_logo} alt={c.brand_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : getInitials(c.brand_name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{c.title}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-faint-solid)', marginTop: 2 }}>
                      {c.brand_name}{c.platform ? ` · ${c.platform}` : ''}
                    </div>
                    {c.niche_tags && c.niche_tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {c.niche_tags.map(t => (
                          <span key={t} style={{
                            fontSize: 11.5, color: 'var(--ink-soft)',
                            background: 'var(--paper-2)', padding: '3px 8px',
                            borderRadius: 'var(--radius-pill)',
                          }}>{nicheLabel(t)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Match pill */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  padding: '4px 9px', borderRadius: 'var(--radius-pill)',
                  background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                  fontSize: 12, fontWeight: 600,
                }}>
                  <Sparkles size={12} />
                  {fit.pct}% match
                </span>
              </div>

              {/* Bottom zone */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, flexWrap: 'wrap',
                marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)',
              }}>
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                  {[
                    { k: 'Pays', v: pays.value, money: pays.money },
                    { k: 'Deliverable', v: deliverable, money: false },
                    { k: 'Due', v: dueLabel(c.deadline), money: false },
                    { k: 'Spots', v: `${c.creators_needed} open`, money: false },
                  ].map(({ k, v, money }) => (
                    <div key={k}>
                      <div className="eyebrow" style={{ fontSize: 10 }}>{k}</div>
                      <div
                        className={money ? 'mono-num' : undefined}
                        style={{
                          fontSize: 14, fontWeight: 540, marginTop: 2,
                          color: money ? 'var(--money-deep)' : 'var(--ink)',
                        }}
                      >{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="badge badge-money" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Shield size={11} />
                    Escrow-backed
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 13, fontWeight: 540, color: 'var(--accent-deep)',
                  }}>
                    Apply <ArrowRight size={15} />
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
